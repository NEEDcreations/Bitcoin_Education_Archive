/**
 * Bitcoin Quest ads (RLDA-40).
 *
 * Homepage: A-ADS unit 2463147 (https iframe, in-flow, no z-index 99998).
 * Learn + arcade: AdSense script (ca-pub-7244515226002177) in reserved slots.
 * Every ad, including A-ADS, requires a signed-in user with a known adult
 * age (Phil, Nov 25, 9:15-9:16 PM ET: "let's require the 18+ check for
 * all ads including A-ADS" and "A. Guests see no ads until they sign up
 * and confirm 18+"). Guests, signed-out users, and accounts with no
 * known adult age get no ads at all: no script or iframe is loaded.
 * Hard rule (Phil, Nov 25): no ads of any kind on Timechain TV screens —
 * no paid ads, no ad breaks, nothing overlaying or pausing the player.
 *
 * Kids, Classroom, and Premium accounts never see ads.
 * A configurable ad-free holdout (default 20%; Phil, Nov 25: "A. Make
 * the ad-free group 20%") is assigned stably per signed-in user id.
 * Only eligible (18+) users are counted in holdout logging. Change
 * BQ_ADS_HOLDOUT_PCT only.
 *
 * Holdout vs ads is recorded as aggregate daily-active and next-day-return
 * counts only (ads_holdout_stats/{YYYY-MM-DD}). No per-user export.
 */
