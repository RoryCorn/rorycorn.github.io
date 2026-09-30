/* Quantum Boss site — nav, early-access form, contact link. No dependencies, no tracking. */
(function () {
  "use strict";

  // ---- nav: solid background once the page scrolls, and the mobile menu ----
  var nav = document.getElementById("nav");
  var toggle = nav.querySelector(".nav__toggle");
  var menu = document.getElementById("nav-menu");

  function onScroll() { nav.classList.toggle("is-scrolled", window.scrollY > 10); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  function setOpen(open) {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }
  toggle.addEventListener("click", function () { setOpen(!nav.classList.contains("is-open")); });
  menu.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && nav.classList.contains("is-open")) { setOpen(false); toggle.focus(); }
  });

  // ---- early access form ----
  // Posts form-encoded (a "simple" request, so no CORS preflight) to Rory's n8n
  // workflow, which validates, de-duplicates and stores the address.
  var form = document.getElementById("notify-form");
  var input = document.getElementById("notify-email");
  var status = document.getElementById("notify-status");
  var button = form.querySelector("button[type=submit]");
  var idle = status.textContent;
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function say(text, kind) {
    status.textContent = text;
    status.classList.toggle("is-ok", kind === "ok");
    status.classList.toggle("is-err", kind === "err");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = input.value.trim();
    if (!EMAIL.test(email) || email.length > 254) {
      say("Check that email address.", "err");
      input.focus();
      return;
    }
    button.disabled = true;
    button.textContent = "Sending…";
    say(idle, null);

    fetch(form.action, { method: "POST", body: new URLSearchParams(new FormData(form)) })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (r) {
        if (r.ok && r.data && r.data.status === "already") {
          say("You're already on the list. One message when it's ready.", "ok");
          form.reset();
        } else if (r.ok) {
          say("You're on the list. One message when the build is ready.", "ok");
          form.reset();
        } else if (r.data && r.data.status === "invalid") {
          say("Check that email address.", "err");
        } else {
          say("Couldn't reach the list just now. Please try again.", "err");
        }
      })
      .catch(function () { say("Couldn't reach the list just now. Please try again.", "err"); })
      .then(function () { button.disabled = false; button.textContent = "Get notified"; });
  });

  input.addEventListener("input", function () {
    if (status.classList.contains("is-err")) say(idle, null);
  });

  // ---- contact link, assembled at runtime so address-harvesting bots can't scrape it ----
  var contact = document.getElementById("contact");
  if (contact) {
    var addr = ["rcorn", "88"].join("") + String.fromCharCode(64) + ["gmail", "com"].join(".");
    var a = document.createElement("a");
    a.href = "mail" + "to:" + addr;
    a.innerHTML = 'Contact <span class="email"></span>';
    a.querySelector(".email").textContent = addr;
    contact.replaceWith(a);
  }
})();
