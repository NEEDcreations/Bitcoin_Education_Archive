(function() {
'use strict';

// =============================================
// Learning Quests — learning-quests.js
// Lazy-loaded interactive Bitcoin lessons
// =============================================

// --- Storage helpers ---
var LQ_KEY = 'btc_lq_progress';
var LQ_GRADUATE_KEY = 'btc_lq_graduate_awarded';

function lqGetProgress() { try { return JSON.parse(localStorage.getItem(LQ_KEY) || '{}'); } catch(e) { return {}; } }
function lqSaveProgress(p) {
    localStorage.setItem(LQ_KEY, JSON.stringify(p));
    if (typeof db !== 'undefined' && typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) {
        db.collection('users').doc(auth.currentUser.uid).update({ lqProgress: p }).catch(function(){});
    }
}
function lqGetTopic(slug) { var p = lqGetProgress(); return p[slug] || { passed: false, lessonSeen: false, attempts: 0, bestScore: 0 }; }
function lqSaveTopic(slug, data) { var p = lqGetProgress(); p[slug] = Object.assign(lqGetTopic(slug), data); lqSaveProgress(p); }

// --- Inject CSS once ---
(function() {
    if (document.getElementById('lqStyles')) return;
    var style = document.createElement('style');
    style.id = 'lqStyles';
    style.textContent = [
        '@keyframes lqFadeIn{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}',
        '@keyframes lqSlideInRight{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:translateX(0)}}',
        '@keyframes lqSlideInLeft{from{opacity:0;transform:translateX(-60px)}to{opacity:1;transform:translateX(0)}}',
        '@keyframes lqSlideOutLeft{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(-60px)}}',
        '@keyframes lqBounce{0%{transform:scale(0.5)}60%{transform:scale(1.3)}100%{transform:scale(1)}}',
        '@keyframes lqPulse{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.4)}50%{box-shadow:0 0 0 12px rgba(34,197,94,0)}}',
        '@keyframes lqSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}',
        '@keyframes lqZap{0%,100%{opacity:1}50%{opacity:0.2}}',
        '@keyframes lqFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}',
        '@keyframes lqFlash{0%,100%{opacity:1;color:#facc15}50%{opacity:0.3;color:#fff}}',
        '@keyframes lqPulseRing{0%{transform:scale(1);opacity:0.8}100%{transform:scale(2.2);opacity:0}}',
        '.lq-overlay{position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,0.97);overflow-y:auto;-webkit-overflow-scrolling:touch;}',
        '.lq-card{border-radius:16px;padding:16px;cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;}',
        '.lq-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.4);}',
        '.lq-btn{padding:12px 20px;border-radius:12px;font-weight:800;cursor:pointer;font-family:inherit;border:none;font-size:0.9rem;transition:opacity 0.15s;}',
        '.lq-btn:hover{opacity:0.85;}',
        '.lq-ans-btn{width:100%;padding:14px 16px;border-radius:12px;font-weight:700;cursor:pointer;font-family:inherit;border:2px solid var(--border,#333);background:var(--bg2,#1a1a1a);color:var(--text,#fff);font-size:0.9rem;text-align:left;transition:all 0.2s;}',
        '.lq-ans-btn:hover:not(:disabled){border-color:#f97316;background:rgba(249,115,22,0.1);}',
        '.lq-ans-btn:disabled{cursor:default;}',
        '.lq-ans-btn.lq-correct{border-color:#22c55e!important;background:rgba(34,197,94,0.18)!important;color:#22c55e!important;}',
        '.lq-ans-btn.lq-wrong{border-color:#ef4444!important;background:rgba(239,68,68,0.12)!important;color:#ef4444!important;}',
        '.lq-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin:0 3px;background:rgba(255,255,255,0.25);transition:background 0.2s;}',
        '.lq-dot.active{background:#f97316;}'
    ].join('');
    document.head.appendChild(style);
})();

// --- Sound functions (module-local) ---
function _lqPlaySlide() {
    if (!window.canPlaySound || !window.canPlaySound()) return;
    try {
        var ac = new (window.AudioContext || window.webkitAudioContext)();
        var v = window.audioVolume || 0.5;
        var o = ac.createOscillator(); var g = ac.createGain();
        o.connect(g); g.connect(ac.destination);
        o.type = 'sine'; o.frequency.setValueAtTime(440, ac.currentTime);
        o.frequency.linearRampToValueAtTime(660, ac.currentTime + 0.08);
        g.gain.setValueAtTime(0.10 * v, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.08);
        o.start(ac.currentTime); o.stop(ac.currentTime + 0.09);
    } catch(e) {}
}

function _lqPlayCorrect() {
    if (!window.canPlaySound || !window.canPlaySound()) return;
    try {
        var ac = new (window.AudioContext || window.webkitAudioContext)();
        var v = window.audioVolume || 0.5;
        [880, 1108].forEach(function(freq, i) {
            var o = ac.createOscillator(); var g = ac.createGain();
            o.connect(g); g.connect(ac.destination);
            o.type = 'triangle'; o.frequency.setValueAtTime(freq, ac.currentTime);
            g.gain.setValueAtTime(0.18 * v, ac.currentTime + i * 0.09);
            g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.09 + 0.09);
            o.start(ac.currentTime + i * 0.09); o.stop(ac.currentTime + i * 0.09 + 0.1);
        });
    } catch(e) {}
}

function _lqPlayWrong() {
    if (!window.canPlaySound || !window.canPlaySound()) return;
    try {
        var ac = new (window.AudioContext || window.webkitAudioContext)();
        var v = window.audioVolume || 0.5;
        var o = ac.createOscillator(); var g = ac.createGain();
        o.connect(g); g.connect(ac.destination);
        o.type = 'sawtooth'; o.frequency.setValueAtTime(300, ac.currentTime);
        o.frequency.linearRampToValueAtTime(150, ac.currentTime + 0.15);
        g.gain.setValueAtTime(0.14 * v, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
        o.start(ac.currentTime); o.stop(ac.currentTime + 0.16);
    } catch(e) {}
}

function _lqPlayPass() {
    if (!window.canPlaySound || !window.canPlaySound()) return;
    try {
        var ac = new (window.AudioContext || window.webkitAudioContext)();
        var v = window.audioVolume || 0.5;
        [261, 329, 392, 523].forEach(function(freq, i) {
            var o = ac.createOscillator(); var g = ac.createGain();
            o.connect(g); g.connect(ac.destination);
            o.type = 'sine'; o.frequency.setValueAtTime(freq, ac.currentTime);
            g.gain.setValueAtTime(0.18 * v, ac.currentTime + i * 0.12);
            g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.12 + 0.12);
            o.start(ac.currentTime + i * 0.12); o.stop(ac.currentTime + i * 0.12 + 0.13);
        });
    } catch(e) {}
}

function _lqPlayFail() {
    if (!window.canPlaySound || !window.canPlaySound()) return;
    try {
        var ac = new (window.AudioContext || window.webkitAudioContext)();
        var v = window.audioVolume || 0.5;
        [500, 350].forEach(function(freq, i) {
            var o = ac.createOscillator(); var g = ac.createGain();
            o.connect(g); g.connect(ac.destination);
            o.type = 'sine'; o.frequency.setValueAtTime(freq, ac.currentTime);
            g.gain.setValueAtTime(0.12 * v, ac.currentTime + i * 0.2);
            g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.2 + 0.2);
            o.start(ac.currentTime + i * 0.2); o.stop(ac.currentTime + i * 0.2 + 0.21);
        });
    } catch(e) {}
}

// --- Illustrations ---
function _lqIllustration_what_is_bitcoin(idx) {
    return '<div style="display:flex;justify-content:center;align-items:center;height:140px;">' +
        '<div style="position:relative;width:100px;height:100px;">' +
        '<div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,#f97316,#ea580c);animation:lqFloat 2.5s ease-in-out infinite;display:flex;align-items:center;justify-content:center;font-size:3rem;box-shadow:0 0 30px rgba(249,115,22,0.6);">₿</div>' +
        '<div style="position:absolute;inset:-12px;border-radius:50%;border:3px solid rgba(249,115,22,0.3);animation:lqPulseRing 2s ease-out infinite;"></div>' +
        '<div style="position:absolute;inset:-24px;border-radius:50%;border:2px solid rgba(249,115,22,0.15);animation:lqPulseRing 2s ease-out infinite 0.5s;"></div>' +
        '</div></div>';
}

function _lqIllustration_mining(idx) {
    var nonces = ['a3f2b1','7c9e4d','12ab8f','e5f901','3d7c2a',];
    var n = nonces[idx % nonces.length];
    return '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:140px;gap:8px;">' +
        '<div style="position:relative;width:80px;height:80px;">' +
        '<div style="position:absolute;inset:0;border-radius:50%;border:4px solid transparent;border-top-color:#f59e0b;border-right-color:#f59e0b;animation:lqSpin 1s linear infinite;"></div>' +
        '<div style="position:absolute;inset:8px;border-radius:50%;border:3px solid transparent;border-bottom-color:#fbbf24;animation:lqSpin 0.7s linear infinite reverse;"></div>' +
        '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:1.6rem;">⛏️</div>' +
        '</div>' +
        '<div style="font-family:monospace;font-size:0.75rem;color:#f59e0b;animation:lqFlash 0.8s ease-in-out infinite;letter-spacing:1px;">nonce: ' + n + '...</div>' +
        '</div>';
}

