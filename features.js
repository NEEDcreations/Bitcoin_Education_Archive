const HIDDEN_BADGES = [
    // === VISIBLE GOALS (shown locked with progress hints) ===
    { id: 'nacho_friend', name: 'Nacho\'s Friend', emoji: '🦌', pts: 25, desc: 'Interact with Nacho', hint: 'Click on Nacho!', hidden: false, check: function() { return localStorage.getItem('btc_nacho_clicked') === 'true'; } },
    { id: 'genesis', name: 'Genesis Reader', emoji: '📜', pts: 75, desc: 'Read the whitepaper channel', hint: 'Open the Whitepaper channel', hidden: false, check: function() { return typeof currentChannelId !== 'undefined' && currentChannelId === 'whitepaper'; } },
    { id: 'nacho_curious', name: 'Curious Deer', emoji: '❓', pts: 50, desc: 'Ask Nacho your first question', hint: 'Ask Nacho anything!', hidden: false, check: function() { return parseInt(localStorage.getItem('btc_nacho_questions') || '0') >= 1; } },
    { id: 'ticket_bronze', name: 'Ticket Fish', emoji: '🐟', pts: 200, desc: 'Earn 25 Orange Tickets', hint: 'Spin daily + referrals!', hidden: false, check: function() { return typeof currentUser !== 'undefined' && currentUser && (currentUser.orangeTickets || 0) >= 25; }, progress: function() { return typeof currentUser !== 'undefined' && currentUser ? Math.min(currentUser.orangeTickets || 0, 25) + '/25' : '0/25'; } },
    { id: 'ticket_silver', name: 'Ticket Shark', emoji: '🦈', pts: 500, desc: 'Earn 50 Orange Tickets', hint: 'Keep spinning & referring!', hidden: false, check: function() { return typeof currentUser !== 'undefined' && currentUser && (currentUser.orangeTickets || 0) >= 50; }, progress: function() { return typeof currentUser !== 'undefined' && currentUser ? Math.min(currentUser.orangeTickets || 0, 50) + '/50' : '0/50'; } },
    { id: 'ticket_gold', name: 'Ticket Whale', emoji: '🐋', pts: 1000, desc: 'Earn 100 Orange Tickets', hint: 'The ultimate ticket badge!', hidden: false, check: function() { return typeof currentUser !== 'undefined' && currentUser && (currentUser.orangeTickets || 0) >= 100; }, progress: function() { return typeof currentUser !== 'undefined' && currentUser ? Math.min(currentUser.orangeTickets || 0, 100) + '/100' : '0/100'; } },
    { id: 'nacho_10q', name: 'Inquisitive Buck', emoji: '🔍', pts: 200, desc: 'Ask Nacho 10 questions', hint: 'Keep asking Nacho!', hidden: false, check: function() { return parseInt(localStorage.getItem('btc_nacho_questions') || '0') >= 10; }, progress: function() { return Math.min(parseInt(localStorage.getItem('btc_nacho_questions') || '0'), 10) + '/10'; } },
    { id: 'collector', name: 'Collector', emoji: '💎', pts: 150, desc: 'Save 10+ channels to favorites', hint: 'Star your favorite channels', hidden: false, check: function() { return JSON.parse(localStorage.getItem('btc_favs') || '[]').length >= 10; }, progress: function() { return Math.min(JSON.parse(localStorage.getItem('btc_favs') || '[]').length, 10) + '/10'; } },
    { id: 'first_post', name: 'Town Crier', emoji: '📣', pts: 100, desc: 'Make your first forum post', hint: 'Post in PlebTalk!', hidden: false, check: function() { return parseInt(localStorage.getItem('btc_forum_post_count') || '0') >= 1 || (typeof currentUser !== 'undefined' && currentUser && currentUser.forumPosts >= 1); } },
    { id: 'first_reply', name: 'Conversationalist', emoji: '💬', pts: 75, desc: 'Reply to a forum post', hint: 'Join a discussion!', hidden: false, check: function() { return typeof currentUser !== 'undefined' && currentUser && currentUser.forumReplies >= 1; } },
    { id: 'market_seller', name: 'Merchant', emoji: '🏪', pts: 150, desc: 'List an item on the marketplace', hint: 'Sell something for sats!', hidden: false, check: function() { return typeof currentUser !== 'undefined' && currentUser && currentUser.marketListings >= 1; } },
    { id: 'market_buyer', name: 'Shopper', emoji: '🛍️', pts: 150, desc: 'Contact a seller on the marketplace', hint: 'Find something to buy!', hidden: false, check: function() { return typeof currentUser !== 'undefined' && currentUser && currentUser.marketMessages >= 1; } },
    // === TRUE HIDDEN (surprise discoveries) ===
    { id: 'night_owl', name: 'Night Owl', emoji: '🦉', pts: 50, desc: 'Visit the archive after midnight', hidden: true, check: function() { return new Date().getHours() >= 0 && new Date().getHours() < 5; } },
    { id: 'speed_runner', name: 'Speed Runner', emoji: '⚡', pts: 100, desc: 'Visit 15+ channels in one session', hidden: true, check: function() { return typeof sessionChannels !== 'undefined' && sessionChannels.size >= 15; } },
    { id: 'scholar', name: 'Bitcoin Scholar', emoji: '🎓', pts: 300, desc: 'Pass the Scholar Certification', hidden: true, check: function() { return localStorage.getItem('btc_scholar_passed') === 'true'; } },
    { id: 'nacho_20q', name: '20 Questions', emoji: '🏅', pts: 500, desc: 'Ask Nacho 20 questions', hidden: true, check: function() { return parseInt(localStorage.getItem('btc_nacho_questions') || '0') >= 20; } },
];


