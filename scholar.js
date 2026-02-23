// =============================================
// Bitcoin Education Archive - Bitcoin Scholar Certification
// 200 question pool, 25 per attempt, 5 choices, 10 min timer
// 20/25 to pass, retry locked until next day
// =============================================

const SCHOLAR_POOL = [
    // === PROPERTIES & FUNDAMENTALS ===
    { q: "What makes Bitcoin's monetary policy fundamentally different from fiat currencies?", a: "Its supply schedule is fixed in code and cannot be changed by any authority", w: ["It is backed by gold reserves", "Central banks can adjust its inflation rate", "Governments vote on supply changes", "Its supply grows proportionally to demand"] },
    { q: "Why is Bitcoin considered 'trustless'?", a: "Users can independently verify every transaction and rule without trusting third parties", w: ["Because nobody trusts Bitcoin", "Because it has no users", "Because the government guarantees it", "Because exchanges verify everything for you"] },
    { q: "What problem does Bitcoin's proof-of-work consensus solve?", a: "The double-spending problem without needing a trusted intermediary", w: ["Making transactions free of charge", "Eliminating all transaction fees", "Making Bitcoin mining profitable", "Reducing electricity consumption globally"] },
    { q: "Why does Bitcoin have value according to Austrian economics?", a: "It possesses superior monetary properties: scarcity, durability, portability, divisibility, and fungibility", w: ["The government declared it legal tender everywhere", "It is backed by physical assets in a vault", "A corporation guarantees its price floor", "Supply and demand have no effect on its value"] },
    { q: "What happens to the Bitcoin block reward over time?", a: "It halves approximately every 4 years until all 21 million Bitcoin are mined", w: ["It increases each year to incentivize miners", "It stays the same forever", "The community votes on changes every decade", "It doubles every 4 years"] },
    { q: "Why can't Bitcoin's 21 million supply cap be changed?", a: "Changing it would require near-universal consensus, and no rational participant would devalue their own holdings", w: ["A single developer can change it anytime", "The SEC prevents changes to the cap", "Satoshi Nakamoto's computer controls it", "It's physically impossible to modify any code"] },
    { q: "What gives Bitcoin its censorship resistance?", a: "Its decentralized network of nodes that no single entity can control or shut down", w: ["A team of moderators reviews all transactions", "Government agencies approve each block", "One central server processes everything", "Banks whitelist approved transactions"] },
    { q: "Why is Bitcoin described as 'sound money'?", a: "It cannot be debased, inflated, or manipulated by any central authority", w: ["It makes a sound when you send it", "Central banks control its inflation rate", "It is always worth exactly one dollar", "The government prints more when needed"] },
    { q: "What does 'Bitcoin fixes the money' mean in principle?", a: "Bitcoin removes the ability of institutions to inflate away purchasing power through money printing", w: ["Bitcoin eliminates all financial problems instantly", "Bitcoin replaces all government services", "Bitcoin makes everyone equally wealthy", "Bitcoin eliminates the need for savings"] },
    { q: "Why is energy expenditure in Bitcoin mining a feature, not a bug?", a: "It provides real-world thermodynamic security that makes the network extremely costly to attack", w: ["It wastes energy intentionally to slow transactions", "Energy use has no relationship to security", "It exists only because the code is inefficient", "It is a temporary flaw being fixed in the next update"] },

    // === DECENTRALIZATION ===
    { q: "Why is decentralization crucial for Bitcoin's value proposition?", a: "It ensures no single point of failure and prevents any entity from controlling or censoring transactions", w: ["It makes transactions faster than centralized systems", "It reduces the cost of mining equipment", "It allows a CEO to make quick decisions", "It enables reversal of fraudulent transactions"] },
    { q: "What role do full nodes play in Bitcoin's decentralization?", a: "They independently verify every transaction and block against consensus rules", w: ["They only store a copy of the blockchain for backup", "They increase Bitcoin's transaction speed", "They allow miners to bypass consensus rules", "They are operated exclusively by Bitcoin Core developers"] },
    { q: "If a majority of miners tried to change Bitcoin's rules, what would happen?", a: "Full nodes would reject their invalid blocks, and miners would waste their energy", w: ["The rule change would automatically take effect", "Bitcoin would immediately shut down", "All existing Bitcoin would become worthless", "Users would be forced to accept the new rules"] },
    { q: "Why can no government effectively ban Bitcoin?", a: "Its decentralized peer-to-peer network can operate across borders with no central point to shut down", w: ["International law prevents governments from banning currencies", "Bitcoin is protected by the US Constitution", "Only one government would need to approve it globally", "Bitcoin can only exist in countries where it is legal"] },
    { q: "What distinguishes Bitcoin's governance from corporate governance?", a: "Changes require rough consensus among users, developers, miners, and node operators — no one group has unilateral control", w: ["A board of directors votes on all protocol changes", "Satoshi Nakamoto approves all updates", "The largest mining pool dictates all changes", "Whoever owns the most Bitcoin decides the rules"] },

    // === SCARCITY & MONETARY PROPERTIES ===
    { q: "How does Bitcoin's scarcity differ from gold's scarcity?", a: "Bitcoin's supply is mathematically fixed and verifiable, while gold's total supply is unknown and new deposits can be discovered", w: ["Gold is scarcer than Bitcoin", "Both have exactly the same supply dynamics", "Bitcoin's supply can be increased by miners", "Gold has a fixed supply cap like Bitcoin"] },
    { q: "What is the significance of Bitcoin's stock-to-flow ratio after the 2024 halving?", a: "It surpasses gold's stock-to-flow ratio, making Bitcoin the hardest money ever created", w: ["It becomes easier to mine more Bitcoin faster", "The ratio decreases as more Bitcoin are created", "It has no relationship to Bitcoin's value proposition", "It means Bitcoin becomes inflationary after the halving"] },
    { q: "Why is absolute digital scarcity considered Bitcoin's most important innovation?", a: "For the first time in history, humans created an asset with a supply that is provably finite and immutable", w: ["Digital scarcity existed before Bitcoin in many forms", "Scarcity doesn't affect value in economics", "Any cryptocurrency can replicate true digital scarcity", "Central banks can create digital scarcity at will"] },
    { q: "What makes Bitcoin 'unforgeable'?", a: "The proof-of-work system ensures that creating valid Bitcoin requires real energy expenditure that cannot be faked", w: ["A centralized authority stamps each Bitcoin as authentic", "Software watermarks prevent copying", "Each Bitcoin has a unique serial number checked by Visa", "Anti-counterfeiting AI monitors the network"] },
    { q: "Why does deflation benefit savers in a Bitcoin standard?", a: "Purchasing power increases over time, rewarding those who produce more than they consume", w: ["Deflation causes prices to rise rapidly", "Deflation only benefits people who spend quickly", "There is no relationship between deflation and saving", "Deflation requires government intervention to work"] },

    // === SECURITY ===
    { q: "What would a successful 51% attack actually allow an attacker to do?", a: "Reverse their own recent transactions (double-spend), but NOT steal others' coins or create fake Bitcoin", w: ["Steal all Bitcoin from every wallet", "Create unlimited new Bitcoin", "Change Bitcoin's monetary policy", "Access every user's private keys"] },
    { q: "Why does Bitcoin's security increase as its price rises?", a: "Higher prices incentivize more mining, increasing the hash rate and making attacks more expensive", w: ["The code automatically becomes more complex at higher prices", "More developers are hired to protect it", "The government provides more security at higher valuations", "Security and price have no relationship in Bitcoin"] },
    { q: "What protects Bitcoin from quantum computing threats?", a: "Bitcoin can be upgraded with quantum-resistant cryptography, and quantum computers would need to break SHA-256 and ECDSA simultaneously", w: ["Bitcoin is permanently immune to all computing advances", "Quantum computers already exist that could break Bitcoin", "Bitcoin uses quantum computing for its encryption", "Quantum computing would only make Bitcoin faster"] },
    { q: "Why is Bitcoin's security model described as 'thermodynamic'?", a: "It converts real-world energy into digital security, making attacks require equivalent real-world resources", w: ["Bitcoin generates physical heat as a security measure", "Temperature sensors protect the blockchain", "Security depends on keeping servers at low temperatures", "Thermodynamics has nothing to do with Bitcoin's security"] },
    { q: "What makes Bitcoin's track record of security significant?", a: "Despite being a multi-trillion dollar bounty, the protocol has never been successfully hacked since its inception", w: ["It has been hacked several times but quickly recovered", "Its security is guaranteed by the US military", "Insurance companies protect against any losses", "It's too small a target for hackers to bother with"] },

    // === PROOF OF WORK vs PROOF OF STAKE ===
    { q: "Why is proof-of-work considered more decentralized than proof-of-stake?", a: "PoW requires ongoing real-world energy expenditure, preventing the accumulation of permanent control through wealth alone", w: ["PoW uses less electricity than PoS", "PoW allows fewer people to participate", "PoS and PoW are equally decentralized by design", "PoW requires government approval to mine"] },
    { q: "What fundamental problem does proof-of-stake fail to solve that proof-of-work addresses?", a: "PoS cannot achieve trustless consensus without an external anchor to the physical world", w: ["PoS processes transactions too quickly", "PoS uses too much electricity", "PoW is older and therefore less innovative", "PoS creates too many coins"] },
    { q: "Why do some argue that proof-of-stake replicates the existing financial system?", a: "Those with the most capital gain the most power and rewards, similar to how traditional finance concentrates wealth", w: ["PoS uses the same programming language as banks", "PoS requires a banking license to participate", "PoS was invented by central banks", "PoS coins are issued by the Federal Reserve"] },

    // === MONEY & ECONOMICS ===
    { q: "According to the Austrian School of Economics, why does fiat money lose value over time?", a: "Governments continuously increase the money supply, diluting the purchasing power of existing currency", w: ["Money naturally decays like a physical object", "People lose confidence for no economic reason", "Technology makes old money obsolete", "Fiat money gains value over time, not loses it"] },
    { q: "Why is Bitcoin's fixed supply considered superior to the Federal Reserve's monetary policy?", a: "Rules-based monetary policy removes human error, corruption, and political manipulation from money creation", w: ["The Federal Reserve has a better track record than Bitcoin", "Fixed supply means no transactions can occur", "Human-managed money supply is more responsive to crises", "Bitcoin has no monetary policy at all"] },
    { q: "What does 'lowering your time preference' mean in the context of Bitcoin?", a: "Valuing future rewards more highly and making long-term decisions rather than seeking instant gratification", w: ["Spending money faster before it loses value", "Reducing the time you spend on Bitcoin research", "Making Bitcoin transactions process faster", "Preferring to trade Bitcoin on shorter timeframes"] },
    { q: "Why is the Cantillon Effect important for understanding Bitcoin's value?", a: "It shows how those closest to new money creation benefit at the expense of everyone else, a problem Bitcoin eliminates", w: ["It proves that Bitcoin mining is unprofitable", "It demonstrates why inflation is good for everyone", "It explains why Bitcoin needs a central bank", "It has no relevance to monetary economics"] },
    { q: "How does Bitcoin act as a hedge against currency devaluation?", a: "Its fixed supply and decentralized nature make it immune to the inflationary policies of any government", w: ["Bitcoin's price is pegged to the US dollar", "The government guarantees Bitcoin's minimum value", "Banks provide insurance against Bitcoin losses", "Bitcoin automatically adjusts its supply to match inflation"] },
    { q: "What is the significance of Bitcoin being 'bearer asset'?", a: "Whoever holds the private keys has direct ownership without relying on any institution", w: ["It can only be held by licensed financial bearers", "Bearer means it requires a bank to custody it", "It must be physically carried between users", "Bearer status is granted by government registration"] },
    { q: "Why is Bitcoin compared to 'digital real estate'?", a: "There is a fixed amount of 'space' on the blockchain, and no more can ever be created", w: ["You can build houses with Bitcoin", "Bitcoin is regulated like property", "Bitcoin requires physical land to mine", "Real estate agents sell Bitcoin"] },

    // === LIGHTNING NETWORK & LAYERS ===
    { q: "Why does Bitcoin need second-layer solutions like the Lightning Network?", a: "The base layer prioritizes security and decentralization, so additional layers handle speed and scalability", w: ["The base layer is broken and needs replacement", "Lightning makes Bitcoin more decentralized", "Second layers are unnecessary if you increase block size", "Bitcoin's base layer is too fast and needs to be slowed down"] },
    { q: "How does the Lightning Network achieve near-instant transactions?", a: "By creating payment channels where transactions settle between parties without broadcasting to the main chain", w: ["By removing Bitcoin's security features temporarily", "By using a separate, centralized server", "By speeding up the block time to one second", "By eliminating the need for mining entirely"] },
    { q: "What trade-off does increasing Bitcoin's block size make?", a: "Larger blocks increase throughput but reduce decentralization by making it harder to run full nodes", w: ["Larger blocks make Bitcoin more secure", "Block size has no effect on decentralization", "Larger blocks reduce transaction throughput", "Larger blocks make running nodes cheaper and easier"] },

    // === SELF CUSTODY & SECURITY ===
    { q: "Why is the phrase 'not your keys, not your coins' fundamental to Bitcoin?", a: "If you don't control your private keys, a third party controls your Bitcoin and could lose, freeze, or steal them", w: ["It's just a marketing slogan with no practical meaning", "Keys are physical objects that prove Bitcoin ownership", "Only miners need to worry about key ownership", "Banks can always recover lost Bitcoin regardless of keys"] },
    { q: "What is the most important property of a Bitcoin seed phrase?", a: "It is the master backup that can regenerate all private keys and recover funds from any compatible wallet", w: ["It must be stored digitally in the cloud for safety", "It can only be used once before it expires", "It contains the Bitcoin itself in encoded form", "It is provided by Bitcoin customer support if lost"] },
    { q: "Why should Bitcoin seed phrases never be stored digitally?", a: "Digital storage is vulnerable to hacking, malware, and data breaches that could expose your keys", w: ["Digital storage is actually the safest option available", "Seed phrases expire when stored digitally", "The Bitcoin protocol blocks digitally stored seeds", "Digital copies of seeds create duplicate Bitcoin"] },

    // === MINING ===
    { q: "What is the primary purpose of Bitcoin mining?", a: "To secure the network by making it computationally expensive to attack or rewrite transaction history", w: ["To create as many Bitcoin as possible as fast as possible", "To keep electricity companies profitable", "To store Bitcoin in specialized hardware", "To provide internet access to rural areas"] },
    { q: "How does the difficulty adjustment contribute to Bitcoin's reliability?", a: "It ensures blocks are found approximately every 10 minutes regardless of how much mining power joins or leaves", w: ["It makes mining easier over time to attract new miners", "It permanently increases difficulty, never decreasing", "It only adjusts once per year during a network vote", "It keeps Bitcoin's price stable at a target level"] },
    { q: "Why is Bitcoin mining an ally in renewable energy development?", a: "Miners can monetize stranded or excess energy that would otherwise be wasted, subsidizing renewable projects", w: ["Bitcoin mining only uses renewable energy by protocol rule", "Mining uses no electricity at all", "Miners are required by law to use solar power", "Mining prevents renewable energy from being developed"] },
    { q: "What happens when the last Bitcoin is mined around 2140?", a: "Miners will be incentivized solely by transaction fees to continue securing the network", w: ["The Bitcoin network will shut down permanently", "New Bitcoin will be created to replace mined ones", "Miners will switch to mining Ethereum", "The protocol will switch to proof-of-stake"] },

    // === PRIVACY & SOVEREIGNTY ===
    { q: "Why is financial privacy considered a human right by Bitcoin advocates?", a: "Privacy protects individuals from persecution, theft, and economic manipulation by powerful entities", w: ["Privacy is only useful for criminals", "Financial privacy has never been recognized as important", "Bitcoin provides complete anonymity by default", "Governments should have access to all financial records"] },
    { q: "What does financial sovereignty mean in the context of Bitcoin?", a: "The ability to store, send, and receive value without permission from or control by any third party", w: ["Having a bank account with special privileges", "Being granted authority to print your own money", "Having government insurance on your investments", "Being able to reverse any transaction you make"] },
    { q: "Why is KYC (Know Your Customer) controversial in the Bitcoin community?", a: "It creates surveillance databases, connects identities to Bitcoin holdings, and undermines the censorship-resistant properties", w: ["KYC is universally supported by all Bitcoin users", "KYC makes Bitcoin more decentralized", "It only applies to purchases over $1 million", "KYC protects users' privacy by hiding their identity"] },

    // === GAME THEORY & INCENTIVES ===
    { q: "Why is Bitcoin adoption described as a 'prisoner's dilemma' for nation-states?", a: "Countries that adopt Bitcoin first gain an advantage, so rational actors are incentivized to adopt before competitors do", w: ["All countries must adopt simultaneously or it fails", "Countries face imprisonment for adopting Bitcoin", "Bitcoin penalizes early adopters with higher fees", "Nation-states have no incentive to hold Bitcoin"] },
    { q: "How does Bitcoin's incentive structure prevent cheating?", a: "The cost of attacking the network far exceeds any potential profit from cheating", w: ["A centralized fraud department monitors all transactions", "Cheaters are identified and banned by Bitcoin's CEO", "Insurance covers any losses from cheating", "Social pressure prevents all dishonest behavior"] },
    { q: "Why is it said that 'Bitcoin changes you before you change Bitcoin'?", a: "Understanding Bitcoin's principles naturally shifts your perspective on money, time, and value", w: ["Bitcoin's software alters your computer settings", "You must change your legal name to use Bitcoin", "Bitcoin physically transforms into whatever you need", "The blockchain records and changes your personality"] },
    { q: "What does 'gradually, then suddenly' describe about Bitcoin adoption?", a: "Adoption grows slowly through education and understanding, then accelerates rapidly through network effects", w: ["Bitcoin's price only goes up gradually, never suddenly", "The network gradually slows down then suddenly crashes", "Gradually refers to mining and suddenly refers to halving", "This phrase has no specific meaning in Bitcoin"] },

    // === HISTORY & ORIGINS ===
    { q: "Why was Bitcoin's anonymous creation by Satoshi Nakamoto important?", a: "It ensured no single leader could be pressured, corrupted, or become a central point of failure", w: ["Anonymity was accidental and Satoshi plans to reveal identity", "It allowed Satoshi to avoid paying taxes on Bitcoin", "Anonymity is required by all cryptocurrency creators", "It was a marketing strategy to generate interest"] },
    { q: "What problem did the 2008 financial crisis expose that Bitcoin was designed to solve?", a: "The systemic risk of trusting centralized institutions with the global financial system", w: ["The need for faster stock trading platforms", "The shortage of physical cash in circulation", "The lack of sufficient bank branches globally", "The high cost of gold mining operations"] },
    { q: "Why is the Bitcoin genesis block's embedded message significant?", a: "It references a bank bailout headline, highlighting the broken financial system Bitcoin was created to address", w: ["It contains instructions for mining the second block", "It's a random message with no particular meaning", "It includes Satoshi's real identity", "It contains the Bitcoin source code itself"] },

    // === NETWORK EFFECTS & ADOPTION ===
    { q: "Why do Bitcoin's network effects create a 'winner-take-most' dynamic in digital money?", a: "The most secure, liquid, and widely accepted monetary network attracts users exponentially, reinforcing its dominance", w: ["All cryptocurrencies benefit equally from network effects", "Network effects don't apply to digital currencies", "The first-created cryptocurrency always wins regardless of properties", "Government regulation determines which network wins"] },
    { q: "How does the Lindy Effect apply to Bitcoin?", a: "The longer Bitcoin survives and thrives, the longer its expected remaining lifespan becomes", w: ["Bitcoin gets weaker and less likely to survive over time", "The Lindy Effect only applies to physical objects", "It means Bitcoin will last exactly as long as it already has", "The Lindy Effect proves Bitcoin will fail soon"] },
    { q: "Why is Bitcoin's network effect considered its strongest moat?", a: "Each new user increases liquidity, security, development, and adoption, creating a self-reinforcing cycle that competitors cannot easily replicate", w: ["Bitcoin has patents that prevent competition", "Government regulations prevent new networks from forming", "The network effect is easily replicable by newer projects", "Network effects only apply to social media, not money"] },

    // === COMMON MISCONCEPTIONS ===
    { q: "Why is the argument 'Bitcoin has no intrinsic value' flawed?", a: "No money has intrinsic value — value is subjective, and Bitcoin's monetary properties make it superior to alternatives", w: ["Bitcoin does have intrinsic value because it's backed by gold", "The argument is actually correct and Bitcoin is therefore worthless", "Intrinsic value only comes from government declaration", "Bitcoin has intrinsic value because servers are expensive"] },
    { q: "Why is comparing Bitcoin's energy use to a country's energy use misleading?", a: "The comparison ignores that Bitcoin secures a global financial network and monetizes otherwise stranded energy", w: ["Bitcoin actually uses more energy than all countries combined", "Energy comparisons are always accurate and helpful", "Bitcoin uses no energy at all", "Country energy use is irrelevant to any comparison"] },
    { q: "Why does 'Bitcoin is too slow for payments' miss the bigger picture?", a: "Bitcoin's base layer is a settlement network optimized for security, while payment layers like Lightning handle daily transactions", w: ["Bitcoin is actually faster than Visa at all times", "Slow transactions are a permanent unfixable flaw", "Speed is the only metric that matters for money", "No solution for Bitcoin's speed limitations exists or is being developed"] },
    { q: "Why don't altcoins disprove Bitcoin's scarcity?", a: "Creating another cryptocurrency doesn't affect Bitcoin's supply, just as starting a new company doesn't dilute Apple's shares", w: ["Altcoins do actually reduce Bitcoin's scarcity", "There is no difference between Bitcoin and any altcoin", "All cryptocurrencies share the same supply cap", "Bitcoin's code automatically adjusts for new altcoins"] },
    { q: "Why is 'Bitcoin is only used by criminals' a misleading statement?", a: "Cash is used far more for illicit activity, and Bitcoin's transparent blockchain actually makes it poor for crime", w: ["Bitcoin is indeed primarily used for criminal activity", "Criminals prefer Bitcoin because it's completely anonymous", "No criminals have ever used traditional banking systems", "Law enforcement cannot trace Bitcoin transactions"] },

    // === TECHNICAL FUNDAMENTALS ===
    { q: "What is a UTXO and why does it matter?", a: "An Unspent Transaction Output — the fundamental unit of Bitcoin ownership that tracks which coins can be spent", w: ["A type of Bitcoin wallet manufactured by Ledger", "A government tracking number for Bitcoin taxes", "A mining algorithm that creates new Bitcoin", "A social media platform for Bitcoin traders"] },
    { q: "Why is Bitcoin's blockchain described as a 'timechain'?", a: "Each block creates an immutable timestamp, establishing chronological ordering of all transactions", w: ["Because it can only be used at certain times of day", "Because blocks are created exactly every second", "Because Satoshi named it that for marketing purposes", "Because time zones affect transaction processing"] },
    { q: "What makes Bitcoin transactions 'immutable' after sufficient confirmations?", a: "The cumulative proof-of-work built on top of a transaction makes it exponentially harder to reverse", w: ["An admin team at Bitcoin headquarters locks confirmed transactions", "Transactions can always be reversed by the sender", "Government regulations prevent transaction reversal", "Immutability is just a theoretical concept, not reality"] },
    { q: "What is a Bitcoin 'fork' and why do most forks fail?", a: "A fork copies Bitcoin's code but cannot replicate its network effect, security, and decentralization", w: ["Forks are improvements that always replace the original Bitcoin", "Forks cannot exist because Bitcoin's code is patented", "Every fork automatically gains Bitcoin's full hash rate", "Forks are approved by Bitcoin's governing board"] },
    { q: "Why does Bitcoin use a 10-minute block time instead of faster?", a: "It provides sufficient time for blocks to propagate globally, maintaining decentralization and reducing orphaned blocks", w: ["Ten minutes was a random choice with no technical basis", "Faster block times would increase security", "The block time will be reduced to one minute in the next upgrade", "Block time has no effect on network performance"] },

    // === BROADER IMPACT ===
    { q: "How can Bitcoin impact human rights in authoritarian countries?", a: "It provides an uncensorable financial tool that cannot be seized or frozen by oppressive governments", w: ["Authoritarian governments can easily block all Bitcoin use", "Bitcoin only works in democratic countries", "Human rights organizations oppose Bitcoin", "Bitcoin requires government permission to use in all countries"] },
    { q: "Why might a Bitcoin standard discourage war?", a: "Governments can no longer print money to fund wars — they must tax citizens directly, increasing political accountability", w: ["Bitcoin has a built-in anti-war protocol", "Wars have never been funded by money printing", "Bitcoin users sign a non-aggression pact", "The United Nations controls Bitcoin to prevent wars"] },
    { q: "How does Bitcoin empower the unbanked population globally?", a: "Anyone with internet access can participate in the financial system without needing bank accounts, credit checks, or identification", w: ["It requires a bank account and credit score to use", "Only citizens of developed nations can access Bitcoin", "Bitcoin requires a physical bank branch to operate", "You need government-issued ID to create a Bitcoin wallet"] },
    { q: "Why is Bitcoin considered a tool for financial inclusion?", a: "It provides permissionless access to savings, payments, and financial services for anyone worldwide", w: ["It excludes anyone without a university degree", "Only accredited investors can hold Bitcoin", "Financial inclusion requires centralized banking", "Bitcoin has maximum balance limits for new users"] },

    // === ALTCOINS & COMPETITION ===
    { q: "Why do Bitcoin maximalists argue that altcoins are unnecessary?", a: "Bitcoin's base layer plus additional protocol layers can serve all monetary and smart contract use cases without the trade-offs altcoins make", w: ["Maximalists are uninformed about technology", "Altcoins and Bitcoin serve completely different markets", "Maximalism is a religious belief with no logical basis", "Bitcoin cannot be upgraded to add new features"] },
    { q: "What fundamental flaw do critics identify in Ethereum's monetary policy?", a: "Its monetary policy has been changed multiple times, demonstrating it has no credible commitment to a fixed supply", w: ["Ethereum has more strict monetary policy than Bitcoin", "Ethereum's monetary policy is identical to Bitcoin's", "Monetary policy is irrelevant for smart contract platforms", "Ethereum's supply is fixed at 100 million"] },
    { q: "Why is the existence of thousands of cryptocurrencies not a threat to Bitcoin?", a: "Bitcoin's value comes from its unique properties — decentralization, security, immutability — which no altcoin has replicated", w: ["All cryptocurrencies are interchangeable", "More cryptocurrencies means more total crypto value for all", "Competition always destroys the first mover", "Altcoins will eventually merge with Bitcoin automatically"] },
    { q: "What does the 'blockchain not Bitcoin' argument misunderstand?", a: "The blockchain is only valuable because of Bitcoin's decentralized consensus — without it, a blockchain is just an inefficient database", w: ["Blockchains are always superior to regular databases", "The argument correctly identifies blockchain as the real innovation", "Bitcoin and blockchain are completely unrelated technologies", "All blockchains are equally decentralized"] },

    // === PHILOSOPHY & TIME PREFERENCE ===
    { q: "How does a savings-oriented culture (low time preference) benefit civilization?", a: "It incentivizes long-term thinking, capital accumulation, investment in the future, and intergenerational wealth building", w: ["Low time preference encourages immediate spending", "Savings-oriented cultures experience faster inflation", "Long-term thinking has no benefit over short-term thinking", "Saving money harms economic growth in all cases"] },
    { q: "What is the relationship between hard money and artistic/cultural flourishing?", a: "Sound money incentivizes long-term creation and patronage, as the value of savings is preserved over time", w: ["Hard money has no effect on culture or art", "Inflationary money produces better art through urgency", "Art can only flourish under government-issued currency", "Cultural achievements require money printing to fund them"] },
    { q: "Why do Bitcoiners reference the fall of the Roman Empire as a cautionary tale?", a: "Rome debased its currency to fund military expansion, leading to economic collapse — a pattern repeated by modern governments", w: ["Rome fell because it didn't have Bitcoin", "Rome debased its military, not its currency", "The Roman Empire ended because of a natural disaster", "There is no connection between Rome and modern monetary policy"] },
    { q: "How does proof-of-work mirror the physical world's concept of value?", a: "Just as physical value requires energy to create, Bitcoin requires energy expenditure to produce, anchoring digital value to real-world cost", w: ["There is no connection between energy and value", "Digital value should be free to create without cost", "Proof-of-work wastes energy without creating value", "Physical world concepts don't apply to digital systems"] },

    // === HALVING & SUPPLY ===
    { q: "Why is each Bitcoin halving economically significant?", a: "It reduces new supply entering the market while demand typically grows, creating supply shock pressure", w: ["Halvings double the total supply of Bitcoin", "Halvings have never affected Bitcoin's market dynamics", "Each halving gives miners double the reward", "Halvings only matter for miners, not holders"] },
    { q: "How does Bitcoin's disinflationary schedule mimic natural resource extraction?", a: "Easy coins are mined first, then it becomes progressively harder and more expensive, similar to mining gold or oil", w: ["Bitcoin's supply schedule is random and unpredictable", "All Bitcoin were created at once when the network launched", "Mining difficulty stays constant over time", "Bitcoin mining gets easier and cheaper each year"] },

    // === NODES & VERIFICATION ===
    { q: "Why is running your own node considered a fundamental Bitcoin practice?", a: "It allows you to independently verify all transactions and consensus rules without trusting anyone", w: ["Nodes earn Bitcoin as a reward for operating", "Only node operators can send Bitcoin transactions", "Nodes are only needed by mining operations", "Running a node gives you voting rights on Bitcoin's future"] },
    { q: "What does 'Don't trust, verify' mean in practice?", a: "Run your own node and verify that your Bitcoin actually exists and follows the rules, rather than trusting a third party", w: ["Never trust anyone in life, only verify their identity", "Trust is more important than verification in Bitcoin", "Verification is only done by Bitcoin exchanges", "This phrase only applies to confirming transaction fees"] },

    // === SCALABILITY ===
    { q: "Why did the Bitcoin community reject increasing the base block size as a scaling solution?", a: "It would compromise decentralization by making it expensive for ordinary users to run full nodes", w: ["Larger blocks were technically impossible to implement", "The community unanimously wanted larger blocks but Satoshi said no", "Increasing block size has no effect on scalability", "Block size increases were approved but the code was lost"] },
    { q: "How does Bitcoin's layered scaling approach mirror the internet's design?", a: "Like TCP/IP provides a secure base layer with HTTP/HTTPS on top, Bitcoin's base layer settles value while upper layers handle speed and functionality", w: ["Bitcoin doesn't use layers like the internet does", "The internet has only one layer like Bitcoin should", "Layers weaken the underlying protocol's security", "The internet was designed to be a single monolithic system"] },

    // === PSYCHOLOGY & ORANGE-PILLING ===
    { q: "Why do Bitcoiners say 'the price is the least interesting thing about Bitcoin'?", a: "Bitcoin's underlying technology, philosophy, and monetary properties are transformative regardless of short-term price movements", w: ["Because Bitcoin's price never changes", "Because no one actually cares about making money", "Because the price is set by the government", "Because Bitcoin is a charity project, not an investment"] },
    { q: "What does it mean when Bitcoiners say 'every bitcoiner buys at the price they deserve'?", a: "People adopt Bitcoin when they've done enough research to understand it — delaying study delays adoption at lower prices", w: ["Rich people get to buy Bitcoin at lower prices", "Bitcoin's price is different for each buyer", "Miners set individual prices for each customer", "The government assigns Bitcoin prices based on merit"] },

    // === CENSORSHIP RESISTANCE ===
    { q: "What makes Bitcoin truly censorship-resistant compared to traditional payment systems?", a: "No single entity can prevent a valid transaction from being included in a block — miners compete to include any fee-paying transaction", w: ["Banks can reverse Bitcoin transactions when ordered by courts", "Bitcoin has a content moderation team that reviews transactions", "Only approved merchants can receive Bitcoin payments", "Government firewalls effectively prevent all Bitcoin transactions"] },
    { q: "How does Bitcoin protect against financial deplatforming?", a: "Self-custodied Bitcoin cannot be frozen, seized, or restricted by any institution regardless of political pressure", w: ["Bitcoin accounts can be frozen by contacting Bitcoin support", "Financial deplatforming is not a real problem that exists", "Banks can always access Bitcoin wallets through legal requests", "Bitcoin provides no protection against account restrictions"] },

    // === BITCOIN VS TRADITIONAL FINANCE ===
    { q: "Why is a 3% credit card fee more significant than most people realize?", a: "It's an invisible tax on the entire economy that disproportionately impacts small businesses and gets passed to consumers through higher prices", w: ["3% is too small to have any economic impact", "Credit card fees only affect credit card companies", "Merchants never pass these fees to consumers", "Bitcoin transactions always cost more than 3%"] },
    { q: "How does Bitcoin's settlement finality differ from traditional banking?", a: "Bitcoin transactions are truly final and irreversible after sufficient confirmations, unlike bank transfers which can be reversed for months", w: ["Bank transfers are more final than Bitcoin transactions", "Bitcoin transactions can be reversed within 30 days", "Both systems have identical settlement finality", "Settlement finality is irrelevant in modern finance"] },
    { q: "Why do Bitcoiners say 'fiat currency is the real Ponzi scheme'?", a: "Fiat requires perpetual growth and new debt to service existing debt, while early holders' purchasing power is continuously diluted", w: ["Fiat currency is backed by tangible assets, unlike Bitcoin", "The comparison is entirely baseless and illogical", "Ponzi scheme is a compliment in financial terminology", "Only Bitcoin meets the definition of a Ponzi scheme"] },

    // === DIFFICULTY ADJUSTMENT ===
    { q: "Why is the difficulty adjustment considered one of Bitcoin's most elegant features?", a: "It automatically balances mining profitability and block production speed regardless of computing power changes, ensuring network stability", w: ["It makes mining progressively easier so anyone can participate", "It eliminates the need for miners entirely", "It was added after Bitcoin launched as an emergency fix", "It only activates during network emergencies"] },
    { q: "What would happen to Bitcoin if a large percentage of miners suddenly stopped mining?", a: "Block times would temporarily slow, then the difficulty adjustment would reduce difficulty to restore the target 10-minute block time", w: ["Bitcoin would permanently stop working", "Transactions would become impossible forever", "The network would immediately switch to proof-of-stake", "Nothing would change — mining difficulties stays fixed"] },

    // === TAPROOT & UPGRADES ===
    { q: "How are Bitcoin protocol upgrades different from software updates at a company?", a: "Upgrades require broad consensus from the decentralized community and cannot be forced by any individual or group", w: ["Bitcoin Core developers push updates automatically to all nodes", "Satoshi still controls all updates from a secret location", "The US government approves all Bitcoin upgrades", "Updates are released monthly on a fixed schedule"] },
    { q: "Why is backward compatibility critical for Bitcoin upgrades?", a: "It ensures that non-upgraded nodes can still function and validate transactions, preventing network splits", w: ["Backward compatibility is not important for decentralized systems", "Old nodes are automatically shut down during upgrades", "Bitcoin has never maintained backward compatibility", "Backward compatibility only matters for hardware wallets"] },

    // === VOLATILITY ===
    { q: "Why do Bitcoiners argue that Bitcoin's volatility will decrease over time?", a: "As adoption grows and market capitalization increases, Bitcoin will absorb price shocks more easily, similar to how gold's volatility decreased over centuries", w: ["Volatility always increases for scarce assets", "Bitcoin is designed to become more volatile over time", "Volatility has nothing to do with market size or adoption", "Government regulations will force stable Bitcoin prices"] },
    { q: "How should Bitcoin's volatility be contextualized for new users?", a: "Short-term volatility is the price of long-term appreciation — Bitcoin has outperformed every other asset class over any 4+ year period", w: ["Volatility means Bitcoin is a scam", "Bitcoin should trade within a 1% range at all times", "Volatility only affects sellers, never buyers", "Long-term performance is irrelevant if short-term prices move"] },

    // === FUNGIBILITY & PRIVACY ===
    { q: "Why is fungibility important for money?", a: "Every unit must be interchangeable with any other unit — if some coins are 'tainted', it undermines the currency's usability as money", w: ["Fungibility means money can be converted to mushrooms", "Money does not need to be fungible to function properly", "Fungibility only matters for physical commodities", "Bitcoin is perfectly fungible with no privacy concerns"] },
    { q: "How do CoinJoin transactions improve Bitcoin's fungibility?", a: "They mix multiple users' transactions together, making it difficult to trace the origin and destination of specific coins", w: ["CoinJoin creates new Bitcoin during the mixing process", "CoinJoin is a method to increase transaction fees", "CoinJoin transactions are illegal in all countries", "CoinJoin sends coins to a centralized mixing service"] },

    // === CONSENSUS & GOVERNANCE ===
    { q: "Why is 'rough consensus' better than voting for Bitcoin governance?", a: "Voting can be gamed by wealthy entities, while rough consensus requires such overwhelming agreement that controversial changes are nearly impossible", w: ["Voting is more democratic and always produces better outcomes", "Rough consensus means only one person needs to agree", "Bitcoin uses formal parliamentary voting procedures", "Governance has no impact on Bitcoin's development"] },
    { q: "What does the UASF (User Activated Soft Fork) demonstrate about Bitcoin's power structure?", a: "Users and node operators — not miners — ultimately control Bitcoin's rules, as demonstrated during the Segwit activation", w: ["Miners have absolute control over all Bitcoin rules", "UASF was a failure that proved users have no power", "UASF is a type of mining hardware", "Only exchanges can activate soft forks"] },

    // === MISCELLANEOUS DEEP UNDERSTANDING ===
    { q: "What is the most accurate way to describe what Bitcoin is?", a: "A decentralized, permissionless, censorship-resistant monetary network secured by proof-of-work", w: ["A company that sells digital currency", "A website where you trade stocks and crypto", "A government-issued digital dollar alternative", "An app created by a Silicon Valley startup"] },
    { q: "Why do Bitcoiners say '1 BTC = 1 BTC'?", a: "To emphasize that Bitcoin's value should be measured by its properties and utility, not its fiat exchange rate", w: ["It's a mathematical equation proving Bitcoin has no value", "It means one Bitcoin can never change in dollar value", "It's confirming that Bitcoin cannot be divided", "It means you can only own exactly one Bitcoin"] },
    { q: "Why might hyperbitcoinization be considered inevitable?", a: "Bitcoin's superior monetary properties, network effects, and game theory incentivize rational adoption by all economic actors over time", w: ["A law will mandate global Bitcoin adoption", "Satoshi owns enough Bitcoin to force adoption", "All other currencies will be destroyed by a single event", "Bitcoin will become mandatory through military conquest"] },
    { q: "What does 'stacking sats' represent philosophically?", a: "The practice of consistent, disciplined accumulation of the hardest money ever created, regardless of price", w: ["Stacking physical coins in a tower formation", "A competitive game to see who can buy Bitcoin fastest", "Organizing Bitcoin exchanges in alphabetical order", "Counting how many satoshis exist on the network"] },
    { q: "Why is it said that 'Bitcoin is hope'?", a: "It provides an opt-out from a financial system that devalues savings and labor, offering a path to financial sovereignty for everyone", w: ["Because Bitcoin's logo looks like a rainbow", "It is the name of a Bitcoin charity organization", "Hope is the name of Bitcoin's lead developer", "Because Bitcoin always goes up in price without exception"] },

    // === ADDITIONAL DEEP QUESTIONS ===
    { q: "What makes Bitcoin's issuance schedule 'fair'?", a: "There was no premine, ICO, or insider allocation — anyone could mine from the first block under the same rules", w: ["Satoshi received 50% of all Bitcoin before launch", "The government verified Bitcoin's fair distribution", "Venture capitalists funded the fair distribution program", "A committee allocated coins to deserving applicants"] },
    { q: "Why do Bitcoiners compare the fiat system to a game of musical chairs?", a: "When money is printed, earlier receivers benefit while later receivers get diluted purchasing power — someone is always left holding devalued currency", w: ["Because bankers literally play musical chairs", "Because money physically moves in circles", "Because fiat money is used in the entertainment industry", "Because musical chairs is how monetary policy is decided"] },
    { q: "What is the significance of the phrase 'exit and build' in Bitcoin culture?", a: "Rather than fighting the existing financial system, Bitcoin allows people to opt out and build a parallel, superior alternative", w: ["It refers to exiting Bitcoin positions during bear markets", "It's the name of a Bitcoin mining company", "It describes the process of closing a Bitcoin exchange", "It means deleting your Bitcoin wallet and starting over"] },
    { q: "Why is verifiable scarcity more important than just scarcity?", a: "Anyone can independently verify Bitcoin's supply using a node, while other 'scarce' assets require trusting third-party claims", w: ["Verifiability has no importance for monetary assets", "All scarce assets are equally verifiable", "Only governments can verify asset scarcity", "Scarcity itself is always sufficient without verification"] },
    { q: "How does Bitcoin align incentives between savers and the monetary system?", a: "Bitcoin rewards savers with increasing purchasing power instead of punishing them with inflation as fiat systems do", w: ["Bitcoin punishes savers with transaction fees", "There is no relationship between Bitcoin and saving behavior", "Inflation is necessary and beneficial for all savers", "Bitcoin automatically spends your savings to prevent hoarding"] },
    { q: "What does 'number go up technology' refer to beyond just price?", a: "Bitcoin's fundamental properties — fixed supply, growing demand, halvings — create a structural trend toward value appreciation", w: ["A guaranteed scheme to make everyone rich quickly", "An algorithm that artificially inflates the price", "A government subsidy program for Bitcoin holders", "Price manipulation by Bitcoin whale cartels"] },
    { q: "Why is understanding Bitcoin described as a 'one way door'?", a: "Once you truly understand Bitcoin's properties and the problems it solves, you cannot unsee the flaws in the existing monetary system", w: ["Bitcoin literally prevents users from selling their coins", "The Bitcoin software locks users out of traditional banking", "It refers to a door in Bitcoin's headquarters", "Bitcoin uses irreversible encryption that traps your money"] },
    { q: "What makes Bitcoin 'antifragile'?", a: "Each attack, ban, or crisis it survives makes the network stronger and more resilient", w: ["Bitcoin breaks easily but is quickly repaired", "It is fragile but protected by insurance", "Antifragile means it never changes or adapts", "The term has no meaningful application to Bitcoin"] },
    { q: "How does separating money from state compare to separating church from state?", a: "Just as religious freedom was advanced by removing state control of religion, economic freedom is advanced by removing state control of money", w: ["Money and state have always been separate throughout history", "The state should control money just as it should control religion", "This comparison is completely inappropriate and baseless", "Separating money from state would eliminate all governments"] },
];

