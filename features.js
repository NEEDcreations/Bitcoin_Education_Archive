const HIDDEN_BADGES = [
    // === VISIBLE GOALS (shown locked with progress hints) ===
    { id: 'nacho_friend', name: 'Nacho\'s Friend', emoji: '🦌', pts: 25, desc: 'Interact with Nacho', hint: 'Click on Nacho!', hidden: false, check: function() { return localStorage.getItem('btc_nacho_clicked') === 'true'; } },
    { id: 'genesis', name: 'Genesis Reader', emoji: '📜', pts: 75, desc: 'Read the whitepaper channel', hint: 'Open the Whitepaper channel', hidden: false, check: function() { return typeof currentChannelId !== 'undefined' && currentChannelId === 'whitepaper'; } },
    { id: 'nacho_curious', name: 'Curious Deer', emoji: '❓', pts: 50, desc: 'Ask Nacho your first question', hint: 'Ask Nacho anything!', hidden: false, check: function() { return parseInt(localStorage.getItem('btc_nacho_questions') || '0') >= 1; } },
    { id: 'ticket_bronze', name: 'Ticket Fish', emoji: '🐟', pts: 200, desc: 'Earn 25 Orange Tickets', hint: 'Spin daily + referrals!', hidden: false, check: function() { return typeof currentUser !== 'undefined' && currentUser && (currentUser.orangeTickets || 0) >= 25; }, progress: function() { return typeof currentUser !== 'undefined' && currentUser ? Math.min(currentUser.orangeTickets || 0, 25) + '/25' : '0/25'; } },
    { id: 'ticket_silver', name: 'Ticket Shark', emoji: '🦈', pts: 500, desc: 'Earn 50 Orange Tickets', hint: 'Keep spinning & referring!', hidden: false, check: function() { return typeof currentUser !== 'undefined' && currentUser && (currentUser.orangeTickets || 0) >= 50; }, progress: function() { return typeof currentUser !== 'undefined' && currentUser ? Math.min(currentUser.orangeTickets || 0, 50) + '/50' : '0/50'; } },
    { id: 'ticket_gold', name: 'Ticket Whale', emoji: '🐋', pts: 1000, desc: 'Earn 100 Orange Tickets', hint: 'The ultimate ticket badge!', hidden: false, check: function() { return typeof currentUser !== 'undefined' && currentUser && (currentUser.orangeTickets || 0) >= 100; }, progress: function() { return typeof currentUser !== 'undefined' && currentUser ? Math.min(currentUser.orangeTickets || 0, 100) + '/100' : '0/100'; } },
    { id: 'nacho_10q', name: 'Inquisitive Buck', emoji: '🔍', pts: 200, desc: 'Ask Nacho 10 questions', hint: 'Keep asking Nacho!', hidden: false, check: function() { return parseInt(localStorage.getItem('btc_nacho_questions') || '0') >= 10; }, progress: function() { return Math.min(parseInt(localStorage.getItem('btc_nacho_questions') || '0'), 10) + '/10'; } },
    { id: 'collector', name: 'Collector', emoji: '💎', pts: 150, desc: 'Save 10+ topics to favorites', hint: 'Star your favorite topics', hidden: false, check: function() { return safeJSON('btc_favs', []).length >= 10; }, progress: function() { return Math.min(safeJSON('btc_favs', []).length, 10) + '/10'; } },
    { id: 'first_post', name: 'Town Crier', emoji: '📣', pts: 100, desc: 'Make your first Pleb Talk post', hint: 'Post in PlebTalk!', hidden: false, check: function() { return parseInt(localStorage.getItem('btc_forum_post_count') || '0') >= 1 || (typeof currentUser !== 'undefined' && currentUser && currentUser.forumPosts >= 1); } },
    { id: 'first_reply', name: 'Conversationalist', emoji: '💬', pts: 75, desc: 'Reply to a forum post', hint: 'Join a discussion!', hidden: false, check: function() { return typeof currentUser !== 'undefined' && currentUser && currentUser.forumReplies >= 1; } },
    { id: 'market_seller', name: 'Merchant', emoji: '🏪', pts: 150, desc: 'List an item on Lightning Mart', hint: 'Sell something for sats on Lightning Mart!', hidden: false, check: function() { return typeof currentUser !== 'undefined' && currentUser && currentUser.marketListings >= 1; } },
    { id: 'market_buyer', name: 'Shopper', emoji: '🛍️', pts: 150, desc: 'Contact a seller on the marketplace', hint: 'Find something to buy!', hidden: false, check: function() { return typeof currentUser !== 'undefined' && currentUser && currentUser.marketMessages >= 1; } },
    // === CHARITY DONATION BADGES ===
    { id: 'donor_100', name: 'Giving Pleb', emoji: '🫷', pts: 50, desc: 'Donate 100 XP for charity', hint: 'Donate 100 XP in the Charity tab!', hidden: false, check: function() { return typeof currentUser !== 'undefined' && currentUser && (currentUser.pointsDonated || 0) >= 100; }, progress: function() { return Math.min((typeof currentUser !== 'undefined' && currentUser ? currentUser.pointsDonated || 0 : 0), 100) + '/100'; } },
    { id: 'donor_500', name: 'Stack Sharer', emoji: '💛', pts: 150, desc: 'Donate 500 XP for charity', hint: 'Keep donating!', hidden: false, check: function() { return typeof currentUser !== 'undefined' && currentUser && (currentUser.pointsDonated || 0) >= 500; }, progress: function() { return Math.min((typeof currentUser !== 'undefined' && currentUser ? currentUser.pointsDonated || 0 : 0), 500) + '/500'; } },
    { id: 'donor_1000', name: 'Community Builder', emoji: '🧡', pts: 300, desc: 'Donate 1,000 XP for charity', hint: 'A true community builder!', hidden: false, check: function() { return typeof currentUser !== 'undefined' && currentUser && (currentUser.pointsDonated || 0) >= 1000; }, progress: function() { return Math.min((typeof currentUser !== 'undefined' && currentUser ? currentUser.pointsDonated || 0 : 0), 1000) + '/1,000'; } },
    { id: 'donor_5000', name: 'Archive Patron', emoji: '❤️', pts: 1000, desc: 'Donate 5,000 XP for charity', hint: 'An archive patron — legendary!', hidden: false, check: function() { return typeof currentUser !== 'undefined' && currentUser && (currentUser.pointsDonated || 0) >= 5000; }, progress: function() { return Math.min((typeof currentUser !== 'undefined' && currentUser ? currentUser.pointsDonated || 0 : 0), 5000) + '/5,000'; } },
    { id: 'donor_10000', name: 'Sats Saint', emoji: '🔥', pts: 2000, desc: 'Donate 10,000 XP for charity', hint: 'A sats saint among us!', hidden: false, check: function() { return typeof currentUser !== 'undefined' && currentUser && (currentUser.pointsDonated || 0) >= 10000; }, progress: function() { return Math.min((typeof currentUser !== 'undefined' && currentUser ? currentUser.pointsDonated || 0 : 0), 10000) + '/10,000'; } },
    { id: 'donor_25000', name: 'Lightning Philanthropist', emoji: '⚡', pts: 4000, desc: 'Donate 25,000 XP for charity', hint: 'A lightning philanthropist!', hidden: false, check: function() { return typeof currentUser !== 'undefined' && currentUser && (currentUser.pointsDonated || 0) >= 25000; }, progress: function() { return Math.min((typeof currentUser !== 'undefined' && currentUser ? currentUser.pointsDonated || 0 : 0), 25000) + '/25,000'; } },
    { id: 'donor_50000', name: "Satoshi's Steward", emoji: '🏆', pts: 7500, desc: 'Donate 50,000 XP for charity', hint: "Satoshi's Steward — incredible!", hidden: false, check: function() { return typeof currentUser !== 'undefined' && currentUser && (currentUser.pointsDonated || 0) >= 50000; }, progress: function() { return Math.min((typeof currentUser !== 'undefined' && currentUser ? currentUser.pointsDonated || 0 : 0), 50000) + '/50,000'; } },
    { id: 'donor_100000', name: 'Legend of the Archive', emoji: '👑', pts: 15000, desc: 'Donate 100,000 XP for charity', hint: 'A true legend of the archive!', hidden: false, check: function() { return typeof currentUser !== 'undefined' && currentUser && (currentUser.pointsDonated || 0) >= 100000; }, progress: function() { return Math.min((typeof currentUser !== 'undefined' && currentUser ? currentUser.pointsDonated || 0 : 0), 100000) + '/100,000'; } },
    // === TRUE HIDDEN (surprise discoveries) ===
    { id: 'night_owl', name: 'Night Owl', emoji: '🦉', pts: 50, desc: 'Visit the archive after midnight', hidden: true, check: function() { return new Date().getHours() >= 0 && new Date().getHours() < 5; } },
    { id: 'speed_runner', name: 'Speed Runner', emoji: '⚡', pts: 100, desc: 'Visit 15+ channels in one session', hidden: true, check: function() { return typeof sessionChannels !== 'undefined' && sessionChannels.size >= 15; } },
    { id: 'scholar', name: 'Bitcoin Scholar', emoji: '🎓', pts: 300, desc: 'Pass the Scholar Certification', hidden: true, check: function() { return localStorage.getItem('btc_scholar_passed') === 'true'; } },
    { id: 'nacho_20q', name: '20 Questions', emoji: '🏅', pts: 500, desc: 'Ask Nacho 20 questions', hidden: true, check: function() { return parseInt(localStorage.getItem('btc_nacho_questions') || '0') >= 20; } },
    // === CHANNEL EXPLORATION MILESTONES ===
    { id: 'explorer_10', name: 'Curious Pleb', emoji: '🗺️', pts: 100, desc: 'Explore 10 topics', hint: 'Keep exploring!', hidden: false, check: function() { return safeJSON('btc_visited_channels', []).length >= 10; }, progress: function() { return Math.min(safeJSON('btc_visited_channels', []).length, 10) + '/10'; } },
    { id: 'explorer_25', name: 'Rabbit Holer', emoji: '🐇', pts: 250, desc: 'Explore 25 topics', hint: 'Dive deeper!', hidden: false, check: function() { return safeJSON('btc_visited_channels', []).length >= 25; }, progress: function() { return Math.min(safeJSON('btc_visited_channels', []).length, 25) + '/25'; } },
    { id: 'explorer_50', name: 'Half Stack', emoji: '📚', pts: 500, desc: 'Explore 50 topics', hint: 'Halfway there!', hidden: false, check: function() { return safeJSON('btc_visited_channels', []).length >= 50; }, progress: function() { return Math.min(safeJSON('btc_visited_channels', []).length, 50) + '/50'; } },
    { id: 'explorer_100', name: 'Century Club', emoji: '💯', pts: 1000, desc: 'Explore 100 topics', hint: 'Almost all of them!', hidden: false, check: function() { return safeJSON('btc_visited_channels', []).length >= 100; }, progress: function() { return Math.min(safeJSON('btc_visited_channels', []).length, 100) + '/100'; } },
    { id: 'explorer_all', name: 'Archive Master', emoji: '👑', pts: 2000, desc: 'Explore every single topic', hint: 'Visit them all!', hidden: true, check: function() { return typeof CHANNELS !== 'undefined' && safeJSON('btc_visited_channels', []).length >= Object.keys(CHANNELS).length; } },
    // === MORE SECRET BADGES ===
    { id: 'marathon', name: 'Marathon Reader', emoji: '🏃', pts: 150, desc: 'Spent 30+ minutes reading in one session', hidden: true, check: function() { return (Date.now() - (window._sessionStart || Date.now())) > 1800000; } },
    { id: 'early_adopter', name: 'Early Adopter', emoji: '🌅', pts: 200, desc: 'Browsing between 5am and 7am', hidden: true, check: function() { var h = new Date().getHours(); return h >= 5 && h < 7; } },
    { id: 'weekend_warrior', name: 'Weekend Warrior', emoji: '🎉', pts: 75, desc: 'Learning Bitcoin on a weekend', hidden: true, check: function() { var d = new Date().getDay(); return d === 0 || d === 6; } },
    { id: 'triple_threat', name: 'Triple Threat', emoji: '🎯', pts: 300, desc: 'Completed a quest, sent a chat message, and read a channel in one session', hidden: true, check: function() { return sessionStorage.getItem('btc_quest_done') === 'true' && sessionStorage.getItem('btc_chat_sent') === 'true' && (typeof sessionChannels !== 'undefined' && sessionChannels.size >= 1); } },
    { id: 'nacho_50q', name: 'Nacho Sage', emoji: '🧙', pts: 500, desc: 'Ask Nacho 50 questions', hidden: true, check: function() { return parseInt(localStorage.getItem('btc_nacho_questions') || '0') >= 50; } },
    { id: 'bookmark_collector', name: 'Bookmark Hoarder', emoji: '📚', pts: 100, desc: 'Bookmarked 20+ messages', hidden: true, check: function() { return safeJSON('btc_bookmarks', []).length >= 20; } },
    { id: 'pvp_streak', name: 'Undefeated', emoji: '🔱', pts: 250, desc: 'Won 5 PVP battles in a row', hidden: true, check: function() { return parseInt(localStorage.getItem('btc_pvp_win_streak') || '0') >= 5; } },
    { id: 'sats_maxed', name: 'Faucet King', emoji: '👑', pts: 1000, desc: 'Claimed all 10,000 sats from the faucet', hidden: true, check: function() { return typeof currentUser !== 'undefined' && currentUser && (currentUser.satsWithdrawn || 0) >= 10000; } },
    { id: 'streak_freeze', name: 'Ice Shield', emoji: '🧊', pts: 50, desc: 'Used a streak freeze to save your streak', hidden: true, check: function() { return localStorage.getItem('btc_freeze_used') === 'true'; } },
    { id: 'nacho_closet_full', name: 'Fashionista', emoji: '👗', pts: 200, desc: 'Unlocked all Nacho closet items from the spin wheel', hidden: true, check: function() { var items = safeJSON('btc_spin_closet_items', []); return items.length >= 10; } },
    // === 10 NEW SECRET BADGES (hard / obscure) ===
    { id: 'ghost_reader', name: 'Ghost Reader', emoji: '👻', pts: 500, desc: 'Visited the archive every day for a week without earning any points', hidden: true, check: function() { return typeof currentUser !== 'undefined' && currentUser && (currentUser.streak || 0) >= 7 && (currentUser.points || 0) === 0; } },
    { id: 'whitepaper_pilgrim', name: 'Whitepaper Pilgrim', emoji: '📜', pts: 750, desc: 'Read the whitepaper channel 10 times in separate sessions', hidden: true, check: function() { return parseInt(localStorage.getItem('btc_whitepaper_visits') || '0') >= 10; } },
    { id: 'insomniac', name: 'Insomniac', emoji: '🌑', pts: 300, desc: 'Visited the archive between 2am and 4am on 3 separate occasions', hidden: true, check: function() { return parseInt(localStorage.getItem('btc_late_night_visits') || '0') >= 3; } },
    { id: 'contrarian', name: 'The Contrarian', emoji: '🙃', pts: 400, desc: 'Voted against the majority in 10 daily polls', hidden: true, check: function() { return parseInt(localStorage.getItem('btc_poll_minority_votes') || '0') >= 10; } },
    { id: 'block_42', name: 'Block 42', emoji: '🎱', pts: 421, desc: 'Discovered something hidden in the archive', hidden: true, check: function() { return localStorage.getItem('btc_block42_found') === 'true'; } },
    { id: 'rabbit_hole', name: 'Rabbit Hole', emoji: '🕳️', pts: 600, desc: 'Spent 3 hours straight learning in one session', hidden: true, check: function() { return (Date.now() - (window._sessionStart || Date.now())) > 10800000; } },
    { id: 'the_plebeian', name: 'The Plebeian', emoji: '🫡', pts: 350, desc: 'Reached the leaderboard top 100 without a single referral', hidden: true, check: function() { return typeof currentUser !== 'undefined' && currentUser && (currentUser.leaderboardRank || 9999) <= 100 && (currentUser.referralCount || 0) === 0; } },
    { id: 'silent_donor', name: 'Silent Donor', emoji: '🤫', pts: 777, desc: 'Donated XP to charity without ever sharing your referral link', hidden: true, check: function() { return typeof currentUser !== 'undefined' && currentUser && (currentUser.pointsDonated || 0) >= 500 && (currentUser.referralCount || 0) === 0; } },
    { id: 'dust_collector', name: 'Dust Collector', emoji: '🧹', pts: 210, desc: 'Claimed sats from the faucet 21 days in a row', hidden: true, check: function() { return parseInt(localStorage.getItem('btc_faucet_streak') || '0') >= 21; } },
    { id: 'hash_obsessed', name: 'Hash Obsessed', emoji: '⛏️', pts: 2100, desc: 'Contributed 25,000 hashes to Satoshi\'s Favor', hidden: true, check: function() { return typeof currentUser !== 'undefined' && currentUser && (currentUser.totalHashes || 0) >= 25000; } },
    // === SEARCH SLEUTH (secret — use all 6 search surfaces) ===
    { id: 'search_sleuth', name: 'Search Sleuth', emoji: '🔎', pts: 500, desc: 'Used every search in the archive — topics, users, badges, forum, marketplace, beats, and GIFs', hidden: true, check: function() { var s = safeJSON('btc_searches_used', []); return ['topic','user','badge','forum','market','beats','gif'].every(function(k){ return s.indexOf(k) !== -1; }); } },
];


