// App Check before Auth. Compat activate() only calls initialize() on a real
// ReCaptchaV3Provider. A plain object is wrapped as CustomProvider, so the
// inner provider never gets an app and getToken throws appCheck/recaptcha-error.
// Pass the provider instance, then initialize it again after activate().
// The first getToken() rejects when no real token exists yet, so Auth and
// Firestore are not held. A cached token past the SDK refresh point
// (issued + 50% of its TTL + 5 min, and never later than 5 min before
// expiry) is not handed back: that makes the refresher ask again immediately.
// A fresh reCAPTCHA exchange is fetched instead, and it rejects after 10s
// so the SDK backs off. claimSats and the other enforced callables wait on
// _btcAppCheckForClaim. If the reCAPTCHA script never loads, later waits
// fail immediately. Enforcement stays a console setting.
(function () {
    var SITE_KEY = '6Le37votAAAAAD3n0_u1uPxgcvm4XtmOEeK1Ti9j';
    var CONFIG = (typeof window !== 'undefined' && window.FIREBASE_CONFIG) || null;
    var REFRESH_OFFSET_MS = 300000;
    var inner = null;
    var originalGetToken = null;
    var real = null;
    var pending = null;

    // Same point the Firebase 9.23.0 refresher uses. At that moment it asks
    // again, and a repeat of this token schedules the next ask at 0ms.
    function pastRefreshPoint(tok) {
        if (!tok || !tok.token) return true;
        if (!(tok.expireTimeMillis > Date.now())) return true;
        var issued = tok.issuedAtTimeMillis;
        if (!(issued > 0) || issued > Date.now()) issued = tok.expireTimeMillis - 60 * 60 * 1000;
        var refreshAt = issued + 0.5 * (tok.expireTimeMillis - issued) + REFRESH_OFFSET_MS;
        var latest = tok.expireTimeMillis - REFRESH_OFFSET_MS;
        if (refreshAt > latest) refreshAt = latest;
        return Date.now() >= refreshAt;
    }

    function usable(tok) {
        return !!(tok && tok.token && !pastRefreshPoint(tok));
    }

    function noteScriptFailure(err) {
        if (window._btcRecaptchaFailed) return;
        var blob = String((err && err.code) || '') + ' ' + String((err && err.message) || '');
        if (blob.indexOf('recaptcha') !== -1) window._btcRecaptchaFailed = true;
    }

    function ensureInner() {
        if (inner) return inner;
        if (typeof firebase === 'undefined' || !firebase.appCheck || !firebase.appCheck.ReCaptchaV3Provider) return null;
        inner = new firebase.appCheck.ReCaptchaV3Provider(SITE_KEY);
        originalGetToken = inner.getToken.bind(inner);
        return inner;
    }

    function remember(tok) {
        if (tok && tok.token && tok.expireTimeMillis > Date.now()) real = tok;
        return usable(real) ? real : null;
    }

    function forceExchange() {
        var provider = ensureInner();
        if (!provider || typeof originalGetToken !== 'function') {
            noteScriptFailure({ code: 'appCheck/recaptcha-error' });
            return Promise.resolve(null);
        }
        return Promise.resolve().then(function () {
            return originalGetToken();
        }).then(function (tok) {
            return remember(tok);
        }).catch(function (err) {
            noteScriptFailure(err);
            return null;
        });
    }

    function startExchange() {
        if (usable(real)) return Promise.resolve(real);
        if (pending) return pending;
        pending = forceExchange().then(function (tok) {
            pending = null;
            return tok;
        }, function (err) {
            pending = null;
            throw err;
        });
        return pending;
    }

    function withTimeout(promise, ms) {
        var timer;
        var timed = new Promise(function (_, reject) {
            timer = setTimeout(function () {
                if (typeof window.grecaptcha === 'undefined') window._btcRecaptchaFailed = true;
                reject(new Error('app-check-unavailable'));
            }, ms);
        });
        return Promise.race([promise, timed]).then(function (value) {
            clearTimeout(timer);
            return value;
        }, function (err) {
            clearTimeout(timer);
            throw err;
        });
    }

    // The SDK calls this. A still-fresh token is returned. A token the
    // refresher would already consider due is exchanged, then rejected if
    // that exchange does not produce a new one within 10s.
    function nonBlockingGetToken() {
        if (window._btcRecaptchaFailed && !(usable(real))) {
            return Promise.reject(new Error('app-check-unavailable'));
        }
        if (usable(real)) return Promise.resolve(real);
        if (real && real.token && real.expireTimeMillis > Date.now()) {
            return withTimeout(forceExchange(), 10000).then(function (tok) {
                if (usable(tok)) return tok;
                if (typeof window.grecaptcha === 'undefined') window._btcRecaptchaFailed = true;
                return Promise.reject(new Error('app-check-unavailable'));
            }, function () {
                return Promise.reject(new Error('app-check-unavailable'));
            });
        }
        startExchange();
        return Promise.reject(new Error('app-check-unavailable'));
    }

    window._btcAppCheckForClaim = function (timeoutMs) {
        if (window._btcRecaptchaFailed) return Promise.resolve('');
        if (usable(real)) return Promise.resolve(real.token);
        var limit = typeof timeoutMs === 'number' ? timeoutMs : 8000;
        var timer;
        var timed = new Promise(function (resolve) {
            timer = setTimeout(function () {
                if (typeof window.grecaptcha === 'undefined') window._btcRecaptchaFailed = true;
                resolve('');
            }, limit);
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
            // Wrap before activate so the SDK never observes the raw provider.
            provider.getToken = nonBlockingGetToken;
            // Instance, not a plain object. Compat initialize() runs only then.
            firebase.appCheck().activate(provider, true);
            try { provider.initialize(firebase.app()); } catch (e) {}
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
