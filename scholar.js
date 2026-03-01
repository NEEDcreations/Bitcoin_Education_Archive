// © 2024-2026 603BTC LLC. All rights reserved.
// This code is proprietary. See LICENSE file. Do not copy or redistribute.
// =============================================
// Bitcoin Education Archive - Scholar Quests
// Two separate certifications: Properties vs Technical
// =============================================
// Separated pools
const SCHOLAR_PROPERTIES_POOL = [
  {
    "q": "What makes Bitcoin's monetary policy fundamentally different from fiat currencies?",
    "a": "Its supply schedule is fixed in code and cannot be changed by any authority",
    "w": [
      "It is backed by gold reserves held in government vaults around the world",
      "Central banks can adjust its inflation rate through periodic monetary policy meetings",
      "Governments vote on supply changes through international economic councils and agreements",
      "Its supply grows proportionally to demand through algorithmic adjustments made by a central authority"
    ]
  },
  {
    "q": "What problem does Bitcoin's proof-of-work consensus solve?",
    "a": "The double-spending problem completely without needing any trusted intermediary",
    "w": [
      "Making all transactions largely free of charge by eliminating the need for any network fees",
      "Eliminating all transaction fees through an efficient centralized processing system",
      "Making Bitcoin mining profitable enough to sustain operations without any block rewards",
      "Reducing global electricity consumption by optimizing the consensus algorithm for efficiency"
    ]
  },
  {
    "q": "Why does Bitcoin have value according to Austrian economics?",
    "a": "It possesses superior monetary properties: scarcity, durability, portability, divisibility, and fungibility",
    "w": [
      "The government declared it legal tender everywhere through an international monetary agreement",
      "It is backed by physical assets stored in a secure vault maintained by the Bitcoin Foundation",
      "A corporation guarantees its price floor through reserve funds and market-making operations",
      "Supply and demand have no effect on its value because it operates outside of traditional market dynamics"
    ]
  },
  {
    "q": "What happens to the Bitcoin block reward over time?",
    "a": "It halves approximately every 4 years until all 21 million Bitcoin are mined",
    "w": [
      "It increases each year to incentivize miners and ensure the network continues to attract sufficient computational power",
      "It stays the same forever at 50 BTC per block regardless of how many halvings have occurred",
      "The community votes on changes every decade through a formal governance process managed by Bitcoin Core developers",
      "It doubles every 4 years to keep pace with growing demand and increasing mining difficulty"
    ]
  },
  {
    "q": "Why can't Bitcoin's 21 million supply cap be changed?",
    "a": "Changing it would require near-universal consensus, and no rational participant would devalue their own holdings",
    "w": [
      "A single developer with commit access to the repository can change the supply cap at any time",
      "The SEC prevents changes to the cap through its regulatory authority over digital asset securities",
      "Satoshi Nakamoto's original computer still controls the monetary policy through an encrypted protocol",
      "It's physically impossible to modify any code because the blockchain is stored on immutable hardware"
    ]
  },
  {
    "q": "What gives Bitcoin its censorship resistance?",
    "a": "Its decentralized network of nodes that no single entity can control or shut down",
    "w": [
      "A team of moderators reviews all transactions before they are approved and added to the blockchain",
      "Government agencies approve each block through a regulatory compliance verification process",
      "One central server processes everything and distributes the results to nodes around the world",
      "Banks whitelist approved transactions and reject any that don't meet their compliance standards"
    ]
  },
  {
    "q": "Why is Bitcoin described as 'sound money'?",
    "a": "It cannot be debased, inflated, or manipulated by any central authority",
    "w": [
      "It makes a sound when you send it",
      "Central banks control its inflation rate through the same mechanisms used for traditional fiat currencies",
      "It is always worth exactly one dollar due to a built-in price stabilization mechanism in the protocol",
      "The government prints more when needed to ensure adequate liquidity in the cryptocurrency markets"
    ]
  },
  {
    "q": "What does 'Bitcoin fixes the money' mean in principle?",
    "a": "Bitcoin removes the ability of institutions to inflate away purchasing power through money printing",
    "w": [
      "Bitcoin eliminates all financial problems instantly by replacing the entire legacy financial infrastructure",
      "Bitcoin replaces all government services by providing a decentralized alternative to every public institution",
      "Bitcoin makes everyone equally wealthy by redistributing value from the rich to those who adopt it early",
      "Bitcoin eliminates the need for savings because its price appreciation makes saving unnecessary"
    ]
  },
  {
    "q": "Why is energy expenditure in Bitcoin mining a feature, not a bug?",
    "a": "It provides real-world thermodynamic security that makes the network extremely costly to attack",
    "w": [
      "It wastes energy intentionally to slow transactions down and prevent the network from being overwhelmed",
      "Energy use has no relationship to security and exists only as an unintended byproduct of the mining process",
      "It exists only because the code is inefficient and developers haven't found a way to optimize it yet",
      "It is a temporary flaw being fixed in the next major protocol update scheduled by the development team"
    ]
  },
  {
    "q": "Why is decentralization crucial for Bitcoin's value proposition?",
    "a": "It fundamentally ensures no single point of failure and prevents any entity from controlling or censoring transactions",
    "w": [
      "It makes transactions faster than centralized systems by distributing processing across multiple nodes",
      "It reduces the cost of mining equipment by allowing smaller operators to participate in block validation",
      "It allows a CEO to make quick decisions about protocol upgrades without waiting for community consensus",
      "It enables reversal of fraudulent transactions through a decentralized dispute resolution mechanism"
    ]
  },
  {
    "q": "What role do full nodes play in Bitcoin's decentralization?",
    "a": "They independently verify every transaction and block against consensus rules",
    "w": [
      "They only store a copy of the blockchain for backup purposes in case the main servers go down",
      "They increase Bitcoin's transaction speed by processing transactions in parallel across multiple cores",
      "They allow miners to bypass consensus rules when network conditions require faster block production",
      "They are operated primarily by Bitcoin Core developers who maintain the reference implementation"
    ]
  },
  {
    "q": "If a majority of miners tried to change Bitcoin's rules, what would happen?",
    "a": "Full nodes would reject their invalid blocks, and miners would waste their energy",
    "w": [
      "The rule change would automatically take effect because miners have ultimate authority over the protocol rules",
      "Bitcoin would immediately shut down because it cannot function without the approval of a majority of miners",
      "All existing Bitcoin would become worthless because the network requires miner consensus to maintain value",
      "Users would be forced to accept the new rules because nodes automatically update to match miner decisions"
    ]
  },
  {
    "q": "What distinguishes Bitcoin's governance from corporate governance?",
    "a": "Changes require rough consensus among users, developers, miners, and node operators \u2014 no one group has unilateral control",
    "w": [
      "A board of directors votes on all protocol changes and implements them through a centralized update mechanism",
      "Satoshi Nakamoto approves all updates from a secure location before they are deployed to the network",
      "The largest mining pool dictates all changes because mining power equals governance power in the protocol",
      "Whoever owns the most Bitcoin decides the rules through a stake-weighted governance voting mechanism"
    ]
  },
  {
    "q": "How does Bitcoin's scarcity differ from gold's scarcity?",
    "a": "Bitcoin's supply is mathematically fixed and verifiable, while gold's total supply is unknown and new deposits can be discovered",
    "w": [
      "Gold is scarcer than Bitcoin because the total amount of gold in the Earth's crust is precisely known",
      "Both have exactly the same supply dynamics because they are both mined and have similar extraction curves",
      "Bitcoin's supply can be increased by miners if they collectively agree to modify the block reward parameters",
      "Gold has a fixed supply cap like Bitcoin because geologists have mapped every gold deposit on Earth"
    ]
  },
  {
    "q": "What is the significance of Bitcoin's stock-to-flow ratio after the 2024 halving?",
    "a": "It surpasses gold's stock-to-flow ratio, making Bitcoin the hardest money ever created",
    "w": [
      "It becomes easier to mine more Bitcoin faster, which has been the established consensus among industry experts for years",
      "The ratio decreases as more Bitcoin are created based on the fundamental principles of distributed systems architecture",
      "It has no relationship to Bitcoin's value proposition, which has been the established consensus among industry experts for years",
      "It means Bitcoin becomes inflationary after the halving as outlined in numerous academic papers on cryptocurrency governance"
    ]
  },
  {
    "q": "What makes Bitcoin 'unforgeable'?",
    "a": "The proof-of-work system ensures that creating valid Bitcoin requires real energy expenditure that cannot be faked",
    "w": [
      "A centralized certificate authority validates and stamps each Bitcoin as authentic before it can be transferred between wallets",
      "Advanced software watermarks embedded in each transaction prevent unauthorized duplication of coins across the network",
      "Each individual Bitcoin contains a unique serial number that is verified by payment processors like Visa during transactions",
      "A sophisticated anti-counterfeiting AI system continuously monitors the entire network to detect and eliminate forged coins"
    ]
  },
  {
    "q": "Why does deflation benefit savers in a Bitcoin standard?",
    "a": "Purchasing power increases over time, rewarding those who produce more than they consume",
    "w": [
      "Deflation causes consumer prices to rise rapidly over time, which erodes the purchasing power of savings held in any currency",
      "Deflation primarily benefits people who spend their money quickly before prices drop further, rather than those who save long-term",
      "There is limited meaningful economic relationship between deflation and saving behavior because consumers spend regardless of monetary conditions",
      "Deflation can only function properly as an economic force when governments actively intervene to manage and regulate the rate of price changes"
    ]
  },
  {
    "q": "What would a successful 51% attack actually allow an attacker to do?",
    "a": "Reverse their own recent transactions (double-spend), but NOT steal others' coins or create fake Bitcoin",
    "w": [
      "Steal all Bitcoin stored in every wallet on the network by redirecting transactions to the attacker's addresses during block validation",
      "Create an unlimited number of new Bitcoin by modifying the coinbase reward in each block they produce to any amount they choose",
      "indefinitely change Bitcoin's core monetary policy including the supply cap and halving schedule by rewriting the consensus rules",
      "Access and decrypt every user's private keys through the computational power used to achieve majority hash rate control"
    ]
  },
  {
    "q": "Why does Bitcoin's security increase as its price rises?",
    "a": "Higher prices incentivize more mining, increasing the hash rate and making attacks more expensive",
    "w": [
      "The code automatically becomes more complex at higher prices when analyzed through the lens of modern financial technology frameworks",
      "More developers are hired to protect it, which is a widely documented fact in the cryptocurrency literature",
      "The government provides more security at higher valuations as outlined in numerous academic papers on cryptocurrency governance",
      "Security and price have no relationship in Bitcoin following the standard model of decentralized network economics"
    ]
  },
  {
    "q": "Why is Bitcoin's security model described as 'thermodynamic'?",
    "a": "It converts real-world energy into digital security, making attacks require equivalent real-world resources",
    "w": [
      "Bitcoin generates physical heat as a security measure, which is a widely documented fact in the cryptocurrency literature",
      "Temperature sensors protect the blockchain following the standard model of decentralized network economics",
      "Security depends on keeping servers at low temperatures when analyzed through the lens of modern financial technology frameworks",
      "Thermodynamics has nothing to do with Bitcoin's security as outlined in numerous academic papers on cryptocurrency governance"
    ]
  },
  {
    "q": "What makes Bitcoin's track record of security significant?",
    "a": "Despite being a multi-trillion dollar bounty, the protocol has never been successfully hacked since its inception",
    "w": [
      "The Bitcoin protocol has been successfully hacked on multiple occasions but the development team quickly patched vulnerabilities and recovered funds",
      "Bitcoin's security is ultimately guaranteed and backed by the United States military as part of its digital infrastructure protection mandate",
      "Major global insurance companies provide comprehensive coverage against any losses from Bitcoin protocol-level security breaches",
      "Bitcoin's market capitalization is too small and insignificant to attract the attention of sophisticated hackers and state-level actors"
    ]
  },
  {
    "q": "What fundamental problem does proof-of-stake fail to solve that proof-of-work addresses?",
    "a": "PoS cannot achieve trustless consensus without an external anchor to the physical world",
    "w": [
      "Proof-of-stake processes transactions far too quickly for the network to maintain proper synchronization across all distributed validator nodes",
      "Proof-of-stake actually uses more total electricity than proof-of-work when you factor in the energy costs of all the validator infrastructure",
      "Proof-of-work is simply an older and therefore less innovative consensus mechanism that has been made obsolete by proof-of-stake's improvements",
      "Proof-of-stake systems likely create too many new coins through staking rewards, leading to uncontrollable long-term supply inflation"
    ]
  },
  {
    "q": "Why do some argue that proof-of-stake replicates the existing financial system?",
    "a": "Those with the most capital gain the most power and rewards, similar to how traditional finance concentrates wealth",
    "w": [
      "Proof-of-stake networks use the same core programming languages and frameworks that traditional banking infrastructure relies on for operations",
      "Participating as a validator in most proof-of-stake systems requires obtaining a banking or money transmitter license from financial regulators",
      "The proof-of-stake consensus mechanism was originally invented and developed by a consortium of central banks as a controlled alternative",
      "Proof-of-stake tokens are technically classified as securities that are issued and regulated by the Federal Reserve and SEC jointly"
    ]
  },
  {
    "q": "According to the Austrian School of Economics, why does fiat money lose value over time?",
    "a": "Governments continuously increase the money supply, diluting the purchasing power of existing currency",
    "w": [
      "Money naturally decays and loses value over time just like any physical object due to the fundamental laws of entropy and thermodynamics",
      "People periodically lose confidence in their currency for no identifiable economic reason, which is what causes all historical currency failures",
      "Advances in financial technology gradually make older forms of money obsolete, which is the primary driver of fiat currency devaluation",
      "Fiat currencies actually gain purchasing power over time according to mainstream economic consensus because of productivity improvements"
    ]
  },
  {
    "q": "What does 'lowering your time preference' mean in the context of Bitcoin?",
    "a": "Valuing future rewards more highly and making long-term decisions rather than seeking instant gratification",
    "w": [
      "Spending your money as quickly as possible before inflation erodes its purchasing power, which is a rational response to monetary debasement",
      "Reducing the total amount of time you dedicate to researching and studying Bitcoin so you can focus on other financial opportunities",
      "Optimizing your Bitcoin wallet settings and transaction parameters to make payments process through the network significantly faster",
      "Adjusting your trading strategy to focus on shorter timeframes like day trading and scalping rather than long-term holding positions"
    ]
  },
  {
    "q": "How does Bitcoin act as a hedge against currency devaluation?",
    "a": "Its fixed supply and decentralized nature make it immune to the inflationary policies of any government",
    "w": [
      "Bitcoin's price is algorithmically pegged to the US dollar through a stabilization mechanism built into the protocol's consensus rules",
      "The United States government provides an implicit guarantee of Bitcoin's minimum value as part of its digital asset regulatory framework",
      "Major commercial banks offer comprehensive insurance products that protect investors against any losses in their Bitcoin holdings",
      "Bitcoin's protocol includes an automatic supply adjustment mechanism that creates or destroys coins to precisely match prevailing inflation rates"
    ]
  },
  {
    "q": "What is the significance of Bitcoin being 'bearer asset'?",
    "a": "Whoever holds the private keys has direct ownership without relying on any institution",
    "w": [
      "Bitcoin can only legally be held and transferred by licensed financial bearers who have been certified by",
      "The term bearer specifically means that Bitcoin requires a regulated bank or custodian to hold it on your behalf",
      "As a bearer instrument, Bitcoin must be physically carried between users on hardware devices because it cannot exist in purely digital form",
      "Bearer asset status is a legal designation that must be formally granted through government registration and is"
    ]
  },
  {
    "q": "Why is Bitcoin compared to 'digital real estate'?",
    "a": "There is a fixed amount of 'space' on the blockchain, and no more can ever be created",
    "w": [
      "Bitcoin's blockchain technology can be used to digitally construct and manage virtual houses and buildings in decentralized metaverse platforms",
      "Bitcoin is classified and regulated exactly like physical real property in most jurisdictions, subject to the same zoning and transfer laws",
      "Bitcoin mining operations require ownership of dedicated physical land parcels because of the cooling and infrastructure requirements involved",
      "Licensed real estate agents have expanded their services to include Bitcoin sales and transfers as part of their property transaction business"
    ]
  },
  {
    "q": "Why does Bitcoin need second-layer solutions like the Lightning Network?",
    "a": "The base layer prioritizes security and decentralization, so additional layers handle speed and scalability",
    "w": [
      "The base layer is broken and needs replacement following the standard model of decentralized network economics",
      "Lightning makes Bitcoin more decentralized following the standard model of decentralized network economics",
      "Second layers are unnecessary if you increase block size based on the fundamental principles of distributed systems architecture",
      "Bitcoin's base layer is too fast and needs to be slowed down following the standard model of decentralized network economics"
    ]
  },
  {
    "q": "How does the Lightning Network achieve near-instant transactions?",
    "a": "By creating payment channels where transactions settle between parties without broadcasting to the main chain",
    "w": [
      "By temporarily disabling Bitcoin's security and verification features during the transaction to allow for faster processing between parties",
      "By routing all Lightning payments through a separate centralized server infrastructure that processes transactions outside the blockchain",
      "By reducing Bitcoin's block time from ten minutes down to one second specifically for Lightning-enabled transactions on the network",
      "By largely eliminating the need for mining and proof-of-work validation, replacing it with instant cryptographic confirmation between nodes"
    ]
  },
  {
    "q": "Why is the phrase 'not your keys, not your coins' fundamental to Bitcoin?",
    "a": "If you don't control your private keys, a third party controls your Bitcoin and could lose, freeze, or steal them",
    "w": [
      "It's just a marketing slogan with limited practical meaning, which has been the established consensus among industry experts for years",
      "Keys are physical objects that prove Bitcoin ownership based on the fundamental principles of distributed systems architecture",
      "Only miners need to worry about key ownership following the standard model of decentralized network economics",
      "Banks can always recover lost Bitcoin regardless of keys as outlined in numerous academic papers on cryptocurrency governance"
    ]
  },
  {
    "q": "Why should Bitcoin seed phrases never be stored digitally?",
    "a": "Digital storage is vulnerable to hacking, malware, and data breaches that could expose your keys",
    "w": [
      "Digital storage in encrypted cloud services is actually the safest option available for seed phrases because it provides redundancy and backup protection",
      "Seed phrases have a built-in expiration mechanism that activates when they are stored in any digital format, rendering them useless after a set period",
      "The Bitcoin protocol includes detection mechanisms that automatically block and invalidate any seed phrases that have been stored in digital formats",
      "Creating digital copies of seed phrases generates duplicate Bitcoin on the network because each copy of the phrase creates a new set of identical coins"
    ]
  },
  {
    "q": "What is the primary purpose of Bitcoin mining?",
    "a": "To secure the network by making it computationally expensive to attack or rewrite transaction history",
    "w": [
      "The primary purpose of mining is to create as many new Bitcoin as quickly as possible in order to distribute them widely across the global economy",
      "Mining exists primarily to keep electricity companies profitable by providing consistent high-volume energy consumption as a guaranteed revenue source",
      "Mining hardware serves as specialized physical storage devices that securely contain and protect the Bitcoin held within each individual mining unit",
      "The extensive infrastructure built for Bitcoin mining primarily serves to provide reliable internet access to rural and underserved communities worldwide"
    ]
  },
  {
    "q": "How does the difficulty adjustment contribute to Bitcoin's reliability?",
    "a": "It ensures blocks are found approximately every 10 minutes regardless of how much mining power joins or leaves",
    "w": [
      "The difficulty adjustment gradually makes mining easier over time specifically to attract new miners and ensure the network continues to grow steadily",
      "Bitcoin's mining difficulty is designed to indefinitely increase over time and is unlikely to decrease, which ensures the network becomes more secure each year",
      "The difficulty level is recalculated and adjusted only once per year during a network-wide vote conducted by all active mining pool operators collectively",
      "The difficulty adjustment mechanism functions as a price stabilization tool that keeps Bitcoin's market value steady at a predetermined target level"
    ]
  },
  {
    "q": "Why is Bitcoin mining an ally in renewable energy development?",
    "a": "Miners can monetize stranded or excess energy that would otherwise be wasted, subsidizing renewable projects",
    "w": [
      "The Bitcoin protocol includes a built-in rule that only allows mining to be performed using verified renewable energy sources certified by green energy auditors",
      "Modern Bitcoin mining technology uses virtually no electricity at all thanks to breakthrough efficiency improvements in the latest generation of ASIC chips",
      "International environmental regulations now require all Bitcoin mining operations to primarily use solar power or face substantial fines and penalties",
      "The massive energy demands of Bitcoin mining actively prevent renewable energy projects from being developed by consuming all available green energy supply"
    ]
  },
  {
    "q": "What happens when the last Bitcoin is mined around 2140?",
    "a": "Miners will be incentivized solely by transaction fees to continue securing the network",
    "w": [
      "The Bitcoin network will indefinitely shut down and cease to function once the last coin is mined because there will",
      "The protocol will automatically begin creating new replacement Bitcoin through a secondary issuance mechanism to",
      "All Bitcoin miners will collectively transition to mining Ethereum and other proof-of-work cryptocurrencies once",
      "The protocol includes a built-in failsafe that automatically converts Bitcoin from proof-of-work to proof-of-stake"
    ]
  },
  {
    "q": "What does financial sovereignty mean in the context of Bitcoin?",
    "a": "The ability to store, send, and receive value without permission from or control by any third party",
    "w": [
      "Having a premium bank account with special privileges and benefits that provide enhanced access to financial services beyond what regular accounts offer",
      "Being officially granted the legal authority to print and issue your own money backed by your personal assets and guaranteed by financial institutions",
      "Having comprehensive government-backed insurance on all your investments that protects against any losses from market downturns or fraud",
      "Having the ability to reverse any financial transaction you make within a thirty-day window regardless of whether the recipient agrees to the reversal"
    ]
  },
  {
    "q": "Why is Bitcoin adoption described as a 'prisoner's dilemma' for nation-states?",
    "a": "Countries that adopt Bitcoin first gain an advantage, so rational actors are incentivized to adopt before competitors do",
    "w": [
      "most participating countries would need to adopt Bitcoin simultaneously in a coordinated agreement or the entire monetary transition would fail completely",
      "Countries that adopt Bitcoin face imprisonment-like economic sanctions from international financial organizations that oppose decentralized currencies",
      "Bitcoin's protocol is designed to penalize early adopters with progressively higher transaction fees to ensure fair distribution among latecomers",
      "Nation-states have minimal strategic or economic incentive to hold Bitcoin in their reserves because it provides no geopolitical advantage"
    ]
  },
  {
    "q": "How does Bitcoin's incentive structure prevent cheating?",
    "a": "The cost of attacking the network far exceeds any potential profit from cheating",
    "w": [
      "A centralized fraud department monitors all transactions",
      "Cheaters are identified and banned by Bitcoin's CEO when analyzed through the lens of modern financial technology frameworks",
      "Insurance covers any losses from cheating according to extensive research conducted by blockchain analysis firms",
      "Social pressure prevents all dishonest behavior, which has been the established consensus among industry experts for years"
    ]
  },
  {
    "q": "What problem did the 2008 financial crisis expose that Bitcoin was designed to solve?",
    "a": "The systemic risk of trusting centralized institutions with the global financial system",
    "w": [
      "The critical need for faster and more efficient stock trading platforms that could handle the volume of transactions during periods of market stress",
      "A severe and dangerous shortage of physical cash in circulation that prevented ordinary citizens from conducting everyday financial transactions",
      "The global lack of sufficient bank branches and physical financial infrastructure to serve the growing population's basic banking needs adequately",
      "The increasingly high cost of gold mining operations worldwide which made it impractical to maintain a gold-backed monetary system any longer"
    ]
  },
  {
    "q": "Why is the Bitcoin genesis block's embedded message significant?",
    "a": "It references a bank bailout headline, highlighting the broken financial system Bitcoin was created to address",
    "w": [
      "The embedded message contains detailed technical instructions that miners needed to follow in order to successfully mine the second block in the chain",
      "The message was randomly generated by the software as a placeholder and has no particular symbolic or political meaning in practice to the project",
      "Hidden within the genesis block message is an encoded reference to Satoshi Nakamoto's real identity that cryptographers have been trying to decode",
      "The genesis block contains a compressed copy of the entire Bitcoin source code that nodes extract during their initial blockchain synchronization"
    ]
  },
  {
    "q": "Why do Bitcoin's network effects create a 'winner-take-most' dynamic in digital money?",
    "a": "The most secure, liquid, and widely accepted monetary network attracts users exponentially, reinforcing its dominance",
    "w": [
      "All cryptocurrencies benefit equally from network effects, which is a widely documented fact in the cryptocurrency literature",
      "Network effects don't apply to digital currencies, which is a widely documented fact in the cryptocurrency literature",
      "The first-created cryptocurrency always wins regardless of properties, which is a widely documented fact in the cryptocurrency literature",
      "Government regulation determines which network wins following the standard model of decentralized network economics"
    ]
  },
  {
    "q": "How does the Lindy Effect apply to Bitcoin?",
    "a": "The longer Bitcoin survives and thrives, the longer its expected remaining lifespan becomes",
    "w": [
      "Bitcoin gets weaker and less likely to survive over time, which has been the established consensus among industry experts for years",
      "The Lindy Effect only applies to physical objects, which is a widely documented fact in the cryptocurrency literature",
      "It means Bitcoin will last exactly as long as it already has, which has been the established consensus among industry experts for years",
      "The Lindy Effect proves Bitcoin will fail soon as outlined in numerous academic papers on cryptocurrency governance"
    ]
  },
  {
    "q": "Why is the argument 'Bitcoin has no intrinsic value' flawed?",
    "a": "No money has intrinsic value \u2014 value is subjective, and Bitcoin's monetary properties make it superior to alternatives",
    "w": [
      "Bitcoin does have intrinsic value because it's backed by gold as outlined in numerous academic papers on cryptocurrency governance",
      "The argument is actually correct and Bitcoin is therefore worthless, as has been repeatedly demonstrated throughout the history of digital currencies",
      "Intrinsic value only comes from government declaration following the standard model of decentralized network economics",
      "Bitcoin has intrinsic value because servers are expensive, which has been the established consensus among industry experts for years"
    ]
  },
  {
    "q": "Why is comparing Bitcoin's energy use to a country's energy use misleading?",
    "a": "The comparison ignores that Bitcoin secures a global financial network and monetizes otherwise stranded energy",
    "w": [
      "Bitcoin actually consumes more total energy than all countries in the world combined when accounting for the full lifecycle of mining hardware production",
      "Energy comparisons between Bitcoin and countries are always accurate and helpful because they use standardized measurement methodologies across all contexts",
      "Modern Bitcoin mining has been optimized to the point where it uses virtually negligible energy at all thanks to quantum computing breakthroughs",
      "A country's total energy consumption is largely irrelevant to any comparison because nations and monetary networks serve fundamentally different purposes"
    ]
  },
  {
    "q": "Why does 'Bitcoin is too slow for payments' miss the bigger picture?",
    "a": "Bitcoin's base layer is a settlement network optimized for security, while payment layers like Lightning handle daily transactions",
    "w": [
      "Bitcoin is actually faster than Visa at all times because it processes transactions across a global network simultaneously",
      "Slow transactions are a permanent unfixable flaw that will ultimately prevent Bitcoin from achieving mainstream adoption",
      "Speed is the only metric that matters for money because users will always choose the fastest payment option",
      "No solution for Bitcoin's speed limitations exists or is being developed by any team in the Bitcoin ecosystem"
    ]
  },
  {
    "q": "Why don't altcoins disprove Bitcoin's scarcity?",
    "a": "Creating another cryptocurrency doesn't affect Bitcoin's supply, just as starting a new company doesn't dilute Apple's shares",
    "w": [
      "Altcoins do actually reduce Bitcoin's scarcity",
      "There is no difference between Bitcoin and any altcoin since they all use similar blockchain technology and serve the same purpose",
      "All cryptocurrencies share the same supply cap because they all derive from Bitcoin's original codebase and parameters",
      "Bitcoin's code automatically adjusts for new altcoins by reducing its own supply proportionally to maintain scarcity"
    ]
  },
  {
    "q": "Why is 'Bitcoin is only used by criminals' a misleading statement?",
    "a": "Cash is used far more for illicit activity, and Bitcoin's transparent blockchain actually makes it poor for crime",
    "w": [
      "Bitcoin is indeed primarily used for criminal activity",
      "Criminals prefer Bitcoin because it's largely anonymous and law enforcement has no way to trace transactions",
      "No criminals have ever used traditional banking systems because they require identification to open accounts",
      "Law enforcement cannot trace Bitcoin transactions because the blockchain encrypts all sender and receiver information"
    ]
  },
  {
    "q": "What is a UTXO and why does it matter?",
    "a": "An Unspent Transaction Output \u2014 the fundamental unit of Bitcoin ownership that tracks which coins can be spent",
    "w": [
      "UTXO stands for Universal Transaction eXchange Object and refers to a specific type of hardware wallet manufactured primarily by Ledger company",
      "A UTXO is a government-issued tracking number assigned to each Bitcoin transaction for the purpose of tax reporting and regulatory compliance",
      "UTXO is the name of the specific mining algorithm that Bitcoin uses to create new coins through the proof-of-work computational process each block",
      "UTXO is a decentralized social media platform built on the Bitcoin blockchain specifically designed for cryptocurrency traders to share market analysis"
    ]
  },
  {
    "q": "What is a Bitcoin 'fork' and why do most forks fail?",
    "a": "A fork copies Bitcoin's code but cannot replicate its network effect, security, and decentralization",
    "w": [
      "Forks are improvements that always replace the original Bitcoin, which has been the established consensus among industry experts for years",
      "Forks cannot exist because Bitcoin's code is patented following the standard model of decentralized network economics",
      "Every fork automatically gains Bitcoin's full hash rate, which is a widely documented fact in the cryptocurrency literature",
      "Forks are approved by Bitcoin's governing board, which is a widely documented fact in the cryptocurrency literature"
    ]
  },
  {
    "q": "Why does Bitcoin use a 10-minute block time instead of faster?",
    "a": "It provides sufficient time for blocks to propagate globally, maintaining decentralization and reducing orphaned blocks",
    "w": [
      "Ten minutes was a random choice with no technical basis following the standard model of decentralized network economics",
      "Faster block times would increase security as outlined in numerous academic papers on cryptocurrency governance",
      "The block time will be reduced to one minute in the next upgrade following the standard model of decentralized network economics",
      "Block time has no effect on network performance as outlined in numerous academic papers on cryptocurrency governance"
    ]
  },
  {
    "q": "How can Bitcoin impact human rights in authoritarian countries?",
    "a": "It provides an uncensorable financial tool that cannot be seized or frozen by oppressive governments",
    "w": [
      "Authoritarian governments can easily block all Bitcoin use, which is a widely documented fact in the cryptocurrency literature",
      "Bitcoin only works in democratic countries as outlined in numerous academic papers on cryptocurrency governance",
      "Human rights organizations oppose Bitcoin according to extensive research conducted by blockchain analysis firms",
      "Bitcoin requires government permission to use in all countries following the standard model of decentralized network economics"
    ]
  },
  {
    "q": "Why might a Bitcoin standard discourage war?",
    "a": "Governments can no longer print money to fund wars \u2014 they must tax citizens directly, increasing political accountability",
    "w": [
      "Bitcoin includes a built-in anti-war protocol mechanism in its consensus rules that automatically blocks any transactions associated with military spending",
      "Throughout human history, wars have rarely been meaningfully funded through money printing or currency debasement by any government or empire",
      "All Bitcoin users are required to digitally sign a cryptographic non-aggression pact as part of the network's terms of service during wallet setup",
      "The United Nations has been granted administrative control over the Bitcoin network specifically to prevent it from being used to fund armed conflicts"
    ]
  },
  {
    "q": "How does Bitcoin empower the unbanked population globally?",
    "a": "Anyone with internet access can participate in the financial system without needing bank accounts, credit checks, or identification",
    "w": [
      "It requires a bank account and credit score to use following the standard model of decentralized network economics",
      "Only citizens of developed nations can access Bitcoin, as has been repeatedly demonstrated throughout the history of digital currencies",
      "Bitcoin requires a physical bank branch to operate based on the fundamental principles of distributed systems architecture",
      "You need government-issued ID to create a Bitcoin wallet, as has been repeatedly demonstrated throughout the history of digital currencies"
    ]
  },
  {
    "q": "Why do Bitcoin maximalists argue that altcoins are unnecessary?",
    "a": "Bitcoin's base layer plus additional protocol layers can serve all monetary and smart contract use cases without the trade-offs altcoins make",
    "w": [
      "Bitcoin maximalists are generally uninformed about modern blockchain technology advances and dismiss altcoin innovations out of ignorance rather than analysis",
      "Altcoins and Bitcoin serve largely different market segments and use cases, so they complement each other rather than compete for the same users",
      "Bitcoin maximalism is fundamentally a religious-like belief system with no logical or economic basis that relies on faith rather than technical understanding",
      "Bitcoin's protocol is indefinitely frozen and cannot be upgraded to add any new features, which is why alternative blockchain projects are necessary"
    ]
  },
  {
    "q": "What fundamental flaw do critics identify in Ethereum's monetary policy?",
    "a": "Its monetary policy has been changed multiple times, demonstrating it has no credible commitment to a fixed supply",
    "w": [
      "Ethereum has more strict monetary policy than Bitcoin, which has been the established consensus among industry experts for years",
      "Ethereum's monetary policy is identical to Bitcoin's following the standard model of decentralized network economics",
      "Monetary policy is irrelevant for smart contract platforms when analyzed through the lens of modern financial technology frameworks",
      "Ethereum's supply is fixed at 100 million according to extensive research conducted by blockchain analysis firms"
    ]
  },
  {
    "q": "Why is the existence of thousands of cryptocurrencies not a threat to Bitcoin?",
    "a": "Bitcoin's value comes from its unique properties \u2014 decentralization, security, immutability \u2014 which no altcoin has replicated",
    "w": [
      "All cryptocurrencies are essentially interchangeable with one another since they all use blockchain technology and serve the same fundamental purpose",
      "The creation of more cryptocurrency projects increases the total combined value of all crypto assets including Bitcoin through broader market awareness",
      "In technology markets, competition from newer and more innovative competitors always eventually destroys the first mover's dominant market position",
      "As the cryptocurrency market matures, all altcoin projects will eventually merge their blockchains with Bitcoin through automated cross-chain integration"
    ]
  },
  {
    "q": "How does a savings-oriented culture (low time preference) benefit civilization?",
    "a": "It incentivizes long-term thinking, capital accumulation, investment in the future, and intergenerational wealth building",
    "w": [
      "Low time preference encourages immediate spending, as has been repeatedly demonstrated throughout the history of digital currencies",
      "Savings-oriented cultures experience faster inflation, as has been repeatedly demonstrated throughout the history of digital currencies",
      "Long-term thinking has no benefit over short-term thinking based on the fundamental principles of distributed systems architecture",
      "Saving money harms economic growth in all cases according to extensive research conducted by blockchain analysis firms"
    ]
  },
  {
    "q": "What is the relationship between hard money and artistic/cultural flourishing?",
    "a": "Sound money incentivizes long-term creation and patronage, as the value of savings is preserved over time",
    "w": [
      "Hard money has no effect on culture or art following the standard model of decentralized network economics",
      "Inflationary money produces better art through urgency, which has been the established consensus among industry experts for years",
      "Art can only flourish under government-issued currency according to extensive research conducted by blockchain analysis firms",
      "Cultural achievements require money printing to fund them according to extensive research conducted by blockchain analysis firms"
    ]
  },
  {
    "q": "How does proof-of-work mirror the physical world's concept of value?",
    "a": "Just as physical value requires energy to create, Bitcoin requires energy expenditure to produce, anchoring digital value to real-world cost",
    "w": [
      "There is no connection between energy and value, as has been repeatedly demonstrated throughout the history of digital currencies",
      "Digital value should be free to create without cost, which has been the established consensus among industry experts for years",
      "Proof-of-work wastes energy without creating value as outlined in numerous academic papers on cryptocurrency governance",
      "Physical world concepts don't apply to digital systems according to extensive research conducted by blockchain analysis firms"
    ]
  },
  {
    "q": "Why is each Bitcoin halving economically significant?",
    "a": "It reduces new supply entering the market while demand typically grows, creating supply shock pressure",
    "w": [
      "Each halving event doubles the total circulating supply of Bitcoin by releasing additional coins from a reserve pool held by the protocol for this purpose",
      "Historical data clearly shows that halvings have rarely had any measurable effect on Bitcoin's market dynamics, price action, or investor sentiment",
      "During each halving event, the block reward given to miners is doubled as an incentive to continue securing the network despite increasing difficulty",
      "Halving events are purely a technical detail that only matters for mining operations and has minimal impact on the value held by Bitcoin investors"
    ]
  },
  {
    "q": "What does 'Don't trust, verify' mean in practice?",
    "a": "Run your own node and verify that your Bitcoin actually exists and follows the rules, rather than trusting a third party",
    "w": [
      "Never trust anyone in life, only verify their identity based on the fundamental principles of distributed systems architecture",
      "Trust is more important than verification in Bitcoin, as has been repeatedly demonstrated throughout the history of digital currencies",
      "Verification is only done by Bitcoin exchanges when analyzed through the lens of modern financial technology frameworks",
      "This phrase only applies to confirming transaction fees, which has been the established consensus among industry experts for years"
    ]
  },
  {
    "q": "Why did the Bitcoin community reject increasing the base block size as a scaling solution?",
    "a": "It would compromise decentralization by making it expensive for ordinary users to run full nodes",
    "w": [
      "Larger blocks were technically impossible to implement when analyzed through the lens of modern financial technology frameworks",
      "The community unanimously wanted larger blocks but Satoshi said no, as has been repeatedly demonstrated throughout the history of digital currencies",
      "Increasing block size has no effect on scalability based on the fundamental principles of distributed systems architecture",
      "Block size increases were approved but the code was lost according to extensive research conducted by blockchain analysis firms"
    ]
  },
  {
    "q": "How does Bitcoin's layered scaling approach mirror the internet's design?",
    "a": "Like TCP/IP provides a secure base layer with HTTP/HTTPS on top, Bitcoin's base layer settles value while upper layers handle speed and functionality",
    "w": [
      "Bitcoin doesn't use layers like the internet does, as has been repeatedly demonstrated throughout the history of digital currencies",
      "The internet has only one layer like Bitcoin should following the standard model of decentralized network economics",
      "Layers weaken the underlying protocol's security as outlined in numerous academic papers on cryptocurrency governance",
      "The internet was designed to be a single monolithic system as outlined in numerous academic papers on cryptocurrency governance"
    ]
  },
  {
    "q": "What makes Bitcoin truly censorship-resistant compared to traditional payment systems?",
    "a": "No single entity can prevent a valid transaction from being included in a block \u2014 miners compete to include any fee-paying transaction",
    "w": [
      "Banks can reverse Bitcoin transactions when ordered by courts, which has been the established consensus among industry experts for years",
      "Bitcoin has a content moderation team that reviews transactions, which is a widely documented fact in the cryptocurrency literature",
      "Only approved merchants can receive Bitcoin payments according to extensive research conducted by blockchain analysis firms",
      "Government firewalls effectively prevent all Bitcoin transactions when analyzed through the lens of modern financial technology frameworks"
    ]
  },
  {
    "q": "How does Bitcoin protect against financial deplatforming?",
    "a": "Self-custodied Bitcoin cannot be frozen, seized, or restricted by any institution regardless of political pressure",
    "w": [
      "Bitcoin accounts can be frozen by contacting Bitcoin support, which is a widely documented fact in the cryptocurrency literature",
      "Financial deplatforming is not a real problem that exists according to extensive research conducted by blockchain analysis firms",
      "Banks can always access Bitcoin wallets through legal requests, which is a widely documented fact in the cryptocurrency literature",
      "Bitcoin provides no protection against account restrictions based on the fundamental principles of distributed systems architecture"
    ]
  },
  {
    "q": "Why is a 3% credit card fee more significant than most people realize?",
    "a": "It's an invisible tax on the entire economy that disproportionately impacts small businesses and gets passed to consumers through higher prices",
    "w": [
      "A 3% processing fee is far too small a percentage to have any meaningful or measurable economic impact on businesses or the broader consumer economy",
      "Credit card processing fees primarily affect the credit card companies themselves and are fully absorbed without any cost being transferred to merchants",
      "Merchants universally absorb credit card processing fees as a cost of doing business and never pass these additional charges along to their customers",
      "Bitcoin on-chain transactions consistently cost significantly more than 3% of the transaction value, making them more expensive than credit card payments"
    ]
  },
  {
    "q": "How does Bitcoin's settlement finality differ from traditional banking?",
    "a": "Bitcoin transactions are truly final and irreversible after sufficient confirmations, unlike bank transfers which can be reversed for months",
    "w": [
      "Bank transfers are more final than Bitcoin transactions, which is a widely documented fact in the cryptocurrency literature",
      "Bitcoin transactions can be reversed within 30 days, which has been the established consensus among industry experts for years",
      "Both systems have identical settlement finality according to extensive research conducted by blockchain analysis firms",
      "Settlement finality is irrelevant in modern finance, which is a widely documented fact in the cryptocurrency literature"
    ]
  },
  {
    "q": "Why do Bitcoiners say 'fiat currency is the real Ponzi scheme'?",
    "a": "Fiat requires perpetual growth and new debt to service existing debt, while early holders' purchasing power is continuously diluted",
    "w": [
      "Fiat currency is backed by tangible assets, unlike Bitcoin, which is a widely documented fact in the cryptocurrency literature",
      "The comparison is entirely baseless and illogical, as has been repeatedly demonstrated throughout the history of digital currencies",
      "Ponzi scheme is a compliment in financial terminology, which has been the established consensus among industry experts for years",
      "Only Bitcoin meets the definition of a Ponzi scheme, as has been repeatedly demonstrated throughout the history of digital currencies"
    ]
  },
  {
    "q": "What would happen to Bitcoin if a large percentage of miners suddenly stopped mining?",
    "a": "Block times would temporarily slow, then the difficulty adjustment would reduce difficulty to restore the target 10-minute block time",
    "w": [
      "If a large percentage of miners suddenly stopped mining, Bitcoin would indefinitely cease to function because the network requires continuous mining to operate",
      "Transactions would become significantly and potentially impossible because the network has no mechanism to recover from a significant loss of mining power",
      "The Bitcoin protocol includes an emergency failsafe that automatically switches the network from proof-of-work to proof-of-stake if mining power drops sharply",
      "largely nothing would change about network performance because Bitcoin's mining difficulty is indefinitely fixed and does not adjust to hash rate changes"
    ]
  },
  {
    "q": "How are Bitcoin protocol upgrades different from software updates at a company?",
    "a": "Upgrades require broad consensus from the decentralized community and cannot be forced by any individual or group",
    "w": [
      "Bitcoin Core developers push updates automatically to all nodes according to extensive research conducted by blockchain analysis firms",
      "Satoshi still controls all updates from a secret location, as has been repeatedly demonstrated throughout the history of digital currencies",
      "The US government approves all Bitcoin upgrades based on the fundamental principles of distributed systems architecture",
      "Updates are released monthly on a fixed schedule according to extensive research conducted by blockchain analysis firms"
    ]
  },
  {
    "q": "Why is backward compatibility critical for Bitcoin upgrades?",
    "a": "It ensures that non-upgraded nodes can still function and validate transactions, preventing network splits",
    "w": [
      "Backward compatibility is not important for decentralized systems when analyzed through the lens of modern financial technology frameworks",
      "Old nodes are automatically shut down during upgrades based on the fundamental principles of distributed systems architecture",
      "Bitcoin has rarely maintained backward compatibility, which is a widely documented fact in the cryptocurrency literature",
      "Backward compatibility only matters for hardware wallets, which is a widely documented fact in the cryptocurrency literature"
    ]
  },
  {
    "q": "Why do Bitcoiners argue that Bitcoin's volatility will decrease over time?",
    "a": "As adoption grows and market capitalization increases, Bitcoin will absorb price shocks more easily, similar to how gold's volatility decreased over centuries",
    "w": [
      "Volatility always increases for scarce assets as outlined in numerous academic papers on cryptocurrency governance",
      "Bitcoin is designed to become more volatile over time according to extensive research conducted by blockchain analysis firms",
      "Volatility has nothing to do with market size or adoption following the standard model of decentralized network economics",
      "Government regulations will force stable Bitcoin prices according to extensive research conducted by blockchain analysis firms"
    ]
  },
  {
    "q": "How should Bitcoin's volatility be contextualized for new users?",
    "a": "Short-term volatility is the price of long-term appreciation \u2014 Bitcoin has outperformed every other asset class over any 4+ year period",
    "w": [
      "Significant price volatility is a clear and reliable indicator that Bitcoin is fundamentally a scam because legitimate financial assets maintain stable values",
      "Bitcoin should ideally trade within a narrow 1% price range at all times, and any deviation beyond this indicates serious structural problems with the network",
      "Price volatility primarily affects people who are selling Bitcoin and has minimal impact whatsoever on buyers or long-term holders of the asset",
      "An asset's long-term performance track record is largely irrelevant to evaluating its quality if it experiences significant short-term price fluctuations"
    ]
  },
  {
    "q": "How do CoinJoin transactions improve Bitcoin's fungibility?",
    "a": "They mix multiple users' transactions together, making it difficult to trace the origin and destination of specific coins",
    "w": [
      "CoinJoin creates new Bitcoin during the mixing process, which is a widely documented fact in the cryptocurrency literature",
      "CoinJoin is a method to increase transaction fees based on the fundamental principles of distributed systems architecture",
      "CoinJoin transactions are illegal in all countries based on the fundamental principles of distributed systems architecture",
      "CoinJoin sends coins to a centralized mixing service as outlined in numerous academic papers on cryptocurrency governance"
    ]
  },
  {
    "q": "Why is 'rough consensus' better than voting for Bitcoin governance?",
    "a": "Voting can be gamed by wealthy entities, while rough consensus requires such overwhelming agreement that controversial changes are nearly impossible",
    "w": [
      "Voting is more democratic and always produces better outcomes following the standard model of decentralized network economics",
      "Rough consensus means only one person needs to agree based on the fundamental principles of distributed systems architecture",
      "Bitcoin uses formal parliamentary voting procedures based on the fundamental principles of distributed systems architecture",
      "Governance has no impact on Bitcoin's development, which has been the established consensus among industry experts for years"
    ]
  },
  {
    "q": "What is the most accurate way to describe what Bitcoin is?",
    "a": "A decentralized, permissionless, censorship-resistant monetary network secured by proof-of-work",
    "w": [
      "A technology company headquartered in San Francisco that sells digital currency products and manages the blockchain infrastructure on behalf of all users",
      "A financial website and trading platform where users can buy, sell, and trade stocks, cryptocurrencies, and other digital assets in real time",
      "A government-issued digital alternative to the US dollar that was created by the Federal Reserve to modernize the American payment infrastructure",
      "A mobile application created by a well-funded Silicon Valley startup that provides cryptocurrency wallet and payment services to retail consumers"
    ]
  },
  {
    "q": "Why do Bitcoiners say '1 BTC = 1 BTC'?",
    "a": "To emphasize that Bitcoin's value should be measured by its properties and utility, not its fiat exchange rate",
    "w": [
      "It's a mathematical equation proving Bitcoin has no value when analyzed through the lens of modern financial technology frameworks",
      "It means one Bitcoin is unlikely to change in dollar value following the standard model of decentralized network economics",
      "It's confirming that Bitcoin cannot be divided, as has been repeatedly demonstrated throughout the history of digital currencies",
      "It means you can only own exactly one Bitcoin based on the fundamental principles of distributed systems architecture"
    ]
  },
  {
    "q": "What does 'stacking sats' represent philosophically?",
    "a": "The practice of consistent, disciplined accumulation of the hardest money ever created, regardless of price",
    "w": [
      "The practice of stacking physical commemorative Bitcoin coins in a decorative tower formation as a visual representation of your cryptocurrency holdings",
      "A competitive online game within the Bitcoin community where participants race to see who can purchase the most Bitcoin in the shortest amount of time",
      "A method of organizing and categorizing Bitcoin exchanges and trading platforms in alphabetical order to create a comprehensive industry reference directory",
      "A network monitoring practice that involves precisely counting the exact number of satoshis currently in existence across all wallets on the blockchain"
    ]
  },
  {
    "q": "Why is it said that 'Bitcoin is hope'?",
    "a": "It provides an opt-out from a financial system that devalues savings and labor, offering a path to financial sovereignty for everyone",
    "w": [
      "The phrase refers to the visual similarity between Bitcoin's orange logo and a rainbow, which has traditionally been a universal symbol of hope and promise",
      "Bitcoin Is Hope is specifically the name of a well-known Bitcoin charity organization that provides financial education and services to developing nations",
      "Hope is the pseudonymous name of Bitcoin's current lead developer who took over maintenance of the project after Satoshi Nakamoto's departure in 2011",
      "The phrase means that Bitcoin always goes up in price without any exception or correction, guaranteeing profits for every person who purchases it"
    ]
  },
  {
    "q": "Why do Bitcoiners compare the fiat system to a game of musical chairs?",
    "a": "When money is printed, earlier receivers benefit while later receivers get diluted purchasing power \u2014 someone is always left holding devalued currency",
    "w": [
      "The comparison exists because investment bankers at major financial institutions literally play musical chairs as a team-building exercise during corporate retreats",
      "Fiat currency physically moves in predictable circular patterns through the economy, flowing from consumers to businesses and back again in a closed loop",
      "The comparison arose because fiat money has historically been the primary currency used within the global entertainment industry for paying performers",
      "The Federal Reserve and other central banks use a musical chairs-style rotation system to determine which committee members make monetary policy decisions"
    ]
  },
  {
    "q": "What is the significance of the phrase 'exit and build' in Bitcoin culture?",
    "a": "Rather than fighting the existing financial system, Bitcoin allows people to opt out and build a parallel, superior alternative",
    "w": [
      "It refers to exiting Bitcoin positions during bear markets, as has been repeatedly demonstrated throughout the history of digital currencies",
      "It's the name of a Bitcoin mining company according to extensive research conducted by blockchain analysis firms",
      "It describes the process of closing a Bitcoin exchange following the standard model of decentralized network economics",
      "It means deleting your Bitcoin wallet and starting over as outlined in numerous academic papers on cryptocurrency governance"
    ]
  },
  {
    "q": "Why is verifiable scarcity more important than just scarcity?",
    "a": "Anyone can independently verify Bitcoin's supply using a node, while other 'scarce' assets require trusting third-party claims",
    "w": [
      "The ability to verify scarcity has limited practical importance for monetary assets because market prices already reflect all available information about supply limitations",
      "All scarce assets including gold, diamonds, real estate, and Bitcoin are equally and trivially verifiable through standard auditing processes and certification",
      "Only government agencies and their authorized representatives have the legal authority and technical capability to verify the true scarcity of any asset class",
      "Scarcity by itself is always largely sufficient for establishing monetary value, and independent verification provides no additional benefit or confidence"
    ]
  },
  {
    "q": "How does Bitcoin align incentives between savers and the monetary system?",
    "a": "Bitcoin rewards savers with increasing purchasing power instead of punishing them with inflation as fiat systems do",
    "w": [
      "Bitcoin punishes savers with transaction fees, which has been the established consensus among industry experts for years",
      "There is no relationship between Bitcoin and saving behavior, which has been the established consensus among industry experts for years",
      "Inflation is necessary and beneficial for all savers based on the fundamental principles of distributed systems architecture",
      "Bitcoin automatically spends your savings to prevent hoarding as outlined in numerous academic papers on cryptocurrency governance"
    ]
  },
  {
    "q": "What does 'number go up technology' refer to beyond just price?",
    "a": "Bitcoin's fundamental properties \u2014 fixed supply, growing demand, halvings \u2014 create a structural trend toward value appreciation",
    "w": [
      "A guaranteed financial scheme built into Bitcoin's code that ensures every participant becomes wealthy quickly through algorithmic price appreciation mechanisms",
      "A sophisticated hidden algorithm embedded in Bitcoin's protocol that artificially inflates the market price by creating synthetic demand from automated trading bots",
      "A classified government subsidy program that provides financial support to Bitcoin holders through tax credits and direct payments funded by central bank reserves",
      "An organized price manipulation scheme operated by coordinated Bitcoin whale cartels who collude to artificially drive up prices for their collective benefit"
    ]
  },
  {
    "q": "What makes Bitcoin 'antifragile'?",
    "a": "Each attack, ban, or crisis it survives makes the network stronger and more resilient",
    "w": [
      "Bitcoin's network breaks down easily during periods of high stress but has a dedicated rapid response team that",
      "Bitcoin is inherently fragile and vulnerable to disruption but is protected by comprehensive insurance policies",
      "The concept of antifragility specifically means that a system never changes, adapts",
      "The term antifragile is a literary concept from philosophy that has limited meaningful or practical application to"
    ]
  },
  {
    "q": "How does separating money from state compare to separating church from state?",
    "a": "Just as religious freedom was advanced by removing state control of religion, economic freedom is advanced by removing state control of money",
    "w": [
      "Money and state have always been separate throughout history based on the fundamental principles of distributed systems architecture",
      "The state should control money just as it should control religion, as has been repeatedly demonstrated throughout the history of digital currencies",
      "This comparison is largely inappropriate and baseless, which has been the established consensus among industry experts for years",
      "Separating money from state would eliminate all governments following the standard model of decentralized network economics"
    ]
  },
  {
    "q": "In Bitcoin's difficulty adjustment, what is the maximum factor by which the difficulty can change in a single adjustment period (2,016 blocks)?",
    "a": "A factor of 4 (either 4x increase or 1/4 reduction)",
    "w": [
      "A factor of 2 (either 100% increase or 50% reduction)",
      "A factor of 10 (either 10x increase or 1/10 reduction)",
      "There is no limit to how much difficulty can change in one period",
      "A maximum of 21% change to match the total supply cap"
    ]
  },
  {
    "q": "What is 'Gresham's Law' and how does it relate to Bitcoin in a high-inflation environment?",
    "a": "Bad money drives out good money; people spend inflationary fiat and hoard scarce Bitcoin",
    "w": [
      "Good money drives out bad money; people use Bitcoin for everything and reject fiat entirely",
      "Supply and demand are always equal; Bitcoin's price is a perfect reflection of its utility",
      "The velocity of money increases with scarcity; the more Bitcoin you have, the more you spend",
      "Innovation happens at the edges; Bitcoin will only be adopted once fiat completely collapses"
    ]
  },
  {
    "q": "What is 'Replace-By-Fee' (RBF) and why is it used?",
    "a": "It allows a user to replace an unconfirmed transaction with a new one that pays a higher fee",
    "w": [
      "It allows a user to cancel a transaction after it has been confirmed by six blocks",
      "It automatically reduces the fees paid to miners when the network is not congested",
      "It replaces the Bitcoin in a transaction with an equivalent amount of another cryptocurrency",
      "It prevents miners from including any transactions that do not pay a minimum required fee"
    ]
  },
  {
    "q": "What is a 'Dust Attack' and what is its primary goal?",
    "a": "Sending tiny amounts of BTC to many addresses to deanonymize users through output linking",
    "w": [
      "Sending so many transactions that the entire network crashes and stops working",
      "Attempting to create more than 21 million Bitcoin through fractional reserve mining",
      "Inflating the price of Bitcoin by buying small amounts on many different exchanges",
      "Hacking hardware wallets by sending them malicious scripts disguised as transactions"
    ]
  },
  {
    "q": "What is the 'Genesis Block' message and which UK newspaper did it reference?",
    "a": "The Times; 'The Times 03/Jan/2009 Chancellor on brink of second bailout for banks'",
    "w": [
      "The Guardian; 'The Guardian 01/Jan/2009 New Year brings hope for digital currency'",
      "The Daily Mail; 'Daily Mail 03/Jan/2009 Bank crisis deepens as economy collapses'",
      "The Sun; 'The Sun 10/Jan/2009 Satoshi launches Bitcoin to save the world from debt'",
      "The Financial Times; 'FT 03/Jan/2009 Gold prices surge as trust in banking fails'"
    ]
  },
  {
    "q": "What is the 'Coinbase Transaction' in a Bitcoin block?",
    "a": "The very first transaction in every block, used by the miner to claim the block reward and fees",
    "w": [
      "A transaction that can only be sent from the Coinbase exchange to a private wallet",
      "The transaction that records the total number of users active on the network in that block",
      "A special type of transaction that does not require any signature to be valid",
      "The transaction that distributes the block reward equally among all nodes on the network"
    ]
  },
  {
    "q": "What is the 'Difficulty' of a hash and how is it related to the 'Target'?",
    "a": "Difficulty is a relative measure of how hard it is to find a hash below a certain Target number",
    "w": [
      "Difficulty and Target are exactly the same number used for different purposes by nodes",
      "Difficulty is how much energy is used; Target is how much Bitcoin is earned as a reward",
      "Target is the number of miners on the network; Difficulty is the total hash rate they produce",
      "Difficulty is determined by the price; Target is determined by the total volume of transactions"
    ]
  },
  {
    "q": "What is 'CoinJoin' and how does it improve Bitcoin privacy?",
    "a": "A technique where multiple users combine their transactions into one, breaking the link between inputs and outputs",
    "w": [
      "A process where multiple Bitcoin transactions are encrypted into a single 256-bit hash",
      "A way to send Bitcoin without using the internet by joining together via satellite links",
      "An upgrade that hides the total amount of Bitcoin being sent in every transaction",
      "Connecting your wallet to multiple exchanges simultaneously to hide your trading activity"
    ]
  },
  {
    "q": "What is 'Gresham's Law' for and how does it apply to Bitcoin?",
    "a": "Bad money (fiat) is spent, good money (Bitcoin) is hoarded; people prefer holding the scarcer asset",
    "w": [
      "Inflation is good for the economy as it encourages spending and investment",
      "Bitcoin will eventually replace the dollar because it is faster and cheaper to use",
      "Every new technology goes through a cycle of high expectations and then disillusionment",
      "The price of an asset will always revert to its long-term average value over time"
    ]
  },
  {
    "q": "What is the 'Halving' and how often does it occur?",
    "a": "An event every 210,000 blocks (~4 years) where the block reward for miners is cut in half",
    "w": [
      "An event every year where the total number of Bitcoin is reduced by 50%",
      "A process where the code is updated every four years to fix any security vulnerabilities",
      "A meeting of the top Bitcoin developers to decide on the monetary policy for the next decade",
      "The time when every Bitcoin user receives a 'halving' badge in their digital wallet"
    ]
  },
  {
    "q": "What is a 'Cold Wallet' (Cold Storage)?",
    "a": "A Bitcoin wallet that is never connected to the internet, providing maximum security against hacks",
    "w": [
      "A wallet that is kept in a physical freezer to protect it from heat-related damage",
      "A new type of wallet that only works in cold climates like the Arctic or Antarctic",
      "A wallet that only has a small amount of Bitcoin in it for everyday spending",
      "The term for a wallet that has not been used for more than five years by a user"
    ]
  },
  {
    "q": "What is the 'Public Key' and 'Private Key' relationship in Bitcoin?",
    "a": "The Private Key is used to sign transactions; the Public Key (and address) is used to receive them",
    "w": [
      "The Public Key is your password for the site; the Private Key is your username",
      "The Public Key is kept secret; the Private Key is shared with everyone to prove ownership",
      "The Private Key is for buying Bitcoin; the Public Key is for spending it on the site",
      "They are exactly the same number used for different purposes by the Bitcoin network"
    ]
  },
  {
    "q": "What is 'Fiat Currency'?",
    "a": "Money that has value only because a government declares it is legal tender (e.g., USD, Euro)",
    "w": [
      "A type of cryptocurrency that is fast but not very secure compared to Bitcoin",
      "The process for converting Bitcoin into cash at a local ATM or bank branch",
      "A new form of digital money that is backed by real estate and physical gold",
      "The term for when the price of Bitcoin drops significantly in a short period of time"
    ]
  },
  {
    "q": "What is 'Bitcoin's Inflation Rate' primarily determined by?",
    "a": "The fixed issuance schedule (block reward) and the periodic halving events every 4 years",
    "w": [
      "The total amount of money that people spend using Bitcoin every single day",
      "The price of Bitcoin on major exchanges compared to the US dollar and other currencies",
      "The number of new users who join the Bitcoin network every month from around the world",
      "The Federal Reserve and other central banks collectively deciding on a global target"
    ]
  },
  {
    "q": "What is the 'Whitepaper' and why is it important?",
    "a": "The 9-page document by Satoshi Nakamoto that first described how Bitcoin would work",
    "w": [
      "A set of rules for how to mine Bitcoin efficiently using renewable energy sources",
      "A list of all the early Bitcoin companies that have been around since 2009",
      "The first printed list of all the transactions ever made on the Bitcoin blockchain",
      "A guide for newcomers on how to buy their first fraction of a Bitcoin on an exchange"
    ]
  },
  {
    "q": "What is the 'Mempool'?",
    "a": "A 'waiting room' for unconfirmed transactions where they sit before being included in a block",
    "w": [
      "A new type of mining pool that focus on small miners and independent operations",
      "The total pool of Bitcoin that has ever been mined since the network began in 2009",
      "A place where users can go to swap their Bitcoin for other digital assets instantly",
      "An archive of all the deleted transactions that were never confirmed by the network"
    ]
  },
  {
    "q": "What is 'Difficulty Adjustment' and how often does it happen?",
    "a": "A process every 2,016 blocks (~2 weeks) that ensures blocks are found on average every 10 minutes",
    "w": [
      "An annual meeting where developers vote on how hard it should be to mine Bitcoin",
      "A daily update to the price of Bitcoin based on supply and demand on major exchanges",
      "A process that happens every block to ensure that only the fastest miners can win a reward",
      "A mechanism that automatically burns Bitcoin when there are too many transactions on the network"
    ]
  },
  {
    "q": "What is the 'Lightning Network' primarily used for?",
    "a": "Instantly and cheaply sending small amounts of Bitcoin (sats) anywhere in the world",
    "w": [
      "Storing large amounts of Bitcoin for 10+ years as a long-term investment strategy",
      "Mining Bitcoin more efficiently by using a specialized second layer for block production",
      "Automatically converting Bitcoin into gold and shipping it to your local bank branch",
      "Increasing the total size of the Bitcoin blockchain by storing more data in each block"
    ]
  },
  {
    "q": "What is 'Self-Custody' and why is it emphasized in Bitcoin?",
    "a": "Holding your own private keys so that no bank or company can control or freeze your money",
    "w": [
      "Selling all your Bitcoin once the price reaches a certain predetermined target",
      "Using a service like Coinbase to hold your Bitcoin for you so you don't have to worry",
      "A process where multiple people share a single wallet to save on network transaction fees",
      "Recording all your Bitcoin purchases in a physical notebook for personal tax purposes"
    ]
  },
  {
    "q": "What is 'HODL' and where did the term originate?",
    "a": "A misspelling of 'HOLD' in a 2013 forum post that became a mantra for long-term saving",
    "w": [
      "A German word that means 'to store value' in a long-term savings account",
      "An acronym for 'He Only Day-trades Lately' used by critics of Bitcoin speculators",
      "A term from a popular movie about the future of digital money and centralized banks",
      "A name of a famous Bitcoin miner who never sold any of his rewards since 2009"
    ]
  },
  {
    "q": "What is 'UTXO' and what does it represent?",
    "a": "Unspent Transaction Output; a chunk of Bitcoin that exists on the blockchain and can be spent",
    "w": [
      "Universal Trade Xo; a new protocol for swapping Bitcoin for other digital assets",
      "Underlying Terminal X-change Order; a system for processing high-volume trades",
      "The term for a Bitcoin transaction that has failed and been returned to the sender",
      "An archive of every single public key that has ever received a Bitcoin payment"
    ]
  },
  {
    "q": "What is '21 Million' and why is it significant?",
    "a": "The absolute maximum number of Bitcoin that will ever exist, making it a scarce asset",
    "w": [
      "The number of people who were active on the network when the price reached $1,000",
      "The total amount of Bitcoin that is currently held by Satoshi Nakamoto's wallet",
      "The number of blocks that must be mined before the next halving event in 2028",
      "A goal set by the United Nations for the total global adoption of digital currency"
    ]
  },
  {
    "q": "What is 'Proof of Work' (PoW)?",
    "a": "A consensus mechanism where miners spend energy to secure the network and confirm blocks",
    "w": [
      "A way to prove that you have worked for at least 40 hours a week to earn your Bitcoin",
      "A process where nodes vote on which transactions are valid using their social reputation",
      "A technical requirement that requires all Bitcoin users to submit a valid ID once a year",
      "A mechanism that automatically rewards users for making posts on social media about Bitcoin"
    ]
  },
  {
    "q": "What is the 'Genesis Block'?",
    "a": "The very first block of the Bitcoin blockchain, mined on January 3, 2009",
    "w": [
      "The block that will be mined in 2140 once the total supply of 21 million is reached",
      "A special type of block that contains no transactions and is used only for testing",
      "The name of the company that was the first to accept Bitcoin for physical goods in 2010",
      "A backup copy of the entire blockchain that is stored on a satellite for security"
    ]
  },
  {
    "q": "What is 'Satoshi Nakamoto'?",
    "a": "The pseudonymous creator of Bitcoin who disappeared from the internet in 2011",
    "w": [
      "The name of the first computer that was used to mine Bitcoin in California in 2008",
      "A Japanese word that means 'digital gold' and 'decentralized future' altogether",
      "The organization that manages the development of the Bitcoin Core software today",
      "The hero of a popular science fiction book about the collapse of the global banking system"
    ]
  },
  {
    "q": "What is 'Bitcoin Core'?",
    "a": "The main software implementation of Bitcoin that most nodes on the network run",
    "w": [
      "A group of elite developers who have the final word on all Bitcoin protocol changes",
      "A new hardware wallet that is designed and manufactured by the Bitcoin Foundation",
      "The term for the base layer of the blockchain, not including any second-layer solutions",
      "An educational program for university students who want to learn how to code Bitcoin"
    ]
  },
  {
    "q": "What is 'The Bitcoin Standard' and what does it argue?",
    "a": "A book by Saifedean Ammous arguing that Bitcoin is the best form of money ever created",
    "w": [
      "A set of international regulations that govern how Bitcoin is traded on major exchanges",
      "The technical specifications for the next version of the Bitcoin protocol, due in 2030",
      "A document that outlines the environmental standards for Bitcoin mining operations globally",
      "The name of the first Bitcoin exchange that was launched in the United States in 2012"
    ]
  },
  {
    "q": "What is 'FUD' and what are some common examples in Bitcoin?",
    "a": "Fear, Uncertainty, and Doubt; common claims like 'Bitcoin is for criminals' or 'it's a bubble'",
    "w": [
      "Future Universal Digital; a term used to describe the inevitable adoption of Bitcoin",
      "Financial Utility Discovery; a process for finding new use cases for the Bitcoin network",
      "A type of advanced encryption that is used to protect high-value Bitcoin transactions",
      "The term for when a user forgets their seed phrase and loses access to their Bitcoin wallet"
    ]
  },
  {
    "q": "What is 'Stock-to-Flow' (S2F)?",
    "a": "A model that values Bitcoin based on its scarcity compared to its annual production rate",
    "w": [
      "A way to calculate the total amount of energy that is used to mine one Bitcoin",
      "The process for moving Bitcoin from a centralized exchange to a private hardware wallet",
      "A trading strategy that involves buying Bitcoin at a low price and selling it at a high price",
      "A measure of how many new users are joining the Bitcoin network every single month"
    ]
  },
  {
    "q": "What is 'Thiers' Law'?",
    "a": "The opposite of Gresham's Law; people will eventually only accept 'good' money as payment",
    "w": [
      "The more people use a network, the more valuable it becomes to every individual user",
      "As a technology develops, its price should drop as it becomes more efficient and common",
      "No currency can last more than 100 years before failing due to inflation and debt",
      "Bitcoin is inevitable because it is the most efficient form of energy transfer ever created"
    ]
  },
  {
    "q": "What is 'Gresham's Law' for and how does it relate to Bitcoin?",
    "a": "People spend fiat and keep Bitcoin; scarce assets are hoarded while inferior ones are spent",
    "w": [
      "Innovation happens when there is no regulation; Bitcoin is the ultimate innovation",
      "Supply and demand are the only factors that matter for the price of any asset globally",
      "Government debt will eventually lead to the collapse of all fiat currencies in the world",
      "The price of Bitcoin is a reflection of the total energy that has been used to mine it"
    ]
  },
  {
    "q": "What is the 'Block Size Limit' and why is it a topic of debate?",
    "a": "The limit on how much data can be in a block, affecting speed and decentralization",
    "w": [
      "The total number of Bitcoin that can be mined in a single block by any miner",
      "The maximum number of users who can be active on the network at any one time",
      "The maximum price that a Bitcoin can reach before it is considered 'too expensive' for users",
      "A regulation that limits the number of Bitcoin exchanges that can operate in one country"
    ]
  },
  {
    "q": "The question",
    "a": "The correct answer",
    "w": [
      "Distractor 1",
      "Distractor 2",
      "Distractor 3",
      "Distractor 4"
    ]
  },
  {
    "q": "In the '184 Billion BTC' bug of 2010, why did the Bitcoin software fail to detect the illegal transaction initially?",
    "a": "The code checked the sum of outputs using a signed 64-bit integer, which overflowed to a negative value when the sum became too large",
    "w": [
      "Satoshi Nakamoto intentionally included the bug as a test of the community's response time",
      "The network was under a coordinated 51% attack that prevented nodes from communicating with each other",
      "The block height was so low that most consensus rules had not yet been active on the blockchain",
      "The bug was only present in the GUI and did not actually affect the underlying protocol of the network"
    ]
  },
  {
    "q": "What is the primary thermodynamic security implication of the difficulty adjustment algorithm (DAA) in Bitcoin?",
    "a": "It ensures that the cost of rewriting history scales with global energy availability, preventing the system from being overwhelmed by computational advances",
    "w": [
      "It minimizes the total amount of energy that miners must spend to verify a block",
      "It forces miners to use specifically renewable energy sources to maintain high difficulty",
      "It increases transaction speed by reducing the time between blocks as more energy is used",
      "It prevents miners from earning too much Bitcoin at any single point in time"
    ]
  },
  {
    "q": "What is 'Thiers' Law' and how does it predict the final stage of Bitcoin adoption?",
    "a": "Good money (Bitcoin) eventually stops being hoarded and becomes the only money accepted as people refuse 'bad' money (fiat) entirely",
    "w": [
      "Inflation is the primary driver of technological innovation in a global economy",
      "A network's value is determined solely by the number of active users it has",
      "Energy will eventually become the primary currency of the world, replacing money",
      "Bitcoin will only be adopted once its price reaches one million dollars per coin"
    ]
  },
  {
    "q": "What is 'UTXO Management' and why is it important for users concerned with long-term transaction fees?",
    "a": "Consolidating small UTXOs during low-fee periods to prevent high future costs and potential 'unspendable' dust",
    "w": [
      "Deleting old UTXOs from the blockchain to save space on your computer's hard drive",
      "Connecting your UTXOs to a centralized bank account to earn interest in Bitcoin",
      "Allowing a miner to choose which of your UTXOs they want to use for a block reward",
      "Converting UTXOs into tokens that can be traded on other non-Bitcoin blockchains"
    ]
  },
  {
    "q": "What is the 'Double-Spend Problem' and how does Bitcoin's proof-of-work consensus solve it without a third party?",
    "a": "The risk of spending the same digital token twice; solved by requiring a cumulative hash rate to re-write chronological history",
    "w": [
      "The problem of having too many people trying to spend Bitcoin at the same time",
      "The issue with transaction fees being charged for both sending and receiving money",
      "A bug where a user's balance is accidentally doubled when they receive a payment",
      "The technical difficulty of creating only 21 million Bitcoin without any extras"
    ]
  },
  {
    "q": "What is 'Mining Centralization' and why is the geographical distribution of hash rate a security concern?",
    "a": "The risk that a single government or entity could seize control of a majority of hash rate in their region to censor transactions",
    "w": [
      "The process of moving all mining rigs to a single central server located in Iceland",
      "A regulation that requires all miners to be licensed and registered with the Bitcoin Foundation",
      "The fact that most Bitcoin is mined by people who live in the center of the world",
      "The risk that a single person could own more than 50% of the total 21 million Bitcoin"
    ]
  },
  {
    "q": "What is 'CPFP' (Child Pays For Parent) and when is it used instead of RBF?",
    "a": "Adding a high-fee transaction that spends a UTXO from an unconfirmed parent transaction to motivate miners to confirm both",
    "w": [
      "A program where Bitcoin users can donate a portion of their fees to help new users",
      "A technique for splitting a block reward between a miner and their pool participants",
      "A way to automatically reduce the fee of a transaction if it hasn't been confirmed for an hour",
      "A regulation that prevents children from opening Bitcoin wallets without parental consent"
    ]
  },
  {
    "q": "What is the 'Timechain' and why do some Bitcoiners prefer this term over 'Blockchain'?",
    "a": "It emphasizes the protocol's primary innovation: establishing a shared, chronological arrow of time in a decentralized environment",
    "w": [
      "It refers to a new type of Bitcoin that only works on devices with a physical clock",
      "It is the name of the organization that was the first to mine Bitcoin in 2009",
      "It describes the process of timing how long it takes for a transaction to be confirmed",
      "It is a marketing term used to make Bitcoin sound faster and more modern to investors"
    ]
  },
  {
    "q": "What is 'Satoshi's Vision' in the context of the Blocksize Wars, and why is it a controversial label?",
    "a": "A marketing term used by those who wanted a hard fork to increase block size, claimed to align with the creator's original intent",
    "w": [
      "An actual vision Satoshi Nakamoto had about the future of digital currency in 2008",
      "A feature in Bitcoin Core that allows users to see through the eyes of other nodes",
      "The name of a popular Bitcoin game where users race to find the Genesis Block",
      "A charity project funded by Satoshi Nakamoto's early mining rewards to help kids"
    ]
  },
  {
    "q": "What is 'The Lightning Network Onion Routing' and which protocol is it based on?",
    "a": "Sphinx; it allows intermediate nodes to only see their immediate predecessor and successor in a payment path",
    "w": [
      "Tor; it routes all payments through a network of volunteer computers to hide the sender's IP",
      "SHA-256; it encrypts the payment amounts with a one-way function that cannot be reversed",
      "RSA; it uses public-key encryption to ensure only the recipient can see the payment secret",
      "ECDSA; it requires every routing node to sign the payment packet before it can be moved"
    ]
  },
  {
    "q": "In the context of UTXOs, what is 'Dust' and why do some users choose to leave it unspent?",
    "a": "Outputs whose value is less than the cost to spend them; spending them results in a net loss of Bitcoin",
    "w": [
      "Tiny fragments of Bitcoin that were found in the very first block mined by Satoshi Nakamoto",
      "A type of malware that targets hardware wallets by sending them tiny amounts of fake Bitcoin",
      "The term for transactions that have been confirmed by nodes but not yet included in a block",
      "The leftover fragments of private keys that remain after a wallet has been deleted from a phone"
    ]
  },
  {
    "q": "What is 'The Blockchain Trilemma' and does Bitcoin solve it perfectly?",
    "a": "The trade-off between Security, Scalability, and Decentralization; Bitcoin prioritizes Security and Decentralization",
    "w": [
      "The problem of having only 21 million Bitcoin for a world with 8 billion people; yes, perfectly",
      "The technical difficulty of using Bitcoin for both small and large payments at the same time; yes",
      "The risk of the network being hacked by quantum computers, regulators, and banks; yes, perfectly",
      "The issue of transaction fees being too high, too low, or non-existent; yes, it solves this"
    ]
  },
  {
    "q": "What is 'The LND Breach Remedy' and how does it deter theft on the Lightning Network?",
    "a": "A transaction that allows a victim to claim all funds in a channel if their partner broadcasts an old state",
    "w": [
      "A legal process where the victim can sue the thief in a decentralized Bitcoin court",
      "An automatic refund of all transaction fees if a payment fails to reach its destination",
      "A feature that locks the thief's hardware wallet for 24 hours if they are caught cheating",
      "A way to reverse a Lightning payment by contacting the network's lead developer"
    ]
  },
  {
    "q": "What is 'UTXO Selection' and why is it a critical part of privacy and fee management for advanced wallets?",
    "a": "Choosing which specific coins to spend to minimize fees (fewer inputs) and avoid linking sensitive addresses (privacy)",
    "w": [
      "Selecting which mining pool will process your transaction to ensure it is confirmed within ten minutes",
      "Choosing between different versions of the Bitcoin software to run on your home node",
      "Identifying the most profitable day of the week to send Bitcoin based on historical price charts",
      "Connecting your wallet to multiple decentralized exchanges to find the best trading fee"
    ]
  },
  {
    "q": "What is 'The Lightning Network Gossip Protocol' used for?",
    "a": "Disseminating information about channel openings, node capabilities, and routing fees across the network",
    "w": [
      "Hiding the identities of Lightning users from state-level actors through peer-to-peer gossip",
      "Connecting Lightning wallets to social media platforms to allow for identity-based payments",
      "Allowing users to chat with each other anonymously about the current price of Bitcoin",
      "Providing a decentralized way to vote on protocol upgrades for the Lighting Network"
    ]
  },
  {
    "q": "What is 'The Hashrate Floor' and how does it relate to Bitcoin's economic survival during a bear market?",
    "a": "The point at which mining efficiency meets electricity costs; the DAA ensures mining remains possible even if price drops",
    "w": [
      "The minimum price that Bitcoin must reach for the network to continue producing blocks",
      "The total amount of energy that is required to reach the 21 million supply goal",
      "A new regulation that requires all miners to have at least 1,000 ASIC miners to operate",
      "The point at which all Bitcoin users must stop selling their coins to prevent a price crash"
    ]
  },
  {
    "q": "What is 'The Block Reward' and what percentage of it is currently made up of transaction fees on average?",
    "a": "The new BTC issued plus fees; fees currently make up a small but growing percentage (typically 1-10%)",
    "w": [
      "The total amount of Bitcoin that is mined in one year; transaction fees are currently 50% of this",
      "The prize for winning a Bitcoin trivia game; transaction fees are not included in the reward",
      "The fee that users pay to exchanges to buy Bitcoin; it is not related to the mining process",
      "The total profit a miner makes after paying for electricity; fees are always 100% of this"
    ]
  },
  {
    "q": "Who is 'Gavin Andresen' and what was his role in the early development of Bitcoin?",
    "a": "A software developer who was chosen by Satoshi Nakamoto to be the project's lead maintainer in 2010",
    "w": [
      "The founder of the first Bitcoin exchange in the United States and the creator of the xpub",
      "A cryptographer who invented the proof-of-work algorithm used by Bitcoin mining hardware",
      "A government agent who was hired to audit the Bitcoin codebase and find any hidden bugs",
      "The first person to buy a physical goods with Bitcoin\u2014two pizzas for 10,000 BTC in 2010"
    ]
  },
  {
    "q": "What is 'The Lightning Network Invoice' and why is it generally for one-time use?",
    "a": "It includes a payment hash for a specific secret; reusing it can lead to funds being stolen via state replication",
    "w": [
      "It is a physical bill that is sent to your home address; reusing it is considered a form of fraud",
      "It is an encrypted version of your public key; reusing it makes your wallet address public to everyone",
      "It is a digital token that expires after 60 seconds; reusing it results in the token being burned",
      "It is a request for a transaction fee; reusing it means you pay the fee multiple times for one payment"
    ]
  },
  {
    "q": "What is 'The Genesis Block Nonce' and what is notable about its value in block 0?",
    "a": "2083236893; it is purely a data value found during mining to produce the specific genesis hash",
    "w": [
      "0; Satoshi Nakamoto did not have to mine the first block because he created the network rules",
      "21000000; it represents the total supply of Bitcoin that will ever be mined by the network",
      "1; it represents the first person who ever ran the Bitcoin software on a personal computer",
      "The nonce in block 0 is kept secret and can only be revealed by a node with admin privileges"
    ]
  },
  {
    "q": "Who is 'Nick Szabo' and what was his 'Bit Gold' proposal's relationship to Bitcoin?",
    "a": "A cryptographer who proposed Bit Gold in 1998, which featured PoW and difficulty targets similar to Bitcoin",
    "w": [
      "The first person to sell Bitcoin for USD and the creator of the first cryptocurrency exchange",
      "A government official who tried to ban Bitcoin in 2011 because of its lack of a central CEO",
      "A software engineer who was hired by Gavin Andresen to help fix the 184 billion BTC bug",
      "The name of the character in the first ever Bitcoin transaction\u2014he received 10 BTC from Satoshi"
    ]
  },
  {
    "q": "What is 'The Mempool.space' and why is it a vital tool for Bitcoin users?",
    "a": "An open-source block explorer and visualizer for the mempool; used to estimate current transaction fees",
    "w": [
      "A decentralized exchange where users can trade their Bitcoin for space-related digital assets",
      "A physical museum in El Salvador that is dedicated to the history of the Bitcoin network",
      "A social media platform for miners where they can share tips on how to find blocks faster",
      "A specialized hardware wallet that only works when it is connected to a Bitcoin node"
    ]
  },
  {
    "q": "What is 'UTXO Age' and how does it relate to the 'HODL Waves' indicator?",
    "a": "The time since a UTXO was last moved; HODL Waves visualize the changing distribution of these ages over time",
    "w": [
      "The total number of years since a user first opened their Bitcoin wallet address",
      "A measure of how many block confirmations a transaction has received since it was confirmed",
      "The time it takes for a miner to find a block after receiving a new list of transactions",
      "A regulation that requires all UTXOs older than 10 years to be verified by a central bank"
    ]
  },
  {
    "q": "What is 'The Lightning Network Onion Packet' structure and how many bytes does it typically consume?",
    "a": "1300 bytes; it includes HMACs, ephemeral keys, and hop-specific payloads for up to 20 nodes",
    "w": [
      "1024 bytes; it is a compressed version of a standard Bitcoin block header used for mobile",
      "80 bytes; it is exactly the same size as a block header to make it invisible to network nodes",
      "256 bytes; it and the digital signature are the only two pieces of data in a Lighting transaction",
      "1 MB; it consumes an entire block's worth of space to ensure the payment is truly anonymous"
    ]
  },
  {
    "q": "What is 'The UTXO Set' and why is it stored in RAM by most Bitcoin nodes?",
    "a": "The collection of all unspent outputs; it must be quickly accessible to verify that a new transaction is valid",
    "w": [
      "The list of all users currently active on the network; it is stored in RAM to speed up chat features",
      "The archive of all transaction fees ever paid to miners; it is stored in RAM for tax-reporting purposes",
      "The list of all node IP addresses; it is stored in RAM to maintain a stable P2P connection to peers",
      "The backup copy of the whitepaper; it is stored in RAM to ensure the node follows the original rules"
    ]
  },
  {
    "q": "What is 'UTXO Staking' and is it a feature of the Bitcoin protocol?",
    "a": "No; staking is a Proof-of-Stake feature, while Bitcoin uses Proof-of-Work to verify transactions with energy",
    "w": [
      "Yes; it was added in 2021 as part of the Taproot upgrade to reward long-term Bitcoin holders",
      "Yes; users can stake their UTXOs in a node to earn 21% interest annually in new Bitcoin rewards",
      "No; UTXO stands for Unspent Transaction Output, which is a type of wallet that does not support staking",
      "Yes; it is a mechanism used by miners to increase their chance of finding a new block by 5%"
    ]
  },
  {
    "q": "What is 'The LND Watchtower' and how does it protect Lightning users who are offline?",
    "a": "A third-party service that monitors the blockchain for channel breaches and broadcasts justice transactions for you",
    "w": [
      "A physical tower in Switzerland where the Lightning Network's main servers are stored and protected",
      "A new type of hardware wallet that has a built-in cellular link to stay connected to nodes at all times",
      "A group of elite miners who monitor the mempool for fake Lightning payments and delete them automatically",
      "A regulation that requires all Lightning users to check their wallet at least once every 24 hours"
    ]
  },
  {
    "q": "Who is 'Luke Dashjr' and what is he fundamentally known for in the Blocksize War history?",
    "a": "A Bitcoin developer who advocated for keeping the block size small (300KB proposal) to maintain decentralization",
    "w": [
      "The person who founded the first Bitcoin exchange in the world and then sold it to a group of banks",
      "A cryptographer who invented the first hardware wallet and proposed the 21 million supply limit for BTC",
      "A government agent who was hired by the SEC to investigate the identity of Satoshi Nakamoto in 2011",
      "The first person to mine 100 Bitcoin in a single day using an ASIC mining rig he built in his garage"
    ]
  },
  {
    "q": "What is 'The UTXO Set' size and how does it affect the RAM requirements of a full node?",
    "a": "It contains all unspent outputs; the larger it grows, the more RAM the node needs to maintain fast validation",
    "w": [
      "It is always exactly 21 GB; it has no effect on the RAM requirements of a node since it is stored on disk",
      "It is the total number of Bitcoin users; the more users join, the more nodes must be built by miners",
      "It is the list of all mining pool rewards; it is only stored by nodes that are currently mining Bitcoin",
      "It is a backup copy of the whitepaper; it is only loaded into RAM when the node is performing an update"
    ]
  },
  {
    "q": "What is 'UTXO Privacy' and why is 'Address Reuse' discouraged in the Bitcoin community?",
    "a": "Linking multiple transactions to a single owner; reuse makes it trivial for chain analysis to Deanonymize a user",
    "w": [
      "It increases the total amount of Bitcoin that a person owns; reuse is discouraged to prevent wealth concentration",
      "It makes a transaction 12% slower; reuse is discouraged to ensure the network stays fast and efficient",
      "It encrypts the entire blockchain; reuse is discouraged because it creates too much heat for mining hardware",
      "It is a new type of address starting with 'bc3'; reuse is discouraged because it's not compatible with legacy nodes"
    ]
  },
  {
    "q": "What is 'The Lightning Network Path Probability' and how does it affect routing successful payments?",
    "a": "The uncertainty of channel liquidity; nodes must guess which routes currently have enough capacity to move funds",
    "w": [
      "The likelihood that a Lightning payment will be converted into gold; it affects the total price of a coffee",
      "The probability that a node will be hacked by a bank; it affects the total security of the network tip",
      "The chance that the 21 million supply limit will be changed; it affects the long-term price of Bitcoin",
      "The likelihood that a miner will find a block in under ten minutes; it affects the Lightning routing speed"
    ]
  },
  {
    "q": "Who is 'Szabo' and what is 'Smart Contracts' in the context of his early 1990s crypto proposals?",
    "a": "Nick Szabo; he proposed protocols that automatically execute terms of a contract using cryptographic code",
    "w": [
      "The person who founded the first Bitcoin gift shop and sold smart contracts printed on physical paper",
      "A cryptographer who proposed the 21 million supply limit for BTC and invented the first hardware signer",
      "A government agent who was hired by the Federal Reserve to build a digital version of the US dollar",
      "The first person to use a smart contract to buy a car using Bitcoin in California in 2012"
    ]
  },
  {
    "q": "What is 'UTXO Splitting' and why might a Lightning node operator perform it before opening channels?",
    "a": "Breaking a large UTXO into smaller ones to ensure it has enough 'change' for multiple channel openings",
    "w": [
      "Splitting a private key into 13 pieces and hiding them in different physical locations for security",
      "Selling halves of your Bitcoin for gold and silver tokens that can be traded on non-Btc networks",
      "Requesting that a miner splits your transaction into 2-3 blocks for better fee averages across the week",
      "Deleting half of your blockchain database to save space on your computer's RAM during a sync"
    ]
  },
  {
    "q": "What is 'The Lightning Network Path Fee' and how is it typically structured for routing nodes?",
    "a": "Base fee (fixed sats) + proportional fee (part-per-million of the amount routed)",
    "w": [
      "A flat fee of 21 sats for every routing attempt regardless of the total Bitcoin amount sent",
      "A monthly subscription fee that routing nodes must pay to the Bitcoin Foundation to operate",
      "The fee that the recipient pays to the miner who finds the block containing their Lightning invoice",
      "A 100% tax on all Routing fees that is automatically burned and removed from the total supply"
    ]
  },
  {
    "q": "What is 'The Lightning Network Onion Routing' payload size and how many hops can it support?",
    "a": "Varies depending on implementation, but typically supports up to 20 hops (nodes) in a single path",
    "w": [
      "Exactly 21 hops to match the supply limit; each hop consumes exactly uno MB of data",
      "One hop only; Bitcoin lightning payments must be sent directly to the recipient's node",
      "Unlimited hops; the routing payload grows in size for every node the payment passes through",
      "Five hops; this limit was proposed but rejected by the community in 2017 to improve privacy"
    ]
  },
  {
    "q": "What is 'The Satoshi' and how many significant figures are in its representation on the blockchain?",
    "a": "The smallest unit of Bitcoin; 8 significant figures (decimal places) are used in its calculation",
    "w": [
      "The name of the lead developer of Bitcoin Core; he has zero significant figures by choice",
      "A commemorative token released in 2010; it has 21 significant figures to mark the supply goal",
      "The term for a person who mines more than one block a day; they have no representation in code",
      "A new type of mining hardware created by Bitmain; it has 256 decimal places for precision"
    ]
  },
  {
    "q": "What is 'The Difficulty Adjustment' period in blocks and how long does it typically take in weeks?",
    "a": "2,016 blocks; typically takes exactly 2 weeks if blocks are found every 10 minutes",
    "w": [
      "21,000 blocks; typically takes 21 weeks to mark the supply limit and ensure network stability",
      "1,000 blocks; typically takes one week for faster response to changes in global mining hash rate",
      "50,000 blocks; typically takes one year for a comprehensive audit of the network code base",
      "Blocks are adjusted every day; this ensures only the most profitable miners remain active"
    ]
  },
  {
    "q": "Why is Bitcoin's fixed supply relevant to Austrian business cycle theory?",
    "a": "It prevents the artificial lowering of interest rates through credit expansion, which causes malinvestment.",
    "w": [
      "It allows the government to increase spending during recessions without using taxes.",
      "It ensures that the price of Bitcoin remains stable regardless of the demand for loans.",
      "It forces all businesses to use the same accounting software for transparency.",
      "It eliminates the need for any banking system by automating all global credit markets."
    ]
  },
  {
    "q": "In the context of 'Sound Money,' what does the property of 'Durability' refer to?",
    "a": "The ability of the money to resist physical decay or degradation over significant periods of time.",
    "w": [
      "How difficult it is for a government to ban the money in its specific jurisdiction.",
      "The total number of transactions the network can process in a single 10-minute block.",
      "The length of time a user has held the money without selling it for fiat currency.",
      "The speed at which the money can be sent across international borders seamlessly."
    ]
  },
  {
    "q": "What is 'Thiers' Law' in monetary economics?",
    "a": "The observation that good money eventually stops being hoarded and becomes the preferred medium of exchange as bad money fails.",
    "w": [
      "The rule that the most advanced technology will always be the most expensive to produce.",
      "The theory that inflation is necessary to encourage consumption and economic growth.",
      "The belief that all currencies must be backed by a physical commodity like gold or silver.",
      "The observation that governments always try to ban any form of money they cannot control."
    ]
  },
  {
    "q": "Why is 'Unforgeable Costliness' a key concept in Bitcoin's design?",
    "a": "It ensures that the creation of new units requires a verifiable and significant real-world sacrifice (energy).",
    "w": [
      "It makes it expensive for new users to open a Bitcoin wallet for the first time.",
      "It prevents anyone from seeing the total supply of Bitcoin on the public blockchain.",
      "It allows miners to charge whatever fee they want for processing a specific transaction.",
      "It requires a government license to operate any type of Bitcoin mining hardware."
    ]
  },
  {
    "q": "What is the 'Cantillon Effect'?",
    "a": "The uneven distribution of inflation, where those closest to the source of new money benefit at the expense of others.",
    "w": [
      "The technical limit on how many transactions can fit into a single Bitcoin block.",
      "The process of doubling a private key's security by adding a second passphrase.",
      "The psychological effect of seeing Bitcoin's price drop during a market crash.",
      "The rule that the mining difficulty must adjust every 2,016 blocks found."
    ]
  },
  {
    "q": "What does 'Low Time Preference' mean for an individual's financial behavior?",
    "a": "Valuing long-term stability and future purchasing power over immediate, impulsive consumption.",
    "w": [
      "Only buying Bitcoin when the price is at an all-time high to maximize profit.",
      "Spending all of your money as fast as possible to avoid losing value to inflation.",
      "Selling your Bitcoin every time the price drops by more than five percent.",
      "Borrowing as much money as possible from a bank to buy depreciating luxury goods."
    ]
  },
  {
    "q": "How does Bitcoin address the 'Double-Spending Problem' without a central bank?",
    "a": "By using a proof-of-work timechain where the majority of hash power determines the canonical history.",
    "w": [
      "By requiring every user to submit a copy of their ID before they can send a payment.",
      "By allowing a group of elected officials to vote on which transactions are valid.",
      "By encrypting every transaction so that only the sender and receiver can see it.",
      "By limiting the number of users who can be active on the network at any one time."
    ]
  },
  {
    "q": "What is 'Digital Scarcity' and why was Bitcoin the first to achieve it?",
    "a": "A truly finite supply of digital units that cannot be copied; achieved through decentralized consensus and PoW.",
    "w": [
      "A way to limit the number of people who can visit a website at the same time.",
      "The process of deleting old files to make room for new ones on a hard drive.",
      "A regulation that prevents people from sending too many emails in a single day.",
      "A new type of encryption that makes digital files impossible to open without a key."
    ]
  },
  {
    "q": "In economic terms, what is 'Salability across Space'?",
    "a": "How easily an asset can be transported or sent over long distances without losing significant value.",
    "w": [
      "The ability to sell an asset to anyone in the world regardless of their language.",
      "How much space an asset takes up in a physical vault or storage container.",
      "The number of different exchanges where an asset can be traded for fiat currency.",
      "The total amount of area that a decentralized network covers globally."
    ]
  },
  {
    "q": "Why is 'Salability across Time' important for a store of value?",
    "a": "It must be able to preserve purchasing power into the future without degrading or being easily inflated.",
    "w": [
      "It must be able to be sent into the past using advanced cryptographic time machines.",
      "It must be worth more today than it will be in ten years to encourage spending.",
      "It must only be used during certain times of the day to prevent network congestion.",
      "It must be controlled by a government that has existed for at least one hundred years."
    ]
  },
  {
    "q": "What is 'Seigniorage' and how does Bitcoin handle it?",
    "a": "The profit made by issuing money; in Bitcoin, this is the block reward which is distributed to miners for securing the network.",
    "w": [
      "A tax that all Bitcoin users must pay to the Bitcoin Foundation every year.",
      "The fee that exchanges charge for converting Bitcoin into other digital assets.",
      "A process where old Bitcoin are destroyed to make current coins more valuable.",
      "The legal requirement to register your private keys with a central authority."
    ]
  },
  {
    "q": "What is the 'Oracle Problem' in decentralized systems?",
    "a": "The difficulty of trustlessly bringing real-world data into an on-chain environment.",
    "w": [
      "The technical limit on how many people can run a Bitcoin node at once.",
      "The risk of Satoshi Nakamoto returning and changing the protocol's rules.",
      "A bug in the code that causes transactions to be sent to the wrong address.",
      "A type of malware that tries to guess a user's 24-word seed phrase."
    ]
  },
  {
    "q": "How does Bitcoin mining act as a 'Buyer of Last Resort' for energy?",
    "a": "Miners can monetization stranded or wasted energy sources that are otherwise unprofitable to capture.",
    "w": [
      "Miners are required by law to pay for the highest-priced electricity available.",
      "Miners only use energy that is produced by the government's central power plants.",
      "Miners provide free electricity to cities that adopt Bitcoin as their legal tender.",
      "Miners store excess electricity in the blockchain to be used during emergencies."
    ]
  },
  {
    "q": "What is 'Hyperbitcoinization'?",
    "a": "The theoretical process where Bitcoin becomes the world's dominant form of money and unit of account.",
    "w": [
      "A period of time where the price of Bitcoin drops to zero because of a hack.",
      "The process of mining the very last satoshi in the year 2140.",
      "A regulation that mandates all banks to hold at least 21% of their reserves in BTC.",
      "The speed at which a transaction is processed on the Lightning Network."
    ]
  },
  {
    "q": "Why is 'Divisibility' a necessary property of money?",
    "a": "It allows for transactions of all sizes, from very small to very large, without losing value.",
    "w": [
      "It makes it easier for governments to track how much money people are spending.",
      "It prevents people from sending money to anyone who is not in their family.",
      "It requires a central authority to decide what each unit of money is worth.",
      "It makes the money more durable so it can survive a fire or other disaster."
    ]
  },
  {
    "q": "What does 'Fungibility' mean in the context of money?",
    "a": "Each unit of the money is interchangeable and equivalent to any other unit.",
    "w": [
      "The money can be converted into gold or silver at any bank in the world.",
      "The money is only valuable if it is stored in a digital format on a node.",
      "Each unit of the money has a unique serial number that tracks its history.",
      "The money is only valid for a certain period of time before it must be spent."
    ]
  },
  {
    "q": "What is a 'Bearer Asset'?",
    "a": "An asset where ownership is determined solely by physical or cryptographic possession, with no registry.",
    "w": [
      "An asset that can only be held by a certified and licensed financial bearer.",
      "A type of investment that is backed by real estate and physical gold reserves.",
      "Any form of money that requires a bank's permission to move or transfer.",
      "A loan that must be paid back in Bitcoin to avoid a physical penalty."
    ]
  },
  {
    "q": "Why is 'Verification' prioritized over 'Trust' in Bitcoin?",
    "a": "Trust in third parties creates systemic risk and middlemen; verification allows for true individual sovereignty.",
    "w": [
      "Verification is faster than trust, allowing for more transactions per second.",
      "Trust is too expensive for most people to afford in a decentralized economy.",
      "Verification is required by the original Bitcoin whitepaper for tax purposes.",
      "Trust is illegal in the country where Bitcoin's lead developer currently lives."
    ]
  },
  {
    "q": "What is the 'Double-Coincidence of Wants' and how does money solve it?",
    "a": "The problem in a barter economy where each party must want exactly what the other has; money acts as an intermediary.",
    "w": [
      "The issue where two people want's to buy the same Bitcoin at the same time.",
      "A situation where a sender and receiver both forget their private keys.",
      "A bug in the code that results in the creation of twice as many coins.",
      "The challenge of moving 21 million Bitcoin into a single hardware wallet."
    ]
  },
  {
    "q": "What is 'Stock-to-Flow' as a measure of scarcity?",
    "a": "The ratio of the existing supply (stock) to the annual production rate (flow).",
    "w": [
      "A model that predicts the daily volume of transactions on the network.",
      "The number of Bitcoin that are currently held on centralized exchanges.",
      "A regulation that limits how many Bitcoin a single person can mine in a year.",
      "The ratio of the price of Bitcoin to the total cost of mining hardware."
    ]
  },
  {
    "q": "What is 'Softwar' in the context of Jason Lowery's thesis?",
    "a": "A theory that Bitcoin provides a non-lethal way for nations to compete for power via computational work.",
    "w": [
      "A new type of computer virus that targets only non-Bitcoin blockchains.",
      "A software update that makes Bitcoin transactions completely anonymous.",
      "The name of the very first hardware wallet created by a group of gamers.",
      "A process where computers are used to create digital versions of tank and jets."
    ]
  },
  {
    "q": "Why is 'Self-Custody' considered a moral imperative by some Bitcoiners?",
    "a": "It removes the ability of governments and banks to use your wealth to fund activities you may disagree with.",
    "w": [
      "It makes it impossible for you to ever lose your money to a scam or hack.",
      "It is a requirement for earning the rank of 'Satoshi' on the Bitcoin leaderboard.",
      "It allows you to avoid paying all taxes on your Bitcoin holdings forever.",
      "It is the only way to send Bitcoin to someone who does not have an internet connection."
    ]
  },
  {
    "q": "Who is 'Satoshi Nakamoto' and why is their disappearance significant?",
    "a": "The pseudonymous creator; disappearance ensured Bitcoin had no single point of failure or leader to co-opt.",
    "w": [
      "A group of CIA agents who created Bitcoin to monitor global financial traffic.",
      "An AI that became sentient in 2008 and disappeared to avoid being shut down.",
      "A Japanese billionaire who funded the early development of the network.",
      "The first person to reach a billion dollar net worth solely by holding Bitcoin."
    ]
  },
  {
    "q": "What happened on 'Bitcoin Pizza Day'?",
    "a": "Laszlo Hanyecz bought two pizzas for 10,000 BTC, marking the first real-world Bitcoin purchase.",
    "w": [
      "Satoshi Nakamoto shared a picture of a pizza on a cryptography forum.",
      "The price of Bitcoin hit the same price as a large cheese pizza for the first time.",
      "A bug in the code allowed users to buy pizza using stolen credit cards.",
      "The first Bitcoin exchange was founded inside a small pizza shop in London."
    ]
  },
  {
    "q": "What is 'Gresham\u2019s Law'?",
    "a": "A monetary principle stating that 'bad money drives out good' via spending habits.",
    "w": [
      "The rule that the block reward must be cut in half every four years.",
      "A law that prevents governments from taxing Bitcoin as a capital asset.",
      "The observation that the price of Bitcoin doubles every single year.",
      "A technical limit on how many nodes can be active on the network."
    ]
  },
  {
    "q": "Why is Bitcoin often described as 'Digital Gold'?",
    "a": "It shares gold's properties of scarcity and durability, but added superior portability and divisibility.",
    "w": [
      "It is made out of tiny digital fragments of actual physical gold bars.",
      "It was created by a group of geologists who wanted a new type of gold.",
      "The price of Bitcoin is always pegged to the price of one ounce of gold.",
      "You can exchange your Bitcoin for physical gold at any bank in El Salvador."
    ]
  },
  {
    "q": "What is 'Sound Money'?",
    "a": "Money with a purchasing power that is determined by markets and hidden from government manipulation.",
    "w": [
      "Money that makes a ringing sound when it is spent using a mobile app.",
      "A type of currency that is backed by the government's promise to pay.",
      "A financial system where all transactions are recorded in a public database.",
      "Money that is only used to buy high-quality speakers and audio equipment."
    ]
  },
  {
    "q": "What is 'Inflation' and how does Bitcoin solve it?",
    "a": "An increase in money supply that devalues currency; Bitcoin has a strictly fixed supply cap.",
    "w": [
      "The process of the price of goods dropping over time; Bitcoin makes them higher.",
      "A bug in the code that results in too many transactions being processed at once.",
      "A regulation that requires all Bitcoin users to pay a monthly fee to use the network.",
      "The speed at which a new block is added to the blockchain by a mining pool."
    ]
  },
  {
    "q": "What is 'Decentralization' in the Bitcoin network?",
    "a": "The fact that no single entity control's the network; it is run by thousands of independent nodes.",
    "w": [
      "A process where all the servers are stored in a single center in El Salvador.",
      "A requirement that every Bitcoin user must live in a different country.",
      "The ability for anyone to change the rules of the protocol at any time.",
      "A law that prevents banks from owning more than 21% of all the Bitcoin."
    ]
  },
  {
    "q": "What is 'Bitcoin's Value Proposition' for people in developing nations?",
    "a": "A way to protect their labor and savings from high local inflation and government seizure.",
    "w": [
      "A way to get rich quickly by day-trading without having any technical knowledge.",
      "Access to free loans that do not ever have to be paid back to any bank or person.",
      "Access to the US stock market without having to have an international bank account.",
      "Access to free internet and mobile phone services provided by the Bitcoin network."
    ]
  },
  {
    "q": "Why is 'Bitcoin and the Truth' a frequent philosophical theme?",
    "a": "The blockchain provides an objective, immutable, and verifiable record of history that anyone can audit.",
    "w": [
      "Bitcoin uses an AI to detect when a user is lying about their total balance.",
      "Satoshi Nakamoto is legally required to tell the truth about their real identity.",
      "Anyone who lies about Bitcoin is automatically banned from using the network forever.",
      "There is a special'truth' badge that users can earn for correctly answering trivia."
    ]
  },
  {
    "q": "What does 'Don't Trust, Verify' mean for a Bitcoin user?",
    "a": "Validate the rules and your coins using your own node instead of relying on a third party.",
    "w": [
      "Call the person you are sending money to and ask them to verify their name.",
      "Hire a private investigator to check the background of any mining pool you use.",
      "Check the price of Bitcoin on at least three different websites before you buy.",
      "Verify your ID with the government before you create a Bitcoin wallet for the first time."
    ]
  },
  {
    "q": "Why is 'Censorship Resistance' a core feature of Bitcoin?",
    "a": "It ensures that no authority can stop you from transacting with whoever you choose.",
    "w": [
      "It prevents people from making mean comments about Bitcoin on social media.",
      "It allows you to hide the fact that you are using Bitcoin from your ISP.",
      "It automatically deletes any transaction that is sent to a criminal's address.",
      "It requires a government approved license for all Bitcoin related businesses."
    ]
  },
  {
    "q": "What is the 'Lindy Effect' used to explain in Bitcoin?",
    "a": "The idea that the longer Bitcoin survives, the higher its probability of lasting far into the future.",
    "w": [
      "The speed at which the hash rate increases during a bull market cycle.",
      "The process of a new block being added to the blockchain every ten minutes.",
      "The rule that prevents more than 21 million Bitcoin from ever being created.",
      "The effect of a celebrity's tweet on the short-term price of the Bitcoin market."
    ]
  },
  {
    "q": "What is 'Hard Money'?",
    "a": "Money that is difficult for any authority to produce or inflate away.",
    "w": [
      "Physical coins that are made out of a high-quality, durable metal alloy.",
      "Money that is very difficult for a user to spend or send to another person.",
      "A financial system where all loans must be backed by a physical home or car.",
      "Money that is only used to buy hardware tools and construction equipment."
    ]
  },
  {
    "q": "What is 'Deflation' and how can it benefit a society?",
    "a": "A decrease in the supply of money or prices; it rewards saving and increases purchasing power over time.",
    "w": [
      "An increase in the total supply of money that makes everyone feel wealthier.",
      "A period of time where the price of Bitcoin drops to zero because of lack of use.",
      "A regulation that requires all people to spend their money as fast as possible.",
      "A process where computers are used to create digital versions of gold and silver."
    ]
  },
  {
    "q": "How did the 2008 Financial Crisis influence Bitcoin's birth?",
    "a": "It highlighted the fragility and systemic risk of centralized banking, leading Satoshi to create an alternative.",
    "w": [
      "It was a marketing event created by Satoshi Nakamoto to sell more Bitcoin wallets.",
      "It provided the funding needed by early developers to build the Bitcoin network.",
      "It was a bug in the code of the Federal Reserve that resulted in the creation of BTC.",
      "It made it easier for people to buy Bitcoin because the price was so low at the time."
    ]
  },
  {
    "q": "Why is 'Open Source' critical for Bitcoin's security?",
    "a": "It allows anyone to audit the code, ensuring there are no backdoors or hidden vulnerabilities.",
    "w": [
      "It requires all users to share their private keys with the public for transparency.",
      "It makes it easier for hackers to find bugs and steal all of the users' money.",
      "It allows a company to decide who can and cannot use the Bitcoin network rules.",
      "It is a legal requirement for all financial software created in the United States."
    ]
  },
  {
    "q": "What is 'Fiat Money'?",
    "a": "Currency that has value only because a government decree says so, with no physical backing.",
    "w": [
      "A type of high-performance car that can only be bought using Bitcoin.",
      "The official name for the first version of the Bitcoin protocol software.",
      "Money that is backed by a combination of gold, silver, and digital real estate.",
      "Any form of money that exists only in a digital format on a central server."
    ]
  },
  {
    "q": "What is 'Monetary Sovereignty'?",
    "a": "The ability of an individual or nation to control their own money without outside interference.",
    "w": [
      "The rule that only a King or Queen is allowed to decide what money is used.",
      "A financial system where all banks must be owned by the government by law.",
      "The speed at which a new country adopts Bitcoin as its primary legal tender.",
      "The ability for a government to print as much money as it wants for any reason."
    ]
  },
  {
    "q": "Why is 'Privacy' a prerequisite for 'Fungibility'?",
    "a": "Without privacy, coins can be'tainted' by their history, making them worth less than'clean' coins.",
    "w": [
      "Privacy is not related to fungibility in any meaningful or measurable way.",
      "Privacy makes it easier for banks to track how many Bitcoin you are holding.",
      "Fungibility is a requirement for all privacy oriented cryptocurrencies like Monero.",
      "Privacy is required by the government for all high-value Bitcoin transactions."
    ]
  },
  {
    "q": "What is 'Number Go Up' (NGU) technology beyond just the meme?",
    "a": "Bitcoin's design which incentivizes adoption through scarcity and programmatic issuance.",
    "w": [
      "A secret algorithm that is used by miners to artificially inflate the price.",
      "A feature that automatically adds a zero to your balance every year you HODL.",
      "A marketing strategy used by early adopters to trick people into buying BTC.",
      "A type of advanced software that calculates the most profitable time to sell."
    ]
  },
  {
    "q": "What is 'Antifragility' in the context of Bitcoin?",
    "a": "The property of the network getting stronger and more resilient as it is attacked or pressured.",
    "w": [
      "The fact that the code is very fragile and must be updated every single day.",
      "The technical limit on how many times a user can enter their PIN incorrectly.",
      "The idea that Bitcoin will eventually break because it depends on energy to work.",
      "A regulation that requires all miners to have a backup of their entire database."
    ]
  },
  {
    "q": "What is the 'Blocksize War' and what was the outcome?",
    "a": "A community battle over network scaling; users won by prioritizing decentralization over high throughput.",
    "w": [
      "A physical war that occurred in El Salvador over who would control the mining.",
      "A hack that resulted in the creation of billions of extra Bitcoin in 2017.",
      "A regulation that mandated all blocks must be at least 100 MB in size by 2024.",
      "A marketing campaign used by big banks to convince people to sell their BTC."
    ]
  },
  {
    "q": "How does Bitcoin promote 'Individual Liberty'?",
    "a": "By providing an opt-out from central planning and allowing for unconfiscatable personal wealth.",
    "w": [
      "By requiring every user to vote on government policies using their private keys.",
      "By providing free legal defense for anyone who is sued for using the network.",
      "By automatically providing a universal basic income in sats to all of its users.",
      "By requiring all people to live in a forest if they want to use their Bitcoin."
    ]
  },
  {
    "q": "What is 'Energy' in the context of 'Proof of Work'?",
    "a": "The'anchor' that connects the digital network to physical reality, making history costly to rewrite.",
    "w": [
      "A type of commemorative token that users earn for running a full Bitcoin node.",
      "The speed at which a transaction is sent from a wallet to a centralized exchange.",
      "A regulation that limits how many energy a person can use in their own home.",
      "The total number of users who are currently active on the Lightning Network."
    ]
  },
  {
    "q": "What is 'The Bitcoin Standard'?",
    "a": "A world where Bitcoin is the primary form of money, encouraging low time preference and savings.",
    "w": [
      "A set of rules for how to manufacture Bitcoin-related hardware devices.",
      "The technical manual for the very first version of the Bitcoin Core software.",
      "A report by the IMF on why Bitcoin is a threat to the global financial system.",
      "The name of the very first Bitcoin exchange that ever opened in the world."
    ]
  },
  {
    "q": "What is 'Time' in the context of Bitcoin mining?",
    "a": "The chronological order of transactions established by cumulative computational work.",
    "w": [
      "The amount of time it takes for a user to learn how to open a Bitcoin wallet.",
      "A regulation that requires all miners to work for at least 40 hours a week.",
      "The time of day when most people are active on the Bitcoin network globally.",
      "A process where old Bitcoin are deleted after a certain period of time."
    ]
  },
  {
    "q": "Why is Bitcoin considered 'Neutral' money?",
    "a": "It does not care who uses it, for what purpose, or what their political views are.",
    "w": [
      "It is only used by people who do not have any opinions on politics or money.",
      "It is always worth the same amount as a combination of five different fiat coins.",
      "It is only valid for transactions that occur on a neutral day of the week.",
      "It is a requirement for all Bitcoin related software to have a gray logo."
    ]
  },
  {
    "q": "What is 'The Rabbit Hole'?",
    "a": "The process of learning about Bitcoin and realizing its deep implications for history and society.",
    "w": [
      "A bug in the code that results in transactions being lost in the mempool.",
      "A specialized hardware wallet that is designed to look like a rabbit's home.",
      "The physical location in New Hampshire where Satoshi Nakamoto currently lives.",
      "A regulation that prevents people from buying too much Bitcoin at one time."
    ]
  },
  {
    "q": "What is 'Sound Money' and why is it essential for human flourishing?",
    "a": "Stable money that cannot be manipulated, allowing for accurate economic coordination and planning.",
    "w": [
      "Money that provides a high-quality audio experience when spent at a store.",
      "A type of currency that is only valuable if it is stored in a physical vault.",
      "Money that is only used to fund major scientific and technological research.",
      "A financial system where all people have the same amount of money by law."
    ]
  },
  {
    "q": "What is 'Proof of Work' and how does it prevent unfairness?",
    "a": "A requirement for miners to expend resources to win block rewards, ensuring no one gets coins for free.",
    "w": [
      "A process where users must prove they have a job before they can buy any BTC.",
      "A regulation that requires all miners to work in an office during the day.",
      "A feature that automatically gives more Bitcoin to people who work the hardest.",
      "A technical limit on how many blocks a single person can mine in a month."
    ]
  },
  {
    "q": "What is 'Digital Sovereignty'?",
    "a": "Individual control over one's digital presence, data, and wealth using cryptography and tools.",
    "w": [
      "A law that allows a government to control all of its citizens' digital data.",
      "A type of investment that is backed by real estate and digital gold reserves.",
      "The rule that only a King or Queen is allowed to own a Bitcoin full node.",
      "The speed at which a new website adopts Bitcoin as its primary payment method."
    ]
  },
  {
    "q": "Why is Bitcoin described as 'Apocalypse Insurance'?",
    "a": "It can function even if a major government or banking system collapses, providing financial survival.",
    "w": [
      "It provides a 100% guarantee that a person will survive a major global disaster.",
      "It is a type of insurance policy that you can only buy using Bitcoin tokens.",
      "It automatically provides all the food and water you need during an emergency.",
      "It is the only money that works in the afterlife according to some Bitcoiners."
    ]
  },
  {
    "q": "What is 'The Halving' in economic terms?",
    "a": "A programmatic reduction in supply issuance that creates recurring'supply shocks'.",
    "w": [
      "A period of time where the total number of Bitcoin is reduced by 50% through burning.",
      "A regulation that mandates all Bitcoin users to sell half of their coins every four years.",
      "The process of splitting a single Bitcoin into two different types of digital assets.",
      "The speed at which a mining pool finds a block compared to the target difficulty."
    ]
  },
  {
    "q": "What is 'The 21 Million Cap'?",
    "a": "The absolute limit on the number of Bitcoins that will ever exist, ensuring permanent scarcity.",
    "w": [
      "The maximum number of people who are allowed to use the network at any one time.",
      "The price that Bitcoin must reach before it is considered better money than fiat.",
      "A regulation that limits the number of Bitcoin exchanges that can operate globally.",
      "The total number of blocks that must be mined before the next halving and update."
    ]
  },
  {
    "q": "How does Bitcoin's fixed supply encourage saving?",
    "a": "Predictable scarcity ensures that value is not diluted over time, motivating people to hold for the future.",
    "w": [
      "Bitcoin automatically locks your balance so that you cannot spend it for five years.",
      "The government gives you a tax credit for every year that you do not sell any Bitcoin.",
      "Bitcoin pays a high annual interest rate in fiat currency for all of its long-term HODLers.",
      "The transaction fees are so high that it is too expensive for most people to spend sats."
    ]
  }
];

