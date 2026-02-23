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
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
let sessionTimer = null;
let sessionChannels = new Set();
let readTimer = null;
let readSeconds = 0;
let lastReadAward = 0;
let rankingReady = false;
let allTimeChannels = new Set(); // tracks channels already awarded across all sessions
let lastLevelName = '';

// Initialize Firebase
function initRanking() {
    try {
        firebase.initializeApp(FIREBASE_CONFIG);
        db = firebase.firestore();
        auth = firebase.auth();

        // Check if returning from email magic link
        if (firebase.auth.isSignInWithEmailLink(window.location.href)) {
            handleEmailSignIn();
            return;
        }

        // Wait for auth to fully resolve before doing anything
        // This prevents the race condition where anonymous user loads before Google auth restores
        let firstAuthEvent = true;
        auth.onAuthStateChanged(user => {
            if (firstAuthEvent) {
                firstAuthEvent = false;
                if (user && !user.isAnonymous) {
                    // Real user restored immediately — load them
                    loadUser(user.uid);
                    resetSessionTimer();
                    ['click', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
                        document.addEventListener(evt, resetSessionTimer, { passive: true });
                    });
                } else {
                    // Got anonymous or null on first event — wait for potential real user
                    setTimeout(function() {
                        const current = auth.currentUser;
                        if (current && !current.isAnonymous) {
                            // Real user arrived during the wait
                            loadUser(current.uid);
                            resetSessionTimer();
                            ['click', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
                                document.addEventListener(evt, resetSessionTimer, { passive: true });
                            });
                        } else if (current && current.isAnonymous) {
                            loadUser(current.uid);
                        } else {
                            // No user at all — sign in anonymously
                            auth.signInAnonymously().then(() => {});
                        }
                    }, 1500);
                }
                return;
            }
            // Subsequent auth changes (sign in, sign out, etc.)
            if (user) {
                if (currentUser && currentUser.uid === user.uid) {
                    updateAuthButton();
                    return;
                }
                loadUser(user.uid);
                if (!user.isAnonymous) {
                    resetSessionTimer();
                    ['click', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
                        document.addEventListener(evt, resetSessionTimer, { passive: true });
                    });
                }
            } else {
                currentUser = null;
                auth.signInAnonymously().then(() => {});
            }
        });
    } catch(e) {
        console.log('Ranking init error:', e);
    }
}

// Handle email magic link return
async function handleEmailSignIn() {
    let email = localStorage.getItem('btc_signin_email');
    if (!email) {
        email = prompt('Please enter your email to confirm sign-in:');
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

        loadUser(emailUid);
        showToast('✅ Signed in as ' + email);
    } catch(e) {
        console.log('Email sign-in error:', e);
        showToast('Sign-in error. Please try again.');
        auth.signInAnonymously();
    }
}

// Google Sign-In
async function signInWithGoogle() {
    await signInWithProvider(new firebase.auth.GoogleAuthProvider());
}

// Twitter/X Sign-In
async function signInWithTwitter() {
    await signInWithProvider(new firebase.auth.TwitterAuthProvider());
}

// GitHub Sign-In
async function signInWithGithub() {
    await signInWithProvider(new firebase.auth.GithubAuthProvider());
}

// Facebook Sign-In
async function signInWithFacebook() {
    await signInWithProvider(new firebase.auth.FacebookAuthProvider());
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
function resetSessionTimer() {
    if (sessionTimer) clearTimeout(sessionTimer);
    sessionTimer = setTimeout(function() {
        if (auth && auth.currentUser && !auth.currentUser.isAnonymous) {
            showToast('Session timed out. Please sign in again.');
            auth.signOut().then(() => location.reload());
        }
    }, SESSION_TIMEOUT);
}

// Generic provider sign-in (reused by Google, Twitter, GitHub)
async function signInWithProvider(provider) {
    if (!checkRateLimit()) return;
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

        hideUsernamePrompt();
        loadUser(user.uid);
        showToast('✅ Signed in as ' + (user.displayName || user.email || 'Bitcoiner'));
    } catch(e) {
        console.log('Provider sign-in error:', e);
        if (e.code !== 'auth/popup-closed-by-user') {
            showToast('Sign-in error. Please try again.');
        }
    }
}

// Send magic link email
async function sendMagicLink(email) {
    const actionCodeSettings = {
        url: window.location.origin + window.location.pathname,
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

async function loadUser(uid) {
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists) {
        currentUser = { uid, ...doc.data() };
        // Restore visited channels so we don't re-award
        if (currentUser.visitedChannelsList) {
            currentUser.visitedChannelsList.forEach(ch => allTimeChannels.add(ch));
        }
        // Sync read checkmarks from Firebase to local
        if (currentUser.readChannels) {
            let local = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]');
            let merged = [...new Set([...local, ...currentUser.readChannels])];
            localStorage.setItem('btc_visited_channels', JSON.stringify(merged));
            restoreVisitedUI();
        }
        // Sync favorites from Firebase to local
        if (currentUser.favorites) {
            let localFavs = JSON.parse(localStorage.getItem('btc_favs') || '[]');
            let mergedFavs = [...new Set([...localFavs, ...currentUser.favorites])];
            localStorage.setItem('btc_favs', JSON.stringify(mergedFavs));
            if (typeof renderFavs === 'function') renderFavs();
        }
        rankingReady = true;
        updateRankUI();
        awardVisitPoints();
        startReadTimer();

        // Update auth button text if signed in with a provider
        updateAuthButton();

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
            updateRankUI();
            updateAuthButton();
        }
    }
}

