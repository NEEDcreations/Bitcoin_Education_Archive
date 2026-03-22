!function() {
"use strict";

var PROFILE_KEY = 'btc_onboarding_profile';
var DONE_KEY = 'btc_onboarding_done';

var STARTER_CHANNELS = {
    beginner: [
        { id: 'one-stop-shop', reason: 'The best place to start' },
        { id: 'whitepaper', reason: 'The 9 pages that started it all' },
        { id: 'money', reason: 'Why Bitcoin is real money' },
        { id: 'misconceptions-fud', reason: 'Common myths debunked' },
        { id: 'self-custody', reason: 'How to truly own your Bitcoin' },
        { id: 'elevator_pitches', reason: 'Quick ways to explain Bitcoin' }
    ],
    intermediate: [
        { id: 'layer-2-lightning', reason: 'Instant Bitcoin payments' },
        { id: 'mining', reason: 'How the network is secured' },
        { id: 'privacy-nonkyc', reason: 'Financial sovereignty' },
        { id: 'investment-strategy', reason: 'DCA, HODL, and beyond' },
        { id: 'evidence-against-alts', reason: 'Why Bitcoin, not crypto' },
        { id: 'history', reason: 'How it all began' }
    ],
    advanced: [
        { id: 'maximalism', reason: 'The Bitcoin-only thesis' },
        { id: 'cryptography', reason: 'SHA-256 and elliptic curves' },
        { id: 'developers', reason: 'Build on Bitcoin' },
        { id: 'pow-vs-pos', reason: 'Why proof of work wins' },
        { id: 'nodes', reason: "Don't trust, verify" },
        { id: 'core-source-code', reason: 'Bitcoin Core internals' }
    ]
};

var INTEREST_MAP = {
    "Why Bitcoin?": ["one-stop-shop","money","misconceptions-fud","elevator_pitches","orange-pilling","analogies","dominant","faq-glossary","whitepaper"],
    "How to buy & use": ["investment-strategy","self-custody","apps-tools","100_sats","sats__or__bits","swaps"],
    "Security & wallets": ["self-custody","hardware","cryptography","public_key_vs_private_key","derivation_path","utxos"],
    "Lightning Network": ["layer-2-lightning","fedi-ark","lightning_node","submarine_swap","chaumian-mints"],
    "Mining & energy": ["mining","energy","difficulty-adjustment","environment___energy","0_mining__hashing"],
    "Privacy & freedom": ["privacy-nonkyc","nostr","coin_mixing_coinjoin_coin_control_utxo","human_rights__social_justice_and_freedo","peaceful"],
    "History & culture": ["history","satoshi-nakamoto","fun-facts","poems-stories"],
    "Economics & money": ["money","problems-of-money","austrian_school_of_economics","market_cap","bitcoin_vs_real_estate"],
    "Geopolitics & adoption": ["geopolitics___macroeconomics","regulation","news-adoption","politics","international","predictions"],
    "Technical deep dives": ["blockchain-timechain","nodes","pow-vs-pos","taproot","core-source-code","consensus","scalability"],
    "Art, memes & media": ["art-inspiration","memes-funny","graphics","music","movies-tv","videos","poems-stories"],
    "Books & learning": ["books","articles-threads","curriculum","podcasts","informational-sites","research-theses"],
    "Philosophy & ethics": ["philosophy","faith___religion","time_preference","game_theory","peace_and_anti-war","feedback_loops"],
    "Building & DIY": ["projects-diy","hardware","developers","nodes","free_and_open_source_software__foss","ham_radio"],
    "Bitcoin properties": ["scarce","secure","decentralized","organic","programmable","supranational","peaceful","dominant"],
    "Real-world use cases": ["use-cases","jobs-earn","swag-merch","referral-links","apps-tools","layer-2-lightning"]
};

// ---- Helpers ----
window.getOnboardingProfile = function() {
    try { var s = localStorage.getItem(PROFILE_KEY); return s ? JSON.parse(s) : null; } catch(e) { return null; }
};
window.setOnboardingProfile = function(p) {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); localStorage.setItem(DONE_KEY, 'true'); } catch(e) {}
};
window.isOnboardingComplete = function() {
    return localStorage.getItem(DONE_KEY) === 'true';
};
window.getUserSimplificationLevel = function() {
    var p = window.getOnboardingProfile();
    if (!p) return 'beginner';
    var v = [];
    try { v = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]'); } catch(e) {}
    if (v.length >= 15 || (v.length >= 8 && p.level !== 'beginner')) return 'full';
    return p.level || 'beginner';
};