// Phase 4: Social Proof & Live Activity 🚀

(function() {
    const TICKER_ITEMS = [
        "Someone just completed the 'Mining 101' Quest! ⛏️",
        "New items added to the Marketplace! Check 'em out. 🛒",
        "Nacho: 'Did you know the first Bitcoin transaction was for two pizzas?' 🍕",
        "Trending: Users are asking about 'Self-Custody' today. 🔐",
        "A Bitcoiner just earned the 'Early Bird' badge! 🏅",
        "Block height is rising! Tick tock, next block. 🧱",
        "Nacho: 'Always verify, never trust!' 🦌",
        "New forum post: 'Why Bitcoin is the best form of money.' 💬",
        "Someone just stacked 500 bonus points! ⚡",
        "Flash Fact: Total Bitcoin supply is capped at 21 million. 🔢"
    ];

    async function initActivityTicker() {
        // PROGRESSIVE DISCLOSURE: Hide the ticker for brand new users
        // Only show if user has visited 3+ channels or is logged in
        const visitedCount = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]').length;
        const isAuth = firebase.auth().currentUser && !firebase.auth().currentUser.isAnonymous;
        
        if (visitedCount < 3 && !isAuth) {
            console.log("Ticker hidden: User is too new.");
            return;
        }

        const ticker = document.getElementById('activity-ticker');
        const content = document.getElementById('ticker-content');
        if (!ticker || !content) return;

        // Pull real data if possible
        try {
            const db = firebase.firestore();
            const forumSnap = await db.collection('forum_posts').orderBy('createdAt', 'desc').limit(3).get();
            forumSnap.forEach(doc => {
                const data = doc.data();
                TICKER_ITEMS.push("New Forum: \"" + data.title.substring(0, 30) + "...\" 💬");
            });

            const marketSnap = await db.collection('marketplace').where('status', '==', 'active').orderBy('createdAt', 'desc').limit(2).get();
            marketSnap.forEach(doc => {
                const data = doc.data();
                TICKER_ITEMS.push("Market: " + data.title + " for " + (data.priceSats || data.price) + " sats! 🛒");
            });
        } catch(e) { console.log("Ticker live data skipped:", e); }

        ticker.style.display = 'flex';
        let currentIdx = 0;

        function updateTicker() {
            content.style.animation = 'none';
            content.offsetHeight; // trigger reflow
            content.textContent = TICKER_ITEMS[currentIdx];
            content.style.animation = 'tickerScroll 15s linear infinite';
            
            currentIdx = (currentIdx + 1) % TICKER_ITEMS.length;
        }

        updateTicker();
        setInterval(updateTicker, 15000); // Sync with animation duration
    }

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

    // Phase 12: Orange Pill Newsletter Prompt
    window.checkNewsletterPrompt = function() {
        if (localStorage.getItem('btc_newsletter_prompt_shown')) return;
        const visited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]');
        
        if (visited.length >= 10) {
            showNewsletterModal();
            localStorage.setItem('btc_newsletter_prompt_shown', 'true');
        }
    };

    function showNewsletterModal() {
        const modal = document.createElement('div');
        modal.id = 'newsletterModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(5px);';
        
        modal.innerHTML = '<div style="background:var(--bg-side);border:2px solid var(--accent);border-radius:24px;padding:32px;max-width:400px;width:100%;text-align:center;animation:fadeSlideIn 0.5s ease-out;position:relative;">' +
            '<button onclick="this.closest(\'#newsletterModal\').remove()" style="position:absolute;top:16px;right:16px;background:none;border:none;color:var(--text-faint);font-size:1.2rem;cursor:pointer;">✕</button>' +
            '<div style="font-size:3.5rem;margin-bottom:16px;">📧</div>' +
            '<h2 style="color:var(--heading);margin-bottom:12px;">Stay Orange-Pilled</h2>' +
            '<p style="color:var(--text-muted);font-size:0.95rem;line-height:1.6;margin-bottom:24px;">You\'ve explored 10+ channels! Want to get a weekly dose of Bitcoin wisdom and site updates?</p>' +
            '<button onclick="optInNewsletter()" style="width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;margin-bottom:12px;box-shadow:0 4px 15px rgba(247,147,26,0.3);">Yes, Sign Me Up! 🚀</button>' +
            '<button onclick="this.closest(\'#newsletterModal\').remove()" style="width:100%;padding:12px;background:none;border:1px solid var(--border);color:var(--text-dim);border-radius:12px;font-size:0.9rem;cursor:pointer;">Maybe Later</button>' +
            '</div>';
            
        document.body.appendChild(modal);
    }

    window.optInNewsletter = async function() {
        const modal = document.getElementById('newsletterModal');
        const user = firebase.auth().currentUser;
        
        if (!user || user.isAnonymous) {
            showToast('Please sign in with email to join the newsletter!');
            if (typeof showUsernamePrompt === 'function') showUsernamePrompt();
            if (modal) modal.remove();
            return;
        }

        try {
            const db = firebase.firestore();
            await db.collection('users').doc(user.uid).update({
                newsletterOptIn: true,
                newsletterOptInDate: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('🎉 Welcome to the Orange Pill newsletter!');
        } catch(e) { console.log("Newsletter opt-in failed:", e); }
        
        if (modal) modal.remove();
    };

    // Start ticker
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { initActivityTicker(); checkNewsletterPrompt(); });
    } else {
        initActivityTicker();
        checkNewsletterPrompt();
    }
})();

