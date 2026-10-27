// Start Firebase Auth before Firestore, callables, App Check, and the main bundle.
// LOCAL persistence (IndexedDB) is already the default. Do not call setPersistence
// here: it queues the first auth event behind another IndexedDB open.
(function () {
    var CONFIG = {
        apiKey: 'AIzaSyDLwucmRxjoJp2KMBTi2ujf0mlVkgLHyKk',
        authDomain: 'bitcoineducation.quest',
        projectId: 'bitcoin-education-archive',
        storageBucket: 'bitcoin-education-archive.firebasestorage.app',
        messagingSenderId: '1055248200518',
        appId: '1:1055248200518:web:6c6d64a5ee78e19bfbeb47'
    };
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
