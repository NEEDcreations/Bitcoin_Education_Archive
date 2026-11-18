// Guest access: one shared place for "is this player a guest?", the quiet
// guest sign-in a mini app uses when it needs a uid, and the guest notices.
// A guest is a visitor with no auth or a Firebase anonymous session. Guests can
// play every mini app. Rewards (XP, badges, OrangeTix, sats) and chat need a
// login. The server enforces that; these notices only explain it.
// Every notice opens the existing sign-in entry point (showSignInPrompt).
;(function (root) {
    'use strict';
    var win = (typeof window !== 'undefined') ? window : root;

    var COPY = {
        banner: 'Playing as a guest. Log in to earn XP, badges, OrangeTix and sats, and to chat.',
        tctv: 'Sign in to earn XP, badges and sats while you watch, and to join the chat.',
        chat: 'Sign in to chat',
        link: 'Log in to connect an account or wallet.',
        // Shown only where a reward would appear after a result. {n} is the amount.
        reward: '+{n} XP if logged in',
        // Same rule for a non-XP prize (tickets, items) after a result.
        prize: '{prize} if logged in',
        login: 'Log in',
        dismiss: 'Dismiss'
    };

    var PROGRESS_KEY = 'btc_guest_progress_v1';
    var BANNER_KEY = 'btc_guest_banner_seen_v1';

    function getAuth() {
        try { if (typeof win.auth !== 'undefined' && win.auth) return win.auth; } catch (e) {}
        try { if (typeof firebase !== 'undefined' && firebase.auth) return firebase.auth(); } catch (e2) {}
        return null;
    }

    function currentAuthUser() {
        var a = getAuth();
        return a && a.currentUser ? a.currentUser : null;
    }

    // No user, or an anonymous one, is a guest.
    function isGuest(user) {
        var u = arguments.length ? user : currentAuthUser();
        return !u || u.isAnonymous === true;
    }

    function openSignIn() {
        if (typeof win.showSignInPrompt === 'function') { win.showSignInPrompt(); return true; }
        if (typeof win.showUsernamePrompt === 'function') { win.showUsernamePrompt(); return true; }
        return false;
    }

    function toast(msg) {
        if (typeof win.showToast === 'function') { try { win.showToast(msg); } catch (e) {} }
    }

    // Account links (wallet, Lightning address, Strava) need a login.
    // Returns true when the caller may continue.
    function requireLogin(message) {
        if (!isGuest()) return true;
        toast(message || COPY.link);
        openSignIn();
        return false;
    }

    var _pending = null;
    var state = { anonDisabled: false, lastError: '' };

    // A mini app that needs a uid calls this. A visitor with no auth gets a
    // quiet anonymous session. It never runs while an email link or account
    // link hold is in progress, and never replaces a real session.
    function ensureGuestSession(appId) {
        var a = getAuth();
        if (!a) return Promise.resolve(null);
        if (a.currentUser) return Promise.resolve(a.currentUser);
        try {
            if (typeof win.anonymousSignInBlockedNow === 'function' && win.anonymousSignInBlockedNow()) return Promise.resolve(null);
        } catch (e) { return Promise.resolve(null); }
        if (state.anonDisabled || typeof a.signInAnonymously !== 'function') return Promise.resolve(null);
        if (_pending) return _pending;
        state.app = String(appId || '').slice(0, 40);
        _pending = Promise.resolve().then(function () { return a.signInAnonymously(); }).then(function (cred) {
            _pending = null;
            return (cred && cred.user) || a.currentUser || null;
        }, function (err) {
            _pending = null;
            var code = err && err.code ? String(err.code) : '';
            state.lastError = code;
            // Anonymous sign-in switched off in Firebase Auth. Report, do not retry.
            if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') state.anonDisabled = true;
            return null;
        });
        return _pending;
    }

    function storage(kind) {
        try { return kind === 'session' ? win.sessionStorage : win.localStorage; } catch (e) { return null; }
    }

    function el(tag, css, text) {
        var d = win.document.createElement(tag);
        if (css) d.style.cssText = css;
        if (text != null) d.textContent = text;
        return d;
    }

    function loginButton() {
        var b = el('button', 'background:var(--accent);color:#fff;border:none;border-radius:8px;padding:5px 12px;font-size:0.75rem;font-weight:700;cursor:pointer;flex-shrink:0;', COPY.login);
        b.type = 'button';
        b.setAttribute('data-guest-login', '1');
        b.onclick = function (ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); openSignIn(); };
        return b;
    }

    // Shown once per session per app, at the top of the app. Logged-in players never see it.
    function shouldShowBanner(appId) {
        if (!isGuest()) return false;
        var s = storage('session');
        var key = BANNER_KEY + ':' + String(appId || 'app');
        try { if (s && s.getItem(key) === '1') return false; } catch (e) {}
        return true;
    }

    function markBannerSeen(appId) {
        var s = storage('session');
        try { if (s) s.setItem(BANNER_KEY + ':' + String(appId || 'app'), '1'); } catch (e) {}
    }

    function mountBanner(host, appId) {
        if (!host || !win.document || !shouldShowBanner(appId)) return null;
        if (host.querySelector && host.querySelector('[data-guest-banner]')) return null;
        var box = el('div', 'display:flex;align-items:center;gap:10px;background:var(--accent-bg);border:1px dashed var(--accent);border-radius:10px;padding:8px 12px;margin:0 0 12px;font-size:0.78rem;line-height:1.35;color:var(--text);');
        box.setAttribute('data-guest-banner', String(appId || 'app'));
        box.setAttribute('role', 'note');
        box.appendChild(el('div', 'flex:1;', COPY.banner));
        box.appendChild(loginButton());
        var x = el('button', 'background:none;border:none;color:var(--text-muted);font-size:1rem;cursor:pointer;padding:0 2px;', '\u00d7');
        x.type = 'button';
        x.setAttribute('aria-label', COPY.dismiss);
        x.onclick = function () { if (box.parentNode) box.parentNode.removeChild(box); };
        box.appendChild(x);
        if (host.firstChild) host.insertBefore(box, host.firstChild); else host.appendChild(box);
        markBannerSeen(appId);
        return box;
    }

    // Timechain TV: a small line under the player. It never covers or pauses the stream.
    function mountTctvNote(playerEl) {
        if (!playerEl || !playerEl.parentNode || !isGuest()) return null;
        var next = playerEl.nextSibling;
        if (next && next.getAttribute && next.getAttribute('data-guest-tctv') === '1') return next;
        var note = el('div', 'display:flex;align-items:center;justify-content:center;gap:8px;font-size:0.72rem;color:var(--text-muted);padding:6px 4px;');
        note.setAttribute('data-guest-tctv', '1');
        note.setAttribute('role', 'note');
        note.appendChild(el('span', '', COPY.tctv));
        var link = el('button', 'background:none;border:none;color:var(--accent);font-weight:700;font-size:0.72rem;cursor:pointer;padding:0;', COPY.login);
        link.type = 'button';
        link.onclick = function () { openSignIn(); };
        note.appendChild(link);
        playerEl.parentNode.insertBefore(note, next);
        return note;
    }

    // Chat inputs: guests see "Sign in to chat" and tapping opens sign-in.
    // The server rules block guest chat writes on their own; this is the UI.
    function gateChatInput(input, sendBtn) {
        if (!input) return false;
        if (!isGuest()) {
            if (input.getAttribute && input.getAttribute('data-guest-chat') === '1') {
                input.disabled = false;
                input.removeAttribute('data-guest-chat');
                if (input._guestPlaceholder != null) input.placeholder = input._guestPlaceholder;
                if (sendBtn) sendBtn.disabled = false;
            }
            return false;
        }
        if (input._guestPlaceholder == null) input._guestPlaceholder = input.placeholder || '';
        input.placeholder = COPY.chat;
        input.readOnly = true;
        input.setAttribute('data-guest-chat', '1');
        input.setAttribute('aria-label', COPY.chat);
        input.onfocus = function () { if (isGuest()) { input.blur && input.blur(); openSignIn(); } };
        if (sendBtn) sendBtn.disabled = true;
        return true;
    }

    // Per-result note where a reward would show. Never a popup during play.
    function rewardText(n) {
        var amt = Math.max(0, Math.floor(Number(n) || 0));
        return COPY.reward.replace('{n}', String(amt));
    }

    function prizeText(label) {
        var p = String(label == null ? '' : label).replace(/[\u0000-\u001f<>]/g, '').slice(0, 60).trim();
        return p ? COPY.prize.replace('{prize}', p) : '';
    }

    function noteBox(text) {
        if (!win.document || !text) return null;
        var box = el('div', 'display:inline-flex;align-items:center;gap:8px;font-size:0.78rem;color:var(--text-muted);margin-top:6px;');
        box.setAttribute('data-guest-reward', '1');
        box.appendChild(el('span', '', text));
        box.appendChild(loginButton());
        return box;
    }

    function rewardNote(n) { return noteBox(rewardText(n)); }
    function prizeNote(label) { return noteBox(prizeText(label)); }

    // ---- Guest learning progress (device only) ----
    // A guest's completions are stored on this device with guestCompleted set.
    // They never pay. On sign-up they move to the account as progress, and each
    // item still pays the first time it is completed while logged in. The
    // server decides that payment from its own records, never from this list.
    function readProgress() {
        var s = storage('local');
        var raw = null;
        try { raw = s ? s.getItem(PROGRESS_KEY) : null; } catch (e) { raw = null; }
        var obj = {};
        try { obj = raw ? JSON.parse(raw) : {}; } catch (e2) { obj = {}; }
        return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
    }

    function cleanKey(key) {
        var k = String(key || '').replace(/[^A-Za-z0-9_:.\-]/g, '').slice(0, 120);
        return k;
    }

    function recordGuestCompletion(key) {
        if (!isGuest()) return false;
        var k = cleanKey(key);
        if (!k) return false;
        var all = readProgress();
        if (all[k]) return true;
        if (Object.keys(all).length >= 2000) return false;
        all[k] = { guestCompleted: true, at: Date.now() };
        var s = storage('local');
        try { if (s) s.setItem(PROGRESS_KEY, JSON.stringify(all)); } catch (e) { return false; }
        return true;
    }

    function guestCompleted(key) {
        var row = readProgress()[cleanKey(key)];
        return !!(row && row.guestCompleted === true);
    }

    // Progress to show on the new account. Only keys and the guestCompleted
    // flag move. No amounts, no XP, no rewards.
    function progressForMerge() {
        var all = readProgress();
        var out = {};
        Object.keys(all).forEach(function (k) {
            var ck = cleanKey(k);
            if (ck && all[k] && all[k].guestCompleted === true) out[ck] = { guestCompleted: true };
        });
        return out;
    }

    // Does a logged-in completion of this item pay? guestCompleted never blocks
    // it. Only a server record that this account was already paid does.
    function paysWhenLoggedIn(key, serverPaid) {
        if (isGuest()) return false;
        var k = cleanKey(key);
        if (!k) return false;
        if (serverPaid && typeof serverPaid === 'object') {
            if (Array.isArray(serverPaid)) return serverPaid.indexOf(k) < 0;
            return !serverPaid[k];
        }
        return true;
    }

    var api = {
        COPY: COPY,
        isGuest: isGuest,
        ensureGuestSession: ensureGuestSession,
        openSignIn: openSignIn,
        requireLogin: requireLogin,
        shouldShowBanner: shouldShowBanner,
        mountBanner: mountBanner,
        mountTctvNote: mountTctvNote,
        gateChatInput: gateChatInput,
        rewardText: rewardText,
        rewardNote: rewardNote,
        prizeText: prizeText,
        prizeNote: prizeNote,
        progress: {
            record: recordGuestCompletion,
            guestCompleted: guestCompleted,
            forMerge: progressForMerge,
            paysWhenLoggedIn: paysWhenLoggedIn,
            KEY: PROGRESS_KEY
        },
        state: state
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (win) {
        win.bqGuest = api;
        win.isGuest = isGuest;
        win.ensureGuestSession = ensureGuestSession;
    }
})(this);
