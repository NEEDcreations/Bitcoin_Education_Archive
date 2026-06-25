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

// ══════════════════════════════════════════════════════════════════════
// 🔥 COMBO BONUS SYSTEM
// Tracks feature zones visited in a session; awards bonus pts at 3/5/8
// ══════════════════════════════════════════════════════════════════════
(function() {
    'use strict';

    var COMBO_TIERS = [
        { count: 3, pts: 50,  key: 'combo_trio',   label: '\ud83d\udd25 Trio Combo! 3 features today',    badge: 'combo_trio' },
        { count: 5, pts: 100, key: 'combo_mega',   label: '\ud83d\udca5 MEGA COMBO! 5 features unlocked', badge: 'combo_mega' },
        { count: 8, pts: 250, key: 'combo_legend', label: '\ud83c\udfc6 LEGENDARY COMBO! All 8 features!', badge: 'combo_legend' },
    ];

    function getZones() {
        try { return JSON.parse(sessionStorage.getItem('btc_combo_zones') || '[]'); } catch(e) { return []; }
    }

    function saveZones(zones) {
        try { sessionStorage.setItem('btc_combo_zones', JSON.stringify(zones)); } catch(e) {}
    }

    function tierFired(key) {
        try { return sessionStorage.getItem('btc_combo_fired_' + key) === '1'; } catch(e) { return false; }
    }

    function markTierFired(key) {
        try { sessionStorage.setItem('btc_combo_fired_' + key, '1'); } catch(e) {}
    }

    window._trackCombo = function(zone) {
        if (!zone) return;
        var zones = getZones();
        if (zones.indexOf(zone) === -1) {
            zones.push(zone);
            saveZones(zones);
        }
        var count = zones.length;

        COMBO_TIERS.forEach(function(tier) {
            if (count >= tier.count && !tierFired(tier.key)) {
                markTierFired(tier.key);
                if (typeof awardPoints === 'function') {
                    awardPoints(tier.pts, tier.label, null, null, null, null, { actionKey: 'combo_bonus', comboTier: tier.key });
                }
                if (typeof showToast === 'function') {
                    showToast(tier.label + ' +' + tier.pts + ' pts!', 5000);
                }
                // Badge
                var badgeKey = 'btc_badge_earned_' + tier.badge;
                if (!localStorage.getItem(badgeKey)) {
                    localStorage.setItem(badgeKey, '1');
                    var COMBO_BADGE_DEFS = {
                        combo_trio:   { emoji: '\ud83d\udd25', name: 'Trio Combo',   pts: 50 },
                        combo_mega:   { emoji: '\ud83d\udca5', name: 'Mega Combo',   pts: 100 },
                        combo_legend: { emoji: '\ud83c\udfc6', name: 'Legend Mode',  pts: 250 },
                    };
                    var bdef = COMBO_BADGE_DEFS[tier.badge];
                    if (bdef) {
                        if (typeof awardPoints === 'function') awardPoints(bdef.pts, '\ud83c\udfc5 Badge: ' + bdef.name, null, null, null, tier.badge);
                        if (typeof showBadgeToast === 'function') showBadgeToast({ id: tier.badge, emoji: bdef.emoji, name: bdef.name, pts: bdef.pts });
                    }
                }
            }
        });
    };
})();

// PVP combo tracking patch (applied after pvp.js loads enterPVPMode)
document.addEventListener('DOMContentLoaded', function() {
    var _pvpOrigEnter = null;
    function _patchPVPCombo() {
        if (typeof window.enterPVPMode === 'function' && !window._pvpComboPatch) {
            window._pvpComboPatch = true;
            _pvpOrigEnter = window.enterPVPMode;
            window.enterPVPMode = function() {
                if (typeof window._trackCombo === 'function') window._trackCombo('pvp');
                return _pvpOrigEnter.apply(this, arguments);
            };
        } else if (!window._pvpComboPatch) {
            setTimeout(_patchPVPCombo, 500);
        }
    }
    _patchPVPCombo();

    // Spin combo patch
    var _spinOrigFn = null;
    function _patchSpinCombo() {
        if (typeof window.showSpinWheel === 'function' && !window._spinComboPatch) {
            window._spinComboPatch = true;
            _spinOrigFn = window.showSpinWheel;
            window.showSpinWheel = function() {
                if (typeof window._trackCombo === 'function') window._trackCombo('spin');
                return _spinOrigFn.apply(this, arguments);
            };
        } else if (!window._spinComboPatch) {
            setTimeout(_patchSpinCombo, 500);
        }
    }
    _patchSpinCombo();

    // TCTV combo patch
    var _tctvOrigFn = null;
    function _patchTCTVCombo() {
        if (typeof window.showTCTV === 'function' && !window._tctvComboPatch) {
            window._tctvComboPatch = true;
            _tctvOrigFn = window.showTCTV;
            window.showTCTV = function() {
                if (typeof window._trackCombo === 'function') window._trackCombo('tctv');
                return _tctvOrigFn.apply(this, arguments);
            };
        } else if (!window._tctvComboPatch) {
            setTimeout(_patchTCTVCombo, 500);
        }
    }
    _patchTCTVCombo();
});
