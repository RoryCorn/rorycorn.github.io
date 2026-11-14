/* 13-Month Sky Calendar website: the free Proxi-Pals sign-in (a soft lock, not a real one).
 *
 * Open to everyone: today's 13-month date, "What's your birthday in the 13-month calendar?", the year wheel,
 * How it works, Privacy and the footer. The five sections build_site.py marks class="needs-account" (#calendar,
 * #chart, #retro, #precession, #compare) show a join card instead until this browser has signed in, and a slim
 * line at the top says "Free with a Proxi-Pals account · Join free · Sign in".
 *
 * How signing in works: the card's "Join Proxi-Pals, free" and "Sign in" buttons open Proxi-Pals' own page in this
 * tab (?then=sky-calendar), so the email and password are only ever typed there. Proxi-Pals then sends the person
 * back here with #pp=<one-time code> (32 hex characters, works once, lasts 2 minutes). This script:
 *   - wipes #pp=... from the address at once, before Umami's script (deferred) loads and records the address;
 *   - asks Proxi-Pals once whether the code is good: POST {code} to /api/pass/redeem on a host fixed by this
 *     page's own host (https://proxipals.onrender.com, or http://localhost:3117 when served from this Mac),
 *     never taken from the link;
 *   - then keeps "skycal-pass" = {"exp": <time>} in localStorage for 30 days. That is all it keeps: no name,
 *     email or token. "Sign out of the calendar" removes it.
 * While someone goes to sign in, this tab (sessionStorage "skycal-want") remembers which part they wanted and the
 * date they typed in the converter, so it can take them back there. Nothing of it is ever sent.
 * Counts (Umami, with umami.track(); never the data-umami-event attribute, which swallows clicks):
 *   "Join tapped" {where}, "Sign in tapped" {where}, "App Store tapped", "Opened with Proxi-Pals".
 * It fails open: if this file does not load or throws, the class is never set and the whole calendar shows.
 * Loaded with a plain <script> in the head, right after the Search Console tag, so the page's class is set
 * before anything is drawn (no flash of the cards or of the locked sections).
 *
 * OFF SWITCH: set GATE_ON = false below, rebuild (python3 build_site.py) and publish: the calendar is open to all
 * again. Change it here, not only in the published copy, or the next rebuild undoes it. */
var GATE_ON = true;

