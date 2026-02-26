// © 2024-2026 Bitcoin Education Archive / NEEDcreations. All rights reserved.
// This code is proprietary. See LICENSE file. Do not copy or redistribute.
// =============================================
// 🦌 Nacho Engagement — Milestones, Streaks, Time-of-Day,
//    Trivia, Friendship, Outfits, Sound, Analytics, Follow-ups
// =============================================

(function() {

// ---- Time-of-Day Greetings (overrides welcome sometimes) ----
window.nachoTimeGreeting = function() {
    var h = new Date().getHours();
    var day = new Date().getDay();
    var name = typeof nachoUserName === 'function' ? nachoUserName() : '';
    var n = name ? ', ' + name : '';

    if (h >= 5 && h < 12) {
        return { pose: 'wave', text: "Good morning" + n + "! ☀️ Ready to learn some Bitcoin today?" };
    } else if (h >= 12 && h < 17) {
        return { pose: 'wave', text: "Good afternoon" + n + "! 🌤️ Let's stack some knowledge!" };
    } else if (h >= 17 && h < 21) {
        return { pose: 'wave', text: "Good evening" + n + "! 🌅 Great time to dive into some Bitcoin education!" };
    } else if (h >= 21 || h < 2) {
        return { pose: 'cool', text: "Late night study session" + n + "? 🌙 Respect! The night owl and the night deer, learning together. 🦉🦌" };
    } else {
        return { pose: 'sleep', text: "Whoa" + n + ", it's the middle of the night! 😴 Your dedication is legendary. Most deer would be asleep right now!" };
    }
};

// ---- Streak Awareness ----
window.nachoStreakMessage = function() {
    if (typeof currentUser === 'undefined' || !currentUser) return null;
    var streak = currentUser.streak || 0;
    var name = typeof nachoUserName === 'function' ? nachoUserName() : '';
    var n = name ? ', ' + name : '';

    if (streak >= 30) return { pose: 'fire', text: streak + "-day streak" + n + "! You're absolutely unstoppable! 🔥🦌👑" };
    if (streak >= 14) return { pose: 'fire', text: streak + "-day streak" + n + "! Two weeks straight! You're a machine! 🔥💪" };
    if (streak >= 7) return { pose: 'celebrate', text: streak + "-day streak" + n + "! A whole week! Nacho is very impressed! 🎉🔥" };
    if (streak >= 3) return { pose: 'love', text: streak + "-day streak" + n + "! Keep it going! 🔥" };
    return null;
};

// ---- Point/Rank Milestone Celebrations ----
const POINT_MILESTONES = [100, 250, 500, 1000, 2100, 5000, 10000, 21000];
window.nachoCheckMilestone = function() {
    if (typeof currentUser === 'undefined' || !currentUser) return null;
    var pts = currentUser.points || 0;
    var celebrated = JSON.parse(localStorage.getItem('btc_nacho_milestones') || '[]');
    var name = typeof nachoUserName === 'function' ? nachoUserName() : '';
    var n = name ? ', ' + name : '';

    for (var i = POINT_MILESTONES.length - 1; i >= 0; i--) {
        var m = POINT_MILESTONES[i];
        if (pts >= m && !celebrated.includes(m)) {
            celebrated.push(m);
            localStorage.setItem('btc_nacho_milestones', JSON.stringify(celebrated));
            var lvl = typeof getLevel === 'function' ? getLevel(pts) : null;
            var rank = lvl ? ' You\'re now rank: ' + lvl.emoji + ' ' + lvl.name + '!' : '';
            return { pose: 'celebrate', text: "🎉 " + m.toLocaleString() + " points" + n + "!" + rank + " Incredible progress! 🦌💪" };
        }
    }
    return null;
};

// ---- Category Completion Celebrations ----
const CATEGORIES = {
    'Properties': ['decentralized','dominant','money','organic','peaceful','programmable','scarce','secure','supranational','use-cases','whitepaper'],
    'Experienced Topics': ['bitvm','blockchain-timechain','chaumian-mints','consensus','core-source-code','cryptography','ctv-covenants','developers','difficulty-adjustment','energy','evidence-against-alts','extension-blocks','fedi-ark','investment-strategy','layer-2-lightning','layer-3-sidechains','maximalism','mining','nodes','op-codes','pow-vs-pos','privacy-nonkyc','problems-of-money','regulation','self-custody','smart-contracts','stablecoins'],
    'Resources': ['apps-tools','art-inspiration','articles-threads','books','charts','curriculum','faq-glossary','fun-facts','games','giga-chad','graphics','hardware','health','history','informational-sites','international','jobs-earn','memes-funny','misconceptions-fud','movies-tv','music','news-adoption','nostr','one-stop-shop','podcasts','poems-stories','projects-diy','research-theses','satoshi-nakamoto','social-media','swag-merch','videos','web5'],
};

window.nachoCategoryCheck = function(channelId) {
    var visited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]');
    var celebrated = JSON.parse(localStorage.getItem('btc_nacho_cat_complete') || '[]');
    var name = typeof nachoUserName === 'function' ? nachoUserName() : '';
    var n = name ? ', ' + name : '';

    for (var cat in CATEGORIES) {
        if (celebrated.includes(cat)) continue;
        var channels = CATEGORIES[cat];
        var allVisited = true;
        for (var i = 0; i < channels.length; i++) {
            if (!visited.includes(channels[i])) { allVisited = false; break; }
        }
        if (allVisited) {
            celebrated.push(cat);
            localStorage.setItem('btc_nacho_cat_complete', JSON.stringify(celebrated));
            return { pose: 'celebrate', text: "🏆 You've read every channel in " + cat + n + "! You're a true Bitcoin scholar in that area! 🦌🎓" };
        }
    }
    return null;
};

// ---- First-Time Channel Intros ----
const CHANNEL_INTROS = {
    'whitepaper': "This is where it all began — Satoshi's 9-page paper from 2008. The foundation of everything Bitcoin! 📜",
    'self-custody': "Self-custody means YOU hold your keys. This channel teaches you how. The most important Bitcoin skill! 🔑",
    'layer-2-lightning': "Lightning is Bitcoin's speed layer — instant payments, near-zero fees. This is the future of everyday Bitcoin! ⚡",
    'mining': "Mining is how Bitcoin is created and secured. Think of miners as the heartbeat of the network! ⛏️",
    'investment-strategy': "DCA, lump sum, cold storage — this channel covers how to build your Bitcoin stack wisely! 📈",
    'charts': "Data, charts, and on-chain analysis. For when you want the numbers to do the talking! 📊",
    'misconceptions-fud': "Every Bitcoin myth, debunked. Great ammo for conversations with skeptics! 🛡️",
    'one-stop-shop': "The ultimate starter channel! If you're new, this has everything to get you going. 🎯",
    'privacy-nonkyc': "Privacy is a right. This channel covers how to use Bitcoin without giving up your personal data. 🕵️",
    'problems-of-money': "Why is the current money system broken? This channel explains the problem Bitcoin solves. 💸",
    'nodes': "Run a node = be your own bank. This channel teaches you how and why. 🖥️",
    'fun-facts': "Bitcoin trivia, easter eggs, and fascinating tidbits. My personal favorite channel! 🎉",
    'history': "The full Bitcoin story from cypherpunks to global adoption. Essential context! 📚",
    'books': "The best Bitcoin books ever written. Start with The Bitcoin Standard! 📖",
    'podcasts': "Learn while you walk, drive, or graze. The best Bitcoin audio content! 🎧",
    'giga-chad': "The legends of Bitcoin. Saylor, Finney, Satoshi, and more. Get inspired! 💪",
    'nostr': "Decentralized social media built on Bitcoin values. The future of online communication! 💜",
    'scarce': "Only 21 million. Ever. This channel explains why scarcity matters so much. 💎",
    'money': "What IS money, really? This channel redefines everything you thought you knew. 💰",
    'decentralized': "No CEO, no headquarters, no single point of failure. This is what makes Bitcoin different. 🌐",
};

window.nachoChannelIntro = function(channelId) {
    var visited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]');
    if (visited.includes(channelId)) return null; // Only first time
    if (!CHANNEL_INTROS[channelId]) return null;
    return { pose: 'point', text: "📍 " + CHANNEL_INTROS[channelId] };
};