// Phase 4: Social Proof & Live Activity 🚀

(function() {
    // Engagement ticker — shows real + generated user activity to inspire action
    const ENGAGEMENT_TEMPLATES = [
        // Quests & Learning
        "🎓 Someone just passed the Bitcoin Basics Certification! Can you?",
        "⚡ A pleb just completed a Lightning Network quest — 50 XP earned!",
        "🗺️ Someone just finished all 10 steps of the Bitcoin Journey!",
        "🎮 A Bitcoiner just aced a quiz in Nacho Mode — 10/10!",
        "📚 A new user just explored their first 3 topics — features unlocking!",
        "🧠 Someone just asked Nacho 100 questions — Bitcoin Scholar status!",
        "🎯 A pleb just scored 5/5 on a Conversation Quest!",
        "📖 Someone just read through the entire Timechain channel!",
        // Streaks & Points
        "🔥 A Bitcoiner just hit a 30-day streak! Legendary dedication!",
        "🔥 Someone just started a 7-day streak — can you beat them?",
        "🏆 A pleb just crossed 5,000 XP! Climbing the leaderboard!",
        "⭐ Someone just earned 200 XP in a single session!",
        "🔥 A user just protected their streak with a Freeze Ticket! Smart move.",
        // Leaderboard & Levels
        "📈 Someone just jumped 10 spots on the Leaderboard!",
        "🧡 A Bitcoiner just leveled up to Bitcoin Believer!",
        "🏔 Someone just reached Maxi status — top of the mountain!",
        "👑 A pleb just entered the Top 25 on the Leaderboard!",
        "🌱 A brand new user just earned their first 50 XP! Welcome!",
        // Spin & Tickets
        "🎡 Someone just spun the daily wheel and won 5 Orange Tickets!",
        "🎟️ A pleb just earned bonus tickets from a referral!",
        "🧊 Someone won a Streak Freeze on the daily spin — lucky!",
        "🎡 A Bitcoiner just won a closet item from the spin wheel!",
        // Community & Social
        "💬 New discussion in PlebTalk: 'Best cold storage for beginners?'",
        "💬 Someone just posted in PlebTalk — join the conversation!",
        "🛒 New listing on LightningMart — check it out!",
        "🤝 A meetup was just created in IRL Sync — find one near you!",
        "💬 A PlebTalk post just got 5 upvotes!",
        "⚡ Someone just tipped a forum post with Lightning!",
        // Nacho & Fun
        "🦌 Someone just entered Nacho Mode for a 30-minute deep dive!",
        "🎽 A pleb just equipped Diamond Hooves in Nacho's Closet! 💎",
        "🕶️ Someone just unlocked Cool Shades from the spin wheel!",
        "👑 A Bitcoiner just equipped the Royal Crown — looking regal!",
        "🦌 Nacho just helped someone understand seed phrases!",
        // Discovery & Exploration
        "🗺️ Someone just explored their 50th channel — almost full coverage!",
        "🦉 A Night Owl badge was just earned at 2 AM!",
        "🎲 Someone just used Random Channel and discovered 'cypherpunks'!",
        "🎨 A user just browsed the Art Gallery — 200+ Bitcoin artworks!",
        "📡 A Bitcoiner just opted in to The Signal newsletter!",
        // Milestones (semi-dynamic)
        "🎉 Over 100 users are learning Bitcoin here right now!",
        "📊 The archive has been visited over 10,000 times this month!",
        "🧡 146 channels of pure Bitcoin education — and growing!",
        "⚡ Over 500 Nacho conversations happened this week!",
        "🏆 The Leaderboard top 10 just shuffled — who's climbing?"
    ];

    async function initActivityTicker() {
        const visitedCount = safeJSON('btc_visited_channels', []).length;
        const isAuth = firebase.auth().currentUser && !firebase.auth().currentUser.isAnonymous;
        if (visitedCount < 3 && !isAuth) return;

        const ticker = document.getElementById('activity-ticker');
        const content = document.getElementById('ticker-content');
        if (!ticker || !content) return;

        // Build pool: start with engagement templates
        var pool = ENGAGEMENT_TEMPLATES.slice();

        // Pull real user activity from Firestore
        try {
            var db = firebase.firestore();

            // Recent forum posts
            var forumSnap = await db.collection('forum_posts').orderBy('createdAt', 'desc').limit(3).get();
            forumSnap.forEach(function(doc) {
                var d = doc.data();
                var author = d.authorName || 'A pleb';
                pool.push('💬 ' + author + ' just posted in PlebTalk: "' + (d.title || '').substring(0, 40) + '..."');
            });

            // Recent marketplace listings
            try {
                var mktSnap = await db.collection('marketplace').where('status', '==', 'active').orderBy('createdAt', 'desc').limit(2).get();
                mktSnap.forEach(function(doc) {
                    var d = doc.data();
                    pool.push('🛒 New on LightningMart: "' + (d.title || 'Item').substring(0, 35) + '" for ' + (d.priceSats || d.price || '???') + ' sats!');
                });
            } catch(e) {}

            // Recent top leaderboard movers
            try {
                var lbSnap = await db.collection('users').orderBy('points', 'desc').limit(10).get();
                var topUsers = [];
                lbSnap.forEach(function(doc) { var d = doc.data(); if (d.username) topUsers.push(d.username); });
                if (topUsers.length >= 3) {
                    pool.push('👑 ' + topUsers[0] + ' is holding #1 on the Leaderboard! Can you catch them?');
                    var rand = topUsers[Math.floor(Math.random() * Math.min(5, topUsers.length))];
                    pool.push('📈 ' + rand + ' just climbed the Leaderboard — competition is heating up!');
                }
            } catch(e) {}

            // IRL events
            try {
                var irlSnap = await db.collection('irl_events').where('date', '>=', new Date().toISOString()).orderBy('date', 'asc').limit(2).get();
                irlSnap.forEach(function(doc) {
                    var ev = doc.data();
                    pool.push('🤝 Upcoming meetup: "' + (ev.title || 'Bitcoin Meetup').substring(0, 35) + '" — RSVP in IRL Sync!');
                });
            } catch(e) {}

        } catch(e) { console.log('Ticker live data skipped:', e); }

        // Shuffle the pool
        for (var i = pool.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
        }

        ticker.style.display = 'flex';
        var currentIdx = 0;

        function updateTicker() {
            content.style.animation = 'none';
            content.offsetHeight;
            content.textContent = pool[currentIdx];
            content.style.animation = 'tickerScroll 12s linear infinite';
            currentIdx = (currentIdx + 1) % pool.length;
        }

        updateTicker();
        setInterval(updateTicker, 12000);
    }

    // 🔗 UI FIX: Ensure ticker content doesn't truncate early
    const styleFix = document.createElement('style');
    styleFix.textContent = `
        #ticker-content { 
            white-space: nowrap !important;
            overflow: visible !important;
            text-overflow: clip !important;
            display: inline-block !important;
            width: auto !important;
            padding-right: 50px;
        }
        @keyframes tickerScroll {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
        }
    `;
    document.head.appendChild(styleFix);

    // Phase 7: Channel Sentiment Rating
    window.rateChannel = async function(channelId, rating) {
        const el = document.getElementById('sentiment-' + channelId);
        if (!el) return;

        el.innerHTML = '<div style="color:var(--accent);font-weight:800;font-size:1.2rem;margin-bottom:8px;">Thank you! 🦌</div>' +
            '<div style="color:var(--text-muted);font-size:0.9rem;">Nacho will use this to organize better content.</div>';

        try {
            const db = firebase.firestore();
            await db.collection('channel_feedback').add({
                channelId: channelId,
                rating: rating,
                uid: (firebase.auth().currentUser ? firebase.auth().currentUser.uid : 'anon'),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Give a small point bonus for feedback
            if (typeof awardPoints === 'function') awardPoints(5, 'Feedback bonus');
        } catch(e) { console.log("Feedback save skipped:", e); }
    };

    // Start ticker
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { initActivityTicker(); });
    } else {
        initActivityTicker();
    }
})();

