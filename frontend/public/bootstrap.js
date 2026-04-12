// F-18a: first-executing script extracts the fragment and scrubs it from the
// URL bar before any other app script (or browser extension with document_idle
// timing) can read it. Kept in a standalone file so the nginx CSP can stay
// strict (script-src 'self'; no 'unsafe-inline', no per-deploy hash).
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
})();