function _lqIllustration_nodes(idx) {
    return '<div style="display:flex;justify-content:center;align-items:center;height:140px;">' +
        '<svg width="200" height="120" viewBox="0 0 200 120">' +
        '<style>@keyframes lqLine{0%,100%{stroke-dashoffset:20}50%{stroke-dashoffset:0}}</style>' +
        '<line x1="100" y1="60" x2="30" y2="20" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4,3" style="animation:lqLine 1.5s linear infinite"/>' +
        '<line x1="100" y1="60" x2="170" y2="20" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4,3" style="animation:lqLine 1.5s linear infinite 0.3s"/>' +
        '<line x1="100" y1="60" x2="30" y2="100" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4,3" style="animation:lqLine 1.5s linear infinite 0.6s"/>' +
        '<line x1="100" y1="60" x2="170" y2="100" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4,3" style="animation:lqLine 1.5s linear infinite 0.9s"/>' +
        '<line x1="30" y1="20" x2="170" y2="20" stroke="#3b82f6" stroke-width="1" stroke-dasharray="4,3" style="animation:lqLine 2s linear infinite 0.2s" opacity="0.5"/>' +
        '<line x1="30" y1="100" x2="170" y2="100" stroke="#3b82f6" stroke-width="1" stroke-dasharray="4,3" style="animation:lqLine 2s linear infinite 0.7s" opacity="0.5"/>' +
        '<circle cx="100" cy="60" r="12" fill="#1e40af" stroke="#3b82f6" stroke-width="2"/><text x="100" y="65" text-anchor="middle" font-size="12" fill="#fff">🖥</text>' +
        '<circle cx="30" cy="20" r="9" fill="#1e3a5f" stroke="#60a5fa" stroke-width="1.5"/><text x="30" y="25" text-anchor="middle" font-size="10" fill="#fff">🖥</text>' +
        '<circle cx="170" cy="20" r="9" fill="#1e3a5f" stroke="#60a5fa" stroke-width="1.5"/><text x="170" y="25" text-anchor="middle" font-size="10" fill="#fff">🖥</text>' +
        '<circle cx="30" cy="100" r="9" fill="#1e3a5f" stroke="#60a5fa" stroke-width="1.5"/><text x="30" y="105" text-anchor="middle" font-size="10" fill="#fff">🖥</text>' +
        '<circle cx="170" cy="100" r="9" fill="#1e3a5f" stroke="#60a5fa" stroke-width="1.5"/><text x="170" y="105" text-anchor="middle" font-size="10" fill="#fff">🖥</text>' +
        '</svg></div>';
}

function _lqIllustration_self_custody(idx) {
    return '<div style="display:flex;justify-content:center;align-items:center;height:140px;gap:16px;">' +
        '<div style="font-size:3rem;animation:lqFloat 2s ease-in-out infinite;">🔑</div>' +
        '<div style="font-size:0.9rem;color:#22c55e;font-weight:700;">→</div>' +
        '<div style="font-size:2.5rem;filter:drop-shadow(0 0 8px rgba(34,197,94,0.5));animation:lqFloat 2s ease-in-out infinite 0.5s;">🔒</div>' +
        '</div>';
}

function _lqIllustration_lightning(idx) {
    return '<div style="display:flex;justify-content:center;align-items:center;height:140px;">' +
        '<svg width="200" height="120" viewBox="0 0 200 120">' +
        '<style>@keyframes lqHop{0%,100%{opacity:0.2}50%{opacity:1}}</style>' +
        '<circle cx="20" cy="60" r="10" fill="#292524" stroke="#eab308" stroke-width="2"/>' +
        '<text x="20" y="65" text-anchor="middle" font-size="11" fill="#eab308">A</text>' +
        '<circle cx="80" cy="30" r="10" fill="#292524" stroke="#eab308" stroke-width="2" style="animation:lqHop 1.2s ease-in-out infinite 0.3s"/>' +
        '<text x="80" y="35" text-anchor="middle" font-size="11" fill="#eab308">B</text>' +
        '<circle cx="140" cy="75" r="10" fill="#292524" stroke="#eab308" stroke-width="2" style="animation:lqHop 1.2s ease-in-out infinite 0.6s"/>' +
        '<text x="140" y="80" text-anchor="middle" font-size="11" fill="#eab308">C</text>' +
        '<circle cx="185" cy="50" r="10" fill="#292524" stroke="#eab308" stroke-width="2" style="animation:lqHop 1.2s ease-in-out infinite 0.9s"/>' +
        '<text x="185" y="55" text-anchor="middle" font-size="11" fill="#eab308">D</text>' +
        '<line x1="30" y1="57" x2="70" y2="37" stroke="#eab308" stroke-width="1.5" stroke-dasharray="4,3" style="animation:lqHop 1.2s ease-in-out infinite"/>' +
        '<line x1="90" y1="40" x2="130" y2="67" stroke="#eab308" stroke-width="1.5" stroke-dasharray="4,3" style="animation:lqHop 1.2s ease-in-out infinite 0.3s"/>' +
        '<line x1="150" y1="68" x2="175" y2="57" stroke="#eab308" stroke-width="1.5" stroke-dasharray="4,3" style="animation:lqHop 1.2s ease-in-out infinite 0.6s"/>' +
        '<text x="100" y="110" text-anchor="middle" font-size="22" fill="#eab308" style="animation:lqZap 0.6s ease-in-out infinite;">⚡</text>' +
        '</svg></div>';
}

function _lqIllustration_scarcity(idx) {
    return '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:140px;gap:6px;">' +
        '<div style="font-size:2rem;">💎</div>' +
        '<div style="font-family:monospace;font-size:1.1rem;color:#a855f7;font-weight:700;letter-spacing:2px;">21,000,000</div>' +
        '<div style="font-size:0.7rem;color:rgba(168,85,247,0.7);letter-spacing:1px;">BTC — FOREVER FIXED</div>' +
        '<div style="width:140px;height:8px;background:rgba(168,85,247,0.15);border-radius:4px;overflow:hidden;margin-top:4px;">' +
        '<div style="width:90%;height:100%;background:linear-gradient(90deg,#a855f7,#7c3aed);border-radius:4px;animation:lqPulse 2s ease-in-out infinite;"></div>' +
        '</div>' +
        '<div style="font-size:0.7rem;color:rgba(255,255,255,0.5);">~19.8M mined · ~1.2M remaining</div>' +
        '</div>';
}

function _lqIllustration_bitcoin_only(idx) {
    return '<div style="display:flex;justify-content:center;align-items:center;height:140px;gap:12px;">' +
        '<div style="font-size:2.5rem;animation:lqFloat 2s ease-in-out infinite;filter:drop-shadow(0 0 8px rgba(239,68,68,0.4));">🛡️</div>' +
        '<div style="display:flex;flex-direction:column;gap:4px;">' +
        ['DOGE','ETH','XRP','ADA'].map(function(c) {
            return '<div style="font-size:0.65rem;color:#ef4444;font-family:monospace;text-decoration:line-through;opacity:0.7;">✗ ' + c + '</div>';
        }).join('') +
        '</div>' +
        '</div>';
}

function _lqIllustration_privacy(idx) {
    return '<div style="display:flex;justify-content:center;align-items:center;height:140px;">' +
        '<div style="position:relative;display:inline-block;">' +
        '<div style="font-size:3.5rem;filter:grayscale(0.3);">👁️</div>' +
        '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);width:60px;height:3px;background:#14b8a6;border-radius:2px;box-shadow:0 0 8px rgba(20,184,166,0.8);"></div>' +
        '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);width:3px;height:60px;background:#14b8a6;border-radius:2px;box-shadow:0 0 8px rgba(20,184,166,0.8);"></div>' +
        '</div>' +
        '</div>';
}

