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

function showBadgeToast(badge) {
    const t = document.createElement('div');
    t.className = 'badge-toast';
    t.innerHTML = '<div class="badge-toast-emoji">' + badge.emoji + '</div>' +
        '<div class="badge-toast-info"><div class="badge-toast-title">Badge Earned!</div>' +
        '<div class="badge-toast-name">' + badge.name + '</div>' +
        '<div class="badge-toast-desc">' + badge.desc + '</div></div>';
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 500); }, 4000);
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
