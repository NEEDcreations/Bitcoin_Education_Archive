// ============================================================
// Bitcoin Education Archive — Onboarding & Simplification System
// 
// PURPOSE: Reduces overwhelm for new users with a 3-step
// onboarding wizard and a progressively-revealed home page.
//
// LOAD: After bundle.js, before app.js
// <script src="onboarding.js?v=20260307" defer></script>
//
// HOW IT WORKS:
// 1. First-time visitors see a 3-step wizard (welcome → level → interests)
// 2. Profile is saved to localStorage as btc_onboarding_profile
// 3. Home page is simplified based on their level:
//    - Beginners: only 4 curated channels + Nacho CTA
//    - Intermediate: curated channels + Browse All + some features
//    - Advanced: full experience (current behavior)
// 4. Users can always access everything via "Browse all channels"
// 5. After 5+ channels visited, gamification elements fade in
// ============================================================

(function () {
    'use strict';

    // ─── CONFIG ───────────────────────────────────────────
    var ONBOARDING_KEY = 'btc_onboarding_profile';
    var ONBOARDING_COMPLETE_KEY = 'btc_onboarding_done';

    // Recommended starting channels per level
    var CURATED_CHANNELS = {
        beginner: [
            { id: 'one-stop-shop', reason: 'The best place to start' },
            { id: 'whitepaper', reason: 'The 9 pages that started it all' },
            { id: 'money', reason: 'Why Bitcoin is real money' },
            { id: 'self-custody', reason: 'How to truly own your Bitcoin' },
        ],
        intermediate: [
            { id: 'layer-2-lightning', reason: 'Instant Bitcoin payments' },
            { id: 'mining', reason: 'How the network is secured' },
            { id: 'privacy-nonkyc', reason: 'Financial sovereignty' },
            { id: 'investment-strategy', reason: 'DCA, HODL, and beyond' },
        ],
        advanced: [
            { id: 'maximalism', reason: 'The Bitcoin-only thesis' },
            { id: 'cryptography', reason: 'SHA-256 and elliptic curves' },
            { id: 'developers', reason: 'Build on Bitcoin' },
            { id: 'pow-vs-pos', reason: 'Why proof of work wins' },
        ],
    };

    // Interest tags → channel mapping
    var INTEREST_CHANNELS = {
        'Why Bitcoin?': ['one-stop-shop', 'money', 'problems-of-money'],
        'How to buy': ['investment-strategy', 'self-custody'],
        'Security & wallets': ['self-custody', 'hardware', 'cryptography'],
        'Lightning Network': ['layer-2-lightning', 'fedi-ark'],
        'Mining & energy': ['mining', 'energy', 'difficulty-adjustment'],
        'Privacy': ['privacy-nonkyc', 'nostr'],
        'History & culture': ['history', 'satoshi-nakamoto', 'fun-facts'],
        'Economics': ['money', 'problems-of-money', 'investment-strategy'],
    };

    // ─── PROFILE MANAGEMENT ───────────────────────────────
    window.getOnboardingProfile = function () {
        try {
            var raw = localStorage.getItem(ONBOARDING_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    };

    window.setOnboardingProfile = function (profile) {
        try {
            localStorage.setItem(ONBOARDING_KEY, JSON.stringify(profile));
            localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
        } catch (e) { }
    };

    window.isOnboardingComplete = function () {
        return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true';
    };

    window.getUserSimplificationLevel = function () {
        // Returns: 'beginner' | 'intermediate' | 'advanced' | 'full'
        var profile = window.getOnboardingProfile();
        if (!profile) return 'beginner'; // Default for non-onboarded users

        var visited = [];
        try { visited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]'); } catch (e) { }

        // After visiting 15+ channels, auto-upgrade to full
        if (visited.length >= 15) return 'full';
        // After visiting 8+ channels, upgrade intermediate users
        if (visited.length >= 8 && profile.level !== 'beginner') return 'full';

        return profile.level || 'beginner';
    };

    // ─── ONBOARDING WIZARD ────────────────────────────────
    window.showOnboardingWizard = function () {
        // Don't show if already completed
        if (window.isOnboardingComplete()) return false;
        // Don't show if returning user with visited channels
        var visited = [];
        try { visited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]'); } catch (e) { }
        if (visited.length >= 3) {
            // Silently mark as complete for existing users
            window.setOnboardingProfile({ level: 'intermediate', interests: [], skipped: true });
            return false;
        }

        _buildWizardUI();
        return true;
    };

    function _buildWizardUI() {
        var overlay = document.createElement('div');
        overlay.id = 'onboardingOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#020617;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;font-family:inherit;';

        var state = { step: 0, level: null, interests: [] };

        function render() {
            var html = '';

            // Progress dots
            html += '<div style="display:flex;gap:8px;margin-bottom:40px;">';
            for (var i = 0; i < 3; i++) {
                var isActive = i <= state.step;
                var isCurrent = i === state.step;
                html += '<div style="width:' + (isCurrent ? '24' : '8') + 'px;height:8px;border-radius:4px;background:' + (isActive ? '#f97316' : '#1e293b') + ';transition:all 0.4s;"></div>';
            }
            html += '</div>';

            // Content area
            html += '<div id="onboardingContent" style="max-width:480px;width:100%;text-align:center;">';

            if (state.step === 0) {
                // ── WELCOME ──
                html += '<div style="width:100px;height:100px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ea580c);margin:0 auto 24px;display:flex;align-items:center;justify-content:center;font-size:48px;box-shadow:0 0 60px rgba(249,115,22,0.3);">₿</div>';
                html += '<h1 style="color:#fff;font-size:1.8rem;font-weight:900;margin:0 0 12px;letter-spacing:-0.5px;">Welcome to the Archive</h1>';
                html += '<p style="color:#64748b;font-size:1.05rem;line-height:1.6;margin:0 0 32px;">A free Bitcoin education library with 146 topics, curated by Bitcoiners for the world.</p>';
                html += '<p style="color:#475569;font-size:0.85rem;margin:0;">No account required. Free forever. No ads.</p>';
            }

            else if (state.step === 1) {
                // ── EXPERIENCE LEVEL ──
                html += '<div style="font-size:2.5rem;margin-bottom:16px;">🎯</div>';
                html += '<h1 style="color:#fff;font-size:1.5rem;font-weight:900;margin:0 0 8px;">How much do you know?</h1>';
                html += '<p style="color:#64748b;font-size:0.9rem;margin:0 0 28px;">This helps us personalize your experience.</p>';

                var levels = [
                    { value: 'beginner', emoji: '🌱', label: 'Brand new to Bitcoin', desc: 'Start with the basics' },
                    { value: 'intermediate', emoji: '📘', label: 'I know a little', desc: 'Skip the intro stuff' },
                    { value: 'advanced', emoji: '⚡', label: 'I\'m experienced', desc: 'Show me everything' },
                ];

                levels.forEach(function (opt) {
                    var selected = state.level === opt.value;
                    html += '<button onclick="window._onboardingSelectLevel(\'' + opt.value + '\')" style="display:flex;align-items:center;gap:14px;padding:16px 20px;background:' + (selected ? 'rgba(249,115,22,0.1)' : 'rgba(255,255,255,0.04)') + ';border:2px solid ' + (selected ? '#f97316' : '#1e293b') + ';border-radius:14px;cursor:pointer;width:100%;text-align:left;color:#e2e8f0;font-family:inherit;margin-bottom:10px;transition:all 0.2s;">';
                    html += '<span style="font-size:1.5rem;flex-shrink:0;">' + opt.emoji + '</span>';
                    html += '<div><div style="font-weight:700;font-size:0.95rem;">' + opt.label + '</div>';
                    html += '<div style="color:#64748b;font-size:0.8rem;margin-top:2px;">' + opt.desc + '</div></div>';
                    if (selected) html += '<span style="margin-left:auto;color:#f97316;font-size:1.2rem;">✓</span>';
                    html += '</button>';
                });
            }

            else if (state.step === 2) {
                // ── INTERESTS ──
                html += '<div style="font-size:2.5rem;margin-bottom:16px;">💡</div>';
                html += '<h1 style="color:#fff;font-size:1.5rem;font-weight:900;margin:0 0 8px;">What interests you?</h1>';
                html += '<p style="color:#64748b;font-size:0.9rem;margin:0 0 28px;">Pick a few and we\'ll build your starting path.</p>';

                var tags = [
                    { label: 'Why Bitcoin?', emoji: '❓' },
                    { label: 'How to buy', emoji: '🛒' },
                    { label: 'Security & wallets', emoji: '🔑' },
                    { label: 'Lightning Network', emoji: '⚡' },
                    { label: 'Mining & energy', emoji: '⛏️' },
                    { label: 'Privacy', emoji: '🕵️' },
                    { label: 'History & culture', emoji: '📜' },
                    { label: 'Economics', emoji: '💰' },
                ];

                html += '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">';
                tags.forEach(function (tag) {
                    var selected = state.interests.indexOf(tag.label) !== -1;
                    html += '<button onclick="window._onboardingToggleInterest(\'' + tag.label + '\')" style="padding:10px 16px;border-radius:20px;background:' + (selected ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.04)') + ';border:1.5px solid ' + (selected ? '#f97316' : '#1e293b') + ';color:' + (selected ? '#f97316' : '#e2e8f0') + ';cursor:pointer;font-size:0.85rem;font-weight:600;font-family:inherit;transition:all 0.2s;display:flex;align-items:center;gap:6px;">';
                    html += tag.emoji + ' ' + tag.label;
                    html += '</button>';
                });
                html += '</div>';
            }

            html += '</div>'; // End content

            // CTA button
            var canAdvance = state.step === 0 || (state.step === 1 && state.level) || (state.step === 2 && state.interests.length >= 1);
            var isLast = state.step === 2;

            html += '<div style="margin-top:36px;width:100%;max-width:480px;">';
            html += '<button id="onboardingCTA" onclick="window._onboardingAdvance()" ' + (canAdvance ? '' : 'disabled') + ' style="width:100%;padding:16px 0;background:' + (canAdvance ? 'linear-gradient(135deg,#f97316,#ea580c)' : '#1e293b') + ';color:' + (canAdvance ? '#fff' : '#475569') + ';border:none;border-radius:14px;font-size:1.05rem;font-weight:800;cursor:' + (canAdvance ? 'pointer' : 'default') + ';font-family:inherit;transition:all 0.3s;letter-spacing:0.3px;box-shadow:' + (canAdvance ? '0 8px 30px rgba(249,115,22,0.3)' : 'none') + ';">';
            html += isLast ? 'Start Exploring →' : 'Continue';
            html += '</button>';

            // Skip option on first step
            if (state.step === 0) {
                html += '<button onclick="window._onboardingSkip()" style="width:100%;margin-top:10px;padding:12px 0;background:none;border:1px solid #1e293b;border-radius:12px;color:#475569;font-size:0.85rem;cursor:pointer;font-family:inherit;">Skip — I\'ll explore on my own</button>';
            }
            html += '</div>';

            overlay.innerHTML = html;
        }

        // ── Wizard Actions ──
        window._onboardingSelectLevel = function (level) {
            state.level = level;
            render();
        };

        window._onboardingToggleInterest = function (interest) {
            var idx = state.interests.indexOf(interest);
            if (idx !== -1) state.interests.splice(idx, 1);
            else state.interests.push(interest);
            render();
        };

        window._onboardingAdvance = function () {
            if (state.step < 2) {
                state.step++;
                render();
            } else {
                _completeOnboarding(state);
            }
        };

        window._onboardingSkip = function () {
            _completeOnboarding({ step: 0, level: 'beginner', interests: [] });
        };

        function _completeOnboarding(finalState) {
            window.setOnboardingProfile({
                level: finalState.level || 'beginner',
                interests: finalState.interests || [],
                completedAt: Date.now(),
            });

            // Animate out
            overlay.style.transition = 'opacity 0.4s';
            overlay.style.opacity = '0';
            setTimeout(function () {
                overlay.remove();
                // Trigger home page simplification
                if (typeof window.applySimplifiedHome === 'function') {
                    window.applySimplifiedHome();
                }
                // Clean up global handlers
                delete window._onboardingSelectLevel;
                delete window._onboardingToggleInterest;
                delete window._onboardingAdvance;
                delete window._onboardingSkip;
            }, 400);
        }

        render();
        document.body.appendChild(overlay);
    }

    // ─── SIMPLIFIED HOME PAGE ─────────────────────────────
    // Modifies the existing home page based on user level.
    // Hides overwhelming elements for beginners, reveals progressively.

    window.applySimplifiedHome = function () {
        var level = window.getUserSimplificationLevel();
        var profile = window.getOnboardingProfile();

        // Full mode: don't touch anything
        if (level === 'full' || level === 'advanced') return;

        // ── Elements to HIDE for beginners ──
        var hideSelectors = {
            beginner: [
                '#giveawayBanner',           // Sats giveaway banner
                '#dailySpinBanner',          // Daily spin
                '#welcomeBanner',            // Welcome back banner
                '#progressRings',            // Progress rings
                '#appStatsPanel',            // App stats
                '#dailyChallengeCard',       // Daily challenge
                '#quoteOfDay',               // Quote of the day
                '#explorationMap',           // Exploration map
                '#donateSection',            // Donate section
                '[onclick*="showSpinWheel"]',    // Spin button
                '[onclick*="showPricePrediction"]', // Predict button
                '.desktop-only-apps',        // Explore Apps mega-menu
                '[onclick*="toggleSidebarMenu(\'homeSupportMenu\')"]', // Support dropdown
                '#homeSupportMenu',
                '#lbFloatBtn',               // Floating leaderboard
                '#desktopDMBtn',             // DMs button
                '#rankBar',                  // Rank bar
                '#activity-ticker',          // Live activity ticker
                '#continueReading',          // Continue reading (empty anyway)
            ],
            intermediate: [
                '#giveawayBanner',
                '#dailySpinBanner',
                '#progressRings',
                '#explorationMap',
                '#activity-ticker',
            ],
        };

        var toHide = hideSelectors[level] || [];
        toHide.forEach(function (sel) {
            var els = document.querySelectorAll(sel);
            els.forEach(function (el) {
                el.setAttribute('data-simplified-hidden', 'true');
                el.style.display = 'none';
            });
        });

        // ── Inject curated "Start Here" section ──
        var curated = CURATED_CHANNELS[level] || CURATED_CHANNELS.beginner;
        if (profile && profile.interests && profile.interests.length > 0) {
            // Add interest-based channels
            var extraIds = [];
            profile.interests.forEach(function (interest) {
                var ids = INTEREST_CHANNELS[interest] || [];
                ids.forEach(function (id) { if (extraIds.indexOf(id) === -1) extraIds.push(id); });
            });
            // Merge, deduplicate, cap at 6
            var allIds = curated.map(function (c) { return c.id; });
            extraIds.forEach(function (id) {
                if (allIds.indexOf(id) === -1 && allIds.length < 6) {
                    allIds.push(id);
                    curated.push({ id: id, reason: 'Based on your interests' });
                }
            });
        }

        _injectCuratedSection(curated, level);

        // ── Simplify the CTA area ──
        var authBtn = document.getElementById('authBtn');
        if (authBtn && level === 'beginner') {
            // Move sign-in below curated channels, make it subtle
            authBtn.style.background = 'none';
            authBtn.style.border = '1px solid var(--border)';
            authBtn.style.color = 'var(--text-muted)';
            authBtn.style.fontSize = '0.85rem';
            authBtn.style.fontWeight = '600';
            authBtn.textContent = '🔐 Create account to save progress';
        }

        // ── Simplify sidebar for beginners ──
        if (level === 'beginner') {
            // Collapse all categories by default (they already are, but ensure)
            document.querySelectorAll('.cat-toggle').forEach(function (toggle) {
                toggle.setAttribute('data-expanded', 'false');
                var group = toggle.nextElementSibling;
                if (group && group.classList.contains('cat-group')) {
                    group.style.display = 'none';
                }
                var arrow = toggle.querySelector('.cat-arrow');
                if (arrow) arrow.textContent = '▶';
            });
        }

        // ── Sponsor section: always hide for new users ──
        var sponsorEl = document.querySelector('[onclick*="Sponsorship"]');
        if (sponsorEl) {
            var sponsorSection = sponsorEl.closest('div[style*="dashed"]');
            if (sponsorSection) sponsorSection.style.display = 'none';
        }
    };

    function _injectCuratedSection(channels, level) {
        var home = document.getElementById('home');
        if (!home) return;

        // Don't inject twice
        if (document.getElementById('curatedStartSection')) return;

        var section = document.createElement('div');
        section.id = 'curatedStartSection';
        section.style.cssText = 'width:100%;max-width:480px;margin:0 auto 28px;text-align:left;';

        var label = level === 'beginner' ? '🟢 Start here' : '📌 Recommended for you';
        var html = '<div style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1.5px;font-weight:800;margin-bottom:12px;">' + label + '</div>';

        channels.forEach(function (ch, i) {
            var meta = (typeof CHANNELS !== 'undefined') ? CHANNELS[ch.id] : null;
            if (!meta) return;
            var emoji = meta.title ? meta.title.match(/^([\u{1F000}-\u{1FFFF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}]+)/u) : null;
            var icon = emoji ? emoji[1] : '📄';
            var name = ch.id.replace(/-/g, ' ').replace(/\b\w/g, function (l) { return l.toUpperCase(); });

            html += '<button onclick="go(\'' + ch.id + '\')" style="display:flex;align-items:center;gap:14px;padding:16px 18px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:14px;cursor:pointer;text-align:left;font-family:inherit;color:var(--text);width:100%;margin-bottom:8px;transition:all 0.2s;animation:obSlideIn 0.4s ease-out ' + (i * 0.08) + 's both;" onmouseover="this.style.borderColor=\'rgba(249,115,22,0.4)\';this.style.background=\'rgba(249,115,22,0.05)\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.background=\'rgba(255,255,255,0.03)\'">';
            html += '<span style="font-size:1.4rem;width:44px;height:44px;border-radius:12px;background:rgba(249,115,22,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + icon + '</span>';
            html += '<div style="flex:1;min-width:0;"><div style="font-weight:700;font-size:0.95rem;">' + name + '</div>';
            html += '<div style="color:var(--text-muted);font-size:0.8rem;margin-top:2px;">' + (ch.reason || '') + '</div></div>';
            html += '<span style="color:var(--text-faint);font-size:1rem;flex-shrink:0;">→</span>';
            html += '</button>';
        });

        // Nacho CTA (always shown, single calm card)
        html += '<div onclick="if(typeof enterNachoMode===\'function\')enterNachoMode()" style="padding:20px;background:linear-gradient(135deg,rgba(249,115,22,0.06),rgba(249,115,22,0.02));border:1px dashed rgba(249,115,22,0.25);border-radius:16px;margin-top:20px;display:flex;align-items:center;gap:14px;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.borderColor=\'rgba(249,115,22,0.5)\'" onmouseout="this.style.borderColor=\'rgba(249,115,22,0.25)\'">';
        html += '<span style="font-size:2rem;">🦌</span>';
        html += '<div><div style="font-weight:700;font-size:0.9rem;color:var(--heading);">Ask Nacho anything</div>';
        html += '<div style="color:var(--text-muted);font-size:0.8rem;margin-top:2px;">Our AI tutor explains Bitcoin in plain language</div></div>';
        html += '</div>';

        section.innerHTML = html;

        // Inject after subtitle, before all the noise
        var subtitle = home.querySelector('.home-subtitle');
        if (subtitle) {
            subtitle.parentNode.insertBefore(section, subtitle.nextSibling);
        }

        // Add animation keyframes
        if (!document.getElementById('obAnimStyle')) {
            var style = document.createElement('style');
            style.id = 'obAnimStyle';
            style.textContent = '@keyframes obSlideIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }';
            document.head.appendChild(style);
        }
    }

    // ─── PROGRESSIVE REVEAL ───────────────────────────────
    // As users explore more, hidden elements gradually appear.
    window.checkProgressiveReveal = function () {
        var visited = [];
        try { visited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]'); } catch (e) { }

        // After 5 channels: show daily spin, leaderboard
        if (visited.length >= 5) {
            _revealElements(['#lbFloatBtn', '[onclick*="showSpinWheel"]']);
        }
        // After 10 channels: show everything
        if (visited.length >= 10) {
            document.querySelectorAll('[data-simplified-hidden]').forEach(function (el) {
                el.style.display = '';
                el.removeAttribute('data-simplified-hidden');
            });
        }
    };

    function _revealElements(selectors) {
        selectors.forEach(function (sel) {
            var els = document.querySelectorAll(sel);
            els.forEach(function (el) {
                if (el.getAttribute('data-simplified-hidden')) {
                    el.style.display = '';
                    el.removeAttribute('data-simplified-hidden');
                }
            });
        });
    }

    // ─── INITIALIZATION ───────────────────────────────────
    function init() {
        // Show onboarding for first-time users
        var shown = window.showOnboardingWizard();

        // If not showing wizard (returning user), apply simplification
        if (!shown) {
            window.applySimplifiedHome();
        }

        // Check progressive reveal on every channel visit
        var _origGo = window.go;
        if (typeof _origGo === 'function') {
            window.go = function () {
                var result = _origGo.apply(this, arguments);
                // Check after navigation completes
                setTimeout(window.checkProgressiveReveal, 1000);
                return result;
            };
        }
    }

    // Run after DOM + other scripts are ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 500); });
    } else {
        setTimeout(init, 500);
    }

    console.log('[ONBOARDING] System loaded');
})();