// ---- Nacho Story (daily chapters) ----
window.showNachoStory = function() {
    var CHAPTERS = [
        { title: "Chapter 1: The Genesis Block", text: "In the beginning, there was nothing but fiat. Nacho was just a young deer in the forest of traditional finance, nibbling on leaves of debt and drinking from streams of inflation. One cold January day in 2009, a mysterious message appeared carved into a tree: 'Chancellor on brink of second bailout for banks.' Nacho didn't understand it yet, but something had changed forever. A new kind of money had been born — one that no government could print, no bank could freeze, and no deer could counterfeit. It was called Bitcoin." },
        { title: "Chapter 2: The Pizza That Changed Everything", text: "Nacho heard a rumor: someone had traded 10,000 bitcoins for two pizzas. 'That's crazy!' he thought. But was it? Those pizzas proved Bitcoin had real value — people would actually exchange goods for it. Nacho realized this wasn't just internet magic beans. It was the beginning of price discovery. Every great journey starts with a single transaction, and Bitcoin's started with pepperoni and cheese." },
        { title: "Chapter 3: Down the Rabbit Hole", text: "Nacho started reading. First the whitepaper — only 9 pages, but each one hit different. Peer-to-peer. No trusted third party. Proof of work. 21 million cap. The deeper he went, the more he understood: Bitcoin wasn't just new money. It was a paradigm shift. Sound money that couldn't be debased. A monetary network with no CEO, no headquarters, no off switch. Nacho's antlers tingled. He was becoming a Bitcoiner." },
        { title: "Chapter 4: HODL Through the Storm", text: "The price crashed. Then crashed again. Nacho watched his sats lose 80% of their dollar value. His friends laughed. 'Told you it was a scam!' But Nacho had done his homework. He understood the halving cycles. He knew that every 210,000 blocks, the new supply gets cut in half. Scarcity + time = value. So Nacho did what legends do: he held. Not because he was reckless, but because he understood what he held." },
        { title: "Chapter 5: Not Your Keys, Not Your Cheese", text: "One morning, Nacho woke up to terrible news. An exchange had been hacked. Billions gone. Friends who kept their bitcoin on the exchange lost everything. Nacho felt sick — but also relieved. He'd moved his sats to a hardware wallet weeks ago. Cold storage. Air-gapped. His keys, his bitcoin. From that day forward, Nacho's motto was clear: 'Not your keys, not your cheese.' 🧀🔑" },
        { title: "Chapter 6: The Halving", text: "Every four years, something magical happens. The block reward — the number of new bitcoins created with each block — gets cut in half. Nacho watched the countdown with excitement. From 6.25 BTC to 3.125 BTC per block. Less new supply entering the market. Same or growing demand. It's not magic; it's math. And it's the most predictable monetary policy in the history of money." },
        { title: "Chapter 7: Nacho's Mission", text: "Nacho looked around. So many deer — so many people — still didn't understand Bitcoin. They heard 'crypto' and thought of scams, memecoins, and celebrity tokens. But Bitcoin is different. It's the signal in the noise. So Nacho decided to dedicate his life to education. Not shilling. Not pumping. Teaching. Because the best way to orange-pill someone isn't to tell them to buy — it's to help them understand WHY. And that's why you're here. Welcome to the Archive. 🦌🟠" }
    ];

    var dayIdx = Math.floor(Date.now() / 86400000) % CHAPTERS.length;
    var ch = CHAPTERS[dayIdx];

    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    var card = document.createElement('div');
    card.style.cssText = 'background:var(--card-bg,#1a1a2e);border:1px solid #f7931a;border-radius:16px;padding:28px;max-width:500px;width:100%;max-height:80vh;overflow-y:auto;color:var(--text,#e2e8f0);font-family:inherit;';
    card.innerHTML = '<div style="text-align:center;margin-bottom:16px;"><span style="font-size:2.5rem;">🦌📖</span></div>' +
        '<h2 style="color:#f7931a;margin:0 0 12px;font-size:1.2rem;">' + ch.title + '</h2>' +
        '<p style="line-height:1.7;font-size:0.95rem;margin:0 0 16px;">' + ch.text + '</p>' +
        '<div style="text-align:center;color:var(--text-muted,#94a3b8);font-size:0.8rem;margin-bottom:12px;">📅 Chapter ' + (dayIdx + 1) + ' of ' + CHAPTERS.length + ' — A new chapter every day!</div>' +
        '<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="display:block;margin:0 auto;background:#f7931a;color:#000;border:none;padding:10px 28px;border-radius:8px;font-weight:700;cursor:pointer;font-size:0.95rem;">Close 📖</button>';
    overlay.appendChild(card);
    document.body.appendChild(overlay);
};