// ---- Nacho Story (daily chapters) ----
// Rule: 1 new chapter per calendar day. Day 1 = Chapter 1. Users can re-read unlocked chapters.
window.showNachoStory = function(chapterOverride) {
    var CHAPTERS = [
        { title: "Chapter 1: The Genesis Block", text: "In the beginning, there was nothing but fiat. Nacho was just a young buck growing up in the White Mountains of New Hampshire — the Live Free or Die state. He spent his fawn days splashing in the Pemigewasset River, racing chipmunks through birch groves, and nibbling on leaves of debt from the forest of traditional finance. His mama always said the acorns were getting smaller every year, but nobody could explain why. One cold January day in 2009, a mysterious message appeared carved into a sugar maple: 'Chancellor on brink of second bailout for banks.' Nacho didn't understand it yet, but something had changed forever. A new kind of money had been born — one that no government could print, no bank could freeze, and no deer could counterfeit. It was called Bitcoin." },
        { title: "Chapter 2: The Pizza That Changed Everything", text: "Nacho heard a rumor from a blue jay passing through Franconia Notch: someone had traded 10,000 bitcoins for two pizzas. 'That's crazy!' he thought, nearly choking on a wild blueberry. But was it? Those pizzas proved Bitcoin had real value — people would actually exchange goods for it. Nacho realized this wasn't just internet magic beans. It was the beginning of price discovery. He thought about all the acorns he'd traded with the squirrels over the years — weren't those his first 'transactions' too? Every great journey starts with a single trade, and Bitcoin's started with pepperoni and cheese." },
        { title: "Chapter 3: Down the Rabbit Hole", text: "Nacho found a weathered copy of the whitepaper pinned to a bulletin board at a general store in Lincoln, New Hampshire. Only 9 pages, but each one hit different. Peer-to-peer. No trusted third party. Proof of work. 21 million cap. He read it by the light of a campfire near the Kancamagus Highway, the stars of the Granite State blazing overhead. The deeper he went, the more he understood: Bitcoin wasn't just new money. It was a paradigm shift. Sound money that couldn't be debased. A monetary network with no CEO, no headquarters, no off switch. Nacho's antlers tingled — literally. His first set was coming in. He was growing up, and he was becoming a Bitcoiner." },
        { title: "Chapter 4: HODL Through the Storm", text: "A nor'easter hit New Hampshire that winter, and the price of Bitcoin crashed right along with the temperature. Then crashed again. Nacho watched his sats lose 80% of their dollar value from a snow-covered ridge overlooking the Presidential Range. His forest friends laughed. 'Told you it was a scam!' chirped a skeptical chickadee. But Nacho had done his homework. He understood the halving cycles. He knew that every 210,000 blocks, the new supply gets cut in half. Scarcity + time = value. So Nacho did what legends do: he stood firm in the blizzard and held. Not because he was reckless, but because he understood what he held. The storms always pass. The mountains remain." },
        { title: "Chapter 5: Not Your Keys, Not Your Cheese", text: "One crisp autumn morning, as the New Hampshire maples blazed orange and gold, Nacho woke up to terrible news. An exchange had been hacked. Billions gone. Friends who kept their bitcoin on the exchange lost everything. A young doe from Vermont had her entire savings wiped out. Nacho felt sick — but also relieved. He'd moved his sats to a hardware wallet weeks ago, buried it in a waterproof case near his favorite granite boulder in the White Mountains. Cold storage. Air-gapped. His keys, his bitcoin. From that day forward, Nacho's motto was clear: 'Not your keys, not your cheese.' 🧀🔑 He even carved it into a birch tree so no deer would forget." },
        { title: "Chapter 6: The Halving", text: "Every four years, something magical happens — and Nacho had the perfect view from Mount Washington's summit. The block reward — the number of new bitcoins created with each block — gets cut in half. He watched the countdown with a group of bitcoiners who'd hiked up for the occasion, huddled together at 6,288 feet with thermoses of coffee and Lightning-powered phones. From 6.25 BTC to 3.125 BTC per block. Less new supply entering the market. Same or growing demand. The wind howled, but nobody cared. It's not magic; it's math. And it's the most predictable monetary policy in the history of money. Nacho shed a single tear — which immediately froze to his fur." },
        { title: "Chapter 7: Nacho's Mission", text: "Nacho looked out from his favorite overlook in the White Mountains — the same spot where he'd first read the whitepaper by campfire light. He'd grown from a gangly fawn into a strong buck with a magnificent rack of antlers (seven points, if you're counting). But so many deer — so many people — still didn't understand Bitcoin. They heard 'crypto' and thought of scams, memecoins, and celebrity tokens. But Bitcoin is different. It's the signal in the noise. So Nacho decided to dedicate his life to education, right here from the Live Free or Die state. Not shilling. Not pumping. Teaching. Because the best way to orange-pill someone isn't to tell them to buy — it's to help them understand WHY. And that's why you're here. Welcome to the Archive. 🦌🟠" }
    ];

    var today = new Date().toISOString().split('T')[0];

    // ===== PROGRESS SYSTEM =====
    // unlockDays: array of dates (YYYY-MM-DD) when the user opened the story
    // Each unique day in unlockDays unlocks 1 chapter (day 1 = ch1, day 2 = ch2, etc.)
    var unlockDays = safeJSON('btc_nacho_story_days', []);

    // If first ever visit, record today as day 1
    if (unlockDays.length === 0) {
        unlockDays.push(today);
        localStorage.setItem('btc_nacho_story_days', JSON.stringify(unlockDays));
    } else if (unlockDays.indexOf(today) === -1) {
        // New calendar day — add it (unlocks next chapter)
        unlockDays.push(today);
        localStorage.setItem('btc_nacho_story_days', JSON.stringify(unlockDays));
    }

    // Number of chapters unlocked = number of unique days visited (capped at total chapters)
    var chaptersUnlocked = Math.min(unlockDays.length, CHAPTERS.length);

    // Sync to Firebase
    if (typeof db !== 'undefined' && typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) {
        try { db.collection('users').doc(auth.currentUser.uid).update({
            nachoStoryProgress: chaptersUnlocked,
            nachoStoryDate: today,
            nachoStoryDays: unlockDays
        }).catch(function(){}); } catch(e) {}
    }

    // Also keep legacy key in sync for any code that reads it
    localStorage.setItem('btc_nacho_story_highest', chaptersUnlocked.toString());
    localStorage.setItem('btc_nacho_story_date', today);

    // ===== DETERMINE WHICH CHAPTER TO SHOW =====
    var chIdx;
    if (typeof chapterOverride === 'number') {
        // User clicked a specific chapter pill — only allow if unlocked
        chIdx = Math.min(chapterOverride, chaptersUnlocked - 1);
        if (chIdx < 0) chIdx = 0;
    } else {
        // Default: show the latest unlocked chapter
        chIdx = chaptersUnlocked - 1;
        if (chIdx < 0) chIdx = 0;
    }

    var ch = CHAPTERS[chIdx];

    var overlay = document.createElement('div');
    overlay.id = 'nachoStoryOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,0.95);display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;-webkit-overflow-scrolling:touch;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    // Build chapter selector pills
    var pillsHtml = '<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:16px;">';
    for (var i = 0; i < CHAPTERS.length; i++) {
        var unlocked = i < chaptersUnlocked;
        var isCurrent = i === chIdx;
        if (unlocked) {
            pillsHtml += '<button onclick="event.stopPropagation();document.getElementById(\'nachoStoryOverlay\').remove();showNachoStory(' + i + ')" style="width:32px;height:32px;border-radius:50%;border:' + (isCurrent ? '2px solid #f7931a' : '1px solid var(--border,#333)') + ';background:' + (isCurrent ? '#f7931a' : 'var(--card-bg,#1a1a2e)') + ';color:' + (isCurrent ? '#000' : 'var(--text,#e2e8f0)') + ';font-size:0.75rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;">' + (i + 1) + '</button>';
        } else {
            pillsHtml += '<button disabled style="width:32px;height:32px;border-radius:50%;border:1px solid var(--border,#222);background:var(--bg-side,#0a0a1a);color:var(--text-faint,#333);font-size:0.75rem;font-weight:700;cursor:not-allowed;display:flex;align-items:center;justify-content:center;opacity:0.4;">🔒</button>';
        }
    }
    pillsHtml += '</div>';

    // Nav buttons — only navigate to unlocked chapters
    var prevBtn = chIdx > 0 ? '<button onclick="event.stopPropagation();document.getElementById(\'nachoStoryOverlay\').remove();showNachoStory(' + (chIdx - 1) + ')" style="padding:8px 16px;background:var(--card-bg,#1a1a2e);border:1px solid var(--border,#333);border-radius:8px;color:var(--text,#e2e8f0);font-size:0.85rem;cursor:pointer;font-weight:600;">← Prev</button>' : '<span></span>';
    var nextBtn;
    if (chIdx + 1 < chaptersUnlocked && chIdx < CHAPTERS.length - 1) {
        // Next chapter is unlocked
        nextBtn = '<button onclick="event.stopPropagation();document.getElementById(\'nachoStoryOverlay\').remove();showNachoStory(' + (chIdx + 1) + ')" style="padding:8px 16px;background:#f7931a;border:none;border-radius:8px;color:#000;font-size:0.85rem;cursor:pointer;font-weight:700;">Next →</button>';
    } else if (chIdx >= CHAPTERS.length - 1) {
        nextBtn = '<span style="color:#22c55e;font-size:0.8rem;">✅ Story Complete!</span>';
    } else {
        nextBtn = '<span style="color:var(--text-faint,#475569);font-size:0.8rem;">🔒 Come back tomorrow!</span>';
    }

    var card = document.createElement('div');
    card.style.cssText = 'background:#1a1a2e;border:1px solid #f7931a;border-radius:16px;padding:28px;max-width:500px;width:100%;margin:40px auto;color:#e2e8f0;font-family:inherit;';
    card.innerHTML = '<div style="text-align:center;margin-bottom:12px;"><span style="font-size:2.5rem;">🦌📖</span></div>' +
        pillsHtml +
        '<h2 style="color:#f7931a;margin:0 0 12px;font-size:1.2rem;">' + ch.title + '</h2>' +
        '<p style="line-height:1.8;font-size:0.95rem;margin:0 0 16px;color:#e2e8f0;">' + ch.text + '</p>' +
        '<div style="text-align:center;color:var(--text-muted,#94a3b8);font-size:0.8rem;margin-bottom:16px;">📖 Chapter ' + (chIdx + 1) + ' of ' + CHAPTERS.length + ' · ' + chaptersUnlocked + ' unlocked (' + (CHAPTERS.length - chaptersUnlocked) + ' remaining)</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' + prevBtn + nextBtn + '</div>' +
        '<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="display:block;width:100%;margin-top:8px;background:none;border:1px solid var(--border,#333);color:var(--text-muted,#94a3b8);padding:10px;border-radius:8px;cursor:pointer;font-size:0.85rem;">Close</button>';
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Award points for each chapter (first time only per chapter)
    var awardedChapters = safeJSON('btc_nacho_story_awarded', []);
    if (typeof awardPoints === 'function' && awardedChapters.indexOf(chIdx) === -1) {
        awardedChapters.push(chIdx);
        localStorage.setItem('btc_nacho_story_awarded', JSON.stringify(awardedChapters));
        var _chPts = (chIdx === CHAPTERS.length - 1) ? 50 : 15; // Last chapter = 50pts, others = 15pts
        awardPoints(_chPts, '📖 Completed Chapter ' + (chIdx + 1));
        if (typeof showToast === 'function') showToast('📖 +' + _chPts + ' XP — Chapter ' + (chIdx + 1) + ' complete!');

        // Check if ALL 7 chapters are now completed
        if (awardedChapters.length === CHAPTERS.length) {
            setTimeout(function() {
                // Big completion bonus
                awardPoints(100, '📖🎉 Completed Nacho\'s Story!');
                // Award 25 orange tickets
                if (typeof awardOrangeTickets === 'function') {
                    awardOrangeTickets(25, '📖 Nacho\'s Story Complete!');
                } else {
                    var _tix = parseInt(localStorage.getItem('btc_orange_tickets') || '0');
                    localStorage.setItem('btc_orange_tickets', (_tix + 25).toString());
                }
                if (typeof launchConfetti === 'function') launchConfetti();
                if (typeof playBadgeSound === 'function') playBadgeSound();
                // Full-screen celebration overlay
                var _celeb = document.createElement('div');
                _celeb.style.cssText = 'position:fixed;inset:0;z-index:100020;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeSlideIn 0.5s ease-out;';
                _celeb.onclick = function() { _celeb.style.opacity = '0'; _celeb.style.transition = 'opacity 0.4s'; setTimeout(function() { _celeb.remove(); }, 400); };
                _celeb.innerHTML = '<div style="text-align:center;max-width:380px;width:100%;animation:fadeSlideIn 0.6s ease-out;">' +
                    '<div style="font-size:4rem;margin-bottom:16px;animation:nachoModeBounce 1.5s ease-in-out infinite;">🦌📖🎉</div>' +
                    '<div style="font-size:1.8rem;font-weight:900;color:#f7931a;margin-bottom:8px;text-shadow:0 0 30px rgba(247,147,26,0.5);">STORY COMPLETE!</div>' +
                    '<div style="font-size:1rem;color:#e2e8f0;margin-bottom:20px;line-height:1.6;">You\'ve followed Nacho\'s entire Bitcoin journey from the Genesis Block to his mission of education. You\'re officially a Story Master! 🏆</div>' +
                    '<div style="display:flex;justify-content:center;gap:20px;margin-bottom:24px;">' +
                    '<div style="text-align:center;"><div style="font-size:2rem;font-weight:900;color:#22c55e;">+100</div><div style="font-size:0.7rem;color:#94a3b8;">BONUS PTS</div></div>' +
                    '<div style="text-align:center;"><div style="font-size:2rem;font-weight:900;color:#f7931a;">+25</div><div style="font-size:0.7rem;color:#94a3b8;">🎟️ TICKETS</div></div>' +
                    '</div>' +
                    '<button onclick="event.stopPropagation();this.closest(\'div[style*=fixed]\').remove()" style="padding:14px 40px;background:linear-gradient(135deg,#f7931a,#ea580c);color:#fff;border:none;border-radius:14px;font-size:1.1rem;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 8px 30px rgba(247,147,26,0.4);">Amazing! 🎉</button>' +
                    '</div>';
                document.body.appendChild(_celeb);
                // Second confetti after a beat
                setTimeout(function() { if (typeof launchConfetti === 'function') launchConfetti(); }, 1200);
                // Sync to Firebase
                if (typeof db !== 'undefined' && typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) {
                    try { db.collection('users').doc(auth.currentUser.uid).update({
                        nachoStoryComplete: true,
                        nachoStoryCompletedAt: new Date().toISOString()
                    }).catch(function(){}); } catch(e) {}
                }
            }, 800);
        }
    }
};

