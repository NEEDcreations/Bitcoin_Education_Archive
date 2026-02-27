// © 2024-2026 603BTC LLC. All rights reserved.
// This code is proprietary. See LICENSE file. Do not copy or redistribute.
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
    // Whitepaper nudge
    { pose: 'brain', text: "📜 Have you read Bitcoin's Whitepaper? It's only 9 pages and it started a revolution! <span onclick=\"go('whitepaper')\" style=\"color:var(--accent);cursor:pointer;text-decoration:underline;\">Read it here →</span> 🦌" },
    { pose: 'fire', text: "🔥 Pro tip: Read the Bitcoin Whitepaper — it's the Genesis document! Only 9 pages changed the world forever. <span onclick=\"go('whitepaper')\" style=\"color:var(--accent);cursor:pointer;text-decoration:underline;\">Check it out →</span>" },
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
    { pose: 'point', text: "💡 Tip: Share your referral link (Settings → Tickets) and earn 50 tickets for each verified friend!" },
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
    // Forum & Marketplace
    { pose: 'point', text: "💡 Tip: Post in the PlebTalk to earn the 📣 Town Crier badge + 100 points! Press F or find it in the sidebar." },
    { pose: 'point', text: "💡 Tip: Reply to PlebTalk posts to earn the 💬 Conversationalist badge + 75 points! Join the discussion!" },
    { pose: 'cheese', text: "💡 Tip: LightningMart lets you buy and sell with Bitcoin! List an item to earn the 🏪 Merchant badge! Press M to check it out." },
    { pose: 'point', text: "💡 Tip: Found something cool on LightningMart? Contact the seller to earn the 🛍️ Shopper badge!" },
    // Closet
    { pose: 'celebrate', text: "💡 Tip: Check out my closet in Settings → Nacho! You can dress me up with items you unlock! 🎽🦌" },
    { pose: 'point', text: "💡 Tip: Closet items are colorable! Equip an item, then tap 🎨 Color to customize it! 🌈" },
    // Daily Spin
    { pose: 'fire', text: "💡 Tip: Spin the Daily Wheel every day for free Orange Tickets! Look for the banner at the top of the homepage! 🎡" },
    // Nacho Mode
    { pose: 'fire', text: "💡 Tip: Press N to enter Nacho Mode — a full chat experience where I answer your Bitcoin questions with AI! 🦌🧠" },
    { pose: 'point', text: "💡 Tip: In Nacho Mode, press ↑ to recall your previous questions — just like in a chat app!" },
    { pose: 'brain', text: "💡 Tip: Nacho Mode shows the live Bitcoin price in the header! Check it anytime! ₿" },
    { pose: 'point', text: "💡 Tip: Tap the 🧒 button in Nacho Mode to toggle ELI5 mode — I'll explain everything in super simple language!" },
    { pose: 'celebrate', text: "💡 Tip: In Nacho Mode, tap '🗺️ Start Bitcoin Journey' for a guided 10-step learning path from beginner to pro!" },
    { pose: 'point', text: "💡 Tip: Tap '🎮 Quiz Me' in Nacho Mode to test your knowledge and earn points! 🏆" },
    { pose: 'point', text: "💡 Tip: Nacho Mode has topic chips — tap them if you don't know what to ask! ⚡ Lightning, ⛏️ Mining, and more!" },
    { pose: 'brain', text: "💡 Tip: Every answer in Nacho Mode has 👍👎 buttons — your feedback helps me get smarter!" },
    { pose: 'point', text: "💡 Tip: You can share any Nacho answer with the 📤 Share button — spread the Bitcoin knowledge! 🌍" },
    { pose: 'fire', text: "💡 Tip: Use your voice! Tap 🎙️ in Nacho Mode to ask me questions by speaking! 🗣️" },
    { pose: 'point', text: "💡 Tip: Nacho Mode saves your full chat history — come back anytime to pick up where you left off!" },
    { pose: 'celebrate', text: "💡 Tip: Ask me 10, 25, 50, or 100 questions in Nacho Mode to unlock special milestones! 🎉" },
    // Forum
    { pose: 'fire', text: "💡 Tip: We have a PlebTalk! Press F or click '🗣️ PlebTalk' in the sidebar to discuss Bitcoin! 💬" },
    { pose: 'point', text: "💡 Tip: In PlebTalk, upvote great posts with ⚡ and earn +10 points for posting, +5 for replying!" },
    { pose: 'brain', text: "💡 Tip: PlebTalk posts can include links! Share interesting Bitcoin articles or resources with the community! 🔗" },
    // Profiles
    { pose: 'point', text: "💡 Tip: Set up your profile in Settings → Account! Add a bio, website, Twitter, Nostr, and Lightning address! 📝" },
    { pose: 'eyes', text: "💡 Tip: Click any user on the leaderboard to see their profile — including their bio and social links! 👀" },
    // Scholar
    { pose: 'fire', text: "💡 Tip: The Scholar Certification awards 2,100 points — that's 21 million in sats! The magic number! 🎓" },
    // Nacho Closet
    { pose: 'cheese', text: "💡 Tip: Dress me up! Check out Nacho's Closet in Settings → Stats/Nacho. Unlock items as our friendship grows! 👔🦌" },
    { pose: 'cool', text: "💡 Tip: I wear my closet items in Nacho Mode too! Equip something and check out my hero section! 🦸" },
    // Keyboard shortcuts
    { pose: 'point', text: "💡 Tip: Press ? to see ALL keyboard shortcuts! N=Nacho, F=PlebTalk, D=Donate, L=Leaderboard, and more! ⌨️" },
    { pose: 'point', text: "💡 Tip: Press A to quickly ask me a question from any page — no need to enter Nacho Mode! 🦌" },
    // Nostr
    { pose: 'cool', text: "💡 Tip: You can sign in with Nostr! If you have Alby or nos2x, click the 🟣 Nostr button on the sign-in page! ⚡" },
    // Donate
    { pose: 'love', text: "💡 Tip: Press D to open the donation page — support the archive with Lightning! Every sat counts! ⚡🧡" },
    // Language
    { pose: 'point', text: "💡 Tip: The site supports 15+ languages! Change it in Settings → Prefs. I can even answer in your language! 🌍" },
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
    // Deep KB facts
    { pose: 'brain', text: "₿ Fact: Bitcoin's first price was $0.000994 — less than a tenth of a penny! For 10 months it had NO price at all. 💰" },
    { pose: 'brain', text: "₿ Fact: The chance of guessing someone's private key is the same as winning Powerball 7 times in a row! 🎰🔐" },
    { pose: 'brain', text: "₿ Fact: The first Bitcoin faucet gave away 5 WHOLE BITCOINS per person just for solving a captcha! 🤯" },
    { pose: 'brain', text: "₿ Fact: You only need the FIRST 4 LETTERS of each seed word to restore your wallet. All 2,048 BIP39 words have unique first 4 letters! 🔑" },
    { pose: 'brain', text: "₿ Fact: 'Bacon' repeated 24 times is technically a valid Bitcoin seed phrase. It passes the checksum! 🥓" },
    { pose: 'brain', text: "₿ Fact: Bitcoin has 99.987% uptime — only 14 hours of downtime in 15+ years. That rivals Google and Amazon! 🏆" },
    { pose: 'brain', text: "₿ Fact: Satoshi's birthday (April 5) is the date of Executive Order 6102, when the US made it ILLEGAL to own gold! 🎂📜" },
    { pose: 'brain', text: "₿ Fact: The difficulty adjustment happens every 2,016 blocks. Read that backwards: 6102 — the gold confiscation order! 🤯" },
    { pose: 'brain', text: "₿ Fact: 2-3 million Bitcoin are permanently lost forever. That makes YOUR sats even more scarce! 💎" },
    { pose: 'brain', text: "₿ Fact: Satoshi wrote 575 forum posts, 31,000 lines of code, used 22,000+ addresses, and never reused one! 📝" },
    { pose: 'brain', text: "₿ Fact: Satoshi's ~1 million Bitcoin have NEVER moved. Not one satoshi. Worth tens of billions. 👑" },
    { pose: 'brain', text: "₿ Fact: 70% of ALL US dollars in circulation were created after 2008. Over 40% since 2020 alone! 💸" },
    { pose: 'brain', text: "₿ Fact: One dollar today buys what 4 CENTS bought in 1913. That's a 96% loss in purchasing power! 📉" },
    { pose: 'brain', text: "₿ Fact: In August 2010, a bug created 184 BILLION fake Bitcoin. The community fixed it in hours! The largest reorg ever — 53 blocks. 😱" },
    { pose: 'brain', text: "₿ Fact: 61% of Ethereum nodes run in the cloud. Amazon alone hosts ~25% of them. Bitcoin nodes run on Raspberry Pis worldwide! ☁️🆚🖥️" },
    { pose: 'brain', text: "₿ Fact: Milton Friedman, Nobel Prize economist, predicted Bitcoin in 1999 — 10 years before it existed! 🔮" },
    { pose: 'brain', text: "₿ Fact: The Bitcoin whitepaper is encoded IN the blockchain at block 230,009. It will exist as long as Bitcoin does! 📄⛓️" },
    { pose: 'brain', text: "₿ Fact: In July 2024, a tiny Bitaxe miner with just 3 TH/s found a block — a 1-in-3,500 YEAR chance! ⛏️🎯" },
    { pose: 'brain', text: "₿ Fact: 99% of all Bitcoin will be mined by 2035. The very last fraction won't be mined until ~2140! ⏳" },
    { pose: 'brain', text: "₿ Fact: The original Bitcoin code contained the beginnings of a POKER GAME that Satoshi started but never finished! 🃏" },
    { pose: 'brain', text: "₿ Fact: Only 0.06% of Bitcoin Core's code remains unchanged from what Satoshi originally wrote. Open source at its finest! 💻" },
    { pose: 'brain', text: "₿ Fact: Christmas lights in the US alone consume more energy than the entire Bitcoin network! 🎄⚡" },
    { pose: 'brain', text: "₿ Fact: Bitcoin mining captures methane that's 84x more warming than CO2, turning waste into sound money! 🌱" },
    { pose: 'brain', text: "₿ Fact: NO ONE who bought Bitcoin and held for 4+ years has EVER lost money. Not once in 15+ years! 📈 (NFA)" },
    { pose: 'brain', text: "₿ Fact: Michael Saylor said The Bitcoin Standard was 'the most impactful on our way of thinking at MicroStrategy.' 📚" },
    { pose: 'brain', text: "₿ Fact: Gigi calls Bitcoin 'an inexhaustible teacher.' His 21 Lessons is free at 21lessons.com! 📖🧡" },
    { pose: 'brain', text: "₿ Fact: Tomer Strolight says Satoshi's coins aren't the real treasure. The real treasure is the journey Bitcoin sends you on! 👑" },
    { pose: 'brain', text: "₿ Fact: Bitcoin is to money what zero was to mathematics — the missing piece that makes everything work better! 🔢" },
    { pose: 'brain', text: "₿ Fact: Every aspect of Bitcoin is TEXT — and text is speech, protected by the First Amendment! You can't ban math. 🗽" },
    { pose: 'brain', text: "₿ Fact: Only about 2-4% of the world owns any Bitcoin. If you hold sats, you're still incredibly early! 🌍" },
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

    // ---- Deer/Bitcoin Puns ----
    { pose: 'cool', text: "Oh deer, another all-time high? I'm not surprised. 🦌📈" },
    { pose: 'cheese', text: "What do you call a deer who loves Bitcoin? A buck-hodler! 🦌💎" },
    { pose: 'celebrate', text: "I'm fawned of Bitcoin. Get it? ...I'll see myself out. 🦌😂" },
    { pose: 'think', text: "People say Bitcoin is hard to understand. I say it's deer-ly obvious! 🦌💡" },
    { pose: 'cool', text: "I don't always check the charts, but when I doe, I HODL. 🦌😎" },
    { pose: 'fire', text: "Just earned some sats! Another buck in the wallet! 💰🦌" },
    { pose: 'cheese', text: "Why do deer make great Bitcoiners? Because we never sell — we just stag-ger through the dips! 🦌📉📈" },
    { pose: 'celebrate', text: "This site really helps you get to the hart of Bitcoin! ...Sorry, deer puns are my specialty. 🦌❤️" },
    { pose: 'think', text: "Fiat currency is on its last legs. Lucky for me, I have four of them! 🦌🏃" },
    { pose: 'cool', text: "Did you hear about the deer who understood Bitcoin? He was considered a doe-cipherpunk! 🦌🛡️" },
    { pose: 'fire', text: "Some say the Bitcoin market is wild. Well, I AM a wild animal, so I fit right in! 🦌🔥" },
    { pose: 'cheese', text: "I tried mining Bitcoin with my hooves. It was un-fawn-tunately not very efficient. ⛏️🦌" },
    { pose: 'celebrate', text: "What's a deer's favorite cryptocurrency? Bit-coin, because we love our bits of grass too! 🌿🦌" },
    { pose: 'think', text: "My financial advice? Be a deer and HODL. That's not real advice though, I'm literally a deer. 🦌📜" },
    { pose: 'cool', text: "They call me a stag-ger-ing intellect when it comes to Bitcoin. Okay, I call myself that. 🦌🧠" },
];