// Scholar state
let scholarAttemptDate = localStorage.getItem('btc_scholar_attempt_date') || '';
let scholarPassed = localStorage.getItem('btc_scholar_passed') === 'true';
let scholarTimer = null;
let scholarTimeLeft = 600; // 10 minutes in seconds
let scholarAnswers = [];
let scholarQuestions = [];

function startScholarQuest() {
    // Check if registered user
    if (typeof auth === 'undefined' || !auth.currentUser || auth.currentUser.isAnonymous) {
        if (typeof showToast === 'function') showToast('📝 You must create an account or sign in to take the Scholar Certification.');
        if (typeof showUsernamePrompt === 'function') showUsernamePrompt();
        return;
    }

    // Check if already passed
    if (scholarPassed) {
        showScholarCertificate();
        return;
    }

    // Check cooldown (failed today already)
    const today = new Date().toISOString().split('T')[0];
    if (scholarAttemptDate === today) {
        if (typeof showToast === 'function') showToast('⏰ You can retry the Scholar Certification tomorrow. Keep studying!');
        return;
    }

    // Pick 25 random questions
    const shuffled = [...SCHOLAR_POOL].sort(() => Math.random() - 0.5);
    scholarQuestions = shuffled.slice(0, 25).map(q => {
        const options = [q.a, ...q.w].sort(() => Math.random() - 0.5);
        return { q: q.q, options, answer: options.indexOf(q.a) };
    });
    scholarAnswers = new Array(25).fill(-1);
    scholarTimeLeft = 600;

    renderScholarQuest();
    startScholarTimer();
}