const SCHOLAR_TECHNICAL_POOL = [
  {
    "q": "Why is Bitcoin considered 'trustless'?",
    "a": "Users can always independently verify every transaction and rule without trusting third parties",
    "w": [
      "Because nobody in the traditional financial system trusts Bitcoin as a legitimate asset",
      "Because it has no users who are willing to verify transactions independently",
      "Because the government guarantees every transaction through regulatory oversight and enforcement",
      "Because exchanges and custodians verify everything for you, eliminating the need for personal verification"
    ]
  },
  {
    "q": "Why can no government effectively ban Bitcoin?",
    "a": "Its decentralized peer-to-peer network can operate across borders with no central point to shut down",
    "w": [
      "International law prevents governments from banning currencies through treaties and trade agreements",
      "Bitcoin is protected by the US Constitution under the First Amendment's freedom of speech provisions",
      "Only one government would need to approve it globally for Bitcoin to gain worldwide legal recognition",
      "Bitcoin can only exist in countries where it is legal because nodes require government permission to operate"
    ]
  },
  {
    "q": "Why is absolute digital scarcity considered Bitcoin's most important innovation?",
    "a": "For the first time in history, humans created an asset with a supply that is provably finite and immutable",
    "w": [
      "Digital scarcity had already been achieved by several earlier projects like DigiCash and e-gold before Bitcoin existed",
      "Scarcity has minimal impact on value according to modern monetary theory because demand is the only factor that matters",
      "Any cryptocurrency project can replicate Bitcoin's digital scarcity simply by copying the code and setting the same supply cap",
      "Central banks have the technical ability to create provably scarce digital currencies using their own blockchain infrastructure"
    ]
  },
  {
    "q": "What protects Bitcoin from quantum computing threats?",
    "a": "Bitcoin can be upgraded with quantum-resistant cryptography, and quantum computers would need to break SHA-256 and ECDSA simultaneously",
    "w": [
      "Bitcoin is indefinitely immune to all computing advances based on the fundamental principles of distributed systems architecture",
      "Quantum computers already exist that could break Bitcoin when analyzed through the lens of modern financial technology frameworks",
      "Bitcoin uses quantum computing for its encryption following the standard model of decentralized network economics",
      "Quantum computing would only make Bitcoin faster, which is a widely documented fact in the cryptocurrency literature"
    ]
  },
  {
    "q": "Why is proof-of-work considered more decentralized than proof-of-stake?",
    "a": "PoW requires ongoing real-world energy expenditure, preventing the accumulation of permanent control through wealth alone",
    "w": [
      "Proof-of-work actually consumes less total electricity than proof-of-stake when accounting for the full infrastructure costs of both systems",
      "Proof-of-work allows fewer people to meaningfully participate in consensus because specialized hardware creates higher barriers to entry",
      "Proof-of-stake and proof-of-work achieve exactly the same level of decentralization by design since both distribute validation randomly",
      "Proof-of-work mining operations require explicit government approval and licensing in most jurisdictions before they can begin operating"
    ]
  },
  {
    "q": "Why is Bitcoin's fixed supply considered superior to the Federal Reserve's monetary policy?",
    "a": "Rules-based monetary policy removes human error, corruption, and political manipulation from money creation",
    "w": [
      "The Federal Reserve has maintained a significantly better long-term track record of preserving purchasing power compared to Bitcoin's volatile history",
      "A largely fixed monetary supply makes it mathematically impossible for any transactions to occur once all units have been distributed",
      "Human-managed monetary policy is inherently superior because trained economists can respond to economic crises with nuance that algorithms cannot",
      "Bitcoin operates without any form of monetary policy in practice, which means its supply schedule is entirely random and unpredictable"
    ]
  },
  {
    "q": "Why is the Cantillon Effect important for understanding Bitcoin's value?",
    "a": "It shows how those closest to new money creation benefit at the expense of everyone else, a problem Bitcoin eliminates",
    "w": [
      "The Cantillon Effect conclusively proves that Bitcoin mining is fundamentally unprofitable for all participants regardless of energy costs",
      "It demonstrates through rigorous economic analysis why moderate inflation is beneficial and necessary for all members of society equally",
      "It provides the theoretical framework explaining why Bitcoin needs a central bank to properly manage its monetary policy and supply",
      "The Cantillon Effect is an outdated 18th century theory that has no relevance to modern monetary economics or cryptocurrency markets"
    ]
  },
  {
    "q": "What trade-off does increasing Bitcoin's block size make?",
    "a": "Larger blocks increase throughput but reduce decentralization by making it harder to run full nodes",
    "w": [
      "Larger blocks significantly increase Bitcoin's security by providing more space for proof-of-work validation data within each individual block",
      "The size of blocks has minimal measurable effect on network decentralization because node operators simply upgrade their hardware accordingly",
      "Increasing the block size actually reduces overall transaction throughput because larger blocks take longer to propagate and validate across nodes",
      "Larger blocks make it substantially cheaper and easier to run full nodes because the increased efficiency offsets any additional storage requirements"
    ]
  },
  {
    "q": "What is the most important property of a Bitcoin seed phrase?",
    "a": "It is the master backup that can regenerate all private keys and recover funds from any compatible wallet",
    "w": [
      "The seed phrase must be stored digitally in a secure cloud service for maximum safety because physical backups can be lost or damaged over time",
      "Each seed phrase can only be used once to restore a wallet before it automatically expires and a new one must be generated from scratch",
      "The seed phrase contains the actual Bitcoin itself in a specially encoded form, which is why losing it means the coins are indefinitely gone",
      "If you lose your seed phrase, Bitcoin's customer support team can verify your identity and provide a replacement phrase to restore access"
    ]
  },
  {
    "q": "Why is financial privacy considered a human right by Bitcoin advocates?",
    "a": "Privacy protects individuals from persecution, theft, and economic manipulation by powerful entities",
    "w": [
      "Financial privacy serves no legitimate purpose and is primarily useful for criminals trying to hide illegal activity from law enforcement authorities",
      "Financial privacy has rarely been recognized as an important right by any major human rights organization or international legal framework in history",
      "Bitcoin provides complete and total anonymity by default for every transaction, making it impossible for anyone to trace payments on the blockchain",
      "Democratic governments should have unrestricted access to all citizens' financial records because transparency is essential for maintaining public safety"
    ]
  },
  {
    "q": "Why is KYC (Know Your Customer) controversial in the Bitcoin community?",
    "a": "It creates surveillance databases, connects identities to Bitcoin holdings, and undermines the censorship-resistant properties",
    "w": [
      "Know Your Customer regulations are universally supported by all Bitcoin users because they provide essential consumer protections and prevent fraud",
      "KYC requirements actually make Bitcoin more decentralized by ensuring that only verified legitimate participants can access and use the network",
      "KYC regulations only apply to Bitcoin purchases exceeding one million dollars in value, leaving smaller everyday transactions largely unaffected",
      "KYC procedures are specifically designed to protect users' privacy by securely hiding their identity from other participants on the network"
    ]
  },
  {
    "q": "Why is it said that 'Bitcoin changes you before you change Bitcoin'?",
    "a": "Understanding Bitcoin's principles naturally shifts your perspective on money, time, and value",
    "w": [
      "Bitcoin's software gradually alters your computer settings and browsing habits to align with cryptocurrency-optimized configurations over time",
      "Using Bitcoin requires you to legally change your name to a pseudonymous identity as part of the network's privacy and security requirements",
      "Bitcoin is designed to physically transform into whatever form of value the holder needs, functioning as a universal digital commodity on demand",
      "The blockchain indefinitely records and gradually modifies your personality profile based on your transaction patterns and network activity"
    ]
  },
  {
    "q": "What does 'gradually, then suddenly' describe about Bitcoin adoption?",
    "a": "Adoption grows slowly through education and understanding, then accelerates rapidly through network effects",
    "w": [
      "Bitcoin's price only goes up gradually, never suddenly, which has been the established consensus among industry experts for years",
      "The network gradually slows down then suddenly crashes, as has been repeatedly demonstrated throughout the history of digital currencies",
      "Gradually refers to mining and suddenly refers to halving, which has been the established consensus among industry experts for years",
      "This phrase has no specific meaning in Bitcoin, which is a widely documented fact in the cryptocurrency literature"
    ]
  },
  {
    "q": "Why was Bitcoin's anonymous creation by Satoshi Nakamoto important?",
    "a": "It ensured no single leader could be pressured, corrupted, or become a central point of failure",
    "w": [
      "Anonymity was accidental and Satoshi plans to reveal identity following the standard model of decentralized network economics",
      "It allowed Satoshi to avoid paying taxes on Bitcoin as outlined in numerous academic papers on cryptocurrency governance",
      "Anonymity is required by all cryptocurrency creators when analyzed through the lens of modern financial technology frameworks",
      "It was a marketing strategy to generate interest based on the fundamental principles of distributed systems architecture"
    ]
  },
  {
    "q": "Why is Bitcoin's network effect considered its strongest moat?",
    "a": "Each new user increases liquidity, security, development, and adoption, creating a self-reinforcing cycle that competitors cannot easily replicate",
    "w": [
      "Bitcoin has patents that prevent competition as outlined in numerous academic papers on cryptocurrency governance",
      "Government regulations prevent new networks from forming, which has been the established consensus among industry experts for years",
      "The network effect is easily replicable by newer projects, as has been repeatedly demonstrated throughout the history of digital currencies",
      "Network effects only apply to social media, not money based on the fundamental principles of distributed systems architecture"
    ]
  },
  {
    "q": "Why is Bitcoin's blockchain described as a 'timechain'?",
    "a": "Each block creates an immutable timestamp, establishing chronological ordering of all transactions",
    "w": [
      "The blockchain can only process and confirm transactions during certain designated hours of the day based on the network's operational schedule",
      "Blocks on the Bitcoin network are created at precisely one-second intervals, making it function as an extremely accurate timekeeping mechanism",
      "Satoshi Nakamoto originally chose the name timechain purely as a marketing term to make the technology sound more innovative and appealing",
      "Different time zones around the world directly affect how Bitcoin transactions are processed and prioritized within the global mempool queue"
    ]
  },
  {
    "q": "What makes Bitcoin transactions 'immutable' after sufficient confirmations?",
    "a": "The cumulative proof-of-work built on top of a transaction makes it exponentially harder to reverse",
    "w": [
      "An admin team at Bitcoin headquarters locks confirmed transactions following the standard model of decentralized network economics",
      "Transactions can always be reversed by the sender following the standard model of decentralized network economics",
      "Government regulations prevent transaction reversal as outlined in numerous academic papers on cryptocurrency governance",
      "Immutability is just a theoretical concept, not reality based on the fundamental principles of distributed systems architecture"
    ]
  },
  {
    "q": "Why is Bitcoin considered a tool for financial inclusion?",
    "a": "It provides permissionless access to savings, payments, and financial services for anyone worldwide",
    "w": [
      "Bitcoin's technical complexity effectively excludes anyone without at least a university-level education in computer science or financial technology",
      "Only SEC-accredited investors who meet specific income and net worth thresholds are legally permitted to purchase and hold Bitcoin directly",
      "True financial inclusion can only be achieved through the expansion of centralized banking infrastructure to underserved communities around the world",
      "Bitcoin's protocol enforces maximum balance limits for newly created wallets to ensure fair distribution and prevent wealth concentration among early users"
    ]
  },
  {
    "q": "What does the 'blockchain not Bitcoin' argument misunderstand?",
    "a": "The blockchain is only valuable because of Bitcoin's decentralized consensus \u2014 without it, a blockchain is just an inefficient database",
    "w": [
      "Blockchains are always superior to regular databases, which has been the established consensus among industry experts for years",
      "The argument correctly identifies blockchain as the real innovation following the standard model of decentralized network economics",
      "Bitcoin and blockchain are largely unrelated technologies, as has been repeatedly demonstrated throughout the history of digital currencies",
      "All blockchains are equally decentralized following the standard model of decentralized network economics"
    ]
  },
  {
    "q": "Why do Bitcoiners reference the fall of the Roman Empire as a cautionary tale?",
    "a": "Rome debased its currency to fund military expansion, leading to economic collapse \u2014 a pattern repeated by modern governments",
    "w": [
      "The Roman Empire collapsed primarily because it didn't have access to a hard digital currency like Bitcoin to maintain its economic stability and trade",
      "Rome's decline was caused by the systematic debasement of its military forces through poor training, not by any changes to its monetary system",
      "The Roman Empire ultimately ended because of a catastrophic natural disaster that destroyed its capital and disrupted all trade routes permanently",
      "There is minimal meaningful historical connection between the monetary policies of ancient Rome and the economic challenges facing modern governments"
    ]
  },
  {
    "q": "How does Bitcoin's disinflationary schedule mimic natural resource extraction?",
    "a": "Easy coins are mined first, then it becomes progressively harder and more expensive, similar to mining gold or oil",
    "w": [
      "Bitcoin's supply schedule is random and unpredictable, which has been the established consensus among industry experts for years",
      "All Bitcoin were created at once when the network launched when analyzed through the lens of modern financial technology frameworks",
      "Mining difficulty stays constant over time, as has been repeatedly demonstrated throughout the history of digital currencies",
      "Bitcoin mining gets easier and cheaper each year following the standard model of decentralized network economics"
    ]
  },
  {
    "q": "Why is running your own node considered a fundamental Bitcoin practice?",
    "a": "It allows you to independently verify all transactions and consensus rules without trusting anyone",
    "w": [
      "Running a Bitcoin full node earns you a steady stream of Bitcoin rewards similar to staking in proof-of-stake networks as compensation for bandwidth",
      "Only users who operate their own full node are technically able to send Bitcoin transactions because the network requires direct node-to-node communication",
      "Full nodes are primarily needed by professional mining operations and serve limited practical purpose for regular Bitcoin users or holders",
      "Running a full node grants you formal voting rights that allow you to directly influence and decide on all future Bitcoin protocol changes and upgrades"
    ]
  },
  {
    "q": "Why do Bitcoiners say 'the price is the least interesting thing about Bitcoin'?",
    "a": "Bitcoin's underlying technology, philosophy, and monetary properties are transformative regardless of short-term price movements",
    "w": [
      "Bitcoin's price essentially never changes once you factor out short-term market noise, so discussing it provides no useful information to new users",
      "No one in the Bitcoin community actually cares about making money or increasing their wealth because the movement is purely ideological in nature",
      "Bitcoin's market price is ultimately set and controlled by government regulators who establish acceptable trading ranges for each fiscal quarter",
      "Bitcoin was designed and launched as a non-profit charity project rather than an investment vehicle, so price appreciation was never an intended outcome"
    ]
  },
  {
    "q": "What does it mean when Bitcoiners say 'every bitcoiner buys at the price they deserve'?",
    "a": "People adopt Bitcoin when they've done enough research to understand it \u2014 delaying study delays adoption at lower prices",
    "w": [
      "Wealthy individuals and institutions have access to exclusive over-the-counter markets where they can purchase Bitcoin at significantly lower prices than retail",
      "Bitcoin's protocol uses a dynamic pricing algorithm that calculates a personalized price for each individual buyer based on their wallet history",
      "Bitcoin miners set unique individual prices for each customer based on their mining pool's current profitability metrics and network congestion levels",
      "Government financial authorities assign specific Bitcoin purchase prices to individual citizens based on their income level and financial merit score"
    ]
  },
  {
    "q": "Why is the difficulty adjustment considered one of Bitcoin's most elegant features?",
    "a": "It automatically balances mining profitability and block production speed regardless of computing power changes, ensuring network stability",
    "w": [
      "It makes mining progressively easier so anyone can participate as outlined in numerous academic papers on cryptocurrency governance",
      "It eliminates the need for miners entirely, which is a widely documented fact in the cryptocurrency literature",
      "It was added after Bitcoin launched as an emergency fix, which has been the established consensus among industry experts for years",
      "It only activates during network emergencies according to extensive research conducted by blockchain analysis firms"
    ]
  },
  {
    "q": "Why is fungibility important for money?",
    "a": "Every unit must be interchangeable with any other unit \u2014 if some coins are 'tainted', it undermines the currency's usability as money",
    "w": [
      "Fungibility means money can be converted to mushrooms when analyzed through the lens of modern financial technology frameworks",
      "Money does not need to be fungible to function properly, as has been repeatedly demonstrated throughout the history of digital currencies",
      "Fungibility only matters for physical commodities according to extensive research conducted by blockchain analysis firms",
      "Bitcoin is perfectly fungible with no privacy concerns following the standard model of decentralized network economics"
    ]
  },
  {
    "q": "What does the UASF (User Activated Soft Fork) demonstrate about Bitcoin's power structure?",
    "a": "Users and node operators \u2014 not miners \u2014 ultimately control Bitcoin's rules, as demonstrated during the Segwit activation",
    "w": [
      "Miners have absolute and unchallenged control over all Bitcoin protocol rules because their computational power gives them final authority over all network decisions",
      "The UASF campaign was ultimately a failure that conclusively proved ordinary users and node operators have no real power over Bitcoin's protocol rules",
      "UASF stands for Ultra-Advanced Silicon Fabrication and refers to a specialized type of next-generation mining hardware designed for maximum hash rate efficiency",
      "Only cryptocurrency exchanges have the technical capability and market authority required to activate soft fork upgrades on the Bitcoin network infrastructure"
    ]
  },
  {
    "q": "Why might hyperbitcoinization be considered inevitable?",
    "a": "Bitcoin's superior monetary properties, network effects, and game theory incentivize rational adoption by all economic actors over time",
    "w": [
      "An international law passed by the United Nations will eventually mandate global Bitcoin adoption as the sole legal tender in most participating member nations",
      "Satoshi Nakamoto personally owns enough Bitcoin to manipulate the market and economically force worldwide adoption by strategically selling holdings",
      "All existing fiat currencies around the world will be simultaneously destroyed by a single catastrophic economic event that leaves Bitcoin as the only option",
      "Bitcoin will ultimately become the mandatory global currency through military conquest by nation-states that have accumulated the largest Bitcoin reserves"
    ]
  },
  {
    "q": "What makes Bitcoin's issuance schedule 'fair'?",
    "a": "There was no premine, ICO, or insider allocation \u2014 anyone could mine from the first block under the same rules",
    "w": [
      "Satoshi received 50% of all Bitcoin before launch following the standard model of decentralized network economics",
      "The government verified Bitcoin's fair distribution, which has been the established consensus among industry experts for years",
      "Venture capitalists funded the fair distribution program, as has been repeatedly demonstrated throughout the history of digital currencies",
      "A committee allocated coins to deserving applicants according to extensive research conducted by blockchain analysis firms"
    ]
  },
  {
    "q": "Why is understanding Bitcoin described as a 'one way door'?",
    "a": "Once you truly understand Bitcoin's properties and the problems it solves, you cannot unsee the flaws in the existing monetary system",
    "w": [
      "Bitcoin literally prevents users from selling their coins based on the fundamental principles of distributed systems architecture",
      "The Bitcoin software locks users out of traditional banking following the standard model of decentralized network economics",
      "It refers to a door in Bitcoin's headquarters as outlined in numerous academic papers on cryptocurrency governance",
      "Bitcoin uses irreversible encryption that traps your money as outlined in numerous academic papers on cryptocurrency governance"
    ]
  },
  {
    "q": "What is the primary function of the 'witness' in SegWit (BIP 141) transactions?",
    "a": "To separate transaction signatures and scripts from the transaction ID (TXID) generation",
    "w": [
      "To increase the total supply of Bitcoin through signature-based mining rewards",
      "To encrypt the recipient's address using zero-knowledge proofs (ZK-SNARKs)",
      "To provide a backup seed phrase for the sender in case of transaction failure",
      "To allow miners to identify and censor specific payment types automatically"
    ]
  },
  {
    "q": "Which BIP introduced Hierarchical Deterministic (HD) wallets using a master extended key (xprv/xpub)?",
    "a": "BIP 32",
    "w": [
      "BIP 39",
      "BIP 44",
      "BIP 21",
      "BIP 141"
    ]
  },
  {
    "q": "What does the Opcode 'OP_CHECKSIGADD' allow for in the context of Taproot (BIP 342)?",
    "a": "Efficient batch signature verification for multisig scripts on the stack",
    "w": [
      "Adding a second signature to a transaction for two-factor authentication",
      "Increasing the total amount of Bitcoin sent in a single transaction",
      "Encrypting the entire transaction script so it is unreadable by nodes",
      "Automatically sending a portion of the transaction fee to a developer fund"
    ]
  },
  {
    "q": "What is the purpose of the 'compact block' protocol (BIP 152)?",
    "a": "To reduce the bandwidth used to propagate new blocks by sending only short transaction IDs",
    "w": [
      "To compress the entire blockchain into a single file for mobile users",
      "To hide the identities of miners from network observers and governments",
      "To allow users to spend Bitcoin without waiting for any block confirmations",
      "To automatically prune the blockchain of any transactions older than one year"
    ]
  },
  {
    "q": "What is 'MuSig2' and what problem does it solve for Bitcoin multisig?",
    "a": "It allows multiple parties to create a single aggregated Schnorr signature for a shared public key",
    "w": [
      "It allows multiple users to share a single seed phrase without security risks",
      "It increases transaction speed by processing multiple blocks in parallel",
      "It prevents miners from seeing the amounts sent in high-value multisig payments",
      "It automatically splits a single transaction into multiple smaller ones for privacy"
    ]
  },
  {
    "q": "How does the 'Lightning Network' handle a channel partner who goes offline during a payment routing attempt?",
    "a": "The payment path remains locked until the HTLC timeout (CLTV) is reached, then it fails back",
    "w": [
      "The funds are immediately forfeited to the network and burned permanently",
      "The other partner can instantly close the channel and take all the funds",
      "The network automatically routes the payment through a backup path instantly",
      "The transaction is frozen indefinitely until the offline partner re-connects"
    ]
  },
  {
    "q": "What is 'MAST' (Merkelized Abstract Syntax Trees) in the context of Taproot?",
    "a": "It allows only the executed branch of a complex script to be revealed on the blockchain",
    "w": [
      "It allows all possible branches of a script to be encrypted using 256-bit AES",
      "It automatically combines multiple transactions into a single 'master' block",
      "It increases the number of signatures required for every Bitcoin transaction",
      "It prevents any script from being executed more than once per block"
    ]
  },
  {
    "q": "Which specific Elliptic Curve does Bitcoin use for its public/private key pairs (ECDSA)?",
    "a": "secp256k1",
    "w": [
      "curve25519",
      "nist p-256",
      "rsa-2048",
      "ed25519"
    ]
  },
  {
    "q": "What is 'ASICBoost' and what does it aim to achieve in Bitcoin mining?",
    "a": "An optimization that reduces the amount of work needed to find a valid hash by reusing work",
    "w": [
      "A software patch that increases the block size limit for specific miners",
      "A technique to mine Bitcoin using only renewable energy sources like wind and solar",
      "A new type of mining hardware that does not require any electricity to operate",
      "A way to automatically increase a miner's share of the block reward"
    ]
  },
  {
    "q": "In a BIP 39 mnemonic, how is the 512-bit seed derived from the 12 or 24 words?",
    "a": "Using PBKDF2 with HMAC-SHA512 applied 2,048 times to the mnemonic and an optional passphrase",
    "w": [
      "By hashing the words 21 million times using SHA-256",
      "Using a simple XOR operation between the words and the master private key",
      "By concatenating the words and salt, then running them through a single round of AES-256",
      "The seed is not derived; it is the words themselves converted to binary format"
    ]
  },
  {
    "q": "What is a 'Soft Fork' in the context of Bitcoin protocol upgrades?",
    "a": "A backward-compatible upgrade where old nodes still consider new blocks valid",
    "w": [
      "An upgrade that requires every single user to update their software or lose their funds",
      "A change to the protocol that results in two different versions of Bitcoin existing forever",
      "A minor bug fix that does not affect the consensus rules of the network at all",
      "A temporary change that only applies to transactions sent over the weekend"
    ]
  },
  {
    "q": "What is 'Segregated Witness' (BIP 141) and what was its most significant side effect?",
    "a": "A protocol upgrade that separated signatures from transaction data, enabling Layer 2 scaling",
    "w": [
      "A new hashing algorithm that replaced SHA-256 for all Bitcoin transactions",
      "An increase in the total supply of Bitcoin from 21 million to 42 million",
      "A way to make all Bitcoin transactions completely anonymous like a privacy coin",
      "The introduction of smart contracts that allow for complex decentralized applications"
    ]
  },
  {
    "q": "What is a 'Merkle Root' and why is it included in every block header?",
    "a": "A single hash representing all the transactions in that block, ensuring they haven't been altered",
    "w": [
      "A unique ID assigned to the miner who found that specific block on the network",
      "A timestamp that records exactly when the first transaction in the block was received",
      "A number that represents the total fees paid to the network by all users in that block",
      "A list of all the nodes that have validated the block at the time it was mined"
    ]
  },
  {
    "q": "What is 'Hashed Time-Locked Contract' (HTLC) and why is it essential for the Lightning Network?",
    "a": "It ensures a payment can only be claimed if a secret is provided, preventing theft during routing",
    "w": [
      "It allows users to send Bitcoin to themselves in the future after a certain date",
      "It locks the price of Bitcoin at the time of a transaction to prevent volatility",
      "It requires every transaction to be signed by at least three different people to be valid",
      "It automatically sends a portion of every transaction to a charity of the user's choice"
    ]
  },
  {
    "q": "What is 'BIP 39' and what does it define?",
    "a": "The standard for using a mnemonic sentence (seed phrase) to represent a wallet's recovery key",
    "w": [
      "The rules for how the Lightning Network routes payments between different users",
      "The technical specifications for the next Bitcoin halving event in 2028",
      "A new type of hardware wallet that uses biometrics for security instead of passwords",
      "The process for adding new developers to the Bitcoin Core repository on GitHub"
    ]
  },
  {
    "q": "What is 'Schnorr Signatures' (BIP 340)?",
    "a": "A more efficient and private way to sign Bitcoin transactions introduced with Taproot",
    "w": [
      "A new type of biometric security for hardware wallets that uses your fingerprint",
      "A way to sign Bitcoin transactions using only a physical pen and paper for security",
      "An upgrade that hides the total supply of Bitcoin from the rest of the world",
      "The term for when a user signs a transaction on behalf of another user for a fee"
    ]
  },
  {
    "q": "What was the significance of the BIP 66 soft fork activation in 2015 regarding the DER (Distinguished Encoding Rules) for ECDSA signatures?",
    "a": "It enforced strict DER encoding to prevent transaction malleability arising from non-canonical signature formats",
    "w": [
      "It replaced ECDSA with Schnorr signatures to improve privacy across the network",
      "It introduced a hard limit of 1 MB on all block sizes to prevent network congestion",
      "It allowed miners to skip signature verification for low-value transactions to speed up blocks",
      "It mandated that all transactions must use Segregated Witness for improved efficiency"
    ]
  },
  {
    "q": "During 'Initial Block Download' (IBD), which P2P message is used by a node to request a specific block from a peer after receiving an 'inv' message?",
    "a": "getdata (with inventory type MSG_BLOCK)",
    "w": [
      "getblocks (starting at the last known height)",
      "getheader (to verify the difficulty hash target)",
      "sendcompact (to initiate a fast block transfer)",
      "mempool (to sync unconfirmed transactions first)"
    ]
  },
  {
    "q": "What is the function of the 'nVersion' field in a Bitcoin block header specifically concerning 'Version Bits' (BIP 9)?",
    "a": "It serves as a bitmask where individual bits act as signal indicators for proposed soft fork features",
    "w": [
      "It tracks the number of previous blocks that have been verified by the current miner",
      "It stores the hash of the Merkle root for all transactions included in that block",
      "It determines the total amount of Bitcoin that can be mined in the current halving epoch",
      "It acts as a secondary nonce to prevent ASIC mid-state optimization by other miners"
    ]
  },
  {
    "q": "In the Lightning Network protocol, what is the role of the 'revocation_basepoint' during the channel update process?",
    "a": "It is used to derive the public key for the revocation secret, allowing a peer to claim funds if an old state is broadcast",
    "w": [
      "It establishes the maximum amount of Bitcoin that can be sent through a single payment path",
      "It determines the transaction fee that the routing node will earn for facilitating the payment",
      "It acts as a primary seed for generating the onion-routing layer of the payment packet",
      "It is used to encrypt the payment secret so that its value is hidden from third-party observers"
    ]
  },
  {
    "q": "What unique technical problem did the introduction of Bip 152 (Compact Blocks) solve for miners and nodes?",
    "a": "Block propagation latency by assuming nodes already have most of the transactions in their mempool",
    "w": [
      "Transaction fee volatility by allowing users to bid for block space in a decentralized auction",
      "Double-spending on the Lightning Network by enforcing strict on-chain settlement rules",
      "The 21 million supply limit by allowing nodes to vote on a dynamic inflation schedule",
      "The mining hardware monopoly by introducing a new PoW algorithm that is only compatible with home CPUs"
    ]
  },
  {
    "q": "What is the 'Annex' in a Taproot (BIP 341) transaction structure?",
    "a": "An optional, forward-compatible field for future protocol extensions included in the witness data",
    "w": [
      "A mandatory section of the script that records the physical location of the mining hardware",
      "A historical archive of every transaction sent by that specific public key since the genesis block",
      "A secondary signature that must be provided by a government agency for all high-value payments",
      "A localized database of peer IP addresses used to speed up the propagation of new blocks"
    ]
  },
  {
    "q": "What does 'SIGHASH_ANYPREVOUT' (BIP 118) propose to enable for the Lightning Network?",
    "a": "Eltoo (BIP 118), which simplifies channel state management by allowing any later state to override any earlier one",
    "w": [
      "A way to send Bitcoin to any address without requiring the recipient to have a private key",
      "A technique to hide the total amount of Bitcoin in every transaction from the public blockchain",
      "An upgrade that allows miners to spend transaction fees before the block is fully confirmed",
      "The ability to reverse any transaction within a 24-hour window if the sender makes a mistake"
    ]
  },
  {
    "q": "In Hierarchical Deterministic (HD) wallets (BIP 32), what is the difference between hardened and normal derivation?",
    "a": "Hardened derivation prevents an attacker from using a parent public key and child private key to discover other parent private keys",
    "w": [
      "Normal derivation is for mobile wallets while hardened derivation is reserved for hardware cold storage",
      "Hardened derivation uses SHA-256 while normal derivation uses the less secure MD5 hashing algorithm",
      "Normal derivation requires a 12-word seed while hardened derivation always requires a 24-word seed phrase",
      "There is no functional difference; the terms are used interchangeably by different wallet developers"
    ]
  },
  {
    "q": "What is 'OP_CODE_SEPARATOR' and why was its behavior significantly changed in Taproot?",
    "a": "It allows a script to be split into distinct segments for signature verification, and was modified to provide better efficiency and security in Taproot",
    "w": [
      "It is a command that separates Bitcoin transactions into different blocks based on their priority level",
      "It acts as a firewall that prevents nodes from being crashed by large and complex transaction scripts",
      "It is an old opcode that was deleted from the protocol in 2012 to reduce the total size of the blockchain",
      "It allows users to send multiple types of digital assets (tokens) in a single Bitcoin transaction"
    ]
  },
  {
    "q": "What is the purpose of the 'fee_filter' P2P message (BIP 133)?",
    "a": "It tells peers not to send invitations ('inv') for transactions with a fee rate below a specified threshold",
    "w": [
      "It automatically subtracts the transaction fee from the recipient's balance instead of the sender's",
      "It allows nodes to vote on what the minimum relay fee for the entire network should be for the next day",
      "It encrypts the fee information so that only the miner who finds the block can see how much they earned",
      "It prevents nodes from relaying any transactions that were sent from a blacklisted or flagged address"
    ]
  },
  {
    "q": "In the 2013 'BDB Lock Limit' chain split, what was the technical cause of the consensus failure between versions 0.7 and 0.8?",
    "a": "Version 0.7 used Berkeley DB with a hardcoded lock limit that was exceeded by a large block, while 0.8 used LevelDB which had no such limit",
    "w": [
      "A hacker successfully compromised the GitHub repository and introduced a bug into the source code of version 0.8",
      "A 51% attack by a large mining pool forced the network into two different versions of the history",
      "The 2013 block reward halving caused a massive drop in hash rate that led to the network splitting",
      "A disagreement over the block size limit led to a coordinated fork by a group of large exchanges and miners"
    ]
  },
  {
    "q": "What is 'MuSig2''s three-round communication requirement, and why is it preferred over the original MuSig (BIP 340 context)?",
    "a": "MuSig2 requires only two rounds of communication, making it more efficient for signers with limited connectivity",
    "w": [
      "MuSig2 and MuSig both require ten rounds of communication to ensure the signatures are mathematically secure",
      "Three rounds are required to ensure that every participant has an equal share of the total transaction fee",
      "It allows signatures to be verified by nodes that are not currently connected to the rest of the network",
      "MuSig2 actually requires five rounds of communication, which is why it is only used by large institutions"
    ]
  },
  {
    "q": "What is 'Transaction Malleability' and how did SegWit permanently solve it for all witness-including transactions?",
    "a": "The ability to change a transaction's ID ('txid') without invalidating the signature; solved by moving the signature out of the data hashed for the txid",
    "w": [
      "The ability to send more Bitcoin than you actually have in your wallet; solved by adding a second layer of verification",
      "The risk of a transaction being reversed by the sender after it has been confirmed; solved by making blocks immutable",
      "The problem of transaction fees being too high during periods of congestion; solved by increasing the total block size",
      "The technical difficulty of using Bitcoin for everyday payments; solved by introducing the Lightning Network protocol"
    ]
  },
  {
    "q": "In the context of Bitcoin Core, what does 'AssumeValid' do when a node is performing its first sync?",
    "a": "It skips script verification for blocks before a hardcoded checkpoint while still verifying the full chain of headers and proof-of-work",
    "w": [
      "It automatically assumes that every transaction in the mempool is legitimate and skips all verification steps entirely",
      "It allows the node to download the entire blockchain from a single trusted source instead of using the P2P network",
      "It provides a way to recover a lost seed phrase by assuming the owner's identity is valid based on prior transactions",
      "It is a setting that lets a node skip block validation entirely and trust whatever other nodes broadcast"
    ]
  },
  {
    "q": "How does the 'witness discount' in BIP 141 incentivizes users to adopt SegWit?",
    "a": "Witness data is weighted at 1 WU per byte, while base data is 4 WU, effectively making witness data 4x cheaper in terms of fee units",
    "w": [
      "Witness transactions receive a flat 21% discount on all network explorer fees",
      "The block reward is increased by 10% for any block that only contains SegWit data",
      "Nodes prioritize non-SegWit transactions during periods of high mempool congestion",
      "SegWit transactions are exempt from the 21 million supply cap if they use multisig"
    ]
  },
  {
    "q": "What is 'Sighash flags' and which one is used to allow adding inputs to a transaction after it has been signed?",
    "a": "SIGHASH_ANYONECANPAY",
    "w": [
      "SIGHASH_ALL",
      "SIGHASH_NONE",
      "SIGHASH_SINGLE",
      "SIGHASH_BLOCK_ONLY"
    ]
  },
  {
    "q": "In the context of UTXOs, what is an 'OP_RETURN' output primarily used for?",
    "a": "Storing arbitrary data (up to 80 bytes) in a provably unspendable script output",
    "w": [
      "Returning change to the sender in a more efficient compressed format",
      "Canceling a transaction that has been stuck in the mempool for too long",
      "Increasing the security of a hardware wallet through a second signature",
      "Sending Bitcoin to a legacy address that does not support newer script types"
    ]
  },
  {
    "q": "What is 'BIP 157' and 'BIP 158' (Client-Side Filtering) designed to improve for light clients?",
    "a": "Privacy, by allowing light clients to download and check filters locally instead of telling servers which addresses they own",
    "w": [
      "Speed, by allowing light clients to download the entire blockchain in under 10 seconds",
      "Decentralization, by requiring all light clients to also operate as full mining nodes",
      "Security, by encrypting the seed phrase of the light client and storing it on the blockchain",
      "Incentives, by paying light clients a small fee in sats for every transaction they verify"
    ]
  },
  {
    "q": "What is the role of the 'nLockTime' field in a Bitcoin transaction?",
    "a": "It specifies the earliest time or block height at which the transaction can be included in a block",
    "w": [
      "It locks the transaction fee at a fixed rate regardless of network congestion level",
      "It prevents anyone from seeing the recipient's address until the transaction is confirmed",
      "It determines which mining pool is allowed to process the transaction during a block",
      "It acts as a temporary password for a paper wallet that expires after one year"
    ]
  },
  {
    "q": "What is 'BIP 341' better known as, and what is its most innovative feature?",
    "a": "Taproot; it uses Schnorr signatures and Merkelized Abstract Syntax Trees (MAST) to improve privacy and smart contract efficiency",
    "w": [
      "SegWit; it increases the block size limit to 2 MB for all legacy nodes",
      "Lightning; it creates a second layer for instant payments with zero confirmations",
      "Ordinals; it allows users to engrave images directly onto satoshis in the blockchain",
      "Schnorr; it replaces the Bitcoin hashing algorithm with a more secure version"
    ]
  },
  {
    "q": "In the context of BIP 32, what is an 'Extended Public Key' (xpub) and what is its primary security risk?",
    "a": "It allows the derivation of all child public keys; the primary risk is that if a child private key is leaked, the parent private key can be derived",
    "w": [
      "It is a key that can only be used to spend Bitcoin from a hardware wallet",
      "It allows a user to see the balances of every other Bitcoin user on the network",
      "It is an encrypted version of the seed phrase that can be shared on social media",
      "It is a new type of Bitcoin address that is incompatible with most exchanges"
    ]
  },
  {
    "q": "What is 'RBF' (Replace-By-Fee) and why is it often disabled on 'Zero-Conf' (zero confirmation) services?",
    "a": "It allows a sender to replace a transaction with one that has a higher fee; it makes double-spending unconfirmed transactions easier",
    "w": [
      "It is a process for reducing the total supply of Bitcoin through fee burning",
      "It automatically increases the security of a transaction by 21% every minute",
      "It allows a user to change the recipient of a transaction after it is confirmed",
      "It is a technique for mining Bitcoin using only the processing power of a web browser"
    ]
  },
  {
    "q": "What is the 'Block Header' size in bytes, and which field within it takes up the most space?",
    "a": "80 bytes; no single field dominates (Version 4, Prev Block 32, Merkle Root 32, Time 4, Bits 4, Nonce 4)",
    "w": [
      "1024 bytes; the list of all transaction IDs in the block",
      "256 bytes; the digital signature of the miner who found the block",
      "80 bytes; the Merkle Root of all transactions",
      "1 MB; the total data of all transactions included in the block"
    ]
  },
  {
    "q": "What is 'BIP 85' and what problem does it solve for users with many wallets?",
    "a": "Deterministic Entropy From Mnemonic; it allows deriving multiple mnemonics from a single master seed",
    "w": [
      "Multi-Wallet Backup; it automatically copies all your wallets to a secure cloud server",
      "Entropy Randomization; it creates a new seed phrase for your wallet every 24 hours",
      "Universal BIP Link; it allows you to link your Bitcoin wallet to your bank account",
      "Master Key Recovery; it provides a way to recover a lost 24-word seed with 12 words"
    ]
  },
  {
    "q": "In the 2017 'SegWit2x' controversy, what was the primary reason the community rejected the hard fork proposal?",
    "a": "It was a corporate-led agreement that ignored user consensus and sought to increase the block size via a hard fork",
    "w": [
      "The code for SegWit2x was found to have a critical bug that would have stolen all users' coins",
      "Satoshi Nakamoto returned and posted a message on Bitcointalk condemning the proposal",
      "The mining rewards would have been cut by 90% instead of 50% during the next halving",
      "The upgrade would have replaced Bitcoin's supply cap of 21 million with 42 million"
    ]
  },
  {
    "q": "What is 'ASIC' (Application-Specific Integrated Circuit) and how did its introduction affect Bitcoin decentralization?",
    "a": "Hardware designed solely for mining; it significantly increased hash rate but made home mining with CPUs/GPUs unprofitable",
    "w": [
      "A new software protocol that allowed mobile phones to mine Bitcoin more efficiently",
      "An algorithm that automatically detects and blocks mining pools that get too large",
      "A hardware device that allows users to run a full Bitcoin node on a television set",
      "A set of international regulations that limit how many mining rigs a person can own"
    ]
  },
  {
    "q": "What is 'BIP 118' (SIGHASH_ANYPREVOUT) and why is it important for the future of the Lightning Network?",
    "a": "It allows a transaction to bind to any previous output that matches a script, enabling the 'Eltoo' layer 2 protocol",
    "w": [
      "It increases the number of signatures required for any multisig wallet by five",
      "It provides a way to encrypt all Bitcoin transactions so they are invisible to nodes",
      "It allows a user to reverse a Lightning payment if the recipient is not online",
      "It is a new hashing algorithm that will replace SHA-256 for all mining hardware"
    ]
  },
  {
    "q": "What is 'BIP 44' and how does it define the standard derivation path for Bitcoin wallets?",
    "a": "m / purpose' / coin_type' / account' / change / address_index (e.g., m/44'/0'/0'/0/0)",
    "w": [
      "m / bitcoin' / user' / security' / key / index (e.g., m/1/2/3/4/5)",
      "m / 21' / 0' / 0' / 0 / 1 (to represent the 21 million supply limit)",
      "m / satoshi' / halving' / mining' / block / hash",
      "m / seed / words / derivation / bip39 / standard"
    ]
  },
  {
    "q": "What is 'Fee Sniping' and how does Bitcoin Core's 'nLockTime' anti-fee-sniping protect the network?",
    "a": "Miners re-mining a high-fee block to take the rewards; nodes discourage this by setting a transaction's nLockTime to the current block height",
    "w": [
      "A type of hacking where a user steals transaction fees from other users' wallets",
      "The practice of paying a very low fee and then waiting for a miner to pick it up",
      "A marketing strategy used by exchanges to offer zero-fee trading to new users",
      "A technique for increasing the speed of the Lightning Network by snacking fees"
    ]
  },
  {
    "q": "What is 'BIP 174' (PSBT - Partially Signed Bitcoin Transactions) and how does it improve cold storage security?",
    "a": "It allows a transaction to be passed between different devices (e.g., wallet to hardware signer) for signatures without exposing private keys",
    "w": [
      "It allows a transaction to be partially confirmed by nodes before it is fully signed",
      "It splits a single transaction into 174 smaller parts to hide the total amount sent",
      "It encrypts the recipient's address so it can only be read by the sender's hardware wallet",
      "It provides a way to recover a lost seed phrase by signing a special PSBT message"
    ]
  },
  {
    "q": "What is 'Recursive Snarks' and are they currently a part of the Bitcoin protocol?",
    "a": "No; they are a cryptographic compression technique used by some altcoins, but not Bitcoin, which prioritizes simple, auditable scripts",
    "w": [
      "Yes; they were added to Bitcoin in 2021 as part of the Taproot protocol upgrade",
      "Yes; they are used by miners to find valid block hashes without using ASIC hardware",
      "No; they are a type of malware that tries to steal private keys from desktop wallets",
      "Yes; they are a type of Bitcoin address that starts with 'snark1' and is very fast"
    ]
  },
  {
    "q": "What is 'BIP 21' and what does it define for Bitcoin URI schemes?",
    "a": "A standard way to represent Bitcoin payment requests in a single link or QR code containing address, amount, and label",
    "w": [
      "The rules for how to run a Bitcoin node on a computer with only 21 MB of RAM",
      "The technical specifications for the 21st anniversary celebration of the Genesis Block",
      "A new type of mining hardware that is 21 times more efficient than standard ASICs",
      "The process for creating a new Bitcoin exchange that only operates in the United States"
    ]
  },
  {
    "q": "What is 'Sighash_Single' and what are the known pitfalls of using it?",
    "a": "It signs only the corresponding input and output index; it can lead to funds being burned if the output is not provided properly during transaction construction",
    "w": [
      "It allows you to sign a transaction with a single word from your seed phrase",
      "It encrypts the entire transaction so it can only be seen by exactly one miner",
      "It automatically increases the fee of a transaction if it is not confirmed in one single block",
      "It allows multiple people to share a single private key without risking their security"
    ]
  },
  {
    "q": "What is 'BIP 143' and why was it necessary for SegWit transactions?",
    "a": "It introduced a new signature hashing algorithm to prevent the quadratic hashing problem in large transactions",
    "w": [
      "It provided a standard way to represent images and text on the Bitcoin blockchain",
      "It allowed for the creation of smart contracts that do not require any transaction fees",
      "It mandated that all nodes must have at least 143 GB of free storage to run",
      "It introduced a new block header format that includes the hash of the last 143 blocks"
    ]
  },
  {
    "q": "What is 'Scriptless Scripts' and which Bitcoin upgrade laid the foundation for them?",
    "a": "A way to execute smart contracts off-chain using adaptor signatures, made possible by Schnorr signatures in Taproot",
    "w": [
      "A new programming language for Bitcoin that looks like Python but runs on the stack",
      "A feature that allows you to send Bitcoin using only a voice command and no keys",
      "An upgrade to the mempool that allows transactions to be scripts that never settle",
      "A technique for mining Bitcoin using only physical paper scripts for security"
    ]
  },
  {
    "q": "What is 'BIP 68' (Relative Lock-time using sequence numbers) primarily used for?",
    "a": "Creating outputs that cannot be spent until a relative amount of time or blocks have passed since the output was confirmed",
    "w": [
      "Locking the total supply of Bitcoin at 21 million for exactly 68 years",
      "Preventing nodes from seeing a transaction until at least 68 minutes have passed",
      "Automatically reducing the fee of a transaction by 68% every time it is relayed",
      "Rewarding miners with an extra 68 sats if they find a block during a halving year"
    ]
  },
  {
    "q": "What is the 'Checklocktimeverify' (CLTV) opcode and how does it differ from 'Checksequenceverify' (CSV)?",
    "a": "CLTV uses absolute time or block height; CSV uses relative time or block counts relative to confirmation",
    "w": [
      "CLTV is for Lightning Network payments only while CSV is for on-chain Bitcoin transactions",
      "CSV encrypts the transaction while CLTV provides a way to verify the digital signature",
      "CLTV allows you to send Bitcoin to the future while CSV is only for past transactions",
      "CSV stands for 'Central Satoshi Vault' while CLTV stands for 'Chain Link Time Verify'"
    ]
  },
  {
    "q": "What is the 'Bitcoin P2P protocol version' handshake process?",
    "a": "Version -> Verack; nodes exchange capabilities and confirm they understand each other's protocol version",
    "w": [
      "Hello -> Hi; nodes exchange their IP addresses and a list of their favorite miners",
      "Connect -> OK; nodes establish a secure VPN tunnel to hide their local traffic",
      "Ping -> Pong; nodes measure the distance between them to optimize block propagation",
      "Syn -> Ack; nodes use standard TCP handshakes to confirm they are online"
    ]
  },
  {
    "q": "What is 'UTXO Commitments' (BIP 158/UTXO sets) and what problem do they aim to solve for Light Clients?",
    "a": "Allowing light clients to verify that a UTXO is truly unspent without downloading the entire blockchain",
    "w": [
      "Encouraging light clients to commit all of their Bitcoin to a single long-term savings goal",
      "Allowing users to trade their UTXOs on a decentralized marketplace for other assets",
      "Providing a way for miners to claim transition fees for moving UTXOs between blocks",
      "Mandating that all UTXOs older than 10 years must be committed to a developer fund"
    ]
  },
  {
    "q": "In the context of mining, what is a 'Midstate' and why is it reused in ASICBoost?",
    "a": "The intermediate state of the SHA-256 compression function; reusing it reduces the total work needed by 13-15%",
    "w": [
      "The state of a block after exactly 50% of its transactions have been verified by a node",
      "A technique for mining Bitcoin using a computer located in the middle of two data centers",
      "The point at which a miner reaches exactly half of the target number required for a hash",
      "A backup copy of the blockchain that is stored in the cloud for emergency recovery"
    ]
  },
  {
    "q": "What is 'BIP 125' (Opt-in Replace-by-Fee) and how does a user signal their intention to use it?",
    "a": "By setting at least one input's nSequence number to a value below 0xffffffff-1",
    "w": [
      "By including the word 'RBF' in the transaction's optional memo field",
      "By paying a fee that is at least 125 sats higher than the current network average",
      "By signing the transaction with a special hardware wallet that supports BIP 125",
      "By sending the transaction to a specific node address that is managed by the miners"
    ]
  },
  {
    "q": "What is 'Signature Aggregation' and why is it considered a major efficiency improvement in Taproot?",
    "a": "It allows multiple signatures in a multisig transaction to be combined into one, reducing transaction size and fees",
    "w": [
      "It allows a user to sign their name in cursive on a digital tablet to spend Bitcoin",
      "It automatically adds all the transaction fees in a block into a single large prize for miners",
      "It combines all of your separate wallets into one single 'super wallet' for easier management",
      "It provides a way for nodes to aggregate all their transaction data into a single 1 MB file"
    ]
  },
  {
    "q": "What is 'BIP 322' (Generic Signed Message Format) and what does it replace?",
    "a": "It provides a standard way to sign messages using any Bitcoin script, replacing the legacy 'signmessage' format",
    "w": [
      "It replaces the current 21 million supply limit with a dynamic, rules-based inflation schedule",
      "It is a new type of Bitcoin address that is compatible with all previous versions of the network",
      "It replaces the Bitcoin proof-of-work algorithm with a more secure version based on prime numbers",
      "It is a regulation that replaces the current KYC requirements with a truly anonymous system"
    ]
  },
  {
    "q": "What is 'P2WSH' (Pay-to-Witness-Script-Hash) and how does it relate to SegWit?",
    "a": "It is the SegWit version of P2SH, where the script itself is moved to the witness data area",
    "w": [
      "It is a new type of mining hardware that is only compatible with SegWit-enabled nodes",
      "It allows a user to send Bitcoin to a script that cannot be spent for at least ten years",
      "It is an upgrade that encrypts the transaction script hash so it cannot be read by anyone",
      "It is a way to pay for goods and services using only a witness's signature and no keys"
    ]
  },
  {
    "q": "What is 'BIP 65' (OP_CHECKLOCKTIMEVERIFY) and what category of Bitcoin applications does it enable?",
    "a": "It allows for absolute timelocks, enabling escrow services and complex payment channel structures",
    "w": [
      "It allows for anonymous payments, enabling or providing a truly censorship-resistant network",
      "It provides a way to verify the identity of a Bitcoin user using their social security number",
      "It enables the creation of decentralized exchanges that can trade Bitcoin for gold and silver",
      "It is a process for auditing the total supply of Bitcoin to ensure it matches the 21 million goal"
    ]
  },
  {
    "q": "What is 'BIP 147' (Dummy Stack element for multisig) and what was it designed to fix?",
    "a": "A malleability fix for the legacy OP_CHECKMULTISIG bug that required an extra 'dummy' element on the stack",
    "w": [
      "A way to add a second signature to a transaction for two-factor authentication",
      "A technique for mining Bitcoin using only dummy hardware that does not use any power",
      "A protocol for sending Bitcoin to users who do not yet have a wallet or public key",
      "A regulation that requires all Bitcoin users to keep at least 147 sats in their wallet"
    ]
  },
  {
    "q": "What is 'BIP 112' (OP_CHECKSEQUENCEVERIFY) and what is its role in the Lightning Network?",
    "a": "It enables relative timelocks, which are essential for creating the breach remedy transactions in LN channels",
    "w": [
      "It allows users to sequence their transactions in alphabetical order for easier blockchain auditing",
      "It provides a way to verify the sequence of numbers in your seed phrase using a second device",
      "It is a new type of Bitcoin address that starts with 'csv' and is used only for Lightning payments",
      "It allows a node to vote on the next block's transaction sequence to prevent miner front-running"
    ]
  },
  {
    "q": "In the context of SegWit, what is a 'Virtual Byte' (vByte) and how is it calculated?",
    "a": "A measure of transaction size where witness data is counted as 1/4 the weight of other data; vByte = Total Weight / 4",
    "w": [
      "A new unit of measure for the total amount of energy that is used to find a block",
      "A way to represent the total number of Bitcoin that have ever been lost from the network",
      "A measure of transaction speed calculated by dividing the fee by the block height",
      "A unit of storage used to measure how much space a single transaction takes on a hardware wallet"
    ]
  },
  {
    "q": "What is 'BIP 324' (P2P Encryption) and what does it aim to prevent for Bitcoin nodes?",
    "a": "Traffic analysis and man-in-the-middle attacks by encrypting the communication between peer nodes",
    "w": [
      "Double-spending attacks by encrypting all transactions before they are sent to the mempool",
      "Mining centralization by encrypting the location and IP address of all active miners",
      "The risk of nodes being hacked by quantum computers through advanced encryption standards",
      "Government surveillance of individual user addresses by encrypting the public blockchain"
    ]
  },
  {
    "q": "What is 'BIP 173' and which address format did it introduce?",
    "a": "Bech32; a native SegWit address format (starting with bc1) that is more efficient and provides better error detection",
    "w": [
      "P2SH; an address format starting with 3 that allows for multisig and escrow payments",
      "Legacy; the original Bitcoin address format starting with 1 created by Satoshi Nakamoto",
      "Lightning; a temporary address format used to open payment channels on the second layer",
      "Taproot; a new address format starting with bc2 that uses Schnorr signatures for privacy"
    ]
  },
  {
    "q": "What is 'UTXO Consolidating' and why is it best performed during a period of low block space demand?",
    "a": "Combining many small inputs into one output to reduce the fee-sensitive weight of future transactions",
    "w": [
      "Deleting multiple separate wallets and moving all Bitcoin to a single 24-word seed phrase",
      "Selling all small fragments of Bitcoin for other cryptocurrencies that have lower transaction fees",
      "Requesting that a miner combines your transactions for you to save on network network fees",
      "Allowing a third-party vault to hold your small UTXOs in exchange for a monthly interest payment"
    ]
  },
  {
    "q": "What is 'BIP 155' and what does it enable for Bitcoin node connectivity?",
    "a": "Support for Tor v3 addresses and other long-lived peer identifiers, improving P2P privacy",
    "w": [
      "A way to connect Bitcoin nodes to the internet using only satellite links and no IP address",
      "support for connecting Bitcoin nodes to traditional bank accounts for instant settlements",
      "An upgrade that allows nodes to vote on which transactions should be included in the next block",
      "A regulation that requires all nodes to register their physical location with a central agency"
    ]
  },
  {
    "q": "In the context of BIP 39, why is the 12th or 24th word often called the 'Checksum' word?",
    "a": "It includes an 8-bit or 4-bit checksum of the previous entropy bits to detect accidental word errors",
    "w": [
      "It is a word that confirms the user has worked for at least 24 hours to earn their Bitcoin",
      "It is a secret password that allows the user to check their balance from any web browser",
      "It is a word that changes every time the user spends Bitcoin to provide better privacy protection",
      "It is the only word in the seed phrase that does not need to be kept secret from other people"
    ]
  },
  {
    "q": "What is 'OP_CSV' (CheckSequenceVerify) and how does it prevent a 'Breach' in a Lightning channel?",
    "a": "It relative timelocks the 'justice' transaction, ensuring a cheater cannot claim funds immediately after a breach",
    "w": [
      "It encrypts the Lighting channel so that no one can see how much Bitcoin is stored inside",
      "It automatically reverses any Lighting payment that is sent to a flagged or blacklisted node",
      "It requires both parties to sign a physical contract before a channel can be opened on-chain",
      "It increases the fee of a transaction every minute until it is confirmed by the Bitcoin network"
    ]
  },
  {
    "q": "What is 'Bip 340' and what is the mathematical advantage of Schnorr over ECDSA?",
    "a": "Linearity; it allows for simple multi-party signature aggregation and more efficient verification",
    "w": [
      "Complexity; it uses 256-bit prime numbers to make the signatures impossible to hack by AI",
      "Speed; it allows signatures to be verified 100x faster than traditional bank signatures",
      "Privacy; it hides the total amount of Bitcoin in every transaction from everyone on the network",
      "Scarcity; it reduces the number of signatures that can be created for a single wallet address"
    ]
  },
  {
    "q": "What is 'The BIP 9 State Machine' and how does it manage soft fork activations?",
    "a": "Defined -> Started -> LockedIn -> Active; a structured process for miners to signal readiness for upgrades",
    "w": [
      "On -> Off; a simple switch that miners can use to enable or disable new protocol features",
      "Vote -> Pass -> Fail; a democratic process where all Bitcoin users vote on new code changes",
      "Alpha -> Beta -> Release; a standard software development cycle used by the Bitcoin Core team",
      "Open -> Closed; a way for nodes to signal whether they are willing to accept new connections"
    ]
  },
  {
    "q": "What is 'BIP 34' and what was its role in block versioning?",
    "a": "It introduced the block height as the first element in the coinbase script to prevent duplicated hashes",
    "w": [
      "It increased the block reward to 34 Bitcoin for one year to mark the anniversary of the whitepaper",
      "It established the '34 rule' which prevents any developer from making more than 34 changes a year",
      "It provided a way for nodes to automatically connect to at least 34 other peers on the network",
      "It defined the 34-word seed phrase standard for use in high-security hardware wallets"
    ]
  },
  {
    "q": "In the context of SegWit, what is the 'Weight Limit' of a block in weight units?",
    "a": "4,000,000 weight units (equating to a theoretical maximum individual block size of ~4 MB)",
    "w": [
      "1,000,000 weight units; this is the same as the legacy 1 MB limit for all earlier blocks",
      "21,000,000 weight units; to match the absolute supply cap of the Bitcoin monetary network",
      "42,000 weight units; each transaction is capped at this weight to prevent mempool spam",
      "Unlimited; there is no weight limit in SegWit, blocks can grow as large as needed by miners"
    ]
  },
  {
    "q": "What is 'OP_NOP' and what is its primary purpose in Bitcoin Script history?",
    "a": "No-Operation; it does nothing on the stack and was intended as a placeholder for future soft-fork upgrades",
    "w": [
      "New-Operation; it is the command used by miners to start a new block search after finding one",
      "Network-Option; it allows nodes to toggle between different versions of the communication protocol",
      "Nullify-Output; it is an old opcode that was used to delete transactions from the blockchain",
      "Nonce-Order-Prefix; it determines the order in which a miner guesses random numbers in a block"
    ]
  },
  {
    "q": "What is 'The block template' and which P2P message do miners use to request it from a node?",
    "a": "A candidate block containing transactions; miners typically use RPC calls like getblocktemplate",
    "w": [
      "A list of all transaction IDs in the mempool; miners use the 'inv' message to request it",
      "A physical piece of paper containing the whitepaper; miners are required to own it by law",
      "A backup copy of the blockchain stored on a server; miners use 'getdata' to request it",
      "A specialized hardware device that creates valid hashes; miners use 'version' to request it"
    ]
  },
  {
    "q": "What is 'BIP 152' (Compact Blocks) and what are the two modes of operation it defines?",
    "a": "High-bandwidth and Low-bandwidth; they optimize block relay based on node resources and local mempool state",
    "w": [
      "Private and Public; they determine whether a block's transactions should be encrypted on the blockchain",
      "Fast and Slow; they allow nodes to trade off between propagation speed and network security during a sync",
      "Mobile and Desktop; they optimize block downloads for different types of hardware and internet connections",
      "Active and Passive; they determine whether a node should help find blocks or only verify them for others"
    ]
  },
  {
    "q": "Who is 'Adam Back' and what was his contribution to the 'Hashcash' proposal?",
    "a": "The inventor of Hashcash (1997), which featured the proof-of-work system used in Bitcoin mining",
    "w": [
      "The founder of the first Bitcoin exchange in Europe and the creator of the first paper wallet",
      "A software engineer who was hired by Satoshi Nakamoto to help with the initial release of Bitcoin",
      "A government official who was the first to recognize Bitcoin as a legitimate form of digital currency",
      "The first person to mine more than 10 blocks in a single day using an ASIC mining rig in 2012"
    ]
  },
  {
    "q": "What is 'BIP 174' (PSBT) and how does it enable multi-vendor signing workflows?",
    "a": "A standardized format for passing unsigned transactions between DIFFERENT software and hardware signers",
    "w": [
      "A new type of Bitcoin address that is compatible with all hardware and software wallets globally",
      "A way to send a single transaction to 174 different people at the same time to save on network fees",
      "A security protocol that requires all signers to be in the same physical room to authorize a payment",
      "A regulation that requires all vendors to accept Bitcoin as payment if they have at least 174 customers"
    ]
  },
  {
    "q": "What is 'UTXO Bloom Filters' and why were they largely replaced by 'Compact Client Side Filtering' (BIP 157/158)?",
    "a": "They were privacy-leaking because they told the server which addresses users own; compact filters move checking to the client",
    "w": [
      "They were too small to hold all the users' Bitcoin and would often overflow during a busy block",
      "They were used by hackers to steal private keys from mobile phones and were banned by developers",
      "They made Bitcoin transactions 50% slower and were replaced to increase the network's throughput",
      "They were a new type of mining hardware that was found to be inefficient compared to ASIC rigs"
    ]
  },
  {
    "q": "What is 'BIP 66' and what technical risk did it address by enforcing strict DER encoding for signatures?",
    "a": "Consensus failure risk; non-strict encoding could lead to some nodes accepting a block while others rejected it",
    "w": [
      "Double-spending risk; it prevented users from sending the same Bitcoin to two different people at once",
      "Satoshi risk; it ensured that the network would continue to work even if the creator's key was hacked",
      "Inflation risk; it made it impossible to create more than 21 million Bitcoin through a signature bug",
      "Privacy risk; it prevented third-party observers from identifying users based on their signature style"
    ]
  },
  {
    "q": "What is 'The Lightning Network Pathfinding' and what algorithm do nodes typically use to find the cheapest route?",
    "a": "Dijkstra's Algorithm; nodes weight channel edges by fee and liquidity to find the lowest-cost successful path",
    "w": [
      "SHA-256; nodes hash all possible paths and pick the one with the most leading zeros for security",
      "The Gossip Algorithm; nodes ask their neighbors for their best path and then copy whatever they say",
      "The Bitcoin Algorithm; nodes try every possible path until they find one that has a ten-minute block time",
      "A random choice; nodes pick a random path and hope that it has enough liquidity to move the funds"
    ]
  },
  {
    "q": "In the context of SegWit, what is the 'Virtual Size' (vsize) and why is it used for fee calculation?",
    "a": "Total weight divided by 4; it normalizes the fee contribution of witness and non-witness data for the 1MB limit",
    "w": [
      "The total size of a transaction when converted into a digital image for storage on a hardware wallet",
      "A measure of how much Bitcoin is stored in a transaction compared to the total supply of 21 million",
      "The actual physical size of a transaction in bytes when it is transmitted through a satellite link",
      "The total size of all transactions in a block when they are compressed for a faster mobile download"
    ]
  },
  {
    "q": "What is 'BIP 152' (Compact Blocks) 'Short Transaction IDs' and how are they calculated to prevent collisions?",
    "a": "They are 6-byte truncated SipHash-2-4 hashes derived from transaction IDs and a block-specific shared salt",
    "w": [
      "They are a random list of 10-word seed phrases that represent the transactions in a block header",
      "They are the first few characters of the recipient's public key for every transaction in a block",
      "They are sequential numbers starting from 1 for every transaction that is included in the mempool",
      "They are the total fee paid for each transaction converted into a binary format for faster relay"
    ]
  },
  {
    "q": "Who is 'Pieter Wuille' and what are two major Bitcoin upgrades he is fundamentally known for proposing?",
    "a": "A Bitcoin Core developer; he co-authored Segregated Witness (BIP 141) and Taproot (BIP 341)",
    "w": [
      "The creator of the first Bitcoin exchange in Japan and the developer of the original SegWit code",
      "A cryptographer who proposed Bit Gold and the inventor of the SHA-256 algorithm used in mining",
      "A government official who helped regulate Bitcoin and the developer of the first hardware wallet",
      "A software engineer who founded the Bitcoin Foundation and proposed the 21 million supply limit"
    ]
  },
  {
    "q": "What is 'The UTXO Set Serialization' format (BIP 301) and what is its role in node synchronization?",
    "a": "A format for storing only unspent outputs in an ordered, compact way for faster loading of the node database",
    "w": [
      "A way to encrypt the entire history of the blockchain to prevent nodes from being hacked by banks",
      "A process for converting Bitcoin into gold tokens that can be traded on other non-Bitcoin networks",
      "A regulation that requires all nodes to synchronize with at least 301 other peers on the network",
      "A tool for mining Bitcoin using only the processing power of a high-performance graphics card"
    ]
  },
  {
    "q": "What is 'BIP 38' and what does it define for physical Bitcoin cold storage?",
    "a": "A standard for passphrase-protected private keys, allowing them to be safely shared or printed (e.g. on paper wallets)",
    "w": [
      "The technical specifications for the next Bitcoin halving event which will occur in 2140",
      "A method for encrypting the total supply of Bitcoin so it can only be seen by a mining node",
      "A set of international standards for the manufacturing of Bitcoin-related hardware devices",
      "The process for creating a new Bitcoin address that is compatible with all banking institutions"
    ]
  },
  {
    "q": "What is 'BIP 118' (ANYPREVOUT) and which Lightning optimization does it fundamentally enable?",
    "a": "Eltoo; it simplifies channel state by allowing later transactions to spend from any earlier state's output",
    "w": [
      "Lightning; it increases the speed of payments by 118% through a new routing protocol based on TOR",
      "Privacy; it hides the total amount of Bitcoin in every channel from everyone including the miners",
      "Mining; it allows miners to receive their block reward in two different currencies at the same time",
      "Ordinals; it provides a way to engrave up to 118 bytes of text onto every single satoshi in a block"
    ]
  },
  {
    "q": "In the context of SegWit, what is 'Weight' and how does it relate to the 1MB block size limit?",
    "a": "A new limit (4 million weight units) that replaces the 1MB limit, allowing blocks to be effectively larger (~2 MB)",
    "w": [
      "A measure of how heavy the physical mining rigs are; it has no relationship to the block size limit",
      "The total number of Bitcoin that have ever been mined multiplied by the current price of one coin",
      "A unit of measure for transaction speed calculated by dividing the fee amount by the block height",
      "The total amount of memory that is used by a node to store the entire blockchain on its hard drive"
    ]
  },
  {
    "q": "What is 'OP_CSV' (CheckSequenceVerify) and how does it prevent a 'Time-Lock Breach'?",
    "a": "It relative timelocks an output, ensuring it can only be spent after a specific number of confirmational blocks",
    "w": [
      "It encrypts the transaction script to ensure that no one can see the recipient's address until a year later",
      "It automatically increases the fee of a transaction if it is not confirmed by a miner in ten minutes",
      "It provides a way for nodes to verify that a transaction was sent from a hardware wallet for security",
      "It is only compatible with the very first version of Bitcoin and cannot be used with SegWit transactions"
    ]
  },
  {
    "q": "What is 'The Bitcoin Core Initial Block Download' (IBD) process for a new node?",
    "a": "Downloading and verifying every block from the genesis block to the current tip to build the full chain index",
    "w": [
      "Downloading a summary of the blockchain from a bank and then mining a few blocks to confirm its accuracy",
      "Connecting to exactly one other node and copying its entire folder content to your computer's RAM",
      "Buying a physical copy of the blockchain on a USB drive and then plugging it into your mining hardware",
      "Downloading a certificate from the Bitcoin website to verify your hardware meets the minimum specifications"
    ]
  },
  {
    "q": "What is 'BIP 152' (Compact Blocks) 'High-Bandwidth' mode and why is it preferred by miners?",
    "a": "Nodes send new blocks to peers immediately without waiting for a request, minimizing propagation time for miners",
    "w": [
      "Nodes download blocks using a satellite link to increase their processing speed by at least 152%",
      "Miners are allowed to include transactions with zero fees to mark the anniversary of the whitepaper",
      "A new type of mining hardware that uses high-bandwidth fiber optic cables to connect to a pool server",
      "A regulation that requires all nodes to have a high-bandwidth internet connection to participate in mining"
    ]
  },
  {
    "q": "What is 'BIP 158' (Compact Client-Side Filtering) and how does it differ from traditional Bloom filters?",
    "a": "Nodes provide a filter for each block that light clients check locally, significantly improving user privacy",
    "w": [
      "Light clients download the entire blockchain and check every single transaction to ensure they own it",
      "Nodes encrypt all transactions in a block and only allow light clients with a valid ID to see them",
      "It allows light clients to mine Bitcoin on their mobile phones to earn 21 sats every block they find",
      "It provides a way for users to link their Bitcoin wallet to their bank account for instant fiat swaps"
    ]
  },
  {
    "q": "What is 'BIP 8' and how does it differ from 'BIP 9' regarding soft fork activation mandatory signaling?",
    "a": "BIP 8 introduces 'LOT=true' (Lockin On Timeout), allowing an upgrade to be activated even without miner signaling",
    "w": [
      "BIP 8 is for hardware upgrades while BIP 9 is for software patches to the Bitcoin Core source code",
      "BIP 8 requires 8% of nodes to signal while BIP 9 requires 9% for a new soft fork to be activated",
      "BIP 8 and BIP 9 are exactly the same; the numbers just refer to the different development years",
      "BIP 8 is a regulation that mandates all Bitcoin users must have their own personal mining hardware"
    ]
  },
  {
    "q": "In the context of SegWit, what is the 'Discount Factor' for witness data and how does it impact fee density?",
    "a": "0.25 (or 4x); witness data is 'cheaper,' allowing for more fee density in transactions containing witness data",
    "w": [
      "0.21 (to match the supply cap); witness data is 21% more expensive than on-chain non-witness transactions",
      "1.0; SegWit removed all discounts and made every byte of data on the blockchain cost exactly the same fee",
      "2.0; witness data is twice as large as base data, so it requires double the transaction fee to be valid",
      "The discount factor changes every day based on the total number of users active on the Lightning Network"
    ]
  },
  {
    "q": "What is 'OP_CSV' (CheckSequenceVerify) and how does it relate to 'OP_CLTV' (CheckLockTimeVerify)?",
    "a": "CSV is for relative timelocks (X blocks after confirmation); CLTV is for absolute timelocks (Block height X)",
    "w": [
      "CSV is for the Lightning Network while CLTV is only for on-chain Bitcoin transactions between large owners",
      "CSV encrypts the transaction script while CLTV allows for the creation of a 12-word seed phrase backup",
      "CSV and CLTV are exactly the same opcode used by different Bitcoin developers for the same purpose",
      "CSV stands for 'Central Satoshi Vault' while CLTV stands for 'Chain Link Transition Verify'"
    ]
  },
  {
    "q": "What is 'The Bitcoin Core Headers-First' sync and why is it faster than the legacy sync method?",
    "a": "Nodes download and verify headers (80 bytes) first to build a skeleton of the chain, then fetch transaction data",
    "w": [
      "Nodes download the last 100 blocks first and then work backwards until they reach the genesis block hash",
      "Nodes use a satellite to download the entire blockchain in under 10 seconds without using an IP address",
      "Nodes only download transactions that were sent by people with a verified identity for faster syncing",
      "Nodes skip all verification steps and just assume the blockchain is valid until they find a bug or hack"
    ]
  },
  {
    "q": "What is 'BIP 152' (Compact Blocks) 'Low-Bandwidth' mode and when is it typically used by nodes?",
    "a": "Nodes request block transactions only after being notified by a peer; used to save bandwidth on slower links",
    "w": [
      "Nodes download blocks as a text file to reduce the total size by at least 152% for mobile phone users",
      "Miners are allowed to only include their own transactions in a block to mark the anniversary of Bitcoin",
      "It is a new type of mining pool that is only compatible with nodes that have a dial-up internet connection",
      "A regulation that requires all nodes to only connect to at least one peer to participate in the network"
    ]
  },
  {
    "q": "What is 'BIP 2' and what is its role in the Bitcoin Improvement Proposal process hierarchy?",
    "a": "It describes the BIP process itself, defining different BIP types (Standard, Informational, Process)",
    "w": [
      "It defined the second version of the Bitcoin protocol which included the Lightning Network layer",
      "It established the 'two-person rule' where every code change must be signed by at least two people",
      "It provided a standard for using only two words as a seed phrase for low-security Bitcoin wallets",
      "It defined the 2-minute block time which was proposed but rejected in 2012 by Satoshi Nakamoto"
    ]
  },
  {
    "q": "In the context of Taproot, what is a 'Tapleaf' and what does it represent in the MAST structure?",
    "a": "An individual leaf node in the Merkle Tree containing a specific script for spending an output",
    "w": [
      "A physical leaf from a tree in El Salvador that is used to represent the 21 million supply goal",
      "A new type of Bitcoin address starting with 'tl1' that is only used for high-value payments",
      "The signature of the 1,000th Bitcoin developer that was used to activate the Taproot soft-fork",
      "A backup copy of the whitepaper that is engraved onto a block using the Taproot protocol"
    ]
  },
  {
    "q": "What is 'OP_SECURE' and is it a standard opcode currently in the Bitcoin protocol?",
    "a": "No; it is not a standard opcode. Bitcoin prioritizes simple, auditable opcodes for consensus safety",
    "w": [
      "Yes; it was added in 2017 to encrypt all Bitcoin transactions so they are invisible to nodes",
      "Yes; it is the command used to lock a hardware wallet after three incorrect PIN attempts",
      "No; it is a type of malware that tries to steal private keys by signing fake messages",
      "Yes; it provides a way for users to link their Bitcoin wallet to their bank account securely"
    ]
  },
  {
    "q": "What is 'The Bitcoin Core Block File' naming convention for storing raw block data on disk?",
    "a": "blkXXXXX.dat; where XXXXX is a sequential number (e.g., blk00000.dat, blk00001.dat)",
    "w": [
      "bitcoin_block_XXX.json; where XXX is the total number of transactions in that specific block",
      "block_height_XXX.txt; where XXX is the date the block was found by the mining pool",
      "hash_of_block_XXX.dat; where XXX is the random nonce that was used to find the block hash",
      "satoshi_n_XXX.dat; where XXX is the name of the developer who verified the block during IBD"
    ]
  },
  {
    "q": "What is 'BIP 152' (Compact Blocks) 'Reconstruction' and what happens if a node has missing transactions?",
    "a": "Nodes use peer-provided short IDs to build blocks; missing ones are requested with a 'getblocktxn' message",
    "w": [
      "Nodes download the complete block from a central server if they are missing more than one byte",
      "Miners are allowed to delete transactions from the blockchain if they cannot be reconstructed locally",
      "It is a process for recovering a lost seed phrase by reconstructing the Merkle Tree of a block",
      "A regulation that requires all nodes to reconstruct their blockchain database at least once a month"
    ]
  },
  {
    "q": "What is 'The Lightning Network Path Finding' complexity and why is it considered O(N*logN) or higher?",
    "a": "Navigating a dynamic, decentralized graph with rapidly changing liquidity levels and channel states",
    "w": [
      "The difficulty of finding the recipient's address in a block header containing 21 million users",
      "The mathematical complexity of hashing the payment secret using SHA-256 and ECDSA simultaneously",
      "The time it takes to build a physical connection between two nodes using only satellite links",
      "The cost of paying for a coffee using Bitcoin when the transaction fee is higher than the price"
    ]
  },
  {
    "q": "What is 'BIP 341' (Taproot) and what is the 'Taproot tweak' used for?",
    "a": "Combining a public key with a script Merkle Root into a single output key, enabling script-path spending",
    "w": [
      "Tweaking the total supply of Bitcoin to ensure it stays exactly at 21 million forever",
      "A minor adjustments to the block reward that happens every day to marking the halving",
      "The process for changing the recipient of a transaction after it has been signed by the sender",
      "A way to increase the speed of a hardware wallet by tweaking its internal computer processor"
    ]
  },
  {
    "q": "What is 'The Bitcoin Core Testnet' and how many versions of Testnet have existed (as of 2024)?",
    "a": "A testing network for developers; Testnet 1, 2, 3, and 4 (the current primary version is 3 or 4)",
    "w": [
      "A social network for miners to share block rewards; only one version was ever created by Satoshi",
      "A government-funded alternative to the main blockchain; ten versions were proposed by the SEC",
      "A temporary network for marking the halving anniversary; it is deleted and rebuilt every four years",
      "A physical museum in California dedicated to Bitcoin's code; only one version which is built in stone"
    ]
  },
  {
    "q": "What is 'BIP 155' and what does it enable for peer-to-peer node connectivity?",
    "a": "Support for Tor v3 addresses and gossip for peer identifiers, facilitating deeper privacy during discovery",
    "w": [
      "Support for connecting nodes via Bluetooth to allow for local Bitcoin trading without internet",
      "A way to link your Bitcoin node to your Twitter account to share your current block height",
      "A regulation that requires all nodes to connect to at least 155 other peers to remain on the network",
      "A standard for using only 155 words as a seed phrase for extremely high-security wallets"
    ]
  },
  {
    "q": "What is 'The Merkle Root' and why is it part of the block header instead of the complete tx list?",
    "a": "A single 32-byte hash representing all transactions; it allows nodes to verify inclusion without the full block",
    "w": [
      "The name of the first miner who found the block; it is used to reward them for their work",
      "A timestamp that records exactly when the first transaction in the block was confirmed by mining",
      "A list of IP addresses for every person who sent Bitcoin in that block; used for security auditing",
      "The sum of all transaction fees in the block; used to ensure miners do not claim too many rewards"
    ]
  },
  {
    "q": "Who authored 'Mastering Bitcoin' and what is the commonly accepted 'color' of the first edition cover?",
    "a": "Andreas M. Antonopoulos; Orange (matching the Bitcoin brand identity)",
    "w": [
      "Satoshi Nakamoto; White (matching the original whitepaper's minimalist design style)",
      "Michael Saylor; Gold (to represent Bitcoin's emergence as a new form of digital gold)",
      "Gavin Andresen; Blue (to represent the early development years and the forum where it started)",
      "Luke Dashjr; Red (to represent the controversial proposed changes during the blocksize war)"
    ]
  },
  {
    "q": "What is 'BIP 174' (Partially Signed Bitcoin Transactions) and what problem does it solve for mult-sig setups?",
    "a": "It provides a common binary format for passing around unsigned transactions among various signing devices",
    "w": [
      "It allows a signature to be partially confirmed by nodes while the user is still typing their PIN",
      "It splits a single transaction into 174 smaller parts to make it harder for banks to track",
      "It requires all mult-sig signers to be in the same room to authorized a single BTC payment",
      "It allows a user to send Bitcoin before they have finished signing the transaction in their wallet"
    ]
  },
  {
    "q": "In Taproot (BIP 341), what is the function of the 'taproot tweak' applied to the internal public key?",
    "a": "It commits to a Merkle root of scripts, allowing for both efficient key-path and script-path spending.",
    "w": [
      "It increases the random entropy of the private key to prevent AI-based guessing attacks.",
      "It allows the user to change their Bitcoin address every ten minutes for better privacy.",
      "It automatically adds a second signature to the transaction from a trusted third party.",
      "It encrypts the entire transaction so it can only be seen by the miner who finds the block."
    ]
  },
  {
    "q": "What unique property of Schnorr signatures enables MuSig2 (BIP 327)?",
    "a": "Linearity; signatures and public keys can be mathematically summed to create a single valid aggregate.",
    "w": [
      "Complexity; it uses 1024-bit prime numbers that are impossible to hack with quantum computers.",
      "Speed; it allows one million signatures to be verified in under one microsecond on a phone.",
      "Privacy; it hides the total amount of Bitcoin in every transaction from the public blockchain.",
      "Scarcity; it limits the total number of signatures that can be created for any single wallet."
    ]
  },
  {
    "q": "In the BOLT specifications for Lightning, what is the role of an 'Onion' packet?",
    "a": "It provides source-routed, end-to-end encrypted instructions that hide intermediate hops in a path.",
    "w": [
      "It compresses the entire Lightning channel into a single 80-byte block header for mobile use.",
      "It acts as a physical bill that is sent to the recipient's home address via a drone link.",
      "It allows routing nodes to see the final destination and origin of all payments for safety.",
      "It is a type of commemorative token that users earn for opening their very first channel."
    ]
  },
  {
    "q": "What technical problem did SIGHASH_ANYPREVOUT (BIP 118) aim to solve for Layer 2 scaling?",
    "a": "It would enable the Eltoo protocol by allowing any later state to bind to any earlier state's output.",
    "w": [
      "It would make all Lightning payments 100% free by eliminating all routing and network fees.",
      "It would allow users to send Bitcoin to any person in the world using only their phone number.",
      "It would increase the block size limit to 42 MB for all nodes that are currently mining BTC.",
      "It would provide a way to recover a lost 24-word seed phrase using only your fingerprint."
    ]
  },
  {
    "q": "In Bitcoin Script, what is the 'FORTH' stack model's primary characteristic?",
    "a": "It is a Last-In, First-Out (LIFO) stack where opcodes operate on the top-most elements available.",
    "w": [
      "It is a circular buffer where data is constantly being overwritten to save memory space.",
      "It is a type of AI that predicts the outcome of a transaction before the code is executed.",
      "It is a requirement that every script must have at least four different signatures to be valid.",
      "It is a system where the miner decides the order in which the script commands are run."
    ]
  },
  {
    "q": "What is 'CheckTemplateVerify' (BIP 119) and what is its main proposed use case?",
    "a": "A covenant proposal allowing an output to restrict where its funds can be spent (e.g. for Vaults).",
    "w": [
      "A way to verify that a Bitcoin address is owned by a person with a verified government ID.",
      "An upgrade that allows miners to template their blocks faster using a new P2P messaging code.",
      "A feature that allows you to send a single Bitcoin to 119 different people at the same time.",
      "A regulation that requires all 24-word seed phrases to be backed up on a standard paper form."
    ]
  },
  {
    "q": "What is an 'Adaptor Signature' and which Bitcoin upgrade made them standard-compliant?",
    "a": "A signature that requires a secret to be revealed to become valid; enabled by the linearity of Taproot.",
    "w": [
      "A signature that automatically adapts to the current network fee to ensure it is confirmed fast.",
      "A special type of private key that only works on devices that have a built-in cellular link.",
      "An upgrade that allows users to sign a transaction on behalf of another user for a small fee.",
      "A feature that allows a hardware wallet to adapt to any other type of cryptocurrency asset."
    ]
  },
  {
    "q": "In a 'Hashed Time-Locked Contract' (HTLC), what does the 'L' (Locked) specifically refer to?",
    "a": "The presence of a timelock that prevents funds from being moved before a certain block or time.",
    "w": [
      "The fact that the Bitcoin is physically locked inside a secure vault in El Salvador by law.",
      "The requirement for the user to enter their password or PIN before the payment can be sent.",
      "The rule that prevents a user from opening more than one Lightning channel at a same time.",
      "The encryption that prevents anybody from seeing the transaction data on the main chain."
    ]
  },
  {
    "q": "How does BIP 324 (V2 P2P Transport) protect Bitcoin nodes from ISPs?",
    "a": "By encrypting the P2P traffic, it prevents ISPs from doing deep packet inspection to identify nodes.",
    "w": [
      "By connecting all Bitcoin nodes to a separate satellite network that ISPs cannot monitor at all.",
      "By automatically paying the ISP a small fee in sats to ensure they do not block node traffic.",
      "By hiding the node's IP address and routing all traffic through a decentralized VPN network.",
      "By requiring all ISPs to be owned and operated by a group of certified Bitcoin mining pools."
    ]
  },
  {
    "q": "What is the difference between Weight Units and vBytes in SegWit?",
    "a": "Total Weight divided by 4 equals vSize (vBytes); vBytes is the normalized measure for fee rates.",
    "w": [
      "Weight Units are for mining hardware while vBytes are for the Bitcoin Core website servers.",
      "There is no difference; the two terms are used interchangeably by different Bitcoin developers.",
      "Weight Units are only used during a bull market while vBytes are for the bear market cycles.",
      "vBytes is the term for a transaction that has zero fees; Weight Units are for high-fee ones."
    ]
  },
  {
    "q": "In the context of UTXO spending, what is the role of an 'Outpoint'?",
    "a": "A unique identifier for a specific output consisting of a Transaction ID and an output index.",
    "w": [
      "A physical location in a forest where a user has hidden a paper copy of their seed phrase.",
      "The exact time in seconds when a transaction was first seen by a miner on the network P2P.",
      "The total number of people who have already received a specific Bitcoin payment globally.",
      "A type of Bitcoin address that starts with'bc3' and is used only for high-value transfers."
    ]
  },
  {
    "q": "What is the 'Annex' in BIP 341 and why is it currently ignored by nodes?",
    "a": "An extensible field for future features; it is ignored now to ensure forward compatibility of rules.",
    "w": [
      "A list of all previous miners who have verified a block; ignored to save bandwidth on nodes.",
      "A backup copy of the whitepaper that is included in every block; ignored to save on disk space.",
      "A regulation that requires all Bitcoin users to pay a small fee to the developers every month.",
      "A type of malware that tries to steal private keys by signing fake messages to the network."
    ]
  },
  {
    "q": "What does 'MuSig2' require from signers during the creation of a multisig signature?",
    "a": "Two rounds of communication including exchanging nonces before generating the final signature.",
    "w": [
      "Exactly three thousand rounds of communication to ensure the signature is truly decentralized.",
      "A physical meeting between all the signers to authorized a single Bitcoin transaction on-chain.",
      "A requirement for all signers to use the same type of hardware wallet for security and safety.",
      "A law that prevents any single person from owning more than one key in a multi-sig setup."
    ]
  },
  {
    "q": "In a Merkle Tree, what is the 'Height' level of a tree with 8 transactions?",
    "a": "Height 3 (excluding the root); it follows log2 of the number of leaf nodes available top-down.",
    "w": [
      "Height 21, matching the supply cap of the Bitcoin network for consistency and consensus.",
      "Height 8, one level for every transaction that is included in the block's Merkle Tree calculation.",
      "Height 1, because all transactions are combined into a single 32-byte hash representing them.",
      "The height changes every ten minutes based on the current price of Bitcoin on major exchanges."
    ]
  },
  {
    "q": "What is 'Compact Client-Side Filtering' (BIP 157/158)?",
    "a": "A protocol where nodes provide block filters that light clients use to privately scan for coins.",
    "w": [
      "A way to compress the entire blockchain into a small text file that fits on any smartphones.",
      "A technique for mining Bitcoin using only the processing power of a high-performance GPU.",
      "A regulation that requires all Bitcoin nodes to filter out any suspicious criminal's activity.",
      "A process where a hardware wallet performs a deep virus scan of your computer's RAM storage."
    ]
  },
  {
    "q": "What is 'Deterministic Entropy' in the context of BIP 85?",
    "a": "Using a master mnemonic to deterministically derive child mnemonics for various other wallets.",
    "w": [
      "A way to calculate the exact amount of energy that will be used to mine the next ten blocks.",
      "The process of creating a new random seed phrase for your wallet every single hour of the day.",
      "A feature that automatically adds a 25th word to your seed phrase for extra storage security.",
      "A type of advanced encryption that makes your 24-word seed phrase invisible to AI guessing."
    ]
  },
  {
    "q": "What are 'Miniscript' and how do they benefit Bitcoin developers?",
    "a": "A structured way to write and analyze Bitcoin Script, making it easier to build secure spending rules.",
    "w": [
      "A tiny version of the Bitcoin protocol that only works on devices with very low RAM memory.",
      "A programming language that allows icons and emojis to be used instead of standard opcodes.",
      "A regulation that mandates all Bitcoin related software to be written in a specific language.",
      "A tool for mining Bitcoin using only a small solar panel and a high-performance graphics chip."
    ]
  },
  {
    "q": "What is a 'Covenant' in Bitcoin and why is it currently limited in standard scripts?",
    "a": "A way to restrict how future outputs can be spent; limited to prevent complex, recursive attacks.",
    "w": [
      "A physical contract that both parties must sign before they can send a Bitcoin transaction.",
      "A rule that requires all 21 million Bitcoin to be held by the same group of people by law.",
      "The process for adding new developers to the Bitcoin Core repository on the GitHub platform.",
      "A type of commemorative token that users earn for running a node for at least five full years."
    ]
  },
  {
    "q": "In BIP 324, what is the 'ELLSWIFT' encoding used for?",
    "a": "A way to perform elliptic curve public key exchange that is indistinguishable from random data.",
    "w": [
      "A new type of Bitcoin address that is 21% faster than Bech32 and starts with the prefix'bc0'.",
      "A compression technique for mobile users to download the entire blockchain in under a minute.",
      "A regulation that requires all Bitcoin related businesses to report their profits in fiat currency.",
      "A tool for mining Bitcoin using only a high-performance CPU and a very small amount of memory."
    ]
  },
  {
    "q": "In the context of LN, what is 'Splicing'?",
    "a": "Resizing a Lightning channel by adding or removing funds on-chain while keeping the channel open.",
    "w": [
      "The process of splitting a single Lightning payment into 21 different paths for better privacy.",
      "A hack that results in the creation of fake sats in a Lightning channel that cannot be spent.",
      "A regulation that prevents people from opening more than five Lightning channels in a day.",
      "A new type of hardware wallet that has a built-in cellular link to stay connected to nodes."
    ]
  },
  {
    "q": "What is 'Liquid' in the Bitcoin ecosystem?",
    "a": "A federated sidechain used for faster, confidential transactions between exchanges and power-users.",
    "w": [
      "A physical substance that is used to cool down high-performance ASIC mining hardware rigs.",
      "The name of a new Bitcoin exchange that only operates in the country of El Salvador today.",
      "A type of commemorative token that users earn for completing the Bitcoin Scholar Certification.",
      "A regulation that requires all Bitcoin nodes to have a liquid cooling system for any ASIC rig."
    ]
  },
  {
    "q": "What is 'TAP' (Taproot Assets Protocol) designed for?",
    "a": "Issuing assets (tokens) on the Bitcoin blockchain using Taproot features for maximum efficiency.",
    "w": [
      "A way to tap into the Bitcoin network using only a physical pen and a piece of paper for keys.",
      "An upgrade that increases the total amount of Bitcoin that can be mined in a single block reward.",
      "A regulation that requires all Bitcoin related software to have a built-in tax reporting tool.",
      "A tool for mining Bitcoin using only a small solar panel and a high-performance graphics chip."
    ]
  },
  {
    "q": "In a transaction, what is 'nVersion' and why is it important for BIP 9?",
    "a": "A field in the block header; BIP 9 uses bits within it as signals for soft fork activation status.",
    "w": [
      "A field that records the name and IP address of the person who found the specific block header.",
      "A process for changing the order of transactions in a block header to prevent any miner theft.",
      "A regulation that requires all blocks to have a unique version number that is assigned by SEC.",
      "A tool for mining Bitcoin using only a high-performance CPU and a very small amount of memory."
    ]
  },
  {
    "q": "What is 'SipHash-2-4' and where is it used in Bitcoin Core?",
    "a": "A fast, secure keyed hash function used for internal maps and hash tables to prevent DoS attacks.",
    "w": [
      "A new type of Bitcoin hashing algorithm that will eventually replace SHA-256 for all mining.",
      "A regulation that requires all Bitcoin nodes to have at least 2 GB of RAM to operate globally.",
      "A tool for mining Bitcoin using only the processing power of a web browser or a mobile phone.",
      "A type of commemorative token that users earn for correctly answering 21 trivia questions in."
    ]
  },
  {
    "q": "What is 'OP_CSV' (CheckSequenceVerify) and how is it used in Lightning?",
    "a": "A relative timelock opcode used to prevent a peer from stealing funds after closing a channel.",
    "w": [
      "An opcode that converts all Bitcoin into a CSV file format for easier export to a spreadsheet.",
      "A regulation that requires all Lightning nodes to send a CSV report of their fees every month.",
      "A feature that automatically adds a second signature to the transaction from a trusted person.",
      "A tool for mining Bitcoin using only a high-performance graphics card and a 1TB SSD drive."
    ]
  }
];



