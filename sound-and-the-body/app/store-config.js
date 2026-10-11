/* =====================================================================
   STORE / PURCHASE CONFIG
   RevenueCat *public* SDK keys are safe to ship in the app (they are
   publishable, not secret). Fill these in after you create a RevenueCat
   project and connect it to App Store Connect + Google Play.
   Leave them blank to run in "trial only" mode (no live purchases).
   See MONETIZATION.md for the full setup.
   ===================================================================== */
window.SATB_STORE_CONFIG = {
  // RevenueCat public API keys (from app.revenuecat.com → Project → API keys)
  revenueCatAppleKey: "appl_fSZcefcCZPiYiFiTVaEtAvWmVnm",     // e.g. "appl_XXXXXXXXXXXX"
  revenueCatGoogleKey: "",    // e.g. "goog_XXXXXXXXXXXX"

  // The entitlement identifier you create in RevenueCat (grants full access)
  entitlementId: "full_unlock",

  // Trial length in days
  trialDays: 7,

  // Shown on the paywall (keep in sync with your store product price)
  priceLabel: "$1.99"
};
