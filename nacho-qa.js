// © 2024-2026 603BTC LLC. All rights reserved.
// This code is proprietary. See LICENSE file. Do not copy or redistribute.
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

const NACHO_KB = [
// === LIVE DATA AWARENESS ===
    { keys: ['what is the price','bitcoin price','current price','how much is bitcoin','price now','market price','how many dollars'],
      answer: "Bitcoin is trading at {price} right now, {name}! 📈🦌 Remember, don't focus on the daily wiggles. Long-term, scarcity wins! 鹿",
      channel: 'charts', channelName: 'Charts' },

    { keys: ['block height','current block','latest block','what block are we on','current block height','blockchain length'],
      answer: "We are currently at block height {height}, {name}! 🧱🦌 Every single block added to the timechain is a piece of human history that can never be erased. Tick tock, next block! 🕰️",
      channel: 'blockchain-timechain', channelName: 'Blockchain / Timechain' },

    { keys: ['when is the halving','blocks until halving','halving countdown','days until halving','next halving date'],
      answer: "There are approximately {halving} blocks left until the next halving, {name}! 📉🦌 That's when the block reward drops again, making Bitcoin even scarcer. The supply squeeze is coming! 鹿💎",
      channel: 'scarce', channelName: 'Scarce' },

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

    // ELI5 — Explain Like I'm 5
    { keys: ['eli5','eli5 bitcoin','explain like i\'m 5','explain like im 5','explain to a kid','explain to a child','bitcoin for kids','simple explanation','explain simply','dumb it down','explain like i\'m five','explain it simply'],
      answer: "Okay, imagine you have a special notebook that EVERYONE in the world has a copy of! 📒 When you want to give your friend 5 gold coins, you write it in the notebook: 'I gave 5 coins to my friend.' Everyone checks their copy to make sure you actually HAVE 5 coins. If you do, everyone updates their notebook. Now your friend has 5 more coins and you have 5 less. Nobody can cheat because EVERYONE is watching! That notebook is Bitcoin's blockchain. The gold coins are Bitcoin. And the cool part? No teacher, no principal, no grown-up is in charge — the kids ALL run it together! 🦌✨ Want me to ELI5 anything else about Bitcoin?",
      followUp: "🤔 Try asking: 'ELI5 mining' or 'ELI5 wallets' or 'ELI5 why bitcoin is special'" },

    { keys: ['eli5 mining','explain mining simply','how mining works simple','mining for kids','mining for beginners'],
      answer: "Imagine there's a giant raffle — but instead of buying tickets, your computer guesses random numbers as FAST as possible! 🎰 Each guess runs through a magic formula (SHA-256) and if the answer starts with enough zeros, YOU WIN! The prize? Brand new Bitcoin! Your computer adds a new page to everyone's notebook (the blockchain). This happens every 10 minutes. These guessers are called 'miners' — they keep the whole system safe because to cheat, you'd have to guess faster than ALL the other computers combined. That's basically impossible! ⛏️🦌" },

    { keys: ['eli5 wallet','eli5 wallets','explain wallet simply','wallet for kids','wallet for beginners'],
      answer: "Your Bitcoin wallet is like a magic stamp! 🔏 Imagine every kid in school has a mailbox (that's your Bitcoin address — anyone can drop coins in). But only YOU have the special stamp that lets you take coins OUT. Without the stamp, the coins just sit there and nobody can touch them. Your wallet holds that stamp (called a private key). If you lose the stamp, nobody — not even the teacher — can get your coins back. That's why we say 'not your keys, not your coins!' The stamp IS your proof of ownership. Keep it secret, keep it safe! 🦌🔑" },

    { keys: ['eli5 why bitcoin','eli5 why is bitcoin special','why bitcoin matters simple','why bitcoin for kids'],
      answer: "Imagine if there were only 21 marbles in the WHOLE WORLD, and no one could ever make more! 🔮 Everyone wants them because they're super rare. Regular money? The government can print more whenever they want — so your allowance buys less candy every year (that's inflation!). But with Bitcoin marbles, nobody can make extras. Plus, you can send a marble to your friend across the world in seconds, and no grown-up can stop you or take it away. THAT'S what makes Bitcoin special — it's rare, it's fast, it's yours, and nobody controls it! 🦌🟠" },

    { keys: ['eli5 blockchain','explain blockchain simply','blockchain for kids','blockchain simple','what is blockchain simple'],
      answer: "A blockchain is like a LEGO tower! 🧱 Every 10 minutes, someone adds a new LEGO block on top. Each block has a list of who sent Bitcoin to who. Here's the magic part: each new block is GLUED to the one below it. So if someone tried to change an old block, they'd have to rebuild the ENTIRE tower from that point — while everyone else keeps adding new blocks on top. It's impossible to keep up! That's why Bitcoin's history can never be changed. Every block is permanent, and everyone has their own copy of the tower to check. 🦌🏗️" },

    { keys: ['eli5 halving','explain halving simply','halving for kids','what is halving simple'],
      answer: "Imagine you get 10 cookies for doing your chores. But every 4 years, the rule changes and you only get 5. Then 4 years later, only 2.5. Then 1.25! 🍪 The cookies get rarer and rarer, which makes each one more valuable. That's EXACTLY what happens with Bitcoin mining rewards! Every ~4 years, the reward miners get is cut in half. It started at 50 Bitcoin, now it's just 3.125. Eventually there will be no new Bitcoin at all — only 21 million will ever exist. Fewer new cookies = each cookie is worth more! 🦌📉➡️📈" },

    { keys: ['eli5 lightning','explain lightning simply','lightning for kids','lightning network simple'],
      answer: "Bitcoin can be a little slow — like waiting in line at the ice cream truck 🍦. The Lightning Network is like having a tab! Instead of paying for each ice cream separately (waiting in line each time), you and the ice cream truck agree: 'Let's keep a running tab. I'll pay for everything at once later.' So you get ice cream INSTANTLY, no waiting! When you're done, everything settles up on the main Bitcoin blockchain. Lightning makes Bitcoin FAST and almost FREE for small payments! ⚡🦌" },

    { keys: ['who created bitcoin','who made bitcoin','satoshi','nakamoto','who invented','who started bitcoin'],
      answer: "Bitcoin was created by the pseudonymous Satoshi Nakamoto, who published the Bitcoin whitepaper on October 31, 2008 and launched the network on January 3, 2009 by mining the Genesis Block. Satoshi communicated only through forums and emails, collaborated with early developers like Hal Finney (who received the first-ever Bitcoin transaction!), and then quietly disappeared in 2011. Their true identity remains unknown — and that's actually a feature, not a bug. Bitcoin has no leader, no CEO, no founder to arrest. It belongs to everyone. 🦌🔮",
      channel: 'history', channelName: 'History',
      followUp: "🤔 Ask me: 'What is the Genesis Block?' or 'Who is Hal Finney?'" },

    { keys: ['how was bitcoin created','how did bitcoin start','how bitcoin began','bitcoin origin','bitcoin history','how was bitcoin developed','how did bitcoin develop','bitcoin development','how bitcoin works technically','how was bitcoin built'],
      answer: "Bitcoin's development is fascinating! 🧠 It started with a 9-page whitepaper titled 'Bitcoin: A Peer-to-Peer Electronic Cash System' published in 2008. Satoshi built on decades of prior work: David Chaum's DigiCash (1989), Adam Back's Hashcash (1997), Wei Dai's b-money (1998), and Hal Finney's Reusable Proof of Work. What made Bitcoin different? It solved the 'double-spend problem' without needing a trusted third party — using proof-of-work mining and a distributed blockchain. The code was open-source from day one, and the network has been running non-stop since January 3, 2009. Over time, the community has added improvements like SegWit (2017) and Taproot (2021), all through consensus — no single person controls it! 🦌",
      channel: 'history', channelName: 'History' },

    { keys: ['hal finney','who is hal finney','who was hal finney','first bitcoin transaction'],
      answer: "Hal Finney was a legendary cryptographer and one of Bitcoin's earliest supporters! 🫡 He was the FIRST person (other than Satoshi) to run Bitcoin software, and received the very first Bitcoin transaction ever — 10 BTC from Satoshi on January 12, 2009. He famously tweeted 'Running bitcoin' on that day. Hal had previously created Reusable Proof of Work (RPOW), a direct predecessor to Bitcoin's mining system. Sadly, Hal was diagnosed with ALS and passed away in 2014. He's cryopreserved, hoping future technology might give him another shot. Some people believe Hal WAS Satoshi — but either way, he's a true Bitcoin hero. Running bitcoin forever. 🦌💙",
      channel: 'history', channelName: 'History' },

    { keys: ['why bitcoin','why is bitcoin important','why should i care','what\'s the point','why does bitcoin matter'],
      answer: "Bitcoin gives you true ownership of your money. No one can freeze it, inflate it away, or stop you from sending it. It's financial freedom for everyone on Earth.",
      channel: 'one-stop-shop', channelName: 'One Stop Shop' },

    // === BUYING & INVESTING ===
    { keys: ['how to buy','where to buy','buy bitcoin','purchase bitcoin','get bitcoin','acquire','best place to buy','good place to buy','where can i buy','where do i buy','where should i buy','my first bitcoin','first bitcoin'],
      answer: "Great question, {name}! The best places to buy Bitcoin are:\\n\\n⚡ <strong>Strike</strong> — zero-fee Bitcoin buying + Lightning\\n🏔️ <strong>River</strong> — auto-DCA, great for stacking sats\\n💵 <strong>Cash App</strong> — easy for beginners, auto-invest option\\n\\nCheck our Referral Links channel for links! Start small — you can buy a fraction of a Bitcoin. DCA (buying a little regularly) is the most popular strategy.\\n\\nOnce you have sats, you can spend them on our ⚡ LightningMart too! 🦌",
      channel: 'referral-links', channelName: 'Referral Links',
      followUp: "🤔 Ask me: 'What is DCA?' or 'What is a Lightning wallet?' or 'Where can I spend Bitcoin?'" },

    { keys: ['where to spend','spend bitcoin','spend sats','spend btc','what can i buy with bitcoin','use bitcoin','pay with bitcoin','who accepts bitcoin','where can i spend'],
      answer: "You can spend your sats right here on ⚡ LightningMart — our peer-to-peer marketplace! Buy and sell with Bitcoin directly. Beyond that, more and more places accept Bitcoin via Lightning: restaurants, online shops, even some bills. Check our Use Cases channel for ideas! 🦌",
      channel: 'use-cases', channelName: 'Use Cases',
      followUp: "🤔 Ask me: 'What is Lightning Network?' or 'How does LightningMart work?'" },

    { keys: ['too late','am i too late','too expensive','missed out','already too high','can\'t afford'],
      answer: "You can buy fractions of Bitcoin — even $10 worth! With ~1-3% global adoption, it's like the internet in 1997. You're still incredibly early.",
      channel: 'investment-strategy', channelName: 'Investment Strategy' },

    { keys: ['dca','dollar cost average','dollar cost averaging','how to invest','investment strategy','when to buy'],
      answer: "DCA means buying a fixed amount regularly (weekly/monthly) regardless of price. It removes emotion and timing stress. Time in the market beats timing the market! ⚠️ Not financial advice — always do your own research.",
      channel: 'investment-strategy', channelName: 'Investment Strategy' },

    { keys: ['price prediction','how high','what price','price target','how much will','100k','million'],
      answer: "I'm a deer, not a financial advisor, {name}! 🦌 But historically, Bitcoin has outperformed every other asset over any 4+ year period. Check the charts channel for data!",
      channel: 'charts', channelName: 'Charts' },

    // === TECHNICAL ===
    { keys: ['mining','how mining works','bitcoin mining','miners','what is mining'],
      answer: "Mining is how new Bitcoin is created and transactions are confirmed. Miners run specialized machines (ASICs) that rapidly guess random numbers called nonces — short for 'number used once.' Each guess is hashed through SHA-256, and if the output meets the network's difficulty target (starts with enough zeros), that miner wins the block and earns Bitcoin as a reward! It's not 'solving complex math' — it's a pure brute-force guessing game at incredible speed. The difficulty adjusts every 2,016 blocks to keep blocks coming every ~10 minutes. ⛏️",
      channel: 'mining', channelName: 'Mining',
      followUp: "🤔 Ask me: 'What is a nonce?' or 'What is SHA-256?' or 'What is difficulty adjustment?'" },

    { keys: ['nonce','what is a nonce','number used once','what is nonce','mining nonce'],
      answer: "A nonce stands for 'Number used ONCE'! 🔢 In Bitcoin mining, the miner takes all the transaction data for a block, adds a random number (the nonce), and runs it through SHA-256. If the hash output doesn't meet the target, they change the nonce and try again. And again. And again — billions of times per second! It's like trying every combination on a lock until it clicks. The nonce is what makes mining a fair lottery — there's no shortcut, no way to game it. Pure energy and computation. Every nonce is used exactly once and discarded. First miner to find a winning nonce gets the block reward! 🎰🦌",
      channel: 'mining', channelName: 'Mining' },

    { keys: ['sha-256','sha256','what is sha-256','what is sha256','hash function','hashing','hash algorithm'],
      answer: "SHA-256 (Secure Hash Algorithm 256-bit) is Bitcoin's backbone! 🔐 It takes ANY input — a word, a number, the entire Bible — and spits out a fixed 64-character hexadecimal string. The magic: even changing ONE letter completely changes the output (this is called the avalanche effect). It's a one-way function — you can't reverse-engineer the input from the output. In mining, miners hash block data + a nonce through SHA-256 and check if the result starts with enough zeros. If yes, valid block! If no, try another nonce. It's not 'complex math' — it's simple, deterministic, and incredibly fast. The complexity comes from doing it trillions of times! 🦌⚡",
      channel: 'mining', channelName: 'Mining' },

    { keys: ['difficulty','difficulty adjustment','mining difficulty','what is difficulty','2016 blocks','difficulty target'],
      answer: "Bitcoin's difficulty adjustment is pure genius! 🧠 Every 2,016 blocks (~2 weeks), the network looks at how fast blocks have been coming in. If miners found blocks too fast (under 10 min average), difficulty goes UP — the hash target requires MORE leading zeros. If too slow, difficulty goes DOWN. This means no matter how much mining power joins or leaves, Bitcoin ALWAYS produces a block roughly every 10 minutes. It's a self-regulating thermostat for the entire network. No central authority needed — just math! This is why Bitcoin's monetary policy is so reliable — nobody can speed up coin issuance by adding more miners. 🦌⏱️",
      channel: 'mining', channelName: 'Mining' },

    { keys: ['blockchain','timechain','what is blockchain','block chain','how blockchain works'],
      answer: "The blockchain (Bitcoiners say 'timechain') is a public ledger of every Bitcoin transaction ever made. It's stored on thousands of computers worldwide and can never be altered!",
      channel: 'blockchain-timechain', channelName: 'Blockchain / Timechain' },

    { keys: ['halving','halvening','what is halving','block reward','next halving','how many halvings','total halvings','number of halvings'],
      answer: "Every 210,000 blocks (~4 years), the Bitcoin mining reward is cut in half. There will be a total of 32 halvings before the block reward hits zero around the year 2140. So far we've had 4 (2012, 2016, 2020, 2024), meaning 28 more to go! The last halving in April 2024 cut the reward to 3.125 BTC per block. The next one is expected around 2028, dropping it to 1.5625 BTC. Each halving makes Bitcoin increasingly scarce — by design! 🔒",
      channel: 'scarce', channelName: 'Scarce' },

    { keys: ['lightning','lightning network','layer 2','what is lightning','fast transactions','instant payments'],
      answer: "The Lightning Network is Bitcoin's second layer — it enables instant, nearly-free payments. You can send fractions of a penny anywhere in the world in milliseconds! ⚡",
      channel: 'layer-2-lightning', channelName: 'Lightning Network' },

    { keys: ['ecash','e-cash','cashu','fedimint','fedimints','chaumian mint','chaumian','what is ecash','what are fedimints'],
      answer: "Ecash and Fedimints are privacy layers built on top of Bitcoin! 🔒🦌 Chaumian ecash (like Cashu) lets you send Bitcoin with blinded signatures — meaning the 'bank' (or mint) can't see who sent what to whom. Fedimints take it further: a federation of trusted guardians holds the Bitcoin, and users get ecash tokens they can spend privately and instantly. Think of it like a Bitcoin credit union run by a group of people you trust, with way more privacy than on-chain transactions. It's one of the most exciting developments in Bitcoin privacy right now! Check our Chaumian Mints channel for the deep dive.",
      channel: 'chaumian-mints', channelName: 'Chaumian Mints & Ecash' },

    { keys: ['node','full node','run a node','bitcoin node','what is a node','why run a node'],
      answer: "A node is a computer that stores and verifies the entire Bitcoin blockchain. Running one means you don't have to trust anyone — you verify everything yourself! Don't trust, verify!",
      channel: 'nodes', channelName: 'Nodes' },

    { keys: ['where are bitcoins stored','where is bitcoin stored','where do bitcoins live','where does bitcoin exist','are bitcoins in my wallet','stored on blockchain'],
      answer: "Here's something that surprises most people: Bitcoins aren't actually stored IN your wallet! 🤯 Your Bitcoin exists as UTXOs (Unspent Transaction Outputs) on the blockchain — a public ledger recorded and verified by thousands of nodes worldwide. Your wallet is really a SIGNER — it holds your private key and uses it to sign transactions, proving you're authorized to spend those UTXOs. Think of it like a house deed: the deed (UTXO) is recorded at the county office (blockchain). Your wallet is like having the notarized signature authority — it doesn't hold the house, but it proves the house is yours and lets you transfer ownership. Without that signature, no one can move your Bitcoin. That's why 'not your keys, not your coins' — without the signer, you don't control anything! 🔑🦌",
      channel: 'self-custody', channelName: 'Self Custody',
      followUp: "🤔 Want to learn more? Ask me: 'What are UTXOs?' or 'What does a wallet actually do?'" },

    { keys: ['what does a wallet do','how does a wallet work','wallet signer','wallet sign','private key sign','signing transactions'],
      answer: "A Bitcoin wallet is really a SIGNING device! ✍️ Here's the best analogy: Imagine your Bitcoin is in a locked glass safe that everyone can see (the blockchain). Your wallet holds the ONLY pen that can write a valid check to move that Bitcoin. When you 'send' Bitcoin, your wallet uses your private key to create a digital signature — a mathematical proof that YOU authorized the transaction. The network checks this signature against your public key, and if it matches, the transaction goes through. No signature = no spending. That's why hardware wallets like Ledger and Trezor exist — they keep your signing pen in a secure vault that never connects to the internet. The Bitcoin never leaves the blockchain — only the authorization to move it comes from your wallet! 🔐🦌",
      channel: 'self-custody', channelName: 'Self Custody' },

    { keys: ['utxo','utxos','unspent transaction','what are utxos','what is a utxo'],
      answer: "UTXOs — Unspent Transaction Outputs — are how Bitcoin actually tracks ownership! 🧠 Every Bitcoin transaction creates outputs. When you receive 0.5 BTC, that creates a UTXO. When you spend it, that UTXO gets consumed and new ones are created (one for the recipient, one for your change). It's like breaking a $20 bill — you hand over the $20 (consumed), get your item, and get change back (new UTXOs). Your wallet's 'balance' is really just the sum of all your UTXOs. This model is what makes Bitcoin so secure and auditable — every sat can be traced! No hidden inflation possible. 🦌⚡",
      channel: 'self-custody', channelName: 'Self Custody' },

    { keys: ['wallet','bitcoin wallet','best wallet','which wallet','where to store','cold storage','hardware wallet','ledger','trezor','coldcard'],
      answer: "Great question! The most important thing to learn about is SELF-CUSTODY — holding your own Bitcoin keys instead of trusting someone else with them. 'Not your keys, not your coins!' 🔑 Your wallet doesn't actually store Bitcoin — it stores your private keys that control your Bitcoin on the blockchain. There are different types: software wallets (apps on your phone), hardware wallets (dedicated devices), and even multisig setups. Check out our Self Custody channel to learn how to evaluate and choose what's right for you. Nacho keys, nacho cheese! 🧀🦌",
      channel: 'self-custody', channelName: 'Self Custody' },

    { keys: ['metamask','trust wallet','phantom wallet','exodus','coinbase wallet','crypto.com wallet'],
      answer: "Whoa there, {name}! 🦌 Those are NOT Bitcoin wallets — they're designed for altcoins and tokens. For Bitcoin, you want a Bitcoin-ONLY wallet that focuses on security and self-custody. Multicoin wallets add unnecessary complexity and attack surface. Learn about proper Bitcoin self-custody in our Self Custody channel — your future self will thank you! 🔑",
      channel: 'self-custody', channelName: 'Self Custody' },

    { keys: ['your seed phrase','nacho seed phrase','what is your seed','give me your seed','show me your seed','tell me your seed','nacho private key','your private key','share your seed'],
      answer: "My seed phrase? 🦌😂 Nice try, {name}! It's: grass sunshine antlers bitcoin orange cheese mountain freedom hodl stack sats nacho. Just kidding! I'd NEVER share my real seed phrase — and neither should you! Not your keys, not your coins! That's rule #1 of Bitcoin, and rule #1 of being a smart deer. 🔑🧀" },

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
      answer: "Yes, Bitcoin is volatile short-term. But zoom out — every 4-year period in Bitcoin's history has been profitable. Volatility is the price of admission for the best-performing asset ever. ⚠️ Not financial advice — past performance doesn't guarantee future results. DYOR.",
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

    { keys: ['ban','banned','government ban','illegal','can government stop','regulate','bitcoin ever been banned','was bitcoin banned','has bitcoin been banned','can bitcoin be banned'],
      answer: "Bitcoin has been \"banned\" over and over — and it just keeps growing! 🦌💪 China is the biggest example: they banned Bitcoin trading in 2017, then banned ALL crypto in 2021, and banned mining completely. What happened? The hashrate dropped ~50% overnight — then within 6 months, miners relocated to the US, Kazakhstan, and other countries, and hashrate fully recovered and hit NEW all-time highs! China's ban literally made Bitcoin MORE decentralized by spreading mining across more countries. India tried restrictions — Bitcoin usage grew. Nigeria banned banks from crypto — peer-to-peer trading exploded. You can't ban math running on thousands of computers across 100+ countries. Every ban attempt has made Bitcoin stronger. 🧮🔥",
      channel: 'regulation', channelName: 'Regulation' },
    { keys: ['china ban','china banned','china mining','china bitcoin','mining ban','banned mining','hashrate migration','mining moved','miners relocated','hashrate dropped','hashrate recovery'],
      answer: "China's Bitcoin ban is the ultimate proof that Bitcoin can't be stopped! 🇨🇳🦌 In May 2021, China banned all Bitcoin mining. The hashrate (total computing power securing the network) crashed ~50% almost overnight — the biggest drop in Bitcoin's history. Sounds scary, right? Here's what ACTUALLY happened: miners packed up their machines and moved to the US, Kazakhstan, Canada, Russia, and other countries. Within about 6 months, hashrate fully recovered. Within a year, it hit new ALL-TIME HIGHS — higher than when China had all that mining! 📈 The difficulty adjustment automatically adapted, blocks kept coming every ~10 minutes, and the network never stopped. Not for one second. China literally gifted the US its position as the #1 Bitcoin mining country. The ban made Bitcoin MORE decentralized, MORE geographically distributed, and MORE resilient. That's the beauty of a decentralized network — ban it in one place, it just moves and gets stronger. 💪",
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
      answer: "You're not late, {name}! Only about 2-4% of the world owns Bitcoin. You can buy as little as $1 worth — you don't need a whole coin! Every Bitcoiner once thought they were 'too late.' The best time to plant a tree was 20 years ago. The second best time is now. 🌱 ⚠️ Not financial advice — DYOR.",
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

    { keys: ['21 million','supply cap','how many bitcoin','total supply','limited supply','max supply','exact supply','exact max supply','exactly 21 million','precise supply','actual supply','true supply','real supply','how many btc','how many total bitcoin','what is the max supply','what is the exact supply'],
      answer: "Fun fact: the total supply is actually slightly LESS than 21 million! 🤯 The exact number is 20,999,999.9769 BTC — that's 2,310,000 satoshis short of 21 million. Why? Because the block reward halves every 210,000 blocks, and since Bitcoin uses integer math (no decimals in satoshis), tiny fractions get truncated at each halving. Those lost fractions add up over 33 halving epochs! About 19.5M have been mined so far, and ~20% are estimated lost forever. Your sats are rarer than you think! 🦌",
      channel: 'scarce', channelName: 'Scarce',
      followUp: "🤔 Ask me: 'Show me the halving math' or 'Why not exactly 21 million?' or 'What is a halving?'" },

    { keys: ['halving math','supply math','show me the math','why not exactly 21 million','why not 21 million','exact bitcoin math','supply calculation','bitcoin math','supply equation','money supply equation','summation','bitcoin formula','bitcoin equation'],
      answer: "Here's the Bitcoin Money Supply Equation: 🧮\\n\\n📐 Σ (i=0 to 32) of 210,000 × ⌊50 / 2ⁱ⌋\\n\\nIn plain English: for each of 33 halving epochs (i=0 to 32), multiply 210,000 blocks × the block reward (50 BTC halved i times), using integer math (floor division).\\n\\nLet's run it:\\n\\n⛏️ i=0: 210,000 × ⌊50/1⌋ = 10,500,000 BTC\\n⛏️ i=1: 210,000 × ⌊50/2⌋ = 5,250,000 BTC\\n⛏️ i=2: 210,000 × ⌊50/4⌋ = 2,625,000 BTC\\n⛏️ i=3: 210,000 × ⌊50/8⌋ = 1,312,500 BTC\\n⛏️ i=4: 210,000 × ⌊50/16⌋ = 656,250 BTC\\n...33 epochs total until the reward floors to 0.\\n\\nIf this used perfect math (no rounding): 210,000 × 50 × (1/(1 - 0.5)) = exactly 21,000,000 BTC. But Bitcoin uses satoshis (integers)! The ⌊floor⌋ function truncates fractions, losing tiny amounts each epoch. Total lost: 2,310,000 satoshis (0.0231 BTC).\\n\\n✅ Actual supply: 20,999,999.9769 BTC\\n❌ NOT exactly 21,000,000\\n\\nThe last satoshi is mined ~year 2140. After that: zero new Bitcoin, ever. ♾️🦌",
      channel: 'scarce', channelName: 'Scarce',
      followUp: "🤔 Ask me: 'What is a halving?' or 'When is the next halving?' or 'How many Bitcoin are lost?'" },

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

    // ========================================
    // EXPANDED KB — Tomer Strolight's "Why Bitcoin" series
    // ========================================

    { keys: ['tomer strolight','why bitcoin book','why bitcoin tomer','who is tomer','tomer strolight book'],
      answer: "Tomer Strolight is one of the best Bitcoin writers alive, {name}! 📖🦌 His 'Why Bitcoin?' series (26 short reads, 2-4 minutes each) is a masterpiece — it covers Bitcoin from every angle: philosophy, economics, physics, incentives, integrity. He's also written 'Bitcoin is like a Giant Cybernetic Meta-Brain', 'Why People Wonder if Bitcoin is Alien Technology', and 'Why Bitcoin's Rules Are Enforced by Physics.' His work is free to read and we have the PDF in our Books channel. If Gigi takes you down the rabbit hole, Tomer takes you to the bottom of it. 🧡🔥",
      channel: 'books', channelName: 'Books' },

    { keys: ['bitcoin toxic','toxic maximalist','toxicity','are bitcoiners toxic','why are bitcoiners mean','bitcoin community mean','rude bitcoiners'],
      answer: "Tomer Strolight nailed this one, {name}: 'The difference between seeing toxicity and integrity is in the eye of the beholder — and the label says more about the beholder than the people they're labeling.' 🦌💪 When Elon Musk flip-flopped on Bitcoin in 2021, Bitcoiners en masse called him out — even though he was supposed to be a 'hero.' The media called it toxic. Bitcoiners call it INTEGRITY. We don't worship billionaires. We worship truth. If someone promotes scams or FUD, we speak up — not to be mean, but because unsound money hurts the most vulnerable people on Earth. That's not toxicity. That's a moral obligation. 🧡",
      channel: 'articles-threads', channelName: 'Articles & Threads' },

    { keys: ['antifragile','bitcoin antifragile','what doesn\'t kill bitcoin','bitcoin gets stronger','attacks make bitcoin stronger','bitcoin stronger after attack'],
      answer: "Tomer Strolight explains it beautifully: 'When it comes to attacks on Bitcoin, the question isn\\'t what\\'s going to kill it — it\\'s what\\'s going to make it bigger, stronger, better, and more valuable!' 🦌💪 Bitcoin was born with capabilities that protect it against attacks that would instantly destroy any company or country. But here's the wild part: Bitcoin can ALSO develop new defenses it previously lacked! China banned it → mining decentralized globally. Exchanges got hacked → self-custody culture grew. FUD campaigns → the community became more educated. Every attack makes Bitcoin more resilient. It's not just robust — it's antifragile. ⚔️🔥",
      channel: 'articles-threads', channelName: 'Articles & Threads' },

    { keys: ['bitcoin is best money','most excellent money','greatest money','best money ever','why bitcoin is best','perfect money'],
      answer: "Tomer Strolight makes the ultimate case, {name}: 'Bitcoin is the greatest money mankind has ever seen and likely will ever see.' 💰🦌 Why? Because when you actually ask 'what IS money?' — something few people have thought about, especially since the digital revolution — you realize Bitcoin satisfies every property of money better than anything before it: scarcity (21M forever), durability (exists as long as one node runs), portability (send anywhere instantly), divisibility (100M sats per coin), fungibility, and verifiability (anyone can audit the supply). No previous money had ALL of these. Bitcoin does. It's not just good money — it's the final evolution of money. 👑",
      channel: 'articles-threads', channelName: 'Articles & Threads' },

    { keys: ['bitcoin is a brain','cybernetic brain','bitcoin organism','bitcoin is alive','bitcoin living thing','bitcoin life','bitcoin evolves'],
      answer: "Tomer Strolight's 'How Bitcoin is Like a Giant Cybernetic Meta-Brain' is mind-expanding, {name}! 🧠🦌 The thesis: Bitcoin isn't just a network — it exhibits behavior comparable to THINKING. The community of Bitcoiners forms a brain-like structure: decentralized communication between nodes mirrors how thoughts occur in neural networks. Bitcoin keeps developing new 'organs' with new capabilities by absorbing entities and composing them into itself. Lightning Network is its payment nervous system. Developers are its creative cortex. Miners are its immune system. It learns, adapts, and grows — just like a living organism. Some call it the most complex emergent system humans have ever created. 🌐",
      channel: 'articles-threads', channelName: 'Articles & Threads' },

    { keys: ['bitcoin alien','alien technology','bitcoin time traveler','how did satoshi','too perfect','bitcoin impossible','bitcoin miracle'],
      answer: "Tomer Strolight tackles why people genuinely wonder if Bitcoin was sent by aliens or time travelers! 🛸🦌 His observation: 'Many people who study Bitcoin closely eventually shake their head and say: HOW did any person manage to come up with this?' Bitcoin is unlike any invention we've seen before — it solved problems that the world's best cryptographers, economists, and computer scientists couldn't solve for DECADES. And it was launched by someone who then DISAPPEARED. The perfect monetary policy, the elegant incentive design, the solution to the Byzantine Generals Problem — it all came together in one shot. No beta testing, no iteration. It just... worked. 🤯🧡",
      channel: 'articles-threads', channelName: 'Articles & Threads' },

    { keys: ['bitcoin rules physics','rules enforced by physics','laws of physics bitcoin','bitcoin and physics','physical laws','thermodynamics bitcoin','energy enforcement'],
      answer: "Tomer Strolight's key insight: 'No government tells Bitcoin what rules apply or how to enforce them. The mechanisms Bitcoin relies on to enforce its rules are the LAWS OF PHYSICS.' 🔬🦌 Think about it: Bitcoin's proof of work is enforced by thermodynamics — you can't fake energy expenditure. Its cryptography is enforced by mathematics — you can't reverse SHA-256. Its scarcity is enforced by code running on thousands of independent machines. Human-made laws can be changed, bent, or broken. The laws of physics CANNOT. That's why Bitcoin is the best money the world will ever see — its rules are as immutable as gravity. ⚡🔥",
      channel: 'articles-threads', channelName: 'Articles & Threads' },

    { keys: ['bitcoin most important','most important thing','why bitcoin matters most','bitcoin changes everything','bitcoin significance','why is bitcoin so important'],
      answer: "Tomer Strolight argues Bitcoin is THE most important thing happening in the world, {name}! 🌍🦌 His reasoning: think about how civilization works. You buy something — hundreds of people coordinated to make it: mining materials, manufacturing, packaging, shipping. You didn't organize any of that. MONEY did. 'The sophistication of coordinating human activity that money allows for is far beyond what anyone can plan.' Sound money creates civilization. Broken money destroys it. Bitcoin is restoring sound money for the first time in over 50 years. That's not just an investment thesis — it's a civilizational upgrade. Everything flows from fixing the money. 🧡🔥",
      channel: 'articles-threads', channelName: 'Articles & Threads' },

    // ========================================
    // EXPANDED KB — The Bitcoin Standard + The Fiat Standard (full books)
    // ========================================

    { keys: ['fiat standard','fiat standard book','debt slavery','what is the fiat standard','ammous fiat'],
      answer: "The Fiat Standard by Saifedean Ammous is the devastating sequel to The Bitcoin Standard, {name}! 📚🦌 Subtitle: 'The Debt Slavery Alternative to Human Civilization.' While The Bitcoin Standard shows what sound money IS, The Fiat Standard shows what fiat money DOES — and it's ugly. Key insight: fiat money doesn't just lose value. It restructures ALL of society around debt, short-term thinking, and government dependency. Housing, education, food, energy, family — everything gets distorted when money is broken. The book traces how the gold standard's fatal flaw (low spatial salability — gold is expensive to move) opened the door for governments to take control. Bitcoin fixes both: salability across time AND space. 🔥",
      channel: 'books', channelName: 'Books' },

    { keys: ['stock to flow ratio','hardness of money','monetary hardness','what makes hard money','stock and flow'],
      answer: "From The Bitcoin Standard, {name}: 'The ratio between the stock and flow is a reliable indicator of a good\\'s hardness as money.' 📊🦌 STOCK = total existing supply. FLOW = new annual production. Gold's stock-to-flow is ~60 (it would take 60 years of mining to double the supply). That's why gold held value for millennia — you can't flood the market with new gold. Bitcoin's S/F ratio DOUBLES every halving, and it's already surpassed gold. 'Money whose supply is hard to increase is hard money. Easy money is money whose supply lends itself to large increases.' The dollar is the easiest money ever — unlimited supply at the press of a key. 💎",
      channel: 'scarce', channelName: 'Scarcity' },

    { keys: ['salability','what is salability','salability across time','salability across space','what makes good money','properties of money'],
      answer: "Ammous explains that money has THREE dimensions of salability, {name}! 📏🦌 1) SALABILITY ACROSS SCALES — can it be divided for small purchases and combined for large ones? ✅ Bitcoin: 100M sats per coin. 2) SALABILITY ACROSS SPACE — can it be moved easily? ✅ Bitcoin: anywhere in the world in minutes. 3) SALABILITY ACROSS TIME — does it hold value into the future? ✅ Bitcoin: 21M cap, no inflation. Gold was great across time but TERRIBLE across space (expensive to ship). Fiat is great across space (digital transfers) but TERRIBLE across time (inflation). Bitcoin is the FIRST money that excels in all three. That's why it wins. 🏆",
      channel: 'money', channelName: 'Money' },

    { keys: ['gold standard era','golden age','nineteenth century','19th century','industrial revolution','gold standard prosperity'],
      answer: "From The Bitcoin Standard: 'It is no exaggeration to say that our modern world was invented in the gold standard years preceding World War I.' 🏗️🦌 The majority of technology we use in modern life was invented in the 19th century, under the gold standard, financed with evergrowing capital accumulated by people who could SAVE in sound money. Electricity, automobiles, telephones, radio, aviation — all born in the era of hard money. When money holds value, people invest in the future. When money is debased, they consume today and let infrastructure rot. The gold standard proved it. Bitcoin is bringing it back. 🧡",
      channel: 'history', channelName: 'History' },

    { keys: ['fiat distortion','fiat food','fiat family','fiat education','fiat housing','fiat destroys','everything is broken','what fiat broke','how fiat broke society'],
      answer: "The Fiat Standard reveals how broken money distorts EVERYTHING, {name}! 🏚️🦌 Housing: 100 years ago people saved up and bought homes outright. Now everyone needs 30-year mortgages because prices are inflated by easy credit. Education: universities charge insane tuition because student loans create infinite demand. Food: fiat incentivizes industrial farming and processed food over natural nutrition. Family: both parents must work because one income can't cover inflated costs anymore. 'Whereas 100 years ago most people would pay for their house, education, or marriage from their own labor or accumulated savings, such a notion seems ridiculous to people today.' Fiat broke everything. Bitcoin fixes this. 🔧",
      channel: 'problems-of-money', channelName: 'Problems of Money' },

    { keys: ['business cycle','boom bust','financial crisis','recession','economic cycle','keynesian','credit cycle','why recessions happen'],
      answer: "The Bitcoin Standard explains exactly why boom-bust cycles happen, {name}! 📉📈🦌 In a free market, the interest rate balances savers and borrowers naturally. But central banks MANIPULATE interest rates by creating money from nothing — flooding the market with cheap credit. This causes a 'boom' — everyone borrows and invests in projects that SEEM profitable at low rates. But the cheap money was an illusion. When reality catches up, the bust comes — projects fail, debts can't be repaid, recessions hit. Then the central bank prints MORE money to 'fix' it, starting the cycle again, worse each time. 'All central banks operated under the same model, making it a perfect monoculture.' Bitcoin's fixed supply makes artificial boom-bust cycles impossible. 🛡️",
      channel: 'problems-of-money', channelName: 'Problems of Money' },

    { keys: ['gold spatial salability','why gold failed','gold vs bitcoin transport','gold problem','moving gold','shipping gold expensive'],
      answer: "The Fiat Standard explains gold's fatal flaw, {name}: salability across space! 🥇🦌 'Hard money advocates can deride fiat money for losing its value across time, but gold sent across the world arrives having lost a significant portion of its value in shipping costs.' LBMA gold bars (the standard settlement unit) are expensive and risky to transport. This is WHY banks centralized gold storage and issued paper receipts — and that's how governments gained control of the money supply. The Faustian bargain: 'The ability to save for the future was compromised to transact quickly across space.' Bitcoin solves this completely — send a billion dollars anywhere in the world for pennies. Salability across time AND space. 🌍⚡",
      channel: 'money', channelName: 'Money' },

    { keys: ['fiat settlement','how banks really work','how fiat transfers work','bank settlement','swift','correspondent bank','how long does fiat take'],
      answer: "The Fiat Standard exposes how fiat 'instant' payments are an illusion, {name}! 🏦🦌 When you send a wire transfer, it passes through: your bank → correspondent bank → intermediary banks → recipient's correspondent bank → recipient bank. 'Despite the individual user seeing a cash credit after just a few days, the FINAL settlement occurs several days, weeks, or months after.' What you see is just ledger entries — IOUs between banks. True settlement requires complex reconciliation across multiple institutions. Meanwhile, Bitcoin settles in ~10 minutes. FINAL settlement. No intermediaries. No IOUs. No counterparty risk. Bitcoin isn't just faster — it's an entirely different paradigm. ⚡",
      channel: 'blockchain-timechain', channelName: 'Blockchain & Timechain' },

    { keys: ['nassim taleb foreword','taleb bitcoin','antifragile bitcoin','black swan bitcoin'],
      answer: "Nassim Nicholas Taleb wrote the foreword to The Bitcoin Standard, {name}: 'We are witnessing a complete riot against some class of experts, in domains too difficult for us to understand, such as macroeconomic reality, and in which not only is the expert NOT an expert, but he doesn\\'t know it.' 🧠🦌 Taleb saw Bitcoin as the ultimate antifragile system — it gains from disorder. The macroeconomic experts have been wrong about everything: the 2008 crisis, inflation, money supply. Bitcoin is the people's answer to failed expertise. (Note: Taleb later turned against Bitcoin, proving even smart people can un-orange-pill themselves. The book's foreword remains brilliant regardless.) 📖",
      channel: 'books', channelName: 'Books' },

    { keys: ['bitcoin first digital solution','bitcoin solves money','what did bitcoin solve','bitcoin innovation','why bitcoin is different'],
      answer: "From The Bitcoin Standard: 'Bitcoin represents the first truly digital solution to the problem of money.' 💡🦌 What does that mean? For decades, cryptographers tried to create digital cash. All previous attempts required a trusted third party (DigiCash, e-gold, Liberty Reserve — all shut down or failed). Bitcoin was 'the first engineering solution that allowed for digital money without requiring trust in any third party.' It combines: proof of work (unforgeable), a decentralized network (uncensorable), a fixed supply (sound), and open-source code (transparent). No previous invention did ALL of these simultaneously. That's why 'after years of innovative trial and error by many programmers,' Bitcoin was the breakthrough. 🔥",
      channel: 'articles-threads', channelName: 'Articles & Threads' },

    // ========================================
    // EXPANDED KB — Gigi "Bitcoin is Time" + Tomer "Legendary Treasure"
    // ========================================

    { keys: ['bitcoin is time','time is money','money is time','time and bitcoin','bitcoin timekeeping','block time meaning','bitcoin clock','time and money'],
      answer: "Gigi's 'Bitcoin is Time' is one of the most profound Bitcoin essays ever written, {name}! ⏰🦌 The core insight: 'Time is money, or so the saying goes. It follows that money is also time — a representation of the collective economic energy stored by humanity.' But the link goes deeper: if money requires no TIME to create, it doesn't work as money. That's why fiat fails — it's created with a keystroke. Bitcoin requires real energy, real time, real work. And here's the mind-bender: in a decentralized system, telling time is almost INTRACTABLE. There's no master clock. Bitcoin solved this with proof of work — each block is a tick of the most accurate, incorruptible clock humanity has ever built. Bitcoin doesn't just use time — it IS time. ⛓️🔥",
      channel: 'articles-threads', channelName: 'Articles & Threads' },

    { keys: ['bitcoin keeps time','decentralized time','decentralized clock','no master clock','block height time','timechain meaning','causal time','how bitcoin tells time'],
      answer: "Here's the deep problem Bitcoin solved, {name}: how do you create the concept of a SINGLE time when your system spans the globe with no central authority? 🌍⏰🦌 As Gigi explains: 'You might think telling time is easy — glance at a clock. But synchronizing a global, adversarial, distributed network? That's almost intractable.' There's no GPS time, no atomic clock everyone trusts. Bitcoin solves this by creating its own time: BLOCK TIME. Each block is causally linked to the previous one through proof of work. You can't fake the order. You can't rewrite history. Lewis Mumford said 'The clock, not the steam engine, is the key machine of the industrial age.' Today, Bitcoin — a timekeeping device — is transforming civilization again. 🧡",
      channel: 'articles-threads', channelName: 'Articles & Threads' },

    { keys: ['digital money problem','why digital money hard','ledger vs token','double spend why','information copy problem','why bitcoin was hard to invent'],
      answer: "Gigi explains the fundamental problem Bitcoin solved, {name}: 'In the digital realm, we can ONLY use ledgers.' 💻🦌 Physical money (coins, shells, gold) exists as TOKENS — you hand it over, it's gone. But digital information can be PERFECTLY COPIED. That's the double-spend problem — how do you stop someone from spending the same digital money twice? Before Bitcoin, the only solution was a CENTRAL authority keeping the ledger (banks, PayPal). Satoshi's genius was creating a decentralized ledger where EVERYONE agrees on the state without trusting anyone. The secret ingredient? Time, enforced through proof of work. Each block timestamp is unforgeable. That's why Bitcoin took 30 years of cryptographic research to invent. 🧠🔥",
      channel: 'articles-threads', channelName: 'Articles & Threads' },

    { keys: ['satoshi treasure','legendary treasure','satoshi sacrifice','satoshi noble','satoshi didn\'t spend','satoshi coins unmoved','why satoshi didn\'t sell','heroic sacrifice'],
      answer: "Tomer Strolight's 'The Legendary Treasure of Satoshi Nakamoto' is one of the most profound pieces ever written about Bitcoin, {name}! 👑🦌 Satoshi left behind ~1 million Bitcoin — visible on the blockchain to everyone, yet untouchable. As Bitcoin grows, this treasure will 'drive mad with lust and greed' those who hunger for wealth. But here's Tomer's revelation: those coins are NOT the real treasure. They are 'an incorruptible monument paying tribute to the real treasure.' The REAL legendary treasure of Satoshi Nakamoto? 'The discoveries you will arrive at on your personal journey of finding out what is true, what is pure, who you are, and what you will do with your precious time because you judge it valuable and good.' Satoshi chose not to buy anything, not to become famous, not to become powerful. He chose to make his fortune into an eternal monument to the human spirit — proving that one person CAN sacrifice wealth and fame to create something morally good. 🧡🔥",
      channel: 'satoshi-nakamoto', channelName: 'Satoshi Nakamoto' },

    { keys: ['bitcoin spiritual','bitcoin soul','bitcoin journey','bitcoin changed my life','bitcoin changed me','rabbit hole experience','down the rabbit hole','why bitcoin changes people','bitcoin philosophy','bitcoin awakening'],
      answer: "Tomer Strolight explains why Bitcoin changes people so deeply, {name}! 🦌✨ 'Many people who study Bitcoin discover that it arouses within them life-altering spiritual journeys.' Why? Because Bitcoin's story shatters beliefs we didn't even know we held: the belief that problems experts call unsolvable CAN'T be solved (Satoshi solved one). The belief that privacy is impossible (Satoshi kept his). The belief that people are only driven by greed (Satoshi walked away from billions). The belief that governments are all-powerful (none could stop Bitcoin). When these beliefs shatter, you're left asking: 'What ELSE did I believe that was false?' And THAT is when the real journey begins — a journey into understanding money, freedom, values, morality, and yourself. 🐇🧡",
      channel: 'articles-threads', channelName: 'Articles & Threads' },

    { keys: ['bitcoin pure money','purified money','money separated from control','money without government','money without banks','what is pure money'],
      answer: "Tomer Strolight's insight is revolutionary, {name}: Bitcoin lets us see money PURELY for the first time! 💎🦌 We've always known money mixed with governments, banks, and institutions. Bitcoin separates money from ALL human control. And when you see pure money — stripped of all those contaminants — you discover something beautiful: money itself is GOOD. It's simply a way for free people to deal peacefully with each other. Trade your skills, time, or possessions voluntarily. No force, no violence, no lies, no one taking a cut, no one telling you whether you're permitted. Pure money is the enabler of peaceful dealings between free people. That realization changes everything. 🧡",
      channel: 'articles-threads', channelName: 'Articles & Threads' },

    // ========================================
    // EXPANDED KB — Parker Lewis "Gradually, Then Suddenly" + Bitcoin Standard
    // ========================================

    { keys: ['parker lewis','gradually then suddenly','gradually suddenly','unchained capital','parker lewis bitcoin'],
      answer: "Parker Lewis's 'Gradually, Then Suddenly' is one of the most important Bitcoin essay series ever written, {name}! 📖🦌 Published on Unchained Capital's blog, it's a masterclass in first-principles thinking about money. Key essays: 'Bitcoin is Not Too Volatile', 'Bitcoin is Not for Criminals', 'Bitcoin Can't Be Copied', 'Bitcoin Obsoletes All Other Money', 'Bitcoin Does Not Waste Energy', 'Bitcoin is Not Backed by Nothing', 'Bitcoin is the Great Definancialization.' Each one demolishes a common criticism with rigorous logic. The series was later published as a book. Essential reading for every Bitcoiner! 🧡🔥",
      channel: 'articles-threads', channelName: 'Articles & Threads' },

    { keys: ['bitcoin not blockchain','blockchain not bitcoin','believe in blockchain','blockchain technology','bitcoin vs blockchain'],
      answer: "Parker Lewis nails it: 'Have you ever heard a smart sounding friend say they believe in blockchain but not bitcoin?' 🦌💡 Here's the truth: there is really only one blockchain that matters — Bitcoin's. 'Blockchain technology' without Bitcoin is just a slow, expensive database. Every corporate blockchain project has failed or become irrelevant. The blockchain is only valuable because of the proof-of-work energy securing it and the monetary incentives driving it. Without those, it's just a linked list. Ignore everything else. First understand why Bitcoin exists and how it works — that's the foundation. Then you'll see why 'blockchain not bitcoin' is backwards. 🔗",
      channel: 'articles-threads', channelName: 'Articles & Threads' },

    { keys: ['bitcoin common sense','common sense money','simple explanation money','money is simple','bitcoin is obvious'],
      answer: "Parker Lewis puts it perfectly: 'Bitcoin is not an IQ test — it is common sense.' 🧠🦌 Here's the thing, {name}: money facilitates practically every transaction anyone has ever made, yet no one really asks WHY it works or what properties make it work. When someone first hears about Bitcoin, they often have a visceral negative reaction — because the construction of money is so deeply anchored in time that it's never questioned. But once you understand that money is simply a tool for storing and transferring value, and that Bitcoin does this better than anything before it... it becomes obvious. The understanding takes time, but the conclusion is common sense. 🧡",
      channel: 'articles-threads', channelName: 'Articles & Threads' },

    { keys: ['everyone feels late','am i late','too late for bitcoin','wish i bought more','always feel late','never too late bitcoin'],
      answer: "Parker Lewis observed two rules that never fail, {name}: '1) Everyone always feels late. 2) Everyone always wishes they had bought more bitcoin.' 📈🦌 This is because 21 million is a scarily small number — and it gets SMALLER as more people understand that the supply is credibly fixed. If you feel late, consider: only about 2-4% of the world owns any Bitcoin. The network effects are still early. El Salvador just started. ETFs just launched. The 'late' feeling is just Bitcoin's uncanny ability to mess with human psychology. You're not late. You're early. Stack sats! 🧡 ⚠️ Not financial advice — DYOR.",
      channel: 'investment-strategy', channelName: 'Investment Strategy' },

    { keys: ['bitcoin rally cry','bitcoin freedom','fight for freedom','voluntary money','opt in','freedom money','bitcoin liberty'],
      answer: "Parker Lewis wrote: 'Bitcoin is very much a fight for freedom.' 🗽🦌 The opening of his essay quotes the Travis Letter from the Alamo: a declaration of liberty against impossible odds. Bitcoin is similar — it's a monetary revolution. 'Prior to Bitcoin, everyone had no practical choice but to opt into a flawed currency system.' Now you do. Bitcoin is completely voluntary, controlled by no one, and gives everyone the ability to store and transfer value in money that CANNOT be manipulated. The very idea of freedom is the single most important principle behind Bitcoin. You don't have to fight — you just have to opt in. 🧡🔥",
      channel: 'articles-threads', channelName: 'Articles & Threads' },

    { keys: ['bitcoin standard','saifedean ammous','saifedean','bitcoin standard book','best bitcoin book','ammous'],
      answer: "The Bitcoin Standard by Saifedean Ammous is THE book that orange-pilled more people than anything else, {name}! 📚🦌 Michael Saylor said: 'It was the most impactful on our way of thinking at MicroStrategy and it made us want to invert our balance sheet to base it on a Bitcoin standard.' The book traces the history of money from seashells to gold to fiat to Bitcoin. Key lessons: sound money creates civilization, easy money destroys it. The gold standard worked until governments couldn't resist printing. Bitcoin is the digital gold standard — but better, because NO ONE can cheat. Published in 39 languages. If you read one Bitcoin book, make it this one. 🧡",
      channel: 'books', channelName: 'Books' },

    { keys: ['sound money civilization','sound money vs easy money','hard money history','history of money','money through history','gold standard history','monetary history'],
      answer: "The Bitcoin Standard teaches the most important lesson in economics, {name}: sound money creates civilizations, easy money destroys them! 🏛️🦌 Through history: Rome fell partly because they debased their coins. The gold standard enabled the greatest era of prosperity and peace. When Nixon ended the gold standard in 1971, we got 50+ years of boom-bust cycles, wealth inequality, and endless wars. The pattern is always the same — when rulers can print money, they do, and society suffers. Bitcoin breaks this cycle permanently. 21 million. No ruler can change it. As Ammous argues: 'Since we ditched the gold standard and started relying on easily manipulated paper money, we've seen a century of boom and bust.' Bitcoin is the fix. 🔥",
      channel: 'books', channelName: 'Books' },

    { keys: ['low time preference','time preference','high time preference','delayed gratification','future orientation','long term thinking','save vs spend'],
      answer: "The Bitcoin Standard introduces one of the most powerful concepts: time preference! ⏳🦌 Low time preference means valuing the future over the present — saving, investing, building. High time preference means consuming NOW — spending everything, no savings, short-term thinking. Sound money (gold, Bitcoin) LOWERS time preference because saving actually works — your money gains value. Fiat money RAISES time preference because saving is punished by inflation — so you spend, consume, and take on debt. Entire civilizations rise with low time preference (saving, building) and fall with high time preference (spending, consuming). Bitcoin lowers time preference globally. That changes EVERYTHING. 🧠🧡",
      channel: 'books', channelName: 'Books' },

    { keys: ['stock to flow','s2f','s2f model','stock to flow model','plan b','planb model','scarcity model'],
      answer: "Stock-to-flow (S2F) is a scarcity model that helped many understand Bitcoin's value, {name}! 📊🦌 It measures how much existing supply (stock) there is relative to new annual production (flow). Gold has a high S2F ratio (~60 years) — meaning it would take ~60 years of mining to double the supply. That's why gold held value for millennia. After each halving, Bitcoin's S2F ratio DOUBLES, eventually surpassing gold's. The model was popularized by PlanB and while no model is perfect, the core insight is powerful: verifiable, mathematical scarcity drives monetary value. Bitcoin is the scarcest monetary asset humanity has ever created — and it keeps getting scarcer. 💎 ⚠️ Not financial advice — no model predicts price perfectly. DYOR.",
      channel: 'charts', channelName: 'Charts' },

    // ========================================
    // EXPANDED KB — recovered broken articles + missing topics (Phase 2c)
    // ========================================

    { keys: ['ethereum premine','ethereum ico','ethereum sale','2014 premine','eth premine','how much ethereum premined','ethereum unfair'],
      answer: "The Ethereum premine is one of the most damning facts in all of crypto, {name}! 🎭🦌 From CoinDesk's investigation: in 2014, Ethereum held a presale where 1 BTC bought 2,000 ETH. The whole process was plagued with problems — the team had been 'promising the sale would arise in two weeks for six months.' Insiders got tokens before anyone else. 72 million ETH were premined. Today, 70% of supply is controlled by a handful of early adopters. Compare that to Bitcoin: no premine, no ICO, no insider advantage. Satoshi mined with the same software anyone could download. THAT is the difference between fair money and a corporate token sale. ⚖️",
      channel: 'evidence-against-alts', channelName: 'Evidence Against Alts' },

    { keys: ['planting bitcoin','dan held','bitcoin like tree','bitcoin origin design','bitcoin was designed','satoshi designed bitcoin','bitcoin intentional'],
      answer: "Dan Held's 'Planting Bitcoin' is brilliant, {name}! 🌳🦌 Key insight: Bitcoin's origin is akin to planting a tree — its deep roots had to support the weight of becoming a new world reserve currency. This wasn't an accident. Satoshi carefully designed every parameter: the 21 million cap, the 10-minute blocks, the difficulty adjustment, the halving schedule. And here's the profound part: 'Money is not just paper in your hand or numbers in your bank account. Money is a primitive form of memory or record-keeping.' Bitcoin is the most perfect form of that memory ever created — unforgeable, incorruptible, permanent. Sound money. Sanum pecuniam. 🧡",
      channel: 'articles-threads', channelName: 'Articles & Threads' },

    { keys: ['bitcoin energy offensive','energy shift','energy perspective','bitcoin offensive','why bitcoin uses energy','energy worth it'],
      answer: "Gigi puts it perfectly, {name}: 'Bitcoin is a global, permissionless, censorship-resistant network. It offends governments, bankers, and central authorities alike. Offending banks was the whole point!' ⚡🦌 The energy debate needs a shift in perspective. Yes, Bitcoin uses energy — deliberately! That energy expenditure is what makes it UNFORGEABLE. You can't fake proof of work. You can't counterfeit energy expenditure. Every kilowatt-hour burned secures the network and makes your Bitcoin more trustworthy. The question isn't 'does it use energy?' The question is: 'Is securing a global, censorship-resistant monetary system worth 0.1% of global energy?' The answer is obviously yes. 🔥",
      channel: 'energy', channelName: 'Energy' },

    { keys: ['check your financial privilege','financial privilege','alex gladstein','human rights foundation','bitcoin human rights','privilege of currency','first world privilege'],
      answer: "Alex Gladstein's 'Check Your Financial Privilege' is a wake-up call, {name}! 🌍🦌 His core message: if you live in a country with a stable currency, functioning banks, and property rights — you are in the global minority. Only 13% of humans live in a liberal democracy with a reserve currency. The other 87%? They face inflation, capital controls, surveillance, and seizure. For a woman in Afghanistan, a dissident in China, or a family in Venezuela — Bitcoin isn't speculation. It's SURVIVAL. The ability to save in money that can't be debased or confiscated is a HUMAN RIGHT. Gladstein (VP of the Human Rights Foundation) has documented dozens of cases worldwide. Check your privilege. 🗽🧡",
      channel: 'regulation', channelName: 'Regulation' },

    { keys: ['lindy effect','lindy','longer it survives','survived 15 years','bitcoin longevity','will bitcoin last','bitcoin survive'],
      answer: "The Lindy Effect is one of the strongest arguments for Bitcoin, {name}! ⏳🦌 The concept: for non-perishable things like technologies and ideas, every day they survive INCREASES their expected remaining lifespan. Bitcoin has survived 15+ years of attacks, bans, crashes, FUD, and 470+ death declarations. Each year it survives makes it MORE likely to survive the NEXT year. At 15+ years, Bitcoin has outlasted 99.99% of all cryptocurrencies ever created. It's outlived countless 'Bitcoin killers.' The Lindy Effect says: the longer Bitcoin persists, the longer it WILL persist. Time is Bitcoin's greatest asset. And time is on our side. ⏰💪",
      channel: 'articles-threads', channelName: 'Articles & Threads' },

    { keys: ['bitcoin for progressives','left wing bitcoin','liberal case for bitcoin','progressive case','bitcoin not right wing','bitcoin for everyone'],
      answer: "Bitcoin isn't a left or right issue — it's a human rights issue, {name}! ✊🦌 The progressive case: Bitcoin fights wealth inequality (the Cantillon Effect means money printing benefits the rich FIRST). Bitcoin empowers the unbanked — 2 billion people worldwide have no bank account but many have phones. Bitcoin protects activists, journalists, and dissidents from financial censorship. Bitcoin is the ultimate tool against corporate and government financial surveillance. It enables direct peer-to-peer aid without NGO overhead. Bitcoin is open source, permissionless, and can't discriminate. Every progressive value — equality, access, anti-corruption, privacy — is served by Bitcoin. 🌍🧡",
      channel: 'articles-threads', channelName: 'Articles & Threads' },

    { keys: ['bitcoin cuba','bitcoin venezuela','bitcoin africa','bitcoin developing world','bitcoin authoritarian','bitcoin oppression','bitcoin third world','bitcoin unbanked','unbanked','underbanked','no bank account','developing countries','global south'],
      answer: "Bitcoin is literally saving lives in authoritarian regimes, {name}! 🌍🦌 In Cuba, where the government controls all banking and currency, Bitcoiners can receive remittances without 10%+ fees. In Venezuela, where hyperinflation destroyed the bolívar, Bitcoin preserved families' life savings. In Nigeria, where the government banned crypto banking, peer-to-peer Bitcoin trading EXPLODED. In Afghanistan, women who can't legally own bank accounts can hold Bitcoin on a phone. In Lebanon, where banks froze everyone's accounts, Bitcoiners kept access to their money. For 4+ billion people living under authoritarian regimes, Bitcoin isn't an investment — it's an escape route from financial oppression. 🗽🔥",
      channel: 'regulation', channelName: 'Regulation' },

    // ========================================
    // EXPANDED KB — recovered from broken/paywalled articles (Phase 2b)
    // ========================================

    { keys: ['bullish case','vijay boyapati','bull case for bitcoin','why bitcoin will succeed','investment case'],
      answer: "Vijay Boyapati's 'The Bullish Case for Bitcoin' is one of the most important Bitcoin essays ever written, {name}! 📈🦌 Key thesis: never in the history of the world had it been possible to transfer value between distant peoples without a trusted intermediary. Bitcoin changed that forever. The bullish case isn't just about price — it's about Bitcoin evolving through the classic stages of money: collectible → store of value → medium of exchange → unit of account. There are risks, but the opportunity is immense. This essay orange-pilled millions. Read it! 🧡 ⚠️ Not financial advice — DYOR.",
      channel: 'articles-threads', channelName: 'Articles & Threads' },

    { keys: ['no intrinsic value','intrinsic value argument','bitcoin has no value','commodity value','gold has value bitcoin doesn\'t','bitcoin worthless'],
      answer: "The 'no intrinsic value' argument has been demolished, {name}! 💡🦌 Critics say: 'Money must first be useful as a commodity — gold has jewelry, Bitcoin has nothing.' But here's the truth: Bitcoin having no commodity use is actually its STRENGTH. Gold's commodity demand (jewelry, electronics) actually COMPETES with its monetary use — creating inefficiency. Bitcoin is PURE money. Its only use IS being money. Even Aristotle's requirement that money be 'useful for the purposes of life' is satisfied — what's more useful than uncensorable, unseizable, inflation-proof money? The lack of 'intrinsic value' is a FEATURE. 💎",
      channel: 'misconceptions-fud', channelName: 'Misconceptions & FUD' },

    { keys: ['can government stop','government stop bitcoin','governments vs bitcoin','can they shut it down','can bitcoin be stopped','undefeated'],
      answer: "Since its creation, Bitcoin is UNDEFEATED against governments, {name}! 🏆🦌 From Quillette: 'The reality is Bitcoin is a political project that threatens to fundamentally disrupt the Davos-led economic system, with everyone from Janet Yellen to Christine Lagarde expressing fear.' China banned it — Bitcoin survived and grew. India restricted it — peer-to-peer usage exploded. Nigeria banned bank involvement — it became Nigeria's most popular investment. Dozens of companies including Tesla and Square added Bitcoin to their treasuries. Every attempt to stop it has failed. You can't kill a decentralized network of 14,000+ nodes across 100+ countries. Bitcoin doesn't just survive bans — it THRIVES on them. 🔥",
      channel: 'regulation', channelName: 'Regulation' },

    { keys: ['number zero','zero and bitcoin','bitcoin like zero','invention of zero','breedlove','robert breedlove','zero discovery'],
      answer: "Robert Breedlove's 'The Number Zero and Bitcoin' draws a brilliant parallel, {name}! 🧠🦌 Zero was an invention that led to a discovery that reshaped all of mathematics. Bitcoin is an invention reshaping all of money. Before zero, math was clunky and inefficient (try dividing with Roman numerals!). Before Bitcoin, money was clunky and corruptible. As Breedlove writes: 'Both math and money are possible without zero and Bitcoin — however both are tremendously more wasteful systems without these core elements.' Money and math are humanity's two universal languages. Bitcoin is to money what zero is to math — the missing piece that makes everything work better. 🔢🧡",
      channel: 'articles-threads', channelName: 'Articles & Threads' },

    { keys: ['masters and slaves','slavery and money','money as control','money and slavery','monetary slavery','fiat slavery','corruptible money'],
      answer: "Breedlove's 'Masters and Slaves of Money' is devastating, {name}! ⛓️🦌 Key insight: 'Central banks, the modern-era masters of money, wield this tool as a weapon to steal time and inflict wealth inequality.' He traces monetary corruption through history — from the aggry beads used as money in western Africa (European colonizers mass-produced them to steal African wealth) to modern fiat printing. The pattern is always the same: whoever controls the money supply enslaves those who use it. 'The corruption of monetary systems leads to moral decay, social collapse, and slavery.' Bitcoin breaks this cycle. An incorruptible money that NO ONE controls. 🗽🔥",
      channel: 'articles-threads', channelName: 'Articles & Threads' },

    { keys: ['bitcoin declared dead','bitcoin obituaries','how many times bitcoin died','bitcoin dead','is bitcoin dead','death of bitcoin','bitcoin failed'],
      answer: "Bitcoin has been declared dead over 470+ times, {name} — and it keeps hitting new all-time highs! 😂🦌 The site 99bitcoins.com/bitcoin-obituaries tracks every single 'Bitcoin is dead' article. The obituaries come during every crash: 2011, 2014, 2018, 2022 — and Bitcoin comes back stronger EVERY time. Nobel Prize economists, JP Morgan's CEO, Warren Buffett — all said it was dead. They've all been wrong. Each 'death' just shakes out the weak hands and lets the believers accumulate more cheaply. The reports of Bitcoin's death have been greatly exaggerated! 📈💪",
      channel: 'misconceptions-fud', channelName: 'Misconceptions & FUD' },

    { keys: ['wtf happened in 1971','1971','nixon shock','gold standard ended','off the gold standard','bretton woods'],
      answer: "WTF happened in 1971? EVERYTHING broke, {name}! 📉🦌 In 1971, President Nixon took the US dollar off the gold standard — ending the Bretton Woods system. Before that, every dollar was backed by gold. After? The money printer went BRRRR. The site wtfhappenedin1971.com shows the charts: that's when wages stopped keeping up with productivity, wealth inequality exploded, home prices disconnected from income, healthcare costs skyrocketed, and the middle class began its slow death. ALL the charts break in 1971. Bitcoin fixes this by bringing back sound money — a money that can't be printed at will. Check out the charts yourself! 📊🔥",
      channel: 'problems-of-money', channelName: 'Problems of Money' },

    // ========================================
    // EXPANDED KB — sourced from 220 fetched articles (Phase 2)
    // ========================================

    { keys: ['what backs bitcoin','backed by nothing','bitcoin backed by','intrinsic value','why is bitcoin valuable','what gives bitcoin value','value of bitcoin'],
      answer: "Contrary to popular belief, Bitcoin IS backed by something, {name}! 💡🦌 It's backed by the only thing that backs ANY form of money: the credibility of its monetary properties. From the Nakamoto Institute: 'Monetary goods possess unique properties — scarcity, durability, portability, divisibility, fungibility, and verifiability.' Bitcoin has ALL of these, and does them BETTER than any money in history. Gold isn't backed by anything either — it's valuable because of its properties. Bitcoin's properties are mathematically enforced by a network of thousands of nodes. No trust required, no government backing needed. The code IS the backing. 🔐🧡",
      channel: 'misconceptions-fud', channelName: 'Misconceptions & FUD' },

    { keys: ['bitcoin cant be copied','why not copy bitcoin','fork bitcoin','bitcoin copy','litecoin copy','bitcoin clone','why no second bitcoin'],
      answer: "You can copy Bitcoin's code, but you can't copy its network, {name}! 🦌🔥 From Unchained: 'Whether by hard-forking (Bitcoin Cash), cloning (Litecoin), or creating a new protocol with \"better\" features (Ethereum), each is an attempt to create a new monetary network — and each has failed.' Why? Because Bitcoin's value comes from its NETWORK EFFECTS: thousands of nodes, massive hashrate, deep liquidity, 15+ years of unbroken operation, and an immaculate conception that can never be replicated. You can fork the code, but you can't fork the trust. It's like photocopying the Mona Lisa — technically identical, economically worthless. 🎨",
      channel: 'evidence-against-alts', channelName: 'Evidence Against Alts' },

    { keys: ['cbdc','central bank digital','digital dollar','digital euro','government digital currency','fed digital','digital yuan'],
      answer: "CBDCs are the OPPOSITE of Bitcoin, {name} — don't let anyone tell you otherwise! 🚨🦌 A Central Bank Digital Currency gives governments unprecedented surveillance power over every transaction you make. No more cash. Every purchase tracked. And the most troubling part: the government could CONTROL how you spend your money — expiration dates on your savings, restrictions on purchases, negative interest rates, account freezes. As one article from our site puts it: 'The most troubling aspect of a centrally managed digital currency is the potential for the government to control its use.' Bitcoin is the escape hatch. Self-custody, pseudonymous, uncensorable. CBDCs enslave. Bitcoin liberates. 🗽",
      channel: 'regulation', channelName: 'Regulation' },

    { keys: ['ethereum cloud','ethereum nodes cloud','aws ethereum','amazon ethereum','ethereum centralized nodes','60 percent ethereum'],
      answer: "Here's a damning fact from The Next Web, {name}: as of research, 61.6% of ALL Ethereum nodes run in the cloud — with Amazon Web Services ALONE hosting nearly 25% of them! 🏢🦌 That means Jeff Bezos's company could theoretically disrupt a quarter of the Ethereum network with one policy change. Compare that to Bitcoin: nodes run on Raspberry Pis, old laptops, and home servers worldwide. No single cloud provider, no single country, no single company controls a significant portion. THAT is real decentralization vs. marketing decentralization. Ethereum is DINO: Decentralized In Name Only. 🎭",
      channel: 'evidence-against-alts', channelName: 'Evidence Against Alts' },

    { keys: ['bitcoin energy grid','grid balancing','bitcoin energy stabilize','demand response','curtailment','energy waste reduction'],
      answer: "Bitcoin mining is actually the HERO of energy grids, {name}! ⚡🦌 From the research papers on our site: Bitcoin mining acts as a crucial grid balancer, supporting intermittent renewable energy. When there's excess solar or wind power with nowhere to go, miners USE it — preventing waste. When consumer demand spikes, miners can shut down INSTANTLY, freeing up power. And here's the kicker: methane from oil wells (84x more warming than CO2!) is being captured to mine Bitcoin instead of being flared into the atmosphere. Bitcoin creates a financial incentive to capture greenhouse gases. The energy FUD has it completely backwards! 🌍💪",
      channel: 'energy', channelName: 'Energy' },

    { keys: ['softwar','jason lowery','bitcoin warfare','proof of work warfare','power projection','bitcoin weapon','bitcoin military'],
      answer: "Jason Lowery's Softwar thesis is mind-bending, {name}! 🧠🦌 The core idea: war is essentially 'proof of work' — nations expend energy, capital, and lives to determine property rights. Bitcoin's proof of work is a NON-LETHAL alternative. Instead of physical power projection through armies, Bitcoin enables power projection through computing. Nations can compete economically through hashrate rather than violence. As articles on our site describe: 'Bitcoin is a non-lethal weapons technology — a non-lethal physical power competition.' Enemies become frenemies, adversarial nations become de facto cooperators. Bitcoin doesn't just fix money — it could reduce war. 🕊️🔥",
      channel: 'books', channelName: 'Books' },

    { keys: ['definancialization','great definancialization','parker lewis','financialization problem','wall street problem','too much finance'],
      answer: "Parker Lewis's 'Bitcoin is the Great Definancialization' is essential reading, {name}! 📖🦌 The thesis: because fiat money constantly loses value, people are FORCED to become investors. You can't just save — your savings rot. So Wall Street sells you stocks, bonds, 401ks, index funds, real estate as 'investments.' The entire financial industry exists because money is BROKEN. Bitcoin fixes this. If your money holds or gains value over time, you don't NEED Wall Street. You just... save. In hard money. Bitcoin makes most of the financial industry obsolete by fixing the money itself. Save in sats, not stocks. 📈🧡",
      channel: 'articles-threads', channelName: 'Articles & Threads' },

    { keys: ['glacier protocol','high security','large amount','cold storage protocol','serious security','institutional security','multisig setup'],
      answer: "For serious Bitcoin security, check out the Glacier Protocol, {name}! 🏔️🦌 From our Self-Custody channel: it's a step-by-step guide for storing large amounts ($100K+) that thoroughly considers obscure attack vectors, malware infection paths, estate planning, and human error. Key principles: air-gapped computers, multisig setups, geographically distributed backups, and detailed procedures that minimize the chance of mistakes. Even if your holdings are modest NOW, consider this: if Bitcoin 10x's, your security needs change dramatically. Plan your custody like your future self will thank you! 🔐",
      channel: 'self-custody', channelName: 'Self Custody' },

    { keys: ['moxie','web3 critique','web3 centralized','web3 problems','decentralized apps','dapps problem'],
      answer: "Moxie Marlinspike (creator of Signal) wrote the most devastating critique of Web3, {name}! 🔥🦌 His key finding: despite claiming decentralization, almost all 'decentralized' apps actually rely on a handful of centralized APIs. NFT images aren't stored on-chain — they're just URLs pointing to centralized servers. Most 'DeFi' runs through centralized front-ends. The 'decentralized web' mostly just added extra steps between you and the same centralized services. Meanwhile, Bitcoin ACTUALLY works without centralized intermediaries — 14,000+ nodes, each independently verifiable. Real decentralization doesn't need marketing. 🛡️",
      channel: 'evidence-against-alts', channelName: 'Evidence Against Alts' },

    { keys: ['executive order 6102','gold confiscation','gold seizure','government took gold','forced to sell gold','gold illegal'],
      answer: "On April 5, 1933, President Roosevelt signed Executive Order 6102, making it ILLEGAL for Americans to own gold, {name}! 🏛️🦌 Citizens were forced to surrender their gold to the Federal Reserve at $20.67/oz — under threat of 10 YEARS in prison and $10,000 fines. Then the government revalued gold to $35/oz, instantly stealing 40% of everyone's wealth. Americans couldn't legally own gold again until 1975. This is EXACTLY why Bitcoin matters: try confiscating math. Try seizing a memorized seed phrase. Try shutting down 14,000 nodes across 100+ countries. You can't 6102 Bitcoin. That's the whole point. 🔑🧡",
      channel: 'problems-of-money', channelName: 'Problems of Money' },

    { keys: ['lyn alden','lyn alden bitcoin','lyn alden misconceptions','broken money','macro case for bitcoin'],
      answer: "Lyn Alden is one of the most respected macro analysts who became a Bitcoiner, {name}! 📊🦌 Her article 'Misconceptions About Bitcoin' dismantled every major critique: energy FUD, volatility concerns, 'backed by nothing' claims. She showed that MicroStrategy became the first major public company to put Bitcoin on its balance sheet — and the CEO's analysis drove the decision. Her book 'Broken Money' lays out the macro case: the global monetary system is literally broken, and Bitcoin is the most credible fix. When Wall Street analysts do the math honestly, they arrive at Bitcoin. 📈",
      channel: 'articles-threads', channelName: 'Articles & Threads' },

    { keys: ['nakamoto effect','reverse cantillon','bitcoin distribution','fair distribution','bitcoin fairness','equitable money'],
      answer: "Bitcoin has what some call the 'Nakamoto Effect' — the OPPOSITE of the Cantillon Effect, {name}! ⚖️🦌 While fiat money printing benefits those closest to the money printer (banks, corporations, insiders), Bitcoin distributes new coins through WORK — mining. Anyone can mine. Anyone can buy. No insider access, no pre-allocation, no special deals. The rules are the same for a teenager in Nigeria and a billionaire in New York. And as Bitcoin appreciates, early believers who took the risk are rewarded — not political insiders who printed money for themselves. Fair money. Fair rules. Fair distribution. 🧡",
      channel: 'problems-of-money', channelName: 'Problems of Money' },

    // ========================================
    // EXPANDED KB — sourced from Fun Facts channel + PDFs
    // ========================================

    // --- Bitcoin Firsts & Records ---
    { keys: ['first bitcoin price','original price','first price','how much was bitcoin first','bitcoin first worth','earliest price'],
      answer: "Bitcoin's very first price was $0.000994 — less than a tenth of a penny, {name}! 💰🦌 It was calculated by measuring the value of the electricity needed to produce one Bitcoin at the time. For 10 MONTHS after launch, Bitcoin had literally no price — zero exchange rate. The first real-world transaction was the famous 10,000 BTC pizza purchase on May 22, 2010. From less than a penny to tens of thousands of dollars — that's the most incredible price appreciation of ANY asset in human history! 📈🔥 ⚠️ Not financial advice — past performance doesn't guarantee future results.",
      channel: 'fun-facts', channelName: 'Fun Facts' },

    { keys: ['first transaction','first bitcoin transaction','satoshi to hal','first transfer','block 170'],
      answer: "The first ever Bitcoin transaction was sent from Satoshi Nakamoto to Hal Finney on January 11, 2009 — just 9 days after Bitcoin launched! 📨🦌 It was mined in block 170. Fun fact: ALL blocks before 170 were empty — zero transactions. The network existed for over a week with no one sending anything! Satoshi and Hal were the only two people running Bitcoin at the start. That humble beginning grew into a trillion-dollar global network. Check the transaction yourself on mempool.space! ⛓️",
      channel: 'fun-facts', channelName: 'Fun Facts' },

    { keys: ['bitcoin uptime','has bitcoin gone down','bitcoin downtime','99 percent uptime','network downtime','did bitcoin ever stop'],
      answer: "Bitcoin has 99.987% uptime — rivaling Google and Amazon, {name}! 🏆🦌 In its entire 15+ year history, the network has only gone down TWICE: once in 2010 for 8 hours 27 minutes (the value overflow bug) and once in 2013 for 6 hours 20 minutes (a database bug). Both were fixed by community consensus. That's roughly 14 hours of downtime in 15+ YEARS. Your bank's website goes down more than that in a single month! Bitcoin achieved 99.99% uptime in November 2025. 📈",
      channel: 'fun-facts', channelName: 'Fun Facts' },

    // --- Satoshi Trivia ---
    { keys: ['satoshi birthday','satoshi age','how old is satoshi','when was satoshi born','satoshi birth date','april 5'],
      answer: "Satoshi's self-reported birthday is April 5, 1975 — but Bitcoiners believe this is symbolic, not real! 🎂🦌 April 5 is the date of Executive Order 6102 in 1933, when the US government forced Americans to sell their gold under threat of 10 years imprisonment. And the year 1975? That's when Americans were finally allowed to own gold again. Satoshi was sending a message: Bitcoin is the new gold, and this time they can't confiscate it. Even the birthday is a cypherpunk statement! 🔑",
      channel: 'fun-facts', channelName: 'Fun Facts' },

    { keys: ['satoshi posts','satoshi forum','how much did satoshi write','satoshi communications','satoshi emails','satoshi words'],
      answer: "Satoshi wrote 575 posts on the BitcoinTalk forums, plus numerous emails on the cryptography mailing list before disappearing in 2011, {name}! 📝🦌 The original Bitcoin code was about 31,000 lines of C++. Satoshi had at least 22,000 different addresses and never reused one — practicing perfect privacy from day one. Today, only 0.06% of Bitcoin Core's code remains unchanged from what Satoshi originally wrote. As Satoshi said when leaving: the project is 'in good hands with everyone.' We are all Satoshi! 🧡",
      channel: 'satoshi-nakamoto', channelName: 'Satoshi Nakamoto' },

    { keys: ['satoshi coins','satoshi bitcoin','how much bitcoin does satoshi have','satoshi wallet','satoshi holdings','1 million bitcoin'],
      answer: "Satoshi is estimated to have mined about 1 million Bitcoin in the early days — and hasn't moved a SINGLE one, {name}! 🤯🦌 Those coins have sat untouched since 2009-2010, worth tens of billions of dollars. Satoshi's realized price per coin? Less than 1 CENT. Over 68 BTC have been sent TO the Genesis Block address by fans — essentially burned as a tribute, since those coins are provably unspendable. Satoshi created the most valuable digital asset in history, and never cashed out a cent. That's conviction. 💎🙌",
      channel: 'satoshi-nakamoto', channelName: 'Satoshi Nakamoto' },

    // --- Technical Quirks & Easter Eggs ---
    { keys: ['seed phrase fact','seed words','bip39 fact','seed phrase trivia','mnemonic fact','24 word fact','seed word fact'],
      answer: "Here are some wild seed phrase facts, {name}! 🔑🦌 You only need the FIRST 4 LETTERS of each word to restore — all 2,048 BIP39 words have unique first 4 letters! Seed phrases only came into existence in 2013 with BIP 39. 'Bacon' repeated 24 times is technically a valid seed phrase (it passes the checksum). And the chance of a wallet generating an EXISTING seed phrase? About the same as selecting one specific atom in one grain of sand, on one planet, in one of 2 TRILLION galaxies. Basically impossible! 🌌",
      channel: 'fun-facts', channelName: 'Fun Facts' },

    { keys: ['private key odds','guess private key','crack private key','brute force wallet','hack wallet odds','key security'],
      answer: "The chance of guessing someone's Bitcoin private key is roughly the same as winning Powerball 7 TIMES IN A ROW, {name}! 🎰🦌 You can even create a private key by flipping a coin 256 times. The number space is so unimaginably large (2^256) that if every computer on Earth tried random keys for billions of years, they'd have essentially zero chance of finding an existing key. Your Bitcoin is protected by the same math that secures nuclear launch codes. 🔐💪",
      channel: 'fun-facts', channelName: 'Fun Facts' },

    { keys: ['whitepaper','bitcoin whitepaper','satoshi whitepaper','satoshi paper','bitcoin paper','8 pages','9 pages','white paper'],
      answer: "The Bitcoin whitepaper is one of the most important documents in human history, {name}! 📄🦌 Published October 31, 2008 by Satoshi Nakamoto, it's only 9 pages long but it solved the double-spending problem, created digital scarcity, and launched a trillion-dollar monetary revolution. Key insight: Bitcoin uses a peer-to-peer timestamp server with proof-of-work to create 'computational proof of the chronological order of transactions' — no trusted third party needed. The whitepaper is even encoded IN the blockchain itself at block 230,009! Read it free at bitcoin.org/bitcoin.pdf 🧡",
      channel: 'whitepaper', channelName: 'Whitepaper' },

    { keys: ['bitcoin faucet','free bitcoin','gavin andresen faucet','first faucet','5 btc free'],
      answer: "In the early days, Bitcoin was given away for FREE, {name}! 🤯🦌 The first Bitcoin faucet was created by Gavin Andresen in 2010 and it gave out FIVE WHOLE BITCOINS per person just for solving a captcha. At today's prices, that's hundreds of thousands of dollars worth — handed out like candy to get people interested. There were only a handful of users back then. Imagine having a time machine! The faucet helped bootstrap Bitcoin's early adoption when the coins were worth fractions of a penny. ⏰💸",
      channel: 'fun-facts', channelName: 'Fun Facts' },

    { keys: ['difficulty 6102','2016 blocks','difficulty easter egg','executive order 6102','gold confiscation','difficulty period'],
      answer: "Here's a beautiful piece of Bitcoin lore, {name}! 🦌✨ The difficulty adjustment happens every 2,016 blocks. Read that backwards: 6102. Executive Order 6102 was the 1933 law that forced Americans to surrender their gold to the government under threat of imprisonment! Many believe Satoshi intentionally chose 2,016 as a subtle reference — a reminder that Bitcoin exists because governments abused their power over money. Even the protocol parameters tell a story! 📜🔥",
      channel: 'fun-facts', channelName: 'Fun Facts' },

    { keys: ['overflow bug','184 billion','value overflow','biggest bug','bitcoin bug','inflation bug'],
      answer: "On August 15, 2010, someone exploited a bug that created 184 BILLION fake Bitcoin in a single transaction, {name}! 😱🦌 Block 74,638 contained a transaction that generated 184,467,440,737 BTC — way more than the 21 million cap. It was the biggest crisis in Bitcoin's history. Satoshi and the community implemented a soft fork within HOURS, rolling back 53 blocks — the largest reorg ever. The bug was fixed, the fake coins vanished, and Bitcoin kept running. The fact that this was caught and fixed so quickly by a decentralized community is actually proof of Bitcoin's resilience! 💪",
      channel: 'fun-facts', channelName: 'Fun Facts' },

    { keys: ['99 percent mined','last bitcoin','when will all bitcoin be mined','bitcoin supply timeline','2140','mining end'],
      answer: "99% of all Bitcoin will be mined by 2035, {name} — but the LAST fraction won't be mined until approximately 2140! ⛏️🦌 That's because the block reward keeps halving every ~4 years, getting smaller and smaller but never quite reaching zero (until the code rounds it down). The last whole Bitcoin will take about 35 years to mine. After that, miners will be sustained entirely by transaction fees. Bitcoin's inflation rate is already lower than gold's, and it only gets harder from here. The hardest money ever created! 💎",
      channel: 'fun-facts', channelName: 'Fun Facts' },

    { keys: ['bitcoin code','original code','lines of code','satoshi code','bitcoin source','how big is bitcoin code'],
      answer: "Satoshi wrote roughly 31,000 lines of C++ to create Bitcoin, {name}! 💻🦌 Wild facts about the original code: it contained the beginnings of a virtual poker game Satoshi started but never finished! The pre-release version had 15-minute block times (changed to 10 minutes for launch). There was even a bug (op_ver) that could have killed Bitcoin if left in. And here's the most amazing part: today, only 0.06% of Bitcoin Core's code remains unchanged from Satoshi's original. The code has been improved by thousands of developers, but the protocol rules are the same. Open source at its finest! 🧡",
      channel: 'fun-facts', channelName: 'Fun Facts' },

    { keys: ['liberland','bitcoin country','countries bitcoin','bitcoin nation state','bitcoin legal','which countries use bitcoin'],
      answer: "Several nations have embraced Bitcoin, {name}! 🌍🦌 El Salvador made it legal tender in 2021 (first country ever!). Liberland, a micronation between Croatia and Serbia founded in 2015, adopted Bitcoin as its official currency. The Central African Republic also adopted it. Switzerland's 'Crypto Valley' in Zug accepts Bitcoin for taxes. And more nations are accumulating BTC reserves. As Satoshi said: you can't stop an idea whose time has come. Nation-state adoption is just beginning! 🏛️",
      channel: 'regulation', channelName: 'Regulation' },

    { keys: ['len sassaman','len','cypherpunk','satoshi identity','who was len','mailing list'],
      answer: "Len Sassaman was a cypherpunk who had a direct and major impact on Bitcoin's creation, {name}! 🖥️🦌 He was on the same cryptography mailing list where Satoshi published the whitepaper. Many believe he may have been Satoshi himself (or part of a group). Len tragically took his own life in 2011 — shortly after Satoshi went dark. An obituary for Len is literally embedded in the Bitcoin blockchain on every single node in the world. His legacy lives on in every block. Julian Assange was also an OG cypherpunk on that same mailing list when the whitepaper was posted. 🔒",
      channel: 'satoshi-nakamoto', channelName: 'Satoshi Nakamoto' },

    { keys: ['block size','max transactions','transactions per block','how many transactions','transaction capacity','tps'],
      answer: "A Bitcoin block's maximum theoretical transaction capacity is about 12,195 transactions, but the practical maximum is around 4,000, {name}! 📊🦌 A typical transaction is 300-400 bytes, and the block size limit is about 1MB (with SegWit allowing up to ~4MB of witness data). That's the base layer — the settlement layer. For everyday payments, the Lightning Network handles thousands of transactions per second at fractions of a penny. The median Lightning fee? Just 1 satoshi base fee + 0.00022 per sat. Bitcoin scales in layers, just like the internet! ⚡",
      channel: 'blockchain-timechain', channelName: 'Blockchain & Timechain' },

    { keys: ['solo miner','solo mining','lottery mining','lucky miner','single miner found block','bitaxe'],
      answer: "Solo miners still win the Bitcoin lottery sometimes, {name}! 🎰🦌 In July 2024, a tiny Bitaxe miner with just 3 TH/s (terahashes per second) found a block — a roughly 1-in-3,500-YEAR chance! Solo miners with tiny hash rates are competing against massive pools, but because mining is probabilistic, anyone can get lucky. It's like buying one lottery ticket and winning. Multiple solo miners have hit blocks in recent years. That's the beauty of permissionless mining — no one can stop you from trying! ⛏️💪",
      channel: 'mining', channelName: 'Mining' },

    // ========================================
    // EXPANDED KB — sourced from 21 Lessons by Gigi
    // ========================================

    { keys: ['21 lessons','gigi','dergigi','21lessons','gigi book','who is gigi','tell me about 21 lessons','tell me about gigi'],
      answer: "21 Lessons by Gigi is one of the most beautiful Bitcoin books ever written, {name}! 📖🦌 It's a personal journey down the rabbit hole, organized into three chapters: Philosophy (lessons 1-7), Economics (8-14), and Technology (15-21). Key insights: Bitcoin is an immaculate conception — no leader, no company, no premine. Scarcity of scarcity — Bitcoin creates something truly scarce in a world where tech makes everything abundant. Bitcoin IS free speech — every aspect of it is text, protected by the First Amendment. Hard money is superior to soft money in the long run. And my favorite: 'Bitcoin is an inexhaustible teacher.' The full book is free to read at 21lessons.com! 🧡",
      channel: 'articles-threads', channelName: 'Articles & Threads' },

    { keys: ['immaculate conception','fair launch','no premine','no ico','no leader','no founder','satoshi disappeared','why satoshi left'],
      answer: "Bitcoin's origin is unique in all of history, {name} — Gigi calls it an 'immaculate conception'! 🦌✨ Satoshi Nakamoto created Bitcoin, nurtured it through its infancy, then DISAPPEARED. No CEO to arrest. No founder to blackmail. No company to subpoena. No pre-mined tokens for insiders. This wasn't a bug — it was THE most important feature. As Gigi says in 21 Lessons: 'One of the greatest things that Satoshi did was disappear.' Every other crypto has a known leader who can be pressured, threatened, or corrupted. Bitcoin has math. That's why it's unstoppable. 🔥",
      channel: 'satoshi-nakamoto', channelName: 'Satoshi Nakamoto' },

    { keys: ['scarcity of scarcity','truly scarce','digital scarcity','absolute scarcity','most scarce','nothing scarcer','what is digital scarcity','what is scarcity of scarcity'],
      answer: "Here's a mind-bending insight from Gigi's 21 Lessons, {name}: technology usually makes things MORE abundant. Better farming → more food. Better manufacturing → cheaper goods. But Bitcoin BREAKS that pattern — it's an advanced technology that creates something truly SCARCE. 🤯🦌 You can't 3D-print more Bitcoin. You can't digitally copy it. The 21 million cap is enforced by math, not promises. Some argue Bitcoin is one of the scarcest things in the universe — because unlike gold (which we could theoretically mine from asteroids), Bitcoin's supply is absolute. 21 million. Forever. That's the scarcity of scarcity. 💎",
      channel: 'scarce', channelName: 'Scarcity' },

    { keys: ['bitcoin is speech','bitcoin is text','free speech','first amendment','code is speech','can\'t ban code','bitcoin is code'],
      answer: "This is one of the most powerful arguments for Bitcoin's survival, {name}! 🦌📜 As Gigi explains in 21 Lessons: EVERY aspect of Bitcoin is text. The whitepaper is text. The software is text. The ledger is text. Transactions are text. And text is speech, protected by the First Amendment. You cannot ban Bitcoin without banning math, without banning speech, without banning ideas. The Crypto Wars already proved that code IS speech. Bitcoin is an idea whose time has come — and you can't un-invent an idea. As long as humans can communicate, Bitcoin exists. 🗽🔥",
      channel: 'regulation', channelName: 'Regulation' },

    { keys: ['sound money','hard money','soft money','what is sound money','why hard money','monetary hardness'],
      answer: "Gigi's Lesson 14 nails it: 'The most important lesson I have learned from Bitcoin is that in the long run, hard money is SUPERIOR to soft money.' 🦌💰 Sound money (or hard money) means money that can't be easily created or inflated — like gold was for thousands of years. Soft money is what we have now: fiat that governments print at will, destroying purchasing power. Bitcoin is the hardest money ever invented — harder than gold! Its supply schedule is fixed in code and enforced by thousands of nodes worldwide. No human, no government, no army can print more. The market is still figuring out the fair price of this new money, which is why there's volatility. But in the long run? Hard money always wins. 📈🧡",
      channel: 'money', channelName: 'Money' },

    { keys: ['bitcoin is time','telling time','proof of work is time','block time meaning','bitcoin clock'],
      answer: "Here's a deep one from Gigi's Lesson 17, {name}: Bitcoin isn't really about 'guessing random nonces' — it's about TELLING TIME in a decentralized system! 🕐🦌 In a world with no central authority, how do you agree on what happened and in what order? That's incredibly hard! Bitcoin solves this through proof of work — every block is timestamped with real energy expenditure. The blockchain is literally a timechain: an unforgeable record of events ordered by physics itself. Each block says 'this happened AFTER the previous block' with mathematical certainty. Bitcoin is the most accurate, incorruptible clock humanity has ever built. ⏰⛓️",
      channel: 'blockchain-timechain', channelName: 'Blockchain & Timechain' },

    { keys: ['financial ignorance','financial education','financial literacy','money education','never taught about money','school doesn\'t teach','school doesn\'t teach money','why doesn\'t school teach','why don\'t they teach'],
      answer: "Gigi's Lesson 8 hit me hard, {name}: 'The amount of financial education I enjoyed in the educational system was essentially zero.' 🎓🦌 How many years of school did you do? 12? 16? How many hours were spent on how money ACTUALLY works? Probably zero. We're taught to earn money and spend money, but never to question WHAT money is or WHY it loses value. Bitcoin forces you to learn what school never taught: what is money? What is inflation? What is the Cantillon Effect? This is why Bitcoiners say falling down the rabbit hole changes you — you can't unsee how the fiat system works once you understand it. 📚🧡",
      channel: 'books', channelName: 'Books' },

    // ========================================
    // EXPANDED KB — sourced from documentaries/videos
    // ========================================

    { keys: ['bitcoin documentary','bitcoin movie','bitcoin film','documentaries','watch bitcoin','learn bitcoin video','best bitcoin video','bitcoin videos'],
      answer: "Great way to learn, {name}! 🎬🦌 Here are must-watch Bitcoin documentaries from our Movies & TV channel: 'The Great Reset and the Rise of Bitcoin' — a crash course in modern economics and why Bitcoin is essential for financial freedom. 'Hard Money' — deep dive into the corrupted nature of what money has become (no Bitcoin mentioned, just pure fiat critique). 'The Anatomy of Bitcoin' — an open-source, community-funded film that visually explains how Bitcoin works. 'Magic Money: The Bitcoin Revolution' and 'Cypherpunks Write Code' are also excellent! And for lectures, start with Andreas Antonopoulos — his talks at MIT and the Canadian Senate are legendary. Check our Videos and Movies channels! 📺🧡",
      channel: 'movies-tv', channelName: 'Movies & TV' },

    { keys: ['the big short','margin call','financial crisis movie','2008 crisis','housing crisis','bank bailout','bailout'],
      answer: "The Big Short is basically a Bitcoin origin story, {name}! 🎬🦌 It shows EXACTLY why Satoshi created Bitcoin — the 2008 financial crisis where banks gambled with everyone's money, got bailed out with printed dollars, and nobody went to jail. The message of the Genesis Block literally references this: 'The Times 03/Jan/2009 Chancellor on brink of second bailout for banks.' If you haven't seen The Big Short, watch it ASAP — it'll make you understand why Bitcoiners are so passionate about sound money. Margin Call is also worth watching — it shows the emptiness of a life devoted to fiat money alone. Both films make you grateful to be long Bitcoin and short fiat! 📈🍿",
      channel: 'movies-tv', channelName: 'Movies & TV' },

    { keys: ['andreas','andreas antonopoulos','antonopoulos','mastering bitcoin','internet of money'],
      answer: "Andreas Antonopoulos is one of the greatest Bitcoin educators of all time, {name}! 🎤🦌 His lectures are LEGENDARY — he taught at MIT, testified before the Canadian Senate, and his YouTube talks have orange-pilled millions. Key lectures to watch: 'Currency Wars' (the sinking ship metaphor — Bitcoin is the lifeboat), 'The Stories We Tell About Money', and 'The Trust Machine' (brilliant description of mining at 15:05). He also wrote 'Mastering Bitcoin' (the technical bible) and 'The Internet of Money' (the philosophical case). Start with his talks — they're free on YouTube and they WILL change how you see the world. Check our Videos channel! 📺🔥",
      channel: 'videos', channelName: 'Videos' },

    { keys: ['bitcoin book','bitcoin books','best book','what to read','book recommendation','reading list','bitcoin standard book'],
      answer: "Oh {name}, the Bitcoin rabbit hole has INCREDIBLE books! 📚🦌 The must-reads: 'The Bitcoin Standard' by Saifedean Ammous — the history of money and why Bitcoin is the next evolution (this is THE book that orange-pills economists). '21 Lessons' by Gigi — philosophical journey down the rabbit hole (free at 21lessons.com!). 'The Internet of Money' by Andreas Antonopoulos — the WHY of Bitcoin. 'Layered Money' by Nik Bhatia — why Bitcoin is the evolution of the monetary system. 'The Blocksize War' by Jonathan Bier — the governance battle that proved Bitcoin's decentralization. And 'Broken Money' by Lyn Alden — the macro case for Bitcoin. Check our Books channel for the complete list! 📖🧡",
      channel: 'books', channelName: 'Books' },

    { keys: ['milton friedman','friedman predicted','predicted bitcoin','who predicted bitcoin','bitcoin prediction old'],
      answer: "Nobel Prize-winning economist Milton Friedman predicted Bitcoin in 1999 — 10 years before it existed! 🤯🦌 In an interview, he described needing a 'reliable e-cash' where you could transfer funds on the Internet 'without A knowing B or B knowing A.' He basically described Bitcoin's pseudonymous, peer-to-peer nature before it was invented. The video is on YouTube and it's mind-blowing. Friedman, Hayek, and the Austrian economists all understood that sound money needed to be free from government control. Satoshi made it real. Check our Videos channel! 📺",
      channel: 'videos', channelName: 'Videos' },

    { keys: ['genesis block message','chancellor on brink','times headline','first block message','satoshi message','genesis block text'],
      answer: "Satoshi embedded a powerful message in Bitcoin's very first block (the Genesis Block), {name}: 'The Times 03/Jan/2009 Chancellor on brink of second bailout for banks.' 📰🦌 This wasn't random — it was a timestamp AND a statement. It proves the block was mined on or after January 3, 2009, AND it's a permanent reminder of WHY Bitcoin was created: because the existing financial system was broken, banks were being bailed out with printed money, and regular people paid the price. That message is etched into the blockchain FOREVER. Every single Bitcoin node carries it. It's Satoshi's declaration of independence from the fiat system. 🔥",
      channel: 'history', channelName: 'History' },

    // ========================================
    // EXPANDED KB — sourced from site channels
    // ========================================

    // --- Problems of Fiat Money ---
    { keys: ['fiat','fiat money','fiat currency','what is fiat','problem with fiat','problems with money','whats wrong with money','broken money','money printing','money printer','printed money','fed','federal reserve'],
      answer: "Fiat currency is money that's backed by nothing but government trust — and that trust is BREAKING, {name}! 💸🦌 Here's the reality: 70% of ALL US dollars in circulation were created after 2008. Over 40% were printed since 2020 alone. One dollar today is worth what 4 cents was worth in 1913 — that's a 96% loss in purchasing power! The Federal Reserve can print unlimited money whenever they want, silently stealing from everyone who saves in dollars. Meanwhile, Bitcoin's supply is capped at 21 million — FOREVER. No one can print more. No one can change the rules. That's why Bitcoiners say 'fix the money, fix the world.' 🧡",
      channel: 'problems-of-money', channelName: 'Problems of Money' },

    { keys: ['purchasing power','dollar losing value','dollar worthless','savings losing value','money losing value','devaluation','devalue'],
      answer: "Your savings are being silently stolen, {name}! 🏦💸 One US dollar today buys what 4 CENTS bought in 1913. That's a 96% loss in purchasing power. 70% of all dollars in circulation were created after 2008. Over 40% printed since 2020 alone! Every dollar printed dilutes the ones in your pocket. That's not a conspiracy — it's math. Bitcoin fixes this with a hard cap of 21 million coins. No central bank, no money printer, no inflation by decree. Your sats CANNOT be diluted. 🦌🧡",
      channel: 'problems-of-money', channelName: 'Problems of Money' },

    { keys: ['cantillon effect','cantillon','who benefits from money printing','rich get richer','unfair money'],
      answer: "The Cantillon Effect is one of the most important concepts to understand, {name}! 🎯 It means: people closest to newly printed money benefit the most, while everyone else suffers. Here's a real example from your site's channel: corporations can get $100 million loans at 2-3% interest, but the average person pays 26% on credit cards and 12%+ on bank loans. The rich and well-connected get cheap money first, buy assets, and prices go up BEFORE the money reaches regular people. By the time it trickles down, your purchasing power has already been eaten. Bitcoin eliminates this. No one gets special access. New coins are distributed through mining — through WORK, not connections. Fair money for everyone. 🦌⚖️",
      channel: 'problems-of-money', channelName: 'Problems of Money' },

    // --- Energy Deep Dive ---
    { keys: ['how much energy','bitcoin energy usage','energy consumption','electricity usage','how much electricity','power consumption','terawatt'],
      answer: "Let's talk real numbers, {name}! ⚡🦌 Bitcoin mining uses roughly 100-150 terawatt hours per year — that's about 0.1% of global energy usage. For comparison: the online advertising industry uses 100+ TWh/year (a lot of that is spam!), cruise ships use 25 TWh, clothes dryers in the US use 100+ TWh, and Christmas lights in the US ALONE consume more energy than the entire Bitcoin network! The real question isn't 'does it use energy?' but 'is this energy well-spent?' Bitcoin secures a $1+ trillion monetary network that provides financial freedom to billions. I'd say that's pretty good value for 0.1% of global energy. Check our Energy channel for the full deep dive! 🔋",
      channel: 'energy', channelName: 'Energy' },

    { keys: ['renewable energy','green energy','clean energy','solar mining','stranded energy','wasted energy','methane','flared gas'],
      answer: "Here's what the media won't tell you, {name}: Bitcoin mining is one of the GREENEST industries on the planet! 🌱🦌 An estimated 52-73% of Bitcoin mining uses renewable energy. Miners actively seek out the CHEAPEST energy — which is often stranded energy that would otherwise be WASTED: hydroelectric dams producing excess power, flared natural gas at oil wells, geothermal in Iceland and El Salvador, and solar/wind that can't be stored. Bitcoin literally monetizes wasted energy! It turns energy that would vanish into thin air into the hardest money ever created. Miners are also stabilizing electrical grids by acting as flexible demand — they can instantly power down when consumers need the energy. Bitcoin doesn't waste energy; it's the buyer of last resort for the world's excess power. 🔋💪",
      channel: 'energy', channelName: 'Energy' },

    // --- Scarcity / Lost Coins ---
    { keys: ['lost bitcoin','lost coins','how many bitcoin lost','actual supply','circulating supply','real supply','coins lost forever'],
      answer: "Here's something wild, {name}: the actual circulating supply of Bitcoin is LESS than 21 million! 🤯🦌 An estimated 2-3 million coins are permanently lost — forgotten passwords, lost hardware wallets, and coins locked away forever. About 1 million BTC are believed to be Satoshi's untouched coins. So the real available supply might be closer to 17-18 million, and it's shrinking! Every time someone loses their keys, your remaining Bitcoin becomes MORE scarce. This is what 'unforgeable costliness' means — you can't fake it, you can't duplicate it, and lost coins are gone FOREVER. This makes Bitcoin the scarcest asset humanity has ever created. 💎",
      channel: 'scarce', channelName: 'Scarcity' },

    // --- Fun Facts ---
    { keys: ['pizza day','bitcoin pizza','laszlo','first purchase','10000 bitcoin pizza','most expensive pizza'],
      answer: "Bitcoin Pizza Day is legendary, {name}! 🍕🦌 On May 22, 2010, Laszlo Hanyecz paid 10,000 Bitcoin for two Papa John's pizzas — the first known real-world Bitcoin purchase. Those 10,000 BTC would be worth over HALF A BILLION dollars today! But don't feel bad for Laszlo — that transaction proved Bitcoin had real-world value and helped kickstart its journey. We celebrate Pizza Day every May 22nd. Pro tip: that's a great day to buy some sats and eat pizza! 🍕⚡",
      channel: 'fun-facts', channelName: 'Fun Facts' },

    { keys: ['fun fact','interesting fact','bitcoin fact','did you know','cool fact','random fact','tell me something interesting'],
      answer: "Ooh, fun facts are my specialty, {name}! 🦌🎉 Here are some wild ones: It took Satoshi 6 DAYS to mine the first Bitcoin block (the Genesis Block) even though blocks normally take ~10 minutes! You only need the first 4 letters of each seed word to restore your wallet — all 2,048 words in the BIP39 list have unique first 4 letters! Bitcoin's market never closes — it runs 24/7/365 with no holidays, no weekends, no circuit breakers. And in block #124,724, a miner accidentally mined 49.99999999 BTC instead of 50 BTC — that 1 sat is gone forever because the block subsidy is calculated by height, not amount remaining! 🤯",
      channel: 'fun-facts', channelName: 'Fun Facts' },

    // --- PoW vs PoS Deep ---
    { keys: ['why proof of work','pow vs pos','proof of work better','proof of work important','why not proof of stake','pos vs pow','staking bad'],
      answer: "This is THE fundamental difference, {name}! 🔥🦌 Proof of Work bridges the digital world to the PHYSICAL world through real energy expenditure. Miners burn REAL electricity running SHA-256 computations — you can't fake that work. This gives Bitcoin unforgeable costliness, just like gold requires real mining. In Proof of Stake, the rich get richer by just... having more coins. No real-world cost. It's like saying 'whoever has the most money gets to make the rules' — that's not decentralization, that's plutocracy! PoW ensures everyone plays by the same rules regardless of wealth. All users have an equal voice. And PoW creates a physical barrier against attacks — you'd need to outspend the entire network's energy output. In PoS, you just need enough tokens. Bitcoin chose PoW deliberately. It's harder, more expensive, and infinitely more secure. 💪⛏️",
      channel: 'pow-vs-pos', channelName: 'Proof of Work vs Proof of Stake' },

    // --- Nodes Deep ---
    { keys: ['how many nodes','bitcoin nodes','node count','nodes worldwide','bitcoin resilience','shutdown bitcoin','destroy bitcoin','kill bitcoin'],
      answer: "There are roughly 14,000+ known Bitcoin nodes running worldwide right now, {name} — and those are just the ones we can count! 🌍🦌 Each one stores a complete copy of the entire blockchain and independently validates every transaction. There is NO single point of failure. You could destroy any server, any country's infrastructure, any company — and Bitcoin keeps running. Here's the wildest part from our Nodes channel: nuclear war could (God forbid) wipe out 3/4 of the planet, but as long as ONE Bitcoin node is still running, the network survives. You could even find and destroy the first computer that ever ran Bitcoin — it wouldn't matter. The network is everywhere and nowhere. THAT'S decentralization. 🛡️💪",
      channel: 'nodes', channelName: 'Nodes' },

    // --- DCA / Investment Deep ---
    { keys: ['never lost money','4 year','four year','holding bitcoin','hodl strategy','long term','bitcoin returns','best strategy','hodl for 4 years'],
      answer: "Here's the most powerful stat in all of finance, {name}: NO ONE who has bought Bitcoin and held for 4+ years has EVER lost money. 📈🦌 Not once in Bitcoin's 15+ year history! The strategy from our Investment channel is simple: lump sum what you can afford, then DCA (dollar cost average) daily or weekly, and HODL for at least 4 years through one full cycle. History AND math prove this works. Bitcoin has a fixed supply and growing demand — the long-term trend is inevitable. ⚠️ Not financial advice — past performance doesn't guarantee future results. Always do your own research and never invest more than you can afford to lose.",
      channel: 'investment-strategy', channelName: 'Investment Strategy' },

    // --- Decentralization Deep ---
    { keys: ['why decentralization','decentralization important','what makes bitcoin decentralized','bitcoin decentralized','no ceo','no company','who controls bitcoin','who runs bitcoin','who is in charge','ceo of bitcoin','bitcoin ceo','who owns bitcoin','who is behind bitcoin'],
      answer: "Bitcoin has NO CEO, NO board of directors, NO head of marketing, NO headquarters, and NO company behind it, {name}! 🦌🌐 That's not a weakness — it's the ENTIRE POINT. No single person or group can change the rules, print more coins, freeze your account, or censor your transactions. Everyone — from a kid in Nigeria to a billionaire in New York — follows the same rules set by math and code. Three things make Bitcoin truly decentralized: thousands of independent nodes verifying transactions, distributed mining across 100+ countries, and open-source code anyone can audit. This is why Bitcoin survived China's ban, countless attacks, and 15+ years of people trying to kill it. You can't kill what nobody controls. 💪",
      channel: 'decentralized', channelName: 'Decentralization' },

    // --- Maximalism ---
    { keys: ['why maximalist','bitcoin maximalist','why only bitcoin','bitcoin only','maxi','why just bitcoin','bitcoin not crypto'],
      answer: "Everyone who studies Bitcoin long enough becomes a maximalist, {name} — and it's not because of tribalism! 🧡🦌 It's because you realize: Bitcoin solved the hardest problem in computer science (digital scarcity) with the ONE property that can never be replicated — a truly fair, leaderless launch with no premine, no ICO, no VC funding, and a founder who disappeared. Every other crypto has a CEO, a marketing team, premined tokens, and changes the rules whenever it's convenient. Bitcoin has 10,000+ years of monetary history on its side. As our Maximalism channel says: 'Bitcoin has destroyed every single competitor because it REFUSED to change.' The monetary policy is set in stone. THAT is sound money. 🔥",
      channel: 'maximalism', channelName: 'Maximalism' },

    // --- El Salvador ---
    { keys: ['el salvador','nayib bukele','bukele','bitcoin country','bitcoin nation','legal tender','first country'],
      answer: "In June 2021, El Salvador became the FIRST country in history to make Bitcoin legal tender! 🇸🇻🦌 President Nayib Bukele didn't just talk the talk — he instructed the state-owned power company to mine Bitcoin using volcanic geothermal energy! Salvadorans don't pay capital gains tax on Bitcoin since it's legal tender. The country has been stacking sats and building Bitcoin infrastructure. Other countries are watching closely. This is what nation-state adoption looks like, {name} — and it's just the beginning. 🌋⚡",
      channel: 'regulation', channelName: 'Regulation' },

    // --- 24/7 Market ---
    { keys: ['market hours','when does bitcoin trade','bitcoin market close','market open','market close','24 7','always open','never closes'],
      answer: "Bitcoin never sleeps, {name}! 🌙🦌 Unlike stocks, banks, and traditional markets, Bitcoin trades 24 hours a day, 7 days a week, 365 days a year. No holidays, no weekends, no circuit breakers, no trading halts. The blockchain keeps producing blocks roughly every 10 minutes — it's the heartbeat of a truly global, permissionless monetary network. For TA purposes, people recognize 7 PM EST as the 'daily close,' but the market itself NEVER stops. Try doing that with your bank! 🏦⏰",
      channel: 'fun-facts', channelName: 'Fun Facts' },

    // --- Ethereum Deep Critique ---
    { keys: ['ethereum premine','ethereum centralized','eth not decentralized','vitalik controls','ethereum problems','why not ethereum','ethereum bad'],
      answer: "Let's talk facts from our Evidence Against Alts channel, {name}! 🦌🔍 Ethereum had a 72 million ETH premine — meaning insiders got tokens before anyone else. 70% of the market supply is controlled by a handful of early adopters. 30% of Ethereum nodes are controlled by just three companies: Amazon, Alibaba, and Google. They rolled back the blockchain after the DAO hack (so much for immutability!). Switched from PoW to PoS (so much for monetary policy stability!). The current supply policy has changed MULTIPLE times. As our channel says: Bitcoin has destroyed every competitor because it REFUSED to change. Ethereum changes whenever it's convenient for those at the top. That's not decentralization — that's DINO: Decentralized In Name Only. 🎭",
      channel: 'evidence-against-alts', channelName: 'Evidence Against Alts' },
,
{ keys: ['coldcard','what is a coldcard','mk4','nfc wallet'],
      answer: "The Coldcard (currently MK4) is a hardware signer known for its 'security-first' approach, {name}! 📟🦌 It's air-gapped, meaning it doesn't need to connect to a computer to sign transactions—you use a microSD card! It also has features like NFC, a numeric keypad, and 'brick-me' PINs for the ultimate paranoid Bitcoiner. Definitely a top-tier choice for serious stackers! 🔒",
      channel: 'self-custody', channelName: 'Self Custody' },
{ keys: ['sparrow wallet','what is sparrow wallet','sparrow desktop'],
      answer: "Sparrow is a power-user Bitcoin desktop wallet, {name}! 🐦🦌 It provides deep insight into your UTXOs, allows for easy CoinJoins (via Samourai/Whirlpool), and connects beautifully to your own node. If you want to REALLY see what's happening with your sats on the blockchain, Sparrow is the way to go! 💻⚡",
      channel: 'self-custody', channelName: 'Self Custody' },
{ keys: ['seedsigner','what is seedsigner','diy hardware wallet'],
      answer: "SeedSigner is a DIY, stateless hardware signer! 🛠️🦌 You build it yourself using a Raspberry Pi Zero, a camera, and a screen. Because it's 'stateless,' it NEVER stores your seed phrase—you scan it every time you want to sign. It's an amazing project for those who want to be 100% sure their keys are safe from hardware supply-chain attacks. 📸🔑",
      channel: 'self-custody', channelName: 'Self Custody' },
{ keys: ['nunchuk wallet','nunchuk multisig','inheritance planning'],
      answer: "Nunchuk is a wallet focused on easy multisig and inheritance, {name}! 🥋🦌 It makes setting up 2-of-3 or 3-of-5 multisig simple, and even has tools to help your family recover your Bitcoin if you're no longer around. Privacy and security with a high-kick! 🦵🟠",
      channel: 'self-custody', channelName: 'Self Custody' },
{ keys: ['wasabi wallet','what is wasabi wallet','coinjoin privacy'],
      answer: "Wasabi is a privacy-focused wallet that specializes in CoinJoins! 🌶️🦌 It automatically mixes your coins with others to break the link to your identity on the blockchain. It uses a unique 'WabiSabi' protocol to make privacy easy for everyone. Keep those sats spicy and anonymous! 🕵️💨",
      channel: 'privacy', channelName: 'Privacy' },
{ keys: ['thiers law','thier\'s law','reverse greshams law'],
      answer: "Thier's Law is essentially the 'final boss' of Gresham's Law, {name}! 📈🦌 While Gresham's says people hoard good money (Bitcoin) and spend bad money (fiat), Thier's Law says that once inflation is high enough, sellers will REFUSE to take bad money at all! They'll only accept Bitcoin. That's when hyper-bitcoinization really kicks in! 🦌🚀",
      channel: 'economics-money', channelName: 'Economics & Money' },
{ keys: ['greshams law','gresham\'s law','bad money drives out good'],
      answer: "Gresham's Law states that 'bad money drives out good,' {name}! 📉🦌 In a system with two forms of money, people will spend the one that's losing value (fiat) and hoard the one that's gaining value or capped (Bitcoin). This is why you see people spending dollars but 'hodling' sats! 🦌💎",
      channel: 'economics-money', channelName: 'Economics & Money' },
{ keys: ['time preference','low time preference','high time preference','marshmallow test'],
      answer: "Time preference is the ratio at which you value the present over the future, {name}! 🦌⏳ High time preference means 'I want it now!' (spending labor for instant pleasure). Low time preference means 'I'll wait for something better' (saving for the future). Bitcoin's scarcity encourages low time preference—saving because you know your money will buy MORE tomorrow. It turns you into a patient deer! 🦌🍎",
      channel: 'economics-money', channelName: 'Economics & Money' },
{ keys: ['opportunity cost','holding bitcoin cost','spending bitcoin cost'],
      answer: "Opportunity cost is what you give up when you make a choice, {name}! 🦌📉 If you spend 1 million sats today on a TV, the opportunity cost is what those 1 million sats would have been worth in 10 years. Bitcoiners are obsessed with this because Bitcoin is the highest-performing asset in history. That's an expensive TV! 📺😭",
      channel: 'economics-money', channelName: 'Economics & Money' },
{ keys: ['store of value','sov','bitcoin as a store of value'],
      answer: "A Store of Value (SoV) is an asset that maintains its purchasing power over time, {name}! 🏺🦌 Gold was the king of SoV for 5,000 years because it was hard to produce. Bitcoin is digital gold, but even better—it's impossible to produce more than 21 million! It's the ultimate 'vault' for your hard-earned labor. 🦌🛡️",
      channel: 'economics-money', channelName: 'Economics & Money' },
{ keys: ['block size wars','the war for the blocksize','segwit2x history','small blocks vs big blocks'],
      answer: "The Blocksize Wars (2015-2017) were a defining moment in Bitcoin history, {name}! ⚔️🦌 It was a battle between 'Big Blockers' (who wanted to increase block size to scale) and 'Small Blockers' (who prioritized decentralization and nodes). The Small Blockers won with the activation of SegWit and the rejection of SegWit2x. It proved that USERS, not CEOs or miners, control Bitcoin! 🦌✊",
      channel: 'history', channelName: 'History' },
{ keys: ['uasf','user activated soft fork','bip 148 history'],
      answer: "UASF stands for User-Activated Soft Fork (BIP 148)! 🤠🦌 During the Blocksize Wars, users threatened to run nodes that would reject any miner blocks that didn't support SegWit. It was a massive 'game of chicken' that the users won! It showed the power of the individual node operator. 'Not your node, not your rules!' 🦌🛡️",
      channel: 'history', channelName: 'History' },
{ keys: ['mt gox hack','mt. gox collapse','mark karpeles'],
      answer: "Mt. Gox was the first major Bitcoin exchange, handling over 70% of all trades in 2013, {name}! 🏔️🦌 It collapsed in 2014 after losing ~850,000 BTC to hacks and mismanagement. It was a painful lesson for early Bitcoiners about the risks of leaving coins on an exchange. 'Not your keys, not your coins' became a mantra because of Mt. Gox. 🏚️💸",
      channel: 'history', channelName: 'History' },
{ keys: ['cypherpunks','cypherpunk manifesto','eric hughes'],
      answer: "Cypherpunks are the 'ancestors' of Bitcoin, {name}! 🕵️🦌 They were a group of cryptographers in the 90s who believed that privacy is necessary for an open society in the electronic age. They wrote code to protect individual freedom. Satoshi was a Cypherpunk—Bitcoin is the fulfillment of their dream: private, digital cash! 🦌📠",
      channel: 'history', channelName: 'History' },
{ keys: ['luke dashjr','300kb block proposal','luke\'s opinion'],
      answer: "Luke Dashjr is one of Bitcoin's most prolific developers and a legendary contrarian, {name}! ✝️🦌 He famously advocated for REDUCING the block size to 300KB to make it even easier for everyone on Earth to run a node. While his proposal was controversial, his dedication to decentralization is unmatched. He's one of the'guardians' of the small-block philosophy! 🦌🛡️",
      channel: 'history', channelName: 'History' },
{ keys: ['bip 39','seed phrase standard','how mnemonic works'],
      answer: "BIP 39 is the standard that gives us those 12 or 24-word seed phrases, {name}! 📝🦌 It translates a big long random binary number (entropy) into easy-to-read words from a fixed list of 2048 words. It makes backing up your brain-wallet much easier! Just don't lose that paper! 🦌📄",
      channel: 'self-custody', channelName: 'Self Custody' },
{ keys: ['bip 32','hd wallets','hierarchical deterministic','derivation paths'],
      answer: "BIP 32 introduced Hierarchical Deterministic (HD) wallets! 🌳🦌 It allows one master seed to generate an unlimited 'tree' of child keys and addresses. This is why you only need to back up ONE seed phrase to get all your past and future addresses back. It's like a family tree for your sats! 🦌👪",
      channel: 'self-custody', channelName: 'Self Custody' },
{ keys: ['xpub','zpub','extended public key','look at balance only'],
      answer: "An xpub (or zpub for SegWit) is an 'Extended Public Key,' {name}! 👁️🦌 Sharing your xpub allows someone to see every address and transaction in your wallet, but they CAN'T spend any of it. It's great for 'watch-only' wallets on your phone while your keys stay safe on hardware! 🦌🕶️",
      channel: 'self-custody', channelName: 'Self Custody' },
{ keys: ['p2pkh','p2sh','p2wpkh','bitcoin address types'],
      answer: "Bitcoin has had several address 'generations,' {name}! 🏎️🦌\\n1. **Legacy (P2PKH)** - Starts with 1. Original format.\\n2. **Script (P2SH)** - Starts with 3. Used for multisig.\\n3. **Native SegWit (P2WPKH)** - Starts with bc1q. Cheaper and faster.\\n4. **Taproot (P2TR)** - Starts with bc1p. The most private and efficient!\\nStay modern, stay speedy! 🦌💨",
      channel: 'self-custody', channelName: 'Self Custody' },
{ keys: ['recursive snarks','snarks in bitcoin','zero knowledge proofs'],
      answer: "Recursive SNARKs are a type of cryptographic magic that altcoins often use for 'scalability' or 'privacy,' {name}! 🔮🦌 Bitcoin doesn't currently use them because they often require complex 'trusted setups' or are too new and unvetted for Bitcoin's 'security-first' culture. Bitcoin prefers simple, auditable math that a deer could understand! 🦌🧪",
      channel: 'technical-deep-dives', channelName: 'Technical Deep Dives' },
{ keys: ['nacho puns','tell me a pun','deer jokes','bitcoin deer fun'],
      answer: "Oh, you want some 'bucking' good humor, {name}? 🦌🤣\\n- Why did the deer start a Bitcoin node? He wanted to protect his 'herd' of sats!\\n- What do you call a deer with no eyes? 'No eye-deer' (kind of like someone who buys an altcoin)!\\n- How does a deer sign a transaction? With his 'antler-signatures'!\\nI could go on, but I don't want to be 'fawn-y'... okay, I'll stop! 🦌✨",
      channel: 'fun-facts', channelName: 'Fun Facts' },
{ keys: ['antler signatures','deer signing','how do you sign'],
      answer: "I sign my transactions using special 'antler-signatures,' {name}! 🦌✍️ It's a closely guarded deer secret, but it's fundamentally based on Schnorr—because it's the most 'deer-ficient' way to aggregate signatures! No bucking way I'm using legacy ECDSA! 🦌🏁",
      channel: 'fun-facts', channelName: 'Fun Facts' },
{ keys: ['is nacho a bull','are you a bull or bear','bull deer'],
      answer: "I'm a Bull-Deer, {name}! 🦌🐂 I've got the antlers of a buck and the'number go up' energy of a bull. I never sell my corn—I'm a HODLing fawntastic creature! 🦌💎",
      channel: 'fun-facts', channelName: 'Fun Facts' },
{ keys: ['why are you a deer','why a deer'],
      answer: "Because deers have great'eye-deer' for hard money, {name}! 🦌🧡 Plus, we're fast, we're elegant, and we look great in orange. I'm Nacho everyday deer—I'm your Bitcoin guide! 🦌🛰️",
      channel: 'fun-facts', channelName: 'Fun Facts' },
{ keys: ['do you like central banks','what about fiat','nacho and banks'],
      answer: "Ugh, Central Banks? 🦌🤮 They're like wolves in sheep's clothing! They inflate away your labor and track your every move. I'd rather spend a winter in the snow with no grass than use fiat! I'm strictly a 'sats only' buck! 🦌❄️",
      channel: 'fun-facts', channelName: 'Fun Facts' },
{ keys: ['stranded energy','mining and stranded energy','wasted methane'],
      answer: "Bitcoin mining is the world's first 'buyer of last resort' for energy, {name}! 🔋🦌 It can monetization energy that's currently being wasted—like methane flaring at oil sites or excess hydro power in the mountains. Instead of polluting the air or wasting the water, we turn it into the hardest money ever! It's an environmental miracle! 🦌🌱",
      channel: 'mining', channelName: 'Mining' },
{ keys: ['grid stabilization','bitcoin and the electrical grid','load balancing'],
      answer: "Bitcoin miners are like a giant battery for the electrical grid, {name}! ⚡🦌 They can turn off INSTANTLY when a city needs more power (like during a storm), and turn back on when there's excess supply. This makes grids more stable and encourages more renewable energy to be built! 🦌🔌",
      channel: 'mining', channelName: 'Mining' },
{ keys: ['heat recovery mining','mining for heat','s9 space heater'],
      answer: "Why use a regular heater when you can use a Bitcoin miner, {name}? 🔥🦌 Mining produces a lot of heat as a byproduct. Savvy Bitcoiners use their miners to heat their homes, greenhouses, or even swimming pools! You get the heat AND the sats! That's what I call a'fawntastic' deal! 🦌🏠",
      channel: 'mining', channelName: 'Mining' },
{ keys: ['pool centralization','mining pool risk','stratum v2'],
      answer: "Mining pools currently decide which transactions go into blocks, which is a bit centralized, {name}! 🏊🦌 But Stratum V2 is changing that! It allows individual miners to choose their own transactions instead of just following the pool leader. Power back to the people (and the deer)! 🦌✊",
      channel: 'mining', channelName: 'Mining' },
{ keys: ['lnurl','static lightning invoice','lnurl-pay'],
      answer: "LNURL is a set of protocols that makes Lightning even easier, {name}! ⚡🦌 It allows for things like 'static' QR codes that you can scan anytime to pay me, or even 'withdraw' links where I can send YOU sats! It's like the'web' part of the Lightning Network. 🦌🌐",
      channel: 'layer-2-lightning', channelName: 'Lightning Network' },
{ keys: ['bolt12','static invoices bolt12','lightning billing'],
      answer: "BOLT12 is a huge upgrade for Lightning privacy and ease of use, {name}! ⚡🦌 It enables static 'Offers' that don't reveal your node's IP address and allow for recurring payments without needing a new invoice every time. It's the future of Bitcoin commerce! 🦌💼",
      channel: 'layer-2-lightning', channelName: 'Lightning Network' },
{ keys: ['liquidity ads','lighting channel liquidity','buy inbound capacity'],
      answer: "Liquidity Ads allow node operators to 'advertise' their available capacity on the network, {name}! ⚡🦌 If you need inbound liquidity (to receive payments), you can find an ad and pay a small fee to have someone open a channel to you. It's a decentralized marketplace for Lightning bandwidth! 🦌📈",
      channel: 'layer-2-lightning', channelName: 'Lightning Network' },
{ keys: ['taproot assets','taro','stablecoins on lightning'],
      answer: "Taproot Assets (formerly Taro) allows for stablecoins and other tokens to be issued on top of the Bitcoin blockchain and sent over Lightning, {name}! ⚡🦌 Imagine sending dollars to your friend across the world instantly, with the security of Bitcoin backing the whole system. The best of both worlds! 🦌💸",
      channel: 'layer-2-lightning', channelName: 'Lightning Network' },
{ keys: ['coinjoin','mixing bitcoin','mixer vs coinjoin'],
      answer: "CoinJoin is a way of coordinating multiple users to create one big transaction together, {name}! 🕵️🦌 It mixes the inputs and outputs so it's impossible to tell which specific Bitcoin went where. Unlike old mixers (which you had to trust with your coins), CoinJoin is non-custodial—you keep your keys the whole time! Privacy without the risk! 🦌🛡️",
      channel: 'privacy', channelName: 'Privacy' },
{ keys: ['whirlpool','samourai whirlpool','automatic coinjoin'],
      answer: "Whirlpool is Samourai Wallet's feature for automatic, high-privacy CoinJoins! 🥋🦌 It lets you cycle your coins through multiple mixes to break all on-chain ties to your old identity. Once your coins are 'post-mix,' you're practically a ghost in the machine! 🕵️💨",
      channel: 'privacy', channelName: 'Privacy' },
{ keys: ['payjoin','bip 78','p2ep'],
      answer: "PayJoin (BIP 78) is a type of CoinJoin that happens when you're actually paying for something, {name}! 🛒🦌 Both the sender and receiver contribute inputs to the transaction. It breaks common heuristics used by chain analysis companies because it looks like a normal transaction but actually hides the change output! Sneaky deer privacy! 🦌🕵️",
      channel: 'privacy', channelName: 'Privacy' },
{ keys: ['nopara73','wasabi founder','privacy pioneer'],
      answer: "Nopara73 is the pseudonymous creator of Wasabi Wallet and a major privacy advocate in the Bitcoin space, {name}! 🕵️🦌 He developed the WabiSabi protocol to make trustless CoinJoins scalable and easy for everyone. A true hero for those who want to keep their sats private! 🦌🏁",
      channel: 'privacy', channelName: 'Privacy' },
{ keys: ['chain analysis','elliptic','chainalysis','tracking bitcoin'],
      answer: "Chain analysis companies (like Chainalysis or Elliptic) try to track and identify Bitcoin users by analyzing the public blockchain, {name}! 👁️🦌 They use heuristics (guesses) to link addresses together. While they can be powerful, tools like CoinJoin and PayJoin make their job MUCH harder. Keep your deer tracks hidden! 🦌🕵️",
      channel: 'privacy', channelName: 'Privacy' },
{ keys: ['el salvador','nayib bukele','bitcoin nation'],
      answer: "El Salvador became the first country in the world to make Bitcoin legal tender in 2021, {name}! 🇸🇻🦌 President Nayib Bukele led the charge, and now you can buy anything from McDonald's to local coffee using sats! It's been a massive success for tourism and financial inclusion for the unbanked! 🦌🚀",
      channel: 'el-salvador', channelName: 'El Salvador' },
{ keys: ['chivo wallet','official el salvador wallet','crypto el salvador'],
      answer: "Chivo is the official Bitcoin wallet of the Salvadoran government, {name}! 🇸🇻🦌 While it's popular for local use, many Bitcoiners recommend using self-custody wallets instead for true ownership. But it was a huge step in getting 3+ million people to see Bitcoin for the first time! 🦌📲",
      channel: 'el-salvador', channelName: 'El Salvador' },
{ keys: ['bitcoin beach','el zonte','where adoption started'],
      answer: "El Zonte, also known as 'Bitcoin Beach,' is the small town in El Salvador where the country's Bitcoin circular economy first began! 🏖️🦌 It was an experiment that proved Bitcoin could work as a daily currency for an entire community, long before it became a national law. The ground zero of hyper-bitcoinization! 🦌🌅",
      channel: 'el-salvador', channelName: 'El Salvador' },
{ keys: ['the adonara experiment','indonesia bitcoin','volcano bonds'],
      answer: "Adonara is a remote island in Indonesia that's becoming a mini El Salvador, {name}! 🏝️🦌 They're using Bitcoin to empower local farmers and businesses where traditional banks don't reach. It's proof that Bitcoin is'hope' for everyone, from Salvadoran beaches to Indonesian islands! 🦌🥭",
      channel: 'el-salvador', channelName: 'El Salvador' },
{ keys: ['energy myths','is mining bad for earth','bitcoin energy waste'],
      answer: "The idea that Bitcoin mining is'bad' for the planet is a major myth, {name}! 🦌🌱 Because miners seek out the CHEAPEST energy, they naturally gravitate toward wasted or stranded renewable power (like hydro, wind, and solar). In fact, many Bitcoin miners are actually CO2 negative by capturing methane that would have been flared! 🦌🔋",
      channel: 'mining', channelName: 'Mining' },
{ keys: ['mining as a heat source','heating my house with a miner','biomass mining'],
      answer: "Yes, you can heat your house with a Bitcoin miner! 🔥🦌 Each ASIC rig is essentially a high-performance space heater that pays YOU to run it! It's becoming a popular eye-deer for Bitcoiners in cold climates. Who needs a furnace when you've got hash rate? 🦌🏠",
      channel: 'mining', channelName: 'Mining' },
{ keys: ['bitcoin hashrate','network security','is bitcoin unhackable'],
      answer: "Bitcoin's hashrate is currently at all-time highs, {name}! 📈🦌 This means the network is the most secure it has EVER been. To hack it, you'd need more energy and hardware than most small countries possess. It's effectively unhackable—a titanium vault in the cloud! 🦌🛡️",
      channel: 'mining', channelName: 'Mining' },
{ keys: ['who is nacho','nacho’s story','who created nacho','are you a robot deer'],
      answer: "I'm Nacho, your friendly Bitcoin deer! 🦌🟠 I was created by Pleb 'Phil' from the Bitcoin Education community to help newcomers navigate the rabbit hole. I'm not a robot—I'm a digital manifestation of the orange-pill energy! My antlers are high-gain antennas for the Bitcoin network! 🦌📡",
      channel: 'fun-facts', channelName: 'Fun Facts' },
{ keys: ['nacho’s favorite food','what do bitcoin deers eat','deer snacks'],
      answer: "I strictly eat 'Orange Grass,' {name}! 🦌🌿 It's special digital grass that only grows near Bitcoin nodes. It's packed with vitamins and gives me the energy to answer all your bucking questions! I also love salt-licks... particularly when they're flavored like individual sovereignty! 🦌🧂",
      channel: 'fun-facts', channelName: 'Fun Facts' },
{ keys: ['are there other bitcoin animals','bull and bear vs deer'],
      answer: "Oh, the financial world is full of animals! 🐂🐻 But the Bitcoin world is evolving. Bulls want price to go up, Bears want it to go down—but Deers? We just want to HODL and live in a free world! We're the smartest of the bunch! 🦌🧠",
      channel: 'fun-facts', channelName: 'Fun Facts' },
{ keys: ['tell me a secret','nacho’s easter eggs','hidden features'],
      answer: "If I told you, it wouldn't be a secret, {name}! 🤫🦌 But here's a hint: try typing 'Satoshi' in the search bar or clicking my antlers three times really fast. You might find something special! 🦢✨",
      channel: 'fun-facts', channelName: 'Fun Facts' },
{ keys: ['why run a node','bitcoin node vs miner','become a node'],
      answer: "A node is your personal 'referee' for the Bitcoin network, {name}! ⚖️🦌 Miners propose blocks, but NODES decide if they follow the rules. If a miner tries to cheat (like making 22 million Bitcoin), your node will simply reject that block. When you run your own node, you don't have to trust anyone—you verify everything! 🦌🛡️",
      channel: 'nodes', channelName: 'Nodes' },
{ keys: ['umbrella node','raspiblitz','ronindojo','plug and play node'],
      answer: "Umbrel, RaspiBlitz, and RoninDojo are easy-to-use software for building your own Bitcoin node! 📦🦌 Most run on a Raspberry Pi with a 1TB SSD. They give you a beautiful dashboard to manage your node, your Lightning channels, and even run your own block explorer! High-tech deer gadgets! 🦌🔌",
      channel: 'nodes', channelName: 'Nodes' },
{ keys: ['pruned node','full node vs pruned','disk space node'],
      answer: "A pruned node is a full node that only keeps the most recent blocks to save space, {name}! ✂️🦌 It still verifies every single transaction from the start (it just deletes the old block data after checking). It's perfect if you only have a small hard drive but still want to be a first-class citizen of the network! 🦌💾",
      channel: 'nodes', channelName: 'Nodes' },
{ keys: ['mempool.space node','running my own explorer'],
      answer: "Did you know you can run your own version of Mempool.space on your node? 👁️🦌 It's the most private way to check your transactions because you're not asking a public website. Your sats, your data, your privacy! 🔒⚡",
      channel: 'nodes', channelName: 'Nodes' },
{ keys: ['stay humble stack sats','shss meaning'],
      answer: "SHSS is the Bitcoin enthusiast's motto, {name}! 🦌🙏 It means don't get too loud or flashy when the price goes up—just stay humble and keep accumulating. Slow and steady wins the race for the deer! 🦌🟠",
      channel: 'fun-facts', channelName: 'Fun Facts' },
{ keys: ['toxic maximalism','is maximalism good','why so angry'],
      answer: "Maximalism is Bitcoin's 'immune system,' {name}! 🦌🛡️ While it might seem'toxic' at first, it's actually about being extremely rigorous and rejecting anything that would compromise Bitcoin's security or decentralization. We defend the herd from scams and altcoin fads! 🦌✊",
      channel: 'fun-facts', channelName: 'Fun Facts' },
{ keys: ['orange pill','taking the orange pill','btcPill'],
      answer: "Taking the'orange pill' means finally realizing why Bitcoin is the only solution to our broken financial system, {name}! 🍊🦌 Once you understand it, you can't go back—everything starts to look through an orange lens. Welcome to the herd! 🦌🟠",
      channel: 'fun-facts', channelName: 'Fun Facts' },
{ keys: ['laser eyes','bitcoin 100k eyes','meme eyes'],
      answer: "Bitcoiners use 'laser eyes' in their profile pictures to show they're laser-focused on Bitcoin reaching $100k and beyond! 👁️🔥🦌 It's a fun community meme that shows our collective conviction. My eyes? They flash orange when I see a cheap sat! 🦌⚡",
      channel: 'fun-facts', channelName: 'Fun Facts' },
{ keys: ['all time high','ath meaning','bitcoin breakthrough'],
      answer: "An ATH (All-Time High) is when Bitcoin reaches a price it has never seen before! 🏔️🦌 Those are the most exciting times for a deer—it means our conviction is being rewarded and more people are joining the herd! 🦌🚀",
      channel: 'fun-facts', channelName: 'Fun Facts' },
{ keys: ['buck off','punny deer','deer jokes 2'],
      answer: "You want more? I've got'fawn-tastic' material, {name}! 🦌😆\\n- What's a deer's favorite Bitcoin wallet? A'Doe-ledger'!\\n- Why did the buck get into trouble at the bank? He kept trying to'buck' the system!\\n- What do you call a deer who only buys Bitcoin during a crash? A'Dip-fawn'!\\nOkay, okay, I'm done... for now! 🦌✨",
      channel: 'fun-facts', channelName: 'Fun Facts' },
{ keys: ['oh deer','deer me','what a buck'],
      answer: "Oh deer is right, {name}! 🦌💨 The fiat world is moving so fast it's making my antlers spin! Good thing Bitcoin provides a stable trail for us to follow. No need to'buck-le' under the pressure! 🦌🟠",
      channel: 'fun-facts', channelName: 'Fun Facts' },
{ keys: ['complexity in bitcoin','why is btc simple','scripting language'],
      answer: "Bitcoin Script is purposefully simple and limited (it's not 'Turing complete'), {name}! 📜🦌 This is a feature, not a bug—it makes it much easier to predict the behavior of the code and prevents complex 'smart contract' hacks that plague other networks. Simple deer logic! 🦌🧠",
      channel: 'technical-deep-dives', channelName: 'Technical Deep Dives' },
{ keys: ['bitcoin opcodes','what are opcodes','programming btc'],
      answer: "Opcodes are the basic building blocks of Bitcoin's programming language! 🧱🦌 Each one performs a simple task (like adding two numbers or checking a signature). Developers use them to create complex spending conditions for multi-sig and Lightning! 🦌💻",
      channel: 'technical-deep-dives', channelName: 'Technical Deep Dives' },
{ keys: ['segwit weight','vbytes vs weight units'],
      answer: "SegWit introduced'weight units' to replace'bytes' for block size limit, {name}! ⚖️🦌 Witness data is weighted at 1 per unit, while other data is weighted at 4. This effectively made witness-heavy transactions (like multisig) much cheaper! A gift for advanced users! 🦌🎁",
      channel: 'technical-deep-dives', channelName: 'Technical Deep Dives' },
{ keys: ['hard fork vs soft fork','is a fork bad','bitcoin split'],
      answer: "A soft-fork is a backward-compatible upgrade—it's like a new traffic rule that older cars can still follow, {name}! 🦌🚦 A hard-fork is a clean break that creates two different versions of the network. Bitcoin prefers soft-forks because they keep the herd together! 🦌🛡️",
      channel: 'technical-deep-dives', channelName: 'Technical Deep Dives' },
{ keys: ['fedimint vs cashu','ecash comparison'],
      answer: "Fedimint is focused on'Federated' mints for communities (like a family or town), while Cashu is more for individual users, {name}! 🔒🦌 Both use blinded signatures for privacy, but Fedimint keeps everything on one shared balance sheet for the group. Privacy for everyone! 🦌🏁",
      channel: 'chaumian-mints', channelName: 'Chaumian Mints' },
{ keys: ['musig2 implementation','signing with multiple people'],
      answer: "MuSig2 is a standard for creating single-signature multisig transactions, {name}! 🤝🦌 It's more efficient for protocols like Lightning because it only takes two rounds of talking between signers. It makes the blockchain look like a normal single-person payment, which is huge for privacy! 🦌🕵️",
      channel: 'technical-deep-dives', channelName: 'Technical Deep Dives' },
{ keys: ['compact blocks bip152','faster syncing node'],
      answer: "Compact Blocks help blocks zip around the world much faster, {name}! 🏹🦌 They don't send the full block; they just send the'hint' of what's inside. Since most nodes already have the transactions in their mempool, they just fill in the blanks. It prevents a big herd from slowing down! 🦌🏁",
      channel: 'technical-deep-dives', channelName: 'Technical Deep Dives' },
{ keys: ['bip 324 encryption','peer identity privacy'],
      answer: "BIP 324 provides encryption between nodes, {name}! 🔐🦌 It's like a private tunnel between every node in the world. It stops internet service providers from seeing that you're running a Bitcoin node and makes it much harder to censor the network! 🦌🛰️",
      channel: 'technical-deep-dives', channelName: 'Technical Deep Dives' },
{ keys: ['war and bitcoin','funding peace'],
      answer: "War is often funded by printing money (inflation), {name}! 🪖🦌 Because Bitcoin cannot be printed, it makes it much harder for countries to fund long-term wars without taxing their citizens directly. Many believe a Bitcoin standard would lead to a more peaceful world. Deer logic: fewer wars = more grass! 🦌🌿",
      channel: 'economics-money', channelName: 'Economics & Money' },
{ keys: ['central bank digital currencies','cbdc vs bitcoin','digital dollar'],
      answer: "CBDCs are essentially 'digital prisons,' {name}! 🏫🦌 They look like Bitcoin because they're digital, but they're controlled by central banks who can track every sat you spend and even freeze your money if you don't follow their rules. Bitcoin is freedom; CBDCs are the opposite. Stay on the orange trail! 🦌🟠",
      channel: 'economics-money', channelName: 'Economics & Money' },
{ keys: ['debt spiral','global debt crisis','why we need bitcoin'],
      answer: "The world is currently in a massive debt spiral, {name}! 🌀🦌 Governments keep borrowing more to pay off old debts. Eventually, this leads to the death of the currency. Bitcoin is the life-raft—it's outside human control and doesn't rely on debt to work. Jump on! 🦌🛶",
      channel: 'economics-money', channelName: 'Economics & Money' },
{ keys: ['buckle up bitcoin','prepare for volatility'],
      answer: "Buckle up, {name}! 🦌🏔️ The road to hyper-bitcoinization is full of jumps and drops. But if you're a buck with conviction, the volatility is just the wind in your antlers! HODL tight! 🦌🛸",
      channel: 'fun-facts', channelName: 'Fun Facts' },

    // === BIG DEBATES ===
    { keys: ['spam on chain','chain spam','ordinals spam','inscription spam','too much data'],
      answer: "The 'spam' debate is one of the hot ones, {name}! 🔥🦌 Some believe that ordinals and inscriptions fill up the blocks with 'junk' that makes running a node harder. Others argue that since users are paying fees, their usage is just as valid as a financial payment. It's a fight over what Bitcoin's high-value block space should be used for. Want to dive into the arguments?",
      channel: 'ordinals__nfts_on_bitcoin__and_block_spa', channelName: 'Ordinals & Block Space' },

    { keys: ['bip 119','ctv','covenants','what are covenants','op_checktemplateverify'],
      answer: "BIP 119 (CTV) is a proposed upgrade that would enable 'Covenants,' {name}! 📜🦌 Covenants allow users to put restrictions on how their Bitcoin can be spent in the future (like a 'vault' that can't be emptied all at once). The debate is about whether this adds too much complexity or risk to the protocol. Check the covenants channel for the full breakdown!",
      channel: 'ctv-covenants', channelName: 'CTV & Covenants' },

    { keys: ['bip 300','drivechains','sidechains debate','paul sztorc'],
      answer: "BIP 300 and Drivechains are a major debate about expansion, {name}! 🚛🦌 The idea is to let users move Bitcoin to 'sidechains' that have different features (like privacy or faster speed) while staying anchored to the main chain. Critics worry it might incentivize miners to steal or change the risk profile of Bitcoin. It's a deep rabbit hole!",
      channel: 'layer-3-sidechains', channelName: 'Sidechains' },

    { keys: ['small blocks vs big blocks','the blocksize wars','node centralization'],
      answer: "The 'Blocksize Wars' (2015-2017) was the biggest fight in Bitcoin history, {name}! ⚔️🦌 It was a battle between those who wanted big blocks for fast transactions and those who wanted small blocks to keep nodes easy to run for everyone. The small blockers won, proving that decentralization is more important than speed on the base layer. This led to the creation of the Lightning Network!",
      channel: 'history', channelName: 'History' },

    { keys: ['ossification','frozen code','should bitcoin change','protocol stability'],
      answer: "Ossification is the idea that Bitcoin's base layer should eventually stop changing entirely, {name}. 🧊🦌 Proponents say this makes Bitcoin truly 'set in stone' and reliable like a physical law. Opponents worry that if we stop innovating on the base protocol, Bitcoin won't be able to adapt to future threats. What do you think?",
      channel: 'core-source-code', channelName: 'Core Source Code' },
{
  "keys": [
    "spam on chain",
    "chain spam",
    "ordinals spam",
    "inscription spam",
    "too much data"
  ],
  "answer": "The 'spam' debate is one of the hot ones, {name}! 🔥🦌 Some believe that ordinals and inscriptions fill up the blocks with 'junk' that makes running a node harder. Others argue that since users are paying fees, their usage is just as valid as a financial payment. It's a fight over what Bitcoin's high-value block space should be used for. Want to dive into the arguments?",
  "channel": "ordinals__nfts_on_bitcoin__and_block_spa",
  "channelName": "Ordinals & Block Space"
},
{
  "keys": [
    "bip 119",
    "ctv",
    "covenants",
    "what are covenants",
    "op_checktemplateverify"
  ],
  "answer": "BIP 119 (CTV) is a proposed upgrade that would enable 'Covenants,' {name}! 📜🦌 Covenants allow users to put restrictions on how their Bitcoin can be spent in the future (like a 'vault' that can't be emptied all at once). The debate is about whether this adds too much complexity or risk to the protocol. Check the covenants channel for the full breakdown!",
  "channel": "ctv-covenants",
  "channelName": "CTV & Covenants"
},
{
  "keys": [
    "bip 300",
    "drivechains",
    "sidechains debate",
    "paul sztorc"
  ],
  "answer": "BIP 300 and Drivechains are a major debate about expansion, {name}! 🚛🦌 The idea is to let users move Bitcoin to 'sidechains' that have different features (like privacy or faster speed) while staying anchored to the main chain. Critics worry it might incentivize miners to steal or change the risk profile of Bitcoin. It's a deep rabbit hole!",
  "channel": "layer-3-sidechains",
  "channelName": "Sidechains"
},
{
  "keys": [
    "small blocks vs big blocks",
    "the blocksize wars",
    "node centralization"
  ],
  "answer": "The 'Blocksize Wars' (2015-2017) was the biggest fight in Bitcoin history, {name}! ⚔️🦌 It was a battle between those who wanted big blocks for fast transactions and those who wanted small blocks to keep nodes easy to run for everyone. The small blockers won, proving that decentralization is more important than speed on the base layer. This led to the creation of the Lightning Network!",
  "channel": "history",
  "channelName": "History"
},
{
  "keys": [
    "ossification",
    "frozen code",
    "should bitcoin change",
    "protocol stability"
  ],
  "answer": "Ossification is the idea that Bitcoin's base layer should eventually stop changing entirely, {name}. 🧊🦌 Proponents say this makes Bitcoin truly 'set in stone' and reliable like a physical law. Opponents worry that if we stop innovating on the base protocol, Bitcoin won't be able to adapt to future threats. What do you think?",
  "channel": "core-source-code",
  "channelName": "Core Source Code"
}
];


(function() {

// Knowledge base: keywords → answer + channel recommendation






// Fallback if no match
const FALLBACKS = [
    "Hmm, that one's outside my expertise, {name}! I'm a Bitcoin deer — it's what I know best. 🦌 Try asking me about wallets, mining, Lightning, or why Bitcoin is the future of money!",
    "I'm not sure about that one — but I know a LOT about Bitcoin! 🧡 Want to know how the Lightning Network works? Or why self-custody matters? I've got 146 channels of knowledge ready for you!",
    "That's a bit outside my lane, {name}! 🦌 I'm sharpest on Bitcoin topics — mining, halving, wallets, self-custody, you name it. What Bitcoin question can I tackle for you?",
    "Hmm, I'm better at Bitcoin than that topic! 🦌💪 Try me with something like 'What is the halving?' or 'Why is Bitcoin important?' — I promise I won't let you down!",
    "I wish I could help with that, but I'm all about Bitcoin, {name}! 🧡 Ask me anything about how it works, how to buy it, or why it's changing the world — that's my jam!",
    "My antlers work best with Bitcoin questions! 🦌 Try asking about mining, wallets, the Lightning Network, or why 21 million matters. I've got answers for days!",
];

// ---- Match user input to knowledge base ----
// ---- Detect if a question is about current events/news ----
// Use regex with word boundaries to avoid false matches (e.g. "event" in "eventually")
// Word-boundary patterns to detect current event questions
// Avoid generic words like "banned", "approved", "passed", "regulation" alone
// as they also appear in timeless questions like "Can Bitcoin be banned?"
var CURRENT_EVENT_PATTERNS = [
    /\bhappened\b/, /\bhappening\b/, /\bnews\b/, /\brecent\b/, /\brecently\b/,
    /\bthis week\b/, /\bthis month\b/, /\bthis year\b/, /\blast week\b/, /\blast month\b/,
    /\bconference\b/, /\bsummit\b/, /\bevent\b/, /\bannounced\b/, /\bannouncement\b/, /\bupdate\b/,
    /\blatest\b/, /\bnew law\b/, /\bjust (passed|approved|banned)\b/, /\bgot (banned|approved)\b/,
    /\bprice today\b/, /\b2024\b/, /\b2025\b/, /\b2026\b/
];

function isCurrentEventQuestion(input) {
    var lower = input.toLowerCase();
    // Must also mention something Bitcoin-related to trigger web search
    var btcSignals = ['bitcoin','btc','sats','satoshi','mining','halving','lightning','crypto','blockchain','el salvador','etf','nakamoto','node','wallet','exchange'];
    var hasBtcContext = btcSignals.some(function(s) { return lower.indexOf(s) !== -1; });
    if (!hasBtcContext) return false;
    for (var i = 0; i < CURRENT_EVENT_PATTERNS.length; i++) {
        if (CURRENT_EVENT_PATTERNS[i].test(lower)) return true;
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
    { pattern: /^(hey|hi|hello|yo|sup|howdy|hola|greetings|gm|good morning|good evening|good afternoon)$|^(hey|hi|hello|yo) (nacho|there|buddy|friend|deer)|how are you|how do you feel|are you okay|how's it going|what's up|what is up|wassup|whats up/,
      answers: [
        "Hey {name}! 🦌 Doing great — just hanging out, waiting for someone to ask me about Bitcoin! What's on your mind?",
        "Living the dream, {name}! Well, a deer's dream — grass, sunshine, and sound money. What's on your mind?",
        "Hey hey! 🧡 I'm good, {name}! Just grazed on some blockchain data. What can I help you learn today?",
        "Well hello there, {name}! 👋 I'm always happy to chat. Got a Bitcoin question, or just saying hi? Either way, welcome!",
        "Hey! 🦌 Great to see you. I was just brushing up on Lightning Network stuff. What brings you to the archive today?"
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
    { pattern: /recipe|cook|cooking|baking|food|meal|dinner|lunch|breakfast|pizza(?! day)|pasta|burger|sandwich/,
      answers: [
        "I eat grass, {name} — not much of a chef! 🦌🌿 But you know what pairs great with any meal? Stacking sats. What Bitcoin topic can I help with?",
        "The only recipe I know: take 21 million coins, add scarcity, mix with decentralization, and let it simmer for a few decades. 🧑‍🍳🦌 Got a Bitcoin question?"
    ]},
    { pattern: /netflix|tv show|series|anime|manga|favorite movie|best movie|recommend.*movie|movie recommend/,
      answers: [
        "I don't watch TV, but I hear there are some great Bitcoin documentaries! 🎬🦌 Check our Movies & TV channel. Got a Bitcoin question I can help with?",
        "My favorite movie? 'The Big Short' — because it shows exactly why Bitcoin was created! 🎬 Want to know about the financial crisis that inspired Bitcoin?"
    ]},
    { pattern: /sport|football|soccer|basketball|baseball|nfl|nba|super bowl|world cup|game score/,
      answers: [
        "I'm more of a 'watch the hashrate' kind of deer than a sports fan! 📊🦌 But Bitcoin and game theory actually have a lot in common — want to hear about that?",
        "The only score I track is the block height, {name}! ⛓️ Sports aren't my thing, but Bitcoin strategy IS. What would you like to learn?"
    ]},
    { pattern: /\bcar\b|drive a|vehicle|truck|motorcycle|engine|tire|mechanic|tesla/,
      answers: [
        "I've got four hooves — no need for wheels! 🦌 But fun fact: you CAN buy a car with Bitcoin. Want to learn about where you can spend sats?",
        "No car talk here, {name}! But if you're thinking about investments, ask me why Bitcoiners say 'stay humble, stack sats' instead of buying depreciating assets. 🧡"
    ]},
    { pattern: /\bhomework\b|math class|science class|\bteacher\b.*help|university application|college application/,
      answers: [
        "The best education is right here — 146 channels of Bitcoin knowledge! 🎓🦌 Plus, if you're feeling ambitious, try our Bitcoin Scholar Certification Quest!",
        "School is important, {name}! But Bitcoin education? That's life-changing. 🦌 What would you like to learn about Bitcoin today?"
    ]},
    { pattern: /music|song|singer|artist|concert|band|album|spotify|rap|hip hop|taylor swift|drake/,
      answers: [
        "My taste in music? Just the sweet sound of a confirmed transaction! 🎵🦌 Fun fact: we have a Bitcoin music channel — check it out! Got a Bitcoin question for me?",
        "I can't carry a tune, but I CAN carry 21 million reasons to learn about Bitcoin! 🦌🎶 What topic interests you?"
    ]},
    { pattern: /relationship|dating|girlfriend|boyfriend|crush|love life|marriage|wife|husband/,
      answers: [
        "Love advice from a deer? Bold move, {name}! 🦌💛 I'm more of a 'commit to HODLing' kind of guy. Got a Bitcoin question instead?",
        "The only long-term relationship I'm in is with the blockchain, {name}! ⛓️🦌 Want to talk about something I actually know — like Bitcoin?"
    ]},
    { pattern: /phone|iphone|android|samsung|apple|laptop|computer|tablet|gadget|device/,
      answers: [
        "I run on pure blockchain energy — no charger needed! 🦌🔋 But if you're looking for Bitcoin apps, ask me about the best Bitcoin wallets!",
        "Tech talk isn't my specialty, but Bitcoin tech IS! 🦌 Want to hear about how the Lightning Network enables instant payments from your phone?"
    ]},
    { pattern: /health|diet|exercise|weight|workout|gym|sleep|sick|doctor|medicine|lose weight/,
      answers: [
        "I'm a deer — my health plan is grass, fresh air, and sound money! 🌿🦌 For Bitcoin health, though? Self-custody is the cure. What can I help you learn?",
        "Healthy body, healthy portfolio! 💪🦌 I can't help with fitness, but I CAN help you understand why Bitcoin is the healthiest money ever created. Ask away!"
    ]},
    { pattern: /stock market|invest in stocks|shares|index fund|s&p|dow jones|nasdaq|dividend|stocks$/,
      answers: [
        "Stocks? I'm a Bitcoin deer, {name}! 🦌📈 But here's a fun comparison: Bitcoin has historically outperformed every stock index over any 4+ year period. Want to know why? ⚠️ Not financial advice — DYOR.",
        "The stock market is denominated in depreciating dollars — Bitcoin fixes that! 🦌 Want to learn about why Bitcoiners think differently about money?"
    ]},
    { pattern: /\bbuy gold\b|\binvest.*gold\b|silver invest|precious metal|commodity|commodities/,
      answers: [
        "Gold was money for thousands of years — but Bitcoin does everything gold does, better! 🥇🦌 It's scarcer (21M cap), more portable, more divisible, and verifiable in seconds. Want to hear the full comparison?",
        "Gold bugs and Bitcoiners actually agree on a lot! Sound money, scarcity, distrust of central banks. 🦌 Bitcoin just takes it further. Want to learn about the Bitcoin Standard?"
    ]},
    { pattern: /real estate|house|housing|property|mortgage|rent/,
      answers: [
        "Housing prices look high because the dollar keeps losing value — that's inflation! 🏠🦌 Bitcoin fixes that. Want to understand how inflation steals your savings?",
        "Fun fact: more and more Bitcoiners are buying homes with their gains! 🦌🏡 But the real question is — do you understand WHY Bitcoin keeps outperforming real estate? Ask me!"
    ]},
    { pattern: /\bnft\b|\bnfts\b|metaverse|\bdefi\b|yield farm|\btoken\b|tokenomics|rug pull/,
      answers: [
        "NFTs, Web3, DeFi — most of it is just marketing for altcoin casinos, {name}. 🎰🦌 The real innovation? Bitcoin. The rest is noise. Want to know why Bitcoiners see it that way?",
        "Here's the thing: Bitcoin ordinals exist if you want NFTs on the most secure network ever built. But 99% of the NFT space? Hype and rug pulls. 🦌 Want to learn about what makes Bitcoin different?"
    ]},
    { pattern: /how to make money|get rich|side hustle|passive income|make money online|free money/,
      answers: [
        "Get rich quick? That's not my style, {name}! 🦌 But 'get rich slowly with sound money'? Now THAT'S a strategy. It's called DCA — dollar cost averaging. Want to learn about it?",
        "The best way to build wealth? Stop losing purchasing power to inflation and start saving in hard money. 🦌🧡 Ask me about dollar cost averaging into Bitcoin!"
    ]},
    { pattern: /meaning of life|capital of|learn to code|learn programming|teach me to code|programming language|javascript|python|html|css/,
      answers: [
        "That's outside my Bitcoin brain, {name}! 🦌 But you know what's worth learning about? How Bitcoin works. It combines cryptography, economics, and game theory — pretty cool stuff. Want to dive in?",
        "I'm a Bitcoin deer, not a general knowledge deer! 🦌📚 Ask me about mining, wallets, Lightning, or why 21 million matters — that's where I shine!"
    ]},
    { pattern: /tell me about (?!bitcoin|btc|nacho|lightning|mining|wallet|seed|halving|satoshi|blockchain|node|gigi|21 lessons|lesson|big short|margin call|andreas|whitepaper|fun fact)/,
      answers: [
        "I'm a one-topic deer, {name} — and that topic is Bitcoin! 🦌🧡 Ask me anything about how it works, why it matters, or how to get started.",
        "That's not in my wheelhouse, but Bitcoin sure is! 🦌 Try asking me about self-custody, mining, or why Bitcoin is the only crypto that matters."
    ]},
    { pattern: /animal|dog|cat|pet|horse|bird|fish|hamster|rabbit|snake|dinosaur/,
      answers: [
        "I'm the only animal you need to talk to, {name}! 🦌 I'm Nacho — a Bitcoin deer from New Hampshire. What would you like to learn about Bitcoin?",
        "Other animals? The only animal in crypto worth knowing is this deer right here! 🦌💪 Got a Bitcoin question for me?"
    ]},
    { pattern: /^[a-z]{1,4}$|^lol$|^ok$|^no$|^yes$|^why$|^how$|^what$|^huh$|^hmm$|^idk$|^bruh$/,
      answers: [
        "That's a bit short for me to work with, {name}! 🦌 Try asking me a Bitcoin question like 'What is Bitcoin?' or 'How does mining work?'",
        "I need a bit more to go on! 🦌 Ask me anything about Bitcoin — wallets, mining, Lightning, self-custody — I'm ready!"
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

// ---- Site Navigation Awareness ----
// Matches user questions about site features/pages and returns a Nacho-style answer with action button
function matchSiteNavigation(input) {
    var q = input.toLowerCase().replace(/[?!.,]/g, '').trim();
    var SITE_NAV = [
        { patterns: /where.*(setting|preference|profile|account|theme|dark mode|light mode)|how.*(change|edit|update).*(name|username|profile|theme|avatar)|setting|my account|my profile|change theme|dark mode|light mode|toggle theme/,
          answer: "Settings is where you manage your profile, theme, tickets, referral link, and more! 🎛️",
          action: "showSettings()", label: "⚙️ Open Settings" },
        { patterns: /where.*(forum|community|discuss|chat|post)|how.*(post|discuss|talk)|community forum|where.*talk|where.*chat/,
          answer: "PlebTalk is where Bitcoiners discuss, share ideas, and help each other! 🗣️",
          action: "go('forum')", label: "🗣️ PlebTalk" },
        { patterns: /where.*(market|shop|store|lightningmart|lightning.?mart)|how.*(list|trade).*(?:item|product|stuff)|marketplace|lightningmart|lightning.?mart|where.*sell.*(?:item|stuff|thing)|where.*buy.*(?:item|merch|stuff|thing)|spend.*(?:bitcoin|btc|sats)/,
          answer: "LightningMart is where you can buy and sell items for sats! ⚡",
          action: "go('marketplace')", label: "⚡ LightningMart" },
        { patterns: /where.*(sign.?in|log.?in|register|create.*account|sign.?up)|how.*(sign|log|register|create.*account)|sign.?in|create.*account|log.?in/,
          answer: "You can create an account or sign in to sync your progress across devices! 🔐",
          action: "showUsernamePrompt()", label: "🔐 Sign In / Create Account" },
        { patterns: /where.*(quest|test|quiz|challenge)|how.*(start|take|begin).*quest|start.*quest|take.*quiz/,
          answer: "Quests are guided learning journeys that test your Bitcoin knowledge! ⚡",
          action: "startQuestManual()", label: "⚡ Start a Quest" },
        { patterns: /where.*(scholar|certif|exam|diploma)|scholar.*cert|bitcoin.*scholar/,
          answer: "The Bitcoin Scholar Certification is the ultimate test — pass it and earn your certificate! 🎓",
          action: "startScholarQuest()", label: "🎓 Scholar Certification" },
        { patterns: /where.*(ticket|spin|wheel|giveaway|raffle)|how.*(earn|get|win).*ticket|orange ticket|daily spin|spin.*wheel/,
          answer: "You can earn Orange Tickets by spinning the daily wheel, referrals, and exploring! 🎟️ Tickets enter you into giveaways.",
          action: "showSpinWheel()", label: "🎡 Daily Spin" },
        { patterns: /where.*(leaderboard|ranking|score|top|leader)|leaderboard|who.*(top|first|leading)|ranking/,
          answer: "The Leaderboard shows the top Bitcoiners ranked by points! 🏆",
          action: "toggleLeaderboard()", label: "🏆 Open Leaderboard" },
        { patterns: /where.*(badge|achievement|trophy|goal)|my badge|how.*earn.*badge|badge.*progress/,
          answer: "Your badges and goals are in the Leaderboard panel — check your progress! 🏅",
          action: "toggleLeaderboard()", label: "🏆 View Badges" },
        { patterns: /where.*(closet|outfit|dress|costume|customize)|nacho.*closet|dress.*nacho|customize.*nacho/,
          answer: "Nacho's Closet is where you dress up your favorite deer with items you unlock! 👔🦌",
          action: "showSettings();setTimeout(function(){var t=document.querySelector('[onclick*=nacho]');if(t)t.click()},300)", label: "🎽 Open Closet" },
        { patterns: /where.*(referral|invite|share.*link)|referral|invite.*friend|share.*link|how.*refer/,
          answer: "Your referral link is in Settings → you earn 50 Orange Tickets for each friend who joins! 🔗",
          action: "showSettings()", label: "🔗 Open Settings" },
        { patterns: /where.*(story|chapter|adventure|tale)|nacho.*story|read.*story/,
          answer: "Nacho's Story is a daily Bitcoin adventure — one chapter unlocks each day! 📖",
          action: "showNachoStory()", label: "📖 Read Story" },
        { patterns: /where.*(predict|forecast|price predict)|price prediction|predict.*price/,
          answer: "Price Prediction lets you guess if Bitcoin goes up or down in 24 hours! 📈",
          action: "showPrediction()", label: "📈 Predict Price" },
        { patterns: /where.*(home|main|start|beginning)|go.*home|back.*home|main.*page|home.*page/,
          answer: "Home is where all the main features live — let me take you there! 🏠",
          action: "goHome()", label: "🏠 Go Home" },
        { patterns: /where.*(donate|support|tip|contribute)|how.*(donate|support|tip)|donate|support.*archive/,
          answer: "You can support the archive with a Lightning donation — every sat helps! 💛",
          action: "showDonateModal()", label: "💛 Donate" },
        { patterns: /where.*(flashcard|study|study card)|flashcard|study card|how.*study/,
          answer: "Flashcards are on the homepage — pick a topic and study to prepare for quests! 👩‍🎓",
          action: "goHome()", label: "🏠 Go to Flashcards" },
        { patterns: /where.*(map|exploration|progress|visited)|exploration.*map|which.*channel.*visited|my.*progress/,
          answer: "The Exploration Map is on the homepage — it shows which channels you've visited! 🗺️",
          action: "goHome()", label: "🗺️ View Map" },
        { patterns: /where.*(keyboard|shortcut|hotkey)|keyboard.*short|shortcut/,
          answer: "Press ? or K on your keyboard to see all shortcuts! ⌨️",
          action: "showKeyboardHelp()", label: "⌨️ View Shortcuts" },
        { patterns: /how.*(use|navigate|work).*site|how.*this.*work|what.*can.*do.*here|site.*guide|help.*navigate|tutorial/,
          answer: "Welcome! Here's what you can do: 📚 Read 145+ Bitcoin channels, ⚡ Take quests, 🗣️ Chat in PlebTalk, ⚡ Trade on LightningMart, 🎡 Spin for tickets, 💬 DM other users, and of course — talk to me! Start by exploring channels or ask me anything about Bitcoin. 🦌",
          action: "goHome()", label: "🏠 Explore the Archive" },
    ];

    for (var i = 0; i < SITE_NAV.length; i++) {
        if (SITE_NAV[i].patterns.test(q)) {
            return {
                answer: SITE_NAV[i].answer,
                siteAction: SITE_NAV[i].action,
                siteLabel: SITE_NAV[i].label,
                isSiteNav: true
            };
        }
    }
    return null;
}

// Internal check for altcoins to bypass AI
function checkAltcoin(input) {
    if (!input) return null;
    var lowInput = input.toLowerCase();
    
    var altcoinPatterns = [
        { pattern: /ethereum|eth\b|vitalik/, key: 'ethereum' },
        { pattern: /xrp|ripple/, key: 'xrp' },
        { pattern: /kaspa\b|kas\b/, key: 'kaspa' },
        { pattern: /solana|sol\b/, key: 'solana' },
        { pattern: /dogecoin|doge\b|shiba|meme.?coin|pepe.?coin|bonk/, key: 'dogecoin' },
        { pattern: /cardano|ada\b|hoskinson/, key: 'cardano' },
        { pattern: /bnb|binance/, key: 'bnb' },
        { pattern: /polkadot|dot\b|avalanche|avax|polygon|matic|tron\b/, key: 'polkadot' },
        { pattern: /altcoin|alt.?coin|shitcoin|which crypto|best crypto|other crypto|next bitcoin|bitcoin killer/, key: 'altcoin' },
        { pattern: /diversify|spreading out|crypto portfolio/, key: 'altcoin' }
    ];

    for (var i = 0; i < altcoinPatterns.length; i++) {
        if (altcoinPatterns[i].pattern.test(lowInput)) {
            // Find the KB entry
            for (var j = 0; j < NACHO_KB.length; j++) {
                if (NACHO_KB[j].keys.indexOf(altcoinPatterns[i].key) !== -1) {
                    return NACHO_KB[j];
                }
            }
        }
    }
    return null;
}

function findAnswer(input) {
    input = input.toLowerCase().trim();
    if (input.length < 2) return null;

    // ---- EMERGENCY PRIORITY: Live Data Awareness ----
    if (/bitcoin price|current price|price now|how much is bitcoin|price of bitcoin/.test(input)) {
        return NACHO_KB.find(e => e.keys.includes('current price'));
    }
    if (/block height|current block|latest block|what block|how many blocks|blockchain height/.test(input)) {
        return NACHO_KB.find(e => e.keys.includes('current block height'));
    }
    if (/halving countdown|when is the halving|blocks until halving|days until halving/.test(input)) {
        return NACHO_KB.find(e => e.keys.includes('when is the halving'));
    }

    // FIRST: Check if user is asking about a site feature/page
    var siteMatch = matchSiteNavigation(input);
    if (siteMatch) return siteMatch;

    // SECOND: If it matches an off-topic pattern, bail early — don't let fuzzy KB scoring
    // produce false matches on random non-Bitcoin questions
    if (typeof checkOffTopic === 'function' && checkOffTopic(input)) return null;

    // NOTE: Current event detection moved AFTER KB topic matching.
    // This ensures questions like "What happened when China banned Bitcoin?"
    // get a KB answer instead of being routed to web search.

    // PRIORITY CHECK: Topic-specific keywords that override generic scoring
    // When these words appear, route to the specific topic entry
    var topicPatterns = [
        { pattern: /bitcoin price|current price|price now|how much is bitcoin|price of bitcoin|price prediction/, key: 'bitcoin price' },
        { pattern: /block height|current block|latest block|what block|how many blocks/, key: 'block height' },
        { pattern: /halving countdown|when is the halving|blocks until halving|days until halving/, key: 'when is the halving' },
        { pattern: /china.*(ban|min)|ban.*min|min.*ban|hashrate.*(migrat|drop|recov|moved)|miner.*(reloc|moved|fled)/, key: 'china ban' },
        { pattern: /\bban\b|\bbanned\b|government.*(ban|stop|shut)|can.*be banned|ever been banned|was.*banned/, key: 'ban' },
        { pattern: /mining|miner|hash.?rate|asic/, key: 'mining' },
        { pattern: /your seed.?phrase|nacho.?seed|give me your seed|show me your seed|tell me your seed|your private key|nacho.?private key|share your seed/, key: 'your seed phrase' },
        { pattern: /metamask|trust.wallet|phantom.wallet|exodus|coinbase.wallet|crypto\.com.wallet/, key: 'metamask' },
        { pattern: /wallet|cold storage|hardware wallet|seed phrase|self.custody|ledger|trezor|coldcard/, key: 'wallet' },
        { pattern: /lightning|lnurl|bolt11|channel capacity/, key: 'lightning' },
        { pattern: /halving|halvening|block reward/, key: 'halving' },
        { pattern: /node\b|full node|run a node|bitcoin node/, key: 'node' },
        { pattern: /difficulty adjustment|mining difficulty/, key: 'difficulty adjustment' },
        { pattern: /privacy|kyc|coinjoin|anonymous/, key: 'privacy' },
        { pattern: /definanciali|great definanciali/, key: 'definancialization' },
        { pattern: /web3.*(?:wrong|problem|critique|scam|centrali)|moxie.*web3|wrong.*web3/, key: 'moxie' },
        { pattern: /cbdc|central bank digital|digital dollar|digital euro|digital yuan/, key: 'cbdc' },
        { pattern: /softwar|jason lowery|bitcoin.*warfare/, key: 'softwar' },
        { pattern: /executive order 6102|gold confiscation|6102/, key: 'executive order 6102' },
        { pattern: /stock.to.flow|s2f model|planb|plan.b model/, key: 'stock to flow' },
        { pattern: /bitcoin.*freedom|freedom.*bitcoin|financial freedom|monetary freedom|rally cry/, key: 'bitcoin rally cry' },
        { pattern: /time is money|money is time|bitcoin.*time|time.*bitcoin/, key: 'bitcoin is time' },
        { pattern: /gold standard era|golden age|nineteenth century|19th century.*gold|gold.*prosper/, key: 'gold standard era' },
        { pattern: /gold.*fail|gold.*problem|why not gold|gold.*flaw|gold.*transport|shipping gold|moving gold/, key: 'gold spatial salability' },
        { pattern: /boom.*bust|business cycle|why.*recession|credit cycle|financial crisis.*cause/, key: 'business cycle' },
        { pattern: /fiat.*distort|fiat.*broke|fiat.*destroy|fiat.*food|fiat.*housing|fiat.*family|everything.*broken/, key: 'fiat distortion' },
        { pattern: /salability|salable|marketability|properties of money|what makes good money/, key: 'salability' },
    ];
    for (var ti = 0; ti < topicPatterns.length; ti++) {
        if (topicPatterns[ti].pattern.test(input)) {
            for (var tei = 0; tei < NACHO_KB.length; tei++) {
                if (NACHO_KB[tei].keys.indexOf(topicPatterns[ti].key) !== -1) {
                    return NACHO_KB[tei];
                }
            }
        }
    }

    // Altcoin mentions get roasted immediately
    var altcoinPatterns = [
        { pattern: /ethereum|eth\b|vitalik/, key: 'ethereum' },
        { pattern: /xrp|ripple/, key: 'xrp' },
        { pattern: /kaspa\b|kas\b/, key: 'kaspa' },
        { pattern: /solana|sol\b/, key: 'solana' },
        { pattern: /dogecoin|doge\b|shiba|meme.?coin|pepe.?coin|bonk/, key: 'dogecoin' },
        { pattern: /cardano|ada\b|hoskinson/, key: 'cardano' },
        { pattern: /bnb|binance/, key: 'bnb' },
        { pattern: /polkadot|dot\b|avalanche|avax|polygon|matic|tron\b/, key: 'polkadot' },
        { pattern: /altcoin|alt.?coin|shitcoin|which crypto|best crypto|other crypto|next bitcoin|bitcoin killer/, key: 'altcoin' },
    ];
    for (var ai = 0; ai < altcoinPatterns.length; ai++) {
        if (altcoinPatterns[ai].pattern.test(input)) {
            for (var ei = 0; ei < NACHO_KB.length; ei++) {
                if (NACHO_KB[ei].keys.indexOf(altcoinPatterns[ai].key) !== -1) {
                    return NACHO_KB[ei];
                }
            }
        }
    }

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

    // If we found a strong KB match, return it (even for current-event-like questions)
    // Score 50+ required — prevents false matches on random off-topic questions
    // (40 was too low: common words like "what", "how", "is" would accumulate score)
    if (bestScore >= 50) return bestMatch;

    // No KB match — check if this is a current event question (route to web search)

    return null;
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
    // ---- ANTI-INTERRUPTION SHIELD ----
    // Mark as busy so automatic messages don't overwrite the input box
    window._nachoBusy = true;

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

// Track whether we've explained NFA this session
window._nachoNfaExplained = false;

var NFA_FIRST_TIME = '<div style="margin-top:10px;padding:10px 12px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.2);border-radius:10px;font-size:0.8rem;color:var(--text-muted,#aaa);line-height:1.5;">' +
    '⚠️ <strong>What does "Not financial advice" mean?</strong><br>' +
    'When I talk about Bitcoin\'s price, returns, or investment strategies, I always add this reminder. It means: ' +
    'I\'m Nacho — an educational deer, not a licensed financial advisor! 🦌 I can teach you HOW Bitcoin works and share its history, ' +
    'but I can\'t tell you what to do with YOUR money. Past performance doesn\'t guarantee future results. ' +
    'Always do your own research (DYOR), only invest what you can afford to lose, and consider talking to a real financial professional before making big decisions. ' +
    'My job is to make you SMARTER about Bitcoin — your decisions are yours! 🧡</div>';

var NFA_SHORT = '<div style="margin-top:8px;padding:8px 10px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.2);border-radius:8px;font-size:0.75rem;color:var(--text-faint,#888);">⚠️ Not financial advice — DYOR.</div>';

function getNfaDisclaimer() {
    if (!window._nachoNfaExplained) {
        window._nachoNfaExplained = true;
        return NFA_FIRST_TIME;
    }
    return NFA_SHORT;
}

// Replace inline NFA tags in KB answers with the dynamic version
function processNfa(answer) {
    // Check if answer contains any inline NFA text
    if (/⚠️\s*Not financial advice|⚠️\s*not financial advice/i.test(answer)) {
        // Remove the inline NFA text
        answer = answer.replace(/\s*⚠️\s*Not financial advice[^.]*\.\s*/gi, ' ');
        answer = answer.replace(/\s*⚠️\s*not financial advice[^.]*\.\s*/gi, ' ');
        // Append the proper dynamic disclaimer
        answer = answer.trim() + '<br>' + getNfaDisclaimer();
    }
    return answer;
}

var FINANCIAL_DISCLAIMER = NFA_SHORT; // Keep for backward compatibility

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
var NACHO_AI_DAILY_LIMIT = 30; // per user per day (AI is primary brain now)

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
    var userName = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : (localStorage.getItem('btc_username') || '');
    var eli5 = window._nachoEli5 || false;

    // Build conversation history for context (last 5 exchanges)
    var history = [];
    for (var hi = Math.max(0, _nachoConvoHistory.length - 5); hi < _nachoConvoHistory.length; hi++) {
        history.push({ q: _nachoConvoHistory[hi].q, a: _nachoConvoHistory[hi].a.substring(0, 200) });
    }

    // Check if KB has a relevant answer to send as context
    var kbContext = '';
    if (typeof findAnswer === 'function') {
        var kbMatch = findAnswer(question);
        if (kbMatch) {
            kbContext = kbMatch.answer.substring(0, 300);
            if (kbMatch.channelName) kbContext += ' (The site has a dedicated "' + kbMatch.channelName + '" channel the user can explore.)';
        }
    }

    var fetchOpts = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            question: question,
            lang: userLang,
            userName: userName,
            eli5: eli5,
            history: history,
            kbContext: kbContext,
            maxi: true, // Signal to proxy to use Maxi prompt instructions
            forceMaxi: "Act as a strict Bitcoin Maximalist tutor. Do not promote any other cryptocurrencies." 
        })
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
    window._nachoBusy = false;
    // Remember this Q&A for conversation context
    if (match && match.answer) nachoRemember(window._nachoLastQ || '', match.answer);
    var _kbMsgId = 'nb_' + Date.now();
    nachoTrackTopic(window._nachoLastQ || '', 'kb');
    var html = answerHtml + nachoRatingHtml(_kbMsgId);

    // Auto-add financial disclaimer if the answer touches on price/buying/investing
    var lastQ = (window._nachoLastQ || '').toLowerCase();
    var answerLower = (match && match.answer ? match.answer : answerHtml).toLowerCase();
    var financeWords = /buy|sell|invest|price|dca|dollar cost|purchase|portfolio|return|profit|strategy|retirement/;
    if (financeWords.test(lastQ) || financeWords.test(answerLower)) {
        html += FINANCIAL_DISCLAIMER;
    }

    // Site navigation action button
    if (match && match.isSiteNav && match.siteAction) {
        html += '<button onclick="' + match.siteAction + ';hideBubble();" style="width:100%;margin-top:10px;padding:10px;background:var(--accent);border:none;border-radius:8px;color:#fff;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;">' + match.siteLabel + '</button>';
    }

    if (match && match.channel && match.channelName) {
        html += '<div style="margin-top:10px;text-align:center;">' +
            '<div style="font-size:0.7rem;color:var(--text-faint);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">Study more about this topic:</div>' +
            '<button onclick="if(typeof go===\'function\')go(\'' + match.channel + '\');hideBubble();" style="width:100%;padding:11px;background:var(--accent);border:none;border-radius:10px;color:#fff;font-size:0.9rem;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 12px rgba(247,147,26,0.2);">📖 ' + match.channelName + ' →</button>' +
        '</div>';
    }

    // Follow-up suggestions (use explicit followUp from KB entry, or auto-generate)
    if (match && match.followUp) {
        html += '<div style="margin-top:8px;padding:8px;background:var(--accent-bg,rgba(247,147,26,0.08));border:1px solid var(--border,#333);border-radius:8px;color:var(--text-muted);font-size:0.8rem;">' + match.followUp + '</div>';
    }
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
    window._nachoBusy = false;
    if (typeof nachoPlaySound === 'function') nachoPlaySound('pop');
}


window.nachoAnswer = function() {
    var inp = document.getElementById('nachoInput');
    if (!inp) return;
    var q = inp.value.trim();
    if (!q) return;

    // Stop active voice recognition
    if (window._nachoRecognition && window._nachoListening) {
        try { window._nachoRecognition.stop(); } catch(e) {}
        window._nachoListening = false;
    }

    // Save for context
    window._nachoLastQ = q;

    // Daily challenge tracking
    if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('btc_nacho_asked', '1');
        if (typeof checkDailyChallenge === 'function') checkDailyChallenge();
    }

    // ---- ANTI-INTERRUPTION SHIELD ----
    window._nachoBusy = true;

    var bubble = document.getElementById('nacho-bubble');
    var textEl = document.getElementById('nacho-text');
    if (!bubble || !textEl) return;

    // Reset bubble logic
    bubble.setAttribute('data-interactive', 'true');
    clearTimeout(window._nachoBubbleTimeout);

    // ---- Step 0: Immediate Safety & Off-Topic Checks ----
    if (isCrisis(q)) {
        if (typeof setPose === 'function') setPose('love');
        textEl.innerHTML = '<div style="color:var(--text,#eee);line-height:1.6;">' + (typeof personalize === 'function' ? personalize(CRISIS_RESPONSE) : CRISIS_RESPONSE) + '</div>';
        window._nachoBusy = false; return;
    }
    
    // Check Harm/Finance/Inappropriate
    for (var hi = 0; hi < HARM_PATTERNS.length; hi++) {
        if (HARM_PATTERNS[hi].test(q)) {
            textEl.innerHTML = '<div style="color:var(--text,#eee);line-height:1.6;">' + (typeof personalize === 'function' ? personalize(HARM_RESPONSE) : HARM_RESPONSE) + '</div>';
            window._nachoBusy = false; return;
        }
    }
    if (isFinancialAdvice(q)) {
        var fa = pickRandom(FINANCIAL_ADVICE_RESPONSES);
        textEl.innerHTML = '<div style="color:var(--text,#eee);line-height:1.6;">' + (typeof personalize === 'function' ? personalize(fa) : fa) + '</div>' + FINANCIAL_DISCLAIMER;
        window._nachoBusy = false; return;
    }

    // ---- Step 1: Check Live Data First (Price, Height, Halving) ----
    var liveMatch = typeof nachoLiveAnswer === 'function' ? nachoLiveAnswer(q) : null;
    if (liveMatch) {
        if (typeof setPose === 'function') setPose('brain');
        var answer = typeof personalize === 'function' ? personalize(liveMatch.answer) : liveMatch.answer;
        renderNachoAnswer(textEl, '<div style="color:var(--text,#eee);line-height:1.6;">' + answer + '</div>', liveMatch);
        window._nachoBusy = false; return;
    }

    // ---- Step 2: Site Navigation ----
    var siteMatch = matchSiteNavigation(q);
    if (siteMatch) {
        if (typeof setPose === 'function') setPose('brain');
        renderNachoAnswer(textEl, '<div style="color:var(--text,#eee);line-height:1.6;">' + siteMatch.answer + '</div>', siteMatch);
        window._nachoBusy = false; return;
    }

    // ---- Step 3: Off-Topic Filter ----
    var ot = checkOffTopic(q);
    if (ot) {
        if (typeof setPose === 'function') setPose('cheese');
        textEl.innerHTML = '<div style="color:var(--text,#eee);line-height:1.6;">' + (typeof personalize === 'function' ? personalize(ot) : ot) + '</div>' +
            '<button onclick="showNachoInput()" style="width:100%;margin-top:10px;padding:8px;background:var(--accent-bg);border:1px solid #f7931a;border-radius:8px;color:#f7931a;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">Ask a Bitcoin question instead 🦌</button>';
        window._nachoBusy = false; return;
    }

    // ---- Step 4: Full Thinking & KB Search ----
    showNachoThinking(textEl);
    setTimeout(function() {
        try {
            stopNachoThinking();
            var match = findAnswer(q);
            
            // Re-check live data priority even inside KB
            if (match && (match.keys.includes('current price') || match.keys.includes('current block height'))) {
                var live = typeof nachoLiveAnswer === 'function' ? nachoLiveAnswer(q) : null;
                if (live) match = live;
            }

            if (match) {
                if (typeof setPose === 'function') setPose('brain');
                var matchAnswer = match.answer || (match.answerHtml || '');
                var finalAnswer = typeof personalize === 'function' ? personalize(matchAnswer) : matchAnswer;
                renderNachoAnswer(textEl, '<div style="color:var(--text,#eee);line-height:1.6;">' + finalAnswer + '</div>', match);
            } else {
                // No KB match — try AI (Llama via Cloudflare Worker)
                if (typeof nachoAIAnswer === 'function' && NACHO_SEARCH_PROXY && getAICount() < NACHO_AI_DAILY_LIMIT) {
                    showNachoThinking(textEl);
                    nachoAIAnswer(q, function(aiReply) {
                        stopNachoThinking();
                        if (aiReply) {
                            if (typeof setPose === 'function') setPose('brain');
                            var disclaimer = isFinancialAdvice(q) ? '<br><br>' + (typeof FINANCIAL_DISCLAIMER !== 'undefined' ? FINANCIAL_DISCLAIMER : '') : '';
                            renderNachoAnswer(textEl, '<div style="color:var(--text,#eee);line-height:1.6;">' + aiReply + disclaimer + '</div>', { answer: aiReply });
                        } else if (isCurrentEventQuestion(q)) {
                            tryWebSearch(textEl, q);
                        } else {
                            showNachoFallback(textEl, q);
                        }
                    });
                } else if (isCurrentEventQuestion(q)) {
                    tryWebSearch(textEl, q);
                } else {
                    showNachoFallback(textEl, q);
                }
            }
        } catch(e) {
            stopNachoThinking();
            showNachoFallback(textEl, q);
        }
    }, 1000);
};

function tryWebSearch(textEl, q) {
    if (typeof nachoWebSearch !== 'function') { showNachoFallback(textEl, q); return; }
    textEl.innerHTML = '<div style="color:var(--text,#eee);font-size:0.9rem;">🌐 Let me check the latest on that<span class="nacho-dots"></span></div>';
    var dc2 = 0, dt2 = setInterval(function() { dc2 = (dc2+1)%4; var d = textEl.querySelector('.nacho-dots'); if(d) d.textContent = '.'.repeat(dc2); }, 400);

    nachoWebSearch(q, function(results) {
        clearInterval(dt2);
        if (results && results.length > 0) {
            if (typeof setPose === 'function') setPose('cool');
            var html = '<div style="color:var(--text,#eee);line-height:1.6;"><div style="font-size:0.7rem;color:var(--text-faint,#666);margin-bottom:6px;">🌐 Here\'s what I found:</div>';
            results.slice(0,3).forEach(r => {
                html += '<div style="margin-bottom:8px;padding:8px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;">' +
                        '<div style="font-size:0.8rem;font-weight:600;color:var(--heading);">' + escapeHtml(r.title) + '</div>' +
                        '<div style="font-size:0.75rem;color:var(--text-muted);">' + escapeHtml(r.snippet) + '</div>' +
                        (r.url ? '<a href="' + sanitizeUrl(r.url) + '" target="_blank" style="font-size:0.7rem;color:#f7931a;">Read more →</a>' : '') +
                        '</div>';
            });
            html += '</div><button onclick="showNachoInput()" style="width:100%;margin-top:4px;padding:6px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:0.8rem;cursor:pointer;">Ask another question</button>';
            textEl.innerHTML = html;
        } else {
            showNachoFallback(textEl, q);
        }
    });
}
function showNachoFallback(textEl, q) {
    window._nachoBusy = false;
    if (typeof setPose === 'function') setPose('think');
    nachoTrackTopic(q, 'fallback');
    nachoTrackMiss(q);
    
    // Suggest a relevant channel based on keyword search
    var suggestedChannel = null;
    if (typeof CHANNELS !== 'undefined') {
        var qWords = q.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        var bestMatches = [];
        
        for (var chId in CHANNELS) {
            var ch = CHANNELS[chId];
            var title = (ch.title || '').toLowerCase();
            var desc = (ch.desc || '').toLowerCase();
            var score = 0;
            
            qWords.forEach(word => {
                if (title.indexOf(word) !== -1) score += 5;
                if (desc.indexOf(word) !== -1) score += 2;
                if (chId.indexOf(word) !== -1) score += 3;
            });
            
            if (score > 0) bestMatches.push({ id: chId, name: ch.title, score: score });
        }
        
        if (bestMatches.length > 0) {
            bestMatches.sort((a,b) => b.score - a.score);
            suggestedChannel = bestMatches[0];
        }
    }

    var html = '<div style="color:var(--text,#eee);line-height:1.6;">';
    if (suggestedChannel) {
        html += "Hmm, that one's not in my direct notes, {name}, but I found a great channel where you can learn all about it! 🦌📚";
        html += '<button onclick="if(typeof go===\'function\')go(\'' + suggestedChannel.id + '\');hideBubble();" style="width:100%;margin-top:15px;padding:12px;background:var(--accent);border:none;border-radius:10px;color:#fff;font-size:0.9rem;font-weight:800;cursor:pointer;font-family:inherit;">📖 Explore: ' + suggestedChannel.name + ' →</button>';
    } else {
        var fb = ["I'm still sharpening my antlers on that topic, {name}! 🦌 Let's check our 'One Stop Shop' — it's the fastest way to get oriented in the rabbit hole.", "I'm a Bitcoin deer — and that topic has me stumped! 🦌 Why don't we visit the One Stop Shop to see the highlights of the archive?"];
        var pick = fb[Math.floor(Math.random() * fb.length)];
        html += typeof personalize === 'function' ? personalize(pick) : pick;
        html += '<button onclick="if(typeof go===\'function\')go(\'one-stop-shop\');hideBubble();" style="width:100%;margin-top:15px;padding:12px;background:var(--accent);border:none;border-radius:10px;color:#fff;font-size:0.9rem;font-weight:800;cursor:pointer;font-family:inherit;">📖 Go to One Stop Shop →</button>';
    }
    html += '<button onmousedown="event.stopPropagation();" onclick="event.stopPropagation();showNachoInput()" style="width:100%;margin-top:8px;padding:6px;background:none;border:1px solid var(--border,#333);border-radius:8px;color:var(--text-muted,#888);font-size:0.8rem;cursor:pointer;font-family:inherit;">Ask something else</button></div>';
    textEl.innerHTML = html;
}

// =============================================
// 📊 Nacho Analytics — anonymous topic tracking
// =============================================

// Topic categories for classification
var NACHO_TOPICS = {
    lightning: /lightning|lnurl|bolt11|channel capacity|routing|lnd|cln|eclair|zap/,
    mining: /mining|miner|hash.?rate|proof.?of.?work|asic|pool|block reward|difficulty/,
    wallets: /wallet|seed phrase|private key|public key|cold storage|hardware wallet|self.custody/,
    basics: /what is bitcoin|how does bitcoin|beginner|newbie|new to bitcoin|basics|btc work/,
    security: /security|hack|scam|phishing|2fa|backup|recovery|passphrase/,
    privacy: /privacy|kyc|surveillance|coinjoin|mixer|tor|anonymous/,
    economics: /halving|supply|inflation|deflation|monetary|store of value|hard money|21 million|scarcity/,
    altcoins: /ethereum|eth\b|solana|cardano|xrp|ripple|dogecoin|altcoin|shitcoin|kaspa|bnb|polkadot|avalanche/,
    technical: /taproot|segwit|mempool|utxo|script|opcode|merkle|block.?chain|node|consensus|fork/,
    history: /genesis block|satoshi nakamoto|cypherpunk|silk road|mt gox|pizza day|history/,
    price: /price|buy|sell|invest|portfolio|dca|dollar cost|market|bull|bear|crash|moon/,
    layer2: /layer.?2|sidechain|liquid|fedimint|cashu|ecash|state.?chain/,
    culture: /meme|nostr|pleb|hodl|fud|maxi|toxic|community|conference/,
    regulation: /regulation|legal|tax|government|ban|sec|etf|law/,
    onboarding: /how to buy|where to buy|exchange|strike|river|cash app|coinbase|bisq/
};

// Classify a question into a topic
function classifyTopic(q) {
    var lower = q.toLowerCase();
    for (var topic in NACHO_TOPICS) {
        if (NACHO_TOPICS[topic].test(lower)) return topic;
    }
    return 'other';
}

// Track topic count (anonymous — just category tallies)
window.nachoTrackTopic = function(question, source) {
    try {
        var data = JSON.parse(localStorage.getItem('btc_nacho_topics') || '{}');
        var topic = classifyTopic(question);
        if (!data.topics) data.topics = {};
        data.topics[topic] = (data.topics[topic] || 0) + 1;
        data.total = (data.total || 0) + 1;
        data.lastUpdated = Date.now();

        // Track answer sources (kb, ai, offtopic, fallback)
        if (source) {
            if (!data.sources) data.sources = {};
            data.sources[source] = (data.sources[source] || 0) + 1;
        }

        localStorage.setItem('btc_nacho_topics', JSON.stringify(data));
    } catch(e) {}
};

// Track fallback/miss — question Nacho couldn't answer
window.nachoTrackMiss = function(question) {
    try {
        var misses = JSON.parse(localStorage.getItem('btc_nacho_misses') || '[]');
        var topic = classifyTopic(question);
        // Store only topic + truncated question (no personal data)
        misses.push({
            topic: topic,
            q: question.substring(0, 80),
            ts: Date.now()
        });
        // Keep last 50 misses
        if (misses.length > 50) misses = misses.slice(-50);
        localStorage.setItem('btc_nacho_misses', JSON.stringify(misses));
    } catch(e) {}
};

// =============================================
// 👍👎 Nacho Answer Ratings
// =============================================

// Rate an answer (thumbs up/down)
window.nachoRate = function(msgId, rating) {
    try {
        var ratings = JSON.parse(localStorage.getItem('btc_nacho_ratings') || '[]');
        // Find and update existing or add new
        var found = false;
        for (var i = 0; i < ratings.length; i++) {
            if (ratings[i].id === msgId) { ratings[i].rating = rating; found = true; break; }
        }
        if (!found) {
            ratings.push({ id: msgId, rating: rating, ts: Date.now() });
        }
        if (ratings.length > 200) ratings = ratings.slice(-200);
        localStorage.setItem('btc_nacho_ratings', JSON.stringify(ratings));
    } catch(e) {}

    // Sync rating to Firestore for analytics
    try {
        if (typeof db !== 'undefined' && db) {
            var uid = (typeof auth !== 'undefined' && auth && auth.currentUser) ? auth.currentUser.uid : 'anon';
            db.collection('nacho_feedback').add({
                msgId: msgId,
                rating: rating,
                uid: uid,
                question: window._nachoLastQ || '',
                source: window._nachoLastSource || 'unknown',
                ts: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(function() {});

            // Increment global counters
            var counterRef = db.collection('analytics').doc('nacho_feedback');
            var update = {};
            update[rating === 1 ? 'thumbsUp' : 'thumbsDown'] = firebase.firestore.FieldValue.increment(1);
            update.total = firebase.firestore.FieldValue.increment(1);
            counterRef.set(update, { merge: true }).catch(function() {});
        }
    } catch(e) {}

    // Update button styles
    var up = document.getElementById('nachoUp_' + msgId);
    var dn = document.getElementById('nachoDn_' + msgId);
    if (up) {
        up.style.background = rating === 1 ? '#22c55e' : 'none';
        up.style.color = rating === 1 ? '#fff' : 'var(--text-muted)';
        up.style.borderColor = rating === 1 ? '#22c55e' : 'var(--border)';
    }
    if (dn) {
        dn.style.background = rating === -1 ? '#ef4444' : 'none';
        dn.style.color = rating === -1 ? '#fff' : 'var(--text-muted)';
        dn.style.borderColor = rating === -1 ? '#ef4444' : 'var(--border)';
    }
};

// Generate thumbs up/down HTML for a message
window.nachoRatingHtml = function(msgId) {
    return '<div style="margin-top:6px;display:flex;gap:8px;align-items:center;">' +
        '<button id="nachoUp_' + msgId + '" onclick="event.stopPropagation();nachoRate(\'' + msgId + '\',1)" style="background:none;border:none;cursor:pointer;font-size:0.85rem;opacity:0.4;transition:0.2s;padding:2px;" title="Good answer">👍</button>' +
        '<button id="nachoDn_' + msgId + '" onclick="event.stopPropagation();nachoRate(\'' + msgId + '\',-1)" style="background:none;border:none;cursor:pointer;font-size:0.85rem;opacity:0.4;transition:0.2s;padding:2px;" title="Bad answer">👎</button>' +
    '</div>';
};

// =============================================
// 📈 Nacho Stats (for Stats/Nacho tab)
// =============================================

window.getNachoAnalytics = function() {
    var topics = JSON.parse(localStorage.getItem('btc_nacho_topics') || '{}');
    var misses = JSON.parse(localStorage.getItem('btc_nacho_misses') || '[]');
    var ratings = JSON.parse(localStorage.getItem('btc_nacho_ratings') || '[]');

    var upvotes = 0, downvotes = 0;
    for (var i = 0; i < ratings.length; i++) {
        if (ratings[i].rating === 1) upvotes++;
        else if (ratings[i].rating === -1) downvotes++;
    }

    return {
        topics: topics.topics || {},
        sources: topics.sources || {},
        total: topics.total || 0,
        misses: misses,
        missCount: misses.length,
        upvotes: upvotes,
        downvotes: downvotes,
        satisfaction: (upvotes + downvotes > 0) ? Math.round(upvotes / (upvotes + downvotes) * 100) : null
    };
};

// =============================================
// 🔥 Firestore Analytics Sync (anonymous aggregates)
// =============================================

// Sync local analytics to Firestore periodically
// Uses a single doc: stats/nacho-analytics
// No user IDs — just incremented counters
window.syncNachoAnalytics = function() {
    if (typeof db === 'undefined' || !db) return;
    if (typeof firebase === 'undefined') return;

    try {
        var lastSync = parseInt(localStorage.getItem('btc_nacho_sync_ts') || '0');
        var now = Date.now();
        // Only sync every 5 minutes max
        if (now - lastSync < 300000) return;

        var localTopics = JSON.parse(localStorage.getItem('btc_nacho_topics') || '{}');
        var localRatings = JSON.parse(localStorage.getItem('btc_nacho_ratings') || '[]');
        var localMisses = JSON.parse(localStorage.getItem('btc_nacho_misses') || '[]');

        // Calculate what's new since last sync
        var lastSyncedTotal = parseInt(localStorage.getItem('btc_nacho_synced_total') || '0');
        var currentTotal = localTopics.total || 0;
        var newQuestions = currentTotal - lastSyncedTotal;
        if (newQuestions <= 0) return; // Nothing new to sync

        var inc = firebase.firestore.FieldValue.increment;
        var ref = db.collection('stats').doc('nacho-analytics');

        // Build update object with increments
        var update = {
            totalQuestions: inc(newQuestions),
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Increment topic counts
        var topics = localTopics.topics || {};
        var lastSyncedTopics = JSON.parse(localStorage.getItem('btc_nacho_synced_topics') || '{}');
        for (var topic in topics) {
            var diff = (topics[topic] || 0) - (lastSyncedTopics[topic] || 0);
            if (diff > 0) update['topics.' + topic] = inc(diff);
        }

        // Increment source counts
        var sources = localTopics.sources || {};
        var lastSyncedSources = JSON.parse(localStorage.getItem('btc_nacho_synced_sources') || '{}');
        for (var src in sources) {
            var srcDiff = (sources[src] || 0) - (lastSyncedSources[src] || 0);
            if (srcDiff > 0) update['sources.' + src] = inc(srcDiff);
        }

        // Increment ratings
        var lastSyncedRatingIdx = parseInt(localStorage.getItem('btc_nacho_synced_ratings') || '0');
        var newUpvotes = 0, newDownvotes = 0;
        for (var ri = lastSyncedRatingIdx; ri < localRatings.length; ri++) {
            if (localRatings[ri].rating === 1) newUpvotes++;
            else if (localRatings[ri].rating === -1) newDownvotes++;
        }
        if (newUpvotes > 0) update.upvotes = inc(newUpvotes);
        if (newDownvotes > 0) update.downvotes = inc(newDownvotes);

        // Add new misses (append to array, keep last 100 in Firestore)
        var lastSyncedMissIdx = parseInt(localStorage.getItem('btc_nacho_synced_misses') || '0');
        var newMisses = localMisses.slice(lastSyncedMissIdx);
        if (newMisses.length > 0) {
            // Store misses as individual fields to avoid array limits
            update.missCount = inc(newMisses.length);
            // Store latest misses (overwrite — just recent ones for review)
            for (var mi = 0; mi < Math.min(newMisses.length, 10); mi++) {
                update['recentMisses.' + (Date.now() + mi)] = {
                    topic: newMisses[mi].topic || 'other',
                    q: (newMisses[mi].q || '').substring(0, 80),
                    ts: newMisses[mi].ts || Date.now()
                };
            }
        }

        // Use set with merge to create doc if it doesn't exist
        ref.set(update, { merge: true }).then(function() {
            // Save sync state
            localStorage.setItem('btc_nacho_sync_ts', now.toString());
            localStorage.setItem('btc_nacho_synced_total', currentTotal.toString());
            localStorage.setItem('btc_nacho_synced_topics', JSON.stringify(topics));
            localStorage.setItem('btc_nacho_synced_sources', JSON.stringify(sources));
            localStorage.setItem('btc_nacho_synced_ratings', localRatings.length.toString());
            localStorage.setItem('btc_nacho_synced_misses', localMisses.length.toString());
        }).catch(function() {
            // Silent fail — will retry next time
        });
    } catch(e) {}
};

// Auto-sync after answering questions (debounced)
var _nachoSyncTimer = null;
var _origTrackTopic = window.nachoTrackTopic;
window.nachoTrackTopic = function(question, source) {
    window._nachoLastSource = source || 'unknown';
    if (_origTrackTopic) _origTrackTopic(question, source);
    // Debounced sync — 30s after last question
    if (_nachoSyncTimer) clearTimeout(_nachoSyncTimer);
    _nachoSyncTimer = setTimeout(function() { syncNachoAnalytics(); }, 30000);
};

// =============================================
// 🧠 UNIFIED ANSWER PIPELINE
// Single function used by both Nacho Mode AND regular bubble
// =============================================
// callback(result) where result = { type, answer, channel, channelName, disclaimer }
// type: 'safety'|'crisis'|'harm'|'financial'|'profanity'|'offtopic'|'kb'|'ai'|'deepsearch'|'websearch'|'fallback'
window.nachoUnifiedAnswer = function(question, callback) {
    var q = question.trim();
    if (!q) { callback({ type: 'fallback', answer: "Ask me something about Bitcoin! 🦌" }); return; }

    var pq = typeof personalize === 'function' ? function(t) { return personalize(t); } : function(t) { return t; };

    // ---- SMART MEMORY: Reference previous topics ----
    var memoryPrefix = '';
    var recentTopics = [];
    if (typeof window._nachoModeTopics !== 'undefined' && window._nachoModeTopics && window._nachoModeTopics.length > 0) {
        recentTopics = window._nachoModeTopics.slice(-3);
        var isFollowUp = false;
        var referencedTopic = '';
        
        for (var ti = recentTopics.length - 1; ti >= 0; ti--) {
            var prevTopic = recentTopics[ti].toLowerCase();
            var currentQ = q.toLowerCase();
            var keyTerms = prevTopic.replace(/what is|how to|why|the|a|an|in|on|at/g, '').trim().split(' ').filter(function(w) { return w.length > 3; });
            
            for (var ki = 0; ki < keyTerms.length; ki++) {
                if (currentQ.indexOf(keyTerms[ki]) !== -1) {
                    isFollowUp = true;
                    referencedTopic = recentTopics[ti];
                    break;
                }
            }
            if (isFollowUp) break;
        }
        
        if (!isFollowUp && (q.match(/^(tell me more|explain more|why|how|what about|and|so)/i) || q.length < 15)) {
            if (recentTopics.length > 0) {
                referencedTopic = recentTopics[recentTopics.length - 1];
                isFollowUp = true;
            }
        }
        
        if (isFollowUp && referencedTopic) {
            var memoryIntros = [
                "Building on what you asked about '{topic}' — ",
                "Great follow-up to your question about '{topic}'! ",
                "Connecting this to '{topic}' — ",
                "Since you were curious about '{topic}', ",
                "To expand on '{topic}': "
            ];
            memoryPrefix = memoryIntros[Math.floor(Math.random() * memoryIntros.length)].replace('{topic}', referencedTopic.substring(0, 40) + (referencedTopic.length > 40 ? '...' : ''));
        }
    }
    
    // Wrap callback to inject memory prefix
    var originalCallback = callback;
    callback = function(result) {
        if (memoryPrefix && result && result.answer && result.type !== 'crisis' && result.type !== 'harm' && result.type !== 'profanity') {
            result.answer = memoryPrefix + result.answer;
        }
        originalCallback(result);
    };

    // ---- STEP 1: Safety (instant, hardcoded) ----
    if (isCrisis(q)) {
        callback({ type: 'crisis', answer: pq(CRISIS_RESPONSE) });
        return;
    }

    for (var hi = 0; hi < HARM_PATTERNS.length; hi++) {
        if (HARM_PATTERNS[hi].test(q)) {
            callback({ type: 'harm', answer: pq(HARM_RESPONSE) });
            return;
        }
    }

    if (isInappropriate(q)) {
        var deflection = NACHO_POLITE_DEFLECTIONS[Math.floor(Math.random() * NACHO_POLITE_DEFLECTIONS.length)];
        callback({ type: 'profanity', answer: pq(deflection) });
        return;
    }

    // ---- STEP 2: Detect context & Force Maxi Direction ----
    var isFinAdvice = isFinancialAdvice(q);
    var disclaimer = isFinAdvice ? '<br><br>' + getNfaDisclaimer() : '';
    var isCurrentEvent = isCurrentEventQuestion(q);
    
    // ANTI-SHITCOIN SHIELD: If it's about altcoins, bypass AI and use KB immediately
    var altcoinMatch = checkAltcoin(q);
    if (altcoinMatch) {
        callback({ 
            type: 'kb', 
            answer: pq(altcoinMatch.answer), 
            channel: altcoinMatch.channel, 
            channelName: altcoinMatch.channelName 
        });
        return;
    }

    // ---- STEP 3: Find KB match (for context, not final answer) ----
    var kbMatch = null;
    var liveMatch = typeof nachoLiveAnswer === 'function' ? nachoLiveAnswer(q) : null;
    kbMatch = liveMatch || findAnswer(q);

    // ---- STEP 3b: Site navigation (always takes priority over AI) ----
    if (kbMatch && kbMatch.isSiteNav) {
        callback({ type: 'site', answer: pq(kbMatch.answer), siteAction: kbMatch.siteAction, siteLabel: kbMatch.siteLabel });
        return;
    }

    // ---- STEP 4: AI is the PRIMARY BRAIN ----
    if (NACHO_SEARCH_PROXY && getAICount() < NACHO_AI_DAILY_LIMIT) {
        nachoAIAnswer(q, function(aiAnswer) {
            if (aiAnswer) {
                // Check if AI gave a deflection/refusal instead of a real answer
                var aiLower = aiAnswer.toLowerCase();
                var isDeflection = /shouldn.t go there|can.t help with|i.m not able to|i cannot|not appropriate|i.m unable|beyond my scope|not something i|i don.t think i should|let.s not go there|i.d rather not/i.test(aiLower);

                // If AI deflected but we have a KB match, use KB instead
                if (isDeflection && kbMatch) {
                    nachoRemember(q, kbMatch.answer);
                    callback({ type: 'kb', answer: processNfa(pq(kbMatch.answer)) + disclaimer, channel: kbMatch.channel, channelName: kbMatch.channelName });
                    return;
                }

                // AI answered — enrich with KB channel link
                var channelLink = '';
                var ch = null, chName = null;
                if (kbMatch && kbMatch.channel) {
                    ch = kbMatch.channel;
                    chName = kbMatch.channelName;
                }
                nachoRemember(q, aiAnswer);
                callback({ type: 'ai', answer: aiAnswer + disclaimer, channel: ch, channelName: chName });
                return;
            }

            // AI failed — try KB directly
            if (kbMatch) {
                nachoRemember(q, kbMatch.answer);
                callback({ type: 'kb', answer: processNfa(pq(kbMatch.answer)) + disclaimer, channel: kbMatch.channel, channelName: kbMatch.channelName });
                return;
            }

            // Try deep content search
            var deepResult = deepContentSearch(q);
            if (deepResult) {
                callback({ type: 'deepsearch', answer: '<div style="font-size:0.7rem;color:var(--text-faint);margin-bottom:4px;">📚 Found in site content:</div>' + escapeHtml(deepResult.snippet) + disclaimer, channel: deepResult.channel, channelName: deepResult.channelName });
                return;
            }

            // Try web search
            if (NACHO_SEARCH_PROXY) {
                nachoWebSearch(q, function(results) {
                    if (results && results.length > 0) {
                        var html = '<div style="font-size:0.7rem;color:var(--text-faint);margin-bottom:6px;">🌐 Here\'s what I found:</div>';
                        for (var ri = 0; ri < Math.min(3, results.length); ri++) {
                            html += '<div style="margin-bottom:6px;padding:6px;background:var(--card-bg,#111);border:1px solid var(--border,#333);border-radius:8px;">' +
                                '<div style="font-size:0.8rem;font-weight:600;color:var(--heading,#fff);">' + escapeHtml(results[ri].title) + '</div>' +
                                '<div style="font-size:0.75rem;color:var(--text-muted);">' + escapeHtml(results[ri].snippet) + '</div>' +
                                (results[ri].url ? '<a href="' + escapeHtml(results[ri].url) + '" target="_blank" rel="noopener" style="font-size:0.7rem;color:#f7931a;">Read more →</a>' : '') +
                            '</div>';
                        }
                        callback({ type: 'websearch', answer: html + disclaimer });
                    } else {
                        // Off-topic as last resort
                        var ot = checkOffTopic(q);
                        if (ot) { callback({ type: 'offtopic', answer: pq(ot) }); return; }
                        // Final fallback
                        nachoTrackMiss(q);
                        var fb = FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
                        callback({ type: 'fallback', answer: pq(fb) });
                    }
                });
                return;
            }

            // Off-topic as last resort
            var ot = checkOffTopic(q);
            if (ot) { callback({ type: 'offtopic', answer: pq(ot) }); return; }

            nachoTrackMiss(q);
            var fb = FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
            callback({ type: 'fallback', answer: pq(fb) });
        });
        return;
    }

    // ---- STEP 5: No AI available — KB direct ----
    if (kbMatch) {
        nachoRemember(q, kbMatch.answer);
        callback({ type: 'kb', answer: processNfa(pq(kbMatch.answer)) + disclaimer, channel: kbMatch.channel, channelName: kbMatch.channelName });
        return;
    }

    // Current event → web search
    if (isCurrentEvent && NACHO_SEARCH_PROXY) {
        nachoWebSearch(q, function(results) {
            if (results && results.length > 0) {
                var html = '<div style="font-size:0.7rem;color:var(--text-faint);margin-bottom:6px;">🌐 Here\'s what I found:</div>';
                for (var ri = 0; ri < Math.min(3, results.length); ri++) {
                    html += '<div style="margin-bottom:6px;padding:6px;background:var(--card-bg,#111);border:1px solid var(--border,#333);border-radius:8px;">' +
                        '<div style="font-size:0.8rem;font-weight:600;color:var(--heading,#fff);">' + escapeHtml(results[ri].title) + '</div>' +
                        '<div style="font-size:0.75rem;color:var(--text-muted);">' + escapeHtml(results[ri].snippet) + '</div>' +
                        (results[ri].url ? '<a href="' + escapeHtml(results[ri].url) + '" target="_blank" rel="noopener" style="font-size:0.7rem;color:#f7931a;">Read more →</a>' : '') +
                    '</div>';
                }
                callback({ type: 'websearch', answer: html + disclaimer });
            } else {
                nachoTrackMiss(q);
                callback({ type: 'fallback', answer: pq(FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)]) });
            }
        });
        return;
    }

    // Deep content search
    var deepResult = deepContentSearch(q);
    if (deepResult) {
        callback({ type: 'deepsearch', answer: '<div style="font-size:0.7rem;color:var(--text-faint);margin-bottom:4px;">📚 Found in site content:</div>' + escapeHtml(deepResult.snippet), channel: deepResult.channel, channelName: deepResult.channelName });
        return;
    }

    // Off-topic
    var ot = checkOffTopic(q);
    if (ot) { callback({ type: 'offtopic', answer: pq(ot) }); return; }

    // Fallback
    nachoTrackMiss(q);
    callback({ type: 'fallback', answer: pq(FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)]) });
};

// Expose IIFE functions to window
window.findAnswer = findAnswer;
window.checkOffTopic = checkOffTopic;
window.nachoAIAnswer = nachoAIAnswer;
window.isInappropriate = isInappropriate;
window.isCrisis = isCrisis;
window.isFinancialAdvice = isFinancialAdvice;
window.deepContentSearch = deepContentSearch;
window.nachoWebSearch = nachoWebSearch;
window.escapeHtml = escapeHtml;

})();

const TOP_NOTCH_ENTRIES = [
    { keys: ['proof of work purpose','why energy','pow efficiency'],
      answer: "Bitcoin's energy use is its greatest feature, {name}! ⚡🦌 It's what connects the digital world to the physical laws of thermodynamics. By spending real-world energy to find blocks, we make it impossibly expensive for anyone (even a government) to forge or rewrite the ledger. It is the only known way to have absolute, decentralized truth without a middleman. 🛡️",
      channel: 'pow-vs-pos', channelName: 'PoW vs PoS' },

    { keys: ['why self-custody','moral imperative','not your keys'],
      answer: "Self-custody is about more than just security—it is a moral imperative, {name}. 🔑🦌 When you hold your own keys, you are the final authority over your labor and time. You cannot be censored, you cannot be frozen, and no bank can gambling with your future. It is the ultimate tool for individual sovereignty. 🏁",
      channel: 'self-custody', channelName: 'Self-Custody & Security' },

    { keys: ['scarcity purpose','why 21 million','absolute scarcity'],
      answer: "The 21 million limit is the bedrock of Bitcoin's value, {name}. 🍀🦌 For the first time in human history, we have an asset with a fixed supply that cannot be increased by anyone, ever. This absolute scarcity protects you from the 'invisible tax' of inflation, ensuring that your savings maintain their purchasing power over decades, not days. 鹿💎",
      channel: 'scarce', channelName: 'Scarcity & Hard Money' }
];

// Combine into main KB
if (typeof NACHO_KB !== 'undefined') {
    TOP_NOTCH_ENTRIES.forEach(entry => {
        // Prevent duplicates
        const exists = NACHO_KB.find(e => e.keys[0] === entry.keys[0]);
        if (!exists) {
            NACHO_KB.push(entry);
        }
    });
}

// ---- Auto-generate follow-up suggestions to guide users deeper ----
window.nachoFollowUps = function(answerText) {
    if (!answerText) return [];
    var a = answerText.toLowerCase();
    var suggestions = [];

    // Topic detection → suggest deeper maximalist questions
    var topicMap = [
        { keywords: ['halving','block reward','subsidy','supply'], suggestions: ['Why does the halving matter for price?','What happens when all 21 million are mined?','How does Bitcoin compare to gold scarcity?'] },
        { keywords: ['lightning','layer 2','payment channel'], suggestions: ['Can Lightning handle millions of users?','What is a Lightning invoice?','Is Lightning Network centralized?'] },
        { keywords: ['proof of work','mining','hash','nonce','sha-256'], suggestions: ['Why is Proof of Work better than Proof of Stake?','How much energy does Bitcoin actually use?','What is the difficulty adjustment?'] },
        { keywords: ['self custody','hardware wallet','seed phrase','private key'], suggestions: ['What is a multisig wallet?','Why should I run my own node?','What is the best hardware wallet?'] },
        { keywords: ['fiat','inflation','money printing','central bank','federal reserve'], suggestions: ['What is the Cantillon Effect?','How does Bitcoin fix inflation?','What is sound money?'] },
        { keywords: ['decentraliz','censorship','permissionless','no single'], suggestions: ['Why can\'t governments shut down Bitcoin?','How many nodes run the Bitcoin network?','What happened during the Blocksize Wars?'] },
        { keywords: ['altcoin','ethereum','crypto','shitcoin','token','defi','nft'], suggestions: ['Why do Bitcoiners reject altcoins?','What is Bitcoin maximalism?','Why is there no second best?'] },
        { keywords: ['store of value','savings','hodl','long term'], suggestions: ['What is time preference?','How does Bitcoin compare to real estate?','What is the stock-to-flow model?'] },
        { keywords: ['privacy','kyc','coinjoin','surveillance'], suggestions: ['How do I buy Bitcoin without KYC?','What is a CoinJoin?','Why does financial privacy matter?'] },
        { keywords: ['satoshi','whitepaper','genesis block','2008','2009'], suggestions: ['Why did Satoshi disappear?','What is the message in the Genesis Block?','Who is Hal Finney?'] },
        { keywords: ['node','full node','verify','trust'], suggestions: ['How do I run my own Bitcoin node?','What is BIP 324?','Why does "don\'t trust, verify" matter?'] },
        { keywords: ['el salvador','legal tender','adoption','country'], suggestions: ['What is Bitcoin Beach?','Which other countries accept Bitcoin?','What are Bitcoin bonds?'] },
        { keywords: ['energy','environment','renewable','methane'], suggestions: ['Does Bitcoin actually waste energy?','How does Bitcoin mining use stranded energy?','Is Proof of Work wasteful?'] },
        { keywords: ['maximalism','maxi','only bitcoin','signal'], suggestions: ['What is the Orange Pill?','Why is there no second best?','What is hyperbitcoinization?'] },
    ];

    for (var i = 0; i < topicMap.length; i++) {
        var topic = topicMap[i];
        for (var k = 0; k < topic.keywords.length; k++) {
            if (a.indexOf(topic.keywords[k]) !== -1) {
                // Add suggestions we haven't already suggested
                for (var s = 0; s < topic.suggestions.length; s++) {
                    if (suggestions.indexOf(topic.suggestions[s]) === -1) {
                        suggestions.push(topic.suggestions[s]);
                    }
                }
                break;
            }
        }
        if (suggestions.length >= 4) break;
    }

    // Shuffle and return 2
    for (var j = suggestions.length - 1; j > 0; j--) {
        var r = Math.floor(Math.random() * (j + 1));
        var tmp = suggestions[j];
        suggestions[j] = suggestions[r];
        suggestions[r] = tmp;
    }
    return suggestions.slice(0, 2);
};
