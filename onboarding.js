!function() {
"use strict";

var PROFILE_KEY = 'btc_onboarding_profile';
var DONE_KEY = 'btc_onboarding_done';

// ---- NACHO QUEST CONSTANTS ----
var QUEST_KEY = 'btc_onboarding_step';
var QUEST_ACTIVE_KEY = 'btc_onboarding_active';
var QUEST_DONE_KEY = 'btc_onboarding_quest_done';
var PLEB_SHOWN_KEY = 'btc_pleb_moment_shown';

var ONBOARDING_STEPS = [
    {
        id: 'pick_topic',
        nacho: "Hey! I'm Nacho 🦌 — your Bitcoin guide. First things first: what are you curious about?",
        instruction: "Tap any channel or topic in the sidebar to explore it.",
        action: 'tap_channel',
        pts: 25,
        toast: "WAGMI! You found your first topic 🦌"
    },
    {
        id: 'send_chat',
        nacho: "The Archive has a whole community inside. Go say hello — they don't bite. Usually.",
        instruction: "Open Global Chat and say hi to the plebs.",
        action: 'open_chat',
        pts: 25,
        toast: "First message sent! The plebs have been notified 📢"
    },
    {
        id: 'spin_wheel',
        nacho: "Every day you get a free spin. Tickets, sats, streaks — you never know. Go spin it.",
        instruction: "Find the daily spin and give it a whirl.",
        action: 'spin_done',
        pts: 25,
        toast: "🎡 Spin complete! Come back daily for more."
    },
    {
        id: 'find_nacho',
        nacho: "I'm always around. Tap my face in the corner and ask me anything Bitcoin. Go ahead — I'm waiting.",
        instruction: "Open Nacho Mode and send me a message.",
        action: 'nacho_asked',
        pts: 25,
        toast: "Smart question. I like you already 🦌"
    },
    {
        id: 'first_quiz',
        nacho: "Last one. Take a quiz — even if you only get one right. That's how it starts.",
        instruction: "Open Quest Hub and complete any quiz.",
        action: 'quiz_done',
        pts: 50,
        bonus_tickets: 2,
        toast: "🎉 You did it! Welcome to the Archive."
    }
];

var STARTER_CHANNELS = {
    beginner: [
        { id: 'one-stop-shop', reason: 'The best place to start' },
        { id: 'first-purchase', reason: 'Step-by-step buying guide' },
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

// ======================================================
// ---- FEATURE 1: Nacho-Led Onboarding Quest ----
// ======================================================

window.isNachoQuestDone = function() {
    return localStorage.getItem(QUEST_DONE_KEY) === '1';
};
window.isNachoQuestActive = function() {
    return localStorage.getItem(QUEST_ACTIVE_KEY) === '1' && !window.isNachoQuestDone();
};
window.getNachoQuestStep = function() {
    return parseInt(localStorage.getItem(QUEST_KEY) || '0');
};

// ---- Step Completion Detection Setup ----
window._nachoQuestDetectionActive = false;
window._nachoQuestPollInterval = null;

function _prevSpinDay() {
    return localStorage.getItem('btc_spin_last_day') || '';
}

window.startNachoQuestDetection = function() {
    if (window._nachoQuestDetectionActive || window.isNachoQuestDone()) return;
    window._nachoQuestDetectionActive = true;

    var _spinDayAtStart = _prevSpinDay();
    var _nachoAsksAtStart = parseInt(localStorage.getItem('btc_nacho_interactions') || '0');
    var _questCountAtStart = parseInt(localStorage.getItem('btc_daily_challenges_total') || '0');
    var _chatMsgsAtStart = parseInt(localStorage.getItem('btc_chat_msgs') || '0');
    var _visitedAtStart = (function() { try { return JSON.parse(localStorage.getItem('btc_visited_channels') || '[]').length; } catch(e) { return 0; } })();

    window._nachoQuestPollInterval = setInterval(function() {
        if (!window.isNachoQuestActive() || window.isNachoQuestDone()) {
            clearInterval(window._nachoQuestPollInterval);
            window._nachoQuestDetectionActive = false;
            return;
        }
        var step = window.getNachoQuestStep();
        var flagKey = 'btc_nacho_quest_step' + step + '_done';
        if (localStorage.getItem(flagKey) === '1') return; // already detected

        var resolved = false;
        if (step === 0) {
            // tap_channel: any new channel visited
            try {
                var visited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]').length;
                if (visited > _visitedAtStart) resolved = true;
            } catch(e) {}
        } else if (step === 1) {
            // open_chat: btc_chat_msgs incremented
            var chatNow = parseInt(localStorage.getItem('btc_chat_msgs') || '0');
            if (chatNow > _chatMsgsAtStart) resolved = true;
            // Also check if overlay was opened (set by chat open event)
            if (localStorage.getItem('btc_nacho_quest_chat_opened') === '1') resolved = true;
        } else if (step === 2) {
            // spin_done: spin last day changed
            var spinDay = localStorage.getItem('btc_spin_last_day') || '';
            if (spinDay && spinDay !== _spinDayAtStart) resolved = true;
            // fallback: btc_last_spin_date
            var lsd = localStorage.getItem('btc_last_spin_date') || '';
            var today = new Date().toDateString();
            if (lsd === today) resolved = true;
        } else if (step === 3) {
            // nacho_asked: btc_nacho_interactions went up
            var nachoNow = parseInt(localStorage.getItem('btc_nacho_interactions') || '0');
            if (nachoNow > _nachoAsksAtStart) resolved = true;
            if (localStorage.getItem('btc_nacho_quest_nacho_sent') === '1') resolved = true;
        } else if (step === 4) {
            // quiz_done: btc_daily_challenges_total incremented, or completedQuests grew
            var questNow = parseInt(localStorage.getItem('btc_daily_challenges_total') || '0');
            if (questNow > _questCountAtStart) resolved = true;
            if (localStorage.getItem('btc_nacho_quest_quiz_done') === '1') resolved = true;
            if (localStorage.getItem('onboarding_quiz_done') === '1') resolved = true;
            // Also check questsCompleted from Firestore (if loaded in currentUser)
            if (typeof currentUser !== 'undefined' && currentUser && (currentUser.questsCompleted || 0) > 0) resolved = true;
        }

        if (resolved) {
            localStorage.setItem(flagKey, '1');
            window._completeNachoQuestStep(step);
        }
    }, 600);
};

window._completeNachoQuestStep = function(step) {
    var stepDef = ONBOARDING_STEPS[step];
    if (!stepDef) return;

    // Award pts
    var pts = stepDef.pts || 0;
    if (pts > 0 && typeof awardPoints === 'function') {
        awardPoints(pts, '🦌 Nacho Quest: ' + stepDef.id);
    }

    // Award bonus tickets
    if (stepDef.bonus_tickets && typeof awardOrangeTickets === 'function') {
        awardOrangeTickets(stepDef.bonus_tickets, '🦌 Nacho Quest Bonus');
    }

    // Toast
    if (stepDef.toast && typeof showToast === 'function') {
        showToast(stepDef.toast, 4000);
    }

    // Advance step
    var nextStep = step + 1;
    if (nextStep >= ONBOARDING_STEPS.length) {
        // All done!
        window._showNachoQuestComplete();
    } else {
        localStorage.setItem(QUEST_KEY, String(nextStep));
        // Update starting baselines for next step
        window._nachoQuestDetectionActive = false;
        clearInterval(window._nachoQuestPollInterval);
        setTimeout(function() {
            window._nachoQuestDetectionActive = false;
            window.startNachoQuestDetection();
            // Show overlay with next step
            window._showNachoQuestOverlay(nextStep);
        }, 800);
    }
};

window._showNachoQuestComplete = function() {
    localStorage.setItem(QUEST_DONE_KEY, '1');
    localStorage.removeItem(QUEST_ACTIVE_KEY);
    clearInterval(window._nachoQuestPollInterval);
    window._nachoQuestDetectionActive = false;

    // Remove floating pill
    var pill = document.getElementById('nachoQuestPill');
    if (pill) pill.remove();

    // Show completion screen
    var overlay = document.getElementById('nachoQuestOverlay');
    if (!overlay) return;

    var modal = overlay.querySelector('.nq-modal');
    if (!modal) return;

    // Confetti burst
    if (typeof launchConfetti === 'function') {
        try { launchConfetti(); } catch(e) {}
    } else {
        // Simple CSS confetti
        _simpleConfetti(modal);
    }

    modal.innerHTML = '<div style="text-align:center;padding:30px 20px;">' +
        '<div style="font-size:5rem;margin-bottom:12px;animation:nqBounce 0.6s ease-out;">🦌</div>' +
        '<h2 style="color:#fff;font-size:1.6rem;font-weight:900;margin:0 0 8px;">You did it!</h2>' +
        '<p style="color:#94a3b8;margin:0 0 16px;">You\'ve earned <strong style="color:#f97316;">150 pts</strong> and <strong style="color:#f97316;">2 tickets</strong>.</p>' +
        '<p style="color:#f97316;font-weight:800;font-size:1.1rem;margin:0 0 20px;">🎉 You\'re officially a pleb!</p>' +
        '<div style="color:#475569;font-size:0.85rem;">Hang on, checking your profile...</div>' +
    '</div>';

    // After 2 seconds, check for username
    setTimeout(function() {
        var hasUsername = !!(typeof currentUser !== 'undefined' && currentUser && currentUser.username) ||
            !!(localStorage.getItem('btc_username'));

        if (!hasUsername) {
            // Transition to username moment
            overlay.remove();
            window._showPlebMoment();
        } else {
            // Close and done
            overlay.style.transition = 'opacity 0.5s';
            overlay.style.opacity = '0';
            setTimeout(function() { overlay.remove(); }, 500);
            // Show login prompt if anonymous
            if (typeof auth !== 'undefined' && auth && auth.currentUser && auth.currentUser.isAnonymous) {
                setTimeout(function() { window._showGhostBanner(); }, 1000);
            }
        }
    }, 2500);
};

function _simpleConfetti(container) {
    var colors = ['#f97316','#fbbf24','#22c55e','#3b82f6','#a855f7'];
    for (var i = 0; i < 30; i++) {
        (function(idx) {
            var dot = document.createElement('div');
            dot.style.cssText = 'position:fixed;width:8px;height:8px;border-radius:50%;pointer-events:none;z-index:100000;' +
                'left:' + (20 + Math.random() * 60) + '%;top:' + (10 + Math.random() * 30) + '%;' +
                'background:' + colors[idx % colors.length] + ';' +
                'animation:nqConfetti 1.5s ease-out ' + (Math.random() * 0.5) + 's forwards;';
            document.body.appendChild(dot);
            setTimeout(function() { dot.remove(); }, 2000);
        })(i);
    }
}

window._showNachoQuestOverlay = function(stepIndex) {
    if (window.isNachoQuestDone()) return;
    var step = ONBOARDING_STEPS[stepIndex || 0];
    if (!step) return;

    var existing = document.getElementById('nachoQuestOverlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'nachoQuestOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(2,6,23,0.88);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;animation:nqFadeIn 0.3s ease-out;';
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) overlay.remove();
    });

    var total = ONBOARDING_STEPS.length;
    var dots = '';
    for (var d = 0; d < total; d++) {
        var isDone = d < stepIndex;
        var isCurrent = d === stepIndex;
        dots += '<div style="width:' + (isCurrent ? '20' : '8') + 'px;height:8px;border-radius:4px;' +
            'background:' + (isDone ? '#22c55e' : isCurrent ? '#f97316' : '#1e293b') + ';' +
            'transition:all 0.4s;' + (isCurrent ? 'animation:nqPulse 1.5s ease-in-out infinite;' : '') + '"></div>';
    }

    var nachoImg = '<img src="nacho-fly.svg" alt="Nacho" style="width:60px;height:60px;" onerror="this.outerHTML=\'<div style=\\\'font-size:3rem;\\\'>🦌</div>\'">';

    overlay.innerHTML = '<style>' +
        '@keyframes nqFadeIn{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}' +
        '@keyframes nqBounce{0%{transform:scale(0.5)}70%{transform:scale(1.1)}100%{transform:scale(1)}}' +
        '@keyframes nqPulse{0%,100%{opacity:1}50%{opacity:0.6}}' +
        '@keyframes nqConfetti{to{transform:translateY(200px) rotate(720deg);opacity:0}}' +
    '</style>' +
    '<div class="nq-modal" style="background:#0f172a;border:1.5px solid #f97316;border-radius:20px;padding:28px 24px;max-width:400px;width:100%;text-align:center;position:relative;box-shadow:0 20px 60px rgba(249,115,22,0.2);">' +
        // Close
        '<button onclick="document.getElementById(\'nachoQuestOverlay\').remove()" style="position:absolute;top:12px;right:12px;background:none;border:1px solid #1e293b;color:#475569;width:32px;height:32px;border-radius:8px;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:inherit;">✕</button>' +
        // Progress dots
        '<div style="display:flex;gap:6px;justify-content:center;margin-bottom:20px;">' + dots + '</div>' +
        '<div style="font-size:0.65rem;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px;">Step ' + (stepIndex + 1) + ' of ' + total + '</div>' +
        // Nacho avatar
        '<div style="width:60px;height:60px;margin:0 auto 12px;border-radius:50%;background:rgba(249,115,22,0.1);border:2px solid rgba(249,115,22,0.3);display:flex;align-items:center;justify-content:center;animation:nqBounce 0.5s ease-out;">' + nachoImg + '</div>' +
        // Speech bubble
        '<div style="background:#fff;border:2px solid #f97316;border-radius:16px;padding:14px 16px;margin-bottom:16px;position:relative;">' +
            '<div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:10px solid #f97316;"></div>' +
            '<div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:9px solid #fff;"></div>' +
            '<p style="color:#0f172a;font-size:0.9rem;line-height:1.5;margin:0;font-weight:600;">' + step.nacho + '</p>' +
        '</div>' +
        // Instruction
        '<div style="background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.2);border-radius:12px;padding:12px;margin-bottom:16px;">' +
            '<p style="color:#f97316;font-size:0.82rem;font-weight:700;margin:0;">👉 ' + step.instruction + '</p>' +
        '</div>' +
        // Reward
        '<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:16px;">' +
            '<span style="background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.3);padding:6px 14px;border-radius:20px;color:#f97316;font-size:0.82rem;font-weight:700;">+' + step.pts + ' pts reward</span>' +
            (step.bonus_tickets ? '<span style="background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);padding:6px 14px;border-radius:20px;color:#fbbf24;font-size:0.82rem;font-weight:700;">+' + step.bonus_tickets + ' tickets</span>' : '') +
        '</div>' +
        // Skip button
        '<button onclick="window._skipNachoQuest()" style="background:none;border:none;color:#475569;font-size:0.77rem;cursor:pointer;font-family:inherit;text-decoration:underline;">Skip quest for now →</button>' +
    '</div>';

    document.body.appendChild(overlay);
    // Push history state for back-safety
    if (window.history && window.history.pushState) {
        history.pushState({ nachoQuest: true, step: stepIndex }, '', window.location.href);
    }
};

