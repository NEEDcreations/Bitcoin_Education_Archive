// Phase 10: Loyalty & Learning Boosts 🎓

(function() {
    // Generate 3 random boost channels based on the date
    function getDailyBoosts() {
        const seed = new Date().toISOString().split('T')[0];
        if (typeof CHANNELS === 'undefined') return [];
        const keys = Object.keys(CHANNELS);
        const boosts = [];
        
        // Simple deterministic random based on date string
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            hash = seed.charCodeAt(i) + ((hash << 5) - hash);
        }

        for (let i = 0; i < 3; i++) {
            const idx = Math.abs((hash + i * 13) % keys.length);
            boosts.push(keys[idx]);
        }
        return boosts;
    }

    const DAILY_BOOSTS = getDailyBoosts();

    function initBoostUI() {
        DAILY_BOOSTS.forEach(id => {
            const btn = document.querySelector('[onclick*="go(\'' + id + '\'"]');
            if (btn) {
                const badge = document.createElement('span');
                badge.style.cssText = 'position:absolute;top:4px;right:4px;background:#f7931a;color:#fff;font-size:0.55rem;font-weight:900;padding:2px 5px;border-radius:4px;box-shadow:0 0 10px rgba(247,147,26,0.4);';
                badge.textContent = '2X PTS';
                btn.style.position = 'relative';
                btn.appendChild(badge);
            }
        });
        
        // Update reward points logic in ranking.js by checking DAILY_BOOSTS
        window._dailyBoosts = DAILY_BOOSTS;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBoostUI);
    } else {
        initBoostUI();
    }
})();