// ---- Two-Step Onboarding Wizard ----
// Step 1: Welcome + pick level
// Step 2: Interest picker (optional) — highlights channels for you
window.showOnboardingWizard = function() {
    if (window.isOnboardingComplete()) return false;
    var visited = [];
    try { visited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]'); } catch(e) {}
    if (visited.length >= 3) {
        window.setOnboardingProfile({ level: 'intermediate', interests: [], skipped: true });
        return false;
    }
    var hash = window.location.hash.replace('#', '');
    if (hash && hash.length > 0) {
        window.setOnboardingProfile({ level: 'intermediate', interests: [], skipped: true, directLink: hash });
        return false;
    }

    var overlay = document.createElement('div');
    overlay.id = 'onboardingOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#020617;display:flex;flex-direction:column;align-items:center;padding:20px;font-family:inherit;overflow-y:auto;-webkit-overflow-scrolling:touch;justify-content:flex-start;padding-top:30px;';

    var state = { step: 0, level: null, interests: [] };

    var INTEREST_TOPICS = [
        { label: 'Why Bitcoin?', emoji: '❓' },
        { label: 'How to buy & use', emoji: '🛒' },
        { label: 'Security & wallets', emoji: '🔑' },
        { label: 'Lightning Network', emoji: '⚡' },
        { label: 'Mining & energy', emoji: '⛏️' },
        { label: 'Privacy & freedom', emoji: '🕵️' },
        { label: 'History & culture', emoji: '📜' },
        { label: 'Economics & money', emoji: '💰' },
        { label: 'Geopolitics & adoption', emoji: '🌍' },
        { label: 'Technical deep dives', emoji: '🔧' },
        { label: 'Art, memes & media', emoji: '🎨' },
        { label: 'Books & learning', emoji: '📚' },
        { label: 'Philosophy & ethics', emoji: '🍎' },
        { label: 'Building & DIY', emoji: '🔨' },
        { label: 'Bitcoin properties', emoji: '₿' },
        { label: 'Real-world use cases', emoji: '✅' }
    ];

    function finish(level, interests) {
        window.setOnboardingProfile({ level: level || 'beginner', interests: interests || [], completedAt: Date.now() });
        overlay.style.transition = 'opacity 0.4s';
        overlay.style.opacity = '0';
        setTimeout(function() {
            overlay.remove();
            if (typeof window.applySimplifiedHome === 'function') window.applySimplifiedHome();
        }, 400);
    }

    function render() {
        var html = '';

        // Step dots
        html += '<div style="display:flex;gap:8px;margin-bottom:24px;">';
        for (var d = 0; d < 2; d++) {
            var active = d === state.step;
            html += '<div style="width:' + (active ? '24' : '8') + 'px;height:8px;border-radius:4px;background:' + (d <= state.step ? '#f97316' : '#1e293b') + ';transition:all 0.4s;"></div>';
        }
        html += '</div>';

        html += '<div style="max-width:440px;width:100%;text-align:center;">';

        if (state.step === 0) {
            // ---- STEP 1: Welcome + Level Pick ----
            html += '<div style="font-size:4rem;margin-bottom:8px;">🦌</div>' +
                '<h1 style="color:#fff;font-size:1.5rem;font-weight:900;margin:0 0 6px;">Welcome to Bitcoin Education</h1>' +
                '<p style="color:#94a3b8;font-size:0.92rem;line-height:1.5;margin:0 0 6px;">146 channels of Bitcoin knowledge. Read channels, earn points, level up.</p>' +
                '<p style="color:#475569;font-size:0.8rem;margin:0 0 20px;">Free forever. No account needed. No ads.</p>' +

                // How it works
                '<div style="display:flex;gap:10px;margin-bottom:20px;text-align:center;">' +
                    '<div style="flex:1;padding:12px 8px;background:rgba(249,115,22,0.06);border:1px solid rgba(249,115,22,0.15);border-radius:12px;">' +
                        '<div style="font-size:1.3rem;">📖</div>' +
                        '<div style="color:#f97316;font-size:0.7rem;font-weight:800;margin-top:4px;">READ</div>' +
                        '<div style="color:#64748b;font-size:0.65rem;margin-top:2px;">Tap a channel</div>' +
                    '</div>' +
                    '<div style="flex:1;padding:12px 8px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:12px;">' +
                        '<div style="font-size:1.3rem;">⭐</div>' +
                        '<div style="color:#22c55e;font-size:0.7rem;font-weight:800;margin-top:4px;">EARN</div>' +
                        '<div style="color:#64748b;font-size:0.65rem;margin-top:2px;">Get points & badges</div>' +
                    '</div>' +
                    '<div style="flex:1;padding:12px 8px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:12px;">' +
                        '<div style="font-size:1.3rem;">🏆</div>' +
                        '<div style="color:#6366f1;font-size:0.7rem;font-weight:800;margin-top:4px;">LEVEL UP</div>' +
                        '<div style="color:#64748b;font-size:0.65rem;margin-top:2px;">Climb the ranks</div>' +
                    '</div>' +
                '</div>' +

                '<div style="font-size:0.7rem;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;font-weight:800;margin-bottom:10px;">How deep in the rabbit hole are you?</div>';

            var levels = [
                { value: 'beginner', emoji: '🌱', label: 'New to Bitcoin', desc: "I'll start you with the basics" },
                { value: 'intermediate', emoji: '📘', label: 'I know some Bitcoin', desc: "I'll skip the intro stuff" },
                { value: 'advanced', emoji: '🔥', label: "I'm a Bitcoiner", desc: 'Full access — show me everything' }
            ];

            levels.forEach(function(lv) {
                var sel = state.level === lv.value;
                html += '<button onclick="window._obSelectLevel(\'' + lv.value + '\')" style="display:flex;align-items:center;gap:14px;padding:14px 18px;background:' + (sel ? 'rgba(249,115,22,0.1)' : 'rgba(255,255,255,0.03)') + ';border:2px solid ' + (sel ? '#f97316' : '#1e293b') + ';border-radius:14px;cursor:pointer;width:100%;text-align:left;color:#e2e8f0;font-family:inherit;margin-bottom:8px;transition:all 0.2s;">' +
                    '<span style="font-size:1.5rem;flex-shrink:0;">' + lv.emoji + '</span>' +
                    '<div style="flex:1;"><div style="font-weight:700;font-size:0.95rem;">' + lv.label + '</div>' +
                    '<div style="color:#64748b;font-size:0.78rem;margin-top:2px;">' + lv.desc + '</div></div>' +
                    (sel ? '<span style="color:#f97316;font-size:1.2rem;">✓</span>' : '') +
                '</button>';
            });

            // Continue button
            var canContinue = !!state.level;
            html += '<div style="margin-top:14px;">' +
                '<button id="onboardingCTA" onclick="window._obAdvance()" ' + (canContinue ? '' : 'disabled') + ' style="width:100%;padding:16px 0;background:' + (canContinue ? 'linear-gradient(135deg,#f97316,#ea580c)' : '#1e293b') + ';color:' + (canContinue ? '#fff' : '#475569') + ';border:none;border-radius:14px;font-size:1.05rem;font-weight:800;cursor:' + (canContinue ? 'pointer' : 'default') + ';font-family:inherit;transition:all 0.3s;box-shadow:' + (canContinue ? '0 8px 30px rgba(249,115,22,0.3)' : 'none') + ';">Continue</button>' +
                '<button onclick="window._obSignIn()" style="width:100%;margin-top:10px;padding:13px 0;background:none;border:1.5px solid #334155;border-radius:12px;color:#94a3b8;font-size:0.88rem;font-weight:600;cursor:pointer;font-family:inherit;">🔐 Already have an account? Sign in</button>' +
                '<button onclick="window._obSkip()" style="width:100%;margin-top:8px;padding:10px 0;background:none;border:none;color:#475569;font-size:0.78rem;cursor:pointer;font-family:inherit;">Skip — I\'ll explore on my own</button>' +
            '</div>';

        } else if (state.step === 1) {
            // ---- STEP 2: Interest Picker ----
            html += '<div style="font-size:3rem;margin-bottom:8px;">🎯</div>' +
                '<h1 style="color:#fff;font-size:1.4rem;font-weight:900;margin:0 0 6px;">What interests you?</h1>' +
                '<p style="color:#64748b;font-size:0.85rem;margin:0 0 6px;">Pick topics and we\'ll highlight the best channels for you.</p>' +
                '<div style="color:' + (state.interests.length >= 1 ? '#22c55e' : '#f97316') + ';font-size:0.75rem;font-weight:700;margin-bottom:14px;">' + state.interests.length + ' selected</div>' +
                '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">';

            INTEREST_TOPICS.forEach(function(topic) {
                var sel = state.interests.indexOf(topic.label) !== -1;
                html += '<button onclick="window._obToggleInterest(\'' + topic.label.replace(/'/g, "\\'") + '\')" style="padding:9px 14px;border-radius:20px;background:' + (sel ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.04)') + ';border:1.5px solid ' + (sel ? '#f97316' : '#1e293b') + ';color:' + (sel ? '#f97316' : '#e2e8f0') + ';cursor:pointer;font-size:0.82rem;font-weight:600;font-family:inherit;transition:all 0.2s;display:flex;align-items:center;gap:5px;">' +
                    topic.emoji + ' ' + topic.label + '</button>';
            });

            html += '</div>' +
                '<div style="margin-top:18px;">' +
                    '<button onclick="window._obFinishWithInterests()" style="width:100%;padding:16px 0;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;border:none;border-radius:14px;font-size:1.05rem;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 8px 30px rgba(249,115,22,0.3);">Start Exploring →</button>' +
                    '<button onclick="window._obBack()" style="width:100%;margin-top:10px;padding:12px 0;background:none;border:1px solid #1e293b;border-radius:12px;color:#475569;font-size:0.85rem;cursor:pointer;font-family:inherit;">← Back</button>' +
                    '<button onclick="window._obSkipInterests()" style="width:100%;margin-top:8px;padding:10px 0;background:none;border:none;color:#475569;font-size:0.78rem;cursor:pointer;font-family:inherit;">Skip — just show me everything</button>' +
                '</div>';
        }

        html += '</div>';
        overlay.innerHTML = html;
    }

    // Event handlers
    window._obSelectLevel = function(level) { state.level = level; render(); };
    window._obAdvance = function() { if (state.level) { state.step = 1; render(); overlay.scrollTop = 0; } };
    window._obBack = function() { state.step = 0; render(); overlay.scrollTop = 0; };
    window._obToggleInterest = function(label) {
        var idx = state.interests.indexOf(label);
        if (idx !== -1) state.interests.splice(idx, 1); else state.interests.push(label);
        render();
    };
    window._obFinishWithInterests = function() { finish(state.level, state.interests); };
    window._obSkipInterests = function() { finish(state.level, []); };
    window._obSignIn = function() {
        finish('intermediate', []);
        setTimeout(function() { if (typeof showSignInOnly === 'function') showSignInOnly(); else if (typeof showUsernamePrompt === 'function') showUsernamePrompt(); }, 500);
    };
    window._obSkip = function() { finish('intermediate', []); };

    render();
    document.body.appendChild(overlay);
    return true;
};

// ---- Simplified Home (after onboarding) ----
window.applySimplifiedHome = function() {
    var level = window.getUserSimplificationLevel();
    var profile = window.getOnboardingProfile();
    if (level === 'full' || level === 'advanced') return;

    // Hide elements based on level
    var hideSelectors = {
        beginner: [
            '#giveawayBanner', '#dailySpinBanner', '#welcomeBanner', '#progressRings',
            '#appStatsPanel', '#dailyChallengeCard', '#quoteOfDay', '#explorationMap',
            '#donateSection', '[onclick*="showSpinWheel"]', '[onclick*="showPricePrediction"]',
            '.desktop-only-apps', "[onclick*=\"toggleSidebarMenu('homeSupportMenu')\"]",
            '#homeSupportMenu', '#lbFloatBtn', '#desktopDMBtn', '#rankBar',
            '#activity-ticker', '#continueReading'
        ],
        intermediate: ['#giveawayBanner', '#dailySpinBanner', '#progressRings', '#explorationMap', '#activity-ticker']
    };

    (hideSelectors[level] || []).forEach(function(sel) {
        document.querySelectorAll(sel).forEach(function(el) {
            el.setAttribute('data-simplified-hidden', 'true');
            el.style.display = 'none';
        });
    });

    // For beginners: also hide Nacho floating sprite (less distraction)
    if (level === 'beginner') {
        var nachoC = document.getElementById('nacho-container');
        if (nachoC) { nachoC.setAttribute('data-simplified-hidden', 'true'); nachoC.style.display = 'none'; }

        // Simplify bottom nav: only Home, Learn, Settings for first few channels
        var visited = [];
        try { visited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]'); } catch(e) {}
        if (visited.length < 5) {
            var bnavApps = document.getElementById('bnavApps');
            var bnavMsg = document.getElementById('bnavMsg');
            if (bnavApps) { bnavApps.setAttribute('data-simplified-hidden', 'true'); bnavApps.style.display = 'none'; }
            if (bnavMsg) { bnavMsg.setAttribute('data-simplified-hidden', 'true'); bnavMsg.style.display = 'none'; }
        }
    }

    // Build curated channel list
    var channels = STARTER_CHANNELS[level] || STARTER_CHANNELS.beginner;
    var curated = [];
    var seen = [];

    // Add interest-based channels if available
    if (profile && profile.interests && profile.interests.length > 0) {
        var interestChannels = [];
        profile.interests.forEach(function(interest) {
            (INTEREST_MAP[interest] || []).forEach(function(ch) {
                if (interestChannels.indexOf(ch) === -1) interestChannels.push(ch);
            });
        });
        interestChannels.forEach(function(ch) {
            if (seen.indexOf(ch) === -1 && curated.length < 6) {
                seen.push(ch);
                var reason = 'Based on your interests';
                for (var k = 0; k < profile.interests.length; k++) {
                    if ((INTEREST_MAP[profile.interests[k]] || []).indexOf(ch) !== -1) { reason = profile.interests[k]; break; }
                }
                curated.push({ id: ch, reason: reason });
            }
        });
    }
    channels.forEach(function(ch) {
        if (seen.indexOf(ch.id) === -1 && curated.length < 8) { seen.push(ch.id); curated.push(ch); }
    });
    if (curated.length > 0) channels = curated;

    // Render curated section
    var home = document.getElementById('home');
    if (!home || document.getElementById('curatedStartSection')) return;

    var section = document.createElement('div');
    section.id = 'curatedStartSection';
    section.style.cssText = 'width:100%;max-width:480px;margin:0 auto 28px;text-align:left;';

    var visited = [];
    try { visited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]'); } catch(e) {}

    // Mission card for beginners
    var shtml = '';
    if (level === 'beginner' && visited.length < 3) {
        shtml += '<div style="background:linear-gradient(135deg,rgba(249,115,22,0.08),rgba(249,115,22,0.02));border:2px solid rgba(249,115,22,0.3);border-radius:16px;padding:16px 18px;margin-bottom:16px;text-align:center;">' +
            '<div style="font-size:1.8rem;margin-bottom:6px;">📖 → ⭐ → 🏆</div>' +
            '<div style="color:var(--heading);font-weight:800;font-size:0.95rem;">Read channels. Earn points. Level up.</div>' +
            '<div style="color:var(--text-muted);font-size:0.78rem;margin-top:4px;">Tap any channel below to start your journey!</div>' +
            '<div style="margin-top:8px;display:flex;align-items:center;gap:6px;justify-content:center;">' +
                '<div style="flex:1;max-width:200px;height:6px;background:var(--border);border-radius:3px;overflow:hidden;">' +
                    '<div style="height:100%;background:var(--accent);width:' + Math.round((visited.length / 6) * 100) + '%;border-radius:3px;transition:0.3s;"></div>' +
                '</div>' +
                '<span style="font-size:0.7rem;color:var(--text-faint);">' + visited.length + '/6 started</span>' +
            '</div>' +
        '</div>';
    }

    var heading = (level === 'beginner') ? '🟢 START HERE — tap your first channel' : '📌 Recommended for you';
    shtml += '<div style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1.5px;font-weight:800;margin-bottom:10px;">' + heading + '</div>';

    channels.forEach(function(ch, idx) {
        var meta = (typeof CHANNELS !== 'undefined') ? CHANNELS[ch.id] : null;
        if (!meta) return;
        var emojiMatch = meta.title ? meta.title.match(/^([\u{1F000}-\u{1FFFF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}]+)/u) : null;
        var emoji = emojiMatch ? emojiMatch[1] : '📄';
        var name = ch.id.replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
        var isRead = visited.indexOf(ch.id) !== -1;
        var highlight = idx === 0 && !isRead && level === 'beginner';

        shtml += '<button onclick="go(\'' + ch.id + '\')" style="display:flex;align-items:center;gap:14px;padding:16px 18px;background:' +
            (highlight ? 'rgba(249,115,22,0.08)' : 'rgba(255,255,255,0.03)') + ';border:' +
            (highlight ? '2px solid rgba(249,115,22,0.5)' : '1px solid var(--border)') +
            ';border-radius:14px;cursor:pointer;text-align:left;font-family:inherit;color:var(--text);width:100%;margin-bottom:8px;transition:all 0.2s;animation:obSlideIn 0.4s ease-out ' + (0.06 * idx) + 's both;' +
            (highlight ? 'box-shadow:0 0 20px rgba(249,115,22,0.15);' : '') + '">' +
            '<span style="font-size:1.4rem;width:44px;height:44px;border-radius:12px;background:rgba(249,115,22,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + emoji + '</span>' +
            '<div style="flex:1;min-width:0;"><div style="font-weight:700;font-size:0.95rem;">' + name + '</div>' +
            '<div style="color:var(--text-muted);font-size:0.8rem;margin-top:2px;">' + (ch.reason || '') + '</div></div>' +
            (isRead ? '<span style="color:#22c55e;font-size:1rem;flex-shrink:0;">✓</span>' : '<span style="color:var(--text-faint);font-size:1rem;flex-shrink:0;">→</span>') +
        '</button>';
    });

    // Ask Nacho card (less prominent for beginners)
    if (level !== 'beginner' || visited.length >= 2) {
        shtml += '<div onclick="if(typeof enterNachoMode===\'function\')enterNachoMode()" style="padding:16px;background:linear-gradient(135deg,rgba(249,115,22,0.04),rgba(249,115,22,0.01));border:1px dashed rgba(249,115,22,0.2);border-radius:14px;margin-top:14px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:0.2s;">' +
            '<span style="font-size:1.5rem;">🦌</span>' +
            '<div><div style="font-weight:700;font-size:0.85rem;color:var(--heading);">Ask Nacho anything</div>' +
            '<div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px;">AI tutor — explains Bitcoin in plain language</div></div></div>';
    }

    section.innerHTML = shtml;
    var anchor = home.querySelector('.home-subtitle');
    if (anchor) anchor.parentNode.insertBefore(section, anchor.nextSibling);

    if (!document.getElementById('obAnimStyle')) {
        var style = document.createElement('style');
        style.id = 'obAnimStyle';
        style.textContent = '@keyframes obSlideIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }';
        document.head.appendChild(style);
    }

    // Dim the auth button for beginners
    var authBtn = document.getElementById('authBtn');
    var au = typeof auth !== 'undefined' && auth && auth.currentUser;
    var isReal = au && !au.isAnonymous;
    if (authBtn && level === 'beginner' && !isReal) {
        authBtn.style.background = 'none';
        authBtn.style.border = '1px solid var(--border)';
        authBtn.style.color = 'var(--text-muted)';
        authBtn.style.fontSize = '0.85rem';
        authBtn.style.fontWeight = '600';
        authBtn.textContent = '🔐 Create account to save progress';
    }

    // Collapse all channel categories for beginners
    if (level === 'beginner') {
        document.querySelectorAll('.cat-toggle').forEach(function(el) {
            el.setAttribute('data-expanded', 'false');
            var group = el.nextElementSibling;
            if (group && group.classList.contains('cat-group')) group.style.display = 'none';
            var arrow = el.querySelector('.cat-arrow');
            if (arrow) arrow.textContent = '▶';
        });
    }

    // Hide sponsorship
    var sponsor = document.querySelector('[onclick*="Sponsorship"]');
    if (sponsor) { var d = sponsor.closest('div[style*="dashed"]'); if (d) d.style.display = 'none'; }
};

// ---- Progressive reveal ----
window.checkProgressiveReveal = function() {
    var v = [];
    try { v = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]'); } catch(e) {}

    // After 3 channels: show Nacho, Explore Apps, Chat
    if (v.length >= 3) {
        ['#nacho-container', '#bnavApps', '#bnavMsg'].forEach(function(sel) {
            document.querySelectorAll(sel).forEach(function(el) {
                if (el.getAttribute('data-simplified-hidden')) {
                    el.style.display = '';
                    el.removeAttribute('data-simplified-hidden');
                }
            });
        });
    }

    // After 5: leaderboard, spin
    if (v.length >= 5) {
        ['#lbFloatBtn', '[onclick*="showSpinWheel"]'].forEach(function(sel) {
            document.querySelectorAll(sel).forEach(function(el) {
                if (el.getAttribute('data-simplified-hidden')) { el.style.display = ''; el.removeAttribute('data-simplified-hidden'); }
            });
        });
    }

    // After 10: show everything
    if (v.length >= 10) {
        document.querySelectorAll('[data-simplified-hidden]').forEach(function(el) {
            el.style.display = '';
            el.removeAttribute('data-simplified-hidden');
        });
    }
};

// ---- Progress breadcrumb ----
window.showProgressBreadcrumb = function() {
    var home = document.getElementById('home');
    if (!home || document.getElementById('progressBreadcrumb')) return;
    var profile = window.getOnboardingProfile();
    if (!profile) return;
    var visited = [];
    try { visited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]'); } catch(e) {}
    if (visited.length >= 15) return;

    var level = profile.level || 'beginner';
    var starters = STARTER_CHANNELS[level] || STARTER_CHANNELS.beginner;
    var next = null;
    for (var i = 0; i < starters.length; i++) {
        if (visited.indexOf(starters[i].id) === -1) { next = starters[i]; break; }
    }
    if (!next) return;

    var meta = (typeof CHANNELS !== 'undefined') ? CHANNELS[next.id] : null;
    if (!meta) return;

    var emoji = meta.title ? (meta.title.match(/^([\u{1F000}-\u{1FFFF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}]+)/u) || ['📄'])[0] : '📄';
    var name = next.id.replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    var done = Math.min(visited.length, starters.length);

    var bc = document.createElement('div');
    bc.id = 'progressBreadcrumb';
    bc.style.cssText = 'max-width:480px;margin:0 auto 20px;cursor:pointer;';
    bc.innerHTML =
        '<div onclick="go(\'' + next.id + '\')" style="display:flex;align-items:center;gap:14px;padding:14px 18px;background:linear-gradient(135deg,rgba(249,115,22,0.06),rgba(249,115,22,0.02));border:1px solid rgba(249,115,22,0.2);border-radius:14px;transition:0.2s;">' +
            '<span style="font-size:1.4rem;width:44px;height:44px;border-radius:12px;background:rgba(249,115,22,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + emoji + '</span>' +
            '<div style="flex:1;min-width:0;">' +
                '<div style="font-size:0.65rem;color:var(--accent);font-weight:800;text-transform:uppercase;letter-spacing:1px;">📍 Up next for you</div>' +
                '<div style="font-weight:700;font-size:0.95rem;color:var(--heading);margin-top:2px;">' + name + '</div>' +
                '<div style="color:var(--text-muted);font-size:0.75rem;margin-top:1px;">' + (next.reason || '') + '</div>' +
            '</div>' +
            '<span style="color:var(--text-faint);font-size:1rem;flex-shrink:0;">→</span>' +
        '</div>' +
        '<div style="margin-top:8px;display:flex;align-items:center;gap:6px;">' +
            '<div style="flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden;">' +
                '<div style="height:100%;background:var(--accent);width:' + Math.round(done / starters.length * 100) + '%;border-radius:2px;transition:0.3s;"></div>' +
            '</div>' +
            '<span style="font-size:0.65rem;color:var(--text-faint);white-space:nowrap;">' + done + '/' + starters.length + ' done</span>' +
        '</div>';

    var anchor = document.getElementById('curatedStartSection') || home.querySelector('.home-subtitle');
    if (anchor) anchor.parentNode.insertBefore(bc, anchor.nextSibling);
};

// ---- Init ----
function init() {
    window.showOnboardingWizard() || window.applySimplifiedHome();
    setTimeout(function() {
        if (typeof window.showProgressBreadcrumb === 'function') window.showProgressBreadcrumb();
    }, 1000);

    // Wrap go() to update progressive reveal on navigation
    var origGo = window.go;
    if (typeof origGo === 'function') {
        window.go = function() {
            var result = origGo.apply(this, arguments);
            setTimeout(window.checkProgressiveReveal, 1000);
            setTimeout(function() {
                var bc = document.getElementById('progressBreadcrumb');
                if (bc) bc.remove();
                if (typeof window.showProgressBreadcrumb === 'function') window.showProgressBreadcrumb();
            }, 1200);
            return result;
        };
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 500); });
} else {
    setTimeout(init, 500);
}

console.log('[ONBOARDING] System loaded');
}();