window._skipNachoQuest = function() {
    localStorage.setItem(QUEST_DONE_KEY, '1');
    localStorage.removeItem(QUEST_ACTIVE_KEY);
    clearInterval(window._nachoQuestPollInterval);
    window._nachoQuestDetectionActive = false;
    var overlay = document.getElementById('nachoQuestOverlay');
    if (overlay) overlay.remove();
    var pill = document.getElementById('nachoQuestPill');
    if (pill) pill.remove();
};

// ---- Floating Quest Pill ----
window._showNachoQuestPill = function() {
    if (window.isNachoQuestDone()) return;
    if (!window.isNachoQuestActive()) return;
    if (document.getElementById('nachoQuestPill')) return;

    var pill = document.createElement('div');
    pill.id = 'nachoQuestPill';
    pill.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:8999;' +
        'background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;border:none;border-radius:24px;' +
        'padding:10px 20px;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;' +
        'box-shadow:0 4px 20px rgba(249,115,22,0.4);animation:nqPulse 2s ease-in-out infinite;' +
        'display:flex;align-items:center;gap:8px;white-space:nowrap;touch-action:manipulation;';
    pill.innerHTML = '<span>🦌 Continue Quest</span><span style="opacity:0.8;font-size:0.75rem;">→ Step ' + (window.getNachoQuestStep() + 1) + '/5</span>';
    pill.onclick = function() {
        window._showNachoQuestOverlay(window.getNachoQuestStep());
    };
    document.body.appendChild(pill);

    // Inject animation style if not present
    if (!document.getElementById('nqPillStyle')) {
        var s = document.createElement('style');
        s.id = 'nqPillStyle';
        s.textContent = '@keyframes nqPulse{0%,100%{box-shadow:0 4px 20px rgba(249,115,22,0.4)}50%{box-shadow:0 4px 30px rgba(249,115,22,0.7)}}' +
            '@keyframes nqFadeIn{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}' +
            '@keyframes nqBounce{0%{transform:scale(0.5)}70%{transform:scale(1.1)}100%{transform:scale(1)}}' +
            '@keyframes nqConfetti{to{transform:translateY(200px) rotate(720deg);opacity:0}}';
        document.head.appendChild(s);
    }
};