// --- Per-slide stat callouts and analogies ---
var _LQ_SLIDE_EXTRAS = {
    'what-is-bitcoin': {
        0: { stat: '💡 There are ~106 billion people who have ever lived. Only 21 million BTC will ever exist — less than 1 per 5,000 people who ever walked the earth.', analogy: '💡 Think of it like: email for money — you can send value to anyone, anywhere, instantly, with no bank in the middle.' },
        1: { stat: '📊 Since 2009, Bitcoin has had 99.98% uptime — more reliable than any bank in history.', analogy: '💡 Think of it like: a vending machine — it follows its rules exactly, no matter who asks. No bribing the machine.' },
        2: { stat: '📊 The US Federal Reserve printed more money in 2020 alone than in the previous 200 years combined.', analogy: '💡 Think of it like: gold — except the scarcity is guaranteed by math, not geology. You can verify it yourself.' },
        3: { stat: '🌍 1.4 billion adults worldwide have no bank account. Bitcoin needs only a phone and internet.', analogy: '💡 Think of it like: cash — but borderless. A Nigerian farmer and a New York banker use the exact same system.' },
        4: { stat: '⚡ Sending $1 billion in Bitcoin takes ~10 minutes and costs a few dollars. A SWIFT wire transfer takes 3–5 days and costs hundreds.', analogy: '💡 Think of it like: the internet itself — it doesn\'t care what country you\'re in, what time it is, or how much you\'re sending.' }
    },
    'scarcity': {
        0: { stat: '📊 As of 2024, ~19.7 million BTC have been mined. Only ~1.3 million remain to be created — ever.', analogy: '💡 Think of it like: a pianist who can only play 21 million unique notes, built into the instrument itself. The limit is structural, not a promise.' },
        1: { stat: '⛏️ The 2024 halving dropped the daily new supply from ~900 BTC/day to ~450 BTC/day. Gold mines produce more gold every year.', analogy: '💡 Think of it like: a gold mine that produces half as much gold every 4 years — on a perfectly predictable schedule, enforced by code.' },
        2: { stat: '📉 After the 2140 halving, zero new Bitcoin will ever be created. Only fees will reward miners — forever.', analogy: '💡 Think of it like: a countdown clock set in 2009 that nobody can speed up, slow down, or stop.' },
        3: { stat: '💸 The US dollar has lost over 96% of its purchasing power since 1913. Bitcoin\'s supply has never changed once in its coded schedule.', analogy: '💡 Think of it like: a fixed-supply antique — the fewer that exist and the more people want one, the more each one is worth.' }
    },
    'mining': {
        0: { stat: '🔢 Bitcoin miners collectively attempt over 600 quintillion (6×10²⁰) hashes per second. That\'s more calculations per second than grains of sand on Earth.', analogy: '💡 Think of it like: a global lottery where billions of tickets are bought every second — and the winner earns the right to add the next page to history.' },
        1: { stat: '🔐 SHA-256 produces 2²⁵⁶ possible outputs. Brute-forcing a single hash would take longer than the age of the universe on all computers ever built.', analogy: '💡 Think of it like: rolling a trillion dice simultaneously — and needing them all to come up six. Guessing is the only option.' },
        2: { stat: '⛓️ To rewrite Bitcoin\'s last year of history, you\'d need to outpace the entire global network\'s computing power — continuously, for months.', analogy: '💡 Think of it like: amber — once work is encased in a block, undoing it becomes more impossibly expensive with every new block added on top.' },
        3: { stat: '💰 In April 2024, the block reward halved to 3.125 BTC. At today\'s prices, a winning miner earns ~$300,000 per block — every ~10 minutes.', analogy: '💡 Think of it like: a gold rush where the reward is cut in half every 4 years, but the value of gold keeps going up.' }
    },
    'nodes': {
        0: { stat: '🌐 There are 15,000+ publicly reachable Bitcoin nodes across 100+ countries. Tens of thousands more run privately. There is no master server.', analogy: '💡 Think of it like: everyone in a town keeping their own copy of the ledger. No single person can fake an entry — the whole town would reject it.' },
        1: { stat: '🛡️ Bitcoin has never had a successful double-spend on the main chain in 15+ years of operation. Decentralization is why.', analogy: '💡 Think of it like: Wikipedia — but where every single editor independently verifies every fact, and no one editor can change anything alone.' },
        2: { stat: '✅ A full node validates every single rule: supply cap, transaction signatures, block size, difficulty — all of it, automatically, forever.', analogy: '💡 Think of it like: auditing your own bank statement rather than trusting the bank\'s summary. Your node is the audit.' },
        3: { stat: '⚖️ In 2017, users running nodes rejected a miner-backed plan to increase block size. Users, not miners, decide the rules.', analogy: '💡 Think of it like: the difference between calling your bank to check your balance (trusting them) versus counting the cash yourself.' }
    },
    'lightning': {
        0: { stat: '⏱️ Bitcoin settles a block every ~10 minutes by design. Visa processes ~24,000 transactions per second. Lightning bridges that gap without sacrificing security.', analogy: '💡 Think of it like: a bar tab — you run up a tab all night (off-chain), then settle once at the end (on-chain). Efficient and final.' },
        1: { stat: '⚡ Lightning payments settle in under 1 second with fees often less than 1 satoshi (~$0.0003). Cheaper than any payment processor on earth.', analogy: '💡 Think of it like: a private IOUs system between two people — quick and free between you — that\'s guaranteed by real Bitcoin on both ends.' },
        2: { stat: '🌐 The Lightning Network has grown from zero to over 5,000 BTC in capacity since 2018. Millions of payments route daily.', analogy: '💡 Think of it like: flight connections — you don\'t need a direct flight from every city to every other city. Hubs route you there in milliseconds.' },
        3: { stat: '☕ A Lightning transaction can send 1 satoshi (0.00000001 BTC, ~$0.001). You literally cannot do that with a credit card or bank transfer.', analogy: '💡 Think of it like: the internet for payments — just as you stream music in real time, you can now stream money, satoshi by satoshi.' }
    },
    'self-custody': {
        0: { stat: '💀 Mt. Gox (2014): $460M lost. Bitfinex (2016): $72M. Celsius (2022): $4.7B. FTX (2022): $8B+. All exchanges. All custodial.', analogy: '💡 Think of it like: leaving your cash at a casino to "hold" — they use it, they can lose it, and good luck getting it back.' },
        1: { stat: '🔑 A Bitcoin private key is a 256-bit number. There are more possible private keys than atoms in the observable universe. Yours is statistically unique forever.', analogy: '💡 Think of it like: a master key to a vault — anyone who copies it owns everything inside. Protect it like your life depends on it.' },
        2: { stat: '📝 A 24-word seed phrase encodes your entire Bitcoin fortune. Written on paper, it survives any phone crash, hack, or hard drive failure.', analogy: '💡 Think of it like: the combination to a safe that exists outside of any building — if you know the combo, you can open it from anywhere.' },
        3: { stat: '🔒 Hardware wallets have never had a remote exploit that drained funds. Your keys never touch an internet-connected device.', analogy: '💡 Think of it like: a safe deposit box you own entirely — except it\'s portable, invisible, and no government can seize it with a court order.' },
        4: { stat: '🏦 When you self-custody, you become your own bank — with the same power JP Morgan has, in your pocket, without their permission.', analogy: '💡 Think of it like: the difference between renting and owning. The exchange is the landlord. Self-custody means you own the property outright.' }
    },
    'privacy': {
        0: { stat: '🔍 Chainalysis, Elliptic, and CipherTrace have collectively raised hundreds of millions to trace Bitcoin transactions for governments and exchanges.', analogy: '💡 Think of it like: a public bulletin board — your name isn\'t on it, but your handwriting is. Patterns reveal identity over time.' },
        1: { stat: '⚖️ In 2021, the EU proposed banning anonymous crypto transfers over €1,000. Financial privacy is being legislated away globally.', analogy: '💡 Think of it like: cash — the last private payment tool. Bitcoin with good privacy hygiene is the digital equivalent.' },
        2: { stat: '🔐 CoinJoin pools multiple users\' transactions together. An observer can\'t tell which input paid which output — breaking the transaction graph.', analogy: '💡 Think of it like: putting multiple checks in a shared envelope — the recipient knows money arrived, but not who sent what.' },
        3: { stat: '🌍 In Nigeria (2021), Lebanon, and Venezuela, governments have frozen bank accounts of protesters and dissidents. Bitcoin cannot be frozen.', analogy: '💡 Think of it like: speaking a private language only you and your recipient know — the message is public, but meaningless to observers.' }
    },
    'bitcoin-only': {
        0: { stat: '📉 Of the top 10 cryptocurrencies by market cap in 2013, only Bitcoin remains in the top 10 today. Most others are gone entirely.', analogy: '💡 Think of it like: the internet vs. intranets — thousands of private networks existed before the internet won. One open protocol dominates.' },
        1: { stat: '⚠️ Ethereum\'s founders pre-allocated ~72 million ETH to themselves before launch. Bitcoin\'s creator disappeared and never spent a single sat.', analogy: '💡 Think of it like: the difference between a public park (Bitcoin) and a privately-owned plaza that looks public (most altcoins).' },
        2: { stat: '🔁 Every problem altcoins claim to solve — speed, privacy, smart contracts — is either being built on Bitcoin or isn\'t actually a blockchain problem.', analogy: '💡 Think of it like: adding a faster engine to a house — the problem was never the house\'s speed. Altcoins often solve the wrong problem.' }
    }
};

// --- Per-slide real images (from archive graphics/charts/memes) ---
var _LQ_SLIDE_IMAGES = {
    'what-is-bitcoin': {
        0: 'https://assets.bitcoineducation.quest/images/resources/graphics_0086_What_does_Bitcoin_solve.jpg',
        1: 'https://assets.bitcoineducation.quest/images/resources/graphics_0004_tx.jpg',
        2: 'https://assets.bitcoineducation.quest/images/resources/graphics_0025_properties_of_money.jpg',
        3: 'https://assets.bitcoineducation.quest/images/resources/graphics_0022_money_transfer.jpg'
    },
    'scarcity': {
        0: 'https://assets.bitcoineducation.quest/images/resources/graphics_0009_supply_cap.jpg',
        1: 'https://assets.bitcoineducation.quest/images/resources/graphics_0042_bitcoin_issuance_per_epoch.jpg',
        2: 'https://assets.bitcoineducation.quest/images/resources/graphics_0073_Bitcoin_supply_visualized.jpg',
        3: 'https://assets.bitcoineducation.quest/images/resources/graphics_0202_relative_scarcity_vs_absolute_scarcity_gold_vs_bitcoin.jpg'
    },
    'mining': {
        0: 'https://assets.bitcoineducation.quest/images/resources/graphics_0226_how_mining_works_put_together_by_the_White_House.png',
        1: 'https://assets.bitcoineducation.quest/images/resources/graphics_0142_sha256_visualization.jpg',
        2: 'https://assets.bitcoineducation.quest/images/resources/graphics_0157_proof_of_work.jpg',
        3: 'https://assets.bitcoineducation.quest/images/resources/graphics_0714_20220517_070749.jpg'
    },
    'nodes': {
        0: 'https://assets.bitcoineducation.quest/images/resources/graphics_0020_network_effects.png',
        1: 'https://assets.bitcoineducation.quest/images/resources/graphics_0046_cryptocurrency_ven_diagram.jpg',
        2: 'https://assets.bitcoineducation.quest/images/resources/graphics_0018_node_verification_is_better.png',
        3: 'https://assets.bitcoineducation.quest/images/resources/graphics_0017_miners_vs_nodes.png'
    },
    'lightning': {
        0: 'https://assets.bitcoineducation.quest/images/resources/charts_0287_20220628_093515.jpg',
        1: 'https://assets.bitcoineducation.quest/images/resources/graphics_0088_lightning_network_ecosystem.jpg',
        2: 'https://assets.bitcoineducation.quest/images/resources/charts_0003_growth_of_lightning_network.png',
        3: 'https://assets.bitcoineducation.quest/images/resources/graphics_0026_Lightning_Network_growth.jpg'
    },
    'self-custody': {
        0: 'https://assets.bitcoineducation.quest/images/resources/memes-funny_0086_false_sense_of_security.png',
        1: 'https://assets.bitcoineducation.quest/images/resources/graphics_0014_key.jpg',
        2: 'https://assets.bitcoineducation.quest/images/resources/graphics_0095_20220426_153941.jpg',
        3: 'https://assets.bitcoineducation.quest/images/resources/graphics_0076_True_ownership.jpg'
    },
    'privacy': {
        0: 'https://assets.bitcoineducation.quest/images/resources/charts_0241_20220309_081833.jpg',
        1: 'https://assets.bitcoineducation.quest/images/resources/graphics_0225_cbdc_tracker.jpg',
        2: 'https://assets.bitcoineducation.quest/images/resources/graphics_0068_1_BTC__1_BTC.png',
        3: 'https://assets.bitcoineducation.quest/images/resources/graphics_0140_RDT_20220624_1902452176181798029452076.jpg'
    },
    'bitcoin-only': {
        0: 'https://assets.bitcoineducation.quest/images/resources/graphics_0043_Top_10_crypto_by_year.jpg',
        1: 'https://assets.bitcoineducation.quest/images/resources/graphics_0047_centralization_of_other_chains.jpg',
        2: 'https://assets.bitcoineducation.quest/images/resources/graphics_0134_bitcoin_vs_crypto.jpg'
    }
};

