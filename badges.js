// © 2024-2026 603BTC LLC. All rights reserved.
// This code is proprietary. See LICENSE file. Do not copy or redistribute.
// =============================================
// Bitcoin Education Archive - Achievement Badges
// =============================================

const BADGE_DEFS = [
    { id: 'first_channel', name: 'First Steps', emoji: '👶', desc: 'Opened your first channel', check: v => v.length >= 1, pts: 10 },
    { id: 'explorer_10', name: 'Explorer', emoji: '🧭', desc: 'Visited 10 channels', check: v => v.length >= 10 },
    { id: 'explorer_25', name: 'Trailblazer', emoji: '🗺️', desc: 'Visited 25 channels', check: v => v.length >= 25 },
    { id: 'explorer_50', name: 'Pathfinder', emoji: '🏔️', desc: 'Visited 50 channels', check: v => v.length >= 50 },
    { id: 'explorer_100', name: 'Cartographer', emoji: '🌍', desc: 'Visited 100 channels', check: v => v.length >= 100 },
    { id: 'explorer_all', name: 'Completionist', emoji: '🏆', desc: 'Visited every single channel', check: (v, total) => v.length >= total },
    { id: 'foundation_builder', name: 'Foundation Builder', emoji: '🧱', desc: 'Read all Layer 1 Properties (Orange)', check: v => {
        const orange = ['whitepaper','decentralized','scarce','secure','money','peaceful','dominant','organic','supranational','programmable','use-cases'];
        return orange.every(p => v.includes(p));
    }},
    { id: 'experienced_pro', name: 'Deep Diver', emoji: '🤿', desc: 'Read all Experienced Topics (Purple)', check: v => {
        const purple = ['maximalism','problems-of-money','self-custody','privacy-nonkyc','nodes','mining','pow-vs-pos','energy','difficulty-adjustment','layer-2-lightning','fedi-ark','chaumian-mints','ctv-covenants','extension-blocks','op-codes','bitvm','layer-3-sidechains','stablecoins','smart-contracts','blockchain-timechain','regulation','cryptography','core-source-code','developers','investment-strategy','evidence-against-alts','consensus'];
        return purple.every(p => v.includes(p));
    }},
    { id: 'librarian', name: 'The Librarian', emoji: '🏛️', desc: 'Read all Resource channels (Blue)', check: v => {
        const blue = ['one-stop-shop','faq-glossary','nostr','misconceptions-fud','books','videos','podcasts','articles-threads','informational-sites','curriculum','research-theses','games','music','movies-tv','hardware','poems-stories','apps-tools','projects-diy','art-inspiration','graphics','charts','swag-merch','jobs-earn','social-media','fun-facts','news-adoption','history','international','satoshi-nakamoto','giga-chad','health','web5','memes-funny'];
        return blue.every(p => v.includes(p));
    }},
    { id: 'quest_1', name: 'Quester', emoji: '⚔️', desc: 'Completed your first Quest', check: (v, t, q) => q >= 1, pts: 10 },
    { id: 'quest_3', name: 'Quest Master', emoji: '🛡️', desc: 'Completed 3 Quests', check: (v, t, q) => q >= 3 },
    { id: 'quest_5', name: 'Quest Legend', emoji: '👑', desc: 'Completed 5 Quests', check: (v, t, q) => q >= 5 },
    { id: 'bookworm', name: 'Bookworm', emoji: '📖', desc: 'Saved 5 channels to favorites', check: () => {
        return (JSON.parse(localStorage.getItem('btc_favs') || '[]')).length >= 5;
    }},
    { id: 'night_owl', name: 'Night Owl', emoji: '🦉', desc: 'Browsing between midnight and 5am', check: () => {
        const h = new Date().getHours();
        return h >= 0 && h < 5;
    }},
    { id: 'early_bird', name: 'Early Bird', emoji: '🐦', desc: 'Browsing between 5am and 7am', check: () => {
        const h = new Date().getHours();
        return h >= 5 && h < 7;
    }},
    { id: 'cert_scholar', name: 'Bitcoin Scholar', emoji: '🎓', desc: 'Passed the Bitcoin Scholar Certification', check: () => localStorage.getItem('btc_scholar_prop_passed') === 'true', pts: 50 },
    { id: 'cert_tech', name: 'Protocol Expert', emoji: '🛠️', desc: 'Passed the Technical Protocol Expert Certification', check: () => localStorage.getItem('btc_scholar_tech_passed') === 'true', pts: 100 },
    { id: 'nacho_chatterbox', name: 'Nacho Chatterbox', emoji: '🦌', desc: 'Interacted with Nacho 50+ times', check: () => parseInt(localStorage.getItem('btc_nacho_interactions') || '0') >= 50, pts: 30 },
    { id: 'nacho_bestie', name: 'Nacho\'s Bestie', emoji: '🧡', desc: 'Interacted with Nacho 250+ times', check: () => parseInt(localStorage.getItem('btc_nacho_interactions') || '0') >= 250, pts: 100 },

    // ---- Global Chat Badges ----
    { id: 'chat_first', name: 'First Words', emoji: '💬', desc: 'Sent your first message in Global Chat', check: () => parseInt(localStorage.getItem('btc_chat_msgs') || '0') >= 1, pts: 10 },
    { id: 'chat_10', name: 'Chatty', emoji: '🗣️', desc: 'Sent 10 messages in Global Chat', check: () => parseInt(localStorage.getItem('btc_chat_msgs') || '0') >= 10, pts: 15 },
    { id: 'chat_50', name: 'Conversationalist', emoji: '🎤', desc: 'Sent 50 messages in Global Chat', check: () => parseInt(localStorage.getItem('btc_chat_msgs') || '0') >= 50, pts: 25 },
    { id: 'chat_100', name: 'Town Crier', emoji: '📢', desc: 'Sent 100 messages in Global Chat', check: () => parseInt(localStorage.getItem('btc_chat_msgs') || '0') >= 100, pts: 50 },
    { id: 'chat_500', name: 'Chat Legend', emoji: '👑', desc: 'Sent 500 messages in Global Chat', check: () => parseInt(localStorage.getItem('btc_chat_msgs') || '0') >= 500, pts: 100 },
    { id: 'chat_streak_3', name: 'Regular', emoji: '📅', desc: 'Chatted 3 days in a row', check: () => parseInt(localStorage.getItem('btc_chat_streak') || '0') >= 3, pts: 20 },
    { id: 'chat_streak_7', name: 'Devoted Chatter', emoji: '🔥', desc: 'Chatted 7 days in a row', check: () => parseInt(localStorage.getItem('btc_chat_streak') || '0') >= 7, pts: 50 },
    { id: 'chat_streak_30', name: 'Chat Addict', emoji: '💎', desc: 'Chatted 30 days in a row', check: () => parseInt(localStorage.getItem('btc_chat_streak') || '0') >= 30, pts: 150 },

    // ---- DJ Badges ----
    { id: 'dj_first', name: 'First Set', emoji: '🎧', desc: 'DJed for the first time in Global Chat', check: () => parseInt(localStorage.getItem('btc_dj_sets') || '0') >= 1, pts: 25 },
    { id: 'dj_5', name: 'Resident DJ', emoji: '🎛️', desc: 'DJed 5 sets in Global Chat', check: () => parseInt(localStorage.getItem('btc_dj_sets') || '0') >= 5, pts: 50 },
    { id: 'dj_25', name: 'Club Legend', emoji: '🏆', desc: 'DJed 25 sets in Global Chat', check: () => parseInt(localStorage.getItem('btc_dj_sets') || '0') >= 25, pts: 150 },
    { id: 'dj_songs_10', name: 'Playlist Pro', emoji: '📻', desc: 'Broadcast 10 songs as DJ', check: () => parseInt(localStorage.getItem('btc_dj_songs') || '0') >= 10, pts: 30 },
    { id: 'dj_songs_50', name: 'Jukebox Hero', emoji: '🎵', desc: 'Broadcast 50 songs as DJ', check: () => parseInt(localStorage.getItem('btc_dj_songs') || '0') >= 50, pts: 75 },
    { id: 'dj_songs_100', name: 'Vinyl Master', emoji: '💿', desc: 'Broadcast 100 songs as DJ', check: () => parseInt(localStorage.getItem('btc_dj_songs') || '0') >= 100, pts: 200 },
    { id: 'dj_listener', name: 'Good Listener', emoji: '🔊', desc: 'Tuned in to 10 DJ sets', check: () => parseInt(localStorage.getItem('btc_dj_listens') || '0') >= 10, pts: 20 },
    { id: 'dj_listener_50', name: 'Groupie', emoji: '🤘', desc: 'Tuned in to 50 DJ sets', check: () => parseInt(localStorage.getItem('btc_dj_listens') || '0') >= 50, pts: 75 },

    // ---- Music Badges ----
    { id: 'producer_1', name: 'Producer', emoji: '🎤', desc: 'Uploaded your first song to Bitcoin Beats', check: () => parseInt(localStorage.getItem('btc_beats_uploads') || '0') >= 1, pts: 50 },
    { id: 'producer_10', name: 'Discographer', emoji: '💿', desc: 'Uploaded 10 songs to Bitcoin Beats', check: () => parseInt(localStorage.getItem('btc_beats_uploads') || '0') >= 10, pts: 100 },

    // ---- PVP Badges ----
    { id: 'pvp_first', name: 'First Blood', emoji: '🗡️', desc: 'Won your first PVP battle', check: () => parseInt(localStorage.getItem('btc_pvp_wins') || '0') >= 1, pts: 25 },
    { id: 'pvp_5', name: 'Contender', emoji: '🥊', desc: 'Won 5 PVP battles', check: () => parseInt(localStorage.getItem('btc_pvp_wins') || '0') >= 5, pts: 50 },
    { id: 'pvp_25', name: 'Gladiator', emoji: '⚔️', desc: 'Won 25 PVP battles', check: () => parseInt(localStorage.getItem('btc_pvp_wins') || '0') >= 25, pts: 100 },
    { id: 'pvp_50', name: 'Champion', emoji: '🏆', desc: 'Won 50 PVP battles', check: () => parseInt(localStorage.getItem('btc_pvp_wins') || '0') >= 50, pts: 200 },
    { id: 'pvp_100', name: 'PVP Legend', emoji: '👑', desc: 'Won 100 PVP battles', check: () => parseInt(localStorage.getItem('btc_pvp_wins') || '0') >= 100, pts: 500 },

    // ---- Forum Badges ----
    { id: 'forum_5', name: 'Voice of the People', emoji: '📣', desc: 'Made 5 forum posts', check: () => parseInt(localStorage.getItem('btc_forum_post_count') || '0') >= 5, pts: 25 },
    { id: 'forum_25', name: 'Thought Leader', emoji: '🧠', desc: 'Made 25 forum posts', check: () => parseInt(localStorage.getItem('btc_forum_post_count') || '0') >= 25, pts: 75 },
    { id: 'article_1', name: 'Author', emoji: '✍️', desc: 'Published your first article', check: () => parseInt(localStorage.getItem('btc_articles_published') || '0') >= 1, pts: 50 },

    // ---- Streak Badges ----
    { id: 'streak_7', name: 'Week Warrior', emoji: '🔥', desc: '7-day visit streak', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.bestStreak || 0) >= 7, pts: 50 },
    { id: 'streak_30', name: 'Monthly Maxi', emoji: '💪', desc: '30-day visit streak', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.bestStreak || 0) >= 30, pts: 150 },
    { id: 'streak_100', name: 'Diamond Hands', emoji: '💎', desc: '100-day visit streak', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.bestStreak || 0) >= 100, pts: 500 },
    { id: 'streak_365', name: 'HODLer Supreme', emoji: '🏛️', desc: '365-day visit streak', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.bestStreak || 0) >= 365, pts: 2100 },

    // ---- IRL & Community Badges ----
    { id: 'irl_host', name: 'Event Host', emoji: '🎪', desc: 'Hosted your first IRL event', check: () => parseInt(localStorage.getItem('btc_irl_hosted') || '0') >= 1, pts: 50 },
    { id: 'irl_host_5', name: 'Community Builder', emoji: '🏗️', desc: 'Hosted 5 IRL events', check: () => parseInt(localStorage.getItem('btc_irl_hosted') || '0') >= 5, pts: 150 },

    // ---- Sats Badges ----
    { id: 'sats_first', name: 'First Sats', emoji: '🪙', desc: 'Claimed your first sats from the faucet', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.satsWithdrawn || 0) >= 1, pts: 25 },
    { id: 'sats_1k', name: 'Stacker', emoji: '📦', desc: 'Claimed 1,000 sats total', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.satsWithdrawn || 0) >= 1000, pts: 100 },
    { id: 'sats_5k', name: 'Sat Whale', emoji: '🐳', desc: 'Claimed 5,000 sats total', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.satsWithdrawn || 0) >= 5000, pts: 250 },

    // ---- Prediction Badges ----
    { id: 'predict_1', name: 'Oracle', emoji: '🔮', desc: 'Made your first price prediction', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.predictions ? currentUser.predictions.total || 0 : 0) >= 1, pts: 10 },
    { id: 'predict_correct_5', name: 'Crystal Ball', emoji: '🏐', desc: '5 correct predictions', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.predictions ? currentUser.predictions.correct || 0 : 0) >= 5, pts: 75 },

    // ---- Milestone Badges ----
    { id: 'first_purchase', name: 'Bitcoiner', emoji: '🛒', desc: 'Completed the First Bitcoin Purchase guide', check: () => localStorage.getItem('btc_fp_completed') === 'true', pts: 100 },
    { id: 'lightning_setup', name: 'Lightning Rod', emoji: '⚡', desc: 'Set up a Lightning wallet or added a Lightning address', check: () => localStorage.getItem('btc_lightning_setup') === 'true', pts: 100 },
];

