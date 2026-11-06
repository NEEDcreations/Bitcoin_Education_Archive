// Runs after bundle.min.js (both are defer, in document order).
// loadUser queues bundle-only work until this signal so an early auth
// event cannot throw on a global the bundle has not created yet.
window._btcBundleReady = true;
try { window.dispatchEvent(new Event('btc-bundle-ready')); } catch (e) {}
