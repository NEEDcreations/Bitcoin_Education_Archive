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
    { name: 'Normie',     emoji: '🟢', min: 0 },
    { name: 'Curious',    emoji: '🔵', min: 10 },
    { name: 'Pleb',       emoji: '🟠', min: 21 },
    { name: 'Stacker',    emoji: '⚡', min: 210 },
    { name: 'Hodler',     emoji: '💎', min: 1337 },
    { name: 'Maxi',       emoji: '🔥', min: 2100 },
    { name: 'Cypherpunk', emoji: '🛡️', min: 4444 },
    { name: 'Whale',      emoji: '🐋', min: 10000 },
    { name: 'Satoshi',    emoji: '👑', min: 21000 },
];

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
        // TODO: Re-enable after configuring Cloud Functions to accept App Check tokens
        // if (typeof firebase.appCheck === 'function') {
        //     try {
        //         firebase.appCheck().activate('6LcTlnYsAAAAAMR0KkaRoCrIlvceClMGkWXr9ahv', true);
        //     } catch(e) {}
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
        auth.getRedirectResult().then(async function(result) {
            if (!result || !result.user) return;
            const user = result.user;
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
                if (typeof attachReferral === 'function') attachReferral(user.uid);
            } else if (anonData) {
                const existData = existingDoc.data();
                if ((anonData.points || 0) > (existData.points || 0)) {
                    await existingDoc.ref.update({
                        points: anonData.points,
                        channelsVisited: Math.max(anonData.channelsVisited || 0, existData.channelsVisited || 0),
                        totalVisits: (existData.totalVisits || 0) + (anonData.totalVisits || 0),
                    });
                }
            }

            // Clean up old anonymous doc
            if (anonUid && anonUid !== user.uid) {
                try { await db.collection('users').doc(anonUid).delete(); } catch(e) {}
            }

            loadUser(user.uid);
            showToast('✅ Signed in as ' + (user.displayName || user.email || 'Bitcoiner'));
        }).catch(function(e) {
            if (e.code !== 'auth/popup-closed-by-user') {
                console.log('Redirect result error:', e);
            }
        });

        // Wait for auth to fully resolve before doing anything
        // This prevents the race condition where anonymous user loads before Google auth restores
        let firstAuthEvent = true;
        let emailLinkHandled = auth.isSignInWithEmailLink(window.location.href);
        auth.onAuthStateChanged(user => {
            if (firstAuthEvent) {
                firstAuthEvent = false;
                // If email link sign-in is being handled, skip — handleEmailSignIn manages it
                if (emailLinkHandled) return;
                if (user && !user.isAnonymous) {
                    // Real user restored immediately — load them
                    loadUser(user.uid);
                } else {
                    // Got anonymous or null on first event — load immediately, don't wait
                    // If a real user restores later, onAuthStateChanged fires again and swaps them in
                    if (user && user.isAnonymous) {
                        loadUserLocal(user.uid);
                    } else {
                        // null user — sign in anonymously right away
                        auth.signInAnonymously().then(() => {});
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
                auth.signInAnonymously().then(() => {});
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
    // Clean the URL parameter so it doesn't persist in the address bar
    if (urlParams.get('signin_email')) {
        var cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
    }
    if (!email) return;

    try {
        // Save anonymous user info BEFORE sign-in changes auth state
        const anonUser = auth.currentUser;
        let anonUid = null;
        let anonData = null;
        if (anonUser && anonUser.isAnonymous) {
            anonUid = anonUser.uid;
            const anonDoc = await db.collection('users').doc(anonUid).get();
            if (anonDoc.exists) anonData = anonDoc.data();
        }

        // Sign in with email link
        const result = await auth.signInWithEmailLink(email, window.location.href);
        localStorage.removeItem('btc_signin_email');

        // Check if this email user already has data
        const emailUid = result.user.uid;
        const existingDoc = await db.collection('users').doc(emailUid).get();

        if (!existingDoc.exists && anonData) {
            // Migrate anonymous data to email account
            anonData.email = email;
            await db.collection('users').doc(emailUid).set(anonData);
        } else if (existingDoc.exists && anonData) {
            // Existing email user — merge points if anon had more
            const existData = existingDoc.data();
            if ((anonData.points || 0) > (existData.points || 0)) {
                await existingDoc.ref.update({
                    points: anonData.points,
                    channelsVisited: Math.max(anonData.channelsVisited || 0, existData.channelsVisited || 0),
                    totalVisits: (existData.totalVisits || 0) + (anonData.totalVisits || 0),
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

            // Attach referral if they came via referral link
            if (typeof attachReferral === 'function') attachReferral(emailUid);
        }

        // Clean up pending data
        localStorage.removeItem('btc_pending_username');
        localStorage.removeItem('btc_pending_email');
        localStorage.removeItem('btc_pending_giveaway');

        loadUser(emailUid);
        showToast('✅ Email verified! Signed in as ' + (pendingUsername || email));
        if (pendingGiveaway) {
            setTimeout(function() { showToast('🎉 You\'re entered for the 25,000 sats giveaway! Good luck!'); }, 2000);
        }
    } catch(e) {
        console.log('Email sign-in error:', e);
        showToast('Sign-in error. Please try again.');
        auth.signInAnonymously();
    }
}

// Google Sign-In
window.signInWithGoogle = async function() {
    await signInWithProvider(new firebase.auth.GoogleAuthProvider());
}

// Twitter/X Sign-In
window.signInWithTwitter = async function() {
    await signInWithProvider(new firebase.auth.TwitterAuthProvider());
}

// GitHub Sign-In
window.signInWithGithub = async function() {
    await signInWithProvider(new firebase.auth.GithubAuthProvider());
}

// Facebook Sign-In
window.signInWithFacebook = async function() {
    await signInWithProvider(new firebase.auth.FacebookAuthProvider());
}

window.signInWithNostr = async function() {
    if (!checkRateLimit()) return;

    // Check for NIP-07 browser extension (Alby, nos2x, etc.)
    if (!window.nostr) {
        if (typeof showToast === 'function') showToast('No Nostr extension found! Install Alby or nos2x first.');
        window.open('https://getalby.com', '_blank');
        return;
    }

    try {
        // Get public key from extension
        var pubkey = await window.nostr.getPublicKey();
        if (!pubkey || !/^[a-f0-9]{64}$/.test(pubkey)) {
            if (typeof showToast === 'function') showToast('Could not get Nostr public key');
            return;
        }

        // Create auth event for signing
        var nostrEvent = {
            kind: 22242,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['challenge', 'btc-edu-' + Date.now()]],
            content: 'Sign in to Bitcoin Education Archive',
            pubkey: pubkey,
        };

        // Sign with extension
        var signed = await window.nostr.signEvent(nostrEvent);
        if (!signed || !signed.sig) {
            if (typeof showToast === 'function') showToast('Signing cancelled');
            return;
        }

        if (typeof showToast === 'function') showToast('🟣 Verifying Nostr signature...');

        // Send to Cloud Function
        var nostrAuth = firebase.functions().httpsCallable('nostrAuth');
        var result = await nostrAuth({
            pubkey: pubkey,
            sig: signed.sig,
            event: signed,
        });

        if (result.data && result.data.token) {
            // Sign in with custom token
            await auth.signInWithCustomToken(result.data.token);

            // Set up user doc if needed
            var uid = result.data.uid;
            var userDoc = await db.collection('users').doc(uid).get();
            if (!userDoc.exists || !userDoc.data().username) {
                var npubShort = 'npub...' + pubkey.substring(0, 8);
                await db.collection('users').doc(uid).set({
                    username: npubShort,
                    nostr: pubkey,
                    points: 0,
                    channelsVisited: 0,
                    totalVisits: 1,
                    streak: 1,
                    lastVisit: new Date().toISOString().split('T')[0],
                    created: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }

            loadUser(uid);
            hideUsernamePrompt();
            if (typeof showToast === 'function') showToast('🟣 Signed in with Nostr!');
        }
    } catch(e) {
        console.error('Nostr auth error:', e);
        if (typeof showToast === 'function') showToast('Nostr sign-in failed. Try again.');
    }
}

// Apple Sign-In removed

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
    return /FBAN|FBAV|Instagram|Twitter|Line\/|Snapchat|BytedanceWebview|musical_ly|TikTok|Weibo|MicroMessenger|LinkedInApp/i.test(ua);
}

async function signInWithProvider(provider) {
    if (!checkRateLimit()) return;

    // In-app browsers (Twitter, Instagram, etc): use redirect instead of popup
    if (isInAppBrowser()) {
        // Save anonymous data before redirect so we can merge when they come back
        if (auth.currentUser && auth.currentUser.isAnonymous) {
            const anonDoc = await db.collection('users').doc(auth.currentUser.uid).get();
            if (anonDoc.exists) {
                localStorage.setItem('btc_anon_uid', auth.currentUser.uid);
                localStorage.setItem('btc_anon_data', JSON.stringify(anonDoc.data()));
            }
        }
        auth.signInWithRedirect(provider);
        return;
    }

    try {
        // Save anonymous user info BEFORE popup changes auth state
        const anonUser = auth.currentUser;
        let anonUid = null;
        let anonData = null;
        if (anonUser && anonUser.isAnonymous) {
            anonUid = anonUser.uid;
            const anonDoc = await db.collection('users').doc(anonUid).get();
            if (anonDoc.exists) anonData = anonDoc.data();
        }

        const result = await auth.signInWithPopup(provider);
        const user = result.user;

        const existingDoc = await db.collection('users').doc(user.uid).get();
        if (!existingDoc.exists) {
            if (anonData) {
                // Migrate anonymous data to the new authenticated account
                anonData.email = user.email || '';
                if (!anonData.username) anonData.username = user.displayName || 'Bitcoiner';
                await db.collection('users').doc(user.uid).set(anonData);
            } else {
                await db.collection('users').doc(user.uid).set({
                    username: user.displayName || 'Bitcoiner',
                    email: user.email || '',
                    points: 0,
                    channelsVisited: 0,
                    totalVisits: 1,
                    streak: 1,
                    lastVisit: new Date().toISOString().split('T')[0],
                    created: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        } else {
            // Existing authenticated user — merge points if anon had more
            if (anonData) {
                const existData = existingDoc.data();
                if ((anonData.points || 0) > (existData.points || 0)) {
                    await existingDoc.ref.update({
                        points: anonData.points,
                        channelsVisited: Math.max(anonData.channelsVisited || 0, existData.channelsVisited || 0),
                        totalVisits: (existData.totalVisits || 0) + (anonData.totalVisits || 0),
                    });
                }
            }
            if (!existingDoc.data().email && user.email) {
                await existingDoc.ref.update({ email: user.email });
            }
        }

        // Delete the old anonymous user document to prevent duplicates on leaderboard
        if (anonUid && anonUid !== user.uid) {
            try { await db.collection('users').doc(anonUid).delete(); } catch(e) {}
        }

        loadUser(user.uid);

        // If this is a NEW user, attach referral and show giveaway prompt
        if (!existingDoc.exists) {
            if (typeof attachReferral === 'function') attachReferral(user.uid);
            showGiveawayPrompt(user.uid, user.displayName || user.email || 'Bitcoiner');
        } else {
            hideUsernamePrompt();
            showToast('✅ Signed in as ' + (user.displayName || user.email || 'Bitcoiner'));
        }
    } catch(e) {
        console.log('Provider sign-in error:', e);
        if (e.code !== 'auth/popup-closed-by-user') {
            showToast('Sign-in error. Please try again.');
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
            '<input type="text" id="giveawayLnProvider" placeholder="⚡ Lightning address (e.g. you@walletofsatoshi.com)" style="width:100%;padding:12px 14px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.85rem;font-family:inherit;outline:none;">' +
            '<p style="color:var(--text-faint);font-size:0.7rem;margin:6px 0 0;">Enter a Lightning address so we can send you the sats if you win! 🏆</p>' +
        '</div>' +
        '<button onclick="submitGiveawayProvider(\'' + uid + '\',\'' + displayName.replace(/'/g, "\\'") + '\')" style="width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:8px;">Enter Giveaway & Continue →</button>' +
        '<span class="skip" onclick="hideUsernamePrompt();showToast(\'✅ Signed in as ' + displayName.replace(/'/g, "\\'") + '\')" style="color:var(--text-faint);font-size:0.85rem;cursor:pointer;display:block;text-align:center;">Skip giveaway</span>';
    modal.classList.add('open');

    // Toggle lightning address visibility
    document.getElementById('giveawayCheckboxProvider').addEventListener('change', function() {
        document.getElementById('giveawayLnProvider').style.display = this.checked ? 'block' : 'none';
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
                giveaway: {
                    entered: true,
                    lightningAddress: lnAddress,
                    enteredAt: new Date().toISOString()
                }
            });
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
    if (typeof markVisibleBadgesReady === 'function') markVisibleBadgesReady();
    restoreVisitedUI();
    updateRankUI();
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
        rankingReady = true;
        updateRankUI();
        if (typeof renderProgressRings === 'function') renderProgressRings();
        awardVisitPoints();
        startReadTimer();

        // Restore badges and scholar status from Firebase
        if (isRealUser) {
            if (currentUser.hiddenBadges) {
                localStorage.setItem('btc_hidden_badges', JSON.stringify(currentUser.hiddenBadges));
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
            if (currentUser.nachoStoryProgress) {
                var localStory = parseInt(localStorage.getItem('btc_nacho_story') || '0');
                if (currentUser.nachoStoryProgress > localStory) {
                    localStorage.setItem('btc_nacho_story', currentUser.nachoStoryProgress.toString());
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
        if (typeof markVisibleBadgesReady === 'function') markVisibleBadgesReady();

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
        if (typeof markVisibleBadgesReady === "function") markVisibleBadgesReady();
            updateRankUI();
            updateAuthButton();
        }
    }
}

function updateAuthButton() {
    const btn = document.getElementById('authBtn');
    if (!btn) return;
    var isSignedIn = auth && auth.currentUser && !auth.currentUser.isAnonymous;
    var hasUsername = currentUser && currentUser.username;

    if (isSignedIn || hasUsername) {
        btn.textContent = '⚙️ ' + (hasUsername ? hasUsername : 'My Account') + ' — Settings';
        btn.style.borderColor = '#22c55e';
        btn.style.color = '#22c55e';
        btn.onmouseover = function() { this.style.background='#22c55e'; this.style.color='#fff'; };
        btn.onmouseout = function() { this.style.background='none'; this.style.color='#22c55e'; };
    } else {
        btn.textContent = 'Create Free Account / Sign In';
        btn.style.borderColor = 'var(--accent)';
        btn.style.color = 'var(--accent)';
        btn.onmouseover = function() { this.style.background='var(--accent)'; this.style.color='#fff'; };
        btn.onmouseout = function() { this.style.background='none'; this.style.color='var(--accent)'; };
    }
}

// Sanitize user input — strip HTML tags and dangerous chars
function sanitizeInput(str) {
    return str.replace(/<[^>]*>/g, '').replace(/[<>"'&]/g, '').trim();
}

// Profanity filter
const PROFANITY_LIST = [
    'fuck','shit','ass','bitch','dick','cock','pussy','cunt','damn','hell',
    'bastard','slut','whore','fag','nigger','nigga','retard','penis','vagina',
    'porn','sex','anal','cum','jizz','dildo','tits','boob','nude','naked',
    'hentai','milf','orgasm','erect','molest','rape','pedo','nazi','hitler',
    'kkk','jihad','terrorist','kill','murder','suicide','die','stfu','gtfo',
    'wank','twat','bollocks','arse','shag','piss','crap','douche','skank',
    'thot','incel','simp','onlyfans','xnxx','pornhub','xvideos'
];

function containsProfanity(str) {
    const lower = str.toLowerCase().replace(/[^a-z]/g, ' ');
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

async function createUser(username, email, enteredGiveaway, giveawayLnAddress) {
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
    if (enteredGiveaway && giveawayLnAddress) {
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
    currentUser = { uid, ...userData };
    rankingReady = true;
    window._badgesReady = true;
        if (typeof markVisibleBadgesReady === "function") markVisibleBadgesReady();
    updateRankUI();
    updateAuthButton();
    awardPoints(POINTS.visit, 'Welcome bonus!');
    startReadTimer();
    hideUsernamePrompt();
    // Hide giveaway banner after registration
    var banner = document.getElementById('giveawayBanner');
    if (banner) banner.style.display = 'none';

    // Attach referral if user came via referral link
    if (typeof attachReferral === 'function') attachReferral(uid);
    // Initialize Orange Tickets for new user
    if (typeof onUserLoadedTickets === 'function') onUserLoadedTickets();
    // Initialize messaging
    if (typeof initMessaging === 'function') initMessaging();
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
            // Deduct from Firestore immediately
            if (!currentUser._isLocal) {
                db.collection('users').doc(currentUser.uid).update({ 
                    streakFreezes: firebase.firestore.FieldValue.increment(-1)
                }).catch(function(){});
            }
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
        const updateData = {
            totalVisits: firebase.firestore.FieldValue.increment(1),
            lastVisit: today,
            streak: newStreak,
            points: firebase.firestore.FieldValue.increment(pointsToAdd + (bonusTickets * 5))
        };
        if (bonusTickets > 0) {
            updateData.orangeTickets = firebase.firestore.FieldValue.increment(bonusTickets);
        }
        await db.collection('users').doc(currentUser.uid).update(updateData);
        currentUser.points = (currentUser.points || 0) + pointsToAdd + (bonusTickets * 5);
        currentUser.orangeTickets = (currentUser.orangeTickets || 0) + bonusTickets;
        currentUser.lastVisit = today;
        currentUser.streak = newStreak;
    }
    
    if (bonusTickets > 0) {
        setTimeout(function() {
            showToast('🔥 STREAK MILESTONE! Day ' + newStreak + ': Earned +' + bonusTickets + ' Bonus Tickets! 🎟️');
        }, 3500);
    } else if (streakBonus) {
        showToast('🔥 Day ' + currentUser.streak + ' streak! +' + (POINTS.visit + POINTS.streak) + ' pts');
    }
    // Silent for non-streak daily visits — ticket toast covers it
    updateRankUI();
    if (typeof renderProgressRings === 'function') renderProgressRings();
    refreshLeaderboardIfOpen();
}

async function awardPoints(pts, reason) {
    if (!currentUser || !rankingReady) return;
    if (currentUser._isLocal) {
        // Anonymous user — save to localStorage only, no Firestore write
        currentUser.points = (currentUser.points || 0) + pts;
        localStorage.setItem('btc_points', currentUser.points.toString());
    } else {
        await db.collection('users').doc(currentUser.uid).update({
            points: firebase.firestore.FieldValue.increment(pts)
        });
        currentUser.points = (currentUser.points || 0) + pts;
    }
    // Toast for point awards — show for trivia/quiz (5+) and significant awards (25+)
    if (pts >= 5 || (reason && (reason.indexOf('Trivia') !== -1 || reason.indexOf('trivia') !== -1 || reason.indexOf('🧠') !== -1))) {
        showToast('+' + pts + ' pts — ' + reason);
    }
    updateRankUI();
    if (typeof renderProgressRings === 'function') renderProgressRings();
    refreshLeaderboardIfOpen();
    if (typeof nachoOnPoints === 'function') nachoOnPoints(pts);
}

// Auto-refresh leaderboard if it's currently open
function refreshLeaderboardIfOpen() {
    var lb = document.getElementById('leaderboard');
    if (lb && lb.classList.contains('open') && !lb.classList.contains('minimized')) {
        // Clear cache so next open fetches fresh data
        window._lbCache = null;
        window._lbCacheTime = null;
        // Debounce: wait a moment for Firestore to propagate
        clearTimeout(window._lbRefreshTimer);
        window._lbRefreshTimer = setTimeout(function() {
            toggleLeaderboard(); // close
            toggleLeaderboard(); // re-open with fresh data
        }, 800);
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
            setTimeout(() => { showToast('⚡ 2X POINTS! Daily boost applied! +' + ptsAwarded + ' pts'); }, 2000);
        }

        if (currentUser._isLocal) {
            currentUser.points = (currentUser.points || 0) + ptsAwarded;
            currentUser.channelsVisited = (currentUser.channelsVisited || 0) + 1;
            localStorage.setItem('btc_points', currentUser.points.toString());
        } else {
            await db.collection('users').doc(currentUser.uid).update({
                channelsVisited: firebase.firestore.FieldValue.increment(1),
                points: firebase.firestore.FieldValue.increment(ptsAwarded),
                visitedChannelsList: firebase.firestore.FieldValue.arrayUnion(channelId)
            });
            currentUser.points = (currentUser.points || 0) + ptsAwarded;
            currentUser.channelsVisited = (currentUser.channelsVisited || 0) + 1;
        }
        if (currentUser.readChannels) {
            if (currentUser.readChannels.indexOf(channelId) === -1) currentUser.readChannels.push(channelId);
        } else {
            currentUser.readChannels = [channelId];
        }
        // Silent — routine action, don't interrupt
        updateRankUI();
        if (typeof renderProgressRings === 'function') renderProgressRings();
        refreshLeaderboardIfOpen();

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
            await awardPoints(POINTS.explore10, 'Explorer bonus! 10 channels 🎉');
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
    if (!currentUser || !db || !auth.currentUser || currentUser._isLocal) return;
    try {
        await db.collection('users').doc(auth.currentUser.uid).update({
            readChannels: firebase.firestore.FieldValue.arrayUnion(channelId)
        });
    } catch(e) {}
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
            hasScrolledSinceLastAward = false; // Reset — must scroll again for next award
            if (currentUser._isLocal) {
                currentUser.points = (currentUser.points || 0) + POINTS.readTime;
                localStorage.setItem('btc_points', currentUser.points.toString());
            } else {
                await db.collection('users').doc(currentUser.uid).update({
                    points: firebase.firestore.FieldValue.increment(POINTS.readTime)
                });
                currentUser.points = (currentUser.points || 0) + POINTS.readTime;
            }
            // Silent — don't interrupt reading flow
            updateRankUI();
            refreshLeaderboardIfOpen();
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
    var pts = currentUser.points || 0;
    if (pts < 1) {
        if (banner) banner.style.display = 'none';
        return;
    }
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'guestPointsBanner';
        banner.style.cssText = 'position:fixed;top:44px;right:20px;z-index:200;display:flex;align-items:center;gap:10px;padding:10px 16px;background:linear-gradient(135deg,#1a1a2e,#2d1f4e);border:2px solid #f7931a;border-radius:14px;box-shadow:0 4px 20px rgba(247,147,26,0.3);font-size:0.85rem;cursor:pointer;transition:0.3s;max-width:320px;';
        banner.onclick = function() { showSignInPrompt(); };
        document.body.appendChild(banner);
    }
    var lv = getLevel(pts);
    banner.innerHTML =
        '<div style="display:flex;flex-direction:column;gap:2px;">' +
            '<div style="display:flex;align-items:center;gap:6px;">' +
                '<span style="font-size:1.2rem;">' + lv.emoji + '</span>' +
                '<span style="color:#f7931a;font-weight:800;font-size:1rem;">' + pts.toLocaleString() + ' pts</span>' +
            '</div>' +
            '<div style="color:#ccc;font-size:0.75rem;">Sign in to keep your points & get on the leaderboard!</div>' +
        '</div>' +
        '<div style="background:#f7931a;color:#000;padding:6px 14px;border-radius:10px;font-weight:800;font-size:0.8rem;white-space:nowrap;flex-shrink:0;">Sign Up Free →</div>';
    banner.style.display = 'flex';
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
    }
    lastLevelName = lv.name;
    lastLevelMin = lv.min;

    const bar = document.getElementById('rankBar');
    if (!bar) return;

    let progressHtml = '';
    if (lv.next) {
        const pct = Math.min(100, ((currentUser.points - lv.min) / (lv.next.min - lv.min)) * 100);
        progressHtml = '<div class="rank-progress"><div class="rank-progress-fill" style="width:' + pct + '%"></div></div>' +
            '<div class="rank-next">' + (lv.next.min - currentUser.points) + ' pts to ' + lv.next.emoji + ' ' + lv.next.name + '</div>';
    }

    const isAnon = auth.currentUser && auth.currentUser.isAnonymous;
    const signInLink = isAnon && currentUser.username ? '<div style="font-size:0.7rem;margin-top:4px;"><a href="#" onclick="event.stopPropagation();showSignInPrompt();return false;" style="color:var(--link);text-decoration:none;">🔗 Sign in to sync across devices</a></div>' : '';

    const streak = currentUser.streak || 0;
    const isMilestone = streak > 0 && (streak % 7 === 0 || streak === 30 || streak === 100 || streak === 365);
    const streakHtml = streak > 0 ? '<span class="rank-streak' + (isMilestone ? ' streak-milestone' : '') + '" style="color:#f97316;font-size:0.7rem;font-weight:700;' + (isMilestone ? 'animation:streakGlow 2s ease-in-out infinite;' : '') + '">🔥 ' + streak + ' day streak' + (isMilestone ? ' ✨' : '') + '</span>' : '';
    const ticketHtml = (currentUser.orangeTickets || 0) > 0 ? '<span style="color:#f7931a;font-size:0.7rem;font-weight:700;margin-left:6px;"><svg viewBox="0 0 24 24" style="width:1em;height:1em;vertical-align:-0.15em;display:inline-block"><path fill="#f7931a" d="M22 10V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v4c1.1 0 2 .9 2 2s-.9 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2z"/></svg>' + currentUser.orangeTickets + '</span>' : '';

    bar.innerHTML =
        '<div class="rank-info" onclick="toggleLeaderboard()">' +
            '<span class="rank-level">' + lv.emoji + ' ' + lv.name + '</span>' +
            '<span class="rank-user">' + (currentUser.username || 'Anon') + '</span>' +
            '<span class="rank-pts">' + (currentUser.points || 0).toLocaleString() + ' pts</span>' +
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
        // Anonymous user — eye-catching banner with points + sign up nudge
        el.style.cssText = 'position:fixed;top:44px;right:20px;z-index:200;display:flex;align-items:center;gap:10px;padding:10px 16px;background:linear-gradient(135deg,#1a1a2e,#2d1f4e);border:2px solid #f7931a;border-radius:14px;box-shadow:0 4px 20px rgba(247,147,26,0.3);font-size:0.85rem;cursor:pointer;transition:0.3s;max-width:380px;';
        el.onclick = function() { showSettingsPage('account'); };
        el.innerHTML =
            '<div style="display:flex;flex-direction:column;gap:2px;">' +
                '<div style="display:flex;align-items:center;gap:6px;">' +
                    '<span style="font-size:1.1rem;">' + lv.emoji + '</span>' +
                    '<span style="color:var(--text);font-weight:600;">Anonymous</span>' +
                    '<span style="color:#f7931a;font-weight:800;font-size:0.9rem;">' + pts.toLocaleString() + ' pts</span>' +
                '</div>' +
                '<div style="color:#aaa;font-size:0.7rem;">Sign in to keep your points & enter the leaderboard!</div>' +
            '</div>' +
            '<div onclick="event.stopPropagation();showUsernamePrompt();" style="background:#f7931a;color:#000;padding:6px 14px;border-radius:10px;font-weight:800;font-size:0.8rem;white-space:nowrap;flex-shrink:0;">Sign Up Free →</div>';
    } else {
        // Signed in user (with username or real account) — clean display
        el.style.cssText = 'position:fixed;top:44px;right:20px;z-index:130;display:flex;align-items:center;gap:8px;padding:8px 14px;background:var(--bg-side);border:1px solid var(--border);border-radius:10px;font-size:0.8rem;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.2);transition:0.2s;';
        el.onclick = function() { showSettingsPage('account'); };
        var displayName = currentUser.username || (auth.currentUser && auth.currentUser.displayName) || 'Anon';
        el.innerHTML = '<span style="font-size:1.1rem;">' + displayEmoji + '</span>' +
            '<span style="color:var(--text);font-weight:600;">' + escapeHtml(displayName) + '</span>' +
            '<span style="color:var(--accent);font-weight:700;font-size:0.75rem;">' + pts.toLocaleString() + ' pts</span>' + streakBit;
    }
    el.style.display = 'flex';

    // Update mobile top bar user info
    const mobileInfo = document.getElementById('mobileUserInfo');
    if (mobileInfo) {
        const streak = (currentUser.streak || 0) > 0 ? ' 🔥' + currentUser.streak : '';
        mobileInfo.textContent = displayEmoji + ' ' + (currentUser.username || (isAnon ? 'Anonymous' : 'Anon')) + streak;
        mobileInfo.style.display = 'inline';
    }

    // Update home page welcome banner
    const wb = document.getElementById('welcomeBanner');
    if (wb && currentUser.username) {
        const streak = currentUser.streak || 0;
        const streakText = streak > 0 ? '<span style="color:#f97316;font-weight:700;"> · 🔥 ' + streak + ' day streak</span>' : '';
        wb.innerHTML = '<span style="font-size:1.2rem;">' + lv.emoji + '</span> ' +
            '<span style="color:var(--heading);font-weight:700;">Welcome back, ' + currentUser.username + '!</span>' +
            '<span style="color:var(--text-muted);font-size:0.85rem;"> · ' + lv.name + ' · ' + (currentUser.points || 0).toLocaleString() + ' pts</span>' +
            streakText +
            '<div style="color:var(--text-faint);font-size:0.75rem;margin-top:4px;">⚙️ Tap here for Account & Settings</div>';
        wb.style.display = 'block';
    }
}

function showLevelUpCelebration(lv) {
    // Suppress during Nacho Mode — track for exit summary instead
    if (window._nachoBusy || window._nachoMode) {
        if (window._nachoModeEarnings) window._nachoModeEarnings.badges.push('🎉 Level up: ' + lv.emoji + ' ' + lv.name);
        return;
    }
    // Play triumphant sound
    if (typeof canPlaySound === 'function' && !canPlaySound()) {} else if (typeof audioEnabled !== 'undefined' && !audioEnabled) {} else {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
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
    if (typeof nachoFly === 'function') nachoFly();

    // Level-up modal
    const overlay = document.createElement('div');
    overlay.id = 'levelUpModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:400;display:flex;justify-content:center;align-items:center;animation:fadeIn 0.3s ease-out;';

    overlay.innerHTML = '<div style="background:var(--bg-side);border:1px solid var(--border);border-radius:20px;padding:40px;max-width:360px;width:90%;text-align:center;animation:fadeSlideIn 0.4s ease-out;">' +
        '<div style="font-size:4rem;margin-bottom:12px;animation:badgeBounce 0.6s ease-out;">' + lv.emoji + '</div>' +
        '<div style="color:#f7931a;font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;font-weight:800;margin-bottom:8px;">⬆️ LEVEL UP!</div>' +
        '<div style="color:var(--heading);font-size:1.6rem;font-weight:900;margin-bottom:8px;">' + lv.name + '</div>' +
        '<div style="color:var(--text-muted);font-size:0.95rem;margin-bottom:4px;">You\'ve reached ' + lv.min.toLocaleString() + '+ points!</div>' +
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
        'Stacker': 'Stacking sats and stacking knowledge. Impressive.',
        'Hodler': 'Diamond hands. Diamond mind. You\'re in deep.',
        'Maxi': 'There is no second best. You know it.',
        'Cypherpunk': 'Privacy. Sovereignty. Code is law. You get it.',
        'Whale': 'Moving markets and moving minds. You\'re a force of nature.',
        'Satoshi': 'The pinnacle. You\'ve achieved legendary status.',
    };
    return flavors[name] || 'You\'re leveling up!';
}

// Leaderboard
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

// Close leaderboard when clicking outside
document.addEventListener('click', function(e) {
    var lb = document.getElementById('leaderboard');
    if (!lb || !lb.classList.contains('open') || lb.classList.contains('minimized')) return;
    if (lb.contains(e.target)) return;
    // Don't close if clicking the rank bar or leaderboard button
    var rankBar = document.getElementById('rankBar');
    if (rankBar && rankBar.contains(e.target)) return;
    var fab = document.getElementById('lbFloatBtn');
    if (fab && fab.contains(e.target)) return;
    // Close it
    lb.classList.remove('open');
    lb.classList.remove('minimized');
    if (fab) fab.style.display = 'flex';
});

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
        db.collection('users').doc(auth.currentUser.uid).update({ nachoNickname: nick }).catch(function(){});
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
    if (avatarName) avatarName.textContent = name.toUpperCase();
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

async function toggleLeaderboard() {
    const lb = document.getElementById('leaderboard');
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
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
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
        var useCache = window._lbCache && window._lbCacheTime && (now - window._lbCacheTime < 300000);
        let allUsers = [];
        if (useCache) {
            allUsers = window._lbCache;
        } else {
            const snap = await db.collection('users').orderBy('points', 'desc').limit(100).get();
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

            html += '<div' + hidden + ' onclick="showUserProfile(\'' + d.id + '\')" style="cursor:pointer;" title="View profile">' +
                '<span class="lb-rank">' + medal + '</span>' +
                '<span class="lb-name">' + lv.emoji + ' ' + (d.username || 'Anon') + statusDot + certIcons + '</span>' +
                '<span class="lb-score">' + (d.points || 0).toLocaleString() + ' pts</span>' +
            '</div>';
        });

        if (allUsers.length > 10) {
            html += '<button id="lbShowMore" onclick="expandLeaderboard(event)" style="width:100%;padding:10px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:0.85rem;cursor:pointer;font-family:inherit;margin:8px 0;transition:0.2s;">Show all ' + allUsers.length + ' users ▼</button>';
        }
        html += '</div>';

        // Badges section
        if (typeof getBadgeHTML === 'function') {
            html += '<div class="lb-levels"><h4>Your Badges</h4>' + getBadgeHTML() + '</div>';
        }

        // Level guide
        html += '<div class="lb-levels"><h4>Levels</h4>';
        for (const l of LEVELS) {
            html += '<div class="lb-level-row"><span>' + l.emoji + ' ' + l.name + '</span><span>' + l.min + '+ pts</span></div>';
        }
        html += '</div>';

        lb.innerHTML = html;
    } catch(e) {
        lb.innerHTML = '<div style="padding:20px;color:#f97316;">Error loading leaderboard</div>';
    }
}

// Toast notifications
var _toastQueue = [];
function showToast(msg) {
    // If Nacho is busy (Q&A, voice, reading answer), queue the toast
    if (window._nachoBusy) {
        _toastQueue.push(msg);
        return;
    }
    _showToastNow(msg);
}
function _showToastNow(msg) {
    const t = document.createElement('div');
    t.className = 'rank-toast';
    t.innerHTML = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 2500);
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
        document.getElementById('usernameModal').classList.add('open');
    } catch(e) {
        if (typeof showToast === 'function') showToast('Settings error: ' + e.message);
        console.error('showUsernamePrompt error:', e);
    }
}

function showAccountInfo() {
    showSettingsPage('account');
}

let settingsTab = 'account';

function shortcutRow(key, desc) {
    return '<div><kbd style="background:var(--bg-side);border:1px solid var(--border);padding:2px 7px;border-radius:4px;font-family:monospace;font-size:0.75rem;color:var(--heading);min-width:20px;display:inline-block;text-align:center;">' + key + '</kbd></div><div style="color:var(--text-muted);font-size:0.8rem;">' + desc + '</div>';
}

// Alias for buttons that call showSettings()
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


// --- RESTORED CORE SETTINGS & PROFILE LOGIC ---

window.showSettings = function() {
    if (typeof auth === 'undefined' || !auth) {
        if (typeof showToast === 'function') showToast('⚠️ Firebase not ready.');
        return;
    }
    showUsernamePrompt();
};

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
    ['account', 'scholar', 'signal', 'tickets', 'prefs', 'security', 'data'].forEach(t => {
        const icons = { account: '👤', scholar: '🎓', signal: '📡', tickets: '🎟️', prefs: '🎨', security: '🔒', data: '📊' };
        const names = { account: 'Acct', scholar: 'Scholar', signal: 'Signal', tickets: 'Tickets', prefs: 'Prefs', security: 'Lock', data: 'Stats<br>Nacho' };
        const active = settingsTab === t;
        html += '<button onclick="showSettingsPage(\'' + t + '\')" style="flex:1;min-width:0;padding:6px 1px;border:none;background:' + (active ? 'var(--accent-bg)' : 'none') + ';color:' + (active ? 'var(--accent)' : 'var(--text-muted)') + ';font-size:0.5rem;font-weight:' + (active ? '700' : '500') + ';cursor:pointer;font-family:inherit;border-bottom:' + (active ? '2px solid var(--accent)' : '2px solid transparent') + ';margin-bottom:-2px;display:flex;flex-direction:column;align-items:center;gap:1px;white-space:nowrap;touch-action:manipulation;"><span style="font-size:1.3rem;line-height:1;">' + icons[t] + '</span>' + names[t] + '</button>';
    });
    html += '</div>';

    if (settingsTab === 'account') {
        var isAnon = user.isAnonymous;
        var settingsEmoji = getUserDisplayEmoji(lvl);
        html += '<div style="text-align:center;margin-bottom:20px;">' +
            '<div style="font-size:2.5rem;margin-bottom:8px;">' + settingsEmoji + '</div>' +
            '<div style="color:var(--heading);font-weight:700;font-size:1.2rem;">' + (currentUser ? currentUser.username || 'Bitcoiner' : 'Bitcoiner') + '</div>' +
            '<div style="color:var(--text-muted);font-size:0.85rem;margin-top:4px;">' + lvl.name + ' · ' + (currentUser ? currentUser.points || 0 : 0).toLocaleString() + ' pts</div>' +
            '</div>';

        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Account Details</div>';
        if (user.email) html += '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);"><span style="color:var(--text-muted);font-size:0.85rem;">Email</span><span style="color:var(--text);font-size:0.85rem;">' + user.email + '</span></div>';
        if (user.displayName) html += '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);"><span style="color:var(--text-muted);font-size:0.85rem;">Name</span><span style="color:var(--text);font-size:0.85rem;">' + user.displayName + '</span></div>';

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
        html += '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);"><span style="color:var(--text-muted);font-size:0.85rem;">Sign-in method</span><span style="color:var(--text);font-size:0.85rem;">' + provider + '</span></div>';

        // Account created
        if (currentUser && currentUser.created) {
            const created = currentUser.created.toDate ? currentUser.created.toDate().toLocaleDateString() : new Date(currentUser.created).toLocaleDateString();
            html += '<div style="display:flex;justify-content:space-between;padding:8px 0;"><span style="color:var(--text-muted);font-size:0.85rem;">Member since</span><span style="color:var(--text);font-size:0.85rem;">' + created + '</span></div>';
        }
        html += '</div>';

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
                html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
                    '<div onclick="window._expanded_badges=!window._expanded_badges;showSettingsPage(\'account\')" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;-webkit-tap-highlight-color:rgba(247,147,26,0.2);">' +
                    '<div><div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">🏅 Display Badge</div>' +
                    '<div style="color:var(--text);font-size:0.85rem;margin-top:4px;">' + currentBadgeDisplay + '</div></div>' +
                    '<span style="color:var(--text-faint);font-size:1rem;transition:0.2s;">' + (window._expanded_badges ? '▾' : '▸') + '</span></div>';
                if (window._expanded_badges) {
                    html += '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">' +
                        '<div style="color:var(--text-muted);font-size:0.75rem;margin-bottom:10px;">Choose a badge to show next to your name instead of your rank emoji.</div>' +
                        '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">';
                    html += '<div onclick="setDisplayBadge(\'\')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;border:1px solid ' + (!chosenBadge ? 'var(--accent)' : 'var(--border)') + ';background:' + (!chosenBadge ? 'rgba(247,147,26,0.1)' : 'var(--card-bg)') + ';cursor:pointer;margin-bottom:6px;transition:0.2s;"><span style="font-size:1.3rem;">' + lvl.emoji + '</span><div><div style="color:var(--text);font-size:0.85rem;font-weight:600;">' + lvl.name + ' (Default)</div><div style="color:var(--text-faint);font-size:0.7rem;">Your current rank emoji</div></div>' + (!chosenBadge ? '<span style="margin-left:auto;color:var(--accent);font-size:0.8rem;font-weight:700;">✓</span>' : '') + '</div>';
                    for (var bi = 0; bi < allEarned.length; bi++) {
                        var b = allEarned[bi];
                        var isChosen = chosenBadge === b.id;
                        html += '<div onclick="setDisplayBadge(\'' + b.id + '\')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;border:1px solid ' + (isChosen ? 'var(--accent)' : 'var(--border)') + ';background:' + (isChosen ? 'rgba(247,147,26,0.1)' : 'var(--card-bg)') + ';cursor:pointer;margin-bottom:6px;transition:0.2s;"><span style="font-size:1.3rem;">' + b.emoji + '</span><div><div style="color:var(--text);font-size:0.85rem;font-weight:600;">' + b.name + '</div></div>' + (isChosen ? '<span style="margin-left:auto;color:var(--accent);font-size:0.8rem;font-weight:700;">✓</span>' : '') + '</div>';
                    }
                    html += '</div>';
                }
                html += '</div>';
            }
        }

        // Change username
        const currentName = currentUser ? currentUser.username || '' : '';
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">✏️ Change Username</div>' +
            '<div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:10px;">Current username: <span style="color:var(--accent);font-weight:700;">' + currentName + '</span></div>' +
            '<input type="text" id="newUsername" value="" placeholder="Type your new username here..." maxlength="20" style="width:100%;padding:12px 14px;background:var(--input-bg);border:2px solid var(--border);border-radius:10px;color:var(--text);font-size:1rem;font-family:inherit;outline:none;margin-bottom:10px;box-sizing:border-box;" onfocus="this.style.borderColor=\'var(--accent)\'" onblur="this.style.borderColor=\'var(--border)\'">' +
            '<button onclick="changeUsername()" style="width:100%;padding:12px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;">Save New Username</button>' +
            '<div id="usernameStatus" style="margin-top:8px;font-size:0.85rem;"></div></div>';

        // Profile section
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
            html += '<div class="pf-link-row" data-key="' + s.k + '" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
                '<span style="font-size:1.1rem;width:24px;text-align:center;flex-shrink:0;">' + s.e + '</span>' +
                '<input type="' + (s.t || 'text') + '" id="profile_' + s.k + '" value="' + escapeHtml(val) + '" placeholder="' + s.p + '" maxlength="' + s.m + '" style="flex:1;padding:8px 10px;background:var(--input-bg,rgba(255,255,255,0.05));border:1px solid var(--border);border-radius:8px;color:var(--text,#e2e8f0);font-size:15px;font-family:inherit;outline:none;box-sizing:border-box;min-width:0;-webkit-appearance:none;">' +
                '<button onclick="document.getElementById(\'profile_' + s.k + '\').value=\'\';this.parentElement.remove();profileLinkRemoved(\'' + s.k + '\')" style="background:none;border:none;color:var(--text-faint);font-size:1rem;cursor:pointer;padding:4px;flex-shrink:0;touch-action:manipulation;" title="Remove">✕</button>' +
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

        html += '<button onclick="signOutUser()" style="width:100%;padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:#ef4444;font-size:0.9rem;cursor:pointer;font-family:inherit;font-weight:600;">Sign Out</button>';

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

        // Flashcards
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:16px;padding:20px;margin-bottom:16px;">' +
            '<div style="text-align:center;margin-bottom:12px;"><div style="font-size:1.8rem;margin-bottom:4px;">📚</div>' +
            '<div style="color:var(--heading);font-weight:800;font-size:1.1rem;">Study Flashcards</div>' +
            '<p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:12px;">Prepare for quests and exams with interactive flashcards.</p></div>' +
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
            html += '<button onclick="hideUsernamePrompt();startFlashcards(\'' + t.name.replace(/'/g, "\\'") + '\')" style="padding:6px 10px;background:var(--bg-side);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.75rem;cursor:pointer;font-family:inherit;transition:0.2s;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' + t.emoji + ' ' + t.name + '</button>';
        });
        html += '</div></div>';

    } else if (settingsTab === 'signal') {
        // The Weekly Signal — Newsletter
        html += '<div style="margin-bottom:20px;text-align:center;">' +
            '<div style="font-size:2.5rem;margin-bottom:8px;">📡</div>' +
            '<div style="color:var(--heading);font-weight:800;font-size:1.3rem;">The Weekly Signal</div>' +
            '<p style="color:var(--text-muted);font-size:0.85rem;">Curated Bitcoin insights and site updates.</p>' +
            '</div>';

        // Curated editorial + live news from ticker
        var signalPosts = [
            { date: 'Feb 26, 2026', title: 'Why Proof of Stake is just Fiat 2.0', snippet: 'Most cryptos claim to be better than Bitcoin because they use less energy. But Gigi explains why energy IS the point — PoW converts real-world resources into unforgeable security.', channel: 'pow-vs-pos' },
            { date: 'Feb 19, 2026', title: 'The Great Definancialization', snippet: 'Parker Lewis breaks down why we don\'t need thousands of stocks, bonds, and derivatives if we have one form of hard money that can\'t be debased.', channel: 'problems-of-money' },
            { date: 'Feb 12, 2026', title: 'The 21 Million Cap is Inviolate', snippet: 'Why even if every miner in the world wanted to change the supply, they couldn\'t. The users run the rules.', channel: 'scarce' },
            { date: 'Feb 5, 2026', title: 'Not Your Keys, Not Your Coins', snippet: 'After another exchange collapse, the importance of self-custody has never been clearer. Here\'s how to take control.', channel: 'self-custody' },
            { date: 'Jan 29, 2026', title: 'The Halving: Scarcity You Can Verify', snippet: 'Every 210,000 blocks, the supply issuance gets cut in half. No vote. No committee. Just code.', channel: 'difficulty-adjustment' }
        ];

        // Also load live news from ticker data
        html += '<div style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-weight:700;">📰 Latest News</div>';
        html += '<div id="signalLiveNews" style="margin-bottom:20px;"><div style="color:var(--text-faint);font-size:0.8rem;padding:12px;">Loading latest news...</div></div>';

        html += '<div style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;margin-top:16px;font-weight:700;">📚 Featured Deep Dives</div>';

        signalPosts.forEach(function(n) {
            html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:16px;padding:16px;margin-bottom:12px;text-align:left;">' +
                '<div style="font-size:0.7rem;color:var(--accent);font-weight:800;margin-bottom:4px;">' + n.date.toUpperCase() + '</div>' +
                '<div style="color:var(--heading);font-weight:700;font-size:1rem;margin-bottom:6px;">' + n.title + '</div>' +
                '<div style="color:var(--text-muted);font-size:0.85rem;line-height:1.5;margin-bottom:10px;">' + n.snippet + '</div>' +
                '<button onclick="hideUsernamePrompt();go(\'' + n.channel + '\')" style="padding:8px 16px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;">📖 Read in Archive →</button>' +
                '</div>';
        });

        // Fetch live Bitcoin-only news (try Worker first, fall back to static file)
        setTimeout(function() {
            var proxy = localStorage.getItem('btc_nacho_search_proxy') || 'https://jolly-surf-219enacho-search.needcreations.workers.dev';
            var badWords = /crypto|ethereum|eth |solana|cardano|altcoin|shitcoin|dogecoin|xrp|ripple|nft |defi |web3/i;
            
            function renderNews(container, items) {
                var newsHtml = '';
                items.forEach(function(n) {
                    if (badWords.test(n.title || '') || badWords.test(n.snippet || '')) return;
                    newsHtml += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px;text-align:left;">' +
                        '<div style="font-size:0.65rem;color:var(--accent);font-weight:800;margin-bottom:4px;">' + (n.date || 'TODAY').toUpperCase() + '</div>' +
                        '<div style="color:var(--heading);font-weight:700;font-size:0.95rem;margin-bottom:6px;">' + (n.title || '').replace(/<[^>]+>/g,'') + '</div>' +
                        '<div style="color:var(--text-muted);font-size:0.8rem;line-height:1.5;margin-bottom:8px;">' + (n.snippet || '').replace(/<[^>]+>/g,'') + '</div>' +
                        (n.link || n.url ? '<a href="' + (n.link || n.url) + '" target="_blank" rel="noopener" style="color:var(--accent);font-size:0.8rem;font-weight:700;text-decoration:none;">Read full article →</a>' : '') +
                        '</div>';
                });
                container.innerHTML = newsHtml || '<div style="color:var(--text-faint);font-size:0.8rem;">No Bitcoin news available</div>';
            }
            
            var container = document.getElementById('signalLiveNews');
            if (!container) return;
            
            // Try live search first
            fetch(proxy + '?q=' + encodeURIComponent('Bitcoin BTC price mining lightning network -ethereum -crypto -altcoin'), { signal: AbortSignal.timeout(6000) })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (data && data.results && data.results.length >= 2) {
                        renderNews(container, data.results.slice(0, 5).map(function(r) { return { date: 'Today', title: r.title, snippet: r.snippet, link: r.url }; }));
                    } else { throw new Error('no results'); }
                })
                .catch(function() {
                    // Fall back to static file
                    fetch('newsletter-data.json?v=' + Date.now()).then(function(r) { return r.json(); }).then(function(data) {
                        if (data && data.news) renderNews(container, data.news);
                    }).catch(function() { container.innerHTML = '<div style="color:var(--text-faint);font-size:0.8rem;">Could not load news</div>'; });
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
                '<strong style="color:var(--text);">👥 Referrals:</strong> Earn <strong style="color:var(--accent);">50 tickets</strong> per friend who signs up and reaches Maxi rank (2,100+ pts). Verified automatically.<br>' +
                '<strong style="color:var(--text);">🏅 Badges:</strong> Unlock at 25 🐟, 50 🦈, and 100 🐋 tickets.<br>' +
                '<strong style="color:var(--text);">⭐ Bonus:</strong> Each ticket = +5 points towards your rank.<br>' +
                '<strong style="color:#eab308;">🏆 Giveaways:</strong> More tickets = higher chance of winning sats!' +
                '</div></div>';
        }

        // Load referral stats asynchronously
        if (!isAnon && typeof loadReferralStatsUI === 'function') {
            setTimeout(loadReferralStatsUI, 100);
        }

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
            '<div><span style="color:var(--text);font-size:0.85rem;">Vibration on actions</span><div style="color:var(--text-faint);font-size:0.7rem;">Vibrate on points, badges, and button taps</div></div>' +
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
                '📰 <strong>New content</strong> — when we add major new channels<br>' +
                '🏆 <strong>Giveaway alerts</strong> — never miss a sats giveaway<br><br>' +
                '<span style="color:var(--text-faint);">We send 2-3 notifications per week max. No spam. Ever.</span>' +
            '</div>' +
            '<div id="pushStatus" style="margin-top:8px;font-size:0.75rem;color:var(--text-faint);"></div>' +
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
            shortcutRow('H','Home') + shortcutRow('S / /','Search') + shortcutRow('B','Last channel') +
            shortcutRow('C','Random channel') + shortcutRow('R','Random meme') + shortcutRow('P','Random art') +
            shortcutRow('J / K','Scroll ↓↑') + shortcutRow('Space','Page down') +
            '</div>' +
            '<div style="font-size:0.7rem;color:var(--accent);font-weight:700;margin-bottom:4px;">Features</div>' +
            '<div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin-bottom:10px;">' +
            shortcutRow('N','Nacho Mode') + shortcutRow('A','Ask Nacho') + shortcutRow('M','LightningMart') +
            shortcutRow('F','Forum') + shortcutRow('Q','Start quest') + shortcutRow('L','Leaderboard') +
            '</div>' +
            '<div style="font-size:0.7rem;color:var(--accent);font-weight:700;margin-bottom:4px;">Actions</div>' +
            '<div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;">' +
            shortcutRow('Z','Save to favorites') + shortcutRow('G','Gallery view') +
            shortcutRow('T','Toggle theme') + shortcutRow('I','Settings') + shortcutRow('D','Donate') +
            shortcutRow('?','Show shortcuts') + shortcutRow('Esc','Close modals') +
            '</div>' +
            '<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border);">' +
            '<div style="color:var(--accent);font-weight:700;font-size:0.8rem;margin-bottom:8px;">📱 Mobile Gestures</div>' +
            '<div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;">' +
            shortcutRow('Swipe →','Go home') +
            shortcutRow('Swipe ←','Random channel') +
            shortcutRow('2-finger tap','Leaderboard') +
            shortcutRow('3-finger tap','PlebTalk') +
            shortcutRow('Long-press logo','Nacho Mode') +
            '</div></div>' +
            '</div></div>';
        } // end expanded_shortcuts

        // (Theme moved above)

    } else if (settingsTab === 'security') {
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
                            '<button onclick="if(typeof unblockUser===\'function\'){unblockUser(\'' + uid + '\',\'' + name.replace(/'/g, "\\'") + '\')};showSettingsPage(\'security\')" style="padding:5px 12px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:0.75rem;cursor:pointer;font-family:inherit;">✅ Unblock</button></div>';
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
            '<div style="color:var(--heading);font-weight:700;font-size:1.3rem;">' + pts.toLocaleString() + ' pts</div>' +
            '<div style="color:var(--text-muted);font-size:0.85rem;">' + lvl.name + '</div></div>';

        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Your Stats</div>';

        function statRow(label, value, icon) {
            return '<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);"><span style="color:var(--text-muted);font-size:0.85rem;">' + icon + ' ' + label + '</span><span style="color:var(--text);font-weight:600;font-size:0.85rem;">' + value + '</span></div>';
        }

        html += '<div id="statPts" style="display:none;">' + pts.toLocaleString() + '</div>';
        html += statRow('Total Points', pts.toLocaleString(), '⭐');
        var freezeCount = currentUser ? (currentUser.streakFreezes || 0) : parseInt(localStorage.getItem('btc_streak_freezes') || '0');
        html += statRow('Current Streak', streak + ' days', '🔥');
        html += statRow('🧊 Streak Freezes', freezeCount + ' available', '🧊');
        html += statRow('Total Site Visits', totalVisits, '👁️');
        html += statRow('Channels Explored', Math.max(chVisited, localVisited) + ' / ' + Object.keys(CHANNELS).length, '🗺️');
        html += statRow('Saved Favorites', localFavs, '⭐');
        html += statRow('Hidden Badges Found', hiddenBadges + ' / ' + (typeof HIDDEN_BADGES !== 'undefined' ? HIDDEN_BADGES.length : 8), '🏅');
        html += statRow('Scholar Certified', localStorage.getItem('btc_scholar_passed') === 'true' ? '✅ Yes' : '❌ Not yet', '🎓');
        html += statRow('Orange Tickets', (currentUser ? currentUser.orangeTickets || 0 : 0), '<svg viewBox="0 0 24 24" style="width:1em;height:1em;vertical-align:-0.15em;display:inline-block"><path fill="#f7931a" d="M22 10V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v4c1.1 0 2 .9 2 2s-.9 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2z"/></svg>');
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
            '<div style="display:flex;gap:8px;align-items:center;">' +
            '<input type="text" id="nachoNicknameInput" value="' + escapeHtml(nickname) + '" maxlength="20" placeholder="Type a new name..." style="flex:1;padding:12px 14px;background:rgba(30,41,59,1);border:2px solid #475569;border-radius:10px;color:#f8fafc;font-size:18px;font-family:inherit;outline:none;box-sizing:border-box;-webkit-appearance:none;min-width:0;" onfocus="this.style.borderColor=\'#f7931a\';this.select()" onblur="this.style.borderColor=\'var(--border)\'">' +
            '<button onclick="var n=document.getElementById(\'nachoNicknameInput\').value.trim();if(n)setNachoNickname(n)" style="padding:12px 20px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;">Save</button>' +
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

        // Export data
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Your Data</div>' +
            '<button onclick="exportUserData()" style="width:100%;padding:10px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.85rem;cursor:pointer;font-family:inherit;margin-bottom:8px;">📥 Export My Data</button>' +
            '<button onclick="confirmDeleteAccount()" style="width:100%;padding:10px;background:none;border:1px solid #ef4444;border-radius:8px;color:#ef4444;font-size:0.85rem;cursor:pointer;font-family:inherit;">🗑️ Delete My Account</button>' +
            '</div>';
    }

    html += '<span class="skip" onclick="hideUsernamePrompt()" style="color:var(--text-faint);font-size:0.85rem;margin-top:12px;cursor:pointer;display:block;text-align:center;">Close</span>';
    box.innerHTML = html;
    modal.classList.add('open');

    // Render Nacho's Closet if on Stats/Nacho tab
    if (settingsTab === 'data' && typeof renderNachoClosetUI === 'function') {
        var closetContainer = document.getElementById('nachoClosetContainer');
        if (closetContainer) renderNachoClosetUI(closetContainer);
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
        // Reset to English
        const frame = document.querySelector('.goog-te-banner-frame');
        if (frame) frame.remove();
        document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.' + location.hostname;
        localStorage.setItem('btc_lang', '');
        if (status) status.innerHTML = '<span style="color:#22c55e;">✅ Switched to English</span>';
        setTimeout(() => location.reload(), 500);
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
    row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;';
    row.innerHTML = '<span style="font-size:1.1rem;width:24px;text-align:center;flex-shrink:0;">' + emoji + '</span>' +
        '<input type="' + (type || 'text') + '" id="profile_' + key + '" value="" placeholder="' + placeholder + '" maxlength="' + maxlen + '" style="flex:1;padding:8px 10px;background:var(--input-bg,rgba(255,255,255,0.05));border:1px solid var(--border);border-radius:8px;color:var(--text,#e2e8f0);font-size:15px;font-family:inherit;outline:none;box-sizing:border-box;min-width:0;-webkit-appearance:none;">' +
        '<button onclick="document.getElementById(\'profile_' + key + '\').value=\'\';this.parentElement.remove();profileLinkRemoved(\'' + key + '\')" style="background:none;border:none;color:var(--text-faint);font-size:1rem;cursor:pointer;padding:4px;flex-shrink:0;">✕</button>';
    area.appendChild(row);
    // Hide the menu
    var menu = document.getElementById('addLinkMenu');
    if (menu) menu.style.display = 'none';
    // Focus the new input
    var input = document.getElementById('profile_' + key);
    if (input) input.focus();
};

async function saveProfile() {
    var status = document.getElementById('profileStatus');
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) return;
    // ... basic save logic
}

async function signOutUser() {
    await auth.signOut();
    location.reload();
}

// --- RESTORING DELETED GLOBAL HANDLERS ---
window.hideUsernamePrompt = function() {
    const modal = document.getElementById('usernameModal');
    if (modal) modal.classList.remove('open');
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
        var giveawayCheckbox = document.getElementById('giveawayCheckbox');
        var giveawayLn = document.getElementById('giveawayLnAddress');
        var enteredGiveaway = giveawayCheckbox && giveawayCheckbox.checked;
        var lnAddress = giveawayLn ? giveawayLn.value.trim() : '';

        if (email && enteredGiveaway) {
            // Email signup with giveaway — send magic link for verification
            var sent = await sendMagicLink(email);
            if (sent) {
                localStorage.setItem('btc_pending_username', name);
                localStorage.setItem('btc_pending_email', email);
                if (enteredGiveaway && lnAddress) {
                    localStorage.setItem('btc_pending_giveaway', lnAddress);
                }
                showToast('📧 Check your email for a verification link!');
                hideUsernamePrompt();
                return;
            }
        }

        // No email or giveaway — create user directly
        await createUser(name, email, enteredGiveaway, lnAddress);
        return;
    }

    // SETTINGS USERNAME CHANGE (newUsername exists = settings page)
    if (!currentUser || currentUser._isLocal) { showToast('Sign in first to change username'); return; }
    var status = document.getElementById('usernameStatus');
    if (status) status.innerHTML = 'Saving...';
    try {
        await db.collection('users').doc(currentUser.uid).update({ username: name });
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
if (typeof changeUsername === 'undefined') window.changeUsername = async function(name) { if (!currentUser || !db || !auth || !auth.currentUser) return; try { await db.collection('users').doc(auth.currentUser.uid).update({ username: name }); currentUser.username = name; updateAuthButton(); updateRankUI(); showToast('✅ Username updated to ' + name); } catch(e) { showToast('Error updating username'); } };
if (typeof togglePushNotifications === 'undefined') window.togglePushNotifications = function() { if (typeof showToast === 'function') showToast('Push notifications coming soon!'); };
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