// ---- Random Trivia Pop-ups (bonus points!) ----
const TRIVIA = [
    { q: "How many satoshis are in 1 Bitcoin?", options: ['1 million', '10 million', '100 million', '1 billion'], correct: 2, pts: 15 },
    { q: "What year was Bitcoin created?", options: ['2007', '2008', '2009', '2010'], correct: 2, pts: 10 },
    { q: "Who created Bitcoin?", options: ['Vitalik Buterin', 'Satoshi Nakamoto', 'Elon Musk', 'Hal Finney'], correct: 1, pts: 10 },
    { q: "What is the maximum supply of Bitcoin?", options: ['100 million', '21 million', '18 million', 'Unlimited'], correct: 1, pts: 10 },
    { q: "What is the Bitcoin halving?", options: ['Price drops 50%', 'Mining reward cuts in half', 'Network splits', 'Supply doubles'], correct: 1, pts: 15 },
    { q: "What was the first real-world Bitcoin purchase?", options: ['A car', 'Two pizzas', 'A house', 'A laptop'], correct: 1, pts: 10 },
    { q: "What does HODL mean?", options: ['Hold On for Dear Life', 'A typo for Hold', 'A trading strategy', 'A type of wallet'], correct: 1, pts: 10 },
    { q: "What is Lightning Network?", options: ['A mining tool', 'Bitcoin Layer 2', 'An altcoin', 'A wallet brand'], correct: 1, pts: 15 },
    { q: "How often does the difficulty adjust?", options: ['Every block', 'Every 2016 blocks', 'Every month', 'Every halving'], correct: 1, pts: 15 },
    { q: "What's in the Genesis Block message?", options: ['Hello World', 'Chancellor on brink of bailout', 'Bitcoin is born', 'Trust no one'], correct: 1, pts: 15 },
    { q: "What does 'Not your keys, not your coins' mean?", options: ['Keys are expensive', 'Self-custody matters', 'Bitcoin uses keys like doors', 'You need a keychain'], correct: 1, pts: 10 },
    { q: "Which country first made Bitcoin legal tender?", options: ['USA', 'Japan', 'El Salvador', 'Switzerland'], correct: 2, pts: 10 },
    { q: "How long does a Bitcoin block take on average?", options: ['1 minute', '5 minutes', '10 minutes', '1 hour'], correct: 2, pts: 10 },
    { q: "What does DCA stand for?", options: ['Digital Currency Account', 'Dollar Cost Averaging', 'Decentralized Crypto Asset', 'Direct Cash Application'], correct: 1, pts: 10 },
    { q: "What is a Bitcoin node?", options: ['A mining rig', 'A computer verifying Bitcoin', 'A type of wallet', 'A Bitcoin ATM'], correct: 1, pts: 15 },
];