let earnedBadges = new Set();
let badgeCheckInterval = null;
// Don't check badges until Firebase has restored the earned list
window._visibleBadgesReady = false;

function initBadges() {
    // Load earned badges from localStorage
    const saved = JSON.parse(localStorage.getItem('btc_badges') || '[]');
    saved.forEach(b => earnedBadges.add(b));

    // Check badges every 15 seconds — but only after Firebase restore
    badgeCheckInterval = setInterval(checkBadges, 30000);

    // Flush queued visible badge popups when Nacho is idle
    setInterval(function() {
        if (!window._visibleBadgeQueue || window._visibleBadgeQueue.length === 0) return;
        if (window._nachoBusy) return;
        var bubble = document.getElementById('nacho-bubble');
        if (bubble && bubble.classList.contains('show')) return;
        if (document.getElementById('badgeCelebration')) return; // another badge showing
        showBadgeToast(window._visibleBadgeQueue.shift());
    }, 5000);
}

// Called from ranking.js after Firebase restores user data
window.markVisibleBadgesReady = function() {
    // Merge any badges from Firebase that aren't in localStorage
    var saved = JSON.parse(localStorage.getItem('btc_badges') || '[]');
    saved.forEach(function(b) { earnedBadges.add(b); });

    // MIGRATION: Silently earn any badges whose conditions are ALREADY met
    // This prevents re-triggering popups for things done in previous sessions
    // Use Firestore data if available (localStorage may not be synced yet)
    var visited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]');
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.readChannels && currentUser.readChannels.length > visited.length) {
        visited = currentUser.readChannels;
    }
    var totalChannels = typeof CHANNELS !== 'undefined' ? Object.keys(CHANNELS).length : 146;
    var questsDone = typeof completedQuests !== 'undefined' ? completedQuests.size : 0;
    var migrated = false;

    for (var i = 0; i < BADGE_DEFS.length; i++) {
        var badge = BADGE_DEFS[i];
        if (earnedBadges.has(badge.id)) continue;
        try {
            if (badge.check(visited, totalChannels, questsDone)) {
                // Silently add — NO popup, NO sound, NO points
                earnedBadges.add(badge.id);
                migrated = true;
            }
        } catch(e) {}
    }

    if (migrated) {
        localStorage.setItem('btc_badges', JSON.stringify([...earnedBadges]));
        // Save to Firebase so this migration only happens once
        if (typeof db !== 'undefined' && typeof auth !== 'undefined' && auth.currentUser) {
            try {
                db.collection('users').doc(auth.currentUser.uid).update({
                    visibleBadges: [...earnedBadges]
                });
            } catch(e) {}
        }
    }

    window._visibleBadgesReady = true;
};

