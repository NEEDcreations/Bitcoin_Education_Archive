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
        if (!localStorage.getItem('onboarding_complete')) return false;
        if (localStorage.getItem(GUIDE_DISMISSED_KEY) === 'permanent') return false;
        return true;
    };

    // ---- Show guide (called after onboarding or from banner) ----
    window.showGuide = function() {
        if (typeof hideGuideReturnBtn === 'function') hideGuideReturnBtn();
        var existing = document.getElementById('guideOverlay');
        if (existing) existing.remove();

        // Push history state so back-swipe closes guide instead of exiting app
        history.pushState({ guide: true }, '', window.location.pathname + window.location.hash);

        var userName = '';
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.username) {
            userName = currentUser.username;
        }

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

        var forumLocked = channelsRead < 3;
        var irlLocked = channelsRead < 5;
        var marketLocked = channelsRead < 10;

        var overlay = document.createElement('div');
        overlay.id = 'guideOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:flex-end;justify-content:center;padding:0;';
        overlay.onclick = function(e) { if (e.target === overlay) minimizeGuide(); };

        var sheet = document.createElement('div');
        sheet.id = 'guideSheet';
        sheet.style.cssText = 'background:linear-gradient(180deg,#1a1b2e 0%,#12131f 100%);border:1px solid rgba(99,102,241,0.3);border-bottom:none;border-radius:24px 24px 0 0;width:100%;max-width:500px;max-height:88vh;overflow-y:auto;padding:0 20px 120px;animation:guideSlideUp 0.4s ease-out;-webkit-overflow-scrolling:touch;';

        sheet.innerHTML =
            // ── HERO ──
            '<div style="position:sticky;top:0;z-index:2;background:linear-gradient(180deg,#1a1b2e 90%,transparent);padding:12px 0 0;text-align:center;">' +
                '<div style="width:36px;height:4px;background:rgba(255,255,255,0.2);border-radius:2px;margin:0 auto 8px;"></div>' +
            '</div>' +

            '<div style="text-align:center;padding:24px 10px 40px;min-height:40vh;display:flex;flex-direction:column;align-items:center;justify-content:center;">' +
                '<div style="font-size:3rem;margin-bottom:20px;">📜</div>' +
                '<h1 style="font-size:2rem;font-weight:900;color:#fff;margin:0 0 12px;line-height:1.2;">Your <span style="color:#f7931a;">Quest</span> Begins</h1>' +
                '<p style="font-size:1rem;color:#94a3b8;margin:0;max-width:320px;line-height:1.6;">How to earn, learn, and level up</p>' +
                '<div style="margin-top:24px;font-size:0.75rem;color:#4b5563;letter-spacing:1px;">↓ SCROLL TO EXPLORE ↓</div>' +
            '</div>' +

            // ── PROGRESS BAR ──
            '<div onclick="minimizeGuide();goHome();setTimeout(function(){var el=document.getElementById(\'explorationMap\');if(el)el.scrollIntoView({behavior:\'smooth\',block:\'center\'});},400)" style="display:flex;align-items:center;gap:8px;padding:10px 14px;margin:0 0 20px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.2);border-radius:12px;cursor:pointer;">' +
                '<div style="font-size:1.3rem;">🌱</div>' +
                '<div style="flex:1;">' +
                    '<div style="font-size:0.7rem;color:#f7931a;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Your Journey</div>' +
                    '<div style="font-size:0.82rem;color:#e2e8f0;font-weight:600;margin-top:2px;">' + (typeof escapeHtml === 'function' ? escapeHtml(rank) : rank) + ' · ' + channelsRead + '/' + totalChannels + ' Topics Read</div>' +
                    '<div style="height:4px;background:rgba(255,255,255,0.1);border-radius:2px;margin-top:6px;"><div style="height:100%;width:' + Math.max(pctRead, 1) + '%;background:linear-gradient(90deg,#f7931a,#eab308);border-radius:2px;transition:width 1s ease;"></div></div>' +
                '</div>' +
            '</div>' +

            // ── START HERE ──
            guideSection('⭐ Start Here', [
                guideCard('🗺️', 'rgba(34,197,94,0.12)', "Nacho's Trails", 'Guided learning paths — Meadow, Mountain, and Summit.', 'tag-new', 'Recommended path', "minimizeGuide();setTimeout(function(){go('trails')},300)"),
                guideCard('📖', 'rgba(247,147,26,0.12)', 'Read Channels', 'Read curated Bitcoin content. Each channel earns XP.', 'tag-start', 'Your main activity', "goHome()"),
                guideCard('🦌', 'rgba(234,179,8,0.12)', 'Ask Nacho Anything', 'AI Bitcoin tutor — ask anything, get quizzed, track progress.', 'tag-start', 'Always available', "minimizeGuide();setTimeout(function(){if(typeof enterNachoMode==='function')enterNachoMode()},300)")
            ]) +

            // ── DAILY ACTIVITIES ──
            guideSection('🎯 Daily Activities', [
                guideCard('🎡', 'rgba(99,102,241,0.12)', 'Daily Spin', 'Spin once daily for tickets, XP, or rare prizes.', 'tag-earn', '+XP daily', "sessionStorage.setItem('btc_return_guide','1');showGuideReturnBtn();if(typeof showSpinWheel==='function'){minimizeGuide();showSpinWheel();}"),
                guideCard('🎯', 'rgba(139,92,246,0.12)', 'Daily Challenges', 'Complete tasks each day for bonus XP.', 'tag-earn', '+Bonus XP', "sessionStorage.setItem('btc_return_guide','1');showGuideReturnBtn();minimizeGuide();setTimeout(function(){if(typeof showQuestModal==='function')showQuestModal()},300)"),
                guideCard('⚔️', 'rgba(234,179,8,0.12)', 'Quests', 'Quiz, Trivia, and Poll quests — test your knowledge and earn XP!', 'tag-earn', '+50 XP each', "sessionStorage.setItem('btc_return_guide','1');showGuideReturnBtn();minimizeGuide();setTimeout(function(){if(typeof showQuestHub==='function')showQuestHub()},300)"),
                guideCard('📈', 'rgba(34,197,94,0.12)', 'Price Predictions', 'Predict tomorrow\'s BTC price. Earn XP if right.', 'tag-earn', '+XP if right', "sessionStorage.setItem('btc_return_guide','1');showGuideReturnBtn();if(typeof showPricePrediction==='function'){minimizeGuide();showPricePrediction();}"),
                guideCard('👟', 'rgba(252,76,2,0.12)', 'Proof of Walk', 'Connect Strava to earn 50 pts per km walked, run, or hiked.', 'tag-earn', 'Max 2,100 pts/day', "sessionStorage.setItem('btc_return_guide','1');showGuideReturnBtn();minimizeGuide();if(typeof showProofOfWalk==='function')showProofOfWalk()")
            ]) +

            // ── APPS TO EXPLORE ──
            guideSection('🔓 Apps to Explore', [
                guideCard('📺', 'rgba(99,102,241,0.12)', 'Timechain TV', '21 channels of curated Bitcoin video content.', null, null, "sessionStorage.setItem('btc_return_guide','1');showGuideReturnBtn();minimizeGuide();setTimeout(function(){if(typeof go==='function'){go('timechain-tv')}},300)"),
                guideCard('🦌', 'rgba(247,147,26,0.12)', 'AI Nacho Mode', 'Your Bitcoin-savvy AI tutor powered by archive knowledge.', null, null, "sessionStorage.setItem('btc_return_guide','1');showGuideReturnBtn();minimizeGuide();setTimeout(function(){if(typeof toggleNachoMode==='function')toggleNachoMode()},300)"),
                guideCard('⚔️', 'rgba(239,68,68,0.12)', 'PVP Battles', 'Real-time 1v1 Bitcoin trivia battles against other players.', null, null, "sessionStorage.setItem('btc_return_guide','1');showGuideReturnBtn();minimizeGuide();setTimeout(function(){if(typeof enterPVPMode==='function')enterPVPMode()},300)"),
                guideCard('🎵', 'rgba(168,85,247,0.12)', 'Bitcoin Beats', 'Community music player with uploads, likes, and artist pages.', null, null, "sessionStorage.setItem('btc_return_guide','1');showGuideReturnBtn();minimizeGuide();setTimeout(function(){go('bitcoin-beats')},300)"),
                guideCard('💬', 'rgba(59,130,246,0.12)', 'Pleb Talk', 'Community discussion board for Bitcoin topics and debates.', null, null, "sessionStorage.setItem('btc_return_guide','1');showGuideReturnBtn();minimizeGuide();setTimeout(function(){go('forum')},300)"),
                guideCard('🤝', 'rgba(34,197,94,0.12)', 'IRL Sync', 'Find and organize real-life Bitcoin meetups near you.', null, null, "sessionStorage.setItem('btc_return_guide','1');showGuideReturnBtn();minimizeGuide();setTimeout(function(){go('irl-sync')},300)"),
                guideCard('🛒', 'rgba(250,204,21,0.12)', 'Lightning Mart', 'Buy and sell goods using Lightning payments.', null, null, "sessionStorage.setItem('btc_return_guide','1');showGuideReturnBtn();minimizeGuide();setTimeout(function(){go('marketplace')},300)")
            ]) +

            // ── MORE FEATURES ──
            guideSection('✨ More Features', [
                guideCard('🌍', 'rgba(236,72,153,0.12)', 'Global Chat', 'Live chat with the community — messages, DMs, GIFs, reactions.', null, null, "sessionStorage.setItem('btc_return_guide','1');showGuideReturnBtn();if(typeof toggleChatOverlay==='function'){minimizeGuide();toggleChatOverlay();}"),
                guideCard('📊', 'rgba(59,130,246,0.12)', 'Bitcoin Dashboard', 'Live price, top indicators, mempool, and cycle signals.', null, null, "sessionStorage.setItem('btc_return_guide','1');showGuideReturnBtn();minimizeGuide();setTimeout(function(){if(typeof toggleDashboard==='function')toggleDashboard()},300)"),
                guideCard('🏆', 'rgba(168,85,247,0.12)', 'Leaderboard', 'Compete with other learners. Rise from Normie to Whale.', null, null, "sessionStorage.setItem('btc_return_guide','1');showGuideReturnBtn();minimizeGuide();setTimeout(function(){if(typeof toggleLeaderboard==='function')toggleLeaderboard()},300)"),
                guideCard('₿', 'rgba(247,147,26,0.12)', 'Earn Real Bitcoin', 'Redeem points for sats via Lightning. Learn, earn, stack.', 'tag-earn', 'XP → Sats', "sessionStorage.setItem('btc_return_guide','1');showGuideReturnBtn();minimizeGuide();setTimeout(function(){if(typeof showSettingsPage==='function'){showSettingsPage('sats')}else if(typeof showSettings==='function'){showSettings()}},300)"),
                guideCard('⚡', 'rgba(250,204,21,0.12)', 'Lightning Tipping', 'Set up your Lightning wallet to send and receive tips.', null, null, "sessionStorage.setItem('btc_return_guide','1');showGuideReturnBtn();minimizeGuide();setTimeout(function(){if(typeof go==='function'){go('lightning')}},300)"),
                guideCard('🎓', 'rgba(168,85,247,0.12)', 'Scholar Certification', 'Read all topics and pass the exam to earn your certification.', null, null, "sessionStorage.setItem('btc_return_guide','1');showGuideReturnBtn();minimizeGuide();setTimeout(function(){if(typeof go==='function'){go('scholar')}},300)")
            ]) +

            // ── ACTIONS ──
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
            (tagClass === 'tag-new' ? 'background:rgba(168,85,247,0.15);color:#a855f7;' : tagClass === 'tag-start' ? 'background:rgba(34,197,94,0.15);color:#22c55e;' : tagClass === 'tag-earn' ? 'background:rgba(247,147,26,0.15);color:#f7931a;' : 'background:rgba(99,102,241,0.15);color:#818cf8;') +
            '">' + tagText + '</span>' : '';
        var clickAttr = onclick ? ' onclick="' + onclick + '"' : '';
        return '<div' + clickAttr + ' style="padding:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;margin-bottom:8px;display:flex;align-items:flex-start;gap:12px;cursor:pointer;transition:0.2s;">' +
            '<div style="width:42px;height:42px;border-radius:12px;background:' + iconBg + ';display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;">' + icon + '</div>' +
            '<div style="flex:1;min-width:0;"><div style="font-size:0.88rem;font-weight:700;color:#fff;margin:0 0 2px;display:block;">' + title + '</div><div style="font-size:0.75rem;color:#94a3b8;line-height:1.45;margin:0;display:block;">' + desc + '</div>' + tag + '</div>' +
            '<div style="color:#4b5563;font-size:0.8rem;margin-top:8px;flex-shrink:0;">›</div>' +
        '</div>';
    }

    // ---- Helper: unlock tier row ----
    function unlockTier(icon, name, req, locked, onclick) {
        var clickAttr = onclick ? ' onclick="' + onclick + '" style="display:flex !important;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;margin-bottom:6px;cursor:pointer;"'
            : ' style="display:flex !important;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;margin-bottom:6px;"';
        return '<div' + clickAttr + '>' +
            '<div style="font-size:1.1rem;width:28px;text-align:center;flex-shrink:0;">' + icon + '</div>' +
            '<div style="flex:1;min-width:0;"><div style="font-size:0.82rem;font-weight:700;color:#e2e8f0;">' + name + '</div><div style="font-size:0.68rem;color:#64748b;">' + req + '</div></div>' +
            '<div style="font-size:0.8rem;color:' + (locked ? '#4b5563' : '#22c55e') + ';">' + (locked ? '🔒' : '✅') + '</div>' +
        '</div>';
    }

    // ---- Minimize guide (show banner) ----
    window.minimizeGuide = function() {
        var overlay = document.getElementById('guideOverlay');
        if (!overlay) return;
        // Save scroll position so we can restore it
        var sheet = overlay.querySelector('div[style*="border-radius:24px"]');
        if (sheet) window._guideScrollTop = sheet.scrollTop || 0;
        overlay.remove();
        localStorage.setItem(GUIDE_DISMISSED_KEY, 'session');
        // Push state so browser back re-opens guide
        history.pushState({ returnToGuide: true }, '', window.location.pathname + window.location.hash);
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
        // Top banner disabled — the home page "Your Quest Begins" card handles this now
        return;

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

        var homeInner = document.querySelector('.home-inner');
        if (homeInner) {
            var createBtn = homeInner.querySelector('[onclick*="showAuth"]') || homeInner.querySelector('[onclick*="showSignIn"]');
            if (createBtn) {
                createBtn.parentElement.insertBefore(banner, createBtn);
            } else {
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
    window.addEventListener('load', function() {
        setTimeout(function() {
            if (!shouldShowGuide()) return;
            var dismissed = localStorage.getItem(GUIDE_DISMISSED_KEY);
            if (dismissed === 'session' || dismissed === 'permanent') {
                if (dismissed === 'session') showGuideBanner();
            } else if (!localStorage.getItem(GUIDE_SEEN_KEY)) {
                showGuide();
            } else {
                showGuideBanner();
            }
        }, 1000);
    });

    console.log('[GUIDE] Quest guide module loaded');
})();

// ---- Scroll-reactive animations for Guide ----
(function() {
    var animStyle = document.createElement('style');
    animStyle.textContent = 
        '.guide-reveal { opacity: 0; transform: translateX(-60px); transition: opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1); will-change: transform, opacity; }' +
        '.guide-reveal.visible { opacity: 1; transform: translateX(0); }';
    document.head.appendChild(animStyle);

    var _guideAnimObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(m) {
            m.addedNodes.forEach(function(node) {
                if (node.nodeType === 1 && node.id === 'guideOverlay') {
                    setTimeout(function() { _applyGuideAnimations(); }, 100);
                }
            });
        });
    });
    if (document.body) {
        _guideAnimObserver.observe(document.body, { childList: true });
    } else {
        document.addEventListener('DOMContentLoaded', function() {
            _guideAnimObserver.observe(document.body, { childList: true });
        });
    }

    function _applyGuideAnimations() {
        var sheet = document.getElementById('guideSheet');
        if (!sheet) return;

        // Collect all meaningful content blocks — skip the hero (first big centered section)
        var rows = [];
        var allEls = sheet.querySelectorAll(':scope > div, :scope > button');
        var heroSkipped = false;
        allEls.forEach(function(el) {
            // Skip the sticky header
            if (el.style.position === 'sticky' || el.style.cssText.indexOf('sticky') !== -1) return;
            if (el.offsetHeight === 0) return;
            // Skip the hero (big centered section with min-height:40vh)
            if (!heroSkipped && el.style.cssText.indexOf('min-height:40vh') !== -1) {
                heroSkipped = true;
                return;
            }
            rows.push(el);
        });

        rows.forEach(function(row, idx) {
            row.classList.add('guide-reveal');
            row.style.transitionDelay = (idx * 0.07) + 's';
        });

        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, {
            root: sheet,
            threshold: 0.15,
            rootMargin: '0px 0px -30px 0px'
        });

        sheet.querySelectorAll('.guide-reveal').forEach(function(el) {
            observer.observe(el);
        });

        setTimeout(function() {
            sheet.querySelectorAll('.guide-reveal').forEach(function(el) {
                var rect = el.getBoundingClientRect();
                var sheetRect = sheet.getBoundingClientRect();
                if (rect.top < sheetRect.bottom && rect.bottom > sheetRect.top) {
                    el.classList.add('visible');
                }
            });
        }, 200);
    }

    // ---- Floating "Back to Guide" button ----
    var _guideReturnBtn = null;

    window.showGuideReturnBtn = function() {
        if (_guideReturnBtn) return;
        _guideReturnBtn = document.createElement('div');
        _guideReturnBtn.id = 'guideReturnFloat';
        _guideReturnBtn.innerHTML =
            '<div id="guideReturnExpanded" style="display:flex;align-items:center;gap:6px;padding:10px 16px;background:linear-gradient(135deg,#6366f1,#4f46e5);border-radius:14px;box-shadow:0 4px 20px rgba(99,102,241,0.4);cursor:pointer;transition:all 0.3s ease;touch-action:manipulation;" onclick="returnToGuide()">' +
                '<span style="font-size:0.95rem;">📜</span>' +
                '<span style="font-size:0.78rem;font-weight:700;color:#fff;white-space:nowrap;">Back to Guide</span>' +
                '<button onclick="event.stopPropagation();collapseGuideReturn()" style="background:none;border:none;color:rgba(255,255,255,0.6);font-size:0.7rem;cursor:pointer;padding:2px 4px;margin-left:2px;">✕</button>' +
            '</div>' +
            '<div id="guideReturnCollapsed" style="display:none;width:40px;height:40px;background:linear-gradient(135deg,#6366f1,#4f46e5);border-radius:50%;box-shadow:0 4px 16px rgba(99,102,241,0.4);cursor:pointer;align-items:center;justify-content:center;font-size:1.1rem;transition:all 0.3s ease;touch-action:manipulation;" onclick="returnToGuide()">📜</div>';
        _guideReturnBtn.style.cssText = 'position:fixed;bottom:80px;left:16px;z-index:9980;animation:guideReturnIn 0.4s ease;';
        if (!document.getElementById('guideReturnStyle')) {
            var s = document.createElement('style');
            s.id = 'guideReturnStyle';
            s.textContent = '@keyframes guideReturnIn{from{transform:translateX(-60px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes guideReturnOut{from{transform:translateX(0);opacity:1}to{transform:translateX(-60px);opacity:0}}';
            document.head.appendChild(s);
        }
        document.body.appendChild(_guideReturnBtn);
    };

    window.collapseGuideReturn = function() {
        var exp = document.getElementById('guideReturnExpanded');
        var col = document.getElementById('guideReturnCollapsed');
        if (exp) exp.style.display = 'none';
        if (col) col.style.display = 'flex';
    };

    window.hideGuideReturnBtn = function() {
        if (_guideReturnBtn) {
            _guideReturnBtn.style.animation = 'guideReturnOut 0.3s ease forwards';
            setTimeout(function() {
                if (_guideReturnBtn && _guideReturnBtn.parentNode) _guideReturnBtn.parentNode.removeChild(_guideReturnBtn);
                _guideReturnBtn = null;
            }, 300);
        }
        sessionStorage.removeItem('btc_return_guide');
    };

    window.returnToGuide = function() {
        hideGuideReturnBtn();
        if (typeof hideUsernamePrompt === 'function') hideUsernamePrompt();
        var chatHub = document.getElementById('chatHubOverlay');
        if (chatHub) chatHub.remove();
        var pvpOverlay = document.getElementById('pvpOverlay');
        if (pvpOverlay) { if (typeof exitPVPMode === 'function') exitPVPMode(true); }
        if (typeof goHome === 'function') goHome();
        setTimeout(function() { if (typeof showGuide === 'function') showGuide(); }, 400);
    };
})();