function renderScholarQuest() {
    const modal = document.getElementById('questModal');
    const inner = document.getElementById('questInner');

    let html = '<div class="quest-header" style="border-bottom:2px solid var(--accent);padding-bottom:20px;margin-bottom:20px;">';
    html += '<div class="quest-badge" style="background:linear-gradient(135deg,#f7931a,#ea580c);font-size:0.9rem;padding:8px 20px;">🎓 BITCOIN SCHOLAR CERTIFICATION</div>';
    html += '<h2 style="font-size:1.3rem;margin-top:12px;">Bitcoin Scholar Exam</h2>';
    html += '<p style="color:var(--text-muted);font-size:0.9rem;">25 questions · 20 correct to pass · 10 minute time limit</p>';
    html += '<div id="scholarTimer" style="font-size:1.4rem;font-weight:900;color:var(--accent);margin-top:8px;">10:00</div>';
    html += '<div id="scholarProgress" style="font-size:0.8rem;color:var(--text-faint);margin-top:4px;">0 / 25 answered</div>';
    html += '</div>';
    html += '<div class="quest-questions">';

    scholarQuestions.forEach((q, i) => {
        html += '<div class="quest-q" id="scholarQ' + i + '">';
        html += '<div class="quest-q-num">Question ' + (i + 1) + ' of 25</div>';
        html += '<div class="quest-q-text" style="font-size:0.95rem;line-height:1.5;">' + q.q + '</div>';
        html += '<div class="quest-options">';
        q.options.forEach((opt, j) => {
            html += '<button class="quest-opt" style="font-size:0.85rem;text-align:left;padding:10px 14px;" onclick="selectScholarAnswer(this,' + i + ',' + j + ')">' + opt + '</button>';
        });
        html += '</div></div>';
    });

    html += '</div>';
    html += '<button class="quest-submit" id="scholarSubmitBtn" onclick="submitScholarQuest()" disabled style="background:linear-gradient(135deg,#f7931a,#ea580c);">Submit Exam</button>';
    html += '<button class="quest-skip" onclick="cancelScholar()">Cancel</button>';

    inner.innerHTML = html;
    modal.classList.add('open');
}

