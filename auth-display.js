// Display-only signed-in snapshot. This is not an auth session.
// It must never grant rewards, XP, sats, claims, admin, or any write.
(function (root) {
    var KEY = 'btc_auth_display';
    var MAX_NAME = 32;
    var MAX_URL = 400;
    var LEVELS = [
        ['Satoshi', 210000, '👑'],
        ['Cypherpunk', 133337, '🔒'],
        ['Sovereign', 100000, '🏴'],
        ['Whale', 50000, '🐋'],
        ['Full Node', 18333, '🖥️'],
        ['Papa John', 10000, '🍕'],
        ['Maxi III', 8888, '🔥🔥🔥'],
        ['Maxi II', 6102, '🔥🔥'],
        ['Maxi', 2140, '🔥'],
        ['Stacker III', 2016, '📦📦📦'],
        ['Stacker II', 1913, '📦📦'],
        ['Stacker', 500, '📦'],
        ['Pleb III', 256, '🟠🟠🟠'],
        ['Pleb II', 170, '🟠🟠'],
        ['Pleb', 144, '🟠'],
        ['Curious', 10, '🔵'],
        ['Normie', 0, '🟢']
    ];
    // Display-only profile cache already stored by ranking.js. The 2FA flag
    // is a boolean. Missing means unknown. Early paint requires false.
    var PROFILE_KEY = 'btc_profile_cache';
    var SAT_CAP = 15000;
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
        return levelMeta(xp).name;
    }

    function levelMeta(xp) {
        var n = Math.max(0, Math.floor(Number(xp) || 0));
        var i;
        for (i = 0; i < LEVELS.length; i++) {
            if (n >= LEVELS[i][1]) return { name: LEVELS[i][0], emoji: LEVELS[i][2] || '' };
        }
        return { name: 'Normie', emoji: '🟢' };
    }

    // Same display math as claimableSats. It does not grant or withdraw anything.
    function claimableDisplay(data) {
        var u = data || {};
        var points = Number(u.points) || 0;
        var claimed = Number(u.pointsClaimed) || 0;
        var donated = Number(u.pointsDonated) || 0;
        var exchanged = Number(u.pointsExchanged) || 0;
        var withdrawn = Number(u.satsWithdrawn) || 0;
        if (withdrawn < 0) withdrawn = 0;
        var balance = Math.floor(Math.max(0, points - claimed - donated - exchanged) / 10);
        var left = Math.max(0, SAT_CAP - withdrawn);
        return Math.min(balance, left);
    }

    function readProfile(storage) {
        try {
            var raw = JSON.parse(storageOf(storage).getItem(PROFILE_KEY) || 'null');
            if (!raw || typeof raw !== 'object' || !validUid(raw.uid)) return null;
            return raw;
        } catch (e) {
            return null;
        }
    }

    // Firebase LOCAL persistence key, if the SDK wrote it to localStorage.
    // Only the uid is read. The record can hold tokens and is never logged.
    function firebaseLocalUid(storage) {
        try {
            var s = storageOf(storage);
            var n = s.length || 0;
            var i;
            for (i = 0; i < n; i++) {
                var key = s.key(i);
                if (!key || key.indexOf('firebase:authUser:') !== 0) continue;
                var parsed = JSON.parse(s.getItem(key) || 'null');
                var uid = parsed && (parsed.uid || (parsed.value && parsed.value.uid));
                if (validUid(uid)) return String(uid);
            }
        } catch (e) {}
        return '';
    }

    function appCachedUid(storage) {
        try {
            var last = storageOf(storage).getItem('btc_last_auth_uid');
            if (validUid(last)) return String(last);
        } catch (e) {}
        return '';
    }

    // Sync uid: Firebase localStorage persistence, or the uid this app already caches.
    // A disagreement is not a guess.
    function persistedUidSync(storage) {
        var fromFb = firebaseLocalUid(storage);
        var fromApp = appCachedUid(storage);
        if (fromFb && fromApp && fromFb !== fromApp) return '';
        return fromFb || fromApp || '';
    }

    function profileView(cache) {
        var data = (cache && cache.data) || {};
        var username = String(data.username || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, MAX_NAME);
        if (!cache || !username || !validUid(cache.uid)) return null;
        var xp = Math.max(0, Math.min(100000000, Math.floor(Number(data.points != null ? data.points : data.xp) || 0)));
        var meta = levelMeta(xp);
        return {
            uid: String(cache.uid),
            username: username,
            level: meta.name,
            emoji: meta.emoji,
            xp: xp,
            sats: claimableDisplay(data)
        };
    }

    // twoFa true, totp on the cached doc, or a missing flag: do not paint early.
    // twoFa false plus a matching persisted uid is the only early paint.
    function earlyProfileDecision(cache, loginUid) {
        if (!cache || !loginUid) return { action: 'skip', reason: 'missing', view: null };
        if (String(cache.uid) !== String(loginUid)) return { action: 'skip', reason: 'uid-mismatch', view: null };
        if (cache.twoFa === true || (cache.data && cache.data.totpEnabled === true)) {
            return { action: 'hold', reason: 'needs2fa', view: null };
        }
        if (cache.twoFa !== false) return { action: 'hold', reason: 'unknown-2fa', view: null };
        var view = profileView(cache);
        if (!view) return { action: 'skip', reason: 'incomplete', view: null };
        return { action: 'paint', reason: 'cache', view: view };
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

    function clearProfilePaint(doc) {
        if (!doc) return;
        var bar = doc.getElementById('rankBar');
        if (bar && bar.getAttribute('data-profile-cache') === '1' && bar.getAttribute('data-auth-live') !== '1') {
            bar.textContent = '';
            if ('innerHTML' in bar) bar.innerHTML = '';
            bar.style.display = 'none';
            bar.removeAttribute('data-profile-cache');
        }
        var sats = doc.getElementById('homeSatsValue');
        if (sats && sats.getAttribute('data-profile-cache') === '1' && sats.getAttribute('data-auth-live') !== '1') {
            sats.textContent = '—';
            sats.removeAttribute('data-profile-cache');
        }
    }

    // 2FA hold. Live marks must not keep level, XP, or sats on screen.
    function forceClearProfile(doc) {
        if (!doc) doc = root.document;
        if (!doc) return;
        var rootEl = doc.documentElement;
        if (rootEl) {
            rootEl.classList.remove('home-signed-in');
            rootEl.removeAttribute('data-auth-display');
        }
        if (doc.body) doc.body.classList.remove('home-signed-in');
        var chip = doc.getElementById('homeSignedInChip');
        if (chip) {
            chip.textContent = '';
            if ('innerHTML' in chip) chip.innerHTML = '';
            chip.classList.remove('on');
            chip.removeAttribute('data-auth-display');
        }
        var mobile = doc.getElementById('mobileUserInfo');
        if (mobile) {
            var label = doc.getElementById('mobileUserLabel');
            if (label) {
                label.textContent = '';
                label.removeAttribute('data-auth-display');
            }
            mobile.textContent = '';
            if ('innerHTML' in mobile) mobile.innerHTML = '';
            mobile.style.display = 'none';
            mobile.removeAttribute('data-auth-display');
            mobile.removeAttribute('data-auth-live');
        }
        var bar = doc.getElementById('rankBar');
        if (bar) {
            bar.textContent = '';
            if ('innerHTML' in bar) bar.innerHTML = '';
            bar.style.display = 'none';
            bar.removeAttribute('data-profile-cache');
            bar.removeAttribute('data-auth-live');
        }
        var sats = doc.getElementById('homeSatsValue');
        if (sats) {
            sats.textContent = '—';
            sats.removeAttribute('data-profile-cache');
            sats.removeAttribute('data-auth-live');
        }
        var welcome = doc.getElementById('welcomeBanner');
        if (welcome) {
            welcome.textContent = '';
            if ('innerHTML' in welcome) welcome.innerHTML = '';
            welcome.style.display = 'none';
        }
        var userDisplay = doc.getElementById('userDisplay');
        if (userDisplay) {
            userDisplay.textContent = '';
            if ('innerHTML' in userDisplay) userDisplay.innerHTML = '';
            userDisplay.style.display = 'none';
        }
        var btn = doc.getElementById('authBtn');
        if (btn) {
            btn.textContent = 'Create Free Account / Sign In';
            if ('innerHTML' in btn) btn.innerHTML = 'Create Free Account / Sign In';
            btn.removeAttribute('data-auth-display');
            btn.removeAttribute('data-auth-live');
        }
    }

    function paintCachedProfile(view) {
        if (!view || !root.document) return;
        var doc = root.document;
        var bar = doc.getElementById('rankBar');
        if (bar && bar.getAttribute('data-auth-live') !== '1') {
            bar.textContent = '';
            bar.style.display = 'flex';
            bar.setAttribute('data-profile-cache', '1');
            var level = doc.createElement('span');
            level.className = 'rank-level';
            level.textContent = (view.emoji ? view.emoji + ' ' : '') + view.level;
            var user = doc.createElement('span');
            user.className = 'rank-user';
            user.textContent = view.username;
            var pts = doc.createElement('span');
            pts.className = 'rank-pts';
            pts.textContent = Number(view.xp || 0).toLocaleString() + ' XP';
            bar.appendChild(level);
            bar.appendChild(user);
            bar.appendChild(pts);
        }
        var sats = doc.getElementById('homeSatsValue');
        if (sats && sats.getAttribute('data-auth-live') !== '1') {
            sats.textContent = Number(view.sats || 0).toLocaleString();
            sats.setAttribute('data-profile-cache', '1');
        }
        try {
            if (root.performance && root.performance.mark) root.performance.mark('btc-profile-cache');
        } catch (e) {}
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
            clearProfilePaint(doc);
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
        if (decision.snapshot && decision.snapshot.uid) paintConfirmedProfile(decision.snapshot.uid);
        return decision;
    }

    function paintConfirmedProfile(uid) {
        var decision = earlyProfileDecision(readProfile(), uid);
        if (decision.action === 'paint') paintCachedProfile(decision.view);
        else clearProfilePaint(root.document);
    }

    var idbStarted = false;
    function readIndexedDbUid(apiKey, cb) {
        if (!apiKey || !root.indexedDB) return;
        var openReq;
        try { openReq = root.indexedDB.open('firebaseLocalStorageDb'); }
        catch (e) { return; }
        openReq.onerror = function () {};
        openReq.onsuccess = function () {
            var db = openReq.result;
            var uid = '';
            try {
                if (!db.objectStoreNames.contains('firebaseLocalStorage')) { db.close(); return; }
                var tx = db.transaction('firebaseLocalStorage', 'readonly');
                var req = tx.objectStore('firebaseLocalStorage').get('firebase:authUser:' + apiKey + ':[DEFAULT]');
                req.onsuccess = function () {
                    var row = req.result;
                    if (row) uid = row.uid || (row.value && row.value.uid) || '';
                    try { db.close(); } catch (e) {}
                    if (validUid(uid)) cb(String(uid));
                };
                req.onerror = function () { try { db.close(); } catch (e) {} };
            } catch (e) { try { db.close(); } catch (e2) {} }
        };
    }

    function onIndexedDbUid(idbUid) {
        if (!idbUid) return;
        var settled = root._btcEarlyAuthUser;
        if (typeof settled !== 'undefined') {
            if (!settled || settled.isAnonymous || settled.uid !== idbUid) return;
        }
        var sync = persistedUidSync();
        if (sync && sync !== idbUid) {
            paint(null);
            return;
        }
        var stored = read();
        if (stored && stored.needs2fa) return;
        if (stored && stored.uid && stored.uid !== idbUid) {
            paint(null);
            return;
        }
        var decision = earlyProfileDecision(readProfile(), idbUid);
        if (decision.action === 'paint') {
            var snap = (stored && stored.uid === idbUid) ? stored : write(decision.view);
            paint(snap || decision.view);
            paintCachedProfile(decision.view);
        } else if (decision.action === 'hold' && decision.reason === 'needs2fa') {
            paint(null);
        }
    }

    function scheduleIndexedDbUid() {
        if (idbStarted) return;
        var cfg = root.FIREBASE_CONFIG;
        if (!cfg || !cfg.apiKey || !root.indexedDB) return;
        idbStarted = true;
        readIndexedDbUid(cfg.apiKey, onIndexedDbUid);
    }

    function applyBoot() {
        var early = root._btcEarlyAuthUser;
        // Auth has already fired. A real user is confirmed below. Null or
        // anonymous drops the cached profile instead of leaving it up.
        if (typeof early !== 'undefined') {
            if (early && !early.isAnonymous) reconcile(early);
            else if (!redirectPending()) reconcile(early || null);
            scheduleIndexedDbUid();
            return;
        }
        var stored = read();
        if (stored && stored.needs2fa) {
            paint(null);
            return;
        }
        var uid = persistedUidSync();
        if (uid && stored && stored.uid && stored.uid !== uid) {
            paint(null);
            scheduleIndexedDbUid();
            return;
        }
        var decision = earlyProfileDecision(readProfile(), uid);
        if (decision.action === 'paint') {
            // Display fields only. Auth still has to confirm this uid, and a
            // miss clears the snapshot. Nothing here is allowed to grant a reward.
            var snap = (stored && stored.uid === uid) ? stored : write(decision.view);
            paint(snap || decision.view);
            paintCachedProfile(decision.view);
            scheduleIndexedDbUid();
            return;
        }
        if (decision.action === 'hold' && decision.reason === 'needs2fa') {
            paint(null);
            return;
        }
        clearProfilePaint(root.document);
        paint(stored || null);
        scheduleIndexedDbUid();
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
        levelMeta: levelMeta,
        claimableDisplay: claimableDisplay,
        readProfile: readProfile,
        persistedUidSync: persistedUidSync,
        earlyProfileDecision: earlyProfileDecision,
        profileView: profileView,
        PROFILE_KEY: PROFILE_KEY,
        safeAvatar: safeAvatar,
        showsLevelChip: showsLevelChip,
        paint: paint,
        paintCachedProfile: paintCachedProfile,
        clearProfilePaint: clearProfilePaint,
        forceClearProfile: forceClearProfile,
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