// Safety: allow badges after 20 seconds even if Firebase is slow
setTimeout(function() { if (!window._visibleBadgesReady) window._visibleBadgesReady = true; }, 20000);

function checkBadges() {
    // Wait until Firebase has restored earned badges
    if (!window._visibleBadgesReady) return;
    // Don't pop badges while Nacho is busy
    if (window._nachoBusy) return;

    const visited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]');
    const totalChannels = typeof CHANNELS !== 'undefined' ? Object.keys(CHANNELS).length : 146;
    const questsDone = typeof completedQuests !== 'undefined' ? completedQuests.size : 0;

    for (const badge of BADGE_DEFS) {
        if (earnedBadges.has(badge.id)) continue;
        try {
            if (badge.check(visited, totalChannels, questsDone)) {
                earnedBadges.add(badge.id);
                localStorage.setItem('btc_badges', JSON.stringify([...earnedBadges]));

                // Queue badge popup if Nacho is busy or bubble is open
                var bubble = document.getElementById('nacho-bubble');
                if (window._nachoBusy || (bubble && bubble.classList.contains('show'))) {
                    if (!window._visibleBadgeQueue) window._visibleBadgeQueue = [];
                    window._visibleBadgeQueue.push(badge);
                } else {
                    showBadgeToast(badge);
                }

                // Award points (toasts are already queued by _nachoBusy)
                var badgePts = badge.pts || 20;
                if (typeof awardPoints === 'function') {
                    awardPoints(badgePts, 'Badge: ' + badge.name + ' ' + badge.emoji);
                }
                // Save to Firebase so badges persist across devices/browsers
                if (typeof db !== 'undefined' && typeof auth !== 'undefined' && auth.currentUser) {
                    try {
                        db.collection('users').doc(auth.currentUser.uid).update({
                            visibleBadges: firebase.firestore.FieldValue.arrayUnion(badge.id)
                        });
                    } catch(e) {}
                }
            }
        } catch(e) {}
    }
}