(function (root) {
    'use strict';

    var HOLDOUT_PCT = 20;
    var AADS_UNIT = '2463147';
    var AADS_SRC = 'https://acceptable.a-ads.com/2463147/?size=Adaptive';
    var ADSENSE_CLIENT = 'ca-pub-7244515226002177';
    var ADSENSE_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7244515226002177';
    var DEVICE_KEY = 'bq_ads_device';
    var AGG_TODAY_KEY = 'bq_ads_agg_today';
    var AGG_YDAY_KEY = 'bq_ads_agg_yday';
    var ALLOWED_SURFACES = {
        home: true,
        'learning-quests': true,
        'proof-of-play': true,
        arcade: true
    };
    var ADSENSE_SURFACES = {
        'learning-quests': true,
        'proof-of-play': true,
        arcade: true
    };
    var TCTV_SURFACES = {
        'timechain-tv': true,
        tv: true,
        tctv: true
    };
    var KIDS_SURFACES = {
        kids: true,
        'kids-family': true,
        'kids-and-family': true
    };
    var SENSITIVE_SURFACES = {
        claim: true,
        withdraw: true,
        wallet: true,
        nwc: true,
        login: true,
        signin: true,
        'sign-in': true,
        admin: true,
        faucet: true
    };

    // Server-sourced users/{uid} snapshot used for the 18+ gate. Never
    // filled from localStorage btc_profile_cache or window flags.
    var freshUserDoc = null;

    function holdoutPct() {
        var raw = (root && root.BQ_ADS_HOLDOUT_PCT != null) ? root.BQ_ADS_HOLDOUT_PCT : HOLDOUT_PCT;
        var n = Number(raw);
        if (!isFinite(n) || n < 0) n = HOLDOUT_PCT;
        if (n > 100) n = 100;
        return n;
    }

    function etDateKey(d) {
        d = d || new Date();
        try {
            var parts = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'America/New_York',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).formatToParts(d);
            var y = '', m = '', day = '';
            for (var i = 0; i < parts.length; i++) {
                if (parts[i].type === 'year') y = parts[i].value;
                if (parts[i].type === 'month') m = parts[i].value;
                if (parts[i].type === 'day') day = parts[i].value;
            }
            if (y && m && day) return y + '-' + m + '-' + day;
        } catch (e) {}
        return d.toISOString().slice(0, 10);
    }

    function previousEtDateKey(d) {
        var today = etDateKey(d);
        var parts = String(today).split('-');
        if (parts.length !== 3) return today;
        var prev = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]) - 1, 12, 0, 0));
        var y = prev.getUTCFullYear();
        var m = ('0' + (prev.getUTCMonth() + 1)).slice(-2);
        var day = ('0' + prev.getUTCDate()).slice(-2);
        return y + '-' + m + '-' + day;
    }

    function fnv1a(str) {
        var h = 2166136261;
        str = String(str || '');
        for (var i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }

    function bucket(id) {
        return fnv1a(String(id || '')) % 100;
    }

    function inHoldout(id, pct) {
        if (pct == null) pct = holdoutPct();
        return bucket(id) < pct;
    }

    function storageGet(key) {
        try {
            if (typeof localStorage === 'undefined') return null;
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    function storageSet(key, value) {
        try {
            if (typeof localStorage === 'undefined') return;
            localStorage.setItem(key, value);
        } catch (e) {}
    }

    function deviceId() {
        var id = storageGet(DEVICE_KEY);
        if (id && /^[a-f0-9]{16,64}$/i.test(id)) return id;
        var bytes = [];
        var i;
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            var buf = new Uint8Array(16);
            crypto.getRandomValues(buf);
            for (i = 0; i < buf.length; i++) bytes.push((buf[i] + 256).toString(16).slice(-2));
        } else {
            for (i = 0; i < 16; i++) bytes.push(('0' + Math.floor(Math.random() * 256).toString(16)).slice(-2));
        }
        id = bytes.join('');
        storageSet(DEVICE_KEY, id);
        return id;
    }

    function assignmentId(user) {
        if (user && user.uid && user.isAnonymous !== true) return String(user.uid);
        if (user && user.uid) return 'anon:' + String(user.uid);
        return 'dev:' + deviceId();
    }

    function isPremiumAccount(user) {
        return !!(user && user.premium && user.premium.active === true);
    }

    function accountLabel(user) {
        if (!user) return '';
        return String(
            user.accountType || user.planType || user.plan || user.role || user.mode || ''
        ).toLowerCase();
    }

    function ageBandOf(user) {
        if (!user) return '';
        return String(user.ageBand || user.age_band || '').toLowerCase();
    }

    function isKidsAccount(user) {
        if (!user) return false;
        // isMinor, under13, and ageBand ('under13' | 'minor') are not set
        // anywhere in this repo yet. When Family/Classroom seats ship, the
        // server must set these exact fields, plus premium.plan
        // family_monthly / family_months, on the user doc.
        if (user.isMinor === true || user.under13 === true) return true;
        if (user.kids === true || user.isKids === true || user.kidsMode === true) return true;
        var band = ageBandOf(user);
        if (band === 'under13' || band === 'minor' || band === 'child' || band === 'kids' || band === 'kid') return true;
        var t = accountLabel(user);
        return t === 'kids' || t === 'kid' || t === 'child' || t === 'family-child' || t === 'minor';
    }

    // Every ad, including A-ADS, is only for a signed-in user whose own
    // fresh Firestore user doc says over18===true, and does not say
    // ageUnder18 or ageConfirmBlocked. Guests, anonymous sessions, kids
    // accounts, and accounts with no age fields get no ads. This function
    // reads only the provided doc-shaped object; it never reads
    // localStorage btc_profile_cache, window._bqAgeConfirmed18, or any
    // other client flag, so an admin un-confirm sticks and the console
    // cannot turn ads on by setting a flag.
    function hasKnownAdultAge(user) {
        if (!user || user.isAnonymous === true || !user.uid) return false;
        if (isKidsAccount(user)) return false;
        return user.over18 === true && user.ageUnder18 !== true && user.ageConfirmBlocked !== true;
    }

    function allowExplicitUser(input) {
        input = input || {};
        if (input._bqAdsAllowExplicitUser === true) return true;
        // Node unit tests may pass a doc-shaped user. In the browser,
        // ignore a caller-supplied user so the console cannot turn ads on.
        return typeof document === 'undefined';
    }

    function signedInUid() {
        try {
            var u = null;
            if (typeof firebase !== 'undefined' && firebase.auth) u = firebase.auth().currentUser;
            else if (typeof auth !== 'undefined' && auth) u = auth.currentUser;
            if (u && u.uid && u.isAnonymous !== true) return String(u.uid);
        } catch (e) {}
        return '';
    }

    function adsFirestore(db) {
        if (db) return db;
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            try { return firebase.firestore(); } catch (e) { return null; }
        }
        return null;
    }

    function applyFreshUserSnap(uid, snap) {
        var id = String(uid || '');
        var signed = signedInUid();
        if (!id || !signed || signed !== id || !snap || !snap.exists) {
            freshUserDoc = null;
            return null;
        }
        if (snap.metadata && snap.metadata.fromCache === true) {
            return freshUserDoc;
        }
        var data = {};
        try { data = snap.data() || {}; } catch (e) { data = {}; }
        freshUserDoc = { uid: id };
        var key;
        for (key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) freshUserDoc[key] = data[key];
        }
        return freshUserDoc;
    }

    function fetchFreshUserDoc(uid, firestore) {
        var id = String(uid || signedInUid() || '');
        if (!id) {
            freshUserDoc = null;
            return Promise.resolve(null);
        }
        var signed = signedInUid();
        if (signed && signed !== id) {
            freshUserDoc = null;
            return Promise.resolve(null);
        }
        var db = adsFirestore(firestore);
        if (!db) return Promise.resolve(null);
        var ref = db.collection('users').doc(id);
        var req;
        try { req = ref.get({ source: 'server' }); } catch (e) { req = ref.get(); }
        return Promise.resolve(req).then(function (snap) {
            if (signedInUid() !== id) return null;
            return applyFreshUserSnap(id, snap);
        }).catch(function () {
            if (signedInUid() === id) freshUserDoc = null;
            return null;
        });
    }

    function getFreshUserDoc() {
        return freshUserDoc;
    }

    // The 18+ gate uses only an explicit test/doc user (non-DOM) or the
    // server-sourced snapshot. Never currentUser (may be cache-painted),
    // never btc_profile_cache, never window._bqAgeConfirmed18.
    function userForAge(input) {
        input = input || {};
        if (allowExplicitUser(input) && Object.prototype.hasOwnProperty.call(input, 'user')) {
            return input.user;
        }
        return freshUserDoc;
    }

    function isGuestUser(user) {
        if (!user) return true;
        if (user.isAnonymous === true) return true;
        if (!user.uid) return true;
        return false;
    }

    function premiumPlanId(user) {
        if (!user || !user.premium) return '';
        return String(user.premium.plan || user.premium.planId || user.premium.planType || '').toLowerCase();
    }

    function isFamilyOrClassroomPlan(user) {
        if (!user) return false;
        if (user.premium && user.premium.family === true) return true;
        var plan = premiumPlanId(user);
        if (!plan) return false;
        if (plan === 'family_monthly' || plan === 'family_months' || plan === 'family' || plan === 'classroom') return true;
        return plan.indexOf('family') === 0 || plan.indexOf('classroom') === 0;
    }

    function isClassroomAccount(user) {
        if (!user) return false;
        if (user.classroom === true || user.isClassroom === true || user.classroomMode === true) return true;
        if (isFamilyOrClassroomPlan(user)) return true;
        var t = accountLabel(user);
        return t === 'classroom' || t === 'student' || t === 'school' || t === 'family' || t === 'family-classroom';
    }

    function normalizeToken(value) {
        return String(value || '').toLowerCase().replace(/_/g, '-');
    }

    function tokenLooksLikeKids(value) {
        var s = normalizeToken(value);
        if (!s) return false;
        if (KIDS_SURFACES[s]) return true;
        if (s === 'kids-family' || s.indexOf('kids-family') !== -1) return true;
        return /(^|[\/?#&=-])kids([\/?#&=-]|$)/.test(s);
    }

    function isKidsSurface(ctx) {
        ctx = ctx || {};
        if (tokenLooksLikeKids(ctx.surface) || tokenLooksLikeKids(ctx.page) || tokenLooksLikeKids(ctx.category) || tokenLooksLikeKids(ctx.channel) || tokenLooksLikeKids(ctx.topic) || tokenLooksLikeKids(ctx.section)) return true;
        var path = pathOf(ctx);
        var extra = '';
        if (ctx.hash) extra = String(ctx.hash);
        else if (typeof location !== 'undefined') extra = String(location.hash || '') + String(location.search || '');
        if (tokenLooksLikeKids(path) || tokenLooksLikeKids(extra)) return true;
        if (/(marketplace\/kids|\/kids-family\b|[?&#]category=kids\b|[?&#]channel=kids-family\b)/i.test(path + extra)) return true;
        if (typeof currentPage !== 'undefined' && tokenLooksLikeKids(currentPage)) return true;
        if (root && (tokenLooksLikeKids(root._mktCategory) || tokenLooksLikeKids(root._tctvChannel) || tokenLooksLikeKids(root._lqTopic))) return true;
        return false;
    }

    function isSensitiveSurface(ctx) {
        ctx = ctx || {};
        var surface = normalizeToken(ctx.surface || ctx.page || '');
        if (SENSITIVE_SURFACES[surface]) return true;
        if (typeof currentPage !== 'undefined' && SENSITIVE_SURFACES[normalizeToken(currentPage)]) return true;
        var path = normalizeToken(pathOf(ctx));
        if (/\/(claim|withdraw|wallet|nwc|admin|login|sign-in|signin|faucet)(\/|$)/.test(path)) return true;
        return false;
    }

    function sensitiveUiOpen() {
        if (typeof document === 'undefined') return false;
        var ids = ['claimModal', 'withdrawModal', 'walletModal', 'nwcModal', 'adminPanel', 'admin-panel', 'loginModal', 'usernamePrompt', 'btcClaimSessionPopup'];
        var i, el;
        for (i = 0; i < ids.length; i++) {
            el = document.getElementById(ids[i]);
            if (el && !el.hidden && !el.classList.contains('hidden')) return true;
        }
        return !!(document.querySelector('.bq-claim-modal:not(.hidden), .bq-wallet-modal:not(.hidden), .bq-admin-panel:not(.hidden)'));
    }

    function isUserUnknown(input) {
        input = input || {};
        if (allowExplicitUser(input) && Object.prototype.hasOwnProperty.call(input, 'user')) return false;
        if (input.userUnknown === true) return true;
        if (input.userUnknown === false) return false;
        if (root && root._bqAdsUserUnknown === true) return true;
        if (freshUserDoc && freshUserDoc.uid) return false;
        if (root && root._bqAdsAuthReady === true) return false;
        // In the browser, ads stay off until auth (and a fresh user doc, when signed in) is ready.
        if (typeof document !== 'undefined' && !(root && root._bqAdsAuthReady === true)) return true;
        return false;
    }

    function pathOf(ctx) {
        if (ctx && ctx.path) return String(ctx.path);
        if (typeof location === 'undefined') return '';
        return String(location.pathname || '');
    }

    function isTimechainTvSurface(ctx) {
        ctx = ctx || {};
        var surface = String(ctx.surface || ctx.page || '');
        if (TCTV_SURFACES[surface]) return true;
        if (ctx.tctvActive === true) return true;
        var path = pathOf(ctx).replace(/\/+$/, '') || '/';
        if (path === '/timechain-tv' || path === '/tv') return true;
        if (typeof document !== 'undefined' && document.body && document.body.classList.contains('tctv-active')) return true;
        if (root && root._tctvActive === true) return true;
        if (typeof currentPage !== 'undefined' && TCTV_SURFACES[currentPage]) return true;
        return false;
    }

    function currentSurface(ctx) {
        ctx = ctx || {};
        if (isTimechainTvSurface(ctx)) return 'timechain-tv';
        if (ctx.surface) return ctx.surface;
        if (ctx.page) return ctx.page;
        if (typeof currentPage !== 'undefined' && currentPage) return currentPage;
        if (root && root._popActive === true) return 'proof-of-play';
        if (typeof document !== 'undefined') {
            if (document.getElementById('lqHub')) return 'learning-quests';
            if (document.getElementById('popOverlay')) return 'proof-of-play';
            var home = document.getElementById('home');
            if (home && !home.classList.contains('hidden')) return 'home';
        }
        var path = pathOf(ctx);
        if (path === '/' || path === '' || path === '/index.html') return 'home';
        return '';
    }

    function isAllowedSurface(surface) {
        return !!ALLOWED_SURFACES[surface];
    }

    /**
     * Decide whether ads may show, and which experiment group (if any)
     * this daily-active belongs to. Guests, users without a known adult
     * age, and restricted accounts are ad-free and are left out of the
     * holdout-vs-ads comparison.
     */
    function decide(input) {
        input = input || {};
        var user = userForAge(input);
        var surface = currentSurface(input);
        var tctv = isTimechainTvSurface(input) || surface === 'timechain-tv';
        var kidsSurface = isKidsSurface(input);
        var sensitive = isSensitiveSurface(input);
        var pct = input.holdoutPct != null ? Number(input.holdoutPct) : holdoutPct();
        if (!isFinite(pct) || pct < 0) pct = HOLDOUT_PCT;
        if (pct > 100) pct = 100;
        var unknown = isUserUnknown(input);
        var guest = isGuestUser(user);
        var adult = hasKnownAdultAge(user);
        var id = unknown ? null : assignmentId(user);
        var holdout = !unknown && !guest && adult && inHoldout(id, pct);
        var reason = null;
        var experimentGroup = null;
        var show = false;

        if (unknown) {
            reason = 'unknown';
        } else if (tctv) {
            reason = 'tctv';
        } else if (isKidsAccount(user)) {
            reason = 'kids';
        } else if (isClassroomAccount(user)) {
            reason = 'classroom';
        } else if (isPremiumAccount(user)) {
            reason = 'premium';
        } else if (guest) {
            reason = 'guest';
        } else if (!adult) {
            reason = 'age';
        } else if (kidsSurface) {
            reason = 'kids-surface';
        } else if (sensitive) {
            reason = 'sensitive';
        } else if (holdout) {
            reason = 'holdout';
            experimentGroup = 'holdout';
        } else if (!isAllowedSurface(surface)) {
            reason = 'surface';
        } else {
            show = true;
            experimentGroup = 'ads';
        }

        // Eligible (signed-in, known adult age, not kids/classroom/premium,
        // not on TCTV) users in the experiment still belong to holdout or
        // ads even when the current surface has no slot, so daily-active
        // return can be compared later. Guests and no-age users are left
        // out, so holdout logging counts only eligible (18+) users.
        if (!unknown && !tctv && !guest && adult && !isKidsAccount(user) && !isClassroomAccount(user) && !isPremiumAccount(user)) {
            experimentGroup = holdout ? 'holdout' : 'ads';
            if (holdout) reason = 'holdout';
            else if (!show) reason = reason || (kidsSurface ? 'kids-surface' : (sensitive ? 'sensitive' : 'surface'));
        }

        return {
            show: show,
            reason: reason,
            surface: surface,
            experimentGroup: experimentGroup,
            assignmentId: id,
            holdoutPct: pct,
            bucket: unknown ? null : bucket(id)
        };
    }

    function shouldShowAds(input) {
        return decide(input).show === true;
    }

    function aadsIframeHtml() {
        return '<iframe data-aa="' + AADS_UNIT + '" src="' + AADS_SRC + '"' +
            ' sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"' +
            ' referrerpolicy="no-referrer"' +
            ' style="border:0;padding:0;width:100%;height:auto;overflow:hidden;display:block;max-width:100%;position:relative;z-index:0;"' +
            ' title="Advertisement" loading="lazy"></iframe>';
    }

    function adsenseAllowed(decision, input) {
        if (!decision || decision.show !== true) return false;
        if (!ADSENSE_SURFACES[decision.surface]) return false;
        if (isSensitiveSurface(input) || sensitiveUiOpen()) return false;
        input = input || {};
        var user = userForAge(input);
        if (!hasKnownAdultAge(user)) return false;
        return true;
    }

    function ensureHomeSlot() {
        var slot = typeof document !== 'undefined' ? document.getElementById('bqAadsHome') : null;
        if (slot) return slot;
        if (typeof document === 'undefined') return null;
        var after = document.querySelector('#homeHero .home-subtitle') || document.getElementById('homeHero');
        if (!after) return null;
        slot = document.createElement('div');
        slot.id = 'bqAadsHome';
        slot.className = 'bq-ad-slot bq-ad-slot-home';
        slot.hidden = true;
        slot.setAttribute('aria-label', 'Advertisement');
        if (after.parentNode) {
            if (after.nextSibling) after.parentNode.insertBefore(slot, after.nextSibling);
            else after.parentNode.appendChild(slot);
        }
        return slot;
    }

    function ensureSurfaceSlot(id, parent) {
        if (typeof document === 'undefined' || !parent) return null;
        var slot = document.getElementById(id);
        if (slot && parent.contains(slot)) return slot;
        if (slot && slot.parentNode) slot.parentNode.removeChild(slot);
        slot = document.createElement('div');
        slot.id = id;
        slot.className = 'bq-ad-slot';
        slot.hidden = true;
        slot.setAttribute('aria-label', 'Advertisement');
        if (parent.firstChild) parent.insertBefore(slot, parent.firstChild);
        else parent.appendChild(slot);
        return slot;
    }

    function clearSlot(slot) {
        if (!slot) return;
        slot.hidden = true;
        slot.innerHTML = '';
    }

    function fillAads(slot) {
        if (!slot) return;
        slot.innerHTML = '<p class="bq-ad-label">Ad</p>' + aadsIframeHtml();
        slot.hidden = false;
    }

    function adsenseScriptPresent() {
        if (typeof document === 'undefined') return false;
        var scripts = document.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) {
            if (scripts[i].src && scripts[i].src.indexOf('adsbygoogle.js') !== -1) return true;
        }
        return false;
    }

    function injectAdsenseScript() {
        if (typeof document === 'undefined') return;
        if (adsenseScriptPresent()) return;
        var s = document.createElement('script');
        s.async = true;
        s.src = ADSENSE_SRC;
        s.crossOrigin = 'anonymous';
        s.setAttribute('data-bq-adsense', '1');
        (document.head || document.documentElement).appendChild(s);
    }

    function removeAdsenseArtifacts() {
        if (typeof document === 'undefined') return;
        var nodes = document.querySelectorAll(
            'ins.adsbygoogle, iframe[src*="googlesyndication"], iframe[src*="doubleclick"], [id^="google_ads_"], [id^="aswift_"]'
        );
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
        }
        var scripts = document.querySelectorAll('script[data-bq-adsense="1"]');
        for (var j = 0; j < scripts.length; j++) {
            if (scripts[j].parentNode) scripts[j].parentNode.removeChild(scripts[j]);
        }
    }

    function fillAdsense(slot) {
        if (!slot) return;
        injectAdsenseScript();
        slot.innerHTML = '<p class="bq-ad-label">Ad</p>' +
            '<ins class="adsbygoogle" style="display:block;position:relative;z-index:0;"' +
            ' data-ad-client="' + ADSENSE_CLIENT + '"' +
            ' data-ad-format="horizontal"' +
            ' data-full-width-responsive="true"></ins>';
        slot.hidden = false;
        try {
            root.adsbygoogle = root.adsbygoogle || [];
            root.adsbygoogle.push({});
        } catch (e) {}
    }

    function hideAllSlots() {
        if (typeof document === 'undefined') return;
        var slots = document.querySelectorAll('.bq-ad-slot');
        for (var i = 0; i < slots.length; i++) clearSlot(slots[i]);
        removeAdsenseArtifacts();
    }

    function incPayload(field) {
        var data = {};
        data[field] = 1;
        return data;
    }

    function incrementAggregate(day, field, firestore) {
        if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return Promise.resolve(false);
        if (['holdoutDau', 'adsDau', 'holdoutReturned', 'adsReturned'].indexOf(field) < 0) {
            return Promise.resolve(false);
        }
        var db = firestore;
        if (!db && typeof firebase !== 'undefined' && firebase.firestore) {
            try { db = firebase.firestore(); } catch (e) { db = null; }
        }
        if (!db) return Promise.resolve(false);
        var ref = db.collection('ads_holdout_stats').doc(day);
        var inc = firebase.firestore.FieldValue.increment(1);
        var patch = {};
        patch[field] = inc;
        return ref.set(patch, { merge: true }).then(function () { return true; }).catch(function () {
            // First-write fallback if merge increment on a missing doc is denied.
            return ref.set(incPayload(field)).then(function () { return true; }).catch(function () { return false; });
        });
    }

    /**
     * Record this daily-active's experiment group, and if they were active
     * yesterday, increment that cohort's next-day return count. Writes only
     * four aggregate counters. Never writes a user or device id.
     */
    function recordDailyAggregate(decision, now, firestore) {
        decision = decision || decide();
        var group = decision.experimentGroup;
        if (group !== 'holdout' && group !== 'ads') {
            return { recorded: false, returned: false, group: null, day: null };
        }
        var today = etDateKey(now);
        var yesterday = previousEtDateKey(now);
        var todayMem = null;
        var ydayMem = null;
        try { todayMem = JSON.parse(storageGet(AGG_TODAY_KEY) || 'null'); } catch (e) { todayMem = null; }
        try { ydayMem = JSON.parse(storageGet(AGG_YDAY_KEY) || 'null'); } catch (eY) { ydayMem = null; }
        var recorded = false;
        var returned = false;

        if (todayMem && todayMem.date && todayMem.date !== today) {
            ydayMem = todayMem;
            storageSet(AGG_YDAY_KEY, JSON.stringify(ydayMem));
            todayMem = null;
        }
        if (!(todayMem && todayMem.date === today && todayMem.group === group)) {
            var field = group === 'holdout' ? 'holdoutDau' : 'adsDau';
            incrementAggregate(today, field, firestore);
            storageSet(AGG_TODAY_KEY, JSON.stringify({ date: today, group: group }));
            recorded = true;
        }
        if (ydayMem && ydayMem.date === yesterday && (ydayMem.group === 'holdout' || ydayMem.group === 'ads') && ydayMem.returnedOn !== today) {
            var rfield = ydayMem.group === 'holdout' ? 'holdoutReturned' : 'adsReturned';
            incrementAggregate(yesterday, rfield, firestore);
            ydayMem.returnedOn = today;
            storageSet(AGG_YDAY_KEY, JSON.stringify(ydayMem));
            returned = true;
        }

        return { recorded: recorded, returned: returned, group: group, day: today };
    }

    function sync(input) {
        var decision = decide(input);
        recordDailyAggregate(decision, input && input.now, input && input.firestore);
        if (!decision.show) {
            hideAllSlots();
            return decision;
        }
        if (decision.surface === 'home') {
            fillAads(ensureHomeSlot());
            var learn = typeof document !== 'undefined' ? document.getElementById('bqAdsenseLearn') : null;
            var arcade = typeof document !== 'undefined' ? document.getElementById('bqAdsenseArcade') : null;
            clearSlot(learn);
            clearSlot(arcade);
        } else if (decision.surface === 'learning-quests') {
            var hub = typeof document !== 'undefined' ? document.getElementById('lqHub') : null;
            var host = hub && (hub.querySelector('div') || hub);
            var learnSlot = ensureSurfaceSlot('bqAdsenseLearn', host);
            if (adsenseAllowed(decision, input)) fillAdsense(learnSlot);
            else fillAads(learnSlot);
            clearSlot(typeof document !== 'undefined' ? document.getElementById('bqAadsHome') : null);
            clearSlot(typeof document !== 'undefined' ? document.getElementById('bqAdsenseArcade') : null);
        } else if (decision.surface === 'proof-of-play' || decision.surface === 'arcade') {
            var overlay = typeof document !== 'undefined' ? document.getElementById('popOverlay') : null;
            var popHost = null;
            if (overlay) {
                popHost = overlay.querySelector('.pop-header') ? overlay : overlay;
                var body = overlay.querySelector('#popBody') || overlay;
                popHost = body.parentNode || overlay;
            }
            var arcadeSlot = ensureSurfaceSlot('bqAdsenseArcade', popHost || overlay);
            if (adsenseAllowed(decision, input)) fillAdsense(arcadeSlot);
            else fillAads(arcadeSlot);
            clearSlot(typeof document !== 'undefined' ? document.getElementById('bqAadsHome') : null);
            clearSlot(typeof document !== 'undefined' ? document.getElementById('bqAdsenseLearn') : null);
        } else {
            hideAllSlots();
        }
        return decision;
    }

    function hookFn(obj, name, after) {
        if (!obj || typeof obj[name] !== 'function' || obj[name]._bqAdsHooked) return;
        var orig = obj[name];
        var wrapped = function () {
            var result = orig.apply(this, arguments);
            try {
                if (result && typeof result.then === 'function') {
                    return result.then(function (v) { after(); return v; });
                }
            } catch (e) {}
            after();
            return result;
        };
        wrapped._bqAdsHooked = true;
        obj[name] = wrapped;
    }

    function markUserKnown() {
        if (root) {
            root._bqAdsAuthReady = true;
            root._bqAdsUserUnknown = false;
        }
        sync();
    }

    function markUserUnknown() {
        if (root) {
            root._bqAdsUserUnknown = true;
        }
        hideAllSlots();
    }

    function userDocLooksLoaded(user, uid) {
        if (!user || !uid || user.uid !== uid) return false;
        return user.premium !== undefined || user.isMinor !== undefined || user.ageBand !== undefined || user.under13 !== undefined || user.username !== undefined || user.points !== undefined || user.displayName !== undefined;
    }

    function hookAuth() {
        if (typeof window === 'undefined' || window._bqAdsAuthHooked) return;
        var authObj = null;
        try {
            if (typeof firebase !== 'undefined' && firebase.auth) authObj = firebase.auth();
        } catch (e) { authObj = null; }
        if (!authObj && typeof auth !== 'undefined') authObj = auth;
        if (!authObj || typeof authObj.onAuthStateChanged !== 'function') return;
        window._bqAdsAuthHooked = true;
        authObj.onAuthStateChanged(function (signed) {
            if (!signed || signed.isAnonymous === true) {
                freshUserDoc = null;
                markUserKnown();
                return;
            }
            var uid = String(signed.uid || '');
            if (root) {
                root._bqAdsAuthReady = true;
                root._bqAdsUserUnknown = true;
            }
            sync({ userUnknown: true });
            fetchFreshUserDoc(uid).then(function (doc) {
                if (signedInUid() !== uid) return;
                if (doc) markUserKnown();
            });
        });
        hookFn(window, 'loadUser', function () {
            var uid = signedInUid();
            if (!uid) {
                freshUserDoc = null;
                markUserKnown();
                return;
            }
            fetchFreshUserDoc(uid).then(function (doc) {
                if (signedInUid() !== uid) return;
                if (doc) markUserKnown();
            });
        });
    }

    function hookNavigation() {
        if (typeof window === 'undefined') return;
        hookAuth();
        hookFn(window, 'go', function () { sync(); });
        hookFn(window, 'enterProofOfPlay', function () { sync({ surface: 'proof-of-play' }); });
        hookFn(window, 'exitProofOfPlay', function () { sync(); });
        hookFn(window, 'renderLearningQuestHub', function () { sync({ surface: 'learning-quests' }); });
        hookFn(window, 'leaveTimechainTV', function () { sync(); });
        hookFn(window, 'renderTimechainTV', function () { hideAllSlots(); });
        hookFn(window, 'renderMarketplace', function () { sync({ surface: 'marketplace' }); });
        if (!window._bqAdsPopstate) {
            window._bqAdsPopstate = true;
            window.addEventListener('popstate', function () { sync(); });
        }
        if (typeof document !== 'undefined' && document.body && !window._bqAdsMo) {
            window._bqAdsMo = new MutationObserver(function () {
                if (document.body.classList.contains('tctv-active')) hideAllSlots();
            });
            window._bqAdsMo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        }
    }

    function boot() {
        if (root && root.BQ_ADS_NO_BOOT) return;
        if (root && root._bqAdsAuthReady !== true) {
            root._bqAdsUserUnknown = true;
        }
        hookNavigation();
        sync();
        if (typeof setInterval === 'function') {
            setInterval(function () { hookNavigation(); }, 2000);
        }
        if (typeof document !== 'undefined') {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function () { hookNavigation(); sync(); });
            }
        }
    }

    var api = {
        HOLDOUT_PCT: HOLDOUT_PCT,
        AADS_UNIT: AADS_UNIT,
        AADS_SRC: AADS_SRC,
        ADSENSE_CLIENT: ADSENSE_CLIENT,
        holdoutPct: holdoutPct,
        etDateKey: etDateKey,
        previousEtDateKey: previousEtDateKey,
        fnv1a: fnv1a,
        bucket: bucket,
        inHoldout: inHoldout,
        deviceId: deviceId,
        assignmentId: assignmentId,
        isPremiumAccount: isPremiumAccount,
        isKidsAccount: isKidsAccount,
        hasKnownAdultAge: hasKnownAdultAge,
        fetchFreshUserDoc: fetchFreshUserDoc,
        getFreshUserDoc: getFreshUserDoc,
        isGuestUser: isGuestUser,
        isClassroomAccount: isClassroomAccount,
        isFamilyOrClassroomPlan: isFamilyOrClassroomPlan,
        isKidsSurface: isKidsSurface,
        isSensitiveSurface: isSensitiveSurface,
        isUserUnknown: isUserUnknown,
        adsenseAllowed: adsenseAllowed,
        isTimechainTvSurface: isTimechainTvSurface,
        currentSurface: currentSurface,
        isAllowedSurface: isAllowedSurface,
        decide: decide,
        shouldShowAds: shouldShowAds,
        aadsIframeHtml: aadsIframeHtml,
        recordDailyAggregate: recordDailyAggregate,
        incrementAggregate: incrementAggregate,
        sync: sync,
        hideAllSlots: hideAllSlots,
        hookNavigation: hookNavigation,
        boot: boot
    };

    root.bqAds = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (!root.BQ_ADS_NO_BOOT) {
        if (typeof document !== 'undefined' && document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', boot);
        } else {
            try { boot(); } catch (e) {}
        }
    }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