// ---- Start the Nacho Quest (called for truly new users) ----
window.startNachoQuest = function() {
    if (window.isNachoQuestDone()) return;
    localStorage.setItem(QUEST_ACTIVE_KEY, '1');
    if (!localStorage.getItem(QUEST_KEY)) localStorage.setItem(QUEST_KEY, '0');
    var step = window.getNachoQuestStep();
    window._showNachoQuestOverlay(step);
    window._showNachoQuestPill();
    window.startNachoQuestDetection();
};

// Popstate: restore overlay if quest still active
window.addEventListener('popstate', function(e) {
    if (window.isNachoQuestActive() && !window.isNachoQuestDone()) {
        setTimeout(function() {
            if (!document.getElementById('nachoQuestOverlay')) {
                window._showNachoQuestOverlay(window.getNachoQuestStep());
            }
        }, 100);
    }
});

// Hook into toggleChatOverlay/openChat to detect step 1
var _nqOrigToggleChat = null;
function _hookChatOverlay() {
    if (typeof window.toggleChatOverlay === 'function' && !window._nqChatHooked) {
        window._nqChatHooked = true;
        _nqOrigToggleChat = window.toggleChatOverlay;
        window.toggleChatOverlay = function() {
            var res = _nqOrigToggleChat.apply(this, arguments);
            if (window.isNachoQuestActive() && window.getNachoQuestStep() === 1) {
                localStorage.setItem('btc_nacho_quest_chat_opened', '1');
            }
            return res;
        };
    }
}
setTimeout(_hookChatOverlay, 3000);

// Hook into enterNachoMode + nachoModeSend for step 3
function _hookNachoMode() {
    if (typeof window.nachoModeSend === 'function' && !window._nqNachoHooked) {
        window._nqNachoHooked = true;
        var _orig = window.nachoModeSend;
        window.nachoModeSend = function() {
            var res = _orig.apply(this, arguments);
            if (window.isNachoQuestActive() && window.getNachoQuestStep() === 3) {
                localStorage.setItem('btc_nacho_quest_nacho_sent', '1');
            }
            return res;
        };
    }
}
setTimeout(_hookNachoMode, 3000);

// Hook quiz completion for step 4
window.addEventListener('onboarding_quiz_done', function() {
    if (window.isNachoQuestActive() && window.getNachoQuestStep() === 4) {
        localStorage.setItem('btc_nacho_quest_quiz_done', '1');
    }
});


// ======================================================
// ---- FEATURE 2: "Earn Your Username" Moment ----
// ======================================================

window._showPlebMoment = function() {
    if (localStorage.getItem(PLEB_SHOWN_KEY) === '1') return;
    localStorage.setItem(PLEB_SHOWN_KEY, '1');

    // Fetch pleb number
    var plebNum = null;
    var totalPlebs = null;

    function _renderPlebMoment(num, total) {
        var existing = document.getElementById('plebMomentOverlay');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.id = 'plebMomentOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9001;background:rgba(2,6,23,0.92);display:flex;align-items:flex-end;justify-content:center;padding:0;';

        var card = document.createElement('div');
        card.style.cssText = 'background:linear-gradient(180deg,#0f172a 0%,#1e293b 100%);border:1.5px solid #f97316;border-bottom:none;border-radius:24px 24px 0 0;padding:32px 24px 40px;max-width:440px;width:100%;text-align:center;box-shadow:0 -20px 60px rgba(249,115,22,0.2);transform:translateY(100%);transition:transform 0.5s cubic-bezier(0.34,1.56,0.64,1);';

        var numHtml = num ? '<div style="font-size:3.5rem;font-weight:900;color:#f97316;margin-bottom:4px;font-feature-settings:\'tnum\';">#' + _fmtNum(num) + '</div>' : '';
        var totalHtml = (num && total) ? '<p style="color:#64748b;font-size:0.9rem;margin:0 0 24px;">one of <strong style="color:#94a3b8;">' + _fmtNum(total) + '</strong> Bitcoiners who found this place</p>' : '<p style="color:#64748b;font-size:0.9rem;margin:0 0 24px;">Welcome to the community 🧡</p>';
        var usernameDisplay = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : (localStorage.getItem('btc_username') || null);

        card.innerHTML = '<div style="font-size:2.5rem;margin-bottom:12px;">⚡</div>' +
            '<h2 style="color:#fff;font-size:1.4rem;font-weight:900;margin:0 0 8px;">Welcome to the Archive</h2>' +
            (usernameDisplay ? '<div style="background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.3);border-radius:12px;padding:8px 20px;display:inline-block;margin-bottom:12px;"><span style="color:#f97316;font-weight:800;font-size:1.1rem;">@' + _escHtml(usernameDisplay) + '</span></div>' : '') +
            numHtml +
            '<div style="color:#64748b;font-size:0.8rem;margin-bottom:4px;">You\'re pleb</div>' +
            totalHtml +
            // Mini stats card
            '<div style="background:#0a0f1e;border:1px solid #1e293b;border-radius:14px;padding:16px;margin-bottom:24px;display:grid;grid-template-columns:1fr 1fr;gap:12px;text-align:center;">' +
                '<div><div style="font-size:1.3rem;">⭐</div><div style="color:#f97316;font-weight:800;font-size:0.85rem;">0 pts</div><div style="color:#475569;font-size:0.7rem;">points</div></div>' +
                '<div><div style="font-size:1.3rem;">🏅</div><div style="color:#f97316;font-weight:800;font-size:0.85rem;">0</div><div style="color:#475569;font-size:0.7rem;">badges</div></div>' +
                '<div><div style="font-size:1.3rem;">🔥</div><div style="color:#f97316;font-weight:800;font-size:0.85rem;">0 days</div><div style="color:#475569;font-size:0.7rem;">streak</div></div>' +
                '<div><div style="font-size:1.3rem;">📚</div><div style="color:#f97316;font-weight:800;font-size:0.85rem;">0</div><div style="color:#475569;font-size:0.7rem;">channels read</div></div>' +
            '</div>' +
            '<p style="color:#475569;font-size:0.78rem;margin-bottom:20px;font-style:italic;">Your journey starts now</p>' +
            '<button onclick="document.getElementById(\'plebMomentOverlay\').remove()" style="width:100%;padding:14px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;border:none;border-radius:14px;font-size:1rem;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 20px rgba(249,115,22,0.3);">Start Exploring →</button>';

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        // Slide up
        setTimeout(function() { card.style.transform = 'translateY(0)'; }, 50);
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) overlay.remove();
        });
    }

    // Try to get pleb number
    if (typeof firebase !== 'undefined' && firebase.firestore) {
        try {
            var _db = firebase.firestore();
            // First try user doc for plebNumber
            var _user = (typeof auth !== 'undefined' && auth) ? auth.currentUser : null;
            var getStatsPromise = _db.collection('stats').doc('global').get().then(function(doc) {
                if (doc.exists) {
                    totalPlebs = doc.data().userCount || doc.data().totalUsers || null;
                }
            }).catch(function() {});

            var getUserPromise = (_user && !_user.isAnonymous) ?
                _db.collection('users').doc(_user.uid).get().then(function(doc) {
                    if (doc.exists && doc.data().plebNumber) plebNum = doc.data().plebNumber;
                }).catch(function() {}) :
                Promise.resolve();

            Promise.all([getStatsPromise, getUserPromise]).then(function() {
                _renderPlebMoment(plebNum, totalPlebs);
            }).catch(function() {
                _renderPlebMoment(null, null);
            });
        } catch(e) {
            _renderPlebMoment(null, null);
        }
    } else {
        _renderPlebMoment(null, null);
    }
};