// ---- Price Prediction Game ----
window.showPricePrediction = function() {
    var currentPrice = parseFloat(localStorage.getItem('btc_last_price')) || 0;
    // Try multiple sources if localStorage is empty
    if (!currentPrice && typeof _lastWsPrice !== 'undefined' && _lastWsPrice) { currentPrice = _lastWsPrice; localStorage.setItem('btc_last_price', currentPrice.toString()); }
    if (!currentPrice && typeof _dashData !== 'undefined' && _dashData && _dashData.price) { currentPrice = _dashData.price; localStorage.setItem('btc_last_price', currentPrice.toString()); }
    if (!currentPrice) {
        // Quick fetch as last resort
        if (typeof showToast === 'function') showToast('⏳ Fetching price...');
        fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd')
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (d && d.bitcoin && d.bitcoin.usd) {
                    localStorage.setItem('btc_last_price', d.bitcoin.usd.toString());
                    showPricePrediction(); // retry
                } else { if (typeof showToast === 'function') showToast('⚠️ Could not load price. Try opening the dashboard first.'); }
            }).catch(function() { if (typeof showToast === 'function') showToast('⚠️ Could not load price. Try opening the dashboard first.'); });
        return;
    }

    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,0.95);display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;-webkit-overflow-scrolling:touch;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    // Check for existing prediction
    var saved = safeJSON('btc_price_prediction', null);
    var card = document.createElement('div');
    card.style.cssText = 'background:var(--card-bg,#1a1a2e);border:1px solid #f7931a;border-radius:16px;padding:28px;max-width:420px;width:100%;color:var(--text,#e2e8f0);font-family:inherit;text-align:center;';

    if (saved && Date.now() - saved.time < 86400000) {
        var _elapsed = Date.now() - saved.time;
        var _ready = _elapsed >= 86400000; // 24h passed?

        if (!_ready) {
            // Prediction pending — show waiting state
            var _hoursLeft = Math.ceil((86400000 - _elapsed) / 3600000);
            card.innerHTML = '<span style="font-size:2.5rem;">⏳</span>' +
                '<h2 style="color:#f7931a;margin:12px 0 8px;">Prediction Locked In!</h2>' +
                '<p>You predicted <b style="color:' + (saved.direction === 'up' ? '#22c55e' : '#ef4444') + '">' + (saved.direction === 'up' ? '📈 UP' : '📉 DOWN') + '</b></p>' +
                '<p>Price when predicted: <b>$' + Math.round(saved.price).toLocaleString() + '</b></p>' +
                '<p>Current price: <b>$' + Math.round(currentPrice).toLocaleString() + '</b></p>' +
                '<div style="margin-top:16px;padding:12px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.2);border-radius:10px;">' +
                    '<div style="font-size:0.85rem;color:var(--accent);font-weight:700;">⏳ Results in ~' + _hoursLeft + ' hour' + (_hoursLeft !== 1 ? 's' : '') + '</div>' +
                    '<div style="font-size:0.75rem;color:var(--text-muted,#94a3b8);margin-top:4px;">Come back after 24 hours to see if you were right!</div>' +
                '</div>' +
                '<div id="globalPredStatsResult" style="margin-top:12px;padding:10px;background:rgba(247,147,26,0.06);border:1px solid rgba(247,147,26,0.15);border-radius:10px;font-size:0.75rem;color:var(--text-muted,#94a3b8);">Loading community stats...</div>' +
                '<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="margin-top:12px;background:#f7931a;color:#000;border:none;padding:10px 28px;border-radius:8px;font-weight:700;cursor:pointer;">Close</button>';

            // Load global stats
            setTimeout(function() {
                if (typeof getGlobalPredictionStats === 'function') {
                    getGlobalPredictionStats(function(stats) {
                        var el = document.getElementById('globalPredStatsResult');
                        if (!el) return;
                        if (!stats || !stats.total) { el.innerHTML = '🌍 No community data yet.'; return; }
                        var pct = Math.round((stats.correct / stats.total) * 100);
                        el.innerHTML = '🌍 <strong>Community:</strong> ' + (stats.correct || 0) + '/' + stats.total + ' correct (' + pct + '% accuracy)';
                    });
                }
            }, 500);

            overlay.appendChild(card);
            document.body.appendChild(overlay);
            return;
        }

        // 24h passed — show result
        var diff = currentPrice - saved.price;
        var pct = ((diff / saved.price) * 100).toFixed(2);
        var correct = (saved.direction === 'up' && diff > 0) || (saved.direction === 'down' && diff < 0);
        // Notify user of prediction result (once per prediction)
        if (!saved._notified) {
            if (typeof notifyPredictionResult === 'function') notifyPredictionResult(correct, saved.direction);
            saved._notified = true;
            localStorage.setItem('btc_price_prediction', JSON.stringify(saved));
        }
        var streak = parseInt(localStorage.getItem('btc_predict_streak') || '0');
        card.innerHTML = '<span style="font-size:2.5rem;">' + (correct ? '🎉' : '😅') + '</span>' +
            '<h2 style="color:#f7931a;margin:12px 0 8px;">Your Prediction</h2>' +
            '<p>You predicted <b style="color:' + (saved.direction === 'up' ? '#22c55e' : '#ef4444') + '">' + (saved.direction === 'up' ? '📈 UP' : '📉 DOWN') + '</b></p>' +
            '<p>Price when predicted: <b>$' + Math.round(saved.price).toLocaleString() + '</b></p>' +
            '<p>Current price: <b>$' + Math.round(currentPrice).toLocaleString() + '</b> (' + (diff >= 0 ? '+' : '') + pct + '%)</p>' +
            '<p style="font-size:1.2rem;margin-top:12px;">' + (correct ? '✅ You were RIGHT! +25 XP' : '❌ Not this time!') + '</p>' +
            (correct && streak >= 2 ? '<p style="font-size:0.9rem;color:#f7931a;">🔥 ' + streak + ' correct in a row!</p>' : '') +
            '<div style="margin-top:16px;font-size:0.8rem;color:var(--text-muted,#94a3b8);">Come back tomorrow for a new prediction!</div>' +
            '<div id="globalPredStatsResult" style="margin-top:12px;padding:10px;background:rgba(247,147,26,0.06);border:1px solid rgba(247,147,26,0.15);border-radius:10px;font-size:0.75rem;color:var(--text-muted,#94a3b8);">Loading community stats...</div>' +
            '<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="margin-top:12px;background:#f7931a;color:#000;border:none;padding:10px 28px;border-radius:8px;font-weight:700;cursor:pointer;">Close</button>';

        // Load global stats on result screen
        setTimeout(function() {
            if (typeof getGlobalPredictionStats === 'function') {
                getGlobalPredictionStats(function(stats) {
                    var el = document.getElementById('globalPredStatsResult');
                    if (!el) return;
                    if (!stats || !stats.total) { el.innerHTML = '🌍 No community data yet.'; return; }
                    var pct = Math.round((stats.correct / stats.total) * 100);
                    el.innerHTML = '🌍 <strong>Community:</strong> ' + (stats.correct || 0) + '/' + stats.total + ' correct (' + pct + '% accuracy)';
                });
            }
        }, 100);
    } else {
        // New prediction
        card.innerHTML = '<span style="font-size:2.5rem;">📈📉</span>' +
            '<h2 style="color:#f7931a;margin:12px 0 8px;">Predict Bitcoin\'s Price</h2>' +
            '<p style="margin:0 0 4px;">Current BTC Price:</p>' +
            '<p style="font-size:1.8rem;font-weight:900;color:#f7931a;margin:4px 0 16px;">$' + Math.round(currentPrice).toLocaleString() + '</p>' +
            '<p style="margin-bottom:16px;">Will Bitcoin go <b>UP</b> or <b>DOWN</b> in the next 24 hours?</p>' +
            '<div style="display:flex;gap:12px;justify-content:center;">' +
                '<button onclick="window._savePrediction(\'up\');this.closest(\'div[style*=fixed]\').remove()" style="background:#22c55e;color:#fff;border:none;padding:14px 32px;border-radius:10px;font-weight:700;cursor:pointer;font-size:1.1rem;">📈 UP</button>' +
                '<button onclick="window._savePrediction(\'down\');this.closest(\'div[style*=fixed]\').remove()" style="background:#ef4444;color:#fff;border:none;padding:14px 32px;border-radius:10px;font-weight:700;cursor:pointer;font-size:1.1rem;">📉 DOWN</button>' +
            '</div>' +
            '<div id="globalPredStats" style="margin-top:16px;padding:10px;background:rgba(247,147,26,0.06);border:1px solid rgba(247,147,26,0.15);border-radius:10px;font-size:0.75rem;color:var(--text-muted,#94a3b8);">Loading community stats...</div>';

        // Load global stats
        setTimeout(function() {
            if (typeof getGlobalPredictionStats === 'function') {
                getGlobalPredictionStats(function(stats) {
                    var el = document.getElementById('globalPredStats');
                    if (!el) return;
                    if (!stats || !stats.total) {
                        el.innerHTML = '🌍 Be the first to predict!';
                        return;
                    }
                    var pct = Math.round((stats.correct / stats.total) * 100);
                    el.innerHTML = '🌍 <strong>Community:</strong> ' + (stats.correct || 0) + '/' + stats.total + ' correct (' + pct + '% accuracy)';
                });
            }
        }, 100);
    }

    overlay.appendChild(card);
    document.body.appendChild(overlay);
};

