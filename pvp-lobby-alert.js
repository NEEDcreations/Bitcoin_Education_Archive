// Lobby alert. One listener on pvp_lobby_live/current. Names go through textContent.
(function () {
    'use strict';

    var COOLDOWN_MS = 10 * 60 * 1000;
    var STALE_MS = 45000;
    var MUTE_KEY = 'btc_pvp_alerts_muted';
    var AT_KEY = 'btc_pvp_alert_at';
    var SEEN_KEY = 'btc_pvp_alert_seen';
    var unsub = null;
    var shownKey = '';

    function muted() {
        return localStorage.getItem(MUTE_KEY) === '1';
    }

    function inPvp() {
        if (window._pvpSessionActive) return true;
        if (document.getElementById('pvpOverlay')) return true;
        var hash = (location.hash || '').replace('#', '').split('/')[0].toLowerCase();
        return hash === 'pvp';
    }

    function overlayOpen(id) {
        var el = document.getElementById(id);
        if (!el) return false;
        if (el.classList.contains('open')) return true;
        var display = el.style.display;
        return display === 'flex' || display === 'block';
    }

    function busy() {
        if (window._scholarExamActive) return true;
        return overlayOpen('questModal') || overlayOpen('usernameModal') || overlayOpen('donateModal') || overlayOpen('spinModal');
    }

    function loadSeen() {
        try {
            var parsed = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}');
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (e) {
            return {};
        }
    }

    function remember(key) {
        if (!key) return;
        var seen = loadSeen();
        seen[key] = Date.now();
        var keys = Object.keys(seen);
        if (keys.length > 30) {
            keys.sort(function (a, b) { return seen[a] - seen[b]; });
            keys.slice(0, keys.length - 30).forEach(function (k) { delete seen[k]; });
        }
        localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    }

    function freshEntries(entries) {
        var now = Date.now();
        var out = [];
        var src = entries || {};
        Object.keys(src).forEach(function (id) {
            var row = src[id];
            if (!row || !row.uid) return;
            var seen = Number(row.lastSeen) || 0;
            if (!seen || (now - seen) >= STALE_MS) return;
            out.push(row);
        });
        out.sort(function (a, b) { return (Number(b.since) || 0) - (Number(a.since) || 0); });
        return out;
    }

    function myUid() {
        try {
            return firebase.auth().currentUser ? firebase.auth().currentUser.uid : '';
        } catch (e) {
            return '';
        }
    }

    function dismiss(mark) {
        var el = document.getElementById('pvpLobbyAlert');
        if (el && el.getAttribute('data-debug') === '1' && !mark) return;
        if (mark && shownKey) {
            remember(shownKey);
            localStorage.setItem(AT_KEY, String(Date.now()));
        }
        shownKey = '';
        if (el) el.remove();
    }

    window._pvpDismissLobbyAlert = function () { dismiss(true); };

    window._pvpSyncAlertMute = function (isMuted) {
        localStorage.setItem(MUTE_KEY, isMuted ? '1' : '0');
        if (isMuted) dismiss(false);
        try {
            var user = firebase.auth().currentUser;
            if (user) {
                firebase.firestore().collection('users').doc(user.uid).set({
                    pvpAlertsMuted: !!isMuted
                }, { merge: true }).catch(function () {});
            }
        } catch (e) {}
    };

    window._pvpSyncPushOptIn = function (on) {
        localStorage.setItem('btc_pvp_push', on ? '1' : '0');
        try {
            var user = firebase.auth().currentUser;
            if (!user) return;
            var ref = firebase.firestore().collection('users').doc(user.uid);
            if (on) {
                ref.set({
                    pvpPushEnabled: true,
                    pvpPushShard: Math.floor(Math.random() * 10)
                }, { merge: true }).catch(function () {});
            } else {
                ref.set({
                    pvpPushEnabled: false,
                    pvpPushShard: firebase.firestore.FieldValue.delete()
                }, { merge: true }).catch(function () {});
            }
        } catch (e) {}
    };

    function joinLobby() {
        dismiss(true);
        function go() {
            if (typeof window.enterPVPMode === 'function') window.enterPVPMode();
        }
        if (typeof window.enterPVPMode === 'function') { go(); return; }
        var src = 'pvp.js?v=20261026_v2391';
        var existing = document.querySelector('script[src="' + src + '"]');
        if (existing) { setTimeout(go, 400); return; }
        var s = document.createElement('script');
        s.src = src;
        s.onload = function () { setTimeout(go, 50); };
        document.body.appendChild(s);
    }

    function ensureStyle() {
        if (document.getElementById('pvpLobbyAlertStyle')) return;
        var style = document.createElement('style');
        style.id = 'pvpLobbyAlertStyle';
        style.textContent = ''
            + '#pvpLobbyAlert{position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 84px);z-index:260000;max-width:420px;margin:0 auto;'
            + 'background:#0f172a;color:#fff;border:1px solid rgba(255,255,255,.14);'
            + 'border-radius:16px;box-shadow:0 16px 40px rgba(0,0,0,.35);padding:14px;font-family:inherit;}'
            + '#pvpLobbyAlert p{margin:0;font-size:1rem;font-weight:700;line-height:1.35;}'
            + '#pvpLobbyAlert .pvp-alert-top{display:flex;align-items:flex-start;gap:8px;}'
            + '#pvpLobbyAlert .pvp-alert-top p{flex:1;}'
            + '#pvpLobbyAlert button{font-family:inherit;cursor:pointer;}'
            + '#pvpLobbyAlertJoin{width:100%;margin-top:12px;padding:14px 16px;border:none;border-radius:12px;'
            + 'background:var(--accent,#f7931a);color:#fff;font-size:1.05rem;font-weight:800;}'
            + '#pvpLobbyAlertLater,#pvpLobbyAlertClose,#pvpLobbyAlertMore{background:transparent;color:var(--text-muted,#aaa);'
            + 'border:1px solid var(--border,rgba(255,255,255,.14));border-radius:10px;padding:8px 12px;font-weight:700;}'
            + '#pvpLobbyAlertRow{display:flex;gap:8px;margin-top:8px;align-items:center;}'
            + '#pvpLobbyAlertLater{flex:1;}'
            + '#pvpLobbyAlertMenu{margin-top:8px;}'
            + '#pvpLobbyAlertMute{width:100%;padding:10px;border-radius:10px;border:1px solid var(--border,rgba(255,255,255,.14));'
            + 'background:var(--bg-side,transparent);color:var(--text,#fff);font-weight:700;}'
            + '@media (max-width:899px){#pvpLobbyAlert{bottom:min(calc(env(safe-area-inset-bottom,0px) + 168px + 40vh), calc(100vh - 230px));}}'
            + '@media (min-width:900px){#pvpLobbyAlert{left:auto;right:24px;bottom:24px;width:380px;}}'
            + '[data-theme="light"] #pvpLobbyAlert{background:#ffffff;color:#0f172a;border-color:rgba(15,23,42,.12);}';
        document.head.appendChild(style);
    }

    function showSheet(entry, debug) {
        ensureStyle();
        var existing = document.getElementById('pvpLobbyAlert');
        if (existing) existing.remove();
        var root = document.createElement('div');
        root.id = 'pvpLobbyAlert';
        if (debug) root.setAttribute('data-debug', '1');
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', 'PvP lobby');

        var top = document.createElement('div');
        top.className = 'pvp-alert-top';
        var text = document.createElement('p');
        text.appendChild(document.createTextNode('⚔️ '));
        var name = document.createElement('span');
        name.textContent = String(entry.name || 'A Bitcoiner');
        text.appendChild(name);
        text.appendChild(document.createTextNode(' is waiting for a PvP match!'));
        var close = document.createElement('button');
        close.id = 'pvpLobbyAlertClose';
        close.type = 'button';
        close.setAttribute('aria-label', 'Dismiss');
        close.textContent = '✕';
        close.addEventListener('click', function () { dismiss(true); });
        top.appendChild(text);
        top.appendChild(close);

        var join = document.createElement('button');
        join.id = 'pvpLobbyAlertJoin';
        join.type = 'button';
        join.textContent = 'Join lobby';
        join.addEventListener('click', joinLobby);

        var row = document.createElement('div');
        row.id = 'pvpLobbyAlertRow';
        var later = document.createElement('button');
        later.id = 'pvpLobbyAlertLater';
        later.type = 'button';
        later.textContent = 'Not now';
        later.addEventListener('click', function () { dismiss(true); });
        var more = document.createElement('button');
        more.id = 'pvpLobbyAlertMore';
        more.type = 'button';
        more.setAttribute('aria-label', 'More');
        more.textContent = '⋯';
        var menu = document.createElement('div');
        menu.id = 'pvpLobbyAlertMenu';
        menu.hidden = true;
        var mute = document.createElement('button');
        mute.id = 'pvpLobbyAlertMute';
        mute.type = 'button';
        mute.textContent = 'Mute PvP alerts';
        mute.addEventListener('click', function () {
            if (window._pvpSyncAlertMute) window._pvpSyncAlertMute(true);
            else localStorage.setItem(MUTE_KEY, '1');
            dismiss(true);
        });
        more.addEventListener('click', function () { menu.hidden = !menu.hidden; });
        menu.appendChild(mute);
        row.appendChild(later);
        row.appendChild(more);

        root.appendChild(top);
        root.appendChild(join);
        root.appendChild(row);
        root.appendChild(menu);
        document.body.appendChild(root);
        if (!debug) shownKey = String(entry.uid) + ':' + String(entry.since || 0);
    }

    window._pvpDebugShowAlert = function (name) {
        showSheet({ uid: 'debug', name: name || 'Satoshi', since: Date.now(), lastSeen: Date.now() }, true);
    };

    function consider(entries) {
        var rows = freshEntries(entries);
        var mine = myUid();
        if (shownKey) {
            var still = rows.some(function (row) { return (row.uid + ':' + String(row.since || 0)) === shownKey; });
            if (!still || inPvp()) dismiss(true);
        }
        if (document.getElementById('pvpLobbyAlert')) return;
        if (muted() || inPvp() || busy() || !mine) return;
        var last = Number(localStorage.getItem(AT_KEY) || 0);
        if (last && (Date.now() - last) < COOLDOWN_MS) return;
        var seen = loadSeen();
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            if (row.uid === mine) continue;
            var key = row.uid + ':' + String(row.since || 0);
            if (seen[key]) continue;
            showSheet(row, false);
            return;
        }
    }

    function syncMuteFromProfile(uid) {
        firebase.firestore().collection('users').doc(uid).get().then(function (doc) {
            if (!doc.exists) return;
            if (doc.data().pvpAlertsMuted === true) localStorage.setItem(MUTE_KEY, '1');
            else if (doc.data().pvpAlertsMuted === false) localStorage.setItem(MUTE_KEY, '0');
        }).catch(function () {});
    }

    function listen(user) {
        if (unsub) { unsub(); unsub = null; }
        if (!user) { dismiss(false); return; }
        syncMuteFromProfile(user.uid);
        unsub = firebase.firestore().collection('pvp_lobby_live').doc('current').onSnapshot(function (doc) {
            var data = doc.exists ? (doc.data() || {}) : {};
            consider(data.entries || {});
        }, function (err) {
            console.error('PvP lobby alert listener:', err);
        });
    }

    function boot() {
        if (typeof firebase === 'undefined' || !firebase.auth || !firebase.firestore) {
            setTimeout(boot, 500);
            return;
        }
        firebase.auth().onAuthStateChanged(listen);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
