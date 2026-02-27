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

    // Start ticker
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initActivityTicker);
    } else {
        initActivityTicker();
    }
})();