window.nachoTrivia = function() {
    var asked = JSON.parse(localStorage.getItem('btc_nacho_trivia_asked') || '[]');
    var available = TRIVIA.filter(function(t, i) { return !asked.includes(i); });
    if (available.length === 0) return null;

    var idx = TRIVIA.indexOf(available[Math.floor(Math.random() * available.length)]);
    var t = TRIVIA[idx];

    asked.push(idx);
    localStorage.setItem('btc_nacho_trivia_asked', JSON.stringify(asked));

    return { trivia: t, index: idx };
};

window.showNachoTrivia = function() {
    var result = nachoTrivia();
    if (!result) return false;

    var t = result.trivia;
    var bubble = document.getElementById('nacho-bubble');
    var textEl = document.getElementById('nacho-text');
    if (!bubble || !textEl) return false;

    if (typeof setPose === 'function') setPose('think');

    // Mark as interactive — prevents auto-hide
    bubble.setAttribute('data-interactive', 'true');
    if(typeof clearNachoBubbleTimeout==="function")clearNachoBubbleTimeout();

    var html = '<div style="margin-bottom:8px;font-weight:700;color:var(--heading,#fff);font-size:0.9rem;">🧠 Quick Trivia! (+' + t.pts + ' pts)</div>' +
        '<div style="color:var(--text,#eee);margin-bottom:10px;line-height:1.5;">' + t.q + '</div>';

    for (var i = 0; i < t.options.length; i++) {
        html += '<button onmousedown="event.stopPropagation();" ontouchstart="event.stopPropagation();" onclick="event.stopPropagation();nachoTriviaAnswer(' + i + ',' + t.correct + ',' + t.pts + ',this)" style="display:block;width:100%;padding:8px 12px;margin-bottom:4px;background:var(--card-bg,#1a1a2e);border:1px solid var(--border,#333);border-radius:8px;color:var(--text,#eee);font-size:0.8rem;cursor:pointer;font-family:inherit;text-align:left;transition:0.15s;">' + String.fromCharCode(65 + i) + '. ' + t.options[i] + '</button>';
    }

    textEl.innerHTML = html;
    bubble.classList.add('show');
    if(typeof clearNachoBubbleTimeout==="function")clearNachoBubbleTimeout();
    return true;
};