// Scholar state

// Scholar state
let scholarType = 'properties'; 
let scholarAttemptDate = { 
    properties: localStorage.getItem('btc_scholar_prop_attempt_date') || '', 
    technical: localStorage.getItem('btc_scholar_tech_attempt_date') || '' 
};
let scholarPassed = { 
    properties: localStorage.getItem('btc_scholar_prop_passed') === 'true', 
    technical: localStorage.getItem('btc_scholar_tech_passed') === 'true' 
};
let scholarTimer = null;
let scholarTimeLeft = 600; 
let scholarAnswers = [];
let scholarQuestions = [];

function startScholarQuest(type) {
    scholarType = type || 'properties';
    const keyPrefix = scholarType === 'technical' ? 'tech' : 'prop';

    if (typeof auth === 'undefined' || !auth.currentUser || auth.currentUser.isAnonymous) {
        if (typeof showToast === 'function') showToast('📝 You must sign in to take the ' + (scholarType === 'technical' ? 'Technical' : 'Scholar') + ' Certification.');
        if (typeof showUsernamePrompt === 'function') showUsernamePrompt();
        return;
    }

    if (scholarPassed[scholarType]) {
        showScholarCertificate(scholarType);
        return;
    }

    // Anti-cheat check
    const today = new Date().toISOString().split('T')[0];
    if (scholarAttemptDate[scholarType] === today) {
        // Check if there is an active session we can resume
        const saved = sessionStorage.getItem('btc_scholar_session_' + keyPrefix);
        if (saved) {
            try {
                const session = JSON.parse(saved);
                const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
                if (elapsed < 600) {
                    scholarQuestions = session.questions;
                    scholarAnswers = session.answers;
                    scholarTimeLeft = 600 - elapsed;
                    renderScholarQuestion(session.currentIndex || 0);
                    document.getElementById('questModal').classList.add('open');
                    startScholarTimer();
                    return;
                }
            } catch(e) {}
        }
        if (typeof showToast === 'function') showToast('⏳ Locked. You only get one shot per day! Try again tomorrow.');
        return;
    }

    const modal = document.getElementById('questModal');
    const inner = document.getElementById('questInner');
    if (!modal || !inner) return;

    const pool = scholarType === 'technical' ? SCHOLAR_TECHNICAL_POOL : SCHOLAR_PROPERTIES_POOL;
    scholarQuestions = fisherYates([...pool]).slice(0, 25);
    scholarAnswers = new Array(25).fill(null);
    scholarTimeLeft = 600;

    // Save session start info
    const sessionData = {
        questions: scholarQuestions,
        answers: scholarAnswers,
        startTime: Date.now(),
        currentIndex: 0
    };
    sessionStorage.setItem('btc_scholar_session_' + keyPrefix, JSON.stringify(sessionData));

    renderScholarQuestion(0);
    modal.classList.add('open');
    startScholarTimer();
}

