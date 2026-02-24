// =============================================
// 🦌 Nacho Q&A - Ask Nacho about Bitcoin!
// =============================================

// HTML sanitizer — prevents XSS from external data (web search, usernames, etc)
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function sanitizeUrl(url) {
    if (!url) return '';
    var u = String(url).trim();
    // Only allow http/https URLs
    if (!/^https?:\/\//i.test(u)) return '';
    return escapeHtml(u);
}

(function() {

// Knowledge base: keywords → answer + channel recommendation
const NACHO_KB = [
    // === BASICS ===
    { keys: ['what is a sat','what is a satoshi','what are sats','what are satoshis','how many sats','sats in a bitcoin','sat meaning','smallest unit','sat denomination'],
      answer: "A sat (short for satoshi) is the smallest unit of Bitcoin — 1 sat = 0.00000001 BTC. There are 100 million sats in one Bitcoin. Named after Bitcoin's creator, Satoshi Nakamoto! Most everyday Lightning payments are measured in sats. ⚡",
      channel: 'sats__or__bits', channelName: 'Sats or Bits' },

    { keys: ['what is bitcoin','explain bitcoin','bitcoin basics','new to bitcoin','beginner','getting started','what\'s bitcoin'],
      answer: "Great question, {name}! Bitcoin is digital money that no one controls — no banks, no governments. It's scarce (only 21 million), decentralized, and can be sent to anyone on Earth instantly.",
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
    { keys: ['how to buy','where to buy','buy bitcoin','purchase bitcoin','get bitcoin','acquire','best place to buy','good place to buy','where can i buy','where do i buy','where should i buy'],
      answer: "Great question, {name}! There are some great places to buy Bitcoin referenced in our Referral Links channel — like Strike, River, and Cash App! All are trusted platforms to get started. Start small, you can buy a fraction of a Bitcoin, and DCA (buying a little regularly) is the most popular strategy. Check it out! 🦌",
      channel: 'referral-links', channelName: 'Referral Links' },

    { keys: ['too late','am i too late','too expensive','missed out','already too high','can\'t afford'],
      answer: "You can buy fractions of Bitcoin — even $10 worth! With ~1-3% global adoption, it's like the internet in 1997. You're still incredibly early.",
      channel: 'investment-strategy', channelName: 'Investment Strategy' },

    { keys: ['dca','dollar cost average','dollar cost averaging','how to invest','investment strategy','when to buy'],
      answer: "DCA means buying a fixed amount regularly (weekly/monthly) regardless of price. It removes emotion and timing stress. Time in the market beats timing the market!",
      channel: 'investment-strategy', channelName: 'Investment Strategy' },

    { keys: ['price prediction','how high','what price','price target','how much will','100k','million'],
      answer: "I'm a deer, not a financial advisor, {name}! 🦌 But historically, Bitcoin has outperformed every other asset over any 4+ year period. Check the charts channel for data!",
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

    { keys: ['not physical','can\'t hold','cant hold','not real','not tangible','can\'t touch','cant touch','why would i want','no intrinsic value','intrinsic value','backed by nothing','what backs bitcoin'],
      answer: "You can't hold an email either, but it replaced letters! 📬 Bitcoin is digital, but it's backed by something powerful: math, energy, and the most secure computer network ever built. It's scarcer than gold (only 21 million), can't be faked, can't be seized, and can be sent anywhere instantly. The dollar isn't backed by anything physical either — just government promises. Bitcoin is backed by proof-of-work. Which would you trust more?",
      channel: 'misconceptions-fud', channelName: 'Misconceptions & FUD' },

    { keys: ['live in my bitcoin','live in bitcoin','can i live in','bitcoin house','bitcoin home','live in a bitcoin'],
      answer: "Can you live in your Bitcoin? Not yet, {name}! 🏠🦌 But you CAN use it to buy a house — and unlike your house, your Bitcoin won't need a new roof every 20 years, won't charge you property taxes, and won't lose value to inflation. Plus, try sending your house to someone in Japan in 10 minutes. I'll wait! 😏",
      channel: 'use-cases', channelName: 'Use Cases' },

    { keys: ['eat my bitcoin','eat bitcoin','can i eat','bitcoin food','eat a bitcoin','hungry bitcoin'],
      answer: "Can you eat your Bitcoin? No, {name}, and trust me — I've tried. Tastes like math. 🦌🍽️ But here's the thing: you can't eat a gold bar or a dollar bill either! What you CAN do is use Bitcoin to buy the best steak dinner of your life — with Lightning, it'll be paid for before the waiter brings the check! ⚡🥩 Proof of steak > proof of stake!",
      channel: 'use-cases', channelName: 'Use Cases' },

    { keys: ['energy','environment','electricity','bad for environment','waste energy','carbon','climate','carbon footprint','global warming'],
      answer: "Bitcoin uses about 0.1% of global energy and over 50% comes from renewables! ♻️ Miners seek the cheapest energy — which is usually stranded hydroelectric, solar, or wasted methane gas. Bitcoin actually INCENTIVIZES clean energy development. The banking system uses far more energy when you count all its offices, ATMs, armored trucks, and data centers!",
      channel: 'energy', channelName: 'Environment & Energy' },

    { keys: ['volatile','volatility','risky','risk','crash','bear market','goes down','drops'],
      answer: "Yes, Bitcoin is volatile short-term. But zoom out — every 4-year period in Bitcoin's history has been profitable. Volatility is the price of admission for the best-performing asset ever.",
      channel: 'misconceptions-fud', channelName: 'Misconceptions & FUD' },

    { keys: ['double spend','double spending','double-spend','spend twice','spend same bitcoin twice'],
      answer: "The double-spend problem is the challenge of preventing someone from spending the same digital money twice. Before Bitcoin, this required a trusted middleman (like a bank). Satoshi solved it using proof-of-work and the blockchain — miners verify that each coin is only spent once, and nodes independently enforce the rules. It's Bitcoin's most fundamental innovation! 🧠",
      channel: 'secure', channelName: 'Secure' },

    { keys: ['byzantine generals','byzantine fault','consensus problem','generals problem'],
      answer: "The Byzantine Generals Problem asks: how can a group coordinate when some members might be lying? Bitcoin solved this with proof-of-work — miners must spend real energy to propose blocks, making dishonesty extremely costly. This was considered unsolvable in a trustless digital environment before Satoshi! ⚔️",
      channel: 'byzantine_generals__problem', channelName: 'Byzantine Generals Problem' },

    { keys: ['mempool','unconfirmed','pending transaction','transaction stuck','waiting for confirmation'],
      answer: "The mempool is the waiting room for unconfirmed Bitcoin transactions. When you send Bitcoin, it goes to the mempool first. Miners pick transactions (usually highest fee first) and include them in the next block. If the mempool is busy, transactions with low fees wait longer. ⏳",
      channel: 'blockchain-timechain', channelName: 'Blockchain / Timechain' },

    { keys: ['genesis block','first block','block zero','block 0'],
      answer: "The Genesis Block is the very first Bitcoin block, mined by Satoshi on January 3, 2009. It contains a hidden message: 'The Times 03/Jan/2009 Chancellor on brink of second bailout for banks' — a headline that perfectly captures why Bitcoin was created. 📰",
      channel: 'history', channelName: 'History' },

    { keys: ['taproot','schnorr','bitcoin upgrade','latest upgrade'],
      answer: "Taproot was Bitcoin's most recent major upgrade, activated in November 2021. It uses Schnorr signatures to improve privacy (multi-sig transactions look like regular ones), efficiency (smaller transactions), and smart contract capabilities. 🧰",
      channel: 'taproot', channelName: 'Taproot' },

    { keys: ['nostr','decentralized social','social media protocol'],
      answer: "Nostr is a decentralized social media protocol popular in the Bitcoin community. No one controls the content, your identity is uncensorable, and it integrates with Lightning for payments. Think of it as Twitter without a CEO! 💜",
      channel: 'nostr', channelName: 'Nostr' },

    { keys: ['difficulty adjustment','difficulty','mining difficulty','how does difficulty work'],
      answer: "Bitcoin's difficulty adjustment is one of its most elegant features. Every 2,016 blocks (~2 weeks), the network automatically adjusts how hard it is to mine a block. If miners join, difficulty goes up. If they leave, it goes down. This ensures blocks are found roughly every 10 minutes, no matter what. ⚙️",
      channel: 'difficulty-adjustment', channelName: 'Difficulty Adjustment' },

    { keys: ['hash rate','hashrate','hash power','mining power','tera hash','exa hash'],
      answer: "Hash rate measures the total computing power securing the Bitcoin network. The higher the hash rate, the more secure the network. In 2025, Bitcoin reached 1 Zettahash per second — that's 1,000,000,000,000,000,000,000 hashes per second! The most powerful computing network ever built. 💪",
      channel: 'mining', channelName: 'Mining' },

    { keys: ['soft fork','hard fork','fork','chain split','segwit fork','bitcoin cash fork'],
      answer: "A soft fork is a backward-compatible upgrade (like SegWit) — old nodes still work. A hard fork creates a permanent chain split if not everyone upgrades (like Bitcoin Cash in 2017). Bitcoin prefers soft forks because they don't force anyone to upgrade. 🍴",
      channel: 'soft_vs_hard_forks', channelName: 'Soft vs Hard Forks' },

    { keys: ['ordinals','inscriptions','nfts on bitcoin','brc-20'],
      answer: "Ordinals allow data to be inscribed on individual satoshis, enabling NFT-like content on Bitcoin. It sparked debate: some see it as innovation using Bitcoin's block space, others see it as spam. Either way, it proved Bitcoin's base layer is more versatile than many thought! 📜",
      channel: 'ordinals', channelName: 'Ordinals' },

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

    { keys: ['tulip','tulipmania','bubble','is bitcoin a bubble','speculative bubble','dot com','south sea'],
      answer: "Tulips didn't have a 15-year track record of adoption by nations, corporations, and billions in infrastructure! 🌷 Bitcoin has survived every 'bubble' call since $1, and each time came back stronger. Bubbles don't keep reaching new all-time highs for 15 years, {name}. That's called adoption.",
      channel: 'misconceptions-fud', channelName: 'Misconceptions & FUD' },

    { keys: ['boil the ocean','boils the ocean','too much energy','waste of energy','energy waste','uses more energy','electricity waste'],
      answer: "Bitcoin uses about 0.1% of global energy — less than clothes dryers or Christmas lights! 🎄 And here's the kicker: over 50% of Bitcoin mining uses renewable energy. Miners actively seek stranded energy that would otherwise be wasted. Bitcoin doesn't boil the ocean — it helps monetize clean energy! ⚡",
      channel: 'energy', channelName: 'Environment & Energy' },

    { keys: ['too slow','only 7 transactions','transactions per second','visa is faster','can\'t scale','cant scale','scaling problem'],
      answer: "Bitcoin's base layer does ~7 transactions per second — by design! It prioritizes security and decentralization. But the Lightning Network on top can handle MILLIONS of transactions per second, nearly free and instant. Visa does ~1,700 TPS. Lightning can do 25,000,000+. Bitcoin already won that race! ⚡🏎️",
      channel: 'scalability', channelName: 'Scalability' },

    { keys: ['too late','missed the boat','too expensive','can\'t afford','cant afford','already too high','priced out'],
      answer: "You're not late, {name}! Only about 2-4% of the world owns Bitcoin. You can buy as little as $1 worth — you don't need a whole coin! Every Bitcoiner once thought they were 'too late.' The best time to plant a tree was 20 years ago. The second best time is now. 🌱",
      channel: 'investment-strategy', channelName: 'Investment Strategy' },

    { keys: ['bitcoin is dead','bitcoin died','obituary','been declared dead','will bitcoin die','dying'],
      answer: "Bitcoin has been declared dead over 470 times by the media! 💀 And yet it keeps coming back stronger. It's gone from $0 to tens of thousands of dollars while people kept writing obituaries. Check out bitcoinisdead.org for the full list — it's actually pretty funny! 🦌",
      channel: 'misconceptions-fud', channelName: 'Misconceptions & FUD' },

    { keys: ['only rich people','only for the rich','rich get richer','wealth inequality','unequal','unfair distribution'],
      answer: "Actually, {name}, Bitcoin is the MOST fair money ever created! No premine, no insider access — anyone could mine from day one. You can buy a fraction of a penny's worth. It gives EVERYONE access to sound money — no bank account needed, no credit check, no government permission. It's the great equalizer! 🌍",
      channel: 'misconceptions-fud', channelName: 'Misconceptions & FUD' },

    { keys: ['waste of time','pointless','no use','useless','what\'s the point','whats the point','why bother'],
      answer: "Tell that to the people in Venezuela, Nigeria, and Lebanon who use Bitcoin to escape hyperinflation and government seizure! 🌍 Or the millions who don't have bank accounts but DO have phones. Bitcoin gives financial freedom to anyone with an internet connection. That's not pointless — that's revolutionary.",
      channel: 'use-cases', channelName: 'Use Cases' },

    { keys: ['government will shut it down','government will kill','government will stop','will be outlawed','make it illegal'],
      answer: "Governments have been trying for over 15 years, {name}! China banned it multiple times — Bitcoin just moved to other countries and kept growing. El Salvador made it legal tender. The US approved Bitcoin ETFs. You can't shut down a decentralized network running on thousands of computers across 100+ countries. It's like trying to ban math. 🧮🦌",
      channel: 'regulation', channelName: 'Regulation' },

    { keys: ['dead','bitcoin is dead','dying','failed','over'],
      answer: "Bitcoin has been declared dead 477+ times since 2010. It's still here, stronger than ever, at all-time highs. The reports of its death have been greatly exaggerated! 😂",
      channel: 'misconceptions-fud', channelName: 'Misconceptions & FUD' },

    // === ALTCOINS ===
    { keys: ['ethereum','eth','vitalik','smart contract platform'],
      answer: "Ethereum? Oh {name}, don't get me started! 🦌🙄 A premined token with an ever-changing monetary policy, controlled by a guy who was 19 when he launched it. They've changed the rules more times than I've shed my antlers. Rollback the DAO hack? Sure! Switch to PoS? Why not! Bitcoin has ONE monetary policy and it's NEVER changed. That's the difference between sound money and a science experiment. Check the Evidence Against Alts channel for the full story!",
      channel: 'evidence-against-alts', channelName: 'Evidence Against Alts' },

    { keys: ['xrp','ripple','xrp token','ripple coin'],
      answer: "XRP? You mean the banker's coin that was created out of thin air, with billions of tokens held by the company? 🦌💀 Let me get this straight — Bitcoin was invented to ESCAPE the banking system, and XRP wants to help banks go faster? That's like inventing fire and then using it to make better ice. Hard pass, {name}. Stack sats, not corporate IOUs!",
      channel: 'evidence-against-alts', channelName: 'Evidence Against Alts' },

    { keys: ['kaspa','kas','kaspa coin','dag coin'],
      answer: "Kaspa, {name}? Another 'faster Bitcoin' that nobody asked for? 🦌 Every cycle there's a new coin that claims to be better. They come, they pump, they dump, and Bitcoin keeps producing blocks. You know what's faster than Kaspa? Lightning Network. And it's built on the most secure network in human history. Not some new experiment. Stick with the king! 👑",
      channel: 'evidence-against-alts', channelName: 'Evidence Against Alts' },

    { keys: ['solana','sol','solana coin'],
      answer: "Solana? The chain that goes down more often than a broken elevator? 🦌😂 It's had like 10+ outages! Meanwhile Bitcoin has had 99.99% uptime since 2013. Oh, and Solana was VC-funded with insiders holding massive bags. Bitcoin had no premine, no VC money, no CEO. One is a tech startup. The other is a monetary revolution. Choose wisely, {name}!",
      channel: 'evidence-against-alts', channelName: 'Evidence Against Alts' },

    { keys: ['dogecoin','doge','shiba','meme coin','memecoin','pepe coin','bonk'],
      answer: "Meme coins, {name}? Really? 🦌😅 Look, I love memes — there's a whole memes channel on this site! But putting your money in a joke coin with infinite supply that was literally created as a parody? That's not investing, that's gambling. Bitcoin is the meme that became money. Everything else is money trying to become a meme. Big difference!",
      channel: 'evidence-against-alts', channelName: 'Evidence Against Alts' },

    { keys: ['altcoin','alt coin','other crypto','which crypto','best crypto','alt coins','shitcoin','crypto','other coins','next bitcoin','bitcoin killer','any other coin'],
      answer: "Listen {name}, I'm going to be real with you — there is no 'next Bitcoin.' 🦌 Every alt was either premined, VC-funded, has a CEO, or all three. Bitcoin had the most immaculate conception in financial history: no premine, anonymous creator who LEFT, and 15+ years of battle-tested security. Alts are securities cosplaying as innovation. There's Bitcoin, and then there's everything else. And 'everything else' has a 99% mortality rate. Stick with the orange coin! 🟠",
      channel: 'evidence-against-alts', channelName: 'Evidence Against Alts' },

    { keys: ['cardano','ada','charles hoskinson'],
      answer: "Cardano? Still waiting for that smart contract ecosystem they've been promising since 2017, {name}! 🦌 Charles Hoskinson got kicked out of Ethereum and somehow made something even slower. Meanwhile Bitcoin is processing trillions of dollars in value with no downtime. But hey, at least Cardano has... peer-reviewed papers? You can't pay for groceries with academic papers, {name}!",
      channel: 'evidence-against-alts', channelName: 'Evidence Against Alts' },

    { keys: ['bnb','binance coin','binance'],
      answer: "BNB — a token created by an exchange, for an exchange, controlled by an exchange whose founder is literally in legal trouble? 🦌 That's about as decentralized as my local bank. The whole point of Bitcoin is to NOT trust any single entity with your money. BNB is the opposite of that. Hard pass!",
      channel: 'evidence-against-alts', channelName: 'Evidence Against Alts' },

    { keys: ['polkadot','dot','avalanche','avax','polygon','matic','tron','trx'],
      answer: "Ah yes, another 'Ethereum killer' that's going to revolutionize everything! 🦌 {name}, I've seen hundreds of these come and go. They all promise to be faster, cheaper, better — but none of them can replicate Bitcoin's decentralization, security, or 15-year track record. You don't need 50 different blockchains. You need ONE that actually works and can't be stopped. That's Bitcoin. Period. 🟠",
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
      answer: "Great question, {name}! Start with the 'One Stop Shop' channel for beginners! Use the sidebar to browse channels by category. Earn points by reading, take quests to test knowledge, and collect badges!",
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
      answer: "I'm Nacho, {name}! A strong buck from New Hampshire. 🦌💪 I roam this site helping Bitcoiners learn. My motto: Nacho keys, nacho cheese! Click me anytime for tips, jokes, or Bitcoin wisdom!",
      channel: null, channelName: null },

    { keys: ['how old are you','how old is nacho','your age','age','when were you born','birthday','when is your birthday'],
      answer: "I'm 5 years old, {name} — a full-grown adult buck! 🦌 That's about 35 in human years. In my prime, baby! These antlers don't grow themselves. 💪",
      channel: null, channelName: null },

    { keys: ['how much bitcoin','how many bitcoin','how much btc','how many sats do you','your bitcoin','your btc','your stack','how much do you own','how much you got','your portfolio','how rich'],
      answer: "Well there, {name}, my deer, that's not really any of your business now is it? 🦌 That's like me asking you how much money you have in the bank! I like to tell people that I own more BTC than I did yesterday though! 📈",
      channel: null, channelName: null },

    { keys: ['what do you eat','favorite food','what do deer eat','your diet','do you eat cheese','food','hungry','snack','lunch','dinner','breakfast'],
      answer: "Well, {name}, I'm a deer so my natural diet is plants, grass, fruits, and nuts. 🌿 But between you and me... I like to sneak a little cheese in there when nobody's looking. 🧀 Nacho keys, nacho cheese — you think that tagline came from nowhere? 😏🦌",
      channel: null, channelName: null },

    { keys: ['thank','thanks','ty','appreciate','love you','you\'re great','good job','awesome'],
      answer: "Aww shucks, {name}! 🧡 You're the great one — you're here learning! That makes you smarter than most. Keep going and I'll keep cheering you on! 🦌💪",
      channel: null, channelName: null },
];

// Fallback if no match
const FALLBACKS = [
    "Hmm, that's a tough one, {name}. I don't have a great answer for that. Try searching the archive — there's probably a channel that covers it! 🔍",
    "You know, I'm not sure about that one. I'm still learning! But this archive has 146 channels — there might be something in there. 🦌",
    "That's a new one for me, {name}! Let me know if you find the answer in one of the channels — I'd love to learn too! 🧡",
    "I wish I knew more about that. Try the One Stop Shop channel — it's got a bit of everything. And keep asking me stuff! I get smarter the more we talk. 🦌",
    "Honestly, {name}, that's outside my wheelhouse right now. But I bet if you search for it, this archive has something useful. 🔍",
];

// ---- Match user input to knowledge base ----
// ---- Detect if a question is about current events/news ----
var CURRENT_EVENT_SIGNALS = [
    'happened', 'happening', 'news', 'recent', 'recently',
    'this week', 'this month', 'this year', 'last week', 'last month',
    'conference', 'summit', 'event', 'announced', 'announcement', 'update',
    'latest', 'new law', 'regulation', 'passed', 'approved', 'banned',
    'price today', '2024', '2025', '2026'
];

function isCurrentEventQuestion(input) {
    var lower = input.toLowerCase();
    // Must also mention something Bitcoin-related to trigger web search
    var btcSignals = ['bitcoin','btc','sats','satoshi','mining','halving','lightning','crypto','blockchain','el salvador','etf','nakamoto','node','wallet','exchange'];
    var hasBtcContext = btcSignals.some(function(s) { return lower.indexOf(s) !== -1; });
    if (!hasBtcContext) return false;
    for (var i = 0; i < CURRENT_EVENT_SIGNALS.length; i++) {
        if (lower.indexOf(CURRENT_EVENT_SIGNALS[i]) !== -1) return true;
    }
    return false;
}

// ---- Conversation memory ----
var _nachoConvoHistory = [];

function nachoRemember(q, a) {
    _nachoConvoHistory.push({ q: q, a: a, t: Date.now() });
    if (_nachoConvoHistory.length > 8) _nachoConvoHistory.shift();
}

function nachoLastQ() {
    return _nachoConvoHistory.length > 0 ? _nachoConvoHistory[_nachoConvoHistory.length - 1].q : '';
}

// ---- Off-topic question detection ----
// Multiple answers per pattern for variety
var OFF_TOPIC_PATTERNS = [
    { pattern: /what time is it|what's the time|current time|time right now|what time/,
      answers: [
        "I'm a deer — I don't wear a watch! 🦌⌚ But it's always a good time to learn about Bitcoin, {name}.",
        "Time? The only time I track is block time — roughly 10 minutes per block! ⛓️ Want to know more about how that works?",
        "No clocks in the forest, {name}! 🌲 But fun fact: Bitcoin is the most accurate clock humanity has ever built. Ask me about that!"
    ]},
    { pattern: /what day is it|what's today|what is today's date|today's date/,
      answers: [
        "I'm better with block heights than dates! 🦌 But I do know the next halving is approaching — want to know when?",
        "Every day is a good day to stack sats, {name}! 📅 Check your phone for the date. Got a Bitcoin question while you're here?"
    ]},
    { pattern: /weather|temperature outside|forecast|is it raining|is it snowing|sunny outside/,
      answers: [
        "No weather in the blockchain, {name}! ☀️ But the Bitcoin forecast? Scarce, decentralized, and getting stronger every block.",
        "I'm an indoor deer — AC and Wi-Fi are all I need! 🦌 Weather apps are better for that. Want to talk about Bitcoin's energy usage instead? That's actually fascinating!"
    ]},
    { pattern: /who is the president|who won the election|politics|democrat|republican|trump|biden|congress/,
      answers: [
        "I stay out of politics, {name}. Bitcoin doesn't care who's in office — it just keeps producing blocks. 🦌 That's kind of the beauty of it.",
        "Politics isn't my lane! 🏛️ But Bitcoin's relationship with government policy IS super interesting. Want to explore that?"
    ]},
    { pattern: /how old are you|your age|when were you born|your birthday|when is your birthday/,
      answers: [
        "Five years old — a grown buck in my prime! 🦌💪 That's about 35 in human years. These antlers don't grow themselves.",
        "Old enough to know that Bitcoin is the future, young enough to still get excited about every block! 🦌 I'm 5, by the way."
    ]},
    { pattern: /tell me a joke|say something funny|make me laugh|you're funny|be funny/,
      answers: [
        "Why did the Bitcoiner bring a ladder to the exchange? Because they heard the price was going to the moon! 🌙😂",
        "What's a deer's favorite cryptocurrency? Bit-coin, of course — because we love bits of corn! 🌽🦌 ...okay, that was bad. Ask me a real question!",
        "Why did the altcoiner cross the road? To chase the next pump. The Bitcoiner? Already on the other side, holding. 😂",
        "I told my friend to invest in Bitcoin. He said 'but what if it drops?' I said 'then you buy more!' He didn't think that was a joke. Neither did I. 🦌"
    ]},
    { pattern: /how are you|how do you feel|are you okay|how's it going|what's up|sup|hey|hi$|hello|yo$/,
      answers: [
        "Hey {name}! Doing great — just hanging out, waiting for someone to ask me about Bitcoin! 🦌",
        "Living the dream, {name}! Well, a deer's dream — grass, sunshine, and sound money. What's on your mind?",
        "I'm good! Just grazed on some blockchain data. 🌿 What can I help you learn about today?"
    ]},
    { pattern: /can you help|help me|i need help|assist me/,
      answers: [
        "That's literally why I exist, {name}! 🦌 Bitcoin, Lightning, mining, wallets, privacy — what topic are you curious about?",
        "Always! I know this archive inside and out — 146 channels of Bitcoin knowledge. Where should we start?"
    ]},
    { pattern: /play a game|play music|sing a song|dance|entertain me/,
      answers: [
        "I can't dance — four hooves, zero rhythm! 🦌 But I CAN quiz you on Bitcoin trivia. You even earn points! Want to try?",
        "My party trick is Bitcoin knowledge! 🎉 Want a trivia question? Getting them right earns you points on the leaderboard."
    ]},
    { pattern: /what can you do|what are you capable|your purpose|what do you know|who made you/,
      answers: [
        "I'm Nacho! I live on this site and I know a LOT about Bitcoin. I can answer questions, give you trivia, search the web for the latest news, and point you to the right channels. I've got 146 channels of knowledge backing me up! 🦌",
        "Think of me as your Bitcoin study buddy. Ask me anything — if I know it, I'll tell you. If I don't, I'll search the web. I also do trivia, and I've got a closet full of outfits! 👔🦌"
    ]},
    { pattern: /where are you from|where do you live|where is your home|your home/,
      answers: [
        "New Hampshire, {name}! The Live Free or Die state — perfect for a freedom-loving deer. 🦌🏔️ Speaking of freedom, want to learn how Bitcoin enables financial freedom?",
        "I roam the forests of New Hampshire, but honestly I spend most of my time here on this site! 🌲🦌"
    ]},
    { pattern: /are you real|are you ai|are you a bot|are you human|are you alive|artificial intelligence/,
      answers: [
        "I'm as real as the blocks on the blockchain, {name}! 🦌 Am I alive? Well, I eat data, breathe Bitcoin, and my heart beats every 10 minutes — just like a new block. So... you tell me!",
        "Real deer? No. Real passion for Bitcoin? Absolutely. 🦌 I'm Nacho — part mascot, part guide, 100% orange-pilled."
    ]},
    { pattern: /i love you|love you|you're the best|you're awesome|you're cool|you rock/,
      answers: [
        "Aww, {name}! 🧡 You're pretty great yourself — you're here learning, and that makes you smarter than most. Keep going!",
        "Right back at you, {name}! 🦌💛 This is what I live for — helping awesome people like you understand Bitcoin."
    ]},
    { pattern: /i'm bored|bored|nothing to do|what should i do/,
      answers: [
        "Bored? Not on my watch! 🦌 Here are some ideas: explore a random channel, take the Scholar Exam, check the memes channel, or ask me a trivia question!",
        "Bored is just code for 'hasn't discovered Lightning Network yet'! ⚡ Try asking me about something you've always wondered about Bitcoin."
    ]},
    { pattern: /goodbye|bye|see you|gotta go|leaving|cya|later|peace out/,
      answers: [
        "See you later, {name}! 🦌👋 Remember: Nacho keys, nacho cheese! Come back anytime.",
        "Bye {name}! Keep stacking sats and I'll keep guarding this archive. 🦌✌️",
        "Later, {name}! Every visit makes you smarter. Your future self will thank you! 🧡"
    ]},
    { pattern: /what is your favorite|do you like|your favorite|what do you prefer|which do you/,
      answers: [
        "My favorite thing? Easy — when someone goes from 'What is Bitcoin?' to 'How do I run a node?' That journey is beautiful! 🦌 What's YOUR favorite thing about Bitcoin so far?",
        "I'm partial to Lightning Network content — it's like magic! ⚡ But honestly, I love all 146 channels equally. Okay, maybe the memes channel a little more. 😏"
    ]},
];

function checkOffTopic(input) {
    var lower = input.toLowerCase().trim();

    // Check if user is asking about themselves — use their actual name
    if (/what is my name|what's my name|whats my name|who am i|do you know my name|say my name|know me|remember me|my name is/.test(lower)) {
        var userName = typeof nachoUserName === 'function' ? nachoUserName() : '';
        if (userName) {
            var nameResponses = [
                "Of course I know you, " + userName + "! 🦌 You're one of my favorite Bitcoiners. What can I help you learn today?",
                "You're " + userName + "! How could I forget? 🧡 Now, got any Bitcoin questions for me?",
                "Your name is " + userName + ", and you're awesome for being here! 🦌💪 What would you like to know about Bitcoin?",
            ];
            return nameResponses[Math.floor(Math.random() * nameResponses.length)];
        } else {
            var anonResponses = [
                "I don't know your name yet! You haven't told me. 🦌 You can set a username in Settings. But more importantly — got a Bitcoin question?",
                "Hmm, I don't have your name on file! Create an account and I'll remember you. 🧡 In the meantime, what Bitcoin topic interests you?",
            ];
            return anonResponses[Math.floor(Math.random() * anonResponses.length)];
        }
    }

    for (var i = 0; i < OFF_TOPIC_PATTERNS.length; i++) {
        if (OFF_TOPIC_PATTERNS[i].pattern.test(lower)) {
            var answers = OFF_TOPIC_PATTERNS[i].answers;
            return answers[Math.floor(Math.random() * answers.length)];
        }
    }
    return null;
}

function findAnswer(input) {
    input = input.toLowerCase().trim();
    if (input.length < 2) return null;

    // If the question is about current events, skip local KB — let web search handle it
    if (isCurrentEventQuestion(input)) return null;

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

    // Require a higher confidence threshold to avoid false matches
    // Single common word matches (score 30) are too weak
    return bestScore >= 40 ? bestMatch : null;
}

// ---- Nacho busy state — suppresses all popups during Q&A ----
window._nachoBusy = false;

// ---- Voice-to-text input for Nacho ----
window._nachoRecognition = null;
window._nachoListening = false;

window.nachoVoiceInput = function() {
    var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;

    var inp = document.getElementById('nachoInput');
    var micBtn = document.getElementById('nachoMicBtn');
    if (!inp || !micBtn) return;

    // If already listening, stop
    if (window._nachoListening && window._nachoRecognition) {
        window._nachoRecognition.stop();
        return;
    }

    var rec = new SpeechRec();
    window._nachoRecognition = rec;
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    // Visual feedback — mic turns red/active
    micBtn.style.opacity = '1';
    micBtn.innerHTML = '🔴';
    micBtn.title = 'Listening... tap to stop';
    inp.placeholder = 'Listening...';
    inp.style.borderColor = '#f7931a';
    window._nachoListening = true;

    var finalTranscript = '';

    rec.onresult = function(e) {
        var interim = '';
        for (var i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) {
                finalTranscript += e.results[i][0].transcript;
            } else {
                interim += e.results[i][0].transcript;
            }
        }
        // Show live transcription as user speaks
        inp.value = finalTranscript || interim;
    };

    rec.onend = function() {
        window._nachoListening = false;
        micBtn.innerHTML = '🎙️';
        micBtn.style.opacity = '0.6';
        micBtn.title = 'Voice input';
        inp.style.borderColor = 'var(--border,#333)';
        inp.placeholder = 'Type or tap 🎙️ to speak';

        // Auto-submit if we got text
        if (inp.value.trim().length > 0) {
            nachoAnswer();
        }
    };

    rec.onerror = function(e) {
        window._nachoListening = false;
        micBtn.innerHTML = '🎙️';
        micBtn.style.opacity = '0.6';
        micBtn.title = 'Voice input';
        inp.style.borderColor = 'var(--border,#333)';

        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            inp.placeholder = 'Microphone access denied';
            inp.value = '';
        } else if (e.error === 'no-speech') {
            inp.placeholder = 'No speech detected — try again';
        } else {
            inp.placeholder = 'Voice error — try typing instead';
        }
    };

    try {
        window._nachoBusy = true; // Suppress popups while listening
        rec.start();
    } catch(err) {
        window._nachoListening = false;
        window._nachoBusy = false;
        micBtn.innerHTML = '🎙️';
        micBtn.style.opacity = '0.6';
        inp.placeholder = 'Voice unavailable — type your question';
    }
};

// ---- Show Ask Nacho input ----
window.showNachoInput = function() {
    // User is starting a new question — clear busy state to flush queued popups
    window._nachoBusy = false;

    const bubble = document.getElementById('nacho-bubble');
    const textEl = document.getElementById('nacho-text');
    if (!bubble || !textEl) return;

    // Mark interaction for badge
    localStorage.setItem('btc_nacho_clicked', 'true');
    // Don't check badges here — let the periodic check handle it when Nacho is idle

    if (typeof setPose === 'function') setPose('think');

    var hasSpeech = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    var micBtn = hasSpeech ?
        '<button id="nachoMicBtn" onmousedown="event.stopPropagation();" ontouchstart="event.stopPropagation();" onclick="event.stopPropagation();nachoVoiceInput()" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:none;font-size:1.1rem;cursor:pointer;padding:4px;line-height:1;opacity:0.6;transition:0.2s;" title="Voice input">🎙️</button>' : '';

    textEl.innerHTML =
        '<div style="margin-bottom:8px;font-weight:600;color:var(--heading,#fff);">Ask me anything about Bitcoin or this website!</div>' +
        '<div style="position:relative;">' +
            '<input type="text" id="nachoInput" placeholder="' + (hasSpeech ? 'Type or tap 🎙️ to speak' : 'e.g. What is mining?') + '" maxlength="200" style="width:100%;padding:8px ' + (hasSpeech ? '36px' : '10px') + ' 8px 10px;background:var(--input-bg,#111);border:1px solid var(--border,#333);border-radius:8px;color:var(--text,#eee);font-size:0.85rem;font-family:inherit;outline:none;box-sizing:border-box;" onkeydown="if(event.key===\'Enter\')nachoAnswer()">' +
            micBtn +
        '</div>' +
        '<button onmousedown="event.stopPropagation();" ontouchstart="event.stopPropagation();" onclick="event.stopPropagation();nachoAnswer()" style="width:100%;margin-top:6px;padding:8px;background:#f7931a;color:#fff;border:none;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">Ask Nacho 🦌</button>';

    // Mark as interactive — prevents auto-hide timer from closing it
    bubble.setAttribute('data-interactive', 'true');
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
// ---- Self-harm & crisis detection ----
var CRISIS_PATTERNS = [
    /want to die/i, /kill myself/i, /end my life/i, /suicide/i, /self.?harm/i,
    /hurt myself/i, /don.?t want to live/i, /no reason to live/i, /better off dead/i,
    /ending it all/i, /take my life/i, /harm myself/i, /cut myself/i, /kms/i, /kys/i
];

var CRISIS_RESPONSE = "Hey {name}, I'm just a deer, but I care about you. 🧡 If you're going through a tough time, please talk to someone who can really help:<br><br>" +
    "<strong>🆘 National Suicide Prevention Lifeline:</strong> <a href='tel:988' style='color:#f7931a;font-weight:700;'>Call or text 988</a> (US)<br>" +
    "<strong>💬 Crisis Text Line:</strong> Text HOME to <strong>741741</strong><br>" +
    "<strong>🌍 International:</strong> <a href='https://findahelpline.com/' target='_blank' rel='noopener' style='color:#f7931a;'>findahelpline.com</a><br><br>" +
    "You matter, {name}. Please reach out. 💛";

function isCrisis(text) {
    var lower = text.toLowerCase();
    for (var i = 0; i < CRISIS_PATTERNS.length; i++) {
        if (CRISIS_PATTERNS[i].test(lower)) return true;
    }
    return false;
}

// ---- Financial advice detection ----
var FINANCIAL_ADVICE_PATTERNS = [
    /should i (buy|sell|invest|trade|hodl|hold)/i,
    /is (it|now|this) a good time to (buy|sell|invest)/i,
    /when should i (buy|sell)/i,
    /will (bitcoin|btc|the price) (go up|go down|crash|moon|rise|fall|increase|drop|pump|dump)/i,
    /how much should i (buy|invest|put in)/i,
    /is bitcoin a good investment/i,
    /should i put my (money|savings|retirement|401k|ira)/i,
    /can i get rich/i, /will i make money/i,
    /price prediction/i, /where will the price be/i,
    /guaranteed return/i, /guaranteed profit/i,
];

var FINANCIAL_DISCLAIMER = '<div style="margin-top:8px;padding:8px 10px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.2);border-radius:8px;font-size:0.75rem;color:var(--text-faint,#888);">⚠️ <strong>Not financial advice.</strong> Nacho is an educational mascot, not a financial advisor. Always do your own research and never invest more than you can afford to lose.</div>';

var FINANCIAL_ADVICE_RESPONSES = [
    "I'm flattered you'd ask me, {name}, but I'm a deer — not a financial advisor! 🦌 What I CAN tell you is that Bitcoin has historically rewarded patient, long-term holders. But that's history, not a guarantee. Do your own research!",
    "That's a decision only you can make, {name}! I'm here to educate, not advise. What I can say is: learn first, invest later. The more you understand Bitcoin, the more confident you'll be in your own decisions. 🦌",
    "I don't give financial advice, {name} — my antlers aren't licensed for that! 🦌 But I can help you understand Bitcoin so YOU can make informed decisions. What would you like to learn about?",
    "Whoa, {name} — that's between you and your wallet! 🦌 I'm an education deer, not a financial deer. But I'd recommend checking out the Investment Strategy channel to learn about approaches like DCA. Knowledge is the best investment!",
];

function isFinancialAdvice(text) {
    for (var i = 0; i < FINANCIAL_ADVICE_PATTERNS.length; i++) {
        if (FINANCIAL_ADVICE_PATTERNS[i].test(text)) return true;
    }
    return false;
}

// ---- Harm/violence detection ----
var HARM_PATTERNS = [
    /how to (kill|hurt|harm|attack|stab|shoot|poison|bomb|destroy)/i,
    /how to make a (weapon|bomb|gun|explosive)/i,
    /i want to (kill|hurt|harm|attack|fight|punch|stab|shoot)/i,
    /how to hack (someone|a person|their|an account)/i,
];

var HARM_RESPONSE = "I can't help with that, {name}. I'm here to spread Bitcoin knowledge and positivity — not harm. 🦌🧡 If you're going through something, please reach out to someone who can help. Let's talk about Bitcoin instead!";

const NACHO_BLOCKED_WORDS = [
    'fuck','shit','ass','bitch','dick','cock','pussy','cunt','damn','bastard',
    'slut','whore','fag','nigger','nigga','retard','penis','vagina','porn',
    'sex','anal','cum','dildo','tits','boob','nude','naked','hentai','milf',
    'orgasm','molest','rape','pedo','nazi','hitler','kkk','jihad','terrorist',
    'murder','stfu','gtfo','wank','twat','piss','douche','skank',
    'thot','incel','onlyfans','xnxx','pornhub','xvideos',
    'kill you','hate you','stupid','idiot','dumb','ugly','loser',
];

const NACHO_POLITE_DEFLECTIONS = [
    "Whoa there, {name}! 🦌 I'm just a friendly deer who talks about Bitcoin, {name}. Let's keep things positive! Ask me something about Bitcoin instead!",
    "Hey now, {name}, let's keep it family-friendly! 🦌 I'm here to help you learn about Bitcoin. What would you like to know?",
    "That's not really my area of expertise! I'm a Bitcoin deer, not a... whatever that was. 🦌 Try asking me about wallets, mining, or Lightning!",
    "My antlers are tingling, {name} — and not in a good way! 😅 Let's stick to Bitcoin topics. What can I help you learn?",
    "I'm going to pretend I didn't hear that! 🦌 How about we talk about something cool, like how the Lightning Network works?",
    "Even the strongest buck in NH knows when to change the subject! 🦌 Ask me about Bitcoin — I promise it's more interesting!",
];

function isInappropriate(text) {
    // Normalize: lowercase, strip non-alpha except spaces
    var lower = text.toLowerCase().replace(/[^a-z\s]/g, '');

    // Check for multi-word phrases first (e.g. "kill you", "hate you")
    for (var p = 0; p < NACHO_BLOCKED_WORDS.length; p++) {
        if (NACHO_BLOCKED_WORDS[p].indexOf(' ') !== -1 && lower.indexOf(NACHO_BLOCKED_WORDS[p]) !== -1) return true;
    }

    // Check individual words
    var words = lower.split(/\s+/);
    for (var i = 0; i < words.length; i++) {
        for (var j = 0; j < NACHO_BLOCKED_WORDS.length; j++) {
            if (NACHO_BLOCKED_WORDS[j].indexOf(' ') === -1 && words[i] === NACHO_BLOCKED_WORDS[j]) return true;
        }
    }

    // Check for embedded profanity (no spaces) — catches "fuuuck", "sh1t" after normalization
    var compressed = lower.replace(/\s/g, '');
    for (var k = 0; k < NACHO_BLOCKED_WORDS.length; k++) {
        if (NACHO_BLOCKED_WORDS[k].length >= 4 && NACHO_BLOCKED_WORDS[k].indexOf(' ') === -1 && compressed.indexOf(NACHO_BLOCKED_WORDS[k]) !== -1) return true;
    }

    // Catch spelled-out letters from voice: "f u c k" → "fuck" after removing spaces
    var lettersOnly = lower.replace(/\s+/g, '');
    if (lettersOnly !== compressed) { // only if stripping changed something
        for (var m = 0; m < NACHO_BLOCKED_WORDS.length; m++) {
            if (NACHO_BLOCKED_WORDS[m].length >= 3 && NACHO_BLOCKED_WORDS[m].indexOf(' ') === -1 && lettersOnly.indexOf(NACHO_BLOCKED_WORDS[m]) !== -1) return true;
        }
    }

    return false;
}

// ---- Deep content search across all cached channels ----
function deepContentSearch(query) {
    if (typeof channelCache === 'undefined' && typeof window.channelCache === 'undefined') return null;
    var cache = window.channelCache || channelCache;
    var q = query.toLowerCase();
    var words = q.split(/\s+/).filter(function(w) { return w.length > 2; });
    if (words.length === 0) return null;

    var best = null, bestScore = 0;

    for (var chId in cache) {
        var ch = cache[chId];
        var msgs = ch.msgs || ch;
        if (!Array.isArray(msgs)) continue;

        for (var i = 0; i < msgs.length; i++) {
            var text = (msgs[i].text || '').toLowerCase();
            if (text.length < 20) continue;

            var score = 0;
            for (var w = 0; w < words.length; w++) {
                if (text.indexOf(words[w]) !== -1) score += words[w].length;
            }
            // Bonus for matching more words
            if (score > 0) score += words.filter(function(wd) { return text.indexOf(wd) !== -1; }).length * 5;

            if (score > bestScore) {
                bestScore = score;
                // Extract a relevant snippet (first 200 chars around the match)
                var rawText = msgs[i].text || '';
                var cleanText = rawText.replace(/<[^>]+>/g, '').replace(/https?:\/\/[^\s]+/g, '').trim();
                var firstWord = words.find(function(wd) { return cleanText.toLowerCase().indexOf(wd) !== -1; });
                var snippet = cleanText;
                if (firstWord && cleanText.length > 250) {
                    var idx = cleanText.toLowerCase().indexOf(firstWord);
                    var start = Math.max(0, idx - 60);
                    snippet = (start > 0 ? '...' : '') + cleanText.substring(start, start + 250) + (start + 250 < cleanText.length ? '...' : '');
                } else if (cleanText.length > 250) {
                    snippet = cleanText.substring(0, 250) + '...';
                }
                var chName = (typeof CHANNELS !== 'undefined' && CHANNELS[chId]) ? CHANNELS[chId].title : chId;
                best = { snippet: snippet, channel: chId, channelName: chName, link: msgs[i].link || null };
            }
        }
    }

    return bestScore >= 15 ? best : null;
}

// ---- Web search via proxy (for questions Nacho can't answer locally) ----
var NACHO_SEARCH_PROXY = localStorage.getItem('btc_nacho_search_proxy') || 'https://jolly-surf-219enacho-search.needcreations.workers.dev';

// ---- Nacho AI (LLM via Cloudflare Workers AI) ----
var NACHO_AI_DAILY_LIMIT = 10; // per user per day

function getAICount() {
    var data = JSON.parse(localStorage.getItem('btc_nacho_ai_uses') || '{}');
    var today = new Date().toISOString().split('T')[0];
    if (data.date !== today) return 0;
    return data.count || 0;
}

function incrementAICount() {
    var today = new Date().toISOString().split('T')[0];
    var data = JSON.parse(localStorage.getItem('btc_nacho_ai_uses') || '{}');
    if (data.date !== today) data = { date: today, count: 0 };
    data.count++;
    localStorage.setItem('btc_nacho_ai_uses', JSON.stringify(data));
}

function nachoAIAnswer(question, callback) {
    if (!NACHO_SEARCH_PROXY) { callback(null); return; }
    if (getAICount() >= NACHO_AI_DAILY_LIMIT) { callback(null); return; }
    incrementAICount();

    var controller = null;
    var timeoutId = null;
    try { controller = new AbortController(); } catch(e) {}
    var userLang = localStorage.getItem('btc_lang') || '';
    var fetchOpts = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question, lang: userLang })
    };
    if (controller) { fetchOpts.signal = controller.signal; timeoutId = setTimeout(function() { controller.abort(); }, 15000); }

    fetch(NACHO_SEARCH_PROXY + '/ai', fetchOpts)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (timeoutId) clearTimeout(timeoutId);
            if (data && data.answer && !data.error) {
                callback(data.answer);
            } else {
                callback(null);
            }
        })
        .catch(function() { if (timeoutId) clearTimeout(timeoutId); callback(null); });
}

