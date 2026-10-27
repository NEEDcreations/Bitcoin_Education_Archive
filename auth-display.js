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
    // Name / level / XP surfaces. The home chip hides only when a mode's hide
    // list hides one of these. Lists mirror ux-patches HIDE_IDS (plus the
    // intermediate Nacho story button) and achievement-share's lite mode.
    // Lite still shows inline XP, so the chip stays visible in Lite.
    var XP_SURFACES = {
        dailyXpMeter: 1,
        userDisplay: 1,
        welcomeBanner: 1,
        homeSignedInChip: 1,
        mobileUserInfo: 1
    };
    var MODE_HIDE = {
        lite: [],
        beginner: [
            'aiToolsBtn', 'dashboardFloatBtn', 'lbFloatBtn',
            'dailySpinBanner', 'em-quick-actions',
            'dailyChallengeCard', 'raidBossHomeCard',
            'donateSection', 'quoteOfDay', 'dailyChannel',
            'hotTopicsSectionWrapper'
        ],
        intermediate: [
            'aiToolsBtn', 'dashboardFloatBtn', 'lbFloatBtn',
            'dailyChallengeCard', 'raidBossHomeCard',
            'donateSection', 'quoteOfDay', 'dailyChannel',
            'hotTopicsSectionWrapper', 'nachoStoryBtn'
        ],
        advanced: []
    };

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

    function validUid(uid) {
        return /^[A-Za-z0-9:_\-]{6,128}$/.test(String(uid || ''));
    }

    function sanitize(input) {
        var src = input || {};
        if (src.needs2fa) return null;
        var username = String(src.username || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, MAX_NAME);
        var uid = String(src.uid || '');
        if (!username || !validUid(uid)) return null;
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
            if (raw.needs2fa === true) {
                if (!validUid(raw.uid)) return null;
                return { uid: String(raw.uid), needs2fa: true };
            }
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

    // Non-sensitive marker. The painter must not show a name for this uid
    // until this session's authenticator check succeeds.
    function markNeeds2fa(uid, storage) {
        var id = String(uid || '');
        if (!validUid(id)) return null;
        var rec = { uid: id, needs2fa: true };
        storageOf(storage).setItem(KEY, JSON.stringify(rec));
        return rec;
    }

    function clear(storage) {
        try { storageOf(storage).removeItem(KEY); } catch (e) {}
    }

    function showsLevelChip(mode, hideLists) {
        var lists = hideLists || MODE_HIDE;
        var m = mode;
        if (m == null) {
            try { m = root.localStorage && root.localStorage.getItem('btc_experience_mode') || ''; }
            catch (e) { m = ''; }
        }
        if (!m) return true;
        var list = Object.prototype.hasOwnProperty.call(lists, m) ? lists[m] : null;
        if (!list) return true;
        var i;
        for (i = 0; i < list.length; i++) {
            if (XP_SURFACES[list[i]]) return false;
        }
        return true;
    }

    // authUser undefined: auth has not settled, keep the cached display.
    // null, anonymous, or a different uid: drop it. Never keep another account on screen.
    // A needs2fa record never becomes a visible name.
    function plan(stored, authUser) {
        if (stored && stored.needs2fa) {
            // Auth has settled on signed-out or anonymous: the marker is done.
            // Undefined auth means the session is still unknown, so keep hiding.
            if (typeof authUser !== 'undefined' && (!authUser || authUser.isAnonymous || !authUser.uid)) {
                return { action: 'clear', reason: 'signed-out', snapshot: null };
            }
            return { action: 'hide', reason: 'needs2fa', snapshot: null };
        }
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

    function paintChip(doc, snap) {
        var chip = doc.getElementById('homeSignedInChip');
        if (!chip) return;
        if (!snap || !showsLevelChip()) {
            if (chip.getAttribute('data-auth-display') === '1' || chip.getAttribute('data-em-hidden')) {
                chip.textContent = '';
                chip.classList.remove('on');
                chip.removeAttribute('data-auth-display');
            }
            if (!showsLevelChip()) chip.setAttribute('data-em-hidden', '1');
            else chip.removeAttribute('data-em-hidden');
            return;
        }
        chip.removeAttribute('data-em-hidden');
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

    // Only the name/level/XP label. Never replace the rich mobile bar
    // (price, block height, overflow pill) once ranking has painted it.
    function paintMobile(doc, snap) {
        var mobile = doc.getElementById('mobileUserInfo');
        if (!mobile || mobile.getAttribute('data-auth-live') === '1') return;
        var label = doc.getElementById('mobileUserLabel');
        if (!label) {
            if (mobile.children && mobile.children.length) return;
            label = doc.createElement('span');
            label.id = 'mobileUserLabel';
            mobile.appendChild(label);
        }
        if (!snap) {
            if (label.getAttribute('data-auth-display') === '1') {
                label.textContent = '';
                label.removeAttribute('data-auth-display');
            }
            if (mobile.getAttribute('data-auth-display') === '1') {
                mobile.style.display = 'none';
                mobile.removeAttribute('data-auth-display');
            }
            return;
        }
        label.textContent = labelFor(snap);
        label.setAttribute('data-auth-display', '1');
        mobile.style.display = 'inline';
        mobile.setAttribute('data-auth-display', '1');
    }

    function paint(snap) {
        if (!root.document) return;
        var doc = root.document;
        var rootEl = doc.documentElement;
        var btn = doc.getElementById('authBtn');
        if (!snap || snap.needs2fa) {
            if (rootEl && rootEl.getAttribute('data-auth-display') === '1') {
                rootEl.classList.remove('home-signed-in');
                if (doc.body) doc.body.classList.remove('home-signed-in');
                rootEl.removeAttribute('data-auth-display');
            }
            paintChip(doc, null);
            paintMobile(doc, null);
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
        paintChip(doc, snap);
        paintMobile(doc, snap);
        if (btn && btn.getAttribute('data-auth-live') !== '1') {
            btn.textContent = '⚙️ ' + snap.username + ' · ' + snap.level;
            btn.setAttribute('data-auth-display', '1');
            btn.style.display = 'block';
        }
        try {
            if (root.performance && root.performance.mark) root.performance.mark('btc-auth-display');
        } catch (e) {}
    }

    function syncMode(mode) {
        if (!root.document) return;
        var stored = read();
        if (!stored || stored.needs2fa) {
            paintChip(root.document, null);
            return;
        }
        if (!showsLevelChip(mode)) {
            paintChip(root.document, null);
            return;
        }
        paint(stored);
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
        var stored = read();
        // A redirect may still restore this uid. Keep the marker, show no name.
        if (stored && stored.needs2fa && (!user || user.isAnonymous) && redirectPending()) {
            paint(null);
            return { action: 'hide', reason: 'needs2fa', snapshot: null };
        }
        if ((!user || user.isAnonymous) && redirectPending()) {
            return { action: 'wait', reason: 'redirect', snapshot: stored };
        }
        // Signed-out and anonymous sessions drop the needs2fa marker.
        if (stored && stored.needs2fa && (!user || user.isAnonymous || !user.uid)) {
            clear();
            paint(null);
            return { action: 'clear', reason: 'signed-out', snapshot: null };
        }
        if (stored && stored.needs2fa) {
            paint(null);
            return { action: 'hide', reason: 'needs2fa', snapshot: null };
        }
        var decision = plan(stored, user || null);
        if (decision.action === 'clear') {
            clear();
            paint(null);
            return decision;
        }
        if (decision.action === 'hide') {
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
        var stored = read();
        paint(stored && stored.needs2fa ? null : stored);
    }

    var api = {
        KEY: KEY,
        sanitize: sanitize,
        read: read,
        write: write,
        markNeeds2fa: markNeeds2fa,
        clear: clear,
        plan: plan,
        levelForXp: levelForXp,
        safeAvatar: safeAvatar,
        showsLevelChip: showsLevelChip,
        paint: paint,
        syncMode: syncMode,
        reconcile: reconcile,
        applyBoot: applyBoot
    };
    root.btcAuthDisplay = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;

    if (root.document && !root.process) {
        try { applyBoot(); } catch (e) {}
        if (root.document.readyState === 'loading') {
            root.document.addEventListener('DOMContentLoaded', applyBoot);
        }
    }
})(typeof window !== 'undefined' ? window : globalThis);