function _lqGetIllustration(slug, idx) {
    // Show real archive image if one is mapped for this slide
    var slideImgs = _LQ_SLIDE_IMAGES[slug];
    if (slideImgs && slideImgs[idx]) {
        return '<div style="width:100%;margin-top:4px;">' +
            '<img src="' + slideImgs[idx] + '" alt="" loading="lazy" ' +
            'style="width:100%;height:auto;max-height:340px;object-fit:contain;border-radius:12px;display:block;" ' +
            'onerror="this.parentElement.style.display=\'none\'">' +
            '</div>';
    }
    // Fallback: animated illustration
    var map = {
        'what-is-bitcoin': _lqIllustration_what_is_bitcoin,
        'mining': _lqIllustration_mining,
        'nodes': _lqIllustration_nodes,
        'self-custody': _lqIllustration_self_custody,
        'lightning': _lqIllustration_lightning,
        'scarcity': _lqIllustration_scarcity,
        'bitcoin-only': _lqIllustration_bitcoin_only,
        'privacy': _lqIllustration_privacy
    };
    var fn = map[slug];
    return fn ? fn(idx) : '<div style="height:200px;display:flex;align-items:center;justify-content:center;font-size:5rem;">₿</div>';
}

// --- Topic Data ---
var LQ_TOPICS = [
    {
        slug: 'what-is-bitcoin',
        emoji: '🟠',
        title: 'What is Bitcoin?',
        color: '#f97316',
        badgeId: 'lq_what_is_bitcoin',
        badgeName: '🟠 Bitcoin Basics',
        slides: [
            { headline: 'Bitcoin is Money, Reimagined', body: 'Bitcoin is a form of money that exists only on the internet. Unlike dollars or euros, no government or bank controls it. It was created in 2009 by someone called Satoshi Nakamoto.' },
            { headline: 'It Runs on Math, Not Trust', body: 'Bitcoin transactions are secured by cryptography — mathematical proofs that are nearly impossible to fake. You don\'t have to trust a bank, a CEO, or a government. The math doesn\'t lie.' },
            { headline: 'There Will Only Ever Be 21 Million', body: 'Like gold, Bitcoin is scarce. But unlike gold, its scarcity is guaranteed forever in computer code. No politician can order more to be printed. 21 million. That\'s it. Final.' },
            { headline: 'Anyone Can Use It', body: 'Bitcoin works the same whether you\'re a billionaire in New York or a farmer in Nigeria. All you need is a phone. No bank account required. No permission needed.' },
            { headline: 'You Can Send It Anywhere, Instantly', body: 'Sending $1 million in Bitcoin works just like sending $1. It crosses borders in minutes, 24/7/365, with no middleman taking a cut.' }
        ],
        questions: [
            { q: 'Who created Bitcoin?', a: 'Satoshi Nakamoto, an anonymous person or group', wrong: ['The US Federal Reserve', 'A team at MIT', 'Mark Zuckerberg'] },
            { q: 'When was Bitcoin created?', a: '2009', wrong: ['1999', '2013', '2001'] },
            { q: "What is Bitcoin's maximum supply?", a: '21 million BTC', wrong: ['1 billion', 'Unlimited', '100 million'] },
            { q: "What technology underpins Bitcoin's security?", a: 'Cryptography and proof of work', wrong: ['Government encryption standards', 'SQL databases', 'The SWIFT banking network'] },
            { q: 'Can anyone be denied access to Bitcoin?', a: 'No — Bitcoin is permissionless; anyone with internet access can use it', wrong: ['You must pass a KYC check', 'Only US citizens can hold it', 'Banks must approve your wallet'] },
            { q: 'What is censorship resistance?', a: 'No authority can block or reverse a valid Bitcoin transaction', wrong: ['Bitcoin is banned in most countries', 'Transactions require bank approval', 'Only miners can approve payments'] },
            { q: 'What does "trustless" mean in Bitcoin?', a: 'The system works without needing to trust any third party — math enforces the rules', wrong: ['Bitcoin has no security', 'You must trust the exchange to hold your funds', 'Transactions are unverified'] },
            { q: 'How does sending $1M in Bitcoin compare to sending $1?', a: "They work identically — amount doesn't change fees or time", wrong: ['Larger amounts require bank approval', '$1M transactions take 3 days to confirm', 'Large transfers require ID verification'] }
        ],
        digDeeper: ['one-stop-shop', 'whitepaper', 'money', 'misconceptions-fud']
    },
    {
        slug: 'mining',
        emoji: '⛏️',
        title: 'Mining & Proof of Work',
        color: '#f59e0b',
        badgeId: 'lq_mining',
        badgeName: '⛏️ Hash Slinger',
        slides: [
            { headline: 'Mining is a Giant Lottery', body: 'Bitcoin miners are computers competing to solve a puzzle. The puzzle: find a number that makes a specific hash start with many zeros. The first to find it wins the block reward.' },
            { headline: "It's Not Math — It's Guessing", body: 'Miners don\'t "solve equations." They try billions of random numbers per second (nonces) until one works. It\'s pure brute force — a SHA-256 lottery at industrial scale.' },
            { headline: 'Work = Proof = Security', body: 'Once a miner wins and adds a block, changing that block would require redoing all the work after it. The chain gets more secure with every block. That\'s Proof of Work.' },
            { headline: 'Miners Earn Bitcoin for Securing the Network', body: 'Miners receive newly minted bitcoin (the block reward) + transaction fees. Every ~4 years the reward halves. By ~2140, all 21 million will be mined.' }
        ],
        questions: [
            { q: 'What does a Bitcoin miner actually do?', a: 'Tries billions of random numbers (nonces) until a valid hash is found', wrong: ['Solves complex equations', 'Validates payment card transactions', 'Mines physical gold'] },
            { q: 'What is SHA-256?', a: "The hashing algorithm that secures Bitcoin's proof of work", wrong: ["The name of Bitcoin's first block", 'A government encryption standard for banking', "Bitcoin's smart contract language"] },
            { q: 'What is a nonce?', a: 'A random number miners change to try to find a valid block hash', wrong: ['A type of Bitcoin transaction fee', 'The minimum mining difficulty', 'A node identifier'] },
            { q: 'What happens to the block reward every ~4 years?', a: 'It halves', wrong: ['It doubles', 'It stays the same', 'It is voted on by miners'] },
            { q: 'What is proof of work?', a: 'Evidence that computational energy was expended to produce a valid block', wrong: ['A legal document proving Bitcoin ownership', 'A government-issued mining license', 'A receipt from a pool'] },
            { q: 'Why is changing an old Bitcoin block nearly impossible?', a: "You'd have to redo all the proof of work for that block and every block after it", wrong: ['Old blocks are deleted after 10 years', 'The blockchain is stored on government servers', 'Satoshi hardcoded a lock after block 1000'] },
            { q: 'What is the Bitcoin difficulty adjustment?', a: 'A mechanism that increases or decreases mining difficulty every 2016 blocks to target 10-minute block times', wrong: ['A voting system for miners to set fees', 'A limit on how many miners can join the network', 'The process of halving the block reward'] },
            { q: 'What does a miner receive when they successfully mine a block?', a: 'The block reward (new bitcoin) plus transaction fees', wrong: ['A government subsidy', 'The private keys of all transactions in the block', 'Proof-of-work tokens redeemable for fiat'] }
        ],
        digDeeper: ['mining', 'difficulty-adjustment', 'energy', 'blockchain-timechain']
    },
    {
        slug: 'nodes',
        emoji: '🖥️',
        title: 'Nodes & Decentralization',
        color: '#3b82f6',
        badgeId: 'lq_nodes',
        badgeName: '🖥️ Node Runner',
        slides: [
            { headline: 'A Node is a Copy of All of Bitcoin', body: 'Every Bitcoin node holds the full history of every transaction ever made — all the way back to block 0. There are tens of thousands of them, worldwide.' },
            { headline: 'No Single Point of Failure', body: 'Bitcoin has no headquarters, no CEO, no server to shut down. Even if half the nodes went offline tomorrow, Bitcoin would keep running. That\'s decentralization.' },
            { headline: "Don't Trust — Verify", body: 'When you run your own node, you don\'t have to believe anyone. Your node checks every rule itself. No bank or exchange can lie to you about your balance.' },
            { headline: 'Nodes Enforce the Rules', body: 'Nodes reject any transaction or block that breaks Bitcoin\'s rules. Even miners must play by the rules nodes enforce. Users, not miners, are sovereign.' }
        ],
        questions: [
            { q: 'What is a Bitcoin full node?', a: 'A computer that downloads and verifies the entire Bitcoin blockchain', wrong: ['A mining rig that earns block rewards', 'A government-approved server that stores user data', 'A wallet app on your phone'] },
            { q: 'What is the main purpose of running your own node?', a: 'To independently verify transactions without trusting anyone else', wrong: ['To earn bitcoin by validating transactions', 'To vote on Bitcoin protocol upgrades', 'To speed up your Bitcoin transactions'] },
            { q: "What happens if a miner produces a block that breaks Bitcoin's rules?", a: 'Nodes reject the invalid block', wrong: ['The block is accepted but flagged', "Satoshi's Foundation overrides it", 'Other miners automatically fix it'] },
            { q: 'Why is decentralization important for Bitcoin?', a: 'It means there is no single point of failure or central authority that can be attacked or censored', wrong: ['It makes Bitcoin faster', 'It lowers transaction fees', 'It makes mining more profitable'] },
            { q: 'How many full nodes does Bitcoin have approximately?', a: 'Tens of thousands, distributed worldwide', wrong: ['Exactly 21', 'About 100 run by banks', '3 operated by Satoshi'] },
            { q: 'What does "don\'t trust, verify" mean in Bitcoin?', a: 'You should run your own node to independently confirm the rules are being followed', wrong: ["Trust your exchange but check your balance", 'Never trade Bitcoin peer-to-peer', 'Use a hardware wallet for every transaction'] },
            { q: 'Can Bitcoin be shut down by any government?', a: 'No — there is no central server to shut down; nodes run globally', wrong: ['Yes — the US could block all internet traffic', 'Yes — Satoshi still controls the protocol', 'No — but only because it\'s registered as a nonprofit'] },
            { q: 'What is the difference between a light wallet and a full node?', a: 'A light wallet trusts third-party servers; a full node verifies everything itself', wrong: ['Light wallets are more secure', 'Full nodes only work on desktop computers', 'Light wallets hold more bitcoin'] }
        ],
        digDeeper: ['nodes', 'decentralized', 'pow-vs-pos', 'secure']
    },
    {
        slug: 'self-custody',
        emoji: '🔑',
        title: 'Self-Custody & Your Keys',
        color: '#22c55e',
        badgeId: 'lq_self_custody',
        badgeName: '🔑 Sovereign Stacker',
        slides: [
            { headline: 'Not Your Keys, Not Your Coins', body: 'If someone else holds your Bitcoin, they hold your Bitcoin. Exchanges can freeze accounts, go bankrupt, or get hacked. Mt. Gox. Celsius. FTX. All gone.' },
            { headline: 'Your Private Key is Like a Master Password', body: 'Every Bitcoin wallet has a private key — a secret number that proves ownership. Anyone with your private key can spend your bitcoin. Guard it with your life.' },
            { headline: 'Your Seed Phrase is the Real Backup', body: 'Most modern wallets give you a 12 or 24-word seed phrase. This is the master key to everything. Write it down on paper (not a screenshot!). Store it offline.' },
            { headline: 'Hardware Wallets Keep Keys Offline', body: 'A hardware wallet stores your private key on a device that never touches the internet. Even if your computer gets hacked, your Bitcoin is safe.' },
            { headline: 'Self-Custody is Financial Sovereignty', body: 'When you hold your own keys, no government can seize your funds with a court order to your bank. No exchange can deny your withdrawal. You are the bank.' }
        ],
        questions: [
            { q: 'What does "not your keys, not your coins" mean?', a: 'If someone else holds your private keys, they control your bitcoin — not you', wrong: ['Physical coins must be stored in a safe', "You can't spend bitcoin unless you mined it", 'Keys must be printed on physical paper'] },
            { q: 'What is a seed phrase?', a: 'A set of 12–24 words that can restore a Bitcoin wallet', wrong: ['A password to log into an exchange', 'A Bitcoin address for receiving funds', 'A QR code printed on hardware wallets'] },
            { q: 'What is the safest way to store your seed phrase?', a: 'Written on paper or engraved in metal, stored offline', wrong: ['Screenshot saved to iCloud', 'Text message to yourself', 'PDF saved on your computer'] },
            { q: 'What is a hardware wallet?', a: 'A physical device that stores private keys offline, never exposing them to the internet', wrong: ['A special bank account for Bitcoin', 'An app that stores bitcoin on your phone', 'A USB drive with bitcoin files'] },
            { q: 'What was FTX?', a: 'A centralized exchange that collapsed in 2022, causing billions in customer losses', wrong: ['A Bitcoin hardware wallet manufacturer', 'A layer-2 Lightning payment protocol', 'A Bitcoin mining pool'] },
            { q: 'What is a private key?', a: 'A secret number that proves ownership and authorizes Bitcoin transactions', wrong: ['Your username on an exchange', 'The password to your email', 'The recovery code for your phone'] },
            { q: 'What is the advantage of multi-signature (multisig) wallets?', a: 'Multiple keys must sign to authorize a transaction, reducing single-point-of-failure risk', wrong: ['They double the amount of bitcoin you can store', 'They are faster than regular wallets', 'Multisig wallets earn interest'] },
            { q: 'Why should you never share your seed phrase?', a: 'Anyone with your seed phrase can steal all your bitcoin instantly', wrong: ['Sharing it helps with tax reporting', 'Exchanges need it for verification', 'It helps with key recovery if you forget your pin'] }
        ],
        digDeeper: ['self-custody', 'cryptography', 'hardware', 'public_key_vs_private_key']
    },
    {
        slug: 'lightning',
        emoji: '⚡',
        title: 'The Lightning Network',
        color: '#eab308',
        badgeId: 'lq_lightning',
        badgeName: '⚡ Lightning Pleb',
        slides: [
            { headline: "Bitcoin's Base Layer is Slow on Purpose", body: 'Bitcoin on-chain settles every ~10 minutes with limited block space. This is intentional — it maximizes security and decentralization. But for everyday payments, we need faster.' },
            { headline: 'Lightning Opens Payment Channels', body: 'Two parties lock bitcoin into a shared channel. They can then send payments back and forth instantly, thousands of times, with near-zero fees — without touching the blockchain.' },
            { headline: 'Payments Route Through the Network', body: "You don't need a direct channel with everyone. Payments route through a network of channels, like hops on a flight, until they reach the destination. All in milliseconds." },
            { headline: 'It Enables Real Bitcoin Payments', body: 'Buy coffee, pay a content creator, send to family overseas — Lightning makes micro-payments viable. This archive itself uses Lightning for tipping and earning sats.' }
        ],
        questions: [
            { q: 'What is a payment channel in Lightning?', a: 'A locked bitcoin balance between two parties that enables instant off-chain payments', wrong: ['A social media channel for Bitcoin payments', 'A government-approved payment gateway', 'A type of hardware wallet connection'] },
            { q: 'Why is Lightning faster than on-chain Bitcoin?', a: 'Payments route off-chain between channels without waiting for block confirmations', wrong: ['Lightning uses a faster blockchain', "Lightning bypasses Bitcoin's security", 'It uses credit cards'] },
            { q: 'What does it mean for a Lightning payment to "route"?', a: 'A payment hops through multiple channels to reach the destination without a direct connection', wrong: ['The payment waits in a queue', 'A miner approves each hop', 'Payments route through bank servers'] },
            { q: 'What is a Lightning invoice?', a: 'A payment request with amount and destination encoded in a string', wrong: ['A tax document for Lightning transactions', 'A government license for node operators', 'A receipt from a banking partner'] },
            { q: 'What is the key advantage of Lightning for micropayments?', a: 'Near-zero fees and instant settlement make tiny payments economically viable', wrong: ['Lightning creates new bitcoin', 'There are no fees at all', 'Government subsidies cover the fees'] },
            { q: 'What must happen before using a Lightning channel?', a: 'An on-chain Bitcoin transaction to fund and open the channel', wrong: ['Registering with an exchange', 'Purchasing a Lightning license', 'Installing special hardware'] },
            { q: 'What is a Lightning node?', a: 'Software that opens channels, routes payments, and earns fees for providing liquidity', wrong: ['A mining rig that earns block rewards', 'A government-approved payment processor', 'A bookmark in a Bitcoin app'] },
            { q: 'Can Lightning payments be censored by a bank?', a: 'No — Lightning is peer-to-peer and censorship-resistant like Bitcoin itself', wrong: ['Banks can block Lightning wallets', 'The Federal Reserve monitors all Lightning payments', 'Only large payments can be blocked'] }
        ],
        digDeeper: ['layer-2-lightning', 'fedi-ark', 'lightning_node', 'use-cases']
    },
    {
        slug: 'scarcity',
        emoji: '💎',
        title: "Bitcoin's Fixed Supply",
        color: '#a855f7',
        badgeId: 'lq_scarcity',
        badgeName: '💎 21M Believer',
        slides: [
            { headline: '21 Million. Hard Cap. Forever.', body: "Bitcoin's code limits its total supply to exactly 21,000,000 BTC. This isn't a promise — it's a rule enforced by every node on the network. Nobody can override it." },
            { headline: 'New Bitcoin is Created by Miners', body: 'When miners add a block to the chain, they receive newly minted bitcoin. This started at 50 BTC per block in 2009 and halves every ~210,000 blocks (~4 years).' },
            { headline: 'Each Halving Reduces Inflation', body: 'After the 2024 halving, the reward dropped to 3.125 BTC per block. By ~2140, new bitcoin creation stops entirely. Only transaction fees will reward miners then.' },
            { headline: 'Scarcity Drives Value', body: 'Every dollar printed dilutes your savings. Bitcoin does the opposite: as adoption grows and supply stays fixed, each bitcoin becomes harder to acquire. It\'s why Bitcoiners HODL.' }
        ],
        questions: [
            { q: 'How many bitcoin will ever exist?', a: '21 million', wrong: ['100 million', 'An unlimited supply', '1 trillion satoshis'] },
            { q: 'What is a Bitcoin halving?', a: 'A scheduled event every ~4 years that cuts the block reward in half', wrong: ['A penalty for miners who produce invalid blocks', 'A protocol vote to reduce fees', 'A government tax on mining'] },
            { q: 'When does new Bitcoin creation stop entirely?', a: 'Around the year 2140', wrong: ['2030', '2050', 'Never — it slows but never stops'] },
            { q: "How does Bitcoin's supply model compare to fiat currency?", a: 'Bitcoin has a fixed, predictable supply; fiat can be printed in unlimited quantities', wrong: ['Both are unlimited', 'Fiat is scarcer than Bitcoin', 'They follow the same model'] },
            { q: 'How much was the block reward after the April 2024 halving?', a: '3.125 BTC', wrong: ['6.25 BTC', '1 BTC', '50 BTC'] },
            { q: 'What is the relationship between scarcity and value?', a: 'Scarcity combined with demand drives value — the less there is of something useful, the more it tends to be worth', wrong: ['Scarcity makes things cheaper', "Bitcoin's value is set by governments", 'Scarcity only matters for physical goods'] },
            { q: "What backs Bitcoin's value?", a: 'Scarcity, security, energy expenditure, and growing adoption', wrong: ['Gold reserves held by Satoshi', 'A government guarantee', 'The US dollar'] },
            { q: 'What is a satoshi?', a: 'The smallest unit of Bitcoin — 0.00000001 BTC', wrong: ["Bitcoin's founder's full name", 'A type of block reward', '1,000 bitcoin'] }
        ],
        digDeeper: ['scarce', 'money', 'investment-strategy', 'problems-of-money']
    },
    {
        slug: 'bitcoin-only',
        emoji: '🛡️',
        title: 'Why Bitcoin, Not Crypto',
        color: '#ef4444',
        badgeId: 'lq_bitcoin_only',
        badgeName: '🛡️ Bitcoin Maximalist',
        slides: [
            { headline: 'Most Crypto is Not Like Bitcoin', body: 'Most altcoins have founders who can change the rules, premines that enrich insiders, and no real decentralization. They are centralized projects wearing a blockchain costume.' },
            { headline: "Bitcoin's Properties Are Unique", body: 'Bitcoin was launched fairly (no premine, no CEO, anonymous founder who disappeared). Every other coin was created after Bitcoin proved the concept — and none has replicated its properties.' },
            { headline: 'Altcoins Are Solutions Looking for Problems', body: 'Bitcoin solves the hardest problem in computer science (trustless, decentralized digital money). Altcoins typically solve problems that don\'t require blockchains at all — or problems Bitcoin already solves.' }
        ],
        questions: [
            { q: 'What is a premine?', a: 'When founders create and hold a large portion of a cryptocurrency before public launch', wrong: ['The process of mining Bitcoin before blocks', 'A type of hardware wallet', 'A cold storage technique'] },
            { q: 'Did Bitcoin have a premine?', a: 'No — Bitcoin was launched fairly with no allocation to founders', wrong: ['Yes — Satoshi owns 50%', 'Yes — banks premined the first 1000 blocks', 'Yes — the US government premined it'] },
            { q: 'What is the main argument for Bitcoin being the only valid cryptocurrency?', a: 'Bitcoin solved the hardest problem (trustless digital money) with unique properties no other coin replicates', wrong: ['Bitcoin has the best marketing team', 'Governments will ban all other coins', 'Bitcoin is the oldest and therefore safest'] },
            { q: 'What did Ethereum do in 2022 that critics say undermined its decentralization?', a: 'Switched from Proof of Work to Proof of Stake, concentrating power with large coin holders', wrong: ['Hired a CEO to manage the protocol', 'Was acquired by a bank', 'Removed all transaction fees'] },
            { q: 'What is an ICO?', a: 'Initial Coin Offering — a fundraising event where founders sell new tokens, often to retail investors', wrong: ['An international currency order', 'A mining certification', 'A Bitcoin exchange type'] },
            { q: 'Why do Bitcoin maximalists argue altcoins are unnecessary?', a: 'Most use cases claimed by altcoins are either not real problems or are already solved by Bitcoin/Lightning', wrong: ['Altcoins are illegal in most countries', "Bitcoin's code prevents any other currency", 'Altcoins are all government created'] },
            { q: 'What is the primary critique of Proof of Stake consensus?', a: 'It favors the already-wealthy (more coins = more power), creating plutocratic control', wrong: ['It uses too much energy', 'It is slower than Proof of Work', 'It requires physical mining hardware'] },
            { q: "What makes Bitcoin's origin story unique?", a: 'The anonymous founder disappeared after launch, removing any central authority or figurehead to attack', wrong: ['It was created by a bank', 'Satoshi still controls the protocol', 'It was backed by venture capital'] }
        ],
        digDeeper: ['evidence-against-alts', 'maximalism', 'pow-vs-pos', 'dominant']
    },
    {
        slug: 'privacy',
        emoji: '🕵️',
        title: 'Privacy & Sovereignty',
        color: '#14b8a6',
        badgeId: 'lq_privacy',
        badgeName: '🕵️ Cypherpunk',
        slides: [
            { headline: 'Bitcoin Is Pseudonymous, Not Anonymous', body: "Bitcoin addresses don't show names — but all transactions are public on the blockchain. Chain analysis firms can trace transactions. Privacy requires deliberate effort." },
            { headline: 'Financial Privacy is a Human Right', body: 'When governments or corporations can see all your transactions, they have leverage over your choices. Bitcoin gives you tools to protect your financial privacy without breaking laws.' },
            { headline: 'Sovereign Tools Exist', body: 'Coin control, CoinJoin, running your own node, using Lightning, using non-KYC exchanges — these are tools Bitcoiners use to preserve privacy and resist surveillance.' },
            { headline: 'Bitcoin Enables Exit from Broken Systems', body: 'In countries with hyperinflation, capital controls, or authoritarian regimes, Bitcoin is a lifeline. Privacy and censorship resistance aren\'t nice-to-haves — they\'re survival tools.' }
        ],
        questions: [
            { q: 'Is Bitcoin anonymous?', a: 'No — Bitcoin is pseudonymous; all transactions are public on the blockchain', wrong: ['Yes — completely untraceable', 'Yes — the government confirmed this', 'Only if you use a VPN'] },
            { q: 'What is chain analysis?', a: 'The process of tracing Bitcoin transactions on the public blockchain to identify users', wrong: ['A way to mine faster', 'A technique to create new addresses', 'A type of Bitcoin audit by Satoshi'] },
            { q: 'What is CoinJoin?', a: 'A privacy technique where multiple users combine transactions to obscure the sender/receiver trail', wrong: ['A way to merge multiple Bitcoin wallets into one', 'A Lightning Network routing protocol', 'A type of hardware wallet'] },
            { q: 'What is KYC?', a: "Know Your Customer — identity verification required by regulated exchanges", wrong: ['Keep Your Coins — a self-custody rule', 'A Bitcoin address format', 'A type of Bitcoin node'] },
            { q: 'Why might someone prefer to buy Bitcoin without KYC?', a: 'To preserve financial privacy and avoid linking personal identity to their Bitcoin stack', wrong: ['KYC exchanges charge higher fees', 'Non-KYC bitcoin is worth more', 'Government law requires non-KYC purchases'] },
            { q: 'What does UTXO stand for?', a: 'Unspent Transaction Output — the fundamental unit of Bitcoin transactions', wrong: ['Universal Token Exchange Operations', 'User Tracking eXchange Output', 'Unlimited Transaction eXchange Order'] },
            { q: 'How does running your own node improve privacy?', a: "Your wallet doesn't broadcast addresses to a third-party server; your node queries the blockchain directly", wrong: ['Your node earns fees that offset chain analysis costs', 'Full nodes are invisible to the internet', 'Running a node automatically enables CoinJoin'] },
            { q: "In what context is Bitcoin's censorship resistance most critical?", a: "In countries with capital controls, hyperinflation, or authoritarian regimes where financial access is weaponized", wrong: ['Only for large corporations', 'In countries where Bitcoin is legal tender', 'Only in countries without banks'] }
        ],
        digDeeper: ['privacy-nonkyc', 'coin_mixing_coinjoin_coin_control_utxo', 'peaceful', 'human_rights__social_justice_and_freedo']
    }
];