window._savePrediction = function(direction) {
    var price = parseFloat(localStorage.getItem('btc_last_price')) || 0;
    var prediction = { direction: direction, price: price, time: Date.now(), resolved: false };
    localStorage.setItem('btc_price_prediction', JSON.stringify(prediction));
    if (typeof showToast === 'function') showToast('🎯 Prediction saved! Check back tomorrow to see if you were right.');
    // Award points for making a prediction
    if (typeof awardPoints === 'function') awardPoints(5, '📈 Price prediction made');
    // Combo tracking
    if (typeof window._trackCombo === 'function') window._trackCombo('prediction');
    // Daily challenge tracking: prediction made today
    (function(){ var d=new Date(); var dk=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); localStorage.setItem('btc_pred_made_'+dk,'1'); })();
    // Sync to Firestore
    _syncPredictionToFirestore(prediction);
};

// ---- Check prediction result on login/load ----
window.checkPredictionResult = function() {
    var saved = safeJSON('btc_price_prediction', null);
    if (!saved || saved.resolved) return;
    // Only check after 24 hours have passed (prediction window)
    if (Date.now() - saved.time < 24 * 60 * 60 * 1000) return;
    var currentPrice = parseFloat(localStorage.getItem('btc_last_price')) || 0;
    if (!currentPrice || !saved.price) return;

    var diff = currentPrice - saved.price;
    var pct = ((diff / saved.price) * 100).toFixed(2);
    var correct = (saved.direction === 'up' && diff > 0) || (saved.direction === 'down' && diff < 0);

    // Mark as resolved so we don't check again
    saved.resolved = true;
    saved.result = correct ? 'correct' : 'wrong';
    saved.finalPrice = currentPrice;
    localStorage.setItem('btc_price_prediction', JSON.stringify(saved));

    // Update prediction stats in Firestore
    _updatePredictionStats(correct);

    // Mark as resolved in active_predictions (so Cloud Function doesn't double-count)
    try {
        if (typeof auth !== 'undefined' && auth.currentUser && typeof db !== 'undefined') {
            db.collection('active_predictions').doc(auth.currentUser.uid).delete().catch(function() {});
        }
    } catch(e) {}

    // Award bonus XP for correct prediction
    if (correct) {
        if (typeof awardPoints === 'function') awardPoints(25, '🎯 Correct price prediction!');
        // Track streak
        var streak = parseInt(localStorage.getItem('btc_predict_streak') || '0') + 1;
        localStorage.setItem('btc_predict_streak', streak.toString());
        setTimeout(function() {
            if (typeof showToast === 'function') {
                showToast('🎉 Your prediction was RIGHT! Bitcoin went ' + (diff > 0 ? 'UP' : 'DOWN') + ' ' + (diff > 0 ? '+' : '') + pct + '% — +25 XP!' + (streak >= 3 ? ' 🔥 ' + streak + ' correct in a row!' : ''));
            }
        }, 2000);
    } else {
        // Reset streak
        localStorage.setItem('btc_predict_streak', '0');
        setTimeout(function() {
            if (typeof showToast === 'function') {
                showToast('📉 Your prediction was wrong — Bitcoin went ' + (diff > 0 ? 'UP' : 'DOWN') + ' ' + (diff > 0 ? '+' : '') + pct + '%. Try again tomorrow!');
            }
        }, 2000);
    }
};

// ---- Prediction Stats Firestore Sync ----
function _syncPredictionToFirestore(prediction) {
    try {
        if (typeof auth === 'undefined' || !auth.currentUser || auth.currentUser.isAnonymous) return;
        if (typeof db === 'undefined') return;
        var uid = auth.currentUser.uid;
        db.collection('users').doc(uid).set({
            predictions: {
                lastPrediction: {
                    direction: prediction.direction,
                    price: prediction.price,
                    time: prediction.time
                }
            }
        }, { merge: true }).catch(function() {});

        // Save to active_predictions collection for server-side resolution
        db.collection('active_predictions').doc(uid).set({
            uid: uid,
            direction: prediction.direction,
            price: prediction.price,
            time: prediction.time,
            resolved: false
        }).catch(function() {});
    } catch(e) {}
}

function _updatePredictionStats(correct) {
    try {
        if (typeof auth === 'undefined' || !auth.currentUser || auth.currentUser.isAnonymous) return;
        if (typeof db === 'undefined' || typeof firebase === 'undefined') return;
        var uid = auth.currentUser.uid;
        var inc = firebase.firestore.FieldValue.increment;
        var streak = parseInt(localStorage.getItem('btc_predict_streak') || '0');
        var bestStreak = parseInt(localStorage.getItem('btc_predict_best_streak') || '0');

        var updateData = {
            'predictions.total': inc(1),
            'predictions.lastResolved': Date.now()
        };
        if (correct) {
            updateData['predictions.correct'] = inc(1);
            var newStreak = streak + 1;
            updateData['predictions.streak'] = newStreak;
            if (newStreak > bestStreak) {
                updateData['predictions.bestStreak'] = newStreak;
                localStorage.setItem('btc_predict_best_streak', newStreak.toString());
            }
        } else {
            updateData['predictions.streak'] = 0;
        }

        db.collection('users').doc(uid).set(updateData, { merge: true }).catch(function() {});

        // Update global prediction stats
        var globalUpdate = { total: inc(1) };
        if (correct) globalUpdate.correct = inc(1);
        db.collection('stats').doc('predictions').set(globalUpdate, { merge: true }).catch(function() {});

        // Also update local currentUser for immediate display
        if (typeof currentUser !== 'undefined' && currentUser) {
            if (!currentUser.predictions) currentUser.predictions = { total: 0, correct: 0, streak: 0, bestStreak: 0 };
            currentUser.predictions.total = (currentUser.predictions.total || 0) + 1;
            if (correct) {
                currentUser.predictions.correct = (currentUser.predictions.correct || 0) + 1;
                currentUser.predictions.streak = (currentUser.predictions.streak || 0) + 1;
                if (currentUser.predictions.streak > (currentUser.predictions.bestStreak || 0)) {
                    currentUser.predictions.bestStreak = currentUser.predictions.streak;
                }
            } else {
                currentUser.predictions.streak = 0;
            }
        }
    } catch(e) {}
}

// Cache global prediction stats
var _globalPredCache = null;
var _globalPredCacheTs = 0;

window.getGlobalPredictionStats = function(callback) {
    // Cache for 2 minutes
    if (_globalPredCache && Date.now() - _globalPredCacheTs < 120000) {
        callback(_globalPredCache);
        return;
    }
    if (typeof db === 'undefined' || typeof firebase === 'undefined') { callback(null); return; }
    try {
        db.collection('stats').doc('predictions').get().then(function(doc) {
            if (doc.exists) {
                _globalPredCache = doc.data();
                _globalPredCacheTs = Date.now();
                callback(_globalPredCache);
            } else {
                callback(null);
            }
        }).catch(function() { callback(null); });
    } catch(e) { callback(null); }
};

// Get prediction stats (for profile display)
window.getPredictionStats = function(user) {
    var stats = (user && user.predictions) ? user.predictions : null;
    if (!stats || !stats.total) return null;
    var pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    return {
        total: stats.total || 0,
        correct: stats.correct || 0,
        percentage: pct,
        streak: stats.streak || 0,
        bestStreak: stats.bestStreak || 0
    };
};

// ---- COMMUNITY STATS BAR ----
var _communityStatsCache = null;
var _communityStatsCacheTs = 0;

var _communityStatsUnsub = null;
window.loadCommunityStats = function() {
    var el = document.getElementById('communityStatsInner');
    if (!el) return;
    var wrap = el.parentElement;

    // If already listening in real-time, just render cached
    if (_communityStatsUnsub && _communityStatsCache) {
        _renderCommunityStats(el, wrap, _communityStatsCache);
        return;
    }

    if (typeof db === 'undefined' || typeof firebase === 'undefined') return;
    try {
        // Real-time listener — stats update live
        _communityStatsUnsub = db.collection('stats').doc('global').onSnapshot(function(doc) {
            var data = doc.exists ? doc.data() : {};
            _communityStatsCache = data;
            _communityStatsCacheTs = Date.now();
            var el2 = document.getElementById('communityStatsInner');
            if (el2) _renderCommunityStats(el2, el2.parentElement, data);
        });
    } catch(e) {}
};

function _renderCommunityStats(el, wrap, data) {
    var items = [];
    if (data.channelVisits) items.push('📖 <strong>' + _fmtNum(data.channelVisits) + '</strong> channel reads');
    if (data.questsCompleted) items.push('⚡ <strong>' + _fmtNum(data.questsCompleted) + '</strong> quests completed');
    if (data.chatMessages) items.push('💬 <strong>' + _fmtNum(data.chatMessages) + '</strong> chat messages');
    if (data.spins) items.push('🎡 <strong>' + _fmtNum(data.spins) + '</strong> daily spins');
    if (data.pvpMatches) items.push('⚔️ <strong>' + _fmtNum(data.pvpMatches) + '</strong> PVP battles');
    var visitEl = document.getElementById('visitCount');
    if (visitEl && visitEl.textContent !== '—') items.push('👥 <strong>' + visitEl.textContent + '</strong> total visits');
    if (data.userCount) items.push('🧑‍🤝‍🧑 <strong>' + _fmtNum(data.userCount) + '</strong> registered users');
    if (data.watchTimeMinutes) { var hrs = Math.floor(data.watchTimeMinutes / 60); items.push('📺 <strong>' + (hrs > 0 ? _fmtNum(hrs) + ' hours' : data.watchTimeMinutes + ' min') + '</strong> Timechain TV watched'); }
    if (items.length === 0) { el.innerHTML = 'No stats yet'; return; }
    el.innerHTML = items.join(' &nbsp;·&nbsp; ');

    // Also populate the home panel stats
    var _set = function(id, val) { var e = document.getElementById(id); if (e && val) e.textContent = val.toLocaleString(); };
    _set('csChannelReads', data.channelVisits);
    _set('csQuests', data.questsCompleted);
    _set('csChatMsgs', data.chatMessages);
    _set('csSpins', data.spins);
    _set('csPvp', data.pvpMatches);
    _set('csUsers', data.userCount);
    if (data.watchTimeMinutes) { var wh = Math.floor(data.watchTimeMinutes / 60); _set('csWatchTime', wh > 0 ? wh : data.watchTimeMinutes); }
}

