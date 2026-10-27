// Display-only signed-in snapshot. This is not an auth session.
// It must never grant rewards, XP, sats, claims, admin, or any write.
(function (root) {
    var KEY = 'btc_auth_display';
    var MAX_NAME = 32;
    var MAX_URL = 400;
    var LEVELS = [
        ['Satoshi', 210000],
        ['Cypherpunk', 133337],
        ['Sovereign', 100000],
        ['Whale', 50000],
        ['Full Node', 18333],
        ['Papa John', 10000],
        ['Maxi III', 8888],
        ['Maxi II', 6102],
        ['Maxi', 2140],
        ['Stacker III', 2016],
        ['Stacker II', 1913],
        ['Stacker', 500],
        ['Pleb III', 256],
        ['Pleb II', 170],
        ['Pleb', 144],
        ['Curious', 10],
        ['Normie', 0]
    ];

    function levelForXp(xp) {
        var n = Math.max(0, Math.floor(Number(xp) || 0));
        var i;
        for (i = 0; i < LEVELS.length; i++) {
            if (n >= LEVELS[i][1]) return LEVELS[i][0];
        }
        return 'Normie';
    }

    function safeAvatar(url) {
        var s = String(url || '');
        if (!s || s.length > MAX_URL) return '';
        if (/^https:\/\/firebasestorage\.googleapis\.com\//.test(s)) return s;
        if (/^https:\/\/[a-z0-9.-]+\.firebasestorage\.app\//i.test(s)) return s;
        return '';
    }

    function sanitize(input) {
        var src = input || {};
        var username = String(src.username || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, MAX_NAME);
        var uid = String(src.uid || '');
        if (!username || !/^[A-Za-z0-9:_\-]{6,128}$/.test(uid)) return null;
        var xp = Math.max(0, Math.min(100000000, Math.floor(Number(src.xp != null ? src.xp : src.points) || 0)));
        return {
            uid: uid,
            username: username,
            avatar: safeAvatar(src.avatar || src.profilePic || ''),
            level: levelForXp(xp),
            xp: xp
        };
    }

    function storageOf(storage) {
        return storage || root.localStorage;
    }

    function read(storage) {
        try {
            var raw = JSON.parse(storageOf(storage).getItem(KEY) || 'null');
            if (!raw || typeof raw !== 'object') return null;
            return sanitize(raw);
        } catch (e) {
            return null;
        }
    }

    function write(input, storage) {
        var snap = sanitize(input);
        if (!snap) return null;
        storageOf(storage).setItem(KEY, JSON.stringify(snap));
        return snap;
    }

    function clear(storage) {
        try { storageOf(storage).removeItem(KEY); } catch (e) {}
    }

    // authUser undefined: auth has not settled, keep the cached display.
    // null, anonymous, or a different uid: drop it. Never keep another account on screen.
    function plan(stored, authUser) {
        var snap = stored ? sanitize(stored) : null;
        if (typeof authUser === 'undefined') return { action: 'show', snapshot: snap };
        if (!authUser || authUser.isAnonymous || !authUser.uid) {
            return { action: 'clear', reason: 'signed-out', snapshot: null };
        }
        if (!snap || snap.uid !== String(authUser.uid)) {
            return { action: 'clear', reason: 'uid-mismatch', snapshot: null };
        }
        return { action: 'keep', snapshot: snap };
    }

    function labelFor(snap) {
        return snap.username + ' · ' + snap.level + ' · ' + Number(snap.xp || 0).toLocaleString() + ' XP';
    }

    function paint(snap) {
        if (!root.document) return;
        var doc = root.document;
        var rootEl = doc.documentElement;
        var chip = doc.getElementById('homeSignedInChip');
        var mobile = doc.getElementById('mobileUserInfo');
        var btn = doc.getElementById('authBtn');
        if (!snap) {
            if (rootEl && rootEl.getAttribute('data-auth-display') === '1') {
                rootEl.classList.remove('home-signed-in');
                if (doc.body) doc.body.classList.remove('home-signed-in');
                rootEl.removeAttribute('data-auth-display');
            }
            if (chip && chip.getAttribute('data-auth-display') === '1') {
                chip.textContent = '';
                chip.classList.remove('on');
                chip.removeAttribute('data-auth-display');
            }
            if (mobile && mobile.getAttribute('data-auth-display') === '1') {
                mobile.textContent = '';
                mobile.style.display = 'none';
                mobile.removeAttribute('data-auth-display');
            }
            if (btn && btn.getAttribute('data-auth-display') === '1' && btn.getAttribute('data-auth-live') !== '1') {
                btn.textContent = 'Create Free Account / Sign In';
                btn.removeAttribute('data-auth-display');
            }
            return;
        }
        if (rootEl) {
            rootEl.classList.add('home-signed-in');
            rootEl.setAttribute('data-auth-display', '1');
        }
        if (doc.body) doc.body.classList.add('home-signed-in');
        if (chip) {
            chip.textContent = '';
            chip.classList.add('on');
            chip.setAttribute('data-auth-display', '1');
            if (snap.avatar) {
                var img = doc.createElement('img');
                img.alt = '';
                img.src = snap.avatar;
                chip.appendChild(img);
            }
            chip.appendChild(doc.createTextNode(labelFor(snap)));
        }
        if (mobile) {
            mobile.textContent = labelFor(snap);
            mobile.style.display = 'inline';
            mobile.setAttribute('data-auth-display', '1');
        }
        if (btn && btn.getAttribute('data-auth-live') !== '1') {
            btn.textContent = '⚙️ ' + snap.username + ' · ' + snap.level;
            btn.setAttribute('data-auth-display', '1');
            btn.style.display = 'block';
        }
        try {
            if (root.performance && root.performance.mark) root.performance.mark('btc-auth-display');
        } catch (e) {}
    }

    function redirectPending() {
        try {
            return root.sessionStorage.getItem('btc_redirect_pending') === '1' ||
                !!root.localStorage.getItem('btc_anon_uid') ||
                !!root.localStorage.getItem('btc_pwa_auth_pending');
        } catch (e) {
            return false;
        }
    }

    function reconcile(user) {
        if ((!user || user.isAnonymous) && redirectPending()) {
            return { action: 'wait', reason: 'redirect', snapshot: read() };
        }
        var decision = plan(read(), user || null);
        if (decision.action === 'clear') {
            clear();
            paint(null);
            return decision;
        }
        paint(decision.snapshot);
        return decision;
    }

    function applyBoot() {
        var early = root._btcEarlyAuthUser;
        if (early) {
            reconcile(early);
            return;
        }
        paint(read());
    }

    var api = {
        KEY: KEY,
        sanitize: sanitize,
        read: read,
        write: write,
        clear: clear,
        plan: plan,
        levelForXp: levelForXp,
        safeAvatar: safeAvatar,
        paint: paint,
        reconcile: reconcile,
        applyBoot: applyBoot
    };
    root.btcAuthDisplay = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;

    if (root.document && !root.process) {
        try { paint(read()); } catch (e) {}
        if (root.document.readyState === 'loading') {
            root.document.addEventListener('DOMContentLoaded', applyBoot);
        } else {
            applyBoot();
        }
    }
})(typeof window !== 'undefined' ? window : globalThis);
