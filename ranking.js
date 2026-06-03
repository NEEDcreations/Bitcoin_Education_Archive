// © 2024-2026 603BTC LLC. All rights reserved.
// This code is proprietary. See LICENSE file. Do not copy or redistribute.
// =============================================
// Bitcoin Education Archive - Ranking System
// =============================================

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDLwucmRxjoJp2KMBTi2ujf0mlVkgLHyKk",
    authDomain: "bitcoin-education-archive.firebaseapp.com",
    projectId: "bitcoin-education-archive",
    storageBucket: "bitcoin-education-archive.firebasestorage.app",
    messagingSenderId: "1055248200518",
    appId: "1:1055248200518:web:6c6d64a5ee78e19bfbeb47"
};

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
    { name: 'Cyberhornet',    emoji: '🐝', min: 13337 },
    { name: 'Honey Badger',   emoji: '🦡', min: 50000 },
    { name: 'Sovereign',      emoji: '🏴', min: 100000 },
    { name: 'Satoshi',        emoji: '👑', min: 210000 },
];

// Client-side QR code generation (avoids leaking data to external API)
function _renderQRCode(container, data, size) {
    if (window.qrcode && typeof window.qrcode === 'function') { _drawQR(container, data, size); return; }
    var script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
    script.integrity = 'sha384-mZT2gIty7ZDdOGkxfP6joZcYdMW1Jvj9dRlfpTmaJAKKXTqzygtB22k7FLe+KZC1';
    script.crossOrigin = 'anonymous';
    script.onload = function() { _drawQR(container, data, size); };
    script.onerror = function() { container.innerHTML = '<div style="word-break:break-all;font-size:0.6rem;max-width:' + size + 'px;">' + data + '</div>'; };
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

// Points config
const POINTS = {
    visit: 5,
    openChannel: 10,
    readTime: 15,       // per 30 seconds
    explore10: 50,      // 10+ channels in a session
    streak: 100,        // daily streak bonus
};

let db, auth, currentUser = null;
let signInAttempts = 0;
let signInLockout = 0;
let redirectResultResolved = false; // Track whether getRedirectResult has resolved
let redirectResultPromise = Promise.resolve(null); // Resolves when getRedirectResult completes
// Session timeout removed — users stay signed in via Firebase LOCAL persistence
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
function initRanking() {
    try {
        firebase.initializeApp(FIREBASE_CONFIG);

        // Firebase App Check — temporarily disabled to fix Cloud Functions auth
                // Firebase App Check — temporarily disabled until key is verified
        // App Check DISABLED — not enforced, and reCAPTCHA adds 724KB to page load
        // Re-enable when Firebase App Check is enforced in the console
        // if (typeof firebase.appCheck === 'function') {
        //     firebase.appCheck().activate('6LcTlnYsAAAAAMR0KkaRoCrIlvceClMGkWXr9ahv', true);
        // }

        db = firebase.firestore();
        // Enable offline persistence — data survives connection loss
        db.enablePersistence({ synchronizeTabs: true }).catch(function(err) {
            // multi-tab or unimplemented — not critical
            if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
                console.log('Persistence error:', err.code);
            }
        });
        auth = firebase.auth();
        // Ensure auth persists across refreshes, tab closes, and app restarts
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function() {});

        // Check if returning from email magic link
        if (auth.isSignInWithEmailLink(window.location.href)) {
            handleEmailSignIn();
            // Still set up auth listener for future state changes
        }

        // Check if returning from provider redirect (in-app browser flow)
        // IMPORTANT: must resolve before we allow anonymous sign-in to avoid
        // clobbering the redirect auth state on mobile
        redirectResultPromise = auth.getRedirectResult().then(async function(result) {
            redirectResultResolved = true;
            console.log('[Auth] getRedirectResult:', result ? (result.user ? result.user.uid : 'no user') : 'null');
            if (!result || !result.user) return null;
            const user = result.user;
            // Mark that we came from a redirect — prevent anonymous sign-in from overwriting
            sessionStorage.setItem('btc_redirect_auth', '1');
            const existingDoc = await db.collection('users').doc(user.uid).get();

            // Recover anonymous data from before redirect
            const anonUid = localStorage.getItem('btc_anon_uid');
            let anonData = null;
            try { anonData = JSON.parse(localStorage.getItem('btc_anon_data')); } catch(e) {}
            localStorage.removeItem('btc_anon_uid');
            localStorage.removeItem('btc_anon_data');

            if (!existingDoc.exists) {
                if (anonData) {
                    anonData.email = user.email || '';
                    if (!anonData.username) anonData.username = user.displayName || 'Bitcoiner';
                    await db.collection('users').doc(user.uid).set(anonData);
                } else {
                    await db.collection('users').doc(user.uid).set({
                        username: user.displayName || 'Bitcoiner',
                        email: user.email || '',
                        points: 0, channelsVisited: 0, totalVisits: 1, streak: 1,
                        lastVisit: new Date().toISOString().split('T')[0],
                        created: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
                try { db.collection('stats').doc('global').set({ userCount: firebase.firestore.FieldValue.increment(1) }, { merge: true }).catch(function() {}); } catch(e) {}
                if (typeof attachReferral === 'function') attachReferral(user.uid);
            } else if (anonData) {
                const existData = existingDoc.data();
                // Anti-abuse: only merge anonymous data once per account
                // Anonymous data merge now handled minimally (points/visits are server-managed)
                if (!existData.mergedAnon) {
                    await existingDoc.ref.update({
                        mergedAnon: true,
                    });
                    // Award any anonymous points through the server-side Cloud Function
                    var _mergedPts = Math.min(anonData.points || 0, 500);
                    if (_mergedPts > 0 && typeof awardPoints === 'function') {
                        await awardPoints(_mergedPts, '🔗 Anonymous progress merged');
                    }
                }
            }

            // Clean up old anonymous doc
            if (anonUid && anonUid !== user.uid) {
                try { await db.collection('users').doc(anonUid).delete(); } catch(e) {}
            }

            loadUser(user.uid);
            updateAuthButton();
            if (typeof hideUsernamePrompt === 'function') hideUsernamePrompt();
            showToast('✅ Signed in as ' + escapeHtml(user.displayName || user.email || 'Bitcoiner'));
            return user;
        }).catch(function(e) {
            redirectResultResolved = true;
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
                    console.log('[Auth] Account switch detected:', prevUid, '->', user.uid, '— clearing localStorage');
                    clearUserLocalStorage();
                }
                localStorage.setItem('btc_last_auth_uid', user.uid);
            }
            if (firstAuthEvent) {
                firstAuthEvent = false;
                // If email link sign-in is being handled, skip — handleEmailSignIn manages it
                if (emailLinkHandled) return;
                if (user && !user.isAnonymous) {
                    // Real user restored immediately — load them
                    console.log('[Auth] Real user on first event:', user.uid);
                    sessionStorage.removeItem('btc_redirect_auth');
                    loadUser(user.uid).then(function() {
                        if (currentUser && currentUser.username) {
                            setTimeout(function() {
                                if (typeof showToast === 'function') showToast('👋 Welcome back, ' + escapeHtml(currentUser.username || '') + '!');
                            }, 2000);
                        }
                    }).catch(function() {});
                } else if (user && user.isAnonymous) {
                    // If we're pending a redirect, DON'T load anon yet — wait longer for auth to resolve
                    if (_pendingRedirect) {
                        console.log('[Auth] Anon user but pending redirect — waiting 8s for real auth...');
                        // Give Firebase extra time to restore the redirect session
                        // (mobile redirects can be slow due to cross-origin ITP/partitioning)
                        var _redirectTimeout = setTimeout(function() {
                            // Check one more time if a real user appeared
                            if (auth.currentUser && !auth.currentUser.isAnonymous) {
                                console.log('[Auth] Real user appeared after wait:', auth.currentUser.uid);
                                loadUser(auth.currentUser.uid);
                            } else {
                                console.log('[Auth] No real user after 8s — loading anon');
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
                    // null user — WAIT for getRedirectResult before signing in anonymously
                    // Otherwise we clobber the redirect auth state on mobile
                    if (redirectResultResolved && !_pendingRedirect) {
                        // Redirect already resolved (no redirect happened) — safe to go anonymous
                        auth.signInAnonymously().then(() => {});
                    } else {
                        // Wait for redirect result to resolve first, with extra timeout for mobile
                        var _nullUserTimeout = setTimeout(function() {
                            // After 10s if still no user, go anonymous
                            if (!auth.currentUser) {
                                console.log('[Auth] 10s timeout with no user — going anonymous');
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
    // Save the full URL before any modifications — needed for signInWithEmailLink
    var _signInUrl = window.location.href;
    
    // Try to get email from: 1) URL param (works cross-device), 2) localStorage (same device), 3) prompt (last resort)
    let email = null;
    // Check URL parameter first — this is embedded in the magic link
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

async function finishEmailSignIn(email, _signInUrl) {
    if (!email) {
        showToast('⚠️ Could not determine your email. Please sign in again from the app.');
        return;
    }

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

        // Sign in with email link (use saved URL that still has Firebase params)
        console.log('[Email Sign-In] Starting signInWithEmailLink for:', email);
        const result = await auth.signInWithEmailLink(email, _signInUrl);
        console.log('[Email Sign-In] Sign-in result:', result.user ? result.user.uid : 'no user');
        localStorage.removeItem('btc_signin_email');

        // Check if this email user already has data
        const emailUid = result.user.uid;

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

        if (!existingDoc.exists && anonData) {
            // Migrate anonymous data to email account
            anonData.email = email;
            await db.collection('users').doc(emailUid).set(anonData);
        } else if (existingDoc.exists && anonData) {
            // Existing email user — merge points if anon had more (one-time only)
            const existData = existingDoc.data();
            var _mergedPts = Math.min(anonData.points || 0, 500);
                if (!existData.mergedAnon && _mergedPts > (existData.points || 0)) {
                await existingDoc.ref.update({
                    points: Math.max(_mergedPts, existData.points || 0),
                    channelsVisited: Math.max(anonData.channelsVisited || 0, existData.channelsVisited || 0),
                    totalVisits: (existData.totalVisits || 0) + (anonData.totalVisits || 0),
                    mergedAnon: true,
                });
            }
        }

        // Delete the old anonymous user document to prevent duplicates on leaderboard
        if (anonUid && anonUid !== emailUid) {
            try { await db.collection('users').doc(anonUid).delete(); } catch(e) {}
        }

        // Clean URL
        window.history.replaceState(null, '', window.location.pathname + window.location.hash);

        // Check if this was a new registration (pending username from signup form)
        const pendingUsername = localStorage.getItem('btc_pending_username');
        const pendingEmail = localStorage.getItem('btc_pending_email');
        const pendingGiveaway = localStorage.getItem('btc_pending_giveaway');

        if (pendingUsername && !existingDoc.exists) {
            // New user verifying their email — create their full account now
            const userData = {
                username: pendingUsername,
                email: email,
                points: 0,
                channelsVisited: 0,
                totalVisits: 1,
                streak: 1,
                lastVisit: new Date().toISOString().split('T')[0],
                created: firebase.firestore.FieldValue.serverTimestamp()
            };
            if (pendingGiveaway) {
                userData.lightningAddress = pendingGiveaway;
                userData.giveaway = {
                    entered: true,
                    lightningAddress: pendingGiveaway,
                    enteredAt: new Date().toISOString()
                };
                try {
                    await db.collection('giveaway_entries').doc(emailUid).set({
                        username: pendingUsername,
                        lightningAddress: pendingGiveaway,
                        email: email,
                        enteredAt: firebase.firestore.FieldValue.serverTimestamp(),
                        uid: emailUid
                    });
                } catch(e) {}
            }
            await db.collection('users').doc(emailUid).set(userData);
            try { db.collection('stats').doc('global').set({ userCount: firebase.firestore.FieldValue.increment(1) }, { merge: true }).catch(function() {}); } catch(e) {}

            // Attach referral if they came via referral link
            if (typeof attachReferral === 'function') attachReferral(emailUid);
        }

        // Clean up pending data
        localStorage.removeItem('btc_pending_username');
        localStorage.removeItem('btc_pending_email');
        localStorage.removeItem('btc_pending_giveaway');
        // 🗑️ SECURITY HARDENING (C-NEW-13): Wipe ghost on-chain wallet data
        localStorage.removeItem('btc_wallet_enc');
        localStorage.removeItem('btc_wallet_addrs');

        loadUser(emailUid);
        showToast('✅ Email verified! Signed in as ' + escapeHtml(pendingUsername || email));
        if (pendingGiveaway) {
            setTimeout(function() { showToast('🎉 You\'re entered for the 25,000 sats giveaway! Good luck!'); }, 2000);
        }
    } catch(e) {
        console.error('[Email Sign-In] Full error:', e.code, e.message, e.stack);
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

// Google Sign-In — uses Google Identity Services (GIS) for PWA compatibility
var GOOGLE_CLIENT_ID = '1055248200518-jcn5efjp7vhk0vm8cbmj4mfsgc0edkga.apps.googleusercontent.com';

window.signInWithGoogle = async function() {
    var isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
    // On desktop, try GIS One Tap (fast if available)
    // On mobile, skip GIS entirely — go straight to Firebase popup (faster, more reliable)
    if (!isMobile && typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        try {
            await signInWithGIS();
            return;
        } catch(gisErr) {
            console.warn('[Auth] GIS failed, falling back to Firebase popup:', gisErr);
            try { google.accounts.id.cancel(); } catch(e) {}
            document.querySelectorAll('[id*="credential_picker"], [id*="g_id_"], iframe[src*="accounts.google.com"]').forEach(function(el) { el.remove(); });
        }
    }
    // Firebase popup/redirect
    await signInWithProvider(new firebase.auth.GoogleAuthProvider());
};

async function signInWithGIS() {
    var saved = await _saveAnonDataGlobal();
    return new Promise(function(resolve, reject) {
        var anonUid = saved.anonUid;
        var anonData = saved.anonData;

        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: async function(response) {
                if (!response || !response.credential) {
                    reject(new Error('No credential received'));
                    return;
                }
                try {
                    var credential = firebase.auth.GoogleAuthProvider.credential(response.credential);
                    var result = await auth.signInWithCredential(credential);
                    // Clean up ALL GIS UI elements
                    try { google.accounts.id.cancel(); } catch(e) {}
                    var _gsiBtn = document.getElementById('gsi-temp-btn');
                    if (_gsiBtn) { var _bd = _gsiBtn.closest('div[style*="position:fixed"]'); if (_bd) _bd.remove(); else _gsiBtn.remove(); }
                    document.querySelectorAll('[id*="credential_picker"], [id*="g_id_"], iframe[src*="accounts.google.com"]').forEach(function(el) { el.remove(); });
                    await _handleSignInResultGlobal(result.user, anonUid, anonData);
                    resolve(result.user);
                } catch(e) {
                    reject(e);
                }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
            context: 'signin',
            ux_mode: 'popup'
        });

        // Try One Tap first
        google.accounts.id.prompt(function(notification) {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                // One Tap not available — fall back to Firebase popup immediately (no second button)
                console.log('[Auth] One Tap not shown, falling back to Firebase popup');
                reject(new Error('One Tap unavailable'));
            }
        });
    });
}

// Twitter/X Sign-In — no client SDK, must use Firebase popup/redirect
window.signInWithTwitter = async function() {
    var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
        try {
            var _ad = await _saveAnonDataGlobal();
            var result = await auth.signInWithPopup(new firebase.auth.TwitterAuthProvider());
            await _handleSignInResultGlobal(result.user, _ad.anonUid, _ad.anonData);
            return;
        } catch(e) {
            if (e.code === 'auth/popup-closed-by-user') return;
            showPWAAuthFallback('Twitter');
            return;
        }
    }
    await signInWithProvider(new firebase.auth.TwitterAuthProvider());
}

// GitHub Sign-In
window.signInWithGithub = async function() {
    var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
        try {
            var _ad = await _saveAnonDataGlobal();
            var result = await auth.signInWithPopup(new firebase.auth.GithubAuthProvider());
            await _handleSignInResultGlobal(result.user, _ad.anonUid, _ad.anonData);
            return;
        } catch(e) {
            if (e.code === 'auth/popup-closed-by-user') return;
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

// Facebook Sign-In — uses FB SDK for PWA compatibility
var FB_APP_ID = '1400842698021858';

window.fbAsyncInit = function() {
    FB.init({ appId: FB_APP_ID, cookie: true, xfbml: false, version: 'v19.0' });
};

window.signInWithFacebook = async function() {
    if (typeof FB !== 'undefined') {
        try {
            await signInWithFBSDK();
            return;
        } catch(fbErr) {
            if (fbErr.message === 'Facebook login cancelled') return;
            console.warn('[Auth] FB SDK failed:', fbErr);
        }
    }
    await signInWithProvider(new firebase.auth.FacebookAuthProvider());
}

async function signInWithFBSDK() {
    var saved = await _saveAnonDataGlobal();
    return new Promise(function(resolve, reject) {
        FB.login(function(response) {
            if (!response.authResponse) { reject(new Error('Facebook login cancelled')); return; }
            var credential = firebase.auth.FacebookAuthProvider.credential(response.authResponse.accessToken);
            auth.signInWithCredential(credential).then(async function(result) {
                await _handleSignInResultGlobal(result.user, saved.anonUid, saved.anonData);
                resolve(result.user);
            }).catch(reject);
        }, { scope: 'email,public_profile' });
    });
}

// Nostr sign-in — full modal with extension/nsec/npub options
// Uses nostr-tools CDN for nsec decoding, signing, and key derivation
window.signInWithNostr = async function() {
    if (!checkRateLimit()) return;
    var hasExtension = !!window.nostr;
    var overlay = document.createElement('div');
    overlay.id = 'nostrAuthOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;';
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

// nsec sign-in — uses nostr-tools CDN for key derivation and signing
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

// npub linking (read-only — links pubkey to current account)
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

// Complete Nostr auth — send signed event to Cloud Function for verification
window.nostrCompleteAuth = async function(pubkey, sig, event) {
    var statusEl = document.getElementById('nostrAuthStatus');
    try {
        var nostrAuth = firebase.functions().httpsCallable('nostrAuth');
        var result = await nostrAuth({ pubkey: pubkey, sig: sig, event: event });
        if (result.data && result.data.token) {
            await auth.signInWithCustomToken(result.data.token);
            var uid = result.data.uid;
            var userDoc = await db.collection('users').doc(uid).get();
            if (!userDoc.exists || !userDoc.data().username) {
                var npubShort = 'npub...' + pubkey.substring(0, 8);
                var _nostrUserData = { username: npubShort, nostr: pubkey, totalVisits: 1, streak: 1, lastVisit: new Date().toISOString().split('T')[0] };
                if (!userDoc.exists) { _nostrUserData.points = 0; _nostrUserData.channelsVisited = 0; _nostrUserData.created = firebase.firestore.FieldValue.serverTimestamp(); }
                await db.collection('users').doc(uid).set(_nostrUserData, { merge: true });
                try { db.collection('stats').doc('global').set({ userCount: firebase.firestore.FieldValue.increment(1) }, { merge: true }).catch(function() {}); } catch(e) {}
            }
            loadUser(uid); hideUsernamePrompt();
            var overlay = document.getElementById('nostrAuthOverlay'); if (overlay) overlay.remove();
            showToast('🟣 Signed in with Nostr!');
        } else { if (statusEl) statusEl.innerHTML = '<span style="color:#ef4444;">Auth failed — no token received</span>'; }
    } catch(e) { console.error('Nostr auth error:', e); if (statusEl) statusEl.innerHTML = '<span style="color:#ef4444;">Verification failed: ' + (e.message || 'Unknown') + '</span>'; }
};

// Apple Sign-In removed

// Lightning (LNURL-auth) Sign-In
window.signInWithLightning = async function() {
    if (!checkRateLimit()) return;

    // Show modal immediately with loading skeleton (Cloud Function can be slow on cold start)
    var qrModal = document.createElement('div');
    qrModal.id = 'lnAuthModal';
    qrModal.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.8);';
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
                var qrImg = document.createElement('img');
                qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent('lightning:' + lnurlEncoded);
                qrImg.width = 220; qrImg.height = 220; qrImg.alt = 'Lightning Auth QR';
                qrImg.style.cssText = 'border-radius:8px;';
                qrContainer.appendChild(qrImg);
            }
        }

        // Show copy button now that we have the LNURL
        var copyWrap = document.getElementById('lnAuthCopyWrap');
        if (copyWrap) {
            copyWrap.style.display = 'block';
            copyWrap.innerHTML = '<button onclick="navigator.clipboard.writeText(\'' + lnurlEncoded + '\').then(function(){showToast(\'Copied!\');})" style="padding:8px 16px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.8rem;cursor:pointer;font-family:inherit;">📋 Copy LNURL</button>';
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
                    if (!userDoc.exists || !userDoc.data().username) {
                        var lnName = '⚡anon-' + k1.substring(0, 8);
                        var _lnUserData = { username: lnName, authMethod: 'lightning', totalVisits: 1, streak: 1, lastVisit: new Date().toISOString().split('T')[0] };
                        if (!userDoc.exists) { _lnUserData.points = 0; _lnUserData.channelsVisited = 0; _lnUserData.created = firebase.firestore.FieldValue.serverTimestamp(); }
                        await db.collection('users').doc(uid).set(_lnUserData, { merge: true });
                        try { db.collection('stats').doc('global').set({ userCount: firebase.firestore.FieldValue.increment(1) }, { merge: true }).catch(function() {}); } catch(e) {}
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

// Session timeout — sign out after 30 min inactivity
// Session timer removed — users stay signed in indefinitely via Firebase LOCAL persistence

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
    var existingDoc = await db.collection('users').doc(user.uid).get();
    if (!existingDoc.exists) {
        if (anonData) {
            anonData.email = user.email || '';
            if (!anonData.username) anonData.username = user.displayName || 'Bitcoiner';
            await db.collection('users').doc(user.uid).set(anonData);
        } else {
            await db.collection('users').doc(user.uid).set({
                username: user.displayName || 'Bitcoiner',
                email: user.email || '',
                points: 0, channelsVisited: 0, totalVisits: 1, streak: 1,
                lastVisit: new Date().toISOString().split('T')[0],
                created: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    } else {
        if (anonData) {
            var existData = existingDoc.data();
            var _mergedPts = Math.min(anonData.points || 0, 500);
            if (!existData.mergedAnon && _mergedPts > (existData.points || 0)) {
                await existingDoc.ref.update({
                    points: Math.max(_mergedPts, existData.points || 0),
                    channelsVisited: Math.max(anonData.channelsVisited || 0, existData.channelsVisited || 0),
                    totalVisits: (existData.totalVisits || 0) + (anonData.totalVisits || 0),
                    mergedAnon: true,
                });
            }
        }
        if (!existingDoc.data().email && user.email) {
            await existingDoc.ref.update({ email: user.email });
        }
    }
    if (anonUid && anonUid !== user.uid) {
        try { await db.collection('users').doc(anonUid).delete(); } catch(e) {}
    }
    loadUser(user.uid);
    if (!existingDoc.exists) {
        if (typeof attachReferral === 'function') attachReferral(user.uid);
        showGiveawayPrompt(user.uid, user.displayName || user.email || 'Bitcoiner');
        // Show Quest Guide for brand new provider sign-ups
        try {
            localStorage.removeItem('guide_dismissed');
            localStorage.removeItem('guide_seen');
            if (typeof showGuide === 'function') {
                setTimeout(function() { showGuide(); }, 1500);
            }
        } catch(e) {}
    } else {
        hideUsernamePrompt();
        showToast('✅ Signed in as ' + escapeHtml(user.displayName || user.email || 'Bitcoiner'));
    }
}

async function signInWithProvider(provider) {
    if (!checkRateLimit()) return;

    // In-app browsers can't do popups or redirects reliably — open in system browser
    if (isInAppBrowser()) {
        var _ua = navigator.userAgent || '';
        var _hint = /iPhone|iPad/i.test(_ua) ? 'Tap the share icon (↑) → "Open in Safari"'
            : /Android/i.test(_ua) ? 'Tap ⋮ (menu) → "Open in Browser"'
            : 'Open this page in your default browser';
        var _iab = document.createElement('div');
        _iab.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.9);padding:20px;';
        _iab.innerHTML = '<div style="background:var(--bg-side,#1a1a2e);border:2px solid var(--accent);border-radius:20px;padding:28px;max-width:380px;width:90%;text-align:center;">' +
            '<div style="font-size:2.5rem;margin-bottom:12px;">🌐</div>' +
            '<h3 style="color:var(--heading);margin-bottom:8px;">Open in Browser</h3>' +
            '<p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:16px;">Sign-in doesn\'t work inside apps. ' + _hint + '</p>' +
            '<button onclick="navigator.clipboard.writeText(window.location.href);if(typeof showToast===\'function\')showToast(\'📋 Link copied!\')" style="width:100%;padding:12px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:8px;">📋 Copy Link</button>' +
            '<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="width:100%;padding:10px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text-muted);cursor:pointer;font-family:inherit;">Close</button>' +
        '</div>';
        document.body.appendChild(_iab);
        return;
    }

    // Delegate to module-scope helper
    async function handleSignInResult(user, anonUid, anonData) {
        return _handleSignInResultGlobal(user, anonUid, anonData);
    }
    async function saveAnonData() {
        return _saveAnonDataGlobal();
    }

    // Strategy: Use popup on desktop (reliable), redirect on mobile/PWA.
    // Redirect loses session cross-domain but at least shows the Google sign-in page.
    // Popup on Android PWA causes redirect_uri_mismatch errors.
    var isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
    var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    if (isMobileDevice || isStandalone) {
        // Mobile: try popup first (works on most modern mobile browsers),
        // fall back to redirect if popup fails.
        try {
            showToast('⏳ Opening sign-in...');
            // Save anon data BEFORE anything async (non-blocking fire-and-forget)
            const anonUser = auth.currentUser;
            if (anonUser && anonUser.isAnonymous) {
                localStorage.setItem('btc_anon_uid', anonUser.uid);
                db.collection('users').doc(anonUser.uid).get().then(function(doc) {
                    if (doc.exists) localStorage.setItem('btc_anon_data', JSON.stringify(doc.data()));
                }).catch(function() {});
            }
            // Try popup first (faster, doesn't lose page context)
            try {
                const result = await auth.signInWithPopup(provider);
                if (result && result.user) {
                    const { anonUid, anonData } = await saveAnonData();
                    await handleSignInResult(result.user, anonUid, anonData);
                    return;
                }
            } catch(popupErr) {
                console.log('[Auth] Mobile popup failed, falling back to redirect:', popupErr.code);
                // Popup failed — use redirect
                sessionStorage.setItem('btc_redirect_pending', '1');
                localStorage.setItem('btc_pwa_auth_pending', '1');
                await auth.signInWithRedirect(provider);
                return;
            }
        } catch(e) {
            console.error('Mobile sign-in error:', e);
            showToast('Sign-in failed: ' + (e.message || 'Unknown error'));
            return;
        }
    }

    // Desktop: try popup first
    try {
        const { anonUid, anonData } = await saveAnonData();

        const result = await auth.signInWithPopup(provider);
        await handleSignInResult(result.user, anonUid, anonData);
    } catch(e) {
        console.error('Provider sign-in error:', e.code, e.message, e);

        // Popup blocked, closed, or failed — fallback to redirect
        if (e.code === 'auth/popup-blocked' ||
            e.code === 'auth/cancelled-popup-request' ||
            e.code === 'auth/popup-closed-by-user' ||
            e.code === 'auth/internal-error') {
            try {
                showToast('⏳ Opening sign-in page...');
                // Save anon data to localStorage so redirect return can recover it
                const anonUser = auth.currentUser;
                if (anonUser && anonUser.isAnonymous) {
                    localStorage.setItem('btc_anon_uid', anonUser.uid);
                    try {
                        const anonDoc = await db.collection('users').doc(anonUser.uid).get();
                        if (anonDoc.exists) {
                            localStorage.setItem('btc_anon_data', JSON.stringify(anonDoc.data()));
                        }
                    } catch(e2) {}
                }
                localStorage.setItem('btc_pwa_auth_pending', '1');
                await auth.signInWithRedirect(provider);
                return;
            } catch(redirectErr) {
                console.error('Redirect fallback also failed:', redirectErr);
                showToast('Sign-in failed. Please try a different browser.');
            }
            return;
        }

        // User intentionally closed popup — do nothing
        if (e.code === 'auth/popup-closed-by-user') return;

        // Actionable error messages
        if (e.code === 'auth/unauthorized-domain') {
            showToast('⚠️ This domain is not authorized for sign-in. Please contact support.');
        } else if (e.code === 'auth/operation-not-allowed') {
            showToast('⚠️ This sign-in method is not enabled. Try a different option.');
        } else if (e.code === 'auth/account-exists-with-different-credential') {
            showToast('⚠️ An account with this email exists using a different sign-in method. Try another option.');
        } else if (e.code === 'auth/network-request-failed') {
            showToast('⚠️ Network error. Check your connection and try again.');
        } else {
            showToast('Sign-in error (' + (e.code || 'unknown') + '). Please try again.');
        }
    }
}

// Show giveaway registration for new provider sign-ins
function showGiveawayPrompt(uid, displayName) {
    const modal = document.getElementById('usernameModal');
    const box = modal.querySelector('.username-box');
    box.innerHTML =
        '<h2>🎉 Welcome, ' + displayName + '!</h2>' +
        '<p style="color:var(--text-muted);margin-bottom:16px;">Your account is all set. Want to enter the giveaway?</p>' +
        '<div style="background:linear-gradient(135deg,rgba(247,147,26,0.1),rgba(234,88,12,0.05));border:1px solid rgba(247,147,26,0.3);border-radius:12px;padding:14px;margin-bottom:16px;text-align:left;">' +
            '<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;margin-bottom:10px;">' +
                '<input type="checkbox" id="giveawayCheckboxProvider" checked style="width:20px;height:20px;accent-color:#f7931a;margin-top:2px;flex-shrink:0;cursor:pointer;">' +
                '<span style="color:var(--text);font-size:0.9rem;font-weight:600;line-height:1.4;">🎉 Register for the <span style="color:#f7931a;">25,000 sats giveaway!</span></span>' +
            '</label>' +
            '<div>' +
                '<input type="text" id="giveawayLnProvider" placeholder="⚡ you@walletofsatoshi.com" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" style="width:100%;padding:14px 16px;background:var(--input-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:16px;font-family:inherit;outline:none;box-sizing:border-box;-webkit-appearance:none;margin-bottom:8px;">' +
                '<button onclick="pasteToField(\'giveawayLnProvider\')" style="width:100%;padding:10px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:0.8rem;font-weight:600;cursor:pointer;font-family:inherit;touch-action:manipulation;">📋 Paste from clipboard</button>' +
            '</div>' +
            '<p style="color:var(--text-faint);font-size:0.7rem;margin:6px 0 0;">Enter a Lightning address so we can send you the sats if you win! 🏆</p>' +
        '</div>' +
        '<button onclick="submitGiveawayProvider(\'' + uid + '\',\'' + displayName.replace(/[\\'"]/g, "") + '\')" style="width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:8px;">Enter Giveaway & Continue →</button>' +
        '<button onclick="hideUsernamePrompt();showToast(\'✅ Welcome, ' + displayName.replace(/[\\'"]/g, "") + '!\')" style="width:100%;padding:12px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.9rem;font-weight:600;cursor:pointer;font-family:inherit;">Skip → Start Learning</button>';
    modal.classList.add('open');

    // Toggle lightning address visibility
    document.getElementById('giveawayCheckboxProvider').addEventListener('change', function() {
        document.getElementById('giveawayLnProvider').parentElement.style.display = this.checked ? 'flex' : 'none';
    });
}

async function submitGiveawayProvider(uid, displayName) {
    var checkbox = document.getElementById('giveawayCheckboxProvider');
    var lnInput = document.getElementById('giveawayLnProvider');
    var lnAddress = lnInput ? lnInput.value.trim() : '';

    if (checkbox && checkbox.checked) {
        if (!lnAddress) {
            if (lnInput) lnInput.style.borderColor = '#ef4444';
            showToast('⚡ Please enter a Lightning address!');
            return;
        }
        // Save giveaway entry
        try {
            await db.collection('users').doc(uid).update({
                lightningAddress: lnAddress,
                giveaway: {
                    entered: true,
                    lightningAddress: lnAddress,
                    enteredAt: new Date().toISOString()
                }
            });
            if (typeof currentUser !== 'undefined' && currentUser) currentUser.lightningAddress = lnAddress;
            await db.collection('giveaway_entries').doc(uid).set({
                username: displayName,
                lightningAddress: lnAddress,
                enteredAt: firebase.firestore.FieldValue.serverTimestamp(),
                uid: uid
            });
            showToast('🎉 You\'re entered for the 25,000 sats giveaway! Good luck!');
        } catch(e) {
            console.log('Giveaway save error:', e);
        }
    }

    hideUsernamePrompt();
    showToast('✅ Signed in as ' + displayName);
    var banner = document.getElementById('giveawayBanner');
    if (banner) banner.style.display = 'none';
}

// Returning user: send magic link to sign back in
window.sendReturningMagicLink = async function() {
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

// Load anonymous user from localStorage only — no Firestore reads
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
    startReadTimer();
}

async function loadUser(uid, prefetchedDoc) {
    const doc = prefetchedDoc || await db.collection('users').doc(uid).get();
    if (doc.exists) {
        currentUser = { uid, ...doc.data() };
        // Restore visited channels so we don't re-award
        if (currentUser.visitedChannelsList) {
            currentUser.visitedChannelsList.forEach(ch => allTimeChannels.add(ch));
        }

        const isRealUser = auth.currentUser && !auth.currentUser.isAnonymous;

        // Sync read checkmarks: for real users, use Firebase as source of truth
        if (currentUser.readChannels) {
            if (isRealUser) {
                localStorage.setItem('btc_visited_channels', JSON.stringify(currentUser.readChannels));
            } else {
                let local = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]');
                let merged = [...new Set([...local, ...currentUser.readChannels])];
                localStorage.setItem('btc_visited_channels', JSON.stringify(merged));
            }
            restoreVisitedUI();
        } else if (isRealUser) {
            // Real user with no readChannels in Firebase — clear local
            localStorage.setItem('btc_visited_channels', '[]');
            restoreVisitedUI();
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
            // No bookmarks in Firebase yet — push local ones up if any exist
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

        // Update high-res lastActive timestamp for DAU tracking
        if (!auth.currentUser.isAnonymous) {
            db.collection('users').doc(uid).update({ 
                lastActive: firebase.firestore.FieldValue.serverTimestamp() 
            }).catch(function() {});
        }

        // Restore badges and scholar status from Firebase
        if (isRealUser) {
            if (currentUser.hiddenBadges) {
                // Merge Firebase hidden badges into localStorage (don't replace — avoids losing locally-earned badges)
                var existingHidden = JSON.parse(localStorage.getItem('btc_hidden_badges') || '[]');
                var mergedHidden = [...new Set([...existingHidden, ...currentUser.hiddenBadges])];
                localStorage.setItem('btc_hidden_badges', JSON.stringify(mergedHidden));
            }
            if (currentUser.visibleBadges) {
                // Merge Firebase badges into localStorage
                var existing = JSON.parse(localStorage.getItem('btc_badges') || '[]');
                var merged = [...new Set([...existing, ...currentUser.visibleBadges])];
                localStorage.setItem('btc_badges', JSON.stringify(merged));
            }
            if (currentUser.spinClosetItems) {
                var existingItems = JSON.parse(localStorage.getItem('btc_spin_closet_items') || '[]');
                var mergedItems = [...new Set([...existingItems, ...currentUser.spinClosetItems])];
                localStorage.setItem('btc_spin_closet_items', JSON.stringify(mergedItems));
            }
            if (currentUser.scholarPassed) {
                localStorage.setItem('btc_scholar_passed', 'true');
            }
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
            // Restore Nacho interaction counts — use max of Firebase vs localStorage
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
        }

        // Sync PVP stats: Firestore is always source of truth (prevents cross-account bleed on same device)
        localStorage.setItem('btc_pvp_wins', String(currentUser.pvpWins || 0));
        localStorage.setItem('btc_pvp_losses', String(currentUser.pvpLosses || 0));

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

        // Badges are now safe to check — Firebase data has been restored
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
        if (typeof showContinueReading === 'function') showContinueReading();

        // Update auth button text if signed in with a provider
        updateAuthButton();

        // Initialize Orange Tickets system
        if (typeof onUserLoadedTickets === 'function') onUserLoadedTickets();
        // Initialize messaging (presence + unread polling)
        if (typeof initMessaging === 'function') initMessaging();

    } else {
        // User exists in auth but not in Firestore — recreate their doc
        const user = auth.currentUser;
        if (user && !user.isAnonymous) {
            const newData = {
                username: user.displayName || 'Bitcoiner',
                email: user.email || '',
                points: 0,
                channelsVisited: 0,
                totalVisits: 1,
                streak: 1,
                lastVisit: new Date().toISOString().split('T')[0],
                created: firebase.firestore.FieldValue.serverTimestamp()
            };
            await db.collection('users').doc(uid).set(newData);
            currentUser = { uid, ...newData };
            rankingReady = true;
            window._badgesReady = true;
        if (typeof markVisibleBadgesReady === "function") markVisibleBadgesReady(); window._hiddenBadgesReady = true;
            updateRankUI();
            updateAuthButton();
        }
    }
}

// Track if button was ever set to "signed in" state — never downgrade once set
var _authBtnSignedIn = false;

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
        // Auth still exists but Firestore temporarily lost — don't downgrade
        return;
    } else if (!firebaseUser) {
        // Actually signed out
        _authBtnSignedIn = false;
    }
    
    if (_authBtnSignedIn) {
        var name = displayName || 'My Account';
        btn.innerHTML = '⚙️ <strong>' + (typeof escapeHtml === 'function' ? escapeHtml(name) : name) + '</strong> — Settings';
        btn.onclick = function() { showSettings(); };
        // Hide on mobile — mobile top bar already shows username + Topics
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

    // Update giveaway banner for signed-in users
    var giveawayBanner = document.getElementById('giveawayBanner');
    if (giveawayBanner && _authBtnSignedIn) {
        var hasGiveaway = currentUser && currentUser.giveaway;
        if (hasGiveaway) {
            giveawayBanner.innerHTML =
                '<div style="position:absolute;top:-20px;right:-20px;font-size:5rem;opacity:0.15;pointer-events:none;">⚡</div>' +
                '<div style="font-size:1.8rem;margin-bottom:6px;">🎉 25,000 SATS GIVEAWAY 🎉</div>' +
                '<div style="color:rgba(255,255,255,0.95);font-size:1rem;font-weight:600;">You\'re entered! Good luck! 🍀</div>' +
                '<div style="display:inline-block;margin-top:12px;padding:10px 24px;background:rgba(255,255,255,0.2);border:2px solid rgba(255,255,255,0.5);border-radius:10px;color:#fff;font-weight:700;font-size:0.95rem;letter-spacing:0.5px;">✅ Entered</div>';
            giveawayBanner.onclick = function() { showSettings(); };
        } else {
            giveawayBanner.querySelector('div:last-child') && (giveawayBanner.querySelector('div:last-child').textContent = '⚙️ View Your Profile →');
            giveawayBanner.onclick = function() { showSettings(); };
        }
    }
}

// Sanitize user input — strip HTML tags and dangerous chars
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

async function createUser(username, email, enteredGiveaway, giveawayLnAddress, country) {
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
    // Clear any leftover data from previous users on this browser
    clearUserData();
    username = sanitizeInput(username);
    // Strip non-ASCII characters (prevents Unicode/homoglyph bypass)
    username = username.replace(/[^\x20-\x7E]/g, '').replace(/[\\'"<>]/g, '').trim();
    if (!username || username.length < 2) {
        showToast('⚠️ Username must be at least 2 characters (letters, numbers, basic symbols only).');
        return;
    }
    if (containsProfanity(username)) {
        showToast('⚠️ That username is not allowed. Please choose another.');
        return;
    }
    if (email) email = sanitizeInput(email);
    const userData = {
        username: username,
        points: 0,
        channelsVisited: 0,
        totalVisits: 1,
        streak: 1,
        lastVisit: new Date().toISOString().split('T')[0],
        created: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (email) userData.email = email;
    if (country) userData.country = country;
    if (enteredGiveaway && giveawayLnAddress) {
        userData.lightningAddress = giveawayLnAddress;
        userData.giveaway = {
            entered: true,
            lightningAddress: giveawayLnAddress,
            enteredAt: new Date().toISOString()
        };
        // Also save to a separate giveaway collection for easy admin access
        try {
            await db.collection('giveaway_entries').doc(uid).set({
                username: username,
                lightningAddress: giveawayLnAddress,
                email: email || null,
                enteredAt: firebase.firestore.FieldValue.serverTimestamp(),
                uid: uid
            });
        } catch(e) { console.log('Giveaway entry save error:', e); }
    }
    await db.collection('users').doc(uid).set(userData);
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
    // Show Quest Guide for new accounts (reset dismiss so they see it fresh)
    try {
        localStorage.removeItem('guide_dismissed');
        localStorage.removeItem('guide_seen');
        if (typeof showGuide === 'function') {
            setTimeout(function() { showGuide(); }, 800);
        }
    } catch(e) {}
    // Hide giveaway banner after registration
    var banner = document.getElementById('giveawayBanner');
    if (banner) banner.style.display = 'none';

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
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Only award once per day — no refresh exploits
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
            // No freeze available — streak is broken
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
            showToast('🔥 STREAK MILESTONE! Day ' + newStreak + ': Earned +' + bonusTickets + ' Bonus Tickets! 🎟️');
        }, 3500);
    } else if (streakBonus) {
        showToast('🔥 Day ' + currentUser.streak + ' streak! +' + (POINTS.visit + POINTS.streak) + ' XP');
    }
    // Silent for non-streak daily visits — ticket toast covers it
    updateRankUI();
    if (typeof renderProgressRings === 'function') renderProgressRings();
    refreshLeaderboardIfOpen();
}

async function awardPoints(pts, reason, channelId, tickets, streakFreezes) {
    if (!currentUser || !rankingReady) return;

    // Anti-abuse: validate pts is a reasonable number
    pts = parseInt(pts);
    if (isNaN(pts) || pts < 0 || pts > 2200) return;
    // Allow 0 pts if tickets or streakFreezes are being awarded
    if (pts === 0 && !tickets && !streakFreezes) return;

    // Anti-abuse: rate limit — max 20 point awards per minute
    window._pointAwardTimes = window._pointAwardTimes || [];
    var _now = Date.now();
    window._pointAwardTimes = window._pointAwardTimes.filter(function(t) { return _now - t < 60000; });
    if (window._pointAwardTimes.length >= 20) return;
    window._pointAwardTimes.push(_now);

    if (currentUser._isLocal) {
        // ── Anonymous / local-only user ──
        // Track points in localStorage. Daily cap 500. Server-side validation happens
        // later if they ever sign in (via anon_merge), so this is purely UX reward.
        var DAILY_CAP = 500;
        var _today = new Date().toISOString().split('T')[0];
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
                if (typeof showToast === 'function') showToast('⏳ Slow down — cooldown still active');
                return;
            }
            try { localStorage.setItem(cdKey, String(Date.now())); } catch(e) {}
        }

        // Anon overflow mirror: redeem yesterday's overflow first, then award today's pts.
        var _overflowKey = 'btc_pts_overflow';
        var _overflowDateKey = 'btc_pts_overflow_date';
        var _overflow = parseInt(localStorage.getItem(_overflowKey) || '0', 10) || 0;
        var _overflowDate = localStorage.getItem(_overflowDateKey) || '';
        var overflowRedeemed = 0;
        if (_overflow > 0 && _overflowDate && _overflowDate !== _today) {
            overflowRedeemed = Math.min(_overflow, DAILY_CAP);
            _overflow -= overflowRedeemed;
            try { localStorage.setItem(_overflowKey, String(_overflow)); } catch(e) {}
        }

        var awarded = pts;
        var overflowAdded = 0;
        if (_dailyUsed >= DAILY_CAP) {
            awarded = 0;
            overflowAdded = pts;
        } else if (_dailyUsed + pts > DAILY_CAP) {
            awarded = DAILY_CAP - _dailyUsed;
            overflowAdded = pts - awarded;
        }

        var totalAdded = awarded + overflowRedeemed;
        if (totalAdded > 0) {
            var newPoints = (parseInt(localStorage.getItem('btc_points') || '0', 10) || 0) + totalAdded;
            try {
                localStorage.setItem('btc_points', String(newPoints));
                if (awarded > 0) localStorage.setItem(_capKey, String(_dailyUsed + awarded));
            } catch(e) {}
            currentUser.points = newPoints;
            _showPointsToast(awarded, reason);
            if (typeof notifySelfPoints === 'function') notifySelfPoints(awarded, reason);
            if (overflowRedeemed > 0 && typeof showToast === 'function') {
                setTimeout(function() {
                    showToast('♻️ +' + overflowRedeemed + ' overflow pts redeemed from prior day!', 4000);
                }, 1200);
            }
        }

        if (overflowAdded > 0) {
            _overflow += overflowAdded;
            try {
                localStorage.setItem(_overflowKey, String(_overflow));
                localStorage.setItem(_overflowDateKey, _today);
            } catch(e) {}
            var _overflowNotifKey = 'btc_overflow_notified_' + _today;
            if (!localStorage.getItem(_overflowNotifKey)) {
                try { localStorage.setItem(_overflowNotifKey, '1'); } catch(e) {}
                if (typeof showToast === 'function') showToast('🎯 Daily cap reached (500)! +' + overflowAdded + ' XP banked as overflow — they roll over tomorrow. Sign in to convert to sats.', 8000);
                if (typeof _updateCapIndicator === 'function') _updateCapIndicator(true);
            }
        } else if (_dailyUsed + awarded >= DAILY_CAP) {
            // Daily cap notification (once per day)
            var _capNotifKey = 'btc_daily_cap_notified_' + _today;
            if (!localStorage.getItem(_capNotifKey)) {
                try { localStorage.setItem(_capNotifKey, '1'); } catch(e) {}
                if (typeof showToast === 'function') showToast('🎯 Daily cap hit (500)! Further XP today rolls over to tomorrow. Sign in to convert to sats.', 8000);
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
    // (CF is async — user may navigate away before it returns)
    if (pts > 0 && reason && typeof notifySelfPoints === 'function') {
        notifySelfPoints(pts, reason);
    }
    try {
        var awardPointsFn = firebase.functions().httpsCallable('awardPoints');
        var payload = { pts: pts, action: reason || '', reason: reason || '' };
        if (channelId) payload.channelId = channelId;
        if (tickets) payload.tickets = tickets;
        if (streakFreezes) payload.streakFreezes = streakFreezes;
        var result = await awardPointsFn(payload);
        if (result.data && result.data.dailyActionCapped) {
            if (typeof showToast === 'function') showToast('⏳ ' + (result.data.error || 'Daily limit reached for this action.'), 6000);
        }
        if (result.data && result.data.cooldown) {
            if (typeof showToast === 'function') showToast('⏳ ' + (result.data.error || 'Slow down a bit.'), 4000);
        }
        if (result.data && result.data.success) {
            var awarded = result.data.awarded || 0;
            var overflowRedeemed = result.data.overflowRedeemed || 0;
            var overflowAdded = result.data.overflowAdded || 0;
            var pendingOverflow = result.data.pendingOverflow || 0;
            var totalAdded = awarded + overflowRedeemed;
            if (totalAdded > 0) {
                currentUser.points = (currentUser.points || 0) + totalAdded;
                _showPointsToast(awarded, reason);
                // Notification already logged eagerly before CF call
                if (overflowRedeemed > 0) {
                    setTimeout(function() {
                        showToast('♻️ +' + overflowRedeemed + ' overflow pts redeemed from prior day!', 4000);
                    }, 1200);
                }
            }
            if (overflowAdded > 0) {
                var _overflowKey = 'btc_overflow_notified_' + new Date().toISOString().split('T')[0];
                if (!localStorage.getItem(_overflowKey)) {
                    localStorage.setItem(_overflowKey, '1');
                    showToast('🎯 Daily cap reached (500)! +' + overflowAdded + ' XP banked as overflow — they roll over tomorrow.', 8000);
                    _updateCapIndicator(true);
                }
                // Cache pendingOverflow locally for the CAP indicator tooltip
                try { localStorage.setItem('btc_pts_overflow', String(pendingOverflow)); } catch(e) {}
            } else if (result.data.capped) {
                var _capNotifKey = 'btc_daily_cap_notified_' + new Date().toISOString().split('T')[0];
                if (!localStorage.getItem(_capNotifKey)) {
                    localStorage.setItem(_capNotifKey, '1');
                    showToast('🎯 Daily cap hit (500)! Further XP today rolls over to tomorrow.', 8000);
                    _updateCapIndicator(true);
                }
            }
        }
    } catch (e) {
        // [SECURITY] No local fallback — server is the only source of truth for points
        console.warn('[POINTS] Cloud Function failed:', e.message);
        if (typeof showToast === 'function') showToast('⏳ XP will sync when connection restores');
    }
    updateRankUI();
    if (typeof renderProgressRings === 'function') renderProgressRings();
    refreshLeaderboardIfOpen();
    if (typeof nachoOnPoints === 'function') nachoOnPoints(pts);
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
        showToast('+' + pts + ' XP — ' + reason, 2500);
    }
}

// Points notification log — stored in localStorage for the bell panel
// Defined here (in bundle) so it's available before lazy-loaded notifications.js
window.notifySelfPoints = function(pts, reason) {
    if (!pts || pts < 1) return;
    if (!reason || reason === '') return;
    var entry = { pts: pts, reason: reason, ts: Date.now(), read: false };
    try {
        var log = JSON.parse(localStorage.getItem('btc_points_log') || '[]');
        log.push(entry);
        if (log.length > 100) log = log.slice(log.length - 100);
        localStorage.setItem('btc_points_log', JSON.stringify(log));
    } catch(e) {}
    // Badge update (if notifications.js has loaded)
    if (typeof _updatePointsBadge === 'function') _updatePointsBadge();
};

// Auto-refresh leaderboard if it's currently open
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
    // readChannels is now blocked in Firestore rules — channel tracking goes through awardPoints CF
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
// syncProgressToFirebase removed — badges and scholar status are synced inline at award time

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
document.addEventListener('mousemove', trackActivity);
document.addEventListener('keydown', trackActivity);
document.addEventListener('touchstart', trackActivity, { passive: true });
document.addEventListener('click', trackActivity);
setInterval(trackScroll, 2000);

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
        // Track for Nacho bubble quiz trigger
        sessionStorage.setItem('btc_channel_read_seconds', readSeconds.toString());
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
    // Mobile: don't show old guest banner — user info is in the mobile top bar
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
    var _overflow = parseInt(localStorage.getItem('btc_pts_overflow') || '0');
    if (atCap || _dailyPts >= 500) {
        el.style.borderColor = '#ef4444';
        el.style.boxShadow = '0 0 12px rgba(239,68,68,0.3)';
        el.title = '🎯 Daily XP cap reached (500/500)' + (_overflow > 0 ? '\n💫 Overflow: ' + _overflow + ' pts (rolls over tomorrow)' : '');
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
    if (_dailyPts >= 500) {
        setTimeout(function() { _updateCapIndicator(true); }, 2000);
    }
}

function updateRankUI() {
    if (!currentUser) return;
    // Hide giveaway banner for existing users
    var gBanner = document.getElementById('giveawayBanner');
    if (gBanner && currentUser.username) gBanner.style.display = 'none';
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

    // Detect level-up — only celebrate going UP, never on initial load
    const highestLevelSeen = parseInt(localStorage.getItem('btc_highest_level_seen') || '0');
    if (levelUpReady && lastLevelName && lastLevelName !== lv.name && lv.min > lastLevelMin && lv.min > highestLevelSeen) {
        showLevelUpCelebration(lv);
        localStorage.setItem('btc_highest_level_seen', lv.min.toString());
        if (typeof notifySelfLevelUp === 'function') notifySelfLevelUp(lv.min, lv.name, lv.emoji);
        // Announce level-up in Global Chat
        var _luName = (currentUser && currentUser.username) ? currentUser.username : null;
        var _luUid = (typeof auth !== 'undefined' && auth && auth.currentUser) ? auth.currentUser.uid : '';
        if (_luName && typeof window.nachoGlobalAnnounce === 'function') {
            window.nachoGlobalAnnounce(lv.emoji + ' @' + _luName + ' just leveled up to ' + lv.emoji + ' ' + lv.name + '! Congrats! \uD83C\uDF89', _luUid);
        }

        // Satoshi's Favor contribution for level-ups
        if (typeof window.contributeSatoshiFavor === 'function') {
            var levelName = lv.name || '';
            var source = null;
            // Check rank tier
            if (['Pleb','Pleb II','Pleb III','Stacker','Stacker II','Stacker III'].includes(levelName)) {
                source = 'level_up';
            } else if (['Maxi','Maxi II','Maxi III'].includes(levelName)) {
                source = 'level_up_5';
            } else if (['Papa John','Cyberhornet','Honey Badger','Sovereign','Satoshi'].includes(levelName)) {
                source = 'level_up_10';
            }
            if (source) {
                // contributeSatoshiFavor handles all Nacho announcements internally
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

    bar.innerHTML =
        '<div class="rank-info" onclick="toggleLeaderboard()">' +
            '<span class="rank-level">' + lv.emoji + ' ' + lv.name + '</span>' +
            '<span class="rank-user">' + escapeHtml(currentUser.username || 'Anon') + '</span>' +
            '<span class="rank-pts">' + (currentUser.points || 0).toLocaleString() + ' XP</span>' +
            streakHtml + ticketHtml +
        '</div>' + progressHtml + signInLink;
    bar.style.display = 'flex';

}

// Get user's display emoji — chosen badge or default level emoji
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
    // Hide old guest banner — we now use unified display
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
        // Mobile: hide the fixed overlay — user info already lives in the mobile top bar.
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
                container.style.padding = '0 20px 16px';
                container.style.borderBottom = '1px solid var(--border)';
                sidebarHeader.parentNode.insertBefore(container, sidebarHeader.nextSibling);
                container.appendChild(el);
            }
            // Add horizontal row for Dashboard + Notifications
            el.style.cssText = 'position:relative;top:auto;right:auto;z-index:10;display:flex;flex-direction:row;align-items:center;gap:10px;padding:12px;background:rgba(247,147,26,0.05);border:1px solid rgba(247,147,26,0.2);border-radius:12px;cursor:default;transition:0.3s;width:100%;';
        } else {
            el.style.cssText = 'position:fixed;bottom:70px;left:12px;right:12px;z-index:200;display:flex;align-items:center;gap:10px;padding:10px 16px;background:linear-gradient(135deg,#1a1a2e,#2d1f4e);border:2px solid #f7931a;border-radius:14px;box-shadow:0 4px 20px rgba(247,147,26,0.3);font-size:0.85rem;cursor:pointer;';
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
                (_isMob ? '<div style="color:#aaa;font-size:0.7rem;margin-top:2px;">Sign in to keep XP & enter giveaway!</div>' : '') +
            '</div>' +
            (!_isMob ? '<div id="notifBellPlaceholder" style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;"></div>' : '') +
            (!_isMob ? '<div onclick="event.stopPropagation();showUsernamePrompt();" style="background:#f7931a;color:#000;padding:6px 12px;border-radius:8px;font-weight:900;font-size:0.65rem;white-space:nowrap;cursor:pointer;">SIGN UP</div>' : '') +
            (_isMob ? '<div onclick="event.stopPropagation();showUsernamePrompt();" style="margin-left:auto;background:#f7931a;color:#000;padding:6px 14px;border-radius:10px;font-weight:800;font-size:0.8rem;white-space:nowrap;">Sign Up →</div>' : '');
    } else {
        // Signed in user
        el.removeAttribute('data-anon');
        el.removeAttribute('data-mob-hidden');
        var _isMob = window.innerWidth <= 900;

        // Mobile: hide the fixed overlay entirely — user info lives in the mobile-bar instead
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
                container.style.padding = '0 20px 16px';
                container.style.borderBottom = '1px solid var(--border)';
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
            '</div>' +
            (!_isMob ? '<div id="notifBellPlaceholder" style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;"></div>' : '');
    }
    el.style.display = 'flex';

    // Standalone dashboard button (survives userDisplay dismiss)
    var dashBtn = document.getElementById('dashboardFloatBtn');
    if (!dashBtn) {
        dashBtn = document.createElement('div');
        dashBtn.id = 'dashboardFloatBtn';
        dashBtn.onclick = function() { if (typeof toggleDashboard === 'function') toggleDashboard(); };
        document.body.appendChild(dashBtn);
    }
    // Position below userDisplay on desktop, hidden on mobile (mobile has it in top bar)
    dashBtn.style.cssText = 'position:fixed;top:12px;right:20px;z-index:129;width:36px;height:36px;border-radius:10px;background:var(--bg-side,#1a1a2e);border:1px solid var(--border,#333);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1.1rem;box-shadow:0 2px 8px rgba(0,0,0,0.2);transition:0.2s;';
    dashBtn.innerHTML = '📊';
    dashBtn.title = 'Bitcoin Network Metrics';
    // If userDisplay is visible, tuck dashboard button below it
    if (el.style.display !== 'none' && el.offsetHeight > 0) {
        var elRect = el.getBoundingClientRect();
        dashBtn.style.top = (elRect.bottom + 8) + 'px';
    }
    // Hide on mobile — mobile top bar already has it
    if (window.innerWidth <= 900) dashBtn.style.display = 'none';

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

// ---- Delete Account ----
window.showDeleteAccountConfirm = function() {
    var overlay = document.createElement('div');
    overlay.id = 'deleteAccountOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    var username = (currentUser && currentUser.username) ? currentUser.username : 'your account';
    var pts = currentUser ? (currentUser.points || 0) : 0;
    var streak = currentUser ? (currentUser.streak || 0) : 0;

    overlay.innerHTML =
        '<div style="background:var(--bg-side,#1a1a2e);border:2px solid #ef4444;border-radius:20px;padding:28px;max-width:420px;width:100%;animation:fadeSlideIn 0.3s;">' +
            '<div style="text-align:center;margin-bottom:16px;"><span style="font-size:3rem;">⚠️</span></div>' +
            '<h2 style="color:#ef4444;text-align:center;margin:0 0 12px;font-size:1.2rem;">Delete Your Account?</h2>' +
            '<div style="color:var(--text);font-size:0.9rem;line-height:1.6;margin-bottom:16px;text-align:center;">' +
                'This will <strong style="color:#ef4444;">permanently delete</strong> everything associated with <strong>' + escapeHtml(username) + '</strong>:' +
            '</div>' +
            '<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:14px;margin-bottom:16px;">' +
                '<div style="display:flex;flex-direction:column;gap:6px;font-size:0.85rem;color:var(--text-muted);">' +
                    '<div>❌ <strong>' + pts.toLocaleString() + ' XP</strong> and all badges</div>' +
                    (streak > 0 ? '<div>❌ <strong>' + streak + '-day streak</strong></div>' : '') +
                    '<div>❌ All forum posts and replies</div>' +
                    '<div>❌ Marketplace listings</div>' +
                    '<div>❌ DM conversations</div>' +
                    '<div>❌ Nacho chat history</div>' +
                    '<div>❌ Leaderboard ranking</div>' +
                    '<div>❌ Orange Tickets and quest progress</div>' +
                '</div>' +
            '</div>' +
            '<div style="color:#ef4444;font-weight:700;font-size:0.85rem;text-align:center;margin-bottom:16px;">⚠️ This action is IRREVERSIBLE. There is no undo.</div>' +
            '<div style="margin-bottom:16px;">' +
                '<label style="display:block;font-size:0.75rem;color:var(--text-faint);margin-bottom:6px;">Type <strong style="color:#ef4444;">DELETE</strong> to confirm:</label>' +
                '<input type="text" id="deleteConfirmInput" placeholder="Type DELETE here" autocomplete="off" style="width:100%;padding:12px;background:var(--card-bg);border:2px solid var(--border);border-radius:10px;color:var(--text);font-size:1rem;font-family:monospace;text-align:center;outline:none;box-sizing:border-box;" oninput="var btn=document.getElementById(\'deleteConfirmBtn\');if(btn){if(this.value===\'DELETE\'){btn.disabled=false;btn.style.opacity=1;}else{btn.disabled=true;btn.style.opacity=0.4;}}">' +
            '</div>' +
            '<div style="display:flex;gap:10px;">' +
                '<button onclick="document.getElementById(\'deleteAccountOverlay\').remove()" style="flex:1;padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;font-weight:600;cursor:pointer;font-family:inherit;">Cancel</button>' +
                '<button id="deleteConfirmBtn" disabled onclick="confirmDeleteAccount()" style="flex:1;padding:12px;background:#ef4444;border:none;border-radius:10px;color:#fff;font-size:0.9rem;font-weight:800;cursor:pointer;font-family:inherit;opacity:0.4;transition:0.2s;">🗑️ Delete Forever</button>' +
            '</div>' +
        '</div>';

    document.body.appendChild(overlay);
};

window.confirmDeleteAccount = async function() {
    var input = document.getElementById('deleteConfirmInput');
    if (!input || input.value !== 'DELETE') return;

    var btn = document.getElementById('deleteConfirmBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Deleting...'; }

    try {
        var user = auth.currentUser;
        if (!user) throw new Error('Not signed in');
        var uid = user.uid;

        // 1. Delete Firestore user document
        try { await db.collection('users').doc(uid).delete(); } catch(e) { console.warn('User doc delete failed:', e); }

        // 2. Delete forum posts by this user
        try {
            var posts = await db.collection('forum_posts').where('authorId', '==', uid).get();
            var batch1 = db.batch();
            posts.forEach(function(doc) { batch1.delete(doc.ref); });
            if (!posts.empty) await batch1.commit();
        } catch(e) { console.warn('Forum posts delete failed:', e); }

        // 3. Delete forum replies by this user
        try {
            var replies = await db.collection('forum_replies').where('authorId', '==', uid).get();
            var batch2 = db.batch();
            replies.forEach(function(doc) { batch2.delete(doc.ref); });
            if (!replies.empty) await batch2.commit();
        } catch(e) { console.warn('Forum replies delete failed:', e); }

        // 4. Delete marketplace listings
        try {
            var listings = await db.collection('marketplace').where('sellerUid', '==', uid).get();
            var batch3 = db.batch();
            listings.forEach(function(doc) { batch3.delete(doc.ref); });
            if (!listings.empty) await batch3.commit();
        } catch(e) { console.warn('Marketplace delete failed:', e); }

        // 5. Delete DM conversations
        try {
            var convos = await db.collection('conversations').where('participants', 'array-contains', uid).get();
            var batch4 = db.batch();
            convos.forEach(function(doc) { batch4.delete(doc.ref); });
            if (!convos.empty) await batch4.commit();
        } catch(e) { console.warn('DM delete failed:', e); }

        // 6. Delete suggestions
        try {
            var suggestions = await db.collection('suggestions').where('uid', '==', uid).get();
            var batch5 = db.batch();
            suggestions.forEach(function(doc) { batch5.delete(doc.ref); });
            if (!suggestions.empty) await batch5.commit();
        } catch(e) { console.warn('Suggestions delete failed:', e); }

        // 7. Clear all localStorage
        var keysToRemove = [];
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key && key.startsWith('btc_')) keysToRemove.push(key);
        }
        keysToRemove.forEach(function(k) { localStorage.removeItem(k); });
        sessionStorage.clear();
        // [AUDIT FIX M5] Clear SW caches on account deletion
        if ('caches' in window) { try { var _ck = await caches.keys(); _ck.forEach(function(k) { caches.delete(k); }); } catch(e) {} }

        // 8. Delete Firebase Auth account
        await user.delete();

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
        if (e.code === 'auth/requires-recent-login') {
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
        avatarName.innerHTML = name.toUpperCase() + '<br><span style="font-size:0.6rem;opacity:0.8;letter-spacing:0.5px;">click to ask!</span>';
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

// Render leaderboard badge emoji — compact multi-emoji into a fixed-size cell
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

    lb.classList.remove('minimized');
    lb.innerHTML = '<div style="padding:20px;text-align:center;color:#475569;">Loading leaderboard...</div>';
    lb.classList.add('open');
    if (fab) fab.style.display = 'none';

    // Leaderboard open sound — dramatic reveal
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
            // Trophy chime — two bright notes
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
        // Cache leaderboard data for 5 minutes to reduce Firestore reads
        var now = Date.now();
        var useCache = window._lbCache && window._lbCacheTime && (now - window._lbCacheTime < 120000);
        let allUsers = [];
        if (useCache) {
            allUsers = window._lbCache;
        } else {
            const snap = await db.collection('users').orderBy('points', 'desc').limit(150).get();
            snap.forEach(doc => {
                const d = doc.data();
                // Ghost Mode: only show if user is visible OR is the current user themselves
                const isMe = auth.currentUser && doc.id === auth.currentUser.uid;
                if (d.points > 0 && (!d.ghostMode || isMe)) {
                    allUsers.push({ id: doc.id, ...d });
                }
            });
            window._lbCache = allUsers;
            window._lbCacheTime = now;
        }

        let html = '<div class="lb-min-bar">🏆 Leaderboard — tap to expand</div>';
        html += '<div class="lb-header"><h3>🏆 Leaderboard</h3><div><button class="lb-close" onclick="hideLeaderboard()" title="Close">✕</button></div></div>';
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

            var _rowPfp = d.profilePic
                ? '<img src="' + escapeHtml(d.profilePic) + '" style="width:22px;height:22px;border-radius:50%;object-fit:cover;vertical-align:middle;border:1px solid var(--border);">'
                : '';
            var _lbTipData = JSON.stringify({recipientName: d.username || 'Anon', recipientUid: d.id, lightningAddress: d.lightningAddress || d.lightning || '', context: 'leaderboard', label: 'Tip ' + (d.username || 'Anon')}).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
            html += '<div' + hidden + ' onclick="showUserProfile(\'' + d.id + '\')" style="cursor:pointer;" title="View profile">' +
                '<span class="lb-rank">' + medal + '</span>' +
                '<span class="lb-badge">' + _lbBadgeEmoji(lv.emoji) + '</span>' +
                '<span class="lb-name">' + (_rowPfp ? _rowPfp + ' ' : '') + escapeHtml(d.username || 'Anon') + statusDot + certIcons + '</span>' +
                '<span class="lb-score">' + (d.points || 0).toLocaleString() + ' XP</span>' +
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
        _loadPVPLeaderboard();
    } catch(e) {
        console.error('[Leaderboard] Error:', e);
        lb.innerHTML = '<div style="padding:20px;color:#f97316;">Error loading leaderboard: ' + (e.message || 'Unknown error') + '</div>';
    }
}

// PVP Leaderboard — loaded after main leaderboard renders, sorted by win %
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
                db.collection('users').where('pvpWins', '>', 0).orderBy('pvpWins', 'desc').limit(50).get(),
                db.collection('users').where('pvpLosses', '>', 0).orderBy('pvpLosses', 'desc').limit(50).get()
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
            container.innerHTML = '<div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:12px 0;">No PVP battles yet — be the first to compete!</div>';
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
            pvpHtml += '<div' + hidden + ' onclick="showUserProfile(\'' + p.id + '\')" style="cursor:pointer;" title="View profile">' +
                '<span class="lb-rank">' + medal + '</span>' +
                '<span class="lb-badge" style="display:inline-block;width:22px;text-align:center;flex-shrink:0;">' + pvpIcon + '</span>' +
                '<span class="lb-name">' + p.username + '</span>' +
                '<span class="lb-score" title="' + Math.round(p.winRate) + '% win rate" style="cursor:help;">' + p.wins + 'W – ' + p.losses + 'L</span>' +
                '<span data-lb-tip="1" onclick="event.stopPropagation();showTipOverlay(JSON.parse(this.getAttribute(\'data-tip-action\').replace(/&quot;/g,\'\\&quot;\')))" data-tip-action="' + _pvpTipData + '" style="cursor:pointer;font-size:0.75rem;color:#eab308;margin-left:6px;flex-shrink:0;" title="Tip ' + p.username + '">⚡</span>' +
            '</div>';
        });
        if (players.length > 10) {
            pvpHtml += '<button onclick="event.stopPropagation();document.querySelectorAll(\'.pvp-lb-extra\').forEach(function(el){el.style.display=\'flex\'});this.remove();" style="width:100%;padding:10px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:0.85rem;cursor:pointer;font-family:inherit;margin:8px 0;">Show all ' + players.length + ' PVP players ▼</button>';
        }
        container.innerHTML = pvpHtml || '<div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:12px 0;">No PVP battles yet!</div>';
    } catch(e) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:12px 0;">No PVP battles yet — be the first to compete!</div>';
    }
}

// Toast notifications
var _toastQueue = [];
function showToast(msg, duration) {
    // Suppress toasts during direct link cooldown
    if (window._directLinkMode) return;
    // If Nacho is busy (Q&A, voice, reading answer), queue the toast
    if (window._nachoBusy) {
        _toastQueue.push({ msg: msg, duration: duration });
        return;
    }
    _showToastNow(msg, duration);
}
function _showToastNow(msg, duration) {
    var ms = duration || 2500;
    const t = document.createElement('div');
    t.className = 'rank-toast';
    var _raw = typeof msg === 'object' ? msg.msg : msg;
    // Strip dangerous tags but allow emoji and simple formatting
    t.innerHTML = _raw.replace(/<(script|svg|img|iframe|object|embed|form|input|link|style|meta|base)[^>]*>/gi, '').replace(/on\w+\s*=/gi, 'data-blocked=');
    if (typeof msg === 'object' && msg.duration) ms = msg.duration;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, ms);
}
// Flush queued toasts when Nacho is no longer busy
setInterval(function() {
    if (!window._nachoBusy && _toastQueue.length > 0) {
        _showToastNow(_toastQueue.shift());
    }
}, 2000);

// Username prompt
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

// Sign-in only mode — hides signup fields, shows only sign-in options
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
        // Hide: h2, first p, username input, email input, email note, giveaway section, Start Learning button
        var h2 = box.querySelector('h2');
        var firstP = box.querySelector('p');
        var usernameInput = document.getElementById('usernameInput');
        var emailInput = document.getElementById('emailInput');
        var giveawaySection = document.getElementById('giveawaySection');
        var submitBtn = box.querySelector('button[onclick="submitUsername()"]');

        // Find the email note (p after emailInput)
        var emailNote = emailInput ? emailInput.nextElementSibling : null;
        if (emailNote && emailNote.tagName === 'P') emailNote.style.display = 'none';

        if (h2) h2.style.display = 'none';
        if (firstP) firstP.style.display = 'none';
        if (usernameInput) usernameInput.style.display = 'none';
        if (emailInput) emailInput.style.display = 'none';
        if (giveawaySection) giveawaySection.style.display = 'none';
        if (submitBtn) submitBtn.style.display = 'none';

        // Also hide the giveaway script checkbox handler
        var giveawayScript = giveawaySection ? giveawaySection.nextElementSibling : null;
        if (giveawayScript && giveawayScript.tagName === 'SCRIPT') giveawayScript.style.display = 'none';

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
    var giveawaySection = document.getElementById('giveawaySection');
    var submitBtn = box.querySelector('button[onclick="submitUsername()"]');
    var emailNote = emailInput ? emailInput.nextElementSibling : null;
    if (emailNote && emailNote.tagName === 'P') emailNote.style.display = '';

    if (h2) h2.style.display = '';
    if (firstP) firstP.style.display = '';
    if (usernameInput) usernameInput.style.display = '';
    if (emailInput) emailInput.style.display = '';
    if (giveawaySection) giveawaySection.style.display = '';
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
window._countryOptions = (function() {
    var c = ['Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Ivory Coast','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kosovo','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan','Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'];
    return c.map(function(n) { return '<option value="' + n + '">'; }).join('');
})();

function showSettingsPage(tab) {
    try {
    settingsTab = tab || 'account';
    const modal = document.getElementById('usernameModal');
    const box = modal.querySelector('.username-box');
    if (!modal) { if (typeof showToast === 'function') showToast('Error: modal not found'); return; }
    if (!box) { if (typeof showToast === 'function') showToast('Error: username-box not found'); return; }
    const user = (typeof auth !== 'undefined' && auth) ? auth.currentUser : null;
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
        const names = { account: 'Acct', scholar: 'Scholar', sats: 'Sats', prefs: 'Prefs', security: 'Lock', data: 'Stats<br>Nacho' };
        const active = settingsTab === t;
        html += '<button onclick="showSettingsPage(\'' + t + '\')" style="flex:1;min-width:0;padding:8px 2px;border:none;background:' + (active ? 'var(--accent-bg)' : 'none') + ';color:' + (active ? 'var(--accent)' : 'var(--text-muted)') + ';font-size:0.6rem;font-weight:' + (active ? '700' : '500') + ';cursor:pointer;font-family:inherit;border-bottom:' + (active ? '2px solid var(--accent)' : '2px solid transparent') + ';margin-bottom:-2px;display:flex;flex-direction:column;align-items:center;gap:1px;white-space:nowrap;touch-action:manipulation;"><span style="font-size:1.3rem;line-height:1;">' + icons[t] + '</span>' + names[t] + '</button>';
    });
    html += '</div>';

    if (settingsTab === 'account') {
        var isAnon = user.isAnonymous;
        var settingsEmoji = getUserDisplayEmoji(lvl);
        var _pfpUrl = currentUser ? currentUser.profilePic || '' : '';
        var _pfpHtml = _pfpUrl
            ? '<img src="' + escapeHtml(_pfpUrl) + '" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid var(--accent);box-shadow:0 0 20px rgba(247,147,26,0.3);cursor:pointer;" onclick="document.getElementById(\'pfpFileInput\').click()" title="Change profile picture">'
            : '<div style="font-size:2.5rem;margin-bottom:0;">' + settingsEmoji + '</div>';
        html += '<div style="text-align:center;margin-bottom:20px;">' +
            '<div style="margin-bottom:8px;position:relative;display:inline-block;">' + _pfpHtml + '</div>' +
            '<div style="color:var(--heading);font-weight:700;font-size:1.2rem;">' + (currentUser ? currentUser.username || 'Bitcoiner' : 'Bitcoiner') + '</div>' +
            '<div style="color:var(--text-muted);font-size:0.85rem;margin-top:4px;">' + lvl.name + ' · ' + (currentUser ? currentUser.points || 0 : 0).toLocaleString() + ' XP</div>' +
            '</div>';

        // Country selector
        var _userCountry = currentUser ? currentUser.country || '' : '';
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">🌍 Country</div>' +
            '<div style="position:relative;">' +
            '<input type="text" id="countryInput" list="countryList" value="' + escapeHtml(_userCountry) + '" placeholder="Start typing your country..." autocomplete="off" style="width:100%;padding:12px 14px;background:var(--input-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:16px;font-family:inherit;outline:none;box-sizing:border-box;-webkit-appearance:none;" onfocus="this.style.borderColor=\'var(--accent)\'" onblur="this.style.borderColor=\'var(--border)\'">' +
            '<datalist id="countryList">' + window._countryOptions + '</datalist>' +
            '</div>' +
            '<div style="color:var(--text-faint);font-size:0.7rem;margin-top:4px;">Optional · Shown on your public profile</div>' +
            '</div>';

        // Profile Picture upload
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">📷 Profile Picture</div>' +
            '<input type="file" id="pfpFileInput" accept="image/*" style="display:none;" onchange="handleProfilePicUpload(this)">' +
            '<div style="display:flex;align-items:center;gap:12px;">' +
                (_pfpUrl
                    ? '<img src="' + escapeHtml(_pfpUrl) + '" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid var(--border);flex-shrink:0;">'
                    : '<div style="width:48px;height:48px;border-radius:50%;background:var(--bg);border:2px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;">👤</div>') +
                '<div style="flex:1;">' +
                    '<button onclick="document.getElementById(\'pfpFileInput\').click()" style="padding:8px 16px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;">' + (_pfpUrl ? 'Change Photo' : 'Upload Photo') + '</button>' +
                    (_pfpUrl ? ' <button onclick="removeProfilePic()" style="padding:8px 12px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:0.8rem;cursor:pointer;font-family:inherit;">Remove</button>' : '') +
                    '<div style="color:var(--text-faint);font-size:0.7rem;margin-top:4px;">Square image recommended · Max 2MB</div>' +
                '</div>' +
            '</div>' +
            '<div id="pfpUploadStatus" style="margin-top:8px;font-size:0.8rem;"></div>' +
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
        if (!isAnon) {
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
                _advHtml += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
                    '<div onclick="window._expanded_badges=!window._expanded_badges;showSettingsPage(\'account\')" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;-webkit-tap-highlight-color:rgba(247,147,26,0.2);">' +
                    '<div><div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">🏅 Display Badge</div>' +
                    '<div style="color:var(--text);font-size:0.85rem;margin-top:4px;">' + currentBadgeDisplay + '</div></div>' +
                    '<span style="color:var(--text-faint);font-size:1rem;transition:0.2s;">' + (window._expanded_badges ? '▾' : '▸') + '</span></div>';
                if (window._expanded_badges) {
                    _advHtml += '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">' +
                        '<div style="color:var(--text-muted);font-size:0.75rem;margin-bottom:10px;">Choose a badge to show next to your name instead of your rank emoji.</div>' +
                        '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">';
                    _advHtml += '<div onclick="setDisplayBadge(\'\')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;border:1px solid ' + (!chosenBadge ? 'var(--accent)' : 'var(--border)') + ';background:' + (!chosenBadge ? 'rgba(247,147,26,0.1)' : 'var(--card-bg)') + ';cursor:pointer;margin-bottom:6px;transition:0.2s;"><span style="font-size:1.3rem;">' + lvl.emoji + '</span><div><div style="color:var(--text);font-size:0.85rem;font-weight:600;">' + lvl.name + ' (Default)</div><div style="color:var(--text-faint);font-size:0.7rem;">Your current rank emoji</div></div>' + (!chosenBadge ? '<span style="margin-left:auto;color:var(--accent);font-size:0.8rem;font-weight:700;">✓</span>' : '') + '</div>';
                    for (var bi = 0; bi < allEarned.length; bi++) {
                        var b = allEarned[bi];
                        var isChosen = chosenBadge === b.id;
                        _advHtml += '<div onclick="setDisplayBadge(\'' + b.id + '\')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;border:1px solid ' + (isChosen ? 'var(--accent)' : 'var(--border)') + ';background:' + (isChosen ? 'rgba(247,147,26,0.1)' : 'var(--card-bg)') + ';cursor:pointer;margin-bottom:6px;transition:0.2s;"><span style="font-size:1.3rem;">' + b.emoji + '</span><div><div style="color:var(--text);font-size:0.85rem;font-weight:600;">' + b.name + '</div></div>' + (isChosen ? '<span style="margin-left:auto;color:var(--accent);font-size:0.8rem;font-weight:700;">✓</span>' : '') + '</div>';
                    }
                    _advHtml += '</div>';
                }
                _advHtml += '</div>';
            }
        }

        // Change username
        const currentName = currentUser ? currentUser.username || '' : '';
        _advHtml += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">✏️ Change Username</div>' +
            '<div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:10px;">Current username: <span style="color:var(--accent);font-weight:700;">' + currentName + '</span></div>' +
            '<input type="text" id="newUsername" value="" placeholder="Type your new username here..." maxlength="20" style="width:100%;padding:12px 14px;background:var(--input-bg);border:2px solid var(--border);border-radius:10px;color:var(--text);font-size:1rem;font-family:inherit;outline:none;margin-bottom:10px;box-sizing:border-box;" onfocus="this.style.borderColor=\'var(--accent)\'" onblur="this.style.borderColor=\'var(--border)\'">' +
            '<button onclick="changeUsername()" style="width:100%;padding:12px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;">Save New Username</button>' +
            '<div id="usernameStatus" style="margin-top:8px;font-size:0.85rem;"></div></div>';

        // Artist Profile (inside Advanced Account)
        _advHtml += '<button onclick="showArtistProfileModal()" style="width:100%;padding:14px;background:linear-gradient(135deg,rgba(247,147,26,0.08),rgba(234,88,12,0.04));border:2px solid rgba(247,147,26,0.2);border-radius:12px;color:var(--accent);font-size:0.9rem;cursor:pointer;font-family:inherit;font-weight:700;margin-bottom:12px;display:flex;align-items:center;justify-content:center;gap:8px;">🎸 Artist Profile</button>';

        // Profile section (OUTSIDE advAcctContent — always visible)
        var bio = currentUser ? currentUser.bio || '' : '';
        // Social links config: key, emoji, label, placeholder, maxlen, type
        var _slDef = [
            { k:'website', e:'🌐', l:'Website', p:'https://yoursite.com', m:100, t:'url' },
            { k:'twitter', e:'𝕏', l:'Twitter/X', p:'@yourusername', m:30 },
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
            html += '<div class="pf-link-row" data-key="' + s.k + '" style="display:flex;align-items:center;gap:12px;margin-bottom:12px;background:rgba(255,255,255,0.02);padding:10px;border-radius:12px;border:1px solid var(--border);">' +
                '<span style="font-size:1.2rem;width:28px;text-align:center;flex-shrink:0;">' + s.e + '</span>' +
                '<input type="' + (s.t || 'text') + '" id="profile_' + s.k + '" value="' + escapeHtml(val) + '" placeholder="' + s.p + '" maxlength="' + s.m + '" style="flex:1;padding:8px 10px;background:var(--input-bg,rgba(255,255,255,0.05));border:1px solid var(--border);border-radius:8px;color:var(--text,#e2e8f0);font-size:16px;font-family:inherit;outline:none;box-sizing:border-box;min-width:0;-webkit-appearance:none;">' +
                '<button onclick="document.getElementById(\'profile_' + s.k + '\').value=\'\';this.parentElement.remove();profileLinkRemoved(\'' + s.k + '\')" style="background:rgba(239,68,68,0.1);border:none;color:#ef4444;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;touch-action:manipulation;" title="Remove">✕</button>' +
            '</div>';
        });
        html += '</div>';

        // Add link dropdown — only show if there are empty slots
        if (_emptyLinks.length > 0) {
            html += '<div id="addLinkArea" style="margin-bottom:12px;">' +
                '<button id="addLinkBtn" onclick="document.getElementById(\'addLinkMenu\').style.display=document.getElementById(\'addLinkMenu\').style.display===\'none\'?\'block\':\'none\'" style="display:flex;align-items:center;gap:6px;padding:8px 12px;background:none;border:1px dashed var(--border);border-radius:8px;color:var(--text-muted);font-size:0.85rem;cursor:pointer;font-family:inherit;width:100%;touch-action:manipulation;"><span style="font-size:1rem;">＋</span> Add a link</button>' +
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
        if (!_hasLn) {
            html += '<div onclick="hideUsernamePrompt();setTimeout(function(){go(\'lightning\')},300)" style="width:100%;padding:16px;background:linear-gradient(135deg,rgba(234,179,8,0.08),rgba(247,147,26,0.04));border:2px solid rgba(247,147,26,0.25);border-radius:14px;cursor:pointer;margin-bottom:12px;display:flex;align-items:center;gap:12px;transition:0.2s;" onmouseover="this.style.borderColor=\'#f7931a\'" onmouseout="this.style.borderColor=\'rgba(247,147,26,0.25)\'">' +
                '<span style="font-size:1.8rem;">⚡</span>' +
                '<div><div style="color:var(--heading);font-weight:700;font-size:0.9rem;">Connect a Lightning Wallet</div>' +
                '<div style="color:var(--text-muted);font-size:0.78rem;line-height:1.4;">Tip other users and receive tips from the community!</div></div>' +
                '<span style="color:var(--accent);font-size:1.1rem;margin-left:auto;">→</span></div>';
        }

        // Advanced Account toggle — content renders BELOW this button
        html += '<button onclick="var p=document.getElementById(\'advAcctContent\');p.style.display=p.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'span\').textContent=p.style.display===\'none\'?\'▼\':\'▲\'" style="width:100%;padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:12px;display:flex;align-items:center;justify-content:center;gap:6px;">⚙️ Advanced Account <span>▼</span></button>';

        // Advanced Account content (hidden, appears at bottom when toggled)
        html += '<div id="advAcctContent" style="display:none;">' + _advHtml + '</div>';

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
        // Scholar — Quests, Certifications, Flashcards
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

        // Scholar Certification — Properties
        var propPassed = localStorage.getItem('btc_scholar_prop_passed') === 'true';
        html += '<div style="background:linear-gradient(135deg, rgba(247,147,26,0.1), rgba(247,147,26,0.02));border:1px solid '+(propPassed ? '#22c55e' : 'var(--accent)')+';border-radius:16px;padding:20px;margin-bottom:16px;text-align:center;">' +
            '<div style="font-size:1.8rem;margin-bottom:8px;">'+(propPassed ? '✅' : '📜')+'</div>' +
            '<div style="color:var(--heading);font-weight:800;font-size:1.1rem;margin-bottom:8px;">Bitcoin Scholar Certification</div>' +
            '<p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:15px;line-height:1.4;">25 questions on the <strong>economic properties</strong> and scarcity of Bitcoin. 80% to pass. One attempt per day.</p>' +
            '<button onclick="hideUsernamePrompt(); startScholarQuest(\'properties\');" style="width:100%;padding:12px;background:'+(propPassed ? '#22c55e' : 'var(--accent)')+';color:#ffffff;border:none;border-radius:10px;font-weight:800;font-size:0.9rem;cursor:pointer;">'+(propPassed ? '✅ View Certificate' : '🎓 Start Scholar Exam')+'</button>' +
            '</div>';

        // Scholar Certification — Technical
        var techPassed = localStorage.getItem('btc_scholar_tech_passed') === 'true';
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
        // The Weekly Signal — Newsletter
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
            { date: 'Feb 26, 2026', title: 'Why Proof of Stake is just Fiat 2.0', snippet: 'Most cryptos claim to be better than Bitcoin because they use less energy. But Gigi explains why energy IS the point — PoW converts real-world resources into unforgeable security.', channel: 'pow-vs-pos' },
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
                '<strong style="color:var(--text);">📅 Daily Login:</strong> +1 ticket just for visiting.<br>' +
                '<strong style="color:var(--text);">🎡 Spin the Wheel:</strong> Spin daily for bonus tickets!<br>' +
                '<strong style="color:var(--text);">👥 Referrals:</strong> Earn <strong style="color:var(--accent);">50 tickets</strong> per friend who signs up and reaches Maxi rank (6,102+ pts). Verified automatically.<br>' +
                '<strong style="color:var(--text);">🏅 Badges:</strong> Unlock at 25 🐟, 50 🦈, and 100 🐋 tickets.<br>' +
                '<strong style="color:var(--text);">⭐ Bonus:</strong> Each ticket = +5 XP towards your rank.<br>' +
                '<strong style="color:#eab308;">🏆 Giveaways:</strong> More tickets = higher chance of winning sats!' +
                '</div></div>';
        }

        // Load referral stats asynchronously
        if (!isAnon && typeof loadReferralStatsUI === 'function') {
            setTimeout(loadReferralStatsUI, 100);
        }

    } else if (settingsTab === 'sats') {
        // ===== SATS FAUCET TAB =====
        var isAnon = user.isAnonymous;
        var userPts = currentUser ? currentUser.points || 0 : 0;
        var pointsClaimed = currentUser ? currentUser.pointsClaimed || 0 : 0;
        var availablePts = userPts - pointsClaimed;
        var satsWithdrawn = currentUser ? currentUser.satsWithdrawn || 0 : 0;
        var satsBalance = Math.floor(Math.max(0, availablePts) / 10); // 10 unclaimed points = 1 sat
        var _satCap = typeof getSatCap === 'function' ? getSatCap() : 10000;
        var lifetimeLeft = Math.max(0, _satCap - satsWithdrawn);
        var claimable = Math.min(satsBalance, 500, lifetimeLeft);
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

        // Eligibility checks
        var eligible = !isAnon && hasEmail && acctAgeDays >= 7 && channelsRead >= 10;
        var meetsMin = satsBalance >= 100;

        html += '<div style="text-align:center;margin-bottom:20px;">';
        html += '<div style="font-size:2.5rem;">⚡</div>';
        html += '<div style="font-size:1.3rem;font-weight:800;color:var(--accent);margin-top:4px;">Claim Real Sats</div>';
        html += '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">Earn XP → Convert to real Bitcoin over Lightning</div>';
        html += '</div>';

        // Balance card
        html += '<div style="background:linear-gradient(135deg, rgba(249,115,22,0.1), rgba(234,179,8,0.1));border:1px solid var(--accent);border-radius:16px;padding:20px;margin-bottom:16px;text-align:center;">';
        html += '<div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Your Balance</div>';
        html += '<div style="font-size:2rem;font-weight:900;color:var(--accent);margin:8px 0;">⚡ ' + satsBalance.toLocaleString() + ' claimable sats</div>';
        html += '<div style="font-size:0.75rem;color:var(--text-muted);">' + availablePts.toLocaleString() + ' unclaimed XP of ' + userPts.toLocaleString() + ' total</div>';
        html += '<div style="font-size:0.7rem;color:var(--text-faint);margin-top:8px;">Lifetime withdrawn: ' + satsWithdrawn.toLocaleString() + ' / 10,000 sats</div>';
        html += '</div>';

        // Claim button area
        if (!isAnon && eligible && meetsMin && !onCooldown && claimable >= 100) {
            html += '<button onclick="initSatsClaim()" style="width:100%;padding:16px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:800;cursor:pointer;font-family:inherit;margin-bottom:16px;transition:0.2s;touch-action:manipulation;">⚡ Claim Up to ' + Math.min(claimable, 500) + ' Sats</button>';
        } else if (onCooldown) {
            html += '<div style="width:100%;padding:16px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;text-align:center;margin-bottom:16px;color:var(--text-muted);font-size:0.85rem;">⏳ Next claim in <strong>' + cooldownStr + '</strong></div>';
        } else if (!meetsMin && eligible) {
            html += '<div style="width:100%;padding:16px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;text-align:center;margin-bottom:16px;color:var(--text-muted);font-size:0.85rem;">Need <strong>' + (100 - satsBalance) + ' more sats</strong> (' + ((100 - satsBalance) * 10) + ' XP) to reach minimum claim</div>';
        } else {
            html += '<div style="width:100%;padding:16px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;text-align:center;margin-bottom:16px;color:var(--text-muted);font-size:0.85rem;">Complete requirements below to claim</div>';
        }

        // Requirements checklist
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:16px;">';
        html += '<div style="font-weight:700;font-size:0.85rem;margin-bottom:12px;color:var(--text);">📋 Requirements</div>';

        var checks = [
            { met: !isAnon, label: 'Signed in (not anonymous)', detail: isAnon ? 'Sign in with email, Google, etc.' : '✓ Signed in' },
            { met: hasEmail, label: 'Email verified', detail: hasEmail ? '✓ ' + user.email : 'Link & verify your email in Account tab' },
            { met: acctAgeDays >= 7, label: 'Account age ≥ 7 days', detail: acctAgeDays >= 7 ? '✓ ' + acctAgeDays + ' days old' : acctAgeDays + '/7 days — ' + (7 - acctAgeDays) + ' more to go' },
            { met: channelsRead >= 10, label: 'Read ≥ 10 topics', detail: channelsRead >= 10 ? '✓ ' + channelsRead + ' topics read' : channelsRead + '/10 topics — read ' + (10 - channelsRead) + ' more' },
            { met: meetsMin, label: 'Minimum 100 sats (1,000 pts)', detail: meetsMin ? '✓ ' + satsBalance + ' sats available' : satsBalance + '/100 sats — earn ' + ((100 - satsBalance) * 10) + ' more XP' }
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
        html += '• <strong>1,000 XP = 100 sats</strong> — earn XP by reading, quests, and daily visits<br>';
        html += '• <strong>Min claim: 100 sats</strong> (1,000 XP)<br>';
        html += '• <strong>Max claim: 500 sats/day</strong><br>';
        html += '• <strong>1 claim per 24 hours</strong><br>';
        html += '• <strong>Lifetime max: 10,000 sats</strong> per account<br>';
        html += '• <strong>Daily XP cap: 500 XP</strong> (50 sats worth) to prevent abuse<br>';
        html += '• Unclaimed sats roll over — no expiration<br>';
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
            '🗺️ Exploration milestones: <strong>50-500 XP</strong>'
        ]);
        html += _es('ep_daily', '✅ Daily Activities', [
            '✅ Daily visit: <strong>5 XP</strong>',
            '🔥 Streak bonus: <strong>100 XP/day</strong>',
            '🎰 Daily spin: <strong>10-50 XP</strong>',
            '📈 Price prediction: <strong>5 XP</strong> (25 if correct!)',
            '📺 Watch Timechain TV: <strong>10 XP</strong> per 10 min watched'
        ]);
        html += _es('ep_quiz', '🧠 Quizzes & Learning', [
            '🎯 Daily quests (perfect): <strong>100 XP</strong> (50 for 3+, 25 retry)',
            '🧠 Nacho trivia pop-ups: <strong>10-15 XP</strong>',
            '🎮 Channel quizzes: <strong>10 XP</strong>',
            '🎯 Conversation quests: <strong>5 XP/correct</strong>',
            '📖 Nacho\'s Trails chapters: <strong>25-50 XP</strong> (100 for all)',
            '📖 Nacho\'s Story chapters: <strong>15 XP</strong> (50 final, 100 all)'
        ]);
        html += _es('ep_social', '💬 Community & Social', [
            '📝 Forum post: <strong>10 XP</strong>',
            '💬 Forum reply: <strong>5 XP</strong>',
            '📝 Publish article: <strong>30 XP</strong>',
            '📖 Read an article: <strong>5 XP</strong>',
            '💬 Article comment: <strong>5 XP</strong>',
            '🌍 Global Chat message: <strong>5 XP</strong>',
            '🔥 Chat streaks: <strong>10-25 XP</strong> (3-day / 7-day)',
            '🤝 Host IRL event: <strong>15 XP</strong>'
        ]);
        html += _es('ep_music', '🎵 Music & Content', [
            '🎵 Upload a song: <strong>50 XP</strong>',
            '🎧 Listen to full track: <strong>10 XP</strong>',
            '💬 Comment on Beats: <strong>10 XP</strong>'
        ]);
        html += _es('ep_pvp', '⚔️ PVP & Competitions', [
            '⚔️ PVP victory: <strong>score-based XP</strong>',
            '🧠 PVP practice: <strong>10 XP/correct</strong>',
            '🏅 PVP badges: <strong>25-500 XP</strong>'
        ]);
        html += _es('ep_big', '🏆 Big Achievements', [
            '🎓 Scholar Certification: <strong>2,100 XP</strong>',
            '🛒 First Purchase guide: <strong>100 XP</strong>',
            '⚡ Lightning wallet setup: <strong>100 XP</strong>',
            '🎤 Music badges: <strong>50-100 XP</strong>',
            '🔑 Hidden badges: <strong>varies</strong>',
            '💬 Feedback bonus: <strong>5 XP</strong>'
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
        if (_satsLnAddr) {
            html += '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:10px;margin-bottom:8px;"><span style="color:#22c55e;font-size:0.9rem;">✅</span><span style="color:var(--text);font-size:0.82rem;font-weight:600;word-break:break-all;">' + escapeHtml(_satsLnAddr) + '</span></div>';
        }
        html += '<div style="display:flex;gap:8px;align-items:center;"><input type="text" id="satsLnAddrInput" placeholder="you@walletofsatoshi.com" value="' + escapeHtml(_satsLnAddr) + '" style="flex:1;padding:10px 12px;background:var(--input-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.85rem;font-family:inherit;outline:none;box-sizing:border-box;" onkeydown="if(event.key===\'Enter\')saveSatsLnAddress()"><button onclick="saveSatsLnAddress()" style="padding:10px 16px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;touch-action:manipulation;">Save</button></div>';
        html += '<div id="satsLnAddrStatus" style="margin-top:6px;font-size:0.75rem;text-align:center;"></div>';
        if (!_satsLnAddr) {
            html += '<div style="margin-top:8px;font-size:0.72rem;color:var(--text-faint);line-height:1.5;">💡 Get one from <a href="https://walletofsatoshi.com" target="_blank" rel="noopener" style="color:var(--accent);">Wallet of Satoshi</a>, <a href="https://getalby.com" target="_blank" rel="noopener" style="color:var(--accent);">Alby</a>, <a href="https://coinos.io" target="_blank" rel="noopener" style="color:var(--accent);">Coinos</a>, or <a href="https://strike.me" target="_blank" rel="noopener" style="color:var(--accent);">Strike</a>.</div>';
        }
        html += '</div>';

    } else if (settingsTab === 'prefs') {
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

        // Font Size — merged into Appearance card above

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
        const nachoOn = localStorage.getItem('btc_nacho_hidden') !== 'true';
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🦌 Nacho (Mascot)</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<span style="color:var(--text);font-size:0.85rem;">Show Nacho</span>' +
            '<button onclick="if(typeof ' + (nachoOn ? 'hideNacho' : 'showNacho') + '===\'function\'){' + (nachoOn ? 'hideNacho()' : 'showNacho()') + '}showSettingsPage(\'prefs\')" style="padding:6px 16px;border:1px solid var(--border);border-radius:8px;background:' + (nachoOn ? '#22c55e' : 'var(--bg-side)') + ';color:' + (nachoOn ? '#fff' : 'var(--text-muted)') + ';font-size:0.8rem;cursor:pointer;font-family:inherit;font-weight:600;">' + (nachoOn ? 'ON' : 'OFF') + '</button></div>' +
            '<div style="color:var(--text-faint);font-size:0.75rem;margin-top:6px;">Your friendly Bitcoin deer guide. Long-press him to hide.</div>';

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

        // Push Notifications
        const pushEnabled = localStorage.getItem('btc_push_enabled') === 'true';
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🔔 Push Notifications</div>' +
            '<div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:10px;">Off by default. We respect your attention.</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
            '<span style="color:var(--text);font-size:0.85rem;">Notifications</span>' +
            '<button id="pushToggleBtn" onclick="togglePushNotifications()" style="padding:6px 16px;border:1px solid var(--border);border-radius:8px;background:' + (pushEnabled ? '#22c55e' : 'var(--bg-side)') + ';color:' + (pushEnabled ? '#fff' : 'var(--text-muted)') + ';font-size:0.8rem;cursor:pointer;font-family:inherit;font-weight:600;">' + (pushEnabled ? 'ON' : 'OFF') + '</button></div>' +
            '<div style="background:var(--bg-side);border:1px solid var(--border);border-radius:8px;padding:10px;font-size:0.75rem;color:var(--text-muted);line-height:1.5;">' +
                '<strong style="color:var(--text);">What you\'ll get:</strong><br>' +
                '🎡 <strong>Spin reminders</strong> — a couple times a week, never daily<br>' +
                '🔥 <strong>Streak alerts</strong> — don\'t lose your streak!<br>' +
                '📰 <strong>New content</strong> — when we add major new topics<br>' +
                '🏆 <strong>Giveaway alerts</strong> — never miss a sats giveaway<br><br>' +
                '<span style="color:var(--text-faint);">We send 2-3 notifications per week max. No spam. Ever.</span>' +
            '</div>' +
            '<div id="pushStatus" style="margin-top:8px;font-size:0.75rem;color:var(--text-faint);"></div>' +
            '</div>';

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

        // Keyboard Shortcuts (collapsible — takes lots of space)
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
            html += '<div style="display:flex;align-items:center;gap:10px;"><span style="color:var(--text-faint);font-size:1.2rem;">🔒</span><div><div style="color:var(--heading);font-weight:600;font-size:0.9rem;">2FA available with email sign-in</div><div style="color:var(--text-muted);font-size:0.8rem;">Link an email to your account first (in Account tab), then you can enable 2FA.</div></div></div>';
        } else if (!emailVerified) {
            html += '<div style="display:flex;align-items:center;gap:10px;"><span style="color:#f59e0b;font-size:1.2rem;">⚠️</span><div><div style="color:var(--heading);font-weight:600;font-size:0.9rem;">Verify your email first</div><div style="color:var(--text-muted);font-size:0.8rem;">You must verify your email address before you can enable 2FA.</div></div></div>';
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

        // Blocked Users
        var blockedList = typeof getBlockedUsers === 'function' ? getBlockedUsers() : [];
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🚫 Blocked Users</div>';
        if (blockedList.length === 0) {
            html += '<div style="color:var(--text-muted);font-size:0.85rem;">No blocked users. 🎉</div>';
        } else {
            html += '<div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:10px;">' + blockedList.length + ' blocked user' + (blockedList.length > 1 ? 's' : '') + '</div>';
            html += '<div id="blockedUsersList"><div style="color:var(--text-faint);font-size:0.8rem;">Loading...</div></div>';
        }
        html += '</div>';

        // Load blocked user names after render
        if (blockedList.length > 0) {
            setTimeout(function() {
                var container = document.getElementById('blockedUsersList');
                if (!container) return;
                var loaded = 0;
                var listHtml = '';
                blockedList.forEach(function(uid) {
                    db.collection('users').doc(uid).get().then(function(doc) {
                        var name = doc.exists ? (doc.data().username || 'Unknown') : 'Deleted User';
                        listHtml += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;' + (loaded > 0 ? 'border-top:1px solid var(--border);' : '') + '">' +
                            '<span style="color:var(--text);font-size:0.85rem;">' + name + '</span>' +
                            '<button onclick="if(typeof unblockUser===\'function\'){unblockUser(\'' + uid + '\',\'' + name.replace(/[\\'"]/g, "") + '\')};showSettingsPage(\'security\')" style="padding:5px 12px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:0.75rem;cursor:pointer;font-family:inherit;">✅ Unblock</button></div>';
                        loaded++;
                        if (loaded === blockedList.length) container.innerHTML = listHtml;
                    }).catch(function() {
                        listHtml += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-top:1px solid var(--border);">' +
                            '<span style="color:var(--text-faint);font-size:0.85rem;">Unknown User</span>' +
                            '<button onclick="if(typeof unblockUser===\'function\'){unblockUser(\'' + uid + '\')};showSettingsPage(\'security\')" style="padding:5px 12px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:0.75rem;cursor:pointer;font-family:inherit;">✅ Unblock</button></div>';
                        loaded++;
                        if (loaded === blockedList.length) container.innerHTML = listHtml;
                    });
                });
            }, 100);
        }

        // Delete Account — Danger Zone
        if (!user.isAnonymous) {
            html += '<div style="background:rgba(239,68,68,0.05);border:2px solid rgba(239,68,68,0.3);border-radius:12px;padding:16px;margin-top:24px;">' +
                '<div style="font-size:0.75rem;color:#ef4444;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-weight:800;">⚠️ Danger Zone</div>' +
                '<div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:12px;line-height:1.5;">Permanently delete your account, all your data, XP, badges, and progress. This action cannot be undone.</div>' +
                '<button onclick="showDeleteAccountConfirm()" style="width:100%;padding:12px;background:none;border:2px solid #ef4444;border-radius:10px;color:#ef4444;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;" onmouseover="this.style.background=\'rgba(239,68,68,0.1)\'" onmouseout="this.style.background=\'none\'">🗑️ Delete My Account</button>' +
                '</div>';
        }
        html += '</div>'; // close advSecPanel

    } else if (settingsTab === 'data') {
        // Refresh data from Firebase — cache for 2 minutes
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
        html += statRow('Total Site Visits', totalVisits, '👁️');
        html += statRow('Channels Explored', Math.max(chVisited, localVisited) + ' / ' + Object.keys(CHANNELS).length, '🗺️');
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
            html += statRow('PVP Record', _pvpW + 'W – ' + _pvpL + 'L', '⚔️');
            html += statRow('PVP Win Rate', _pvpPct + '%', '📊');
        } else {
            html += statRow('PVP Record', 'No battles yet — <a href="#" onclick="event.preventDefault();hideUsernamePrompt();enterPVPMode();" style="color:var(--accent);">Enter PVP Lobby</a>', '⚔️');
        }
        // Prediction Stats
        if (typeof getPredictionStats === 'function') {
            var predStats = getPredictionStats(currentUser);
            if (predStats) {
                html += statRow('Predictions', predStats.total + ' total · ' + predStats.correct + ' correct', '📈');
                html += statRow('Prediction Accuracy', predStats.percentage + '%', '🎯');
                if (predStats.bestStreak > 0) html += statRow('Best Prediction Streak', predStats.bestStreak + ' in a row', '🔥');
            } else {
                html += statRow('Predictions', '<a href="#" onclick="event.preventDefault();hideUsernamePrompt();showPricePrediction();" style="color:var(--accent);">Make your first prediction →</a>', '📈');
            }
        }
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
        var _totalBadges = typeof BADGE_DEFS !== 'undefined' ? BADGE_DEFS.length : 63;
        html += statRow('Badges Earned', _badgeCount + ' / ' + _totalBadges, '🏅');
        
        // Reading progress
        try {
            var _readProg = JSON.parse(localStorage.getItem('btc_channel_progress') || '{}');
            var _readComplete = Object.values(_readProg).filter(function(v) { return v >= 100; }).length;
            var _readStarted = Object.keys(_readProg).length;
            if (_readStarted > 0) html += statRow('Channels Read (100%)', _readComplete + ' complete, ' + _readStarted + ' started', '📖');
        } catch(e) {}

        if (typeof getNachoFriendship === 'function') {
            var f = getNachoFriendship();
            var interactions = parseInt(localStorage.getItem('btc_nacho_interactions') || '0');
            html += statRow('Nacho Friendship', f.emoji + ' ' + f.name + ' (' + interactions + ' interactions)', '🦌');
        }

        html += '</div>';

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

        // Nacho Nickname (first — let user name their Nacho)
        var nickname = localStorage.getItem('btc_nacho_nickname') || 'Nacho';
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🏷️ Name Your Buck</div>' +
            '<div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:10px;">Currently: <strong style="color:var(--accent);">' + escapeHtml(nickname) + '</strong></div>' +
            '<div>' +
            '<input type="text" id="nachoNicknameInput" value="' + escapeHtml(nickname) + '" maxlength="20" placeholder="Type a new name..." style="width:100%;padding:12px 14px;background:rgba(30,41,59,1);border:2px solid #475569;border-radius:10px;color:#f8fafc;font-size:1rem;font-family:inherit;outline:none;box-sizing:border-box;-webkit-appearance:none;margin-bottom:8px;" onfocus="this.style.borderColor=\'#f7931a\';this.select()" onblur="this.style.borderColor=\'var(--border)\'">' +
            '<button onclick="var n=document.getElementById(\'nachoNicknameInput\').value.trim();if(n)setNachoNickname(n)" style="width:100%;padding:12px 20px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;">Save</button>' +
            '</div></div>';

        // Nacho Story (highlighted — right under name)
        if (typeof getNachoStoryProgress === 'function') {
            var storyProg = getNachoStoryProgress();
            var storyComplete = storyProg >= 10;
            var storyNickname = escapeHtml(nickname);
            html += '<div style="background:linear-gradient(135deg,rgba(247,147,26,0.08),rgba(234,88,12,0.04));border:2px solid rgba(247,147,26,0.3);border-radius:12px;padding:16px;margin-bottom:16px;">' +
                '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
                    '<span style="font-size:1.4rem;">📖</span>' +
                    '<div><div style="font-size:0.9rem;font-weight:800;color:var(--heading);">' + storyNickname + '\'s Story</div>' +
                    '<div style="font-size:0.7rem;color:var(--text-faint);">' + (storyComplete ? '✅ Complete!' : 'A new chapter unlocks every day!') + '</div></div>' +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
                '<div style="flex:1;background:var(--bg-side);border-radius:8px;height:10px;overflow:hidden;"><div style="height:100%;background:linear-gradient(90deg,#f7931a,#ea580c);width:' + Math.round(storyProg / 10 * 100) + '%;border-radius:8px;transition:0.5s;"></div></div>' +
                '<span style="color:var(--accent);font-size:0.85rem;font-weight:700;">' + storyProg + '/10</span>' +
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
            'The only data we store is your username, points, and progress — just enough to power your experience. No tracking, no ads, no third-party analytics. Your data is yours.</div></div>';

        // Orange Tickets section (collapsible)
        html += '<button onclick="var p=document.getElementById(\'ticketsPanel\');p.style.display=p.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'span\').textContent=p.style.display===\'none\'?\'▼\':\'▲\'" style="width:100%;padding:12px;background:linear-gradient(135deg,rgba(247,147,26,0.08),rgba(234,88,12,0.04));border:2px solid rgba(247,147,26,0.2);border-radius:10px;color:var(--accent);font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:12px;display:flex;align-items:center;justify-content:center;gap:6px;"><span style="filter:hue-rotate(30deg) saturate(1.5);">🎟️</span> Orange Tickets & Referrals <span>▼</span></button>';
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
            '<button onclick="confirmDeleteAccount()" style="width:100%;padding:10px;background:none;border:1px solid #ef4444;border-radius:8px;color:#ef4444;font-size:0.85rem;cursor:pointer;font-family:inherit;">🗑️ Delete My Account</button>' +
            '</div>';
        html += '</div>'; // close advStatsPanel
    }

    html += '<span class="skip" onclick="hideUsernamePrompt()" style="color:var(--text-faint);font-size:0.85rem;margin-top:12px;cursor:pointer;display:block;text-align:center;">Close</span>';
    box.innerHTML = html;
    modal.classList.add('open');

    // Load sats history if on sats tab
    if (settingsTab === 'sats' && typeof loadSatsHistory === 'function') {
        setTimeout(loadSatsHistory, 100);
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
    } catch(e) {
        if (typeof showToast === 'function') showToast('Settings page error: ' + e.message);
        console.error('showSettingsPage error:', e);
    }
}

// Language translation via Google Translate
function changeLanguage(lang) {
    const status = document.getElementById('langStatus');
    if (!lang) {
        // Reset to English — remove Google Translate without full reload
        const frame = document.querySelector('.goog-te-banner-frame');
        if (frame) frame.remove();
        // Remove Google Translate injected elements
        var _gtFrame = document.querySelector('iframe.goog-te-banner-frame');
        if (_gtFrame) _gtFrame.remove();
        var _gtBody = document.querySelector('.skiptranslate');
        if (_gtBody) _gtBody.remove();
        // Reset body top offset that Google Translate adds
        document.body.style.top = '';
        document.body.style.position = '';
        document.documentElement.style.overflow = '';
        // Clear cookies
        document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.' + location.hostname;
        localStorage.setItem('btc_lang', '');
        if (status) status.innerHTML = '<span style="color:#22c55e;">✅ Switched to English</span>';
        // Remove translated class — Google Translate adds 'translated-ltr' or 'translated-rtl'
        document.documentElement.classList.remove('translated-ltr', 'translated-rtl');
        // Restore original text by removing font elements Google Translate injects
        document.querySelectorAll('font[style*="vertical-align: inherit"]').forEach(function(f) {
            var parent = f.parentNode;
            if (parent) { parent.replaceChild(document.createTextNode(f.textContent), f); }
        });
        // Re-render settings page to show clean English
        setTimeout(function() { showSettingsPage('prefs'); }, 200);
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
// PROFILE PICTURE — upload, resize, store as base64 in Firestore
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
        if (typeof showToast === 'function') showToast('🔒 Sign in with Google, Facebook, Twitter, or email to save your profile!');
        if (status) status.innerHTML = '<span style="color:#ef4444;">🔒 Create a free account to save your profile</span>';
        if (typeof showUsernamePrompt === 'function') setTimeout(showUsernamePrompt, 1500);
        return;
    }
    
    var uid = auth.currentUser.uid;
    var bio = document.getElementById('profileBio') ? document.getElementById('profileBio').value.trim() : '';
    
    var countryEl = document.getElementById('countryInput');
    var country = countryEl ? countryEl.value.trim().substring(0, 60) : '';
    var updateData = { bio: bio, country: country };
    
    // Social links mapping
    var links = ['website', 'twitter', 'nostr', 'instagram', 'tiktok', 'github', 'contactEmail', 'lightning'];
    // URL scheme validation — block javascript:, data:, vbscript: etc.
    var _safeUrl = function(url) {
        if (!url) return '';
        url = url.trim();
        if (/^(javascript|data|vbscript|blob):/i.test(url)) return '';
        return url;
    };
    links.forEach(function(k) {
        var el = document.getElementById('profile_' + k);
        if (el) {
            var val = el.value.trim();
            if (k === 'lightning') {
                // Lightning address: must be user@domain format, no special chars that break onclick
                val = val.replace(/[\\'"<>]/g, '');
                if (val && !val.match(/^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) val = '';
            } else if (k === 'contactEmail') {
                val = val.replace(/[\\'"<>]/g, '');
            } else if (k === 'nostr') {
                val = val.replace(/[\\'"<>]/g, '');
            } else {
                val = _safeUrl(val);
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

    try {
        if (status) status.innerHTML = '<span style="color:var(--accent);">Saving...</span>';
        await db.collection('users').doc(uid).update(updateData);
        
        // Update local currentUser object
        Object.assign(currentUser, updateData);
        
        if (status) status.innerHTML = '<span style="color:#22c55e;">✅ Profile saved!</span>';
        if (typeof showToast === 'function') showToast('✅ Profile saved successfully!');
        
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
                '<div style="display:flex;align-items:center;gap:6px;"><span style="width:18px;text-align:center;font-size:0.85rem;">𝕏</span><input type="text" id="artistLinkX" placeholder="X handle (e.g. @artist)" maxlength="50" value="' + escapeHtml(ap.x || '') + '" style="flex:1;padding:8px 12px;background:var(--input-bg,#111);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.82rem;font-family:inherit;box-sizing:border-box;"></div>' +
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
        website: (document.getElementById('artistLinkWebsite').value || '').trim().substring(0, 200),
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
    if (typeof showToast === 'function') showToast('📋 Field ready — tap and hold, then tap Paste', 5000);
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
        pill.style.cssText = 'position:fixed;bottom:70px;left:12px;z-index:200;display:flex;align-items:center;gap:6px;padding:8px 12px 8px 16px;background:var(--bg-side,#1a1a2e);border:2px solid #f7931a;border-radius:10px;box-shadow:0 2px 10px rgba(247,147,26,0.2);cursor:pointer;transition:0.3s;';
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

function clearUserLocalStorage() {
    var preserve = ['btc_theme_oled', 'btc_font_size', 'btc_volume', 'btc_lang', 'btc_haptic', 'btc_soundscape', 'btc_ticker_enabled', 'btc_ios_a2hs_dismissed', 'btc_pwa_dismissed', 'btc_swipe_hint_shown', 'btc_last_auth_uid', 'btc_signin_email', 'btc_pending_email', 'btc_pending_username', 'btc_pending_giveaway'];
    var toRemove = [];
    for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf('btc_') === 0 && preserve.indexOf(key) === -1) {
            toRemove.push(key);
        }
    }
    for (var j = 0; j < toRemove.length; j++) {
        localStorage.removeItem(toRemove[j]);
    }
}
window.clearUserLocalStorage = clearUserLocalStorage;

async function signOutUser() {
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
    if (modal) modal.classList.remove('open');
    // Show guide return button if user navigated from the guide
    if (sessionStorage.getItem('btc_return_guide') === '1' && typeof showGuideReturnBtn === 'function') {
        showGuideReturnBtn();
    }
};

window.submitUsername = async function() {
    // Check if this is the INITIAL SIGNUP modal or the settings username change
    var input = document.getElementById('usernameInput') || document.getElementById('newUsername');
    if (!input) return;
    var name = input.value.trim();
    if (!name) { showToast('Please enter a username!'); return; }
    if (name.length < 2) { showToast('Username must be at least 2 characters'); return; }
    if (name.length > 20) { showToast('Username must be 20 characters or less'); return; }
    if (containsProfanity(name)) { showToast('⚠️ That username is not allowed.'); return; }

    // INITIAL SIGNUP (usernameInput exists = signup modal)
    if (document.getElementById('usernameInput')) {
        var emailInput = document.getElementById('emailInput');
        var email = emailInput ? emailInput.value.trim() : '';
        var signupCountryEl = document.getElementById('signupCountryInput');
        var signupCountry = signupCountryEl ? signupCountryEl.value.trim().substring(0, 60) : '';
        var giveawayCheckbox = document.getElementById('giveawayCheckbox');
        var giveawayLn = document.getElementById('giveawayLnAddress');
        var enteredGiveaway = giveawayCheckbox && giveawayCheckbox.checked;
        var lnAddress = giveawayLn ? giveawayLn.value.trim() : '';

        // Require Lightning address if giveaway is checked
        if (enteredGiveaway && !lnAddress) {
            if (giveawayLn) { giveawayLn.style.borderColor = '#ef4444'; giveawayLn.focus(); }
            showToast('⚡ Enter a Lightning address to enter the giveaway, or uncheck the box to skip.');
            return;
        }

        if (email) {
            // Email provided — send magic link for verification
            var sent = await sendMagicLink(email);
            if (sent) {
                localStorage.setItem('btc_pending_username', name);
                localStorage.setItem('btc_pending_email', email);
                if (enteredGiveaway && lnAddress) {
                    localStorage.setItem('btc_pending_giveaway', lnAddress);
                }
                showToast('📧 Check your email for a verification link!');
                hideUsernamePrompt();
                // Also create the anonymous user immediately so they can start using the site
                await createUser(name, email, enteredGiveaway, lnAddress, signupCountry);
                return;
            }
        }

        // No email — create user directly (anonymous)
        await createUser(name, email, enteredGiveaway, lnAddress, signupCountry);
        return;
    }

    // SETTINGS USERNAME CHANGE (newUsername exists = settings page)
    if (!currentUser || currentUser._isLocal) { showToast('Sign in first to change username'); return; }
    var status = document.getElementById('usernameStatus');
    if (status) status.innerHTML = 'Saving...';
    try {
        await db.collection('users').doc(currentUser.uid).update({ username: name, username_lower: name.toLowerCase() });
        currentUser.username = name;
        updateAuthButton();
        updateRankUI();
        if (status) status.innerHTML = '✅ Username updated!';
        showToast('✅ Username changed to ' + name);
    } catch(e) {
        if (status) status.innerHTML = '❌ Error saving';
        showToast('Error updating username. Try again.');
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

// ---- Init Firebase & Auth ----
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRanking);
} else {
    initRanking();
}

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
    // Refresh the settings page to show the new selection
    showSettingsPage('account');
    showToast(badgeId ? '🏅 Display badge updated!' : '🏅 Using default rank emoji');
};
if (typeof changeUsername === 'undefined') window.changeUsername = async function(name) {
    // Read from input if no name passed
    if (!name) { var inp = document.getElementById('newUsername'); if (inp) name = inp.value.trim(); }
    // Strip non-ASCII (prevent Unicode/homoglyph bypass)
    if (name) name = name.replace(/[^\x20-\x7E]/g, '').replace(/[\\'"<>]/g, '').trim();
    if (!name || name.length < 2) { showToast('Username must be at least 2 characters (ASCII only)'); return; }
    if (name.length > 20) { showToast('Username max 20 characters'); return; }
    if (containsProfanity(name)) { showToast('⚠️ That username is not allowed.'); return; }
    if (typeof isCleanText === 'function' && !isCleanText(name)) { showToast('Username contains inappropriate language'); return; }
    // Save locally always (works for anon too)
    localStorage.setItem('btc_username', name);
    if (currentUser) { currentUser.username = name; }
    updateAuthButton(); updateRankUI();
    // Save to Firestore if signed in
    if (auth && auth.currentUser && db) {
        try { await db.collection('users').doc(auth.currentUser.uid).update({ username: name, username_lower: name.toLowerCase() }); } catch(e) { console.warn('Username Firestore save failed:', e); }
    }
    showToast('✅ Username updated to ' + name);
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
window.togglePushNotifications = async function() { try { if (!('Notification' in window)) { showToast('Notifications not supported in this browser'); return; } var permission = await Notification.requestPermission(); if (permission === 'granted') { localStorage.setItem('btc_push_enabled', 'true'); showToast('🔔 Notifications Enabled!'); } else { localStorage.setItem('btc_push_enabled', 'false'); showToast('❌ Notification permission denied'); } showSettingsPage('prefs'); } catch(e) { console.error(e); } };
if (typeof sendEmailVerification === 'undefined') window.sendEmailVerification = function() { if (auth && auth.currentUser && auth.currentUser.sendEmailVerification) { auth.currentUser.sendEmailVerification().then(function() { showToast('📧 Verification email sent!'); }).catch(function() { showToast('Could not send verification email'); }); } };
if (typeof disable2FA === 'undefined') window.disable2FA = function() { showToast('2FA management coming soon'); };
if (typeof startMFAEnroll === 'undefined') window.startMFAEnroll = function() { showToast('2FA enrollment coming soon'); };
if (typeof verifyMFACode === 'undefined') window.verifyMFACode = function() { showToast('2FA verification coming soon'); };
if (typeof sendPasswordReset === 'undefined') window.sendPasswordReset = function() { if (auth && auth.currentUser && auth.currentUser.email) { auth.sendPasswordResetEmail(auth.currentUser.email).then(function() { showToast('📧 Password reset email sent!'); }).catch(function() { showToast('Could not send reset email'); }); } };
if (typeof confirmDeleteAccount === 'undefined') window.confirmDeleteAccount = function() { if (!confirm('Are you sure you want to delete your account? This cannot be undone.')) return; if (auth && auth.currentUser) { var uid = auth.currentUser.uid; db.collection('users').doc(uid).delete().then(function() { return auth.currentUser.delete(); }).then(function() { localStorage.clear(); location.reload(); }).catch(function(e) { showToast('Error: ' + e.message); }); } };
async function loadTotpStatus() {
    var section = document.getElementById('totpSection');
    if (!section) return;
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        section.innerHTML = '<div style="color:var(--text-faint);font-size:0.85rem;">Sign in to enable authenticator app.</div>';
        return;
    }
    try {
        var totpStatusFn = firebase.functions().httpsCallable('totpStatus');
        var result = await totpStatusFn();
        if (result.data.enabled) {
            section.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;"><span style="color:#22c55e;font-size:1.2rem;">✅</span><div><div style="color:var(--heading);font-weight:600;font-size:0.9rem;">Authenticator app enabled</div><div style="color:var(--text-muted);font-size:0.8rem;">Google Authenticator, Authy, etc.</div></div></div>' +
                '<div style="display:flex;gap:8px;"><input type="text" id="totpDisableCode" placeholder="Enter code to disable" maxlength="6" style="flex:1;padding:10px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.9rem;font-family:inherit;outline:none;text-align:center;">' +
                '<button onclick="disableTotp()" style="padding:10px 16px;background:none;border:1px solid #ef4444;border-radius:8px;color:#ef4444;font-size:0.85rem;cursor:pointer;font-family:inherit;">Disable</button></div>';
        } else {
            section.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;"><span style="color:var(--text-faint);font-size:1.2rem;">📱</span><div><div style="color:var(--heading);font-weight:600;font-size:0.9rem;">Not configured</div><div style="color:var(--text-muted);font-size:0.8rem;">Use Google Authenticator, Authy, or any TOTP app</div></div></div>' +
                '<button onclick="startTotpSetup()" style="width:100%;padding:10px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer;">Set Up Authenticator App</button>';
        }
    } catch(e) {
        section.innerHTML = '<div style="color:var(--text-faint);font-size:0.8rem;padding:8px;background:var(--bg-side);border-radius:6px;">⏳ Authenticator setup requires Cloud Functions. Check back soon!</div>';
    }
}

async function startTotpSetup() {
    try {
        var totpSetupFn = firebase.functions().httpsCallable('totpSetup');
        var result = await totpSetupFn();
        if (result.data && result.data.qrUrl) {
            var area = document.getElementById('totpSetupArea') || document.getElementById('totpSection');
            if (area) {
                area.style.display = 'block';
                area.innerHTML = '<div style="text-align:center;margin:12px 0;">' +
                    '<div style="color:var(--heading);font-weight:600;font-size:0.9rem;margin-bottom:8px;">Scan this QR code with your authenticator app:</div>' +
                    '<img src="' + result.data.qrUrl + '" style="width:200px;height:200px;border-radius:8px;border:2px solid var(--border);margin-bottom:12px;">' +
                    '<div style="color:var(--text-faint);font-size:0.75rem;margin-bottom:8px;">Or enter this key manually: <strong>' + (result.data.secret || '') + '</strong></div>' +
                    '<input type="text" id="totpVerifyCode" placeholder="Enter 6-digit code" maxlength="6" style="width:100%;padding:10px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.9rem;font-family:inherit;outline:none;text-align:center;margin-bottom:8px;">' +
                    '<button onclick="verifyTotpSetup()" style="width:100%;padding:10px;background:#22c55e;color:#fff;border:none;border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer;">Verify & Enable</button>' +
                    '</div>';
            }
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
        await verifyFn({ code: code.value.trim() });
        showToast('✅ Authenticator app enabled!');
        showSettingsPage('security');
    } catch(e) {
        showToast('Invalid code. Try again.');
    }
}

async function disableTotp() {
    var code = document.getElementById('totpDisableCode');
    if (!code || code.value.trim().length !== 6) { showToast('Enter your current code'); return; }
    try {
        var disableFn = firebase.functions().httpsCallable('totpDisable');
        await disableFn({ code: code.value.trim() });
        showToast('Authenticator app disabled');
        showSettingsPage('security');
    } catch(e) {
        showToast('Invalid code');
    }
}

// ---- RESTORED: clearUserData ----
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
window.saveSatsLnAddress = async function() {
    var input = document.getElementById('satsLnAddrInput');
    var status = document.getElementById('satsLnAddrStatus');
    if (!input) return;
    var addr = input.value.trim();
    if (addr && (!addr.includes('@') || addr.length < 5)) {
        if (status) status.innerHTML = '<span style="color:#ef4444;">Enter a valid Lightning Address (e.g. you@walletofsatoshi.com)</span>';
        return;
    }
    if (typeof auth === 'undefined' || !auth.currentUser || auth.currentUser.isAnonymous) {
        if (status) status.innerHTML = '<span style="color:#ef4444;">Sign in to save your Lightning Address</span>';
        return;
    }
    try {
        if (status) status.innerHTML = '<span style="color:var(--accent);">Saving…</span>';
        await db.collection('users').doc(auth.currentUser.uid).update({ lightning: addr });
        if (typeof currentUser !== 'undefined' && currentUser) currentUser.lightning = addr;
        if (addr) {
            if (status) status.innerHTML = '<span style="color:#22c55e;">✅ Lightning Address saved!</span>';
            if (typeof showToast === 'function') showToast('⚡ Lightning Address saved!');
            if (localStorage.getItem('btc_lightning_setup') !== 'true') {
                localStorage.setItem('btc_lightning_setup', 'true');
                if (typeof awardPoints === 'function') awardPoints(100, '⚡ Lightning wallet setup!');
                if (typeof showToast === 'function') setTimeout(function() { showToast('⚡🏅 Lightning Rod badge earned! +100 pts'); }, 1500);
                if (typeof initBadges === 'function') setTimeout(initBadges, 2000);
            }
        } else {
            if (status) status.innerHTML = '<span style="color:var(--text-faint);">Lightning Address removed.</span>';
        }
    } catch(e) {
        if (status) status.innerHTML = '<span style="color:#ef4444;">Error saving — try again</span>';
    }
};

window.initSatsClaim = function() {
    console.log('[SATS] initSatsClaim called', { currentUser: !!currentUser, auth: !!auth, authUser: !!auth?.currentUser, isAnon: auth?.currentUser?.isAnonymous });
    if (!currentUser || !auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        console.log('[SATS] BLOCKED: auth check failed');
        showToast('Sign in to claim sats');
        return;
    }
    var availPts = (currentUser.points || 0) - (currentUser.pointsClaimed || 0);
    var satsBalance = Math.floor(Math.max(0, availPts) / 10);
    var satsWithdrawn = currentUser.satsWithdrawn || 0;
    var _satCap = typeof getSatCap === 'function' ? getSatCap() : 10000;
    var lifetimeLeft = Math.max(0, _satCap - satsWithdrawn);
    var maxClaim = Math.min(satsBalance, 500, lifetimeLeft);
    console.log('[SATS] maxClaim:', maxClaim, '| satsBalance:', satsBalance, '| lifetimeLeft:', lifetimeLeft, '| satsWithdrawn:', satsWithdrawn);
    if (maxClaim < 100) {
        console.log('[SATS] BLOCKED: maxClaim < 100');
        showToast('⚡ Need at least 100 claimable sats (1,000 unclaimed XP) to withdraw. Keep earning!', 5000);
        return;
    }
    console.log('[SATS] Passed all checks, showing overlay');

    var overlay = document.createElement('div');
    overlay.id = 'satsClaimOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10002;display:flex;align-items:center;justify-content:center;padding:16px;';
    // Delay dismiss listener to prevent the originating button click from immediately closing it
    setTimeout(function() {
        overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    }, 200);

    var html = '<div style="background:var(--bg-side);border:1px solid var(--border);border-radius:16px;padding:24px;max-width:400px;width:100%;max-height:80vh;overflow-y:auto;">';
    html += '<div style="text-align:center;margin-bottom:16px;"><span style="font-size:2rem;">⚡</span><div style="font-size:1.1rem;font-weight:800;color:var(--accent);margin-top:4px;">Claim Sats</div></div>';

    html += '<div style="background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.3);border-radius:10px;padding:12px;margin-bottom:14px;text-align:center;">';
    html += '<div style="font-size:0.75rem;color:var(--text-muted);">You can claim up to</div>';
    html += '<div style="font-size:1.5rem;font-weight:900;color:var(--accent);">⚡ ' + maxClaim + ' sats</div>';
    html += '</div>';

    html += '<label style="display:block;font-size:0.8rem;color:var(--text-muted);margin-bottom:6px;">Paste Lightning Invoice</label>';
    html += '<textarea id="satsClaimInvoice" placeholder="lnbc..." rows="3" style="width:100%;padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.8rem;font-family:monospace;resize:none;margin-bottom:4px;box-sizing:border-box;word-break:break-all;"></textarea>';

    html += '<div style="font-size:0.7rem;color:var(--text-faint);margin-bottom:14px;">Open your Lightning wallet, create an invoice for the amount you want (100-' + maxClaim + ' sats), and paste it here.<br><span style="color:#22c55e;">💚 Zero fees — we pay all Lightning network fees so you receive the full amount!</span></div>';

    html += '<div id="satsClaimError" style="display:none;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:10px;margin-bottom:12px;font-size:0.78rem;color:#ef4444;text-align:center;"></div>';

    html += '<button id="satsClaimBtn" onclick="submitSatsClaim()" style="width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;touch-action:manipulation;">⚡ Send Sats to My Wallet</button>';
    html += '<button onclick="document.getElementById(\'satsClaimOverlay\').remove()" style="width:100%;padding:12px;background:none;border:1px solid var(--border);border-radius:12px;color:var(--text-muted);font-size:0.85rem;cursor:pointer;font-family:inherit;margin-top:8px;">Cancel</button>';
    html += '</div>';

    overlay.innerHTML = html;
    document.body.appendChild(overlay);
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
window.submitSatsClaim = async function() {
    if (window._satsClaimInProgress) return; // prevent double-click
    var btn = document.getElementById('satsClaimBtn');
    var invoiceEl = document.getElementById('satsClaimInvoice');
    var errorEl = document.getElementById('satsClaimError');
    if (!btn || !invoiceEl) return;

    var invoice = invoiceEl.value.trim();

    if (!invoice || !invoice.toLowerCase().startsWith('lnbc')) {
        if (errorEl) { errorEl.textContent = 'Please paste a valid Lightning invoice (starts with lnbc...)'; errorEl.style.display = 'block'; }
        return;
    }

    // Hide previous errors
    if (errorEl) errorEl.style.display = 'none';

    window._satsClaimInProgress = true;
    btn.disabled = true;
    btn.textContent = '⏳ Sending sats...';
    btn.style.opacity = '0.6';

    try {
        var claimSats = firebase.functions().httpsCallable('claimSats');
        // Generate device fingerprint for multi-account detection
        var _fp = _generateDeviceFingerprint();
        var result = await claimSats({ invoice: invoice, fingerprint: _fp });
        if (result.data && result.data.success) {
            var paidAmount = result.data.amount || 0;
            currentUser.pointsClaimed = (currentUser.pointsClaimed || 0) + (paidAmount * 10);
            currentUser.satsWithdrawn = (currentUser.satsWithdrawn || 0) + paidAmount;
            currentUser.lastSatsClaim = new Date();
            document.getElementById('satsClaimOverlay').remove();
            window._satsClaimInProgress = false;

            if (typeof notifySelfSatsClaim === 'function') notifySelfSatsClaim(paidAmount);
            // Fun celebration popup + confetti
            if (typeof launchConfetti === 'function') launchConfetti();
            var _totalClaimed = currentUser.satsWithdrawn || paidAmount;
            var _claimCap = typeof getSatCap === 'function' ? getSatCap() : 10000;
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
                    '<div style="font-size:0.7rem;color:var(--text-faint);margin-top:3px;">' + _totalClaimed.toLocaleString() + ' / 10,000 lifetime total claimed</div>' +
                '</div>' +
                '<div style="padding:10px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25);border-radius:10px;margin-bottom:16px;">' +
                    '<div style="font-size:0.75rem;color:#22c55e;font-weight:700;">🧡 Thank you for learning Bitcoin with us!</div>' +
                '</div>' +
                '<button onclick="document.getElementById(\'satsCelebration\').remove()" style="padding:14px 32px;background:#f7931a;color:#000;border:none;border-radius:12px;font-size:1rem;font-weight:800;cursor:pointer;font-family:inherit;">🚀 Stack more sats!</button>' +
            '</div>';
            document.body.appendChild(_celebOverlay);

            setTimeout(function() { showSettingsPage('sats'); }, 500);
        } else {
            var errMsg = (result.data && result.data.error) ? result.data.error : 'Claim failed — try again';
            if (errorEl) { errorEl.textContent = errMsg; errorEl.style.display = 'block'; }
            window._satsClaimInProgress = false;
            btn.disabled = false;
            btn.textContent = '⚡ Send Sats to My Wallet';
            btn.style.opacity = '1';
        }
    } catch(e) {
        console.error('Sats claim error:', e);
        var errMsg = e.message || 'Claim failed — try again';
        if (errorEl) { errorEl.textContent = errMsg; errorEl.style.display = 'block'; }
        window._satsClaimInProgress = false;
        btn.disabled = false;
        btn.textContent = '⚡ Send Sats to My Wallet';
        btn.style.opacity = '1';
    }
};

// Load withdrawal history
window.loadSatsHistory = function() {
    var el = document.getElementById('satsHistory');
    if (!el || !currentUser || !db) { if (el) el.textContent = 'Sign in to view history'; return; }
    db.collection('users').doc(currentUser.uid).collection('sats_withdrawals').orderBy('timestamp', 'desc').get().then(function(snap) {
        if (snap.empty) { el.textContent = 'No withdrawals yet'; return; }
        var totalWithdrawn = 0;
        var LIFETIME_MAX = typeof getSatCap === 'function' ? getSatCap() : 10000;
        var rows = '';
        snap.forEach(function(doc) {
            var d = doc.data();
            var amt = parseInt(d.amount) || 0;
            totalWithdrawn += amt;
            var date = d.timestamp ? new Date(d.timestamp.seconds * 1000).toLocaleDateString() : '—';
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
    // Suppress during Nacho Mode — track for exit summary instead
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
        'Pleb II': '170 — the block height when Satoshi mined the first 1,000 blocks. You\'re going deeper.',
        'Pleb III': '256 — the number of bits in a private key. You\'re becoming unbreakable.',
        'Stacker': 'Stacking sats and stacking knowledge. Impressive.',
        'Stacker II': 'Double stacking! 1913 — the year the Fed was born. You know why that matters.',
        'Stacker III': 'Triple stack mode. 2016 — the year the halving changed everything.',
        'Maxi': '2140 — when the last sat is mined. There is no second best. You know it.',
        'Maxi II': '6102 — Executive Order 6102 banned gold. They can\'t ban Bitcoin. Double the conviction.',
        'Maxi III': '8888 — triple maxi. The signal only gets stronger.',
        'Papa John': '10,000 BTC for two pizzas. Never forget. 🍕 You\'ve earned your slice.',
        'Cyberhornet': '13337 — leet speak for the elite. Bzzzz. The swarm protects the network. You\'re part of it now.',
        'Honey Badger': 'Honey badger don\'t care. 50,000 strong. Unstoppable, just like Bitcoin.',
        'Sovereign': 'Self-sovereign. 100K channels deep. No permission needed. You ARE the bank.',
        'Satoshi': 'The pinnacle. You\'ve achieved legendary status.',
    };
    return flavors[name] || 'You\'re leveling up!';
}