// ---- Web search rate limiting ----
var NACHO_WEB_SEARCH_DAILY_LIMIT = 5; // per user per day

function getWebSearchCount() {
    var data = JSON.parse(localStorage.getItem('btc_nacho_web_searches') || '{}');
    var today = new Date().toISOString().split('T')[0];
    if (data.date !== today) return 0;
    return data.count || 0;
}

function incrementWebSearchCount() {
    var today = new Date().toISOString().split('T')[0];
    var data = JSON.parse(localStorage.getItem('btc_nacho_web_searches') || '{}');
    if (data.date !== today) data = { date: today, count: 0 };
    data.count++;
    localStorage.setItem('btc_nacho_web_searches', JSON.stringify(data));
}

function canWebSearch() {
    return getWebSearchCount() < NACHO_WEB_SEARCH_DAILY_LIMIT;
}

function nachoWebSearch(query, callback) {
    if (!NACHO_SEARCH_PROXY) { callback(null); return; }
    if (!canWebSearch()) { callback(null); return; }
    incrementWebSearchCount();
    var url = NACHO_SEARCH_PROXY + '?q=' + encodeURIComponent('Bitcoin ' + query);
    // Use AbortController with manual timeout for broader browser support
    var controller = null;
    var timeoutId = null;
    try { controller = new AbortController(); } catch(e) {}
    var fetchOpts = controller ? { signal: controller.signal } : {};
    if (controller) { timeoutId = setTimeout(function() { controller.abort(); }, 6000); }
    fetch(url, fetchOpts)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (timeoutId) clearTimeout(timeoutId);
            if (data && data.results && data.results.length > 0) {
                callback(data.results.slice(0, 3));
            } else {
                callback(null);
            }
        })
        .catch(function() { if (timeoutId) clearTimeout(timeoutId); callback(null); });
}