var ALL_SLUGS = LQ_TOPICS.map(function(t) { return t.slug; });

// --- Quiz state ---
var _lqQuizState = null;

// --- Utility ---
function _lqShuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
}

function _lqCloseAll() {
    ['lqHub','lqLesson','lqQuiz','lqDigDeeper','lqGraduate'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.remove();
    });
    // If page is blank behind the overlay, restore home
    if (typeof goHome === 'function' && document.getElementById('home') && document.getElementById('home').classList.contains('hidden')) {
        goHome();
    }
}

// --- Main Hub ---
window.renderLearningQuestHub = function() {
    var existing = document.getElementById('lqHub');
    if (existing) return; // already open — don't toggle closed

    var progress = lqGetProgress();
    var passedCount = ALL_SLUGS.filter(function(s) { return progress[s] && progress[s].passed; }).length;

    var cardsHtml = LQ_TOPICS.map(function(topic) {
        var t = lqGetTopic(topic.slug);
        var statusHtml;
        if (t.passed) {
            statusHtml = '<span style="background:rgba(34,197,94,0.18);color:#22c55e;border-radius:20px;padding:3px 10px;font-size:0.75rem;font-weight:700;">✅ Passed</span>';
        } else if (t.attempts > 0) {
            statusHtml = '<span style="background:rgba(234,179,8,0.18);color:#eab308;border-radius:20px;padding:3px 10px;font-size:0.75rem;font-weight:700;">🟡 ' + t.bestScore + '/5 — Retry</span>';
        } else {
            statusHtml = '<span style="background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);border-radius:20px;padding:3px 10px;font-size:0.75rem;font-weight:700;">⬜ Start →</span>';
        }
        return '<div class="lq-card" onclick="_lqOpenTopic(\'' + topic.slug + '\')" style="background:' + topic.color + '14;border:1.5px solid ' + topic.color + '55;display:flex;flex-direction:column;gap:8px;">' +
            '<div style="font-size:1.8rem;">' + topic.emoji + '</div>' +
            '<div style="font-weight:800;font-size:0.9rem;color:var(--text,#fff);line-height:1.3;">' + topic.title + '</div>' +
            statusHtml +
            '</div>';
    }).join('');

    var hub = document.createElement('div');
    hub.id = 'lqHub';
    hub.className = 'lq-overlay';
    hub.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,0.97);overflow-y:auto;-webkit-overflow-scrolling:touch;animation:lqFadeIn 0.3s ease;';
    hub.innerHTML = '<div style="max-width:540px;margin:0 auto;padding:56px 16px 40px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
        '<div><div style="font-size:1.4rem;font-weight:900;color:var(--text,#fff);">📖 Learning Quests</div>' +
        '<div style="font-size:0.85rem;color:rgba(255,255,255,0.5);margin-top:2px;">' + passedCount + '/8 completed</div></div>' +
        '<button onclick="document.getElementById(\'lqHub\').remove();if(typeof goHome===\'function\'&&document.getElementById(\'home\')&&document.getElementById(\'home\').classList.contains(\'hidden\'))goHome();" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.6);border-radius:10px;padding:8px 14px;cursor:pointer;font-family:inherit;font-weight:700;">✕</button>' +
        '</div>' +
        '<div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;margin-bottom:20px;overflow:hidden;">' +
        '<div style="height:100%;width:' + Math.round(passedCount/8*100) + '%;background:#22c55e;border-radius:3px;transition:width 0.5s ease;"></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">' + cardsHtml + '</div>' +
        '<div style="text-align:center;font-size:0.8rem;color:rgba(255,255,255,0.4);padding:12px;background:rgba(255,255,255,0.04);border-radius:12px;">' +
        '🎓 Complete all 8 to earn the 📖 Learning Quest Graduate badge' +
        '</div>' +
        '</div>';
    document.body.appendChild(hub);
};