function _fmtNum(n) {
    return n ? n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '?';
}
function _escHtml(s) {
    if (typeof escapeHtml === 'function') return escapeHtml(s);
    return (s || '').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ======================================================
// ---- FEATURE 3A: Social Proof Landing Banner ----
// ======================================================

window._showSocialProofBar = function() {
    if (sessionStorage.getItem('btc_social_proof_shown') === '1') return;
    if (document.getElementById('socialProofBar')) return;

    sessionStorage.setItem('btc_social_proof_shown', '1');

    var stats = { active: null, sfInfo: null, reads: null };
    var _fetched = 0;
    var _total = 3;

    function _tryRender() {
        _fetched++;
        if (_fetched < _total) return;

        var parts = [];
        if (stats.active !== null && stats.active > 0) parts.push('🔥 ' + stats.active + ' plebs active now');
        if (stats.sfInfo) parts.push('⚡ Last SF: ' + stats.sfInfo);
        if (stats.reads !== null && stats.reads > 0) parts.push('📚 ' + _fmtNum(stats.reads) + ' reads today');

        if (parts.length === 0) return; // nothing to show

        var bar = document.createElement('div');
        bar.id = 'socialProofBar';
        bar.style.cssText = 'position:fixed;bottom:-60px;left:0;right:0;z-index:7000;background:linear-gradient(90deg,rgba(15,23,42,0.95),rgba(30,41,59,0.95));border-top:1px solid rgba(249,115,22,0.3);padding:10px 16px;text-align:center;font-size:0.82rem;color:#94a3b8;transition:bottom 0.5s cubic-bezier(0.34,1.56,0.64,1);font-weight:600;letter-spacing:0.3px;';
        bar.innerHTML = parts.join('<span style="color:#334155;margin:0 8px;">·</span>');
        document.body.appendChild(bar);

        // Slide up after short delay
        setTimeout(function() { bar.style.bottom = '60px'; /* above nav */ }, 300);

        // Auto-hide after 6 seconds
        setTimeout(function() {
            bar.style.bottom = '-60px';
            setTimeout(function() { bar.remove(); }, 600);
        }, 6300);
    }

    // Fetch active users
    if (typeof firebase !== 'undefined' && firebase.firestore) {
        try {
            var _db = firebase.firestore();
            _db.collection('stats').doc('global').get().then(function(doc) {
                if (doc.exists) {
                    var d = doc.data();
                    stats.active = d.activeUsers || d.presenceCount || null;
                    stats.reads = d.channelVisits || d.readsToday || null;
                }
                _tryRender();
            }).catch(function() { _tryRender(); });
        } catch(e) { _tryRender(); }

        // Fetch presence count
        try {
            _db.collection('presence').where('online', '==', true).get().then(function(snap) {
                if (snap.size > 0) stats.active = snap.size;
                _tryRender();
            }).catch(function() { _tryRender(); });
        } catch(e) { _tryRender(); }

        // Fetch last SF window
        try {
            _db.collection('satoshi_favor').orderBy('startTime', 'desc').limit(1).get().then(function(snap) {
                if (!snap.empty) {
                    var sf = snap.docs[0].data();
                    var miners = sf.minerCount || sf.totalMiners || sf.participantCount || null;
                    var winner = sf.winner || sf.winnerUsername || null;
                    var hashes = sf.totalHashes || null;
                    var parts2 = [];
                    if (miners) parts2.push(miners + ' miners');
                    if (winner) parts2.push('1 winner');
                    if (hashes) parts2.push(_fmtNum(hashes) + ' hashes');
                    if (parts2.length > 0) stats.sfInfo = parts2.join(' · ');
                }
                _tryRender();
            }).catch(function() { _tryRender(); });
        } catch(e) { _tryRender(); }
    } else {
        // Firebase not ready, skip
        return;
    }
};

// ======================================================
// ---- FEATURE 4: Ghost Mode Banner ----
// ======================================================

window._showGhostBanner = function() {
    if (typeof auth === 'undefined' || !auth || !auth.currentUser) return;
    if (!auth.currentUser.isAnonymous) return;
    if (sessionStorage.getItem('btc_ghost_dismissed') === '1') return;
    if (document.getElementById('ghostModeBanner')) return;

    var banner = document.createElement('div');
    banner.id = 'ghostModeBanner';
    banner.style.cssText = 'position:fixed;bottom:64px;left:0;right:0;z-index:8000;background:linear-gradient(90deg,rgba(15,23,42,0.97),rgba(30,41,59,0.97));border-top:1.5px solid rgba(99,102,241,0.4);padding:12px 16px;display:flex;align-items:center;gap:10px;animation:nqFadeIn 0.3s ease-out;';
    banner.innerHTML = '<span style="font-size:1.2rem;flex-shrink:0;">👻</span>' +
        '<span style="flex:1;color:#94a3b8;font-size:0.82rem;font-weight:600;">Your progress disappears when you leave. Save it?</span>' +
        '<button onclick="window._ghostSaveWithGoogle()" style="background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:#fff;border:none;border-radius:10px;padding:8px 14px;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;">Save with Google →</button>' +
        '<button onclick="window._dismissGhostBanner()" style="background:none;border:none;color:#475569;font-size:1.1rem;cursor:pointer;padding:4px 6px;flex-shrink:0;touch-action:manipulation;">✕</button>';
    document.body.appendChild(banner);
};

window._dismissGhostBanner = function() {
    sessionStorage.setItem('btc_ghost_dismissed', '1');
    sessionStorage.setItem('btc_ghost_pts_since_dismiss', '0');
    var banner = document.getElementById('ghostModeBanner');
    if (banner) banner.remove();
};

window._ghostSaveWithGoogle = function() {
    window._dismissGhostBanner();
    if (typeof signInWithGoogle === 'function') {
        signInWithGoogle();
    } else if (typeof showUsernamePrompt === 'function') {
        showUsernamePrompt();
    }
};

// Track pts since ghost dismiss (re-show after 10 more pts earned anonymously)
window._ghostTrackPts = function(pts) {
    if (typeof auth === 'undefined' || !auth || !auth.currentUser || !auth.currentUser.isAnonymous) return;
    if (sessionStorage.getItem('btc_ghost_dismissed') !== '1') return;
    var current = parseInt(sessionStorage.getItem('btc_ghost_pts_since_dismiss') || '0');
    current += pts;
    sessionStorage.setItem('btc_ghost_pts_since_dismiss', String(current));
    if (current >= 10 && !document.getElementById('ghostModeBanner')) {
        sessionStorage.removeItem('btc_ghost_dismissed');
        setTimeout(window._showGhostBanner, 500);
    }
};


// ======================================================
// ---- Two-Step Onboarding Wizard (original) ----
// ======================================================

window.showOnboardingWizard = function() {
    if (window._directLinkMode) return false;
    if (window.isOnboardingComplete()) return false;
    var visited = [];
    try { visited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]'); } catch(e) {}
    if (visited.length >= 3) {
        window.setOnboardingProfile({ level: 'intermediate', interests: [], skipped: true });
        return false;
    }
    var hash = window.location.hash.replace('#', '');
    if (!hash && typeof _parseCleanUrl === 'function') hash = _parseCleanUrl() || '';
    if (hash && hash.length > 0) {
        window.setOnboardingProfile({ level: 'intermediate', interests: [], skipped: true, directLink: hash });
        return false;
    }

    var overlay = document.createElement('div');
    overlay.id = 'onboardingOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#020617;display:flex;flex-direction:column;align-items:center;padding:20px;font-family:inherit;overflow-y:auto;-webkit-overflow-scrolling:touch;justify-content:flex-start;padding-top:30px;';

    var state = { step: 0, level: null, interests: [] };

    var ALL_INTEREST_TOPICS = [
        { label: 'Why Bitcoin?', emoji: '❓', levels: ['beginner','intermediate'] },
        { label: 'How to buy & use', emoji: '🛒', levels: ['beginner','intermediate'] },
        { label: 'Security & wallets', emoji: '🔑', levels: ['beginner','intermediate','advanced'] },
        { label: 'Lightning Network', emoji: '⚡', levels: ['beginner','intermediate','advanced'] },
        { label: 'Mining & energy', emoji: '⛏️', levels: ['intermediate','advanced'] },
        { label: 'Privacy & freedom', emoji: '🕵️', levels: ['intermediate','advanced'] },
        { label: 'History & culture', emoji: '📜', levels: ['beginner','intermediate'] },
        { label: 'Economics & money', emoji: '💰', levels: ['beginner','intermediate','advanced'] },
        { label: 'Geopolitics & adoption', emoji: '🌍', levels: ['intermediate','advanced'] },
        { label: 'Technical deep dives', emoji: '🔧', levels: ['advanced'] },
        { label: 'Art, memes & media', emoji: '🎨', levels: ['beginner','intermediate'] },
        { label: 'Books & learning', emoji: '📚', levels: ['beginner','intermediate','advanced'] },
        { label: 'Philosophy & ethics', emoji: '🍎', levels: ['intermediate','advanced'] },
        { label: 'Building & DIY', emoji: '🔨', levels: ['advanced'] },
        { label: 'Bitcoin properties', emoji: '₿', levels: ['beginner','intermediate','advanced'] },
        { label: 'Real-world use cases', emoji: '✅', levels: ['beginner','intermediate','advanced'] }
    ];

    function getTopicsForLevel(level) {
        return ALL_INTEREST_TOPICS.filter(function(t) { return t.levels.indexOf(level || 'beginner') !== -1; });
    }

    function finish(level, interests) {
        window.setOnboardingProfile({ level: level || 'beginner', interests: interests || [], completedAt: Date.now() });

        // Auto-submit to buddy pool if user opted in
        if (state.buddyRole) {
            _submitBuddyFromOnboarding(level || 'beginner', state.buddyRole);
        }

        overlay.style.transition = 'opacity 0.4s';
        overlay.style.opacity = '0';
        setTimeout(function() {
            overlay.remove();
            if (typeof window.applySimplifiedHome === 'function') window.applySimplifiedHome();
            // Show the Quest Guide after onboarding
            if (typeof window.showGuide === 'function') {
                setTimeout(function() { window.showGuide(); }, 500);
            }
            // Start Nacho Quest for new users if not yet started
            setTimeout(function() {
                if (!window.isNachoQuestDone() && !window.isNachoQuestActive()) {
                    window.startNachoQuest();
                }
            }, 1500);
            // Show social proof bar on first visit
            setTimeout(window._showSocialProofBar, 4000);
        }, 400);
    }

    window._submitBuddyFromOnboarding = function(level, goal) {
        // Delay to let auth settle
        setTimeout(function() {
            if (typeof firebase === 'undefined' || !firebase.auth || !firebase.firestore) return;
            var _auth = firebase.auth();
            var doSubmit = function() {
                var user = _auth.currentUser;
                if (!user) return;
                var _db = firebase.firestore();
                var uid = user.uid;
                var username = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'New Bitcoiner';
                var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown';
                var isAnon = user.isAnonymous;

                // If anonymous, save preference locally — match when they sign up
                if (isAnon) {
                    localStorage.setItem('btc_buddy_pending', JSON.stringify({ level: level, goal: goal, tz: tz }));
                    if (typeof showToast === 'function') showToast('🤝 Buddy preference saved! Sign up to get matched with a ' + (goal === 'learn' ? 'teacher' : 'learner') + '.', 6000);
                    return;
                }

                // Real user — search pool for complement
                _db.collection('buddy_pool').limit(50).get().then(function(snap) {
                    var match = null;
                    var complementaryGoal = goal === 'learn' ? 'teach' : 'learn';
                    snap.forEach(function(doc) {
                        var d = doc.data();
                        if (!match && d.uid !== uid && d.goal === complementaryGoal) {
                            match = { id: doc.id, data: d };
                        }
                    });

                    if (match) {
                        // Instant match!
                        _db.collection('buddy_pool').doc(match.id).delete();
                        var matchDoc = {
                            user1: { uid: uid, username: username, level: level, goal: goal },
                            user2: { uid: match.data.uid, username: match.data.username, level: match.data.level, goal: match.data.goal },
                            matchedAt: firebase.firestore.FieldValue.serverTimestamp(),
                            tz1: tz, tz2: match.data.tz || 'Unknown'
                        };
                        _db.collection('buddy_matches').add(matchDoc);

                        // Award points to both
                        if (typeof awardPoints === 'function') awardPoints(20, '🤝 Bitcoin Buddy match!');

                        // Notify BOTH users
                        if (typeof sendNotification === 'function') {
                            sendNotification(match.data.uid, 'buddy', '🤝 You\'ve been matched with @' + username + '! Check your DMs to start learning together.', 'buddy_match', null);
                        }
                        _db.collection('notifications').add({
                            recipientId: uid,
                            senderId: 'system', senderName: 'Nacho 🦌',
                            type: 'buddy',
                            message: '🤝 You\'ve been matched with @' + match.data.username + '! Check your DMs.',
                            read: false,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        }).catch(function() {});

                        if (typeof showToast === 'function') showToast('🤝 Buddy matched with ' + (typeof escapeHtml === 'function' ? escapeHtml(match.data.username || '') : (match.data.username || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')) + '! Opening DMs...', 6000);

                        // Create a DM conversation with a Nacho welcome message
                        var convoId = [uid, match.data.uid].sort().join('_');
                        var convoData = {
                            participants: [uid, match.data.uid],
                            lastMessage: '🦌 Hey! I\'m Nacho, and I matched you two as Bitcoin Buddies! ' + username + ' wants to ' + goal + ' and ' + match.data.username + ' wants to ' + match.data.goal + '. Ask me anything about Bitcoin right here — just type "Hey Nacho" and I\'ll help! Have fun learning together! 🧡',
                            lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
                            lastSenderUid: 'nacho',
                            isBuddyMatch: true
                        };
                        convoData.participantNames = {};
                        convoData.participantNames[uid] = username;
                        convoData.participantNames[match.data.uid] = match.data.username;
                        var convoRef = _db.collection('dm_conversations').doc(convoId);
                        convoRef.set(convoData, { merge: true }).then(function() {
                            // Add Nacho's welcome message
                            return convoRef.collection('messages').add({
                                senderUid: 'nacho',
                                senderName: 'Nacho 🦌',
                                text: '🦌 Hey! I\'m Nacho, and I matched you two as Bitcoin Buddies!\n\n' +
                                    '👤 @' + username + ' wants to ' + goal + '\n' +
                                    '👤 @' + match.data.username + ' wants to ' + match.data.goal + '\n\n' +
                                    'Ask me anything about Bitcoin right here — just start your message with "Hey Nacho" and I\'ll jump in! 🧡\n\n' +
                                    'Pro tip: Start with "What is Bitcoin?" if you\'re brand new, or "Explain the Lightning Network" if you want to go deeper!',
                                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                                isSystem: true
                            });
                        }).catch(function(e) { console.error('[BUDDY] DM create error:', e); });

                        // Open DM for the current user after a delay
                        setTimeout(function() {
                            if (typeof openDM === 'function') openDM(match.data.uid, match.data.username);
                            else if (typeof showInbox === 'function') showInbox();
                        }, 3000);
                    } else {
                        // No match — add to pool
                        _db.collection('buddy_pool').add({
                            uid: uid, username: username, level: level, goal: goal,
                            intro: 'Joined via onboarding', tz: tz,
                            joinedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        if (typeof showToast === 'function') showToast('🤝 You\'re in the Buddy Pool! We\'ll notify you when a ' + (goal === 'learn' ? 'teacher' : 'learner') + ' joins.', 5000);
                    }
                }).catch(function(e) { console.error('[BUDDY onboarding]', e); });
            };

            if (_auth.currentUser) {
                doSubmit();
            } else {
                _auth.signInAnonymously().then(function() {
                    // Wait for auth state
                    var unsub = _auth.onAuthStateChanged(function(u) {
                        if (u) { unsub(); doSubmit(); }
                    });
                }).catch(function() {});
            }
        }, 2000);
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
                '<p style="color:#94a3b8;font-size:0.92rem;line-height:1.5;margin:0 0 6px;">146 channels of organized Bitcoin knowledge. Read channels, earn XP, stack bitcoin, &amp; level up. 7 embedded mini-apps make learning about Bitcoin fun and interactive.</p>' +
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
                        '<div style="color:#64748b;font-size:0.65rem;margin-top:2px;">Get XP & badges</div>' +
                    '</div>' +
                    '<div style="flex:1;padding:12px 8px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:12px;">' +
                        '<div style="font-size:1.3rem;">🏆</div>' +
                        '<div style="color:#6366f1;font-size:0.7rem;font-weight:800;margin-top:4px;">LEVEL UP</div>' +
                        '<div style="color:#64748b;font-size:0.65rem;margin-top:2px;">Climb the ranks</div>' +
                    '</div>' +
                '</div>' +

                // Earn Real Sats callout
                '<div style="background:linear-gradient(135deg,rgba(247,147,26,0.1),rgba(234,179,8,0.05));border:1px solid rgba(247,147,26,0.3);border-radius:14px;padding:14px 16px;margin-bottom:20px;display:flex;align-items:center;gap:12px;">' +
                    '<div style="font-size:1.8rem;flex-shrink:0;">⚡</div>' +
                    '<div>' +
                        '<div style="color:#f7931a;font-size:0.85rem;font-weight:800;">Earn Real Bitcoin</div>' +
                        '<div style="color:#94a3b8;font-size:0.72rem;line-height:1.5;margin-top:2px;">Your XP converts to real sats. Read, learn, and claim Bitcoin directly to your Lightning wallet. 1,000 XP = 100 sats.</div>' +
                    '</div>' +
                '</div>' +

                '<div style="font-size:0.7rem;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;font-weight:800;margin-bottom:10px;">🐇 How deep down the rabbit hole are you?</div>';

            var levels = [
                { value: 'beginner', emoji: '🌱', label: 'New to Bitcoin', desc: "Guided intro, buying guide, simplified experience" },
                { value: 'intermediate', emoji: '📘', label: 'I know some Bitcoin', desc: "Deeper topics, learning trails, dashboard & tools" },
                { value: 'advanced', emoji: '🔥', label: "I'm a Bitcoiner", desc: "Full access — Scholar Cert, Global Chat, IRL Meetups" }
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

            // Buddy opt-in
            if (state.level) {
                var buddyRole = state.buddyRole || null;
                html += '<div style="margin-top:16px;padding:14px 16px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:14px;">' +
                    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
                        '<span style="font-size:1.2rem;">🤝</span>' +
                        '<div><div style="color:#22c55e;font-size:0.8rem;font-weight:800;">Find a Bitcoin Buddy</div>' +
                        '<div style="color:#64748b;font-size:0.7rem;">Get paired with ' + (state.level === 'advanced' ? 'a learner to mentor' : 'an experienced Bitcoiner') + '</div></div>' +
                    '</div>' +
                    '<div style="display:flex;gap:8px;">' +
                        '<button onclick="window._obBuddyRole(\'learn\')" style="flex:1;padding:10px;border-radius:10px;background:' + (buddyRole === 'learn' ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.03)') + ';border:1.5px solid ' + (buddyRole === 'learn' ? '#f97316' : '#1e293b') + ';color:' + (buddyRole === 'learn' ? '#f97316' : '#94a3b8') + ';font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">📖 I want to learn</button>' +
                        '<button onclick="window._obBuddyRole(\'teach\')" style="flex:1;padding:10px;border-radius:10px;background:' + (buddyRole === 'teach' ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.03)') + ';border:1.5px solid ' + (buddyRole === 'teach' ? '#f97316' : '#1e293b') + ';color:' + (buddyRole === 'teach' ? '#f97316' : '#94a3b8') + ';font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">🎓 I want to teach</button>' +
                    '</div>' +
                    (buddyRole ? '<div style="text-align:center;margin-top:6px;"><button onclick="window._obBuddyRole(null)" style="background:none;border:none;color:#475569;font-size:0.7rem;cursor:pointer;font-family:inherit;">Skip buddy matching</button></div>' : '') +
                '</div>';
            }

            // Continue button
            var canContinue = !!state.level;
            html += '<div style="margin-top:14px;">' +
                '<button id="onboardingCTA" onclick="window._obAdvance()" ' + (canContinue ? '' : 'disabled') + ' style="width:100%;padding:16px 0;background:' + (canContinue ? 'linear-gradient(135deg,#f97316,#ea580c)' : '#1e293b') + ';color:' + (canContinue ? '#fff' : '#475569') + ';border:none;border-radius:14px;font-size:1.05rem;font-weight:800;cursor:' + (canContinue ? 'pointer' : 'default') + ';font-family:inherit;transition:all 0.3s;box-shadow:' + (canContinue ? '0 8px 30px rgba(249,115,22,0.3)' : 'none') + ';">Continue</button>' +
                '<button onclick="window._obSignIn()" style="width:100%;margin-top:10px;padding:13px 0;background:none;border:1.5px solid #334155;border-radius:12px;color:#94a3b8;font-size:0.88rem;font-weight:600;cursor:pointer;font-family:inherit;">🔐 Already have an account? Sign in</button>' +
                '<button onclick="window._obSkip()" style="width:100%;margin-top:8px;padding:10px 0;background:none;border:none;color:#475569;font-size:0.78rem;cursor:pointer;font-family:inherit;">Skip — I\'ll explore on my own</button>' +
            '</div>';

        } else if (state.step === 1) {
            // ---- STEP 2: Interest Picker ----
            var intCount = state.interests.length;
            var intValid = intCount >= 3 && intCount <= 5;
            var intColor = intValid ? '#22c55e' : intCount > 5 ? '#ef4444' : '#f97316';
            var intMsg = intCount === 0 ? 'Pick 3-5 topics' : intCount < 3 ? (3 - intCount) + ' more needed' : intCount <= 5 ? '✓ ' + intCount + ' selected' : 'Max 5 — remove ' + (intCount - 5);

            var step2Intro = state.level === 'beginner' ? 'We\'ll curate a beginner-friendly starting path just for you.' :
                             state.level === 'intermediate' ? 'We\'ll surface the most relevant channels and tools for you.' :
                             'We\'ll highlight the deep dives and advanced topics you care about.';

            html += '<div style="font-size:3rem;margin-bottom:8px;">🎯</div>' +
                '<h1 style="color:#fff;font-size:1.4rem;font-weight:900;margin:0 0 6px;">What interests you?</h1>' +
                '<p style="color:#64748b;font-size:0.85rem;margin:0 0 6px;">' + step2Intro + '</p>' +
                '<p style="color:#475569;font-size:0.78rem;margin:0 0 6px;">Pick 3-5 topics.</p>' +
                '<div style="color:' + intColor + ';font-size:0.75rem;font-weight:700;margin-bottom:14px;">' + intMsg + '</div>' +
                '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">';

            var levelTopics = getTopicsForLevel(state.level);
            levelTopics.forEach(function(topic) {
                var sel = state.interests.indexOf(topic.label) !== -1;
                html += '<button onclick="window._obToggleInterest(\'' + topic.label.replace(/'/g, "\\'") + '\')" style="padding:9px 14px;border-radius:20px;background:' + (sel ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.04)') + ';border:1.5px solid ' + (sel ? '#f97316' : '#1e293b') + ';color:' + (sel ? '#f97316' : '#e2e8f0') + ';cursor:pointer;font-size:0.82rem;font-weight:600;font-family:inherit;transition:all 0.2s;display:flex;align-items:center;gap:5px;">' +
                    topic.emoji + ' ' + topic.label + '</button>';
            });

            html += '</div>' +
                '<div style="margin-top:18px;">' +
                    '<button onclick="window._obFinishWithInterests()" ' + (intValid ? '' : 'disabled') + ' style="width:100%;padding:16px 0;background:' + (intValid ? 'linear-gradient(135deg,#f97316,#ea580c)' : '#1e293b') + ';color:' + (intValid ? '#fff' : '#475569') + ';border:none;border-radius:14px;font-size:1.05rem;font-weight:800;cursor:' + (intValid ? 'pointer' : 'default') + ';font-family:inherit;box-shadow:' + (intValid ? '0 8px 30px rgba(249,115,22,0.3)' : 'none') + ';transition:all 0.3s;">Start Exploring →</button>' +
                    '<button onclick="window._obBack()" style="width:100%;margin-top:10px;padding:12px 0;background:none;border:1px solid #1e293b;border-radius:12px;color:#475569;font-size:0.85rem;cursor:pointer;font-family:inherit;">← Back</button>' +
                    '<button onclick="window._obSkipInterests()" style="width:100%;margin-top:8px;padding:10px 0;background:none;border:none;color:#475569;font-size:0.78rem;cursor:pointer;font-family:inherit;">Skip — just show me everything</button>' +
                '</div>';
        }

        html += '</div>';
        overlay.innerHTML = html;
    }

    // Event handlers
    window._obSelectLevel = function(level) { state.level = level; render(); };
    window._obBuddyRole = function(role) { state.buddyRole = role; render(); };
    window._obAdvance = function() { if (state.level) { state.step = 1; render(); overlay.scrollTop = 0; } };
    window._obBack = function() { state.step = 0; render(); overlay.scrollTop = 0; };
    window._obToggleInterest = function(label) {
        var idx = state.interests.indexOf(label);
        if (idx !== -1) { state.interests.splice(idx, 1); }
        else if (state.interests.length < 5) { state.interests.push(label); }
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
    if (level === 'full') return;

    // Hide elements based on level
    var hideSelectors = {
        beginner: [
            '#dailySpinBanner', '#progressRings',
            '#dailyChallengeCard', '#quoteOfDay', '#explorationMap',
            '#donateSection', '[onclick*="showSpinWheel"]', '[onclick*="showPricePrediction"]',
            '.desktop-only-apps', '#lbFloatBtn', '#desktopDMBtn', '#rankBar',
            '#activity-ticker', '#continueReading'
        ],
        intermediate: ['#dailySpinBanner', '#progressRings', '#explorationMap', '#activity-ticker'],
        advanced: ['#dailySpinBanner']
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
            var bnavMsg = document.getElementById('bnavMsg') || document.getElementById('bnavNotif');
            if (bnavApps) { bnavApps.setAttribute('data-simplified-hidden', 'true'); bnavApps.style.display = 'none'; }
            if (bnavMsg) { bnavMsg.setAttribute('data-simplified-hidden', 'true'); bnavMsg.style.display = 'none'; }
        }
    }

    // Build curated channel list
    var channels = STARTER_CHANNELS[level] || STARTER_CHANNELS.beginner;
    var curated = [];
    var seen = [];

    // Add interest-based channels — round-robin across interests for equal representation
    if (profile && profile.interests && profile.interests.length > 0) {
        var perInterest = [];
        profile.interests.forEach(function(interest) {
            perInterest.push({ name: interest, channels: (INTEREST_MAP[interest] || []).slice() });
        });
        // Round-robin: take 1 channel per interest at a time
        var maxPerInterest = Math.max(2, Math.ceil(8 / perInterest.length));
        var round = 0;
        while (curated.length < 8 && round < 10) {
            var added = false;
            for (var i = 0; i < perInterest.length; i++) {
                if (curated.length >= 8) break;
                var ch = null;
                while (perInterest[i].channels.length > 0) {
                    var candidate = perInterest[i].channels.shift();
                    if (seen.indexOf(candidate) === -1) { ch = candidate; break; }
                }
                if (ch) {
                    seen.push(ch);
                    curated.push({ id: ch, reason: perInterest[i].name });
                    added = true;
                }
            }
            if (!added) break;
            round++;
        }
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
    section.style.cssText = 'width:100%;max-width:480px;margin:0 auto 28px;text-align:left;padding-top:8px;';

    var visited2 = [];
    try { visited2 = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]'); } catch(e) {}

    // Mission card for beginners
    var shtml = '';
    if (level === 'beginner' && visited2.length < 3) {
        shtml += '<div style="background:linear-gradient(135deg,rgba(249,115,22,0.08),rgba(249,115,22,0.02));border:2px solid rgba(249,115,22,0.3);border-radius:16px;padding:16px 18px;margin-bottom:16px;text-align:center;">' +
            '<div style="font-size:1.8rem;margin-bottom:6px;">📖 → ⭐ → 🏆</div>' +
            '<div style="color:var(--heading);font-weight:800;font-size:0.95rem;">Read channels. Earn XP. Level up.</div>' +
            '<div style="color:var(--text-muted);font-size:0.78rem;margin-top:4px;">Tap any channel below to start your journey!</div>' +
            '<div style="margin-top:8px;display:flex;align-items:center;gap:6px;justify-content:center;">' +
                '<div style="flex:1;max-width:200px;height:6px;background:var(--border);border-radius:3px;overflow:hidden;">' +
                    '<div style="height:100%;background:var(--accent);width:' + Math.round((visited2.length / 6) * 100) + '%;border-radius:3px;transition:0.3s;"></div>' +
                '</div>' +
                '<span style="font-size:0.7rem;color:var(--text-faint);">' + visited2.length + '/6 started</span>' +
            '</div>' +
        '</div>';
    }

    var heading = (level === 'beginner') ? '🟢 START HERE — tap your first channel' :
                  (level === 'intermediate') ? '📌 Picked for you — based on your interests' :
                  '🔥 Deep cuts — based on your interests';
    shtml += '<div style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1.5px;font-weight:800;margin-bottom:10px;">' + heading + '</div>';

    channels.forEach(function(ch, idx) {
        var meta = (typeof CHANNELS !== 'undefined') ? CHANNELS[ch.id] : null;
        if (!meta) return;
        var emojiMatch = meta.title ? meta.title.match(/^([\u{1F000}-\u{1FFFF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}]+)/u) : null;
        var emoji = emojiMatch ? emojiMatch[1] : '📄';
        var name = ch.id.replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
        var isRead = visited2.indexOf(ch.id) !== -1;
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

    // Quick action cards — level-specific
    shtml += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px;">';
    if (level === 'beginner') {
        shtml += '<div onclick="go(\'first-purchase\')" style="padding:14px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:12px;cursor:pointer;text-align:center;">' +
            '<div style="font-size:1.3rem;">🛒</div><div style="font-weight:700;font-size:0.78rem;color:#22c55e;margin-top:4px;">Buy Your First Bitcoin</div></div>';
        shtml += '<div onclick="go(\'trails\')" style="padding:14px;background:rgba(249,115,22,0.06);border:1px solid rgba(249,115,22,0.2);border-radius:12px;cursor:pointer;text-align:center;">' +
            '<div style="font-size:1.3rem;">🦌</div><div style="font-weight:700;font-size:0.78rem;color:var(--accent);margin-top:4px;">Nacho\'s Trails</div></div>';
    } else if (level === 'intermediate') {
        shtml += '<div onclick="go(\'trails\')" style="padding:14px;background:rgba(249,115,22,0.06);border:1px solid rgba(249,115,22,0.2);border-radius:12px;cursor:pointer;text-align:center;">' +
            '<div style="font-size:1.3rem;">🦌</div><div style="font-weight:700;font-size:0.78rem;color:var(--accent);margin-top:4px;">Nacho\'s Trails</div></div>';
        shtml += '<div onclick="go(\'first-purchase\')" style="padding:14px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:12px;cursor:pointer;text-align:center;">' +
            '<div style="font-size:1.3rem;">🛒</div><div style="font-weight:700;font-size:0.78rem;color:#22c55e;margin-top:4px;">Buy Bitcoin Guide</div></div>';
        shtml += '<div onclick="if(typeof toggleDashboard===\'function\')toggleDashboard()" style="padding:14px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);border-radius:12px;cursor:pointer;text-align:center;">' +
            '<div style="font-size:1.3rem;">📊</div><div style="font-weight:700;font-size:0.78rem;color:#6366f1;margin-top:4px;">Bitcoin Network Metrics</div></div>';
        shtml += '<div onclick="if(typeof enterNachoMode===\'function\')enterNachoMode()" style="padding:14px;background:rgba(249,115,22,0.04);border:1px dashed rgba(249,115,22,0.2);border-radius:12px;cursor:pointer;text-align:center;">' +
            '<div style="font-size:1.3rem;">🦌</div><div style="font-weight:700;font-size:0.78rem;color:var(--accent);margin-top:4px;">Ask Nacho</div></div>';
    } else {
        var _obNeedAuth = "if(typeof auth!=='undefined'&&auth&&auth.currentUser&&!auth.currentUser.isAnonymous){";
        var _obElseSignIn = "}else{if(typeof showToast==='function')showToast('🔐 Sign in to access this feature');if(typeof showUsernamePrompt==='function')setTimeout(showUsernamePrompt,300);}";
        shtml += '<div onclick="if(typeof toggleDashboard===\'function\')toggleDashboard()" style="padding:14px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);border-radius:12px;cursor:pointer;text-align:center;">' +
            '<div style="font-size:1.3rem;">📊</div><div style="font-weight:700;font-size:0.78rem;color:#6366f1;margin-top:4px;">Bitcoin Network Metrics</div></div>';
        shtml += '<div onclick="' + _obNeedAuth + "if(typeof toggleChatOverlay==='function'){var p=document.getElementById('chatOverlay');if(!p||p.style.transform==='translateY(100%)')toggleChatOverlay();}else if(typeof renderChatHub==='function')renderChatHub('global');" + _obElseSignIn + '" style="padding:14px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:12px;cursor:pointer;text-align:center;">' +
            '<div style="font-size:1.3rem;">🌍</div><div style="font-weight:700;font-size:0.78rem;color:#22c55e;margin-top:4px;">Global Chat</div></div>';
        shtml += '<div onclick="' + _obNeedAuth + "showSettings();setTimeout(function(){showSettingsPage('scholar')},100);" + _obElseSignIn + '" style="padding:14px;background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.2);border-radius:12px;cursor:pointer;text-align:center;">' +
            '<div style="font-size:1.3rem;">🎓</div><div style="font-weight:700;font-size:0.78rem;color:#a855f7;margin-top:4px;">Scholar Cert</div></div>';
        shtml += '<div onclick="go(\'irl-sync\')" style="padding:14px;background:rgba(249,115,22,0.06);border:1px solid rgba(249,115,22,0.2);border-radius:12px;cursor:pointer;text-align:center;">' +
            '<div style="font-size:1.3rem;">🤝</div><div style="font-weight:700;font-size:0.78rem;color:var(--accent);margin-top:4px;">IRL Meetups</div></div>';
    }
    shtml += '</div>';

    // Ask Nacho card (for beginners after 2 channels)
    if (level === 'beginner' && visited2.length >= 2) {
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
};

// ---- Progressive reveal ----
window.checkProgressiveReveal = function() {
    var v = [];
    try { v = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]'); } catch(e) {}

    if (v.length >= 3) {
        ['#nacho-container', '#bnavApps', '#bnavNotif'].forEach(function(sel) {
            document.querySelectorAll(sel).forEach(function(el) {
                if (el.getAttribute('data-simplified-hidden')) {
                    el.style.display = '';
                    el.removeAttribute('data-simplified-hidden');
                }
            });
        });
    }

    if (v.length >= 5) {
        ['#lbFloatBtn', '[onclick*="showSpinWheel"]'].forEach(function(sel) {
            document.querySelectorAll(sel).forEach(function(el) {
                if (el.getAttribute('data-simplified-hidden')) { el.style.display = ''; el.removeAttribute('data-simplified-hidden'); }
            });
        });
    }

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
    var ranOnboarding = window.showOnboardingWizard();
    if (!ranOnboarding) {
        window.applySimplifiedHome();
        // Resume Nacho Quest if active
        if (window.isNachoQuestActive() && !window.isNachoQuestDone()) {
            window._showNachoQuestPill();
            window.startNachoQuestDetection();
        }
        // Show ghost banner if anonymous
        if (typeof auth !== 'undefined' && auth && auth.currentUser && auth.currentUser.isAnonymous) {
            // Wait a bit for auth to fully settle
            setTimeout(window._showGhostBanner, 5000);
        }
        // Show social proof bar on first session load
        setTimeout(window._showSocialProofBar, 3500);
    }

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
                // Auto-advance quest step 0 on channel visit
                if (window.isNachoQuestActive() && window.getNachoQuestStep() === 0) {
                    var visited = [];
                    try { visited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]'); } catch(e) {}
                    if (visited.length > 0) {
                        localStorage.setItem('btc_nacho_quest_step0_done', '1');
                    }
                }
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

console.log('[ONBOARDING] v2 loaded — Nacho Quest, Pleb Moment, Social Proof, Ghost Mode');
}();
