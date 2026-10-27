// Start Firebase Auth before Firestore, callables, App Check, and the main bundle.
// LOCAL persistence (IndexedDB) is already the default. Do not call setPersistence
// here: it queues the first auth event behind another IndexedDB open.
// The config object lives in firebase-config.js, loaded just before this file.
(function () {
    var CONFIG = (typeof window !== 'undefined' && window.FIREBASE_CONFIG) || null;
    if (!CONFIG || !CONFIG.apiKey) return;
    if (typeof firebase === 'undefined' || !firebase.initializeApp || !firebase.auth) return;
    try {
        if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(CONFIG);
    } catch (e) {
        return;
    }
    var auth = firebase.auth();
    window.auth = auth;
    try { if (window.performance && performance.mark) performance.mark('btc-auth-listen'); } catch (e) {}
    auth.onAuthStateChanged(function (user) {
        try { if (window.performance && performance.mark) performance.mark('btc-auth-state'); } catch (e) {}
        window._btcEarlyAuthUser = user || null;
        if (window.btcAuthDisplay && typeof window.btcAuthDisplay.reconcile === 'function') {
            window.btcAuthDisplay.reconcile(user || null);
        }
    });
})();
