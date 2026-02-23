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

        auth.onAuthStateChanged(user => {
            if (user) {
                loadUser(user.uid);
            } else {
                // No user — sign in anonymously
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

// Generic provider sign-in (reused by Google, Twitter, GitHub)
async function signInWithProvider(provider) {
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
        // New user - they can click "Create Account / Sign In" on home page
    }
}

function updateAuthButton() {
    const btn = document.getElementById('authBtn');
    if (!btn) return;
    if (auth && auth.currentUser && !auth.currentUser.isAnonymous) {
        btn.textContent = '👤 My Account';
    } else {
        btn.textContent = 'Create Account / Sign In';
    }
}

async function createUser(username, email) {
    const uid = auth.currentUser.uid;
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

    bar.innerHTML =
        '<div class="rank-info" onclick="toggleLeaderboard()">' +
            '<span class="rank-level">' + lv.emoji + ' ' + lv.name + '</span>' +
            '<span class="rank-user">' + (currentUser.username || 'Anon') + '</span>' +
            '<span class="rank-pts">' + (currentUser.points || 0).toLocaleString() + ' pts</span>' +
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
    el.innerHTML = '<span style="font-size:1.1rem;">' + lv.emoji + '</span>' +
        '<span style="color:var(--text);font-weight:600;">' + (currentUser.username || 'Anon') + '</span>' +
        '<span style="color:var(--accent);font-weight:700;font-size:0.75rem;">' + (currentUser.points || 0).toLocaleString() + ' pts</span>';
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
    const modal = document.getElementById('usernameModal');
    const box = modal.querySelector('.username-box');
    const user = auth.currentUser;
    const lvl = getLevel(currentUser ? currentUser.points || 0 : 0);
    box.innerHTML = '<h2>✅ You\'re Signed In</h2>' +
        '<div style="margin:20px 0;padding:16px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;">' +
            '<div style="font-size:2rem;margin-bottom:8px;">' + lvl.emoji + '</div>' +
            '<div style="color:var(--heading);font-weight:700;font-size:1.1rem;">' + (currentUser ? currentUser.username || 'Bitcoiner' : 'Bitcoiner') + '</div>' +
            '<div style="color:var(--text-muted);font-size:0.85rem;margin-top:4px;">' + lvl.name + ' · ' + (currentUser ? currentUser.points || 0 : 0).toLocaleString() + ' pts</div>' +
            (user.email ? '<div style="color:var(--text-dim);font-size:0.8rem;margin-top:8px;">📧 ' + user.email + '</div>' : '') +
            (user.displayName ? '<div style="color:var(--text-dim);font-size:0.8rem;margin-top:4px;">👤 ' + user.displayName + '</div>' : '') +
        '</div>' +
        '<button onclick="signOutUser()" style="width:100%;padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;cursor:pointer;font-family:inherit;font-weight:600;">Sign Out</button>' +
        '<span class="skip" onclick="hideUsernamePrompt()" style="color:var(--text-faint);font-size:0.85rem;margin-top:12px;cursor:pointer;display:block;">Close</span>';
    modal.classList.add('open');
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
