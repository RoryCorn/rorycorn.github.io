/* =====================================================================
   WEB STORE — Stripe
   The iOS build unlocks through RevenueCat. On the web there is no App
   Store, so the same $1.99 unlock runs through Stripe Checkout against
   Rory's existing server (the one ProxiPals already uses for billing).

   Two ways in, because a browser is not a phone:
     1. Buy    -> Stripe Checkout -> redirected back with a session id,
                  which the SERVER verifies with Stripe before unlocking.
                  Nothing here trusts the browser's word that it paid.
     2. Redeem -> paste the code we emailed. Works on any device, which
                  is the whole reason the code exists: clearing site data
                  or switching phones must not cost someone their $1.99.

   Honest limit: the unlocked flag lives in localStorage, so a determined
   person can set it by hand. Every client-side paywall has that hole.
   What this does buy is that a REAL purchase is verified server-side and
   is restorable, which is what paying customers actually need.
   ===================================================================== */
(function () {
  "use strict";

  var CFG = window.SATB_WEB_CONFIG || {};
  var API = (CFG.apiBase || "https://proxipals.onrender.com").replace(/\/+$/, "");

  function nativePlatform() {
    try {
      var p = window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform();
      return p && p !== "web" ? p : null;
    } catch (e) { return null; }
  }

  async function postJSON(path, body) {
    var r = await fetch(API + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    var data = {};
    try { data = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error(data.error || ("Server returned " + r.status));
    return data;
  }

  async function getJSON(path) {
    var r = await fetch(API + path);
    var data = {};
    try { data = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error(data.error || ("Server returned " + r.status));
    return data;
  }

  window.SATB_WEB_STORE = {
    /* True when this is a browser rather than the Capacitor shell. */
    isWeb: function () { return !nativePlatform(); },

    /* Send them to Stripe. We hand the server the page to come back to so
       the same code works from a local file, a preview and the live site. */
    buy: async function () {
      var ret = location.origin + location.pathname;
      var d = await postJSON("/api/satb/checkout", { returnUrl: ret });
      if (!d.url) throw new Error("Stripe did not return a checkout URL.");
      location.href = d.url;
    },

    /* Called when Stripe sends them back. The SERVER asks Stripe whether
       that session is actually paid - the browser cannot fake this. */
    confirm: async function (sessionId) {
      return await getJSON("/api/satb/confirm?session_id=" + encodeURIComponent(sessionId));
    },

    /* Paste-the-code path, for a second device or a cleared browser. */
    redeem: async function (code) {
      return await postJSON("/api/satb/redeem", { code: String(code || "").trim() });
    }
  };
})();
