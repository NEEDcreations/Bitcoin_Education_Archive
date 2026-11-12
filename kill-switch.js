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
    var unsub = null;
    var lastOn = false;

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
            '#' + BANNER_ID + '{position:sticky;top:0;z-index:469000;display:flex;align-items:center;gap:12px;padding:10px 14px;background:#1a1408;color:#fde68a;border-bottom:1px solid #f7931a;font-family:inherit;}' +
            '#' + BANNER_ID + ' .ks-b-txt{flex:1;font-size:0.92rem;line-height:1.35;}' +
            '#' + BANNER_ID + ' .ks-b-btn{border:1px solid #f7931a;background:transparent;color:#fde68a;border-radius:10px;padding:8px 12px;font-weight:700;cursor:pointer;font-family:inherit;}';
        (document.head || document.documentElement).appendChild(s);
    }

    function showOverlay() {
        ensureStyle();
        removeEl(BANNER_ID);
        if (document.getElementById(OVERLAY_ID)) return;
        var el = document.createElement('div');
        el.id = OVERLAY_ID;
        el.setAttribute('role', 'alert');
        el.innerHTML = '<div class="ks-card"><div class="ks-mark">\u26A0\uFE0F</div><p class="ks-title"></p><p class="ks-sub"></p></div>';
        el.querySelector('.ks-title').textContent = MESSAGE;
        el.querySelector('.ks-sub').textContent = SUB;
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
                apply(effectiveOn(snap && snap.exists ? snap.data() : null));
            }, function () {
                // Fail open.
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
