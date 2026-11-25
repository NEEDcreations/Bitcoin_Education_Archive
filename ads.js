/**
 * Bitcoin Quest ads (RLDA-40).
 *
 * Homepage: A-ADS unit 2463147 (https iframe, in-flow, no z-index 99998).
 * Learn + arcade: AdSense script (ca-pub-7244515226002177) in reserved slots.
 * Hard rule (Phil, Nov 25): no ads of any kind on Timechain TV screens —
 * no paid ads, no ad breaks, nothing overlaying or pausing the player.
 *
 * Kids, Classroom, and Premium accounts never see ads.
 * A configurable ad-free holdout (default 10%) is assigned stably per
 * user id or, for guests, a persistent device id. It may become 20%
 * pending Phil; change BQ_ADS_HOLDOUT_PCT only.
 *
 * Holdout vs ads is recorded as aggregate daily-active and next-day-return
 * counts only (ads_holdout_stats/{YYYY-MM-DD}). No per-user export.
 */
(function (root) {
    'use strict';

    var HOLDOUT_PCT = 10;
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
    var TCTV_SURFACES = {
        'timechain-tv': true,
        tv: true,
        tctv: true
    };

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

    function isKidsAccount(user) {
        if (!user) return false;
        if (user.kids === true || user.isKids === true || user.kidsMode === true) return true;
        var t = accountLabel(user);
        return t === 'kids' || t === 'kid' || t === 'child' || t === 'family-child' || t === 'minor';
    }

    function isClassroomAccount(user) {
        if (!user) return false;
        if (user.classroom === true || user.isClassroom === true || user.classroomMode === true) return true;
        var t = accountLabel(user);
        return t === 'classroom' || t === 'student' || t === 'school';
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
     * this daily-active belongs to. Restricted accounts are ad-free and
     * are left out of the holdout-vs-ads comparison.
     */
    function decide(input) {
        input = input || {};
        var user = input.user;
        if (user === undefined && typeof currentUser !== 'undefined') user = currentUser;
        var surface = currentSurface(input);
        var tctv = isTimechainTvSurface(input) || surface === 'timechain-tv';
        var pct = input.holdoutPct != null ? Number(input.holdoutPct) : holdoutPct();
        if (!isFinite(pct) || pct < 0) pct = HOLDOUT_PCT;
        if (pct > 100) pct = 100;
        var id = assignmentId(user);
        var holdout = inHoldout(id, pct);
        var reason = null;
        var experimentGroup = null;
        var show = false;

        if (tctv) {
            reason = 'tctv';
        } else if (isKidsAccount(user)) {
            reason = 'kids';
        } else if (isClassroomAccount(user)) {
            reason = 'classroom';
        } else if (isPremiumAccount(user)) {
            reason = 'premium';
        } else if (holdout) {
            reason = 'holdout';
            experimentGroup = 'holdout';
        } else if (!isAllowedSurface(surface)) {
            reason = 'surface';
        } else {
            show = true;
            experimentGroup = 'ads';
        }

        // Eligible (not kids/classroom/premium, not on TCTV) users in the
        // experiment still belong to holdout or ads even when the current
        // surface has no slot, so daily-active return can be compared later.
        if (!tctv && !isKidsAccount(user) && !isClassroomAccount(user) && !isPremiumAccount(user)) {
            experimentGroup = holdout ? 'holdout' : 'ads';
            if (holdout) reason = 'holdout';
            else if (!show) reason = reason || 'surface';
        }

        return {
            show: show,
            reason: reason,
            surface: surface,
            experimentGroup: experimentGroup,
            assignmentId: id,
            holdoutPct: pct,
            bucket: bucket(id)
        };
    }

    function shouldShowAds(input) {
        return decide(input).show === true;
    }

    function aadsIframeHtml() {
        return '<iframe data-aa="' + AADS_UNIT + '" src="' + AADS_SRC + '"' +
            ' style="border:0;padding:0;width:100%;height:auto;overflow:hidden;display:block;max-width:100%;position:relative;z-index:0;"' +
            ' title="Advertisement" loading="lazy"></iframe>';
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
            fillAdsense(ensureSurfaceSlot('bqAdsenseLearn', host));
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
            fillAdsense(ensureSurfaceSlot('bqAdsenseArcade', popHost || overlay));
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

    function hookNavigation() {
        if (typeof window === 'undefined') return;
        hookFn(window, 'go', function () { sync(); });
        hookFn(window, 'enterProofOfPlay', function () { sync({ surface: 'proof-of-play' }); });
        hookFn(window, 'exitProofOfPlay', function () { sync(); });
        hookFn(window, 'renderLearningQuestHub', function () { sync({ surface: 'learning-quests' }); });
        hookFn(window, 'leaveTimechainTV', function () { sync(); });
        hookFn(window, 'renderTimechainTV', function () { hideAllSlots(); });
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
        isClassroomAccount: isClassroomAccount,
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
