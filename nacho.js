// =============================================
// 🦡 Nacho - Bitcoin Education Archive Mascot
// "Nacho cheese, nacho keys."
// =============================================

(function() {

// ---- Nacho's Sayings ----
const NACHO_TIPS = [
    { text: "Not your keys, not your coins… but definitely your quest! ⚡", type: 'tip' },
    { text: "Pro tip: Save channels to favorites with the ⭐ button!", type: 'tip' },
    { text: "Try the Scholar Certification Quest — prove what you know! 🎓", type: 'tip' },
    { text: "Earn Orange Tickets just by showing up daily! 🎟️", type: 'tip' },
    { text: "Share your referral link and earn 5 tickets per verified friend! 🤝", type: 'tip' },
    { text: "Click the 🎲 dice to discover a random channel!", type: 'tip' },
    { text: "Check your stats in Settings → Data 📊", type: 'tip' },
    { text: "You can search all channels with the 🔍 button!", type: 'tip' },
    { text: "The more channels you explore, the more points you earn!", type: 'tip' },
    { text: "Try the dark/light theme toggle in Settings → Prefs 🎨", type: 'tip' },
];

const NACHO_MOTIVATION = [
    { text: "You're stacking knowledge like a true Bitcoiner! 📚", type: 'motivation' },
    { text: "Honey badger don't care about FUD! 🦡", type: 'motivation' },
    { text: "Keep going — every sat of knowledge counts! ⚡", type: 'motivation' },
    { text: "Bitcoin wasn't built in a day. Neither is understanding it! 🧱", type: 'motivation' },
    { text: "You're further down the rabbit hole than most! 🐇", type: 'motivation' },
    { text: "Stay humble, stack knowledge. 🙏", type: 'motivation' },
    { text: "Tick tock, next block… next channel! ⏰", type: 'motivation' },
    { text: "The more you learn, the less you FUD. 🧠", type: 'motivation' },
    { text: "Nacho is proud of your progress! 🦡💪", type: 'motivation' },
    { text: "Few understand this… but you will! 🔥", type: 'motivation' },
];

const NACHO_FUN = [
    { text: "Nacho cheese, nacho keys. 🧀🔑", type: 'fun' },
    { text: "Fun fact: Honey badgers are immune to snake venom. Bitcoin is immune to FUD. Coincidence? 🤔", type: 'fun' },
    { text: "If Satoshi had a pet, it would be a honey badger. Change my mind. 🦡", type: 'fun' },
    { text: "I tried to explain Bitcoin to a nocioner once. They're still confused. 😂", type: 'fun' },
    { text: "Some say I'm the most orange-pilled badger alive. They're right. 🟠", type: 'fun' },
    { text: "Bitcoin fixes everything. Except my cheese addiction. 🧀", type: 'fun' },
    { text: "My seed phrase? 24 different types of cheese. 🔐🧀", type: 'fun' },
    { text: "HODL your knowledge. Never sell what you've learned! 💎🙌", type: 'fun' },
    { text: "I once met a shitcoiner. Sad story. Anyway… 🦡", type: 'fun' },
    { text: "Roses are red, fiat is dead, stack sats instead! 🌹", type: 'fun' },
    { text: "In a world of unlimited printing, be a limited supply. Like me. 🦡", type: 'fun' },
    { text: "What's a honey badger's favorite block? The next one! ⛏️", type: 'fun' },
];

const NACHO_WELCOME = [
    { text: "Hey! I'm Nacho, your guide to the Bitcoin rabbit hole! 🦡", type: 'welcome' },
    { text: "Welcome back! Ready to learn something new? 🦡", type: 'welcome' },
    { text: "Nacho here! Let's explore some Bitcoin knowledge today! 🦡⚡", type: 'welcome' },
];

const NACHO_CHANNEL = [
    { text: "Great choice! This is a good one. 👀", type: 'channel' },
    { text: "Ooh, I love this channel! Dig in! 🦡", type: 'channel' },
    { text: "Excellent pick. You've got good taste! 🔥", type: 'channel' },
    { text: "This one will make you smarter. Trust me, I'm a badger. 🧠", type: 'channel' },
];

const NACHO_MILESTONE = [
    { text: "Wow, look at you go! Keep it up! 🚀", type: 'milestone' },
    { text: "You're on fire! Nacho approves! 🦡🔥", type: 'milestone' },
    { text: "Level up! The honey badger is impressed! 💪", type: 'milestone' },
];

// ---- State ----
let nachoVisible = true;
let bubbleTimeout = null;
let lastBubbleTime = 0;
let sessionMsgCount = 0;
const MAX_SESSION_MSGS = 15;     // Don't overdo it
const MIN_INTERVAL = 45000;      // At least 45s between messages
const BUBBLE_DURATION = 8000;    // Show each message for 8s
let shownMessages = new Set();   // Don't repeat in same session

// ---- Create Nacho DOM ----
function createNacho() {
    // Check if user dismissed Nacho
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
            gap: 8px;
            pointer-events: none;
            transition: opacity 0.3s, transform 0.3s;
        }
        #nacho-container.hidden {
            opacity: 0;
            transform: translateY(20px);
            pointer-events: none;
        }
        #nacho-avatar {
            width: 52px;
            height: 52px;
            background: linear-gradient(135deg, #f7931a, #ea580c);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.6rem;
            cursor: pointer;
            pointer-events: auto;
            box-shadow: 0 4px 20px rgba(247,147,26,0.3);
            transition: transform 0.2s, box-shadow 0.2s;
            user-select: none;
            position: relative;
            flex-shrink: 0;
        }
        #nacho-avatar:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 30px rgba(247,147,26,0.5);
        }
        #nacho-avatar:active {
            transform: scale(0.95);
        }
        #nacho-avatar .nacho-name {
            position: absolute;
            bottom: -16px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 0.55rem;
            color: var(--text-faint, #666);
            font-weight: 700;
            letter-spacing: 0.5px;
            white-space: nowrap;
        }
        #nacho-bubble {
            background: var(--card-bg, #1a1a2e);
            border: 1px solid var(--border, #333);
            border-radius: 14px 14px 14px 4px;
            padding: 12px 16px;
            max-width: 260px;
            color: var(--text, #e0e0e0);
            font-size: 0.85rem;
            line-height: 1.5;
            pointer-events: auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            opacity: 0;
            transform: translateY(10px) scale(0.95);
            transition: opacity 0.4s, transform 0.4s;
            cursor: pointer;
            position: relative;
        }
        #nacho-bubble.show {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
        #nacho-bubble .nacho-label {
            font-size: 0.65rem;
            color: #f7931a;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 4px;
        }
        #nacho-bubble .nacho-dismiss {
            position: absolute;
            top: 6px;
            right: 8px;
            color: var(--text-faint, #666);
            font-size: 0.7rem;
            cursor: pointer;
            opacity: 0.5;
            transition: opacity 0.2s;
        }
        #nacho-bubble .nacho-dismiss:hover {
            opacity: 1;
        }
        /* Idle animation */
        @keyframes nachoBob {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3px); }
        }
        #nacho-avatar.idle {
            animation: nachoBob 3s ease-in-out infinite;
        }
        /* Mobile adjustments */
        @media (max-width: 768px) {
            #nacho-container { bottom: 75px; left: 12px; }
            #nacho-avatar { width: 44px; height: 44px; font-size: 1.3rem; }
            #nacho-bubble { max-width: 220px; font-size: 0.8rem; padding: 10px 14px; }
        }
        @media (max-width: 480px) {
            #nacho-container { bottom: 70px; left: 8px; }
            #nacho-bubble { max-width: 200px; }
        }
        /* Toggle button when Nacho is hidden */
        #nacho-toggle {
            position: fixed;
            bottom: 20px;
            left: 20px;
            z-index: 250;
            width: 36px;
            height: 36px;
            background: var(--card-bg, #1a1a2e);
            border: 1px solid var(--border, #333);
            border-radius: 50%;
            display: none;
            align-items: center;
            justify-content: center;
            font-size: 1rem;
            cursor: pointer;
            opacity: 0.4;
            transition: opacity 0.2s;
        }
        #nacho-toggle:hover { opacity: 1; }
        @media (max-width: 768px) {
            #nacho-toggle { bottom: 75px; left: 12px; }
        }
    `;
    document.head.appendChild(style);

    // Main container
    const container = document.createElement('div');
    container.id = 'nacho-container';
    if (!nachoVisible) container.classList.add('hidden');
    container.innerHTML = `
        <div id="nacho-avatar" class="idle" onclick="nachoClick()" title="Nacho the Honey Badger">
            🦡
            <span class="nacho-name">NACHO</span>
        </div>
        <div id="nacho-bubble" onclick="hideBubble()">
            <span class="nacho-dismiss">✕</span>
            <div class="nacho-label">Nacho says</div>
            <div id="nacho-text"></div>
        </div>
    `;
    document.body.appendChild(container);

    // Toggle button (for when Nacho is hidden)
    const toggle = document.createElement('div');
    toggle.id = 'nacho-toggle';
    toggle.innerHTML = '🦡';
    toggle.title = 'Bring back Nacho';
    toggle.onclick = function() { showNacho(); };
    if (!nachoVisible) toggle.style.display = 'flex';
    document.body.appendChild(toggle);

    // Initial welcome after short delay
    setTimeout(function() {
        if (nachoVisible) {
            const msg = pickRandom(NACHO_WELCOME);
            showBubble(msg.text);
        }
    }, 2500);

    // Periodic messages
    setInterval(periodicMessage, 60000);
}

// ---- Show/Hide Bubble ----
function showBubble(text) {
    if (!nachoVisible || sessionMsgCount >= MAX_SESSION_MSGS) return;
    const now = Date.now();
    if (now - lastBubbleTime < MIN_INTERVAL) return;
    if (shownMessages.has(text)) return;

    const bubble = document.getElementById('nacho-bubble');
    const textEl = document.getElementById('nacho-text');
    const avatar = document.getElementById('nacho-avatar');
    if (!bubble || !textEl) return;

    shownMessages.add(text);
    sessionMsgCount++;
    lastBubbleTime = now;

    textEl.textContent = text;
    bubble.classList.add('show');

    // Stop idle animation during talk
    if (avatar) avatar.classList.remove('idle');

    clearTimeout(bubbleTimeout);
    bubbleTimeout = setTimeout(function() {
        hideBubble();
    }, BUBBLE_DURATION);
}

window.hideBubble = function() {
    const bubble = document.getElementById('nacho-bubble');
    const avatar = document.getElementById('nacho-avatar');
    if (bubble) bubble.classList.remove('show');
    if (avatar) avatar.classList.add('idle');
    clearTimeout(bubbleTimeout);
};

// ---- Click Nacho for a random saying ----
window.nachoClick = function() {
    const bubble = document.getElementById('nacho-bubble');
    if (bubble && bubble.classList.contains('show')) {
        hideBubble();
        return;
    }
    // Pick from all pools
    const all = [...NACHO_FUN, ...NACHO_TIPS, ...NACHO_MOTIVATION];
    const unshown = all.filter(m => !shownMessages.has(m.text));
    const pool = unshown.length > 0 ? unshown : all;
    const msg = pickRandom(pool);
    // Override interval for clicks
    lastBubbleTime = 0;
    showBubble(msg.text);
};

// ---- Show/Hide Nacho entirely ----
window.showNacho = function() {
    nachoVisible = true;
    localStorage.removeItem('btc_nacho_hidden');
    const container = document.getElementById('nacho-container');
    const toggle = document.getElementById('nacho-toggle');
    if (container) container.classList.remove('hidden');
    if (toggle) toggle.style.display = 'none';
    lastBubbleTime = 0;
    showBubble("I'm back! Did you miss me? 🦡");
};

window.hideNacho = function() {
    nachoVisible = false;
    localStorage.setItem('btc_nacho_hidden', 'true');
    const container = document.getElementById('nacho-container');
    const toggle = document.getElementById('nacho-toggle');
    if (container) container.classList.add('hidden');
    if (toggle) toggle.style.display = 'flex';
};

// ---- Context-Aware Messages ----

// Called when user opens a channel
window.nachoOnChannel = function(channelId) {
    if (!nachoVisible || Math.random() > 0.3) return; // 30% chance
    const msg = pickRandom(NACHO_CHANNEL);
    showBubble(msg.text);
};

// Called when user earns points
window.nachoOnPoints = function(pts) {
    if (!nachoVisible || Math.random() > 0.25) return;
    const msg = pickRandom(NACHO_MILESTONE);
    showBubble(msg.text);
};

// Called when user completes a quest
window.nachoOnQuest = function(passed) {
    if (!nachoVisible) return;
    if (passed) {
        lastBubbleTime = 0;
        showBubble("You crushed that quest! Honey badger is proud! 🦡🎉");
    } else {
        lastBubbleTime = 0;
        showBubble("Don't sweat it! Read up and try again. Nacho believes in you! 🦡💪");
    }
};

// Periodic messages (every 60s, but showBubble enforces 45s minimum)
function periodicMessage() {
    if (!nachoVisible || sessionMsgCount >= MAX_SESSION_MSGS) return;
    if (Math.random() > 0.35) return; // ~35% chance each minute

    const pools = [NACHO_TIPS, NACHO_MOTIVATION, NACHO_FUN];
    const pool = pickRandom(pools);
    const unshown = pool.filter(m => !shownMessages.has(m.text));
    if (unshown.length === 0) return;
    const msg = pickRandom(unshown);
    showBubble(msg.text);
}

// ---- Utility ----
function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ---- Long-press to hide Nacho ----
let longPressTimer = null;
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        const avatar = document.getElementById('nacho-avatar');
        if (!avatar) return;

        avatar.addEventListener('mousedown', function() {
            longPressTimer = setTimeout(function() {
                hideNacho();
                if (typeof showToast === 'function') showToast('🦡 Nacho is hiding. Click the small 🦡 to bring him back!');
            }, 1500);
        });
        avatar.addEventListener('mouseup', function() { clearTimeout(longPressTimer); });
        avatar.addEventListener('mouseleave', function() { clearTimeout(longPressTimer); });
        avatar.addEventListener('touchstart', function() {
            longPressTimer = setTimeout(function() {
                hideNacho();
                if (typeof showToast === 'function') showToast('🦡 Nacho is hiding. Tap the small 🦡 to bring him back!');
            }, 1500);
        }, { passive: true });
        avatar.addEventListener('touchend', function() { clearTimeout(longPressTimer); });
    }, 1000);
});

// ---- Initialize ----
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createNacho);
} else {
    createNacho();
}

})();
