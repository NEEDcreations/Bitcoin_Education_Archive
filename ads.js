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
 *
 * Privacy choices (feat/ads-privacy-choices-1126): honor Global Privacy
 * Control and a "Your Privacy Choices" opt-out. Opted-out users get
 * AdSense non-personalized ads (requestNonPersonalizedAds=1 / npa=1) and
 * never A-ADS (A-ADS's policy allows cookies, web beacons, and device
 * identifiers). Store the toggle in localStorage and, when signed in, on
 * the account via the setPrivacyShareOptOut callable (no rules change).
 * EEA, UK, and Switzerland (and unknown country) get no ads until
 * ADS_EEA_ENABLED / BQ_ADS_EEA_ENABLED is true, after AdSense Privacy &
 * messaging (Funding Choices) is on. Fail closed. Country comes from the
 * existing /cdn-cgi/trace endpoint; no worker publish is required for geo.
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

    // Hold one firebase object for the life of this file. index.html and
    // 404.html load firebase-*-compat.js and firebase-config.js (all defer)
    // before ads.js, so the object is already on the page when this runs.
    // If it is missing at load (tests or an unexpected order), take it on
    // first use and then keep that same object.
    var firebaseRef = null;
    function adsFirebase() {
        if (firebaseRef) return firebaseRef;
        try {
            if (typeof firebase !== 'undefined' && firebase) firebaseRef = firebase;
            else if (root && root.firebase) firebaseRef = root.firebase;
        } catch (e) {}
        return firebaseRef;
    }
    adsFirebase();

    function isNodeProcess() {
        try {
            return typeof process !== 'undefined' && !!process.versions && !!process.versions.node;
        } catch (e) {
            return false;
        }
    }

    var OPT_OUT_KEY = 'bq_privacy_share_opt_out';
    var OPT_OUT_AT_KEY = 'bq_privacy_share_opt_out_at';
    var COUNTRY_SESSION_KEY = 'bq_ads_country';
    var TRACE_PATH = '/cdn-cgi/trace';
    var ACCOUNT_OPTOUT_FIELD = 'privacyShareOptOut';
    var CALLABLE_NAME = 'setPrivacyShareOptOut';
    // EEA + UK + Switzerland, plus EU outermost regions Cloudflare may return.
    // ADS_EEA_ENABLED / BQ_ADS_EEA_ENABLED stays false until AdSense Privacy &
    // messaging (Funding Choices) is on and verified. Unknown country = no ads.
    var RESTRICTED_COUNTRIES = {
        AT: 1, BE: 1, BG: 1, HR: 1, CY: 1, CZ: 1, DK: 1, EE: 1, FI: 1, FR: 1,
        DE: 1, GR: 1, HU: 1, IS: 1, IE: 1, IT: 1, LV: 1, LI: 1, LT: 1, LU: 1,
        MT: 1, NL: 1, NO: 1, PL: 1, PT: 1, RO: 1, SK: 1, SI: 1, ES: 1, SE: 1,
        GB: 1, CH: 1, AX: 1, GF: 1, GP: 1, MQ: 1, RE: 1, YT: 1, MF: 1, BL: 1
    };
    var UNKNOWN_COUNTRY_CODES = { XX: 1, T1: 1 };
    var geoState = { started: false, resolved: false, country: null };

    function eeaAdsEnabled() {
        var raw = null;
        if (root) {
            if (root.BQ_ADS_EEA_ENABLED != null) raw = root.BQ_ADS_EEA_ENABLED;
            else if (root.ADS_EEA_ENABLED != null) raw = root.ADS_EEA_ENABLED;
        }
        return raw === true || raw === 1 || raw === 'true' || raw === '1';
    }

    function isRestrictedCountry(code) {
        if (!code) return false;
        return RESTRICTED_COUNTRIES[String(code).toUpperCase()] === 1;
    }

    function hasGpc(input) {
        if (input && input.gpc === true) return true;
        if (input && input.gpc === false) return false;
        try {
            var nav = (typeof navigator !== 'undefined') ? navigator : (root && root.navigator);
            return !!(nav && nav.globalPrivacyControl === true);
        } catch (e) {
            return false;
        }
    }

    function localOptedOut() {
        return storageGet(OPT_OUT_KEY) === '1';
    }

    function accountOptedOut(user) {
        if (!user) user = freshUserDoc;
        return !!(user && user[ACCOUNT_OPTOUT_FIELD] === true);
    }

    function isPrivacyShareOptedOut(input) {
        input = input || {};
        if (hasGpc(input)) return true;
        if (localOptedOut()) return true;
        var user = null;
        try { user = userForAge(input); } catch (e) { user = freshUserDoc; }
        if (accountOptedOut(user) || accountOptedOut(input.user)) return true;
        return false;
    }

    function persistAccountOptOut(optedOut) {
        try {
            if (!signedInUid()) return Promise.resolve(false);
            var fb = adsFirebase();
            if (!fb || !fb.functions) return Promise.resolve(false);
            var fn = fb.functions().httpsCallable(CALLABLE_NAME);
            return Promise.resolve(fn({ optedOut: !!optedOut })).then(function () {
                return true;
            }).catch(function () {
                return false;
            });
        } catch (e) {
            return Promise.resolve(false);
        }
    }

    var personalizedAdsLive = false;
    var lastSeenGpc = false;

    var pendingPrivacyReload = false;

    function personalizedArtifactsLive() {
        if (typeof document === 'undefined') return false;
        var scripts = document.getElementsByTagName('script');
        var i, src, ins;
        for (i = 0; i < scripts.length; i++) {
            src = scripts[i].src || '';
            if (src.indexOf('adsbygoogle.js') !== -1 && src.indexOf('npa=1') === -1 && scripts[i].getAttribute('data-npa') !== '1') {
                return true;
            }
        }
        ins = document.querySelectorAll ? document.querySelectorAll('ins.adsbygoogle') : [];
        for (i = 0; i < ins.length; i++) {
            if (ins[i].getAttribute('data-npa-on-unknown') !== '1') return true;
        }
        return false;
    }

    function flushDeferredPrivacyReload() {
        if (!pendingPrivacyReload) return false;
        if (sensitiveUiOpen()) return false;
        pendingPrivacyReload = false;
        return requestPrivacyReload();
    }

    function requestPrivacyReload() {
        try {
            if (root && typeof root.BQ_ADS_RELOAD === 'function') {
                root.BQ_ADS_RELOAD();
                return true;
            }
        } catch (e) {}
        try {
            if (typeof location !== 'undefined' && location && typeof location.reload === 'function') {
                location.reload();
                return true;
            }
        } catch (e2) {}
        return false;
    }

    // Mid-page opt-out or GPC: drop personalized slots immediately. If a
    // personalized AdSense tag already loaded, reload so the old library
    // cannot keep requesting personalized ads. Tests may stub BQ_ADS_RELOAD.
    function applyPrivacyChoiceNow(input) {
        var opted = isPrivacyShareOptedOut(input);
        applyNonPersonalizedAds(opted);
        if (!opted) pendingPrivacyReload = false;
        if (opted) {
            // Inspect the page before hideAllSlots() strips the tags.
            var mustReload = personalizedAdsLive || pendingPrivacyReload || personalizedArtifactsLive();
            // Personalized AdSense must be dropped (and usually reloaded) so
            // the next inject is npa=1. For A-ADS-only Home, skip the hide
            // and let sync() switch the slot to NPA AdSense instead.
            if (mustReload) {
                hideAllSlots();
                // Keep a deferred reload armed if one is already waiting, so a
                // later apply() during claim/withdraw cannot fall through to
                // sync() and refill slots.
                personalizedAdsLive = false;
                if (sensitiveUiOpen()) {
                    pendingPrivacyReload = true;
                    try { updatePrivacyChoicesUi(); } catch (e) {}
                    return { reloaded: false, optedOut: true, deferredReload: true };
                }
                pendingPrivacyReload = false;
                if (requestPrivacyReload()) {
                    try { updatePrivacyChoicesUi(); } catch (e2) {}
                    return { reloaded: true, optedOut: true };
                }
            } else {
                personalizedAdsLive = false;
            }
        }
        var decision = sync(input);
        try { updatePrivacyChoicesUi(); } catch (e2) {}
        return { reloaded: false, optedOut: opted, decision: decision };
    }

    function setShareOptOut(optedOut) {
        optedOut = !!optedOut;
        storageSet(OPT_OUT_KEY, optedOut ? '1' : '0');
        storageSet(OPT_OUT_AT_KEY, String(Date.now()));
        if (freshUserDoc) freshUserDoc[ACCOUNT_OPTOUT_FIELD] = optedOut;
        persistAccountOptOut(optedOut);
        // Mid-session opt-out must drop a personalized tag already on the
        // page. removeAdsenseArtifacts + clear slots live in hideAllSlots,
        // so the next fill injects npa=1 instead of returning early.
        if (optedOut) hideAllSlots();
        return applyPrivacyChoiceNow();
    }

    function watchPrivacySignals() {
        var now = hasGpc();
        if (now && !lastSeenGpc) applyPrivacyChoiceNow();
        lastSeenGpc = now;
        flushDeferredPrivacyReload();
    }

    function parseTraceCountry(text) {
        if (!text) return null;
        var m = String(text).match(/(?:^|\n)loc=([A-Za-z]{2})(?:\n|$)/);
        if (!m) return null;
        return m[1].toUpperCase();
    }

    function readCountry(input) {
        input = input || {};
        // A console caller must not override geo with { country: 'US' }.
        // Node unit tests still pass country through allowExplicitUser().
        if (allowExplicitUser(input) && Object.prototype.hasOwnProperty.call(input, 'country')) {
            var c = input.country;
            if (c == null || c === '') return { apply: true, known: false, value: null };
            var up = String(c).toUpperCase();
            if (UNKNOWN_COUNTRY_CODES[up] === 1) return { apply: true, known: false, value: up };
            return { apply: true, known: true, value: up };
        }
        if (geoState.resolved) {
            return { apply: true, known: !!geoState.country, value: geoState.country };
        }
        if (geoState.started) {
            return { apply: true, known: false, value: null };
        }
        // Browser / document path: geo has not started, so fills and
        // decide() fail closed. Node unit tests with no document keep the
        // previous contract unless they pass country or start a lookup.
        if (typeof document !== 'undefined') {
            return { apply: true, known: false, value: null };
        }
        return { apply: false, known: false, value: null };
    }

    function isGeoBlocked(input) {
        var info = readCountry(input);
        if (!info.apply) return false;
        if (!info.known) return true;
        if (!isRestrictedCountry(info.value)) return false;
        return !eeaAdsEnabled();
    }

    // Fills (and sync) must not run while country is unknown or the
    // lookup has not started or finished, even if decide() was given no
    // country in a Node test. An explicit input.country wins only when
    // allowExplicitUser() is true (Node tests, never the browser).
    function fillsBlocked(input) {
        if (isGeoBlocked(input)) return true;
        var info = readCountry(input);
        if (!info.apply) return true;
        if (!info.known) return true;
        return false;
    }

    function rememberCountry(code) {
        var known = !!(code && UNKNOWN_COUNTRY_CODES[code] !== 1);
        geoState.started = true;
        geoState.resolved = true;
        geoState.country = known ? code : null;
        try {
            if (typeof sessionStorage !== 'undefined' && sessionStorage) {
                if (geoState.country) sessionStorage.setItem(COUNTRY_SESSION_KEY, geoState.country);
                else sessionStorage.removeItem(COUNTRY_SESSION_KEY);
            }
        } catch (e) {}
        return geoState.country;
    }

    function fetchCountrySignal() {
        var fetchFn = (root && root.fetch) || (typeof fetch === 'function' ? fetch : null);
        if (!fetchFn) return Promise.resolve(null);
        return Promise.resolve(fetchFn(TRACE_PATH, { credentials: 'omit', cache: 'no-store' })).then(function (res) {
            if (!res || !res.ok) return null;
            if (typeof res.text === 'function') return res.text();
            return null;
        }).then(function (text) {
            return parseTraceCountry(text);
        }).catch(function () {
            return null;
        });
    }

    function ensureGeo() {
        if (geoState.resolved) return Promise.resolve(geoState.country);
        geoState.started = true;
        try {
            if (typeof sessionStorage !== 'undefined' && sessionStorage) {
                var cached = sessionStorage.getItem(COUNTRY_SESSION_KEY);
                if (cached && /^[A-Z]{2}$/.test(cached) && UNKNOWN_COUNTRY_CODES[cached] !== 1) {
                    // Session cache is a hint only after a live check in this
                    // document. Still fail closed until this page's fetch returns,
                    // except in tests that set the cache then mark resolved.
                }
            }
        } catch (e) {}
        return fetchCountrySignal().then(function (code) {
            rememberCountry(code);
            return geoState.country;
        });
    }

    function adsenseScriptSrc(npa) {
        if (npa) {
            return ADSENSE_SRC + (ADSENSE_SRC.indexOf('?') >= 0 ? '&' : '?') + 'npa=1';
        }
        // Official client tag. When ADS_EEA_ENABLED is on and AdSense Privacy
        // & messaging is published, Funding Choices attaches to this tag. No
        // custom CMP.
        return ADSENSE_SRC;
    }

    function applyNonPersonalizedAds(npa) {
        if (!root) return;
        root.adsbygoogle = root.adsbygoogle || [];
        if (npa) root.adsbygoogle.requestNonPersonalizedAds = 1;
    }

    function shouldSkipAads(input) {
        return isPrivacyShareOptedOut(input);
    }

    function privacyChoicesOpenRequested() {
        var open = false;
        try {
            // Peek only. ranking.js reads this flag to scroll Settings, then
            // removes it. Consuming it here dropped the scroll.
            if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('btc_open_privacy_choices') === '1') {
                open = true;
            }
        } catch (e) {}
        try {
            var loc = (root && root.location) || (typeof location !== 'undefined' ? location : null);
            var hash = loc && loc.hash ? String(loc.hash).replace(/^#/, '') : '';
            var first = hash.split('/')[0];
            if (first === 'privacy-choices' || first === 'settings-privacy-choices') open = true;
        } catch (e2) {}
        return open;
    }

    function updatePrivacyChoicesUi() {
        if (typeof document === 'undefined') return;
        var opted = isPrivacyShareOptedOut();
        var gpc = hasGpc();
        var box = document.getElementById('bqPrivacyShareOptOut');
        if (box) {
            box.checked = opted;
            if (gpc) box.setAttribute('aria-description', 'Your browser sent a Global Privacy Control signal.');
        }
        var note = document.getElementById('bqPrivacyChoicesGpcNote');
        if (note) note.hidden = !gpc;
        var modalNote = document.getElementById('bqPrivacyChoicesModalGpcNote');
        if (modalNote) modalNote.hidden = !gpc;
        var modalBox = document.getElementById('bqPrivacyChoicesModalOptOut');
        if (modalBox) modalBox.checked = opted;
    }

    function openPrivacyChoices() {
        if (typeof document === 'undefined') return;
        var existing = document.getElementById('bqPrivacyChoicesModal');
        if (existing) {
            existing.hidden = false;
            updatePrivacyChoicesUi();
            try { existing.focus(); } catch (e) {}
            return;
        }
        var wrap = document.createElement('div');
        wrap.id = 'bqPrivacyChoicesModal';
        wrap.setAttribute('role', 'dialog');
        wrap.setAttribute('aria-labelledby', 'bqPrivacyChoicesTitle');
        wrap.tabIndex = -1;
        wrap.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:16px;';
        var opted = isPrivacyShareOptedOut();
        var gpc = hasGpc();
        wrap.innerHTML = '<div style="background:var(--card-bg,#111);color:var(--text,#eee);border:1px solid var(--border,#333);border-radius:12px;padding:20px;max-width:420px;width:100%;font-family:inherit;">' +
            '<h2 id="bqPrivacyChoicesTitle" style="margin:0 0 10px;font-size:1.1rem;">Your Privacy Choices</h2>' +
            '<p style="margin:0 0 12px;font-size:0.9rem;line-height:1.5;color:var(--text-muted,#bbb);">Opt out of sharing cookie and device identifiers for personalized ads. Eligible users still see non-personalized ads. We also honor Global Privacy Control (GPC) from your browser.</p>' +
            '<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;font-size:0.9rem;">' +
            '<input type="checkbox" id="bqPrivacyChoicesModalOptOut"' + (opted ? ' checked' : '') + '>' +
            '<span>Do not sell or share my personal information</span></label>' +
            '<p id="bqPrivacyChoicesModalGpcNote" style="margin:10px 0 0;font-size:0.8rem;color:var(--text-muted,#bbb);"' + (gpc ? '' : ' hidden') + '>Your browser sent a Global Privacy Control signal, so personalized ads are already off.</p>' +
            '<div style="margin-top:16px;text-align:right;"><button type="button" id="bqPrivacyChoicesClose" style="padding:8px 14px;border-radius:8px;border:1px solid var(--border,#333);background:var(--bg-side,#222);color:inherit;cursor:pointer;font-family:inherit;">Close</button></div>' +
            '</div>';
        document.body.appendChild(wrap);
        var box = document.getElementById('bqPrivacyChoicesModalOptOut');
        if (box) box.addEventListener('change', function () { setShareOptOut(box.checked); });
        var close = document.getElementById('bqPrivacyChoicesClose');
        if (close) close.addEventListener('click', function () { wrap.hidden = true; });
        wrap.addEventListener('click', function (ev) { if (ev.target === wrap) wrap.hidden = true; });
        try { wrap.focus(); } catch (e3) {}
    }

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
        // Honor a caller-supplied user, and the test-only
        // _bqAdsAllowExplicitUser flag, only in Node tests. In the
        // browser, ignore both so a console caller cannot turn ads on.
        if (typeof document !== 'undefined') return false;
        return true;
    }

    function signedInUid() {
        try {
            var u = null;
            var fb = adsFirebase();
            if (fb && fb.auth) u = fb.auth().currentUser;
            else if (typeof auth !== 'undefined' && auth) u = auth.currentUser;
            if (u && u.uid && u.isAnonymous !== true) return String(u.uid);
        } catch (e) {}
        return '';
    }

    function adsFirestore(db) {
        if (db) return db;
        var fb = adsFirebase();
        if (fb && fb.firestore) {
            try { return fb.firestore(); } catch (e) { return null; }
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
        // Browser callers cannot inject a fake db. Node tests may still pass one.
        if (!allowExplicitUser({})) firestore = null;
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
            applyFreshUserSnap(id, snap);
            return copyFreshUserDoc();
        }).catch(function () {
            if (signedInUid() === id) freshUserDoc = null;
            return null;
        });
    }

    function copyFreshUserDoc() {
        return freshUserDoc ? Object.freeze(Object.assign({}, freshUserDoc)) : null;
    }

    function getFreshUserDoc() {
        return copyFreshUserDoc();
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
        var geoBlocked = isGeoBlocked(input);
        var optedOut = isPrivacyShareOptedOut(input);
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
        } else if (geoBlocked) {
            reason = 'geo';
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
        if (!unknown && !tctv && !guest && adult && !isKidsAccount(user) && !isClassroomAccount(user) && !isPremiumAccount(user) && !geoBlocked) {
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
            bucket: unknown ? null : bucket(id),
            npa: !!(show && optedOut),
            skipAads: !!(show && optedOut),
            privacyOptOut: !!optedOut,
            geoBlocked: !!geoBlocked,
            country: readCountry(input).value || null
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

    // Home is not an AdSense surface by default (it stays A-ADS). When A-ADS
    // is skipped because of GPC or a privacy opt-out, allow the same NPA
    // AdSense fallback Learn and the arcade already use.
    function npaFallbackAllowed(decision, input) {
        if (!decision || decision.show !== true) return false;
        if (isSensitiveSurface(input) || sensitiveUiOpen()) return false;
        input = input || {};
        var user = userForAge(input);
        if (!hasKnownAdultAge(user)) return false;
        if (ADSENSE_SURFACES[decision.surface]) return true;
        return decision.surface === 'home';
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

    var HOME_RESERVED_CLASS = 'bq-ad-reserved';

    function isHomeSlot(slot) {
        if (!slot) return false;
        if (slot.id === 'bqAadsHome') return true;
        try {
            return !!(slot.classList && slot.classList.contains('bq-ad-slot-home'));
        } catch (e) {
            return (' ' + (slot.className || '') + ' ').indexOf(' bq-ad-slot-home ') !== -1;
        }
    }

    // Reserve #bqAadsHome height up front for signed-in adults so the
    // creative cannot shift the page (CLS). clearSlot drops the class so
    // signed-out visitors stay at zero size via [hidden].
    function reserveHomeSlot(slot, on) {
        if (!isHomeSlot(slot)) return;
        try {
            if (slot.classList) {
                if (on) slot.classList.add(HOME_RESERVED_CLASS);
                else slot.classList.remove(HOME_RESERVED_CLASS);
            }
        } catch (e) {}
    }

    function clearSlot(slot) {
        if (!slot) return;
        reserveHomeSlot(slot, false);
        slot.hidden = true;
        slot.innerHTML = '';
    }

    function fillAllowed(input) {
        if (!hasKnownAdultAge(userForAge(input))) return false;
        if (fillsBlocked(input)) return false;
        return true;
    }

    function fillAads(slot, input) {
        if (!slot) return;
        if (!fillAllowed(input) || shouldSkipAads(input)) {
            clearSlot(slot);
            return;
        }
        reserveHomeSlot(slot, true);
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

    function injectAdsenseScript(npa) {
        if (typeof document === 'undefined') return;
        if (npa == null) npa = isPrivacyShareOptedOut();
        // Request NPA before the official client tag loads so Funding Choices
        // and AdSense both see the opt-out. When npa is off, leave the flag
        // unset so a later Funding Choices message can manage consent.
        applyNonPersonalizedAds(npa);
        var wanted = adsenseScriptSrc(npa);
        if (adsenseScriptPresent()) {
            var existingNpa = false;
            var scripts = document.getElementsByTagName('script');
            var si, src;
            for (si = 0; si < scripts.length; si++) {
                src = scripts[si].src || '';
                if (src.indexOf('adsbygoogle.js') !== -1) {
                    existingNpa = src.indexOf('npa=1') !== -1 || scripts[si].getAttribute('data-npa') === '1';
                    break;
                }
            }
            if (existingNpa === !!npa) return;
            // Mismatch (typically personalized already loaded, now npa=1):
            // drop our artifacts so the next inject is the npa tag.
            removeAdsenseArtifacts();
            scripts = document.getElementsByTagName('script');
            for (si = scripts.length - 1; si >= 0; si--) {
                src = scripts[si].src || '';
                if (src.indexOf('adsbygoogle.js') !== -1 && scripts[si].parentNode) {
                    scripts[si].parentNode.removeChild(scripts[si]);
                }
            }
        }
        var s = document.createElement('script');
        s.async = true;
        s.src = wanted;
        s.crossOrigin = 'anonymous';
        s.setAttribute('data-bq-adsense', '1');
        if (npa) s.setAttribute('data-npa', '1');
        else personalizedAdsLive = true;
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

    function fillAdsense(slot, input) {
        if (!slot) return;
        if (!fillAllowed(input)) {
            clearSlot(slot);
            return;
        }
        var npa = isPrivacyShareOptedOut(input);
        if (!npa) personalizedAdsLive = true;
        injectAdsenseScript(npa);
        reserveHomeSlot(slot, true);
        slot.innerHTML = '<p class="bq-ad-label">Ad</p>' +
            '<ins class="adsbygoogle" style="display:block;position:relative;z-index:0;"' +
            ' data-ad-client="' + ADSENSE_CLIENT + '"' +
            ' data-ad-format="horizontal"' +
            ' data-full-width-responsive="true"' +
            (npa ? ' data-npa-on-unknown="1"' : '') +
            '></ins>';
        slot.hidden = false;
        try {
            applyNonPersonalizedAds(npa);
            root.adsbygoogle = root.adsbygoogle || [];
            root.adsbygoogle.push({});
        } catch (e) {}
    }

    function fillSlot(slot, decision, input, preferAdsense) {
        if (!slot) return;
        if (!fillAllowed(input) || fillsBlocked(input) || !decision || decision.show !== true) {
            clearSlot(slot);
            return;
        }
        var useAdsense = !!preferAdsense && adsenseAllowed(decision, input);
        if (decision.skipAads) {
            if (npaFallbackAllowed(decision, input)) fillAdsense(slot, input);
            else clearSlot(slot);
            return;
        }
        if (useAdsense) fillAdsense(slot, input);
        else fillAads(slot, input);
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
        var fb = adsFirebase();
        if (!db && fb && fb.firestore) {
            try { db = fb.firestore(); } catch (e) { db = null; }
        }
        if (!db || !fb || !fb.firestore || !fb.firestore.FieldValue) return Promise.resolve(false);
        var ref = db.collection('ads_holdout_stats').doc(day);
        var inc = fb.firestore.FieldValue.increment(1);
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
        if (pendingPrivacyReload) {
            hideAllSlots();
            if (flushDeferredPrivacyReload()) return { show: false, reason: 'privacy-reload' };
            return { show: false, reason: 'privacy-reload' };
        }
        if (fillsBlocked(input)) {
            hideAllSlots();
            var blocked = decide(input);
            if (blocked.show) {
                blocked = {
                    show: false,
                    reason: 'geo',
                    surface: blocked.surface,
                    experimentGroup: null,
                    assignmentId: blocked.assignmentId,
                    holdoutPct: blocked.holdoutPct,
                    bucket: blocked.bucket,
                    npa: false,
                    skipAads: false,
                    privacyOptOut: blocked.privacyOptOut,
                    geoBlocked: true,
                    country: blocked.country
                };
            }
            return blocked;
        }
        var decision = decide(input);
        recordDailyAggregate(decision, input && input.now, input && input.firestore);
        if (!decision.show) {
            hideAllSlots();
            return decision;
        }
        if (decision.surface === 'home') {
            fillSlot(ensureHomeSlot(), decision, input, false);
            var learn = typeof document !== 'undefined' ? document.getElementById('bqAdsenseLearn') : null;
            var arcade = typeof document !== 'undefined' ? document.getElementById('bqAdsenseArcade') : null;
            clearSlot(learn);
            clearSlot(arcade);
        } else if (decision.surface === 'learning-quests') {
            var hub = typeof document !== 'undefined' ? document.getElementById('lqHub') : null;
            var host = hub && (hub.querySelector('div') || hub);
            var learnSlot = ensureSurfaceSlot('bqAdsenseLearn', host);
            fillSlot(learnSlot, decision, input, true);
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
            fillSlot(arcadeSlot, decision, input, true);
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
            var fb = adsFirebase();
            if (fb && fb.auth) authObj = fb.auth();
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
            if (root) root._bqAdsAuthReady = true;
            // A later auth event must not blank a slot that was already
            // filled from a valid user doc for this same account.
            if (userDocLooksLoaded(freshUserDoc, uid)) {
                if (root) root._bqAdsUserUnknown = false;
                sync();
            } else {
                if (root) root._bqAdsUserUnknown = true;
                sync({ userUnknown: true });
            }
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

    function ensurePrivacyChoicesFooter() {
        if (typeof document === 'undefined' || !document.body) return;
        var el = document.getElementById('bqSitePrivacyFooter');
        if (!el) {
            el = document.createElement('p');
            el.id = 'bqSitePrivacyFooter';
            el.className = 'bq-site-privacy-footer';
            el.innerHTML = '<a href="#privacy-choices">Your Privacy Choices</a>';
            document.body.appendChild(el);
        }
        if (!el.getAttribute('data-bq-bound')) {
            el.setAttribute('data-bq-bound', '1');
            el.addEventListener('click', function (ev) {
                var a = ev.target && ev.target.closest ? ev.target.closest('a') : ev.target;
                if (!a) return;
                ev.preventDefault();
                try { sessionStorage.setItem('btc_open_privacy_choices', '1'); } catch (e) {}
                openPrivacyChoices();
            });
        }
    }

    function hookNavigation() {
        if (typeof window === 'undefined') return;
        hookAuth();
        ensurePrivacyChoicesFooter();
        watchPrivacySignals();
        flushDeferredPrivacyReload();
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
        lastSeenGpc = hasGpc();
        ensurePrivacyChoicesFooter();
        // Fail closed until /cdn-cgi/trace returns a country. No worker change.
        // Start the lookup before any fill; sync() itself also refuses fills
        // until the country is known.
        ensureGeo().then(function () { sync(); });
        sync();
        try { if (privacyChoicesOpenRequested()) openPrivacyChoices(); } catch (e) {}
        if (typeof setInterval === 'function') {
            setInterval(function () { hookNavigation(); watchPrivacySignals(); }, 2000);
        }
        if (typeof document !== 'undefined' && document.addEventListener && !root._bqAdsVisHook) {
            root._bqAdsVisHook = true;
            document.addEventListener('visibilitychange', function () { watchPrivacySignals(); });
        }
        if (typeof document !== 'undefined') {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function () {
                    hookNavigation();
                    ensureGeo().then(function () { sync(); });
                    sync();
                    try { if (privacyChoicesOpenRequested()) openPrivacyChoices(); } catch (e2) {}
                });
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
        boot: boot,
        OPT_OUT_KEY: OPT_OUT_KEY,
        TRACE_PATH: TRACE_PATH,
        CALLABLE_NAME: CALLABLE_NAME,
        ACCOUNT_OPTOUT_FIELD: ACCOUNT_OPTOUT_FIELD,
        RESTRICTED_COUNTRIES: RESTRICTED_COUNTRIES,
        eeaAdsEnabled: eeaAdsEnabled,
        isRestrictedCountry: isRestrictedCountry,
        hasGpc: hasGpc,
        isPrivacyShareOptedOut: isPrivacyShareOptedOut,
        setShareOptOut: setShareOptOut,
        applyPrivacyChoiceNow: applyPrivacyChoiceNow,
        watchPrivacySignals: watchPrivacySignals,
        parseTraceCountry: parseTraceCountry,
        readCountry: readCountry,
        isGeoBlocked: isGeoBlocked,
        fillsBlocked: fillsBlocked,
        ensureGeo: ensureGeo,
        adsenseScriptSrc: adsenseScriptSrc,
        applyNonPersonalizedAds: applyNonPersonalizedAds,
        shouldSkipAads: shouldSkipAads,
        openPrivacyChoices: openPrivacyChoices,
        privacyChoicesOpenRequested: privacyChoicesOpenRequested,
        updatePrivacyChoicesUi: updatePrivacyChoicesUi,
        ensurePrivacyChoicesFooter: ensurePrivacyChoicesFooter
    };

    // Console must not get fill/rememberCountry hooks (same class as
    // allowExplicitUser). Node tests with no document get them on the
    // public api. Browser-like tests opt in with BQ_ADS_TEST_EXPORTS,
    // which adds the hooks to module.exports only, never window.bqAds.
    if (typeof document === 'undefined') {
        api.rememberCountry = rememberCountry;
        api.fillAads = fillAads;
        api.fillAdsense = fillAdsense;
        api.fillSlot = fillSlot;
    }

    root.bqAds = api;
    if (typeof module !== 'undefined' && module.exports) {
        if (isNodeProcess() && root && root.BQ_ADS_TEST_EXPORTS && typeof document !== 'undefined') {
            module.exports = Object.assign({}, api, {
                rememberCountry: rememberCountry,
                fillAads: fillAads,
                fillAdsense: fillAdsense,
                fillSlot: fillSlot
            });
        } else {
            module.exports = api;
        }
    }
    if (!root.BQ_ADS_NO_BOOT) {
        if (typeof document !== 'undefined' && document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', boot);
        } else {
            try { boot(); } catch (e) {}
        }
    }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