function updateAuthButton() {
    const btn = document.getElementById('authBtn');
    if (!btn) return;
    if (auth && auth.currentUser && !auth.currentUser.isAnonymous) {
        btn.textContent = '⚙️ My Account & Settings';
        btn.style.borderColor = '#22c55e';
        btn.style.color = '#22c55e';
        btn.onmouseover = function() { this.style.background='#22c55e'; this.style.color='#fff'; };
        btn.onmouseout = function() { this.style.background='none'; this.style.color='#22c55e'; };
    } else {
        btn.textContent = 'Create Account / Sign In';
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

async function createUser(username, email) {
    const uid = auth.currentUser.uid;
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
    await db.collection('users').doc(uid).set(userData);
    currentUser = { uid, ...userData };
    rankingReady = true;
    updateRankUI();
    awardPoints(POINTS.visit, 'Welcome bonus!');
    startReadTimer();
    hideUsernamePrompt();
}

async function awardVisitPoints() {
    if (!currentUser) return;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Only award once per day — no refresh exploits
    if (currentUser.lastVisit === today) return;

    let streakBonus = false;
    let pointsToAdd = POINTS.visit;
    let newStreak = 1;

    if (currentUser.lastVisit === yesterday) {
        newStreak = (currentUser.streak || 0) + 1;
        if (newStreak % 5 === 0) {
            pointsToAdd += POINTS.streak;
            streakBonus = true;
        }
    }

    await db.collection('users').doc(currentUser.uid).update({
        totalVisits: firebase.firestore.FieldValue.increment(1),
        lastVisit: today,
        streak: newStreak,
        points: firebase.firestore.FieldValue.increment(pointsToAdd)
    });

    currentUser.points = (currentUser.points || 0) + pointsToAdd;
    currentUser.lastVisit = today;
    currentUser.streak = newStreak;
    showToast('+' + POINTS.visit + ' pts — Daily visit!' + (streakBonus ? ' 🔥+' + POINTS.streak + ' streak bonus!' : ''));
    updateRankUI();
}

async function awardPoints(pts, reason) {
    if (!currentUser || !rankingReady) return;
    await db.collection('users').doc(currentUser.uid).update({
        points: firebase.firestore.FieldValue.increment(pts)
    });
    currentUser.points = (currentUser.points || 0) + pts;
    showToast('+' + pts + ' pts — ' + reason);
    updateRankUI();
}

// Called from go() when user opens a channel
async function onChannelOpen(channelId) {
    if (!currentUser || !rankingReady) return;

    // Only award points for channels NEVER visited before (persisted)
    if (!allTimeChannels.has(channelId)) {
        allTimeChannels.add(channelId);
        sessionChannels.add(channelId);
        await db.collection('users').doc(currentUser.uid).update({
            channelsVisited: firebase.firestore.FieldValue.increment(1),
            points: firebase.firestore.FieldValue.increment(POINTS.openChannel),
            visitedChannelsList: firebase.firestore.FieldValue.arrayUnion(channelId)
        });
        currentUser.points = (currentUser.points || 0) + POINTS.openChannel;
        currentUser.channelsVisited = (currentUser.channelsVisited || 0) + 1;
        showToast('+' + POINTS.openChannel + ' pts — Explored #' + channelId);
        updateRankUI();

        // Show leaderboard on first channel open
        if (typeof showLeaderboardAuto === 'function') showLeaderboardAuto();

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
    if (!currentUser || !db || !auth.currentUser) return;
    try {
        await db.collection('users').doc(auth.currentUser.uid).update({
            readChannels: firebase.firestore.FieldValue.arrayUnion(channelId)
        });
    } catch(e) {}
}

// Sync favorites to Firebase (called from index.html)
async function syncFavsToFirebase() {
    if (!currentUser || !db || !auth.currentUser) return;
    try {
        const favs = JSON.parse(localStorage.getItem('btc_favs') || '[]');
        await db.collection('users').doc(auth.currentUser.uid).update({
            favorites: favs
        });
    } catch(e) {}
}

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
document.addEventListener('touchstart', trackActivity);
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
        if (readSeconds - lastReadAward >= 30) {
            lastReadAward = readSeconds;
            hasScrolledSinceLastAward = false; // Reset — must scroll again for next award
            await db.collection('users').doc(currentUser.uid).update({
                points: firebase.firestore.FieldValue.increment(POINTS.readTime)
            });
            currentUser.points = (currentUser.points || 0) + POINTS.readTime;
            showToast('+' + POINTS.readTime + ' pts — Reading time 📖');
            updateRankUI();
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

function updateRankUI() {
    if (!currentUser) return;
    const lv = getLevel(currentUser.points || 0);
    const bar = document.getElementById('rankBar');
    if (!bar) return;

    // Detect level-up
    if (lastLevelName && lastLevelName !== lv.name) {
        showLevelUpCelebration(lv);
    }
    lastLevelName = lv.name;

    let progressHtml = '';
    if (lv.next) {
        const pct = Math.min(100, ((currentUser.points - lv.min) / (lv.next.min - lv.min)) * 100);
        progressHtml = '<div class="rank-progress"><div class="rank-progress-fill" style="width:' + pct + '%"></div></div>' +
            '<div class="rank-next">' + (lv.next.min - currentUser.points) + ' pts to ' + lv.next.emoji + ' ' + lv.next.name + '</div>';
    }

    const isAnon = auth.currentUser && auth.currentUser.isAnonymous;
    const signInLink = isAnon && currentUser.username ? '<div style="font-size:0.7rem;margin-top:4px;"><a href="#" onclick="event.stopPropagation();showSignInPrompt();return false;" style="color:var(--link);text-decoration:none;">🔗 Sign in to sync across devices</a></div>' : '';

    const streakHtml = (currentUser.streak || 0) > 0 ? '<span class="rank-streak" style="color:#f97316;font-size:0.7rem;font-weight:700;">🔥 ' + currentUser.streak + ' day streak</span>' : '';

    bar.innerHTML =
        '<div class="rank-info" onclick="toggleLeaderboard()">' +
            '<span class="rank-level">' + lv.emoji + ' ' + lv.name + '</span>' +
            '<span class="rank-user">' + (currentUser.username || 'Anon') + '</span>' +
            '<span class="rank-pts">' + (currentUser.points || 0).toLocaleString() + ' pts</span>' +
            streakHtml +
        '</div>' + progressHtml + signInLink;
    bar.style.display = 'flex';

    // Update user display on page
    updateUserDisplay(lv);
}

function updateUserDisplay(lv) {
    let el = document.getElementById('userDisplay');
    if (!el) {
        el = document.createElement('div');
        el.id = 'userDisplay';
        el.style.cssText = 'position:fixed;top:12px;right:20px;z-index:130;display:flex;align-items:center;gap:8px;padding:8px 14px;background:var(--bg-side);border:1px solid var(--border);border-radius:10px;font-size:0.8rem;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.2);transition:0.2s;';
        el.onclick = function() { toggleLeaderboard(); };
        document.body.appendChild(el);
    }
    const streakBit = (currentUser.streak || 0) > 0 ? '<span style="color:#f97316;font-weight:700;font-size:0.7rem;">🔥' + currentUser.streak + '</span>' : '';
    el.innerHTML = '<span style="font-size:1.1rem;">' + lv.emoji + '</span>' +
        '<span style="color:var(--text);font-weight:600;">' + (currentUser.username || 'Anon') + '</span>' +
        '<span style="color:var(--accent);font-weight:700;font-size:0.75rem;">' + (currentUser.points || 0).toLocaleString() + ' pts</span>' + streakBit;

    // Update mobile top bar user info
    const mobileInfo = document.getElementById('mobileUserInfo');
    if (mobileInfo) {
        const streak = (currentUser.streak || 0) > 0 ? ' 🔥' + currentUser.streak : '';
        mobileInfo.innerHTML = lv.emoji + ' ' + (currentUser.username || 'Anon') + streak;
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
    // Play triumphant sound
    if (typeof audioEnabled !== 'undefined' && !audioEnabled) {} else {
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

function expandLeaderboard() {
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
    if (typeof audioEnabled === 'undefined' || audioEnabled) {
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
        const snap = await db.collection('users').orderBy('points', 'desc').limit(100).get();
        let allUsers = [];
        snap.forEach(doc => {
            const d = doc.data();
            if (d.points > 0) allUsers.push({ id: doc.id, ...d });
        });

        let html = '<div class="lb-min-bar">🏆 Leaderboard — tap to expand</div>';
        html += '<div class="lb-header"><h3>🏆 Leaderboard</h3><div><button class="lb-close" onclick="hideLeaderboard()" title="Close">✕</button></div></div>';
        html += '<div class="lb-list">';

        const showInitial = Math.min(10, allUsers.length);
        allUsers.forEach((d, i) => {
            const rank = i + 1;
            const lv = getLevel(d.points || 0);
            const isMe = auth.currentUser && d.id === auth.currentUser.uid;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '#' + rank;
            const hidden = rank > 10 ? ' style="display:none;" class="lb-row lb-extra' + (isMe ? ' lb-me' : '') + '"' : ' class="lb-row' + (isMe ? ' lb-me' : '') + '"';
            html += '<div' + hidden + '>' +
                '<span class="lb-rank">' + medal + '</span>' +
                '<span class="lb-name">' + lv.emoji + ' ' + (d.username || 'Anon') + '</span>' +
                '<span class="lb-score">' + (d.points || 0).toLocaleString() + ' pts</span>' +
            '</div>';
        });

        if (allUsers.length > 10) {
            html += '<button id="lbShowMore" onclick="expandLeaderboard()" style="width:100%;padding:10px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:0.85rem;cursor:pointer;font-family:inherit;margin:8px 0;transition:0.2s;">Show all ' + allUsers.length + ' users ▼</button>';
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
function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'rank-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 2500);
}

// Username prompt
function showUsernamePrompt() {
    // If user is already signed in (non-anonymous), show account info instead
    if (auth && auth.currentUser && !auth.currentUser.isAnonymous) {
        showAccountInfo();
        return;
    }
    document.getElementById('usernameModal').classList.add('open');
}

function showAccountInfo() {
    showSettingsPage('account');
}

let settingsTab = 'account';

function showSettingsPage(tab) {
    settingsTab = tab || 'account';
    const modal = document.getElementById('usernameModal');
    const box = modal.querySelector('.username-box');
    const user = auth.currentUser;
    const lvl = getLevel(currentUser ? currentUser.points || 0 : 0);

    // X close button
    let html = '<button onclick="hideUsernamePrompt()" style="position:absolute;top:12px;right:12px;background:none;border:1px solid var(--border);color:var(--text-muted);width:32px;height:32px;border-radius:8px;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;transition:0.2s;" onmouseover="this.style.borderColor=\'var(--accent)\';this.style.color=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.color=\'var(--text-muted)\'">✕</button>';

    // Tab bar
    html += '<div style="display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid var(--border);margin-top:8px;">';
    ['account', 'prefs', 'security', 'data'].forEach(t => {
        const icons = { account: '👤', prefs: '🎨', security: '🔒', data: '📊' };
        const names = { account: 'Account', prefs: 'Prefs', security: 'Security', data: 'Data' };
        const active = settingsTab === t;
        html += '<button onclick="showSettingsPage(\'' + t + '\')" style="flex:1;padding:8px 4px;border:none;background:' + (active ? 'var(--accent-bg)' : 'none') + ';color:' + (active ? 'var(--accent)' : 'var(--text-muted)') + ';font-size:0.8rem;font-weight:' + (active ? '700' : '500') + ';cursor:pointer;font-family:inherit;border-bottom:' + (active ? '2px solid var(--accent)' : '2px solid transparent') + ';margin-bottom:-2px;display:flex;flex-direction:column;align-items:center;gap:2px;"><span style="font-size:1.1rem;">' + icons[t] + '</span>' + names[t] + '</button>';
    });
    html += '</div>';

    if (settingsTab === 'account') {
        html += '<div style="text-align:center;margin-bottom:20px;">' +
            '<div style="font-size:2.5rem;margin-bottom:8px;">' + lvl.emoji + '</div>' +
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

        // Change username
        const currentName = currentUser ? currentUser.username || '' : '';
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">✏️ Change Username</div>' +
            '<div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:10px;">Current username: <span style="color:var(--accent);font-weight:700;">' + currentName + '</span></div>' +
            '<input type="text" id="newUsername" value="" placeholder="Type your new username here..." maxlength="20" style="width:100%;padding:12px 14px;background:var(--input-bg);border:2px solid var(--border);border-radius:10px;color:var(--text);font-size:1rem;font-family:inherit;outline:none;margin-bottom:10px;box-sizing:border-box;" onfocus="this.style.borderColor=\'var(--accent)\'" onblur="this.style.borderColor=\'var(--border)\'">' +
            '<button onclick="changeUsername()" style="width:100%;padding:12px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;">Save New Username</button>' +
            '<div id="usernameStatus" style="margin-top:8px;font-size:0.85rem;"></div></div>';

        html += '<button onclick="signOutUser()" style="width:100%;padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:#ef4444;font-size:0.9rem;cursor:pointer;font-family:inherit;font-weight:600;">Sign Out</button>';

    } else if (settingsTab === 'prefs') {
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

        // Font Size
        const savedSize = localStorage.getItem('btc_font_size') || 'medium';
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🔤 Font Size</div>' +
            '<div style="display:flex;gap:8px;">';
        ['small', 'medium', 'large'].forEach(size => {
            const active = savedSize === size;
            const label = size.charAt(0).toUpperCase() + size.slice(1);
            const px = size === 'small' ? '14px' : size === 'medium' ? '16px' : '18px';
            html += '<button onclick="setFontSize(\'' + size + '\')" style="flex:1;padding:10px;border:' + (active ? '2px solid var(--accent)' : '1px solid var(--border)') + ';border-radius:8px;background:' + (active ? 'var(--accent-bg)' : 'var(--bg-side)') + ';color:' + (active ? 'var(--accent)' : 'var(--text)') + ';font-size:' + px + ';font-weight:' + (active ? '700' : '400') + ';cursor:pointer;font-family:inherit;">' + label + '</button>';
        });
        html += '</div></div>';

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

        // Theme
        const isDark = document.body.getAttribute('data-theme') !== 'light';
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🌓 Theme</div>' +
            '<div style="display:flex;gap:8px;">' +
            '<button onclick="if(document.body.getAttribute(\'data-theme\')===\'light\')toggleTheme();showSettingsPage(\'prefs\')" style="flex:1;padding:10px;border:' + (isDark ? '2px solid var(--accent)' : '1px solid var(--border)') + ';border-radius:8px;background:' + (isDark ? 'var(--accent-bg)' : 'var(--bg-side)') + ';color:' + (isDark ? 'var(--accent)' : 'var(--text)') + ';font-size:0.85rem;font-weight:' + (isDark ? '700' : '400') + ';cursor:pointer;font-family:inherit;">🌙 Dark</button>' +
            '<button onclick="if(document.body.getAttribute(\'data-theme\')!==\'light\')toggleTheme();showSettingsPage(\'prefs\')" style="flex:1;padding:10px;border:' + (!isDark ? '2px solid var(--accent)' : '1px solid var(--border)') + ';border-radius:8px;background:' + (!isDark ? 'var(--accent-bg)' : 'var(--bg-side)') + ';color:' + (!isDark ? 'var(--accent)' : 'var(--text)') + ';font-size:0.85rem;font-weight:' + (!isDark ? '700' : '400') + ';cursor:pointer;font-family:inherit;">☀️ Light</button>' +
            '</div></div>';

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
                '<input type="tel" id="mfaPhone" placeholder="+1 555 123 4567" style="width:100%;padding:10px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.9rem;font-family:inherit;outline:none;margin-bottom:8px;">' +
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

    } else if (settingsTab === 'data') {
        // Refresh data from Firebase if available
        if (auth.currentUser && typeof db !== 'undefined') {
            db.collection('users').doc(auth.currentUser.uid).get().then(function(doc) {
                if (doc.exists && currentUser) {
                    const fresh = doc.data();
                    currentUser.points = fresh.points || 0;
                    currentUser.streak = fresh.streak || 0;
                    currentUser.totalVisits = fresh.totalVisits || 0;
                    currentUser.channelsVisited = fresh.channelsVisited || 0;
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
        html += statRow('Current Streak', streak + ' days', '🔥');
        html += statRow('Total Site Visits', totalVisits, '👁️');
        html += statRow('Channels Explored', Math.max(chVisited, localVisited) + ' / ' + Object.keys(CHANNELS).length, '🗺️');
        html += statRow('Saved Favorites', localFavs, '⭐');
        html += statRow('Hidden Badges Found', hiddenBadges + ' / 5', '🏅');
        html += statRow('Scholar Certified', localStorage.getItem('btc_scholar_passed') === 'true' ? '✅ Yes' : '❌ Not yet', '🎓');

        html += '</div>';

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

// Font size
function setFontSize(size) {
    localStorage.setItem('btc_font_size', size);
    const px = size === 'small' ? '14px' : size === 'medium' ? '16px' : '18px';
    document.documentElement.style.fontSize = px;
    showSettingsPage('prefs');
}

// Restore font size on load
(function() {
    const saved = localStorage.getItem('btc_font_size');
    if (saved) {
        const px = saved === 'small' ? '14px' : saved === 'medium' ? '16px' : '18px';
        document.documentElement.style.fontSize = px;
    }
})();

// Change username
async function changeUsername() {
    const input = document.getElementById('newUsername');
    const status = document.getElementById('usernameStatus');
    const name = input.value.trim();
    if (name.length < 2 || name.length > 20) {
        status.innerHTML = '<span style="color:#ef4444;">Username must be 2-20 characters</span>';
        return;
    }
    // Sanitize — strip HTML
    const clean = name.replace(/<[^>]*>/g, '').replace(/[<>"'&]/g, '');
    if (containsProfanity(clean)) {
        status.innerHTML = '<span style="color:#ef4444;">⚠️ That username is not allowed. Please choose another.</span>';
        return;
    }
    try {
        await db.collection('users').doc(auth.currentUser.uid).update({ username: clean });
        currentUser.username = clean;
        updateRankUI();
        status.innerHTML = '<span style="color:#22c55e;">✅ Username updated!</span>';
    } catch(e) {
        status.innerHTML = '<span style="color:#ef4444;">Error updating username</span>';
    }
}

// Password reset
async function sendPasswordReset() {
    const status = document.getElementById('pwResetStatus');
    try {
        await auth.sendPasswordResetEmail(auth.currentUser.email);
        status.innerHTML = '<span style="color:#22c55e;">✅ Reset email sent!</span>';
    } catch(e) {
        status.innerHTML = '<span style="color:#ef4444;">Error: ' + e.message + '</span>';
    }
}

// 2FA enrollment
let mfaVerificationId = null;
let mfaResolver = null;

async function startMFAEnroll() {
    const phone = document.getElementById('mfaPhone').value.trim();
    const status = document.getElementById('mfaStatus');
    if (!phone || phone.length < 10) {
        status.innerHTML = '<span style="color:#ef4444;">Please enter a valid phone number with country code (e.g. +1555123456)</span>';
        return;
    }
    const user = auth.currentUser;

    // Check email verification - required for MFA
    if (!user.emailVerified) {
        status.innerHTML = '<span style="color:#ef4444;">⚠️ You must verify your email before enabling 2FA.<br>Check your inbox for a verification email, or </span><a onclick="sendEmailVerification()" style="color:var(--accent);cursor:pointer;text-decoration:underline;">resend it</a>';
        return;
    }

    status.innerHTML = '<span style="color:var(--text-muted);">Sending code...</span>';
    try {
        // Reset recaptcha each time
        if (window.recaptchaVerifier) {
            window.recaptchaVerifier.clear();
            window.recaptchaVerifier = null;
        }
        window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
            size: 'invisible',
            callback: function() { console.log('reCAPTCHA solved'); }
        });

        const session = await user.multiFactor.getSession();
        const phoneOpts = { phoneNumber: phone, session: session };
        const phoneProvider = new firebase.auth.PhoneAuthProvider();
        mfaVerificationId = await phoneProvider.verifyPhoneNumber(phoneOpts, window.recaptchaVerifier);
        document.getElementById('mfaVerify').style.display = 'block';
        status.innerHTML = '<span style="color:#22c55e;">✅ Code sent! Check your phone.</span>';
    } catch(e) {
        console.log('MFA enroll error:', e);
        if (window.recaptchaVerifier) { window.recaptchaVerifier.clear(); window.recaptchaVerifier = null; }
        let msg = e.message || 'Error sending code.';
        if (e.code === 'auth/requires-recent-login') msg = 'Please sign out and sign back in, then try again.';
        if (e.code === 'auth/invalid-phone-number') msg = 'Invalid phone number. Use format: +1234567890';
        if (e.code === 'auth/unverified-email') msg = 'Please verify your email first before enabling 2FA.';
        status.innerHTML = '<span style="color:#ef4444;">' + msg + '</span>';
    }
}

async function sendEmailVerification() {
    try {
        await auth.currentUser.sendEmailVerification();
        showToast('📧 Verification email sent! Check your inbox.');
    } catch(e) {
        showToast('Error sending verification email. Try again later.');
    }
}

async function verifyMFACode() {
    const code = document.getElementById('mfaCode').value.trim();
    const status = document.getElementById('mfaStatus');
    if (!code || code.length !== 6) {
        status.innerHTML = '<span style="color:#ef4444;">Please enter the 6-digit code</span>';
        return;
    }
    try {
        const cred = firebase.auth.PhoneAuthProvider.credential(mfaVerificationId, code);
        const assertion = firebase.auth.PhoneMultiFactorGenerator.assertion(cred);
        await auth.currentUser.multiFactor.enroll(assertion, 'Phone');
        showToast('✅ 2FA enabled!');
        showSettingsPage('security');
    } catch(e) {
        status.innerHTML = '<span style="color:#ef4444;">Invalid code. Please try again.</span>';
    }
}

async function disable2FA() {
    if (!confirm('Are you sure you want to disable two-factor authentication?')) return;
    try {
        const factors = auth.currentUser.multiFactor.enrolledFactors;
        if (factors.length > 0) {
            await auth.currentUser.multiFactor.unenroll(factors[0]);
            showToast('2FA disabled');
            showSettingsPage('security');
        }
    } catch(e) {
        showToast('Error disabling 2FA');
    }
}

// TOTP Authenticator App functions
async function loadTotpStatus() {
    const section = document.getElementById('totpSection');
    if (!section) return;
    
    try {
        const totpStatus = firebase.functions().httpsCallable('totpStatus');
        const result = await totpStatus();
        
        if (result.data.enabled) {
            section.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">' +
                '<span style="color:#22c55e;font-size:1.2rem;">✅</span>' +
                '<div><div style="color:var(--heading);font-weight:600;font-size:0.9rem;">Authenticator app enabled</div>' +
                '<div style="color:var(--text-muted);font-size:0.8rem;">Google Authenticator, Authy, etc.</div></div></div>' +
                '<div style="display:flex;gap:8px;"><input type="text" id="totpDisableCode" placeholder="Enter code to disable" maxlength="6" style="flex:1;padding:10px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.9rem;font-family:inherit;outline:none;text-align:center;">' +
                '<button onclick="disableTotp()" style="padding:10px 16px;background:none;border:1px solid #ef4444;border-radius:8px;color:#ef4444;font-size:0.85rem;cursor:pointer;font-family:inherit;white-space:nowrap;">Disable</button></div>' +
                '<div id="totpStatus" style="margin-top:6px;font-size:0.8rem;"></div>';
        } else {
            section.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">' +
                '<span style="color:var(--text-faint);font-size:1.2rem;">📱</span>' +
                '<div><div style="color:var(--heading);font-weight:600;font-size:0.9rem;">Not configured</div>' +
                '<div style="color:var(--text-muted);font-size:0.8rem;">Use Google Authenticator, Authy, or any TOTP app</div></div></div>' +
                '<button onclick="startTotpSetup()" style="width:100%;padding:10px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit;">Set Up Authenticator App</button>' +
                '<div id="totpSetupArea" style="display:none;margin-top:12px;"></div>' +
                '<div id="totpStatus" style="margin-top:6px;font-size:0.8rem;"></div>';
        }
    } catch(e) {
        console.log('TOTP status error:', e);
        section.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">' +
            '<span style="color:var(--text-faint);font-size:1.2rem;">📱</span>' +
            '<div><div style="color:var(--heading);font-weight:600;font-size:0.9rem;">Not configured</div>' +
            '<div style="color:var(--text-muted);font-size:0.8rem;">Use Google Authenticator, Authy, or any TOTP app</div></div></div>' +
            '<button onclick="startTotpSetup()" style="width:100%;padding:10px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit;">Set Up Authenticator App</button>' +
            '<div id="totpSetupArea" style="display:none;margin-top:12px;"></div>' +
            '<div id="totpStatus" style="margin-top:6px;font-size:0.8rem;"></div>';
    }
}

async function startTotpSetup() {
    const area = document.getElementById('totpSetupArea');
    const status = document.getElementById('totpStatus');
    if (!area) return;
    
    status.innerHTML = '<span style="color:var(--text-muted);">Generating QR code...</span>';
    area.style.display = 'block';
    
    try {
        const totpSetup = firebase.functions().httpsCallable('totpSetup');
        const result = await totpSetup();
        
        area.innerHTML = '<div style="text-align:center;margin-bottom:12px;">' +
            '<div style="color:var(--text);font-size:0.85rem;margin-bottom:8px;">Scan this QR code with your authenticator app:</div>' +
            '<img src="' + result.data.qr + '" style="width:200px;height:200px;border-radius:8px;background:#fff;padding:8px;margin:0 auto;display:block;">' +
            '<div style="margin-top:8px;color:var(--text-faint);font-size:0.75rem;">Or enter this key manually:</div>' +
            '<div style="color:var(--accent);font-family:monospace;font-size:0.85rem;letter-spacing:2px;margin-top:4px;word-break:break-all;cursor:pointer;" onclick="navigator.clipboard.writeText(\'' + result.data.secret + '\');showToast(\'📋 Copied!\')">' + result.data.secret + ' 📋</div>' +
            '</div>' +
            '<input type="text" id="totpVerifyCode" placeholder="Enter 6-digit code from app" maxlength="6" style="width:100%;padding:10px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.9rem;font-family:inherit;outline:none;text-align:center;margin-bottom:8px;">' +
            '<button onclick="verifyTotpSetup()" style="width:100%;padding:10px;background:#22c55e;color:#fff;border:none;border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit;">Verify & Enable</button>';
        status.innerHTML = '';
    } catch(e) {
        status.innerHTML = '<span style="color:#ef4444;">' + (e.message || 'Error generating QR code') + '</span>';
    }
}

async function verifyTotpSetup() {
    const code = document.getElementById('totpVerifyCode').value.trim();
    const status = document.getElementById('totpStatus');
    
    if (!code || code.length !== 6) {
        status.innerHTML = '<span style="color:#ef4444;">Enter the 6-digit code from your app</span>';
        return;
    }
    
    status.innerHTML = '<span style="color:var(--text-muted);">Verifying...</span>';
    
    try {
        const totpVerify = firebase.functions().httpsCallable('totpVerify');
        await totpVerify({ code: code });
        showToast('✅ Authenticator app enabled!');
        showSettingsPage('security');
    } catch(e) {
        status.innerHTML = '<span style="color:#ef4444;">' + (e.message || 'Invalid code. Try again.') + '</span>';
    }
}

async function disableTotp() {
    const code = document.getElementById('totpDisableCode').value.trim();
    const status = document.getElementById('totpStatus');
    
    if (!code || code.length !== 6) {
        status.innerHTML = '<span style="color:#ef4444;">Enter your current authenticator code to disable</span>';
        return;
    }
    
    try {
        const totpDisable = firebase.functions().httpsCallable('totpDisable');
        await totpDisable({ code: code });
        showToast('Authenticator app disabled');
        showSettingsPage('security');
    } catch(e) {
        status.innerHTML = '<span style="color:#ef4444;">' + (e.message || 'Invalid code') + '</span>';
    }
}

// Export user data
function exportUserData() {
    if (!currentUser) return;
    const data = JSON.stringify(currentUser, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bitcoin-education-archive-data.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('📥 Data exported!');
}

// Delete account
function confirmDeleteAccount() {
    const modal = document.getElementById('usernameModal');
    const box = modal.querySelector('.username-box');
    box.innerHTML = '<h2 style="color:#ef4444;">⚠️ Delete Account</h2>' +
        '<p style="color:var(--text-muted);margin-bottom:16px;">This will permanently delete your account, points, badges, and all progress. This cannot be undone.</p>' +
        '<p style="color:var(--text);margin-bottom:20px;">Type <strong>DELETE</strong> to confirm:</p>' +
        '<input type="text" id="deleteConfirm" placeholder="Type DELETE" style="width:100%;padding:12px;background:var(--input-bg);border:1px solid #ef4444;border-radius:8px;color:var(--text);font-size:1rem;font-family:inherit;outline:none;text-align:center;margin-bottom:12px;">' +
        '<button onclick="executeDeleteAccount()" style="width:100%;padding:12px;background:#ef4444;color:#fff;border:none;border-radius:8px;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;">Permanently Delete My Account</button>' +
        '<span class="skip" onclick="showSettingsPage(\'data\')" style="color:var(--text-faint);font-size:0.85rem;margin-top:12px;cursor:pointer;display:block;text-align:center;">Cancel</span>';
}

async function executeDeleteAccount() {
    const confirm = document.getElementById('deleteConfirm').value.trim();
    if (confirm !== 'DELETE') {
        showToast('Please type DELETE to confirm');
        return;
    }
    try {
        const uid = auth.currentUser.uid;
        await db.collection('users').doc(uid).delete();
        await auth.currentUser.delete();
        hideUsernamePrompt();
        localStorage.clear();
        location.reload();
    } catch(e) {
        showToast('Error deleting account. You may need to sign in again first.');
    }
}

function signOutUser() {
    auth.signOut().then(() => {
        hideUsernamePrompt();
        location.reload();
    });
}

function hideUsernamePrompt() {
    document.getElementById('usernameModal').classList.remove('open');
}

function submitUsername() {
    const input = document.getElementById('usernameInput');
    const emailInput = document.getElementById('emailInput');
    const name = input.value.trim();
    const email = emailInput ? emailInput.value.trim() : '';
    if (name.length < 2 || name.length > 20) {
        input.style.borderColor = '#ef4444';
        return;
    }
    if (containsProfanity(name)) {
        input.style.borderColor = '#ef4444';
        showToast('⚠️ That username is not allowed. Please choose another.');
        return;
    }
    createUser(name, email);

    // If they entered an email, link their account
    if (email) {
        sendMagicLink(email).then(sent => {
            if (sent) showToast('📧 Check your email to link your account across devices!');
        });
    }
}

// Show sign-in modal for returning users on new device
function showSignInPrompt() {
    // If already signed in with a provider, show account info
    if (auth && auth.currentUser && !auth.currentUser.isAnonymous) {
        showAccountInfo();
        return;
    }
    const modal = document.getElementById('usernameModal');
    const box = modal.querySelector('.username-box');
    box.innerHTML = '<h2>👋 Welcome Back!</h2>' +
        '<p style="color:var(--text-muted);margin-bottom:24px;">Sign in with your email to restore your progress, points, and badges.</p>' +
        '<input type="email" id="signinEmail" placeholder="📧 Enter your email" style="width:100%;padding:14px 18px;background:var(--input-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:1rem;font-family:inherit;outline:none;margin-bottom:16px;text-align:center;" onkeydown="if(event.key===\'Enter\')sendSignInLink()">' +
        '<button onclick="sendSignInLink()" style="width:100%;padding:14px 30px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;">Send Magic Link →</button>' +
        '<div id="signinStatus" style="margin-top:12px;font-size:0.85rem;"></div>' +
        '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:6px;">' +
        '<button onclick="signInWithGoogle()" style="width:100%;padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;"><img src=https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg width=18 height=18> Google</button>' +
        '<button onclick="signInWithTwitter()" style="width:100%;padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;">𝕏 Twitter/X</button>' +
        '<button onclick="signInWithGithub()" style="width:100%;padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;"><img src=https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/github.svg width=18 height=18> GitHub</button>' +
        '<button onclick="signInWithFacebook()" style="width:100%;padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;"><img src=https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/facebook.svg width=18 height=18> Facebook</button>' +
        '</div>' +
        '<span class="skip" onclick="hideUsernamePrompt()" style="color:var(--text-faint);font-size:0.85rem;margin-top:12px;cursor:pointer;display:block;">Continue as guest</span>';
    modal.classList.add('open');
}

async function sendSignInLink() {
    const email = document.getElementById('signinEmail').value.trim();
    const status = document.getElementById('signinStatus');
    if (!email) { status.innerHTML = '<span style="color:#ef4444;">Please enter your email</span>'; return; }

    status.innerHTML = '<span style="color:var(--text-muted);">Sending...</span>';
    const sent = await sendMagicLink(email);
    if (sent) {
        status.innerHTML = '<span style="color:#22c55e;">✅ Magic link sent! Check your email and click the link to sign in.</span>';
    } else {
        status.innerHTML = '<span style="color:#ef4444;">Error sending link. Please try again.</span>';
    }
}

// Init on load
if (typeof firebase !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initRanking);
} else {
    window.addEventListener('load', initRanking);
}
