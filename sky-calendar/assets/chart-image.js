/* ChartImage: "Save chart as image" for the birth chart. WEBSITE BUILD ONLY (Claude Artifacts block downloads).
   Draws the chart the viewer is looking at into a portrait PNG (1080 px wide by default), in the page's
   current theme colors, and saves it: the share sheet on phones (iPhone users can pick "Save Image"),
   a normal download everywhere else.

   Needs the birth chart UI on the page: window.NatalUI.current ({ st, chart, t, isExample }), the
   #nbBig3 cards, and NatalWheel / NatalAstro / NatalPlace (all already in the calendar page).

   API (global ChartImage):
     ChartImage.attach({ container, position, getCurrent, onSaved, fontUrls, footer, width, scale })
       Adds <button type="button" class="btn" id="nbSaveImg">Save chart as image</button> and a status
       line (#nbSaveMsg) to `container` (element or selector; inserted at `position`, default 'beforeend').
       onSaved(kind) is called after a save, kind = 'share' or 'download'. Returns { button, status }.
     ChartImage.render(current, opts) -> Promise<HTMLCanvasElement>
     ChartImage.wheelSvg(current, opts) -> Promise<string>  (the self-contained wheel SVG, fonts embedded)
     ChartImage.fileName(current) -> 'birth-chart-YYYY-MM-DD.png'
   opts: width (layout px, default 540), scale (pixel density, default 2), footer (text),
         fontUrls (optional list of { family, url, weight, style, unicodeRange } or { family: url | [url] };
         by default the @font-face rules of the page's own stylesheets are used), wheelFontScale (default 1.2). */
