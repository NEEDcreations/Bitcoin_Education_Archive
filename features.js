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
