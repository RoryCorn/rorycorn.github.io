/* Gematria Desk, public edition: the page. Everything is worked out here, on the visitor's device, with the
 * engine (engine.js) and the fixed data (data.js). Nothing typed is sent or saved. Today is the device's own
 * date (or, in follow-along mode, ?film, the explainer film's day: see pageToday). The five sections behind the free sign-in are drawn only once they can be seen. The page never lists coming
 * days that "line up" (the private desk's forecasts come from such lists), and every coincidence carries a chance line. */
(function () {
  'use strict';
  var E = window.GemEngine && window.GEM_DATA ? window.GemEngine.load(window.GEM_DATA) : null;
  if (!E) return;
  var D = window.GEM_DATA;

  // ------------------------------------------------------------------------------------------ helpers --
  function $(id) { return document.getElementById(id); }
  function h(tag, attrs) {
    var el = document.createElement(tag), i, k;
    if (attrs) for (k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k) || attrs[k] === null || attrs[k] === undefined || attrs[k] === false) continue;
      if (k === 'class') el.className = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else el.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    for (i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
  function fill(el, content) { while (el.firstChild) el.removeChild(el.firstChild); add(el, content); }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
    'November', 'December'];
  function longDate(iso) {
    var p = E.parse(iso);
    return E.WEEKDAYS[E.weekday(iso)] + ', ' + MONTHS[p[1] - 1] + ' ' + p[2] + ', ' + (p[0] < 1000 ? 'year ' + p[0] : p[0]);
  }
  function deviceToday() { var d = new Date(); return E.iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
  // Every "today" on the page is TODAY, and pageToday() is the one switch it comes from: the device's own date, or, in
  // follow-along mode (the address has ?film), the explainer film's pinned day, with each box set as the film sets it.
  // The mode lives only in the address: nothing is stored or sent. Only the film's day is offered, and it is past.
  var FILM_DAY = '2026-11-01';   // the film's clock: Sunday 2026-11-01 12:00 America/New_York
  var FILM_BOXES = { dateIn: '1986-11-01', spanA: '1986-11-01', numIn: '13', connA: 'Coinage Act', connAd: '1792-04-02',
    connB: 'Executive Order 6102', connBd: '1933-04-05' };
  var FILM_SIGNIN = 'Signing in brings you back to this page on today’s date, not the film’s: when you are back, tap “Follow along” near the top again.';
  function filmInAddress() { try { return new URLSearchParams(location.search).has('film'); } catch (e) { return false; } }
  var FILM = filmInAddress();
  function pageToday() { return FILM ? FILM_DAY : deviceToday(); }
  var TODAY = pageToday();
  // the display name of a cipher (the "Satanic" cipher shows under a plain description of its rule)
  function cname(code) { return code === 'SAT' ? 'Ordinal + 35 (decoders call it Satanic)' : E.NAMES[code]; }
  function debounce(f, ms) { var t = 0; return function () { clearTimeout(t); t = setTimeout(f, ms || 150); }; }
  function idle(f) { (window.requestIdleCallback || function (g) { return setTimeout(g, 30); })(f); }
  function validDate(v) { return typeof v === 'string' && E.isDate(v); }

  // a chance line: every coincidence on the page carries one (class "chance"; its box has data-coincidence)
  function chance(content) { return h('p', { class: 'chance' }, content); }
  function luckLine(word, todayIso, lead) {
    var r = E.dayHitRate(word, todayIso);
    return chance([(lead || 'Luck check') + ': “' + word + '” matches ', h('b', { text: E.pct(r.share) }),
      ' of days (' + fmt(r.hits) + ' of the ' + fmt(r.days) + ' days around today), so a match on any one day is ' +
      E.strengthWord(r.share) + '.']);
  }
  // the four core cipher codes, as "Known for" writes them ('Bible' (RFR))
  function codeKey() {
    return h('p', { class: 'note codes' }, 'Cipher codes in “Known for”: ' + E.CORE.map(function (c) { return c + ' ' + E.NAMES[c]; }).join(', ') + '.');
  }
  // letters the ciphers leave out (é, ñ, ß, 字 ...) are named under the result, never dropped without a word
  var LETTER = (function () { try { return new RegExp('\\p{L}', 'u'); } catch (e) { return /[A-Za-z\u00c0-\u024f\u0370-\u03ff\u0400-\u04ff\u0590-\u05ff]/; } })();
  function uncountedNote(text, scriptsToo) {
    var out = [], hint = '';
    Array.from(String(text)).forEach(function (c) {
      if (!LETTER.test(c) || E.letters(c).length) return;
      if (scriptsToo && (E.scriptLetters(c, 'HEB').length || E.scriptLetters(c, 'GRK').length)) return;
      if (out.indexOf(c) < 0) out.push(c);
      var base = c.normalize ? c.normalize('NFD').charAt(0) : '';
      if (!hint && base !== c && E.letters(base).length) hint = ' Type a letter without its accent (' + base.toLowerCase() + ' for ' + c + ') to count it.';
    });
    if (!out.length) return null;
    var shown = out.slice(0, 8).join(', ') + (out.length > 8 ? ' and ' + (out.length - 8) + ' more' : '');
    return h('p', { class: 'note uncounted' }, h('b', { text: 'Not counted: ' }), shown + '. These ciphers count only the 26 letters A to Z' +
      (scriptsToo ? ', plus Hebrew and Greek letters' : '') + '.' + hint);
  }

  // ------------------------------------------------------- workings (added 2026-11-16: what the film shows) --
  function note(content) { return h('p', { class: 'note' }, content); }
  function mdy(iso) { var p = E.parse(iso); return MONTHS[p[1] - 1] + ' ' + p[2] + ', ' + p[0]; }
  function andList(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function nWord(n, one) { return fmt(n) + ' ' + one + (n === 1 ? '' : 's'); }
  // each Hebrew letter in its own <bdi>, so "ח8 + י10 = 18" reads left to right (the text itself is unchanged)
  function bidi(s) {
    var out = [], run = '';
    Array.from(String(s)).forEach(function (c) {
      if (/[֐-׿]/.test(c)) { if (run) out.push(run); run = ''; out.push(h('bdi', { text: c })); } else run += c;
    });
    if (run) out.push(run);
    return out;
  }
  // a 10 x 10 tally with k squares filled, in count order: never by date (the page lists no coming days)
  function grid100(k, caption) {
    var g = h('div', { class: 'g100', 'aria-hidden': 'true' });
    for (var i = 0; i < 100; i++) g.appendChild(h('i', i < k ? { class: 'on' } : null));
    return h('div', { class: 'tally' }, g, h('p', { class: 'note', text: caption }));
  }
  // "One digit: M13 → 1 + 3 = 4 · ..." for FR, SR (from A) and RFR, RSR (back from Z); null when no letter has two digits
  function steps(text, code) {
    var s = E.reductionSteps(text, code);
    return s.length ? (code === 'FR' || code === 'SR' ? 'One digit: ' : 'One digit, counting back from Z: ') + s.map(function (x) {
      var prev = x[1];
      return x[0] + x[1] + x[2].map(function (n) { var t = ' → ' + String(prev).split('').join(' + ') + ' = ' + n; prev = n; return t; }).join('');
    }).join(' · ') : null;
  }
  // the reading under a luck line: 1 day in N (or k of the n look-alike pairs) and its band; with opts.window the
  // 1,460 days' dates, the undated tally and the link to "How to read a luck check"
  function luckWork(r, opts) {
    opts = opts || {};
    var n = E.oneIn(r.hits, r.days), odd = E.FAMILIAR_ODDS[n], t = E.oneInText(r.hits, r.days), w, k, out;
    out = [h('p', null, (opts.pair ? 'That is ' + fmt(r.hits) + ' of the ' + fmt(r.days) + '.' : !r.hits ? 'That is none of the ' + fmt(r.days) + ' days.' :
      'That is ' + (n === 1 ? 'nearly every day' : 'about 1 day in ' + t) + ' (' + fmt(r.days) + ' ÷ ' + fmt(r.hits) + ' ≈ ' + t + ')' +
      (odd ? ', like ' + odd : '') + '.') + ' ' + E.strengthBand(r.share, opts.pair ? 'pair' : 'day').text)];
    if (opts.window) {
      w = E.windowOf(TODAY);
      k = Math.round(r.share * 100);
      out.push(h('p', null, 'The ' + fmt(w.days) + ' days around today run from ' + longDate(w.start) + ' to ' + longDate(w.end) + ': the ' +
        w.before + ' days before today, today, and the ' + w.after + ' after (4 × 365 = 1,460).'),
        grid100(k, k ? k + ' of every 100 days' : r.hits ? 'fewer than 1 in every 100 days' : 'none of the days'),
        h('p', null, h('a', { href: '#luckscale', text: 'How to read a luck check' })));
    }
    return h('div', { class: 'luckwork' }, out);
  }
  // a closed row whose body is drawn the first time it opens (key: stays open when its box is drawn again)
  var openRows = {};
  function lazyRow(title, draw, key) {
    var body = h('div', { class: 'body' }), d = h('details', { class: 'drow' }, h('summary', null, h('span', { class: 'name', text: title })), body);
    function go() { if (!body.firstChild) add(body, draw()); }
    d.addEventListener('toggle', function () { if (key) openRows[key] = d.open; if (d.open) go(); });
    if (key && openRows[key]) { d.open = true; go(); }
    return d;
  }

  // the numbers of a date as a table (stacked rows on a phone); known: add "Known for"; same: mark these numbers
  function numTable(rows, opts) {
    opts = opts || {};
    var head = h('tr', null, h('th', { scope: 'col', text: 'Way of adding' }), h('th', { scope: 'col', text: 'Number' }),
      h('th', { scope: 'col', text: 'The sum' }), opts.known ? h('th', { scope: 'col', text: 'Known for' }) : null);
    var body = h('tbody');
    rows.forEach(function (r) {
      var same = opts.same && opts.same.has(r[1]);
      body.appendChild(h('tr', null,
        h('th', { scope: 'row' }, r[0].replace(/^13-month /, ''), same ? h('span', { class: 'same', text: 'same' }) : null),
        h('td', { class: 'n', text: String(r[1]) }),
        h('td', { class: 'how', text: r[2] }),
        opts.known ? h('td', { class: 'kf', 'data-history': '', text: E.short(r[1]) }) : null));
    });
    var table = h('table', { class: 'nums' }, opts.caption ? h('caption', { text: opts.caption }) : null, h('thead', null, head), body);
    return opts.names === false ? table : colNames(table);
  }
  // (added 2026-11-18) on a phone a number table stacks and its heading row is hidden, so each cell carries its column's
  // name from that heading (site.css shows it before "The sum" and "Known for"): the same words a computer shows on top.
  // Time between two dates keeps its stacked rows as they were (names: false): each row's own name says what it counts
  function colNames(table) {
    var names = [].map.call(table.querySelectorAll('thead th'), function (th) { return th.textContent; });
    [].forEach.call(table.querySelectorAll('tbody tr'), function (tr) {
      [].forEach.call(tr.children, function (c, i) { if (names[i]) c.setAttribute('data-label', names[i]); });
    });
    return table;
  }

  // the "Known for" key-word footnote: how often the public key words match a day at all
  var kwCache = {};
  function keywordChance(todayIso) {
    var c = kwCache[todayIso];
    if (!c) {
      var shares = E.publicWords().map(function (w) { return E.dayHitRate(w, todayIso).share; });
      var min = Math.min.apply(null, shares), max = Math.max.apply(null, shares);
      var avg = shares.reduce(function (s, x) { return s + x; }, 0) / shares.length;
      c = kwCache[todayIso] = { min: min, max: max, avg: avg, n: shares.length };
    }
    return chance(['Every word matches some days. These ' + c.n + ' key words match ', h('b', { text: E.pct(c.min) + '–' + E.pct(c.max) }),
      ' of days each (average ' + E.pct(c.avg) + '), so a key-word match on any one day is ' + E.strengthWord(c.avg) + '.']);
  }

  // the Known-for box's working-out: the year's three digit rows, the elements, then (opened) where it all comes from
  function yearKey(iso) {
    var Y = E.parse(iso)[0], yy = Y % 100, y2 = (yy < 10 ? '0' : '') + yy;
    return note('Last 2 is the year’s last two digits as one number (' + yy + '); Last 2 digits adds those two digits (' +
      y2.split('').join(' + ') + '); Year digits adds every digit of the year (' + String(Y).split('').join(' + ') + ').');
  }
  function elementLines(rows, whose) {
    var k = rows.filter(function (r) { return r[1] >= 1 && r[1] <= 118; }).length;
    return [note('Atomic number: each chemical element’s number (gold is 79).'),
      chance(['Every whole number from 1 to 118 is some element’s atomic number, so ' + k + ' of ' + whose + ' ' + rows.length + ' numbers (',
        h('b', { text: E.pct(k / rows.length) }), ') ' + (k === 1 ? 'shows' : 'show') + ' an element: that is certain, not a sign.'])];
  }
  function knownWorked(rows) {
    return lazyRow('Known for, worked out', function () {
      var recs = [], kws = [], seen = {};
      rows.forEach(function (r) {
        var n = r[1], m;
        if (seen[n]) return;
        seen[n] = 1;
        m = E.meaning(n);
        m.records.slice(0, 2).forEach(function (x) { recs.push(h('li', { 'data-history': '' }, n + ': ' + x[1] + ' (source: ', recordSource(n, x[1], x[2]), ')')); });
        m.phrases.slice(0, 3).forEach(function (x) {
          var s = steps(x[0], x[1]);
          kws.push(h('li', null, '“' + x[0] + '” in ' + cname(x[1]) + ': ', h('span', { class: 'mono', text: E.explain(x[0], x[1]) +
            (s ? ' (' + s.charAt(0).toLowerCase() + s.slice(1) + ')' : '') })));
        });
      });
      return [h('p', { text: 'Where these records come from:' }), recs.length ? h('ul', { class: 'plain' }, recs) : note('None of these numbers has a sourced record.'),
        h('p', { text: 'How these key words add up:' }), kws.length ? h('ul', { class: 'plain' }, kws) : note('No key word adds up to any of these numbers.'),
        h('p', { text: 'The ' + E.publicWords().length + ' key words, always the same: ' + E.publicWords().join(', ') + '.' })];
    });
  }
  // the 13-month year as 13 rows of 28 squares (and its Year Day), the day's month and square lit
  function grid13(t) {
    var g = h('div', { class: 'grid13', role: 'img', 'aria-label': t.month ? t.name + ' ' + t.day + ': month ' + t.month + ' of 13, day ' + t.day + ' of 28' :
      t.name + ': day ' + t.dayOfYear + ' of ' + t.length + ', after month 13' });
    for (var i = 0; i < t.length; i++) {
      g.appendChild(h('i', { class: i === t.dayOfYear - 1 ? 'on' : t.month && Math.floor(i / 28) === t.month - 1 ? 'm' : i >= 364 ? 'yd' : null }));
    }
    return h('div', { class: 'g13' }, g, note('Each row is one month of 28 days; the last ' + (t.length > 365 ? 'two squares are the Year Days.' : 'square is the Year Day.')));
  }

  // The date card's calendar link opens that month on the 13-Month Sky Calendar (the calendar's own month parts #m1 to
  // #m13, and #m14 for the Year Day part; added 2026-11-16) when the date is in the 13-month year the calendar opens on:
  // the year of today's date in New York, as the calendar counts it (the real date, also while following the film).
  // Any other date keeps the plain link. The link carries only a month number, never a date.
  var CAL = 'https://rorycorn.github.io/sky-calendar/eastern/';
  function calNow() {
    try {
      var p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date());
      var g = function (k) { return +p.filter(function (x) { return x.type === k; })[0].value; };
      return E.iso(g('year'), g('month'), g('day'));
    } catch (e) { return deviceToday(); }
  }
  function calHref(t) { var now = t && E.thirteenFromDate(calNow()); return now && now.year === t.year ? CAL + '#m' + (t.month || 14) : CAL; }
  function dateCard(iso, opts) {
    var heb = E.hebrewLabel(iso), t = E.thirteenFromDate(iso), hd = E.hebrewFromDate(iso);
    return h('div', { class: 'datecard' },
      h('p', { class: 'big', text: longDate(iso) }),
      opts && opts.today ? h('span', FILM ? { class: 'sub own film', text: 'This is the film’s day, not your device’s date (' + longDate(deviceToday()) + ').' } :
        { class: 'sub own', text: 'This is your device’s own date, so each visitor sees their own day.' }) : null,
      h('dl', null,
        h('dt', { text: 'Hebrew' }), h('dd', null, heb, h('span', { class: 'sub', text: 'A Hebrew day begins at sunset the evening before.' }),
          h('span', { class: 'sub', text: 'The Hebrew calendar is the Jewish calendar, with its own days, months and years: ' + hd[3] + ' is month ' +
            hd[1] + ' (counting from Nisan) of year ' + hd[0] + '.' })),
        h('dt', { text: '13 months' }), h('dd', null, t ? t.label : 'outside 1900–2052',
          h('span', { class: 'sub' }, t ? t.where + ' · ' : '',
            h('a', { href: calHref(t), text: '13-Month Sky Calendar, Eastern Time' })),
          t ? h('span', { class: 'sub', text: '13 months of 28 days (13 × 28 = 364), then ' + (t.length > 365 ? '2 Year Days: 366' : '1 Year Day: 365') +
            ' days in this 13-month year.' }) : null,
          t && t.month ? h('span', { class: 'sub', text: 'Month names follow the order of the 13 constellations, so the Sun isn’t always in the month’s namesake.' }) : null)),
      t ? grid13(t) : null);
  }

  // ------------------------------------------------------------------------------------- Today (open) --
  function renderToday() {
    var out = $('todayOut');
    if (!out) return;
    var rows = E.dateNumbers(TODAY);
    var box = h('div', { 'data-coincidence': 'known-for' },
      numTable(rows, { known: true, caption: 'Today’s ten numbers' }), codeKey(), yearKey(TODAY), keywordChance(TODAY),
      elementLines(rows, 'today’s'), knownWorked(rows));
    fill(out, [dateCard(TODAY, { today: true }), box]);
  }

  // ---------------------------------------------------------------------------------- Try a word (open) --
  // dateIso (Any date's word box): the same box for a chosen date, today or earlier; the luck check stays the word's
  // usual one, around today
  function matchesBox(word, todayIso, title, dateIso) {
    var on = dateIso || todayIso, whose = dateIso ? 'this date’s' : 'today’s';
    var hits = E.dateHits(word, on);
    var list = hits.length ? h('ul', null, hits.map(function (x) {
      return h('li', null, h('span', { class: 'hitn', text: String(x[1]) }), ' in ' + cname(x[3]) + ' = ' + whose + ' ' +
        x[0] + ' (' + x[2] + ')');
    })) : h('p', { text: 'None of ' + whose + ' numbers equals these four values.' });
    var rows = E.dateNumbers(on), nc = E.CORE.length, nd = rows.length, np = nc * nd, k = hits.length;
    return h('div', { class: 'matches', 'data-coincidence': dateIso ? 'matches-date' : 'matches-today' }, h('h4', { text: title || 'Matches today' }), list,
      h('p', null, '“' + word + '” gives ' + nc + ' numbers and ' + (dateIso ? 'this date' : 'today') + ' gives ' + nd + ', so ' + nc + ' × ' + nd + ' = ' + np + ' pairs are compared; ' +
        (k ? k : 'none') + ' of the ' + np + (k === 1 ? ' matches' : ' match') + '. Decoders (people who look for meaning in these numbers) would ' +
        'welcome a match in any of the ' + np + ', so the luck check below counts every day on which at least one pair matches.'),
      lazyRow('See all ' + np + ' pairs', function () { return pairGrid(word, rows, !!dateIso); }, dateIso ? 'pairs:date' : 'pairs:' + (title || '')),
      luckLine(word, todayIso), luckWork(E.dayHitRate(word, todayIso), { window: true }));
  }
  // the 40 pairs: today's ten numbers (rows) against the word's four values (columns), "=" where they match
  function pairGrid(word, rows, chosen) {
    var v = E.values(word);
    return [note('Rows: ' + (chosen ? 'this date’s ' : 'today’s ') + rows.length + ' numbers. Columns: “' + word + '” in the four core ciphers (' +
      E.CORE.map(function (c) { return c + ' ' + E.NAMES[c]; }).join(', ') + '). “=” marks a pair that matches.'),
      h('table', { class: 'pairgrid' },
        h('thead', null, h('tr', null, h('th', { scope: 'col', text: chosen ? 'This date' : 'Today' }), E.CORE.map(function (c) { return h('th', { scope: 'col' }, c, h('span', { text: String(v[c]) })); }))),
        h('tbody', null, rows.map(function (r) {
          return h('tr', null, h('th', { scope: 'row' }, h('b', { text: String(r[1]) }), h('span', { text: r[0] })),
            E.CORE.map(function (c) { return v[c] === r[1] ? h('td', { class: 'eq', text: '=' }) : h('td', { text: '·' }); }));
        })))];
  }
  function renderTry() {
    var inp = $('tryWord'), out = $('tryOut');
    if (!inp || !out) return;
    var word = inp.value, ex = inp.value === inp.defaultValue;
    var vals = E.values(word);
    if (!Object.keys(vals).length) {
      fill(out, h('p', { class: 'note', text: word.trim() ? 'No letters A to Z here, so there are no English values. Hebrew and Greek letters count in Every cipher.' :
        'Type a word or a name to see its numbers.' }));
      return;
    }
    var cards = h('div', { class: 'ciphers4' }, E.CORE.map(function (code) {
      var s = code === 'FR' || code === 'RFR' ? steps(word, code) : null;
      return h('div', { class: 'cv' }, h('div', { class: 'name', text: cname(code) }), h('div', { class: 'val', text: String(vals[code]) }),
        h('div', { class: 'how', text: E.explain(word, code) }), s ? h('div', { class: 'how how2', text: s }) : null);
    }));
    fill(out, [ex ? h('p', { class: 'example' }, h('b', { text: 'Example:' }), ' “' + word + '”. Now try your own word.') : null,
      cards, uncountedNote(word, false), matchesBox(word, TODAY)]);
  }

  // --------------------------------------- Make a coincidence: a game under Try a word (added 2026-11-16) --
  // The visitor plays the decoder: choose a goal, then type words until one matches today that many ways (a way is a core
  // cipher whose number for the word is one of the day's numbers, as On this day counts them). The bonus level is the
  // 13-Month Sky Calendar's last Year Day (today or earlier, never a coming day). The tries live only in this open page:
  // nothing is stored or sent, and reloading starts again. Reaching the goal shows how often made-up words do the same.
  var NUMW = ['no', 'one', 'two', 'three', 'four'];
  var GOALS = [[1, 'One way'], [2, 'Two ways'], [3, 'Three ways'], ['yd', 'Bonus: Year Day']];
  var game = { goal: 1, tries: [], won: null, msg: '', day: null, job: 0 }, gameUi = null;
  function gameDay() { return game.goal === 'yd' ? E.lastYearDay(TODAY) : TODAY; }
  function gameOpts() { return game.goal === 'yd' ? { system: '13' } : {}; }
  function gameNeed() { return game.goal === 'yd' ? 1 : game.goal; }
  function waysWord(k) { return NUMW[k] + (k === 1 ? ' way' : ' ways'); }
  function orMore(k) { return waysWord(k) + ' or more'; }
  function tries(n) { return n === 1 ? '1 try' : n + ' tries'; }
  function resetGame() { game.tries = []; game.won = null; game.msg = ''; game.job++; }
  function gameGoalLine() {
    var d = gameDay(), rows, nums, other, nd = E.dateNumbers(TODAY).length;
    if (game.goal !== 'yd') return note('Goal: a word that matches today’s numbers ' + orMore(game.goal) + '. A way is one of the four core ciphers whose ' +
      'number for the word is one of today’s ' + nd + ' numbers, so four is the most.');
    if (!d) return note('The 13-Month Sky Calendar dates here start in March 1900, so there is no Year Day before this day.');
    rows = E.thirteenNumbers(d); nums = rows.map(function (r) { return r[1]; }); other = nums.filter(Boolean);
    return note('Bonus level: on a Year Day the 13-Month Sky Calendar gives only ' + rows.length + ' numbers, where today gives ' + nd + '. ' +
      (d === TODAY ? 'Today is a Year Day, ' : 'The last Year Day was ') + longDate(d) + ' (' + E.thirteenLabel(d) + '): ' + andList(rows.map(function (r) { return r[1] + ' (' + r[2] + ')'; })) + '. Goal: a word or phrase that matches it ' +
      orMore(1) + '.' + (nums.indexOf(0) >= 0 && other.length ? ' No word adds up to 0, so aim for ' + andList(other.map(String)) + '.' : ''));
  }
  // one entry per (number, cipher): "37 in Reverse Full Reduction"
  function hitWays(hits) {
    var seen = {}, out = [];
    hits.forEach(function (x) { var k = x[1] + '\u0000' + x[3]; if (!seen[k]) { seen[k] = 1; out.push(x[1] + ' in ' + cname(x[3])); } });
    return out;
  }
  function gameTry() {
    var w = gameUi.inp.value.trim(), d = gameDay(), last = game.tries[0], hits, k;
    if (!w || !d) return;
    if (!Object.keys(E.values(w)).length) game.msg = 'No letters A to Z in “' + w + '”, so it does not count as a try.';
    else if (last && !game.won && last.w.toLowerCase() === w.toLowerCase()) game.msg = 'You just tried “' + w + '”; type another word.';
    else {
      if (game.won) resetGame();
      hits = E.dateHits(w, d, gameOpts()); k = E.ways(w, d, gameOpts());
      game.tries.unshift({ w: w, k: k, hits: hits });
      game.msg = '';
      if (k >= gameNeed()) game.won = { w: w, k: k, hits: hits, n: game.tries.length, fig: null };
    }
    drawGame();
    gameUi.inp.select();
  }
  // the goal reached: the match, then a live figure: how many of 1,000 made-up words of the same length do as well
  // (E.madeUpRun, seed 7, in slices so a long phrase never holds the page up); its box carries data-coincidence once
  // the luck check is there
  function gameReveal(won) {
    var yd = game.goal === 'yd', d = gameDay(), need = gameNeed(), fig = h('div', null, note('Working out how often made-up words do this…'));
    var box = h('div', { class: 'matches' }, h('h4', { text: 'Goal reached in ' + tries(won.n) }),
      h('p', null, '“' + won.w + '” matches ' + (yd ? longDate(d) + (d === TODAY ? ', today’s Year Day,' : ', the last Year Day,') : 'today') + ' ' + waysWord(won.k) + ':'),
      h('ul', null, won.hits.map(function (x) {
        return h('li', null, h('span', { class: 'hitn', text: String(x[1]) }), ' in ' + cname(x[3]) + ' = ' + (yd ? 'that day’s ' : 'today’s ') + x[0].replace(/^13-month /, '') + ' (' + x[2] + ')');
      })), fig, h('p', null, h('button', { type: 'button', class: 'btn quiet', 'data-make': 'again', text: 'Play again' })));
    function show(r) {
      won.fig = r;
      fill(fig, [chance(['Luck check: ' + fmt(r.hits) + ' of ' + fmt(r.n) + ' made-up words of the same length (random letters) match ' + (yd ? 'that Year Day ' : 'today ') +
        orMore(need) + ': ', h('b', { text: E.pct(r.share) }), (r.hits ? ', about 1 in ' + E.oneIn(r.hits, r.n) : '') + '.']),
        h('p', { text: r.share >= 0.01 ? 'So anyone who searches finds one fast. That is why every match here gets a luck check.' :
          (r.hits ? 'That is rare for one word, but people try word after word until one fits' : 'None of them does, but searching found one') +
          ': searching is what makes matches, and that is why every match here gets a luck check.' })]);
      box.setAttribute('data-coincidence', 'make');
    }
    if (won.fig) show(won.fig);
    else {
      var job = game.job, run = E.madeUpRun(won.w, d, need, gameOpts());
      (function slice() {
        if (job !== game.job) return;
        var t0 = Date.now();
        while (!run.done() && Date.now() - t0 < 16) run.step(50);
        if (run.done()) show(run.result()); else setTimeout(slice, 0);
      })();
    }
    return box;
  }
  function drawGame() {
    if (!gameUi) return;
    Array.prototype.forEach.call(gameUi.goals.children, function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-goal') === String(game.goal))); });
    fill(gameUi.line, gameGoalLine());
    var n = game.tries.length;
    fill(gameUi.log, [game.msg ? note(game.msg) : null, n ? h('p', { class: 'tries' }, h('b', { text: 'Tries: ' + n })) : null,
      n ? h('ul', { class: 'plain' }, game.tries.slice(0, 6).map(function (t) {
        return h('li', null, '“' + t.w + '”: ' + (t.k ? waysWord(t.k) + ' (' + hitWays(t.hits).join('; ') + ')' : 'no match'));
      })) : null, game.won ? gameReveal(game.won) : null]);
  }
  function renderGame() {
    var row = $('makeRow'), out = $('makeOut');
    if (!row || !out) return;
    if (game.day !== TODAY) { game.day = TODAY; resetGame(); }   // a new day, or the film's day: a fresh game
    if (!row.dataset.on) { row.dataset.on = '1'; row.addEventListener('toggle', function () { if (row.open) renderGame(); }); }
    if (!row.open) return;   // drawn the first time it opens
    if (!gameUi) {
      var inp = h('input', { id: 'makeWord', 'aria-label': 'A word or name for Make a coincidence', type: 'text', maxlength: '120', spellcheck: 'false', autocapitalize: 'words', autocomplete: 'off', dir: 'auto' });
      var form = h('form', { id: 'makeForm', method: 'dialog', autocomplete: 'off' }, h('label', { for: 'makeWord', text: 'A word or name' }),
        h('div', { class: 'tryline' }, inp, h('button', { class: 'btn', type: 'submit', text: 'Try it' })));
      var goals = h('div', { class: 'goals', role: 'group', 'aria-label': 'Goal' }, GOALS.map(function (g) {
        var b = h('button', { type: 'button', class: 'btn quiet', 'data-goal': String(g[0]), 'aria-pressed': 'false', text: g[1] });
        b.addEventListener('click', function () { game.goal = g[0]; resetGame(); drawGame(); });
        return b;
      }));
      gameUi = { inp: inp, goals: goals, line: h('div'), log: h('div', { class: 'gamelog', 'aria-live': 'polite' }) };
      form.addEventListener('submit', function (e) { e.preventDefault(); gameTry(); });
      gameUi.log.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('[data-make=again]')) { resetGame(); drawGame(); inp.focus(); }
      });
      fill(out, [h('p', { text: 'Play the decoder: choose a goal, then type words one after another until one matches. The page counts your tries. The count ' +
        'lives only in this open page: reloading starts again, and nothing is saved or sent.' }), goals, gameUi.line, form, gameUi.log]);
    }
    drawGame();
  }

  // ---------------------------------------------------------------------------- the meaning of a number --
  function layerList(items, empty) {
    return items.length ? h('ul', null, items) : h('p', { class: 'note', text: empty });
  }
  // how much of the number line the public key words cover (the chance check under "Key words that add up to N")
  var kwSpan = null;
  function keywordSpan() {
    if (kwSpan) return kwSpan;
    var set = new Set();
    E.publicWords().forEach(function (w) { var v = E.values(w); Object.keys(v).forEach(function (k) { set.add(v[k]); }); });
    var all = Array.from(set), lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    return (kwSpan = { n: E.publicWords().length, totals: set.size, lo: lo, hi: hi, share: set.size / (hi - lo + 1) });
  }
  function keywordLayerChance() {
    var k = keywordSpan();
    return chance(['Luck check: the ' + k.n + ' key words give ' + k.totals + ' different totals, all from ' + k.lo + ' to ' + k.hi + ', so ',
      h('b', { text: E.pct(k.share) }), ' of the whole numbers from ' + k.lo + ' to ' + k.hi + ' are some key word’s total. A key-word match is ' +
      E.strengthWord(k.share) + '.']);
  }
  // a record's source: its links when it has them (data/record_sources.json), else the citation as written
  var REC_LINKS = {};
  (D.records || []).forEach(function (r) { if (r[4]) REC_LINKS[r[0] + '\u0000' + r[2]] = r[4]; });
  function recordSource(n, text, plain) {
    var links = REC_LINKS[n + '\u0000' + text];
    if (!links) return plain;
    return links.map(function (l, i) { return [i ? '; ' : '', h('a', { href: l[1], rel: 'noopener', text: l[0] })]; });
  }
  // the key-word check worked out: the count, the strip of totals (the number outlined) and the list
  function keywordWork(n) {
    var k = keywordSpan(), tot = E.keywordTotals(), set = new Set(tot), range = k.hi - k.lo + 1, strip = h('div', { class: 'kwstrip', 'aria-hidden': 'true' });
    for (var i = k.lo; i <= k.hi; i++) strip.appendChild(h('i', { class: [set.has(i) ? 'on' : '', i === n ? 'at' : ''].join(' ').trim() || null }));
    return [note('That is ' + k.totals + ' of the ' + range + ' whole numbers from ' + k.lo + ' to ' + k.hi + ' (' + k.hi + ' − ' + k.lo + ' + 1 = ' + range + '): ' +
      k.totals + ' ÷ ' + range + ' ≈ ' + k.share.toFixed(1) + ', about ' + Math.round(k.share * 10) + ' in 10. The ' + k.n + ' key words are a fixed list, ' +
      'looked up by their totals, so a key word that adds up to a number is a lookup, not a message.'), strip,
      note('Each square is one whole number from ' + k.lo + ' to ' + k.hi + '; filled squares are key-word totals, and the outlined one is ' + n + '.'),
      lazyRow('The ' + k.totals + ' totals', function () { return note(tot.join(', ') + '. ' + n + ' is one of them.'); })];
  }
  // a record can be checked; lore is belief built on top (and on which line above, when it says)
  function loreNotes(m) {
    var out = ['A record can be checked at its source; lore is a belief built on top of a number or a record, and it proves nothing.'];
    m.lore.forEach(function (t) {
      m.records.forEach(function (r) { if (t.indexOf(r[2]) >= 0) out.push('This belief is built on the record above (' + r[2] + ').'); });
      if (/\(atomic number\)/.test(t) && m.science.length) out.push('This belief is built on the Science line above (' + m.science[0] + ').');
    });
    return note(out.join(' '));
  }
  function meaningLayers(n) {
    var m = E.meaning(n);
    return h('div', { class: 'layers' },
      h('div', { class: 'layer' }, h('h4', null, 'Math', h('span', { class: 'tag', text: 'always true' })),
        layerList(m.math.map(function (t) { return h('li', { text: t }); }), 'Nothing special in arithmetic.'),
        m.math.some(function (t) { return / prime number$/.test(t); }) ? note('A prime number divides evenly only by 1 and itself.') : null),
      h('div', { class: 'layer' }, h('h4', null, 'Science', h('span', { class: 'tag', text: 'atomic number' })),
        layerList(m.science.map(function (t) { return h('li', { text: t }); }), 'No element has this atomic number (there are 118).')),
      h('div', { class: 'layer' }, h('h4', null, 'Record', h('span', { class: 'tag', text: 'sourced' })),
        layerList(m.records.map(function (r) { return h('li', { 'data-history': '' }, r[1] + ' ', h('span', { class: 'src' }, '(' + r[0] + '; source: ', recordSource(n, r[1], r[2]), ')')); }),
          'No sourced record for this number here.')),
      h('div', { class: 'layer lore' }, h('h4', null, 'Lore: what some decoders believe', h('span', { class: 'tag', text: 'belief, not fact' })),
        layerList(m.lore.map(function (t) { return h('li', { class: 'lore-item', 'data-history': '', text: t }); }), 'No lore noted for this number.'),
        m.lore.length ? loreNotes(m) : null),
      h('div', { class: 'layer', 'data-coincidence': m.phrases.length ? 'key-words' : null },
        h('h4', null, 'Key words that add up to ' + String(n), h('span', { class: 'tag', text: 'computed' })),
        layerList(m.phrases.map(function (p) { return h('li', null, '“' + p[0] + '” in ' + cname(p[1]), h('span', { class: 'how', text: E.explain(p[0], p[1]) })); }),
          'None of the ' + E.publicWords().length + ' key words adds up to ' + String(n) + '.'),
        m.phrases.length ? [keywordLayerChance(), keywordWork(n)] : null));
  }

  // --------------------------------------------------------------------------------- Every cipher (locked) --
  var DESC = {};
  E.ENGLISH.forEach(function (c) { DESC[c[1]] = c[2]; });
  DESC.HEB = 'Hebrew letter values, final forms included (א=1 ... ת=400)';
  DESC.GRK = 'Greek letter values (isopsephy: α=1 ... ω=800)';
  function scriptExplain(text, which) {
    var parts = E.scriptLetters(text, which), sum = 0;
    parts.forEach(function (p) { sum += p[1]; });
    return parts.map(function (p) { return p[0] + p[1]; }).join(' + ') + ' = ' + sum;
  }
  // all twelve English ciphers against today: 12 x 10 pairs, the matches, and their own luck check
  var allCache = {};
  function allCiphersBox(text) {
    var hits = E.allDateHits(text, TODAY), nd = E.dateNumbers(TODAY).length, nc = E.CODES.length, np = nc * nd, k = hits.length;
    var key = TODAY + '\u0000' + text, r = allCache[key];
    if (!r) { if (Object.keys(allCache).length > 60) allCache = {}; r = allCache[key] = E.dayHitRateAll(text, TODAY); }
    var nums = hits.map(function (x) { return x[1]; }), one = k > 1 && nums.every(function (x) { return x === nums[0]; });
    return h('div', { class: 'matches', 'data-coincidence': 'all-ciphers' }, h('h4', { text: 'All ' + nc + ' ciphers against today' }),
      h('p', null, 'All ' + nc + ' ciphers against today’s ' + nd + ' numbers make ' + nc + ' × ' + nd + ' = ' + np + ' pairs. Today ' +
        (k ? k + ' of the ' + np + (k === 1 ? ' matches' : ' match') + (one ? (k === 2 ? ', both ' : ', all ') + nums[0] : '') + ':' : 'none of the ' + np + ' match.')),
      k ? h('ul', null, hits.map(function (x) {
        return h('li', null, h('span', { class: 'hitn', text: String(x[1]) }), ' in ' + cname(x[3]) + ' = today’s ' + x[0] + ' (' + x[2] + ')');
      })) : null,
      h('p', null, 'More pairs, more matches. Matches today, below, keeps to the four core ciphers.'),
      chance(['Luck check with all ' + nc + ' ciphers: “' + text + '” matches ', h('b', { text: E.pct(r.share) }), ' of days (' + fmt(r.hits) + ' of the ' +
        fmt(r.days) + ' days around today), so a match on any one day is ' + E.strengthWord(r.share) + '.']),
      luckWork(r));
  }
  function renderCiphers() {
    var inp = $('cipherText'), out = $('cipherOut');
    if (!inp || !out) return;
    var text = inp.value, all = E.allValues(text), codes = Object.keys(all);
    if (!codes.length) {
      fill(out, h('p', { class: 'note', text: text.trim() ? 'No letters these ciphers count (A to Z, Hebrew or Greek).' : 'Type any text to see its numbers.' }));
      return;
    }
    var rows = codes.map(function (code) {
      var v = all[code], d = h('details', { class: 'drow', 'data-code': code }), script = code === 'HEB' || code === 'GRK';
      var s = steps(text, code), x6 = { SUM: ['English Ordinal', 'EO'], RSUM: ['Reverse Ordinal', 'RO'] }[code];
      d.appendChild(h('summary', null, h('span', { class: 'name', text: cname(code) }), h('span', { class: 'val', text: String(v) })));
      var body = h('div', { class: 'body' },
        h('p', { class: 'how' }, script ? bidi(scriptExplain(text, code)) : E.explain(text, code)),
        s ? h('p', { class: 'how', text: s }) : null,
        x6 ? h('p', { class: 'how', text: 'The same as ' + x6[0] + ' ' + E.value(text, x6[1]) + ' × 6 = ' + v + '.' }) : null,
        h('p', { class: 'note' }, bidi(DESC[code])),
        script ? h('p', { class: 'note' }, 'Letters counted: ', E.scriptNames(text, code).map(function (x, i) {
          return [i ? ' · ' : '', h('span', { class: 'nw' }, h('bdi', { text: x[0] }), ' ' + x[1] + ' ' + x[2])];
        })) : null);
      d.appendChild(body);
      var drawn = false;
      d.addEventListener('toggle', function () {
        if (d.open && !drawn) { drawn = true; body.appendChild(h('h4', { text: 'What ' + String(v) + ' is known for' })); body.appendChild(meaningLayers(v)); }
      });
      return d;
    });
    var english = Object.keys(E.values(text)).length;
    var parts = [english ? note('The first four rows are the four core ciphers, the ones Try a word and Matches today use.') : null,
      h('div', { class: 'cipher-rows' }, rows), uncountedNote(text, true)];
    if (english) {
      parts.push(allCiphersBox(text));
      parts.push(matchesBox(text, TODAY, 'Matches today (the four core ciphers)'));
    } else {
      parts.push(h('p', { class: 'note', text: 'Matches with dates use the four core English ciphers, so this text has none.' }));
    }
    fill(out, parts);
  }

  // ------------------------------------------------------------------------------------ Any date (locked) --
  var sharedCache = {};
  function sharedLine(todayIso) {
    var s = sharedCache[todayIso] || (sharedCache[todayIso] = E.sharedShare(todayIso));
    return chance(['The two calendars give at least one number in common on ', h('b', { text: E.pct(s.share) }),
      ' of days (' + fmt(s.hits) + ' of the ' + fmt(s.days) + ' days around today), so a “same” on any one day is ' + E.strengthWord(s.share) + '.']);
  }
  function sameSet(iso) { return E.numberSet(iso, { system: '12' }); }
  // what the "same" marks add up to, where each comes from (full) and why there are so many
  function sameLines(iso, full) {
    var s = E.sameReport(iso), sum, b = s.builtOn;
    if (!s.numbers.length) return note('On this date the two calendars share no number.');
    var ways = function (rs, cal) { return rs.map(function (x) { return x[1] + ' (' + x[0] + ')'; }).join(' or ') + ' on the ' + cal + ' calendar'; };
    sum = s.md.equal ? s.md.reg[0] + s.md.reg[1] : 0;
    return [note('The two calendars share ' + (s.numbers.length === 1 ? 'one number on this date: ' + s.numbers[0] : s.numbers.length + ' different numbers on this date: ' +
      andList(s.numbers.map(String))) + ' (' + s.rows + ' of the ' + s.of + ' rows in the 13-month table ' + (s.rows === 1 ? 'says' : 'say') + ' “same”).'),
      full ? [h('p', { class: 'note', text: 'Where each “same” comes from:' }), h('ul', { class: 'plain note' }, s.pairs.map(function (p) {
        return h('li', { text: p.n + ': ' + ways(p.th, '13-month') + '; ' + ways(p.reg, 'regular') + '.' });
      }))] : null,
      s.md.equal && b > 1 ? note('Why so many: the month and day add up to ' + sum + ' on both calendars (' + s.md.reg.join(' + ') + ' and ' +
        s.md.th.join(' + ') + '), and ' + b + ' of the “same” rows are built on that ' + sum + ', so they are one coincidence counted ' + b + ' times.') : null];
  }
  function sharedWork(todayIso) { return luckWork(sharedCache[todayIso] || (sharedCache[todayIso] = E.sharedShare(todayIso))); }
  function perDay(t) { return calCache[t] || (calCache[t] = { r12: E.numbersPerDay('12', t), r13: E.numbersPerDay('13', t), ru: E.numbersPerDay('usual', t) }); }
  function renderDates() {
    var inp = $('dateIn'), out = $('dateOut');
    if (!inp || !out) return;
    var iso = validDate(inp.value) ? inp.value : TODAY, rows = E.dateNumbers(iso);
    var t = E.thirteenNumbers(iso), parts = [dateCard(iso),
      h('div', { 'data-coincidence': 'known-for' },
        numTable(rows, { known: true, caption: 'Regular calendar, plus the Hebrew date' }), codeKey(), yearKey(iso), keywordChance(TODAY),
        note('On average a date gives ' + perDay(TODAY).ru.toFixed(1) + ' different numbers this way (the 1,460 days around today), so things line up ' +
          'easily, and every match here gets a luck check.'),
        elementLines(rows, 'this date’s'), knownWorked(rows))];
    if (t.length) {
      var reg = sameSet(iso);
      parts.push(h('div', { 'data-coincidence': 'same' },
        numTable(t, { caption: '13-Month Sky Calendar (Eastern Time)', same: reg }),
        h('p', { class: 'note', text: '“Same” marks a number the regular calendar also gives for this date.' }),
        sameLines(iso, true),
        sharedLine(TODAY), sharedWork(TODAY)));
    } else parts.push(h('p', { class: 'note', text: 'The 13-Month Sky Calendar dates here cover March 1900 to March 2052.' }));
    fill(out, parts);
  }
  // a word or name against the chosen date (a birthday, say): today or earlier only, never a coming day
  function renderDateWord() {
    var inp = $('dateWord'), out = $('dateWordOut'), d = $('dateIn');
    if (!inp || !out || !d) return;
    var word = inp.value, iso = validDate(d.value) ? d.value : TODAY;
    if (!word.trim()) { fill(out, null); return; }
    if (iso > TODAY) { fill(out, note('Choose today or an earlier day.')); return; }
    if (!Object.keys(E.values(word)).length) {
      fill(out, note('No letters A to Z here, so there are no English values. Hebrew and Greek letters count in Every cipher.'));
      return;
    }
    fill(out, [matchesBox(word, TODAY, 'Matches on ' + longDate(iso), iso), uncountedNote(word, false)]);
  }
  function renderSpan() {
    var a = $('spanA'), b = $('spanB'), out = $('spanOut');
    if (!a || !b || !out) return;
    if (!validDate(a.value) || !validDate(b.value)) { fill(out, h('p', { class: 'note', text: 'Choose two dates.' })); return; }
    var rows = E.span(a.value, b.value), set = Array.from(E.spanSet(a.value, b.value)).sort(function (x, y) { return x - y; });
    fill(out, [numTable(rows, { names: false, caption: longDate(a.value <= b.value ? a.value : b.value) + ' to ' + longDate(a.value <= b.value ? b.value : a.value) }),
      h('p', null, 'Numbers decoders compare: ', h('b', { text: set.join(' and ').replace(/ and (?=[^ ]+ and )/g, ', ') }),
        '. Weeks, months and years count only when they come out even.'),
      note((function (lo) { return lo.length ? 'Left out: ' + andList(lo.map(function (x) { return x[0] + ' (' + x[1] + ')'; })) + '.' :
        'All five count: this gap comes out even.'; })(E.spanLeftOut(a.value, b.value))),
      note('A gap gives up to five numbers: the days, the days counting both ends, and the weeks, months and years when they come out even. ' +
        'It counts as a match when one of them equals a name’s number in one of the four core ciphers; On this day and Connect two things check gaps this way.')]);
  }

  // ------------------------------------------------------------------------------------ Meanings (locked) --
  function renderMeaning() {
    var inp = $('numIn'), out = $('numOut');
    if (!inp || !out) return;
    var n = Number(inp.value);
    if (!(n >= 1 && n <= 99999 && Math.floor(n) === n)) { fill(out, h('p', { class: 'note', text: 'Type a whole number from 1 to 99,999.' })); return; }
    fill(out, [h('p', { class: 'bign', text: String(n) }), meaningLayers(n)]);
  }
  function renderRecords() {
    var rl = $('recordList'), ll = $('loreList');
    if (rl && !rl.firstChild) {
      rl.appendChild(h('table', { class: 'reclist' },
        h('thead', null, h('tr', null, h('th', { scope: 'col', text: 'Number' }), h('th', { scope: 'col', text: 'Record' }), h('th', { scope: 'col', text: 'Source' }))),
        h('tbody', null, D.records.map(function (r) {
          return h('tr', { 'data-history': '' }, h('td', { class: 'n', text: String(r[0]) }), h('td', null, r[2], ' ', h('span', { class: 'src', text: '(' + r[1] + ')' })),
            h('td', { class: 'src' }, recordSource(r[0], r[2], r[3])));
        }))));
    }
    if (ll && !ll.firstChild) {
      ll.appendChild(h('ul', { class: 'plain' }, D.lore.map(function (r) { return h('li', { class: 'lore-item', 'data-history': '' }, h('b', { text: String(r[0]) + ': ' }), r[1] + '.'); })));
    }
  }

  // ------------------------------------------------------------------------ Events and connections (locked) --
  var EVENTS = D.events;
  function coreVals(name) {
    var v = E.values(name);
    return E.CORE.map(function (c) { return E.NAMES[c] + ' ' + v[c]; }).join(' · ');
  }
  function eventSource(e) {
    var host = '';
    try { host = new URL(e.source).hostname.replace(/^www\./, ''); } catch (x) {}
    return h('a', { href: e.source, rel: 'noopener', text: 'Source: ' + host });
  }
  var libCache = {};
  function libraryLine(rule, todayIso, what) {
    var k = rule + todayIso, r = libCache[k] || (libCache[k] = E.libraryDayShare(rule, todayIso));
    return chance(['On ', h('b', { text: E.pct(r.share) }), ' of days (' + fmt(r.hits) + ' of the ' + fmt(r.days) + ' days around today), at least one of these ' +
      EVENTS.length + ' events lines up ' + what + ', so a lineup on any one day is ' + E.strengthWord(r.share) + '.']);
  }
  function hitText(x) {
    if (x[2] === 'span') return x[0] + ': ' + String(x[1]) + ' (' + cname(x[3]) + ')';
    return String(x[1]) + ' = ' + x[0] + ' (' + x[2] + '), ' + cname(x[3]);
  }
  function renderOnThisDay() {
    var out = $('otdOut');
    if (!out) return;
    var o = E.onThisDay(TODAY), parts = [];
    if (o.scheduled.length) parts.push(h('p', null, h('b', { text: 'Happening today: ' }), o.scheduled.map(function (e) { return e.name; }).join(', ') + '.'));
    if (o.anniversaries.length) parts.push(h('ul', { class: 'plain' }, o.anniversaries.map(function (a) {
      var y = a[1];
      return h('li', { text: a[0].name + ' (' + longDate(a[0].date) + '): ' + (y >= 0 ? fmt(y) + (y === 1 ? ' year' : ' years') + ' ago today' :
        'in ' + fmt(-y) + (y === -1 ? ' year' : ' years')) + '.' });
    })));
    var lines = h('div', { class: 'matches', 'data-coincidence': 'on-this-day' }, h('h4', { text: 'Events that line up with today' }));
    if (o.lines.length) {
      lines.appendChild(h('ul', null, o.lines.map(function (l) {
        var r = E.dayHitRate(l[0].name, TODAY);
        return h('li', null, h('b', { text: l[0].name }), ': ' + l[1].map(hitText).join('; ') + '. ',
          h('span', { class: 'src', text: '(“' + l[0].name + '” matches ' + E.pct(r.share) + ' of days.)' }));
      })));
    } else lines.appendChild(h('p', { text: 'None of the ' + EVENTS.length + ' events lines up with today two or more ways.' }));
    lines.appendChild(libraryLine('onthisday', TODAY, 'two or more ways or by the time since it'));
    lines.appendChild(luckWork(libShare(), { window: true }));
    parts.push(lines);
    fill(out, parts);
  }
  function libShare() { var k = 'onthisday' + TODAY; return libCache[k] || (libCache[k] = E.libraryDayShare('onthisday', TODAY)); }
  // one chosen day, today or earlier (never a coming day): which events line up with it
  function renderOtdDay() {
    var inp = $('otdDay'), out = $('otdDayOut');
    if (!inp || !out) return;
    inp.max = TODAY;
    var d = inp.value;
    if (!validDate(d)) { fill(out, note('Choose a date.')); return; }
    if (d > TODAY) { fill(out, note('Choose today or an earlier day.')); return; }
    var o = E.onThisDay(d), lib = libShare(), box = h('div', { class: 'matches', 'data-coincidence': 'another-day' }, h('h4', { text: 'Events that line up with ' + longDate(d) }));
    box.appendChild(o.lines.length ? h('ul', null, o.lines.map(function (l) {
      var r = E.dayHitRate(l[0].name, TODAY);
      return h('li', null, h('b', { text: l[0].name }), ': ' + l[1].map(hitText).join('; ') + '. ',
        h('span', { class: 'src', text: '(“' + l[0].name + '” matches ' + E.pct(r.share) + ' of days.)' }), h('span', { class: 'vals', text: l[0].name + ': ' + coreVals(l[0].name) }));
    })) : h('p', { text: 'None of the ' + EVENTS.length + ' events lines up with this day two or more ways.' }));
    box.appendChild(chance(['By luck, some event lines up on ', h('b', { text: E.pct(lib.share) }), ' of the 1,460 days around today (about 1 day in ' +
      E.oneInText(lib.hits, lib.days) + '), so a lineup on any one day is ' + E.strengthWord(lib.share) + '.']));
    fill(out, box);
  }
  function eventCard(e) {
    return h('article', { class: 'ev' }, h('h4', { text: e.name }),
      h('p', { class: 'when', text: longDate(e.date) + (e.end_date && e.end_date !== e.date ? ' to ' + longDate(e.end_date) : '') }),
      h('p', { 'data-history': '', text: e.notes }), h('p', { class: 'vals', text: coreVals(e.name) }), h('p', { class: 'small' }, eventSource(e)));
  }
  function renderEvents() {
    var out = $('eventsOut');
    if (!out) return;
    var soon = [], now = [], past = [];
    EVENTS.forEach(function (e) {
      var w = E.when(e, TODAY);
      if (w === 'future') soon.push(e); else if (w === 'present') now.push(e); else if (w === 'past') past.push(e);
    });
    past.reverse();
    fill(out, [
      now.length ? [h('h4', { text: 'Happening now' }), h('div', { class: 'evlist' }, now.map(eventCard))] : null,
      h('h4', { text: 'Coming up' }),
      soon.length ? h('div', { class: 'evlist' }, soon.map(eventCard)) : h('p', { class: 'note', text: 'None.' }),
      h('details', { class: 'drow' }, h('summary', null, h('span', { class: 'name', text: 'Past (' + past.length + ', newest first)' })),
        h('div', { class: 'body' }, h('div', { class: 'evlist' }, past.map(eventCard))))]);
  }
  // a connection's kind, and its working: each side's letters or date sum
  var KIND = { 'span = name': 'time between = name' };
  function partText(p) {
    if (p.code) return p.name + ' in ' + E.NAMES[p.code] + ': ' + p.how;
    return (p.span ? 'Time between, ' + p.span : mdy(p.date) + ', ' + p.label) + ': ' + p.how + ' = ' + p.n;
  }
  function workItem(t, w) {
    return h('li', null, t, w ? [' ', h('span', { class: 'ktag', text: KIND[w.type] || w.type }), h('span', { class: 'how', text: w.parts.map(partText).join(' · ') })] : null);
  }
  function evById(id) { for (var i = 0; i < EVENTS.length; i++) if (EVENTS[i].id === id) return EVENTS[i]; return null; }
  function rareCount() { return D.strongest.filter(function (s) { return s.ge / s.n <= 0.01; }).length; }
  function renderStrongest() {
    var out = $('strongOut');
    if (!out || out.firstChild) return;
    var pairs = D.meta.pairs, rare = Math.round(pairs * 0.01), ne = EVENTS.length, with2 = 0, i, j, tally = {};
    for (i = 0; i < ne; i++) for (j = i + 1; j < ne; j++) if (E.connections(EVENTS[i], EVENTS[j]).length >= 2) with2++;
    D.strongest.forEach(function (s) { var w = E.strengthWord(s.ge / s.n).split(' ')[0]; tally[w] = (tally[w] || 0) + 1; });
    var nr = tally.rare || 0;
    fill(out, [h('p', { text: 'These ' + D.meta.eventsCount + ' events make ' + pairs + ' pairs, so about ' + rare +
      ' of them will look “rare” (1 in 100) by luck alone. Finding one or two here is what luck alone gives.' }),
      note('A connection is one way two things share a number: both names give it, one name and the other’s date give it, both dates give it, ' +
        'or the time between the two dates equals one name’s number. Names count in the four core ciphers; dates count in the ways of adding ' +
        'shown under Today (for two dates, all but the two that add the whole year).'),
      note('How this list is made: these ' + ne + ' events make ' + ne + ' × ' + (ne - 1) + ' ÷ 2 = ' + pairs + ' pairs (each event once with each of the other ' +
        (ne - 1) + '), and ' + pairs + ' × 1% ≈ ' + rare + '. Of the ' + pairs + ', ' + with2 + ' have two or more connections. The 20 with the most ' +
        'connections were each checked against 500 look-alike pairs, and the ' + D.strongest.length + ' that luck matches least often are listed, ' +
        'rarest first. The list was worked out once, when the site was built, and is the same for everyone.'),
      note('A look-alike pair is made up to show what luck does: each name keeps its length, spaces and digits, every letter becomes a random one ' +
        '(common English letters come up more often), and each date becomes a random day from 1900 to 2030. When a look-alike pair has at least ' +
        'as many connections as the real pair, luck did as well.'),
      D.strongest.map(function (s, i) {
        var share = s.ge / s.n, a = evById(s.a), b = evById(s.b), work = a && b ? E.connectionWork(a, b) : [];
        return h('div', { class: 'pair', 'data-coincidence': 'strongest' },
          h('h4', { text: (i + 1) + '. ' + s.aName + ' and ' + s.bName }),
          a && b ? h('p', { class: 'note when', text: longDate(a.date) + ' · ' + longDate(b.date) }) : null,
          chance([s.count + (s.count === 1 ? ' connection. ' : ' connections. '), h('b', { text: E.pct(share) }), ' of ' + fmt(s.n) +
            ' random look-alike pairs do as well: ' + E.strengthWord(share) + '.']),
          luckWork({ hits: s.ge, days: s.n, share: share }, { pair: true }),
          h('ul', null, s.lines.map(function (t, k) { return workItem(t, work[k] && work[k].text === t ? work[k] : null); })),
          a && b ? lazyRow('See the first 10 look-alike pairs', function () {
            return [note('These are the first 10 of the ' + s.n + ' look-alike pairs in this check, in the order they were made; one counts when it has at least ' +
              nWord(s.count, 'connection') + '.'), h('ul', { class: 'plain' }, E.lookalikes(a, b, 10, 7).map(function (r) {
              return h('li', null, h('span', { class: 'mono', text: r[0] }), (r[1] ? ' (' + mdy(r[1]) + ')' : '') + ' and ', h('span', { class: 'mono', text: r[2] }),
                (r[3] ? ' (' + mdy(r[3]) + ')' : '') + ': ' + nWord(r[4], 'connection'));
            }))];
          }) : null);
      }),
      note('Of these ' + D.strongest.length + ' pairs, ' + andList(['rare', 'unusual', 'mild', 'ordinary'].filter(function (w) { return tally[w]; }).map(function (w) {
        return tally[w] + (tally[w] === 1 ? ' is ' : ' are ') + w; })) + '. Luck alone makes about ' + rare + ' of the ' + pairs + ' pairs look rare, so finding ' +
        nr + (nr <= rare ? ' is about what luck gives.' : ' is a few more than luck alone gives.'))]);
  }

  // ---------------------------------- Make up a history: under Strongest connections (added 2026-11-16) --
  // Each tap gives every event a made-up twin (a name of random letters, a random date from 1900 to today: never a later
  // day) and takes the exact steps that made the list above (E.strongestRun, which rebuilds the shipped list from the real
  // events), in small slices with a progress bar so the page keeps responding. History k uses seed 1000 + k, so each one
  // can be checked. The tally lives only in this open page.
  var made = { today: null, n: 0, withRare: 0, rare: 0, job: 0, running: false, last: null, ui: null };
  function madeLabel() { return h('span', { class: 'ktag', text: 'made up' }); }
  function pairCard(label, s, a, b, madeUp) {
    var share = s.ge / s.n, nm = function (x) { return [x.name, madeUp ? madeLabel() : null]; };
    return h('div', { class: 'pair' }, h('p', { class: 'note', text: label }), h('h5', null, nm(a), ' and ', nm(b)),
      h('p', { class: 'note when', text: longDate(a.date) + ' · ' + longDate(b.date) }),
      chance([s.count + ' connections. ', h('b', { text: E.pct(share) }), ' of ' + fmt(s.n) + ' random look-alike pairs do as well: ' + E.strengthWord(share) + '.']),
      luckWork({ hits: s.ge, days: s.n, share: share }, { pair: true }),
      h('ul', null, s.lines.map(function (t) { return h('li', { text: t }); })));
  }
  function madeResult(L) {
    var r = L.r, tally = {}, real = D.strongest[0], word = function (s) { return E.strengthWord(s.ge / s.n).split(' ')[0]; };
    r.top.forEach(function (s) { tally[word(s)] = (tally[word(s)] || 0) + 1; });
    return h('div', { class: 'made', 'data-coincidence': 'made-up' }, h('h5', { text: 'Made-up history ' + L.k }),
      note('Its ' + L.evs.length + ' made-up events make ' + r.pairs + ' pairs; ' + r.with2 + ' have two or more connections. ' + (r.top.length ? 'Of the ' + r.top.length +
        ' rarest, ' + andList(['rare', 'unusual', 'mild', 'ordinary'].filter(function (w) { return tally[w]; }).map(function (w) { return tally[w] + ' ' + (tally[w] === 1 ? 'is ' : 'are ') + w; })) + '.' : '')),
      r.top.length ? h('div', { class: 'twocol' }, pairCard('The real top pair', real, evById(real.a), evById(real.b), false), pairCard('Its top pair', r.top[0], r.top[0].a, r.top[0].b, true)) :
        chance(['None of its pairs has two or more connections: ', h('b', { text: E.pct(0) }), ' of the ' + r.pairs + '.']),
      r.top.length ? lazyRow('Its ' + r.top.length + ' rarest pairs', function () {
        return h('ol', { class: 'plain' }, r.top.map(function (s) {
          return h('li', null, s.a.name, madeLabel(), ' (' + mdy(s.a.date) + ') and ' + s.b.name, madeLabel(), ' (' + mdy(s.b.date) + '): ' + nWord(s.count, 'connection') + ', ' +
            E.pct(s.ge / s.n) + ' of ' + fmt(s.n) + ': ' + word(s) + '.');
        }));
      }) : null,
      lazyRow('The ' + L.evs.length + ' made-up events', function () {
        return h('ul', { class: 'plain' }, L.evs.map(function (e) { return h('li', null, h('span', { class: 'mono', text: e.name }), ' (' + mdy(e.date) + '), made up in place of ' + e.twin); }));
      }));
  }
  function renderMade() {
    var out = $('madeOut'), u;
    if (!out) return;
    if (made.today !== TODAY) made = { today: TODAY, n: 0, withRare: 0, rare: 0, job: made.job + 1, running: false, last: null, ui: made.ui };   // a new day or the film's day
    if (!made.ui || !out.contains(made.ui.btn)) {
      var btn = h('button', { type: 'button', class: 'btn', id: 'madeGo' });
      btn.addEventListener('click', makeHistory);
      made.ui = { btn: btn, prog: h('div'), tally: h('p', { class: 'madetally', role: 'status' }), res: h('div') };
      fill(out, [note('Do made-up events connect as often as the real ones? The button gives each of the ' + EVENTS.length + ' events a made-up twin: a name of ' +
        'random letters (the same length, spaces and digits) and a random date from January 1, 1900 to today, never later. Then it takes the same steps that made ' +
        'the list above: all ' + D.meta.pairs + ' pairs, the 20 with the most connections, 500 look-alike pairs each, rarest first.'),
        h('p', null, btn), made.ui.prog, made.ui.tally, made.ui.res]);
    }
    u = made.ui;
    u.btn.textContent = made.n ? 'Make up another ' + EVENTS.length : 'Make up ' + EVENTS.length + ' events';
    u.btn.setAttribute('aria-disabled', String(made.running));
    fill(u.prog, made.running ? [u.bar = h('div', { class: 'progress', role: 'progressbar', 'aria-label': 'Making up history ' + (made.n + 1), 'aria-valuemin': '0',
      'aria-valuemax': '100', 'aria-valuenow': '0' }, h('span')), note('Making up history ' + (made.n + 1) + ' and checking it…')] : null);
    var nr = rareCount();
    fill(u.tally, made.n ? ['Made-up histories so far: ' + made.n + '. With at least one “rare” pair: ' + made.withRare + ' (rare pairs in all: ' + made.rare +
      '). Real history: ' + nr + ' rare ' + (nr === 1 ? 'pair' : 'pairs') + ' among its ' + D.strongest.length + ' listed.'] : null);
    fill(u.res, made.last ? madeResult(made.last) : null);
  }
  function makeHistory() {
    if (made.running) return;
    var k = made.n + 1, job = ++made.job, evs = E.madeUpEvents(EVENTS, 1000 + k, TODAY), run = E.strongestRun(evs, 10, 500);
    made.running = true;
    renderMade();
    function slice() {
      if (job !== made.job) return;   // the day changed meanwhile: dropped
      var t0 = Date.now();
      while (!run.done() && Date.now() - t0 < 24) run.step(10);
      var p = Math.round(run.progress() * 100);
      made.ui.bar.firstChild.style.width = p + '%';
      made.ui.bar.setAttribute('aria-valuenow', String(p));
      if (!run.done()) { setTimeout(slice, 0); return; }
      var r = run.result(), rare = r.top.filter(function (s) { return s.ge / s.n <= 0.01; }).length;
      made.n = k; made.rare += rare; if (rare) made.withRare++;
      made.last = { k: k, evs: evs, r: r };
      made.running = false;
      renderMade();
    }
    setTimeout(slice, 0);
  }

  // Connect two things: the 1,500-pair chance check runs in small slices so the page keeps responding
  var connJob = 0;
  function eventByName(name) {
    var n = name.trim().toLowerCase();
    for (var i = 0; i < EVENTS.length; i++) if (EVENTS[i].name.toLowerCase() === n) return EVENTS[i];
    return null;
  }
  // a date box that holds the date of the event named beside it is emptied when that name changes to one that is not
  // an event, so an example's date never counts for a name typed over it (a date the visitor chose is kept)
  // (connGone: the date this emptied, so that typing the event's own name back, say after fixing a typo, brings it back)
  var connFrom = {}, connGone = {};
  function connRemember() {
    connGone = {};
    ['connA', 'connB'].forEach(function (id) {
      var el = $(id), d = $(id + 'd'), e = el && eventByName(el.value);
      connFrom[id] = e && d && d.value === e.date ? e.date : null;
    });
  }
  function connNameTyped(id) {
    var el = $(id), d = $(id + 'd'), e = el && eventByName(el.value);
    if (!el || !d) return;
    if (e) {
      if (!d.value && connGone[id] === e.date) { d.value = e.date; connFrom[id] = e.date; }
      connGone[id] = null;
      return;
    }
    if (connFrom[id] && d.value === connFrom[id]) { d.value = ''; connGone[id] = connFrom[id]; }
    connFrom[id] = null;
  }
  // one fact counted several times, said only when it applies: two dates on the same day of the year (or the same
  // date), or two names made of the same letters. The look-alike pairs use random dates and letters, which seldom do that
  var SAME_DAY = ['Month + Day', 'Day of year', 'Days left in year'];
  function ofN(k, n) { return k === n ? (n === 1 ? 'the one connection' : 'all ' + n + ' connections') : k + ' of the ' + n + ' connections'; }
  function oneFact(a, b, cs) {
    var out = [], n = cs.length, dd = cs.filter(function (c) { return c.type === 'date = date'; }), k, nums = {}, labels;
    var tail = ' can make the pair look rare.';
    if (a.date && b.date && dd.length && a.date === b.date) {
      out.push(note('Both dates are the same day, so every way of adding a date gives the same number for both: ' + ofN(dd.length, n) + (dd.length === 1 ? ' comes' : ' come') +
        ' from that one fact. The look-alike pairs use random dates, which are seldom the same day, so this one fact' + tail));
    } else if (a.date && b.date && dd.length && a.date.slice(5) === b.date.slice(5)) {
      var ra = E.dateNumbers(a.date), rb = E.dateNumbers(b.date), row = function (rs, l) { return rs.filter(function (r) { return r[0] === l; })[0][1]; };
      labels = SAME_DAY.filter(function (l) {
        var v = row(ra, l);
        if (v !== row(rb, l) || !dd.some(function (c) { return c.number === v; })) return false;
        nums[v] = 1;
        return true;
      });
      k = dd.filter(function (c) { return nums[c.number]; }).length;
      if (k) out.push(note('Both dates fall on ' + MONTHS[+a.date.slice(5, 7) - 1] + ' ' + (+a.date.slice(8)) + ', so ' + andList(labels) + (labels.length === 1 ? ' matches' : ' match') + ' from that one fact: ' +
        ofN(k, n) + '. The look-alike pairs use random dates, which seldom share a day of the year, so this one fact' + tail));
    }
    var la = E.letters(a.name).sort().join(''), lb = E.letters(b.name).sort().join('');
    k = cs.filter(function (c) { return c.type === 'name = name'; }).length;
    if (la && la === lb && k) out.push(note('Both names are made of the same letters, so the four core ciphers give them the same totals: ' + ofN(k, n) + (k === 1 ? ' comes' : ' come') +
      ' from that one fact. The look-alike pairs use random letters, which seldom do that, so this one fact' + tail));
    return out.length ? out : null;
  }
  // every pair checked is another try; the counts come from the page's own cut-offs (unusual 5% or less, rare 1% or less)
  function triesLine() {
    var u = E.STRENGTH_EDGES[1], r = E.STRENGTH_EDGES[0], nu = Math.round(1 / u), nr = Math.round(1 / r), pc = function (x) { return Math.round(x * 100) + '%'; };
    return 'Each pair you check is another try. Check ' + nu + ' pairs and about one will look “unusual” or rarer by luck alone (1 in ' + nu + ' is ' + pc(u) +
      '); check ' + nr + ' and about one will look “rare” (1 in ' + nr + ' is ' + pc(r) + ').';
  }
  // now === true (drawUpTo, a jump past this part): the chance check runs to its end before this returns, so the box has
  // its full size (result, luck workings, tries note, and the recap below it) before the scroll starts; any other call
  // (the button, idle) keeps the slices and the progress bar. The answer is the same either way (seed 7, same order)
  function renderConnect(now) {
    var out = $('connOut');
    if (!out) return;
    var an = $('connA').value.trim(), bn = $('connB').value.trim(), ad = $('connAd').value, bd = $('connBd').value;
    if (!an || !bn) { fill(out, h('p', { class: 'note', text: 'Type two names.' })); return; }
    var a = { name: an, date: validDate(ad) ? ad : null }, b = { name: bn, date: validDate(bd) ? bd : null };
    var cs = E.connections(a, b), job = ++connJob, cw = E.connectionWork(a, b);
    var bar = h('div', { class: 'progress', role: 'progressbar', 'aria-label': 'Chance check', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, h('span'));
    var status = h('p', { class: 'note', text: 'Checking 1,500 random look-alike pairs…' });
    var used = function (n, d) { return n + ' (' + (d ? longDate(d) : 'no date') + ')'; };   // the dates that counted
    var box = h('div', { class: 'pair', 'data-coincidence': 'connect' },
      h('h4', { text: used(an, a.date) + ' and ' + used(bn, b.date) + ': ' + cs.length + (cs.length === 1 ? ' connection' : ' connections') }),
      cs.length ? h('ul', null, cs.map(function (c, k) { return workItem(c.text, cw[k] && cw[k].text === c.text ? cw[k] : null); })) : h('p', { text: 'They share no number (names in the four core ciphers, and their dates).' }),
      oneFact(a, b, cs), uncountedNote(an + bn, false), bar, status);
    fill(out, box);
    recapConn = null;
    renderRecap();
    var run = E.chanceRun(a, b, 1500, 7);
    function slice() {
      if (job !== connJob) return;
      var t0 = Date.now();
      while (!run.done() && Date.now() - t0 < 24) run.step(10);
      var p = Math.round(run.progress() * 100);
      bar.firstChild.style.width = p + '%';
      bar.setAttribute('aria-valuenow', String(p));
      if (!run.done()) { setTimeout(slice, 0); return; }
      var r = run.result();
      bar.remove();
      status.replaceWith(chance([h('b', { text: E.pct(r.share) }), ' of 1,500 random look-alike pairs have at least as many connections: ' +
        E.strengthWord(r.share) + '.']));
      box.appendChild(luckWork({ hits: r.ge, days: r.n, share: r.share }, { pair: true }));
      box.appendChild(note(triesLine()));
      recapConn = { a: an, b: bn, share: r.share };
      renderRecap();
    }
    if (now === true) { run.step(run.n); slice(); } else setTimeout(slice, 0);
  }

  // the section's question, answered by the three checks above (the visitor's own pair never changes the answer)
  var recapConn = null;
  function renderRecap() {
    var out = $('recapOut');
    if (!out) return;
    var lib = libShare(), pairs = D.meta.pairs, rare = Math.round(pairs * 0.01), nr = rareCount(), c = recapConn, lp = E.pct(lib.share);
    var word = function (x) { return E.strengthWord(x).split(' ')[0]; };
    fill(out, h('div', { class: 'matches', 'data-coincidence': 'recap' },
      h('p', { text: 'Do dates in history line up more often than luck would? Each part above checks one way:' }),
      h('ul', null,
        h('li', null, h('b', { text: 'On this day: ' }), 'some event lines up on ' + lp + ' of days (about 1 day in ' + E.oneInText(lib.hits, lib.days) + '): ' + word(lib.share) + '.'),
        h('li', null, h('b', { text: 'Strongest connections: ' }), nr + ' of the ' + D.strongest.length + ' pairs listed ' + (nr === 1 ? 'is' : 'are') +
          ' rare (the 20 pairs with the most connections were checked); luck alone makes about ' + rare + ' of the ' + pairs + ' pairs look rare.'),
        h('li', null, h('b', { text: 'Connect two things: ' }), c ? 'for ' + c.a + ' and ' + c.b + ', ' + E.pct(c.share) +
          ' of 1,500 look-alike pairs connect at least as many ways: ' + word(c.share) + '.' : 'checking…')),
      chance(nr <= rare ? ['By these counts, no: some event lines up by luck on ', h('b', { text: lp }), ' of days, and luck alone would make about ' + rare +
        ' of the ' + pairs + ' pairs look rare, while the page found ' + nr + '.'] : ['More rare pairs than luck alone gives; even so, some event lines up by luck on ',
        h('b', { text: lp }), ' of days, and with ' + pairs + ' pairs a few rare ones are expected.'])));
  }

  // ------------------------------------------------------------------------------------- 12 vs 13 (locked) --
  var calCache = {};
  function renderCalendars() {
    var inp = $('calDate'), out = $('calOut');
    if (!inp || !out) return;
    var iso = validDate(inp.value) ? inp.value : TODAY, t = E.thirteenNumbers(iso);
    if (!t.length) { fill(out, h('p', { class: 'note', text: 'Choose a date from March 20, 1900 to March 18, 2052.' })); return; }
    var reg = E.dateNumbers(iso, { system: '12' }), regSet = sameSet(iso), thSet = new Set(t.map(function (r) { return r[1]; }));
    var th = E.thirteenFromDate(iso);
    fill(out, h('div', { 'data-coincidence': 'same' },
      h('p', null, h('b', { text: longDate(iso) }), ' is ', h('b', { text: th.label }), ' (' + th.where + ').'),
      h('div', { class: 'twocol' },
        numTable(reg, { caption: 'Regular calendar', same: thSet }),
        numTable(t, { caption: '13-Month Sky Calendar', same: regSet })),
      sameLines(iso, false),
      sharedLine(TODAY), sharedWork(TODAY)));
    var st = $('calStats');
    if (st) {
      var c = perDay(TODAY);
      var s = sharedCache[TODAY] || (sharedCache[TODAY] = E.sharedShare(TODAY));
      fill(st, h('ul', { class: 'plain' },
        h('li', { class: 'stat' }, 'On average a date gives ', h('span', { class: 'n', text: c.r12.toFixed(1) }), ' different numbers on the regular calendar, ',
          h('span', { class: 'n', text: c.r13.toFixed(1) }), ' on the 13-month calendar, and ', h('span', { class: 'n', text: c.ru.toFixed(1) }),
          ' on the regular calendar plus the Hebrew date (the 1,460 days around today).'),
        h('li', { class: 'stat' }, 'Different numbers: when two ways of adding give the same number it counts once, so eight ways give ',
          h('span', { class: 'n', text: c.r12.toFixed(1) }), ' numbers on average on the regular calendar, not 8.'),
        h('li', { class: 'stat' }, 'The two calendars share at least one number on ', h('span', { class: 'n', text: E.pct(s.share) }),
          ' of days (' + fmt(s.hits) + ' of 1,460).')));
    }
  }
  function renderCalWord() {
    var inp = $('calWord'), out = $('calWordOut');
    if (!inp || !out) return;
    var w = inp.value;
    if (!Object.keys(E.values(w)).length) { fill(out, h('p', { class: 'note', text: 'Type a word with letters A to Z.' })); return; }
    var R = {};
    var rows = [['12', 'Regular calendar'], ['13', '13-Month Sky Calendar'], ['usual', 'Regular calendar plus the Hebrew date']].map(function (s) {
      var r = R[s[0]] = E.dayHitRate(w, TODAY, { system: s[0] });
      return h('tr', null, h('th', { scope: 'row', text: s[1] }), h('td', { class: 'n', text: E.pct(r.share) }),
        h('td', { class: 'how', text: fmt(r.hits) + ' of ' + fmt(r.days) + ' days' }));
    });
    var c = perDay(TODAY), a = E.pct(R['12'].share), b = E.pct(R['13'].share), u = E.pct(R.usual.share), q = '“' + w + '”';
    fill(out, [colNames(h('table', { class: 'nums' }, h('caption', { text: '“' + w + '” matches this share of the 1,460 days around today' }),
      h('thead', null, h('tr', null, h('th', { scope: 'col', text: 'Calendar' }), h('th', { scope: 'col', text: 'Days matched' }), h('th', { scope: 'col', text: 'Count' }))),
      h('tbody', null, rows))),
      h('p', null, 'The last row is the luck check Try a word gives: it uses today’s ten numbers, Hebrew date included, so ' + q + ' matches ' + u +
        ' of days there too (' + fmt(R.usual.hits) + ' of the 1,460 days around today).'),
      h('p', null, Math.abs(R['12'].share - R['13'].share) > 0.02 ? q + ' matches more often on the ' + (R['12'].share > R['13'].share ?
        'regular calendar (' + a + ' against ' + b : '13-month calendar (' + b + ' against ' + a) + '), but with the same eight ways of adding on both, ' +
        'neither calendar starts with more chances.' : 'Neither calendar lines up more often: a date gives ' + c.r12.toFixed(1) +
        ' different numbers on the regular calendar and ' + c.r13.toFixed(1) + ' on the 13-month one, and ' + q + ' matches ' +
        (a === b ? a + ' of days on each.' : a + ' of days on the regular calendar and ' + b + ' on the 13-month one.')),
      h('p', null, R.usual.hits > R['12'].hits ? 'Adding the Hebrew date gives more numbers (' + c.ru.toFixed(1) + ' a date) and more matches (' + u +
        ' for ' + q + '): more numbers simply mean more matches.' : 'Adding the Hebrew date gives more numbers (' + c.ru.toFixed(1) +
        ' a date); for ' + q + ' it adds no matches this time.'),
      mixBox(w, R), uncountedNote(w, false)]);
  }
  // --------------------------------- switches for any mix of calendars, under the word table (added 2026-11-16) --
  // The three calendars a decoder could count (the regular calendar's eight ways, the two Hebrew ways, the 13-month
  // ways), and the share of the 1,460 days around today the word matches with the ones switched on: shares only, no
  // day is listed. The switches keep their place while the page is open; nothing is stored.
  var MIX = [['reg', 'Regular calendar', 'the regular calendar'], ['heb', 'Hebrew date', 'the Hebrew date'], ['th', '13-Month Sky Calendar', 'the 13-Month Sky Calendar']];
  var mixOn = { reg: true, heb: true, th: false }, mixCache = {};
  function mixRate(w, m) {
    var k = TODAY + '\u0000' + w + '\u0000' + !!m.reg + !!m.heb + !!m.th;
    if (!mixCache[k]) { if (Object.keys(mixCache).length > 80) mixCache = {}; mixCache[k] = E.mixRate(w, TODAY, m); }
    return mixCache[k];
  }
  function mixOut(w) {
    var on = MIX.filter(function (x) { return mixOn[x[0]]; }), q = '“' + w + '”', r;
    if (!on.length) return chance(['With no calendar on, a date gives no numbers, so ' + q + ' matches ', h('b', { text: E.pct(0) }), ' of days.']);
    r = mixRate(w, mixOn);
    return [h('div', { class: 'mixbar', 'aria-hidden': 'true' }, h('span', { style: 'width:' + (r.share * 100).toFixed(1) + '%' })),
      chance(['With ' + andList(on.map(function (x) { return x[2]; })) + ', a date gives ' + r.perDay.toFixed(1) + ' different numbers on average, and ' + q +
        ' matches ', h('b', { text: E.pct(r.share) }), ' of days (' + fmt(r.hits) + ' of the ' + fmt(r.days) + ' days around today), so a match on any one day is ' +
        E.strengthWord(r.share) + '.']),
      mixOn.reg && mixOn.heb && !mixOn.th ? note('This is the mix Try a word uses (the last row of the table above).') : null];
  }
  function mixBox(w, R) {
    var out = h('div', { 'aria-live': 'polite' }, mixOut(w)), both = mixRate(w, { reg: true, th: true }), q = '“' + w + '”';
    var sw = MIX.map(function (x) {
      var cb = h('input', { type: 'checkbox', id: 'mix-' + x[0], checked: mixOn[x[0]] });
      cb.addEventListener('change', function () { mixOn[x[0]] = cb.checked; fill(out, mixOut(w)); });
      return h('label', { for: 'mix-' + x[0] }, cb, x[1]);
    });
    return h('div', { class: 'matches mix', 'data-coincidence': 'calendar-mix' }, h('h4', { text: 'Any mix of calendars' }),
      h('p', { text: 'Switch calendars on and off to see how often ' + q + ' matches when a decoder counts the numbers of every calendar that is on.' }),
      h('fieldset', null, h('legend', { text: 'Calendars counted' }), sw), out,
      h('p', { text: both.hits > Math.max(R['12'].hits, R['13'].hits) ? 'A decoder who checks both calendars gets more chances: ' + q + ' matches ' + E.pct(both.share) +
        ' of days on either one, against ' + E.pct(R['12'].share) + ' on the regular calendar alone and ' + E.pct(R['13'].share) + ' on the 13-month one alone. ' +
        'More calendars, more numbers, more matches.' : 'Checking both calendars gives more numbers (' + both.perDay.toFixed(1) + ' a date), though for ' + q +
        ' no more days match this time.' }));
  }

  // ------------------------------------------------------------------------------ How it works (open) --
  // the luck scale: zones as wide as the film's (ordinary 40%, mild 25%, unusual 20%, rare 15%), all in one muted ink;
  // a share's place on it is piecewise by zone (100%..20% | 20%..5% | 5%..1% | 1%..0%)
  var ZONES = [['ordinary', 40], ['mild', 25], ['unusual', 20], ['rare', 15]], EDGES = [1, 0.2, 0.05, 0.01, 0];
  function scalePos(p) {
    for (var i = 0, x = 0; i < 4; x += ZONES[i][1], i++) if (p >= EDGES[i + 1]) return x + ZONES[i][1] * (EDGES[i] - p) / (EDGES[i] - EDGES[i + 1]);
    return 100;
  }
  function scaleBar(share, label) {
    return h('figure', { class: 'scale' }, h('figcaption', { text: 'How often luck alone does the same' }),
      h('div', { class: 'bar', 'aria-hidden': 'true' }, ZONES.map(function (z) { return h('span', { style: 'width:' + z[1] + '%', text: z[0] }); }),
        h('i', { class: 'mk', style: 'left:' + scalePos(share).toFixed(1) + '%' })),
      h('div', { class: 'ticks', 'aria-hidden': 'true' }, ['100%', '20%', '5%', '1%', '0%'].map(function (t, i) { return h('span', { style: 'left:' + scalePos(EDGES[i]) + '%', text: t }); })),
      h('p', { class: 'note mkl', text: label }));
  }
  function renderHow() {
    var out = $('luckOutHow'), abc = $('abcRow');
    if (abc && !abc.dataset.on) {
      abc.dataset.on = '1';
      abc.addEventListener('toggle', function () {
        var b = $('abcOut');
        if (!abc.open || !b || b.firstChild) return;
        b.appendChild(h('table', { class: 'abc' }, h('caption', { text: 'Each letter’s number in the four core ciphers' }),
          h('thead', null, h('tr', null, h('th', { scope: 'col', text: 'Letter' }), E.CORE.map(function (c) { return h('th', { scope: 'col', text: E.NAMES[c] }); }))),
          h('tbody', null, E.alphabetTable().map(function (r) {
            return h('tr', null, h('th', { scope: 'row', text: r[0] }), r.slice(1).map(function (v) { return h('td', { text: String(v) }); }));
          }))));
      });
    }
    if (!out) return;
    var w = E.windowOf(TODAY), g = E.dayHitRate('Gold', TODAY), n = E.oneIn(g.hits, g.days), odd = E.FAMILIAR_ODDS[n], t = E.oneInText(g.hits, g.days);
    var nc = E.CORE.length, nd = E.dateNumbers(TODAY).length, p = E.parse(TODAY);
    fill(out, [h('p', null, 'This page calls it the luck check, or the chance check: how often the same thing happens anyway, by luck alone. How it ' +
      'counts: a word gives ' + nc + ' numbers (the four core ciphers) and a day gives ' + nd + ', so ' + nc + ' × ' + nd + ' = ' + nc * nd + ' pairs are ' +
      'compared. A decoder would welcome a match in any of the ' + nc * nd + ', so a day counts when at least one pair matches. The check counts those ' +
      'days among the ' + fmt(w.days) + ' days around today, which run from ' + longDate(w.start) + ' to ' + longDate(w.end) + ' (4 × 365 = 1,460: about ' +
      'two years before today and two after).'),
      chance(['Today’s count: “Gold” matches ', h('b', { text: E.pct(g.share) }), ' of days (' + fmt(g.hits) + ' of the ' + fmt(g.days) + ' days around today): ' +
        (n === 1 ? 'nearly every day' : 'about 1 day in ' + t) + ' (' + fmt(g.days) + ' ÷ ' + fmt(g.hits) + ' ≈ ' + t + ')' + (odd ? ', like ' + odd : '') + '.']),
      h('ul', { class: 'plain' }, ['More than 20% (more than 1 day in 5): ordinary', '20% or less (1 in 5 or less): mild', '5% or less (about 1 in 20): unusual',
        '1% or less (1 in 100): rare'].map(function (t) { return h('li', { text: t }); })),
      scaleBar(g.share, '“Gold” on ' + MONTHS[p[1] - 1] + ' ' + p[2] + ': ' + E.pct(g.share) + ', ' + E.strengthWord(g.share)),
      grid100(1, '1 in 100: seldom, not never'),
      h('p', { text: 'Even “rare” isn’t a message: it means luck does it seldom, not never, about 1 time in 100.' })]);
  }

  // ---------------------------------------------------------------------------------------- wiring --
  function noSubmit(id, f) { var el = $(id); if (el) el.addEventListener('submit', function (e) { e.preventDefault(); if (f) f(); }); }
  function onInput(id, f, ms) { var el = $(id); if (el) el.addEventListener('input', debounce(f, ms)); }

  // the sections behind the sign-in are drawn the first time they can be seen
  var LOCKED = {
    ciphers: function () { renderCiphers(); },
    dates: function () { renderDates(); renderDateWord(); renderSpan(); },
    meanings: function () { renderMeaning(); renderRecords(); },
    library: function () { renderOnThisDay(); renderOtdDay(); renderEvents(); renderStrongest(); renderMade(); renderRecap(); idle(renderConnect); },
    calendars: function () { renderCalendars(); renderCalWord(); }
  };
  // the same, all at once (for a jump past them: nothing left for later that would grow the page above the target;
  // 2026-11-18: that includes Connect's chance check, whose result made the box about 260 px taller mid-scroll)
  var AT_ONCE = {
    library: function () { renderOnThisDay(); renderOtdDay(); renderEvents(); renderStrongest(); renderMade(); renderRecap(); renderConnect(true); }
  };
  var drawn = {};
  function draw(id, now) {
    if (drawn[id]) return;
    drawn[id] = true;
    try { ((now && AT_ONCE[id]) || LOCKED[id])(); } catch (e) { drawn[id] = false; throw e; }
  }
  // A jump down the page (the menu, an in-page link, the way back after signing in) must land where it aims. The
  // locked parts are drawn the first time they come near the screen, so a jump past them would draw them as it
  // goes (the scroll is smooth) and push its target further down while the scroll is under way: on a phone the
  // menu's "12 vs 13" landed in the middle of Meanings. So before a jump, every locked part above the target (and
  // the target's own part) is drawn at once. Parts that are not shown (signed out) are left alone.
  function drawUpTo(target) {
    if (!target || !target.compareDocumentPosition) return;
    Object.keys(LOCKED).forEach(function (id) {
      var sec = $(id);
      if (!sec || drawn[id] || !sec.getClientRects().length) return;
      if (sec === target || sec.contains(target) || (sec.compareDocumentPosition(target) & 4)) draw(id, true);   // 4: target follows
    });
  }
  function watchLocked() {
    var ids = Object.keys(LOCKED);
    if (!('IntersectionObserver' in window)) { ids.forEach(draw); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { io.unobserve(en.target); draw(en.target.id); } });
    }, { rootMargin: '900px 0px' });
    ids.forEach(function (id) { var el = $(id); if (el) io.observe(el); });
  }
  function redrawAll() {
    renderToday(); renderTry(); renderGame(); renderHow();
    Object.keys(drawn).forEach(function (id) { if (drawn[id]) { if (id === 'meanings') renderMeaning(); else LOCKED[id](); } });
  }
  function setDateDefaults(old) {
    ['dateIn', 'spanB', 'calDate'].forEach(function (id) {
      var el = $(id);
      if (el && (!el.value || el.value === old)) { el.value = TODAY; el.defaultValue = TODAY; }
    });
  }

  // ------------------------------------------------------------------ follow along with the film (?film) --
  // Tapping "Follow along" (or opening the address with ?film) works every part out again for the film's day, and
  // sets each box as the film sets it; "Back to today" does the same for today. Nothing is stored or sent.
  var BOXES = ['tryWord', 'cipherText', 'dateIn', 'dateWord', 'spanA', 'spanB', 'numIn', 'otdDay', 'connA', 'connAd', 'connB', 'connBd', 'calDate', 'calWord'];
  var TODAY_BOXES = { dateIn: 1, spanB: 1, calDate: 1 }, SHIPPED = {};
  function startBoxes() {
    BOXES.forEach(function (id) {
      var el = $(id);
      if (el) el.value = FILM && FILM_BOXES[id] !== undefined ? FILM_BOXES[id] : TODAY_BOXES[id] ? TODAY : SHIPPED[id];
    });
    connRemember();
    syncClears();
  }

  // ------------------------------------------------------------ a clear button in each text box (2026-11-18) --
  // On a phone one tap in a box only places the cursor, so "select the text, then type" needs press-and-hold and
  // Select All; tapping and typing gives "GematriaGold". The button (an ×, named "Clear") empties its box in one tap
  // or click, exactly as deleting the text would (the same input event, so every part works itself out the same way),
  // and leaves the cursor in the box. It shows only while the box holds something.
  var CLEARABLE = ['tryWord', 'cipherText', 'dateWord', 'numIn', 'connA', 'connB', 'calWord'], clears = [];
  function syncClear(c) { c.btn.hidden = !(c.inp.value || (c.inp.validity && c.inp.validity.badInput)); }
  function syncClears() { clears.forEach(syncClear); }
  function addClears() {
    CLEARABLE.forEach(function (id) {
      var inp = $(id);
      if (!inp || !inp.parentNode) return;
      var box = h('span', { class: 'clearbox' }), btn = h('button', { type: 'button', class: 'clearx', 'aria-label': 'Clear', title: 'Clear', 'aria-controls': id });
      var c = { inp: inp, btn: btn };
      inp.parentNode.insertBefore(box, inp);
      box.appendChild(inp);
      box.appendChild(btn);
      btn.addEventListener('mousedown', function (e) { e.preventDefault(); });   // the cursor (and a phone's keyboard) stays in the box
      btn.addEventListener('click', function () {
        inp.value = '';
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        syncClear(c);
        inp.focus();
      });
      inp.addEventListener('input', function () { syncClear(c); });
      inp.addEventListener('change', function () { syncClear(c); });
      clears.push(c);
      syncClear(c);
    });
  }
  function filmNotice(focus) {
    var line = $('filmLine'), bar = $('filmBar'), d = longDate(FILM_DAY), back = function () {
      return h('a', { href: location.pathname + location.hash, 'data-film': 'off', text: 'Back to today' }); };
    document.documentElement.classList.toggle('filmday', FILM);
    if (line) fill(line, FILM ? ['Following the film: every “today” here means ' + d + ', and the boxes hold the film’s examples. ', back(), '.'] :
      ['Watching the film? ', h('a', { href: '?film', 'data-film': 'on', text: 'Follow along with its day, ' + d + '.' })]);
    if (FILM && !bar) document.body.appendChild(bar = h('div', { id: 'filmBar', class: 'filmbar', role: 'region', 'aria-label': 'The film’s day' }, h('p')));
    if (bar) { bar.hidden = !FILM; if (FILM) fill(bar.firstChild, ['Showing ' + d + ', the film’s day. ', back()]); }
    // Proxi-Pals always sends a visitor back to the page's plain address, so signing in ends the film's day. While it is
    // on, say so beside every way in: each join card, and under this line while signed out (site.css shows it only then).
    // Nothing is stored to carry the mode over
    [].slice.call(document.querySelectorAll('.filmsignin')).forEach(function (p) { p.parentNode.removeChild(p); });
    if (FILM) {
      [].forEach.call(document.querySelectorAll('.gemdesk-join'), function (c) {
        var p = h('p', { class: 'sj-small filmsignin', text: FILM_SIGNIN }), a = c.querySelector('.sj-actions');
        if (c.classList.contains('sj-main') && a) a.parentNode.insertBefore(p, a.nextSibling);
        else if (c.firstElementChild) c.firstElementChild.appendChild(p);
      });
      if (line) line.parentNode.insertBefore(h('p', { id: 'filmSignin', class: 'filmsignin', text: FILM_SIGNIN }), line.nextSibling);
    }
    if (focus && line && line.querySelector('a')) line.querySelector('a').focus({ preventScroll: true });
  }
  function setFilm(on, push, focus) {
    if (on === FILM) return;
    if (push) try { history.pushState(null, '', location.pathname + (on ? '?film' : '') + location.hash); } catch (e) {}
    FILM = on;
    TODAY = pageToday();
    startBoxes();
    filmNotice(focus);
    redrawAll();
  }

  function start() {
    BOXES.forEach(function (id) { var el = $(id); if (el) SHIPPED[id] = el.getAttribute('value') || ''; });
    addClears();
    setDateDefaults('');
    if (FILM) { startBoxes(); filmNotice(); } else connRemember();
    var dl = $('eventNames');
    if (dl) EVENTS.forEach(function (e) { dl.appendChild(h('option', { value: e.name })); });
    renderToday();
    renderTry();
    renderGame();
    renderHow();
    noSubmit('tryForm', renderTry); onInput('tryWord', renderTry, 120);
    noSubmit('otdDayForm', renderOtdDay); onInput('otdDay', renderOtdDay, 60);
    noSubmit('cipherForm', renderCiphers); onInput('cipherText', renderCiphers, 160);
    var dateDraw = function () { renderDates(); renderDateWord(); };
    noSubmit('dateForm', dateDraw); onInput('dateIn', dateDraw, 60);
    noSubmit('dateWordForm', renderDateWord); onInput('dateWord', renderDateWord, 160);
    noSubmit('spanForm', renderSpan); onInput('spanA', renderSpan, 60); onInput('spanB', renderSpan, 60);
    noSubmit('numForm', renderMeaning); onInput('numIn', renderMeaning, 120);
    noSubmit('calForm', renderCalendars); onInput('calDate', renderCalendars, 60);
    noSubmit('calWordForm', renderCalWord); onInput('calWord', renderCalWord, 160);
    noSubmit('connForm', renderConnect);
    // choosing one of the events fills in its date; a name typed over an event's name empties the date it left
    ['connA', 'connB'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener('input', function () { connNameTyped(id); });
      el.addEventListener('change', function () {
        var e = eventByName(el.value), d = $(id + 'd');
        if (e && d) { d.value = e.date; connFrom[id] = e.date; }
      });
    });
    // a "No date" button beside each date box (emptying a date box on a phone is fiddly)
    ['connAd', 'connBd'].forEach(function (id, i) {
      var el = $(id);
      if (!el || !el.parentNode) return;
      var line = h('div', { class: 'dateline' }), btn = h('button', { type: 'button', class: 'btn quiet nodate',
        'aria-label': 'No date for the ' + (i ? 'second' : 'first') + ' name', text: 'No date' });
      el.parentNode.insertBefore(line, el);
      line.appendChild(el);
      line.appendChild(btn);
      btn.addEventListener('click', function () { el.value = ''; connFrom[i ? 'connB' : 'connA'] = connGone[i ? 'connB' : 'connA'] = null; });
      el.addEventListener('input', function () { connGone[i ? 'connB' : 'connA'] = null; });
    });
    watchLocked();
    // in-page links (the menu, "All 12 ciphers", "Privacy and terms"): draw what lies above the target first
    // (the sign-in's own handler runs before this one and stops the links into locked parts while signed out)
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var f = e.target && e.target.closest ? e.target.closest('a[data-film]') : null;
      if (f) { e.preventDefault(); setFilm(f.getAttribute('data-film') === 'on', true, true); return; }
      var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
      var id = a ? a.getAttribute('href').slice(1) : '';
      if (id) drawUpTo(document.getElementById(id));
    });
    // Back and Forward between the film's day and today
    window.addEventListener('popstate', function () { var f = filmInAddress(); if (f !== FILM) setFilm(f, false); });
    // a new day while the tab was in the background: work today's numbers out again (the film's day never changes)
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      var now = pageToday();
      if (now !== TODAY) { var old = TODAY; TODAY = now; setDateDefaults(old); redrawAll(); }
    });
    // drawUpTo is also called by the sign-in (gate.js) right before it scrolls back to the part someone wanted
    window.GemDesk = { today: function () { return TODAY; }, film: function () { return FILM; }, draw: draw, drawn: drawn, drawUpTo: drawUpTo };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
