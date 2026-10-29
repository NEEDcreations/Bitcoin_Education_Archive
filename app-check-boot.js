// App Check before Auth. Compat activate() only calls initialize() on a real
// ReCaptchaV3Provider. A plain object is wrapped as CustomProvider, so the
// inner provider never gets an app and getToken throws appCheck/recaptcha-error.
// Pass the provider instance, then initialize it again after activate().
// getToken() rejects when a real token is not ready. The SDK then gives
// Auth and Firestore its own placeholder and backs the refresher off.
// A blank already-expired token would schedule the next refresh at 0ms.
// claimSats and the other enforced callables wait on _btcAppCheckForClaim.
// Enforcement stays a console setting.
(function () {
    var SITE_KEY = '6Le37votAAAAAD3n0_u1uPxgcvm4XtmOEeK1Ti9j';
    var CONFIG = (typeof window !== 'undefined' && window.FIREBASE_CONFIG) || null;
    var inner = null;
    var originalGetToken = null;
    var real = null;
    var pending = null;

    function fresh(tok) {
        return !!(tok && tok.token && tok.expireTimeMillis > Date.now() + 60000);
    }

    function ensureInner() {
        if (inner) return inner;
        if (typeof firebase === 'undefined' || !firebase.appCheck || !firebase.appCheck.ReCaptchaV3Provider) return null;
        inner = new firebase.appCheck.ReCaptchaV3Provider(SITE_KEY);
        originalGetToken = inner.getToken.bind(inner);
        return inner;
    }

    function startExchange() {
        if (fresh(real)) return Promise.resolve(real);
        if (pending) return pending;
        var provider = ensureInner();
        if (!provider || typeof originalGetToken !== 'function') return Promise.resolve(null);
        pending = Promise.resolve().then(function () {
            return originalGetToken();
        }).then(function (tok) {
            pending = null;
            if (tok && tok.token && tok.expireTimeMillis > Date.now()) real = tok;
            return real;
        }).catch(function () {
            pending = null;
            return null;
        });
        return pending;
    }

    // The SDK calls this. Reject so it does not cache a blank token or spin.
    function nonBlockingGetToken() {
        if (fresh(real)) return Promise.resolve(real);
        startExchange();
        if (fresh(real)) return Promise.resolve(real);
        return Promise.reject(new Error('app-check-unavailable'));
    }

    window._btcAppCheckForClaim = function (timeoutMs) {
        var limit = typeof timeoutMs === 'number' ? timeoutMs : 8000;
        if (fresh(real)) return Promise.resolve(real.token);
        var timer;
        var timed = new Promise(function (resolve) {
            timer = setTimeout(function () { resolve(''); }, limit);
        });
        return Promise.race([
            startExchange().then(function (tok) { return (tok && tok.token) || ''; }),
            timed
        ]).then(function (token) {
            if (timer) clearTimeout(timer);
            return token || '';
        });
    };

    window._btcActivateAppCheck = function () {
        if (window._btcAppCheckReady) return true;
        if (!CONFIG || !CONFIG.apiKey || typeof firebase === 'undefined' || !firebase.appCheck) return false;
        try {
            if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(CONFIG);
            var provider = ensureInner();
            if (!provider) return false;
            // Instance, not a plain object. Compat initialize() runs only then.
            firebase.appCheck().activate(provider, true);
            try { provider.initialize(firebase.app()); } catch (e) {}
            provider.getToken = nonBlockingGetToken;
            window._btcAppCheckInner = provider;
            window._btcAppCheckReady = true;
            return true;
        } catch (e) {
            return false;
        }
    };

    if (CONFIG && CONFIG.apiKey && typeof firebase !== 'undefined' && firebase.initializeApp && firebase.appCheck) {
        window._btcActivateAppCheck();
    }
    // firebase-config.js has run. The first applyBoot is before that file,
    // so the IndexedDB uid read has to happen again now.
    try {
        if (window.btcAuthDisplay && typeof window.btcAuthDisplay.applyBoot === 'function') {
            window.btcAuthDisplay.applyBoot();
        }
    } catch (e) {}
})();
