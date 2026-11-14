// Bitcoin Quest kill switch. Everyone downloads this small file.
// It only reads config/killSwitch (public) and shows a calm maintenance
// page when the app is offline. It grants nothing: the server still
// blocks payouts and writes. A Firestore read error FAILS OPEN so a
// backend hiccup cannot brick the app. Admins keep using the app and
// can open Admin tools to turn it back on.
(function () {
    var DOC_PATH = 'config/killSwitch';
    var OVERLAY_ID = 'bqKillSwitchOverlay';
    var BANNER_ID = 'bqKillSwitchBanner';
    var MESSAGE = 'Bitcoin Quest is temporarily offline for maintenance.';
    var SUB = 'We\u2019ll be back shortly. Your sats and progress are safe.';
    // Long pause (Citadels build). Phil-approved copy, FINAL_COPY.md (Nov 14
    // 2026). Shown when the switch is on with no auto-return (the server caps
    // auto-return at 7 days, so the long pause never sets one). A short
    // maintenance flip with an auto-return keeps MESSAGE/SUB above.
    // Return date is one config value; survey.js RETURN_DATE must match.
    var OFFLINE_RETURN_DATE = 'January 3, 2027';
    var OFFLINE_BODY = 'We\'re building Citadels. Bitcoin Quest is back ' + OFFLINE_RETURN_DATE +
        '. Everything you\'ve earned is saved, including unclaimed Satoshi\'s Favor rewards. Want a heads-up when the gates open?';
    var OFFLINE_BUTTON = 'Get email updates';
    var OFFLINE_UNDER = 'Free. Unsubscribe anytime.';
    var REF_HEADLINE = 'A friend invited you to Bitcoin Quest';
    var REF_BODY = 'We\'re back ' + OFFLINE_RETURN_DATE + ' with our biggest update yet: Citadels. Sign up and we\'ll let you know the moment the game reopens.';
    var REF_BUTTON = 'Save my spot';
    var WAITLIST_PATH = '/waitlist';
    var unsub = null;
    var lastOn = false;
    var lastData = null;

    function nowMs() { return Date.now(); }

    function effectiveOn(data) {
        if (!data || data.enabled !== true) return false;
        var until = data.autoReenableAt;
        var ms = 0;
        if (until) {
            if (typeof until.toMillis === 'function') ms = until.toMillis();
            else if (typeof until.seconds === 'number') ms = until.seconds * 1000;
            else if (typeof until === 'number') ms = until;
        }
        if (ms && nowMs() >= ms) return false;
        return true;
    }

    function isAdmin() { return window._isAdminClaim === true; }

    function longPause(data) {
        return !!(data && data.enabled === true && !data.autoReenableAt);
    }

    function visitorRef() {
        var r = '';
        try { r = new URLSearchParams(window.location.search).get('ref') || ''; } catch (e) { r = ''; }
        r = String(r).trim();
        return /^[A-Za-z0-9_-]{1,40}$/.test(r) ? r : '';
    }

    function waitlistHref(ref, medium) {
        var q = 'utm_source=app&utm_medium=' + medium + '&utm_campaign=' + encodeURIComponent(ref || medium);
        if (ref) q = 'ref=' + encodeURIComponent(ref) + '&' + q;
        return WAITLIST_PATH + '?' + q;
    }

    function removeEl(id) {
        var el = document.getElementById(id);
        if (el && el.parentNode) el.parentNode.removeChild(el);
    }

    function ensureStyle() {
        if (document.getElementById('bqKillSwitchStyle')) return;
        var s = document.createElement('style');
        s.id = 'bqKillSwitchStyle';
        s.textContent =
            '#' + OVERLAY_ID + '{position:fixed;inset:0;z-index:460000;display:flex;align-items:center;justify-content:center;padding:24px;background:#0b1220;color:#e2e8f0;font-family:inherit;text-align:center;}' +
            '#' + OVERLAY_ID + ' .ks-card{max-width:420px;}' +
            '#' + OVERLAY_ID + ' .ks-mark{font-size:2rem;margin-bottom:12px;}' +
            '#' + OVERLAY_ID + ' .ks-title{font-size:1.35rem;font-weight:800;color:#fff;margin:0 0 10px;}' +
            '#' + OVERLAY_ID + ' .ks-sub{font-size:1rem;line-height:1.5;color:#94a3b8;margin:0;}' +
            '#' + OVERLAY_ID + ' .ks-body{font-size:1.08rem;line-height:1.55;color:#e2e8f0;margin:0 0 18px;}' +
            '#' + OVERLAY_ID + ' .ks-cta{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:10px 22px;border-radius:12px;background:#f7931a;color:#111;font-weight:800;text-decoration:none;font-size:1rem;}' +
            '#' + OVERLAY_ID + ' .ks-under{font-size:0.85rem;color:#94a3b8;margin:10px 0 0;}' +
            '#' + BANNER_ID + '{position:sticky;top:0;z-index:469000;display:flex;align-items:center;gap:12px;padding:10px 14px;background:#1a1408;color:#fde68a;border-bottom:1px solid #f7931a;font-family:inherit;}' +
            '#' + BANNER_ID + ' .ks-b-txt{flex:1;font-size:0.92rem;line-height:1.35;}' +
            '#' + BANNER_ID + ' .ks-b-btn{border:1px solid #f7931a;background:transparent;color:#fde68a;border-radius:10px;padding:8px 12px;font-weight:700;cursor:pointer;font-family:inherit;}';
        (document.head || document.documentElement).appendChild(s);
    }

    function showOverlay() {
        ensureStyle();
        removeEl(BANNER_ID);
        var kind = longPause(lastData) ? (visitorRef() ? 'ref' : 'pause') : 'maint';
        var existing = document.getElementById(OVERLAY_ID);
        if (existing && existing.getAttribute('data-kind') === kind) return;
        if (existing) removeEl(OVERLAY_ID);
        var el = document.createElement('div');
        el.id = OVERLAY_ID;
        el.setAttribute('role', 'alert');
        el.setAttribute('data-kind', kind);
        if (kind === 'maint') {
            el.innerHTML = '<div class="ks-card"><div class="ks-mark">\u26A0\uFE0F</div><p class="ks-title"></p><p class="ks-sub"></p></div>';
            el.querySelector('.ks-title').textContent = MESSAGE;
            el.querySelector('.ks-sub').textContent = SUB;
        } else {
            var ref = visitorRef();
            el.innerHTML = '<div class="ks-card"><p class="ks-title"></p><p class="ks-body"></p><a class="ks-cta"></a><p class="ks-under"></p></div>';
            var title = el.querySelector('.ks-title');
            if (kind === 'ref') title.textContent = REF_HEADLINE;
            else title.parentNode.removeChild(title);
            el.querySelector('.ks-body').textContent = kind === 'ref' ? REF_BODY : OFFLINE_BODY;
            var a = el.querySelector('.ks-cta');
            a.textContent = kind === 'ref' ? REF_BUTTON : OFFLINE_BUTTON;
            a.href = waitlistHref(ref, kind === 'ref' ? 'offline_ref' : 'offline_page');
            el.querySelector('.ks-under').textContent = OFFLINE_UNDER;
        }
        (document.body || document.documentElement).appendChild(el);
    }

    function showBanner() {
        ensureStyle();
        removeEl(OVERLAY_ID);
        if (document.getElementById(BANNER_ID)) return;
        var el = document.createElement('div');
        el.id = BANNER_ID;
        el.setAttribute('role', 'status');
        el.innerHTML = '<div class="ks-b-txt">The app is offline for everyone else. Admin tools still work, and you can turn it back on from there.</div>' +
            '<button type="button" class="ks-b-btn">Open Admin tools</button>';
        el.querySelector('.ks-b-btn').addEventListener('click', function () {
            if (typeof window.bqOpenAdminPanel === 'function') window.bqOpenAdminPanel();
            else if (typeof window.ensureHomeAdminBtn === 'function') window.ensureHomeAdminBtn();
            else if (typeof window.showToast === 'function') window.showToast('Open Admin tools from the home screen.');
        });
        var body = document.body;
        if (body) body.insertBefore(el, body.firstChild);
        else (document.documentElement || {}).appendChild(el);
    }

    function hideAll() {
        removeEl(OVERLAY_ID);
        removeEl(BANNER_ID);
    }

    function apply(on) {
        lastOn = !!on;
        window._bqKillSwitchOn = lastOn;
        if (typeof window.bqRefreshHomeNotices === 'function') {
            try { window.bqRefreshHomeNotices(); } catch (e) { /* notices are optional */ }
        }
        if (!lastOn) { hideAll(); return; }
        if (isAdmin()) showBanner();
        else showOverlay();
    }

    function listen() {
        if (unsub) return;
        if (typeof firebase === 'undefined' || !firebase.firestore) return;
        try {
            var db = firebase.firestore();
            unsub = db.doc(DOC_PATH).onSnapshot(function (snap) {
                lastData = snap && snap.exists ? snap.data() : null;
                apply(effectiveOn(lastData));
            }, function () {
                // Fail open.
                lastData = null;
                apply(false);
            });
        } catch (e) {
            apply(false);
        }
    }

    function boot() {
        listen();
        if (typeof firebase !== 'undefined' && firebase.auth) {
            try {
                firebase.auth().onAuthStateChanged(function () {
                    if (lastOn) apply(true);
                });
            } catch (e) { /* auth may not be ready */ }
        }
        // Claim may land after the first snapshot.
        var n = 0;
        var t = setInterval(function () {
            n++;
            if (lastOn) apply(true);
            if (n > 40) clearInterval(t);
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 0); });
    } else {
        setTimeout(boot, 0);
    }
    // Firebase SDKs are deferred; retry a few times if firestore is late.
    var tries = 0;
    var retry = setInterval(function () {
        tries++;
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            clearInterval(retry);
            listen();
        } else if (tries > 40) clearInterval(retry);
    }, 250);

    window.bqKillSwitchApply = apply;
})();