window.nachoTriviaAnswer = function(selected, correct, pts, btn) {
    var buttons = btn.parentElement.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
        buttons[i].disabled = true;
        buttons[i].style.cursor = 'default';
        if (i === correct) {
            buttons[i].style.background = 'rgba(34,197,94,0.2)';
            buttons[i].style.borderColor = '#22c55e';
            buttons[i].style.color = '#22c55e';
        }
        if (i === selected && selected !== correct) {
            buttons[i].style.background = 'rgba(239,68,68,0.2)';
            buttons[i].style.borderColor = '#ef4444';
            buttons[i].style.color = '#ef4444';
        }
    }

    // Keep bubble open — prevent click-outside and auto-hide from dismissing
    var bubble = document.getElementById('nacho-bubble');
    if (bubble) bubble.setAttribute('data-interactive', 'true');
    if(typeof clearNachoBubbleTimeout==="function")clearNachoBubbleTimeout();

    // Temporarily remove click-outside handlers so user can read the result
    if (window._nachoDismissHandler) {
        document.removeEventListener('mousedown', window._nachoDismissHandler);
        document.removeEventListener('touchstart', window._nachoDismissHandler);
    }

    var textEl = document.getElementById('nacho-text');
    var name = typeof nachoUserName === 'function' ? nachoUserName() : '';
    var n = name ? ', ' + name : '';
    if (selected === correct) {
        if (typeof awardPoints === 'function') awardPoints(pts, '🧠 Trivia correct!');
        textEl.innerHTML += '<div style="color:#22c55e;font-weight:700;margin-top:8px;">✅ Correct' + n + '! +' + pts + ' points! 🎉</div>';
        if (typeof setPose === 'function') setPose('celebrate');
    } else {
        var consolation = Math.max(2, Math.floor(pts / 3));
        if (typeof awardPoints === 'function') awardPoints(consolation, '🧠 Nice try!');
        textEl.innerHTML += '<div style="color:#ef4444;font-weight:700;margin-top:8px;">❌ Not quite' + n + '! The answer was ' + String.fromCharCode(65 + correct) + '. +' + consolation + ' pts for trying! 📚</div>';
        if (typeof setPose === 'function') setPose('love');
    }

    textEl.innerHTML += '<button onmousedown="event.stopPropagation();" ontouchstart="event.stopPropagation();" onclick="event.stopPropagation();showNachoInput()" style="width:100%;margin-top:8px;padding:6px;background:var(--accent-bg,rgba(247,147,26,0.1));border:1px solid #f7931a;border-radius:8px;color:#f7931a;font-size:0.8rem;cursor:pointer;font-family:inherit;font-weight:600;">Ask Nacho a question 🦌</button>';
    textEl.innerHTML += '<button onclick="hideBubble(true)" style="width:100%;margin-top:4px;padding:6px;background:none;border:1px solid var(--border,#333);border-radius:8px;color:var(--text-muted,#888);font-size:0.8rem;cursor:pointer;font-family:inherit;">Dismiss</button>';
};

// ---- Nacho Friendship Level ----
window.getNachoFriendship = function() {
    var interactions = parseInt(localStorage.getItem('btc_nacho_interactions') || '0');
    if (interactions >= 750) return { level: 5, name: 'Best Buds', emoji: '💛' };
    if (interactions >= 350) return { level: 4, name: 'Close Friends', emoji: '🧡' };
    if (interactions >= 100) return { level: 3, name: 'Good Friends', emoji: '😊' };
    if (interactions >= 10) return { level: 2, name: 'Getting Acquainted', emoji: '👋' };
    if (interactions >= 1) return { level: 1, name: 'Just Met', emoji: '🦌' };
    return { level: 0, name: 'Strangers', emoji: '❓' };
};

