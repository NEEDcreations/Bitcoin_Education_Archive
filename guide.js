// ============================================================
// guide.js — "Your Quest Begins" post-onboarding guide
// Shows a bottom-sheet overlay after onboarding completes
// Can be minimized (banner at top of home) and reopened
// ============================================================

(function() {
    'use strict';

    var GUIDE_DISMISSED_KEY = 'guide_dismissed';
    var GUIDE_SEEN_KEY = 'guide_seen';

    // ---- Should we show the guide? ----
    window.shouldShowGuide = function() {
        // Only show if onboarding is complete but guide hasn't been permanently dismissed
        if (!localStorage.getItem('onboarding_complete')) return false;
        if (localStorage.getItem(GUIDE_DISMISSED_KEY) === 'permanent') return false;
        return true;
    };

    // ---- Show guide (called after onboarding or from banner) ----
    window.showGuide = function() {
        var existing = document.getElementById('guideOverlay');
        if (existing) existing.remove();

        var userName = '';
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.username) {
            userName = currentUser.username;
        }

        // Get dynamic stats
        var channelsRead = 0;
        try {
            var visited = JSON.parse(localStorage.getItem('btc_visited') || '[]');
            channelsRead = visited.length;
        } catch(e) {}
        var totalChannels = (typeof CHANNELS !== 'undefined') ? Object.keys(CHANNELS).length : 146;
        var pctRead = totalChannels > 0 ? Math.round((channelsRead / totalChannels) * 100) : 0;

        var rank = 'Pleb';
        var pts = 0;
        try {
            pts = parseInt(localStorage.getItem('btc_points')) || 0;
            if (typeof currentUser !== 'undefined' && currentUser) {
                pts = currentUser.points || pts;
                rank = currentUser.rank || rank;
            }
        } catch(e) {}

        // Check what's unlocked
        var forumLocked = channelsRead < 3;
        var beatsLocked = channelsRead < 3;
        var marketLocked = channelsRead < 10;

        var overlay = document.createElement('div');
        overlay.id = 'guideOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:flex-end;justify-content:center;padding:0;';
        overlay.onclick = function(e) { if (e.target === overlay) minimizeGuide(); };

        var sheet = document.createElement('div');
        sheet.id = 'guideSheet';
        sheet.style.cssText = 'background:linear-gradient(180deg,#1a1b2e 0%,#12131f 100%);border:1px solid rgba(99,102,241,0.3);border-bottom:none;border-radius:24px 24px 0 0;width:100%;max-width:500px;max-height:88vh;overflow-y:auto;padding:0 20px 120px;animation:guideSlideUp 0.4s ease-out;-webkit-overflow-scrolling:touch;';

        sheet.innerHTML =
            // Header
            '<div style="position:sticky;top:0;z-index:2;background:linear-gradient(180deg,#1a1b2e 80%,transparent);padding:16px 0 12px;text-align:center;">' +
                '<div style="width:36px;height:4px;background:rgba(255,255,255,0.2);border-radius:2px;margin:0 auto 12px;"></div>' +
                '<div style="font-size:1.3rem;font-weight:900;color:#fff;">📜 Your <span style="color:#f7931a;">Quest</span> Begins</div>' +
                '<div style="font-size:0.78rem;color:#94a3b8;margin-top:4px;">Everything you can do — and how to level up</div>' +
            '</div>' +

            // Progress
            '<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;margin:8px 0 16px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.2);border-radius:12px;">' +
                '<div style="font-size:1.3rem;">🌱</div>' +
                '<div style="flex:1;">' +
                    '<div style="font-size:0.7rem;color:#f7931a;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Your Journey</div>' +
                    '<div style="font-size:0.82rem;color:#e2e8f0;font-weight:600;margin-top:2px;">' + (typeof escapeHtml === 'function' ? escapeHtml(rank) : rank) + ' · ' + channelsRead + '/' + totalChannels + ' Channels Read</div>' +
                    '<div style="height:4px;background:rgba(255,255,255,0.1);border-radius:2px;margin-top:6px;"><div style="height:100%;width:' + Math.max(pctRead, 1) + '%;background:linear-gradient(90deg,#f7931a,#eab308);border-radius:2px;transition:width 1s ease;"></div></div>' +
                '</div>' +
            '</div>' +

            // START HERE
            guideSection('⭐ Start Here', [
                guideCard('📖', 'rgba(247,147,26,0.12)', 'Read Channels', 'Tap any channel to read curated Bitcoin content. Each channel you finish earns you points and badges!', 'tag-start', 'Your main activity', "goHome()"),
                guideCard('🦌', 'rgba(234,179,8,0.12)', 'Ask Nacho Anything', 'Tap the floating deer! Nacho knows Bitcoin inside and out — ask any question and get instant answers.', 'tag-start', 'Always available', "if(typeof showNachoInput==='function')showNachoInput();minimizeGuide()")
            ]) +

            // DAILY ACTIVITIES
            guideSection('🎯 Daily Activities', [
                guideCard('🎡', 'rgba(99,102,241,0.12)', 'Daily Spin', 'Spin the wheel once per day — win bonus points, tickets, or badges!', 'tag-earn', '+Points daily', "if(typeof showSpinWheel==='function'){minimizeGuide();showSpinWheel();}"),
                guideCard('🎯', 'rgba(139,92,246,0.12)', 'Daily Challenges', 'Complete simple tasks each day — visit channels, read content, test your knowledge.', 'tag-earn', '+Bonus points', null),
                guideCard('📈', 'rgba(34,197,94,0.12)', 'Price Predictions', 'Predict tomorrow\'s Bitcoin price and compete with other users!', 'tag-earn', '+Points if right', "if(typeof showPricePrediction==='function'){minimizeGuide();showPricePrediction();}")
            ]) +

            // UNLOCK APPS
            '<div style="margin-bottom:12px;">' +
                '<div style="font-size:0.72rem;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#6366f1;margin-bottom:8px;padding-left:2px;">🔓 Apps to Unlock</div>' +
                '<p style="font-size:0.75rem;color:#64748b;margin-bottom:10px;line-height:1.4;">Read channels to earn points and unlock these apps:</p>' +
                unlockTier('💬', 'PlebTalk Forum', 'Read 3 channels to unlock', forumLocked) +
                unlockTier('🎵', 'Bitcoin Beats', 'Available now!', false) +
                unlockTier('🛒', 'Lightning Mart', 'Read 10 channels to unlock', marketLocked) +
                unlockTier('⚡', 'Lightning Tipping', 'Connect a Lightning wallet', true) +
                unlockTier('🎓', 'Scholar Certification', 'Read all channels + pass the exam', true) +
            '</div>' +

            // MORE FEATURES
            guideSection('✨ More Features', [
                guideCard('🌍', 'rgba(236,72,153,0.12)', 'Global Chat', 'Chat with Bitcoiners in real-time. Send messages, DMs, GIFs, and listen to Nacho Radio!', null, null, "if(typeof toggleChatOverlay==='function'){minimizeGuide();toggleChatOverlay();}"),
                guideCard('📊', 'rgba(59,130,246,0.12)', 'Bitcoin Dashboard', 'Live price, block height, mempool, hashrate, fee estimates — all in one place.', null, null, "if(typeof go==='function'){minimizeGuide();go('bitcoin-dashboard');}"),
                guideCard('🏆', 'rgba(168,85,247,0.12)', 'Leaderboard & Ranks', 'Compete with other learners! Rise from Normie → Pleb → Maxi → Whale.', null, null, "if(typeof toggleLeaderboard==='function'){minimizeGuide();toggleLeaderboard();}")
            ]) +

            // Nacho tip
            '<div style="display:flex;align-items:flex-start;gap:10px;padding:12px;margin-top:12px;background:rgba(247,147,26,0.06);border:1px solid rgba(247,147,26,0.15);border-radius:12px;">' +
                '<div style="font-size:1.3rem;flex-shrink:0;">🦌</div>' +
                '<div style="font-size:0.75rem;color:#d4a574;line-height:1.5;"><strong style="color:#f7931a;">Nacho\'s Tip:</strong> Start by tapping any channel that looks interesting! There\'s no wrong place to begin — every channel teaches you something new about Bitcoin.</div>' +
            '</div>' +

            // Actions
            '<div style="margin-top:16px;display:flex;flex-direction:column;gap:8px;">' +
                '<button onclick="minimizeGuide()" style="width:100%;padding:14px;border:none;border-radius:14px;font-size:0.95rem;font-weight:800;cursor:pointer;font-family:inherit;background:linear-gradient(135deg,#f7931a,#eab308);color:#000;transition:0.2s;touch-action:manipulation;">🚀 Start Exploring</button>' +
                '<button onclick="dismissGuidePermanent()" style="width:100%;padding:10px;border:none;border-radius:10px;font-size:0.82rem;font-weight:600;cursor:pointer;font-family:inherit;background:none;color:#94a3b8;transition:0.2s;">Don\'t show this again</button>' +
            '</div>';

        overlay.appendChild(sheet);
        document.body.appendChild(overlay);
        localStorage.setItem(GUIDE_SEEN_KEY, '1');
    };

    // ---- Helper: build section ----
    function guideSection(title, cards) {
        return '<div style="margin-bottom:12px;">' +
            '<div style="font-size:0.72rem;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#6366f1;margin-bottom:8px;padding-left:2px;">' + title + '</div>' +
            cards.join('') +
        '</div>';
    }

    // ---- Helper: build card ----
    function guideCard(icon, iconBg, title, desc, tagClass, tagText, onclick) {
        var tag = tagClass && tagText ? '<span style="display:inline-block;font-size:0.6rem;font-weight:700;padding:2px 6px;border-radius:4px;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;' +
            (tagClass === 'tag-start' ? 'background:rgba(34,197,94,0.15);color:#22c55e;' : tagClass === 'tag-earn' ? 'background:rgba(247,147,26,0.15);color:#f7931a;' : 'background:rgba(99,102,241,0.15);color:#818cf8;') +
            '">' + tagText + '</span>' : '';
        var clickAttr = onclick ? ' onclick="' + onclick + '"' : '';
        return '<div' + clickAttr + ' style="padding:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;margin-bottom:8px;display:flex;align-items:flex-start;gap:12px;cursor:pointer;transition:0.2s;">' +
            '<div style="width:42px;height:42px;border-radius:12px;background:' + iconBg + ';display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;">' + icon + '</div>' +
            '<div style="flex:1;min-width:0;"><h4 style="font-size:0.88rem;font-weight:700;color:#fff;margin:0 0 2px;">' + title + '</h4><p style="font-size:0.75rem;color:#94a3b8;line-height:1.45;margin:0;">' + desc + '</p>' + tag + '</div>' +
            '<div style="color:#4b5563;font-size:0.8rem;margin-top:8px;flex-shrink:0;">›</div>' +
        '</div>';
    }

    // ---- Helper: unlock tier row ----
    function unlockTier(icon, name, req, locked) {
        return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;margin-bottom:6px;">' +
            '<div style="font-size:1.1rem;">' + icon + '</div>' +
            '<div style="flex:1;"><div style="font-size:0.82rem;font-weight:700;color:#e2e8f0;">' + name + '</div><div style="font-size:0.68rem;color:#64748b;">' + req + '</div></div>' +
            '<div style="font-size:0.8rem;color:' + (locked ? '#4b5563' : '#22c55e') + ';">' + (locked ? '🔒' : '✅') + '</div>' +
        '</div>';
    }

    // ---- Minimize guide (show banner) ----
    window.minimizeGuide = function() {
        var overlay = document.getElementById('guideOverlay');
        if (overlay) overlay.remove();
        localStorage.setItem(GUIDE_DISMISSED_KEY, 'session');
        showGuideBanner();
    };

    // ---- Dismiss permanently ----
    window.dismissGuidePermanent = function() {
        var overlay = document.getElementById('guideOverlay');
        if (overlay) overlay.remove();
        var banner = document.getElementById('guideBanner');
        if (banner) banner.remove();
        localStorage.setItem(GUIDE_DISMISSED_KEY, 'permanent');
    };

    // ---- Show minimized banner at top of home ----
    window.showGuideBanner = function() {
        if (localStorage.getItem(GUIDE_DISMISSED_KEY) === 'permanent') return;
        var existing = document.getElementById('guideBanner');
        if (existing) return;

        var banner = document.createElement('div');
        banner.id = 'guideBanner';
        banner.style.cssText = 'padding:8px 12px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.25);border-radius:12px;margin-bottom:12px;display:flex;align-items:center;gap:8px;cursor:pointer;transition:0.2s;animation:fadeSlideIn 0.3s ease-out;';
        banner.onclick = function() {
            banner.remove();
            showGuide();
        };
        banner.innerHTML =
            '<div style="font-size:1rem;">📜</div>' +
            '<div style="flex:1;"><div style="font-size:0.78rem;font-weight:700;color:var(--heading);">Quest Guide</div><div style="font-size:0.65rem;color:var(--text-muted);">Tap to see what you can do</div></div>' +
            '<div style="color:var(--text-faint);font-size:0.7rem;">Open ›</div>' +
            '<button onclick="event.stopPropagation();this.parentElement.remove();localStorage.setItem(\'' + GUIDE_DISMISSED_KEY + '\',\'permanent\');" style="background:none;border:none;color:var(--text-faint);font-size:0.9rem;cursor:pointer;padding:4px;margin-left:4px;">✕</button>';

        // Insert at top of home-inner content, after the logos/header
        var homeInner = document.querySelector('.home-inner');
        if (homeInner) {
            // Find the first non-header element (after logos, title, subtitle, stats)
            var createBtn = homeInner.querySelector('[onclick*="showAuth"]') || homeInner.querySelector('[onclick*="showSignIn"]');
            if (createBtn) {
                createBtn.parentElement.insertBefore(banner, createBtn);
            } else {
                // Fallback: insert after the last .home-logos element
                var logos = homeInner.querySelector('.home-logos');
                if (logos && logos.nextElementSibling) {
                    homeInner.insertBefore(banner, logos.nextElementSibling.nextElementSibling || logos.nextElementSibling);
                } else {
                    homeInner.insertBefore(banner, homeInner.firstChild);
                }
            }
        }
    };

    // ---- Inject animation keyframes ----
    if (!document.getElementById('guideStyles')) {
        var style = document.createElement('style');
        style.id = 'guideStyles';
        style.textContent = '@keyframes guideSlideUp{from{transform:translateY(100%);}to{transform:translateY(0);}}';
        document.head.appendChild(style);
    }

    // ---- Auto-show on page load if appropriate ----
    // This runs after onboarding.js sets onboarding_complete
    // The onboarding code should call showGuide() directly after completing
    // But if the user refreshes, check if we should show the banner
    window.addEventListener('load', function() {
        setTimeout(function() {
            if (!shouldShowGuide()) return;
            var dismissed = localStorage.getItem(GUIDE_DISMISSED_KEY);
            if (dismissed === 'session' || dismissed === 'permanent') {
                // Show banner only if session-dismissed (not permanent)
                if (dismissed === 'session') showGuideBanner();
            } else if (!localStorage.getItem(GUIDE_SEEN_KEY)) {
                // First time — show full guide
                showGuide();
            } else {
                // Seen before, not dismissed — show banner
                showGuideBanner();
            }
        }, 1000);
    });

    console.log('[GUIDE] Quest guide module loaded');
})();