// Major badges that deserve a share prompt
const MAJOR_BADGES = ['explorer_50', 'explorer_100', 'explorer_all', 'properties_all', 'quest_5'];

function showBadgeToast(badge) {
    // Notify
    if (typeof notifySelfBadge === 'function') notifySelfBadge(badge.name, badge.emoji);

    const isMajor = MAJOR_BADGES.includes(badge.id);

    // Minor badges: just a small toast, no fullscreen overlay
    if (!isMajor) {
        if (typeof showToast === 'function') {
            showToast(badge.emoji + ' Badge: ' + badge.name + ' (+' + (badge.pts || 20) + ' pts)');
        }
        return;
    }

    // Major badges: full celebration
    playBadgeSound();
    if (typeof nachoFly === 'function') nachoFly();

    // Launch confetti
    launchConfetti();

    // Show celebration modal
    const overlay = document.createElement('div');
    overlay.id = 'badgeCelebration';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:400;display:flex;justify-content:center;align-items:center;animation:fadeIn 0.3s ease-out;';

    const username = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Bitcoiner';
    const shareText = 'I just earned the ' + badge.emoji + ' ' + badge.name + ' badge on Bitcoin Education Archive! ' + badge.desc;
    const shareUrl = 'https://bitcoineducation.quest';
    const twitterUrl = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText) + '&url=' + encodeURIComponent(shareUrl);

    let shareHtml = '';
    if (isMajor) {
        shareHtml = '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">' +
            '<p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:10px;">Share your achievement!</p>' +
            '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
            '<a href="' + twitterUrl + '" target="_blank" style="padding:8px 16px;background:#000;color:#fff;border-radius:8px;text-decoration:none;font-size:0.85rem;font-weight:600;">𝕏 Share on Twitter</a>' +
            '<button onclick="shareNostr(\'' + shareText.replace(/'/g, "\\'") + '\',\'' + shareUrl + '\')" style="padding:8px 16px;background:#7B2DE4;color:#fff;border:none;border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer;">🟣 Share on Nostr</button>' +
            '<button onclick="copyBadgeLink(\'' + badge.emoji + '\',\'' + badge.name.replace(/'/g, "\\'") + '\')" style="padding:8px 16px;background:var(--card-bg);color:var(--text);border:1px solid var(--border);border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer;">🔗 Copy Link</button>' +
            '</div></div>';
    }

    overlay.innerHTML = '<div style="background:var(--bg-side);border:1px solid var(--border);border-radius:20px;padding:40px;max-width:380px;width:90%;text-align:center;animation:fadeSlideIn 0.4s ease-out;">' +
        '<div style="font-size:4rem;margin-bottom:12px;animation:badgeBounce 0.6s ease-out;">' + badge.emoji + '</div>' +
        '<div style="color:#f7931a;font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;font-weight:800;margin-bottom:8px;">🎉 Badge Earned!</div>' +
        '<div style="color:var(--heading);font-size:1.4rem;font-weight:900;margin-bottom:8px;">' + badge.name + '</div>' +
        '<div style="color:var(--text-muted);font-size:0.95rem;margin-bottom:4px;">' + badge.desc + '</div>' +
        '<div style="color:var(--accent);font-size:0.9rem;font-weight:700;">+20 points</div>' +
        shareHtml +
        '<button onclick="document.getElementById(\'badgeCelebration\').remove()" style="margin-top:20px;padding:10px 30px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;">Awesome! ✨</button>' +
        '</div>';

    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
}

function copyBadgeLink(emoji, name) {
    const text = 'I earned the ' + emoji + ' ' + name + ' badge on Bitcoin Education Archive!\nhttps://bitcoineducation.quest';
    navigator.clipboard.writeText(text).then(() => {
        if (typeof showToast === 'function') showToast('📋 Copied to clipboard!');
    });
}

// Confetti explosion
function launchConfetti() {
    const canvas = document.createElement('canvas');
    canvas.id = 'confettiCanvas';
    canvas.style.cssText = 'position:fixed;inset:0;z-index:500;pointer-events:none;';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const particles = [];
    const colors = ['#f7931a', '#ea580c', '#fbbf24', '#f59e0b', '#ff6b00', '#ff9500', '#ffb800', '#fff'];

    for (let i = 0; i < 120; i++) {
        particles.push({
            x: canvas.width / 2 + (Math.random() - 0.5) * 100,
            y: canvas.height / 2,
            vx: (Math.random() - 0.5) * 16,
            vy: (Math.random() - 1) * 16 - 4,
            size: Math.random() * 8 + 3,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 12,
            gravity: 0.12 + Math.random() * 0.08,
            opacity: 1,
            shape: Math.random() > 0.5 ? 'rect' : 'circle'
        });
    }

    let frame = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;
        particles.forEach(p => {
            p.x += p.vx;
            p.vy += p.gravity;
            p.y += p.vy;
            p.rotation += p.rotSpeed;
            p.vx *= 0.99;
            if (frame > 40) p.opacity -= 0.015;

            if (p.opacity > 0 && p.y < canvas.height + 50) {
                alive = true;
                ctx.save();
                ctx.globalAlpha = Math.max(0, p.opacity);
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation * Math.PI / 180);
                ctx.fillStyle = p.color;
                if (p.shape === 'rect') {
                    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
                } else {
                    ctx.beginPath();
                    ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }
        });
        frame++;
        if (alive && frame < 180) {
            requestAnimationFrame(animate);
        } else {
            canvas.remove();
        }
    }
    requestAnimationFrame(animate);
}