// --- Lesson Slideshow ---
window._lqOpenTopic = function(slug) {
    var topic = LQ_TOPICS.find(function(t) { return t.slug === slug; });
    if (!topic) return;

    var currentSlide = 0;
    var totalSlides = topic.slides.length;

    function renderLesson(slideIdx, direction) {
        var existing = document.getElementById('lqLesson');
        if (existing) existing.remove();

        var slide = topic.slides[slideIdx];
        var isLast = slideIdx === totalSlides - 1;

        var dots = topic.slides.map(function(_, i) {
            return '<span class="lq-dot' + (i === slideIdx ? ' active' : '') + '"></span>';
        }).join('');

        var bottomBar;
        if (isLast) {
            bottomBar = '<div style="display:flex;flex-direction:column;gap:10px;align-items:center;">' +
                '<div style="font-size:0.8rem;color:rgba(255,255,255,0.4);">' + (slideIdx + 1) + ' / ' + totalSlides + '</div>' +
                '<button onclick="_lqStartQuiz(\'' + slug + '\')" style="background:' + topic.color + ';color:#fff;padding:14px 32px;border-radius:14px;font-weight:900;cursor:pointer;font-family:inherit;border:none;font-size:1rem;width:100%;max-width:320px;">Take the Quiz →</button>' +
                '<div style="display:flex;gap:12px;">' +
                (slideIdx > 0 ? '<button onclick="_lqNavSlide(\'' + slug + '\',' + (slideIdx - 1) + ',\'left\')" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.7);border-radius:10px;padding:10px 18px;cursor:pointer;font-family:inherit;font-weight:700;">← Back</button>' : '') +
                '</div>' +
                '</div>';
        } else {
            bottomBar = '<div style="display:flex;align-items:center;justify-content:space-between;">' +
                '<div>' +
                (slideIdx > 0 ? '<button onclick="_lqNavSlide(\'' + slug + '\',' + (slideIdx - 1) + ',\'left\')" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.7);border-radius:10px;padding:10px 18px;cursor:pointer;font-family:inherit;font-weight:700;">←</button>' : '<span></span>') +
                '</div>' +
                '<div style="font-size:0.8rem;color:rgba(255,255,255,0.4);">' + (slideIdx + 1) + ' / ' + totalSlides + '</div>' +
                '<button onclick="_lqNavSlide(\'' + slug + '\',' + (slideIdx + 1) + ',\'right\')" style="background:' + topic.color + ';color:#fff;border-radius:10px;padding:10px 22px;cursor:pointer;font-family:inherit;font-weight:800;border:none;">→</button>' +
                '</div>';
        }

        var animStyle = direction === 'left' ? 'animation:lqSlideInLeft 0.25s ease' : (direction === 'right' ? 'animation:lqSlideInRight 0.25s ease' : 'animation:lqFadeIn 0.3s ease');

        var overlay = document.createElement('div');
        overlay.id = 'lqLesson';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9510;background:rgba(0,0,0,0.98);overflow-y:auto;-webkit-overflow-scrolling:touch;';
        overlay.innerHTML = '<div style="max-width:540px;margin:0 auto;padding:56px 16px 40px;min-height:100vh;display:flex;flex-direction:column;">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
            '<div style="font-size:0.9rem;color:' + topic.color + ';font-weight:700;">' + topic.emoji + ' ' + topic.title + '</div>' +
            '<button onclick="document.getElementById(\'lqLesson\').remove()" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.6);border-radius:10px;padding:6px 12px;cursor:pointer;font-family:inherit;font-weight:700;font-size:0.85rem;">✕</button>' +
            '</div>' +
            '<div style="text-align:center;margin-bottom:16px;">' + dots + '</div>' +
            '<div style="' + animStyle + ';flex:1;">' +
            '<h2 style="font-size:1.45rem;font-weight:900;color:var(--text,#fff);margin:0 0 10px;line-height:1.3;">' + slide.headline + '</h2>' +
            '<p style="font-size:1.0rem;color:rgba(255,255,255,0.85);line-height:1.65;margin:0 0 16px;">' + slide.body + '</p>' +
            ((_LQ_SLIDE_EXTRAS[slug] && _LQ_SLIDE_EXTRAS[slug][slideIdx] && _LQ_SLIDE_EXTRAS[slug][slideIdx].stat) ? '<div style="background:rgba(249,115,22,0.1);border-left:3px solid ' + topic.color + ';border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:16px;font-size:0.88rem;font-weight:700;color:rgba(255,255,255,0.95);line-height:1.5;">' + _LQ_SLIDE_EXTRAS[slug][slideIdx].stat + '</div>' : '') +
            _lqGetIllustration(slug, slideIdx) +
            ((_LQ_SLIDE_EXTRAS[slug] && _LQ_SLIDE_EXTRAS[slug][slideIdx] && _LQ_SLIDE_EXTRAS[slug][slideIdx].analogy) ? '<div style="margin-top:14px;padding:10px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:10px;font-size:0.86rem;color:rgba(255,255,255,0.65);line-height:1.5;font-style:italic;">' + _LQ_SLIDE_EXTRAS[slug][slideIdx].analogy + '</div>' : '') +
            '</div>' +
            '<div style="margin-top:16px;">' + bottomBar + '</div>' +
            '</div>';

        // Touch swipe support
        var _touchStartX = 0;
        overlay.addEventListener('touchstart', function(e) { _touchStartX = e.touches[0].clientX; }, { passive: true });
        overlay.addEventListener('touchend', function(e) {
            var delta = _touchStartX - e.changedTouches[0].clientX;
            if (Math.abs(delta) > 40) {
                if (delta > 0 && slideIdx < totalSlides - 1) { window._lqNavSlide(slug, slideIdx + 1, 'right'); }
                else if (delta < 0 && slideIdx > 0) { window._lqNavSlide(slug, slideIdx - 1, 'left'); }
            }
        }, { passive: true });

        document.body.appendChild(overlay);
        _lqPlaySlide();
    }

    window._lqNavSlide = function(s, idx, dir) {
        if (s !== slug) return;
        currentSlide = idx;
        renderLesson(idx, dir);
    };

    // Award lesson completion
    // Check after last slide when quiz button is shown
    // We hook this when user clicks "Take the Quiz"
    var origStart = window._lqStartQuiz;
    renderLesson(0, 'fade');

    // Patch _lqStartQuiz to handle lessonSeen award
    window._lqStartQuiz = function(s) {
        if (s === slug) {
            var t = lqGetTopic(slug);
            if (!t.lessonSeen) {
                lqSaveTopic(slug, { lessonSeen: true });
                if (typeof awardPoints === 'function') awardPoints(50, '📖 Learning Quest: ' + topic.title + ' lesson', null, null, null, null, { actionKey: 'lq_lesson' });
            }
        }
        _lqDoStartQuiz(s);
    };
};

