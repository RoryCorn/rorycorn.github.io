/* Synesthesia site — nav, the fixed-design figures, and "Download the app". No dependencies, no tracking. */
(function () {
  "use strict";

  // ---- nav: the mobile menu ----
  var nav = document.getElementById("nav");
  var toggle = nav.querySelector(".nav__toggle");
  var menu = document.getElementById("nav-menu");
  function setOpen(open) {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }
  toggle.addEventListener("click", function () { setOpen(!nav.classList.contains("is-open")); });
  menu.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && nav.classList.contains("is-open")) { setOpen(false); toggle.focus(); }
  });

  // ---- figures drawn at a fixed design size (the open diary, the map) scale to their column ----
  var figs = [].slice.call(document.querySelectorAll("[data-fit]"));
  function fit() {
    figs.forEach(function (f) {
      var s = f.clientWidth / Number(f.getAttribute("data-fit"));
      if (s > 0) f.style.setProperty("--s", Math.min(1, s).toFixed(4));
    });
  }
  if ("ResizeObserver" in window) new ResizeObserver(fit).observe(document.documentElement);
  else window.addEventListener("resize", fit);
  fit();

  // ---- "Download the app" ----
  // Chrome and Edge (Android, Windows, Mac, Chromebook) can install straight from this page:
  // the manifest is linked here and the browser hands over its install prompt. Everywhere else
  // (iPhone and iPad, Safari on a Mac, Firefox) the link opens the app with ?install, which shows
  // the steps for that browser; on iPhone the Home Screen icon must be added from the app page
  // itself, which is why those steps live there.
  // The visit counter (Umami: anonymous, no cookies). These buttons are counted here rather than with
  // data-umami-event, because Umami's own click handling would follow the link and skip the install prompt.
  function count(name, data) {
    try { if (window.umami) return Promise.resolve(window.umami.track(name, data)); } catch (e) {}
    return Promise.resolve();
  }
  var links = [].slice.call(document.querySelectorAll("[data-install]"));
  var standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  var deferred = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; });
  window.addEventListener("appinstalled", function () {
    deferred = null;
    count("App installed");
    links.forEach(function (a) {
      a.lastChild.textContent = "Installed · open Synesthesia";
      a.href = "app/";
      a.removeAttribute("data-install");
    });
  });
  links.forEach(function (a) {
    a.addEventListener("click", function (e) {
      if (standalone) { e.preventDefault(); location.href = "app/"; return; }
      if (!a.hasAttribute("data-install")) return;                     // already installed: just open it
      var where = a.getAttribute("data-where") || "";
      e.preventDefault();
      if (!deferred) {
        // No one-click install in this browser: count the click, then open the app's install steps.
        var gone = false, go = function () { if (!gone) { gone = true; location.href = a.href; } };
        setTimeout(go, 400);
        count("Download the app", { where: where, how: "steps" }).then(go, go);
        return;
      }
      count("Download the app", { where: where, how: "one-click" });
      var d = deferred; deferred = null;
      d.prompt();
      if (d.userChoice) d.userChoice.then(function (r) { count("Install prompt", { outcome: r && r.outcome }); }, function () {});
    });
  });
})();
