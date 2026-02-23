// =============================================
// Bitcoin Education Archive - Achievement Badges
// =============================================

const BADGE_DEFS = [
    { id: 'first_channel', name: 'First Steps', emoji: '👶', desc: 'Opened your first channel', check: v => v.length >= 1 },
    { id: 'explorer_10', name: 'Explorer', emoji: '🧭', desc: 'Visited 10 channels', check: v => v.length >= 10 },
    { id: 'explorer_25', name: 'Trailblazer', emoji: '🗺️', desc: 'Visited 25 channels', check: v => v.length >= 25 },
    { id: 'explorer_50', name: 'Pathfinder', emoji: '🏔️', desc: 'Visited 50 channels', check: v => v.length >= 50 },
    { id: 'explorer_100', name: 'Cartographer', emoji: '🌍', desc: 'Visited 100 channels', check: v => v.length >= 100 },
    { id: 'explorer_all', name: 'Completionist', emoji: '🏆', desc: 'Visited every single channel', check: (v, total) => v.length >= total },
    { id: 'properties_all', name: 'Foundation Builder', emoji: '🧱', desc: 'Read all Properties Layer 1 channels', check: v => {
        const props = ['whitepaper','decentralized','scarce','secure','money','peaceful','dominant','organic','supranational','programmable','use-cases'];
        return props.every(p => v.includes(p));
    }},
    { id: 'experienced_5', name: 'Deep Diver', emoji: '🤿', desc: 'Read 5 Experienced Topics', check: v => {
        const exp = ['maximalism','problems-of-money','self-custody','privacy-nonkyc','nodes','mining','pow-vs-pos','energy','difficulty-adjustment','layer-2-lightning','fedi-ark','chaumian-mints','ctv-covenants','extension-blocks','op-codes','bitvm','layer-3-sidechains','stablecoins','smart-contracts','blockchain-timechain','regulation','cryptography','core-source-code','developers','investment-strategy','evidence-against-alts','consensus'];
        return exp.filter(e => v.includes(e)).length >= 5;
    }},
    { id: 'resources_10', name: 'Resource Hunter', emoji: '📚', desc: 'Explored 10 Resource channels', check: v => {
        const res = ['one-stop-shop','faq-glossary','nostr','misconceptions-fud','books','videos','podcasts','articles-threads','informational-sites','curriculum','research-theses','games','music','movies-tv','hardware','poems-stories','apps-tools','projects-diy','art-inspiration','graphics','charts','swag-merch','jobs-earn','social-media','fun-facts','news-adoption','history','international','satoshi-nakamoto','giga-chad','health','web5','memes-funny'];
        return res.filter(r => v.includes(r)).length >= 10;
    }},
    { id: 'quest_1', name: 'Quester', emoji: '⚔️', desc: 'Completed your first Quest', check: (v, t, q) => q >= 1 },
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
];

let earnedBadges = new Set();
let badgeCheckInterval = null;

function initBadges() {
    // Load earned badges
    const saved = JSON.parse(localStorage.getItem('btc_badges') || '[]');
    saved.forEach(b => earnedBadges.add(b));

    // Check badges every 15 seconds
    badgeCheckInterval = setInterval(checkBadges, 15000);
    setTimeout(checkBadges, 5000);
}

function checkBadges() {
    const visited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]');
    const totalChannels = typeof CHANNELS !== 'undefined' ? Object.keys(CHANNELS).length : 146;
    const questsDone = typeof completedQuests !== 'undefined' ? completedQuests.size : 0;

    for (const badge of BADGE_DEFS) {
        if (earnedBadges.has(badge.id)) continue;
        try {
            if (badge.check(visited, totalChannels, questsDone)) {
                earnedBadges.add(badge.id);
                localStorage.setItem('btc_badges', JSON.stringify([...earnedBadges]));
                showBadgeToast(badge);

                // Award points
                if (typeof awardPoints === 'function') {
                    awardPoints(20, 'Badge: ' + badge.name + ' ' + badge.emoji);
                }
            }
        } catch(e) {}
    }
}

// Major badges that deserve a share prompt
const MAJOR_BADGES = ['explorer_10', 'explorer_25', 'explorer_50', 'explorer_100', 'explorer_all', 'properties_all', 'quest_3', 'quest_5'];

function showBadgeToast(badge) {
    // Play celebration sound
    playBadgeSound();

    // Launch confetti
    launchConfetti();

    // Show celebration modal
    const isMajor = MAJOR_BADGES.includes(badge.id);
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
    let html = '<div class="badges-grid">';
    for (const badge of BADGE_DEFS) {
        const earned = earnedBadges.has(badge.id);
        const tip = earned ? '✅ ' + badge.desc : '🔒 ' + badge.desc;
        html += '<div class="badge-item ' + (earned ? 'earned' : 'locked') + '">' +
            '<div class="badge-emoji">' + (earned ? badge.emoji : '🔒') + '</div>' +
            '<div class="badge-name">' + badge.name + '</div>' +
            '<div class="badge-tooltip">' + tip + '</div>' +
        '</div>';
    }
    html += '</div>';
    return html;
}

// Init
setTimeout(initBadges, 2000);