(function () {
  'use strict';
  var PASS_KEY = 'skycal-pass', WANT_KEY = 'skycal-want', DAY = 864e5, PASS_DAYS = 30;
  var LOCKED = ['calendar', 'chart', 'retro', 'precession', 'compare'];
  var root = document.documentElement;
  var code = null, badCode = false;

  // (a) the one-time code: read it, then wipe it from the address bar (also when the switch is off).
  // Returns the code, '' for a #pp= that is not one, or null when the address has none.
  function takeCode() {
    var m = /^#pp=(.*)$/.exec(location.hash || '');
    if (!m) return null;
    try { history.replaceState(history.state, '', location.pathname + location.search); }
    catch (e) { /* the address keeps the code; it works only once anyway */ }
    return /^[0-9a-f]{32}$/i.test(m[1]) ? m[1].toLowerCase() : '';
  }
  try {
    code = takeCode();
    if (code === '') { code = null; badCode = true; }
  } catch (e) {}

  if (!GATE_ON) {
    window.addEventListener('hashchange', function () { try { takeCode(); } catch (e) {} });
    return;
  }

  var host = location.hostname;
  var LOCAL = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  var PP = LOCAL ? 'http://localhost:3117' : 'https://proxipals.onrender.com';
  var THEN = /\/eastern\//.test(location.pathname) ? 'sky-calendar-eastern' : 'sky-calendar';
  var IOS = /iPhone|iPad|iPod/.test(navigator.userAgent || '') ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var STATES = ['skycal-open', 'skycal-gated', 'skycal-checking'];

  var CSS = [
    '.skycal-join [hidden],.skycal-bar [hidden]{display:none!important}',
    // gated: the five sections are gone and their cards show; checking a code: the sections keep their place
    // (so the page lays them out at their real size) but stay invisible until Proxi-Pals answers
    'html.skycal-gated .needs-account{display:none!important}',
    'html.skycal-gated .skycal-join{display:block}',
    'html.skycal-gated .skycal-join.sj-compact{display:grid}',
    'html.skycal-checking .needs-account{visibility:hidden}',
    // the bar at the top: one line for each state (signed in, being checked, signed out)
    'html.skycal-open .skycal-bar,html.skycal-checking .skycal-bar,html.skycal-gated .skycal-bar{display:block}',
    '.skycal-bar{margin:0 0 18px;padding-bottom:10px;border-bottom:1px solid var(--line);font-size:.84rem;color:var(--muted)}',
    '.skycal-bar p{margin:0;display:none;flex-wrap:wrap;align-items:baseline;gap:2px 0}',
    'html.skycal-open .skycal-bar p.skycal-bar-open,html.skycal-gated .skycal-bar p.skycal-bar-gated{display:flex}',
    'html.skycal-checking .skycal-bar p.skycal-bar-checking{display:block}',
    'html.skycal-gated .skycal-bar p.skycal-bar-msg{display:block;margin-top:6px;color:var(--ink);outline:none}',
    '.skycal-bar-msg a{color:var(--sky);text-underline-offset:3px}',
    '.skycal-bar span[aria-hidden]{margin:0 .55em}',
    '.skycal-bar a,.skycal-bar button{color:var(--sky);text-underline-offset:3px;font:inherit;padding:0;border:0;background:none;cursor:pointer;text-decoration:underline}',
    '.skycal-bar a:hover,.skycal-bar button:hover{color:var(--ink)}',
    // the join cards
    '.skycal-join{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:26px 26px 22px;scroll-margin-top:16px;min-width:0}',
    '.skycal-join.sj-main{border-color:var(--accent);box-shadow:inset 4px 0 0 var(--accent)}',
    '.skycal-join h2{font-size:clamp(1.7rem,4vw,2.3rem);line-height:1.12;margin:4px 0 10px;outline:none}',
    '.skycal-join p{margin:0 0 8px;max-width:62ch}',
    '.skycal-join .sj-small{font-size:.88rem;color:var(--muted)}',
    '.skycal-join .sj-fine{font-size:.8rem;color:var(--muted);margin:14px 0 0;padding-top:12px;border-top:1px solid var(--line)}',
    '.skycal-join .sj-small a{color:var(--sky);text-underline-offset:3px}',
    '.sj-actions{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0 10px}',
    '.sj-btn{display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;min-height:44px;padding:9px 18px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);font:600 .95rem/1.2 var(--f-body);text-decoration:none;cursor:pointer}',
    '.sj-btn:hover{border-color:var(--ink)}',
    '.sj-btn.sj-primary{background:var(--accent);border-color:var(--accent);color:var(--surface)}',
    '.sj-btn.sj-primary:hover{filter:brightness(1.08)}',
    '.skycal-msg{font-weight:600;color:var(--ink);background:var(--accent-soft);border-radius:6px;padding:8px 12px}',
    '.skycal-msg button{font:inherit;font-weight:600;color:var(--sky);background:none;border:0;padding:0;text-decoration:underline;text-underline-offset:3px;cursor:pointer}',
    // the three small cards: name of the section beside the buttons, close together
    '.skycal-join.sj-compact{grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:4px 24px;padding:18px 22px}',
    '.skycal-join.sj-compact h2{font-size:1.45rem;margin:2px 0 2px}',
    '.skycal-join.sj-compact p{margin:0}',
    '.skycal-join.sj-compact p.sj-small{margin-top:4px}',
    '.sj-nw{white-space:nowrap}',
    '.skycal-join.sj-compact .sj-actions{margin:0}',
    '.skycal-join.sj-compact .skycal-msg{grid-column:1/-1;margin-top:8px}',
    'html.skycal-gated .skycal-join.sj-compact+.needs-account+.skycal-join.sj-compact{margin-top:-36px}',
    '.skycal-join.sj-flash{animation:sj-flash 1.2s ease-out}',
    '@keyframes sj-flash{0%{box-shadow:0 0 0 3px var(--accent)}100%{box-shadow:0 0 0 3px transparent}}',
    '@media (max-width:620px){.skycal-join{padding:20px 18px 18px}.skycal-join.sj-compact{grid-template-columns:minmax(0,1fr)}' +
      '.sj-actions .sj-btn{flex:1 1 auto}}',
    '@media (prefers-reduced-motion:reduce){.skycal-join.sj-flash{animation:none}}'
  ].join('\n');

  function setState(s) {
    for (var i = 0; i < STATES.length; i++) root.classList.remove(STATES[i]);
    if (s) root.classList.add('skycal-' + s);
  }
  function is(s) { return root.classList.contains('skycal-' + s); }
  function failOpen() { try { setState(null); } catch (e) {} }

  function readPass() {
    try {
      var p = JSON.parse(localStorage.getItem(PASS_KEY) || 'null');
      return !!p && typeof p.exp === 'number' && p.exp > Date.now();
    } catch (e) { return false; }
  }
  function savePass(days) {
    var d = typeof days === 'number' && days >= 1 && days <= PASS_DAYS ? days : PASS_DAYS;
    try { localStorage.setItem(PASS_KEY, JSON.stringify({ exp: Date.now() + d * DAY })); } catch (e) { /* open for this visit only */ }
  }

  function readWant() {
    try {
      var w = JSON.parse(sessionStorage.getItem(WANT_KEY) || 'null');
      if (w && typeof w.t === 'number' && Date.now() - w.t < 6 * 3600e3) return w;
    } catch (e) {}
    return null;
  }
  function saveWant(where, date) {
    try {
      var w = readWant() || {};
      if (LOCKED.indexOf(where) >= 0) w.where = where;
      if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) w.date = date;
      w.t = Date.now();
      sessionStorage.setItem(WANT_KEY, JSON.stringify(w));
    } catch (e) {}
  }
  function clearWant() { try { sessionStorage.removeItem(WANT_KEY); } catch (e) {} }

  // Umami: false when its script is not there (blocked, or not loaded yet); else true or its promise
  function track(name, data) {
    try {
      var u = window.umami;
      if (u && typeof u.track === 'function') {
        var p = data ? u.track(name, data) : u.track(name);
        return p && typeof p.then === 'function' ? p : true;
      }
    } catch (e) { return true; }
    return false;
  }
  function trackSoon(name, tries) {   // for a count that can come before Umami's deferred script has run
    if (track(name) || (tries || 0) >= 40) return;
    setTimeout(function () { trackSoon(name, (tries || 0) + 1); }, 250);
  }

  // (e) the redeem call: {ok:true} | {ok:false, used:true} (spent, expired or made up) | {ok:false} (no answer)
  function redeem(c) {
    if (typeof fetch !== 'function') return Promise.resolve({ ok: false });
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 15000) : 0;
    return fetch(PP + '/api/pass/redeem', {
      method: 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: c }), signal: ctl ? ctl.signal : undefined
    }).then(function (r) {
      clearTimeout(timer);
      if (r.ok) return r.json().then(function (j) { return j && j.ok === true ? { ok: true, days: j.days } : { ok: false, used: true }; },
        function () { return { ok: false }; });
      return { ok: false, used: r.status === 400 || r.status === 401 || r.status === 410 };
    }, function () { clearTimeout(timer); return { ok: false }; });
  }

  // ------------------------------------------------------------------ before the page is drawn --
  var pending = null;
  try {
    var st = document.createElement('style');
    st.id = 'skycal-gate-css';
    st.textContent = CSS;
    (document.head || root).appendChild(st);
    var hadPass = readPass();
    setState(hadPass ? 'open' : code ? 'checking' : 'gated');
    if (code) pending = redeem(code).then(function (r) { r.hadPass = hadPass; return r; });
  } catch (e) {
    failOpen();
    return;
  }

  // ------------------------------------------------------------------------- once the page is there --
  var typed = false;
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  function cardFor(where) {
    return document.querySelector('.skycal-join[data-where="' + where + '"]') ||
      document.querySelector('.skycal-join[data-where="calendar"]');
  }
  function lockedFor(id) {   // the locked section an in-page link points into, if any
    if (!id) return null;
    if (LOCKED.indexOf(id) >= 0) return id;
    var el = document.getElementById(id), sec = el && el.closest ? el.closest('.needs-account') : null;
    return sec && LOCKED.indexOf(sec.id) >= 0 ? sec.id : null;
  }
  function showCard(where, flash) {
    var card = cardFor(where);
    if (!card) return;
    card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    var h = card.querySelector('h2');
    if (h && h.focus) try { h.focus({ preventScroll: true }); } catch (e) {}
    if (flash) { card.classList.remove('sj-flash'); void card.offsetWidth; card.classList.add('sj-flash'); }
  }
  // the name as text that never breaks at its own hyphen (.sj-nw: white-space nowrap)
  function brand() {
    var s = document.createElement('span');
    s.className = 'sj-nw';
    s.textContent = 'Proxi-Pals';
    return s;
  }
  function message(where, used) {
    var all = document.querySelectorAll('.skycal-msg');
    for (var i = 0; i < all.length; i++) { all[i].hidden = true; all[i].textContent = ''; }
    var card = cardFor(where), box = card && card.querySelector('.skycal-msg');
    if (!box) return;
    // the status box is shown empty first and filled a moment later: a screen reader announces a change to a
    // status it can already see, but often not one that appears with its text already in it
    box.hidden = false;
    var fill = function () {
      box.textContent = '';
      if (used) box.textContent = 'That sign-in link has already been used or has expired. Please sign in again.';
      else {
        box.appendChild(document.createTextNode('Couldn’t reach '));
        box.appendChild(brand());
        box.appendChild(document.createTextNode('. '));
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('data-skycal', 'retry');
        b.textContent = 'Try again';
        box.appendChild(b);
      }
    };
    box.textContent = '';
    setTimeout(fill, 50);
  }
  // after "Sign out of the calendar": say so, and point out that Proxi-Pals itself may still remember this browser
  function signedOutNote() {
    var box = document.querySelector('.skycal-bar-msg');
    if (!box) return;
    box.textContent = '';
    box.hidden = false;
    try { box.focus({ preventScroll: true }); } catch (e) {}
    setTimeout(function () {
      box.textContent = '';
      box.appendChild(document.createTextNode('Signed out of the calendar. On a shared computer, also '));
      var a = document.createElement('a');
      a.href = PP + '/?then=' + THEN;
      a.appendChild(document.createTextNode('sign out of '));
      a.appendChild(brand());
      box.appendChild(a);
      box.appendChild(document.createTextNode('.'));
    }, 50);
  }
  function hideNote() { var box = document.querySelector('.skycal-bar-msg'); if (box) { box.hidden = true; box.textContent = ''; } }
  function typedDate() {
    var i = document.getElementById('lookup');
    return typed && i && /^\d{4}-\d{2}-\d{2}$/.test(i.value) ? i.value : null;
  }
  function whenLoaded(f) {
    if (document.readyState === 'complete') setTimeout(f, 0);
    else window.addEventListener('load', function () { setTimeout(f, 0); });
  }

  // after a good code: back to the part they wanted (and the date they typed), if this tab remembers one
  function restoreWant() {
    var w = readWant();
    clearWant();
    if (!w || LOCKED.indexOf(w.where) < 0) return;
    whenLoaded(function () {
      var inp = document.getElementById('lookup'), form = document.getElementById('lookupForm');
      if (w.where === 'calendar' && w.date && inp && form) {
        inp.value = w.date;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        if (form.requestSubmit) { form.requestSubmit(); return; }
      }
      var el = document.getElementById(w.where);
      if (!el) return;
      var moved = false, mark = function () { moved = true; };
      ['wheel', 'touchstart', 'keydown'].forEach(function (t) { window.addEventListener(t, mark, { once: true, passive: true }); });
      el.scrollIntoView({ behavior: 'auto', block: 'start' });
      // sections drawn on demand (retrograde, equinox, calendars) can change the page above once they appear
      setTimeout(function () { if (!moved && Math.abs(el.getBoundingClientRect().top - 16) > 40) el.scrollIntoView({ behavior: 'auto', block: 'start' }); }, 900);
    });
  }

  function settle(r) {
    if (r.ok) {
      savePass(r.days);
      hideNote();
      setState('open');
      trackSoon('Opened with Proxi-Pals');
      restoreWant();
      return;
    }
    if (r.hadPass) return;   // a spent link, but this browser is already signed in
    setState('gated');
    var w = readWant(), where = w && w.where ? w.where : 'calendar';
    message(where, !!r.used);
    whenLoaded(function () { showCard(where, false); });
  }

  // a plain link that is also counted: wait (briefly) for Umami before leaving the page
  function countAndGo(e, a, name, data) {
    var p = track(name, data);
    if (!p || typeof p.then !== 'function' || e.defaultPrevented || e.button !== 0 ||
        e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') return;
    e.preventDefault();
    var href = a.href, gone = false, go = function () { if (!gone) { gone = true; location.href = href; } };
    p.then(go, go);
    setTimeout(go, 400);
  }

  function wire() {
    // links: Proxi-Pals on this page's own Proxi-Pals host (localhost:3117 when served from this Mac)
    var links = document.querySelectorAll('[data-skycal]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i], k = a.getAttribute('data-skycal');
      if (k === 'join') a.href = PP + '/?then=' + THEN + '&tab=join';
      else if (k === 'signin') a.href = PP + '/?then=' + THEN;
      else if (k === 'open') a.href = PP + '/';
    }
    if (IOS) { var ios = document.querySelectorAll('.skycal-ios'); for (var j = 0; j < ios.length; j++) ios[j].hidden = false; }
    var lk = document.getElementById('lookup');
    if (lk) lk.addEventListener('input', function (e) { if (e.isTrusted) typed = true; });

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var a = t.closest('[data-skycal]');
      if (a) {
        var k = a.getAttribute('data-skycal'), card = a.closest('.skycal-join');
        // the line at the top of the page counts as "top"; it remembers a typed date but no section
        var where = card ? card.getAttribute('data-where') : a.closest('.skycal-bar') ? 'top' : 'calendar';
        if (k === 'join' || k === 'signin') {
          saveWant(where, typedDate());
          countAndGo(e, a, k === 'join' ? 'Join tapped' : 'Sign in tapped', { where: where });
        } else if (k === 'app') {
          saveWant(where, typedDate());
          countAndGo(e, a, 'App Store tapped');
        } else if (k === 'signout') {
          e.preventDefault();
          try { localStorage.removeItem(PASS_KEY); } catch (err) {}
          setState('gated');
          signedOutNote();
        } else if (k === 'retry' && code) {
          e.preventDefault();
          var box = a.closest('.skycal-msg');
          if (box) box.textContent = 'Opening the calendar…';
          redeem(code).then(settle);
        }
        return;
      }
      if (!is('gated')) return;
      // the year wheel's months, and in-page links into a locked section: show its card instead
      if (t.closest('#wheel [data-m]')) {
        e.preventDefault(); e.stopPropagation();
        saveWant('calendar');
        showCard('calendar', true);
        return;
      }
      var l = t.closest('a[href^="#"]'), where2 = l ? lockedFor(l.getAttribute('href').slice(1)) : null;
      if (where2) { e.preventDefault(); saveWant(where2); showCard(where2, true); }
    }, true);

    // "Show in calendar" while signed out: remember the date, show the card
    document.addEventListener('submit', function (e) {
      if (!is('gated') || !e.target || e.target.id !== 'lookupForm') return;
      e.preventDefault(); e.stopPropagation();
      var inp = document.getElementById('lookup');
      saveWant('calendar', inp && inp.value);
      showCard('calendar', true);
    }, true);

    // came back with the Back button after signing in elsewhere
    window.addEventListener('pageshow', function (e) { if (e.persisted && is('gated') && readPass()) setState('open'); });
    // a return link opened on top of this page (only the part after # changed, so the page did not load again)
    window.addEventListener('hashchange', function () {
      try {
        var c = takeCode();
        if (c === null) return;
        if (c === '') { if (!is('open')) { setState('gated'); message('calendar', true); showCard('calendar', false); } return; }
        code = c;
        var had = is('open');
        if (!had) setState('checking');
        redeem(c).then(function (r) { r.hadPass = had; settle(r); });
      } catch (e) { failOpen(); }
    });

    if (badCode && !is('open')) {
      setState('gated');
      message('calendar', true);
      whenLoaded(function () { showCard('calendar', false); });
    } else if (is('gated')) {
      var where3 = lockedFor((location.hash || '').slice(1));
      if (where3) whenLoaded(function () { showCard(where3, false); });
    }
    if (pending) pending.then(settle);
  }

  function ready() { try { wire(); } catch (e) { failOpen(); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
