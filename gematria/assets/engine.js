/* Gematria Desk engine: a plain-JavaScript copy of the arithmetic rules in ~/git/gematria/gem/ (ciphers, dates,
 * hebrew, thirteen, numbers, connect), worked out on the visitor's own device. No page code, no Date objects:
 * dates are 'YYYY-MM-DD' strings and day numbers (0001-01-01 = 1, the usual proleptic day count).
 * Every output matches the private desk's exactly (same order, same strings); test/parity.mjs proves it.
 * GemEngine.load(GEM_DATA) gives it the data the build ships in data.js. */
(function (root) {
  'use strict';

  // ------------------------------------------------------------------------------------------- ciphers --
  var A = 'abcdefghijklmnopqrstuvwxyz';
  function ordC(c) { return A.indexOf(c) + 1; }
  function revC(c) { return 27 - ordC(c); }
  function digitSum(n) {
    var s = String(Math.abs(n)), t = 0;
    for (var i = 0; i < s.length; i++) t += s.charCodeAt(i) - 48;
    return t;
  }
  function reduceFull(n) { while (n > 9) n = digitSum(n); return n; }

  function table(keys, vals) { var o = {}; for (var i = 0; i < keys.length; i++) o[keys[i]] = vals[i]; return o; }
  var CHALDEAN = table(A.split(''), [1, 2, 3, 4, 5, 8, 3, 5, 1, 1, 2, 3, 4, 5, 7, 8, 1, 2, 3, 4, 6, 6, 6, 5, 1, 7]);
  var JEWISH = table('abcdefghiklmnopqrstuxyzjvw'.split(''),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400, 500, 600, 700, 900]);
  var EXTENDED = table(A.split(''), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 60, 70, 80, 90,
    100, 200, 300, 400, 500, 600, 700, 800]);

  // name, short code, plain description, per-letter rule (the four core ciphers first)
  var ENGLISH = [
    ['English Ordinal', 'EO', 'A=1, B=2 ... Z=26', ordC],
    ['Full Reduction', 'FR', 'each letter’s number reduced to one digit (S=19 -> 1)', function (c) { return reduceFull(ordC(c)); }],
    ['Reverse Ordinal', 'RO', 'Z=1, Y=2 ... A=26', revC],
    ['Reverse Full Reduction', 'RFR', 'reverse number reduced to one digit', function (c) { return reduceFull(revC(c)); }],
    ['Single Reduction', 'SR', 'like Full Reduction but S stays 10', function (c) { return digitSum(ordC(c)); }],
    ['Reverse Single Reduction', 'RSR', 'like Reverse Full Reduction but H stays 10', function (c) { return digitSum(revC(c)); }],
    ['Sumerian', 'SUM', 'English Ordinal x 6 (A=6, B=12 ...)', function (c) { return ordC(c) * 6; }],
    ['Reverse Sumerian', 'RSUM', 'Reverse Ordinal x 6', function (c) { return revC(c) * 6; }],
    ['Satanic', 'SAT', 'English Ordinal + 35 per letter (A=36)', function (c) { return ordC(c) + 35; }],
    ['Chaldean', 'CHA', 'old Babylonian-style table, no 9s', function (c) { return CHALDEAN[c]; }],
    ['Jewish', 'JEW', 'Latin-alphabet version of the Hebrew values (Agrippa)', function (c) { return JEWISH[c]; }],
    ['English Extended', 'EXT', 'A-I = 1-9, J-R = 10-90, S-Z = 100-800', function (c) { return EXTENDED[c]; }]
  ];
  var CORE = ['EO', 'FR', 'RO', 'RFR'];
  var CODES = ENGLISH.map(function (c) { return c[1]; });
  var BY_CODE = {};
  ENGLISH.forEach(function (c) { BY_CODE[c[1]] = c; });
  var NAMES = {};
  ENGLISH.forEach(function (c) { NAMES[c[1]] = c[0]; });
  NAMES.HEB = 'Hebrew Standard';
  NAMES.GRK = 'Greek Isopsephy';

  var HEB = {
    'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8,
    'ט': 9, 'י': 10, 'כ': 20, 'ל': 30, 'מ': 40, 'נ': 50, 'ס': 60,
    'ע': 70, 'פ': 80, 'צ': 90, 'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400,
    'ך': 20, 'ם': 40, 'ן': 50, 'ף': 80, 'ץ': 90
  };
  var GRK = {
    'α': 1, 'β': 2, 'γ': 3, 'δ': 4, 'ε': 5, 'ϛ': 6, 'ζ': 7, 'η': 8,
    'θ': 9, 'ι': 10, 'κ': 20, 'λ': 30, 'μ': 40, 'ν': 50, 'ξ': 60,
    'ο': 70, 'π': 80, 'ϙ': 90, 'ρ': 100, 'σ': 200, 'ς': 200, 'τ': 300,
    'υ': 400, 'φ': 500, 'χ': 600, 'ψ': 700, 'ω': 800, 'ϡ': 900
  };
  var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };

  // lower-case, keep only a-z (code point by code point)
  function letters(text) {
    var out = [], cs = Array.from(String(text).toLowerCase());
    for (var i = 0; i < cs.length; i++) if (cs[i].length === 1 && A.indexOf(cs[i]) >= 0) out.push(cs[i]);
    return out;
  }
  function value(text, code) {
    var f = BY_CODE[code][3], ls = letters(text), t = 0;
    for (var i = 0; i < ls.length; i++) t += f(ls[i]);
    return t;
  }
  function breakdown(text, code) {
    var f = BY_CODE[code][3];
    return letters(text).map(function (c) { return [c.toUpperCase(), f(c)]; });
  }
  // {code: total} for the chosen ciphers (CORE by default); empty when the text has no a-z letters
  function values(text, codes) {
    codes = codes && codes.length ? codes : CORE;
    var out = {};
    if (!letters(text).length) return out;
    for (var i = 0; i < codes.length; i++) out[codes[i]] = value(text, codes[i]);
    return out;
  }
  function scriptLetters(text, which) {
    var plain = String(text).normalize('NFD');
    if (which === 'GRK') plain = plain.toLowerCase();
    var map = which === 'GRK' ? GRK : HEB, out = [];
    Array.from(plain).forEach(function (c) { if (has(map, c)) out.push([c, map[c]]); });
    return out;
  }
  function allValues(text) {
    var out = values(text, CODES);
    var h = scriptLetters(text, 'HEB'), g = scriptLetters(text, 'GRK');
    if (h.length) out.HEB = h.reduce(function (s, x) { return s + x[1]; }, 0);
    if (g.length) out.GRK = g.reduce(function (s, x) { return s + x[1]; }, 0);
    return out;
  }
  // 'G7 + O15 + L12 + D4 = 38'
  function explain(text, code) {
    var parts = breakdown(text, code), sum = 0;
    parts.forEach(function (p) { sum += p[1]; });
    return parts.map(function (p) { return p[0] + p[1]; }).join(' + ') + ' = ' + sum;
  }

  // --------------------------------------------------------------------------------------- day numbers --
  var DIM = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var DBM = [0, 0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  function isLeap(y) { return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0); }
  function monthLen(y, m) { return m === 2 && isLeap(y) ? 29 : DIM[m]; }
  function fdiv(a, b) { return Math.floor(a / b); }
  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
  function iso(y, m, d) { return pad(y, 4) + '-' + pad(m, 2) + '-' + pad(d, 2); }
  var ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  function parse(s) {
    var m = ISO_RE.exec(String(s).trim());
    if (!m) throw new Error('can’t read date ' + s + '; use YYYY-MM-DD');
    var y = +m[1], mo = +m[2], d = +m[3];
    if (y < 1 || mo < 1 || mo > 12 || d < 1 || d > monthLen(y, mo)) throw new Error('not a date: ' + s);
    return [y, mo, d];
  }
  function isDate(s) { try { parse(s); return true; } catch (e) { return false; } }
  function ordYMD(y, m, d) {
    var p = y - 1;
    return p * 365 + fdiv(p, 4) - fdiv(p, 100) + fdiv(p, 400) + DBM[m] + (m > 2 && isLeap(y) ? 1 : 0) + d;
  }
  function toOrdinal(s) { var p = parse(s); return ordYMD(p[0], p[1], p[2]); }
  // day number -> year, month, day (the standard 400/100/4/1-year cycle method)
  var DI400Y = 146097, DI100Y = 36524, DI4Y = 1461;
  function ymdFromOrdinal(n) {
    n -= 1;
    var n400 = fdiv(n, DI400Y); n -= n400 * DI400Y;
    var year = n400 * 400 + 1;
    var n100 = fdiv(n, DI100Y); n -= n100 * DI100Y;
    var n4 = fdiv(n, DI4Y); n -= n4 * DI4Y;
    var n1 = fdiv(n, 365); n -= n1 * 365;
    year += n100 * 100 + n4 * 4 + n1;
    if (n1 === 4 || n100 === 4) return [year - 1, 12, 31];
    var leap = n1 === 3 && (n4 !== 24 || n100 === 3);
    var month = (n + 50) >> 5;
    var preceding = DBM[month] + (month > 2 && leap ? 1 : 0);
    if (preceding > n) { month -= 1; preceding -= DIM[month] + (month === 2 && leap ? 1 : 0); }
    return [year, month, n - preceding + 1];
  }
  function fromOrdinal(n) { var p = ymdFromOrdinal(n); return iso(p[0], p[1], p[2]); }
  function weekday(s) { return (toOrdinal(s) + 6) % 7; }   // Monday = 0
  function addDays(s, k) { return fromOrdinal(toOrdinal(s) + k); }
  var WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // ------------------------------------------------------------------------------------------- hebrew --
  // floating-point floor division done the same careful way as gem/hebrew.py's year estimate
  function pyFloorDiv(vx, wx) {
    var mod = vx % wx, div = (vx - mod) / wx;
    if (mod && ((wx < 0) !== (mod < 0))) { mod += wx; div -= 1; }
    var fl;
    if (div) { fl = Math.floor(div); if (div - fl > 0.5) fl += 1; } else fl = 0;
    return fl;
  }
  var EPOCH = -1373427;
  var HMONTHS = { 1: 'Nisan', 2: 'Iyar', 3: 'Sivan', 4: 'Tammuz', 5: 'Av', 6: 'Elul', 7: 'Tishri',
    8: 'Heshvan', 9: 'Kislev', 10: 'Tevet', 11: 'Shevat', 12: 'Adar', 13: 'Adar II' };
  function hLeap(y) { return ((7 * y + 1) % 19 + 19) % 19 < 7; }
  function elapsed(y) {
    var months = fdiv(235 * y - 234, 19);
    var parts = 12084 + 13753 * months;
    var day = 29 * months + fdiv(parts, 25920);
    return (((3 * (day + 1)) % 7) + 7) % 7 < 3 ? day + 1 : day;
  }
  function correction(y) {
    var ny0 = elapsed(y - 1), ny1 = elapsed(y), ny2 = elapsed(y + 1);
    if (ny2 - ny1 === 356) return 2;
    if (ny1 - ny0 === 382) return 1;
    return 0;
  }
  var nyCache = {};
  function newYear(y) {
    var v = nyCache[y];
    if (v === undefined) v = nyCache[y] = EPOCH + elapsed(y) + correction(y);
    return v;
  }
  function yearDays(y) { return newYear(y + 1) - newYear(y); }
  function hMonthDays(m, y) {
    if (m === 2 || m === 4 || m === 6 || m === 10 || m === 13) return 29;
    if (m === 12 && !hLeap(y)) return 29;
    var yd;
    if (m === 8) { yd = yearDays(y); if (yd !== 355 && yd !== 385) return 29; }
    if (m === 9) { yd = yearDays(y); if (yd === 353 || yd === 383) return 29; }
    return 30;
  }
  function lastMonth(y) { return hLeap(y) ? 13 : 12; }
  function toFixed(y, m, d) {
    var n = newYear(y) + d - 1, i;
    if (m < 7) {
      for (i = 7; i <= lastMonth(y); i++) n += hMonthDays(i, y);
      for (i = 1; i < m; i++) n += hMonthDays(i, y);
    } else {
      for (i = 7; i < m; i++) n += hMonthDays(i, y);
    }
    return n;
  }
  function hebrewFromOrdinal(fixed) {
    var approx = pyFloorDiv(fixed - EPOCH, 35975351 / 98496) + 1;
    var y = approx - 1;
    while (newYear(y + 1) <= fixed) y += 1;
    var start = fixed < toFixed(y, 1, 1) ? 7 : 1;
    var m = start;
    while (fixed > toFixed(y, m, hMonthDays(m, y))) m += 1;
    var d = fixed - toFixed(y, m, 1) + 1;
    var name = HMONTHS[m];
    if (m === 12 && hLeap(y)) name = 'Adar I';
    return [y, m, d, name];
  }
  function hebrewFromDate(s) { return hebrewFromOrdinal(toOrdinal(s)); }
  function hebrewLabel(s) { var h = hebrewFromDate(s); return h[2] + ' ' + h[3] + ' ' + h[0]; }

  // ----------------------------------------------------------------------------------- 13-month dates --
  var T13 = ['Pisces', 'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra',
    'Scorpius', 'Ophiuchus', 'Sagittarius', 'Capricornus', 'Aquarius'];
  var STARTS = {};   // year -> day number of the 13-month year's first day (Eastern Time)
  function thirteenFromOrdinal(o) {
    var Y = ymdFromOrdinal(o)[0];
    var y = has(STARTS, Y) && o >= STARTS[Y] ? Y : Y - 1;
    if (!has(STARTS, y) || !has(STARTS, y + 1)) return null;
    var i = o - STARTS[y], length = STARTS[y + 1] - STARTS[y], m, day, name, label, where;
    if (i < 364) {
      m = fdiv(i, 28) + 1; day = i % 28 + 1;
      name = T13[m - 1];
      label = name + ' ' + day + ', Year ' + y;
      where = 'Month ' + m + ' of 13, day ' + (i + 1) + ' of ' + length;
    } else {
      m = null; day = i - 363;
      name = length === 365 ? 'Year Day' : 'Year Day ' + day;
      label = name + ', Year ' + y;
      where = 'after Month 13, day ' + (i + 1) + ' of ' + length;
    }
    return { year: y, month: m, day: day, name: name, label: label, where: where,
      dayOfYear: i + 1, length: length, starts: fromOrdinal(STARTS[y]) };
  }
  function thirteenFromDate(s) { return thirteenFromOrdinal(toOrdinal(s)); }
  function thirteenLabel(s) { var t = thirteenFromDate(s); return t ? t.label : 'outside 1900-2052'; }
  function joinDigits(s) { return String(s).split('').join(' + '); }
  function thirteenRows(o) {
    var t = thirteenFromOrdinal(o);
    if (!t) return [];
    var Y = t.year, n = t.dayOfYear, L = t.length, YY = Y % 100, rows = [];
    if (t.month) {
      var M = t.month, D = t.day;
      rows = [
        ['13-month Month + Day + Year', M + D + Y, M + ' + ' + D + ' + ' + Y],
        ['13-month Month + Day + Last 2', M + D + YY, M + ' + ' + D + ' + ' + YY],
        ['13-month Month + Day + Year digits', M + D + digitSum(Y), M + ' + ' + D + ' + (' + joinDigits(Y) + ')'],
        ['13-month Month + Day + Last 2 digits', M + D + digitSum(YY), M + ' + ' + D + ' + (' + joinDigits(pad(YY, 2)) + ')'],
        ['13-month All digits', digitSum(M) + digitSum(D) + digitSum(Y), joinDigits('' + M + D + Y)],
        ['13-month Month + Day', M + D, M + ' + ' + D]
      ];
    }
    rows.push(['13-month Day of year', n, 'day ' + n + ' of ' + L]);
    rows.push(['13-month Days left in year', L - n, L + ' - ' + n]);
    return rows;
  }
  function thirteenNumbers(s) { return thirteenRows(toOrdinal(s)); }

  // -------------------------------------------------------------------------------------- date numbers --
  // system: 'usual' (regular + Hebrew), '12' (regular only), '13' (13-Month Sky Calendar)
  function rowsFor(o, hebrewToo, system) {
    if (system === '13') return thirteenRows(o);
    var p = ymdFromOrdinal(o), Y = p[0], M = p[1], D = p[2], YY = Y % 100;
    var total = isLeap(Y) ? 366 : 365;
    var doy = o - ordYMD(Y, 1, 1) + 1;
    var rows = [
      ['Month + Day + Year', M + D + Y, M + ' + ' + D + ' + ' + Y],
      ['Month + Day + Last 2', M + D + YY, M + ' + ' + D + ' + ' + YY],
      ['Month + Day + Year digits', M + D + digitSum(Y), M + ' + ' + D + ' + (' + joinDigits(Y) + ')'],
      ['Month + Day + Last 2 digits', M + D + digitSum(YY), M + ' + ' + D + ' + (' + joinDigits(pad(YY, 2)) + ')'],
      ['All digits', digitSum(M) + digitSum(D) + digitSum(Y), joinDigits('' + M + D + Y)],
      ['Month + Day', M + D, M + ' + ' + D],
      ['Day of year', doy, 'day ' + doy + ' of ' + total],
      ['Days left in year', total - doy, total + ' - ' + doy]
    ];
    if (hebrewToo && system === 'usual') {
      var h = hebrewFromOrdinal(o), hy = h[0], hm = h[1], hd = h[2], hname = h[3];
      rows.push(['Hebrew Day + Month + Year', hd + hm + hy, hd + ' ' + hname + '(' + hm + ') ' + hy]);
      rows.push(['Hebrew Day + Month + Year digits', hd + hm + digitSum(hy), hd + ' + ' + hm + ' + (' + joinDigits(hy) + ')']);
    }
    return rows;
  }
  // a small memory of each day's rows, so a chance check or a 4-year window works each day out once
  var rowCache = new Map();
  function cachedRows(o, hebrewToo, system) {
    var k = system + (hebrewToo ? 'h' : '') + o, v = rowCache.get(k);
    if (!v) {
      if (rowCache.size > 60000) rowCache.clear();
      v = rowsFor(o, hebrewToo, system);
      rowCache.set(k, v);
    }
    return v;
  }
  function optsOf(opts) {
    opts = opts || {};
    return { hebrewToo: opts.hebrewToo !== false, system: opts.system || 'usual' };
  }
  function dateNumbers(s, opts) {
    var o = optsOf(opts);
    return cachedRows(toOrdinal(s), o.hebrewToo, o.system).map(function (r) { return r.slice(); });
  }
  var setCache = new Map();
  function setFor(o, system) {
    var k = system + o, v = setCache.get(k);
    if (!v) {
      if (setCache.size > 60000) setCache.clear();
      v = new Set(cachedRows(o, true, system).map(function (r) { return r[1]; }));
      setCache.set(k, v);
    }
    return v;
  }
  function numberSet(s, opts) {
    var o = optsOf(opts);
    if (!o.hebrewToo) return new Set(rowsFor(toOrdinal(s), false, o.system).map(function (r) { return r[1]; }));
    return new Set(setFor(toOrdinal(s), o.system));
  }

  // --------------------------------------------------------------------------------- time between dates --
  function spanParts(a, b) {
    var oa = toOrdinal(a), ob = toOrdinal(b), pa = parse(a), pb = parse(b), t;
    if (ob < oa) { t = oa; oa = ob; ob = t; t = pa; pa = pb; pb = t; }
    var days = ob - oa, y = pb[0] - pa[0], m = pb[1] - pa[1], dd = pb[2] - pa[2];
    if (dd < 0) {
      m -= 1;
      var py = pb[1] === 1 ? pb[0] - 1 : pb[0], pm = pb[1] === 1 ? 12 : pb[1] - 1;
      dd += monthLen(py, pm);
    }
    if (m < 0) { y -= 1; m += 12; }
    return { a: iso(pa[0], pa[1], pa[2]), b: iso(pb[0], pb[1], pb[2]), days: days, y: y, m: m, dd: dd };
  }
  function span(a, b) {
    var s = spanParts(a, b), days = s.days, mt = s.y * 12 + s.m;
    return [
      ['Days between (not counting end)', days, s.a + ' to ' + s.b],
      ['Days, counting both ends', days + 1, days + ' + 1'],
      ['Weeks', fdiv(days, 7), fdiv(days, 7) + ' weeks and ' + (days % 7) + ' days'],
      ['Months', mt, mt + ' months and ' + s.dd + ' days'],
      ['Years', s.y, s.y + ' years, ' + s.m + ' months, ' + s.dd + ' days']
    ];
  }
  function endsWith(s, t) { return s.length >= t.length && s.slice(s.length - t.length) === t; }
  function spanSet(a, b) {
    var rows = span(a, b), days = rows[0][1], out = new Set([days, days + 1]);
    if (days % 7 === 0) out.add(days / 7);
    if (endsWith(rows[3][2], ' 0 days')) out.add(rows[3][1]);
    if (endsWith(rows[4][2], ' 0 days') && rows[4][2].indexOf(', 0 months') >= 0) out.add(rows[4][1]);
    return out;
  }

  // ---------------------------------------------------------------------------------- seeded random (MT19937) --
  function PyRandom(seed) {
    var N = 624, mt = new Uint32Array(N), mti = N + 1, i, j, k;
    function initGenrand(s) {
      mt[0] = s >>> 0;
      for (mti = 1; mti < N; mti++) {
        var p = mt[mti - 1] ^ (mt[mti - 1] >>> 30);
        mt[mti] = (Math.imul(1812433253, p) + mti) >>> 0;
      }
    }
    // random.seed(int): the absolute value as 32-bit words, then init_by_array
    var key = [], s0 = Math.abs(Math.floor(seed));
    do { key.push(s0 % 4294967296); s0 = Math.floor(s0 / 4294967296); } while (s0 > 0);
    initGenrand(19650218);
    i = 1; j = 0;
    for (k = N > key.length ? N : key.length; k; k--) {
      mt[i] = ((mt[i] ^ Math.imul(mt[i - 1] ^ (mt[i - 1] >>> 30), 1664525)) + key[j] + j) >>> 0;
      i++; j++;
      if (i >= N) { mt[0] = mt[N - 1]; i = 1; }
      if (j >= key.length) j = 0;
    }
    for (k = N - 1; k; k--) {
      mt[i] = ((mt[i] ^ Math.imul(mt[i - 1] ^ (mt[i - 1] >>> 30), 1566083941)) - i) >>> 0;
      i++;
      if (i >= N) { mt[0] = mt[N - 1]; i = 1; }
    }
    mt[0] = 0x80000000;
    mti = N;
    var M = 397, UPPER = 0x80000000, LOWER = 0x7fffffff, MATRIX = 0x9908b0df;
    function genrandUint32() {
      var y, kk;
      if (mti >= N) {
        for (kk = 0; kk < N - M; kk++) {
          y = (mt[kk] & UPPER) | (mt[kk + 1] & LOWER);
          mt[kk] = mt[kk + M] ^ (y >>> 1) ^ (y & 1 ? MATRIX : 0);
        }
        for (; kk < N - 1; kk++) {
          y = (mt[kk] & UPPER) | (mt[kk + 1] & LOWER);
          mt[kk] = mt[kk + (M - N)] ^ (y >>> 1) ^ (y & 1 ? MATRIX : 0);
        }
        y = (mt[N - 1] & UPPER) | (mt[0] & LOWER);
        mt[N - 1] = mt[M - 1] ^ (y >>> 1) ^ (y & 1 ? MATRIX : 0);
        mti = 0;
      }
      y = mt[mti++];
      y ^= (y >>> 11);
      y ^= (y << 7) & 0x9d2c5680;
      y ^= (y << 15) & 0xefc60000;
      y ^= (y >>> 18);
      return y >>> 0;
    }
    function getrandbits(kb) {   // 1 <= kb <= 32
      if (kb < 1 || kb > 32) throw new Error('getrandbits: 1 to 32 bits only');
      return kb === 32 ? genrandUint32() : genrandUint32() >>> (32 - kb);
    }
    function bitLength(n) { var b = 0; while (n > 0) { b++; n = Math.floor(n / 2); } return b; }
    function randbelow(n) {
      var kb = bitLength(n), r = getrandbits(kb);
      while (r >= n) r = getrandbits(kb);
      return r;
    }
    return {
      genrandUint32: genrandUint32, getrandbits: getrandbits, randbelow: randbelow,
      choice: function (seq) { return seq[randbelow(seq.length)]; },
      randint: function (a, b) { return a + randbelow(b - a + 1); }
    };
  }

  // ------------------------------------------------------------------------------------- connections --
  var YEAR_SUMS = { 'Month + Day + Year': 1, 'Hebrew Day + Month + Year': 1 };
  var LETTER_FREQ = 'eeeeeeeeeeeettttttttaaaaaaaaoooooooiiiiiiinnnnnnnsssssshhhhhhrrrrrrddddllllcccuuummwwffggyyppbbvkjxqz';
  var LETTER_FREQ_ARR = LETTER_FREQ.split('');
  function keysOf(o) { return Object.keys(o); }

  // a, b: {name, date (YYYY-MM-DD or empty)} -> [{type, number, text}], one per (type, number)
  function connections(a, b) {
    var codes = CORE, out = [];
    var va = values(a.name, codes), vb = values(b.name, codes);
    codes.forEach(function (code) {
      if (has(va, code) && va[code] === vb[code])
        out.push({ type: 'name = name', number: va[code], text: 'Both names = ' + va[code] + ' in ' + NAMES[code] });
    });
    [[a, va, b], [b, vb, a]].forEach(function (t) {
      var x = t[0], vx = t[1], y = t[2];
      if (!y.date) return;
      cachedRows(toOrdinal(y.date), true, 'usual').forEach(function (r) {
        keysOf(vx).forEach(function (code) {
          if (vx[code] === r[1]) out.push({ type: 'name = date', number: r[1],
            text: '\'' + x.name + '\' = ' + r[1] + ' (' + NAMES[code] + ') and ' + y.name + '\'s date gives ' +
              r[1] + ' (' + r[0] + ': ' + r[2] + ')' });
        });
      });
    });
    if (a.date && b.date) {
      var na = new Map();
      cachedRows(toOrdinal(a.date), true, 'usual').forEach(function (r) { if (!YEAR_SUMS[r[0]]) na.set(r[1], r); });
      cachedRows(toOrdinal(b.date), true, 'usual').forEach(function (r) {
        if (!YEAR_SUMS[r[0]] && na.has(r[1]))
          out.push({ type: 'date = date', number: r[1], text: 'Both dates give ' + r[1] + ' (' + na.get(r[1])[0] + ' / ' + r[0] + ')' });
      });
      if (a.date !== b.date) {
        var spans = spanSet(a.date, b.date), rows = new Map();
        span(a.date, b.date).forEach(function (r) { rows.set(r[1], r); });
        [[a, va], [b, vb]].forEach(function (t) {
          var x = t[0], vx = t[1];
          keysOf(vx).forEach(function (code) {
            var v = vx[code];
            if (spans.has(v)) {
              var r = rows.get(v), lab = r ? r[0] : 'span';
              out.push({ type: 'span = name', number: v, text: 'The time between them is ' + v + ' (' + lab + ') and \'' +
                x.name + '\' = ' + v + ' in ' + NAMES[code] });
            }
          });
        });
      }
    }
    var seen = new Set(), uniq = [];
    out.forEach(function (c) {
      var k = c.type + '\u0000' + c.number;
      if (!seen.has(k)) { seen.add(k); uniq.push(c); }
    });
    return uniq;
  }

  var LETTER_RE;
  try { LETTER_RE = new RegExp('^\\p{L}$', 'u'); } catch (e) { LETTER_RE = /^[A-Za-zÀ-ɏͰ-ϿЀ-ӿא-ת]$/; }
  function randomName(name, rng) {
    return Array.from(name).map(function (ch) { return LETTER_RE.test(ch) ? rng.choice(LETTER_FREQ_ARR) : ch; }).join('');
  }
  var R_START = ordYMD(1900, 1, 1), R_END = ordYMD(2030, 12, 31);
  function randomDate(rng) { return fromOrdinal(rng.randint(R_START, R_END)); }

  // The chance check, in slices: step(k) runs k more look-alike pairs (the page keeps responding meanwhile)
  function chanceRun(a, b, n, seed) {
    n = n || 1500;
    var actual = connections(a, b).length, rng = PyRandom(seed === undefined ? 7 : seed);
    var done = 0, ge = 0, total = 0;
    return {
      actual: actual, n: n,
      step: function (k) {
        var stop = Math.min(n, done + (k || n));
        for (; done < stop; done++) {
          var ra = { name: randomName(a.name, rng), date: a.date ? randomDate(rng) : null };
          var rb = { name: randomName(b.name, rng), date: b.date ? randomDate(rng) : null };
          var c = connections(ra, rb).length;
          total += c;
          if (c >= actual) ge++;
        }
        return done >= n;
      },
      done: function () { return done >= n; },
      progress: function () { return done / n; },
      result: function () { return { actual: actual, ge: ge, n: n, share: ge / n, average: total / n }; }
    };
  }
  function chance(a, b, n, seed) { var r = chanceRun(a, b, n, seed); r.step(r.n); return r.result(); }

  function valueSet(name) {
    var v = values(name, CORE), s = new Set();
    keysOf(v).forEach(function (k) { s.add(v[k]); });
    return s;
  }
  function intersects(a, b) { var it = a.values(); for (var x = it.next(); !x.done; x = it.next()) if (b.has(x.value)) return true; return false; }

  // how often ANY day of the 4 years around today matches this name (the chance check on one name)
  function dayHitRate(name, todayIso, opts) {
    opts = opts || {};
    var years = opts.years || 4, system = opts.system || 'usual';
    var vals = valueSet(name), days = 365 * years;
    if (!vals.size) return { hits: 0, days: days, share: 0 };
    var start = toOrdinal(todayIso) - fdiv(365 * years, 2), hits = 0;
    for (var i = 0; i < days; i++) if (intersects(setFor(start + i, system), vals)) hits++;
    return { hits: hits, days: days, share: hits / days };
  }
  // [[date label, number, how, cipher]] where a date number equals a name value
  function dateHits(name, s, opts) {
    var system = (opts && opts.system) || 'usual', vals = values(name, CORE), out = [];
    cachedRows(toOrdinal(s), true, system).forEach(function (r) {
      keysOf(vals).forEach(function (code) { if (vals[code] === r[1]) out.push([r[0], r[1], r[2], code]); });
    });
    return out;
  }
  function distinct(h, f) { var s = new Set(); h.forEach(function (x) { s.add(f(x)); }); return s.size; }
  function nPairs(h) { return distinct(h, function (x) { return x[1] + '\u0000' + x[3]; }); }
  // the days that line up with this name two or more ways (connect.upcoming)
  function upcoming(name, startIso, days, minHits) {
    days = days === undefined ? 45 : days; minHits = minHits === undefined ? 2 : minHits;
    var o = toOrdinal(startIso), out = [];
    for (var i = 0; i < days; i++) {
      var d = fromOrdinal(o + i), h = dateHits(name, d);
      if (distinct(h, function (x) { return x[1]; }) >= minHits || h.length >= minHits) out.push([d, h]);
    }
    return out;
  }

  // ------------------------------------------------------------------------------------- the library --
  var DATA = null;
  function events() { return DATA ? DATA.events : []; }
  var MIN_HITS = 2;
  function sinceLines(e, day) {
    if (!e.date || e.date === day) return [];
    var gap = spanSet(e.date, day), vals = values(e.name, CORE), sp = [];
    keysOf(vals).forEach(function (c) { if (gap.has(vals[c])) sp.push([vals[c], c]); });
    sp.sort(function (x, y) { return x[0] - y[0] || (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0); });
    var seen = new Set();
    sp = sp.filter(function (p) { var k = p[0] + '\u0000' + p[1]; if (seen.has(k)) return false; seen.add(k); return true; });
    return sp.map(function (p) { return ['time since ' + e.date, p[0], 'span', p[1]]; });
  }
  // predict.on_this_day: scheduled events, anniversaries, and events that line up with the day
  function onThisDay(day) {
    parse(day);
    var md = day.slice(4), yr = +day.slice(0, 4), ann = [], lines = [], sched = [];
    events().forEach(function (e) {
      if (e.date && e.date <= day && day <= (e.end_date || e.date)) sched.push(e);
      if (e.date && endsWith(e.date, md) && e.date !== day) ann.push([e, yr - +e.date.slice(0, 4)]);
      var h = dateHits(e.name, day);
      if (nPairs(h) >= MIN_HITS) lines.push([e, h]);
      var s = sinceLines(e, day);
      if (s.length) lines.push([e, s]);
    });
    return { anniversaries: ann, lines: lines, scheduled: sched };
  }
  // The 'onthisday' count of libraryDayShare, worked out faster (2026-11-16) with exactly the same result: each event's
  // four values, day number and date are found once, not once a day. A day counts when some event matches it in
  // MIN_HITS or more of the core ciphers (nPairs of dateHits: the codes whose value is one of the day's numbers) or
  // when one of its values is in spanSet(event date, day) (sinceLines), tested by gapHas with spanParts' own steps.
  function gapHas(ao, ap, bo, bp, vs) {
    var t, days, y, m, dd, mt, i, v;
    if (bo < ao) { t = ao; ao = bo; bo = t; t = ap; ap = bp; bp = t; }
    days = bo - ao; y = bp[0] - ap[0]; m = bp[1] - ap[1]; dd = bp[2] - ap[2];
    if (dd < 0) { m -= 1; dd += monthLen(bp[1] === 1 ? bp[0] - 1 : bp[0], bp[1] === 1 ? 12 : bp[1] - 1); }
    if (m < 0) { y -= 1; m += 12; }
    mt = y * 12 + m;   // span's Months row; its Years row is y. Each counts only with 0 days over (and Years, 0 months)
    for (i = 0; i < vs.length; i++) {
      v = vs[i];
      if (v === days || v === days + 1 || (days % 7 === 0 && v === days / 7) || (dd === 0 && (v === mt || (m === 0 && v === y)))) return true;
    }
    return false;
  }
  function lineupDays(start, days, evs) {
    var info = evs.map(function (e) {
      var v = values(e.name, CORE);
      return { vs: keysOf(v).map(function (k) { return v[k]; }), o: e.date ? toOrdinal(e.date) : null, p: e.date ? parse(e.date) : null };
    }), hits = 0;
    for (var i = 0; i < days; i++) {
      var o = start + i, set = setFor(o, 'usual'), p = null, any = false;
      for (var j = 0; j < info.length && !any; j++) {
        var x = info[j], n = 0;
        for (var k = 0; k < x.vs.length; k++) if (set.has(x.vs[k])) n++;
        if (n >= MIN_HITS) any = true;
        else if (x.o !== null && x.o !== o && x.vs.length) any = gapHas(x.o, x.p, o, p || (p = ymdFromOrdinal(o)), x.vs);
      }
      if (any) hits++;
    }
    return hits;
  }
  // share of the 1,460 days around today on which at least one of the events lines up ('upcoming' rule or
  // 'onthisday' rule): the library-wide chance line
  function libraryDayShare(rule, todayIso) {
    var start = toOrdinal(todayIso) - 730, days = 1460, hits = 0, evs = events();
    if (rule !== 'upcoming') { hits = lineupDays(start, days, evs); return { hits: hits, days: days, share: hits / days }; }
    for (var i = 0; i < days; i++) {
      var d = fromOrdinal(start + i), any = false;
      for (var j = 0; j < evs.length && !any; j++) {
        var e = evs[j], h = dateHits(e.name, d);
        if (rule === 'upcoming') any = distinct(h, function (x) { return x[1]; }) >= 2 || h.length >= 2;
        else any = nPairs(h) >= MIN_HITS || sinceLines(e, d).length > 0;
      }
      if (any) hits++;
    }
    return { hits: hits, days: days, share: hits / days };
  }
  // past / present / future relative to today (db.when)
  function when(e, todayIso) {
    if (!e.date) return 'timeless';
    var end = e.end_date || e.date;
    if (end < todayIso) return 'past';
    if (e.date > todayIso) return 'future';
    return 'present';
  }

  // ----------------------------------------------------------------------------------- 12 vs 13 figures --
  function numbersPerDay(system, todayIso) {
    var start = toOrdinal(todayIso) - 730, sum = 0;
    for (var i = 0; i < 1460; i++) sum += setFor(start + i, system).size;
    return sum / 1460;
  }
  function sharedShare(todayIso) {
    var start = toOrdinal(todayIso) - 730, hits = 0;
    for (var i = 0; i < 1460; i++) if (intersects(setFor(start + i, '12'), setFor(start + i, '13'))) hits++;
    return { hits: hits, days: 1460, share: hits / 1460 };
  }

  // -------------------------------------------------------------------------------------- the meanings --
  var PRIMES = (function (n) {
    var sieve = new Uint8Array(n + 1).fill(1), out = [];
    sieve[0] = sieve[1] = 0;
    for (var i = 2; i * i <= n; i++) if (sieve[i]) for (var j = i * i; j <= n; j += i) sieve[j] = 0;
    for (var k = 0; k <= n; k++) if (sieve[k]) out.push(k);
    return out;
  })(20000);
  var PRIME_INDEX = new Map();
  PRIMES.forEach(function (p, i) { PRIME_INDEX.set(p, i + 1); });
  var FIB = [1, 2];
  while (FIB[FIB.length - 1] < 1e7) FIB.push(FIB[FIB.length - 1] + FIB[FIB.length - 2]);
  var FIBS = new Set(FIB);
  function isqrt(x) {
    var r = Math.floor(Math.sqrt(x));
    while (r * r > x) r--;
    while ((r + 1) * (r + 1) <= x) r++;
    return r;
  }
  function ordinal(n) {
    var suf = n % 100 >= 10 && n % 100 <= 20 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th';
    return n + suf;
  }
  function factor(n) {
    var f = [], d = 2;
    while (d * d <= n) { while (n % d === 0) { f.push(d); n = n / d; } d += 1; }
    if (n > 1) f.push(n);
    return f;
  }
  function nthPrime(k) { return k > 0 && k <= PRIMES.length ? PRIMES[k - 1] : null; }
  function mathFacts(n) {
    var out = [];
    if (PRIME_INDEX.has(n)) out.push(n + ' is the ' + ordinal(PRIME_INDEX.get(n)) + ' prime number');
    else if (n > 1) out.push(n + ' = ' + factor(n).join(' x '));
    var t = fdiv(isqrt(8 * n + 1) - 1, 2);
    if (n > 0 && t * (t + 1) / 2 === n) out.push(n + ' is triangular: 1 + 2 + ... + ' + t);
    var r = isqrt(n);
    if (n > 0 && r * r === n) out.push(n + ' is a square: ' + r + ' x ' + r);
    var c = n > 0 ? Math.round(Math.pow(n, 1 / 3)) : 0;
    if (n > 1 && c * c * c === n) out.push(n + ' is a cube: ' + c + ' x ' + c + ' x ' + c);
    if (FIBS.has(n)) out.push(n + ' is a Fibonacci number');
    var s = String(n), rev = s.split('').reverse().join('');
    if (s.length > 1 && s === rev) out.push(n + ' reads the same both ways');
    if (s.length > 1) {
      out.push('digits add to ' + digitSum(n) + ', reduce to ' + reduceFull(n));
      if (rev !== s && s.charAt(s.length - 1) !== '0') out.push('mirror number: ' + rev);
    }
    return out;
  }
  // the public key-word index: Faith, then Life (DESIGN 2.3), each word's core values in CORE order
  var PHRASE_INDEX = null;
  function phraseIndex() {
    if (PHRASE_INDEX) return PHRASE_INDEX;
    var idx = new Map(), ph = DATA ? DATA.phrases : {};
    keysOf(ph).forEach(function (theme) {
      ph[theme].forEach(function (w) {
        var v = values(w);
        keysOf(v).forEach(function (code) {
          if (!idx.has(v[code])) idx.set(v[code], []);
          idx.get(v[code]).push([w, code, theme]);
        });
      });
    });
    return (PHRASE_INDEX = idx);
  }
  function meaning(n) {
    var out = { number: n, math: mathFacts(n), science: [], records: [], lore: [], phrases: [] };
    var els = DATA ? DATA.elements : [];
    if (n >= 1 && n <= 118 && els.length === 118) out.science.push('Atomic number of ' + els[n - 1]);
    var p = n <= 2000 ? nthPrime(n) : null;
    if (p) out.math.push('the ' + ordinal(n) + ' prime is ' + p);
    (DATA ? DATA.records : []).forEach(function (r) { if (r[0] === n) out.records.push([r[1], r[2], r[3]]); });
    (DATA ? DATA.lore : []).forEach(function (r) { if (r[0] === n) out.lore.push(r[1]); });
    out.phrases = (phraseIndex().get(n) || []).map(function (x) { return x.slice(); });
    return out;
  }
  // the one line used in tables ("Known for")
  function short(n, limit) {
    limit = limit === undefined ? 3 : limit;
    var m = meaning(n);
    var bits = m.records.map(function (r) { return r[1]; }).slice(0, 2).concat(m.science.slice(0, 1));
    bits = bits.concat(m.phrases.slice(0, limit).map(function (x) { return '\'' + x[0] + '\' (' + x[1] + ')'; }));
    if (!bits.length) bits = m.math.slice(0, 1);
    return bits.join('; ');
  }
  function publicWords() {
    var ph = DATA ? DATA.phrases : {}, out = [];
    keysOf(ph).forEach(function (t) { out = out.concat(ph[t]); });
    return out;
  }

  // ------------------------------------------------------------------------------------- chance words --
  // percent with one decimal under 10%, whole above: share * 100, then rounded half to even (as gem/connect.py)
  function pyFixed(x, d) {
    var s = x.toFixed(d);
    var q = d === 0 ? x * 2 : x * 4;   // exact ties are odd multiples of 0.5 (d = 0) or of 0.25 (d = 1)
    if (q === Math.floor(q) && q % 2 === 1) {
      var digits = s.replace('.', ''), last = +digits.charAt(digits.length - 1);
      if (last % 2 === 1) {
        var n = String(parseInt(digits, 10) - 1);
        if (d) { while (n.length < d + 1) n = '0' + n; s = n.slice(0, n.length - d) + '.' + n.slice(n.length - d); }
        else s = n;
      }
    }
    return s;
  }
  function pct(share) { return share < 0.1 ? pyFixed(share * 100, 1) + '%' : pyFixed(share * 100, 0) + '%'; }
  function strengthWord(share) {
    if (share <= 0.01) return 'rare (1 in 100 or rarer by chance)';
    if (share <= 0.05) return 'unusual (about 1 in 20 by chance)';
    if (share <= 0.20) return 'mild (happens fairly often by chance)';
    return 'ordinary (chance does this all the time)';
  }

  // ------------------------------------------------------------------------- workings (added 2026-11-16) --
  // New and pure, for the page's worked-out lines (what the film shows). No older function changes; test/additions.mjs.
  // the window of dayHitRate, libraryDayShare, numbersPerDay and sharedShare: 730 days before today, today, 729 after
  function windowOf(todayIso, years) {
    var days = 365 * (years || 4), s = toOrdinal(todayIso) - fdiv(days, 2);
    return { start: fromOrdinal(s), end: fromOrdinal(s + days - 1), days: days, before: fdiv(days, 2), after: days - fdiv(days, 2) - 1 };
  }
  function oneIn(hits, days) { return hits ? Math.round(days / hits) : null; }
  // only exact odds: 1 in N is said "like ..." only for these N
  var FAMILIAR_ODDS = { 2: 'a coin landing heads', 3: 'a die landing on 1 or 2', 4: 'two coins both landing heads',
    6: 'a die landing on 6', 8: 'three coins all landing heads', 36: 'two dice both landing on 6' };
  var STRENGTH_EDGES = [0.01, 0.05, 0.20];   // strengthWord's cut-offs (an edge falls in the lower band)
  // {word, text}: the band of a share, as a sentence; unit 'day' (day checks) or 'pair' (look-alike pair checks)
  function strengthBand(share, unit) {
    var five = unit === 'pair' ? '1 in 5' : '1 day in 5', p = pct(share), i, word, txt;
    for (i = 0; i < 3 && share > STRENGTH_EDGES[i]; i++);
    word = ['rare', 'unusual', 'mild', 'ordinary'][i];
    if (i && parseFloat(p) === [1, 5, 20][i - 1]) p = 'just over ' + p;   // it rounds to the edge it is above
    txt = ['is 1 in 100 (1%) or less', 'is 1 in 20 (5%) or less, but more than 1 in 100 (1%)',
      'is ' + five + ' (20%) or less, but more than 1 in 20 (5%)', 'is more than ' + five + ' (20%)'][i];
    return { word: word, text: p + ' ' + txt + ', so it counts as ' + word + '.' +
      (i ? '' : ' Even rare isn’t a message: luck does it seldom, not never.') };
  }
  // N of "about 1 day in N" as the page shows it (added after the first check of the workings; oneIn is unchanged):
  // oneIn's whole N, except where that N would land on a band's edge (5, 20 or 100) that the share is above. Then N is
  // shown to one decimal, or two if one still reads as the edge, so "about 1 day in 4.5 (1,460 ÷ 322 ≈ 4.5)" sits
  // beside "22% is more than 1 day in 5" instead of "about 1 day in 5". null when nothing matched
  function oneInText(hits, days) {
    if (!hits) return null;
    var q = days / hits, n = oneIn(hits, days), d = 0;
    if (STRENGTH_EDGES.some(function (e) { return n === Math.round(1 / e) && hits / days > e; }))
      do d++; while (Number(q.toFixed(d)) >= n);
    return d ? q.toFixed(d) : String(n);
  }
  // one digit, letter by letter: [[L, base, [sum, sum ...]]] for each letter (once, in order) whose base has two digits.
  // FR and SR count from A (ordC), RFR and RSR back from Z (revC); FR and RFR repeat until one digit is left
  function reductionSteps(text, code) {
    var base = code === 'FR' || code === 'SR' ? ordC : code === 'RFR' || code === 'RSR' ? revC : null, seen = {}, out = [];
    if (base) letters(text).forEach(function (c) {
      var n = base(c), x = n, s = [];
      if (seen[c] || n < 10) return;
      seen[c] = 1;
      if (code === 'SR' || code === 'RSR') s.push(digitSum(n));
      else while (x > 9) s.push(x = digitSum(x));
      out.push([c.toUpperCase(), n, s]);
    });
    return out;
  }
  // dateHits and dayHitRate with all 12 English ciphers (CODES), not the four core ones
  function allDateHits(name, s) {
    var vals = values(name, CODES), out = [];
    cachedRows(toOrdinal(s), true, 'usual').forEach(function (r) {
      keysOf(vals).forEach(function (code) { if (vals[code] === r[1]) out.push([r[0], r[1], r[2], code]); });
    });
    return out;
  }
  function dayHitRateAll(name, todayIso) {
    var v = values(name, CODES), vals = new Set(keysOf(v).map(function (k) { return v[k]; })), days = 1460, hits = 0;
    if (!vals.size) return { hits: 0, days: days, share: 0 };
    var start = toOrdinal(todayIso) - 730;
    for (var i = 0; i < days; i++) if (intersects(setFor(start + i, 'usual'), vals)) hits++;
    return { hits: hits, days: days, share: hits / days };
  }
  // the 13-month rows that say "same": which numbers, where each comes from, and how many rest on one shared
  // Month + Day (a 13-month row counts when the regular row built the same way gives the same number)
  function sameReport(s) {
    var reg = dateNumbers(s, { system: '12' }), t = thirteenNumbers(s), th = thirteenFromDate(s), p = parse(s);
    var vals = new Set(reg.map(function (r) { return r[1]; })), rows = [], pairs = [], numbers = [], builtOn = 0;
    var md = { reg: [p[1], p[2]], th: th && th.month ? [th.month, th.day] : null };
    md.equal = !!md.th && p[1] + p[2] === md.th[0] + md.th[1];
    t.forEach(function (r, i) {
      if (!vals.has(r[1])) return;
      rows.push(i);
      var k = numbers.indexOf(r[1]);
      if (k < 0) {
        numbers.push(r[1]);
        pairs.push({ n: r[1], th: [[r[0].replace(/^13-month /, ''), r[2]]],
          reg: reg.filter(function (x) { return x[1] === r[1]; }).map(function (x) { return [x[0], x[2]]; }) });
      } else pairs[k].th.push([r[0].replace(/^13-month /, ''), r[2]]);
      if (md.equal && t.length === 8 && (i < 4 || i === 5 ? reg[i][1] === r[1] :
        i === 4 && digitSum(md.th[0]) + digitSum(md.th[1]) === md.th[0] + md.th[1] && reg[2][1] === r[1])) builtOn++;
    });
    return { rows: rows.length, of: t.length, numbers: numbers, pairs: pairs, md: md, builtOn: builtOn };
  }
  // the rows of span() that spanSet leaves out, and by how much: [[label, leftover]]
  function spanLeftOut(a, b) {
    var s = spanParts(a, b), w = s.days % 7, out = [], pl = function (n, u) { return n + ' ' + u + (n === 1 ? '' : 's'); };
    if (w) out.push(['weeks', pl(w, 'day') + ' over']);
    if (s.dd) out.push(['months', pl(s.dd, 'day') + ' over']);
    if (s.m || s.dd) out.push(['years', (s.m ? pl(s.m, 'month') + (s.dd ? ' and ' : '') : '') + (s.dd ? pl(s.dd, 'day') : '') + ' over']);
    return out;
  }
  // connections() with its workings: the same items, in the same order, each with parts:
  // names {name, code, how}; dates {date, label, how, n}; the time between {span: label, how, n}
  function connectionWork(a, b) {
    var codes = CORE, out = [];
    var va = values(a.name, codes), vb = values(b.name, codes);
    var nm = function (x, code) { return { name: x.name, code: code, how: explain(x.name, code) }; };
    var dt = function (d, r) { return { date: d, label: r[0], how: r[2], n: r[1] }; };
    codes.forEach(function (code) {
      if (has(va, code) && va[code] === vb[code])
        out.push({ type: 'name = name', number: va[code], text: 'Both names = ' + va[code] + ' in ' + NAMES[code], parts: [nm(a, code), nm(b, code)] });
    });
    [[a, va, b], [b, vb, a]].forEach(function (t) {
      var x = t[0], vx = t[1], y = t[2];
      if (!y.date) return;
      cachedRows(toOrdinal(y.date), true, 'usual').forEach(function (r) {
        keysOf(vx).forEach(function (code) {
          if (vx[code] === r[1]) out.push({ type: 'name = date', number: r[1],
            text: '\'' + x.name + '\' = ' + r[1] + ' (' + NAMES[code] + ') and ' + y.name + '\'s date gives ' +
              r[1] + ' (' + r[0] + ': ' + r[2] + ')', parts: [nm(x, code), dt(y.date, r)] });
        });
      });
    });
    if (a.date && b.date) {
      var na = new Map();
      cachedRows(toOrdinal(a.date), true, 'usual').forEach(function (r) { if (!YEAR_SUMS[r[0]]) na.set(r[1], r); });
      cachedRows(toOrdinal(b.date), true, 'usual').forEach(function (r) {
        if (!YEAR_SUMS[r[0]] && na.has(r[1]))
          out.push({ type: 'date = date', number: r[1], text: 'Both dates give ' + r[1] + ' (' + na.get(r[1])[0] + ' / ' + r[0] + ')',
            parts: [dt(a.date, na.get(r[1])), dt(b.date, r)] });
      });
      if (a.date !== b.date) {
        var spans = spanSet(a.date, b.date), rows = new Map();
        span(a.date, b.date).forEach(function (r) { rows.set(r[1], r); });
        [[a, va], [b, vb]].forEach(function (t) {
          var x = t[0], vx = t[1];
          keysOf(vx).forEach(function (code) {
            var v = vx[code];
            if (spans.has(v)) {
              var r = rows.get(v), lab = r ? r[0] : 'span';
              out.push({ type: 'span = name', number: v, text: 'The time between them is ' + v + ' (' + lab + ') and \'' +
                x.name + '\' = ' + v + ' in ' + NAMES[code], parts: [{ span: lab, how: r ? r[2] : '', n: v }, nm(x, code)] });
            }
          });
        });
      }
    }
    var seen = new Set();
    return out.filter(function (c) { var k = c.type + '\u0000' + c.number; if (seen.has(k)) return false; seen.add(k); return true; });
  }
  // the first k look-alike pairs of chanceRun(a, b, n, seed), drawn in its exact order: [nameA, dateA, nameB, dateB, count]
  function lookalikes(a, b, k, seed) {
    var rng = PyRandom(seed === undefined ? 7 : seed), out = [];
    for (var i = 0; i < k; i++) {
      var ra = { name: randomName(a.name, rng), date: a.date ? randomDate(rng) : null };
      var rb = { name: randomName(b.name, rng), date: b.date ? randomDate(rng) : null };
      out.push([ra.name, ra.date, rb.name, rb.date, connections(ra, rb).length]);
    }
    return out;
  }
  // the letters' names (fixed facts): Hebrew (final forms too) and Greek (with the old numeral letters)
  function names(ls, ns) { var o = {}; ls.forEach(function (l, i) { o[l] = ns[i]; }); return o; }
  var LETTER_NAMES = {
    HEB: names(keysOf(HEB), ('alef beth gimel dalet he vav zayin het tet yod kaf lamed mem nun samekh ayin pe tsadi qof ' +
      'resh shin tav').split(' ').concat(['final kaf', 'final mem', 'final nun', 'final pe', 'final tsadi'])),
    GRK: names(keysOf(GRK), ('alpha beta gamma delta epsilon stigma zeta eta theta iota kappa lambda mu nu xi omicron pi ' +
      'koppa rho sigma').split(' ').concat(['final sigma'], 'tau upsilon phi chi psi omega sampi'.split(' ')))
  };
  // [[letter, name, value]] for each letter the text counts in HEB or GRK, once each, in order
  function scriptNames(text, which) {
    var seen = {}, out = [];
    scriptLetters(text, which).forEach(function (p) { if (!seen[p[0]]) { seen[p[0]] = 1; out.push([p[0], LETTER_NAMES[which][p[0]], p[1]]); } });
    return out;
  }
  // A to Z in the four core ciphers: [[L, EO, FR, RO, RFR]]
  function alphabetTable() {
    return A.split('').map(function (c) { return [c.toUpperCase()].concat(CORE.map(function (k) { return BY_CODE[k][3](c); })); });
  }
  // every core-cipher total of the public key words, sorted
  function keywordTotals() {
    var s = new Set();
    publicWords().forEach(function (w) { var v = values(w); keysOf(v).forEach(function (k) { s.add(v[k]); }); });
    return Array.from(s).sort(function (x, y) { return x - y; });
  }

  // ------------------------------------------------------- Rory's cool-idea picks (added 2026-11-16) --
  // New and pure, like the workings above; no older function changes (test/additions.mjs).
  // the ways a name matches a day, as On this day counts them: its distinct (number, cipher) pairs among the day's
  // numbers, so at most one way per core cipher (opts.system as dateHits)
  function ways(name, s, opts) { return nPairs(dateHits(name, s, opts)); }
  // made-up words (randomName: the word's length, spaces and digits, random letters) that match the day in `need` or
  // more ways: {hits, n, share}. Seeded (opts.seed, 7), so a word and a day always give the same figure. The run form
  // goes in slices (step(k): k more made-up words), as chanceRun does
  function madeUpRun(word, s, need, opts) {
    opts = opts || {};
    var n = opts.n || 1000, rng = PyRandom(opts.seed === undefined ? 7 : opts.seed), done = 0, hits = 0;
    return {
      step: function (k) { for (var stop = Math.min(n, done + k); done < stop; done++) if (ways(randomName(word, rng), s, opts) >= need) hits++; return done >= n; },
      done: function () { return done >= n; },
      result: function () { return { hits: hits, n: n, share: hits / n }; }
    };
  }
  function madeUpWays(word, s, need, opts) { var r = madeUpRun(word, s, need, opts); r.step(Infinity); return r.result(); }
  // the 13-Month Sky Calendar's last Year Day on or before the day (null when there is none in 1900-2052)
  function lastYearDay(s) {
    var t = thirteenFromDate(s), p;
    if (!t) return null;
    if (!t.month) return s;
    p = STARTS[t.year] - 1;
    return thirteenFromOrdinal(p) ? fromOrdinal(p) : null;
  }
  // a name against any mix of calendars over the 1,460 days around today: mix.reg (the regular calendar's eight
  // ways), mix.heb (the two Hebrew ways), mix.th (the 13-month ways). {hits, days, share, perDay}: perDay is the
  // average count of different numbers a date gives with that mix. {reg, heb} is the usual set (dayHitRate)
  function mixRate(name, todayIso, mix) {
    var vals = valueSet(name), start = toOrdinal(todayIso) - 730, days = 1460, hits = 0, sum = 0, i, o, set;
    var put = function (v) { set.add(v); };
    for (i = 0; i < days; i++) {
      o = start + i;
      set = new Set();
      if (mix.reg) setFor(o, '12').forEach(put);
      if (mix.heb) cachedRows(o, true, 'usual').slice(8).forEach(function (r) { set.add(r[1]); });   // the two Hebrew rows
      if (mix.th) setFor(o, '13').forEach(put);
      sum += set.size;
      if (vals.size && intersects(vals, set)) hits++;
    }
    return { hits: hits, days: days, share: hits / days, perDay: sum / days };
  }
  // a made-up history: a twin for each event, named in random letters (randomName) and dated on a random day from
  // 1900-01-01 to lastIso, never later. Seeded (the page uses 1000 + k for its k-th history). A name that would
  // spell a tip or a bet (the build's claim words) is drawn again, and so is one with a rude word or a slur anywhere
  // in it (RUDE_RE, added after the rules check found such names among histories 1 to 400). Its list is kept in ROT13
  // (each letter moved 13 places along) so the page's own source does not spell the words out
  var CLAIM_RE = /\b(predict\w*|forecast\w*|picks?|tips?|bets?|betting|wager\w*)\b/i;
  var RUDE_RE = new RegExp(('shpx|fuvg|phag|gjng|gvg|fyhg|juber|encr|snt|qvpx|pbpx|chff|cvff|cbea|avt|xvxr|fcvp|puvax|tbbx|qlxr|ubzb|pbba|phz|' +
    'wvmm|nany|nahf|ovgpu|onfgneq|jnax|gheq|penc|nefr|nff|frk|anmv|uvgyre|xvyy|qvyqb|obbo|cravf|intva|pyvg|frzra|fcrez|crqb|vaprfg|gneq|' +
    'genaal|arteb|wnc|cnxv|xxx|fcnm|yrfob').replace(/[a-z]/g, function (c) { return String.fromCharCode((c.charCodeAt(0) - 84) % 26 + 97); }), 'i');
  function madeUpEvents(evs, seed, lastIso) {
    var rng = PyRandom(seed), hi = Math.max(R_START, toOrdinal(lastIso));
    return evs.map(function (e) {
      var name = randomName(e.name, rng);
      while (CLAIM_RE.test(name) || RUDE_RE.test(name)) name = randomName(e.name, rng);
      return { id: e.id, name: name, date: fromOrdinal(rng.randint(R_START, hi)), end_date: null, twin: e.name };
    });
  }
  // the steps that made the shipped Strongest list (build.py, pyref.strongest), in slices: every pair's connections;
  // the pairs with 2 or more, most first (a stable sort); the first 2 x limit each checked against n look-alike pairs
  // (chanceRun, seed 7); then rarest first (fewest look-alikes doing as well; ties: more connections first).
  // step(k) does k more units of work (one pair's connections, or one look-alike pair)
  function strongestRun(evs, limit, n) {
    limit = limit || 10; n = n || 500;
    var ne = evs.length, np = ne * (ne - 1) / 2, i = 0, j = 1, cand = [], top = null, k = 0, run = null, scored = [], work = 0;
    function done() { return top !== null && k >= top.length; }
    return {
      pairs: np,
      step: function (units) {
        while (units > 0 && !done()) {
          if (i < ne - 1) {
            var cs = connections(evs[i], evs[j]);
            if (cs.length >= 2) cand.push({ a: evs[i], b: evs[j], cs: cs });
            if (++j >= ne) { i++; j = i + 1; }
            units--; work++;
          } else if (!top) {
            top = cand.slice().sort(function (x, y) { return y.cs.length - x.cs.length; }).slice(0, 2 * limit);
          } else {
            if (!run) run = chanceRun(top[k].a, top[k].b, n, 7);
            var m = Math.min(units, n - Math.round(run.progress() * n)), r, c;
            run.step(m); units -= m; work += m;
            if (run.done()) {
              r = run.result(); c = top[k++]; run = null;
              scored.push({ a: c.a, b: c.b, count: c.cs.length, lines: c.cs.slice(0, 6).map(function (x) { return x.text; }),
                ge: r.ge, n: r.n, share: r.share, average: r.average });
            }
          }
        }
        return done();
      },
      done: done,
      progress: function () { return done() ? 1 : work / (np + (top ? top.length : 2 * limit) * n); },
      result: function () {
        return { pairs: np, with2: cand.length, top: scored.slice().sort(function (x, y) { return x.ge - y.ge || y.count - x.count; }).slice(0, limit) };
      }
    };
  }

  // ---------------------------------------------------------------------------------------------- load --
  function load(data) {
    DATA = data;
    STARTS = {};
    // the 13-month years' first days (Eastern Time), shipped as {first: <year>, marchDay: [day of March, ...]}
    var s13 = data.starts13 || {};
    if (Array.isArray(s13.marchDay)) s13.marchDay.forEach(function (d, i) { STARTS[s13.first + i] = ordYMD(s13.first + i, 3, d); });
    else keysOf(s13).forEach(function (y) { STARTS[+y] = toOrdinal(s13[y]); });
    PHRASE_INDEX = null;
    rowCache.clear(); setCache.clear();
    return API;
  }

  var API = {
    load: load,
    // ciphers
    ENGLISH: ENGLISH.map(function (c) { return [c[0], c[1], c[2]]; }), CORE: CORE.slice(), CODES: CODES.slice(), NAMES: NAMES,
    letters: letters, value: value, breakdown: breakdown, explain: explain, values: values, allValues: allValues,
    scriptLetters: scriptLetters, digitSum: digitSum, reduceFull: reduceFull,
    // days
    isDate: isDate, parse: parse, toOrdinal: toOrdinal, fromOrdinal: fromOrdinal, weekday: weekday, addDays: addDays,
    isLeap: isLeap, monthLen: monthLen, WEEKDAYS: WEEKDAYS, iso: iso,
    dateNumbers: dateNumbers, numberSet: numberSet,
    hebrewFromDate: hebrewFromDate, hebrewLabel: hebrewLabel,
    thirteenFromDate: thirteenFromDate, thirteenNumbers: thirteenNumbers, thirteenLabel: thirteenLabel, T13: T13,
    span: span, spanSet: spanSet,
    // connections and chance
    connections: connections, chance: chance, chanceRun: chanceRun, PyRandom: PyRandom, LETTER_FREQ: LETTER_FREQ,
    randomName: randomName, randomDate: randomDate,
    dateHits: dateHits, upcoming: upcoming, dayHitRate: dayHitRate,
    onThisDay: onThisDay, libraryDayShare: libraryDayShare, when: when, events: events,
    numbersPerDay: numbersPerDay, sharedShare: sharedShare,
    // meanings
    meaning: meaning, short: short, mathFacts: mathFacts, factor: factor, ordinal: ordinal, nthPrime: nthPrime,
    publicWords: publicWords,
    pct: pct, strengthWord: strengthWord,
    // workings (added 2026-11-16)
    windowOf: windowOf, oneIn: oneIn, FAMILIAR_ODDS: FAMILIAR_ODDS, STRENGTH_EDGES: STRENGTH_EDGES, strengthBand: strengthBand,
    reductionSteps: reductionSteps, allDateHits: allDateHits, dayHitRateAll: dayHitRateAll, sameReport: sameReport,
    spanLeftOut: spanLeftOut, connectionWork: connectionWork, lookalikes: lookalikes, LETTER_NAMES: LETTER_NAMES,
    scriptNames: scriptNames, alphabetTable: alphabetTable, keywordTotals: keywordTotals,
    // Rory's cool-idea picks (added 2026-11-16)
    ways: ways, madeUpRun: madeUpRun, madeUpWays: madeUpWays, lastYearDay: lastYearDay, mixRate: mixRate, madeUpEvents: madeUpEvents, strongestRun: strongestRun,
    // after the checks of 2026-11-16
    oneInText: oneInText
  };
  root.GemEngine = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
