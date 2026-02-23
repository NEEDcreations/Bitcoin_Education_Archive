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

// Initialize Firebase
function initRanking() {
    try {
        firebase.initializeApp(FIREBASE_CONFIG);
        db = firebase.firestore();
        auth = firebase.auth();

        auth.signInAnonymously().then(() => {
            auth.onAuthStateChanged(user => {
                if (user) {
                    loadUser(user.uid);
                }
            });
        });
    } catch(e) {
        console.log('Ranking init error:', e);
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
    } else {
        // New user - show username prompt after 60 seconds
        setTimeout(showUsernamePrompt, 60000);
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

    let progressHtml = '';
    if (lv.next) {
        const pct = Math.min(100, ((currentUser.points - lv.min) / (lv.next.min - lv.min)) * 100);
        progressHtml = '<div class="rank-progress"><div class="rank-progress-fill" style="width:' + pct + '%"></div></div>' +
            '<div class="rank-next">' + (lv.next.min - currentUser.points) + ' pts to ' + lv.next.emoji + ' ' + lv.next.name + '</div>';
    }

    bar.innerHTML =
        '<div class="rank-info" onclick="toggleLeaderboard()">' +
            '<span class="rank-level">' + lv.emoji + ' ' + lv.name + '</span>' +
            '<span class="rank-user">' + (currentUser.username || 'Anon') + '</span>' +
            '<span class="rank-pts">' + (currentUser.points || 0).toLocaleString() + ' pts</span>' +
        '</div>' + progressHtml;
    bar.style.display = 'flex';
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

function minimizeLeaderboard() {
    const lb = document.getElementById('leaderboard');
    lb.classList.add('minimized');
    lb.onclick = function() {
        lb.classList.remove('minimized');
        lb.onclick = null;
    };
}

function hideLeaderboard() {
    const lb = document.getElementById('leaderboard');
    lb.classList.remove('open');
    lb.classList.remove('minimized');
}

async function toggleLeaderboard() {
    const lb = document.getElementById('leaderboard');
    if (lb.classList.contains('open') && !lb.classList.contains('minimized')) {
        lb.classList.remove('open');
        lb.classList.remove('minimized');
        return;
    }

    lb.classList.remove('minimized');
    lb.innerHTML = '<div style="padding:20px;text-align:center;color:#475569;">Loading leaderboard...</div>';
    lb.classList.add('open');

    try {
        const snap = await db.collection('users').orderBy('points', 'desc').limit(20).get();
        let html = '<div class="lb-min-bar">🏆 Leaderboard — tap to expand</div>';
        html += '<div class="lb-header"><h3>🏆 Leaderboard</h3><div><button class="lb-close" onclick="minimizeLeaderboard()" title="Minimize" style="margin-right:8px;">−</button><button class="lb-close" onclick="hideLeaderboard()" title="Close">✕</button></div></div>';
        html += '<div class="lb-list">';
        let rank = 0;
        snap.forEach(doc => {
            rank++;
            const d = doc.data();
            const lv = getLevel(d.points || 0);
            const isMe = auth.currentUser && doc.id === auth.currentUser.uid;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '#' + rank;
            html += '<div class="lb-row' + (isMe ? ' lb-me' : '') + '">' +
                '<span class="lb-rank">' + medal + '</span>' +
                '<span class="lb-name">' + lv.emoji + ' ' + (d.username || 'Anon') + '</span>' +
                '<span class="lb-score">' + (d.points || 0).toLocaleString() + ' pts</span>' +
            '</div>';
        });
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
    document.getElementById('usernameModal').classList.add('open');
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
}

// Init on load
if (typeof firebase !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initRanking);
} else {
    window.addEventListener('load', initRanking);
}