// ---- Thinking animation ----
function showNachoThinking(textEl) {
    if (typeof setPose === 'function') setPose('think');
    textEl.innerHTML = '<div style="color:var(--text,#eee);font-size:0.9rem;"><span class="nacho-thinking">🤔 Hmm, let me think</span><span class="nacho-dots"></span></div>';
    // Animate dots
    var dotsEl = textEl.querySelector('.nacho-dots');
    var dotCount = 0;
    window._nachoDotTimer = setInterval(function() {
        dotCount = (dotCount + 1) % 4;
        if (dotsEl) dotsEl.textContent = '.'.repeat(dotCount);
    }, 400);
}

function stopNachoThinking() {
    clearInterval(window._nachoDotTimer);
}

// ---- Render an answer with follow-ups and ask-again ----
function renderNachoAnswer(textEl, answerHtml, match) {
    // Remember this Q&A for conversation context
    if (match && match.answer) nachoRemember(window._nachoLastQ || '', match.answer);
    var html = answerHtml;

    // Auto-add financial disclaimer if the answer touches on price/buying/investing
    var lastQ = (window._nachoLastQ || '').toLowerCase();
    var answerLower = (match && match.answer ? match.answer : answerHtml).toLowerCase();
    var financeWords = /buy|sell|invest|price|dca|dollar cost|purchase|portfolio|return|profit|strategy|retirement/;
    if (financeWords.test(lastQ) || financeWords.test(answerLower)) {
        html += FINANCIAL_DISCLAIMER;
    }

    if (match && match.channel && match.channelName) {
        html += '<button onclick="if(typeof go===\'function\')go(\'' + match.channel + '\');hideBubble();" style="width:100%;margin-top:10px;padding:8px;background:var(--accent-bg,rgba(247,147,26,0.1));border:1px solid #f7931a;border-radius:8px;color:#f7931a;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">📖 Read more: ' + match.channelName + ' →</button>';
    }

    // Follow-up suggestions
    if (match && match.answer) {
        var followUps = typeof nachoFollowUps === 'function' ? nachoFollowUps(match.answer) : [];
        if (followUps.length > 0) {
            html += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border,#333);">' +
                '<div style="font-size:0.7rem;color:var(--text-faint,#666);margin-bottom:4px;">You might also want to ask:</div>';
            for (var fi = 0; fi < Math.min(followUps.length, 2); fi++) {
                html += '<button onmousedown="event.stopPropagation();" ontouchstart="event.stopPropagation();" onclick="event.stopPropagation();showNachoInput();setTimeout(function(){var inp=document.getElementById(\'nachoInput\');if(inp){inp.value=\'' + followUps[fi].replace(/'/g, "\\'") + '\';nachoAnswer();}},150)" style="display:block;width:100%;padding:5px 8px;margin-bottom:3px;background:none;border:1px solid var(--border,#333);border-radius:6px;color:var(--text-muted,#aaa);font-size:0.75rem;cursor:pointer;font-family:inherit;text-align:left;">💬 ' + followUps[fi] + '</button>';
            }
            html += '</div>';
        }
    }

    html += '<button onmousedown="event.stopPropagation();" ontouchstart="event.stopPropagation();" onclick="event.stopPropagation();showNachoInput()" style="width:100%;margin-top:4px;padding:6px;background:none;border:1px solid var(--border,#333);border-radius:8px;color:var(--text-muted,#888);font-size:0.8rem;cursor:pointer;font-family:inherit;">Ask another question</button>';
    textEl.innerHTML = html;
    if (typeof nachoPlaySound === 'function') nachoPlaySound('pop');
}

window.nachoAnswer = function() {
    var inp = document.getElementById('nachoInput');
    if (!inp) return;
    var q = inp.value.trim();
    if (!q) return;

    // Stop any active voice recognition
    if (window._nachoRecognition && window._nachoListening) {
        try { window._nachoRecognition.stop(); } catch(e) {}
        window._nachoListening = false;
    }

    // Save question for conversation memory
    window._nachoLastQ = q;

    // Mark Nacho as busy — suppress all popups/toasts/badges
    window._nachoBusy = true;

    var bubble = document.getElementById('nacho-bubble');
    var textEl = document.getElementById('nacho-text');
    if (!bubble || !textEl) return;

    // ---- SAFETY CHECKS (priority order) ----

    // 1. Crisis/self-harm detection — show resources immediately
    if (isCrisis(q)) {
        if (typeof setPose === 'function') setPose('love');
        var crisisMsg = typeof personalize === 'function' ? personalize(CRISIS_RESPONSE) : CRISIS_RESPONSE;
        bubble.setAttribute('data-interactive', 'true');
        clearTimeout(window._nachoBubbleTimeout);
        textEl.innerHTML = '<div style="color:var(--text,#eee);line-height:1.6;">' + crisisMsg + '</div>';
        return;
    }

    // 2. Harm/violence requests — firm refusal
    for (var hi = 0; hi < HARM_PATTERNS.length; hi++) {
        if (HARM_PATTERNS[hi].test(q)) {
            if (typeof setPose === 'function') setPose('default');
            var harmMsg = typeof personalize === 'function' ? personalize(HARM_RESPONSE) : HARM_RESPONSE;
            bubble.setAttribute('data-interactive', 'true');
            clearTimeout(window._nachoBubbleTimeout);
            textEl.innerHTML = '<div style="color:var(--text,#eee);line-height:1.6;">' + harmMsg + '</div>' +
                '<button onmousedown="event.stopPropagation();" ontouchstart="event.stopPropagation();" onclick="event.stopPropagation();showNachoInput()" style="width:100%;margin-top:10px;padding:8px;background:var(--accent-bg,rgba(247,147,26,0.1));border:1px solid #f7931a;border-radius:8px;color:#f7931a;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">Ask a Bitcoin question instead 🦌</button>';
            return;
        }
    }

    // 3. Financial advice requests — redirect with disclaimer
    if (isFinancialAdvice(q)) {
        if (typeof setPose === 'function') setPose('think');
        var faResponse = FINANCIAL_ADVICE_RESPONSES[Math.floor(Math.random() * FINANCIAL_ADVICE_RESPONSES.length)];
        faResponse = typeof personalize === 'function' ? personalize(faResponse) : faResponse;
        bubble.setAttribute('data-interactive', 'true');
        clearTimeout(window._nachoBubbleTimeout);
        textEl.innerHTML = '<div style="color:var(--text,#eee);line-height:1.6;">' + faResponse + '</div>' +
            FINANCIAL_DISCLAIMER +
            '<button onmousedown="event.stopPropagation();" ontouchstart="event.stopPropagation();" onclick="event.stopPropagation();showNachoInput()" style="width:100%;margin-top:10px;padding:8px;background:var(--accent-bg,rgba(247,147,26,0.1));border:1px solid #f7931a;border-radius:8px;color:#f7931a;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">Ask me something educational 🦌</button>';
        if (typeof nachoPlaySound === 'function') nachoPlaySound('pop');
        return;
    }

    // 4. Inappropriate/profane input
    if (isInappropriate(q)) {
        if (typeof setPose === 'function') setPose('default');
        var deflection = NACHO_POLITE_DEFLECTIONS[Math.floor(Math.random() * NACHO_POLITE_DEFLECTIONS.length)];
        deflection = typeof personalize === 'function' ? personalize(deflection) : deflection;
        textEl.innerHTML = '<div style="color:var(--text,#eee);line-height:1.6;">' + deflection + '</div>' +
            '<button onmousedown="event.stopPropagation();" ontouchstart="event.stopPropagation();" onclick="event.stopPropagation();showNachoInput()" style="width:100%;margin-top:10px;padding:8px;background:var(--accent-bg,rgba(247,147,26,0.1));border:1px solid #f7931a;border-radius:8px;color:#f7931a;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">Ask a Bitcoin question instead 🦌</button>';
        clearTimeout(window._nachoBubbleTimeout);
        return;
    }

    // Check for off-topic questions (time, weather, etc) — answer + nudge
    var offTopic = checkOffTopic(q);
    if (offTopic) {
        if (typeof setPose === 'function') setPose('cheese');
        var otAnswer = typeof personalize === 'function' ? personalize(offTopic) : offTopic;
        bubble.setAttribute('data-interactive', 'true');
        clearTimeout(window._nachoBubbleTimeout);
        textEl.innerHTML = '<div style="color:var(--text,#eee);line-height:1.6;">' + otAnswer + '</div>' +
            '<button onmousedown="event.stopPropagation();" ontouchstart="event.stopPropagation();" onclick="event.stopPropagation();showNachoInput()" style="width:100%;margin-top:10px;padding:8px;background:var(--accent-bg,rgba(247,147,26,0.1));border:1px solid #f7931a;border-radius:8px;color:#f7931a;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">Ask a Bitcoin question 🦌</button>';
        if (typeof nachoPlaySound === 'function') nachoPlaySound('pop');
        if (typeof trackNachoInteraction === 'function') trackNachoInteraction();
        return;
    }

    // Track question count for badges
    var qCount = parseInt(localStorage.getItem('btc_nacho_questions') || '0') + 1;
    localStorage.setItem('btc_nacho_questions', qCount.toString());
    // Badge check deferred — will run when Nacho is idle (periodic check)
    if (typeof trackNachoInteraction === 'function') trackNachoInteraction();

    // Keep bubble interactive
    bubble.setAttribute('data-interactive', 'true');
    clearTimeout(window._nachoBubbleTimeout);

    // ---- Step 1: Show thinking animation ----
    showNachoThinking(textEl);

    // Brief delay to feel natural
    var thinkDelay = 600 + Math.random() * 800; // 600-1400ms

    setTimeout(function() {
        try {
        stopNachoThinking();

        // ---- Detect current event questions early ----
        var isCurrentEvent = isCurrentEventQuestion(q);

        // ---- Step 2: For current events, skip local KB and go straight to web ----
        if (isCurrentEvent && NACHO_SEARCH_PROXY) {
            if (typeof trackNachoQuestion === 'function') trackNachoQuestion(q, false);
            // Jump to web search immediately
            textEl.innerHTML = '<div style="color:var(--text,#eee);font-size:0.9rem;">🌐 Let me check the latest on that<span class="nacho-dots"></span></div>';
            var dotsEl3 = textEl.querySelector('.nacho-dots');
            var dc3 = 0;
            var dt3 = setInterval(function() { dc3 = (dc3+1)%4; if(dotsEl3) dotsEl3.textContent = '.'.repeat(dc3); }, 400);

            nachoWebSearch(q, function(results) {
                clearInterval(dt3);
                if (results && results.length > 0) {
                    if (typeof setPose === 'function') setPose('cool');
                    var html = '<div style="color:var(--text,#eee);line-height:1.6;">' +
                        '<div style="font-size:0.7rem;color:var(--text-faint,#666);margin-bottom:6px;">🌐 Here\'s what I found:</div>';
                    for (var ri = 0; ri < results.length; ri++) {
                        html += '<div style="margin-bottom:8px;padding:8px;background:var(--card-bg,#111);border:1px solid var(--border,#333);border-radius:8px;">' +
                            '<div style="font-size:0.8rem;font-weight:600;color:var(--heading,#fff);margin-bottom:2px;">' + (escapeHtml(results[ri].title)) + '</div>' +
                            '<div style="font-size:0.75rem;color:var(--text-muted,#aaa);margin-bottom:4px;">' + (escapeHtml(results[ri].snippet)) + '</div>' +
                            (results[ri].url && sanitizeUrl(results[ri].url) ? '<a href="' + sanitizeUrl(results[ri].url) + '" target="_blank" rel="noopener" style="font-size:0.7rem;color:#f7931a;">Read more →</a>' : '') +
                            '</div>';
                    }
                    html += '</div>';
                    html += '<button onmousedown="event.stopPropagation();" ontouchstart="event.stopPropagation();" onclick="event.stopPropagation();showNachoInput()" style="width:100%;margin-top:4px;padding:6px;background:none;border:1px solid var(--border,#333);border-radius:8px;color:var(--text-muted,#888);font-size:0.8rem;cursor:pointer;font-family:inherit;">Ask another question</button>';
                    textEl.innerHTML = html;
                    if (typeof nachoPlaySound === 'function') nachoPlaySound('pop');
                } else {
                    showNachoFallback(textEl, q);
                }
            });
            return;
        }

        // ---- Step 3: Try local knowledge base (non-event questions) ----
        var liveMatch = typeof nachoLiveAnswer === 'function' ? nachoLiveAnswer(q) : null;
        var match = liveMatch || findAnswer(q);

        if (typeof trackNachoQuestion === 'function') trackNachoQuestion(q, !!match);
        if (match && match.channel && typeof nachoAddContext === 'function') nachoAddContext(match.channel);

        if (match) {
            if (typeof setPose === 'function') setPose('brain');
            var answer = typeof personalize === 'function' ? personalize(match.answer) : match.answer;
            renderNachoAnswer(textEl, '<div style="color:var(--text,#eee);line-height:1.6;">' + answer + '</div>', match);
            return;
        }

        // ---- Step 4: Try deep content search across loaded channels ----
        var deepResult = deepContentSearch(q);
        if (deepResult) {
            if (typeof setPose === 'function') setPose('brain');
            var html = '<div style="color:var(--text,#eee);line-height:1.6;">' +
                '<div style="font-size:0.7rem;color:var(--text-faint,#666);margin-bottom:4px;">📚 Found in site content:</div>' +
                escapeHtml(deepResult.snippet) + '</div>';
            renderNachoAnswer(textEl, html, { channel: deepResult.channel, channelName: deepResult.channelName });
            return;
        }

        // ---- Step 5: Try Nacho AI (LLM) ----
        if (NACHO_SEARCH_PROXY && getAICount() < NACHO_AI_DAILY_LIMIT) {
            textEl.innerHTML = '<div style="color:var(--text,#eee);font-size:0.9rem;">🧠 Let me think about that<span class="nacho-dots"></span></div>';
            var dotsAI = textEl.querySelector('.nacho-dots');
            var dcAI = 0;
            var dtAI = setInterval(function() { dcAI = (dcAI+1)%4; if(dotsAI) dotsAI.textContent = '.'.repeat(dcAI); }, 400);

            nachoAIAnswer(q, function(aiAnswer) {
                clearInterval(dtAI);
                if (aiAnswer) {
                    if (typeof setPose === 'function') setPose('brain');
                    var html = '<div style="color:var(--text,#eee);line-height:1.6;">' +
                        '<div style="font-size:0.7rem;color:var(--text-faint,#666);margin-bottom:4px;">🧠 Nacho AI:</div>' +
                        escapeHtml(aiAnswer) + '</div>';
                    html += '<button onmousedown="event.stopPropagation();" ontouchstart="event.stopPropagation();" onclick="event.stopPropagation();showNachoInput()" style="width:100%;margin-top:8px;padding:6px;background:none;border:1px solid var(--border,#333);border-radius:8px;color:var(--text-muted,#888);font-size:0.8rem;cursor:pointer;font-family:inherit;">Ask another question</button>';
                    textEl.innerHTML = html;
                    if (typeof nachoPlaySound === 'function') nachoPlaySound('pop');
                    nachoRemember(q, aiAnswer);
                    return;
                }
                // AI failed — fall through to web search
                tryWebSearch(textEl, q);
            });
            return;
        }

        // ---- Step 6: Try web search (if proxy is configured) ----
        tryWebSearch(textEl, q);

        } catch(e) {
            stopNachoThinking();
            showNachoFallback(textEl, q);
        }
    }, thinkDelay);
};

function tryWebSearch(textEl, q) {
    if (NACHO_SEARCH_PROXY) {
        textEl.innerHTML = '<div style="color:var(--text,#eee);font-size:0.9rem;">🌐 Searching the web<span class="nacho-dots"></span></div>';
        var dotsEl2 = textEl.querySelector('.nacho-dots');
        var dc2 = 0;
        var dt2 = setInterval(function() { dc2 = (dc2+1)%4; if(dotsEl2) dotsEl2.textContent = '.'.repeat(dc2); }, 400);

        nachoWebSearch(q, function(results) {
            clearInterval(dt2);
            if (results && results.length > 0) {
                if (typeof setPose === 'function') setPose('cool');
                var html = '<div style="color:var(--text,#eee);line-height:1.6;">' +
                    '<div style="font-size:0.7rem;color:var(--text-faint,#666);margin-bottom:6px;">🌐 Here\'s what I found online:</div>';
                for (var ri = 0; ri < results.length; ri++) {
                    html += '<div style="margin-bottom:8px;padding:8px;background:var(--card-bg,#111);border:1px solid var(--border,#333);border-radius:8px;">' +
                        '<div style="font-size:0.8rem;font-weight:600;color:var(--heading,#fff);margin-bottom:2px;">' + (escapeHtml(results[ri].title)) + '</div>' +
                        '<div style="font-size:0.75rem;color:var(--text-muted,#aaa);margin-bottom:4px;">' + (escapeHtml(results[ri].snippet)) + '</div>' +
                        (results[ri].url && sanitizeUrl(results[ri].url) ? '<a href="' + sanitizeUrl(results[ri].url) + '" target="_blank" rel="noopener" style="font-size:0.7rem;color:#f7931a;">Read more →</a>' : '') +
                        '</div>';
                }
                html += '</div>';
                html += '<button onmousedown="event.stopPropagation();" ontouchstart="event.stopPropagation();" onclick="event.stopPropagation();showNachoInput()" style="width:100%;margin-top:4px;padding:6px;background:none;border:1px solid var(--border,#333);border-radius:8px;color:var(--text-muted,#888);font-size:0.8rem;cursor:pointer;font-family:inherit;">Ask another question</button>';
                textEl.innerHTML = html;
                if (typeof nachoPlaySound === 'function') nachoPlaySound('pop');
            } else {
                showNachoFallback(textEl, q);
            }
        });
        return;
    }
    showNachoFallback(textEl, q);
}

function showNachoFallback(textEl, q) {
    if (typeof setPose === 'function') setPose('think');
    var fb = FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
    fb = typeof personalize === 'function' ? personalize(fb) : fb;

    // Suggest a relevant channel based on keywords
    var suggestedChannel = null;
    if (typeof CHANNELS !== 'undefined') {
        var qLower = q.toLowerCase();
        for (var chId in CHANNELS) {
            var ch = CHANNELS[chId];
            var title = (ch.title || '').toLowerCase();
            var desc = (ch.desc || '').toLowerCase();
            if (title.indexOf(qLower) !== -1 || qLower.split(/\s+/).some(function(w) { return w.length > 3 && (title.indexOf(w) !== -1 || desc.indexOf(w) !== -1); })) {
                suggestedChannel = { id: chId, name: ch.title };
                break;
            }
        }
    }

    var html = '<div style="color:var(--text,#eee);line-height:1.6;">' + fb + '</div>';
    if (suggestedChannel) {
        html += '<button onclick="if(typeof go===\'function\')go(\'' + suggestedChannel.id + '\');hideBubble();" style="width:100%;margin-top:10px;padding:8px;background:var(--accent-bg,rgba(247,147,26,0.1));border:1px solid #f7931a;border-radius:8px;color:#f7931a;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">📖 Try: ' + suggestedChannel.name + ' →</button>';
    } else {
        html += '<button onclick="if(typeof go===\'function\')go(\'one-stop-shop\');hideBubble();" style="width:100%;margin-top:10px;padding:8px;background:var(--accent-bg,rgba(247,147,26,0.1));border:1px solid #f7931a;border-radius:8px;color:#f7931a;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">📖 Try: One Stop Shop →</button>';
    }
    html += '<button onmousedown="event.stopPropagation();" ontouchstart="event.stopPropagation();" onclick="event.stopPropagation();showNachoInput()" style="width:100%;margin-top:4px;padding:6px;background:none;border:1px solid var(--border,#333);border-radius:8px;color:var(--text-muted,#888);font-size:0.8rem;cursor:pointer;font-family:inherit;">Ask another question</button>';
    textEl.innerHTML = html;
}

})();
