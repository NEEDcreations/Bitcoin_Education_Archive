// =============================================
// 🦌 Nacho Q&A - Ask Nacho about Bitcoin!
// =============================================

(function() {

// Knowledge base: keywords → answer + channel recommendation
const NACHO_KB = [
    // === BASICS ===
    { keys: ['what is a sat','what is a satoshi','what are sats','what are satoshis','how many sats','sats in a bitcoin','sat meaning','smallest unit','sat denomination'],
      answer: "A sat (short for satoshi) is the smallest unit of Bitcoin — 1 sat = 0.00000001 BTC. There are 100 million sats in one Bitcoin. Named after Bitcoin's creator, Satoshi Nakamoto! Most everyday Lightning payments are measured in sats. ⚡",
      channel: 'sats__or__bits', channelName: 'Sats or Bits' },

    { keys: ['what is bitcoin','explain bitcoin','bitcoin basics','new to bitcoin','beginner','getting started','what\'s bitcoin'],
      answer: "Bitcoin is digital money that no one controls — no banks, no governments. It's scarce (only 21 million), decentralized, and can be sent to anyone on Earth instantly.",
      channel: 'one-stop-shop', channelName: 'One Stop Shop' },

    { keys: ['how does bitcoin work','how bitcoin works','how it works'],
      answer: "Bitcoin uses a network of computers (nodes) that all agree on who owns what. Transactions are grouped into blocks every ~10 minutes by miners. No middleman needed!",
      channel: 'whitepaper', channelName: 'Whitepaper' },

    { keys: ['who created bitcoin','who made bitcoin','satoshi','nakamoto','who invented'],
      answer: "Bitcoin was created by Satoshi Nakamoto in 2009. Their real identity is still unknown — could be one person or a group. The mystery is part of the magic!",
      channel: 'satoshi-nakamoto', channelName: 'Satoshi Nakamoto' },

    { keys: ['why bitcoin','why is bitcoin important','why should i care','what\'s the point','why does bitcoin matter'],
      answer: "Bitcoin gives you true ownership of your money. No one can freeze it, inflate it away, or stop you from sending it. It's financial freedom for everyone on Earth.",
      channel: 'one-stop-shop', channelName: 'One Stop Shop' },

    // === BUYING & INVESTING ===
    { keys: ['how to buy','where to buy','buy bitcoin','purchase bitcoin','get bitcoin','acquire'],
      answer: "You can buy Bitcoin on exchanges, peer-to-peer, or through Bitcoin ATMs. Start small — you can buy a fraction of a Bitcoin! DCA (buying a little regularly) is the most popular strategy.",
      channel: 'investment-strategy', channelName: 'Investment Strategy' },

    { keys: ['too late','am i too late','too expensive','missed out','already too high','can\'t afford'],
      answer: "You can buy fractions of Bitcoin — even $10 worth! With ~1-3% global adoption, it's like the internet in 1997. You're still incredibly early.",
      channel: 'investment-strategy', channelName: 'Investment Strategy' },

    { keys: ['dca','dollar cost average','dollar cost averaging','how to invest','investment strategy','when to buy'],
      answer: "DCA means buying a fixed amount regularly (weekly/monthly) regardless of price. It removes emotion and timing stress. Time in the market beats timing the market!",
      channel: 'investment-strategy', channelName: 'Investment Strategy' },

    { keys: ['price prediction','how high','what price','price target','how much will','100k','million'],
      answer: "I'm a deer, not a financial advisor! 🦌 But historically, Bitcoin has outperformed every other asset over any 4+ year period. Check the charts channel for data!",
      channel: 'charts', channelName: 'Charts' },

    // === TECHNICAL ===
    { keys: ['mining','how mining works','bitcoin mining','miners','what is mining'],
      answer: "Mining is how new Bitcoin is created and transactions are confirmed. Miners use powerful computers to solve math puzzles — the winner gets to add the next block and earns Bitcoin as a reward!",
      channel: 'mining', channelName: 'Mining' },

    { keys: ['blockchain','timechain','what is blockchain','block chain','how blockchain works'],
      answer: "The blockchain (Bitcoiners say 'timechain') is a public ledger of every Bitcoin transaction ever made. It's stored on thousands of computers worldwide and can never be altered!",
      channel: 'blockchain-timechain', channelName: 'Blockchain / Timechain' },

    { keys: ['halving','halvening','what is halving','block reward','next halving'],
      answer: "Every 210,000 blocks (~4 years), the Bitcoin mining reward is cut in half. This makes Bitcoin increasingly scarce. The last halving was in April 2024, cutting the reward to 3.125 BTC per block!",
      channel: 'scarce', channelName: 'Scarce' },

    { keys: ['lightning','lightning network','layer 2','what is lightning','fast transactions','instant payments'],
      answer: "The Lightning Network is Bitcoin's second layer — it enables instant, nearly-free payments. You can send fractions of a penny anywhere in the world in milliseconds! ⚡",
      channel: 'layer-2-lightning', channelName: 'Lightning Network' },

    { keys: ['node','full node','run a node','bitcoin node','what is a node','why run a node'],
      answer: "A node is a computer that stores and verifies the entire Bitcoin blockchain. Running one means you don't have to trust anyone — you verify everything yourself! Don't trust, verify!",
      channel: 'nodes', channelName: 'Nodes' },

    { keys: ['wallet','bitcoin wallet','best wallet','which wallet','where to store','cold storage','hardware wallet'],
      answer: "A Bitcoin wallet holds your private keys (not actually your coins). Hardware wallets like Coldcard or Trezor are the gold standard. Remember: Nacho keys, nacho cheese! 🧀🔑",
      channel: 'self-custody', channelName: 'Self Custody' },

    { keys: ['seed phrase','recovery phrase','24 words','12 words','backup','mnemonic'],
      answer: "Your seed phrase is 12 or 24 words that can recover your entire wallet. NEVER share it with anyone. Write it down on metal, store it somewhere safe. This IS your Bitcoin!",
      channel: 'self-custody', channelName: 'Self Custody' },

    { keys: ['private key','public key','keys','what are keys','key pair'],
      answer: "Your private key proves you own your Bitcoin — never share it! Your public key (address) is what you share to receive Bitcoin. Think of it like an email address vs password.",
      channel: 'public_key_vs_private_key', channelName: 'Public Key vs Private Key' },

    { keys: ['taproot','what is taproot','segwit','soft fork','bitcoin upgrade'],
      answer: "Taproot was Bitcoin's most recent major upgrade (2021). It improved privacy, efficiency, and enabled more complex smart contracts. Bitcoin upgrades are rare and carefully considered!",
      channel: 'taproot', channelName: 'Taproot' },

    { keys: ['utxo','unspent','transaction output'],
      answer: "UTXO stands for Unspent Transaction Output. Bitcoin doesn't have 'balances' — it tracks individual chunks of Bitcoin you've received. Think of them like individual bills in your wallet!",
      channel: 'utxos', channelName: 'UTXOs' },

    { keys: ['mempool','unconfirmed','pending transaction','stuck transaction','transaction fee','fees'],
      answer: "The mempool is the waiting room for unconfirmed transactions. Higher fees = faster confirmation. You can check mempool.space to see current fees and congestion!",
      channel: 'transaction_fees', channelName: 'Transaction Fees' },

    { keys: ['difficulty','difficulty adjustment','how difficulty works'],
      answer: "Every 2,016 blocks (~2 weeks), Bitcoin automatically adjusts mining difficulty so blocks keep coming every ~10 minutes. It's one of the most elegant parts of Bitcoin's design!",
      channel: 'difficulty-adjustment', channelName: 'Difficulty Adjustment' },

    // === COMMON CONCERNS / FUD ===
    { keys: ['scam','ponzi','pyramid','is bitcoin a scam','fraud'],
      answer: "Bitcoin is open-source code that anyone can audit. No CEO, no company, no promises of returns. It's the opposite of a scam — it's the most transparent financial system ever built.",
      channel: 'misconceptions-fud', channelName: 'Misconceptions & FUD' },

    { keys: ['energy','environment','electricity','bad for environment','waste energy','carbon','climate'],
      answer: "Bitcoin mining actually incentivizes renewable energy and uses mostly stranded/wasted energy. Its carbon intensity is lower than many industries. Check the facts!",
      channel: 'energy', channelName: 'Environment & Energy' },

    { keys: ['volatile','volatility','risky','risk','crash','bear market','goes down','drops'],
      answer: "Yes, Bitcoin is volatile short-term. But zoom out — every 4-year period in Bitcoin's history has been profitable. Volatility is the price of admission for the best-performing asset ever.",
      channel: 'misconceptions-fud', channelName: 'Misconceptions & FUD' },

    { keys: ['criminal','illegal','drug','dark web','used by criminals','money laundering'],
      answer: "Less than 1% of Bitcoin transactions are illicit — far less than cash! Bitcoin is actually easier to trace than cash since every transaction is on a public ledger forever.",
      channel: 'misconceptions-fud', channelName: 'Misconceptions & FUD' },

    { keys: ['hack','hacked','bitcoin hacked','can it be hacked','security','safe'],
      answer: "Bitcoin's network has NEVER been hacked in 15+ years. It's secured by more computing power than anything else on Earth. Individual wallets can be compromised, but not Bitcoin itself!",
      channel: 'secure', channelName: 'Secure' },

    { keys: ['ban','banned','government ban','illegal','can government stop','regulate'],
      answer: "Bitcoin can't be banned — it's code running on thousands of computers worldwide. Even China's ban failed. Many countries are now embracing it. You can't stop math!",
      channel: 'regulation', channelName: 'Regulation' },

    { keys: ['quantum','quantum computer','quantum computing','quantum threat'],
      answer: "Quantum computers strong enough to threaten Bitcoin don't exist yet and won't for decades. When they get close, Bitcoin can upgrade its cryptography. The devs are already prepared!",
      channel: 'misconceptions-fud', channelName: 'Misconceptions & FUD' },

    { keys: ['dead','bitcoin is dead','dying','failed','over'],
      answer: "Bitcoin has been declared dead 477+ times since 2010. It's still here, stronger than ever, at all-time highs. The reports of its death have been greatly exaggerated! 😂",
      channel: 'misconceptions-fud', channelName: 'Misconceptions & FUD' },

    // === ALTCOINS ===
    { keys: ['ethereum','eth','altcoin','altcoin','other crypto','which crypto','best crypto','alt coins','solana','cardano','xrp','dogecoin','doge'],
      answer: "There's Bitcoin and then there's everything else. Altcoins are mostly venture capital funded projects that don't share Bitcoin's properties — no fair launch, no true decentralization. Bitcoin only.",
      channel: 'evidence-against-alts', channelName: 'Evidence Against Alts' },

    { keys: ['nft','nfts','ordinals','inscriptions','jpeg'],
      answer: "Ordinals and inscriptions are a way to put data on the Bitcoin blockchain. It's a hot debate! Some love it, some hate it. Read both sides!",
      channel: 'ordinals', channelName: 'Ordinals' },

    // === ECONOMICS ===
    { keys: ['inflation','money printing','fed','federal reserve','fiat','dollar','debasement','money supply'],
      answer: "Governments print unlimited money which steals your purchasing power through inflation. Bitcoin has a fixed supply of 21 million — no one can print more. Fix the money, fix the world!",
      channel: 'problems-of-money', channelName: 'Problems of Money' },

    { keys: ['store of value','digital gold','gold','savings','save money','protect wealth'],
      answer: "Bitcoin is the best store of value ever invented — scarce, portable, divisible, durable, verifiable, and uncensorable. It's digital gold but better in almost every way!",
      channel: 'money', channelName: 'Money' },

    { keys: ['21 million','supply cap','how many bitcoin','total supply','limited supply'],
      answer: "There will only ever be 21 million Bitcoin. Ever. No one can change this. About 19.5 million have been mined, and ~20% are estimated lost forever. Your sats are rarer than you think!",
      channel: 'scarce', channelName: 'Scarce' },

    // === PRIVACY ===
    { keys: ['privacy','private','anonymous','kyc','no kyc','non-kyc','hide','trace','track'],
      answer: "Bitcoin is pseudonymous, not anonymous. Every transaction is public. For more privacy, look into non-KYC buying methods and coin mixing techniques. Privacy is a human right!",
      channel: 'privacy-nonkyc', channelName: 'Privacy & Non-KYC' },

    { keys: ['coinjoin','coin mixing','wasabi','mixer','mixing'],
      answer: "CoinJoin combines multiple users' transactions into one, making it hard to trace who sent what. It's an important privacy tool for protecting your financial data!",
      channel: 'coin_mixing_coinjoin_coin_control_utxo', channelName: 'CoinJoin & Coin Mixing' },

    // === CULTURE ===
    { keys: ['book','books','reading','what to read','recommended reading','bitcoin standard'],
      answer: "The Bitcoin Standard by Saifedean Ammous is the essential starting book. Also check out The Blocksize War, 21 Lessons by Gigi, and Inventing Bitcoin!",
      channel: 'books', channelName: 'Books' },

    { keys: ['podcast','podcasts','listen','audio','what to listen'],
      answer: "Top Bitcoin podcasts: What Bitcoin Did, Bitcoin Audible, Stephan Livera Podcast, Tales from the Crypt, and The Investor's Podcast Bitcoin Fundamentals!",
      channel: 'podcasts', channelName: 'Podcasts' },

    { keys: ['movie','movies','documentary','film','watch','video'],
      answer: "Check out documentaries like 'This Machine Greens,' 'The Great Reset,' and tons of educational videos from Bitcoin conferences!",
      channel: 'movies-tv', channelName: 'Movies & TV' },

    { keys: ['meme','memes','funny','joke','humor','laugh'],
      answer: "Bitcoin memes are an art form! The community has the best memes in all of finance. Prepare to laugh! 😂",
      channel: 'memes-funny', channelName: 'Memes & Funny' },

    // === SITE SPECIFIC ===
    { keys: ['how to use','how does this site','help','navigate','where do i start','tutorial','guide me'],
      answer: "Start with the 'One Stop Shop' channel for beginners! Use the sidebar to browse channels by category. Earn points by reading, take quests to test knowledge, and collect badges!",
      channel: 'one-stop-shop', channelName: 'One Stop Shop' },

    { keys: ['quest','quests','test','quiz','certification','exam','scholar'],
      answer: "Hit 'Start a Quest' in the sidebar for quick knowledge tests, or try the Bitcoin Scholar Certification for the ultimate challenge! Pass it for the 🎓 badge + 300 points!",
      channel: null, channelName: null },

    { keys: ['points','ranking','level','rank','how to earn','earn points','leaderboard'],
      answer: "Earn points by: visiting daily (+5), opening new channels (+10), reading for 30sec (+15), quest bonuses, badges (25-1000), and Orange Tickets (5 pts each)! Check the leaderboard!",
      channel: null, channelName: null },

    { keys: ['ticket','tickets','orange ticket','giveaway','referral','refer','sats giveaway'],
      answer: "Earn Orange Tickets by logging in daily (+1) and referring friends (+5). More tickets = higher chance of winning the 25,000 sats giveaway! Check Settings → Tickets for your referral link!",
      channel: null, channelName: null },

    { keys: ['badge','badges','hidden badge','achievements','unlock'],
      answer: "There are 9 hidden badges worth 25-1,000 points each! I can't tell you exactly how to get them... but explore the site, interact with me, take quests, and collect tickets! 🏅",
      channel: null, channelName: null },

    // === MISC ===
    { keys: ['nostr','what is nostr','decentralized social'],
      answer: "Nostr is a decentralized social media protocol that pairs beautifully with Bitcoin and Lightning. No censorship, no corporate control. The future of social media!",
      channel: 'nostr', channelName: 'Nostr' },

    { keys: ['el salvador','legal tender','country','nation','adoption'],
      answer: "El Salvador became the first country to make Bitcoin legal tender in 2021! Other countries are following. Bitcoin adoption is accelerating at the nation-state level!",
      channel: 'news-adoption', channelName: 'News & Adoption' },

    { keys: ['job','jobs','career','work','earn bitcoin','get paid'],
      answer: "Want to work in Bitcoin? There are tons of Bitcoin-only companies hiring! Check the Jobs channel for opportunities and ways to earn sats!",
      channel: 'jobs-earn', channelName: 'Jobs & Earn' },

    { keys: ['who are you','what are you','about you','nacho','tell me about yourself','what is your name','what\'s your name','your name','whats your name','who is this','who is nacho','who are u','what are u','introduce yourself'],
      answer: "I'm Nacho! A strong buck from New Hampshire. 🦌💪 I roam this site helping Bitcoiners learn. My motto: Nacho keys, nacho cheese! Click me anytime for tips, jokes, or Bitcoin wisdom!",
      channel: null, channelName: null },

    { keys: ['how old are you','how old is nacho','your age','age','when were you born','birthday','when is your birthday'],
      answer: "I'm 5 years old — a full-grown adult buck! 🦌 That's about 35 in human years. In my prime, baby! These antlers don't grow themselves. 💪",
      channel: null, channelName: null },

    { keys: ['how much bitcoin','how many bitcoin','how much btc','how many sats do you','your bitcoin','your btc','your stack','how much do you own','how much you got','your portfolio','how rich'],
      answer: "Well there, my deer, that's not really any of your business now is it? 🦌 That's like me asking you how much money you have in the bank! I like to tell people that I own more BTC than I did yesterday though! 📈",
      channel: null, channelName: null },

    { keys: ['thank','thanks','ty','appreciate','love you','you\'re great','good job','awesome'],
      answer: "Aww shucks! 🧡 You're the great one — you're here learning! That makes you smarter than most. Keep going and I'll keep cheering you on! 🦌💪",
      channel: null, channelName: null },
];

// Fallback if no match
const FALLBACKS = [
    "Hmm, I'm not sure about that one! Try browsing the sidebar channels or use 🔍 search. I'm still learning too! 🦌",
    "Good question! I don't have a perfect answer, but check the search — this archive probably covers it somewhere! 🔍",
    "That's beyond my antler-span! 🦌 Try the One Stop Shop channel for a broad overview, or search for specific topics!",
    "Even the strongest buck in NH doesn't know everything! Try searching the archive — there are 146+ channels of knowledge! 🗻",
];

// ---- Match user input to knowledge base ----
function findAnswer(input) {
    input = input.toLowerCase().trim();
    if (input.length < 2) return null;

    let bestMatch = null;
    let bestScore = 0;

    for (const entry of NACHO_KB) {
        let score = 0;
        for (const key of entry.keys) {
            if (input === key) { score = 100; break; } // Exact match
            if (input.includes(key)) { score = Math.max(score, 50 + key.length); } // Contains match (longer = better)
            // Word overlap scoring — require exact word match for short words
            const keyWords = key.split(/\s+/);
            const inputWords = input.split(/\s+/);
            let wordMatches = 0;
            for (const kw of keyWords) {
                if (kw.length < 3) continue;
                for (const iw of inputWords) {
                    if (iw === kw) { wordMatches += 2; } // Exact word match (strong)
                    else if (kw.length >= 6 && (iw.includes(kw) || kw.includes(iw))) { wordMatches++; } // Substring only for long words
                }
            }
            if (wordMatches > 0) {
                score = Math.max(score, wordMatches * 15);
            }
        }
        if (score > bestScore) {
            bestScore = score;
            bestMatch = entry;
        }
    }

    return bestScore >= 20 ? bestMatch : null;
}

// ---- Show Ask Nacho input ----
window.showNachoInput = function() {
    const bubble = document.getElementById('nacho-bubble');
    const textEl = document.getElementById('nacho-text');
    if (!bubble || !textEl) return;

    // Mark interaction for badge
    localStorage.setItem('btc_nacho_clicked', 'true');
    if (typeof checkHiddenBadges === 'function') checkHiddenBadges();

    if (typeof setPose === 'function') setPose('think');

    textEl.innerHTML =
        '<div style="margin-bottom:8px;font-weight:600;color:var(--heading,#fff);">Ask me anything about Bitcoin!</div>' +
        '<input type="text" id="nachoInput" placeholder="e.g. What is mining?" maxlength="100" style="width:100%;padding:8px 10px;background:var(--input-bg,#111);border:1px solid var(--border,#333);border-radius:8px;color:var(--text,#eee);font-size:0.85rem;font-family:inherit;outline:none;box-sizing:border-box;" onkeydown="if(event.key===\'Enter\')nachoAnswer()">' +
        '<button onclick="nachoAnswer()" style="width:100%;margin-top:6px;padding:8px;background:#f7931a;color:#fff;border:none;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">Ask Nacho 🦌</button>';

    bubble.classList.add('show');
    clearTimeout(window._nachoBubbleTimeout);

    // Focus the input after a tiny delay
    setTimeout(function() {
        var inp = document.getElementById('nachoInput');
        if (inp) inp.focus();
    }, 100);
};

// ---- Process user question ----
// ---- Inappropriate input filter ----
const NACHO_BLOCKED_WORDS = [
    'fuck','shit','ass','bitch','dick','cock','pussy','cunt','damn','bastard',
    'slut','whore','fag','nigger','nigga','retard','penis','vagina','porn',
    'sex','anal','cum','dildo','tits','boob','nude','naked','hentai','milf',
    'orgasm','molest','rape','pedo','nazi','hitler','kkk','jihad','terrorist',
    'murder','suicide','stfu','gtfo','wank','twat','piss','douche','skank',
    'thot','incel','onlyfans','xnxx','pornhub','xvideos','kys','die',
    'kill you','hate you','stupid','idiot','dumb','ugly','loser',
];

const NACHO_POLITE_DEFLECTIONS = [
    "Whoa there! 🦌 I'm just a friendly deer who talks about Bitcoin. Let's keep things positive! Ask me something about Bitcoin instead!",
    "Hey now, let's keep it family-friendly! 🦌 I'm here to help you learn about Bitcoin. What would you like to know?",
    "That's not really my area of expertise! I'm a Bitcoin deer, not a... whatever that was. 🦌 Try asking me about wallets, mining, or Lightning!",
    "My antlers are tingling — and not in a good way! 😅 Let's stick to Bitcoin topics. What can I help you learn?",
    "I'm going to pretend I didn't hear that! 🦌 How about we talk about something cool, like how the Lightning Network works?",
    "Even the strongest buck in NH knows when to change the subject! 🦌 Ask me about Bitcoin — I promise it's more interesting!",
];

function isInappropriate(text) {
    var lower = text.toLowerCase().replace(/[^a-z\s]/g, '');
    var words = lower.split(/\s+/);
    for (var i = 0; i < words.length; i++) {
        for (var j = 0; j < NACHO_BLOCKED_WORDS.length; j++) {
            if (words[i] === NACHO_BLOCKED_WORDS[j]) return true;
        }
    }
    // Check for multi-word matches and embedded profanity
    var compressed = lower.replace(/\s/g, '');
    for (var k = 0; k < NACHO_BLOCKED_WORDS.length; k++) {
        if (NACHO_BLOCKED_WORDS[k].length >= 4 && compressed.includes(NACHO_BLOCKED_WORDS[k])) return true;
    }
    return false;
}

window.nachoAnswer = function() {
    var inp = document.getElementById('nachoInput');
    if (!inp) return;
    var q = inp.value.trim();
    if (!q) return;

    var bubble = document.getElementById('nacho-bubble');
    var textEl = document.getElementById('nacho-text');
    if (!bubble || !textEl) return;

    // Check for inappropriate input FIRST
    if (isInappropriate(q)) {
        if (typeof setPose === 'function') setPose('default');
        var deflection = NACHO_POLITE_DEFLECTIONS[Math.floor(Math.random() * NACHO_POLITE_DEFLECTIONS.length)];
        textEl.innerHTML = '<div style="color:var(--text,#eee);line-height:1.6;">' + deflection + '</div>' +
            '<button onclick="showNachoInput()" style="width:100%;margin-top:10px;padding:8px;background:var(--accent-bg,rgba(247,147,26,0.1));border:1px solid #f7931a;border-radius:8px;color:#f7931a;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">Ask a Bitcoin question instead 🦌</button>';
        clearTimeout(window._nachoBubbleTimeout);
        return;
    }

    var match = findAnswer(q);

    if (match) {
        if (typeof setPose === 'function') setPose('brain');
        var html = '<div style="color:var(--text,#eee);line-height:1.6;">' + match.answer + '</div>';
        if (match.channel && match.channelName) {
            html += '<button onclick="if(typeof go===\'function\')go(\'' + match.channel + '\');hideBubble();" style="width:100%;margin-top:10px;padding:8px;background:var(--accent-bg,rgba(247,147,26,0.1));border:1px solid #f7931a;border-radius:8px;color:#f7931a;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">📖 Read more: ' + match.channelName + ' →</button>';
        }
        html += '<button onclick="showNachoInput()" style="width:100%;margin-top:4px;padding:6px;background:none;border:1px solid var(--border,#333);border-radius:8px;color:var(--text-muted,#888);font-size:0.8rem;cursor:pointer;font-family:inherit;">Ask another question</button>';
        textEl.innerHTML = html;
    } else {
        if (typeof setPose === 'function') setPose('think');
        var fb = FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
        textEl.innerHTML = '<div style="color:var(--text,#eee);line-height:1.6;">' + fb + '</div>' +
            '<button onclick="if(typeof go===\'function\')go(\'one-stop-shop\');hideBubble();" style="width:100%;margin-top:10px;padding:8px;background:var(--accent-bg,rgba(247,147,26,0.1));border:1px solid #f7931a;border-radius:8px;color:#f7931a;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">📖 Try: One Stop Shop →</button>' +
            '<button onclick="showNachoInput()" style="width:100%;margin-top:4px;padding:6px;background:none;border:1px solid var(--border,#333);border-radius:8px;color:var(--text-muted,#888);font-size:0.8rem;cursor:pointer;font-family:inherit;">Ask another question</button>';
    }

    // Keep bubble open until user closes it
    clearTimeout(window._nachoBubbleTimeout);
};

})();
