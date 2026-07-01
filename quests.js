const QUESTION_BANK = {
    "whitepaper": [
        { q: "When was the Bitcoin Whitepaper published?", a: "October 31, 2008", wrong: ["January 3, 2009", "March 15, 2007", "December 25, 2010"] },
        { q: "How many pages of text is the Bitcoin Whitepaper?", a: "8 pages", wrong: ["20 pages", "50 pages", "2 pages"] },
        { q: "The Whitepaper was published on:", a: "A cryptography mailing list", wrong: ["A Bitcoin development forum", "A computer science journal", "A private university server"] },
        { q: "What is the title of the Bitcoin Whitepaper?", a: "Bitcoin: A Peer-to-Peer Electronic Cash System", wrong: ["Digital Gold: A New Decentralized Monetary System", "Cryptocurrency: The Future of Digital Finance", "Blockchain: A Technology for Electronic Commerce"] },
        { q: "The Whitepaper proposed a solution to:", a: "The double-spending problem", wrong: ["The network latency problem", "The identity theft problem", "The data corruption problem"] },
        { q: "Who is credited as the author of the Whitepaper?", a: "Satoshi Nakamoto", wrong: ["Vitalik Buterin", "Craig S. Wright", "Gavin Andresen"] },
        { q: "The Whitepaper describes Bitcoin as:", a: "A peer-to-peer electronic cash system", wrong: ["A digital payment network run by banks", "A decentralized global stock exchange", "A decentralized social payment platform"] },
        { q: "What concept does the Whitepaper use to timestamp transactions?", a: "A chain of hashed blocks", wrong: ["A trusted notary system", "A central server clock", "A public key directory"] },
        { q: "The Bitcoin whitepaper solved what previously unsolvable problem?", a: "Digital scarcity without a trusted third party", wrong: ["Instant payments without any processing delays", "Quantum-proof encryption for all financial data", "Free global transfers without any intermediary"] },
        { q: "What did Satoshi embed in the Genesis Block's coinbase transaction?", a: "A newspaper headline about bank bailouts", wrong: ["A cryptographic puzzle for early miners", "A private note to the early Bitcoin team", "A list of early Bitcoin wallet addresses"] }
    ],
    "decentralized": [
        { q: "How many people are \"in charge\" of Bitcoin?", a: "No one", wrong: ["Satoshi Nakamoto", "A board of directors", "The Bitcoin Foundation"] },
        { q: "What is needed for code updates to Bitcoin?", a: "Deep consensus from the network", wrong: ["Miner approval alone suffices", "Developer committee approval", "Permission from founding nodes"] },
        { q: "Bitcoin is described as:", a: "A protocol, not a company", wrong: ["A company based in Japan", "A government-run project", "A private bank consortium"] },
        { q: "Bitcoin nodes are run by:", a: "Anyone who wants to, worldwide", wrong: ["Only licensed miners worldwide", "Only certified node operators", "Only nodes inside the EU region"] },
        { q: "If one country shuts down all Bitcoin mining:", a: "The network continues in other countries", wrong: ["Bitcoin stops working in all countries", "All remaining coins become inaccessible", "The chain halts until operations resume"] },
        { q: "Bitcoin has no:", a: "Central point of failure", wrong: ["Mining reward mechanism", "Fixed total supply limit", "Public transaction record"] },
        { q: "Decentralization means:", a: "No single entity controls the network", wrong: ["One organization controls its rules", "Developers approve all code changes", "A central committee controls supply"] },
        { q: "What happens to Bitcoin if one country bans it?", a: "The network continues operating globally since no single country controls it", wrong: ["Bitcoin stops working in that country but keeps running in all other places", "All nodes globally shut down temporarily while other nations handle the ban", "Mining pools worldwide pause until regulators in other countries approve it"] },
        { q: "How many Bitcoin full nodes are estimated to run worldwide?", a: "Tens of thousands across dozens of countries", wrong: ["Fewer than a thousand across North America", "One per major city in the developed world", "Only certified mining companies run nodes"] },
        { q: "Why is geographic distribution of nodes important?", a: "It prevents any single jurisdiction from shutting down the network", wrong: ["It ensures Bitcoin transactions can be processed more efficiently", "It allows miners to reduce their overall electricity consumption", "It automatically increases the block size when network demand rises"] }
    ],
    "scarce": [
        { q: "What is the maximum supply of Bitcoin?", a: "21 million", wrong: ["100 million", "1 billion", "Unlimited"] },
        { q: "How many Bitcoin are estimated to be lost forever?", a: "2-3 million", wrong: ["4-5 million", "10 million", "Over 500,000"] },
        { q: "Bitcoin's code is:", a: "Open source and auditable by anyone", wrong: ["Proprietary and closed to the public", "Only visible to licensed developers", "Controlled by the core developer team"] },
        { q: "What event cuts Bitcoin's new supply in half?", a: "The halving", wrong: ["The rebase", "The rollback", "The snapback"] },
        { q: "How often does the halving occur?", a: "Approximately every 4 years", wrong: ["Every two to three years", "Roughly once per decade as defined by Bitcoin consensus rules enforced by all full nodes", "Once every three months as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "Bitcoin is often compared to which precious metal?", a: "Gold", wrong: ["Silver", "Platinum", "Copper"] },
        { q: "The last Bitcoin will be mined around the year:", a: "2140", wrong: ["2030", "2050", "2025"] },
        { q: "Bitcoin scarcity is enforced by:", a: "Math and code", wrong: ["Government regulations", "A central bank", "Mining companies"] },
        { q: "What is the smallest unit of Bitcoin called?", a: "A satoshi (0.00000001 BTC)", wrong: ["A millibit (0.001 BTC) as defined by Bitcoin consensus rules enforced by all full nodes", "A nanobit (0.0000001 BTC)", "A microbit (0.000001 BTC)"] },
        { q: "How does Bitcoin's stock-to-flow ratio compare to gold after the 2024 halving?", a: "Bitcoin's stock-to-flow surpassed gold's", wrong: ["Gold's stock-to-flow still exceeds Bitcoin's", "Both gold and Bitcoin share the same ratio", "The model only applies to mined commodities"] }
    ],
    "secure": [
        { q: "Bitcoin has been under attack since gaining significant value around:", a: "2013", wrong: ["2020", "2009", "2017"] },
        { q: "How many potential Bitcoin wallets exist?", a: "2^160", wrong: ["21 million", "A few billion", "2^16"] },
        { q: "Bitcoin's monetary policy is:", a: "Set in stone and immutable", wrong: ["Changed annually by miners", "Voted on by mining pools", "Adjusted for market demand"] },
        { q: "A 51% attack would require:", a: "More computing power than the rest of the network combined", wrong: ["A signed approval from the core Bitcoin development team", "Hacking one of the computers that keeps the Bitcoin ledger", "A valid government authorization and legal court approval"] },
        { q: "Bitcoin has experienced how many hours of downtime since 2013?", a: "Zero", wrong: ["Hundreds", "A few days each year", "One week"] },
        { q: "Bitcoin uses which hashing algorithm?", a: "SHA-256", wrong: ["SHA-512", "Scrypt", "BLAKE2"] },
        { q: "The cost to attack Bitcoin's network is:", a: "Billions of dollars", wrong: ["A few hundred dollars", "Free as defined by Bitcoin consensus rules enforced by all full nodes", "A few thousand dollars"] },
        { q: "What is Bitcoin's uptime percentage since launch in 2009?", a: "Over 99.98% - virtually no downtime", wrong: ["About 95% uptime since its launch", "Around 80% due to repeated attacks", "Exactly 100% with no downtime at all"] },
        { q: "Why does higher hashrate make Bitcoin more secure?", a: "More computational power means an attacker needs proportionally more resources to overpower the network", wrong: ["More hashing power enables any miner with enough resources to generate Bitcoin beyond the supply limit", "Greater hashrate automatically reduces the time between blocks so transactions settle in under a minute", "Higher hashrate means the network can process more transactions and miners earn significantly more fees"] },
        { q: "What makes a 51% attack on Bitcoin impractical?", a: "The enormous cost of acquiring more mining power than all honest miners combined", wrong: ["Satoshi Nakamoto holds a private master key that allows reversal of any attack", "Governments actively monitor mining pools and prosecute suspicious attacks", "A built-in cryptographic firewall automatically rejects suspicious transactions"] }
    ],
    "money": [
        { q: "How many satoshis are in one Bitcoin?", a: "100,000,000", wrong: ["1,000,000", "10,000,000", "50,000,000"] },
        { q: "Bitcoin payments are compared to:", a: "Email - anyone with your address can send", wrong: ["Phone call - both parties must be online at the same time", "Postal mail - delivery requires a verified physical address", "Fax machine - both sender and receiver need compatible hardware"] },
        { q: "Bitcoin's distribution was fair because:", a: "There was no premine", wrong: ["A company sold coins early", "The government distributed it", "Only miners got coins"] },
        { q: "A satoshi is named after:", a: "Bitcoin's creator, Satoshi Nakamoto", wrong: ["A famous Japanese cryptography professor", "The creator of an early digital cash system", "A senior engineer at the Bank of Japan"] },
        { q: "Bitcoin is divisible to how many decimal places?", a: "8", wrong: ["2", "4", "16"] },
        { q: "Bitcoin can function as:", a: "A store of value, medium of exchange, and unit of account", wrong: ["A payment rail only, not designed for long-term storage or savings", "A speculative asset only, lacking any formal monetary properties", "A store of value only, not usable as a medium of daily exchange"] },
        { q: "What makes Bitcoin \"sound money\"?", a: "Fixed supply and predictable issuance", wrong: ["Government mandate and legal tender status", "Central bank oversight with regulated supply limits", "Corporate backing and independent third-party reserve audits"] },
        { q: "Which property of money does Bitcoin's 21 million cap satisfy?", a: "Scarcity - it cannot be inflated or debased", wrong: ["Acceptability - it must be accepted by all merchants worldwide", "Portability - it weighs nothing and requires no physical storage", "Fungibility - each coin carries a unique traceable history on-chain"] },
        { q: "Why are satoshis important for Bitcoin as money?", a: "They allow micropayments and make Bitcoin divisible enough for everyday transactions", wrong: ["They were created to let Bitcoin expand its total supply beyond 21 million coins", "They represent a separate altcoin that operates alongside the main Bitcoin network", "They are only valid on Layer 2 networks and cannot be spent in on-chain transactions"] },
        { q: "What gives Bitcoin its monetary value according to Austrian economics?", a: "Subjective value from its useful properties: scarcity, portability, divisibility, and censorship resistance", wrong: ["Objective intrinsic worth assigned by states through legal tender laws, taxation, and central bank monetary decrees", "Its backing in gold and commodity reserves held by central banks, giving each token a tangible collateral floor", "The total electrical energy consumed in mining, which provides each coin a measurable cost-of-production baseline"] }
    ],
    "peaceful": [
        { q: "When China banned Bitcoin:", a: "Bitcoin just moved and kept going", wrong: ["Bitcoin immediately shut down across all mining pools worldwide", "Bitcoin's price collapsed all the way to zero permanently", "All miners erased the source code and abandoned the network"] },
        { q: "What happened to Bitcoin transactions during the 2021 China mining ban?", a: "The network kept running - hash rate dipped then recovered within months", wrong: ["Transactions slowed severely as hash rate took over a year to fully recover", "The difficulty adjustment failed and blocks stopped confirming for several weeks", "The network split into two chains — one with and one without Chinese nodes"] },
        { q: "Bitcoin enables protest by:", a: "Allowing people to transact without government permission", wrong: ["Enabling activists to flood government payment portals with traffic", "Letting dissidents publish untraceable encrypted messages to the state", "Allowing programmers to hack and expose corrupt central bank systems"] },
        { q: "Bitcoin is called \"peaceful\" because:", a: "It opts out of the existing system without force", wrong: ["It forces corrupt central banks to reform by draining their reserves", "It distributes wealth equally among all participants over time", "It prevents all violence by monitoring every global transaction"] },
        { q: "Bitcoin helps people in authoritarian regimes by:", a: "Providing censorship-resistant money", wrong: ["Helping insurgent groups to seize state banking institutions", "Allowing authoritarian governments to track dissidents online", "Letting citizens mint and spend unlimited local digital coins"] },
        { q: "Bitcoin adoption is described as:", a: "Voluntary and organic", wrong: ["Mandatory and forced", "Government-mandated", "Corporate-controlled"] },
        { q: "How does Bitcoin function as a peaceful protest tool?", a: "It allows people to opt out of inflationary monetary systems without violence", wrong: ["It provides anonymous funding to protest and activist organizations worldwide", "It disables government financial websites by routing encrypted protest traffic", "It replaces traditional voting systems with a cryptographically secured ballot"] },
        { q: "Why is Bitcoin described as \"opt-in\" money?", a: "Nobody is forced to use it - participation is entirely voluntary", wrong: ["You must register with a licensed exchange before you can hold any Bitcoin", "Governments automatically assign a starting Bitcoin wallet to every new citizen", "You are required to run a full mining node before being allowed to spend coins"] },
        { q: "How did Bitcoin help protestors in authoritarian regimes?", a: "It allowed them to receive donations that could not be frozen by the government", wrong: ["It gave activists free and unrestricted access to the public internet worldwide", "It created anonymous digital identity documents that could replace national passports", "It provided a fully encrypted messaging service immune to government wiretapping"] },
        { q: "What makes Bitcoin \"permissionless\"?", a: "Anyone can send, receive, or hold Bitcoin without needing approval from any authority", wrong: ["You must first obtain a government-issued license before you are permitted to own Bitcoin", "Only wallets that have been explicitly approved by a licensed exchange are allowed to transact", "Each transaction must receive manual approval from the mining pool nearest to the sender"] }
    ],
    "dominant": [
        { q: "∞/21M means:", a: "All world wealth funneling into 21 million coins", wrong: ["Bitcoin has no supply cap and new coins can be issued indefinitely", "There are infinite users all competing for an equal share of coins", "Each of the 21 million coins exists on its own independent blockchain"] },
        { q: "Bitcoin's growth pattern resembles:", a: "A J-shaped curve", wrong: ["A straight trend line", "A symmetric bell curve", "A long flat plateau"] },
        { q: "Bitcoin is said to change you by:", a: "Lowering your time preference", wrong: ["Making you overnight very wealthy", "Increasing your urge to spend today", "Having no real effect on behavior"] },
        { q: "Bitcoin's market dominance refers to:", a: "Its share of total cryptocurrency market cap", wrong: ["The total number of active users across all its wallets", "The average speed at which it confirms new transactions", "The maximum data size allowed in each individual block"] },
        { q: "Bitcoin's ∞/21M meme represents:", a: "All the world's wealth eventually stored in a 21M coin supply", wrong: ["Bitcoin has no hard supply cap and new coins are issued indefinitely", "An unlimited number of users each receive equal daily block rewards", "There are countless competing blockchains all processing the same payments"] },
        { q: "Bitcoin is considered dominant because:", a: "It has the strongest network effect and security", wrong: ["It launched first and was available at the very lowest price", "A coalition of central banks officially selected it as a reserve", "It has more programmable smart contract features than competitors"] },
        { q: "What is the \"Lindy effect\" as applied to Bitcoin's dominance?", a: "The longer Bitcoin survives and grows, the more likely it is to continue dominating", wrong: ["Old legacy technology always fails eventually as newer and faster alternatives emerge to replace it", "Bitcoin's market dominance naturally decreases each year as newer competing chains attract more users", "The Lindy effect only applies to physical goods with a tangible form factor, not to digital protocols"] },
        { q: "Why do network effects favor Bitcoin over altcoins?", a: "More users, miners, developers, and infrastructure create a self-reinforcing cycle that's hard for competitors to match", wrong: ["Bitcoin simply had the largest early marketing budget, backed by venture capital and high-profile celebrity endorsements", "Altcoins are prohibited in most jurisdictions, which prevents them from attracting developers and institutional capital", "Network effects apply only to social media platforms and cannot meaningfully transfer to monetary networks like Bitcoin"] },
        { q: "What does Bitcoin's \"dominance\" metric measure?", a: "Bitcoin's share of total cryptocurrency market capitalization", wrong: ["The total number of Bitcoin full nodes relative to all altcoin nodes combined", "Bitcoin's fraction of all global cryptocurrency mining hash rate output", "The percentage of worldwide merchants and retailers currently accepting Bitcoin"] },
        { q: "Why has no altcoin overtaken Bitcoin despite thousands of attempts?", a: "Bitcoin's first-mover advantage, network effects, decentralization, and brand recognition create an insurmountable moat", wrong: ["Governments around the world have enacted laws specifically designed to protect Bitcoin and block altcoin competition", "All alternative cryptocurrencies are deliberate scams built on copied code with no genuine utility or use case", "Satoshi Nakamoto retains secret admin access and uses it to prevent any competing hard fork from gaining traction"] }
    ],
    "use-cases": [
        { q: "Bitcoin is described as better than gold because:", a: "It can be sent across the planet instantly", wrong: ["It weighs more than gold making it much harder to transport safely", "It looks shinier than silver coins and is far more visually appealing", "Its price is fully backed by physical gold reserves held in a vault"] },
        { q: "How do Bitcoin remittance fees compare to Western Union?", a: "Much cheaper, nearly free", wrong: ["About the same as a wire fee", "Slightly more expensive overall", "Nearly double the standard fee"] },
        { q: "Credit card merchants pay about what fee?", a: "3%", wrong: ["0%", "10%", "25%"] },
        { q: "Bitcoin can help the unbanked because:", a: "You only need a phone and internet to use it", wrong: ["Local banks distribute it to customers who pass basic identity checks", "The government issues it for free to citizens who hold a valid national ID", "Users must pass a credit check and hold a valid bank account to access it"] },
        { q: "Bitcoin as a hedge against inflation means:", a: "Its fixed supply protects purchasing power", wrong: ["Its price only ever rises and can never fall below its prior value", "The government legally guarantees its minimum exchange rate in dollars", "It pays a fixed annual interest rate like a government savings bond"] },
        { q: "Micropayments on Bitcoin are possible through:", a: "The Lightning Network", wrong: ["The Visa payment network", "PayPal instant transfers", "Bank wire transfer rails"] },
        { q: "Bitcoin enables financial sovereignty by:", a: "Letting you be your own bank", wrong: ["Requiring a licensed bank account", "Needing government-issued identification", "Using a third-party credit system"] },
        { q: "Why is Bitcoin especially valuable for international remittances?", a: "It settles in minutes with low fees compared to days and high fees with traditional wire transfers", wrong: ["It automatically converts to the recipient's local currency using real-time exchange rate data", "Banks around the world process Bitcoin-based remittances instantly with no service or transfer fees", "It works completely offline using encrypted Bluetooth so transfers complete without needing internet"] },
        { q: "How does Bitcoin serve as a \"savings technology\"?", a: "Its fixed supply and deflationary nature preserve purchasing power over time", wrong: ["It pays variable interest rates, just like high-yield bank savings accounts do", "Government-backed deposit insurance guarantees the value of all Bitcoin holdings", "Bitcoin is programmed to automatically increase in value by exactly 10% every year"] },
        { q: "What makes Bitcoin useful for micropayments via Lightning?", a: "Sub-penny transaction fees and instant settlement enable payments too small for traditional systems", wrong: ["The Lightning Network fully replaces Bitcoin on-chain and operates as a completely separate chain", "All micropayments regardless of size must still be processed directly on the main blockchain ledger", "Lightning channels only process payments that exceed one US dollar, filtering out tiny transactions"] }
    ],
    "mining": [
        { q: "What do miners do?", a: "Secure the network and process transactions", wrong: ["Create Bitcoin by approving and validating new transactions", "Print digital money for the broader payment network", "Erase old or outdated transactions to maintain the ledger"] },
        { q: "Miners are paid in:", a: "New Bitcoin and transaction fees", wrong: ["US dollars and government bonds", "Ethereum and other altcoin tokens", "Company stock and equity options"] },
        { q: "Mining difficulty adjusts approximately every:", a: "2 weeks (2016 blocks)", wrong: ["Every day (144 blocks)", "Each hour (6 new blocks)", "Each month (4,320 blocks)"] },
        { q: "A mining pool is:", a: "A group of miners combining computing power", wrong: ["A shared server for pooling and distributing rewards", "A single powerful dedicated mining computer", "A government-regulated mining operation facility"] },
        { q: "The mining reward after the 2024 halving is:", a: "3.125 BTC per block", wrong: ["6.25 BTC per block", "50.0 BTC per block", "12.5 BTC per block"] },
        { q: "ASIC miners are:", a: "Specialized hardware designed only for mining", wrong: ["Standard laptops with mining software installed", "Gaming computers adapted for mining operations", "Smartphones modified with extra processing power"] },
        { q: "What prevents miners from cheating?", a: "Other nodes verify their work", wrong: ["An honor system among all miners", "Government oversight prevents it", "Nothing prevents cheating miners"] },
        { q: "What milestone did Bitcoin hash rate reach in September 2025?", a: "1 Zettahash per second", wrong: ["500 Exahash per second", "10 Petahash per second", "100 Terahash per second"] },
        { q: "Pleb Pool and Atlas Pool are examples of:", a: "Solo Bitcoin mining pools", wrong: ["Bitcoin Lightning wallets", "Centralized Bitcoin exchanges", "Hardware-based cold wallets"] },
        { q: "D-Central Technologies specializes in:", a: "Home mining equipment and support", wrong: ["Bitcoin day trading and arbitrage", "Lightning routing and channel management", "Hardware cold storage and backup"] },
        { q: "Constellation Heating combines mining with:", a: "Heating swimming pools", wrong: ["Cooling server data centers", "Generating wind power", "Installing solar panels"] },
        { q: "What is a \"nonce\" in Bitcoin mining?", a: "A \"number used once\" that miners change to find a valid hash", wrong: ["A specialized type of ASIC mining hardware chip used in rigs", "A small transaction fee paid by miners directly to network nodes", "The total fixed number of Bitcoins that will ever be mined"] },
        { q: "Mining pools allow small miners to:", a: "Receive more frequent, smaller payouts", wrong: ["Gain more control over the network", "Mine Bitcoin with no electricity use", "Vote to change the Bitcoin supply cap"] },
        { q: "Bitcoin difficulty adjusts every how many blocks?", a: "2,016 blocks (roughly 2 weeks)", wrong: ["210,000 blocks (roughly 4 years)", "Only when a halving event occurs", "After every individual block mined"] },
        { q: "Bitcoin mining is best described as:", a: "A brute-force lottery of guessing nonces until a valid hash is found", wrong: ["Solving complex cryptographic equations using advanced mathematical formulas", "Running an algorithm that successfully factors large semi-prime numbers quickly", "Decrypting encoded transaction data in each block using a private key"] },
        { q: "What happens when a miner finds a valid block hash?", a: "They broadcast the block to the network, collect the block reward and transaction fees", wrong: ["They must submit the block to a government regulator for review before it can be added", "The newly found block gets sent to Satoshi's node for final cryptographic verification", "All other competing miners must immediately cease operations and restart their hardware"] },
        { q: "Why does Bitcoin mining use so much energy?", a: "Energy expenditure is what gives Bitcoin its security - it makes attacks prohibitively expensive", wrong: ["Bitcoin's original source code was never fully optimized, resulting in unnecessary energy waste", "All commercial miners are legally required by regulators to operate hardware continuously nonstop", "Each individual Bitcoin transaction requires a dedicated mining operation to confirm and finalize"] },
        { q: "What is \"hash rate\" in Bitcoin mining?", a: "The total computational power being used to process transactions and secure the network", wrong: ["The speed at which brand new Bitcoins are printed and added to the circulating supply", "The rate at which old or invalid transactions are removed from the blockchain ledger", "The precise real-time number of all active Bitcoin miners running equipment at once"] },
        { q: "What is \"stranded energy\" and why do Bitcoin miners seek it?", a: "Energy produced in remote locations with no local demand - miners can monetize it at low cost", wrong: ["Energy pre-stored in large industrial battery banks for use during peak demand periods", "Solar energy that goes unused because panels generate far more than the local grid absorbs", "Power sourced exclusively from decommissioned plants that have been permanently shut down"] },
        { q: "What is a mining \"share\" in a pool?", a: "Proof that a miner contributed valid work toward finding a block, used to split rewards proportionally", wrong: ["An ownership stake in the mining company entitling the holder to dividends and future profit sharing", "A fractional Bitcoin automatically sent to the miner's wallet after each successful hash attempt", "A governance vote granting miners the right to decide which pending transactions get added to blocks"] },
        { q: "What does Stratum V2 allow individual miners to do that Stratum V1 does not?", a: "Choose their own transactions for block templates", wrong: ["Mine without needing any internet connection", "Bypass the network difficulty adjustment algorithm", "Mine multiple different coins at the same time"] },
        { q: "What is a block template in Bitcoin mining?", a: "A candidate block with selected transactions awaiting a valid hash", wrong: ["A technical design blueprint for building specialized ASIC hardware chips", "A complete offline backup copy of the entire Bitcoin blockchain ledger", "A configuration template for setting up new mining pool infrastructure"] },
        { q: "What is a selfish mining attack?", a: "Withholding discovered blocks to gain an unfair chain advantage", wrong: ["Refusing to share all earned mining rewards with fellow pool members", "Mining only low-fee transactions for the miner's personal gain", "Using stolen electricity to illegally power Bitcoin mining rigs"] },
        { q: "What is ASICBoost?", a: "A technique that optimizes SHA-256 to reduce energy per hash", wrong: ["A specific brand of mining hardware manufactured by Bitmain", "A firmware update that automatically doubles any miner's hashrate", "A method to cool ASIC miners using advanced liquid nitrogen"] },
        { q: "What is the difference between overt and covert ASICBoost?", a: "Overt is visible in block headers; covert is hidden from view", wrong: ["Overt is legal in all jurisdictions while covert is illegal", "Overt uses significantly more energy per hash than covert does", "Overt works on any ASIC while covert is Bitmain hardware only"] },
        { q: "What is \"hash price\" in Bitcoin mining economics?", a: "Revenue earned per unit of hash rate per day", wrong: ["The cost to purchase a single ASIC mining unit", "Bitcoin's spot price divided by the global hash rate", "Electricity price charged per unit of hash rate"] },
        { q: "What typically happens to less efficient miners shortly after a Bitcoin halving?", a: "They become unprofitable and may shut down", wrong: ["They automatically receive double the reward", "Their hash rate doubles to compensate", "They permanently switch to mining altcoins"] },
        { q: "What is the typical operational lifespan of an ASIC miner before it becomes obsolete?", a: "Approximately 3 to 5 years", wrong: ["About 6 months on average", "Over 20 years with maintenance", "Exactly one halving cycle"] },
        { q: "What is the breakeven electricity cost for Bitcoin mining?", a: "The kWh price where revenue equals costs", wrong: ["A fixed rate set by Bitcoin core developers", "The average global electricity cost across regions", "The minimum wattage needed to run one ASIC miner"] },
        { q: "As block subsidies decrease over time, what must replace them to incentivize miners?", a: "Transaction fees paid by users", wrong: ["Government subsidies for miners", "Increased mining difficulty", "New coins from hard forks as defined by Bitcoin consensus rules enforced by all full nodes"] }
    ],
    "nodes": [
        { q: "Running a node lets you:", a: "Verify transactions independently", wrong: ["Mine new Bitcoin from the network", "Print digital money from your node", "Control the entire Bitcoin network"] },
        { q: "What does it mean to say Bitcoin has \"no leader\"?", a: "No single person or organization controls the protocol rules", wrong: ["Satoshi still controls it anonymously from an undisclosed location", "The Bitcoin Foundation oversees and enforces all protocol changes", "Core developers vote on all protocol upgrades using a majority system"] },
        { q: "A full node stores:", a: "The entire blockchain history", wrong: ["Only your own wallet transactions", "Only the most recent block headers", "Only the current UTXO set data"] },
        { q: "How many Bitcoin nodes exist approximately?", a: "Tens of thousands worldwide", wrong: ["Only a few hundred globally", "Exactly 21 million in total", "One official node per country"] },
        { q: "Running a node requires:", a: "A regular computer with enough storage", wrong: ["A dedicated server-grade machine with special specs", "Official government approval and a registered license", "A specialized mining rig equipped with ASIC hardware"] },
        { q: "Nodes enforce:", a: "The consensus rules of Bitcoin", wrong: ["National financial laws and regulations", "Corporate terms of service and policies", "Community-voted social governance rules"] },
        { q: "Clark Moody dashboard is useful for tracking:", a: "Bitcoin network stats and Knots adoption", wrong: ["Altcoin market prices and trading volumes", "Social media follower counts and engagement", "Email subscriber growth and newsletter stats"] },
        { q: "Matt Hill is the founder and CEO of:", a: "Start9 (node-in-a-box solution)", wrong: ["The Bitcoin Magazine publication", "Coinbase, the largest US exchange", "Blockstream, a major Bitcoin company"] },
        { q: "The Bitcoin Commons governance model proposes:", a: "Coordination without authority for Bitcoin implementations", wrong: ["Centralized planning and scheduling for all Bitcoin protocol upgrades", "A formal voting mechanism for Bitcoin block size and fee decisions", "Mandatory government oversight and compliance for Bitcoin node operators"] },
        { q: "A pruned node saves space by:", a: "Deleting old block data after validating it", wrong: ["Only downloading block headers from network peers", "Offloading stored blocks onto neighboring nodes for free", "Slowing down the rate at which new blocks are accepted"] },
        { q: "A full node is different from a miner because:", a: "It enforces all rules but doesn't create new blocks", wrong: ["It processes transactions significantly faster than a miner does", "It consumes considerably more electricity than a mining node", "It is designed exclusively for experienced developers to operate"] },
        { q: "How does your node know if a transaction is valid?", a: "It checks the signatures and inputs against the consensus rules", wrong: ["It queries a trusted central server for a validation confirmation", "It polls other nodes and uses a majority vote to confirm validity", "It relies on a trusted third-party oracle service to verify inputs"] },
        { q: "What is the main benefit of running your own Bitcoin node?", a: "You verify all transactions and blocks yourself without trusting any third party", wrong: ["You earn small Bitcoin rewards every time your node relays a valid transaction", "You can mine Bitcoin significantly more efficiently using dedicated node software", "You receive faster transaction confirmations by connecting directly to the network"] },
        { q: "What does \"initial block download\" (IBD) mean?", a: "The process of downloading and validating the entire blockchain when first setting up a node", wrong: ["The amount of time required to mine and confirm the very first block on a fresh chain", "The process of downloading the Bitcoin Core software installer and configuring a wallet", "The procedure for synchronizing your personal wallet balance with a trusted exchange server"] },
        { q: "How does a Bitcoin node protect you from accepting fake transactions?", a: "It independently validates every transaction against consensus rules before accepting it", wrong: ["It sends each transaction to Satoshi's known address for manual verification approval", "It queries three randomly selected nodes and requires a majority vote to confirm validity", "It applies machine learning models trained on historical fraud patterns to detect errors"] },
        { q: "What is the key difference between a pruned node and an archival (full) node?", a: "A pruned node deletes old block data after verifying it", wrong: ["A pruned node skips signature verification entirely to reduce load", "An archival node only retains the active UTXO set in fast memory", "A pruned node is unable to validate or relay any newly arriving blocks"] },
        { q: "What does BIP 152 (Compact Block Relay) do?", a: "Sends short transaction IDs instead of full transactions", wrong: ["Compresses entire blockchain history into smaller gzip archive files", "Lets nodes skip certain redundant blocks during the initial sync phase", "Encrypts all block data to ensure privacy between directly peered nodes"] },
        { q: "What is the Erlay protocol designed to improve?", a: "Transaction relay efficiency between nodes", wrong: ["Block mining throughput via nonce optimization techniques", "Lightning Network payment channel balancing and routing", "Wallet synchronization speed for mobile and lightweight devices"] },
        { q: "What is the UTXO set and why does its size matter for nodes?", a: "All unspent outputs nodes must keep in memory for validation", wrong: ["A complete index of every transaction ever confirmed on the blockchain", "A ledger recording every mining reward ever paid out to all miners", "A distributed backup of all wallet private keys held across nodes"] },
        { q: "What is a major concern about running a Bitcoin full node related to bandwidth?", a: "Relaying transactions and blocks uses significant upload bandwidth", wrong: ["Nodes must pay per-megabyte data fees to peers on the network", "Network bandwidth usage drops to near zero after initial block sync", "Only active mining nodes are responsible for consuming upload bandwidth"] },
        { q: "What programming language is Bitcoin Core primarily written in?", a: "C++", wrong: ["Rust", "Python", "Java"] },
        { q: "What is btcd?", a: "An alternative Bitcoin full node written in Go", wrong: ["A Bitcoin desktop wallet application for storing and sending funds", "A command-line mining tool for optimizing Bitcoin hash rate output", "A developer testing and simulation framework built for Bitcoin Core"] },
        { q: "What are reproducible builds in the context of Bitcoin Core?", a: "Anyone can compile source and get an identical binary", wrong: ["A feature that lets Bitcoin Core silently update itself automatically", "A method to quickly restore a node's data from an encrypted backup", "A technique to compile Bitcoin Core faster on recently released CPUs"] },
        { q: "What is Guix used for in Bitcoin Core development?", a: "A build system for reproducible, verifiable builds", wrong: ["A graphical dashboard for running and monitoring a Bitcoin node", "A security auditing tool for scanning code for vulnerabilities", "A package manager for downloading and installing Bitcoin wallets"] },
        { q: "Why is it important to be able to build Bitcoin Core from source?", a: "To verify the code and ensure your binary matches it", wrong: ["Because official pre-built binary releases are not publicly available", "To unlock access to hidden or beta developer-only features in the code", "Because compiling from source produces a more optimized and faster node"] }
    ],
    "pow-vs-pos": [
        { q: "Bitcoin uses which consensus mechanism?", a: "Proof of Work", wrong: ["Proof of Stake", "Proof of Authority", "Proof of Space"] },
        { q: "In Proof of Work, security comes from:", a: "Computational work and electricity", wrong: ["Staking and locking up coins as collateral", "Weighted voting among registered validators", "Government-issued authorization and oversight"] },
        { q: "Proof of Stake has been criticized for:", a: "Favoring wealthy holders (the rich get richer)", wrong: ["Consuming far too much energy and wasting global resources", "Being excessively decentralized and lacking any clear governance", "Being far too slow to handle real-world transaction throughput"] },
        { q: "Proof of Work connects Bitcoin to:", a: "The physical world through energy expenditure", wrong: ["The global stock market through asset price correlation", "Social media networks via community-driven consensus signals", "National government databases and legal financial records"] },
        { q: "In PoW, you can't fake:", a: "The energy spent to mine a block", wrong: ["Your miner's registered identity or username", "Your node's publicly visible IP address", "The exact timestamp recorded in a block"] },
        { q: "Proof of Work was chosen because:", a: "It provides unforgeable costliness", wrong: ["It was the cheapest and simplest option available", "Satoshi had no viable alternatives to consider", "A government mandate specifically required its use"] },
        { q: "What real-world resource does Proof of Work consume that Proof of Stake does not?", a: "Energy (electricity used for computation)", wrong: ["Hard drive storage space and disk capacity", "Internet bandwidth and network data transfer", "RAM memory and active processor compute cycles"] },
        { q: "What is the \"nothing at stake\" problem in Proof of Stake?", a: "Validators can sign multiple competing chain forks at no cost, weakening consensus", wrong: ["Validators immediately lose all their staked tokens each time they try to validate a block", "There is absolutely no block reward ever offered to validators in any Proof of Stake system", "Validators are required to purchase and maintain expensive specialized mining hardware rigs"] },
        { q: "Why do PoW proponents argue it provides stronger security guarantees?", a: "Attacking PoW requires massive ongoing real-world energy expenditure that can't be faked", wrong: ["PoW is more secure because the developer ecosystem is larger and more diversely distributed globally", "PoW confirms transactions much faster, making it harder for attackers to reorganize recent chain history", "PoW has accumulated more battle-testing over its longer history, making its security assumptions well-verified"] },
        { q: "How does Proof of Stake differ from Proof of Work in block producer selection?", a: "PoS selects validators based on the amount of coins they lock up, while PoW requires solving computational puzzles", wrong: ["PoS uses a lottery where validators purchase entry tickets with fiat money to win block production rights", "PoW always awards blocks to whichever miner owns the most hardware, making both systems functionally equivalent", "Both systems rely on the same underlying random selection process; only the energy cost of participation differs"] },
        { q: "Why do Bitcoin advocates argue Proof-of-Work is a stronger security foundation than Proof-of-Stake?", a: "PoW links digital security to real-world energy expenditure — you cannot fake or virtualize the physical cost of mining blocks", wrong: ["PoW uses more electricity, which signals that all participants are financially committed to the network's long-term success", "PoW produces a public record of miner identities so the community can penalize dishonest participants after any attack occurs", "PoW requires specialized hardware purchases that effectively deanonymize miners, creating legal accountability for any attack"] },
        { q: "How are validators selected to produce blocks in a Proof-of-Stake system?", a: "Validators are chosen based on the size of their token stake; those with more tokens staked gain proportionally more block rights", wrong: ["Validators are elected by token-holder votes each epoch and then share block rewards equally with their supporting voters", "Validators are selected by a verifiable random function with absolutely no weighting by stake size or prior token holdings", "Validators are chosen by a committee of existing validators who review each candidate's historical performance and uptime record"] },
        { q: "What is the \"nothing at stake\" problem that affects naive Proof-of-Stake designs?", a: "Validators can vote on multiple competing chain forks simultaneously at zero cost because no real resource is being consumed", wrong: ["Validators can pledge the same tokens to multiple chains at once because there is no on-chain registry of all staked assets", "Validators have no incentive to stay online because the penalty for downtime costs less than the reward for staying connected", "New participants can't accumulate stake because established validators monopolize block production without expending any resources"] },
        { q: "When did Ethereum complete its switch from Proof-of-Work to Proof-of-Stake consensus?", a: "September 2022, in an event called \"The Merge\" that replaced Ethereum's PoW mining with a Proof-of-Stake validator set", wrong: ["March 2021, when the Ethereum Foundation completed deployment of the Beacon Chain mainnet consensus upgrade on schedule", "December 2023, when Ethereum's final sharding upgrade replaced the remaining PoW elements with Proof-of-Stake validation", "June 2020, when Ethereum 2.0 Phase 0 launched and the Proof-of-Work chain was simultaneously deprecated in the upgrade"] },
        { q: "How do the thresholds for a successful attack differ between Bitcoin's PoW and a typical PoS network?", a: "A Bitcoin 51% attack requires over half of total global hashrate; a typical PoS attack requires acquiring over 33% of staked tokens", wrong: ["A PoW attack requires 67% of mining power while PoS needs only 10% of staked capital, making PoS actually more attack-resistant", "Both systems require exactly 51% of their respective resources; the cost difference depends solely on the current token price", "PoW is attacked by controlling 25% of ASIC manufacturers; PoS requires 51% of staked tokens for an equivalent disruption"] },
        { q: "What did Saifedean Ammous write about Proof-of-Work's uniquely fair property in The Bitcoin Standard?", a: "\"PoW is the only mechanism that does not confer explicit power on any subset of participants\" — Saifedean Ammous, The Bitcoin Standard", wrong: ["\"PoW guarantees equal returns on investment for all miners regardless of pool size or geographic cost of electricity access\"", "\"PoW creates a perfectly merit-based network where each participant's contribution is measured objectively by work performed\"", "\"PoW eliminates all insider advantages by requiring every participant to solve the same cryptographic puzzle each block epoch\""] },
        { q: "Does Proof-of-Stake slashing fully resolve the security weaknesses inherent in stake-based consensus?", a: "No — slashing punishes detectable misbehavior but cannot prevent long-range attacks where an attacker rewrites old chain history", wrong: ["Yes — slashing penalizes all forms of validator dishonesty and provides demonstrably stronger security guarantees than PoW mining", "Yes — slashing combined with finality gadgets eliminates all known attack vectors including long-range history rewriting attacks", "No — slashing creates severe centralization pressure by making it prohibitively risky for small validators to run nodes at all"] },
        { q: "What was Bitcoin's approximate network hashrate in the 2024–2025 timeframe?", a: "Over 700 exahashes per second (EH/s), making a successful 51% attack require more hardware than currently exists on Earth", wrong: ["Over 100 exahashes per second (EH/s), a figure comparable to Ethereum's peak PoW hashrate just before The Merge in 2022", "Approximately 200 terahashes per second (TH/s), reflecting the dominance of next-generation 7nm ASIC mining hardware farms", "Around 500 petahashes per second (PH/s), representing roughly 40% annual growth sustained since the May 2020 halving event"] },
        { q: "How does access to Bitcoin mining compare to participation in Proof-of-Stake validation?", a: "Anyone with hardware and cheap electricity can mine Bitcoin; PoS compounds advantages for those who already hold large wealth", wrong: ["Bitcoin mining requires a license from the Bitcoin Foundation; PoS is fully open to anyone willing to make a small token deposit", "Both systems offer equivalent access barriers; entry cost is roughly comparable between mining rigs and major PoS token deposits", "PoS is far more accessible because anyone can stake tiny amounts; Bitcoin mining requires millions of dollars minimum investment"] },
        { q: "What is the fundamental difference in the nature of costs between PoW and PoS security models?", a: "PoW requires external real-world energy cost to attack; PoS only requires internal tokens the attacker may already own and hold", wrong: ["PoW security comes from miner coordination costs; PoS security relies on smart contract audits and formal verification proofs", "PoW security depends on hardware scarcity; PoS security relies entirely on the irreversibility of slashing penalties post-attack", "PoW costs are paid by miners and passed to users through fees; PoS costs are socialized across all token holders proportionally"] }
    ],
    "layer-2-lightning": [
        { q: "Lightning is which layer of Bitcoin?", a: "Layer 2", wrong: ["Layer 1", "Layer 3", "Layer 0"] },
        { q: "Lightning uses what for privacy?", a: "Onion routing", wrong: ["GPS tracking", "Public ledger", "Email verification"] },
        { q: "Opening a Lightning channel is like:", a: "Opening a bar tab", wrong: ["Buying a car as defined by Bitcoin consensus rules enforced by all full nodes", "Getting a loan", "Opening a bank account"] },
        { q: "Lightning transactions are:", a: "Nearly instant and very cheap", wrong: ["Slow and costly like on-chain transactions", "Free to use but take many hours to settle", "Only available for large-value transfers"] },
        { q: "Lightning channels are settled on:", a: "The Bitcoin base layer", wrong: ["The Ethereum mainnet", "A parallel sidechain", "A centralized bank ledger"] },
        { q: "Lightning enables:", a: "Micropayments as small as 1 satoshi", wrong: ["Only large transactions above 0.01 BTC", "Only fiat-backed stablecoin payments", "Only cross-border international payments"] },
        { q: "Lightning capacity refers to:", a: "The total Bitcoin locked in payment channels", wrong: ["The available bandwidth across all network nodes", "The total mining power contributed by active nodes", "The number of active routing nodes on the network"] },
        { q: "Satogram allows you to:", a: "Send messages across the Lightning network", wrong: ["Mine Bitcoin directly using your mobile device", "Create and sell NFTs on the Lightning network", "Swap altcoins using Lightning-backed atomic swaps"] },
        { q: "Lightning Cats and Lightning Goats let you:", a: "Feed real animals using Lightning payments", wrong: ["Trade collectible animal-themed NFTs for sats", "Use animal activity to generate Bitcoin mining power", "Buy and adopt real pets with on-chain Bitcoin payments"] },
        { q: "Pay With Flash is a service for:", a: "Businesses to accept Bitcoin payments", wrong: ["Miners to earn Bitcoin using solar energy", "Users to securely store Bitcoin offline", "Users to mix coins for enhanced privacy"] },
        { q: "LNgigs is a Bitcoin-powered:", a: "Freelance marketplace", wrong: ["Bitcoin mining pool", "Cryptocurrency exchange", "Hardware wallet vendor"] },
        { q: "The Lightning Network whitepaper was written by:", a: "Joseph Poon and Thaddeus Dryja", wrong: ["Satoshi Nakamoto and Hal Finney", "Vitalik Buterin and Gavin Wood", "Adam Back and Gregory Maxwell"] },
        { q: "Lightning Network payment channels work by:", a: "Opening a channel with an on-chain transaction, then transacting off-chain instantly", wrong: ["Creating a dedicated sidechain for each payment pair that merges back into Bitcoin after closure", "Sending Bitcoin through encrypted relay servers that batch-broadcast transactions to the main chain", "Using staked collateral to validate Lightning payments without changing Bitcoin's core consensus rules"] },
        { q: "Why is Lightning considered a Layer 2 solution?", a: "It builds on top of Bitcoin's base layer without changing the protocol", wrong: ["It was the second payment network to launch, built directly after Bitcoin itself", "It requires two on-chain confirmations for every Lightning payment to settle", "Only two participants can share any single payment channel at the same time"] },
        { q: "A Lightning invoice is:", a: "A payment request containing the amount, destination, and expiry time", wrong: ["A monthly subscription bill sent to users who operate Lightning routing nodes", "An itemized receipt issued to miners after each successful block reward payment", "A required tax document that Lightning node operators must submit to authorities"] },
        { q: "What does Lightning Labs' Loop service do?", a: "It moves funds between on-chain and Lightning using submarine swaps", wrong: ["It mines Bitcoin directly from a Lightning node by aggregating routing fees", "It converts Bitcoin to altcoins through Lightning-powered atomic swaps", "It keeps the Lightning channel graph in sync with every new confirmed Bitcoin block"] },
        { q: "What is Multi-Path Payments (MPP) on Lightning?", a: "Splitting a payment across multiple routes to exceed single-channel limits", wrong: ["Making multiple separate payments to different recipients simultaneously in one request", "A fallback payment method that only activates when direct Lightning channels are offline", "Sending the same payment through multiple channels concurrently to guarantee delivery"] },
        { q: "What privacy advantage does AMP have over basic MPP on Lightning?", a: "Each shard has a different payment hash, making it harder for routing nodes to link shards", wrong: ["AMP wraps each shard in an extra onion layer completely invisible to intermediate nodes", "AMP routes every shard through Tor by default, concealing the sender's network identity", "AMP uses zero-knowledge proofs so routing nodes cannot observe any payment metadata"] },
        { q: "What is trampoline routing on the Lightning Network?", a: "Delegating route calculation to intermediate nodes for lighter clients", wrong: ["Bouncing payments off satellites for wider global coverage area", "A routing method that always prioritizes the fastest available path", "A security protocol that encrypts all payment amounts in transit"] },
        { q: "What are channel factories in the Lightning Network?", a: "Opening many channels among multiple parties in one on-chain transaction", wrong: ["Physical facilities where Lightning network nodes are manufactured", "Automated systems that create channels based on user demand levels", "Software that converts on-chain wallets into Lightning-ready wallets"] },
        { q: "What is liquidity management on the Lightning Network?", a: "Balancing inbound and outbound capacity to reliably route payments", wrong: ["Converting Lightning Bitcoin back to regular on-chain Bitcoin", "Managing the total circulating supply of Bitcoin on Lightning", "Keeping Lightning nodes continuously connected to the internet"] },
        { q: "What is channel rebalancing on Lightning?", a: "Moving funds between your own channels to redistribute liquidity", wrong: ["Closing and reopening channels with updated funding parameters", "Resetting all channel state back to the initial funding amount", "Transferring full channel ownership to a different Lightning node"] },
        { q: "What is a Lightning Service Provider (LSP)?", a: "A service offering liquidity and channel management for easy onboarding", wrong: ["An internet service provider that specializes in Bitcoin traffic", "A government-licensed operator required to run Lightning nodes as defined by Bitcoin consensus rules enforced by all full nodes", "A cloud service that mines Bitcoin using collected Lightning fees"] },
        { q: "What are zero-conf channels on Lightning?", a: "Channels usable immediately without waiting for on-chain confirmation", wrong: ["Channels that require zero Bitcoin as a deposit to open them as defined by Bitcoin consensus rules enforced by all full nodes", "Channels that provide completely zero-fee routing for payments", "Channels that are permanent and cannot be closed once opened as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "How do Lightning routing nodes earn revenue?", a: "By charging small fees for forwarding payments through their channels", wrong: ["By mining new Bitcoin blocks on the Lightning Network's second-layer chain", "By collecting a fixed percentage of all Lightning transactions worldwide", "By selling their channel topology and routing data to network analytics firms"] },
        { q: "What is the fundamental on-chain mechanism that makes Lightning Network payment channels possible?", a: "Two parties lock funds in a 2-of-2 multisig UTXO on-chain, then exchange signed balance updates off-chain without broadcasting", wrong: ["Two parties create a shared custodial wallet hosted by a Lightning Service Provider who settles batches periodically on-chain", "Two parties send micropayments through a trusted routing hub that accumulates them and settles on-chain once per day", "Two parties lock funds with a single-signature escrow contract and route payments outward through Lightning Service Providers"] },
        { q: "What cryptographic primitive enables trustless multi-hop routing through intermediate Lightning Network nodes?", a: "HTLCs (Hash Time-Locked Contracts): payment releases when the recipient reveals a preimage, or refunds after a timeout expires", wrong: ["Schnorr threshold signatures: three-of-five quorums authorize each hop and prevent intermediate nodes from stealing funds", "Zero-knowledge proofs: each routing node proves it forwarded funds without learning the source or destination of the payment", "Pedersen commitments: each hop commits to the forwarded amount and reveals it only after the full route successfully completes"] },
        { q: "What information does a standard Lightning Network BOLT11 invoice contain?", a: "Payment amount, payment hash, expiry time, and destination public key — all encoded in a compact BOLT11 string format", wrong: ["Sender's node ID, payment amount, full routing path, and a cryptographic commitment to the sender's current channel balance", "Recipient's Bitcoin address, invoice amount, expiry time, and an ordered list of acceptable intermediate routing node IDs", "Payment hash, a UTXO reference, expiry time, and the maximum routing fee the payer will accept per hop along the route"] },
        { q: "What is \"inbound liquidity\" on the Lightning Network and why is it required to receive payments?", a: "It's capacity to receive funds; someone else must open and fund a channel directed toward your node before you can receive", wrong: ["It's the total BTC you have locked across all outgoing channels; more inbound capacity increases your maximum outgoing send limit", "It's a routing score assigned by the network based on how reliably your node has historically forwarded other people's payments", "It's the reserved on-chain balance your Lightning wallet holds as collateral before you can open any new payment channel"] },
        { q: "How are routing fees structured on the Lightning Network?", a: "A flat base fee in satoshis per payment plus a proportional fee rate charged in parts per million of the payment amount", wrong: ["A uniform percentage fee set globally by the Bitcoin protocol and charged identically by every node along every payment route", "Fees equal the hop count multiplied by the node operator's published hourly rate, capped at 0.5% of total payment value", "Routing fees are negotiated bilaterally between each pair of nodes before every payment using a real-time fee auction system"] },
        { q: "What key advantage do BOLT12 \"offers\" provide over standard BOLT11 Lightning invoices?", a: "Offers are static reusable payment codes; unlike BOLT11 single-use invoices, the same offer can be paid repeatedly by anyone", wrong: ["Offers include mandatory KYC fields that make Lightning payments compliant with financial regulations in regulated jurisdictions", "Offers embed a complete routing path to the recipient, eliminating pathfinding work in the sender's wallet software entirely", "Offers encode pre-negotiated channel paths that bypass normal routing, making payments confirm faster than standard BOLT11 invoices"] },
        { q: "What is LNURL and what categories of interaction does it enable in Lightning wallets?", a: "LNURL is a set of HTTP-based protocols enabling QR-driven Lightning interactions: pay-to-link, withdraw, and auth flows", wrong: ["LNURL is a Bitcoin Improvement Proposal defining a universal address format for cross-chain Lightning payment routing globally", "LNURL is a routing protocol that enables Lightning nodes to discover the lowest-fee multi-hop path to any global destination", "LNURL is a Lightning wallet sync standard that replicates channel states across multiple devices belonging to one user"] },
        { q: "What is a Lightning Network \"force-close\" and what protection exists against fraud after one is broadcast?", a: "A unilateral broadcast of the last signed channel state; a CSV timelock gives the counterparty time to contest any cheating attempt", wrong: ["A force-close is a cooperative mutual settlement where both parties co-sign an on-chain transaction dividing the balance evenly", "A force-close triggers automatic reimbursement to both parties from the Lightning Service Provider's dedicated insurance fund", "A force-close broadcasts a penalty transaction that burns the cheating party's funds and credits the honest party in full"] },
        { q: "How does Lightning Network improve payment privacy compared to base-layer Bitcoin transactions?", a: "Lightning payments are not recorded on-chain at all; only channel open and close transactions appear in the public ledger", wrong: ["Lightning uses stealth addresses so each payment routes to a freshly generated one-time destination hiding the recipient identity", "Lightning payments are logged on a private sidechain visible only to the two channel partners and their direct routing nodes", "Lightning improves privacy because routing nodes are legally required to delete all payment records within 24 hours of routing"] },
        { q: "How does Lightning Network's theoretical transaction throughput compare to Bitcoin's base layer?", a: "Lightning can theoretically handle millions of transactions per second at near-zero cost; base layer manages only about 7 TPS", wrong: ["Lightning handles up to 1,000 TPS with current node software; the base layer handles ~7 TPS but provides stronger settlement finality", "Lightning doubles effective base-layer capacity to about 14 TPS; the primary advantage is lower fees rather than raw throughput", "Lightning processes up to 100,000 TPS in ideal conditions with capacity bounded by the weakest routing node's available bandwidth"] }
    ],
    "self-custody": [
        { q: "\"Not your keys, not your...\"", a: "Bitcoin", wrong: ["Wallet", "Password", "Account"] },
        { q: "The most secure long-term storage is:", a: "Hardware wallet", wrong: ["Exchange account", "Phone app as defined by Bitcoin consensus rules enforced by all full nodes", "Email attachment"] },
        { q: "A seed phrase is typically:", a: "12 or 24 words that recover your wallet", wrong: ["A 6-digit PIN code used to log into your exchange", "A QR code generated by your wallet application", "A long alphanumeric code tied to your online account"] },
        { q: "You should store your seed phrase:", a: "On paper or metal in a secure location", wrong: ["Encrypted and saved to a secure cloud storage service", "Inside a password manager app installed on your device", "Memorized and never physically recorded anywhere at all"] },
        { q: "Multi-sig means:", a: "Multiple keys required to authorize a transaction", wrong: ["Multiple Bitcoin addresses combined into one shared wallet", "Multiple approval requests issued from a single private key", "Multiple separate blockchains cooperating to confirm a payment"] },
        { q: "When an exchange holds your Bitcoin:", a: "You have an IOU, not actual Bitcoin", wrong: ["Your coins are fully insured by the exchange platform", "You own the Bitcoin directly on the blockchain", "Government regulation protects your exchange balance"] },
        { q: "Cold storage means:", a: "Keeping keys offline, disconnected from the internet", wrong: ["Keeping your wallet on a computer that rarely goes online", "Storing Bitcoin on a secure exchange with two-factor authentication", "Using an encrypted wallet app that disables all internet browsing"] },
        { q: "A hardware wallet provides security by:", a: "Keeping private keys on a dedicated device that never exposes them to the internet", wrong: ["Storing your Bitcoin balance inside the secure encrypted chip of the physical device", "Encrypting your local blockchain copy so only your device can verify and read transactions", "Requiring a PIN and bank approval code before any Bitcoin transaction can be authorized"] },
        { q: "If you lose your hardware wallet but have your seed phrase, you can:", a: "Recover all your Bitcoin on a new wallet using the seed phrase", wrong: ["Purchase a new hardware wallet and wait for your funds to resync automatically", "Contact the manufacturer with your registration details to restore access remotely", "File a recovery claim with the exchange that sold you the device for reimbursement"] },
        { q: "Multisig (multi-signature) wallets require:", a: "Multiple keys to authorize a transaction (e.g., 2-of-3)", wrong: ["Multiple Bitcoin addresses linked together to pool their shared balances", "Multiple confirmation steps from the same single key before sending is allowed", "Multiple separate mining pools all verifying and confirming the transaction"] },
        { q: "What is Sparrow Wallet known for in multisig coordination?", a: "Deep UTXO management and easy multisig setup with hardware signers", wrong: ["A mobile-only wallet with cloud-based multisig and automatic portfolio rebalancing", "A hardware signing device that stores multiple seed phrases in its secure element", "A browser extension designed primarily for Lightning Network channel management"] },
        { q: "What is a PSBT (Partially Signed Bitcoin Transaction)?", a: "A standard format letting a transaction be built and signed by multiple parties", wrong: ["A special transaction type used to send Bitcoin in multiple smaller partial installments", "A privacy protocol that conceals the sender's identity using stealth address schemes", "A transaction format created exclusively for mining pools to broadcast block rewards"] },
        { q: "What are output descriptors in Bitcoin?", a: "A standard way to describe how a wallet derives addresses for reliable recovery", wrong: ["Custom labels attached to individual transaction outputs to help users track their spending", "A complete on-chain index listing every unspent output recorded on the Bitcoin blockchain", "Metadata that miners embed into blocks to identify which pool included each transaction"] },
        { q: "Why is multisig generally preferred over Shamir Secret Sharing (SSS) for Bitcoin custody?", a: "Multisig never reconstructs the full private key in one place; SSS does when signing", wrong: ["Multisig transactions always cost significantly less in network fees than comparable SSS schemes", "SSS setups always require more hardware devices to operate safely than an equivalent multisig", "Multisig predates SSS by many years and has far wider support across Bitcoin wallets and tools"] },
        { q: "What is Nunchuk known for in the Bitcoin wallet space?", a: "Easy collaborative multisig setup and built-in inheritance planning", wrong: ["Being the first wallet to natively support Lightning Network payments on mobile devices", "A hardware wallet designed exclusively for air-gapped Bitcoin cold storage use", "A privacy wallet that automatically applies CoinJoin mixing to every transaction sent"] },
        { q: "Why is titanium preferred over stainless steel for seed phrase backup plates?", a: "Higher melting point and better corrosion resistance in extreme conditions", wrong: ["Titanium is significantly cheaper and far more widely sourced than stainless steel globally", "Titanium backup plates are thicker and can engrave more seed words per unit of surface area", "Titanium is the only commonly used metal that remains fully undetectable by metal detectors"] },
        { q: "What is a passphrase (25th word) in Bitcoin seed phrase security?", a: "An extra user-chosen word that generates an entirely different wallet", wrong: ["The numeric PIN you enter to unlock and access your hardware wallet device", "A backup phrase your wallet manufacturer generates and assigns when you register the device", "An encryption key that your wallet software uses to protect its locally stored transaction data"] },
        { q: "Why is geographic distribution important for Bitcoin seed phrase storage?", a: "It protects against localized disasters destroying all backup copies at once", wrong: ["It speeds up wallet sync by routing connections through the nearest available Bitcoin nodes", "It is required by law as a financial compliance measure in most major regulatory jurisdictions", "It mathematically strengthens the entropy and randomness of your generated seed phrase"] },
        { q: "What is a dead man's switch in Bitcoin inheritance planning?", a: "A mechanism that triggers key release if the owner fails to check in", wrong: ["A physical switch on hardware wallets that wipes them if tampered", "A transaction that auto-sends all Bitcoin to a burn address on a timer", "A self-destruct feature built directly into the Bitcoin Core software"] },
        { q: "What is the biggest risk of not having a Bitcoin inheritance plan?", a: "Your Bitcoin could be permanently lost since no one else has the keys", wrong: ["The government will automatically seize all of your Bitcoin holdings", "Your Bitcoin gets redistributed among other active network participants", "Your Bitcoin will steadily lose value without an actively managed wallet"] }
    ],
    "privacy-nonkyc": [
        { q: "KYC stands for:", a: "Know Your Customer", wrong: ["Keep Your Coins", "Keys You Control", "Knowledge Yields Crypto"] },
        { q: "CoinJoin is used for:", a: "Mixing transactions for privacy", wrong: ["Combining outputs to reduce on-chain fees", "Merging separate wallet balances into one", "Batching payments to speed up confirmations"] },
        { q: "Non-KYC Bitcoin means:", a: "Bitcoin acquired without identity verification", wrong: ["Bitcoin purchased using anonymous prepaid or gift cards", "Bitcoin held in wallets with no recorded exchange history", "Bitcoin flagged by compliance tools as potentially high risk"] },
        { q: "Bitcoin's blockchain is:", a: "Public - anyone can see transactions", wrong: ["Private and securely encrypted on the chain", "Visible only to miners and full node operators", "Hidden and accessible only to direct participants"] },
        { q: "Why do some people prefer non-KYC Bitcoin?", a: "To maintain financial privacy", wrong: ["To avoid paying taxes on gains", "To access lower-priced Bitcoin deals", "To bypass spending limits on exchanges"] },
        { q: "A Bitcoin address should ideally be:", a: "Used only once for privacy", wrong: ["Reused freely for all transactions", "Shared with all trading counterparties", "Saved and reused permanently in your wallet"] },
        { q: "The first recorded address poisoning attack on Bitcoin happened in:", a: "2025", wrong: ["2021", "2013", "2009"] },
        { q: "Shielded CSV on Bitcoin promises:", a: "Better than Zcash-level privacy as an L1.5", wrong: ["Faster block times than the Bitcoin base layer allows", "Higher throughput and far lower fees than the mainchain", "Full native compatibility with all major altcoin networks"] },
        { q: "Briar messenger is engineered for:", a: "Privacy in hostile environments using Tor", wrong: ["High-quality encrypted video and voice calling", "Social media sharing with end-to-end encryption", "Seamless cloud backup for messages and contacts"] },
        { q: "What is a \"Dust Attack\"?", a: "Tiny amounts of BTC sent to addresses to track the owner's movement", wrong: ["A spam attack used to flood the mempool with thousands of unspendable small transactions", "A hardware failure that causes miners to repeatedly broadcast corrupted block data to peers", "Accidentally wiping your wallet's private keys during a routine software update process"] },
        { q: "\"WabiSabi\" and \"Whirlpool\" are types of:", a: "CoinJoin coordination protocols", wrong: ["Layer 2 Bitcoin payment routing solutions", "Standardized Bitcoin address generation formats", "Open-source hardware wallet firmware projects"] },
        { q: "KYC (Know Your Customer) in Bitcoin refers to:", a: "Identity verification required by regulated exchanges", wrong: ["A cryptographic method used to sign and verify Bitcoin transactions", "A consensus mechanism adopted by proof-of-stake blockchain networks", "A popular open-source Bitcoin wallet available on mobile and desktop"] },
        { q: "Why do some Bitcoiners prefer non-KYC acquisition?", a: "To protect financial privacy and avoid linking identity to Bitcoin holdings", wrong: ["Because peer-to-peer trades typically have lower fees and faster settlement than exchanges", "Because KYC-linked Bitcoin can be frozen or seized by financial regulators at any time", "Because mining your own Bitcoin is always more profitable than buying it on any exchange"] },
        { q: "What is \"address reuse\" and why is it a privacy concern?", a: "Using the same Bitcoin address multiple times lets observers link all those transactions to one entity", wrong: ["Repeatedly reusing the same address causes automated compliance systems to flag your wallet for review", "Reusing a Bitcoin address forces the wallet to charge increased miner fees on every subsequent transaction", "Bitcoin addresses are programmed to expire after a single use and will reject all future incoming payments"] },
        { q: "What does \"non-KYC Bitcoin\" mean?", a: "Bitcoin acquired without providing identity documents, such as through peer-to-peer trades or mining", wrong: ["Bitcoin purchased from exchanges before mandatory government identity verification requirements existed", "Bitcoin mined at home on consumer-grade hardware before large industrial mining farms took over the network", "Bitcoin held in a self-custodied hardware wallet that has never interacted with any registered exchange platform"] },
        { q: "What is a PayJoin (P2EP) transaction?", a: "Both sender and receiver contribute inputs, obscuring who paid whom", wrong: ["A payment where both parties contribute equal amounts and split the total transaction cost evenly", "A transaction format that requires two sequential block confirmations before it is fully settled", "A collaborative mining payout where two pools split the block reward proportionally by hash rate"] },
        { q: "What are Silent Payments (BIP 352)?", a: "One static address generates a unique on-chain address per payment", wrong: ["Transactions that are hidden from the public mempool entirely", "Payments delayed until network activity drops to low levels", "A method to send Bitcoin without paying any transaction fees"] },
        { q: "What is the Boltzmann entropy score used for in Bitcoin privacy?", a: "Measuring ambiguity of a transaction's input-output linkages", wrong: ["Calculating the thermodynamic energy cost of a transaction", "Rating the randomness quality of a wallet's seed phrase", "Scoring how quickly a transaction will get confirmed as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "What does Whirlpool do for Bitcoin privacy?", a: "Mixes UTXOs via CoinJoin to break transaction history links", wrong: ["Provides a VPN service designed specifically for Bitcoin nodes", "Encrypts Bitcoin transactions end-to-end before broadcast", "Runs a privacy coin layer on top of the Bitcoin blockchain"] },
        { q: "What is CoinSwap and how does it differ from CoinJoin?", a: "Uses atomic swaps so mixing is invisible on-chain, unlike CoinJoin", wrong: ["Converts Bitcoin to privacy coins and back for mixing purposes", "Is faster but provides less privacy protection than CoinJoin", "Requires a trusted third party while CoinJoin does not need one"] }
    ],
    "problems-of-money": [
        { q: "Why is inflation described as a \"hidden tax\"?", a: "It silently erodes the purchasing power of savings without a formal vote", wrong: ["It is an unofficial surcharge added by central banks on top of existing income taxes", "Banks secretly deposit hidden service fees into government accounts disguised as price rises", "Only people in the highest tax bracket are actually subject to the effects of inflation"] },
        { q: "Fractional reserve banking means:", a: "Banks hold only a fraction of deposits", wrong: ["Banks must hold all deposits as full cash reserves", "Banks lend only from their own shareholder equity", "Banks are barred from investing any customer deposits"] },
        { q: "Inflation is often called:", a: "A hidden tax on savings", wrong: ["A government bonus for savers", "A stimulus for wage growth", "A tool to strengthen currency"] },
        { q: "Fiat currency is backed by:", a: "Government decree and trust", wrong: ["Gold held in reserve vaults", "Federal deposit insurance funds", "Commodity reserves and bonds"] },
        { q: "The US dollar has lost what percentage of purchasing power since 1913?", a: "Over 96%", wrong: ["About 10%", "None as defined by Bitcoin consensus rules enforced by all full nodes", "About 50%"] },
        { q: "Money printing causes:", a: "Devaluation of existing currency", wrong: ["Increased purchasing power for citizens", "Higher savings yields for depositors", "Economic growth and a stronger currency"] },
        { q: "Sound money historically meant:", a: "Money that couldn't be easily debased", wrong: ["Money backed by government commodity reserves", "Currency issued only by state-chartered institutions", "Money that held value only through centrally set law"] },
        { q: "The Cantillon Effect describes how:", a: "Those closest to new money benefit most from inflation", wrong: ["Early Bitcoin adopters profit most from each halving cycle", "Commercial banks absorb the losses from excess money creation", "Gold prices automatically rise in response to money printing"] },
        { q: "ShadowStats.com tracks:", a: "Real inflation rates vs official government numbers", wrong: ["Alternative consumer price metrics compared to CPI baselines", "Housing price trends versus central bank interest rate changes", "Unemployment statistics as reported by competing data agencies"] },
        { q: "\"The Four Horsemen\" documentary (2013) exposes:", a: "The fiat monetary system scam", wrong: ["The collapse of pension funds and retirement savings", "How governments manipulate economic data and statistics", "The risks of corporate monopolies and unchecked market power"] },
        { q: "\"Nixon Shock\" in 1971 refers to:", a: "The US ending the dollar's convertibility into gold", wrong: ["The launch of the first government-issued digital currency", "The collapse of major US stock markets and widespread bank failures", "The founding of the Federal Reserve as the central banking authority"] },
        { q: "Gresham's Law states that:", a: "\"Bad money drives out good money\"", wrong: ["\"Bitcoin will replace fiat\" as defined by Bitcoin consensus rules enforced by all full nodes", "\"Gold is always better than silver\"", "\"Taxes are voluntary\" as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "What happened in 1971?", a: "Nixon ended the gold standard, allowing unlimited fiat money printing", wrong: ["Satoshi Nakamoto published the Bitcoin whitepaper under a pseudonym", "The first commercial digital computer was demonstrated at a US university", "The European Economic Community introduced a shared continental currency"] },
        { q: "Inflation is often called a \"hidden tax\" because:", a: "It silently erodes the purchasing power of your savings", wrong: ["The IRS taxes Bitcoin capital gains at an undisclosed rate", "Banks charge account maintenance fees that are never disclosed", "Governments secretly deduct inflation levies from wage payments"] },
        { q: "What is seigniorage?", a: "The profit a government makes by issuing currency that costs less to produce than its face value", wrong: ["A special tax levied on gold and silver mining operations by the state treasury as defined by Bitcoin consensus rules enforced by all full nodes", "The interest income a central government earns by lending funds to commercial banks as defined by Bitcoin consensus rules enforced by all full nodes", "The administrative fee that central banks charge for processing all interbank transfers"] },
        { q: "The Cantillon Effect describes how newly printed money benefits those closest to its creation. Who benefits MOST from money printing?", a: "Banks and the politically connected who receive new money first", wrong: ["Average workers who receive higher wages from inflation as defined by Bitcoin consensus rules enforced by all full nodes", "Retirees on fixed incomes who get cost-of-living adjustments", "Small business owners who can raise their prices immediately"] },
        { q: "What is Quantitative Easing (QE)?", a: "A central bank creating new money to buy bonds, expanding supply", wrong: ["A method of reducing government debt by printing less money", "A technique for making international trade easier between nations", "A system where banks lend to each other at zero percent interest"] },
        { q: "What is the \"repo market\" and why does it matter for understanding fiat fragility?", a: "Overnight lending market using bonds as collateral - its 2019 crisis exposed systemic fragility", wrong: ["A marketplace where banks sell repossessed properties and vehicles directly to investors", "A government repository that audits and stores physical gold and foreign currency reserves", "A database system where central banks track and reconcile all cross-border financial transfers"] },
        { q: "What is the \"Eurodollar system\"?", a: "US dollars held and created by banks outside the US, forming a shadow system", wrong: ["The official exchange mechanism that converts Euros into Dollars at European bank desks", "A European Central Bank program designed to eventually replace the Dollar with the Euro", "A cryptocurrency stablecoin project backed equally by Euros and US Dollars in reserve"] },
        { q: "What does the decline of the \"petrodollar\" system mean for global finance?", a: "Oil nations moving away from dollar pricing weakens its reserve status", wrong: ["Major oil companies are converting their energy infrastructure to Bitcoin mining operations", "The decline of petrodollar demand means crude oil is rapidly losing its economic value", "European nations are now contractually forced to purchase all imported oil using gold"] }
    ],
    "investment-strategy": [
        { q: "DCA stands for:", a: "Dollar Cost Averaging", wrong: ["Digital Currency Account", "Decentralized Crypto Asset", "Direct Coin Access"] },
        { q: "A common Bitcoin investment strategy is:", a: "Buy regularly and hold long-term", wrong: ["Trade actively based on daily price signals", "Sell your holdings on a fixed weekly schedule", "Only purchase Bitcoin when it hits all-time highs"] },
        { q: "HODL originated from:", a: "A misspelled forum post saying \"I AM HODLING\"", wrong: ["A strategy term coined in a financial textbook on investing", "An acronym introduced in a government savings policy document", "A banking industry term for long-term certificate deposit accounts"] },
        { q: "Bitcoin's 4-year cycle is often tied to:", a: "The halving events", wrong: ["US elections as defined by Bitcoin consensus rules enforced by all full nodes", "Solar cycles as defined by Bitcoin consensus rules enforced by all full nodes", "Stock market seasons"] },
        { q: "The best time to buy Bitcoin according to Bitcoiners is:", a: "Always - time in the market beats timing the market", wrong: ["Only when the price dips below its 200-day moving average", "During January to benefit from known seasonal price patterns", "Only after major corrections of at least 30% from recent highs"] },
        { q: "Stacking sats means:", a: "Accumulating small amounts of Bitcoin over time", wrong: ["Holding Bitcoin across multiple custodial exchange accounts", "Building a collection of hardware wallets for extra redundancy", "Running Lightning nodes to earn small routing fee payments"] },
        { q: "The biggest drawdown in Bitcoin history was:", a: "94% decline from $32 to $2 in July 2011", wrong: ["85% drop from $19,700 down to $3,100 across late 2018", "80% decline from $69,000 to $13,800 during calendar year 2022", "73% crash from $65,000 to $17,500 between June and December 2022"] },
        { q: "MNAV.com tracks:", a: "Bitcoin treasury companies and their metrics", wrong: ["Lightning Network routing nodes and their channel statistics", "Bitcoin mining pool hash rates and block reward earnings", "Altcoin market capitalizations and daily trading volumes"] },
        { q: "Lump-sum investing means:", a: "Buying a large amount of Bitcoin all at once", wrong: ["Buying a set amount of Bitcoin on a regular schedule", "Liquidating your entire Bitcoin position in one trade", "Trading Bitcoin only during low-volume off-peak hours"] },
        { q: "Dollar Cost Averaging (DCA) means:", a: "Buying a fixed amount of Bitcoin at regular intervals regardless of price", wrong: ["Only purchasing Bitcoin when the price falls below a predetermined target level", "Converting your entire savings into Bitcoin in a single immediate lump-sum transaction", "Automatically selling a fixed portion of Bitcoin each time the price rises by 10 percent"] },
        { q: "The Bitcoin phrase \"zoom out\" means:", a: "Look at the long-term price trend instead of daily volatility", wrong: ["Reduce your overall Bitcoin allocation when market conditions feel uncertain", "Withdraw funds from trading platforms during periods of unusually high volatility", "Rebalance your entire portfolio away from Bitcoin during any significant downturn"] },
        { q: "What does \"stacking sats\" mean in Bitcoin culture?", a: "Regularly accumulating small amounts of Bitcoin (satoshis) over time", wrong: ["Collecting a physical stack of commemorative Bitcoin medallions and coins", "Distributing your Bitcoin holdings evenly across multiple custodial exchanges", "Running multiple Bitcoin mining rigs simultaneously to accumulate block rewards"] },
        { q: "Why do Bitcoiners say \"time in the market beats timing the market\"?", a: "Long-term holders historically outperform those trying to buy dips and sell tops", wrong: ["Because Bitcoin's price has never experienced a prolonged or significant multi-year decline", "Because cryptocurrency exchanges charge substantially higher fees for precisely timed trades", "Because Bitcoin mining block rewards automatically increase in size over long holding periods"] },
        { q: "What is the \"HODL\" strategy?", a: "Buying Bitcoin and holding it long-term regardless of short-term price volatility", wrong: ["Actively trading Bitcoin to profit from short-term price fluctuations each day", "Using automated trading bots to execute buy and sell orders based on market signals", "Keeping a fixed portfolio allocation of exactly one whole Bitcoin at all times"] },
        { q: "Why is cold storage recommended for long-term Bitcoin holdings?", a: "Keeping private keys offline eliminates the risk of remote hacking or exchange failure", wrong: ["Cold storage wallets generate yield by staking Bitcoin through a delegated proof-of-stake system", "Storing coins offline enables faster confirmation because miners prioritize cold wallet transactions", "Cold wallets automatically sync encrypted private key copies to a cloud server for easy recovery"] },
        { q: "What is UTXO management for tax optimization?", a: "Choosing specific UTXOs with known cost bases to minimize capital gains taxes", wrong: ["Automatically hiding UTXO transaction history to avoid IRS capital gains reporting", "Converting all UTXOs into stablecoins before tax season to defer all reporting obligations", "Splitting Bitcoin into sub-$600 transfers to stay under IRS transaction reporting thresholds"] },
        { q: "What does \"step-up in cost basis\" mean for inherited Bitcoin?", a: "Cost basis resets to market price at owner's death, erasing prior gains", wrong: ["Inherited Bitcoin retains its original purchase price as the permanent taxable cost basis", "Bitcoin inheritance is fully tax-exempt in every jurisdiction regardless of the gain size", "The cost basis of inherited Bitcoin automatically doubles each year following the inheritance"] },
        { q: "What is a Bitcoin IRA?", a: "A self-directed retirement account holding Bitcoin with tax advantages", wrong: ["A federal program that pays out Bitcoin monthly to eligible American retirees", "An insurance policy that compensates Bitcoin holders for losses from theft or hacks", "A bank savings account offering a fixed interest rate paid out in Bitcoin"] },
        { q: "Why do experienced Bitcoiners warn against lending out your Bitcoin?", a: "Lending platforms like Celsius and BlockFi collapsed, losing depositor funds", wrong: ["The Bitcoin codebase explicitly forbids any form of lending or borrowing of coins", "Lending out Bitcoin causes measurable network congestion and slower confirmation times", "Bitcoin lending always yields negative real returns because platform fees erode all gains"] },
        { q: "Why is cost basis tracking important for Bitcoin investors?", a: "Each purchase creates a separate tax lot needed for capital gains calculations", wrong: ["Cost basis is only required for Bitcoin custodied at licensed exchange platforms", "The IRS uses a flat tax rate on all Bitcoin regardless of what you paid for it", "Cost basis is irrelevant since Bitcoin is officially treated as foreign currency"] }
    ],
    "cryptography": [
        { q: "Why did Satoshi choose the secp256k1 elliptic curve for Bitcoin instead of the more widely used NIST P-256?", a: "secp256k1's parameters have no known backdoor; NIST P-256's constants were generated through an opaque process lacking transparency", wrong: ["secp256k1 produces shorter 48-byte signatures versus NIST P-256's 72-byte signatures, saving meaningful space per transaction", "secp256k1 was the only elliptic curve with an existing open-source implementation available when Bitcoin was being actively developed", "secp256k1 enables faster signature verification on commodity CPUs, which was critical for Satoshi's constrained 2009 launch timeline"] },
        { q: "Which digital signature algorithm did Bitcoin use to authorize transactions before the Taproot upgrade activated?", a: "ECDSA (Elliptic Curve Digital Signature Algorithm) was used to sign and authorize all Bitcoin transactions before Taproot activated", wrong: ["EdDSA (Edwards-curve Digital Signature Algorithm), a Schnorr-based variant used widely across modern cryptography since the 1990s", "RSA-2048, which was replaced by ECDSA in a 2012 BIP update to reduce transaction signature size and improve overall verification speed", "DSA (Digital Signature Algorithm), the original NIST standard adapted for Bitcoin's secp256k1 elliptic curve in the genesis block"] },
        { q: "What is the key mathematical property of Schnorr signatures that makes them especially valuable for Bitcoin?", a: "Schnorr signatures are linear and additive — multiple parties' signatures can be aggregated into one compact signature via MuSig", wrong: ["Schnorr signatures are 256 bytes shorter than equivalent ECDSA signatures, significantly reducing the on-chain footprint of all transactions", "Schnorr signatures operate on a different elliptic curve that is provably harder to attack than the secp256k1 curve used by ECDSA", "Schnorr signatures are non-deterministic by design, which prevents the timing-based side-channel attacks that can affect ECDSA"] },
        { q: "What are the key security properties of the SHA-256 hash function as used in Bitcoin?", a: "256-bit fixed output, deterministic, pre-image resistant, and avalanche effect: one changed input bit completely alters the output", wrong: ["128-bit variable output, probabilistic, collision-resistant only, designed for high speed on the hardware-accelerated Bitcoin ASICs", "512-bit fixed output, deterministic, fully reversible using the corresponding private key, and exhibits a strong avalanche effect", "256-bit fixed output, non-deterministic due to an internal random salt, collision-resistant only, and tied to the secp256k1 curve"] },
        { q: "What is the step-by-step process for deriving a Bitcoin address from a public key?", a: "SHA-256 the public key, then RIPEMD-160 to get a 20-byte hash, then apply Base58Check encoding to produce the final address", wrong: ["RIPEMD-160 the private key directly, then SHA-256 it twice, producing a 32-byte output encoded in hexadecimal as the address", "SHA-512 the public key then truncate to 20 bytes, then apply Base64 encoding with a 4-byte checksum appended to the result", "SHA-256 the compressed public key twice, take the final 20 bytes, then encode using standard Base64 plus a 4-byte checksum"] },
        { q: "Why are cryptographic hash functions described as \"one-way\" functions?", a: "Given hash output H(x), finding the original input x is computationally infeasible — you can compute forward but never reverse it", wrong: ["Hash functions are one-way because they discard excess information via bitwise truncation performed during the internal hashing rounds", "Hash functions are one-way by law only; reversing them without authorization qualifies as a federal computer intrusion crime globally", "Hash functions are one-way in hardware only; software implementations of SHA-256 can theoretically be reversed with sufficient RAM"] },
        { q: "Why does Bitcoin's Base58Check encoding omit certain characters from its alphabet?", a: "It removes visually ambiguous characters — 0, O, I, and l — to prevent costly transcription errors when addresses are copied manually", wrong: ["It removes alphabetically late characters x, y, and z to keep all encoded strings short enough to fit on a single paper backup", "It excludes special symbols and all uppercase letters to ensure compatibility with every Unicode keyboard and QR code scanner", "It removes vowels entirely to prevent encoded addresses from accidentally spelling dictionary words that users might confuse with keys"] },
        { q: "What is the discrete logarithm problem and how does it protect Bitcoin private keys?", a: "Given a public key (a curve point), deriving the private key (scalar multiplier) is computationally infeasible on the secp256k1 curve", wrong: ["Given a private key expressed as a large prime, factoring it into two component primes is computationally infeasible on modern hardware", "Given a hash of the public key, reversing SHA-256 to recover the original elliptic curve point is computationally infeasible always", "Given an AES-encrypted wallet file, brute-forcing the decryption key is computationally infeasible without the user's original passphrase"] },
        { q: "How are cryptographic commitment schemes used within Lightning Network HTLCs?", a: "A hash of a secret preimage is shared first; the preimage is revealed upon payment, atomically unlocking funds across all hops", wrong: ["A time-locked commitment to a routing fee is published on-chain first; revealing it later proves the payment was properly delivered", "Each routing node commits to holding forwarded funds for a fixed timelock period and reveals its commitment to prevent double-spend", "A cryptographic commitment to the exact payment amount is shared with all hops; revealing it triggers simultaneous on-chain settlement"] },
        { q: "What is P2PKH and what security advantage does it offer over the earlier Pay-to-Public-Key output type?", a: "P2PKH (Pay-to-Public-Key-Hash) hashes the public key before use, providing protection if ECDSA is ever weakened or compromised", wrong: ["P2PKH locks outputs behind a 2-of-2 multisig requirement, making theft completely impossible without access to both signing keys", "P2PKH encrypts the output script with the sender's public key so only the intended recipient can decode the locking conditions", "P2PKH uses RIPEMD-256 instead of RIPEMD-160, producing a longer hash that offers significantly stronger collision-resistance guarantees"] },
        { q: "Elliptic curve cryptography is used for:", a: "Generating Bitcoin key pairs", wrong: ["Hashing new Bitcoin blocks", "Encrypting transaction data", "Verifying peer connections"] },
        { q: "What type of cryptography does Bitcoin use for digital signatures?", a: "Elliptic Curve Digital Signature Algorithm (ECDSA) on the secp256k1 curve", wrong: ["RSA-2048 with standard padding, used as the primary Bitcoin signature algorithm", "AES-256 symmetric block cipher used to generate and protect Bitcoin private keys", "Triple DES in EDE mode, a legacy block cipher used for Bitcoin digital signatures"] },
        { q: "What is a hash function's role in Bitcoin?", a: "It creates a fixed-size, unique digital fingerprint of any input data, used for block headers, addresses, and mining", wrong: ["It encrypts all Bitcoin transactions end-to-end so that only the sender and receiver can access the payment amounts", "It compresses the full blockchain into smaller data segments so nodes require less disk space and can sync faster", "It converts Bitcoin values into standardized forms used by other blockchains, making cross-chain swaps possible"] },
        { q: "Why can't you derive a private key from a public key?", a: "Elliptic curve math is a one-way function - easy to compute forward, computationally infeasible to reverse", wrong: ["Private keys have more bits than public keys, making it impossible to derive the longer value from the shorter one", "The Bitcoin network automatically purges private key data after a transaction is signed and confirmed on-chain", "Satoshi Nakamoto encrypted all key pairs using a proprietary cipher that requires a secret master key to reverse"] },
        { q: "What does SHA-256 stand for and where is it used in Bitcoin?", a: "Secure Hash Algorithm 256-bit - used in mining (proof of work) and creating transaction IDs", wrong: ["Super Hash Accelerator 256 - used only for wallet file encryption by software client applications", "Satoshi Hash Algorithm 256 - applied during signature verification to authenticate transaction signers", "Shared Hash Array 256 - used in peer-to-peer message routing to propagate transactions across nodes"] },
        { q: "What advantage do Schnorr signatures provide over ECDSA in Bitcoin?", a: "Key aggregation for efficient multi-signature transactions", wrong: ["Quantum resistance that the older ECDSA algorithm intrinsically cannot provide", "Uniformly smaller signature bytes in every case no matter how many signers", "Backward compatibility with all legacy scripts, active from the Bitcoin genesis block"] },
        { q: "What is MuSig2 in Bitcoin?", a: "A Schnorr-based multi-sig scheme producing one standard-looking signature", wrong: ["A second version of Bitcoin's block-streaming protocol used between all full nodes", "A next-generation mining algorithm designed to replace SHA-256 in a future protocol fork", "A Lightning Network routing protocol optimized for two-hop payment channel paths"] },
        { q: "What are adaptor signatures used for in Bitcoin?", a: "Conditional payments where signing reveals a secret value", wrong: ["Upgrading old Script paths to be compatible with Taproot transaction outputs", "Allowing multiple parties to jointly co-sign a single Bitcoin transaction", "Adding Turing-complete logic to Bitcoin Script through extended opcodes"] },
        { q: "What is a Pedersen commitment?", a: "A commitment that hides a value while allowing math verification", wrong: ["A legal pledge between Bitcoin developers to preserve protocol backward compatibility", "A specific fee amount committed and locked inside each block's transactions", "A formal promise from miners to always enforce current network consensus rules"] },
        { q: "What is the current status of zero-knowledge proofs on Bitcoin?", a: "Being explored via projects like BitVM and validity rollups", wrong: ["Fully implemented in Bitcoin Core since the Taproot upgrade", "Impossible on Bitcoin due to fundamental Script limitations", "Removed from Bitcoin in 2015 due to critical security risks"] }
    ],
    "regulation": [
        { q: "Bitcoin's response to bans has been:", a: "Moving to friendlier jurisdictions", wrong: ["Shutting down all operations worldwide", "Complying with every new law passed", "Becoming illegal in all countries forever"] },
        { q: "El Salvador made Bitcoin:", a: "Legal tender in 2021", wrong: ["Illegal to hold in 2020", "A classified state asset", "Available only to tourists"] },
        { q: "Bitcoin regulation varies by:", a: "Country - each has different rules", wrong: ["No country has any Bitcoin rules at all", "One universal global law governs it", "The Bitcoin code sets its own rules"] },
        { q: "A Bitcoin ETF allows:", a: "Traditional investors to get Bitcoin exposure through stock markets", wrong: ["Any person to receive free Bitcoin as a government-issued daily dividend", "Government agencies to operate and directly control Bitcoin mining facilities", "Central banks to print and issue new Bitcoin in response to investor demand"] },
        { q: "The SEC has classified Bitcoin as:", a: "A commodity, not a security", wrong: ["A security similar to stocks", "A foreign currency like euros", "An illegal financial instrument"] },
        { q: "What is a \"Self-Custody\" regulation attempt?", a: "Rules that try to force users to use custodial services", wrong: ["Laws guaranteeing free Bitcoin payouts to all registered citizens", "Safety regulations covering electricity use by Bitcoin mining operations", "Maximum price controls on how much Bitcoin can legally be worth"] },
        { q: "Can a government effectively ban Bitcoin?", a: "They can restrict fiat on-ramps but cannot stop peer-to-peer transactions", wrong: ["Yes - a country that cuts all internet access can permanently shut down Bitcoin", "Yes - every node operator can be identified by IP address and then shut down", "No country has ever proposed or enacted any formal restriction on Bitcoin"] },
        { q: "China has banned Bitcoin mining multiple times, yet:", a: "Miners relocated and the network hash rate recovered within months", wrong: ["Bitcoin permanently lost over 50% of its value and never recovered", "All Chinese-held Bitcoin was confiscated by government authorities", "The Bitcoin network went entirely offline for several weeks afterward"] },
        { q: "How is Bitcoin classified for tax purposes in most jurisdictions?", a: "As property or a capital asset, meaning gains are subject to capital gains tax", wrong: ["As a foreign currency, which exempts gains from standard capital gains taxation rules", "As a commodity with only voluntary reporting obligations and no formal tax requirement", "As digital pocket cash, making it exempt from any tax under existing currency statutes"] },
        { q: "What does the \"Travel Rule\" require for crypto transactions?", a: "Regulated exchanges must share sender and receiver identity information for transfers above a threshold", wrong: ["Users must physically appear at a licensed exchange office to authorize any outgoing Bitcoin transfer", "Bitcoin is legally restricted to being transferred only to recipients within your home country boundaries", "Bitcoin miners must verify the passport number of every user before including their transaction in a block"] },
        { q: "In the US, what is the key difference between SEC and CFTC jurisdiction over digital assets?", a: "SEC regulates securities (most altcoins); CFTC regulates Bitcoin as a commodity", wrong: ["The SEC handles Bitcoin while the CFTC regulates all other digital assets as securities", "Both the SEC and CFTC hold identical overlapping jurisdiction over all digital asset classes", "The CFTC only regulates physical commodities and has no authority over any digital asset"] },
        { q: "What is the Howey Test and how does it apply to Bitcoin?", a: "A legal test for securities - Bitcoin fails to qualify since it has no central enterprise", wrong: ["A technical test blockchain researchers use to measure a network's degree of decentralization", "Bitcoin passes the Howey Test, which is why the SEC classifies it as a regulated security", "An IRS formula used to determine the applicable capital gains tax rate on crypto disposals"] },
        { q: "What is the \"Travel Rule\" in cryptocurrency regulation?", a: "A FATF rule requiring institutions to share sender/receiver identity above a threshold", wrong: ["A rule restricting Bitcoin transfers to recipients within the sender's own home country", "A requirement that Bitcoin miners register the physical location of all their mining hardware", "A law prohibiting people from carrying hardware wallets across any international border crossing"] },
        { q: "What is the FATF and why is it significant for Bitcoin privacy?", a: "An international body pushing KYC/AML standards that threaten self-custodial privacy", wrong: ["A global mining consortium that coordinates hash rate and difficulty adjustment standards", "A nonprofit promoting Bitcoin adoption and financial inclusion in the developing world", "A technology standards body focused on improving Bitcoin transaction processing speed"] },
        { q: "How have US states approached Bitcoin regulation differently from the federal government?", a: "Several states passed pro-Bitcoin laws like reserve bills and transmitter exemptions", wrong: ["All 50 states enforce identical cryptocurrency regulations matching federal law", "States are constitutionally prohibited from creating crypto-related legislation", "Most states have banned Bitcoin mining operations due to energy concerns as defined by Bitcoin consensus rules enforced by all full nodes"] }
    ],
    "energy": [
        { q: "Bitcoin mining and energy:", a: "Promotes renewable energy and uses wasted energy", wrong: ["Relies entirely on coal and fossil fuel energy sources", "Consumes all input energy without producing any useful output", "Runs on no electricity and generates its own internal power"] },
        { q: "Stranded energy refers to:", a: "Energy produced in remote locations with no buyers", wrong: ["Power lost during grid transmission and electrical line failures", "Solar energy that cannot be captured when panels go offline at night", "Wind turbine output during periods of insufficient wind speed"] },
        { q: "Bitcoin miners often locate near:", a: "Cheap renewable energy sources", wrong: ["Major urban population and city centers", "Existing coal and natural gas power plants", "Government-designated industrial manufacturing zones"] },
        { q: "Bitcoin mining can help stabilize:", a: "Electrical grids by acting as a flexible load", wrong: ["Financial markets by absorbing excess liquidity costs", "Global internet speeds by distributing network traffic", "National economies by generating significant tax revenue"] },
        { q: "Compared to traditional banking, Bitcoin's energy use is:", a: "Debatable but often comparable or less", wrong: ["Far higher, consuming roughly 100 times more power", "Essentially zero, as nodes share idle renewable capacity", "Precisely equal by international regulatory requirement"] },
        { q: "Methane flaring and Bitcoin mining:", a: "Miners can capture and use flared gas productively", wrong: ["Flaring and Bitcoin mining are completely unrelated industries", "Bitcoin mining operations significantly increase local methane flaring", "All Bitcoin mining is powered entirely by captured flared gas"] },
        { q: "Bitcoin mining primarily uses which type of energy?", a: "Over 50% renewable - often stranded or wasted energy", wrong: ["Primarily coal and natural gas, making it highly polluting", "Entirely nuclear energy sourced from dedicated power plants", "Solar panels mounted directly onto the physical mining hardware"] },
        { q: "Bitcoin mining can actually help the environment by:", a: "Monetizing flared methane that would otherwise be released into the atmosphere", wrong: ["Reducing total global electricity demand through more efficient transaction processing", "Generating new renewable energy as a byproduct of the computational hashing process", "Cooling local environments through large-scale heat exchange and water evaporation systems"] },
        { q: "How do Bitcoin miners contribute to grid stability?", a: "They can instantly power down during peak demand, acting as flexible load that balances the grid", wrong: ["They generate surplus electricity by recovering heat from mining hardware and exporting it back to the grid", "They replace traditional power plants by acting as distributed energy generation nodes across local grids", "They are legally required to operate only during low-demand off-peak hours under formal grid usage agreements"] },
        { q: "What percentage of Bitcoin mining uses renewable energy sources according to recent estimates?", a: "Over 50% and growing, driven by miners seeking the cheapest energy", wrong: ["Less than 5%, with the vast majority still coming from coal and natural gas", "Exactly 100%, as all mining facilities are now required by law to use renewables", "Around 10%, mostly from dedicated nuclear power plants located near data centers"] }
    ],
    "core-source-code": [
        { q: "Changes to Bitcoin Core require:", a: "Careful testing and peer review", wrong: ["Approval from a single trusted lead developer", "A majority vote from participating corporations", "Official regulatory permission from a government body"] },
        { q: "What is a Bitcoin Improvement Proposal (BIP)?", a: "A formal document proposing changes or standards for the Bitcoin protocol", wrong: ["A mandatory software update all Bitcoin nodes must immediately install", "A formal funding request submitted by miners to the Bitcoin Foundation", "A signed petition from major exchanges required before protocol changes occur"] },
        { q: "Anyone can:", a: "Read, review, and propose changes to Bitcoin's code", wrong: ["Freely modify Bitcoin's consensus rules without peer review", "Delete recorded blockchain history to correct discovered errors", "Issue new coins or increase the fixed 21 million supply cap"] },
        { q: "A BIP is:", a: "A Bitcoin Improvement Proposal", wrong: ["A Bitcoin Investment Plan as defined by Bitcoin consensus rules enforced by all full nodes", "A Block Information Protocol", "A Banking Integration Process"] },
        { q: "Bitcoin's code repository is hosted on:", a: "GitHub", wrong: ["Facebook", "A secret server", "The dark web"] }
    ],
    "blockchain-timechain": [
        { q: "A new Bitcoin block is produced approximately every:", a: "10 minutes", wrong: ["1 second", "1 hour as defined by Bitcoin consensus rules enforced by all full nodes", "1 day as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "Each block contains:", a: "A list of transactions and a reference to the previous block", wrong: ["A single transaction along with the miner's identification details", "Compressed image files that visually represent each coin transfer", "Encrypted email addresses linked to each registered wallet holder"] },
        { q: "The blockchain is often called:", a: "An immutable ledger", wrong: ["A cloud server as defined by Bitcoin consensus rules enforced by all full nodes", "A website as defined by Bitcoin consensus rules enforced by all full nodes", "A database that can be edited"] },
        { q: "Satoshi originally called it:", a: "A timechain", wrong: ["A blockchain", "A datachain", "A coinchain"] },
        { q: "The Genesis Block contains a message about:", a: "A newspaper headline about bank bailouts", wrong: ["A step-by-step recipe embedded as a tribute to early cypherpunks", "A love letter written by Satoshi addressed to future generations", "A coded stock market tip referencing a major technology company IPO"] },
        { q: "Block height refers to:", a: "The sequential number of a block in the chain", wrong: ["The physical height of the server rack that stores the block", "The total storage size of a block measured in kilobytes", "The current difficulty level required to mine a valid block"] },
        { q: "Satoshi originally called the blockchain the:", a: "Timechain", wrong: ["Hashchain", "Blockweb", "Cryptoledger"] },
        { q: "Each Bitcoin block contains a reference to:", a: "The hash of the previous block, creating an unbreakable chain", wrong: ["The predicted hash of the next block that miners are currently solving", "A cryptographic commitment to all future transactions not yet confirmed", "A compressed encrypted backup of the entire blockchain up to that block"] },
        { q: "The mempool is:", a: "A waiting area where unconfirmed transactions sit until miners include them in a block", wrong: ["A secure hardware wallet format specifically designed to store private Bitcoin keys offline", "The total aggregate RAM consumed by all connected Bitcoin full nodes running on the network", "A distributed memory pool shared between ASIC mining rigs to coordinate their hashing workload"] },
        { q: "Why did Satoshi originally call it a \"timechain\" rather than \"blockchain\"?", a: "Because each block timestamps transactions in chronological order, creating a chain of time-stamped records", wrong: ["Because Bitcoin blocks are mined at fixed intervals tied to a global atomic clock standard for synchronization", "Because each transaction record includes a precise timestamp reflecting the time zone of the initiating wallet node", "Because the name 'blockchain' was already trademarked by an existing financial services firm at the time of release"] },
        { q: "Why do some Bitcoiners prefer the term \"timechain\" over \"blockchain\"?", a: "It emphasizes chronological ordering — each block is permanently anchored in time, not merely linked by shared data hashes", wrong: ["It was Satoshi's original preferred name in the whitepaper before \"blockchain\" became the mainstream term later", "It highlights that Bitcoin blocks have timestamps while most other blockchains completely omit block time information", "It refers to the fixed 10-minute block interval creating a reliable and predictable sequence of time-indexed records"] },
        { q: "What date was the Bitcoin genesis block mined, and what was embedded in it as proof-of-time?", a: "January 3, 2009; the Times headline \"Chancellor on brink of second bailout for banks\" proving no coins predate that block", wrong: ["October 31, 2008; the text \"Bitcoin: A Peer-to-Peer Electronic Cash System\" matching the title of the whitepaper exactly", "January 9, 2009; the headline \"US Federal Reserve cuts interest rates to near zero\" referencing the ongoing financial crisis", "November 1, 2008; the phrase \"The Times 01/Nov/2008 Global markets near total collapse\" embedded as political commentary"] },
        { q: "How does Bitcoin track ownership differently from a traditional bank account?", a: "Bitcoin uses UTXOs (Unspent Transaction Outputs) — discrete coin-like objects — rather than maintaining a running account balance", wrong: ["Bitcoin maintains a shared ledger of named accounts with balances updated atomically by each confirmed transaction on the chain", "Bitcoin stores ownership in a global identity table where each public key maps to a single cumulative spendable balance amount", "Bitcoin assigns each wallet address a unique balance field that miners update when new blocks are added to the chain"] },
        { q: "What role do Merkle trees play in Bitcoin's design?", a: "They allow SPV wallets to verify a transaction exists in a block without downloading the entire blockchain at all", wrong: ["They compress raw transaction bytes so each block can store more transactions within the standard 1 MB block size limit", "They link blocks together unforgeable by hashing all transactions directly into the previous block's header field", "They prevent double-spending by organizing transactions into a sorted tree that all miners must validate on confirmation"] },
        { q: "What happens when two miners simultaneously find valid blocks at the same block height?", a: "Both are briefly valid; this is called an orphan or stale block situation — only one survives once the chain extends further", wrong: ["Both blocks are merged by the network into a combined super-block containing all transactions from each competing version", "The network pauses for 10 minutes and nodes vote on which block to accept based on total transaction fees included", "Both miners split the block reward equally and every node permanently accepts whichever block it received first"] },
        { q: "Which six fields appear in a standard Bitcoin block header?", a: "Version, previous block hash, Merkle root, timestamp, nBits difficulty target, and nonce — the six canonical header fields", wrong: ["Version, miner address, transaction count, Merkle root, timestamp, and block height as specified in the protocol spec", "Previous block hash, coinbase reward amount, timestamp, nBits target, nonce, and the winning miner's signature field", "Block height, previous hash, Merkle root, transaction list hash, nonce, and the miner's public key identifier field"] },
        { q: "How does Bitcoin settlement compare to the \"instant\" transfers promoted by retail banking?", a: "Bank transfers are IOUs between institutions; Bitcoin achieves irreversible on-chain settlement in roughly 10 minutes", wrong: ["Both achieve true final settlement instantly; the only difference is Bitcoin's settlement is public while bank transfers are private", "Bitcoin settlement takes 3–5 business days like wire transfers; the 10-minute block time is only for initial confirmation", "Fiat transfers settle on delivery while Bitcoin requires a 72-hour grace period for large transactions over 1 BTC value"] },
        { q: "What is the Bitcoin mempool and how do miners interact with it?", a: "It's the waiting room for unconfirmed transactions; miners select from it and prioritize higher-fee transactions for inclusion", wrong: ["It's a permanent archive of all confirmed transactions that nodes must query to validate each new incoming spending attempt", "It's a shared pool where miners deposit newly minted coins before distributing them back to senders as transaction change", "It's a registry of known peer node addresses used to discover and connect to other participants on the Bitcoin network"] },
        { q: "How does Bitcoin's transaction finality compare to SWIFT international bank transfers?", a: "Bitcoin reaches practical finality in about 1 hour (6 confirmations); SWIFT international transfers take 1–5 business days", wrong: ["Bitcoin finality takes 24 hours for large transactions; SWIFT now settles in under 2 hours for standard bank-to-bank wires", "Both systems achieve finality in roughly the same timeframe; the meaningful difference is in cost rather than settlement speed", "Bitcoin reaches finality in under 1 minute with Taproot active; SWIFT settles same-day under the ISO 20022 standard"] },
        { q: "Why is altering a historical Bitcoin block effectively impossible once buried under sufficient work?", a: "Changing any block invalidates every subsequent block's hash, forcing an attacker to redo all downstream proof-of-work", wrong: ["Changing a block triggers a cryptographic alarm that immediately alerts all nodes causing automatic rejection of the edit", "Each block is countersigned by a quorum of miners who must all re-sign any proposed modifications to historical records", "Historical blocks are stored in read-only memory on every Bitcoin node, making any write operation physically impossible"] }
    ],
    "analogies": [
        { q: "In the airport analogy, Lightning is like:", a: "A bicycle courier in the terminal", wrong: ["The main runway used for all departing flights", "A large cargo aircraft transporting bulk shipments", "The central air traffic control tower overhead"] },
        { q: "Bitcoin is often compared to:", a: "Digital gold", wrong: ["Digital silver", "Digital stocks", "Digital bonds"] },
        { q: "The Bitcoin network is sometimes compared to:", a: "The internet protocol (TCP/IP)", wrong: ["A single popular website on the internet", "A private encrypted telephone voice call", "A cable television broadcasting channel"] },
        { q: "Holding Bitcoin is compared to:", a: "Holding property in cyberspace", wrong: ["Renting a digital movie through a streaming app", "Subscribing to a recurring monthly online service", "Opening a savings account at a traditional bank"] },
        { q: "Nick Szabo's pre-Bitcoin proposal for digital scarce money was called:", a: "Bit Gold", wrong: ["Digital Cash", "E-Gold", "Digi-Buck"] }
    ],
    "byzantine_generals__problem": [
        { q: "The Byzantine Generals Problem is about:", a: "Reaching agreement when some participants may be dishonest", wrong: ["Coordinating siege tactics across multiple castle walls with limited messengers", "Tracking the value and secure movement of physical gold bullion between allies", "Delivering encrypted military messages securely across hostile enemy territory"] },
        { q: "Bitcoin solved the Byzantine Generals Problem using:", a: "Proof of Work consensus", wrong: ["Delegated voting by peers", "A trusted coordinator node", "Public key encryption alone"] },
        { q: "In the analogy, the generals need to:", a: "Coordinate an attack without a trusted messenger", wrong: ["Build a defensive wall around the city without sharing blueprints", "Trade supplies with each other without meeting in person", "Sign a peace treaty by sending letters through enemy territory"] },
        { q: "Before Bitcoin, the Byzantine Generals Problem was considered:", a: "Unsolvable in a trustless digital environment", wrong: ["A trivial problem solved by any standard encryption library", "An outdated concept that modern networking had made obsolete", "Fully resolved by existing public key infrastructure systems"] },
        { q: "The Byzantine Generals Problem asks how dispersed parties can reach consensus without trusting each other. What mechanism did Bitcoin invent to solve this?", a: "Nakamoto Consensus (proof-of-work + longest chain)", wrong: ["Delegated voting by a supermajority of elected validator nodes", "A centralized coordinator server that timestamps all messages", "Proof of stake with randomized leader selection each round"] }
    ],
    "game_theory": [
        { q: "Bitcoin's incentive structure uses:", a: "Game theory to align participants", wrong: ["Legal penalties and fines to deter cheaters", "Signed contracts enforceable in court", "Social trust among known community members"] },
        { q: "Miners are incentivized to be honest because:", a: "Cheating costs more than playing by the rules", wrong: ["They are required to sign legal agreements before mining", "Government regulators audit and monitor their operations", "The protocol distributes rewards equally regardless of effort"] },
        { q: "Nash Equilibrium in Bitcoin means:", a: "No participant benefits from changing their strategy alone", wrong: ["Every miner must contribute exactly equal computational power", "Bitcoin's exchange rate stays stable regardless of supply changes", "All nodes in the network must run identical hardware and software"] },
        { q: "The prisoner's dilemma relates to Bitcoin because:", a: "Cooperation is more profitable than defection", wrong: ["Miners who break the rules get permanently banned by the network", "Bitcoin transactions require approval from a central authority", "All participants are legally bound to follow the open protocol"] },
        { q: "What game theory concept explains why Bitcoin miners are incentivized to stay honest rather than attack the network?", a: "Nash equilibrium - attacking costs more than honest mining", wrong: ["Prisoner's dilemma - miners always defect when reward is higher", "Zero-sum dynamics - every hash one miner gains another miner loses", "Pareto efficiency - all miners simultaneously maximize their profits"] }
    ],
    "elevator_pitches": [
        { q: "A good Bitcoin elevator pitch should be:", a: "Simple and compelling in under a minute", wrong: ["A thorough two-hour technical deep-dive seminar", "Focused entirely on recent price chart performance", "As jargon-heavy and technically complex as possible"] },
        { q: "When explaining Bitcoin to beginners, start with:", a: "The problem it solves (broken money)", wrong: ["How mining hardware and hashing algorithms work", "Cryptographic signatures and merkle tree structures", "Exchange fees and how to pick the right trading pair"] },
        { q: "The simplest Bitcoin pitch is often:", a: "Digital money that no one can print or confiscate", wrong: ["A get-rich-quick asset designed for speculative investors", "A rewards point system for making internet purchases", "A new digital bank for borderless online payments"] },
        { q: "How would you explain Bitcoin to a complete newcomer in one sentence?", a: "A digital form of money that no government or company can print, freeze, or control", wrong: ["A speculative digital asset whose price rises whenever institutional investors decide to buy in", "A digital payment card for online purchases that bypasses banks but still relies on card networks", "An interest-bearing savings account that uses blockchain technology to offer returns above banks"] },
        { q: "What is the most important feature for Bitcoin newcomers to understand first?", a: "Nobody can confiscate or freeze your bitcoin if you hold your own keys", wrong: ["The price tends to appreciate over time, making it a superior long-term investment strategy", "It functions like anonymous cash and leaves absolutely no traceable record on any public ledger", "Sending bitcoin anywhere in the world is always instant and completely free of any transaction fees"] }
    ],
    "taproot": [
        { q: "Taproot is a Bitcoin:", a: "Upgrade that improves privacy and smart contracts", wrong: ["A new altcoin forked from the main Bitcoin network", "A faster proof-of-work mining algorithm for Bitcoin", "A regulated exchange platform built on Bitcoin rails"] },
        { q: "Taproot was activated in:", a: "November 2021", wrong: ["August 2017", "March 2019", "April 2024"] },
        { q: "Taproot uses Schnorr signatures which:", a: "Make multi-sig transactions look like regular ones", wrong: ["Speed up block validation by parallelizing hash computations", "Generate new coins by merging multiple block reward outputs", "Delete old unspent outputs to reduce total blockchain storage"] },
        { q: "Taproot improves:", a: "Privacy, efficiency, and smart contract capabilities", wrong: ["Mining speed, network latency, and hardware throughput only", "Block size limits, hash rate targets, and fee market dynamics", "Transaction fees, confirmation times, and dust output thresholds"] },
        { q: "What type of signature scheme did Taproot introduce to Bitcoin?", a: "Schnorr signatures", wrong: ["RSA digital signatures", "ECDSA ring signatures", "BLS aggregate signatures"] },
        { q: "Taproot improves Bitcoin by:", a: "Enhancing privacy, efficiency, and smart contract capabilities using Schnorr signatures", wrong: ["Increasing the maximum coin supply beyond 21 million by unlocking additional miner reward multipliers", "Eliminating the need for proof-of-work mining by switching to a validator-based staking consensus model", "Making every Bitcoin transaction fully anonymous and untraceable by permanently obscuring all addresses"] },
        { q: "When was the Taproot upgrade activated on Bitcoin?", a: "November 2021 at block 709,632", wrong: ["August 2017 at block 481,824", "January 2009 at block 0 as defined by Bitcoin consensus rules enforced by all full nodes", "April 2024 at block 840,000"] },
        { q: "What is MAST (Merkelized Abstract Syntax Trees) in Taproot?", a: "A structure that reveals only the executed spending condition, hiding unused conditions for privacy", wrong: ["A replacement mining algorithm for SHA-256 that speeds up proof-of-work block production on Bitcoin", "A Lightning channel variant that uses hashed time-lock contracts to route payments across multiple hops", "An off-chain database system that caches smart contract execution state between on-chain settlements"] },
        { q: "How does Taproot improve multi-signature transactions?", a: "Schnorr signatures allow multiple signers to produce a single compact signature indistinguishable from a regular one", wrong: ["Taproot fully removes the requirement for multiple signatures by automatically converting all multi-sig scripts to single-key spends", "Each participant's signature is stored in a separate dedicated block on-chain so validators can independently verify each signer later", "All signing parties are required to be simultaneously online so the coordinator node can collect and aggregate approval keys in real time"] },
        { q: "What is Tapscript?", a: "An updated version of Bitcoin Script that enables new opcodes and improved scripting with Taproot", wrong: ["A standalone programming language for writing and deploying new altcoin smart contracts on external sidechains", "A developer command-line utility for submitting and reviewing proposed consensus patches to the Bitcoin Core client", "The dedicated scripting engine used exclusively by the Lightning Network to enforce payment channel closing conditions"] }
    ],
    "scalability": [
        { q: "Bitcoin base layer processes roughly:", a: "7 transactions per second", wrong: ["Around 7 million per second", "About one every 10 minutes", "Roughly 100,000 per second"] },
        { q: "Bitcoin scales primarily through:", a: "Layer 2 solutions like Lightning", wrong: ["Larger base-chain block sizes", "Removing the block size limit", "Faster hardware on full nodes"] },
        { q: "The block size limit exists to:", a: "Keep node requirements low and maintain decentralization", wrong: ["Artificially cap network growth so that adoption stays small", "Allow miners to collect higher fees on every completely full block", "Restrict daily throughput so that only high-value users get priority"] },
        { q: "The Blocksize Wars were about:", a: "Whether to increase block size or use Layer 2", wrong: ["Whether Bitcoin mining rewards were economically sustainable", "Who holds the legal rights to the Bitcoin name and trademark", "Which cryptocurrency exchange should be the official BTC venue"] },
        { q: "Bitcoin's block size is limited to approximately:", a: "1-4 MB (with SegWit)", wrong: ["100 MB as defined by Bitcoin consensus rules enforced by all full nodes", "Unlimited - it grows with demand", "1 KB as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "What did SegWit (Segregated Witness) do for Bitcoin scalability?", a: "Separated signature data from transaction data, effectively increasing block capacity to ~2 MB equivalent", wrong: ["Raised the raw block size limit from 1 MB to 2 MB by modifying the block header format in the base protocol", "Removed all block size restrictions so that miners could freely include as many transactions as they desired", "Migrated all transaction validation to a parallel sidechain that batch-settles its state back to mainchain regularly"] },
        { q: "What is transaction batching?", a: "Combining multiple payments into a single on-chain transaction to save block space and fees", wrong: ["Sending the same transaction repeatedly to different nodes to guarantee reliable and confirmed network delivery", "Organizing all pending mempool transactions by the sender's country before miners include them in a block", "Holding all pending payments in a queue and submitting them only after the current block has reached full capacity"] },
        { q: "Why did the Bitcoin community reject simply raising the block size limit?", a: "Larger blocks increase node operating costs, risking centralization and reducing censorship resistance", wrong: ["Larger blocks would make Bitcoin easier for governments to track and censor transactions globally", "Satoshi deliberately designed the 1 MB cap as permanent and warned against ever raising it", "Larger blocks would speed transactions so much that the mining difficulty algorithm would break"] },
        { q: "How does the Lightning Network improve Bitcoin's throughput?", a: "By processing millions of transactions off-chain and only settling final balances on the Bitcoin blockchain", wrong: ["By replacing Bitcoin's slow blockchain with a faster parallel ledger that periodically merges back into the main chain", "By increasing the block size limit to 100 MB so thousands of additional transactions can fit into every block", "By reducing the time between Bitcoin blocks to one second, dramatically increasing total on-chain throughput"] },
        { q: "What is payment channel batching on Lightning?", a: "Opening or closing multiple channels in a single on-chain transaction to save fees and block space", wrong: ["Sending a single Lightning payment simultaneously to multiple recipients using one shared payment hash", "Mining several blocks in rapid succession so more channel open and close transactions can be confirmed", "Compressing multiple Lightning transaction signatures together to reduce byte size and speed up routing"] }
    ],
    "utxos": [
        { q: "UTXO stands for:", a: "Unspent Transaction Output", wrong: ["Universal Token Exchange Order", "Unified Transaction eXecution Object", "Ultra-fast Transfer of eXchange Operations"] },
        { q: "A UTXO is like:", a: "A specific bill in your wallet that you spend whole", wrong: ["A running total of all your Bitcoin deposits and withdrawals", "A credit line assigned to your Bitcoin address by the network", "A numbered entry in your wallet's shared account balance ledger"] },
        { q: "When you spend a UTXO:", a: "It's consumed entirely and change is returned as a new UTXO", wrong: ["Only the amount you spend is deducted while the remainder stays in the same output", "It stays locked in your wallet until the recipient confirms they received the funds", "It temporarily freezes on the blockchain and is unlocked after miner confirmation"] },
        { q: "UTXO management matters for:", a: "Privacy and minimizing future transaction fees", wrong: ["Maximizing mining rewards and block confirmation speed", "Speeding up network sync and reducing total block creation time", "Lowering full node hardware requirements and long-term storage"] },
        { q: "What is a UTXO in Bitcoin?", a: "Unspent Transaction Output - the amount of bitcoin remaining after a transaction", wrong: ["A Unified Transaction Order — a queue of pending transactions awaiting block inclusion", "A mining reward token given to validators each time they confirm a new Bitcoin block", "A Unique Transaction Origin — the digital address marker attached to each outgoing payment"] }
    ],
    "dust": [
        { q: "Bitcoin \"dust\" is:", a: "An amount too small to spend because the fee exceeds the value", wrong: ["Bitcoin permanently deleted from supply when a private key is irreversibly lost", "Leftover chain data that full nodes must periodically clear to stay synchronized", "A regulatory label for bitcoin amounts below minimum legal reporting thresholds"] },
        { q: "Dust attacks are used to:", a: "Track and deanonymize wallet owners", wrong: ["Steal bitcoin directly from targeted wallets", "Flood the mempool and slow down mining confirmations", "Create fake addresses to inflate the UTXO set artificially"] },
        { q: "To avoid dust issues:", a: "Consolidate small UTXOs when fees are low", wrong: ["Delete all UTXOs that fall below the current dust limit", "Stop accepting any incoming Bitcoin payments entirely", "Move all Bitcoin to an exchange custodial wallet instead"] },
        { q: "What is a \"dust attack\" in Bitcoin?", a: "Sending tiny amounts of bitcoin to wallets to track and de-anonymize users", wrong: ["Flooding the network with oversized transactions to delay block confirmations for everyone", "Static electricity buildup that physically damages Bitcoin ASIC mining hardware over time", "A software bug in Bitcoin Core that lets malicious miners insert unauthorized fake outputs"] },
        { q: "Why should users consolidate small UTXOs when fees are low?", a: "To reduce future transaction costs, as each UTXO adds to transaction size", wrong: ["To increase bitcoin's market value by permanently reducing the circulating supply", "To improve wallet privacy by merging all addresses into a single combined identifier", "To qualify for mining rewards that are only paid to wallets holding fewer UTXOs"] }
    ],
    "rbf": [
        { q: "RBF stands for:", a: "Replace-By-Fee", wrong: ["Really Big Fee", "Rapid Block Finality", "Return Bitcoin Fast"] },
        { q: "RBF allows you to:", a: "Bump a stuck transaction's fee to speed confirmation", wrong: ["Cancel any unconfirmed transaction and reclaim the full amount sent", "Send Bitcoin without paying fees during low-traffic mempool periods", "Mine your own blocks to confirm your transactions ahead of the queue"] },
        { q: "RBF is useful when:", a: "Your transaction is stuck because the fee was too low", wrong: ["You want to speed up your node's sync with the broader Bitcoin network", "Your wallet software version is outdated and needs a full security update", "You want to swap your Bitcoin for a lower-fee altcoin at a better rate"] },
        { q: "What does RBF (Replace-by-Fee) allow users to do?", a: "Replace an unconfirmed transaction with a higher-fee version", wrong: ["Reverse a confirmed transaction by broadcasting a corrected replacement", "Increase their bitcoin balance by reclaiming fees from prior failed transactions", "Prevent double-spending by locking a transaction the moment it hits the mempool"] },
        { q: "What is CPFP (Child Pays for Parent) used for?", a: "Accelerating confirmation by spending an unconfirmed output with a high-fee transaction", wrong: ["Splitting a parent transaction's bitcoin equally across multiple child receiving addresses", "Creating a new child wallet that inherits all pending unconfirmed outputs from the parent", "Shrinking the byte size of a parent transaction by compressing it with a child signature"] }
    ],
    "time_preference": [
        { q: "Low time preference means:", a: "Saving for the future instead of spending now", wrong: ["Spending all your money as quickly as you earn it", "Not worrying about money or future financial needs at all", "Day trading assets constantly to maximize short-term returns"] },
        { q: "Bitcoin encourages low time preference because:", a: "Its value tends to increase over time due to scarcity", wrong: ["Its price tends to decline steadily, making it costly to hold long-term", "It pays annual interest rewards directly to long-term wallet holders", "Governments mandate Bitcoin savings requirements for all citizens by law"] },
        { q: "High time preference leads to:", a: "Overconsumption and debt", wrong: ["Long-term wealth accumulation", "Increased savings and capital", "Personal financial security"] },
        { q: "Fiat currency encourages:", a: "Spending now because money loses value over time", wrong: ["Long-term saving since fiat money reliably retains purchasing power", "Low time preference by rewarding those who patiently defer spending", "Financial discipline by linking the money supply to gold reserves"] },
        { q: "What is \"low time preference\" in Bitcoin culture?", a: "Prioritizing long-term saving over short-term spending", wrong: ["Trading Bitcoin frequently to capture short-term gains", "Spending Bitcoin before each halving to avoid potential value loss", "Watching price charts closely and acting on every short-term market swing"] },
        { q: "A Bitcoin standard encourages low time preference because:", a: "Saving is rewarded since the money appreciates over time", wrong: ["Bitcoin's slow transaction speeds make frequent daily spending impractical", "Government regulations require minimum Bitcoin holding periods for all users", "Bitcoin protocol rules restrict each address to selling only once per calendar year"] },
        { q: "What does \"low time preference\" mean in the context of Bitcoin?", a: "Prioritizing long-term value and future rewards over immediate gratification", wrong: ["Preferring to spend Bitcoin quickly before volatility causes its value to drop", "Setting a firm deadline on how long to hold Bitcoin before converting to cash", "Trading Bitcoin on short timeframes to maximize returns ahead of each halving"] },
        { q: "How does fiat money encourage high time preference?", a: "Inflation erodes purchasing power, incentivizing spending now rather than saving for later", wrong: ["Fiat currency expires after a government-set date, forcing people to spend it before it becomes void", "Banks charge escalating fees on idle cash balances, making holding money costlier than spending it", "Governments levy heavy taxes on savings accounts while fully exempting everyday consumer spending"] },
        { q: "Why do Bitcoiners say Bitcoin \"fixes\" time preference?", a: "A deflationary hard money incentivizes saving and long-term thinking since purchasing power increases over time", wrong: ["Bitcoin automatically stakes your savings in yield protocols, rewarding holders for their extended patience", "Bitcoin transactions are deliberately slower than traditional banking, which naturally trains users toward patience", "Bitcoin wallet software enforces a one-year minimum hold period, preventing impulsive short-term spending decisions"] },
        { q: "How does time preference relate to civilization building?", a: "Lower time preference leads to more capital accumulation, investment, and long-term infrastructure development", wrong: ["Higher time preference actually builds civilizations faster because immediate consumption drives stronger economic growth", "Time preference has no proven relationship to economic development according to mainstream economic theory today", "Only governments and central banks have the power to effectively lower the collective time preference of entire societies"] },
        { q: "According to Saifedean Ammous in \"The Bitcoin Standard,\" what is the relationship between sound money and time preference?", a: "Sound money lowers time preference, encouraging saving and long-term investment", wrong: ["Sound money raises time preference because people rush to spend appreciating currency", "There is no meaningful relationship between money type and individual time preference", "Sound money eliminates time preference entirely, making people fully indifferent to timing"] },
        { q: "How does Ammous argue that low time preference connects to civilization building?", a: "People invest in long-term projects when money reliably holds its value", wrong: ["Civilizations advance fastest when people spend money as quickly as possible", "Low time preference leads to stagnation because nobody takes any risks", "Civilization building is completely unrelated to the monetary system"] },
        { q: "What behavioral effect does fiat money have on time preference according to the Austrian economics perspective?", a: "Fiat raises time preference - inflation punishes savers and rewards debtors", wrong: ["Fiat lowers time preference because stable inflation aids long-term planning", "Fiat has no effect on time preference, which is determined by culture", "Fiat encourages saving because interest rates compensate for inflation"] },
        { q: "How does the concept of delayed gratification relate to Bitcoin and sound money?", a: "Sound money rewards patience by preserving purchasing power over time", wrong: ["Delayed gratification is irrelevant to any monetary system design", "Bitcoin punishes patience because its price is far too volatile", "Sound money discourages waiting by making everything too expensive"] },
        { q: "What is the key difference between how fiat and Bitcoin influence personal financial behavior?", a: "Fiat incentivizes consumption and debt; Bitcoin incentivizes saving", wrong: ["Both systems produce identical behavior - spending stays the same", "Bitcoin makes people spend more as they feel wealthy from gains", "Fiat encourages saving; Bitcoin encourages spending due to deflation"] }
    ],
    "soft_vs_hard_forks": [
        { q: "A soft fork is:", a: "Backward-compatible upgrade", wrong: ["A complete network shutdown", "A deletion of all old rules", "A new altcoin token launch"] },
        { q: "A hard fork creates:", a: "A permanent chain split if not everyone upgrades", wrong: ["A temporary network pause until all nodes resync to the new rules", "A free distribution of newly generated Bitcoin to all existing holders", "A permanently faster network with shorter block times and higher throughput"] },
        { q: "Bitcoin Cash was created by:", a: "A hard fork of Bitcoin in 2017", wrong: ["A soft fork of Bitcoin in 2015", "A proposal rejected by Bitcoin miners in 2016", "A merger between Bitcoin and Litecoin developers"] },
        { q: "SegWit was activated as:", a: "A soft fork", wrong: ["A hard fork", "A new blockchain", "An altcoin"] },
        { q: "The key difference between a soft fork and a hard fork is:", a: "Soft forks are backwards-compatible; hard forks are not", wrong: ["Soft forks are optional upgrades; hard forks are forced on all nodes", "Soft forks affect only miners; hard forks require every wallet to upgrade", "Soft forks are reversible changes; hard forks permanently alter the chain"] },
        { q: "The Blocksize Wars resulted in:", a: "Bitcoin Cash splitting off as a hard fork while Bitcoin kept small blocks + SegWit", wrong: ["Bitcoin permanently increasing its block size to 2MB after a global miner referendum in 2017", "A compromise upgrade merging SegWit with 4MB blocks that satisfied both the big-block and small-block camps", "The entire Bitcoin mining network temporarily migrating to Bitcoin Cash before returning to Bitcoin"] },
        { q: "What is a soft fork in Bitcoin?", a: "A backward-compatible protocol upgrade where old nodes still accept new blocks", wrong: ["A protocol change that temporarily halts the blockchain while all nodes download new software", "A network split that divides the chain into two equal parts before eventually reconnecting", "A mining rule change that requires all node operators to manually approve before it activates"] },
        { q: "What is a hard fork?", a: "A non-backward-compatible change that requires all nodes to upgrade or they'll follow a different chain", wrong: ["A scheduled software maintenance that pauses the network while all nodes synchronize to the new rules", "A minor protocol refinement automatically accepted by 51% of miners without requiring any node upgrades", "A security patch that nodes can optionally apply to improve performance without changing any consensus rules"] },
        { q: "What was the Bitcoin Cash (BCH) hard fork about?", a: "A disagreement over scaling - BCH proponents wanted larger blocks while Bitcoin kept the 1 MB base limit with SegWit", wrong: ["A conflict over who owned the Bitcoin trademark and had the legal right to use the name for their competing network", "A dispute over replacing proof-of-work with a faster consensus mechanism that BCH developers wanted to adopt first", "A disagreement about mandatory privacy features that BCH proposed adding while Bitcoin Core developers firmly rejected"] },
        { q: "Why are soft forks generally preferred over hard forks for Bitcoin upgrades?", a: "They maintain backward compatibility, don't force upgrades, and don't risk splitting the network", wrong: ["They require unanimous approval from all miners and are significantly faster to deploy than any hard fork alternative", "They permanently lower transaction fees and improve block propagation speed for every participant on the network", "They have never caused disruption and must be formally endorsed by the Bitcoin Foundation before activation"] }
    ],
    "fedimints": [
        { q: "Fedimint helps with:", a: "Community custody with privacy", wrong: ["Peer-to-peer exchange with fees", "Pooled mining with shared rewards", "On-chain transaction batching"] },
        { q: "A Fedimint uses:", a: "Federated guardians who jointly custody Bitcoin", wrong: ["A single appointed trustee who manages all user deposits", "A regulated bank that holds and insures all user funds", "An automated smart contract that controls all withdrawals"] },
        { q: "Fedimint provides privacy through:", a: "Chaumian eCash tokens", wrong: ["Zero-knowledge proofs", "Ring signature schemes", "Stealth address mixing"] },
        { q: "Fedimints are designed for:", a: "Communities that trust each other but want privacy", wrong: ["Individuals who prefer to keep all their Bitcoin on exchanges", "Businesses that need government-compliant custodial accounts", "Miners who want to pool rewards and share custody with partners"] },
        { q: "A Fedimint (Federated Mint) provides:", a: "Community-custodial privacy through Chaumian ecash on Bitcoin", wrong: ["A decentralized exchange for swapping Bitcoin without any KYC process", "A pooled mining protocol where communities share block rewards equally", "A layer-2 scaling solution that increases Bitcoin's transactions per second"] },
        { q: "Fedimints improve Bitcoin privacy by:", a: "Using blinded signatures so the mint cannot link deposits to withdrawals", wrong: ["Storing all transaction records on a private sidechain only the guardians can read", "Requiring every user to generate a fresh address for each new deposit into the mint", "Routing all payments through multiple Lightning hops in order to obscure the sender's origin"] },
        { q: "What is a Fedimint?", a: "A federated Chaumian eCash mint where a group of guardians custody Bitcoin and issue private eCash tokens", wrong: ["A decentralized exchange run by a committee of validators who approve every trade before it settles", "A layer-2 protocol where elected miners vote on valid transactions before they are confirmed on-chain", "A multi-signature wallet where all community members share equal signing authority over the pooled funds"] },
        { q: "How do Fedimints provide privacy?", a: "Using blind signatures so the mint cannot link who deposited Bitcoin with who redeems eCash tokens", wrong: ["By routing every deposit through a series of on-chain mixer contracts before issuing any eCash token", "By keeping all user balances in an encrypted database that only the lead guardian is permitted to access", "By requiring a zero-knowledge proof from each user confirming fund ownership before any withdrawal is processed"] },
        { q: "What is the trust model of a Fedimint?", a: "Users trust a federation of guardians (e.g., 3-of-5 multisig) rather than a single custodian", wrong: ["Users trust an automated smart contract that enforces all withdrawal rules without any human involvement", "All funds are protected by a government deposit insurance program that replaces individual custodians", "Users trust the open-source code alone with no custodians since funds are locked by on-chain proofs"] },
        { q: "How do Fedimints interact with the Lightning Network?", a: "They can send and receive Lightning payments, allowing private transactions with the broader Bitcoin network", wrong: ["They operate as dedicated Lightning routing nodes that earn fees forwarding payments on behalf of users", "They issue Bitcoin-backed stablecoins that can be transferred across the broader Lightning payment network", "They bypass Lightning entirely and settle all payments directly on the Bitcoin base layer via batch transactions"] }
    ],
    "books": [
        { q: "The Bitcoin Standard is a popular book about:", a: "Sound money and Bitcoin economics", wrong: ["Gold standard history and fiat money policy", "Bitcoin mining hardware and pool management", "Day trading strategies and chart analysis"] },
        { q: "Mastering Bitcoin by Andreas Antonopoulos is:", a: "A technical deep-dive into how Bitcoin works", wrong: ["A beginner's guide to buying and holding Bitcoin safely", "A legal handbook for reporting cryptocurrency taxes correctly", "A financial guide to building generational wealth through crypto"] },
        { q: "The Sovereign Individual predicted:", a: "Digital money and the decline of nation-states", wrong: ["The rise of social media and the collapse of individual privacy", "Digital currencies issued and controlled exclusively by central banks", "The collapse of global free trade and the return of local economies"] },
        { q: "21 Lessons by Gigi explores:", a: "Philosophical lessons learned from going down the Bitcoin rabbit hole", wrong: ["A beginner's practical guide to mining Bitcoin profitably from a home setup", "Twenty-one step-by-step tutorials for building Lightning Network payment channels", "The personal stories of early Bitcoin adopters who became millionaires before 2020"] },
        { q: "\"The Bitcoin Standard\" by Saifedean Ammous primarily argues:", a: "Bitcoin is the hardest money ever invented and will replace fiat", wrong: ["Bitcoin is innovative but remains too volatile to ever function as reliable money", "Bitcoin is useful as an asset class but was never designed to replace government fiat", "Governments will regulate Bitcoin into irrelevance before it can seriously threaten fiat"] },
        { q: "Gigi's \"21 Lessons\" is structured around:", a: "21 philosophical, economic, and technical lessons learned from Bitcoin", wrong: ["A 21-day step-by-step plan for complete beginners to start investing in Bitcoin", "Profiles of the 21 wealthiest early Bitcoin adopters and their investing strategies", "An analysis of 21 altcoin failures and what they reveal about the cryptocurrency market"] },
        { q: "Who wrote \"The Bitcoin Standard\"?", a: "Saifedean Ammous", wrong: ["Andreas Antonopoulos", "Satoshi Nakamoto", "Michael Saylor"] },
        { q: "What book by Jimmy Song teaches Bitcoin programming and development?", a: "Programming Bitcoin", wrong: ["The Bitcoin Standard", "Digital Gold as defined by Bitcoin consensus rules enforced by all full nodes", "Cryptoassets as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "What book by Lyn Alden provides a broad investment perspective including Bitcoin?", a: "Broken Money", wrong: ["The Bitcoin Standard", "Digital Gold", "The Internet of Money"] },
        { q: "What is \"The Blocksize War\" by Jonathan Bier about?", a: "The history of Bitcoin's scaling debate, SegWit activation, and the BCH fork", wrong: ["A technical guide to optimizing block size parameters and improving Bitcoin mining efficiency", "A historical account of the Ethereum versus Bitcoin rivalry and the subsequent rise of DeFi", "A fictional thriller about competing mining cartels fighting for control of the global blockchain"] }
    ],
    "misconceptions-fud": [
        { q: "FUD stands for:", a: "Fear, Uncertainty, and Doubt", wrong: ["Fundamental Upgrade Directive", "Financial Utility and Demand", "Fork, Upgrade, and Deploy"] },
        { q: "\"Bitcoin is used by criminals\" ignores that:", a: "Cash is used far more for crime and Bitcoin is traceable", wrong: ["Bitcoin is fully anonymous and law enforcement cannot trace any transactions", "Most global illicit activity today is exclusively financed using Bitcoin", "No government agency has ever successfully traced a Bitcoin transaction to a criminal"] },
        { q: "\"Bitcoin has no intrinsic value\" ignores:", a: "Its network security, scarcity, and utility", wrong: ["Its government backing and central bank reserve status", "The value assigned to it by global commodity futures exchanges", "Its ability to be redeemed for physical precious metals on demand"] },
        { q: "\"Bitcoin is too volatile\" ignores:", a: "Its long-term upward trend and decreasing volatility over time", wrong: ["That traditional equities have historically shown far higher volatility than Bitcoin", "That gold experienced equivalent price swings before becoming a widely accepted store of value", "Historical data showing major fiat currencies fluctuate more than Bitcoin across multi-year periods"] },
        { q: "\"Bitcoin wastes energy\" ignores:", a: "Its use of stranded/renewable energy and the value it secures", wrong: ["That conventional banking infrastructure consumes far more total energy than all Bitcoin miners combined", "Studies showing that Bitcoin mining energy use is fully offset by purchased renewable energy certificates", "That all proof-of-work mining is legally required to run on certified excess renewable power from grids"] },
        { q: "How do Bitcoiners respond to \"Bitcoin is too volatile to be money\"?", a: "Every 4-year period has been profitable and volatility decreases over time", wrong: ["They concede that Bitcoin's price swings make it unsuitable as a reliable medium of daily exchange", "They argue volatility only appears because of speculative trading and fully disappears with mass adoption", "They claim Bitcoin miners actively stabilize the price by adjusting the block reward at key price levels"] },
        { q: "Why is the claim \"quantum computers will break Bitcoin\" misleading?", a: "Such computers don't exist yet and Bitcoin can upgrade before they do", wrong: ["Bitcoin already uses quantum-resistant encryption algorithms by default", "Quantum computers are proven to actually strengthen Bitcoin's network security", "Satoshi specifically designed Bitcoin to be immune to all future computing advances"] },
        { q: "What is the rebuttal to \"Tether (USDT) props up Bitcoin's price\"?", a: "Bitcoin grew for years before Tether and kept rising through its controversies", wrong: ["Tether holds 100% of its cash reserves in Bitcoin and annual audits confirm this", "Bitcoin's price is determined solely by the energy cost required to mine each coin", "Tether was created alongside Bitcoin by Satoshi as an integrated stable reserve layer"] },
        { q: "Why is \"Bitcoin is a pyramid scheme\" factually wrong?", a: "It has no company, no CEO, no return promises, and no recruitment profits", wrong: ["Because early adopters are guaranteed investment returns directly by the protocol", "Because Satoshi Nakamoto still privately operates the foundation behind Bitcoin", "Because the Bitcoin protocol automatically pays dividends to all long-term holders"] },
        { q: "What is the strongest argument against \"governments will ban Bitcoin\"?", a: "China banned it multiple times yet it kept growing, and the US approved ETFs", wrong: ["Governments lack reliable tools to actually monitor or intercept Bitcoin activity", "International law explicitly prevents any nation from restricting digital currencies", "Bitcoin's protocol automatically disables itself in any country that formally bans it"] }
    ],
    "satoshi-nakamoto": [
        { q: "Satoshi Nakamoto:", a: "Stepped down and disappeared", wrong: ["Is currently the CEO of Bitcoin", "Was arrested as defined by Bitcoin consensus rules enforced by all full nodes", "Sold all Bitcoin as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "Satoshi's last known communication was around:", a: "2011", wrong: ["2020", "2015", "2009"] },
        { q: "Satoshi's Bitcoin holdings are estimated at:", a: "About 1 million BTC that have never moved", wrong: ["None at all - Satoshi deliberately never mined any Bitcoin", "Roughly 100 BTC earned only from the very first blocks", "The entire 21 million BTC supply was pre-mined by Satoshi"] },
        { q: "Satoshi's disappearance is seen as:", a: "A feature - it made Bitcoin truly decentralized", wrong: ["A critical bug that severely weakened Bitcoin's ongoing development", "A deliberate crime committed to avoid paying taxes on Bitcoin profits", "A planned marketing strategy designed to generate media attention and hype"] },
        { q: "Satoshi's true identity is:", a: "Unknown - it could be one person or a group", wrong: ["Confirmed to be Elon Musk based on an FBI forensic investigation", "Identified as a retired CIA analyst operating under a government alias", "Revealed to be a sitting US President who acted under strict secrecy"] },
        { q: "Why is it important that Satoshi Nakamoto disappeared?", a: "Bitcoin has no leader who can be arrested, corrupted, or pressured", wrong: ["Because Satoshi was actively being sought by law enforcement for financial crimes", "So they could secretly continue accumulating Bitcoin without drawing public scrutiny", "Because the entire codebase was considered complete and required absolutely no further work"] },
        { q: "What evidence suggests Satoshi Nakamoto was likely one person rather than a team?", a: "Consistent writing style, coding patterns, and posting times across years of activity", wrong: ["A signed public confession that was posted and later quietly deleted from the Bitcoin Talk forum", "DNA and fingerprint evidence discovered on hardware used to run the original Bitcoin node", "A classified government investigation that officially confirmed Satoshi was a single known individual"] },
        { q: "When did Satoshi Nakamoto stop posting publicly?", a: "Around December 2010, with a final known post in April 2011", wrong: ["In January 2009, just a few days after the Bitcoin network first went live", "They never fully stopped and are widely believed to still post anonymously today", "Around mid-2015 during the peak of the heated block size scaling debate"] },
        { q: "How many Bitcoin did Satoshi Nakamoto reportedly mine?", a: "Approximately 1 million BTC based on analysis of early mining patterns", wrong: ["Exactly 21 million BTC, since Satoshi pre-mined the entire fixed total supply", "Zero BTC in total, as Satoshi deliberately chose never to mine any coins at all", "Roughly 100 BTC earned exclusively by mining only the original genesis block"] },
        { q: "What famous message did Satoshi embed in the Bitcoin genesis block?", a: "\"The Times 03/Jan/2009 Chancellor on brink of second bailout for banks\"", wrong: ["\"Hello World - the Bitcoin network is now live and open to the entire world\"", "\"In cryptography we trust - a peer to peer electronic cash system begins today\"", "\"The revolution will not be centralized - the age of digital cash is now upon us\""] }
    ],
    "history": [
        { q: "The Bitcoin Genesis Block was mined in:", a: "January 2009", wrong: ["October 2008", "June 2010", "December 2007"] },
        { q: "The first real-world Bitcoin transaction was:", a: "10,000 BTC for two pizzas", wrong: ["5,000 BTC traded for a used car", "1,000 BTC paid for a small house", "50 BTC spent on a single cup of coffee"] },
        { q: "Bitcoin Pizza Day is celebrated on:", a: "May 22", wrong: ["January 3", "October 31", "December 25"] },
        { q: "Mt. Gox was:", a: "An early Bitcoin exchange that was hacked and collapsed", wrong: ["A Bitcoin mining pool that collapsed after a prolonged drop in hash rates", "A widely used Bitcoin hardware wallet that was later discovered to have a critical flaw", "A regulatory agency established in Japan to oversee early cryptocurrency exchanges"] },
        { q: "The first Bitcoin block is called:", a: "The Genesis Block (Block 0)", wrong: ["The Alpha Block (Block 1)", "The Satoshi Block (Block 1)", "The Origin Block (Block 0)"] },
        { q: "Hal Finney received:", a: "The first Bitcoin transaction from Satoshi", wrong: ["The very last Bitcoin that will ever be mined around 2140", "An official government commendation for contributions to digital currency", "The exclusive worldwide rights to the Bitcoin name and trademark"] },
        { q: "Laszlo's famous pizza order was called from:", a: "London (Laszlo was in Florida)", wrong: ["New York City (Laszlo was based there at the time)", "San Francisco (the call was placed by a local volunteer)", "Tokyo (Laszlo was living in Japan at the time)"] },
        { q: "The Bitcoin Wiki has been online since:", a: "2010", wrong: ["2015", "2009", "2013"] },
        { q: "Tim Draper is known in Bitcoin for:", a: "Buying seized Silk Road Bitcoin at US Marshals auction", wrong: ["Founding and developing the Lightning Network off-chain payment protocol", "Writing and publishing the original Bitcoin whitepaper anonymously in 2008", "Mining and signing Bitcoin's original genesis block alongside Satoshi Nakamoto"] },
        { q: "The \"Lightning Torch\" was:", a: "A Lightning payment passed between notable Bitcoiners", wrong: ["A competitive global Bitcoin mining event offering prizes to the fastest miners", "A popular open-source hardware wallet for storing Bitcoin securely offline", "A well-known documentary film about Bitcoin's early rise and key pioneers"] },
        { q: "Approximately how many BTC did Mt. Gox lose in its collapse?", a: "850,000 BTC", wrong: ["100,000 BTC", "2 million BTC", "50,000 BTC"] },
        { q: "What year did the Silk Road marketplace get seized?", a: "2013", wrong: ["2011", "2015", "2017"] },
        { q: "How many Bitcoins were exchanged for two pizzas on Bitcoin Pizza Day?", a: "10,000 BTC", wrong: ["1,000 BTC", "100,000 BTC", "1,000,000 BTC"] },
        { q: "What was the main conflict of the Blocksize War?", a: "Whether to increase block size limit", wrong: ["Whether to switch Bitcoin to proof of stake", "Whether to add mandatory privacy features to Bitcoin", "Whether to change Bitcoin's fixed halving schedule"] },
        { q: "What was SegWit2x?", a: "Failed agreement to double block size after SegWit", wrong: ["A completed upgrade that raised the block size limit to 2MB permanently", "A brand new proof-of-work mining algorithm proposed to replace SHA-256", "An independent second layer payment network designed to scale Bitcoin"] }
    ],
    "_general": [
        { q: "One Bitcoin equals how many satoshis?", a: "100,000,000 (one hundred million)", wrong: ["1,000,000 (exactly one million)", "10,000,000 (exactly ten million)", "1,000,000,000 (exactly one billion)"] },
        { q: "Bitcoin was launched in which year?", a: "2009", wrong: ["2008", "2010", "2012"] },
        { q: "Bitcoin transactions are recorded on:", a: "A public distributed ledger", wrong: ["A private encrypted server", "A shared central bank database", "A secure chain of verified email receipts"] },
        { q: "Who can send you Bitcoin?", a: "Anyone who knows your address", wrong: ["Only your linked bank or licensed exchange", "Only users who have completed KYC verification", "Only people located in your same country"] },
        { q: "Bitcoin operates on:", a: "24/7, 365 days a year", wrong: ["Banking hours only", "Weekdays only as defined by Bitcoin consensus rules enforced by all full nodes", "It shuts down for maintenance"] },
        { q: "The total number of Bitcoins that will ever exist is:", a: "Exactly 21 million", wrong: ["Unlimited supply", "Exactly 100 million", "It changes every year"] },
        { q: "Bitcoin is often abbreviated as:", a: "BTC", wrong: ["BTN", "BCN", "BIT"] },
        { q: "A Bitcoin wallet stores:", a: "Private keys, not actual Bitcoin", wrong: ["Physical coins minted per transaction", "Actual digital Bitcoin file tokens", "Visual QR code images of your Bitcoin"] },
        { q: "To receive Bitcoin you need:", a: "A Bitcoin address", wrong: ["A bank account", "A social security number", "A credit card as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "The Bitcoin network is maintained by:", a: "Thousands of volunteers running nodes worldwide", wrong: ["A nonprofit foundation based in California with a global paid staff", "The United Nations through its digital finance regulatory oversight body", "A single powerful supercomputer managed by the core development team"] },
        { q: "Bitcoin confirmation time depends on:", a: "Network congestion and fee paid", wrong: ["The time of day the transaction is sent", "Your local internet or WiFi connection speed", "The specific country or jurisdiction you are in"] },
        { q: "A mempool is:", a: "Where unconfirmed transactions wait to be included in a block", wrong: ["A shared pool where miners combine resources to find new blocks faster", "A type of hardware wallet used to store Bitcoin and keys securely offline", "A centralized exchange platform where users buy and trade digital assets"] },
        { q: "Bitcoin difficulty adjustment ensures:", a: "Blocks are found roughly every 10 minutes regardless of hash power", wrong: ["Bitcoin prices remain stable and predictable within a controlled trading range", "Every miner earns an identical block reward regardless of their hash rate contributed", "All Bitcoin transactions automatically become free once the network reaches full size"] },
        { q: "SegWit stands for:", a: "Segregated Witness", wrong: ["Secure Widget as defined by Bitcoin consensus rules enforced by all full nodes", "Sequential Witness", "Segment Width as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "A Bitcoin address starts with:", a: "1, 3, or bc1", wrong: ["0x, as specified in the original Bitcoin whitepaper released in 2008", "BTC, as specified in the original Bitcoin whitepaper released in 2008", "Any letter"] },
        { q: "The Lightning Network whitepaper was published by:", a: "Joseph Poon and Thaddeus Dryja", wrong: ["Satoshi Nakamoto, as specified in the original Bitcoin whitepaper released in 2008", "Vitalik Buterin, as specified in the original Bitcoin whitepaper released in 2008", "Elon Musk, as specified in the original Bitcoin whitepaper released in 2008"] },
        { q: "Bitcoin hash rate measures:", a: "The total computing power securing the network", wrong: ["Transaction speed, as specified in the original Bitcoin whitepaper released in 2008", "Number of users, as specified in the original Bitcoin whitepaper released in 2008", "Price changes, as specified in the original Bitcoin whitepaper released in 2008"] },
        { q: "A nonce in mining is:", a: "A number miners change to find a valid block hash", wrong: ["A type of fee, as specified in the original Bitcoin whitepaper released in 2008", "A wallet address, as specified in the original Bitcoin whitepaper released in 2008", "A block reward, as specified in the original Bitcoin whitepaper released in 2008"] },
        { q: "The term \"NGMI\" in Bitcoin culture means:", a: "Not Gonna Make It", wrong: ["New Global Money Index", "Next Generation Mining Interface", "Network Growth Metric Indicator"] },
        { q: "Hyperbitcoinization refers to:", a: "Mass voluntary adoption of Bitcoin as money", wrong: ["A Bitcoin price crash, as specified in the original Bitcoin whitepaper released in 2008", "A mining difficulty spike, as specified in the original Bitcoin whitepaper released in 2008", "A new altcoin launch, as specified in the original Bitcoin whitepaper released in 2008"] },
        { q: "Strike, Cash App, and River are all:", a: "Apps that let you buy Bitcoin", wrong: ["Mining pools, as specified in the original Bitcoin whitepaper released in 2008", "Altcoins, as specified in the original Bitcoin whitepaper released in 2008", "Bitcoin forks, as specified in the original Bitcoin whitepaper released in 2008"] },
        { q: "Nostr is:", a: "A decentralized social protocol popular in the Bitcoin community", wrong: ["A mining algorithm, as specified in the original Bitcoin whitepaper released in 2008", "A Bitcoin fork, as specified in the original Bitcoin whitepaper released in 2008", "An exchange, as specified in the original Bitcoin whitepaper released in 2008"] },
        { q: "The phrase \"fix the money, fix the world\" means:", a: "Sound money leads to better societal outcomes", wrong: ["Print more money, as specified in the original Bitcoin whitepaper released in 2008", "Ban all currencies, as specified in the original Bitcoin whitepaper released in 2008", "Use only credit cards, as specified in the original Bitcoin whitepaper released in 2008"] },
        { q: "A timelock in Bitcoin allows:", a: "Locking funds until a specific block height or time", wrong: ["Freezing the blockchain, as specified in the original Bitcoin whitepaper released in 2008", "Stopping mining, as specified in the original Bitcoin whitepaper released in 2008", "Deleting transactions, as specified in the original Bitcoin whitepaper released in 2008"] },
        { q: "Block reward plus transaction fees equals:", a: "The total miner revenue per block", wrong: ["The Bitcoin price, as specified in the original Bitcoin whitepaper released in 2008", "The network speed, as specified in the original Bitcoin whitepaper released in 2008", "The difficulty level, as specified in the original Bitcoin whitepaper released in 2008"] },
        { q: "Ordinals on Bitcoin are:", a: "A way to inscribe data on individual satoshis", wrong: ["A ranking system for miners, as specified in the original Bitcoin whitepaper released in 2008", "A type of wallet, as specified in the original Bitcoin whitepaper released in 2008", "A government regulation, as specified in the original Bitcoin whitepaper released in 2008"] },
        { q: "A paper wallet is:", a: "A printed private key for cold storage", wrong: ["A paper receipt from an ATM as defined by Bitcoin consensus rules enforced by all full nodes", "A bank statement, as specified in the original Bitcoin whitepaper released in 2008", "A type of fiat currency, as specified in the original Bitcoin whitepaper released in 2008"] },
        { q: "The Lightning Network can theoretically handle:", a: "Millions of transactions per second", wrong: ["7 per second, as specified in the original Bitcoin whitepaper released in 2008", "100 per second, as specified in the original Bitcoin whitepaper released in 2008", "1 per minute, as specified in the original Bitcoin whitepaper released in 2008"] },
        { q: "A watch-only wallet lets you:", a: "Monitor a balance without being able to spend", wrong: ["Mine Bitcoin, as specified in the original Bitcoin whitepaper released in 2008", "Create new coins, as specified in the original Bitcoin whitepaper released in 2008", "Edit the blockchain, as specified in the original Bitcoin whitepaper released in 2008"] },
        { q: "Pleb is a term of endearment in Bitcoin meaning:", a: "An everyday Bitcoiner, not wealthy but committed", wrong: ["A professional trader, as specified in the original Bitcoin whitepaper released in 2008", "A mining executive, as specified in the original Bitcoin whitepaper released in 2008", "A government official, as specified in the original Bitcoin whitepaper released in 2008"] },
        { q: "What is the total number of satoshis that will ever exist?", a: "2.1 quadrillion (2,100,000,000,000,000)", wrong: ["21 million, as specified in the original Bitcoin whitepaper released in 2008", "100 billion, as specified in the original Bitcoin whitepaper released in 2008", "21 quadrillion, as specified in the original Bitcoin whitepaper released in 2008"] },
        { q: "Bitcoin's first confirmed exchange rate (in 2010) was roughly:", a: "1,309 BTC per US dollar", wrong: ["1 BTC per US dollar as defined by Bitcoin consensus rules enforced by all full nodes", "100 BTC per US dollar", "0.01 BTC per US dollar"] },
        { q: "The first Bitcoin exchange rate was established at approximately:", a: "$0.00099 per BTC (less than one penny)", wrong: ["$1.00 per BTC, as specified in the original Bitcoin whitepaper released in 2008", "$0.10 per BTC, as specified in the original Bitcoin whitepaper released in 2008", "$100 per BTC, as specified in the original Bitcoin whitepaper released in 2008"] },
        { q: "Dollar-cost averaging (DCA) into Bitcoin means:", a: "Buying a fixed amount regularly regardless of price", wrong: ["Borrowing dollars to buy Bitcoin all at once as defined by Bitcoin consensus rules enforced by all full nodes", "Selling Bitcoin when the dollar strengthens as defined by Bitcoin consensus rules enforced by all full nodes", "Converting Bitcoin profits back into dollars as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "The phrase \"Not your keys, not your coins\" warns against:", a: "Keeping Bitcoin on exchanges where you don't control the private keys", wrong: ["Using physical Bitcoin coins instead of digital, as specified in the original Bitcoin whitepaper released in 2008", "Sharing your public key with other people, as specified in the original Bitcoin whitepaper released in 2008", "Using hardware wallets instead of software, as specified in the original Bitcoin whitepaper released in 2008"] }
    ],
    "risks__threats__attack_vectors__weaknes": [
        { q: "Which Bitcoin address type is better for quantum resistance?", a: "SegWit (bc1q) because Taproot exposes the public key", wrong: ["Taproot (bc1p), as specified in the original Bitcoin whitepaper released in 2008", "Legacy (1...), as specified in the original Bitcoin whitepaper released in 2008", "All are equally vulnerable, as specified in the original Bitcoin whitepaper released in 2008"] },
        { q: "BIP 360 proposes:", a: "Pay to Quantum Resistant Hash", wrong: ["Bigger blocks, as specified in the original Bitcoin whitepaper released in 2008", "Faster mining, as specified in the original Bitcoin whitepaper released in 2008", "New altcoin support, as specified in the original Bitcoin whitepaper released in 2008"] },
        { q: "Why is a 51% attack economically irrational against Bitcoin?", a: "The cost of acquiring that hash rate would far exceed any attainable reward", wrong: ["Because Bitcoin's code blocks it automatically, as specified in the original Bitcoin whitepaper released in 2008", "Because Satoshi holds 51% of hash rate as a safeguard as defined by Bitcoin consensus rules enforced by all full nodes", "Because 51% of miners have agreed never to attack, as specified in the original Bitcoin whitepaper released in 2008"] },
        { q: "What can a successful 51% attacker actually do to Bitcoin?", a: "Double-spend their own recent transactions and block some new transactions", wrong: ["Create new Bitcoin out of thin air beyond the 21M cap as defined by Bitcoin consensus rules enforced by all full nodes", "Steal coins from other users' wallets, as specified in the original Bitcoin whitepaper released in 2008", "Delete the entire blockchain history, as specified in the original Bitcoin whitepaper released in 2008"] },
        { q: "Quantum computing threatens Bitcoin by potentially:", a: "Breaking ECDSA signatures used to authorize spending", wrong: ["Mining all remaining Bitcoin in seconds as defined by Bitcoin consensus rules enforced by all full nodes", "Deleting the entire blockchain, as specified in the original Bitcoin whitepaper released in 2008", "Creating unlimited new Bitcoin addresses as defined by Bitcoin consensus rules enforced by all full nodes"] }
    ],
    "evidence-against-alts": [
        { q: "Ethereum's original sale page reveals that ETH was:", a: "Pre-sold as a security to fund development", wrong: ["Mined fairly like Bitcoin, as specified in the original Bitcoin whitepaper released in 2008", "Distributed equally, as specified in the original Bitcoin whitepaper released in 2008", "Created by Satoshi, as specified in the original Bitcoin whitepaper released in 2008"] },
        { q: "What fundamental difference exists between Bitcoin and altcoins regarding decentralization?", a: "Altcoin founders often hold large pre-mines or centralized control", wrong: ["Altcoins are too cheap, as specified in the original Bitcoin whitepaper released in 2008", "Bitcoin has better marketing, as specified in the original Bitcoin whitepaper released in 2008", "Altcoins use different blockchains, as specified in the original Bitcoin whitepaper released in 2008"] },
        { q: "Why do Bitcoiners say \"there is no second best\"?", a: "No other crypto achieves Bitcoin's decentralization, security, and immutability", wrong: ["Bitcoin was the first, so it automatically wins, as specified in the original Bitcoin whitepaper released in 2008", "The SEC has declared all other cryptos illegal, as specified in the original Bitcoin whitepaper released in 2008", "Satoshi patented the blockchain concept, as specified in the original Bitcoin whitepaper released in 2008"] },
        { q: "What is a \"pre-mine\" and why is it concerning?", a: "Founders allocate coins to themselves before public launch - unfair distribution", wrong: ["A technique to speed up transaction processing, as specified in the original Bitcoin whitepaper released in 2008", "A security measure that protects the network, as specified in the original Bitcoin whitepaper released in 2008", "A method of testing the blockchain before launch, as specified in the original Bitcoin whitepaper released in 2008"] },
        { q: "Most altcoins are considered securities because:", a: "They have identifiable teams profiting from token sales with promises of returns", wrong: ["They use proof-of-stake consensus, which regulators treat as interest paid by an enterprise", "The SEC automatically registers any digital asset listed on a US-based trading platform", "They are listed and traded on traditional stock exchange platforms alongside conventional equities"] },
        { q: "What is a \"premine\" and why is it a red flag for altcoins?", a: "Founders create and keep tokens before public launch, giving insiders an unfair edge", wrong: ["A premine is a security scanning process that protects new blockchains from early 51% hashrate attacks", "A premine means the full codebase was professionally audited before release, a widely accepted practice", "A premine is when validators confirm the genesis block transactions without receiving any block reward"] },
        { q: "Why are many altcoin tokens considered securities under US law?", a: "They pass the Howey Test - buyers expect profits from a centralized team's efforts", wrong: ["The SEC automatically classifies every digital token asset as a regulated investment security", "Any token actively traded on a licensed cryptocurrency exchange is legally classified as a security", "Only tokens with market caps exceeding one billion dollars are large enough to formally qualify as securities"] },
        { q: "What is \"VC token dumping\" in the altcoin market?", a: "VCs invest early at a discount, then sell their tokens on retail investors at launch", wrong: ["VCs donate their early-discounted token allocations to nonprofit charitable organizations after launch", "VCs permanently lock their allocated tokens inside smart contracts to demonstrate long-term commitment", "VCs convert their discounted token positions into grants that fund open-source protocol development"] },
        { q: "Why do Bitcoiners argue that \"decentralized governance tokens\" are an oxymoron?", a: "Token voting concentrates power with whales and VCs, recreating inequality", wrong: ["Governance tokens are far too technically complex to implement secure on-chain voting", "Bitcoin already uses internal governance tokens to coordinate votes on protocol upgrades", "Governance tokens have been declared illegal financial instruments in most global jurisdictions"] },
        { q: "What key evidence do Bitcoiners cite about Ethereum's centralization?", a: "A massive premine to insiders, repeated monetary policy changes, and known leadership", wrong: ["Ethereum runs on a centralized server cluster secretly managed by Vitalik Buterin and his core team", "Ethereum transactions require explicit approval from government financial regulators before confirming", "Ethereum currently has far fewer active global nodes than a typical mid-sized enterprise cloud database"] },
        { q: "How was Ethereum's initial token supply structured at its 2014 crowdsale?", a: "About 72 million ETH were pre-mined; roughly 70% of the initial supply was allocated to founders and early insiders", wrong: ["All 72 million ETH were sold in a fully public fair launch with zero allocation reserved for the founding team or investors", "Roughly 20 million ETH were pre-mined with the remainder distributed through a public sale open to any retail investor globally", "100 million ETH were created and divided equally: one third to founders, one third to an R&D reserve, one third to the public"] },
        { q: "What does research reveal about the infrastructure running Ethereum's validator nodes?", a: "About 61% of Ethereum nodes run in cloud data centers; AWS alone hosts roughly 25% making centralization a severe concern", wrong: ["Only about 15% of Ethereum nodes run in the cloud; the vast majority are home validators run by individual stakers globally", "Nearly 95% of Ethereum nodes run on dedicated bare-metal servers; cloud hosting is actively discouraged by the foundation", "Roughly 40% of nodes are cloud-hosted, a level considered acceptable within Ethereum's published decentralization targets"] },
        { q: "What action did Ethereum take after the DAO hack in 2016, and what principle did it violate?", a: "Ethereum rolled back its blockchain to reverse the hack, proving its \"code is law\" and immutability claims were overrideable", wrong: ["Ethereum implemented a smart contract patch to freeze hacker funds without altering any already-confirmed on-chain state", "Ethereum hard forked to add new security rules but preserved all historical transactions, maintaining full ledger immutability", "Ethereum's core developers sued the attacker in Swiss court and recovered the funds without touching or altering the chain"] },
        { q: "What are the key concerns about XRP's token distribution and Ripple's legal status?", a: "Ripple pre-created ~100 billion XRP, controls its scheduled release, and was sued by the SEC for an unregistered securities offering", wrong: ["XRP has a capped supply of 21 million tokens like Bitcoin, but Ripple Labs retains permanent veto power over all protocol upgrades", "Ripple distributed XRP through open mining but faces legal challenges because its founders hold United States banking licenses", "XRP has no maximum supply cap and Ripple can mint new tokens freely; the SEC sued over undisclosed token minting activities"] },
        { q: "What is notable about Solana's track record of network availability since its mainnet launch?", a: "Solana has suffered over 10 major network outages since launch, including a single outage lasting approximately 17 hours", wrong: ["Solana has maintained a perfect uptime record since launch thanks to its Proof-of-History consensus and strong validator incentives", "Solana experienced one brief 2-hour outage in 2021 that was rapidly resolved via a coordinated validator restart procedure", "Solana's network undergoes scheduled maintenance windows twice per year, which critics sometimes mischaracterize as full outages"] },
        { q: "Why can't a competing cryptocurrency simply copy Bitcoin's open-source code and achieve equivalent security and value?", a: "Code is easily copied but network effects are not: Bitcoin's liquidity, hashrate security, deep trust, and developer talent are irreplaceable", wrong: ["Bitcoin's source code is proprietary and legally protected under copyright law, making direct copying a violation of intellectual property", "Bitcoin's cryptographic algorithms are patented by the Satoshi Nakamoto estate, preventing any fork from using SHA-256 legitimately", "Bitcoin's code can be copied but all resulting forks must share the original UTXO set, preventing any fork from bootstrapping independently"] },
        { q: "What has happened to nearly all altcoins throughout Bitcoin's history when evaluated in BTC-denominated terms?", a: "Over 99% of altcoins ever launched have declined toward zero when priced against Bitcoin, regardless of their initial hype cycles", wrong: ["About 50% of altcoins outperform Bitcoin over five-year windows; the rest decline, making broad diversification a rational strategy", "Altcoins have collectively outperformed Bitcoin since 2017 on a volume-weighted basis when adjusted for total market capitalization", "Roughly 30% of altcoins launched before 2018 still trade above their original ICO price when measured in BTC-denominated terms"] },
        { q: "What happened to major corporate \"blockchain not Bitcoin\" initiatives at firms like JPMorgan, IBM, and Maersk?", a: "JPMorgan, IBM, and Maersk all launched enterprise blockchain projects with great fanfare and then quietly abandoned each of them", wrong: ["JPMorgan's blockchain now processes $10 trillion daily and IBM's Food Trust actively tracks 25 billion food supply chain records", "The corporate blockchain era succeeded in creating interoperable networks that now settle cross-border payments in real time", "IBM and JPMorgan merged their blockchain platforms into a single enterprise network now operating across 500 Fortune 500 companies"] },
        { q: "What makes Bitcoin's origin uniquely different from every other major cryptocurrency ever launched?", a: "Bitcoin has an \"immaculate conception\": no founder enrichment, no premine, no ICO, and an anonymous creator who then disappeared", wrong: ["Bitcoin is unique because its consensus rules have never changed since genesis; no other network has achieved this full stability", "Bitcoin's origin is unique because it was launched by a publicly known academic team who donated all profits back to a foundation", "Bitcoin is the only cryptocurrency launched before 2015 that still runs its original completely unmodified consensus algorithm"] },
        { q: "Why does launching a new Proof-of-Work coin present a fundamental and unavoidable security problem?", a: "Any new PoW chain starts with near-zero hashrate, meaning an attacker with modest hardware could 51% attack it from day one", wrong: ["New PoW coins are insecure because ASIC manufacturers refuse to supply hardware to chains below the 1 EH/s threshold hashrate", "New PoW chains are vulnerable because they must use Bitcoin's SHA-256 algorithm, enabling cheap merged mining attack exploits", "Launching a new PoW coin requires regulatory approval in most countries, creating legal barriers that deter legitimate honest miners"] }
    ],
    "smart-contracts": [
        { q: "Bitcoin's scripting language has supported smart contracts:", a: "Since the beginning - Bitcoin always had them", wrong: ["Only after the Taproot soft fork was activated on the network in late 2021", "Only after SegWit was activated and deployed on the main Bitcoin network in 2017", "Never - Bitcoin's intentional design explicitly prohibits all smart contract logic"] },
        { q: "OP_RETURN is used in Bitcoin to:", a: "Embed small amounts of data in transactions", wrong: ["Automatically return unspent Bitcoin change back to the original sending address", "Cancel or reverse pending unconfirmed transactions waiting in the mempool queue", "Accelerate block confirmation times for high-fee-rate priority Bitcoin transactions"] },
        { q: "What is Bitcoin\\'s native scripting language called?", a: "Bitcoin Script", wrong: ["Solidity Script", "Python Script", "EVM Bytecode"] },
        { q: "What does OP_RETURN allow users to do on Bitcoin?", a: "Embed up to 80 bytes of arbitrary data in a transaction", wrong: ["Execute Ethereum-style Turing-complete smart contract logic directly on-chain", "Alter or update a Bitcoin transaction's output amounts after it was broadcast", "Issue and distribute new Bitcoin-backed tokens or colored coin asset classes"] },
        { q: "What are DLCs (Discreet Log Contracts) on Bitcoin?", a: "Smart contracts that settle based on external oracle data without revealing details", wrong: ["Encrypted private key backups distributed across transaction log files for disaster recovery", "Special developer debugging tools that trace and profile contract execution steps on testnet", "Decentralized peer-to-peer lending agreements that execute natively on the Ethereum blockchain"] }
    ],
    "chaumian-mints": [
        { q: "Cashu is an implementation of:", a: "Chaumian ecash on Bitcoin/Lightning", wrong: ["An independent proof-of-work blockchain", "An Ethereum-based altcoin token protocol", "A memory-hard Bitcoin mining algorithm"] },
        { q: "Who invented the blind signature technology used in Chaumian eCash?", a: "David Chaum in 1982", wrong: ["Satoshi Nakamoto in 2008", "Adam Back in 1997", "Hal Finney in 2004"] },
        { q: "What modern Bitcoin layer implements Chaumian eCash for minting privacy-preserving tokens?", a: "Cashu and Fedimint protocols", wrong: ["The Lightning Network layer", "The Liquid sidechain network", "Ethereum's ERC-20 token system"] },
        { q: "Cashu is:", a: "An ecash protocol built on Bitcoin using Chaumian blind signatures", wrong: ["A competing proof-of-stake cryptocurrency designed to challenge Bitcoin's role in payments", "A hardware wallet manufacturer that specializes in cold-storage security for Bitcoin holders", "A type of open-source Bitcoin mining pool software used to coordinate distributed hashrate"] },
        { q: "What are \"blind signatures\" in ecash?", a: "The mint signs tokens without knowing which user they belong to", wrong: ["Signatures that automatically expire and become cryptographically invalid after exactly 24 hours", "A technique for signing blockchain transactions without needing the user's own private key", "Cryptographic proofs that can only be verified and validated by government-approved authorities"] }
    ],
    "swag-merch": [
        { q: "BTCAccepted.org helps you find:", a: "Businesses that accept Bitcoin payments", wrong: ["Bitcoin mining pools and hashrate marketplaces", "Lightning node operators and payment routing hubs", "Altcoin and stablecoin spot exchange platforms"] },
        { q: "Sats.host offers:", a: "Bitcoin-powered static website hosting", wrong: ["Bitcoin cloud mining-as-a-service rentals", "Hardware cold-storage wallet distribution", "Identity-based KYC verification services"] },
        { q: "What annual Bitcoin conference is often called \"the Super Bowl of Bitcoin\"?", a: "Bitcoin Conference (formerly Miami/Bitcoin 2021)", wrong: ["Consensus (the annual CoinDesk crypto industry conference)", "DevCon (the Ethereum Foundation's annual developer summit)", "ETHDenver (the largest Ethereum-focused hackathon and festival)"] },
        { q: "What is the significance of wearing an orange pill at Bitcoin conferences?", a: "Signifies being \"orange pilled\" - awakened to Bitcoin\\'s importance", wrong: ["It promotes a popular vitamin supplement brand that sponsors the Bitcoin conference", "It identifies official conference staff members and volunteers on the event floor", "It serves as a VIP lanyard granting holders priority access to all mainstage panels"] },
        { q: "What popular Bitcoin merchandise item satirizes central banking?", a: "\"End the Fed\" t-shirts and posters", wrong: ["Bitcoin-branded ergonomic gaming chairs", "Satoshi Nakamoto collectible action figures", "ASIC miner miniature keychain replicas"] }
    ],
    "apps-tools": [
        { q: "PPQ.ai lets you use AI models and pay with:", a: "Bitcoin per prompt - no subscription needed", wrong: ["Monthly recurring credit card subscription billing", "Ethereum gas fees via a MetaMask browser extension", "Free access to models supported by targeted display ads"] },
        { q: "Angor is a platform for:", a: "Non-custodial Bitcoin crowdfunding", wrong: ["Hosted cloud Bitcoin mining pool services", "On-chain coin mixing for transaction privacy", "Consumer-grade cold-storage hardware wallet sales"] },
        { q: "What website provides real-time visualization of the Bitcoin mempool?", a: "mempool.space", wrong: ["blockchain.com", "coinmarketcap.com", "bitcoincharts.com"] },
        { q: "What popular hardware wallet supports both Bitcoin and Lightning?", a: "Coldcard and BitBox02", wrong: ["Ledger Nano and Trezor", "KeepKey and Passport", "Foundation and SeedSigner"] },
        { q: "What full node implementation is the most widely used for running Bitcoin?", a: "Bitcoin Core", wrong: ["Bitcoin Cash", "Ethereum Classic", "Ripple Node"] }
    ],
    "games": [
        { q: "Timechain Arcade offers:", a: "Free Bitcoin-themed video games", wrong: ["Bitcoin cloud mining rental services", "Automated crypto portfolio trading tools", "Plug-and-play Bitcoin hardware wallet devices"] },
        { q: "CanYouBeatBitcoin.com is:", a: "An investing simulator comparing your picks to Bitcoin", wrong: ["A live mining difficulty recalculation tool for professional Bitcoin miners", "A self-custodial Bitcoin and Lightning Network mobile wallet application", "An automated algorithmic trading bot for Bitcoin and altcoin spot markets"] },
        { q: "What type of Bitcoin games reward players with satoshis?", a: "Play-to-earn Lightning games", wrong: ["Casino-style Bitcoin gambling sites", "Console role-playing video games", "Free mobile games monetized by banner ads"] },
        { q: "What popular Bitcoin trivia app lets users earn sats for answering questions?", a: "THNDR Games (like Bitcoin Bounce, Bitcoin Bay)", wrong: ["Fortnite (which added sats reward drops in a 2022 seasonal battle pass)", "Candy Crush Saga (which partnered with Lightning Network to pay out winners)", "Minecraft (which features a Lightning sats plugin for Bitcoin-paying servers)"] },
        { q: "What is Zebedee known for in the Bitcoin gaming space?", a: "A platform enabling Lightning payments in games", wrong: ["A producer of specialized ASIC Bitcoin mining hardware rigs", "A centralized altcoin and stablecoin spot exchange platform", "An Ethereum NFT marketplace for trading in-game digital collectibles"] }
    ],
    "difficulty-adjustment": [
        { q: "How often does Bitcoin's difficulty adjustment occur?", a: "Every 2,016 blocks (approximately 2 weeks)", wrong: ["Every 1,008 blocks (approximately 1 week)", "Every 4,032 blocks (approximately 1 month)", "Every 144 blocks (approximately 1 day)"] },
        { q: "What does the difficulty adjustment ensure?", a: "Blocks are found roughly every 10 minutes regardless of hash power changes", wrong: ["Transaction fees stay constant regardless of how many transactions fill each block", "Mining rewards automatically increase whenever total network hash rate grows", "Block size scales automatically in response to changes in total hash power"] },
        { q: "Bitcoin's difficulty adjusts every:", a: "2,016 blocks (roughly every 2 weeks)", wrong: ["Every single block as defined by Bitcoin consensus rules enforced by all full nodes", "Once per year as defined by Bitcoin consensus rules enforced by all full nodes", "Every 210,000 blocks (at each halving)"] },
        { q: "If miners leave the network, difficulty adjustment:", a: "Lowers the difficulty so blocks are found at the target rate", wrong: ["Increases difficulty so remaining miners must work harder to find blocks", "Has no effect, as blocks simply take longer to find each time", "Automatically doubles the block subsidy to lure miners back"] },
        { q: "The target time between Bitcoin blocks is approximately:", a: "10 minutes", wrong: ["5 minutes", "60 minutes", "30 seconds"] },
        { q: "What algorithm does Bitcoin use for difficulty adjustment?", a: "Direct calculation based on actual vs target time", wrong: ["PID controller algorithm with feedback loops", "Neural network prediction of future hash rate", "Moving average of recent hash rate samples as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "How many blocks is the difficulty retarget period?", a: "2,016 blocks", wrong: ["1,008 blocks", "4,032 blocks", "10,080 blocks"] },
        { q: "What causes hash rate oscillation between mining pools?", a: "Miners chasing short-term luck variance", wrong: ["Scheduled Bitcoin Core software update cycles", "Daily difficulty adjustment recalculations", "Network communication delays between nodes"] },
        { q: "What variance measure describes pool mining luck?", a: "Statistical variance around expected block discovery", wrong: ["Fixed reward percentage distributed to miners as defined by Bitcoin consensus rules enforced by all full nodes", "Difficulty share ratio across pool participants", "Network propagation delay between peer nodes as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "How long does a difficulty epoch typically last?", a: "Approximately 2 weeks", wrong: ["Exactly seven days long", "Approximately one month", "Approximately four days"] }
    ],
    "nostr": [
        { q: "What does the Nostr acronym stand for?", a: "Notes and Other Stuff Transmitted by Relays", wrong: ["Network of Secured Transactions and Relays", "New Open Standard for Trustless Relay Networks", "Node-Operated Social Transmission Registry"] },
        { q: "What makes Nostr unique from typical social media?", a: "Your identity is uncensorable and no single entity controls the platform", wrong: ["It automatically pays users in Bitcoin proportional to the engagement they receive", "It functions exclusively on mobile devices with no desktop interface available", "It requires government-issued identity verification before any content can be published"] },
        { q: "What is a NIP in the Nostr ecosystem?", a: "A Nostr Implementation Possibility - a protocol specification for how clients and relays behave", wrong: ["A Nostr Identity Protocol mapping public keys to verified human-readable display names", "A standardised end-to-end encryption layer that secures private messages between Nostr users", "A subscription fee structure charged by premium relay operators for publishing user events"] },
        { q: "Nostr uses cryptographic keys to:", a: "Allow users to own their identity without a central authority", wrong: ["Earn new coins by mining blocks on the Nostr blockchain ledger", "Encrypt all relay messages so that only the sender can read them", "Create verifiable smart contracts between any two Nostr users"] },
        { q: "How is Nostr connected to Bitcoin?", a: "Many clients integrate Lightning for tips and payments", wrong: ["Nostr events are written directly into Bitcoin blocks", "You must own some Bitcoin to create a Nostr account", "Nostr relays help verify Bitcoin transactions as well"] }
    ],
    "network_effects": [
        { q: "Bitcoin's network effect means:", a: "Each new user increases the value and utility for all existing users", wrong: ["The internet gets faster and more resilient as each new node joins", "Mining gets easier and cheaper for all participants as the network expands", "Transaction fees trend toward zero as competition between miners increases"] },
        { q: "Why is Bitcoin's network effect considered a strong moat?", a: "It creates a self-reinforcing cycle of liquidity, security, and adoption that competitors cannot easily replicate", wrong: ["Because international patents protect Bitcoin, preventing competitors from replicating its fundamental structure", "Because government policy explicitly protects Bitcoin's market position against all competing cryptocurrency networks", "Because Bitcoin uses proprietary encryption that makes it impossible for any competitor to successfully fork its code"] },
        { q: "What economic principle explains Bitcoin\\'s value increasing as more people use it?", a: "Metcalfe\\'s Law - network value proportional to connected users squared", wrong: ["Moore\\'s Law, as specified in the original Bitcoin whitepaper released in 2008", "Murphy\\'s Law, as specified in the original Bitcoin whitepaper released in 2008", "Pareto Principle, as specified in the original Bitcoin whitepaper released in 2008"] },
        { q: "Metcalfe's Law applied to Bitcoin suggests:", a: "Its value grows proportionally to the square of its users", wrong: ["The price will always increase linearly with total users", "Only the first users receive any real financial benefit", "Network effects only apply to social media platforms"] },
        { q: "What is the flywheel effect in Bitcoin adoption?", a: "More users attract more developers, merchants, and infrastructure, which attracts even more users", wrong: ["Mining becomes progressively easier as each additional user contributes hash power to the network", "Transaction fees steadily fall toward zero as more miners and users compete within the growing network", "Bitcoin's price always rises directly whenever more users create wallets and start transacting"] }
    ],
    "governance": [
        { q: "Bitcoin governance is best described as:", a: "Rough consensus among users, developers, miners, and node operators", wrong: ["A chief executive officer at the Bitcoin Foundation makes all key decisions", "Miners vote on all proposed protocol changes and their votes are binding", "A central Bitcoin Foundation sets and enforces all protocol-level rules"] },
        { q: "The Blocksize Wars demonstrated that:", a: "Users and node operators ultimately control Bitcoin's rules, not miners alone", wrong: ["Miners hold absolute power and can unilaterally enforce any protocol rule change", "Core developers can force any protocol change by releasing a new Bitcoin Core version", "Bitcoin's protocol is immutably fixed and cannot be upgraded or changed in any way"] },
        { q: "What is the BIP process in Bitcoin?", a: "Bitcoin Improvement Proposals for suggesting protocol changes", wrong: ["Bitcoin Investment Plan for funding protocol development initiatives", "Blockchain Intellectual Property registration for Bitcoin core code", "Banking Integration Protocol for financial network compliance"] },
        { q: "How is Bitcoin governed?", a: "Through rough consensus among users, developers, miners, and node operators", wrong: ["By a board of directors at the official Bitcoin Foundation headquarters", "Through proxy shareholder voting, similar to how a public corporation operates", "By whoever owns the most Bitcoin, as majority ownership grants protocol rights"] },
        { q: "A BIP (Bitcoin Improvement Proposal) is:", a: "A formal document proposing changes to Bitcoin's protocol or processes", wrong: ["A mandatory update which all full nodes must install to remain in consensus", "A formal financial investment in Bitcoin's ongoing core protocol development", "A bug report submitted to the Bitcoin Core support team for urgent review"] },
        { q: "Who can submit a Bitcoin Improvement Proposal (BIP)?", a: "Anyone in the Bitcoin community", wrong: ["Only Bitcoin Core maintainers", "Only miners with enough hash rate", "Only officially registered developers"] },
        { q: "What activation method does BIP 9 use?", a: "Miner signaling with version bits during a defined window", wrong: ["Node operators vote directly without miner input as defined by Bitcoin consensus rules enforced by all full nodes", "Core developers set a flag day with no miner input as defined by Bitcoin consensus rules enforced by all full nodes", "Miners and the SEC jointly approve the activation as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "BIP 8 improves on BIP 9 by adding what option?", a: "A \"lock-in on timeout\" (LOT=true) that forces activation even without miner majority", wrong: ["A mandatory 95% node upgrade threshold that must be met before version bit signaling", "An emergency pause mechanism letting any single mining pool block the activation", "A two-thirds supermajority developer vote required before version bit signaling begins"] },
        { q: "What does UASF stand for?", a: "User-Activated Soft Fork", wrong: ["Unified Active Soft Fork", "Universal Auto Soft Fork", "User Approval Soft Fork"] },
        { q: "What was Speedy Trial used for in Bitcoin?", a: "Taproot activation with a shortened signaling period", wrong: ["SegWit activation with extended miner coordination", "Lightning Network deployment across mainnet nodes", "Difficulty adjustment algorithm changes and updates"] }
    ],
    "human_rights__social_justice_and_freedo": [
        { q: "Bitcoin supports human rights by:", a: "Providing censorship-resistant money that cannot be confiscated by authoritarian regimes", wrong: ["Replacing all fiat currency-issuing governments with a decentralized digital monetary system", "Eliminating global poverty immediately by providing everyone with a free Bitcoin wallet", "Being administered by the United Nations as a neutral global reserve currency held in trust"] },
        { q: "Alex Gladstein advocates for Bitcoin because:", a: "It empowers people living under authoritarian regimes with financial freedom", wrong: ["It makes buying stocks much easier for everyday investors in wealthy nations", "It replaces the need for traditional banks for all citizens in wealthy countries", "It was specifically designed as a protest instrument against monetary systems"] },
        { q: "How has Bitcoin helped activists in authoritarian regimes?", a: "By enabling uncensorable fundraising and protecting wealth from seizure", wrong: ["By hiding their identity completely and anonymizing all transactions", "By earning guaranteed interest through Bitcoin-integrated savings accounts", "By creating new digital currencies that circumvent government monetary controls"] },
        { q: "How does Bitcoin help people under authoritarian regimes?", a: "It provides censorship-resistant money that governments cannot freeze", wrong: ["It automatically reports suspicious transactions to financial authorities", "It requires government-issued identity verification before any transaction", "It only functions correctly in stable democratic countries worldwide"] },
        { q: "Alex Gladstein of the Human Rights Foundation argues that:", a: "Bitcoin is the most important tool for financial freedom globally", wrong: ["Only wealthy developed nations can meaningfully benefit from Bitcoin", "Bitcoin should be controlled by established human rights organizations", "Proof of Stake is better for human rights than Proof of Work"] }
    ],
    "market_cap": [
        { q: "Bitcoin's market cap is calculated by:", a: "Current price multiplied by total coins in circulation", wrong: ["Total daily transaction volume across all global exchanges", "Number of active wallets times their average Bitcoin balance", "Total mining revenue multiplied by the current block height"] },
        { q: "Why can Bitcoin's market cap potentially exceed gold's?", a: "Bitcoin is more portable, divisible, verifiable, and scarce than gold", wrong: ["Bitcoin transactions are faster and carry lower fees than physical gold trading", "Bitcoin is backed by a global reserve fund that guarantees its long-term value", "Bitcoin's mining process ensures a steady new supply making it superior to gold"] },
        { q: "What metric compares Bitcoin\\'s market value to all other cryptocurrencies combined?", a: "Bitcoin Dominance Index", wrong: ["Crypto Dominance Score", "Digital Asset Share Index", "Total Market Value Ratio"] },
        { q: "Bitcoin's market capitalization represents:", a: "The total value of all existing Bitcoin at the current price", wrong: ["The maximum number of Bitcoin coins that will ever be created by mining", "The total amount of money spent on Bitcoin mining hardware globally", "The sum of all Bitcoin transactions recorded on the blockchain annually"] },
        { q: "If Bitcoin captured gold's market cap, each coin would be worth approximately:", a: "Over $500,000", wrong: ["Around $100,000", "Close to $200,000", "Up to $50,000"] }
    ],
    "the_future": [
        { q: "What hypothetical event do Bitcoiners call \"hyperbitcoinization\"?", a: "A voluntary tipping point where Bitcoin displaces fiat as the world's dominant money", wrong: ["A coordinated government transition where nations simultaneously adopt a Bitcoin standard", "A planned protocol upgrade that makes Bitcoin the only globally compatible payment rail", "A forced redenomination where central banks exchange fiat reserves for Bitcoin at par"] },
        { q: "Bitcoin is described as 'generational wealth' because:", a: "Its fixed supply and growing adoption may increase its value over decades", wrong: ["Only family members can legally inherit and access a deceased holder's Bitcoin wallet", "Bitcoin wallets automatically expire and reset to zero after 25 years of inactivity", "Central banks officially guarantee Bitcoin's face value for 100 years as a reserve asset"] },
        { q: "What is the \"digital scarcity\" argument for Bitcoin's long-term value?", a: "Unlike any prior asset, Bitcoin's supply cap is enforced by math rather than human institutions", wrong: ["Unlike gold, Bitcoin's scarcity is irrelevant because its supply can be subdivided without any limit", "Bitcoin's value derives from a government-backed reserve fund, similar to how gold underpins fiat money", "Since digital files can always be perfectly copied, Bitcoin cannot achieve true or lasting economic scarcity"] },
        { q: "What happens when the last Bitcoin is mined (~2140)?", a: "Miners will be compensated solely through transaction fees", wrong: ["The Bitcoin network will gradually shut down due to the complete absence of block rewards", "A governance vote will unlock and release an additional 21 million coins for continued mining", "Mining rigs will continue to process transactions but miners will receive absolutely no compensation"] },
        { q: "Who coined the term \"hyperbitcoinization\"?", a: "Daniel Krawisz in a 2014 Nakamoto Institute essay", wrong: ["Satoshi Nakamoto in the original 2008 Bitcoin whitepaper published online", "Michael Saylor during a widely viewed 2020 MicroStrategy investor presentation", "Andreas Antonopoulos in his widely read book Mastering Bitcoin second edition"] }
    ],
    "orange-pilling": [
        { q: "'Orange-pilling' someone means:", a: "Convincing them to understand and adopt Bitcoin", wrong: ["Selling them a diversified portfolio of altcoin investments", "Sending them a small amount of free Bitcoin directly to their wallet", "Registering them for an account on a centralized cryptocurrency exchange"] },
        { q: "The most effective way to orange-pill someone is often:", a: "Starting with the problem Bitcoin solves (broken money) rather than technical details", wrong: ["Showing them historical Bitcoin price charts to demonstrate its impressive investment returns", "Explaining the SHA-256 hashing algorithm and how it cryptographically secures the blockchain", "Telling them to invest immediately before the next halving event inevitably drives prices upward"] },
        { q: "What does \"orange pilling\" someone mean?", a: "Educating them about Bitcoin until they understand its importance", wrong: ["Literally giving them orange-colored vitamin supplement pills as an introductory gesture", "Selling them Bitcoin mining hardware so they can independently earn their own coins", "Setting up a Bitcoin wallet on their phone and depositing a small starter amount"] },
        { q: "What is the best approach when orange-pilling a skeptic?", a: "Start with their specific pain point (inflation, remittances, censorship) rather than technical details", wrong: ["Show them historical price charts and assure them that Bitcoin investment always provides guaranteed returns", "Pressure them into purchasing Bitcoin immediately before the next halving event drives up prices significantly", "Begin by explaining the full UTXO model, Merkle trees, and proof-of-work consensus mechanism in complete detail"] },
        { q: "The most effective orange-pilling strategy is:", a: "Meeting people where they are and addressing their specific concerns", wrong: ["Regularly posting Bitcoin price predictions and market analysis on social media platforms", "Telling people they are making a serious financial mistake by not purchasing Bitcoin right now", "Assuring friends and family that they will receive guaranteed returns on their Bitcoin investment"] },
        { q: "What is the \"Socratic method\" approach to orange-pilling someone about Bitcoin?", a: "Asking questions that lead them to discover Bitcoin's value themselves", wrong: ["Citing ancient Greek philosophers like Aristotle who supposedly anticipated sound digital money", "Requiring the person to read the entire Bitcoin whitepaper aloud before any discussion can begin", "Engaging in aggressive economic debate with them until they finally concede that Bitcoin has value"] },
        { q: "What is \"progressive disclosure\" when introducing someone to Bitcoin?", a: "Starting with simple concepts they care about, then going deeper", wrong: ["Showing them Bitcoin's full transaction history from genesis", "Revealing your entire Bitcoin portfolio to build their trust", "Disclosing all of Bitcoin's technical flaws upfront to seem honest"] },
        { q: "When orange-pilling family members, what is generally the most effective approach?", a: "Focus on what they care about - savings, retirement, their future", wrong: ["Send them a lengthy three-hour technical podcast covering Bitcoin mining and cryptographic hashing", "Purchase Bitcoin on their behalf without asking first and present it as a surprise financial gift", "Bring the topic up at every family gathering until they eventually agree with your position on Bitcoin"] },
        { q: "What is one of the biggest mistakes people make when trying to orange-pill someone?", a: "Information overload - dumping too much detail at once", wrong: ["Being too patient and waiting for them to ask questions", "Starting with how Bitcoin helps people in other countries", "Recommending they read a book about the history of money"] },
        { q: "Which book is widely considered the best starting point for orange-pilling someone interested in economics and sound money?", a: "The Bitcoin Standard by Saifedean Ammous", wrong: ["Mastering Bitcoin by Andreas Antonopoulos", "Programming Bitcoin by Jimmy Song as defined by Bitcoin consensus rules enforced by all full nodes", "The Blocksize War by Jonathan Bier as defined by Bitcoin consensus rules enforced by all full nodes"] }
    ],
    "maximalism": [
        { q: "Bitcoin maximalism is the belief that:", a: "Bitcoin is the only cryptocurrency that truly matters as sound money", wrong: ["You should invest your entire net worth in Bitcoin at every available opportunity", "Bitcoin's technology should completely replace the entire global financial infrastructure", "Bitcoin was specifically designed to be used exclusively by professional software developers"] },
        { q: "Maximalists argue altcoins are unnecessary because:", a: "Bitcoin's base layer plus additional protocol layers can serve all use cases", wrong: ["Governments have legally classified most altcoins as unregistered securities requiring enforcement", "Satoshi Nakamoto explicitly stated in early writings that all other cryptocurrencies were invalid", "The global peer-to-peer network infrastructure can only support one active blockchain at any time"] },
        { q: "What is Bitcoin maximalism?", a: "The belief that Bitcoin will be the only cryptocurrency to achieve long-term dominance", wrong: ["An investment strategy focused exclusively on altcoins in order to maximize portfolio gains", "The practice of acquiring as much Bitcoin as possible regardless of any personal financial cost", "A technical discipline requiring users to run multiple full Bitcoin nodes to support the network"] },
        { q: "Why do deep Bitcoin researchers tend to become maximalists?", a: "They realize no other project achieves true decentralization and immutability", wrong: ["They receive financial compensation from Bitcoin-focused companies to publicly advocate for the protocol", "Their limited exposure to alternative technologies prevents them from recognizing other viable options", "Active participation in the Bitcoin developer forums technically requires holding and expressing maximalist views"] },
        { q: "What is the core argument of Bitcoin maximalists?", a: "Only Bitcoin achieves true decentralization and sound money; altcoins compromise on critical aspects", wrong: ["Bitcoin should be formally declared the only legal tender globally, fully replacing all national fiat currencies", "Any technology or platform that is not directly and exclusively related to Bitcoin is fundamentally worthless", "True Bitcoin maximalists actively refuse to use internet services or any new technology created after 2009"] },
        { q: "What do Bitcoiners mean when they call \"toxic maximalism\" an immune response?", a: "Aggressive pushback against scams protects newcomers like an immune system", wrong: ["Maximalists spread computer viruses to attack competing altcoin networks", "Toxic maximalism is a disease Bitcoin developers are actively trying to cure", "It means Bitcoin's code automatically rejects transactions from altcoins"] },
        { q: "What is the \"altcoin opportunity cost\" argument made by Bitcoin maximalists?", a: "Money spent on altcoins could have gone to Bitcoin, which outperforms long-term", wrong: ["Altcoins are free to create so there is no real opportunity cost involved in holding them", "Bitcoin maximalists believe that active altcoin trading actually increases Bitcoin's overall value", "Opportunity cost is a fiat-era economic concept that simply does not apply to any digital assets"] },
        { q: "Why do Bitcoin-only companies (like Swan, River, and Unchained) choose not to support altcoins?", a: "They see promoting altcoins as ethically wrong since most will fail and harm users", wrong: ["They currently lack the technical engineering capability needed to support other cryptocurrency tokens", "Existing government regulations formally prohibit financial companies from offering multiple crypto assets", "Supporting altcoins would significantly degrade the performance of their exchange and wallet software"] },
        { q: "What is the \"ethical case\" for Bitcoin maximalism?", a: "Promoting risky altcoins to unsophisticated investors causes real financial harm", wrong: ["Bitcoin maximalists believe they hold a moral and even near-religious duty to spread global adoption", "Ethics fundamentally require that all financial technologies be treated equally and without discrimination", "The ethical argument holds that Bitcoin miners alone deserve to receive all cryptocurrency-related profits"] },
        { q: "How does Gresham's Law (\"bad money drives out good\") apply to the Bitcoin maximalism argument?", a: "People spend weak fiat and altcoins while hoarding Bitcoin as the hardest money", wrong: ["Gresham's Law demonstrates that cheaper and more abundant altcoins will ultimately displace Bitcoin", "It implies that world governments will eventually be forced to compel citizens to transact using Bitcoin", "Gresham's Law is a principle that applies strictly to physical metal coinage and not to any digital currency"] }
    ],
    "developers": [
        { q: "Bitcoin Core is primarily written in:", a: "C++", wrong: ["Python", "JavaScript", "Rust"] },
        { q: "Contributing to Bitcoin open source requires:", a: "Anyone can propose changes - no permission needed", wrong: ["A formal computer science degree from an accredited and recognized university", "Official written approval submitted to and granted by the Bitcoin Foundation", "A paid annual developer license issued by the Bitcoin Core organization"] },
        { q: "Who is considered Bitcoin\\'s lead maintainer as of recent years?", a: "There is no formal leader; Bitcoin Core has multiple maintainers", wrong: ["Satoshi Nakamoto, who continues to guide development quietly under an anonymous pseudonym", "Vitalik Buterin, who oversees several major blockchain codebases including Bitcoin Core", "Elon Musk, whose vocal public support grants him widely recognized informal authority over Bitcoin"] },
        { q: "What organization has historically funded Bitcoin Core development?", a: "MIT Digital Currency Initiative, Chaincode Labs, Brink, Spiral", wrong: ["World Bank and United Nations joint digital finance development division", "Federal Reserve's fintech research and digital payment systems innovation unit", "Goldman Sachs and JPMorgan's jointly managed cryptocurrency development fund"] },
        { q: "Which version control system hosts Bitcoin Core's source code?", a: "Git", wrong: ["SVN", "Mercurial", "Bazaar"] }
    ],
    "ham_radio": [
        { q: "Bitcoin transactions can be sent via ham radio, which means:", a: "Bitcoin can work without an internet connection", wrong: ["Bitcoin nodes require a dedicated satellite dish to receive block data", "Only licensed Bitcoin miners are permitted to broadcast transactions by radio", "Transactions sent over radio waves are processed entirely without any network fee"] },
        { q: "How can Bitcoin transactions be sent without internet?", a: "Via ham radio operators broadcasting signed transactions", wrong: ["Via physical mail containing paper-printed encrypted transaction codes", "Via standard telephone voice calls encoded with audio signal sequences", "Via satellite television broadcasts restricted to licensed subscriber dishes"] },
        { q: "What mesh network protocol has been used to broadcast Bitcoin transactions?", a: "Blockstream Satellite and goTenna mesh networks", wrong: ["Standard Bluetooth Classic radio frequency mesh protocol", "Near-field NFC contactless payment relay broadcast system", "Zigbee low-power home automation wireless mesh network"] },
        { q: "What is the benefit of Bitcoin over ham radio?", a: "Censorship resistance even when governments shut down internet", wrong: ["Significantly faster data transmission speeds than standard fiber optic connections", "Much lower Bitcoin transaction fees compared to routing through normal internet relays", "Superior performance when transferring large data files over very long geographic distances"] },
        { q: "Who demonstrated sending Bitcoin via ham radio in 2019?", a: "Rodolfo Novak co-founder of Coinkite", wrong: ["Andreas Antonopoulos Bitcoin educator", "Nick Szabo creator of the Bit Gold idea", "Adam Back CEO of Blockstream company"] }
    ],
    "lightning_node": [
        { q: "Running a Lightning node allows you to:", a: "Route payments and earn fees while supporting the network", wrong: ["Increase your hashrate and earn larger Bitcoin block rewards", "Generate new Bitcoin directly without needing proof-of-work", "Send anonymous transactions bypassing any network payment routing"] },
        { q: "What is a Lightning node?", a: "Software that routes payments on the Lightning Network using payment channels", wrong: ["A dedicated hardware device that plugs directly into the Bitcoin mainchain", "A specialized mining rig that processes Lightning Network computational tasks", "A centralized server that exchanges run to settle off-chain Bitcoin balances"] },
        { q: "What do node operators lock up to open payment channels?", a: "Bitcoin as liquidity for routing payments", wrong: ["Wrapped Ether tokens as collateral for channel liquidity", "Fiat currency held in a custodial bank account", "Proof-of-work computing power via mining hardware"] },
        { q: "What fee do Lightning routing nodes typically charge?", a: "Routing fees measured in milli-satoshis (very small fraction of a cent)", wrong: ["A flat percentage of one percent applied to each full transaction amount", "A fixed five dollar charge assessed on every individual Lightning payment", "No fees are allowed since all routing is provided as a free community service"] },
        { q: "What is inbound liquidity for a Lightning node?", a: "The ability to receive payments based on funds others have locked with you", wrong: ["Funds transferred directly from your bank account into a Lightning channel", "Block rewards earned by miners that flow automatically into payment channels", "Profits generated from automated trading on a centralized exchange platform"] }
    ],
    "stablecoins": [
        { q: "Stablecoins in the Bitcoin ecosystem are typically:", a: "Tokens pegged to fiat currency values, sometimes built on Bitcoin layers", wrong: ["A special block subsidy paid to miners who meet the current difficulty target", "Bitcoin units whose price is locked by the protocol so it cannot fluctuate", "Central bank digital currencies issued by governments as a cash replacement"] },
        { q: "What backs the majority of USDT (Tether)?", a: "Commercial paper, cash equivalents, and other reserves (historically controversial)", wrong: ["One hundred percent US Treasury bonds held in a fully audited government escrow", "Physical gold bullion stored in Swiss vaults providing full one-to-one backing", "Bitcoin held in cold storage wallets providing direct crypto-native collateral"] },
        { q: "What major risk do centralized stablecoins pose?", a: "Issuer can freeze funds or fail to maintain peg", wrong: ["Mining them requires excessive computational power", "Transaction fees make small payments impractical", "Private key loss leaves users with no recourse"] },
        { q: "What caused USDC to depeg temporarily in March 2023?", a: "Exposure to failed Silicon Valley Bank", wrong: ["A Bitcoin price drop below key support levels", "A Lightning Network critical bug was discovered", "Reports of Satoshi Nakamoto selling his coins"] },
        { q: "Stablecoins are NOT a threat to Bitcoin because:", a: "They are centralized IOUs that can be frozen, while Bitcoin is permissionless", wrong: ["Stablecoins use the same decentralized proof-of-work technology that Bitcoin uses", "Bitcoin automatically converts into stablecoins during market crashes to protect value", "Stablecoins already have a larger total market capitalization than all Bitcoin"] }
    ],
    "consensus": [
        { q: "Bitcoin consensus means:", a: "All nodes agree on the state of the blockchain without a central authority", wrong: ["All Bitcoin holders vote on transactions and the majority outcome is accepted", "Miners single-handedly decide which transactions are valid without node verification", "Government regulators review and approve each block before it joins the chain"] },
        { q: "What is Nakamoto Consensus?", a: "The combination of proof-of-work, longest chain rule, and economic incentives", wrong: ["A proportional voting system where holders vote based on their Bitcoin holdings", "A formal governance process managed by the Bitcoin Foundation's elected board", "A consensus mechanism requiring all major exchanges to agree on the valid chain"] },
        { q: "Why does Bitcoin use the longest chain as the valid chain?", a: "Most proof-of-work indicates most energy/computational investment", wrong: ["The chain is selected at random from all competing valid available chains", "Shorter competing chains are discarded regardless of their computational work", "Network users submit formal votes to determine which chain is accepted"] },
        { q: "Nakamoto Consensus achieves agreement by:", a: "Having nodes follow the longest valid proof-of-work chain", wrong: ["Requiring all nodes to approve each transaction by peer majority vote", "Letting the wealthiest network node unilaterally decide which blocks are valid", "Using a central server to broadcast the correct chain to all network nodes"] },
        { q: "What happens if two miners find a valid block at nearly the same time?", a: "A temporary fork occurs and resolves when the next block is found", wrong: ["Both competing blocks are permanently accepted and merged into the blockchain", "The entire network automatically pauses until all nodes vote to resolve it", "The block from the longest-running mining node always takes priority"] },
        { q: "What does finality mean in Nakamoto Consensus?", a: "Reversals become exponentially harder with each confirmation", wrong: ["Transactions are instantly irreversible once broadcast to the first node", "Miners periodically vote to confirm finality for each individual transaction", "The longest chain is guaranteed to be correct and can never be altered"] },
        { q: "What are orphan blocks in Bitcoin?", a: "Valid blocks not included in the main chain", wrong: ["Invalid blocks rejected by network nodes", "Blocks that contain zero transactions inside", "Alternative variants of the genesis block"] },
        { q: "What is selfish mining in Bitcoin?", a: "Withholding found blocks to gain unfair advantage", wrong: ["Mining solo without joining any mining pool as defined by Bitcoin consensus rules enforced by all full nodes", "Using only renewable energy sources for mining", "Deliberately refusing to validate any transactions"] },
        { q: "What is the typical Bitcoin block propagation time?", a: "1-10 seconds globally", wrong: ["About 60 seconds on average", "Nearly instantaneous at all times", "Approximately 10 full minutes"] },
        { q: "What was the FIBRE network designed to improve?", a: "Block propagation speed between miners", wrong: ["Lightning Network payment routing as defined by Bitcoin consensus rules enforced by all full nodes", "Wallet synchronization with nodes as defined by Bitcoin consensus rules enforced by all full nodes", "Mining difficulty adjustment calculations"] }
    ],
    "open_source": [
        { q: "Bitcoin being open source means:", a: "Anyone can read, audit, and propose changes to the code", wrong: ["The source code is private but free to download and run by anyone", "Only developers pre-approved by the core team can view the source code", "It simply means mining Bitcoin costs nothing in electricity or hardware"] },
        { q: "What license is Bitcoin Core released under?", a: "MIT License (open source)", wrong: ["Proprietary commercial license", "GPL v3 only as defined by Bitcoin consensus rules enforced by all full nodes", "Patent-encumbered license"] },
        { q: "How can anyone contribute to Bitcoin Core?", a: "Submit pull requests on GitHub after code review", wrong: ["Pay a required developer fee to the Bitcoin Foundation for access", "Get a job at a bank that operates Bitcoin infrastructure nodes", "Apply for an official open source contributor license from the team"] },
        { q: "What is the purpose of code review in Bitcoin development?", a: "To catch bugs and security issues before deployment", wrong: ["To slow down the development process and ensure additional caution", "To charge developers a submission fee for contributing their patches", "To restrict source code visibility and keep it hidden from attackers"] },
        { q: "Why is peer review critical in Bitcoin Core development?", a: "It catches bugs and vulnerabilities before they reach production, since changes affect billions in value", wrong: ["It is simply a legal formality mandated by the MIT open source license with no real security benefit", "Only a single reviewer is required to approve even minor patches that touch critical consensus code", "Peer review is unnecessary overhead that slows development without adding any meaningful security value"] }
    ],
    "coin_mixing_coinjoin_coin_control_utxo": [
        { q: "CoinJoin improves privacy by:", a: "Combining multiple users' transactions so individual spending is hard to trace", wrong: ["Encrypting all blockchain transactions so their details are hidden from viewers", "Permanently deleting transaction history from the public blockchain record", "Inserting decoy transactions into blocks to confuse blockchain surveillance tools"] },
        { q: "What is CoinJoin?", a: "A privacy technique combining multiple users\\' transactions to break heuristics", wrong: ["A digital token specifically designed to enable anonymous coin mixing services", "A proprietary hardware wallet feature that encrypts transactions before broadcast", "A standard exchange withdrawal option that obscures the origin of transaction funds"] },
        { q: "What does coin control allow Bitcoin users to do?", a: "Manually select which UTXOs to spend in a transaction", wrong: ["Adjust the Bitcoin exchange rate displayed within your wallet software", "Set the mining difficulty to reduce your node's energy consumption", "Set the transaction confirmation speed across the whole network"] },
        { q: "What privacy benefit does proper UTXO management provide?", a: "Preventing address clustering and transaction graph analysis", wrong: ["Increasing block rewards paid to miners for processing each new block", "Reducing the transaction fees you pay to miners per network transfer", "Speeding up how quickly your transactions receive their confirmations"] },
        { q: "What is \"coin control\" in a Bitcoin wallet?", a: "The ability to manually select which UTXOs to spend in a transaction for better privacy", wrong: ["A government-mandated compliance program that monitors all Bitcoin spending for regulation", "An exchange software setting that limits how much Bitcoin a user can purchase per day", "A mining protocol feature that controls how frequently new blocks can be produced"] }
    ],
    "environment___energy": [
        { q: "Bitcoin mining's relationship with renewable energy is:", a: "Miners actively seek cheap renewable and stranded energy, incentivizing green energy development", wrong: ["Miners are forced by government regulation to exclusively use coal-powered electricity", "Renewable sources lack sufficient power density and reliability to support mining operations", "Bitcoin mining has no connection to the broader global energy market whatsoever as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "What percentage of Bitcoin mining comes from renewable energy (estimates)?", a: "Estimates range from 50-60% using renewable or stranded energy", wrong: ["Zero percent, since all mining relies entirely on coal-fired power plants", "One hundred percent clean energy, as all miners have fully committed to green power", "Under ten percent because fossil fuels remain far cheaper than any renewable source"] },
        { q: "What is \"stranded energy\" in Bitcoin mining?", a: "Energy that would otherwise go to waste due to lack of transmission infrastructure", wrong: ["Excess electricity from broken or malfunctioning solar panels at remote farm sites", "Power left unused in large lithium battery banks that can no longer be discharged", "Natural gas burned in industrial heating systems that is then converted to electricity"] },
        { q: "How does Bitcoin mining help stabilize electrical grids?", a: "Miners can rapidly reduce load during peak demand (demand response)", wrong: ["By storing surplus electricity in large on-site battery arrays for future reuse", "By donating a portion of their mining profits to local electrical utility companies", "By funding construction of additional coal-fired baseload power plants in nearby areas"] },
        { q: "What common criticism about Bitcoin energy use is often misrepresented?", a: "Per-transaction energy cost (Bitcoin uses same energy regardless of transaction count)", wrong: ["Carbon emissions per kilowatt-hour (most Bitcoin miners exclusively rely on fossil fuel grids)", "Total annual electricity compared to countries (mining consumes more than some European nations)", "Heat waste per mining farm (miners deliberately produce useless heat as a fundamental design flaw)"] }
    ],
    "austrian_school_of_economics": [
        { q: "The Austrian School of Economics relates to Bitcoin because:", a: "It advocates for sound money with limited supply, which Bitcoin embodies", wrong: ["It was founded in Vienna to support government-managed monetary and central banking systems", "It promotes central bank intervention and price controls to stabilize the broader economy", "It predicts that private assets like Bitcoin will collapse without sovereign price support"] },
        { q: "Which Austrian economist emphasized the importance of sound money and criticized fiat?", a: "Ludwig von Mises and Friedrich Hayek", wrong: ["John Maynard Keynes and Paul Samuelson", "Milton Friedman and Anna Jacobson Schwartz", "Karl Marx and Friedrich Engels as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "The Austrian School of Economics emphasizes:", a: "Sound money, free markets, and the dangers of central banking", wrong: ["Government control of money supply and all centralized economic planning", "The view that managed inflation is necessary and beneficial for long-run growth", "The idea that central banks should print money freely to stimulate aggregate demand"] },
        { q: "Who wrote \"The Theory of Money and Credit\"?", a: "Ludwig von Mises", wrong: ["John Maynard Keynes", "Paul Krugman as defined by Bitcoin consensus rules enforced by all full nodes", "Adam Smith as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "Saifedean Ammous' book \"The Bitcoin Standard\" argues that Bitcoin is the best form of money because:", a: "It is the hardest money ever created — no authority can inflate its supply", wrong: ["It provides higher investment returns than gold over any comparable 10-year period", "It is the only payment network capable of achieving true instant global settlement", "A global coalition of central banks has adopted it as their primary reserve asset"] }
    ],
    "lindy_effect": [
        { q: "The term \"Lindy Effect\" was coined and popularized in its modern form by:", a: "Nassim Nicholas Taleb in his 2012 book Antifragile", wrong: ["Satoshi Nakamoto in the Bitcoin whitepaper as defined by Bitcoin consensus rules enforced by all full nodes", "Albert Goldman originally in 1964 as defined by Bitcoin consensus rules enforced by all full nodes", "Benoît Mandelbrot in The Fractal Geometry of Nature"] },
        { q: "What is the Lindy Effect?", a: "The longer something survives, the longer its remaining life expectancy", wrong: ["A statistical model measuring how quickly Bitcoin mining difficulty adjusts to hash rate", "A type of cryptographic hash function used to verify Bitcoin block headers on-chain", "An industry certification that labels hardware wallet firmware as officially secure"] },
        { q: "The Lindy Effect applies to non-perishable things. Which of these would it NOT apply to?", a: "A human being - biological organisms have decreasing life expectancy with age", wrong: ["Bitcoin, which has survived and strengthened over 15+ years of relentless stress-testing", "The concept of sound money, which has persisted across thousands of years of civilisation", "The C++ programming language, widely used on critical systems since the early 1980s"] },
        { q: "What concept is closely related to Lindy Effect in Bitcoin?", a: "Antifragility - stress makes the system stronger", wrong: ["Network effects - more adopters exponentially raise a coin's value", "Reflexivity - rising prices reinforce further adoption and belief", "Mean reversion - assets always drift back to their long-run average"] },
        { q: "Why is Bitcoin's 15+ year survival significant for the Lindy Effect?", a: "Demonstrates resilience to attacks, bugs, and regulatory pressure", wrong: ["Proves the codebase is now too rigid and entrenched to accept meaningful future upgrades", "Makes it technically obsolete compared to newer blockchain protocols built after 2018", "Shows that its energy consumption has compounded past any level that society can sustain"] }
    ],
    "softwar": [
        { q: "Jason Lowery's Softwar thesis argues that:", a: "Proof-of-work is a form of digital power projection analogous to military power in the physical world", wrong: ["Bitcoin mining hardware can be weaponized to disable foreign financial networks and enemy critical infrastructure", "Software-defined systems will eventually replace all conventional military hardware, rendering standing armies obsolete", "Bitcoin was secretly developed by the US Department of Defense as a covert mechanism to fund classified cyber operations"] },
        { q: "Who authored the \"Softwar\" thesis about Bitcoin?", a: "Major Jason Lowery of the US Space Force", wrong: ["Lieutenant Colonel Michael Saylor, US Army", "Commander Nick Szabo of the Naval Cyber Division", "Professor Hal Finney of the West Point Academy"] },
        { q: "What is the core argument of the Softwar thesis?", a: "Proof-of-work is a form of kinetic power projection for cyberspace", wrong: ["Bitcoin should be classified as regulated military-grade defense technology", "Proof of stake provides superior deterrence for national security than proof-of-work", "Bitcoin was designed by classified US intelligence agencies as an offensive cyberweapon"] },
        { q: "What does Softwar compare Bitcoin\\'s hash rate to?", a: "Physical military power projection and deterrence", wrong: ["Social media influence and online narrative dominance", "Stock market capitalization and daily trading volume", "Aggregate banking reserves and credit market issuance"] },
        { q: "How does the Softwar thesis view Bitcoin mining in terms of national security?", a: "As a strategic asset that projects power in cyberspace, similar to how militaries project power in physical space", wrong: ["As a dangerous liability exposing power grids to attack, and a threat that nations should ban to protect critical infrastructure", "As a profit-seeking commercial activity with zero geopolitical significance, no different from operating commercial cloud servers", "As a direct computational replacement for nuclear deterrence, where hash rate substitutes for megatons as the deterrence measure"] },
        { q: "What military rank is Jason Lowery?", a: "Major", wrong: ["Colonel", "Lieutenant", "Captain"] },
        { q: "What university did Jason Lowery work with on his thesis?", a: "MIT", wrong: ["Harvard", "Stanford", "Caltech"] },
        { q: "According to Softwar, what does proof of work project?", a: "Physical power through cyberspace", wrong: ["Financial return on invested capital", "Social consensus through majority voting", "Network bandwidth and transaction throughput"] },
        { q: "How does Softwar view Bitcoin for nation-states?", a: "A strategic defense technology", wrong: ["A replacement for fiat currency", "A consumer payment system as defined by Bitcoin consensus rules enforced by all full nodes", "An unregulated security asset"] },
        { q: "What energy concept is central to the Softwar thesis?", a: "Using energy to secure cyberspace property", wrong: ["Lowering energy costs to maximize mining profitability margins", "Shifting all global mining operations toward renewable energy sources", "Profiting from arbitrage across regional electricity price differentials"] }
    ],
    "sidechains": [
        { q: "A Bitcoin sidechain is:", a: "A separate blockchain that is pegged to Bitcoin, enabling additional features while settling back to the main chain", wrong: ["A parallel database that mirrors Bitcoin's full transaction history as a redundant off-site backup for disaster recovery purposes", "An optimized fork of Bitcoin Core with larger blocks and faster confirmations designed for high-volume payment processing", "An independent blockchain that permanently split from Bitcoin to pursue different governance, rules, and monetary policy goals"] },
        { q: "What is the Liquid Network?", a: "A federated sidechain enabling faster confidential Bitcoin transactions", wrong: ["An Ethereum layer-2 scaling solution enabling fast and private ERC-20 token swaps", "A cooperative mining pool where participants combine hash rate for smoother block rewards", "An air-gapped hardware device that signs Bitcoin transactions offline using secure enclaves"] },
        { q: "What is RSK (Rootstock)?", a: "A Bitcoin sidechain supporting smart contracts with merged mining", wrong: ["A major centralized cryptocurrency exchange and custody platform based in Russia", "A tamper-resistant hardware device for securely storing Bitcoin and crypto private keys", "A custodial Lightning wallet application designed for easy mobile Bitcoin payments"] },
        { q: "How are assets secured when moving to a sidechain?", a: "Through a federated peg locking bitcoin on mainchain", wrong: ["By permanently destroying bitcoin in a verifiable on-chain burn transaction", "By delegating full custody to a single centralized bridge institution", "No formal security exists since sidechains operate entirely independently"] },
        { q: "What is a downside of federated sidechains compared to Bitcoin mainchain?", a: "Less decentralization due to reliance on federation members", wrong: ["Higher transaction fees due to additional cross-chain bridging overhead costs", "Slower block confirmation times than the Bitcoin mainchain baseline speed", "No support for scripting languages or any programmable smart contract logic"] }
    ],
    "submarine_swap": [
        { q: "A submarine swap allows you to:", a: "Exchange on-chain Bitcoin for Lightning Bitcoin (or vice versa) trustlessly", wrong: ["Mine Bitcoin using specialised deep-sea cooling rigs for better thermal efficiency", "Send Bitcoin transactions without the internet using a mesh radio relay network", "Convert Bitcoin into Ethereum through a cross-chain atomic bridge smart contract"] },
        { q: "Why is it called a \"submarine\" swap?", a: "On-chain is \"above water\" and Lightning off-chain is \"below water\" - you swap between the two", wrong: ["The swap conceals funds below the blockchain visible layer before resurfacing on-chain", "On-chain funds are submerged in a time-locked escrow vault beneath the mempool layer", "The name comes from the HTLC diving beneath regular channel capacity during the swap"] },
        { q: "What enables submarine swaps to be trustless?", a: "HTLCs (Hash Time Locked Contracts)", wrong: ["Centralized exchange custodial holding services", "Bank wire settlement and confirmation process", "Social media identity verification systems"] },
        { q: "What problem do submarine swaps solve?", a: "Moving funds between on-chain and Lightning without closing channels", wrong: ["Automatically rebalancing mining pool difficulty when large hash rate enters or exits", "Stabilising the exchange rate between on-chain BTC and Lightning-denominated sats", "Recovering wallet access when a user loses their hardware device or written seed phrase"] },
        { q: "Alex Bosworth and Olaoluwa Osuntokun created submarine swaps while at which company?", a: "Lightning Labs", wrong: ["Blockstream", "Chaincode Labs", "River Financial"] },
        { q: "What is a Loop Out in Lightning?", a: "Moving funds from Lightning back to on-chain", wrong: ["Opening a new outbound Lightning payment channel", "Receiving additional inbound Lightning payment capacity", "Closing all existing active payment channels at once"] },
        { q: "What is Boltz Exchange known for?", a: "Trustless on-chain and Lightning swaps", wrong: ["Running a proof-of-work Bitcoin mining pool", "Operating a custodial centralized exchange", "Selling proprietary Bitcoin hardware wallets"] },
        { q: "What makes submarine swaps trustless?", a: "Atomic hash time-locked contracts", wrong: ["Multi-signature federated escrow wallets", "Trusted third-party intermediary verification", "Proof of stake validator consensus rules"] },
        { q: "How do submarine swaps differ from atomic swaps?", a: "They move between layers of the same chain", wrong: ["Submarine swaps always require a trusted third party", "Atomic swaps confirm significantly faster and cheaper", "Submarine swaps always exchange between different coins"] },
        { q: "What enables cross-chain atomic swaps without intermediaries?", a: "HTLCs combining hashlock and timelock", wrong: ["Trusted custodial escrow bridge services", "Centralized exchange matching order books", "Smart contract bytecode execution platforms"] }
    ],
    "supranational": [
        { q: "What does \"supranational\" mean in the context of Bitcoin?", a: "It transcends national borders and governments", wrong: ["It is officially backed by the United Nations reserve fund", "It requires international regulatory approval before use", "It can only be used in certified cross-border transactions"] },
        { q: "What does it mean that Bitcoin is \"supranational\" money?", a: "It operates beyond any single nation's jurisdiction or control", wrong: ["It is jointly governed by a coalition of United Nations member states", "Only licensed financial institutions and governments are permitted to use it", "It requires international banking licenses from the BIS to legally operate"] },
        { q: "Bitcoin settlement finality means:", a: "Once confirmed, transactions cannot be reversed", wrong: ["Transactions can be disputed within 30 days", "A central authority must approve each transaction", "Only miners can verify if a transaction is final"] },
        { q: "Which of these best demonstrates Bitcoin's supranational nature?", a: "A citizen of any country can hold Bitcoin without a bank or government permission", wrong: ["The United Nations officially declared Bitcoin legal tender for all member nations in 2021", "All Bitcoin miners are legally required to register with their national financial regulators", "Cross-border Bitcoin transfers require a valid SWIFT banking code to be processed successfully"] },
        { q: "What makes Bitcoin different from national currencies like the dollar or euro?", a: "No central bank can print more or manipulate its supply", wrong: ["It is backed by physical gold reserves held in US Treasury vaults", "It requires explicit government authorization for every transaction", "It can only function within licensed and regulated online platforms"] }
    ],
    "organic": [
        { q: "Bitcoin grew organically because:", a: "It had no pre-mine, no ICO, and no marketing budget", wrong: ["A major corporation funded its development as defined by Bitcoin consensus rules enforced by all full nodes", "Governments agreed to adopt it simultaneously", "Social media algorithms promoted it automatically"] },
        { q: "What makes Bitcoin's distribution unique among cryptocurrencies?", a: "Fair launch - no coins were pre-allocated to founders", wrong: ["Satoshi kept 50% of all coins before launch as defined by Bitcoin consensus rules enforced by all full nodes", "Venture capitalists funded the initial distribution", "Coins were distributed based on national GDP as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "How has Bitcoin grown without traditional marketing?", a: "Through grassroots adoption and word-of-mouth from users", wrong: ["Through massive multi-million dollar advertising campaigns across media", "Through celebrity endorsements and paid influencer marketing deals", "Through government subsidies and partnerships with central banks"] },
        { q: "What drives Bitcoin\\'s organic adoption in developing countries?", a: "Real need for inflation protection and remittance savings", wrong: ["Central bank mandates requiring citizens to hold Bitcoin reserves", "Corporate marketing campaigns funded by Silicon Valley venture firms", "Mandatory school curriculum programs teaching Bitcoin to all students"] },
        { q: "What is the role of Bitcoin\\'s open source community?", a: "Volunteer developers contribute code without corporate hierarchy", wrong: ["Paid employees of the Bitcoin Foundation who control all protocol decisions", "They receive government salaries and grants to maintain the network", "They own a large reserve of bitcoins used to fund development work"] }
    ],
    "programmable": [
        { q: "Bitcoin Script is intentionally limited because:", a: "Simplicity reduces attack surface and increases security", wrong: ["Satoshi lacked the programming skills needed to build a more complex system", "The blockchain physically cannot store or process complex instructions", "It was designed as a temporary placeholder intended to be fully upgraded"] },
        { q: "What does \"Turing-incomplete\" mean for Bitcoin Script?", a: "It cannot run arbitrary programs or infinite loops", wrong: ["It cannot process any transactions at all without external validation", "It requires a separate computer to verify and execute each script", "It can only handle one transaction per block due to stack memory limits"] },
        { q: "What makes Bitcoin programmable money?", a: "Bitcoin Script enables conditional spending and smart contracts", wrong: ["Only licensed banks and financial institutions can write Bitcoin scripts", "It executes Python code directly on nodes using a built-in interpreter", "A central team of approved programmers controls all transaction logic"] },
        { q: "What are timelocks in Bitcoin?", a: "Conditions preventing spending until a specific time or block height", wrong: ["Physical locks built into hardware wallets that prevent unauthorized access", "Password requirements set by exchanges to restrict withdrawal timing", "Banking hours restrictions preventing Bitcoin transfers outside business hours"] },
        { q: "What is a multisig (multi-signature) transaction?", a: "Requires multiple private keys to authorize spending", wrong: ["Multiple separate transactions that are combined into a single payment", "Multiple miners required to confirm and validate a single transaction", "Multiple exchanges that must approve and relay the transaction together"] }
    ],
    "ordinals": [
        { q: "Bitcoin Ordinals allow:", a: "Inscribing data (images, text) directly on individual satoshis", wrong: ["Creating new programmable tokens on top of the Bitcoin base layer", "Speeding up transaction confirmation times by batching multiple payments", "Reducing the total circulating supply of Bitcoin through burn mechanisms"] },
        { q: "Why are Ordinals controversial in the Bitcoin community?", a: "They increase block space demand and fees for financial transactions", wrong: ["They permanently alter the 21 million supply cap by creating new satoshis", "They require a contentious hard fork to implement, risking a chain split", "They give miners exclusive control over which transactions get confirmed"] },
        { q: "What are Bitcoin Ordinals?", a: "A numbering system for satoshis enabling inscription of arbitrary data", wrong: ["A type of altcoin token built on a separate sidechain alongside Bitcoin", "A new mining algorithm designed to replace the proof-of-work consensus system", "A specialized Lightning Network channel type used for streaming micropayments"] },
        { q: "What controversial use case emerged from Ordinals?", a: "BRC-20 tokens creating fungible tokens on Bitcoin", wrong: ["Instant payment settlement bypassing the mempool fee market entirely", "Hardware wallet security features using Ordinal-tracked satoshi keys", "Private key encryption schemes using data inscribed on satoshis"] },
        { q: "What is the debate around Ordinals inscriptions?", a: "They use block space, potentially raising fees for regular transactions", wrong: ["They exploit Bitcoin Script vulnerabilities to transfer funds from wallets", "They embed malicious executable code that can compromise full nodes", "They prevent mining from working by overloading nodes with inscription data"] }
    ],
    "geopolitics___macroeconomics": [
        { q: "Why is Bitcoin relevant to geopolitics?", a: "It provides a neutral monetary system outside any nation's control", wrong: ["Major governments collectively control Bitcoin's code through an international treaty", "Bitcoin mining is only legal in a small handful of G20-member countries", "The United Nations actively regulates and monitors Bitcoin's international transfers"] },
        { q: "What is the \"petrodollar\" system?", a: "Oil is priced in US dollars, forcing global demand for the dollar", wrong: ["A type of digital currency that is fully backed by physical oil reserves", "A Bitcoin mining technique that relies exclusively on petroleum-powered generation", "A special tax imposed on all Bitcoin transactions by major oil-producing nations"] },
        { q: "Which country was the first to adopt Bitcoin as legal tender?", a: "El Salvador in September 2021", wrong: ["The United States in early 2022", "Japan in November 2020 as defined by Bitcoin consensus rules enforced by all full nodes", "Germany in December 2019 as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "How do sanctions-evading nations view Bitcoin?", a: "As a way to circumvent SWIFT restrictions and frozen reserves", wrong: ["As a serious threat to local currency stability and existing capital controls", "As a covert US surveillance tool designed to track all foreign transactions", "As illegal under international law and actively banned by all sanctioned regimes"] },
        { q: "What macro trend drives Bitcoin adoption during inflation?", a: "Currency debasement making bitcoin\\'s fixed supply attractive", wrong: ["Lower interest rates on Bitcoin savings accounts offered by regulated exchanges", "Government subsidies distributed to citizens who hold verified Bitcoin savings", "Strict bank account requirements that push unbanked users toward digital assets"] },
        { q: "What is the BRICS de-dollarization movement and how does it relate to Bitcoin?", a: "BRICS nations are reducing dollar dependence, creating demand for neutral reserves like Bitcoin", wrong: ["BRICS nations jointly launched a Bitcoin mining pool to dominate block production and earn seigniorage", "BRICS nations have collectively banned Bitcoin to shield their central bank digital currencies from competition", "BRICS de-dollarization is complete because all five member nations have officially adopted Bitcoin as legal tender"] },
        { q: "What is the \"strategic Bitcoin reserve\" concept that multiple nations are exploring?", a: "Nations accumulating Bitcoin as a reserve asset alongside gold for its scarcity and hedge value", wrong: ["A legal requirement for all nations to back their fiat currency reserves with a fixed proportion of Bitcoin", "A binding UN mandate requiring every member country to hold at least one thousand Bitcoin in sovereign reserves", "A coordinated IMF program where central banks systematically replace all existing gold reserves with Bitcoin"] },
        { q: "What is the \"nation-state game theory\" argument for Bitcoin adoption?", a: "Early adopter nations gain a massive strategic edge, pressuring others to follow or fall behind", wrong: ["Nations that ban Bitcoin grow more economically powerful because they retain full control of their money supply", "Game theory conclusively proves that no sovereign nation will ever voluntarily hold Bitcoin as a reserve asset", "Nation-state game theory around Bitcoin only applies to countries that already possess nuclear weapons stockpiles"] },
        { q: "How do proponents respond to critics who say Bitcoin is used for sanctions evasion?", a: "Bitcoin's transparent public ledger makes transactions easier to trace than physical cash", wrong: ["Many Bitcoin proponents openly admit that sanctions evasion represents its primary real-world use case today", "All Bitcoin transactions are completely invisible and therefore undetectable by any government or agency", "International sanctions do not legally apply to any digital assets under any existing international law"] },
        { q: "How do institutions like the IMF and World Bank view Bitcoin?", a: "Generally hostile - they've pressured nations like El Salvador to drop Bitcoin legal tender status", wrong: ["The IMF and World Bank are secretly among the largest institutional Bitcoin holders, controlling millions of BTC", "Both organizations have publicly and enthusiastically endorsed Bitcoin as the clear future of global reserve finance", "The IMF originally created Bitcoin as a planned technical replacement for its existing Special Drawing Rights system"] }
    ],
    "op-codes": [
        { q: "Bitcoin OP_CODES are:", a: "Instructions in Bitcoin's scripting language that define spending conditions", wrong: ["Numerical error codes automatically returned to the sender when a transaction fails validation", "Standardized codes used to transmit data and coordinate operations between competing mining pools", "Secret backdoor commands embedded by Bitcoin core developers for emergency network maintenance"] },
        { q: "OP_RETURN allows:", a: "Embedding small amounts of arbitrary data in the blockchain", wrong: ["Reversing a confirmed transaction and refunding bitcoin to the original sender", "Returning stolen or lost Bitcoin to its rightful owner through a scripted rollback", "Dynamically increasing the block size limit when sustained network demand is high"] },
        { q: "What is OP_CHECKSIG in Bitcoin Script?", a: "Verifies a digital signature against a public key", wrong: ["Creates new bitcoins by triggering a scheduled coinbase reward mechanism", "Encrypts the full transaction data before broadcasting it to the network", "Connects nodes automatically to approved mining pools for transaction validation"] },
        { q: "What was the OP_RETURN controversy?", a: "Its limit was reduced to prevent blockchain bloat from non-financial data", wrong: ["It was exploited by attackers to secretly drain funds from major custodial exchanges", "A bug in OP_RETURN was discovered that allowed malicious miners to create unlimited bitcoins", "An early OP_RETURN implementation bug halted all network transactions for several days"] },
        { q: "What did Taproot enable for Bitcoin opcodes?", a: "More flexible scripting through Schnorr signatures and Merkle branches", wrong: ["Removal of all previous legacy script types and their replacement with simpler code", "Full compatibility with Ethereum-style smart contracts through a cross-chain bridge opcode", "Centralized approval of all new scripts by an elected committee of Bitcoin core developers"] },
        { q: "What would OP_CAT enable if re-enabled?", a: "Concatenation of data values in script", wrong: ["Comparison of timestamp values across multiple simultaneous script branches", "Multiplication of two numeric values within a single stack script operation", "Direct verification of cryptographic signatures placed anywhere on the stack"] },
        { q: "What does OP_CHECKSIGFROMSTACK verify?", a: "Arbitrary message signatures on the stack", wrong: ["Only standard transaction signatures derived from predefined ECDSA keypairs", "Block header signatures that are submitted by miners to claim their block rewards", "Lightning Network commitment signatures used for off-chain channel balance updates"] },
        { q: "What is Simplicity designed for in Bitcoin?", a: "Formal verification of smart contracts", wrong: ["Faster transaction processing speeds", "Simplified user wallet address formats", "Reduced on-chain footprint of block data"] },
        { q: "What is a major limitation of Bitcoin Script?", a: "No loops or complex control flow", wrong: ["Maximum of 100 opcodes per script", "Cannot handle any signatures as defined by Bitcoin consensus rules enforced by all full nodes", "Requires active internet access"] },
        { q: "Which script type was introduced with Taproot?", a: "P2TR (Pay to Taproot)", wrong: ["P2SH (Pay to Script Hash)", "P2WSH (Pay to Witness Script)", "P2PKH (Pay to Pub Key Hash)"] }
    ],
    "public_key_vs_private_key": [
        { q: "Your Bitcoin public key is like:", a: "Your email address - you share it so people can send you Bitcoin", wrong: ["Your password - keep it private so no one can access your funds", "Your bank PIN code - used only by you to authorize payments", "Your social security number - it proves and confirms your identity"] },
        { q: "If someone has your private key, they can:", a: "Spend all the Bitcoin controlled by that key", wrong: ["Only read and view your full transaction history", "Reset your wallet password and lock you out", "Create new Bitcoin out of thin air freely"] },
        { q: "What is the relationship between private and public keys?", a: "Public keys are derived from private keys via one-way cryptographic function", wrong: ["Private keys are distributed publicly so any node can verify transactions", "Public keys encrypt the private key using symmetric cryptographic methods", "They are mathematically identical values stored in just different formats"] },
        { q: "What should you do with your private keys?", a: "Keep them secret and secure, never share with anyone", wrong: ["Publish them openly online for community verification", "Email them to exchanges for secure account recovery", "Print them on merchandise to promote Bitcoin adoption"] },
        { q: "What is the purpose of a public key?", a: "To receive bitcoin and verify signatures without revealing the private key", wrong: ["To spend and send bitcoin to others without requiring any additional keys", "To mine new blocks on the network and collect the associated block reward", "To generate and derive the matching private key through mathematical means"] }
    ],
    "transaction_fees": [
        { q: "Bitcoin transaction fees are determined by:", a: "The size of the transaction in bytes and current network demand", wrong: ["A fixed percentage of the total amount sent in each transaction", "The total number of bitcoin units being sent in the transaction", "The geographic distance between the sender and recipient addresses"] },
        { q: "When the mempool is full:", a: "Transactions with higher fees get confirmed first", wrong: ["All transactions are rejected until the mempool clears", "The block size limit is automatically increased", "Transaction fees are fully refunded to all senders"] },
        { q: "What determines Bitcoin transaction fees?", a: "Transaction size in bytes and current network demand (mempool congestion)", wrong: ["The total transaction amount in bitcoin sent to the recipient address", "The sender's account reputation and transaction history with miners", "Government regulatory requirements and compliance fees imposed on nodes"] },
        { q: "What is the mempool?", a: "A waiting area for unconfirmed transactions held by nodes", wrong: ["A mining hardware pool where miners jointly operate equipment", "A decentralized cryptocurrency exchange for peer-to-peer trading", "A type of hardware Bitcoin wallet for offline secure storage"] },
        { q: "Why do fees spike during network congestion?", a: "Users compete for limited block space by bidding higher fees", wrong: ["Miners arbitrarily raise fee requirements during busy periods", "Bitcoin exchanges charge extra fees during periods of peak usage", "The Bitcoin supply shrinks due to an accelerated halving schedule"] }
    ],
    "philosophy": [
        { q: "\"Don't trust, verify\" means:", a: "Run your own node to independently verify all Bitcoin rules", wrong: ["Never use Bitcoin because its security model cannot be trusted", "Only trust exchanges that are licensed and government-regulated", "Always verify your identity before making any Bitcoin transaction"] },
        { q: "The concept \"Bitcoin is Time\" by Gigi suggests:", a: "Bitcoin creates a decentralized clock through proof of work", wrong: ["Bitcoin transactions can be rolled back using timestamp proofs", "Bitcoin was invented to help people save and manage their time", "Bitcoin mining depends on GPS-synchronized atomic clock networks"] },
        { q: "What is the cypherpunk movement that birthed Bitcoin?", a: "Advocates for privacy through cryptography and code over trust", wrong: ["Bankers advocating for digitized central bank money and payments", "Game developers creating virtual in-game currencies and economies", "Government officials promoting digital tracking of all transactions"] },
        { q: "What does it mean that Bitcoin had a \"fair launch\"?", a: "No pre-mine, no ICO - anyone could mine from day one on equal terms", wrong: ["The government approved it as legal tender before any public launch", "Satoshi pre-distributed coins equally to all early registered users", "A public committee reviewed and officially certified the genesis block"] },
        { q: "What does Bitcoin\\'s \"monetary policy\" refer to?", a: "Fixed supply schedule with predictable issuance rate until 21 million", wrong: ["Central bank interest rate policies that control inflation and growth", "Government fiscal spending policies that regulate how money is issued", "Investment fund allocation strategies used by major asset managers"] },
        { q: "Who wrote the Cypherpunk Manifesto?", a: "Eric Hughes", wrong: ["Timothy May", "Julian Assange", "Nick Szabo"] },
        { q: "What concept did Timothy May advocate for in the Crypto-Anarchist Manifesto?", a: "Using cryptography to protect individual privacy", wrong: ["Building centralized digital currency systems", "Government regulation of all encryption tools", "Corporate ownership of communication networks"] },
        { q: "What was Nick Szabo's Bit Gold concept?", a: "A digital collectible using proof of work", wrong: ["A stablecoin fully backed by physical gold", "A centralized government digital currency", "A Lightning-style payment channel design"] },
        { q: "What did Wei Dai propose with b-money?", a: "Anonymous digital cash with decentralized minting", wrong: ["A blockchain system with standard mining reward schedules", "A central bank platform to control digital currency issuance", "A gold-certificate system for tracking physical gold ownership"] },
        { q: "What was Hal Finney's famous contribution to Bitcoin?", a: "Received the first Bitcoin transaction from Satoshi", wrong: ["Co-authored the original Bitcoin whitepaper with Satoshi", "Invented the SHA-256 hashing algorithm for Bitcoin mining", "Launched the very first Bitcoin exchange for public trading"] }
    ],
    "halving": [
        { q: "The Bitcoin halving occurs every:", a: "210,000 blocks (approximately every 4 years)", wrong: ["Once every calendar year, on or around January 3rd", "Every 100,000 blocks mined on the network", "Whenever the market price of Bitcoin doubles in value"] },
        { q: "After the 2024 halving, the block reward is:", a: "3.125 BTC per block", wrong: ["6.25 BTC per block", "1.5625 BTC per block", "50 BTC per block"] },
        { q: "The halving is significant because it:", a: "Mathematically enforces Bitcoin's decreasing supply issuance", wrong: ["Doubles the total circulating supply of Bitcoin in the market", "Reduces the number of active miners by half temporarily", "Changes Bitcoin's proof-of-work consensus mechanism entirely"] },
        { q: "What happens during a Bitcoin halving?", a: "Block reward paid to miners is cut in half", wrong: ["Transaction fees are automatically doubled for users", "The total circulating supply of Bitcoin doubles", "The Bitcoin mining difficulty level also halves"] },
        { q: "When will the final bitcoin be mined?", a: "Around year 2140 when all 21 million are issued", wrong: ["Around year 2025 when the block subsidy drops to zero", "Around year 2040 at the current pace of new block mining", "Mining never ends because rewards continue indefinitely"] }
    ],
    "bitcoin_vs_real_estate": [
        { q: "What are the inflation-adjusted annual returns of US real estate over a full century?", a: "Approximately 0–2% real annual returns after accounting for inflation, far below the impressive nominal figures typically advertised by the industry", wrong: ["Approximately 6–8% real annual returns after inflation, making residential property the most reliable long-term wealth preservation asset available", "Approximately 4–5% real annual returns after inflation, driven primarily by land scarcity in growing metropolitan and coastal urban areas", "Approximately 3–4% real annual returns after inflation, compounding consistently across all US regional markets over every significant historical period"] },
        { q: "What ongoing costs does real estate ownership typically impose on investors?", a: "1–4% of property value annually in maintenance costs alone, plus additional property taxes, insurance premiums, and management fees on top of that", wrong: ["Less than 0.5% of property value annually, making residential real estate the most cost-efficient long-term store of value among all asset classes", "Exactly 2% of property value annually, standardized by industry actuarial formulas and applied uniformly across all residential property types", "5–10% of property value annually for commercial properties only; well-maintained residential homes carry negligible operating costs once fully paid off"] },
        { q: "How does Bitcoin's liquidity compare to real estate when investors need to exit a position?", a: "Bitcoin trades 24/7 globally with settlement in minutes; real estate typically requires 30–90 days to sell and incurs 5–10% in transaction costs", wrong: ["Real estate sells faster than Bitcoin in most markets because institutional buyers routinely complete off-market transactions within 48 business hours", "Both assets have similar liquidity profiles since Bitcoin's extreme volatility makes it practically impossible to exit large positions at fair market value", "Bitcoin and real estate carry comparable transaction costs since major crypto exchanges charge 5–7% fees on high-value liquidation orders"] },
        { q: "How does real estate use leverage, and what risk does that introduce?", a: "Real estate commonly uses mortgage leverage to amplify gains, but this equally amplifies losses during price downturns and can wipe out equity entirely", wrong: ["Real estate leverage is capped by regulation at 20% of property value, making catastrophic leveraged losses virtually impossible under normal conditions", "Real estate leverage always benefits owners long-term because national property values have never declined over any rolling 10-year historical period", "Leverage risk applies only to commercial real estate; owner-occupied residential mortgages are federally insured against any significant loss of principal"] },
        { q: "Can Bitcoin be transferred internationally as easily as real estate can be conveyed between parties?", a: "Bitcoin settles globally across borders in minutes with no intermediaries required; real estate is geographically immovable and cannot cross borders at all", wrong: ["Both assets are equally difficult to transfer internationally due to strict capital controls and harmonized anti-money-laundering regulations worldwide", "Real estate transfers more easily across some international jurisdictions because standardized legal frameworks exist under international property law treaties", "Bitcoin international transfers face the same title verification and escrow delays as real estate due to mandatory blockchain finality confirmation periods"] },
        { q: "How does Bitcoin differ from real estate when it comes to government seizure risk?", a: "Property can be seized through eminent domain, tax liens, or civil forfeiture by governments; properly secured self-custodied Bitcoin cannot be confiscated", wrong: ["Both assets are equally vulnerable to government seizure since courts can subpoena Bitcoin private keys the same way they can seize titled property", "Real estate is better protected from seizure than Bitcoin because constitutional property rights provide stronger legal safeguards against government confiscation", "Bitcoin is more vulnerable to seizure than real estate since regulated exchanges are required to freeze accounts and comply with government asset orders"] },
        { q: "How does Bitcoin's divisibility compare to real estate for investors with limited capital?", a: "Bitcoin is divisible down to 1 satoshi (0.00000001 BTC), allowing fractional purchases at any size; you cannot sell 0.01% of a house to raise cash", wrong: ["Real estate through REITs is more divisible than Bitcoin, which enforces a minimum practical transaction size of 0.001 BTC on most networks", "Both assets are equally accessible to small investors since modern fractional ownership platforms let people buy proportional shares of any property", "Real estate is more accessible to capital-constrained investors because government programs allow property acquisition with as little as 1% down payment"] },
        { q: "How does Bitcoin's geographic risk profile differ from that of real estate?", a: "Real estate values depend entirely on local economies and geography; Bitcoin is a global asset uncorrelated with any specific regional market or jurisdiction", wrong: ["Bitcoin and real estate are highly correlated hard assets that both respond identically to global CPI data, Federal Reserve rate changes, and currency debasement cycles", "Bitcoin actually carries more geographic concentration risk than real estate because the majority of all mining activity is located in just two or three countries", "Major global-city real estate markets are largely uncorrelated with local economic conditions and behave identically to fully global assets like commodity futures"] },
        { q: "How has Bitcoin performed relative to real estate over any 4-year or longer holding period?", a: "Bitcoin has outperformed real estate by an enormous margin over every 4-year or longer holding period across its entire existence as an asset class", wrong: ["Real estate has consistently outperformed Bitcoin on a risk-adjusted basis over 4-year holding periods due to its substantially lower price volatility", "Bitcoin and real estate have delivered nearly identical total returns over 4-year periods once leverage, tax benefits, and rental income are properly included", "Bitcoin has outperformed real estate only in exceptional bull market cycles; most 4-year holding period comparisons show highly mixed and inconclusive results"] },
        { q: "What happened to real estate values during hyperinflation in countries like Venezuela, Zimbabwe, and Lebanon?", a: "Real estate also lost value in hard money terms during hyperinflation across Venezuela, Zimbabwe, and Lebanon; Bitcoin preserved purchasing power for those who held it", wrong: ["Real estate proved to be the most reliable inflation hedge in Venezuela and Zimbabwe, consistently outperforming gold, foreign currency, and every other measured asset class", "Real estate fully retained its value in all documented hyperinflationary environments, since physical property cannot be devalued by money printing or currency collapse", "Real estate outperformed Bitcoin in hyperinflationary countries because local governments banned cryptocurrency exchanges and blocked all digital asset transactions"] }
    ],
    "bitvm": [
        { q: "What does BitVM enable on Bitcoin without requiring a protocol change?", a: "Arbitrary computation verification through fraud proofs", wrong: ["Turing-complete smart contracts executed by miners", "On-chain virtual machine execution like the EVM as defined by Bitcoin consensus rules enforced by all full nodes", "Zero-knowledge proof generation inside Bitcoin Script"] },
        { q: "BitVM uses which computational model to verify off-chain computation?", a: "An optimistic model with prover claims and verifier challenges", wrong: ["A zero-knowledge model where proofs are posted each block", "A consensus model where all nodes re-execute computation", "A federated model where trusted signers attest to results"] },
        { q: "In BitVM, what is the fundamental logic gate used to represent any computable function?", a: "NAND gates", wrong: ["AND gates", "XOR gates", "NOR gates"] },
        { q: "Who proposed the original BitVM whitepaper?", a: "Robin Linus", wrong: ["Peter Todd", "Jeremy Rubin", "Andrew Poelstra"] },
        { q: "How does BitVM2 improve upon the original BitVM design?", a: "It reduces on-chain transactions needed for dispute resolution", wrong: ["It adds Turing-complete execution directly on the base layer", "It eliminates the need for any verifier role in the protocol", "It requires a Bitcoin soft fork to enable several needed opcodes"] }
    ],
    "block_time-block-size": [
        { q: "Why did Satoshi choose approximately 10 minutes for Bitcoin's target block time?", a: "It balances throughput with time needed for global block propagation", wrong: ["It was arbitrary with no real technical justification behind it", "Faster blocks would make mining unprofitable due to power costs", "It matches the average time needed for international wire transfers"] },
        { q: "What is the difference between block weight and block size in Bitcoin?", a: "Weight counts witness bytes at a discount versus non-witness bytes", wrong: ["Block weight and block size are identical with different names", "Block weight measures computational effort to validate a block", "Block weight only applies to Lightning Network transactions"] },
        { q: "What is the maximum block weight allowed by Bitcoin's consensus rules?", a: "4 million weight units (4 MWU)", wrong: ["1 megabyte of raw data", "8 million weight units (8 MWU)", "2 million weight units (2 MWU)"] },
        { q: "Why does SegWit give witness data a discount in the block weight calculation?", a: "Witness data costs less for nodes to process, incentivizing adoption", wrong: ["Witness data is encrypted and takes up less physical storage", "The discount was a political compromise with no technical basis", "Witness data is stored temporarily then deleted after 100 blocks"] },
        { q: "What is \"blockspace economics\" in Bitcoin?", a: "The fee market where users bid for limited space in each block", wrong: ["A government program subsidizing mining in renewable energy zones", "The cost of running a full node in electricity and bandwidth", "A pricing model used for Lightning Network channel capacity"] }
    ],
    "burn_bitcoin": [
        { q: "What is the maximum amount of data that can be stored in an OP_RETURN output?", a: "80 bytes", wrong: ["40 bytes", "160 bytes", "1000 bytes"] },
        { q: "What does it mean for Bitcoin to be provably unspendable through OP_RETURN?", a: "The output has no valid script path to spend it", wrong: ["It requires a special private key to spend", "It can only be spent after 100 confirmations", "It is temporarily locked until a timelock expires"] },
        { q: "Roughly how many Bitcoin are estimated to be permanently lost or burned?", a: "Between 3-4 million BTC", wrong: ["Less than 1 million BTC", "Over 10 million BTC", "Exactly 1 million BTC"] },
        { q: "What type of Bitcoin address output is provably unspendable with no script?", a: "Bare multisig with invalid pubkeys", wrong: ["Standard P2PKH legacy address output scripts", "Wrapped P2SH redeem script hash outputs", "Native segwit P2WPKH address formats"] },
        { q: "What is proof of burn in the context of cryptocurrency?", a: "Demonstrating coins were sent to an unspendable address", wrong: ["Mining blocks without ever receiving any block rewards", "Permanently deleting the private keys associated with a wallet", "Sending coins to a wallet address belonging to a person who has died"] }
    ],
    "ctv-covenants": [
        { q: "What does BIP-119 (CheckTemplateVerify) allow a Bitcoin output to do?", a: "Commit to a specific future transaction template for spending", wrong: ["Execute arbitrary smart contract code when it is spent", "Lock funds until a specific block height has been reached", "Require multiple signatures from different keys to spend"] },
        { q: "What is a \"covenant\" in the context of Bitcoin?", a: "A restriction on how a UTXO can be spent in the future", wrong: ["A multisig arrangement between federation member nodes", "A legal agreement between Lightning channel counterparties", "A time-locked contract that expires after a set period"] },
        { q: "What Bitcoin use case does CTV enable through \"congestion control\"?", a: "Batching many payments into one transaction claimable later", wrong: ["Auto-adjusting fees based on current mempool congestion", "Throttling transactions a wallet can send within a block", "Limiting block size during periods of high network load"] },
        { q: "What is OP_VAULT designed to provide using covenants?", a: "Time-delayed withdrawals with an emergency clawback option", wrong: ["A decentralized exchange built for trustless atomic swaps", "Cold storage that auto-moves funds to hardware wallets", "Multi-party escrow designed for marketplace transactions"] },
        { q: "Why are covenants considered controversial by some Bitcoiners?", a: "They could enable coin censorship or spending blacklists", wrong: ["They require a hard fork that would split the network", "They make all transactions public and remove user privacy", "They increase block size beyond what nodes can handle"] }
    ],
    "cycles": [
        { q: "What drives Bitcoin's historically observed ~4-year market cycle?", a: "The halving, which cuts new supply in half every ~4 years", wrong: ["The theory that each mining difficulty cycle gets shorter as ASIC hardware improves each year", "A proposal from core developers to extend the halving interval from four years to eight years", "The idea that Bitcoin transaction confirmation times increase significantly with each passing year"] },
        { q: "How does the Gartner Hype Cycle apply to each Bitcoin halving era?", a: "Each cycle shows trigger, peak hype, disillusionment, then recovery to a plateau", wrong: ["Bitcoin skips disillusionment because the price only goes up long-term", "The Gartner Hype Cycle only applies to new tech products, not currencies", "Each Bitcoin cycle follows the exact same price pattern as the last one"] },
        { q: "What is the \"lengthening cycles\" debate in Bitcoin?", a: "The theory that each bull run takes longer to peak with smaller percentage gains", wrong: ["The theory that mining cycles get shorter as new hardware generations get faster", "A proposal to extend the block halving period from four years to eight years", "The idea that Bitcoin transaction confirmation times increase noticeably every year"] },
        { q: "Which on-chain metrics are commonly used to analyze Bitcoin market cycles?", a: "MVRV, NUPL, and the Pi Cycle Top indicator", wrong: ["GDP growth, unemployment, and consumer price index", "Twitter followers, Google Trends, and Reddit subs", "Block size, node count, and developer commit stats"] },
        { q: "What is the \"diminishing returns\" theory in Bitcoin cycles?", a: "Each cycle's percentage gain shrinks, though absolute highs keep rising", wrong: ["Returns are accelerating each cycle with larger percentage gains", "Bitcoin will eventually produce negative returns in every cycle", "It refers to decreasing energy efficiency of mining each cycle"] }
    ],
    "derivation_path": [
        { q: "What does a BIP-32 HD (Hierarchical Deterministic) wallet allow you to do?", a: "Generate unlimited key pairs from a single master seed", wrong: ["Store multiple cryptocurrencies in one single private key", "Recover funds without a seed phrase using only email", "Connect directly to the network without running a node"] },
        { q: "In the derivation path m/84'/0'/0'/0/0, what does the \"84\" represent?", a: "BIP-84, the Native SegWit (bech32) address standard", wrong: ["The year 1984 when public key crypto was standardized", "The 84th account stored inside this particular wallet", "The total number of addresses that can be derived"] },
        { q: "Which BIP defines the derivation path standard for Taproot (bc1p) addresses?", a: "BIP-86", wrong: ["BIP-84", "BIP-49", "BIP-44"] },
        { q: "Why is sharing an xpub (extended public key) a privacy concern?", a: "It lets anyone see all addresses and balances from that account", wrong: ["It allows someone to spend your Bitcoin without the private key", "It broadcasts your seed phrase to every node on the network", "It reveals your real-world name and identity on the blockchain"] },
        { q: "What is the \"gap limit\" in HD wallet address discovery?", a: "How many consecutive unused addresses are checked before stopping", wrong: ["The maximum number of addresses a wallet can generate total", "The required time delay between each new address generation in a wallet", "The minimum allowed gap between two UTXOs when building a transaction"] }
    ],
    "dlcs": [
        { q: "In a Discreet Log Contract (DLC), what role does an oracle play?", a: "It signs a real-world outcome that determines how the contract pays out", wrong: ["It holds the funds in escrow until both parties agree on the result", "It executes smart contract code on a sidechain to settle the bet", "It mines the specific transaction that settles the contract on-chain"] },
        { q: "What cryptographic technique makes DLCs \"discreet\" - invisible to the oracle?", a: "Adaptor signatures that use the oracle's attestation privately", wrong: ["Zero-knowledge proofs that hide the contract from participants", "Ring signatures that mix the contract with unrelated transactions", "Homomorphic encryption that processes data without decrypting it"] },
        { q: "What is a common real-world use case for Discreet Log Contracts?", a: "Financial derivatives and betting settled by price or event data", wrong: ["Decentralized file storage using the Bitcoin network as a backend", "Privacy-preserving identity verification on the Bitcoin blockchain", "Automated market making for Lightning Network liquidity pools"] },
        { q: "Why is the oracle in a DLC considered more trustworthy than traditional smart contract oracles?", a: "The oracle doesn't know the contract exists or what depends on it", wrong: ["The oracle stakes Bitcoin collateral that is slashed if it lies", "Multiple oracles must all agree before any payout can occur", "The oracle runs inside a trusted execution environment on-chain"] },
        { q: "DLC.Link enables Discreet Log Contracts to be used primarily for what purpose?", a: "Bridging Bitcoin as collateral into DeFi without giving up custody", wrong: ["Mining pool payout distribution based on individual hash rate", "Decentralized name registration powered by the Bitcoin base layer", "Cross-chain atomic swaps between Bitcoin and Ethereum directly"] }
    ],
    "dollar-bitcoin_milkshake_theory": [
        { q: "Who originated the \"Dollar Milkshake Theory\"?", a: "Brent Johnson of Santiago Capital", wrong: ["Luke Gromen of Forest for the Trees", "Lyn Alden of Lyn Alden Investment Strategy", "Michael Saylor of MicroStrategy"] },
        { q: "What is the core thesis of the Dollar Milkshake Theory?", a: "The dollar strengthens by sucking up global liquidity while other fiat currencies weaken", wrong: ["Every major fiat currency collapses simultaneously while Bitcoin absorbs the resulting capital", "The dollar steadily weakens as other currencies collectively gain strength against it globally", "Major central banks coordinate in secret to jointly create and adopt a single global currency"] },
        { q: "What is the \"dollar strength paradox\" in the Milkshake Theory?", a: "The dollar gets stronger vs other currencies while losing purchasing power vs hard assets", wrong: ["A strong dollar always reliably causes the Bitcoin price to fall proportionally in tandem", "Dollar strength is a reliable indicator that the US economy is genuinely healthy and growing", "Nobody genuinely wants to hold dollars but every country still needs them to service debts"] },
        { q: "How does Bitcoin fit into the Dollar Milkshake Theory's endgame?", a: "After the dollar absorbs global liquidity, Bitcoin becomes the ultimate fiat exit", wrong: ["Bitcoin is irrelevant to the Milkshake Theory because it isn't classified as a fiat currency", "Bitcoin collapses alongside weaker currencies as the dollar absorbs all global liquidity first", "The theory explicitly predicts that Bitcoin gets banned and eventually replaced by CBDCs"] },
        { q: "Why does global dollar demand play a central role in the Milkshake Theory?", a: "Trillions in dollar-denominated debt forces nations to buy dollars, strengthening it", wrong: ["Global dollar demand is declining rapidly as nations actively de-dollarize", "Dollar demand is only relevant to US domestic economic transactions and bilateral trade", "The theory argues that global dollar demand is irrelevant and only total money supply matters"] }
    ],
    "el-salvador": [
        { q: "What was the Chivo wallet in El Salvador's Bitcoin adoption?", a: "A government-issued Lightning wallet that gave citizens $30 in Bitcoin", wrong: ["A private hardware wallet manufactured locally in El Salvador", "An exchange platform where Salvadorans could trade altcoins", "A banking app that only supported US dollar-based transactions"] },
        { q: "What is \"Bitcoin Beach\" and why is it significant to El Salvador's Bitcoin story?", a: "El Zonte - a village that built a grassroots Bitcoin economy before the national law", wrong: ["A luxury resort in San Salvador that exclusively accepts Bitcoin payments", "A government-built tourist attraction designed to promote Bitcoin adoption", "A cryptocurrency exchange headquartered on the Salvadoran coastal region"] },
        { q: "What was President Bukele's core strategy behind making Bitcoin legal tender?", a: "Financial inclusion for the unbanked, foreign investment, and cheaper remittances", wrong: ["Replacing the US dollar entirely with Bitcoin as El Salvador's sole legal currency", "Mining Bitcoin at industrial scale using El Salvador's largely untapped natural oil reserves", "Creating a government-controlled national cryptocurrency designed to replace Bitcoin"] },
        { q: "How did the World Bank and IMF respond to El Salvador's Bitcoin law?", a: "They pushed back - the World Bank refused help and the IMF warned of risks", wrong: ["Both organizations fully endorsed and helped fund the entire initiative", "The IMF designed and helped build the Chivo wallet infrastructure", "The World Bank provided a $500 million loan specifically for adoption"] },
        { q: "How did Lightning Network adoption benefit El Salvador's economy?", a: "It enabled fast, near-free payments and remittances, cutting out costly services", wrong: ["Lightning was not used - only on-chain Bitcoin transactions were supported", "Lightning made transactions faster but significantly more expensive overall", "El Salvador banned Lightning in favor of on-chain-only Bitcoin payments"] }
    ],
    "extension-blocks": [
        { q: "What are extension blocks in Bitcoin?", a: "Additional block space running alongside the main chain without changing it", wrong: ["Larger blocks created by increasing the block size limit via a hard fork", "Blocks reserved exclusively for Lightning Network channel operations", "Compressed blocks that store only transaction hashes to save space"] },
        { q: "How do extension blocks differ from a traditional soft fork upgrade?", a: "Old nodes see extension transactions as \"anyone-can-spend\" outputs", wrong: ["Extension blocks require all nodes to upgrade or be forked off the network", "Extension blocks reduce the block size to improve network decentralization", "Extension blocks are identical to soft forks but use a different label"] },
        { q: "What is the \"space chain\" concept related to extension blocks?", a: "A separate chain whose block space is auctioned via the main chain", wrong: ["A satellite network that broadcasts Bitcoin blocks from orbit", "A virtual reality environment where Bitcoin nodes operate in 3D", "A specialized blockchain optimized for storing files over 4MB"] },
        { q: "What is a key trade-off of extension blocks?", a: "Non-upgraded nodes cannot fully validate extension block transactions", wrong: ["All miners must upgrade their hardware simultaneously to participate", "The main block size permanently increases for all future blocks", "Lightning Network channels become incompatible with the base layer"] },
        { q: "Why have extension block proposals historically been controversial in Bitcoin development?", a: "They risk creating a second-class zone that weakens full node security", wrong: ["They were proposed by altcoin developers trying to undermine Bitcoin", "They would eliminate the need for the Lightning Network entirely", "They require replacing SHA-256 with a completely different hash algorithm"] }
    ],
    "feedback_loops": [
        { q: "What is the price-hashrate-security feedback loop in Bitcoin?", a: "Higher price attracts miners, boosting hashrate, security, and confidence in a rising cycle", wrong: ["Higher price causes miners to shut down equipment due to overheating, reducing hashrate and network stability", "Hashrate and Bitcoin price are completely independent variables with no meaningful statistical connection", "Security drops sharply as price rises because more sophisticated hackers are financially motivated to attack"] },
        { q: "How does the adoption-liquidity-utility feedback loop work in Bitcoin?", a: "More users deepen liquidity, making Bitcoin more useful, which attracts even more users", wrong: ["The Lindy Effect means Bitcoin becomes progressively less reliable as its codebase ages and technical debt grows", "Older technology always gets replaced by newer innovations eventually, so the Lindy Effect actually hurts Bitcoin", "The Lindy Effect only applies to physical objects and printed books, not digital protocols or software systems"] },
        { q: "How does the Lindy Effect create a reinforcing feedback loop for Bitcoin?", a: "Each day Bitcoin survives boosts confidence in its longevity, drawing more adoption", wrong: ["Reflexivity means Bitcoin's price always reflects its true fundamental value without emotional distortion", "It describes the tendency of Bitcoin to always revert to a fixed long-run equilibrium price over time", "Reflexivity is a mining optimization technique that increases block production speed during difficulty periods"] },
        { q: "What is reflexivity in the context of Bitcoin market cycles?", a: "Perceptions influence fundamentals, which reinforce perceptions, creating self-amplifying cycles", wrong: ["Bitcoin has only one feedback loop but that single loop happens to be extremely strong during bull markets", "Bitcoin's feedback loops are actually weaker than traditional markets because they lack institutional backstops", "Feedback loops only function during bull markets and reverse direction completely and instantly during bear phases"] },
        { q: "Why are Bitcoin's feedback loops considered among the most powerful in economics?", a: "Multiple self-reinforcing loops in price, hashrate, adoption, and security amplify together", wrong: ["Bitcoin has only one feedback loop but it happens to be extremely strong as defined by Bitcoin consensus rules enforced by all full nodes", "Bitcoin's feedback loops are actually weak compared to traditional market loops as defined by Bitcoin consensus rules enforced by all full nodes", "Feedback loops only work in bull markets and reverse completely in bear runs as defined by Bitcoin consensus rules enforced by all full nodes"] }
    ],
    "first_principles": [
        { q: "What does \"first principles thinking\" mean when applied to Bitcoin?", a: "Breaking money down to fundamental properties and reasoning up from there", wrong: ["Bitcoin was simply the first cryptocurrency launched, so it wins by historical default over all later altcoins", "Altcoins are effectively illegal in most jurisdictions, so Bitcoin is the only legally compliant option available", "Bitcoin has the best-funded marketing team and strongest global brand recognition beating all cryptocurrency rivals"] },
        { q: "Which philosopher is most associated with the first principles method of reasoning from fundamental truths?", a: "Aristotle", wrong: ["Plato, as specified in the original Bitcoin whitepaper released in 2008", "Socrates", "Descartes"] },
        { q: "When reasoning from first principles about what makes good money, which set of properties matters most?", a: "Scarcity, portability, durability, divisibility, and fungibility", wrong: ["Government backing, legal enforcement, and central bank control", "Physical weight, aesthetic beauty, and historical tradition", "Ease of printing, widespread banking, and inflation targeting"] },
        { q: "First principles thinking reveals what fundamental connection between energy and money?", a: "Money should represent stored energy - unforgeable costliness gives it value", wrong: ["Money has no relationship to energy since it is purely a social construct", "Only physical commodities can serve as money because they contain atoms", "Energy is irrelevant to money if a government declares it legal tender"] },
        { q: "Why does first principles reasoning tend to lead people toward Bitcoin rather than altcoins?", a: "Bitcoin best satisfies the fundamental properties of sound money from first principles", wrong: ["Bitcoin was the first cryptocurrency so it wins by default over altcoins as defined by Bitcoin consensus rules enforced by all full nodes", "Altcoins are illegal in most countries so Bitcoin is the only legal option as defined by Bitcoin consensus rules enforced by all full nodes", "Bitcoin has the best marketing team and strongest brand awareness overall as defined by Bitcoin consensus rules enforced by all full nodes"] }
    ],
    "foss": [
        { q: "What type of software license does Bitcoin Core use?", a: "MIT License", wrong: ["GPL v3 as defined by Bitcoin consensus rules enforced by all full nodes", "Apache License 2.0", "Creative Commons"] },
        { q: "Why is it important that Bitcoin Core is free and open-source software (FOSS)?", a: "Anyone can audit the code to verify no backdoors or hidden rules exist", wrong: ["It makes Bitcoin free to use with zero transaction fees for users", "It allows developers to create unlimited Bitcoin through the code", "It means no one actually needs to run the Bitcoin software as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "What is the Guix build system used for in Bitcoin Core?", a: "Producing reproducible, auditable binaries so anyone can verify the software", wrong: ["Automatically deploying Bitcoin Core updates to all nodes across the network", "Managing the peer-review and merge workflow for Bitcoin Core pull requests", "Cross-compiling Bitcoin Core binaries optimised for different CPU architectures"] },
        { q: "\"Linus's Law\" states that \"given enough eyeballs, all bugs are shallow.\" How does this apply to Bitcoin?", a: "Thousands of developers review Bitcoin's code, so vulnerabilities get found and fixed faster", wrong: ["Linux servers are the only machines capable of running Bitcoin full nodes properly", "Linus Torvalds personally reviews and audits every Bitcoin Core release himself as defined by Bitcoin consensus rules enforced by all full nodes", "Bitcoin can only run on open-source operating systems like Linux and FreeBSD as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "Why does open-source matter specifically for money/monetary software like Bitcoin?", a: "Users must verify the rules of their money - no hidden inflation or secret changes", wrong: ["Open-source software is always faster and more efficient than proprietary code", "It allows banks to freely copy Bitcoin and make their own branded version", "It makes Bitcoin significantly easier for governments to regulate and control"] }
    ],
    "hardware": [
        { q: "What makes the Coldcard hardware wallet stand out among Bitcoin hardware wallets?", a: "It's air-gapped, Bitcoin-only, and supports NFC signing", wrong: ["It supports thousands of altcoins and NFTs as defined by Bitcoin consensus rules enforced by all full nodes", "It connects directly to the internet for speed as defined by Bitcoin consensus rules enforced by all full nodes", "It's the cheapest hardware wallet available as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "What is a PSBT (Partially Signed Bitcoin Transaction) and why is it important for hardware wallets?", a: "A format for building transactions on one device and signing on another", wrong: ["A tamper-resistant chip that secures the Wi-Fi connection between the hardware wallet and the signing app", "A specialized processing component that accelerates cryptographic signing and transaction speed on the device", "An embedded GPS module that tracks the physical location of the hardware wallet for remote recovery purposes"] },
        { q: "What is SeedSigner?", a: "A DIY, open-source, air-gapped wallet built on a Raspberry Pi", wrong: ["The wallet is hermetically sealed inside a vacuum chamber to prevent physical tampering by sophisticated attackers", "The wallet uses low-earth-orbit satellite uplinks instead of Wi-Fi to broadcast transactions anonymously", "The hardware wallet can only be safely operated outdoors away from electronics that could intercept its signals"] },
        { q: "What is a \"secure element\" chip in hardware wallets?", a: "A tamper-resistant chip that stores keys and blocks extraction", wrong: ["A chip that connects the wallet to Wi-Fi securely as defined by Bitcoin consensus rules enforced by all full nodes", "A component that speeds up transaction processing as defined by Bitcoin consensus rules enforced by all full nodes", "A GPS module that tracks the wallet for recovery as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "What does \"air-gapped\" mean when describing a hardware wallet like Coldcard or Foundation Passport?", a: "It never connects to internet - data moves via SD card, QR, or NFC", wrong: ["The wallet is sealed in a vacuum to prevent tampering as defined by Bitcoin consensus rules enforced by all full nodes", "The wallet uses satellite connections instead of Wi-Fi as defined by Bitcoin consensus rules enforced by all full nodes", "The wallet can only be used outdoors for security as defined by Bitcoin consensus rules enforced by all full nodes"] }
    ],
    "improved_incentive_structure": [
        { q: "How does Bitcoin \"fix broken incentives\" in the current monetary system?", a: "By removing money printing, it forces honest accounting and ends inflation of debt", wrong: ["It gives governments better tools to manage the economy, as specified in the original Bitcoin whitepaper released in 2008", "It doesn't change incentives - just moves them to digital, as specified in the original Bitcoin whitepaper released in 2008", "It fixes incentives by making all transactions government-traceable as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "What does \"low time preference society\" mean in the context of a Bitcoin standard?", a: "People plan long-term and save more because their money gains value over time", wrong: ["Proof of work distributes equal amounts of Bitcoin automatically to every registered person on Earth", "Early miners received special privileged allocation rates that new miners joining the network cannot access", "Proof of work distributes Bitcoin proportionally based on geographic location and regional energy costs"] },
        { q: "Why is proof of work considered a \"fair distribution\" mechanism for new Bitcoin?", a: "Anyone can mine by spending real energy - no pre-mines or insider allocations", wrong: ["Sound money discourages saving because appreciating money becomes too valuable to spend on any investments", "Individual investment behavior stays statistically identical regardless of whether the monetary system inflates", "Sound money causes universal hoarding behavior that starves businesses of capital and collapses the economy"] },
        { q: "How does sound money (like Bitcoin) change savings and investment behavior?", a: "People save more and only invest in projects with real returns above deflation", wrong: ["Fiat money incentivizes excessive saving over spending because the currency retains value across decades", "Fiat money contains no broken incentives and functions exactly as economists designed it to work long-term", "Bitcoin creates identical borrow-over-save incentives since interest rates still exist in a Bitcoin economy"] },
        { q: "What broken incentive does fiat money create that Bitcoin eliminates?", a: "Fiat rewards borrowing over saving because inflation erodes purchasing power", wrong: ["Fiat incentivizes too much saving, which Bitcoin fixes as defined by Bitcoin consensus rules enforced by all full nodes", "Fiat money has no broken incentives - it works as designed as defined by Bitcoin consensus rules enforced by all full nodes", "Bitcoin creates the same borrow incentive since rates exist as defined by Bitcoin consensus rules enforced by all full nodes"] }
    ],
    "laws_of_thermodynamics": [
        { q: "How does the First Law of Thermodynamics (conservation of energy) relate to Bitcoin mining?", a: "Miners convert electricity into computational work securing the ledger", wrong: ["Bitcoin mining creates energy from nothing to power the network", "The First Law means Bitcoin can only exist in cold climates as defined by Bitcoin consensus rules enforced by all full nodes", "Energy is destroyed during mining, explaining the high usage as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "What does \"unforgeable costliness\" mean in Bitcoin's thermodynamic context?", a: "Real energy must be spent to produce Bitcoin and this cost can't be faked", wrong: ["Bitcoin fundamentally violates the Second Law by creating economic value and order from computationally nothing", "Entropy has no meaningful connection to digital ledger systems like Bitcoin running on transistor-based hardware", "The Second Law implies Bitcoin's network will inevitably reach maximum entropy and permanently stop functioning"] },
        { q: "How does the Second Law of Thermodynamics (entropy always increases) connect to Bitcoin?", a: "Proof of work creates order in the ledger by increasing entropy via energy use", wrong: ["Maxwell's Demon is the historical codename for the first Bitcoin mining software written by Satoshi Nakamoto", "It describes a theoretical advanced AI attack that could take over mining and reorganize the blockchain at will", "It refers to the apparent randomness of Bitcoin price movements being analogous to Brownian particle motion"] },
        { q: "Why do some physicists describe proof of work as \"thermodynamic security\"?", a: "Reversing the chain would require re-spending all the energy that built it", wrong: ["Because Bitcoin mining rigs get very hot during operation as defined by Bitcoin consensus rules enforced by all full nodes", "Because proof of work requires cooling systems to function as defined by Bitcoin consensus rules enforced by all full nodes", "Because thermodynamic equations are used to set transaction fees as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "What is the \"Maxwell's Demon\" analogy sometimes applied to Bitcoin?", a: "You can't sort molecules or secure a ledger without real energy expenditure", wrong: ["Maxwell's Demon is the name of the first Bitcoin mining software as defined by Bitcoin consensus rules enforced by all full nodes", "It describes a theoretical AI attack that takes over the network as defined by Bitcoin consensus rules enforced by all full nodes", "It refers to Bitcoin price randomness being like particle motion as defined by Bitcoin consensus rules enforced by all full nodes"] }
    ],
    "layer-3-sidechains": [
        { q: "How does the Liquid Network secure its two-way peg to Bitcoin?", a: "Through a federation of functionaries managing the peg via multisig", wrong: ["Through merge-mining where Bitcoin miners also validate Liquid", "Through a trustless smart contract deployed on Bitcoin's base layer", "Through proof-of-stake consensus among Liquid token holder nodes"] },
        { q: "How does RSK (Rootstock) secure its sidechain?", a: "Through merge-mining where Bitcoin miners also validate RSK blocks", wrong: ["Through a federation of trusted companies that collectively sign", "Through proof-of-stake where RSK token holders vote on blocks", "Through BitVM fraud proofs posted to Bitcoin's main base layer"] },
        { q: "What consensus mechanism does Stacks use to connect to Bitcoin?", a: "Proof of Transfer (PoX), where miners spend BTC to produce blocks", wrong: ["Proof of Work using the same SHA-256 algorithm as Bitcoin mining", "Delegated Proof of Stake with community-elected block producers", "Proof of Authority using a fixed and permissioned validator set"] },
        { q: "What are drivechains (BIP-300) designed to enable?", a: "Permissionless sidechains with miner-voted withdrawals to mainchain", wrong: ["Faster block times on Bitcoin by reducing difficulty adjustment", "A new Lightning channel type that skips on-chain funding steps", "Decentralized mining pools that auto-distribute block rewards"] },
        { q: "What is the primary security concern with federated sidechains like Liquid?", a: "Users must trust federation members not to collude and steal funds", wrong: ["The sidechain can reverse Bitcoin base layer transactions at will", "Federated sidechains consume more energy than Bitcoin's proof-of-work", "The federation has the power to change Bitcoin's 21 million cap"] }
    ],
    "ordinals_inscriptions": [
        { q: "Who proposed the Ordinal Theory for Bitcoin?", a: "Casey Rodarmor", wrong: ["Adam Back as defined by Bitcoin consensus rules enforced by all full nodes", "Pieter Wuille", "Satoshi Nakamoto"] },
        { q: "How are individual satoshis numbered in Ordinal Theory?", a: "Sequentially based on mining order", wrong: ["Randomly assigned by the network", "By their transaction ID hash as defined by Bitcoin consensus rules enforced by all full nodes", "By the receiving wallet address"] },
        { q: "What do inscriptions attach to specific satoshis?", a: "Arbitrary data like images or text", wrong: ["Private keys for spending them", "Their full transaction history", "Multisig spending conditions as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "What token standard emerged from Ordinals functionality?", a: "BRC-20", wrong: ["ERC-20", "RGB", "Omni Layer"] },
        { q: "What was a major criticism of Ordinals regarding block space?", a: "They use limited block space for non-monetary data", wrong: ["They significantly reduce mining reward amounts", "They break Bitcoin's core consensus rules as defined by Bitcoin consensus rules enforced by all full nodes", "They allow theft of other users' funds as defined by Bitcoin consensus rules enforced by all full nodes"] }
    ],
    "rollups": [
        { q: "What is a validity rollup on Bitcoin?", a: "A system that bundles off-chain transactions and posts a ZK proof to Bitcoin", wrong: ["A sidechain that copies Bitcoin's consensus rules exactly as written", "A Lightning Network channel that batches together multiple payments", "A mining pool feature that combines block templates from miners as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "How do sovereign rollups differ from validity rollups?", a: "Users verify rollup state themselves rather than relying on the base layer", wrong: ["Sovereign rollups use a central authority; validity rollups are decentralized", "Sovereign rollups use proof-of-stake; validity rollups use proof-of-work", "Sovereign rollups are limited to only seven transactions per second"] },
        { q: "How could BitVM enable rollups on Bitcoin?", a: "By allowing fraud proofs to verify rollup state without needing new opcodes", wrong: ["By adding a Turing-complete VM directly into Bitcoin's consensus layer", "By creating a dedicated sidechain specifically for validating rollup data", "By replacing Bitcoin's existing Script language with Solidity contracts"] },
        { q: "How do Bitcoin rollups differ from sidechains?", a: "Rollups post proofs or data to Bitcoin, inheriting its security guarantees", wrong: ["Rollups use a separate token for gas while sidechains use native BTC", "Rollups need a federation of signers while sidechains are fully trustless", "Rollups are faster than sidechains but limited to simple transfers only"] },
        { q: "What is the main trust assumption difference between a validity rollup and an optimistic rollup?", a: "Validity rollups prove correctness upfront; optimistic rollups assume it until challenged", wrong: ["Validity rollups trust a federation of signers; optimistic rollups trust miners", "Validity rollups need a soft fork to work; optimistic rollups work on Bitcoin today", "Validity rollups are run centrally; optimistic rollups are always fully decentralized"] }
    ],
    "spv": [
        { q: "What does SPV (Simplified Payment Verification) allow a lightweight client to do?", a: "Verify transaction inclusion using block headers and Merkle proofs", wrong: ["Mine full Bitcoin blocks competitively using only minimal and low-powered mobile computing resources", "Broadcast and send transactions to the mempool without paying any required network fees to miners", "Run a complete archival full node on a budget mobile phone with extremely limited storage capacity"] },
        { q: "What privacy problem did the original SPV bloom filters (BIP-37) have?", a: "They leaked which addresses the wallet cared about to the server", wrong: ["SPV clients are receive-only and cannot initiate or sign outgoing Bitcoin transactions to any address", "SPV clients are required to pay significantly higher transaction fees than users running full verification nodes", "SPV clients are restricted to connecting to only a single trusted peer node at any given point in time"] },
        { q: "What do BIP-157 and BIP-158 (compact block filters) improve over bloom filters?", a: "Clients download pre-computed filters without revealing their addresses", wrong: ["They compress the entire blockchain into a single downloadable file", "They allow nodes to verify transactions without any network access", "They replace Merkle proofs with zero-knowledge proofs for speed"] },
        { q: "What is Neutrino in the context of Bitcoin light clients?", a: "A light client protocol using BIP-157/158 compact block filters", wrong: ["A privacy coin built as a Bitcoin sidechain project as defined by Bitcoin consensus rules enforced by all full nodes", "A mining algorithm designed for mobile phone hardware as defined by Bitcoin consensus rules enforced by all full nodes", "A wallet that runs a full node in the cloud for you as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "What is the main security tradeoff of SPV compared to running a full node?", a: "SPV clients trust miners produce valid blocks without full verification", wrong: ["SPV clients cannot receive Bitcoin, they can only send it as defined by Bitcoin consensus rules enforced by all full nodes", "SPV clients must pay higher transaction fees than full nodes as defined by Bitcoin consensus rules enforced by all full nodes", "SPV clients can only connect to one peer node at a time as defined by Bitcoin consensus rules enforced by all full nodes"] }
    ],
    "tail_emission": [
        { q: "What is \"tail emission\" in the context of cryptocurrency monetary policy?", a: "A small perpetual block reward ensuring miners always get some subsidy", wrong: ["The final Bitcoin expected to be mined around the year 2140 as defined by Bitcoin consensus rules enforced by all full nodes", "The process of burning unsold Bitcoin to reduce total supply as defined by Bitcoin consensus rules enforced by all full nodes", "A mechanism that increases block rewards over time for miners as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "Which major cryptocurrency implements tail emission as part of its monetary policy?", a: "Monero, with a permanent minimum reward of 0.6 XMR per block", wrong: ["Bitcoin, which added tail emission in the Taproot upgrade", "Ethereum, which introduced it during the merge to proof of stake", "Litecoin, which activated it after its third halving event"] },
        { q: "What concern about Bitcoin's long-term security does the tail emission debate address?", a: "Whether fees alone can incentivize miners after block rewards end", wrong: ["Whether Bitcoin's encryption can withstand quantum computers", "Whether the 21 million supply cap should be raised over time", "Whether nodes will have enough storage for the growing chain"] },
        { q: "What is the main argument AGAINST adding tail emission to Bitcoin?", a: "It would break the 21 million cap and destroy sound money credibility", wrong: ["Tail emission would make mining too profitable and attract too many", "It would speed up transaction confirmation times excessively as defined by Bitcoin consensus rules enforced by all full nodes", "Tail emission is technically impossible to implement on Bitcoin"] },
        { q: "What is the \"fee market sufficiency\" argument against the need for tail emission?", a: "Growing adoption and scarce block space will naturally raise fee revenue", wrong: ["Miners will voluntarily work for free because they believe in Bitcoin", "The government will subsidize mining to keep the network running", "New Bitcoin will be discovered on the network like finding new gold"] }
    ],
    "vbyte": [
        { q: "What is a virtual byte (vbyte) in Bitcoin?", a: "A unit where 1 vbyte equals 4 weight units, used for fee calculation", wrong: ["A compressed byte format that reduces transaction size by 75%", "The amount of data a Bitcoin node can process per second as defined by Bitcoin consensus rules enforced by all full nodes", "A unit measuring the electricity cost of validating transactions"] },
        { q: "How did SegWit change the way Bitcoin transaction fees are calculated?", a: "Fees use weight units or vbytes, giving witness data a discount", wrong: ["SegWit made all transactions free for the first year after launch", "SegWit replaced fee priority with a first-come-first-served queue", "SegWit doubled the base fee rate for all transaction types"] },
        { q: "What is the witness discount ratio in SegWit?", a: "Witness data costs 1 weight unit per byte; non-witness costs 4", wrong: ["Witness data is free; non-witness data costs 2 weight units", "Both witness and non-witness data cost 2 weight units per byte", "Witness data costs 3 weight units; non-witness data costs 4"] },
        { q: "Why is understanding vbytes important for optimizing Bitcoin transaction costs?", a: "Using SegWit addresses moves data into the discounted witness section", wrong: ["Vbytes determine how many confirmations a transaction needs as defined by Bitcoin consensus rules enforced by all full nodes", "Using fewer vbytes increases the mining reward for the block as defined by Bitcoin consensus rules enforced by all full nodes", "Transactions with more vbytes get higher priority in mempool as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "A typical single-input, single-output SegWit transaction is approximately how many vbytes?", a: "About 110 vbytes", wrong: ["About 500 vbytes", "About 10 vbytes", "About 1,000 vbytes"] }
    ],
    "austrian_economics": [
        { q: "What did Ludwig von Mises formalize in \"Human Action\" (1949)?", a: "Praxeology — the study of purposeful human action under scarcity, establishing economics as a deductive science of individual choice", wrong: ["A measured preference for investments offering rapid compounding returns rather than gradual wealth accumulation as defined by Bitcoin consensus rules enforced by all full nodes", "An economic condition where rising inflation expectations push consumers to purchase goods before prices climb as defined by Bitcoin consensus rules enforced by all full nodes", "A deliberate investment strategy of holding only liquid assets to preserve maximum optionality and flexibility as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "What was Hayek's core argument in \"The Use of Knowledge in Society\" (1945)?", a: "Prices are decentralized information signals encoding dispersed local knowledge that no central planner could ever collect or replicate", wrong: ["Wages are collective bargaining outcomes that government intervention can optimize to achieve full employment across all economic sectors", "Capital is best allocated by expert technocrats who can model aggregate market behavior using national statistical databases", "Markets fail to coordinate information efficiently whenever monopolies or asymmetric information distort the natural price discovery process"] },
        { q: "What did Hayek propose in \"Denationalization of Money\" (1976)?", a: "Competitive private currencies issued and managed entirely outside government control, a concept Bitcoin made real 35 years later", wrong: ["A global reserve currency jointly managed by central banks under an international treaty with binding monetary supply rules", "A commodity basket standard linking currency values to weighted indices of gold, silver, and key agricultural commodity prices", "Full public ownership of the money supply administered by democratically elected monetary boards with transparent policy rules"] },
        { q: "According to Austrian Business Cycle Theory, what causes boom-bust cycles?", a: "Artificially low central bank interest rates that encourage malinvestment and unsustainable credit expansion, inevitably followed by a painful bust", wrong: ["Excessive consumer spending fueled by rising wages that outpaces underlying productivity growth in the manufacturing and services sectors", "Trade imbalances caused by currency manipulation that distort the natural flow of global capital across national borders and industries", "Monopolistic corporate pricing that suppresses marketplace competition and prevents efficient capital reallocation across the broader economy"] },
        { q: "How does sound money affect time preference across society according to Austrian theory?", a: "Sound money lowers time preference, encouraging saving and long-term investment over immediate consumption and short-term debt-fueled spending", wrong: ["Sound money raises time preference by making future purchasing power uncertain, discouraging multi-year planning among investors and consumers", "Sound money has no measurable effect on time preference, which is entirely determined by individual psychology and genetic disposition", "Sound money temporarily lowers time preference but eventually promotes excessive hoarding that collapses demand and deflates the broader economy"] },
        { q: "What is the Austrian subjective theory of value, in contrast to Marxist labor theory?", a: "Value is determined solely by individual actors based on personal preferences and scarcity, not by labor hours embedded in production", wrong: ["Value is determined by the collective social utility of a good as measured through democratic consensus and community price-setting processes", "Value is established at market equilibrium when aggregate supply matches aggregate demand at a mutually acceptable price level", "Value is a function of raw material scarcity measured objectively by the replacement cost of producing the good under current market conditions"] },
        { q: "What is the Cantillon Effect in monetary economics?", a: "Newly created money benefits those who receive it first — banks and government contractors — before rising prices erode everyone else's purchasing power", wrong: ["Currency devaluation benefits exporters first by making their goods cheaper abroad, before domestic wage growth fully catches up to new price levels", "Tax cuts benefit large corporations first because they can immediately reinvest capital gains before smaller firms or wage earners see any benefit", "Interest rate reductions benefit institutional borrowers first since they can refinance cheaply before retail lending rates are fully adjusted downward"] },
        { q: "How did Hayek and Keynes fundamentally disagree about recessions?", a: "Keynes argued government spending cures recessions; Hayek argued forced stimulus generates malinvestment that makes the inevitable correction far worse", wrong: ["Keynes supported a gold-backed currency to anchor inflation expectations; Hayek argued fiat money was essential for flexible countercyclical policy", "Keynes blamed monopolistic corporations for downturns; Hayek argued recessions stemmed purely from insufficient consumer spending and weak aggregate demand", "Keynes viewed free markets as naturally self-correcting over time; Hayek argued central bank intervention was essential to stabilize employment and output"] },
        { q: "How did Saifedean Ammous connect Austrian economics to Bitcoin in \"The Bitcoin Standard\"?", a: "He applied Mises and Hayek's sound money theory directly to Bitcoin, arguing it restores low time preference and the hard money properties lost under fiat", wrong: ["He applied Keynesian demand-side economics to argue Bitcoin's fixed supply would prevent deflationary spirals in modern post-industrial economies", "He adapted Modern Monetary Theory to show Bitcoin's decentralized issuance could replace central bank open market operations in a digital economy", "He combined behavioral economics with game theory to prove Bitcoin would inevitably displace fiat through pure network adoption incentives"] },
        { q: "What is \"high time preference\" in Austrian economic terms?", a: "A strong preference for present consumption over future saving, leading to debt-fueled spending, short-term thinking, and underinvestment in capital formation", wrong: ["A preference for investments with rapid compounding returns rather than patient accumulation of slower long-term capital appreciation strategies", "An economic condition where rising inflation expectations cause consumers to accelerate purchases before prices increase any further as defined by Bitcoin consensus rules enforced by all full nodes", "A deliberate preference for holding liquid assets to preserve maximum optionality in periods of high economic and market uncertainty as defined by Bitcoin consensus rules enforced by all full nodes"] }
    ],
    "gold_standard_history": [
        { q: "What characterized the Classical Gold Standard era from roughly 1870 to 1914?", a: "44 years of remarkable price stability, subdued long-run inflation, and a long-term investment culture that financed and enabled the Industrial Revolution", wrong: ["44 years of recurring deflationary collapses and economic stagnation caused by the rigid link between currency and a slowly growing physical gold supply", "Frequent currency crises triggered by large gold discoveries in California and South Africa that constantly disrupted global price stability and trade", "A period of rising inflation and sovereign debt caused by British imperial expansion and surging demand for commodities in colonial territories"] },
        { q: "What monetary system did the Bretton Woods agreement establish in 1944?", a: "The USD was pegged to gold at $35 per ounce and all other major currencies were pegged to the dollar, making it the world reserve currency", wrong: ["All G7 currencies were simultaneously pegged directly to gold at individually negotiated rates, with no single national currency designated as reserve", "A post-war trade liberalization treaty that created the WTO and established a system of managed floating exchange rates among Allied nations", "The British pound replaced gold as the global reserve standard at a fixed rate of £1 to $4.03, with the US and UK serving as dual anchors"] },
        { q: "What was the \"Nixon Shock\" of August 15, 1971?", a: "Nixon unilaterally suspended the dollar's gold convertibility, ending Bretton Woods entirely and launching the global era of pure unbacked fiat currency", wrong: ["Nixon imposed sweeping wage and price controls to combat inflation while simultaneously proposing a formal gold revaluation to $100 per ounce", "Nixon signed legislation allowing foreign central banks to convert dollars to gold at a newly negotiated rate of $70 per ounce going forward", "Nixon coordinated a multilateral agreement with G10 finance ministers to collectively devalue all major currencies against gold by 10 percent simultaneously"] },
        { q: "What did Executive Order 6102 of 1933 do, and what penalty did it carry?", a: "FDR's order made it illegal for Americans to own gold bullion, with penalties of up to 10 years in prison and a $10,000 fine for violations", wrong: ["FDR's order nationalized the Federal Reserve System and established direct Treasury Department control over all money supply decisions nationwide", "A 1933 executive order creating the gold exchange standard to formally replace the classical gold standard with a centrally managed currency regime", "A 1933 banking regulation requiring all gold held by private commercial banks to be audited quarterly and insured by the federal government"] },
        { q: "What was gold's \"fatal flaw\" as a monetary standard, according to \"The Fiat Standard\"?", a: "Spatial salability — gold was too heavy and risky to transport globally, driving centralization into bank vaults and enabling gradual government seizure and control", wrong: ["Temporal salability — gold's slowly growing supply made it deflationary over time, consistently discouraging consumption and causing recurring economic stagnation", "Divisibility — gold could not be split into units small enough for everyday retail transactions without significantly debasing its purity and market value", "Verifiability — gold could not be authenticated quickly enough in ordinary commerce, creating widespread fraud through counterfeit coins and debased alloys"] },
        { q: "What caused the Weimar Republic's catastrophic hyperinflation between 1921 and 1923?", a: "The German government printed money to pay WWI reparations demanded by the Allies, causing prices to double every few days at the peak of the crisis", wrong: ["A speculative bubble in German industrial equities collapsed, triggering simultaneous bank runs and uncontrolled monetary expansion by the Reichsbank", "The Allied naval blockade of German ports cut off essential imports, creating artificial commodity shortages that drove a runaway wage-price spiral", "A series of devastating agricultural droughts in 1921 and 1922 destroyed food harvests, causing scarcity-driven price spikes that spiraled into full hyperinflation"] },
        { q: "How did the gold standard enable the large-scale infrastructure of the Industrial Revolution?", a: "Sound money preserved the value of savings over decades, allowing investors to patiently fund long-term projects like railroads, power grids, and telephone networks", wrong: ["Gold-backed currency enabled colonial resource extraction that directly funded industrial projects in Britain through forced labor and administrative taxation systems", "The gold standard had minimal direct impact on industrial investment, which was primarily financed through short-term commercial bank credit and trade finance", "Industrial Revolution infrastructure was financed mainly through royal patronage and long-term government bonds rather than private savings kept in hard money"] },
        { q: "How does gold's stock-to-flow ratio compare with Bitcoin's as halvings continue?", a: "Gold's stock-to-flow is roughly 60 years; Bitcoin's surpasses gold after each halving and approaches infinity as block rewards eventually diminish to zero", wrong: ["Gold's stock-to-flow of 60 years permanently exceeds Bitcoin's because Bitcoin's supply grows faster than newly mined gold production in absolute terms", "Both gold and Bitcoin effectively share equivalent stock-to-flow ratios of around 50–60 years, making them equally scarce as long-term monetary commodities", "Gold's stock-to-flow is actually only 20 years due to advances in deep-sea and asteroid mining technology; this makes direct comparison with Bitcoin impossible"] },
        { q: "How does Bitcoin's hard supply cap compare to gold's theoretical total supply?", a: "Gold's supply is theoretically unlimited through asteroid mining and new geological discoveries; Bitcoin is mathematically capped forever at exactly 21 million coins", wrong: ["Gold's accessible supply is now effectively fixed because known economically viable deposits are nearly exhausted and new mining is no longer profitable", "Both gold and Bitcoin have effectively unlimited supplies since gold recycling and Bitcoin's layer-2 solutions eliminate any meaningful long-term scarcity constraint", "Bitcoin's supply is also theoretically unlimited because permanently lost coins reduce effective circulation, creating protocol pressure to eventually reissue them"] },
        { q: "Why did the US dollar become the global reserve currency at Bretton Woods in 1944?", a: "The US held the world's largest gold reserves in 1944, making the dollar the most credible currency to serve as the global gold-backed reserve anchor", wrong: ["The dollar was chosen because the US had the largest economy and most liquid bond markets regardless of the size of its gold reserve holdings", "The British pound was the initial reserve currency at Bretton Woods; the dollar only replaced it after the UK defaulted on its post-war Lend-Lease debts", "The IMF selected the dollar through a competitive evaluation of Allied nations' monetary policy track records and fiscal discipline over the preceding decade"] }
    ],
    "cypherpunks": [
        { q: "What did Eric Hughes declare in \"A Cypherpunk's Manifesto\" (1993)?", a: "\"Privacy is necessary for an open society in the electronic age... We must defend our own privacy if we expect to have any.\"", wrong: ["\"Encryption is a weapon of the people... The state's monopoly on surveillance must be broken by making cryptography universally available and free.\"", "\"Anonymity is the foundation of all digital freedom... Any government that surveils its citizens without consent has permanently forfeited its legitimacy.\"", "\"Code is the new law... Those who control cryptographic infrastructure ultimately control the rights and freedoms of citizens in the digital age.\""] },
        { q: "Where did Satoshi Nakamoto first publish the Bitcoin whitepaper on October 31, 2008?", a: "The Cypherpunks mailing list, the center of digital privacy and cryptographic activism since its founding in 1992 by Eric Hughes and John Gilmore", wrong: ["The Bitcoin.org website, which Satoshi registered in August 2008 specifically to host the whitepaper and distribute the initial open-source software release", "The SourceForge code repository, where Satoshi posted the whitepaper alongside the initial C++ source code for broad public review and comment", "The Cryptography mailing list hosted at metzdowd.com, a separate but closely overlapping community focused primarily on academic cryptographic research"] },
        { q: "What was Adam Back's technical contribution that directly shaped Bitcoin's design?", a: "He invented Hashcash in 1997 — a proof-of-work system directly cited in the Bitcoin whitepaper that became the foundation of Bitcoin's mining mechanism", wrong: ["He created the Merkle tree data structure in 1994 that Bitcoin uses to efficiently organize and cryptographically verify transaction data inside each block", "He developed the elliptic curve digital signature algorithm that Bitcoin uses to cryptographically authenticate ownership and authorize every transaction", "He invented the SHA-256 hashing algorithm in 1995 that Bitcoin relies on to secure its proof-of-work calculations and generate transaction identifiers"] },
        { q: "Who was Hal Finney and what was his historic role in Bitcoin's earliest days?", a: "He received the first Bitcoin transaction from Satoshi (block 170), ran the second node, created RPOW in 2004, and died of ALS in 2014 with his brain cryonically preserved", wrong: ["He authored the cryptographic foundations of the original Bitcoin whitepaper before Satoshi transformed them into a fully operational peer-to-peer payment system", "He mined the genesis block alongside Satoshi and ran Bitcoin's first public exchange, converting BTC into USD for the earliest adopters of the network as defined by Bitcoin consensus rules enforced by all full nodes", "He ran Bitcoin's first currency exchange and facilitated the landmark pizza transaction, the first documented real-world commercial use of Bitcoin as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "Why do many researchers suspect Nick Szabo is Satoshi Nakamoto?", a: "He coined the term \"smart contracts\" in 1994 and created bit gold in 1998 — a Bitcoin direct predecessor featuring similar proof-of-work and digital scarcity mechanics", wrong: ["He registered bitcoin.org before the whitepaper's release and was the only known cypherpunk with sufficient C++ expertise to write the original client", "His writing style matched the Bitcoin whitepaper with 99% confidence according to multiple independent linguistic forensic analysis studies published in 2013", "He confirmed in a 2019 podcast interview that he was \"deeply involved in Bitcoin's conceptual design\" without explicitly claiming sole authorship of the protocol"] },
        { q: "What was Wei Dai's contribution to digital cash, and how is he honored in crypto today?", a: "He created b-money in 1998, the first proposal for anonymous distributed electronic cash directly cited by Satoshi; Ethereum's smallest unit, the \"wei,\" is named after him", wrong: ["He invented the zero-knowledge proof protocol in 1992 underlying Ethereum's privacy layer; the \"gwei\" denomination honors his foundational cryptographic contribution", "He designed the distributed hash table architecture in 1997 that directly inspired Bitcoin's peer-to-peer network topology and decentralized node discovery protocol", "He created e-gold in 1996, the first operational digital gold currency system, and MakerDAO's \"dai\" stablecoin was named in honor of his legacy as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "What did Timothy May argue in his \"Crypto-Anarchist Manifesto\" written in 1988?", a: "Cryptography would make governments unable to tax or regulate digital communications, enabling untraceable anonymous transactions and entirely new free markets", wrong: ["Encryption would enable investigative journalists to safely transmit whistleblower documents across borders, fundamentally reforming government accountability worldwide", "Public-key cryptography would make government-issued identity documents and passports completely obsolete within two decades of widespread civilian adoption", "Digital cash systems would eliminate banking fees for ordinary citizens and redistribute trillions in financial industry profits directly to technology developers"] },
        { q: "What is Len Sassaman's unusual and permanent connection to the Bitcoin blockchain?", a: "He was a cypherpunk cryptographer who died in July 2011 shortly after Satoshi went dark; his obituary was permanently encoded into the Bitcoin blockchain as tribute", wrong: ["He merged Satoshi's final code commits before the creator went dark in 2011, making him the last developer to interact officially with the original Bitcoin client", "He operated the longest-running Bitcoin full node during the first year of the network, and his node identifier was encoded in the metadata of block 21,000", "He contributed the peer-to-peer networking module to the original Bitcoin client, and his PGP public key is permanently embedded inside the genesis block's coinbase script"] },
        { q: "What legal precedent did Phil Zimmermann establish through his battles over PGP encryption?", a: "His US prosecution for \"exporting munitions\" when PGP spread abroad established the critical constitutional precedent that software source code is protected free speech", wrong: ["His case established that no court could compel production of cryptographic keys as self-incriminating testimony, extending Fifth Amendment protections to encryption", "His legal battle with RSA Security over patent licensing established the foundational principle that mathematical algorithms cannot be privately owned as intellectual property", "His prosecution established that open-source cryptographic software cannot under any circumstances be classified as a weapon under the Arms Export Control Act"] },
        { q: "What was Julian Assange's connection to the cypherpunk movement and to Bitcoin's early adoption?", a: "Assange was a cypherpunk mailing list subscriber when Satoshi published the whitepaper in 2008; WikiLeaks later became one of Bitcoin's first major organizational adopters", wrong: ["Assange personally corresponded with Satoshi throughout 2009 to coordinate WikiLeaks's launch of a dedicated anonymous Bitcoin donation infrastructure for sources", "Assange co-authored the \"Cypherpunks\" book with Jacob Appelbaum in 2012, which became a widely cited foundational text within the early Bitcoin community", "Assange was a contributing Bitcoin developer before founding WikiLeaks, writing the anonymous transaction routing code that appeared in client version 0.2"] }
    ],
    "satoshi_nakamoto_deep": [
        { q: "How many posts did Satoshi Nakamoto make on the BitcoinTalk forum before going silent?", a: "Exactly 575 documented posts on the BitcoinTalk forum before Satoshi went dark in late 2010 and early 2011, handing off to Gavin Andresen", wrong: ["Approximately 3,200 posts across BitcoinTalk and the Cypherpunks mailing list before formally transferring all authority and repository access to Gavin Andresen", "Around 1,100 public posts on BitcoinTalk, plus hundreds of private direct messages to core developers that were later partially leaked online", "Fewer than 100 public posts total, since Satoshi strongly preferred communicating through private encrypted email rather than open public forum discussions"] },
        { q: "What is considered significant about Satoshi's self-reported birthday of April 5, 1975?", a: "April 5 is the date of FDR's 1933 Executive Order 6102 confiscating gold, and 1975 is the year Americans regained the legal right to own gold again", wrong: ["April 5 is the date Satoshi registered bitcoin.org in 2008, and 1975 is the year Whitfield Diffie and Martin Hellman published the public-key cryptography paper", "April 5 is the date of the first confirmed Bitcoin transaction in 2009, and 1975 marks the founding of the first academic digital money research consortium", "April 5 was chosen as a random privacy-preserving date, and 1975 simply reflects the year the cypherpunk movement's core philosophical foundations were established"] },
        { q: "What is notable about how Satoshi Nakamoto managed Bitcoin addresses for privacy?", a: "Satoshi maintained over 22,000 documented unique addresses and reportedly never reused a single one, demonstrating perfect on-chain privacy hygiene throughout", wrong: ["Satoshi used a single master address for all early mining rewards to simplify personal accounting, then rotated to new addresses only after 2010", "Satoshi reused addresses intentionally to signal authenticity to early users, maintaining fewer than 50 documented unique addresses across all activity", "Satoshi's addresses followed a deterministic pattern researchers cracked in 2013, successfully mapping every early mining reward back to a single master wallet"] },
        { q: "What did Satoshi write in his final known email to Gavin Andresen in April 2011?", a: "\"I have moved on to other things. It is in good hands with Gavin and everyone.\"", wrong: ["\"The system is working as intended. Never add features without thorough peer review, and always keep the codebase minimal and fully auditable.\"", "\"Please do not attempt to contact me again. Bitcoin must stand entirely on its own without any individual being perceived as its leader.\"", "\"Protect the 21 million supply cap above all else. Any proposal to alter total issuance must be permanently and unconditionally rejected.\""] },
        { q: "What surprising feature was hidden inside Satoshi's original Bitcoin source code?", a: "The unfinished beginnings of an online poker game were embedded within the original approximately 31,000 lines of C++ source code", wrong: ["A built-in decentralized exchange for direct peer-to-peer currency swaps without intermediaries, which was deliberately stripped out before the 2009 launch", "An early DNS-based identity system allowing users to cryptographically link human-readable usernames to their Bitcoin addresses across the network", "A complete payment channel prototype closely resembling the Lightning Network that Satoshi implemented fully but deliberately disabled before the January 2009 launch"] },
        { q: "What does Satoshi's registration of netcoin.org reveal about the project's late development?", a: "Satoshi registered netcoin.org one day before bitcoin.org, strongly suggesting the project's final name was still undecided until very late in development", wrong: ["Satoshi registered netcoin.org as a deliberate decoy domain to mislead corporate legal teams that were monitoring digital currency development for patent filings", "Netcoin.org was registered by Hal Finney on Satoshi's behalf as a geographic mirror for distributing the whitepaper outside of US legal jurisdiction", "The netcoin.org registration proves Satoshi initially envisioned a narrower online payment network before expanding the scope to a full decentralized monetary system"] },
        { q: "How did the pre-launch Bitcoin parameters differ from the version released in January 2009?", a: "Pre-launch Bitcoin used 15-minute block times and 30-day difficulty adjustments; these were changed to 10-minute blocks and a 2-week difficulty window before launch", wrong: ["Pre-launch Bitcoin used 1-minute block times and 24-hour difficulty adjustments; these were deliberately slowed to improve stability and prevent network spam", "The original technical parameters matched the final launch version exactly; no substantive changes were made between the whitepaper publication and the software release", "Pre-launch Bitcoin had no automatic difficulty adjustment at all; the 2-week adjustment period was proposed by Hal Finney and added during the first year of operation"] },
        { q: "What is notable about the approximately 1 million Bitcoin Satoshi mined in the early days?", a: "Satoshi mined roughly 1 million BTC using a deliberately limited single-threaded miner to avoid dominating the network, and none of these coins have ever moved", wrong: ["Satoshi mined approximately 1 million BTC but transferred the majority to a multi-signature escrow wallet controlled by the Bitcoin Foundation before going dark in 2011", "Satoshi mined approximately 1 million BTC and quietly liquidated about half of them during the 2013 bull run to fund ongoing anonymous development work", "Satoshi's early mining totaled only around 50,000 BTC; the widely cited 1 million figure is a persistent myth based on demonstrably flawed blockchain analysis methods"] },
        { q: "What happens to Bitcoin that fans send to the original Genesis Block address as tribute?", a: "Over 68 BTC have been sent as tribute to the Genesis Block address, but they are permanently unspendable since the output carries no valid scriptPubKey to spend from", wrong: ["Bitcoin sent to the Genesis Block address is automatically destroyed by the protocol itself, permanently reducing the circulating supply below 21 million coins", "Genesis Block donations remain locked and are accessible only to whoever controls Satoshi's original private keys, creating an enduring cryptographic mystery", "All Bitcoin sent to the Genesis Block address accumulates in a special reserve fund governed collectively by the Bitcoin Core development team and maintainers"] },
        { q: "What does the fact that only 0.06% of Bitcoin Core code remains from Satoshi's original suggest?", a: "The global community has rebuilt nearly everything from scratch, embodying the spirit that \"we are all Satoshi\" through decades of collective open-source maintainership", wrong: ["Satoshi's original code was so poorly structured and buggy that developers had to replace it entirely, raising serious questions about Satoshi's actual programming expertise", "The 0.06% figure proves Satoshi contributed only the whitepaper concept while the actual software was primarily written by Hal Finney and other early collaborators", "Bitcoin Core has diverged so completely from Satoshi's original design that it should be treated as an entirely different protocol incompatible with the founding vision"] }
    ],
    "books_deep": [
        { q: "Which book did Michael Saylor credit as most impactful in MicroStrategy's decision to adopt Bitcoin?", a: "The Bitcoin Standard by Saifedean Ammous", wrong: ["The Fiat Standard by Saifedean Ammous", "Gradually Then Suddenly by Parker Lewis", "Broken Money by Lyn Alden, as specified in the original Bitcoin whitepaper released in 2008"] },
        { q: "In \"The Bitcoin Standard,\" what economic concept measures the ratio of above-ground supply to annual production?", a: "Stock-to-Flow ratio", wrong: ["Purchasing power parity index", "Time preference discount rate", "Monetary velocity multiplier"] },
        { q: "What is the subtitle of Saifedean Ammous's second book, \"The Fiat Standard\"?", a: "The Debt Slavery Alternative to Human Civilization", wrong: ["The Hidden Tax on Every Holder of Currency as defined by Bitcoin consensus rules enforced by all full nodes", "How Central Banks Destroyed the Modern World", "A Monetary History of the Post-Gold Era as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "In \"21 Lessons,\" DerGigi describes Bitcoin's origin as having no founder still in control, no premine, and no ICO — he calls this Bitcoin's what?", a: "Immaculate conception", wrong: ["Genesis paradox as defined by Bitcoin consensus rules enforced by all full nodes", "Sovereign neutrality principle", "Trustless bootstrap event"] },
        { q: "In \"Gradually, Then Suddenly,\" Parker Lewis argues Bitcoin cannot be copied because of what, not because the code is proprietary?", a: "Bitcoin's network effects make a copy worthless from day one", wrong: ["Bitcoin's mining hardware creates a prohibitive barrier to entry for copycats", "Bitcoin's regulatory approval cannot be duplicated by any fork or altcoin", "Bitcoin's cryptographic proof-of-work algorithm is patented and legally protected"] },
        { q: "Jason Lowery's \"Softwar\" was submitted as an MIT thesis. What novel claim does it make about Bitcoin's proof-of-work?", a: "PoW is a form of non-lethal power projection allowing nations to compete via hashrate instead of violence", wrong: ["PoW is an energy accounting system that proves Bitcoin's value in physical thermodynamic terms", "PoW functions as a diplomatic signaling mechanism that deters state-level cyberattacks on infrastructure", "PoW creates a decentralized arms-control treaty enforced by thermodynamics rather than international law"] },
        { q: "According to Vijay Boyapati's \"The Bullish Case for Bitcoin,\" what is the correct order of Bitcoin's monetization stages?", a: "Collectible → store of value → medium of exchange → unit of account", wrong: ["Store of value → collectible → medium of exchange → unit of account", "Medium of exchange → store of value → unit of account → collectible", "Collectible → medium of exchange → store of value → unit of account"] },
        { q: "Nik Bhatia's \"Layered Money\" argues that monetary layers built atop Bitcoin — like Lightning — are a natural evolution. What historical precedent does he trace this pattern through?", a: "The monetary hierarchy from gold to central bank notes to commercial bank deposits through history", wrong: ["The progression from barter to commodity money to bills of exchange in medieval Europe as defined by Bitcoin consensus rules enforced by all full nodes", "The development of the Federal Reserve system from private clearinghouses after the Panic of 1907", "The transition from the classical gold standard to the Bretton Woods dollar-gold exchange system"] },
        { q: "Jonathan Bier's \"The Blocksize War\" documents the 2015–2017 governance battle. What broader lesson does it demonstrate about who ultimately controls Bitcoin's protocol?", a: "Economic nodes and users — not miners — hold final power over which consensus rules Bitcoin enforces", wrong: ["Core developers hold final power because miners must adopt whatever client they release to the network", "Miners hold final power because they can always reorganize the chain and override node-level rules", "Large exchanges hold final power because they determine which version of Bitcoin earns the ticker symbol"] },
        { q: "Lyn Alden's \"Broken Money\" is primarily a macro case for Bitcoin. What does she identify as the core structural flaw in the current monetary system?", a: "The dollar-based reserve system built after 1971 creates persistent debt growth and destroys savings over time", wrong: ["The Federal Reserve's dual mandate forces it to create inflation to meet employment targets indefinitely", "Commercial banks' fractional reserve lending multiplies currency beyond any anchor to productive activity", "Government deficit spending requires continuous monetization that no neutral reserve asset can currently absorb"] }
    ],
    "human_rights_deep": [
        { q: "Alex Gladstein of the Human Rights Foundation wrote \"Check Your Financial Privilege.\" What percentage of people does he say live in liberal democracies with stable reserve currencies?", a: "Only about 13% of the global population", wrong: ["Only about 28% of the global population", "Roughly half — about 49% of the global population", "Approximately 34% of the global population"] },
        { q: "When Nigeria's central bank banned banks from servicing crypto exchanges in 2021, what happened to peer-to-peer Bitcoin trading volumes?", a: "They surged to the highest levels in Africa as Nigerians routed around the ban", wrong: ["They collapsed by over 80% as citizens feared criminal prosecution for trading", "They remained flat because most Nigerians were unaware of hardware wallet alternatives", "They shifted entirely to stablecoins, with Bitcoin trading volumes dropping to near zero"] },
        { q: "In Venezuela's hyperinflation crisis, what was the typical fee range that families lost when sending remittances through traditional wire and cash services?", a: "20–40% of the total transfer in fees and unfavorable exchange rates", wrong: ["5–10% of the total transfer in fees and unfavorable exchange rates", "50–70% of the total transfer in fees and currency conversion losses", "10–15% of the total transfer in fees and exchange rate spreads"] },
        { q: "During the 2019–2020 Lebanese banking crisis, how did the situation differ for Bitcoin holders versus bank depositors?", a: "Banks froze depositor accounts entirely, while Bitcoin holders retained full, unobstructed access to their funds", wrong: ["Bitcoin holders saw their funds seized by Lebanese authorities, while bank depositors received partial access", "Both groups faced equal restrictions, as Lebanese courts extended banking freezes to crypto wallets", "Bank depositors could withdraw up to $400 per week, while Bitcoin holders faced blockchain-level withdrawal limits"] },
        { q: "In Taliban-controlled Afghanistan, what specific financial freedom does Bitcoin on a mobile phone enable for women?", a: "Women legally barred from holding bank accounts can control their own money without requiring male permission or a bank", wrong: ["Women can receive international aid disbursements that Taliban officials cannot intercept or redirect to male relatives", "Women can pay for goods anonymously, preventing Taliban tracking of purchases deemed un-Islamic by local authorities", "Women can earn wages in Bitcoin from foreign employers, bypassing Taliban labor laws restricting female employment"] },
        { q: "During the 2022 Canadian trucker convoy protests, what happened to the GoFundMe campaign, and how did the Bitcoin alternative compare in size?", a: "GoFundMe froze $10 million in donations; Bitcoin campaigns raised approximately $21 million which could not be frozen", wrong: ["GoFundMe froze $3 million in donations; Bitcoin campaigns raised approximately $7 million which could not be frozen", "GoFundMe froze $25 million in donations; Bitcoin campaigns raised approximately $4 million which could not be frozen", "GoFundMe froze $10 million in donations; Bitcoin campaigns raised approximately $4 million which was later seized"] },
        { q: "In 2010, WikiLeaks was financially blockaded — Visa, Mastercard, and PayPal all cut off donations under US government pressure. What did this event demonstrate about Bitcoin?", a: "Bitcoin was completely immune to the blockade, allowing WikiLeaks to continue receiving donations without any payment processor", wrong: ["Bitcoin donations to WikiLeaks were blocked by exchanges cooperating with US Treasury demands at the network layer", "Bitcoin provided a brief alternative but was later traced by the NSA, leading to arrests of major WikiLeaks donors", "Bitcoin exposure forced WikiLeaks to pause fundraising temporarily due to volatility making donation values unpredictable"] },
        { q: "How many adults worldwide are estimated to lack a bank account, and what does Bitcoin's mobile-first design offer them?", a: "About 1.4 billion unbanked adults can access Bitcoin-based financial services using only a mobile phone", wrong: ["About 500 million unbanked adults can access Bitcoin-based financial services using only a mobile phone", "About 3 billion unbanked adults can access Bitcoin-based financial services using only a mobile phone", "About 800 million unbanked adults can access Bitcoin-based financial services using only a mobile phone"] },
        { q: "In Cuba, what financial problem does Bitcoin solve for diaspora families sending money home?", a: "It eliminates the 10%+ fees charged by Western Union and other remittance services for transfers to Cuba", wrong: ["It bypasses the US embargo by routing transfers through Bitcoin exchanges outside Western financial networks", "It prevents Cuban authorities from seizing transfers that exceed government-set remittance caps per household", "It allows Cuban recipients to hold value that cannot be confiscated during government mandated currency conversions"] },
        { q: "Alex Gladstein argues that the global financial privilege gap is poorly understood by people in wealthy nations. What is the key stat that reframes the debate?", a: "87% of humanity lives under authoritarian or semi-authoritarian governments with weaker, less stable currencies", wrong: ["65% of global GDP is produced in countries whose citizens cannot freely buy or sell foreign currencies", "92% of global inflation occurs in the developing world, yet monetary reform debates are dominated by G7 economists", "74% of the world's population has experienced at least one episode of government-imposed capital controls since 1970"] }
    ],
    "cbdc": [
        { q: "What does CBDC stand for, and what is its most fundamental difference from Bitcoin?", a: "Central Bank Digital Currency — it is centrally controlled by government, unlike Bitcoin which has no central issuer", wrong: ["Crypto-Backed Digital Contract — it requires collateral backing unlike Bitcoin which is backed only by decentralized consensus", "Cross-Border Digital Currency — it is designed for international trade unlike Bitcoin which was designed for domestic payments", "Central Bank Distributed Coin — it uses distributed ledger technology unlike Bitcoin which uses a single-node blockchain"] },
        { q: "What is one programmability feature of CBDCs that no physical cash or Bitcoin can ever impose on a user?", a: "Expiry dates that cause the money to disappear from your account if not spent within a set time period", wrong: ["Verification requirements that confirm every transaction is spent on government-approved goods and services only", "Mandatory conversion into physical cash if not used for digital transactions within a quarterly spending window", "Automatic tax withholding on all transactions above a threshold set by the treasury at the time of payment"] },
        { q: "China's digital yuan (e-CNY) is one of the most advanced CBDC deployments. How has it been distributed and monitored?", a: "It has been used in government benefit payments and all transactions are monitored in real time by Chinese authorities", wrong: ["It has been distributed exclusively through commercial banks and monitored only for transactions exceeding 50,000 yuan", "It runs on a private blockchain shared with approved banks, with full transaction privacy from government surveyors", "It has been issued only to state employees as salary, with transaction data retained only for anti-fraud purposes"] },
        { q: "How could a CBDC theoretically implement negative interest rates in a way that physical cash makes impossible?", a: "The government could directly reduce account balances over time to penalize saving and force consumer spending", wrong: ["The government could block transactions with foreign merchants to concentrate spending within the domestic economy", "The government could require merchants to charge surcharges on CBDC payments relative to digital yuan alternatives", "The government could convert idle CBDC balances into government bonds automatically after 90 days without spending"] },
        { q: "Privacy advocates have called CBDCs \"panopticon money.\" What does this metaphor mean in practice?", a: "Every purchase is tracked and visible to authorities — no transaction can be anonymous like cash transactions currently are", wrong: ["All financial data is visible to a network of multinational banks and corporations rather than just the government issuer", "CBDC balances are displayed publicly on a blockchain explorer, removing all financial privacy from citizens as defined by Bitcoin consensus rules enforced by all full nodes", "The government can see transaction patterns across all users but cannot identify specific individuals behind purchases"] },
        { q: "When Nigeria launched one of the world's first CBDCs — the eNaira in 2021 — what happened to public adoption?", a: "Adoption was extremely low, with citizens preferring cash and Bitcoin over the government's digital currency", wrong: ["Adoption was very high in urban areas but failed in rural regions where smartphone penetration is below 20%", "Adoption was forced above 60% when the government imposed penalties on businesses refusing eNaira payments", "Adoption was moderate but froze after the central bank suspended the eNaira following a technical hack in 2022"] },
        { q: "How does a CBDC differ from ordinary digital bank money in terms of government control over individual accounts?", a: "With a CBDC the government controls the ledger directly, enabling confiscation without going through a bank as intermediary", wrong: ["With a CBDC users earn interest set by the central bank directly, bypassing commercial bank interest rate decisions entirely", "With a CBDC government transfers are instant and fee-free, but commercial transactions still pass through bank clearing systems", "With a CBDC citizens interact with a public ledger they can audit, unlike traditional bank accounts that are privately held"] },
        { q: "How many central banks globally were actively researching or developing CBDC programs as of the mid-2020s?", a: "Over 130 central banks were actively exploring or developing CBDC programs", wrong: ["About 40 central banks were actively exploring or developing CBDC programs", "Over 200 central banks were actively exploring or developing CBDC programs", "Approximately 80 central banks were actively exploring or developing CBDC programs"] },
        { q: "What is the key distinction between Bitcoin's permissionless access model and a CBDC's access model?", a: "Bitcoin allows anyone to participate without approval, while CBDC authorities decide who is permitted to use the system", wrong: ["Bitcoin requires miners to validate identities before transactions confirm, while CBDCs use zero-knowledge proofs for privacy", "Bitcoin charges higher fees than CBDCs because it lacks a central issuer to subsidize transaction processing costs", "Bitcoin transactions are reversible within 24 hours, while CBDC transactions are irreversible from the moment of broadcast"] },
        { q: "What concern do economists raise about spending limits and category restrictions that CBDCs could technically enforce?", a: "Governments could block purchases of disfavored goods — fuel, firearms, political donations — at the payment protocol level", wrong: ["Governments could restrict CBDC use to domestic merchants, effectively creating a new form of capital controls overnight", "Economists worry CBDCs will displace commercial banks entirely by eliminating the need for deposit-taking institutions", "Economists warn that real-time CBDC settlement will allow high-frequency traders to front-run ordinary consumer purchases"] }
    ],
    "block_size_wars": [
        { q: "What was the central technical debate in the Blocksize War of 2015–2017?", a: "Whether to increase Bitcoin's block size limit to fit more transactions per block for on-chain scaling", wrong: ["Whether to replace Bitcoin's SHA-256 proof-of-work algorithm with a memory-hard alternative to reduce miner centralization", "Whether to implement a second script language alongside Bitcoin Script to support smart contract functionality on-chain", "Whether to increase the total Bitcoin supply cap from 21 million to accommodate growing global payment demand"] },
        { q: "What was the \"big blocker\" argument for raising the block size limit?", a: "Larger blocks would allow more on-chain transactions, keeping fees low and enabling Bitcoin to scale as a global payment system", wrong: ["Larger blocks would make mining more profitable, incentivizing more miners and increasing Bitcoin's overall network security", "Larger blocks would reduce orphan block rates, making the chain more stable and resistant to selfish mining attacks", "Larger blocks would decrease blockchain download times by batching more data per round-trip during initial sync as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "What was the core \"small blocker\" concern about raising the block size limit?", a: "Larger blocks would make running a full node too expensive, concentrating Bitcoin verification among large miners and data centers", wrong: ["Larger blocks would slow transaction propagation globally, allowing well-connected miners to dominate block production", "Larger blocks would require a hard fork that could be exploited by adversarial states to attack Bitcoin's consensus layer", "Larger blocks would reduce the fee market needed to sustain miners after the block subsidy eventually reaches zero as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "What was BIP148 (UASF) and why was it historically significant?", a: "It was a User-Activated Soft Fork where node operators threatened to reject non-SegWit blocks — users directly forced miners to comply", wrong: ["It was a miner-activated upgrade proposal that required 95% hash power signaling before SegWit could activate on mainnet", "It was a protocol patch that fixed the transaction malleability bug independently of SegWit, resolving the scaling debate peacefully", "It was a compromise proposal combining a 2 MB block size increase with the SegWit witness discount in a single hard fork"] },
        { q: "What did SegWit (BIP141) actually do to Bitcoin's effective block capacity?", a: "It increased effective capacity to approximately 2–4 MB by applying a discount to signature (witness) data without a hard fork", wrong: ["It increased effective capacity to exactly 8 MB by separating transaction data from signatures in a full hard fork upgrade", "It doubled raw on-chain TPS by compressing transaction data with a new serialization format in a backward-compatible upgrade", "It increased effective capacity to approximately 1.5 MB by removing redundant script opcodes from the transaction format"] },
        { q: "What was the New York Agreement (SegWit2x) and what happened to it?", a: "A 2017 deal between miners and businesses to activate SegWit then hard fork to 2 MB blocks — it was ultimately rejected and abandoned", wrong: ["A 2016 deal between Core developers and exchanges to freeze block size at 1 MB permanently in exchange for Lightning funding", "A 2017 proposal to move Bitcoin to a proof-of-stake system signed by major mining pools; it collapsed after a Chinese mining ban", "A 2015 agreement between Blockstream and major miners to develop SegWit in exchange for their opposition to competing clients"] },
        { q: "Bitcoin Cash (BCH) was created on August 1, 2017. Who were the two most prominent figures leading the big-block faction that forked off?", a: "Roger Ver (\"Bitcoin Jesus\") and Jihan Wu of Bitmain, the dominant mining hardware manufacturer", wrong: ["Gavin Andresen and Mike Hearn, the original Bitcoin Core developers who departed over the governance dispute", "Charlie Lee and Craig Wright, who disagreed on block size before Craig later launched Bitcoin SV as a separate fork", "Vitalik Buterin and Brian Armstrong, who favored higher-throughput chains compatible with Ethereum's transaction model"] },
        { q: "What did the outcome of the Blocksize War prove about the power structure in Bitcoin's governance?", a: "Miners cannot override the economic nodes — exchanges, businesses, and users running full nodes hold final authority over consensus rules", wrong: ["Core developers hold veto power over any upgrade because miners must route block templates through their reference code as defined by Bitcoin consensus rules enforced by all full nodes", "Large institutional holders effectively control protocol direction by threatening to sell if unfavorable forks succeed on the market", "Mining pools hold governance power because they can reorganize the blockchain to reverse any soft fork that harms profitability"] },
        { q: "Which book is considered the definitive account of the Blocksize War and who wrote it?", a: "\"The Blocksize War\" by Jonathan Bier, which documents the full 2015–2017 governance battle in detail", wrong: ["\"Digital Gold\" by Nathaniel Popper, which documents the governance battle alongside early Bitcoin adoption stories", "\"The Bitcoin Standard\" by Saifedean Ammous, which includes a full chapter on the governance crisis and its resolution", "\"Cryptoassets\" by Chris Burniske and Jack Tatar, which covers the fork wars across Bitcoin, Ethereum, and other protocols"] },
        { q: "What is the broader lesson Bitcoin historians draw from the Blocksize War about contentious protocol changes?", a: "Bitcoin's governance is uniquely robust because controversial changes are extremely difficult to force through without broad consensus", wrong: ["Bitcoin's governance is dangerously slow because improvements like SegWit took two years longer than technically necessary to deploy", "Bitcoin's governance proves that miners always win long-term disputes because they control the hash power securing the chain", "Bitcoin's governance shows that off-chain political agreements like the New York Agreement are the most effective scaling path"] }
    ],
    "mtgox": [
        { q: "What does the name \"Mt. Gox\" actually stand for, and what was the platform before it became a Bitcoin exchange?", a: "Magic: The Gathering Online Exchange — it was originally a card trading site repurposed for Bitcoin in 2010", wrong: ["Creditors waited approximately 5 years; distributions began in 2019 and were paid entirely in fiat currency at original dollar values", "Creditors waited approximately 7 years; distributions began in 2021 and were settled in USDT stablecoins rather than Bitcoin", "Creditors waited approximately 10 years; distributions began in 2024 but all Bitcoin was converted to cash at bankruptcy-era prices"] },
        { q: "At its peak in 2013, what share of all global Bitcoin transactions passed through Mt. Gox?", a: "Over 70% of all global Bitcoin transactions were processed through Mt. Gox at its peak", wrong: ["Over 90% of all global Bitcoin transactions were processed through Mt. Gox at its peak", "Approximately 40% of all global Bitcoin transactions were processed through Mt. Gox at its peak", "Roughly 55% of all global Bitcoin transactions were processed through Mt. Gox at its peak"] },
        { q: "When Mt. Gox collapsed in February 2014, how many BTC did it announce had been lost, and how many were later found internally?", a: "Mt. Gox reported ~850,000 BTC lost; approximately 200,000 BTC were later discovered in old wallets and recovered", wrong: ["Mt. Gox reported ~650,000 BTC lost; approximately 150,000 BTC were later discovered in cold storage and recovered", "Mt. Gox reported ~1.2 million BTC lost; approximately 350,000 BTC were later discovered during bankruptcy proceedings", "Mt. Gox reported ~850,000 BTC lost; none were ever recovered as all coins were immediately laundered by the attackers"] },
        { q: "What were the two root causes that allowed Mt. Gox to be drained of Bitcoin over a period of years?", a: "Transaction malleability exploits combined with severe internal financial mismanagement and lack of auditing", wrong: ["A private key leak on the public GitHub repository combined with a social engineering attack on the core server team", "Insider theft by a rogue employee combined with a zero-day exploit in the OpenSSL library used for wallet encryption", "A 51% attack on the Bitcoin network combined with poor hot wallet security that left most funds in an online server"] },
        { q: "What crime was Mt. Gox CEO Mark Karpeles ultimately convicted of in Japan?", a: "Data manipulation — he was convicted of falsifying electronic records, though embezzlement charges were dropped", wrong: ["Theft and embezzlement — he was convicted of directly moving customer Bitcoin to personal wallets for his own enrichment", "Securities fraud — he was convicted of issuing false statements about exchange reserves to prevent a bank run", "Money laundering — he was convicted of funneling customer funds through shell companies registered in France and Japan"] },
        { q: "What phrase, now a cornerstone of Bitcoin culture, emerged directly from the lessons of the Mt. Gox collapse?", a: "\"Not your keys, not your coins\" — the principle that only self-custody guarantees ownership of your Bitcoin", wrong: ["\"Proof of reserves or proof of fraud\" — the principle that exchanges must publish verifiable on-chain reserve attestations", "\"Run your own node, trust no one\" — the principle that verifying the chain yourself is the only true form of sovereignty", "\"Cold storage or capitulation\" — the principle that any Bitcoin left on an exchange is a loan you may never get back"] },
        { q: "How long did Mt. Gox creditors wait for repayment, and what was notable about the form the repayment took?", a: "Creditors waited approximately 10 years; distributions began in 2024 and were paid in BTC worth far more in dollar terms than original claims", wrong: ["Creditors waited approximately 5 years; distributions began in 2019 and were paid in Japanese yen at 2014 Bitcoin valuations as defined by Bitcoin consensus rules enforced by all full nodes", "Creditors waited approximately 7 years; distributions began in 2021 and were partially repaid in BCH following the 2017 fork as defined by Bitcoin consensus rules enforced by all full nodes", "Creditors waited approximately 10 years; distributions began in 2024 but were paid only in fiat at 2014 prices per court order"] },
        { q: "How did Bitcoin's price respond to the Mt. Gox collapse in early 2014, and how long did recovery take?", a: "Bitcoin dropped from roughly $800 to roughly $350 and took nearly 3 years to reclaim its pre-Mt. Gox price", wrong: ["Bitcoin dropped from roughly $1,200 to roughly $150 and took nearly 5 years to reclaim its pre-Mt. Gox price", "Bitcoin dropped from roughly $800 to roughly $600 and recovered within 6 months as markets shrugged off the exchange failure", "Bitcoin dropped from roughly $500 to roughly $50 and took over 4 years to reclaim its pre-collapse all-time high"] },
        { q: "What lasting contribution to Bitcoin's security culture did the Mt. Gox failure accelerate?", a: "It drove rapid development of hardware wallets and normalized self-custody as the standard practice for holding Bitcoin", wrong: ["It accelerated the development of proof-of-reserve auditing standards that all major exchanges now publish quarterly", "It prompted the creation of the Bitcoin Foundation to lobby for exchange insurance requirements in major jurisdictions", "It caused Bitcoin developers to implement mandatory withdrawal delays on-protocol to prevent rapid theft from online wallets"] },
        { q: "Despite being the largest exchange failure in crypto history, what did the Mt. Gox debacle definitively prove about the Bitcoin protocol itself?", a: "The Bitcoin protocol was never compromised — it was Mt. Gox's internal systems that were hacked, not the Bitcoin network", wrong: ["The Bitcoin protocol's transaction malleability bug was the root cause, proving base layer security vulnerabilities are existential", "The Bitcoin protocol survived only because developers issued an emergency patch within 48 hours of the malleability exploit", "The Bitcoin protocol was briefly compromised but miners voluntarily reorganized the chain to restore 200,000 stolen coins"] }
    ],
    "mining_hardware": [
        { q: "What was the correct order of Bitcoin mining hardware evolution?", a: "CPU → GPU → FPGA → ASIC", wrong: ["GPU → CPU → ASIC → FPGA", "CPU → FPGA → GPU → ASIC", "FPGA → GPU → CPU → ASIC"] },
        { q: "In what year did CPU mining of Bitcoin begin?", a: "2009", wrong: ["2010", "2011", "2008"] },
        { q: "Who co-founded Bitmain, the dominant ASIC manufacturer?", a: "Jihan Wu and Micree Zhan", wrong: ["Roger Ver and Charlie Lee", "Adam Back and Greg Maxwell", "Hal Finney and Nick Szabo"] },
        { q: "What is the efficiency metric used to measure ASIC mining performance?", a: "Joules per terahash (J/TH)", wrong: ["Kilowatts per gigahash (kW/GH)", "Watts per megahash (W/MH)", "Terahash per kilowatt-hour (TH/kWh)"] },
        { q: "Approximately what hash rate does the open-source Bitaxe home miner achieve?", a: "About 3 TH/s", wrong: ["About 30 TH/s", "About 300 GH/s", "About 0.3 PH/s"] },
        { q: "Why can ASICs not be repurposed once Bitcoin mining becomes unprofitable?", a: "They are application-specific and can only run the SHA-256 algorithm", wrong: ["They require proprietary firmware that prevents other software from running", "Their cooling systems are designed exclusively for Bitcoin network voltage requirements", "They use encrypted memory modules that are locked to Bitcoin pool credentials"] },
        { q: "Which early Bitcoin miner was also known as a prolific GPU miner around 2010–2011?", a: "Laszlo Hanyecz (the Bitcoin Pizza guy)", wrong: ["Hal Finney, who mined the first transaction from Satoshi", "Roger Ver, who mined the first blocks on Bitcoin testnet", "Nick Szabo, who later sold his GPU rigs to fund Bit Gold research"] },
        { q: "What milestone did the Bitcoin network hashrate reach in 2025?", a: "1 ZH/s (1 zettahash per second)", wrong: ["1 EH/s (1 exahash per second)", "1 PH/s (1 petahash per second)", "100 EH/s (100 exahashes per second)"] },
        { q: "What notable event happened with a Bitaxe miner in July 2024?", a: "A Bitaxe solo-mined a valid Bitcoin block, beating billion-to-one odds", wrong: ["A Bitaxe achieved a world record hash rate of 10 TH/s for a home device", "A Bitaxe was the first open-source device submitted to a major mining pool", "A Bitaxe operator won a class-action lawsuit against an ASIC manufacturer"] },
        { q: "How are some miners repurposing the waste heat from ASIC rigs?", a: "Heating homes, greenhouses, and swimming pools", wrong: ["Powering adjacent data centers through thermoelectric generators", "Generating steam to drive small turbines for on-site electricity recovery", "Pre-heating industrial boilers to reduce natural gas consumption at factories"] }
    ],
    "mining_economics": [
        { q: "What is the current Bitcoin block subsidy after the April 2024 halving?", a: "3.125 BTC per block", wrong: ["Whether mining pool operators should be legally required to hold a reserve of Bitcoin to guarantee block rewards", "Whether national governments can legally impose confiscatory taxes on mining revenue without undermining security", "Whether rising global energy costs will eventually make proof-of-work mining permanently economically unviable"] },
        { q: "What is \"hashprice\" in Bitcoin mining economics?", a: "Revenue earned per unit of hashrate per day, usually expressed in $/TH/day", wrong: ["The market price of a new ASIC miner measured in USD per terahash of rated capacity", "The electricity cost required to produce one terahash of mining output per hour", "The break-even Bitcoin price at which a miner's marginal cost equals block reward value"] },
        { q: "What electricity cost range do large-scale miners typically target to remain competitive?", a: "$0.02–$0.05 per kWh", wrong: ["$0.08–$0.12 per kWh", "$0.10–$0.15 per kWh", "$0.01–$0.02 per kWh"] },
        { q: "What percentage of a Bitcoin miner's operating costs does energy typically represent?", a: "60–80% of total operating costs", wrong: ["20–35% of total operating costs", "40–55% of total operating costs", "85–95% of total operating costs"] },
        { q: "What is the \"security budget\" debate in Bitcoin mining?", a: "Whether transaction fees will be sufficient to incentivize miners after block subsidies approach zero", wrong: ["Whether mining pool operators should be required to hold a reserve of BTC as collateral as defined by Bitcoin consensus rules enforced by all full nodes", "Whether governments can legally tax mining revenue without undermining network security as defined by Bitcoin consensus rules enforced by all full nodes", "Whether energy costs will eventually make proof-of-work mining economically impossible as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "What is the typical mining pool fee that pools charge for shared mining rewards?", a: "Around 1–2% of earned rewards", wrong: ["Around 5–10% of earned rewards", "Around 0.1–0.25% of earned rewards", "Around 3–5% of earned rewards"] },
        { q: "How does Bitcoin's difficulty adjustment maintain the ~10-minute block time?", a: "It recalibrates every 2,016 blocks to keep average block time near 10 minutes regardless of hashrate changes", wrong: ["It automatically throttles miners' submission rate if blocks are found faster than every 9 minutes", "It uses a rolling 144-block average to smoothly adjust the proof-of-work target every day as defined by Bitcoin consensus rules enforced by all full nodes", "It resets the target difficulty at each block based on the hash of the previous block header as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "Approximately how much energy does Bitcoin consume annually?", a: "About 150 TWh per year", wrong: ["About 50 TWh per year", "About 500 TWh per year", "About 1,000 TWh per year"] },
        { q: "What proportion of Bitcoin mining is estimated to use renewable energy sources?", a: "Over 50% is estimated to come from renewable sources", wrong: ["About 10–15% is estimated to come from renewable sources", "About 25–30% is estimated to come from renewable sources", "About 75–80% is estimated to come from renewable sources"] },
        { q: "Why do transaction fees become proportionally more important after each halving?", a: "The block subsidy is cut in half, so fees make up a larger share of total miner revenue", wrong: ["More transactions are broadcast after each halving due to increased Bitcoin adoption and price", "Mining difficulty resets after each halving, temporarily increasing the fee market competitiveness", "ASIC efficiency improvements slow after halvings, raising the cost basis miners must recover"] }
    ],
    "taproot_assets": [
        { q: "What company developed the Taproot Assets protocol?", a: "Lightning Labs", wrong: ["They can automatically convert local fiat currency to Bitcoin at the best available exchange rate with no fees", "They can access zero-fee remittance payment corridors by routing transactions through sovereign node operators", "They can participate in DeFi yield farming protocols directly without ever leaving the Bitcoin network layer"] },
        { q: "What was the original name of the Taproot Assets protocol before it was renamed?", a: "Taro", wrong: ["Omni", "Fabric", "Sapio"] },
        { q: "Where does the actual asset data live in the Taproot Assets protocol?", a: "Off-chain, with cryptographic proofs committed on-chain via Taproot", wrong: ["Fully on-chain inside OP_RETURN outputs attached to each UTXO", "In a federated sidechain pegged to the Bitcoin mainchain via a two-way peg", "Distributed across Lightning Network gossip messages anchored by node signatures"] },
        { q: "What Bitcoin upgrade was a technical prerequisite for the Taproot Assets protocol?", a: "Taproot (BIP341/342), which introduced MAST and tapscript commitment structures", wrong: ["SegWit (BIP141), which introduced the witness discount and fixed transaction malleability", "CheckSequenceVerify (BIP112), which introduced relative timelocks for channel safety", "P2SH (BIP16), which introduced hash-locked scripts and multi-signature spending conditions"] },
        { q: "What key benefit does Taproot Assets offer to users in high-inflation countries?", a: "They can hold USD-pegged stablecoins and transact over Lightning while inheriting Bitcoin's security", wrong: ["They can convert local currency to BTC automatically at the best available exchange rate", "They can access zero-fee remittance corridors by routing through sovereign node operators", "They can participate in DeFi yield protocols without leaving the Bitcoin network stack as defined by Bitcoin consensus rules enforced by all full nodes"] },
        { q: "When did Taproot Assets launch on Bitcoin mainnet?", a: "Late 2023", wrong: ["Early 2021, shortly after the Taproot soft fork activated", "Mid 2022, following a year-long testnet deployment by Lightning Labs", "Early 2024, alongside the Bitcoin halving block at height 840,000"] },
        { q: "How does edge routing work in a Taproot Assets Lightning payment?", a: "Intermediate routing nodes handle only BTC; the final recipient receives the Taproot Asset", wrong: ["Every routing node must hold the specific Taproot Asset being transferred along the path", "Taproot Asset payments are split into BTC-equivalent shards that each routing node recombines", "The sender converts the asset to BTC at the first hop and the receiver converts back at the last hop"] },
        { q: "How does Taproot Assets differ from Ethereum ERC-20 tokens?", a: "Taproot Assets inherit Bitcoin's security and require no separate smart contract execution environment", wrong: ["Taproot Assets use a layer-2 virtual machine that runs alongside the Bitcoin script interpreter", "Taproot Assets require validator nodes to stake BTC as a bond to attest to correct asset issuance", "Taproot Assets rely on zero-knowledge rollups posted to Bitcoin rather than on-chain contract state"] },
        { q: "What data structure does Taproot Assets use to commit asset state to Bitcoin?", a: "Merkle trees committed inside Taproot's MAST structure", wrong: ["Verkle trees embedded in the SegWit witness field of Bitcoin transactions", "Sparse Merkle tries anchored via OP_RETURN outputs to each Bitcoin block", "Patricia tries stored in Lightning channel state and settled during channel closure"] },
        { q: "What type of assets can be issued using the Taproot Assets protocol?", a: "Fixed-supply tokens, reissuable stablecoins, and other custom asset types", wrong: ["Only non-fungible tokens representing unique Bitcoin UTXOs with inscribed metadata", "Only fiat-pegged stablecoins backed by proof-of-reserve attestations from custodians", "Only wrapped versions of existing ERC-20 tokens bridged from Ethereum via atomic swaps"] }
    ],
    "op_codes_bitcoin": [
        { q: "What is the foundational opcode that verifies a digital signature in Bitcoin Script?", a: "OP_CHECKSIG", wrong: ["OP_VERIFY", "OP_EQUALVERIFY", "OP_HASH160"] },
        { q: "What Bitcoin scripting language property prevents infinite loops and ensures termination?", a: "Bitcoin Script is non-Turing-complete with no loops or recursion", wrong: ["Bitcoin Script has a hard gas limit that terminates execution after a fixed number of opcodes", "Bitcoin Script requires all scripts to be pre-registered in a whitelist of approved templates", "Bitcoin Script uses a time-boxed interpreter that terminates any script exceeding 10 milliseconds"] },
        { q: "What does OP_RETURN do in Bitcoin Script?", a: "Marks an output as permanently unspendable and allows arbitrary data to be embedded", wrong: ["Returns the top stack value to the calling script as an exit code for conditional branches", "Refunds the transaction fee to the sender if the script fails to execute successfully", "Terminates script execution early and marks the transaction as valid without further checks"] },
        { q: "What is OP_CHECKLOCKTIMEVERIFY (CLTV) commonly used for?", a: "Locking coins until a specified block height or Unix timestamp, used in Lightning HTLCs", wrong: ["Verifying that a transaction was signed before a certain block height to prevent replay attacks", "Checking whether a block timestamp is within a valid range to prevent time-warp exploits", "Requiring that spending transactions include a minimum number of confirmations before being valid"] },
        { q: "What is OP_CHECKSEQUENCEVERIFY (CSV) and how does it differ from CLTV?", a: "A relative timelock locking a coin for N blocks after the UTXO was created, unlike CLTV's absolute lock", wrong: ["An absolute timelock identical to CLTV but measured in seconds rather than block heights as defined by Bitcoin consensus rules enforced by all full nodes", "A relative fee check ensuring a transaction pays at least N satoshis per byte before being relayed", "A sequence number validator that confirms inputs are signed with the correct nSequence bitmask"] },
        { q: "Why was OP_CAT originally disabled in Bitcoin Script?", a: "Satoshi disabled it as a precaution against potential vulnerabilities and memory exhaustion attacks", wrong: ["Miners voted to disable it in 2011 to prevent concatenation-based denial-of-service on full nodes", "The BIP process rejected OP_CAT because it duplicated functionality already covered by OP_SUBSTR", "Core developers disabled it during the 2013 database fork to reduce script complexity mid-crisis"] },
        { q: "What capability would re-enabling OP_CAT provide to Bitcoin Script?", a: "Covenants, ZK proof verification on-chain, vaults, and expanded smart contract functionality", wrong: ["Turing-complete execution, allowing arbitrary programs to run inside Bitcoin transactions", "Native cross-chain atomic swaps without requiring hash time-locked contracts or pre-images", "Dynamic fee adjustment inside scripts, allowing self-amending transactions based on mempool state"] },
        { q: "What is BitVM and who proposed it?", a: "A system by Robin Linus enabling Turing-complete computation via optimistic execution and fraud proofs", wrong: ["A formal verification framework by Andrew Poelstra for proving Bitcoin script correctness at compile time", "A proposed opcode suite by Jeremy Rubin enabling covenants and recursive transaction templates natively", "A sidechain design by Adam Back using Bitcoin opcodes for confidential transaction verification"] },
        { q: "What does OP_VAULT (BIP345) enable for Bitcoin holders?", a: "Coin vaults with enforced withdrawal delays and a recovery path to thwart theft", wrong: ["Multi-party time-locked escrow contracts that release funds based on external oracle attestations", "Automatic re-locking of coins to a cold storage address if a spending transaction is unconfirmed", "Covenant-based inheritance schemes where heirs receive coins after a fixed block height delay"] },
        { q: "What is the Simplicity language and who developed it?", a: "A formally verifiable smart contract language for Bitcoin developed by Andrew Poelstra at Blockstream", wrong: ["A high-level scripting language for Bitcoin compiled to opcodes, developed by Robin Linus at BitVM Labs", "A zero-knowledge proof system for Bitcoin scripts created by Pieter Wuille at Chaincode Labs", "A stack-based Turing-complete language for Bitcoin sidechains designed by Gregory Maxwell at Blockstream"] }
    ],
    "bip_standards": [
        { q: "What does BIP stand for in Bitcoin development?", a: "Bitcoin Improvement Proposal", wrong: ["Bitcoin Integration Protocol", "Bitcoin Implementation Parameter", "Bitcoin Infrastructure Patch"] },
        { q: "What does BIP32 define?", a: "Hierarchical deterministic (HD) wallets that generate a full key tree from one master seed", wrong: ["The mnemonic seed phrase standard using a 2048-word wordlist for human-readable backups", "The derivation path format m/purpose'/coin'/account'/change/index for wallet compatibility", "The Pay-to-Script-Hash address format allowing complex redemption scripts to use short addresses"] },
        { q: "How many words are in a standard BIP39 mnemonic seed phrase?", a: "12 or 24 words drawn from a 2048-word wordlist", wrong: ["8 or 16 words drawn from a 4096-word phonetically distinct wordlist", "10 or 20 words drawn from a 1024-word wordlist filtered for international readability", "6 or 12 words drawn from a 512-word wordlist designed for maximum memorability"] },
        { q: "What unique property do BIP39 words share that aids disambiguation?", a: "The first 4 letters of each word are unique across the entire 2048-word wordlist", wrong: ["Each word contains exactly one vowel cluster, making audio transcription unambiguous", "No two words share more than two consecutive letters, preventing handwriting confusion", "Every word has a unique last two letters, enabling checksummed manual entry validation"] },
        { q: "What critical bug did BIP141 (SegWit) fix in the Bitcoin protocol?", a: "Transaction malleability, which had prevented safe construction of the Lightning Network", wrong: ["The block size limit bug that allowed miners to produce blocks larger than 1 MB without penalty", "The time-warp attack that allowed difficulty manipulation by lying about block timestamps", "The inflation bug that briefly allowed miners to create more coinbase outputs than permitted"] },
        { q: "What three major improvements did BIP341/342 (Taproot) introduce?", a: "Schnorr signatures, MAST (Merkelized Abstract Syntax Trees), and Tapscript", wrong: ["Bulletproofs, covenant opcodes, and cross-input signature aggregation for privacy", "Confidential transactions, threshold signatures, and probabilistic payment channels", "Adaptor signatures, recursive covenants, and scriptless script channel factories"] },
        { q: "What does BIP119 (CTV / CheckTemplateVerify) propose?", a: "A covenant opcode constraining how a coin can be spent to a set of pre-defined transaction templates", wrong: ["A threshold signature scheme allowing n-of-m signers to collaboratively authorize transactions", "A payment channel factory design enabling thousands of channels from a single on-chain transaction", "A fee estimation algorithm that pre-commits to a fee rate before mining to reduce fee sniping"] },
        { q: "What privacy mechanism does BIP47 (PayNym) provide?", a: "Payment codes letting senders derive unique per-payment addresses via ECDH without address reuse", wrong: ["CoinJoin coordination codes that allow trustless mixing of outputs across multiple participants", "Stealth addresses generated per-block so receivers never publish a static on-chain identifier", "Blind signature tokens allowing receivers to request payments without revealing their public key"] },
        { q: "How does BIP78 (PayJoin) disrupt blockchain surveillance?", a: "Sender and receiver both contribute inputs, breaking common chain analysis ownership heuristics", wrong: ["It replaces transaction IDs with unlinkable blinded identifiers stored in the witness field", "It batches multiple payments into one transaction with deliberately indistinguishable output values", "It routes payments through an intermediary node that reassembles split UTXOs before broadcast"] },
        { q: "What is the derivation path structure defined by BIP44?", a: "m/purpose'/coin'/account'/change/index", wrong: ["m/account'/coin'/purpose'/index/change", "m/index/change/account'/coin'/purpose'", "m/coin'/purpose'/change/account'/index"] }
    ]
    };
// ── STATIC QUEST INDEX ──────────────────────────────────────────────────────
// Each topic sliced into fixed 5-question parts. IDs are stable across sessions.
var STATIC_QUESTS = (function() {
    var list = [];
    Object.keys(QUESTION_BANK).forEach(function(key) {
        if (key === '_general') return;
        var arr = QUESTION_BANK[key];
        var parts = Math.floor(arr.length / 5);
        for (var p = 0; p < parts; p++) {
            var slice = arr.slice(p * 5, p * 5 + 5);
            list.push({
                id: 'q__' + key + '__' + (p + 1),
                topicKey: key,
                partNum: p + 1,
                totalParts: parts,
                questions: slice
            });
        }
    });
    return list;
})();


// Quest triggers: after visiting X channels
const QUEST_TRIGGERS = [5, 15, 25, 40, 60, 80, 100];
let currentQuest = null;
let isRetry = false;
let completedQuests = new Set();
let weeklyCompleted = [];
let visitedForQuest = [];
let questCount = 0;

// Helper to get ISO week key (e.g., "2026-W17")
function _getCurrentWeekKey(){
    var now = new Date();
    var onejan = new Date(now.getFullYear(),0,1);
    var dayOfYear = Math.floor((now - onejan) / 86400000) + 1;
    var week = Math.ceil((dayOfYear + onejan.getDay())/7);
    return now.getFullYear() + '-W' + week;
}

function _loadWeeklyCompleted(){
    var wk = safeJSON('btc_quest_week', {});
    var cur = _getCurrentWeekKey();
    if (wk.week !== cur) {
        wk = {week: cur, completed: []};
        localStorage.setItem('btc_quest_week', JSON.stringify(wk));
    }
    weeklyCompleted = wk.completed || [];
}

function _saveWeeklyCompleted(topicId){
    var wk = safeJSON('btc_quest_week', {});
    var cur = _getCurrentWeekKey();
    if (wk.week !== cur) wk = {week: cur, completed: []};
    if (!wk.completed) wk.completed = [];
    if (wk.completed.indexOf(topicId)===-1) wk.completed.push(topicId);
    localStorage.setItem('btc_quest_week', JSON.stringify(wk));
    weeklyCompleted = wk.completed;
}

function initQuests() {
    // Load previously visited channels from localStorage
    const visited = safeJSON('btc_visited_channels', []);
    visited.forEach(ch => {
        if (!visitedForQuest.includes(ch)) visitedForQuest.push(ch);
    });

    if (typeof auth !== 'undefined' && auth.currentUser) {
        loadCompletedQuests(auth.currentUser.uid);
        _loadWeeklyCompleted();
    } else {
        setTimeout(initQuests, 2000);
        return;
    }
}

// ── Daily Activity Tracking (Quiz + Trivia + Poll → SF point) ──
function _getDailyActivities() {
    var todayKey = (typeof getDailyKey === 'function' ? getDailyKey() : new Date().toISOString().split('T')[0]);
    var state = safeJSON('btc_daily_activities', {});
    if (state.date !== todayKey) state = { date: todayKey, quiz: false, trivia: false, poll: false, sfAwarded: false };
    return state;
}

function _markDailyActivity(type) {
    var state = _getDailyActivities();
    state[type] = true;
    localStorage.setItem('btc_daily_activities', JSON.stringify(state));
}

function _checkDailyAllThree() {
    var state = _getDailyActivities();
    if (!(state.quiz && state.trivia && state.poll)) return;
    if (state.sfAwarded) return; // already triggered this session

    state.sfAwarded = true;
    localStorage.setItem('btc_daily_activities', JSON.stringify(state));

    // ── Immediate announcement in the News tab ──
    // Fires right away, independent of the SF CF call.
    // Uses a short delay (1s) so local state settles and global-chat is ready.
    setTimeout(function() {
        var username = (typeof currentUser !== 'undefined' && currentUser && currentUser.username)
            ? currentUser.username : null;
        if (username && typeof window.nachoGlobalAnnounce === 'function') {
            window.nachoGlobalAnnounce(
                '\uD83E\uDD8C @' + username + ' crushed the daily trifecta \u2014 quiz, trivia & poll! +1 SF point \uD83C\uDFC6 \u27A1\uFE0F [Quest Hub](#quests)',
                (typeof auth !== 'undefined' && auth && auth.currentUser) ? auth.currentUser.uid : ''
            );
        }
    }, 1000);

    // Award 1 orange ticket for completing the Daily Trifecta
    setTimeout(function() {
        if (typeof awardTickets === 'function') {
            awardTickets(1, '🎯 Daily Trifecta');
        }
    }, 500);

    // Track cumulative daily triple completions
    if (typeof db !== 'undefined' && typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) {
        db.collection('users').doc(auth.currentUser.uid).update({
            dailyTripleCount: firebase.firestore.FieldValue.increment(1)
        }).catch(function() {});
    }

    // ── SF point contribution (background, retried) ──
    // Wait for gradeQuest + awardPoints CF writes to fully commit before
    // contributeFavor reads daily_action_counts to validate all three docs exist.
    // 8s gives CF writes more breathing room; retries handle remaining lag.
    setTimeout(function() {
        _triggerDailyAllThreeSF(0);
    }, 8000);
}

function _triggerDailyAllThreeSF(attempt) {
    if (typeof window.contributeSatoshiFavor !== 'function') {
        // satoshi-favor.js not loaded yet — retry up to 5x with 2s gap
        if (attempt < 5) setTimeout(function() { _triggerDailyAllThreeSF(attempt + 1); }, 2000);
        return;
    }
    window.contributeSatoshiFavor('daily_all_three').then(function(data) {
        if (data) console.log('[DAILY] SF point awarded:', data);
    }).catch(function(err) {
        var code = err && err.code;
        var msg  = err && (err.message || String(err));
        console.warn('[DAILY] contributeSatoshiFavor failed (attempt ' + attempt + '):', msg);
        // already-exists = dedup already recorded, silent success
        if (code === 'already-exists') return;
        // Retry on: docs not written yet (failed-precondition) or transient read error (internal)
        var shouldRetry = (code === 'failed-precondition' || code === 'internal') && attempt < 8;
        if (shouldRetry) {
            var delayMs = attempt < 3 ? 4000 : 8000;
            console.log('[DAILY] Retrying SF in ' + (delayMs/1000) + 's (attempt ' + (attempt + 1) + '/8)...');
            setTimeout(function() { _triggerDailyAllThreeSF(attempt + 1); }, delayMs);
            return;
        }
        // Only show error toast after all retries exhausted
        if (attempt >= 8 && typeof showToast === 'function') showToast('⚠️ Daily triple not counted — please try again later', 5000);
    });
}

async function loadCompletedQuests(uid) {
    if (!db) return;
    try {
        const doc = await db.collection('users').doc(uid).get();
        if (doc.exists && doc.data().completedQuests) {
            doc.data().completedQuests.forEach(q => completedQuests.add(q));
            questCount = completedQuests.size;
        }
    } catch(e) {}
}

// Called from onChannelOpen in ranking.js
function onChannelVisitForQuest(channelId) {
    if (!visitedForQuest.includes(channelId)) {
        visitedForQuest.push(channelId);
    }

    // Check if we hit a trigger threshold
    const visited = visitedForQuest.length;
    for (const trigger of QUEST_TRIGGERS) {
        if (visited === trigger && !currentQuest) {
            setTimeout(() => {
                if (typeof showToast === 'function') showToast('⚡ You have explored ' + trigger + ' channels! A Quest is ready!');
                setTimeout(() => generateAndShowQuest(), 3000);
            }, 2000);
            break;
        }
    }
}

function generateAndShowQuest(manual, targetChannelId, isRetake) {
    // Limit quests to 1 per day - but allow retakes for non-perfect scores
    var today = (typeof getDailyKey === 'function' ? getDailyKey() : new Date().toISOString().split('T')[0]);
    var questLog = safeJSON('btc_quest_daily', {});
    if (questLog.date !== today) {
        questLog = { date: today, count: 0 };
    }
    if (questLog.count >= 1 && !isRetake) {
        if (manual && typeof showToast === 'function') showToast('⏰ You\'ve completed your daily quiz! Go to Quiz Quests to retake it for a perfect score.');
        return;
    }

    // Track previously asked questions to avoid repeats
    const askedQuestions = safeJSON('btc_asked_questions', []);

    // Collect available questions
    let pool = [];

    // Check if this is a static quest (topicKey||partNum format from picker)
    var _staticQuest = null;
    var _actualTopicKey = targetChannelId;
    if (targetChannelId && targetChannelId.indexOf('||') !== -1) {
        var _parts = targetChannelId.split('||');
        _actualTopicKey = _parts[0];
        var _partNum = parseInt(_parts[1]) - 1; // 0-based
        _staticQuest = STATIC_QUESTS.find(function(sq) {
            return sq.topicKey === _actualTopicKey && sq.partNum === parseInt(_parts[1]);
        });
        if (_staticQuest) {
            // Use the fixed slice directly — skip pool building entirely
            var _staticQuestId = 'q__' + _actualTopicKey + '__' + _parts[1];
            if (completedQuests.has(_staticQuestId)) {
                if (manual && typeof showToast === 'function') showToast('✅ You already aced ' + _actualTopicKey.replace(/[-_]+/g, ' ') + ' Part ' + _parts[1] + ' with a perfect score!');
                return;
            }
            var _staticSelected = _staticQuest.questions.map(function(q) {
                var opts = [q.a, ...q.wrong].sort(() => Math.random() - 0.5);
                return { q: q.q, options: opts, answer: opts.indexOf(q.a) };
            });
            currentQuest = { id: _staticQuestId, topicKey: _actualTopicKey, partNum: parseInt(_parts[1]), totalParts: _staticQuest.totalParts, title: _getStaticQuestTitle(_actualTopicKey, parseInt(_parts[1]), _staticQuest.totalParts), questions: _staticSelected };
            window._currentQuestServerId = null;
            window._currentQuestServerIdPromise = null;
            if (typeof firebase !== 'undefined' && firebase.functions) {
                window._currentQuestServerIdPromise = firebase.functions().httpsCallable('startQuest')({ questions: _staticSelected.map(function(q) { return { answer: q.answer }; }), topicKey: _actualTopicKey }).then(function(res) { window._currentQuestServerId = res.data.questId; return res.data.questId; }).catch(function(e) { console.warn('Quest registration failed:', e); return null; });
            }
            showQuest(currentQuest, false);
            return;
        }
    }
    // If a specific topic was selected from the picker (channel-visit auto-trigger), ONLY use that topic's questions
    if (_actualTopicKey && QUESTION_BANK[_actualTopicKey]) {
        QUESTION_BANK[_actualTopicKey].forEach(q => pool.push({...q, source: _actualTopicKey}));
    }

    // Only mix in other sources if no specific topic was selected
    if (!targetChannelId) {
        // Visited channels
        for (const chId of visitedForQuest) {
            const questions = QUESTION_BANK[chId];
            if (questions) {
                questions.forEach(q => pool.push({...q, source: chId}));
            }
        }

        // Always include general knowledge questions
        if (QUESTION_BANK['_general']) {
            QUESTION_BANK['_general'].forEach(q => pool.push({...q, source: '_general'}));
        }

        if (pool.length < 5) {
            for (const [chId, questions] of Object.entries(QUESTION_BANK)) {
                questions.forEach(q => {
                    if (!pool.some(p => p.q === q.q)) {
                        pool.push({...q, source: chId});
                    }
                });
                if (pool.length >= 10) break;
            }
        }
    }

    // For topic-specific quests, allow fewer than 5 if the topic has fewer questions
    var minQuestions = targetChannelId ? Math.min(3, pool.length) : 5;
    if (pool.length < minQuestions) return;

    // Filter out already-asked questions first
    let freshPool = pool.filter(q => !askedQuestions.includes(q.q));

    // If we've asked most questions, reset the tracker
    if (freshPool.length < 5) {
        localStorage.setItem('btc_asked_questions', '[]');
        freshPool = pool;
    }

    // Shuffle
    freshPool.sort(() => Math.random() - 0.5);

    // Deduplicate by topic - extract key words and prevent similar questions in same quest
    function getTopicKey(q) {
        var text = q.q.toLowerCase();
        // Match specific known topics
        var topics = [
            [/nostr/i, 'nostr'], [/lightning/i, 'lightning'], [/halving/i, 'halving'],
            [/mining/i, 'mining'], [/node/i, 'node'], [/wallet/i, 'wallet'],
            [/seed.?phrase/i, 'seed'], [/private.?key/i, 'privkey'], [/satoshi/i, 'satoshi'],
            [/block.?chain/i, 'blockchain'], [/proof.?of.?work/i, 'pow'], [/fud\b/i, 'fud'],
            [/self.?custody/i, 'custody'], [/etf/i, 'etf'], [/taproot/i, 'taproot'],
            [/difficulty/i, 'difficulty'], [/mempool/i, 'mempool'], [/hash.?rate/i, 'hashrate'],
            [/white.?paper/i, 'whitepaper'], [/21.?million/i, '21m'], [/inflation/i, 'inflation'],
            [/kyc/i, 'kyc'], [/privacy/i, 'privacy'], [/multisig/i, 'multisig'],
            [/dca|dollar.cost/i, 'dca'], [/el.?salvador/i, 'elsalvador'],
        ];
        for (var i = 0; i < topics.length; i++) {
            if (topics[i][0].test(text)) return topics[i][1];
        }
        // Fallback: use first 3 significant words
        return text.replace(/\b(what|which|how|who|when|where|why|is|are|was|the|a|an|of|in|for|to|does|do|can|has|it)\b/g, '').trim().split(/\s+/).slice(0, 3).join('_');
    }

    var maxQ = targetChannelId ? Math.min(freshPool.length, 5) : 5;
    var selected = [];
    var usedTopics = {};

    // For topic-specific quests, skip topic dedup (all questions ARE the same topic)
    if (targetChannelId) {
        for (var si = 0; si < freshPool.length && selected.length < maxQ; si++) {
            selected.push(freshPool[si]);
        }
    } else {
        for (var si = 0; si < freshPool.length && selected.length < maxQ; si++) {
            var topic = getTopicKey(freshPool[si]);
            if (usedTopics[topic]) continue;
            usedTopics[topic] = true;
            selected.push(freshPool[si]);
        }

        // If dedup was too aggressive, fill remaining from unused pool
        if (selected.length < maxQ) {
            for (var fi = 0; fi < freshPool.length && selected.length < maxQ; fi++) {
                if (selected.indexOf(freshPool[fi]) === -1) selected.push(freshPool[fi]);
            }
        }
    }

    // Use topic-based ID so perfect scores are tracked per topic
    var questId = _actualTopicKey ? ('quest_' + _actualTopicKey) : ('quest_dynamic_' + questCount);
    // Block retake if user already got a perfect 5/5 on this topic
    if (_actualTopicKey && completedQuests.has(questId)) {
        if (typeof showToast === 'function') showToast('\u2705 You already aced ' + _actualTopicKey.replace(/[-_]+/g, ' ') + ' with a perfect score!');
        return;
    }
    if (!_actualTopicKey && completedQuests.has(questId)) return;

    // Track these questions as asked
    const newAsked = [...askedQuestions, ...selected.map(q => q.q)];
    localStorage.setItem('btc_asked_questions', JSON.stringify(newAsked));

    // Build multiple choice format
    const questions = selected.map(q => {
        const options = [q.a, ...q.wrong].sort(() => Math.random() - 0.5);
        const correctIdx = options.indexOf(q.a);
        return { q: q.q, options, answer: correctIdx };
    });

    currentQuest = { id: questId, topicKey: _actualTopicKey || null, title: getQuestTitle(questCount, _actualTopicKey), questions };

    // Register quest server-side for secure grading
    // Store the promise so submitQuest can await it if the user finishes quickly
    window._currentQuestServerId = null;
    window._currentQuestServerIdPromise = null;
    if (typeof firebase !== 'undefined' && firebase.functions) {
        window._currentQuestServerIdPromise = firebase.functions().httpsCallable('startQuest')({
            questions: questions.map(function(q) { return { answer: q.answer }; }),
            topicKey: targetChannelId || null
        }).then(function(res) {
            window._currentQuestServerId = res.data.questId;
            return res.data.questId;
        }).catch(function(e) { console.warn('Quest registration failed:', e); return null; });
    }

    showQuest(currentQuest, false);
}

function _getStaticQuestTitle(topicKey, partNum, totalParts) {
    var topicEmojis = {
        'mining': '⛏️', 'nodes': '🖥️', 'privacy-nonkyc': '🕵️', 'problems-of-money': '💸',
        'layer-2-lightning': '⚡', 'self-custody': '🔑', 'halving': '📉', 'history': '📜',
        'whitepaper': '📄', 'money': '💰', 'scarce': '💎', 'secure': '🛡️', 'decentralized': '🌍',
        'programmable': '💻', 'dominant': '👑', 'energy': '🔋', 'cryptography': '🔐',
        'pow-vs-pos': '⚔️', 'blockchain-timechain': '⛓️', 'books': '📚', 'cbdc': '🏦',
        'cypherpunks': '🏴', 'mtgox': '💀', 'block_size_wars': '⚔️', 'evidence-against-alts': '⚠️',
        'austrian_economics': '📐', 'gold_standard_history': '🥇', 'bitcoin_vs_real_estate': '🏠',
        'satoshi_nakamoto_deep': '🧩', 'mining_hardware': '🖥️', 'mining_economics': '💹',
        'taproot_assets': '🌳', 'op_codes_bitcoin': '⚙️', 'bip_standards': '📋',
        'human_rights_deep': '✊', 'books_deep': '📚', 'consensus': '🤝', 'regulation': '⚖️',
        'maximalism': '🔥', 'nostr': '🟣', 'investment-strategy': '📊', 'philosophy': '🤔',
        'taproot': '🌳', 'fedimints': '🏛️', 'softwar': '🪖', 'time_preference': '⏳',
        'governance': '🏛️', 'misconceptions-fud': '🚫', 'elevator_pitches': '🗣️'
    };
    var emoji = topicEmojis[topicKey] || '📖';
    var label = topicKey.replace(/[-_]+/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    var suffix = totalParts > 1 ? ' — Part ' + partNum : '';
    return emoji + ' ' + label + suffix;
}

function getQuestTitle(num, topicKey) {
    // If a specific topic was selected, use its name in the title
    if (topicKey && topicKey !== '_general') {
        var topicEmojis = {
            'mining': '⛏️', 'nodes': '🖥️', 'privacy-nonkyc': '🕵️', 'problems-of-money': '💸',
            'layer-2-lightning': '⚡', 'self-custody': '🔑', 'halving': '📉', 'history': '📜',
            'whitepaper': '📄', 'money': '💰', 'scarce': '💎', 'secure': '🛡️', 'decentralized': '🌍',
            'programmable': '💻', 'dominant': '👑', 'energy': '🔋', 'cryptography': '🔐',
            'consensus': '🤝', 'regulation': '⚖️', 'maximalism': '🔥', 'difficulty-adjustment': '🎯',
            'books': '📚', 'nostr': '🟣', 'use-cases': '🛠️', 'investment-strategy': '📊',
            'smart-contracts': '📝', 'blockchain-timechain': '⛓️', 'pow-vs-pos': '⚔️',
            'evidence-against-alts': '⚠️', 'organic': '🌳', 'peaceful': '☮️', 'supranational': '🔔'
        };
        var baseKey = topicKey.replace(/_pt\d+$/, '');
        var emoji = topicEmojis[topicKey] || topicEmojis[baseKey] || '⚡';
        var label = topicKey.replace(/_pt(\d+)$/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
        var ptMatch = topicKey.match(/_pt(\d+)$/);
        if (ptMatch) label += ' (Part ' + ptMatch[1] + ')';
        return emoji + ' ' + label + ' Quest';
    }
    const titles = [
        '₿ Bitcoin Basics Quest',
        '⚡ Lightning Learner Quest',
        '🔒 Security Scholar Quest',
        '💰 Economics Expert Quest',
        '⛓ Technical Titan Quest',
        '🟠 Culture Connoisseur Quest',
        '🛡️ Sovereignty Sage Quest',
        '👑 Satoshi Scholar Quest',
    ];
    return titles[num % titles.length];
}

function playWarriorDrum() {
    if (typeof canPlaySound === 'function' && !canPlaySound()) return;
    if (typeof audioEnabled !== 'undefined' && !audioEnabled) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const vol = typeof audioVolume !== 'undefined' ? audioVolume : 0.5;
        const now = ctx.currentTime;

        function gorillaHit(time) {
            // Impact tone - sharp attack at 150Hz dropping to 60Hz
            const osc1 = ctx.createOscillator();
            const g1 = ctx.createGain();
            osc1.connect(g1); g1.connect(ctx.destination);
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(150, now + time);
            osc1.frequency.exponentialRampToValueAtTime(60, now + time + 0.15);
            g1.gain.setValueAtTime(0.7 * vol, now + time);
            g1.gain.exponentialRampToValueAtTime(0.001, now + time + 0.4);
            osc1.start(now + time); osc1.stop(now + time + 0.4);

            // Drum body resonance - 80Hz sustained thump
            const osc2 = ctx.createOscillator();
            const g2 = ctx.createGain();
            osc2.connect(g2); g2.connect(ctx.destination);
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(80, now + time);
            osc2.frequency.exponentialRampToValueAtTime(50, now + time + 0.3);
            g2.gain.setValueAtTime(0.5 * vol, now + time);
            g2.gain.exponentialRampToValueAtTime(0.001, now + time + 0.5);
            osc2.start(now + time); osc2.stop(now + time + 0.5);

            // Skin slap - short burst of low-pass noise
            const len = Math.floor(ctx.sampleRate * 0.08);
            const buf = ctx.createBuffer(1, len, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let j = 0; j < len; j++) data[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / len, 2);
            const noise = ctx.createBufferSource();
            const ng = ctx.createGain();
            const filt = ctx.createBiquadFilter();
            noise.buffer = buf;
            filt.type = 'lowpass';
            filt.frequency.value = 800;
            noise.connect(filt); filt.connect(ng); ng.connect(ctx.destination);
            ng.gain.setValueAtTime(0.4 * vol, now + time);
            ng.gain.exponentialRampToValueAtTime(0.001, now + time + 0.1);
            noise.start(now + time);
        }

        // Three identical gorilla war pounds
        gorillaHit(0);
        gorillaHit(0.4);
        gorillaHit(0.8);
    } catch(e) {}
}

function showQuest(quest, retry) {
    currentQuest = quest;
    isRetry = retry;
    window._questSubmitted = false;
    playWarriorDrum();

    const modal = document.getElementById('questModal');
    const inner = document.getElementById('questInner');

    let html = '<div class="quest-header">';
    html += '<div class="quest-badge">⚡ QUEST</div>';
    html += '<h2>' + quest.title + '</h2>';
    html += '<p>' + (retry ? 'Retry! Get 3+ correct for 25 XP!' : 'Answer 5 questions. 3+ correct = 50 XP. All 5 = 100 XP!') + '</p>';
    html += '</div>';
    html += '<div class="quest-questions">';

    quest.questions.forEach((q, i) => {
        var hintTokens = typeof currentUser !== 'undefined' && currentUser ? (currentUser.hintTokens || 0) : 0;
        html += '<div class="quest-q" id="questQ_'+i+'">';
        html += '<div class="quest-q-num">Question ' + (i + 1) + ' of 5';
        if (hintTokens > 0) {
            html += ' <button id="hintBtn_'+i+'" onclick="_useQuestHint('+i+')" style="float:right;padding:3px 10px;background:rgba(234,179,8,0.15);border:1px solid #eab308;border-radius:6px;color:#eab308;font-size:0.7rem;font-weight:700;cursor:pointer;font-family:inherit;">💡 Hint (' + hintTokens + ')</button>';
        }
        html += '</div>';
        html += '<div class="quest-q-text">' + q.q + '</div>';
        html += '<div class="quest-options" id="questOpts_'+i+'">';
        q.options.forEach((opt, j) => {
            html += '<button class="quest-opt" id="questOpt_'+i+'_'+j+'" onclick="selectAnswer(this,' + i + ',' + j + ')">' + opt + '</button>';
        });
        html += '</div></div>';
    });

    html += '</div>';
    html += '<button class="quest-submit" id="questSubmitBtn" onclick="submitQuest()" disabled>Submit Answers</button>';
    html += '<button class="quest-skip" onclick="skipQuest()">Skip for now</button>';

    inner.innerHTML = html;
    modal.classList.add('open');

    window._questAnswers = new Array(5).fill(-1);
    window._questCorrect = quest.questions.map(q => q.answer);
}

function selectAnswer(btn, qIdx, aIdx) {
    const siblings = btn.parentElement.querySelectorAll('.quest-opt');
    siblings.forEach(s => s.classList.remove('selected'));
    btn.classList.add('selected');
    window._questAnswers[qIdx] = aIdx;

    if (window._questAnswers.every(a => a >= 0)) {
        document.getElementById('questSubmitBtn').disabled = false;
    }
}

window._useQuestHint = function(qIdx) {
    if (!currentQuest || !currentQuest.questions) return;
    var q = currentQuest.questions[qIdx];
    if (!q) return;

    // Find the correct answer index
    var correctIdx = q.answer;

    // Gather wrong answer indices that aren't yet eliminated
    var optsEl = document.getElementById('questOpts_' + qIdx);
    if (!optsEl) return;
    var allBtns = optsEl.querySelectorAll('.quest-opt');
    var wrongBtns = [];
    allBtns.forEach(function(btn, j) {
        if (j !== correctIdx && !btn.disabled && btn.style.opacity !== '0.2') {
            wrongBtns.push({ btn: btn, idx: j });
        }
    });

    if (wrongBtns.length === 0) {
        if (typeof showToast === 'function') showToast('💡 Hint already used for this question!');
        return;
    }

    // Hide hint button immediately (optimistic)
    var hintBtn = document.getElementById('hintBtn_' + qIdx);
    if (hintBtn) {
        hintBtn.disabled = true;
        hintBtn.textContent = '⏳';
    }

    // Call CF to decrement server-side token
    var fn = typeof firebase !== 'undefined' ? firebase.functions().httpsCallable('useHintToken') : null;
    if (fn) {
        fn({}).then(function(r) {
            var d = r.data;
            if (d && d.success) {
                if (typeof currentUser !== 'undefined' && currentUser) {
                    currentUser.hintTokens = d.hintTokens;
                }
                // Eliminate one random wrong answer
                var target = wrongBtns[Math.floor(Math.random() * wrongBtns.length)];
                target.btn.style.opacity = '0.2';
                target.btn.style.textDecoration = 'line-through';
                target.btn.style.pointerEvents = 'none';
                if (hintBtn) hintBtn.remove();
                if (typeof showToast === 'function') showToast('💡 Hint used! One wrong answer eliminated. (' + d.hintTokens + ' remaining)');
            }
        }).catch(function(err) {
            var msg = (err && err.message) ? err.message : 'Hint failed';
            if (typeof showToast === 'function') showToast('❌ ' + msg);
            if (hintBtn) { hintBtn.disabled = false; hintBtn.textContent = '💡 Hint (' + ((currentUser && currentUser.hintTokens) || 0) + ')'; }
        });
    } else {
        // No CF available — local only fallback
        var target = wrongBtns[Math.floor(Math.random() * wrongBtns.length)];
        target.btn.style.opacity = '0.2';
        target.btn.style.textDecoration = 'line-through';
        target.btn.style.pointerEvents = 'none';
        if (hintBtn) hintBtn.remove();
    }
};

async function submitQuest() {
    // Prevent double-submit
    if (window._questSubmitted) return;
    window._questSubmitted = true;
    var btn = document.getElementById('questSubmitBtn');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; btn.textContent = 'Grading...'; }

    const answers = window._questAnswers;
    const correct = window._questCorrect;
    let score = 0;
    let pts = 0;

    // Grade server-side if registered.
    // If startQuest hasn't resolved yet (fast user), await the pending promise first.
    if (!window._currentQuestServerId && window._currentQuestServerIdPromise) {
        try { await window._currentQuestServerIdPromise; } catch(e) {}
    }
    if (window._currentQuestServerId && typeof firebase !== 'undefined' && firebase.functions) {
        try {
            var gradeResult = await firebase.functions().httpsCallable('gradeQuest')({
                questId: window._currentQuestServerId,
                answers: answers,
                isRetry: !!isRetry
            });
            score = gradeResult.data.score;
            pts = gradeResult.data.pts;
        } catch(e) {
            console.error('Server quest grading failed, falling back:', e);
            answers.forEach((a, i) => { if (a === correct[i]) score++; });
        }
    } else {
        // Fallback for offline
        answers.forEach((a, i) => { if (a === correct[i]) score++; });
    }

    // Highlight correct/wrong
    const questions = document.querySelectorAll('.quest-q');
    questions.forEach((q, i) => {
        const opts = q.querySelectorAll('.quest-opt');
        opts.forEach((opt, j) => {
            opt.disabled = true;
            if (j === correct[i]) opt.classList.add('correct');
            if (j === answers[i] && j !== correct[i]) opt.classList.add('wrong');
        });
    });

    let msg = '';
    var isPerfect = score === 5;
    var isTopicQuest = !!(currentQuest.topicKey);
    if (isRetry) {
        if (score >= 3) {
            if (!pts) pts = 25;
            msg = '🎉 ' + score + '/5 correct on retry! +' + pts + ' XP!';
            // Only permanently lock on perfect 5/5 for topic quests
            if (isPerfect || !isTopicQuest) {
                completedQuests.add(currentQuest.id);
            }
            questCount++;
        } else {
            msg = '😅 ' + score + '/5 - Better luck next time! Keep reading and try again.';
        }
    } else {
        if (isPerfect) {
            if (!pts) pts = 100;
            msg = '🏆 PERFECT! 5/5! +' + pts + ' XP!';
            completedQuests.add(currentQuest.id);
            questCount++;
            // Nacho celebrates perfect scores in global chat
            if (typeof window.nachoGlobalAnnounce === 'function' && typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) {
                var _pqName = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) || (auth.currentUser.displayName) || 'A mystery Bitcoiner';
                var _pqTopic = currentQuest.title || 'a Quiz Quest';
                window.nachoGlobalAnnounce('🏆 @' + _pqName + ' just aced ' + _pqTopic + ' with a PERFECT 5/5! Think you can do the same? ➡️ [Quest Hub](#quests)', auth.currentUser.uid);
            }
        } else if (score >= 3) {
            if (!pts) pts = 50;
            msg = '🎉 ' + score + '/5 correct! +' + pts + ' XP!';
            // Non-perfect: award XP but DON'T lock topic quest (allow retake for 5/5)
            if (!isTopicQuest) {
                completedQuests.add(currentQuest.id);
            }
            questCount++;
        } else {
            msg = '😅 ' + score + '/5 - You can retry for 25 XP!';
        }
    }

    // Always log quiz attempt (regardless of score), so "completions today" reflects actual attempts
    var todayQ = (typeof getDailyKey === 'function' ? getDailyKey() : new Date().toISOString().split('T')[0]);
    var qLog = safeJSON('btc_quest_daily', {});
    if (qLog.date !== todayQ) qLog = { date: todayQ, count: 0 };
    qLog.count++;
    qLog.lastScore = score;
    qLog.lastTopic = currentQuest.topicKey || null;
    qLog.lastTitle = currentQuest.title || null;
    localStorage.setItem('btc_quest_daily', JSON.stringify(qLog));

    if (pts > 0) {
        // Points already awarded server-side by gradeQuest
        if (typeof notifySelfQuest === 'function') notifySelfQuest(currentQuest.title);
        // Log to local XP history for the Points notification tab
        if (typeof notifySelfPoints === 'function') notifySelfPoints(pts, '🏆 Quest: ' + (currentQuest.title || 'Quest'));
        // Raid Boss: quiz completion
        if (typeof window._raidOnQuizComplete === 'function') window._raidOnQuizComplete();
        if (typeof window._raidOnXPEarned === 'function') window._raidOnXPEarned(pts);

        // Mark quiz done for the day and check if all 3 daily activities complete
        _markDailyActivity('quiz');
        _checkDailyAllThree();
        // Signal onboarding quest step 4 (quiz completion)
        try { localStorage.setItem('onboarding_quiz_done', '1'); } catch(e) {}
        try { window.dispatchEvent(new CustomEvent('onboarding_quiz_done')); } catch(e) {}
        // Weekly community challenge: increment quiz_completions
        if (typeof firebase !== 'undefined' && firebase.functions && typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) {
            try {
                firebase.functions().httpsCallable('incrementWeeklyChallenge')({ goalType: 'quiz_completions' }).catch(function() {});
            } catch(e) {}
        }

        if (typeof db !== 'undefined' && typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) {
            db.collection('users').doc(auth.currentUser.uid).update({
                questsCompletedToday: (qLog.count || 0),
                lastQuestDate: todayQ
            }).catch(function(e) { console.error('Quest sync failed:', e); });
        }
    }
    try {
        if (completedQuests.has(currentQuest.id) && typeof db !== 'undefined' && typeof auth !== 'undefined' && auth && auth.currentUser) {
            await db.collection('users').doc(auth.currentUser.uid).update({
                completedQuests: firebase.firestore.FieldValue.arrayUnion(currentQuest.id)
            });
            // Increment global quest completion counter
            db.collection('stats').doc('global').set({
                questsCompleted: firebase.firestore.FieldValue.increment(1)
            }, { merge: true }).catch(function() {});
        }
    } catch(e) { console.error('Quest completion sync failed:', e); }

    // Hide submit and skip buttons
    const submitBtn = document.getElementById('questSubmitBtn');
    if (submitBtn) submitBtn.style.display = 'none';
    const skipBtn = document.querySelector('.quest-skip');
    if (skipBtn) skipBtn.style.display = 'none';

    // Store results for the "See Results" screen
    window._questScore = score;
    window._questMsg = msg;
    window._questPts = pts;

    // Update header to show score summary + Review Your Answers prompt
    const header = document.querySelector('.quest-header');
    if (header) {
        header.innerHTML = '<div class="quest-badge">⚡ QUEST COMPLETE</div>' +
            '<h2>' + currentQuest.title + '</h2>' +
            '<div style="font-size:2.5rem;margin:12px 0;">' + (score === 5 ? '🏆' : score >= 3 ? '🎉' : '😅') + '</div>' +
            '<div style="font-size:1.5rem;font-weight:900;color:var(--heading);margin-bottom:4px;">' + score + ' / 5 Correct</div>' +
            '<div style="font-size:0.95rem;color:var(--text-muted);margin-bottom:16px;">Review your answers below - <span style="color:#22c55e;font-weight:700;">green</span> is correct, <span style="color:#ef4444;font-weight:700;">red</span> is wrong</div>' +
            '<button class="quest-done" onclick="showQuestFinalResults()" style="margin-bottom:8px;">Show What You\'ve Earned! →</button>';
    }

    // Scroll modal to top so user sees the results
    const inner = document.getElementById('questInner');
    if (inner) inner.scrollTo({ top: 0, behavior: 'smooth' });

    // Also show a quick results toast for visibility
    if (typeof showToast === 'function') showToast(msg);
}

function playHooraySound() {
    if (typeof canPlaySound === 'function' && !canPlaySound()) return;
    if (typeof audioEnabled !== 'undefined' && !audioEnabled) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const vol = typeof audioVolume !== 'undefined' ? audioVolume : 0.5;
        const now = ctx.currentTime;

        // Rising major chord arpeggio: C5 → E5 → G5 → C6
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.connect(g); g.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            g.gain.setValueAtTime(0.15 * vol, now + i * 0.1);
            g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.4);
            osc.start(now + i * 0.1); osc.stop(now + i * 0.1 + 0.4);

            // Bright shimmer layer
            const osc2 = ctx.createOscillator();
            const g2 = ctx.createGain();
            osc2.connect(g2); g2.connect(ctx.destination);
            osc2.type = 'triangle';
            osc2.frequency.value = freq * 2;
            g2.gain.setValueAtTime(0.06 * vol, now + i * 0.1);
            g2.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
            osc2.start(now + i * 0.1); osc2.stop(now + i * 0.1 + 0.3);
        });

        // Final sustained major chord - the hooray moment
        [1047, 1319, 1568].forEach((freq) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.connect(g); g.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            g.gain.setValueAtTime(0.12 * vol, now + 0.45);
            g.gain.linearRampToValueAtTime(0.1 * vol, now + 0.7);
            g.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
            osc.start(now + 0.45); osc.stop(now + 1.3);
        });
    } catch(e) {}
}

// ── Topic recommendation mapping ──
// Maps quest topicKeys to CHANNELS keys for the "study more" recommendation.
// Handles _ptN suffixes, alternate naming, and fallbacks for orphan topics.
function _resolveQuestChannel(topicKey) {
    if (!topicKey || typeof CHANNELS === 'undefined') return null;

    // Direct match
    if (CHANNELS[topicKey]) return topicKey;

    // Strip _ptN suffix and try base key
    var base = topicKey.replace(/_pt\d+$/, '');
    if (CHANNELS[base]) return base;

    // Manual mapping for orphan quest topics
    var ORPHAN_MAP = {
        'cycles':               'cyles',                              // typo in channel_index
        'dlcs':                 'discrete_log_contracts__dlcs',
        'first_principles':     '1_first_principles',
        'foss':                 'free_and_open_source_software__foss',
        'ordinals_inscriptions':'ordinals',
        'spv':                  'simplified_payment_verification__spv',
        'halving':              'scarce',                             // scarcity / supply schedule
        'el-salvador':          'regulation'                          // nation-state adoption / policy
    };
    if (ORPHAN_MAP[topicKey] && CHANNELS[ORPHAN_MAP[topicKey]]) return ORPHAN_MAP[topicKey];
    if (ORPHAN_MAP[base] && CHANNELS[ORPHAN_MAP[base]]) return ORPHAN_MAP[base];

    // Last resort: pick a random popular channel so there's always a recommendation
    var fallbacks = ['history','mining','layer-2-lightning','self-custody','problems-of-money','whitepaper'];
    for (var i = 0; i < fallbacks.length; i++) {
        if (CHANNELS[fallbacks[i]]) return fallbacks[i];
    }
    return null;
}

function showQuestFinalResults() {
    const score = window._questScore;
    const msg = window._questMsg;
    const pts = window._questPts;

    // Play hooray sound if they passed
    if (score >= 3) playHooraySound();

    // Hide the questions
    const questionsDiv = document.querySelector('.quest-questions');
    if (questionsDiv) questionsDiv.style.display = 'none';

    // Resolve a topic to recommend (for null/general quests, pick a random popular topic)
    var recChannel = _resolveQuestChannel(currentQuest ? currentQuest.topicKey : null);
    if (!recChannel && typeof CHANNELS !== 'undefined') {
        var popular = ['history','mining','layer-2-lightning','self-custody','problems-of-money','whitepaper','cryptography','philosophy','energy','nodes'];
        var shuffled = popular.filter(function(k){ return !!CHANNELS[k]; }).sort(function(){ return Math.random() - 0.5; });
        if (shuffled.length) recChannel = shuffled[0];
    }
    var recHtml = '';
    if (recChannel && typeof CHANNELS !== 'undefined' && CHANNELS[recChannel]) {
        var recTitle = CHANNELS[recChannel].title;
        var isDirectMatch = currentQuest && currentQuest.topicKey && _resolveQuestChannel(currentQuest.topicKey);
        var recVerb = isDirectMatch ? (score === 5 ? '📚 Keep learning' : '📖 Study up on') : '🔍 Explore next';
        recHtml = '<div style="margin:16px auto 0;max-width:320px;padding:12px 16px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.25);border-radius:12px;cursor:pointer;transition:0.2s;" onclick="closeQuest();setTimeout(function(){go(\'' + recChannel + '\')},200)" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'rgba(247,147,26,0.25)\'">' +
            '<div style="font-size:0.72rem;font-weight:800;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">' + recVerb + '</div>' +
            '<div style="font-size:0.9rem;font-weight:700;color:var(--heading);">' + recTitle + ' →</div>' +
        '</div>';
    }

    // Show final results screen
    const header = document.querySelector('.quest-header');
    if (header) {
        header.innerHTML = '<div class="quest-badge">⚡ QUEST COMPLETE</div>' +
            '<h2>' + currentQuest.title + '</h2>' +
            '<div style="font-size:3rem;margin:20px 0;">' + (score === 5 ? '🏆' : score >= 3 ? '🎉' : '😅') + '</div>' +
            '<div style="font-size:1.8rem;font-weight:900;color:var(--heading);margin-bottom:8px;">' + score + ' / 5 Correct</div>' +
            '<div style="font-size:1.1rem;color:var(--text-muted);margin-bottom:20px;">' + msg + '</div>' +
            (pts > 0 ? '<div style="font-size:1.3rem;font-weight:800;color:var(--accent);margin-bottom:20px;">+' + pts + ' XP earned!</div>' : '') +
            recHtml +
            (score < 5 ? '<button class="quest-retry" onclick="retryQuest()">🔄 Retake Quiz' + (isRetry ? '' : ' for 25 pts') + '</button>' : '') +
            '<button class="quest-done" onclick="closeQuest()">Continue Learning →</button>';
    }

    const inner = document.getElementById('questInner');
    if (inner) inner.scrollTop = 0;
}

function retryQuest() {
    // Re-shuffle the same questions
    currentQuest.questions.forEach(q => {
        const correctAnswer = q.options[q.answer];
        q.options.sort(() => Math.random() - 0.5);
        q.answer = q.options.indexOf(correctAnswer);
    });
    showQuest(currentQuest, true);
}

// Retake last quiz from the Quiz tab (after modal was closed)
window._retakeLastQuiz = function() {
    var qLog = safeJSON('btc_quest_daily', {});
    var topic = qLog.lastTopic || null;
    // Close the quest hub overlay if open
    var overlay = document.getElementById('questHubOverlay');
    if (overlay) overlay.remove();
    // Generate quiz with retake flag to bypass daily count
    setTimeout(function() {
        generateAndShowQuest(true, topic, true);
    }, 200);
};

function startQuestManual(targetChannelId) {
    if (currentQuest) return; // Already showing one

    // If a specific channel was passed, start directly
    if (targetChannelId) {
        generateAndShowQuest(true, targetChannelId);
        if (typeof isMobile === 'function' && isMobile()) {
            const sb = document.getElementById('sidebar');
            if (sb) sb.classList.remove('open');
        }
        return;
    }

    // Show topic picker
    _showQuestTopicPicker();
}

// Daily recommended quiz - deterministic shuffle, cycles through all topics without repeats
function _getDailyRecommendedQuiz(topics) {
    if (!topics || topics.length === 0) return null;
    var keys = topics.map(function(t) { return t.key; }).sort();
    var totalTopics = keys.length;
    // Use a fixed epoch so the cycle is stable
    var epoch = new Date('2026-01-01T00:00:00Z').getTime();
    var today = new Date().toISOString().split('T')[0];
    var todayMs = new Date(today + 'T00:00:00Z').getTime();
    var dayIndex = Math.floor((todayMs - epoch) / 86400000);
    // Which position in the current cycle
    var cyclePos = dayIndex % totalTopics;
    // Fisher-Yates shuffle with cycle number as seed for deterministic order
    var cycleNum = Math.floor(dayIndex / totalTopics);
    var shuffled = keys.slice();
    var seed = cycleNum * 7919 + 31337; // deterministic seed per cycle
    for (var i = shuffled.length - 1; i > 0; i--) {
        seed = (seed * 16807 + 0) % 2147483647; // LCG
        var j = seed % (i + 1);
        var tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
    }
    var dailyKey = shuffled[cyclePos];
    return topics.find(function(t) { return t.key === dailyKey; }) || null;
}

function _showQuestTopicPicker() {
    // Build topic list with question counts and completion status
    var topics = [];
    var topicEmojis = {
        '_general': '🌐', 'mining': '⛏️', 'nodes': '🖥️', 'privacy-nonkyc': '🕵️', 'problems-of-money': '💸',
        'layer-2-lightning': '⚡', 'self-custody': '🔑', 'halving': '📉', 'history': '📜', 'satoshi-nakamoto': '🧩',
        'whitepaper': '📄', 'money': '💰', 'scarce': '💎', 'secure': '🛡️', 'decentralized': '🌍',
        'programmable': '💻', 'dominant': '👑', 'philosophy': '🤔', 'energy': '🔋', 'cryptography': '🔐',
        'consensus': '🤝', 'taproot': '🌳', 'regulation': '⚖️', 'maximalism': '🔥', 'utxos': '📦',
        'difficulty-adjustment': '🎯', 'transaction_fees': '💳', 'game_theory': '♟️', 'books': '📚',
        'orange-pilling': '🍊', 'nostr': '🟣', 'use-cases': '🛠️', 'investment-strategy': '📊',
        'geopolitics___macroeconomics': '🌎', 'human_rights__social_justice_and_freedo': '✊',
        'smart-contracts': '📝', 'sidechains': '🔗', 'stablecoins': '🏦', 'fedimints': '🏛️',
        'pow-vs-pos': '⚔️', 'blockchain-timechain': '⛓️', 'softwar': '🪖', 'time_preference': '⏳',
        'governance': '🏛️', 'apps-tools': '🧰', 'misconceptions-fud': '🚫', 'elevator_pitches': '🗣️'
    };

    // Build one entry per static quest (Part 1, Part 2, etc.)
    STATIC_QUESTS.forEach(function(sq) {
        var key = sq.topicKey;
        var questId = sq.id; // 'q__topicKey__partNum'
        var baseKey2 = key.replace(/_pt\d+$/, '');
        var emoji = topicEmojis[key] || topicEmojis[baseKey2] || '📖';
        var baseLabel = key.replace(/[-_]+/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
        var label = sq.totalParts > 1 ? baseLabel + ' — Part ' + sq.partNum : baseLabel;
        var done = completedQuests.has(questId);
        // Use topicKey||partNum as the picker trigger key
        topics.push({ key: key + '||' + sq.partNum, label: label, emoji: emoji, count: 5, done: done, questId: questId });
    });

    // Sort: incomplete first, then alphabetical
    topics.sort(function(a, b) {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return a.label.localeCompare(b.label);
    });

    var doneCount = topics.filter(function(t) { return t.done; }).length;

    // Build the modal
    var modal = document.getElementById('questModal');
    if (!modal) return;
    var box = document.getElementById('questInner');
    if (!box) return;

    var html = '<div style="text-align:center;margin-bottom:16px;">' +
        '<div style="font-size:2.5rem;margin-bottom:6px;">⚡</div>' +
        '<h2 style="color:var(--heading);font-size:1.2rem;font-weight:800;margin:0 0 4px;">Choose a Quest Topic</h2>' +
        '<p style="color:var(--text-muted);font-size:0.8rem;margin:0;">Pick a Bitcoin topic to test your knowledge</p>' +
        '<div style="margin-top:8px;font-size:0.72rem;color:var(--accent);font-weight:700;">' + doneCount + '/' + topics.length + ' topics completed</div>' +
        '<div style="margin-top:6px;height:4px;background:var(--border);border-radius:2px;overflow:hidden;">' +
            '<div style="height:100%;background:var(--accent);width:' + (topics.length > 0 ? Math.round(doneCount/topics.length*100) : 0) + '%;border-radius:2px;transition:width 0.3s;"></div>' +
        '</div>' +
    '</div>';

    // Daily recommended quiz - cycles through all topics, no repeats until full cycle
    var _dailyTopic = _getDailyRecommendedQuiz(topics);
    if (_dailyTopic) {
        html += '<button onclick="_startQuestTopic(\'' + _dailyTopic.key.replace(/['\\"]/g, '') + '\')" style="width:100%;padding:14px 12px;background:linear-gradient(135deg,rgba(34,197,94,0.12),rgba(34,197,94,0.03));border:2px solid #22c55e;border-radius:12px;color:#22c55e;font-weight:800;font-size:0.85rem;cursor:pointer;font-family:inherit;margin-bottom:8px;transition:0.2s;display:flex;align-items:center;justify-content:center;gap:8px;" onmouseover="this.style.background=\'rgba(34,197,94,0.2)\'" onmouseout="this.style.background=\'linear-gradient(135deg,rgba(34,197,94,0.12),rgba(34,197,94,0.03))\'">' +
            '<span style="font-size:1.1rem;">📚</span> Daily Recommended Quiz - ' + _dailyTopic.emoji + ' ' + _dailyTopic.label +
        '</button>';
    }

    // Random option
    html += '<button onclick="_startQuestTopic(null)" style="width:100%;padding:12px;background:linear-gradient(135deg,rgba(247,147,26,0.1),rgba(247,147,26,0.03));border:1px solid var(--accent);border-radius:12px;color:var(--accent);font-weight:800;font-size:0.85rem;cursor:pointer;font-family:inherit;margin-bottom:12px;transition:0.2s;">🎲 Random Topic</button>';

    // Search field
    html += '<input id="questSearch" type="text" placeholder="Search topics..." style="width:100%;padding:8px;margin-bottom:8px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);font-size:0.85rem;" />';

    // Topic grid
    html += '<div id="questTopicList" style="max-height:50vh;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding-right:4px;">'
    topics.forEach(function(t) {
        var bg = t.done ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.02)';
        var border = t.done ? 'rgba(34,197,94,0.2)' : 'var(--border)';
        var statusIcon = t.done ? '<span style="color:#22c55e;font-size:0.75rem;">✅</span>' : '<span style="color:var(--text-faint);font-size:0.65rem;">' + t.count + 'Q</span>';
        html += '<button onclick="_startQuestTopic(\'' + t.key.replace(/[\\'"]/g, "") + '\')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:' + bg + ';border:1px solid ' + border + ';border-radius:10px;cursor:pointer;width:100%;text-align:left;font-family:inherit;transition:0.2s;color:var(--text);" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'' + border + '\'">' +
            '<span style="font-size:1.1rem;flex-shrink:0;">' + t.emoji + '</span>' +
            '<span style="flex:1;font-size:0.82rem;font-weight:' + (t.done ? '500' : '700') + ';color:' + (t.done ? 'var(--text-muted)' : 'var(--text)') + ';">' + t.label + '</span>' +
            statusIcon +
        '</button>';
    });
    html += '</div>';

    // Close button
    html += '<button onclick="closeQuest()" style="width:100%;margin-top:12px;padding:10px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.82rem;font-weight:600;cursor:pointer;font-family:inherit;">← Back</button>';

    box.innerHTML = html;
    // Add data attributes and search functionality
    setTimeout(function(){
        var btns = document.querySelectorAll('#questTopicList button');
        btns.forEach(function(b){
            var onclick = b.getAttribute('onclick')||'';
            var m = onclick.match(/_startQuestTopic\('([^']+)'\)/);
            if(m) b.dataset.key = m[1];
            b.dataset.label = b.textContent.trim();
        });
        var search = document.getElementById('questSearch');
        if(search){
            search.addEventListener('input', function(){
                var val = this.value.toLowerCase();
                btns.forEach(function(b){
                    var lbl = b.dataset.label.toLowerCase();
                    b.style.display = lbl.includes(val) ? '' : 'none';
                });
            });
        }
    },0);
    modal.classList.add('open');
}

window._startQuestTopic = function(topicKey) {
    var modal = document.getElementById('questModal');
    if (modal) modal.classList.remove('open');
    currentQuest = null;

    if (!topicKey) {
        // Random - pick an incomplete topic
        var incomplete = [];
        for (var key in QUESTION_BANK) {
            if (key === '_general') continue;
            if (QUESTION_BANK[key].length < 3) continue;
            if (!completedQuests.has('quest_' + key) && !completedQuests.has(key) && weeklyCompleted.indexOf(key) === -1) incomplete.push(key);
        }
        if (incomplete.length > 0) {
            topicKey = incomplete[Math.floor(Math.random() * incomplete.length)];
        } else {
            // All done - pick any
            var allKeys = Object.keys(QUESTION_BANK).filter(function(k) { return k !== '_general' && QUESTION_BANK[k].length >= 3; });
            topicKey = allKeys[Math.floor(Math.random() * allKeys.length)];
        }
    }

    setTimeout(function() {
        generateAndShowQuest(true, topicKey);
    }, 200);
};

function skipQuest() { closeQuest(); }

function closeQuest() {
    document.getElementById('questModal').classList.remove('open');
    currentQuest = null;
    isRetry = false;
    // If the Quest Hub overlay is still open, restore its tabs + re-render so
    // the updated XP/retake state is visible (tabs were hidden during quiz picker flow)
    if (document.getElementById('questHubOverlay')) {
        if (typeof window._questHubBackToTabs === 'function') window._questHubBackToTabs();
    }
}

setTimeout(initQuests, 3000);




// ── FAVOR TAB (Satoshi's Favor) ──
function _renderFavorTab(body) {
    if (!body) return;

    // Get current state from window._resolveFavorState if available
    var state = typeof window._resolveFavorState === 'function' ? window._resolveFavorState() : null;
    var isActive = state && state.favorActive;
    var points = state ? (state.points || 0) : 0;
    var pct = Math.min(100, (points / 21) * 100);

    var html = '<div style="text-align:center;padding:16px 0;">' +
        '<div style="font-size:2.5rem;margin-bottom:8px;">✨⛏️</div>' +
        '<div style="font-size:1.1rem;font-weight:800;color:var(--heading);margin-bottom:4px;">Satoshi\'s Favor</div>' +
        '<div style="color:var(--text-muted);font-size:0.82rem;margin-bottom:16px;">Community mining when the community earns 21 points.<br><span style="color:#f7931a;font-weight:600;">Chance to win 21,000 sats! ⚡</span></div>';


    if (isActive) {
        var endBase = state.favorEndBase ? state.favorEndBase.toMillis() : 0;
        var bonusMs = (state.bonusMinutes || 0) * 60 * 1000;
        var remainingMs = (endBase + bonusMs) - Date.now();
        var remainingMin = Math.floor(remainingMs / 60000);
        var remainingSec = Math.floor((remainingMs % 60000) / 1000);

        html += '<div style="background:linear-gradient(135deg,rgba(247,147,26,0.15),rgba(247,147,26,0.05));border:2px solid var(--accent);border-radius:12px;padding:16px;margin-bottom:16px;animation:favorPulse 2s ease-in-out infinite;">' +
            '<div style="font-size:1.2rem;font-weight:800;color:var(--accent);margin-bottom:8px;">🎉 SATOSHI\'S FAVOR IS ACTIVE!</div>' +
            '<div style="font-size:2rem;font-weight:900;color:#fff;font-family:monospace;" id="favorTabTimer">' + remainingMin + 'm ' + remainingSec + 's</div>' +
            '<div style="color:var(--text-muted);font-size:0.8rem;margin-top:8px;">Mine below ' + ((window.SF_DIFFICULTY_TARGET || 30000).toLocaleString()) + ' to win 21,000 sats!</div>' +
            '</div>' +
            '<style>@keyframes favorPulse{0%,100%{box-shadow:0 0 0 0 rgba(247,147,26,0.4)}50%{box-shadow:0 0 0 10px rgba(247,147,26,0)}}</style>';

        html += '<button onclick="window.closeQuestHubForFavor && window.closeQuestHubForFavor();window.openSatoshiFavorMiner && window.openSatoshiFavorMiner()" style="padding:14px 32px;background:linear-gradient(135deg,var(--accent),#e8720c);border:none;border-radius:14px;color:#fff;font-size:1rem;font-weight:800;cursor:pointer;font-family:inherit;margin-bottom:12px;">✨⛏️ Start Mining</button>';
    } else {
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px;">' +
                '<span style="font-size:1.1rem;font-weight:800;color:var(--heading);">' + points + '/21 points</span>' +
            '</div>' +
            '<div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;">' +
                '<div style="height:100%;background:linear-gradient(90deg,var(--accent),#ffd700);width:' + pct + '%;transition:width 0.5s;border-radius:4px;"></div>' +
            '</div>' +
            '<div style="margin-top:8px;font-size:0.75rem;color:var(--text-muted);">' + (21 - points) + ' more points to activate</div>' +
        '</div>';
    }

    // ── Faction Scoreboard (below progress bar) ──
    html += '<div id="factionScoreboard" style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:18px;">' +
        '<div style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1.2px;font-weight:800;margin-bottom:4px;">⚔️ Faction SF Competition</div>' +
        '<div style="font-size:0.72rem;color:var(--accent);font-weight:700;margin-bottom:2px;">Race to 1,000 points</div>' +
        '<div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:12px;">🏆 Winning Faction receives a special prize!</div>' +
        '<div id="factionScoreboardInner" style="display:flex;gap:10px;align-items:stretch;">' +
            '<div style="flex:1;background:rgba(247,147,26,0.07);border:2px solid rgba(247,147,26,0.3);border-radius:12px;padding:12px;text-align:center;">' +
                '<div style="font-size:1.4rem;margin-bottom:4px;">🐝</div>' +
                '<div style="font-size:0.78rem;font-weight:800;color:#f7931a;margin-bottom:6px;">Cyber Hornets</div>' +
                '<div id="sfScoreHornets" style="font-size:1.6rem;font-weight:900;color:var(--heading);font-family:monospace;">0</div>' +
                '<div style="font-size:0.62rem;color:var(--text-faint);margin-top:2px;">SF points</div>' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;flex-shrink:0;">' +
                '<div style="font-size:0.9rem;font-weight:900;color:var(--text-faint);">VS</div>' +
                '<div id="sfScoreLeader" style="display:none;"></div>' +
            '</div>' +
            '<div style="flex:1;background:rgba(168,85,247,0.07);border:2px solid rgba(168,85,247,0.3);border-radius:12px;padding:12px;text-align:center;">' +
                '<div style="font-size:1.4rem;margin-bottom:4px;">🦡</div>' +
                '<div style="font-size:0.78rem;font-weight:800;color:#a855f7;margin-bottom:6px;">Honey Badgers</div>' +
                '<div id="sfScoreBadgers" style="font-size:1.6rem;font-weight:900;color:var(--heading);font-family:monospace;">0</div>' +
                '<div style="font-size:0.62rem;color:var(--text-faint);margin-top:2px;">SF points</div>' +
            '</div>' +
        '</div>' +
        '<div id="sfScoreBar" style="margin-top:10px;height:6px;background:var(--border);border-radius:3px;overflow:hidden;display:none;">' +
            '<div id="sfScoreBarFill" style="height:100%;background:linear-gradient(90deg,#f7931a,#f7931a 50%,#a855f7 50%,#a855f7);width:100%;border-radius:3px;transition:background 0.5s;"></div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding:8px 10px;background:rgba(255,255,255,0.03);border-radius:8px;">' +
            '<div style="display:flex;align-items:center;gap:6px;">' +
                '<span style="font-size:0.82rem;">👤</span>' +
                '<span style="font-size:0.72rem;color:var(--text-muted);">Unaffiliated - <span onclick=\"document.getElementById(\'questHubOverlay\').remove();setTimeout(function(){showSettingsPage(\'account\')},50)\" style=\"color:var(--accent);cursor:pointer;font-weight:700;text-decoration:underline;\">Choose a Faction!</span></span>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
                '<span id="sfScoreUnaffiliated" style="font-size:0.88rem;font-weight:800;color:var(--text-muted);font-family:monospace;">0</span>' +
                '<span style="font-size:0.62rem;color:var(--text-faint);">pts</span>' +
            '</div>' +
        '</div>' +
        '<div id="sfNoFactionNote" style="display:none;"></div>' +
        '<div id="sfAdminBackfill" style="display:none;margin-top:8px;text-align:center;">' +
            '<button onclick="window._runFactionBackfill()" style="padding:5px 12px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.4);border-radius:7px;color:var(--accent);font-size:0.7rem;font-weight:700;cursor:pointer;font-family:inherit;">⚡ Backfill historical data (admin)</button>' +
        '</div>' +
    '</div>';
    // -- end faction scoreboard --

    html += '<div style="background:rgba(247,147,26,0.06);border:1px solid rgba(247,147,26,0.2);border-radius:10px;padding:12px;text-align:left;font-size:0.78rem;color:var(--text-muted);line-height:1.5;">' +
        '<strong style="color:var(--accent);">How it works:</strong><br>' +
        'This is a <strong>community challenge</strong> - everyone\'s points combine!<br><br>' +
        '• Complete the daily Quiz Quest, Trivia &amp; Poll = 1 point<br>' +
        '• Earn a badge = 1 point<br>' +
        '• Level up to Pleb/Stacker ranks = 1 point each<br>' +
        '• Level up to Maxi ranks = 5 points each<br>' +
        '• Level up to Papa John or higher = 10 points<br>' +
        '• At 21 points, a mining competition opens for 60 minutes<br>' +
        '• Extra points beyond 21 add +3 min each (even while active!)<br>' +
        '• 10 hashes max per minute per user (60 second cooldown)<br>' +
        '• Generate a random hash. Below ' + ((window.SF_DIFFICULTY_TARGET || 30000).toLocaleString()) + ' = win 21,000 sats!'
    '</div>';

    // Last SF Window Stats card
    html += '<div id="lastSFWindowCard" style="margin-top:16px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;">' +
        '<div style="font-size:0.82rem;font-weight:800;color:var(--heading);margin-bottom:10px;">\u23F1\uFE0F Last SF Window</div>' +
        '<div id="lastSFWindowInner" style="font-size:0.8rem;color:var(--text-muted);">Loading...</div>' +
    '</div>';

    // Top 10 lowest hashes + personal best sections
    html += '<div style="margin-top:16px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;">' +
        '<div style="font-size:0.82rem;font-weight:800;color:var(--heading);margin-bottom:10px;">\uD83C\uDFC6 All-Time Lowest Hashes</div>' +
        '<div id="favorTopHashes" style="font-size:0.8rem;color:var(--text-muted);">Loading...</div>' +
    '</div>';

    html += '<div style="margin-top:10px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;">' +
        '<div style="font-size:0.82rem;font-weight:800;color:var(--heading);margin-bottom:8px;">\u2B50 Your Personal Best</div>' +
        '<div id="favorPersonalBest" style="font-size:0.8rem;color:var(--text-muted);">Loading...</div>' +
    '</div>';
    // Difficulty History — rendered dynamically from window.SF_DIFFICULTY_HISTORY
    (function() {
        var _dh = (typeof window !== 'undefined' && window.SF_DIFFICULTY_HISTORY) || [
            { date: '2026-06-02', target: 1000,  label: 'Genesis' },
            { date: '2026-06-21', target: 30000, label: '-96.67% drop' },
            { date: '2026-06-30', target: 15000, label: '+100% raise' },
        ];
        var _dhHtml = '<div style="margin-top:10px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;">' +
            '<div style="font-size:0.82rem;font-weight:800;color:var(--heading);margin-bottom:8px;">\uD83D\uDCCA Difficulty History</div>' +
            '<table style="width:100%;border-collapse:collapse;font-size:0.75rem;">' +
            '<thead><tr style="color:var(--text-faint);">' +
                '<th style="text-align:left;padding:4px 6px;border-bottom:1px solid var(--border);">Date</th>' +
                '<th style="text-align:right;padding:4px 6px;border-bottom:1px solid var(--border);">Target</th>' +
                '<th style="text-align:right;padding:4px 6px;border-bottom:1px solid var(--border);">Odds</th>' +
                '<th style="text-align:right;padding:4px 6px;border-bottom:1px solid var(--border);">Blocks</th>' +
                '<th style="text-align:right;padding:4px 6px;border-bottom:1px solid var(--border);">Change</th>' +
            '</tr></thead>' +
            '<tbody id="sfDifficultyHistoryBody">';
        _dh.forEach(function(row, i) {
            var isCurrent = (i === _dh.length - 1);
            var prevTarget = i > 0 ? _dh[i - 1].target : null;
            var odds = '1:' + Math.round(100000000 / row.target).toLocaleString();
            var changeColor = !prevTarget ? 'var(--text-faint)' : (row.target < prevTarget ? '#22c55e' : '#ef4444');
            var changeTxt = row.label || (!prevTarget ? 'Genesis' : (((row.target - prevTarget) / prevTarget * 100).toFixed(2) + '%'));
            _dhHtml += '<tr style="color:' + (isCurrent ? 'var(--heading)' : 'var(--text-muted)') + ';' + (isCurrent ? 'background:rgba(247,147,26,0.06);' : '') + '">' +
                '<td style="padding:5px 6px;' + (isCurrent ? 'font-weight:700;' : '') + '">' + row.date + '</td>' +
                '<td style="text-align:right;padding:5px 6px;font-family:monospace;' + (isCurrent ? 'font-weight:700;color:#22c55e;' : '') + '">' + row.target.toLocaleString() + '</td>' +
                '<td style="text-align:right;padding:5px 6px;">' + odds + '</td>' +
                '<td id="sfBlocksRow' + i + '" style="text-align:right;padding:5px 6px;' + (isCurrent ? 'font-weight:700;' : '') + '">' + (isCurrent ? '\u2026' : '0') + '</td>' +
                '<td style="text-align:right;padding:5px 6px;color:' + changeColor + ';' + (isCurrent ? 'font-weight:700;' : '') + '">' + changeTxt + '</td>' +
            '</tr>';
        });
        _dhHtml += '</tbody></table></div>';
        html += _dhHtml;
    })();
    '</div>';

    html += '</div>';
    body.innerHTML = html;

    // -- Live faction scoreboard listener --
    _startFactionScoreboardListener();

    // Load top hashes + personal best + difficulty history blocks + last window
    _loadFavorLeaderboards();
    _loadDifficultyHistoryBlocks();
    _loadLastSFWindow();

    // Start timer if active
    if (isActive) {
        var timerEl = document.getElementById('favorTabTimer');
        if (timerEl) {
            var interval = setInterval(function() {
                if (!timerEl) { clearInterval(interval); return; }
                if (!state || !state.favorActive) { timerEl.textContent = 'EXPIRED'; clearInterval(interval); return; }
                var endBase = state.favorEndBase ? state.favorEndBase.toMillis() : 0;
                var bonusMs = (state.bonusMinutes || 0) * 60 * 1000;
                var remaining = (endBase + bonusMs) - Date.now();
                if (remaining <= 0) { timerEl.textContent = '00:00'; return; }
                var mins = Math.floor(remaining / 60000);
                var secs = Math.floor((remaining % 60000) / 1000);
                timerEl.textContent = mins + 'm ' + secs + 's';
            }, 1000);
        }
    }
}

window.closeQuestHubForFavor = function() {
    var overlay = document.getElementById('questHubOverlay');
    if (overlay) overlay.remove();
    window._cleanupRaidBoss && window._cleanupRaidBoss();
    // Clean up faction listener
    if (window._factionScoreUnsub) { window._factionScoreUnsub(); window._factionScoreUnsub = null; }
    // Store that we should reopen Quest Hub on miner close
    window._qhReopenOnMinerClose = true;
};

// Admin one-click backfill
window._runFactionBackfill = function() {
    if (typeof firebase === 'undefined') return;
    var btn = document.querySelector('#sfAdminBackfill button');
    if (btn) { btn.textContent = '⏳ Running backfill...'; btn.disabled = true; }
    firebase.functions().httpsCallable('backfillFactionTotals')({}).then(function(r) {
        var d = r.data;
        if (typeof showToast === 'function') showToast('✅ Backfill done! 🐝 ' + (d.totals && d.totals.cyber_hornets || 0) + ' vs 🦡 ' + (d.totals && d.totals.honey_badgers || 0));
        if (btn) { btn.textContent = '✅ Done!'; }
    }).catch(function(err) {
        if (typeof showToast === 'function') showToast('❌ Backfill error: ' + err.message);
        if (btn) { btn.textContent = '⚡ Backfill historical data (admin)'; btn.disabled = false; }
        console.error('[BACKFILL]', err);
    });
};

// -- Faction scoreboard live listener --
function _startFactionScoreboardListener() {
    // Detach any previous listener
    if (window._factionScoreUnsub) { window._factionScoreUnsub(); window._factionScoreUnsub = null; }
    if (typeof db === 'undefined') return;

    var totalsRef = db.collection('satoshiFavor').doc('factionTotals');
    window._factionScoreUnsub = totalsRef.onSnapshot(function(doc) {
        var data = doc.exists ? doc.data() : { cyber_hornets: 0, honey_badgers: 0, unaffiliated: 0 };
        var hornets = data.cyber_hornets || 0;
        var badgers = data.honey_badgers || 0;
        var total = hornets + badgers;

        var elH = document.getElementById('sfScoreHornets');
        var elB = document.getElementById('sfScoreBadgers');
        var elU = document.getElementById('sfScoreUnaffiliated');
        var elLeader = document.getElementById('sfScoreLeader');
        var elBar = document.getElementById('sfScoreBar');
        var elBarFill = document.getElementById('sfScoreBarFill');
        var elNote = document.getElementById('sfNoFactionNote');
        var unaffiliated = data.unaffiliated || 0;

        if (elH) elH.textContent = hornets.toLocaleString();
        if (elB) elB.textContent = badgers.toLocaleString();
        if (elU) elU.textContent = unaffiliated.toLocaleString();

        // Leader label
        if (elLeader) {
            // leader label hidden per design (removed)
        }

        // Progress bar showing split
        if (elBar && elBarFill && total > 0) {
            elBar.style.display = 'block';
            var hornetPct = Math.round((hornets / total) * 100);
            var badgerPct = 100 - hornetPct;
            elBarFill.style.background =
                'linear-gradient(90deg, #f7931a ' + hornetPct + '%, #a855f7 ' + hornetPct + '%)';
        }

        // Show join note if user has no faction
        var userFaction = (typeof currentUser !== 'undefined' && currentUser) ? (currentUser.faction || '') : '';
        if (elNote) {
            elNote.style.display = userFaction ? 'none' : 'block';
        }

        // Show backfill button for admin
        var elAdmin = document.getElementById('sfAdminBackfill');
        if (elAdmin) {
            var isAdmin = (typeof currentUser !== 'undefined' && currentUser && (currentUser.email === 'needcreations@gmail.com' || currentUser.email === 'najemchris8@gmail.com'));
            elAdmin.style.display = isAdmin ? 'block' : 'none';
        }

        // Highlight user's faction card
        var userFaction2 = (typeof currentUser !== 'undefined' && currentUser) ? (currentUser.faction || '') : '';
        var elScoreboard = document.getElementById('factionScoreboardInner');
        if (elScoreboard && userFaction2) {
            var cards = elScoreboard.querySelectorAll('div[style*="flex:1"]');
            if (cards[0]) cards[0].style.borderWidth = userFaction2 === 'cyber_hornets' ? '3px' : '2px';
            if (cards[1]) cards[1].style.borderWidth = userFaction2 === 'honey_badgers' ? '3px' : '2px';
        }
    }, function(err) {
        console.warn('[FACTION-SCORE] Listener error:', err);
    });
}

// Detach handle for real-time topHashes listener
var _favorTopHashesUnsub = null;
var _favorPBUnsub = null;

function _renderTopHashesHTML(entries) {
    var myUsername = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : null;
    var now = Date.now();
    var SEVENTY_TWO_HOURS = 72 * 60 * 60 * 1000;
    var html = '';

    function renderEntry(e, i) {
        var isMe = myUsername && e.username === myUsername;
        var rank = i + 1;
        var rankIcon = rank === 1 ? '\uD83E\uDD47' : (rank === 2 ? '\uD83E\uDD48' : (rank === 3 ? '\uD83E\uDD49' : rank + '.'));
        var name = typeof escapeHtml === 'function' ? escapeHtml(e.username || 'Anon') : (e.username || 'Anon');
           // Winner = hash beat the difficulty target that was ACTIVE when it was mined.
        // e.difficultyTarget is stored by the cloud function (backfilled for legacy entries).
        // Fall back to inferring from timestamp using the known history if missing.
        var tsMs = (e.timestamp && typeof e.timestamp.toMillis === 'function') ? e.timestamp.toMillis() : (e.timestamp ? Number(e.timestamp) : 0);
        var diffTarget;
        if (e.difficultyTarget != null) {
            diffTarget = e.difficultyTarget;
        } else {
            // Infer from timestamp using full difficulty history
            var _lbDh = (typeof window !== 'undefined' && window.SF_DIFFICULTY_HISTORY) || [
                { date: '2026-06-02', target: 1000 },
                { date: '2026-06-21', target: 30000 },
                { date: '2026-06-30', target: 15000 },
            ];
            diffTarget = _lbDh[0].target;
            for (var _lbK = 0; _lbK < _lbDh.length; _lbK++) {
                if (tsMs && new Date(_lbDh[_lbK].date).getTime() <= tsMs) diffTarget = _lbDh[_lbK].target;
                else break;
            }
        }
        var isWin = e.value < diffTarget;
        var isNew = tsMs && (now - tsMs) < SEVENTY_TWO_HOURS;
        var badges = '';
        var winDate = tsMs ? new Date(tsMs).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' }) : '';
        if (isWin) badges += '<span title="Won ' + winDate + '" style="margin-left:6px;padding:1px 6px;background:#22c55e;color:#fff;font-size:0.6rem;font-weight:900;border-radius:4px;letter-spacing:0.05em;vertical-align:middle;cursor:help;">WINNER</span>';
        if (isNew) badges += '<span style="margin-left:4px;padding:1px 5px;background:#f7931a;color:#fff;font-size:0.6rem;font-weight:900;border-radius:4px;letter-spacing:0.05em;vertical-align:middle;">NEW</span>';
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;margin-bottom:3px;' +
            'background:' + (isWin ? 'rgba(34,197,94,0.12)' : (isMe ? 'rgba(247,147,26,0.1)' : 'transparent')) + ';' +
            'border:1px solid ' + (isWin ? '#22c55e' : (isMe ? 'var(--accent)' : 'var(--border)')) + ';border-radius:8px;">' +
            '<div style="display:flex;align-items:center;gap:6px;">' +
                '<span style="font-size:0.78rem;min-width:22px;">' + rankIcon + '</span>' +
                '<span style="font-size:0.8rem;font-weight:' + (isMe ? '800' : '600') + ';color:' + (isMe ? 'var(--accent)' : 'var(--text)') + ';">' + name + (isMe ? ' (you)' : '') + badges + '</span>' +
            '</div>' +
            '<span title="Target when mined: ' + diffTarget.toLocaleString() + '" style="font-family:monospace;font-size:0.82rem;font-weight:800;cursor:help;color:' + (isWin ? '#22c55e' : 'var(--text-muted)') + ';">' + e.value.toLocaleString() + '</span>' +
        '</div>';
    }

        var top10 = entries.slice(0, 10);
    var rest = entries.slice(10);
    for (var i = 0; i < top10.length; i++) html += renderEntry(top10[i], i);

    if (rest.length > 0) {
        html += '<div id="favorHashesMore" style="display:none;">';
        for (var j = 0; j < rest.length; j++) html += renderEntry(rest[j], 10 + j);
        html += '</div>';
        html += '<button onclick="(function(){var m=document.getElementById(\'favorHashesMore\');var b=document.getElementById(\'favorHashesMoreBtn\');if(!m||!b)return;var open=m.style.display!==\'none\';m.style.display=open?\'none\':\'block\';b.textContent=open?\'Show more \u25bc\':\'Show less \u25b2\';})()"' +
            'id="favorHashesMoreBtn" style="width:100%;margin-top:6px;padding:6px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit;">Show more \u25bc</button>';
    }

    return html;
}
function _renderPBHTML(val) {
    var isWin = val < 1000;
    return '<div style="text-align:center;padding:8px;">' +
        '<div style="font-size:1.8rem;font-weight:900;font-family:monospace;color:' + (isWin ? '#22c55e' : (val < 10000 ? 'var(--accent)' : 'var(--heading)')) + ';">' + (isWin ? '\uD83C\uDFC6 ' : '') + val.toLocaleString() + '</div>' +
        '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">Your all-time lowest hash</div>' +
    '</div>';
}

function _loadDifficultyHistoryBlocks() {
    if (typeof db === 'undefined') return;
    // Query winners from satoshiFavor/current/hashes where isWinner == true
    db.collection('satoshiFavor').doc('current').collection('hashes')
        .where('isWinner', '==', true)
        .get()
        .then(function(snap) {
            // Count wins per difficulty target
            var counts = {}; // { target: count }
            // Build a timestamp-based difficulty lookup for legacy hash docs missing difficultyTarget
            var _dhRef = (typeof window !== 'undefined' && window.SF_DIFFICULTY_HISTORY) || [];
            function _difficultyAtTs(tsMs) {
                // Walk history oldest→newest; last one whose date <= tsMs wins
                var result = _dhRef.length ? _dhRef[0].target : 1000;
                for (var _k = 0; _k < _dhRef.length; _k++) {
                    if (new Date(_dhRef[_k].date).getTime() <= tsMs) result = _dhRef[_k].target;
                    else break;
                }
                return result;
            }
            snap.forEach(function(doc) {
                var d = doc.data();
                var t;
                if (d.difficultyTarget != null) {
                    t = d.difficultyTarget;
                } else if (d.timestamp && d.timestamp.toMillis) {
                    t = _difficultyAtTs(d.timestamp.toMillis());
                } else {
                    t = 1000; // true legacy (pre-June-21) — Genesis era
                }
                counts[t] = (counts[t] || 0) + 1;
            });
            // Update each row's block count using SF_DIFFICULTY_HISTORY index
            var _dh = (typeof window !== 'undefined' && window.SF_DIFFICULTY_HISTORY) || [];
            _dh.forEach(function(row, i) {
                var el = document.getElementById('sfBlocksRow' + i);
                if (!el) return;
                el.textContent = (counts[row.target] || 0).toString();
            });
        })
        .catch(function() {
            var _dh2 = (typeof window !== 'undefined' && window.SF_DIFFICULTY_HISTORY) || [];
            _dh2.forEach(function(_, i) {
                var el = document.getElementById('sfBlocksRow' + i);
                if (el) el.textContent = '?';
            });
        });
}

function _loadLastSFWindow() {
    var el = document.getElementById('lastSFWindowInner');
    if (!el || typeof db === 'undefined') return;
    db.collection('satoshiFavor').doc('lastWindow').get().then(function(doc) {
        if (!el) return;
        if (!doc.exists) {
            el.innerHTML = '<span style="color:var(--text-faint);font-size:0.75rem;">No completed windows yet.</span>';
            return;
        }
        var d = doc.data();
        var endedAt = d.endedAt ? (d.endedAt.toDate ? d.endedAt.toDate() : new Date(d.endedAt.seconds*1000)) : null;
        var startedAt = d.startedAt ? (d.startedAt.toDate ? d.startedAt.toDate() : new Date(d.startedAt.seconds*1000)) : null;
        var dateStr = endedAt ? endedAt.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : 'Unknown';
        var timeStr = endedAt ? endedAt.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}) : '';
        var totalH = d.totalHashes || 0;
        var lowestH = d.lowestHash != null ? d.lowestHash.toLocaleString() : '—';
        var durMin = d.durationMinutes || 0;
        var _sfTarget = (typeof window !== 'undefined' && window.SF_DIFFICULTY_TARGET) ? window.SF_DIFFICULTY_TARGET : 15000;
        // Use the difficulty that was active at window end time, not current
        var _windowTarget = d.difficultyTarget || _sfTarget;
        var hadWinner = d.lowestHash != null && d.lowestHash < _windowTarget;
        // winner field added 2026-06-30; fall back to topHashes lookup for old windows
        var winnerName = (d.winner && d.winner.username) ? d.winner.username : (hadWinner ? null : null);
        var lowestColor = hadWinner ? '#f7931a' : '#22c55e';
        // Build winner banner — if we have a winner hash but no name, look up via topHashes
        function _renderWinnerBanner(name) {
            var display = name ? '@' + escapeHtml(name) : '🏆 Winner';
            return '<div data-winner-banner style="margin-top:8px;padding:8px 12px;background:linear-gradient(135deg,rgba(247,147,26,0.15),rgba(234,179,8,0.08));border:1px solid rgba(247,147,26,0.4);border-radius:8px;display:flex;align-items:center;gap:8px;"><span style="font-size:1.1rem">🏆</span><span style="font-size:0.75rem;font-weight:700;color:#f7931a;">' + display + ' — ' + (d.lowestHash || 0).toLocaleString() + '</span></div>';
        }
        var winnerBanner = hadWinner
            ? _renderWinnerBanner(winnerName)
            : '<div style="margin-top:8px;padding:6px 10px;background:var(--bg-side);border-radius:8px;font-size:0.72rem;color:var(--text-faint);text-align:center;">No winner this window (target: &lt;' + _windowTarget.toLocaleString() + ')</div>';
        el.innerHTML =
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
                '<div style="background:var(--bg-side);border-radius:8px;padding:8px;text-align:center;">' +
                    '<div style="font-size:1.2rem;font-weight:900;color:var(--accent);">' + totalH.toLocaleString() + '</div>' +
                    '<div style="font-size:0.65rem;color:var(--text-faint);">Total Hashes</div>' +
                '</div>' +
                '<div style="background:var(--bg-side);border-radius:8px;padding:8px;text-align:center;">' +
                    '<div style="font-size:1.2rem;font-weight:900;color:' + lowestColor + ';">' + lowestH + '</div>' +
                    '<div style="font-size:0.65rem;color:var(--text-faint);">Lowest Hash</div>' +
                '</div>' +
            '</div>' +
            winnerBanner +
            '<div style="margin-top:8px;font-size:0.7rem;color:var(--text-faint);">' +
                '\u23F1\uFE0F ' + durMin + ' min window · ended ' + dateStr + ' ' + timeStr +
            '</div>';
        // If we have a winner hash but no name stored (legacy lastWindow docs),
        // look up the winner name from topHashes by matching the hash value
        if (hadWinner && !winnerName && typeof db !== 'undefined') {
            db.collection('satoshiFavor').doc('topHashes').get().then(function(thDoc) {
                if (!thDoc.exists) return;
                var entries = thDoc.data().entries || [];
                var match = entries.find(function(e) { return e.value === d.lowestHash; });
                if (match && match.username) {
                    var bannerEl = el.querySelector('[data-winner-banner]');
                    if (bannerEl) bannerEl.outerHTML = _renderWinnerBanner(match.username);
                }
            }).catch(function(){});
        }
    }).catch(function() {
        var el2 = document.getElementById('lastSFWindowInner');
        if (el2) el2.innerHTML = '<span style="color:var(--text-faint);font-size:0.75rem;">Stats unavailable.</span>';
    });
}

function _loadFavorLeaderboards() {
    if (typeof db === 'undefined') return;

    // Detach previous real-time listeners
    if (_favorTopHashesUnsub) { _favorTopHashesUnsub(); _favorTopHashesUnsub = null; }
    if (_favorPBUnsub) { _favorPBUnsub(); _favorPBUnsub = null; }

    // Top 10 lowest hashes - REAL-TIME listener
    _favorTopHashesUnsub = db.collection('satoshiFavor').doc('topHashes').onSnapshot(function(doc) {
        var el = document.getElementById('favorTopHashes');
        if (!el) return;
        if (!doc.exists || !doc.data().entries || doc.data().entries.length === 0) {
            el.innerHTML = '<div style="text-align:center;color:var(--text-faint);padding:8px;">No hashes yet. Be the first to mine!</div>';
            return;
        }
        el.innerHTML = _renderTopHashesHTML(doc.data().entries);
    }, function() {
        var el = document.getElementById('favorTopHashes');
        if (el) el.innerHTML = '<div style="text-align:center;color:var(--text-faint);padding:8px;">Could not load leaderboard</div>';
    });

    // Personal best - real-time on per-user doc, legacy fallback
    var myUid = (typeof auth !== 'undefined' && auth && auth.currentUser) ? auth.currentUser.uid : null;
    if (!myUid) {
        var pbEl = document.getElementById('favorPersonalBest');
        if (pbEl) pbEl.innerHTML = '<div style="text-align:center;color:var(--text-faint);padding:8px;">Sign in to track your personal best</div>';
        return;
    }
    var _legacyChecked = false;
    _favorPBUnsub = db.collection('satoshiFavor').doc('personalBests').collection('users').doc(myUid).onSnapshot(function(doc) {
        var pbEl = document.getElementById('favorPersonalBest');
        if (!pbEl) return;
        if (doc.exists) {
            pbEl.innerHTML = _renderPBHTML(doc.data().value);
            return;
        }
        // No per-user doc yet - check legacy single doc (once)
        if (_legacyChecked) { pbEl.innerHTML = '<div style="text-align:center;color:var(--text-faint);padding:8px;">No hashes yet. Start mining!</div>'; return; }
        _legacyChecked = true;
        db.collection('satoshiFavor').doc('personalBests').get().then(function(legacyDoc) {
            pbEl = document.getElementById('favorPersonalBest');
            if (!pbEl) return;
            if (!legacyDoc.exists) { pbEl.innerHTML = '<div style="text-align:center;color:var(--text-faint);padding:8px;">No hashes yet. Start mining!</div>'; return; }
            var users = legacyDoc.data().users || {};
            var legacy = users[myUid];
            if (!legacy) { pbEl.innerHTML = '<div style="text-align:center;color:var(--text-faint);padding:8px;">No hashes yet. Start mining!</div>'; return; }
            pbEl.innerHTML = _renderPBHTML(legacy.value);
        }).catch(function() {});
    }, function() {
        var pbEl = document.getElementById('favorPersonalBest');
        if (pbEl) pbEl.innerHTML = '<div style="text-align:center;color:var(--text-faint);padding:8px;">Could not load personal best</div>';
    });
}
// ---- OPENCLAW EXPORTS ----
if (typeof startQuestManual !== "undefined") window.startQuestManual = startQuestManual;
if (typeof selectAnswer !== "undefined") window.selectAnswer = selectAnswer;
if (typeof submitQuest !== "undefined") window.submitQuest = submitQuest;
if (typeof skipQuest !== "undefined") window.skipQuest = skipQuest;
if (typeof closeQuest !== "undefined") window.closeQuest = closeQuest;
if (typeof showQuest !== "undefined") window.showQuest = showQuest;
if (typeof generateAndShowQuest !== "undefined") window.generateAndShowQuest = generateAndShowQuest;
if (typeof _showQuestTopicPicker !== "undefined") window._showQuestTopicPicker = _showQuestTopicPicker;
if (typeof showQuestFinalResults !== "undefined") window.showQuestFinalResults = showQuestFinalResults;
if (typeof retryQuest !== "undefined") window.retryQuest = retryQuest;
if (typeof _renderQuestHubTab !== "undefined") window._renderQuestHubTab = _renderQuestHubTab;
// ============================================================
// QUEST HUB - Quiz / Trivia / Poll tabs
// ============================================================

window._questHubTab = 'quiz';

// Show quiz topic picker inside Quest Hub with back button
window._questHubShowQuizPicker = function() {
    var body = document.getElementById('questHubBody');
    var tabs = document.getElementById('questHubTabs');
    if (!body) { // fallback: open old modal flow
        document.getElementById('questHubOverlay').remove();
        setTimeout(function() { if (typeof _showQuestTopicPicker === 'function') _showQuestTopicPicker(); }, 200);
        return;
    }
    // Swap header: hide tabs, show back button
    if (tabs) tabs.style.display = 'none';
    var header = tabs && tabs.parentElement;
    var backBar = document.getElementById('qhBackBar');
    if (!backBar && header) {
        backBar = document.createElement('div');
        backBar.id = 'qhBackBar';
        backBar.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:12px;';
        backBar.innerHTML = '<button onclick="window._questHubBackToTabs()" style="background:none;border:1px solid var(--border);border-radius:10px;padding:6px 14px;color:var(--text-muted);font-size:0.85rem;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:6px;">← Back</button>' +
            '<span style="color:var(--heading);font-size:0.95rem;font-weight:800;">Choose a Quiz Topic</span>';
        tabs.parentNode.insertBefore(backBar, tabs);
    }
    if (backBar) backBar.style.display = 'flex';
    // Render topic picker inline
    if (typeof _renderQuestHubQuizPicker === 'function') _renderQuestHubQuizPicker(body);
    else {
        // Fallback: open old modal
        document.getElementById('questHubOverlay').remove();
        setTimeout(function() { if (typeof _showQuestTopicPicker === 'function') _showQuestTopicPicker(); }, 200);
    }
};

window._questHubBackToTabs = function() {
    var tabs = document.getElementById('questHubTabs');
    var backBar = document.getElementById('qhBackBar');
    if (tabs) tabs.style.display = 'grid'; // must be grid, not '' (which resets to block)
    if (backBar) backBar.style.display = 'none';
    window._questHubTab = 'quiz';
    if (typeof _renderQuestHubTab === 'function') _renderQuestHubTab();
};

window.showQuestHub = function() {
    // Minimize global chat if open (so Quest Hub is visible on mobile)
    if (window._chatOverlayOpen && typeof toggleChatOverlay === 'function') {
        toggleChatOverlay();
    }

    // Remove existing
    var existing = document.getElementById('questHubOverlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'questHubOverlay';
    var _qhAlign = window.innerWidth <= 900 ? 'flex-start' : 'center';
    var _qhPad = window.innerWidth <= 900 ? '12px 12px 140px' : '20px'; // bottom padding clears nav+FABs on mobile
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.88);z-index:100000;display:flex;align-items:' + _qhAlign + ';justify-content:center;backdrop-filter:blur(5px);padding:' + _qhPad + ';animation:nachoPop 0.25s ease;overflow-y:auto;-webkit-overflow-scrolling:touch;';
    overlay.onclick = function(e) { if (e.target === overlay) { window._cleanupRaidBoss(); overlay.remove(); if (window._qhPopHandler) { window.removeEventListener('popstate', window._qhPopHandler); window._qhPopHandler = null; } if (window.location.hash === '#questhub') { history.replaceState({ home: true }, '', '/'); if (typeof goHome === 'function') goHome(true); } } };

    var modal = document.createElement('div');
    var _qhMaxH = window.innerWidth <= 900
        ? 'calc(100vh - 140px)' // mobile: subtract bottom nav (60px) + floating btns (50px) + safe area
        : '85vh';
    modal.style.cssText = 'background:var(--bg-side,#141425);border:1px solid var(--border);width:100%;max-width:520px;max-height:' + _qhMaxH + ';border-radius:24px;overflow:hidden;display:flex;flex-direction:column;position:relative;';

    // Desktop font-size boost - everything in the modal reads larger on wide screens
    var qhStyle = document.createElement('style');
    qhStyle.textContent = '@media(min-width:600px){' +
        '#questHubOverlay [style*="font-size:0.6"]{font-size:0.82rem!important}' +
        '#questHubOverlay [style*="font-size:0.7"]{font-size:0.88rem!important}' +
        '#questHubOverlay [style*="font-size:0.75"]{font-size:0.9rem!important}' +
        '#questHubOverlay [style*="font-size:0.78"]{font-size:0.92rem!important}' +
        '#questHubOverlay [style*="font-size:0.8"]{font-size:0.95rem!important}' +
        '#questHubOverlay [style*="font-size:0.82"]{font-size:0.97rem!important}' +
        '#questHubOverlay [style*="font-size:0.85"]{font-size:1rem!important}' +
        '#questHubOverlay [style*="font-size:0.9"]{font-size:1.05rem!important}' +
        '#questHubOverlay [style*="font-size:0.95"]{font-size:1.08rem!important}' +
        '#questHubOverlay p,[id="questHubBody"] div{font-size:inherit}' +
        '#questHubBody{font-size:1rem}' +
        '#questHubTabs button{font-size:0.88rem!important;padding:12px 0!important}' +
        '#questHubTabs{grid-template-columns:repeat(5,1fr)!important}' +
    '}';
    modal.appendChild(qhStyle);

    // Header
    var header = document.createElement('div');
    header.style.cssText = 'padding:20px 24px 0;flex-shrink:0;';
    header.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
        '<div><h2 style="margin:0;color:var(--heading);font-size:1.3rem;">⚔️ Quest Hub</h2>' +
        '<div style="color:var(--text-muted);font-size:0.8rem;margin-top:4px;">Earn XP by testing your Bitcoin knowledge</div>' +
        '<div style="margin-top:6px;padding:6px 10px;background:linear-gradient(135deg,rgba(247,147,26,0.12),rgba(247,147,26,0.05));border:1px solid rgba(247,147,26,0.3);border-radius:8px;font-size:0.75rem;color:#f7931a;font-weight:600;">🎯 Daily Trifecta: Complete the daily quiz, trivia and poll to earn the Daily Trifecta!</div></div>' +
        '<button onclick="window._cleanupRaidBoss();document.getElementById(\'questHubOverlay\').remove();if(window._qhPopHandler){window.removeEventListener(\'popstate\',window._qhPopHandler);window._qhPopHandler=null;}if(window.location.hash===\'#questhub\'){history.replaceState({home:true},\'\',(window._qhReturnPath||\'/\'));if(typeof goHome===\'function\')goHome(true);}" style="background:none;border:none;color:var(--text-muted);font-size:1.5rem;cursor:pointer;padding:4px;">✕</button></div>' +
        // Tabs
        '<div id="questHubTabs" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:16px;">' +
        '<button id="qhTabQuiz" onclick="window._questHubTab=\'quiz\';_renderQuestHubTab()" style="width:100%;padding:10px 0;border-radius:12px;border:1px solid var(--border);background:none;color:var(--text-muted);font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">📝 Quiz</button>' +
        '<button id="qhTabTrivia" onclick="window._questHubTab=\'trivia\';_renderQuestHubTab()" style="width:100%;padding:10px 0;border-radius:12px;border:1px solid var(--border);background:none;color:var(--text-muted);font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">🧠 Trivia</button>' +
        '<button id="qhTabPoll" onclick="window._questHubTab=\'poll\';_renderQuestHubTab()" style="width:100%;padding:10px 0;border-radius:12px;border:1px solid var(--border);background:none;color:var(--text-muted);font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">📊 Poll</button>' +
        '<button id="qhTabFlex" onclick="window._questHubTab=\'flex\';_renderQuestHubTab()" style="width:100%;padding:10px 0;border-radius:12px;border:1px solid var(--border);background:none;color:var(--text-muted);font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">💪 Flex</button>' +
        '<button id="qhTabFavor" onclick="window._questHubTab=\'favor\';_renderQuestHubTab()" style="width:100%;padding:10px 0;border-radius:12px;border:1px solid var(--border);background:none;color:var(--text-muted);font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">✨⛏️ Favor</button>' +
        '<button id="qhTabRaid" onclick="window._questHubTab=\'raid\';_renderQuestHubTab()" style="width:100%;padding:10px 0;border-radius:12px;border:1px solid var(--border);background:none;color:var(--text-muted);font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">⚔️ Raid</button>' +
        '<button id="qhTabCitadel" onclick="window._questHubTab=\'citadel\';_renderQuestHubTab()" style="width:100%;padding:10px 0;border-radius:12px;border:1px solid var(--border);background:none;color:var(--text-muted);font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">🏰 Citadel</button>' +
        '<button id="qhTabCharity" onclick="window._questHubTab=\'charity\';_renderQuestHubTab()" style="width:100%;padding:10px 0;border-radius:12px;border:1px solid var(--border);background:none;color:var(--text-muted);font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">❤️ Charity</button>' +
        '<button id="qhTabCommunity" onclick="window._questHubTab=\'community\';_renderQuestHubTab()" style="width:100%;padding:10px 0;border-radius:12px;border:1px solid var(--border);background:none;color:var(--text-muted);font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">🌍 Community</button>' +
        '<button id="qhTabNook" onclick="window._questHubTab=\'nook\';_renderQuestHubTab()" style="width:100%;padding:10px 0;border-radius:12px;border:1px solid var(--border);background:none;color:var(--text-muted);font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">🦌 Nook</button>' +
                '</div>';

    var body = document.createElement('div');
    body.id = 'questHubBody';
    body.style.cssText = 'padding:0 24px 24px;overflow-y:auto;flex:1;';

    modal.appendChild(header);
    modal.appendChild(body);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    _renderQuestHubTab();

    // History: push state so browser/swipe back closes/reopens Quest Hub
    // Save the current path so close buttons can restore it without history.back()
    window._qhReturnPath = window.location.pathname + (window.location.hash !== '#questhub' ? window.location.hash : '');
    if (window.location.hash !== '#questhub') {
        history.pushState({ overlay: 'questhub' }, '', '#questhub');
    }
    // Popstate: back gesture/button returns to Quest Hub
    function _qhPopHandler(e) {
        var ov = document.getElementById('questHubOverlay');
        if (!ov) return; // already closed
        // If user navigated back, close gracefully (don't re-push)
        window._cleanupRaidBoss && window._cleanupRaidBoss();
        ov.remove();
    }
    window._qhPopHandler = _qhPopHandler;
    window.addEventListener('popstate', _qhPopHandler, { once: true });
};

function _renderQuestHubTab() {
    var tab = window._questHubTab || 'quiz';
    // Update active tab styles
    ['Quiz', 'Trivia', 'Poll', 'Flex', 'Favor', 'Raid', 'Citadel', 'Charity', 'Community', 'Nook'].forEach(function(t) {
        var btn = document.getElementById('qhTab' + t);
        if (!btn) return;
        var isActive = tab === t.toLowerCase();
        var raidActive = t === 'Raid' && isActive;
        var charityActive = t === 'Charity' && isActive;
        var flexActive = t === 'Flex' && isActive;
        var citadelActive = t === 'Citadel' && isActive;
        var communityActive = t === 'Community' && isActive;
        var nookActive = t === 'Nook' && isActive;
        btn.style.background = raidActive ? 'linear-gradient(135deg,#8b5cf6,#7c3aed)' : charityActive ? 'linear-gradient(135deg,#ef4444,#dc2626)' : flexActive ? 'linear-gradient(135deg,#f7931a,#22c55e)' : citadelActive ? 'linear-gradient(135deg,#f59e0b,#d97706)' : communityActive ? 'linear-gradient(135deg,#06b6d4,#0284c7)' : nookActive ? 'linear-gradient(135deg,#f7931a,#eab308)' : (isActive ? 'var(--accent)' : 'none');
        btn.style.color = isActive ? '#fff' : 'var(--text-muted)';
        btn.style.borderColor = raidActive ? '#8b5cf6' : charityActive ? '#ef4444' : flexActive ? '#f7931a' : citadelActive ? '#f59e0b' : communityActive ? '#06b6d4' : nookActive ? '#f7931a' : (isActive ? 'var(--accent)' : 'var(--border)');
    });

    var body = document.getElementById('questHubBody');
    if (!body) return;

    // Cleanup raid listeners when switching away
    if (tab !== 'raid') window._cleanupRaidBoss();

    if (tab === 'quiz') _renderQuizTab(body);
    else if (tab === 'trivia') _renderTriviaTab(body);
    else if (tab === 'poll') _renderPollTab(body);
    else if (tab === 'raid') _renderRaidTab(body);
    else if (tab === 'favor') _renderFavorTab(body);
    else if (tab === 'charity') _renderCharityTab(body);
    else if (tab === 'flex') _renderFlexTab(body);
    else if (tab === 'citadel') _renderCitadelTab(body);
    else if (tab === 'community') _renderCommunityTab(body);
    else if (tab === 'nook') _renderNookTab(body);
}

// ══════════════════════════════════════════════════════
// 🦌 NACHO'S NOOK TAB — Shop, Inventory, History
// ══════════════════════════════════════════════════════

window._nookSubTab = window._nookSubTab || 'shop';

function _renderNookTab(body) {
    if (!body) return;
    var isSignedIn = typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous;

    if (!isSignedIn) {
        body.innerHTML = '<div style="text-align:center;padding:40px 20px;">' +
            '<div style="font-size:3rem;margin-bottom:12px;">🦌</div>' +
            '<div style="font-size:1.1rem;font-weight:800;color:var(--heading);margin-bottom:8px;">Nacho\'s Nook</div>' +
            '<div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:20px;">Sign in to browse the shop and spend your Orange Tickets!</div>' +
            '<div style="padding:12px 20px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.3);border-radius:12px;display:inline-block;font-size:0.85rem;color:#f7931a;">🎟️ Orange Tickets are earned by logging in, spinning the wheel, and completing quests.</div>' +
            '</div>';
        return;
    }

    body.innerHTML = '<div id="nookRoot"></div>';
    _renderNookSubTabs();
}

function _renderNookSubTabs() {
    var root = document.getElementById('nookRoot');
    if (!root) return;
    var tab = window._nookSubTab || 'shop';
    var tickets = typeof currentUser !== 'undefined' && currentUser ? (currentUser.orangeTickets || 0) : 0;

    var subTabBar = '<div style="display:flex;gap:6px;margin-bottom:16px;">' +
        ['shop','inventory','history'].map(function(st) {
            var labels = { shop:'🛒 Shop', inventory:'📦 Inventory', history:'📜 History' };
            var active = st === tab;
            return '<button onclick="window._nookSubTab=\''+st+'\';_renderNookSubTabs()" style="flex:1;padding:8px 0;border-radius:10px;border:1px solid '+(active ? '#f7931a' : 'var(--border)')+';background:'+(active ? 'linear-gradient(135deg,#f7931a,#eab308)' : 'none')+';color:'+(active ? '#fff' : 'var(--text-muted)')+';font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">'+labels[st]+'</button>';
        }).join('') +
    '</div>';

    var balanceBar = '<div style="display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,rgba(247,147,26,0.12),rgba(234,179,8,0.06));border:1px solid rgba(247,147,26,0.3);border-radius:12px;padding:10px 14px;margin-bottom:14px;">' +
        '<div style="font-size:0.85rem;color:var(--text-muted);">Your balance</div>' +
        '<div style="font-size:1.1rem;font-weight:800;color:#f7931a;">' + tickets + ' 🎟️</div>' +
    '</div>';

    root.innerHTML = '<div style="padding-top:4px;">' +
        '<div style="text-align:center;margin-bottom:12px;">' +
        '<span style="font-size:1.5rem;">🦌</span> ' +
        '<span style="font-size:1rem;font-weight:800;color:var(--heading);">Nacho\'s Nook</span>' +
        '</div>' +
        subTabBar + balanceBar +
        '<div id="nookTabContent"></div>' +
    '</div>';

    if (tab === 'shop') _renderNookShop();
    else if (tab === 'inventory') _renderNookInventory();
    else if (tab === 'history') _renderNookHistory();
}

function _nookBuyItem(itemId, qty, btnEl) {
    if (!btnEl) return;
    btnEl.disabled = true;
    var origText = btnEl.textContent;
    btnEl.textContent = '⏳';
    btnEl.style.opacity = '0.6';

    var spendFn = typeof firebase !== 'undefined' ? firebase.functions().httpsCallable('spendTickets') : null;
    if (!spendFn) {
        if (typeof showToast === 'function') showToast('❌ Shop unavailable — no connection');
        btnEl.disabled = false; btnEl.textContent = origText; btnEl.style.opacity = '';
        return;
    }

    spendFn({ itemId: itemId, quantity: qty || 1 }).then(function(result) {
        var d = result.data;
        if (d && d.success) {
            if (typeof currentUser !== 'undefined' && currentUser) {
                currentUser.orangeTickets = d.newTickets;
                // Sync all inventory fields returned by server so UI reflects true counts
                if (d.inventory) {
                    var inv = d.inventory;
                    if (inv.streakFreezes   !== undefined) currentUser.streakFreezes   = inv.streakFreezes;
                    if (inv.hashBoosters    !== undefined) currentUser.hashBoosters    = inv.hashBoosters;
                    if (inv.hintTokens      !== undefined) currentUser.hintTokens      = inv.hintTokens;
                    if (inv.doubleXPCharges !== undefined) currentUser.doubleXPCharges = inv.doubleXPCharges;
                    if (inv.bonusSpins      !== undefined) currentUser.bonusSpins      = inv.bonusSpins;
                    if (inv.raffleEntries      !== undefined) currentUser.raffleEntries      = inv.raffleEntries;
                    if (inv.secondRigCharges   !== undefined) currentUser.secondRigCharges   = inv.secondRigCharges;
                    if (inv.ownedCosmetics     !== undefined) currentUser.ownedCosmetics     = inv.ownedCosmetics;
                }
            }
            if (typeof updateRankUI === 'function') updateRankUI();
            if (typeof showToast === 'function') showToast('✅ Purchased! Balance: ' + d.newTickets + ' 🎟️');
            // Cosmetic post-purchase effects
            // second_rig is consumable (not cosmetic) but still gets a purchase tip toast
            var _postPurchaseTipIds = ['profile_frame','chat_flair','pinned_badge','nacho_skin_nook','second_rig'];
            if (_postPurchaseTipIds.indexOf(itemId) !== -1 && typeof window._cosmeticPostPurchase === 'function') {
                window._cosmeticPostPurchase(itemId);
            }
            // Re-render nook to reflect new balance/inventory
            setTimeout(function() { _renderNookSubTabs(); }, 300);
        }
    }).catch(function(err) {
        var msg = (err && err.message) ? err.message : 'Purchase failed';
        if (typeof showToast === 'function') showToast('❌ ' + msg);
        btnEl.disabled = false;
        btnEl.textContent = origText;
        btnEl.style.opacity = '';
    });
}

function _nookConvertXP(tickets, btnEl) {
    if (!btnEl) return;
    btnEl.disabled = true;
    var origText = btnEl.textContent;
    btnEl.textContent = '⏳';
    btnEl.style.opacity = '0.6';

    var convertFn = typeof firebase !== 'undefined' ? firebase.functions().httpsCallable('convertPointsToTickets') : null;
    if (!convertFn) {
        if (typeof showToast === 'function') showToast('❌ Service unavailable');
        btnEl.disabled = false; btnEl.textContent = origText; btnEl.style.opacity = '';
        return;
    }

    convertFn({ tickets: tickets }).then(function(result) {
        var d = result.data;
        if (d && d.success) {
            if (typeof currentUser !== 'undefined' && currentUser) {
                currentUser.orangeTickets = d.newTickets;
                currentUser.points = d.newPoints;
            }
            if (typeof updateRankUI === 'function') updateRankUI();
            if (typeof showToast === 'function') showToast('💱 Converted! +' + tickets + ' 🎟️. Balance: ' + d.newTickets + ' tickets. ' + (d.remaining > 0 ? d.remaining + ' exchanges left today.' : 'Daily limit reached.'));
            setTimeout(function() { _renderNookSubTabs(); }, 300);
        }
    }).catch(function(err) {
        var msg = (err && err.message) ? err.message : 'Conversion failed';
        if (typeof showToast === 'function') showToast('❌ ' + msg);
        btnEl.disabled = false;
        btnEl.textContent = origText;
        btnEl.style.opacity = '';
    });
}

function _renderNookShop() {
    var el = document.getElementById('nookTabContent');
    if (!el) return;
    var u = typeof currentUser !== 'undefined' && currentUser ? currentUser : {};
    var tickets = u.orangeTickets || 0;
    var pts = u.points || 0;
    var ownedCosmetics = u.ownedCosmetics || [];

    function buyBtn(itemId, cost, qty, label, extraStyle) {
        var canAfford = tickets >= cost * (qty || 1);
        var style = 'padding:6px 14px;border-radius:8px;border:none;font-size:0.78rem;font-weight:700;cursor:'+(canAfford?'pointer':'not-allowed')+';font-family:inherit;background:'+(canAfford?'linear-gradient(135deg,#f7931a,#e8720c)':'rgba(255,255,255,0.05)')+';color:'+(canAfford?'#fff':'var(--text-faint)')+';opacity:'+(canAfford?'1':'0.5')+';transition:0.2s;'+(extraStyle||'');
        return '<button onclick="_nookBuyItem(\''+itemId+'\','+(qty||1)+',this)" '+(canAfford?'':'disabled')+'style="'+style+'">'+label+'</button>';
    }

    function itemRow(icon, name, desc, cost, btnHtml) {
        return '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--card-bg,#1a1a2e);border:1px solid var(--border);border-radius:12px;">' +
            '<div style="font-size:1.4rem;flex-shrink:0;padding-top:2px;">'+icon+'</div>' +
            '<div style="flex:1;min-width:0;"><div style="font-size:0.85rem;font-weight:700;color:var(--heading);">'+name+'</div>' +
            '<div style="font-size:0.72rem;color:var(--text-muted);">'+desc+'</div><!--EXTRA_HTML--></div>' +
            '<div style="flex-shrink:0;text-align:right;"><div style="font-size:0.78rem;color:#f7931a;font-weight:800;">'+cost+' 🎟️</div>' + btnHtml + '</div>' +
        '</div>';
    }

    // XP→Tickets exchange panel
    var xpPanel = '<div style="background:linear-gradient(135deg,rgba(34,197,94,0.08),rgba(22,163,74,0.04));border:1px solid rgba(34,197,94,0.25);border-radius:14px;padding:14px 16px;margin-bottom:16px;">' +
        '<div style="font-size:0.75rem;font-weight:800;color:#22c55e;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">💱 XP → Tickets Exchange</div>' +
        '<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:10px;">500 XP = 1 🎟️ · Max 10/day · Your XP: <strong style="color:var(--text);">'+pts.toLocaleString()+'</strong></div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
        [1,5,10].map(function(n) {
            var cost = n * 500;
            var canConvert = pts >= cost;
            return '<button onclick="_nookConvertXP('+n+',this)" '+(canConvert?'':'disabled')+' style="padding:7px 14px;border-radius:8px;border:1px solid '+(canConvert?'#22c55e':'var(--border)')+';background:'+(canConvert?'rgba(34,197,94,0.12)':'rgba(255,255,255,0.02)')+';color:'+(canConvert?'#22c55e':'var(--text-faint)')+';font-size:0.78rem;font-weight:700;cursor:'+(canConvert?'pointer':'not-allowed')+';font-family:inherit;opacity:'+(canConvert?'1':'0.5')+';">' +
                'Buy '+n+' ('+cost.toLocaleString()+' XP)' +
            '</button>';
        }).join('') +
        '</div>' +
    '</div>';

    var html = xpPanel;

    // ─── Consumables ───
    html += '<div style="font-size:0.72rem;font-weight:800;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin:14px 0 8px;">─── Consumables ───</div>';
    html += '<div style="display:flex;flex-direction:column;gap:6px;">';
    html += itemRow('🧊','Streak Freeze','Auto-used to protect your streak',5,buyBtn('streak_freeze',5,1,'Buy'));
    html += itemRow('🧊','3× Streak Freezes','Bundle — save 3 tickets',12,buyBtn('streak_freeze_3',12,1,'Bundle'));
    html += itemRow('⚡','Hash Booster','+100 instant hashes — no cooldown. Activate from Inventory during an open SF window.',10,buyBtn('hash_booster',10,1,'Buy'));
    html += itemRow('🧠','Hint Token','Eliminate a wrong answer in any quiz',3,buyBtn('hint_token',3,1,'Buy'));
    html += itemRow('🧠','5× Hint Tokens','Bundle deal',12,buyBtn('hint_token_5',12,1,'Bundle'));
    html += itemRow('🎯','Double XP (60 min)','2× XP multiplier for 1 hour',15,buyBtn('double_xp',15,1,'Buy'));
    html += itemRow('🎰','Bonus Spin','Extra spin on the daily wheel',5,buyBtn('bonus_spin',5,1,'Buy'));
    html += '</div>';

    // ─── Mining Upgrades ───
    html += '<div style="font-size:0.72rem;font-weight:800;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin:14px 0 8px;">─── ⛏️ Mining Upgrades ───</div>';
    html += '<div style="display:flex;flex-direction:column;gap:6px;">';
    var rigCharges = u.secondRigCharges || 0;
    var rigBtnHtml = (rigCharges > 0
        ? '<span style="font-size:0.72rem;color:#22c55e;font-weight:700;margin-right:6px;">' + rigCharges + ' charge' + (rigCharges !== 1 ? 's' : '') + ' left</span>'
        : '') + buyBtn('second_rig', 25, 1, 'Buy');
    html += itemRow('⚡', 'Second Mining Rig', 'Unlocks Hash #2 button for one SF window — buy more charges to keep it active.', 25, rigBtnHtml);
    html += '</div>';

    // ─── Cosmetics ───
    html += '<div style="font-size:0.72rem;font-weight:800;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin:14px 0 8px;">─── Cosmetics (Permanent) ───</div>';
    html += '<div style="display:flex;flex-direction:column;gap:6px;">';
    var cosmetics = [
        { id:'profile_frame', icon:'🪪', name:'Profile Frame', desc:'Exclusive border on your profile card', cost:50 },
        { id:'chat_flair', icon:'💬', name:'Chat Flair', desc:'Special badge next to your name in chat', cost:40 },
        { id:'pinned_badge', icon:'📌', name:'Pinned Badge', desc:'Showcase a permanent achievement badge', cost:20 },
        { id:'nacho_skin_nook', icon:'🦌', name:'Exclusive Nacho Skin', desc:'Rare Nacho avatar — Nook exclusive!', cost:60 },
    ];
    cosmetics.forEach(function(c) {
        var owned = ownedCosmetics.indexOf(c.id) !== -1;
        var btnHtml = owned
            ? '<div style="padding:5px 10px;background:rgba(34,197,94,0.1);border:1px solid #22c55e;border-radius:8px;font-size:0.75rem;color:#22c55e;font-weight:700;margin-top:4px;">Owned \u2713</div>'
            : buyBtn(c.id, c.cost, 1, 'Buy');
        // Add preview/action elements for certain cosmetics
        var extraHtml = '';
        if (c.id === 'nacho_skin_nook') {
            extraHtml = '<div style="display:flex;align-items:center;gap:8px;margin-top:6px;padding:6px 8px;background:rgba(247,147,26,0.08);border-radius:8px;">' +
                '<img src="nacho-deer.svg" style="width:36px;height:36px;border-radius:50%;border:2px solid #f7931a;filter:drop-shadow(0 0 6px rgba(247,147,26,0.6));" onerror="this.style.display=\'none\'">' +
                '<span style="font-size:0.72rem;color:var(--text-muted);">Your avatar gets a golden Nacho glow in chat and on your profile!</span>' +
            '</div>';
        }
        if (c.id === 'chat_flair' && owned) {
            var currentFlair = (typeof currentUser !== 'undefined' && currentUser && currentUser.chatFlairEmoji) ? currentUser.chatFlairEmoji : '\uD83D\uDD25';
            extraHtml = '<button onclick="window._showChatFlairPicker()" style="margin-top:5px;padding:4px 10px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.3);border-radius:8px;font-size:0.72rem;color:#f7931a;font-weight:700;cursor:pointer;font-family:inherit;">Change Flair ' + currentFlair + '</button>';
        }
        if (c.id === 'pinned_badge' && owned) {
            extraHtml = '<button onclick="window._showPinnedBadgeSelector()" style="margin-top:5px;padding:4px 10px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.3);border-radius:8px;font-size:0.72rem;color:#f7931a;font-weight:700;cursor:pointer;font-family:inherit;">Choose Badge \uD83D\uDCCC</button>';
        }
        // Build itemRow and inject extra HTML inside the left text column
        var rowHtml = itemRow(c.icon, c.name, c.desc, c.cost, btnHtml);
        if (extraHtml) {
            rowHtml = rowHtml.replace('<!--EXTRA_HTML-->', extraHtml);
        } else {
            rowHtml = rowHtml.replace('<!--EXTRA_HTML-->', '');
        }
        html += rowHtml;
    });
    html += '</div>';

    // ─── Raffle ───
    html += '<div style="font-size:0.72rem;font-weight:800;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin:14px 0 8px;">─── Monthly Raffle ───</div>';
    var raffleEntries = u.raffleEntries || 0;
    html += '<div style="background:linear-gradient(135deg,rgba(234,179,8,0.1),rgba(247,147,26,0.05));border:1px solid rgba(234,179,8,0.3);border-radius:12px;padding:12px 14px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;">' +
        '<div style="flex:1;">' +
        '<div style="font-size:0.85rem;font-weight:700;color:var(--heading);">🎟️ Sats Raffle Entry</div>' +
        '<div style="font-size:0.72rem;color:#f7931a;font-weight:800;margin-top:2px;">⚡ Prize: 21,000 sats</div>' +
        '<div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">Your entries this month: <strong style="color:#eab308;">' + raffleEntries + '</strong> · Enter through July — first drawing August 1st!</div>' +
        '<div id="_raffleCommTotal" style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">🎟️ Community entries this month: ...</div>' +
        '</div>' +
        '<div style="text-align:right;flex-shrink:0;"><div style="font-size:0.78rem;color:#f7931a;font-weight:800;margin-bottom:4px;">10 🎟️</div>' +
        buyBtn('raffle_entry', 10, 1, 'Enter') +
        '</div>' +
        '</div>' +
    '</div>';
    // Fetch community raffle total asynchronously (month-scoped)
    (function() {
        if (typeof db === 'undefined') return;
        var monthKey = new Date().toISOString().slice(0,7); // YYYY-MM
        db.collection('stats').doc('raffle_' + monthKey).get().then(function(snap) {
            var el2 = document.getElementById('_raffleCommTotal');
            if (!el2) return;
            var tot = (snap.exists && snap.data() && snap.data().totalEntries) ? snap.data().totalEntries : 0;
            el2.textContent = '🎟️ Community entries this month: ' + tot;
        }).catch(function() {});
    })();

    el.innerHTML = html;
}

function _renderNookInventory() {
    var el = document.getElementById('nookTabContent');
    if (!el) return;

    // Always fetch fresh inventory from Firestore so server-side grants/migrations show immediately
    var uid = (typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous)
        ? auth.currentUser.uid : null;
    if (uid && typeof db !== 'undefined' && !window._nookInvRefreshing) {
        window._nookInvRefreshing = true;
        el.innerHTML = '<div style="text-align:center;padding:32px 20px;color:var(--text-muted);font-size:0.8rem;">⏳ Fetching inventory...</div>';
        db.collection('users').doc(uid).get().then(function(doc) {
            window._nookInvRefreshing = false;
            if (doc.exists && typeof currentUser !== 'undefined' && currentUser) {
                var fresh = doc.data();
                // Sync all inventory fields from server into currentUser
                var invFields = ['streakFreezes','hintTokens','hashBoosters','doubleXPCharges','bonusSpins',
                    'raffleEntries','secondRigCharges','ownedCosmetics','orangeTickets','doubleXPExpiry'];
                invFields.forEach(function(f) {
                    if (fresh[f] !== undefined) currentUser[f] = fresh[f];
                    else if (currentUser[f] === undefined) currentUser[f] = null;
                });
            }
            var el2 = document.getElementById('nookTabContent');
            if (el2) _renderNookInventoryContent(el2);
        }).catch(function() {
            window._nookInvRefreshing = false;
            var el2 = document.getElementById('nookTabContent');
            if (el2) _renderNookInventoryContent(el2);
        });
        return;
    }
    window._nookInvRefreshing = false;
    _renderNookInventoryContent(el);
}

function _renderNookInventoryContent(el) {
    var u = typeof currentUser !== 'undefined' && currentUser ? currentUser : {};

    var freezes = u.streakFreezes || 0;
    var hintTokens = u.hintTokens || 0;
    var hashBoosters = u.hashBoosters || 0;
    var doubleXPCharges = u.doubleXPCharges || 0;
    var bonusSpins = u.bonusSpins || 0;
    var raffleEntries = u.raffleEntries || 0;
    var secondRigCharges = u.secondRigCharges || 0;
    var ownedCosmetics = u.ownedCosmetics || [];

    // Double XP active countdown
    var doubleXPExpiry = u.doubleXPExpiry;
    var doubleXPActive = doubleXPExpiry && (doubleXPExpiry > Date.now());
    var doubleXPMin = doubleXPActive ? Math.ceil((doubleXPExpiry - Date.now()) / 60000) : 0;

     function invRow(icon, name, qty, actionHtml, noteHtml) {
        var hasItems = qty > 0;
        var borderC = hasItems ? 'var(--border)' : 'rgba(255,255,255,0.06)';
        var opC = hasItems ? '1' : '0.5';
        var txtC = hasItems ? 'var(--heading)' : 'var(--text-faint)';
        var icnC = hasItems ? '#f7931a' : 'var(--text-faint)';
        return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--card-bg,#1a1a2e);border:1px solid ' + borderC + ';border-radius:12px;opacity:' + opC + '">' +
            '<div style="font-size:1.4rem;flex-shrink:0;">' + icon + '</div>' +
            '<div style="flex:1;min-width:0;"><div style="font-size:0.85rem;font-weight:700;color:var(--heading);">' + name + '</div>' +
            (noteHtml ? '<div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">' + noteHtml + '</div>' : '') +
            '</div>' +
            '<div style="flex-shrink:0;text-align:right;"><div style="font-size:0.85rem;font-weight:800;color:' + txtC + ';">' +
            '<span style="color:' + icnC + ';font-size:1rem;">×</span> ' + qty + '</div>' +
            (hasItems ? actionHtml : '') +
            '</div>' +
        '</div>';
    }

    var html = '<div style="display:flex;flex-direction:column;gap:6px;">';

    // Streak Freezes
    html += invRow('🧊', 'Streak Freezes', freezes,
        '',
        'Auto-applied when you miss a day — nothing to do!');

    // Hash Boosters
    html += invRow('⚡', 'Hash Boosters', hashBoosters,
        '<button onclick="_nookActivateHashBooster(this)" style="margin-top:4px;padding:5px 12px;background:linear-gradient(135deg,#f7931a,#ea580c);border:none;border-radius:8px;color:#fff;font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit;">Activate</button>',
        'Tap Activate during an open SF window. Grants 100 hashes with NO cooldown — hammer away! Normal rate limit resumes after.');

    // Hint Tokens
    html += invRow('🧠', 'Hint Tokens', hintTokens,
        '',
        'Used automatically from quiz screen — shows 💡 button');

    // Double XP
    html += invRow('🎯', 'Double XP Charges', doubleXPCharges,
        doubleXPActive
            ? '<div style="margin-top:4px;padding:4px 10px;background:rgba(34,197,94,0.15);border:1px solid #22c55e;border-radius:8px;font-size:0.72rem;color:#22c55e;font-weight:700;">✅ Active — '+doubleXPMin+' min left</div>'
            : '<button onclick="_nookActivateDoubleXP(this)" style="margin-top:4px;padding:5px 12px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);border:none;border-radius:8px;color:#fff;font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit;">Activate</button>',
        doubleXPActive ? '🎯 Double XP is ACTIVE (' + doubleXPMin + ' min remaining)' : '2× XP multiplier for 1 hour');

    // Bonus Spins
    html += invRow('🎰', 'Bonus Spins', bonusSpins,
        '<button onclick="_nookUseBonusSpin(this)" style="margin-top:4px;padding:5px 12px;background:linear-gradient(135deg,#a855f7,#7c3aed);border:none;border-radius:8px;color:#fff;font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit;">Use</button>',
        'Spin the wheel without using your daily spin');

    // Raffle entries
    html += invRow('🎲', 'Raffle Entries (this month)', raffleEntries,
        '',
        'Winner announced on the 1st of each month!');

    // Second Rig charges
    html += invRow('⚡', 'Second Mining Rig', secondRigCharges,
        secondRigCharges > 0 ? '<button onclick="window._qhReopenOnMinerClose=false;if(window.closeQuestHubForFavor)window.closeQuestHubForFavor();setTimeout(function(){if(window.openSatoshiFavorMiner)window.openSatoshiFavorMiner();},100);" style="margin-top:4px;padding:5px 12px;background:linear-gradient(135deg,#8b5cf6,#7c3aed);border:none;border-radius:8px;color:#fff;font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit;">⛏️ Deploy Rig</button>' : '',
        secondRigCharges > 0 ? 'Tap Deploy Rig to open the miner — Hash #2 button will appear!' : 'Each charge unlocks Hash #2 for one SF mining window.');

    html += '</div>';

    // Cosmetics
    if (ownedCosmetics.length > 0) {
        var cosmeticLabels = {
            profile_frame: { icon:'🪪', name:'Profile Frame' },
            chat_flair:    { icon:'💬', name:'Chat Flair' },
            pinned_badge:  { icon:'📌', name:'Pinned Badge' },
            nacho_skin_nook: { icon:'🦌', name:'Exclusive Nacho Skin' },
            second_rig:     { icon:'⚡', name:'Second Mining Rig (legacy)' },
        };
        html += '<div style="font-size:0.72rem;font-weight:800;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin:12px 0 8px;">Cosmetics Owned</div>';
        html += '<div style="display:flex;flex-direction:column;gap:6px;">';
        ownedCosmetics.forEach(function(cid) {
            var meta = cosmeticLabels[cid] || { icon:'✨', name: cid };
            var actionBtn = '';
            if (cid === 'chat_flair') {
                actionBtn = '<button onclick="window._showChatFlairPicker()" style="margin-left:6px;padding:4px 10px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.3);border-radius:8px;font-size:0.7rem;color:#f7931a;font-weight:700;cursor:pointer;font-family:inherit;">Change Flair</button>';
            } else if (cid === 'pinned_badge') {
                actionBtn = '<button onclick="window._showPinnedBadgeSelector()" style="margin-left:6px;padding:4px 10px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.3);border-radius:8px;font-size:0.7rem;color:#f7931a;font-weight:700;cursor:pointer;font-family:inherit;">Choose Badge</button>';
            }
            html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:linear-gradient(135deg,rgba(247,147,26,0.06),rgba(234,179,8,0.03));border:1px solid rgba(247,147,26,0.2);border-radius:12px;">' +
                '<div style="font-size:1.4rem;">' + meta.icon + '</div>' +
                '<div style="flex:1;"><div style="font-size:0.85rem;font-weight:700;color:var(--heading);">' + meta.name + '</div></div>' +
                '<div style="display:flex;align-items:center;"><div style="padding:5px 10px;background:rgba(34,197,94,0.1);border:1px solid #22c55e;border-radius:8px;font-size:0.72rem;color:#22c55e;font-weight:700;">Owned ✓</div>' + actionBtn + '</div>' +
            '</div>';
        });
        html += '</div>';
    }

    if (freezes === 0 && hintTokens === 0 && hashBoosters === 0 && doubleXPCharges === 0 && bonusSpins === 0 && raffleEntries === 0 && secondRigCharges === 0 && ownedCosmetics.length === 0) {
        html = '<div style="text-align:center;padding:32px 20px;">' +
            '<div style="font-size:2.5rem;margin-bottom:12px;">📦</div>' +
            '<div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:8px;">Your inventory is empty.</div>' +
            '<div style="font-size:0.78rem;color:var(--text-faint);">Visit the Shop to buy items with your Orange Tickets 🎟️</div>' +
        '</div>';
    }

    el.innerHTML = html;
}

window._nookActivateHashBooster = function(btnEl) {
    if (!btnEl) return;
    btnEl.disabled = true;
    var origText = btnEl.textContent;
    btnEl.textContent = '⏳';
    var fn = typeof firebase !== 'undefined' ? firebase.functions().httpsCallable('activateHashBooster') : null;
    if (!fn) { btnEl.disabled = false; btnEl.textContent = origText; return; }
    fn({}).then(function(r) {
        var d = r.data;
        if (d && d.success) {
            if (typeof currentUser !== 'undefined' && currentUser) {
                currentUser.hashBoosters = d.hashBoosters;
                currentUser.hashBoosterHashes = d.hashBoosterHashes;
            }
            if (typeof showToast === 'function') showToast('⚡ Hash Booster activated! 100 instant hashes ready — no cooldown until they\'re gone!');
            _renderNookSubTabs();
        }
    }).catch(function(err) {
        var msg = (err && err.message) ? err.message : 'Activation failed';
        if (typeof showToast === 'function') showToast('❌ ' + msg);
        btnEl.disabled = false;
        btnEl.textContent = origText;
    });
};

window._nookActivateDoubleXP = function(btnEl) {
    if (!btnEl) return;
    btnEl.disabled = true;
    var origText = btnEl.textContent;
    btnEl.textContent = '⏳';
    var fn = typeof firebase !== 'undefined' ? firebase.functions().httpsCallable('activateDoubleXP') : null;
    if (!fn) { btnEl.disabled = false; btnEl.textContent = origText; return; }
    fn({}).then(function(r) {
        var d = r.data;
        if (d && d.success) {
            if (typeof currentUser !== 'undefined' && currentUser) {
                currentUser.doubleXPCharges = d.charges;
                currentUser.doubleXPExpiry = d.doubleXPExpiry;
            }
            var msg = d.extended ? '🎯 Double XP extended! Active for another hour.' : '🎯 Double XP activated! 2× XP for the next 60 minutes!';
            if (typeof showToast === 'function') showToast(msg);
            if (typeof window._startDoubleXPWidget === 'function') window._startDoubleXPWidget();
            _renderNookSubTabs();
        }
    }).catch(function(err) {
        var msg = (err && err.message) ? err.message : 'Activation failed';
        if (typeof showToast === 'function') showToast('❌ ' + msg);
        btnEl.disabled = false;
        btnEl.textContent = origText;
    });
};

window._nookUseBonusSpin = function(btnEl) {
    if (!btnEl) return;
    btnEl.disabled = true;
    var origText = btnEl.textContent;
    btnEl.textContent = '⏳';
    var fn = typeof firebase !== 'undefined' ? firebase.functions().httpsCallable('useBonusSpin') : null;
    if (!fn) { btnEl.disabled = false; btnEl.textContent = origText; return; }
    fn({}).then(function(r) {
        var d = r.data;
        if (d && d.success) {
            if (typeof currentUser !== 'undefined' && currentUser) currentUser.bonusSpins = d.bonusSpins;
            if (typeof showToast === 'function') showToast('🎰 Bonus spin unlocked! Opening the wheel...');
            _renderNookSubTabs();
            // Trigger spin wheel without daily check
            setTimeout(function() {
                if (typeof showSpinWheel === 'function') {
                    window._bonusSpinActive = true;
                    showSpinWheel();
                }
            }, 400);
        }
    }).catch(function(err) {
        var msg = (err && err.message) ? err.message : 'Failed to use bonus spin';
        if (typeof showToast === 'function') showToast('❌ ' + msg);
        btnEl.disabled = false;
        btnEl.textContent = origText;
    });
};

function _renderNookHistory() {
    var el = document.getElementById('nookTabContent');
    if (!el) return;
    if (typeof firebase === 'undefined' || !firebase.firestore || !auth || !auth.currentUser) {
        el.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:20px 0;text-align:center;">Unavailable</div>';
        return;
    }

    el.innerHTML = '<div style="text-align:center;padding:20px 0;color:var(--text-muted);font-size:0.82rem;">Loading history...</div>';

    var uid = auth.currentUser.uid;
    firebase.firestore().collection('users').doc(uid).collection('shop_purchases')
        .orderBy('ts', 'desc').limit(20).get().then(function(snap) {
            if (snap.empty) {
                el.innerHTML = '<div style="text-align:center;padding:32px 0;">' +
                    '<div style="font-size:2rem;margin-bottom:10px;">📜</div>' +
                    '<div style="color:var(--text-muted);font-size:0.85rem;">No purchases yet.</div>' +
                    '<div style="color:var(--text-faint);font-size:0.75rem;margin-top:4px;">Your purchase history will appear here.</div>' +
                '</div>';
                return;
            }

            var rows = '';
            snap.forEach(function(doc) {
                var p = doc.data();
                var ts = p.ts ? (p.ts.toDate ? p.ts.toDate() : new Date(p.ts)) : new Date();
                var dateStr = ts.toLocaleDateString() + ' ' + ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                var costStr = p.costType === 'points'
                    ? (p.cost || 0).toLocaleString() + ' XP'
                    : (p.cost || 0) + ' 🎟️';
                var balStr = typeof p.ticketsAfter !== 'undefined' ? ' · Balance after: ' + p.ticketsAfter + ' 🎟️' : '';
                rows += '<div style="padding:10px 12px;background:var(--card-bg,#1a1a2e);border:1px solid var(--border);border-radius:10px;">' +
                    '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
                    '<div style="font-size:0.82rem;font-weight:700;color:var(--heading);">' + (p.itemName || p.itemId || '—') + '</div>' +
                    '<div style="font-size:0.78rem;color:#f7931a;font-weight:700;">' + costStr + '</div>' +
                    '</div>' +
                    '<div style="font-size:0.7rem;color:var(--text-faint);margin-top:3px;">' + dateStr + balStr + '</div>' +
                '</div>';
            });

            el.innerHTML = '<div style="display:flex;flex-direction:column;gap:6px;">' + rows + '</div>';
        }).catch(function(err) {
            el.innerHTML = '<div style="color:var(--text-muted);font-size:0.82rem;padding:20px;text-align:center;">⚠️ Failed to load history.</div>';
        });
}

// ── CITADEL TAB ──
function _renderCitadelTab(body) {
    body.innerHTML =
        '<div style="text-align:center;padding:32px 16px;">' +
        '<div style="font-size:3rem;margin-bottom:16px;">🏰</div>' +
        '<div style="display:inline-block;background:linear-gradient(135deg,#f59e0b22,#d9770622);border:1px solid #f59e0b55;border-radius:16px;padding:24px 28px;max-width:360px;">' +
        '<div style="font-size:0.7rem;font-weight:900;letter-spacing:2px;color:#f59e0b;text-transform:uppercase;margin-bottom:10px;">Coming Soon</div>' +
        '<div style="font-size:1.15rem;font-weight:800;color:var(--heading);line-height:1.4;margin-bottom:12px;">USE XP TO CONSTRUCT YOUR OWN CITADEL!</div>' +
        '<div style="font-size:0.85rem;color:var(--text-muted);line-height:1.5;">Spend your hard-earned XP to build, upgrade, and defend your own Bitcoin citadel. Stack XP now — construction begins soon.</div>' +
        '</div>' +
        '</div>';
}

// ── CHARITY TAB ──
var _charityStats = null;
var _charityRecent = [];
var _charityStatsLoaded = false;

function _loadCharityStats(cb) {
    if (typeof firebase === 'undefined' || !firebase.firestore) return cb && cb();
    var db = firebase.firestore();
    Promise.all([
        db.collection('charity_stats').doc('global').get({ source: 'server' }),
        db.collection('charity_donations').orderBy('ts', 'desc').limit(10).get({ source: 'server' })
    ]).then(function(results) {
        var statsDoc = results[0];
        var recentSnap = results[1];
        _charityStats = statsDoc.exists ? statsDoc.data() : { totalDonated: 0, factionTotals: {} };
        _charityRecent = [];
        recentSnap.forEach(function(doc) { _charityRecent.push(doc.data()); });
        _charityStatsLoaded = true;
        if (cb) cb();
    }).catch(function() { if (cb) cb(); });
}

function _renderCharityTab(body) {
    body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-faint);font-size:0.85rem;">Loading charity data...</div>';
    _loadCharityStats(function() {
        _renderCharityTabInner(body);
    });
}

function _renderCharityTabInner(body) {
    var esc = typeof escapeHtml === 'function' ? escapeHtml : function(s) { return String(s || '').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
    var isSignedIn = typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous;
    var userFaction = typeof currentUser !== 'undefined' && currentUser ? (currentUser.faction || '') : '';
    var pts = typeof currentUser !== 'undefined' && currentUser ? (currentUser.points || 0) : 0;
    var claimed = typeof currentUser !== 'undefined' && currentUser ? (currentUser.pointsClaimed || 0) : 0;
    var donated = typeof currentUser !== 'undefined' && currentUser ? (currentUser.pointsDonated || 0) : 0;
    var available = Math.max(0, pts - claimed - donated);

    var stats = _charityStats || { totalDonated: 0, factionTotals: {} };
    var totalDonated = stats.totalDonated || 0;
    var hornets = (stats.factionTotals && stats.factionTotals.cyber_hornets) || 0;
    var badgers = (stats.factionTotals && stats.factionTotals.honey_badgers) || 0;
    var unattributed = (stats.factionTotals && stats.factionTotals.no_faction) || 0;

    var html = '';

    // Header
    html += '<div style="text-align:center;margin-bottom:20px;">' +
        '<div style="font-size:2rem;margin-bottom:6px;">❤️</div>' +
        '<div style="font-size:1.1rem;font-weight:800;color:var(--heading);">Donate XP for Charity</div>' +
        '<div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">1,000 XP = 1,000 sats donated - 10× more impact than redeeming for yourself</div>' +
    '</div>';

    // Community total
    html += '<div style="background:linear-gradient(135deg,rgba(239,68,68,0.1),rgba(220,38,38,0.05));border:1px solid rgba(239,68,68,0.3);border-radius:16px;padding:16px;text-align:center;margin-bottom:16px;">' +
        '<div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:1.5px;color:#ef4444;font-weight:800;margin-bottom:6px;">🌍 Community Pledge</div>' +
        '<div style="font-size:1.8rem;font-weight:900;color:var(--heading);">' + totalDonated.toLocaleString() + ' <span style="font-size:1rem;font-weight:600;color:var(--text-muted);">sats pledged</span></div>' +
        '<div style="font-size:0.75rem;color:var(--text-faint);margin-top:4px;">(' + totalDonated.toLocaleString() + ' XP donated by the community)</div>' +
    '</div>';

    // Faction leaderboard
    var factionTotal = hornets + badgers;
    var hornetsPct = factionTotal > 0 ? Math.round((hornets / factionTotal) * 100) : 50;
    var badgersPct = 100 - hornetsPct;
    html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:16px;">' +
        '<div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">⚔️ Faction Giving</div>' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:0.8rem;">' +
            '<span style="color:#f7e400;font-weight:700;text-shadow:-1px -1px 0 #000,1px -1px 0 #000,1px 1px 0 #000,-1px 1px 0 #000;">🐝 Cyber Hornets</span>' +
            '<span style="color:#1a1a1a;font-weight:700;text-shadow:-1px -1px 0 #000,1px -1px 0 #000,1px 1px 0 #000,-1px 1px 0 #000,0 0 3px #fff;">🦡 Honey Badgers</span>' +
        '</div>' +
        '<div style="display:flex;border-radius:8px;overflow:hidden;height:14px;margin-bottom:6px;">' +
            '<div style="width:' + hornetsPct + '%;background:linear-gradient(90deg,#f7e400,#f59e0b);transition:0.5s;"></div>' +
            '<div style="width:' + badgersPct + '%;background:linear-gradient(90deg,#374151,#1f2937);transition:0.5s;"></div>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-faint);">' +
            '<span>' + hornets.toLocaleString() + ' XP (' + hornetsPct + '%)</span>' +
            '<span>' + badgers.toLocaleString() + ' XP (' + badgersPct + '%)</span>' +
        '</div>' +
        (unattributed > 0 ? '<div style="margin-top:8px;padding:6px 10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;font-size:0.72rem;color:var(--text-faint);display:flex;justify-content:space-between;align-items:center;"><span>⏳ Unattributed (no faction at time of donation)</span><span style="font-weight:700;">' + unattributed.toLocaleString() + ' XP</span></div>' : '') +
    '</div>';

    // Donate UI
    if (!isSignedIn) {
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:20px;text-align:center;margin-bottom:16px;color:var(--text-muted);font-size:0.9rem;">' +
            '🔐 Sign in to donate XP for charity' +
        '</div>';
    } else if (!userFaction) {
        html += '<div style="background:var(--card-bg);border:1px solid rgba(247,147,26,0.3);border-radius:14px;padding:20px;text-align:center;margin-bottom:16px;">' +
            '<div style="font-size:1.6rem;margin-bottom:8px;">⚔️</div>' +
            '<div style="font-size:0.95rem;font-weight:700;color:var(--heading);margin-bottom:6px;">Choose Your Faction First</div>' +
            '<div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:16px;">Your faction\'s donation total is tracked for the community leaderboard. Join a side before you donate!</div>' +
            '<button onclick="window._onSettingsClose=function(){if(typeof showQuestHub===\'function\'){showQuestHub();window._questHubTab=\'charity\';setTimeout(function(){if(typeof _renderQuestHubTab===\'function\')_renderQuestHubTab();},50);}};document.getElementById(\'questHubOverlay\').remove();setTimeout(function(){if(typeof showSettings===\'function\')showSettings();setTimeout(function(){if(typeof showSettingsPage===\'function\')showSettingsPage(\'account\')},100)},100)" style="padding:12px 28px;background:linear-gradient(135deg,#f7931a,#e8720c);border:none;border-radius:12px;color:#fff;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;">🐝🦡 Choose Your Faction</button>' +
        '</div>';
    } else {
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:1px;">🎡 Your Donation</div>' +
            '<div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px;">' +
                'Available to donate: <strong style="color:var(--heading);">' + available.toLocaleString() + ' XP</strong>' +
                (donated > 0 ? ' <span style="color:var(--text-faint);font-size:0.75rem;">(' + donated.toLocaleString() + ' already donated)</span>' : '') +
            '</div>';

        // Quick-pick buttons
        var quickPcts = [5, 10, 25, 50, 100];
        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">';
        quickPcts.forEach(function(pct) {
            var amt = Math.floor(available * pct / 100);
            html += '<button onclick="window._charitySetAmount(' + amt + ')" style="flex:1;min-width:50px;padding:8px 4px;border-radius:10px;border:1px solid var(--border);background:none;color:var(--text-muted);font-size:0.78rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;" onmouseover="this.style.borderColor=\'#ef4444\';this.style.color=\'#ef4444\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.color=\'var(--text-muted)\'">' + pct + '%<br><span style="font-size:0.65rem;font-weight:400;">' + amt.toLocaleString() + '</span></button>';
        });
        html += '</div>';

        // Custom amount input
        html += '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
            '<input id="charityAmtInput" type="number" min="1" max="' + available + '" placeholder="Custom amount" value="" style="flex:1;padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:var(--input-bg,var(--card-bg));color:var(--text);font-size:0.9rem;font-family:inherit;outline:none;">' +
        '</div>';

        // Anonymous toggle
        html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">' +
            '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.85rem;color:var(--text-muted);">' +
            '<input type="checkbox" id="charityAnonToggle" style="width:16px;height:16px;cursor:pointer;accent-color:#ef4444;"> Donate anonymously (your name hidden, faction still recorded)' +
            '</label>' +
        '</div>';

        // Donate button
        html += '<button onclick="window._submitCharityDonation()" style="width:100%;padding:14px;background:linear-gradient(135deg,#ef4444,#dc2626);border:none;border-radius:12px;color:#fff;font-size:1rem;font-weight:800;cursor:pointer;font-family:inherit;letter-spacing:0.5px;transition:0.2s;">❤️ Donate XP for Charity</button>';

        html += '</div>';
    }

    // Recent donations
    if (_charityRecent.length > 0) {
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:16px;">' +
            '<div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">📜 Recent Donations</div>';
        _charityRecent.forEach(function(d) {
            var isAnon = d.anonymous || !d.uid || (d.username || '') === 'Anonymous';
            var factionLabel = d.faction === 'cyber_hornets' ? '<span style="color:#f7e400;font-size:0.65rem;text-shadow:-1px -1px 0 #000,1px -1px 0 #000,1px 1px 0 #000,-1px 1px 0 #000;font-weight:700;">🐝</span>' :
                               d.faction === 'honey_badgers' ? '<span style="color:#1a1a1a;font-size:0.65rem;text-shadow:-1px -1px 0 #000,1px -1px 0 #000,1px 1px 0 #000,-1px 1px 0 #000,0 0 3px #fff;font-weight:700;">🦡</span>' : '';
            // Faction-coloured name style — applies even for anonymous donors (name hidden ≠ faction hidden)
            var nameStyle;
            if (d.faction === 'cyber_hornets') {
                nameStyle = 'color:#f7e400;text-shadow:-1px -1px 0 #000,1px -1px 0 #000,1px 1px 0 #000,-1px 1px 0 #000;font-weight:700;' + (isAnon ? '' : 'cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px;');
            } else if (d.faction === 'honey_badgers') {
                nameStyle = 'color:#e5e7eb;text-shadow:-1px -1px 0 #000,1px -1px 0 #000,1px 1px 0 #000,-1px 1px 0 #000;font-weight:700;' + (isAnon ? '' : 'cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px;');
            } else if (isAnon) {
                nameStyle = 'color:var(--text-muted);';
            } else {
                nameStyle = 'color:var(--text);font-weight:600;cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px;';
            }
            var nameHtml = isAnon
                ? '<span style="' + nameStyle + '">' + esc(d.username || 'Anonymous') + '</span>'
                : '<span style="' + nameStyle + '" onclick="if(typeof showUserProfile===\'function\')showUserProfile(\'' + esc(d.uid) + '\')" title="View profile">' + esc(d.username || 'Anonymous') + '</span>';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.82rem;">' +
                '<span style="display:flex;align-items:center;gap:5px;">' + factionLabel + ' ' + nameHtml + '</span>' +
                '<span style="color:#ef4444;font-weight:700;">+' + (d.amount || 0).toLocaleString() + ' XP</span>' +
            '</div>';
        });
        html += '</div>';
    }

    // Charity vote placeholder
    html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:16px;">' +
        '<div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">🗳️ Community Charity Vote</div>' +
        '<div style="font-size:0.82rem;color:var(--text-muted);">Coming soon - the community will vote on which charities receive our pledged sats. Focused on Bitcoin education and adoption, but not limited to it.</div>' +
    '</div>';

    // Expandable note
    html += '<div style="margin-bottom:16px;">' +
        '<button onclick="var n=document.getElementById(\'charityNote\');n.style.display=n.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'span\').textContent=n.style.display===\'none\'?\'▼\':\'▲\'" style="width:100%;padding:10px 14px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.8rem;font-weight:600;cursor:pointer;font-family:inherit;text-align:left;">ℹ️ About Donations <span>▼</span></button>' +
        '<div id="charityNote" style="display:none;background:var(--card-bg);border:1px solid var(--border);border-top:none;border-radius:0 0 10px 10px;padding:14px;font-size:0.8rem;color:var(--text-muted);line-height:1.6;">' +
            '<p style="margin:0 0 8px;">Our community will vote on which charities our contributions go to. In Bitcoin, the charities will focus on Bitcoin education and adoption - but our donations are not limited to the Bitcoin ecosystem. We can find charities outside of Bitcoin that we want to support as a community.</p>' +
            '<p style="margin:0;color:#ef4444;"><strong>⚠️ Donations are non-refundable.</strong> Donated XP cannot be reclaimed or reversed. Donations are a community pledge and are not tax-deductible. This is not a registered charitable organization and no tax receipts are issued.</p>' +
        '</div>' +
    '</div>';

    // Badges section
    html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;">' +
        '<div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">🏅 Donation Badges</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
    var donorBadges = [
        { id:'donor_100',    emoji:'🫷', name:'Giving Pleb',           thresh:'100 XP',    reward:'50 XP' },
        { id:'donor_500',    emoji:'💛', name:'Stack Sharer',          thresh:'500 XP',    reward:'150 XP' },
        { id:'donor_1000',   emoji:'🧡', name:'Community Builder',     thresh:'1,000 XP',  reward:'300 XP' },
        { id:'donor_5000',   emoji:'❤️', name:'Archive Patron',        thresh:'5,000 XP',  reward:'1,000 XP' },
        { id:'donor_10000',  emoji:'🔥', name:'Sats Saint',            thresh:'10,000 XP', reward:'2,000 XP' },
        { id:'donor_25000',  emoji:'⚡', name:'Lightning Philanthropist', thresh:'25,000 XP', reward:'4,000 XP' },
        { id:'donor_50000',  emoji:'🏆', name:"Satoshi's Steward",    thresh:'50,000 XP', reward:'7,500 XP' },
        { id:'donor_100000', emoji:'👑', name:'Legend of the Archive', thresh:'100,000 XP',reward:'15,000 XP' },
    ];
    var earnedBadges = typeof safeJSON === 'function' ? safeJSON('btc_hidden_badges', []) : [];
    donorBadges.forEach(function(b) {
        var earned = earnedBadges.includes(b.id) || (typeof currentUser !== 'undefined' && currentUser && Array.isArray(currentUser.donationBadges) && currentUser.donationBadges.includes(b.id));
        html += '<div style="padding:10px;border-radius:10px;border:1px solid ' + (earned ? 'rgba(239,68,68,0.4)' : 'var(--border)') + ';background:' + (earned ? 'rgba(239,68,68,0.06)' : 'none') + ';text-align:center;">' +
            '<div style="font-size:1.4rem;margin-bottom:2px;' + (earned ? '' : 'filter:grayscale(1);opacity:0.4;') + '">' + b.emoji + '</div>' +
            '<div style="font-size:0.72rem;font-weight:700;color:' + (earned ? 'var(--heading)' : 'var(--text-faint)') + ';">' + b.name + '</div>' +
            '<div style="font-size:0.65rem;color:var(--text-faint);margin-top:2px;">' + b.thresh + ' donated</div>' +
            '<div style="font-size:0.65rem;color:#ef4444;margin-top:1px;">+' + b.reward + ' reward</div>' +
        '</div>';
    });
    html += '</div></div>';

    body.innerHTML = html;

    // Wire up amount setter
    window._charitySetAmount = function(amt) {
        var inp = document.getElementById('charityAmtInput');
        if (inp) { inp.value = amt > 0 ? amt : ''; }
    };

    window._submitCharityDonation = function() {
        if (typeof firebase === 'undefined' || !firebase.functions) { if (typeof showToast === 'function') showToast('Firebase not ready'); return; }
        var inp = document.getElementById('charityAmtInput');
        var amt = parseInt(inp ? inp.value : '') || 0;
        if (!amt || amt < 1) { if (typeof showToast === 'function') showToast('Enter a valid amount'); return; }
        var avail = Math.max(0, (typeof currentUser !== 'undefined' && currentUser ? (currentUser.points||0) - (currentUser.pointsClaimed||0) - (currentUser.pointsDonated||0) : 0));
        if (amt > avail) { if (typeof showToast === 'function') showToast('Not enough available XP. You have ' + avail.toLocaleString() + ' pts available.'); return; }
        var anon = document.getElementById('charityAnonToggle') ? document.getElementById('charityAnonToggle').checked : false;
        var btn = document.querySelector('[onclick="window._submitCharityDonation()"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Donating...'; }
        var donateFn = firebase.functions().httpsCallable('donatePoints');
        donateFn({ amount: amt, anonymous: anon }).then(function(result) {
            // Update local state
            if (typeof currentUser !== 'undefined' && currentUser) {
                currentUser.pointsDonated = (currentUser.pointsDonated || 0) + amt;
                if (result.data && result.data.bonusPts) currentUser.points = (currentUser.points || 0) + result.data.bonusPts;
            }
            // Thank-you message
            var newBadges = result.data && result.data.newBadges || [];
            var badgeMsg = newBadges.length > 0 ? ' You earned ' + newBadges.length + ' new badge' + (newBadges.length > 1 ? 's' : '') + '!' : '';
            if (typeof showToast === 'function') showToast('❤️ Thank you! ' + amt.toLocaleString() + ' XP donated (' + amt.toLocaleString() + ' sats pledged to charity).' + badgeMsg, 5000);
            // Show thank-you modal
            window._charityThankYou(amt, newBadges, result.data && result.data.bonusPts || 0);
            // Announce earned badges to Global Chat via Satoshi's Favor
            if (newBadges.length > 0 && typeof window.contributeSatoshiFavor === 'function') {
                var _donorBadgeMap = {
                    donor_100:    { emoji: '🫷', name: 'Giving Pleb' },
                    donor_500:    { emoji: '💛', name: 'Stack Sharer' },
                    donor_1000:   { emoji: '🧡', name: 'Community Builder' },
                    donor_5000:   { emoji: '❤️', name: 'Archive Patron' },
                    donor_10000:  { emoji: '🔥', name: 'Sats Saint' },
                    donor_25000:  { emoji: '⚡', name: 'Lightning Philanthropist' },
                    donor_50000:  { emoji: '🏆', name: "Satoshi's Steward" },
                    donor_100000: { emoji: '👑', name: 'Legend of the Archive' },
                };
                newBadges.forEach(function(badgeId) {
                    var bdef = _donorBadgeMap[badgeId];
                    if (bdef) {
                        window.contributeSatoshiFavor('badge_earned', bdef.emoji + ' ' + bdef.name).catch(function() {});
                    }
                });
            }
            // Refresh tab (force server read so faction bar reflects new totals)
            _charityStatsLoaded = false;
            _renderCharityTab(document.getElementById('questHubBody'));
        }).catch(function(e) {
            if (btn) { btn.disabled = false; btn.textContent = '❤️ Donate XP for Charity'; }
            if (typeof showToast === 'function') showToast('❌ ' + (e.message || 'Donation failed. Try again.'), 4000);
        });
    };
}

window._charityThankYou = function(amt, newBadges, bonusPts) {
    var existing = document.getElementById('charityThankYouOverlay');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'charityThankYouOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:300000;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:20px;';
    var modal = document.createElement('div');
    modal.style.cssText = 'background:#111827;border:1px solid rgba(239,68,68,0.4);border-radius:20px;padding:28px 24px;max-width:360px;width:100%;text-align:center;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.8);';
    var html = '<div style="font-size:3rem;margin-bottom:12px;">❤️</div>' +
        '<div style="font-size:1.2rem;font-weight:800;color:var(--heading);margin-bottom:8px;">Thank You!</div>' +
        '<div style="font-size:0.9rem;color:var(--text-muted);margin-bottom:16px;">You donated <strong>' + amt.toLocaleString() + ' XP</strong> - that\'s <strong>' + amt.toLocaleString() + ' sats</strong> pledged to charity.</div>';
    if (bonusPts > 0) html += '<div style="font-size:0.85rem;color:#ef4444;font-weight:700;margin-bottom:10px;">+' + bonusPts.toLocaleString() + ' bonus XP earned!</div>';
    if (newBadges && newBadges.length > 0) {
        var _tyBadgeMap = {
            donor_100:    { emoji: '🫷', name: 'Giving Pleb' },
            donor_500:    { emoji: '💛', name: 'Stack Sharer' },
            donor_1000:   { emoji: '🧡', name: 'Community Builder' },
            donor_5000:   { emoji: '❤️', name: 'Archive Patron' },
            donor_10000:  { emoji: '🔥', name: 'Sats Saint' },
            donor_25000:  { emoji: '⚡', name: 'Lightning Philanthropist' },
            donor_50000:  { emoji: '🏆', name: "Satoshi's Steward" },
            donor_100000: { emoji: '👑', name: 'Legend of the Archive' },
        };
        var _badgeLabels = newBadges.map(function(id) {
            var b = _tyBadgeMap[id];
            return b ? (b.emoji + ' ' + b.name) : id;
        });
        html += '<div style="font-size:0.82rem;color:#f7931a;font-weight:700;margin-bottom:16px;">🏅 New badge' + (newBadges.length > 1 ? 's' : '') + ' unlocked: ' + _badgeLabels.join(', ') + '</div>';
    }
    html += '<div style="font-size:0.75rem;color:var(--text-faint);margin-bottom:20px;">The community will vote on which charities receive these sats.</div>' +
        '<button onclick="document.getElementById(\'charityThankYouOverlay\').remove()" style="padding:12px 32px;background:linear-gradient(135deg,#ef4444,#dc2626);border:none;border-radius:12px;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;">Close 💕</button>';
    modal.innerHTML = html;
    overlay.appendChild(modal);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
};

// Home card loader
window._renderCharityHome = function() {
    var el = document.getElementById('charityDonateHome');
    if (!el) return;
    if (typeof firebase === 'undefined' || !firebase.firestore) return;
    firebase.firestore().collection('charity_stats').doc('global').get().then(function(doc) {
        var stats = doc.exists ? doc.data() : { totalDonated: 0, factionTotals: {} };
        var total = stats.totalDonated || 0;
        var hornets = (stats.factionTotals && stats.factionTotals.cyber_hornets) || 0;
        var badgers = (stats.factionTotals && stats.factionTotals.honey_badgers) || 0;
        el.innerHTML = '<div style="background:linear-gradient(135deg,rgba(239,68,68,0.08),rgba(220,38,38,0.04));border:1px solid rgba(239,68,68,0.25);border-radius:14px;padding:14px 16px;cursor:pointer;" onclick="if(typeof showQuestHub===\'function\'){showQuestHub();window._questHubTab=\'charity\';if(typeof _renderQuestHubTab===\'function\')setTimeout(function(){_renderQuestHubTab()},50);}">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
                '<div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:1.5px;color:#ef4444;font-weight:800;">❤️ Donate XP for Charity</div>' +
                '<div style="font-size:0.7rem;color:var(--text-faint);">Tap to donate →</div>' +
            '</div>' +
            '<div style="font-size:1.3rem;font-weight:900;color:var(--heading);">' + total.toLocaleString() + ' <span style="font-size:0.8rem;font-weight:600;color:var(--text-muted);">sats pledged</span></div>' +
            '<div style="display:flex;gap:12px;margin-top:8px;font-size:0.75rem;">' +
                '<span style="color:#f7e400;font-weight:700;text-shadow:-1px -1px 0 #000,1px -1px 0 #000,1px 1px 0 #000,-1px 1px 0 #000;">🐝 ' + hornets.toLocaleString() + ' XP</span>' +
                '<span style="color:#1a1a1a;font-weight:700;text-shadow:-1px -1px 0 #000,1px -1px 0 #000,1px 1px 0 #000,-1px 1px 0 #000,0 0 3px #fff;">🦡 ' + badgers.toLocaleString() + ' XP</span>' +
            '</div>' +
        '</div>';
    }).catch(function() {});
};

// ── QUIZ TAB (existing system) ──
// Inline quiz topic picker rendered inside questHubBody
function _renderQuestHubQuizPicker(body) {
    if (!body) return;
    var topics = [];
    var topicEmojis = {
        '_general': '🌐', 'mining': '⛏️', 'nodes': '🖥️', 'privacy-nonkyc': '🕵️', 'problems-of-money': '💸',
        'layer-2-lightning': '⚡', 'self-custody': '🔑', 'halving': '📉', 'history': '📜', 'satoshi-nakamoto': '🧩',
        'whitepaper': '📄', 'money': '💰', 'scarce': '💎', 'secure': '🛡️', 'decentralized': '🌍',
        'programmable': '💻', 'dominant': '👑', 'philosophy': '🤔', 'energy': '🔋', 'cryptography': '🔐',
        'consensus': '🤝', 'taproot': '🌳', 'regulation': '⚖️', 'maximalism': '🔥', 'utxos': '📦',
        'difficulty-adjustment': '🎯', 'transaction_fees': '💳', 'game_theory': '♟️', 'books': '📚',
        'orange-pilling': '🍊', 'nostr': '🟣', 'use-cases': '🛠️', 'investment-strategy': '📊',
        'geopolitics___macroeconomics': '🌎', 'human_rights__social_justice_and_freedo': '✊',
        'smart-contracts': '📝', 'sidechains': '🔗', 'stablecoins': '🏦', 'fedimints': '🏛️',
        'pow-vs-pos': '⚔️', 'blockchain-timechain': '⛓️', 'softwar': '🪖', 'time_preference': '⏳',
        'governance': '🏛️', 'apps-tools': '🧰', 'misconceptions-fud': '🚫', 'elevator_pitches': '🗣️'
    };
    if (typeof STATIC_QUESTS !== 'undefined') {
        STATIC_QUESTS.forEach(function(sq) {
            var key = sq.topicKey;
            var baseKey2 = key.replace(/_pt\d+$/, '');
            var emoji = topicEmojis[key] || topicEmojis[baseKey2] || '📖';
            var baseLabel = key.replace(/[-_]+/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
            var label = sq.totalParts > 1 ? baseLabel + ' — Part ' + sq.partNum : baseLabel;
            var done = typeof completedQuests !== 'undefined' && completedQuests.has(sq.id);
            topics.push({ key: key + '||' + sq.partNum, label: label, emoji: emoji, done: done });
        });
        topics.sort(function(a, b) { if (a.done !== b.done) return a.done ? 1 : -1; return a.label.localeCompare(b.label); });
    }
    var doneCount = topics.filter(function(t) { return t.done; }).length;

    var html = '<div style="text-align:center;margin-bottom:12px;">' +
        '<div style="font-size:0.72rem;color:var(--accent);font-weight:700;">' + doneCount + '/' + topics.length + ' topics completed</div>' +
        '<div style="margin-top:6px;height:4px;background:var(--border);border-radius:2px;overflow:hidden;">' +
            '<div style="height:100%;background:var(--accent);width:' + (topics.length > 0 ? Math.round(doneCount/topics.length*100) : 0) + '%;border-radius:2px;"></div>' +
        '</div></div>';

    // Daily recommended
    if (typeof _getDailyRecommendedQuiz === 'function') {
        var daily = _getDailyRecommendedQuiz(topics);
        if (daily) {
            html += '<button onclick="window._questHubBackToTabs();setTimeout(function(){if(typeof _startQuestTopic===\'function\')_startQuestTopic(\''+daily.key.replace(/['\"]/g,'')+'\')}' + ',50)" style="width:100%;padding:12px;background:linear-gradient(135deg,rgba(34,197,94,0.12),rgba(34,197,94,0.03));border:2px solid #22c55e;border-radius:12px;color:#22c55e;font-weight:800;font-size:0.85rem;cursor:pointer;font-family:inherit;margin-bottom:8px;display:flex;align-items:center;justify-content:center;gap:8px;">' +
                '<span>📚</span> Daily Recommended — ' + daily.emoji + ' ' + daily.label + '</button>';
        }
    }
    html += '<button onclick="window._questHubBackToTabs();setTimeout(function(){if(typeof _startQuestTopic===\'function\')_startQuestTopic(null)},50)" style="width:100%;padding:10px;background:linear-gradient(135deg,rgba(247,147,26,0.1),rgba(247,147,26,0.03));border:1px solid var(--accent);border-radius:12px;color:var(--accent);font-weight:800;font-size:0.85rem;cursor:pointer;font-family:inherit;margin-bottom:10px;">🎲 Random Topic</button>';
    html += '<input id="qhQuizSearch" type="text" placeholder="Search topics..." oninput="window._qhQuizFilter(this.value)" style="width:100%;padding:8px;margin-bottom:8px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:0.85rem;box-sizing:border-box;" />';
    html += '<div id="qhQuizTopicList" style="display:flex;flex-direction:column;gap:5px;">';
    topics.forEach(function(t) {
        var safeKey = t.key.replace(/['"\\]/g, '');
        html += '<button onclick="window._questHubBackToTabs();setTimeout(function(){if(typeof _startQuestTopic===\'function\')_startQuestTopic(\''+safeKey+'\')},50)" data-label="'+t.label.toLowerCase()+'" style="padding:10px 14px;background:var(--card-bg,#1a1a2e);border:1px solid '+(t.done ? 'rgba(34,197,94,0.3)' : 'var(--border)')+';border-radius:10px;color:'+(t.done ? '#22c55e' : 'var(--text)')+';font-size:0.82rem;font-weight:600;cursor:pointer;font-family:inherit;text-align:left;display:flex;align-items:center;gap:8px;transition:0.15s;">' +
            (t.done ? '<span style="font-size:0.75rem;color:#22c55e;">✅</span>' : '<span style="font-size:0.9rem;">'+t.emoji+'</span>') +
            t.label + '</button>';
    });
    html += '</div>';
    body.innerHTML = html;
}

window._qhQuizFilter = function(val) {
    var list = document.getElementById('qhQuizTopicList');
    if (!list) return;
    var q = val.toLowerCase();
    list.querySelectorAll('button[data-label]').forEach(function(btn) {
        btn.style.display = (!q || btn.getAttribute('data-label').indexOf(q) !== -1) ? '' : 'none';
    });
};

function _renderQuizTab(body) {
    var todayKey = (typeof getDailyKey === 'function' ? getDailyKey() : new Date().toISOString().split('T')[0]);
    var qLog = safeJSON('btc_quest_daily', {});
    var completedToday = (qLog.date === todayKey) ? qLog.count : 0;
    var completed = completedQuests ? completedQuests.size : 0;
    var canRetake = (qLog.date === todayKey && completedToday >= 1 && qLog.lastScore && qLog.lastScore < 5);

    var retakeHtml = '';
    if (canRetake) {
        var retakeTopic = qLog.lastTopic ? "'" + qLog.lastTopic.replace(/['\\]/g, '') + "'" : 'null';
        var retakeLabel = qLog.lastTitle || 'your last quiz';
        retakeHtml = '<div style="margin-bottom:16px;padding:14px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.25);border-radius:14px;">' +
            '<div style="font-size:0.85rem;font-weight:700;color:var(--accent);margin-bottom:4px;">🔄 You scored ' + qLog.lastScore + '/5 on ' + (typeof escapeHtml === 'function' ? escapeHtml(retakeLabel) : retakeLabel) + '</div>' +
            '<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:10px;">Retake it to get a perfect score! +25 XP for improvement</div>' +
            '<button onclick="window._retakeLastQuiz()" style="padding:12px 28px;background:linear-gradient(135deg,#f7931a,#e8720c);border:none;border-radius:12px;color:#fff;font-size:0.95rem;font-weight:800;cursor:pointer;font-family:inherit;transition:0.2s;">🔄 Retake Quiz</button>' +
        '</div>';
    }

    body.innerHTML = '<div style="text-align:center;padding:16px 0;">' +
        '<div style="font-size:2.5rem;margin-bottom:8px;">📝</div>' +
        '<div style="font-size:1.1rem;font-weight:800;color:var(--heading);margin-bottom:4px;">Quiz Quests</div>' +
        '<div style="color:var(--text-muted);font-size:0.82rem;margin-bottom:16px;">1 daily quiz - retake until you ace it!</div>' +
        '<div style="display:flex;justify-content:center;gap:20px;margin-bottom:20px;">' +
            '<div style="text-align:center;"><div style="font-size:1.2rem;font-weight:800;color:var(--accent);">' + completedToday + '</div><div style="font-size:0.7rem;color:var(--text-faint);">Today</div></div>' +
            '<div style="text-align:center;"><div style="font-size:1.2rem;font-weight:800;color:var(--heading);">' + completed + '</div><div style="font-size:0.7rem;color:var(--text-faint);">All Time</div></div>' +
        '</div>' +
        '<div style="display:flex;justify-content:center;gap:12px;margin-bottom:12px;">' +
            '<div style="padding:6px 14px;background:rgba(34,197,94,0.1);border-radius:8px;font-size:0.75rem;color:#22c55e;font-weight:700;">3+ correct = 50 XP</div>' +
            '<div style="padding:6px 14px;background:rgba(247,147,26,0.1);border-radius:8px;font-size:0.75rem;color:#f7931a;font-weight:700;">Perfect = 100 XP</div>' +
        '</div>' +
        retakeHtml +
        '<button onclick="window._questHubShowQuizPicker()" style="padding:14px 32px;background:' + (canRetake ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#f7931a,#e8720c)') + ';border:' + (canRetake ? '1px solid var(--border)' : 'none') + ';border-radius:14px;color:' + (canRetake ? 'var(--text-muted)' : '#fff') + ';font-size:1rem;font-weight:800;cursor:pointer;font-family:inherit;letter-spacing:0.5px;transition:0.2s;">' + (canRetake ? 'Choose New Topic' : 'Start Quiz Quest ⚔️') + '</button>' +
    '</div>';
}

// ============================================================
// TRIVIA QUEST SYSTEM - 1 per day, standalone question
// ============================================================

function _getTriviaToday() {
    if (typeof TRIVIA_BANK === 'undefined' || !TRIVIA_BANK || !TRIVIA_BANK.length) return null;
    // Deterministic daily rotation keyed by getDailyKey (resets at 5 AM UTC)
    var dk = (typeof getDailyKey === 'function' ? getDailyKey() : new Date().toISOString().split('T')[0]);
    var dkMs = new Date(dk + 'T00:00:00Z').getTime();
    var epoch = new Date('2026-01-01T00:00:00Z').getTime();
    var dayIndex = Math.floor((dkMs - epoch) / 86400000);
    var seed = ((dayIndex * 7 + 2026) % TRIVIA_BANK.length + TRIVIA_BANK.length) % TRIVIA_BANK.length;
    return { index: seed, trivia: TRIVIA_BANK[seed] };
}

function _getTriviaState() {
    try { return JSON.parse(localStorage.getItem('btc_trivia_state') || '{}'); } catch(e) { return {}; }
}

function _setTriviaState(state) {
    try { localStorage.setItem('btc_trivia_state', JSON.stringify(state)); } catch(e) {}
}

function _renderTriviaTab(body) {
    var today = _getTriviaToday();
    if (!today || !today.trivia) {
        body.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--text-muted);">Trivia questions loading...</div>';
        return;
    }

    var state = _getTriviaState();
    var todayKey = (typeof getDailyKey === 'function' ? getDailyKey() : new Date().toISOString().split('T')[0]);
    var answered = state.date === todayKey;
    var t = today.trivia;

    var html = '<div style="text-align:center;padding:8px 0 16px;">' +
        '<div style="font-size:2.5rem;margin-bottom:8px;">🧠</div>' +
        '<div style="font-size:1.1rem;font-weight:800;color:var(--heading);margin-bottom:4px;">Trivia Quest</div>' +
        '<div style="color:var(--text-muted);font-size:0.82rem;margin-bottom:4px;">1 new question every day</div>' +
        '<div style="padding:4px 12px;background:rgba(247,147,26,0.1);border-radius:8px;font-size:0.72rem;color:#f7931a;font-weight:700;display:inline-block;margin-bottom:16px;">+50 XP correct · +10 XP for trying</div>' +
    '</div>';

    // Question card
    html += '<div style="background:var(--card-bg,#1a1a2e);border:1px solid var(--border);border-radius:16px;padding:20px;margin-bottom:16px;">' +
        '<div style="color:var(--text);font-size:0.95rem;font-weight:700;line-height:1.6;text-align:center;">' + (typeof escapeHtml === 'function' ? escapeHtml(t.q) : t.q) + '</div>' +
    '</div>';

    // Options
    html += '<div id="triviaOptions" style="display:flex;flex-direction:column;gap:8px;">';
    for (var i = 0; i < t.options.length; i++) {
        var optText = typeof escapeHtml === 'function' ? escapeHtml(t.options[i]) : t.options[i];
        if (answered) {
            var isCorrect = i === t.answer;
            var wasChosen = i === state.chosen;
            var bg = isCorrect ? 'rgba(34,197,94,0.15)' : (wasChosen && !isCorrect ? 'rgba(239,68,68,0.15)' : 'var(--card-bg,#1a1a2e)');
            var border = isCorrect ? '#22c55e' : (wasChosen && !isCorrect ? '#ef4444' : 'var(--border)');
            var icon = isCorrect ? '✅' : (wasChosen && !isCorrect ? '❌' : '');
            html += '<div style="padding:12px 16px;background:' + bg + ';border:2px solid ' + border + ';border-radius:12px;color:var(--text);font-size:0.85rem;font-weight:600;display:flex;align-items:center;gap:10px;opacity:' + (isCorrect || wasChosen ? '1' : '0.5') + ';position:relative;overflow:hidden;">' +
                '<div id="triviaBar_' + i + '" style="position:absolute;left:0;top:0;bottom:0;width:0;background:' + (isCorrect ? 'rgba(34,197,94,0.1)' : (wasChosen && !isCorrect ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)')) + ';transition:width 0.6s ease-out;border-radius:10px;"></div>' +
                '<span style="min-width:22px;height:22px;border-radius:50%;border:2px solid ' + border + ';display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:800;color:var(--text-faint);position:relative;z-index:1;">' + String.fromCharCode(65 + i) + '</span>' +
                '<span style="position:relative;z-index:1;flex:1;">' + optText + '</span>' +
                '<span id="triviaPct_' + i + '" style="position:relative;z-index:1;margin-left:auto;font-size:0.75rem;color:var(--text-muted);font-weight:700;min-width:36px;text-align:right;"></span>' +
                (icon ? '<span style="position:relative;z-index:1;">' + icon + '</span>' : '') +
            '</div>';
        } else {
            html += '<button onclick="triviaAnswer(' + i + ')" style="padding:12px 16px;background:var(--card-bg,#1a1a2e);border:2px solid var(--border);border-radius:12px;color:var(--text);font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit;text-align:left;transition:all 0.2s;display:flex;align-items:center;gap:10px;">' +
                '<span style="min-width:22px;height:22px;border-radius:50%;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:800;color:var(--text-faint);">' + String.fromCharCode(65 + i) + '</span>' +
                optText +
            '</button>';
        }
    }
    html += '</div>';

    // Community stats label — shown when answered
    if (answered) {
        html += '<div style="margin-top:14px;margin-bottom:6px;font-size:0.7rem;font-weight:800;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;text-align:center;">👥 Community Answers</div>';
    }

    // Fetch and display community answer stats (fires after body.innerHTML = html below)
    if (answered && typeof db !== 'undefined') {
        // show loading dots first
        for (var li = 0; li < t.options.length; li++) {
            html = html.replace('id="triviaPct_' + li + '" style="', 'id="triviaPct_' + li + '" style="');
        }
        // Read from today's stats doc (daily totals only, resets each day)
        db.collection('trivia_stats').doc(todayKey).get().then(function(doc) {
            var stats = doc.exists ? doc.data() : {};
            var total = stats.total || 0;
            if (total < 1) {
                // No data yet — show minimal placeholder
                for (var j = 0; j < t.options.length; j++) {
                    var pctEl = document.getElementById('triviaPct_' + j);
                    if (pctEl) pctEl.textContent = '...';
                }
                return;
            }
            for (var j = 0; j < t.options.length; j++) {
                var count = stats['option_' + j] || 0;
                var pct = Math.round((count / total) * 100);
                var barEl = document.getElementById('triviaBar_' + j);
                var pctEl = document.getElementById('triviaPct_' + j);
                if (barEl) barEl.style.width = pct + '%';
                if (pctEl) pctEl.textContent = pct + '% (' + count + ')';
            }
            // Update total count — show today's total, not all-time
            var totEl = document.getElementById('triviaTotalVotes');
            if (totEl) totEl.textContent = total.toLocaleString() + ' answer' + (total !== 1 ? 's' : '') + ' today';
        }).catch(function() {});
    }

    // Show explanation if answered
    if (answered) {
        html += '<div id="triviaTotalVotes" style="text-align:center;margin-top:4px;margin-bottom:14px;color:var(--text-faint);font-size:0.72rem;">Loading community results...</div>';
        html += '<div style="margin-top:4px;padding:16px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:12px;">' +
            '<div style="font-size:0.75rem;font-weight:800;color:#22c55e;margin-bottom:6px;text-transform:uppercase;">💡 Explanation</div>' +
            '<div style="color:var(--text);font-size:0.82rem;line-height:1.6;">' + (typeof escapeHtml === 'function' ? escapeHtml(t.explanation) : t.explanation) + '</div>' +
        '</div>';
        html += '<div style="text-align:center;margin-top:16px;color:var(--text-faint);font-size:0.75rem;">Come back tomorrow for a new trivia question! 🧠</div>';
    }

    body.innerHTML = html;
}

window.triviaAnswer = function(chosenIdx) {
    var today = _getTriviaToday();
    if (!today || !today.trivia) return;
    var t = today.trivia;
    var todayKey = (typeof getDailyKey === 'function' ? getDailyKey() : new Date().toISOString().split('T')[0]);
    var state = _getTriviaState();
    if (state.date === todayKey) return; // Already answered

    var isCorrect = chosenIdx === t.answer;
    var xp = isCorrect ? 50 : 10;

    // Save state
    state = { date: todayKey, index: today.index, chosen: chosenIdx, correct: isCorrect };
    _setTriviaState(state);

    // Award XP
    if (typeof awardPoints === 'function') awardPoints(xp, isCorrect ? '🧠 Trivia Quest correct!' : '🧠 Trivia Quest attempt');
    // Raid Boss: trivia + XP
    if (isCorrect && typeof window._raidOnTriviaCorrect === 'function') window._raidOnTriviaCorrect();
    // Weekly community challenge: increment trivia_answers if correct
    if (isCorrect && typeof firebase !== 'undefined' && firebase.functions && typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) {
        try {
            firebase.functions().httpsCallable('incrementWeeklyChallenge')({ goalType: 'trivia_answers' }).catch(function() {});
        } catch(e) {}
    }
    if (typeof window._raidOnXPEarned === 'function') window._raidOnXPEarned(xp);

    // Mark trivia done for daily all-three check
    _markDailyActivity('trivia');
    _checkDailyAllThree();

    // Also sync to Firestore for signed-in users
    if (typeof db !== 'undefined' && typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) {
        // Calculate trivia streak server-side-friendly: read lastTriviaDate, check if yesterday
        var _yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        db.collection('users').doc(auth.currentUser.uid).get().then(function(doc) {
            var data = doc.exists ? doc.data() : {};
            var lastDate = data.lastTriviaDate || '';
            var currentStreak = data.triviaStreak || 0;
            var newStreak = (lastDate === _yesterday) ? currentStreak + 1 : (lastDate === todayKey ? currentStreak : 1);
            return db.collection('users').doc(auth.currentUser.uid).update({
                lastTriviaDate: todayKey,
                triviaAnswered: firebase.firestore.FieldValue.increment(1),
                triviaCorrect: firebase.firestore.FieldValue.increment(isCorrect ? 1 : 0),
                triviaStreak: newStreak
            });
        }).catch(function() {
            // Fallback: update without streak calc
            db.collection('users').doc(auth.currentUser.uid).update({
                lastTriviaDate: todayKey,
                triviaAnswered: firebase.firestore.FieldValue.increment(1),
                triviaCorrect: firebase.firestore.FieldValue.increment(isCorrect ? 1 : 0)
            }).catch(function() {});
        });
    }

    // Track answer distribution — cumulative doc (permanent, keyed by trivia index)
    if (typeof db !== 'undefined') {
        var _triviaIdx = today.index;
        var statsUpdate = { total: firebase.firestore.FieldValue.increment(1), triviaIndex: _triviaIdx };
        statsUpdate['option_' + chosenIdx] = firebase.firestore.FieldValue.increment(1);
        // Write to cumulative doc (all-time totals for this question)
        db.collection('trivia_cumulative').doc('t_' + _triviaIdx).set(statsUpdate, { merge: true }).then(function() {
            // Write confirmed — now safe to fetch fresh stats
            var body2 = document.getElementById('questHubBody');
            if (body2) _renderTriviaTab(body2);
        }).catch(function() {});
        // Also write per-day doc for dedup ref (non-blocking)
        var dayStatsUpdate = { total: firebase.firestore.FieldValue.increment(1) };
        dayStatsUpdate['option_' + chosenIdx] = firebase.firestore.FieldValue.increment(1);
        db.collection('trivia_stats').doc(todayKey).set(dayStatsUpdate, { merge: true }).catch(function() {});
    }

    // Re-render immediately to show correct/wrong answer state
    var body = document.getElementById('questHubBody');
    if (body) _renderTriviaTab(body);

    if (typeof showToast === 'function') {
        showToast(isCorrect ? '✅ Correct! +50 XP 🧠' : '❌ Wrong - +10 XP for trying!', 3000);
    }
};

// ============================================================
// POLL QUEST SYSTEM - 1 per day, vote to see results
// ============================================================

function _getPollToday() {
    if (typeof POLL_BANK === 'undefined' || !POLL_BANK || !POLL_BANK.length) return null;
    // Deterministic daily rotation keyed by getDailyKey (resets at 5 AM UTC)
    var dk = (typeof getDailyKey === 'function' ? getDailyKey() : new Date().toISOString().split('T')[0]);
    var dkMs = new Date(dk + 'T00:00:00Z').getTime();
    var epoch = new Date('2026-01-01T00:00:00Z').getTime();
    var dayOfYear = Math.floor((dkMs - epoch) / 86400000);
    var seed = ((dayOfYear * 13 + 2026) % POLL_BANK.length + POLL_BANK.length) % POLL_BANK.length;
    return { index: seed, poll: POLL_BANK[seed] };
}

function _getPollState() {
    try { return JSON.parse(localStorage.getItem('btc_poll_state') || '{}'); } catch(e) { return {}; }
}

function _setPollState(state) {
    try { localStorage.setItem('btc_poll_state', JSON.stringify(state)); } catch(e) {}
}

function _renderPollTab(body) {
    var today = _getPollToday();
    if (!today || !today.poll) {
        body.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--text-muted);">Polls loading...</div>';
        return;
    }

    var state = _getPollState();
    var todayKey = (typeof getDailyKey === 'function' ? getDailyKey() : new Date().toISOString().split('T')[0]);
    // chosen must be a non-negative number (index 0..3) to count as a real vote
    var hasVoted = state.date === todayKey && typeof state.chosen === 'number' && state.chosen >= 0;
    var p = today.poll;

    var html = '<div style="text-align:center;padding:8px 0 16px;">' +
        '<div style="font-size:2.5rem;margin-bottom:8px;">📊</div>' +
        '<div style="font-size:1.1rem;font-weight:800;color:var(--heading);margin-bottom:4px;">Poll Quest</div>' +
        '<div style="color:var(--text-muted);font-size:0.82rem;margin-bottom:4px;">Vote daily - see what the community thinks</div>' +
        '<div style="padding:4px 12px;background:rgba(247,147,26,0.1);border-radius:8px;font-size:0.72rem;color:#f7931a;font-weight:700;display:inline-block;margin-bottom:16px;">+50 XP for voting</div>' +
    '</div>';

    // Question
    html += '<div style="background:var(--card-bg,#1a1a2e);border:1px solid var(--border);border-radius:16px;padding:20px;margin-bottom:16px;">' +
        '<div style="color:var(--text);font-size:0.95rem;font-weight:700;line-height:1.6;text-align:center;">' + (typeof escapeHtml === 'function' ? escapeHtml(p.q) : p.q) + '</div>' +
    '</div>';

    if (hasVoted) {
        // Show results with bars
        _renderPollResults(body, html, p, state, todayKey);
    } else {
        // Check server-side if user already voted (covers localStorage cleared / different device)
        var uid = (typeof auth !== 'undefined' && auth && auth.currentUser) ? auth.currentUser.uid : null;
        // Scope pollId to the date so the same poll reused in a later year
        // doesn't carry over old voters and falsely block new votes.
        var pollId = (p.id ? p.id + '_' + todayKey : 'poll_day_' + todayKey);
        if (uid && typeof db !== 'undefined') {
            db.collection('poll_votes').doc(pollId).get().then(function(doc) {
                if (doc.exists && doc.data().voters && doc.data().voters.indexOf(uid) !== -1) {
                    // User already voted server-side - sync local state and show results.
                    // Only use state.chosen if it belongs to today AND is a valid index (>=0).
                    // If we can't recover which option they chose (e.g. localStorage was cleared
                    // or it's from a previous day), pass -1 so nothing gets highlighted.
                    var recoveredChoice = (state.date === todayKey && typeof state.chosen === 'number' && state.chosen >= 0)
                        ? state.chosen : -1;
                    state = { date: todayKey, index: today.index, chosen: recoveredChoice, pollId: p.id };
                    _setPollState(state);
                    _renderPollResults(body, html, p, state, todayKey);
                } else {
                    // Not voted yet — delay button render slightly to prevent ghost taps
                    // from the tab-switch touch event landing on poll buttons
                    setTimeout(function() { _showPollVoteButtons(body, html, p); }, 350);
                }
            }).catch(function() {
                setTimeout(function() { _showPollVoteButtons(body, html, p); }, 350);
            });
        } else {
            // No auth / offline — delay button render to avoid ghost taps from tab switch
            setTimeout(function() { _showPollVoteButtons(body, html, p); }, 350);
        }
    }
}

function _showPollVoteButtons(body, html, p) {
    html += '<div id="pollOptions" style="display:flex;flex-direction:column;gap:8px;">';
    for (var i = 0; i < p.options.length; i++) {
        var optText = typeof escapeHtml === 'function' ? escapeHtml(p.options[i]) : p.options[i];
        html += '<button type="button" onclick="pollVote(' + i + ')" style="padding:14px 16px;background:var(--card-bg,#1a1a2e);border:2px solid var(--border);border-radius:12px;color:var(--text);font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit;text-align:left;transition:all 0.2s;display:flex;align-items:center;gap:10px;">' +
            '<span style="min-width:22px;height:22px;border-radius:50%;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:800;color:var(--text-faint);">' + String.fromCharCode(65 + i) + '</span>' +
            optText +
        '</button>';
    }
    html += '</div>';
    // Mark ready after DOM settles — guard window gives touch events time to drain
    window._pollVoteReady = false;
    body.innerHTML = html;
    clearTimeout(window._pollVoteReadyTimer);
    window._pollVoteReadyTimer = setTimeout(function() { window._pollVoteReady = true; }, 400);
}

function _renderPollResults(body, htmlPrefix, poll, state, todayKey) {
    // Read from today's day-scoped doc (resets each day — shows today's votes only)
    if (typeof db !== 'undefined' && poll.id) {
        var pollId = poll.id + '_' + todayKey;
        db.collection('poll_votes').doc(pollId).get().then(function(doc) {
            if (doc.exists) {
                var d = doc.data();
                var votes = d.votes || poll.options.map(function() { return 0; });
                var total = votes.reduce(function(a, b) { return a + b; }, 0) || 1;
                _drawPollResults(body, htmlPrefix, poll, votes, total, state.chosen);
            } else {
                _drawPollResults(body, htmlPrefix, poll, [], 1, state.chosen);
            }
        }).catch(function() {
            _drawPollResults(body, htmlPrefix, poll, [], 1, state.chosen);
        });
    } else {
        _drawPollResults(body, htmlPrefix, poll, [], 1, state.chosen);
    }
}

function _drawPollResults(body, htmlPrefix, poll, votes, total, chosen) {
    // Secret badge: The Contrarian — track when user voted for minority option
    try {
        if (typeof chosen === 'number' && chosen >= 0 && total > 1) {
            var _maxVotes = Math.max.apply(null, votes);
            if (votes[chosen] < _maxVotes) {
                var _minKey = 'btc_poll_minority_votes';
                var _minDay = 'btc_poll_minority_day';
                var _todayStr = (typeof getDailyKey === 'function' ? getDailyKey() : new Date().toISOString().split('T')[0]);
                if (localStorage.getItem(_minDay) !== _todayStr) {
                    localStorage.setItem(_minDay, _todayStr);
                    localStorage.setItem(_minKey, String(parseInt(localStorage.getItem(_minKey) || '0') + 1));
                }
            }
        }
    } catch(e) {}
    var html = htmlPrefix;
    var colors = ['#f7931a', '#3b82f6', '#22c55e', '#8b5cf6'];
    html += '<div style="display:flex;flex-direction:column;gap:10px;">';
    for (var i = 0; i < poll.options.length; i++) {
        var optText = typeof escapeHtml === 'function' ? escapeHtml(poll.options[i]) : poll.options[i];
        var pct = Math.round((votes[i] / total) * 100);
        var isChosen = i === chosen;
        html += '<div style="position:relative;padding:14px 16px;background:var(--card-bg,#1a1a2e);border:2px solid ' + (isChosen ? colors[i] : 'var(--border)') + ';border-radius:12px;overflow:hidden;">' +
            '<div style="position:absolute;top:0;left:0;height:100%;width:' + pct + '%;background:' + colors[i] + ';opacity:0.12;transition:width 0.8s ease;border-radius:10px;"></div>' +
            '<div style="position:relative;display:flex;justify-content:space-between;align-items:center;">' +
                '<div style="display:flex;align-items:center;gap:10px;">' +
                    '<span style="min-width:22px;height:22px;border-radius:50%;background:' + (isChosen ? colors[i] : 'transparent') + ';border:2px solid ' + (isChosen ? colors[i] : 'var(--border)') + ';display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:800;color:' + (isChosen ? '#fff' : 'var(--text-faint)') + ';">' + (isChosen ? '✓' : String.fromCharCode(65 + i)) + '</span>' +
                    '<span style="color:var(--text);font-size:0.85rem;font-weight:' + (isChosen ? '700' : '600') + ';">' + optText + '</span>' +
                '</div>' +
                '<div style="text-align:right;">' +
                    '<span style="font-size:0.85rem;font-weight:800;color:' + colors[i] + ';">' + pct + '%</span>' +
                    '<div style="font-size:0.68rem;color:var(--text-faint);">' + votes[i] + ' vote' + (votes[i] !== 1 ? 's' : '') + '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    }
    html += '</div>';
    html += '<div style="text-align:center;margin-top:12px;color:var(--text-faint);font-size:0.72rem;">' + total.toLocaleString() + ' total vote' + (total !== 1 ? 's' : '') + ' today · Come back tomorrow for a new poll!</div>';
    body.innerHTML = html;
}

// Guard against ghost taps being processed before the 350ms delay expires
window._pollVoteReady = false;
window._pollVoteReadyTimer = null;

window.pollVote = function(chosenIdx) {
    // Reject calls that arrive before the delayed button render has settled
    if (!window._pollVoteReady) return;
    var today = _getPollToday();
    if (!today || !today.poll) return;
    var p = today.poll;
    var todayKey = (typeof getDailyKey === 'function' ? getDailyKey() : new Date().toISOString().split('T')[0]);
    var state = _getPollState();
    if (state.date === todayKey && typeof state.chosen === 'number' && state.chosen >= 0) return; // Already voted (local)

    // Disable buttons immediately to prevent double-tap
    var pollBtns = document.querySelectorAll('#pollOptions button');
    pollBtns.forEach(function(b) { b.disabled = true; b.style.opacity = '0.5'; b.style.cursor = 'default'; });

    var pollId = (p.id ? p.id + '_' + todayKey : 'poll_day_' + todayKey);
    var uid = (typeof auth !== 'undefined' && auth && auth.currentUser) ? auth.currentUser.uid : null;

    // Server-side duplicate check + atomic vote via transaction
    if (typeof db !== 'undefined' && uid) {
        var pollRef = db.collection('poll_votes').doc(pollId);
        db.runTransaction(function(tx) {
            return tx.get(pollRef).then(function(doc) {
                var data = doc.exists ? doc.data() : {};
                var voters = data.voters || [];
                // Server-side: reject if this user already voted on this poll
                if (voters.indexOf(uid) !== -1) {
                    return Promise.reject({ code: 'already-voted' });
                }
                var votes = data.votes || [0, 0, 0, 0];
                votes[chosenIdx] = (votes[chosenIdx] || 0) + 1;
                voters.push(uid);
                tx.set(pollRef, {
                    pollId: pollId,
                    question: p.q,
                    options: p.options,
                    votes: votes,
                    voters: voters,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            });
        }).then(function() {
            // Vote succeeded - save local state + award XP
            state = { date: todayKey, index: today.index, chosen: chosenIdx, pollId: p.id };
            _setPollState(state);
            if (typeof awardPoints === 'function') awardPoints(50, '📊 Poll Quest vote');
            if (typeof window._raidOnPollVote === 'function') window._raidOnPollVote();
            if (typeof window._raidOnXPEarned === 'function') window._raidOnXPEarned(50);
            if (typeof showToast === 'function') showToast('📊 Vote recorded! +50 XP', 3000);

            // Mark poll done for daily all-three check
            _markDailyActivity('poll');
            _checkDailyAllThree();

            // Track on user doc
            if (!auth.currentUser.isAnonymous) {
                db.collection('users').doc(uid).update({
                    lastPollDate: todayKey,
                    pollsVoted: firebase.firestore.FieldValue.increment(1)
                }).catch(function() {});
            }

            // Write cumulative poll stats (all-time totals for this question)
            var _cumUpdate = { total: firebase.firestore.FieldValue.increment(1), pollId: p.id, question: p.q };
            _cumUpdate['option_' + chosenIdx] = firebase.firestore.FieldValue.increment(1);
            db.collection('poll_cumulative').doc(p.id).set(_cumUpdate, { merge: true }).catch(function() {});

            var body = document.getElementById('questHubBody');
            if (body) _renderPollTab(body);
        }).catch(function(e) {
            if (e && e.code === 'already-voted') {
                // Already voted server-side - sync local state
                state = { date: todayKey, index: today.index, chosen: chosenIdx, pollId: p.id };
                _setPollState(state);
                if (typeof showToast === 'function') showToast('You already voted on this poll today!', 3000);
            } else {
                console.error('[POLL] Vote failed:', e);
                if (typeof showToast === 'function') showToast('⚠️ Vote failed - try again', 3000);
                // Re-enable buttons on error
                pollBtns.forEach(function(b) { b.disabled = false; b.style.opacity = '1'; b.style.cursor = 'pointer'; });
                return;
            }
            var body = document.getElementById('questHubBody');
            if (body) _renderPollTab(body);
        });
    } else {
        // No auth or offline - local-only vote (no XP, no server record)
        state = { date: todayKey, index: today.index, chosen: chosenIdx, pollId: p.id };
        _setPollState(state);
        if (typeof showToast === 'function') showToast('📊 Vote recorded locally', 3000);
        var body = document.getElementById('questHubBody');
        if (body) _renderPollTab(body);
    }
};

// ============================================================
// RAID BOSS SYSTEM - Real-time collaborative boss fights
// ============================================================

// Cleanup state for raid boss listeners/intervals
window._raidBossUnsub = null;
window._raidParticipantsUnsub = null;
window._raidTimerInterval = null;

window._cleanupRaidBoss = function() {
    if (window._raidBossUnsub) { window._raidBossUnsub(); window._raidBossUnsub = null; }
    if (window._raidParticipantsUnsub) { window._raidParticipantsUnsub(); window._raidParticipantsUnsub = null; }
    if (window._raidAllTimeUnsub) { window._raidAllTimeUnsub(); window._raidAllTimeUnsub = null; }
    if (window._raidDamageDealersUnsub) { window._raidDamageDealersUnsub(); window._raidDamageDealersUnsub = null; }
    if (window._raidTimerInterval) { clearInterval(window._raidTimerInterval); window._raidTimerInterval = null; }
    window._raidDamageDealersOpen = false;
};

function _renderRaidTab(body) {
    body.innerHTML = '<div id="raidBossContent" style="text-align:center;color:var(--text-muted);padding:20px;">' +
        '<div style="font-size:2rem;margin-bottom:8px;">⏳</div>Loading Raid Boss...</div>';
    window._loadRaidBoss();
}

window._loadRaidBoss = function() {
    // Cleanup previous listeners
    window._cleanupRaidBoss();

    var container = document.getElementById('raidBossContent');
    if (!container) return;

    if (typeof db === 'undefined') {
        container.innerHTML = '<div style="padding:40px 0;color:var(--text-muted);">⚠️ Database not available</div>';
        return;
    }

    // Listen to recent raid bosses and pick the best one to display:
    // Priority: active (non-placeholder, started, not expired, not defeated)
    //           → next upcoming placeholder
    //           → most recently defeated
    //           → empty state
    window._raidBossUnsub = db.collection('raid_bosses')
        .orderBy('startTime', 'desc')
        .limit(5)
        .onSnapshot(function(snapshot) {
            if (snapshot.empty) {
                container.innerHTML = _raidEmptyState();
                return;
            }
            var now = Date.now();
            var activeBoss = null;
            var upcomingBoss = null;
            var defeatedBoss = null;

            snapshot.forEach(function(doc) {
                var d = doc.data();
                d._id = doc.id;
                var startMs = d.startTime ? (d.startTime.toMillis ? d.startTime.toMillis() : d.startTime) : 0;
                var endMs = d.endTime ? (d.endTime.toMillis ? d.endTime.toMillis() : d.endTime) : 0;

                if (!d.placeholder && !d.defeated && startMs <= now && endMs > now) {
                    // Active boss - non-placeholder, started, not expired
                    if (!activeBoss) activeBoss = d;
                } else if (d.placeholder && startMs > now) {
                    // Upcoming placeholder - pick the soonest
                    if (!upcomingBoss || startMs < (upcomingBoss.startTime ? (upcomingBoss.startTime.toMillis ? upcomingBoss.startTime.toMillis() : upcomingBoss.startTime) : 0)) {
                        upcomingBoss = d;
                    }
                } else if (d.defeated) {
                    if (!defeatedBoss) defeatedBoss = d;
                }
            });

            // If there's a recently defeated boss AND an upcoming boss, show both
            if (defeatedBoss && (upcomingBoss || activeBoss) && !activeBoss) {
                // Show victory banner + upcoming boss
                window._defeatedBossId = defeatedBoss._id;
                var victoryHtml = _raidVictoryBanner(defeatedBoss);
                container.innerHTML = victoryHtml;
                var upcomingDiv = document.createElement('div');
                upcomingDiv.id = 'raidUpcomingSection';
                container.appendChild(upcomingDiv);
                window._currentRaidBoss = upcomingBoss || defeatedBoss;
                _renderRaidBossCard(upcomingDiv, upcomingBoss);
                return;
            }

            var boss = activeBoss || upcomingBoss || defeatedBoss;
            if (!boss) {
                container.innerHTML = _raidEmptyState();
                return;
            }
            window._currentRaidBoss = boss;
            _renderRaidBossCard(container, boss);
        }, function(err) {
            console.error('[RAID] Boss listener error:', err);
            container.innerHTML = '<div style="padding:40px 0;color:var(--text-muted);">⚠️ Failed to load raid boss</div>';
        });
};

function _raidEmptyState() {
    return '<div style="padding:30px 0;">' +
        '<div style="font-size:3rem;margin-bottom:12px;">⚔️</div>' +
        '<div style="font-size:1.1rem;font-weight:800;color:var(--heading);margin-bottom:8px;">Raid Boss</div>' +
        '<div style="color:var(--text-muted);font-size:0.85rem;">No active raid boss right now.</div>' +
        '<div style="color:var(--text-faint);font-size:0.75rem;margin-top:8px;">Check back soon for community boss fights!</div>' +
    '</div>';
}

// Victory banner for recently defeated boss (shown above next boss)
function _raidVictoryBanner(boss) {
    var bossName = typeof escapeHtml === 'function' ? escapeHtml(boss.name || 'Raid Boss') : (boss.name || 'Raid Boss');
    var bossImage = _getRaidBossImage(boss);
    var defeatedImgHtml = bossImage ? '<div style="position:relative;display:inline-block;margin-bottom:8px;"><img src="' + bossImage + '" alt="' + bossName + '" style="width:80px;height:80px;border-radius:12px;object-fit:cover;border:2px solid #22c55e;opacity:0.6;filter:grayscale(50%);"><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:2rem;">\uD83D\uDC80</div></div>' : '<div style="font-size:2rem;margin-bottom:4px;">\uD83D\uDC80</div>';
    return '<div style="padding:16px 0;margin-bottom:16px;border-bottom:1px solid var(--border);">' +
        '<div style="padding:14px;background:linear-gradient(135deg,rgba(34,197,94,0.12),rgba(34,197,94,0.04));border:2px solid #22c55e;border-radius:16px;text-align:center;">' +
            defeatedImgHtml +
            '<div style="font-size:1.2rem;font-weight:900;color:#22c55e;letter-spacing:1.5px;margin-bottom:4px;">BOSS DEFEATED! \uD83C\uDF89</div>' +
            '<div style="font-size:0.95rem;font-weight:700;color:var(--heading);margin-bottom:6px;">' + bossName + ' has fallen!</div>' +
            '<div style="color:var(--text-muted);font-size:0.82rem;line-height:1.5;margin-bottom:10px;">The community worked together and took it down! Great job everyone!</div>' +
            '<div style="padding:10px 14px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.3);border-radius:10px;">' +
                '<div style="font-size:0.78rem;font-weight:800;color:var(--accent);">\uD83C\uDFC6 Community reward unlocked!</div>' +
                '<div style="font-size:0.82rem;color:var(--text);margin-top:4px;">Extra orange ticket drawing for <strong style=\"color:var(--accent);\">21,000 sats</strong> - <strong>this Friday night!</strong></div>' +
            '</div>' +
            '<button id="raidDamageDealersBtn" onclick="window._toggleRaidDamageDealers()" style="width:100%;margin-top:12px;padding:10px;background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.25);border-radius:10px;color:#8b5cf6;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;touch-action:manipulation;">\u2694\uFE0F Top Damage Dealers</button>' +
            '<div id="raidDamageDealers" style="display:none;margin-top:8px;"></div>' +
        '</div>' +
    '</div>';
}

// Boss name → image path fallback (for bosses created before image field was added)
var RAID_BOSS_IMAGES = {
    'Channel-Crawler': 'images/raid-bosses/channel-crawler.png',
    'Quiz-Crusader': 'images/raid-bosses/quiz-crusader.png',
    'TV-Titan': 'images/raid-bosses/tv-titan.png',
    'Beats-Baron': 'images/raid-bosses/beats-baron.png',
    'Flash-Flash': 'images/raid-bosses/flash-flash.png',
    'XP-Hoarder': 'images/raid-bosses/xp-hoarder.png',
    'Poll-Patroller': 'images/raid-bosses/poll-patroller.png',
    'Chat-Charger': 'images/raid-bosses/chat-charger.png',
    'Badge-Builder': 'images/raid-bosses/badge-builder.png',
    'Streak-Sage': 'images/raid-bosses/streak-sage.png',
    'Topic-Explorer': 'images/raid-bosses/topic-explorer.png',
    'Lightning-Lancer': 'images/raid-bosses/lightning-lancer.png',
    'Forum-Forge': 'images/raid-bosses/forum-forge.png',
    'Trivia-Tactician': 'images/raid-bosses/trivia-tactician.png',
    'Content-Conqueror': 'images/raid-bosses/content-conqueror.png'
};

function _getRaidBossImage(boss) {
    return boss.image || RAID_BOSS_IMAGES[boss.name] || '';
}

function _renderRaidBossCard(container, boss) {
    var now = Date.now();
    var startMs = boss.startTime ? (boss.startTime.toMillis ? boss.startTime.toMillis() : boss.startTime) : 0;
    var endMs = boss.endTime ? (boss.endTime.toMillis ? boss.endTime.toMillis() : boss.endTime) : 0;
    var bossImage = _getRaidBossImage(boss);

    // Case 1: Placeholder / upcoming boss
    if (boss.placeholder) {
        var startDate = startMs ? new Date(startMs) : null;
        var dateStr = startDate ? startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Soon';
        var upcomingImgHtml = bossImage ? '<img src="' + bossImage + '" alt="' + (boss.name || 'Boss') + '" style="width:120px;height:120px;border-radius:16px;object-fit:cover;border:2px solid rgba(139,92,246,0.3);margin-bottom:12px;">' : '<div style="font-size:3rem;margin-bottom:12px;">\u2694\uFE0F</div>';
        container.innerHTML = '<div style="padding:20px 0;">' +
            upcomingImgHtml +
            '<div style="font-size:1.1rem;font-weight:800;color:var(--heading);margin-bottom:4px;">' + (typeof escapeHtml === 'function' ? escapeHtml(boss.name || 'Raid Boss') : (boss.name || 'Raid Boss')) + '</div>' +
            '<div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:8px;">' + (typeof escapeHtml === 'function' ? escapeHtml(boss.description || '') : (boss.description || '')) + '</div>' +
            '<div style="color:#8b5cf6;font-size:0.95rem;font-weight:700;margin-bottom:12px;">' + (typeof escapeHtml === 'function' ? escapeHtml(dateStr) : dateStr) + '</div>' +
            '<div id="raidCountdownPlaceholder" style="font-size:1.5rem;font-weight:800;color:var(--heading);font-variant-numeric:tabular-nums;"></div>' +
            '<div style="color:var(--text-faint);font-size:0.75rem;margin-top:12px;">Get ready to team up and take it down!</div>' +
            '<div style="margin-top:14px;padding:10px 14px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.25);border-radius:10px;">' +
                '<div style="font-size:0.72rem;font-weight:800;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">\uD83C\uDFC6 Community Prize</div>' +
                '<div style="font-size:0.78rem;color:var(--text);line-height:1.4;">Defeat the boss = extra orange ticket giveaway for <strong style="color:var(--accent);">21,000 sats!</strong></div>' +
            '</div>' +
        '</div>';
        _startRaidCountdown('raidCountdownPlaceholder', startMs);
        return;
    }

    // Case 2: Defeated
    if (boss.defeated) {
        var winners = boss.winners || [];
        // Check if current user won the sats lottery (for badge tracking)
        var _myName = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : null;
        if (_myName && winners.indexOf(_myName) !== -1) {
            localStorage.setItem('btc_raid_winner', 'true');
        }
        var winnersHtml = '';
        if (winners.length > 0) {
            winnersHtml = '<div style="margin-top:16px;">' +
                '<div style="font-size:0.75rem;font-weight:800;color:var(--text-faint);text-transform:uppercase;margin-bottom:8px;">🏆 Top Contributors</div>';
            for (var w = 0; w < Math.min(winners.length, 5); w++) {
                var name = typeof escapeHtml === 'function' ? escapeHtml(winners[w]) : winners[w];
                winnersHtml += '<div style="padding:6px 12px;background:rgba(139,92,246,0.1);border-radius:8px;color:#8b5cf6;font-weight:700;font-size:0.82rem;margin-bottom:4px;">' +
                    (w === 0 ? '👑 ' : '') + name + '</div>';
            }
            winnersHtml += '</div>';
        }
        var defeatedImgHtml = bossImage ? '<div style="position:relative;display:inline-block;margin-bottom:12px;"><img src="' + bossImage + '" alt="' + (boss.name || 'Boss') + '" style="width:120px;height:120px;border-radius:16px;object-fit:cover;border:2px solid #22c55e;opacity:0.6;filter:grayscale(50%);"><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:3rem;">\uD83D\uDC80</div></div>' : '<div style="font-size:3rem;margin-bottom:8px;">\uD83D\uDC80</div>';
        container.innerHTML = '<div style="padding:20px 0;">' +
            defeatedImgHtml +
            '<div style="padding:12px 24px;background:linear-gradient(135deg,rgba(34,197,94,0.15),rgba(34,197,94,0.05));border:2px solid #22c55e;border-radius:16px;margin-bottom:16px;">' +
                '<div style="font-size:1.3rem;font-weight:900;color:#22c55e;letter-spacing:2px;">DEFEATED!</div>' +
            '</div>' +
            '<div style="font-size:1.1rem;font-weight:800;color:var(--heading);margin-bottom:4px;">' + (typeof escapeHtml === 'function' ? escapeHtml(boss.name || 'Raid Boss') : (boss.name || 'Raid Boss')) + '</div>' +
            '<div style="color:var(--text-muted);font-size:0.82rem;">' + (typeof escapeHtml === 'function' ? escapeHtml(boss.description || '') : (boss.description || '')) + '</div>' +
            '<div style="margin-top:14px;padding:10px 14px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:10px;text-align:center;">' +
                '<div style="font-size:0.85rem;font-weight:800;color:#22c55e;">\uD83C\uDF89 Community reward unlocked!</div>' +
                '<div style="font-size:0.78rem;color:var(--text);margin-top:2px;">Extra orange ticket giveaway for <strong style="color:var(--accent);">21,000 sats!</strong></div>' +
            '</div>' +
            '<button id="raidDamageDealersBtn" onclick="window._toggleRaidDamageDealers()" style="width:100%;margin-top:16px;padding:12px;background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(139,92,246,0.05));border:1px solid rgba(139,92,246,0.3);border-radius:12px;color:#8b5cf6;font-size:0.85rem;font-weight:800;cursor:pointer;font-family:inherit;transition:all 0.2s;touch-action:manipulation;">\u2694\uFE0F Top Damage Dealers</button>' +
            '<div id="raidDamageDealers" style="display:none;margin-top:12px;"></div>' +
        '</div>';
        // Store boss ID for lazy-loading damage dealers
        window._defeatedBossId = boss._id;
        return;
    }

    // Case 3: Active boss
    var current = boss.current !== undefined ? boss.current : (boss.currentHP !== undefined ? boss.currentHP : 0);
    var target = boss.target || boss.targetHP || 1;
    var pct = Math.min(100, Math.round((current / target) * 100));
    var remainingHP = Math.max(0, target - current);
    var hpPct = Math.max(0, 100 - pct);
    var bossName = typeof escapeHtml === 'function' ? escapeHtml(boss.name || 'Raid Boss') : (boss.name || 'Raid Boss');
    var bossDesc = typeof escapeHtml === 'function' ? escapeHtml(boss.description || '') : (boss.description || '');
    var activeImgHtml = bossImage ? '<img src="' + bossImage + '" alt="' + bossName + '" style="width:140px;height:140px;border-radius:16px;object-fit:cover;border:2px solid rgba(139,92,246,0.4);margin-bottom:12px;box-shadow:0 0 20px rgba(139,92,246,0.3);">' : '<div style="font-size:2.5rem;margin-bottom:8px;">\uD83D\uDC79</div>';

    container.innerHTML = '<div style="padding:12px 0;">' +
        // Boss header
        '<div style="margin-bottom:16px;">' +
            activeImgHtml +
            '<div style="font-size:1.15rem;font-weight:900;color:var(--heading);margin-bottom:4px;">' + bossName + '</div>' +
            '<div style="color:var(--text-muted);font-size:0.82rem;line-height:1.5;">' + bossDesc + '</div>' +
        '</div>' +
        // Boss Health bar (depletes as damage is dealt)
        '<div style="margin-bottom:16px;">' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:6px;">' +
                '<span style="font-size:0.72rem;font-weight:800;color:' + (hpPct <= 25 ? '#ef4444' : hpPct <= 50 ? '#f59e0b' : '#22c55e') + ';text-transform:uppercase;">\u2764\uFE0F Boss Health</span>' +
                '<span style="font-size:0.72rem;font-weight:800;color:var(--heading);font-variant-numeric:tabular-nums;">' + remainingHP.toLocaleString() + ' / ' + target.toLocaleString() + ' HP</span>' +
            '</div>' +
            '<div style="height:20px;background:rgba(100,100,100,0.1);border-radius:10px;overflow:hidden;border:1px solid ' + (hpPct <= 25 ? 'rgba(239,68,68,0.3)' : hpPct <= 50 ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)') + ';">' +
                '<div id="raidProgressBar" style="height:100%;width:' + hpPct + '%;background:' + (hpPct <= 25 ? 'linear-gradient(90deg,#ef4444,#f87171)' : hpPct <= 50 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : 'linear-gradient(90deg,#22c55e,#4ade80)') + ';border-radius:10px;transition:width 0.8s ease;position:relative;overflow:hidden;">' +
                    '<div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent);animation:raidShimmer 2s infinite;"></div>' +
                '</div>' +
            '</div>' +
            '<div style="text-align:center;margin-top:4px;font-size:0.75rem;font-weight:800;color:#8b5cf6;">' + pct + '% damage dealt</div>' +
        '</div>' +
        // Timer
        '<div style="margin-bottom:16px;padding:12px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:12px;">' +
            '<div style="font-size:0.68rem;font-weight:800;color:#ef4444;text-transform:uppercase;margin-bottom:4px;">⏰ Time Remaining</div>' +
            '<div id="raidTimer" style="font-size:1.3rem;font-weight:900;color:var(--heading);font-variant-numeric:tabular-nums;"></div>' +
        '</div>' +
        // Contribute button
        '<button id="raidContributeBtn" onclick="window._contributeRaid()" style="width:100%;padding:14px;background:linear-gradient(135deg,#8b5cf6,#7c3aed);border:none;border-radius:14px;color:#fff;font-size:1rem;font-weight:800;cursor:pointer;font-family:inherit;letter-spacing:0.5px;transition:all 0.2s;margin-bottom:12px;">⚔️ How to Deal Damage</button>' +
        // Prize note
        '<div style="padding:10px 14px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.25);border-radius:10px;margin-bottom:16px;text-align:center;">' +
            '<div style="font-size:0.72rem;font-weight:800;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">🏆 Community Prize</div>' +
            '<div style="font-size:0.8rem;color:var(--text);line-height:1.4;">Defeat the boss and the community earns an <strong style="color:var(--accent);">extra orange ticket giveaway for 21,000 sats!</strong></div>' +
        '</div>' +
        // Participants list with tabs
        '<div>' +
            '<div style="display:flex;align-items:center;gap:0;margin-bottom:8px;">' +
                '<button id="raidTabCurrent" onclick="window._switchRaidTab(\'current\')" style="flex:1;padding:8px 0;font-size:0.72rem;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;border:none;border-bottom:2px solid #8b5cf6;background:none;color:#8b5cf6;cursor:pointer;font-family:inherit;transition:all 0.2s;">⚔️ Current Boss</button>' +
                '<button id="raidTabAllTime" onclick="window._switchRaidTab(\'alltime\')" style="flex:1;padding:8px 0;font-size:0.72rem;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;border:none;border-bottom:2px solid transparent;background:none;color:var(--text-faint);cursor:pointer;font-family:inherit;transition:all 0.2s;">🏆 All Time</button>' +
            '</div>' +
            '<div id="raidParticipants" style="display:flex;flex-direction:column;gap:4px;max-height:200px;overflow-y:auto;">Loading...</div>' +
        '</div>' +
    '</div>';

    // Add shimmer animation
    if (!document.getElementById('raidShimmerStyle')) {
        var style = document.createElement('style');
        style.id = 'raidShimmerStyle';
        style.textContent = '@keyframes raidShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}';
        document.head.appendChild(style);
    }

    // Start countdown timer
    _startRaidCountdown('raidTimer', endMs);

    // Reset tab state and listen to current boss participants
    window._raidActiveTab = 'current';
    if (window._raidAllTimeUnsub) { window._raidAllTimeUnsub(); window._raidAllTimeUnsub = null; }
    _listenRaidParticipants(boss._id);
}

function _startRaidCountdown(elementId, targetMs) {
    if (window._raidTimerInterval) clearInterval(window._raidTimerInterval);

    function update() {
        var el = document.getElementById(elementId);
        if (!el) { clearInterval(window._raidTimerInterval); window._raidTimerInterval = null; return; }
        var remaining = Math.max(0, targetMs - Date.now());
        if (remaining <= 0) {
            el.textContent = 'Time\'s up!';
            clearInterval(window._raidTimerInterval);
            window._raidTimerInterval = null;
            return;
        }
        var d = Math.floor(remaining / 86400000);
        var h = Math.floor((remaining % 86400000) / 3600000);
        var m = Math.floor((remaining % 3600000) / 60000);
        var s = Math.floor((remaining % 60000) / 1000);
        el.textContent = (d > 0 ? d + 'd ' : '') + (h > 0 ? h + 'h ' : '') + (m < 10 ? '0' : '') + m + 'm ' + (s < 10 ? '0' : '') + s + 's';
    }
    update();
    window._raidTimerInterval = setInterval(update, 1000);
}

function _listenRaidParticipants(bossId) {
    if (window._raidParticipantsUnsub) { window._raidParticipantsUnsub(); window._raidParticipantsUnsub = null; }
    if (typeof db === 'undefined') return;

    window._raidParticipantsUnsub = db.collection('raid_bosses').doc(bossId)
        .collection('participants')
        .orderBy('contributed', 'desc')
        .limit(20)
        .onSnapshot(function(snapshot) {
            var el = document.getElementById('raidParticipants');
            if (!el) return;
            if (snapshot.empty) {
                el.innerHTML = '<div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:12px;">No raiders yet - be the first! ⚔️</div>';
                return;
            }
            var html = '';
            var rank = 0;
            snapshot.docs.forEach(function(doc) {
                rank++;
                var p = doc.data();
                var displayName = typeof escapeHtml === 'function' ? escapeHtml(p.displayName || p.username || 'Anonymous') : (p.displayName || p.username || 'Anonymous');
                var contributed = p.contributed || 0;
                var rankIcon = rank === 1 ? '👑' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : rank + '.'));
                var isMe = typeof auth !== 'undefined' && auth && auth.currentUser && doc.id === auth.currentUser.uid;
                var _pUid = doc.id;
                html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:' + (isMe ? 'rgba(139,92,246,0.1)' : 'var(--card-bg,#1a1a2e)') + ';border:1px solid ' + (isMe ? 'rgba(139,92,246,0.3)' : 'var(--border)') + ';border-radius:10px;">' +
                    '<div style="display:flex;align-items:center;gap:8px;">' +
                        '<span style="font-size:0.8rem;min-width:24px;">' + rankIcon + '</span>' +
                        '<span onclick="if(typeof showUserProfile===\'function\')showUserProfile(\'' + _pUid + '\')" style="font-size:0.82rem;font-weight:' + (isMe ? '800' : '600') + ';color:' + (isMe ? '#8b5cf6' : '#6366f1') + ';cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px;">' + displayName + (isMe ? ' (you)' : '') + '</span>' +
                    '</div>' +
                    '<span style="font-size:0.78rem;font-weight:800;color:#8b5cf6;font-variant-numeric:tabular-nums;">' + contributed.toLocaleString() + ' dmg</span>' +
                '</div>';
            });
            el.innerHTML = html;
        }, function(err) {
            console.error('[RAID] Participants listener error:', err);
        });
}

// ── Toggle Damage Dealers on Defeated Boss Card ──
window._raidDamageDealersOpen = false;
window._raidDamageDealersUnsub = null;

window._toggleRaidDamageDealers = function() {
    var container = document.getElementById('raidDamageDealers');
    var btn = document.getElementById('raidDamageDealersBtn');
    if (!container) return;

    window._raidDamageDealersOpen = !window._raidDamageDealersOpen;

    if (!window._raidDamageDealersOpen) {
        container.style.display = 'none';
        if (btn) btn.textContent = '\u2694\uFE0F Top Damage Dealers';
        if (window._raidDamageDealersUnsub) { window._raidDamageDealersUnsub(); window._raidDamageDealersUnsub = null; }
        return;
    }

    container.style.display = 'block';
    if (btn) btn.textContent = '\u25B2 Hide Damage Dealers';
    container.innerHTML = '<div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:12px;">Loading...</div>';

    // Load from current boss (defeated) or use stored ID
    // Prefer defeated boss ID (the button lives in the defeated banner)
    var bossId = window._defeatedBossId || (window._currentRaidBoss && window._currentRaidBoss._id ? window._currentRaidBoss._id : null);
    if (!bossId || typeof db === 'undefined') {
        container.innerHTML = '<div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:12px;">No damage data available.</div>';
        return;
    }

    window._raidDamageDealersUnsub = db.collection('raid_bosses').doc(bossId)
        .collection('participants')
        .orderBy('contributed', 'desc')
        .limit(30)
        .onSnapshot(function(snapshot) {
            var el = document.getElementById('raidDamageDealers');
            if (!el) return;
            if (snapshot.empty) {
                el.innerHTML = '<div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:12px;">No damage recorded for this boss.</div>';
                return;
            }
            var html = '';
            var rank = 0;
            snapshot.docs.forEach(function(doc) {
                rank++;
                var p = doc.data();
                var displayName = typeof escapeHtml === 'function' ? escapeHtml(p.displayName || p.username || 'Anonymous') : (p.displayName || p.username || 'Anonymous');
                var contributed = p.contributed || 0;
                var rankIcon = rank === 1 ? '\uD83D\uDC51' : (rank === 2 ? '\uD83E\uDD48' : (rank === 3 ? '\uD83E\uDD49' : rank + '.'));
                var isMe = typeof auth !== 'undefined' && auth && auth.currentUser && doc.id === auth.currentUser.uid;
                var pUid = doc.id;
                html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:' + (isMe ? 'rgba(139,92,246,0.1)' : 'var(--card-bg,#1a1a2e)') + ';border:1px solid ' + (isMe ? 'rgba(139,92,246,0.3)' : 'var(--border)') + ';border-radius:10px;margin-bottom:4px;">' +
                    '<div style="display:flex;align-items:center;gap:8px;">' +
                        '<span style="font-size:0.8rem;min-width:24px;">' + rankIcon + '</span>' +
                        '<span onclick="if(typeof showUserProfile===\'function\')showUserProfile(\'' + pUid + '\')" style="font-size:0.82rem;font-weight:' + (isMe ? '800' : '600') + ';color:' + (isMe ? '#8b5cf6' : '#6366f1') + ';cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px;">' + displayName + (isMe ? ' (you)' : '') + '</span>' +
                    '</div>' +
                    '<span style="font-size:0.78rem;font-weight:800;color:#8b5cf6;font-variant-numeric:tabular-nums;">' + contributed.toLocaleString() + ' dmg</span>' +
                '</div>';
            });
            el.innerHTML = html;
        }, function(err) {
            console.error('[RAID] Damage dealers listener error:', err);
            var el = document.getElementById('raidDamageDealers');
            if (el) el.innerHTML = '<div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:12px;">Failed to load damage data.</div>';
        });
};

// ── Raid Tab Switching (Current Boss vs All Time) ──
window._raidActiveTab = 'current';
window._raidAllTimeUnsub = null;

window._switchRaidTab = function(tab) {
    if (tab === window._raidActiveTab) return;
    window._raidActiveTab = tab;
    var tabCur = document.getElementById('raidTabCurrent');
    var tabAll = document.getElementById('raidTabAllTime');
    if (tabCur) {
        tabCur.style.borderBottomColor = tab === 'current' ? '#8b5cf6' : 'transparent';
        tabCur.style.color = tab === 'current' ? '#8b5cf6' : 'var(--text-faint)';
    }
    if (tabAll) {
        tabAll.style.borderBottomColor = tab === 'alltime' ? '#8b5cf6' : 'transparent';
        tabAll.style.color = tab === 'alltime' ? '#8b5cf6' : 'var(--text-faint)';
    }
    var el = document.getElementById('raidParticipants');
    if (el) el.innerHTML = '<div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:12px;">Loading...</div>';

    if (tab === 'current') {
        // Stop all-time listener, re-enable current boss listener
        if (window._raidAllTimeUnsub) { window._raidAllTimeUnsub(); window._raidAllTimeUnsub = null; }
        if (window._currentRaidBoss && window._currentRaidBoss._id) {
            _listenRaidParticipants(window._currentRaidBoss._id);
        }
    } else {
        // Stop current boss listener, start all-time query
        if (window._raidParticipantsUnsub) { window._raidParticipantsUnsub(); window._raidParticipantsUnsub = null; }
        _listenAllTimeRaiders();
    }
};

function _listenAllTimeRaiders() {
    if (window._raidAllTimeUnsub) { window._raidAllTimeUnsub(); window._raidAllTimeUnsub = null; }
    if (typeof db === 'undefined') return;

    window._raidAllTimeUnsub = db.collection('users')
        .where('raidDamageAllTime', '>', 0)
        .orderBy('raidDamageAllTime', 'desc')
        .limit(20)
        .onSnapshot(function(snapshot) {
            var el = document.getElementById('raidParticipants');
            if (!el || window._raidActiveTab !== 'alltime') return;
            if (snapshot.empty) {
                el.innerHTML = '<div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:12px;">No all-time damage recorded yet.</div>';
                return;
            }
            var html = '';
            var rank = 0;
            snapshot.docs.forEach(function(doc) {
                rank++;
                var u = doc.data();
                var displayName = typeof escapeHtml === 'function' ? escapeHtml(u.displayName || u.username || 'Anonymous') : (u.displayName || u.username || 'Anonymous');
                var dmg = u.raidDamageAllTime || 0;
                var rankIcon = rank === 1 ? '\uD83D\uDC51' : (rank === 2 ? '\uD83E\uDD48' : (rank === 3 ? '\uD83E\uDD49' : rank + '.'));
                var isMe = typeof auth !== 'undefined' && auth && auth.currentUser && doc.id === auth.currentUser.uid;
                var _uUid = doc.id;
                html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:' + (isMe ? 'rgba(139,92,246,0.1)' : 'var(--card-bg,#1a1a2e)') + ';border:1px solid ' + (isMe ? 'rgba(139,92,246,0.3)' : 'var(--border)') + ';border-radius:10px;">' +
                    '<div style="display:flex;align-items:center;gap:8px;">' +
                        '<span style="font-size:0.8rem;min-width:24px;">' + rankIcon + '</span>' +
                        '<span onclick="if(typeof showUserProfile===\'function\')showUserProfile(\'' + _uUid + '\')" style="font-size:0.82rem;font-weight:' + (isMe ? '800' : '600') + ';color:' + (isMe ? '#8b5cf6' : '#6366f1') + ';cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px;">' + displayName + (isMe ? ' (you)' : '') + '</span>' +
                    '</div>' +
                    '<span style="font-size:0.78rem;font-weight:800;color:#f7931a;font-variant-numeric:tabular-nums;">' + dmg.toLocaleString() + ' dmg</span>' +
                '</div>';
            });
            el.innerHTML = html;
        }, function(err) {
            console.error('[RAID] All-time raiders listener error:', err);
            var el = document.getElementById('raidParticipants');
            if (el && window._raidActiveTab === 'alltime') {
                el.innerHTML = '<div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:12px;">Could not load all-time data.</div>';
            }
        });
}

// Metric → user guidance: how to deal damage to this boss
var RAID_GUIDANCE = {
    'uniqueUsers5Topics': { action: 'Visit 5+ learning topics to deal damage!', nav: 'home' },
    'quizCompletions': { action: 'Complete quiz quests to deal damage!', nav: 'quests' },
    'watchMinutes': { action: 'Watch Timechain TV to deal damage!', nav: 'tctv' },
    'beatsMinutes': { action: 'Listen to Bitcoin Beats to deal damage!', nav: 'beats' },
    'flashcardCompletions': { action: 'Complete flashcard sets to deal damage!', nav: 'quests' },
    'totalXP': { action: 'Earn XP from any activity to deal damage!', nav: 'home' },
    'pollVotes': { action: 'Vote in Quest Hub polls to deal damage!', nav: 'quests' },
    'chatMessages': { action: 'Send messages in Global Chat to deal damage!', nav: 'chat' },
    'badgesEarned': { action: 'Earn badges to deal damage! Find them in the Leaderboard button \uD83C\uDFC6', nav: 'badges' },
    'streakUsers': { action: 'Maintain a 7-day daily visit streak to deal damage!', nav: 'home' },
    'uniqueTopicsVisited': { action: 'Visit learning topics you haven\'t read yet!', nav: 'home' },
    'tipsSent': { action: 'Send Lightning tips to deal damage!', nav: 'home' },
    'forumPosts': { action: 'Create forum posts to deal damage!', nav: 'forum' },
    'triviaCorrect': { action: 'Answer trivia correctly in Quest Hub to deal damage!', nav: 'quests' },
    'totalTopicReads': { action: 'Read learning topics to deal damage!', nav: 'home' }
};

window._contributeRaid = function() {
    var boss = window._currentRaidBoss;
    if (!boss) {
        if (typeof showToast === 'function') showToast('⚠️ No active raid boss', 2000);
        return;
    }

    var guidance = RAID_GUIDANCE[boss.metric] || { action: 'Complete activities on the site to deal damage!', nav: 'home' };

    // Show guidance toast
    if (typeof showToast === 'function') showToast('⚔️ ' + guidance.action, 3500);

    // Close Quest Hub and navigate to the relevant section
    var overlay = document.getElementById('questHubOverlay');
    if (overlay) overlay.remove();

    if (guidance.nav === 'badges') {
        // Open leaderboard and scroll to badges section
        if (typeof toggleLeaderboard === 'function') {
            var lb = document.getElementById('leaderboard');
            // If leaderboard is already open, close it first so toggleLeaderboard reopens fresh
            if (lb && lb.classList.contains('open')) {
                lb.classList.remove('open');
                var _fab = document.getElementById('lbFloatBtn');
                if (_fab) _fab.style.display = 'flex';
            }
            toggleLeaderboard();
            // Scroll to badges section after leaderboard loads
            setTimeout(function() {
                var lb2 = document.getElementById('leaderboard');
                if (!lb2) return;
                // Find the "Your Badges" heading
                var headings = lb2.querySelectorAll('h4');
                for (var i = 0; i < headings.length; i++) {
                    if (headings[i].textContent.indexOf('Badge') !== -1) {
                        headings[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
                        // Flash highlight
                        var parent = headings[i].parentElement;
                        if (parent) {
                            parent.style.transition = 'box-shadow 0.3s';
                            parent.style.boxShadow = '0 0 20px rgba(247,147,26,0.5)';
                            setTimeout(function() { parent.style.boxShadow = ''; }, 2000);
                        }
                        break;
                    }
                }
            }, 800);
        }
    } else if (guidance.nav === 'chat') {
        if (typeof toggleChatOverlay === 'function') toggleChatOverlay();
    } else if (guidance.nav === 'tctv') {
        if (typeof go === 'function') go('timechain-tv');
    } else if (guidance.nav === 'beats') {
        if (typeof go === 'function') go('bitcoin-beats');
    } else if (guidance.nav === 'forum') {
        if (typeof go === 'function') go('forum');
    } else if (guidance.nav === 'quests') {
        // Re-open quest hub on the quests tab
        setTimeout(function() {
            if (typeof showQuestHub === 'function') {
                showQuestHub();
                window._questHubTab = 'quests';
                if (typeof _renderQuestHubTab === 'function') _renderQuestHubTab();
            }
        }, 300);
    } else {
        if (typeof goHome === 'function') goHome();
    }
};

// ============================================================
// LOAD DATA BANKS (trivia + polls)
// ============================================================

(function _loadQuestBanks() {
    // Load trivia bank
    if (typeof TRIVIA_BANK === 'undefined') {
        var ts = document.createElement('script');
        ts.src = 'data/trivia-bank.js?v=20260528';
        ts.onerror = function() { console.warn('[QUEST] Trivia bank failed to load'); };
        document.head.appendChild(ts);
    }
    // Load poll bank
    if (typeof POLL_BANK === 'undefined') {
        var ps = document.createElement('script');
        ps.src = 'data/poll-bank.js?v=20260528';
        ps.onerror = function() { console.warn('[QUEST] Poll bank failed to load'); };
        document.head.appendChild(ps);
    }
})();

// Hash route support
if (typeof window._questHubRouteAdded === 'undefined') {
    window._questHubRouteAdded = true;
    window.addEventListener('hashchange', function() {
        if (location.hash === '#quests') {
            setTimeout(function() { if (typeof showQuestHub === 'function') showQuestHub(); }, 100);
        } else if (location.hash === '#favor') {
            setTimeout(function() {
                if (typeof showQuestHub === 'function') showQuestHub();
                window._questHubTab = 'favor';
                setTimeout(function() { if (typeof _renderQuestHubTab === 'function') _renderQuestHubTab(); }, 300);
            }, 100);
        }
    });
    if (location.hash === '#quests') {
        setTimeout(function() { if (typeof showQuestHub === 'function') showQuestHub(); }, 500);
    } else if (location.hash === '#favor') {
        setTimeout(function() {
            if (typeof showQuestHub === 'function') showQuestHub();
            window._questHubTab = 'favor';
            setTimeout(function() { if (typeof _renderQuestHubTab === 'function') _renderQuestHubTab(); }, 300);
        }, 500);
    }
}

// =============================================
// Raid Boss - Auto-contribution hooks
// Fire-and-forget calls to contributeRaid Cloud Function
// =============================================
window._raidContribute = function(metric, amount, detail) {
    if (typeof firebase === 'undefined' || !firebase.auth || !firebase.auth().currentUser) return;
    if (firebase.auth().currentUser.isAnonymous) return;
    try {
        console.log('[RAID] Contributing:', metric, amount || 1);
        var fn = firebase.functions().httpsCallable('contributeRaid');
        fn({ metric: metric, amount: amount || 1, detail: detail || '' }).then(function(r) {
            if (r && r.data) {
                console.log('[RAID] Result:', r.data.success, r.data.current + '/' + r.data.target, r.data.message || '');
                // Award 1 orange ticket per damage point dealt
                if (r.data.success && r.data.damage > 0 && typeof awardTickets === 'function') {
                    awardTickets(r.data.damage, 'Raid Damage');
                }
                // Track boss defeat for badges
                if (r.data.defeated) {
                    var _rd = parseInt(localStorage.getItem('btc_raid_bosses_defeated') || '0') + 1;
                    localStorage.setItem('btc_raid_bosses_defeated', _rd.toString());
                }
            }
        }).catch(function(e) { console.error('[RAID] Error:', e.message); });
    } catch(e) { console.error('[RAID] Exception:', e); }
};

// Hook: channel visit (called from go() in app.js after navigating to a topic)
// Usage: window._raidContribute('channelVisit', 1, channelId)

// Hook: quiz quest completion
window._raidOnQuizComplete = function() {
    window._raidContribute('quizCompletions', 1);
};

// Hook: trivia correct answer
window._raidOnTriviaCorrect = function() {
    window._raidContribute('triviaCorrect', 1);
};

// Hook: poll vote
window._raidOnPollVote = function() {
    window._raidContribute('pollVotes', 1);
};

// Hook: flashcard set completion
window._raidOnFlashcardComplete = function() {
    window._raidContribute('flashcardCompletions', 1);
};

// Hook: XP earned (amount = XP gained)
window._raidOnXPEarned = function(amount) {
    window._raidContribute('totalXP', amount || 1);
};

// Hook: chat message sent
window._raidOnChatMessage = function() {
    window._raidContribute('chatMessages', 1);
};

// Hook: badge earned
window._raidOnBadgeEarned = function() {
    console.log('[RAID] Badge earned hook fired!');
    window._raidContribute('badgesEarned', 1);
};

// Hook: tip sent
window._raidOnTipSent = function() {
    window._raidContribute('tipsSent', 1);
};

// Hook: forum post created
window._raidOnForumPost = function() {
    window._raidContribute('forumPosts', 1);
};

// Hook: channel/topic visit (contributes to multiple boss metrics)
window._raidOnChannelVisit = function(channelId) {
    window._raidContribute('totalTopicReads', 1, channelId);
    window._raidContribute('uniqueTopicsVisited', 1, channelId);
    window._raidContribute('uniqueUsers5Topics', 1, channelId);
};

// ══════════════════════════════════════════════════════════════════════
// 💪 FLEX TAB — Daily Healthy Bitcoiner Actions
// ══════════════════════════════════════════════════════════════════════

// Daily seed helper — deterministic from date + salt
function _flexDailySeed(salt) {
    var d = new Date().toISOString().slice(0,10) + salt;
    var h = 0;
    for (var i = 0; i < d.length; i++) { h = (Math.imul(31, h) + d.charCodeAt(i)) | 0; }
    return Math.abs(h);
}
function _flexPickSeq(pools, id) {
    return pools[_flexDailySeed(id) % pools.length];
}

var FLEX_ACTIONS = [
    { id:'steak',    emoji:'🥩', name:'Eat Steak',            desc:'Fuel up like a carnivore maxi',           pts:5, type:'hold',      holdMs:2000 },
    { id:'sunlight', emoji:'☀️', name:'Get Sunlight',         desc:'Touch grass. Outside. On purpose.',       pts:5, type:'slider',    dir:'left',  label:'← Soak it in' },
    { id:'dca',      emoji:'📈', name:'DCA Bitcoin',          desc:'Stack sats on schedule. No emotion.',     pts:5, type:'blackjack' },
    { id:'custody',  emoji:'🔑', name:'Self-Custody',         desc:'Not your keys, not your coins.',          pts:5, type:'typeword',  words:['KEYS','WALLET','HODL','COLD','VAULT','SEED'] },
    { id:'lift',     emoji:'🏋️', name:'Lift Weights',         desc:'Proof of strength. Every rep counts.',    pts:5, type:'hold',      holdMs:3000 },
    { id:'meetup',   emoji:'🤝', name:'Host a Meetup',        desc:'Orange-pill your city. IRL > URL.',       pts:5, type:'triplclick' },
    { id:'lightning',emoji:'⚡', name:'Spend via Lightning',  desc:'Circular economy. Spend and re-stack.',   pts:5, type:'chess' },
    { id:'read',     emoji:'📚', name:'Read Bitcoin',         desc:'One page of Saifedean a day.',            pts:5, type:'sequence',
        pools:[['R','E','A','D'],['S','A','T','O','S','H','I'],['2','1','M'],['N','O','D','E','S'],['B','L','O','C','K']] },
    { id:'sleep',    emoji:'😴', name:'Sleep 8 Hours',        desc:'Low time-preference recovery.',           pts:5, type:'hold',      holdMs:2500 },
    { id:'nokyc',    emoji:'🕵️', name:'Buy No-KYC',           desc:'Preserve your privacy. Stay sovereign.',  pts:5, type:'mash',      target:8, label:'Buy privately!' },
    { id:'node',     emoji:'💻', name:'Run Your Node',        desc:"Don't trust. Verify.",                    pts:5, type:'maze' },
    { id:'cold',     emoji:'🧊', name:'Cold Plunge',          desc:'Hormetic stress. Bitcoin is similar.',    pts:5, type:'hold',      holdMs:3000 },
    { id:'fast',     emoji:'⏱️', name:'Intermittent Fast',    desc:'Low glucose, high signal.',               pts:5, type:'sequence',
        pools:[['1','6','H','R'],['F','A','S','T'],['L','E','A','N'],['Z','E','R','O']] },
    { id:'walk',     emoji:'🚶', name:'Walk 10k Steps',       desc:'Proof of Walk. Calories are energy.',     pts:5, type:'slider',    dir:'right', label:'Keep walking →' },
    { id:'journal',  emoji:'📝', name:'Journal Today',        desc:'Long-term thinking. Write it down.',      pts:5, type:'typeword',  words:['WRITE','THINK','PLAN','VISION','FUTURE','BUILD'] },
    { id:'meditate', emoji:'🧘', name:'Meditate',             desc:'Clear mind. Bitcoin is signal.',          pts:5, type:'hold',      holdMs:2000 },
    { id:'teach',    emoji:'🗣️', name:'Orange-Pill Someone',  desc:'Share the truth. One person at a time.',  pts:5, type:'triplclick' },
    { id:'water',    emoji:'💧', name:'Drink Water',          desc:'Hydration is a low time preference act.', pts:5, type:'mash',      target:6, label:'Chug chug chug!' },
    { id:'gratitude',emoji:'🙏', name:'Gratitude Practice',   desc:'Abundance mindset. Stack happiness.',     pts:5, type:'rotary',    targetDeg:120 },
    { id:'verify',   emoji:'🔍', name:'Verify a Transaction', desc:'Trust no one. Not even Rufus.',           pts:5, type:'typeword',  words:['VERIFY','PROOF','TRUST','CHECK','NODES','VALID'] },
    { id:'focus',    emoji:'🐍', name:'Focus Mode',            desc:'Clear your head. Guide the snake.',       pts:5, type:'snake' },
    { id:'risk',     emoji:'💣', name:'Risk Assessment',       desc:'Navigate uncertainty. Find the safe path.', pts:5, type:'mine' },
    { id:'pattern',  emoji:'🧩', name:'Pattern Recognition',   desc:'Spot recurring patterns like a Bitcoiner.', pts:5, type:'pattern' },
    { id:'findq',    emoji:'🏦', name:'Spot the FED',            desc:'One impostor among the p\'s. Hunt it down.', pts:5, type:'findq' },
    { id:'noleverage', emoji:'🧮', name:'Avoid Leverage',           desc:'Stay humble. Do the math, not the margin.', pts:5, type:'addthree' },
    { id:'gunrange',   emoji:'🎯', name:'Gun Range',               desc:'Lock and load. Hit all three targets.',      pts:5, type:'gunrange' },
    { id:'sellchairs',  emoji:'🪑', name:'Sell Your Chairs',        desc:'Stack sats, not stuff. Color it in.',        pts:5, type:'paintbox' },
    { id:'starebtc',    emoji:'📈', name:'Stare at the Price',       desc:'Hold the candle. Zoom out. Never sell.',     pts:5, type:'candle' },
    { id:'itoldyou',    emoji:'🙏', name:'I Told You So',            desc:'Say it. They never listened.',               pts:5, type:'typesentence', sentence:'I told you so' },
    { id:'pumpndump',   emoji:'📉', name:'Observe a Pump & Dump',    desc:'Watch the rug pull happen in real time.',    pts:5, type:'redcandle' },

];


var FLEX_BADGE_MILESTONES = [1, 5, 50, 500];

function _flexTodayKey() {
    return new Date().toISOString().slice(0,10); // YYYY-MM-DD
}

function _flexGetState() {
    try { return JSON.parse(localStorage.getItem('btc_flex_state') || '{}'); } catch(e) { return {}; }
}

function _flexSaveState(s) {
    localStorage.setItem('btc_flex_state', JSON.stringify(s));
}

function _flexDoneToday(actionId) {
    var s = _flexGetState();
    return (s[actionId] && s[actionId].lastDate === _flexTodayKey());
}

function _flexGetAllTimeCount(actionId) {
    var s = _flexGetState();
    return (s[actionId] && s[actionId].total) || 0;
}

function _flexMarkDone(actionId, onDone) {
    if (_flexDoneToday(actionId)) return;
    var s = _flexGetState();
    if (!s[actionId]) s[actionId] = { total: 0 };
    s[actionId].lastDate = _flexTodayKey();
    s[actionId].total = (s[actionId].total || 0) + 1;
    _flexSaveState(s);
    var action = FLEX_ACTIONS.find(function(a) { return a.id === actionId; });
    if (action && typeof awardPoints === 'function') awardPoints(action.pts, '💪 FLEX: ' + action.name, null, null, null, null, { actionKey: 'flex_action', flexActionId: actionId });
    // Persist lifetime total to Firestore so it survives localStorage wipes
    if (typeof db !== 'undefined' && typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) {
        var _flexTotalsRef = db.collection('users').doc(auth.currentUser.uid);
        var _update = {};
        _update['flexTotals.' + actionId] = firebase.firestore.FieldValue.increment(1);
        _flexTotalsRef.update(_update).catch(function() {});
    }
    // Check per-action badges
    _flexCheckBadges(actionId, s[actionId].total);
    // Check all-daily-flex-complete badge
    _flexCheckAllDoneBadge(s);
    if (onDone) onDone(s[actionId].total);
}

var FLEX_ALL_MILESTONES = [1, 5, 50, 500];
var FLEX_ALL_BADGE_DEFS = [
    { m:1,   id:'flex_all_1',   emoji:'💪', name:'Full Stack Bitcoiner',    desc:'Completed every daily Flex action in one day',            pts:25   },
    { m:5,   id:'flex_all_5',   emoji:'🔥', name:'Consistent Stacker',      desc:'Completed all daily Flex actions 5 times',                pts:100  },
    { m:50,  id:'flex_all_50',  emoji:'🔑', name:'Sovereign Individual',     desc:'Completed all daily Flex actions 50 times',               pts:500  },
    { m:500, id:'flex_all_500', emoji:'🏆', name:'Proof of Discipline',       desc:'Completed all daily Flex actions 500 times',              pts:5000 },
];

// Restore today's flex completions from server daily_action_counts
// Runs once on sign-in for real users — merges server state into localStorage
window._flexRestoreFromServer = function(uid) {
    if (!uid || typeof db === 'undefined') return;
    var today = (typeof getDailyKey === 'function' ? getDailyKey() : new Date().toISOString().split('T')[0]);
    // Fetch both: today's completion docs + lifetime totals from user doc
    Promise.all([
        db.collection('users').doc(uid).collection('daily_action_counts')
            .where(firebase.firestore.FieldPath.documentId(), '>=', today + '_flex_')
            .where(firebase.firestore.FieldPath.documentId(), '<=', today + '_flex_\uf8ff')
            .get({ source: 'server' }),
        db.collection('users').doc(uid).get({ source: 'server' })
    ]).then(function(results) {
        var snap = results[0];
        var userDoc = results[1];
        var flexTotals = (userDoc.exists && userDoc.data().flexTotals) ? userDoc.data().flexTotals : {};
        var s = _flexGetState();
        var restored = 0;
        // Restore today's completions
        snap.forEach(function(doc) {
            var actionId = doc.id.replace(today + '_flex_', '');
            if (!actionId) return;
            if (!s[actionId]) s[actionId] = { total: 0 };
            if (s[actionId].lastDate !== today) {
                s[actionId].lastDate = today;
                restored++;
            }
        });
        // Restore lifetime totals (server wins if higher — protects against localStorage wipe)
        Object.keys(flexTotals).forEach(function(actionId) {
            var serverTotal = flexTotals[actionId] || 0;
            if (!s[actionId]) s[actionId] = { total: 0 };
            if (serverTotal > (s[actionId].total || 0)) {
                s[actionId].total = serverTotal;
                restored++;
            }
        });
        if (restored > 0) {
            _flexSaveState(s);
            console.log('[FLEX] Restored ' + restored + ' entries from server');
            var body = document.getElementById('questHubBody');
            if (body && window._questHubTab === 'flex') {
                if (typeof _renderFlexTab === 'function') _renderFlexTab(body);
            }
            if (typeof showToast === 'function') showToast('✅ Flex progress restored', 3000);
        }
    }).catch(function(e) { console.warn('[FLEX] Server restore failed:', e.message); });
};

function _flexCheckAllDoneBadge(s) {
    // All actions completed today?
    var allDone = FLEX_ACTIONS.every(function(a) {
        return s[a.id] && s[a.id].lastDate === _flexTodayKey();
    });
    if (!allDone) return;
    // Increment all-done streak counter (once per day)
    var allKey = '__flex_all_done__';
    if (!s[allKey]) s[allKey] = { total: 0, lastDate: '' };
    if (s[allKey].lastDate === _flexTodayKey()) return; // already counted today
    s[allKey].lastDate = _flexTodayKey();
    s[allKey].total = (s[allKey].total || 0) + 1;
    _flexSaveState(s);
    var total = s[allKey].total;
    // Award bonus XP
    if (typeof awardPoints === 'function') awardPoints(50, '💪 FLEX: All Daily Actions Complete! Day #' + total);
    // Toast
    if (typeof showToast === 'function') showToast('💪 Full Stack! All Flex done today! +50 XP');
    // Check milestones
    FLEX_ALL_BADGE_DEFS.forEach(function(def) {
        if (total >= def.m) {
            if (typeof earnedBadges !== 'undefined' && !earnedBadges.has(def.id)) {
                earnedBadges.add(def.id);
                var cur = JSON.parse(localStorage.getItem('btc_badges') || '[]');
                if (cur.indexOf(def.id) === -1) { cur.push(def.id); localStorage.setItem('btc_badges', JSON.stringify(cur)); }
                if (typeof window.contributeSatoshiFavor === 'function') window.contributeSatoshiFavor('badge_earned', def.emoji + ' ' + def.name).catch(function(){});
                if (typeof showBadgeToast === 'function') showBadgeToast(def);
                if (typeof awardPoints === 'function') awardPoints(def.pts, 'Badge: ' + def.name + ' ' + def.emoji, null, null, null, def.id);
            }
        }
    });
}

function _flexCheckBadges(actionId, total) {
    FLEX_BADGE_MILESTONES.forEach(function(m) {
        if (total >= m) {
            var badgeId = 'flex_' + actionId + '_' + m;
            if (typeof earnedBadges !== 'undefined' && !earnedBadges.has(badgeId)) {
                var action = FLEX_ACTIONS.find(function(a) { return a.id === actionId; });
                var fakeBadge = {
                    id: badgeId,
                    name: action ? action.name + ' ×' + m : 'Flex ×' + m,
                    emoji: action ? action.emoji : '💪',
                    desc: 'Did "' + (action ? action.name : actionId) + '" ' + m + ' times',
                    pts: Math.round(m * 2)
                };
                earnedBadges.add(badgeId);
                var cur = JSON.parse(localStorage.getItem('btc_badges') || '[]');
                if (cur.indexOf(badgeId) === -1) { cur.push(badgeId); localStorage.setItem('btc_badges', JSON.stringify(cur)); }
                if (typeof window.contributeSatoshiFavor === 'function') window.contributeSatoshiFavor('badge_earned', fakeBadge.emoji + ' ' + fakeBadge.name).catch(function(){});
                if (typeof showBadgeToast === 'function') showBadgeToast(fakeBadge);
                if (typeof awardPoints === 'function') awardPoints(fakeBadge.pts, 'Badge: ' + fakeBadge.name + ' ' + fakeBadge.emoji, null, null, null, badgeId);
            }
        }
    });
}

function _renderFlexTab(body) {
    var today = _flexTodayKey();
    var doneCount = FLEX_ACTIONS.filter(function(a) { return _flexDoneToday(a.id); }).length;

    var html = '<style>' +
        '.flex-card{background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin-bottom:10px;transition:0.2s;position:relative;overflow:hidden;}' +
        '.flex-card.done{border-color:#22c55e;background:rgba(34,197,94,0.07);}' +
        '.flex-card.done::after{content:"✅";position:absolute;top:10px;right:12px;font-size:1.3rem;}' +
        '.flex-card-name{font-size:0.95rem;font-weight:800;color:var(--heading);margin-bottom:2px;}' +
        '.flex-card-desc{font-size:0.75rem;color:var(--text-muted);margin-bottom:10px;}' +
        '.flex-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 18px;border-radius:20px;font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid var(--accent);background:var(--accent-bg);color:var(--accent);transition:0.2s;user-select:none;-webkit-user-select:none;touch-action:manipulation;}' +
        '.flex-btn:active{transform:scale(0.96);}' +
        '.flex-btn.disabled{opacity:0.4;cursor:default;pointer-events:none;}' +
        '.flex-progress{position:absolute;bottom:0;left:0;height:3px;background:var(--accent);border-radius:0 0 0 14px;transition:width 0.05s linear;}' +
        '.flex-counter{font-size:0.68rem;color:var(--text-faint);margin-top:6px;}' +
        '@keyframes flexPop{0%{transform:scale(1)}40%{transform:scale(1.18)}70%{transform:scale(0.94)}100%{transform:scale(1)}}' +
        '@keyframes flexShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}' +
        '.flex-seq-key{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border:2px solid var(--border);border-radius:8px;font-size:0.9rem;font-weight:800;font-family:monospace;cursor:pointer;transition:0.1s;background:var(--card-bg);color:var(--text);user-select:none;touch-action:manipulation;}' +
        '.flex-seq-key.hit{background:var(--accent);border-color:var(--accent);color:#fff;transform:scale(1.15);}' +
        '.flex-drag-zone{width:100%;height:44px;border:2px dashed var(--border);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:0.8rem;color:var(--text-muted);position:relative;overflow:hidden;user-select:none;cursor:grab;touch-action:none;}' +
        '.flex-drag-thumb{position:absolute;left:8px;width:36px;height:36px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:1.1rem;cursor:grab;transition:none;box-shadow:0 2px 8px rgba(247,147,26,0.4);}' +
        '.flex-hold-ring{width:56px;height:56px;border-radius:50%;border:3px solid var(--border);display:flex;align-items:center;justify-content:center;position:relative;cursor:pointer;margin:0 auto;}' +
        '.flex-hold-ring svg{position:absolute;top:-3px;left:-3px;transform:rotate(-90deg);}' +
        '.flex-streak{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:rgba(247,147,26,0.12);border:1px solid rgba(247,147,26,0.3);border-radius:10px;font-size:0.65rem;font-weight:700;color:var(--accent);}' +
    '</style>';

    // Header
    var _flexAllState = _flexGetState()['__flex_all_done__'] || { total: 0 };
    var _flexAllTotal = _flexAllState.total || 0;
    var _flexNextBadge = FLEX_ALL_BADGE_DEFS.find(function(d){ return _flexAllTotal < d.m; });
    var _flexAllDoneToday = FLEX_ACTIONS.every(function(a){ return _flexDoneToday(a.id); });
    html += '<div style="text-align:center;margin-bottom:16px;">' +
        '<div style="font-size:1.8rem;margin-bottom:4px;">' + (_flexAllDoneToday ? '🏆' : '💪') + '</div>' +
        '<div style="font-size:1.1rem;font-weight:900;color:var(--heading);">Daily Flex</div>' +
        '<div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">Healthy Bitcoiner habits. 5 XP each. Resets daily.</div>' +
        '<div style="margin-top:8px;background:var(--bg-side);border:1px solid var(--border);border-radius:10px;height:8px;overflow:hidden;">' +
        '<div style="background:linear-gradient(90deg,#f7931a,#22c55e);height:100%;width:' + Math.round(doneCount/FLEX_ACTIONS.length*100) + '%;border-radius:10px;transition:width 0.4s;"></div></div>' +
        '<div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;">' + doneCount + '/' + FLEX_ACTIONS.length + ' done today' + (_flexAllDoneToday ? ' — <span style="color:#22c55e;font-weight:700;">✅ Full Stack!</span>' : '') + '</div>' +
        (_flexAllTotal > 0 || _flexAllDoneToday ? '<div style="margin-top:6px;display:inline-flex;align-items:center;gap:6px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.3);border-radius:10px;padding:4px 10px;font-size:0.68rem;font-weight:700;color:var(--accent);">'
            + '💪 Full Stack ×' + _flexAllTotal
            + (_flexNextBadge ? ' — next badge at ' + _flexNextBadge.m : ' — 🏆 Max badges!')
            + '</div>' : '') +
    '</div>';

    // Daily shuffle: undone first (seeded so same order all day), done appended after
    function _fqShuffle(arr, seed) {
        var a = arr.slice(), s = seed;
        for (var i = a.length - 1; i > 0; i--) {
            s = (Math.imul(s, 1664525) + 1013904223) | 0;
            var j = Math.abs(s) % (i + 1);
            var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }
    var _fqUndone = FLEX_ACTIONS.filter(function(a){ return !_flexDoneToday(a.id); });
    var _fqDone   = FLEX_ACTIONS.filter(function(a){ return  _flexDoneToday(a.id); });
    var _fqOrdered = _fqShuffle(_fqUndone, _flexDailySeed('flexorder')).concat(_fqShuffle(_fqDone, _flexDailySeed('flexdone')));
    _fqOrdered.forEach(function(action) {
        var done = _flexDoneToday(action.id);
        var total = _flexGetAllTimeCount(action.id);
        var nextMilestone = FLEX_BADGE_MILESTONES.find(function(m) { return total < m; });
        html += '<div class="flex-card' + (done ? ' done' : '') + '" id="flex-card-' + action.id + '">' +
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">' +
            '<span style="font-size:1.5rem;">' + action.emoji + '</span>' +
            '<div style="flex:1;">' +
            '<div class="flex-card-name">' + action.name + '</div>' +
            '<div class="flex-card-desc">' + action.desc + '</div>' +
            '</div>' +
            (total > 0 ? '<span class="flex-streak">🔥 ×' + total + '</span>' : '') +
            '</div>';
        if (!done) {
            html += _renderFlexInteraction(action);
        }
        if (nextMilestone) {
            html += '<div class="flex-counter">Next badge at ' + nextMilestone + ' completions (' + (nextMilestone - total) + ' to go)</div>';
        }
        html += '</div>';
    });

    body.innerHTML = html;
    // Wire up interactions after DOM is set
    setTimeout(function() { _flexWireInteractions(); }, 50);
}

function _renderFlexInteraction(action) {
    if (action.type === 'hold') {
        var r = 24, c = 2*Math.PI*r;
        var _holdOpts = [1500, 2000, 2500, 3000, 3500];
        var _holdMs = _holdOpts[_flexDailySeed(action.id + '_hold') % _holdOpts.length];
        return '<div style="display:flex;align-items:center;gap:12px;">' +
            '<div class="flex-hold-ring" id="hold-ring-' + action.id + '" data-id="' + action.id + '" data-ms="' + _holdMs + '">' +
            '<svg width="54" height="54"><circle cx="27" cy="27" r="' + r + '" stroke="var(--accent)" stroke-width="3" fill="none" stroke-dasharray="' + c + '" stroke-dashoffset="' + c + '" id="hold-arc-' + action.id + '" stroke-linecap="round"/></svg>' +
            '<span style="font-size:1.4rem;" id="hold-emoji-' + action.id + '">' + action.emoji + '</span>' +
            '</div>' +
            '<div style="font-size:0.72rem;color:var(--text-muted);line-height:1.4;">Hold for ' + (_holdMs/1000).toFixed(1) + 's<br><span style="color:var(--accent);font-size:0.65rem;font-weight:700;">PRESS &amp; HOLD</span></div>' +
            '</div>';
    }
    if (action.type === 'doubletap' || action.type === 'triplclick') {
        var _tapOpts = [2, 3, 4, 5];
        var clicks = _tapOpts[_flexDailySeed(action.id + '_taps') % _tapOpts.length];
        var _tapLabels = {2:'Double tap!', 3:'Triple tap!', 4:'Quad tap!', 5:'Five-tap!'};
        var hint = _tapLabels[clicks] || (clicks + '× tap!');
        return '<div style="display:flex;align-items:center;gap:12px;">' +
            '<button class="flex-btn" id="dtap-' + action.id + '" data-id="' + action.id + '" data-taps="0" data-last="0" data-target="' + clicks + '">' +
            action.emoji + ' ' + hint + '</button>' +
            '<span id="dtap-hint-' + action.id + '" style="font-size:0.7rem;color:var(--text-muted);">Tap ' + clicks + '× fast</span>' +
            '</div>';
    }
    if (action.type === 'slider') {
        var _sliderDir = action.dir || ((_flexDailySeed(action.id + '_sdir') % 2 === 0) ? 'right' : 'left');
        var isRight = _sliderDir === 'right';
        var lbl = isRight ? 'Slide right →' : '← Slide left';
        return '<div style="position:relative;margin-bottom:4px;">' +
            '<div style="font-size:0.65rem;color:var(--accent);font-weight:700;margin-bottom:4px;">' + lbl + '</div>' +
            '<div class="flex-slider-track" id="slider-track-' + action.id + '" data-id="' + action.id + '" data-dir="' + _sliderDir + '" ' +
                'style="position:relative;height:44px;background:var(--bg-side);border:1px solid var(--border);border-radius:22px;overflow:hidden;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:none;">' +
            '<div class="flex-slider-fill" id="slider-fill-' + action.id + '" style="position:absolute;top:0;' + (isRight?'left':'right') + ':0;height:100%;width:0%;background:rgba(247,147,26,0.15);transition:none;"></div>' +
            '<div class="flex-slider-thumb" id="slider-thumb-' + action.id + '" style="position:absolute;top:4px;' + (isRight?'left:4px':'right:4px') + ';width:36px;height:36px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:1.2rem;cursor:grab;box-shadow:0 2px 8px rgba(247,147,26,0.5);transition:none;">' + action.emoji + '</div>' +
            '<div style="position:absolute;top:50%;' + (isRight?'right:14px':'left:14px') + ';transform:translateY(-50%);font-size:0.7rem;color:var(--text-faint);pointer-events:none;">' + (isRight?'→→→':'←←←') + '</div>' +
            '</div></div>';
    }
    if (action.type === 'mash') {
        var _mashOpts = [5, 6, 7, 8, 9, 10, 12];
        var target = _mashOpts[_flexDailySeed(action.id + '_mash') % _mashOpts.length];
        return '<div>' +
            '<button class="flex-btn" id="mash-btn-' + action.id + '" data-id="' + action.id + '" data-count="0" data-target="' + target + '" ' +
                'style="width:100%;padding:12px;font-size:1rem;justify-content:center;">' +
            action.emoji + ' ' + (action.label || 'Tap it!') + '</button>' +
            '<div style="margin-top:6px;background:var(--bg-side);border-radius:6px;height:6px;overflow:hidden;border:1px solid var(--border);">' +
            '<div id="mash-bar-' + action.id + '" style="height:100%;width:0%;background:var(--accent);border-radius:6px;transition:width 0.1s;"></div>' +
            '</div>' +
            '<div id="mash-label-' + action.id + '" style="text-align:center;font-size:0.7rem;color:var(--text-muted);margin-top:4px;">0 / ' + target + ' taps</div>' +
            '</div>';
    }
    if (action.type === 'typeword') {
        var word = action.words[_flexDailySeed(action.id + '_w') % action.words.length];
        return '<div>' +
            '<div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-faint);margin-bottom:4px;">Type the word</div>' +
            '<div style="display:inline-flex;gap:4px;margin-bottom:8px;">' +
            word.split('').map(function(ch){ return '<span style="display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:28px;background:rgba(247,147,26,0.15);border:1px solid var(--accent);border-radius:6px;font-family:monospace;font-size:0.95rem;font-weight:900;color:var(--accent);padding:0 4px;">' + ch + '</span>'; }).join('') +
            '</div><br>' +
            '<input id="typeword-input-' + action.id + '" data-id="' + action.id + '" data-word="' + word + '" type="text" maxlength="' + (word.length + 2) + '" placeholder="Type it here…" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false" ' +
                'style="padding:10px 14px;background:var(--input-bg,#111);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:1rem;font-family:monospace;letter-spacing:3px;outline:none;width:100%;box-sizing:border-box;text-transform:uppercase;" ' +
                'oninput="_flexTypeWordCheck(this)">' +
            '<div id="typeword-hint-' + action.id + '" style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">Type the word above, then hit ↵</div>' +
            '</div>';
    }
    if (action.type === 'maze') {
        // Z-shaped corridor SVG maze: top bar → right col → bottom bar
        return '<div>' +
            '<svg id="maze-svg-' + action.id + '" width="180" height="120" style="display:block;border-radius:10px;overflow:visible;touch-action:none;cursor:crosshair;user-select:none;-webkit-user-select:none;" viewBox="0 0 180 120">' +
            // dark bg
            '<rect width="180" height="120" fill="#111" rx="8"/>' +
            // Z corridor fills
            '<rect x="1" y="1" width="178" height="33" fill="rgba(247,147,26,0.09)" rx="4"/>' +
            '<rect x="145" y="1" width="33" height="118" fill="rgba(247,147,26,0.09)"/>' +
            '<rect x="1" y="86" width="178" height="33" fill="rgba(247,147,26,0.09)" rx="4"/>' +
            // Wall fill (middle blocker: left of right col, between top and bottom bars)
            '<rect x="0" y="34" width="145" height="52" fill="#111"/>' +
            // Corridor border lines (subtle)
            '<rect x="0.5" y="0.5" width="179" height="34" fill="none" stroke="rgba(247,147,26,0.25)" stroke-width="1" rx="4"/>' +
            '<rect x="144.5" y="0.5" width="35" height="119" fill="none" stroke="rgba(247,147,26,0.25)" stroke-width="1"/>' +
            '<rect x="0.5" y="85.5" width="179" height="34" fill="none" stroke="rgba(247,147,26,0.25)" stroke-width="1" rx="4"/>' +
            // Exit zone glow
            '<rect x="145" y="86" width="34" height="33" fill="rgba(247,147,26,0.2)" rx="3"/>' +
            // Start label
            '<circle cx="16" cy="17" r="7" fill="#22c55e" opacity="0.9"/>' +
            '<text x="16" y="21" text-anchor="middle" font-size="8" fill="white" font-weight="bold">S</text>' +
            // Exit label
            '<circle cx="164" cy="103" r="7" fill="rgba(247,147,26,0.9)"/>' +
            '<text x="164" y="107" text-anchor="middle" font-size="8" fill="white" font-weight="bold">E</text>' +
            // Player dot
            '<circle id="maze-dot-' + action.id + '" cx="16" cy="17" r="11" fill="var(--accent)" stroke="white" stroke-width="1.5" style="cursor:grab;filter:drop-shadow(0 0 5px rgba(247,147,26,0.7));"/>' +
            '</svg>' +
            '<div style="font-size:0.65rem;color:var(--text-muted);margin-top:5px;text-align:center;">Drag <span style="color:var(--accent);">●</span> from <span style="color:#22c55e;font-weight:700;">S</span> to <span style="color:var(--accent);font-weight:700;">E</span></div>' +
            '</div>';
    }
    if (action.type === 'rotary') {
        // Spin the dial handle from top to target zone
        return '<div style="display:flex;align-items:center;gap:14px;">' +
            '<svg id="rotary-svg-' + action.id + '" width="110" height="110" viewBox="0 0 110 110" style="touch-action:none;user-select:none;-webkit-user-select:none;flex-shrink:0;">' +
            // Background circle
            '<circle cx="55" cy="55" r="48" fill="#111" stroke="var(--border)" stroke-width="2"/>' +
            // Target arc (120° = ~2.09 rad; arc from 90° to 150° in SVG coords)
            // SVG 0° is right (3 o\'clock); 120° in standard math = 30° SVG rotation
            // Target zone center 120° standard → SVG arc from 60° to 180° (generous 60° window)
            '<path d="M 55 55 L ' + (55+48*Math.cos((60)*Math.PI/180)).toFixed(1) + ' ' + (55+48*Math.sin((60)*Math.PI/180)).toFixed(1) +
                ' A 48 48 0 0 1 ' + (55+48*Math.cos((180)*Math.PI/180)).toFixed(1) + ' ' + (55+48*Math.sin((180)*Math.PI/180)).toFixed(1) + ' Z"' +
                ' fill="rgba(247,147,26,0.18)" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round"/>' +
            // Center hub
            '<circle cx="55" cy="55" r="8" fill="var(--accent)" opacity="0.7"/>' +
            // Start marker (top, 270° SVG = -90° math)
            '<circle cx="55" cy="7" r="5" fill="#22c55e" opacity="0.8"/>' +
            // Knob handle (starts at top: angle 270° in SVG = cx=55, cy=7)
            '<circle id="rotary-knob-' + action.id + '" cx="55" cy="7" r="10" fill="white" stroke="var(--accent)" stroke-width="2.5" style="cursor:grab;filter:drop-shadow(0 0 4px rgba(247,147,26,0.6));"/>' +
            '<text id="rotary-emoji-' + action.id + '" x="55" y="11" text-anchor="middle" font-size="11">🙏</text>' +
            '</svg>' +
            '<div style="font-size:0.72rem;color:var(--text-muted);line-height:1.5;">' +
            'Spin the dial into the<br><span style="color:var(--accent);font-weight:700;">gold zone</span> to complete' +
            '</div>' +
            '</div>';
    }
    if (action.type === 'snake') {
        // 8×8 grid mini snake: render canvas placeholder; game is wired in _flexWireInteractions
        return '<div id="snake-wrap-' + action.id + '" style="display:flex;flex-direction:column;align-items:center;gap:8px;">' +
            '<canvas id="snake-canvas-' + action.id + '" width="200" height="200" ' +
                'style="display:block;border:1px solid var(--border);border-radius:10px;background:#0d0d1a;touch-action:none;cursor:none;"></canvas>' +
            '<div style="display:flex;justify-content:center;gap:6px;user-select:none;">' +
                '<button type="button" id="sn-up-' + action.id + '" style="width:40px;height:40px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:1rem;cursor:pointer;">▲</button>' +
            '</div>' +
            '<div style="display:flex;justify-content:center;gap:6px;user-select:none;">' +
                '<button type="button" id="sn-left-' + action.id + '" style="width:40px;height:40px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:1rem;cursor:pointer;">◀</button>' +
                '<button type="button" id="sn-down-' + action.id + '" style="width:40px;height:40px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:1rem;cursor:pointer;">▼</button>' +
                '<button type="button" id="sn-right-' + action.id + '" style="width:40px;height:40px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:1rem;cursor:pointer;">▶</button>' +
            '</div>' +
            '<div id="snake-hint-' + action.id + '" style="font-size:0.7rem;color:var(--text-muted);">Eat <strong style="color:var(--accent);">3 dots</strong> to complete</div>' +
        '</div>';
    }
    if (action.type === 'mine') {
        // 5×5 minesweeper, 4 mines
        var mineState = _flexMineInit(action.id);
        var mineHtml = '<table id="mine-grid-' + action.id + '" style="border-collapse:separate;border-spacing:4px;margin:0 auto;">';
        for (var mr = 0; mr < 5; mr++) {
            mineHtml += '<tr>';
            for (var mc = 0; mc < 5; mc++) {
                mineHtml += '<td><button type="button" id="mine-cell-' + action.id + '-' + (mr*5+mc) + '" ' +
                    'data-id="' + action.id + '" data-cell="' + (mr*5+mc) + '" ' +
                    'onclick="_flexMineReveal(this)" ' +
                    'style="width:38px;height:38px;background:var(--card-bg);border:1px solid var(--border);border-radius:6px;font-size:1rem;cursor:pointer;font-weight:700;">?</button></td>';
            }
            mineHtml += '</tr>';
        }
        mineHtml += '</table>';
        return '<div id="mine-wrap-' + action.id + '" style="text-align:center;">' +
            '<div id="mine-hint-' + action.id + '" style="font-size:0.7rem;color:var(--text-muted);margin-bottom:6px;">Reveal all <strong style="color:#22c55e;">safe squares</strong> · avoid 💣</div>' +
            mineHtml +
        '</div>';
    }
    if (action.type === 'pattern') {
        // Show 4 shapes, user picks the next one in the sequence
        var pSeq = _flexPatternGen(action.id);
        var shapes = ['▲','●','■','★'];
        var shapeNames = ['triangle','circle','square','star'];
        var shown = pSeq.slice(0, 4);
        var answer = pSeq[4];
        var choices = Array.from(new Set(shapes)).slice(0, 4);
        return '<div id="pattern-wrap-' + action.id + '" data-id="' + action.id + '" data-answer="' + answer + '">' +
            '<div style="font-size:0.65rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">What comes next?</div>' +
            '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">' +
            shown.map(function(s){ return '<span style="font-size:1.6rem;">' + s + '</span>'; }).join('<span style="color:var(--text-faint);">›</span>') +
            '<span style="color:var(--text-faint);">›</span>' +
            '<span style="width:36px;height:36px;border:2px dashed var(--accent);border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:1.2rem;color:var(--text-faint);">?</span>' +
            '</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">' +
            choices.map(function(s) {
                return '<button type="button" onclick="_flexPatternPick(this)" data-id="' + action.id + '" data-shape="' + s + '" ' +
                    'style="width:56px;height:56px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;font-size:1.6rem;cursor:pointer;transition:0.15s;">' + s + '</button>';
            }).join('') +
            '</div>' +
            '<div id="pattern-hint-' + action.id + '" style="font-size:0.7rem;color:var(--text-muted);margin-top:6px;">Pick the next shape in the sequence</div>' +
        '</div>';
    }
    if (action.type === 'typesentence') {
        var _ts = action.sentence || 'Bitcoin';
        return '<div id="typesentence-wrap-' + action.id + '" data-id="' + action.id + '" data-sentence="' + _ts + '">' +
            '<div style="font-size:0.65rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Type it out</div>' +
            '<div style="display:inline-flex;flex-wrap:wrap;gap:3px;margin-bottom:10px;">' +
            _ts.split('').map(function(ch) {
                return ch === ' '
                    ? '<span style="display:inline-flex;align-items:center;justify-content:center;min-width:10px;height:28px;color:var(--text-faint);font-size:0.7rem;">␣</span>'
                    : '<span style="display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:28px;background:rgba(247,147,26,0.12);border:1px solid var(--accent);border-radius:5px;font-family:monospace;font-size:0.9rem;font-weight:900;color:var(--accent);padding:0 3px;">' + ch + '</span>';
            }).join('') +
            '</div>' +
            '<input id="typesentence-input-' + action.id + '" type="text" ' +
                'maxlength="' + (_ts.length + 3) + '" placeholder="Type it here…" ' +
                'autocomplete="off" autocorrect="off" spellcheck="false" ' +
                'oninput="_flexTypeSentenceCheck(this)" data-id="' + action.id + '" ' +
                'style="width:100%;padding:10px 14px;background:var(--input-bg,#111);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:1rem;font-family:monospace;outline:none;box-sizing:border-box;">' +
            '<div id="typesentence-hint-' + action.id + '" style="font-size:0.7rem;color:var(--text-muted);margin-top:6px;">Type exactly as shown above</div>' +
        '</div>';
    }
    if (action.type === 'redcandle') {
        return '<div style="display:flex;flex-direction:column;align-items:center;gap:10px;">' +
            '<div style="font-size:0.65rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">Hold the candle for 5 seconds</div>' +
            '<div style="display:flex;align-items:center;gap:18px;">' +
            '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">' +
            '<div style="width:2px;height:10px;background:#555;border-radius:1px;"></div>' +
            '<div id="redcandle-body-' + action.id + '" ' +
                'onmousedown="_flexRedCandleStart(\'' + action.id + '\')" onmouseup="_flexRedCandleEnd(\'' + action.id + '\')" onmouseleave="_flexRedCandleEnd(\'' + action.id + '\')" ' +
                'ontouchstart="event.preventDefault();_flexRedCandleStart(\'' + action.id + '\')" ontouchend="_flexRedCandleEnd(\'' + action.id + '\')" ' +
                'style="width:48px;height:140px;background:#1a0d0d;border:2px solid #ef4444;border-radius:3px 3px 4px 4px;position:relative;overflow:hidden;cursor:pointer;touch-action:none;-webkit-user-select:none;user-select:none;">' +
            // Fill falls from top
            '<div id="redcandle-fill-' + action.id + '" style="position:absolute;top:0;left:0;right:0;height:0%;background:linear-gradient(180deg,#dc2626 0%,#ef4444 100%);transition:none;"></div>' +
            '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">' +
            '<span id="redcandle-label-' + action.id + '" style="font-size:0.62rem;font-weight:900;color:#ef4444;font-family:monospace;text-align:center;line-height:1.4;z-index:1;">HOLD</span>' +
            '</div>' +
            '</div>' +
            '<div style="width:2px;height:14px;background:#555;border-radius:1px;"></div>' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;gap:5px;">' +
            '<div style="font-size:0.7rem;color:#ef4444;font-weight:700;font-family:monospace;letter-spacing:1px;">BTC / USD</div>' +
            '<div id="redcandle-price-' + action.id + '" style="font-size:1.15rem;font-weight:900;color:#ef4444;font-family:monospace;">$———</div>' +
            '<div style="font-size:0.72rem;color:#ef4444;font-weight:800;">↓∞%</div>' +
            '<div id="redcandle-hint-' + action.id + '" style="font-size:0.68rem;color:var(--text-muted);margin-top:6px;line-height:1.5;">Watch it bleed.<br>Press &amp; hold.</div>' +
            '</div>' +
            '</div>' +
            '<div style="width:160px;height:5px;background:var(--bg-side);border-radius:4px;overflow:hidden;border:1px solid #ef444433;">' +
            '<div id="redcandle-prog-' + action.id + '" style="height:100%;width:0%;background:linear-gradient(90deg,#dc2626,#ef4444);border-radius:4px;transition:none;"></div>' +
            '</div>' +
        '</div>';
    }
    if (action.type === 'candle') {
        return '<div style="display:flex;flex-direction:column;align-items:center;gap:10px;">' +
            '<div style="font-size:0.65rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">Hold the candle for 5 seconds</div>' +
            '<div style="display:flex;align-items:center;gap:18px;">' +
            '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">' +
            '<div style="width:2px;height:14px;background:#555;border-radius:1px;"></div>' +
            '<div id="candle-body-' + action.id + '" ' +
                'onmousedown="_flexCandleStart(\'' + action.id + '\')" onmouseup="_flexCandleEnd(\'' + action.id + '\',false)" onmouseleave="_flexCandleEnd(\'' + action.id + '\',false)" ' +
                'ontouchstart="event.preventDefault();_flexCandleStart(\'' + action.id + '\')" ontouchend="_flexCandleEnd(\'' + action.id + '\',false)" ' +
                'style="width:48px;height:140px;background:#0d1a0d;border:2px solid #22c55e;border-radius:4px 4px 3px 3px;position:relative;overflow:hidden;cursor:pointer;touch-action:none;-webkit-user-select:none;user-select:none;">' +
            '<div id="candle-fill-' + action.id + '" style="position:absolute;bottom:0;left:0;right:0;height:0%;background:linear-gradient(180deg,#4ade80 0%,#16a34a 100%);transition:none;"></div>' +
            '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">' +
            '<span id="candle-label-' + action.id + '" style="font-size:0.62rem;font-weight:900;color:#22c55e;font-family:monospace;text-align:center;line-height:1.4;z-index:1;">HOLD</span>' +
            '</div>' +
            '</div>' +
            '<div style="width:2px;height:10px;background:#555;border-radius:1px;"></div>' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;gap:5px;">' +
            '<div style="font-size:0.7rem;color:#22c55e;font-weight:700;font-family:monospace;letter-spacing:1px;">BTC / USD</div>' +
            '<div id="candle-price-' + action.id + '" style="font-size:1.15rem;font-weight:900;color:#4ade80;font-family:monospace;">$———</div>' +
            '<div style="font-size:0.72rem;color:#22c55e;font-weight:800;">+∞%</div>' +
            '<div id="candle-hint-' + action.id + '" style="font-size:0.68rem;color:var(--text-muted);margin-top:6px;line-height:1.5;">Press &amp; hold<br>the candle</div>' +
            '</div>' +
            '</div>' +
            '<div style="width:160px;height:5px;background:var(--bg-side);border-radius:4px;overflow:hidden;border:1px solid #22c55e33;">' +
            '<div id="candle-prog-' + action.id + '" style="height:100%;width:0%;background:linear-gradient(90deg,#16a34a,#4ade80);border-radius:4px;transition:none;"></div>' +
            '</div>' +
        '</div>';
    }
    if (action.type === 'paintbox') {
        // Daily accent color variation
        var _pbColors = ['#f7931a','#22c55e','#f59e0b','#8b5cf6','#ef4444','#3b82f6','#ec4899','#14b8a6'];
        var _pbColor = _pbColors[_flexDailySeed(action.id + '_pbcol') % _pbColors.length];
        var _pbThresh = 80; // % fill needed
        return '<div id="paintbox-wrap-' + action.id + '" data-id="' + action.id + '" style="text-align:center;">' +
            '<div style="font-size:0.65rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Shade it in</div>' +
            '<div style="position:relative;display:inline-block;">' +
            '<canvas id="paintbox-canvas-' + action.id + '" width="220" height="120" data-id="' + action.id + '" data-color="' + _pbColor + '" data-thresh="' + _pbThresh + '" ' +
                'style="display:block;border:2px solid var(--border);border-radius:10px;background:#111;cursor:crosshair;touch-action:none;-webkit-user-select:none;user-select:none;"></canvas>' +
            '<div id="paintbox-pct-' + action.id + '" style="position:absolute;top:6px;right:10px;font-size:0.72rem;font-weight:800;color:' + _pbColor + ';">0%</div>' +
            '</div>' +
            '<div id="paintbox-hint-' + action.id + '" style="font-size:0.7rem;color:var(--text-muted);margin-top:6px;">Drag to fill — hit ' + _pbThresh + '% to sell</div>' +
        '</div>';
    }
    if (action.type === 'gunrange') {
        // 3 targets appear sequentially in random positions; tap each to hit it
        var _grTargets = ['💀','🧙‍♂️','🦖','👾','🦄','🐻','💸','🤡','👹','👸'];
        var _grSeed = _flexDailySeed(action.id + '_gr');
        var _grPick = function(i) { return _grTargets[(_grSeed * (i+7) * 1664525 >>> 0) % _grTargets.length]; };
        return '<div id="gunrange-wrap-' + action.id + '" data-id="' + action.id + '" ' +
            'style="position:relative;width:100%;height:140px;background:linear-gradient(180deg,#0d1117 60%,#1a2a1a 100%);border:1px solid var(--border);border-radius:12px;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;">' +
            '<div id="gr-lane-' + action.id + '" style="position:absolute;bottom:0;left:0;right:0;height:3px;background:rgba(247,147,26,0.15);"></div>' +
            '<div id="gr-crosshair-' + action.id + '" style="display:none;position:absolute;width:44px;height:44px;pointer-events:none;transform:translate(-50%,-50%);font-size:2rem;z-index:10;">🎯</div>' +
            '<div id="gr-target-' + action.id + '" ' +
                'onclick="_flexGunRangeHit(this)" data-id="' + action.id + '" ' +
                'style="display:none;position:absolute;font-size:2rem;cursor:crosshair;transform:translate(-50%,-50%);transition:none;z-index:5;"></div>' +
            '<div id="gr-status-' + action.id + '" style="position:absolute;top:8px;left:50%;transform:translateX(-50%);font-size:0.72rem;font-weight:700;color:rgba(247,147,26,0.7);white-space:nowrap;">TAP TO START</div>' +
            '<div id="gr-hits-' + action.id + '" style="position:absolute;top:8px;right:10px;font-size:0.8rem;"></div>' +
            '<button type="button" id="gr-start-' + action.id + '" onclick="_flexGunRangeStart(\'' + action.id + '\')" ' +
                'style="position:absolute;bottom:10px;left:50%;transform:translateX(-50%);padding:6px 20px;background:var(--accent);border:none;border-radius:20px;color:#fff;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;">🔫 Take aim</button>' +
        '</div>';
    }
    if (action.type === 'addthree') {
        // Three 1-2 digit numbers, seeded daily
        function _at_num(salt) {
            var s = _flexDailySeed(action.id + salt);
            return 10 + (s % 81); // 10–90
        }
        var _atA = _at_num('_ata'), _atB = _at_num('_atb'), _atC = _at_num('_atc');
        // Keep at least one single-digit for variety some days
        if (_flexDailySeed(action.id + '_single') % 3 === 0) {
            _atA = 2 + (_flexDailySeed(action.id + '_atsa') % 8); // 2–9
        }
        var _atSum = _atA + _atB + _atC;
        return '<div id="addthree-wrap-' + action.id + '" data-id="' + action.id + '" data-answer="' + _atSum + '">' +
            '<div style="font-size:0.65rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">What is the sum?</div>' +
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">' +
            '<span style="display:inline-flex;align-items:center;justify-content:center;min-width:44px;height:44px;background:rgba(247,147,26,0.12);border:1px solid var(--accent);border-radius:10px;font-size:1.3rem;font-weight:900;font-family:monospace;color:var(--accent);">' + _atA + '</span>' +
            '<span style="font-size:1.2rem;color:var(--text-muted);font-weight:700;">+</span>' +
            '<span style="display:inline-flex;align-items:center;justify-content:center;min-width:44px;height:44px;background:rgba(247,147,26,0.12);border:1px solid var(--accent);border-radius:10px;font-size:1.3rem;font-weight:900;font-family:monospace;color:var(--accent);">' + _atB + '</span>' +
            '<span style="font-size:1.2rem;color:var(--text-muted);font-weight:700;">+</span>' +
            '<span style="display:inline-flex;align-items:center;justify-content:center;min-width:44px;height:44px;background:rgba(247,147,26,0.12);border:1px solid var(--accent);border-radius:10px;font-size:1.3rem;font-weight:900;font-family:monospace;color:var(--accent);">' + _atC + '</span>' +
            '<span style="font-size:1.2rem;color:var(--text-muted);font-weight:700;">=</span>' +
            '<input id="addthree-input-' + action.id + '" type="number" inputmode="numeric" min="0" max="999" ' +
                'placeholder="?" autocomplete="off" ' +
                'oninput="_flexAddThreeCheck(this)" data-id="' + action.id + '" ' +
                'style="width:64px;height:44px;background:var(--input-bg,#111);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:1.3rem;font-family:monospace;font-weight:900;text-align:center;outline:none;-moz-appearance:textfield;">' +
            '</div>' +
            '<div id="addthree-hint-' + action.id + '" style="font-size:0.7rem;color:var(--text-muted);">Type the answer — no calculator, no leverage</div>' +
            '</div>';
    }
    if (action.type === 'findq') {
        // Grid of p’s with exactly one q hidden — position seeded daily
        var fqSeed = _flexDailySeed(action.id + '_fq');
        var _fqGrids = [{cols:8,rows:6},{cols:9,rows:7},{cols:10,rows:6},{cols:7,rows:8},{cols:10,rows:7},{cols:8,rows:8}];
        var _fqGrid = _fqGrids[_flexDailySeed(action.id + '_fqgrid') % _fqGrids.length];
        var COLS = _fqGrid.cols, ROWS = _fqGrid.rows, TOTAL = COLS * ROWS;
        var qIdx = Math.abs(fqSeed) % TOTAL;
        var fqHtml = '<div id="findq-wrap-' + action.id + '" data-id="' + action.id + '" ' +
            'style="display:grid;grid-template-columns:repeat(' + COLS + ',1fr);gap:3px;max-width:280px;margin:0 auto;">';
        for (var fi = 0; fi < TOTAL; fi++) {
            var isQ = fi === qIdx;
            fqHtml += '<button type="button" ' +
                'onclick="_flexFindQTap(this)" ' +
                'data-id="' + action.id + '" ' +
                'data-isq="' + (isQ ? '1' : '0') + '" ' +
                'style="width:100%;aspect-ratio:1;background:var(--card-bg);border:1px solid var(--border);border-radius:5px;font-family:monospace;font-size:0.9rem;font-weight:700;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:0.1s;line-height:1;">' +
                (isQ ? 'q' : 'p') + '</button>';
        }
        fqHtml += '</div>' +
            '<div id="findq-hint-' + action.id + '" style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;text-align:center;">Find the <strong style="color:var(--accent);">q</strong> hiding among the p’s</div>';
        return '<div>' + fqHtml + '</div>';
    }
    if (action.type === 'drag') {
        var parts = action.dragTarget.split('→');
        var fromE = parts[0].trim(), toE = parts[1] ? parts[1].trim() : '📍';
        return '<div class="flex-drag-zone" id="drag-zone-' + action.id + '" style="gap:8px;" data-id="' + action.id + '">' +
            '<div class="flex-drag-thumb" style="position:relative;left:auto;" id="drag-thumb-' + action.id + '">' + fromE + '</div>' +
            '<span style="flex:1;text-align:center;font-size:0.75rem;pointer-events:none;">drag → drop</span>' +
            '<div style="width:36px;height:36px;border-radius:50%;border:2px dashed var(--accent);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;" id="drag-target-' + action.id + '">' + toE + '</div>' +
            '</div>';
    }
    if (action.type === 'chess') {
        var _cpuzzle = _chessDailyPuzzle(action.id);
        return '<div id="chess-wrap-' + action.id + '" data-id="' + action.id + '" style="text-align:center;">' +
            '<div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-faint);margin-bottom:6px;">' + (_cpuzzle.label || 'Checkmate in 1 — White to move') + '</div>' +
            '<div id="chess-board-' + action.id + '" style="display:inline-block;border:2px solid var(--border);border-radius:4px;overflow:hidden;"></div>' +
            '<div id="chess-msg-' + action.id + '" style="font-size:0.75rem;font-weight:700;margin-top:6px;min-height:18px;"></div>' +
            '<div style="font-size:0.65rem;color:var(--text-faint);margin-top:4px;">Drag a piece to its destination square</div>' +
            '</div>';
    }
    if (action.type === 'blackjack') {
        return '<div id="bj-wrap-' + action.id + '" data-id="' + action.id + '">' +
            '<div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-faint);margin-bottom:8px;">Your hand vs the dealer</div>' +
            '<div id="bj-hand-' + action.id + '" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;"></div>' +
            '<div id="bj-total-' + action.id + '" style="font-size:0.75rem;color:var(--text-muted);margin-bottom:10px;"></div>' +
            '<div id="bj-dealer-' + action.id + '" style="font-size:0.75rem;color:var(--text-faint);margin-bottom:10px;"></div>' +
            '<div id="bj-msg-' + action.id + '" style="font-size:0.8rem;font-weight:700;margin-bottom:10px;"></div>' +
            '<div id="bj-btns-' + action.id + '" style="display:flex;gap:8px;">' +
                '<button class="flex-btn" onclick="_bjHit(\'' + action.id + '\')" style="padding:8px 18px;font-size:0.8rem;">Hit 🃏</button>' +
                '<button class="flex-btn" onclick="_bjStand(\'' + action.id + '\')" style="padding:8px 18px;font-size:0.8rem;background:rgba(100,100,100,0.15);border-color:var(--border);">Stand 🤚</button>' +
            '</div>' +
            '</div>';
    }
    if (action.type === 'sequence') {
        var seq = _flexPickSeq(action.pools, action.id);
        var allKeys = Array.from(new Set(seq));
        var decoyPool = ['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F','G','K','L','N','P','Q','R','S','T','U','W','X','Y','Z'];
        var decoys = decoyPool.filter(function(k){ return allKeys.indexOf(k)===-1; });
        var dSeed = _flexDailySeed(action.id + '_d');
        decoys.sort(function(a,b){ return ((dSeed*(decoys.indexOf(a)+1))%97) - ((dSeed*(decoys.indexOf(b)+1))%97); });
        decoys = decoys.slice(0,5);
        var displayKeys = allKeys.concat(decoys);
        var kSeed = _flexDailySeed(action.id + '_k');
        displayKeys.sort(function(){ kSeed = (kSeed * 1664525 + 1013904223)|0; return (kSeed & 1) ? 1 : -1; });
        return '<div id="seq-wrap-' + action.id + '" data-id="' + action.id + '" data-seq="' + seq.join(',') + '" data-progress="0">' +
            '<div style="margin-bottom:8px;">' +
            '<div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-faint);margin-bottom:4px;">Today&#39;s code</div>' +
            '<div style="display:inline-flex;gap:4px;">' +
            seq.map(function(k){ return '<span style="display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:28px;background:rgba(247,147,26,0.15);border:1px solid var(--accent);border-radius:6px;font-family:monospace;font-size:0.95rem;font-weight:900;color:var(--accent);padding:0 4px;">' + k + '</span>'; }).join('') +
            '</div></div>' +
            '<div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:6px;">Enter it below: <span id="seq-display-' + action.id + '" style="font-family:monospace;color:var(--accent);letter-spacing:3px;">' + seq.map(function(){ return '\u00b7'; }).join(' ') + '</span></div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
            displayKeys.map(function(k) {
                return '<div class="flex-seq-key" data-id="' + action.id + '" data-key="' + k + '" onclick="_flexSeqTap(this)">' + k + '</div>';
            }).join('') +
            '<div class="flex-seq-key" style="background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.3);color:#ef4444;" onclick="_flexSeqReset(\'' + action.id + '\')">&#x232b;</div>' +
            '</div></div>';
    }
    return '';
}


// Global typeword handler
window._flexTypeWordCheck = function(input) {
    var id = input.getAttribute('data-id');
    var word = input.getAttribute('data-word');
    var val = input.value.toUpperCase().trim();
    var hint = document.getElementById('typeword-hint-' + id);
    if (val === word) {
        input.style.borderColor = '#22c55e';
        input.style.color = '#22c55e';
        if (hint) hint.textContent = '\u2705 Perfect!';
        setTimeout(function(){ _flexMarkDone(id, function(){ _flexCardSuccess(id); }); }, 300);
    } else if (word.indexOf(val) === 0) {
        input.style.borderColor = 'var(--accent)';
        if (hint) hint.textContent = (word.length - val.length) + ' more letters…';
    } else {
        input.style.borderColor = '#ef4444';
        if (hint) { hint.textContent = 'Not quite — try again'; hint.style.color = '#ef4444'; }
        setTimeout(function(){ input.style.borderColor = 'var(--border)'; if(hint) hint.style.color = 'var(--text-muted)'; }, 600);
    }
};

// Global seq tap handler
window._flexSeqTap = function(el) {
    var id = el.getAttribute('data-id');
    var key = el.getAttribute('data-key');
    var wrap = document.getElementById('seq-wrap-' + id);
    if (!wrap) return;
    var seq = wrap.getAttribute('data-seq').split(',');
    var progress = parseInt(wrap.getAttribute('data-progress') || '0');
    if (key === seq[progress]) {
        // Correct key
        el.classList.add('hit');
        setTimeout(function(){ el.classList.remove('hit'); }, 300);
        progress++;
        wrap.setAttribute('data-progress', progress);
        // Update display
        var disp = document.getElementById('seq-display-' + id);
        if (disp) disp.innerHTML = seq.map(function(k,i){
            if (i < progress) return '<span style="color:#22c55e;">' + k + '</span>';
            if (i === progress) return '<span style="color:var(--accent);animation:flexPop 0.3s">_</span>';
            return '<span style="color:var(--text-faint);">·</span>';
        }).join(' ');
        if (progress >= seq.length) {
            _flexMarkDone(id, function(total) { _flexCardSuccess(id); });
        }
    } else {
        // Wrong key — shake the display
        var disp2 = document.getElementById('seq-display-' + id);
        if (disp2) { disp2.style.animation='flexShake 0.4s'; setTimeout(function(){ disp2.style.animation=''; },400); }
        wrap.setAttribute('data-progress', '0');
        var disp3 = document.getElementById('seq-display-' + id);
        if (disp3) disp3.innerHTML = seq.map(function(){ return '<span style="color:var(--text-faint);">·</span>'; }).join(' ');
    }
};
window._flexSeqReset = function(id) {
    var wrap = document.getElementById('seq-wrap-' + id);
    if (!wrap) return;
    wrap.setAttribute('data-progress', '0');
    var seq = wrap.getAttribute('data-seq').split(',');
    var disp = document.getElementById('seq-display-' + id);
    if (disp) disp.innerHTML = seq.map(function(){ return '<span style="color:var(--text-faint);">·</span>'; }).join(' ');
};

// ---- Blackjack (DCA) helpers ----
var _bjDecks = {
    suits: ['♦️','♥️','♠️','♣️'],
    faces: ['A','2','3','4','5','6','7','8','9','10','J','Q','K']
};
function _bjDeck() {
    var d = [];
    _bjDecks.suits.forEach(function(s){
        _bjDecks.faces.forEach(function(f){ d.push({s:s,f:f}); });
    });
    for (var i=d.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1));var t=d[i];d[i]=d[j];d[j]=t; }
    return d;
}
function _bjVal(card) {
    if (card.f==='A') return 11;
    if (['J','Q','K'].indexOf(card.f)!==-1) return 10;
    return parseInt(card.f);
}
function _bjHandVal(hand) {
    var total=0,aces=0;
    hand.forEach(function(c){ total+=_bjVal(c); if(c.f==='A')aces++; });
    while(total>21&&aces>0){ total-=10;aces--; }
    return total;
}
function _bjCardHtml(card, hidden) {
    if (hidden) return '<span style="display:inline-flex;align-items:center;justify-content:center;min-width:32px;height:44px;background:var(--card-bg);border:1px solid var(--border);border-radius:6px;font-size:1rem;">🂠</span>';
    var red = card.s==='♦️'||card.s==='♥️';
    return '<span style="display:inline-flex;flex-direction:column;align-items:center;justify-content:center;min-width:32px;height:44px;background:var(--card-bg);border:1px solid '+(red?'rgba(239,68,68,0.5)':'var(--border)')+';border-radius:6px;font-size:0.7rem;font-weight:900;color:'+(red?'#ef4444':'var(--text)')+';padding:0 4px;line-height:1.2;">'+card.f+'<span style="font-size:0.9rem;">'+card.s+'</span></span>';
}
function _bjInit(id) {
    var deck = _bjDeck();
    var playerHand = [deck.pop(), deck.pop()];
    var dealerHand = [deck.pop(), deck.pop()];
    var state = { deck:deck, player:playerHand, dealer:dealerHand, done:false };
    localStorage.setItem('btc_bj_'+id, JSON.stringify(state));
    return state;
}
function _bjGetState(id) {
    try { return JSON.parse(localStorage.getItem('btc_bj_'+id)); } catch(e){ return null; }
}
function _bjSaveState(id, state) {
    localStorage.setItem('btc_bj_'+id, JSON.stringify(state));
}
function _bjRender(id, state, revealed) {
    var hand = document.getElementById('bj-hand-'+id);
    var totalEl = document.getElementById('bj-total-'+id);
    var dealerEl = document.getElementById('bj-dealer-'+id);
    var msgEl = document.getElementById('bj-msg-'+id);
    var btnsEl = document.getElementById('bj-btns-'+id);
    if (!hand) return;
    var pVal = _bjHandVal(state.player);
    hand.innerHTML = state.player.map(function(c){ return _bjCardHtml(c,false); }).join(' ');
    totalEl.innerHTML = 'Your total: <strong style="color:var(--accent);">' + pVal + '</strong>';
    if (revealed) {
        var dVal = _bjHandVal(state.dealer);
        dealerEl.innerHTML = 'Dealer: ' + state.dealer.map(function(c){ return _bjCardHtml(c,false); }).join(' ') + ' <strong style="color:var(--text-muted);">(' + dVal + ')</strong>';
    } else {
        dealerEl.innerHTML = 'Dealer: ' + _bjCardHtml(state.dealer[0],false) + ' ' + _bjCardHtml(state.dealer[1],true);
    }
    if (msgEl) msgEl.textContent = '';
    if (btnsEl) btnsEl.style.display = revealed ? 'none' : 'flex';
}
function _bjResolve(id, state) {
    var pVal = _bjHandVal(state.player);
    var dVal = _bjHandVal(state.dealer);
    // Dealer draws to 17
    while (dVal < 17) {
        if (state.deck.length === 0) state.deck = _bjDeck();
        state.dealer.push(state.deck.pop());
        dVal = _bjHandVal(state.dealer);
    }
    _bjSaveState(id, state);
    _bjRender(id, state, true);
    var pBust = pVal > 21;
    var dBust = dVal > 21;
    var win = !pBust && (dBust || pVal > dVal);
    var push = !pBust && !dBust && pVal === dVal;
    var msgEl = document.getElementById('bj-msg-'+id);
    var btnsEl = document.getElementById('bj-btns-'+id);
    if (win) {
        if (msgEl) { msgEl.textContent = '✅ You beat the dealer! ' + pVal + ' vs ' + dVal + (dBust ? ' (dealer busts)' : '') + ' — +5 XP!'; msgEl.style.color = '#22c55e'; }
        if (btnsEl) btnsEl.style.display = 'none';
        setTimeout(function(){ _flexMarkDone(id, function(){ _flexCardSuccess(id); }); }, 2700);
    } else if (push) {
        if (msgEl) { msgEl.textContent = '🤝 Push — ' + pVal + ' vs ' + dVal + ' — new round...'; msgEl.style.color = '#eab308'; }
        setTimeout(function(){ _bjNewRound(id); }, 2500);
    } else {
        var reason = pBust ? '💥 Bust! Your ' + pVal + ' beats max — dealer had ' + dVal : '😞 Dealer wins — ' + dVal + ' vs your ' + pVal;
        if (msgEl) { msgEl.textContent = reason + '. New round...'; msgEl.style.color = '#ef4444'; }
        setTimeout(function(){ _bjNewRound(id); }, 3200);
    }
}
function _bjNewRound(id) {
    var state = _bjInit(id);
    _bjRender(id, state, false);
    // Auto-handle blackjack on deal
    if (_bjHandVal(state.player) === 21) {
        _bjStand(id);
    }
}
window._bjHit = function(id) {
    var state = _bjGetState(id);
    if (!state || state.done) return;
    if (state.deck.length === 0) state.deck = _bjDeck();
    state.player.push(state.deck.pop());
    _bjSaveState(id, state);
    var pVal = _bjHandVal(state.player);
    _bjRender(id, state, false);
    if (pVal >= 21) _bjStand(id);
};
window._bjStand = function(id) {
    var state = _bjGetState(id);
    if (!state) return;
    _bjResolve(id, state);
};
// Auto-start blackjack game when card renders
function _bjStart(id) {
    var existing = _bjGetState(id);
    // Start fresh each time the card renders (new session/day)
    var state = _bjInit(id);
    _bjRender(id, state, false);
    if (_bjHandVal(state.player) === 21) _bjStand(id);
}
function _bjAttachStart(id) {
    // Called after card HTML is injected into DOM
    setTimeout(function(){
        var wrap = document.getElementById('bj-wrap-'+id);
        if (wrap) _bjStart(id);
    }, 50);
}

function _flexCardSuccess(id) {
    var card = document.getElementById('flex-card-' + id);
    if (!card) return;
    card.style.animation = 'flexPop 0.4s';
    setTimeout(function() {
        card.classList.add('done');
        card.style.animation = '';
        // Remove interaction widgets, leave the done state
        var interaction = card.querySelector('.flex-btn, .flex-drag-zone, .flex-hold-ring, [id^="seq-wrap-"], [id^="dtap-"]');
        // Just remove everything after the header
        var children = card.children;
        // Remove everything except first two children (emoji+name row and counter)
        while (card.children.length > 1) card.removeChild(card.lastChild);
        var total = _flexGetAllTimeCount(id);
        var action = FLEX_ACTIONS.find(function(a){ return a.id===id; });
        var nextMilestone = FLEX_BADGE_MILESTONES.find(function(m){ return total < m; });
        if (action) {
            var streak = document.createElement('span');
            streak.className = 'flex-streak';
            streak.innerHTML = '🔥 ×' + total;
            card.querySelector('[class*="flex-card-name"]') && card.children[0] && card.children[0].appendChild(streak);
        }
        if (nextMilestone) {
            var cnt = document.createElement('div');
            cnt.className = 'flex-counter';
            cnt.textContent = 'Next badge at ' + nextMilestone + ' completions (' + (nextMilestone - total) + ' to go)';
            card.appendChild(cnt);
        }
        // Refresh header count
        var doneCount = FLEX_ACTIONS.filter(function(a) { return _flexDoneToday(a.id); }).length;
        var prog = document.querySelector('#questHubBody .flex-card') && document.querySelector('#questHubBody [style*="linear-gradient(90deg"]');
        if (prog) prog.style.width = Math.round(doneCount/FLEX_ACTIONS.length*100) + '%';
        var countEl = document.querySelector('#questHubBody [style*="done today"]');
        if (countEl) countEl.textContent = doneCount + '/' + FLEX_ACTIONS.length + ' done today';
        if (typeof showToast === 'function') showToast('💪 +5 XP — ' + (action ? action.name : '') + '!');
    }, 300);
}

// ---- Mine helpers ----
var _flexMineStates = {}; // id -> {mines:[], revealed:[]}
function _flexMineInit(id) {
    if (_flexMineStates[id]) return _flexMineStates[id];
    // 4 mines in a 5x5 grid, seeded by today
    var seed = _flexDailySeed(id + '_mine');
    var mines = [];
    var positions = Array.from({length:25}, function(_,i){ return i; });
    // Fisher-Yates with seed
    for (var i = positions.length - 1; i > 0; i--) {
        var j = Math.abs(seed = (seed * 1664525 + 1013904223)|0) % (i + 1);
        var tmp = positions[i]; positions[i] = positions[j]; positions[j] = tmp;
    }
    _flexMineStates[id] = { mines: positions.slice(0, 4), revealed: [] };
    return _flexMineStates[id];
}

window._flexMineReveal = function(btn) {
    var id = btn.getAttribute('data-id');
    var cell = parseInt(btn.getAttribute('data-cell'));
    var state = _flexMineStates[id] || _flexMineInit(id);
    if (state.revealed.indexOf(cell) !== -1) return;
    var isMine = state.mines.indexOf(cell) !== -1;
    if (isMine) {
        // Reveal all mines
        state.mines.forEach(function(m) {
            var b = document.getElementById('mine-cell-' + id + '-' + m);
            if (b) { b.textContent = '💣'; b.style.background = 'rgba(239,68,68,0.2)'; b.style.borderColor = '#ef4444'; b.disabled = true; }
        });
        var hint = document.getElementById('mine-hint-' + id);
        if (hint) { hint.textContent = '💥 Boom! Try again'; hint.style.color = '#ef4444'; }
        // Reset after 1.5s
        setTimeout(function() {
            delete _flexMineStates[id];
            _flexMineInit(id);
            for (var c = 0; c < 25; c++) {
                var b2 = document.getElementById('mine-cell-' + id + '-' + c);
                if (b2) { b2.textContent = '?'; b2.style.background = 'var(--card-bg)'; b2.style.borderColor = 'var(--border)'; b2.style.color = 'var(--text)'; b2.disabled = false; }
            }
            if (hint) { hint.textContent = 'Reveal all safe squares · avoid 💣'; hint.style.color = 'var(--text-muted)'; }
        }, 1500);
        return;
    }
    // Safe — flood fill zeros
    var queue = [cell];
    while (queue.length) {
        var c3 = queue.shift();
        if (state.revealed.indexOf(c3) !== -1) continue;
        state.revealed.push(c3);
        var row = Math.floor(c3/5), col = c3%5;
        var adjacentMines = 0;
        [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(function(d) {
            var nr = row+d[0], nc = col+d[1];
            if (nr>=0&&nr<5&&nc>=0&&nc<5) { if (state.mines.indexOf(nr*5+nc)!==-1) adjacentMines++; }
        });
        var b3 = document.getElementById('mine-cell-' + id + '-' + c3);
        if (b3) {
            b3.disabled = true;
            if (adjacentMines === 0) {
                b3.textContent = '·'; b3.style.background = 'rgba(34,197,94,0.08)'; b3.style.color = 'var(--text-faint)';
                // Flood fill neighbours
                [[-1,0],[0,-1],[0,1],[1,0]].forEach(function(d) {
                    var nr2 = row+d[0], nc2 = col+d[1];
                    if (nr2>=0&&nr2<5&&nc2>=0&&nc2<5) {
                        var nc3 = nr2*5+nc2;
                        if (state.mines.indexOf(nc3)===-1 && state.revealed.indexOf(nc3)===-1) queue.push(nc3);
                    }
                });
            } else {
                b3.textContent = adjacentMines; b3.style.background = 'rgba(34,197,94,0.12)'; b3.style.color = ['','#22c55e','#f7931a','#ef4444','#8b5cf6','#ef4444','#f7931a','#22c55e','#6b7280'][adjacentMines] || '#22c55e';
            }
        }
    }
    // Check win: all non-mine cells revealed
    var safe = 25 - state.mines.length;
    if (state.revealed.length >= safe) {
        var hint2 = document.getElementById('mine-hint-' + id);
        if (hint2) { hint2.textContent = '✅ Area cleared!'; hint2.style.color = '#22c55e'; }
        setTimeout(function() { _flexMarkDone(id, function() { _flexCardSuccess(id); }); }, 400);
    }
};

// ---- Pattern helpers ----
function _flexPatternGen(id) {
    // Cycle of 2-3 shapes, length 5 (show 4, guess 5th)
    var shapes = ['▲','●','■','★'];
    var seed = _flexDailySeed(id + '_pat');
    var period = 2 + (Math.abs(seed) % 2); // 2 or 3
    var offset = Math.abs((seed * 1664525 + 1013904223)|0) % shapes.length;
    var seq = [];
    for (var i = 0; i < 5; i++) seq.push(shapes[(offset + i) % period === 0 ? offset : (offset + (i % period)) % shapes.length]);
    // Ensure there's a cycle (period must divide evenly)
    var cycleShapes = [];
    for (var j = 0; j < period; j++) cycleShapes.push(shapes[(offset + j) % shapes.length]);
    return Array.from({length:5}, function(_,i){ return cycleShapes[i % period]; });
}

// ── PAINT BOX ──
window._flexPaintBoxWire = function(id) {
    var canvas = document.getElementById('paintbox-canvas-' + id);
    if (!canvas || canvas._pbWired) return;
    canvas._pbWired = true;
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var color = canvas.getAttribute('data-color') || '#f7931a';
    var thresh = parseInt(canvas.getAttribute('data-thresh') || '80');
    var hint   = document.getElementById('paintbox-hint-' + id);
    var pctEl  = document.getElementById('paintbox-pct-' + id);
    var painting = false;
    var brushR = 18;
    var done = false;
    var totalPx = W * H;
    // Track painted pixels via a boolean grid (bucket-based, 4px blocks for perf)
    var BLOCK = 4;
    var COLS = Math.ceil(W / BLOCK), ROWS = Math.ceil(H / BLOCK);
    var painted = new Uint8Array(COLS * ROWS);
    var paintedCount = 0;

    function getXY(e) {
        var rect = canvas.getBoundingClientRect();
        var scaleX = W / rect.width, scaleY = H / rect.height;
        var src = e.touches ? e.touches[0] : e;
        return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY };
    }
    function paint(x, y) {
        if (done) return;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(x, y, brushR, 0, 2 * Math.PI);
        ctx.fill();
        ctx.globalAlpha = 1;
        // Mark blocks covered
        var bx0 = Math.max(0, Math.floor((x - brushR) / BLOCK));
        var bx1 = Math.min(COLS - 1, Math.ceil((x + brushR) / BLOCK));
        var by0 = Math.max(0, Math.floor((y - brushR) / BLOCK));
        var by1 = Math.min(ROWS - 1, Math.ceil((y + brushR) / BLOCK));
        for (var bx = bx0; bx <= bx1; bx++) {
            for (var by = by0; by <= by1; by++) {
                var idx = by * COLS + bx;
                if (!painted[idx]) { painted[idx] = 1; paintedCount++; }
            }
        }
        var pct = Math.min(100, Math.round(paintedCount / (COLS * ROWS) * 100));
        if (pctEl) pctEl.textContent = pct + '%';
        if (pct >= thresh && !done) {
            done = true;
            if (hint) { hint.textContent = '✅ Sold! Chairs out, sats in.'; hint.style.color = '#22c55e'; }
            if (pctEl) pctEl.style.color = '#22c55e';
            setTimeout(function() { _flexMarkDone(id, function() { _flexCardSuccess(id); }); }, 500);
        }
    }
    function onStart(e) { e.preventDefault(); painting = true; var p = getXY(e); paint(p.x, p.y); }
    function onMove(e) { e.preventDefault(); if (!painting) return; var p = getXY(e); paint(p.x, p.y); }
    function onEnd(e) { painting = false; }
    canvas.addEventListener('mousedown', onStart);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup',   onEnd);
    canvas.addEventListener('mouseleave',onEnd);
    canvas.addEventListener('touchstart', onStart, {passive:false});
    canvas.addEventListener('touchmove',  onMove,  {passive:false});
    canvas.addEventListener('touchend',   onEnd);
};

// ── TYPE SENTENCE ──
window._flexTypeSentenceCheck = function(input) {
    var id = input.getAttribute('data-id');
    var wrap = document.getElementById('typesentence-wrap-' + id);
    var hint = document.getElementById('typesentence-hint-' + id);
    var sentence = wrap ? wrap.getAttribute('data-sentence') : '';
    var val = input.value;
    if (val === sentence) {
        input.style.borderColor = '#22c55e';
        input.style.color = '#22c55e';
        input.disabled = true;
        if (hint) { hint.textContent = '✅ They know now.'; hint.style.color = '#22c55e'; }
        setTimeout(function() { _flexMarkDone(id, function() { _flexCardSuccess(id); }); }, 400);
    } else if (sentence.indexOf(val) !== 0) {
        // Typed something that can't match — shake and clear
        input.style.borderColor = '#ef4444';
        input.style.color = '#ef4444';
        setTimeout(function() {
            input.value = '';
            input.style.borderColor = 'var(--border)';
            input.style.color = 'var(--text)';
        }, 500);
    } else {
        input.style.borderColor = 'var(--accent)';
        input.style.color = 'var(--text)';
    }
};

// ── RED CANDLE HOLD ──
(function() {
    var _rcState = {};
    var HOLD_MS = 5000;

    window._flexRedCandleStart = function(id) {
        if (_flexDoneToday(id)) return;
        if (_rcState[id] && _rcState[id].running) return;
        var fill  = document.getElementById('redcandle-fill-'  + id);
        var prog  = document.getElementById('redcandle-prog-'  + id);
        var label = document.getElementById('redcandle-label-' + id);
        var hint  = document.getElementById('redcandle-hint-'  + id);
        var price = document.getElementById('redcandle-price-' + id);
        if (price) {
            var p = window._btcPrice || (window.tickerData && window.tickerData.price) || null;
            if (p) price.textContent = '$' + Number(p).toLocaleString();
        }
        var start = Date.now();
        _rcState[id] = { running: true, raf: null };
        function tick() {
            var elapsed = Date.now() - start;
            var pct = Math.min(100, (elapsed / HOLD_MS) * 100);
            if (fill)  fill.style.height = pct + '%';
            if (prog)  prog.style.width  = pct + '%';
            var secs = Math.ceil((HOLD_MS - elapsed) / 1000);
            if (label) label.textContent = pct < 100 ? secs + 's' : 'REKT';
            if (pct >= 100) {
                _rcState[id].running = false;
                if (label) { label.textContent = '✅'; label.style.color = '#22c55e'; }
                if (hint)  { hint.textContent = 'Witnessed. Now you know.'; hint.style.color = '#22c55e'; }
                setTimeout(function() { _flexMarkDone(id, function() { _flexCardSuccess(id); }); }, 400);
            } else {
                _rcState[id].raf = requestAnimationFrame(tick);
            }
        }
        _rcState[id].raf = requestAnimationFrame(tick);
    };

    window._flexRedCandleEnd = function(id) {
        var state = _rcState[id];
        if (!state || !state.running) return;
        cancelAnimationFrame(state.raf);
        state.running = false;
        var fill  = document.getElementById('redcandle-fill-'  + id);
        var prog  = document.getElementById('redcandle-prog-'  + id);
        var label = document.getElementById('redcandle-label-' + id);
        var hint  = document.getElementById('redcandle-hint-'  + id);
        if (fill)  { fill.style.transition  = 'height 0.4s ease'; fill.style.height  = '0%'; }
        if (prog)  { prog.style.transition  = 'width 0.4s ease';  prog.style.width   = '0%'; }
        if (label) { label.textContent = 'HOLD'; label.style.color = '#ef4444'; }
        if (hint)  { hint.textContent = 'Don\'t look away!'; hint.style.color = '#ef4444'; }
        setTimeout(function() {
            if (fill) fill.style.transition = 'none';
            if (prog) prog.style.transition = 'none';
            if (hint) { hint.textContent = 'Watch it bleed.\nPress & hold.'; hint.style.color = 'var(--text-muted)'; }
        }, 500);
        delete _rcState[id];
    };
})();

// ── CANDLE HOLD ──
(function() {
    var _cdState = {};
    var HOLD_MS = 5000;

    window._flexCandleStart = function(id) {
        if (_flexDoneToday(id)) return;
        if (_cdState[id] && _cdState[id].running) return;
        var fill  = document.getElementById('candle-fill-'  + id);
        var prog  = document.getElementById('candle-prog-'  + id);
        var label = document.getElementById('candle-label-' + id);
        var hint  = document.getElementById('candle-hint-'  + id);
        var price = document.getElementById('candle-price-' + id);
        // Show current BTC price if available
        if (price) {
            var p = window._btcPrice || (window.tickerData && window.tickerData.price) || null;
            if (p) price.textContent = '$' + Number(p).toLocaleString();
        }
        var start = Date.now();
        _cdState[id] = { running: true, raf: null };
        function tick() {
            var elapsed = Date.now() - start;
            var pct = Math.min(100, (elapsed / HOLD_MS) * 100);
            if (fill)  fill.style.height  = pct + '%';
            if (prog)  prog.style.width   = pct + '%';
            var secs = Math.ceil((HOLD_MS - elapsed) / 1000);
            if (label) label.textContent = pct < 100 ? secs + 's' : 'HOLD';
            if (pct >= 100) {
                _cdState[id].running = false;
                if (label) label.textContent = '✅';
                if (hint)  { hint.textContent = 'Diamond hands. Never sell.'; hint.style.color = '#4ade80'; }
                setTimeout(function() { _flexMarkDone(id, function() { _flexCardSuccess(id); }); }, 400);
            } else {
                _cdState[id].raf = requestAnimationFrame(tick);
            }
        }
        _cdState[id].raf = requestAnimationFrame(tick);
    };

    window._flexCandleEnd = function(id, success) {
        var state = _cdState[id];
        if (!state || !state.running) return;
        cancelAnimationFrame(state.raf);
        state.running = false;
        var fill  = document.getElementById('candle-fill-'  + id);
        var prog  = document.getElementById('candle-prog-'  + id);
        var label = document.getElementById('candle-label-' + id);
        var hint  = document.getElementById('candle-hint-'  + id);
        // Drain the candle back down
        if (fill)  { fill.style.transition  = 'height 0.4s ease'; fill.style.height  = '0%'; }
        if (prog)  { prog.style.transition  = 'width 0.4s ease';  prog.style.width   = '0%'; }
        if (label) label.textContent = 'HOLD';
        if (hint)  { hint.textContent = 'Don\'t let go!'; hint.style.color = '#ef4444'; }
        setTimeout(function() {
            if (fill) fill.style.transition = 'none';
            if (prog) prog.style.transition = 'none';
            if (hint) { hint.textContent = 'Press & hold the candle'; hint.style.color = 'var(--text-muted)'; }
        }, 500);
        delete _cdState[id];
    };
})();

// ── GUN RANGE ──
var _grState = {};
var _grTargetEmojis = ['💀','🧙‍♂️','🦖','👾','🦄','🐻','💸','🤡','👹','👸'];

window._flexGunRangeStart = function(id) {
    var wrap = document.getElementById('gunrange-wrap-' + id);
    var startBtn = document.getElementById('gr-start-' + id);
    var status = document.getElementById('gr-status-' + id);
    if (!wrap || _grState[id] && _grState[id].running) return;
    if (startBtn) startBtn.style.display = 'none';
    var seed = _flexDailySeed(id + '_gr');
    // Pick 3 distinct target emojis for today
    var pool = _grTargetEmojis.slice();
    var targets = [];
    for (var i = 0; i < 3; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
        var idx = Math.abs(seed) % pool.length;
        targets.push(pool.splice(idx, 1)[0]);
    }
    _grState[id] = { running: true, hits: 0, total: 3, targets: targets, timer: null };
    _flexGunRangeNext(id);
};

window._flexGunRangeNext = function(id) {
    var state = _grState[id];
    if (!state || !state.running) return;
    var wrap = document.getElementById('gunrange-wrap-' + id);
    var el = document.getElementById('gr-target-' + id);
    var status = document.getElementById('gr-status-' + id);
    var hitsEl = document.getElementById('gr-hits-' + id);
    if (!wrap || !el) return;
    if (state.hits >= state.total) return;
    // Random x/y inside the range area avoiding edges
    var rect = wrap.getBoundingClientRect();
    var W = wrap.offsetWidth || 260, H = wrap.offsetHeight || 140;
    var px = 18 + Math.floor((Math.abs(_flexDailySeed(id + '_gx' + state.hits + Date.now().toString(36))) % (W - 36)));
    var py = 20 + Math.floor((Math.abs(_flexDailySeed(id + '_gy' + state.hits + Date.now().toString(36).slice(-4))) % (H - 50)));
    el.textContent = state.targets[state.hits];
    el.style.left = px + 'px';
    el.style.top = py + 'px';
    el.style.display = 'block';
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%,-50%) scale(1)';
    el.style.transition = 'none';
    if (status) { status.textContent = 'Target ' + (state.hits + 1) + ' of ' + state.total + ' — hit it!'; }
    if (hitsEl) { hitsEl.textContent = Array(state.hits + 1).join('🟠') + Array(state.total - state.hits + 1).join('⚪'); }
    // Auto-miss if not tapped in 2.5s
    clearTimeout(state.timer);
    state.timer = setTimeout(function() {
        if (!_grState[id] || !_grState[id].running) return;
        el.style.transition = 'opacity 0.3s, transform 0.3s';
        el.style.opacity = '0';
        el.style.transform = 'translate(-50%,-50%) scale(0.5)';
        if (status) { status.textContent = 'Missed! Try again…'; status.style.color = '#ef4444'; }
        setTimeout(function() {
            if (status) status.style.color = 'rgba(247,147,26,0.7)';
            // Restart from 0
            _grState[id].hits = 0;
            if (hitsEl) hitsEl.textContent = '';
            setTimeout(function() { _flexGunRangeNext(id); }, 600);
        }, 700);
    }, 2500);
};

window._flexGunRangeHit = function(el) {
    var id = el.getAttribute('data-id');
    var state = _grState[id];
    if (!state || !state.running) return;
    clearTimeout(state.timer);
    var status = document.getElementById('gr-status-' + id);
    var hitsEl = document.getElementById('gr-hits-' + id);
    // Flash hit
    el.style.transition = 'transform 0.15s, opacity 0.15s';
    el.style.transform = 'translate(-50%,-50%) scale(1.5)';
    el.style.opacity = '0';
    state.hits++;
    if (hitsEl) { hitsEl.textContent = Array(state.hits + 1).join('🟠') + Array(state.total - state.hits + 1).join('⚪'); }
    setTimeout(function() {
        el.style.display = 'none';
        if (state.hits >= state.total) {
            state.running = false;
            if (status) { status.textContent = '🟠🟠🟠 All targets down!'; status.style.color = '#22c55e'; }
            setTimeout(function() { _flexMarkDone(id, function() { _flexCardSuccess(id); }); }, 500);
        } else {
            setTimeout(function() { _flexGunRangeNext(id); }, 300);
        }
    }, 150);
};

window._flexAddThreeCheck = function(input) {
    var id = input.getAttribute('data-id');
    var wrap = document.getElementById('addthree-wrap-' + id);
    var hint = document.getElementById('addthree-hint-' + id);
    var answer = parseInt(wrap ? wrap.getAttribute('data-answer') : 0);
    var val = parseInt(input.value);
    if (isNaN(val)) return;
    if (val === answer) {
        input.style.borderColor = '#22c55e';
        input.style.color = '#22c55e';
        input.disabled = true;
        if (hint) { hint.textContent = '✅ Correct! ' + answer + ' — stay humble, no margin needed.'; hint.style.color = '#22c55e'; }
        setTimeout(function() { _flexMarkDone(id, function() { _flexCardSuccess(id); }); }, 500);
    } else if (input.value.length >= (answer > 99 ? 3 : 2)) {
        input.style.borderColor = '#ef4444';
        input.style.color = '#ef4444';
        if (hint) { hint.textContent = 'Wrong — try again, no peeking'; hint.style.color = '#ef4444'; }
        setTimeout(function() {
            input.value = '';
            input.style.borderColor = 'var(--border)';
            input.style.color = 'var(--text)';
            if (hint) { hint.textContent = 'Type the answer — no calculator, no leverage'; hint.style.color = 'var(--text-muted)'; }
        }, 800);
    }
};

window._flexFindQTap = function(btn) {
    var id = btn.getAttribute('data-id');
    var isQ = btn.getAttribute('data-isq') === '1';
    var hint = document.getElementById('findq-hint-' + id);
    var wrap = document.getElementById('findq-wrap-' + id);
    if (isQ) {
        btn.style.background = 'rgba(34,197,94,0.18)';
        btn.style.borderColor = '#22c55e';
        btn.style.color = '#22c55e';
        if (hint) { hint.textContent = '✅ Found it!'; hint.style.color = '#22c55e'; }
        if (wrap) wrap.querySelectorAll('button').forEach(function(b) { b.disabled = true; });
        setTimeout(function() { _flexMarkDone(id, function() { _flexCardSuccess(id); }); }, 400);
    } else {
        btn.style.background = 'rgba(239,68,68,0.12)';
        btn.style.borderColor = '#ef4444';
        btn.style.color = '#ef4444';
        if (hint) { hint.textContent = 'That\'s a p — keep looking!'; hint.style.color = '#ef4444'; }
        setTimeout(function() {
            btn.style.background = 'var(--card-bg)';
            btn.style.borderColor = 'var(--border)';
            btn.style.color = 'var(--text-muted)';
            if (hint) { hint.textContent = 'Find the q hiding among the p’s'; hint.style.color = 'var(--text-muted)'; }
        }, 700);
    }
};

window._flexPatternPick = function(btn) {
    var id = btn.getAttribute('data-id');
    var shape = btn.getAttribute('data-shape');
    var wrap = document.getElementById('pattern-wrap-' + id);
    var answer = wrap ? wrap.getAttribute('data-answer') : null;
    var hint = document.getElementById('pattern-hint-' + id);
    if (shape === answer) {
        btn.style.borderColor = '#22c55e'; btn.style.background = 'rgba(34,197,94,0.12)';
        if (hint) { hint.textContent = '✅ Correct!'; hint.style.color = '#22c55e'; }
        // disable all
        wrap && wrap.querySelectorAll('button').forEach(function(b) { b.disabled = true; });
        setTimeout(function() { _flexMarkDone(id, function() { _flexCardSuccess(id); }); }, 400);
    } else {
        btn.style.borderColor = '#ef4444'; btn.style.background = 'rgba(239,68,68,0.1)';
        if (hint) { hint.textContent = 'Not quite — look at the cycle'; hint.style.color = '#ef4444'; }
        setTimeout(function() { btn.style.borderColor = 'var(--border)'; btn.style.background = 'var(--card-bg)'; if(hint){hint.style.color='var(--text-muted)';hint.textContent='Pick the next shape in the sequence';} }, 900);
    }
};

// ---- Chess checkmate-in-1 puzzles ----
// Source: Lichess Open Puzzle Database (database.lichess.org)
// All puzzles: white to move, verified mateIn1 tag, no promotions, no castling.
// Puzzle IDs reference https://lichess.org/training/<id>
var CHESS_PUZZLES = [
    // lichess.org/training/000rZ
    { id:'p01', label:'Mate in 1 — Black to move', turn:'b', pieces:{"c8":"bK","d8":"bR","f8":"bB","h8":"bR","a7":"bP","c7":"bP","f7":"bP","g7":"bP","c6":"bP","d6":"bQ","e6":"wN","h5":"bP","g4":"bN","c3":"wN","d3":"wP","e3":"wB","a2":"wP","b2":"wP","c2":"wP","f2":"wP","g2":"wP","h2":"wP","a1":"wR","d1":"wQ","f1":"wR","g1":"wK"}, solution:{"from":"d6","to":"h2"}, hint:'Find checkmate' },
    // lichess.org/training/001gi
    { id:'p02', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"wN","h8":"bR","b7":"bP","d7":"bK","f7":"bP","g7":"bP","h7":"bP","c6":"bN","d6":"bP","a5":"bB","e5":"bP","e4":"wP","g4":"bB","a3":"wN","c3":"wQ","a2":"wP","f2":"wP","g2":"wP","h2":"wP","a1":"wR","e1":"wK","f1":"wB","h1":"wR"}, solution:{"from":"a5","to":"c3"}, hint:'Find checkmate' },
    // lichess.org/training/001pC
    { id:'p03', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","f8":"bR","g8":"bK","a7":"bP","b7":"bP","f7":"bP","g7":"bP","h7":"bP","d6":"bB","c5":"bP","e5":"bP","f5":"wP","g5":"wB","h4":"wN","c3":"wP","d3":"wP","h3":"bN","a2":"wP","b2":"wP","g2":"wP","h2":"wP","a1":"wR","d1":"wQ","g1":"wR","h1":"wK"}, solution:{"from":"h3","to":"f2"}, hint:'Find checkmate' },
    // lichess.org/training/001wb
    { id:'p04', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","e8":"bK","h8":"bR","a7":"bP","b7":"bB","d7":"bP","f7":"bP","g7":"bP","h7":"bP","b6":"bB","g6":"bQ","b5":"wQ","e5":"wP","c3":"wN","d3":"wP","f3":"wP","g3":"wP","a2":"wP","b2":"wP","g2":"wP","a1":"wR","c1":"wB","f1":"wR","h1":"wK"}, solution:{"from":"g6","to":"h5"}, hint:'Find checkmate' },
    // lichess.org/training/002CP
    { id:'p05', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","g8":"bK","a7":"bP","b7":"bP","g7":"bP","h7":"bP","e6":"bP","g6":"bQ","e5":"bP","d4":"bN","a3":"wP","e3":"wQ","g3":"wP","b2":"wP","c2":"wP","h2":"wP","c1":"wK","d1":"wR","f1":"wR"}, solution:{"from":"g6","to":"c2"}, hint:'Find checkmate' },
    // lichess.org/training/002HE
    { id:'p06', label:'Mate in 1 — Black to move', turn:'b', pieces:{"b8":"bQ","c8":"bR","f8":"bR","g8":"bK","b7":"bP","d7":"bP","f7":"bP","g7":"bP","h7":"bP","a6":"bP","b6":"wB","e6":"bP","g6":"bN","h5":"bN","c4":"wP","e4":"wP","b3":"wQ","e3":"wN","f3":"wP","h3":"wP","a2":"wP","b2":"wP","e2":"wB","f2":"wK","g2":"wP","h2":"bB","d1":"wR","f1":"wR"}, solution:{"from":"b8","to":"g3"}, hint:'Find checkmate' },
    // lichess.org/training/002Q2
    { id:'p07', label:'Mate in 1 — Black to move', turn:'b', pieces:{"h8":"bK","a7":"bP","f7":"wR","h7":"bP","d6":"bP","h6":"wB","c5":"bP","d5":"wN","f5":"bN","c4":"wP","d4":"bB","e4":"wB","g4":"bB","d3":"wP","g3":"wP","a2":"wP","e2":"bR","f1":"wR","h1":"wK"}, solution:{"from":"f5","to":"g3"}, hint:'Find checkmate' },
    // lichess.org/training/002vV
    { id:'p08', label:'Mate in 1 — Black to move', turn:'b', pieces:{"g7":"bK","b6":"wR","h6":"bP","f5":"bP","h5":"wP","f4":"wP","h4":"wK","g3":"wP","a1":"bR"}, solution:{"from":"a1","to":"h1"}, hint:'Find checkmate' },
    // lichess.org/training/003IX
    { id:'p09', label:'Mate in 1 — Black to move', turn:'b', pieces:{"d7":"bP","e7":"bK","a6":"wR","b5":"wR","e5":"wP","f5":"wK","h5":"bP","c4":"wP","d4":"wP","e4":"bN","g4":"bR"}, solution:{"from":"e4","to":"g3"}, hint:'Find checkmate' },
    // lichess.org/training/003YF
    { id:'p10', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","f8":"bR","g8":"bK","b7":"bP","c7":"bP","f7":"bP","g7":"bP","h7":"bP","a6":"bP","d6":"bP","c5":"bB","d5":"wP","e5":"bP","c4":"wP","e4":"wP","f4":"wB","h4":"bQ","a3":"wP","c3":"wN","f3":"wB","b2":"wP","f2":"wP","a1":"wR","d1":"wQ","e1":"wK","g1":"wR"}, solution:{"from":"h4","to":"f2"}, hint:'Find checkmate' },
    // lichess.org/training/004JD
    { id:'p11', label:'Mate in 1 — Black to move', turn:'b', pieces:{"d8":"bR","a7":"wR","c6":"bP","a5":"bP","c5":"wP","f5":"bP","b4":"bP","g4":"bK","a3":"bN","b3":"wP","e3":"wK","a2":"wP","e2":"wN","f2":"wP"}, solution:{"from":"a3","to":"c2"}, hint:'Find checkmate' },
    // lichess.org/training/004WZ
    { id:'p12', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","h8":"bK","b7":"bB","f7":"bP","g7":"bP","a6":"bP","c6":"bQ","e6":"bP","f6":"bN","h6":"bP","c5":"bP","a4":"wP","c4":"wB","b3":"wP","c3":"wN","h3":"wQ","c2":"wP","e2":"wR","f2":"wP","h2":"wP","a1":"wR","g1":"wK"}, solution:{"from":"c6","to":"h1"}, hint:'Find checkmate' },
    // lichess.org/training/004yJ
    { id:'p13', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","f8":"bR","g8":"bK","b7":"bB","c7":"bP","f7":"bP","g7":"bP","h7":"bP","a6":"bP","c6":"bQ","e6":"bP","f6":"bN","c5":"wP","e5":"wN","d3":"wB","a2":"wP","c2":"wP","e2":"wQ","f2":"wP","g2":"wP","h2":"wP","a1":"wR","f1":"wR","g1":"wK"}, solution:{"from":"c6","to":"g2"}, hint:'Find checkmate' },
    // lichess.org/training/005wJ
    { id:'p14', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","e8":"bK","f8":"bB","h8":"bR","a7":"bP","b7":"bP","c7":"bQ","d7":"wN","f7":"bP","g7":"bP","h7":"bP","e6":"bP","f6":"bN","b5":"wQ","f5":"bB","d4":"wP","a2":"wP","b2":"wP","e2":"wP","f2":"wP","g2":"wP","h2":"wP","a1":"wR","b1":"wN","c1":"wB","e1":"wK","f1":"wB","h1":"wR"}, solution:{"from":"c7","to":"c1"}, hint:'Find checkmate' },
    // lichess.org/training/005x9
    { id:'p15', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","c8":"bB","e8":"bK","f8":"bB","h8":"wQ","a7":"bP","b7":"bP","c7":"bP","h7":"bP","g6":"bP","h6":"wB","d5":"wP","c4":"bP","d4":"bN","a2":"wP","b2":"wP","c2":"wP","e2":"bQ","f2":"wP","g2":"wP","h2":"wP","a1":"wR","b1":"wN","c1":"wK","h1":"wR"}, solution:{"from":"e2","to":"c2"}, hint:'Find checkmate' },
    // lichess.org/training/00656
    { id:'p16', label:'Mate in 1 — Black to move', turn:'b', pieces:{"h8":"bR","a7":"bP","b7":"bP","c7":"bP","f7":"bK","g7":"bP","c6":"bN","d6":"bB","f6":"bP","g6":"bP","d5":"bP","h5":"bR","d4":"wP","g4":"wP","c3":"wP","d3":"wQ","e3":"wB","a2":"wP","b2":"wP","f2":"wP","g2":"wP","a1":"wR","e1":"wR","g1":"wK"}, solution:{"from":"h5","to":"h1"}, hint:'Find checkmate' },
    // lichess.org/training/007AH
    { id:'p17', label:'Mate in 1 — Black to move', turn:'b', pieces:{"d8":"bR","f8":"bN","b7":"bB","c7":"bP","e7":"bB","f7":"bK","g7":"bP","h7":"bP","a6":"bP","c6":"bQ","f6":"bN","b5":"bP","d4":"wP","a3":"wP","c3":"wN","g3":"wB","b2":"wP","c2":"wP","e2":"wQ","f2":"wP","g2":"wP","h2":"wP","a1":"wR","e1":"wR","g1":"wK"}, solution:{"from":"c6","to":"g2"}, hint:'Find checkmate' },
    // lichess.org/training/007HB
    { id:'p18', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","b8":"bN","e8":"bQ","g8":"bK","a7":"bP","b7":"bP","f7":"bP","g7":"bP","h7":"bP","c6":"bP","d6":"bB","d5":"bP","f5":"wB","c4":"wP","d4":"wN","b3":"wQ","a2":"wP","b2":"wP","f2":"wP","g2":"wP","h2":"wP","a1":"wR","c1":"wB","h1":"wK"}, solution:{"from":"e8","to":"e1"}, hint:'Find checkmate' },
    // lichess.org/training/008LD
    { id:'p19', label:'Mate in 1 — Black to move', turn:'b', pieces:{"g7":"bP","h7":"bP","g6":"bK","f5":"bP","g5":"wN","f4":"wP","f3":"bR","g3":"wP","h3":"bB","e2":"wR","h2":"wP","g1":"wK"}, solution:{"from":"f3","to":"f1"}, hint:'Find checkmate' },
    // lichess.org/training/008cl
    { id:'p20', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","e8":"bK","h8":"bR","a7":"bP","b7":"bP","c7":"bP","f7":"bP","h7":"bP","c6":"bN","e6":"bP","f6":"bP","h5":"bQ","c4":"wP","d4":"wN","g4":"wP","c3":"wB","d3":"wP","g3":"bB","a2":"wP","b2":"wP","e2":"wB","g2":"wP","a1":"wR","d1":"wQ","f1":"wR","g1":"wK"}, solution:{"from":"h5","to":"h2"}, hint:'Find checkmate' },
    // lichess.org/training/009L0
    { id:'p21', label:'Mate in 1 — Black to move', turn:'b', pieces:{"g8":"bK","a7":"bP","b7":"bB","e7":"bR","g7":"bP","h7":"wN","b6":"bN","g6":"wB","h6":"bP","d5":"bP","b4":"wP","e4":"bP","f4":"wR","a3":"wP","f2":"wP","g2":"wP","h2":"wP","c1":"bR","d1":"wR","g1":"wK"}, solution:{"from":"c1","to":"d1"}, hint:'Find checkmate' },
    // lichess.org/training/009bn
    { id:'p22', label:'Mate in 1 — Black to move', turn:'b', pieces:{"c8":"bK","d8":"bR","g8":"bR","a7":"bP","b7":"bP","c7":"bB","f7":"bP","g7":"bP","h7":"bP","d6":"bQ","e6":"wN","f6":"bN","d5":"bP","g5":"wB","a4":"wP","c3":"wP","f3":"wQ","h3":"wP","b2":"wP","c2":"wB","f2":"wP","g2":"wP","a1":"wR","f1":"wR","g1":"wK"}, solution:{"from":"d6","to":"h2"}, hint:'Find checkmate' },
    // lichess.org/training/009eX
    { id:'p23', label:'Mate in 1 — Black to move', turn:'b', pieces:{"c8":"bR","g8":"bK","h7":"bP","g6":"bQ","a5":"bP","c5":"wN","d5":"bP","a4":"wQ","b4":"bP","e4":"bP","f4":"bR","a3":"wP","f3":"wP","b2":"wP","c2":"wR","f2":"wP","h2":"wK","g1":"wR"}, solution:{"from":"f4","to":"h4"}, hint:'Find checkmate' },
    // lichess.org/training/009fH
    { id:'p24', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","b8":"bN","e8":"bK","f8":"bB","h8":"bR","a7":"bP","b7":"wQ","e7":"bP","f7":"bP","g7":"bP","h7":"bP","c6":"bP","f6":"bN","d4":"bQ","g4":"bB","a2":"wP","b2":"wP","c2":"wP","f2":"wP","g2":"wP","h2":"wP","a1":"wR","b1":"wN","c1":"wB","e1":"wK","f1":"wB","g1":"wN","h1":"wR"}, solution:{"from":"d4","to":"d1"}, hint:'Find checkmate' },
    // lichess.org/training/00A9Q
    { id:'p25', label:'Mate in 1 — Black to move', turn:'b', pieces:{"c8":"bR","d8":"bQ","f8":"bR","g8":"bK","b7":"bP","f7":"bP","h7":"bP","a6":"bP","c6":"bP","d6":"bN","g6":"bP","a5":"wP","c5":"wN","d5":"bP","b4":"wP","d4":"wP","e4":"bN","f4":"wP","e3":"wP","f2":"wP","g2":"wB","h2":"wP","a1":"wR","c1":"wQ","g1":"wR","h1":"wK"}, solution:{"from":"e4","to":"f2"}, hint:'Find checkmate' },
    // lichess.org/training/00B2k
    { id:'p26', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","f8":"bR","g8":"bK","a7":"bP","b7":"bB","c7":"bP","g7":"bP","h7":"bP","b6":"bP","d6":"bP","e6":"bP","g5":"wB","c4":"wP","d4":"wP","e4":"bP","h4":"bQ","d3":"wB","e3":"wP","h3":"wP","a2":"wP","b2":"wP","f2":"wP","a1":"wR","d1":"wQ","e1":"wK","g1":"wR"}, solution:{"from":"h4","to":"f2"}, hint:'Find checkmate' },
    // lichess.org/training/00BQD
    { id:'p27', label:'Mate in 1 — Black to move', turn:'b', pieces:{"e8":"bR","d7":"wR","f7":"bP","g7":"bK","h7":"bP","g6":"bP","b5":"wP","b4":"bB","f3":"wB","b2":"wP","d2":"wR","f2":"wP","g2":"wP","h2":"wP","g1":"wK"}, solution:{"from":"e8","to":"e1"}, hint:'Find checkmate' },
    // lichess.org/training/00Bm8
    { id:'p28', label:'Mate in 1 — Black to move', turn:'b', pieces:{"g7":"bK","h7":"bP","e6":"bB","g6":"bQ","b5":"bP","b4":"wP","c4":"bP","d4":"wP","e4":"wN","h4":"wQ","c3":"wP","e3":"wP","a2":"bR","g2":"wP","f1":"wR","g1":"wK"}, solution:{"from":"g6","to":"g2"}, hint:'Find checkmate' },
    // lichess.org/training/00C7m
    { id:'p29', label:'Mate in 1 — Black to move', turn:'b', pieces:{"f7":"bK","b6":"wP","g6":"wR","h6":"wK","g5":"wP","b4":"bR"}, solution:{"from":"b4","to":"h4"}, hint:'Find checkmate' },
    // lichess.org/training/00C8Y
    { id:'p30', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","b8":"bN","c8":"bB","f8":"bR","g8":"bK","a7":"bP","b7":"bP","f7":"bP","h7":"bP","d6":"bP","g6":"wP","h6":"bB","e5":"bP","g5":"bQ","d4":"bP","e4":"wQ","f3":"wN","a2":"wP","b2":"wP","c2":"wP","e2":"wP","f2":"wP","g2":"wP","a1":"wR","b1":"wN","e1":"wK","f1":"wB","h1":"wR"}, solution:{"from":"g5","to":"c1"}, hint:'Find checkmate' },
    // lichess.org/training/00DPQ
    { id:'p31', label:'Mate in 1 — Black to move', turn:'b', pieces:{"c8":"bK","h8":"bR","a7":"bP","b7":"bP","f7":"bP","g7":"bP","e6":"bP","f6":"bN","c5":"bN","d5":"bP","g5":"bP","b3":"wB","d3":"wP","f3":"wP","g3":"bQ","a2":"wP","b2":"wP","c2":"wP","d2":"wN","h2":"wR","a1":"wR","d1":"wQ","h1":"wK"}, solution:{"from":"g3","to":"h2"}, hint:'Find checkmate' },
    // lichess.org/training/00DWo
    { id:'p32', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bB","f8":"bB","h8":"bR","d7":"bK","f7":"bP","g7":"bP","h7":"bP","a6":"bP","d6":"bP","b5":"bP","e5":"bP","d4":"wP","e4":"bQ","a3":"wN","e3":"wB","a2":"wP","b2":"wP","f2":"wP","g2":"wP","h2":"wP","a1":"wR","d1":"wQ","f1":"wR","g1":"wK"}, solution:{"from":"e4","to":"g2"}, hint:'Find checkmate' },
    // lichess.org/training/00Dlt
    { id:'p33', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","e8":"bK","f8":"bB","h8":"bR","a7":"bP","f7":"bP","g7":"bP","a6":"bB","c6":"bP","h6":"bP","a5":"bN","e5":"bP","f5":"wQ","e4":"wN","c3":"wN","d3":"bQ","a2":"wP","b2":"wP","d2":"wP","f2":"wP","g2":"wP","h2":"wP","a1":"wR","c1":"wB","f1":"wR","g1":"wK"}, solution:{"from":"d3","to":"f1"}, hint:'Find checkmate' },
    // lichess.org/training/00EDa
    { id:'p34', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","c8":"bB","d8":"bK","h8":"bR","a7":"bP","b7":"bP","c7":"bP","e7":"bN","f7":"bP","h7":"bP","d6":"wP","g6":"bP","h6":"wP","b5":"wN","g5":"bQ","c4":"wB","d4":"wP","f4":"bN","a2":"wP","b2":"wP","c2":"wP","g2":"wP","a1":"wR","c1":"wB","d1":"wQ","g1":"wK","h1":"wR"}, solution:{"from":"g5","to":"g2"}, hint:'Find checkmate' },
    // lichess.org/training/00EUB
    { id:'p35', label:'Mate in 1 — Black to move', turn:'b', pieces:{"d8":"bR","f8":"bK","h8":"bR","f7":"bP","h7":"bP","a6":"bB","d6":"bQ","f6":"bP","a5":"wP","e5":"bP","a4":"wB","b4":"bP","e4":"wP","c3":"wN","f3":"wP","d2":"wQ","g2":"wP","h2":"wP","b1":"wR","e1":"wK","h1":"wR"}, solution:{"from":"d6","to":"d2"}, hint:'Find checkmate' },
    // lichess.org/training/00EWi
    { id:'p36', label:'Mate in 1 — Black to move', turn:'b', pieces:{"f6":"bP","g6":"bK","h6":"bP","b5":"wR","c5":"wP","b4":"wP","f4":"wP","g4":"wK","h4":"wP","a3":"bR"}, solution:{"from":"f6","to":"f5"}, hint:'Find checkmate' },
    // lichess.org/training/00EdH
    { id:'p37', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","f8":"bR","g8":"bK","a7":"bP","b7":"bB","f7":"bP","g7":"bP","h7":"bP","b6":"bP","e6":"bP","d5":"bQ","d4":"wN","c3":"wP","h3":"wP","a2":"wP","b2":"wP","c2":"wQ","f2":"wP","g2":"wP","a1":"wR","f1":"wR","g1":"wK"}, solution:{"from":"d5","to":"g2"}, hint:'Find checkmate' },
    // lichess.org/training/00Enl
    { id:'p38', label:'Mate in 1 — Black to move', turn:'b', pieces:{"c8":"bK","d8":"bR","b7":"bP","c7":"bP","a6":"bP","c6":"bB","h6":"wR","c5":"wP","d5":"bP","e5":"wP","d4":"wB","g4":"bP","c3":"wP","e3":"wQ","g3":"wP","h3":"bP","a2":"wP","b2":"wP","c2":"bQ","h2":"wP","f1":"wR","g1":"wK"}, solution:{"from":"c2","to":"g2"}, hint:'Find checkmate' },
    // lichess.org/training/00FH6
    { id:'p39', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","h8":"bR","b7":"bQ","e7":"bB","f7":"bP","g7":"bK","h6":"bP","a5":"bP","c5":"bP","e5":"bP","f5":"wP","g5":"bP","h5":"bN","a4":"wP","b4":"bP","e4":"wP","g4":"bN","h4":"wP","b3":"wP","d3":"wB","f3":"wN","b2":"wB","c2":"wP","g2":"wP","d1":"wR","e1":"wR","g1":"wQ","h1":"wK"}, solution:{"from":"h5","to":"g3"}, hint:'Find checkmate' },
    // lichess.org/training/00FaB
    { id:'p40', label:'Mate in 1 — Black to move', turn:'b', pieces:{"c8":"bK","f8":"bB","g8":"bN","a7":"bP","b7":"bP","c7":"bP","f7":"wN","g7":"bR","h7":"bP","c6":"bB","e6":"bP","d5":"bQ","g5":"wB","h5":"wQ","c3":"wN","a2":"wP","b2":"wP","f2":"wP","g2":"wP","h2":"wP","a1":"wR","f1":"wR","g1":"wK"}, solution:{"from":"d5","to":"g2"}, hint:'Find checkmate' },
    // lichess.org/training/00G0z
    { id:'p41', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"wQ","f8":"bN","h8":"bK","a7":"bP","d7":"bB","g7":"bP","h7":"bP","d6":"bB","c5":"bP","e4":"wN","f4":"bQ","c3":"wP","d3":"bN","h3":"wP","a2":"wP","b2":"wP","e2":"wB","f2":"wP","g2":"wP","a1":"wR","c1":"wB","f1":"wR","g1":"wK"}, solution:{"from":"f4","to":"h2"}, hint:'Find checkmate' },
    // lichess.org/training/00GoO
    { id:'p42', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","c8":"bB","f8":"bR","g8":"bK","a7":"bP","b7":"bP","c7":"bB","c6":"bP","h6":"bP","c5":"wP","d5":"bP","e5":"bQ","f5":"bP","g5":"bP","b4":"wP","c3":"wN","d3":"wB","e3":"wP","a2":"wP","f2":"wP","g2":"wP","h2":"wP","c1":"wR","d1":"wQ","f1":"wR","g1":"wK"}, solution:{"from":"e5","to":"h2"}, hint:'Find checkmate' },
    // lichess.org/training/00H9n
    { id:'p43', label:'Mate in 1 — Black to move', turn:'b', pieces:{"h8":"bK","g7":"bP","e5":"bP","a4":"wP","b4":"bP","d4":"wQ","b3":"wP","f3":"bB","h3":"bQ","g2":"wP","f1":"wR","g1":"wK"}, solution:{"from":"h3","to":"g2"}, hint:'Find checkmate' },
    // lichess.org/training/00HHN
    { id:'p44', label:'Mate in 1 — Black to move', turn:'b', pieces:{"e8":"bR","h8":"bK","a7":"bP","f7":"wR","h7":"bP","b6":"bP","c5":"bP","c4":"wP","b3":"wP","g3":"wR","a2":"bR","g2":"wP","h2":"wP","c1":"wK"}, solution:{"from":"e8","to":"e1"}, hint:'Find checkmate' },
    // lichess.org/training/00HPz
    { id:'p45', label:'Mate in 1 — Black to move', turn:'b', pieces:{"g8":"bR","h7":"bP","c6":"bP","d6":"bK","f6":"bP","a5":"wP","d5":"bP","a4":"wP","d4":"wK","e4":"bB","f4":"wP","c3":"wN","e3":"wP","f2":"wR","h2":"wP"}, solution:{"from":"c6","to":"c5"}, hint:'Find checkmate' },
    // lichess.org/training/00Hk4
    { id:'p46', label:'Mate in 1 — Black to move', turn:'b', pieces:{"f8":"bR","g8":"bK","a7":"bP","f7":"bP","g7":"bP","h7":"bP","e6":"bP","b5":"wQ","b4":"wP","d4":"wB","e4":"wN","g4":"bB","a2":"wP","b2":"bQ","f2":"wP","g2":"wP","h2":"wP","c1":"wR","e1":"wK","f1":"wB","h1":"wR"}, solution:{"from":"b2","to":"c1"}, hint:'Find checkmate' },
    // lichess.org/training/00HnR
    { id:'p47', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bQ","g8":"bK","h8":"bR","a7":"bP","f7":"bP","e6":"bB","g6":"bP","e5":"wB","h5":"bP","f4":"bN","c3":"wP","a2":"wP","c2":"wQ","f2":"wP","g2":"wP","h2":"wP","d1":"wR","f1":"wR","g1":"wK"}, solution:{"from":"a8","to":"g2"}, hint:'Find checkmate' },
    // lichess.org/training/00Hut
    { id:'p48', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","f8":"bR","g8":"bK","e7":"bP","g7":"bB","h7":"bP","d6":"bP","g6":"bP","a5":"bQ","c5":"bP","d5":"wP","f5":"wP","e4":"wQ","f4":"wP","e3":"wB","b2":"bP","c2":"wK","h2":"wP","b1":"wB","d1":"wR","h1":"wR"}, solution:{"from":"a5","to":"c3"}, hint:'Find checkmate' },
    // lichess.org/training/00IPp
    { id:'p49', label:'Mate in 1 — Black to move', turn:'b', pieces:{"e8":"wQ","g7":"bP","h7":"bK","a6":"bP","e6":"bP","h6":"bP","f5":"wP","b4":"bP","d4":"wP","e3":"bQ","h3":"wP","c2":"wB","e2":"bN","h2":"wB","h1":"wK"}, solution:{"from":"e3","to":"f3"}, hint:'Find checkmate' },
    // lichess.org/training/00KYE
    { id:'p50', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","c8":"bB","f8":"bK","h8":"bR","a7":"bP","b7":"bP","g7":"bP","c6":"bP","d6":"bQ","g6":"bP","d5":"bP","d4":"wQ","b3":"wN","a2":"wP","b2":"wP","c2":"wP","f2":"wP","g2":"wP","h2":"wP","a1":"wR","f1":"wR","g1":"wK"}, solution:{"from":"d6","to":"h2"}, hint:'Find checkmate' },
    // lichess.org/training/00LUZ
    { id:'p51', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","b8":"bN","c8":"bB","e8":"bK","g8":"bN","h8":"bR","b7":"bP","c7":"bP","d7":"bP","f7":"bP","g7":"bP","h7":"bP","a5":"bP","c5":"bB","d5":"wP","e5":"bP","e4":"wP","h4":"bQ","c3":"wP","d3":"wB","f3":"wN","a2":"wP","b2":"wP","f2":"wP","g2":"wP","h2":"wP","a1":"wR","b1":"wN","c1":"wB","d1":"wQ","e1":"wK","h1":"wR"}, solution:{"from":"h4","to":"f2"}, hint:'Find checkmate' },
    // lichess.org/training/00LWX
    { id:'p52', label:'Mate in 1 — Black to move', turn:'b', pieces:{"c8":"bR","h8":"bK","f7":"bP","e6":"bP","f6":"wN","g6":"bP","g5":"wP","h5":"bP","a4":"bQ","b4":"wQ","h4":"wP","h3":"bR","c2":"wP","b1":"wR","c1":"wK","d1":"wN"}, solution:{"from":"c8","to":"c2"}, hint:'Find checkmate' },
    // lichess.org/training/00O2z
    { id:'p53', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","h8":"bR","c7":"bP","d7":"bK","f7":"bP","g7":"bP","h7":"bP","a6":"bP","c6":"bN","d6":"bP","b5":"bP","c5":"bB","d5":"wB","e5":"bP","f5":"wN","h5":"bQ","e4":"wP","g4":"bB","f3":"wN","g3":"wK","a2":"wP","b2":"wP","c2":"wP","d2":"wP","f2":"wP","g2":"wR","a1":"wR","c1":"wB","d1":"wQ"}, solution:{"from":"h5","to":"h3"}, hint:'Find checkmate' },
    // lichess.org/training/00QBx
    { id:'p54', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","b8":"bN","d8":"bQ","e8":"bK","h8":"bR","a7":"bP","b7":"bB","f7":"bP","g7":"bP","h7":"bP","f6":"bN","c5":"bB","c3":"wN","e3":"bP","g3":"wP","a2":"wP","b2":"wP","d2":"wP","e2":"wP","f2":"wP","g2":"wN","h2":"wP","a1":"wR","c1":"wB","d1":"wQ","e1":"wK","f1":"wB","h1":"wR"}, solution:{"from":"e3","to":"f2"}, hint:'Find checkmate' },
    // lichess.org/training/00QOp
    { id:'p55', label:'Mate in 1 — Black to move', turn:'b', pieces:{"e8":"bR","a7":"bP","b7":"bP","e7":"bR","f7":"bK","g7":"bP","c6":"bP","a5":"wP","d5":"bP","g5":"bP","h5":"wP","a4":"wR","f4":"bB","g4":"wP","c3":"wN","d3":"wQ","b2":"wP","c2":"wP","f2":"wP","d1":"wK","e1":"wR"}, solution:{"from":"e7","to":"e1"}, hint:'Find checkmate' },
    // lichess.org/training/00QY3
    { id:'p56', label:'Mate in 1 — Black to move', turn:'b', pieces:{"c8":"bK","g8":"bR","a7":"bP","b7":"bP","h7":"bP","e6":"bP","c5":"bP","f5":"bP","c4":"wP","a3":"wP","f3":"wP","h3":"bQ","b2":"wP","c2":"wQ","e2":"wR","h2":"wR","h1":"wK"}, solution:{"from":"h3","to":"f1"}, hint:'Find checkmate' },
    // lichess.org/training/00QZV
    { id:'p57', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","c8":"bB","d8":"bK","a7":"bP","b7":"bP","c7":"bP","d7":"bP","h7":"bP","c6":"bN","c5":"bB","e5":"bP","f5":"bR","g5":"wN","b3":"wB","a2":"wP","b2":"wP","c2":"wP","d2":"wP","g2":"wP","h2":"wP","a1":"wR","b1":"wN","c1":"wB","f1":"wR","h1":"wK"}, solution:{"from":"f5","to":"f1"}, hint:'Find checkmate' },
    // lichess.org/training/00Qqp
    { id:'p58', label:'Mate in 1 — Black to move', turn:'b', pieces:{"g8":"bK","e7":"wP","a6":"bP","g6":"bP","c3":"wP","g3":"wP","h3":"wP","b2":"bR","h2":"bR","a1":"wR","e1":"wR","f1":"wK"}, solution:{"from":"h2","to":"h1"}, hint:'Find checkmate' },
    // lichess.org/training/00R0m
    { id:'p59', label:'Mate in 1 — Black to move', turn:'b', pieces:{"e7":"bK","h7":"bP","a6":"wQ","c6":"bP","e6":"bP","a5":"bP","d5":"bP","e5":"wP","g5":"bR","a4":"bQ","a3":"wP","f3":"wK","h3":"wP","b2":"wP","f2":"wP","c1":"wR","f1":"wR"}, solution:{"from":"a4","to":"e4"}, hint:'Find checkmate' },
    // lichess.org/training/00RoG
    { id:'p60', label:'Mate in 1 — Black to move', turn:'b', pieces:{"c8":"bK","d8":"bR","g8":"bN","h8":"bR","a7":"bP","b7":"bP","e7":"bN","f7":"bP","g7":"bP","h7":"bP","c6":"bP","d6":"bP","c5":"bB","f5":"wP","g5":"wP","e4":"wN","f4":"wP","g4":"bQ","d3":"wB","f3":"wR","h3":"wP","a2":"wP","b2":"wP","c2":"wP","a1":"wR","d1":"wQ","e1":"wB","h1":"wK"}, solution:{"from":"g4","to":"g1"}, hint:'Find checkmate' },
    // lichess.org/training/00SOy
    { id:'p61', label:'Mate in 1 — Black to move', turn:'b', pieces:{"g8":"bK","g7":"bB","a6":"bP","c6":"wQ","e6":"bP","h6":"bP","b5":"bP","c5":"wN","h5":"bR","d4":"wP","h4":"bQ","c3":"wP","a2":"wP","f2":"wP","g2":"wP","b1":"wR","e1":"wR","g1":"wK"}, solution:{"from":"h4","to":"h1"}, hint:'Find checkmate' },
    // lichess.org/training/00V59
    { id:'p62', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","b8":"bN","c8":"bB","f8":"bR","g8":"bK","f7":"bP","g7":"bP","h7":"bP","a6":"bP","d6":"bQ","b5":"bP","d5":"wP","c4":"bP","d4":"wN","g4":"bN","c3":"wN","a2":"wP","b2":"wP","e2":"wB","f2":"wP","g2":"wP","h2":"wP","a1":"wR","d1":"wQ","f1":"wR","g1":"wK"}, solution:{"from":"d6","to":"h2"}, hint:'Find checkmate' },
    // lichess.org/training/00VIe
    { id:'p63', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a5":"wP","h5":"bP","c3":"wR","d3":"bN","e3":"bK","a2":"bR","d1":"wK","e1":"wN"}, solution:{"from":"a2","to":"d2"}, hint:'Find checkmate' },
    // lichess.org/training/00ViT
    { id:'p64', label:'Mate in 1 — Black to move', turn:'b', pieces:{"g8":"bK","f7":"bP","g7":"bP","e6":"bP","f6":"wP","h6":"bP","b5":"bP","d5":"bB","e5":"wP","b4":"wP","d4":"wP","f4":"wK","g4":"wP","b3":"bR","d2":"wB","f2":"wR","h2":"wP"}, solution:{"from":"g7","to":"g5"}, hint:'Find checkmate' },
    // lichess.org/training/00Vv9
    { id:'p65', label:'Mate in 1 — Black to move', turn:'b', pieces:{"f8":"bR","h8":"bK","a7":"bP","b7":"bP","g7":"bP","h7":"bP","f6":"bR","d5":"wN","e5":"wQ","d4":"wP","f3":"bP","g3":"wN","a2":"wP","b2":"bQ","h2":"wP","c1":"wR","f1":"wR","h1":"wK"}, solution:{"from":"b2","to":"g2"}, hint:'Find checkmate' },
    // lichess.org/training/00WAp
    { id:'p66', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","g8":"bK","e7":"bP","h7":"bP","a6":"bP","g6":"bP","b5":"bP","d5":"bB","g5":"wQ","c4":"bP","a3":"wP","f3":"bQ","b2":"wP","f2":"wP","a1":"wR","d1":"wR","g1":"wK","h1":"wN"}, solution:{"from":"f3","to":"h1"}, hint:'Find checkmate' },
    // lichess.org/training/00X5a
    { id:'p67', label:'Mate in 1 — Black to move', turn:'b', pieces:{"d8":"wN","h8":"bK","a7":"bP","b7":"wQ","h7":"bP","e6":"bP","g6":"bP","d5":"bQ","c3":"bB","e3":"wP","g3":"wP","h3":"wK","a2":"wP","e2":"wR","f2":"wP","h2":"wP","e1":"bN"}, solution:{"from":"d5","to":"h5"}, hint:'Find checkmate' },
    // lichess.org/training/00X66
    { id:'p68', label:'Mate in 1 — Black to move', turn:'b', pieces:{"e8":"bR","g8":"bK","g7":"bP","h7":"bP","b6":"wR","f6":"bP","a5":"wP","b4":"wP","d4":"bP","f4":"wB","c3":"bB","h3":"wP","f2":"wP","g2":"wP","f1":"wK"}, solution:{"from":"e8","to":"e1"}, hint:'Find checkmate' },
    // lichess.org/training/00Xiu
    { id:'p69', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a7":"bP","b7":"bP","f7":"wQ","h7":"bP","b6":"bN","e6":"wB","g6":"bP","h6":"bK","f4":"wP","g4":"wP","h4":"bQ","h3":"wP","a2":"wP","b2":"wP","c2":"wP","c1":"wK"}, solution:{"from":"h4","to":"e1"}, hint:'Find checkmate' },
    // lichess.org/training/00Xn1
    { id:'p70', label:'Mate in 1 — Black to move', turn:'b', pieces:{"d8":"bR","g8":"bK","f7":"bP","g7":"bP","c6":"bP","g6":"bN","h6":"bP","c5":"bB","a4":"wN","b4":"bP","e4":"wP","g4":"bB","b3":"wB","g3":"wB","b2":"wP","c2":"wP","g2":"wP","h2":"wP","e1":"wK","f1":"wR"}, solution:{"from":"d8","to":"d1"}, hint:'Find checkmate' },
    // lichess.org/training/00Yfi
    { id:'p71', label:'Mate in 1 — Black to move', turn:'b', pieces:{"b8":"wQ","f7":"bP","h7":"bK","e6":"bB","g6":"bP","h6":"bP","f5":"wB","d4":"bP","g4":"wK","h4":"wP","g3":"wP","a2":"wP","e2":"wR","f1":"bR"}, solution:{"from":"e6","to":"f5"}, hint:'Find checkmate' },
    // lichess.org/training/00YqR
    { id:'p72', label:'Mate in 1 — Black to move', turn:'b', pieces:{"f8":"bK","a7":"bP","c7":"bP","h7":"wQ","b6":"bP","c6":"wP","d6":"bP","e6":"wB","f6":"bP","c5":"bQ","d5":"wP","h5":"bB","c3":"wP","a2":"wP","h2":"wP","h1":"wK"}, solution:{"from":"h5","to":"f3"}, hint:'Find checkmate' },
    // lichess.org/training/00ad3
    { id:'p73', label:'Mate in 1 — Black to move', turn:'b', pieces:{"c8":"bK","d8":"bR","h8":"bR","a7":"bP","b7":"bP","c7":"bP","f7":"bP","c6":"bN","d6":"bB","f6":"bN","h6":"bP","e5":"bQ","g5":"bP","a4":"wQ","c4":"wN","c3":"wP","e3":"wB","a2":"wP","b2":"wP","e2":"wN","f2":"wP","g2":"wP","h2":"wP","a1":"wR","f1":"wR","g1":"wK"}, solution:{"from":"e5","to":"h2"}, hint:'Find checkmate' },
    // lichess.org/training/00b58
    { id:'p74', label:'Mate in 1 — Black to move', turn:'b', pieces:{"e8":"bK","h8":"bR","b7":"bB","c7":"bQ","f7":"bP","g7":"bB","e6":"bP","b5":"bP","g5":"bP","c4":"bP","d4":"wN","a3":"wR","b2":"wP","e2":"wB","f2":"wP","g2":"wP","h2":"wP","d1":"wQ","f1":"wR","g1":"wK"}, solution:{"from":"c7","to":"h2"}, hint:'Find checkmate' },
    // lichess.org/training/00bJi
    { id:'p75', label:'Mate in 1 — Black to move', turn:'b', pieces:{"h8":"bK","b7":"bP","e7":"wR","a6":"bP","e6":"wN","d5":"bP","c4":"bN","c3":"wP","d3":"wK","a2":"wP","b2":"wP","h2":"bR"}, solution:{"from":"h2","to":"d2"}, hint:'Find checkmate' },
    // lichess.org/training/00bSy
    { id:'p76', label:'Mate in 1 — Black to move', turn:'b', pieces:{"b8":"bK","c8":"bR","e8":"bR","b7":"bP","c7":"bP","h7":"bP","a6":"bP","d6":"bB","g6":"bP","d5":"wN","f5":"bP","a4":"wP","d3":"wP","f3":"wQ","h3":"wP","c2":"wR","f2":"wP","g2":"wP","e1":"wR","g1":"wK"}, solution:{"from":"e8","to":"e1"}, hint:'Find checkmate' },
    // lichess.org/training/00beo
    { id:'p77', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","f8":"bR","g8":"bK","a7":"bP","b7":"bB","d7":"wQ","g7":"bP","h7":"bP","b6":"bP","e6":"bP","g6":"bQ","c5":"bB","c4":"wP","a3":"wP","c3":"wN","e3":"wB","h3":"wP","b2":"wP","e2":"wB","f2":"wP","g2":"wP","a1":"wR","f1":"wR","g1":"wK"}, solution:{"from":"g6","to":"g2"}, hint:'Find checkmate' },
    // lichess.org/training/00bzC
    { id:'p78', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","c8":"bR","g8":"bK","c7":"bP","g7":"bP","a6":"bP","d6":"bP","h6":"bP","a5":"wP","b5":"bP","d5":"wP","e5":"bP","e4":"wP","d3":"wP","f3":"bP","h3":"bQ","a2":"wR","c2":"wQ","f2":"wP","h2":"wN","e1":"wR","h1":"wK"}, solution:{"from":"h3","to":"g2"}, hint:'Find checkmate' },
    // lichess.org/training/00c0D
    { id:'p79', label:'Mate in 1 — Black to move', turn:'b', pieces:{"a8":"bR","b8":"bN","c8":"bB","e8":"bK","h8":"bR","a7":"bP","b7":"bP","c7":"wB","f7":"bP","d5":"bP","g5":"bP","d4":"wQ","g4":"bN","h4":"bP","c3":"wN","f3":"wN","h3":"wK","a2":"wP","b2":"wP","c2":"wP","e2":"wB","g2":"wP","h2":"wP","a1":"wR","h1":"wR"}, solution:{"from":"g4","to":"f2"}, hint:'Find checkmate' },
    // lichess.org/training/00cZ4
    { id:'p80', label:'Mate in 1 — Black to move', turn:'b', pieces:{"c7":"wR","g6":"bP","h6":"bK","a5":"bP","e5":"bP","h5":"bP","e4":"wN","f4":"bQ","f3":"bN","h3":"wP","a2":"wP","f2":"wR","g2":"wP","h1":"wK"}, solution:{"from":"f4","to":"h2"}, hint:'Find checkmate' }
];





// Note: hints only shown after a wrong attempt, not on initial load

var _CHESS_FILES = ['a','b','c','d','e','f','g','h'];
var _CHESS_RANKS = ['8','7','6','5','4','3','2','1']; // top-to-bottom display

var _CHESS_GLYPHS = {
    wK:'\u2654', wQ:'\u2655', wR:'\u2656', wB:'\u2657', wN:'\u2658', wP:'\u2659',
    bK:'\u265a', bQ:'\u265b', bR:'\u265c', bB:'\u265d', bN:'\u265e', bP:'\u265f'
};

function _chessDailyPuzzle(actionId) {
    var seed = _flexDailySeed(actionId + '_chess');
    return CHESS_PUZZLES[Math.abs(seed) % CHESS_PUZZLES.length];
}

function _chessRender(id) {
    var wrap = document.getElementById('chess-wrap-' + id);
    if (!wrap) return;
    var puzzle = _chessDailyPuzzle(id);
    var selected = wrap._chessSelected || null;
    var pieces = Object.assign({}, puzzle.pieces);
    if (wrap._chessPieces) pieces = wrap._chessPieces;

    var html = '<table style="border-collapse:collapse;margin:0 auto;user-select:none;"><tbody>';
    _CHESS_RANKS.forEach(function(rank) {
        html += '<tr>';
        _CHESS_FILES.forEach(function(file) {
            var sq = file + rank;
            var fi = _CHESS_FILES.indexOf(file);
            var ri = _CHESS_RANKS.indexOf(rank);
            var light = (fi + ri) % 2 === 0;
            var bg = selected === sq ? '#f7931a' :
                     light ? '#f0d9b5' : '#b58863';
            var piece = pieces[sq];
            var glyph = piece ? _CHESS_GLYPHS[piece] : '';
            var color = piece ? (piece[0]==='w' ? '#fff' : '#000') : 'transparent';
            var shadow = piece && piece[0]==='w' ? 'text-shadow:0 1px 2px rgba(0,0,0,0.8);' : '';
            html += '<td data-sq="' + sq + '" style="width:34px;height:34px;text-align:center;vertical-align:middle;background:' + bg + ';font-size:1.4rem;line-height:34px;cursor:pointer;-webkit-tap-highlight-color:transparent;"><span style="color:' + color + ';' + shadow + 'pointer-events:none;">' + glyph + '</span></td>';
        });
        html += '</tr>';
    });
    html += '</tbody></table>';
    var board = document.getElementById('chess-board-' + id);
    if (board) board.innerHTML = html;

    // Re-wire click/drag
    _chessWireBoard(id);
}

function _chessWireBoard(id) {
    var board = document.getElementById('chess-board-' + id);
    var wrap = document.getElementById('chess-wrap-' + id);
    if (!board || !wrap) return;
    var puzzle = _chessDailyPuzzle(id);
    if (!wrap._chessPieces) wrap._chessPieces = Object.assign({}, puzzle.pieces);

    var dragFrom = null, dragEl = null, dragGhost = null;

    function getTd(e) {
        var el = e.target;
        while (el && el.tagName !== 'TD') el = el.parentElement;
        return el;
    }
    function sqOf(td) { return td ? td.getAttribute('data-sq') : null; }

    function startDrag(sq, clientX, clientY) {
        var piece = wrap._chessPieces[sq];
        var movingColor = puzzle.turn || 'w';
        if (!piece || piece[0] !== movingColor) return; // only moving side's pieces
        dragFrom = sq;
        wrap._chessSelected = sq;
        // Ghost: large chess piece that follows the cursor/finger
        dragGhost = document.createElement('div');
        dragGhost.style.cssText = [
            'position:fixed',
            'z-index:99999',
            'pointer-events:none',
            'width:52px',
            'height:52px',
            'border-radius:50%',
            'background:radial-gradient(circle at 38% 35%, #fff 0%, #e8e0cc 70%, #c8b89a 100%)',
            'box-shadow:0 6px 20px rgba(0,0,0,0.55),0 2px 6px rgba(0,0,0,0.4)',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'font-size:2rem',
            'transform:translate(-50%,-50%) scale(1.15)',
            'transition:none',
            'user-select:none',
            '-webkit-user-select:none'
        ].join(';');
        dragGhost.textContent = _CHESS_GLYPHS[piece];
        document.body.appendChild(dragGhost);
        moveDragGhost(clientX, clientY);
        // Dim the origin cell without re-rendering the whole board
        var originTd = board.querySelector('[data-sq="' + sq + '"]');
        if (originTd) {
            originTd.style.opacity = '0.35';
            originTd.style.background = '#f7931a';
        }
    }
    var _lastHoverSq = null;
    function moveDragGhost(x, y) {
        if (!dragGhost) return;
        dragGhost.style.left = x + 'px';
        dragGhost.style.top  = y + 'px';
        // Highlight the square currently under the ghost
        var el = document.elementFromPoint(x, y);
        var td = el; while (td && td.tagName !== 'TD') td = td.parentElement;
        var hoverSq = td ? td.getAttribute('data-sq') : null;
        if (hoverSq !== _lastHoverSq) {
            // Un-highlight previous hover square
            if (_lastHoverSq && _lastHoverSq !== dragFrom) {
                var prevTd = board.querySelector('[data-sq="' + _lastHoverSq + '"]');
                if (prevTd) { prevTd.style.background = ''; prevTd.style.outline = ''; }
            }
            // Highlight new hover square
            if (hoverSq && hoverSq !== dragFrom) {
                var newTd = board.querySelector('[data-sq="' + hoverSq + '"]');
                if (newTd) {
                    newTd.style.background = 'rgba(247,147,26,0.55)';
                    newTd.style.outline = '2px inset rgba(247,147,26,0.9)';
                }
            }
            _lastHoverSq = hoverSq;
        }
    }
    function endDrag(toSq) {
        if (dragGhost) { dragGhost.remove(); dragGhost = null; }
        // Restore hover-highlighted square
        if (_lastHoverSq) {
            var hTd = board.querySelector('[data-sq="' + _lastHoverSq + '"]');
            if (hTd) { hTd.style.background = ''; hTd.style.outline = ''; }
            _lastHoverSq = null;
        }
        // Restore origin cell before any re-render
        if (dragFrom) {
            var originTd = board.querySelector('[data-sq="' + dragFrom + '"]');
            if (originTd) { originTd.style.opacity = ''; }
        }
        if (!dragFrom || !toSq || dragFrom === toSq) {
            wrap._chessSelected = null;
            dragFrom = null;
            _chessRender(id);
            return;
        }
        var fromSq = dragFrom;
        dragFrom = null;
        wrap._chessSelected = null;
        _chessTryMove(id, fromSq, toSq);
    }

    // Mouse
    board.addEventListener('mousedown', function(e) {
        var td = getTd(e); if (!td) return;
        var sq = sqOf(td);
        if (dragFrom === null) {
            startDrag(sq, e.clientX, e.clientY);
        }
    });
    window.addEventListener('mousemove', function(e) { moveDragGhost(e.clientX, e.clientY); });
    window.addEventListener('mouseup', function(e) {
        if (dragFrom === null) return;
        var el = document.elementFromPoint(e.clientX, e.clientY);
        var td = el;
        while (td && td.tagName !== 'TD') td = td.parentElement;
        endDrag(sqOf(td));
    }, {once: false});

    // Touch
    board.addEventListener('touchstart', function(e) {
        var t = e.touches[0];
        var td = getTd({target: document.elementFromPoint(t.clientX, t.clientY)});
        if (!td) return;
        var sq = sqOf(td);
        startDrag(sq, t.clientX, t.clientY);
        e.preventDefault();
    }, {passive: false});
    board.addEventListener('touchmove', function(e) {
        var t = e.touches[0];
        moveDragGhost(t.clientX, t.clientY);
        e.preventDefault();
    }, {passive: false});
    board.addEventListener('touchend', function(e) {
        var t = e.changedTouches[0];
        var el = document.elementFromPoint(t.clientX, t.clientY);
        var td = el;
        while (td && td.tagName !== 'TD') td = td.parentElement;
        endDrag(sqOf(td));
        e.preventDefault();
    }, {passive: false});
}

function _chessTryMove(id, from, to) {
    var wrap = document.getElementById('chess-wrap-' + id);
    if (!wrap) return;
    var puzzle = _chessDailyPuzzle(id);
    var msgEl = document.getElementById('chess-msg-' + id);
    var isCorrect = (from === puzzle.solution.from && to === puzzle.solution.to);
    if (isCorrect) {
        // Apply move visually
        wrap._chessPieces[to] = wrap._chessPieces[from];
        delete wrap._chessPieces[from];
        _chessRender(id);
        var winGlyph = (puzzle.turn === 'b') ? '\u265a' : '\u2654';
        if (msgEl) { msgEl.textContent = winGlyph + ' Checkmate! +5 XP'; msgEl.style.color = '#22c55e'; }
        setTimeout(function() { _flexMarkDone(id, function() { _flexCardSuccess(id); }); }, 600);
    } else {
        // Wrong move — shake and reset to original position
        if (msgEl) { msgEl.textContent = 'Not quite — try again!'; msgEl.style.color = '#ef4444'; }
        wrap._chessPieces = Object.assign({}, puzzle.pieces); // reset
        var board = document.getElementById('chess-board-' + id);
        if (board) { board.style.animation = 'flexShake 0.4s'; setTimeout(function() { board.style.animation = ''; }, 400); }
        setTimeout(function() {
            _chessRender(id);
            if (msgEl) { msgEl.textContent = puzzle.hint ? '\ud83d\udca1 Hint: ' + puzzle.hint : ''; msgEl.style.color = 'var(--text-muted)'; }
        }, 450);
    }
}

function _chessStart(id) {
    var wrap = document.getElementById('chess-wrap-' + id);
    if (!wrap) return;
    var puzzle = _chessDailyPuzzle(id);
    wrap._chessPieces = Object.assign({}, puzzle.pieces);
    wrap._chessSelected = null;
    _chessRender(id);
    var msgEl = document.getElementById('chess-msg-' + id);
    // hint shown only after wrong move, not on load
}

function _flexWireInteractions() {
    FLEX_ACTIONS.forEach(function(action) {
        if (_flexDoneToday(action.id)) return;

        // ── BLACKJACK ──
        if (action.type === 'blackjack') {
            _bjStart(action.id);
        }

        // ── CHESS ──
        if (action.type === 'chess') {
            _chessStart(action.id);
        }

        // ── PAINT BOX ──
        if (action.type === 'paintbox') {
            window._flexPaintBoxWire(action.id);
        }

        // ── HOLD ──
        if (action.type === 'hold') {
            var ring = document.getElementById('hold-ring-' + action.id);
            if (!ring) return;
            var arc = document.getElementById('hold-arc-' + action.id);
            var r = 24, circ = 2*Math.PI*r;
            var holdMs = parseInt(ring.getAttribute('data-ms')) || action.holdMs || 2000;
            var heldFrom = null, raf = null;
            function startHold(e) {
                e.preventDefault();
                if (heldFrom) return;
                heldFrom = Date.now();
                (function tick() {
                    var elapsed = Date.now() - heldFrom;
                    var pct = Math.min(1, elapsed / holdMs);
                    if (arc) arc.style.strokeDashoffset = circ * (1 - pct);
                    if (pct < 1) { raf = requestAnimationFrame(tick); }
                    else { endHold(true); }
                })();
            }
            function endHold(success) {
                if (!heldFrom && !success) return;
                heldFrom = null;
                cancelAnimationFrame(raf);
                if (!success) { if (arc) arc.style.strokeDashoffset = circ; }
                else { _flexMarkDone(action.id, function() { _flexCardSuccess(action.id); }); }
            }
            ring.addEventListener('mousedown', startHold);
            ring.addEventListener('touchstart', startHold, {passive:false});
            window.addEventListener('mouseup', function(){ endHold(false); });
            ring.addEventListener('touchend', function(){ endHold(false); });
            ring.addEventListener('touchcancel', function(){ endHold(false); });
        }

        // ── DOUBLETAP / TRIPLCLICK ──
        if (action.type === 'doubletap' || action.type === 'triplclick') {
            var btn = document.getElementById('dtap-' + action.id);
            if (!btn) return;
            var target = parseInt(btn.getAttribute('data-target') || '2');
            btn.addEventListener('click', function() {
                var now = Date.now();
                var taps = parseInt(btn.getAttribute('data-taps') || '0');
                var last = parseInt(btn.getAttribute('data-last') || '0');
                var hint = document.getElementById('dtap-hint-' + action.id);
                if (now - last < 500) {
                    taps++;
                    btn.setAttribute('data-taps', taps);
                    var remaining = target - taps;
                    if (remaining <= 0) {
                        if (hint) hint.textContent = '\uD83C\uDF89 Done!';
                        setTimeout(function(){ _flexMarkDone(action.id, function(){ _flexCardSuccess(action.id); }); }, 150);
                    } else {
                        if (hint) hint.textContent = remaining + ' more tap' + (remaining>1?'s':'') + '!';
                    }
                } else {
                    btn.setAttribute('data-taps', '1');
                    if (hint) hint.textContent = (target - 1) + ' more tap' + (target-1>1?'s':'') + ' — fast!';
                }
                btn.setAttribute('data-last', now);
            });
        }

        // ── SLIDER (desktop + touch, no escape) ──
        if (action.type === 'slider') {
            var track = document.getElementById('slider-track-' + action.id);
            var thumb = document.getElementById('slider-thumb-' + action.id);
            var fill  = document.getElementById('slider-fill-' + action.id);
            if (!track || !thumb) return;
            var isRight = (track.getAttribute('data-dir') || 'right') === 'right';
            var dragging = false;
            var trackRect = null;

            function getX(e) { return e.touches ? e.touches[0].clientX : (e.changedTouches ? e.changedTouches[0].clientX : e.clientX); }

            function sliderDown(e) {
                e.preventDefault();
                dragging = true;
                trackRect = track.getBoundingClientRect();
                thumb.style.transition = 'none';
                fill.style.transition = 'none';
                sliderMove(e);
            }
            function sliderMove(e) {
                if (!dragging) return;
                var x = getX(e) - trackRect.left;
                var thumbW = 44;
                var trackW = trackRect.width;
                var clampedX = Math.max(thumbW/2, Math.min(x, trackW - thumbW/2));
                var pct = (clampedX - thumbW/2) / (trackW - thumbW);
                // position thumb
                thumb.style[isRight ? 'left' : 'right'] = (clampedX - thumbW/2) + 'px';
                fill.style.width = Math.round(pct * 100) + '%';
                if (pct >= 0.88) { sliderUp(e, true); }
            }
            function sliderUp(e, forceSuccess) {
                if (!dragging) return;
                dragging = false;
                var x = getX(e) - (trackRect ? trackRect.left : 0);
                var trackW = trackRect ? trackRect.width : 200;
                var pct = (x - 22) / (trackW - 44);
                var success = forceSuccess || pct >= 0.88;
                thumb.style.transition = 'left 0.3s, right 0.3s';
                fill.style.transition = 'width 0.3s';
                if (success) {
                    thumb.style[isRight ? 'left' : 'right'] = (trackW - 40) + 'px';
                    fill.style.width = '100%';
                    setTimeout(function(){ _flexMarkDone(action.id, function(){ _flexCardSuccess(action.id); }); }, 250);
                } else {
                    thumb.style[isRight ? 'left' : 'right'] = '4px';
                    fill.style.width = '0%';
                }
                trackRect = null;
            }
            track.addEventListener('mousedown', sliderDown);
            track.addEventListener('touchstart', sliderDown, {passive:false});
            window.addEventListener('mousemove', function(e){ if(dragging) sliderMove(e); });
            window.addEventListener('mouseup',   function(e){ if(dragging) sliderUp(e, false); });
            window.addEventListener('touchmove', function(e){ if(dragging) sliderMove(e); }, {passive:false});
            window.addEventListener('touchend',  function(e){ if(dragging) sliderUp(e, false); });
        }

        // ── MASH ──
        if (action.type === 'mash') {
            var mashBtn = document.getElementById('mash-btn-' + action.id);
            var mashBar = document.getElementById('mash-bar-' + action.id);
            var mashLbl = document.getElementById('mash-label-' + action.id);
            if (!mashBtn) return;
            var mashTarget = parseInt(mashBtn.getAttribute('data-target') || '8');
            mashBtn.addEventListener('click', function() {
                var count = parseInt(mashBtn.getAttribute('data-count') || '0') + 1;
                mashBtn.setAttribute('data-count', count);
                if (mashBar) mashBar.style.width = Math.min(100, Math.round(count/mashTarget*100)) + '%';
                if (mashLbl) mashLbl.textContent = count + ' / ' + mashTarget;
                mashBtn.style.transform = 'scale(0.93)';
                setTimeout(function(){ mashBtn.style.transform = ''; }, 80);
                if (count >= mashTarget) {
                    setTimeout(function(){ _flexMarkDone(action.id, function(){ _flexCardSuccess(action.id); }); }, 150);
                }
            });
        }

        // ── MAZE ──
        if (action.type === 'maze') {
            var mazeSvg = document.getElementById('maze-svg-' + action.id);
            var mazeDot = document.getElementById('maze-dot-' + action.id);
            if (!mazeSvg || !mazeDot) return;
            // Z-corridor bounds (matching SVG render above)
            var corridors = [{x:0,y:0,w:180,h:34},{x:144,y:0,w:36,h:120},{x:0,y:85,w:180,h:35}];
            var exitZone = {x:144,y:85,w:36,h:35};
            var mDrag = false, mRect = null, mCx = 16, mCy = 17;
            function mInCorridor(x,y){ return corridors.some(function(r){ return x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h; }); }
            function mInExit(x,y){ return x>=exitZone.x&&x<=exitZone.x+exitZone.w&&y>=exitZone.y&&y<=exitZone.y+exitZone.h; }
            function mXY(e){ var t=e.touches||e.changedTouches; var c=t?t[0]:e; return {x:c.clientX-mRect.left,y:c.clientY-mRect.top}; }
            function mScale(){ return 180/mRect.width; } // SVG viewBox vs rendered size
            mazeDot.addEventListener('mousedown',function(e){ e.preventDefault(); mDrag=true; mRect=mazeSvg.getBoundingClientRect(); });
            mazeDot.addEventListener('touchstart',function(e){ e.preventDefault(); mDrag=true; mRect=mazeSvg.getBoundingClientRect(); },{passive:false});
            window.addEventListener('mousemove',function(e){ if(!mDrag)return; var p=mXY(e); var sx=p.x*mScale(),sy=p.y*mScale(); if(mInCorridor(sx,sy)){mCx=sx;mCy=sy;mazeDot.setAttribute('cx',sx);mazeDot.setAttribute('cy',sy);} if(mInExit(mCx,mCy)){mDrag=false;_flexMarkDone(action.id,function(){_flexCardSuccess(action.id);});} });
            window.addEventListener('mouseup',function(){ mDrag=false; });
            window.addEventListener('touchmove',function(e){ if(!mDrag)return; e.preventDefault(); var p=mXY(e); var sx=p.x*mScale(),sy=p.y*mScale(); if(mInCorridor(sx,sy)){mCx=sx;mCy=sy;mazeDot.setAttribute('cx',sx);mazeDot.setAttribute('cy',sy);} if(mInExit(mCx,mCy)){mDrag=false;_flexMarkDone(action.id,function(){_flexCardSuccess(action.id);});} },{passive:false});
            window.addEventListener('touchend',function(){ mDrag=false; });
        }

        // ── ROTARY ──
        if (action.type === 'rotary') {
            var rotSvg = document.getElementById('rotary-svg-' + action.id);
            var rotKnob = document.getElementById('rotary-knob-' + action.id);
            var rotEmoji = document.getElementById('rotary-emoji-' + action.id);
            if (!rotSvg || !rotKnob) return;
            var ROT_CX = 55, ROT_CY = 55, ROT_R = 46;
            var rDrag = false;
            var tMin = 60, tMax = 180;
            // Always recalc bounding rect on each event for accuracy after scroll/resize
            function rRect(){ return rotSvg.getBoundingClientRect(); }
            function rClientXY(e){
                if (e.touches && e.touches.length) return {x:e.touches[0].clientX,y:e.touches[0].clientY};
                if (e.changedTouches && e.changedTouches.length) return {x:e.changedTouches[0].clientX,y:e.changedTouches[0].clientY};
                if (typeof e.clientX === 'number') return {x:e.clientX,y:e.clientY};
                return null;
            }
            function rAngle(e){
                var pt = rClientXY(e); if(!pt) return 0;
                var r = rRect(); var scale = r.width/110;
                var dx = pt.x - r.left - ROT_CX*scale;
                var dy = pt.y - r.top  - ROT_CY*scale;
                return (Math.atan2(dy,dx)*180/Math.PI+360)%360;
            }
            function rInTarget(a){ return a>=tMin&&a<=tMax; }
            function rMove(e){
                if(!rDrag) return;
                e.preventDefault();
                var a=rAngle(e);
                var kx=ROT_CX+ROT_R*Math.cos(a*Math.PI/180);
                var ky=ROT_CY+ROT_R*Math.sin(a*Math.PI/180);
                rotKnob.setAttribute('cx',kx); rotKnob.setAttribute('cy',ky);
                if(rotEmoji){rotEmoji.setAttribute('x',kx);rotEmoji.setAttribute('y',ky+4);}
                if(rInTarget(a)){rDrag=false;rotKnob.style.filter='drop-shadow(0 0 8px #f7921a)';setTimeout(function(){_flexMarkDone(action.id,function(){_flexCardSuccess(action.id);});},300);}
            }
            function rEnd(){ rDrag=false; }
            // Pointer Events (primary — works on Firefox iOS, Chrome, Safari, desktop)
            if (window.PointerEvent) {
                rotSvg.addEventListener('pointerdown',function(e){ e.preventDefault(); rDrag=true; rotSvg.setPointerCapture(e.pointerId); },{passive:false});
                rotSvg.addEventListener('pointermove',rMove,{passive:false});
                rotSvg.addEventListener('pointerup',rEnd);
                rotSvg.addEventListener('pointercancel',rEnd);
            } else {
                // Touch fallback (older Safari)
                rotSvg.addEventListener('touchstart',function(e){ e.preventDefault(); rDrag=true; },{passive:false});
                window.addEventListener('touchmove',rMove,{passive:false});
                window.addEventListener('touchend',rEnd);
                // Mouse fallback
                rotKnob.addEventListener('mousedown',function(e){ e.preventDefault(); rDrag=true; });
                window.addEventListener('mousemove',rMove);
                window.addEventListener('mouseup',rEnd);
            }
        }

        // ── DRAG ──
        if (action.type === 'drag') {
            var dzone = document.getElementById('drag-zone-' + action.id);
            var dthumb = document.getElementById('drag-thumb-' + action.id);
            var dtarget = document.getElementById('drag-target-' + action.id);
            if (!dzone || !dthumb || !dtarget) return;
            var dDragging = false, dZoneRect = null;
            function dGetXY(e) { var t = e.touches||e.changedTouches; return t ? {x:t[0].clientX,y:t[0].clientY} : {x:e.clientX,y:e.clientY}; }
            function dragStart(e) {
                e.preventDefault();
                dDragging = true;
                dZoneRect = dzone.getBoundingClientRect();
                dthumb.style.transition = 'none';
                dthumb.style.zIndex = '10';
            }
            function dragMove(e) {
                if (!dDragging) return;
                var p = dGetXY(e);
                var nx = p.x - dZoneRect.left - 18;
                var ny = p.y - dZoneRect.top - 18;
                dthumb.style.left = Math.max(0, Math.min(nx, dZoneRect.width-36)) + 'px';
                dthumb.style.top  = Math.max(0, Math.min(ny, dZoneRect.height-36)) + 'px';
            }
            function dragEnd(e) {
                if (!dDragging) return;
                dDragging = false;
                var p = dGetXY(e);
                var tr = dtarget.getBoundingClientRect();
                var hit = p.x >= tr.left-24 && p.x <= tr.right+24 && p.y >= tr.top-24 && p.y <= tr.bottom+24;
                dthumb.style.transition = 'left 0.3s, top 0.3s';
                if (hit) {
                    dthumb.style.left = (tr.left - dZoneRect.left) + 'px';
                    dthumb.style.top  = (tr.top  - dZoneRect.top)  + 'px';
                    setTimeout(function(){ _flexMarkDone(action.id, function(){ _flexCardSuccess(action.id); }); }, 250);
                } else {
                    dthumb.style.left = '0px';
                    dthumb.style.top  = '0px';
                }
                dZoneRect = null;
            }
            dthumb.addEventListener('mousedown', dragStart);
            dthumb.addEventListener('touchstart', dragStart, {passive:false});
            window.addEventListener('mousemove', function(e){ if(dDragging) dragMove(e); });
            window.addEventListener('mouseup',   function(e){ if(dDragging) dragEnd(e); });
            window.addEventListener('touchmove', function(e){ if(dDragging) dragMove(e); }, {passive:false});
            window.addEventListener('touchend',  function(e){ if(dDragging) dragEnd(e); });
        }

        // ── SNAKE ──
        if (action.type === 'snake') {
            var snCanvas = document.getElementById('snake-canvas-' + action.id);
            if (!snCanvas) return;
            var snCtx = snCanvas.getContext('2d');
            var SN = 8, CELL = 25; // 8x8 grid, 25px per cell = 200px canvas
            var snSnake, snDir, snFood, snFoodEaten, snLoop, snDead;
            function snInit() {
                snSnake = [{x:3,y:3},{x:3,y:4},{x:3,y:5}];
                snDir = {x:0,y:-1};
                snFoodEaten = 0;
                snDead = false;
                snPlaceFood();
                snDraw();
            }
            function snPlaceFood() {
                var tries = 0;
                do {
                    snFood = {x: Math.floor(Math.random()*SN), y: Math.floor(Math.random()*SN)};
                    tries++;
                } while (tries < 50 && snSnake.some(function(s){ return s.x===snFood.x&&s.y===snFood.y; }));
            }
            function snTick() {
                if (snDead) return;
                var head = {x: snSnake[0].x + snDir.x, y: snSnake[0].y + snDir.y};
                // Wall collision
                if (head.x < 0 || head.x >= SN || head.y < 0 || head.y >= SN) { snCrash(); return; }
                // Self collision
                if (snSnake.some(function(s){ return s.x===head.x&&s.y===head.y; })) { snCrash(); return; }
                snSnake.unshift(head);
                if (head.x === snFood.x && head.y === snFood.y) {
                    snFoodEaten++;
                    var hint = document.getElementById('snake-hint-' + action.id);
                    if (snFoodEaten >= 3) {
                        snDead = true;
                        clearInterval(snLoop);
                        if (hint) { hint.textContent = '✅ Done!'; hint.style.color = '#22c55e'; }
                        snDraw();
                        setTimeout(function(){ _flexMarkDone(action.id, function(){ _flexCardSuccess(action.id); }); }, 500);
                        return;
                    } else {
                        if (hint) hint.textContent = 'Eat ' + (3 - snFoodEaten) + ' more dot' + (3-snFoodEaten>1?'s':'') + ' to complete';
                        snPlaceFood();
                    }
                } else {
                    snSnake.pop();
                }
                snDraw();
            }
            function snCrash() {
                snDead = true;
                clearInterval(snLoop);
                var hint = document.getElementById('snake-hint-' + action.id);
                if (hint) { hint.textContent = '💥 Crashed! Tap any arrow to retry'; hint.style.color = '#ef4444'; }
                snDraw();
            }
            function snDraw() {
                snCtx.fillStyle = '#0d0d1a';
                snCtx.fillRect(0, 0, SN*CELL, SN*CELL);
                // Grid dots
                snCtx.fillStyle = 'rgba(255,255,255,0.05)';
                for (var gr = 0; gr < SN; gr++) for (var gc = 0; gc < SN; gc++) { snCtx.fillRect(gr*CELL+CELL/2-1, gc*CELL+CELL/2-1, 2, 2); }
                // Food
                snCtx.fillStyle = '#f7931a';
                snCtx.beginPath();
                snCtx.arc(snFood.x*CELL+CELL/2, snFood.y*CELL+CELL/2, CELL/2-4, 0, Math.PI*2);
                snCtx.fill();
                // Snake
                snSnake.forEach(function(seg, i) {
                    snCtx.fillStyle = i===0 ? '#22c55e' : 'rgba(34,197,94,' + (0.9-i*0.05).toFixed(2) + ')';
                    var pad = i===0?2:3;
                    snCtx.beginPath();
                    snCtx.roundRect(seg.x*CELL+pad, seg.y*CELL+pad, CELL-pad*2, CELL-pad*2, 4);
                    snCtx.fill();
                });
                // Dead overlay
                if (snDead && snFoodEaten < 3) {
                    snCtx.fillStyle = 'rgba(239,68,68,0.25)';
                    snCtx.fillRect(0,0,SN*CELL,SN*CELL);
                }
            }
            function snSetDir(dx, dy) {
                if (snDead) { clearInterval(snLoop); snInit(); snLoop = setInterval(snTick, 200); return; }
                // Prevent reversing
                if (dx !== 0 && snDir.x !== 0) return;
                if (dy !== 0 && snDir.y !== 0) return;
                snDir = {x:dx,y:dy};
            }
            // Arrow buttons
            document.getElementById('sn-up-' + action.id).addEventListener('click', function(){ snSetDir(0,-1); });
            document.getElementById('sn-down-' + action.id).addEventListener('click', function(){ snSetDir(0,1); });
            document.getElementById('sn-left-' + action.id).addEventListener('click', function(){ snSetDir(-1,0); });
            document.getElementById('sn-right-' + action.id).addEventListener('click', function(){ snSetDir(1,0); });
            // Swipe
            var snTouchX = null, snTouchY = null;
            snCanvas.addEventListener('touchstart', function(e){ var t=e.touches[0]; snTouchX=t.clientX; snTouchY=t.clientY; }, {passive:true});
            snCanvas.addEventListener('touchend', function(e) {
                if (snTouchX===null) return;
                var t=e.changedTouches[0];
                var dx=t.clientX-snTouchX, dy=t.clientY-snTouchY;
                snTouchX=snTouchY=null;
                if (Math.abs(dx)+Math.abs(dy)<10) return;
                if (Math.abs(dx)>Math.abs(dy)) snSetDir(dx>0?1:-1,0);
                else snSetDir(0,dy>0?1:-1);
            }, {passive:true});
            snInit();
            snLoop = setInterval(snTick, 200);
        }
    });
}



// ══════════════════════════════════════════════════════════════════════
// 🌍 COMMUNITY TAB — Weekly Community Challenge
// ══════════════════════════════════════════════════════════════════════

var _communityUnsub = null;

function _renderCommunityTab(body) {
    // Cleanup previous listener
    if (_communityUnsub) { _communityUnsub(); _communityUnsub = null; }

    body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">⏳ Loading community challenge...</div>';

    if (typeof db === 'undefined') {
        body.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);">⚠️ Database not available</div>';
        return;
    }

    // Get current week key
    var now = new Date();
    var startOfYear = new Date(now.getFullYear(), 0, 1);
    var weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    var weekKey = now.getFullYear() + '-W' + String(weekNum).padStart(2, '0');

    _communityUnsub = db.collection('weekly_challenges').orderBy('startDate', 'desc').limit(1).onSnapshot(function(snapshot) {
        if (snapshot.empty) {
            _renderCommunityEmpty(body);
            return;
        }
        var doc = snapshot.docs[0];
        var data = doc.data();
        _renderCommunityChallenge(body, doc.id, data);
    }, function(err) {
        console.warn('[COMMUNITY] Error:', err);
        _renderCommunityEmpty(body);
    });
}

function _buildSocialProofHTML() {
    var html = '<div id="_communityStats" style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin-bottom:16px;">' +
        '<div style="font-size:0.7rem;font-weight:800;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">\ud83d\udcca Live Community Stats</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">' +
            '<div style="text-align:center;padding:8px;background:var(--bg-side);border-radius:8px;"><div style="font-size:1.1rem;font-weight:900;color:var(--accent);" id="_csStat1">\u2014</div><div style="font-size:0.65rem;color:var(--text-faint);">Quests Completed</div></div>' +
            '<div style="text-align:center;padding:8px;background:var(--bg-side);border-radius:8px;"><div style="font-size:1.1rem;font-weight:900;color:#22c55e;" id="_csStat2">\u2014</div><div style="font-size:0.65rem;color:var(--text-faint);">Members</div></div>' +
            '<div style="text-align:center;padding:8px;background:var(--bg-side);border-radius:8px;"><div style="font-size:1.1rem;font-weight:900;color:#3b82f6;" id="_csStat3">\u2014</div><div style="font-size:0.65rem;color:var(--text-faint);">Poll Votes</div></div>' +
            '<div style="text-align:center;padding:8px;background:var(--bg-side);border-radius:8px;"><div style="font-size:1.1rem;font-weight:900;color:#8b5cf6;" id="_csStat4">\u2014</div><div style="font-size:0.65rem;color:var(--text-faint);">Trivia Answers</div></div>' +
        '</div>' +
    '</div>';
    if (typeof db !== 'undefined') {
        db.collection('stats').doc('global').get().then(function(snap) {
            var d = snap.exists ? snap.data() : {};
            var el1 = document.getElementById('_csStat1');
            var el2 = document.getElementById('_csStat2');
            if (el1) el1.textContent = Number(d.questsCompleted || 0).toLocaleString();
            if (el2) el2.textContent = Number(d.userCount || 0).toLocaleString();
        }).catch(function() {});
        db.collection('poll_cumulative').get().then(function(snap) {
            var total = 0;
            snap.forEach(function(doc) { total += (doc.data().total || 0); });
            var el3 = document.getElementById('_csStat3');
            if (el3) el3.textContent = total.toLocaleString();
        }).catch(function() {});
        db.collection('trivia_cumulative').get().then(function(snap) {
            var total = 0;
            snap.forEach(function(doc) { total += (doc.data().total || 0); });
            var el4 = document.getElementById('_csStat4');
            if (el4) el4.textContent = total.toLocaleString();
        }).catch(function() {});
    }
    return html;
}

function _renderCommunityEmpty(body) {
    body.innerHTML = _buildSocialProofHTML() +
        '<div style="text-align:center;padding:24px 16px;background:var(--card-bg);border:1px solid var(--border);border-radius:14px;">' +
        '<div style="font-size:2.5rem;margin-bottom:12px;">\ud83c\udf0d</div>' +
        '<div style="font-size:1rem;font-weight:800;color:var(--heading);margin-bottom:8px;">Community Challenges</div>' +
        '<div style="color:var(--text-muted);font-size:0.85rem;">Weekly challenges coming soon!<br>Check back Monday for the next one.</div>' +
    '</div>';
}

function _renderCommunityChallenge(body, docId, data) {
    var goals = data.goals || [];
    var progress = data.progress || {};
    var completed = data.completed || false;
    var sfBoost = data.sfBoostActive || false;

    var html = '<style>' +
        '.cc-goal{background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:8px;}' +
    '</style>';

    // Social proof stats above challenge
    html += _buildSocialProofHTML();

    // Header
    html += '<div style="text-align:center;margin-bottom:16px;">' +
        '<div style="font-size:1.8rem;margin-bottom:4px;">' + (completed ? '\ud83c\udfc6' : '\ud83c\udf0d') + '</div>' +
        '<div style="font-size:1.1rem;font-weight:900;color:var(--heading);">' + (data.title || 'Weekly Challenge') + '</div>' +
        '<div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">' + (data.description || '') + '</div>';
    if (data.endDate) {
        html += '<div style="font-size:0.68rem;color:var(--text-faint);margin-top:4px;">Ends: ' + data.endDate + '</div>';
    }
    html += '</div>';

    // SF Boost Banner
    if (sfBoost) {
        html += '<div style="background:rgba(247,147,26,0.1);border:1px solid #f7931a;border-radius:12px;padding:12px;margin-bottom:12px;text-align:center;">' +
            '<div style="color:#f7931a;font-weight:900;font-size:0.95rem;">\u26a1 Community Boost Active!</div>' +
            '<div style="color:var(--text-muted);font-size:0.78rem;margin-top:4px;">Hash rate is 20/min for all participants this week!</div>' +
        '</div>';
    }

    // Goals with progress bars
    goals.forEach(function(goal) {
        var prog = progress[goal.type] || 0;
        var pct = Math.min(100, Math.round((prog / goal.target) * 100));
        var goalDone = prog >= goal.target;
        html += '<div class="cc-goal">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
            '<div style="font-size:0.85rem;font-weight:700;color:var(--heading);">' + goal.label + '</div>' +
            '<div style="font-size:0.75rem;color:' + (goalDone ? '#22c55e' : 'var(--accent)') + ';font-weight:700;">' +
            (goalDone ? '✅ Done!' : prog.toLocaleString() + ' / ' + goal.target.toLocaleString()) + '</div>' +
            '</div>' +
            '<div style="background:var(--bg-side);border:1px solid var(--border);border-radius:6px;height:8px;overflow:hidden;">' +
            '<div style="background:' + (goalDone ? '#22c55e' : 'linear-gradient(90deg,#06b6d4,#3b82f6)') + ';height:100%;width:' + pct + '%;border-radius:6px;transition:width 0.4s;"></div></div>' +
            '<div style="font-size:0.65rem;color:var(--text-faint);margin-top:3px;">' + pct + '% complete</div>' +
        '</div>';
    });

    // Completion status
    if (completed) {
        html += '<div style="background:rgba(34,197,94,0.1);border:1px solid #22c55e;border-radius:12px;padding:14px;text-align:center;margin-top:8px;">' +
            '<div style="color:#22c55e;font-weight:800;font-size:1rem;">\ud83c\udf89 Challenge Complete!</div>' +
            '<div style="color:var(--text-muted);font-size:0.78rem;margin-top:4px;">All participants earned the \u26a1 Community Hero badge + SF boost for the rest of the week!</div>' +
        '</div>';
    } else {
        html += '<div style="margin-top:12px;padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;font-size:0.75rem;color:var(--text-muted);text-align:center;">' +
            '\ud83c\udfc6 Complete all goals as a community to unlock \u26a1 20 hashes/min SF boost for the rest of the week!' +
        '</div>';
    }

    body.innerHTML = html;
}

// ─── Double XP Floating Widget ───────────────────────────────────────────────

window._startDoubleXPWidget = function() {
    var existing = document.getElementById('doubleXPWidget');
    if (existing) existing.remove();
    if (window._doubleXPWidgetTimer) clearInterval(window._doubleXPWidgetTimer);

    function getExpiry() {
        return typeof currentUser !== 'undefined' && currentUser ? (currentUser.doubleXPExpiry || 0) : 0;
    }

    function render() {
        var expiry = getExpiry();
        var remaining = expiry - Date.now();
        if (remaining <= 0) {
            var w = document.getElementById('doubleXPWidget');
            if (w) w.remove();
            if (window._doubleXPWidgetTimer) clearInterval(window._doubleXPWidgetTimer);
            return;
        }
        var mins = Math.ceil(remaining / 60000);
        var w = document.getElementById('doubleXPWidget');
        if (!w) {
            w = document.createElement('div');
            w.id = 'doubleXPWidget';
            w.style.cssText = 'position:fixed;top:58px;right:12px;z-index:8000;background:linear-gradient(135deg,#eab308,#f7931a);color:#fff;font-size:0.72rem;font-weight:800;padding:5px 12px;border-radius:20px;cursor:pointer;box-shadow:0 2px 8px rgba(247,147,26,0.4);white-space:nowrap;font-family:inherit;';
            w.onclick = function() {
                if (typeof showQuestHub === 'function') showQuestHub();
                setTimeout(function() {
                    if (typeof _renderNookTab === 'function') {
                        window._nookSubTab = 'inventory';
                        var body = document.getElementById('questHubBody');
                        if (body) _renderNookTab(body);
                    }
                }, 200);
            };
            document.body.appendChild(w);
        }
        w.textContent = '\uD83C\uDFAF 2\xD7 XP \u2014 ' + mins + ' min';
    }

    render();
    window._doubleXPWidgetTimer = setInterval(render, 30000);
};

window._checkDoubleXPWidget = function() {
    var expiry = typeof currentUser !== 'undefined' && currentUser ? (currentUser.doubleXPExpiry || 0) : 0;
    if (expiry > Date.now()) window._startDoubleXPWidget();
};

// ─── Pinned Badge Selector ────────────────────────────────────────────────────

window._showPinnedBadgeSelector = function() {
    var earned = [];
    try { earned = JSON.parse(localStorage.getItem('btc_badges') || '[]'); } catch(e) {}
    if (!earned.length) {
        if (typeof showToast === 'function') showToast('Earn some badges first!');
        return;
    }

    // Build badge list from BADGE_DEFS
    var badgeMeta = [];
    if (typeof BADGE_DEFS !== 'undefined') {
        BADGE_DEFS.forEach(function(b) {
            if (earned.indexOf(b.id) !== -1) badgeMeta.push({ id: b.id, emoji: b.emoji, name: b.name });
        });
    }
    // Fallback if no BADGE_DEFS
    if (!badgeMeta.length) {
        earned.forEach(function(id) { badgeMeta.push({ id: id, emoji: '\uD83C\uDFC5', name: id }); });
    }

    var overlay = document.createElement('div');
    overlay.id = 'pinnedBadgeSelectorOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10010;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    var currentPinned = typeof currentUser !== 'undefined' && currentUser ? (currentUser.pinnedBadgeId || '') : '';

    var gridHtml = '<div style="display:flex;flex-wrap:wrap;gap:8px;max-height:300px;overflow-y:auto;padding:4px;">';
    badgeMeta.forEach(function(b) {
        var isSelected = b.id === currentPinned;
        gridHtml += '<button onclick="window._selectPinnedBadge(\'' + b.id.replace(/['"]/g,'') + '\')" ' +
            'style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 8px;min-width:72px;background:' +
            (isSelected ? 'rgba(247,147,26,0.15)' : 'var(--card-bg)') + ';border:1px solid ' +
            (isSelected ? '#f7931a' : 'var(--border)') + ';border-radius:10px;cursor:pointer;font-family:inherit;transition:0.2s;">' +
            '<span style="font-size:1.5rem;">' + (typeof escapeHtml === 'function' ? escapeHtml(b.emoji) : b.emoji) + '</span>' +
            '<span style="font-size:0.6rem;color:var(--text-muted);text-align:center;max-width:68px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
            (typeof escapeHtml === 'function' ? escapeHtml(b.name) : b.name) + '</span>' +
            (isSelected ? '<span style="font-size:0.55rem;color:#f7931a;font-weight:700;">Pinned ✓</span>' : '') +
            '</button>';
    });
    gridHtml += '</div>';

    overlay.innerHTML = '<div style="background:var(--bg-side,#1a1a2e);border:2px solid rgba(247,147,26,0.3);border-radius:20px;padding:24px;max-width:420px;width:100%;max-height:90vh;overflow-y:auto;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
        '<div style="font-size:1rem;font-weight:800;color:var(--heading);">\uD83D\uDCCC Choose a Badge to Pin</div>' +
        '<button onclick="document.getElementById(\'pinnedBadgeSelectorOverlay\').remove()" style="background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);width:32px;height:32px;cursor:pointer;font-size:1rem;font-family:inherit;">\u2715</button></div>' +
        '<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:12px;">This badge will be displayed on your profile card.</div>' +
        gridHtml +
        (currentPinned ? '<button onclick="window._selectPinnedBadge(\'\')" style="margin-top:12px;width:100%;padding:10px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.8rem;cursor:pointer;font-family:inherit;">Remove pinned badge</button>' : '') +
    '</div>';
    document.body.appendChild(overlay);
};

window._selectPinnedBadge = function(badgeId) {
    if (typeof currentUser === 'undefined' || !currentUser) return;
    currentUser.pinnedBadgeId = badgeId || null;
    // Write to Firestore
    if (typeof db !== 'undefined' && typeof auth !== 'undefined' && auth.currentUser && !auth.currentUser.isAnonymous) {
        db.collection('users').doc(auth.currentUser.uid).update({ pinnedBadgeId: badgeId || null }).catch(function(e) {
            console.warn('[pinnedBadge] Firestore write failed:', e);
        });
    }
    var overlay = document.getElementById('pinnedBadgeSelectorOverlay');
    if (overlay) overlay.remove();
    if (typeof showToast === 'function') {
        showToast(badgeId ? '\uD83D\uDCCC Badge pinned to your profile!' : '\uD83D\uDCCC Pinned badge removed.');
    }
    // Re-render the rank bar so the pinned badge appears
    if (typeof updateRankUI === 'function') updateRankUI();
};

// ─── Chat Flair Picker ────────────────────────────────────────────────────────

window._showChatFlairPicker = function() {
    var FLAIR_OPTIONS = ['\uD83D\uDD25', '\u26A1', '\uD83E\uDD8C', '\uD83E\uDDE1', '\uD83D\uDC8E', '\uD83D\uDC51', '\uD83C\uDFAF', '\u26CF\uFE0F', '\uD83D\uDFE0'];
    var currentFlair = typeof currentUser !== 'undefined' && currentUser ? (currentUser.chatFlairEmoji || '\uD83D\uDD25') : '\uD83D\uDD25';

    var overlay = document.createElement('div');
    overlay.id = 'chatFlairPickerOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10010;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    var gridHtml = '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:16px 0;">';
    FLAIR_OPTIONS.forEach(function(emoji) {
        var isSelected = emoji === currentFlair;
        gridHtml += '<button onclick="window._selectChatFlair(\'' + emoji + '\')" ' +
            'style="width:48px;height:48px;font-size:1.5rem;border-radius:12px;border:2px solid ' +
            (isSelected ? '#f7931a' : 'var(--border)') + ';background:' +
            (isSelected ? 'rgba(247,147,26,0.15)' : 'var(--card-bg)') + ';cursor:pointer;transition:0.15s;font-family:inherit;">' +
            emoji + '</button>';
    });
    gridHtml += '</div>';

    overlay.innerHTML = '<div style="background:var(--bg-side,#1a1a2e);border:2px solid rgba(247,147,26,0.3);border-radius:20px;padding:24px;max-width:360px;width:100%;text-align:center;">' +
        '<div style="font-size:1rem;font-weight:800;color:var(--heading);margin-bottom:4px;">\uD83D\uDD25 Choose Your Chat Flair</div>' +
        '<div style="font-size:0.78rem;color:var(--text-muted);">This emoji appears next to your name in Global Chat.</div>' +
        gridHtml +
        '<button onclick="document.getElementById(\'chatFlairPickerOverlay\').remove()" style="width:100%;padding:10px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.8rem;cursor:pointer;font-family:inherit;">Cancel</button>' +
    '</div>';
    document.body.appendChild(overlay);
};

window._selectChatFlair = function(emoji) {
    if (typeof currentUser === 'undefined' || !currentUser) return;
    currentUser.chatFlairEmoji = emoji;
    if (typeof db !== 'undefined' && typeof auth !== 'undefined' && auth.currentUser && !auth.currentUser.isAnonymous) {
        db.collection('users').doc(auth.currentUser.uid).update({ chatFlairEmoji: emoji }).catch(function(e) {
            console.warn('[chatFlair] Firestore write failed:', e);
        });
    }
    var overlay = document.getElementById('chatFlairPickerOverlay');
    if (overlay) overlay.remove();
    if (typeof showToast === 'function') showToast('\uD83D\uDD25 Chat flair set to ' + emoji + '!');
};

// ─── Post-Purchase Cosmetic Tooltips ─────────────────────────────────────────
// Called at the end of _nookBuyItem success handler

window._cosmeticPostPurchase = function(itemId) {
    var tips = {
        'profile_frame': 'Your profile now has an orange glow! Visible on your leaderboard card.',
        'chat_flair': 'Your messages in Global Chat now show a flair badge next to your name!',
        'pinned_badge': 'Go to Inventory \u2192 tap \u201cChoose Badge\u201d to select which badge to pin!',
        'nacho_skin_nook': 'You\'re now a golden Nacho! Visible in chat and on your profile card \uD83E\uDD8C',
        'second_rig': '\u26a1 Rig charge added! Open the Satoshi\u2019s Favor miner and tap Hash #2. Charge is consumed on first use per window.'
    };
    var tip = tips[itemId];
    if (tip) {
        setTimeout(function() {
            if (typeof showToast === 'function') showToast('\uD83C\uDF89 ' + tip, 5000);
        }, 1000);
    }
    // Special post-purchase flows
    if (itemId === 'pinned_badge') {
        setTimeout(function() {
            if (typeof window._showPinnedBadgeSelector === 'function') window._showPinnedBadgeSelector();
        }, 1500);
    }
    if (itemId === 'chat_flair') {
        setTimeout(function() {
            if (typeof window._showChatFlairPicker === 'function') window._showChatFlairPicker();
        }, 1500);
    }
};