// --- Quiz ---
window._lqDoStartQuiz = function _lqDoStartQuiz(slug) {
    var topic = LQ_TOPICS.find(function(t) { return t.slug === slug; });
    if (!topic) return;

    var existing = document.getElementById('lqLesson');
    if (existing) existing.remove();

    var questions = _lqShuffle(topic.questions).slice(0, 5);
    _lqQuizState = { slug: slug, topic: topic, questions: questions, qIdx: 0, score: 0, answered: false };

    _lqShowQuestion();
};

window._lqStartQuiz = function(slug) {
    var topic = LQ_TOPICS.find(function(t) { return t.slug === slug; });
    if (!topic) return;
    var t = lqGetTopic(slug);
    if (!t.lessonSeen) {
        lqSaveTopic(slug, { lessonSeen: true });
        if (typeof awardPoints === 'function') awardPoints(50, '📖 Learning Quest: ' + topic.title + ' lesson', null, null, null, null, { actionKey: 'lq_lesson' });
    }
    _lqDoStartQuiz(slug);
};

function _lqShowQuestion() {
    var state = _lqQuizState;
    if (!state) return;

    var existing = document.getElementById('lqQuiz');
    if (existing) existing.remove();

    var q = state.questions[state.qIdx];
    var answers = _lqShuffle([q.a].concat(q.wrong));

    var overlay = document.createElement('div');
    overlay.id = 'lqQuiz';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9520;background:rgba(0,0,0,0.98);overflow-y:auto;-webkit-overflow-scrolling:touch;animation:lqFadeIn 0.25s ease;';
    overlay.innerHTML = '<div style="max-width:540px;margin:0 auto;padding:56px 16px 40px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">' +
        '<div style="font-size:0.85rem;color:' + state.topic.color + ';font-weight:700;">' + state.topic.emoji + ' ' + state.topic.title + '</div>' +
        '<div style="font-size:0.85rem;color:rgba(255,255,255,0.5);">Question ' + (state.qIdx + 1) + ' of 5</div>' +
        '</div>' +
        '<div style="background:rgba(255,255,255,0.05);border-radius:16px;padding:20px;margin-bottom:20px;">' +
        '<p style="font-size:1.1rem;font-weight:800;color:var(--text,#fff);margin:0;line-height:1.4;">' + q.q + '</p>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:10px;" id="lqAnswers">' +
        answers.map(function(ans, i) {
            return '<button class="lq-ans-btn" id="lqAns' + i + '" onclick="_lqSelectAnswer(\'' + slug_escape(ans) + '\',\'' + slug_escape(q.a) + '\',' + i + ')">' + ans + '</button>';
        }).join('') +
        '</div>' +
        '<div id="lqFeedback" style="margin-top:16px;min-height:40px;"></div>' +
        '</div>';

    document.body.appendChild(overlay);
}

function slug_escape(s) {
    return s.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
}

window._lqSelectAnswer = function(chosen, correct, btnIdx) {
    var state = _lqQuizState;
    if (!state || state.answered) return;
    state.answered = true;

    var buttons = document.querySelectorAll('.lq-ans-btn');
    buttons.forEach(function(btn, i) {
        btn.disabled = true;
        if (btn.textContent === correct) { btn.classList.add('lq-correct'); }
    });

    var isCorrect = (chosen === correct);
    if (isCorrect) {
        state.score++;
        _lqPlayCorrect();
    } else {
        var chosenBtn = document.getElementById('lqAns' + btnIdx);
        if (chosenBtn) chosenBtn.classList.add('lq-wrong');
        _lqPlayWrong();
    }

    var feedback = document.getElementById('lqFeedback');
    if (feedback) {
        var feedbackColor = isCorrect ? '#22c55e' : '#ef4444';
        var feedbackBg = isCorrect ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.10)';
        var feedbackMsg = isCorrect ? '✅ Correct!' : '❌ The answer was: ' + correct;
        feedback.innerHTML = '<div style="padding:10px 14px;border-radius:10px;font-size:0.88rem;font-weight:700;background:' + feedbackBg + ';color:' + feedbackColor + ';margin-bottom:10px;">' + feedbackMsg + '</div>' +
            '<button onclick="window._lqAdvance()" style="width:100%;padding:12px;border-radius:10px;border:none;background:' + (isCorrect ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.1)') + ';color:#fff;font-size:0.92rem;font-weight:800;cursor:pointer;font-family:inherit;">Continue →</button>';
    }

    window._lqAdvance = function() {
        window._lqAdvance = null;
        state.qIdx++;
        state.answered = false;
        if (state.qIdx < 5) {
            _lqShowQuestion();
        } else {
            _lqShowScore();
        }
    };
};