function _fmtNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toLocaleString();
}

// Load on init
setTimeout(function() { if (typeof loadCommunityStats === 'function') loadCommunityStats(); }, 5000);

// Prediction accuracy label — reusable, re-triggerable, no fragile fixed timeout.
// Populates 🌍 community accuracy + 👤 user accuracy on the Predict Price home button.
window.updatePredictionLabel = function() {
    var el = document.getElementById('predAccuracyLabel');
    if (!el) return false;
    // Firestore not ready yet — retry shortly
    if (typeof db === 'undefined' || typeof firebase === 'undefined' || typeof getGlobalPredictionStats !== 'function') {
        return false;
    }
    getGlobalPredictionStats(function(stats) {
        var lines = [];
        if (stats && stats.total) {
            var pct = Math.round((stats.correct / stats.total) * 100);
            lines.push('🌍 ' + pct + '% community accuracy');
        }
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.predictions && currentUser.predictions.total) {
            var uPct = Math.round((currentUser.predictions.correct / currentUser.predictions.total) * 100);
            lines.push('👤 ' + uPct + '% you');
        }
        el.innerHTML = lines.join('<br>');
    });
    return true;
};

// Boot: keep retrying until element is in DOM AND Firestore is ready, then stop.
(function _bootPredictionLabel() {
    var tries = 0;
    var interval = setInterval(function() {
        tries++;
        if (window.updatePredictionLabel && window.updatePredictionLabel()) {
            clearInterval(interval);
        } else if (tries > 60) { // ~60s max
            clearInterval(interval);
        }
    }, 1000);
})();

// Re-run whenever the user returns home (mobile users hit home repeatedly).
(function _hookGoHome() {
    if (typeof window.goHome !== 'function') {
        // goHome may load later; wait for it
        var w = setInterval(function() {
            if (typeof window.goHome === 'function') {
                clearInterval(w);
                _hookGoHome();
            }
        }, 500);
        return;
    }
    if (window.goHome.__predHooked) return;
    var _orig = window.goHome;
    window.goHome = function() {
        var r = _orig.apply(this, arguments);
        setTimeout(function() { if (window.updatePredictionLabel) window.updatePredictionLabel(); }, 400);
        return r;
    };
    window.goHome.__predHooked = true;
})();

