// App Check before Auth. Firebase's first auth check waits on an App Check
// token, so this runs right after firebase-config.js and before auth-boot.js.
// Same reCAPTCHA v3 site key and activate() call as ranking.js. Enforcement
// stays a console setting. ranking.js skips a second activate when this worked.
(function () {
    var SITE_KEY = '6Le37votAAAAAD3n0_u1uPxgcvm4XtmOEeK1Ti9j';
    var CONFIG = (typeof window !== 'undefined' && window.FIREBASE_CONFIG) || null;
    if (CONFIG && CONFIG.apiKey && typeof firebase !== 'undefined' && firebase.initializeApp && firebase.appCheck) {
        try {
            if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(CONFIG);
            if (!window._btcAppCheckReady) {
                firebase.appCheck().activate(SITE_KEY, true);
                window._btcAppCheckReady = true;
            }
        } catch (e) {}
    }
    // firebase-config.js has run. The first applyBoot is before that file,
    // so the IndexedDB uid read has to happen again now.
    try {
        if (window.btcAuthDisplay && typeof window.btcAuthDisplay.applyBoot === 'function') {
            window.btcAuthDisplay.applyBoot();
        }
    } catch (e) {}
})();