function _lqShowScore() {
    var state = _lqQuizState;
    if (!state) return;

    var existing = document.getElementById('lqQuiz');
    if (existing) existing.remove();

    var score = state.score;
    var passed = score >= 4;
    var topic = state.topic;
    var slug = topic.slug;
    var t = lqGetTopic(slug);

    var newAttempts = t.attempts + 1;
    var newBest = Math.max(t.bestScore || 0, score);
    lqSaveTopic(slug, { attempts: newAttempts, bestScore: newBest });

    var isFirstPass = passed && !t.passed;
    if (isFirstPass) {
        lqSaveTopic(slug, { passed: true, passedAt: Date.now() });
        if (typeof awardPoints === 'function') awardPoints(100, '📖 Learning Quest: ' + topic.title + ' quiz', null, null, null, null, { actionKey: 'lq_quiz' });
        if (typeof awardHiddenBadge === 'function') awardHiddenBadge(topic.badgeId, topic.badgeName);
    }

    if (passed) {
        _lqPlayPass();
        if (typeof launchConfetti === 'function') launchConfetti();
    } else {
        _lqPlayFail();
    }

    var overlay = document.createElement('div');
    overlay.id = 'lqQuiz';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9520;background:rgba(0,0,0,0.98);overflow-y:auto;-webkit-overflow-scrolling:touch;animation:lqFadeIn 0.3s ease;';

    var scoreColor = passed ? '#22c55e' : '#ef4444';
    var scoreBanner = passed
        ? '<div style="background:rgba(34,197,94,0.15);border:1.5px solid #22c55e;border-radius:14px;padding:16px;text-align:center;margin-bottom:20px;animation:lqPulse 2s ease-in-out infinite;">' +
          '<div style="font-size:1.5rem;margin-bottom:4px;">🎉</div>' +
          '<div style="font-size:1.1rem;font-weight:900;color:#22c55e;">You Passed!</div>' +
          (isFirstPass ? '<div style="font-size:0.8rem;color:rgba(34,197,94,0.7);margin-top:4px;">+100 XP · Badge earned!</div>' : '') +
          '</div>'
        : '<div style="background:rgba(239,68,68,0.10);border:1.5px solid #ef4444;border-radius:14px;padding:16px;text-align:center;margin-bottom:20px;">' +
          '<div style="font-size:0.95rem;font-weight:700;color:#ef4444;">' + score + '/5 — Almost! Need 4 to pass</div>' +
          '</div>';

    overlay.innerHTML = '<div style="max-width:540px;margin:0 auto;padding:56px 16px 40px;">' +
        '<div style="text-align:center;margin-bottom:20px;">' +
        '<div style="font-size:0.9rem;color:' + topic.color + ';font-weight:700;margin-bottom:12px;">' + topic.emoji + ' ' + topic.title + '</div>' +
        '<div style="font-size:4rem;font-weight:900;color:' + scoreColor + ';animation:lqBounce 0.5s ease;">' + score + '/5</div>' +
        '</div>' +
        scoreBanner +
        '<div style="display:flex;flex-direction:column;gap:10px;">' +
        '<button onclick="_lqDoStartQuiz(\'' + slug + '\')" class="lq-btn" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);color:var(--text,#fff);width:100%;">🔄 Retake Quiz</button>' +
        '<button onclick="document.getElementById(\'lqQuiz\').remove();window.renderLearningQuestHub&&renderLearningQuestHub();" class="lq-btn" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.6);width:100%;">← Back to Topics</button>' +
        (passed ? '<button onclick="_lqShowDigDeeper(\'' + slug + '\')" class="lq-btn" style="background:' + topic.color + ';color:#fff;width:100%;">Dig Deeper →</button>' : '') +
        '</div>' +
        '</div>';

    document.body.appendChild(overlay);

    // Check graduate
    if (isFirstPass) {
        var allPassed = ALL_SLUGS.every(function(s) { return lqGetTopic(s).passed; });
        if (allPassed && localStorage.getItem(LQ_GRADUATE_KEY) !== '1') {
            setTimeout(_lqShowGraduate, 1200);
        }
    }
}

// --- Graduate Overlay ---
function _lqShowGraduate() {
    var existing = document.getElementById('lqGraduate');
    if (existing) return;

    localStorage.setItem(LQ_GRADUATE_KEY, '1');
    if (typeof awardPoints === 'function') awardPoints(250, '📖 Learning Quest Graduate', null, null, null, null, { actionKey: 'lq_graduate' });
    if (typeof awardOrangeTickets === 'function') awardOrangeTickets(10, '📖 Graduate');
    if (typeof awardHiddenBadge === 'function') awardHiddenBadge('lq_graduate', '📖 Learning Quest Graduate');
    _lqPlayPass();
    setTimeout(_lqPlayPass, 300);
    if (typeof launchConfetti === 'function') launchConfetti();

    var overlay = document.createElement('div');
    overlay.id = 'lqGraduate';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9600;background:rgba(0,0,0,0.97);display:flex;align-items:center;justify-content:center;animation:lqFadeIn 0.4s ease;';
    overlay.innerHTML = '<div style="max-width:400px;padding:32px 24px;text-align:center;">' +
        '<div style="font-size:4rem;margin-bottom:16px;animation:lqBounce 0.6s ease;">🎓</div>' +
        '<h2 style="font-size:1.6rem;font-weight:900;color:#fff;margin:0 0 10px;">Learning Quest Graduate!</h2>' +
        '<p style="color:rgba(255,255,255,0.65);font-size:0.95rem;margin:0 0 20px;">You\'ve mastered all 8 Bitcoin topics!</p>' +
        '<div style="background:rgba(249,115,22,0.12);border:1.5px solid rgba(249,115,22,0.4);border-radius:14px;padding:16px;margin-bottom:24px;">' +
        '<div style="font-size:1.1rem;font-weight:900;color:#f97316;">+1,450 XP · 10 tickets · 9 badges</div>' +
        '</div>' +
        '<button onclick="document.getElementById(\'lqGraduate\').remove();_lqCloseAll();if(typeof toggleMenu===\'function\')toggleMenu();" style="background:#f97316;color:#fff;padding:16px 32px;border-radius:14px;font-weight:900;cursor:pointer;font-family:inherit;border:none;font-size:1rem;width:100%;">📚 Explore the Full Archive →</button>' +
        '</div>';

    document.body.appendChild(overlay);
}

// --- Dig Deeper ---
window._lqShowDigDeeper = function(slug) {
    var topic = LQ_TOPICS.find(function(t) { return t.slug === slug; });
    if (!topic) return;

    var existing = document.getElementById('lqDigDeeper');
    if (existing) existing.remove();

    var closeAllScript = "document.getElementById('lqDigDeeper')&&document.getElementById('lqDigDeeper').remove();document.getElementById('lqQuiz')&&document.getElementById('lqQuiz').remove();document.getElementById('lqLesson')&&document.getElementById('lqLesson').remove();document.getElementById('lqHub')&&document.getElementById('lqHub').remove();";

    var linksHtml = topic.digDeeper.map(function(ch) {
        return '<button onclick="' + closeAllScript + 'go(\'' + ch + '\')" style="padding:12px 16px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:var(--text,#fff);border-radius:12px;cursor:pointer;font-family:inherit;font-weight:700;font-size:0.85rem;text-align:left;width:100%;">' +
            '📚 ' + ch.replace(/-/g,' ').replace(/_/g,' ') +
            '</button>';
    }).join('');

    var overlay = document.createElement('div');
    overlay.id = 'lqDigDeeper';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9530;background:rgba(0,0,0,0.98);overflow-y:auto;-webkit-overflow-scrolling:touch;animation:lqFadeIn 0.3s ease;';
    overlay.innerHTML = '<div style="max-width:540px;margin:0 auto;padding:56px 16px 40px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">' +
        '<div style="font-size:1rem;font-weight:800;color:var(--text,#fff);">📖 Dig Deeper</div>' +
        '<button onclick="document.getElementById(\'lqDigDeeper\').remove()" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.6);border-radius:10px;padding:6px 12px;cursor:pointer;font-family:inherit;font-weight:700;font-size:0.85rem;">✕</button>' +
        '</div>' +
        '<p style="color:rgba(255,255,255,0.55);font-size:0.9rem;margin-bottom:16px;">Want to go deeper? Explore these archive channels:</p>' +
        '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">' + linksHtml + '</div>' +
        '<button onclick="document.getElementById(\'lqDigDeeper\').remove();document.getElementById(\'lqQuiz\')&&document.getElementById(\'lqQuiz\').remove();window.renderLearningQuestHub&&renderLearningQuestHub();" style="padding:12px 16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);border-radius:12px;cursor:pointer;font-family:inherit;font-weight:700;font-size:0.85rem;width:100%;">← Back to Learning Quests</button>' +
        '</div>';

    document.body.appendChild(overlay);
};

// --- Firestore login restore ---
if (typeof auth !== 'undefined' && auth) {
    auth.onAuthStateChanged(function(user) {
        if (user && !user.isAnonymous) {
            db.collection('users').doc(user.uid).get().then(function(doc) {
                if (doc.exists && doc.data().lqProgress) {
                    var remote = doc.data().lqProgress;
                    var local = lqGetProgress();
                    var merged = {};
                    ALL_SLUGS.forEach(function(s) {
                        var r = remote[s] || {}; var l = local[s] || {};
                        merged[s] = {
                            passed: !!(r.passed || l.passed),
                            lessonSeen: !!(r.lessonSeen || l.lessonSeen),
                            attempts: Math.max(r.attempts||0, l.attempts||0),
                            bestScore: Math.max(r.bestScore||0, l.bestScore||0),
                            passedAt: r.passedAt || l.passedAt || null
                        };
                    });
                    lqSaveProgress(merged);
                }
            }).catch(function(){});
        }
    });
}

})();
