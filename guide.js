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

        // Experience mode — determines what sections/cards to show
        var expMode = 'advanced';
        try { expMode = localStorage.getItem('btc_experience_mode') || 'advanced'; } catch(e) {}
        if (expMode !== 'lite' && expMode !== 'beginner' && expMode !== 'intermediate' && expMode !== 'advanced') expMode = 'advanced';

        var overlay = document.createElement('div');
        overlay.id = 'guideOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:flex-end;justify-content:center;padding:0;';
        overlay.onclick = function(e) { if (e.target === overlay) minimizeGuide(); };

        var sheet = document.createElement('div');
        sheet.id = 'guideSheet';
        sheet.style.cssText = 'background:linear-gradient(180deg,#1a1b2e 0%,#12131f 100%);border:1px solid rgba(99,102,241,0.3);border-bottom:none;border-radius:24px 24px 0 0;width:100%;max-width:500px;max-height:88vh;overflow-y:auto;padding:0 20px 120px;animation:guideSlideUp 0.4s ease-out;-webkit-overflow-scrolling:touch;';

        var heroMeta = (typeof window.bqExperienceModeMeta === 'function') ? window.bqExperienceModeMeta(expMode) : null;
        var heroSubtitle = heroMeta ? heroMeta.desc : 'Every app, game and event.';

        function cardsFrom(list) {
            return (list || []).map(function (g) {
                return guideCard(g.icon, g.iconBg, g.title, g.desc, g.tagClass || null, g.tagText || null, g.action);
            });
        }
        var grouped = (typeof window.bqGuideCards === 'function') ? window.bqGuideCards(expMode) : { start: [], daily: [], apps: [], more: [] };
        var startHereCards = cardsFrom(grouped.start);
        var dailyCards = cardsFrom(grouped.daily);
        var appsCards = cardsFrom(grouped.apps);
        var moreCards = cardsFrom(grouped.more);
        var moreFeaturesHtml = moreCards.length ? guideSection('\u2728 More Features', moreCards) : '';

        sheet.innerHTML =
            // -- HERO --
            '<div style="position:sticky;top:0;z-index:2;background:linear-gradient(180deg,#1a1b2e 90%,transparent);padding:12px 0 0;text-align:center;">' +
                '<div style="width:36px;height:4px;background:rgba(255,255,255,0.2);border-radius:2px;margin:0 auto 8px;"></div>' +
            '</div>' +

            '<div style="text-align:center;padding:24px 10px 40px;min-height:40vh;display:flex;flex-direction:column;align-items:center;justify-content:center;">' +
                '<div style="font-size:3rem;margin-bottom:20px;">📜</div>' +
                '<h1 style="font-size:2rem;font-weight:900;color:#fff;margin:0 0 12px;line-height:1.2;">Your <span style="color:#f7931a;">Quest</span> Begins</h1>' +
                '<p style="font-size:1rem;color:#94a3b8;margin:0;max-width:320px;line-height:1.6;">' + heroSubtitle + '</p>' +
                '<div style="margin-top:24px;font-size:0.75rem;color:#4b5563;letter-spacing:1px;">↓ SCROLL TO EXPLORE ↓</div>' +
            '</div>' +

            // -- PROGRESS BAR --
            '<div onclick="minimizeGuide();goHome();setTimeout(function(){var el=document.getElementById(\'explorationMap\');if(el)el.scrollIntoView({behavior:\'smooth\',block:\'center\'});},400)" style="display:flex;align-items:center;gap:8px;padding:10px 14px;margin:0 0 20px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.2);border-radius:12px;cursor:pointer;">' +
                '<div style="font-size:1.3rem;">🌱</div>' +
                '<div style="flex:1;">' +
                    '<div style="font-size:0.7rem;color:#f7931a;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Your Journey</div>' +
                    '<div style="font-size:0.82rem;color:#e2e8f0;font-weight:600;margin-top:2px;">' + (typeof escapeHtml === 'function' ? escapeHtml(rank) : rank) + ' · ' + channelsRead + '/' + totalChannels + ' Topics Read</div>' +
                    '<div style="height:4px;background:rgba(255,255,255,0.1);border-radius:2px;margin-top:6px;"><div style="height:100%;width:' + Math.max(pctRead, 1) + '%;background:linear-gradient(90deg,#f7931a,#eab308);border-radius:2px;transition:width 1s ease;"></div></div>' +
                '</div>' +
            '</div>' +

            // -- START HERE --
            guideSection('⭐ Start Here', startHereCards) +

            // -- DAILY ACTIVITIES --
            guideSection('🎯 Daily Activities', dailyCards) +

            // -- APPS TO EXPLORE --
            guideSection('Apps to Explore', appsCards) +

            // -- MORE FEATURES (advanced only) --
            moreFeaturesHtml +

            // -- ACTIONS --
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
            try {
                if (localStorage.getItem('btc_intro_seen') !== '1') return;
                if (typeof window.btcPopupBlocked === 'function' && window.btcPopupBlocked('guide')) return;
                if (typeof window.btcClaimSessionPopup === 'function' && !window.btcClaimSessionPopup('guide')) return;
            } catch (e) { return; }
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
        _guideReturnBtn.style.cssText = 'position:fixed;bottom:var(--above-fab, 80px);left:16px;z-index:9980;animation:guideReturnIn 0.4s ease;';
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
        setTimeout(function() { if (typeof showGuide === 'function') showGuide(true); }, 400);
    };

    // ---- FAQ Modal ----
    function faqEscape(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function faqAnswerHtml(item) {
        if (item && item.earnXp) {
            var xp = (typeof window.renderEarnXpGuide === 'function')
                ? window.renderEarnXpGuide('faq-')
                : ((typeof window.EARN_XP_CAP_LINE === 'string' && window.EARN_XP_CAP_LINE)
                    ? window.EARN_XP_CAP_LINE
                    : 'One daily cap, from 5:00 UTC: full XP through 500, half through 900, then a quarter until 1,000. Extra is not saved. Scholar and Protocol exams are not limited by this cap. Guest XP you already earned, up to 500, does not.');
            return 'Open Settings → Sats and expand How to Earn XP. That list is shared with this answer. ' + xp + ' Each tier rounds down. XP converts to sats: 1,000 XP = 100 sats, redeemable to your Lightning wallet when you are eligible.';
        }
        if (item && item.appsList) {
            var apps = (typeof window.exploreAppsForMode === 'function') ? window.exploreAppsForMode() : [];
            if (!apps.length) return 'Open Explore Apps for Nacho Mode, Timechain TV, Bitcoin Beats, and the rest.';
            var names = apps.map(function (app) { return app.title; });
            return 'Explore Apps lists ' + names.length + ' apps: ' + names.join(', ') + '.';
        }
        return String((item && item.a) || '').replace(/\n/g, '<br>');
    }
    function faqSections() {
        return (window.BQ_FAQ && window.BQ_FAQ.length) ? window.BQ_FAQ : [];
    }

    window.showFAQ = function(openId) {
        var existing = document.getElementById('faqOverlay');
        if (existing && !openId) { existing.remove(); return; }
        if (existing) existing.remove();

        var sections = faqSections();
        var overlay = document.createElement('div');
        overlay.id = 'faqOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:260000;background:rgba(0,0,0,0.88);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:flex;align-items:flex-end;justify-content:center;padding:0;animation:faqFadeIn 0.25s ease-out;';
        overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

        var sheet = document.createElement('div');
        sheet.style.cssText = 'background:var(--bg,#0a0a0f);border:1px solid var(--border);border-bottom:none;border-radius:24px 24px 0 0;width:100%;max-width:560px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,0.6);';

        var header = '<div style="display:flex;align-items:center;gap:12px;padding:18px 20px 14px;border-bottom:1px solid var(--border);flex-shrink:0;">' +
            '<div style="width:40px;height:40px;border-radius:12px;background:rgba(247,147,26,0.12);border:1px solid rgba(247,147,26,0.25);display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;">❓</div>' +
            '<div style="flex:1;"><div style="font-size:1.05rem;font-weight:800;color:var(--heading);">Frequently Asked Questions</div>' +
            '<div style="font-size:0.72rem;color:var(--text-faint);margin-top:1px;">Jump to a section, then tap a question</div></div>' +
            '<button type="button" onclick="if(window.showOnboardingIntro)window.showOnboardingIntro({force:true})" style="background:none;border:1px solid var(--border);color:var(--heading);border-radius:10px;padding:6px 8px;font-size:0.72rem;font-weight:700;cursor:pointer;font-family:inherit;">Tour</button>' +
            '<button type="button" onclick="document.getElementById(\'faqOverlay\').remove()" style="background:none;border:1px solid var(--border);color:var(--text-muted);width:34px;height:34px;border-radius:10px;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;touch-action:manipulation;">✕</button>' +
            '</div>';

        var jump = '<div style="display:flex;gap:8px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding:10px 16px 8px;flex-shrink:0;border-bottom:1px solid var(--border);">';
        sections.forEach(function(sec) {
            jump += '<button type="button" data-faq-jump="' + faqEscape(sec.id) + '" style="flex-shrink:0;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.28);color:var(--heading);border-radius:999px;padding:6px 10px;font-size:0.7rem;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;touch-action:manipulation;">' + faqEscape(sec.title) + '</button>';
        });
        jump += '</div>';

        var itemsHtml = '<div id="faqSheetBody" style="overflow-y:auto;-webkit-overflow-scrolling:touch;flex:1;padding:12px 16px 28px;">';
        if (!sections.length) {
            itemsHtml += '<div style="padding:16px;color:var(--text-muted);font-size:0.85rem;">The FAQ is still loading. Close this and open it again in a moment.</div>';
        }
        sections.forEach(function(sec, sIdx) {
            var openSec = !openId && sIdx === 0;
            if (openId) {
                for (var i = 0; i < sec.items.length; i++) {
                    if (sec.items[i].id === openId) openSec = true;
                }
            }
            itemsHtml += '<details id="faqSec-' + faqEscape(sec.id) + '" class="faq-sec"' + (openSec ? ' open' : '') + ' style="margin-bottom:14px;">' +
                '<summary style="cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;padding:4px 2px 8px;font-size:0.78rem;font-weight:800;letter-spacing:0.4px;text-transform:uppercase;color:var(--accent);touch-action:manipulation;">' +
                faqEscape(sec.title) + '</summary>';
            sec.items.forEach(function(item) {
                var openItem = openId && item.id === openId;
                itemsHtml += '<div id="faqItem-' + faqEscape(item.id) + '" style="border:1px solid ' + (openItem ? 'rgba(247,147,26,0.4)' : 'var(--border)') + ';border-radius:14px;margin-bottom:8px;overflow:hidden;transition:border-color 0.2s;">' +
                    '<button type="button" class="faq-q" data-faq-id="' + faqEscape(item.id) + '" style="width:100%;display:flex;align-items:center;gap:10px;padding:14px 16px;background:none;border:none;cursor:pointer;text-align:left;font-family:inherit;touch-action:manipulation;">' +
                    '<span style="font-size:0.85rem;font-weight:700;color:var(--heading);flex:1;line-height:1.4;">' + faqEscape(item.q) + '</span>' +
                    '<span class="faq-arrow" style="color:var(--text-faint);font-size:0.65rem;flex-shrink:0;margin-left:4px;">' + (openItem ? '▲' : '▼') + '</span></button>' +
                    '<div id="faqAns-' + faqEscape(item.id) + '" style="display:' + (openItem ? 'block' : 'none') + ';padding:0 16px 14px;font-size:0.82rem;color:var(--text-muted);line-height:1.65;border-top:1px solid var(--border);">' +
                    '<div style="padding-top:10px;">' + faqAnswerHtml(item) + '</div></div></div>';
            });
            itemsHtml += '</details>';
        });
        itemsHtml += '</div>';

        sheet.innerHTML = '<style>@keyframes faqFadeIn{from{opacity:0}to{opacity:1}}#faqOverlay .faq-sec > summary::-webkit-details-marker{display:none}</style>' + header + jump + itemsHtml;
        overlay.appendChild(sheet);
        document.body.appendChild(overlay);

        function toggleItem(id) {
            var ans = document.getElementById('faqAns-' + id);
            var box = document.getElementById('faqItem-' + id);
            if (!ans || !box) return;
            var open = ans.style.display !== 'none';
            ans.style.display = open ? 'none' : 'block';
            box.style.borderColor = open ? 'var(--border)' : 'rgba(247,147,26,0.4)';
            var arrow = box.querySelector('span.faq-arrow');
            if (arrow) arrow.textContent = open ? '▼' : '▲';
        }
        sheet.addEventListener('click', function(ev) {
            var jumpBtn = ev.target.closest && ev.target.closest('[data-faq-jump]');
            if (jumpBtn) {
                var sid = jumpBtn.getAttribute('data-faq-jump');
                var sec = document.getElementById('faqSec-' + sid);
                if (sec) {
                    sec.open = true;
                    try { sec.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e1) { sec.scrollIntoView(); }
                }
                return;
            }
            var qBtn = ev.target.closest && ev.target.closest('button.faq-q');
            if (qBtn) toggleItem(qBtn.getAttribute('data-faq-id'));
        });

        if (openId) {
            setTimeout(function() {
                var el = document.getElementById('faqItem-' + openId);
                if (el) try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e2) { el.scrollIntoView(); }
            }, 50);
        }
    };

})();