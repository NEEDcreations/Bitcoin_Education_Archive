// © 2024-2026 603BTC LLC. All rights reserved.
// This code is proprietary. See LICENSE file. Do not copy or redistribute.
// =============================================
// Bitcoin Education Archive - Ranking System
// =============================================

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDLwucmRxjoJp2KMBTi2ujf0mlVkgLHyKk",
    authDomain: "bitcoineducation.quest", // Must match app origin — auth iframe proxied via seo-router worker (/__/auth/*) so Safari ITP allows postMessage
    projectId: "bitcoin-education-archive",
    storageBucket: "bitcoin-education-archive.firebasestorage.app",
    messagingSenderId: "1055248200518",
    appId: "1:1055248200518:web:6c6d64a5ee78e19bfbeb47"
};

// Public reCAPTCHA v3 site key. The matching secret stays in the Firebase console.
var APP_CHECK_RECAPTCHA_SITE_KEY = '6Le37votAAAAAD3n0_u1uPxgcvm4XtmOEeK1Ti9j';
var LN_ADDRESS_LOCK_NOTICE = "You can only add one lightning address to your account, and it can't be changed later. If you ever need to change it, email support at info.603btc@gmail.com.";
var LN_ADDRESS_LOCKED_NOTICE = "You can only add one lightning address to your account, and it can't be changed later. If you ever need to change it, email support at info.603btc@gmail.com.";

function normalizeClientLn(addr) {
    var s = String(addr || '').trim().toLowerCase();
    if (s.indexOf('lightning:') === 0) s = s.slice('lightning:'.length).trim();
    if (s.indexOf('mailto:') === 0) s = s.slice('mailto:'.length).trim();
    return s;
}
function clientLnValid(addr) {
    return addr.length >= 5 && addr.length <= 320 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr);
}

// Levels
const LEVELS = [
    { name: 'Normie',         emoji: '🟢', min: 0 },
    { name: 'Curious',        emoji: '🔵', min: 10 },
    { name: 'Pleb',           emoji: '🟠', min: 144 },
    { name: 'Pleb II',        emoji: '🟠🟠', min: 170 },
    { name: 'Pleb III',       emoji: '🟠🟠🟠', min: 256 },
    { name: 'Stacker',        emoji: '📦', min: 500 },
    { name: 'Stacker II',     emoji: '📦📦', min: 1913 },
    { name: 'Stacker III',    emoji: '📦📦📦', min: 2016 },
    { name: 'Maxi',           emoji: '🔥', min: 2140 },
    { name: 'Maxi II',        emoji: '🔥🔥', min: 6102 },
    { name: 'Maxi III',       emoji: '🔥🔥🔥', min: 8888 },
    { name: 'Papa John',      emoji: '🍕', min: 10000 },
    { name: 'Full Node',      emoji: '🖥️', min: 18333 },
    { name: 'Whale',           emoji: '🐋', min: 50000 },
    { name: 'Sovereign',      emoji: '🏴', min: 100000 },
    { name: 'Cypherpunk',     emoji: '🔒', min: 133337 },
    { name: 'Satoshi',        emoji: '👑', min: 210000 },
];

// Client-side QR code generation (avoids leaking payment data to third-party APIs)
function _renderQRCode(container, data, size) {
    if (!container) return;
    if (window.qrcode && typeof window.qrcode === 'function') { _drawQR(container, data, size); return; }
    var script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
    script.integrity = 'sha384-mZT2gIty7ZDdOGkxfP6joZcYdMW1Jvj9dRlfpTmaJAKKXTqzygtB22k7FLe+KZC1';
    script.crossOrigin = 'anonymous';
    script.onload = function() { _drawQR(container, data, size); };
    script.onerror = function() {
        container.innerHTML = '<div style="word-break:break-all;font-size:0.6rem;max-width:' + size + 'px;padding:8px;">' +
            String(data).replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }) +
            '</div>';
    };
    document.head.appendChild(script);
}
function _drawQR(container, data, size) {
    try {
        var qr = qrcode(0, 'M'); qr.addData(data); qr.make();
        var img = document.createElement('img');
        img.src = qr.createDataURL(6, 4); img.width = size; img.height = size;
        img.alt = 'QR Code'; img.style.cssText = 'border-radius:8px;image-rendering:pixelated;';
        container.innerHTML = ''; container.appendChild(img);
    } catch(e) { container.innerHTML = '<div style="color:#ef4444;font-size:0.8rem;">QR generation failed</div>'; }
}
/** Sync data-URL helper when qrcode-generator is already loaded; otherwise returns null. */
function _localQRDataUrl(data) {
    try {
        if (!window.qrcode || typeof window.qrcode !== 'function') return null;
        var qr = qrcode(0, 'M'); qr.addData(data); qr.make();
        return qr.createDataURL(6, 4);
    } catch (e) { return null; }
}
window._renderQRCode = _renderQRCode;
window._localQRDataUrl = _localQRDataUrl;

function _normalizeUrl(url) {
    if (!url) return '#';
    url = url.trim();
    if (!url) return '#';
    // Already has a protocol
    if (/^https?:\/\//i.test(url)) return url;
    // Has a protocol-relative URL
    if (url.startsWith('//')) return 'https:' + url;
    // No protocol — prepend https://
    return 'https://' + url;
}

// Points config
const POINTS = {
    visit: 5,
    openChannel: 10,
    readTime: 15,       // per 30 seconds
    explore10: 50,      // 10+ channels in a session
    streak: 100,        // daily streak bonus
};

// TOS version — bump this string whenever Terms or Privacy Policy update significantly.
// Existing users who haven't accepted this version will see the acceptance modal on next load.
const TOS_CURRENT_VERSION = '2026-10-23';
window.TOS_CURRENT_VERSION = TOS_CURRENT_VERSION;

// One lifetime cap. The shared helper is 15,000 for every account.
// The old fallback of 10000 hid claimable sats for anyone past 10k withdrawn.
function lifetimeSatCap() {
    if (typeof getSatCap === 'function') return getSatCap();
    if (typeof window.SAT_LIFETIME_CAP === 'number') return window.SAT_LIFETIME_CAP;
    return 15000;
}
window.lifetimeSatCap = lifetimeSatCap;

function tosBlocking() {
    var m = document.getElementById('tosModal');
    return !!(m && m.classList.contains('open'));
}
window.tosBlocking = tosBlocking;

function chromeBlocksToasts() {
    if (tosBlocking()) return true;
    var signup = document.getElementById('usernameModal');
    if (signup && signup.classList.contains('open')) return true;
    return false;
}

window._deferUntilTos = window._deferUntilTos || [];
window.runAfterTos = function(fn) {
    if (typeof fn !== 'function') return;
    if (!tosBlocking()) { fn(); return; }
    window._deferUntilTos.push(fn);
};
function flushAfterTos() {
    var queued = window._deferUntilTos || [];
    window._deferUntilTos = [];
    queued.forEach(function(fn) { try { fn(); } catch (e) {} });
    if (!chromeBlocksToasts() && typeof _toastQueue !== 'undefined' && _toastQueue.length && typeof window._showToastNow === 'function') {
        window._showToastNow(_toastQueue.shift());
    }
}
window.flushAfterTos = flushAfterTos;

let db, auth, currentUser = null;
let signInAttempts = 0;
let signInLockout = 0;
let redirectResultResolved = false; // Track whether getRedirectResult has resolved
let redirectResultPromise = Promise.resolve(null); // Resolves when getRedirectResult completes
// Session timeout removed - users stay signed in via Firebase LOCAL persistence
let sessionChannels = new Set();
let readTimer = null;
let readSeconds = 0;
let lastReadAward = 0;
let rankingReady = false;
let allTimeChannels = new Set(); // tracks channels already awarded across all sessions
let lastLevelName = '';
let lastLevelMin = 0;
let levelUpReady = false; // Don't celebrate until initial load completes

// Initialize Firebase
function mfaSessionKey(uid) {
    return 'btc_mfa_session_' + uid;
}

function mfaDeviceKey(uid) {
    return 'btc_mfa_device_' + uid;
}

function mfaErrorCode(err) {
    var code = String((err && (err.code || err.status)) || '').toLowerCase();
    var slash = code.lastIndexOf('/');
    if (slash !== -1) code = code.slice(slash + 1);
    return code;
}

function mfaIsTransientError(err) {
    var code = mfaErrorCode(err);
    return code === 'unavailable' || code === 'deadline-exceeded' || code === 'internal' || code === 'aborted' || code === 'cancelled';
}

function mfaAllowsAfterStatusError(totpEnabled) {
    return !totpEnabled;
}

function mfaRetryOnce(run, sleep) {
    var pause = typeof sleep === 'function' ? sleep : function () {
        return new Promise(function (resolve) { setTimeout(resolve, 700); });
    };
    return Promise.resolve().then(run).catch(function (err) {
        if (!mfaIsTransientError(err)) throw err;
        return Promise.resolve(pause(700)).then(run);
    });
}

window._mfaSessionId = function () {
    try {
        if (typeof auth === 'undefined' || !auth || !auth.currentUser) return '';
        return localStorage.getItem(mfaSessionKey(auth.currentUser.uid)) || '';
    } catch (e) { return ''; }
};

window._rememberMfaSession = function (uid, sessionId) {
    try {
        if (uid && sessionId) localStorage.setItem(mfaSessionKey(uid), sessionId);
        if (uid) localStorage.removeItem('btc_totp_verified_' + uid);
    } catch (e) {}
};

window._rememberMfaDevice = function (uid, token) {
    try {
        if (uid && /^[0-9a-f]{64}$/.test(token || '')) localStorage.setItem(mfaDeviceKey(uid), token);
    } catch (e) {}
};

function mfaClearDevice(uid) {
    try {
        if (uid) localStorage.removeItem(mfaDeviceKey(uid));
    } catch (e) {}
}

function installMfaCallablePatch() {
    if (typeof firebase === 'undefined' || !firebase.functions || window._mfaCallablePatched) return;
    var probe;
    try { probe = firebase.functions(); } catch (e) { return; }
    var proto = Object.getPrototypeOf(probe);
    if (!proto || typeof proto.httpsCallable !== 'function' || proto.httpsCallable._mfaPatched) return;
    var orig = proto.httpsCallable;
    function wrapped(name, options) {
        var callable = orig.call(this, name, options);
        return function (data) {
            var payload = data;
            if (payload == null) payload = {};
            if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
                var sid = window._mfaSessionId ? window._mfaSessionId() : '';
                if (sid && payload.mfaSessionId == null) payload.mfaSessionId = sid;
            }
            return callable(payload);
        };
    }
    wrapped._mfaPatched = true;
    proto.httpsCallable = wrapped;
    window._mfaCallablePatched = true;
}

function _mfaFailure(e) {
    var code = (e && e.code) || '';
    var msg = (e && e.message) || '';
    if (code.indexOf('resource-exhausted') !== -1 || msg.indexOf('Too many attempts') !== -1) {
        if (msg.indexOf('tomorrow') !== -1) return 'Too many attempts. Try again tomorrow.';
        return 'Too many attempts. Wait 2 minutes.';
    }
    if (msg.indexOf('already used') !== -1) return 'That code was already used. Wait for the next one.';
    if (msg.indexOf('Authenticator session required') !== -1) return 'Enter your authenticator code first.';
    if (msg.indexOf('phone verification') !== -1) return 'Sign out and sign back in so your phone verification applies.';
    if (msg.indexOf('Invalid recovery code') !== -1) return 'That recovery code is not valid.';
    if (msg.indexOf('fresh authenticator') !== -1) return 'Enter a fresh authenticator code. A remembered device is not enough.';
    if (msg.indexOf('Device is not trusted') !== -1) return 'This device is not remembered. Enter your authenticator code.';
    if (msg.indexOf('Invalid code') !== -1) return 'That code is not valid.';
    if (msg.indexOf('unavailable') !== -1) return 'Authenticator setup is unavailable right now.';
    return msg || 'Something went wrong.';
}

function _isMfaBlock(e) {
    var msg = (e && e.message) || '';
    return msg.indexOf('Authenticator session required') !== -1 || msg.indexOf('phone verification') !== -1;
}

window._serverTotpAllows = async function (uid) {
    if (!uid || typeof firebase === 'undefined' || !firebase.functions) return true;
    var sessionId = '';
    try { sessionId = localStorage.getItem(mfaSessionKey(uid)) || ''; } catch (e1) {}
    var statusFn = firebase.functions().httpsCallable('totpStatus');
    var data;
    try {
        var result = await mfaRetryOnce(function () { return statusFn({ sessionId: sessionId }); });
        data = (result && result.data) || {};
    } catch (e) {
        var totpOn = typeof currentUser !== 'undefined' && currentUser && currentUser.totpEnabled;
        return mfaAllowsAfterStatusError(totpOn);
    }
    window._mfaStatus = data;
    if (!data.enabled || data.sessionVerified) {
        if (data.needsRecoveryCodes) window._maybeOfferRecoveryCodes();
        return true;
    }
    var deviceToken = '';
    try { deviceToken = localStorage.getItem(mfaDeviceKey(uid)) || ''; } catch (e2) {}
    if (!/^[0-9a-f]{64}$/.test(deviceToken)) return false;
    var resumeFn = firebase.functions().httpsCallable('totpResumeDevice');
    try {
        var resumed = await mfaRetryOnce(function () { return resumeFn({ deviceToken: deviceToken }); });
        var body = (resumed && resumed.data) || {};
        if (body.sessionId) {
            window._rememberMfaSession(uid, body.sessionId);
            window._mfaStatus.sessionVerified = true;
            if (data.needsRecoveryCodes) window._maybeOfferRecoveryCodes();
            return true;
        }
        return false;
    } catch (e3) {
        var resumeCode = mfaErrorCode(e3);
        if (!mfaIsTransientError(e3) && resumeCode !== 'resource-exhausted') mfaClearDevice(uid);
        return mfaAllowsAfterStatusError(true);
    }
};

window._maybeOfferRecoveryCodes = async function () {
    if (window._recoveryOfferStarted) return;
    var status = window._mfaStatus || {};
    if (!status.needsRecoveryCodes) return;
    if (!status.sessionVerified && !status.phoneEnabled) return;
    window._recoveryOfferStarted = true;
    try {
        var fn = firebase.functions().httpsCallable('issueRecoveryCodes');
        var res = await fn({});
        if (res && res.data && res.data.recoveryCodes) window._showRecoveryCodes(res.data.recoveryCodes);
        else window._recoveryOfferStarted = false;
    } catch (e) {
        window._recoveryOfferStarted = false;
    }
};

function _resumeAfterSecondFactor() {
    if (window._pendingGuestLink && typeof tryLinkGuest === 'function') {
        window._pendingGuestLink = false;
        tryLinkGuest();
    }
    if (window._pendingAnonBadges && window._pendingAnonBadges.length && typeof firebase !== 'undefined') {
        var badges = window._pendingAnonBadges;
        window._pendingAnonBadges = null;
        try {
            firebase.functions().httpsCallable('mergeAnonBadges')({ anonBadges: badges }).catch(function () {});
        } catch (e) {}
    }
}

function initRanking() {
    try {
        firebase.initializeApp(FIREBASE_CONFIG);

        // App Check for claimSats. One activation per page, before any claim.
        // Storage stays unenforced. SMS 2FA on Safari still uses TOTP.
        // reCAPTCHA v3. Token TTL is 1 hour in the Firebase console.
        if (!window._btcAppCheckReady) {
            try {
                firebase.appCheck().activate(APP_CHECK_RECAPTCHA_SITE_KEY, true);
                window._btcAppCheckReady = true;
            } catch (appCheckErr) {
                console.warn('App Check init failed', appCheckErr);
            }
        }

        db = firebase.firestore();
        // Enable offline persistence - data survives connection loss
        // Offline persistence disabled — IndexedDB multi-tab lock was stalling all Firestore reads
        auth = firebase.auth();
        // Ensure auth persists across refreshes, tab closes, and app restarts
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function() {});
        installMfaCallablePatch();

        // Check if returning from email magic link
        if (auth.isSignInWithEmailLink(window.location.href)) {
            handleEmailSignIn();
            // Still set up auth listener for future state changes
        }

        // Check if returning from provider redirect (in-app browser flow)
        // Check if returning from provider redirect (in-app browser flow)
        // IMPORTANT: must resolve before we allow anonymous sign-in to avoid
        // clobbering the redirect auth state on mobile.
        // No timeout — auth iframe is same-origin via CF Worker proxy so Safari ITP no longer blocks it.
        redirectResultPromise = auth.getRedirectResult().then(async function(result) {
            redirectResultResolved = true;
            console.log('[Auth] getRedirectResult:', result ? (result.user ? result.user.uid : 'no user') : 'null');
            if (!result || !result.user) return null;
            const user = result.user;
            // Mark that we came from a redirect - prevent anonymous sign-in from overwriting
            sessionStorage.setItem('btc_redirect_auth', '1');
            const existingDoc = await db.collection('users').doc(user.uid).get();

            // Recover anonymous data from before redirect
            const anonUid = localStorage.getItem('btc_anon_uid');
            let anonData = null;
            try { anonData = JSON.parse(localStorage.getItem('btc_anon_data')); } catch(e) {}
            localStorage.removeItem('btc_anon_uid');
            localStorage.removeItem('btc_anon_data');

            var guestHold = false;
            if (!existingDoc.exists) {
                var _redirExtra = {};
                await db.collection('users').doc(user.uid).set(clientCreatePayload(_redirExtra));
                var _redirName = localStorage.getItem('btc_pending_username') || '';
                if (_redirName) {
                    try { await applyServerUsername(_redirName); }
                    catch (nameErr) { if (typeof showUsernamePrompt === 'function') setTimeout(showUsernamePrompt, 400); }
                } else if (typeof showUsernamePrompt === 'function') {
                    setTimeout(showUsernamePrompt, 400);
                }
                try { db.collection('stats').doc('global').set({ userCount: firebase.firestore.FieldValue.increment(1) }, { merge: true }).catch(function() {}); } catch(e) {}
                if (typeof attachReferral === 'function') attachReferral(user.uid);
            } else if (anonData) {
                const existData = existingDoc.data();
                // Anti-abuse: only merge anonymous data once per account
                // Anonymous data merge now handled minimally (points/visits are server-managed)
                if (!existData.mergedAnon && !existData.anonBadgesMerged) {
                    if (typeof tryLinkGuest === 'function') {
                        try { if (await tryLinkGuest() === 'mfa') guestHold = true; } catch (e) {}
                    }
                    // Anonymous badges live in localStorage. mergeAnonBadges
                    // recomputes from server counters and sets mergedAnon.
                    // The client cannot write that flag.
                    var _anonBadges = [];
                    try { _anonBadges = JSON.parse(localStorage.getItem('btc_badges') || '[]'); } catch(e) {}
                    try {
                        var _mergeAnonBadgesFn = firebase.functions().httpsCallable('mergeAnonBadges');
                        await _mergeAnonBadgesFn({ anonBadges: _anonBadges, anonUid: anonUid || '' });
                        console.log('[Auth] Merged anon progress into account');
                    } catch(e) {
                        if (_isMfaBlock(e)) window._pendingAnonBadges = _anonBadges;
                        else console.warn('[Auth] mergeAnonBadges failed (non-fatal):', e.message);
                    }
                }
            }

            if (!guestHold && typeof tryLinkGuest === 'function') {
                try { if (await tryLinkGuest() === 'mfa') guestHold = true; } catch (e) {}
            }
            // Clean up old anonymous doc once the merge is not waiting on 2FA.
            if (anonUid && anonUid !== user.uid && !guestHold) {
                try { await db.collection('users').doc(anonUid).delete(); } catch(e) {}
            }

            loadUser(user.uid);
            updateAuthButton();
            if (typeof hideUsernamePrompt === 'function') hideUsernamePrompt();
            showToast('You are signed in.');
            if (anonUid && anonUid !== user.uid) {
                setTimeout(function() {
                    if (typeof awardPoints === 'function') awardPoints(50, '\u2705 Saved your progress!', null, null, null, 'first_save');
                }, 1500);
            }
            return user;
        }).catch(function(e) {
            redirectResultResolved = true;
            // MFA required after redirect - already handled by direct catch above
            if (e.code === 'auth/multi-factor-auth-required') {
                console.log('[Auth] MFA required after redirect (race catch — skipping, direct catch handles it)');
                return null; // do NOT call _showMFASignInChallenge again
            }
            if ((e.code === 'auth/credential-already-in-use' || e.code === 'auth/email-already-in-use') && e.credential) {
                var fallbackAnon = localStorage.getItem('btc_anon_uid');
                auth.signInWithCredential(e.credential).then(function(signed) {
                    return _handleSignInResultGlobal(signed.user, fallbackAnon, null);
                }).catch(function(err) {
                    if (surfaceMfaRequired(err)) return;
                    console.log('Redirect link fallback failed:', err && err.code);
                });
                return null;
            }
            if (e.code !== 'auth/popup-closed-by-user') {
                console.log('Redirect result error:', e);
            }
            return null;
        });

        // Wait for auth to fully resolve before doing anything
        // This prevents the race condition where anonymous user loads before Google auth restores
        let firstAuthEvent = true;
        let emailLinkHandled = auth.isSignInWithEmailLink(window.location.href);
        // Detect if we're returning from a social login redirect
        var _pwaAuthPending = localStorage.getItem('btc_pwa_auth_pending');
        var _pendingRedirect = !!localStorage.getItem('btc_anon_uid') || sessionStorage.getItem('btc_redirect_pending') === '1' || !!_pwaAuthPending;
        if (_pwaAuthPending) { localStorage.removeItem('btc_pwa_auth_pending'); console.log('[Auth] PWA auth pending detected'); }
        if (_pendingRedirect) console.log('[Auth] Detected pending redirect return');

        auth.onAuthStateChanged(user => {
            console.log('[Auth] onAuthStateChanged:', user ? (user.isAnonymous ? 'anon:' + user.uid : 'real:' + user.uid) : 'null', 'firstEvent:', firstAuthEvent, 'pendingRedirect:', _pendingRedirect);
            // Detect account switch: if a real user signs in and it's a different UID, clear old data
            if (user && !user.isAnonymous) {
                var prevUid = localStorage.getItem('btc_last_auth_uid');
                if (prevUid && prevUid !== user.uid) {
                    console.log('[Auth] Account switch detected:', prevUid, '->', user.uid, '- clearing localStorage');
                    clearUserLocalStorage({ keepGuest: !!localStorage.getItem('btc_guest_link') });
                }
                localStorage.setItem('btc_last_auth_uid', user.uid);
                // Sync experienceMode from Firestore (cross-device continuity)
                if (typeof window.syncExperienceModeFromFirestore === 'function') {
                    window.syncExperienceModeFromFirestore();
                }
            }
            if (firstAuthEvent) {
                firstAuthEvent = false;
                // If email link sign-in is being handled, skip - handleEmailSignIn manages it
                if (emailLinkHandled) return;
                if (user && !user.isAnonymous) {
                    // Real user restored immediately
                    console.log('[Auth] Real user on first event:', user.uid);
                    sessionStorage.removeItem('btc_redirect_auth');
                    // Load from localStorage cache INSTANTLY, then refresh from Firestore in background
                    var _cachedProfile = null;
                    try {
                        var _cp = JSON.parse(localStorage.getItem('btc_profile_cache') || 'null');
                        if (_cp && _cp.uid === user.uid && (Date.now() - _cp.ts) < 86400000) _cachedProfile = _cp;
                    } catch(e) {}
                    if (_cachedProfile && _cachedProfile.data && _cachedProfile.data.totpEnabled) {
                        loadUser(user.uid).catch(function(){});
                    } else if (_cachedProfile) {
                        // Instant render from cache
                        currentUser = { uid: user.uid, ..._cachedProfile.data };
                        window._myPeers = new Set(currentUser.peers || []);
                        rankingReady = true;
                        window._badgesReady = true;
                        if (typeof markVisibleBadgesReady === 'function') markVisibleBadgesReady();
                        window._hiddenBadgesReady = true;
                        restoreVisitedUI();
                        updateRankUI();
                        updateAuthButton();
                        if (typeof renderProgressRings === 'function') renderProgressRings();
                        // Refresh from Firestore in background (non-blocking)
                        setTimeout(function() { loadUser(user.uid).catch(function(){}); }, 500);
                    } else {
                        loadUser(user.uid).catch(function(){});
                    }
                } else if (user && user.isAnonymous) {
                    if (typeof stashGuestLink === 'function') stashGuestLink();
                    // If we're pending a redirect, DON'T load anon yet - wait longer for auth to resolve
                    if (_pendingRedirect) {
                        console.log('[Auth] Anon user but pending redirect - waiting 8s for real auth...');
                        // Give Firebase extra time to restore the redirect session
                        // (mobile redirects can be slow due to cross-origin ITP/partitioning)
                        var _redirectTimeout = setTimeout(function() {
                            // Check one more time if a real user appeared
                            if (auth.currentUser && !auth.currentUser.isAnonymous) {
                                console.log('[Auth] Real user appeared after wait:', auth.currentUser.uid);
                                loadUser(auth.currentUser.uid);
                            } else {
                                console.log('[Auth] No real user after 8s - loading anon');
                                loadUserLocal(user.uid);
                            }
                            localStorage.removeItem('btc_anon_uid');
                            localStorage.removeItem('btc_anon_data');
                            localStorage.removeItem('btc_pwa_auth_pending');
                            sessionStorage.removeItem('btc_redirect_pending');
                        }, 8000);
                        // But if getRedirectResult resolves with a user, use that immediately
                        redirectResultPromise.then(function(redirectUser) {
                            if (redirectUser) { clearTimeout(_redirectTimeout); return; }
                        });
                    } else {
                        loadUserLocal(user.uid);
                    }
                } else {
                    // null user - WAIT for getRedirectResult before signing in anonymously
                    // Otherwise we clobber the redirect auth state on mobile
                    if (redirectResultResolved && !_pendingRedirect) {
                        // Redirect already resolved (no redirect happened) - safe to go anonymous
                        auth.signInAnonymously().then(() => {});
                    } else {
                        // Wait for redirect result to resolve first, with extra timeout for mobile
                        var _nullUserTimeout = setTimeout(function() {
                            // After 10s if still no user, go anonymous
                            if (!auth.currentUser) {
                                console.log('[Auth] 10s timeout with no user - going anonymous');
                                localStorage.removeItem('btc_pwa_auth_pending');
                                auth.signInAnonymously().then(() => {});
                            }
                        }, 10000);
                        redirectResultPromise.then(function(redirectUser) {
                            clearTimeout(_nullUserTimeout);
                            // If redirect gave us a real user, onAuthStateChanged already fired for them
                            if (!redirectUser && !auth.currentUser) {
                                auth.signInAnonymously().then(() => {});
                            }
                        });
                    }
                }
                return;
            }
            // Subsequent auth changes (sign in, sign out, etc.)
            if (user) {
                if (currentUser && currentUser.uid === user.uid) {
                    updateAuthButton();
                    return;
                }
                if (user.isAnonymous) {
                    if (typeof stashGuestLink === 'function') stashGuestLink();
                    loadUserLocal(user.uid);
                } else {
                    loadUser(user.uid);
                }
            } else {
                currentUser = null;
                // Only sign in anonymously if redirect has already resolved
                if (redirectResultResolved) {
                    auth.signInAnonymously().then(() => {});
                } else {
                    redirectResultPromise.then(function(redirectUser) {
                        if (!redirectUser && !auth.currentUser) {
                            auth.signInAnonymously().then(() => {});
                        }
                    });
                }
            }
        });
    } catch(e) {
        console.error('Ranking init error:', e);
        // Show visible error for debugging
        setTimeout(function() { if (typeof showToast === 'function') showToast('⚠️ Init error: ' + (e.message || e)); }, 2000);
    }
}

// Handle email magic link return
async function handleEmailSignIn() {
    // Save the full URL before any modifications - needed for signInWithEmailLink
    var _signInUrl = window.location.href;

    // Try to get email from: 1) URL param (works cross-device), 2) localStorage (same device), 3) prompt (last resort)
    let email = null;
    // Check URL parameter first - this is embedded in the magic link
    var urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('signin_email')) {
        email = decodeURIComponent(urlParams.get('signin_email'));
    }
    // Fallback to localStorage (same device/browser)
    if (!email) {
        email = localStorage.getItem('btc_signin_email');
    }
    // Last resort: show a friendly inline prompt (cross-device scenario)
    if (!email) {
        return new Promise(function(resolve) {
            var ov = document.createElement('div');
            ov.id = 'emailConfirmOverlay';
            ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:20px;';
            ov.innerHTML = '<div style="background:var(--card-bg,#1a1a2e);border:1px solid var(--border,#333);border-radius:16px;padding:28px;max-width:380px;width:100%;text-align:center;">' +
                '<div style="font-size:2rem;margin-bottom:12px;">📧</div>' +
                '<div style="font-size:1.1rem;font-weight:800;color:var(--heading,#fff);margin-bottom:8px;">Confirm Your Email</div>' +
                '<div style="font-size:0.85rem;color:var(--text-muted,#999);margin-bottom:20px;line-height:1.5;">It looks like you opened this link on a different device. Enter the email you used to sign up:</div>' +
                '<input id="crossDeviceEmail" type="email" placeholder="your@email.com" style="width:100%;padding:14px;background:var(--input-bg,#111);border:1px solid var(--border,#333);border-radius:10px;color:var(--text,#fff);font-size:1rem;text-align:center;font-family:inherit;box-sizing:border-box;margin-bottom:12px;" autofocus>' +
                '<button id="crossDeviceSubmit" style="width:100%;padding:14px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;">Sign In</button>' +
                '<div onclick="this.closest(\'#emailConfirmOverlay\').remove()" style="margin-top:12px;font-size:0.8rem;color:var(--text-faint,#666);cursor:pointer;">Cancel</div>' +
            '</div>';
            document.body.appendChild(ov);
            var inp = document.getElementById('crossDeviceEmail');
            var btn = document.getElementById('crossDeviceSubmit');
            function submit() {
                var val = inp.value.trim().toLowerCase();
                if (!val || !val.includes('@')) { if (typeof showToast === 'function') showToast('Please enter a valid email'); return; }
                ov.remove();
                email = val;
                resolve(finishEmailSignIn(email, _signInUrl));
            }
            btn.onclick = submit;
            inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') submit(); });
            setTimeout(function() { inp.focus(); }, 100);
        });
    }
    return finishEmailSignIn(email, _signInUrl);
}

function planEmailLinkFailure(code, hasCredential) {
    if (code === 'auth/multi-factor-auth-required') return 'mfa';
    if ((code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') && hasCredential) return 'credential';
    if (code === 'auth/email-already-in-use' || code === 'auth/credential-already-in-use' || code === 'auth/provider-already-linked') return 'email-link';
    return 'throw';
}

function planEmailSignInFailure(code) {
    if (code === 'auth/multi-factor-auth-required') return 'mfa';
    if (code === 'auth/invalid-action-code' || code === 'auth/expired-action-code') return 'resend';
    return 'toast';
}

function guestLinkShouldDrop(error) {
    return error === 'expired' || error === 'one_guest' || error === 'guest_too_old' || error === 'already_linked' || error === 'bad_nonce';
}

function shouldSkipInPlaceLink(flagEmail, email) {
    var flag = String(flagEmail || '').trim().toLowerCase();
    var current = String(email || '').trim().toLowerCase();
    return flag.length > 0 && flag === current;
}

function guestLinkIsMfaHold(message) {
    var msg = String(message || '');
    return msg.indexOf('Authenticator session required') !== -1 || msg.indexOf('phone verification') !== -1;
}

// ACCOUNT_LINK_PLAN_START
function listSignInMethodLabels(user, profile) {
    var labels = [];
    var seen = {};
    function add(label) {
        if (!label || seen[label]) return;
        seen[label] = true;
        labels.push(label);
    }
    var map = {
        'password': 'Email',
        'google.com': 'Google',
        'twitter.com': 'Twitter/X',
        'github.com': 'GitHub',
        'facebook.com': 'Facebook',
        'phone': 'Phone'
    };
    var providers = (user && user.providerData) || [];
    var i;
    for (i = 0; i < providers.length; i++) {
        var pid = providers[i] && providers[i].providerId;
        if (!pid || pid === 'anonymous' || pid === 'custom') continue;
        add(map[pid] || pid);
    }
    var uid = String((user && user.uid) || '');
    var authMethod = profile && profile.authMethod;
    if (uid.indexOf('ln:') === 0 || authMethod === 'lightning') add('Lightning');
    if (user && user.isAnonymous && labels.length === 0) add('Guest');
    if (!labels.length) add('Guest');
    return labels;
}

function hasLinkedProvider(user) {
    var providers = (user && user.providerData) || [];
    var i;
    for (i = 0; i < providers.length; i++) {
        var pid = providers[i] && providers[i].providerId;
        if (pid && pid !== 'anonymous' && pid !== 'custom') return true;
    }
    return false;
}

function isLightningOnlyAccount(user, profile) {
    if (!user || user.isAnonymous) return false;
    var uid = String(user.uid || '');
    var authMethod = profile && profile.authMethod;
    if (uid.indexOf('ln:') !== 0 || authMethod !== 'lightning') return false;
    return !hasLinkedProvider(user);
}

function accountCanLinkSignIn(user, profile) {
    if (!user) return false;
    if (user.isAnonymous) return !hasLinkedProvider(user);
    return isLightningOnlyAccount(user, profile);
}

function linkedProviderIds(user) {
    var ids = [];
    var providers = (user && user.providerData) || [];
    var i;
    for (i = 0; i < providers.length; i++) {
        var pid = providers[i] && providers[i].providerId;
        if (pid && pid !== 'anonymous' && pid !== 'custom' && pid !== 'phone') ids.push(pid);
    }
    return ids;
}

function signOutWarningForAccount(user, profile) {
    if (!user) return null;
    if (user.isAnonymous) {
        if (hasLinkedProvider(user)) return null;
        return { kind: 'guest', message: "You'll lose this account unless you link a sign-in first." };
    }
    if (isLightningOnlyAccount(user, profile)) {
        return { kind: 'lightning', message: "To sign back in you'll need the same Lightning wallet. Link an email or Google first to make it easier." };
    }
    return null;
}

function accountLinkConflictMessage(code) {
    if (code === 'auth/provider-already-linked') return 'That sign-in is already on this account.';
    if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use' || code === 'auth/account-exists-with-different-credential') {
        return 'That sign-in already belongs to another account. Sign in there instead. We did not combine the two accounts. That sign-in belongs to another account; delete that account first if it\'s yours.';
    }
    return '';
}

function accountLinkEscape(value) {
    var text = String(value == null ? '' : value);
    if (typeof escapeHtml === 'function') return escapeHtml(text);
    return text.replace(/[&<>"']/g, function(ch) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
}

var ACCOUNT_LINK_MAX_AGE_MS = 60 * 60 * 1000;

function accountLinkIntentFresh(intent, now) {
    if (!intent || intent.kind !== 'email' || !intent.uid || !intent.email) return false;
    var at = Number(intent.at);
    var clock = Number(now);
    if (!isFinite(at) || !isFinite(clock)) return false;
    return clock >= at && (clock - at) <= ACCOUNT_LINK_MAX_AGE_MS;
}

function accountLinkTotpPending() {
    try {
        return !!(document.getElementById('totpSignInOverlay'));
    } catch (e) {
        return false;
    }
}

function accountLinkTotpHoldMessage() {
    return 'Finish the authenticator check before linking a sign-in.';
}

function renderSignInMethodsCard(user, profile) {
    var methods = listSignInMethodLabels(user, profile);
    var canLink = accountCanLinkSignIn(user, profile);
    var totpHold = accountLinkTotpPending();
    var html = '<div id="signInMethodsCard" style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;text-align:left;">';
    html += '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Sign-in methods</div>';
    html += '<div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:10px;line-height:1.45;">';
    if (canLink && user && user.isAnonymous) {
        html += 'This is a guest account on this browser. Link an email or Google so you can get back in.';
    } else if (canLink) {
        html += 'This account signs in with Lightning only. Link an email or Google so you can get back in without that wallet.';
    } else {
        html += 'Ways you can sign back in to this account.';
    }
    html += '</div>';
    html += '<div id="signInMethodList" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">';
    methods.forEach(function(label) {
        html += '<span style="padding:4px 10px;border-radius:999px;border:1px solid var(--border);color:var(--text);font-size:0.8rem;font-weight:700;">' + accountLinkEscape(label) + '</span>';
    });
    html += '</div>';
    if (canLink && totpHold) {
        html += '<div style="color:var(--text-muted);font-size:0.8rem;line-height:1.45;">' + accountLinkEscape(accountLinkTotpHoldMessage()) + '</div>';
    } else if (canLink) {
        if (methods.indexOf('Email') === -1) {
            html += '<div style="margin-bottom:10px;">' +
                '<div style="color:var(--text-muted);font-size:0.75rem;margin-bottom:6px;">Link email</div>' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">' +
                '<input id="accountLinkEmail" type="email" autocomplete="email" placeholder="you@example.com" maxlength="100" style="flex:1;min-width:140px;padding:10px 12px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:16px;font-family:inherit;outline:none;box-sizing:border-box;margin:0;text-align:left;">' +
                '<button type="button" onclick="sendAccountLinkEmail()" style="width:auto;padding:10px 14px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.85rem;">Link email</button>' +
                '</div>' +
                '<div id="accountLinkEmailStatus" style="font-size:0.75rem;color:var(--text-muted);margin-top:6px;"></div>' +
                '</div>';
        }
        if (methods.indexOf('Google') === -1) {
            html += '<div id="accountLinkGoogleWrap">' +
                '<div style="color:var(--text-muted);font-size:0.75rem;margin-bottom:6px;">Link Google</div>' +
                '<div id="accountGsiButtonHost" style="min-height:40px;"></div>' +
                '<button type="button" id="accountGoogleLinkFallback" onclick="linkGoogleFromAccount()" style="width:100%;padding:10px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">Link Google</button>' +
                '</div>';
        }
    } else if (user && !user.isAnonymous) {
        if (totpHold) {
            html += '<div style="color:var(--text-muted);font-size:0.8rem;line-height:1.45;">' + accountLinkEscape(accountLinkTotpHoldMessage()) + '</div>';
        } else {
            var linkedIds = linkedProviderIds(user);
            var addable = [
                { id: 'password', label: 'Email' },
                { id: 'google.com', label: 'Google' },
                { id: 'twitter.com', label: 'X' },
                { id: 'github.com', label: 'GitHub' }
            ];
            html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
            addable.forEach(function(item) {
                if (linkedIds.indexOf(item.id) !== -1) return;
                html += '<button type="button" onclick="linkFullAccountProvider(\'' + item.id + '\')" style="padding:8px 12px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;">Add ' + accountLinkEscape(item.label) + '</button>';
            });
            if (linkedIds.length > 1) {
                linkedIds.forEach(function(pid) {
                    if (pid === 'phone') return;
                    var label = ({ 'password': 'Email', 'google.com': 'Google', 'twitter.com': 'X', 'github.com': 'GitHub', 'facebook.com': 'Facebook' })[pid] || pid;
                    html += '<button type="button" onclick="unlinkFullAccountProvider(\'' + pid + '\')" style="padding:8px 12px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;">Remove ' + accountLinkEscape(label) + '</button>';
                });
            }
            html += '</div>';
        }
    }
    html += '</div>';
    return html;
}
// ACCOUNT_LINK_PLAN_END

function maskEmailAddress(email) {
    var value = String(email || '').trim();
    var at = value.indexOf('@');
    if (at < 1) return '';
    var local = value.slice(0, at);
    var domain = value.slice(at);
    var head = local.charAt(0);
    return head + '***' + domain;
}

function oauthOwnsEmail(user) {
    var ids = linkedProviderIds(user);
    var oauth = ids.indexOf('google.com') !== -1 || ids.indexOf('twitter.com') !== -1 || ids.indexOf('github.com') !== -1 || ids.indexOf('facebook.com') !== -1;
    return oauth && ids.indexOf('password') === -1;
}

function accountEmailAction(user) {
    if (!user || user.isAnonymous) return 'none';
    if (oauthOwnsEmail(user)) return 'provider';
    if (!user.email) return 'add';
    return 'change';
}

async function syncAccountEmailFromAuth() {
    var user = auth && auth.currentUser;
    if (!user || user.isAnonymous || typeof firebase === 'undefined' || !firebase.functions) return null;
    var res = await firebase.functions().httpsCallable('syncEmailChange')({});
    var data = res && res.data ? res.data : {};
    if (data.hold === true) {
        var until = Number(data.holdUntil) || 0;
        if (until > Date.now()) window._satsHoldUntil = until;
    }
    if (data.notice && typeof showToast === 'function') showToast(data.notice, 8000);
    return data;
}

window.reauthForSensitiveAction = async function(purpose) {
    var user = auth && auth.currentUser;
    if (!user) {
        if (typeof showToast === 'function') showToast('Sign in again, then try this.');
        return false;
    }
    try {
        var token = await user.getIdTokenResult();
        var authTime = token && token.claims ? Number(token.claims.auth_time) : NaN;
        var age = Math.floor(Date.now() / 1000) - authTime;
        if (isFinite(age) && age >= 0 && age <= 300) return true;
    } catch (e) {}
    return window.showReauthStep(user, purpose);
};

window.showReauthStep = function(user, purpose) {
    return new Promise(function(resolve) {
        var existing = document.getElementById('reauthOverlay');
        if (existing) existing.remove();
        var overlay = document.createElement('div');
        overlay.id = 'reauthOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:490000;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;padding:20px;';
        var ids = linkedProviderIds(user);
        var uid = String((user && user.uid) || '');
        var buttons = '';
        if (ids.indexOf('google.com') !== -1) buttons += '<button type="button" id="reauthGoogle" style="width:100%;margin-bottom:8px;padding:12px;border-radius:10px;border:1px solid var(--border);background:var(--card-bg);color:var(--text);font-weight:700;cursor:pointer;font-family:inherit;">Continue with Google</button>';
        if (ids.indexOf('twitter.com') !== -1) buttons += '<button type="button" id="reauthX" style="width:100%;margin-bottom:8px;padding:12px;border-radius:10px;border:1px solid var(--border);background:var(--card-bg);color:var(--text);font-weight:700;cursor:pointer;font-family:inherit;">Continue with X</button>';
        if (ids.indexOf('github.com') !== -1) buttons += '<button type="button" id="reauthGitHub" style="width:100%;margin-bottom:8px;padding:12px;border-radius:10px;border:1px solid var(--border);background:var(--card-bg);color:var(--text);font-weight:700;cursor:pointer;font-family:inherit;">Continue with GitHub</button>';
        if (ids.indexOf('facebook.com') !== -1) buttons += '<button type="button" id="reauthFacebook" style="width:100%;margin-bottom:8px;padding:12px;border-radius:10px;border:1px solid var(--border);background:var(--card-bg);color:var(--text);font-weight:700;cursor:pointer;font-family:inherit;">Continue with Facebook</button>';
        if (ids.indexOf('password') !== -1) {
            buttons += '<label for="reauthPassword" style="display:block;font-size:0.75rem;color:var(--text-faint);margin:8px 0 6px;">Password</label>';
            buttons += '<input id="reauthPassword" type="password" autocomplete="current-password" style="width:100%;padding:12px;margin-bottom:8px;box-sizing:border-box;border-radius:10px;border:1px solid var(--border);background:var(--input-bg);color:var(--text);font-family:inherit;">';
            buttons += '<button type="button" id="reauthPasswordBtn" style="width:100%;margin-bottom:8px;padding:12px;border-radius:10px;border:none;background:var(--accent);color:#fff;font-weight:800;cursor:pointer;font-family:inherit;">Confirm password</button>';
        }
        if (!ids.length && user && user.email) {
            buttons += '<button type="button" id="reauthEmailLink" style="width:100%;margin-bottom:8px;padding:12px;border-radius:10px;border:1px solid var(--border);background:var(--card-bg);color:var(--text);font-weight:700;cursor:pointer;font-family:inherit;">Email me a sign-in link</button>';
        }
        if (uid.indexOf('nostr:') === 0) buttons += '<button type="button" id="reauthNostr" style="width:100%;margin-bottom:8px;padding:12px;border-radius:10px;border:1px solid var(--border);background:var(--card-bg);color:var(--text);font-weight:700;cursor:pointer;font-family:inherit;">Sign in with Nostr again</button>';
        if (uid.indexOf('ln:') === 0) buttons += '<button type="button" id="reauthLn" style="width:100%;margin-bottom:8px;padding:12px;border-radius:10px;border:1px solid var(--border);background:var(--card-bg);color:var(--text);font-weight:700;cursor:pointer;font-family:inherit;">Sign in with Lightning again</button>';
        overlay.innerHTML = '<div id="reauthCard" style="background:var(--bg-side,#1a1a2e);border:1px solid var(--border);border-radius:16px;padding:24px;max-width:420px;width:100%;">' +
            '<h2 style="margin:0 0 8px;color:var(--heading);font-size:1.1rem;">Confirm it is you</h2>' +
            '<p style="color:var(--text-muted);font-size:0.85rem;line-height:1.5;margin:0 0 16px;">Sign in again before ' + accountLinkEscape(purpose || 'this change') + '.</p>' +
            buttons +
            '<button type="button" id="reauthCancel" style="width:100%;padding:12px;border-radius:10px;border:1px solid var(--border);background:none;color:var(--text);font-weight:700;cursor:pointer;font-family:inherit;">Cancel</button>' +
            '</div>';
        document.body.appendChild(overlay);
        function finish(ok) {
            var node = document.getElementById('reauthOverlay');
            if (node) node.remove();
            resolve(!!ok);
        }
        document.getElementById('reauthCancel').onclick = function() { finish(false); };
        overlay.onclick = function(e) { if (e.target === overlay) finish(false); };
        async function popup(provider) {
            try {
                await user.reauthenticateWithPopup(provider);
                finish(true);
            } catch (err) {
                if (typeof showToast === 'function') showToast('Sign in again, then try this.');
                finish(false);
            }
        }
        var googleBtn = document.getElementById('reauthGoogle');
        if (googleBtn) googleBtn.onclick = function() { popup(new firebase.auth.GoogleAuthProvider()); };
        var xBtn = document.getElementById('reauthX');
        if (xBtn) xBtn.onclick = function() { popup(new firebase.auth.TwitterAuthProvider()); };
        var ghBtn = document.getElementById('reauthGitHub');
        if (ghBtn) ghBtn.onclick = function() { popup(new firebase.auth.GithubAuthProvider()); };
        var fbBtn = document.getElementById('reauthFacebook');
        if (fbBtn) fbBtn.onclick = function() { popup(new firebase.auth.FacebookAuthProvider()); };
        var pwBtn = document.getElementById('reauthPasswordBtn');
        if (pwBtn) pwBtn.onclick = async function() {
            var password = (document.getElementById('reauthPassword').value || '');
            try {
                var cred = firebase.auth.EmailAuthProvider.credential(user.email, password);
                await user.reauthenticateWithCredential(cred);
                finish(true);
            } catch (err) {
                if (typeof showToast === 'function') showToast('Sign in again, then try this.');
            }
        };
        var linkBtn = document.getElementById('reauthEmailLink');
        if (linkBtn) linkBtn.onclick = async function() {
            try {
                sessionStorage.setItem('btc_reauth_email', user.email || '');
                await auth.sendSignInLinkToEmail(user.email, {
                    url: window.location.origin + window.location.pathname + '?reauth=1',
                    handleCodeInApp: true
                });
                if (typeof showToast === 'function') showToast('Check your email, then come back to finish.');
            } catch (err) {
                if (typeof showToast === 'function') showToast('Sign in again, then try this.');
            }
        };
        var nostrBtn = document.getElementById('reauthNostr');
        if (nostrBtn) nostrBtn.onclick = async function() {
            try {
                if (typeof nostrSignInWithExtension === 'function') await nostrSignInWithExtension();
                finish(true);
            } catch (err) { finish(false); }
        };
        var lnBtn = document.getElementById('reauthLn');
        if (lnBtn) lnBtn.onclick = async function() {
            try {
                var startLightning = window['signInWithLightning'];
                if (typeof startLightning === 'function') await startLightning();
                finish(true);
            } catch (err) { finish(false); }
        };
    });
};

async function freshProviderStep(action) {
    var payload = { action: action };
    if (typeof mfaNeedsFreshCode === 'function' && mfaNeedsFreshCode() && typeof window._showFreshStepUp === 'function') {
        var proof = await window._showFreshStepUp(action);
        if (!proof) return null;
        payload.freshProofId = proof;
    }
    await firebase.functions().httpsCallable('confirmAccountLink')(payload);
    return true;
}

function providerForId(pid) {
    if (pid === 'google.com') return new firebase.auth.GoogleAuthProvider();
    if (pid === 'twitter.com') return new firebase.auth.TwitterAuthProvider();
    if (pid === 'github.com') return new firebase.auth.GithubAuthProvider();
    if (pid === 'facebook.com') return new firebase.auth.FacebookAuthProvider();
    return null;
}

window.linkFullAccountProvider = async function(pid) {
    if (accountLinkTotpPending()) {
        if (typeof showToast === 'function') showToast(accountLinkTotpHoldMessage());
        return;
    }
    var user = auth && auth.currentUser;
    if (!user || user.isAnonymous) return;
    if (pid === 'password') {
        var email = window.prompt('Email to link');
        if (!email) return;
        var ready = await window.reauthForSensitiveAction('linking email');
        if (!ready) return;
        var proof = await freshProviderStep('linkProvider');
        if (!proof) return;
        try {
            writeAccountLinkIntent(user, email);
            await auth.sendSignInLinkToEmail(String(email).trim(), {
                url: window.location.origin + window.location.pathname,
                handleCodeInApp: true
            });
            if (typeof showToast === 'function') showToast('Check that email for a link to add it to this account.');
        } catch (err) {
            var conflict = accountLinkConflictMessage(err && err.code);
            if (typeof showToast === 'function') showToast(conflict || 'Could not link that email.');
        }
        return;
    }
    var provider = providerForId(pid);
    if (!provider) return;
    var readyPop = await window.reauthForSensitiveAction('linking a sign-in');
    if (!readyPop) return;
    var proofPop = await freshProviderStep('linkProvider');
    if (!proofPop) return;
    try {
        await user.linkWithPopup(provider);
        try { await syncAccountEmailFromAuth(); } catch (e) {}
        if (typeof showToast === 'function') showToast('Sign-in linked.');
        if (typeof refreshAccountSignInCard === 'function') refreshAccountSignInCard();
    } catch (err) {
        var msg = accountLinkConflictMessage(err && err.code);
        if (typeof showToast === 'function') showToast(msg || 'Could not link that sign-in.');
    }
};

window.unlinkFullAccountProvider = async function(pid) {
    if (accountLinkTotpPending()) {
        if (typeof showToast === 'function') showToast(accountLinkTotpHoldMessage());
        return;
    }
    var user = auth && auth.currentUser;
    if (!user) return;
    var ids = linkedProviderIds(user);
    if (ids.length < 2) {
        if (typeof showToast === 'function') showToast('Keep at least one sign-in on this account.');
        return;
    }
    var ready = await window.reauthForSensitiveAction('removing a sign-in');
    if (!ready) return;
    var proof = await freshProviderStep('unlinkProvider');
    if (!proof) return;
    try {
        await user.unlink(pid);
        try { await syncAccountEmailFromAuth(); } catch (e) {}
        if (typeof showToast === 'function') showToast('Sign-in removed.');
        if (typeof refreshAccountSignInCard === 'function') refreshAccountSignInCard();
    } catch (err) {
        if (typeof showToast === 'function') showToast('Could not remove that sign-in.');
    }
};

window.showChangeEmailModal = function() {
    var user = auth && auth.currentUser;
    if (!user || user.isAnonymous) return;
    var mode = accountEmailAction(user);
    if (mode === 'provider') {
        if (typeof showToast === 'function') showToast('That email belongs to your linked sign-in. Use Sign-in methods.');
        return;
    }
    var existing = document.getElementById('changeEmailModal');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'changeEmailModal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:490000;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;padding:20px;';
    var title = mode === 'add' ? 'Add email' : 'Change email';
    overlay.innerHTML = '<div style="background:var(--bg-side,#1a1a2e);border:1px solid var(--border);border-radius:16px;padding:24px;max-width:420px;width:100%;">' +
        '<h2 style="margin:0 0 8px;color:var(--heading);font-size:1.1rem;">' + title + '</h2>' +
        '<p style="color:var(--text-muted);font-size:0.85rem;line-height:1.5;margin:0 0 12px;">We email the new address to confirm it, and the previous address gets a link to revert the change.</p>' +
        '<input id="changeEmailInput" type="email" autocomplete="email" placeholder="name@example.com" style="width:100%;padding:12px;box-sizing:border-box;border-radius:10px;border:1px solid var(--border);background:var(--input-bg);color:var(--text);font-family:inherit;margin-bottom:12px;">' +
        '<div style="display:flex;gap:8px;">' +
        '<button type="button" onclick="document.getElementById(\'changeEmailModal\').remove()" style="flex:1;padding:12px;border-radius:10px;border:1px solid var(--border);background:none;color:var(--text);font-weight:700;cursor:pointer;font-family:inherit;">Cancel</button>' +
        '<button type="button" id="changeEmailSubmit" onclick="submitEmailChange()" style="flex:1;padding:12px;border-radius:10px;border:none;background:var(--accent);color:#fff;font-weight:800;cursor:pointer;font-family:inherit;">Send link</button>' +
        '</div></div>';
    document.body.appendChild(overlay);
};

window.submitEmailChange = async function() {
    var input = document.getElementById('changeEmailInput');
    var email = input ? String(input.value || '').trim() : '';
    if (!email) return;
    var btn = document.getElementById('changeEmailSubmit');
    if (btn) btn.disabled = true;
    try {
        var ready = await window.reauthForSensitiveAction('changing your email');
        if (!ready) { if (btn) btn.disabled = false; return; }
        var payload = { email: email };
        if (typeof mfaNeedsFreshCode === 'function' && mfaNeedsFreshCode()) {
            var proof = await window._showFreshStepUp('changeEmail');
            if (!proof) { if (btn) btn.disabled = false; return; }
            payload.freshProofId = proof;
        }
        await firebase.functions().httpsCallable('prepareEmailChange')(payload);
        await auth.currentUser.verifyBeforeUpdateEmail(email, {
            url: window.location.origin + window.location.pathname + '?emailChange=1',
            handleCodeInApp: true
        });
        var modal = document.getElementById('changeEmailModal');
        if (modal) modal.remove();
        if (typeof showToast === 'function') showToast('Check both email addresses. The new one gets a confirm link, and the old one gets a revert link.');
    } catch (err) {
        var code = err && err.code;
        var friendly = "That email can't be used.";
        if (code === 'auth/email-already-in-use' || code === 'functions/already-exists') {
            if (typeof showToast === 'function') showToast(friendly);
        } else if (code === 'functions/resource-exhausted' || code === 'resource-exhausted') {
            if (typeof showToast === 'function') showToast('Too many attempts. Try again later.');
        } else if (code === 'functions/invalid-argument' || code === 'invalid-argument') {
            if (typeof showToast === 'function') showToast(friendly);
        } else if (typeof showToast === 'function') {
            showToast((err && err.message) || friendly);
        }
        if (btn) btn.disabled = false;
    }
};

var ACCOUNT_LINK_STORAGE_KEY = 'btc_account_link';

function readAccountLinkIntent() {
    try {
        var raw = localStorage.getItem(ACCOUNT_LINK_STORAGE_KEY);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (!accountLinkIntentFresh(parsed, Date.now())) {
            clearAccountLinkIntent();
            return null;
        }
        return parsed;
    } catch (e) {
        clearAccountLinkIntent();
        return null;
    }
}

function writeAccountLinkIntent(user, email) {
    localStorage.setItem(ACCOUNT_LINK_STORAGE_KEY, JSON.stringify({
        kind: 'email',
        uid: user.uid,
        email: String(email || '').trim().toLowerCase(),
        at: Date.now()
    }));
}

function clearAccountLinkIntent() {
    try { localStorage.removeItem(ACCOUNT_LINK_STORAGE_KEY); } catch (e) {}
}

function refreshAccountSignInCard() {
    if (typeof updateAuthButton === 'function') updateAuthButton();
    if (typeof updateGuestPointsBanner === 'function') updateGuestPointsBanner();
    var open = document.getElementById('signInMethodsCard') || (document.getElementById('usernameModal') && document.getElementById('usernameModal').classList.contains('open'));
    if (open && typeof showSettingsPage === 'function') {
        try { showSettingsPage('account'); } catch (e) {}
    }
    setTimeout(function() {
        var card = document.getElementById('signInMethodsCard');
        if (card && card.scrollIntoView) {
            try { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (err) { card.scrollIntoView(true); }
        }
    }, 120);
}

async function waitForAccountLinkUser(uid) {
    if (auth && auth.currentUser && auth.currentUser.uid === uid) return auth.currentUser;
    await new Promise(function(resolve) {
        var done = false;
        var unsub = function() {};
        try {
            unsub = auth.onAuthStateChanged(function(user) {
                if (done) return;
                if (user && user.uid === uid) {
                    done = true;
                    try { unsub(); } catch (e) {}
                    resolve();
                }
            });
        } catch (e) {}
        setTimeout(function() {
            if (done) return;
            done = true;
            try { unsub(); } catch (e2) {}
            resolve();
        }, 8000);
    });
    return (auth && auth.currentUser && auth.currentUser.uid === uid) ? auth.currentUser : null;
}

async function finishAccountEmailLink(email, signInUrl) {
    var intent = readAccountLinkIntent();
    if (!intent) return false;
    if (accountLinkTotpPending()) {
        if (typeof showToast === 'function') showToast(accountLinkTotpHoldMessage());
        return true;
    }
    var wanted = String(email || '').trim().toLowerCase();
    if (wanted !== String(intent.email || '').trim().toLowerCase()) {
        clearAccountLinkIntent();
        return false;
    }
    var user = await waitForAccountLinkUser(intent.uid);
    if (!user) {
        clearAccountLinkIntent();
        return false;
    }
    var profile = (typeof currentUser !== 'undefined') ? currentUser : null;
    if (!accountCanLinkSignIn(user, profile)) {
        clearAccountLinkIntent();
        if (typeof showToast === 'function') showToast('This account already has a sign-in method.');
        window.history.replaceState(null, '', window.location.pathname + window.location.hash);
        return true;
    }
    var linkedUid = user.uid;
    var wasGuest = !!user.isAnonymous;
    try {
        var emailCred = firebase.auth.EmailAuthProvider.credentialWithLink(email, signInUrl);
        await user.linkWithCredential(emailCred);
    } catch (linkErr) {
        var code = linkErr && linkErr.code;
        if (code === 'auth/multi-factor-auth-required') {
            surfaceMfaRequired(linkErr);
            return true;
        }
        var conflict = accountLinkConflictMessage(code);
        if (conflict) {
            clearAccountLinkIntent();
            if (typeof showToast === 'function') showToast(conflict);
            window.history.replaceState(null, '', window.location.pathname + window.location.hash);
            return true;
        }
        if (typeof showToast === 'function') {
            if (code === 'auth/invalid-action-code' || code === 'auth/expired-action-code') {
                showToast('That link expired. Send a new one from the Sign-in methods card.');
            } else {
                showToast('Could not link that email. You are still on this account.');
            }
        }
        window.history.replaceState(null, '', window.location.pathname + window.location.hash);
        return true;
    }
    if (!auth.currentUser || auth.currentUser.uid !== linkedUid) {
        if (typeof showToast === 'function') showToast(accountLinkConflictMessage('auth/credential-already-in-use'));
        window.history.replaceState(null, '', window.location.pathname + window.location.hash);
        return true;
    }
    clearAccountLinkIntent();
    try { localStorage.removeItem('btc_signin_email'); } catch (e1) {}
    try { localStorage.removeItem('btc_guest_link'); } catch (e2) {}
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    if (wasGuest && typeof _handleSignInResultGlobal === 'function') {
        await _handleSignInResultGlobal(auth.currentUser, null, null);
    }
    if (typeof showToast === 'function') showToast('Email linked. You can use it to sign in next time.');
    refreshAccountSignInCard();
    return true;
}

async function linkGoogleOntoCurrentAccount(idToken) {
    if (accountLinkTotpPending()) {
        if (typeof showToast === 'function') showToast(accountLinkTotpHoldMessage());
        return;
    }
    var user = auth && auth.currentUser;
    var profile = (typeof currentUser !== 'undefined') ? currentUser : null;
    if (!user || !accountCanLinkSignIn(user, profile)) {
        if (typeof showToast === 'function') showToast('This account already has a sign-in method.');
        return;
    }
    var credential = firebase.auth.GoogleAuthProvider.credential(idToken);
    var linkedUid = user.uid;
    var wasGuest = !!user.isAnonymous;
    try {
        await user.linkWithCredential(credential);
    } catch (linkErr) {
        var code = linkErr && linkErr.code;
        if (code === 'auth/multi-factor-auth-required') throw linkErr;
        var conflict = accountLinkConflictMessage(code);
        if (conflict) {
            if (typeof showToast === 'function') showToast(conflict);
            return;
        }
        if (typeof showToast === 'function') showToast('Could not link Google. You are still on this account.');
        return;
    }
    if (!auth.currentUser || auth.currentUser.uid !== linkedUid) {
        if (typeof showToast === 'function') showToast(accountLinkConflictMessage('auth/credential-already-in-use'));
        return;
    }
    try { localStorage.removeItem('btc_guest_link'); } catch (e1) {}
    if (typeof clearGoogleOneTapChrome === 'function') clearGoogleOneTapChrome();
    if (wasGuest && typeof _handleSignInResultGlobal === 'function') {
        await _handleSignInResultGlobal(auth.currentUser, null, null);
    }
    if (typeof showToast === 'function') showToast('Google linked. You can use it to sign in next time.');
    refreshAccountSignInCard();
}

function surfaceMfaRequired(err) {
    if (!err || err.code !== 'auth/multi-factor-auth-required') return false;
    try {
        var em = document.getElementById('emailInput');
        if (em && em.value) window._mfaRecoveryEmail = em.value.trim();
    } catch (e) {}
    if (typeof window._showMFASignInChallenge === 'function') {
        window._showMFASignInChallenge(err.resolver);
    } else if (typeof showToast === 'function') {
        showToast('Two-factor authentication required. Please refresh and try again.');
    }
    return true;
}

async function finishEmailSignIn(email, _signInUrl) {
    if (email) window._mfaRecoveryEmail = email;
    if (!email) {
        showToast('⚠️ Could not determine your email. Please sign in again from the app.');
        return;
    }
    if (await finishAccountEmailLink(email, _signInUrl)) return;

    try {
        // Save anonymous user info BEFORE sign-in changes auth state
        const anonUser = auth.currentUser;
        let anonUid = null;
        let anonData = null;
        if (anonUser && anonUser.isAnonymous) {
            anonUid = anonUser.uid;
            console.log('[Email Sign-In] Anon user found:', anonUid);
            try {
                const anonDoc = await db.collection('users').doc(anonUid).get();
                if (anonDoc.exists) anonData = anonDoc.data();
                console.log('[Email Sign-In] Anon data loaded:', !!anonData);
            } catch(e) {
                console.log('[Email Sign-In] Anon data load failed (non-fatal):', e.code);
            }
        }

        // Upgrade the guest in place when this email is new. Merge is the fallback.
        // A previous resend means this code must not be spent on linkWithCredential.
        console.log('[Email Sign-In] Starting sign-in');
        var resultUser = null;
        var skipInPlaceLink = false;
        try {
            skipInPlaceLink = shouldSkipInPlaceLink(localStorage.getItem('btc_skip_email_link'), email);
        } catch (flagRead) {}
        if (!skipInPlaceLink && anonUser && anonUser.isAnonymous && firebase.auth.EmailAuthProvider && typeof anonUser.linkWithCredential === 'function') {
            try {
                var emailCred = firebase.auth.EmailAuthProvider.credentialWithLink(email, _signInUrl);
                var linkedEmail = await anonUser.linkWithCredential(emailCred);
                try { localStorage.removeItem('btc_guest_link'); } catch (e1) {}
                resultUser = linkedEmail.user;
            } catch (linkErr) {
                var linkCode = linkErr && linkErr.code;
                var linkPlan = planEmailLinkFailure(linkCode, !!(linkErr && linkErr.credential));
                if (linkPlan === 'mfa') throw linkErr;
                if (linkPlan === 'credential') {
                    var signedEmail = await auth.signInWithCredential(linkErr.credential);
                    resultUser = signedEmail.user;
                } else if (linkPlan === 'throw') {
                    throw linkErr;
                }
            }
        }
        if (!resultUser) {
            try {
                const result = await auth.signInWithEmailLink(email, _signInUrl);
                resultUser = result.user;
                try { localStorage.removeItem('btc_skip_email_link'); } catch (clearFlag) {}
            } catch (signErr) {
                var signPlan = planEmailSignInFailure(signErr && signErr.code);
                if (signPlan === 'mfa') throw signErr;
                if (signPlan === 'resend') {
                    try { localStorage.setItem('btc_skip_email_link', String(email || '').trim().toLowerCase()); } catch (flagErr) {}
                    var resent = false;
                    try { resent = await sendMagicLink(email); } catch (sendErr) { resent = false; }
                    var consumed = new Error(resent
                        ? 'That sign-in link was already used. We emailed you a fresh link.'
                        : 'That sign-in link was already used. Request a new one from the sign-in screen.');
                    consumed.code = 'auth/link-consumed';
                    throw consumed;
                }
                throw signErr;
            }
        }
        if (resultUser) {
            try { localStorage.removeItem('btc_skip_email_link'); } catch (clearFlag) {}
        }
        console.log('[Email Sign-In] Sign-in result:', resultUser ? resultUser.uid : 'no user');
        localStorage.removeItem('btc_signin_email');

        // Check if this email user already has data
        const emailUid = resultUser.uid;

        // Wait for auth state to fully stabilize and db to get fresh token
        console.log('[Email Sign-In] Waiting for auth token propagation...');
        for (var _retry = 0; _retry < 5; _retry++) {
            await new Promise(r => setTimeout(r, 200));
            try {
                var _testDoc = await db.collection('users').doc(emailUid).get();
                console.log('[Email Sign-In] Firestore auth ready after', (_retry + 1) * 200, 'ms');
                break;
            } catch(_testErr) {
                if (_testErr.code === 'permission-denied') {
                    console.log('[Email Sign-In] Permission denied on retry ' + (_retry + 1) + ', waiting for token propagation...');
                    continue;
                }
                throw _testErr;
            }
        }
        console.log('[Email Sign-In] Fetching existing user doc:', emailUid);
        const existingDoc = await db.collection('users').doc(emailUid).get();
        console.log('[Email Sign-In] Existing doc exists:', existingDoc.exists);

        const pendingUsername = localStorage.getItem('btc_pending_username');
        const pendingLnAddress = localStorage.getItem('btc_pending_ln_address') || '';
        const pendingFaction  = localStorage.getItem('btc_pending_faction')    || '';
        const pendingCountry  = localStorage.getItem('btc_pending_country')    || '';
        if (!existingDoc.exists) {
            var extra = {
                tosVersion: TOS_CURRENT_VERSION,
                tosAcceptedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            var _emailLn = normalizeClientLn(pendingLnAddress);
            if (clientLnValid(_emailLn)) { extra.lightning = _emailLn; extra.lightningAddress = _emailLn; }
            if (pendingCountry) extra.country = pendingCountry;
            var _emailSrc = localStorage.getItem('btc_signup_source');
            if (_emailSrc) extra.signupSource = _emailSrc;
            await db.collection('users').doc(emailUid).set(clientCreatePayload(extra));
            if (pendingFaction) {
                try { await flushSignupFaction(pendingFaction); } catch (e) {}
            }
            try { db.collection('stats').doc('global').set({ userCount: firebase.firestore.FieldValue.increment(1) }, { merge: true }).catch(function() {}); } catch(e) {}
            if (typeof attachReferral === 'function') attachReferral(emailUid);
            if (pendingUsername) {
                try { await applyServerUsername(pendingUsername); }
                catch (nameErr) {
                    showToast(nameErr.message || 'Pick a different username.');
                    if (typeof showUsernamePrompt === 'function') showUsernamePrompt();
                }
            }
        }
        var guestHold = false;
        if (typeof tryLinkGuest === 'function') {
            try { if (await tryLinkGuest() === 'mfa') guestHold = true; } catch (e) {}
        }

        // Keep the guest profile when the merge is waiting on the 2FA gate.
        if (anonUid && anonUid !== emailUid && !guestHold) {
            try { await db.collection('users').doc(anonUid).delete(); } catch(e) {}
        }

        // Clean URL
        window.history.replaceState(null, '', window.location.pathname + window.location.hash);

        // Clean up pending data
        localStorage.removeItem('btc_pending_username');
        localStorage.removeItem('btc_pending_email');
        localStorage.removeItem('btc_pending_ln_address');
        localStorage.removeItem('btc_pending_faction');
        localStorage.removeItem('btc_pending_country');
        // 🗑️ SECURITY HARDENING (C-NEW-13): Wipe ghost on-chain wallet data
        localStorage.removeItem('btc_wallet_enc');
        localStorage.removeItem('btc_wallet_addrs');

        loadUser(emailUid);
        showToast('Email verified. You\'re signed in.');
    } catch(e) {
        console.error('[Email Sign-In] Full error:', e.code, e.message, e.stack);
        // MFA required. Do not start a new guest session over the challenge.
        if (surfaceMfaRequired(e)) return;
        if (e.code === 'auth/link-consumed') {
            showToast(e.message || 'That sign-in link was already used. Request a new one.');
            window.history.replaceState(null, '', window.location.pathname + window.location.hash);
            return;
        }
        // Check if this is a Firestore permission error
        if (e.code === 'permission-denied') {
            showToast('⚠️ Permission denied. Try refreshing the page or clearing cache.');
            console.error('[Email Sign-In] Firestore permission denied - auth state may not be ready');
        } else if (e.code === 'auth/invalid-action-code' || e.code === 'auth/expired-action-code') {
            showToast('⚠️ This sign-in link has expired. Please request a new one.');
        } else if (e.code === 'auth/invalid-email') {
            showToast('⚠️ Email mismatch. Make sure you enter the same email you signed up with.');
        } else {
            showToast('Sign-in error (' + (e.code || 'unknown') + '). Please try again.');
        }
        // Clean URL so the broken link doesn't keep retrying
        window.history.replaceState(null, '', window.location.pathname + window.location.hash);
        auth.signInAnonymously();
    }
}

// Google Sign-In. The rendered Google button returns an ID token in this page.
// Firebase accepts it with signInWithCredential / linkWithCredential, so Google
// never redirects to /__/auth/handler. Popup and redirect stay as the fallback
// when the Google script cannot load. The ID token is not logged.
var GOOGLE_CLIENT_ID = '1055248200518-jcn5efjp7vhk0vm8cbmj4mfsgc0edkga.apps.googleusercontent.com';

function gisApiReady() {
    return typeof google !== 'undefined' && google.accounts && google.accounts.id &&
        typeof google.accounts.id.renderButton === 'function';
}

function loadGoogleIdentityScript() {
    if (gisApiReady()) return Promise.resolve();
    if (window._gsiLoadPromise) return window._gsiLoadPromise;
    window._gsiLoadPromise = new Promise(function(resolve, reject) {
        if (typeof window._loadGSI === 'function') window._loadGSI();
        var script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
        if (!script) {
            reject(new Error('gsi-unavailable'));
            return;
        }
        var settled = false;
        var giveUpAt = Date.now() + 8000;
        var timer = setInterval(function() {
            if (settled) return;
            if (gisApiReady()) finish(true);
            else if (Date.now() >= giveUpAt) finish(false);
        }, 50);
        function finish(ok) {
            if (settled) return;
            settled = true;
            clearInterval(timer);
            if (ok && gisApiReady()) resolve();
            else reject(new Error('gsi-unavailable'));
        }
        script.addEventListener('load', function() { if (gisApiReady()) finish(true); });
        script.addEventListener('error', function() { finish(false); });
    });
    return window._gsiLoadPromise;
}

function googleSignInErrorMessage(e) {
    var code = (e && e.code) || '';
    if (code === 'auth/unauthorized-domain') return 'This domain is not authorized for sign-in. Please contact support.';
    if (code === 'auth/operation-not-allowed') return 'This sign-in method is not enabled. Try a different option.';
    if (code === 'auth/account-exists-with-different-credential') return 'This email already has an account with another sign-in method. Sign in that way, then link Google in settings.';
    if (code === 'auth/network-request-failed') return 'Network error. Check your connection and try again.';
    if (code === 'auth/popup-blocked') return 'The sign-in window was blocked. Allow popups and try again.';
    if (code === 'auth/user-disabled') return 'This account is disabled. Please contact support.';
    if (code === 'auth/too-many-requests') return 'Too many attempts. Wait a moment and try again.';
    if (code === 'auth/web-storage-unsupported') return 'This browser is blocking sign-in storage. Try another browser.';
    if (code === 'auth/invalid-credential' || code === 'auth/invalid-id-token' || code === 'auth/user-token-expired') return 'That sign-in was rejected. Please try again.';
    if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') return 'This account already exists. Please try signing in again.';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || code === 'auth/user-cancelled') return '';
    return 'Sign-in did not work. Please try again.';
}

function rememberGoogleMfaEmail(idToken) {
    try {
        var part = String(idToken).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        while (part.length % 4) part += '=';
        var payload = JSON.parse(atob(part));
        if (payload && payload.email) window._mfaRecoveryEmail = String(payload.email).trim();
    } catch (ignore) {}
}

function clearGoogleOneTapChrome() {
    try { if (gisApiReady()) google.accounts.id.cancel(); } catch (e) {}
    document.querySelectorAll('[id*="credential_picker"]').forEach(function(el) { el.remove(); });
}

var _googleCredentialBusy = false;

async function applyGoogleIdToken(idToken) {
    if (!idToken || typeof idToken !== 'string') throw new Error('No credential received');
    if (_googleCredentialBusy) return null;
    _googleCredentialBusy = true;
    var linkOnly = window._accountLinkGoogle === true;
    window._accountLinkGoogle = false;
    try {
        if (linkOnly) {
            await linkGoogleOntoCurrentAccount(idToken);
            return auth.currentUser;
        }
        var credential = firebase.auth.GoogleAuthProvider.credential(idToken);
        var guest = auth.currentUser;
        var anonUid = (guest && guest.isAnonymous) ? guest.uid : null;
        var resultUser = null;
        if (guest && guest.isAnonymous && typeof guest.linkWithCredential === 'function') {
            try {
                var linked = await guest.linkWithCredential(credential);
                try { localStorage.removeItem('btc_guest_link'); } catch (e1) {}
                resultUser = linked.user;
                anonUid = null;
            } catch (linkErr) {
                var linkCode = linkErr && linkErr.code;
                if (linkCode === 'auth/credential-already-in-use' || linkCode === 'auth/email-already-in-use') {
                    // GIS ID-token credentials do not get .credential on this error.
                    // Rebuild from the same token. Do not reuse the object the link call consumed.
                    // anonUid stays set so the guest merge still runs.
                    var signed = await auth.signInWithCredential(linkErr.credential || firebase.auth.GoogleAuthProvider.credential(idToken));
                    resultUser = signed.user;
                } else if (linkCode === 'auth/account-exists-with-different-credential') {
                    var differentMethod = new Error(googleSignInErrorMessage(linkErr));
                    differentMethod.code = linkCode;
                    throw differentMethod;
                } else {
                    throw linkErr;
                }
            }
        }
        if (!resultUser) {
            var result = await auth.signInWithCredential(credential);
            resultUser = result.user;
        }
        clearGoogleOneTapChrome();
        await _handleSignInResultGlobal(resultUser, anonUid, null);
        return resultUser;
    } finally {
        _googleCredentialBusy = false;
    }
}

function onGoogleIdentityCredential(response) {
    var idToken = response && response.credential;
    if (!idToken) return;
    applyGoogleIdToken(idToken).catch(function(e) {
        if (e && e.code === 'auth/multi-factor-auth-required') rememberGoogleMfaEmail(idToken);
        if (surfaceMfaRequired(e)) return;
        console.warn('[Auth] Google sign-in failed:', (e && e.code) || 'unknown');
        var msg = googleSignInErrorMessage(e);
        if (msg && typeof showToast === 'function') showToast(msg);
    });
}

function ensureGoogleIdentityInit() {
    if (window._gsiInitialized || !gisApiReady()) return;
    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: onGoogleIdentityCredential,
        auto_select: false,
        cancel_on_tap_outside: false,
        context: 'signin',
        ux_mode: 'popup',
        itp_support: true
    });
    window._gsiInitialized = true;
}

function googleButtonWidth(fallback) {
    var width = fallback && fallback.offsetWidth ? fallback.offsetWidth : 0;
    if (width < 200) {
        var box = document.querySelector('#usernameModal .username-box');
        width = box && box.clientWidth ? box.clientWidth - 32 : 320;
    }
    if (width < 200) width = 280;
    if (width > 400) width = 400;
    return Math.floor(width);
}

function renderGoogleSignInButton() {
    if (isInAppBrowser()) return;
    var host = document.getElementById('gsiButtonHost');
    var fallback = document.getElementById('googleSignInFallback');
    if (!host || !gisApiReady()) return;
    ensureGoogleIdentityInit();
    if (host.getAttribute('data-gsi-rendered') === '1' && host.childNodes.length) {
        host.style.display = 'block';
        if (fallback) fallback.style.display = 'none';
        return;
    }
    host.setAttribute('data-gsi-rendered', '1');
    host.innerHTML = '';
    host.style.display = 'block';
    try {
        google.accounts.id.renderButton(host, {
            type: 'standard',
            theme: 'filled_black',
            size: 'large',
            text: 'signin_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: googleButtonWidth(fallback),
            click_listener: function() {
                window._accountLinkGoogle = false;
                if (typeof window._captureSignupFormState === 'function') window._captureSignupFormState();
            }
        });
    } catch (e) {
        host.removeAttribute('data-gsi-rendered');
        host.style.display = 'none';
        window._gsiFailed = true;
        if (fallback) fallback.style.display = 'flex';
        return;
    }
    if (!host.childNodes.length) {
        host.removeAttribute('data-gsi-rendered');
        host.style.display = 'none';
        if (fallback) fallback.style.display = 'flex';
        return;
    }
    if (fallback) fallback.style.display = 'none';
}

function mountGoogleSignInButton() {
    if (isInAppBrowser()) return;
    var host = document.getElementById('gsiButtonHost');
    if (!host || window._gsiFailed) return;
    if (gisApiReady()) {
        renderGoogleSignInButton();
        return;
    }
    if (window._gsiMounting) return;
    window._gsiMounting = true;
    loadGoogleIdentityScript().then(function() {
        window._gsiMounting = false;
        renderGoogleSignInButton();
    }).catch(function() {
        window._gsiMounting = false;
        window._gsiFailed = true;
        host.style.display = 'none';
        var fallback = document.getElementById('googleSignInFallback');
        if (fallback) fallback.style.display = 'flex';
    });
}

function installGoogleSignInButton() {
    if (isInAppBrowser()) return;
    var modal = document.getElementById('usernameModal');
    if (!modal || modal._gsiWatch) return;
    modal._gsiWatch = true;
    var obs = new MutationObserver(function() {
        if (modal.classList.contains('open') && document.getElementById('gsiButtonHost')) mountGoogleSignInButton();
    });
    obs.observe(modal, { attributes: true, attributeFilter: ['class'] });
    if (modal.classList.contains('open') && document.getElementById('gsiButtonHost')) mountGoogleSignInButton();
}

window.signInWithGoogle = async function() {
    window._captureSignupFormState();
    if (isInAppBrowser()) {
        await signInWithProvider(new firebase.auth.GoogleAuthProvider());
        return;
    }
    if (!window._gsiFailed) {
        mountGoogleSignInButton();
        return;
    }
    var btn = document.getElementById('googleSignInFallback');
    if (btn) btn.style.opacity = '0.6';
    try {
        await signInWithProvider(new firebase.auth.GoogleAuthProvider());
    } catch (e) {
        if (surfaceMfaRequired(e)) return;
    }
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installGoogleSignInButton);
else installGoogleSignInButton();

// Twitter/X Sign-In - no client SDK, must use Firebase popup/redirect
window.signInWithTwitter = async function() {
    window._captureSignupFormState();
    var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
        try {
            await linkOrSignInPopup(new firebase.auth.TwitterAuthProvider());
            return;
        } catch(e) {
            if (e && e.code === 'auth/popup-closed-by-user') return;
            if (surfaceMfaRequired(e)) return;
            showPWAAuthFallback('Twitter');
            return;
        }
    }
    await signInWithProvider(new firebase.auth.TwitterAuthProvider());
}

// GitHub Sign-In
window.signInWithGithub = async function() {
    window._captureSignupFormState();
    var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
        try {
            await linkOrSignInPopup(new firebase.auth.GithubAuthProvider());
            return;
        } catch(e) {
            if (e && e.code === 'auth/popup-closed-by-user') return;
            if (surfaceMfaRequired(e)) return;
            showPWAAuthFallback('GitHub');
            return;
        }
    }
    await signInWithProvider(new firebase.auth.GithubAuthProvider());
}

// PWA auth fallback for providers without client SDKs
function showPWAAuthFallback(providerName) {
    var msg = document.createElement('div');
    msg.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;padding:20px;';
    msg.onclick = function(e) { if (e.target === msg) msg.remove(); };
    msg.innerHTML = '<div style="background:var(--bg-side,#1a1a2e);border:1px solid var(--border);border-radius:16px;padding:24px;max-width:340px;text-align:center;">' +
        '<div style="font-size:2rem;margin-bottom:12px;">🔐</div>' +
        '<div style="color:var(--heading);font-weight:700;font-size:1rem;margin-bottom:8px;">' + providerName + ' Sign-In</div>' +
        '<div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:16px;line-height:1.5;">' + providerName + ' sign-in requires a browser window. Open the site in your browser to sign in.</div>' +
        '<button onclick="window.open(\'https://bitcoineducation.quest\',\'_blank\')" style="padding:12px 24px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.9rem;width:100%;margin-bottom:8px;">🌐 Open in Browser</button>' +
        '<button onclick="this.closest(\'div\').parentElement.remove()" style="padding:8px;background:none;border:none;color:var(--text-faint);font-size:0.8rem;cursor:pointer;font-family:inherit;">Cancel</button>' +
    '</div>';
    document.body.appendChild(msg);
}

// Facebook Sign-In - uses FB SDK for PWA compatibility
var FB_APP_ID = '1400842698021858';

window.fbAsyncInit = function() {
    FB.init({ appId: FB_APP_ID, cookie: true, xfbml: false, version: 'v19.0' });
};

// Lazy-load FB SDK on first click — avoids loading a third-party tracker on every page paint
function _loadFBSDK() {
    return new Promise(function(resolve) {
        if (typeof FB !== 'undefined') { resolve(); return; }
        var s = document.createElement('script');
        s.src = 'https://connect.facebook.net/en_US/sdk.js';
        s.integrity = 'sha384-3oqMa0wr/MCmsCFJBDgYA0AEWQ6whqOB0l3fAGZ8mfLLQDhXBWsV2YLdRxAFYqN';
        s.crossOrigin = 'anonymous';
        s.async = true;
        s.defer = true;
        s.onload = function() { resolve(); };
        s.onerror = function() { resolve(); }; // fall through to popup flow
        document.head.appendChild(s);
    });
}

window.signInWithFacebook = async function() {
    window._captureSignupFormState();
    await _loadFBSDK();
    if (typeof FB !== 'undefined') {
        try {
            await signInWithFBSDK();
            return;
        } catch(fbErr) {
            if (fbErr && fbErr.message === 'Facebook login cancelled') return;
            if (surfaceMfaRequired(fbErr)) return;
            console.warn('[Auth] FB SDK failed:', fbErr);
        }
    }
    await signInWithProvider(new firebase.auth.FacebookAuthProvider());
}

async function signInWithFBSDK() {
    var anonUid = (auth.currentUser && auth.currentUser.isAnonymous) ? auth.currentUser.uid : null;
    return new Promise(function(resolve, reject) {
        FB.login(function(response) {
            if (!response.authResponse) { reject(new Error('Facebook login cancelled')); return; }
            var credential = firebase.auth.FacebookAuthProvider.credential(response.authResponse.accessToken);
            var guest = auth.currentUser;
            var chain;
            if (guest && guest.isAnonymous && typeof guest.linkWithCredential === 'function') {
                chain = guest.linkWithCredential(credential).then(function(linked) {
                    try { localStorage.removeItem('btc_guest_link'); } catch (e1) {}
                    return _handleSignInResultGlobal(linked.user, null, null).then(function() { return linked.user; });
                }).catch(function(linkErr) {
                    var linkCode = linkErr && linkErr.code;
                    if (linkCode === 'auth/credential-already-in-use' || linkCode === 'auth/email-already-in-use') {
                        var fbCred = linkErr.credential || firebase.auth.FacebookAuthProvider.credential(response.authResponse.accessToken);
                        return auth.signInWithCredential(fbCred).then(function(signed) {
                            return _handleSignInResultGlobal(signed.user, anonUid, null).then(function() { return signed.user; });
                        });
                    }
                    throw linkErr;
                });
            } else {
                chain = auth.signInWithCredential(credential).then(function(result) {
                    return _handleSignInResultGlobal(result.user, anonUid, null).then(function() { return result.user; });
                });
            }
            chain.then(resolve).catch(reject);
        }, { scope: 'email,public_profile' });
    });
}

// Nostr sign-in - full modal with extension/nsec/npub options
// Uses nostr-tools CDN for nsec decoding, signing, and key derivation
window.signInWithNostr = async function() {
    if (!checkRateLimit()) return;
    window._captureSignupFormState();
    // Close the sign-in modal so the Nostr overlay isn't buried under it
    var _um = document.getElementById('usernameModal');
    if (_um) _um.classList.remove('open');
    var hasExtension = !!window.nostr;
    var overlay = document.createElement('div');
    overlay.id = 'nostrAuthOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:500000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML =
        '<div style="background:var(--bg-side,#1a1a2e);border:2px solid #7B2DE4;border-radius:20px;padding:28px;max-width:420px;width:100%;max-height:90vh;overflow-y:auto;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
                '<h3 style="color:#7B2DE4;font-weight:800;margin:0;">🟣 Sign in with Nostr</h3>' +
                '<button onclick="document.getElementById(\'nostrAuthOverlay\').remove()" style="background:none;border:none;color:var(--text-muted);font-size:1.2rem;cursor:pointer;">✕</button>' +
            '</div>' +
            (hasExtension ?
                '<button onclick="nostrSignInWithExtension()" style="width:100%;padding:14px;background:linear-gradient(135deg,rgba(123,45,228,0.2),rgba(123,45,228,0.05));border:2px solid rgba(123,45,228,0.4);border-radius:14px;color:var(--text);font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:12px;display:flex;align-items:center;gap:12px;text-align:left;"><span style="font-size:1.5rem;">🔌</span><div><div style="color:#7B2DE4;">Use Browser Extension</div><div style="color:var(--text-faint);font-size:0.7rem;font-weight:400;margin-top:2px;">Alby, nos2x, or Nostr Connect detected</div></div></button>'
            : '<div style="padding:14px;background:rgba(255,255,255,0.03);border:1px dashed var(--border);border-radius:14px;margin-bottom:12px;display:flex;align-items:center;gap:12px;"><span style="font-size:1.5rem;opacity:0.4;">🔌</span><div><div style="color:var(--text-faint);">No Extension Detected</div><div style="color:var(--text-faint);font-size:0.7rem;margin-top:2px;">Install <a href="https://getalby.com" target="_blank" rel="noopener" style="color:#7B2DE4;">Alby</a> or <a href="https://github.com/nicholasmcconnell/nos2x" target="_blank" rel="noopener" style="color:#7B2DE4;">nos2x</a> for one-click login</div></div></div>') +
            '<div style="display:flex;align-items:center;gap:12px;margin:16px 0;"><div style="flex:1;height:1px;background:var(--border);"></div><span style="color:var(--text-faint);font-size:0.75rem;">or</span><div style="flex:1;height:1px;background:var(--border);"></div></div>' +
            '<div style="margin-bottom:16px;"><label style="display:block;font-size:0.75rem;color:var(--text-faint);margin-bottom:6px;">Paste your nsec (private key)</label><input type="password" id="nostrNsecInput" placeholder="nsec1..." style="width:100%;padding:12px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;font-family:monospace;outline:none;box-sizing:border-box;"><div style="color:var(--text-faint);font-size:0.65rem;margin-top:6px;line-height:1.4;">🔒 Your nsec is used <strong>only in your browser</strong> to sign a one-time login event. It is never sent to our servers or stored anywhere.</div></div>' +
            '<button onclick="nostrSignInWithNsec()" id="nostrNsecBtn" style="width:100%;padding:14px;background:#7B2DE4;color:#fff;border:none;border-radius:12px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;">Sign In with nsec</button>' +
            '<div id="nostrAuthStatus" style="margin-top:8px;font-size:0.8rem;text-align:center;min-height:20px;"></div>' +
            '<div style="display:flex;align-items:center;gap:12px;margin:16px 0;"><div style="flex:1;height:1px;background:var(--border);"></div><span style="color:var(--text-faint);font-size:0.75rem;">or</span><div style="flex:1;height:1px;background:var(--border);"></div></div>' +
            '<div><label style="display:block;font-size:0.75rem;color:var(--text-faint);margin-bottom:6px;">Paste your npub (public key only)</label><input type="text" id="nostrNpubInput" placeholder="npub1..." style="width:100%;padding:12px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;font-family:monospace;outline:none;box-sizing:border-box;"></div>' +
            '<button onclick="nostrSignInWithNpub()" style="width:100%;margin-top:8px;padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;color:var(--text-muted);font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit;">Link npub</button>' +
        '</div>';
    document.body.appendChild(overlay);
};

// NIP-07 extension sign-in
window.nostrSignInWithExtension = async function() {
    if (!window.nostr) { showToast('Extension not found'); return; }
    var statusEl = document.getElementById('nostrAuthStatus');
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--accent);">Requesting key from extension...</span>';
    try {
        var pubkey = await window.nostr.getPublicKey();
        if (!pubkey || !/^[a-f0-9]{64}$/.test(pubkey)) { if (statusEl) statusEl.innerHTML = '<span style="color:#ef4444;">Could not get public key</span>'; return; }
        if (statusEl) statusEl.innerHTML = '<span style="color:var(--accent);">Signing auth event...</span>';
        var signed = await window.nostr.signEvent({ kind: 22242, created_at: Math.floor(Date.now() / 1000), tags: [['challenge', 'btc-edu-' + Date.now()]], content: 'Sign in to Bitcoin Education Archive', pubkey: pubkey });
        if (!signed || !signed.sig) { if (statusEl) statusEl.innerHTML = '<span style="color:#ef4444;">Signing cancelled</span>'; return; }
        await nostrCompleteAuth(pubkey, signed.sig, signed);
    } catch(e) { console.error('Nostr extension error:', e); if (statusEl) statusEl.innerHTML = '<span style="color:#ef4444;">Extension error: ' + (e.message || 'Unknown') + '</span>'; }
};

// nsec sign-in - uses nostr-tools CDN for key derivation and signing
window.nostrSignInWithNsec = async function() {
    var nsec = (document.getElementById('nostrNsecInput').value || '').trim();
    var statusEl = document.getElementById('nostrAuthStatus');
    var btn = document.getElementById('nostrNsecBtn');
    if (!nsec) { showToast('Please paste your nsec'); return; }
    if (!nsec.startsWith('nsec1')) { if (statusEl) statusEl.innerHTML = '<span style="color:#ef4444;">Invalid nsec format. Must start with nsec1</span>'; return; }
    btn.disabled = true; btn.textContent = 'Loading crypto library...';
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--accent);">Loading...</span>';
    try {
        // Load nostr-tools from CDN if not already loaded
        if (!window.NostrTools) {
            await new Promise(function(resolve, reject) {
                var script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/nostr-tools@1.17.0/lib/nostr.bundle.js';
                script.integrity = 'sha384-GwmNxV/GnZt+zRBR/Hhtu5D4MKfbxeJSApW44ARryGYtj3MFheHMFgiEZ7tVnrln';
                script.crossOrigin = 'anonymous';
                script.onload = resolve;
                script.onerror = function() { reject(new Error('Failed to load nostr-tools')); };
                document.head.appendChild(script);
            });
        }
        var NT = window.NostrTools;
        if (statusEl) statusEl.innerHTML = '<span style="color:var(--accent);">Decoding nsec...</span>';
        btn.textContent = 'Signing...';
        var decoded = NT.nip19.decode(nsec);
        if (!decoded || decoded.type !== 'nsec') { if (statusEl) statusEl.innerHTML = '<span style="color:#ef4444;">Invalid nsec</span>'; btn.disabled = false; btn.textContent = 'Sign In with nsec'; return; }
        var privkeyHex = decoded.data;
        if (typeof privkeyHex !== 'string') { privkeyHex = Array.from(new Uint8Array(privkeyHex)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join(''); }
        var pubkey = NT.getPublicKey(privkeyHex);
        var event = { kind: 22242, created_at: Math.floor(Date.now() / 1000), tags: [['challenge', 'btc-edu-' + Date.now()]], content: 'Sign in to Bitcoin Education Archive', pubkey: pubkey };
        event.id = NT.getEventHash(event);
        event.sig = NT.signEvent(event, privkeyHex);
        document.getElementById('nostrNsecInput').value = '';
        if (statusEl) statusEl.innerHTML = '<span style="color:var(--accent);">Verifying signature...</span>';
        await nostrCompleteAuth(pubkey, event.sig, event);
    } catch(e) {
        console.error('Nostr nsec error:', e);
        if (statusEl) statusEl.innerHTML = '<span style="color:#ef4444;">Error: ' + (e.message || 'Failed to sign') + '</span>';
        btn.disabled = false; btn.textContent = 'Sign In with nsec';
    }
};

// npub linking (read-only - links pubkey to current account)
window.nostrSignInWithNpub = async function() {
    var npub = (document.getElementById('nostrNpubInput').value || '').trim();
    var statusEl = document.getElementById('nostrAuthStatus');
    if (!npub) { showToast('Please paste your npub'); return; }
    var pubkey = npub;
    if (npub.startsWith('npub1')) {
        try {
            if (!window.NostrTools) {
                await new Promise(function(resolve, reject) {
                    var script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/npm/nostr-tools@1.17.0/lib/nostr.bundle.js';
                    script.integrity = 'sha384-GwmNxV/GnZt+zRBR/Hhtu5D4MKfbxeJSApW44ARryGYtj3MFheHMFgiEZ7tVnrln';
                    script.crossOrigin = 'anonymous';
                    script.onload = resolve;
                    script.onerror = function() { reject(new Error('Failed to load nostr-tools')); };
                    document.head.appendChild(script);
                });
            }
            var decoded = window.NostrTools.nip19.decode(npub);
            if (decoded && decoded.type === 'npub') {
                pubkey = decoded.data;
                if (typeof pubkey !== 'string') { pubkey = Array.from(new Uint8Array(pubkey)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join(''); }
            }
        } catch(e) { if (statusEl) statusEl.innerHTML = '<span style="color:#ef4444;">Invalid npub format</span>'; return; }
    }
    if (!/^[a-f0-9]{64}$/.test(pubkey)) { if (statusEl) statusEl.innerHTML = '<span style="color:#ef4444;">Invalid public key</span>'; return; }
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--accent);">Linking Nostr identity...</span>';
    try {
        if (!auth.currentUser) await auth.signInAnonymously();
        var uid = auth.currentUser.uid;
        await db.collection('users').doc(uid).set({ nostr: pubkey, lastLogin: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        if (currentUser) currentUser.nostr = pubkey;
        var overlay = document.getElementById('nostrAuthOverlay'); if (overlay) overlay.remove();
        showToast('🟣 Nostr identity linked! (npub)');
    } catch(e) { if (statusEl) statusEl.innerHTML = '<span style="color:#ef4444;">Error: ' + (e.message || 'Unknown') + '</span>'; }
};

// Complete Nostr auth - send signed event to Cloud Function for verification
window.nostrCompleteAuth = async function(pubkey, sig, event) {
    var statusEl = document.getElementById('nostrAuthStatus');
    try {
        var nostrAuth = firebase.functions().httpsCallable('nostrAuth');
        var result = await nostrAuth({ pubkey: pubkey, sig: sig, event: event });
        if (result.data && result.data.token) {
            await auth.signInWithCustomToken(result.data.token);
            var uid = result.data.uid;
            var userDoc = await db.collection('users').doc(uid).get();
            // Always patch 'created' if missing — even for returning users who already have a username
            // Fixes Nostr users who logged in before this field was written
            if (!userDoc.exists || !userDoc.data().created) {
                await db.collection('users').doc(uid).set({ created: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            }
            if (!userDoc.exists) {
                await db.collection('users').doc(uid).set(clientCreatePayload({ nostr: pubkey }), { merge: true });
                try { db.collection('stats').doc('global').set({ userCount: firebase.firestore.FieldValue.increment(1) }, { merge: true }).catch(function() {}); } catch(e) {}
            } else if (pubkey) {
                try { await db.collection('users').doc(uid).set({ nostr: pubkey }, { merge: true }); } catch (e) {}
            }
            if (!userDoc.exists || !userDoc.data() || !userDoc.data().username) {
                var npubShort = 'npub' + String(pubkey || '').replace(/[^a-f0-9]/gi, '').substring(0, 8);
                try { await applyServerUsername(npubShort); }
                catch (nameErr) { if (typeof showUsernamePrompt === 'function') showUsernamePrompt(); }
            }
            loadUser(uid); hideUsernamePrompt();
            var overlay = document.getElementById('nostrAuthOverlay'); if (overlay) overlay.remove();
            showToast('🟣 Signed in with Nostr!');
        } else { if (statusEl) statusEl.innerHTML = '<span style="color:#ef4444;">Auth failed - no token received</span>'; }
    } catch(e) {
        if (surfaceMfaRequired(e)) {
            var overlay = document.getElementById('nostrAuthOverlay');
            if (overlay) overlay.remove();
            return;
        }
        console.error('Nostr auth error:', e);
        if (statusEl) statusEl.innerHTML = '<span style="color:#ef4444;">Verification failed: ' + (e.message || 'Unknown') + '</span>';
    }
};

// Apple Sign-In removed

// Lightning (LNURL-auth) Sign-In
window.signInWithLightning = async function() {
    if (!checkRateLimit()) return;
    window._captureSignupFormState();
    // Close the sign-in modal so the LN overlay isn't buried under it
    var _um = document.getElementById('usernameModal');
    if (_um) _um.classList.remove('open');

    // Show modal immediately with loading skeleton (Cloud Function can be slow on cold start)
    var qrModal = document.createElement('div');
    qrModal.id = 'lnAuthModal';
    qrModal.style.cssText = 'position:fixed;inset:0;z-index:500000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.8);';
    qrModal.onclick = function(e) { if (e.target === qrModal) qrModal.remove(); };
    qrModal.innerHTML =
        '<div style="background:var(--bg-side,#1a1a2e);border:2px solid var(--accent);border-radius:20px;padding:28px;max-width:380px;width:90%;text-align:center;">' +
            '<div style="font-size:2rem;margin-bottom:10px;">⚡</div>' +
            '<h3 style="color:var(--heading);margin-bottom:6px;">Lightning Login</h3>' +
            '<p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:16px;">Scan this QR code with your Lightning wallet (Alby, Zeus, Phoenix, BlueWallet, etc.)</p>' +
            '<div id="lnAuthQR" style="background:#fff;padding:16px;border-radius:12px;display:inline-block;margin-bottom:16px;min-width:220px;min-height:220px;display:flex;align-items:center;justify-content:center;">' +
                '<div style="text-align:center;"><div style="width:32px;height:32px;border:3px solid #ccc;border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 8px;"></div><div style="color:#666;font-size:0.75rem;">Generating challenge...</div></div>' +
            '</div>' +
            '<div id="lnAuthCopyWrap" style="margin-bottom:12px;display:none;"></div>' +
            '<p id="lnAuthStatus" style="color:var(--text-muted);font-size:0.85rem;font-weight:600;">Connecting to server...</p>' +
            '<button onclick="document.getElementById(\'lnAuthModal\').remove()" style="margin-top:10px;padding:8px 20px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:0.85rem;cursor:pointer;font-family:inherit;">Cancel</button>' +
        '</div>';
    document.body.appendChild(qrModal);

    try {
        // Request challenge from Cloud Function
        var lnAuthChallenge = firebase.functions().httpsCallable('lnAuthChallenge');
        var challengeResult = await lnAuthChallenge();

        // Check modal still exists (user might have cancelled)
        if (!document.getElementById('lnAuthModal')) return;

        if (!challengeResult.data || !challengeResult.data.k1 || !challengeResult.data.lnurl) {
            if (typeof showToast === 'function') showToast('Failed to generate login challenge');
            qrModal.remove();
            return;
        }

        var k1 = challengeResult.data.k1;
        var lnurlEncoded = challengeResult.data.lnurl;

        // Replace loading skeleton with actual QR code
        var qrContainer = document.getElementById('lnAuthQR');
        if (qrContainer) {
            qrContainer.innerHTML = '';
            qrContainer.style.display = 'inline-block';
            if (typeof _renderQRCode === 'function') {
                _renderQRCode(qrContainer, 'lightning:' + lnurlEncoded, 220);
            } else {
                qrContainer.textContent = lnurlEncoded;
                qrContainer.style.cssText = 'word-break:break-all;font-size:0.6rem;max-width:220px;';
            }
        }

        // Show copy button now that we have the LNURL
        var copyWrap = document.getElementById('lnAuthCopyWrap');
        if (copyWrap) {
            copyWrap.style.display = 'block';
            copyWrap.textContent = '';
            var copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.textContent = 'Copy LNURL';
            copyBtn.style.cssText = 'padding:8px 16px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:16px;cursor:pointer;font-family:inherit;';
            copyBtn.addEventListener('click', function () {
                var text = String(lnurlEncoded || '');
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(function () { if (typeof showToast === 'function') showToast('Copied'); }).catch(function () {});
                }
            });
            copyWrap.appendChild(copyBtn);
        }

        // Update status
        var statusEl = document.getElementById('lnAuthStatus');
        if (statusEl) { statusEl.textContent = 'Waiting for wallet...'; statusEl.style.color = 'var(--accent)'; }

        // Poll for completion
        var lnAuthVerify = firebase.functions().httpsCallable('lnAuthVerify');
        var pollCount = 0;
        var maxPolls = 60; // 2 minutes at 2-second intervals
        var pollInterval = setInterval(async function() {
            pollCount++;
            if (pollCount > maxPolls || !document.getElementById('lnAuthModal')) {
                clearInterval(pollInterval);
                return;
            }
            try {
                var verifyResult = await lnAuthVerify({ k1: k1 });
                if (verifyResult.data && verifyResult.data.token) {
                    clearInterval(pollInterval);
                    var statusEl = document.getElementById('lnAuthStatus');
                    if (statusEl) statusEl.textContent = '✅ Authenticated!';

                    await auth.signInWithCustomToken(verifyResult.data.token);

                    // Set up user doc if needed
                    var uid = verifyResult.data.uid;
                    var userDoc = await db.collection('users').doc(uid).get();
                    if (!userDoc.exists) {
                        await db.collection('users').doc(uid).set(clientCreatePayload({}));
                        try { db.collection('stats').doc('global').set({ userCount: firebase.firestore.FieldValue.increment(1) }, { merge: true }).catch(function() {}); } catch(e) {}
                    }
                    if (!userDoc.exists || !userDoc.data() || !userDoc.data().username) {
                        var lnName = 'ln' + String(k1 || '').replace(/[^a-f0-9]/gi, '').substring(0, 8);
                        try { await applyServerUsername(lnName); }
                        catch (nameErr) { if (typeof showUsernamePrompt === 'function') showUsernamePrompt(); }
                    }

                    loadUser(uid);
                    hideUsernamePrompt();
                    setTimeout(function() {
                        var modal = document.getElementById('lnAuthModal');
                        if (modal) modal.remove();
                    }, 1000);
                    if (typeof showToast === 'function') showToast('⚡ Signed in with Lightning!');
                }
            } catch(e) {
                if (surfaceMfaRequired(e)) {
                    clearInterval(pollInterval);
                    var mfaModal = document.getElementById('lnAuthModal');
                    if (mfaModal) mfaModal.remove();
                    return;
                }
                // Not ready yet, keep polling
                if (e.code !== 'not-found') console.log('LN auth poll:', e.message);
            }
        }, 2000);

    } catch(e) {
        console.error('Lightning auth error:', e);
        if (typeof showToast === 'function') showToast('Lightning sign-in failed. Try again.');
        var modal = document.getElementById('lnAuthModal');
        if (modal) modal.remove();
    }
};

// Rate limiting check
function checkRateLimit() {
    const now = Date.now();
    if (now < signInLockout) {
        const secs = Math.ceil((signInLockout - now) / 1000);
        showToast('⏳ Too many attempts. Wait ' + secs + 's');
        return false;
    }
    signInAttempts++;
    if (signInAttempts > 5) {
        signInLockout = now + 60000; // 1 minute lockout
        signInAttempts = 0;
        showToast('⏳ Too many attempts. Please wait 60 seconds.');
        return false;
    }
    return true;
}

// Session timeout - sign out after 30 min inactivity
// Session timer removed - users stay signed in indefinitely via Firebase LOCAL persistence

// Generic provider sign-in (reused by Google, Twitter, GitHub)
function isInAppBrowser() {
    var ua = navigator.userAgent || '';
    return /FBAN|FBAV|Instagram|Twitter|Line\/|Snapchat|BytedanceWebview|musical_ly|TikTok|Weibo|MicroMessenger|LinkedInApp|Telegram/i.test(ua);
}

// Module-scope auth helpers (accessible from GIS, FB SDK, and signInWithProvider)
async function _saveAnonDataGlobal() {
    var anonUser = auth.currentUser;
    var anonUid = null, anonData = null;
    if (anonUser && anonUser.isAnonymous) {
        anonUid = anonUser.uid;
        try {
            var anonDoc = await db.collection('users').doc(anonUid).get();
            if (anonDoc.exists) anonData = anonDoc.data();
        } catch(e) {}
    }
    return { anonUid: anonUid, anonData: anonData };
}

async function _handleSignInResultGlobal(user, anonUid, anonData) {
    // Pick up all fields the user may have typed in the sign-up form before hitting a provider button.
    var _pendingLn      = localStorage.getItem('btc_pending_ln_address') || '';
    var _pendingUN      = localStorage.getItem('btc_pending_username')   || '';
    var _pendingFaction = localStorage.getItem('btc_pending_faction')    || window._signupFaction || '';
    var _pendingCountry = localStorage.getItem('btc_pending_country')    || '';
    // Clean up so they don't leak into future sign-ins
    localStorage.removeItem('btc_pending_ln_address');
    localStorage.removeItem('btc_pending_faction');
    localStorage.removeItem('btc_pending_country');
    window._signupFaction = null;

    var existingDoc = await db.collection('users').doc(user.uid).get();
    if (!existingDoc.exists) {
        var _provExtra = {};
        var _provLn = normalizeClientLn(_pendingLn);
        if (clientLnValid(_provLn)) { _provExtra.lightning = _provLn; _provExtra.lightningAddress = _provLn; }
        if (_pendingCountry) _provExtra.country = _pendingCountry;
        await db.collection('users').doc(user.uid).set(clientCreatePayload(_provExtra));
        if (_pendingFaction) {
            try { await flushSignupFaction(_pendingFaction); } catch (e) {}
        }
        var _nameTry = _pendingUN || '';
        if (_nameTry) {
            try { await applyServerUsername(_nameTry); }
            catch (nameErr) {
                showToast(nameErr.message || 'Pick a different username.');
                if (typeof showUsernamePrompt === 'function') showUsernamePrompt();
            }
        } else if (typeof showUsernamePrompt === 'function') {
            showUsernamePrompt();
        }
    } else {
        // Returning user - apply fields they typed only if not already set
        var _returnUpdates = {};
        var _returnLn = normalizeClientLn(_pendingLn);
        if (clientLnValid(_returnLn) && !existingDoc.data().lightningAddress && !existingDoc.data().lightning) {
            _returnUpdates.lightning = _returnLn;
            _returnUpdates.lightningAddress = _returnLn;
        }
        if (_pendingCountry && !existingDoc.data().country) {
            _returnUpdates.country = _pendingCountry;
        }
        if (Object.keys(_returnUpdates).length) {
            try { await existingDoc.ref.update(_returnUpdates); } catch(e) {}
        }
        if (_pendingFaction && !existingDoc.data().faction) {
            try { await flushSignupFaction(_pendingFaction); } catch (e) {}
        }
    }
    var guestHold = false;
    if (typeof tryLinkGuest === 'function') {
        try { if (await tryLinkGuest() === 'mfa') guestHold = true; } catch (e) {}
    }
    if (anonUid && anonUid !== user.uid && !guestHold) {
        try { await db.collection('users').doc(anonUid).delete(); } catch(e) {}
    }
    loadUser(user.uid);
    if (!existingDoc.exists) {
        if (typeof attachReferral === 'function') attachReferral(user.uid);
        showToast('Welcome. You are signed in.');
    } else {
        hideUsernamePrompt();
        showToast('You are signed in.');
    }
}

// Show the in-app browser sign-in modal: magic link works inline; OAuth needs real browser
window._showIABSignInModal = function() {
    if (document.getElementById('_iabSignInModal')) return;
    var _ua = navigator.userAgent || '';
    var _isAndroid = /Android/i.test(_ua);
    var _isIOS = /iPhone|iPad/i.test(_ua);
    var _currentUrl = window.location.href;
    // Android intent:// deep link - forces Chrome/system browser to open the URL directly
    var _intentUrl = _isAndroid
        ? 'intent://' + _currentUrl.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;end'
        : null;
    var _openBtnHtml = _isAndroid
        ? '<a href="' + _intentUrl + '" style="display:block;width:100%;padding:12px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;text-decoration:none;font-size:0.9rem;box-sizing:border-box;text-align:center;margin-bottom:8px;">🌐 Open in Chrome</a>'
        : '';
        var _hint = _isIOS ? 'Tap the share icon (↑) → "Open in Safari"'
        : _isAndroid ? 'Tap ⋮ (menu) → "Open in Browser"'
        : 'Open this page in your default browser';

    var _modal = document.createElement('div');
    _modal.id = '_iabSignInModal';
    _modal.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.85);padding:0;';
    _modal.innerHTML =
        '<div id="_iabSignInBox" style="background:var(--bg-side,#1a1a2e);border-top:2px solid var(--accent);border-radius:24px 24px 0 0;padding:28px 24px 36px;max-width:440px;width:100%;max-height:90vh;overflow-y:auto;">' +
            '<div style="text-align:center;margin-bottom:20px;">' +
                '<div style="font-size:2.2rem;margin-bottom:8px;">₿</div>' +
                '<h3 style="color:var(--heading);font-size:1.1rem;font-weight:900;margin:0 0 6px;">Create Your Account</h3>' +
                '<p style="color:var(--text-muted);font-size:0.8rem;margin:0;line-height:1.5;">Use email sign-in below - it works right here.<br>Or open in your browser for Google/Twitter.</p>' +
            '</div>' +
            // Magic link section - works inside any IAB
            '<div style="background:rgba(247,147,26,0.07);border:1px solid rgba(247,147,26,0.25);border-radius:14px;padding:16px;margin-bottom:16px;">' +
                '<div style="font-size:0.78rem;font-weight:800;color:var(--accent);margin-bottom:10px;">✉️ Sign up / Sign in with Email</div>' +
                '<div style="display:flex;gap:8px;">' +
                    '<input id="_iabEmailInput" type="email" placeholder="your@email.com" autocomplete="email" style="flex:1;padding:11px 14px;background:var(--card-bg,#111);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;font-family:inherit;outline:none;box-sizing:border-box;">' +
                    '<button id="_iabSendBtn" onclick="window._iabSendMagicLink()" style="padding:11px 16px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.85rem;white-space:nowrap;">Send Link</button>' +
                '</div>' +
                '<div id="_iabEmailStatus" style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;min-height:18px;">We\'ll email you a one-tap sign-in link.</div>' +
            '</div>' +
            // Divider
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">' +
                '<div style="flex:1;height:1px;background:var(--border);"></div>' +
                '<span style="font-size:0.72rem;color:var(--text-faint);">OR open in your browser for Google/Twitter</span>' +
                '<div style="flex:1;height:1px;background:var(--border);"></div>' +
            '</div>' +
            // Open in browser buttons
            _openBtnHtml +
            '<button onclick="(function(){var url=window.location.href;if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(url).then(function(){if(typeof showToast===\'function\')showToast(\'📋 Link copied! Paste in your browser.\');}).catch(function(){});}else{var ta=document.createElement(\'textarea\');ta.value=url;document.body.appendChild(ta);ta.select();try{document.execCommand(\'copy\');}catch(e){}document.body.removeChild(ta);if(typeof showToast===\'function\')showToast(\'📋 Link copied!\');}})()" style="width:100%;padding:12px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.3);border-radius:10px;color:var(--accent);font-weight:700;cursor:pointer;font-family:inherit;font-size:0.9rem;margin-bottom:8px;">📋 Copy Link</button>' +
            '<p style="font-size:0.72rem;color:var(--text-faint);text-align:center;margin:0 0 12px;">' + _hint + '</p>' +
            '<button onclick="document.getElementById(\'_iabSignInModal\').remove()" style="width:100%;padding:10px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text-muted);cursor:pointer;font-family:inherit;font-size:0.85rem;">Close</button>' +
        '</div>';
    document.body.appendChild(_modal);
    // Allow tap-on-backdrop to dismiss
    _modal.addEventListener('click', function(e) { if (e.target === _modal) _modal.remove(); });
    // Focus email input
    setTimeout(function() {
        var inp = document.getElementById('_iabEmailInput');
        if (inp) inp.focus();
    }, 100);
};

window._iabSendMagicLink = async function() {
    var input = document.getElementById('_iabEmailInput');
    var btn = document.getElementById('_iabSendBtn');
    var status = document.getElementById('_iabEmailStatus');
    if (!input) return;
    var email = input.value.trim();
    if (!email || !email.includes('@')) {
        if (status) status.innerHTML = '<span style="color:#ef4444;">Please enter a valid email address.</span>';
        if (input) input.style.borderColor = '#ef4444';
        return;
    }
    input.disabled = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
    if (status) status.innerHTML = '<span style="color:var(--accent);">Sending magic link...</span>';
    window._captureSignupFormState && window._captureSignupFormState();
    var sent = await sendMagicLink(email);
    if (sent) {
        if (status) status.innerHTML = '<span style="color:#22c55e;">✅ Check your email! Tap the link to sign in.</span>';
        if (btn) { btn.textContent = '✅ Sent!'; }
        if (input) input.style.borderColor = '#22c55e';
    } else {
        if (status) status.innerHTML = '<span style="color:#ef4444;">Could not send - check your email address.</span>';
        input.disabled = false;
        if (btn) { btn.disabled = false; btn.textContent = 'Send Link'; }
        if (input) input.style.borderColor = '#ef4444';
    }
};

function rememberAnonForRedirect(anonUser) {
    if (!anonUser || !anonUser.isAnonymous) return;
    localStorage.setItem('btc_anon_uid', anonUser.uid);
    db.collection('users').doc(anonUser.uid).get().then(function(doc) {
        if (doc.exists) localStorage.setItem('btc_anon_data', JSON.stringify(doc.data()));
    }).catch(function() {});
}

async function linkOrSignInPopup(provider) {
    var guest = auth.currentUser;
    if (guest && guest.isAnonymous && typeof guest.linkWithPopup === 'function') {
        try {
            var linked = await guest.linkWithPopup(provider);
            try { localStorage.removeItem('btc_guest_link'); } catch (e0) {}
            await _handleSignInResultGlobal(linked.user, null, null);
            return linked.user;
        } catch (linkErr) {
            if ((linkErr.code === 'auth/credential-already-in-use' || linkErr.code === 'auth/email-already-in-use') && linkErr.credential) {
                var signed = await auth.signInWithCredential(linkErr.credential);
                await _handleSignInResultGlobal(signed.user, guest.uid, null);
                return signed.user;
            }
            throw linkErr;
        }
    }
    var result = await auth.signInWithPopup(provider);
    await _handleSignInResultGlobal(result.user, null, null);
    return result.user;
}

async function redirectForProvider(provider) {
    var anonUser = auth.currentUser;
    rememberAnonForRedirect(anonUser);
    sessionStorage.setItem('btc_redirect_pending', '1');
    localStorage.setItem('btc_pwa_auth_pending', '1');
    if (anonUser && anonUser.isAnonymous && typeof anonUser.linkWithRedirect === 'function') {
        await anonUser.linkWithRedirect(provider);
        return;
    }
    await auth.signInWithRedirect(provider);
}

async function signInWithProvider(provider) {
    if (!checkRateLimit()) return;

    // In-app browsers can't do OAuth popups/redirects - show IAB-aware modal instead
    if (isInAppBrowser()) {
        window._showIABSignInModal();
        return;
    }

    // Strategy: Use popup on desktop (reliable), redirect on mobile/PWA.
    // Redirect loses session cross-domain but at least shows the Google sign-in page.
    // Popup on Android PWA causes redirect_uri_mismatch errors.
    var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    // Safari on desktop blocks popup postMessage via ITP — must use redirect
    var isSafariBrowser = /^((?!chrome|android).)*safari/i.test(navigator.userAgent || '');

    // Android Chrome handles popups fine (no ITP) - only iOS Safari needs redirect
    var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    if (isStandalone || isSafariBrowser || isIOS) {
        // Safari/iOS blocks popup postMessage via ITP - skip popup entirely and go straight to redirect.
        try {
            showToast('⏳ Opening sign-in...');
            await redirectForProvider(provider);
            return;
        } catch(e) {
            console.error('Mobile/Safari sign-in error:', e);
            showToast('Sign-in failed: ' + (e.message || 'Unknown error'));
            return;
        }
    }

    // Desktop: link the guest in place, then fall back to a popup sign-in.
    // Nothing is awaited before the popup, so the browser still allows it.
    try {
        await linkOrSignInPopup(provider);
    } catch(e) {
        console.error('Provider sign-in error:', e.code, e.message, e);

        // MFA required - user has phone 2FA enabled. Do not fall through to redirect.
        if (surfaceMfaRequired(e)) return;

        // Popup blocked, closed, or failed - fallback to redirect
        if (e.code === 'auth/popup-blocked' ||
            e.code === 'auth/cancelled-popup-request' ||
            e.code === 'auth/popup-closed-by-user' ||
            e.code === 'auth/internal-error') {
            try {
                showToast('⏳ Opening sign-in page...');
                await redirectForProvider(provider);
                return;
            } catch(redirectErr) {
                console.error('Redirect fallback also failed:', redirectErr);
                showToast('Sign-in failed. Please try a different browser.');
            }
            return;
        }

        // User intentionally closed popup - do nothing
        if (e.code === 'auth/popup-closed-by-user') return;

        var providerMsg = googleSignInErrorMessage(e);
        if (providerMsg) showToast(providerMsg);
    }
}

// Returning user: send magic link to sign back in
// ── "Trouble signing in?" dedicated recovery modal ───────────────────────
// Surfaces prominently below the sign-in form. Separate from the inline
// returningEmailInput so it's always findable even when buried under the
// sign-up fields.
window.showTroubleSigningIn = function() {
    var existing = document.getElementById('troubleSignInModal');
    if (existing) { existing.remove(); return; }

    var overlay = document.createElement('div');
    overlay.id = 'troubleSignInModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:600000;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML =
        '<div style="background:var(--bg-side,#0f0f1a);border:1px solid var(--border);border-radius:20px;padding:32px 24px;max-width:360px;width:100%;text-align:center;">' +
        '<div style="font-size:2.5rem;margin-bottom:8px;">🔑</div>' +
        '<div style="color:var(--heading,#fff);font-size:1.2rem;font-weight:800;margin-bottom:6px;">Trouble signing in?</div>' +
        '<div style="color:var(--text-muted,#aaa);font-size:0.875rem;line-height:1.5;margin-bottom:20px;">No worries — no password needed.<br>Enter your email and we\'ll send a fresh sign-in link instantly.</div>' +
        '<input type="email" id="troubleSignInEmail" placeholder="your@email.com" maxlength="100" autocomplete="email" onkeydown="if(event.key===\'Enter\')window._submitTroubleSignIn()" style="font-size:16px;padding:14px 18px;width:100%;background:var(--input-bg,#020617);border:1px solid var(--border);border-radius:10px;color:var(--text,#fff);font-family:inherit;outline:none;box-sizing:border-box;margin-bottom:10px;">' +
        '<button id="troubleSignInBtn" onclick="window._submitTroubleSignIn()" style="width:100%;padding:13px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;border:none;border-radius:10px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:8px;">📧 Send Sign-In Link</button>' +
        '<div id="troubleSignInStatus" style="font-size:0.8rem;min-height:20px;color:var(--text-muted);"></div>' +
        '<button onclick="document.getElementById(\'troubleSignInModal\').remove()" style="margin-top:12px;background:none;border:none;color:var(--text-faint);font-size:0.8rem;cursor:pointer;font-family:inherit;">Close</button>' +
        '</div>';

    document.body.appendChild(overlay);
    setTimeout(function() {
        var inp = document.getElementById('troubleSignInEmail');
        if (inp) inp.focus();
    }, 100);
};

window._submitTroubleSignIn = async function() {
    var input  = document.getElementById('troubleSignInEmail');
    var btn    = document.getElementById('troubleSignInBtn');
    var status = document.getElementById('troubleSignInStatus');
    if (!input) return;
    var email = input.value.trim();
    if (!email || !email.includes('@') || !email.includes('.')) {
        if (status) status.innerHTML = '<span style="color:#ef4444;">Please enter a valid email address.</span>';
        input.style.borderColor = '#ef4444';
        return;
    }
    input.style.borderColor = '';
    input.disabled = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
    if (status) status.innerHTML = '<span style="color:var(--accent);">Sending your link...</span>';

    var sent = await sendMagicLink(email);
    if (sent) {
        if (btn) btn.textContent = '✅ Link sent!';
        if (status) status.innerHTML = '<span style="color:#22c55e;">Check your inbox — tap the link to sign in. Check spam if you don\'t see it.</span>';
        // Auto-close after 4s
        setTimeout(function() {
            var m = document.getElementById('troubleSignInModal');
            if (m) m.remove();
        }, 4000);
    } else {
        input.disabled = false;
        if (btn) { btn.disabled = false; btn.textContent = '📧 Send Sign-In Link'; }
        if (status) status.innerHTML = '<span style="color:#ef4444;">Couldn\'t send — check the email and try again.</span>';
    }
};

window.sendReturningMagicLink = async function() {
    window._captureSignupFormState();
    var input = document.getElementById('returningEmailInput');
    if (!input) return;
    var email = input.value.trim();
    if (!email || !email.includes('@')) {
        showToast('📧 Please enter a valid email address');
        if (input) input.style.borderColor = '#ef4444';
        return;
    }
    input.disabled = true;
    var btn = input.nextElementSibling;
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
    var sent = await sendMagicLink(email);
    if (sent) {
        showToast('📧 Magic link sent! Check your email to sign in.');
        if (btn) btn.textContent = '✅ Sent!';
        hideUsernamePrompt();
    } else {
        showToast('❌ Could not send magic link. Try again.');
        input.disabled = false;
        if (btn) { btn.disabled = false; btn.textContent = 'Send Link'; }
    }
};

// Send magic link email
async function sendMagicLink(email) {
    const actionCodeSettings = {
        // Embed email in URL so it works even when opened on a different device/browser
        url: window.location.origin + window.location.pathname + '?signin_email=' + encodeURIComponent(email),
        handleCodeInApp: true,
    };
    try {
        await auth.sendSignInLinkToEmail(email, actionCodeSettings);
        localStorage.setItem('btc_signin_email', email);
        return true;
    } catch(e) {
        console.log('Magic link error:', e);
        return false;
    }
}

// Load anonymous user from localStorage only - no Firestore reads
function loadUserLocal(uid) {
    var localPoints = parseInt(localStorage.getItem('btc_points') || '0');
    var localChannels = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]');
    currentUser = {
        uid: uid,
        points: localPoints,
        channelsVisited: localChannels.length,
        readChannels: localChannels,
        totalVisits: parseInt(localStorage.getItem('btc_total_visits') || '1'),
        streak: parseInt(localStorage.getItem('btc_streak') || '0'),
        lastVisit: localStorage.getItem('btc_last_visit') || '',
        _isLocal: true  // Flag: this user has no Firestore doc yet
    };
    rankingReady = true;
    window._badgesReady = true;
    if (typeof markVisibleBadgesReady === 'function') markVisibleBadgesReady(); window._hiddenBadgesReady = true;
    restoreVisitedUI();
    updateRankUI();
    _checkCapOnLoad();
    updateAuthButton();
    if (typeof renderProgressRings === 'function') renderProgressRings();
    if (typeof renderExplorationMap === 'function') renderExplorationMap();
    if (typeof renderUserWorldMap === 'function') renderUserWorldMap();
    startReadTimer();
}

async function loadUser(uid, prefetchedDoc) {
    const doc = prefetchedDoc || await db.collection('users').doc(uid).get();
    // Resolve admin status from custom claim (not email allowlist)
    try {
        if (auth.currentUser && !auth.currentUser.isAnonymous) {
            const tokenResult = await auth.currentUser.getIdTokenResult(true); // forceRefresh — stale token won't carry admin claim
            window._isAdminClaim = tokenResult.claims.admin === true;
        } else {
            window._isAdminClaim = false;
        }
    } catch(e) { window._isAdminClaim = false; }
    // Re-render chat messages now that admin claim is resolved.
    // Firestore's onSnapshot often fires from cache before loadUser() finishes,
    // so own messages render with isAdmin=false and miss the pin button.
    if (window._isAdminClaim && window._chatAllMsgs && typeof renderChatMessages === 'function') {
        renderChatMessages(window._chatAllMsgs);
    }
    if (doc.exists) {
        currentUser = { uid, ...doc.data() };
        // Cache profile for instant next-load
        try { localStorage.setItem('btc_profile_cache', JSON.stringify({ uid, ts: Date.now(), data: doc.data() })); } catch(e) {}
        // TOS check — show acceptance modal if user hasn't accepted current version
        if (!auth.currentUser.isAnonymous && currentUser.tosVersion !== TOS_CURRENT_VERSION) {
            _showTosModal();
        }

        // Authenticator gate. The server, not a localStorage flag, decides.
        // Phone sign-in is enforced by Firebase before we get here.
        if (!auth.currentUser.isAnonymous) {
            var gateOpen = await window._serverTotpAllows(auth.currentUser.uid);
            if (!gateOpen) {
                _showTotpSignInChallenge();
                return;
            }
            if (window._emailSyncUid !== uid) {
                window._emailSyncUid = uid;
                try {
                    await syncAccountEmailFromAuth();
                } catch (syncErr) {
                    window._emailSyncUid = null;
                }
            }
        }
        window._myPeers = new Set(currentUser.peers || []);
        // Restore visited channels so we don't re-award
        if (currentUser.visitedChannelsList) {
            currentUser.visitedChannelsList.forEach(ch => allTimeChannels.add(ch));
        }

        const isRealUser = auth.currentUser && !auth.currentUser.isAnonymous;

        // Sync read checkmarks: for real users, use Firebase as source of truth
        // visitedChannelsList is the authoritative field (written by awardPoints CF via arrayUnion)
        // readChannels is the legacy field - union both for backward compat
        var _fbRead = [...new Set([
            ...(Array.isArray(currentUser.visitedChannelsList) ? currentUser.visitedChannelsList : []),
            ...(Array.isArray(currentUser.readChannels) ? currentUser.readChannels : [])
        ])];
        if (_fbRead.length > 0) {
            if (isRealUser) {
                localStorage.setItem('btc_visited_channels', JSON.stringify(_fbRead));
            } else {
                let local = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]');
                let merged = [...new Set([...local, ..._fbRead])];
                localStorage.setItem('btc_visited_channels', JSON.stringify(merged));
            }
            restoreVisitedUI();
        } else if (isRealUser) {
            // Real user with nothing in Firebase yet - clear local
            localStorage.setItem('btc_visited_channels', '[]');
            restoreVisitedUI();
        }

        // Sync spinCount: take the max of Firebase and localStorage so badge dedup
        // survives cache clears, new devices, and early-fire race conditions.
        if (isRealUser && currentUser.spinCount) {
            var _lsSpinCount = parseInt(localStorage.getItem('btc_spin_count') || '0');
            var _mergedSpinCount = Math.max(_lsSpinCount, currentUser.spinCount);
            if (_mergedSpinCount !== _lsSpinCount) {
                localStorage.setItem('btc_spin_count', String(_mergedSpinCount));
            }
        }

        // Sync favorites: for real users, use Firebase as source of truth
        if (currentUser.favorites) {
            if (isRealUser) {
                localStorage.setItem('btc_favs', JSON.stringify(currentUser.favorites));
            } else {
                let localFavs = JSON.parse(localStorage.getItem('btc_favs') || '[]');
                let mergedFavs = [...new Set([...localFavs, ...currentUser.favorites])];
                localStorage.setItem('btc_favs', JSON.stringify(mergedFavs));
            }
            if (typeof renderFavs === 'function') renderFavs();
        } else if (isRealUser) {
            localStorage.setItem('btc_favs', '[]');
            if (typeof renderFavs === 'function') renderFavs();
        }
        // Sync bookmarks: for real users, use Firebase as source of truth
        if (currentUser.bookmarks) {
            if (isRealUser) {
                localStorage.setItem('btc_bookmarks', JSON.stringify(currentUser.bookmarks));
            } else {
                let localBm = JSON.parse(localStorage.getItem('btc_bookmarks') || '[]');
                let mergedBm = currentUser.bookmarks.concat(localBm.filter(function(b) {
                    return !currentUser.bookmarks.some(function(fb) { return fb.channel === b.channel && fb.idx === b.idx; });
                }));
                localStorage.setItem('btc_bookmarks', JSON.stringify(mergedBm));
            }
            if (typeof renderFavs === 'function') renderFavs();
        } else if (isRealUser) {
            // No bookmarks in Firebase yet - push local ones up if any exist
            var _localBm = JSON.parse(localStorage.getItem('btc_bookmarks') || '[]');
            if (_localBm.length > 0 && db && auth.currentUser) {
                db.collection('users').doc(auth.currentUser.uid).update({ bookmarks: _localBm }).catch(function() {});
            }
        }

        // Cache username in localStorage for PVP and other modules
        if (currentUser.username) {
            localStorage.setItem('btc_username', currentUser.username);
        }

        // One-time migration: set bestStreak if not present (now handled by recordDailyVisit CF)
        if (currentUser.streak > 0 && !currentUser.bestStreak) {
            currentUser.bestStreak = currentUser.streak;
        }

        rankingReady = true;
        updateRankUI();
        if (typeof renderProgressRings === 'function') renderProgressRings();
        awardVisitPoints();
        startReadTimer();

        // Restore flex completions from server (signed-in users only)
        if (isRealUser && typeof window._flexRestoreFromServer === 'function') {
            window._flexRestoreFromServer(uid);
        }

        // Update high-res lastActive timestamp for DAU tracking
        if (!auth.currentUser.isAnonymous) {
            db.collection('users').doc(uid).update({
                lastActive: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(function() {});
        }

        // Restore badges and scholar status from Firebase
        if (isRealUser) {
            if (currentUser.hiddenBadges) {
                // Merge Firebase hidden badges into localStorage (don't replace - avoids losing locally-earned badges)
                var existingHidden = JSON.parse(localStorage.getItem('btc_hidden_badges') || '[]');
                var mergedHidden = [...new Set([...existingHidden, ...currentUser.hiddenBadges])];
                localStorage.setItem('btc_hidden_badges', JSON.stringify(mergedHidden));
            }
            // Merge donation badges (awarded server-side by donatePoints CF)
            if (currentUser.donationBadges && currentUser.donationBadges.length > 0) {
                var existingHidden2 = JSON.parse(localStorage.getItem('btc_hidden_badges') || '[]');
                var mergedHidden2 = [...new Set([...existingHidden2, ...currentUser.donationBadges])];
                localStorage.setItem('btc_hidden_badges', JSON.stringify(mergedHidden2));
            }
            if (currentUser.visibleBadges) {
                // Merge Firebase badges into localStorage
                var existing = JSON.parse(localStorage.getItem('btc_badges') || '[]');
                var merged = [...new Set([...existing, ...currentUser.visibleBadges])];
                localStorage.setItem('btc_badges', JSON.stringify(merged));
            }
            // Mark onboarding complete for existing users on new devices.
            // An existing user has a username in Firestore - they clearly already onboarded.
            // This prevents the onboarding wizard from firing on every new device login.
            if (currentUser.username || currentUser.introSeen) {
                try {
                    localStorage.setItem('btc_onboarding_done', 'true');
                    localStorage.setItem('btc_intro_seen', '1');
                } catch(e) {}
            }
            if (typeof tryLinkGuest === 'function') { tryLinkGuest().catch(function () {}); }
            if (typeof window.flushOnboardingClaims === 'function') window.flushOnboardingClaims();
            // Restore SF window streak from Firestore so speed boost survives new-device login
            if (typeof currentUser.sfWindowStreak === 'number') {
                try { localStorage.setItem('btc_sf_window_streak', String(currentUser.sfWindowStreak)); } catch(e) {}
            }
            // Restore Nacho Quest state from Firestore so mid-quest progress survives new-device login
            if (currentUser.nachoQuestDone || (currentUser.onboardingQuest && currentUser.onboardingQuest.complete)) {
                try {
                    localStorage.setItem('btc_onboarding_quest_done', '1');
                    localStorage.removeItem('btc_onboarding_active');
                } catch(e) {}
            } else if (currentUser.nachoQuestActive && typeof currentUser.nachoQuestStep === 'number') {
                // Quest is in progress - restore step so they resume where they left off
                try {
                    localStorage.setItem('btc_onboarding_active', '1');
                    localStorage.setItem('btc_onboarding_step', String(currentUser.nachoQuestStep));
                } catch(e) {}
                // Resume quest UI now that state is restored (init() already ran before auth settled)
                setTimeout(function() {
                    if (typeof window.isNachoQuestActive === 'function' && window.isNachoQuestActive() &&
                        typeof window.isNachoQuestDone === 'function' && !window.isNachoQuestDone()) {
                        if (typeof window._showNachoQuestPill === 'function') window._showNachoQuestPill();
                        if (typeof window.startNachoQuestDetection === 'function') window.startNachoQuestDetection();
                    }
                }, 1000);
            }

            if (currentUser.spinClosetItems) {
                var existingItems = JSON.parse(localStorage.getItem('btc_spin_closet_items') || '[]');
                var mergedItems = [...new Set([...existingItems, ...currentUser.spinClosetItems])];
                localStorage.setItem('btc_spin_closet_items', JSON.stringify(mergedItems));
            }
            if (typeof window.refreshScholarFromProfile === 'function') window.refreshScholarFromProfile(currentUser);
            // Restore milestone/celebration state from Firestore (prevents re-triggering)
            if (currentUser.nachoMilestones) {
                localStorage.setItem('btc_nacho_q_milestones', JSON.stringify(currentUser.nachoMilestones));
            }
            if (currentUser.celebratedState) {
                var cs = currentUser.celebratedState;
                if (cs.nachoMilestones) localStorage.setItem('btc_nacho_milestones', JSON.stringify(cs.nachoMilestones));
                if (cs.nachoCatComplete) localStorage.setItem('btc_nacho_cat_complete', JSON.stringify(cs.nachoCatComplete));
                if (cs.nachoLevelCelebrated) localStorage.setItem('btc_nacho_level_celebrated', JSON.stringify(cs.nachoLevelCelebrated));
                if (cs.nachoItemsNotified) localStorage.setItem('btc_nacho_items_notified', JSON.stringify(cs.nachoItemsNotified));
            }
            // Restore Nacho interaction counts - use max of Firebase vs localStorage
            if (currentUser.nachoInteractions) {
                var localInteractions = parseInt(localStorage.getItem('btc_nacho_interactions') || '0');
                var fbInteractions = currentUser.nachoInteractions || 0;
                localStorage.setItem('btc_nacho_interactions', Math.max(localInteractions, fbInteractions).toString());
            }
            if (currentUser.nachoQuestions) {
                var localQuestions = parseInt(localStorage.getItem('btc_nacho_questions') || '0');
                var fbQuestions = currentUser.nachoQuestions || 0;
                localStorage.setItem('btc_nacho_questions', Math.max(localQuestions, fbQuestions).toString());
            }

            // ── Badge counter sync (bidirectional: local ↔ Firestore) ─────────────────
            // Syncs the ~30 localStorage counters that badge checks read but that were
            // previously never persisted to Firestore. On a new device they're empty,
            // causing badges to vanish until the user re-performs the actions.
            // Strategy: max-merge numeric (take higher), min-merge best hash,
            // any-true-wins for booleans, union for arrays.
            // Fire-and-forget push: only writes fields where local > server.
            (function() {
                var _bc = (currentUser.badgeCounters && typeof currentUser.badgeCounters === 'object')
                    ? currentUser.badgeCounters : {};
                var _bcPatch = {};

                // Generic numeric max-merge helper
                function _syncNum(lsKey, bcKey) {
                    var local = parseInt(localStorage.getItem(lsKey) || '0') || 0;
                    var server = parseInt(_bc[bcKey] || '0') || 0;
                    var merged = Math.max(local, server);
                    if (merged > local) localStorage.setItem(lsKey, String(merged));
                    if (merged > server) _bcPatch['badgeCounters.' + bcKey] = merged;
                }

                // Boolean any-true-wins helper (localStorage value is a string like 'true')
                function _syncFlag(lsKey, bcKey, lsVal) {
                    var local = localStorage.getItem(lsKey) === lsVal;
                    var server = !!_bc[bcKey];
                    if (local || server) {
                        if (!local) localStorage.setItem(lsKey, lsVal);
                        if (!server) _bcPatch['badgeCounters.' + bcKey] = true;
                    }
                }

                // Numeric counters
                _syncNum('btc_chat_msgs',              'chatMsgs');
                _syncNum('btc_tctv_watch_time',        'tctvWatchTime');
                _syncNum('btc_tctv_channel_switches',  'tctvChannelSwitches');
                _syncNum('btc_dj_sets',               'djSets');
                _syncNum('btc_dj_songs',              'djSongs');
                _syncNum('btc_dj_listens',            'djListens');
                _syncNum('btc_beats_uploads',         'beatsUploads');
                _syncNum('btc_beats_play_count',      'beatsPlayCount');
                _syncNum('btc_tips_sent',             'tipsSent');
                _syncNum('btc_tips_total_sats',       'tipsTotalSats');
                _syncNum('btc_tips_received',         'tipsReceived');
                _syncNum('btc_sf_hashes',             'sfHashes');
                _syncNum('btc_sf_activations',        'sfActivations');
                _syncNum('btc_sf_lucky_count',        'sfLuckyCount');
                _syncNum('btc_sf_unlucky_count',      'sfUnluckyCount');
                _syncNum('btc_raid_bosses_defeated',  'raidBossesDefeated');
                _syncNum('btc_spin_streak',           'spinStreak');
                _syncNum('btc_chat_reactions',        'chatReactions');
                _syncNum('btc_dms_sent',              'dmsSent');
                _syncNum('btc_irl_attended',          'irlAttended');
                _syncNum('btc_irl_hosted',            'irlHosted');

                // Best hash: min-merge (lower is better)
                var _lsBestHash  = parseInt(localStorage.getItem('btc_sf_best_hash') || '999999999') || 999999999;
                var _fbBestHash  = parseInt(_bc.sfBestHash || '999999999') || 999999999;
                var _mergedBest  = Math.min(_lsBestHash, _fbBestHash);
                if (_mergedBest < _lsBestHash) localStorage.setItem('btc_sf_best_hash', String(_mergedBest));
                if (_mergedBest < _fbBestHash) _bcPatch['badgeCounters.sfBestHash'] = _mergedBest;

                // Boolean flags (any true wins)
                _syncFlag('btc_sf_solved_block',     'sfSolvedBlock',      'true');
                _syncFlag('btc_spin_hit_rare',        'spinHitRare',        'true');
                _syncFlag('btc_lightning_setup',      'lightningSetup',     'true');
                _syncFlag('btc_fp_completed',         'fpCompleted',        'true');
                _syncFlag('btc_nacho_eli5',           'nachoEli5',          'true');
                _syncFlag('btc_nacho_story_awarded',  'nachoStoryAwarded',  'true');

                // Trail array: union of local + server
                try {
                    var _lsTrails    = JSON.parse(localStorage.getItem('btc_trail_passed') || '[]');
                    var _fbTrails    = Array.isArray(_bc.trailsPassed) ? _bc.trailsPassed : [];
                    var _allTrails   = [...new Set([..._lsTrails, ..._fbTrails])];
                    if (_allTrails.length > _lsTrails.length) {
                        localStorage.setItem('btc_trail_passed', JSON.stringify(_allTrails));
                    }
                    if (_allTrails.length > _fbTrails.length) {
                        _bcPatch['badgeCounters.trailsPassed'] = _allTrails;
                    }
                } catch(e) {}

                // Beats liked: store count; on new device restore a count-only sentinel
                // (we can't restore the exact liked track IDs, but badge checks use .length)
                try {
                    var _lsLiked = JSON.parse(localStorage.getItem('btc_beats_liked') || '[]');
                    var _fbLikedCount = parseInt(_bc.beatsLikedCount || '0') || 0;
                    if (_lsLiked.length > _fbLikedCount) {
                        _bcPatch['badgeCounters.beatsLikedCount'] = _lsLiked.length;
                    } else if (_fbLikedCount > _lsLiked.length && _lsLiked.length === 0) {
                        // New device with no likes recorded — restore count as placeholder entries
                        // so badge checks (array.length >= N) still evaluate correctly.
                        var _restored = [];
                        for (var _i = 0; _i < _fbLikedCount; _i++) _restored.push('__restored__');
                        localStorage.setItem('btc_beats_liked', JSON.stringify(_restored));
                    }
                } catch(e) {}

                // Market saved: same pattern
                try {
                    var _lsMarket = JSON.parse(localStorage.getItem('btc_market_saved') || '[]');
                    var _fbMarketCount = parseInt(_bc.marketSavedCount || '0') || 0;
                    if (_lsMarket.length > _fbMarketCount) {
                        _bcPatch['badgeCounters.marketSavedCount'] = _lsMarket.length;
                    } else if (_fbMarketCount > _lsMarket.length && _lsMarket.length === 0) {
                        var _restoredMarket = [];
                        for (var _j = 0; _j < _fbMarketCount; _j++) _restoredMarket.push('__restored__');
                        localStorage.setItem('btc_market_saved', JSON.stringify(_restoredMarket));
                    }
                } catch(e) {}

                // Push any counters where local > server (fire-and-forget, non-fatal)
                if (Object.keys(_bcPatch).length > 0) {
                    /* badgeCounters is server-owned */
                }
            })();
        }

        // Sync PVP stats: Firestore is always source of truth (prevents cross-account bleed on same device)
        localStorage.setItem('btc_pvp_wins', String(currentUser.pvpWins || 0));
        localStorage.setItem('btc_pvp_losses', String(currentUser.pvpLosses || 0));

        // ===== LEADERBOARD REWARD LOGIN TOAST =====
        // If this user has pending leaderboard ticket rewards, show a toast + clear the flag
        if (isRealUser && Array.isArray(currentUser.pendingLeaderboardReward) && currentUser.pendingLeaderboardReward.length > 0) {
            var _pendingRewards = currentUser.pendingLeaderboardReward;
            // Clear the flag immediately so it only shows once
            db.collection('users').doc(uid).update({
                pendingLeaderboardReward: firebase.firestore.FieldValue.delete()
            }).catch(function() {});
            // Show celebration after a short delay (let the page settle)
            setTimeout(function() {
                _pendingRewards.forEach(function(reward) {
                    if (!reward || !reward.tickets) return;
                    // Big celebration modal for leaderboard wins
                    if (typeof window.showCelebration === 'function') {
                        window.showCelebration({
                            emoji: '🏆',
                            title: 'Leaderboard Winner!',
                            message: reward.reason || 'You finished in the Top 10!',
                            rewards: [{ label: reward.tickets.toLocaleString(), sub: 'ORANGE TICKETS 🎫', color: '#f7931a' }],
                            btnText: 'Claim! 🎫'
                        });
                    } else {
                        if (typeof showToast === 'function') {
                            showToast('🏆 ' + (reward.reason || 'Leaderboard reward') + ': +' + reward.tickets + ' 🎫 Orange Tickets!');
                        }
                    }
                });
            }, 2500);
        }

            // Restore Nacho nickname from Firestore
            if (currentUser.nachoNickname) {
                localStorage.setItem('btc_nacho_nickname', currentUser.nachoNickname);
                if (typeof updateNachoNameUI === 'function') updateNachoNameUI(currentUser.nachoNickname);
            }

        // Restore engagement data from Firebase (cross-device sync)
        if (isRealUser) {
            if (currentUser.lastSpinDate) {
                var localSpin = localStorage.getItem('btc_last_spin') || '';
                if (currentUser.lastSpinDate > localSpin) {
                    localStorage.setItem('btc_last_spin', currentUser.lastSpinDate);
                }
                // Sync to btc_last_spin_date using UTC ISO date - matches server format
                // (Do NOT use toDateString() - it causes timezone mismatch with server's ISO date)
                var todayUTC = new Date().toISOString().split('T')[0];
                if (currentUser.lastSpinDate === todayUTC) {
                    localStorage.setItem('btc_last_spin_date', todayUTC);
                }
                if (typeof updateSpinBanner === 'function') updateSpinBanner();
            }
            if (currentUser.prediction) {
                var localPred = localStorage.getItem('btc_prediction');
                if (!localPred) {
                    localStorage.setItem('btc_prediction', JSON.stringify(currentUser.prediction));
                }
            }
            if (currentUser.nachoStoryDays && Array.isArray(currentUser.nachoStoryDays)) {
                // Restore the days array (source of truth for chapter unlocks)
                var localDays = safeJSON('btc_nacho_story_days', []);
                // Merge: take the longer array (more days = more chapters unlocked)
                if (currentUser.nachoStoryDays.length > localDays.length) {
                    localStorage.setItem('btc_nacho_story_days', JSON.stringify(currentUser.nachoStoryDays));
                }
            }
            if (currentUser.nachoStoryProgress) {
                var localStory = parseInt(localStorage.getItem('btc_nacho_story_highest') || '0');
                if (currentUser.nachoStoryProgress > localStory) {
                    localStorage.setItem('btc_nacho_story_highest', currentUser.nachoStoryProgress.toString());
                }
            }
            if (currentUser.nachoStoryDate) {
                var localStoryDate = localStorage.getItem('btc_nacho_story_date') || '';
                if (currentUser.nachoStoryDate > localStoryDate) {
                    localStorage.setItem('btc_nacho_story_date', currentUser.nachoStoryDate);
                }
            }
        }

        // Badges are now safe to check - Firebase data has been restored
        window._badgesReady = true;
        if (typeof markVisibleBadgesReady === 'function') markVisibleBadgesReady(); window._hiddenBadgesReady = true;

        // Set current level BEFORE enabling level-up detection
        // This prevents false level-ups from 0→current on first load
        var initLv = getLevel(currentUser.points || 0);
        lastLevelName = initLv.name;
        lastLevelMin = initLv.min;
        if (!localStorage.getItem('btc_highest_level_seen')) {
            localStorage.setItem('btc_highest_level_seen', initLv.min.toString());
        }
        // Now safe to detect level-ups (initial data loaded)
        setTimeout(function() { levelUpReady = true; }, 3000);

        // Refresh exploration map and home page elements
        if (typeof renderExplorationMap === 'function') renderExplorationMap();
        if (typeof renderUserWorldMap === 'function') renderUserWorldMap();
        if (typeof showContinueReading === 'function') showContinueReading();

        // Clear a stale local name before the auth button reads it.
        maybeShowUsernameRepick();
        updateAuthButton();

        // Initialize Orange Tickets system
        if (typeof onUserLoadedTickets === 'function') onUserLoadedTickets();
        // Initialize messaging (presence + unread polling)
        if (typeof initMessaging === 'function') initMessaging();

    } else {
        // User exists in auth but not in Firestore - recreate their doc
        const user = auth.currentUser;
        if (user && !user.isAnonymous) {
            const newData = clientCreatePayload({});
            await db.collection('users').doc(uid).set(newData);
            if (typeof showUsernamePrompt === 'function') setTimeout(showUsernamePrompt, 400);
            currentUser = { uid, ...newData };
            rankingReady = true;
            window._badgesReady = true;
        if (typeof markVisibleBadgesReady === "function") markVisibleBadgesReady(); window._hiddenBadgesReady = true;
            updateRankUI();
            updateAuthButton();
        }
    }
}

// Track if button was ever set to "signed in" state - never downgrade once set
var _authBtnSignedIn = false;

function homeSignedInNow() {
    return !!_authBtnSignedIn;
}

// Strip numbers come only from server-maintained counters.
function satsHomeSnapshot(user) {
    var u = user || {};
    var math = (typeof window.claimableSats === 'function')
        ? window.claimableSats(u)
        : { balance: 0, lifetimeLeft: 0, claimable: 0, cap: lifetimeSatCap(), withdrawn: Number(u.satsWithdrawn) || 0 };
    var address = String(u.lightning || u.lightningAddress || '').trim();
    var anon = true;
    var emailOk = false;
    var ageDays = 0;
    var channels = 0;
    if (Array.isArray(u.visitedChannelsList)) channels = u.visitedChannelsList.length;
    else if (Array.isArray(u.readChannels)) channels = u.readChannels.length;
    else if (u.readChannels && typeof u.readChannels === 'object') channels = Object.keys(u.readChannels).length;
    if (typeof auth !== 'undefined' && auth && auth.currentUser) {
        var fu = auth.currentUser;
        anon = !!fu.isAnonymous;
        emailOk = !!(fu.email && fu.emailVerified);
        var created = fu.metadata && fu.metadata.creationTime ? new Date(fu.metadata.creationTime) : null;
        ageDays = created ? Math.floor((Date.now() - created.getTime()) / 86400000) : 0;
    }
    if (channels === 0) {
        try {
            var localList = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]');
            if (Array.isArray(localList) && localList.length > channels) channels = localList.length;
        } catch (e) {}
    }
    var lastClaim = u.lastSatsClaim || null;
    var onCooldown = false;
    if (lastClaim) {
        var claimMs = lastClaim.seconds ? lastClaim.seconds * 1000 : new Date(lastClaim).getTime();
        if (claimMs && Date.now() < claimMs + 24 * 60 * 60 * 1000) onCooldown = true;
    }
    var checks = [!anon, emailOk, ageDays >= 7, channels >= 10, math.claimable >= 100];
    var met = 0;
    for (var i = 0; i < checks.length; i++) if (checks[i]) met++;
    return {
        claimable: math.claimable,
        balance: math.balance,
        lifetimeLeft: math.lifetimeLeft,
        cap: math.cap,
        address: address,
        canClaim: met === checks.length && !onCooldown && !!address,
        onCooldown: onCooldown,
        checksMet: met,
        checksTotal: checks.length
    };
}
window.satsHomeSnapshot = satsHomeSnapshot;

function paintHomeStrip(snap, invited, maxi) {
    var satsEl = document.getElementById('homeSatsValue');
    var claimNow = Math.min(Number(snap.claimable) || 0, 200, Number(snap.lifetimeLeft) || 0);
    if (satsEl) satsEl.textContent = Number(snap.claimable || 0).toLocaleString();
    var invEl = document.getElementById('homeInvitesValue');
    if (invEl) invEl.textContent = String(invited || 0);
    var invNote = document.getElementById('homeInvitesNote');
    if (invNote) invNote.textContent = (Number(maxi) === 1) ? '1 reached Maxi' : (Number(maxi) || 0) + ' reached Maxi';
    var kicker = document.getElementById('homeWithdrawKicker');
    var value = document.getElementById('homeWithdrawValue');
    var note = document.getElementById('homeWithdrawNote');
    if (!value) return;
    if (!snap.address) {
        if (kicker) kicker.textContent = 'WITHDRAW';
        value.textContent = 'Withdraw ›';
        if (note) note.textContent = 'Set Lightning address';
    } else if (snap.canClaim) {
        if (kicker) kicker.textContent = 'WITHDRAW';
        value.textContent = 'Claim ' + claimNow.toLocaleString() + ' ›';
        var shortAddr = snap.address.length > 16 ? snap.address.slice(0, 10) + '…' : snap.address;
        if (note) note.textContent = 'to ⚡ ' + shortAddr;
    } else if (snap.onCooldown && snap.checksMet === snap.checksTotal) {
        if (kicker) kicker.textContent = 'WITHDRAW';
        value.textContent = 'Withdraw ›';
        if (note) note.textContent = 'Next claim soon';
    } else {
        if (kicker) kicker.textContent = 'WITHDRAW';
        value.textContent = 'Withdraw ›';
        if (note) note.textContent = snap.checksMet + '/' + snap.checksTotal + ' ready';
    }
}

window.refreshHomeStrip = function() {
    var signed = homeSignedInNow();
    document.documentElement.classList.toggle('home-signed-in', signed);
    if (document.body) document.body.classList.toggle('home-signed-in', signed);
    if (!signed) {
        if (typeof window.placeInvitePill === 'function') window.placeInvitePill();
        if (typeof window.paintHomeLearnCard === 'function') window.paintHomeLearnCard();
        return;
    }
    var user = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : {};
    var snap = satsHomeSnapshot(user);
    var invited = Number(user.referralInvited) || 0;
    var maxi = Number(user.referralCount) || 0;
    paintHomeStrip(snap, invited, maxi);
    if (typeof getReferralStats === 'function') {
        getReferralStats().then(function(stats) {
            if (!stats) return;
            var gotInvited = (typeof stats.invited === 'number') ? stats.invited : invited;
            var gotMaxi = (typeof stats.maxi === 'number') ? stats.maxi : maxi;
            if (stats.failed && !gotInvited && !gotMaxi) return;
            paintHomeStrip(snap, gotInvited, gotMaxi);
        }).catch(function() {});
    }
    if (typeof window.placeInvitePill === 'function') window.placeInvitePill();
    if (typeof window.paintHomeLearnCard === 'function') window.paintHomeLearnCard();
};

function openHomeSats() {
    if (typeof showSettingsPage === 'function') showSettingsPage('sats');
    else if (typeof showSettings === 'function') showSettings();
}
window.openHomeSats = openHomeSats;

function openHomeInvites() {
    if (typeof openInviteFriends === 'function') openInviteFriends(true);
}
window.openHomeInvites = openHomeInvites;

function openHomeWithdraw() {
    var user = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : {};
    var snap = satsHomeSnapshot(user);
    if (!snap.address) {
        if (typeof openWithdrawalAddress === 'function') openWithdrawalAddress({ mode: 'reset' });
        return;
    }
    if (typeof showSettingsPage === 'function') showSettingsPage('sats');
}
window.openHomeWithdraw = openHomeWithdraw;

function updateAuthButton() {
    const btn = document.getElementById('authBtn');
    if (!btn) return;
    // Check all possible ways a user can be "signed in":
    var firebaseUser = auth && auth.currentUser;
    var isRealAuth = firebaseUser && !firebaseUser.isAnonymous;
    var fsUsername = currentUser && currentUser.username;
    var localUsername = localStorage.getItem('btc_username');
    var displayName = fsUsername || localUsername || (firebaseUser && firebaseUser.displayName) || '';
    var isNostrOrLn = firebaseUser && firebaseUser.uid && (firebaseUser.uid.startsWith('nostr:') || firebaseUser.uid.startsWith('ln:'));

    var shouldShowSignedIn = isRealAuth || isNostrOrLn || displayName;

    // Once signed in, NEVER go back to "Create Account" unless explicitly signed out (firebaseUser is null)
    if (shouldShowSignedIn) {
        _authBtnSignedIn = true;
    } else if (_authBtnSignedIn && firebaseUser) {
        // Auth still exists but Firestore temporarily lost - don't downgrade
        return;
    } else if (!firebaseUser) {
        // Actually signed out
        _authBtnSignedIn = false;
    }

    if (_authBtnSignedIn) {
        var name = displayName || 'My Account';
        btn.innerHTML = '⚙️ <strong>' + (typeof escapeHtml === 'function' ? escapeHtml(name) : name) + '</strong> - Settings';
        btn.onclick = function() { showSettings(); };
        // Hide on mobile - mobile top bar already shows username + Topics
        btn.style.display = (window.innerWidth <= 900) ? 'none' : 'block';
        btn.style.background = 'none';
        btn.style.border = '2px solid #3b82f6';
        btn.style.color = '#3b82f6';
        btn.onmouseover = function() { this.style.background='#3b82f6'; this.style.color='#fff'; };
        btn.onmouseout = function() { this.style.background='none'; this.style.color='#3b82f6'; };
    } else if (!firebaseUser || (firebaseUser && firebaseUser.isAnonymous)) {
        // Only show "Create Account" for truly anonymous/no-auth users
        btn.textContent = 'Create Free Account / Sign In';
        btn.style.display = 'block';
        btn.style.background = 'var(--accent)';
        btn.style.border = 'none';
        btn.style.color = '#000';
        btn.onmouseover = function() { this.style.transform='scale(1.02)'; };
        btn.onmouseout = function() { this.style.transform='scale(1)'; };
    }
    // If auth hasn't resolved yet (firebaseUser exists but not anonymous and not identified), keep button hidden

    // Also hide guest banner for signed-in users
    var guestBanner = document.getElementById('guestPointsBanner');
    if (guestBanner && _authBtnSignedIn) {
        guestBanner.style.display = 'none';
    }
    document.documentElement.classList.toggle('home-signed-in', !!_authBtnSignedIn);
    if (document.body) document.body.classList.toggle('home-signed-in', !!_authBtnSignedIn);
    if (typeof window.refreshHomeStrip === 'function') window.refreshHomeStrip();
    if (typeof window.placeInvitePill === 'function') window.placeInvitePill();
}

// Sanitize user input - strip HTML tags and dangerous chars
function sanitizeInput(str) {
    return str.replace(/<[^>]*>/g, '').replace(/[<>"'&]/g, '').trim();
}
window.sanitizeInput = sanitizeInput;

// Sync all celebration/milestone state to Firestore (prevents re-triggering on re-login)
window.syncCelebratedState = function() {
    if (typeof db === 'undefined' || !auth || !auth.currentUser) return;
    var state = {
        nachoMilestones: safeJSON('btc_nacho_milestones', []),
        nachoCatComplete: safeJSON('btc_nacho_cat_complete', []),
        nachoLevelCelebrated: safeJSON('btc_nacho_level_celebrated', []),
        nachoItemsNotified: safeJSON('btc_nacho_items_notified', [])
    };
    db.collection('users').doc(auth.currentUser.uid).update({ celebratedState: state }).catch(function() {});
};

// Profanity filter
const PROFANITY_LIST = [
    // Profanity
    'fuck','shit','ass','bitch','dick','cock','pussy','cunt','damn','hell',
    'bastard','slut','whore','fag','faggot','nigger','nigga','retard','retarded','penis','vagina',
    'porn','sex','anal','cum','jizz','dildo','tits','boob','nude','naked',
    'hentai','milf','orgasm','erect','molest','rape','pedo','nazi','hitler',
    'kkk','jihad','terrorist','kill','murder','suicide','die','stfu','gtfo',
    'wank','twat','bollocks','arse','shag','piss','crap','douche','skank',
    'thot','incel','simp','onlyfans','xnxx','pornhub','xvideos',
    // Sexual content
    'blowjob','handjob','fingering','masturbat','threesome','gangbang','fetish','bondage','bdsm','kinky','horny','aroused','erection','erectile','climax','ejaculat','deepthroat','rimjob','creampie','cuckold','dominatrix','escort','prostitut','hooker','stripper','camgirl','sexting','nudes','twerk',
    // Racial slurs
    'spic','wetback','chink','gook','kike','towelhead','raghead','beaner','coon','darkie','zipperhead','jap','paki','wop','dago',
    // Hate/political (blocked in usernames too)
    'maga','trump','biden','democrat','republican','antifa','qanon','wwg1wga','acab',
    'supremacy','genocide','lynch'
];

function containsProfanity(str) {
    // Normalize leet speak and special chars
    const lower = str.toLowerCase()
        .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e')
        .replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't')
        .replace(/\$/g, 's').replace(/@/g, 'a').replace(/!/g, 'i')
        .replace(/\*/g, '').replace(/_/g, '').replace(/-/g, '')
        .replace(/[^a-z\s]/g, ' ');
    const words = lower.split(/\s+/);
    for (const word of words) {
        if (PROFANITY_LIST.includes(word)) return true;
    }
    // Also check for profanity embedded in the string (no spaces)
    const compressed = lower.replace(/\s/g, '');
    for (const bad of PROFANITY_LIST) {
        if (bad.length >= 4 && compressed.includes(bad)) return true;
    }
    return false;
}

function clientCreatePayload(extra) {
    var data = {
        points: 0,
        channelsVisited: 0,
        totalVisits: 1,
        streak: 1,
        lastVisit: new Date().toISOString().split('T')[0],
        created: firebase.firestore.FieldValue.serverTimestamp()
    };
    var allow = { profilePic: 1, displayName: 1, country: 1, lightning: 1, lightningAddress: 1, nostr: 1, lastLogin: 1, signupSource: 1, tosVersion: 1, tosAcceptedAt: 1 };
    var src = extra || {};
    Object.keys(src).forEach(function (k) {
        if (allow[k] && src[k] !== undefined && src[k] !== '') data[k] = src[k];
    });
    return data;
}

async function applyServerUsername(name) {
    var fn = firebase.functions().httpsCallable('setUsername');
    var res = await fn({ name: name });
    var data = res && res.data ? res.data : {};
    if (!data.ok || !data.username) throw new Error('Could not save that username.');
    var previousName = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : '';
    if (typeof currentUser !== 'undefined' && currentUser) {
        currentUser.username = data.username;
        if (previousName && previousName !== data.username) currentUser.usernameFreeRename = false;
    }
    try { localStorage.setItem('btc_username', data.username); } catch (e) {}
    return data.username;
}
window.applyServerUsername = applyServerUsername;

function ensureUsernameRepickStyle() {
    if (document.getElementById('usernameRepickStyle')) return;
    var style = document.createElement('style');
    style.id = 'usernameRepickStyle';
    style.textContent = '#usernameRepick{position:fixed;inset:0;z-index:600000;background:var(--overlay,rgba(0,0,0,.72));overflow-y:auto;-webkit-overflow-scrolling:touch;padding:max(12px,env(safe-area-inset-top)) 12px max(16px,env(safe-area-inset-bottom));box-sizing:border-box;}' +
        '#usernameRepick .username-box{width:min(400px,100%);max-width:400px;margin:24px auto;box-sizing:border-box;}' +
        '#usernameRepick h2{font-size:1.2rem;line-height:1.35;overflow-wrap:anywhere;}' +
        '#usernameRepick input{font-size:16px;box-sizing:border-box;}' +
        '#usernameRepickError{color:#ef4444;font-size:.85rem;min-height:1.2em;margin:-8px 0 12px;text-align:center;overflow-wrap:anywhere;}' +
        '#usernameRepickSignOut{margin-top:10px;background:none;color:var(--text-muted,#94a3b8);border:1px solid var(--border,#334155);font-weight:600;}' +
        '#usernameRepickSignOut:hover{background:none;color:var(--text,#e2e8f0);}' +
        '@media (max-width:420px){#usernameRepick .username-box{padding:20px 16px;margin:12px auto;}}';
    document.head.appendChild(style);
}

function usernameRepickFailure(e) {
    var code = String((e && e.code) || '');
    var msg = String((e && e.message) || '').replace(/^FirebaseError:\s*/i, '');
    if (code.indexOf('resource-exhausted') !== -1 || /too many username attempts/i.test(msg)) {
        return 'Too many username attempts. Try again in an hour, or sign out.';
    }
    if (/authenticator session required/i.test(msg) || /phone verification applies/i.test(msg) || /sign in again/i.test(msg) || code === 'auth/requires-recent-login') {
        return 'Two-factor sign-in is required before this name can be saved. Sign out and sign back in.';
    }
    if (code.indexOf('unauthenticated') !== -1) {
        return 'Your session expired. Sign out and sign back in.';
    }
    if (!msg || msg === 'internal') return 'Could not save that username. Try again, or sign out.';
    return msg;
}

function showUsernameRepickPrompt() {
    if (tosBlocking()) {
        window.runAfterTos(function() { showUsernameRepickPrompt(); });
        return;
    }
    if (document.getElementById('usernameRepick')) return;
    ensureUsernameRepickStyle();
    var signup = document.getElementById('usernameModal');
    if (signup) signup.classList.remove('open');
    if (!window._usernameRepickKeys) {
        window._usernameRepickKeys = true;
        document.addEventListener('keydown', function (e) {
            if (!document.getElementById('usernameRepick')) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);
    }
    var overlay = document.createElement('div');
    overlay.id = 'usernameRepick';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'usernameRepickTitle');
    overlay.innerHTML = '<div class="username-box glass-dark">' +
        '<h2 id="usernameRepickTitle">Your username needs updating. Please pick a new one</h2>' +
        '<p>This stays open until the new name is saved.</p>' +
        '<input type="text" id="usernameRepickInput" placeholder="Enter a username..." maxlength="20" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" aria-label="Choose a new username">' +
        '<div id="usernameRepickError" role="alert"></div>' +
        '<button type="button" id="usernameRepickSave">Save username</button>' +
        '<button type="button" id="usernameRepickSignOut">Sign out</button>' +
        '</div>';
    document.body.appendChild(overlay);
    var input = document.getElementById('usernameRepickInput');
    var save = document.getElementById('usernameRepickSave');
    var signOut = document.getElementById('usernameRepickSignOut');
    if (save) save.addEventListener('click', function () { submitUsernameRepick(); });
    if (signOut) signOut.addEventListener('click', function () {
        signOut.disabled = true;
        var done;
        try {
            if (typeof signOutUser === 'function') done = signOutUser();
            else if (typeof auth !== 'undefined' && auth && auth.signOut) done = auth.signOut();
            else done = Promise.reject(new Error('sign out unavailable'));
        } catch (e) {
            done = Promise.reject(e);
        }
        Promise.resolve(done).catch(function () {
            signOut.disabled = false;
            var err = document.getElementById('usernameRepickError');
            if (err) err.textContent = 'Could not sign out. Try again.';
        });
    });
    if (input) {
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitUsernameRepick();
            }
        });
        setTimeout(function () { try { input.focus(); } catch (e) {} }, 50);
    }
}
window.showUsernameRepickPrompt = showUsernameRepickPrompt;

function maybeShowUsernameRepick() {
    var needed = window.usernameRepickNeeded;
    if (typeof needed !== 'function') return;
    var authUser = (typeof auth !== 'undefined' && auth) ? auth.currentUser : null;
    var user = (typeof currentUser !== 'undefined') ? currentUser : null;
    if (!needed(user, authUser)) return;
    if (user && !user.username) {
        try { localStorage.removeItem('btc_username'); } catch (e) {}
    }
    showUsernameRepickPrompt();
}
window.maybeShowUsernameRepick = maybeShowUsernameRepick;

window.submitUsernameRepick = async function () {
    var input = document.getElementById('usernameRepickInput');
    var err = document.getElementById('usernameRepickError');
    var btn = document.getElementById('usernameRepickSave');
    function fail(msg) { if (err) err.textContent = msg || ''; }
    var name = input ? input.value.trim() : '';
    if (!name) { fail('Please enter a username.'); return; }
    if (name.length < 3) { fail('Username must be at least 3 characters.'); return; }
    if (name.length > 20) { fail('Username must be 20 characters or less.'); return; }
    if (/[\s\u180E\u200B-\u200D\u2060\uFEFF]/.test(name)) { fail('No spaces, please. Try an underscore instead, like ' + name.replace(/[\s\u180E\u200B-\u200D\u2060\uFEFF]+/g, '_') + '.'); return; }
    if (/[^A-Za-z0-9_\-.]/.test(name)) { fail('Use letters, numbers, underscores, hyphens, or dots.'); return; }
    if (typeof containsProfanity === 'function' && containsProfanity(name)) { fail('That username is not allowed.'); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    fail('');
    try {
        var saved = await applyServerUsername(name);
        if (typeof currentUser !== 'undefined' && currentUser) {
            currentUser.username = saved;
            currentUser.usernameNeedsRepick = false;
        }
        var overlay = document.getElementById('usernameRepick');
        if (overlay) overlay.remove();
        if (typeof updateAuthButton === 'function') updateAuthButton();
        if (typeof updateRankUI === 'function') updateRankUI();
        if (typeof showToast === 'function') showToast('Username updated');
    } catch (e) {
        fail(usernameRepickFailure(e));
        if (btn) { btn.disabled = false; btn.textContent = 'Save username'; }
    }
};

window.patchBlankProfileNames = function (root) {
    if (!root || typeof db === 'undefined' || !db || typeof window.missingPublicName !== 'function' || typeof window.leaderboardDisplayName !== 'function') return;
    var nodes = root.querySelectorAll('[data-profile-uid]');
    window._pubNameCache = window._pubNameCache || {};
    var jobs = [];
    for (var i = 0; i < nodes.length && jobs.length < 25; i++) {
        var node = nodes[i];
        var raw = (node.textContent || '').replace(/^@/, '').trim();
        var blank = node.getAttribute('data-blank-name') === '1' || !raw || raw === '\u2014' || raw === '-' || window.missingPublicName(raw);
        if (!blank) continue;
        var uid = node.getAttribute('data-profile-uid');
        if (!uid) continue;
        jobs.push({ node: node, uid: uid, at: /^\s*@/.test(node.textContent || '') });
    }
    jobs.forEach(function (job) {
        function paint(name) {
            if (!job.node || window.missingPublicName(name)) return;
            job.node.textContent = (job.at ? '@' : '') + name;
            job.node.removeAttribute('data-blank-name');
        }
        if (window._pubNameCache[job.uid]) {
            paint(window._pubNameCache[job.uid]);
            return;
        }
        if (window._pubNameCache[job.uid] === '') return;
        window._pubNamePending = window._pubNamePending || {};
        if (window._pubNamePending[job.uid]) {
            window._pubNamePending[job.uid].push(paint);
            return;
        }
        window._pubNamePending[job.uid] = [paint];
        db.collection('public_profiles').doc(job.uid).get().then(function (snap) {
            var name = snap && snap.exists && snap.data() ? snap.data().username : '';
            var shown = window.leaderboardDisplayName('', name);
            window._pubNameCache[job.uid] = shown === 'Anon' ? '' : shown;
            var waiters = window._pubNamePending[job.uid] || [];
            delete window._pubNamePending[job.uid];
            waiters.forEach(function (fn) { fn(window._pubNameCache[job.uid]); });
        }).catch(function () {
            delete window._pubNamePending[job.uid];
        });
    });
};

async function stashGuestLink() {
    if (!auth || !auth.currentUser || !auth.currentUser.isAnonymous) return;
    var uid = auth.currentUser.uid;
    try {
        var raw = localStorage.getItem('btc_guest_link');
        if (raw) {
            var parsed = JSON.parse(raw);
            if (parsed && parsed.anonUid === uid && parsed.nonce && parsed.at && (Date.now() - Number(parsed.at)) < 20 * 60 * 1000) return;
        }
    } catch (e) {}
    var attempt;
    for (attempt = 0; attempt < 2; attempt++) {
        try {
            var fn = firebase.functions().httpsCallable('prepareGuestLink');
            var res = await fn({});
            if (res && res.data && res.data.nonce) {
                localStorage.setItem('btc_guest_link', JSON.stringify({ anonUid: uid, nonce: res.data.nonce, at: Date.now() }));
                return;
            }
        } catch (err) {}
    }
    if (typeof showToast === 'function') showToast('Could not save this guest session. Try again before you sign in.');
}
window.stashGuestLink = stashGuestLink;

async function tryLinkGuest() {
    var raw = localStorage.getItem('btc_guest_link');
    if (!raw || !auth || !auth.currentUser || auth.currentUser.isAnonymous) return '';
    var parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { return ''; }
    if (!parsed || !parsed.anonUid || parsed.anonUid === auth.currentUser.uid) return '';
    var fn = firebase.functions().httpsCallable('linkGuestAccount');
    var res = null;
    try {
        res = await fn({ anonUid: parsed.anonUid, nonce: parsed.nonce });
    } catch (e) {
        var code = e && e.code;
        // #59's linkGuestAccount calls requireSecondFactor before it writes.
        // Hold the token so that gate can merge after the session exists.
        if (guestLinkIsMfaHold(e && e.message)) {
            window._pendingGuestLink = true;
            return 'mfa';
        }
        if (code === 'functions/invalid-argument' || code === 'functions/permission-denied' || code === 'functions/not-found' || code === 'functions/failed-precondition' || code === 'functions/unauthenticated') {
            try { localStorage.removeItem('btc_guest_link'); } catch (dropErr) {}
        }
        return '';
    }
    var data = res && res.data ? res.data : {};
    if ((data.error && guestLinkShouldDrop(data.error)) || data.ok) {
        try { localStorage.removeItem('btc_guest_link'); } catch (dropOk) {}
    }
    if (data.ok && typeof window.flushOnboardingClaims === 'function') window.flushOnboardingClaims();
    window._pendingGuestLink = false;
    return data.ok ? 'ok' : '';
}
window.tryLinkGuest = tryLinkGuest;

async function createUser(username, email, enteredGiveaway, giveawayLnAddress, country) { // giveaway params kept for call-site compat; giveawayLnAddress now used as lightningAddress
    // Wait for auth to be ready if not yet
    if (typeof auth === 'undefined' || !auth) {
        showToast('⏳ Loading... please try again in a moment.');
        // Try to init if it hasn't happened
        if (typeof initRanking === 'function') initRanking();
        return;
    }
    if (!auth.currentUser) {
        try {
            const cred = await auth.signInAnonymously();
            // Wait a moment for auth.currentUser to update
            if (!auth.currentUser) {
                await new Promise(resolve => {
                    const unsub = auth.onAuthStateChanged(user => {
                        if (user) { unsub(); resolve(); }
                    });
                    setTimeout(() => { resolve(); }, 3000); // timeout fallback
                });
            }
        } catch(e) {
            console.log('Anonymous sign-in error:', e);
            showToast('Error creating account. Please try again.');
            return;
        }
    }
    if (!auth.currentUser) {
        showToast('Error: Could not authenticate. Please refresh and try again.');
        return;
    }
    const uid = auth.currentUser.uid;
    username = sanitizeInput(username);
    // Spaces, NBSP, and zero-width characters are rejected before the ASCII strip,
    // so they are not silently deleted into a different name.
    if (/[\s\u180E\u200B-\u200D\u2060\uFEFF]/.test(username)) {
        showToast('⚠️ Usernames cannot contain spaces. Try ' + username.replace(/[\s\u180E\u200B-\u200D\u2060\uFEFF]+/g, '_') + ' instead.');
        return;
    }
    // Strip non-ASCII characters (prevents Unicode/homoglyph bypass)
    username = username.replace(/[^\x20-\x7E]/g, '').replace(/[\\'"<>]/g, '').trim();
    if (!username || username.length < 3) {
        showToast('Username must be at least 3 characters.');
        return;
    }
    // Only allow English letters, digits, underscores, hyphens, and dots. No spaces.
    if (/[^A-Za-z0-9_\-.]/g.test(username)) {
        showToast('⚠️ Username can only contain English letters, numbers, underscores, hyphens, and dots.');
        return;
    }
    if (containsProfanity(username)) {
        showToast('⚠️ That username is not allowed. Please choose another.');
        return;
    }
    // Uniqueness check - must happen after we have uid
    var _taken = await isUsernameTaken(username, uid);
    if (_taken) {
        showToast('⚠️ That username is already taken. Please choose another.');
        return;
    }
    const userData = clientCreatePayload({});
    if (country) userData.country = country;
    // Lightning address from signup field
    var _signupLn = giveawayLnAddress || '';
    if (!_signupLn) {
        // Also check localStorage in case it was set for email-flow users
        _signupLn = localStorage.getItem('btc_pending_ln_address') || '';
        localStorage.removeItem('btc_pending_ln_address');
    }
    _signupLn = normalizeClientLn(_signupLn);
    if (clientLnValid(_signupLn)) {
        userData.lightning = _signupLn;
        userData.lightningAddress = _signupLn;
    } else {
        _signupLn = '';
    }
    // Faction is saved by chooseFaction after the profile exists.
    var _pickedFaction = window._signupFaction || '';
    try { if (!_pickedFaction) _pickedFaction = localStorage.getItem('btc_pending_faction') || ''; } catch (e) {}
    window._signupFaction = null;
    // Campaign source tracking - written once at signup, never overwritten
    var _signupSrc = localStorage.getItem('btc_signup_source');
    if (_signupSrc) { userData.signupSource = _signupSrc; }
    // Record TOS acceptance at signup
    userData.tosVersion = TOS_CURRENT_VERSION;
    userData.tosAcceptedAt = firebase.firestore.FieldValue.serverTimestamp();

    var _existingAccount = await db.collection('users').doc(uid).get();
    if (!_existingAccount.exists) await db.collection('users').doc(uid).set(userData);
    if (_pickedFaction && (!_existingAccount.exists || !(_existingAccount.data() && _existingAccount.data().faction))) {
        try { await flushSignupFaction(_pickedFaction); } catch (e) {}
    }
    try { await applyServerUsername(username); }
    catch (nameErr) {
        showToast(nameErr.message || 'Pick a different username.');
        return;
    }
    userData.username = username;
    // Increment global registered user count
    try { db.collection('stats').doc('global').set({ userCount: firebase.firestore.FieldValue.increment(1) }, { merge: true }).catch(function() {}); } catch(e) {}
    currentUser = { uid, ...userData };
    rankingReady = true;
    window._badgesReady = true;
        if (typeof markVisibleBadgesReady === "function") markVisibleBadgesReady(); window._hiddenBadgesReady = true;
    updateRankUI();
    updateAuthButton();
    awardPoints(POINTS.visit, 'Welcome bonus!');
    startReadTimer();
    hideUsernamePrompt();
    if (_signupLn) setTimeout(function() { showToast('Lightning address saved to your profile.'); }, 1200);
    if (typeof window.flushOnboardingClaims === 'function') window.flushOnboardingClaims();

    // Attach referral if user came via referral link
    if (typeof attachReferral === 'function') attachReferral(uid);
    // Initialize Orange Tickets for new user
    if (typeof onUserLoadedTickets === 'function') onUserLoadedTickets();
    // Initialize messaging
    if (typeof initMessaging === 'function') initMessaging();
    // Process pending buddy match from anonymous onboarding
    try {
        var _pendingBuddy = JSON.parse(localStorage.getItem('btc_buddy_pending') || 'null');
        if (_pendingBuddy && _pendingBuddy.goal) {
            localStorage.removeItem('btc_buddy_pending');
            if (typeof _submitBuddyFromOnboarding === 'function') {
                setTimeout(function() { _submitBuddyFromOnboarding(_pendingBuddy.level || 'beginner', _pendingBuddy.goal); }, 2000);
            }
        }
    } catch(e) {}
}

async function awardVisitPoints() {
    if (!currentUser) return;
    // Snapshot the previous visit before recordDailyVisit overwrites it,
    // so the push prompt can tell a 7-day return from a same-day reload.
    try {
        if (!sessionStorage.getItem('btc_push_prev_visit') && currentUser.lastVisit) {
            sessionStorage.setItem('btc_push_prev_visit', String(currentUser.lastVisit));
        }
    } catch (e) {}
    // Use 5 AM UTC offset key - matches getDailyKey() and server getOffsetDateKey()
    const RESET_HOUR_UTC = 5;
    const today = new Date(Date.now() - RESET_HOUR_UTC * 3600000).toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - (RESET_HOUR_UTC + 24) * 3600000).toISOString().split('T')[0];

    // Only award once per day - no refresh exploits
    if (currentUser.lastVisit === today) return;

    let streakBonus = false;
    let bonusTickets = 0;
    let pointsToAdd = POINTS.visit;
    let newStreak = 1;

    if (currentUser.lastVisit === yesterday) {
        newStreak = (currentUser.streak || 0) + 1;
        // Streak milestones: every 7 days = bonus tickets
        if (newStreak % 7 === 0) {
            bonusTickets = Math.min(25, Math.floor(newStreak / 7) * 5);
            streakBonus = true;
        } else if (newStreak % 5 === 0) {
            pointsToAdd += POINTS.streak;
            streakBonus = true;
        }
    } else if (currentUser.lastVisit !== today) {
        // Streak broken! Check for STREAK FREEZE
        var oldStreak = currentUser.streak || 0;
        if (currentUser.streakFreezes > 0) {
            // AUTO-USE a freeze to save the streak
            newStreak = oldStreak + 1;
            currentUser.streakFreezes--;
            streakBonus = true;
            setTimeout(function() {
                showToast('🧊 STREAK FROZEN! A freeze ticket was used to save your ' + newStreak + '-day streak! (' + (currentUser.streakFreezes || 0) + ' freezes remaining)');
            }, 3000);
            // Streak freeze is now deducted server-side in recordDailyVisit Cloud Function
        } else if (oldStreak > 1) {
            // No freeze available - streak is broken
            setTimeout(function() {
                showToast('💔 Your ' + oldStreak + '-day streak was broken! Earn 🧊 Freeze Tickets from the Daily Spin to protect your streak next time.');
            }, 3000);
        }
    }

    if (currentUser._isLocal) {
        // ... update logic
    } else {
        // Record visit server-side (streak, totalVisits, bestStreak, tickets all handled atomically)
        try {
            var recordVisitFn = firebase.functions().httpsCallable('recordDailyVisit');
            var visitResult = await recordVisitFn({});
            if (visitResult.data && visitResult.data.success && !visitResult.data.alreadyVisited) {
                newStreak = visitResult.data.streak || 1;
                bonusTickets = visitResult.data.bonusTickets || 0;
                var newBest = visitResult.data.bestStreak || newStreak;
                currentUser.streak = newStreak;
                currentUser.bestStreak = newBest;
                currentUser.lastVisit = today;
                currentUser.totalVisits = visitResult.data.totalVisits || (currentUser.totalVisits || 0) + 1;
                if (bonusTickets > 0) currentUser.orangeTickets = (currentUser.orangeTickets || 0) + bonusTickets;
                if (visitResult.data.usedFreeze) {
                    currentUser.streakFreezes = Math.max(0, (currentUser.streakFreezes || 0) - 1);
                    setTimeout(function() { showToast('🧊 STREAK FROZEN! A freeze was used to save your ' + newStreak + '-day streak!'); }, 3000);
                }
                // Fire raid damage for Streak-Sage boss when streak hits a 7-day multiple
                if (newStreak > 0 && newStreak % 7 === 0 && typeof window._raidContribute === 'function') {
                    setTimeout(function() { window._raidContribute('streakUsers', 1); }, 1500);
                }
            }
        } catch (e) {
            console.warn('[VISIT] Cloud Function failed:', e.message);
        }
        // Award points through Cloud Function (daily cap enforced server-side)
        var _visitPts = pointsToAdd + (bonusTickets * 5);
        if (_visitPts > 0) await awardPoints(_visitPts, '✅ Daily visit' + (newStreak > 1 ? ' (' + newStreak + '-day streak!)' : ''));
    }

    if (bonusTickets > 0) {
        if (typeof notifySelfStreak === 'function') notifySelfStreak(newStreak);
        setTimeout(function() {
            showToast('🔥 STREAK MILESTONE! Day ' + newStreak + ': Earned +' + bonusTickets + ' Bonus Tickets! 🎫');
        }, 3500);
    } else if (streakBonus) {
        showToast('🔥 Day ' + currentUser.streak + ' streak! +' + (POINTS.visit + POINTS.streak) + ' XP');
    }
    // Silent for non-streak daily visits - ticket toast covers it
    updateRankUI();
    if (typeof renderProgressRings === 'function') renderProgressRings();
    refreshLeaderboardIfOpen();
}

function inferAwardActionKey(reason, badgeId, extra) {
    if (badgeId) return '';
    var text = String(reason || '');
    if (text.indexOf('🎫') !== -1 || text.indexOf('\uD83C\uDFAB') !== -1) return '';
    var more = extra && typeof extra === 'object' ? extra : {};
    if ((/flex:/i.test(text) || /daily challenge:/i.test(text)) && more.flexActionId) return 'flex_action';
    if (/trio combo|mega combo|legendary combo|daily 3 complete/i.test(text) && more.comboTier) return 'combo_bonus';
    if (/^📖 Learning Quest: .+ lesson$/.test(text.trim())) return 'lq_lesson';
    return '';
}

window._doubleXpUntilMs = function(u) {
    if (!u) return 0;
    var raw = u.doubleXpUntil != null && u.doubleXpUntil !== '' ? u.doubleXpUntil : u.doubleXPExpiry;
    if (raw == null || raw === '') return 0;
    if (typeof raw === 'number' && isFinite(raw)) return raw;
    if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw);
    if (typeof raw.toMillis === 'function') {
        var ms = raw.toMillis();
        return typeof ms === 'number' && isFinite(ms) ? ms : 0;
    }
    if (typeof raw === 'object') {
        if (typeof raw.seconds === 'number') return raw.seconds * 1000;
        if (typeof raw._seconds === 'number') return raw._seconds * 1000;
    }
    return 0;
};

async function awardPoints(pts, reason, channelId, tickets, streakFreezes, badgeId, extra) {
    if (!currentUser || !rankingReady) return;

    // Anti-abuse: validate pts is a reasonable number.
    // badge_earned uses a higher ceiling because the CF catalog contains milestones
    // up to 100,000 pts (hall_of_fame: 5000, the_archive: 10000, etc.).
    // The client value is irrelevant — the CF always overrides pts from BADGE_VALUES —
    // but we must not drop the call before it reaches the CF.
    pts = parseInt(pts);
    var _isBadgeEarnedCall = !!(badgeId);
    if (isNaN(pts) || pts < 0 || (!_isBadgeEarnedCall && pts > 2200)) return;
    // Allow 0 pts if tickets or streakFreezes are being awarded
    if (pts === 0 && !tickets && !streakFreezes && !_isBadgeEarnedCall) return;

    // Anti-abuse: rate limit - max 20 point awards per minute
    window._pointAwardTimes = window._pointAwardTimes || [];
    var _now = Date.now();
    window._pointAwardTimes = window._pointAwardTimes.filter(function(t) { return _now - t < 60000; });
    if (window._pointAwardTimes.length >= 20) return;
    window._pointAwardTimes.push(_now);

    if (currentUser._isLocal) {
        // ── Anonymous / local-only user ──
        // Ghost Mode badge: auto-award on first earned point
        if (pts > 0 && auth && auth.currentUser && auth.currentUser.isAnonymous) {
            var _ghostBadges = JSON.parse(localStorage.getItem('btc_badges') || '[]');
            if (_ghostBadges.indexOf('ghost_mode') === -1) {
                _ghostBadges.push('ghost_mode');
                try { localStorage.setItem('btc_badges', JSON.stringify(_ghostBadges)); } catch(e) {}
            }
            // Track pts for ghost banner re-show
            if (typeof window._ghostTrackPts === 'function') window._ghostTrackPts(pts);
        }
        // Local preview only. Same tiers as functions/src/dailyXp.js:
        // full through 500, half through 900, quarter until 1,000.
        // Floor per tier. A boundary split does not carry a fractional point.
        // Guest points are not banked, and a later sign-in does not redeem them as overflow.
        var DAILY_CAP = 1000;
        var TAPER_TIERS = [
            { end: 500, divisor: 1 },
            { end: 900, divisor: 2 },
            { end: 1000, divisor: 4 }
        ];
        var _today = new Date(Date.now() - 5 * 3600000).toISOString().split('T')[0];
        var _capKey = 'btc_daily_pts_' + _today;
        var _dailyUsed = parseInt(localStorage.getItem(_capKey) || '0', 10);
        if (isNaN(_dailyUsed)) _dailyUsed = 0;

        // ── Action cooldown (anon-local mirror of server cooldowns) ──
        // Prevents spam e.g. tctv_watch_10m firing faster than every 10 min.
        var LOCAL_COOLDOWNS = {
            'tctv_watch_10m': 10 * 60 * 1000,
            'daily_spin': 24 * 60 * 60 * 1000,
            'daily_visit': 20 * 60 * 60 * 1000
        };
        var cdMs = LOCAL_COOLDOWNS[reason];
        if (cdMs) {
            var cdKey = 'btc_cd_' + reason;
            var last = parseInt(localStorage.getItem(cdKey) || '0', 10);
            if (last && (Date.now() - last) < cdMs) {
                if (typeof showToast === 'function') showToast('⏳ Slow down - cooldown still active');
                return;
            }
            try { localStorage.setItem(cdKey, String(Date.now())); } catch(e) {}
        }

        var awarded = 0;
        var cursor = _dailyUsed;
        var left = pts;
        if (cursor < DAILY_CAP && left > 0) {
            for (var ti = 0; ti < TAPER_TIERS.length; ti++) {
                if (left <= 0 || cursor >= DAILY_CAP) break;
                var tier = TAPER_TIERS[ti];
                if (cursor >= tier.end) continue;
                var room = tier.end - cursor;
                var rawNeeded = room * tier.divisor;
                if (left >= rawNeeded) {
                    awarded += room;
                    cursor += room;
                    left -= rawNeeded;
                } else {
                    var credit = Math.floor(left / tier.divisor);
                    awarded += credit;
                    cursor += credit;
                    left = 0;
                }
            }
        }

        if (awarded > 0) {
            var newPoints = (parseInt(localStorage.getItem('btc_points') || '0', 10) || 0) + awarded;
            try {
                localStorage.setItem('btc_points', String(newPoints));
                localStorage.setItem(_capKey, String(_dailyUsed + awarded));
            } catch(e) {}
            currentUser.points = newPoints;
            _showPointsToast(awarded, reason);
            if (typeof notifySelfPoints === 'function') notifySelfPoints(awarded, reason);
        }

        if (_dailyUsed + awarded >= DAILY_CAP) {
            // Daily cap notification (once per day)
            var _capNotifKey = 'btc_daily_cap_notified_' + _today;
            if (!localStorage.getItem(_capNotifKey)) {
                try { localStorage.setItem(_capNotifKey, '1'); } catch(e) {}
                if (typeof showToast === 'function') showToast('Daily cap hit (1,000). Full through 500, half through 900, then a quarter. More XP today is not awarded.', 8000);
                if (typeof _updateCapIndicator === 'function') _updateCapIndicator(true);
            }
        }

        updateRankUI();
        if (typeof renderProgressRings === 'function') renderProgressRings();
        refreshLeaderboardIfOpen();
        if (typeof nachoOnPoints === 'function') nachoOnPoints(pts);
        return;
    }

    // Update lastActive timestamp on heartbeat
    if (!auth.currentUser.isAnonymous) {
        db.collection('users').doc(auth.currentUser.uid).update({
            lastActive: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(function() {});
    }

    // ── Signed-in users: Cloud Function enforces daily cap server-side ──
    // Eagerly log to notification tracker so it always appears in 🔔 Alerts
    // (CF is async - user may navigate away before it returns)
    // Exception: badge_earned - defer notification until server confirms (prevents ghost XP on cache-clear re-trigger)
    var _isBadgeEarned = !!(badgeId);
    var _eagerNotifyTs = null; // timestamp of eager log entry — used to correct it post-CF if capped
    try {
        // The server applies 2× from doubleXpUntil. The client must not multiply.
        if (pts > 0 && reason && !_isBadgeEarned && typeof notifySelfPoints === 'function') {
            _eagerNotifyTs = notifySelfPoints(pts, reason);
        }

        var awardPointsFn = firebase.functions().httpsCallable('awardPoints');
        var payload = { pts: pts, action: reason || '', reason: reason || '' };
        if (channelId) payload.channelId = channelId;
        if (tickets) payload.tickets = tickets;
        if (streakFreezes) payload.streakFreezes = streakFreezes;
        if (badgeId) payload.badgeId = badgeId;
        if (extra && typeof extra === 'object') Object.assign(payload, extra);
        if (!payload.actionKey) {
            var inferredKey = inferAwardActionKey(reason, badgeId, extra);
            if (inferredKey) payload.actionKey = inferredKey;
        }
        var result = await awardPointsFn(payload);
        if (result.data && result.data.dailyActionCapped) {
            if (typeof showToast === 'function') showToast('⏳ ' + (result.data.error || 'Daily limit reached for this action.'), 6000);
        }
        if (result.data && result.data.cooldown) {
            if (typeof showToast === 'function') showToast('⏳ ' + (result.data.error || 'Slow down a bit.'), 4000);
        }
        if (result.data && result.data.success) {
            var awarded = result.data.awarded || 0;
            if (result.data.doubleXpUntil && typeof currentUser !== 'undefined' && currentUser) {
                currentUser.doubleXpUntil = result.data.doubleXpUntil;
                currentUser.doubleXPExpiry = result.data.doubleXpUntil;
            }
            var totalAdded = awarded;
            // For badge_earned: notify here (deferred from eager path above) - server confirmed it's real
            if (_isBadgeEarned && awarded > 0 && typeof notifySelfPoints === 'function') {
                notifySelfPoints(awarded, reason);
            }
            // Correct the eager notification entry if CF awarded less than expected (daily cap)
            if (!_isBadgeEarned && _eagerNotifyTs && awarded !== (pts) && typeof _correctLastPointsNotif === 'function') {
                _correctLastPointsNotif(_eagerNotifyTs, awarded);
            }
            if (totalAdded > 0) {
                currentUser.points = (currentUser.points || 0) + totalAdded;
                _showPointsToast(awarded, reason);
            }
            if (result.data.dailyXp != null && typeof window._paintDailyXpMeter === 'function') {
                window._serverDailyXp = {
                    signedIn: true,
                    dailyXp: result.data.dailyXp,
                    dailyCap: result.data.dailyCap || 1000,
                    fullUntil: result.data.fullUntil || 500,
                    halfUntil: result.data.halfUntil || 900,
                    pastCap: result.data.pastCap === true
                };
                window._paintDailyXpMeter(window._serverDailyXp);
            }
            if (result.data.capped || result.data.pastCap) {
                var _capNotifKey = 'btc_daily_cap_notified_' + new Date(Date.now() - 5 * 3600000).toISOString().split('T')[0];
                if (!localStorage.getItem(_capNotifKey)) {
                    localStorage.setItem(_capNotifKey, '1');
                    showToast('Daily cap hit (1,000). Full through 500, half through 900, then a quarter. More XP today is not awarded.', 8000);
                    _updateCapIndicator(true);
                }
            }
        }
    } catch (e) {
        // [SECURITY] No local fallback - server is the only source of truth for points
        console.warn('[POINTS] Cloud Function failed:', e.message);
        if (typeof showToast === 'function') showToast('⏳ XP will sync when connection restores');
        // Re-throw so callers (.then/.catch in badges.js) can roll back on network failure.
        throw e;
    }
    updateRankUI();
    if (typeof renderProgressRings === 'function') renderProgressRings();
    refreshLeaderboardIfOpen();
    if (typeof nachoOnPoints === 'function') nachoOnPoints(pts);
    return result; // Return CF result so callers can check success/failure
}

// Helper: smart toast throttling for point awards
function _showPointsToast(pts, reason) {
    var _show = false;
    if (pts >= 25) {
        _show = true;
    } else if (reason && reason.length > 0) {
        window._lastPtsToast = window._lastPtsToast || 0;
        if (Date.now() - window._lastPtsToast > 30000) _show = true;
    }
    if (_show && reason) {
        window._lastPtsToast = Date.now();
        showToast('+' + pts + ' XP - ' + reason, 2500);
    }
}

// Points notification log - stored in localStorage for the bell panel
// Defined here (in bundle) so it's available before lazy-loaded notifications.js
window.notifySelfPoints = function(pts, reason) {
    if (!pts || pts < 1) return;
    if (!reason || reason === '') return;
    var ts = Date.now();
    var entry = { pts: pts, reason: reason, ts: ts, read: false };
    try {
        var log = JSON.parse(localStorage.getItem('btc_points_log') || '[]');
        log.push(entry);
        if (log.length > 500) log = log.slice(log.length - 500);
        localStorage.setItem('btc_points_log', JSON.stringify(log));
    } catch(e) {}
    // Badge update (if notifications.js has loaded)
    if (typeof _updatePointsBadge === 'function') _updatePointsBadge();
    return ts; // return ts so callers can correct the entry post-CF if needed
};

// Correct a previously-logged notification entry when server returns a different (capped) value.
// Matches by timestamp; updates pts in-place so 'Today\'s earnings' reflects reality.
window._correctLastPointsNotif = function(ts, actualPts) {
    if (!ts || actualPts < 0) return;
    try {
        var log = JSON.parse(localStorage.getItem('btc_points_log') || '[]');
        // Walk backwards — the entry we want is almost always the last one
        for (var i = log.length - 1; i >= Math.max(0, log.length - 5); i--) {
            if (log[i].ts === ts) {
                if (actualPts === 0) {
                    log.splice(i, 1); // remove entirely if nothing was awarded
                } else {
                    log[i].pts = actualPts;
                }
                localStorage.setItem('btc_points_log', JSON.stringify(log));
                if (typeof _updatePointsBadge === 'function') _updatePointsBadge();
                break;
            }
        }
    } catch(e) {}
};

// Auto-refresh leaderboard if it's currently open
// Switch leaderboard period WITHOUT closing - used by the tab buttons
function _lbSwitchPeriod(period) {
    window._lbPeriod = period;
    window._lbCache = null;
    window._lbWeekCache = null;
    window._lbMonthCache = null;
    window._lbCacheTime = null;
    // Force re-render: temporarily remove 'open' class flag check by calling internal render
    var lb = document.getElementById('leaderboard');
    if (!lb) return;
    lb.classList.add('open');
    lb.classList.remove('minimized');
    toggleLeaderboard._renderOnly = true;
    // Re-invoke render path directly - set lb to loading state, then reload
    lb.innerHTML = '<div style="padding:20px;text-align:center;color:#475569;">Loading...</div>';
    // Call the actual data+render logic by temporarily forcing open state
    var fab = document.getElementById('lbFloatBtn');
    if (fab) fab.style.display = 'none';
    // Directly invoke the async render (same as toggleLeaderboard but skip the close check)
    (async function() {
        try {
            // Reuse toggleLeaderboard's render but the lb is already open so it won't close
            // Trick: remove open class briefly so toggleLeaderboard won't see it as open
            lb.classList.remove('open');
            await toggleLeaderboard();
        } catch(e) {
            lb.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444;">Failed to load</div>';
        }
    })();
}
window._lbSwitchPeriod = _lbSwitchPeriod;

function refreshLeaderboardIfOpen() {
    var lb = document.getElementById('leaderboard');
    if (lb && lb.classList.contains('open') && !lb.classList.contains('minimized')) {
        // Clear cache so next open fetches fresh data
        window._lbCache = null;
        window._lbCacheTime = null;
        // In-place update: find the current user's row and update score
        var meRow = lb.querySelector('.lb-me .lb-score');
        if (meRow && currentUser) {
            meRow.textContent = (currentUser.points || 0).toLocaleString() + ' XP';
        }
    }
}

// Called from go() when user opens a channel
async function onChannelOpen(channelId) {
    if (typeof nachoOnChannel === 'function') nachoOnChannel(channelId);
    if (!currentUser || !rankingReady) return;

    // Only award points for channels NEVER visited before (persisted)
    if (!allTimeChannels.has(channelId)) {
        allTimeChannels.add(channelId);
        sessionChannels.add(channelId);

        let ptsAwarded = POINTS.openChannel;
        // Apply daily 2X boost
        if (window._dailyBoosts && window._dailyBoosts.includes(channelId)) {
            ptsAwarded *= 2;
            setTimeout(() => { showToast('⚡ 2X XP! Daily boost applied! +' + ptsAwarded + ' XP'); }, 2000);
        }

        // Update local tracking
        if (currentUser._isLocal) {
            currentUser.channelsVisited = (currentUser.channelsVisited || 0) + 1;
        } else {
            currentUser.channelsVisited = (currentUser.channelsVisited || 0) + 1;
        }
        if (currentUser.readChannels) {
            if (currentUser.readChannels.indexOf(channelId) === -1) currentUser.readChannels.push(channelId);
        } else {
            currentUser.readChannels = [channelId];
        }
        // Also mirror to visitedChannelsList so the Sats requirements checklist
        // updates immediately (the Cloud Function will add it server-side too,
        // but we don't want the UI to lag by a round-trip).
        if (!Array.isArray(currentUser.visitedChannelsList)) currentUser.visitedChannelsList = [];
        if (currentUser.visitedChannelsList.indexOf(channelId) === -1) currentUser.visitedChannelsList.push(channelId);
        // Award points + track channel visit server-side (Cloud Function handles both atomically)
        await awardPoints(ptsAwarded, '📖 New channel explored', channelId);

        // Show leaderboard only if forced or during specific onboarding by Nacho
        // (Removed auto-show on every new channel visit)
        // if (typeof showLeaderboardAuto === 'function') showLeaderboardAuto();

        // Update exploration map + toast
        if (typeof renderExplorationMap === 'function') renderExplorationMap();
        if (typeof renderUserWorldMap === 'function') renderUserWorldMap();
        if (typeof showToast === 'function') {
            const totalCh = typeof CHANNELS !== 'undefined' ? Object.keys(CHANNELS).length : 146;
            const pct = Math.round((allTimeChannels.size / totalCh) * 100);
            showToast('🗺️ Exploration Map: ' + allTimeChannels.size + ' channels reached (' + pct + '%)');
        }

        // Bonus for exploring 10+ unique channels total
        if (allTimeChannels.size === 10) {
            await awardPoints(POINTS.explore10, 'Explorer bonus! 10 topics 🎉');
        }
    }

    // Reset read timer for new channel
    readSeconds = 0;
    lastReadAward = 0;

    // Sync read channel to Firebase
    syncReadToFirebase(channelId);

    // Notify quest system
    if (typeof onChannelVisitForQuest === 'function') onChannelVisitForQuest(channelId);
}

// Sync read checkmarks to Firebase
async function syncReadToFirebase(channelId) {
    // readChannels is now blocked in Firestore rules - channel tracking goes through awardPoints CF
    // This function is kept as a no-op for backward compatibility
}

// Sync favorites to Firebase (called from index.html)
async function syncFavsToFirebase() {
    if (!currentUser || !db || !auth.currentUser || currentUser._isLocal) return;
    try {
        const favs = JSON.parse(localStorage.getItem('btc_favs') || '[]');
        await db.collection('users').doc(auth.currentUser.uid).update({
            favorites: favs
        });
    } catch(e) {}
}

// Sync bookmarks to Firebase
async function syncBookmarksToFirebase() {
    if (!currentUser || !db || !auth.currentUser || currentUser._isLocal) return;
    try {
        const bm = JSON.parse(localStorage.getItem('btc_bookmarks') || '[]');
        await db.collection('users').doc(auth.currentUser.uid).update({
            bookmarks: bm
        });
    } catch(e) {}
}
window.syncBookmarksToFirebase = syncBookmarksToFirebase;

// Sync badges and scholar status to Firebase
// syncProgressToFirebase removed - badges and scholar status are synced inline at award time

// Restore visited UI checkmarks
function restoreVisitedUI() {
    const visited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]');
    visited.forEach(id => {
        document.querySelectorAll('.ch-btn').forEach(b => {
            if (b.getAttribute('onclick') && b.getAttribute('onclick').includes("'" + id + "'")) {
                b.classList.add('visited');
            }
        });
    });
}

let lastActivityTime = Date.now();
let lastScrollPos = 0;
let hasScrolledSinceLastAward = false;

// Track user activity
function trackActivity() {
    lastActivityTime = Date.now();
}
function trackScroll() {
    const main = document.getElementById('main');
    if (main && Math.abs(main.scrollTop - lastScrollPos) > 30) {
        lastScrollPos = main.scrollTop;
        hasScrolledSinceLastAward = true;
        lastActivityTime = Date.now();
    }
}

// Listen for real user activity
// mousemove is throttled: fires hundreds of times/sec on desktop — cap at 2/sec
var _mmThrottleTs = 0;
document.addEventListener('mousemove', function() {
    var _now = Date.now();
    if (_now - _mmThrottleTs < 500) return;
    _mmThrottleTs = _now;
    trackActivity();
});
document.addEventListener('keydown', trackActivity);
document.addEventListener('touchstart', trackActivity, { passive: true });
document.addEventListener('click', trackActivity);
// Skip trackScroll when tab is in background
setInterval(function() { if (!document.hidden) trackScroll(); }, 2000);

function startReadTimer() {
    if (readTimer) clearInterval(readTimer);
    readTimer = setInterval(async () => {
        if (!currentUser || !rankingReady) return;
        if (document.hidden) return; // Tab not focused

        // Must have been active in last 45 seconds AND scrolled since last award
        const idleSeconds = (Date.now() - lastActivityTime) / 1000;
        if (idleSeconds > 45) return; // AFK
        if (!hasScrolledSinceLastAward) return; // No scrolling

        readSeconds++;
        // Track for Nacho bubble quiz trigger — only write every 5s to avoid sync I/O every second
        if (readSeconds % 5 === 0) sessionStorage.setItem('btc_channel_read_seconds', readSeconds.toString());
        if (readSeconds - lastReadAward >= 30) {
            lastReadAward = readSeconds;
            hasScrolledSinceLastAward = false;

            // Anti-abuse: max 5 read rewards per channel per day
            var _chId = window.currentChannelId || 'unknown';
            var _readCapKey = 'btc_read_cap_' + _chId + '_' + new Date().toISOString().split('T')[0];
            var _readCount = parseInt(localStorage.getItem(_readCapKey) || '0');
            if (_readCount >= 5) return; // capped for this channel today
            localStorage.setItem(_readCapKey, (_readCount + 1).toString());

            // Use awardPoints for global daily cap enforcement
            await awardPoints(POINTS.readTime, '');
        }
    }, 1000);
}

function getLevel(points) {
    let level = LEVELS[0];
    for (const l of LEVELS) {
        if (points >= l.min) level = l;
    }
    const nextIdx = LEVELS.indexOf(level) + 1;
    const next = nextIdx < LEVELS.length ? LEVELS[nextIdx] : null;
    return { ...level, next };
}

function updateGuestPointsBanner() {
    var banner = document.getElementById('guestPointsBanner');
    if (!currentUser || !auth || !auth.currentUser) {
        if (banner) banner.style.display = 'none';
        return;
    }
    var isAnon = auth.currentUser.isAnonymous;
    if (!isAnon) {
        if (banner) banner.style.display = 'none';
        return;
    }
    // Mobile: don't show old guest banner - user info is in the mobile top bar
    if (window.innerWidth <= 900) {
        if (banner) banner.style.display = 'none';
        return;
    }
    var pts = currentUser.points || 0;
    if (pts < 1) {
        if (banner) banner.style.display = 'none';
        return;
    }
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'guestPointsBanner';
        banner.style.cssText = 'position:fixed;top:12px;right:20px;z-index:200;display:flex;align-items:center;gap:10px;padding:10px 16px;background:linear-gradient(135deg,#1a1a2e,#2d1f4e);border:2px solid #f7931a;border-radius:14px;box-shadow:0 4px 20px rgba(247,147,26,0.3);font-size:0.85rem;cursor:pointer;transition:0.3s;max-width:320px;';
        banner.onclick = function(e) {
            // Don't trigger sign-in if the click was on the minimize toggle
            if (e && e.target && e.target.closest && e.target.closest('.banner-toggle')) return;
            showSignInPrompt();
        };
        document.body.appendChild(banner);
    }
    // Restore previous minimized state so users don't have to re-minimize on every page nav
    try {
        if (localStorage.getItem('btc_signin_banner_min') === '1') banner.classList.add('banner-min');
        else banner.classList.remove('banner-min');
    } catch(e) {}
    var lv = getLevel(pts);
    var isMin = banner.classList.contains('banner-min');
    banner.innerHTML =
        '<div style="display:flex;flex-direction:column;gap:2px;">' +
            '<div style="display:flex;align-items:center;gap:6px;">' +
                '<span style="font-size:1.2rem;">' + lv.emoji + '</span>' +
                '<span style="color:#f7931a;font-weight:800;font-size:1rem;">' + pts.toLocaleString() + ' XP</span>' +
            '</div>' +
            '<div style="color:#ccc;font-size:0.75rem;">Sign in to keep your XP & get on the leaderboard!</div>' +
        '</div>' +
        '<div style="background:#f7931a;color:#000;padding:6px 14px;border-radius:10px;font-weight:800;font-size:0.8rem;white-space:nowrap;flex-shrink:0;">Sign Up Free →</div>' +
        '<button class="banner-toggle" aria-label="' + (isMin ? 'Expand' : 'Close') + ' sign-in banner" onclick="event.stopPropagation();toggleGuestPointsBanner()" style="' + (isMin ? 'background:rgba(0,0,0,0.35);border:none;border-radius:8px;color:#f7931a;font-weight:900;font-size:1.1rem;line-height:1;padding:6px 9px;cursor:pointer;font-family:inherit;flex-shrink:0;touch-action:manipulation;' : 'position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;background:#111;border:1.5px solid #f7931a;color:#f7931a;font-weight:900;font-size:0.8rem;line-height:1;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;padding:0;touch-action:manipulation;box-shadow:0 2px 6px rgba(0,0,0,0.5);') + '">' + (isMin ? '⚡' : '✕') + '</button>';
    banner.style.display = 'flex';
}

window.toggleGuestPointsBanner = function() {
    var banner = document.getElementById('guestPointsBanner');
    if (!banner) return;
    var willMin = !banner.classList.contains('banner-min');
    banner.classList.toggle('banner-min', willMin);
    try { localStorage.setItem('btc_signin_banner_min', willMin ? '1' : '0'); } catch(e) {}
    updateGuestPointsBanner();
};

// ── Daily Cap Visual Indicator ──
function _updateCapIndicator(atCap) {
    var el = document.getElementById('userDisplay');
    if (!el) return;
    var _today = new Date().toISOString().split('T')[0];
    var _dailyKey = 'btc_daily_pts_' + _today;
    var _dailyPts = parseInt(localStorage.getItem(_dailyKey) || '0');
    if (atCap || _dailyPts >= 1000) {
        el.style.borderColor = '#ef4444';
        el.style.boxShadow = '0 0 12px rgba(239,68,68,0.3)';
        el.title = 'Daily XP cap reached (1,000). Full through 500, half through 900, then a quarter.';
        // Add cap badge if not present
        if (!document.getElementById('dailyCapBadge')) {
            var badge = document.createElement('span');
            badge.id = 'dailyCapBadge';
            badge.style.cssText = 'position:absolute;top:-6px;left:-6px;background:#ef4444;color:#fff;font-size:0.55rem;font-weight:800;padding:2px 6px;border-radius:8px;z-index:2;pointer-events:none;';
            badge.textContent = 'CAP';
            el.style.position = 'fixed'; // ensure positioned
            el.appendChild(badge);
        }
    } else {
        el.style.borderColor = 'var(--border)';
        el.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        el.title = '';
        var badge = document.getElementById('dailyCapBadge');
        if (badge) badge.remove();
    }
}

function _checkCapOnLoad() {
    var _today = new Date().toISOString().split('T')[0];
    var _dailyKey = 'btc_daily_pts_' + _today;
    var _dailyPts = parseInt(localStorage.getItem(_dailyKey) || '0');
    if (_dailyPts >= 1000) {
        setTimeout(function() { _updateCapIndicator(true); }, 2000);
    }
}

function updateRankUI() {
    if (!currentUser) return;

    const lv = getLevel(currentUser.points || 0);

    // PERSISTENCE FIX: Ensure we don't celebrate 0 -> current on load
    // Initialize if this is the first ever run of updateRankUI
    if (!lastLevelName && lv.name) {
        lastLevelName = lv.name;
        lastLevelMin = lv.min;
    }

    // Always update the top-right user display, even if rankBar doesn't exist
    updateGuestPointsBanner();
    updateUserDisplay(lv);

    // Detect level-up - only celebrate going UP, never on initial load
    const highestLevelSeen = parseInt(localStorage.getItem('btc_highest_level_seen') || '0');
    if (levelUpReady && lastLevelName && lastLevelName !== lv.name && lv.min > lastLevelMin && lv.min > highestLevelSeen) {
        showLevelUpCelebration(lv);
        localStorage.setItem('btc_highest_level_seen', lv.min.toString());
        if (typeof notifySelfLevelUp === 'function') notifySelfLevelUp(lv.min, lv.name, lv.emoji);
        // Announce level-up directly to News tab (independent of SF contribution)
        if (typeof window.nachoGlobalAnnounce === 'function'
            && typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) {
            var _lvUsername = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : null;
            if (_lvUsername) {
                window.nachoGlobalAnnounce(
                    '📊 @' + _lvUsername + ' just leveled up to ' + (lv.emoji || '') + ' ' + lv.name + '! ➡️ [Leaderboard](https://bitcoineducation.quest/#leaderboard)',
                    auth.currentUser.uid
                );
            }
        }

        // Satoshi's Favor contribution for level-ups - fire-and-forget
        if (typeof window.contributeSatoshiFavor === 'function') {
            var levelName = lv.name || '';
            var source = null;
            if (['Pleb','Pleb II','Pleb III','Stacker','Stacker II','Stacker III'].includes(levelName)) {
                source = 'level_up';
            } else if (['Maxi','Maxi II','Maxi III'].includes(levelName)) {
                source = 'level_up_5';
            } else if (['Papa John','Full Node','Whale','Sovereign','Cypherpunk','Satoshi'].includes(levelName)) {
                source = 'level_up_10';
            }
            if (source) {
                window.contributeSatoshiFavor(source, levelName);
            }
        }
    }
    lastLevelName = lv.name;
    lastLevelMin = lv.min;

    const bar = document.getElementById('rankBar');
    if (!bar) return;

    let progressHtml = '';
    if (lv.next) {
        const pct = Math.min(100, ((currentUser.points - lv.min) / (lv.next.min - lv.min)) * 100);
        progressHtml = '<div class="rank-progress"><div class="rank-progress-fill" style="width:' + pct + '%"></div></div>' +
            '<div class="rank-next">' + (lv.next.min - currentUser.points) + ' XP to ' + lv.next.emoji + ' ' + lv.next.name + '</div>';
    }

    const isAnon = auth.currentUser && auth.currentUser.isAnonymous;
    const signInLink = isAnon && currentUser.username ? '<div style="font-size:0.7rem;margin-top:4px;"><a href="#" onclick="event.stopPropagation();showSignInPrompt();return false;" style="color:var(--link);text-decoration:none;">🔗 Sign in to sync across devices</a></div>' : '';

    const streak = currentUser.streak || 0;
    const isMilestone = streak > 0 && (streak % 7 === 0 || streak === 30 || streak === 100 || streak === 365);
    const bestStreakVal = currentUser.bestStreak || 0;
    const streakHtml = (streak > 0 || bestStreakVal > 0) ? '<span class="rank-streak' + (isMilestone ? ' streak-milestone' : '') + '" style="color:#f97316;font-size:0.7rem;font-weight:700;' + (isMilestone ? 'animation:streakGlow 2s ease-in-out infinite;' : '') + '">🔥 ' + streak + (bestStreakVal > 0 ? '(' + bestStreakVal + ')' : '') + ' day streak' + (isMilestone ? ' ✨' : '') + '</span>' : '';
    const ticketHtml = (currentUser.orangeTickets || 0) > 0 ? '<span style="color:#f7931a;font-size:0.7rem;font-weight:700;margin-left:6px;"><svg viewBox="0 0 24 24" style="width:1em;height:1em;vertical-align:-0.15em;display:inline-block"><path fill="#f7931a" d="M22 10V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v4c1.1 0 2 .9 2 2s-.9 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2z"/></svg>' + currentUser.orangeTickets + '</span>' : '';

    // Cosmetics: profile frame glow
    var _ownedCosmetics = currentUser.ownedCosmetics || [];
    var _hasFrame = _ownedCosmetics.indexOf('profile_frame') !== -1;
    if (_hasFrame) {
        bar.style.boxShadow = '0 0 0 2px #f7931a, 0 0 14px rgba(247,147,26,0.4)';
        bar.style.border = '2px solid #f7931a';
    } else {
        bar.style.boxShadow = '';
        bar.style.border = '';
    }

    // Cosmetics: Nacho skin - show deer avatar next to username
    var _hasNachoSkin = _ownedCosmetics.indexOf('nacho_skin_nook') !== -1;
    var _nachoAvatarHtml = _hasNachoSkin
        ? '<img src="/nacho-deer.svg" style="width:18px;height:18px;border-radius:50%;border:1px solid #f7931a;vertical-align:-4px;margin-right:2px;filter:drop-shadow(0 0 4px rgba(247,147,26,0.6));" onerror="this.replaceWith(document.createTextNode(String.fromCodePoint(129420)))" />'
        : '';

    // Cosmetics: pinned badge
    var _pinnedBadgeHtml = '';
    if (currentUser.pinnedBadgeId) {
        var _pBadge = null;
        if (typeof BADGE_DEFS !== 'undefined') {
            for (var _bi = 0; _bi < BADGE_DEFS.length; _bi++) {
                if (BADGE_DEFS[_bi].id === currentUser.pinnedBadgeId) { _pBadge = BADGE_DEFS[_bi]; break; }
            }
        }
        if (_pBadge) {
            _pinnedBadgeHtml = '<span style="font-size:0.65rem;color:var(--text-muted);margin-left:4px;" title="' + escapeHtml(_pBadge.name) + '">' + escapeHtml(_pBadge.emoji) + ' ' + escapeHtml(_pBadge.name) + '</span>';
        }
    }

    bar.innerHTML =
        '<div class="rank-info" onclick="toggleLeaderboard()">' +
            '<span class="rank-level">' + lv.emoji + ' ' + lv.name + '</span>' +
            '<span class="rank-user">' + _nachoAvatarHtml + escapeHtml(currentUser.username || 'Anon') + '</span>' +
            '<span class="rank-pts">' + (currentUser.points || 0).toLocaleString() + ' XP</span>' +
            streakHtml + ticketHtml + _pinnedBadgeHtml +
        '</div>' + progressHtml + signInLink;
    bar.style.display = 'flex';

}

// Get user's display emoji - chosen badge or default level emoji
function getUserDisplayEmoji(lv) {
    var chosenBadge = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.displayBadge : null;
    if (chosenBadge) {
        // Look in BADGE_DEFS
        if (typeof BADGE_DEFS !== 'undefined') {
            for (var i = 0; i < BADGE_DEFS.length; i++) {
                if (BADGE_DEFS[i].id === chosenBadge) return BADGE_DEFS[i].emoji;
            }
        }
        // Look in HIDDEN_BADGES
        if (typeof HIDDEN_BADGES !== 'undefined') {
            for (var j = 0; j < HIDDEN_BADGES.length; j++) {
                if (HIDDEN_BADGES[j].id === chosenBadge) {
                    return HIDDEN_BADGES[j].hidden ? (HIDDEN_BADGES[j].revealEmoji || HIDDEN_BADGES[j].emoji) : HIDDEN_BADGES[j].emoji;
                }
            }
        }
    }
    return lv ? lv.emoji : '🌱';
}

function updateUserDisplay(lv) {
    // Suppress user display during direct link cooldown
    if (window._directLinkMode) {
        var _ud = document.getElementById('userDisplay');
        if (_ud) _ud.style.display = 'none';
        return;
    }
    // Hide old guest banner - we now use unified display
    var guestBanner = document.getElementById('guestPointsBanner');
    if (guestBanner) guestBanner.style.display = 'none';

    var isAnon = auth && auth.currentUser && auth.currentUser.isAnonymous && !currentUser.username;
    var hasUsername = currentUser && currentUser.username;
    var pts = (currentUser.points || 0);
    var streakBit = (currentUser.streak || 0) > 0 ? '<span style="color:#f97316;font-weight:700;font-size:0.7rem;">🔥' + currentUser.streak + '</span>' : '';
    var displayEmoji = getUserDisplayEmoji(lv);

    let el = document.getElementById('userDisplay');
    if (!el) {
        el = document.createElement('div');
        el.id = 'userDisplay';
        document.body.appendChild(el);
    }

    if (isAnon || (auth.currentUser && auth.currentUser.isAnonymous && !hasUsername)) {
        // Mobile: hide the fixed overlay - user info already lives in the mobile top bar.
        // Anonymous users on mobile see their stats in #mobileUserInfo, no need for the
        // intrusive bottom sign-up banner.
        var _isMob = window.innerWidth <= 900;
        if (_isMob) {
            el.setAttribute('data-mob-hidden', '1');
            el.style.display = 'none';
            return;
        }
        // If user dismissed the banner this session, keep it hidden.
        // Use a CSS class (which also has !important) so the "display:flex !important"
        // mobile rule can't resurrect it.
        if (sessionStorage.getItem('btc_signin_banner_dismissed') === '1') {
            el.classList.add('user-hidden');
            el.style.display = 'none';
            return;
        }
        // Otherwise ensure the hide class is removed (re-expanded state)
        el.classList.remove('user-hidden');
        // Consolidated Metric Dashboard + Guest Sign-in
        el.setAttribute('data-anon', '1');

        // NEW POSITIONING: Under sidebar branding for tablet/laptop
        if (!_isMob) {
            var sidebarHeader = document.querySelector('.sidebar-header');
            if (sidebarHeader && !document.getElementById('userDisplayContainer')) {
                var container = document.createElement('div');
                container.id = 'userDisplayContainer';
                container.style.padding = '16px 20px 24px';
                                sidebarHeader.parentNode.insertBefore(container, sidebarHeader.nextSibling);
                container.appendChild(el);
            }
            // Add horizontal row for Dashboard + Notifications
            el.style.cssText = 'position:relative;top:auto;right:auto;z-index:10;display:flex;flex-direction:row;align-items:center;gap:10px;padding:12px;background:rgba(247,147,26,0.05);border:1px solid rgba(247,147,26,0.2);border-radius:12px;cursor:default;transition:0.3s;width:100%;';
        } else {
            el.style.cssText = 'position:fixed;bottom:var(--above-fab, calc(72px + env(safe-area-inset-bottom, 0px) + 12px + 48px + 10px));left:12px;right:12px;z-index:200;display:flex;align-items:center;gap:10px;padding:10px 16px;background:linear-gradient(135deg,#1a1a2e,#2d1f4e);border:2px solid #f7931a;border-radius:14px;box-shadow:0 4px 20px rgba(247,147,26,0.3);font-size:0.85rem;cursor:pointer;';
        }

        el.onclick = function(e) { if(!_isMob && e.target.closest('button')) return; showSettingsPage('account'); };

        el.innerHTML =
            (_isMob ? '<button onclick="event.stopPropagation();minimizeSignUpBanner();" style="position:absolute;top:-8px;right:-8px;background:var(--bg-side,#1a1a2e);border:1px solid var(--border,#333);color:var(--text-muted,#888);width:24px;height:24px;border-radius:50%;font-size:0.75rem;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:1;padding:0;line-height:1;">▼</button>' : '') +
            '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;width:100%;">' +
                    '<div style="display:flex;align-items:center;gap:6px;">' +
                        '<span style="font-size:1.1rem;">' + lv.emoji + '</span>' +
                        '<span style="color:var(--text);font-weight:700;font-size:0.8rem;">GUEST</span>' +
                        '<span style="color:#f7931a;font-weight:800;font-size:0.8rem;">' + pts.toLocaleString() + ' XP</span>' +
                    '</div>' +
                '</div>' +
                (function() {
                    var cp = parseFloat(localStorage.getItem('btc_last_price')) || 0;
                    var ch = parseInt(localStorage.getItem('btc_last_height')) || 0;
                    if (typeof nachoLiveData !== 'undefined' && nachoLiveData.price) cp = nachoLiveData.price;
                    if (typeof nachoLiveData !== 'undefined' && nachoLiveData.blockHeight) ch = nachoLiveData.blockHeight;

                    var s = '<div id="userDisplayLive" style="display:flex;align-items:center;gap:12px;padding-top:4px;' + (_isMob ? 'font-size:0.7rem;' : 'font-size:0.75rem;') + '">';
                    if (cp) s += '<div style="display:flex;align-items:center;gap:4px;"><span style="color:#f7931a;font-weight:900;">₿</span> <span style="color:var(--heading);font-weight:800;font-family:monospace;">$' + Math.round(cp).toLocaleString() + '</span></div>';
                    if (ch) s += '<a href="https://mempool.space" target="_blank" rel="noopener" onclick="event.stopPropagation();" style="display:flex;align-items:center;gap:4px;color:var(--text-muted);text-decoration:none;font-weight:700;" title="View on mempool.space"><span style="color:#6366f1;">⛓️</span> <span style="font-family:monospace;">' + ch.toLocaleString() + '</span></a>';
                    return s + '</div>';
                })() +
                (_isMob ? '<div style="color:#aaa;font-size:0.7rem;margin-top:2px;">Sign in to keep your XP!</div>' : '') +
            '</div>' +
            (!_isMob ? '<div id="notifBellPlaceholder" style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;"></div>' : '') +
            (!_isMob ? '<div onclick="event.stopPropagation();showUsernamePrompt();" style="background:#f7931a;color:#000;padding:6px 12px;border-radius:8px;font-weight:900;font-size:0.65rem;white-space:nowrap;cursor:pointer;">SIGN UP</div>' : '') +
            (_isMob ? '<div onclick="event.stopPropagation();showUsernamePrompt();" style="margin-left:auto;background:#f7931a;color:#000;padding:6px 14px;border-radius:10px;font-weight:800;font-size:0.8rem;white-space:nowrap;">Sign Up →</div>' : '');
    } else {
        // Signed in user
        el.removeAttribute('data-anon');
        el.removeAttribute('data-mob-hidden');
        var _isMob = window.innerWidth <= 900;

        // dashboardFloatBtn is static HTML - just ensure onclick is wired
        var dashBtn = document.getElementById('dashboardFloatBtn');
        if (!dashBtn) {
            dashBtn = document.createElement('div');
            dashBtn.id = 'dashboardFloatBtn';
            dashBtn.className = 'fab-btn';
            dashBtn.innerHTML = '📊';
            dashBtn.title = 'Bitcoin Metrics';
            document.body.appendChild(dashBtn);
        }
        dashBtn.onclick = function() { if (typeof toggleDashboard === 'function') toggleDashboard(); };

        // Mobile: hide the fixed overlay entirely - user info lives in the mobile-bar instead
        if (_isMob) {
            el.style.display = 'none';
            // updateRankUI will populate #mobileUserInfo in the mobile-bar
            return;
        }

        if (!_isMob) {
            var sidebarHeader = document.querySelector('.sidebar-header');
            if (sidebarHeader && !document.getElementById('userDisplayContainer')) {
                var container = document.createElement('div');
                container.id = 'userDisplayContainer';
                container.style.padding = '16px 20px 24px';
                                sidebarHeader.parentNode.insertBefore(container, sidebarHeader.nextSibling);
                container.appendChild(el);
            }
            el.style.cssText = 'position:relative;top:auto;right:auto;z-index:10;display:flex;flex-direction:row;align-items:center;gap:10px;padding:10px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;cursor:pointer;width:100%;';
        } else {
            el.style.cssText = 'position:fixed;top:12px;right:20px;z-index:200;display:flex;align-items:center;gap:8px;padding:8px 14px;background:var(--bg-side);border:1px solid var(--border);border-radius:10px;font-size:0.8rem;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.2);';
        }

        // Clicking the user display opens settings (except block height link)
        el.onclick = function(e) { if (e.target.closest('a')) return; showSettings(); };

        var displayName = currentUser.username || (auth.currentUser && auth.currentUser.displayName) || 'Anon';

        // Show BOTH display badge and rank emoji if a badge is selected
        var chosenBadge = currentUser.displayBadge;
        var iconsHtml = '';
        if (chosenBadge) {
            iconsHtml = '<span style="font-size:1.1rem;margin-right:2px;">' + displayEmoji + '</span> ' +
                         '<span style="font-size:0.9rem;opacity:0.7;">' + lv.emoji + '</span>';
        } else {
            iconsHtml = '<span style="font-size:1.1rem;">' + lv.emoji + '</span>';
        }

        el.innerHTML =
            '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;">' +
               '<div style="display:flex;align-items:center;gap:6px;">' +
                   iconsHtml +
                   '<span style="color:var(--heading);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(displayName) + '</span>' +
                   (streakBit ? '<span style="margin-left:4px;">' + streakBit + '</span>' : '') +
               '</div>' +
               (function() {
                    var cp = parseFloat(localStorage.getItem('btc_last_price')) || 0;
                    var ch = parseInt(localStorage.getItem('btc_last_height')) || 0;
                    if (typeof nachoLiveData !== 'undefined' && nachoLiveData.price) cp = nachoLiveData.price;
                    if (typeof nachoLiveData !== 'undefined' && nachoLiveData.blockHeight) ch = nachoLiveData.blockHeight;
                    var s = '<div id="userDisplayLive" style="display:flex;align-items:center;gap:12px;font-size:0.7rem;opacity:0.8;">';
                    if (cp) s += '<div style="display:flex;align-items:center;gap:4px;"><span style="color:#f7931a;font-weight:900;">₿</span> <span style="font-family:monospace;">$' + Math.round(cp).toLocaleString() + '</span></div>';
                    if (ch) s += '<a href="https://mempool.space" target="_blank" rel="noopener" onclick="event.stopPropagation();" style="display:flex;align-items:center;gap:4px;color:#aaa;text-decoration:none;" title="View on mempool.space"><span style="color:#6366f1;">⛓️</span> <span style="font-family:monospace;">' + ch.toLocaleString() + '</span></a>';
                    s += '<span style="color:#f7931a;font-weight:700;">' + pts.toLocaleString() + ' XP</span>';
                    return s + '</div>';
                })() +
               (function() {
                    var _pof = (typeof currentUser !== 'undefined' && currentUser) ? parseInt(currentUser.pendingOverflow || 0, 10) : 0;
                    if (_pof <= 0) return '';
                    var _dLeft = Math.ceil(_pof / 1000);
                    return '<div onclick="event.stopPropagation();if(typeof showSettingsPage===\'function\')showSettingsPage(\'sats\')" style="display:flex;align-items:center;gap:5px;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.3);border-radius:6px;padding:4px 7px;margin-top:4px;cursor:pointer;" title="Queued overflow XP — drips 1,000 XP/day on your next visits">' +
                        '<span style="font-size:0.65rem;">⏳</span>' +
                        '<span style="font-size:0.6rem;font-weight:700;color:#a5b4fc;">Queued:</span>' +
                        '<span style="font-size:0.6rem;font-weight:900;font-family:monospace;color:#c7d2fe;">+' + _pof.toLocaleString() + ' XP</span>' +
                        '<span style="font-size:0.55rem;color:#6366f1;font-weight:700;margin-left:auto;">~' + _dLeft + 'd</span>' +
                    '</div>';
                })() +
            '</div>' +
            (!_isMob ? '<div id="notifBellPlaceholder" style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;"></div>' : '');
    }
    el.style.display = 'flex';

    // dashboardFloatBtn is now created earlier (before mobile early-return) to ensure it shows on mobile too

    // Update mobile top bar user info (username + price + block height + pts)
    const mobileInfo = document.getElementById('mobileUserInfo');
    if (mobileInfo && window.innerWidth <= 900) {
        var chosenBadge = currentUser.displayBadge;
        var mobileIcons = displayEmoji;
        if (chosenBadge) mobileIcons += ' ' + lv.emoji;
        var pts = (currentUser.points || 0);
        var _cp = parseFloat(localStorage.getItem('btc_last_price')) || 0;
        var _ch = parseInt(localStorage.getItem('btc_last_height')) || 0;
        if (typeof nachoLiveData !== 'undefined' && nachoLiveData.price) _cp = nachoLiveData.price;
        if (typeof nachoLiveData !== 'undefined' && nachoLiveData.blockHeight) _ch = nachoLiveData.blockHeight;
        var nameStr = escapeHtml(currentUser.username || (isAnon ? 'Anonymous' : 'Anon'));
        var s = '<span style="cursor:pointer;" onclick="if(typeof showSettings===\'function\')showSettings()">' + mobileIcons + ' <b>' + nameStr + '</b></span>';
        if (_cp) s += ' <span style="color:#f7931a;font-weight:900;">₿</span> <span style="font-family:monospace;">$' + Math.round(_cp).toLocaleString() + '</span>';
        if (_ch) s += ' <span style="color:#6366f1;">⛓️</span> <span style="font-family:monospace;">' + _ch.toLocaleString() + '</span>';
        s += ' <span style="color:#f7931a;font-weight:700;">' + pts.toLocaleString() + ' XP</span>';
        var _mobOf = (typeof currentUser !== 'undefined' && currentUser) ? parseInt(currentUser.pendingOverflow || 0, 10) : 0;
        if (_mobOf > 0) s += ' <span onclick="event.stopPropagation();if(typeof showSettingsPage===\'function\')showSettingsPage(\'sats\')" style="display:inline-flex;align-items:center;gap:2px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.35);border-radius:4px;padding:1px 5px;cursor:pointer;" title="Queued overflow XP"><span style="font-size:0.55rem;">⏳</span><span style="font-size:0.58rem;font-weight:800;font-family:monospace;color:#a5b4fc;">+' + _mobOf.toLocaleString() + '</span></span>';
        mobileInfo.innerHTML = s;
        mobileInfo.style.display = 'inline';
        mobileInfo.style.maxWidth = 'none';
    }

    // Update home page welcome banner
    const wb = document.getElementById('welcomeBanner');
    if (wb && currentUser.username) {
        // Sync auth button whenever we update the welcome banner to ensure identity consistency
        updateAuthButton();

        const streak = currentUser.streak || 0;
        const wbBestStreak = currentUser.bestStreak || 0;
        const streakText = (streak > 0 || wbBestStreak > 0) ? '<span style="color:#f97316;font-weight:700;"> · 🔥 ' + streak + (wbBestStreak > 0 ? '(' + wbBestStreak + ')' : '') + ' day streak</span>' : '';
        wb.innerHTML = '<span style="font-size:1.2rem;">' + lv.emoji + '</span> ' +
            '<span style="color:var(--heading);font-weight:700;">Welcome back, ' + escapeHtml(currentUser.username || 'Anon') + '!</span>' +
            '<span style="color:var(--text-muted);font-size:0.85rem;"> · ' + lv.name + ' · ' + (currentUser.points || 0).toLocaleString() + ' XP</span>' +
            streakText +
            '<div style="color:var(--text-faint);font-size:0.75rem;margin-top:4px;">⚙️ Tap here for Account & Settings</div>';
        wb.style.display = 'block';
        wb.removeAttribute('data-simplified-hidden');
    }
}
let lbAutoShown = false;

function showLeaderboardAuto() {
    if (lbAutoShown) return;
    lbAutoShown = true;
    const lb = document.getElementById('leaderboard');
    if (lb.classList.contains('open')) return;
    toggleLeaderboard();
}

function expandLeaderboard(e) {
    if (e) e.stopPropagation();
    document.querySelectorAll('.lb-extra').forEach(el => el.style.display = 'flex');
    const btn = document.getElementById('lbShowMore');
    if (btn) btn.remove();
}

function minimizeLeaderboard() {
    const lb = document.getElementById('leaderboard');
    const fab = document.getElementById('lbFloatBtn');
    lb.classList.remove('open');
    lb.classList.remove('minimized');
    if (fab) fab.style.display = 'flex';
}

function hideLeaderboard() {
    const lb = document.getElementById('leaderboard');
    const fab = document.getElementById('lbFloatBtn');
    lb.classList.remove('open');
    lb.classList.remove('minimized');
    if (fab) fab.style.display = 'flex';
}

// Leaderboard username search
var _lbSearchTimer = null;
var _lbSearchQuery = '';
var _lbSearchLastRank = 0;
var _lbSearchHasMore = false;
var _lbSearchLoading = false;
var _lbSearchGeneration = 0; // incremented on every new query; stale in-flight results self-discard

function _lbBuildResultRow(u) {
    var pts = (u.points || 0).toLocaleString();
    var lv = typeof getLevel === 'function' ? getLevel(u.points || 0) : { emoji: '' };
    var factionStyle = u.faction && typeof window._factionNameStyle === 'function' ? ' style="' + window._factionNameStyle(u.faction) + '"' : '';
    var peerTag = (window._myPeers && window._myPeers.has(u.uid || u.id || '')) ? '<span title="Your peer" style="margin-right:2px;">🧡</span>' : '';
    return '<div class="lb-search-result">' +
        '<span>' + lv.emoji + '</span>' +
        '<a' + factionStyle + ' onclick="showUserProfile(\'' + escapeHtml(u.uid) + '\')">' + peerTag + escapeHtml(u.username || 'Anon') + '</a>' +
        '<span class="lb-sr-pts">' + pts + ' XP · <strong>' + (u.rank ? '#' + u.rank : '—') + '</strong></span>' +
    '</div>';
}

async function _lbSearchLoad(query, afterRank, append) {
    // Stamp this call; any older in-flight request will discard its results when it lands
    var myGen = ++_lbSearchGeneration;
    // For fresh searches, always proceed (cancel previous); for load-more, gate on flag
    if (!append) {
        _lbSearchLoading = false; // release any stuck lock from previous query
    } else if (_lbSearchLoading) {
        return;
    }
    _lbSearchLoading = true;
    var resultEl = document.getElementById('lbSearchResult');
    if (!resultEl) { _lbSearchLoading = false; return; }

    // Remove old load-more button if present
    var oldBtn = document.getElementById('lbSearchMoreBtn');
    if (oldBtn) oldBtn.remove();

    if (!append) {
        // Keep any local hits visible; show a subtle spinner below them
        var _existingHits = resultEl.querySelectorAll('.lb-search-result');
        if (!_existingHits.length) {
            resultEl.innerHTML = '<div class="lb-search-none">Searching...</div>';
        } else {
            var spinDiv = document.createElement('div');
            spinDiv.id = 'lbSearchSpinner';
            spinDiv.className = 'lb-search-none';
            spinDiv.style.cssText = 'font-size:0.75rem;opacity:0.5;padding:4px 0;';
            spinDiv.textContent = '\u29d7 Searching all users...';
            resultEl.appendChild(spinDiv);
        }
    } else {
        var loadingRow = document.createElement('div');
        loadingRow.id = 'lbSearchLoadingRow';
        loadingRow.className = 'lb-search-none';
        loadingRow.textContent = 'Loading more...';
        resultEl.appendChild(loadingRow);
    }

    try {
        var searchFn = firebase.functions().httpsCallable('searchUsers');
        var res = await searchFn({ query: query, pageSize: 10, afterRank: afterRank });

        // Stale response - a newer query already took over; silently discard
        if (myGen !== _lbSearchGeneration) { _lbSearchLoading = false; return; }

        var users = (res.data && res.data.users) || [];
        var hasMore = !!(res.data && res.data.hasMore);

        // Remove loading indicators
        var lr = document.getElementById('lbSearchLoadingRow');
        if (lr) lr.remove();
        var sp = document.getElementById('lbSearchSpinner');
        if (sp) sp.remove();

        if (!append && !users.length) {
            // If local hits are already shown, don't wipe them - just remove spinner
            if (!resultEl.querySelector('.lb-search-result')) {
                resultEl.innerHTML = '<div class="lb-search-none">No users found matching \u201c' + escapeHtml(query) + '\u201d</div>';
            }
            _lbSearchLoading = false;
            return;
        }

        if (!append) resultEl.innerHTML = '';
        users.forEach(function(u) { resultEl.insertAdjacentHTML('beforeend', _lbBuildResultRow(u)); });

        _lbSearchLastRank = users.length ? users[users.length - 1].rank : afterRank;
        _lbSearchHasMore = hasMore;

        if (hasMore) {
            var btn = document.createElement('button');
            btn.id = 'lbSearchMoreBtn';
            btn.style.cssText = 'width:100%;padding:8px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:0.8rem;cursor:pointer;font-family:inherit;margin:4px 0 2px;';
            btn.textContent = 'Show more results \u25bc';
            btn.onclick = function() { _lbSearchLoad(_lbSearchQuery, _lbSearchLastRank, true); };
            resultEl.appendChild(btn);
        }
    } catch(e) {
        if (myGen !== _lbSearchGeneration) { _lbSearchLoading = false; return; }
        console.warn('[lbSearch]', e);
        var lr2 = document.getElementById('lbSearchLoadingRow');
        if (lr2) lr2.remove();
        var sp2 = document.getElementById('lbSearchSpinner');
        if (sp2) sp2.remove();
        if (!append && !resultEl.querySelector('.lb-search-result')) {
            resultEl.innerHTML = '<div class="lb-search-none">Search error \u2014 try again</div>';
        }
    }
    _lbSearchLoading = false;
}

window.lbSearchUser = function(val) {
    var resultEl = document.getElementById('lbSearchResult');
    if (!resultEl) return;
    val = (val || '').trim();
    // Clear on empty; allow single-char (catches short usernames)
    if (!val) { resultEl.innerHTML = ''; _lbSearchQuery = ''; _lbSearchGeneration++; clearTimeout(_lbSearchTimer); return; }

    // Track search use for Search Sleuth badge
    try { var _ss = typeof safeJSON === 'function' ? safeJSON('btc_searches_used', []) : JSON.parse(localStorage.getItem('btc_searches_used') || '[]'); if (_ss.indexOf('user') === -1) { _ss.push('user'); localStorage.setItem('btc_searches_used', JSON.stringify(_ss)); } } catch(e) {}

    // Instant local search against already-loaded leaderboard cache (zero latency for top 150)
    var q = val.toLowerCase();
    var localHits = window._lbCache ? window._lbCache.filter(function(u) {
        return (u.username || '').toLowerCase().includes(q);
    }) : [];
    if (localHits.length) {
        resultEl.innerHTML = localHits.slice(0, 10).map(function(u, i) {
            var rank = (window._lbCache ? window._lbCache.indexOf(u) : i) + 1;
            var pts = (u.points || 0).toLocaleString();
            var lv = typeof getLevel === 'function' ? getLevel(u.points || 0) : { emoji: '' };
            var factionStyle = u.faction && typeof window._factionNameStyle === 'function' ? ' style="' + window._factionNameStyle(u.faction) + '"' : '';
            var peerTag = (window._myPeers && window._myPeers.has(u.id || '')) ? '<span title="Your peer" style="margin-right:2px;">🧡</span>' : '';
            return '<div class="lb-search-result">' +
                '<span>' + (lv.emoji || '') + '</span>' +
                '<a' + factionStyle + ' onclick="showUserProfile(\'' + escapeHtml(u.id) + '\')">' + peerTag
                    + escapeHtml(u.username || 'Anon') + '</a>' +
                '<span class="lb-sr-pts">' + pts + ' XP · <strong>#' + rank + '</strong></span>' +
                '</div>';
        }).join('');
        // Still fire cloud search in background to catch users not in top 150
    }

    // Always update query immediately so any in-flight call resolves to latest
    _lbSearchQuery = val;
    clearTimeout(_lbSearchTimer);
    // Shorter debounce for very short queries (mostly resolved from local cache anyway)
    var _debounceMs = val.length <= 2 ? 160 : 260;
    _lbSearchTimer = setTimeout(function() {
        _lbSearchLastRank = 0;
        _lbSearchHasMore = false;
        _lbSearchLoad(val, 0, false);
    }, _debounceMs);
};

// Close leaderboard when clicking/tapping outside.
// Uses capture phase + both mousedown and touchstart so it fires BEFORE
// any inner handler can call stopPropagation() and swallow the event.
function _lbOutsideClose(e) {
    var lb = document.getElementById('leaderboard');
    if (!lb || !lb.classList.contains('open') || lb.classList.contains('minimized')) return;
    if (lb.contains(e.target)) return;
    // Don't close if clicking the rank bar or leaderboard button (those toggle the LB themselves)
    var rankBar = document.getElementById('rankBar');
    if (rankBar && rankBar.contains(e.target)) return;
    var fab = document.getElementById('lbFloatBtn');
    if (fab && fab.contains(e.target)) return;
    // Don't close if a profile modal is open (clicking in the modal shouldn't close the LB behind it)
    var profileModal = document.getElementById('userProfileModal');
    if (profileModal) return;
    // Close it
    lb.classList.remove('open');
    lb.classList.remove('minimized');
    if (fab) fab.style.display = 'flex';
}
document.addEventListener('mousedown', _lbOutsideClose, true);
document.addEventListener('touchstart', _lbOutsideClose, true);

window.toggleOLEDTheme = function() {
    const isOLED = localStorage.getItem('btc_theme_oled') === 'true';
    localStorage.setItem('btc_theme_oled', !isOLED);
    applyOLEDTheme();
    showSettingsPage('prefs');
    showToast(!isOLED ? '🖤 Midnight OLED enabled!' : 'Deep sea mode disabled');
};

function applyOLEDTheme() {
    const isOLED = localStorage.getItem('btc_theme_oled') === 'true';
    const isDark = document.body.getAttribute('data-theme') !== 'light';
    if (isOLED && isDark) {
        document.body.classList.add('oled-theme');
    } else {
        document.body.classList.remove('oled-theme');
    }
}

// Initial apply
document.addEventListener('DOMContentLoaded', applyOLEDTheme);

// ---- Experience Mode Change Handler ----
window._changeExperienceMode = function(mode) {
    if (typeof window.setExperienceMode !== 'function') {
        if (typeof showToast === 'function') showToast('⚠️ Mode change unavailable — reload and try again');
        return;
    }
    window.setExperienceMode(mode);
    if (typeof showToast === 'function') {
        var meta = (typeof window.bqExperienceModeMeta === 'function') ? window.bqExperienceModeMeta(mode) : null;
        var labels = {lite:'📖 Lite activated', beginner:'🌱 Guided activated', intermediate:'📘 Balanced activated', advanced:'🔥 Everything activated'};
        showToast((meta && meta.toast) || labels[mode] || 'Mode updated', 3000);
    }
    // Stay on Prefs so the current check moves with the choice.
    setTimeout(function() {
        if (typeof showSettingsPage === 'function') showSettingsPage('prefs');
        setTimeout(function() {
            var card = document.getElementById('experienceModeCard');
            if (!card) return;
            if (card.scrollIntoView) card.scrollIntoView({ block: 'center' });
            var picked = card.querySelector('[data-mode="' + mode + '"]');
            if (picked && picked.focus) picked.focus();
        }, 40);
    }, 300);
    // Apply visibility changes immediately on home
    setTimeout(function() {
        if (typeof window.applyExperienceModeVisibility === 'function') window.applyExperienceModeVisibility();
        if (typeof window.applyDesktopMenuModes === 'function') window.applyDesktopMenuModes();
    }, 400);
};

// ---- Delete Account ----
window.showDeleteAccountConfirm = function() {
    var overlay = document.createElement('div');
    overlay.id = 'deleteAccountOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:450000;background:rgba(0,0,0,0.92);display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;-webkit-overflow-scrolling:touch;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    var username = (currentUser && currentUser.username) ? currentUser.username : '';
    var shownName = username || 'your account';
    var confirmWord = username || 'DELETE';
    var pts = currentUser ? (currentUser.points || 0) : 0;
    var streak = currentUser ? (currentUser.streak || 0) : 0;
    var directSats = currentUser ? Number(currentUser.sats) : 0;
    var availablePts = currentUser ? ((Number(currentUser.points) || 0) - (Number(currentUser.pointsClaimed) || 0) - (Number(currentUser.pointsDonated) || 0) - (Number(currentUser.pointsExchanged) || 0)) : 0;
    var satsN = directSats > 0 ? directSats : Math.floor(Math.max(0, availablePts) / 10);
    var forfeitHtml = '';
    if (satsN > 0) {
        forfeitHtml = '<div id="deleteForfeitWarning" style="background:rgba(239,68,68,0.12);border:1px solid #ef4444;border-radius:12px;padding:12px;margin-bottom:12px;color:#ef4444;font-size:0.85rem;line-height:1.5;font-weight:700;">Your ' + satsN.toLocaleString() + ' sats balance and any pending sats/withdrawals are forfeited.</div>' +
            '<label style="display:flex;gap:8px;align-items:flex-start;margin-bottom:16px;color:var(--text);font-size:0.85rem;line-height:1.4;"><input id="deleteForfeitCheck" type="checkbox" onclick="window._deleteConfirmReady()" style="margin-top:3px;"> I understand this balance is forfeited.</label>';
    }

    overlay.innerHTML =
        '<div style="background:var(--bg-side,#1a1a2e);border:2px solid #ef4444;border-radius:20px;padding:28px;max-width:420px;width:100%;margin:auto 0;">' +
            '<div style="text-align:center;margin-bottom:16px;"><span style="font-size:3rem;">⚠️</span></div>' +
            '<h2 style="color:#ef4444;text-align:center;margin:0 0 12px;font-size:1.2rem;">Delete Your Account?</h2>' +
            '<div style="color:var(--text);font-size:0.9rem;line-height:1.6;margin-bottom:16px;text-align:center;">' +
                'This will <strong style="color:#ef4444;">permanently delete</strong> everything associated with <strong>' + escapeHtml(shownName) + '</strong>:' +
            '</div>' +
            '<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:14px;margin-bottom:16px;">' +
                '<div style="display:flex;flex-direction:column;gap:6px;font-size:0.85rem;color:var(--text-muted);">' +
                    '<div>❌ <strong>' + pts.toLocaleString() + ' XP</strong> and all badges</div>' +
                    (streak > 0 ? '<div>❌ <strong>' + streak + '-day streak</strong></div>' : '') +
                    '<div>❌ Posts nobody replied to. Posts other people replied to stay up as [deleted]</div>' +
                    '<div>❌ Marketplace listings</div>' +
                    '<div>❌ DM conversations (deleted for both people)</div>' +
                    '<div>❌ Global Chat messages (shown as [deleted])</div>' +
                    '<div>❌ Uploaded music, images, and avatar</div>' +
                    '<div>❌ Notifications and push tokens</div>' +
                    '<div>❌ Nacho chat history</div>' +
                    '<div>❌ Leaderboard ranking</div>' +
                    '<div>❌ Orange Tickets and quest progress</div>' +
                    '<div>❌ Referral signup record</div>' +
                '</div>' +
            '</div>' +
            forfeitHtml +
            '<div style="color:#ef4444;font-weight:700;font-size:0.85rem;text-align:center;margin-bottom:16px;">⚠️ This action is IRREVERSIBLE. There is no undo.</div>' +
            '<div style="margin-bottom:16px;">' +
                '<label style="display:block;font-size:0.75rem;color:var(--text-faint);margin-bottom:6px;">Type <strong style="color:#ef4444;">' + escapeHtml(confirmWord) + '</strong> to confirm:</label>' +
                '<input type="text" id="deleteConfirmInput" data-confirm="' + escapeHtml(confirmWord) + '" placeholder="Type ' + escapeHtml(confirmWord) + '" autocomplete="off" style="width:100%;padding:12px;background:var(--card-bg);border:2px solid var(--border);border-radius:10px;color:var(--text);font-size:1rem;font-family:monospace;text-align:center;outline:none;box-sizing:border-box;" oninput="window._deleteConfirmReady()">' +
            '</div>' +
            '<div style="display:flex;gap:10px;">' +
                '<button onclick="document.getElementById(\'deleteAccountOverlay\').remove()" style="flex:1;padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;font-weight:600;cursor:pointer;font-family:inherit;">Cancel</button>' +
                '<button id="deleteConfirmBtn" disabled onclick="confirmDeleteAccount()" style="flex:1;padding:12px;background:#ef4444;border:none;border-radius:10px;color:#fff;font-size:0.9rem;font-weight:800;cursor:pointer;font-family:inherit;opacity:0.4;transition:0.2s;">🗑️ Delete Forever</button>' +
            '</div>' +
        '</div>';

    document.body.appendChild(overlay);
};

window._deleteConfirmReady = function() {
    var input = document.getElementById('deleteConfirmInput');
    var btn = document.getElementById('deleteConfirmBtn');
    var expected = input ? String(input.getAttribute('data-confirm') || '') : '';
    var typed = input ? String(input.value || '').trim() : '';
    var nameOk = expected ? typed.toLowerCase() === expected.toLowerCase() : false;
    var box = document.getElementById('deleteForfeitCheck');
    var forfeitOk = !box || box.checked;
    if (btn) {
        btn.disabled = !(nameOk && forfeitOk);
        btn.style.opacity = btn.disabled ? '0.4' : '1';
    }
};

window.confirmDeleteAccount = async function() {
    var input = document.getElementById('deleteConfirmInput');
    var expected = input ? String(input.getAttribute('data-confirm') || '') : '';
    var typed = input ? String(input.value || '').trim() : '';
    if (!input || !expected || typed.toLowerCase() !== expected.toLowerCase()) return;
    var forfeitBox = document.getElementById('deleteForfeitCheck');
    if (forfeitBox && !forfeitBox.checked) return;

    var btn = document.getElementById('deleteConfirmBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Deleting...'; }

    try {
        var user = auth.currentUser;
        if (!user) throw new Error('Not signed in');
        if (typeof firebase === 'undefined' || !firebase.functions) {
            throw new Error('Account deletion is unavailable. Reload and try again.');
        }

        var reauthed = await window.reauthForSensitiveAction('deleting your account');
        if (!reauthed) {
            if (btn) { btn.disabled = false; btn.textContent = '🗑️ Delete Forever'; btn.style.opacity = '1'; }
            return;
        }

        // Server wipe. The owner must have signed in recently. A remembered
        // device is not enough: deletion needs a fresh authenticator proof.
        var deletePayload = { confirmUsername: typed };
        if (forfeitBox && forfeitBox.checked) deletePayload.acknowledgeForfeit = true;
        if (mfaNeedsFreshCode()) {
            var deleteProof = await window._showFreshStepUp('deleteAccount');
            if (!deleteProof) {
                if (btn) { btn.disabled = false; btn.textContent = '🗑️ Delete Forever'; btn.style.opacity = '1'; }
                return;
            }
            deletePayload.freshProofId = deleteProof;
        }
        await firebase.functions().httpsCallable('deleteAccount', { timeout: 540000 })(deletePayload);

        var keysToRemove = [];
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key && key.startsWith('btc_')) keysToRemove.push(key);
        }
        keysToRemove.forEach(function(k) { localStorage.removeItem(k); });
        sessionStorage.clear();
        // [AUDIT FIX M5] Clear SW caches on account deletion
        if ('caches' in window) { try { var _ck = await caches.keys(); _ck.forEach(function(k) { caches.delete(k); }); } catch(e) {} }

        // The server deletes the referral signup record with the account, then
        // finishes any Auth session still cached in the browser. The server wipe
        // already deletes the Firebase user, so user-not-found means that step is done.
        try {
            await user.delete();
        } catch (authErr) {
            var authCode = authErr && authErr.code;
            if (authCode !== 'auth/user-not-found' && authCode !== 'auth/user-token-expired') throw authErr;
        }

        // 9. Close overlay and show confirmation
        var overlay = document.getElementById('deleteAccountOverlay');
        if (overlay) overlay.remove();

        // Close settings
        var settingsEl = document.getElementById('settings-overlay') || document.querySelector('[id*="settings"]');
        if (settingsEl) settingsEl.remove();

        showToast('👋 Account deleted. We\'re sorry to see you go.');

        // Reload after brief delay
        setTimeout(function() { window.location.reload(); }, 2000);

    } catch(e) {
        console.error('Account deletion error:', e);
        var code = (e && e.code) || '';
        var msg = (e && e.message) || '';
        if (msg.indexOf('fresh authenticator') !== -1) {
            showToast(_mfaFailure(e));
            if (btn) { btn.disabled = false; btn.textContent = '🗑️ Delete Forever'; btn.style.opacity = '1'; }
            return;
        }
        if (typeof _isMfaBlock === 'function' && _isMfaBlock(e)) {
            showToast(_mfaFailure(e));
            if (typeof _showTotpSignInChallenge === 'function') _showTotpSignInChallenge();
            if (btn) { btn.disabled = false; btn.textContent = '🗑️ Delete Forever'; btn.style.opacity = '1'; }
            return;
        }
        if (/2FA code/i.test(msg)) {
            showToast('Enter your authenticator code first.');
            if (typeof _showTotpSignInChallenge === 'function') _showTotpSignInChallenge();
            if (btn) { btn.disabled = false; btn.textContent = '🗑️ Delete Forever'; btn.style.opacity = '1'; }
            return;
        }
        if (code === 'auth/requires-recent-login' || code === 'functions/failed-precondition' || code === 'failed-precondition' || /sign in again/i.test(msg) || /recent login/i.test(msg)) {
            showToast('🔒 For security, please sign out and sign back in, then try again.');
        } else {
            showToast('Error deleting account: ' + (e.message || 'Unknown error'));
        }
        if (btn) { btn.disabled = false; btn.textContent = '🗑️ Delete Forever'; btn.style.opacity = '1'; }
    }
};

window.toggleGhostMode = async function() {
    if (!currentUser) return;
    const isGhost = !currentUser.ghostMode;
    currentUser.ghostMode = isGhost;

    // Update local state and UI
    showSettingsPage('security');

    // Update Firestore
    try {
        await db.collection('users').doc(auth.currentUser.uid).update({ ghostMode: isGhost });
        showToast(isGhost ? '👻 Ghost Mode enabled!' : 'Visible mode enabled');
    } catch(e) { console.log("Ghost mode update failed:", e); }
};

// Stubs for upcoming features
window.setNachoNickname = function(val) {
    var nick = (val || '').trim();
    if (!nick) return;
    // Save to localStorage (used everywhere)
    localStorage.setItem('btc_nacho_nickname', nick);
    // Save to currentUser object
    if (currentUser) currentUser.nachoNickname = nick;
    // Save to Firestore
    if (typeof db !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) {
        db.collection('users').doc(auth.currentUser.uid).update({ nachoNickname: nick }).catch(function(e) { console.error('[ranking] Error:', e); });
    }
    // Update Nacho's name throughout the app
    if (typeof updateNachoNameUI === 'function') updateNachoNameUI(nick);
    // Update Nacho Mode title if open
    var nmTitle = document.querySelector('.nm-hero-title');
    if (nmTitle) nmTitle.textContent = nick.toUpperCase() + ' MODE';
    // Update bubble header
    var bubbleHeader = document.querySelector('#nacho-bubble .nacho-name, #nacho-name');
    if (bubbleHeader) bubbleHeader.textContent = nick;
    showToast('🦌 Your deer is now named "' + nick + '"!');
    showSettingsPage('data');
};

// Update Nacho's name across all UI elements
window.updateNachoNameUI = function(name) {
    if (!name) return;
    // Nacho Mode title
    var nmTitle = document.querySelector('.nm-hero-title');
    if (nmTitle) nmTitle.textContent = name.toUpperCase() + ' MODE';
    // Sidebar Nacho button
    var sidebarBtn = document.getElementById('sidebarNachoBtn');
    if (sidebarBtn) sidebarBtn.innerHTML = '🦌 ' + name + ' Mode';
    // Bottom nav
    var bnavNacho = document.getElementById('bnavNacho');
    if (bnavNacho) {
        var label = bnavNacho.querySelector('.bnav-label');
        if (label) label.textContent = name;
    }
    // Nacho bubble header
    var bubbleName = document.getElementById('nacho-bubble-name');
    if (bubbleName) bubbleName.textContent = name;
    // Nacho avatar name label
    var avatarName = document.querySelector('.nacho-name');
    if (avatarName) {
        avatarName.innerHTML = name.toUpperCase() + '<br><span style="font-size:0.6rem;opacity:0.8;letter-spacing:0.5px;">Ask me anything about Bitcoin or this app!</span>';
    }
    // Closet header
    var closetHeaders = document.querySelectorAll('[id*="nachoCloset"]');
    closetHeaders.forEach(function(el) {
        var header = el.querySelector('[style*="letter-spacing"]');
        if (header && header.textContent.indexOf("'s Closet") !== -1) {
            header.textContent = '🦌 ' + name + "'s Closet";
        }
    });
    // Story header
    var storyHeaders = document.querySelectorAll('[style*="font-weight:800"]');
    storyHeaders.forEach(function(el) {
        if (el.textContent.indexOf("'s Story") !== -1) {
            el.textContent = name + "'s Story";
        }
    });
};

// Render leaderboard badge emoji - compact multi-emoji into a fixed-size cell
function _lbBadgeEmoji(emoji) {
    // Split emoji string into individual emoji characters (handles multi-byte emoji)
    var chars = [];
    var segs = typeof Intl !== 'undefined' && Intl.Segmenter
        ? Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(emoji)).map(function(s) { return s.segment; })
        : null;
    if (segs) { chars = segs; }
    else {
        // Fallback: split on emoji boundaries (regex for surrogate pairs + variation selectors + ZWJ)
        var m = emoji.match(/\p{Emoji_Presentation}(\u200d\p{Emoji_Presentation})*/gu);
        chars = m ? m : [emoji];
    }
    if (chars.length <= 1) return emoji;
    // 2-3 emoji: render as a compact grid
    var size = chars.length === 2 ? '0.6rem' : '0.5rem';
    var gap = chars.length === 2 ? '0px' : '0px';
    return '<span style="display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:' + gap + ';font-size:' + size + ';line-height:1;width:24px;">' +
        chars.map(function(c) { return '<span>' + c + '</span>'; }).join('') + '</span>';
}

async function toggleLeaderboard() {
    const lb = document.getElementById('leaderboard');
    if (!lb) return;
    const fab = document.getElementById('lbFloatBtn');
    if (lb.classList.contains('open') && !lb.classList.contains('minimized')) {
        lb.classList.remove('open');
        lb.classList.remove('minimized');
        if (fab) fab.style.display = 'flex';
        return;
    }
    // Daily challenge tracking: leaderboard viewed today
    (function(){ var d=new Date(); var dk=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); localStorage.setItem('btc_lb_visited_'+dk,'1'); })();
    // Leaderboard Lurker badge tracking
    (function(){
        var opens = (parseInt(localStorage.getItem('btc_lb_opens') || '0') || 0) + 1;
        localStorage.setItem('btc_lb_opens', opens.toString());
        var milestones = [5, 10, 50, 100, 500];
        var ids = ['lb_lurker_5','lb_lurker_10','lb_lurker_50','lb_lurker_100','lb_lurker_500'];
        milestones.forEach(function(m, i) {
            if (opens === m) {
                var bid = ids[i];
                if (typeof checkBadges === 'function') setTimeout(checkBadges, 400);
                else if (typeof HIDDEN_BADGES !== 'undefined') {
                    var def = HIDDEN_BADGES.find(function(b){ return b.id === bid; });
                    if (def && typeof showBadgeToast === 'function') setTimeout(function(){ showBadgeToast(def); }, 400);
                }
            }
        });
    })();

    lb.classList.remove('minimized');
    lb.innerHTML = '<div style="padding:20px;text-align:center;color:#475569;">Loading leaderboard...</div>';
    lb.classList.add('open');
    if (fab) fab.style.display = 'none';

    // Leaderboard open sound - dramatic reveal
    if ((typeof canPlaySound !== 'function' || canPlaySound()) && (typeof audioEnabled === 'undefined' || audioEnabled)) {
        try {
            if (!window._sharedAudioCtx) window._sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); var ctx = window._sharedAudioCtx; if (ctx.state === "suspended") ctx.resume();
            const vol = typeof audioVolume !== 'undefined' ? audioVolume : 0.5;
            // Rising whoosh + chime
            const now = ctx.currentTime;
            // Whoosh sweep
            const osc1 = ctx.createOscillator();
            const g1 = ctx.createGain();
            osc1.connect(g1); g1.connect(ctx.destination);
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(200, now);
            osc1.frequency.exponentialRampToValueAtTime(800, now + 0.15);
            g1.gain.setValueAtTime(0.08 * vol, now);
            g1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc1.start(now); osc1.stop(now + 0.2);
            // Trophy chime - two bright notes
            [880, 1175].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.connect(g); g.connect(ctx.destination);
                osc.type = 'triangle';
                osc.frequency.value = freq;
                g.gain.setValueAtTime(0.1 * vol, now + 0.1 + i * 0.08);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.1 + i * 0.08 + 0.3);
                osc.start(now + 0.1 + i * 0.08);
                osc.stop(now + 0.1 + i * 0.08 + 0.3);
            });
        } catch(e) {}
    }

    try {
        // Cache leaderboard data for 10 minutes to reduce Firestore reads
        var now = Date.now();
        var _lbPeriod = window._lbPeriod || 'alltime';
        let allUsers = [];

        if (_lbPeriod === 'weekly') {
            var useWeekCache = window._lbWeekCache && window._lbWeekCacheTime && (now - window._lbWeekCacheTime < 600000);
            if (useWeekCache) {
                allUsers = window._lbWeekCache;
            } else {
                const snap = await db.collection('public_profiles').orderBy('weeklyXP', 'desc').limit(150).get();
                snap.forEach(doc => {
                    const d = doc.data();
                    const isMe = auth.currentUser && doc.id === auth.currentUser.uid;
                    if ((d.weeklyXP || 0) > 0 && (!d.ghostMode || isMe)) {
                        allUsers.push({ id: doc.id, ...d, _sortXP: d.weeklyXP || 0 });
                    }
                });
                window._lbWeekCache = allUsers;
                window._lbWeekCacheTime = now;
            }
        } else if (_lbPeriod === 'monthly') {
            var useMonthCache = window._lbMonthCache && window._lbMonthCacheTime && (now - window._lbMonthCacheTime < 600000);
            if (useMonthCache) {
                allUsers = window._lbMonthCache;
            } else {
                const snap = await db.collection('public_profiles').orderBy('monthlyXP', 'desc').limit(150).get();
                snap.forEach(doc => {
                    const d = doc.data();
                    const isMe = auth.currentUser && doc.id === auth.currentUser.uid;
                    if ((d.monthlyXP || 0) > 0 && (!d.ghostMode || isMe)) {
                        allUsers.push({ id: doc.id, ...d, _sortXP: d.monthlyXP || 0 });
                    }
                });
                window._lbMonthCache = allUsers;
                window._lbMonthCacheTime = now;
            }
        } else {
            var useCache = window._lbCache && window._lbCacheTime && (now - window._lbCacheTime < 600000);
            if (useCache) {
                allUsers = window._lbCache;
            } else {
                const snap = await db.collection('public_profiles').orderBy('points', 'desc').limit(150).get();
                snap.forEach(doc => {
                    const d = doc.data();
                    const isMe = auth.currentUser && doc.id === auth.currentUser.uid;
                    if (d.points > 0 && (!d.ghostMode || isMe)) {
                        allUsers.push({ id: doc.id, ...d });
                    }
                });
                window._lbCache = allUsers;
                window._lbCacheTime = now;
            }
        }

        // Period (all-time, weekly, monthly)
        var _lbPeriod = window._lbPeriod || 'alltime';

        let html = '<div class="lb-min-bar">🏆 Leaderboard - tap to expand</div>';
        html += '<div class="lb-header"><h3>🏆 Leaderboard</h3><div><button class="lb-close" onclick="hideLeaderboard()" title="Close">✕</button></div></div>';
        // Period toggle
        html += '<div style="display:flex;gap:4px;padding:0 12px 10px;">';
        [['alltime','All Time'],['weekly','This Week'],['monthly','This Month']].forEach(function(p) {
            var active = _lbPeriod === p[0];
            html += '<button onclick="_lbSwitchPeriod(\'' + p[0] + '\')" style="flex:1;padding:6px 4px;border:1px solid ' + (active ? 'var(--accent)' : 'var(--border)') + ';border-radius:8px;background:' + (active ? 'var(--accent)' : 'none') + ';color:' + (active ? '#fff' : 'var(--text-muted)') + ';font-size:0.72rem;font-weight:' + (active ? '700' : '500') + ';cursor:pointer;font-family:inherit;white-space:nowrap;">' + p[1] + '</button>';
        });
        html += '</div>';
        // Prize banners for weekly/monthly
        if (_lbPeriod === 'weekly') html += '<div style="text-align:center;padding:8px 12px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.25);border-radius:8px;margin:0 12px 10px;font-size:0.72rem;color:var(--accent);font-weight:700;">🏆 Top 10 this week win 25 🎫 Orange Tickets!</div>';
        if (_lbPeriod === 'monthly') html += '<div style="text-align:center;padding:8px 12px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.25);border-radius:8px;margin:0 12px 10px;font-size:0.72rem;color:var(--accent);font-weight:700;">🏆 Top 10 this month win 100 🏟️ Orange Tickets!</div>';
        html += '<div class="lb-search-wrap"><input id="lbSearchInput" type="text" placeholder="🔍 Search username..." oninput="lbSearchUser(this.value)" autocomplete="off" autocorrect="off" spellcheck="false"></div>';
        html += '<div id="lbSearchResult"></div>';
        html += '<div class="lb-list">';

        const showInitial = Math.min(10, allUsers.length);
        allUsers.forEach((d, i) => {
            const rank = i + 1;
            const lv = getLevel(d.points || 0);
            const isMe = auth.currentUser && d.id === auth.currentUser.uid;
            // Sync local points with Firestore if leaderboard has newer data
            if (isMe && currentUser && (d.points || 0) > (currentUser.points || 0)) {
                currentUser.points = d.points;
                updateRankUI();
            }
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '#' + rank;
            const hidden = rank > 10 ? ' style="display:none;" class="lb-row lb-extra' + (isMe ? ' lb-me' : '') + '"' : ' class="lb-row' + (isMe ? ' lb-me' : '') + '"';
            var statusDot = typeof onlineStatusDot === 'function' ? onlineStatusDot(d.lastSeen) : '';

            // Certifications display
            let certIcons = '';
            if (d.earnedHidden && d.earnedHidden.includes('cert_scholar')) certIcons += ' 🎓';
            if (d.earnedHidden && d.earnedHidden.includes('cert_tech')) certIcons += ' 🛠️';

            var _lbTipData = JSON.stringify({recipientName: d.username || 'Anon', recipientUid: d.id, lightningAddress: d.lightningAddress || d.lightning || '', context: 'leaderboard', label: 'Tip ' + (d.username || 'Anon')}).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
            var _lbNameStyle = d.faction ? window._factionNameStyle(d.faction) : '';
            var peerTag = (window._myPeers && window._myPeers.has(d.id || '')) ? '<span title="Your peer" style="margin-right:2px;">🧡</span>' : '';
            html += '<div' + hidden + ' onclick="showUserProfile(\'' + d.id + '\')" style="cursor:pointer;" title="View profile">' +
                '<span class="lb-rank">' + medal + '</span>' +
                '<span class="lb-badge">' + _lbBadgeEmoji(lv.emoji) + '</span>' +
                '<span class="lb-name" ' + (_lbNameStyle ? 'style="' + _lbNameStyle + '"' : '') + '>' + peerTag + escapeHtml(d.username || 'Anon') + statusDot + certIcons + '</span>' +
                '<span class="lb-score">' + (_lbPeriod === 'weekly' ? (d.weeklyXP || 0).toLocaleString() + ' wXP' : _lbPeriod === 'monthly' ? (d.monthlyXP || 0).toLocaleString() + ' mXP' : (d.points || 0).toLocaleString() + ' XP') + '</span>' +
                '<span data-lb-tip="1" onclick="event.stopPropagation();showTipOverlay(JSON.parse(this.getAttribute(\'data-tip-action\').replace(/&quot;/g,\'\\&quot;\')))" data-tip-action="' + _lbTipData + '" style="cursor:pointer;font-size:0.75rem;color:#eab308;margin-left:6px;flex-shrink:0;" title="Tip ' + escapeHtml(d.username || 'Anon') + '">⚡</span>' +
            '</div>';
        });

        if (allUsers.length > 10) {
            html += '<button id="lbShowMore" onclick="expandLeaderboard(event)" style="width:100%;padding:10px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:0.85rem;cursor:pointer;font-family:inherit;margin:8px 0;transition:0.2s;">Show Top ' + Math.min(allUsers.length, 150) + ' Users ▼</button>';
        }
        html += '</div>';

        // Badges section
        if (typeof getBadgeHTML === 'function') {
            html += '<div class="lb-levels"><h4>Your Badges</h4>' + getBadgeHTML() + '</div>';
        }

        // Top Predictors — above PVP. One stats doc holds all three periods.
        html += '<div id="predictorBoard" style="margin-top:24px;padding:16px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;">' +
            '<div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:8px 0;">Loading Top Predictors...</div></div>';

        // Level guide
        // PVP LEADERBOARD
        html += '<div style="margin-top:24px;padding:16px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
            '<h4 style="margin:0;">⚔️ PVP Leaderboard</h4>' +
            '<button onclick="event.stopPropagation();enterPVPMode();" style="padding:6px 14px;background:linear-gradient(135deg,#f7931a,#e8720c);border:none;border-radius:8px;color:#fff;font-size:0.7rem;font-weight:800;cursor:pointer;font-family:inherit;text-transform:uppercase;letter-spacing:0.5px;transition:0.2s;">Enter PVP Lobby</button>' +
            '</div>' +
            '<div id="pvpLeaderboardList"><div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:8px 0;">Loading PVP rankings...</div></div>' +
        '</div>';

        html += '<div class="lb-levels"><h4>Levels</h4>';
        for (const l of LEVELS) {
            html += '<div class="lb-level-row"><span>' + l.emoji + ' ' + l.name + '</span><span>' + (l.min === 0 ? '0 XP' : l.min + '+ XP') + '</span></div>';
        }
        html += '</div>';

        lb.innerHTML = html;

        // Load PVP leaderboard data asynchronously (must be after innerHTML so DOM element exists)
        _loadPredictorLeaderboard();
        _loadPVPLeaderboard();
    } catch(e) {
        console.error('[Leaderboard] Error:', e);
        lb.innerHTML = '<div style="padding:20px;color:#f97316;">Error loading leaderboard: ' + (e.message || 'Unknown error') + '</div>';
    }
}

// Top Predictors — All Time / This Week / This Month, same tab chrome as XP.
var PRED_LB_COPY = {
    weekly: 'This Week: make at least 5 predictions to qualify. Top 5 each win 25 orange tickets.',
    monthly: 'This Month: at least 15 predictions. Top 5 each win 50 orange tickets.',
    alltime: 'All Time: at least 10 predictions.'
};
var PRED_LB_MIN = { weekly: 5, monthly: 15, alltime: 10 };

function _predLbInfoText(period) {
    return PRED_LB_COPY[period] || PRED_LB_COPY.alltime;
}

function _predSafePic(src) {
    if (!src || typeof src !== 'string') return '';
    if (/^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=]+$/i.test(src)) return src;
    if (/^https:\/\/[^\s"'<>]+$/i.test(src) && src.length < 500) return src;
    return '';
}

function _predAvatarHtml(entry) {
    var pic = _predSafePic(entry.profilePic);
    if (pic) {
        return '<img alt="" width="24" height="24" src="' + pic.replace(/"/g, '') + '" style="width:24px;height:24px;border-radius:50%;object-fit:cover;flex-shrink:0;">';
    }
    var raw = (entry.username || 'A').trim().charAt(0).toUpperCase() || 'A';
    var ch = typeof escapeHtml === 'function' ? escapeHtml(raw) : raw;
    return '<span class="lb-badge" aria-hidden="true" style="border-radius:50%;background:rgba(247,147,26,0.18);color:#f7931a;font-size:0.72rem;font-weight:800;">' + ch + '</span>';
}

function _predLbTipEl() {
    var tip = document.getElementById('predLbTip');
    if (!tip) {
        tip = document.createElement('div');
        tip.id = 'predLbTip';
        tip.className = 'pred-lb-tip';
        tip.setAttribute('role', 'tooltip');
        tip.hidden = true;
        document.body.appendChild(tip);
    }
    return tip;
}

var _predLbInfoBound = false;
function _predLbEnsureGlobalHandlers() {
    if (_predLbInfoBound) return;
    _predLbInfoBound = true;
    document.addEventListener('pointerdown', function(e) {
        var tip = document.getElementById('predLbTip');
        var btn = document.getElementById('predLbInfo');
        if (!tip || tip.hidden) return;
        if (btn && (e.target === btn || btn.contains(e.target))) return;
        if (tip.contains(e.target)) return;
        _predLbHideTip();
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') _predLbHideTip();
    });
}

function _predLbPlaceTip() {
    var btn = document.getElementById('predLbInfo');
    var tip = _predLbTipEl();
    if (!btn) return;
    var r = btn.getBoundingClientRect();
    var width = Math.min(280, window.innerWidth - 24);
    var left = Math.max(12, Math.min(r.left, window.innerWidth - width - 12));
    var top = r.bottom + 6;
    if (top + 96 > window.innerHeight) top = Math.max(8, r.top - 96);
    tip.style.position = 'fixed';
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
    tip.style.width = width + 'px';
    tip.style.zIndex = '400000';
}

function _predLbShowTip() {
    var btn = document.getElementById('predLbInfo');
    var tip = _predLbTipEl();
    tip.textContent = _predLbInfoText(window._predLbPeriod || 'alltime');
    tip.hidden = false;
    _predLbPlaceTip();
    if (btn) {
        btn.setAttribute('aria-expanded', 'true');
        btn.setAttribute('aria-describedby', 'predLbTip');
    }
}

function _predLbHideTip() {
    var tip = document.getElementById('predLbTip');
    var btn = document.getElementById('predLbInfo');
    if (tip) tip.hidden = true;
    if (btn) {
        btn.setAttribute('aria-expanded', 'false');
        btn.removeAttribute('aria-describedby');
        btn.removeAttribute('data-pinned');
    }
}

function _predLbToggleInfo(btn) {
    _predLbEnsureGlobalHandlers();
    var tip = _predLbTipEl();
    if (btn && !tip.hidden && btn.getAttribute('data-pinned') === '1') {
        _predLbHideTip();
        return;
    }
    if (btn) btn.setAttribute('data-pinned', '1');
    _predLbShowTip();
}
window._predLbToggleInfo = _predLbToggleInfo;

function _predLbBindInfo() {
    var btn = document.getElementById('predLbInfo');
    if (!btn || btn._predBound) return;
    btn._predBound = true;
    _predLbEnsureGlobalHandlers();
    var hover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
    if (hover) {
        btn.addEventListener('mouseenter', function() { _predLbShowTip(); });
        btn.addEventListener('mouseleave', function() {
            if (btn.getAttribute('data-pinned') !== '1') _predLbHideTip();
        });
    }
    btn.addEventListener('focus', function() { _predLbShowTip(); });
    btn.addEventListener('blur', function() {
        if (btn.getAttribute('data-pinned') !== '1') _predLbHideTip();
    });
}

function _predLbProgressText(period, made) {
    var min = PRED_LB_MIN[period] || PRED_LB_MIN.alltime;
    var n = Math.max(0, Number(made) || 0);
    if (n >= min) return '';
    if (period === 'weekly') return "You've made " + n + " of " + min + " predictions this week.";
    if (period === 'monthly') return "You've made " + n + " of " + min + " predictions this month.";
    return "You've made " + n + " of " + min + " predictions.";
}

function _predLbFillProgress(period, data) {
    var el = document.getElementById('predLbProgress');
    if (!el) return;
    if (typeof auth === 'undefined' || !auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        el.textContent = '';
        return;
    }
    var apply = function(stats) {
        var node = document.getElementById('predLbProgress');
        if (!node) return;
        var made = 0;
        if (stats) {
            if (period === 'weekly') made = stats.weekKey === data.weekKey ? (stats.weekTotal || 0) : 0;
            else if (period === 'monthly') made = stats.monthKey === data.monthKey ? (stats.monthTotal || 0) : 0;
            else made = stats.predTotal || 0;
        }
        node.textContent = _predLbProgressText(period, made);
    };
    if (typeof window._loadMyPredictionStats === 'function') window._loadMyPredictionStats(apply);
    else el.textContent = '';
}

function _renderPredictorBoard() {
    var root = document.getElementById('predictorBoard');
    if (!root) return;
    var period = window._predLbPeriod || 'alltime';
    var data = (window._predLbCache && window._predLbCache.data) || {};
    var rows = data[period] || [];
    var tabs = [['alltime', 'All Time'], ['weekly', 'This Week'], ['monthly', 'This Month']];
    var html = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">' +
        '<h4 style="margin:0;">📈 Top Predictors</h4>' +
        '<button type="button" id="predLbInfo" class="pred-lb-info" aria-label="How Top Predictors works" aria-expanded="false" aria-controls="predLbTip" onclick="event.stopPropagation();_predLbToggleInfo(this)">ⓘ</button>' +
        '</div>';
    html += '<div style="display:flex;gap:4px;padding:0 0 10px;">';
    tabs.forEach(function(p) {
        var active = period === p[0];
        html += '<button type="button" onclick="_predLbSwitchPeriod(\'' + p[0] + '\')" style="flex:1;padding:6px 4px;border:1px solid ' + (active ? 'var(--accent)' : 'var(--border)') + ';border-radius:8px;background:' + (active ? 'var(--accent)' : 'none') + ';color:' + (active ? '#fff' : 'var(--text-muted)') + ';font-size:0.72rem;font-weight:' + (active ? '700' : '500') + ';cursor:pointer;font-family:inherit;white-space:nowrap;">' + p[1] + '</button>';
    });
    html += '</div><div id="predictorLeaderboardList">';
    if (!rows.length) {
        html += '<div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:12px 0;">No Questers have qualified yet.</div>';
    } else {
        var myUid = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser.uid : '';
        rows.forEach(function(entry) {
            var rank = entry.rank || 0;
            var medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '#' + rank;
            var uid = String(entry.uid || '').replace(/[^A-Za-z0-9_-]/g, '');
            var isMe = myUid && uid === myUid;
            var rawPredName = entry.username || '';
            var predBlank = typeof window.missingPublicName === 'function'
                ? window.missingPublicName(rawPredName)
                : (!String(rawPredName).trim() || /^(anon|anonymous)$/i.test(String(rawPredName).trim()));
            var predShown = predBlank ? 'Anon' : rawPredName;
            var name = typeof escapeHtml === 'function' ? escapeHtml(predShown) : String(predShown);
            var peerTag = (window._myPeers && window._myPeers.has(uid)) ? '<span title="Your peer" style="margin-right:2px;">🧡</span>' : '';
            var predNameAttrs = uid ? ' data-profile-uid="' + uid + '"' + (predBlank ? ' data-blank-name="1"' : '') : '';
            var hidden = rank > 10 ? ' style="display:none;" class="lb-row pred-lb-extra' + (isMe ? ' lb-me' : '') + '"' : ' class="lb-row' + (isMe ? ' lb-me' : '') + '"';
            html += '<div' + hidden + ' onclick="showUserProfile(\'' + uid + '\')" style="cursor:pointer;" title="View profile">' +
                '<span class="lb-rank">' + medal + '</span>' +
                _predAvatarHtml(entry) +
                '<span class="lb-name">' + peerTag + '<span' + predNameAttrs + '>' + name + '</span></span>' +
                '<span class="lb-score pred-score">' + (entry.pct || 0) + '%<span class="pred-score-frac">' + (entry.correct || 0) + '/' + (entry.total || 0) + '</span></span>' +
            '</div>';
        });
        if (rows.length > 10) {
            html += '<button type="button" onclick="event.stopPropagation();document.querySelectorAll(\'.pred-lb-extra\').forEach(function(el){el.style.display=\'flex\'});this.remove();" style="width:100%;padding:10px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:0.85rem;cursor:pointer;font-family:inherit;margin:8px 0;">Show all ' + rows.length + ' predictors ▼</button>';
        }
    }
    html += '</div><p id="predLbProgress" style="margin:8px 0 0;font-size:0.75rem;line-height:1.4;color:var(--text-muted);"></p>';
    root.innerHTML = html;
    if (typeof window.patchBlankProfileNames === 'function') window.patchBlankProfileNames(root);
    _predLbBindInfo();
    var tip = document.getElementById('predLbTip');
    if (tip && !tip.hidden) tip.textContent = _predLbInfoText(period);
    _predLbFillProgress(period, data);
}

function _predLbSwitchPeriod(period) {
    window._predLbPeriod = period;
    _renderPredictorBoard();
}
window._predLbSwitchPeriod = _predLbSwitchPeriod;

async function _loadPredictorLeaderboard() {
    var root = document.getElementById('predictorBoard');
    if (!root) return;
    var now = Date.now();
    var fresh = window._predLbCache && window._predLbCacheTime && (now - window._predLbCacheTime < 600000);
    if (!fresh) {
        try {
            if (typeof db === 'undefined') {
                window._predLbCache = { data: {} };
            } else {
                var doc = await db.collection('stats').doc('predictor_leaderboard').get();
                window._predLbCache = { data: doc.exists ? (doc.data() || {}) : {} };
            }
            window._predLbCacheTime = now;
        } catch (e) {
            window._predLbCache = window._predLbCache || { data: {} };
            window._predLbCacheTime = now;
        }
    }
    _renderPredictorBoard();
}

// PVP Leaderboard - loaded after main leaderboard renders, sorted by win %
async function _loadPVPLeaderboard() {
    var container = document.getElementById('pvpLeaderboardList');
    if (!container) return;
    try {
        // Cache PVP leaderboard for 5 minutes
        var _pvpNow = Date.now();
        var _pvpCached = window._pvpLbCache && window._pvpLbCacheTime && (_pvpNow - window._pvpLbCacheTime < 300000);
        var winsSnap, lossSnap;
        if (_pvpCached) {
            winsSnap = window._pvpLbCache.wins;
            lossSnap = window._pvpLbCache.losses;
        } else {
            [winsSnap, lossSnap] = await Promise.all([
                db.collection('public_profiles').where('pvpWins', '>', 0).orderBy('pvpWins', 'desc').limit(50).get(),
                db.collection('public_profiles').where('pvpLosses', '>', 0).orderBy('pvpLosses', 'desc').limit(50).get()
            ]);
            window._pvpLbCache = { wins: winsSnap, losses: lossSnap };
            window._pvpLbCacheTime = _pvpNow;
        }
        var playerMap = {};
        var myUid = auth.currentUser ? auth.currentUser.uid : null;
        function addPlayer(doc) {
            if (playerMap[doc.id]) return;
            var d = doc.data();
            if (d.ghostMode && doc.id !== myUid) return;
            var wins = d.pvpWins || 0;
            var losses = d.pvpLosses || 0;
            var total = wins + losses;
            if (total === 0) return;
            var winRate = total > 0 ? (wins / total) * 100 : 0;
            playerMap[doc.id] = { id: doc.id, username: escapeHtml(d.username || 'Anon'), wins: wins, losses: losses, total: total, winRate: winRate, isMe: doc.id === myUid, lightningAddress: d.lightningAddress || d.lightning || '' };
        }
        winsSnap.forEach(addPlayer);
        lossSnap.forEach(addPlayer);
        var players = Object.values(playerMap);
        if (players.length === 0) {
            container.innerHTML = '<div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:12px 0;">No PVP battles yet - be the first to compete!</div>';
            return;
        }
        players.sort(function(a, b) { return b.winRate - a.winRate || b.wins - a.wins; });

        var pvpHtml = '';
        players.forEach(function(p, idx) {
            var rank = idx + 1;
            var medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '#' + rank;
            var pvpIcon = p.wins >= 100 ? '👑' : p.wins >= 50 ? '🏆' : p.wins >= 25 ? '🏟️' : p.wins >= 5 ? '🥊' : '⚔️';
            var hidden = rank > 10 ? ' style="display:none;" class="lb-row pvp-lb-extra' + (p.isMe ? ' lb-me' : '') + '"' : ' class="lb-row' + (p.isMe ? ' lb-me' : '') + '"';
            var _pvpTipData = JSON.stringify({recipientName: p.username, recipientUid: p.id, lightningAddress: p.lightningAddress, context: 'pvp', label: 'Tip ' + p.username}).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
            var peerTag = (window._myPeers && window._myPeers.has(p.id || '')) ? '<span title="Your peer" style="margin-right:2px;">🧡</span>' : '';
            pvpHtml += '<div' + hidden + ' onclick="showUserProfile(\'' + p.id + '\')" style="cursor:pointer;" title="View profile">' +
                '<span class="lb-rank">' + medal + '</span>' +
                '<span class="lb-badge" style="display:inline-block;width:22px;text-align:center;flex-shrink:0;">' + pvpIcon + '</span>' +
                '<span class="lb-name">' + peerTag + p.username + '</span>' +
                '<span class="lb-score" title="' + Math.round(p.winRate) + '% win rate" style="cursor:help;">' + p.wins + 'W - ' + p.losses + 'L</span>' +
                '<span data-lb-tip="1" onclick="event.stopPropagation();showTipOverlay(JSON.parse(this.getAttribute(\'data-tip-action\').replace(/&quot;/g,\'\\&quot;\')))" data-tip-action="' + _pvpTipData + '" style="cursor:pointer;font-size:0.75rem;color:#eab308;margin-left:6px;flex-shrink:0;" title="Tip ' + p.username + '">⚡</span>' +
            '</div>';
        });
        if (players.length > 10) {
            pvpHtml += '<button onclick="event.stopPropagation();document.querySelectorAll(\'.pvp-lb-extra\').forEach(function(el){el.style.display=\'flex\'});this.remove();" style="width:100%;padding:10px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:0.85rem;cursor:pointer;font-family:inherit;margin:8px 0;">Show all ' + players.length + ' PVP players ▼</button>';
        }
        container.innerHTML = pvpHtml || '<div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:12px 0;">No PVP battles yet!</div>';
    } catch(e) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:12px 0;">No PVP battles yet - be the first to compete!</div>';
    }
}

// Toast notifications
var _toastQueue = [];
function showToast(msg, duration) {
    // Suppress toasts during direct link cooldown
    if (window._directLinkMode) return;
    // Queue while Nacho is busy, or while Terms / sign-up is blocking the screen.
    if (window._nachoBusy || chromeBlocksToasts()) {
        _toastQueue.push({ msg: msg, duration: duration });
        return;
    }
    _showToastNow(msg, duration);
}
window._showToastNow = function _showToastNow(msg, duration) {
    var ms = duration || 2500;
    const t = document.createElement('div');
    t.className = 'rank-toast';
    var _raw = typeof msg === 'object' ? msg.msg : msg;
    // Strip dangerous tags but allow emoji and simple formatting
    t.innerHTML = _raw.replace(/<(script|svg|img|iframe|object|embed|form|input|link|style|meta|base)[^>]*>/gi, '').replace(/on\w+\s*=/gi, 'data-blocked=');
    if (typeof msg === 'object' && msg.duration) ms = msg.duration;
    // Above Settings (400000) and the peer/gift dialogs (480000–540000).
    t.style.zIndex = '620000';
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, ms);
}
// Flush queued toasts when Nacho is no longer busy
setInterval(function() {
    if (!window._nachoBusy && !chromeBlocksToasts() && _toastQueue.length > 0) {
        _showToastNow(_toastQueue.shift());
    }
}, 2000);

// Capture all sign-up form fields to localStorage before any auth provider fires.
// This ensures username, LN address, faction, and country survive popup/redirect auth.
window._captureSignupFormState = function() {
    var unEl  = document.getElementById('usernameInput');
    var lnEl  = document.getElementById('signupLnAddress');
    var emEl  = document.getElementById('emailInput');
    var ctEl  = document.getElementById('signupCountryInput');
    var un    = unEl  && unEl.value.trim();
    var ln    = lnEl  && lnEl.value.trim();
    var em    = emEl  && emEl.value.trim();
    var ct    = ctEl  && ctEl.value.trim();
    if (un) localStorage.setItem('btc_pending_username', un);
    if (ln) {
        ln = normalizeClientLn(ln);
        if (clientLnValid(ln)) localStorage.setItem('btc_pending_ln_address', ln);
    }
    if (em) localStorage.setItem('btc_pending_email', em);
    if (ct) localStorage.setItem('btc_pending_country', ct);
    if (window._signupFaction) localStorage.setItem('btc_pending_faction', window._signupFaction);
};

// Username prompt
// Handle "I need a Lightning Address" from sign-up form:
// Save whatever is typed so far, mark return intent, open Lightning wallet page.
window._signupGoGetLnAddress = function() {
    // Preserve any partial LN address typed
    var lnEl = document.getElementById('signupLnAddress');
    if (lnEl && lnEl.value.trim()) localStorage.setItem('btc_pending_ln_address', normalizeClientLn(lnEl.value));
    // Save username + email if already typed so they're restored on return
    var unEl = document.getElementById('usernameInput');
    var emEl = document.getElementById('emailInput');
    if (unEl && unEl.value.trim()) localStorage.setItem('btc_signup_return_username', unEl.value.trim());
    if (emEl && emEl.value.trim()) localStorage.setItem('btc_signup_return_email', emEl.value.trim());
    // Mark that we should reopen the sign-up modal with focus on LN field when returning
    sessionStorage.setItem('btc_return_to_signup_ln', '1');
    // Close modal and open Lightning page
    document.getElementById('usernameModal').classList.remove('open');
    setTimeout(function() { if (typeof go === 'function') go('lightning'); }, 200);
};

function showUsernamePrompt() {
    try {
        // If user has an account (real or anonymous with username), show settings
        if (auth && auth.currentUser && !auth.currentUser.isAnonymous) {
            showAccountInfo();
            return;
        }
        if (currentUser && currentUser.username) {
            showAccountInfo();
            return;
        }
        // In-app browser (Instagram, TikTok, FB, etc.) - OAuth won't work.
        // Skip the regular sign-up modal and show the IAB-aware sheet directly.
        if (isInAppBrowser()) {
            window._showIABSignInModal();
            return;
        }
        // If redirect result hasn't resolved yet, wait briefly for it
        // This prevents showing sign-up form while mobile redirect auth is still loading
        if (!redirectResultResolved) {
            showToast('⏳ Loading account...');
            redirectResultPromise.then(function() {
                if (auth && auth.currentUser && !auth.currentUser.isAnonymous) {
                    showAccountInfo();
                } else if (currentUser && currentUser.username) {
                    showAccountInfo();
                } else {
                    document.getElementById('usernameModal').classList.add('open');
                    history.pushState({ modal: 'signin' }, '', window.location.pathname + window.location.hash);
                }
            });
            return;
        }
        document.getElementById('usernameModal').classList.add('open');
        // Push history state so back button closes modal instead of exiting app
        history.pushState({ modal: 'signin' }, '', window.location.pathname + window.location.hash);
    } catch(e) {
        if (typeof showToast === 'function') showToast('Settings error: ' + e.message);
        console.error('showUsernamePrompt error:', e);
    }
}

function showAccountInfo() {
    showSettingsPage('account');
}

// Sign-in only mode - hides signup fields, shows only sign-in options
window.showSignInOnly = function() {
    if (auth && auth.currentUser && !auth.currentUser.isAnonymous) {
        showAccountInfo();
        return;
    }
    var modal = document.getElementById('usernameModal');
    if (!modal) return;
    modal.classList.add('open');
    history.pushState({ modal: 'signin' }, '', window.location.pathname + window.location.hash);

    // Hide signup-only fields
    setTimeout(function() {
        var box = modal.querySelector('.username-box');
        if (!box) return;
        // Hide: h2, first p, username input, email input, email note, Start Learning button
        var h2 = box.querySelector('h2');
        var firstP = box.querySelector('p');
        var usernameInput = document.getElementById('usernameInput');
        var emailInput = document.getElementById('emailInput');
        var submitBtn = box.querySelector('button[onclick="submitUsername()"]');

        // Find the email note (p after emailInput)
        var emailNote = emailInput ? emailInput.nextElementSibling : null;
        if (emailNote && emailNote.tagName === 'P') emailNote.style.display = 'none';

        var lnSection = document.getElementById('signupLnSection');
        if (lnSection) lnSection.style.display = 'none';
        var factionPicker = document.getElementById('factionPickerSignup');
        if (factionPicker) factionPicker.style.display = 'none';

        if (h2) h2.style.display = 'none';
        if (firstP) firstP.style.display = 'none';
        if (usernameInput) usernameInput.style.display = 'none';
        if (emailInput) emailInput.style.display = 'none';
        if (submitBtn) submitBtn.style.display = 'none';

        // Add a sign-in header
        var signInHeader = document.getElementById('signInOnlyHeader');
        if (!signInHeader) {
            signInHeader = document.createElement('div');
            signInHeader.id = 'signInOnlyHeader';
            signInHeader.innerHTML = '<div style="text-align:center;margin-bottom:20px;">' +
                '<div style="font-size:2.5rem;margin-bottom:8px;">🔐</div>' +
                '<h2 style="color:#fff;font-size:1.4rem;font-weight:900;margin:0 0 6px;">Welcome Back!</h2>' +
                '<p style="color:#64748b;font-size:0.9rem;margin:0;">Sign in to your account</p>' +
            '</div>';
            box.insertBefore(signInHeader, box.firstChild);
        }

        // Rename the "Already have an account?" text
        var emailSignIn = document.getElementById('emailSignInSection');
        if (emailSignIn) {
            var label = emailSignIn.querySelector('p');
            if (label) label.innerHTML = '<span style="color:var(--text);font-size:0.85rem;font-weight:600;">Sign in with your email:</span>';
        }

        // Add a "New here?" link at the bottom
        var newHereLink = document.getElementById('signInOnlyNewHere');
        if (!newHereLink) {
            newHereLink = document.createElement('div');
            newHereLink.id = 'signInOnlyNewHere';
            newHereLink.innerHTML = '<div style="text-align:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">' +
                '<button onclick="window._restoreSignUpForm()" style="background:none;border:none;color:var(--accent);font-size:0.85rem;cursor:pointer;font-family:inherit;">New here? Create an account →</button>' +
            '</div>';
            var skipBtn = box.querySelector('.skip');
            if (skipBtn) box.insertBefore(newHereLink, skipBtn);
            else box.appendChild(newHereLink);
        }
    }, 50);
};

// Restore signup form (from sign-in only mode)
window._restoreSignUpForm = function() {
    var modal = document.getElementById('usernameModal');
    if (!modal) return;
    var box = modal.querySelector('.username-box');
    if (!box) return;

    // Remove sign-in only additions
    var header = document.getElementById('signInOnlyHeader');
    if (header) header.remove();
    var newHere = document.getElementById('signInOnlyNewHere');
    if (newHere) newHere.remove();

    // Restore hidden elements
    var h2 = box.querySelector('h2');
    var firstP = box.querySelector('p');
    var usernameInput = document.getElementById('usernameInput');
    var emailInput = document.getElementById('emailInput');
    var submitBtn = box.querySelector('button[onclick="submitUsername()"]');
    var emailNote = emailInput ? emailInput.nextElementSibling : null;
    if (emailNote && emailNote.tagName === 'P') emailNote.style.display = '';

    var lnSection = document.getElementById('signupLnSection');
    if (lnSection) lnSection.style.display = '';
    var factionPicker = document.getElementById('factionPickerSignup');
    if (factionPicker) factionPicker.style.display = '';

    if (h2) h2.style.display = '';
    if (firstP) firstP.style.display = '';
    if (usernameInput) usernameInput.style.display = '';
    if (emailInput) emailInput.style.display = '';
    if (submitBtn) submitBtn.style.display = '';

    // Restore email sign in label
    var emailSignIn = document.getElementById('emailSignInSection');
    if (emailSignIn) {
        var label = emailSignIn.querySelector('p');
        if (label) label.innerHTML = 'Already have an account? Sign in with your email:';
    }
};

let settingsTab = 'account';

function shortcutRow(key, desc) {
    return '<div><kbd style="background:var(--bg-side);border:1px solid var(--border);padding:2px 7px;border-radius:4px;font-family:monospace;font-size:0.75rem;color:var(--heading);min-width:20px;display:inline-block;text-align:center;">' + key + '</kbd></div><div style="color:var(--text-muted);font-size:0.8rem;">' + desc + '</div>';
}

// --- CORE SETTINGS & PROFILE LOGIC ---
window.showSettings = function() {
    if (typeof auth === 'undefined' || !auth) {
        if (typeof showToast === 'function') showToast('⚠️ Firebase not ready. Retrying...');
        if (typeof initRanking === 'function') initRanking();
        setTimeout(function() {
            if (typeof auth !== 'undefined' && auth) showUsernamePrompt();
            else if (typeof showToast === 'function') showToast('❌ Could not load. Please refresh the page.');
        }, 2000);
        return;
    }
    showUsernamePrompt();
};

// Country list for autocomplete (ISO 3166-1)
window._countryList = ['Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Ivory Coast','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kosovo','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan','Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'];

// Custom country autocomplete (datalist broken on iOS Safari)
window._filterCountryList = function() {
    var input = document.getElementById('countryInput');
    var dropdown = document.getElementById('countryDropdown');
    if (!input || !dropdown) return;
    var query = input.value.trim().toLowerCase();
    if (query.length === 0) {
        dropdown.style.display = 'none';
        return;
    }
    var matches = window._countryList.filter(function(c) {
        return c.toLowerCase().indexOf(query) !== -1;
    });
    if (matches.length === 0 || (matches.length === 1 && matches[0].toLowerCase() === query)) {
        dropdown.style.display = 'none';
        return;
    }
    var html = '';
    for (var i = 0; i < Math.min(matches.length, 8); i++) {
        var m = matches[i];
        // Highlight the matching portion
        var idx = m.toLowerCase().indexOf(query);
        var highlighted = (typeof escapeHtml === 'function' ? escapeHtml(m.substring(0, idx)) : m.substring(0, idx)) +
            '<strong style="color:var(--accent);">' + (typeof escapeHtml === 'function' ? escapeHtml(m.substring(idx, idx + query.length)) : m.substring(idx, idx + query.length)) + '</strong>' +
            (typeof escapeHtml === 'function' ? escapeHtml(m.substring(idx + query.length)) : m.substring(idx + query.length));
        html += '<div onmousedown="window._selectCountry(\'' + m.replace(/'/g, "\\'") + '\')" style="padding:10px 14px;color:var(--text);font-size:0.9rem;cursor:pointer;border-bottom:1px solid var(--border);transition:background 0.15s;" ontouchstart="this.style.background=\'rgba(247,147,26,0.15)\'" ontouchend="this.style.background=\'none\'" onmouseover="this.style.background=\'rgba(247,147,26,0.1)\'" onmouseout="this.style.background=\'none\'">' + highlighted + '</div>';
    }
    if (matches.length > 8) {
        html += '<div style="padding:8px 14px;color:var(--text-faint);font-size:0.75rem;text-align:center;">+' + (matches.length - 8) + ' more - keep typing</div>';
    }
    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
};

window._selectCountry = function(name) {
    var input = document.getElementById('countryInput');
    var dropdown = document.getElementById('countryDropdown');
    if (input) input.value = name;
    if (dropdown) dropdown.style.display = 'none';
};

// Title equip
window._equipTitle = function(titleId) {
    var user = auth ? auth.currentUser : null;
    if (!user) { if (typeof showToast === 'function') showToast('Sign in to equip a title'); return; }
    if (user.isAnonymous) { if (typeof showToast === 'function') showToast('Create an account to equip a title'); return; }
    if (typeof currentUser !== 'undefined' && currentUser) currentUser.activeTitle = titleId || null;
    if (typeof db !== 'undefined' && db) {
        db.collection('users').doc(user.uid).update({ activeTitle: titleId || null }).catch(function(){});
    }
    var label = '';
    if (titleId && typeof TITLE_DEFS !== 'undefined') {
        var tDef = TITLE_DEFS.find(function(t){return t.id===titleId;});
        if (tDef) label = tDef.emoji + ' ' + tDef.title;
    }
    if (typeof showToast === 'function') {
        showToast(label ? '🎖️ Title equipped: ' + label : 'Title removed');
    }
    // Re-render settings to update the pill display
    if (typeof showSettings === 'function') setTimeout(function(){ showSettings('account'); }, 300);
};

// Faction selection. The profile field is server-only. chooseFaction moves
// this user's unclaimed Satoshi's Favor points in one transaction.
async function commitFactionChoice(faction) {
    if (faction !== 'cyber_hornets' && faction !== 'honey_badgers') throw new Error('Invalid faction.');
    if (typeof firebase === 'undefined' || !firebase.functions) throw new Error('Faction save is unavailable.');
    var res = await firebase.functions().httpsCallable('chooseFaction')({ faction: faction });
    var data = res && res.data ? res.data : {};
    var moved = Number(data.moved);
    if (!isFinite(moved)) moved = Number(data.pointsSynced);
    if (!isFinite(moved) || moved < 0) moved = 0;
    if (typeof currentUser !== 'undefined' && currentUser) currentUser.faction = faction;
    return moved;
}

async function flushSignupFaction(faction) {
    try { localStorage.removeItem('btc_pending_faction'); } catch (e) {}
    window._signupFaction = null;
    if (!faction) return;
    try {
        var moved = await commitFactionChoice(faction);
        if (typeof showToast === 'function') showToast(moved + ' unclaimed point' + (moved === 1 ? '' : 's') + ' moved to your faction.');
    } catch (e) {
        console.warn('[FACTION] chooseFaction failed:', e);
        if (typeof showToast === 'function') showToast('Faction was not saved. You can choose one from the Satoshi\'s Favor panel.');
    }
}

window._selectFaction = async function(faction) {
    try {
        var user = auth ? auth.currentUser : null;
        if (!user) { if (typeof showToast === 'function') showToast('Sign in to choose a faction'); return; }
        if (user.isAnonymous) { if (typeof showToast === 'function') showToast('Create an account to choose a faction'); return; }

        var previousFaction = currentUser ? (currentUser.faction || null) : null;
        if (previousFaction) {
            if (typeof showToast === 'function') showToast('Your faction choice is permanent.');
            return;
        }

        var moved = await commitFactionChoice(faction);
        if (typeof showToast === 'function') showToast(faction === 'cyber_hornets' ? '🐝 Welcome to the Cyber Hornets!' : '🦡 Welcome to the Honey Badgers!');
        if (typeof showToast === 'function') showToast(moved + ' unclaimed point' + (moved === 1 ? '' : 's') + ' moved to your faction.');
        showSettingsPage('account');

        if (typeof firebase !== 'undefined' && firebase.functions) {
            firebase.functions().httpsCallable('backfillDonationFaction')({
                newFaction: faction
            }).then(function(res) {
                if (res.data && res.data.totalAmount > 0) {
                    if (typeof showToast === 'function') showToast('❤️ ' + res.data.totalAmount.toLocaleString() + ' XP of past donations credited to your faction!');
                }
            }).catch(function(err) {
                console.warn('[FACTION] backfillDonationFaction failed:', err);
            });
        }
    } catch(e) {
        console.error('Faction select error:', e);
        var msg = e && e.message ? String(e.message) : '';
        if (typeof showToast === 'function') {
            if (msg.indexOf('already') !== -1) showToast('Your faction choice is permanent.');
            else if (msg.indexOf('disabled') !== -1) showToast('Rewards are disabled on this account.');
            else showToast('Error saving faction');
        }
    }
};

// Signup country autocomplete (reuses _countryList)
window._filterSignupCountry = function() {
    var input = document.getElementById('signupCountryInput');
    var dropdown = document.getElementById('signupCountryDropdown');
    if (!input || !dropdown) return;
    var query = input.value.trim().toLowerCase();
    if (query.length === 0) { dropdown.style.display = 'none'; return; }
    var matches = window._countryList.filter(function(c) { return c.toLowerCase().indexOf(query) !== -1; });
    if (matches.length === 0 || (matches.length === 1 && matches[0].toLowerCase() === query)) { dropdown.style.display = 'none'; return; }
    var html = '';
    for (var i = 0; i < Math.min(matches.length, 8); i++) {
        var m = matches[i];
        var idx = m.toLowerCase().indexOf(query);
        var highlighted = (typeof escapeHtml === 'function' ? escapeHtml(m.substring(0, idx)) : m.substring(0, idx)) +
            '<strong style="color:var(--accent);">' + (typeof escapeHtml === 'function' ? escapeHtml(m.substring(idx, idx + query.length)) : m.substring(idx, idx + query.length)) + '</strong>' +
            (typeof escapeHtml === 'function' ? escapeHtml(m.substring(idx + query.length)) : m.substring(idx + query.length));
        html += '<div onmousedown="window._selectSignupCountry(\'' + m.replace(/'/g, "\\'") + '\')" style="padding:10px 14px;color:var(--text);font-size:0.9rem;cursor:pointer;border-bottom:1px solid var(--border);transition:background 0.15s;" ontouchstart="this.style.background=\'rgba(247,147,26,0.15)\'" ontouchend="this.style.background=\'none\'" onmouseover="this.style.background=\'rgba(247,147,26,0.1)\'" onmouseout="this.style.background=\'none\'">' + highlighted + '</div>';
    }
    if (matches.length > 8) html += '<div style="padding:8px 14px;color:var(--text-faint);font-size:0.75rem;text-align:center;">+' + (matches.length - 8) + ' more \u2014 keep typing</div>';
    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
};

window._selectSignupCountry = function(name) {
    var input = document.getElementById('signupCountryInput');
    var dropdown = document.getElementById('signupCountryDropdown');
    if (input) input.value = name;
    if (dropdown) dropdown.style.display = 'none';
};

// Close country dropdowns when tapping outside
document.addEventListener('click', function(e) {
    [['countryDropdown','countryAutocomplete'],['signupCountryDropdown','signupCountryAutocomplete']].forEach(function(pair) {
        var dropdown = document.getElementById(pair[0]);
        var wrapper = document.getElementById(pair[1]);
        if (dropdown && wrapper && !wrapper.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
});

function showSettingsPage(tab) {
    try {
    settingsTab = tab || 'account';
    // Set page title to app name when on security tab — Authy/browser extensions
    // read document.title (not the otpauth issuer) when auto-detecting QR codes.
    if (settingsTab === 'security') {
        document.title = 'Bitcoin Education Archive';
    } else if (document.title === 'Bitcoin Education Archive') {
        // Restore to channel title when leaving security tab
        document.title = (typeof _currentChannelTitle !== 'undefined' && _currentChannelTitle) ? _currentChannelTitle : 'Bitcoin Education Archive';
    }
    const modal = document.getElementById('usernameModal');
    const box = modal.querySelector('.username-box');
    if (!modal) { if (typeof showToast === 'function') showToast('Error: modal not found'); return; }
    if (!box) { if (typeof showToast === 'function') showToast('Error: username-box not found'); return; }
    const user = (typeof auth !== 'undefined' && auth) ? auth.currentUser : null;
    var fillSettingsPred = null;
    // If no auth user resolved yet, show sign-up form instead of crashing
    if (!user) {
        modal.classList.add('open');
        return;
    }
    const lvl = getLevel(currentUser ? currentUser.points || 0 : 0);

    // X close button
    let html = '<button onclick="hideUsernamePrompt()" style="position:sticky;top:8px;float:right;background:var(--bg-side,#1a1a2e);border:1px solid var(--border);color:var(--text-muted);width:36px;height:36px;border-radius:10px;font-size:1.2rem;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:20;transition:0.2s;touch-action:manipulation;box-shadow:0 2px 8px rgba(0,0,0,0.3);" onmouseover="this.style.borderColor=\'var(--accent)\';this.style.color=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.color=\'var(--text-muted)\'">✕</button>';

    // Tab bar
    html += '<div style="display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid var(--border);margin-top:8px;position:sticky;top:0;background:var(--bg-side,#1a1a2e);z-index:10;padding-top:4px;overflow:hidden;">';
    ['account', 'scholar', 'sats', 'prefs', 'security', 'data'].forEach(t => {
        const icons = { account: '👤', scholar: '🎓', sats: '⚡', prefs: '🎨', security: '🔒', data: '📊' };
        const names = { account: 'Acct', scholar: 'Scholar', sats: 'Sats', prefs: 'Prefs', security: 'Lock', data: 'Stats/<br>Nacho/Tix' };
        const active = settingsTab === t;
        html += '<button onclick="showSettingsPage(\'' + t + '\')" style="flex:1;min-width:0;padding:8px 2px;border:none;background:' + (active ? 'var(--accent-bg)' : 'none') + ';color:' + (active ? 'var(--accent)' : 'var(--text-muted)') + ';font-size:0.6rem;font-weight:' + (active ? '700' : '500') + ';cursor:pointer;font-family:inherit;border-bottom:' + (active ? '2px solid var(--accent)' : '2px solid transparent') + ';margin-bottom:-2px;display:flex;flex-direction:column;align-items:center;gap:1px;white-space:normal;text-align:center;line-height:1.2;touch-action:manipulation;"><span style="font-size:1.3rem;line-height:1;">' + icons[t] + '</span>' + names[t] + '</button>';
    });
    html += '</div>';

    if (settingsTab === 'account') {
        var isAnon = user.isAnonymous;
        var settingsEmoji = getUserDisplayEmoji(lvl);
        var _pfpUrl = currentUser ? currentUser.profilePic || '' : '';
        var _pfpHtml = _pfpUrl
            ? ('<img src="' + (_pfpUrl && /^data:image\//i.test(_pfpUrl) ? _pfpUrl : escapeHtml(sanitizeUrl(_pfpUrl))) + '" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid var(--accent);box-shadow:0 0 20px rgba(247,147,26,0.3);cursor:pointer;" onclick="document.getElementById(\'pfpFileInput\').click()" title="Click to change photo">')
            : '<div style="font-size:2.5rem;margin-bottom:0;">' + settingsEmoji + '</div>';
        // Build title pill for own profile
        var _activeTitleId = currentUser ? currentUser.activeTitle || '' : '';
        var _activeTitleDef = (typeof TITLE_DEFS !== 'undefined' && _activeTitleId) ? TITLE_DEFS.find(function(t){return t.id===_activeTitleId;}) : null;
        var _titlePillHtml = _activeTitleDef
            ? '<div style="display:inline-block;background:rgba(247,147,26,0.15);border:1px solid rgba(247,147,26,0.25);border-radius:20px;padding:3px 10px;font-size:0.75rem;font-weight:700;color:#f97316;margin-top:6px;">' + _activeTitleDef.emoji + ' ' + escapeHtml(_activeTitleDef.title) + '</div><div style="color:var(--text-faint);font-size:0.7rem;margin-top:3px;font-style:italic;">' + escapeHtml(_activeTitleDef.flavor) + '</div>'
            : '';
        // Build equip title button if user has earned titles
        var _earnedTitles = currentUser ? currentUser.earnedTitles || [] : [];
        var _equipTitleHtml = '';
        if (_earnedTitles.length > 0 && typeof TITLE_DEFS !== 'undefined') {
            var _titleOptions = '<option value="">- No Title -</option>';
            _earnedTitles.forEach(function(tid) {
                var tDef = TITLE_DEFS.find(function(t){return t.id===tid;});
                if (tDef) _titleOptions += '<option value="' + escapeHtml(tDef.id) + '"' + (tDef.id===_activeTitleId?' selected':'') + '>' + tDef.emoji + ' ' + escapeHtml(tDef.title) + '</option>';
            });
            _equipTitleHtml = '<div style="margin-top:10px;display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;">' +
                '<span style="font-size:0.8rem;color:var(--text-muted);">🎖️ Equip Title:</span>' +
                '<select onchange="window._equipTitle(this.value)" style="padding:5px 10px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.8rem;font-family:inherit;cursor:pointer;">' + _titleOptions + '</select>' +
                '</div>';
        }
        html += '<div style="text-align:center;margin-bottom:20px;">' +
            '<div style="margin-bottom:8px;position:relative;display:inline-block;">' + _pfpHtml + '</div>' +
            '<div style="color:var(--heading);font-weight:700;font-size:1.2rem;">' + (currentUser ? currentUser.username || 'Bitcoiner' : 'Bitcoiner') + '</div>' +
            '<div style="color:var(--text-muted);font-size:0.85rem;margin-top:4px;">' + lvl.name + ' · ' + (currentUser ? currentUser.points || 0 : 0).toLocaleString() + ' XP' + (currentUser && currentUser.faction ? ' · ' + (currentUser.faction === 'cyber_hornets' ? '🐝 Cyber Hornets' : '🦡 Honey Badgers') : '') + '</div>' +
            _titlePillHtml +
            _equipTitleHtml +
            '<div style="margin-top:10px;"><a href="/patch-notes.html" id="settingsWhatsNew" onclick="if(window._markPatchSeen)window._markPatchSeen()" style="display:inline-flex;align-items:center;gap:6px;color:var(--accent);font-weight:700;font-size:0.85rem;text-decoration:none;">What\'s new <span class="whats-new-dot" hidden></span></a></div>' +
            '</div>';

        // Country selector (custom autocomplete - datalist broken on iOS Safari)
        var _userCountry = currentUser ? currentUser.country || '' : '';
        var _countryXpNudge = !_userCountry ? ' <span style="color:#22c55e;font-size:0.7rem;font-weight:700;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:8px;padding:2px 7px;margin-left:4px;">+100 XP + badge</span>' : '';
        html += '<div style="background:var(--card-bg);border:1px solid ' + (!_userCountry ? 'rgba(34,197,94,0.3)' : 'var(--border)') + ';border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;display:flex;align-items:center;">🌍 Country' + _countryXpNudge + '</div>' +
            '<div style="position:relative;" id="countryAutocomplete">' +
            '<input type="text" id="countryInput" value="' + escapeHtml(_userCountry) + '" placeholder="Start typing your country..." autocomplete="off" style="width:100%;padding:12px 14px;background:var(--input-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:16px;font-family:inherit;outline:none;box-sizing:border-box;-webkit-appearance:none;" oninput="window._filterCountryList()" onfocus="window._filterCountryList()">' +
            '<div id="countryDropdown" style="display:none;position:absolute;top:100%;left:0;right:0;max-height:200px;overflow-y:auto;background:var(--bg-side,#1a1a2e);border:1px solid var(--accent);border-radius:0 0 10px 10px;z-index:50;box-shadow:0 8px 24px rgba(0,0,0,0.4);"></div>' +
            '</div>' +
            '<div style="color:var(--text-faint);font-size:0.7rem;margin-top:4px;">' + (!_userCountry ? '🌟 Add your country → earn +100 XP + 🌍 Global Citizen badge' : 'Optional · Shown on your public profile') + '</div>' +
            '</div>';

        // Faction selector
        var _userFaction = currentUser ? currentUser.faction || '' : '';
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">⚔️ Faction</div>' +
            (_userFaction
                ? '<div style="color:var(--text-faint);font-size:0.7rem;margin-bottom:12px;">Your faction choice is permanent.</div>'
                : '<div style="color:var(--text-faint);font-size:0.7rem;margin-bottom:12px;">This choice is permanent. Your unclaimed points go to the faction you pick.</div>') +
            '<div style="display:flex;gap:10px;">' +
            '<div onclick="window._selectFaction(\'cyber_hornets\')" style="flex:1;padding:14px 10px;border-radius:12px;border:2px solid ' + (_userFaction === 'cyber_hornets' ? '#f7931a' : 'var(--border)') + ';background:' + (_userFaction === 'cyber_hornets' ? 'rgba(247,147,26,0.1)' : 'var(--card-bg)') + ';cursor:' + (_userFaction && _userFaction !== 'cyber_hornets' ? 'default' : 'pointer') + ';text-align:center;transition:all 0.2s;opacity:' + (_userFaction && _userFaction !== 'cyber_hornets' ? '0.5' : '1') + ';">' +
                '<div style="font-size:2rem;margin-bottom:6px;">🐝</div>' +
                '<div style="color:var(--heading);font-weight:700;font-size:0.9rem;">Cyber Hornets</div>' +
                '<div style="color:var(--text-muted);font-size:0.65rem;margin-top:4px;">The swarm protects the network</div>' +
                (_userFaction === 'cyber_hornets' ? '<div style="color:#f7931a;font-size:0.75rem;font-weight:700;margin-top:6px;">✓ Joined</div>' : '') +
            '</div>' +
            '<div onclick="window._selectFaction(\'honey_badgers\')" style="flex:1;padding:14px 10px;border-radius:12px;border:2px solid ' + (_userFaction === 'honey_badgers' ? '#a855f7' : 'var(--border)') + ';background:' + (_userFaction === 'honey_badgers' ? 'rgba(168,85,247,0.1)' : 'var(--card-bg)') + ';cursor:' + (_userFaction && _userFaction !== 'honey_badgers' ? 'default' : 'pointer') + ';text-align:center;transition:all 0.2s;opacity:' + (_userFaction && _userFaction !== 'honey_badgers' ? '0.5' : '1') + ';">' +
                '<div style="font-size:2rem;margin-bottom:6px;">🦡</div>' +
                '<div style="color:var(--heading);font-weight:700;font-size:0.9rem;">Honey Badgers</div>' +
                '<div style="color:var(--text-muted);font-size:0.65rem;margin-top:4px;">Honey badger don\'t care</div>' +
                (_userFaction === 'honey_badgers' ? '<div style="color:#a855f7;font-size:0.75rem;font-weight:700;margin-top:6px;">✓ Joined</div>' : '') +
            '</div>' +
            '</div>' +
            '</div>';

        // Profile Picture upload
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">📷 Profile Picture</div>' +
            '<input type="file" id="pfpFileInput" accept="image/*" style="display:none;" onchange="handleProfilePicUpload(this)">' +
            '<div style="text-align:center;">' +
                (_pfpUrl
                    ? ('<div style="position:relative;display:inline-block;margin-bottom:12px;cursor:pointer;" onclick="document.getElementById(\'pfpFileInput\').click()" title="Click to change photo">' +
                        '<img src="' + (_pfpUrl && /^data:image\//i.test(_pfpUrl) ? _pfpUrl : escapeHtml(sanitizeUrl(_pfpUrl))) + '" style="width:96px;height:96px;border-radius:50%;object-fit:cover;border:3px solid var(--accent);box-shadow:0 0 16px rgba(247,147,26,0.3);display:block;" onerror="this.style.display=\'none\'">' +
                        '<div style="position:absolute;bottom:2px;right:2px;background:var(--accent);border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:0.75rem;border:2px solid var(--bg-side);">✏️</div>' +
                       '</div>')
                    : '<div style="width:96px;height:96px;border-radius:50%;background:var(--bg);border:2px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:2.5rem;margin:0 auto 12px;">👤</div>') +
                '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
                    '<button onclick="document.getElementById(\'pfpFileInput\').click()" style="padding:8px 16px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;">' + (_pfpUrl ? '📷 Change Photo' : '📷 Upload Photo') + '</button>' +
                    (_pfpUrl ? '<button onclick="removeProfilePic()" style="padding:8px 12px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:0.8rem;cursor:pointer;font-family:inherit;">Remove</button>' : '') +
                '</div>' +
                '<div style="color:var(--text-faint);font-size:0.7rem;margin-top:6px;">Square image recommended · Max 2MB</div>' +
            '</div>' +
            '<div id="pfpUploadStatus" style="margin-top:8px;font-size:0.8rem;text-align:center;"></div>' +
        '</div>';

        // Build Advanced Account content (will be rendered AFTER visible sections)
        var _advHtml = '';

        // --- Account Details ---
        var _acctDetailsHtml = '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Account Details</div>';
        if (user.email) _acctDetailsHtml += '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);"><span style="color:var(--text-muted);font-size:0.85rem;">Email</span><span style="color:var(--text);font-size:0.85rem;">' + user.email + '</span></div>';
        if (user.displayName) _acctDetailsHtml += '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);"><span style="color:var(--text-muted);font-size:0.85rem;">Name</span><span style="color:var(--text);font-size:0.85rem;">' + user.displayName + '</span></div>';

        // Sign-in provider
        let provider = 'Anonymous';
        if (user.providerData && user.providerData.length > 0) {
            const pid = user.providerData[0].providerId;
            if (pid === 'google.com') provider = 'Google';
            else if (pid === 'twitter.com') provider = 'Twitter/X';
            else if (pid === 'github.com') provider = 'GitHub';
            else if (pid === 'facebook.com') provider = 'Facebook';
            else if (pid === 'password') provider = 'Email';
        }
        _acctDetailsHtml += '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);"><span style="color:var(--text-muted);font-size:0.85rem;">Sign-in method</span><span style="color:var(--text);font-size:0.85rem;">' + provider + '</span></div>';

        // Account created
        if (currentUser && currentUser.created) {
            const created = currentUser.created.toDate ? currentUser.created.toDate().toLocaleDateString() : new Date(currentUser.created).toLocaleDateString();
            _acctDetailsHtml += '<div style="display:flex;justify-content:space-between;padding:8px 0;"><span style="color:var(--text-muted);font-size:0.85rem;">Member since</span><span style="color:var(--text);font-size:0.85rem;">' + created + '</span></div>';
        }
        _acctDetailsHtml += '</div>';

        _advHtml += _acctDetailsHtml;
        // Display Badge chooser (collapsible)
        if (!isAnon && (typeof window.bqModeAllows !== 'function' || window.bqModeAllows('badges'))) {
            var chosenBadge = (currentUser && currentUser.displayBadge) || '';
            var allEarned = [];
            if (typeof earnedBadges !== 'undefined') {
                if (typeof BADGE_DEFS !== 'undefined') BADGE_DEFS.forEach(function(b) { if (earnedBadges.has(b.id)) allEarned.push({ id: b.id, emoji: b.emoji, name: b.name }); });
            }
            var earnedHidden = JSON.parse(localStorage.getItem('btc_hidden_badges') || '[]');
            if (typeof HIDDEN_BADGES !== 'undefined') HIDDEN_BADGES.forEach(function(b) { if (earnedHidden.indexOf(b.id) !== -1) allEarned.push({ id: b.id, emoji: b.hidden ? (b.revealEmoji || b.emoji) : b.emoji, name: b.hidden ? (b.revealName || b.name) : b.name }); });

            if (allEarned.length > 0) {
                var currentBadgeDisplay = lvl.emoji + ' Rank (default)';
                if (chosenBadge) {
                    var found = allEarned.find(function(b) { return b.id === chosenBadge; });
                    if (found) currentBadgeDisplay = found.emoji + ' ' + found.name;
                }
                var _badgePickerHtml = '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">' +
                    '<div style="color:var(--text-muted);font-size:0.75rem;margin-bottom:10px;">Choose a badge to show next to your name instead of your rank emoji.</div>' +
                    '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">';
                _badgePickerHtml += '<div onclick="setDisplayBadge(\'\')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;border:1px solid ' + (!chosenBadge ? 'var(--accent)' : 'var(--border)') + ';background:' + (!chosenBadge ? 'rgba(247,147,26,0.1)' : 'var(--card-bg)') + ';cursor:pointer;margin-bottom:6px;transition:0.2s;"><span style="font-size:1.3rem;">' + lvl.emoji + '</span><div><div style="color:var(--text);font-size:0.85rem;font-weight:600;">' + lvl.name + ' (Default)</div><div style="color:var(--text-faint);font-size:0.7rem;">Your current rank emoji</div></div>' + (!chosenBadge ? '<span style="margin-left:auto;color:var(--accent);font-size:0.8rem;font-weight:700;">✓</span>' : '') + '</div>';
                for (var bi = 0; bi < allEarned.length; bi++) {
                    var b = allEarned[bi];
                    var isChosen = chosenBadge === b.id;
                    _badgePickerHtml += '<div onclick="setDisplayBadge(\'' + b.id + '\')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;border:1px solid ' + (isChosen ? 'var(--accent)' : 'var(--border)') + ';background:' + (isChosen ? 'rgba(247,147,26,0.1)' : 'var(--card-bg)') + ';cursor:pointer;margin-bottom:6px;transition:0.2s;"><span style="font-size:1.3rem;">' + b.emoji + '</span><div><div style="color:var(--text);font-size:0.85rem;font-weight:600;">' + b.name + '</div></div>' + (isChosen ? '<span style="margin-left:auto;color:var(--accent);font-size:0.8rem;font-weight:700;">✓</span>' : '') + '</div>';
                }
                _badgePickerHtml += '</div></div>';

                _advHtml += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
                    '<div onclick="var _bp=document.getElementById(\'badgePickerPanel\');var _arr=document.getElementById(\'badgePickerArrow\');if(_bp){var open=_bp.style.display===\'block\';_bp.style.display=open?\'none\':\'block\';if(_arr)_arr.textContent=open?\'▸\':\'▾\';}" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;-webkit-tap-highlight-color:rgba(247,147,26,0.2);">' +
                    '<div><div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">🏅 Display Badge</div>' +
                    '<div style="color:var(--text);font-size:0.85rem;margin-top:4px;">' + currentBadgeDisplay + '</div></div>' +
                    '<span id="badgePickerArrow" style="color:var(--text-faint);font-size:1rem;transition:0.2s;">▸</span></div>' +
                    '<div id="badgePickerPanel" style="display:none;">' + _badgePickerHtml + '</div>' +
                    '</div>';
            }
        }

        // Change username
        const currentName = currentUser ? currentUser.username || '' : '';
        _advHtml += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">✏️ Change Username</div>' +
            '<div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:10px;">Current username: <span style="color:var(--accent);font-weight:700;">' + currentName + '</span></div>' +
            ((currentUser && currentUser.usernameFreeRename === true) ? '<div style="color:var(--accent);font-size:0.8rem;margin-bottom:10px;">You have one free username change. It skips the 24 hour wait once.</div>' : '') +
            '<input type="text" id="newUsername" value="" placeholder="Type your new username here..." maxlength="20" style="width:100%;padding:12px 14px;background:var(--input-bg);border:2px solid var(--border);border-radius:10px;color:var(--text);font-size:1rem;font-family:inherit;outline:none;margin-bottom:10px;box-sizing:border-box;" onfocus="this.style.borderColor=\'var(--accent)\'" onblur="this.style.borderColor=\'var(--border)\'">' +
            '<button onclick="changeUsername()" style="width:100%;padding:12px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;">Save New Username</button>' +
            '<div id="usernameStatus" style="margin-top:8px;font-size:0.85rem;"></div></div>';

        // Artist Profile (inside Advanced Account)
        _advHtml += '<button onclick="showArtistProfileModal()" style="width:100%;padding:14px;background:linear-gradient(135deg,rgba(247,147,26,0.08),rgba(234,88,12,0.04));border:2px solid rgba(247,147,26,0.2);border-radius:12px;color:var(--accent);font-size:0.9rem;cursor:pointer;font-family:inherit;font-weight:700;margin-bottom:12px;display:flex;align-items:center;justify-content:center;gap:8px;">🎸 Artist Profile</button>';

        // Profile section (OUTSIDE advAcctContent - always visible)
        var bio = currentUser ? currentUser.bio || '' : '';
        // Social links config: key, emoji, label, placeholder, maxlen, type
        var _slDef = [
            { k:'website', e:'🌐', l:'Website', p:'https://yoursite.com', m:100, t:'url' },
            { k:'twitter', e:'X', l:'Twitter/X', p:'@yourusername', m:30 },
            { k:'nostr', e:'🟣', l:'Nostr', p:'npub... or NIP-05', m:80 },
            { k:'instagram', e:'📸', l:'Instagram', p:'@yourusername', m:30 },
            { k:'tiktok', e:'🎵', l:'TikTok', p:'@yourusername', m:30 },
            { k:'github', e:'🐙', l:'GitHub', p:'yourusername', m:40 },
            { k:'contactEmail', e:'📧', l:'Email', p:'you@example.com', m:80, t:'email', note:'public' },
            { k:'lightning', e:'⚡', l:'Lightning', p:'you@walletofsatoshi.com', m:80 }
        ];
        // Build list of filled links and available (empty) links
        var _filledLinks = [], _emptyLinks = [];
        _slDef.forEach(function(s) {
            var val = currentUser ? currentUser[s.k] || '' : '';
            if (s.k === 'lightning' && currentUser) val = currentUser.lightning || currentUser.lightningAddress || '';
            if (val) _filledLinks.push(s);
            else _emptyLinks.push(s);
        });

        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">📝 Public Profile</div>' +
            '<div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:10px;">Visible when someone clicks your name on the leaderboard</div>' +
            '<label style="color:var(--text-muted);font-size:0.8rem;display:block;margin-bottom:4px;">Bio <span id="bioCharCount" style="color:var(--text-faint);">(' + (160 - bio.length) + ' chars left)</span></label>' +
            '<textarea id="profileBio" maxlength="160" rows="2" placeholder="Tell the community about yourself..." style="width:100%;padding:10px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:16px;font-family:inherit;outline:none;resize:vertical;box-sizing:border-box;margin-bottom:12px;" oninput="document.getElementById(\'bioCharCount\').textContent=\'(\' + (160-this.value.length) + \' chars left)\'">' + escapeHtml(bio) + '</textarea>';

        // Existing links shown as editable chips
        html += '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🔗 Links & Socials</div>';
        html += '<div id="profileLinksArea">';
        _filledLinks.forEach(function(s) {
            var val = currentUser ? currentUser[s.k] || '' : '';
            if (s.k === 'lightning' && currentUser) val = currentUser.lightning || currentUser.lightningAddress || '';
            if (s.k === 'lightning') {
                html += '<div class="pf-link-row" data-key="lightning" style="margin-bottom:12px;background:rgba(255,255,255,0.02);padding:10px;border-radius:12px;border:1px solid var(--border);">' +
                    '<div style="display:flex;align-items:center;gap:12px;">' +
                    '<span style="font-size:1.2rem;width:28px;text-align:center;flex-shrink:0;">' + s.e + '</span>' +
                    '<span id="profileLnReadonly" style="flex:1;color:var(--text);font-size:0.85rem;word-break:break-all;"></span>' +
                    '</div>' +
                    '<p style="margin:8px 0 0;font-size:0.75rem;color:var(--text-muted);line-height:1.45;">' + LN_ADDRESS_LOCKED_NOTICE + '</p>' +
                    '<p style="margin:8px 0 0;font-size:0.75rem;color:var(--text-muted);line-height:1.45;">This is your permanent Lightning Address for withdrawals. If you ever need to change it, contact support at info.603btc@gmail.com.</p>' +
                    '</div>';
                return;
            }
            html += '<div class="pf-link-row" data-key="' + s.k + '" style="display:flex;align-items:center;gap:12px;margin-bottom:12px;background:rgba(255,255,255,0.02);padding:10px;border-radius:12px;border:1px solid var(--border);">' +
                '<span style="font-size:1.2rem;width:28px;text-align:center;flex-shrink:0;">' + s.e + '</span>' +
                '<input type="' + (s.t || 'text') + '" id="profile_' + s.k + '" value="' + escapeHtml(val) + '" placeholder="' + s.p + '" maxlength="' + s.m + '" style="flex:1;padding:8px 10px;background:var(--input-bg,rgba(255,255,255,0.05));border:1px solid var(--border);border-radius:8px;color:var(--text,#e2e8f0);font-size:16px;font-family:inherit;outline:none;box-sizing:border-box;min-width:0;-webkit-appearance:none;">' +
                '<button onclick="document.getElementById(\'profile_' + s.k + '\').value=\'\';this.parentElement.remove();profileLinkRemoved(\'' + s.k + '\')" style="background:rgba(239,68,68,0.1);border:none;color:#ef4444;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;touch-action:manipulation;" title="Remove">✕</button>' +
            '</div>';
        });
        html += '</div>';

        // Add link dropdown - only show if there are empty slots
        if (_emptyLinks.length > 0) {
            html += '<div id="addLinkArea" style="margin-bottom:12px;">' +
                '<button id="addLinkBtn" onclick="document.getElementById(\'addLinkMenu\').style.display=document.getElementById(\'addLinkMenu\').style.display===\'none\'?\'block\':\'none\'" style="display:flex;align-items:center;gap:6px;padding:8px 12px;background:none;border:1px dashed var(--border);border-radius:8px;color:var(--text-muted);font-size:0.85rem;cursor:pointer;font-family:inherit;width:100%;touch-action:manipulation;"><span style="font-size:1rem;">+</span> Add a link</button>' +
                '<div id="addLinkMenu" style="display:none;margin-top:6px;background:var(--bg-side);border:1px solid var(--border);border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.3);">';
            _emptyLinks.forEach(function(s) {
                html += '<button onclick="addProfileLink(\'' + s.k + '\',\'' + s.e + '\',\'' + s.l + '\',\'' + s.p + '\',' + s.m + ',\'' + (s.t||'text') + '\')" style="display:flex;align-items:center;gap:10px;width:100%;padding:11px 14px;background:none;border:none;border-bottom:1px solid var(--border);color:var(--text);font-size:0.9rem;cursor:pointer;font-family:inherit;text-align:left;touch-action:manipulation;"><span style="font-size:1.1rem;">' + s.e + '</span> ' + s.l + (s.note ? ' <span style="color:var(--text-faint);font-size:0.7rem;">(' + s.note + ')</span>' : '') + '</button>';
            });
            html += '</div></div>';
        }

        html += '<button onclick="saveProfile()" style="width:100%;padding:10px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;">Save Profile</button>' +
            '<div id="profileStatus" style="margin-top:6px;font-size:0.8rem;"></div>' +
            '</div>';

                // Lightning wallet prompt (only if no Lightning Address set)
        var _hasLn = currentUser && (currentUser.lightning || currentUser.lightningAddress);
        if (!_hasLn || (typeof _withdrawalLnEligible === 'function' && _withdrawalLnEligible())) {
            html += '<button type="button" onclick="openWithdrawalAddress({mode:\'reset\'})" style="width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:0.9rem;font-weight:800;cursor:pointer;font-family:inherit;margin-bottom:12px;">Set your withdrawal Lightning Address</button>';
        }
        if (!_hasLn) {
            html += '<div onclick="hideUsernamePrompt();setTimeout(function(){go(\'lightning\')},300)" style="width:100%;padding:16px;background:linear-gradient(135deg,rgba(234,179,8,0.08),rgba(247,147,26,0.04));border:2px solid rgba(247,147,26,0.25);border-radius:14px;cursor:pointer;margin-bottom:12px;display:flex;align-items:center;gap:12px;transition:0.2s;" onmouseover="this.style.borderColor=\'#f7931a\'" onmouseout="this.style.borderColor=\'rgba(247,147,26,0.25)\'">' +
                '<span style="font-size:1.8rem;">⚡</span>' +
                '<div><div style="color:var(--heading);font-weight:700;font-size:0.9rem;">Connect a Lightning Wallet</div>' +
                '<div style="color:var(--text-muted);font-size:0.78rem;line-height:1.4;">Tip other users and receive tips from the community!</div></div>' +
                '<span style="color:var(--accent);font-size:1.1rem;margin-left:auto;">→</span></div>';
        }

        // Peers / Gifts section - collapsible, above Advanced Account
        html += '<button onclick="var p=document.getElementById(\'peersSectionContent\');p.style.display=p.style.display===\'none\'?\'block\':\'none\';var _arrows=this.querySelectorAll(\'span\');if(_arrows.length)_arrows[_arrows.length-1].textContent=p.style.display===\'none\'?\'▼\':\'▲\'" style="width:100%;padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:12px;display:flex;align-items:center;justify-content:center;gap:6px;">🧡 Peers / Gifts <span id="peersGiftsBadge"></span> <span>▼</span></button>';
        html += '<div id="peersSectionContent" style="display:none;margin-bottom:12px;">';
        html += '<style>@media(max-width:420px){.peer-action-row .peer-primary,.peer-action-row .peer-more{flex-basis:100%!important;}}'
            + '#peersSectionContent .peer-sent{color:#f97316;}#peersSectionContent .peer-hold{color:#c4b5fd;}#peersSectionContent .peer-remove{color:#fca5a5;}'
            + '[data-theme="light"] #peersSectionContent .peer-sent{color:#c2410c;}'
            + '[data-theme="light"] #peersSectionContent .peer-hold{color:#6d28d9;}'
            + '[data-theme="light"] #peersSectionContent .peer-remove{color:#b91c1c;}</style>';
        html += '<div style="padding:12px 14px;margin-bottom:10px;background:var(--bg-side);border:1px solid rgba(247,147,26,0.45);border-radius:12px;text-align:left;">';
        html += '<div style="font-size:0.84rem;color:var(--text);line-height:1.45;">Peers are people you can send keys to. A key opens a locked cipher with the same label. You can send up to 3 keys to each peer, once a day. If an accepted peer opens a matching cipher with a key you sent, you both get the same prize and you see a reveal of what you won. That counts as one of your 21 cipher opens that day, pays once per cipher, and includes sats only when both accounts are eligible.</div>';
        html += '</div>';
        html += '<div style="padding:12px 14px;margin-bottom:12px;background:var(--bg-side);border:1px solid rgba(124,58,237,0.45);border-radius:12px;text-align:left;">';
        html += '<div style="font-size:0.84rem;color:var(--text);line-height:1.45;">🔒 Locked cipher: you need a key with the same label, such as 3A, to open it. Keys come from daily wheel gifts. Ask a peer to send you a matching key. Ask in Chat whether anyone has the key.</div>';
        html += '<button type="button" onclick="if(typeof window.openGlobalChatForCipher===\'function\')window.openGlobalChatForCipher()" style="margin-top:8px;min-height:40px;padding:8px 12px;background:transparent;border:1px solid var(--link);border-radius:8px;color:var(--link);font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;">Open Global Chat</button>';
        html += '</div>';
        html += '<div id="peersList" style="font-size:0.85rem;color:var(--text-muted);text-align:left;padding:4px 0 8px;">Loading...</div>';
        html += '<div style="margin-top:14px;padding:14px 16px;background:rgba(247,147,26,0.06);border:1px solid rgba(247,147,26,0.2);border-radius:12px;">';
        html += '<div style="font-size:0.7rem;font-weight:800;color:#f7931a;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">🎡 Daily wheel and gifts</div>';
        html += '<div style="font-size:0.8rem;color:var(--text-muted);line-height:1.55;margin-bottom:8px;">Spin the daily wheel once a day. You earn 2 to 5 gifts. Open each gift right away — gifts are not stored. A gift can hold keys, locked ciphers, orange tickets, XP, a streak shield, a closet item, or a rare Nacho shoutout.</div>';
        html += '<div style="font-size:0.8rem;color:var(--text-muted);line-height:1.55;margin-bottom:8px;">Keys and locked ciphers carry labels such as 3A. A key opens the cipher with the same label. If you get a matching pair, open it right away. You can send up to 3 keys per peer each day, and as many peers as you want.</div>';
        html += '<div style="font-size:0.8rem;color:var(--text-muted);line-height:1.55;margin-bottom:10px;">You can open up to 21 ciphers per day. Most opens pay 50 to 250 XP and 0 to 10 orange tickets. Rare opens pay sats. Wins under 1,000 sats can be claimed with a Lightning invoice or address. Wins of 1,000 sats or more are paid by Phil.</div>';
        html += '<div id="giftsTabContent"></div>';
        html += '<button type="button" onclick="if(typeof window.openKeysAndCiphers===\'function\')window.openKeysAndCiphers()" style="margin-top:8px;width:100%;padding:10px;background:linear-gradient(135deg,#f7931a,#ea580c);border:none;border-radius:10px;color:#fff;font-size:0.85rem;font-weight:800;cursor:pointer;font-family:inherit;">Open keys and ciphers</button>';
        html += '</div>';
        // Partnership levels info
        html += '<div style="margin-top:14px;padding:14px 16px;background:rgba(247,147,26,0.06);border:1px solid rgba(247,147,26,0.2);border-radius:12px;">';
        html += '<div style="font-size:0.7rem;font-weight:800;color:#f7931a;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">⚡ Partnership Levels</div>';
        html += '<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:10px;line-height:1.5;">When you open a cipher with a key a peer sent you, the partnership grows. Both of you earn XP at each level.</div>';
        var _pLevels = [
            { emoji: '⬜', name: 'Unconfirmed',        gifts: '0 exchanges',   xp: '—',           desc: 'Just connected.' },
            { emoji: '🟨', name: 'Opening Channel',    gifts: '1 exchange',    xp: '+3,000 XP',   desc: 'First exchange. The channel is opening.' },
            { emoji: '⚡', name: 'Routing Nodes',      gifts: '21 exchanges',  xp: '+21,000 XP',  desc: 'You\'re routing value to each other.' },
            { emoji: '⚙️', name: 'Adjusted Fees',      gifts: '44 exchanges',  xp: '+44,000 XP',  desc: 'You\'ve dialled in the fee rate together.' },
            { emoji: '🔗', name: 'Balanced Liquidity', gifts: '144 exchanges', xp: '+50,000 XP',  desc: 'Inbound and outbound, perfectly balanced.' },
            { emoji: '🟠', name: 'Wumbo Channel',      gifts: '210 exchanges', xp: '+100,000 XP', desc: 'No limits. Big volume. Wumbo mode activated.' },
        ];
        _pLevels.forEach(function(lvl) {
            html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">';
            html += '<span style="font-size:1.4rem;flex-shrink:0;">' + lvl.emoji + '</span>';
            html += '<div style="flex:1;min-width:0;">';
            html += '<div style="font-size:0.82rem;font-weight:700;color:var(--heading);">' + lvl.name + ' <span style="font-size:0.7rem;font-weight:500;color:var(--text-faint);">' + lvl.gifts + '</span></div>';
            html += '<div style="font-size:0.72rem;color:var(--text-muted);">' + lvl.desc + '</div>';
            html += '</div>';
            html += '<span style="font-size:0.72rem;font-weight:700;color:#f7931a;flex-shrink:0;">' + lvl.xp + '</span>';
            html += '</div>';
        });
        html += '</div>';
        html += '<div id="cipherWinsAdmin" style="margin-top:12px;"></div>';
        html += '<div id="faucetAbuseAdmin" style="margin-top:12px;"></div>';
        html += '</div>';

        // Advanced Account toggle - content renders BELOW this button
        html += '<button onclick="var p=document.getElementById(\'advAcctContent\');p.style.display=p.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'span\').textContent=p.style.display===\'none\'?\'▼\':\'▲\'" style="width:100%;padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:12px;display:flex;align-items:center;justify-content:center;gap:6px;">⚙️ Advanced Account <span>▼</span></button>';

        // Advanced Account content (hidden, appears at bottom when toggled)
        html += '<div id="advAcctContent" style="display:none;">' + _advHtml + '</div>';

function accountEmailCardHtml(user) {
    if (!user || user.isAnonymous) return '';
    var action = accountEmailAction(user);
    var masked = maskEmailAddress(user.email || '');
    var verified = user.emailVerified ? 'Verified' : 'Not verified';
    var provider = oauthOwnsEmail(user) ? 'Linked sign-in' : (user.email ? 'Email sign-in' : 'No email yet');
    var html = '<div id="accountEmailCard" style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;text-align:left;">';
    html += '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Email</div>';
    html += '<div style="color:var(--heading);font-weight:700;font-size:0.95rem;">' + (masked ? accountLinkEscape(masked) : 'No email on this account') + '</div>';
    html += '<div style="color:var(--text-muted);font-size:0.8rem;margin-top:4px;">' + accountLinkEscape(provider) + (user.email ? ' · ' + verified : '') + '</div>';
    if (action === 'provider') {
        html += '<div style="color:var(--text-muted);font-size:0.8rem;margin-top:8px;line-height:1.45;">That email belongs to your linked sign-in. Manage it under Sign-in methods.</div>';
    } else if (action === 'add') {
        html += '<button type="button" onclick="showChangeEmailModal()" style="margin-top:10px;padding:10px 14px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;">Add email</button>';
    } else if (action === 'change') {
        html += '<button type="button" onclick="showChangeEmailModal()" style="margin-top:10px;padding:10px 14px;background:var(--card-bg);color:var(--text);border:1px solid var(--border);border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;">Change email</button>';
    }
    html += '</div>';
    return html;
}

function accountDeleteRowHtml(user) {
    var html = '<div id="deleteAccountRow" style="background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.35);border-radius:12px;padding:16px;margin-bottom:16px;text-align:left;">';
    if (!user || user.isAnonymous) {
        html += '<div style="font-size:0.75rem;color:#ef4444;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-weight:800;">Guest data</div>';
        html += '<div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:12px;line-height:1.5;">Clear this guest session and the progress stored on it.</div>';
        html += '<button type="button" onclick="showDeleteAccountConfirm()" style="width:100%;padding:12px;background:none;border:2px solid #ef4444;border-radius:10px;color:#ef4444;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;">Clear guest data</button>';
    } else {
        html += '<div style="font-size:0.75rem;color:#ef4444;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-weight:800;">Delete account</div>';
        html += '<div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:12px;line-height:1.5;">Delete this account after you confirm your username. Sats still on the account are forfeited. There is no waiting period.</div>';
        html += '<button type="button" id="accountDeleteButton" onclick="showDeleteAccountConfirm()" style="width:100%;padding:12px;background:none;border:2px solid #ef4444;border-radius:10px;color:#ef4444;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;">Delete account</button>';
    }
    html += '</div>';
    return html;
}

        html += accountEmailCardHtml(user);

        html += renderSignInMethodsCard(user, (typeof currentUser !== 'undefined') ? currentUser : null);

        html += accountDeleteRowHtml(user);

        html += '<button onclick="signOutUser()" style="width:100%;padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:#ef4444;font-size:0.9rem;cursor:pointer;font-family:inherit;font-weight:600;">Sign Out</button>';

    } else if (settingsTab === '_artist_removed') {
        // Artist Profile
        var ap = currentUser ? (currentUser.artistProfile || {}) : {};
        var hasUploads = false;
        // Check if user has uploaded tracks
        if (typeof db !== 'undefined' && auth && auth.currentUser) {
            var _artistUid = auth.currentUser.uid;
        }

        html += '<div style="text-align:center;margin-bottom:20px;">' +
            '<div style="font-size:2.5rem;margin-bottom:8px;">🎸</div>' +
            '<div style="color:var(--heading);font-weight:800;font-size:1.2rem;">Artist Profile</div>' +
            '<div style="color:var(--text-muted);font-size:0.8rem;">Set up your artist presence on Bitcoin Beats</div>' +
        '</div>';

        // Artist / Stage Name
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🎤 Stage Name</div>' +
            '<input type="text" id="artistStageName" maxlength="40" placeholder="Your artist or stage name" value="' + escapeHtml(ap.stageName || '') + '" style="width:100%;padding:10px 14px;background:var(--input-bg,#111);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;font-family:inherit;box-sizing:border-box;">' +
            '<div style="font-size:0.7rem;color:var(--text-faint);margin-top:4px;">Shows on your tracks and artist page. Leave blank to use your username.</div>' +
        '</div>';

        // Artist Bio
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">📝 Artist Bio</div>' +
            '<textarea id="artistBio" maxlength="500" rows="4" placeholder="Tell listeners about your music, influences, and style..." style="width:100%;padding:10px 14px;background:var(--input-bg,#111);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.85rem;font-family:inherit;box-sizing:border-box;resize:vertical;">' + escapeHtml(ap.bio || '') + '</textarea>' +
            '<div style="font-size:0.7rem;color:var(--text-faint);margin-top:4px;">Music-specific bio. Your general bio is in Account tab.</div>' +
        '</div>';

        // Genres
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🎵 Genres</div>' +
            '<input type="text" id="artistGenres" maxlength="100" placeholder="e.g. hip-hop, lo-fi, bitcoin anthems" value="' + escapeHtml(ap.genres || '') + '" style="width:100%;padding:10px 14px;background:var(--input-bg,#111);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;font-family:inherit;box-sizing:border-box;">' +
            '<div style="font-size:0.7rem;color:var(--text-faint);margin-top:4px;">Comma-separated. Shows as tags on your artist page.</div>' +
        '</div>';

        // Music Links
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🔗 Music Links</div>' +
            '<div style="display:flex;flex-direction:column;gap:8px;">' +
                '<div style="display:flex;align-items:center;gap:8px;"><span style="width:20px;text-align:center;">🌊</span><input type="url" id="artistLinkWavlake" placeholder="Wavlake URL" value="' + escapeHtml(ap.wavlake || '') + '" style="flex:1;padding:8px 12px;background:var(--input-bg,#111);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.85rem;font-family:inherit;box-sizing:border-box;"></div>' +
                '<div style="display:flex;align-items:center;gap:8px;"><span style="width:20px;text-align:center;">🟢</span><input type="url" id="artistLinkSpotify" placeholder="Spotify URL" value="' + escapeHtml(ap.spotify || '') + '" style="flex:1;padding:8px 12px;background:var(--input-bg,#111);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.85rem;font-family:inherit;box-sizing:border-box;"></div>' +
                '<div style="display:flex;align-items:center;gap:8px;"><span style="width:20px;text-align:center;">🎵</span><input type="url" id="artistLinkSoundcloud" placeholder="SoundCloud URL" value="' + escapeHtml(ap.soundcloud || '') + '" style="flex:1;padding:8px 12px;background:var(--input-bg,#111);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.85rem;font-family:inherit;box-sizing:border-box;"></div>' +
                '<div style="display:flex;align-items:center;gap:8px;"><span style="width:20px;text-align:center;">📺</span><input type="url" id="artistLinkYoutube" placeholder="YouTube URL" value="' + escapeHtml(ap.youtube || '') + '" style="flex:1;padding:8px 12px;background:var(--input-bg,#111);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.85rem;font-family:inherit;box-sizing:border-box;"></div>' +
                '<div style="display:flex;align-items:center;gap:8px;"><span style="width:20px;text-align:center;">🔗</span><input type="url" id="artistLinkOther" placeholder="Other link (Bandcamp, website, etc.)" value="' + escapeHtml(ap.otherLink || '') + '" style="flex:1;padding:8px 12px;background:var(--input-bg,#111);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.85rem;font-family:inherit;box-sizing:border-box;"></div>' +
            '</div>' +
        '</div>';

        // Lightning tip reminder
        html += '<div style="background:rgba(234,179,8,0.06);border:1px solid rgba(234,179,8,0.2);border-radius:12px;padding:14px;margin-bottom:16px;">' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
                '<span style="font-size:1.2rem;">⚡</span>' +
                '<div style="flex:1;">' +
                    '<div style="color:#eab308;font-weight:700;font-size:0.85rem;">Lightning Tips</div>' +
                    '<div style="color:var(--text-muted);font-size:0.78rem;margin-top:2px;">' +
                        (currentUser && (currentUser.lightningAddress || currentUser.lightning)
                            ? '✅ Lightning Address set: <strong>' + escapeHtml(currentUser.lightningAddress || currentUser.lightning) + '</strong>'
                            : '⚠️ No Lightning Address set. Go to <strong>Account</strong> tab or set up in <strong>⚡ Wallet</strong> to receive tips!') +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';

        // Save button
        html += '<button onclick="saveArtistProfile()" id="artistSaveBtn" style="width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 4px 15px rgba(247,147,26,0.3);margin-bottom:12px;">💾 Save Artist Profile</button>';

        // View artist page button
        html += '<button onclick="hideUsernamePrompt();if(typeof beatsShowArtistPage===\'function\')beatsShowArtistPage(\'' + (auth && auth.currentUser ? auth.currentUser.uid : '') + '\')" style="width:100%;padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.85rem;cursor:pointer;font-family:inherit;">👀 Preview My Artist Page</button>';

    } else if (settingsTab === 'scholar') {
        // Scholar - Quests, Certifications, Flashcards
        html += '<div style="margin-bottom:20px;text-align:center;">' +
            '<div style="font-size:2.5rem;margin-bottom:8px;">🎓</div>' +
            '<div style="color:var(--heading);font-weight:800;font-size:1.3rem;">Bitcoin Scholar</div>' +
            '<p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:20px;">Master Bitcoin through quests, certifications, and flashcards.</p>' +
            '</div>';

        // Start a Quest
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:16px;padding:20px;margin-bottom:16px;text-align:center;">' +
            '<div style="font-size:1.8rem;margin-bottom:8px;">⚡</div>' +
            '<div style="color:var(--heading);font-weight:800;font-size:1.1rem;margin-bottom:8px;">Channel Quests</div>' +
            '<p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:15px;line-height:1.4;">Test your knowledge on any Bitcoin topic with guided quiz questions.</p>' +
            '<button onclick="hideUsernamePrompt(); startQuestManual();" style="width:100%;padding:12px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-weight:800;font-size:0.9rem;cursor:pointer;">⚡ Start a Quest</button>' +
            '</div>';

        // Scholar Certification - Properties. Pass flags are server-owned.
        var propPassed = !!(currentUser && currentUser.certPassed_prop === true);
        html += '<div style="background:linear-gradient(135deg, rgba(247,147,26,0.1), rgba(247,147,26,0.02));border:1px solid '+(propPassed ? '#22c55e' : 'var(--accent)')+';border-radius:16px;padding:20px;margin-bottom:16px;text-align:center;">' +
            '<div style="font-size:1.8rem;margin-bottom:8px;">'+(propPassed ? '✅' : '📜')+'</div>' +
            '<div style="color:var(--heading);font-weight:800;font-size:1.1rem;margin-bottom:8px;">Bitcoin Scholar Certification</div>' +
            '<p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:15px;line-height:1.4;">25 questions on the <strong>economic properties</strong> and scarcity of Bitcoin. 80% to pass. One attempt per day.</p>' +
            '<button onclick="hideUsernamePrompt(); startScholarQuest(\'properties\');" style="width:100%;padding:12px;background:'+(propPassed ? '#22c55e' : 'var(--accent)')+';color:#ffffff;border:none;border-radius:10px;font-weight:800;font-size:0.9rem;cursor:pointer;">'+(propPassed ? '✅ View Certificate' : '🎓 Start Scholar Exam')+'</button>' +
            '</div>';

        // Scholar Certification - Technical
        var techPassed = !!(currentUser && currentUser.certPassed_tech === true);
        html += '<div style="background:linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.02));border:1px solid '+(techPassed ? '#22c55e' : '#3b82f6')+';border-radius:16px;padding:20px;margin-bottom:16px;text-align:center;">' +
            '<div style="font-size:1.8rem;margin-bottom:8px;">'+(techPassed ? '✅' : '🛠️')+'</div>' +
            '<div style="color:var(--heading);font-weight:800;font-size:1.1rem;margin-bottom:8px;">Bitcoin Protocol Expert</div>' +
            '<p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:15px;line-height:1.4;">25 questions on <strong>highly technical</strong> topics: BIPs, Script, SegWit, Taproot, and Networking.</p>' +
            '<button onclick="hideUsernamePrompt(); startScholarQuest(\'technical\');" style="width:100%;padding:12px;background:'+(techPassed ? '#22c55e' : '#3b82f6')+';color:#ffffff;border:none;border-radius:10px;font-weight:800;font-size:0.9rem;cursor:pointer;">'+(techPassed ? '✅ View Certificate' : '🛠️ Start Technical Exam')+'</button>' +
            '</div>';

        // Flashcards (collapsible)
        html += '<div style="margin-bottom:16px;text-align:center;">' +
            '<button onclick="var p=document.getElementById(\'flashcardsPanel\');p.style.display=p.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'span\').textContent=p.style.display===\'none\'?\'▼\':\'▲\'" style="width:100%;padding:14px;background:var(--card-bg);border:1px solid var(--border);border-radius:16px;color:var(--text);font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;">📚 Study Flashcards <span>▼</span></button>' +
            '<div id="flashcardsPanel" style="display:none;margin-top:12px;padding:16px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;">' +
            '<p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:12px;">Prepare for quests and exams with interactive flashcards.</p>' +
            '<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">';
        var flashTopics = [
            {name:'Bitcoin Basics', emoji:'₿'}, {name:'Security & Storage', emoji:'🔑'}, {name:'Lightning Network', emoji:'⚡'},
            {name:'Mining & Energy', emoji:'⛏️'}, {name:'Economics & Money', emoji:'💰'}, {name:'History & Culture', emoji:'📜'},
            {name:'Privacy & Sovereignty', emoji:'🕵️'}, {name:'Nodes & P2P', emoji:'📡'}, {name:'Wallets & Tools', emoji:'💼'},
            {name:'Common Myths', emoji:'🚫'}, {name:'Austrian Economics', emoji:'🇦🇹'}, {name:'Cypherpunk History', emoji:'🔐'},
            {name:'Bitcoin Governance', emoji:'🏛️'}, {name:'Satoshi Nakamoto', emoji:'🦸'}, {name:'Global Impact', emoji:'🌍'},
            {name:'El Salvador & Adoption', emoji:'🇸🇻'}, {name:'Technical Deep Dives', emoji:'🔬'}
        ];
        flashTopics.forEach(function(t) {
            html += '<button onclick="hideUsernamePrompt();startFlashcards(\'' + t.name.replace(/[\\'"]/g, "") + '\')" style="padding:6px 10px;background:var(--bg-side);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.75rem;cursor:pointer;font-family:inherit;transition:0.2s;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' + t.emoji + ' ' + t.name + '</button>';
        });
        html += '</div></div></div>';

        // The Signal section (collapsible, moved from its own tab)
        html += '<button onclick="var p=document.getElementById(\'signalPanel\');p.style.display=p.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'span\').textContent=p.style.display===\'none\'?\'▼\':\'▲\';if(p.style.display!==\'none\')loadSignalContent()" style="width:100%;padding:14px;background:var(--card-bg);border:1px solid var(--border);border-radius:16px;color:var(--text);font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:16px;">📡 The Weekly Signal <span>▼</span></button>';
        html += '<div id="signalPanel" style="display:none;">';

        // Ticker toggle
        var _sigTickerPref = localStorage.getItem('btc_ticker_enabled'); var _sigTickerOn = _sigTickerPref === null ? (typeof isMobile === 'function' ? !isMobile() : window.innerWidth > 900) : _sigTickerPref === 'true';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;margin-bottom:16px;">' +
            '<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:1rem;">📊</span><span style="color:var(--text);font-size:0.85rem;font-weight:600;">Live Ticker on Home</span></div>' +
            '<button onclick="localStorage.setItem(\'btc_ticker_enabled\',localStorage.getItem(\'btc_ticker_enabled\')===\'true\'?\'false\':\'true\');showSettingsPage(\'scholar\');" style="padding:6px 16px;border:1px solid var(--border);border-radius:8px;background:' + (_sigTickerOn ? '#22c55e' : 'var(--bg-side)') + ';color:' + (_sigTickerOn ? '#fff' : 'var(--text-muted)') + ';font-size:0.8rem;cursor:pointer;font-family:inherit;font-weight:600;">' + (_sigTickerOn ? 'ON' : 'OFF') + '</button></div>';

        // Signal headlines container
        html += '<div id="signalLiveNews" style="overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;margin-bottom:16px;"><div style="display:flex;gap:12px;padding:4px 0;min-width:min-content;"></div></div>';
        html += '<style>#signalLiveNews::-webkit-scrollbar{display:none;}</style>';

        // Featured deep dives
        var signalPosts = [
            { date: 'Feb 26, 2026', title: 'Why Proof of Stake is just Fiat 2.0', snippet: 'Most cryptos claim to be better than Bitcoin because they use less energy. But energy IS the point.', channel: 'pow-vs-pos' },
            { date: 'Feb 19, 2026', title: 'The Great Definancialization', snippet: 'Why we don\'t need thousands of stocks if we have one form of hard money.', channel: 'problems-of-money' },
            { date: 'Feb 12, 2026', title: 'The 21 Million Cap is Inviolate', snippet: 'Even if every miner wanted to change the supply, they couldn\'t.', channel: 'scarce' }
        ];
        signalPosts.forEach(function(n) {
            html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px;text-align:left;">' +
                '<div style="font-size:0.65rem;color:var(--accent);font-weight:800;margin-bottom:4px;">' + n.date.toUpperCase() + '</div>' +
                '<div style="color:var(--heading);font-weight:700;font-size:0.9rem;margin-bottom:4px;">' + n.title + '</div>' +
                '<div style="color:var(--text-muted);font-size:0.78rem;line-height:1.4;margin-bottom:8px;">' + n.snippet + '</div>' +
                '<button onclick="hideUsernamePrompt();go(\'' + n.channel + '\')" style="padding:6px 14px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit;">📖 Read →</button></div>';
        });

        // Subscribe
        var isOptedIn = (currentUser && currentUser.newsletterOptIn);
        if (!isOptedIn) {
            html += '<div style="padding:16px;background:var(--accent-bg);border-radius:12px;text-align:center;border:1px dashed var(--accent);">' +
                '<div style="color:var(--heading);font-weight:700;font-size:0.85rem;margin-bottom:8px;">📧 Get The Signal via Email</div>' +
                '<button onclick="if(typeof optInNewsletter===\'function\')optInNewsletter();showSettingsPage(\'scholar\')" style="padding:8px 18px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.8rem;">Subscribe</button></div>';
        } else {
            html += '<div style="text-align:center;padding:12px;color:#22c55e;font-size:0.8rem;">✅ Subscribed to The Signal!</div>';
        }
        html += '</div>'; // close signalPanel

    } else if (settingsTab === 'signal') {
        // The Weekly Signal - Newsletter
        html += '<div style="margin-bottom:20px;text-align:center;">' +
            '<div style="font-size:2.5rem;margin-bottom:8px;">📡</div>' +
            '<div style="color:var(--heading);font-weight:800;font-size:1.3rem;">The Weekly Signal</div>' +
            '<p style="color:var(--text-muted);font-size:0.85rem;">Curated Bitcoin insights and site updates.</p>' +
            '</div>';

        // Ticker toggle (also in Prefs)
        var _sigTickerPref = localStorage.getItem('btc_ticker_enabled'); var _sigTickerOn = _sigTickerPref === null ? (typeof isMobile === 'function' ? !isMobile() : window.innerWidth > 900) : _sigTickerPref === 'true';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;margin-bottom:16px;">' +
            '<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:1rem;">📊</span><span style="color:var(--text);font-size:0.85rem;font-weight:600;">Live Ticker on Home</span></div>' +
            '<button onclick="localStorage.setItem(\'btc_ticker_enabled\',localStorage.getItem(\'btc_ticker_enabled\')===\'true\'?\'false\':\'true\');showSettingsPage(\'signal\');" style="padding:6px 16px;border:1px solid var(--border);border-radius:8px;background:' + (_sigTickerOn ? '#22c55e' : 'var(--bg-side)') + ';color:' + (_sigTickerOn ? '#fff' : 'var(--text-muted)') + ';font-size:0.8rem;cursor:pointer;font-family:inherit;font-weight:600;">' + (_sigTickerOn ? 'ON' : 'OFF') + '</button></div>';

        // Curated editorial + live news from ticker
        var signalPosts = [
            { date: 'Feb 26, 2026', title: 'Why Proof of Stake is just Fiat 2.0', snippet: 'Most cryptos claim to be better than Bitcoin because they use less energy. But Gigi explains why energy IS the point - PoW converts real-world resources into unforgeable security.', channel: 'pow-vs-pos' },
            { date: 'Feb 19, 2026', title: 'The Great Definancialization', snippet: 'Parker Lewis breaks down why we don\'t need thousands of stocks, bonds, and derivatives if we have one form of hard money that can\'t be debased.', channel: 'problems-of-money' },
            { date: 'Feb 12, 2026', title: 'The 21 Million Cap is Inviolate', snippet: 'Why even if every miner in the world wanted to change the supply, they couldn\'t. The users run the rules.', channel: 'scarce' },
            { date: 'Feb 5, 2026', title: 'Not Your Keys, Not Your Coins', snippet: 'After another exchange collapse, the importance of self-custody has never been clearer. Here\'s how to take control.', channel: 'self-custody' },
            { date: 'Jan 29, 2026', title: 'The Halving: Scarcity You Can Verify', snippet: 'Every 210,000 blocks, the supply issuance gets cut in half. No vote. No committee. Just code.', channel: 'difficulty-adjustment' }
        ];

        // Live Signal headlines from ticker (newsletter-data.json)
        html += '<div style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-weight:700;">📡 Live Signals</div>';
        html += '<div style="position:relative;margin-bottom:20px;">' +
            '<button id="signalArrowL" onclick="var s=document.getElementById(\'signalLiveNews\');if(s)s.scrollBy({left:-280,behavior:\'smooth\'})" style="display:none;position:absolute;left:-6px;top:50%;transform:translateY(-50%);z-index:2;background:var(--card-bg);border:1px solid var(--border);border-radius:50%;width:32px;height:32px;color:var(--text);font-size:1rem;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);align-items:center;justify-content:center;">‹</button>' +
            '<div id="signalLiveNews" style="overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;"><div style="display:flex;gap:12px;padding:4px 0;min-width:min-content;"></div></div>' +
            '<button id="signalArrowR" onclick="var s=document.getElementById(\'signalLiveNews\');if(s)s.scrollBy({left:280,behavior:\'smooth\'})" style="display:none;position:absolute;right:-6px;top:50%;transform:translateY(-50%);z-index:2;background:var(--card-bg);border:1px solid var(--border);border-radius:50%;width:32px;height:32px;color:var(--text);font-size:1rem;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);align-items:center;justify-content:center;">›</button>' +
        '</div>';
        html += '<style>#signalLiveNews::-webkit-scrollbar{display:none;}</style>';

        html += '<div style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;margin-top:16px;font-weight:700;">📚 Featured Deep Dives</div>';

        signalPosts.forEach(function(n) {
            html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:16px;padding:16px;margin-bottom:12px;text-align:left;">' +
                '<div style="font-size:0.7rem;color:var(--accent);font-weight:800;margin-bottom:4px;">' + n.date.toUpperCase() + '</div>' +
                '<div style="color:var(--heading);font-weight:700;font-size:1rem;margin-bottom:6px;">' + n.title + '</div>' +
                '<div style="color:var(--text-muted);font-size:0.85rem;line-height:1.5;margin-bottom:10px;">' + n.snippet + '</div>' +
                '<button onclick="hideUsernamePrompt();go(\'' + n.channel + '\')" style="padding:8px 16px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;">📖 Read in Archive →</button>' +
                '</div>';
        });

        // Fetch Signal headlines from curated ticker data
        setTimeout(function() {
            var container = document.getElementById('signalLiveNews');
            if (!container) return;

            fetch('newsletter-data.json?v=' + Date.now()).then(function(r) { return r.json(); }).then(function(data) {
                if (!data || !data.news || data.news.length === 0) {
                    container.innerHTML = '<div style="color:var(--text-faint);font-size:0.8rem;">No signals available</div>';
                    return;
                }
                var inner = container.querySelector('div') || container;
                var cardsHtml = '';
                data.news.slice(0, 3).forEach(function(n, i) {
                    var title = (n.title || '').replace(/<[^>]+>/g, '');
                    var snippet = (n.snippet || '').replace(/<[^>]+>/g, '');
                    var link = n.link || '';
                    cardsHtml += '<div style="min-width:260px;max-width:300px;flex-shrink:0;background:var(--card-bg);border:1px solid var(--border);border-radius:16px;padding:16px;text-align:left;cursor:pointer;transition:0.2s;" ' +
                        (link ? 'onclick="window.open(\'' + link.replace(/[\\'"]/g, "") + '\',\'_blank\')"' : '') +
                        ' onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
                        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">' +
                            '<span style="background:var(--accent);color:#fff;font-size:0.6rem;font-weight:900;padding:2px 8px;border-radius:10px;">SIGNAL #' + (i + 1) + '</span>' +
                            '<span style="font-size:0.65rem;color:var(--text-faint);">' + (n.date || '').toUpperCase() + '</span>' +
                        '</div>' +
                        '<div style="color:var(--heading);font-weight:700;font-size:0.9rem;line-height:1.4;margin-bottom:6px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">' + title + '</div>' +
                        (snippet ? '<div style="color:var(--text-muted);font-size:0.75rem;margin-bottom:8px;">' + snippet + '</div>' : '') +
                        (link ? '<div style="color:var(--accent);font-size:0.75rem;font-weight:700;">Read full article →</div>' : '') +
                    '</div>';
                });
                inner.innerHTML = cardsHtml;

                // Show arrow buttons on desktop if content overflows
                var updateSignalArrows = function() {
                    var lBtn = document.getElementById('signalArrowL');
                    var rBtn = document.getElementById('signalArrowR');
                    if (!lBtn || !rBtn) return;
                    var canScroll = container.scrollWidth > container.clientWidth + 10;
                    if (canScroll) {
                        lBtn.style.display = container.scrollLeft > 10 ? 'flex' : 'none';
                        rBtn.style.display = container.scrollLeft + container.clientWidth < container.scrollWidth - 10 ? 'flex' : 'none';
                    } else {
                        lBtn.style.display = 'none';
                        rBtn.style.display = 'none';
                    }
                };
                container.addEventListener('scroll', updateSignalArrows);
                setTimeout(updateSignalArrows, 200);
            }).catch(function() {
                container.innerHTML = '<div style="color:var(--text-faint);font-size:0.8rem;">Could not load signals</div>';
            });
        }, 100);

        var isOptedIn = (currentUser && currentUser.newsletterOptIn);
        if (!isOptedIn) {
            html += '<div style="padding:20px;background:var(--accent-bg,rgba(247,147,26,0.05));border-radius:16px;text-align:center;margin-top:16px;border:1px dashed var(--accent);">' +
                '<div style="font-size:1.5rem;margin-bottom:8px;">📧</div>' +
                '<div style="color:var(--heading);font-weight:700;font-size:0.9rem;margin-bottom:4px;">Get The Signal via Email</div>' +
                '<p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:12px;">Weekly curated Bitcoin insights. No spam, pure signal.</p>' +
                '<button onclick="if(typeof optInNewsletter===\'function\')optInNewsletter();showSettingsPage(\'signal\')" style="padding:10px 20px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;">Subscribe to The Signal</button>' +
                '</div>';
        } else {
            html += '<div style="text-align:center;padding:16px;color:#22c55e;font-size:0.85rem;">✅ You\'re subscribed to The Signal!</div>';
        }

    } else if (settingsTab === 'tickets') {
        // Orange Tickets & Referral Program
        const isAnon = !user || user.isAnonymous;
        if (isAnon) {
            html += '<div style="text-align:center;padding:40px 20px;">' +
                '<div style="font-size:3rem;margin-bottom:12px;"><svg viewBox="0 0 24 24" style="width:1em;height:1em;vertical-align:-0.15em;display:inline-block"><path fill="#f7931a" d="M22 10V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v4c1.1 0 2 .9 2 2s-.9 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2z"/></svg></div>' +
                '<div style="color:var(--heading);font-weight:700;font-size:1.2rem;margin-bottom:8px;">Orange Tickets</div>' +
                '<div style="color:var(--text-muted);font-size:0.9rem;margin-bottom:20px;">Sign in with Google, Twitter, or GitHub to start earning Orange Tickets and get your referral link!</div>' +
                '</div>';
        } else {
            html += typeof renderTicketsSection === 'function' ? renderTicketsSection() : '';
            html += typeof renderReferralSection === 'function' ? renderReferralSection() : '';

            // How it works
            html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
                '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">How to Earn Tickets</div>' +
                '<div style="color:var(--text-muted);font-size:0.8rem;line-height:1.8;">' +
                '<strong style="color:var(--text);">📅 Daily Login:</strong> +1 ticket/day just for visiting.<br>' +
                '<strong style="color:var(--text);">🎡 Daily Spin:</strong> Spin the wheel for 1-5+ tickets!<br>' +
                '<strong style="color:var(--text);">🎯 Daily Trifecta:</strong> Complete quiz + trivia + poll = +1 ticket/day.<br>' +
                '<strong style="color:var(--text);">🦌 Nacho Chat:</strong> Send Nacho a message = +1 ticket/day.<br>' +
                '<strong style="color:var(--text);">💬 Global Chat:</strong> First message of the day = +2 tickets.<br>' +
                '<strong style="color:var(--text);">📺 Timechain TV:</strong> Watch 10 min = +1 ticket (stacks!).<br>' +
                '<strong style="color:var(--text);">⚔️ PvP Win:</strong> Win a knowledge duel = +1 ticket.<br>' +
                '<strong style="color:var(--text);">🔱 Raid Boss:</strong> Deal damage = +1 ticket/hit (max 50/day).<br>' +
                '<strong style="color:var(--text);">🗣️ PlebTalk:</strong> Post in the forum = +1 ticket/day.<br>' +
                '<strong style="color:var(--text);">🛒 Lightning Mart:</strong> Post a listing = +1 ticket/day.<br>' +
                '<strong style="color:var(--text);">🤝 IRL Sync:</strong> Host a meetup event = +1 ticket.<br>' +
                '<strong style="color:var(--text);">🚶 Proof of Walk:</strong> Connect Strava = +5 tickets (one-time).<br>' +
                '<strong style="color:var(--text);">🎵 Beat Upload:</strong> Upload a track = +10 tickets.<br>' +
                '<strong style="color:var(--text);">🎧 DJ Set:</strong> Start a DJ set = +5 tickets/set.<br>' +
                '<strong style="color:var(--text);">📚 Scholar:</strong> Complete a flashcard deck = +5 tickets.<br>' +
                '<strong style="color:var(--text);">❤️ Donate XP:</strong> Donate 1,000+ XP = +1 ticket/day.<br>' +
                '<strong style="color:var(--text);">👥 Referrals:</strong> Earn <strong style="color:var(--accent);">50 tickets</strong> per friend who reaches Maxi rank.<br>' +
                '<strong style="color:var(--text);">⭐ Bonus:</strong> Each ticket also earns +5 XP.<br>' +
                '<strong style="color:#eab308;">🏆 Giveaways:</strong> More tickets = higher chance of winning sats!' +
                '</div></div>';
        }

        // Load referral stats asynchronously
        if (!isAnon && typeof loadReferralStatsUI === 'function') {
            setTimeout(loadReferralStatsUI, 100);
        }

    } else if (settingsTab === 'sats') {
        // ===== SATS FAUCET TAB =====
        var _satsSubTab = window._satsSubTab || 'claim'; // 'claim' | 'donate'
        var isAnon = user.isAnonymous;
        var userPts = currentUser ? currentUser.points || 0 : 0;
        var pointsClaimed = currentUser ? currentUser.pointsClaimed || 0 : 0;
        var pointsDonated = currentUser ? currentUser.pointsDonated || 0 : 0;
        var pointsExchanged = currentUser ? currentUser.pointsExchanged || 0 : 0;
        // All three offset counters reduce the redeemable pool
        var availableForClaim = userPts - pointsClaimed - pointsDonated - pointsExchanged;
        var _claimMath = (typeof window.claimableSats === 'function') ? window.claimableSats(currentUser || {}) : null;
        var satsWithdrawn = _claimMath ? _claimMath.withdrawn : (currentUser ? currentUser.satsWithdrawn || 0 : 0);
        var satsBalance = _claimMath ? _claimMath.balance : Math.floor(Math.max(0, availableForClaim) / 10); // 10 pts = 1 sat
        var _satCap = _claimMath ? _claimMath.cap : lifetimeSatCap();
        var lifetimeLeft = _claimMath ? _claimMath.lifetimeLeft : Math.max(0, _satCap - satsWithdrawn);
        var claimable = Math.min(satsBalance, 200, lifetimeLeft);
        var lastClaim = currentUser ? currentUser.lastSatsClaim || null : null;
        var canClaimTime = lastClaim ? new Date(lastClaim.seconds ? lastClaim.seconds * 1000 : lastClaim).getTime() + (24 * 60 * 60 * 1000) : 0;
        var now = Date.now();
        var onCooldown = lastClaim && now < canClaimTime;
        var cooldownStr = '';
        if (onCooldown) {
            var diff = canClaimTime - now;
            var hrs = Math.floor(diff / 3600000);
            var mins = Math.floor((diff % 3600000) / 60000);
            cooldownStr = hrs + 'h ' + mins + 'm';
        }
        // Prefer the server-tracked arrayUnion-only field (visitedChannelsList); fall back
        // to the legacy readChannels array for users who haven't been migrated yet.
        // Also fall back to the localStorage list if the user doc hasn't loaded yet.
        var channelsRead = 0;
        if (currentUser) {
            if (Array.isArray(currentUser.visitedChannelsList)) channelsRead = currentUser.visitedChannelsList.length;
            else if (Array.isArray(currentUser.readChannels)) channelsRead = currentUser.readChannels.length;
            else if (currentUser.readChannels && typeof currentUser.readChannels === 'object') channelsRead = Object.keys(currentUser.readChannels).length;
        }
        // If we still have 0 but localStorage has a non-empty list, use that as a
        // last resort (covers the narrow window where the user doc hasn't synced yet).
        if (channelsRead === 0) {
            try {
                var _localList = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]');
                if (Array.isArray(_localList) && _localList.length > channelsRead) channelsRead = _localList.length;
            } catch(e) {}
        }
        var acctCreated = user.metadata && user.metadata.creationTime ? new Date(user.metadata.creationTime) : null;
        var acctAgeDays = acctCreated ? Math.floor((now - acctCreated.getTime()) / 86400000) : 0;
        var hasEmail = user.email && user.emailVerified;
        var holdRaw = currentUser ? currentUser.satsHold : 0;
        var holdUntil = 0;
        if (holdRaw && typeof holdRaw.seconds === 'number') holdUntil = holdRaw.seconds * 1000;
        else if (holdRaw && typeof holdRaw.toMillis === 'function') holdUntil = holdRaw.toMillis();
        else holdUntil = Number(holdRaw) || 0;
        if (window._satsHoldUntil && Number(window._satsHoldUntil) > holdUntil) holdUntil = Number(window._satsHoldUntil);
        var satsHeld = holdUntil > now;

        // Eligibility checks
        var eligible = !isAnon && hasEmail && acctAgeDays >= 7 && channelsRead >= 10;
        var meetsMin = satsBalance >= 100;

        // Sub-tab switcher
        html += '<div style="display:flex;gap:8px;margin-bottom:20px;">';
        html += '<button id="satsSubClaim" onclick="window._satsSubTab=\'claim\';showSettingsPage(\'sats\')" style="flex:1;padding:10px 0;border-radius:12px;border:1px solid ' + (_satsSubTab==='claim'?'var(--accent)':'var(--border)') + ';background:' + (_satsSubTab==='claim'?'var(--accent)':'none') + ';color:' + (_satsSubTab==='claim'?'#fff':'var(--text-muted)') + ';font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">⚡ Claim Sats</button>';
        html += '<button id="satsSubDonate" onclick="window._satsSubTab=\'donate\';showSettingsPage(\'sats\')" style="flex:1;padding:10px 0;border-radius:12px;border:1px solid ' + (_satsSubTab==='donate'?'#ef4444':'var(--border)') + ';background:' + (_satsSubTab==='donate'?'linear-gradient(135deg,#ef4444,#dc2626)':'none') + ';color:' + (_satsSubTab==='donate'?'#fff':'var(--text-muted)') + ';font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">❤️ Donate XP</button>';
        html += '</div>';

        if (satsHeld) {
            var holdWhen = new Date(holdUntil).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
            html += '<div id="satsHoldNotice" style="background:rgba(239,68,68,0.12);border:1px solid #ef4444;border-radius:12px;padding:12px;margin-bottom:16px;color:#ef4444;font-size:0.9rem;font-weight:700;line-height:1.45;">Sats withdrawals are paused until ' + holdWhen + '</div>';
        }

        if (_satsSubTab !== 'donate') {
        html += '<div style="text-align:center;margin-bottom:20px;">';
        html += '<div style="font-size:2.5rem;">⚡</div>';
        html += '<div style="font-size:1.3rem;font-weight:800;color:var(--accent);margin-top:4px;">Claim Real Sats</div>';
        html += '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">Earn XP → Convert to real Bitcoin over Lightning</div>';
        html += '</div>';

        // Balance card
        html += '<div style="background:linear-gradient(135deg, rgba(249,115,22,0.1), rgba(234,179,8,0.1));border:1px solid var(--accent);border-radius:16px;padding:20px;margin-bottom:16px;text-align:center;">';
        html += '<div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Your Balance</div>';
        html += '<div style="font-size:2rem;font-weight:900;color:var(--accent);margin:8px 0;">⚡ ' + satsBalance.toLocaleString() + ' claimable sats</div>';
        var _displayAvail = Math.max(0, availableForClaim);
        var _availLabel = availableForClaim < 0
            ? '<span style="color:#ef4444;">' + _displayAvail.toLocaleString() + ' available XP</span> <span style="font-size:0.65rem;color:#ef4444;">(claims + donations exceed current total - keep earning!)</span>'
            : _displayAvail.toLocaleString() + ' available XP (' + userPts.toLocaleString() + ' total - ' + pointsClaimed.toLocaleString() + ' claimed - ' + pointsDonated.toLocaleString() + ' donated - ' + pointsExchanged.toLocaleString() + ' exchanged)';
        html += '<div style="font-size:0.75rem;color:var(--text-muted);">' + _availLabel + '</div>';
        html += '<div style="font-size:0.7rem;color:var(--text-faint);margin-top:8px;">Lifetime withdrawn: ' + satsWithdrawn.toLocaleString() + ' / 15,000 sats</div>';
        html += '</div>';
        // ── Overflow queue section ──
        var _pendingOf = currentUser ? parseInt(currentUser.pendingOverflow || 0, 10) : 0;
        if (_pendingOf > 0) {
            var _ofDL = Math.ceil(_pendingOf / 1000);
            html += '<div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);border-radius:14px;padding:16px;margin-bottom:16px;">';
            html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;"><div style="font-weight:700;font-size:0.85rem;color:#a5b4fc;">⏳ Queued Overflow XP</div><div style="font-size:0.6rem;font-weight:800;background:rgba(99,102,241,0.2);color:#a5b4fc;padding:2px 8px;border-radius:20px;">~' + _ofDL + ' day' + (_ofDL !== 1 ? 's' : '') + '</div></div>';
            html += '<div style="font-size:1.3rem;font-weight:900;font-family:monospace;color:#c7d2fe;margin-bottom:8px;">+' + _pendingOf.toLocaleString() + ' XP</div>';
            html += '<div style="font-size:0.72rem;color:var(--text-muted);line-height:1.6;">This is leftover XP from before the shared daily cap. New XP is not added here. A day pays full XP through 500, half through 900, then a quarter until 1,000.</div>';
            html += '<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:10px;">';
            var _tileCap = Math.min(_ofDL, 10);
            for (var _td = 0; _td < _tileCap; _td++) {
                html += '<div style="width:24px;height:24px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:0.5rem;font-weight:800;font-family:monospace;' + (_td === 0 ? 'background:#6366f1;color:#fff;' : 'background:var(--border);color:var(--text-muted);') + '">' + (_td === 0 ? '▶' : String(_td + 1)) + '</div>';
            }
            if (_ofDL > 10) html += '<div style="width:24px;height:24px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:0.6rem;color:#6366f1;font-weight:800;">…</div>';
            html += '</div></div>';
        }

        // Claim button area
        if (!isAnon && eligible && meetsMin && !onCooldown && claimable >= 100) {
            html += '<button onclick="initSatsClaim()" style="width:100%;padding:16px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:800;cursor:pointer;font-family:inherit;margin-bottom:16px;transition:0.2s;touch-action:manipulation;">⚡ Claim Up to ' + Math.min(claimable, 200) + ' Sats</button>';
        } else if (onCooldown) {
            html += '<div style="width:100%;padding:16px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;text-align:center;margin-bottom:16px;color:var(--text-muted);font-size:0.85rem;">⏳ Next claim in <strong>' + cooldownStr + '</strong></div>';
        } else if (!meetsMin && eligible) {
            if (availableForClaim < 0) {
                html += '<div style="width:100%;padding:16px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:12px;text-align:center;margin-bottom:16px;color:var(--text-muted);font-size:0.85rem;">⚠️ Your XP is fully used up between past claims and donations.<br><span style="font-size:0.75rem;">Earn <strong style="color:var(--accent);">' + Math.abs(availableForClaim + 1000).toLocaleString() + ' more XP</strong> to unlock your next claim.</span></div>';
            } else {
                html += '<div style="width:100%;padding:16px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;text-align:center;margin-bottom:16px;color:var(--text-muted);font-size:0.85rem;">Need <strong>' + (100 - satsBalance) + ' more sats</strong> (' + ((100 - satsBalance) * 10) + ' XP) to reach minimum claim</div>';
            }
        } else {
            html += '<div style="width:100%;padding:16px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;text-align:center;margin-bottom:16px;color:var(--text-muted);font-size:0.85rem;">Complete requirements below to claim</div>';
        }

        // Requirements checklist
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:16px;">';
        html += '<div style="font-weight:700;font-size:0.85rem;margin-bottom:12px;color:var(--text);">📋 Requirements</div>';

        var checks = [
            { met: !isAnon, label: 'Signed in (not anonymous)', detail: isAnon ? 'Sign in with email, Google, etc.' : '✓ Signed in' },
            { met: hasEmail, label: 'Email verified', detail: hasEmail ? '✓ ' + user.email : 'Link & verify your email in Account tab' },
            { met: acctAgeDays >= 7, label: 'Account age ≥ 7 days', detail: acctAgeDays >= 7 ? '✓ ' + acctAgeDays + ' days old' : acctAgeDays + '/7 days - ' + (7 - acctAgeDays) + ' more to go' },
            { met: channelsRead >= 10, label: 'Read ≥ 10 topics', detail: channelsRead >= 10 ? '✓ ' + channelsRead + ' topics read' : channelsRead + '/10 topics - read ' + (10 - channelsRead) + ' more' },
            { met: meetsMin, label: 'Minimum 100 sats (1,000 pts)', detail: meetsMin ? '✓ ' + satsBalance + ' sats available' : satsBalance + '/100 sats - earn ' + ((100 - satsBalance) * 10) + ' more XP' }
        ];
        checks.forEach(function(c) {
            html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">';
            html += '<span style="font-size:1.1rem;">' + (c.met ? '✅' : '⬜') + '</span>';
            html += '<div style="flex:1;"><div style="font-size:0.8rem;font-weight:600;color:' + (c.met ? 'var(--text)' : 'var(--text-muted)') + ';">' + c.label + '</div>';
            html += '<div style="font-size:0.7rem;color:' + (c.met ? '#22c55e' : 'var(--text-faint)') + ';">' + c.detail + '</div></div></div>';
        });
        html += '</div>';

        // Rules & Limits
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:16px;">';
        html += '<div style="font-weight:700;font-size:0.85rem;margin-bottom:12px;color:var(--text);">⚡ How It Works</div>';
        html += '<div style="font-size:0.78rem;color:var(--text-muted);line-height:1.7;">';
        html += '• <strong>1,000 XP = 100 sats</strong> - earn XP by reading, quests, and daily visits<br>';
        html += '• <strong>Min claim: 100 sats</strong> (1,000 XP)<br>';
        html += '• <strong>Max claim: 200 sats/day</strong><br>';
        html += '• <strong>1 claim per 24 hours</strong><br>';
        html += '• <strong>Lifetime max: 15,000 sats</strong> per account<br>';
        html += '• <strong>Daily XP cap: 1,000 XP</strong> (100 sats worth) to prevent abuse<br>';
        html += '• Unclaimed sats roll over - no expiration<br>';
        html += '• Payouts via Lightning Network ⚡<br>';
        html += '</div>';
        html += '<div style="margin-top:10px;padding:10px 12px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:10px;font-size:0.75rem;color:#22c55e;line-height:1.5;">';
        html += '💚 <strong>Zero fees for you!</strong> We pay all Lightning network fees so you receive the full amount you claim. You earned it!';
        html += '</div></div>';

        // Earning guide (collapsible)
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;margin-bottom:16px;">';
        html += '<button onclick="event.stopPropagation();var c=document.getElementById(\'earnXPContent\');var a=this.querySelector(\'.earn-arrow\');if(c.style.display===\'none\'){c.style.display=\'block\';a.textContent=\'▲\'}else{c.style.display=\'none\';a.textContent=\'▼\'}" style="width:100%;padding:16px;background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;font-family:inherit;touch-action:manipulation;">';
        html += '<span style="font-weight:700;font-size:0.85rem;color:var(--text);">🎯 How to Earn XP</span>';
        html += '<span class="earn-arrow" style="color:var(--text-faint);font-size:0.8rem;">▼</span>';
        html += '</button>';
        html += '<div id="earnXPContent" onclick="event.stopPropagation()" style="display:none;padding:0 16px 16px;font-size:0.78rem;color:var(--text-muted);line-height:1.7;">';
        var _es = function(id, title, items) {
            return '<div style="margin-bottom:6px;border:1px solid var(--border);border-radius:10px;overflow:hidden;">' +
                '<button onclick="event.stopPropagation();var c=document.getElementById(\'' + id + '\');c.style.display=c.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'.ea\').textContent=c.style.display===\'none\'?\'▶\':\'▼\'" style="width:100%;padding:10px 12px;background:rgba(255,255,255,0.03);border:none;cursor:pointer;display:flex;align-items:center;gap:8px;font-family:inherit;touch-action:manipulation;">' +
                '<span class="ea" style="color:var(--text-faint);font-size:0.7rem;">▶</span>' +
                '<span style="color:var(--text);font-size:0.8rem;font-weight:700;">' + title + '</span></button>' +
                '<div id="' + id + '" style="display:none;padding:8px 12px 10px;font-size:0.76rem;color:var(--text-muted);line-height:1.7;">' + items.join('<br>') + '</div></div>';
        };
        html += _es('ep_read', '📚 Reading & Exploring', [
            '📖 Open a channel: <strong>10 XP</strong>',
            '⏱️ Read for 30 sec: <strong>15 XP</strong>',
            '🧭 Explore 10+ topics/session: <strong>50 XP</strong>',
            '🗺️ Exploration milestones: <strong>50-2,000 XP</strong> (10 / 25 / 50 / 100 / all topics)',
            '🔖 Bookmark a message: <strong>5 XP</strong>'
        ]);
        html += _es('ep_daily', '✅ Daily Activities', [
            '✅ Daily visit: <strong>5 XP</strong>',
            '🔥 Streak bonus: <strong>100 XP/day</strong>',
            '🎰 Daily spin: <strong>25-100 XP</strong> (XP reward spins)',
            '📈 Price prediction: <strong>5 XP</strong> (25 if correct!)',
            '📺 Watch Timechain TV: <strong>10 XP</strong> per 10 min watched',
            '⚡ Visit Lightning Wallet: <strong>5 XP</strong>',
            '🎯 Quest Hub - Daily Quiz: <strong>25-100 XP</strong>',
            '🧠 Quest Hub - Daily Trivia: <strong>10-15 XP</strong>',
            '📊 Quest Hub - Daily Poll: <strong>5 XP</strong>',
            '🏆 Complete all three in one day: <strong>bonus Satoshi\'s Favor point!</strong>'
        ]);
        html += _es('ep_quiz', '🧠 Quizzes & Learning', [
            '🎯 Daily quests (perfect): <strong>100 XP</strong> (50 for 3+, 25 retry)',
            '🧠 Nacho trivia pop-ups: <strong>10-15 XP</strong>',
            '🎮 Channel quizzes: <strong>10 XP</strong>',
            '🎯 Conversation quests: <strong>5 XP/correct</strong>',
            '📖 Nacho\'s Trails chapters: <strong>25-50 XP</strong> (100 for completing all)',
            '📖 Nacho\'s Story chapters: <strong>15 XP</strong> (50 final, 100 all + badges)',
            '🎓 Scholar Certification (Bitcoin): <strong>2,100 XP</strong>',
            '🎓 Scholar Certification (Protocol): <strong>2,100 XP</strong>'
        ]);
        html += _es('ep_social', '💬 Community & Social', [
            '📝 Forum post: <strong>10 XP</strong>',
            '💬 Forum reply: <strong>5 XP</strong>',
            '📝 Publish article: <strong>30 XP</strong>',
            '📖 Read an article: <strong>5 XP</strong>',
            '💬 Article comment: <strong>5 XP</strong>',
            '🌍 Global Chat message: <strong>5 XP</strong>',
            '🔥 Chat streaks: <strong>10-25 XP</strong> (3-day / 7-day)',
            '🤝 Host IRL event: <strong>15 XP</strong>',
            '🤝 Refer a friend: <strong>bonus XP per referral</strong>',
            '💬 Feedback bonus: <strong>5 XP</strong>'
        ]);
        html += _es('ep_lightning', '⚡ Lightning & Marketplace', [
            '⚡ Send a Lightning tip: <strong>10 XP</strong>',
            '⚡ Lightning wallet setup: <strong>100 XP</strong>',
            '🛍️ Contact a seller: <strong>5 XP</strong>',
            '🏪 List an item for sale: <strong>10 XP</strong>'
        ]);
        html += _es('ep_music', '🎵 Music & Content', [
            '🎵 Upload a song to Beats: <strong>50 XP</strong>',
            '🎧 Listen to a full track: <strong>10 XP</strong>',
            '💬 Comment on a Beats track: <strong>10 XP</strong>'
        ]);
        html += _es('ep_pvp', '⚔️ PVP & Competitions', [
            '⚔️ PVP match victory: <strong>score-based XP</strong>',
            '🧠 PVP practice question: <strong>10 XP/correct</strong>',
            '🏅 PVP badges: <strong>25-500 XP</strong>'
        ]);
        html += _es('ep_badges', '🏅 Badges', [
            '📚 Standard badges: <strong>20-2,000 XP each</strong>',
            '🔑 Hidden / secret badges: <strong>50-2,100 XP each</strong>',
            '🎯 Goal badges (Tickets, Exploration, Charity): <strong>200-15,000 XP</strong>',
            '🛒 First Purchase guide: <strong>100 XP</strong>',
            '🏆 Milestone badges (50 / 100 / 150 / 200 badges): <strong>5,000-21,000 XP</strong>',
            '💡 Tip: secret badges are discovered, not unlocked - explore everything!'
        ]);
        html += _es('ep_big', '🏆 Big Achievements', [
            '🌍 Set your country: <strong>100 XP</strong>',
            '🎓 Reach <em>Maxi</em> rank or higher: <strong>bonus SF points for the community</strong>',
            '🥇 Level-up milestones (Pleb → Satoshi): <strong>community Satoshi\'s Favor points</strong>',
            '🧩 Anonymous progress merged on sign-in: <strong>all XP preserved</strong>'
        ]);
        html += '</div></div>';

        // Withdrawal history placeholder
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:16px;">';
        html += '<div style="font-weight:700;font-size:0.85rem;margin-bottom:8px;color:var(--text);">📜 Withdrawal History</div>';
        html += '<div id="satsHistory" style="font-size:0.78rem;color:var(--text-muted);">Loading...</div>';
        html += '</div>';

        // Lightning Address section
        var _satsLnAddr = currentUser ? (currentUser.lightning || currentUser.lightningAddress || '') : '';
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:16px;">';
        html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;"><div style="width:36px;height:36px;background:linear-gradient(135deg,#eab308,#f97316);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;">⚡</div><div><div style="font-weight:700;font-size:0.85rem;color:var(--text);">Lightning Address</div><div style="font-size:0.72rem;color:var(--text-muted);">For receiving tips from other users</div></div></div>';
        var _satsLnEligible = !_satsLnAddr || !clientLnValid(normalizeClientLn(_satsLnAddr));
        try { if (sessionStorage.getItem('btc_ln_needs_reset') === '1') _satsLnEligible = true; } catch (eLnFlag) {}
        if (_satsLnAddr) {
            html += '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:10px;margin-bottom:8px;"><span style="color:#22c55e;font-size:0.9rem;">✅</span><span id="satsLnReadonly" style="color:var(--text);font-size:0.82rem;font-weight:600;word-break:break-all;"></span></div>';
            html += '<p style="margin:0 0 8px;font-size:0.75rem;color:var(--text-muted);line-height:1.45;">' + LN_ADDRESS_LOCKED_NOTICE + '</p>';
            html += '<p style="margin:0 0 8px;font-size:0.75rem;color:var(--text-muted);line-height:1.45;">This is your permanent Lightning Address for withdrawals. If you ever need to change it, contact support at info.603btc@gmail.com.</p>';
            html += '<button type="button" onclick="showWithdrawalAddressReadonly()" style="width:100%;padding:10px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:8px;">View withdrawal address</button>';
        } else {
            html += '<p style="margin:0 0 8px;font-size:0.75rem;color:var(--text-muted);line-height:1.45;">' + LN_ADDRESS_LOCK_NOTICE + '</p>';
            html += '<div style="display:flex;gap:8px;align-items:center;"><input type="text" id="satsLnAddrInput" placeholder="you@walletofsatoshi.com" value="" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" style="flex:1;padding:10px 12px;background:var(--input-bg,rgba(255,255,255,0.07));border:1px solid var(--border,#444);border-radius:10px;color:var(--text,#e2e8f0);font-size:16px;font-family:inherit;outline:none;box-sizing:border-box;-webkit-appearance:none;-webkit-text-fill-color:var(--text,#e2e8f0);" onkeydown="if(event.key===\'Enter\')saveSatsLnAddress()"><button onclick="saveSatsLnAddress()" style="padding:10px 16px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;touch-action:manipulation;">Save</button></div>';
        }
        if (_satsLnEligible) {
            html += '<button type="button" onclick="openWithdrawalAddress({mode:\'reset\'})" style="margin-top:8px;width:100%;padding:12px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.85rem;font-weight:800;cursor:pointer;font-family:inherit;">Set your withdrawal Lightning Address</button>';
        }
        html += '<div id="satsLnAddrStatus" style="margin-top:6px;font-size:0.75rem;text-align:center;"></div>';
        if (!_satsLnAddr) {
            html += '<div style="margin-top:8px;font-size:0.72rem;color:var(--text-faint);line-height:1.5;">💡 Get one from <a href="https://walletofsatoshi.com" target="_blank" rel="noopener" style="color:var(--accent);">Wallet of Satoshi</a>, <a href="https://getalby.com" target="_blank" rel="noopener" style="color:var(--accent);">Alby</a>, <a href="https://coinos.io" target="_blank" rel="noopener" style="color:var(--accent);">Coinos</a>, or <a href="https://strike.me" target="_blank" rel="noopener" style="color:var(--accent);">Strike</a>.</div>';
        }
        html += '<button onclick="hideUsernamePrompt();setTimeout(function(){go(\'lightning\')},200)" style="margin-top:10px;width:100%;padding:11px;background:none;border:1px dashed rgba(247,147,26,0.5);border-radius:10px;color:var(--accent);font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px;transition:0.2s;touch-action:manipulation;" onmouseover="this.style.background=\'rgba(247,147,26,0.08)\'" onmouseout="this.style.background=\'none\'">⚡ I need a Lightning Address →</button>';
        html += '</div>';

        // Legal disclaimer
        html += '<div style="font-size:0.68rem;color:var(--text-faint);line-height:1.6;text-align:center;padding:0 4px 8px;">' +
            'In-app sats balances are reward entitlements, not stored Bitcoin. We never custody user funds. ' +
            'Bitcoin&rsquo;s value is highly volatile. You are responsible for any tax obligations in your jurisdiction. ' +
            'Must be 18+ to participate. <a href="/terms.html" target="_blank" rel="noopener" style="color:var(--text-faint);text-decoration:underline;">Terms of Service</a>' +
        '</div>';

        } else {
        // ===== DONATE XP SUB-TAB =====
        var _donateAvail = Math.max(0, userPts - pointsClaimed - pointsDonated - pointsExchanged);
        var _userFaction = currentUser ? (currentUser.faction || '') : '';

        html += '<div style="text-align:center;margin-bottom:20px;">';
        html += '<div style="font-size:2.5rem;">❤️</div>';
        html += '<div style="font-size:1.3rem;font-weight:800;color:#ef4444;margin-top:4px;">Donate XP for Charity</div>';
        html += '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">1,000 XP = 1,000 sats donated - 10× more impact than claiming</div>';
        html += '</div>';

        // Balance card
        html += '<div style="background:linear-gradient(135deg,rgba(239,68,68,0.1),rgba(220,38,38,0.05));border:1px solid rgba(239,68,68,0.3);border-radius:16px;padding:20px;margin-bottom:16px;text-align:center;">';
        html += '<div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Available to Donate</div>';
        html += '<div data-sats-charity-avail style="font-size:2rem;font-weight:900;color:#ef4444;margin:8px 0;">❤️ ' + _donateAvail.toLocaleString() + ' XP</div>';
        var _rawAvailForDonate = userPts - pointsClaimed - pointsDonated - pointsExchanged;
        html += '<div style="font-size:0.75rem;color:var(--text-muted);">' + userPts.toLocaleString() + ' total - ' + pointsClaimed.toLocaleString() + ' claimed - ' + pointsDonated.toLocaleString() + ' donated - ' + pointsExchanged.toLocaleString() + ' exchanged</div>';
        if (_rawAvailForDonate < 0) {
            html += '<div style="margin-top:8px;font-size:0.75rem;color:#ef4444;font-weight:600;">⚠️ XP fully used - earn more to donate again</div>';
        }
        html += '</div>';

        if (isAnon) {
            html += '<div style="padding:16px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;text-align:center;color:var(--text-muted);font-size:0.85rem;margin-bottom:16px;">🔐 Sign in to donate XP</div>';
        } else if (!_userFaction) {
            html += '<div style="background:var(--card-bg);border:1px solid rgba(247,147,26,0.3);border-radius:14px;padding:20px;text-align:center;margin-bottom:16px;">';
            html += '<div style="font-size:1.4rem;margin-bottom:6px;">⚔️</div>';
            html += '<div style="font-size:0.9rem;font-weight:700;color:var(--heading);margin-bottom:6px;">Choose Your Faction First</div>';
            html += '<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:14px;">Your faction\u2019s donation total is tracked for the community leaderboard.</div>';
            html += '<button onclick="showSettingsPage(\'account\')" style="padding:10px 24px;background:linear-gradient(135deg,#f7931a,#e8720c);border:none;border-radius:10px;color:#fff;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">🐝🦡 Choose Faction → Account</button>';
            html += '</div>';
        } else {
            // Quick-pick percentage buttons - only show donate form if XP is available
            if (_donateAvail > 0) {
                var _quickPcts = [5, 10, 25, 50, 100];
                html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">';
                _quickPcts.forEach(function(pct) {
                    var amt = Math.floor(_donateAvail * pct / 100);
                    html += '<button onclick="window._satsCharitySetAmt(' + amt + ')" style="flex:1;min-width:50px;padding:8px 4px;border-radius:10px;border:1px solid var(--border);background:none;color:var(--text-muted);font-size:0.78rem;font-weight:700;cursor:pointer;font-family:inherit;" onmouseover="this.style.borderColor=\'#ef4444\';this.style.color=\'#ef4444\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.color=\'var(--text-muted)\'">' + pct + '%<br><span style="font-size:0.65rem;font-weight:400;">' + amt.toLocaleString() + '</span></button>';
                });
                html += '</div>';
                html += '<div style="display:flex;gap:8px;margin-bottom:12px;">';
                html += '<input id="satsCharityAmtInput" type="number" min="1" max="' + _donateAvail + '" placeholder="Custom amount" style="flex:1;padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:var(--input-bg,var(--card-bg));color:var(--text);font-size:0.9rem;font-family:inherit;outline:none;">';
                html += '</div>';
                html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">';
                html += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.82rem;color:var(--text-muted);"><input type="checkbox" id="satsCharityAnonToggle" style="width:16px;height:16px;cursor:pointer;accent-color:#ef4444;"> Donate anonymously</label>';
                html += '</div>';
                html += '<button onclick="window._satsCharitySubmit()" style="width:100%;padding:14px;background:linear-gradient(135deg,#ef4444,#dc2626);border:none;border-radius:12px;color:#fff;font-size:1rem;font-weight:800;cursor:pointer;font-family:inherit;margin-bottom:16px;">❤️ Donate XP for Charity</button>';
                if (pointsDonated > 0) {
                    html += '<div data-sats-donated-total style="font-size:0.75rem;color:var(--text-faint);text-align:center;margin-bottom:16px;">' + pointsDonated.toLocaleString() + ' XP already donated - thank you! ❤️</div>';
                }
            } else {
                html += '<div style="width:100%;padding:20px 16px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:12px;text-align:center;margin-bottom:16px;">';
                html += '<div style="font-size:1.8rem;margin-bottom:8px;">💸</div>';
                html += '<div style="font-size:0.92rem;font-weight:700;color:var(--text);margin-bottom:6px;">No XP Available to Donate</div>';
                html += '<div style="font-size:0.8rem;color:var(--text-muted);line-height:1.5;">Your XP is all accounted for between past sats claims and donations. Keep earning XP and it will show up here.</div>';
                if (pointsDonated > 0) {
                    html += '<div style="font-size:0.75rem;color:var(--text-faint);margin-top:10px;">' + pointsDonated.toLocaleString() + ' XP already donated - thank you! ❤️</div>';
                }
                html += '</div>';
            }
        }

        // Recent Donations section (same structure as Quest Hub charity tab - _patchCharityRecent fills it live)
        var _satsRecentArr = (typeof _charityRecent !== 'undefined' && Array.isArray(_charityRecent)) ? _charityRecent : [];
        html += '<div id="charityRecentWrapper" style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:16px;' + (_satsRecentArr.length === 0 ? 'display:none;' : '') + '">' +
            '<div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">📜 Recent Donations</div>' +
            '<div id="charityRecentList"></div>' +
        '</div>';

        // Expandable disclaimer note
        html += '<div style="margin-bottom:8px;">';
        html += '<button onclick="window._toggleSatsCharityNote()" style="width:100%;padding:10px 14px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.78rem;font-weight:600;cursor:pointer;font-family:inherit;text-align:left;">About Donations <span id="satsCharityNoteArrow">▼</span></button>';
        html += '<div id="satsCharityNote" style="display:none;background:var(--card-bg);border:1px solid var(--border);border-top:none;border-radius:0 0 10px 10px;padding:12px;font-size:0.78rem;color:var(--text-muted);line-height:1.5;">Donations are non-refundable and not tax-deductible. Faction is always recorded even for anonymous donations. Community votes on which charities receive the funds.</div>';
        html += '</div>';

        } // end donate sub-tab

    } else if (settingsTab === 'prefs') {
        html += '<div id="experienceModeCard" style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;font-weight:800;">🎛️ Experience Mode</div>' +
            '<div style="color:var(--text-muted);font-size:14px;margin-bottom:12px;line-height:1.5;">Choose how much you see. Open What\'s included before you pick. Your XP stays either way.</div>' +
            '<div id="experienceModePicker"></div>' +
            '<button type="button" onclick="if(window.showOnboardingIntro)window.showOnboardingIntro({force:true})" style="width:100%;margin-top:8px;padding:12px;min-height:44px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--heading);font-size:16px;font-weight:700;cursor:pointer;font-family:inherit;">Replay welcome tour</button>' +
            '</div>';

        // Appearance (Theme + Font Size combined)
        const isDark = document.body.getAttribute('data-theme') !== 'light';
        const isOLED = localStorage.getItem('btc_theme_oled') === 'true';
        const savedSize = localStorage.getItem('btc_font_size') || 'medium';
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🎨 Appearance</div>' +
            '<div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:6px;">Theme</div>' +
            '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
            '<button onclick="if(document.body.getAttribute(\'data-theme\')===\'light\')toggleTheme();document.body.classList.remove(\'oled-theme\');localStorage.setItem(\'btc_theme_oled\',\'false\');showSettingsPage(\'prefs\')" style="flex:1;padding:10px;border:' + (isDark && !isOLED ? '2px solid var(--accent)' : '1px solid var(--border)') + ';border-radius:8px;background:' + (isDark && !isOLED ? 'var(--accent-bg)' : 'var(--bg-side)') + ';color:' + (isDark && !isOLED ? 'var(--accent)' : 'var(--text)') + ';font-size:0.85rem;font-weight:' + (isDark && !isOLED ? '700' : '400') + ';cursor:pointer;font-family:inherit;">🌙 Dark</button>' +
            '<button onclick="if(document.body.getAttribute(\'data-theme\')===\'light\')toggleTheme();toggleOLEDTheme();showSettingsPage(\'prefs\')" style="flex:1;padding:10px;border:' + (isOLED ? '2px solid var(--accent)' : '1px solid var(--border)') + ';border-radius:8px;background:' + (isOLED ? '#000' : 'var(--bg-side)') + ';color:' + (isOLED ? 'var(--accent)' : 'var(--text)') + ';font-size:0.85rem;font-weight:' + (isOLED ? '700' : '400') + ';cursor:pointer;font-family:inherit;">🖤 OLED</button>' +
            '<button onclick="if(document.body.getAttribute(\'data-theme\')!==\'light\')toggleTheme();document.body.classList.remove(\'oled-theme\');localStorage.setItem(\'btc_theme_oled\',\'false\');showSettingsPage(\'prefs\')" style="flex:1;padding:10px;border:' + (!isDark ? '2px solid var(--accent)' : '1px solid var(--border)') + ';border-radius:8px;background:' + (!isDark ? 'var(--accent-bg)' : 'var(--bg-side)') + ';color:' + (!isDark ? 'var(--accent)' : 'var(--text)') + ';font-size:0.85rem;font-weight:' + (!isDark ? '700' : '400') + ';cursor:pointer;font-family:inherit;">☀️ Light</button>' +
            '</div>' +
            '<div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:6px;">Font Size</div>' +
            '<div style="display:flex;gap:8px;">';
        ['small', 'medium', 'large'].forEach(function(size) {
            var active = savedSize === size;
            var label = size.charAt(0).toUpperCase() + size.slice(1);
            var px = size === 'small' ? '14px' : size === 'medium' ? '16px' : '18px';
            html += '<button onclick="setFontSize(\'' + size + '\')" style="flex:1;padding:10px;border:' + (active ? '2px solid var(--accent)' : '1px solid var(--border)') + ';border-radius:8px;background:' + (active ? 'var(--accent-bg)' : 'var(--bg-side)') + ';color:' + (active ? 'var(--accent)' : 'var(--text)') + ';font-size:' + px + ';font-weight:' + (active ? '700' : '400') + ';cursor:pointer;font-family:inherit;">' + label + '</button>';
        });
        html += '</div></div>';

        // Language
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🌐 Language</div>' +
            '<div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:10px;">Translate the site to your preferred language</div>' +
            '<select id="langSelect" onchange="changeLanguage(this.value)" style="width:100%;padding:10px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.9rem;font-family:inherit;outline:none;cursor:pointer;">' +
            '<option value="">English (Default)</option>' +
            '<option value="es">🇪🇸 Español</option>' +
            '<option value="pt">🇧🇷 Português</option>' +
            '<option value="fr">🇫🇷 Français</option>' +
            '<option value="de">🇩🇪 Deutsch</option>' +
            '<option value="it">🇮🇹 Italiano</option>' +
            '<option value="nl">🇳🇱 Nederlands</option>' +
            '<option value="ru">🇷🇺 Русский</option>' +
            '<option value="uk">🇺🇦 Українська</option>' +
            '<option value="ar">🇸🇦 العربية</option>' +
            '<option value="zh-CN">🇨🇳 中文 (简体)</option>' +
            '<option value="zh-TW">🇹🇼 中文 (繁體)</option>' +
            '<option value="ja">🇯🇵 日本語</option>' +
            '<option value="ko">🇰🇷 한국어</option>' +
            '<option value="hi">🇮🇳 हिन्दी</option>' +
            '<option value="th">🇹🇭 ไทย</option>' +
            '<option value="vi">🇻🇳 Tiếng Việt</option>' +
            '<option value="tr">🇹🇷 Türkçe</option>' +
            '<option value="pl">🇵🇱 Polski</option>' +
            '<option value="sv">🇸🇪 Svenska</option>' +
            '<option value="cs">🇨🇿 Čeština</option>' +
            '</select>' +
            '<div id="langStatus" style="margin-top:6px;font-size:0.8rem;"></div>' +
            '</div>';

        // Set saved language in dropdown
        setTimeout(function() {
            const sel = document.getElementById('langSelect');
            const saved = localStorage.getItem('btc_lang') || '';
            if (sel) sel.value = saved;
        }, 50);

        // Font Size - merged into Appearance card above

        // Sound settings
        const soundOn = typeof audioEnabled === 'undefined' || audioEnabled;
        const vol = typeof audioVolume !== 'undefined' ? audioVolume : 0.5;
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🔊 Sound</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
            '<span style="color:var(--text);font-size:0.85rem;">Sound Effects</span>' +
            '<button onclick="toggleAudio();showSettingsPage(\'prefs\')" style="padding:6px 16px;border:1px solid var(--border);border-radius:8px;background:' + (soundOn ? '#22c55e' : 'var(--bg-side)') + ';color:' + (soundOn ? '#fff' : 'var(--text-muted)') + ';font-size:0.8rem;cursor:pointer;font-family:inherit;font-weight:600;">' + (soundOn ? 'ON' : 'OFF') + '</button></div>' +
            '<div style="display:flex;align-items:center;gap:10px;">' +
            '<span style="color:var(--text-muted);font-size:0.8rem;">Volume</span>' +
            '<input type="range" min="0" max="1" step="0.05" value="' + vol + '" oninput="setVolume(this.value)" style="flex:1;accent-color:#f7931a;cursor:pointer;">' +
            '</div></div>';

        // Advanced Prefs
        html += '<button onclick="var p=document.getElementById(\'advPrefsPanel\');p.style.display=p.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'span\').textContent=p.style.display===\'none\'?\'▼\':\'▲\'" style="width:100%;padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:12px;display:flex;align-items:center;justify-content:center;gap:6px;">⚙️ Advanced Prefs <span>▼</span></button>';
        html += '<div id="advPrefsPanel" style="display:none;">';

        // Nacho mascot toggle
        const _nachoHiddenPref = localStorage.getItem('btc_nacho_hidden');
        const nachoOn = _nachoHiddenPref !== 'true' && _nachoHiddenPref !== 'user';
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🦌 Nacho (Mascot)</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<span style="color:var(--text);font-size:0.85rem;">Show Nacho</span>' +
            '<button onclick="if(typeof ' + (nachoOn ? 'hideNacho' : 'showNacho') + '===\'function\'){' + (nachoOn ? 'hideNacho()' : 'showNacho()') + '}showSettingsPage(\'prefs\')" style="padding:6px 16px;border:1px solid var(--border);border-radius:8px;background:' + (nachoOn ? '#22c55e' : 'var(--bg-side)') + ';color:' + (nachoOn ? '#fff' : 'var(--text-muted)') + ';font-size:0.8rem;cursor:pointer;font-family:inherit;font-weight:600;">' + (nachoOn ? 'ON' : 'OFF') + '</button></div>' +
            '<div style="color:var(--text-faint);font-size:0.75rem;margin-top:6px;">Your friendly Bitcoin deer guide. Tap – on him to minimize, then tap 🦌 to bring him back.</div>';

        // Nacho sound toggle
        const nachoSoundOn = localStorage.getItem('btc_nacho_sound') !== 'false';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">' +
            '<span style="color:var(--text);font-size:0.85rem;">Nacho Sounds</span>' +
            '<button onclick="if(typeof toggleNachoSound===\'function\')toggleNachoSound();showSettingsPage(\'prefs\')" style="padding:6px 16px;border:1px solid var(--border);border-radius:8px;background:' + (nachoSoundOn ? '#22c55e' : 'var(--bg-side)') + ';color:' + (nachoSoundOn ? '#fff' : 'var(--text-muted)') + ';font-size:0.8rem;cursor:pointer;font-family:inherit;font-weight:600;">' + (nachoSoundOn ? 'ON' : 'OFF') + '</button></div>';

        // Nacho friendship level
        if (typeof getNachoFriendship === 'function') {
            var friendship = getNachoFriendship();
            html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">' +
                '<span style="color:var(--text);font-size:0.85rem;">Friendship Level</span>' +
                '<span style="color:var(--accent);font-weight:700;font-size:0.85rem;">' + friendship.emoji + ' ' + friendship.name + '</span></div>';
        }

        // Nacho Mode default
        var nachoModeDefault = localStorage.getItem('btc_nacho_mode_default') === 'true';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">' +
            '<div><span style="color:var(--text);font-size:0.85rem;">Default to Nacho Mode</span><div style="color:var(--text-faint);font-size:0.7rem;">Open Nacho Mode automatically on site load</div></div>' +
            '<button onclick="var on=localStorage.getItem(\'btc_nacho_mode_default\')===\'true\';localStorage.setItem(\'btc_nacho_mode_default\',on?\'false\':\'true\');showSettingsPage(\'prefs\')" style="padding:6px 16px;border:1px solid var(--border);border-radius:8px;background:' + (nachoModeDefault ? '#22c55e' : 'var(--bg-side)') + ';color:' + (nachoModeDefault ? '#fff' : 'var(--text-muted)') + ';font-size:0.8rem;cursor:pointer;font-family:inherit;font-weight:600;">' + (nachoModeDefault ? 'ON' : 'OFF') + '</button></div>';

        html += '</div>';

        // Haptic Feedback
        var hapticOn = localStorage.getItem('btc_haptic') !== 'false';
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">📳 Haptic Feedback</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<div><span style="color:var(--text);font-size:0.85rem;">Vibration on actions</span><div style="color:var(--text-faint);font-size:0.7rem;">Vibrate on XP, badges, and button taps</div></div>' +
            '<button onclick="localStorage.setItem(\'btc_haptic\',localStorage.getItem(\'btc_haptic\')===\'false\'?\'true\':\'false\');showSettingsPage(\'prefs\')" style="padding:6px 16px;border:1px solid var(--border);border-radius:8px;background:' + (hapticOn ? '#22c55e' : 'var(--bg-side)') + ';color:' + (hapticOn ? '#fff' : 'var(--text-muted)') + ';font-size:0.8rem;cursor:pointer;font-family:inherit;font-weight:600;">' + (hapticOn ? 'ON' : 'OFF') + '</button></div></div>';

        // Online Status
        var onlineStatusOn = localStorage.getItem('btc_online_status') !== 'false';
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🟢 Online Status</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<div><span style="color:var(--text);font-size:0.85rem;">Show online status</span><div style="color:var(--text-faint);font-size:0.7rem;">Other users can see when you\'re active</div></div>' +
            '<button onclick="localStorage.setItem(\'btc_online_status\',localStorage.getItem(\'btc_online_status\')===\'false\'?\'true\':\'false\');if(typeof toggleOnlineStatus===\'function\')toggleOnlineStatus();showSettingsPage(\'prefs\')" style="padding:6px 16px;border:1px solid var(--border);border-radius:8px;background:' + (onlineStatusOn ? '#22c55e' : 'var(--bg-side)') + ';color:' + (onlineStatusOn ? '#fff' : 'var(--text-muted)') + ';font-size:0.8rem;cursor:pointer;font-family:inherit;font-weight:600;">' + (onlineStatusOn ? 'ON' : 'OFF') + '</button></div></div>';

        // Push notification prefs are filled by notifications.js (server-backed).
        html += '<div id="settings-notifications"></div>';

        var pvpPushOn = localStorage.getItem('btc_pvp_push') === '1';
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">⚔️ PvP lobby push</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<div><span style="color:var(--text);font-size:0.85rem;">Lobby push</span><div style="color:var(--text-faint);font-size:0.7rem;">Off unless you turn this on. When on, at most 3 a week.</div></div>' +
            '<button onclick="localStorage.setItem(\'btc_pvp_push\',localStorage.getItem(\'btc_pvp_push\')===\'1\'?\'0\':\'1\');if(window._pvpSyncPushOptIn)window._pvpSyncPushOptIn(localStorage.getItem(\'btc_pvp_push\')===\'1\');showSettingsPage(\'prefs\')" style="padding:6px 16px;border:1px solid var(--border);border-radius:8px;background:' + (pvpPushOn ? '#22c55e' : 'var(--bg-side)') + ';color:' + (pvpPushOn ? '#fff' : 'var(--text-muted)') + ';font-size:0.8rem;cursor:pointer;font-family:inherit;font-weight:600;">' + (pvpPushOn ? 'ON' : 'OFF') + '</button></div></div>';
        var pvpAlertsMuted = localStorage.getItem('btc_pvp_alerts_muted') === '1';
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">⚔️ PvP alerts</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<div><span style="color:var(--text);font-size:0.85rem;">Mute PvP alerts</span><div style="color:var(--text-faint);font-size:0.7rem;">Hide the in-app lobby popup when someone is waiting</div></div>' +
            '<button onclick="localStorage.setItem(\'btc_pvp_alerts_muted\',localStorage.getItem(\'btc_pvp_alerts_muted\')===\'1\'?\'0\':\'1\');if(window._pvpSyncAlertMute)window._pvpSyncAlertMute(localStorage.getItem(\'btc_pvp_alerts_muted\')===\'1\');showSettingsPage(\'prefs\')" style="padding:6px 16px;border:1px solid var(--border);border-radius:8px;background:' + (pvpAlertsMuted ? '#22c55e' : 'var(--bg-side)') + ';color:' + (pvpAlertsMuted ? '#fff' : 'var(--text-muted)') + ';font-size:0.8rem;cursor:pointer;font-family:inherit;font-weight:600;">' + (pvpAlertsMuted ? 'ON' : 'OFF') + '</button></div></div>';

        // Signal Ticker
        var _tickerPref = localStorage.getItem('btc_ticker_enabled'); const tickerOn = _tickerPref === null ? (typeof isMobile === 'function' ? !isMobile() : window.innerWidth > 900) : _tickerPref === 'true';
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">📡 Signal Ticker</div>' +
            '<div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:10px;">Live Bitcoin price, block height, and curated news headlines scrolling at the top of the screen.</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<span style="color:var(--text);font-size:0.85rem;">Show Ticker</span>' +
            '<button onclick="if(typeof toggleTickerSetting===\'function\')toggleTickerSetting();else{localStorage.setItem(\'btc_ticker_enabled\',localStorage.getItem(\'btc_ticker_enabled\')===\'true\'?\'false\':\'true\');showSettingsPage(\'prefs\');}" style="padding:6px 16px;border:1px solid var(--border);border-radius:8px;background:' + (tickerOn ? '#22c55e' : 'var(--bg-side)') + ';color:' + (tickerOn ? '#fff' : 'var(--text-muted)') + ';font-size:0.8rem;cursor:pointer;font-family:inherit;font-weight:600;">' + (tickerOn ? 'ON' : 'OFF') + '</button></div>' +
            '</div>';

        // Timechain TV Settings
        const tctvAuto = localStorage.getItem('btc_tctv_autoplay') !== 'false';
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">📺 Timechain TV</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
            '<div><span style="color:var(--text);font-size:0.85rem;">Autoplay Videos</span><div style="color:var(--text-faint);font-size:0.7rem;">Start video playback immediately on tune-in</div></div>' +
            '<button onclick="localStorage.setItem(\'btc_tctv_autoplay\',localStorage.getItem(\'btc_tctv_autoplay\')===\'false\'?\'true\':\'false\');showSettingsPage(\'prefs\')" style="padding:6px 16px;border:1px solid var(--border);border-radius:8px;background:' + (tctvAuto ? '#22c55e' : 'var(--bg-side)') + ';color:' + (tctvAuto ? '#fff' : 'var(--text-muted)') + ';font-size:0.8rem;cursor:pointer;font-family:inherit;font-weight:600;">' + (tctvAuto ? 'ON' : 'OFF') + '</button></div>';

        const tctvRemotePersistent = localStorage.getItem('btc_tctv_remote_open') === 'true';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<div><span style="color:var(--text);font-size:0.85rem;">Persistent Remote</span><div style="color:var(--text-faint);font-size:0.7rem;">Keep the TV remote open by default</div></div>' +
            '<button onclick="localStorage.setItem(\'btc_tctv_remote_open\',localStorage.getItem(\'btc_tctv_remote_open\')===\'true\'?\'false\':\'true\');showSettingsPage(\'prefs\')" style="padding:6px 16px;border:1px solid var(--border);border-radius:8px;background:' + (tctvRemotePersistent ? '#22c55e' : 'var(--bg-side)') + ';color:' + (tctvRemotePersistent ? '#fff' : 'var(--text-muted)') + ';font-size:0.8rem;cursor:pointer;font-family:inherit;font-weight:600;">' + (tctvRemotePersistent ? 'ON' : 'OFF') + '</button></div>' +
            '</div>';

        // Keyboard Shortcuts (collapsible - takes lots of space)
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div onclick="window._expanded_shortcuts=!window._expanded_shortcuts;showSettingsPage(\'prefs\')" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;-webkit-tap-highlight-color:rgba(247,147,26,0.2);">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">⌨️ Keyboard Shortcuts & Gestures</div>' +
            '<span style="color:var(--text-faint);font-size:1rem;">' + (window._expanded_shortcuts ? '▾' : '▸') + '</span></div>';
        if (window._expanded_shortcuts) {
        html += '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">' +
            '<div style="color:var(--text-muted);font-size:0.8rem;line-height:1.8;">' +
            '<div style="font-size:0.7rem;color:var(--accent);font-weight:700;margin-bottom:4px;">Navigation</div>' +
            '<div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin-bottom:10px;">' +
            shortcutRow('H','Home') + shortcutRow('/','Search') + shortcutRow('B','Last topic') +
            shortcutRow('C','Random topic') + shortcutRow('M','Random meme') + shortcutRow('R','Random art') +
            shortcutRow('G','Random graphic') + shortcutRow('T','PlebTalk') + shortcutRow('S','Lightning Mart') +
            shortcutRow('J / K','Scroll ↓↑') + shortcutRow('Space','Page down') +
            '</div>' +
            '<div style="font-size:0.7rem;color:var(--accent);font-weight:700;margin-bottom:4px;">Features</div>' +
            '<div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin-bottom:10px;">' +
            shortcutRow('N','Nacho Mode') + shortcutRow('X','PVP Mode') + shortcutRow('A','Ask Nacho') +
            shortcutRow('Q','Start quest') + shortcutRow('L','Leaderboard') + shortcutRow('V','Gallery view') +
            '</div>' +
            '<div style="font-size:0.7rem;color:var(--accent);font-weight:700;margin-bottom:4px;">Actions</div>' +
            '<div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;">' +
            shortcutRow('F','Save to favorites') + shortcutRow('D','Dark / Light mode') +
            shortcutRow('P','Donate') + shortcutRow('I','Settings') +
            shortcutRow('?','Show shortcuts') + shortcutRow('Esc','Close modals') +
            '</div>' +
            '<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border);">' +
            '<div style="color:var(--accent);font-weight:700;font-size:0.8rem;margin-bottom:8px;">📱 Mobile Gestures</div>' +
            '<div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;">' +
            shortcutRow('Swipe →','Previous channel') +
            shortcutRow('Swipe ←','Next channel') +
            shortcutRow('2-finger tap','Nacho Mode') +
            shortcutRow('3-finger tap','Settings') +
            shortcutRow('Long-press logo','Explore Apps') +
            '</div></div>' +
            '</div></div>';
        } // end expanded_shortcuts

        // (Theme moved above)
        html += '</div>'; // close advPrefsPanel

    } else if (settingsTab === 'security') {
        // Basic security info
        html += '<div style="text-align:center;margin-bottom:20px;">' +
            '<div style="font-size:2.5rem;margin-bottom:8px;">🔒</div>' +
            '<div style="color:var(--heading);font-weight:800;font-size:1.2rem;">Security</div>' +
            '<div style="color:var(--text-muted);font-size:0.8rem;">Protect your account</div></div>';

        // Email, 2FA, Linked Accounts shown by default

        // Email verification status
        const emailVerified = user.emailVerified;
        const hasEmail = user.email || (user.providerData && user.providerData.some(function(p) { return p.providerId === 'password'; }));

        if (hasEmail) {
            html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
                '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Email Verification</div>';
            if (emailVerified) {
                html += '<div style="display:flex;align-items:center;gap:10px;"><span style="color:#22c55e;font-size:1.2rem;">✅</span><div><div style="color:var(--heading);font-weight:600;font-size:0.9rem;">Email verified</div><div style="color:var(--text-muted);font-size:0.8rem;">' + user.email + '</div></div></div>';
            } else {
                html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;"><span style="color:#f59e0b;font-size:1.2rem;">⚠️</span><div><div style="color:var(--heading);font-weight:600;font-size:0.9rem;">Email not verified</div><div style="color:var(--text-muted);font-size:0.8rem;">Required for 2FA. Check your inbox or resend below.</div></div></div>' +
                    '<button onclick="sendEmailVerification()" style="width:100%;padding:10px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit;">📧 Send Verification Email</button>';
            }
            html += '</div>';
        }

        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Two-Factor Authentication</div>';

        // Check if phone MFA is enrolled
        const enrolled = user.multiFactor && user.multiFactor.enrolledFactors && user.multiFactor.enrolledFactors.length > 0;
        if (enrolled) {
            html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;"><span style="color:#22c55e;font-size:1.2rem;">✅</span><div><div style="color:var(--heading);font-weight:600;font-size:0.9rem;">2FA is enabled</div><div style="color:var(--text-muted);font-size:0.8rem;">Your account is protected with phone verification</div></div></div>' +
                '<button onclick="disable2FA()" style="width:100%;padding:10px;background:none;border:1px solid #ef4444;border-radius:8px;color:#ef4444;font-size:0.85rem;cursor:pointer;font-family:inherit;">Disable 2FA</button>';
        } else if (!hasEmail) {
            html += '<div style="display:flex;align-items:center;gap:10px;"><span style="color:var(--text-faint);font-size:1.2rem;">🔒</span><div><div style="color:var(--heading);font-weight:600;font-size:0.9rem;">2FA available with email sign-in</div><div style="color:var(--text-muted);font-size:0.8rem;">Link an email from the Sign-in methods card on the Account tab, then you can enable 2FA.</div><button type="button" onclick="goToSignInMethods()" style="margin-top:8px;padding:8px 12px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--accent);font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;">Open Sign-in methods</button></div></div>';
        } else if (!emailVerified) {
            html += '<div style="display:flex;align-items:center;gap:10px;"><span style="color:#f59e0b;font-size:1.2rem;">⚠️</span><div><div style="color:var(--heading);font-weight:600;font-size:0.9rem;">Verify your email first</div><div style="color:var(--text-muted);font-size:0.8rem;">You must verify your email address before you can enable 2FA.</div></div></div>';
        } else {
            // On Safari, reCAPTCHA iframe required for phone auth is blocked by ITP — surface TOTP instead
            var _isSafariCtx = /^((?!chrome|android).)*safari/i.test(navigator.userAgent || '');
            if (_isSafariCtx) {
                html += '<div style="display:flex;align-items:flex-start;gap:10px;padding:12px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);border-radius:10px;">' +
                    '<span style="font-size:1.2rem;flex-shrink:0;">⚠️</span>' +
                    '<div><div style="color:var(--heading);font-weight:600;font-size:0.9rem;margin-bottom:4px;">SMS 2FA not supported on Safari</div>' +
                    '<div style="color:var(--text-muted);font-size:0.8rem;line-height:1.5;">Safari blocks the verification step required for SMS codes. Use an <strong>authenticator app</strong> instead \u2014 it\'s faster, more secure, and works everywhere. Set it up in the Authenticator App section below.</div></div></div>';
            } else {
                html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;"><span style="color:var(--text-faint);font-size:1.2rem;">🔓</span><div><div style="color:var(--heading);font-weight:600;font-size:0.9rem;">2FA is not enabled</div><div style="color:var(--text-muted);font-size:0.8rem;">Add phone verification for extra security</div></div></div>' +
                    '<div id="mfaSetup">' +
                    '<input type="tel" id="mfaPhone" placeholder="Your phone number" style="width:100%;padding:10px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.9rem;font-family:inherit;outline:none;margin-bottom:8px;">' +
                    '<div style="color:var(--text-faint);font-size:0.75rem;margin-bottom:8px;">US numbers auto-format. International: include country code (e.g. +44...)</div>' +
                    '<button onclick="startMFAEnroll()" style="width:100%;padding:10px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit;">Send Verification Code</button>' +
                    '<div id="mfaVerify" style="display:none;margin-top:8px;"><input type="text" id="mfaCode" placeholder="Enter 6-digit code" maxlength="6" style="width:100%;padding:10px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.9rem;font-family:inherit;outline:none;text-align:center;margin-bottom:8px;">' +
                    '<button onclick="verifyMFACode()" style="width:100%;padding:10px;background:#22c55e;color:#fff;border:none;border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit;">Verify & Enable 2FA</button></div>' +
                    '<div id="mfaStatus" style="margin-top:6px;font-size:0.8rem;"></div></div>';
            }
        }
        html += '</div>';

        // Authenticator App (TOTP)
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Authenticator App</div>' +
            '<div id="totpSection"><div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:10px;">Loading...</div></div></div>';

        // Load TOTP status after render
        setTimeout(loadTotpStatus, 100);

        // Session info
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Session</div>' +
            '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);"><span style="color:var(--text-muted);font-size:0.85rem;">Last sign-in</span><span style="color:var(--text);font-size:0.85rem;">' + (user.metadata && user.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleString() : 'Unknown') + '</span></div>' +
            '<div style="display:flex;justify-content:space-between;padding:8px 0;"><span style="color:var(--text-muted);font-size:0.85rem;">Session timeout</span><span style="color:var(--text);font-size:0.85rem;">30 minutes inactive</span></div>' +
            '</div>';

        // Password change (only for email/password users)
        if (user.providerData && user.providerData.some(p => p.providerId === 'password')) {
            html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
                '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Change Password</div>' +
                '<button onclick="sendPasswordReset()" style="width:100%;padding:10px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.85rem;cursor:pointer;font-family:inherit;">Send Password Reset Email</button>' +
                '<div id="pwResetStatus" style="margin-top:6px;font-size:0.8rem;"></div></div>';
        }

        // Advanced Security (Blocked Users + Danger Zone)
        html += '<button onclick="var p=document.getElementById(\'advSecPanel\');p.style.display=p.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'span\').textContent=p.style.display===\'none\'?\'▼\':\'▲\'" style="width:100%;padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:12px;display:flex;align-items:center;justify-content:center;gap:6px;">⚙️ Advanced Security <span>▼</span></button>';
        html += '<div id="advSecPanel" style="display:none;">';

        // Blocked Users — load from Firestore for cross-device accuracy
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🚫 Blocked Users</div>' +
            '<div id="blockedUsersList"><div style="color:var(--text-faint);font-size:0.8rem;">Loading...</div></div>' +
            '</div>';

        // Load blocked list from Firestore (source of truth, cross-device)
        setTimeout(function() {
            var container = document.getElementById('blockedUsersList');
            if (!container || !auth || !auth.currentUser || !db) return;
            db.collection('users').doc(auth.currentUser.uid).get().then(function(userDoc) {
                var fsBlocked = (userDoc.exists && userDoc.data().blockedUsers) ? userDoc.data().blockedUsers : [];
                var localBlocked = typeof getBlockedUsers === 'function' ? getBlockedUsers() : [];
                var merged = Array.from(new Set(fsBlocked.concat(localBlocked)));
                if (merged.length === 0) {
                    container.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;">No blocked users. 🎉</div>';
                    return;
                }
                container.innerHTML = '<div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:10px;">' + merged.length + ' blocked user' + (merged.length > 1 ? 's' : '') + '</div><div id="blockedUsersRows"></div>';
                var rowsEl = document.getElementById('blockedUsersRows');
                var loaded = 0;
                var listHtml = '';
                merged.forEach(function(uid) {
                    db.collection('users').doc(uid).get().then(function(doc) {
                        var name = doc.exists ? (doc.data().username || 'Unknown') : 'Deleted User';
                        var safeName = name.replace(/[\'"]/g, '');
                        listHtml += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;' + (loaded > 0 ? 'border-top:1px solid var(--border);' : '') + '">' +
                            '<span style="color:var(--text);font-size:0.85rem;">' + (typeof escapeHtml === 'function' ? escapeHtml(name) : name) + '</span>' +
                            '<button onclick="if(typeof unblockUser===\'function\'){unblockUser(\'' + uid + '\',\'' + safeName + '\')};setTimeout(function(){showSettingsPage(\'security\')},300)" style="padding:5px 12px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:0.75rem;cursor:pointer;font-family:inherit;">✅ Unblock</button></div>';
                        loaded++;
                        if (loaded === merged.length && rowsEl) rowsEl.innerHTML = listHtml;
                    }).catch(function() {
                        listHtml += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-top:1px solid var(--border);">' +
                            '<span style="color:var(--text-faint);font-size:0.85rem;">Unknown User</span>' +
                            '<button onclick="if(typeof unblockUser===\'function\'){unblockUser(\'' + uid + '\')};setTimeout(function(){showSettingsPage(\'security\')},300)" style="padding:5px 12px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:0.75rem;cursor:pointer;font-family:inherit;">✅ Unblock</button></div>';
                        loaded++;
                        if (loaded === merged.length && rowsEl) rowsEl.innerHTML = listHtml;
                    });
                });
            }).catch(function() {
                var container = document.getElementById('blockedUsersList');
                if (container) container.innerHTML = '<div style="color:var(--text-faint);font-size:0.8rem;">Could not load blocked list.</div>';
            });
        }, 100);

        // Delete Account - Danger Zone
        if (!user.isAnonymous) {
            html += '<div style="background:rgba(239,68,68,0.05);border:2px solid rgba(239,68,68,0.3);border-radius:12px;padding:16px;margin-top:24px;">' +
                '<div style="font-size:0.75rem;color:#ef4444;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-weight:800;">⚠️ Danger Zone</div>' +
                '<div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:12px;line-height:1.5;">Account deletion is on the Account tab. You confirm your username there. Sats still on the account are forfeited.</div>' +
                '<button onclick="showSettingsPage(\'account\')" style="width:100%;padding:12px;background:none;border:2px solid #ef4444;border-radius:10px;color:#ef4444;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;" onmouseover="this.style.background=\'rgba(239,68,68,0.1)\'" onmouseout="this.style.background=\'none\'">Delete account</button>' +
                '</div>';
        }
        html += '</div>'; // close advSecPanel

    } else if (settingsTab === 'data') {
        // Refresh data from Firebase - cache for 2 minutes
        var now = Date.now();
        if (typeof auth !== 'undefined' && auth && auth.currentUser && typeof db !== 'undefined' &&
            (!window._statsCache || now - window._statsCacheTime > 120000)) {
            db.collection('users').doc(auth.currentUser.uid).get().then(function(doc) {
                if (doc.exists && currentUser) {
                    const fresh = doc.data();
                    currentUser.points = fresh.points || 0;
                    currentUser.streak = fresh.streak || 0;
                    currentUser.totalVisits = fresh.totalVisits || 0;
                    currentUser.channelsVisited = fresh.channelsVisited || 0;
                    window._statsCache = true;
                    window._statsCacheTime = Date.now();
                    // Re-render if data changed
                    const ptsEl = document.getElementById('statPts');
                    if (ptsEl && ptsEl.textContent !== (fresh.points || 0).toLocaleString()) {
                        showSettingsPage('data');
                    }
                }
            }).catch(function() {});
        }
        const pts = currentUser ? (currentUser.points || 0) : 0;
        const chVisited = currentUser ? (currentUser.channelsVisited || 0) : 0;
        const totalVisits = currentUser ? (currentUser.totalVisits || 0) : 0;
        const streak = currentUser ? (currentUser.streak || 0) : 0;
        const localVisited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]').length;
        const localFavs = JSON.parse(localStorage.getItem('btc_favs') || '[]').length;
        const hiddenBadges = JSON.parse(localStorage.getItem('btc_hidden_badges') || '[]').length;

        html += '<div style="text-align:center;margin-bottom:16px;">' +
            '<div style="font-size:2rem;margin-bottom:4px;">' + lvl.emoji + '</div>' +
            '<div style="color:var(--heading);font-weight:700;font-size:1.3rem;">' + pts.toLocaleString() + ' XP</div>' +
            '<div style="color:var(--text-muted);font-size:0.85rem;">' + lvl.name + '</div></div>';

        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Your Stats</div>';

        function statRow(label, value, icon) {
            return '<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);"><span style="color:var(--text-muted);font-size:0.85rem;">' + icon + ' ' + label + '</span><span style="color:var(--text);font-weight:600;font-size:0.85rem;">' + value + '</span></div>';
        }

        html += '<div id="statPts" style="display:none;">' + pts.toLocaleString() + '</div>';
        html += statRow('Total Points', pts.toLocaleString(), '⭐');
        var freezeCount = currentUser ? (currentUser.streakFreezes || 0) : parseInt(localStorage.getItem('btc_streak_freezes') || '0');
        var bestStreak = currentUser ? (currentUser.bestStreak || streak) : streak;
        if (bestStreak < streak) bestStreak = streak; // safety
        html += statRow('Current Streak', streak + (bestStreak > 0 ? ' (' + bestStreak + ')' : '') + ' days', '🔥');
        html += statRow('🧊 Streak Freezes', freezeCount + ' available', '🧊');
        // Buy Streak Freezes section
        var _tcktCount = currentUser ? (currentUser.orangeTickets || 0) : 0;
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:14px;">';
        html += '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🧊 Buy Streak Freezes</div>';
        html += '<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:10px;">Protect your streak - freezes auto-activate when you miss a day. You have <strong>' + _tcktCount + ' 🏟️ Orange Tickets</strong>.</div>';
        html += '<div style="display:flex;gap:8px;flex-wrap:wrap;">';
        html += '<button onclick="_buyStreakFreeze(1)" style="flex:1;min-width:120px;padding:10px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.4);border-radius:10px;color:var(--accent);font-weight:700;font-size:0.8rem;cursor:pointer;font-family:inherit;">Buy 1 Freeze<br><span style="font-size:0.7rem;font-weight:400;">5 🏟️ tickets</span></button>';
        html += '<button onclick="_buyStreakFreeze(3)" style="flex:1;min-width:120px;padding:10px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.4);border-radius:10px;color:var(--accent);font-weight:700;font-size:0.8rem;cursor:pointer;font-family:inherit;">Buy 3 Freezes<br><span style="font-size:0.7rem;font-weight:400;">12 🏟️ tickets</span></button>';
        html += '</div></div>';
        html += statRow('Total Site Visits', totalVisits, '👁️');
        html += statRow('Topics Explored', Math.max(chVisited, localVisited) + ' / ' + Object.keys(CHANNELS).length, '🗺️');
        html += statRow('Saved Favorites', localFavs, '⭐');
        html += statRow('Hidden Badges Found', hiddenBadges + ' / ' + (typeof HIDDEN_BADGES !== 'undefined' ? HIDDEN_BADGES.length : 8), '🏅');
        html += statRow('Scholar Certified', localStorage.getItem('btc_scholar_passed') === 'true' ? '✅ Yes' : '❌ Not yet', '🎓');
        html += statRow('Orange Tickets', (currentUser ? currentUser.orangeTickets || 0 : 0), '<svg viewBox="0 0 24 24" style="width:1em;height:1em;vertical-align:-0.15em;display:inline-block"><path fill="#f7931a" d="M22 10V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v4c1.1 0 2 .9 2 2s-.9 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2z"/></svg>');
        // PVP Stats
        var _pvpW = currentUser ? (currentUser.pvpWins || 0) : 0;
        var _pvpL = currentUser ? (currentUser.pvpLosses || 0) : 0;
        var _pvpT = _pvpW + _pvpL;
        var _pvpPct = _pvpT > 0 ? Math.round((_pvpW / _pvpT) * 100) : 0;
        if (_pvpT > 0) {
            html += statRow('PVP Record', _pvpW + 'W - ' + _pvpL + 'L', '⚔️');
            html += statRow('PVP Win Rate', _pvpPct + '%', '📊');
        } else {
            html += statRow('PVP Record', 'No battles yet - <a href="#" onclick="event.preventDefault();hideUsernamePrompt();enterPVPMode();" style="color:var(--accent);">Enter PVP Lobby</a>', '⚔️');
        }
        // Prediction stats come from prediction_stats/{uid}, not users['predictions.total'].
        html += '<div id="settingsPredStats"></div>';
        fillSettingsPred = function() {
            var paint = function(stats) {
                var node = document.getElementById('settingsPredStats');
                if (!node) return;
                var total = stats ? (Number(stats.predTotal) || 0) : 0;
                var correct = stats ? (Number(stats.predCorrect) || 0) : 0;
                var best = stats ? (Number(stats.predBestStreak) || 0) : 0;
                if (!total) {
                    node.innerHTML = statRow('Predictions', '<a href="#" onclick="event.preventDefault();hideUsernamePrompt();showPricePrediction();" style="color:var(--accent);">Make your first prediction →</a>', '📈');
                    return;
                }
                var pct = Math.round((correct / total) * 100);
                var rows = statRow('Predictions', total + ' total · ' + correct + ' correct', '📈');
                rows += statRow('Prediction Accuracy', pct + '%', '🎯');
                if (best > 0) rows += statRow('Best Prediction Streak', best + ' in a row', '🔥');
                node.innerHTML = rows;
            };
            if (typeof window._loadMyPredictionStats === 'function') window._loadMyPredictionStats(paint);
            else paint(null);
        };
        // ---- Enhanced Stats ----
        // Time on site (approximate from session starts)
        var _totalSessions = currentUser ? (currentUser.totalVisits || 0) : 0;
        var _estMinutes = _totalSessions * 8; // estimate 8 min avg session
        var _timeStr = _estMinutes >= 60 ? Math.floor(_estMinutes / 60) + 'h ' + (_estMinutes % 60) + 'm' : _estMinutes + ' min';
        html += statRow('Est. Time Learning', _timeStr, '⏱️');

        // Chat messages
        var _chatMsgs = parseInt(localStorage.getItem('btc_chat_msgs') || '0');
        if (_chatMsgs > 0) html += statRow('Chat Messages Sent', _chatMsgs, '💬');

        // DMs sent
        var _dmsSent = parseInt(localStorage.getItem('btc_dms_sent') || '0');
        if (_dmsSent > 0) html += statRow('DMs Sent', _dmsSent, '✉️');

        // Tips given/received
        var _tipsSent = parseInt(localStorage.getItem('btc_tips_sent') || '0');
        var _tipsReceived = parseInt(localStorage.getItem('btc_tips_received') || '0');
        var _tipsSatsSent = parseInt(localStorage.getItem('btc_tips_total_sats') || '0');
        if (_tipsSent > 0 || _tipsReceived > 0) {
            html += statRow('Tips Given', _tipsSent + (_tipsSatsSent > 0 ? ' (' + _tipsSatsSent.toLocaleString() + ' sats)' : ''), '⚡');
            html += statRow('Tips Received', _tipsReceived, '🙏');
        }

        // Spin wheel stats
        var _spinCount = parseInt(localStorage.getItem('btc_spin_count') || '0');
        if (_spinCount > 0) html += statRow('Daily Spins', _spinCount + ' total', '🎡');

        // TCTV watch time
        var _tctvMinutes = parseInt(localStorage.getItem('btc_tctv_watch_time') || '0');
        if (_tctvMinutes > 0) {
            var _tctvStr = _tctvMinutes >= 60 ? Math.floor(_tctvMinutes / 60) + 'h ' + (_tctvMinutes % 60) + 'm' : _tctvMinutes + ' min';
            html += statRow('Timechain TV Watched', _tctvStr, '📺');
        }

        // Beats interactions
        var _beatsUploads = parseInt(localStorage.getItem('btc_beats_uploads') || '0');
        if (_beatsUploads > 0) html += statRow('Songs Uploaded', _beatsUploads, '🎵');

        // DJ stats
        var _djSets = parseInt(localStorage.getItem('btc_dj_sets') || '0');
        if (_djSets > 0) html += statRow('DJ Sets', _djSets, '🎧');

        // Referrals
        var _referralCount = currentUser ? (currentUser.referralCount || 0) : 0;
        if (_referralCount > 0) html += statRow('Friends Referred', _referralCount, '🔗');

        // Badges earned count
        var _badgeCount = typeof earnedBadges !== 'undefined' ? earnedBadges.size || 0 : JSON.parse(localStorage.getItem('btc_badges') || '[]').length;
        // BADGE_DEFS = 190 static badges. Dynamic per-action FLEX badges: 20 actions × 8 milestones = 160.
        var _totalBadges = (typeof BADGE_DEFS !== 'undefined' ? BADGE_DEFS.length : 190) +
            (typeof FLEX_ACTIONS !== 'undefined' && typeof FLEX_BADGE_MILESTONES !== 'undefined' ? FLEX_ACTIONS.length * FLEX_BADGE_MILESTONES.length : 160);
        html += statRow('Badges Earned', _badgeCount + ' / ' + _totalBadges, '🏅');

        // Reading progress
        try {
            var _readProg = JSON.parse(localStorage.getItem('btc_channel_progress') || '{}');
            var _readComplete = Object.values(_readProg).filter(function(v) { return v >= 100; }).length;
            var _readStarted = Object.keys(_readProg).length;
            if (_readStarted > 0) html += statRow('Topics Read (100%)', _readComplete + ' complete, ' + _readStarted + ' started', '📖');
        } catch(e) {}

        if (typeof getNachoFriendship === 'function') {
            var f = getNachoFriendship();
            var interactions = parseInt(localStorage.getItem('btc_nacho_interactions') || '0');
            html += statRow('Nacho Friendship', f.emoji + ' ' + f.name + ' (' + interactions + ' interactions)', '🦌');
        }

        html += '</div>';

        // Cosmetics panel in Settings Data tab
        var _settCosmetics = (typeof currentUser !== 'undefined' && currentUser) ? (currentUser.ownedCosmetics || []) : [];
        if (_settCosmetics.length > 0) {
            html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">';
            html += '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">✨ Your Cosmetics</div>';
            if (_settCosmetics.indexOf('pinned_badge') !== -1) {
                var _pinnedId = (typeof currentUser !== 'undefined' && currentUser) ? (currentUser.pinnedBadgeId || '') : '';
                var _pinnedLabel = 'None selected';
                if (_pinnedId && typeof BADGE_DEFS !== 'undefined') {
                    for (var _sbi = 0; _sbi < BADGE_DEFS.length; _sbi++) {
                        if (BADGE_DEFS[_sbi].id === _pinnedId) { _pinnedLabel = BADGE_DEFS[_sbi].emoji + ' ' + escapeHtml(BADGE_DEFS[_sbi].name); break; }
                    }
                }
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);"><span style="color:var(--text-muted);font-size:0.85rem;">📌 Pinned Badge: <strong style="color:var(--text);">' + _pinnedLabel + '</strong></span>' +
                    '<button onclick="if(typeof window._showPinnedBadgeSelector===\'function\')window._showPinnedBadgeSelector()" style="padding:5px 12px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.3);border-radius:8px;font-size:0.75rem;color:#f7931a;font-weight:700;cursor:pointer;font-family:inherit;">Change →</button></div>';
            }
            if (_settCosmetics.indexOf('chat_flair') !== -1) {
                var _flairEmoji = (typeof currentUser !== 'undefined' && currentUser && currentUser.chatFlairEmoji) ? currentUser.chatFlairEmoji : '🔥';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);"><span style="color:var(--text-muted);font-size:0.85rem;">🔥 Chat Flair: <strong style="color:var(--text);">' + _flairEmoji + '</strong></span>' +
                    '<button onclick="if(typeof window._showChatFlairPicker===\'function\')window._showChatFlairPicker()" style="padding:5px 12px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.3);border-radius:8px;font-size:0.75rem;color:#f7931a;font-weight:700;cursor:pointer;font-family:inherit;">Change →</button></div>';
            }
            if (_settCosmetics.indexOf('profile_frame') !== -1) {
                html += '<div style="padding:10px 0;border-bottom:1px solid var(--border);color:var(--text-muted);font-size:0.85rem;">🧓 Profile Frame: <strong style="color:#f7931a;">Active - orange glow on your rank card</strong></div>';
            }
            if (_settCosmetics.indexOf('nacho_skin_nook') !== -1) {
                html += '<div style="padding:10px 0;color:var(--text-muted);font-size:0.85rem;">🦌 Nacho Skin: <strong style="color:#f7931a;">Active - golden avatar in chat &amp; profile</strong></div>';
            }
            html += '</div>';
        }

        // Nacho Analytics (collapsible)
        if (typeof getNachoAnalytics === 'function') {
            var na = getNachoAnalytics();
            if (na.total > 0) {
                html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
                    '<div onclick="window._expanded_analytics=!window._expanded_analytics;showSettingsPage(\'data\')" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;-webkit-tap-highlight-color:rgba(247,147,26,0.2);">' +
                    '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">📊 ' + escapeHtml(nickname) + ' Q&A Analytics</div>' +
                    '<span style="color:var(--text-faint);font-size:1rem;">' + (window._expanded_analytics ? '▾' : '▸') + '</span></div>';
                if (!window._expanded_analytics) {
                    html += '</div>';
                } else {
                html += '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">';

                // Satisfaction
                if (na.satisfaction !== null) {
                    var satColor = na.satisfaction >= 80 ? '#22c55e' : (na.satisfaction >= 50 ? '#f7931a' : '#ef4444');
                    html += statRow('Answer Satisfaction', '<span style="color:' + satColor + ';">' + na.satisfaction + '%</span> (' + na.upvotes + '👍 / ' + na.downvotes + '👎)', '📊');
                }

                html += statRow('Total Questions', na.total, '💬');
                html += statRow('Missed/Fallback', na.missCount, '❓');

                // Answer sources
                if (na.sources && Object.keys(na.sources).length > 0) {
                    var srcLabels = { kb: 'Knowledge Base', ai: 'AI (Llama)', offtopic: 'Off-topic', fallback: 'Fallback', safety: 'Safety', unknown: 'Other' };
                    var srcHtml = '';
                    for (var src in na.sources) {
                        srcHtml += '<span style="display:inline-block;padding:3px 8px;margin:2px;background:var(--bg-side);border:1px solid var(--border);border-radius:6px;font-size:0.75rem;color:var(--text-muted);">' + (srcLabels[src] || src) + ': ' + na.sources[src] + '</span>';
                    }
                    html += '<div style="padding:8px 0;border-bottom:1px solid var(--border);"><div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:4px;">📡 Answer Sources</div>' + srcHtml + '</div>';
                }

                // Top topics
                var topicEntries = Object.entries(na.topics).sort(function(a,b) { return b[1] - a[1]; }).slice(0, 8);
                if (topicEntries.length > 0) {
                    var topicEmojis = { lightning:'⚡', mining:'⛏️', wallets:'💼', basics:'📘', security:'🔒', privacy:'🕵️', economics:'📈', altcoins:'🪙', technical:'⚙️', history:'📜', price:'💰', layer2:'🔗', culture:'🎭', regulation:'⚖️', onboarding:'🚀', other:'❓' };
                    var topHtml = '';
                    for (var ti = 0; ti < topicEntries.length; ti++) {
                        var tn = topicEntries[ti][0];
                        var tc = topicEntries[ti][1];
                        topHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;"><span style="color:var(--text-muted);font-size:0.8rem;">' + (topicEmojis[tn] || '❓') + ' ' + tn.charAt(0).toUpperCase() + tn.slice(1) + '</span><span style="color:var(--text);font-weight:600;font-size:0.8rem;">' + tc + '</span></div>';
                    }
                    html += '<div style="padding:8px 0;"><div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:4px;">🔥 Top Topics</div>' + topHtml + '</div>';
                }

                html += '</div></div>';
                }
            }
        }

        // Nacho Nickname (first - let user name their Nacho)
        var nickname = localStorage.getItem('btc_nacho_nickname') || 'Nacho';
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🏷️ Name Your Buck</div>' +
            '<div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:10px;">Currently: <strong style="color:var(--accent);">' + escapeHtml(nickname) + '</strong></div>' +
            '<div>' +
            '<input type="text" id="nachoNicknameInput" value="' + escapeHtml(nickname) + '" maxlength="20" placeholder="Type a new name..." style="width:100%;padding:12px 14px;background:rgba(30,41,59,1);border:2px solid #475569;border-radius:10px;color:#f8fafc;font-size:1rem;font-family:inherit;outline:none;box-sizing:border-box;-webkit-appearance:none;margin-bottom:8px;" onfocus="this.style.borderColor=\'#f7931a\';this.select()" onblur="this.style.borderColor=\'var(--border)\'">' +
            '<button onclick="var n=document.getElementById(\'nachoNicknameInput\').value.trim();if(n)setNachoNickname(n)" style="width:100%;padding:12px 20px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;">Save</button>' +
            '</div></div>';

        // Nacho Story (highlighted - right under name)
        if (typeof getNachoStoryProgress === 'function') {
            var storyProg = getNachoStoryProgress();
            var storyTotal = (typeof window.NACHO_STORY_TOTAL === 'number') ? window.NACHO_STORY_TOTAL : 7;
            var storyComplete = storyProg >= storyTotal;
            var storyNickname = escapeHtml(nickname);
            html += '<div style="background:linear-gradient(135deg,rgba(247,147,26,0.08),rgba(234,88,12,0.04));border:2px solid rgba(247,147,26,0.3);border-radius:12px;padding:16px;margin-bottom:16px;">' +
                '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
                    '<span style="font-size:1.4rem;">📖</span>' +
                    '<div><div style="font-size:0.9rem;font-weight:800;color:var(--heading);">' + storyNickname + '\'s Story</div>' +
                    '<div style="font-size:0.7rem;color:var(--text-faint);">' + (storyComplete ? '✅ Complete!' : 'A new chapter unlocks every day!') + '</div></div>' +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
                '<div style="flex:1;background:var(--bg-side);border-radius:8px;height:10px;overflow:hidden;"><div style="height:100%;background:linear-gradient(90deg,#f7931a,#ea580c);width:' + Math.round(storyProg / storyTotal * 100) + '%;border-radius:8px;transition:0.5s;"></div></div>' +
                '<span style="color:var(--accent);font-size:0.85rem;font-weight:700;">' + storyProg + '/' + storyTotal + '</span>' +
                '</div>' +
                '<button onclick="hideUsernamePrompt();setTimeout(function(){if(typeof showNachoStory===\'function\')showNachoStory()},300)" style="width:100%;padding:12px;background:linear-gradient(135deg,#f7931a,#ea580c);color:#fff;border:none;border-radius:10px;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 4px 15px rgba(247,147,26,0.3);">' + (storyComplete ? '📖 Re-read ' + storyNickname + '\'s Adventure' : '📖 Read Next Chapter →') + '</button>' +
                '</div>';
        }

        // Nacho's Closet (collapsible)
        if (typeof renderNachoClosetUI === 'function') {
            if (typeof window._expanded_closet === 'undefined') window._expanded_closet = false;
            if (window._pendingClosetScroll) window._expanded_closet = true;
            html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
                '<div onclick="window._expanded_closet=!window._expanded_closet;showSettingsPage(\'data\')" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;-webkit-tap-highlight-color:rgba(247,147,26,0.2);">' +
                '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">👗 ' + escapeHtml(nickname) + '\'s Closet</div>' +
                '<span style="color:var(--text-faint);font-size:1rem;">' + (window._expanded_closet ? '▾' : '▸') + '</span></div>';
            if (window._expanded_closet) {
                html += '<div id="nachoClosetContainer" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);"></div>';
            }
            html += '</div>';
        }

        // Sticker Book (collapsible)
        if (typeof renderStickerBook === 'function') {
            html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
                '<div onclick="window._expanded_stickers=!window._expanded_stickers;showSettingsPage(\'data\')" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;-webkit-tap-highlight-color:rgba(247,147,26,0.2);">' +
                '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">🎨 Sticker Book</div>' +
                '<span style="color:var(--text-faint);font-size:1rem;">' + (window._expanded_stickers ? '▾' : '▸') + '</span></div>';
            if (window._expanded_stickers) {
                html += '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">' + renderStickerBook() + '</div>';
            }
            html += '</div>';
        }

        // Privacy note
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🔒 Privacy</div>' +
            '<div style="color:var(--text);font-size:0.85rem;line-height:1.6;">' +
            '<strong style="color:#22c55e;">We do not sell, share, or monetize your data. Ever.</strong><br>' +
            'The only data we store is your username, points, and progress - just enough to power your experience. No tracking, no ads, no third-party analytics. Your data is yours.</div></div>';

        // Orange Tickets section (collapsible)
        html += '<button onclick="var p=document.getElementById(\'ticketsPanel\');p.style.display=p.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'span\').textContent=p.style.display===\'none\'?\'▼\':\'▲\'" style="width:100%;padding:12px;background:linear-gradient(135deg,rgba(247,147,26,0.08),rgba(234,88,12,0.04));border:2px solid rgba(247,147,26,0.2);border-radius:10px;color:var(--accent);font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:12px;display:flex;align-items:center;justify-content:center;gap:6px;"><span style="filter:hue-rotate(30deg) saturate(1.5);">🎫</span> Orange Tickets & Referrals <span>▼</span></button>';
        html += '<div id="ticketsPanel" style="display:none;">';
        if (!user || user.isAnonymous) {
            html += '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.85rem;">Sign in to start earning Orange Tickets!</div>';
        } else {
            html += typeof renderTicketsSection === 'function' ? renderTicketsSection() : '';
            html += typeof renderReferralSection === 'function' ? renderReferralSection() : '';
            html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
                '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">How to Earn Tickets</div>' +
                '<div style="color:var(--text-muted);font-size:0.8rem;line-height:1.8;">' +
                '<strong style="color:var(--text);">📅 Daily Login:</strong> +1 ticket just for visiting.<br>' +
                '<strong style="color:var(--text);">🎡 Spin the Wheel:</strong> Spin daily for bonus tickets!<br>' +
                '<strong style="color:var(--text);">👥 Referrals:</strong> Earn <strong style="color:var(--accent);">50 tickets</strong> per friend who signs up and reaches Maxi rank.<br>' +
                '<strong style="color:var(--text);">🏅 Badges:</strong> Unlock at 25 🐟, 50 🦈, and 100 🐋 tickets.<br>' +
                '<strong style="color:var(--text);">⭐ Bonus:</strong> Each ticket = +5 XP towards your rank.<br>' +
                '<strong style="color:#eab308;">🏆 Giveaways:</strong> More tickets = higher chance of winning sats!' +
                '</div></div>';
        }
        html += '</div>';

        // Advanced Stats section
        html += '<button onclick="var p=document.getElementById(\'advStatsPanel\');p.style.display=p.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'span\').textContent=p.style.display===\'none\'?\'▼\':\'▲\'" style="width:100%;padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:12px;display:flex;align-items:center;justify-content:center;gap:6px;">⚙️ Advanced Stats <span>▼</span></button>';
        html += '<div id="advStatsPanel" style="display:none;">';

        // Export data
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Your Data</div>' +
            '<button onclick="exportUserData()" style="width:100%;padding:10px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.85rem;cursor:pointer;font-family:inherit;margin-bottom:8px;">📥 Export My Data</button>' +
            '<button onclick="showDeleteAccountConfirm()" style="width:100%;padding:10px;background:none;border:1px solid #ef4444;border-radius:8px;color:#ef4444;font-size:0.85rem;cursor:pointer;font-family:inherit;">🗑️ Delete My Account</button>' +
            '</div>';
        html += '</div>'; // close advStatsPanel
    }

    html += '<span class="skip" onclick="hideUsernamePrompt()" style="color:var(--text-faint);font-size:0.85rem;margin-top:12px;cursor:pointer;display:block;text-align:center;">Close</span>';
    box.innerHTML = html;
    if (settingsTab === 'prefs') {
        var modePicker = document.getElementById('experienceModePicker');
        if (modePicker && typeof window.bqFillModePicker === 'function') {
            window.bqFillModePicker(modePicker, {
                onPick: function (id) { if (typeof window._changeExperienceMode === 'function') window._changeExperienceMode(id); }
            });
        }
    }
    if (typeof window._applyWhatsNew === 'function') window._applyWhatsNew();
    if (settingsTab === 'account') mountAccountGoogleLinkButton();
    var shownLn = (typeof currentUser !== 'undefined' && currentUser) ? (currentUser.lightningAddress || currentUser.lightning || currentUser.lnAddress || '') : '';
    var profileLn = document.getElementById('profileLnReadonly');
    var satsLn = document.getElementById('satsLnReadonly');
    if (profileLn) profileLn.textContent = shownLn;
    if (satsLn) satsLn.textContent = shownLn;
    modal.classList.add('open');
    if (settingsTab === 'prefs') {
        setTimeout(function() {
            var fill = function() {
                if (typeof window.renderNotificationSettings !== 'function') return;
                window.renderNotificationSettings();
                if (window._highlightNotifSettings) {
                    window._highlightNotifSettings = false;
                    var sec = document.getElementById('settings-notifications');
                    if (sec) {
                        sec.classList.add('notif-flash');
                        try { sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { sec.scrollIntoView(true); }
                    }
                }
            };
            if (typeof window.renderNotificationSettings === 'function') {
                fill();
                return;
            }
            var s = document.createElement('script');
            s.src = 'notifications.js?v=20261024_v2357';
            s.onload = fill;
            document.body.appendChild(s);
        }, 0);
    }
    if (fillSettingsPred) fillSettingsPred();

    // Auto-focus key inputs after render
    setTimeout(function() {
        if (settingsTab === 'account') {
            // Focus country input if empty (nudge to fill), else username field if visible
            var _cInp = document.getElementById('countryInput');
            var _uInp = document.getElementById('newUsername');
            if (_cInp && !_cInp.value) { _cInp.focus(); }
            else if (_uInp && document.activeElement !== _uInp) { /* don't steal focus from username, let user scroll to it */ }
        }
    }, 150);

    // Load sats history if on sats tab
    if (settingsTab === 'sats' && typeof loadSatsHistory === 'function') {
        setTimeout(loadSatsHistory, 100);
    }

    // Load gifts (now nested in Peers/Gifts under account tab)
    if (settingsTab === 'account') {
        setTimeout(function() {
            if (typeof window.renderGiftsSettingsTab === 'function') {
                window.renderGiftsSettingsTab();
            }
            if (window._isAdminClaim === true && typeof window.renderCipherWinsAdmin === 'function') {
                window.renderCipherWinsAdmin('cipherWinsAdmin');
            }
            if (window._isAdminClaim === true && typeof window.renderFaucetAbuseAdmin === 'function') {
                window.renderFaucetAbuseAdmin('faucetAbuseAdmin');
            }
            // Populate badge on the Peers/Gifts button (waiting gifts + keys held + ciphers)
            var _giftBadge = document.getElementById('peersGiftsBadge');
            if (_giftBadge && typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous && typeof db !== 'undefined') {
                var _uid = auth.currentUser.uid;
                Promise.all([
                    db.collection('gifts').where('ownerId','==',_uid).where('status','in',['unopened','inventory','sent']).limit(40).get(),
                    db.collection('keys').where('ownerId','==',_uid).where('status','in',['inventory','sent']).limit(50).get(),
                    db.collection('locked_ciphers').where('ownerId','==',_uid).where('status','==','inventory').limit(50).get(),
                ]).then(function(results) {
                    var el = document.getElementById('peersGiftsBadge');
                    if (!el) return;
                    var giftCount   = results[0].size;
                    var keyCount    = results[1].size;
                    var cipherCount = results[2].size;
                    var parts = [];
                    if (giftCount   > 0) parts.push('🎁 ' + giftCount);
                    if (keyCount    > 0) parts.push('🔑 ' + keyCount);
                    if (cipherCount > 0) parts.push('🔒 ' + cipherCount);
                    if (parts.length > 0) {
                        el.innerHTML = ' <span style="display:inline-block;background:rgba(247,147,26,0.15);border:1px solid rgba(247,147,26,0.35);border-radius:10px;padding:1px 7px;font-size:0.72rem;color:#f7931a;font-weight:800;">' + parts.join(' · ') + '</span>';
                    }
                }).catch(function(){});
            }
        }, 100);
    }

    // Wire up charity donate helpers for the Sats > Donate sub-tab
    if (settingsTab === 'sats') {
        // Populate recent donations list if we're on the donate sub-tab
        if ((window._satsSubTab || 'claim') === 'donate') {
            // Ensure quests.js is loaded (hosts _patchCharityRecent + charity listeners)
            var _ensureCharityReady = function() {
                // Start listeners if not already running
                if (typeof _setupCharityListeners === 'function' && !_charityRecentUnsub) {
                    _setupCharityListeners(null);
                }
                if (typeof _patchCharityRecent === 'function') {
                    // Patch immediately if we already have data
                    if (typeof _charityRecent !== 'undefined' && _charityRecent.length > 0) {
                        _patchCharityRecent();
                    }
                    // Retry at 800ms and 2500ms — Firestore snapshot may take >600ms on slow connections
                    setTimeout(function() {
                        if (window._satsSubTab === 'donate' && typeof _patchCharityRecent === 'function') _patchCharityRecent();
                    }, 800);
                    setTimeout(function() {
                        if (window._satsSubTab === 'donate' && typeof _patchCharityRecent === 'function') _patchCharityRecent();
                    }, 2500);
                }
            };
            if (typeof _patchCharityRecent !== 'function') {
                // quests.js not loaded yet — inject script tag then retry
                var _qScript = document.querySelector('script[src*="quests.js"]');
                if (!_qScript) {
                    var _qs = document.createElement('script');
                    var _qv = (document.querySelector('script[src*="quests.js?"]') || {src:''}).src.split('?v=')[1] || '';
                    _qs.src = 'quests.js' + (_qv ? '?v=' + _qv : '');
                    _qs.onload = function() { setTimeout(_ensureCharityReady, 300); };
                    document.head.appendChild(_qs);
                } else {
                    // Script tag exists but still loading — wait
                    setTimeout(_ensureCharityReady, 1000);
                }
            } else {
                _ensureCharityReady();
            }
        }
        window._toggleSatsCharityNote = function() {
            var n = document.getElementById('satsCharityNote');
            var arr = document.getElementById('satsCharityNoteArrow');
            if (!n) return;
            var open = n.style.display !== 'none';
            n.style.display = open ? 'none' : 'block';
            if (arr) arr.textContent = open ? '\u25bc' : '\u25b2';
        };
        window._satsCharitySetAmt = function(amt) {
            var inp = document.getElementById('satsCharityAmtInput');
            if (inp) inp.value = amt > 0 ? amt : '';
        };
        window._satsCharitySubmit = function() {
            if (typeof firebase === 'undefined' || !firebase.functions) return;
            var inp = document.getElementById('satsCharityAmtInput');
            var amt = parseInt(inp ? inp.value : '') || 0;
            var avail = typeof currentUser !== 'undefined' && currentUser
                ? Math.max(0, (currentUser.points||0) - (currentUser.pointsClaimed||0) - (currentUser.pointsDonated||0) - (currentUser.pointsExchanged||0)) : 0;
            if (!amt || amt < 1) { if (typeof showToast === 'function') showToast('Enter a valid amount'); return; }
            if (avail <= 0) {
                if (typeof showToast === 'function') showToast('\u26a0\ufe0f No XP available to donate. Keep earning!', 5000);
                return;
            }
            if (amt > avail) {
                if (typeof showToast === 'function') showToast('\u26a0\ufe0f Max you can donate is ' + avail.toLocaleString() + ' XP \u2014 input adjusted.', 4000);
                var _inp2 = document.getElementById('satsCharityAmtInput');
                if (_inp2) _inp2.value = avail;
                return;
            }
            var anon = document.getElementById('satsCharityAnonToggle') ? document.getElementById('satsCharityAnonToggle').checked : false;
            var btn = document.querySelector('[onclick="window._satsCharitySubmit()"]');
            if (btn) { btn.disabled = true; btn.textContent = 'Donating...'; }
            firebase.functions().httpsCallable('donatePoints')({ amount: amt, anonymous: anon })
                .then(function(result) {
                    if (typeof currentUser !== 'undefined' && currentUser) {
                        currentUser.pointsDonated = (currentUser.pointsDonated || 0) + amt;
                        if (result.data && result.data.bonusPts) currentUser.points = (currentUser.points || 0) + result.data.bonusPts;
                    }
                    var badgeMsg = result.data && result.data.newBadges && result.data.newBadges.length > 0
                        ? ' +' + result.data.newBadges.length + ' badge' + (result.data.newBadges.length > 1 ? 's' : '') + ' unlocked!' : '';
                    var ticketMsg = result.data && result.data.donationTicket > 0 ? ' 🎫 +1 ticket!' : '';
                    if (typeof showToast === 'function') showToast('❤️ Thank you! ' + amt.toLocaleString() + ' XP donated (' + amt.toLocaleString() + ' sats pledged to charity).' + badgeMsg + ticketMsg, 5000);
                    if (result.data && result.data.donationTicket > 0 && typeof currentUser !== 'undefined' && currentUser) {
                        currentUser.orangeTickets = (currentUser.orangeTickets || 0) + 1;
                        if (typeof updateRankUI === 'function') updateRankUI();
                    }
                    if (typeof window._charityThankYou === 'function') window._charityThankYou(amt, result.data && result.data.newBadges || [], result.data && result.data.bonusPts || 0);
                    // Reset charity stats cache so Quest Hub picks up fresh totals
                    if (typeof window._charityStatsLoaded !== 'undefined') window._charityStatsLoaded = false;
                    // Update available XP display in-place
                    var _avEl = document.querySelector('#settingsModal [data-sats-charity-avail]');
                    if (_avEl) {
                        var _newAvail = Math.max(0, (currentUser.points||0) - (currentUser.pointsClaimed||0) - (currentUser.pointsDonated||0) - (currentUser.pointsExchanged||0));
                        _avEl.textContent = '\u2764\ufe0f ' + _newAvail.toLocaleString() + ' XP';
                    }
                    // Patch donated total line
                    var _donEl = document.querySelector('#settingsModal [data-sats-donated-total]');
                    if (_donEl) _donEl.textContent = (currentUser.pointsDonated||0).toLocaleString() + ' XP already donated \u2014 thank you! \u2764\ufe0f';
                    // Refresh recent donations list
                    if (typeof _patchCharityRecent === 'function') _patchCharityRecent();
                    // Clear the input
                    var _inp3 = document.getElementById('satsCharityAmtInput');
                    if (_inp3) _inp3.value = '';
                    if (btn) { btn.disabled = false; btn.textContent = '\u2764\ufe0f Donate XP for Charity'; }
                })
                .catch(function(e) {
                    if (btn) { btn.disabled = false; btn.textContent = '\u2764\ufe0f Donate XP for Charity'; }
                    var _errMsg = e.message || 'Donation failed. Try again.';
                    // Strip Firebase internal error prefixes for clean display
                    _errMsg = _errMsg.replace(/^\[\w+\/[\w-]+\]\s*/, '');
                    if (typeof showToast === 'function') showToast('\u274c ' + _errMsg, 4000);
                });
        };
    }

    // Load referral stats if on data tab (tickets are now here)
    if (settingsTab === 'data' && typeof loadReferralStatsUI === 'function' && user && !user.isAnonymous) {
        setTimeout(loadReferralStatsUI, 100);
    }

    // Render Nacho's Closet if on Stats/Nacho tab
    if (settingsTab === 'data' && typeof renderNachoClosetUI === 'function') {
        var closetContainer = document.getElementById('nachoClosetContainer');
        if (closetContainer) {
            renderNachoClosetUI(closetContainer);
            // If requested via closet shortcut, scroll to it
            if (window._pendingClosetScroll) {
                setTimeout(function() {
                    closetContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    window._pendingClosetScroll = false;
                }, 300);
            }
        }
    }
    // Load peers data (now in Account tab, triggered when account tab renders)
    if (settingsTab === 'account' && auth && auth.currentUser && typeof db !== 'undefined') {
        setTimeout(async function() {
            var listEl = document.getElementById('peersList');
            if (!listEl) return;
            try {
                var uid = auth.currentUser.uid;
                var userDoc = await db.collection('users').doc(uid).get();
                var userData = userDoc.exists ? userDoc.data() : {};
                var peers = userData.peers || [];
                window._myPeers = new Set(peers);

                // Load inbound requests first
                var reqSnap = await db.collection('peer_requests')
                    .where('to', '==', uid).where('status', '==', 'pending').limit(20).get();
                var reqHtml = '';
                if (!reqSnap.empty) {
                    reqHtml += '<h4 style="font-size:0.85rem;margin:0 0 8px;color:var(--text);">Incoming Requests</h4>';
                    reqSnap.forEach(function(doc) {
                        var d = doc.data();
                        reqHtml += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">' +
                            '<span style="font-size:0.85rem;">🧡 ' + (d.fromUsername || 'Bitcoiner') + '</span>' +
                            '<div style="display:flex;gap:6px;">' +
                            '<button onclick="window.managePeer(\'accept\',\'' + d.from + '\',this).then(function(){if(typeof showSettingsPage===\'function\')showSettingsPage(\'account\')})" style="padding:4px 10px;background:#f97316;border:none;border-radius:6px;color:#fff;font-size:0.75rem;cursor:pointer;font-family:inherit;">Accept</button>' +
                            '<button onclick="window.managePeer(\'decline\',\'' + d.from + '\',this).then(function(){if(typeof showSettingsPage===\'function\')showSettingsPage(\'account\')})" style="padding:4px 10px;background:none;border:1px solid var(--border);border-radius:6px;color:var(--text-muted);font-size:0.75rem;cursor:pointer;font-family:inherit;">Decline</button>' +
                            '</div></div>';
                    });
                }

                // Load current peers
                var peerHtml = '';
                if (peers.length === 0) {
                    peerHtml = '<p style="color:var(--text-muted);text-align:center;padding:12px 0;">No peers yet. Find people on the leaderboard and add them!</p>';
                } else {
                    var _utcDay = new Date().toISOString().slice(0, 10);
                    var _offsetDay = (typeof getDailyKey === 'function') ? getDailyKey() : _utcDay;
                    var _sendDates = _utcDay === _offsetDay ? [_utcDay] : [_utcDay, _offsetDay];
                    var _peerKeysSentToday = {};
                    var _peerKeysHeld = {};
                    if (userData.keysSentDate === _utcDay || userData.keysSentDate === _offsetDay) {
                        (userData.keysSentTo || []).forEach(function(id) { _peerKeysSentToday[id] = true; });
                    }
                    var _indicatorLoads = await Promise.all([
                        db.collection('key_send_pairs').where('senderUid', '==', uid).where('date', 'in', _sendDates).limit(100).get().catch(function() { return null; }),
                        db.collection('keys').where('ownerId', '==', uid).where('status', '==', 'sent').limit(80).get().catch(function() { return null; })
                    ]);
                    if (_indicatorLoads[0]) {
                        _indicatorLoads[0].forEach(function(doc) {
                            var rec = doc.data().recipientUid;
                            if (rec) _peerKeysSentToday[rec] = true;
                        });
                    }
                    if (_indicatorLoads[1]) {
                        _indicatorLoads[1].forEach(function(doc) {
                            var from = doc.data().sentBy;
                            if (from) _peerKeysHeld[from] = (_peerKeysHeld[from] || 0) + 1;
                        });
                    }
                    var peerDocs = await Promise.all(peers.slice(0, 50).map(function(p) {
                        return db.collection('public_profiles').doc(p).get();
                    }));
                    peerDocs.forEach(function(snap, i) {
                        var d = snap.exists ? snap.data() : {};
                        var name = d.username || d.displayName || 'Bitcoiner';
                        var puid = peers[i];
                        var _keysSentToday = !!_peerKeysSentToday[puid];
                        var _holdingKey = !!_peerKeysHeld[puid];
                        window._peerNames = window._peerNames || {};
                        window._peerNames[puid] = name;
                        var _safeName = (typeof escapeHtml === 'function' ? escapeHtml(name) : name);
                        var _safeUid = (typeof escapeHtml === 'function' ? escapeHtml(puid) : puid);
                        var _peerMarks = '';
                        if (_keysSentToday) _peerMarks += '<span class="peer-sent" style="display:inline-block;padding:3px 8px;border-radius:999px;background:rgba(247,147,26,0.15);border:1px solid rgba(247,147,26,0.35);font-size:0.72rem;font-weight:800;">Sent today</span>';
                        if (_holdingKey) _peerMarks += '<span class="peer-hold" style="display:inline-block;padding:3px 8px;border-radius:999px;background:rgba(124,58,237,0.12);border:1px solid rgba(124,58,237,0.45);font-size:0.72rem;font-weight:800;">Holding their key</span>';
                        var pLvl = typeof getLevel === 'function' ? getLevel(d.points || 0) : { name: 'Pleb', emoji: '🌱' };
                        var pStreak = d.streak || 0;
                        var pPosts = d.forumPosts || 0;
                        var pXP = (d.points || 0).toLocaleString();
                        var pWeekly = d.weeklyXP || 0;
                        var pLastVisit = d.lastVisit || '';
                        var pDetailId = 'peerDetail_' + puid.replace(/[^a-z0-9]/gi,'_');
                        // Format last active
                        var pLastStr = '';
                        if (pLastVisit) {
                            try {
                                var today = new Date(); today.setHours(0,0,0,0);
                                var lv = new Date(pLastVisit); lv.setHours(0,0,0,0);
                                var diffDays = Math.round((today - lv) / 86400000);
                                pLastStr = diffDays === 0 ? 'Active today' : diffDays === 1 ? 'Active yesterday' : 'Active ' + diffDays + 'd ago';
                            } catch(e) { pLastStr = ''; }
                        }
                        // Summary line (collapsed)
                        var summaryParts = [];
                        if (pLastStr) summaryParts.push(pLastStr);
                        summaryParts.push(pLvl.emoji + ' ' + pLvl.name);
                        if (pStreak > 0) summaryParts.push('🔥 ' + pStreak + 'd');
                        var summaryText = summaryParts.join(' · ');
                        var _sendLabel = _keysSentToday ? '🔑 Sent today' : '🔑 Send keys';
                        var _sendStyle = _keysSentToday
                            ? 'background:rgba(255,255,255,0.04);border:1px solid var(--border);color:var(--text);'
                            : 'background:linear-gradient(135deg,#f7931a,#ea580c);border:none;color:#fff;';
                        var _limitLine = _keysSentToday
                            ? 'Sent today. The limit is 3 keys per peer, once a day. You can send again tomorrow. If a peer opens a cipher with your key, you both win the same prize.'
                            : 'Up to 3 keys per peer per day. If a peer opens a cipher with your key, you both win the same prize.';
                        peerHtml += '<div style="border:1px solid var(--border);border-radius:14px;padding:12px;margin:0 0 10px;background:var(--bg-side);">' +
                            '<div style="font-size:1rem;font-weight:800;color:var(--heading);word-break:break-word;line-height:1.3;">🧡 ' + _safeName + '</div>' +
                            '<div style="margin-top:4px;font-size:0.75rem;color:var(--text-dim);line-height:1.4;">' + summaryText + '</div>' +
                            (_peerMarks ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">' + _peerMarks + '</div>' : '') +
                            '<div class="peer-action-row" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;">' +
                                '<button type="button" class="peer-primary" data-peer-action="send-keys" data-peer-uid="' + _safeUid + '" style="flex:1 1 160px;min-height:44px;padding:10px 12px;border-radius:10px;font-size:0.92rem;font-weight:800;cursor:pointer;font-family:inherit;' + _sendStyle + '">' + _sendLabel + '</button>' +
                                '<button type="button" class="peer-more" data-peer-action="more" data-peer-panel="' + pDetailId + '" aria-expanded="false" style="flex:1 1 140px;min-height:44px;padding:10px 12px;background:transparent;border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">More options ▾</button>' +
                            '</div>' +
                            '<div style="margin-top:6px;font-size:0.75rem;color:var(--text-dim);line-height:1.4;">' + _limitLine + '</div>' +
                            '<div style="display:flex;justify-content:flex-end;margin-top:4px;">' +
                                '<button type="button" class="peer-remove" data-peer-action="remove" data-peer-uid="' + _safeUid + '" style="padding:6px 10px;background:transparent;border:1px solid rgba(220,38,38,0.45);border-radius:8px;font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit;">Remove</button>' +
                            '</div>' +
                            '<div id="' + pDetailId + '" style="display:none;margin-top:10px;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:10px;">' +
                                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:0.78rem;">' +
                                    '<div style="color:var(--text-muted);">⭐ <b style="color:var(--text);">' + pXP + '</b> XP</div>' +
                                    '<div style="color:var(--text-muted);">🔥 <b style="color:var(--text);">' + pStreak + 'd</b> streak</div>' +
                                    '<div style="color:var(--text-muted);">🗣️ <b style="color:var(--text);">' + pPosts + '</b> posts</div>' +
                                    '<div style="color:var(--text-muted);">📅 <b style="color:var(--text);">' + (pWeekly > 0 ? '+' + pWeekly.toLocaleString() + ' XP this week' : 'No XP this week') + '</b></div>' +
                                '</div>' +
                                (pLastStr ? '<div style="margin-top:6px;font-size:0.72rem;color:var(--text-dim);">' + pLastStr + '</div>' : '') +
                                '<button type="button" data-peer-action="profile" data-peer-uid="' + _safeUid + '" style="margin-top:8px;width:100%;min-height:40px;padding:8px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;">View profile</button>' +
                            '</div>' +
                        '</div>';
                    });
                }

                var finalHtml = '';
                if (reqHtml) finalHtml += reqHtml + '<h4 style="font-size:0.85rem;margin:16px 0 8px;color:var(--text);">Your Peers (' + peers.length + ')</h4>';
                finalHtml += peerHtml;
                if (!window._peerRowClicksBound) {
                    window._peerRowClicksBound = true;
                    document.addEventListener('click', function(ev) {
                        var btn = ev.target && ev.target.closest ? ev.target.closest('[data-peer-action]') : null;
                        if (!btn) return;
                        var action = btn.getAttribute('data-peer-action');
                        var uid = btn.getAttribute('data-peer-uid');
                        if (action === 'send-keys') window._sendKeysToPeer(uid);
                        else if (action === 'more') window._togglePeerMore(btn);
                        else if (action === 'remove') window.confirmRemovePeer(uid, btn);
                        else if (action === 'profile') window._viewPeerProfile(uid);
                    });
                }
                var listEl2 = document.getElementById('peersList');
                if (listEl2) listEl2.innerHTML = finalHtml || '<p style="text-align:center;color:var(--text-muted);">No peers yet</p>';
            } catch(e) {
                var listEl3 = document.getElementById('peersList');
                if (listEl3) listEl3.innerHTML = '<p style="color:#ef4444;text-align:center;">Could not load peers: ' + (e.message || 'error') + '</p>';
            }
        }, 150);
    }

    } catch(e) {
        if (typeof showToast === 'function') showToast('Settings page error: ' + e.message);
        console.error('showSettingsPage error:', e);
    }
}

// Language translation via Google Translate
function changeLanguage(lang) {
    const status = document.getElementById('langStatus');
    if (!lang) {
        // Reset to English - clear storage/cookies then reload (in-place DOM cleanup is unreliable after GT mutation)
        document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.' + location.hostname;
        document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + location.hostname;
        localStorage.setItem('btc_lang', '');
        if (status) status.innerHTML = '<span style="color:#22c55e;">✅ Reloading in English...</span>';
        setTimeout(function() { location.reload(); }, 400);
        return;
    }
    localStorage.setItem('btc_lang', lang);
    document.cookie = 'googtrans=/en/' + lang + '; path=/;';
    document.cookie = 'googtrans=/en/' + lang + '; path=/; domain=.' + location.hostname;
    if (status) status.innerHTML = '<span style="color:var(--text-muted);">Translating...</span>';
    // Load Google Translate if not loaded
    if (!document.getElementById('gtranslate')) {
        const s = document.createElement('script');
        s.id = 'gtranslate';
        s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateReady';
        document.head.appendChild(s);
        window.googleTranslateReady = function() {
            new google.translate.TranslateElement({ pageLanguage: 'en', autoDisplay: false }, 'gtranslateWidget');
            setTimeout(() => {
                triggerGoogleTranslate(lang);
                if (status) status.innerHTML = '<span style="color:#22c55e;">✅ Translated!</span>';
            }, 1500);
        };
        // Hidden widget container
        const div = document.createElement('div');
        div.id = 'gtranslateWidget';
        div.style.display = 'none';
        document.body.appendChild(div);
    } else {
        triggerGoogleTranslate(lang);
        if (status) status.innerHTML = '<span style="color:#22c55e;">✅ Translated!</span>';
    }
}

function triggerGoogleTranslate(lang) {
    const sel = document.querySelector('.goog-te-combo');
    if (sel) {
        sel.value = lang;
        sel.dispatchEvent(new Event('change'));
    }
}

// Restore language on load
(function() {
    const saved = localStorage.getItem('btc_lang');
    if (saved) {
        document.cookie = 'googtrans=/en/' + saved + '; path=/;';
        document.cookie = 'googtrans=/en/' + saved + '; path=/; domain=.' + location.hostname;
        const s = document.createElement('script');
        s.id = 'gtranslate';
        s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateReady';
        document.head.appendChild(s);
        window.googleTranslateReady = function() {
            new google.translate.TranslateElement({ pageLanguage: 'en', autoDisplay: false }, 'gtranslateWidget');
        };
        const div = document.createElement('div');
        div.id = 'gtranslateWidget';
        div.style.display = 'none';
        document.body.appendChild(div);
    }
})();


// Soundscapes
window.setSoundscape = function(type) {
    localStorage.setItem('btc_soundscape', type);
    if (typeof updateSoundscape === 'function') updateSoundscape(type);
    showSettingsPage('prefs');
};

// Font size
function setFontSize(size) {
    localStorage.setItem('btc_font_size', size);
    const px = size === 'small' ? '14px' : size === 'medium' ? '16px' : '18px';
    document.documentElement.style.fontSize = px;
    showSettingsPage('prefs');
}

// Profile link helpers
window._removedProfileLinks = {};
window.profileLinkRemoved = function(key) { window._removedProfileLinks[key] = true; };
window.addProfileLink = function(key, emoji, label, placeholder, maxlen, type) {
    var area = document.getElementById('profileLinksArea');
    if (!area) return;
    if (key === 'lightning') {
        var lockedLn = (typeof currentUser !== 'undefined' && currentUser) ? (currentUser.lightning || currentUser.lightningAddress || '') : '';
        if (lockedLn) return;
        var note = document.createElement('p');
        note.textContent = LN_ADDRESS_LOCK_NOTICE;
        note.style.cssText = 'color:var(--text-muted);font-size:0.75rem;line-height:1.45;margin:0 0 8px;';
        area.appendChild(note);
    }
    // Add new input row
    var row = document.createElement('div');
    row.className = 'pf-link-row';
    row.setAttribute('data-key', key);
    row.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:12px;background:rgba(255,255,255,0.02);padding:10px;border-radius:12px;border:1px solid var(--border);';
    row.innerHTML = '<span style="font-size:1.2rem;width:28px;text-align:center;flex-shrink:0;">' + emoji + '</span>' +
        '<input type="' + (type || 'text') + '" id="profile_' + key + '" value="" placeholder="' + placeholder + '" maxlength="' + maxlen + '" style="flex:1;padding:8px 10px;background:var(--input-bg,rgba(255,255,255,0.05));border:1px solid var(--border);border-radius:8px;color:var(--text,#e2e8f0);font-size:16px;font-family:inherit;outline:none;box-sizing:border-box;min-width:0;-webkit-appearance:none;">' +
        '<button onclick="document.getElementById(\'profile_' + key + '\').value=\'\';this.parentElement.remove();profileLinkRemoved(\'' + key + '\')" style="background:rgba(239,68,68,0.1);border:none;color:#ef4444;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;" title="Remove">✕</button>';
    area.appendChild(row);
    // Hide the menu
    var menu = document.getElementById('addLinkMenu');
    if (menu) menu.style.display = 'none';
    // Focus the new input
    var input = document.getElementById('profile_' + key);
    if (input) input.focus();
};

// =============================================
// PROFILE PICTURE - upload, resize, store as base64 in Firestore
// =============================================
window.handleProfilePicUpload = function(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var status = document.getElementById('pfpUploadStatus');

    // Validate
    if (!file.type.match(/^image\//)) {
        if (status) status.innerHTML = '<span style="color:#ef4444;">❌ Please select an image file</span>';
        return;
    }
    if (file.size > 2 * 1024 * 1024) {
        if (status) status.innerHTML = '<span style="color:#ef4444;">❌ Image too large (max 2MB)</span>';
        return;
    }

    if (status) status.innerHTML = '<span style="color:var(--accent);">Processing...</span>';

    var reader = new FileReader();
    reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
            // Resize to 128x128 JPEG for small Firestore footprint (~5-15KB)
            var size = 128;
            var canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            var ctx = canvas.getContext('2d');
            // Center-crop: use the smaller dimension as the square
            var sx = 0, sy = 0, sSize = Math.min(img.width, img.height);
            sx = (img.width - sSize) / 2;
            sy = (img.height - sSize) / 2;
            ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, size, size);
            var dataUrl = canvas.toDataURL('image/jpeg', 0.8);

            // Save to Firestore
            if (!auth || !auth.currentUser) {
                if (status) status.innerHTML = '<span style="color:#ef4444;">❌ Not signed in</span>';
                return;
            }
            db.collection('users').doc(auth.currentUser.uid).update({ profilePic: dataUrl }).then(function() {
                if (currentUser) currentUser.profilePic = dataUrl;
                // Bust leaderboard cache so pic shows immediately
                window._lbCache = null;
                if (status) status.innerHTML = '<span style="color:#22c55e;">✅ Profile picture saved!</span>';
                if (typeof showToast === 'function') showToast('📷 Profile picture updated!');
                setTimeout(function() { showSettingsPage('account'); }, 1000);
            }).catch(function(err) {
                if (status) status.innerHTML = '<span style="color:#ef4444;">❌ Save failed: ' + err.message + '</span>';
            });
        };
        img.onerror = function() {
            if (status) status.innerHTML = '<span style="color:#ef4444;">❌ Could not load image</span>';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.removeProfilePic = function() {
    if (!auth || !auth.currentUser) return;
    db.collection('users').doc(auth.currentUser.uid).update({ profilePic: '' }).then(function() {
        if (currentUser) currentUser.profilePic = '';
        window._lbCache = null;
        if (typeof showToast === 'function') showToast('📷 Profile picture removed');
        showSettingsPage('account');
    }).catch(function() {});
};

async function saveProfile() {
    var status = document.getElementById('profileStatus');
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        if (typeof showSignInPrompt === 'function') showSignInPrompt();
        else if (typeof showUsernamePrompt === 'function') showUsernamePrompt();
        return;
    }

    var uid = auth.currentUser.uid;
    var bio = document.getElementById('profileBio') ? document.getElementById('profileBio').value.trim() : '';

    var countryEl = document.getElementById('countryInput');
    var country = countryEl ? countryEl.value.trim().substring(0, 60) : '';
    // Validate country against the known list - reject freeform text
    if (country && window._countryList && window._countryList.indexOf(country) === -1) {
        if (typeof showToast === 'function') showToast('\u26a0\ufe0f Please select a valid country from the dropdown list.');
        countryEl.focus();
        return;
    }
    var updateData = { bio: bio, country: country };
    var _lnProfileError = '';
    var _profileFreshLn = '';

    // Social links mapping
    var links = ['website', 'twitter', 'nostr', 'instagram', 'tiktok', 'github', 'contactEmail', 'lightning'];
    // URL scheme validation - block javascript:, data:, vbscript: etc.
    var _safeUrl = function(url) {
        if (!url) return '';
        url = url.trim();
        if (/^(javascript|data|vbscript|blob):/i.test(url)) return '';
        return url;
    };
    links.forEach(function(k) {
        var el = document.getElementById('profile_' + k);
        if (k === 'lightning') {
            var lockedRaw = currentUser ? String(currentUser.lightning || currentUser.lightningAddress || '') : '';
            if (lockedRaw) {
                if (el) {
                    var typedLn = normalizeClientLn(el.value);
                    if (typedLn && typedLn !== normalizeClientLn(lockedRaw)) _lnProfileError = LN_ADDRESS_LOCKED_NOTICE;
                }
                return;
            }
            if (el) {
                var freshLn = normalizeClientLn(el.value);
                if (freshLn && !clientLnValid(freshLn)) {
                    _lnProfileError = 'Enter a valid Lightning Address (e.g. you@walletofsatoshi.com)';
                    return;
                }
                if (freshLn) _profileFreshLn = freshLn;
            }
            return;
        }
        if (el) {
            var val = el.value.trim();
            if (k === 'contactEmail') {
                val = val.replace(/[\\'"<>]/g, '');
            } else if (k === 'nostr') {
                val = val.replace(/[\\'"<>]/g, '');
            } else {
                val = _safeUrl(val);
                if (k === 'website') val = _normalizeUrl(val) === '#' ? '' : _normalizeUrl(val);
            }
            updateData[k] = val;
        }
        else if (currentUser && typeof currentUser[k] !== 'undefined') {
            // If the element doesn't exist but the user had it, we check if it was removed
            // Actually, addProfileLink adds the element. If it's gone from DOM, they likely clicked Remove.
            // But we only want to null it if it was explicitly removed.
            // pf-link-row has data-key.
            var row = document.querySelector('.pf-link-row[data-key="' + k + '"]');
            if (!row) updateData[k] = '';
        }
    });

    if (_lnProfileError) {
        if (status) status.textContent = _lnProfileError;
        if (typeof showToast === 'function') showToast(_lnProfileError);
        return;
    }

    try {
        if (status) status.innerHTML = '<span style="color:var(--accent);">Saving...</span>';
        await db.collection('users').doc(uid).update(updateData);

        // One-time +100 XP reward + Global Citizen badge for adding country for the first time
        var _prevCountry = currentUser ? (currentUser.country || '') : '';
        if (country && !_prevCountry) {
            if (typeof awardPoints === 'function') {
                awardPoints(100, 'badge_earned', null, null, null, 'country_set');
            }
            // Trigger badge check so Global Citizen badge is awarded immediately
            if (typeof checkBadges === 'function') {
                setTimeout(function() { checkBadges(); }, 500);
            }
        }

        // Update local currentUser object
        Object.assign(currentUser, updateData);

        if (status) status.innerHTML = '<span style="color:#22c55e;">✅ Profile saved!</span>';
        if (typeof showToast === 'function') showToast('✅ Profile saved successfully!');
        if (_profileFreshLn) openWithdrawalAddress({ mode: 'reset', address: _profileFreshLn, start: 'confirm' });

        // Small delay then close or refresh settings view
        setTimeout(function() {
            if (status) status.innerHTML = '';
            showSettingsPage('account');
        }, 1500);
    } catch(e) {
        console.error('Error saving profile:', e);
        if (status) status.innerHTML = '<span style="color:#ef4444;">❌ Error saving</span>';
        if (typeof showToast === 'function') showToast('❌ Error saving profile');
    }
}

// Clear all user-specific localStorage to prevent cross-account leakage
// ---- Artist Profile Modal ----
window.showArtistProfileModal = function() {
    if (!auth || !auth.currentUser) { if (typeof showToast === 'function') showToast('Sign in first'); return; }
    var existing = document.getElementById('artistProfileModal');
    if (existing) existing.remove();

    var ap = currentUser ? (currentUser.artistProfile || {}) : {};
    var uid = auth.currentUser.uid;

    var overlay = document.createElement('div');
    overlay.id = 'artistProfileModal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:500000;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;-webkit-overflow-scrolling:touch;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = '<div style="background:var(--bg-side);border:1px solid var(--border);border-radius:24px;padding:28px;max-width:440px;width:100%;margin:40px auto;animation:fadeSlideIn 0.3s ease-out;">' +
        '<button onclick="document.getElementById(\'artistProfileModal\').remove()" style="float:right;background:none;border:1px solid var(--border);color:var(--text-muted);width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;">✕</button>' +
        '<div style="text-align:center;margin-bottom:20px;">' +
            '<div style="font-size:2.5rem;margin-bottom:8px;">🎸</div>' +
            '<div style="color:var(--heading);font-weight:800;font-size:1.2rem;">Artist Profile</div>' +
            '<div style="color:var(--text-muted);font-size:0.8rem;">Set up your artist presence on Bitcoin Beats</div>' +
        '</div>' +
        // Stage Name
        '<div style="margin-bottom:12px;">' +
            '<div style="font-size:0.72rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">🎤 Stage Name</div>' +
            '<input type="text" id="artistStageName" maxlength="40" placeholder="Your artist or stage name" value="' + escapeHtml(ap.stageName || '') + '" style="width:100%;padding:10px 14px;background:var(--input-bg,#111);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;font-family:inherit;box-sizing:border-box;">' +
            '<div style="font-size:0.68rem;color:var(--text-faint);margin-top:3px;">Leave blank to use your username.</div>' +
        '</div>' +
        // Artist Bio
        '<div style="margin-bottom:12px;">' +
            '<div style="font-size:0.72rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">📝 Artist Bio</div>' +
            '<textarea id="artistBio" maxlength="500" rows="3" placeholder="Tell listeners about your music..." style="width:100%;padding:10px 14px;background:var(--input-bg,#111);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.85rem;font-family:inherit;box-sizing:border-box;resize:vertical;">' + escapeHtml(ap.bio || '') + '</textarea>' +
        '</div>' +
        // Genres
        '<div style="margin-bottom:12px;">' +
            '<div style="font-size:0.72rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">🎵 Genres</div>' +
            '<input type="text" id="artistGenres" maxlength="100" placeholder="e.g. hip-hop, lo-fi, bitcoin anthems" value="' + escapeHtml(ap.genres || '') + '" style="width:100%;padding:10px 14px;background:var(--input-bg,#111);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;font-family:inherit;box-sizing:border-box;">' +
        '</div>' +
        // Music Links
        '<div style="margin-bottom:16px;">' +
            '<div style="font-size:0.72rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">🔗 Music Links</div>' +
            '<div style="display:flex;flex-direction:column;gap:6px;">' +
                '<div style="display:flex;align-items:center;gap:6px;"><span style="width:18px;text-align:center;font-size:0.85rem;">🌐</span><input type="url" id="artistLinkWebsite" placeholder="Website" value="' + escapeHtml(ap.website || '') + '" style="flex:1;padding:8px 12px;background:var(--input-bg,#111);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.82rem;font-family:inherit;box-sizing:border-box;"></div>' +
                '<div style="display:flex;align-items:center;gap:6px;"><span style="width:18px;text-align:center;font-size:0.85rem;">X</span><input type="text" id="artistLinkX" placeholder="X handle (e.g. @artist)" maxlength="50" value="' + escapeHtml(ap.x || '') + '" style="flex:1;padding:8px 12px;background:var(--input-bg,#111);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.82rem;font-family:inherit;box-sizing:border-box;"></div>' +
                '<div style="display:flex;align-items:center;gap:6px;"><span style="width:18px;text-align:center;font-size:0.85rem;">📸</span><input type="text" id="artistLinkInstagram" placeholder="Instagram handle (e.g. @artist)" maxlength="50" value="' + escapeHtml(ap.instagram || '') + '" style="flex:1;padding:8px 12px;background:var(--input-bg,#111);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.82rem;font-family:inherit;box-sizing:border-box;"></div>' +
            '</div>' +
        '</div>' +
        // Lightning reminder
        '<div style="background:rgba(234,179,8,0.06);border:1px solid rgba(234,179,8,0.2);border-radius:10px;padding:12px;margin-bottom:16px;display:flex;align-items:center;gap:8px;">' +
            '<span style="font-size:1.1rem;">⚡</span>' +
            '<div style="flex:1;font-size:0.78rem;color:var(--text-muted);">' +
                (currentUser && (currentUser.lightningAddress || currentUser.lightning)
                    ? '✅ Lightning: <strong style="color:#eab308;">' + escapeHtml(currentUser.lightningAddress || currentUser.lightning) + '</strong>'
                    : '⚠️ Set a Lightning Address in Account or Wallet to receive tips!') +
            '</div>' +
        '</div>' +
        // Save + Preview
        '<button onclick="saveArtistProfile()" id="artistSaveBtn" style="width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 4px 15px rgba(247,147,26,0.3);margin-bottom:8px;">💾 Save Artist Profile</button>' +
        '<button onclick="document.getElementById(\'artistProfileModal\').remove();if(typeof beatsShowArtistPage===\'function\')beatsShowArtistPage(\'' + uid + '\')" style="width:100%;padding:10px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.82rem;cursor:pointer;font-family:inherit;">👀 Preview My Artist Page</button>' +
    '</div>';

    document.body.appendChild(overlay);
};

window.saveArtistProfile = function() {
    if (!auth || !auth.currentUser || typeof db === 'undefined') {
        if (typeof showToast === 'function') showToast('Sign in to save your artist profile');
        return;
    }
    var btn = document.getElementById('artistSaveBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    var profile = {
        stageName: (document.getElementById('artistStageName').value || '').trim().substring(0, 40),
        bio: (document.getElementById('artistBio').value || '').trim().substring(0, 500),
        genres: (document.getElementById('artistGenres').value || '').trim().substring(0, 100),
        website: (function(v) { v = (v || '').trim().substring(0, 200); v = _normalizeUrl(v) === '#' ? '' : _normalizeUrl(v); return v; })(document.getElementById('artistLinkWebsite').value),
        x: (document.getElementById('artistLinkX').value || '').trim().substring(0, 50),
        instagram: (document.getElementById('artistLinkInstagram').value || '').trim().substring(0, 50)
    };

    db.collection('users').doc(auth.currentUser.uid).update({
        artistProfile: profile
    }).then(function() {
        if (currentUser) currentUser.artistProfile = profile;
        if (typeof showToast === 'function') showToast('🎸 Artist profile saved!');
        if (btn) { btn.disabled = false; btn.textContent = '💾 Save Artist Profile'; }
    }).catch(function(e) {
        console.error('Artist profile save error:', e);
        if (typeof showToast === 'function') showToast('Error saving: ' + (e.message || 'Unknown'));
        if (btn) { btn.disabled = false; btn.textContent = '💾 Save Artist Profile'; }
    });
};

// ---- Paste helper for iOS ----
window.pasteToField = function(fieldId) {
    var field = document.getElementById(fieldId);
    if (!field) return;

    // Method 1: Clipboard API (works on most browsers with user gesture)
    if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(function(text) {
            if (text) {
                field.value = text.trim();
                field.style.borderColor = 'var(--accent)';
                field.dispatchEvent(new Event('input', { bubbles: true }));
                if (typeof showToast === 'function') showToast('📋 Pasted!');
            } else {
                _pasteFieldFallback(field);
            }
        }).catch(function() {
            _pasteFieldFallback(field);
        });
    } else {
        _pasteFieldFallback(field);
    }
};

// Fallback: focus field and trigger native paste menu on iOS
function _pasteFieldFallback(field) {
    field.focus();
    field.value = '';
    field.setSelectionRange(0, 0);
    try { document.execCommand('paste'); } catch(e) {}
    if (typeof showToast === 'function') showToast('📋 Field ready - tap and hold, then tap Paste', 5000);
}

// Load Signal live news content
window.loadSignalContent = function() {
    var container = document.getElementById('signalLiveNews');
    if (!container || container.getAttribute('data-loaded')) return;
    container.setAttribute('data-loaded', '1');
    fetch('newsletter-data.json?v=' + Date.now()).then(function(r) { return r.json(); }).then(function(data) {
        if (!data || !data.news || data.news.length === 0) return;
        var inner = container.querySelector('div') || container;
        var cardsHtml = '';
        data.news.slice(0, 3).forEach(function(n, i) {
            var title = (n.title || '').replace(/<[^>]+>/g, '');
            var link = n.link || '';
            cardsHtml += '<div style="min-width:240px;max-width:280px;flex-shrink:0;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;text-align:left;cursor:pointer;transition:0.2s;" ' +
                (link ? 'onclick="window.open(\'' + link.replace(/[\\'"]/g, "") + '\',\'_blank\')"' : '') +
                '><div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;"><span style="background:var(--accent);color:#fff;font-size:0.55rem;font-weight:900;padding:2px 6px;border-radius:8px;">SIGNAL #' + (i + 1) + '</span></div>' +
                '<div style="color:var(--heading);font-weight:700;font-size:0.82rem;line-height:1.3;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">' + title + '</div>' +
                (link ? '<div style="color:var(--accent);font-size:0.7rem;font-weight:700;margin-top:6px;">Read →</div>' : '') + '</div>';
        });
        inner.innerHTML = cardsHtml;
    }).catch(function() {});
};

// Expand the Sign Up banner back out (re-runs updateUserDisplay to re-render)
window.expandSignUpBanner = function() {
    sessionStorage.removeItem('btc_signin_banner_dismissed');
    var pill = document.getElementById('mobileSignUpPill');
    if (pill) pill.remove();
    var ud = document.getElementById('userDisplay');
    if (ud) ud.classList.remove('user-hidden');
    if (typeof updateUserDisplay === 'function') updateUserDisplay();
};

window.minimizeSignUpBanner = function() {
    sessionStorage.setItem('btc_signin_banner_dismissed', '1');
    var ud = document.getElementById('userDisplay');
    var isMob = window.innerWidth <= 900;
    if (isMob) {
        // Add a class so CSS-with-!important can't override our hide.
        if (ud) {
            ud.classList.add('user-hidden');
            ud.style.display = 'none';
        }
        // Create the minimized pill. Tap the pill → expand the banner back.
        // Long-press (or tap the ✕) opens sign-in directly.
        var pill = document.getElementById('mobileSignUpPill');
        if (!pill) {
            pill = document.createElement('div');
            pill.id = 'mobileSignUpPill';
            document.body.appendChild(pill);
        }
        pill.style.cssText = 'position:fixed;bottom:calc(var(--fab-bottom, calc(72px + env(safe-area-inset-bottom, 0px) + 12px)) + 64px);left:12px;z-index:200;display:flex;align-items:center;gap:6px;padding:8px 12px 8px 16px;background:var(--bg-side,#1a1a2e);border:2px solid #f7931a;border-radius:10px;box-shadow:0 2px 10px rgba(247,147,26,0.2);cursor:pointer;transition:0.3s;';
        pill.innerHTML = '<span style="font-size:0.8rem;font-weight:700;color:#f7931a;">🔐 Sign Up</span>' +
            '<span style="color:var(--text-faint,#888);font-size:0.7rem;margin-left:4px;" title="Expand banner">▲</span>';
        pill.onclick = function() { window.expandSignUpBanner(); };
    } else {
        if (!ud) return;
        // Desktop: shrink the display in-place to a compact pill that can be re-expanded.
        ud.style.cssText = 'position:fixed;top:12px;right:20px;z-index:200;display:flex;align-items:center;gap:6px;padding:6px 14px;background:var(--bg-side,#1a1a2e);border:2px solid #f7931a;border-radius:10px;box-shadow:0 2px 10px rgba(247,147,26,0.2);cursor:pointer;transition:0.3s;';
        ud.innerHTML = '<span style="font-size:0.8rem;font-weight:700;color:#f7931a;">🔐 Sign Up</span>' +
            '<span style="color:var(--text-faint,#888);font-size:0.7rem;margin-left:4px;" title="Expand banner">▲</span>';
        ud.onclick = function() { window.expandSignUpBanner(); };
    }
};

function clearUserLocalStorage(opts) {
    var preserve = ['btc_theme_oled', 'btc_font_size', 'btc_volume', 'btc_lang', 'btc_haptic', 'btc_soundscape', 'btc_ticker_enabled', 'btc_ios_a2hs_dismissed', 'btc_pwa_dismissed', 'btc_swipe_hint_shown', 'btc_last_auth_uid', 'btc_signin_email', 'btc_skip_email_link', 'btc_pending_email', 'btc_pending_username', 'btc_pending_ln_address', 'btc_pending_faction', 'btc_pending_country', 'btc_mode_card_dismissed',
        // Badge cache — preserve on sign-out so the next sign-in doesn't trigger
        // a cold-start race where checkBadges() fires before Firestore restores
        // visibleBadges, causing duplicate toast/celebration modals.
        // These are always safely overwritten by markVisibleBadgesReady() on sign-in.
        'btc_badges', 'btc_hidden_badges'
    ];
    if (opts && opts.keepGuest) {
        preserve = preserve.concat(['btc_visited_channels', 'btc_experience_mode', 'btc_intro_seen', 'btc_onboarding_done', 'btc_onboarding_active', 'btc_onboarding_step', 'btc_onboarding_quest_done', 'btc_quest_pending', 'btc_guest_link', 'btc_nacho_quest_channel', 'btc_nacho_quest_nacho', 'btc_nacho_quest_quiz']);
    }
    var toRemove = [];
    for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf('btc_') === 0 && preserve.indexOf(key) === -1) {
            // Also preserve btc_badge_earned_* sentinel keys — these prevent set/combo
            // badge re-toasting on the next session. They're harmless to keep and are
            // restored from visibleBadges by markVisibleBadgesReady() on sign-in anyway.
            if (key.indexOf('btc_badge_earned_') === 0) continue;
            toRemove.push(key);
        }
    }
    for (var j = 0; j < toRemove.length; j++) {
        localStorage.removeItem(toRemove[j]);
    }
}
window.clearUserLocalStorage = clearUserLocalStorage;

// ---- TOS Acceptance Modal (existing users) ----
function _showTosModal() {
    var m = document.getElementById('tosModal');
    if (m) m.classList.add('open');
    document.querySelectorAll('.rank-toast').forEach(function(el) { el.remove(); });
    var pill = document.getElementById('nachoQuestPill');
    if (pill) pill.style.display = 'none';
}

function _tosNeedsTick() {
    var row = document.getElementById('tosConsentRow');
    if (row) {
        row.classList.remove('shake');
        void row.offsetWidth;
        row.classList.add('shake');
    }
    var hint = document.getElementById('tosNeedTick');
    if (hint) hint.hidden = false;
}

window._acceptTos = async function() {
    var check = document.getElementById('tosModalCheck');
    if (!check || !check.checked) { _tosNeedsTick(); return; }
    var btn = document.getElementById('tosAcceptBtn');
    if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }
    try {
        if (currentUser && auth.currentUser && !auth.currentUser.isAnonymous) {
            await db.collection('users').doc(auth.currentUser.uid).set({
                tosVersion: TOS_CURRENT_VERSION,
                tosAcceptedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            currentUser.tosVersion = TOS_CURRENT_VERSION;
            // Update local cache
            try {
                var cached = JSON.parse(localStorage.getItem('btc_profile_cache') || 'null');
                if (cached && cached.data) { cached.data.tosVersion = TOS_CURRENT_VERSION; localStorage.setItem('btc_profile_cache', JSON.stringify(cached)); }
            } catch(e) {}
        }
        var m = document.getElementById('tosModal');
        if (m) m.classList.remove('open');
        flushAfterTos();
        if (typeof showToast === 'function') showToast('✅ Terms accepted. Welcome back!');
    } catch(e) {
        if (btn) { btn.textContent = 'Accept & Continue →'; btn.disabled = false; }
        if (typeof showToast === 'function') showToast('Error saving. Please try again.');
        console.error('[TOS] Accept error:', e);
    }
};

function renderAccountGoogleLinkButton() {
    var host = document.getElementById('accountGsiButtonHost');
    var fallback = document.getElementById('accountGoogleLinkFallback');
    if (!host || !gisApiReady()) return;
    ensureGoogleIdentityInit();
    host.innerHTML = '';
    host.style.display = 'block';
    try {
        google.accounts.id.renderButton(host, {
            type: 'standard',
            theme: 'filled_black',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: googleButtonWidth(host),
            click_listener: function() { window._accountLinkGoogle = true; }
        });
    } catch (e) {
        host.style.display = 'none';
        if (fallback) fallback.style.display = 'block';
        return;
    }
    if (!host.childNodes.length) {
        host.style.display = 'none';
        if (fallback) fallback.style.display = 'block';
        return;
    }
    if (fallback) fallback.style.display = 'none';
}

function mountAccountGoogleLinkButton() {
    var host = document.getElementById('accountGsiButtonHost');
    var fallback = document.getElementById('accountGoogleLinkFallback');
    if (!host) return;
    if (typeof isInAppBrowser === 'function' && isInAppBrowser()) {
        host.style.display = 'none';
        if (fallback) fallback.style.display = 'block';
        return;
    }
    if (!gisApiReady()) {
        if (fallback) fallback.style.display = 'block';
        loadGoogleIdentityScript().then(function() {
            renderAccountGoogleLinkButton();
        }).catch(function() {
            host.style.display = 'none';
            if (fallback) fallback.style.display = 'block';
        });
        return;
    }
    renderAccountGoogleLinkButton();
}

window.sendAccountLinkEmail = async function() {
    if (accountLinkTotpPending()) {
        if (typeof showToast === 'function') showToast(accountLinkTotpHoldMessage());
        return;
    }
    var input = document.getElementById('accountLinkEmail');
    var status = document.getElementById('accountLinkEmailStatus');
    var user = auth && auth.currentUser;
    var profile = (typeof currentUser !== 'undefined') ? currentUser : null;
    if (!user || !accountCanLinkSignIn(user, profile)) {
        if (typeof showToast === 'function') showToast('This account already has a sign-in method.');
        return;
    }
    var email = input ? String(input.value || '').trim() : '';
    if (!email || email.indexOf('@') < 1 || email.indexOf('.') < 0 || email.length > 100) {
        if (status) status.textContent = 'Enter the email you want to link.';
        if (typeof showToast === 'function') showToast('Enter the email you want to link.');
        return;
    }
    if (input) input.disabled = true;
    if (status) status.textContent = 'Sending a link…';
    writeAccountLinkIntent(user, email);
    var sent = false;
    try { sent = await sendMagicLink(email); } catch (e) { sent = false; }
    if (!sent) {
        clearAccountLinkIntent();
        if (input) input.disabled = false;
        if (status) status.textContent = 'Could not send the link. Try again.';
        if (typeof showToast === 'function') showToast('Could not send the link. Try again.');
        return;
    }
    if (status) status.textContent = 'Check your email and tap the link on this browser. It links this account and does not open a different one.';
    if (typeof showToast === 'function') showToast('Check your email and open the link in this browser.');
};

window.linkGoogleFromAccount = async function() {
    if (accountLinkTotpPending()) {
        if (typeof showToast === 'function') showToast(accountLinkTotpHoldMessage());
        return;
    }
    var user = auth && auth.currentUser;
    var profile = (typeof currentUser !== 'undefined') ? currentUser : null;
    if (!user || !accountCanLinkSignIn(user, profile)) {
        if (typeof showToast === 'function') showToast('This account already has a sign-in method.');
        return;
    }
    if (typeof isInAppBrowser === 'function' && isInAppBrowser()) {
        if (typeof showToast === 'function') showToast('Open this page in your browser to link Google.');
        return;
    }
    var host = document.getElementById('accountGsiButtonHost');
    if (host && host.childNodes.length && host.style.display !== 'none') {
        if (typeof showToast === 'function') showToast('Use the Google button above.');
        return;
    }
    var linkedUid = user.uid;
    var wasGuest = !!user.isAnonymous;
    try {
        var provider = new firebase.auth.GoogleAuthProvider();
        await user.linkWithPopup(provider);
    } catch (e) {
        var code = e && e.code;
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || code === 'auth/user-cancelled') return;
        if (code === 'auth/multi-factor-auth-required') {
            if (surfaceMfaRequired(e)) return;
        }
        var conflict = accountLinkConflictMessage(code);
        if (conflict) {
            if (typeof showToast === 'function') showToast(conflict);
            return;
        }
        if (typeof showToast === 'function') showToast('Could not link Google. You are still on this account.');
        return;
    }
    if (!auth.currentUser || auth.currentUser.uid !== linkedUid) {
        if (typeof showToast === 'function') showToast(accountLinkConflictMessage('auth/credential-already-in-use'));
        return;
    }
    try { localStorage.removeItem('btc_guest_link'); } catch (e1) {}
    if (wasGuest && typeof _handleSignInResultGlobal === 'function') {
        await _handleSignInResultGlobal(auth.currentUser, null, null);
    }
    if (typeof showToast === 'function') showToast('Google linked. You can use it to sign in next time.');
    refreshAccountSignInCard();
};

function presentSignOutLinkWarning(warning) {
    if (!warning || !warning.message) return;
    var existing = document.getElementById('signOutLinkWarning');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'signOutLinkWarning';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:800000;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = '<div role="dialog" aria-modal="true" aria-labelledby="signOutLinkWarningTitle" style="background:var(--bg-side,#1a1a2e);border:1px solid var(--border,#333);border-radius:16px;padding:24px;max-width:380px;width:100%;text-align:center;box-shadow:0 16px 40px rgba(0,0,0,0.35);">' +
        '<div style="font-size:2rem;margin-bottom:8px;">⚠️</div>' +
        '<div id="signOutLinkWarningTitle" style="color:var(--heading,#fff);font-weight:800;font-size:1.05rem;margin-bottom:8px;">Sign out?</div>' +
        '<div style="color:var(--text,#fff);font-size:0.9rem;line-height:1.5;margin-bottom:16px;">' + accountLinkEscape(warning.message) + '</div>' +
        '<button type="button" onclick="goToSignInMethods()" style="width:100%;padding:12px;background:var(--accent,#f7931a);color:#fff;border:none;border-radius:10px;font-weight:700;font-size:0.9rem;cursor:pointer;font-family:inherit;margin-bottom:8px;">Link a sign-in</button>' +
        '<button type="button" onclick="signOutUser(true)" style="width:100%;padding:10px;background:none;border:1px solid #ef4444;border-radius:10px;color:#ef4444;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">Sign out anyway</button>' +
        '</div>';
    document.body.appendChild(overlay);
}

function goToSignInMethods() {
    var warn = document.getElementById('signOutLinkWarning');
    if (warn) warn.remove();
    if (typeof showSettingsPage === 'function') showSettingsPage('account');
    setTimeout(function() {
        var card = document.getElementById('signInMethodsCard');
        if (card && card.scrollIntoView) {
            try { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { card.scrollIntoView(true); }
        }
    }, 80);
}
window.goToSignInMethods = goToSignInMethods;

async function signOutUser(force) {
    if (force !== true) {
        var warning = signOutWarningForAccount(
            (typeof auth !== 'undefined' && auth) ? auth.currentUser : null,
            (typeof currentUser !== 'undefined') ? currentUser : null
        );
        if (warning) {
            presentSignOutLinkWarning(warning);
            return;
        }
    }
    var warnEl = document.getElementById('signOutLinkWarning');
    if (warnEl) warnEl.remove();
    // Drop this device's push token before the session ends. Otherwise the
    // next person on a shared phone keeps receiving the previous account's
    // notifications, including DM previews.
    var pushUid = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser.uid : '';
    var pushDevice = '';
    try { pushDevice = localStorage.getItem('btc_push_device') || ''; } catch (e) {}
    try {
        if (pushUid && /^[A-Za-z0-9_-]{8,64}$/.test(pushDevice) && typeof db !== 'undefined') {
            await db.collection('push_tokens').doc(pushUid).collection('devices').doc(pushDevice).delete();
        }
    } catch (e) {}
    try {
        if (typeof firebase !== 'undefined' && firebase.messaging) {
            await firebase.messaging().deleteToken();
        }
    } catch (e) {}
    var mfaDeviceToken = '';
    try { if (pushUid) mfaDeviceToken = localStorage.getItem('btc_mfa_device_' + pushUid) || ''; } catch (e) {}
    if (mfaDeviceToken && typeof firebase !== 'undefined' && firebase.functions) {
        try {
            await firebase.functions().httpsCallable('totpRevokeDevice')({ deviceToken: mfaDeviceToken });
        } catch (e) {}
    }
    // [AUDIT FIX M5] Clear caches on sign-out for shared device security
    if ('caches' in window) {
        try { var keys = await caches.keys(); keys.forEach(function(k) { caches.delete(k); }); } catch(e) {}
    }
    clearUserLocalStorage();
    await auth.signOut();
    location.reload();
}

// --- RESTORING DELETED GLOBAL HANDLERS ---
window.hideUsernamePrompt = function() {
    const modal = document.getElementById('usernameModal');
    if (modal) {
        modal.classList.remove('open');
        modal.style.zIndex = '';
    }
    if (typeof flushAfterTos === 'function' && !tosBlocking()) {
        if (!chromeBlocksToasts() && typeof _toastQueue !== 'undefined' && _toastQueue.length && typeof window._showToastNow === 'function') {
            window._showToastNow(_toastQueue.shift());
        }
    }
    // Show guide return button if user navigated from the guide
    if (sessionStorage.getItem('btc_return_guide') === '1' && typeof showGuideReturnBtn === 'function') {
        showGuideReturnBtn();
    }
    // One-shot callback - used e.g. by Charity tab to return after faction selection
    if (typeof window._onSettingsClose === 'function') {
        var cb = window._onSettingsClose;
        window._onSettingsClose = null;
        setTimeout(cb, 150);
    }
};

// Returns true if the given username (case-insensitive) is already taken by someone other than excludeUid.
async function isUsernameTaken(username, excludeUid) {
    try {
        var lowerName = username.toLowerCase();
        // Primary check: username_lower field (indexed, fast)
        var snap = await db.collection('public_profiles')
            .where('username_lower', '==', lowerName)
            .limit(5)
            .get();
        // Also check case-insensitive against the username field for legacy users
        // who were created before username_lower was added
        var snapOrig = await db.collection('public_profiles')
            .where('username', '==', username)
            .limit(5)
            .get();
        // Merge both result sets (de-dupe by doc id)
        var allDocs = {};
        snap.docs.forEach(function(d) { allDocs[d.id] = d; });
        snapOrig.docs.forEach(function(d) { allDocs[d.id] = d; });
        var ids = Object.keys(allDocs);
        if (ids.length === 0) return false;
        // Allow if the only match is the requesting user themselves
        var others = ids.filter(function(id) { return id !== excludeUid; });
        if (others.length === 0) return false;
        // Backfill username_lower for any legacy doc that's missing it
        others.forEach(function(id) {
            var d = allDocs[id].data();
            if (!d.username_lower && d.username) {
                db.collection('users').doc(id)
                  .update({ username_lower: d.username.toLowerCase() })
                  .catch(function() {});
            }
        });
        return true;
    } catch(e) {
        console.warn('[isUsernameTaken] query failed:', e);
        return false; // fail open - don't block signup on a Firestore hiccup
    }
}

document.addEventListener('click', function(ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    if (!t.closest('#signupStartBtn')) return;
    var check = document.getElementById('signupTosCheck');
    if (!document.getElementById('usernameInput') || !check || check.checked) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    var row = document.getElementById('signupConsentRow');
    if (row) {
        row.classList.remove('shake');
        void row.offsetWidth;
        row.classList.add('shake');
    }
    var hint = document.getElementById('signupNeedTick');
    if (hint) hint.hidden = false;
}, true);

window.submitUsername = async function() {
    try {
    var signupCheck = document.getElementById('signupTosCheck');
    var signupRow = document.getElementById('signupConsentRow');
    if (document.getElementById('usernameInput') && signupCheck && !signupCheck.checked) {
        if (signupRow) {
            signupRow.classList.remove('shake');
            void signupRow.offsetWidth;
            signupRow.classList.add('shake');
        }
        var signupHint = document.getElementById('signupNeedTick');
        if (signupHint) signupHint.hidden = false;
        return;
    }
    // Check if this is the INITIAL SIGNUP modal or the settings username change
    var input = document.getElementById('usernameInput') || document.getElementById('newUsername');
    if (!input) { console.error('[submitUsername] No input found'); return; }
    var name = input.value.trim();
    if (!name) { showToast('Please enter a username!'); return; }
    if (name.length < 3) { showToast('Username must be at least 3 characters'); return; }
    if (name.length > 20) { showToast('Username must be 20 characters or less'); return; }
    if (/[\s\u180E\u200B-\u200D\u2060\uFEFF]/.test(name)) { showToast('⚠️ Usernames cannot contain spaces. Try ' + name.replace(/[\s\u180E\u200B-\u200D\u2060\uFEFF]+/g, '_') + ' instead.'); return; }
    if (/[^A-Za-z0-9_\-.]/g.test(name)) { showToast('⚠️ Username can only contain English letters, numbers, underscores, hyphens, and dots.'); return; }
    if (containsProfanity(name)) { showToast('⚠️ That username is not allowed.'); return; }

    // INITIAL SIGNUP (usernameInput exists = signup modal)
    if (document.getElementById('usernameInput')) {
        // Turnstile verification
        var tsToken = '';
        var tsEl = document.querySelector('#turnstileWidget [name="cf-turnstile-response"]');
        if (tsEl) tsToken = tsEl.value || '';
        if (!tsToken) {
            // Widget may not have rendered yet (slow connection) - check window.turnstile
            showToast('⏳ Security check pending, please try again in a moment.');
            if (window.turnstile) window.turnstile.reset('#turnstileWidget');
            return;
        }
        window._signupTurnstileToken = tsToken;

        var emailInput = document.getElementById('emailInput');
        var email = emailInput ? emailInput.value.trim() : '';
        var signupCountryEl = document.getElementById('signupCountryInput');
        var signupCountry = signupCountryEl ? signupCountryEl.value.trim().substring(0, 60) : '';
        // Validate country against the known list
        if (signupCountry && window._countryList && window._countryList.indexOf(signupCountry) === -1) {
            if (typeof showToast === 'function') showToast('\u26a0\ufe0f Please select a valid country from the dropdown list.');
            signupCountryEl.focus();
            return;
        }
        var enteredGiveaway = false;
        var lnAddressEl = document.getElementById('signupLnAddress');
        var lnAddress = lnAddressEl ? normalizeClientLn(lnAddressEl.value) : '';
        // Basic Lightning address validation (user@domain format)
        if (lnAddress && !clientLnValid(lnAddress)) {
            if (lnAddressEl) { lnAddressEl.style.borderColor = '#ef4444'; lnAddressEl.focus(); }
            showToast('⚡ Please enter a valid Lightning address (e.g. you@wallet.com) or leave it blank.');
            return;
        }
        if (lnAddress) {
            var confirmedSignup = await openWithdrawalAddress({ mode: 'signup', address: lnAddress, start: 'confirm' });
            if (!confirmedSignup) return;
            lnAddress = confirmedSignup;
            localStorage.setItem('btc_pending_ln_address', lnAddress);
        }

        if (email) {
            // Email provided - send magic link for verification
            var sent = await sendMagicLink(email);
            if (sent) {
                localStorage.setItem('btc_pending_username', name);
                localStorage.setItem('btc_pending_email', email);
                showToast('📧 Check your email for a verification link!');
                hideUsernamePrompt();
                // Also create the anonymous user immediately so they can start using the site
                await createUser(name, email, enteredGiveaway, lnAddress, signupCountry);
                return;
            }
        }

        // No email - create user directly (anonymous)
        await createUser(name, email, enteredGiveaway, lnAddress, signupCountry);
        return;
    }

    // SETTINGS USERNAME CHANGE (newUsername exists = settings page)
    if (!currentUser || currentUser._isLocal) { showToast('Sign in first to change username'); return; }
    var status = document.getElementById('usernameStatus');
    if (status) status.innerHTML = 'Checking...';
    var _settingsTaken = await isUsernameTaken(name, currentUser.uid);
    if (_settingsTaken) {
        if (status) status.innerHTML = '❌ Username taken';
        showToast('⚠️ That username is already taken. Please choose another.');
        return;
    }
    if (status) status.innerHTML = 'Saving...';
    try {
        await applyServerUsername(name);
        updateAuthButton();
        updateRankUI();
        if (status) status.textContent = 'Username updated';
        showToast('Username updated');
    } catch(e) {
        if (status) status.innerHTML = '❌ Error saving';
        showToast('Error updating username. Try again.');
    }
    } catch(topErr) {
        console.error('[submitUsername] Uncaught error:', topErr);
        if (typeof showToast === 'function') showToast('Error: ' + (topErr.message || 'Unknown error. Please try again.'));
    }
};

window.exportUserData = function() {
    if (!currentUser) return;
    const data = JSON.stringify(currentUser, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bitcoin_archive_user_data.json';
    link.click();
};


// ---- Prefetch BTC price immediately (don't wait for auth) ----
if (!localStorage.getItem('btc_last_price') || Date.now() - parseInt(localStorage.getItem('btc_price_ts') || '0') > 300000) {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd').then(function(r){return r.json()}).then(function(d){
        if(d&&d.bitcoin&&d.bitcoin.usd){localStorage.setItem('btc_last_price',d.bitcoin.usd.toString());localStorage.setItem('btc_price_ts',Date.now().toString());}
    }).catch(function(){});
}
if (!localStorage.getItem('btc_last_height') || Date.now() - parseInt(localStorage.getItem('btc_height_ts') || '0') > 300000) {
    fetch('https://mempool.space/api/blocks/tip/height').then(function(r){return r.text()}).then(function(h){
        var height=parseInt(h);if(height){localStorage.setItem('btc_last_height',height.toString());localStorage.setItem('btc_height_ts',Date.now().toString());}
    }).catch(function(){});
}

var LN_PERMANENT_WARNING = 'This will be your permanent Lightning Address for withdrawals. If you ever need to change it, contact support at info.603btc@gmail.com.';
var LN_READONLY_NOTE = 'This is your permanent Lightning Address for withdrawals. If you ever need to change it, contact support at info.603btc@gmail.com.';
var LN_DOUBLE_CHECK = 'Please double-check this is written exactly right';
var LN_SET_TITLE = 'Set your withdrawal Lightning Address';
var LN_TURNSTILE_SITEKEY = '0x4AAAAAAD-ivgpRkbXpgz86';

function _savedWithdrawalLn() {
    var u = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : null;
    if (!u) return '';
    return normalizeClientLn(u.lightningAddress || u.lightning || u.lnAddress || '');
}

function _withdrawalLnEligible() {
    var saved = _savedWithdrawalLn();
    if (!saved || !clientLnValid(saved)) return true;
    try { if (sessionStorage.getItem('btc_ln_needs_reset') === '1') return true; } catch (e) {}
    return false;
}

function _lnBtn(label, primary) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.style.cssText = primary
        ? 'flex:1;padding:12px;background:#f97316;color:#fff;border:none;border-radius:12px;font-size:0.92rem;font-weight:800;cursor:pointer;font-family:inherit;'
        : 'flex:1;padding:12px;background:transparent;color:#e2e8f0;border:1px solid #1e293b;border-radius:12px;font-size:0.92rem;font-weight:700;cursor:pointer;font-family:inherit;';
    return btn;
}

function openWithdrawalAddress(opts) {
    opts = opts || {};
    var mode = opts.mode || 'reset';
    var start = opts.start || (mode === 'readonly' ? 'readonly' : 'input');
    return new Promise(function (resolve) {
        var old = document.getElementById('lnAddrModal');
        if (old) old.remove();
        var settled = false;
        function finish(value) {
            if (settled) return;
            settled = true;
            var el = document.getElementById('lnAddrModal');
            if (el) el.remove();
            resolve(value || null);
        }

        var overlay = document.createElement('div');
        overlay.id = 'lnAddrModal';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(2,6,23,0.78);z-index:620000;display:flex;align-items:center;justify-content:center;padding:16px;';
        overlay.addEventListener('click', function (e) { if (e.target === overlay) finish(null); });

        var panel = document.createElement('div');
        panel.style.cssText = 'background:#0f172a;border:1px solid #1e293b;border-radius:16px;padding:22px;max-width:420px;width:100%;color:#e2e8f0;box-sizing:border-box;';

        var title = document.createElement('div');
        title.id = 'lnAddrTitle';
        title.textContent = mode === 'readonly' ? 'Withdrawal Lightning Address' : LN_SET_TITLE;
        title.style.cssText = 'font-size:1.05rem;font-weight:800;color:#fff;margin-bottom:12px;text-align:center;';
        panel.appendChild(title);

        var errorEl = document.createElement('div');
        errorEl.id = 'lnAddrError';
        errorEl.style.cssText = 'display:none;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.35);border-radius:8px;padding:10px;margin-bottom:12px;font-size:0.78rem;color:#fca5a5;text-align:center;';
        function paintLnError(msg) {
            errorEl.textContent = msg || '';
            errorEl.style.display = msg ? 'block' : 'none';
        }
        panel.appendChild(errorEl);

        var stepInput = document.createElement('div');
        stepInput.id = 'lnAddrStepInput';
        var inputLabel = document.createElement('label');
        inputLabel.textContent = 'Lightning Address';
        inputLabel.style.cssText = 'display:block;font-size:0.78rem;color:#94a3b8;margin-bottom:6px;';
        var input = document.createElement('input');
        input.id = 'lnAddrInput';
        input.type = 'text';
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('autocapitalize', 'off');
        input.setAttribute('spellcheck', 'false');
        input.placeholder = 'you@walletofsatoshi.com';
        input.value = opts.address ? String(opts.address) : '';
        input.style.cssText = 'width:100%;padding:12px;background:#020617;border:1px solid #1e293b;border-radius:10px;color:#e2e8f0;font-size:1rem;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;outline:none;box-sizing:border-box;';
        var nextRow = document.createElement('div');
        nextRow.style.cssText = 'display:flex;gap:8px;margin-top:14px;';
        var cancelBtn = _lnBtn('Cancel', false);
        var nextBtn = _lnBtn('Continue', true);
        nextRow.appendChild(cancelBtn);
        nextRow.appendChild(nextBtn);
        stepInput.appendChild(inputLabel);
        stepInput.appendChild(input);
        stepInput.appendChild(nextRow);

        var stepConfirm = document.createElement('div');
        stepConfirm.id = 'lnAddrStepConfirm';
        var addrEl = document.createElement('div');
        addrEl.id = 'lnAddrConfirmText';
        addrEl.style.cssText = 'font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:1.35rem;font-weight:700;color:#fff;text-align:center;word-break:break-all;line-height:1.35;margin:8px 0 12px;';
        var check = document.createElement('p');
        check.textContent = LN_DOUBLE_CHECK;
        check.style.cssText = 'margin:0 0 8px;font-size:0.95rem;font-weight:700;text-align:center;color:#fff;';
        var warn = document.createElement('p');
        warn.textContent = LN_PERMANENT_WARNING;
        warn.style.cssText = 'margin:0 0 14px;font-size:0.8rem;line-height:1.45;color:#cbd5e1;text-align:center;';
        var checkRow = document.createElement('label');
        checkRow.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:0.85rem;margin-bottom:12px;cursor:pointer;';
        var box = document.createElement('input');
        box.type = 'checkbox';
        box.id = 'lnAddrUnderstand';
        var boxText = document.createElement('span');
        boxText.textContent = 'I understand';
        checkRow.appendChild(box);
        checkRow.appendChild(boxText);
        var ts = document.createElement('div');
        ts.id = 'lnAddrTurnstile';
        ts.style.cssText = 'margin-bottom:12px;';
        var confirmRow = document.createElement('div');
        confirmRow.style.cssText = 'display:flex;gap:8px;';
        var backBtn = _lnBtn('Back / Edit', false);
        var confirmBtn = _lnBtn('Confirm', true);
        confirmBtn.id = 'lnAddrConfirmBtn';
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.55';
        confirmRow.appendChild(backBtn);
        confirmRow.appendChild(confirmBtn);
        stepConfirm.appendChild(addrEl);
        stepConfirm.appendChild(check);
        stepConfirm.appendChild(warn);
        stepConfirm.appendChild(checkRow);
        stepConfirm.appendChild(ts);
        stepConfirm.appendChild(confirmRow);

        var stepRead = document.createElement('div');
        stepRead.id = 'lnAddrStepReadonly';
        var readAddr = document.createElement('div');
        readAddr.id = 'lnAddrReadonlyText';
        readAddr.style.cssText = addrEl.style.cssText;
        var readNote = document.createElement('p');
        readNote.textContent = LN_READONLY_NOTE;
        readNote.style.cssText = 'margin:0 0 14px;font-size:0.8rem;line-height:1.45;color:#cbd5e1;text-align:center;';
        var closeBtn = _lnBtn('Close', true);
        stepRead.appendChild(readAddr);
        stepRead.appendChild(readNote);
        stepRead.appendChild(closeBtn);

        panel.appendChild(stepInput);
        panel.appendChild(stepConfirm);
        panel.appendChild(stepRead);
        overlay.appendChild(panel);

        var chosen = normalizeClientLn(opts.address || '');
        var widgetRendered = false;

        function paintLnStep(name) {
            stepInput.style.display = name === 'input' ? 'block' : 'none';
            stepConfirm.style.display = name === 'confirm' ? 'block' : 'none';
            stepRead.style.display = name === 'readonly' ? 'block' : 'none';
            title.textContent = name === 'readonly' ? 'Withdrawal Lightning Address' : LN_SET_TITLE;
            if (name === 'confirm' && mode === 'reset' && !widgetRendered && window.turnstile) {
                widgetRendered = true;
                try {
                    window.turnstile.render('#lnAddrTurnstile', { sitekey: LN_TURNSTILE_SITEKEY, theme: 'dark', size: 'flexible' });
                } catch (e) {}
            }
            if (name === 'confirm' && mode !== 'reset') ts.style.display = 'none';
        }

        function goConfirm(addr) {
            chosen = addr;
            addrEl.textContent = addr;
            box.checked = false;
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = '0.55';
            paintLnError('');
            paintLnStep('confirm');
        }

        cancelBtn.addEventListener('click', function () { finish(null); });
        closeBtn.addEventListener('click', function () { finish(null); });
        nextBtn.addEventListener('click', function () {
            var addr = normalizeClientLn(input.value);
            if (!clientLnValid(addr)) {
                paintLnError('Enter a valid Lightning Address (e.g. you@walletofsatoshi.com)');
                return;
            }
            paintLnError('');
            goConfirm(addr);
        });
        backBtn.addEventListener('click', function () {
            input.value = chosen || input.value;
            paintLnStep('input');
        });
        box.addEventListener('change', function () {
            confirmBtn.disabled = !box.checked;
            confirmBtn.style.opacity = box.checked ? '1' : '0.55';
        });
        confirmBtn.addEventListener('click', function () {
            if (!box.checked || !chosen) return;
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Saving…';
            var pending = Promise.resolve({ ok: true, address: chosen });
            if (typeof opts.onConfirm === 'function') pending = Promise.resolve(opts.onConfirm(chosen));
            else if (mode === 'reset') pending = _callResetLightning(chosen);
            pending.then(function (result) {
                result = result || { ok: true, address: chosen };
                if (result.ok === false) {
                    paintLnError(result.error || 'Could not resolve Lightning Address. Check the address and try again.');
                    confirmBtn.textContent = 'Confirm';
                    confirmBtn.disabled = !box.checked;
                    confirmBtn.style.opacity = box.checked ? '1' : '0.55';
                    input.value = chosen;
                    paintLnStep('input');
                    return;
                }
                finish(result.address || chosen);
            }).catch(function (e) {
                paintLnError((e && e.message) ? e.message : 'Could not resolve Lightning Address. Check the address and try again.');
                confirmBtn.textContent = 'Confirm';
                confirmBtn.disabled = !box.checked;
                input.value = chosen;
                paintLnStep('input');
            });
        });

        if (mode === 'readonly' || start === 'readonly') {
            readAddr.textContent = normalizeClientLn(opts.address || _savedWithdrawalLn());
            paintLnStep('readonly');
        } else if (start === 'confirm' && clientLnValid(normalizeClientLn(opts.address || ''))) {
            goConfirm(normalizeClientLn(opts.address));
        } else {
            paintLnStep('input');
        }

        document.body.appendChild(overlay);
        if (stepInput.style.display !== 'none') {
            setTimeout(function () { try { input.focus(); } catch (e) {} }, 30);
        }
    });
}

function _callResetLightning(addr, proofId) {
    var token = '';
    var tsEl = document.querySelector('#lnAddrTurnstile [name="cf-turnstile-response"]');
    if (tsEl) token = tsEl.value || '';
    if (!token) return Promise.resolve({ ok: false, error: 'Security check pending — please wait a moment and try again.', code: 'turnstile' });
    var appCheckReady;
    try {
        appCheckReady = firebase.appCheck().getToken(false);
    } catch (e) {
        return Promise.resolve({ ok: false, error: 'Security check failed. Refresh the page and try again.' });
    }
    var proofReady = Promise.resolve(proofId || '');
    if (!proofId && mfaNeedsFreshCode()) proofReady = window._showFreshStepUp('resetLightningAddress');
    return proofReady.then(function (proof) {
        if (proof === null) return { ok: false, error: 'Enter a fresh authenticator code to change your Lightning Address.', code: 'fresh' };
        return appCheckReady.then(function () {
            var fn = firebase.functions().httpsCallable('resetLightningAddressOnce');
            var body = { lightningAddress: addr, turnstileToken: token };
            if (proof) body.freshProofId = proof;
            return fn(body);
        });
    }).then(function (res) {
        if (res && res.ok === false && res.code === 'fresh') return res;
        var data = res && res.data ? res.data : {};
        if (!data.ok) return { ok: false, error: data.error || 'Could not resolve Lightning Address. Check the address and try again.', code: data.code || 'address_unresolved' };
        if (typeof currentUser !== 'undefined' && currentUser) {
            currentUser.lightning = data.address || addr;
            currentUser.lightningAddress = data.address || addr;
        }
        try { sessionStorage.removeItem('btc_ln_needs_reset'); } catch (e) {}
        if (typeof showToast === 'function') showToast('Lightning Address saved.');
        return { ok: true, address: data.address || addr };
    }).catch(function (e) {
        var msg = (e && e.message) ? e.message : 'Could not resolve Lightning Address. Check the address and try again.';
        if (!proofId && msg.indexOf('fresh authenticator') !== -1 && typeof window._showFreshStepUp === 'function') {
            return window._showFreshStepUp('resetLightningAddress').then(function (proof) {
                if (!proof) return { ok: false, error: msg, code: 'fresh' };
                return _callResetLightning(addr, proof);
            });
        }
        return { ok: false, error: msg, code: 'address_unresolved' };
    });
}

function showWithdrawalAddressReadonly(addr) {
    return openWithdrawalAddress({ mode: 'readonly', address: addr || _savedWithdrawalLn(), start: 'readonly' });
}

window.openWithdrawalAddress = openWithdrawalAddress;
window.showWithdrawalAddressReadonly = showWithdrawalAddressReadonly;
window._withdrawalLnEligible = _withdrawalLnEligible;


// ---- Init Firebase & Auth ----
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRanking);
} else {
    initRanking();
}

// ---- Leaderboard pre-fetch: warm cache ~5s after page load so open is instant ----
(function() {
    var _prefetched = false;
    function _prefetchLeaderboard() {
        if (_prefetched) return;
        if (!db) return;
        var now = Date.now();
        var useCache = window._lbCache && window._lbCacheTime && (now - window._lbCacheTime < 600000);
        if (useCache) { _prefetched = true; return; }
        _prefetched = true;
        db.collection('public_profiles').orderBy('points', 'desc').limit(150).get().then(function(snap) {
            var users = [];
            snap.forEach(function(doc) {
                var d = doc.data();
                if ((d.points || 0) > 0 && !d.ghostMode) {
                    users.push(Object.assign({ id: doc.id }, d));
                }
            });
            window._lbCache = users;
            window._lbCacheTime = Date.now();
        }).catch(function() { _prefetched = false; });
    }
    // Fire after 5s — well after Firebase init, without blocking critical path
    setTimeout(_prefetchLeaderboard, 5000);
    window._prefetchLeaderboard = _prefetchLeaderboard;
})();

// ---- OPENCLAW EXPORTS ----
if (typeof toggleLeaderboard !== "undefined") window.toggleLeaderboard = toggleLeaderboard;
if (typeof showUsernamePrompt !== "undefined") window.showUsernamePrompt = showUsernamePrompt;
// ---- Settings helper stubs ----
window.setDisplayBadge = function(badgeId) {
    if (!currentUser) return;
    currentUser.displayBadge = badgeId || '';
    // Save to Firestore
    if (typeof db !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) {
        db.collection('users').doc(auth.currentUser.uid).update({ displayBadge: badgeId || '' }).catch(function() {});
    }
    // Save to localStorage as backup
    localStorage.setItem('btc_display_badge', badgeId || '');
    // Update all UI that shows the badge
    updateRankUI();
    updateAuthButton();
    showToast(badgeId ? '🏅 Display badge updated!' : '🏅 Using default rank emoji');
    // Refresh just the badge picker panel in-place - no full page re-render
    var _bp = document.getElementById('badgePickerPanel');
    if (_bp) {
        // Re-render badge options with updated selection
        var _lvl = (typeof getLevel === 'function') ? getLevel((currentUser && currentUser.points) || 0) : { emoji: '🌱', name: 'Newbie' };
        var _allE = [];
        if (typeof earnedBadges !== 'undefined' && typeof BADGE_DEFS !== 'undefined') {
            BADGE_DEFS.forEach(function(bd) { if (earnedBadges.has(bd.id)) _allE.push({ id: bd.id, emoji: bd.emoji, name: bd.name }); });
        }
        var _earnedHidden = JSON.parse(localStorage.getItem('btc_hidden_badges') || '[]');
        if (typeof HIDDEN_BADGES !== 'undefined') HIDDEN_BADGES.forEach(function(bd) { if (_earnedHidden.indexOf(bd.id) !== -1) _allE.push({ id: bd.id, emoji: bd.hidden ? (bd.revealEmoji || bd.emoji) : bd.emoji, name: bd.hidden ? (bd.revealName || bd.name) : bd.name }); });
        var _chosen = badgeId || '';
        var _ph = '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);"><div style="color:var(--text-muted);font-size:0.75rem;margin-bottom:10px;">Choose a badge to show next to your name instead of your rank emoji.</div><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">';
        _ph += '<div onclick="setDisplayBadge(\'\')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;border:1px solid ' + (!_chosen ? 'var(--accent)' : 'var(--border)') + ';background:' + (!_chosen ? 'rgba(247,147,26,0.1)' : 'var(--card-bg)') + ';cursor:pointer;margin-bottom:6px;transition:0.2s;"><span style="font-size:1.3rem;">' + _lvl.emoji + '</span><div><div style="color:var(--text);font-size:0.85rem;font-weight:600;">' + _lvl.name + ' (Default)</div><div style="color:var(--text-faint);font-size:0.7rem;">Your current rank emoji</div></div>' + (!_chosen ? '<span style="margin-left:auto;color:var(--accent);font-size:0.8rem;font-weight:700;">✓</span>' : '') + '</div>';
        _allE.forEach(function(bd) {
            var _ic = _chosen === bd.id;
            _ph += '<div onclick="setDisplayBadge(\'' + bd.id + '\')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;border:1px solid ' + (_ic ? 'var(--accent)' : 'var(--border)') + ';background:' + (_ic ? 'rgba(247,147,26,0.1)' : 'var(--card-bg)') + ';cursor:pointer;margin-bottom:6px;transition:0.2s;"><span style="font-size:1.3rem;">' + bd.emoji + '</span><div><div style="color:var(--text);font-size:0.85rem;font-weight:600;">' + bd.name + '</div></div>' + (_ic ? '<span style="margin-left:auto;color:var(--accent);font-size:0.8rem;font-weight:700;">✓</span>' : '') + '</div>';
        });
        _ph += '</div></div>';
        _bp.innerHTML = _ph;
        _bp.style.display = 'block';
    }
};
if (typeof changeUsername === 'undefined') window.changeUsername = async function(name) {
    // Read from input if no name passed
    if (!name) { var inp = document.getElementById('newUsername'); if (inp) name = inp.value.trim(); }
    if (name && /[\s\u180E\u200B-\u200D\u2060\uFEFF]/.test(name)) { showToast('⚠️ Usernames cannot contain spaces. Try ' + name.replace(/[\s\u180E\u200B-\u200D\u2060\uFEFF]+/g, '_') + ' instead.'); return; }
    // Strip non-ASCII (prevent Unicode/homoglyph bypass)
    if (name) name = name.replace(/[^\x20-\x7E]/g, '').replace(/[\\'"<>]/g, '').trim();
    if (!name || name.length < 3) { showToast('Username must be at least 3 characters'); return; }
    if (name.length > 20) { showToast('Username max 20 characters'); return; }
    if (containsProfanity(name)) { showToast('⚠️ That username is not allowed.'); return; }
    if (typeof isCleanText === 'function' && !isCleanText(name)) { showToast('Username contains inappropriate language'); return; }
    if (auth && auth.currentUser && db) {
        try { await applyServerUsername(name); }
        catch (e) { showToast(e.message || 'Could not save that username.'); return; }
    } else {
        showToast('Sign in before choosing a username.');
        return;
    }
    updateAuthButton(); updateRankUI();
    showToast('Username updated');
    // Update the "Current username" label and button to confirm
    var curLabel = document.querySelector('[id="currentUsernameLabel"]');
    if (!curLabel) {
        // Find the label by content
        document.querySelectorAll('div, span').forEach(function(el) {
            if (el.textContent.indexOf('Current username:') !== -1 && !curLabel) curLabel = el;
        });
    }
    if (curLabel) curLabel.innerHTML = 'Current username: <strong style="color:var(--accent);">' + (typeof escapeHtml === 'function' ? escapeHtml(name) : name) + '</strong>';
    var btn = document.querySelector('button[onclick*="changeUsername"]');
    if (btn) {
        btn.textContent = '✅ Saved!';
        btn.style.background = '#22c55e';
        setTimeout(function() { btn.textContent = 'Save New Username'; btn.style.background = 'var(--accent)'; }, 2000);
    }
};
window.togglePushNotifications = function() {
    var run = function() {
        if (typeof window.enablePushFromTap !== 'function') return;
        window.enablePushFromTap().then(function() {
            if (typeof window.renderNotificationSettings === 'function') window.renderNotificationSettings();
        });
    };
    if (typeof window.enablePushFromTap === 'function') { run(); return; }
    var s = document.createElement('script');
    s.src = 'notifications.js?v=20261024_v2357';
    s.onload = run;
    document.body.appendChild(s);
};
if (typeof sendEmailVerification === 'undefined') window.sendEmailVerification = function() { if (auth && auth.currentUser && auth.currentUser.sendEmailVerification) { auth.currentUser.sendEmailVerification().then(function() { showToast('📧 Verification email sent!'); }).catch(function() { showToast('Could not send verification email'); }); } };
// ===== PHONE 2FA ENROLLMENT =====
// Uses Firebase Phone MFA (compat SDK v9)

window._mfaVerificationId = null;
window._mfaResolver = null; // for sign-in MFA challenge

window.disable2FA = async function() {
    if (!auth || !auth.currentUser) { showToast('Not signed in'); return; }
    var factors = auth.currentUser.multiFactor && auth.currentUser.multiFactor.enrolledFactors;
    if (!factors || factors.length === 0) { showToast('2FA is not enabled'); return; }
    try {
        for (var f of factors) {
            await auth.currentUser.multiFactor.unenroll(f);
        }
        await db.collection('users').doc(auth.currentUser.uid).update({ phoneVerified: false }).catch(function() {});
        try { await firebase.functions().httpsCallable('phoneFactorRemoved')({}); } catch (e) {}
        showToast('Phone verification is off');
        showSettingsPage('security');
    } catch(e) {
        if (e.code === 'auth/requires-recent-login') {
            showToast('⚠️ Please sign out and sign back in, then disable 2FA.');
        } else {
            showToast('Error disabling 2FA: ' + (e.message || 'try again'));
        }
    }
};

window.startMFAEnroll = async function() {
    if (!auth || !auth.currentUser) { showToast('Not signed in'); return; }
    var phoneInput = document.getElementById('mfaPhone');
    if (!phoneInput) { showToast('Phone input not found'); return; }
    var phone = phoneInput.value.trim();
    if (!phone) { showToast('Enter your phone number'); return; }
    // Auto-format US numbers
    if (/^[2-9]\d{9}$/.test(phone.replace(/[^\d]/g, ''))) {
        phone = '+1' + phone.replace(/[^\d]/g, '');
    } else if (/^[\d]{10}$/.test(phone.replace(/[^\d]/g, '')) && !phone.startsWith('+')) {
        phone = '+1' + phone.replace(/[^\d]/g, '');
    }
    if (!phone.startsWith('+')) {
        showToast('Include country code, e.g. +1 for US');
        return;
    }
    var status = document.getElementById('mfaStatus');
    if (status) status.textContent = 'Sending code...';
    try {
        // Create invisible reCAPTCHA if not already done
        if (!window._mfaRecaptcha) {
            var container = document.getElementById('mfaRecaptchaContainer');
            if (!container) {
                container = document.createElement('div');
                container.id = 'mfaRecaptchaContainer';
                container.style.display = 'none';
                document.body.appendChild(container);
            }
            window._mfaRecaptcha = new firebase.auth.RecaptchaVerifier('mfaRecaptchaContainer', { size: 'invisible' });
        }
        var session = await auth.currentUser.multiFactor.getSession();
        var phoneProvider = new firebase.auth.PhoneAuthProvider();
        window._mfaVerificationId = await phoneProvider.verifyPhoneNumber(
            { phoneNumber: phone, session: session },
            window._mfaRecaptcha
        );
        // Show code input
        var mfaVerify = document.getElementById('mfaVerify');
        if (mfaVerify) mfaVerify.style.display = 'block';
        if (status) status.textContent = '✅ Code sent! Check your messages.';
    } catch(e) {
        console.error('[MFA Enroll]', e.code, e.message);
        // Reset reCAPTCHA on error so it can be used again
        if (window._mfaRecaptcha) { try { window._mfaRecaptcha.clear(); } catch(_) {} window._mfaRecaptcha = null; }
        if (status) status.textContent = '';
        if (e.code === 'auth/requires-recent-login') {
            showToast('⚠️ Sign out and sign back in, then try enabling 2FA.');
        } else if (e.code === 'auth/invalid-phone-number') {
            showToast('⚠️ Invalid phone number. Use format: +1XXXXXXXXXX');
        } else if (e.code === 'auth/too-many-requests') {
            showToast('⚠️ Too many attempts. Please wait a few minutes.');
        } else {
            showToast('Error sending code: ' + (e.message || 'try again'));
        }
    }
};

window.verifyMFACode = async function() {
    if (!auth || !auth.currentUser) { showToast('Not signed in'); return; }
    var codeInput = document.getElementById('mfaCode');
    if (!codeInput) { showToast('Code input not found'); return; }
    var code = codeInput.value.trim();
    if (!code || code.length < 6) { showToast('Enter the 6-digit code'); return; }
    if (!window._mfaVerificationId) { showToast('Start enrollment first — click "Send Verification Code"'); return; }
    var status = document.getElementById('mfaStatus');
    if (status) status.textContent = 'Verifying...';
    try {
        var cred = firebase.auth.PhoneAuthProvider.credential(window._mfaVerificationId, code);
        var multiFactorAssertion = firebase.auth.PhoneMultiFactorGenerator.assertion(cred);
        await auth.currentUser.multiFactor.enroll(multiFactorAssertion, 'Phone Number');
        window._mfaVerificationId = null;
        try {
            var issued = await firebase.functions().httpsCallable('issueRecoveryCodes')({});
            if (issued && issued.data && issued.data.recoveryCodes) window._showRecoveryCodes(issued.data.recoveryCodes);
        } catch (codeErr) {}
        showToast('Phone verification is on. Sign out and back in once so it covers withdrawals and gifts.');
        showSettingsPage('security');
    } catch(e) {
        console.error('[MFA Verify]', e.code, e.message);
        if (status) status.textContent = '';
        if (e.code === 'auth/invalid-verification-code') {
            showToast('⚠️ Invalid code. Check your messages and try again.');
        } else if (e.code === 'auth/code-expired') {
            showToast('⚠️ Code expired. Click "Send Verification Code" to get a new one.');
            window._mfaVerificationId = null;
        } else {
            showToast('Verification failed: ' + (e.message || 'try again'));
        }
    }
};

// TOTP sign-in challenge — shown when totpEnabled===true and session not yet verified.
// Uses existing totpCheck Cloud Function. Calls loadUser again on success.
window._showTotpSignInChallenge = function() {
    if (tosBlocking()) {
        window.runAfterTos(function() { window._showTotpSignInChallenge(); });
        return;
    }
    if (document.getElementById('totpSignInOverlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'totpSignInOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:700000;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML =
        '<div style="background:var(--bg-side,#1a1a2e);border:1px solid var(--border,#333);border-radius:16px;padding:28px 24px;max-width:340px;width:100%;text-align:center;">' +
            '<div style="font-size:2.5rem;margin-bottom:10px;">📱</div>' +
            '<div style="font-weight:800;font-size:1.1rem;color:var(--heading,#fff);margin-bottom:6px;">Authenticator Code</div>' +
            '<div style="color:var(--text-muted,#aaa);font-size:0.85rem;margin-bottom:16px;">Open your authenticator app and enter the 6-digit code</div>' +
            '<input id="totpSignInInput" type="text" inputmode="numeric" maxlength="6" placeholder="000000" autocomplete="one-time-code" style="width:100%;padding:14px;background:var(--input-bg,#111);border:1px solid var(--border,#333);border-radius:8px;color:var(--text,#fff);font-size:1.6rem;text-align:center;letter-spacing:6px;font-family:inherit;outline:none;margin-bottom:10px;box-sizing:border-box;">' +
            '<label style="display:flex;align-items:flex-start;gap:8px;text-align:left;font-size:0.82rem;color:var(--text,#fff);margin:0 0 12px;cursor:pointer;line-height:1.35;">' +
            '<input id="totpRememberDevice" type="checkbox" checked style="margin-top:2px;">' +
            '<span>Remember this device for 30 days</span></label>' +
            '<div id="totpSignInStatus" style="font-size:0.8rem;color:var(--text-muted,#aaa);min-height:18px;margin-bottom:12px;"></div>' +
            '<button id="totpSignInBtn" onclick="window._submitTotpSignIn()" style="width:100%;padding:12px;background:var(--accent,#f97316);color:#fff;border:none;border-radius:10px;font-weight:700;font-size:0.95rem;cursor:pointer;font-family:inherit;margin-bottom:8px;">Verify</button>' +
            '<button onclick="window._toggleRecoveryEntry()" style="width:100%;padding:10px;background:none;border:none;color:var(--accent,#f97316);font-size:0.85rem;cursor:pointer;font-family:inherit;margin-bottom:8px;">Use a recovery code</button>' +
            '<div id="totpRecoveryBox" style="display:none;margin-bottom:8px;">' +
            '<input id="totpRecoveryInput" type="text" autocomplete="one-time-code" placeholder="XXXX-XXXX" style="width:100%;padding:12px;background:var(--input-bg,#111);border:1px solid var(--border,#333);border-radius:8px;color:var(--text,#fff);font-size:1rem;text-align:center;letter-spacing:2px;font-family:inherit;outline:none;margin-bottom:8px;box-sizing:border-box;">' +
            '<button onclick="window._submitRecoveryCode(\'totp\')" style="width:100%;padding:10px;background:none;border:1px solid var(--accent,#f97316);border-radius:10px;color:var(--accent,#f97316);font-size:0.85rem;cursor:pointer;font-family:inherit;">Turn off 2FA with this code</button>' +
            '</div>' +
            '<button onclick="window._showLostAccess()" style="width:100%;padding:8px;background:none;border:none;color:var(--text-muted,#aaa);font-size:0.8rem;cursor:pointer;font-family:inherit;margin-bottom:4px;">Lost your device?</button>' +
            '<button onclick="signOutUser(true)" style="width:100%;padding:10px;background:none;border:1px solid var(--border,#333);border-radius:10px;color:var(--text-muted,#aaa);font-size:0.85rem;cursor:pointer;font-family:inherit;">Cancel (Sign out)</button>' +
        '</div>';
    document.body.appendChild(overlay);
    // Focus input and allow Enter key
    setTimeout(function() {
        var inp = document.getElementById('totpSignInInput');
        if (inp) {
            inp.focus();
            inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') window._submitTotpSignIn(); });
        }
    }, 100);
};

window._submitTotpSignIn = async function() {
    var inp = document.getElementById('totpSignInInput');
    var statusEl = document.getElementById('totpSignInStatus');
    var btn = document.getElementById('totpSignInBtn');
    if (!inp) return;
    var code = inp.value.trim();
    if (code.length < 6) {
        if (statusEl) statusEl.textContent = 'Enter the full 6-digit code';
        return;
    }
    if (btn) { btn.disabled = true; btn.textContent = 'Verifying...'; }
    if (statusEl) statusEl.textContent = '';
    try {
        var rememberEl = document.getElementById('totpRememberDevice');
        var remember = !rememberEl || rememberEl.checked;
        var payload = { code: code, rememberDevice: remember === true };
        if (remember && auth && auth.currentUser) {
            try {
                var previous = localStorage.getItem(mfaDeviceKey(auth.currentUser.uid)) || '';
                if (/^[0-9a-f]{64}$/.test(previous)) payload.previousDeviceToken = previous;
            } catch (e0) {}
        }
        var checkFn = firebase.functions().httpsCallable('totpCheck');
        var checked = await checkFn(payload);
        var checkedData = (checked && checked.data) || {};
        if (auth && auth.currentUser && checkedData.sessionId) window._rememberMfaSession(auth.currentUser.uid, checkedData.sessionId);
        if (auth && auth.currentUser) {
            if (checkedData.deviceToken) window._rememberMfaDevice(auth.currentUser.uid, checkedData.deviceToken);
            else if (!remember) mfaClearDevice(auth.currentUser.uid);
        }
        var ov = document.getElementById('totpSignInOverlay');
        if (ov) ov.remove();
        if (checkedData.recoveryCodes) window._showRecoveryCodes(checkedData.recoveryCodes);
        _resumeAfterSecondFactor();
        if (typeof loadUser === 'function' && auth && auth.currentUser) {
            loadUser(auth.currentUser.uid).catch(function(e) { console.error('[TOTP] loadUser after verify failed:', e); });
        }
    } catch(e) {
        if (btn) { btn.disabled = false; btn.textContent = 'Verify'; }
        var msg = _mfaFailure(e);
        if (statusEl) statusEl.textContent = msg;
        if (inp) { inp.value = ''; inp.focus(); }
    }
};

// Show MFA sign-in challenge when user with phone 2FA tries to sign in
window._showMFASignInChallenge = async function(resolver) {
    if (tosBlocking()) {
        window.runAfterTos(function() { window._showMFASignInChallenge(resolver); });
        return;
    }
    // Guard against double-fire (direct catch + race catch both triggering)
    if (document.getElementById('mfaSignInOverlay')) return;
    window._mfaResolver = resolver;
    var overlay = document.createElement('div');
    overlay.id = 'mfaSignInOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:600000;display:flex;align-items:center;justify-content:center;padding:16px;';

    // On Safari, reCAPTCHA required for phone auth is blocked by ITP — show helpful message instead
    var _isSafariMFA = /^((?!chrome|android).)*safari/i.test(navigator.userAgent || '');
    if (_isSafariMFA) {
        overlay.innerHTML = '<div style="background:var(--bg-side,#1a1a2e);border:1px solid var(--border,#333);border-radius:16px;padding:24px;max-width:340px;width:100%;text-align:center;">' +
            '<div style="font-size:2.5rem;margin-bottom:10px;">⚠️</div>' +
            '<div style="font-weight:800;font-size:1.1rem;color:var(--heading,#fff);margin-bottom:8px;">SMS 2FA unavailable on Safari</div>' +
            '<div style="color:var(--text-muted,#aaa);font-size:0.85rem;margin-bottom:16px;line-height:1.5;">Safari blocks the text-message step. Use Chrome or Firefox to enter the phone code, or use a recovery code below. That turns two-factor authentication off so you can sign in and switch to an authenticator app.</div>' +
            '<button onclick="window._toggleRecoveryEntry()" style="width:100%;padding:10px;background:none;border:none;color:var(--accent,#f97316);font-size:0.85rem;cursor:pointer;font-family:inherit;margin-bottom:8px;">Use a recovery code</button>' +
            '<div id="totpRecoveryBox" style="display:none;text-align:left;margin-bottom:8px;">' +
            '<input id="mfaRecoveryEmail" type="email" placeholder="Email on the account" style="width:100%;padding:10px;background:var(--input-bg,#111);border:1px solid var(--border,#333);border-radius:8px;color:var(--text,#fff);font-size:0.9rem;font-family:inherit;outline:none;margin-bottom:8px;box-sizing:border-box;">' +
            '<input id="totpRecoveryInput" type="text" autocomplete="one-time-code" placeholder="XXXX-XXXX" style="width:100%;padding:10px;background:var(--input-bg,#111);border:1px solid var(--border,#333);border-radius:8px;color:var(--text,#fff);font-size:1rem;text-align:center;letter-spacing:2px;font-family:inherit;outline:none;margin-bottom:8px;box-sizing:border-box;">' +
            '<button onclick="window._submitRecoveryCode(\'phone\')" style="width:100%;padding:10px;background:none;border:1px solid var(--accent,#f97316);border-radius:10px;color:var(--accent,#f97316);font-size:0.85rem;cursor:pointer;font-family:inherit;">Turn off 2FA with this code</button>' +
            '</div>' +
            '<div id="mfaSignInStatus" style="font-size:0.8rem;color:var(--text-muted,#aaa);min-height:18px;margin-bottom:8px;"></div>' +
            '<button onclick="window._showLostAccess()" style="width:100%;padding:8px;background:none;border:none;color:var(--text-muted,#aaa);font-size:0.8rem;cursor:pointer;font-family:inherit;margin-bottom:4px;">Lost your device?</button>' +
            '<button onclick="window._cancelMFASignIn()" style="width:100%;padding:12px;background:var(--accent,#f97316);color:#fff;border:none;border-radius:10px;font-weight:700;font-size:0.95rem;cursor:pointer;font-family:inherit;">Cancel</button>' +
            '</div>';
        document.body.appendChild(overlay);
        var safariEmail = document.getElementById('mfaRecoveryEmail');
        if (safariEmail && window._mfaRecoveryEmail) safariEmail.value = window._mfaRecoveryEmail;
        return;
    }

    overlay.innerHTML = '<div style="background:var(--bg-side,#1a1a2e);border:1px solid var(--border,#333);border-radius:16px;padding:24px;max-width:340px;width:100%;text-align:center;">' +
        '<div style="font-size:2rem;margin-bottom:8px;">🔐</div>' +
        '<div style="font-weight:800;font-size:1.1rem;color:var(--heading,#fff);margin-bottom:6px;">Two-Factor Authentication</div>' +
        '<div style="color:var(--text-muted,#aaa);font-size:0.85rem;margin-bottom:16px;">Enter the code sent to your phone</div>' +
        '<input id="mfaSignInCode" type="text" inputmode="numeric" maxlength="6" placeholder="6-digit code" style="width:100%;padding:12px;background:var(--input-bg,#111);border:1px solid var(--border,#333);border-radius:8px;color:var(--text,#fff);font-size:1.2rem;text-align:center;letter-spacing:4px;font-family:inherit;outline:none;margin-bottom:12px;box-sizing:border-box;">' +
        '<div id="mfaSignInStatus" style="font-size:0.8rem;color:var(--text-muted,#aaa);margin-bottom:10px;">Tap \"Send Code\" to receive your verification code</div>' +
        '<button onclick="window._sendMFACode()" id="mfaSendCodeBtn" style="width:100%;padding:12px;background:var(--accent,#f97316);color:#fff;border:none;border-radius:10px;font-weight:700;font-size:0.95rem;cursor:pointer;font-family:inherit;margin-bottom:8px;">Send Code</button>' +
        '<button onclick="window._submitMFASignIn()" style="width:100%;padding:10px;background:none;border:1px solid var(--accent,#f97316);border-radius:10px;color:var(--accent,#f97316);font-size:0.85rem;cursor:pointer;font-family:inherit;margin-bottom:8px;">Verify</button>' +
        '<button onclick="window._sendMFACode()" style="display:none" id="mfaResendBtn">Resend Code</button>' +
        '<button onclick="window._toggleRecoveryEntry()" style="width:100%;padding:8px;background:none;border:none;color:var(--accent,#f97316);font-size:0.85rem;cursor:pointer;font-family:inherit;margin-bottom:8px;">Use a recovery code</button>' +
        '<div id="totpRecoveryBox" style="display:none;text-align:left;margin-bottom:8px;">' +
        '<input id="mfaRecoveryEmail" type="email" placeholder="Email on the account" style="width:100%;padding:10px;background:var(--input-bg,#111);border:1px solid var(--border,#333);border-radius:8px;color:var(--text,#fff);font-size:0.9rem;font-family:inherit;outline:none;margin-bottom:8px;box-sizing:border-box;">' +
        '<input id="totpRecoveryInput" type="text" autocomplete="one-time-code" placeholder="XXXX-XXXX" style="width:100%;padding:10px;background:var(--input-bg,#111);border:1px solid var(--border,#333);border-radius:8px;color:var(--text,#fff);font-size:1rem;text-align:center;letter-spacing:2px;font-family:inherit;outline:none;margin-bottom:8px;box-sizing:border-box;">' +
        '<button onclick="window._submitRecoveryCode(\'phone\')" style="width:100%;padding:10px;background:none;border:1px solid var(--accent,#f97316);border-radius:10px;color:var(--accent,#f97316);font-size:0.85rem;cursor:pointer;font-family:inherit;">Turn off 2FA with this code</button>' +
        '</div>' +
        '<button onclick="window._showLostAccess()" style="width:100%;padding:8px;background:none;border:none;color:var(--text-muted,#aaa);font-size:0.8rem;cursor:pointer;font-family:inherit;margin-bottom:4px;">Lost your device?</button>' +
        '<button onclick="window._cancelMFASignIn()" style="width:100%;padding:10px;background:none;border:1px solid var(--border,#333);border-radius:10px;color:var(--text-muted,#aaa);font-size:0.85rem;cursor:pointer;font-family:inherit;">Cancel</button>' +
        '</div>';
    document.body.appendChild(overlay);
    var recoveryEmail = document.getElementById('mfaRecoveryEmail');
    if (recoveryEmail && window._mfaRecoveryEmail) recoveryEmail.value = window._mfaRecoveryEmail;
    // Send the code automatically
    window._sendMFACode = async function() {
        var statusEl = document.getElementById('mfaSignInStatus');
        if (statusEl) statusEl.textContent = '⏳ Sending code...';
        try {
            if (!window._mfaResolver) { if (statusEl) statusEl.textContent = '❌ Session expired — please sign in again'; return; }
            if (window._mfaSignInRecaptcha) { try { window._mfaSignInRecaptcha.clear(); } catch(_) {} window._mfaSignInRecaptcha = null; }
            // Use visible reCAPTCHA — invisible reCAPTCHA consistently hangs on Safari
            // regardless of container visibility tricks. Show it inside the overlay.
            var rc = document.getElementById('mfaSignInRecaptcha') || document.createElement('div');
            rc.id = 'mfaSignInRecaptcha';
            rc.style.cssText = 'margin:0 auto 12px auto;display:flex;justify-content:center;';
            // Insert before the Send Code button
            var sendBtn2 = document.getElementById('mfaSendCodeBtn');
            if (sendBtn2 && sendBtn2.parentNode && !rc.parentNode) sendBtn2.parentNode.insertBefore(rc, sendBtn2);
            else if (!rc.parentNode) document.body.appendChild(rc);
            window._mfaSignInRecaptcha = new firebase.auth.RecaptchaVerifier('mfaSignInRecaptcha', {
                size: 'normal',
                callback: function() {
                    // reCAPTCHA solved — proceed with sending code
                    window._sendMFACodeAfterRecaptcha();
                },
                'expired-callback': function() {
                    var statusEl = document.getElementById('mfaSignInStatus');
                    if (statusEl) statusEl.textContent = '⚠️ reCAPTCHA expired — tap Send Code again';
                }
            });
            window._mfaSignInRecaptcha.render();
            // Return early — _sendMFACodeAfterRecaptcha fires from the callback
            if (statusEl) statusEl.textContent = 'Complete the reCAPTCHA above, then code will be sent';
            // Stash phoneHint for use in callback
            window._mfaPhoneHint = window._mfaResolver.hints.find(function(h) { return h.factorId === firebase.auth.PhoneMultiFactorGenerator.FACTOR_ID; });
            window._sendMFACodeAfterRecaptcha = async function() {
                var statusEl2 = document.getElementById('mfaSignInStatus');
                if (statusEl2) statusEl2.textContent = '⏳ Sending code...';
                try {
                    var phoneProvider2 = new firebase.auth.PhoneAuthProvider();
                    window._mfaSignInVerificationId = await phoneProvider2.verifyPhoneNumber(
                        { multiFactorHint: window._mfaPhoneHint, session: window._mfaResolver.session },
                        window._mfaSignInRecaptcha
                    );
                    if (statusEl2) statusEl2.textContent = '✅ Code sent to ' + (window._mfaPhoneHint.phoneNumber || 'your phone');
                    var sendBtn3 = document.getElementById('mfaSendCodeBtn'); if (sendBtn3) sendBtn3.style.display = 'none';
                    var resendBtn2 = document.getElementById('mfaResendBtn'); if (resendBtn2) { resendBtn2.style.cssText = 'width:100%;padding:10px;background:none;border:1px solid var(--accent,#f97316);border-radius:10px;color:var(--accent,#f97316);font-size:0.85rem;cursor:pointer;font-family:inherit;margin-bottom:8px;'; }
                    var rcContainer = document.getElementById('mfaSignInRecaptcha'); if (rcContainer) rcContainer.style.display = 'none';
                } catch(e2) {
                    console.error('[MFA Sign-in challenge after recaptcha]', e2.code, e2.message);
                    if (window._mfaSignInRecaptcha) { try { window._mfaSignInRecaptcha.clear(); } catch(_) {} window._mfaSignInRecaptcha = null; }
                    if (statusEl2) statusEl2.textContent = '❌ ' + (e2.message || e2.code || 'Failed') + ' — tap Send Code again';
                }
            };
            return; // wait for reCAPTCHA callback
            // (unreachable — kept for phoneHint fallback path below)
            var phoneHint = window._mfaResolver.hints.find(function(h) { return h.factorId === firebase.auth.PhoneMultiFactorGenerator.FACTOR_ID; });
            if (phoneHint) {
                var phoneProvider = new firebase.auth.PhoneAuthProvider();
                window._mfaSignInVerificationId = await phoneProvider.verifyPhoneNumber(
                    { multiFactorHint: phoneHint, session: window._mfaResolver.session },
                    window._mfaSignInRecaptcha
                );
                if (statusEl) statusEl.textContent = '✅ Code sent to ' + (phoneHint.phoneNumber || 'your phone');
                var sendBtn = document.getElementById('mfaSendCodeBtn'); if (sendBtn) sendBtn.style.display = 'none';
                var resendBtn = document.getElementById('mfaResendBtn'); if (resendBtn) { resendBtn.style.display = 'block'; resendBtn.style.cssText += ';width:100%;padding:10px;background:none;border:1px solid var(--accent,#f97316);border-radius:10px;color:var(--accent,#f97316);font-size:0.85rem;cursor:pointer;font-family:inherit;margin-bottom:8px;'; }
            } else {
                if (statusEl) statusEl.textContent = '❌ No phone 2FA found on this account';
            }
        } catch(e) {
            console.error('[MFA Sign-in challenge]', e.code, e.message);
            if (window._mfaSignInRecaptcha) { try { window._mfaSignInRecaptcha.clear(); } catch(_) {} window._mfaSignInRecaptcha = null; }
            if (statusEl) statusEl.textContent = '❌ ' + (e.message || e.code || 'Failed to send code') + ' — tap Resend';
        }
    };
    // Do NOT auto-call _sendMFACode() — Safari blocks invisible reCAPTCHA without a direct user gesture
    setTimeout(function() { var inp = document.getElementById('mfaSignInCode'); if (inp) inp.focus(); }, 200);
    // Allow Enter key
    setTimeout(function() {
        var inp = document.getElementById('mfaSignInCode');
        if (inp) inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') window._submitMFASignIn(); });
    }, 250);
};

window._cancelMFASignIn = function() {
    var overlay = document.getElementById('mfaSignInOverlay');
    if (overlay) overlay.remove();
    window._mfaResolver = null;
    window._mfaSignInVerificationId = null;
    if (window._mfaSignInRecaptcha) { try { window._mfaSignInRecaptcha.clear(); } catch(_) {} window._mfaSignInRecaptcha = null; }
    if (typeof auth !== 'undefined') auth.signOut().catch(function(){});
};

window._submitMFASignIn = async function() {
    var code = (document.getElementById('mfaSignInCode') || {}).value || '';
    code = code.trim();
    if (!code || code.length < 6) { showToast('Enter the 6-digit code'); return; }
    if (!window._mfaResolver || !window._mfaSignInVerificationId) { showToast('Session expired. Please sign in again.'); return; }
    var statusEl = document.getElementById('mfaSignInStatus');
    if (statusEl) statusEl.textContent = 'Verifying...';
    try {
        var cred = firebase.auth.PhoneAuthProvider.credential(window._mfaSignInVerificationId, code);
        var assertion = firebase.auth.PhoneMultiFactorGenerator.assertion(cred);
        var result = await window._mfaResolver.resolveSignIn(assertion);
        window._mfaResolver = null;
        window._mfaSignInVerificationId = null;
        var overlay = document.getElementById('mfaSignInOverlay');
        if (overlay) overlay.remove();
        // Close the sign-in modal so user lands on app home
        if (typeof hideUsernamePrompt === 'function') hideUsernamePrompt();
        // Let the normal auth state change listener handle the rest
        loadUser(result.user.uid);
        showToast('✅ Signed in successfully!');
    } catch(e) {
        console.error('[MFA Sign-in submit]', e);
        if (statusEl) statusEl.textContent = '';
        if (e.code === 'auth/invalid-verification-code') {
            showToast('⚠️ Invalid code. Try again.');
        } else if (e.code === 'auth/code-expired') {
            showToast('⚠️ Code expired. Close and sign in again.');
        } else {
            showToast('Verification failed: ' + (e.message || 'try again'));
        }
    }
};
if (typeof sendPasswordReset === 'undefined') window.sendPasswordReset = function() {
    if (!(auth && auth.currentUser && auth.currentUser.email)) return;
    var uid = auth.currentUser.uid;
    auth.sendPasswordResetEmail(auth.currentUser.email).then(function() {
        var drop = Promise.resolve();
        if (typeof firebase !== 'undefined' && firebase.functions) {
            drop = firebase.functions().httpsCallable('totpRevokeAllTrust')({}).catch(function() {});
        }
        return drop.then(function() {
            try {
                localStorage.removeItem('btc_mfa_device_' + uid);
                localStorage.removeItem('btc_mfa_session_' + uid);
            } catch (e) {}
            showToast('Password reset email sent. Remembered devices were signed out.');
        });
    }).catch(function() { showToast('Could not send reset email'); });
};
if (typeof confirmDeleteAccount === 'undefined') window.confirmDeleteAccount = function () { if (typeof showToast === 'function') showToast('Open Settings and confirm deletion there.'); };
window._toggleRecoveryEntry = function () {
    var box = document.getElementById('totpRecoveryBox');
    if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
};

window._showLostAccess = function () {
    if (document.getElementById('lostAccessOverlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'lostAccessOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:700001;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = '<div style="background:var(--bg-side,#1a1a2e);border:1px solid var(--border,#333);border-radius:16px;padding:24px;max-width:420px;width:100%;">' +
        '<div style="font-weight:800;font-size:1.05rem;color:var(--heading,#fff);margin-bottom:8px;">Lost your device?</div>' +
        '<div style="color:var(--text-muted,#aaa);font-size:0.88rem;line-height:1.55;margin-bottom:14px;">Enter one of the recovery codes you saved when you turned on two-factor authentication. That code works once and turns two-factor authentication off, so you can sign in and set it up again. If you lost those codes too, contact support. After they confirm it is you, they can turn it off.</div>' +
        '<button onclick="document.getElementById(\'lostAccessOverlay\').remove()" style="width:100%;padding:12px;background:var(--accent,#f97316);color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;">OK</button>' +
        '</div>';
    document.body.appendChild(overlay);
};

window._showRecoveryCodes = function (codes) {
    window._recoveryCodesPlain = (codes || []).slice();
    var old = document.getElementById('recoveryCodesOverlay');
    if (old) old.remove();
    var lines = window._recoveryCodesPlain.map(function (c) {
        return '<div style="font-family:ui-monospace,monospace;font-size:1rem;letter-spacing:1px;padding:6px 0;border-bottom:1px solid var(--border,#333);">' + c + '</div>';
    }).join('');
    var overlay = document.createElement('div');
    overlay.id = 'recoveryCodesOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:700002;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = '<div style="background:var(--bg-side,#1a1a2e);border:1px solid var(--border,#333);border-radius:16px;padding:22px;max-width:420px;width:100%;max-height:90vh;overflow:auto;">' +
        '<div style="font-weight:800;font-size:1.05rem;color:var(--heading,#fff);margin-bottom:6px;">Save your recovery codes</div>' +
        '<div style="color:var(--text-muted,#aaa);font-size:0.82rem;line-height:1.5;margin-bottom:12px;">These are shown once. Each code works one time and turns two-factor authentication off. Store them somewhere safe.</div>' +
        '<div style="background:rgba(0,0,0,0.25);border-radius:10px;padding:8px 12px;margin-bottom:12px;">' + lines + '</div>' +
        '<div style="display:flex;gap:8px;margin-bottom:8px;">' +
        '<button onclick="window._copyRecoveryCodes()" style="flex:1;padding:10px;background:var(--accent,#f97316);color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;">Copy</button>' +
        '<button onclick="window._downloadRecoveryCodes()" style="flex:1;padding:10px;background:none;border:1px solid var(--border,#333);border-radius:8px;color:var(--text,#fff);font-weight:700;cursor:pointer;font-family:inherit;">Download</button>' +
        '</div>' +
        '<button onclick="document.getElementById(\'recoveryCodesOverlay\').remove()" style="width:100%;padding:10px;background:none;border:1px solid var(--border,#333);border-radius:8px;color:var(--text-muted,#aaa);cursor:pointer;font-family:inherit;">I saved these codes</button>' +
        '</div>';
    document.body.appendChild(overlay);
};

window._copyRecoveryCodes = function () {
    var text = (window._recoveryCodesPlain || []).join('\n');
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { if (typeof showToast === 'function') showToast('Recovery codes copied'); });
    }
};

window._downloadRecoveryCodes = function () {
    var text = (window._recoveryCodesPlain || []).join('\n');
    if (!text) return;
    var blob = new Blob([text + '\n'], { type: 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bitcoin-quest-recovery-codes.txt';
    a.click();
};

window._submitRecoveryCode = async function (kind) {
    var codeEl = document.getElementById('totpRecoveryInput');
    var emailEl = document.getElementById('mfaRecoveryEmail');
    var statusEl = document.getElementById(kind === 'phone' ? 'mfaSignInStatus' : 'totpSignInStatus');
    var code = codeEl ? codeEl.value.trim() : '';
    if (!code) { if (statusEl) statusEl.textContent = 'Enter a recovery code'; return; }
    try {
        var payload = { code: code };
        if (kind === 'phone') {
            payload.email = (emailEl && emailEl.value.trim()) || window._mfaRecoveryEmail || '';
            if (!payload.email) { if (statusEl) statusEl.textContent = 'Enter the email on the account'; return; }
        }
        await firebase.functions().httpsCallable('useRecoveryCode')(payload);
        var ov1 = document.getElementById('totpSignInOverlay'); if (ov1) ov1.remove();
        var ov2 = document.getElementById('mfaSignInOverlay'); if (ov2) ov2.remove();
        if (kind === 'phone') {
            if (typeof showToast === 'function') showToast('Two-factor authentication is off. Sign in again.');
            if (typeof auth !== 'undefined') auth.signOut().catch(function () {});
            return;
        }
        if (auth && auth.currentUser) {
            try {
                localStorage.removeItem('btc_mfa_session_' + auth.currentUser.uid);
                localStorage.removeItem('btc_mfa_device_' + auth.currentUser.uid);
            } catch (e) {}
        }
        if (typeof showToast === 'function') showToast('Two-factor authentication is off. You can turn it on again in Settings.');
        if (typeof loadUser === 'function' && auth && auth.currentUser) loadUser(auth.currentUser.uid);
    } catch (e) {
        if (statusEl) statusEl.textContent = _mfaFailure(e);
    }
};

window._regenerateRecoveryCodes = async function () {
    var codeEl = document.getElementById('totpRegenCode');
    var code = codeEl ? codeEl.value.trim() : '';
    try {
        var res = await firebase.functions().httpsCallable('regenerateRecoveryCodes')({ code: code });
        if (res && res.data && res.data.recoveryCodes) window._showRecoveryCodes(res.data.recoveryCodes);
        else if (typeof showToast === 'function') showToast('Could not create new codes');
    } catch (e) {
        if (typeof showToast === 'function') showToast(_mfaFailure(e));
    }
};

function mfaEscapeText(value) {
    return String(value || '').replace(/[&<>"']/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
}

function mfaWhen(ms) {
    var n = Number(ms);
    if (!n) return 'Unknown';
    try { return new Date(n).toLocaleString(); } catch (e) { return 'Unknown'; }
}

window._renderTrustedDevices = function (devices) {
    var list = document.getElementById('trustedDeviceList');
    if (!list) return;
    var rows = devices || [];
    if (!rows.length) {
        list.innerHTML = '<div style="color:var(--text-muted);font-size:0.78rem;margin-bottom:8px;">No remembered devices.</div>';
        return;
    }
    list.innerHTML = rows.map(function (device) {
        var id = String(device.id || '');
        if (!/^[a-f0-9]{32}$/.test(id)) return '';
        var label = mfaEscapeText(device.label || 'Browser');
        var mine = device.current ? ' · This device' : '';
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">' +
            '<div style="text-align:left;"><div style="color:var(--heading);font-size:0.82rem;font-weight:700;">' + label + mine + '</div>' +
            '<div style="color:var(--text-muted);font-size:0.72rem;">Added ' + mfaEscapeText(mfaWhen(device.createdAtMs)) + ' · Last used ' + mfaEscapeText(mfaWhen(device.lastUsedAtMs)) + '</div></div>' +
            '<button type="button" onclick="window._removeTrustedDevice(\'' + id + '\',' + (device.current ? 'true' : 'false') + ')" style="padding:6px 10px;background:none;border:1px solid #ef4444;border-radius:8px;color:#ef4444;cursor:pointer;font-family:inherit;font-size:0.75rem;">Remove</button></div>';
    }).join('');
};

window._loadTrustedDevices = async function () {
    var list = document.getElementById('trustedDeviceList');
    if (!list || !auth || !auth.currentUser || typeof firebase === 'undefined' || !firebase.functions) return;
    try {
        var token = '';
        try { token = localStorage.getItem(mfaDeviceKey(auth.currentUser.uid)) || ''; } catch (e) {}
        var res = await firebase.functions().httpsCallable('totpListDevices')({ deviceToken: token });
        window._renderTrustedDevices((res && res.data && res.data.devices) || []);
    } catch (e) {
        list.innerHTML = '<div style="color:var(--text-faint);font-size:0.78rem;">Could not load devices. ' + mfaEscapeText(_mfaFailure(e)) + '</div>';
    }
};

window._removeTrustedDevice = async function (deviceId, isCurrent) {
    if (!/^[a-f0-9]{32}$/.test(deviceId || '')) return;
    try {
        await firebase.functions().httpsCallable('totpRevokeDevice')({ deviceId: deviceId });
        if (isCurrent && auth && auth.currentUser) mfaClearDevice(auth.currentUser.uid);
        if (typeof showToast === 'function') showToast('Device removed');
        window._loadTrustedDevices();
    } catch (e) {
        if (typeof showToast === 'function') showToast(_mfaFailure(e));
    }
};

window._signOutOtherDevices = async function () {
    try {
        var token = '';
        if (auth && auth.currentUser) {
            try { token = localStorage.getItem(mfaDeviceKey(auth.currentUser.uid)) || ''; } catch (e) {}
        }
        await firebase.functions().httpsCallable('totpSignOutOtherDevices')({ deviceToken: token });
        if (typeof showToast === 'function') showToast('Other devices were signed out');
        window._loadTrustedDevices();
    } catch (e) {
        if (typeof showToast === 'function') showToast(_mfaFailure(e));
    }
};

window._showFreshStepUp = function (action) {
    var copy = {
        resetLightningAddress: 'Enter a fresh authenticator code to change your Lightning Address. Remembering this device is not enough.',
        deleteAccount: 'Enter a fresh authenticator code to delete this account. Remembering this device is not enough.',
        disableTotp: 'Enter a fresh authenticator code to turn off two-factor authentication. A saved session is not enough.',
        regenerateRecoveryCodes: 'Enter a fresh authenticator code to create new recovery codes. A saved session is not enough.'
    };
    return new Promise(function (resolve) {
        var old = document.getElementById('freshStepUpOverlay');
        if (old) old.remove();
        var settled = false;
        function finish(value) {
            if (settled) return;
            settled = true;
            var el = document.getElementById('freshStepUpOverlay');
            if (el) el.remove();
            resolve(value);
        }
        var overlay = document.createElement('div');
        overlay.id = 'freshStepUpOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:710000;display:flex;align-items:center;justify-content:center;padding:16px;';
        overlay.innerHTML = '<div style="background:var(--bg-side,#1a1a2e);border:1px solid var(--border,#333);border-radius:16px;padding:24px;max-width:380px;width:100%;text-align:center;">' +
            '<div style="font-weight:800;font-size:1.05rem;color:var(--heading,#fff);margin-bottom:8px;">Fresh authenticator code</div>' +
            '<div style="color:var(--text-muted,#aaa);font-size:0.85rem;line-height:1.45;margin-bottom:14px;">' + mfaEscapeText(copy[action] || 'Enter a fresh authenticator code. A remembered device is not enough.') + '</div>' +
            '<input id="freshStepUpInput" type="text" inputmode="numeric" maxlength="6" placeholder="000000" autocomplete="one-time-code" style="width:100%;padding:14px;background:var(--input-bg,#111);border:1px solid var(--border,#333);border-radius:8px;color:var(--text,#fff);font-size:1.4rem;text-align:center;letter-spacing:6px;font-family:inherit;outline:none;margin-bottom:8px;box-sizing:border-box;">' +
            '<div id="freshStepUpStatus" style="font-size:0.8rem;color:var(--text-muted,#aaa);min-height:18px;margin-bottom:10px;"></div>' +
            '<button id="freshStepUpBtn" type="button" style="width:100%;padding:12px;background:var(--accent,#f97316);color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:8px;">Continue</button>' +
            '<button id="freshStepUpCancel" type="button" style="width:100%;padding:10px;background:none;border:1px solid var(--border,#333);border-radius:10px;color:var(--text-muted,#aaa);cursor:pointer;font-family:inherit;">Cancel</button>' +
            '</div>';
        document.body.appendChild(overlay);
        overlay.querySelector('#freshStepUpCancel').addEventListener('click', function () { finish(null); });
        overlay.addEventListener('click', function (e) { if (e.target === overlay) finish(null); });
        var input = overlay.querySelector('#freshStepUpInput');
        var status = overlay.querySelector('#freshStepUpStatus');
        var button = overlay.querySelector('#freshStepUpBtn');
        async function submit() {
            var code = input ? input.value.trim() : '';
            if (code.length < 6) { if (status) status.textContent = 'Enter the full 6-digit code'; return; }
            if (button) { button.disabled = true; button.textContent = 'Checking...'; }
            try {
                var res = await firebase.functions().httpsCallable('totpStepUp')({ code: code, action: action });
                var proof = res && res.data && res.data.freshProofId;
                if (!proof) throw new Error('Enter a fresh authenticator code for this action.');
                finish(proof);
            } catch (e) {
                if (button) { button.disabled = false; button.textContent = 'Continue'; }
                if (status) status.textContent = _mfaFailure(e);
                if (input) { input.value = ''; input.focus(); }
            }
        }
        button.addEventListener('click', function () { submit(); });
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
        setTimeout(function () { try { input.focus(); } catch (e) {} }, 30);
    });
};

function mfaNeedsFreshCode() {
    return !!((window._mfaStatus && window._mfaStatus.enabled) || (typeof currentUser !== 'undefined' && currentUser && currentUser.totpEnabled));
}

async function loadTotpStatus() {
    var section = document.getElementById('twoFactorPanel') || document.getElementById('totpSection');
    if (!section) return;
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        section.innerHTML = '<div style="color:var(--text-faint);font-size:0.85rem;">Sign in to turn on two-factor authentication.</div>';
        return;
    }
    var user = auth.currentUser;
    var phoneEnrolled = user.multiFactor && user.multiFactor.enrolledFactors && user.multiFactor.enrolledFactors.length > 0;
    var hasEmail = !!(user.email);
    var emailVerified = !!user.emailVerified;
    var safari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent || '');
    try {
        var sessionId = '';
        try { sessionId = localStorage.getItem('btc_mfa_session_' + user.uid) || ''; } catch (e) {}
        var result = await firebase.functions().httpsCallable('totpStatus')({ sessionId: sessionId });
        var data = (result && result.data) || {};
        var totpOn = !!data.enabled;
        var phoneOn = phoneEnrolled || !!data.phoneEnabled;
        var status = totpOn && phoneOn ? 'Authenticator and phone are on' : (totpOn ? 'Authenticator app is on' : (phoneOn ? 'Phone verification is on' : 'Two-factor authentication is off'));
        var html = '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Two-factor authentication</div>' +
            '<div style="font-weight:800;color:var(--heading);font-size:1rem;margin-bottom:6px;">' + status + '</div>' +
            '<div style="color:var(--text-muted);font-size:0.8rem;line-height:1.5;margin-bottom:12px;">Works with email, Google, Facebook, Twitter, GitHub, Nostr, Lightning, and a guest who signs in. Phone texts need email, Google, Facebook, Twitter, or GitHub. Nostr and Lightning use an authenticator app.</div>';
        if (totpOn) {
            html += '<div style="display:flex;gap:8px;margin-bottom:8px;"><input id="totpDisableCode" inputmode="numeric" maxlength="6" placeholder="Code to turn off" style="flex:1;padding:10px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;text-align:center;">' +
                '<button onclick="disableTotp()" style="padding:10px 14px;background:none;border:1px solid #ef4444;border-radius:8px;color:#ef4444;cursor:pointer;font-family:inherit;">Turn off</button></div>';
        } else {
            html += '<div id="totpSection"><button onclick="startTotpSetup()" style="width:100%;padding:10px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:8px;">Set up authenticator app</button></div>';
        }
        if (phoneOn) {
            html += '<button onclick="disable2FA()" style="width:100%;padding:10px;background:none;border:1px solid #ef4444;border-radius:8px;color:#ef4444;cursor:pointer;font-family:inherit;margin-bottom:8px;">Turn off phone verification</button>';
        } else if (!hasEmail || !emailVerified) {
            html += '<div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:8px;">Verify an email to turn on phone texts. You can still use an authenticator app.</div>';
        } else if (safari) {
            html += '<div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:8px;">Safari blocks phone texts. Use an authenticator app on this browser.</div>';
        } else {
            html += '<div id="mfaSetup" style="margin-bottom:8px;">' +
                '<input type="tel" id="mfaPhone" placeholder="Phone number" style="width:100%;padding:10px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;margin-bottom:8px;box-sizing:border-box;">' +
                '<button onclick="startMFAEnroll()" style="width:100%;padding:10px;background:none;border:1px solid var(--accent);border-radius:8px;color:var(--accent);font-weight:700;cursor:pointer;font-family:inherit;">Send phone code</button>' +
                '<div id="mfaVerify" style="display:none;margin-top:8px;"><input id="mfaCode" maxlength="6" placeholder="6-digit code" style="width:100%;padding:10px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);text-align:center;margin-bottom:8px;box-sizing:border-box;">' +
                '<button onclick="verifyMFACode()" style="width:100%;padding:10px;background:#22c55e;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;">Verify phone</button></div>' +
                '<div id="mfaStatus" style="margin-top:6px;font-size:0.8rem;"></div></div>';
        }
        if (totpOn || phoneOn) {
            html += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">' +
                '<div style="font-weight:700;color:var(--heading);font-size:0.85rem;margin-bottom:6px;">Recovery codes</div>' +
                '<div style="color:var(--text-muted);font-size:0.78rem;margin-bottom:8px;">Create a new set if you lost the ones you saved. This asks for a fresh authenticator code. A remembered device is not enough.</div>' +
                '<input id="totpRegenCode" maxlength="6" placeholder="Current authenticator code" style="width:100%;padding:10px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);text-align:center;margin-bottom:8px;box-sizing:border-box;font-family:inherit;">' +
                '<button onclick="window._regenerateRecoveryCodes()" style="width:100%;padding:10px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);cursor:pointer;font-family:inherit;margin-bottom:8px;">Create new recovery codes</button>' +
                '<button onclick="window._showLostAccess()" style="width:100%;padding:8px;background:none;border:none;color:var(--accent);cursor:pointer;font-family:inherit;">Lost your device?</button>' +
                '</div>';
        }
        if (totpOn) {
            html += '<div id="trustedDevicesBlock" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">' +
                '<div style="font-weight:700;color:var(--heading);font-size:0.85rem;margin-bottom:6px;">Remembered devices</div>' +
                '<div style="color:var(--text-muted);font-size:0.75rem;line-height:1.4;margin-bottom:8px;">A checked code prompt remembers this browser for 30 days. The server stores a short browser and system label, not your IP address.</div>' +
                '<div id="trustedDeviceList" style="color:var(--text-muted);font-size:0.78rem;">Loading devices…</div>' +
                '<button type="button" onclick="window._signOutOtherDevices()" style="width:100%;padding:10px;margin-top:8px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text);cursor:pointer;font-family:inherit;">Sign out other devices</button>' +
                '</div>';
        } else if (!phoneOn) {
            html += '<button onclick="window._showLostAccess()" style="width:100%;padding:8px;background:none;border:none;color:var(--text-muted);cursor:pointer;font-family:inherit;">Lost your device?</button>';
        }
        html += '</div>';
        section.innerHTML = html;
        if (totpOn) window._loadTrustedDevices();
        if (data.needsRecoveryCodes && (data.sessionVerified || data.phoneEnabled)) window._maybeOfferRecoveryCodes();
    } catch (e) {
        section.innerHTML = '<div style="color:var(--text-faint);font-size:0.8rem;padding:8px;">Could not load two-factor settings (' + _mfaFailure(e) + ')</div>' +
            '<button onclick="loadTotpStatus()" style="width:100%;padding:8px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;color:var(--text-muted);cursor:pointer;font-family:inherit;">Try again</button>';
    }
}

async function startTotpSetup() {
    try {
        var totpSetupFn = firebase.functions().httpsCallable('totpSetup');
        var result = await totpSetupFn();
        var qrDataUrl = result.data && (result.data.qr || result.data.qrUrl || result.data.qrDataUrl);
        if (qrDataUrl) {
            var area = document.getElementById('totpSetupArea') || document.getElementById('totpSection') || document.getElementById('twoFactorPanel');
            if (area) {
                area.style.display = 'block';
                area.innerHTML = '<div style="text-align:center;margin:12px 0;">' +
                    '<div style="color:var(--heading);font-weight:600;font-size:0.9rem;margin-bottom:8px;">Scan this QR code with your authenticator app:</div>' +
                    '<img src="' + qrDataUrl + '" style="width:200px;height:200px;border-radius:8px;border:2px solid var(--border);margin-bottom:12px;">' +
                    '<div style="color:var(--text-faint);font-size:0.75rem;margin-bottom:8px;">Or enter this key manually: <strong style="font-family:monospace;">' + (result.data.secret || '') + '</strong></div>' +
                    '<input type="text" id="totpVerifyCode" inputmode="numeric" placeholder="Enter 6-digit code" maxlength="6" style="width:100%;padding:10px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.9rem;font-family:inherit;outline:none;text-align:center;margin-bottom:8px;">' +
                    '<button onclick="verifyTotpSetup()" style="width:100%;padding:10px;background:#22c55e;color:#fff;border:none;border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer;">Verify & Enable</button>' +
                    '</div>';
            }
        } else {
            showToast('Could not load QR code. Check your connection and try again.');
        }
    } catch(e) {
        showToast('Error setting up authenticator: ' + (e.message || 'try again'));
    }
}

async function verifyTotpSetup() {
    var code = document.getElementById('totpVerifyCode');
    if (!code || code.value.trim().length !== 6) { showToast('Enter a 6-digit code'); return; }
    try {
        var verifyFn = firebase.functions().httpsCallable('totpVerify');
        var verified = await verifyFn({ code: code.value.trim() });
        var verifiedData = (verified && verified.data) || {};
        if (auth && auth.currentUser && verifiedData.sessionId) window._rememberMfaSession(auth.currentUser.uid, verifiedData.sessionId);
        if (verifiedData.recoveryCodes) window._showRecoveryCodes(verifiedData.recoveryCodes);
        showToast('Authenticator app is on');
        showSettingsPage('security');
    } catch(e) {
        showToast(_mfaFailure(e));
    }
}

async function disableTotp() {
    var code = document.getElementById('totpDisableCode');
    if (!code || code.value.trim().length !== 6) { showToast('Enter your current code'); return; }
    try {
        var disableFn = firebase.functions().httpsCallable('totpDisable');
        await disableFn({ code: code.value.trim() });
        if (auth && auth.currentUser) {
            try {
                localStorage.removeItem('btc_mfa_session_' + auth.currentUser.uid);
                localStorage.removeItem('btc_mfa_device_' + auth.currentUser.uid);
            } catch (err) {}
        }
        showToast('Authenticator app is off');
        showSettingsPage('security');
    } catch(e) {
        showToast(_mfaFailure(e));
    }
}


function clearUserData() {
    var userKeys = [
        'btc_visited_channels', 'btc_favs', 'btc_hidden_badges',
        'btc_asked_questions', 'btc_scholar_passed', 'btc_scholar_attempt_date',
        'btc_badges', 'btc_last_channel', 'btc_signin_email',
        'btc_nacho_equipped', 'btc_nacho_items_notified', 'btc_points',
        'btc_total_visits', 'btc_streak', 'btc_last_visit'
    ];
    userKeys.forEach(function(key) { localStorage.removeItem(key); });
    currentUser = null;
}

// ---- RESTORED: showSignInPrompt ----
function showSignInPrompt() {
    if (auth && auth.currentUser && !auth.currentUser.isAnonymous) {
        showSettings();
        return;
    }
    showUsernamePrompt();
}

// ===== SATS CLAIM FLOW =====
window.saveSatsLnAddress = function() {
    var input = document.getElementById('satsLnAddrInput');
    var addr = input ? normalizeClientLn(input.value) : '';
    if (addr && !clientLnValid(addr)) {
        var status = document.getElementById('satsLnAddrStatus');
        if (status) status.textContent = 'Enter a valid Lightning Address (e.g. you@walletofsatoshi.com)';
        return;
    }
    openWithdrawalAddress({ mode: 'reset', address: addr, start: addr ? 'confirm' : 'input' });
};

window.initSatsClaim = function() {
    console.log('[SATS] initSatsClaim called', { currentUser: !!currentUser, auth: !!auth, authUser: !!auth?.currentUser, isAnon: auth?.currentUser?.isAnonymous });
    if (!currentUser || !auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        console.log('[SATS] BLOCKED: auth check failed');
        showToast('Sign in to claim sats');
        return;
    }
    // All three offset counters (claimed, donated, exchanged) reduce the redeemable pool
    var availPts = (currentUser.points || 0) - (currentUser.pointsClaimed || 0) - (currentUser.pointsDonated || 0) - (currentUser.pointsExchanged || 0);
    var _claimMath = (typeof window.claimableSats === 'function') ? window.claimableSats(currentUser) : null;
    var satsBalance = _claimMath ? _claimMath.balance : Math.floor(Math.max(0, availPts) / 10);
    var satsWithdrawn = _claimMath ? _claimMath.withdrawn : (currentUser.satsWithdrawn || 0);
    var _satCap = _claimMath ? _claimMath.cap : lifetimeSatCap();
    var lifetimeLeft = _claimMath ? _claimMath.lifetimeLeft : Math.max(0, _satCap - satsWithdrawn);
    var maxClaim = Math.min(satsBalance, 200, lifetimeLeft);
    console.log('[SATS] maxClaim:', maxClaim, '| satsBalance:', satsBalance, '| lifetimeLeft:', lifetimeLeft, '| satsWithdrawn:', satsWithdrawn);
    if (maxClaim < 100) {
        console.log('[SATS] BLOCKED: maxClaim < 100');
        showToast('⚡ Need at least 100 claimable sats (1,000 unclaimed XP) to withdraw. Keep earning!', 5000);
        return;
    }
    console.log('[SATS] Passed all checks, showing overlay');

    var overlay = document.createElement('div');
    overlay.id = 'satsClaimOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:500001;display:flex;align-items:center;justify-content:center;padding:16px;';
    // Delay dismiss listener to prevent the originating button click from immediately closing it
    setTimeout(function() {
        overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    }, 200);

    var _savedLnAddr = (typeof currentUser !== 'undefined' && currentUser) ? (currentUser.lightning || currentUser.lightningAddress || '') : '';
    window._satsClaimMaxClaim = maxClaim;
    window._satsClaimTab = 'ln';

    var html = '<div style="background:var(--bg-side);border:1px solid var(--border);border-radius:16px;padding:24px;max-width:400px;width:100%;max-height:80vh;overflow-y:auto;">';
    html += '<div style="text-align:center;margin-bottom:16px;"><span style="font-size:2rem;">⚡</span><div style="font-size:1.1rem;font-weight:800;color:var(--accent);margin-top:4px;">Claim Sats</div></div>';

    html += '<div style="background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.3);border-radius:10px;padding:12px;margin-bottom:16px;text-align:center;">';
    html += '<div style="font-size:0.75rem;color:var(--text-muted);">You can claim up to</div>';
    html += '<div style="font-size:1.5rem;font-weight:900;color:var(--accent);">⚡ ' + maxClaim + ' sats</div>';
    html += '<div style="font-size:0.7rem;color:var(--text-faint);margin-top:2px;">Zero fees - we cover all routing costs</div>';
    html += '</div>';

    html += '<div id="satsLnPanel">';
    html += '<div style="margin-bottom:10px;">';
    html += '<label style="display:block;font-size:0.78rem;color:var(--text-muted);margin-bottom:5px;">Your Lightning Address</label>';
    if (_savedLnAddr) {
        html += '<input id="satsLnAddr" type="text" readonly value="' + (typeof escapeHtml === 'function' ? escapeHtml(_savedLnAddr) : _savedLnAddr) + '" style="width:100%;padding:11px 13px;background:var(--input-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.88rem;font-family:inherit;outline:none;box-sizing:border-box;">';
        html += '<p style="margin:8px 0 0;font-size:0.75rem;color:var(--text-muted);line-height:1.45;">' + LN_ADDRESS_LOCKED_NOTICE + '</p>';
    } else {
        html += '<p style="margin:0 0 8px;font-size:0.75rem;color:var(--text-muted);line-height:1.45;">' + LN_ADDRESS_LOCK_NOTICE + '</p>';
        html += '<input id="satsLnAddr" type="text" placeholder="you@walletofsatoshi.com" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" style="width:100%;padding:11px 13px;background:var(--input-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.88rem;font-family:inherit;outline:none;box-sizing:border-box;">';
    }
    html += '</div>';
    html += '<div style="margin-bottom:12px;">';
    html += '<label style="display:block;font-size:0.78rem;color:var(--text-muted);margin-bottom:5px;">Amount <span style="color:var(--text-faint);">(100-' + maxClaim + ' sats)</span></label>';
    html += '<div style="display:flex;gap:6px;align-items:center;">';
    html += '<input id="satsLnAmount" type="number" min="100" max="' + maxClaim + '" value="' + maxClaim + '" style="flex:1;padding:11px 13px;background:var(--input-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:1rem;font-family:inherit;outline:none;text-align:center;font-weight:700;">';
    html += '<button onclick="document.getElementById(\'satsLnAmount\').value=' + maxClaim + '" style="padding:10px 12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--accent);font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;">Max</button>';
    html += '</div></div>';
    html += '<div style="font-size:0.7rem;color:#22c55e;margin-bottom:14px;">Your wallet receives sats automatically.</div>';
    html += '</div>';

    html += '<div id="satsClaimError" style="display:none;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:10px;margin-bottom:12px;font-size:0.78rem;color:#ef4444;text-align:center;"></div>';

    html += '<div id="satsClaimTurnstile" class="cf-turnstile" data-sitekey="0x4AAAAAAD-ivgpRkbXpgz86" data-theme="dark" data-size="flexible" style="margin-bottom:12px;"></div>';

    html += '<button id="satsClaimBtn" onclick="submitSatsClaim()" style="width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;touch-action:manipulation;">⚡ Send Sats to My Wallet</button>';
    html += '<button onclick="document.getElementById(\'satsClaimOverlay\').remove()" style="width:100%;padding:12px;background:none;border:1px solid var(--border);border-radius:12px;color:var(--text-muted);font-size:0.85rem;cursor:pointer;font-family:inherit;margin-top:8px;">Cancel</button>';
    html += '</div>';

    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    // Re-render Turnstile widget now that the element is in the DOM
    if (window.turnstile) {
        window.turnstile.render('#satsClaimTurnstile', {
            sitekey: '0x4AAAAAAD-ivgpRkbXpgz86',
            theme: 'dark',
            size: 'flexible',
        });
    }
};

// Device fingerprint for multi-account detection (Fix #3)
function _generateDeviceFingerprint() {
    try {
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Bitcoin Education 🦌', 2, 2);
        var canvasData = canvas.toDataURL();

        var components = [
            navigator.userAgent || '',
            screen.width + 'x' + screen.height,
            screen.colorDepth,
            new Date().getTimezoneOffset(),
            navigator.language || '',
            navigator.hardwareConcurrency || 0,
            (navigator.deviceMemory || 0).toString(),
            typeof window.ontouchstart !== 'undefined' ? 'touch' : 'no-touch',
            canvasData.substring(canvasData.length - 50)
        ].join('|');

        // Simple hash
        var hash = 0;
        for (var i = 0; i < components.length; i++) {
            var chr = components.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0;
        }
        return Math.abs(hash).toString(36) + '_' + components.length.toString(36);
    } catch (e) {
        return 'err_' + Date.now().toString(36);
    }
}

window._satsClaimInProgress = false;
window._satsClaimTab = 'ln';

window.submitSatsClaim = async function() {
    if (window._satsClaimInProgress) return;
    var btn = document.getElementById('satsClaimBtn');
    var errorEl = document.getElementById('satsClaimError');
    if (!btn) return;

    var claimPayload;
    var lnAddrEl = document.getElementById('satsLnAddr');
    var lnAmtEl = document.getElementById('satsLnAmount');
    var lnAddr = normalizeClientLn(lnAddrEl ? lnAddrEl.value : '');
    var lnAmt = lnAmtEl ? parseInt(lnAmtEl.value, 10) : 0;
    if (!clientLnValid(lnAddr)) {
        if (errorEl) { errorEl.textContent = 'Enter a valid Lightning Address (e.g. you@walletofsatoshi.com)'; errorEl.style.display = 'block'; }
        return;
    }
    var _maxCl = window._satsClaimMaxClaim || 200;
    if (!lnAmt || lnAmt < 100 || lnAmt > _maxCl) {
        if (errorEl) { errorEl.textContent = 'Amount must be between 100 and ' + _maxCl + ' sats'; errorEl.style.display = 'block'; }
        return;
    }
    var savedNow = normalizeClientLn((typeof currentUser !== 'undefined' && currentUser) ? (currentUser.lightning || currentUser.lightningAddress || currentUser.lnAddress || '') : '');
    if (!savedNow || savedNow !== lnAddr) {
        var confirmedAddr = await openWithdrawalAddress({ mode: 'claim', address: lnAddr, start: 'confirm' });
        if (!confirmedAddr) return;
        lnAddr = confirmedAddr;
    }
    claimPayload = { lightningAddress: lnAddr, amount: lnAmt };

    // Hide previous errors
    if (errorEl) errorEl.style.display = 'none';

    window._satsClaimInProgress = true;
    btn.disabled = true;
    btn.textContent = '⏳ Sending to your address...';
    btn.style.opacity = '0.6';

    try {
        try {
            // Mint or reuse the cached token (1h TTL). httpsCallable attaches it
            // as X-Firebase-AppCheck on the claimSats request.
            await firebase.appCheck().getToken(false);
        } catch (appCheckErr) {
            if (errorEl) { errorEl.textContent = 'Security check failed. Refresh the page and try again.'; errorEl.style.display = 'block'; }
            btn.disabled = false;
            btn.textContent = '⚡ Send Sats to My Wallet';
            btn.style.opacity = '1';
            window._satsClaimInProgress = false;
            return;
        }
        var claimSats = firebase.functions().httpsCallable('claimSats');
        // Generate device fingerprint for multi-account detection
        var _fp = _generateDeviceFingerprint();
        // Grab Turnstile token from faucet widget
        var _tsEl = document.querySelector('#satsClaimTurnstile [name="cf-turnstile-response"]');
        var _tsToken = _tsEl ? (_tsEl.value || '') : '';
        if (!_tsToken) {
            if (errorEl) { errorEl.textContent = 'Security check pending — please wait a moment and try again.'; errorEl.style.display = 'block'; }
            btn.disabled = false; btn.textContent = '⚡ Send Sats to My Wallet'; btn.style.opacity = '1';
            window._satsClaimInProgress = false;
            if (window.turnstile) window.turnstile.reset('#satsClaimTurnstile');
            return;
        }
        var result = await claimSats(Object.assign({}, claimPayload, { fingerprint: _fp, turnstileToken: _tsToken }));
        if (result.data && result.data.success) {
            var paidAmount = result.data.amount || 0;
            currentUser.pointsClaimed = (currentUser.pointsClaimed || 0) + (paidAmount * 10);
            currentUser.satsWithdrawn = (currentUser.satsWithdrawn || 0) + paidAmount;
            currentUser.lastSatsClaim = new Date();
            document.getElementById('satsClaimOverlay').remove();
            window._satsClaimInProgress = false;
            // Secret badge: Dust Collector - track consecutive faucet claim days
            try {
                var _fcToday = new Date().toISOString().split('T')[0];
                var _fcLast = localStorage.getItem('btc_faucet_last_day');
                var _fcYest = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                var _fcStreak = parseInt(localStorage.getItem('btc_faucet_streak') || '0');
                if (_fcLast === _fcYest) {
                    _fcStreak++;
                } else if (_fcLast !== _fcToday) {
                    _fcStreak = 1;
                }
                localStorage.setItem('btc_faucet_streak', String(_fcStreak));
                localStorage.setItem('btc_faucet_last_day', _fcToday);
            } catch(e) {}

            if (typeof notifySelfSatsClaim === 'function') notifySelfSatsClaim(paidAmount);
            // Fun celebration popup + confetti
            if (typeof launchConfetti === 'function') launchConfetti();
            var _totalClaimed = currentUser.satsWithdrawn || paidAmount;
            var _claimCap = lifetimeSatCap();
            var _remaining = Math.max(0, _claimCap - _totalClaimed);
            var _celebOverlay = document.createElement('div');
            _celebOverlay.id = 'satsCelebration';
            _celebOverlay.style.cssText = 'position:fixed;inset:0;z-index:100020;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeSlideIn 0.3s;';
            _celebOverlay.onclick = function(e) { if (e.target === _celebOverlay) _celebOverlay.remove(); };
            _celebOverlay.innerHTML = '<div style="background:linear-gradient(135deg,#1a1b2e,#12131f);border:2px solid #f7931a;border-radius:24px;padding:32px;max-width:360px;width:100%;text-align:center;animation:nachoPop 0.4s cubic-bezier(0.175,0.885,0.32,1.275);">' +
                '<div style="font-size:4rem;margin-bottom:12px;">⚡🎉</div>' +
                '<h2 style="color:#f7931a;font-size:1.4rem;margin:0 0 8px;">Sats Claimed!</h2>' +
                '<div style="font-size:2rem;font-weight:900;color:#fff;margin-bottom:8px;">' + paidAmount + ' sats</div>' +
                '<div style="font-size:0.85rem;color:#94a3b8;line-height:1.5;margin-bottom:16px;">sent to your Lightning wallet ⚡<br>Check your wallet to confirm!</div>' +
                '<div style="padding:10px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.2);border-radius:10px;margin-bottom:12px;">' +
                    '<div style="font-size:0.85rem;color:#f7931a;font-weight:800;">⚡ ' + _remaining.toLocaleString() + ' sats remaining to claim!</div>' +
                    '<div style="font-size:0.7rem;color:var(--text-faint);margin-top:3px;">' + _totalClaimed.toLocaleString() + ' / 15,000 lifetime total claimed</div>' +
                '</div>' +
                '<div style="padding:10px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25);border-radius:10px;margin-bottom:16px;">' +
                    '<div style="font-size:0.75rem;color:#22c55e;font-weight:700;">🧡 Thank you for learning Bitcoin with us!</div>' +
                '</div>' +
                '<button onclick="document.getElementById(\'satsCelebration\').remove()" style="padding:14px 32px;background:#f7931a;color:#000;border:none;border-radius:12px;font-size:1rem;font-weight:800;cursor:pointer;font-family:inherit;">🚀 Stack more sats!</button>' +
            '</div>';
            document.body.appendChild(_celebOverlay);

            setTimeout(function() { showSettingsPage('sats'); }, 500);
        } else {
            var errMsg = (result.data && result.data.error) ? result.data.error : 'Claim failed - try again';
            if (errorEl) { errorEl.textContent = errMsg; errorEl.style.display = 'block'; }
            if (result.data && (result.data.code === 'address_unresolved' || String(errMsg).indexOf('Could not resolve Lightning Address') !== -1)) {
                try { sessionStorage.setItem('btc_ln_needs_reset', '1'); } catch (flagErr) {}
                openWithdrawalAddress({ mode: 'reset', address: lnAddr });
            }
            window._satsClaimInProgress = false;
            btn.disabled = false;
            btn.textContent = '⚡ Send Sats to My Wallet';
            btn.style.opacity = '1';
        }
    } catch(e) {
        console.error('Sats claim error:', e);
        var errMsg = e.message || 'Claim failed - try again';
        if (errorEl) { errorEl.textContent = errMsg; errorEl.style.display = 'block'; }
        window._satsClaimInProgress = false;
        btn.disabled = false;
        btn.textContent = '⚡ Send Sats to My Wallet';
        btn.style.opacity = '1';
    }
};

function _faucetAbuseBanButton(uid) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Ban';
    btn.style.cssText = 'padding:6px 10px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);border-radius:8px;color:#ef4444;font-size:0.72rem;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0;';
    btn.addEventListener('click', function() { window.banFaucetReportedUser(uid); });
    return btn;
}

function _faucetAbuseAccountRow(acc) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:4px 0 4px 8px;';
    var name = document.createElement('span');
    var flags = [];
    if (acc && acc.banned) flags.push('banned');
    if (acc && acc.satsDisabled) flags.push('sats disabled');
    name.textContent = ((acc && acc.displayName) || 'Bitcoiner') + ' · ' + ((acc && acc.uid) || '') + (flags.length ? ' · ' + flags.join(', ') : '');
    name.style.cssText = 'flex:1;font-size:0.75rem;color:var(--text);word-break:break-all;';
    row.appendChild(name);
    row.appendChild(_faucetAbuseBanButton(acc && acc.uid));
    return row;
}

window.renderFaucetAbuseAdmin = function(containerId) {
    var root = document.getElementById(containerId);
    if (!root) return;
    root.textContent = '';
    if (window._isAdminClaim !== true || typeof db === 'undefined' || !db) return;
    var card = document.createElement('div');
    card.style.cssText = 'background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;';
    var title = document.createElement('div');
    title.textContent = 'Faucet abuse reports';
    title.style.cssText = 'font-weight:800;font-size:0.9rem;margin-bottom:6px;color:var(--text);';
    card.appendChild(title);
    var hint = document.createElement('div');
    hint.textContent = 'Daily 13:00 UTC. Display names and uids only. Ban uses your admin sign-in.';
    hint.style.cssText = 'font-size:0.72rem;color:var(--text-faint);margin-bottom:8px;';
    card.appendChild(hint);
    var status = document.createElement('div');
    status.textContent = 'Loading...';
    status.style.cssText = 'font-size:0.78rem;color:var(--text-muted);';
    card.appendChild(status);
    root.appendChild(card);
    db.collection('faucet_abuse_reports').orderBy('generatedAt', 'desc').limit(7).get().then(function(snap) {
        status.textContent = '';
        if (snap.empty) {
            status.textContent = 'No faucet reports yet.';
            return;
        }
        snap.forEach(function(doc) {
            var data = doc.data() || {};
            var counts = data.counts || {};
            var block = document.createElement('div');
            block.style.cssText = 'border-top:1px solid var(--border);padding-top:10px;margin-top:10px;';
            var head = document.createElement('div');
            head.textContent = doc.id + ' · ' + (counts.clusters || 0) + ' clusters · ' + (counts.unknownPayments || 0) + ' unknown · ' + (counts.addressConflicts || 0) + ' address locks';
            head.style.cssText = 'font-size:0.78rem;font-weight:700;color:var(--text);margin-bottom:6px;';
            block.appendChild(head);
            (data.clusters || []).forEach(function(cluster) {
                var line = document.createElement('div');
                line.style.cssText = 'font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;';
                line.textContent = (cluster.kind || 'share') + (cluster.bannedLink ? ' · banned link' : '') + ': ' + (cluster.key || '');
                block.appendChild(line);
                (cluster.accounts || []).forEach(function(acc) {
                    block.appendChild(_faucetAbuseAccountRow(acc));
                });
            });
            (data.unknownPayments || []).forEach(function(row) {
                var line = document.createElement('div');
                line.style.cssText = 'font-size:0.75rem;color:#eab308;margin:4px 0;';
                line.textContent = 'Unknown payment · ' + (row.displayName || 'Bitcoiner') + ' · ' + (row.uid || '') + ' · ' + (row.amount || 0) + ' sats';
                block.appendChild(line);
                block.appendChild(_faucetAbuseBanButton(row.uid));
            });
            (data.addressConflicts || []).forEach(function(row) {
                var line = document.createElement('div');
                line.style.cssText = 'font-size:0.75rem;color:#f97316;margin:4px 0;';
                line.textContent = 'Address lock · ' + (row.displayName || 'Bitcoiner') + ' · ' + (row.uid || '') + ' · ' + (row.address || '');
                block.appendChild(line);
                block.appendChild(_faucetAbuseBanButton(row.uid));
            });
            card.appendChild(block);
        });
    }).catch(function() {
        status.textContent = 'Could not load faucet reports.';
    });
};

window.banFaucetReportedUser = async function(uid) {
    var id = String(uid || '');
    if (!/^[A-Za-z0-9_-]{4,128}$/.test(id)) {
        if (typeof showToast === 'function') showToast('That account id cannot be banned from here.');
        return;
    }
    if (!window.confirm('Ban ' + id + ' from the faucet?')) return;
    try {
        var banReportedFaucetUser = firebase.functions().httpsCallable('banReportedFaucetUser');
        var result = await banReportedFaucetUser({ uid: id, reason: 'faucet abuse report' });
        if (result && result.data && result.data.success) {
            if (typeof showToast === 'function') showToast('Banned ' + id);
            return;
        }
        if (typeof showToast === 'function') showToast('Ban failed.');
    } catch (err) {
        var msg = (err && err.message) ? err.message : 'Ban request failed.';
        if (typeof showToast === 'function') showToast(msg);
    }
};

// Load withdrawal history
window.loadSatsHistory = function() {
    var el = document.getElementById('satsHistory');
    if (!el || !currentUser || !db) { if (el) el.textContent = 'Sign in to view history'; return; }
    db.collection('users').doc(currentUser.uid).collection('sats_withdrawals').orderBy('timestamp', 'desc').get().then(function(snap) {
        if (snap.empty) { el.textContent = 'No withdrawals yet'; return; }
        var totalWithdrawn = 0;
        var LIFETIME_MAX = lifetimeSatCap();
        var rows = '';
        snap.forEach(function(doc) {
            var d = doc.data();
            var amt = parseInt(d.amount) || 0;
            totalWithdrawn += amt;
            var date = d.timestamp ? new Date(d.timestamp.seconds * 1000).toLocaleDateString() : '-';
            rows += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);"><span>' + date + '</span><span style="color:var(--accent);font-weight:700;">⚡ ' + amt + ' sats</span></div>';
        });
        var remaining = Math.max(0, LIFETIME_MAX - totalWithdrawn);
        var pct = Math.min(100, Math.round(totalWithdrawn / LIFETIME_MAX * 100));
        var barColor = pct >= 90 ? '#ef4444' : pct >= 60 ? '#eab308' : '#22c55e';
        var summary = '<div style="margin-bottom:12px;padding:12px;background:rgba(247,147,26,0.06);border:1px solid rgba(247,147,26,0.15);border-radius:10px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
                '<span style="font-size:0.75rem;color:var(--text-muted);">Lifetime Claimed</span>' +
                '<span style="font-size:0.85rem;font-weight:800;color:var(--accent);">⚡ ' + totalWithdrawn.toLocaleString() + ' / ' + LIFETIME_MAX.toLocaleString() + ' sats</span>' +
            '</div>' +
            '<div style="height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;margin-bottom:6px;">' +
                '<div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:3px;transition:width 0.5s;"></div>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;font-size:0.7rem;">' +
                '<span style="color:var(--text-faint);">' + pct + '% used</span>' +
                '<span style="color:' + (remaining > 0 ? '#22c55e' : '#ef4444') + ';font-weight:700;">' + remaining.toLocaleString() + ' sats remaining</span>' +
            '</div>' +
        '</div>';
        el.innerHTML = summary + rows;
    }).catch(function() { el.textContent = 'Could not load history'; });
};

function showLevelUpCelebration(lv) {
    // Suppress during Nacho Mode - track for exit summary instead
    if (window._nachoBusy || window._nachoMode) {
        if (window._nachoModeEarnings) window._nachoModeEarnings.badges.push('🎉 Level up: ' + lv.emoji + ' ' + lv.name);
        return;
    }
    // Play triumphant sound
    if (typeof canPlaySound === 'function' && !canPlaySound()) {} else if (typeof audioEnabled !== 'undefined' && !audioEnabled) {} else {
        try {
            if (!window._sharedAudioCtx) window._sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); var ctx = window._sharedAudioCtx; if (ctx.state === "suspended") ctx.resume();
            const vol = typeof audioVolume !== 'undefined' ? audioVolume : 0.5;
            // Triumphant fanfare: C5, E5, G5, C6, E6, G6
            const notes = [523.25, 659.25, 783.99, 1046.50, 1318.5, 1568.0];
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = freq;
                osc.type = i < 3 ? 'sine' : 'triangle';
                gain.gain.setValueAtTime(0.12 * vol, ctx.currentTime + i * 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.6);
                osc.start(ctx.currentTime + i * 0.1);
                osc.stop(ctx.currentTime + i * 0.1 + 0.6);
            });
        } catch(e) {}
    }

    // Confetti
    if (typeof launchConfetti === 'function') launchConfetti();

    // Modal
    const overlay = document.createElement('div');
    overlay.id = 'levelUpModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn 0.4s;';

    overlay.innerHTML = '<div style="background:var(--bg-side,#1a1a2e);border:3px solid var(--accent);border-radius:30px;padding:40px 30px;max-width:420px;width:100%;text-align:center;box-shadow:0 0 50px rgba(247,147,26,0.3);animation:popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);">' +
        '<div style="font-size:4rem;margin-bottom:12px;animation:badgeBounce 0.6s ease-out;">' + lv.emoji + '</div>' +
        '<div style="color:#f7931a;font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;font-weight:800;margin-bottom:8px;">⬆️ LEVEL UP!</div>' +
        '<div style="color:var(--heading);font-size:1.6rem;font-weight:900;margin-bottom:8px;">' + lv.name + '</div>' +
        '<div style="color:var(--text-muted);font-size:0.95rem;margin-bottom:4px;">You\'ve reached ' + lv.min.toLocaleString() + '+ XP!</div>' +
        '<div style="color:var(--text-faint);font-size:0.85rem;margin-bottom:24px;">' + getLevelFlavor(lv.name) + '</div>' +
        '<button onclick="document.getElementById(\'levelUpModal\').remove()" style="padding:12px 30px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;">Keep Going! 🚀</button>' +
        '</div>';

    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
}

function getLevelFlavor(name) {
    const flavors = {
        'Curious': 'You\'re starting to see what all the fuss is about.',
        'Pleb': 'Welcome to the pleb life. You\'re one of us now.',
        'Pleb II': '170 - the block height when Satoshi mined the first 1,000 blocks. You\'re going deeper.',
        'Pleb III': '256 - the number of bits in a private key. You\'re becoming unbreakable.',
        'Stacker': 'Stacking sats and stacking knowledge. Impressive.',
        'Stacker II': 'Double stacking! 1913 - the year the Fed was born. You know why that matters.',
        'Stacker III': 'Triple stack mode. 2016 - the year the halving changed everything.',
        'Maxi': '2140 - when the last sat is mined. There is no second best. You know it.',
        'Maxi II': '6102 - Executive Order 6102 banned gold. They can\'t ban Bitcoin. Double the conviction.',
        'Maxi III': '8888 - triple maxi. The signal only gets stronger.',
        'Papa John': '10,000 BTC for two pizzas. Never forget. 🍕 You\'ve earned your slice.',
        'Full Node': '18,333 - port 18333. You verify everything yourself. Don\'t trust, verify.',
        'Whale': '50,000 strong. You move markets. Unstoppable, just like Bitcoin.',
        'Sovereign': 'Self-sovereign. 100K channels deep. No permission needed. You ARE the bank.',
        'Cypherpunk': '133,337 - leet beyond leet. Privacy is a right, not a privilege. Code is law.',
        'Satoshi': 'The pinnacle. You\'ve achieved legendary status.',
    };
    return flavors[name] || 'You\'re leveling up!';
}

// ══════════════════════════════════════════════════════════════════════
// 🧊 BUY STREAK FREEZE VIA ORANGE TICKETS
// ══════════════════════════════════════════════════════════════════════
window._buyStreakFreeze = async function(amount) {
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        if (typeof showToast === 'function') showToast('Sign in to buy streak freezes!');
        return;
    }
    var COSTS = { 1: 5, 3: 12 };
    var cost = COSTS[amount] || 5;
    var currentTickets = currentUser ? (currentUser.orangeTickets || 0) : 0;
    if (currentTickets < cost) {
        if (typeof showToast === 'function') showToast('\u274c Not enough tickets! Need ' + cost + ', have ' + currentTickets);
        return;
    }
    try {
        if (typeof showToast === 'function') showToast('\u23f3 Processing...');
        var fn = firebase.functions().httpsCallable('spendTicketsForFreeze');
        var result = await fn({ amount: amount });
        if (result.data && result.data.success) {
            var d = result.data;
            if (currentUser) {
                currentUser.orangeTickets = d.newTickets;
                currentUser.streakFreezes = d.newFreezes;
            }
            if (typeof showToast === 'function') showToast('\u2705 Bought ' + amount + ' freeze' + (amount > 1 ? 's' : '') + '! You now have ' + d.newFreezes + ' \ud83e\udd76 freezes & ' + d.newTickets + ' \ud83c\udfdf\ufe0f tickets', 5000);
            // Refresh settings page to show updated counts
            setTimeout(function() {
                if (typeof showSettingsPage === 'function') showSettingsPage('data');
            }, 1000);
        }
    } catch (err) {
        var msg = err.message || 'Purchase failed';
        if (err.code === 'resource-exhausted') msg = err.message;
        if (typeof showToast === 'function') showToast('\u274c ' + msg);
    }
};

// Opens Global Chat above Settings (z-index 400000) and the quest hub.
window.openGlobalChatForCipher = function() {
    function lift() {
        var panel = document.getElementById('chatOverlay');
        if (panel) panel.style.zIndex = '460000';
    }
    function open() {
        if (!window._chatOverlayOpen && typeof toggleChatOverlay === 'function') toggleChatOverlay();
        lift();
    }
    if (typeof toggleChatOverlay === 'function') { open(); return; }
    if (typeof window._loadDeferred === 'function') window._loadDeferred();
    if (typeof showToast === 'function') showToast('Opening Global Chat…');
    var tries = 0;
    var timer = setInterval(function() {
        tries++;
        if (typeof toggleChatOverlay === 'function') { clearInterval(timer); open(); }
        else if (tries > 20) clearInterval(timer);
    }, 300);
};

// Quest hub is z-index 100000, under Settings at 400000. Lift it when opened from here.
window.openKeysAndCiphers = function() {
    function raise() {
        var hub = document.getElementById('questHubOverlay');
        var settings = document.getElementById('usernameModal');
        if (hub && settings && settings.classList.contains('open')) hub.style.zIndex = '450000';
    }
    if (typeof window.openNookInventory === 'function') window.openNookInventory();
    else if (typeof showQuestHub === 'function') {
        showQuestHub();
        setTimeout(function() {
            window._questHubTab = 'nook';
            window._nookSubTab = 'inventory';
            if (typeof _renderQuestHubTab === 'function') _renderQuestHubTab();
            raise();
        }, 200);
    }
    setTimeout(raise, 300);
};

window._togglePeerMore = function(btn) {
    if (!btn) return;
    var el = document.getElementById(btn.getAttribute('data-peer-panel'));
    if (!el) return;
    var willOpen = el.style.display === 'none';
    el.style.display = willOpen ? 'block' : 'none';
    btn.textContent = willOpen ? 'More options ▴' : 'More options ▾';
    btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
};

window._sendKeysToPeer = function(uid) {
    var name = (window._peerNames && window._peerNames[uid]) || 'peer';
    function go() {
        if (typeof window.showKeyPickerForPeer !== 'function') return false;
        window.showKeyPickerForPeer(uid, name);
        return true;
    }
    if (go()) return;
    if (typeof showToast === 'function') showToast('Loading keys…');
    var tries = 0;
    var timer = setInterval(function() {
        if (go() || ++tries >= 20) clearInterval(timer);
    }, 500);
};

window._viewPeerProfile = function(uid) {
    if (typeof showUserProfile === 'function') showUserProfile(uid);
    function lift() {
        var modal = document.getElementById('userProfileModal');
        if (modal) modal.style.zIndex = '530000';
    }
    setTimeout(lift, 40);
    setTimeout(lift, 400);
};

window.confirmRemovePeer = function(uid, btnEl) {
    var name = (window._peerNames && window._peerNames[uid]) || 'this peer';
    var old = document.getElementById('peerRemoveConfirm');
    if (old) old.remove();
    var overlay = document.createElement('div');
    overlay.id = 'peerRemoveConfirm';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:540000;background:rgba(0,0,0,0.72);display:flex;align-items:center;justify-content:center;padding:16px;';
    var card = document.createElement('div');
    card.style.cssText = 'background:var(--bg-side,#1a1a2e);border:1px solid var(--border,#333);border-radius:16px;padding:18px;width:100%;max-width:400px;box-shadow:0 12px 40px rgba(0,0,0,0.45);';
    var title = document.createElement('div');
    title.style.cssText = 'font-weight:800;font-size:1.05rem;color:var(--heading,#fff);margin-bottom:6px;';
    title.textContent = 'Remove ' + name + '?';
    var body = document.createElement('div');
    body.style.cssText = 'font-size:0.85rem;color:var(--text-muted);line-height:1.45;margin-bottom:14px;';
    body.textContent = 'They will no longer be a peer. You cannot send them keys until you connect again.';
    var yes = document.createElement('button');
    yes.type = 'button';
    yes.textContent = 'Remove peer';
    yes.style.cssText = 'width:100%;min-height:44px;padding:10px;border:none;border-radius:10px;background:#b91c1c;color:#fff;font-weight:800;cursor:pointer;font-family:inherit;';
    yes.onclick = function() {
        overlay.remove();
        window.managePeer('remove', uid, btnEl).then(function() {
            if (typeof showSettingsPage === 'function') showSettingsPage('account');
        });
    };
    var no = document.createElement('button');
    no.type = 'button';
    no.textContent = 'Cancel';
    no.style.cssText = 'width:100%;min-height:40px;margin-top:8px;padding:10px;border:1px solid var(--border);border-radius:10px;background:transparent;color:var(--text);font-weight:700;cursor:pointer;font-family:inherit;';
    no.onclick = function() { overlay.remove(); };
    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(yes);
    card.appendChild(no);
    overlay.appendChild(card);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
};

// Old gift-send entry point. Gifts are opened, not forwarded; this sends keys.
window._sendGiftToPeerFromDetail = function(peerUid, peerName) {
    if (typeof window.showKeyPickerForPeer === 'function') {
        window.showKeyPickerForPeer(peerUid, peerName);
        return;
    }
    if (typeof showToast === 'function') showToast('Loading keys...', 2000);
    setTimeout(function() {
        if (typeof window.showKeyPickerForPeer === 'function') window.showKeyPickerForPeer(peerUid, peerName);
    }, 1500);
};

window.managePeer = async function(action, targetUid, btnEl) {
    if (!auth || !auth.currentUser) { if (typeof showToast === 'function') showToast('Sign in first'); return; }
    var key = String(action) + '\0' + String(targetUid);
    window._peerInflight = window._peerInflight || {};
    if (window._peerInflight[key]) return window._peerInflight[key];

    var gate;
    var job = new Promise(function(resolve) { gate = resolve; });
    window._peerInflight[key] = job;

    var labels = {
        send: '🧡 Sent!',
        accept: '🧡 Accepted!',
        decline: 'Declined',
        remove: 'Removed'
    };
    var toasts = {
        send: 'Peer request sent! 🧡',
        accept: 'Peer accepted! 🧡',
        decline: 'Request declined',
        remove: 'Peer removed'
    };
    var row = [];
    if (btnEl && btnEl.parentElement && btnEl.parentElement.querySelectorAll) {
        row = Array.prototype.slice.call(btnEl.parentElement.querySelectorAll('button'));
    } else if (btnEl) {
        row = [btnEl];
    }
    var snap = row.map(function(b) {
        return {
            el: b,
            text: b.textContent,
            disabled: b.disabled,
            opacity: b.style.opacity,
            cursor: b.style.cursor,
            background: b.style.background
        };
    });
    row.forEach(function(b) { b.disabled = true; });
    if (btnEl && labels[action]) {
        btnEl.textContent = labels[action];
        btnEl.style.cursor = 'default';
        btnEl.style.opacity = '1';
    }
    if (toasts[action] && typeof showToast === 'function') showToast(toasts[action]);

    var hadPeers = window._myPeers && typeof window._myPeers.has === 'function';
    var wasPeer = !!(hadPeers && window._myPeers.has(targetUid));
    if (action === 'accept') {
        window._myPeers = window._myPeers || new Set();
        window._myPeers.add(targetUid);
    } else if (action === 'remove' && window._myPeers && typeof window._myPeers.delete === 'function') {
        window._myPeers.delete(targetUid);
    }

    (async function() {
        try {
            var fn = firebase.functions().httpsCallable('managePeer');
            var result = await fn({ action: action, targetUid: targetUid });
            if (!(result && result.data && result.data.success)) {
                var failed = new Error('Could not update peer');
                failed.code = 'internal';
                throw failed;
            }
            if (action === 'accept' && typeof checkBadges === 'function') setTimeout(checkBadges, 1500);
        } catch(e) {
            var code = (e && e.code) ? String(e.code) : '';
            var msg = (e && e.message) ? String(e.message) : 'Error';
            if (code.indexOf('already-exists') !== -1 || msg.indexOf('already-exists') !== -1) {
                if (action === 'accept' && typeof checkBadges === 'function') setTimeout(checkBadges, 1500);
                return;
            }
            snap.forEach(function(s) {
                s.el.disabled = s.disabled;
                s.el.textContent = s.text;
                s.el.style.opacity = s.opacity;
                s.el.style.cursor = s.cursor;
                s.el.style.background = s.background;
            });
            if (action === 'accept' && window._myPeers && !wasPeer && typeof window._myPeers.delete === 'function') {
                window._myPeers.delete(targetUid);
            }
            if (action === 'remove' && wasPeer && window._myPeers && typeof window._myPeers.add === 'function') {
                window._myPeers.add(targetUid);
            }
            if (typeof showToast === 'function') showToast(msg);
            console.error('[managePeer]', e);
        } finally {
            if (window._peerInflight && window._peerInflight[key] === job) delete window._peerInflight[key];
            gate();
        }
    })();
    return job;
};