// Celebration sound
function playBadgeSound() {
    if (typeof canPlaySound === 'function' && !canPlaySound()) return;
    if (typeof audioEnabled !== 'undefined' && !audioEnabled) return;
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const vol = typeof audioVolume !== 'undefined' ? audioVolume : 0.5;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.15 * vol, audioCtx.currentTime + i * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.12 + 0.5);
            osc.start(audioCtx.currentTime + i * 0.12);
            osc.stop(audioCtx.currentTime + i * 0.12 + 0.5);
        });
    } catch(e) {}
}

function getBadgeHTML() {
    // Categorize badges
    var _used = {};
    function _cat(list, filter) { var r = list.filter(function(b) { return !_used[b.id] && filter(b); }); r.forEach(function(b) { _used[b.id] = true; }); return r; }
    const categories = {
        '🧭 Discovery': _cat(BADGE_DEFS, b => b.id.includes('explorer') || b.id === 'first_channel'),
        '🧠 Knowledge': _cat(BADGE_DEFS, b => b.id.includes('builder') || b.id.includes('diver') || b.id.includes('librarian') || b.id.includes('quest') || b.id.includes('cert_')),
        '💬 Global Chat': _cat(BADGE_DEFS, b => b.id.startsWith('chat_')),
        '🎧 DJ Mode': _cat(BADGE_DEFS, b => b.id.startsWith('dj_')),
        '🎵 Music': _cat(BADGE_DEFS, b => b.id.startsWith('producer')),
        '⚔️ PVP': _cat(BADGE_DEFS, b => b.id.startsWith('pvp_')),
        '📝 Forum': _cat(BADGE_DEFS, b => b.id.startsWith('forum_') || b.id.startsWith('article_')),
        '🔥 Streaks': _cat(BADGE_DEFS, b => b.id.startsWith('streak_')),
        '🤝 Community': _cat(BADGE_DEFS, b => b.id.startsWith('irl_')),
        '⚡ Sats & Lightning': _cat(BADGE_DEFS, b => b.id.startsWith('sats_') || b.id === 'lightning_setup'),
        '🔮 Predictions': _cat(BADGE_DEFS, b => b.id.startsWith('predict_')),
        '🏆 Milestones': _cat(BADGE_DEFS, b => !_used[b.id])
    };

    let html = '<style>' +
        '.badge-cat-title { color: var(--text-faint); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1.5px; margin: 20px 0 10px; font-weight: 800; display: flex; align-items:center; gap: 8px; }' +
        '.badge-cat-title::after { content: ""; flex: 1; height: 1px; background: var(--border); opacity: 0.5; }' +
        '.badges-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(75px, 1fr)); gap: 10px; padding: 4px; }' +
        '.locked .badge-emoji { filter: grayscale(1) opacity(0.2); transition: 0.3s; }' +
        '.badge-item.locked:hover .badge-emoji { filter: grayscale(1) opacity(0.5); }' +
        '</style>';

    var _bcIdx = 0;
    for (const [catName, badgeList] of Object.entries(categories)) {
        if (badgeList.length === 0) continue;
        _bcIdx++;
        var _bcId = 'bc_' + _bcIdx;
        const catEarned = badgeList.filter(b => earnedBadges.has(b.id)).length;
        const allEarned = catEarned === badgeList.length;
        
        html += '<div style="margin-bottom:6px;border:1px solid ' + (allEarned ? 'rgba(34,197,94,0.3)' : 'var(--border)') + ';border-radius:10px;overflow:visible;">';
        html += '<button onclick="var c=document.getElementById(\'' + _bcId + '\');c.style.display=c.style.display===\'none\'?\'grid\':\'none\';this.querySelector(\'.bca\').textContent=c.style.display===\'none\'?\'▶\':\'▼\'" style="width:100%;padding:10px 12px;background:' + (allEarned ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)') + ';border:none;cursor:pointer;display:flex;align-items:center;gap:8px;font-family:inherit;touch-action:manipulation;">';
        html += '<span class="bca" style="color:var(--text-faint);font-size:0.7rem;">▶</span>';
        html += '<span style="color:var(--text);font-size:0.8rem;font-weight:700;">' + catName + '</span>';
        html += '<span style="margin-left:auto;font-size:0.7rem;color:' + (allEarned ? '#22c55e' : 'var(--accent)') + ';font-weight:700;">' + catEarned + '/' + badgeList.length + (allEarned ? ' ✅' : '') + '</span>';
        html += '</button>';
        html += '<div id="' + _bcId + '" class="badges-grid" style="display:none;">';
        
        for (const badge of badgeList) {
            const earned = earnedBadges.has(badge.id);
            const pts = badge.pts || 20;
            const requirementsText = !earned ? '<div style="margin-top:5px;padding-top:5px;border-top:1px solid rgba(255,255,255,0.1);color:var(--accent);font-weight:700;">How to earn: ' + badge.desc + '</div>' : '';
            const tip = earned ? '✅ ' + badge.desc + ' (+' + pts + ' pts)' : '🔒 Locked — ' + badge.desc;
            
            html += '<div class="badge-item ' + (earned ? 'earned' : 'locked') + '" onclick="this.classList.toggle(\'tapped\')" style="padding:10px 5px; background:var(--card-bg); border-radius:12px; border:1px solid var(--border); overflow:visible;">' +
                '<div class="badge-emoji" style="font-size:1.8rem; margin-bottom:4px;">' + (earned ? badge.emoji : (badge.lockedEmoji || '🔘')) + '</div>' +
                '<div class="badge-name" style="font-size:0.6rem; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + badge.name + '</div>' +
                '<div class="badge-tooltip" style="white-space:normal; min-width:150px; line-height:1.4; z-index:200;">' + tip + requirementsText + '</div>' +
            '</div>';
        }
        html += '</div></div>';
    }

    // Hidden badges section...

    // Goal badges (visible with progress) and Hidden badges (surprise)
    if (typeof HIDDEN_BADGES !== 'undefined') {
        const earnedHidden = JSON.parse(localStorage.getItem('btc_hidden_badges') || '[]');

        // Visible goal badges — shown with name, progress, and hints
        const visibleGoals = HIDDEN_BADGES.filter(function(b) { return !b.hidden; });
        if (visibleGoals.length > 0) {
            _bcIdx++;
            var _goalId = 'bc_' + _bcIdx;
            var goalEarned = visibleGoals.filter(function(b) { return earnedHidden.includes(b.id); }).length;
            var allGoalsEarned = goalEarned === visibleGoals.length;
            html += '</div><div style="margin-bottom:6px;border:1px solid ' + (allGoalsEarned ? 'rgba(34,197,94,0.3)' : 'var(--border)') + ';border-radius:10px;overflow:visible;">';
            html += '<button onclick="var c=document.getElementById(\'' + _goalId + '\');c.style.display=c.style.display===\'none\'?\'grid\':\'none\';this.querySelector(\'.bca\').textContent=c.style.display===\'none\'?\'▶\':\'▼\'" style="width:100%;padding:10px 12px;background:' + (allGoalsEarned ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)') + ';border:none;cursor:pointer;display:flex;align-items:center;gap:8px;font-family:inherit;touch-action:manipulation;">';
            html += '<span class="bca" style="color:var(--text-faint);font-size:0.7rem;">▶</span>';
            html += '<span style="color:var(--text);font-size:0.8rem;font-weight:700;">🎯 Goals</span>';
            html += '<span style="margin-left:auto;font-size:0.7rem;color:' + (allGoalsEarned ? '#22c55e' : 'var(--accent)') + ';font-weight:700;">' + goalEarned + '/' + visibleGoals.length + (allGoalsEarned ? ' ✅' : '') + '</span>';
            html += '</button>';
            html += '<div id="' + _goalId + '" class="badges-grid" style="display:none;">';
            for (const badge of visibleGoals) {
                const unlocked = earnedHidden.includes(badge.id);
                const progressText = (!unlocked && badge.progress) ? badge.progress() : '';
                const hintText = (!unlocked && badge.hint) ? badge.hint : '';
                html += '<div class="badge-item ' + (unlocked ? 'earned' : 'locked') + '" style="position:relative;padding:10px 5px;background:var(--card-bg);border-radius:12px;border:1px solid var(--border);overflow:visible;" onclick="this.classList.toggle(\'tapped\')">' +
                    '<div class="badge-emoji" style="font-size:1.8rem;margin-bottom:4px;">' + (unlocked ? badge.emoji : '🔒') + '</div>' +
                    '<div class="badge-name" style="font-size:0.6rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + badge.name + '</div>' +
                    (progressText ? '<div style="font-size:0.55rem;color:var(--accent);font-weight:700;margin-top:1px;">' + progressText + '</div>' : '') +
                    '<div class="badge-tooltip" style="white-space:normal;min-width:150px;line-height:1.4;z-index:200;">' + (unlocked ? '✅ ' + badge.desc + ' (+' + badge.pts + ' pts)' : '🔒 ' + badge.desc + (hintText ? ' — ' + hintText : '')) + '</div>' +
                '</div>';
            }
            html += '</div></div><div class="badges-grid" style="display:none;">';
        }

        // True hidden badges — only show after at least one is earned
        const hiddenBadges = HIDDEN_BADGES.filter(function(b) { return b.hidden; });
        const anyHiddenEarned = hiddenBadges.some(function(b) { return earnedHidden.includes(b.id); });
        const hiddenCount = hiddenBadges.length;
        const hiddenEarnedCount = hiddenBadges.filter(function(b) { return earnedHidden.includes(b.id); }).length;

        _bcIdx++;
        var _secretId = 'bc_' + _bcIdx;
        var allSecretsEarned = hiddenEarnedCount === hiddenCount;
        html += '</div><div style="margin-bottom:6px;border:1px solid ' + (allSecretsEarned ? 'rgba(34,197,94,0.3)' : 'var(--border)') + ';border-radius:10px;overflow:visible;">';
        html += '<button onclick="var c=document.getElementById(\'' + _secretId + '\');c.style.display=c.style.display===\'none\'?\'grid\':\'none\';this.querySelector(\'.bca\').textContent=c.style.display===\'none\'?\'▶\':\'▼\'" style="width:100%;padding:10px 12px;background:' + (allSecretsEarned ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)') + ';border:none;cursor:pointer;display:flex;align-items:center;gap:8px;font-family:inherit;touch-action:manipulation;">';
        html += '<span class="bca" style="color:var(--text-faint);font-size:0.7rem;">▶</span>';
        html += '<span style="color:var(--text);font-size:0.8rem;font-weight:700;">🔮 Secret Badges</span>';
        html += '<span style="margin-left:auto;font-size:0.7rem;color:' + (allSecretsEarned ? '#22c55e' : 'var(--accent)') + ';font-weight:700;">' + hiddenEarnedCount + '/' + hiddenCount + (allSecretsEarned ? ' ✅' : '') + '</span>';
        html += '</button>';
        html += '<div id="' + _secretId + '" class="badges-grid" style="display:none;">';
        if (anyHiddenEarned) {
            for (const badge of hiddenBadges) {
                const unlocked = earnedHidden.includes(badge.id);
                html += '<div class="badge-item ' + (unlocked ? 'earned' : 'locked') + '" onclick="this.classList.toggle(\'tapped\')" style="padding:10px 5px;background:var(--card-bg);border-radius:12px;border:1px solid var(--border);overflow:visible;">' +
                    '<div class="badge-emoji" style="font-size:1.8rem;margin-bottom:4px;">' + (unlocked ? badge.emoji : '❓') + '</div>' +
                    '<div class="badge-name" style="font-size:0.6rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (unlocked ? badge.name : '???') + '</div>' +
                    '<div class="badge-tooltip" style="white-space:normal;min-width:150px;line-height:1.4;z-index:200;">' + (unlocked ? '✅ ' + badge.desc + ' (+' + badge.pts + ' pts)' : '🔒 Keep exploring!') + '</div>' +
                '</div>';
            }
        } else {
            html += '<div style="text-align:center;padding:10px;color:var(--text-faint);font-size:0.8rem;grid-column:1/-1;">' +
                hiddenCount + ' secret badges waiting to be discovered... 🔮</div>';
        }
        html += '</div></div><div class="badges-grid" style="display:none;">';
    }

    html += '</div>';
    return html;
}

// Init
setTimeout(initBadges, 2000);