function selectScholarAnswer(btn, qIdx, aIdx) {
    const siblings = btn.parentElement.querySelectorAll('.quest-opt');
    siblings.forEach(s => s.classList.remove('selected'));
    btn.classList.add('selected');
    scholarAnswers[qIdx] = aIdx;

    // Update progress
    const answered = scholarAnswers.filter(a => a >= 0).length;
    const prog = document.getElementById('scholarProgress');
    if (prog) prog.textContent = answered + ' / 25 answered';

    if (answered === 25) {
        document.getElementById('scholarSubmitBtn').disabled = false;
    }
}

function startScholarTimer() {
    if (scholarTimer) clearInterval(scholarTimer);
    scholarTimer = setInterval(() => {
        scholarTimeLeft--;
        const mins = Math.floor(scholarTimeLeft / 60);
        const secs = scholarTimeLeft % 60;
        const timerEl = document.getElementById('scholarTimer');
        if (timerEl) {
            timerEl.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
            if (scholarTimeLeft <= 60) timerEl.style.color = '#ef4444';
        }
        if (scholarTimeLeft <= 0) {
            clearInterval(scholarTimer);
            submitScholarQuest();
        }
    }, 1000);
}

async function submitScholarQuest() {
    clearInterval(scholarTimer);

    const today = new Date().toISOString().split('T')[0];
    scholarAttemptDate = today;
    localStorage.setItem('btc_scholar_attempt_date', today);

    let score = 0;
    scholarAnswers.forEach((a, i) => {
        if (a === scholarQuestions[i].answer) score++;
    });

    const passed = score >= 20;
    const modal = document.getElementById('questModal');
    const inner = document.getElementById('questInner');

    if (passed) {
        scholarPassed = true;
        localStorage.setItem('btc_scholar_passed', 'true');

        // Save to Firebase
        if (typeof db !== 'undefined' && auth.currentUser) {
            await db.collection('users').doc(auth.currentUser.uid).update({
                scholarPassed: true,
                scholarDate: today,
                scholarScore: score
            });
        }

        // Award points
        if (typeof awardPoints === 'function') {
            await awardPoints(500, '🎓 Bitcoin Scholar Certification');
        }

        // Confetti!
        if (typeof launchConfetti === 'function') launchConfetti();
        if (typeof playBadgeSound === 'function') playBadgeSound();

        inner.innerHTML = '<div style="text-align:center;padding:30px;">' +
            '<div style="font-size:4rem;margin-bottom:16px;">🎓</div>' +
            '<div style="color:#22c55e;font-size:0.8rem;text-transform:uppercase;letter-spacing:2px;font-weight:800;">Congratulations!</div>' +
            '<h2 style="color:var(--heading);margin:8px 0 16px;">Bitcoin Scholar Certified</h2>' +
            '<div style="font-size:1.3rem;font-weight:800;color:var(--accent);">' + score + ' / 25 Correct</div>' +
            '<div style="color:var(--text-muted);margin:8px 0 20px;">+500 points earned!</div>' +
            '<div style="margin-bottom:20px;">' +
            '<label style="color:var(--text-muted);font-size:0.85rem;display:block;margin-bottom:6px;">Enter your name for the certificate:</label>' +
            '<input type="text" id="certName" placeholder="Your full name" style="width:100%;max-width:300px;padding:12px 16px;background:var(--input-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:1rem;font-family:inherit;text-align:center;outline:none;">' +
            '</div>' +
            '<button onclick="downloadCertificate()" style="padding:14px 30px;background:linear-gradient(135deg,#f7931a,#ea580c);color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;">📜 Download Certificate</button>' +
            '<br><button onclick="closeQuest()" style="margin-top:12px;padding:10px 20px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.9rem;cursor:pointer;font-family:inherit;">Close</button>' +
            '</div>';
    } else {
        inner.innerHTML = '<div style="text-align:center;padding:30px;">' +
            '<div style="font-size:4rem;margin-bottom:16px;">📝</div>' +
            '<h2 style="color:var(--heading);margin:8px 0;">Not quite there yet</h2>' +
            '<div style="font-size:1.3rem;font-weight:800;color:#ef4444;margin-bottom:8px;">' + score + ' / 25 Correct</div>' +
            '<div style="color:var(--text-muted);margin-bottom:8px;">You needed 20 correct to pass.</div>' +
            '<div style="color:var(--text-muted);margin-bottom:24px;">Keep studying and try again tomorrow! You\'ll get a fresh set of 25 questions.</div>' +
            '<button onclick="closeQuest()" style="padding:14px 30px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;">Continue Learning →</button>' +
            '</div>';
    }
}