(function () {
  'use strict';

  const DEFAULTS = {
    width: 540, scale: 2, wheelFontScale: 1.2,
    footer: '13-Month Sky Calendar · rorycorn.github.io/sky-calendar', fontUrls: null
  };
  const TROP = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
  const TROP_GLYPH = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
  const CON_GLYPH = { Psc: '♓', Ari: '♈', Tau: '♉', Gem: '♊', Cnc: '♋', Leo: '♌', Vir: '♍', Lib: '♎', Sco: '♏', Oph: '⛎', Sgr: '♐', Cap: '♑', Aqr: '♒' };
  const VS15 = '\uFE0E';   // text presentation, never emoji
  const tp = g => String(g || '').replace(/([♀♂♈-♓⛎])(?!\uFE0E)/g, '$1' + VS15);
  const dms = x => { const d = Math.floor(x), m = Math.floor((x - d) * 60 + 1e-9); return `${d}°${String(m).padStart(2, '0')}′`; };
  const q = s => document.querySelector(s);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const withTimeout = (p, ms) => Promise.race([p, sleep(ms).then(() => { throw new Error('timeout'); })]);

  // ---------- theme ----------
  function theme() {
    const cs = getComputedStyle(document.documentElement);
    const v = (k, d) => (cs.getPropertyValue(k) || '').trim() || d;
    const T = {
      bg: v('--bg', '#ECEFF3'), surface: v('--surface', '#F8F9FB'), ink: v('--ink', '#19213A'), muted: v('--muted', '#58627A'),
      line: v('--line', '#C9D0DC'), accent: v('--accent', '#96640F'), accentSoft: v('--accent-soft', '#F2E4C6'), sky: v('--sky', '#2E4687'),
      skyB: v('--sky-b', '#C2CEE6'), aspHard: v('--asp-hard', '#A8432C'), aspSoft: v('--asp-soft', '#2B7259'),
      fDisplay: v('--f-display', 'Georgia, serif'), fBody: v('--f-body', 'system-ui, sans-serif'), fData: v('--f-data', 'ui-monospace, Menlo, monospace'),
      fGlyph: v('--f-glyph', '"Apple Symbols", "Segoe UI Symbol", sans-serif')
    };
    // the wheel's own glyph stack (natal-wheel.css): the Sun is only in Noto Sans Symbols 2
    T.fSym = `"Noto Sans Symbols", "Noto Sans Symbols 2", ${T.fGlyph}`;
    return T;
  }

  // ---------- fonts: the page's @font-face rules ----------
  const fileCache = new Map();
  function dataUrl(url) {
    if (!fileCache.has(url)) {
      const p = (async () => {
        const ctl = typeof AbortController === 'function' ? new AbortController() : null;
        const timer = setTimeout(() => ctl && ctl.abort(), 10000);
        try {
          const r = await fetch(url, ctl ? { signal: ctl.signal } : {});
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const b = await r.blob();
          return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); });
        } finally { clearTimeout(timer); }
      })();
      p.catch(() => fileCache.delete(url));
      fileCache.set(url, p);
    }
    return fileCache.get(url);
  }

  const unq = s => String(s || '').trim().replace(/^["']|["']$/g, '');
  const families = list => String(list || '').split(',').map(unq).filter(Boolean);
  function pickSrc(src, base) {
    const re = /url\(\s*(['"]?)([^'")]+)\1\s*\)\s*(?:format\(\s*['"]?([\w-]+)['"]?\s*\))?/g;
    let m, best = null;
    while ((m = re.exec(src))) {
      const fmt = (m[3] || '').toLowerCase();
      const rank = fmt === 'woff2' || /\.woff2(\?|#|$)/i.test(m[2]) ? 3 : fmt === 'woff' || /\.woff(\?|#|$)/i.test(m[2]) ? 2 : 1;
      if (!best || rank > best.rank) best = { url: m[2], rank };
    }
    if (!best) return null;
    try { return new URL(best.url, base).href; } catch (e) { return null; }
  }
  function weightRange(w) {
    const n = String(w || '400').trim().split(/\s+/).map(x => x === 'normal' ? 400 : x === 'bold' ? 700 : +x).filter(x => x > 0);
    return n.length ? [n[0], n[n.length - 1]] : [400, 400];
  }
  function face(family, url, weight, style, range) {
    return url ? { family: unq(family), url, w: weightRange(weight), style: /italic|oblique/.test(style || '') ? 'italic' : 'normal', range: (range || '').trim() } : null;
  }
  // @font-face blocks in CSS text (for a stylesheet the CSSOM will not show, e.g. another origin)
  function parseFaces(css, base) {
    const out = [];
    css.replace(/@font-face\s*\{([^}]*)\}/g, (all, body) => {
      const get = k => { const m = body.match(new RegExp('(?:^|;)\\s*' + k + '\\s*:\\s*([^;]+)', 'i')); return m ? m[1].trim() : ''; };
      const f = face(get('font-family'), pickSrc(get('src'), base), get('font-weight'), get('font-style'), get('unicode-range'));
      if (f) out.push(f);
      return '';
    });
    return out;
  }
  async function pageFaces(opts) {
    const out = [], foreign = [];
    const fu = opts.fontUrls;
    if (Array.isArray(fu)) fu.forEach(x => { const f = x && face(x.family, x.url && new URL(x.url, document.baseURI).href, x.weight, x.style, x.unicodeRange); if (f) out.push(f); });
    else if (fu && typeof fu === 'object') Object.keys(fu).forEach(k => [].concat(fu[k]).forEach(u => { const f = face(k, new URL(u, document.baseURI).href, '100 900', 'normal', ''); if (f) out.push(f); }));
    if (out.length) return out;
    const visit = (rules, base) => {
      for (const r of rules) {
        if (r.type === 5 /* CSSRule.FONT_FACE_RULE */) {
          const s = r.style;
          const f = face(s.getPropertyValue('font-family'), pickSrc(s.getPropertyValue('src'), base), s.getPropertyValue('font-weight'), s.getPropertyValue('font-style'), s.getPropertyValue('unicode-range'));
          if (f) out.push(f);
        } else if (r.styleSheet) {
          try { visit(r.styleSheet.cssRules, r.styleSheet.href || base); } catch (e) { if (r.styleSheet.href) foreign.push(r.styleSheet.href); }
        } else if (r.cssRules) visit(r.cssRules, base);
      }
    };
    for (const sh of document.styleSheets) {
      try { visit(sh.cssRules, sh.href || document.baseURI); } catch (e) { if (sh.href) foreign.push(sh.href); }
    }
    // stylesheets from another origin (the artifact build's Google Fonts): read their text instead
    for (const href of foreign) {
      try {
        const r = await withTimeout(fetch(href), 6000);
        if (r.ok) out.push(...parseFaces(await r.text(), href));
      } catch (e) { /* the image still renders, with fallback fonts */ }
    }
    return out;
  }
  function parseRange(s) {
    if (!s) return null;
    return s.split(',').map(t => t.trim().replace(/^u\+/i, '')).filter(Boolean).map(t => {
      if (t.includes('-')) { const [a, b] = t.split('-'); return [parseInt(a, 16), parseInt(b, 16)]; }
      if (t.includes('?')) return [parseInt(t.replace(/\?/g, '0'), 16), parseInt(t.replace(/\?/g, 'F'), 16)];
      const n = parseInt(t, 16); return [n, n];
    });
  }
  const covers = (ranges, chars) => !ranges || [...chars].some(c => { const n = c.codePointAt(0); return ranges.some(([a, b]) => n >= a && n <= b); });

  // @font-face rules (with data: URLs) for the fonts the wheel's text uses
  async function embedFonts(uses, opts) {
    let faces;
    try { faces = await pageFaces(opts); } catch (e) { faces = []; }
    const chosen = new Set(), css = [];
    uses.forEach((u, key) => {
      const [fam, wt, style] = key.split('|');
      const cands = faces.filter(f => f.family.toLowerCase() === fam.toLowerCase());
      if (!cands.length) return;
      const st = cands.some(f => f.style === style) ? style : cands[0].style;
      const pool = cands.filter(f => f.style === st);
      const dist = f => (+wt >= f.w[0] && +wt <= f.w[1]) ? 0 : Math.min(Math.abs(+wt - f.w[0]), Math.abs(+wt - f.w[1])) + (+wt < f.w[0] ? 0.5 : 0);
      const best = Math.min(...pool.map(dist));
      pool.filter(f => dist(f) === best && covers(parseRange(f.range), u)).forEach(f => chosen.add(f));
    });
    await Promise.all([...chosen].map(async f => {
      try {
        const src = await dataUrl(f.url);
        const fmt = /woff2/i.test(src.slice(0, 40)) || /\.woff2/i.test(f.url) ? 'woff2' : /woff/i.test(src.slice(0, 40)) || /\.woff/i.test(f.url) ? 'woff' : 'truetype';
        css.push(`@font-face{font-family:"${f.family}";src:url(${src}) format("${fmt}");font-weight:${f.w[0] === f.w[1] ? f.w[0] : f.w[0] + ' ' + f.w[1]};font-style:${f.style}${f.range ? ';unicode-range:' + f.range : ''}}`);
      } catch (e) { /* skip this face: the text falls back to the next font in its list */ }
    }));
    return { css: css.join('\n'), faces: css.length };
  }

  // ---------- the wheel as a self-contained SVG ----------
  const SHAPE_PROPS = ['fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-dashoffset',
    'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'opacity', 'paint-order'];
  const TEXT_PROPS = ['font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'letter-spacing', 'word-spacing'];

  async function wheelSvg(cur, opts, px) {
    opts = { ...DEFAULTS, ...(opts || {}) };
    // Draw a fresh copy of the wheel inside the page (so the page CSS applies, with no hover state),
    // or fall back to the one on screen.
    let host = null, src = null;
    if (window.NatalWheel && cur && cur.chart) {
      host = document.createElement('div');
      host.setAttribute('aria-hidden', 'true');
      host.style.cssText = 'position:absolute;left:-10000px;top:0;width:640px;opacity:0;pointer-events:none;overflow:hidden';
      host.innerHTML = window.NatalWheel.render(cur.chart, { idPrefix: 'ciw', showAspects: true, caption: false, fontScale: opts.wheelFontScale });
      document.body.appendChild(host);
      src = host.querySelector('svg');
    } else src = q('#nbWheel svg');
    if (!src) throw new Error('no wheel');
    try {
      const clone = src.cloneNode(true);
      const a = [src, ...src.querySelectorAll('*')], b = [clone, ...clone.querySelectorAll('*')];
      const uses = new Map();   // "family|weight|style" -> characters drawn in it
      a.forEach((el, i) => {
        const c = b[i], tag = el.localName;
        if (tag === 'title' || tag === 'desc') { c.remove(); return; }
        const cs = getComputedStyle(el);
        const props = tag === 'text' || tag === 'tspan' || tag === 'svg' || tag === 'g' ? SHAPE_PROPS.concat(TEXT_PROPS) : SHAPE_PROPS;
        let style = props.map(p => { const v = cs.getPropertyValue(p); return v ? `${p}:${v}` : ''; }).filter(Boolean).join(';');
        if (cs.display === 'none') style += ';display:none';
        c.setAttribute('style', style);
        ['class', 'role', 'aria-labelledby', 'aria-hidden', 'id'].forEach(k => c.removeAttribute(k));
        if (tag === 'text') {
          const chars = (el.textContent || '').replace(/[\s\uFE0E\uFE0F]/g, '');
          const wt = String(parseInt(cs.fontWeight, 10) || 400), st = /italic|oblique/.test(cs.fontStyle) ? 'italic' : 'normal';
          families(cs.fontFamily).forEach(f => { const k = `${f}|${wt}|${st}`; uses.set(k, (uses.get(k) || '') + chars); });
        }
      });
      const vb = (clone.getAttribute('viewBox') || '0 0 640 640').split(/[\s,]+/).map(Number);
      const w = px || vb[2], h = w * vb[3] / vb[2];
      clone.setAttribute('width', String(Math.round(w)));
      clone.setAttribute('height', String(Math.round(h)));
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const fonts = await embedFonts(uses, opts);
      // WebKit skips a font for "sign + U+FE0E" when a later font in the list (Apple Symbols) handles that
      // sequence, so with Noto embedded the selector is dropped; without Noto it stays, to avoid emoji.
      if (/font-family:"Noto Sans Symbols"/.test(fonts.css)) {
        const tw = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
        for (let n = tw.nextNode(); n; n = tw.nextNode()) if (n.nodeValue.includes(VS15)) n.nodeValue = n.nodeValue.split(VS15).join('');
      }
      if (fonts.css) {
        const st = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        st.textContent = fonts.css;
        clone.insertBefore(st, clone.firstChild);
      }
      const svg = new XMLSerializer().serializeToString(clone);
      return { svg, aspect: vb[3] / vb[2], fonts: fonts.faces };
    } finally { if (host) host.remove(); }
  }

  function loadImage(svg) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
      const img = new Image();
      img.onload = () => {
        const done = () => { URL.revokeObjectURL(url); res(img); };
        // decode() and a short pause give the fonts inside the SVG time to apply before it is drawn
        // (a timer, not requestAnimationFrame, which never fires in a background tab)
        (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => setTimeout(done, 40));
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('wheel image did not load')); };
      img.src = url;
    });
  }

  // ---------- what goes on the image ----------
  function offsetText(min) {
    if (window.NatalPlace && NatalPlace.formatOffset) return NatalPlace.formatOffset(min);
    const s = min < 0 ? '−' : '+', a = Math.abs(min), h = Math.floor(a / 60), m = Math.round(a - h * 60);
    return `UTC${s}${h}:${String(m).padStart(2, '0')}`;
  }
  const tzLabel = z => String(z || '').replace(/_/g, ' ');

  function extract(cur, opts) {
    const { st, chart, t } = cur;
    const wall = new Date(t.utcMs + t.offsetMin * 6e4);
    const dateText = wall.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const abbr = t.abbr && !/^GMT/.test(t.abbr) ? ' ' + t.abbr : '';
    const when = st.timeKnown
      ? `${dateText} at ${wall.toLocaleTimeString('en-US', { timeZone: 'UTC', hour: 'numeric', minute: '2-digit' })}${abbr}`
      : `${dateText}, birth time unknown`;
    const p = st.place, custom = p.label === 'Custom location';
    const coords = `${Math.abs(p.lat).toFixed(2)}°${p.lat >= 0 ? 'N' : 'S'}, ${Math.abs(p.lon).toFixed(2)}°${p.lon >= 0 ? 'E' : 'W'}`;
    const where = custom ? `${(+p.lat).toFixed(4)}, ${(+p.lon).toFixed(4)}` : p.label;
    const iso = new Date(t.utcMs).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
    const detail = [coords];
    if (st.offsetMin == null) detail.push(tzLabel(p.tz));
    detail.push(st.timeKnown ? `${offsetText(t.offsetMin)} = ${iso}` : `drawn for 12:00 noon (${offsetText(t.offsetMin)})`);
    if (chart.angles) detail.push(`${chart.houseSystemUsed === 'equal' ? 'Equal' : 'Placidus'} houses`);

    const caption = window.NatalWheel && NatalWheel.caption ? NatalWheel.caption(chart) : [];

    // the four cards exactly as the page shows them (the 13-month birthday follows the page's own settings)
    const cards = [...document.querySelectorAll('#nbBig3 .b3')].map(el => {
      const g = el.querySelector('.v .glyph'), n = el.querySelector('.v span:not(.glyph)');
      const txt = s => (s ? s.textContent : '').replace(/\s+/g, ' ').trim();
      return { k: txt(el.querySelector('.k')), glyph: g ? g.textContent.trim() : '', name: txt(n), s: txt(el.querySelector('.s')), cal: el.classList.contains('cal13') };
    });
    if (!cards.length) {   // no cards on the page: Sun, Moon, Rising from the chart itself
      const by = k => chart.bodies.find(b => b.key === k);
      const card = (k, c, tr) => ({ k, glyph: c.zodiac ? tp(CON_GLYPH[c.abbr]) : '', name: c.name, s: `Astrology sign: ${TROP[tr.index]}`, cal: false });
      cards.push(card('Sun', by('sun').constellation, by('sun').tropical), card('Moon', by('moon').constellation, by('moon').tropical));
      if (chart.angles) cards.push(card('Rising (Ascendant)', chart.angles.asc.constellation, chart.angles.asc.tropical));
    }

    const ecl = (lon) => { try { return NatalAstro.constellationOfEcliptic(lon, t.utcMs).name; } catch (e) { return ''; } };
    const rows = chart.bodies.map(b => ({ glyph: tp(b.glyph), text: false, name: b.name, c: b.constellation, lon: b.lon, tr: b.tropical, house: b.house, retro: b.key !== 'node' && !!b.retro, angle: false }));
    if (chart.angles) {
      rows.push({ glyph: 'AC', text: true, name: 'Ascendant', c: chart.angles.asc.constellation, lon: chart.angles.asc.lon, tr: chart.angles.asc.tropical, house: chart.angles.asc.house, retro: false, angle: true });
      rows.push({ glyph: 'MC', text: true, name: 'Midheaven', c: chart.angles.mc.constellation, lon: chart.angles.mc.lon, tr: chart.angles.mc.tropical, house: chart.angles.mc.house, retro: false, angle: true });
    }
    rows.forEach(r => {
      r.conGlyph = r.c.zodiac ? tp(CON_GLYPH[r.c.abbr] || '') : '';
      r.off = r.c.zodiac ? '' : `just off the zodiac band; on the Sun’s path: ${ecl(r.lon)}`;
      r.signGlyph = tp(TROP_GLYPH[r.tr.index]);
      r.sign = TROP[r.tr.index];
      r.deg = dms(r.tr.deg);
    });
    const tableNote = chart.bodies.some(b => !b.constellation.zodiac)
      ? 'The Moon and planets travel close to the Sun’s path but not exactly on it, because their orbits are tilted a little, so now and then one sits just outside the 13 constellations. Its row names the constellation it was really in and, under it, the one of the 13 at the same point along the Sun’s path.'
      : '';
    return { example: !!cur.isExample, when, where, detail, caption, cards, rows, tableNote, footer: opts.footer };
  }

  // ---------- drawing helpers ----------
  function greedy(ctx, text, maxW) {
    const lines = [];
    let cur = '';
    String(text).split(/[ \t\n]+/).filter(Boolean).forEach(w => {
      const t = cur ? cur + ' ' + w : w;
      if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  // as few lines as greedy wrapping needs, but evened out so the last line is not a lone word
  function wrap(ctx, text, maxW) {
    const first = greedy(ctx, text, maxW);
    if (first.length < 2) return first;
    let lo = maxW * 0.5, hi = maxW;
    for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (greedy(ctx, text, mid).length > first.length) lo = mid; else hi = mid; }
    return greedy(ctx, text, hi);
  }
  // keep "Astrology sign: Sagittarius", "Next: Tue, Dec 1, 2026" and the like on one line
  const keep = s => String(s)
    .replace(/(\d{1,2}:\d{2}) ([AP]M)/g, '$1\u00A0$2')
    .replace(/Astrology sign: (\S+)/g, 'Astrology\u00A0sign:\u00A0$1')
    .replace(/\b(Month|Year|In|then|until|into|from) /g, '$1\u00A0')
    .replace(/Next: (.+)$/, (m, d) => 'Next:\u00A0' + d.replace(/ /g, '\u00A0'));
  // " · "-separated parts, wrapped between parts where possible
  function wrapParts(ctx, parts, maxW) {
    const lines = [];
    let cur = '';
    parts.forEach(p => {
      const t = cur ? cur + ' · ' + p : p;
      if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = p; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines.flatMap(l => ctx.measureText(l).width > maxW ? wrap(ctx, l, maxW) : [l]);
  }
  // letter-spaced capitals (canvas letterSpacing is not everywhere yet)
  function spacedWidth(ctx, s, sp) { let w = 0; for (const ch of s) w += ctx.measureText(ch).width + sp; return w - sp; }
  function drawSpaced(ctx, s, x, y, sp) { for (const ch of s) { ctx.fillText(ch, x, y); x += ctx.measureText(ch).width + sp; } }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // true when the page has a loaded Noto Sans Symbols face (then glyphs are drawn without U+FE0E, see wheelSvg)
  function notoLoaded() {
    let ok = false;
    try { document.fonts.forEach(f => { if (unq(f.family) === 'Noto Sans Symbols' && f.status === 'loaded') ok = true; }); } catch (e) {}
    return ok;
  }

  async function loadCanvasFonts(T, D) {
    const all = [D.when, D.where, D.detail.join(' '), D.caption.join(' '), D.footer, 'Birth chart Example chart Where everything was',
      D.cards.map(c => c.k + c.name + c.s).join(' '), D.rows.map(r => r.name + r.c.name + r.off + r.sign).join(' '), D.tableNote,
      'BODY REAL SKY ASTROLOGY SIGN HOUSE MOTION Retrograde Rx Outer ring Thin ring Square, opposition Trine, sextile Conjunction'].join(' ');
    const glyphs = D.cards.map(c => c.glyph).join('') + D.rows.map(r => (r.text ? '' : r.glyph) + r.conGlyph + r.signGlyph).join('');
    const nums = D.detail.join(' ') + D.rows.map(r => r.deg + r.house).join(' ') + 'ACMC0123456789';
    const specs = [[`400 20px ${T.fDisplay}`, all], [`400 12px ${T.fBody}`, all], [`500 12px ${T.fBody}`, all], [`600 12px ${T.fBody}`, all],
      [`400 12px ${T.fData}`, nums], [`500 12px ${T.fData}`, nums], [`400 12px ${T.fSym}`, glyphs || '☉']];
    if (document.fonts && document.fonts.load) {
      await Promise.all(specs.map(([f, s]) => withTimeout(document.fonts.load(f, s), 5000).catch(() => {})));
      await withTimeout(document.fonts.ready, 5000).catch(() => {});
    }
  }

  // ---------- render ----------
  async function render(cur, opts) {
    opts = { ...DEFAULTS, ...(opts || {}) };
    if (!cur || !cur.chart || !cur.st || !cur.t) throw new Error('no chart');
    const T = theme(), D = extract(cur, opts);
    const W = opts.width, S = opts.scale, PAD = 28, CW = W - 2 * PAD;
    const WHEEL = Math.min(W - 40, 560);
    const [wheel] = await Promise.all([
      wheelSvg(cur, opts, WHEEL * S).then(w => loadImage(w.svg).then(img => ({ img, aspect: w.aspect }))),
      loadCanvasFonts(T, D)
    ]);

    const plain = notoLoaded();
    const G = g => (plain ? String(g).split(VS15).join('') : g);
    D.cards.forEach(c => { c.glyph = G(c.glyph); });
    D.rows.forEach(r => { if (!r.text) r.glyph = G(r.glyph); r.conGlyph = G(r.conGlyph); r.signGlyph = G(r.signGlyph); });
    const F = {
      eyebrow: `500 10.5px ${T.fBody}`, title: `400 38px ${T.fDisplay}`, when: `500 15px ${T.fBody}`, where: `400 14px ${T.fBody}`,
      detail: `400 11px ${T.fData}`, cap: `400 12px ${T.fBody}`, legend: `400 11px ${T.fBody}`,
      k: `500 9.5px ${T.fBody}`, v: px => `400 ${px}px ${T.fDisplay}`, vg: px => `400 ${px}px ${T.fSym}`, s: `400 11.5px ${T.fBody}`,
      h3: `400 21px ${T.fDisplay}`, th: `500 9px ${T.fBody}`, td: `400 12.5px ${T.fBody}`, tg: `400 13px ${T.fSym}`, tAng: `500 10px ${T.fData}`,
      deg: `400 10.5px ${T.fData}`, off: `400 10.5px ${T.fBody}`, pill: `500 9.5px ${T.fBody}`, note: `400 11px ${T.fBody}`, foot: `400 11px ${T.fBody}`
    };
    const m = document.createElement('canvas').getContext('2d');
    const width = (s, font) => { m.font = font; return m.measureText(s).width; };
    const ops = [];
    const text = (s, x, y, font, color, align) => ops.push(c => { c.font = font; c.fillStyle = color; c.textAlign = align || 'left'; c.fillText(s, x, y); });
    let y = PAD;

    // title block
    if (D.example) {
      const yy = y + 10;
      ops.push(c => { c.font = F.eyebrow; c.fillStyle = T.accent; c.textAlign = 'left'; drawSpaced(c, 'EXAMPLE CHART', PAD, yy, 1.3); });
      y += 18;
    }
    text('Birth chart', PAD, y + 32, F.title, T.ink);
    y += 48;
    m.font = F.when;
    wrap(m, D.when, CW).forEach(l => { y += 20; text(l, PAD, y, F.when, T.ink); });
    m.font = F.where;
    wrap(m, D.where, CW).forEach(l => { y += 19; text(l, PAD, y, F.where, T.ink); });
    m.font = F.detail;
    y += 4;
    wrapParts(m, D.detail, CW).forEach(l => { y += 16; text(l, PAD, y, F.detail, T.muted); });

    // wheel
    y += 18;
    const wx = (W - WHEEL) / 2, wy = y, wh = WHEEL * wheel.aspect;
    ops.push(c => c.drawImage(wheel.img, wx, wy, WHEEL, wh));
    y += wh;

    // caption under the wheel (no birth time, polar houses)
    if (D.caption.length) {
      y += 6;
      m.font = F.cap;
      D.caption.forEach(t => wrap(m, t, CW - 20).forEach(l => { y += 17; text(l, W / 2, y, F.cap, T.muted, 'center'); }));
    }
    // legend
    y += 14;
    const legend = [
      { sw: T.skyB, label: 'Outer ring: the 13 real constellations' },
      { sw: T.bg, border: T.muted, label: 'Thin ring: the 12 astrology signs' },
      { sw: T.aspHard, label: 'Square, opposition' }, { sw: T.aspSoft, label: 'Trine, sextile' }, { sw: T.accent, label: 'Conjunction' }
    ].map(it => ({ ...it, w: 16 + width(it.label, F.legend) }));
    const lrows = [[]];
    let lw = 0;
    legend.forEach(it => {
      const add = (lrows[lrows.length - 1].length ? 16 : 0) + it.w;
      if (lrows[lrows.length - 1].length && lw + add > CW) { lrows.push([it]); lw = it.w; } else { lrows[lrows.length - 1].push(it); lw += add; }
    });
    lrows.forEach(row => {
      y += 18;
      const total = row.reduce((s, it, i) => s + it.w + (i ? 16 : 0), 0);
      let x = (W - total) / 2;
      const yy = y;
      row.forEach(it => {
        const x0 = x;
        ops.push(c => {
          c.fillStyle = it.sw; roundRect(c, x0, yy - 9, 10, 10, 2); c.fill();
          if (it.border) { c.strokeStyle = it.border; c.lineWidth = 1; roundRect(c, x0 + 0.5, yy - 8.5, 9, 9, 2); c.stroke(); }
          c.font = F.legend; c.fillStyle = T.muted; c.textAlign = 'left'; c.fillText(it.label, x0 + 16, yy);
        });
        x += it.w + 16;
      });
    });

    // Sun, Moon, Rising, 13-month birthday
    y += 22;
    const GAP = 10, cw = (CW - GAP) / 2, inner = cw - 28;
    for (let i = 0; i < D.cards.length; i += 2) {
      const pair = D.cards.slice(i, i + 2).map(cd => {
        let vs = 23;
        const vw = () => (cd.glyph ? width(cd.glyph, F.vg(vs * 0.8)) + 5 : 0) + width(cd.name, F.v(vs));
        while (vs > 15 && vw() > inner) vs -= 1;
        m.font = F.s;
        const lines = cd.s ? wrap(m, keep(cd.s), inner) : [];
        return { cd, vs, lines, h: 14 + 10 + 8 + vs + 6 + lines.length * 15.5 + 10 };
      });
      const h = Math.max(...pair.map(p => p.h));
      pair.forEach((p, j) => {
        const x = PAD + j * (cw + GAP), top = y;
        ops.push(c => {
          roundRect(c, x + 0.5, top + 0.5, cw - 1, h - 1, 8);
          if (p.cd.cal) { c.fillStyle = T.accentSoft; c.fill(); } else { c.fillStyle = T.surface; c.fill(); c.strokeStyle = T.line; c.lineWidth = 1; c.stroke(); }
          c.font = F.k; c.fillStyle = T.muted; c.textAlign = 'left';
          drawSpaced(c, p.cd.k.toUpperCase(), x + 14, top + 22, 1.1);
          let gx = x + 14;
          const by = top + 22 + 8 + p.vs * 0.9;
          if (p.cd.glyph) { c.font = F.vg(p.vs * 0.8); c.fillStyle = T.accent; c.fillText(p.cd.glyph, gx, by); gx += c.measureText(p.cd.glyph).width + 5; }
          c.font = F.v(p.vs); c.fillStyle = T.ink; c.fillText(p.cd.name, gx, by);
          c.font = F.s; c.fillStyle = T.muted;
          p.lines.forEach((l, k) => c.fillText(l, x + 14, by + 6 + 12 + k * 15.5));
        });
      });
      y += h + GAP;
    }

    // positions table
    y += 14;
    text('Where everything was', PAD, y + 18, F.h3, T.ink);
    y += 32;
    const head = ['BODY', 'REAL SKY', 'ASTROLOGY SIGN', 'HOUSE', 'MOTION'];
    const GL = 18;   // glyph slot
    const nat = [
      Math.max(...D.rows.map(r => GL + width(r.name, F.td))),
      Math.max(...D.rows.map(r => GL + width(r.c.name, F.td))),
      Math.max(...D.rows.map(r => GL + width(r.sign + ' ', F.td) + width(r.deg, F.deg))),
      width('HOUSE', F.th) + 4,
      0
    ];
    m.font = F.th;
    nat.forEach((v, i) => { nat[i] = Math.max(v, spacedWidth(m, head[i], 1) + 2); });
    let rxLabel = 'Retrograde';
    nat[4] = Math.max(spacedWidth(m, 'MOTION', 1), width(rxLabel, F.pill) + 16);
    const CGAP = 10;
    const total = () => nat.reduce((s, v) => s + v, 0) + CGAP * 4;
    if (total() > CW) { rxLabel = 'Rx'; nat[4] = Math.max(spacedWidth(m, 'MOTION', 1), width('Rx', F.pill) + 16); }
    if (total() < CW) nat[1] += CW - total();   // spare room goes to the real-sky column (it holds the notes)
    const cx = [PAD];
    for (let i = 1; i < 5; i++) cx.push(cx[i - 1] + nat[i - 1] + CGAP);
    {
      const yy = y + 12;
      ops.push(c => {
        c.font = F.th; c.fillStyle = T.muted; c.textAlign = 'left';
        head.forEach((h, i) => drawSpaced(c, h, cx[i], yy, 1));
        c.fillStyle = T.line; c.fillRect(PAD, yy + 7, CW, 1);
      });
      y += 20;
    }
    D.rows.forEach(r => {
      m.font = F.off;
      const offLines = r.off ? wrap(m, r.off, nat[1] - GL) : [];
      const h = 26 + offLines.length * 13.5;
      const top = y, base = top + 17;
      ops.push(c => {
        if (r.angle) { c.fillStyle = T.surface; c.fillRect(PAD, top, CW, h); }
        c.textAlign = 'left';
        // body
        if (r.text) { c.font = F.tAng; c.fillStyle = T.accent; c.fillText(r.glyph, cx[0], base); }
        else { c.font = F.tg; c.fillStyle = T.accent; c.fillText(r.glyph, cx[0] + (14 - c.measureText(r.glyph).width) / 2, base); }
        c.font = F.td; c.fillStyle = T.ink; c.fillText(r.name, cx[0] + GL, base);
        // real sky
        if (r.conGlyph) { c.font = F.tg; c.fillStyle = T.sky; c.fillText(r.conGlyph, cx[1] + (14 - c.measureText(r.conGlyph).width) / 2, base); }
        c.font = F.td; c.fillStyle = T.ink; c.fillText(r.c.name, cx[1] + GL, base);
        c.font = F.off; c.fillStyle = T.muted;
        offLines.forEach((l, k) => c.fillText(l, cx[1] + GL, base + 14 + k * 13.5));
        // astrology sign
        c.font = F.tg; c.fillStyle = T.sky; c.fillText(r.signGlyph, cx[2] + (14 - c.measureText(r.signGlyph).width) / 2, base);
        c.font = F.td; c.fillStyle = T.ink; c.fillText(r.sign + ' ', cx[2] + GL, base);
        const sx = cx[2] + GL + c.measureText(r.sign + ' ').width;
        c.font = F.deg; c.fillStyle = T.muted; c.fillText(r.deg, sx, base);
        // house
        c.font = F.td; c.fillStyle = T.ink; c.fillText(r.house ? String(r.house) : '–', cx[3], base);
        // motion
        if (r.retro) {
          c.font = F.pill;
          const pw = c.measureText(rxLabel).width + 14;
          roundRect(c, cx[4] + 0.5, base - 11.5, pw, 16, 8);
          c.strokeStyle = T.accent; c.lineWidth = 1; c.stroke();
          c.fillStyle = T.accent; c.fillText(rxLabel, cx[4] + 7.5, base);
        }
        c.fillStyle = T.line; c.fillRect(PAD, top + h - 1, CW, 1);
      });
      y += h;
    });
    if (D.tableNote) {
      m.font = F.note;
      y += 4;
      wrap(m, D.tableNote, CW).forEach(l => { y += 15; text(l, PAD, y, F.note, T.muted); });
    }

    // footer
    y += 26;
    const fy = y;
    ops.push(c => { c.fillStyle = T.line; c.fillRect(PAD, fy, CW, 1); });
    y += 22;
    text(D.footer, W / 2, y, F.foot, T.muted, 'center');
    y += PAD - 6;

    const H = Math.ceil(y);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * S); canvas.height = Math.round(H * S);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'alphabetic';
    ops.forEach(f => { ctx.save(); f(ctx); ctx.restore(); });
    return canvas;
  }

  function fileName(cur) {
    const d = cur && cur.st && /^\d{4}-\d{2}-\d{2}$/.test(cur.st.date) ? cur.st.date : 'chart';
    return `birth-chart-${d}.png`;
  }

  function toBlob(canvas) {
    return new Promise((res, rej) => {
      try { canvas.toBlob(b => (b ? res(b) : rej(new Error('empty image'))), 'image/png'); } catch (e) { rej(e); }
    });
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // ---------- the button ----------
  function attach(cfg) {
    cfg = cfg || {};
    const box = typeof cfg.container === 'string' ? q(cfg.container) : cfg.container;
    if (!box) return null;
    const getCurrent = cfg.getCurrent || (() => (window.NatalUI ? window.NatalUI.current : null));
    const opts = { ...DEFAULTS };
    ['width', 'scale', 'footer', 'fontUrls', 'wheelFontScale'].forEach(k => { if (cfg[k] != null) opts[k] = cfg[k]; });
    const LABEL = 'Save chart as image';

    const wrapEl = document.createElement('div');
    wrapEl.className = 'nb-save';
    wrapEl.style.cssText = 'display:grid;gap:6px;justify-items:center';
    wrapEl.innerHTML = `<button type="button" class="btn" id="nbSaveImg">${LABEL}</button><p class="hint" id="nbSaveMsg" role="status" aria-live="polite" hidden></p>`;
    box.insertAdjacentElement(cfg.position || 'beforeend', wrapEl);
    const btn = wrapEl.querySelector('button'), msg = wrapEl.querySelector('p');
    const say = s => { msg.textContent = s || ''; msg.hidden = !s; };
    let busy = false, ready = null;   // ready: an image already made, waiting for a second tap to share

    const touch = () => !!(window.matchMedia && matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints || 0) > 0;
    const bgNow = () => getComputedStyle(document.documentElement).getPropertyValue('--bg');
    const reset = () => { ready = null; btn.textContent = LABEL; };
    const wheel = q('#nbWheel');
    if (wheel && window.MutationObserver) new MutationObserver(() => { if (!busy) { reset(); say(''); } }).observe(wheel, { childList: true });

    async function deliver(p) {
      let file = null;
      try { file = new File([p.blob], p.name, { type: 'image/png' }); } catch (e) { /* very old browser: download */ }
      if (file && touch() && navigator.canShare && navigator.share) {
        let ok = false;
        try { ok = navigator.canShare({ files: [file] }); } catch (e) {}
        if (ok) {
          try {
            await navigator.share({ files: [file], title: 'Birth chart' });
            reset(); say('');
            if (cfg.onSaved) try { cfg.onSaved('share'); } catch (e) {}
            return;
          } catch (e) {
            if (e && e.name === 'AbortError') { ready = p; say(''); return; }   // closed the share sheet; the next tap reopens it at once
            if (e && e.name === 'NotAllowedError') {                 // making the image took too long after the tap
              ready = p; btn.textContent = 'Save image';
              say('The image is ready. Tap “Save image” to save or share it.');
              return;
            }
            // any other share failure: download instead
          }
        }
      }
      download(p.blob, p.name);
      reset(); say('');
      if (cfg.onSaved) try { cfg.onSaved('download'); } catch (e) {}
    }

    btn.addEventListener('click', async () => {
      if (busy) return;
      const cur = getCurrent();
      if (!cur || !cur.chart) { say('Draw a chart first.'); return; }
      if (ready && ready.cur === cur && ready.bg === bgNow()) { await deliver(ready); return; }
      busy = true; btn.disabled = true; btn.setAttribute('aria-busy', 'true');
      say('Making the image…');
      try {
        const canvas = await render(cur, opts);
        const blob = await toBlob(canvas);
        say('');
        await deliver({ blob, name: fileName(cur), cur, bg: bgNow() });
      } catch (e) {
        reset();
        say('Sorry, this browser could not make the image.');
        if (window.console) console.error('ChartImage:', e);
      } finally {
        busy = false; btn.disabled = false; btn.removeAttribute('aria-busy');
      }
    });
    return { button: btn, status: msg };
  }

  window.ChartImage = {
    attach, render, fileName, toBlob, version: '1.0.0',
    wheelSvg: (cur, opts) => { const o = { ...DEFAULTS, ...(opts || {}) }; return wheelSvg(cur, o, Math.min(o.width - 40, 560) * o.scale).then(w => w.svg); }
  };
})();
