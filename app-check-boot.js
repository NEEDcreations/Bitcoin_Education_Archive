// App Check before Auth. The SDK attaches a token to Auth and Firestore, and
// it waits on getToken() before the first signed-in restore. reCAPTCHA can
// hang or 403 when Edge Tracking Prevention blocks the challenge iframe, so
// this provider never makes those calls wait. A missing token is not cached
// as success. claimSats and the other enforced callables wait separately and
// the server still rejects a request with no token. Enforcement stays a
// console setting. ranking.js skips a second activate when this worked.
(function () {
    var SITE_KEY = '6Le37votAAAAAD3n0_u1uPxgcvm4XtmOEeK1Ti9j';
    var CONFIG = (typeof window !== 'undefined' && window.FIREBASE_CONFIG) || null;
    var real = null;
    var inflight = null;
    var failedUntil = 0;

    function emptyToken() {
        // Already expired, so the SDK calls getToken again instead of
        // reusing a blank token for the hour.
        return { token: '', expireTimeMillis: Date.now() - 1 };
    }

    function remember(tok) {
        if (tok && tok.token) {
            real = tok;
            failedUntil = 0;
            return real;
        }
        failedUntil = Date.now() + 20000;
        return null;
    }

    function innerProvider() {
        try {
            if (firebase.appCheck && firebase.appCheck.ReCaptchaV3Provider) {
                return new firebase.appCheck.ReCaptchaV3Provider(SITE_KEY);
            }
        } catch (e) {}
        return null;
    }

    function exchange(provider, timeoutMs) {
        if (real && real.token && real.expireTimeMillis > Date.now() + 60000) {
            return Promise.resolve(real);
        }
        if (inflight) return inflight;
        var limit = typeof timeoutMs === 'number' ? timeoutMs : 8000;
        var timer;
        var timed = new Promise(function (resolve) {
            timer = setTimeout(function () { resolve(null); }, limit);
        });
        var attempt = provider
            ? Promise.resolve().then(function () { return provider.getToken(); }).catch(function () { return null; })
            : Promise.resolve(null);
        inflight = Promise.race([attempt, timed]).then(function (tok) {
            if (timer) clearTimeout(timer);
            inflight = null;
            return remember(tok);
        });
        return inflight;
    }

    function nonBlockingProvider(provider) {
        exchange(provider, 8000);
        return {
            getToken: function () {
                if (real && real.token && real.expireTimeMillis > Date.now() + 30000) {
                    return Promise.resolve(real);
                }
                if (!failedUntil || Date.now() >= failedUntil) exchange(provider, 8000);
                if (real && real.token) return Promise.resolve(real);
                return Promise.resolve(emptyToken());
            }
        };
    }

    window._btcAppCheckForClaim = function (timeoutMs) {
        var provider = window._btcAppCheckInner;
        if (!provider && typeof firebase !== 'undefined') provider = innerProvider();
        return exchange(provider, typeof timeoutMs === 'number' ? timeoutMs : 8000).then(function (tok) {
            return (tok && tok.token) || '';
        });
    };

    window._btcActivateAppCheck = function () {
        if (window._btcAppCheckReady) return true;
        if (!CONFIG || !CONFIG.apiKey || typeof firebase === 'undefined' || !firebase.appCheck) return false;
        try {
            if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(CONFIG);
            var provider = innerProvider();
            window._btcAppCheckInner = provider;
            firebase.appCheck().activate(provider ? nonBlockingProvider(provider) : nonBlockingProvider(null), true);
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