function cancelScholar() {
    clearInterval(scholarTimer);
    document.getElementById('questModal').classList.remove('open');
}

function showScholarCertificate() {
    const modal = document.getElementById('questModal');
    const inner = document.getElementById('questInner');

    inner.innerHTML = '<div style="text-align:center;padding:30px;">' +
        '<div style="font-size:4rem;margin-bottom:16px;">🎓</div>' +
        '<h2 style="color:var(--heading);margin:8px 0 16px;">You are a Bitcoin Scholar!</h2>' +
        '<div style="color:var(--text-muted);margin-bottom:20px;">You\'ve already passed the certification. Download your certificate below.</div>' +
        '<div style="margin-bottom:20px;">' +
        '<label style="color:var(--text-muted);font-size:0.85rem;display:block;margin-bottom:6px;">Enter your name for the certificate:</label>' +
        '<input type="text" id="certName" placeholder="Your full name" style="width:100%;max-width:300px;padding:12px 16px;background:var(--input-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:1rem;font-family:inherit;text-align:center;outline:none;">' +
        '</div>' +
        '<button onclick="downloadCertificate()" style="padding:14px 30px;background:linear-gradient(135deg,#f7931a,#ea580c);color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;">📜 Download Certificate</button>' +
        '<br><button onclick="closeQuest()" style="margin-top:12px;padding:10px 20px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.9rem;cursor:pointer;font-family:inherit;">Close</button>' +
        '</div>';
    modal.classList.add('open');
}