// ---- Welcome Messages ----
const WELCOME = [
    { pose: 'wave', text: "👋 Hey, {name}! I'm Nacho — a strong buck from New Hampshire! Click me anytime for Bitcoin tips and wisdom. 🦌💪" },
    { pose: 'wave', text: "👋 Welcome back, {name}! Your friendly NH buck missed you! Ready to tackle some Bitcoin knowledge today? 💪" },
    { pose: 'wave', text: "👋 Nacho here{name}! The strongest buck in New Hampshire and your Bitcoin guide. Let's learn something! 🦌" },
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
window.clearNachoBubbleTimeout = function() { clearTimeout(bubbleTimeout); bubbleTimeout = null; };
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
        #nacho-avatar .nacho-closet-btn {
            position: absolute;
            top: -5px;
            right: -35px;
            font-size: 0.85rem;
            cursor: pointer;
            pointer-events: auto;
            background: var(--card-bg, #1a1a2e);
            border: 1px solid var(--border, #333);
            border-radius: 50%;
            width: 26px;
            height: 26px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: 0.2s;
            opacity: 0.5;
            z-index: 5;
        }
        #nacho-avatar .nacho-closet-btn:hover {
            opacity: 1;
            transform: scale(1.15);
            border-color: #f7931a;
        }
        #nacho-avatar .nacho-name {
            position: absolute;
            bottom: -30px;
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
            pointer-events: auto;
            cursor: pointer;
            padding: 4px 12px;
            border-radius: 8px;
            transition: background 0.2s;
        }
        #nacho-avatar .nacho-name:hover {
            background: rgba(247,147,26,0.15);
        }

        /* Nacho speech bubble — high contrast, always readable */
        #nacho-bubble {
            background: #111827;
            border: 2px solid #f7931a;
            border-radius: 16px;
            padding: 16px 20px 16px 18px;
            max-width: 300px;
            min-width: 200px;
            color: #f8f8f8;
            font-size: 0.9rem;
            line-height: 1.55;
            pointer-events: none;
            box-shadow: 0 8px 32px rgba(0,0,0,0.7), 0 0 12px rgba(247,147,26,0.25);
            opacity: 0;
            transform: translateY(8px) scale(0.9);
            transition: opacity 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
            cursor: pointer;
            position: relative;
            margin-left: -6px;
            margin-bottom: 16px;
            z-index: 1000;
        }
        #nacho-bubble::before {
            content: '';
            position: absolute;
            bottom: 10px;
            left: -10px;
            width: 0; height: 0;
            border-top: 10px solid transparent;
            border-bottom: 10px solid transparent;
            border-right: 10px solid #f7931a;
        }
        #nacho-bubble::after {
            content: '';
            position: absolute;
            bottom: 12px;
            left: -7px;
            width: 0; height: 0;
            border-top: 8px solid transparent;
            border-bottom: 8px solid transparent;
            border-right: 8px solid #111827;
        }
        #nacho-bubble.show { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }

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
        /* Nacho victory flight — Lightning bolt ⚡ across the full screen! */
        @keyframes nachoFly {
            /*  ⚡ Lightning bolt: high-energy erratic takeoff, zigzag, and sonic boom reentry 
            */
            0%   { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; }
            5%   { transform: translate(-5px, 10px) rotate(-10deg) scale(0.9); }
            10%  { transform: translate(15vw, -20vh) rotate(20deg) scale(1.1); }
            20%  { transform: translate(40vw, -5vh) rotate(-15deg) scale(1); }
            30%  { transform: translate(65vw, -45vh) rotate(35deg) scale(1.2); }
            45%  { transform: translate(90vw, -10vh) rotate(-20deg) scale(1.1); }
            60%  { transform: translate(110vw, -60vh) rotate(45deg) scale(1.4); opacity: 1; }
            61%  { transform: translate(110vw, -60vh); opacity: 0; }
            /* Sonic boom reentry from the top left */
            85%  { transform: translate(-50vw, -50vh) rotate(-45deg) scale(2); opacity: 0; }
            90%  { transform: translate(-10vw, -10vh) rotate(-20deg) scale(1.5); opacity: 1; filter: brightness(3) blur(2px); }
            95%  { transform: translate(0, -20px) rotate(0deg) scale(1.1); filter: brightness(1); }
            100% { transform: translate(0, 0) scale(1); opacity: 1; }
        }
        @keyframes nachoFlyMobile {
            0%   { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; }
            8%   { transform: translate(-2vw, 5vh) rotate(-10deg) scale(0.9); }
            15%  { transform: translate(25vw, -30vh) rotate(15deg) scale(1.1); }
            30%  { transform: translate(60vw, -5vh) rotate(-15deg) scale(1); }
            50%  { transform: translate(85vw, -50vh) rotate(30deg) scale(1.3); }
            65%  { transform: translate(105vw, -20vh) rotate(10deg) scale(1.2); opacity: 1; }
            66%  { transform: translate(105vw, -20vh); opacity: 0; }
            /* Reentry from top */
            88%  { transform: translate(0, -80vh) rotate(0deg) scale(1.5); opacity: 0; }
            94%  { transform: translate(0, -10px) rotate(0deg) scale(1.1); opacity: 1; filter: brightness(2); }
            100% { transform: translate(0, 0) scale(1); opacity: 1; }
        }
        #nacho-avatar.flying {
            animation: nachoFly 2.8s linear forwards;
            z-index: 999;
            filter: drop-shadow(0 0 20px rgba(247,147,26,0.8)) drop-shadow(0 0 40px rgba(234,88,12,0.4));
        }
        @media (max-width: 900px) {
            #nacho-avatar.flying {
                animation: nachoFlyMobile 2.4s linear forwards;
            }
        }
        /* Lightning trail particles */
        .nacho-trail {
            position: fixed;
            pointer-events: none;
            z-index: 998;
            font-size: 1.2rem;
            opacity: 1;
            transition: none;
            animation: nachoTrailFade 0.8s ease-out forwards;
        }
        @keyframes nachoTrailFade {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.3); }
            100% { opacity: 0; transform: scale(0.3); }
        }

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
            #nacho-container { bottom: 160px; left: 16px; }
            #nacho-avatar { width: 80px; height: 80px; }
            #nacho-bubble {
                position: fixed;
                bottom: 250px;
                left: 12px;
                right: 12px;
                max-width: calc(100vw - 24px);
                max-height: calc(100vh - 290px);
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
                min-width: unset;
                width: auto;
                font-size: 0.9rem;
                padding: 16px 18px;
                margin-left: 0;
                border-radius: 14px;
            }
            #nacho-bubble::before, #nacho-bubble::after { display: none; }
            #nacho-avatar .nacho-name { font-size: 0.75rem; bottom: -32px; padding: 6px 16px; }
        }
        @media (max-width: 480px) {
            #nacho-container { bottom: 150px; left: 12px; }
            #nacho-avatar { width: 72px; height: 72px; }
            #nacho-bubble {
                bottom: 185px;
                left: 10px;
                right: 10px;
                max-width: calc(100vw - 20px);
                max-height: calc(100vh - 240px);
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
                font-size: 0.85rem;
                padding: 14px 16px;
            }
            #nacho-avatar .nacho-name { font-size: 0.7rem; bottom: -30px; padding: 6px 14px; }
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
        @media (max-width: 900px) { #nacho-toggle { bottom: 160px; left: 16px; } }
        @media (max-width: 480px) { #nacho-toggle { bottom: 150px; left: 12px; } }
    `;
    document.head.appendChild(style);

    const container = document.createElement('div');
    container.id = 'nacho-container';
    if (!nachoVisible) container.classList.add('hidden');
    container.innerHTML =
        '<div id="nacho-avatar" class="anim-tap" onclick="nachoClick()" title="Nacho the Deer — Click me!">' +
            NACHO_SVG +
            '<span class="nacho-name" onmousedown="event.stopPropagation();" ontouchstart="event.stopPropagation();" onclick="event.stopPropagation();if(typeof showNachoInput===\'function\')showNachoInput();">Nacho<br><span style="font-size:0.6rem;opacity:0.8;letter-spacing:0.5px;">click to ask!</span></span>' +
            '<span class="nacho-closet-btn" id="nachoClosetBtn" title="Nacho\'s Closet — dress me up!">👔</span>' +
        '</div>' +
        '<div id="nacho-bubble" onclick="if(!document.getElementById(\'nachoInput\')&&this.getAttribute(\'data-interactive\')!==\'true\')hideBubble(true)">' +
            '<div class="nacho-header">' +
                '<span class="nacho-label"><span id="nacho-pose-emoji">🦌</span> <span id="nacho-bubble-name">' + ((typeof nachoNickname === 'function') ? nachoNickname() : 'Nacho') + '</span> says</span>' +
                '<span class="nacho-x" onclick="event.stopPropagation();hideBubble(true)">✕</span>' +
            '</div>' +
            '<div id="nacho-text"></div>' +
        '</div>';
    document.body.appendChild(container);

    // Closet button — use addEventListener to fully control event propagation
    // Inline handlers fail on mobile because touchend propagates to avatar → nachoClick()
    var closetBtn = document.getElementById('nachoClosetBtn');
    if (closetBtn) {
        var closetTouched = false;
        closetBtn.addEventListener('mousedown', function(e) { e.stopPropagation(); e.stopImmediatePropagation(); }, false);
        closetBtn.addEventListener('touchstart', function(e) { e.stopPropagation(); e.stopImmediatePropagation(); closetTouched = true; }, { passive: false });
        closetBtn.addEventListener('touchend', function(e) {
            e.stopPropagation(); e.stopImmediatePropagation(); e.preventDefault();
            if (closetTouched) {
                closetTouched = false;
                try { if (typeof showSettingsPage === 'function') showSettingsPage('data'); } catch(err) {}
            }
        }, { passive: false });
        closetBtn.addEventListener('click', function(e) {
            e.stopPropagation(); e.stopImmediatePropagation();
            if (!closetTouched) { // Only fire on non-touch (mouse) clicks
                try { if (typeof showSettingsPage === 'function') showSettingsPage('data'); } catch(err) {}
            }
            closetTouched = false;
        }, false);
    }

    const toggle = document.createElement('div');
    toggle.id = 'nacho-toggle';
    toggle.innerHTML = '🦌';
    toggle.title = 'Bring back Nacho';
    toggle.onclick = function() { showNacho(); };
    if (!nachoVisible) toggle.style.display = 'flex';
    document.body.appendChild(toggle);

    // Welcome after delay — use time-of-day greeting or regular welcome
    setTimeout(function() {
        if (!nachoVisible) return;
        var msg;
        if (typeof nachoTimeGreeting === 'function' && Math.random() < 0.6) {
            msg = nachoTimeGreeting();
        } else {
            msg = pickRandom(WELCOME);
        }
        setPose(msg.pose);
        forceShowBubble(msg.text);
        if (typeof nachoPlaySound === 'function') nachoPlaySound('pop');

        // Show streak message shortly after welcome
        setTimeout(function() {
            if (typeof nachoStreakMessage === 'function') {
                var streak = nachoStreakMessage();
                if (streak) showBubble(streak.text, streak.pose);
            }
        }, 12000);
    }, 2000);

    // Start idle animation cycling
    startIdleCycle();

    // Periodic messages
    setInterval(periodicMessage, 55000);

    // Ambient "Alive" Animation (blinking/ear wiggle)
    setInterval(function() {
        if (!nachoVisible || (bubble && bubble.classList.contains('show'))) return;
        const rand = Math.random();
        if (rand < 0.3) {
            setPose('wave'); // Blink equivalent
            setTimeout(() => setPose('neutral'), 400);
        } else if (rand < 0.6) {
            const avatar = document.getElementById('nacho-avatar');
            if (avatar) {
                avatar.style.transform = 'scale(1.1) rotate(5deg)';
                setTimeout(() => avatar.style.transform = '', 500);
            }
        }
    }, 20000);

    // Occasional trivia pop-ups (every 3 minutes, 20% chance)
    setInterval(function() {
        if (!nachoVisible || sessionMsgCount >= MAX_SESSION_MSGS) return;
        if (Math.random() > 0.2) return;
        if (typeof showNachoTrivia === 'function') showNachoTrivia();
    }, 180000);
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

    // Use innerHTML if text contains HTML (buttons, quiz, etc.), otherwise textContent
    var isInteractive = text.indexOf('<button') !== -1 || text.indexOf('<div') !== -1;
    if (isInteractive) {
        textEl.innerHTML = personalize(text);
    } else {
        textEl.textContent = personalize(text);
    }
    bubble.classList.add('show');

    clearTimeout(bubbleTimeout);
    bubble.setAttribute('data-interactive', isInteractive ? 'true' : 'false');
    // Don't auto-hide interactive content (quizzes, etc.) — user needs time to respond
    if (!isInteractive) {
        bubbleTimeout = setTimeout(hideBubble, BUBBLE_DURATION);
    }

    // Click-outside & Escape dismissal
    if (window._nachoDismissHandler) {
        document.removeEventListener('mousedown', window._nachoDismissHandler);
        document.removeEventListener('touchstart', window._nachoDismissHandler);
        document.removeEventListener('keydown', window._nachoEscHandler);
    }
    window._nachoDismissHandler = function(e) {
        var b = document.getElementById('nacho-bubble');
        var c = document.getElementById('nacho-container');
        if (!b || !b.classList.contains('show')) return;
        if (b.contains(e.target)) return;
        if (c && c.contains(e.target)) return;
        // Don't dismiss if clicking settings modal or its backdrop
        var modal = document.getElementById('usernameModal');
        if (modal && modal.contains(e.target)) return;
        hideBubble(true);
    };
    window._nachoEscHandler = function(e) {
        if (e.key === 'Escape') hideBubble(true);
    };
    // Small delay so the current click doesn't immediately dismiss
    setTimeout(function() {
        document.addEventListener('mousedown', window._nachoDismissHandler);
        document.addEventListener('touchstart', window._nachoDismissHandler, { passive: true });
        document.addEventListener('keydown', window._nachoEscHandler);
    }, 100);
}

window.hideBubble = function(force) {
        var bubble = document.getElementById('nacho-bubble');
    // Don't auto-hide interactive content (Q&A, trivia) — only manual close or force
    if (!force && bubble && bubble.getAttribute('data-interactive') === 'true') return;

    // Clear busy state — allow queued popups to show
    window._nachoBusy = false;

    // Mark interaction for badge — delay badge check so it doesn't pop immediately
    localStorage.setItem('btc_nacho_clicked', 'true');
    setTimeout(function() {
        if (typeof checkHiddenBadges === 'function') checkHiddenBadges();
    }, 2000);
    var avatar = document.getElementById('nacho-avatar');
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
let nachoTapTimes = [];
let nachoFlyCooldown = 0;
window.nachoClick = function() {
    const now = Date.now();

    // Triple-tap detection (3 taps within 600ms)
    nachoTapTimes.push(now);
    if (nachoTapTimes.length > 3) nachoTapTimes.shift();
    if (nachoTapTimes.length === 3 && (nachoTapTimes[2] - nachoTapTimes[0]) < 600 && now - nachoFlyCooldown > 5000) {
        nachoTapTimes = [];
        nachoFlyCooldown = now;
        lastClickTime = now;
        if (typeof nachoFly === 'function') nachoFly();
        forceShowBubble(personalize("Wheeeee! ⚡🦌⚡"));
        return;
    }

    if (now - lastClickTime < CLICK_COOLDOWN) return;
    lastClickTime = now;

    // Mark interaction for badge
    localStorage.setItem('btc_nacho_clicked', 'true');
    if (typeof checkHiddenBadges === 'function') checkHiddenBadges();
    if (typeof trackNachoInteraction === 'function') trackNachoInteraction();
    if (typeof nachoPlaySound === 'function') nachoPlaySound('click');

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

    // Smart pool based on user tier (same logic as auto messages)
    var clickVisits = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.totalVisits || 0 : 0;
    var clickTier = 'new';
    if (clickVisits >= 31) clickTier = 'veteran';
    else if (clickVisits >= 10) clickTier = 'regular';

    var clickPool;
    if (clickTier === 'new') clickPool = [...TIPS, ...TIPS, ...MOTIVATION, ...FUN]; // Heavy tips
    else if (clickTier === 'regular') clickPool = [...TIPS, ...FUN, ...FUN, ...MOTIVATION];
    else clickPool = [...FUN, ...FUN, ...FUN, ...MOTIVATION]; // Mostly fun for vets

    var clickUnshown = clickPool.filter(m => !shownMessages.has(m.text));
    var clickFinal = clickUnshown.length > 3 ? clickUnshown : clickPool;
    const msg = pickRandom(clickFinal);
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
    
    // Smart Greeting selection
    var visits = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.totalVisits || 0 : 0;
    var greeting;
    
    if (visits > 20) {
        // Veteran greetings: Facts & Wisdom
        var facts = [
            "Tick tock, next block! Ready for some high-signal learning, {name}? 🧱",
            "Welcome back, master HODLer! I've been keeping the Archive warm for you. 🦌🔥",
            "I noticed you've visited many channels. Want to test your knowledge with a Quest today? ⚡",
            "Back for your daily dose of decentralization? Let's dive in! 📘"
        ];
        greeting = facts[Math.floor(Math.random() * facts.length)];
        setPose('brain');
    } else if (visits > 5) {
        // Regular greetings
        var regulars = [
            "Hey {name}, great to see you again! ✨",
            "Welcome back! Ready to stack some more knowledge? 📚",
            "I missed you! Check out my closet if you've earned new items! 👔",
            "You're making great progress on your Exploration Map! 🗺️"
        ];
        greeting = regulars[Math.floor(Math.random() * regulars.length)];
        setPose('wave');
    } else {
        // Standard greeting for new users
        greeting = "I'm back, {name}! Miss me? 🦌";
        setPose('wave');
    }
    
    forceShowBubble(personalize(greeting));
};

window.hideNacho = function() {
    nachoVisible = false;
    localStorage.setItem('btc_nacho_hidden', 'true');
    document.getElementById('nacho-container').classList.add('hidden');
    document.getElementById('nacho-toggle').style.display = 'flex';
};

// ---- Context-Aware: Page Navigation (Forum/Marketplace) ----
window.nachoOnPage = function(pageId) {
    if (!nachoVisible) return;
    if (typeof trackNachoInteraction === 'function') trackNachoInteraction();

    var nn = (typeof nachoNickname === 'function') ? nachoNickname() : 'Nacho';
    var tips;
    if (pageId === 'forum') {
        tips = [
            { pose: 'wave', text: personalize("Welcome to PlebTalk, {name}! 🗣️ This is where Bitcoiners discuss ideas. Jump in!") },
            { pose: 'point', text: "💡 Post a new topic to earn +10 points, or reply to an existing one for +5. Quality content gets upvoted!" },
            { pose: 'brain', text: "Remember — this is a Bitcoin-only forum. Stay respectful, stay on topic, and attack ideas, not people! 🤝" },
            { pose: 'cheese', text: personalize("Psst {name}... earn the 📣 Town Crier badge by posting in PlebTalk! Your first post counts!") },
            { pose: 'fire', text: "🔥 Pro tip: Upvote posts you find valuable with ⚡ — it helps the best content rise to the top!" },
        ];
    } else if (pageId === 'marketplace') {
        tips = [
            { pose: 'wave', text: personalize("Welcome to LightningMart, {name}! ⚡ Buy and sell with Bitcoin — the way it should be!") },
            { pose: 'point', text: "💡 All prices are in sats. Sellers set their own prices. Payments happen directly between buyer and seller." },
            { pose: 'cheese', text: "🛒 List your first item to earn the 🏪 Merchant badge! Books, hardware, merch — whatever you've got!" },
            { pose: 'brain', text: "🛡️ Safety first! Meet in public for local trades, use Lightning for instant payments, and report suspicious listings." },
            { pose: 'fire', text: personalize("Pro tip {name}: add a Lightning address to your listing so buyers can pay you instantly! ⚡") },
        ];
    }

    if (tips) {
        var tip = tips[Math.floor(Math.random() * tips.length)];
        forceShowBubble(tip.text, tip.pose);
    }
};

// ---- Context-Aware: Channel Open (Clippy "It looks like...") ----
window.nachoOnChannel = function(channelId) {
    if (!nachoVisible) return;

    // Track interaction
    if (typeof trackNachoInteraction === 'function') trackNachoInteraction();

    // First-time channel intro (highest priority)
    if (typeof nachoChannelIntro === 'function') {
        var intro = nachoChannelIntro(channelId);
        if (intro) { forceShowBubble(intro.text, intro.pose); return; }
    }

    // Category completion check
    if (typeof nachoCategoryCheck === 'function') {
        var catMsg = nachoCategoryCheck(channelId);
        if (catMsg) { forceShowBubble(catMsg.text, catMsg.pose); if (typeof nachoPlaySound === 'function') nachoPlaySound('coin'); setTimeout(nachoFly, 500); return; }
    }

    // Check for specific channel message
    if (CLIPPY_HELPS[channelId] && Math.random() < 0.6) {
        const help = CLIPPY_HELPS[channelId];
        showBubble(help.text, help.pose);
        return;
    }

    // Bubble quiz: offer a quiz after reading a channel (30% chance, not on first visit)
    var channelReadTime = parseInt(sessionStorage.getItem('btc_channel_read_seconds') || '0');
    // Quest triggers after 30-120 seconds of reading (randomized so it's not predictable)
    var questMinTime = 30 + Math.floor(Math.random() * 90); // 30 to 120 seconds
    if (channelReadTime >= questMinTime && Math.random() < 0.30 && typeof QUEST_QUESTIONS !== 'undefined' && QUEST_QUESTIONS.length > 0) {
        // Find a question related to this channel's category
        var meta = (typeof CHANNELS !== 'undefined') ? CHANNELS[channelId] : null;
        var catName = meta ? meta.cat : '';
        var qs = QUEST_QUESTIONS.filter(function(q) {
            return q.category && catName && q.category.toLowerCase().indexOf(catName.toLowerCase().split(' ')[0]) !== -1;
        });
        if (qs.length === 0) qs = QUEST_QUESTIONS;
        var q = qs[Math.floor(Math.random() * qs.length)];

        var quizHtml = '<div style="font-weight:700;color:var(--heading);font-size:0.85rem;margin-bottom:6px;">🎮 Quick Quiz!</div>' +
            '<div style="color:var(--text);font-size:0.8rem;margin-bottom:8px;">' + q.question + '</div>';
        var opts = q.options || [];
        for (var qi = 0; qi < opts.length; qi++) {
            var isRight = qi === q.answer;
            quizHtml += '<button onclick="nachoBubbleQuizAnswer(this,' + isRight + ')" style="display:block;width:100%;padding:6px 10px;margin-bottom:3px;background:none;border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:0.75rem;cursor:pointer;font-family:inherit;text-align:left;transition:0.2s;touch-action:manipulation;">' + opts[qi] + '</button>';
        }
        forceShowBubble(quizHtml, 'brain');
        sessionStorage.setItem('btc_channel_read_seconds', '0');
        return;
    }

    // General channel reaction (25% chance)
    if (Math.random() < 0.25) {
        const msg = pickRandom(CHANNEL_REACT);
        showBubble(msg.text, msg.pose);
    }
};

// ---- Bubble Quiz Answer Handler ----
window.nachoBubbleQuizAnswer = function(btn, correct) {
    // Track for daily challenge
    sessionStorage.setItem('btc_quiz_done', 'true');

    // Disable all quiz buttons in the bubble
    var container = btn.parentElement;
    var buttons = container.querySelectorAll('button');
    buttons.forEach(function(b) {
        b.disabled = true;
        b.style.cursor = 'default';
        b.style.opacity = '0.6';
    });

    if (correct) {
        btn.style.background = '#22c55e';
        btn.style.color = '#fff';
        btn.style.borderColor = '#22c55e';
        btn.style.opacity = '1';
        // Show result text
        var result = document.createElement('div');
        result.style.cssText = 'margin-top:6px;font-size:0.8rem;font-weight:700;color:#22c55e;';
        result.textContent = '✅ Correct! +5 pts';
        container.appendChild(result);
        if (typeof awardPoints === 'function') awardPoints(5, '🎮 Quiz correct!');
        if (typeof showToast === 'function') showToast('🎮 +5 pts — Quiz correct!');
        if (typeof haptic === 'function') haptic('success');
    } else {
        btn.style.background = '#ef4444';
        btn.style.color = '#fff';
        btn.style.borderColor = '#ef4444';
        btn.style.opacity = '1';
        // Highlight the correct answer
        buttons.forEach(function(b) {
            if (b !== btn && b.getAttribute('onclick') && b.getAttribute('onclick').indexOf('true') !== -1) {
                b.style.background = '#22c55e';
                b.style.color = '#fff';
                b.style.borderColor = '#22c55e';
                b.style.opacity = '1';
            }
        });
        var wrongResult = document.createElement('div');
        wrongResult.style.cssText = 'margin-top:6px;font-size:0.8rem;font-weight:700;color:#ef4444;';
        wrongResult.textContent = '❌ Not quite! The correct answer is highlighted.';
        container.appendChild(wrongResult);
    }

    // Auto-hide bubble after 5 seconds so they can see the result
    clearTimeout(bubbleTimeout);
    bubbleTimeout = setTimeout(hideBubble, 5000);
};

// ---- Context-Aware: Points Earned ----
window.nachoOnPoints = function(pts) {
    if (!nachoVisible) return;
    
    // Flying threshold: 250+ points in one go (very rare/big achievement)
    if (pts >= 250) {
        setTimeout(nachoFly, 500);
        return;
    }
    
    if (Math.random() > 0.2) return;
    const msg = pickRandom(MILESTONES);
    showBubble(msg.text, msg.pose);
};

// ---- Context-Aware: Quest Complete ----
// ---- Nacho Victory Flight ----
window.nachoFly = function() {
    var avatar = document.getElementById('nacho-avatar');
    if (!avatar || avatar.classList.contains('flying')) return;

    // Remove idle animations
    ['anim-tap','anim-lean','anim-wiggle','anim-bounce','anim-stretch','anim-look','anim-wave','anim-sleepy'].forEach(function(a) { avatar.classList.remove(a); });

    avatar.classList.add('flying');

    // Zap sound at each direction change
    function playZap(pitch) {
        if (typeof canPlaySound === 'function' && !canPlaySound()) return;
        try {
            var ctx = new (window.AudioContext || window.webkitAudioContext)();
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = pitch;
            osc.type = 'sawtooth';
            gain.gain.setValueAtTime(0.06, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.12);
        } catch(e) {}
    }

    // Sound check
    var soundOn = localStorage.getItem('btc_nacho_sound') !== 'false';

    // Zaps at each bolt direction change (timed to 2.8s desktop animation)
    var zapTimes = [0, 400, 800, 1200, 1600, 2000];
    var zapPitches = [1200, 1800, 1400, 2200, 1600, 2800];
    zapTimes.forEach(function(t, i) {
        setTimeout(function() {
            if (soundOn && avatar.classList.contains('flying')) playZap(zapPitches[i]);
        }, t);
    });

    // Spawn lightning trail particles as Nacho flies
    var trailSymbols = ['⚡', '✨', '🔥', '⚡', '💫', '⚡'];
    var trailInterval = setInterval(function() {
        if (!avatar.classList.contains('flying')) { clearInterval(trailInterval); return; }
        var rect = avatar.getBoundingClientRect();
        var particle = document.createElement('div');
        particle.className = 'nacho-trail';
        particle.textContent = trailSymbols[Math.floor(Math.random() * trailSymbols.length)];
        particle.style.left = (rect.left + rect.width / 2 + (Math.random() * 20 - 10)) + 'px';
        particle.style.top = (rect.top + rect.height / 2 + (Math.random() * 20 - 10)) + 'px';
        document.body.appendChild(particle);
        setTimeout(function() { if (particle.parentNode) particle.remove(); }, 600);
    }, 40);

    // Remove flying class when animation ends, resume idle
    avatar.addEventListener('animationend', function handler() {
        avatar.classList.remove('flying');
        avatar.classList.add('anim-bounce');
        avatar.removeEventListener('animationend', handler);
        clearInterval(trailInterval);
        // Landing sound — satisfying thud
        if (soundOn && (typeof canPlaySound !== 'function' || canPlaySound())) {
            try {
                var ctx = new (window.AudioContext || window.webkitAudioContext)();
                var osc = ctx.createOscillator();
                var gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.frequency.value = 300; osc.type = 'sine';
                gain.gain.setValueAtTime(0.08, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
                osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.2);
            } catch(e) {}
        }
    });
};

window.nachoOnQuest = function(passed) {
    if (!nachoVisible) return;
    lastBubbleTime = 0;
    if (passed) {
        setPose('celebrate');
        forceShowBubble(personalize("{name}, you CRUSHED that quest! This buck is VERY impressed! 🦌🎉🔥"));
        setTimeout(nachoFly, 500);
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

    // Check for milestone celebration first
    if (typeof nachoCheckMilestone === 'function') {
        var milestone = nachoCheckMilestone();
        if (milestone) { forceShowBubble(milestone.text, milestone.pose); setTimeout(nachoFly, 500); return; }
    }

    // 20% chance of live data message
    if (typeof nachoLiveMessage === 'function' && Math.random() < 0.2) {
        var live = nachoLiveMessage();
        if (live) { showBubble(live.text, live.pose); return; }
    }

    // Check for newly unlocked closet items
    if (typeof checkNachoNewItems === 'function') {
        var newItem = checkNachoNewItems();
        if (newItem) { forceShowBubble(newItem.text, newItem.pose); if (typeof nachoPlaySound === 'function') nachoPlaySound('coin'); return; }
    }

    // Smart message selection based on user experience level
    var visits = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.totalVisits || 0 : 0;

    // Determine user tier
    // NEW: < 5 visits, < 10 channels — needs onboarding tips
    // REGULAR: 5-30 visits, 10-50 channels — mix of tips + fun
    // VETERAN: 30+ visits, 50+ channels — mostly fun, advanced tips only
    // Tier based on visits only (simple, predictable)
    // NEW: < 10 visits — onboarding + closet (hook them!)
    // REGULAR: 10-30 visits — balanced
    // VETERAN: 31+ visits — entertainment
    var tier = 'new';
    if (visits >= 31) tier = 'veteran';
    else if (visits >= 10) tier = 'regular';

    var pool;
    var roll = Math.random();

    if (tier === 'new') {
        // New users: 45% tips, 15% closet (fun hook!), 20% motivation, 20% fun
        if (typeof NACHO_CLOSET_TIPS !== 'undefined' && roll < 0.15) pool = NACHO_CLOSET_TIPS;
        else if (roll < 0.60) pool = TIPS;
        else if (roll < 0.80) pool = MOTIVATION;
        else pool = FUN;
    } else if (tier === 'regular') {
        // Regular users: 30% tips, 10% closet, 25% motivation, 35% fun
        if (typeof NACHO_CLOSET_TIPS !== 'undefined' && roll < 0.10) pool = NACHO_CLOSET_TIPS;
        else if (roll < 0.40) pool = FUN;
        else if (roll < 0.70) pool = TIPS;
        else pool = MOTIVATION;
    } else {
        // Veterans: 10% tips, 15% closet, 25% motivation, 50% fun
        if (typeof NACHO_CLOSET_TIPS !== 'undefined' && roll < 0.15) pool = NACHO_CLOSET_TIPS;
        else if (roll < 0.65) pool = FUN;
        else if (roll < 0.90) pool = MOTIVATION;
        else pool = TIPS;
    }

    var unshown = pool.filter(m => !shownMessages.has(m.text));
    if (unshown.length === 0) {
        // Fallback: try any pool
        var fallback = [...FUN, ...MOTIVATION];
        unshown = fallback.filter(m => !shownMessages.has(m.text));
        if (unshown.length === 0) return;
    }
    const msg = pickRandom(unshown);
    showBubble(msg.text, msg.pose);
}

// ---- Utility ----
window.nachoUserName = function() {
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.username) {
        // Sanitize to prevent XSS if username data is somehow corrupted
        return String(currentUser.username).replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    return '';
}

// ---- Secret Shake Gesture ----
let lastShakeTime = 0;
let shakeCount = 0;
let shakeProcessing = false;

if (window.DeviceMotionEvent) {
    window.addEventListener('devicemotion', function(event) {
        if (!nachoVisible || shakeProcessing) return;
        
        var acc = event.accelerationIncludingGravity;
        if (!acc) return;
        
        // Decently hard shake threshold (total acceleration vector > 25 m/s^2)
        // Gravity is 9.8, so this is a significant force
        var totalAcc = Math.sqrt(acc.x*acc.x + acc.y*acc.y + acc.z*acc.z);
        
        if (totalAcc > 28) {
            var now = Date.now();
            if (now - lastShakeTime > 1000) {
                shakeCount = 0; // Reset if too slow
            }
            
            lastShakeTime = now;
            shakeCount++;
            
            // Require 2 quick hard shakes (to prevent accidental triggers from walking/dropping)
            if (shakeCount >= 2) {
                shakeProcessing = true;
                shakeCount = 0;
                
                if (typeof haptic === 'function') haptic('heavy');
                if (typeof nachoFly === 'function') nachoFly();
                forceShowBubble(personalize("Whoa, {name}! Too much coffee? ⚡🦌🌪️"));
                
                setTimeout(function() { shakeProcessing = false; }, 3000); // Cooldown
            }
        }
    }, true);
}

// Inject username into message text — replaces {name} placeholder
window.personalize = function(text) {
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
        
        function startLP(e) { 
            if (e.type === 'touchstart') {
                // Prevent scrolling when long-pressing Nacho
                e.preventDefault();
            }
            lp = setTimeout(function() { 
                hideNacho(); 
                if (typeof showToast === 'function') showToast('🦌 Nacho is hiding. Click the small 🦌 to bring him back!'); 
            }, 800); 
        }
        function stopLP() { clearTimeout(lp); }
        
        av.addEventListener('mousedown', startLP);
        av.addEventListener('mouseup', stopLP);
        av.addEventListener('mouseleave', stopLP);
        av.addEventListener('touchstart', startLP, { passive: false });
        av.addEventListener('touchend', stopLP);
        av.addEventListener('touchmove', stopLP);
    }, 1000);
});

// ---- Click outside bubble to close (only when Q&A input is showing) ----
document.addEventListener('click', function(e) {
    var bubble = document.getElementById('nacho-bubble');
    if (!bubble || !bubble.classList.contains('show')) return;
    var container = document.getElementById('nacho-container');
    if (container && container.contains(e.target)) return; // Click inside Nacho area
    hideBubble(true);
});

// ---- Init ----
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createNacho);
} else {
    createNacho();
}

})();
