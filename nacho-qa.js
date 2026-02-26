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
      answer: "DCA means buying a fixed amount regularly (weekly/monthly) regardless of price. It removes emotion and timing stress. Time in the market beats timing the market!",
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
      answer: "Here's the most powerful stat in all of finance, {name}: NO ONE who has bought Bitcoin and held for 4+ years has EVER lost money. 📈🦌 Not once in Bitcoin's 15+ year history! The strategy from our Investment channel is simple: lump sum what you can afford, then DCA (dollar cost average) daily or weekly, and HODL for at least 4 years through one full cycle. History AND math prove this works. Bitcoin has a fixed supply and growing demand — the long-term trend is inevitable. As our channel says: 'Don't plan on selling for at least 10 years.' Your future self will thank you! 🧡",
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
];

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
    { pattern: /movie|film|netflix|tv show|series|watch|anime|manga/,
      answers: [
        "I don't watch TV, but I hear there are some great Bitcoin documentaries! 🎬🦌 Check our Movies & TV channel. Got a Bitcoin question I can help with?",
        "My favorite movie? 'The Big Short' — because it shows exactly why Bitcoin was created! 🎬 Want to know about the financial crisis that inspired Bitcoin?"
    ]},
    { pattern: /sport|football|soccer|basketball|baseball|nfl|nba|super bowl|world cup|game score/,
      answers: [
        "I'm more of a 'watch the hashrate' kind of deer than a sports fan! 📊🦌 But Bitcoin and game theory actually have a lot in common — want to hear about that?",
        "The only score I track is the block height, {name}! ⛓️ Sports aren't my thing, but Bitcoin strategy IS. What would you like to learn?"
    ]},
    { pattern: /car|drive|vehicle|truck|motorcycle|engine|tire|mechanic|tesla/,
      answers: [
        "I've got four hooves — no need for wheels! 🦌 But fun fact: you CAN buy a car with Bitcoin. Want to learn about where you can spend sats?",
        "No car talk here, {name}! But if you're thinking about investments, ask me why Bitcoiners say 'stay humble, stack sats' instead of buying depreciating assets. 🧡"
    ]},
    { pattern: /school|homework|class|teacher|exam|study|university|college|math class|science class/,
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
    { pattern: /stock|stocks|stock market|invest in stocks|shares|index fund|s&p|dow jones|nasdaq|dividend/,
      answers: [
        "Stocks? I'm a Bitcoin deer, {name}! 🦌📈 But here's a fun comparison: Bitcoin has outperformed every stock index over any 4+ year period in its history. Want to know why?",
        "The stock market is denominated in depreciating dollars — Bitcoin fixes that! 🦌 Want to learn about why Bitcoiners think differently about money?"
    ]},
    { pattern: /gold|silver|precious metal|commodity|commodities/,
      answers: [
        "Gold was money for thousands of years — but Bitcoin does everything gold does, better! 🥇🦌 It's scarcer (21M cap), more portable, more divisible, and verifiable in seconds. Want to hear the full comparison?",
        "Gold bugs and Bitcoiners actually agree on a lot! Sound money, scarcity, distrust of central banks. 🦌 Bitcoin just takes it further. Want to learn about the Bitcoin Standard?"
    ]},
    { pattern: /real estate|house|housing|property|mortgage|rent/,
      answers: [
        "Housing prices look high because the dollar keeps losing value — that's inflation! 🏠🦌 Bitcoin fixes that. Want to understand how inflation steals your savings?",
        "Fun fact: more and more Bitcoiners are buying homes with their gains! 🦌🏡 But the real question is — do you understand WHY Bitcoin keeps outperforming real estate? Ask me!"
    ]},
    { pattern: /nft|nfts|web3|metaverse|defi|yield farm|token|tokenomics|rug pull/,
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
    { pattern: /tell me about (?!bitcoin|btc|nacho|lightning|mining|wallet|seed|halving|satoshi|blockchain|node)/,
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

function findAnswer(input) {
    input = input.toLowerCase().trim();
    if (input.length < 2) return null;

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
    if (isCurrentEventQuestion(input)) return null;

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
            kbContext: kbContext
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
        html += '<button onclick="if(typeof go===\'function\')go(\'' + match.channel + '\');hideBubble();" style="width:100%;margin-top:10px;padding:8px;background:var(--accent-bg,rgba(247,147,26,0.1));border:1px solid #f7931a;border-radius:8px;color:#f7931a;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">📖 Read more: ' + match.channelName + ' →</button>';
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
        var _otMsgId = 'nb_' + Date.now();
        textEl.innerHTML = '<div style="color:var(--text,#eee);line-height:1.6;">' + otAnswer + '</div>' +
            nachoRatingHtml(_otMsgId) +
            '<button onmousedown="event.stopPropagation();" ontouchstart="event.stopPropagation();" onclick="event.stopPropagation();showNachoInput()" style="width:100%;margin-top:10px;padding:8px;background:var(--accent-bg,rgba(247,147,26,0.1));border:1px solid #f7931a;border-radius:8px;color:#f7931a;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">Ask a Bitcoin question 🦌</button>';
        if (typeof nachoPlaySound === 'function') nachoPlaySound('pop');
        if (typeof trackNachoInteraction === 'function') trackNachoInteraction();
        nachoTrackTopic(q, 'offtopic');
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
                    var _ceMsgId = 'nb_' + Date.now();
                    nachoTrackTopic(q, 'websearch');
                    var html = '<div style="color:var(--text,#eee);line-height:1.6;">' +
                        '<div style="font-size:0.7rem;color:var(--text-faint,#666);margin-bottom:6px;">🌐 Here\'s what I found:</div>';
                    for (var ri = 0; ri < results.length; ri++) {
                        html += '<div style="margin-bottom:8px;padding:8px;background:var(--card-bg,#111);border:1px solid var(--border,#333);border-radius:8px;">' +
                            '<div style="font-size:0.8rem;font-weight:600;color:var(--heading,#fff);margin-bottom:2px;">' + (escapeHtml(results[ri].title)) + '</div>' +
                            '<div style="font-size:0.75rem;color:var(--text-muted,#aaa);margin-bottom:4px;">' + (escapeHtml(results[ri].snippet)) + '</div>' +
                            (results[ri].url && sanitizeUrl(results[ri].url) ? '<a href="' + sanitizeUrl(results[ri].url) + '" target="_blank" rel="noopener" style="font-size:0.7rem;color:#f7931a;">Read more →</a>' : '') +
                            '</div>';
                    }
                    html += '</div>' + nachoRatingHtml(_ceMsgId);
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
                    var _aiMsgId = 'nb_' + Date.now();
                    nachoTrackTopic(q, 'ai');
                    var html = '<div style="color:var(--text,#eee);line-height:1.6;">' +
                        '<div style="font-size:0.7rem;color:var(--text-faint,#666);margin-bottom:4px;">🧠 Nacho AI:</div>' +
                        escapeHtml(aiAnswer) + '</div>' + nachoRatingHtml(_aiMsgId);
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
                var _wsMsgId = 'nb_' + Date.now();
                nachoTrackTopic(q, 'websearch');
                var html = '<div style="color:var(--text,#eee);line-height:1.6;">' +
                    '<div style="font-size:0.7rem;color:var(--text-faint,#666);margin-bottom:6px;">🌐 Here\'s what I found online:</div>';
                for (var ri = 0; ri < results.length; ri++) {
                    html += '<div style="margin-bottom:8px;padding:8px;background:var(--card-bg,#111);border:1px solid var(--border,#333);border-radius:8px;">' +
                        '<div style="font-size:0.8rem;font-weight:600;color:var(--heading,#fff);margin-bottom:2px;">' + (escapeHtml(results[ri].title)) + '</div>' +
                        '<div style="font-size:0.75rem;color:var(--text-muted,#aaa);margin-bottom:4px;">' + (escapeHtml(results[ri].snippet)) + '</div>' +
                        (results[ri].url && sanitizeUrl(results[ri].url) ? '<a href="' + sanitizeUrl(results[ri].url) + '" target="_blank" rel="noopener" style="font-size:0.7rem;color:#f7931a;">Read more →</a>' : '') +
                        '</div>';
                }
                html += '</div>' + nachoRatingHtml(_wsMsgId);
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
    nachoTrackTopic(q, 'fallback');
    nachoTrackMiss(q);
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

    // ---- STEP 2: Detect context ----
    var isFinAdvice = isFinancialAdvice(q);
    var disclaimer = isFinAdvice ? '<br><br><div style="font-size:0.7rem;color:var(--text-faint);font-style:italic;">⚠️ Nacho is not a financial advisor. Always do your own research.</div>' : '';
    var isCurrentEvent = isCurrentEventQuestion(q);

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
                    callback({ type: 'kb', answer: pq(kbMatch.answer) + disclaimer, channel: kbMatch.channel, channelName: kbMatch.channelName });
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
                callback({ type: 'kb', answer: pq(kbMatch.answer) + disclaimer, channel: kbMatch.channel, channelName: kbMatch.channelName });
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
        callback({ type: 'kb', answer: pq(kbMatch.answer) + disclaimer, channel: kbMatch.channel, channelName: kbMatch.channelName });
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