// ---- EXPLORATION MAP ----
function renderExplorationMap() {
    var el = document.getElementById('explorationMap');
    if (!el) return;
    if (typeof CHANNELS === 'undefined') return;

    // Use Firestore data if available, fall back to localStorage
    var visited = safeJSON('btc_visited_channels', []);
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.readChannels && currentUser.readChannels.length > visited.length) {
        visited = currentUser.readChannels;
    }
    var allKeys = Object.keys(CHANNELS);
    var total = allKeys.length;
    var count = visited.length;
    var pct = Math.round((count / total) * 100);

    var grid = '';
    allKeys.forEach(function(key) {
        var isVisited = visited.indexOf(key) !== -1;
        var titleMatch = CHANNELS[key].title.match(/^([\u{1F000}-\u{1FFFF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}|\u{FE00}-\u{FEFF}|\u{1F900}-\u{1F9FF}|\u{1FA00}-\u{1FA6F}|\u{1FA70}-\u{1FAFF}|\u{200D}|\u{FE0F}]+)/u);
        var icon = titleMatch ? titleMatch[1] : '📄';
        grid += '<div onclick="go(\'' + key + '\')" ' + (isVisited ? 'title="' + CHANNELS[key].title.replace(/"/g, '') + '"' : '') + ' style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:6px;font-size:0.75rem;cursor:pointer;transition:0.2s;' +
            (isVisited ? 'background:rgba(247,147,26,0.15);border:1px solid rgba(247,147,26,0.3);' : 'background:var(--card-bg);border:1px solid var(--border);opacity:0.4;') +
            '">' + (isVisited ? icon : '?') + '</div>';
    });

    var isOpen = localStorage.getItem('btc_explore_map_open') === 'true';
    el.innerHTML = '<div style="padding:12px 16px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;">' +
        '<div onclick="var g=this.nextElementSibling;var o=g.style.display!==\'none\';g.style.display=o?\'none\':\'block\';this.querySelector(\'.exp-arrow\').textContent=o?\'▸\':\'▾\';localStorage.setItem(\'btc_explore_map_open\',o?\'false\':\'true\')" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none;">' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
                '<span class="exp-arrow" style="color:var(--text-faint);font-size:0.8rem;">' + (isOpen ? '▾' : '▸') + '</span>' +
                '<span style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">🗺️ Exploration Map</span>' +
            '</div>' +
            '<div style="color:var(--accent);font-weight:700;font-size:0.85rem;">' + count + '/' + total + ' (' + pct + '%)</div>' +
        '</div>' +
        '<div style="display:' + (isOpen ? 'block' : 'none') + ';margin-top:12px;">' +
            '<div class="rank-progress" style="margin-bottom:12px;"><div class="rank-progress-fill" style="width:' + pct + '%;"></div></div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:4px;">' + grid + '</div>' +
        '</div>' +
    '</div>';
}
window.renderExplorationMap = renderExplorationMap;

// ---- DAILY BITCOIN QUOTE ----
var BITCOIN_QUOTES = [
    { text: "If you don't believe it or don't get it, I don't have the time to try to convince you, sorry.", author: "Satoshi Nakamoto", channel: 'satoshi-nakamoto' },
    { text: "The root problem with conventional currency is all the trust that's required to make it work.", author: "Satoshi Nakamoto", channel: 'satoshi-nakamoto' },
    { text: "It might make sense just to get some in case it catches on.", author: "Satoshi Nakamoto", channel: 'satoshi-nakamoto' },
    { text: "Running bitcoin.", author: "Hal Finney", channel: 'history' },
    { text: "Bitcoin is a remarkable cryptographic achievement and the ability to create something that is not duplicable in the digital world has enormous value.", author: "Eric Schmidt", channel: 'dominant' },
    { text: "Bitcoin is a technological tour de force.", author: "Bill Gates", channel: 'one-stop-shop' },
    { text: "I think the internet is going to be one of the major forces for reducing the role of government. The one thing that's missing, but that will soon be developed, is a reliable e-cash.", author: "Milton Friedman (1999)", channel: 'videos' },
    { text: "The Times 03/Jan/2009 Chancellor on brink of second bailout for banks.", author: "Bitcoin Genesis Block", channel: 'history' },
    { text: "Not your keys, not your coins.", author: "Bitcoin Proverb", channel: 'self-custody' },
    { text: "Stay humble, stack sats.", author: "Bitcoin Community", channel: 'investment-strategy' },
    { text: "In the long run, hard money is superior to soft money.", author: "Gigi, 21 Lessons", channel: 'articles-threads' },
    { text: "Bitcoin is the first truly digital solution to the problem of money.", author: "Saifedean Ammous", channel: 'books' },
    { text: "Fix the money, fix the world.", author: "Bitcoin Mantra", channel: 'problems-of-money' },
    { text: "The supply of Bitcoin is limited. Period. No central bank is going to come along and print more.", author: "Andreas Antonopoulos", channel: 'scarce' },
    { text: "Everyone is a scammer until proven otherwise. Don't trust, verify.", author: "Bitcoin Culture", channel: 'secure' },
    { text: "Bitcoin makes money great again. It lets you transact freely, save freely, and live freely.", author: "Michael Saylor", channel: 'giga-chad' },
    { text: "There is no second best.", author: "Michael Saylor", channel: 'maximalism' },
    { text: "I don't think there's anything more important in my lifetime to work on.", author: "Jack Dorsey", channel: 'giga-chad' },
    { text: "Bitcoin is the most important invention in the history of the world since the internet.", author: "Roger Ver (before he fell off)", channel: 'history' },
    { text: "The computer can be used as a tool to liberate and protect people, rather than to control them.", author: "Hal Finney", channel: 'cryptography' },
    { text: "One of the greatest things that Satoshi did was disappear.", author: "Gigi, 21 Lessons", channel: 'satoshi-nakamoto' },
    { text: "Bitcoin has no CEO, no marketing department, no headquarters. It has math.", author: "Bitcoin Education Archive", channel: 'decentralized' },
    { text: "We are all Satoshi.", author: "Bitcoin Community", channel: 'satoshi-nakamoto' },
    { text: "Cypherpunks write code.", author: "Eric Hughes", channel: 'cryptography' },
    { text: "Privacy is necessary for an open society in the electronic age.", author: "Eric Hughes, A Cypherpunk's Manifesto", channel: 'privacy-nonkyc' },
    { text: "Money is a tool for trading human time.", author: "Robert Breedlove", channel: 'articles-threads' },
    { text: "Bitcoin is Time.", author: "Gigi", channel: 'time' },
    { text: "The root cause of the housing crisis, student debt crisis, and healthcare crisis is the money crisis.", author: "Saifedean Ammous", channel: 'problems-of-money' },
    { text: "Tick tock, next block.", author: "Bitcoin Community", channel: 'blockchain-timechain' },
    { text: "The difficulty adjustment is the most elegant feature of Bitcoin.", author: "Bitcoin Educators", channel: 'difficulty-adjustment' },
    { text: "Every informed person needs to know about Bitcoin because it might be one of the world's most important developments.", author: "Leon Luow", channel: 'one-stop-shop' },
    { text: "Bitcoin is the only commodity in the world that the more demand there is, the more supply does NOT increase.", author: "Parker Lewis", channel: 'scarce' },
    { text: "Gradually, then suddenly.", author: "Parker Lewis / Ernest Hemingway", channel: 'articles-threads' },
    { text: "You can't stop an idea whose time has come.", author: "Victor Hugo (on Bitcoin)", channel: 'organic' },
    { text: "Bitcoin is a hedge against the entire system.", author: "Lyn Alden", channel: 'investment-strategy' },
    { text: "The question isn't what Bitcoin's price will be. The question is what the dollar's price will be.", author: "Bitcoiners", channel: 'problems-of-money' },
    { text: "I was once told that nobody ever lost money saving in Bitcoin for 4+ years. I checked. It's true.", author: "Anonymous Bitcoiner", channel: 'investment-strategy' },
    { text: "Bitcoin is the exit.", author: "Bitcoin Maximalists", channel: 'maximalism' },
    { text: "Don't trust, verify.", author: "Bitcoin Ethos", channel: 'nodes' },
    { text: "Number go up technology.", author: "Bitcoin Twitter", channel: 'fun-facts' },
    { text: "Energy is the universal currency. Bitcoin makes that literal.", author: "Bitcoin Mining Community", channel: 'energy' },
    { text: "Bitcoin is not an investment — it is a savings technology.", author: "Bitcoin Educators", channel: 'money' },
    { text: "Fiat currency always returns to its intrinsic value — zero.", author: "Voltaire", channel: 'problems-of-money' },
    { text: "Give me control of a nation's money supply, and I care not who makes its laws.", author: "Mayer Amschel Rothschild", channel: 'problems-of-money' },
    { text: "Inflation is taxation without legislation.", author: "Milton Friedman", channel: 'problems-of-money' },
    { text: "Bitcoin is for enemies. That's the whole point.", author: "Bitcoin Community", channel: 'game_theory' },
    { text: "When you understand Bitcoin, you understand everything else differently.", author: "Many Bitcoiners", channel: 'philosophy' },
    { text: "Bitcoin doesn't care about your feelings.", author: "Bitcoin Proverb", channel: 'fun-facts' },
    { text: "Stack sats and stay humble.", author: "Matt Odell", channel: 'investment-strategy' },
    { text: "Number go up because money printer go brr.", author: "Bitcoin Memes", channel: 'memes-funny' },

    // Freedom & Sovereignty
    { text: "Those who would give up essential liberty, to purchase a little temporary safety, deserve neither liberty nor safety.", author: "Benjamin Franklin", channel: 'human_rights__social_justice_and_freedo' },
    { text: "Freedom is never more than one generation away from extinction.", author: "Ronald Reagan", channel: 'human_rights__social_justice_and_freedo' },
    { text: "The only way to deal with an unfree world is to become so absolutely free that your very existence is an act of rebellion.", author: "Albert Camus", channel: 'philosophy' },
    { text: "If the American people ever allow private banks to control the issue of their currency, first by inflation, then by deflation, the banks and corporations that will grow up around them will deprive the people of all property.", author: "Thomas Jefferson", channel: 'problems-of-money' },
    { text: "It is well enough that people of the nation do not understand our banking and monetary system, for if they did, I believe there would be a revolution before tomorrow morning.", author: "Henry Ford", channel: 'problems-of-money' },
    { text: "The most dangerous man to any government is the man who is able to think things out for himself.", author: "H.L. Mencken", channel: 'philosophy' },
    { text: "In a time of deceit, telling the truth is a revolutionary act.", author: "George Orwell", channel: 'philosophy' },
    { text: "The urge to save humanity is almost always a false front for the urge to rule it.", author: "H.L. Mencken", channel: 'philosophy' },
    { text: "A society that puts equality before freedom will get neither. A society that puts freedom before equality will get a high degree of both.", author: "Milton Friedman", channel: 'philosophy' },
    { text: "The state is that great fiction by which everyone tries to live at the expense of everyone else.", author: "Frédéric Bastiat", channel: 'austrian_school_of_economics' },

    // Austrian Economics & Sound Money
    { text: "There is no means of avoiding the final collapse of a boom brought about by credit expansion.", author: "Ludwig von Mises", channel: 'austrian_school_of_economics' },
    { text: "The first panacea for a mismanaged nation is inflation of the currency; the second is war. Both bring a temporary prosperity; both bring a permanent ruin.", author: "Ernest Hemingway", channel: 'problems-of-money' },
    { text: "Gold is money. Everything else is credit.", author: "J.P. Morgan", channel: 'money' },
    { text: "We don't have a trillion-dollar debt because we haven't taxed enough; we have a trillion-dollar debt because we spend too much.", author: "Ronald Reagan", channel: 'problems-of-money' },
    { text: "Government is the only institution that can take a valuable commodity like paper, and make it worthless by applying ink.", author: "Ludwig von Mises", channel: 'problems-of-money' },
    { text: "Whenever destroyers appear among men, they start by destroying money.", author: "Ayn Rand", channel: 'problems-of-money' },
    { text: "The way to crush the bourgeoisie is to grind them between the millstones of taxation and inflation.", author: "Vladimir Lenin", channel: 'problems-of-money' },
    { text: "Savings represent goods produced but not yet consumed. That's what real wealth is — not digits in a bank database.", author: "Saifedean Ammous", channel: 'money' },
    { text: "Civilization is in a race between education and catastrophe. Let us learn the truth and spread it as far and wide as our circumstances allow.", author: "H.G. Wells", channel: 'one-stop-shop' },
    { text: "Paper money eventually returns to its intrinsic value — zero.", author: "Voltaire", channel: 'problems-of-money' },

    // Bitcoin Wisdom
    { text: "Bitcoin is the separation of money and state.", author: "Bitcoin Community", channel: 'maximalism' },
    { text: "Bitcoin is the first money in the history of the world where the supply is entirely unaffected by an increase in demand.", author: "Jeff Booth", channel: 'scarce' },
    { text: "In a world where everything is printed, scarcity is the ultimate feature.", author: "Bitcoin Educators", channel: 'scarce' },
    { text: "Bitcoin is hope for humanity.", author: "Jack Mallers", channel: 'one-stop-shop' },
    { text: "The cost of Bitcoin is measured in electricity. The cost of fiat is measured in human freedom.", author: "Bitcoin Community", channel: 'energy' },
    { text: "Your savings should not be someone else's liability.", author: "Bitcoin Educators", channel: 'self-custody' },
    { text: "Bitcoin is the peaceful protest that cannot be silenced.", author: "Alex Gladstein", channel: 'human_rights__social_justice_and_freedo' },
    { text: "Bitcoin gives us the ability to opt out of a system that was designed to extract value from us.", author: "Many Bitcoiners", channel: 'problems-of-money' },
    { text: "Proof of work means proof of energy. Energy is the one thing that cannot be faked.", author: "Bitcoin Mining Community", channel: 'mining' },
    { text: "The Bitcoin network processes more value per year than Visa. Without a CEO.", author: "Bitcoin Stats", channel: 'decentralized' },
    { text: "If Bitcoin is a bubble, it's the only bubble that reflated itself five times in a row.", author: "Bitcoin Community", channel: 'fun-facts' },
    { text: "Bitcoin has died 474 times according to the media. It's still here.", author: "Bitcoin Obituaries", channel: 'misconceptions-fud' },
    { text: "Your grandchildren will ask you why you didn't buy Bitcoin when it was under six figures.", author: "Bitcoin Twitter", channel: 'predictions' },
    { text: "The next 4 years are going to be very exciting for Bitcoin.", author: "Every Bitcoiner, Every Year", channel: 'fun-facts' },
    { text: "Bitcoin isn't getting more expensive. Your dollars are getting cheaper.", author: "Bitcoin Community", channel: 'problems-of-money' },
    { text: "If you can't hold it, you don't own it. If you didn't earn it, you'll lose it.", author: "Bitcoin Wisdom", channel: 'self-custody' },
    { text: "Think in sats, not dollars.", author: "Bitcoin Community", channel: 'sats__or__bits' },
    { text: "The best time to buy Bitcoin was 10 years ago. The second best time is now.", author: "Bitcoin Proverb", channel: 'investment-strategy' },
    { text: "Work is the transfer of energy over time. Money should measure exactly that.", author: "Jason Lowery", channel: 'energy' },
    { text: "Bitcoin is not anti-government. Bitcoin is anti-fraud.", author: "Bitcoin Educators", channel: 'regulation' },

    // Technology & Cypherpunk
    { text: "We must defend our own privacy if we expect to have any.", author: "Eric Hughes, A Cypherpunk's Manifesto", channel: 'privacy-nonkyc' },
    { text: "Cryptography is the ultimate form of non-violent direct action.", author: "Julian Assange", channel: 'cryptography' },
    { text: "Strong cryptography can resist an unlimited application of violence.", author: "Jacob Appelbaum", channel: 'cryptography' },
    { text: "The Net interprets censorship as damage and routes around it.", author: "John Gilmore", channel: 'privacy-nonkyc' },
    { text: "Bitcoin is a weapon of peace.", author: "Jason Lowery, Softwar", channel: 'geopolitics___macroeconomics' },
    { text: "Running a node means nobody can change the rules on you.", author: "Bitcoin Node Runners", channel: 'nodes' },
    { text: "Hashrate is the heartbeat of Bitcoin. As long as miners mine, Bitcoin lives.", author: "Bitcoin Mining Community", channel: 'mining' },
    { text: "Lightning is what makes Bitcoin usable for 8 billion people.", author: "Lightning Network Community", channel: 'layer-2-lightning' },
    { text: "2,099,999,997,690,000 satoshis. That's all there will ever be.", author: "The Bitcoin Protocol", channel: 'scarce' },
    { text: "Code is speech. Math is law. Cryptography is defense.", author: "Cypherpunks", channel: 'cryptography' },

    // Historical Perspective
    { text: "I predict the Internet will go spectacularly supernova and in 1996 catastrophically collapse.", author: "Robert Metcalfe (1995) — They said this about Bitcoin too", channel: 'misconceptions-fud' },
    { text: "Every generation needs a new revolution.", author: "Thomas Jefferson", channel: 'philosophy' },
    { text: "First they ignore you, then they laugh at you, then they fight you, then you win.", author: "Often attributed to Gandhi", channel: 'organic' },
    { text: "I do not think there is any other quality so essential to success of any kind as the quality of perseverance.", author: "John D. Rockefeller", channel: 'philosophy' },
    { text: "The world is a dangerous place, not because of those who do evil, but because of those who look on and do nothing.", author: "Albert Einstein", channel: 'philosophy' },
    { text: "Hard times create strong men. Strong men create good times. Good times create weak men. Weak men create hard times.", author: "G. Michael Hopf", channel: 'time_preference' },
    { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin", channel: 'one-stop-shop' },
];

window.renderDailyQuote = function() {
    var el = document.getElementById('quoteOfDay');
    if (!el) return;
    // Pick quote based on day of year
    var now = new Date();
    var dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
    var quote = BITCOIN_QUOTES[dayOfYear % BITCOIN_QUOTES.length];
    if (!quote) return;

    el.innerHTML = '<div onclick="if(typeof go===\'function\')go(\'' + (quote.channel || 'one-stop-shop') + '\')" style="padding:16px 20px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;cursor:pointer;transition:border-color 0.2s;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
        '<div style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">💬 Quote of the Day</div>' +
        '<div style="color:var(--text);font-size:0.95rem;font-style:italic;line-height:1.6;margin-bottom:8px;">"' + quote.text + '"</div>' +
        '<div style="color:var(--accent);font-size:0.8rem;font-weight:600;">— ' + quote.author + '</div>' +
    '</div>';
};

// ---- RESTORED MISSING FUNCTIONS ----

// renderReadNext — suggest related channels after reading
window.renderReadNext = function(currentId) {
    if (typeof CHANNELS === 'undefined') return '';
    var current = CHANNELS[currentId];
    if (!current) return '';
    var sameCat = Object.entries(CHANNELS).filter(function(e) { return e[1].cat === current.cat && e[0] !== currentId; });
    if (sameCat.length === 0) return '';
    // Pick 3 random from same category
    var shuffled = sameCat.sort(function() { return Math.random() - 0.5; }).slice(0, 3);
    var html = '<div style="margin-top:20px;padding:20px 0;border-top:1px solid var(--border);">' +
        '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">📖 Read Next</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
    shuffled.forEach(function(e) {
        var emoji = e[1].title.match(/^([\u{1F000}-\u{1FFFF}|\u{2600}-\u{26FF}]+)/u);
        var icon = emoji ? emoji[1] : '📄';
        html += '<button onclick="go(\'' + e[0] + '\')" style="padding:8px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.85rem;cursor:pointer;font-family:inherit;transition:0.2s;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' + icon + ' ' + e[0].replace(/-/g,' ') + '</button>';
    });
    html += '</div></div>';
    return html;
};

// Expose chapter count as single source of truth
window.NACHO_STORY_TOTAL = CHAPTERS.length;

// getNachoStoryProgress
window.getNachoStoryProgress = function() {
    return parseInt(localStorage.getItem('btc_nacho_story_highest') || '0');
};

// checkHiddenBadges — check and award hidden badges
window.checkHiddenBadges = function() {
    if (typeof HIDDEN_BADGES === 'undefined') return;
    // Wait until Firebase has restored user data to avoid re-awarding badges
    if (!window._hiddenBadgesReady) return;
    var earned = safeJSON('btc_hidden_badges', []);
    var changed = false;
    HIDDEN_BADGES.forEach(function(badge) {
        if (earned.indexOf(badge.id) !== -1) return;
        try {
            if (badge.check && badge.check()) {
                earned.push(badge.id);
                changed = true;
                if (typeof showToast === 'function') showToast(badge.emoji + ' Secret Badge: ' + (badge.revealName || badge.name) + '! +' + badge.pts + ' XP');
                if (typeof awardPoints === 'function') awardPoints(badge.pts, 'Hidden Badge: ' + (badge.revealName || badge.name));
                // Sync to Firebase
                if (typeof db !== 'undefined' && typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) {
                    try { db.collection('users').doc(auth.currentUser.uid).update({ hiddenBadges: earned }); } catch(e) {}
                }
            }
        } catch(e) {}
    });
    if (changed) localStorage.setItem('btc_hidden_badges', JSON.stringify(earned));
};
// Check hidden badges every 30 seconds (waits for _hiddenBadgesReady)
setInterval(function() { if (typeof checkHiddenBadges === 'function') checkHiddenBadges(); }, 30000);
// Safety: allow hidden badges after 20 seconds even if Firebase is slow
setTimeout(function() { if (!window._hiddenBadgesReady) window._hiddenBadgesReady = true; }, 20000);

// awardHiddenBadge — award a specific hidden badge by ID
window.awardHiddenBadge = function(badgeId, toastMsg) {
    var earned = safeJSON('btc_hidden_badges', []);
    if (earned.indexOf(badgeId) !== -1) return; // Already earned
    earned.push(badgeId);
    localStorage.setItem('btc_hidden_badges', JSON.stringify(earned));
    if (toastMsg && typeof showToast === 'function') showToast('🏅 ' + toastMsg);
    // Sync to Firebase
    if (typeof db !== 'undefined' && typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) {
        try { db.collection('users').doc(auth.currentUser.uid).update({ hiddenBadges: earned }); } catch(e) {}
    }
};

// awardOrangeTickets
window.awardOrangeTickets = function(amount, reason) {
    if (typeof currentUser !== 'undefined' && currentUser) {
        currentUser.orangeTickets = (currentUser.orangeTickets || 0) + amount;
        // Award tickets through server-side Cloud Function (orangeTickets blocked in Firestore rules)
        if (!currentUser._isLocal && typeof awardPoints === 'function') {
            awardPoints(0, '🎟️ ' + (reason || 'Orange Tickets'), null, amount);
        }
    }
    var local = parseInt(localStorage.getItem('btc_orange_tickets') || '0');
    localStorage.setItem('btc_orange_tickets', (local + amount).toString());
    if (typeof showToast === 'function') showToast('🎟️ +' + amount + ' Orange Ticket' + (amount > 1 ? 's' : '') + (reason ? ' — ' + reason : ''));
};

// setFloatingElementsVisible — show/hide floating buttons when sidebar opens
window.setFloatingElementsVisible = function(visible) {
    var ids = ['floatingRandomBtn','lbFloatBtn','mobileSearchBtn','backToTop','scrollToBottom','chatOverlayBtn','aiToolsBtn','dashboardFloatBtn'];
    ids.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.display = visible ? '' : 'none';
    });
};

