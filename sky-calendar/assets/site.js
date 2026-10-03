/* 13-Month Sky Calendar website: anonymous visit-count events for Umami.
 * Events never carry birth details: no dates, times, places or chart positions.
 *   "Draw chart"        {chart: "own" | "example"}  a chart drawn from the form
 *   "Save chart image"  {how: "share" | "download"} the save-image module calls SkyCalSite.onSaved(kind)
 *   "See why"           {planet: "Mars"}            a retrograde "See why" / "Why?" link
 * Loaded before the page's own scripts, so window.SkyCalSite exists when they run.
 * Umami intercepts clicks on <a data-umami-event> links (it cancels them and navigates itself),
 * so in-page links are counted from listeners here, never with that attribute. */
(function () {
  'use strict';

  function track(name, data) {
    try {
      if (window.umami && typeof window.umami.track === 'function') {
        if (data) window.umami.track(name, data); else window.umami.track(name);
      }
    } catch (e) { /* counting must never break the page */ }
  }

  var site = window.SkyCalSite = window.SkyCalSite || {};
  site.track = track;

  // HOOK for the "Save chart image" module: call window.SkyCalSite.onSaved(kind) once the image is saved,
  // kind = 'share' or 'download' (or dispatch a 'skycal-chart-saved' event on document, detail {kind}).
  // Counted once per save; the only data is how it was saved.
  site.onSaved = function (kind) { track('Save chart image', kind ? { how: String(kind) } : undefined); };
  document.addEventListener('skycal-chart-saved', function (e) { site.onSaved(e && e.detail && e.detail.kind); });

  // "Draw chart": the birth-chart form was submitted and a new chart was drawn.
  // The page's own submit handler runs between these two listeners (capture, then bubble),
  // so a changed NatalUI.current means the chart was drawn rather than refused.
  var before = null;
  function isChartForm(e) { return e.target && e.target.id === 'nbForm'; }
  function shown() { return window.NatalUI ? window.NatalUI.current : null; }
  document.addEventListener('submit', function (e) { if (isChartForm(e)) before = shown(); }, true);
  document.addEventListener('submit', function (e) {
    if (!isChartForm(e)) return;
    var now = shown();
    if (now && now !== before) track('Draw chart', { chart: now.isExample ? 'example' : 'own' });
  });

  // "See why": the retrograde links in the birth chart (and anywhere else they appear).
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[data-rt-planet]') : null;
    if (!a) return;
    var key = String(a.getAttribute('data-rt-planet') || '');
    var name = window.Retro && Retro.PLANETS && Retro.PLANETS[key] ? Retro.PLANETS[key].name : key.charAt(0).toUpperCase() + key.slice(1);
    track('See why', { planet: name });
  }, true);
})();
