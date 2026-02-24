// =============================================
// 🦌 Nacho - Bitcoin Education Archive Mascot
// "Nacho keys, nacho cheese."
// A cartoon deer with large antlers — Inspired by Clippy (Microsoft Office '97)
// =============================================

(function() {

// ---- Nacho is a cartoon deer with antlers ----
const NACHO_SVG = '<img src="nacho-deer.svg" alt="Nacho" style="width:100%;height:100%;pointer-events:none;">';

// Poses are now expressed through the speech bubble label
const POSES = {
    default: '🦌',
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
    // Channel-specific "It looks like..." messages
    'whitepaper': { pose: 'brain', text: "It looks like you're reading the whitepaper! This is where it all started — 9 pages that changed the world! 📜" },
    'self-custody': { pose: 'point', text: "It looks like you're learning about self-custody! Remember: Nacho keys, nacho cheese. 🧀🔑" },
    'investment-strategy': { pose: 'think', text: "It looks like you're planning your stack strategy! Pro tip: DCA and chill. Time in the market beats timing the market. 📈" },
    'mining': { pose: 'fire', text: "It looks like you're exploring mining! Every 10 minutes a new block is born. Beautiful, isn't it? ⛏️" },
    'privacy-nonkyc': { pose: 'eyes', text: "It looks like you value your privacy! Good. A wise buck never reveals his forest location. 🕵️" },
    'layer-2-lightning': { pose: 'celebrate', text: "It looks like you're exploring Lightning! This is how Bitcoin scales to millions of transactions per second! ⚡⚡" },
    'fun-facts': { pose: 'cool', text: "It looks like you're browsing fun facts! This channel is my personal favorite. Don't tell the others. 🤫" },
    'history': { pose: 'brain', text: "It looks like you're studying Bitcoin history! Those who don't learn history are doomed to repeat it. 📚" },
    'charts': { pose: 'eyes', text: "It looks like you're checking the charts! Number go up technology, am I right? 📊" },
    'problems-of-money': { pose: 'think', text: "It looks like you're learning why fiat is broken! This is where many people get orange-pilled. 🟠" },
    'giga-chad': { pose: 'fire', text: "It looks like you're in the Giga Chad channel! Based and orange-pilled. 💪" },
    'memes-funny': { pose: 'celebrate', text: "It looks like you're looking at memes! A deer of culture, I see. 😏" },
    'evidence-against-alts': { pose: 'cool', text: "It looks like you're reading about altcoins! Spoiler: there's only Bitcoin. 🦌" },
    'scarce': { pose: 'brain', text: "It looks like you're learning about scarcity! Only 21 million will ever exist. Even I can't make more. 💎" },
    'decentralized': { pose: 'fire', text: "It looks like you're exploring decentralization! No single point of failure. Like a forest — cut one tree, the rest stand strong. 🌲" },
    'secure': { pose: 'point', text: "It looks like you're reading about Bitcoin's security! More computing power secures this network than anything else on Earth. 🔒" },
    'money': { pose: 'think', text: "It looks like you're learning what money really is! Hint: it's not what the government tells you. 💰" },
    'programmable': { pose: 'brain', text: "It looks like you're exploring programmable money! Smart contracts on Bitcoin — the future is being built right here. 🔧" },
    'consensus': { pose: 'think', text: "It looks like you're studying consensus! This is how thousands of nodes agree without a boss. Democracy at the protocol level. 🤝" },
    'difficulty-adjustment': { pose: 'brain', text: "It looks like you're learning about the difficulty adjustment! The most elegant part of Bitcoin's design, in my humble deer opinion. ⚙️" },
    'blockchain-timechain': { pose: 'fire', text: "It looks like you're reading about the timechain! Fun fact: many Bitcoiners prefer 'timechain' over 'blockchain.' ⛓️" },
    'pow-vs-pos': { pose: 'cool', text: "It looks like you're comparing PoW vs PoS! Spoiler: Proof of Work wins. Always has. 🏆" },
    'articles-threads': { pose: 'brain', text: "It looks like you're browsing articles! This channel has some of the best Bitcoin writing ever published. Take your time! 📰" },
    'books': { pose: 'love', text: "It looks like you're checking out Bitcoin books! The Bitcoin Standard changed my life. Well, my deer life. 📖" },
    'podcasts': { pose: 'cool', text: "It looks like you're browsing podcasts! Great for learning while you graze... I mean, commute. 🎧" },
    'movies-tv': { pose: 'celebrate', text: "It looks like you're looking at Bitcoin movies! Grab some popcorn (and cheese). 🍿🧀" },
    'one-stop-shop': { pose: 'point', text: "It looks like you're in the one-stop shop! This is the starter pack — everything a newcomer needs. 🎁" },
    'regulation': { pose: 'think', text: "It looks like you're reading about regulation! Governments are slowly figuring out they can't stop Bitcoin. 🏛️" },
    'nodes': { pose: 'fire', text: "It looks like you're learning about nodes! Running your own node = verifying everything yourself. Trust no one! 🖥️" },
    'geopolitics___macroeconomics': { pose: 'brain', text: "It looks like you're exploring the macro picture! Bitcoin isn't just money — it's a geopolitical shift. 🌍" },
    'jobs-earn': { pose: 'celebrate', text: "It looks like you're checking out Bitcoin jobs! Get paid in sats — the dream! 💼⚡" },
    'apps-tools-services-models': { pose: 'point', text: "It looks like you're browsing Bitcoin tools and apps! So many ways to use the network. 🛠️" },
    'music': { pose: 'celebrate', text: "It looks like you're checking Bitcoin music! Yes, there are Bitcoin songs. And yes, they slap. 🎵" },
    'art-inspiration': { pose: 'love', text: "It looks like you're browsing Bitcoin art! Creativity meets sound money. Beautiful. 🎨" },
    'games': { pose: 'cool', text: "It looks like you're checking out Bitcoin games! Learn while you play — my kind of strategy. 🎮" },
    'health': { pose: 'love', text: "It looks like you're in the health channel! Sound money, sound body, sound mind. 🏋️" },
    'nostr': { pose: 'fire', text: "It looks like you're exploring Nostr! Decentralized social media — Bitcoin's best friend. 💜" },
    'curriculum': { pose: 'brain', text: "It looks like you're looking at Bitcoin education materials! Perfect for teachers and students! 📝" },
    'misconceptions-fud': { pose: 'cool', text: "It looks like you're fighting FUD! Arm yourself with facts. This channel is your ammo. 🛡️" },
    'cryptography': { pose: 'brain', text: "It looks like you're diving into cryptography! This is the math that makes Bitcoin unbreakable. 🔢" },
    'tail-emission': { pose: 'think', text: "It looks like you're reading about tail emission! A big debate in the Bitcoin world. What do you think? 🤔" },
    'stablecoins': { pose: 'eyes', text: "It looks like you're reading about stablecoins! Useful on-ramps, but remember — Bitcoin is the exit. 🚪" },
};

// ---- Site Tips (teach users the whole site) ----
const TIPS = [
    // Navigation & Discovery
    { pose: 'point', text: "💡 Tip: The sidebar on the left has ALL channels organized by category. Tap a category to expand it!" },
    { pose: 'point', text: "💡 Tip: Click the 🎲 dice button to jump to a random channel — great for discovering new topics!" },
    { pose: 'point', text: "💡 Tip: Use the 🔍 search button to find any topic across all 146+ channels instantly!" },
    { pose: 'point', text: "💡 Tip: Click the Bitcoin logo at the top to return to the homepage anytime!" },
    // Favorites & Progress
    { pose: 'point', text: "💡 Tip: Hit the ⭐ button on any channel to save it to your favorites for quick access!" },
    { pose: 'point', text: "💡 Tip: Your Exploration Map on the homepage shows every channel you've visited. Try to light them all up! 🗺️" },
    { pose: 'point', text: "💡 Tip: Channels you've already read get a ✓ checkmark in the sidebar. Track your progress!" },
    // Points & Ranking
    { pose: 'brain', text: "💡 Tip: You earn points by visiting daily (+5), opening new channels (+10), and reading (+15 per 30 sec)!" },
    { pose: 'point', text: "💡 Tip: Check the leaderboard to see how you rank against other Bitcoiners! Click your rank bar at the bottom." },
    { pose: 'fire', text: "💡 Tip: Keep a daily streak going! Every 5 days in a row = bonus 100 points! 🔥" },
    { pose: 'point', text: "💡 Tip: There are 9 rank levels from Normie to Satoshi. What level are you? Check Settings → Data!" },
    // Tickets & Rewards
    { pose: 'cheese', text: "💡 Tip: Earn Orange Tickets daily just by logging in! More tickets = higher giveaway chances! 🎟️" },
    { pose: 'point', text: "💡 Tip: Share your referral link (Settings → Tickets) and earn 5 tickets for each verified friend!" },
    { pose: 'celebrate', text: "💡 Tip: Each Orange Ticket also gives you 5 bonus points! Tickets + points = double reward! 🎟️⭐" },
    // Quests & Scholar
    { pose: 'brain', text: "💡 Tip: Hit 'Start a Quest' in the sidebar to test your Bitcoin knowledge and earn points! ⚡" },
    { pose: 'fire', text: "💡 Tip: The Bitcoin Scholar Certification Quest is the ultimate test — pass it to earn the 🎓 badge + 300 points!" },
    // Badges
    { pose: 'eyes', text: "💡 Tip: There are 9 hidden badges to unlock! Each one awards points. Explore the site to discover them all! 🏅" },
    { pose: 'point', text: "💡 Tip: Badges scale in points from 25 to 1,000! The hardest ones are worth the most! 💰" },
    // Settings & Features
    { pose: 'point', text: "💡 Tip: Click your username or the sign-in button to access your Settings — Account, Tickets, Prefs, Security, Data!" },
    { pose: 'point', text: "💡 Tip: You can switch between dark and light theme in Settings → Prefs! 🌙☀️" },
    { pose: 'point', text: "💡 Tip: The site works offline too! Add it to your home screen as an app! 📱" },
    { pose: 'point', text: "💡 Tip: You can export all your data anytime in Settings → Data. Your data is yours! 📥" },
    { pose: 'point', text: "💡 Tip: Don't like me? Long-press to hide me. But I'll miss you. 🥺 (You can bring me back in Settings → Prefs)" },
    // Content
    { pose: 'brain', text: "💡 Tip: YouTube videos are embedded right in the channels — click to play without leaving the site! 🎬" },
    { pose: 'point', text: "💡 Tip: Tweets are embedded too! Click '▶ Click to display tweet' to expand them. 🐦" },
    { pose: 'point', text: "💡 Tip: The Quote of the Day on the homepage changes daily — click it to jump to the related channel! 💬" },
    { pose: 'point', text: "💡 Tip: New to Bitcoin? Start with the 'one-stop-shop' channel — it has everything to get you started! 🎯" },
    { pose: 'brain', text: "💡 Tip: Channels are organized into Properties, Experienced Topics, Resources, and Additional Info. Start with Properties!" },
];

// ---- Motivational ----
const MOTIVATION = [
    { pose: 'celebrate', text: "You're doing great, {name}! Most people never even start learning about Bitcoin. You're already ahead. 🦌💪" },
    { pose: 'fire', text: "Keep going, {name}! You're stacking knowledge like a true pleb! 📚🔥" },
    { pose: 'love', text: "Nacho is proud of your progress, {name}! You're further down the rabbit hole than most. 🐇" },
    { pose: 'cool', text: "Stay humble, stack sats, stack knowledge. You're doing all three, {name}. 😎" },
    { pose: 'celebrate', text: "Every channel you read makes the FUD weaker, {name}! Keep it up! 💪" },
    { pose: 'brain', text: "{name}, your brain is getting more orange-pilled by the minute! 🧠🟠" },
    { pose: 'fire', text: "Tick tock, next block... and you're getting smarter with each one, {name}! ⏰" },
    { pose: 'love', text: "The fact that you're here learning puts you ahead of 99% of people, {name}. For real. 🧡" },
    { pose: 'celebrate', text: "Imagine telling your future self you were learning about Bitcoin in 2026, {name}. They'll thank you! 🙏" },
    { pose: 'fire', text: "{name}, you're building generational knowledge right now. No big deal. 🏗️" },
    { pose: 'cool', text: "Diamond hands start with a diamond mind. You're forging yours right now, {name}! 💎🧠" },
    { pose: 'love', text: "The journey of a thousand sats begins with a single channel, {name}. You've read way more than that! 🦌" },
    { pose: 'celebrate', text: "You're not just learning Bitcoin, {name} — you're opting out of the broken system. Respect. ✊" },
    { pose: 'fire', text: "Number go up, knowledge go up. You're winning on both fronts, {name}! 📈🧠" },
    { pose: 'brain', text: "Every nocioner who ever became a maxi started exactly where you are, {name}. Keep reading! 📖" },
];

// ---- Fun / Jokes / Bitcoin Facts ----
const FUN = [
    // Nacho originals
    { pose: 'cheese', text: "Nacho keys, nacho cheese. It's not just a tagline, it's a lifestyle. 🧀🔑" },
    { pose: 'fire', text: "Nacho sats... They're all mine! 💰🦌" },
    { pose: 'cheese', text: "My seed phrase? 24 different types of cheese. Very secure. Very delicious. 🔐🧀" },
    { pose: 'cheese', text: "Bitcoin fixes everything. Except my cheese addiction. Some things are unfixable. 🧀" },
    { pose: 'cool', text: "Live Free or Die — that's the New Hampshire motto. Also my approach to Bitcoin. 🦌🗻" },
    { pose: 'fire', text: "These antlers aren't just for show. I'm the strongest buck in NH and the most orange-pilled. 💪🦌" },
    { pose: 'default', text: "In a world of unlimited printing, be a limited supply. Like Bitcoin. And like me — there's only one Nacho. 🦌" },
    { pose: 'default', text: "Some people have angel investors. You have an angel deer. You're welcome. 😇🦌" },
    { pose: 'cool', text: "I'm not saying I'm Satoshi, but have you ever seen us in the same room? 🤫" },
    { pose: 'eyes', text: "I've been watching you learn, {name}. Not in a creepy way. In a proud buck way. 👀" },
    { pose: 'sleep', text: "*yawns* Don't mind me, just HODLing this corner of your screen... 💤" },
    { pose: 'fire', text: "Few understand this... but YOU will, {name}. That's why you're here. 🔥" },
    // Bitcoin jokes
    { pose: 'think', text: "What's a deer's favorite block? The next one! ⛏️" },
    { pose: 'celebrate', text: "Why did Bitcoin break up with the dollar? It found someone with less baggage and a fixed supply! 💔😂" },
    { pose: 'cool', text: "I told my friend to buy Bitcoin in 2015. He bought Dogecoin instead. We don't talk anymore. 🐕" },
    { pose: 'think', text: "An altcoiner walks into a bar. Orders a round for everyone. Card declines. 😂" },
    { pose: 'cheese', text: "How does a Bitcoiner cut their pizza? Into 100 million slices. 🍕" },
    { pose: 'cool', text: "My financial advisor said diversify. So I have Bitcoin on a hardware wallet AND a paper backup. 😎" },
    { pose: 'celebrate', text: "Knock knock. Who's there? Fiat. Fiat who? Exactly. Nobody remembers it either. 🪦" },
    { pose: 'think', text: "What's the difference between a dollar and a Bitcoin? One goes to zero, the other came from zero. 📉📈" },
    { pose: 'default', text: "I tried to explain Bitcoin to a goldfish once. Went about as well as explaining it to Peter Schiff. 🐟" },
    { pose: 'cool', text: "Bitcoiners don't have FOMO. They have FONGO — Fear Of Not Getting Orange-pilled. 🟠" },
    // Bitcoin facts
    { pose: 'brain', text: "₿ Fact: Satoshi Nakamoto's identity is still unknown. Could be one person, could be a group. Could be a deer. 🦌" },
    { pose: 'brain', text: "₿ Fact: The Bitcoin pizza transaction in 2010 used 10,000 BTC for two pizzas. That's billions today. 🍕" },
    { pose: 'brain', text: "₿ Fact: There will only ever be 21 million Bitcoin. About 19.5 million have already been mined! 💎" },
    { pose: 'brain', text: "₿ Fact: Bitcoin's network has never been hacked. Not once. 13+ years of perfect security. 🔒" },
    { pose: 'brain', text: "₿ Fact: The smallest unit of Bitcoin is called a 'satoshi' — 0.00000001 BTC. You can own sats! ⚡" },
    { pose: 'brain', text: "₿ Fact: El Salvador was the first country to make Bitcoin legal tender in 2021! 🇸🇻" },
    { pose: 'brain', text: "₿ Fact: Bitcoin mining uses less energy than clothes dryers in the US. But nobody writes angry articles about dryers. 🧺" },
    { pose: 'brain', text: "₿ Fact: The Bitcoin whitepaper is only 9 pages long. The US tax code is over 75,000 pages. Which one works better? 📜" },
    { pose: 'brain', text: "₿ Fact: 'HODL' came from a typo in a passionate forum post in 2013. It became the most famous word in crypto. 😂" },
    { pose: 'brain', text: "₿ Fact: Bitcoin processes over $10 billion in transactions daily. And it never takes a day off! 💰" },
    { pose: 'brain', text: "₿ Fact: The genesis block contains a hidden message: 'Chancellor on brink of second bailout for banks.' 📰" },
    { pose: 'brain', text: "₿ Fact: You can run a full Bitcoin node on a Raspberry Pi for about $50. Be your own bank! 🖥️" },
    { pose: 'brain', text: "₿ Fact: Bitcoin's inflation rate is now lower than gold's. Digital gold? More like better-than-gold. 🥇" },
    { pose: 'brain', text: "₿ Fact: The Lightning Network can handle millions of transactions per second. Visa does about 1,700. ⚡" },
    { pose: 'brain', text: "₿ Fact: About 20% of all Bitcoin is estimated to be permanently lost. That makes yours even more scarce! 🔑" },
    // Bitcoin wisdom
    { pose: 'think', text: "\"The root problem with conventional currency is all the trust that's required to make it work.\" — Satoshi 🧠" },
    { pose: 'think', text: "\"Give me control of a nation's money and I care not who makes its laws.\" — Mayer Rothschild 🏦" },
    { pose: 'think', text: "\"We have elected to put our money and faith in a mathematical framework free of politics.\" — Tyler Winklevoss 🔢" },
    { pose: 'think', text: "\"Bitcoin is the most important invention since the internet.\" 🌐" },
    { pose: 'fire', text: "\"Fix the money, fix the world.\" Simple as that. 🔧🌍" },
    { pose: 'think', text: "\"Bitcoin is a swarm of cyber hornets serving the goddess of wisdom.\" — Michael Saylor 🐝" },
    { pose: 'cool', text: "\"Running Bitcoin.\" — Hal Finney, January 10, 2009. The first tweet about Bitcoin. 🏃" },
    // Nacho personality
    { pose: 'celebrate', text: "HODL your knowledge. Never sell what you've learned! 💎🙌" },
    { pose: 'think', text: "Roses are red, fiat is dead, stack sats instead! 🌹" },
    { pose: 'cool', text: "I've been orange-pilled since the day I grew these antlers. 🟠🦌" },
    { pose: 'celebrate', text: "What's stronger — my antlers or Bitcoin's security? Trick question. Both unbreakable. 💪🔒" },
    { pose: 'default', text: "The deer in New Hampshire are talking about Bitcoin. Okay, it's just me. But still. 🗻🦌" },
    { pose: 'cheese', text: "If I had a satoshi for every time someone asked me about crypto... I'd tell them it's Bitcoin, not crypto. 🧀" },
    { pose: 'cool', text: "My antlers pick up the Bitcoin network signal. That's not true, but it sounds cool. 📡🦌" },
    { pose: 'fire', text: "They said Bitcoin was dead 477 times, {name}. And here we are. Still stacking. 🦌💪" },
    { pose: 'eyes', text: "The forest is full of distractions. I stick to the trail marked ₿. 🌲" },
    { pose: 'celebrate', text: "When in doubt, zoom out, {name}. That goes for the chart AND the rabbit hole. 🔭" },
];

// ---- Welcome Messages ----
const WELCOME = [
    { pose: 'wave', text: "👋 Hey, {name}! I'm Nacho — a strong buck from New Hampshire! Click me anytime for Bitcoin tips and wisdom. 🦌💪" },
    { pose: 'wave', text: "👋 Welcome back, {name}! Your friendly NH buck missed you! Ready to tackle some Bitcoin knowledge today? 💪" },
    { pose: 'wave', text: "👋 {name}! Nacho here — the strongest buck in New Hampshire and your Bitcoin guide! Let's learn something! 🦌" },
];

// ---- Channel Reactions ----
const CHANNEL_REACT = [
    { pose: 'eyes', text: "Great choice, {name}! I'll be over here if you need me. 👀" },
    { pose: 'cool', text: "Ooh, excellent pick, {name}! You've got good taste. 😎" },
    { pose: 'brain', text: "This one's a good read, {name}! Take your time. 🧠" },
    { pose: 'fire', text: "One of my favorites! Dig in, {name}! 🦌🔥" },
    { pose: 'love', text: "Nice, {name}! This channel has great stuff in it. 🧡" },
];

// ---- Milestone Reactions ----
const MILESTONES = [
    { pose: 'celebrate', text: "Nice, {name}! Points are stacking up! 🎉" },
    { pose: 'fire', text: "{name}, you're on fire! Nacho approves! 🔥" },
    { pose: 'celebrate', text: "Cha-ching, {name}! The knowledge is paying off! 💰" },
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
            bottom: 80px;
            left: 330px;
            z-index: 250;
            display: flex;
            align-items: flex-end;
            gap: 0;
            pointer-events: none;
            transition: opacity 0.3s, transform 0.3s;
        }
        #nacho-container.hidden { opacity: 0; transform: translateY(30px); pointer-events: none; }

        #nacho-avatar {
            width: 110px;
            height: 110px;
            background: none;
            border-radius: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            pointer-events: auto;
            filter: drop-shadow(0 6px 16px rgba(0,0,0,0.5));
            transition: transform 0.15s;
            user-select: none;
            position: relative;
            flex-shrink: 0;
            z-index: 2;
        }
        #nacho-avatar:hover { transform: scale(1.08) rotate(-3deg); }
        #nacho-avatar:active { transform: scale(0.93); }
        #nacho-avatar .nacho-name {
            position: absolute;
            bottom: -24px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 0.7rem;
            color: #f7931a;
            font-weight: 800;
            letter-spacing: 1.5px;
            white-space: nowrap;
            text-transform: uppercase;
            text-shadow: 0 1px 4px rgba(0,0,0,0.5);
            line-height: 1.3;
            text-align: center;
        }

        /* Clippy-style speech bubble */
        #nacho-bubble {
            background: var(--card-bg, #1a1a2e);
            border: 1px solid var(--border, #333);
            border-radius: 16px;
            padding: 16px 20px 16px 18px;
            max-width: 300px;
            min-width: 200px;
            color: var(--text, #e0e0e0);
            font-size: 0.9rem;
            line-height: 1.55;
            pointer-events: auto;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
            opacity: 0;
            transform: translateY(8px) scale(0.9);
            transition: opacity 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
            cursor: pointer;
            position: relative;
            margin-left: -6px;
            margin-bottom: 16px;
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

        /* Tablet — sidebar is 280px */
        @media (max-width: 1100px) {
            #nacho-container { left: 290px; }
            #nacho-avatar { width: 95px; height: 95px; }
        }
        /* Mobile — sidebar hidden, Nacho goes bottom-left */
        @media (max-width: 900px) {
            #nacho-container { bottom: 110px; left: 12px; }
            #nacho-avatar { width: 80px; height: 80px; }
            #nacho-bubble { max-width: 240px; min-width: 160px; font-size: 0.85rem; padding: 14px 16px; }
            #nacho-avatar .nacho-name { font-size: 0.75rem; bottom: -26px; }
        }
        @media (max-width: 480px) {
            #nacho-container { bottom: 100px; left: 8px; }
            #nacho-avatar { width: 72px; height: 72px; }
            #nacho-bubble { max-width: 210px; }
            #nacho-avatar .nacho-name { font-size: 0.7rem; bottom: -24px; }
        }

        /* Bring-back toggle */
        #nacho-toggle {
            position: fixed; bottom: 80px; left: 330px; z-index: 250;
            width: 36px; height: 36px;
            background: var(--card-bg, #1a1a2e); border: 1px solid var(--border, #333);
            border-radius: 50%; display: none; align-items: center; justify-content: center;
            font-size: 1rem; cursor: pointer; opacity: 0.3; transition: opacity 0.2s;
        }
        #nacho-toggle:hover { opacity: 1; }
        @media (max-width: 1100px) { #nacho-toggle { left: 290px; } }
        @media (max-width: 900px) { #nacho-toggle { bottom: 110px; left: 12px; } }
        @media (max-width: 480px) { #nacho-toggle { bottom: 100px; left: 8px; } }
    `;
    document.head.appendChild(style);

    const container = document.createElement('div');
    container.id = 'nacho-container';
    if (!nachoVisible) container.classList.add('hidden');
    container.innerHTML =
        '<div id="nacho-avatar" class="anim-tap" onclick="nachoClick()" title="Nacho the Deer — Click me!">' +
            NACHO_SVG +
            '<span class="nacho-name">Nacho<br><span style="font-size:0.6rem;opacity:0.8;letter-spacing:0.5px;">click to ask!</span></span>' +
        '</div>' +
        '<div id="nacho-bubble" onclick="hideBubble()">' +
            '<div class="nacho-header">' +
                '<span class="nacho-label"><span id="nacho-pose-emoji">🦌</span> Nacho says</span>' +
                '<span class="nacho-x" onclick="event.stopPropagation();hideBubble()">✕</span>' +
            '</div>' +
            '<div id="nacho-text"></div>' +
        '</div>';
    document.body.appendChild(container);

    const toggle = document.createElement('div');
    toggle.id = 'nacho-toggle';
    toggle.innerHTML = '🦌';
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
    currentPose = pose || 'default';
    const emoji = document.getElementById('nacho-pose-emoji');
    if (emoji) emoji.textContent = POSES[currentPose] || POSES.default;
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

    textEl.textContent = personalize(text);
    bubble.classList.add('show');

    clearTimeout(bubbleTimeout);
    bubbleTimeout = setTimeout(hideBubble, BUBBLE_DURATION);
}

window.hideBubble = function() {
    // Mark interaction for badge
    localStorage.setItem('btc_nacho_clicked', 'true');
    if (typeof checkHiddenBadges === 'function') checkHiddenBadges();
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
let nachoClickCount = 0;
window.nachoClick = function() {
    const now = Date.now();
    if (now - lastClickTime < CLICK_COOLDOWN) return;
    lastClickTime = now;

    // Mark interaction for badge
    localStorage.setItem('btc_nacho_clicked', 'true');
    if (typeof checkHiddenBadges === 'function') checkHiddenBadges();

    const bubble = document.getElementById('nacho-bubble');
    if (bubble && bubble.classList.contains('show')) {
        hideBubble();
        return;
    }

    nachoClickCount++;

    // Every 3rd click opens the Ask Nacho input
    if (nachoClickCount % 3 === 0 && typeof showNachoInput === 'function') {
        showNachoInput();
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
    forceShowBubble(personalize("I'm back, {name}! Miss me? 🦌"));
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
        forceShowBubble(personalize("{name}, you CRUSHED that quest! This buck is VERY impressed! 🦌🎉🔥"));
    } else {
        setPose('love');
        forceShowBubble(personalize("Hey {name}, some questions are hard! Read up and try again — Nacho believes in you! 🦌💪"));
    }
};

// ---- Context-Aware: Search ----
window.nachoOnSearch = function() {
    if (!nachoVisible || Math.random() > 0.3) return;
    showBubble("Looking for something? I'd help search but I don't have thumbs. Good luck! 🔍🦌", 'think');
};

// ---- Context-Aware: Scroll to bottom of channel ----
window.nachoOnFinishChannel = function() {
    if (!nachoVisible || Math.random() > 0.3) return;
    const msgs = [
        { pose: 'celebrate', text: "You read the whole thing! Dedicated. I respect that. 🦌👏" },
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
function nachoUserName() {
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.username) return currentUser.username;
    return '';
}

// Inject username into message text — replaces {name} placeholder
function personalize(text) {
    var name = nachoUserName();
    if (!name) {
        // Remove {name} and surrounding commas/spaces cleanly
        text = text.replace(/,?\s*\{name\}\s*,?\s*/g, function(match) {
            // If both commas existed (e.g. ", {name},"), collapse to single comma+space
            if (match.indexOf(',') === 0 && match.lastIndexOf(',') > 0) return ', ';
            return match.charAt(0) === ',' ? ' ' : '';
        });
        // Clean up any double spaces or leading commas
        text = text.replace(/  +/g, ' ').replace(/^ ,/, '').replace(/, ,/g, ',').trim();
        return text;
    }
    return text.replace(/\{name\}/g, name);
}

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ---- Long-press to hide ----
let lp = null;
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        const av = document.getElementById('nacho-avatar');
        if (!av) return;
        function startLP() { lp = setTimeout(function() { hideNacho(); if (typeof showToast === 'function') showToast('🦌 Nacho is hiding. Click the small 🦌 to bring him back!'); }, 1500); }
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