// ---- Price Prediction Game ----
window.showPricePrediction = function() {
    var currentPrice = parseFloat(localStorage.getItem('btc_last_price')) || 0;
    if (!currentPrice) { if (typeof showToast === 'function') showToast('⏳ Loading price data...'); return; }

    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    // Check for existing prediction
    var saved = JSON.parse(localStorage.getItem('btc_price_prediction') || 'null');
    var card = document.createElement('div');
    card.style.cssText = 'background:var(--card-bg,#1a1a2e);border:1px solid #f7931a;border-radius:16px;padding:28px;max-width:420px;width:100%;color:var(--text,#e2e8f0);font-family:inherit;text-align:center;';

    if (saved && Date.now() - saved.time < 86400000) {
        // Show existing prediction result
        var diff = currentPrice - saved.price;
        var pct = ((diff / saved.price) * 100).toFixed(2);
        var correct = (saved.direction === 'up' && diff > 0) || (saved.direction === 'down' && diff < 0);
        card.innerHTML = '<span style="font-size:2.5rem;">' + (correct ? '🎉' : '😅') + '</span>' +
            '<h2 style="color:#f7931a;margin:12px 0 8px;">Your Prediction</h2>' +
            '<p>You predicted <b style="color:' + (saved.direction === 'up' ? '#22c55e' : '#ef4444') + '">' + (saved.direction === 'up' ? '📈 UP' : '📉 DOWN') + '</b></p>' +
            '<p>Price when predicted: <b>$' + Math.round(saved.price).toLocaleString() + '</b></p>' +
            '<p>Current price: <b>$' + Math.round(currentPrice).toLocaleString() + '</b> (' + (diff >= 0 ? '+' : '') + pct + '%)</p>' +
            '<p style="font-size:1.2rem;margin-top:12px;">' + (correct ? '✅ You were RIGHT!' : '❌ Not this time!') + '</p>' +
            '<div style="margin-top:16px;font-size:0.8rem;color:var(--text-muted,#94a3b8);">Come back tomorrow for a new prediction!</div>' +
            '<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="margin-top:12px;background:#f7931a;color:#000;border:none;padding:10px 28px;border-radius:8px;font-weight:700;cursor:pointer;">Close</button>';
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
            '</div>';
    }

    overlay.appendChild(card);
    document.body.appendChild(overlay);
};

window._savePrediction = function(direction) {
    var price = parseFloat(localStorage.getItem('btc_last_price')) || 0;
    localStorage.setItem('btc_price_prediction', JSON.stringify({ direction: direction, price: price, time: Date.now() }));
    if (typeof showToast === 'function') showToast('🎯 Prediction saved! Check back tomorrow to see if you were right.');
    // Award points
    if (typeof awardPoints === 'function') awardPoints(5, '📈 Price prediction made');
};