window.trackNachoInteraction = function() {
    var count = parseInt(localStorage.getItem('btc_nacho_interactions') || '0') + 1;
    localStorage.setItem('btc_nacho_interactions', count.toString());
    window._nachoLastInteraction = Date.now();

    // Sync to Firebase every interaction
    if (typeof db !== 'undefined' && typeof auth !== 'undefined' && auth.currentUser) {
        var questions = parseInt(localStorage.getItem('btc_nacho_questions') || '0');
        try {
            db.collection('users').doc(auth.currentUser.uid).update({
                nachoInteractions: count,
                nachoQuestions: questions
            });
        } catch(e) {}
    }
};

// ---- Follow-up Suggestions ----
const FOLLOW_UPS = {
    'mining': ['How does the difficulty adjustment work?', 'What is a halving?', 'Is mining bad for the environment?'],
    'wallet': ['What is a seed phrase?', 'What is self-custody?', 'What is a hardware wallet?'],
    'lightning': ['How fast is Lightning?', 'What are sats?', 'How do I use Lightning?'],
    'halving': ['What is the block reward?', 'When is the next halving?', 'Why does the price go up after halving?'],
    'price': ['Is it too late to buy?', 'What is DCA?', 'Why is Bitcoin volatile?'],
    'self-custody': ['What is a seed phrase?', 'What wallets do you recommend?', 'What does HODL mean?'],
    'privacy': ['What is CoinJoin?', 'What is non-KYC Bitcoin?', 'Is Bitcoin anonymous?'],
    'basics': ['How does mining work?', 'What is the Lightning Network?', 'Who created Bitcoin?'],
    'fud': ['Is Bitcoin bad for the environment?', 'Can Bitcoin be hacked?', 'Will governments ban Bitcoin?'],
};

window.nachoFollowUps = function(answer) {
    if (!answer) return [];
    var lower = answer.toLowerCase();
    for (var topic in FOLLOW_UPS) {
        if (lower.includes(topic)) return FOLLOW_UPS[topic];
    }
    return [];
};

// ---- Question Analytics ----
window.trackNachoQuestion = function(question, matched) {
    try {
        var analytics = JSON.parse(localStorage.getItem('btc_nacho_analytics') || '[]');
        analytics.push({
            q: question.substring(0, 100),
            matched: matched,
            t: Date.now()
        });
        // Keep last 100
        if (analytics.length > 100) analytics = analytics.slice(-100);
        localStorage.setItem('btc_nacho_analytics', JSON.stringify(analytics));
    } catch(e) {}
};

// ---- Sound Effects ----
let nachoSoundEnabled = localStorage.getItem('btc_nacho_sound') !== 'false';

window.nachoPlaySound = function(type) {
    if (typeof canPlaySound === 'function' && !canPlaySound()) return;
    if (!nachoSoundEnabled) return;
    try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.value = 0.08;

        if (type === 'pop') {
            // Short pop for appearing
            osc.frequency.value = 800;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.15);
        } else if (type === 'coin') {
            // Coin sound for points/trivia
            osc.frequency.value = 1200;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.06, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
            // Second tone
            var osc2 = ctx.createOscillator();
            osc2.connect(gain);
            osc2.frequency.value = 1600;
            osc2.type = 'sine';
            osc2.start(ctx.currentTime + 0.1);
            osc2.stop(ctx.currentTime + 0.3);
        } else if (type === 'click') {
            // Soft click
            osc.frequency.value = 600;
            osc.type = 'triangle';
            gain.gain.setValueAtTime(0.05, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.08);
        }
    } catch(e) {}
};

window.toggleNachoSound = function() {
    nachoSoundEnabled = !nachoSoundEnabled;
    localStorage.setItem('btc_nacho_sound', nachoSoundEnabled.toString());
    return nachoSoundEnabled;
};

// ---- Session Context Memory ----
let nachoSessionContext = [];

window.nachoAddContext = function(topic) {
    nachoSessionContext.push(topic);
    if (nachoSessionContext.length > 5) nachoSessionContext.shift();
};

window.nachoGetContext = function() {
    return nachoSessionContext;
};

})();
