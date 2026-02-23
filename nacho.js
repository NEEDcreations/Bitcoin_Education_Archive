// =============================================
// 🦡 Nacho - Bitcoin Education Archive Mascot
// "Nacho keys, nacho cheese."
// Inspired by Clippy (Microsoft Office '97)
// =============================================

(function() {

// ---- Nacho's Expressions (Clippy-style poses) ----
const POSES = {
    default: '🦡',
    wave: '👋',
    think: '🤔',
    celebrate: '🎉',
    point: '👆',
    eyes: '👀',
    fire: '🔥',
    brain: '🧠',
    cool: '😎',
    sleep: '💤',
    cheese: '🧀',
    love: '🧡',
};

// ---- Clippy-style "It looks like..." messages ----
const CLIPPY_HELPS = {
    // Channel-specific
    'whitepaper': { pose: 'brain', text: "It looks like you're reading the whitepaper! Would you like me to... just kidding, I'm a badger. But this is where it all started! 📜" },
    'self-custody': { pose: 'point', text: "It looks like you're learning about self-custody! Remember: Nacho keys, nacho cheese. 🧀🔑" },
    'investment-strategy': { pose: 'think', text: "It looks like you're planning your stack strategy! Pro tip: DCA and chill. 📈" },
    'mining': { pose: 'fire', text: "It looks like you're interested in mining! Fun fact: Honey badgers dig too. We have a lot in common. ⛏️" },
    'privacy-nonkyc': { pose: 'eyes', text: "It looks like you value your privacy! Good. A wise badger never reveals his burrow location. 🕵️" },
    'layer-2-lightning': { pose: 'celebrate', text: "It looks like you're exploring Lightning! Zap zap! ⚡⚡" },
    'fun-facts': { pose: 'cool', text: "It looks like you're browsing fun facts! This channel is my personal favorite. Don't tell the others. 🤫" },
    'history': { pose: 'brain', text: "It looks like you're studying Bitcoin history! Those who don't learn history are doomed to buy shitcoins. 📚" },
    'charts': { pose: 'eyes', text: "It looks like you're checking the charts! Number go up technology, am I right? 📊" },
    'problems-of-money': { pose: 'think', text: "It looks like you're learning why fiat is broken! This is where many badgers get orange-pilled. 🟠" },
    'giga-chad': { pose: 'fire', text: "It looks like you're in the Giga Chad channel! Based. 💪" },
    'memes-funny': { pose: 'celebrate', text: "It looks like you're looking at memes! A badger of culture, I see. 😏" },
    'evidence-against-alts': { pose: 'cool', text: "It looks like you're reading about altcoins! Spoiler: there's only Bitcoin. 🦡" },
};

// ---- General Tips (Clippy "Did you know?") ----
const TIPS = [
    { pose: 'point', text: "💡 Did you know? You can save channels to favorites with the ⭐ button!" },
    { pose: 'point', text: "💡 Did you know? Click the 🎲 dice to discover a random channel!" },
    { pose: 'point', text: "💡 Did you know? You earn Orange Tickets just by logging in daily! 🎟️" },
    { pose: 'point', text: "💡 Did you know? Share your referral link for 5 free tickets per friend! Check Settings → Tickets." },
    { pose: 'point', text: "💡 Did you know? You can search all 146 channels with the 🔍 button!" },
    { pose: 'brain', text: "💡 Did you know? There's a Scholar Certification Quest! Pass it to prove your Bitcoin knowledge. 🎓" },
    { pose: 'point', text: "💡 Did you know? Your Exploration Map on the homepage shows which channels you've visited!" },
    { pose: 'point', text: "💡 Did you know? There are hidden badges to discover! 🏅 I won't tell you how to get them..." },
    { pose: 'cheese', text: "💡 Did you know? More Orange Tickets = higher chance of winning the 25,000 sats giveaway! 🎟️🏆" },
    { pose: 'point', text: "💡 Did you know? You can change the site language in Settings → Prefs! 🌐" },
];

// ---- Motivational (Clippy encouragement) ----
const MOTIVATION = [
    { pose: 'celebrate', text: "You're doing great! Most people never even start learning about Bitcoin. 🦡💪" },
    { pose: 'fire', text: "Keep going! You're stacking knowledge like a true plebeian! 📚🔥" },
    { pose: 'love', text: "Nacho is proud of your progress! You're further down the rabbit hole than most. 🐇" },
    { pose: 'cool', text: "Stay humble, stack sats, stack knowledge. You're doing all three. 😎" },
    { pose: 'celebrate', text: "Every channel you read makes the FUD weaker! Keep it up! 💪" },
    { pose: 'brain', text: "Your brain is getting more orange-pilled by the minute! 🧠🟠" },
    { pose: 'fire', text: "Tick tock, next block... and you're getting smarter each one! ⏰" },
    { pose: 'love', text: "The fact that you're here learning puts you ahead of 99% of people. For real. 🧡" },
];

// ---- Fun / Personality (Clippy idle chatter) ----
const FUN = [
    { pose: 'cheese', text: "Nacho keys, nacho cheese. It's not just a tagline, it's a lifestyle. 🧀🔑" },
    { pose: 'cool', text: "Honey badgers are immune to snake venom. I'm immune to FUD. Coincidence? 🤔" },
    { pose: 'think', text: "If Satoshi had a pet, it would definitely be a honey badger. I will not elaborate. 🦡" },
    { pose: 'cheese', text: "My seed phrase? 24 different types of cheese. Very secure. 🔐🧀" },
    { pose: 'default', text: "I once tried to explain Bitcoin to a goldfish. It went about as well as explaining it to Peter Schiff. 🐟" },
    { pose: 'celebrate', text: "HODL your knowledge. Never sell what you've learned! 💎🙌" },
    { pose: 'cool', text: "I've been orange-pilled since birth. Perks of being an orange animal. 🟠" },
    { pose: 'think', text: "Roses are red, fiat is dead, stack sats instead! 🌹" },
    { pose: 'default', text: "In a world of unlimited printing, be a limited supply. Like Bitcoin. And like me — there's only one Nacho. 🦡" },
    { pose: 'cheese', text: "Bitcoin fixes everything. Except my cheese addiction. Some things are unfixable. 🧀" },
    { pose: 'eyes', text: "I've been watching you learn. Not in a creepy way. In a proud badger way. 👀" },
    { pose: 'sleep', text: "*yawns* Don't mind me, just HODLing this corner of your screen... 💤" },
    { pose: 'default', text: "Some people have angel investors. You have an angel badger. You're welcome. 😇🦡" },
    { pose: 'think', text: "What's a honey badger's favorite block? The next one! ⛏️" },
    { pose: 'cool', text: "I'm not saying I'm Satoshi, but have you ever seen us in the same room? 🤫" },
    { pose: 'fire', text: "Few understand this... but YOU will. That's why you're here. 🔥" },
];

// ---- Welcome Messages ----
const WELCOME = [
    { pose: 'wave', text: "👋 Hi! I'm Nacho, your friendly Bitcoin honey badger! Click me anytime for tips. I won't bite... probably." },
    { pose: 'wave', text: "👋 Welcome back! Nacho missed you! Ready to learn something new today?" },
    { pose: 'wave', text: "👋 Hey there! Nacho here. I'll be hanging out in this corner if you need me!" },
];

// ---- Channel Reactions ----
const CHANNEL_REACT = [
    { pose: 'eyes', text: "Great choice! I'll be over here if you need me. 👀" },
    { pose: 'cool', text: "Ooh, excellent pick! You've got good taste. 😎" },
    { pose: 'brain', text: "This one's a good read! Take your time. 🧠" },
    { pose: 'fire', text: "One of my favorites! Dig in! 🦡🔥" },
    { pose: 'love', text: "Nice! This channel has great stuff in it. 🧡" },
];

// ---- Milestone Reactions ----
const MILESTONES = [
    { pose: 'celebrate', text: "Nice! Points are stacking up! 🎉" },
    { pose: 'fire', text: "You're on fire! Nacho approves! 🔥" },
    { pose: 'celebrate', text: "Cha-ching! The knowledge is paying off! 💰" },
];

// ---- Idle Animations (Clippy-style fidgeting) ----
const IDLE_SEQUENCE = ['default', 'eyes', 'default', 'think', 'default', 'cheese', 'default', 'cool', 'default', 'sleep', 'default'];
let idleIndex = 0;
let idleTimer = null;

// ---- State ----
let nachoVisible = true;
let bubbleTimeout = null;
let lastBubbleTime = 0;
let sessionMsgCount = 0;
const MAX_SESSION_MSGS = 12;
const MIN_INTERVAL = 50000;       // 50s between auto messages
const BUBBLE_DURATION = 9000;     // 9s per message
const CLICK_COOLDOWN = 1500;      // 1.5s between click messages
let shownMessages = new Set();
let lastClickTime = 0;
let currentPose = 'default';

// ---- Create Nacho DOM ----
function createNacho() {
    if (localStorage.getItem('btc_nacho_hidden') === 'true') {
        nachoVisible = false;
    }

    const style = document.createElement('style');
    style.textContent = `
        #nacho-container {
            position: fixed;
            bottom: 20px;
            left: 20px;
            z-index: 250;
            display: flex;
            align-items: flex-end;
            gap: 0;
            pointer-events: none;
            transition: opacity 0.3s, transform 0.3s;
        }
        #nacho-container.hidden { opacity: 0; transform: translateY(30px); pointer-events: none; }

        #nacho-avatar {
            width: 56px;
            height: 56px;
            background: linear-gradient(145deg, #f7931a, #ea580c);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.7rem;
            cursor: pointer;
            pointer-events: auto;
            box-shadow: 0 4px 20px rgba(247,147,26,0.35), inset 0 -2px 4px rgba(0,0,0,0.2);
            transition: transform 0.15s;
            user-select: none;
            position: relative;
            flex-shrink: 0;
            z-index: 2;
        }
        #nacho-avatar:hover { transform: scale(1.12) rotate(-5deg); }
        #nacho-avatar:active { transform: scale(0.92); }
        #nacho-avatar .nacho-name {
            position: absolute;
            bottom: -18px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 0.6rem;
            color: var(--text-faint, #666);
            font-weight: 800;
            letter-spacing: 1px;
            white-space: nowrap;
            text-transform: uppercase;
        }

        /* Clippy-style speech bubble */
        #nacho-bubble {
            background: var(--card-bg, #1a1a2e);
            border: 1px solid var(--border, #333);
            border-radius: 16px;
            padding: 14px 18px 14px 16px;
            max-width: 280px;
            min-width: 180px;
            color: var(--text, #e0e0e0);
            font-size: 0.85rem;
            line-height: 1.55;
            pointer-events: auto;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
            opacity: 0;
            transform: translateY(8px) scale(0.9);
            transition: opacity 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
            cursor: pointer;
            position: relative;
            margin-left: -6px;
            margin-bottom: 10px;
        }
        #nacho-bubble::before {
            content: '';
            position: absolute;
            bottom: 8px;
            left: -8px;
            width: 0; height: 0;
            border-top: 8px solid transparent;
            border-bottom: 8px solid transparent;
            border-right: 8px solid var(--border, #333);
        }
        #nacho-bubble::after {
            content: '';
            position: absolute;
            bottom: 9px;
            left: -6px;
            width: 0; height: 0;
            border-top: 7px solid transparent;
            border-bottom: 7px solid transparent;
            border-right: 7px solid var(--card-bg, #1a1a2e);
        }
        #nacho-bubble.show { opacity: 1; transform: translateY(0) scale(1); }

        .nacho-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 6px;
        }
        .nacho-label {
            font-size: 0.65rem;
            color: #f7931a;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .nacho-x {
            color: var(--text-faint, #666);
            font-size: 0.75rem;
            cursor: pointer;
            opacity: 0.4;
            transition: opacity 0.2s;
            padding: 2px 4px;
        }
        .nacho-x:hover { opacity: 1; }
        #nacho-text { word-wrap: break-word; }

        /* Clippy-style idle animations — mimic the paper clip's fidgeting */

        /* 1. Tap tap — like Clippy tapping on the screen */
        @keyframes nachoTap {
            0%, 100% { transform: translateY(0); }
            10% { transform: translateY(-6px); }
            20% { transform: translateY(0); }
            30% { transform: translateY(-4px); }
            40% { transform: translateY(0); }
        }
        /* 2. Lean and look — Clippy tilting to peek at your screen */
        @keyframes nachoLean {
            0%, 100% { transform: rotate(0deg) translateX(0); }
            30% { transform: rotate(8deg) translateX(3px); }
            50% { transform: rotate(8deg) translateX(3px); }
            80% { transform: rotate(0deg) translateX(0); }
        }
        /* 3. Bored wiggle — Clippy fidgeting when idle */
        @keyframes nachoWiggle {
            0%, 100% { transform: rotate(0deg); }
            15% { transform: rotate(-6deg); }
            30% { transform: rotate(5deg); }
            45% { transform: rotate(-4deg); }
            60% { transform: rotate(3deg); }
            75% { transform: rotate(-2deg); }
            90% { transform: rotate(0deg); }
        }
        /* 4. Bounce — Clippy's excited hop */
        @keyframes nachoBounce {
            0%, 100% { transform: translateY(0) scale(1); }
            20% { transform: translateY(-8px) scale(1.05); }
            40% { transform: translateY(0) scale(0.97); }
            55% { transform: translateY(-4px) scale(1.02); }
            70% { transform: translateY(0) scale(0.99); }
            85% { transform: translateY(-2px) scale(1.01); }
        }
        /* 5. Stretch — Clippy stretching/yawning */
        @keyframes nachoStretch {
            0%, 100% { transform: scaleY(1) scaleX(1); }
            25% { transform: scaleY(1.12) scaleX(0.92); }
            50% { transform: scaleY(0.92) scaleX(1.08); }
            75% { transform: scaleY(1.05) scaleX(0.97); }
        }
        /* 6. Look around — Clippy looking left and right */
        @keyframes nachoLook {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-5px); }
            40% { transform: translateX(-5px); }
            60% { transform: translateX(5px); }
            80% { transform: translateX(5px); }
        }
        /* 7. Wave — Clippy waving at you */
        @keyframes nachoWave {
            0%, 100% { transform: rotate(0deg); }
            15% { transform: rotate(-12deg); }
            30% { transform: rotate(10deg); }
            45% { transform: rotate(-8deg); }
            60% { transform: rotate(6deg); }
            75% { transform: rotate(-3deg); }
        }
        /* 8. Sleepy bob — Clippy nodding off */
        @keyframes nachoSleepy {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            30% { transform: translateY(2px) rotate(3deg); }
            50% { transform: translateY(3px) rotate(5deg); }
            70% { transform: translateY(2px) rotate(3deg); }
        }

        #nacho-avatar.anim-tap { animation: nachoTap 2s ease-in-out infinite; }
        #nacho-avatar.anim-lean { animation: nachoLean 3.5s ease-in-out infinite; }
        #nacho-avatar.anim-wiggle { animation: nachoWiggle 2.5s ease-in-out infinite; }
        #nacho-avatar.anim-bounce { animation: nachoBounce 1.8s ease-in-out infinite; }
        #nacho-avatar.anim-stretch { animation: nachoStretch 3s ease-in-out infinite; }
        #nacho-avatar.anim-look { animation: nachoLook 4s ease-in-out infinite; }
        #nacho-avatar.anim-wave { animation: nachoWave 1.5s ease-in-out infinite; }
        #nacho-avatar.anim-sleepy { animation: nachoSleepy 4s ease-in-out infinite; }

        /* Mobile */
        @media (max-width: 768px) {
            #nacho-container { bottom: 75px; left: 10px; }
            #nacho-avatar { width: 46px; height: 46px; font-size: 1.4rem; }
            #nacho-bubble { max-width: 230px; min-width: 150px; font-size: 0.8rem; padding: 12px 14px; }
        }
        @media (max-width: 480px) {
            #nacho-container { bottom: 70px; left: 6px; }
            #nacho-bubble { max-width: 200px; }
        }

        /* Bring-back toggle */
        #nacho-toggle {
            position: fixed; bottom: 20px; left: 20px; z-index: 250;
            width: 32px; height: 32px;
            background: var(--card-bg, #1a1a2e); border: 1px solid var(--border, #333);
            border-radius: 50%; display: none; align-items: center; justify-content: center;
            font-size: 0.9rem; cursor: pointer; opacity: 0.3; transition: opacity 0.2s;
        }
        #nacho-toggle:hover { opacity: 1; }
        @media (max-width: 768px) { #nacho-toggle { bottom: 75px; left: 10px; } }
    `;
    document.head.appendChild(style);

    const container = document.createElement('div');
    container.id = 'nacho-container';
    if (!nachoVisible) container.classList.add('hidden');
    container.innerHTML =
        '<div id="nacho-avatar" class="anim-tap" onclick="nachoClick()" title="Nacho the Honey Badger — Click me!">' +
            '<span id="nacho-face">' + POSES.default + '</span>' +
            '<span class="nacho-name">Nacho</span>' +
        '</div>' +
        '<div id="nacho-bubble" onclick="hideBubble()">' +
            '<div class="nacho-header">' +
                '<span class="nacho-label">🦡 Nacho says</span>' +
                '<span class="nacho-x" onclick="event.stopPropagation();hideBubble()">✕</span>' +
            '</div>' +
            '<div id="nacho-text"></div>' +
        '</div>';
    document.body.appendChild(container);

    const toggle = document.createElement('div');
    toggle.id = 'nacho-toggle';
    toggle.innerHTML = '🦡';
    toggle.title = 'Bring back Nacho';
    toggle.onclick = function() { showNacho(); };
    if (!nachoVisible) toggle.style.display = 'flex';
    document.body.appendChild(toggle);

    // Welcome after delay
    setTimeout(function() {
        if (nachoVisible) {
            const msg = pickRandom(WELCOME);
            setPose(msg.pose);
            forceShowBubble(msg.text);
        }
    }, 2000);

    // Start idle animation cycling
    startIdleCycle();

    // Periodic messages
    setInterval(periodicMessage, 55000);
}

// ---- Pose Management (Clippy expressions) ----
function setPose(pose) {
    const face = document.getElementById('nacho-face');
    if (!face) return;
    currentPose = pose || 'default';
    face.textContent = POSES[currentPose] || POSES.default;
}

function resetPose() {
    setPose('default');
}

// ---- Idle Animation Cycle (Clippy fidgeting) ----
function startIdleCycle() {
    clearInterval(idleTimer);
    idleTimer = setInterval(function() {
        if (!nachoVisible) return;
        const bubble = document.getElementById('nacho-bubble');
        if (bubble && bubble.classList.contains('show')) return; // Don't fidget while talking

        const avatar = document.getElementById('nacho-avatar');
        if (!avatar) return;

        // Cycle through expressions
        idleIndex = (idleIndex + 1) % IDLE_SEQUENCE.length;
        setPose(IDLE_SEQUENCE[idleIndex]);

        // Randomly switch idle animation — Clippy-style fidgeting
        const allAnims = ['anim-tap', 'anim-lean', 'anim-wiggle', 'anim-bounce', 'anim-stretch', 'anim-look', 'anim-wave', 'anim-sleepy'];
        allAnims.forEach(a => avatar.classList.remove(a));
        // Match animation to expression
        const poseAnimMap = { 'default': ['anim-tap','anim-look','anim-wiggle'], 'eyes': ['anim-lean','anim-look'], 'think': ['anim-lean','anim-tap'], 'cheese': ['anim-bounce','anim-wiggle'], 'cool': ['anim-lean','anim-tap'], 'sleep': ['anim-sleepy'], 'wave': ['anim-wave'], 'celebrate': ['anim-bounce'], 'fire': ['anim-bounce','anim-wiggle'], 'love': ['anim-stretch','anim-tap'], 'brain': ['anim-lean','anim-look'], 'point': ['anim-tap','anim-lean'] };
        const choices = poseAnimMap[currentPose] || ['anim-tap','anim-wiggle'];
        avatar.classList.add(pickRandom(choices));
    }, 8000);
}

// ---- Show/Hide Bubble ----
function showBubble(text, pose) {
    if (!nachoVisible || sessionMsgCount >= MAX_SESSION_MSGS) return;
    const now = Date.now();
    if (now - lastBubbleTime < MIN_INTERVAL) return;
    if (shownMessages.has(text)) return;
    _showBubble(text, pose);
}

function forceShowBubble(text, pose) {
    if (!nachoVisible) return;
    _showBubble(text, pose);
}

function _showBubble(text, pose) {
    const bubble = document.getElementById('nacho-bubble');
    const textEl = document.getElementById('nacho-text');
    const avatar = document.getElementById('nacho-avatar');
    if (!bubble || !textEl) return;

    shownMessages.add(text);
    sessionMsgCount++;
    lastBubbleTime = Date.now();

    if (pose) setPose(pose);

    // Stop idle animation while talking
    if (avatar) {
        ['anim-tap','anim-lean','anim-wiggle','anim-bounce','anim-stretch','anim-look','anim-wave','anim-sleepy'].forEach(a => avatar.classList.remove(a));
    }

    textEl.textContent = text;
    bubble.classList.add('show');

    clearTimeout(bubbleTimeout);
    bubbleTimeout = setTimeout(hideBubble, BUBBLE_DURATION);
}

window.hideBubble = function() {
    const bubble = document.getElementById('nacho-bubble');
    const avatar = document.getElementById('nacho-avatar');
    if (bubble) bubble.classList.remove('show');
    clearTimeout(bubbleTimeout);
    // Resume idle after a beat
    setTimeout(function() {
        resetPose();
        if (avatar) avatar.classList.add('anim-tap');
    }, 500);
};

// ---- Click for random message ----
window.nachoClick = function() {
    const now = Date.now();
    if (now - lastClickTime < CLICK_COOLDOWN) return;
    lastClickTime = now;

    const bubble = document.getElementById('nacho-bubble');
    if (bubble && bubble.classList.contains('show')) {
        hideBubble();
        return;
    }

    const all = [...FUN, ...TIPS, ...MOTIVATION];
    const unshown = all.filter(m => !shownMessages.has(m.text));
    const pool = unshown.length > 3 ? unshown : all;
    const msg = pickRandom(pool);
    lastBubbleTime = 0; // Override interval for clicks
    setPose(msg.pose);
    forceShowBubble(msg.text, msg.pose);
};

// ---- Show/Hide Nacho ----
window.showNacho = function() {
    nachoVisible = true;
    localStorage.removeItem('btc_nacho_hidden');
    document.getElementById('nacho-container').classList.remove('hidden');
    document.getElementById('nacho-toggle').style.display = 'none';
    lastBubbleTime = 0;
    setPose('wave');
    forceShowBubble("I'm back, baby! Miss me? 🦡");
};

window.hideNacho = function() {
    nachoVisible = false;
    localStorage.setItem('btc_nacho_hidden', 'true');
    document.getElementById('nacho-container').classList.add('hidden');
    document.getElementById('nacho-toggle').style.display = 'flex';
};

// ---- Context-Aware: Channel Open (Clippy "It looks like...") ----
window.nachoOnChannel = function(channelId) {
    if (!nachoVisible) return;

    // Check for specific channel message first
    if (CLIPPY_HELPS[channelId] && Math.random() < 0.6) {
        const help = CLIPPY_HELPS[channelId];
        showBubble(help.text, help.pose);
        return;
    }

    // General channel reaction (25% chance)
    if (Math.random() < 0.25) {
        const msg = pickRandom(CHANNEL_REACT);
        showBubble(msg.text, msg.pose);
    }
};

// ---- Context-Aware: Points Earned ----
window.nachoOnPoints = function(pts) {
    if (!nachoVisible || Math.random() > 0.2) return;
    const msg = pickRandom(MILESTONES);
    showBubble(msg.text, msg.pose);
};

// ---- Context-Aware: Quest Complete ----
window.nachoOnQuest = function(passed) {
    if (!nachoVisible) return;
    lastBubbleTime = 0;
    if (passed) {
        setPose('celebrate');
        forceShowBubble("You CRUSHED that quest! The honey badger is VERY impressed! 🦡🎉🔥");
    } else {
        setPose('love');
        forceShowBubble("Hey, some questions are hard! Read up and try again — Nacho believes in you! 🦡💪");
    }
};

// ---- Context-Aware: Search ----
window.nachoOnSearch = function() {
    if (!nachoVisible || Math.random() > 0.3) return;
    showBubble("Looking for something? I'd help search but I don't have thumbs. Good luck! 🔍🦡", 'think');
};

// ---- Context-Aware: Scroll to bottom of channel ----
window.nachoOnFinishChannel = function() {
    if (!nachoVisible || Math.random() > 0.3) return;
    const msgs = [
        { pose: 'celebrate', text: "You read the whole thing! Dedicated. I respect that. 🦡👏" },
        { pose: 'point', text: "All done? Hit the 🎲 to find your next channel!" },
        { pose: 'fire', text: "Knowledge: stacked. You're a machine! 💪" },
    ];
    const msg = pickRandom(msgs);
    showBubble(msg.text, msg.pose);
};

// ---- Periodic Messages (Clippy idle chatter) ----
function periodicMessage() {
    if (!nachoVisible || sessionMsgCount >= MAX_SESSION_MSGS) return;
    if (Math.random() > 0.3) return;

    const pools = [TIPS, MOTIVATION, FUN];
    const pool = pickRandom(pools);
    const unshown = pool.filter(m => !shownMessages.has(m.text));
    if (unshown.length === 0) return;
    const msg = pickRandom(unshown);
    showBubble(msg.text, msg.pose);
}

// ---- Utility ----
function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ---- Long-press to hide ----
let lp = null;
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        const av = document.getElementById('nacho-avatar');
        if (!av) return;
        function startLP() { lp = setTimeout(function() { hideNacho(); if (typeof showToast === 'function') showToast('🦡 Nacho is hiding. Click the small 🦡 to bring him back!'); }, 1500); }
        function stopLP() { clearTimeout(lp); }
        av.addEventListener('mousedown', startLP);
        av.addEventListener('mouseup', stopLP);
        av.addEventListener('mouseleave', stopLP);
        av.addEventListener('touchstart', startLP, { passive: true });
        av.addEventListener('touchend', stopLP);
    }, 1000);
});

// ---- Init ----
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createNacho);
} else {
    createNacho();
}

})();