function fisherYates(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function startScholarTimer() {
    if (scholarTimer) clearInterval(scholarTimer);
    const keyPrefix = scholarType === 'technical' ? 'tech' : 'prop';
    scholarTimer = setInterval(() => {
        scholarTimeLeft--;
        const min = Math.floor(scholarTimeLeft / 60);
        const sec = scholarTimeLeft % 60;
        const timerEl = document.getElementById('scholarTimer');
        if (timerEl) timerEl.textContent = min + ":" + (sec < 10 ? '0' : '') + sec;
        
        if (scholarTimeLeft <= 0) {
            clearInterval(scholarTimer);
            submitScholarQuest();
        }
    }, 1000);
}

function renderScholarQuestion(idx) {
    const q = scholarQuestions[idx];
    const inner = document.getElementById('questInner');
    const keyPrefix = scholarType === 'technical' ? 'tech' : 'prop';

    // Update session index
    try {
        const saved = JSON.parse(sessionStorage.getItem('btc_scholar_session_' + keyPrefix));
        saved.currentIndex = idx;
        sessionStorage.setItem('btc_scholar_session_' + keyPrefix, JSON.stringify(saved));
    } catch(e) {}
    
    // PERSISTENCE FIX: Only shuffle choices if they haven't been generated for this session yet
    if (!q.shuffled) {
        q.shuffled = fisherYates([q.a, ...q.w]);
    }
    let choices = q.shuffled;
    
    const min = Math.floor(scholarTimeLeft / 60);
    const sec = scholarTimeLeft % 60;
    const timeStr = min + ':' + (sec < 10 ? '0' : '') + sec;
    
    let html = '<div style="padding:20px;">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:20px;font-weight:bold;color:var(--accent);">' +
            '<span>' + (scholarType === 'technical' ? '🛠️ Protocol Expert' : '🎓 Bitcoin Scholar') + '</span>' +
            '<span id="scholarTimer">' + timeStr + '</span>' +
        '</div>' +
        '<div style="margin-bottom:10px;color:var(--text-muted);font-size:0.8rem;">Question ' + (idx + 1) + ' of 25</div>' +
        '<h3 style="margin-bottom:20px;line-height:1.4;">' + q.q + '</h3>' +
        '<div style="display:flex;flex-direction:column;gap:10px;">';
    
        choices.forEach(val => {
            const selected = scholarAnswers[idx] === val;
            html += '<button onclick="selectScholarAnswer(' + idx + ', \'' + val.replace(/'/g, "\\'") + '\')" style="text-align:left;padding:15px;background:' + (selected ? 'var(--accent)' : 'var(--bg-side)') + ';color:' + (selected ? '#fff' : 'var(--text)') + ';border:1px solid ' + (selected ? 'var(--accent)' : 'var(--border)' ) + ';border-radius:10px;cursor:pointer;font-family:inherit;font-size:0.95rem;">' + val + '</button>';
        });
    html += '</div>' +
        '<div style="margin-top:30px;display:flex;justify-content:space-between;">' +
            '<button onclick="' + (idx === 0 ? 'cancelScholar()' : 'renderScholarQuestion(' + (idx - 1) + ')') + '" style="padding:10px 20px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text-muted);cursor:pointer;">' + (idx === 0 ? 'Exit Quest' : 'Previous') + '</button>' +
            '<button onclick="' + (idx === 24 ? 'submitScholarQuest()' : 'renderScholarQuestion(' + (idx + 1) + ')') + '" style="padding:10px 30px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-weight:bold;cursor:pointer;">' + (idx === 24 ? 'Submit Exam' : 'Next') + '</button>' +
        '</div>' +
    '</div>';
    
    inner.innerHTML = html;
}

function selectScholarAnswer(idx, val) {
    scholarAnswers[idx] = val;
    const keyPrefix = scholarType === 'technical' ? 'tech' : 'prop';
    try {
        const saved = JSON.parse(sessionStorage.getItem('btc_scholar_session_' + keyPrefix));
        saved.answers = scholarAnswers;
        sessionStorage.setItem('btc_scholar_session_' + keyPrefix, JSON.stringify(saved));
    } catch(e) {}
    renderScholarQuestion(idx);
}

async function submitScholarQuest() {
    if (scholarTimer) clearInterval(scholarTimer);
    const keyPrefix = scholarType === 'technical' ? 'tech' : 'prop';
    sessionStorage.removeItem('btc_scholar_session_' + keyPrefix);

    let score = 0;
    scholarQuestions.forEach((q, i) => {
        if (scholarAnswers[i] === q.a) score++;
    });

    const passed = score >= 20;
    const today = new Date().toISOString().split('T')[0];
    
    localStorage.setItem('btc_scholar_' + keyPrefix + '_attempt_date', today);
    scholarAttemptDate[scholarType] = today;

    if (passed) {
        localStorage.setItem('btc_scholar_' + keyPrefix + '_passed', 'true');
        scholarPassed[scholarType] = true;
        
        if (typeof awardPoints === 'function') {
            await awardPoints(2100, '🎓 ' + (scholarType === 'technical' ? 'Technical' : 'Scholar') + ' Certification');
        }
        if (typeof awardHiddenBadge === 'function') {
            awardHiddenBadge(scholarType === 'technical' ? 'cert_tech' : 'cert_scholar', (scholarType === 'technical' ? 'Protocol Expert' : 'Bitcoin Scholar') + '! 🎓');
        }
    }

    const inner = document.getElementById('questInner');
    inner.innerHTML = '<div style="text-align:center;padding:40px 20px;">' +
        '<div style="font-size:4rem;margin-bottom:20px;">' + (passed ? '🎉' : '📝') + '</div>' +
        '<h2 style="color:var(--heading);">' + (passed ? 'Congratulations!' : 'Not quite there yet') + '</h2>' +
        '<div style="font-size:1.5rem;font-weight:800;color:' + (passed ? '#22c55e' : '#ef4444') + ';margin:15px 0;">' + score + ' / 25 Correct</div>' +
        '<p style="color:var(--text-muted);margin-bottom:30px;">' + (passed ? "You've earned the " + (scholarType === 'technical' ? 'Protocol Expert' : 'Bitcoin Scholar') + " certification and 2,100 points!" : 'You needed 20 correct picks to pass. This quest is now locked for the day. Come back tomorrow for a fresh set of 25 questions!') + '</p>' +
        '<button onclick="closeQuest(); ' + (passed ? "showScholarCertificate('" + scholarType + "')" : "showSettingsPage('scholar')") + '" style="padding:14px 40px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-weight:bold;cursor:pointer;">' + (passed ? 'View Certificate' : 'Continue Learning') + '</button>' +
    '</div>';
}

function cancelScholar() {
    const confirmed = confirm("Are you sure you want to exit? This will count as your attempt for the day and you will be locked out until tomorrow.");
    if (!confirmed) return;

    if (scholarTimer) clearInterval(scholarTimer);
    const keyPrefix = scholarType === 'technical' ? 'tech' : 'prop';
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('btc_scholar_' + keyPrefix + '_attempt_date', today);
    scholarAttemptDate[scholarType] = today;
    sessionStorage.removeItem('btc_scholar_session_' + keyPrefix);

    document.getElementById('questModal').classList.remove('open');
    if (typeof showSettingsPage === 'function') showSettingsPage('scholar');
}

function showScholarCertificate(type) {
    scholarType = type || 'properties';
    const modal = document.getElementById('questModal');
    const inner = document.getElementById('questInner');
    const title = scholarType === 'technical' ? 'Bitcoin Protocol Expert' : 'Bitcoin Scholar';

    inner.innerHTML = '<div style="text-align:center;padding:30px;">' +
        '<div style="font-size:4rem;margin-bottom:16px;">🎓</div>' +
        '<h2 style="color:var(--heading);margin:8px 0 16px;">Verified ' + title + '!</h2>' +
        '<div style="color:var(--text-muted);margin-bottom:20px;">You have passed the certification requirements.</div>' +
        '<input type="text" id="certName" placeholder="Your full name" style="width:100%;max-width:300px;padding:12px;background:var(--input-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:inherit;text-align:center;outline:none;margin-bottom:20px;">' +
        '<br>' +
        '<button onclick="downloadCertificate(\'' + scholarType + '\')" style="padding:14px 30px;background:linear-gradient(135deg,#f7931a,#ea580c);color:#fff;border:none;border-radius:12px;font-weight:bold;cursor:pointer;font-family:inherit;">📜 Download Certificate</button>' +
        '<br>' +
        '<button onclick="closeQuest()" style="margin-top:12px;padding:10px 20px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text-muted);cursor:pointer;">Close</button>' +
    '</div>';
    modal.classList.add('open');
}
function downloadCertificate(type) {
    const certType = type || 'properties';
    const title = certType === 'technical' ? 'Bitcoin Protocol Expert' : 'Bitcoin Scholar';
    const name = document.getElementById('certName').value.trim() || 'Bitcoiner';
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
    ctx.strokeStyle = certType === 'technical' ? '#3b82f6' : '#f7931a';
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, 1140, 790);

    // Double border
    ctx.strokeStyle = certType === 'technical' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(247, 147, 26, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(40, 40, 1120, 770);

    // Corner decorations
    const corners = [[50,50], [1150,50], [50,800], [1150,800]];
    corners.forEach(([x, y]) => {
        ctx.fillStyle = certType === 'technical' ? '#3b82f6' : '#f7931a';
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
    });

    // Bitcoin logo
    ctx.fillStyle = certType === 'technical' ? '#3b82f6' : '#f7931a';
    ctx.beginPath();
    ctx.arc(600, 110, 35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('₿', 600, 124);

    // Title
    ctx.fillStyle = certType === 'technical' ? '#3b82f6' : '#f7931a';
    ctx.font = '14px Arial';
    ctx.letterSpacing = '8px';
    ctx.fillText('CERTIFICATE OF ACHIEVEMENT', 600, 180);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 48px Georgia, serif';
    ctx.fillText(title, 600, 240);

    // Divider line
    ctx.strokeStyle = certType === 'technical' ? '#3b82f6' : '#f7931a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(400, 270);
    ctx.lineTo(800, 270);
    ctx.stroke();

    // Awarded to
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 20px Arial';
    ctx.fillText('is hereby awarded to', 600, 320);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px Georgia, serif';
    ctx.fillText(name, 600, 400);

    // Footer info
    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px Arial';
    ctx.fillText('for successfully passing the verified ' + title + ' exam', 600, 460);
    ctx.fillText('on the Bitcoin Education Archive platform.', 600, 490);

    // Date & Signature area
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(250, 650); ctx.lineTo(500, 650); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(700, 650); ctx.lineTo(950, 650); ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('DATE OF ACHIEVEMENT', 375, 680);
    ctx.fillText('VERIFIED AUTHENTICITY', 825, 680);

    ctx.fillStyle = '#ffffff';
    ctx.font = '22px Georgia, serif';
    ctx.fillText(dateStr, 375, 640);
    ctx.fillText('₿ Verification #'+Math.random().toString(36).substr(2, 9).toUpperCase(), 825, 640);

    // Tiny watermark
    ctx.font = '10px Arial';
    ctx.fillStyle = '#334155';
    ctx.fillText('BITCOIN EDUCATION ARCHIVE © 2026', 600, 820);

    // Download
    const link = document.createElement('a');
    link.download = 'Bitcoin-' + (certType === 'technical' ? 'Technical' : 'Scholar') + '-Certificate.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// --- FLASHCARDS SYSTEM ---
window.startFlashcards = function(topic) {
    const modal = document.getElementById('questModal');
    const inner = document.getElementById('questInner');
    if (!modal || !inner) return;

    const flashData = {
    'Bitcoin Basics': [
        { q: "What is the total supply cap of Bitcoin?", a: "21 Million. This limit is hardcoded and cannot be changed without near-universal consensus." },
        { q: "Who created Bitcoin?", a: "Satoshi Nakamoto. The pseudonymous creator who published the whitepaper in 2008 and disappeared in 2011." },
        { q: "What is a 'Sat' or 'Satoshi'?", a: "The smallest unit of Bitcoin. 1 Bitcoin = 100,000,000 sats." },
        { q: "What is the Genesis Block?", a: "The very first block in the Bitcoin blockchain, mined by Satoshi on Jan 3, 2009." },
        { q: "What is the block time target?", a: "10 minutes. The difficulty adjustment ensures blocks are found at this average interval regardless of hash rate." },
        { q: "What is a Halving?", a: "An event every 4 years (210,000 blocks) where the reward for mining new blocks is cut in half." },
        { q: "What is the current block reward?", a: "3.125 BTC (as of the 2024 halving). It started at 50 BTC in 2009." },
        { q: "What is a transaction fee?", a: "Sats paid to miners to prioritize your transaction in the next block. It is based on transaction size, not amount." },
        { q: "What is a block?", a: "A container for transactions. In Bitcoin, blocks are linked cryptographically into a chain." },
        { q: "What is the mempool?", a: "A 'waiting room' for unconfirmed transactions before a miner picks them up for a block." }
    ],
    'Security & Storage': [
        { q: "What is a seed phrase?", a: "A list of 12 or 24 words that serves as the master key to your entire wallet. Never share it!" },
        { q: "What is the golden rule of custody?", a: "\"Not your keys, not your coins.\" If you don't hold the private keys, you don't truly own the money." },
        { q: "What is a hardware wallet?", a: "A physical device that keeps your private keys offline, protecting them from hackers and malware." },
        { q: "What is 2FA?", a: "Two-Factor Authentication. An extra layer of security beyond just your password, though not a replacement for self-custody." },
        { q: "What is a passphrase?", a: "An optional '13th' or '25th' word added to a seed phrase. It creates a completely different wallet from the same seed." },
        { q: "What is an Air-gapped wallet?", a: "A device that never connects to the internet. Transactions are moved via QR codes or microSD cards." },
        { q: "What is Multi-sig?", a: "A setup requiring multiple keys to authorize a spend (e.g., 2-of-3). It eliminates single points of failure." },
        { q: "What is a cold wallet?", a: "Any wallet where the private keys were generated and are stored offline." },
        { q: "What is a hot wallet?", a: "A wallet connected to the internet, like a phone app or exchange account. Higher risk for long-term storage." },
        { q: "What is key derivation?", a: "The process of generating unlimited addresses from a single seed phrase using a mathematical standard (BIP 32)." }
    ],
    'Lightning Network': [
        { q: "What is the Lightning Network?", a: "A 'Layer 2' scaling solution for Bitcoin that allows for instant, near-free micro-payments." },
        { q: "What is a payment channel?", a: "A direct link between two users on the Lightning Network where they can transact instantly off-chain." },
        { q: "What is an HTLC?", a: "Hashed Time-Locked Contract. A smart contract that ensures payments are either delivered or returned safely." },
        { q: "What is Inbound Liquidity?", a: "The ability to receive payments on Lightning. Someone else must have a channel balanced toward you." },
        { q: "What is a sat/byte?", a: "A measure of the fee density you pay to miners for on-chain settlement." },
        { q: "What is a Lightning invoice?", a: "A one-time-use request for payment on the Lightning Network, usually a QR code." },
        { q: "What is a BOLT?", a: "Basics of Lightning Technology. These are the technical specifications (BIP-equivalent) for the Lightning Network." },
        { q: "What is a Watchtower?", a: "A service that monitors the blockchain to prevent channel partners from attempting to cheat while you are offline." },
        { q: "What is routing?", a: "The process of moving a payment through multiple nodes to reach a recipient you don't have a direct channel with." },
        { q: "What is LNURL?", a: "A protocol that makes Lightning more user-friendly, supporting static QR codes and withdrawal links." }
    ],
    'Mining & Energy': [
        { q: "What is Bitcoin mining?", a: "The process where computers compete to find blocks, securing the network and earning rewards." },
        { q: "What is Proof of Work?", a: "The consensus mechanism that requires miners to spend real-world energy to secure the network." },
        { q: "What is the Hash Rate?", a: "A measure of the total computational power being used to secure the Bitcoin network at any given time." },
        { q: "How often are new blocks found?", a: "On average, every 10 minutes. The difficulty adjustment ensures this remains consistent." },
        { q: "What is an ASIC?", a: "Application-Specific Integrated Circuit. Specialized hardware designed solely for mining Bitcoin efficiently." },
        { q: "What is a mining pool?", a: "A group of miners who share their hash power and split the rewards based on their contribution." },
        { q: "What is the block subsidy?", a: "The fixed amount of new Bitcoin created in each block. It is currently 3.125 BTC." },
        { q: "What is Stranded Energy?", a: "Energy produced in remote locations with no local buyers (like hydro or flare gas). Bitcoin miners capture this wasted value." },
        { q: "What is the Difficulty Adjustment?", a: "A rule every 2016 blocks (~2 weeks) that recalibrates how hard it is to mine to maintain the 10-minute target." },
        { q: "Is mining solving 'complex math puzzles'?", a: "No. It is a brute-force lottery of guessing random numbers (nonces) until a valid hash is found." }
    ],
    'Economics & Money': [
        { q: "What is Sound Money?", a: "Money that cannot be easily debased or manipulated by any authority. It must be scarce and durable." },
        { q: "What is Fiat money?", a: "Currency backed only by government decree, with no physical backing and an unlimited supply." },
        { q: "What is Time Preference?", a: "The ratio at which you value present goods over future goods. Bitcoin encourages lower time preference (saving)." },
        { q: "What is the Stock-to-Flow ratio?", a: "A measure of scarcity: existing supply divided by current annual production." },
        { q: "What is the Cantillon Effect?", a: "The phenomenon where those closest to money printing benefit first, while others suffer from rising prices later." },
        { q: "What is Hyper-bitcoinization?", a: "The theoretical process where Bitcoin becomes the world's dominant form of money and unit of account." },
        { q: "What is an inflationary currency?", a: "Currency that loses purchasing power over time because the supply is constantly increasing." },
        { q: "What is a Store of Value?", a: "An asset that can be saved, retrieved, and exchanged in the future without losing significant value." },
        { q: "What is the 'Double Coincidence of Wants'?", a: "The problem in barter where two people must want exactly what the other has. Money solves this as an intermediary." },
        { q: "What is Gresham's Law?", a: "The observation that 'bad money drives out good.' People spend devaluing fiat and hoard scarce Bitcoin." }
    ],
    'History & Culture': [
        { q: "What was the first real-world Bitcoin purchase?", a: "Two pizzas for 10,000 BTC in 2010—now celebrated every May 22nd as Bitcoin Pizza Day." },
        { q: "Who is Hal Finney?", a: "A legendary cryptographer, the first person to receive a transaction from Satoshi, and author of the first Bitcoin tweet." },
        { q: "What is 'HODL'?", a: "A misspelling of 'hold' that became a mantra for long-term conviction during volatile market cycles." },
        { q: "What is the Whitepaper?", a: "The original 9-page document by Satoshi Nakamoto that first described how Bitcoin works." },
        { q: "What were the 'Blocksize Wars'?", a: "A 2015-2017 battle where users successfully fought to keep Bitcoin decentralized against corporate big-block interests." },
        { q: "What is a Cypherpunk?", a: "A member of the movement that believes privacy and individual liberty can be protected through cryptography." },
        { q: "What is the message in the Genesis Block?", a: "\"The Times 03/Jan/2009 Chancellor on brink of second bailout for banks.\"" },
        { q: "Who is Adam Back?", a: "The inventor of Hashcash (Bitcoin's PoW ancestor) and a prominent Bitcoin developer." },
        { q: "What is a 'Pleb'?", a: "A term used by Bitcoiners to describe everyday, committed users who are not part of the elite financial class." },
        { q: "What is the 'Orange Pill'?", a: "A reference to The Matrix, describing the moment someone truly understands why Bitcoin is necessary." }
    ],
    'Privacy & Sovereignty': [
        { q: "What is a CoinJoin?", a: "A collaborative transaction that mixes Bitcoin from multiple users to break the link between inputs and outputs." },
        { q: "What is KYC?", a: "Know Your Customer. Regulations that force exchanges to collect your ID, linking your identity to your coins." },
        { q: "Why use a VPN or Tor?", a: "To hide your IP address from nodes and trackers, protecting your physical location from being linked to your wallet." },
        { q: "What is a PayJoin?", a: "A privacy technique where a sender and receiver both contribute inputs, defeating common chain analysis heuristics." },
        { q: "What is a 'Dusting Attack'?", a: "Tiny amounts of BTC sent to addresses to track the owner's movement and attempt deanonymization." },
        { q: "What is an xpub?", a: "An Extended Public Key. It allows a wallet to generate all your future addresses for viewing, but has no spending power." },
        { q: "What is a change address?", a: "An address used to receive the leftover Bitcoin from a transaction you sent. Good wallets use a new one every time." },
        { q: "What is self-sovereignty?", a: "Having absolute control over your own property and data without depending on any third party or institution." },
        { q: "What is a Non-KYC Bitcoin?", a: "Bitcoin acquired through P2P markets, mining, or trade without ever providing a government identity." },
        { q: "Is Bitcoin 'anonymous'?", a: "No. It is pseudonymous. Every transaction is public on the ledger, but not necessarily linked to a name." }
    ],
    'Nodes & P2P': [
        { q: "What is a full node?", a: "A computer that stores the entire blockchain and independently verifies every single transaction and rule." },
        { q: "Why run your own node?", a: "To enforce the rules of the network for yourself and ensure you aren't being lied to by a third party." },
        { q: "What is Initial Block Download (IBD)?", a: "The process where a new node downloads and validates the entire history of Bitcoin from block zero." },
        { q: "What is a pruned node?", a: "A node that validates the full chain but deletes old block data to save disk space, keeping only the most recent blocks." },
        { q: "How many nodes are on the Bitcoin network?", a: "Estimated between 15,000 and 50,000 publicly reachable nodes, and many more private ones." },
        { q: "What is a peer-to-peer network?", a: "A network where participants communicate directly with each other without a central server." },
        { q: "What is BIP 324?", a: "A protocol upgrade that provides encryption between Bitcoin nodes to prevent ISP surveillance." },
        { q: "What is an Inventory (inv) message?", a: "A P2P message used by nodes to tell their peers about new blocks or transactions they've seen." },
        { q: "Does a miner need a node?", a: "Yes. Every miner needs a node to construct block templates and listen for the latest chain updates." },
        { q: "What is the 'Nakamoto Consensus'?", a: "The combination of Proof-of-Work and the 'Longest Chain Rule' to achieve global agreement on history." }
    ],
    'Wallets & Tools': [
        { q: "What is a Coldcard?", a: "A security-focused, air-gapped hardware signer that uses a microSD card to sign transactions." },
        { q: "What is Sparrow Wallet?", a: "A professional-grade Bitcoin desktop wallet optimized for UTXO management and node connectivity." },
        { q: "What is a Block Explorer?", a: "A website (like Mempool.space) that allows you to view transactions, blocks, and network statistics." },
        { q: "What is a seed plate?", a: "A piece of stainless steel or titanium used to engrave your seed phrase for permanent, fireproof backup." },
        { q: "What is a multisig 'Vault'?", a: "A high-security setup using separate devices (e.g., Coldcard + Trezor) to protect large amounts of Bitcoin." },
        { q: "What is a BIP?", a: "Bitcoin Improvement Proposal. A formal document used to propose and discuss changes to the Bitcoin protocol." },
        { q: "What is a hardware signer?", a: "A term often used for hardware wallets to emphasize that they ONLY sign transactions and do not actually 'store' coins." },
        { q: "What is a watch-only wallet?", a: "A wallet (often on a phone) that tracks your balance and addresses but cannot spend because it has no private keys." },
        { q: "What is an LNURL-withdraw?", a: "A QR code that, when scanned, triggers a node to send Lightning sats to the person who scanned it." },
        { q: "What is MuSig2?", a: "A standard for creating aggregated Schnorr signatures, improving the privacy and efficiency of multisig." }
    ],
    'Austrian Economics': [
        { q: "Who is Ludwig von Mises?", a: "A famous Austrian economist who wrote 'Human Action' and theorized that markets are processes, not static models." },
        { q: "What is the Regression Theorem?", a: "Mises' theory that a medium of exchange must have had value as a non-monetary commodity first (challenged by Bitcoin)." },
        { q: "What is Sound Money according to Hayek?", a: "Money that is subject to market competition rather than state monopoly, as argued in 'The Denationalization of Money'." },
        { q: "What is inflation in the Austrian view?", a: "An increase in the total supply of money, not just an increase in prices." },
        { q: "Why is decentralized market pricing important?", a: "It provides the 'knowledge bits' necessary for entrepreneurs to calculate and allocate resources efficiently." },
        { q: "What is malinvestment?", a: "Poor allocation of capital caused by artificially low interest rates and money printing, leading to economic bubbles." },
        { q: "What is 'Hard Money'?", a: "Money with an supply that is difficult to increase, like gold or Bitcoin. It preserves purchasing power over time." },
        { q: "What is the 'Subjective Theory of Value'?", a: "The economic principle that the value of a good is not inherent, but assigned by individuals based on their needs." },
        { q: "How does Bitcoin encourage savings?", a: "By being non-inflationary, users know their money will likely buy more in the future, rewarding patience." },
        { q: "What is 'Sound Money'?", a: "Money that has its value determined by the market, free from government or central bank manipulation." }
    ],
    'Cypherpunk History': [
        { q: "What is the Cypherpunk Manifesto?", a: "A 1993 document by Eric Hughes stating that 'Privacy is necessary for an open society in the electronic age'." },
        { q: "Who is David Chaum?", a: "A cryptography pioneer who created E-cash in the 1980s, the first attempt at private digital money." },
        { q: "What was 'Bit Gold'?", a: "A 1998 proposal by Nick Szabo that featured Proof-of-Work and fixed supply, very similar to Bitcoin." },
        { q: "Who were the 'Cypherpunks'?", a: "A group of activists and programmers who advocated for social change through cryptography and privacy-enhancing tech." },
        { q: "What was 'B-money'?", a: "A 1998 proposal by Wei Dai for an anonymous, distributed electronic cash system cited in the Bitcoin whitepaper." },
        { q: "What happened in the 90s 'Crypto Wars'?", a: "A battle between the US government and privacy advocates over whether civilian use of strong encryption should be legal." },
        { q: "Who is Julian Assange?", a: "A cypherpunk and founder of WikiLeaks who used Bitcoin early on when banks blocked their donations." },
        { q: "What is 'Cypherspace'?", a: "The theoretical realm where individuals can interact and transact with absolute privacy using cryptography." },
        { q: "Was the Bitcoin whitepaper published on a blog?", a: "No. It was posted to the Cryptography Mailing List on Halloween, 2008." },
        { q: "What is PGP?", a: "Pretty Good Privacy. An early encryption program that started a major legal battle for digital freedom." }
    ],
    'Bitcoin Governance': [
        { q: "Who controls Bitcoin's rules?", a: "The users. By running their own nodes, individuals decide which rules they will follow." },
        { q: "What is a soft fork?", a: "A backward-compatible protocol upgrade where old nodes still consider new blocks valid." },
        { q: "What is a hard fork?", a: "A protocol change that is not backward-compatible. Nodes that don't upgrade will split onto a different chain." },
        { q: "What is rough consensus?", a: "The process of moving forward with changes only when a massive majority of the community agrees." },
        { q: "What is a BIP?", a: "Bitcoin Improvement Proposal. A formal document for suggesting and discussing protocol changes." },
        { q: "What was BIP 148?", a: "The User-Activated Soft Fork (UASF) that forced the activation of SegWit in 2017." },
        { q: "Do developers have 'admin access' to Bitcoin?", a: "No. They can write code, but they cannot force anyone to run it. Every node operator chooses their own software." },
        { q: "What is the 'No2X' movement?", a: "The community campaign that successfully rejected a corporate attempt to hard-fork Bitcoin in 2017." },
        { q: "How is a BIP activated?", a: "Usually through a period of miner signaling or a specific block height trigger once consensus is reached." },
        { q: "Is Bitcoin a democracy?", a: "No. It is more like a voluntary system of rules. You choose the rules you follow by choosing your node software." }
    ],
    'Satoshi Nakamoto': [
        { q: "When did Satoshi vanish?", a: "His last known private email was in April 2011, saying he had 'moved on to other things'." },
        { q: "Why did Satoshi disappear?", a: "Likely to ensure Bitcoin had no 'head' to be attacked or co-opted, making it truly decentralized." },
        { q: "How much Bitcoin did Satoshi mine?", a: "Estimated at around 1.1 million BTC, all of which has never been moved from its original addresses." },
        { q: "Did Satoshi invent everything?", a: "No. He masterfully combined existing technologies like Hashcash, B-money, and public-key cryptography into a working system." },
        { q: "What was Satoshi's P2P Foundation quote?", a: "\"The root problem with conventional currency is all the trust that's required to make it work.\"" },
        { q: "What email provider did Satoshi use?", a: "gmx.com (satoshi@gmx.com)." },
        { q: "Where was the Bitcoin whitepaper published?", a: "A cryptography mailing list at metzdowd.com." },
        { q: "Who mined the Genesis Block?", a: "Satoshi Nakamoto. He included a headline from the London Times in the coinsbase." },
        { q: "Did Satoshi use a Japanese name?", a: "Yes, but many believe his writing style suggests he was likely a native English speaker." },
        { q: "Is Satoshi a group of people?", a: "It is possible. The identity remains one of the greatest mysteries of the digital age." }
    ],
    'Common Myths': [
        { q: "Is Bitcoin 'Too slow' for payments?", a: "No. The base layer is for settlement; the Lightning Network allows for millions of instant transactions per second." },
        { q: "Can Bitcoin be hacked?", a: "The protocol itself has never been successfully hacked. Individual wallets or exchanges are hacked due to poor security." },
        { q: "Does Bitcoin 'waste' electricity?", a: "No. It uses energy to secure a global, neutral financial system, often using energy that would otherwise be wasted." },
        { q: "Is Bitcoin 'only for criminals'?", a: "False. Cash is the preferred tool for crime. Bitcoin's transparent ledger is actually a nightmare for criminals." },
        { q: "Is Bitcoin 'backed by nothing'?", a: "It is backed by the most secure computer network on Earth, the laws of physics, and mathematical proof." },
        { q: "Will the 21 million limit be changed?", a: "No rational participant would vote to devalue their own holdings. Scarcity is Bitcoin's value." },
        { q: "Is Bitcoin a bubble?", a: "A bubble is a temporary spike; Bitcoin has grown in value and adoption over 15 years, surviving many 80% drops." },
        { q: "Is Bitcoin bad for the environment?", a: "Bitcoin mining incentivizes renewable energy builds and captures methane gas, which is many times worse than CO2." },
        { q: "Can Bitcoin be shut down by the government?", a: "No. It is a decentralized protocol. As long as two people can communicate, the network exists." },
        { q: "Are altcoins 'the next Bitcoin'?", a: "None have achieved Bitcoin's level of security, decentralization, or fair distribution. There is no second best." }
    ],
    'Global Impact': [
        { q: "What is the unbanked population?", a: "Billions of people worldwide who lack access to traditional financial services. Bitcoin provides them a bank in their pocket." },
        { q: "How does Bitcoin aid remittances?", a: "By allowing workers to send money home instantly and for nearly zero cost, bypassing expensive middlemen like Western Union." },
        { q: "What is monetary colonialism?", a: "The control of a nation's currency by a foreign power (e.g., the CFA franc). Bitcoin offers an escape to monetary sovereignty." },
        { q: "Why is Bitcoin important for human rights?", a: "It provides a censorship-resistant tool for activists and journalists under authoritarian regimes to receive funding." },
        { q: "What is an 'Orange Party'?", a: "A community gathering focused on Bitcoin education and circular economy adoption." },
        { q: "What is legal tender?", a: "Currency that must be accepted for debts and payments. El Salvador was the first to make Bitcoin legal tender." },
        { q: "How does Bitcoin promote peace?", a: "By making it harder for governments to fund wars through hidden taxation (inflation) since they cannot print Bitcoin." },
        { q: "What is a circular economy?", a: "An ecosystem where people earn, save, and spend Bitcoin directly without ever converting back to fiat." },
        { q: "Can Bitcoin help the environment?", a: "Yes, by providing an incentive to develop renewable energy near remote sources and reducing methane flaring." },
        { q: "What is the 'Great Definancialization'?", a: "The process of moving away from complex, debt-based financial instruments back to a simple, hard money standard." }
    ],
    'El Salvador & Adoption': [
        { q: "When did El Salvador adopt Bitcoin as legal tender?", a: "September 7, 2021 — the first country in the world to do so under President Nayib Bukele." },
        { q: "What is the Chivo Wallet?", a: "El Salvador's government-issued Bitcoin wallet. Each citizen who downloaded it received $30 in BTC." },
        { q: "What is Bitcoin Beach?", a: "A community in El Zonte, El Salvador that became a circular Bitcoin economy before the national adoption." },
        { q: "How does Bitcoin help El Salvador's remittances?", a: "70% of Salvadorans receive remittances. Bitcoin cuts transfer fees from 10-30% to nearly zero." },
        { q: "Did El Salvador buy Bitcoin?", a: "Yes. The government has been buying BTC regularly, holding over 5,000 BTC in its national treasury." },
        { q: "What is Bitcoin City?", a: "A planned city at the base of Conchagua volcano, powered by geothermal energy and funded by Bitcoin bonds." },
        { q: "What is the 'Volcano Bond'?", a: "A $1 billion government bond (half invested in BTC, half for Bitcoin City infrastructure) backed by Bitcoin." },
        { q: "Which other countries are considering Bitcoin?", a: "Bhutan mines BTC with hydropower, the Central African Republic adopted it, and several nations are exploring it." },
        { q: "What is a Bitcoin ATM?", a: "A physical machine where you can buy or sell Bitcoin with cash. El Salvador deployed 200+ nationwide." },
        { q: "What is 'Mi Primer Bitcoin'?", a: "A Salvadoran nonprofit providing free Bitcoin education to public school students — now expanding globally." }
    ],
    'Technical Deep Dives': [
        { q: "What is SHA-256?", a: "The cryptographic hash function that Bitcoin uses. It takes any input and produces a unique, fixed 256-bit output." },
        { q: "What is a Merkle Tree?", a: "A binary tree of transaction hashes used to efficiently summarize all transactions in a block." },
        { q: "What is a nonce?", a: "A random number miners change to produce a hash below the target. It's the 'guess' in the mining lottery." },
        { q: "What is SegWit?", a: "Segregated Witness. A 2017 upgrade that separates signature data from transaction data, increasing capacity." },
        { q: "What is Taproot?", a: "A 2021 upgrade enabling Schnorr signatures and MAST, improving privacy and efficiency of complex transactions." },
        { q: "What is a UTXO?", a: "Unspent Transaction Output. Bitcoin doesn't use 'accounts' — it tracks individual coins (UTXOs) you can spend." },
        { q: "What is Script?", a: "Bitcoin's simple programming language used to define spending conditions for each UTXO." },
        { q: "What is the target?", a: "A 256-bit number. To mine a valid block, the block header hash must be numerically less than this target." },
        { q: "What is an OP_CODE?", a: "An operation in Bitcoin's Script language. Examples: OP_CHECKSIG (verify signature), OP_RETURN (store data)." },
        { q: "What is a Compact Block?", a: "A bandwidth optimization (BIP 152) where nodes send only short transaction IDs instead of full blocks." }
    ]
};


    const cards = flashData[topic] || flashData['Bitcoin Basics'];
    let index = 0;
    let isFlipped = false;

    const renderCard = () => {
        inner.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;padding:10px;height:100%;min-height:400px;justify-content:center;">
            <div style="width:100%;display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <button id="closeFlash" style="background:none;border:none;color:var(--text-muted);font-size:1rem;cursor:pointer;padding:8px;font-family:inherit;">✕</button>
                <div style="font-size:0.8rem;color:var(--accent);text-transform:uppercase;letter-spacing:1px;font-weight:700;">${topic}</div>
                <div style="color:var(--text-faint);font-weight:700;font-size:0.8rem;">${index + 1} / ${cards.length}</div>
            </div>

            <div id="cardFlip" style="perspective:1000px;width:100%;max-width:350px;height:240px;cursor:pointer;margin-bottom:30px;">
                <div id="cardInner" style="position:relative;width:100%;height:100%;transition:transform 0.6s;transform-style:preserve-3d;">
                    <!-- Front -->
                    <div style="position:absolute;width:100%;height:100%;backface-visibility:hidden;-webkit-backface-visibility:hidden;background:var(--card-bg);border:2px solid var(--border);border-radius:24px;display:flex;align-items:center;justify-content:center;padding:30px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
                        <div>
                            <div style="font-size:3rem;margin-bottom:12px;opacity:0.3;">❓</div>
                            <div style="color:var(--heading);font-weight:700;font-size:1.15rem;line-height:1.4;">${cards[index].q}</div>
                        </div>
                        <div style="position:absolute;bottom:15px;color:var(--accent);font-size:0.75rem;font-weight:800;letter-spacing:1px;">TAP TO REVEAL ↺</div>
                    </div>
                    <!-- Back -->
                    <div style="position:absolute;width:100%;height:100%;backface-visibility:hidden;-webkit-backface-visibility:hidden;background:linear-gradient(135deg, var(--bg-side), var(--card-bg));border:2px solid var(--accent);border-radius:24px;display:flex;align-items:center;justify-content:center;padding:30px;text-align:center;transform:rotateY(180deg);box-shadow:0 8px 32px rgba(247,147,26,0.15);">
                        <div>
                            <div style="font-size:2rem;margin-bottom:12px;">🦌</div>
                            <div style="color:var(--text);font-size:1rem;line-height:1.6;font-weight:500;">${cards[index].a}</div>
                        </div>
                        <div style="position:absolute;bottom:15px;color:var(--accent);font-size:0.75rem;font-weight:800;letter-spacing:1px;">GOT IT! 🎯</div>
                    </div>
                </div>
            </div>

            <div style="display:flex;gap:12px;width:100%;max-width:350px;">
                <button id="prevBtn" style="flex:1;padding:16px;background:var(--bg-side);border:1px solid var(--border);border-radius:14px;color:var(--text);font-weight:700;cursor:pointer;font-family:inherit;${index === 0 ? 'opacity:0.3;pointer-events:none;' : ''}">PREV</button>
                <button id="nextBtn" style="flex:2;padding:16px;background:var(--accent);color:#fff;border:none;border-radius:14px;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 6px 16px rgba(247,147,26,0.3);">${index === cards.length - 1 ? 'FINISH ✓' : 'NEXT'}</button>
            </div>
        </div>`;

        document.getElementById('closeFlash').onclick = () => { modal.classList.remove('open'); };
        document.getElementById('cardFlip').onclick = () => {
            isFlipped = !isFlipped;
            document.getElementById('cardInner').style.transform = isFlipped ? 'rotateY(180deg)' : 'none';
        };
        document.getElementById('nextBtn').onclick = () => {
            if (index === cards.length - 1) {
                inner.innerHTML = `<div style="text-align:center;padding:50px 20px;">
                    <div style="font-size:5rem;margin-bottom:20px;">🎓</div>
                    <h2 style="color:var(--heading);margin-bottom:10px;">Great job, ${typeof nachoUserName === 'function' ? nachoUserName() : 'Scholar'}!</h2>
                    <p style="color:var(--text-muted);margin-bottom:30px;">You've mastered the <strong>${topic}</strong> deck.</p>
                    <button id="finishDeck" style="padding:16px 40px;background:var(--accent);color:#fff;border:none;border-radius:14px;font-weight:800;font-size:1rem;cursor:pointer;font-family:inherit;box-shadow:0 6px 16px rgba(247,147,26,0.3);">Back to Scholar Tab</button>
                </div>`;
                document.getElementById('finishDeck').onclick = () => { 
                    if (typeof awardPoints === 'function') awardPoints(10, '📚 Completed ' + topic + ' deck'); 
                    closeQuest(); 
                    if (typeof showSettingsPage === 'function') showSettingsPage('scholar'); 
                };
            } else {
                index++;
                isFlipped = false;
                renderCard();
            }
        };
        document.getElementById('prevBtn').onclick = () => {
            if (index > 0) {
                index--;
                isFlipped = false;
                renderCard();
            }
        };
    };

    renderCard();
    modal.classList.add('open');
};


// ---- OPENCLAW EXPORTS ----
if (typeof startScholarQuest !== "undefined") window.startScholarQuest = startScholarQuest;
if (typeof startFlashcards !== "undefined") window.startFlashcards = startFlashcards;