// ========== CELEBRATION SYSTEM ==========
// Reusable celebration overlay for big achievements
window.showCelebration = function(opts) {
    var emoji = opts.emoji || '🎉';
    var title = opts.title || 'Achievement Unlocked!';
    var message = opts.message || '';
    var rewards = opts.rewards || []; // [{label:'100',sub:'PTS'},{label:'25',sub:'TICKETS'}]
    var btnText = opts.btnText || 'Amazing! 🎉';
    var _celeb = document.createElement('div');
    _celeb.style.cssText = 'position:fixed;inset:0;z-index:100020;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeSlideIn 0.5s ease-out;';
    _celeb.onclick = function(e) { if (e.target === _celeb) { _celeb.style.opacity='0'; _celeb.style.transition='opacity 0.4s'; setTimeout(function(){_celeb.remove();},400); } };
    var rewardHtml = '';
    if (rewards.length > 0) {
        rewardHtml = '<div style="display:flex;justify-content:center;gap:20px;margin-bottom:24px;">';
        rewards.forEach(function(r) {
            rewardHtml += '<div style="text-align:center;"><div style="font-size:2rem;font-weight:900;color:' + (r.color || '#22c55e') + ';">+' + r.label + '</div><div style="font-size:0.7rem;color:#94a3b8;">' + r.sub + '</div></div>';
        });
        rewardHtml += '</div>';
    }
    _celeb.innerHTML = '<div style="text-align:center;max-width:380px;width:100%;animation:fadeSlideIn 0.6s ease-out;">' +
        '<div style="font-size:4rem;margin-bottom:16px;animation:nachoModeBounce 1.5s ease-in-out infinite;">' + emoji + '</div>' +
        '<div style="font-size:1.8rem;font-weight:900;color:#f7931a;margin-bottom:8px;text-shadow:0 0 30px rgba(247,147,26,0.5);">' + title + '</div>' +
        '<div style="font-size:1rem;color:#e2e8f0;margin-bottom:20px;line-height:1.6;">' + message + '</div>' +
        rewardHtml +
        '<button onclick="event.stopPropagation();this.closest(\'div[style*=fixed]\').remove()" style="padding:14px 40px;background:linear-gradient(135deg,#f7931a,#ea580c);color:#fff;border:none;border-radius:14px;font-size:1.1rem;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 8px 30px rgba(247,147,26,0.4);">' + btnText + '</button>' +
        '</div>';
    document.body.appendChild(_celeb);
    if (typeof launchConfetti === 'function') launchConfetti();
    if (typeof playBadgeSound === 'function') playBadgeSound();
    setTimeout(function() { if (typeof launchConfetti === 'function') launchConfetti(); }, 1200);
};

// ========== SCHOLAR CERTIFICATION CELEBRATION ==========
// Hook into scholar exam completion
(function() {
    var _checkScholar = setInterval(function() {
        var types = ['prop', 'tech'];
        types.forEach(function(t) {
            var key = 'btc_scholar_' + t + '_passed';
            var celebKey = 'btc_scholar_' + t + '_celebrated';
            if (localStorage.getItem(key) === 'true' && localStorage.getItem(celebKey) !== 'true') {
                localStorage.setItem(celebKey, 'true');
                var isT = t === 'tech';
                setTimeout(function() {
                    showCelebration({
                        emoji: isT ? '🛠️🎓🏆' : '📖🎓🎉',
                        title: isT ? 'PROTOCOL EXPERT!' : 'BITCOIN SCHOLAR!',
                        message: isT ?
                            'You passed the Technical Protocol Expert Certification! You understand Bitcoin at the deepest level. True cypherpunk material! 🔐' :
                            'You passed the Bitcoin Scholar Certification! You have a thorough understanding of Bitcoin\'s properties and economics! 🧡',
                        rewards: [
                            { label: '2,100', sub: 'PTS', color: '#22c55e' },
                            { label: isT ? '🛠️' : '🎓', sub: 'BADGE', color: '#f7931a' }
                        ],
                        btnText: isT ? 'Protocol Expert! 🛠️' : 'Scholar! 🎓'
                    });
                }, 500);
            }
        });
    }, 3000);
})();

// ========== EXPLORATION MAP MILESTONES ==========
(function() {
    var MILESTONES = [
        { pct: 25, key: 'explore_25', emoji: '🗺️🌱', title: '25% EXPLORED!', msg: 'A quarter of the archive explored! You\'re building a solid Bitcoin foundation.', pts: 50, tickets: 10 },
        { pct: 50, key: 'explore_50', emoji: '🗺️🔥', title: '50% EXPLORED!', msg: 'Halfway through the entire archive! You know more about Bitcoin than most people on Earth.', pts: 100, tickets: 25 },
        { pct: 75, key: 'explore_75', emoji: '🗺️⚡', title: '75% EXPLORED!', msg: 'Three quarters done! You\'re in the top tier of Bitcoin knowledge seekers.', pts: 200, tickets: 50 },
        { pct: 100, key: 'explore_100', emoji: '🗺️👑🏆', title: 'ARCHIVE COMPLETE!', msg: 'You\'ve explored EVERY SINGLE channel in the archive. You are a true Bitcoin scholar. Satoshi would be proud! 🧡', pts: 500, tickets: 100 }
    ];

    window._checkExplorationMilestones = function() {
        if (typeof CHANNELS === 'undefined') return;
        var visited = safeJSON('btc_visited_channels', []);
        var total = Object.keys(CHANNELS).length;
        var pct = Math.round((visited.length / total) * 100);

        MILESTONES.forEach(function(m) {
            if (pct >= m.pct && localStorage.getItem('btc_' + m.key + '_celebrated') !== 'true') {
                localStorage.setItem('btc_' + m.key + '_celebrated', 'true');
                // Award points
                if (typeof awardPoints === 'function') awardPoints(m.pts, '🗺️ ' + m.pct + '% Explored');
                // Award tickets
                if (typeof awardOrangeTickets === 'function') {
                    awardOrangeTickets(m.tickets, '🗺️ ' + m.pct + '% Explored');
                } else {
                    var _t = parseInt(localStorage.getItem('btc_orange_tickets') || '0');
                    localStorage.setItem('btc_orange_tickets', (_t + m.tickets).toString());
                }
                // Show celebration
                setTimeout(function() {
                    showCelebration({
                        emoji: m.emoji,
                        title: m.title,
                        message: m.msg,
                        rewards: [
                            { label: m.pts.toString(), sub: 'PTS', color: '#22c55e' },
                            { label: m.tickets.toString(), sub: '🎟️ TICKETS', color: '#f7931a' }
                        ]
                    });
                }, 800);
                // Sync to Firebase
                if (typeof db !== 'undefined' && typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) {
                    var upd = {}; upd['explorationMilestone_' + m.pct] = true;
                    try { db.collection('users').doc(auth.currentUser.uid).update(upd).catch(function(){}); } catch(e) {}
                }
            }
        });
    };

    // Check milestones when exploration map renders
    var _origRenderMap = window.renderExplorationMap;
    window.renderExplorationMap = function() {
        _origRenderMap();
        window._checkExplorationMilestones();
    };
})();

// ========== MINI QUEST CELEBRATIONS ==========
// Small toast + haptic for channel quests and Nacho quizzes
(function() {
    // Hook into quest completion — add a celebratory touch
    var _origShowQuestFinal = window.showQuestFinalResults;
    if (_origShowQuestFinal) {
        window.showQuestFinalResults = function() {
            _origShowQuestFinal.apply(this, arguments);
            var score = window._questScore || 0;
            if (score === 5) {
                // Perfect score!
                if (typeof showToast === 'function') showToast('🏆 PERFECT SCORE! You nailed every question!');
                if (typeof launchConfetti === 'function') setTimeout(launchConfetti, 300);
            } else if (score >= 3) {
                if (typeof showToast === 'function') showToast('⚡ Quest passed! +' + (window._questPts || 0) + ' XP earned!');
            }
        };
    }

    // Hook into Nacho quiz answers for small celebrations
    var _origNachoQuizAnswer = window.nachoQuizAnswer;
    if (_origNachoQuizAnswer) {
        window.nachoQuizAnswer = function(btn, correct) {
            _origNachoQuizAnswer.apply(this, arguments);
            if (correct) {
                if (typeof haptic === 'function') haptic('success');
            }
        };
    }

    // Hook into conversation quiz answers
    var _origConvoQuizAnswer = window.convoQuizAnswer;
    if (_origConvoQuizAnswer) {
        window.convoQuizAnswer = function(btn, correct) {
            _origConvoQuizAnswer.apply(this, arguments);
            if (correct && typeof haptic === 'function') haptic('light');
        };
    }
})();