function downloadCertificate() {
    const name = document.getElementById('certName').value.trim() || 'Bitcoin Scholar';
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 850;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 1200, 850);

    // Inner border
    ctx.strokeStyle = '#f7931a';
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, 1140, 790);

    // Double border
    ctx.strokeStyle = 'rgba(247, 147, 26, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(40, 40, 1120, 770);

    // Corner decorations
    const corners = [[50,50], [1150,50], [50,800], [1150,800]];
    corners.forEach(([x, y]) => {
        ctx.fillStyle = '#f7931a';
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
    });

    // Bitcoin logo
    ctx.fillStyle = '#f7931a';
    ctx.beginPath();
    ctx.arc(600, 110, 35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('₿', 600, 124);

    // Title
    ctx.fillStyle = '#f7931a';
    ctx.font = '14px Arial';
    ctx.letterSpacing = '8px';
    ctx.fillText('CERTIFICATE OF ACHIEVEMENT', 600, 180);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 48px Georgia, serif';
    ctx.fillText('Bitcoin Scholar', 600, 240);

    // Divider line
    ctx.strokeStyle = '#f7931a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(350, 265);
    ctx.lineTo(850, 265);
    ctx.stroke();

    // "This certifies that"
    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px Georgia, serif';
    ctx.fillText('This certifies that', 600, 310);

    // Name
    ctx.fillStyle = '#f7931a';
    ctx.font = 'bold 42px Georgia, serif';
    ctx.fillText(name, 600, 370);

    // Name underline
    ctx.strokeStyle = 'rgba(247, 147, 26, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(300, 385);
    ctx.lineTo(900, 385);
    ctx.stroke();

    // Description
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '18px Georgia, serif';
    ctx.fillText('has demonstrated comprehensive understanding of', 600, 430);
    ctx.fillText('Bitcoin fundamentals, monetary properties, and principles', 600, 458);
    ctx.fillText('by successfully passing the Bitcoin Scholar Certification Exam', 600, 486);

    // Achievement line
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px Georgia, serif';
    ctx.fillText('Scoring 20 or more correct out of 25 questions under timed conditions', 600, 530);

    // Divider
    ctx.strokeStyle = 'rgba(247, 147, 26, 0.3)';
    ctx.beginPath();
    ctx.moveTo(400, 560);
    ctx.lineTo(800, 560);
    ctx.stroke();

    // Date
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px Georgia, serif';
    ctx.fillText('Awarded on ' + dateStr, 600, 600);

    // Issuer
    ctx.fillStyle = '#64748b';
    ctx.font = '14px Arial';
    ctx.fillText('Bitcoin Education Archive', 600, 650);
    ctx.fillText('bitcoineducation.quest', 600, 672);

    // Seal
    ctx.fillStyle = 'rgba(247, 147, 26, 0.15)';
    ctx.beginPath();
    ctx.arc(600, 740, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f7931a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(600, 740, 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f7931a';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('CERTIFIED', 600, 736);
    ctx.font = '11px Arial';
    ctx.fillText('BITCOIN SCHOLAR', 600, 752);

    // Download
    const link = document.createElement('a');
    link.download = 'Bitcoin_Scholar_Certificate_' + name.replace(/\s+/g, '_') + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();

    if (typeof showToast === 'function') showToast('📜 Certificate downloaded!');
}
