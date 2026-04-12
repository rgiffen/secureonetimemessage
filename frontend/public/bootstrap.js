// Runs before any app script. Two jobs:
//
// 1. F-18a: extract the URL fragment (K_link) into a module-level global
//    and scrub it from the address bar before any other script / browser
//    extension / analytics tag can read it.
//
// 2. Apply the user's theme preference before React renders, so we don't
//    flash the wrong theme. Order of precedence:
//      a. explicit value in localStorage under "securedrop.theme"
//      b. prefers-color-scheme: dark
//      c. light (default)
(function () {
  try {
    var hash = window.location.hash;
    if (hash && hash.length > 1) {
      window.__SECUREDROP_K_LINK__ = hash.slice(1);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  } catch (e) {
    // best-effort
  }

  try {
    var stored = null;
    try { stored = localStorage.getItem("securedrop.theme"); } catch (e) { /* storage blocked */ }
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var useDark = stored === "dark" || (stored !== "light" && prefersDark);
    if (useDark) {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {
    // best-effort
  }
})();
