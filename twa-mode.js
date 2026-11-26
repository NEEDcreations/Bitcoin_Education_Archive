// Android app (TWA) mode. The Play wrapper opens /?client=android-twa, and
// Android sends an android-app:// referrer for quest.bitcoineducation.app.
// In that mode Premium / checkout and Kids / Classroom are not offered
// (Phil, Nov 25, 2026). On the plain website this file only defines
// window.bqIsTwa() (returns false) and changes nothing else.
(function (w, d) {
    'use strict';
    var KEY = 'bq_twa';
    var REFERRER_RE = /^android-app:\/\/quest\.bitcoineducation\.app(\/|$)/;
    var PAID_PATH_RE = /^\/(premium|checkout)(\.html)?(\/|$)/i;
    var KIDS_PATH_RE = /^\/(kids|classroom)(\.html)?(\/|$)/i;
    var PAID_HASH_RE = /^#\/?(premium|checkout|upgrade|billing)(\/|\?|$)/i;
    var KIDS_HASH_RE = /^#\/?(kids|classroom)(\/|\?|$)/i;
    var PAID_QUERY = ['premium', 'plan', 'session_id', 'checkout'];
    var PAID_CALLABLE_RE = /premium\w*checkout|checkout\w*premium|^createPremiumPortal$/i;
    var PAID_URL_RE = /premium\w*checkout|(checkout|billing)\.stripe\.com|btcpay/i;
    var HIDE_CSS = [
        '[data-twa-hide]', '[data-premium-entry]', '[data-kids-entry]', '[data-classroom-entry]',
        '#settingsPremiumBilling', '.premium-cta', '.kids-entry', '.classroom-entry',
        'a[href^="/premium"]', 'a[href*="premium.html"]', 'a[href*="?premium="]', 'a[href*="&premium="]',
        'a[href^="/checkout"]', 'a[href*="checkout.stripe.com"]', 'a[href*="billing.stripe.com"]',
        'a[href^="/kids"]', 'a[href^="/classroom"]', 'a[href^="#premium"]', 'a[href^="#kids"]', 'a[href^="#classroom"]'
    ];
    var COPY = {
        paid: 'Premium is not available in the Android app.',
        kids: 'Kids and Classroom are not available in the Android app.'
    };

    function store() { try { return w.sessionStorage; } catch (e) { return null; } }
    function detect() {
        var s = store();
        try { if (s && s.getItem(KEY) === '1') return true; } catch (e) {}
        try { if (REFERRER_RE.test(String(d.referrer || ''))) return true; } catch (e) {}
        try { if (new URLSearchParams(w.location.search || '').get('client') === 'android-twa') return true; } catch (e) {}
        return false;
    }

    var on = detect();
    w.bqIsTwa = function () { return on; };
    if (!on) return;

    try { var s0 = store(); if (s0) { s0.setItem(KEY, '1'); s0.removeItem('bq_premium_pending'); } } catch (e) {}
    d.documentElement.classList.add('bq-twa');

    var noticeShown = {};
    function notice(kind) {
        var text = COPY[kind] || COPY.paid;
        if (noticeShown[kind]) return;
        noticeShown[kind] = true;
        setTimeout(function () { noticeShown[kind] = false; }, 3000);
        function show() {
            if (typeof w.showToast === 'function') { try { w.showToast(text); return; } catch (e) {} }
            if (!d.body) return;
            var el = d.createElement('div');
            el.setAttribute('role', 'status');
            el.className = 'bq-twa-notice';
            el.textContent = text;
            el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:100000;background:#111827;color:#fff;border:1px solid #f7931a;border-radius:10px;padding:10px 14px;font:600 14px/1.3 system-ui,sans-serif;max-width:90vw;text-align:center;';
            d.body.appendChild(el);
            setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 4000);
        }
        if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', show); else show();
    }
    w.bqTwaNotice = notice;

    // CSS hiding for every known and future entry point.
    var style = d.createElement('style');
    style.id = 'bqTwaHide';
    style.textContent = HIDE_CSS.map(function (sel) { return 'html.bq-twa ' + sel; }).join(',\n') + '{display:none!important}';
    (d.head || d.documentElement).appendChild(style);
    function markBody() { if (d.body) d.body.classList.add('bq-twa'); }
    if (d.body) markBody(); else d.addEventListener('DOMContentLoaded', markBody);

    // Routes: a hidden page or hash must not open through a deep link.
    function cleanUrl(path, search, hash) {
        try { w.history.replaceState(w.history.state, '', path + search + hash); } catch (e) {}
    }
    function guardRoute() {
        var loc = w.location;
        var path = loc.pathname || '/';
        var hash = loc.hash || '';
        var kind = '';
        if (PAID_PATH_RE.test(path)) kind = 'paid';
        else if (KIDS_PATH_RE.test(path)) kind = 'kids';
        if (kind) { notice(kind); try { loc.replace('/'); } catch (e) {} return kind; }
        if (PAID_HASH_RE.test(hash)) kind = 'paid';
        else if (KIDS_HASH_RE.test(hash)) kind = 'kids';
        var search = loc.search || '';
        var params;
        try { params = new URLSearchParams(search); } catch (e) { params = null; }
        var strip = false;
        if (params) {
            PAID_QUERY.forEach(function (k) { if (params.has(k)) { params.delete(k); strip = true; } });
        }
        if (strip && !kind) kind = 'paid';
        if (!kind) return '';
        var q = params ? params.toString() : '';
        cleanUrl(path, q ? '?' + q : '', (PAID_HASH_RE.test(hash) || KIDS_HASH_RE.test(hash)) ? '' : hash);
        notice(kind);
        return kind;
    }
    guardRoute();
    w.addEventListener('hashchange', guardRoute);
    w.addEventListener('popstate', guardRoute);

    // Hidden links stay unreachable even if CSS fails to apply.
    d.addEventListener('click', function (e) {
        var t = e.target;
        while (t && t !== d && !(t.tagName === 'A' && t.getAttribute)) t = t.parentNode;
        if (!t || t === d) return;
        var href = t.getAttribute('href') || '';
        var path = href;
        var hash = href.charAt(0) === '#' ? href : '';
        try {
            var u = new URL(href, w.location.href);
            if (u.host === w.location.host) { path = u.pathname; hash = u.hash; }
        } catch (err) {}
        var kind = '';
        if (/^(https?:)?\/\/(checkout|billing)\.stripe\.com/i.test(href) || /[?&]premium=/i.test(href) || PAID_PATH_RE.test(path) || PAID_HASH_RE.test(hash)) kind = 'paid';
        else if (KIDS_PATH_RE.test(path) || KIDS_HASH_RE.test(hash)) kind = 'kids';
        if (!kind) return;
        e.preventDefault();
        e.stopPropagation();
        notice(kind);
    }, true);

    // Direct calls: Premium openers become a notice and nothing else.
    function blockedOpener() { notice('paid'); return false; }
    ['bqOpenPremium', 'bqPremiumBilling'].forEach(function (name) {
        try {
            Object.defineProperty(w, name, {
                configurable: false,
                get: function () { return blockedOpener; },
                set: function () {}
            });
        } catch (e) {}
    });

    // Checkout callables and checkout fetches reject before any request.
    function blockedError() {
        var err = new Error(COPY.paid);
        err.code = 'twa-blocked';
        return err;
    }
    function guardCallables() {
        if (typeof w.firebase === 'undefined' || !w.firebase.functions) return false;
        var probe;
        try { probe = w.firebase.functions(); } catch (e) { return false; }
        var proto = probe && Object.getPrototypeOf(probe);
        if (!proto || typeof proto.httpsCallable !== 'function') return false;
        if (proto.httpsCallable._bqTwaGuard) return true;
        var orig = proto.httpsCallable;
        var guarded = function (name) {
            if (PAID_CALLABLE_RE.test(String(name || ''))) {
                return function () { notice('paid'); return Promise.reject(blockedError()); };
            }
            return orig.apply(this, arguments);
        };
        guarded._bqTwaGuard = true;
        if (orig._mfaPatched) guarded._mfaPatched = true;
        proto.httpsCallable = guarded;
        return true;
    }
    w.bqTwaGuardCallables = guardCallables;
    if (!guardCallables()) {
        d.addEventListener('DOMContentLoaded', guardCallables);
        w.addEventListener('load', guardCallables);
    }
    if (typeof w.fetch === 'function') {
        var origFetch = w.fetch;
        w.fetch = function (input) {
            var url = '';
            try { url = typeof input === 'string' ? input : (input && input.url) || String(input || ''); } catch (e) {}
            if (PAID_URL_RE.test(url)) { notice('paid'); return Promise.reject(blockedError()); }
            return origFetch.apply(w, arguments);
        };
    }
})(window, document);
