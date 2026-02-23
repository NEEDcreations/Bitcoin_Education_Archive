// =============================================
// Bitcoin Education Archive - Bitcoin Scholar Certification
// 200 question pool, 25 per attempt, 5 choices, 10 min timer
// 20/25 to pass, retry locked until next day
// =============================================

const SCHOLAR_POOL = [
    // === PROPERTIES & FUNDAMENTALS ===
    { q: "What makes Bitcoin's monetary policy fundamentally different from fiat currencies?", a: "Its supply schedule is fixed in code and cannot be changed by any authority", w: ["It is backed by gold reserves held in government vaults around the world", "Central banks can adjust its inflation rate through periodic monetary policy meetings", "Governments vote on supply changes through international economic councils and agreements", "Its supply grows proportionally to demand through algorithmic adjustments made by a central authority"] },
    { q: "Why is Bitcoin considered 'trustless'?", a: "Users can independently verify every transaction and rule without trusting third parties", w: ["Because nobody in the traditional financial system trusts Bitcoin as a legitimate asset", "Because it has no users who are willing to verify transactions independently", "Because the government guarantees every transaction through regulatory oversight and enforcement", "Because exchanges and custodians verify everything for you, eliminating the need for personal verification"] },
    { q: "What problem does Bitcoin's proof-of-work consensus solve?", a: "The double-spending problem without needing a trusted intermediary", w: ["Making all transactions completely free of charge by eliminating the need for any network fees", "Eliminating all transaction fees through an efficient centralized processing system", "Making Bitcoin mining profitable enough to sustain operations without any block rewards", "Reducing global electricity consumption by optimizing the consensus algorithm for efficiency"] },
    { q: "Why does Bitcoin have value according to Austrian economics?", a: "It possesses superior monetary properties: scarcity, durability, portability, divisibility, and fungibility", w: ["The government declared it legal tender everywhere through an international monetary agreement", "It is backed by physical assets stored in a secure vault maintained by the Bitcoin Foundation", "A corporation guarantees its price floor through reserve funds and market-making operations", "Supply and demand have no effect on its value because it operates outside of traditional market dynamics"] },
    { q: "What happens to the Bitcoin block reward over time?", a: "It halves approximately every 4 years until all 21 million Bitcoin are mined", w: ["It increases each year to incentivize miners and ensure the network continues to attract sufficient computational power", "It stays the same forever at 50 BTC per block regardless of how many halvings have occurred", "The community votes on changes every decade through a formal governance process managed by Bitcoin Core developers", "It doubles every 4 years to keep pace with growing demand and increasing mining difficulty"] },
    { q: "Why can't Bitcoin's 21 million supply cap be changed?", a: "Changing it would require near-universal consensus, and no rational participant would devalue their own holdings", w: ["A single developer with commit access to the repository can change the supply cap at any time", "The SEC prevents changes to the cap through its regulatory authority over digital asset securities", "Satoshi Nakamoto's original computer still controls the monetary policy through an encrypted protocol", "It's physically impossible to modify any code because the blockchain is stored on immutable hardware"] },
    { q: "What gives Bitcoin its censorship resistance?", a: "Its decentralized network of nodes that no single entity can control or shut down", w: ["A team of moderators reviews all transactions before they are approved and added to the blockchain", "Government agencies approve each block through a regulatory compliance verification process", "One central server processes everything and distributes the results to nodes around the world", "Banks whitelist approved transactions and reject any that don't meet their compliance standards"] },
    { q: "Why is Bitcoin described as 'sound money'?", a: "It cannot be debased, inflated, or manipulated by any central authority", w: ["It makes a sound when you send it", "Central banks control its inflation rate through the same mechanisms used for traditional fiat currencies", "It is always worth exactly one dollar due to a built-in price stabilization mechanism in the protocol", "The government prints more when needed to ensure adequate liquidity in the cryptocurrency markets"] },
    { q: "What does 'Bitcoin fixes the money' mean in principle?", a: "Bitcoin removes the ability of institutions to inflate away purchasing power through money printing", w: ["Bitcoin eliminates all financial problems instantly by replacing the entire legacy financial infrastructure", "Bitcoin replaces all government services by providing a decentralized alternative to every public institution", "Bitcoin makes everyone equally wealthy by redistributing value from the rich to those who adopt it early", "Bitcoin eliminates the need for savings because its price appreciation makes saving unnecessary"] },
    { q: "Why is energy expenditure in Bitcoin mining a feature, not a bug?", a: "It provides real-world thermodynamic security that makes the network extremely costly to attack", w: ["It wastes energy intentionally to slow transactions down and prevent the network from being overwhelmed", "Energy use has no relationship to security and exists only as an unintended byproduct of the mining process", "It exists only because the code is inefficient and developers haven't found a way to optimize it yet", "It is a temporary flaw being fixed in the next major protocol update scheduled by the development team"] },

    // === DECENTRALIZATION ===
    { q: "Why is decentralization crucial for Bitcoin's value proposition?", a: "It ensures no single point of failure and prevents any entity from controlling or censoring transactions", w: ["It makes transactions faster than centralized systems by distributing processing across multiple nodes", "It reduces the cost of mining equipment by allowing smaller operators to participate in block validation", "It allows a CEO to make quick decisions about protocol upgrades without waiting for community consensus", "It enables reversal of fraudulent transactions through a decentralized dispute resolution mechanism"] },
    { q: "What role do full nodes play in Bitcoin's decentralization?", a: "They independently verify every transaction and block against consensus rules", w: ["They only store a copy of the blockchain for backup purposes in case the main servers go down", "They increase Bitcoin's transaction speed by processing transactions in parallel across multiple cores", "They allow miners to bypass consensus rules when network conditions require faster block production", "They are operated exclusively by Bitcoin Core developers who maintain the reference implementation"] },
    { q: "If a majority of miners tried to change Bitcoin's rules, what would happen?", a: "Full nodes would reject their invalid blocks, and miners would waste their energy", w: ["The rule change would automatically take effect because miners have ultimate authority over the protocol rules", "Bitcoin would immediately shut down because it cannot function without the approval of a majority of miners", "All existing Bitcoin would become worthless because the network requires miner consensus to maintain value", "Users would be forced to accept the new rules because nodes automatically update to match miner decisions"] },
    { q: "Why can no government effectively ban Bitcoin?", a: "Its decentralized peer-to-peer network can operate across borders with no central point to shut down", w: ["International law prevents governments from banning currencies through treaties and trade agreements", "Bitcoin is protected by the US Constitution under the First Amendment's freedom of speech provisions", "Only one government would need to approve it globally for Bitcoin to gain worldwide legal recognition", "Bitcoin can only exist in countries where it is legal because nodes require government permission to operate"] },
    { q: "What distinguishes Bitcoin's governance from corporate governance?", a: "Changes require rough consensus among users, developers, miners, and node operators — no one group has unilateral control", w: ["A board of directors votes on all protocol changes and implements them through a centralized update mechanism", "Satoshi Nakamoto approves all updates from a secure location before they are deployed to the network", "The largest mining pool dictates all changes because mining power equals governance power in the protocol", "Whoever owns the most Bitcoin decides the rules through a stake-weighted governance voting mechanism"] },

    // === SCARCITY & MONETARY PROPERTIES ===
    { q: "How does Bitcoin's scarcity differ from gold's scarcity?", a: "Bitcoin's supply is mathematically fixed and verifiable, while gold's total supply is unknown and new deposits can be discovered", w: ["Gold is scarcer than Bitcoin because the total amount of gold in the Earth's crust is precisely known", "Both have exactly the same supply dynamics because they are both mined and have similar extraction curves", "Bitcoin's supply can be increased by miners if they collectively agree to modify the block reward parameters", "Gold has a fixed supply cap like Bitcoin because geologists have mapped every gold deposit on Earth"] },
    { q: "What is the significance of Bitcoin's stock-to-flow ratio after the 2024 halving?", a: "It surpasses gold's stock-to-flow ratio, making Bitcoin the hardest money ever created", w: ["It becomes easier to mine more Bitcoin faster", "The ratio decreases as more Bitcoin are created", "It has no relationship to Bitcoin's value proposition", "It means Bitcoin becomes inflationary after the halving"] },
    { q: "Why is absolute digital scarcity considered Bitcoin's most important innovation?", a: "For the first time in history, humans created an asset with a supply that is provably finite and immutable", w: ["Digital scarcity had already been achieved by several earlier projects like DigiCash and e-gold before Bitcoin existed", "Scarcity has minimal impact on value according to modern monetary theory because demand is the only factor that matters", "Any cryptocurrency project can replicate Bitcoin's digital scarcity simply by copying the code and setting the same supply cap", "Central banks have the technical ability to create provably scarce digital currencies using their own blockchain infrastructure"] },
    { q: "What makes Bitcoin 'unforgeable'?", a: "The proof-of-work system ensures that creating valid Bitcoin requires real energy expenditure that cannot be faked", w: ["A centralized certificate authority validates and stamps each Bitcoin as authentic before it can be transferred between wallets", "Advanced software watermarks embedded in each transaction prevent unauthorized duplication of coins across the network", "Each individual Bitcoin contains a unique serial number that is verified by payment processors like Visa during transactions", "A sophisticated anti-counterfeiting AI system continuously monitors the entire network to detect and eliminate forged coins"] },
    { q: "Why does deflation benefit savers in a Bitcoin standard?", a: "Purchasing power increases over time, rewarding those who produce more than they consume", w: ["Deflation causes consumer prices to rise rapidly over time, which erodes the purchasing power of savings held in any currency", "Deflation primarily benefits people who spend their money quickly before prices drop further, rather than those who save long-term", "There is no meaningful economic relationship between deflation and saving behavior because consumers spend regardless of monetary conditions", "Deflation can only function properly as an economic force when governments actively intervene to manage and regulate the rate of price changes"] },

    // === SECURITY ===
    { q: "What would a successful 51% attack actually allow an attacker to do?", a: "Reverse their own recent transactions (double-spend), but NOT steal others' coins or create fake Bitcoin", w: ["Steal all Bitcoin stored in every wallet on the network by redirecting transactions to the attacker's addresses during block validation", "Create an unlimited number of new Bitcoin by modifying the coinbase reward in each block they produce to any amount they choose", "Permanently change Bitcoin's core monetary policy including the supply cap and halving schedule by rewriting the consensus rules", "Access and decrypt every user's private keys through the computational power used to achieve majority hash rate control"] },
    { q: "Why does Bitcoin's security increase as its price rises?", a: "Higher prices incentivize more mining, increasing the hash rate and making attacks more expensive", w: ["The code automatically becomes more complex at higher prices", "More developers are hired to protect it", "The government provides more security at higher valuations", "Security and price have no relationship in Bitcoin"] },
    { q: "What protects Bitcoin from quantum computing threats?", a: "Bitcoin can be upgraded with quantum-resistant cryptography, and quantum computers would need to break SHA-256 and ECDSA simultaneously", w: ["Bitcoin is permanently immune to all computing advances", "Quantum computers already exist that could break Bitcoin", "Bitcoin uses quantum computing for its encryption", "Quantum computing would only make Bitcoin faster"] },
    { q: "Why is Bitcoin's security model described as 'thermodynamic'?", a: "It converts real-world energy into digital security, making attacks require equivalent real-world resources", w: ["Bitcoin generates physical heat as a security measure", "Temperature sensors protect the blockchain", "Security depends on keeping servers at low temperatures", "Thermodynamics has nothing to do with Bitcoin's security"] },
    { q: "What makes Bitcoin's track record of security significant?", a: "Despite being a multi-trillion dollar bounty, the protocol has never been successfully hacked since its inception", w: ["The Bitcoin protocol has been successfully hacked on multiple occasions but the development team quickly patched vulnerabilities and recovered funds", "Bitcoin's security is ultimately guaranteed and backed by the United States military as part of its digital infrastructure protection mandate", "Major global insurance companies provide comprehensive coverage against any losses from Bitcoin protocol-level security breaches", "Bitcoin's market capitalization is too small and insignificant to attract the attention of sophisticated hackers and state-level actors"] },

    // === PROOF OF WORK vs PROOF OF STAKE ===
    { q: "Why is proof-of-work considered more decentralized than proof-of-stake?", a: "PoW requires ongoing real-world energy expenditure, preventing the accumulation of permanent control through wealth alone", w: ["Proof-of-work actually consumes less total electricity than proof-of-stake when accounting for the full infrastructure costs of both systems", "Proof-of-work allows fewer people to meaningfully participate in consensus because specialized hardware creates higher barriers to entry", "Proof-of-stake and proof-of-work achieve exactly the same level of decentralization by design since both distribute validation randomly", "Proof-of-work mining operations require explicit government approval and licensing in most jurisdictions before they can begin operating"] },
    { q: "What fundamental problem does proof-of-stake fail to solve that proof-of-work addresses?", a: "PoS cannot achieve trustless consensus without an external anchor to the physical world", w: ["Proof-of-stake processes transactions far too quickly for the network to maintain proper synchronization across all distributed validator nodes", "Proof-of-stake actually uses more total electricity than proof-of-work when you factor in the energy costs of all the validator infrastructure", "Proof-of-work is simply an older and therefore less innovative consensus mechanism that has been made obsolete by proof-of-stake's improvements", "Proof-of-stake systems inevitably create too many new coins through staking rewards, leading to uncontrollable long-term supply inflation"] },
    { q: "Why do some argue that proof-of-stake replicates the existing financial system?", a: "Those with the most capital gain the most power and rewards, similar to how traditional finance concentrates wealth", w: ["Proof-of-stake networks use the same core programming languages and frameworks that traditional banking infrastructure relies on for operations", "Participating as a validator in most proof-of-stake systems requires obtaining a banking or money transmitter license from financial regulators", "The proof-of-stake consensus mechanism was originally invented and developed by a consortium of central banks as a controlled alternative", "Proof-of-stake tokens are technically classified as securities that are issued and regulated by the Federal Reserve and SEC jointly"] },

    // === MONEY & ECONOMICS ===
    { q: "According to the Austrian School of Economics, why does fiat money lose value over time?", a: "Governments continuously increase the money supply, diluting the purchasing power of existing currency", w: ["Money naturally decays and loses value over time just like any physical object due to the fundamental laws of entropy and thermodynamics", "People periodically lose confidence in their currency for no identifiable economic reason, which is what causes all historical currency failures", "Advances in financial technology gradually make older forms of money obsolete, which is the primary driver of fiat currency devaluation", "Fiat currencies actually gain purchasing power over time according to mainstream economic consensus because of productivity improvements"] },
    { q: "Why is Bitcoin's fixed supply considered superior to the Federal Reserve's monetary policy?", a: "Rules-based monetary policy removes human error, corruption, and political manipulation from money creation", w: ["The Federal Reserve has maintained a significantly better long-term track record of preserving purchasing power compared to Bitcoin's volatile history", "A completely fixed monetary supply makes it mathematically impossible for any transactions to occur once all units have been distributed", "Human-managed monetary policy is inherently superior because trained economists can respond to economic crises with nuance that algorithms cannot", "Bitcoin operates without any form of monetary policy whatsoever, which means its supply schedule is entirely random and unpredictable"] },
    { q: "What does 'lowering your time preference' mean in the context of Bitcoin?", a: "Valuing future rewards more highly and making long-term decisions rather than seeking instant gratification", w: ["Spending your money as quickly as possible before inflation erodes its purchasing power, which is a rational response to monetary debasement", "Reducing the total amount of time you dedicate to researching and studying Bitcoin so you can focus on other financial opportunities", "Optimizing your Bitcoin wallet settings and transaction parameters to make payments process through the network significantly faster", "Adjusting your trading strategy to focus on shorter timeframes like day trading and scalping rather than long-term holding positions"] },
    { q: "Why is the Cantillon Effect important for understanding Bitcoin's value?", a: "It shows how those closest to new money creation benefit at the expense of everyone else, a problem Bitcoin eliminates", w: ["The Cantillon Effect conclusively proves that Bitcoin mining is fundamentally unprofitable for all participants regardless of energy costs", "It demonstrates through rigorous economic analysis why moderate inflation is beneficial and necessary for all members of society equally", "It provides the theoretical framework explaining why Bitcoin needs a central bank to properly manage its monetary policy and supply", "The Cantillon Effect is an outdated 18th century theory that has no relevance to modern monetary economics or cryptocurrency markets"] },
    { q: "How does Bitcoin act as a hedge against currency devaluation?", a: "Its fixed supply and decentralized nature make it immune to the inflationary policies of any government", w: ["Bitcoin's price is algorithmically pegged to the US dollar through a stabilization mechanism built into the protocol's consensus rules", "The United States government provides an implicit guarantee of Bitcoin's minimum value as part of its digital asset regulatory framework", "Major commercial banks offer comprehensive insurance products that protect investors against any losses in their Bitcoin holdings", "Bitcoin's protocol includes an automatic supply adjustment mechanism that creates or destroys coins to precisely match prevailing inflation rates"] },
    { q: "What is the significance of Bitcoin being 'bearer asset'?", a: "Whoever holds the private keys has direct ownership without relying on any institution", w: ["Bitcoin can only legally be held and transferred by licensed financial bearers who have been certified by regulatory authorities to handle digital assets", "The term bearer specifically means that Bitcoin requires a regulated bank or custodian to hold it on your behalf for security and compliance purposes", "As a bearer instrument, Bitcoin must be physically carried between users on hardware devices because it cannot exist in purely digital form", "Bearer asset status is a legal designation that must be formally granted through government registration and is subject to periodic renewal"] },
    { q: "Why is Bitcoin compared to 'digital real estate'?", a: "There is a fixed amount of 'space' on the blockchain, and no more can ever be created", w: ["Bitcoin's blockchain technology can be used to digitally construct and manage virtual houses and buildings in decentralized metaverse platforms", "Bitcoin is classified and regulated exactly like physical real property in most jurisdictions, subject to the same zoning and transfer laws", "Bitcoin mining operations require ownership of dedicated physical land parcels because of the cooling and infrastructure requirements involved", "Licensed real estate agents have expanded their services to include Bitcoin sales and transfers as part of their property transaction business"] },

    // === LIGHTNING NETWORK & LAYERS ===
    { q: "Why does Bitcoin need second-layer solutions like the Lightning Network?", a: "The base layer prioritizes security and decentralization, so additional layers handle speed and scalability", w: ["The base layer is broken and needs replacement", "Lightning makes Bitcoin more decentralized", "Second layers are unnecessary if you increase block size", "Bitcoin's base layer is too fast and needs to be slowed down"] },
    { q: "How does the Lightning Network achieve near-instant transactions?", a: "By creating payment channels where transactions settle between parties without broadcasting to the main chain", w: ["By temporarily disabling Bitcoin's security and verification features during the transaction to allow for faster processing between parties", "By routing all Lightning payments through a separate centralized server infrastructure that processes transactions outside the blockchain", "By reducing Bitcoin's block time from ten minutes down to one second specifically for Lightning-enabled transactions on the network", "By completely eliminating the need for mining and proof-of-work validation, replacing it with instant cryptographic confirmation between nodes"] },
    { q: "What trade-off does increasing Bitcoin's block size make?", a: "Larger blocks increase throughput but reduce decentralization by making it harder to run full nodes", w: ["Larger blocks significantly increase Bitcoin's security by providing more space for proof-of-work validation data within each individual block", "The size of blocks has absolutely no measurable effect on network decentralization because node operators simply upgrade their hardware accordingly", "Increasing the block size actually reduces overall transaction throughput because larger blocks take longer to propagate and validate across nodes", "Larger blocks make it substantially cheaper and easier to run full nodes because the increased efficiency offsets any additional storage requirements"] },

    // === SELF CUSTODY & SECURITY ===
    { q: "Why is the phrase 'not your keys, not your coins' fundamental to Bitcoin?", a: "If you don't control your private keys, a third party controls your Bitcoin and could lose, freeze, or steal them", w: ["It's just a marketing slogan with no practical meaning", "Keys are physical objects that prove Bitcoin ownership", "Only miners need to worry about key ownership", "Banks can always recover lost Bitcoin regardless of keys"] },
    { q: "What is the most important property of a Bitcoin seed phrase?", a: "It is the master backup that can regenerate all private keys and recover funds from any compatible wallet", w: ["The seed phrase must be stored digitally in a secure cloud service for maximum safety because physical backups can be lost or damaged over time", "Each seed phrase can only be used once to restore a wallet before it automatically expires and a new one must be generated from scratch", "The seed phrase contains the actual Bitcoin itself in a specially encoded form, which is why losing it means the coins are permanently gone", "If you lose your seed phrase, Bitcoin's customer support team can verify your identity and provide a replacement phrase to restore access"] },
    { q: "Why should Bitcoin seed phrases never be stored digitally?", a: "Digital storage is vulnerable to hacking, malware, and data breaches that could expose your keys", w: ["Digital storage in encrypted cloud services is actually the safest option available for seed phrases because it provides redundancy and backup protection", "Seed phrases have a built-in expiration mechanism that activates when they are stored in any digital format, rendering them useless after a set period", "The Bitcoin protocol includes detection mechanisms that automatically block and invalidate any seed phrases that have been stored in digital formats", "Creating digital copies of seed phrases generates duplicate Bitcoin on the network because each copy of the phrase creates a new set of identical coins"] },

    // === MINING ===
    { q: "What is the primary purpose of Bitcoin mining?", a: "To secure the network by making it computationally expensive to attack or rewrite transaction history", w: ["The primary purpose of mining is to create as many new Bitcoin as quickly as possible in order to distribute them widely across the global economy", "Mining exists primarily to keep electricity companies profitable by providing consistent high-volume energy consumption as a guaranteed revenue source", "Mining hardware serves as specialized physical storage devices that securely contain and protect the Bitcoin held within each individual mining unit", "The extensive infrastructure built for Bitcoin mining primarily serves to provide reliable internet access to rural and underserved communities worldwide"] },
    { q: "How does the difficulty adjustment contribute to Bitcoin's reliability?", a: "It ensures blocks are found approximately every 10 minutes regardless of how much mining power joins or leaves", w: ["The difficulty adjustment gradually makes mining easier over time specifically to attract new miners and ensure the network continues to grow steadily", "Bitcoin's mining difficulty is designed to permanently increase over time and can never decrease, which ensures the network becomes more secure each year", "The difficulty level is recalculated and adjusted only once per year during a network-wide vote conducted by all active mining pool operators collectively", "The difficulty adjustment mechanism functions as a price stabilization tool that keeps Bitcoin's market value steady at a predetermined target level"] },
    { q: "Why is Bitcoin mining an ally in renewable energy development?", a: "Miners can monetize stranded or excess energy that would otherwise be wasted, subsidizing renewable projects", w: ["The Bitcoin protocol includes a built-in rule that only allows mining to be performed using verified renewable energy sources certified by green energy auditors", "Modern Bitcoin mining technology uses virtually no electricity at all thanks to breakthrough efficiency improvements in the latest generation of ASIC chips", "International environmental regulations now require all Bitcoin mining operations to exclusively use solar power or face substantial fines and penalties", "The massive energy demands of Bitcoin mining actively prevent renewable energy projects from being developed by consuming all available green energy supply"] },
    { q: "What happens when the last Bitcoin is mined around 2140?", a: "Miners will be incentivized solely by transaction fees to continue securing the network", w: ["The Bitcoin network will permanently shut down and cease to function once the last coin is mined because there will be no remaining incentive for miners", "The protocol will automatically begin creating new replacement Bitcoin through a secondary issuance mechanism to ensure miners continue to be compensated", "All Bitcoin miners will collectively transition to mining Ethereum and other proof-of-work cryptocurrencies once Bitcoin mining rewards reach zero", "The protocol includes a built-in failsafe that automatically converts Bitcoin from proof-of-work to proof-of-stake once all coins have been mined"] },

    // === PRIVACY & SOVEREIGNTY ===
    { q: "Why is financial privacy considered a human right by Bitcoin advocates?", a: "Privacy protects individuals from persecution, theft, and economic manipulation by powerful entities", w: ["Financial privacy serves no legitimate purpose and is exclusively useful for criminals trying to hide illegal activity from law enforcement authorities", "Financial privacy has never been recognized as an important right by any major human rights organization or international legal framework in history", "Bitcoin provides complete and total anonymity by default for every transaction, making it impossible for anyone to trace payments on the blockchain", "Democratic governments should have unrestricted access to all citizens' financial records because transparency is essential for maintaining public safety"] },
    { q: "What does financial sovereignty mean in the context of Bitcoin?", a: "The ability to store, send, and receive value without permission from or control by any third party", w: ["Having a premium bank account with special privileges and benefits that provide enhanced access to financial services beyond what regular accounts offer", "Being officially granted the legal authority to print and issue your own money backed by your personal assets and guaranteed by financial institutions", "Having comprehensive government-backed insurance on all your investments that protects against any losses from market downturns or fraud", "Having the ability to reverse any financial transaction you make within a thirty-day window regardless of whether the recipient agrees to the reversal"] },
    { q: "Why is KYC (Know Your Customer) controversial in the Bitcoin community?", a: "It creates surveillance databases, connects identities to Bitcoin holdings, and undermines the censorship-resistant properties", w: ["Know Your Customer regulations are universally supported by all Bitcoin users because they provide essential consumer protections and prevent fraud", "KYC requirements actually make Bitcoin more decentralized by ensuring that only verified legitimate participants can access and use the network", "KYC regulations only apply to Bitcoin purchases exceeding one million dollars in value, leaving smaller everyday transactions completely unaffected", "KYC procedures are specifically designed to protect users' privacy by securely hiding their identity from other participants on the network"] },

    // === GAME THEORY & INCENTIVES ===
    { q: "Why is Bitcoin adoption described as a 'prisoner's dilemma' for nation-states?", a: "Countries that adopt Bitcoin first gain an advantage, so rational actors are incentivized to adopt before competitors do", w: ["All participating countries would need to adopt Bitcoin simultaneously in a coordinated agreement or the entire monetary transition would fail completely", "Countries that adopt Bitcoin face imprisonment-like economic sanctions from international financial organizations that oppose decentralized currencies", "Bitcoin's protocol is designed to penalize early adopters with progressively higher transaction fees to ensure fair distribution among latecomers", "Nation-states have absolutely no strategic or economic incentive to hold Bitcoin in their reserves because it provides no geopolitical advantage"] },
    { q: "How does Bitcoin's incentive structure prevent cheating?", a: "The cost of attacking the network far exceeds any potential profit from cheating", w: ["A centralized fraud department monitors all transactions", "Cheaters are identified and banned by Bitcoin's CEO", "Insurance covers any losses from cheating", "Social pressure prevents all dishonest behavior"] },
    { q: "Why is it said that 'Bitcoin changes you before you change Bitcoin'?", a: "Understanding Bitcoin's principles naturally shifts your perspective on money, time, and value", w: ["Bitcoin's software gradually alters your computer settings and browsing habits to align with cryptocurrency-optimized configurations over time", "Using Bitcoin requires you to legally change your name to a pseudonymous identity as part of the network's privacy and security requirements", "Bitcoin is designed to physically transform into whatever form of value the holder needs, functioning as a universal digital commodity on demand", "The blockchain permanently records and gradually modifies your personality profile based on your transaction patterns and network activity"] },
    { q: "What does 'gradually, then suddenly' describe about Bitcoin adoption?", a: "Adoption grows slowly through education and understanding, then accelerates rapidly through network effects", w: ["Bitcoin's price only goes up gradually, never suddenly", "The network gradually slows down then suddenly crashes", "Gradually refers to mining and suddenly refers to halving", "This phrase has no specific meaning in Bitcoin"] },

    // === HISTORY & ORIGINS ===
    { q: "Why was Bitcoin's anonymous creation by Satoshi Nakamoto important?", a: "It ensured no single leader could be pressured, corrupted, or become a central point of failure", w: ["Anonymity was accidental and Satoshi plans to reveal identity", "It allowed Satoshi to avoid paying taxes on Bitcoin", "Anonymity is required by all cryptocurrency creators", "It was a marketing strategy to generate interest"] },
    { q: "What problem did the 2008 financial crisis expose that Bitcoin was designed to solve?", a: "The systemic risk of trusting centralized institutions with the global financial system", w: ["The critical need for faster and more efficient stock trading platforms that could handle the volume of transactions during periods of market stress", "A severe and dangerous shortage of physical cash in circulation that prevented ordinary citizens from conducting everyday financial transactions", "The global lack of sufficient bank branches and physical financial infrastructure to serve the growing population's basic banking needs adequately", "The increasingly high cost of gold mining operations worldwide which made it impractical to maintain a gold-backed monetary system any longer"] },
    { q: "Why is the Bitcoin genesis block's embedded message significant?", a: "It references a bank bailout headline, highlighting the broken financial system Bitcoin was created to address", w: ["The embedded message contains detailed technical instructions that miners needed to follow in order to successfully mine the second block in the chain", "The message was randomly generated by the software as a placeholder and has no particular symbolic or political meaning whatsoever to the project", "Hidden within the genesis block message is an encoded reference to Satoshi Nakamoto's real identity that cryptographers have been trying to decode", "The genesis block contains a compressed copy of the entire Bitcoin source code that nodes extract during their initial blockchain synchronization"] },

    // === NETWORK EFFECTS & ADOPTION ===
    { q: "Why do Bitcoin's network effects create a 'winner-take-most' dynamic in digital money?", a: "The most secure, liquid, and widely accepted monetary network attracts users exponentially, reinforcing its dominance", w: ["All cryptocurrencies benefit equally from network effects", "Network effects don't apply to digital currencies", "The first-created cryptocurrency always wins regardless of properties", "Government regulation determines which network wins"] },
    { q: "How does the Lindy Effect apply to Bitcoin?", a: "The longer Bitcoin survives and thrives, the longer its expected remaining lifespan becomes", w: ["Bitcoin gets weaker and less likely to survive over time", "The Lindy Effect only applies to physical objects", "It means Bitcoin will last exactly as long as it already has", "The Lindy Effect proves Bitcoin will fail soon"] },
    { q: "Why is Bitcoin's network effect considered its strongest moat?", a: "Each new user increases liquidity, security, development, and adoption, creating a self-reinforcing cycle that competitors cannot easily replicate", w: ["Bitcoin has patents that prevent competition", "Government regulations prevent new networks from forming", "The network effect is easily replicable by newer projects", "Network effects only apply to social media, not money"] },

    // === COMMON MISCONCEPTIONS ===
    { q: "Why is the argument 'Bitcoin has no intrinsic value' flawed?", a: "No money has intrinsic value — value is subjective, and Bitcoin's monetary properties make it superior to alternatives", w: ["Bitcoin does have intrinsic value because it's backed by gold", "The argument is actually correct and Bitcoin is therefore worthless", "Intrinsic value only comes from government declaration", "Bitcoin has intrinsic value because servers are expensive"] },
    { q: "Why is comparing Bitcoin's energy use to a country's energy use misleading?", a: "The comparison ignores that Bitcoin secures a global financial network and monetizes otherwise stranded energy", w: ["Bitcoin actually consumes more total energy than all countries in the world combined when accounting for the full lifecycle of mining hardware production", "Energy comparisons between Bitcoin and countries are always accurate and helpful because they use standardized measurement methodologies across all contexts", "Modern Bitcoin mining has been optimized to the point where it uses virtually no measurable energy at all thanks to quantum computing breakthroughs", "A country's total energy consumption is completely irrelevant to any comparison because nations and monetary networks serve fundamentally different purposes"] },
    { q: "Why does 'Bitcoin is too slow for payments' miss the bigger picture?", a: "Bitcoin's base layer is a settlement network optimized for security, while payment layers like Lightning handle daily transactions", w: ["Bitcoin is actually faster than Visa at all times because it processes transactions across a global network simultaneously", "Slow transactions are a permanent unfixable flaw that will ultimately prevent Bitcoin from achieving mainstream adoption", "Speed is the only metric that matters for money because users will always choose the fastest payment option", "No solution for Bitcoin's speed limitations exists or is being developed by any team in the Bitcoin ecosystem"] },
    { q: "Why don't altcoins disprove Bitcoin's scarcity?", a: "Creating another cryptocurrency doesn't affect Bitcoin's supply, just as starting a new company doesn't dilute Apple's shares", w: ["Altcoins do actually reduce Bitcoin's scarcity", "There is no difference between Bitcoin and any altcoin since they all use similar blockchain technology and serve the same purpose", "All cryptocurrencies share the same supply cap because they all derive from Bitcoin's original codebase and parameters", "Bitcoin's code automatically adjusts for new altcoins by reducing its own supply proportionally to maintain scarcity"] },
    { q: "Why is 'Bitcoin is only used by criminals' a misleading statement?", a: "Cash is used far more for illicit activity, and Bitcoin's transparent blockchain actually makes it poor for crime", w: ["Bitcoin is indeed primarily used for criminal activity", "Criminals prefer Bitcoin because it's completely anonymous and law enforcement has no way to trace transactions", "No criminals have ever used traditional banking systems because they require identification to open accounts", "Law enforcement cannot trace Bitcoin transactions because the blockchain encrypts all sender and receiver information"] },

    // === TECHNICAL FUNDAMENTALS ===
    { q: "What is a UTXO and why does it matter?", a: "An Unspent Transaction Output — the fundamental unit of Bitcoin ownership that tracks which coins can be spent", w: ["UTXO stands for Universal Transaction eXchange Object and refers to a specific type of hardware wallet manufactured exclusively by Ledger company", "A UTXO is a government-issued tracking number assigned to each Bitcoin transaction for the purpose of tax reporting and regulatory compliance", "UTXO is the name of the specific mining algorithm that Bitcoin uses to create new coins through the proof-of-work computational process each block", "UTXO is a decentralized social media platform built on the Bitcoin blockchain specifically designed for cryptocurrency traders to share market analysis"] },
    { q: "Why is Bitcoin's blockchain described as a 'timechain'?", a: "Each block creates an immutable timestamp, establishing chronological ordering of all transactions", w: ["The blockchain can only process and confirm transactions during certain designated hours of the day based on the network's operational schedule", "Blocks on the Bitcoin network are created at precisely one-second intervals, making it function as an extremely accurate timekeeping mechanism", "Satoshi Nakamoto originally chose the name timechain purely as a marketing term to make the technology sound more innovative and appealing", "Different time zones around the world directly affect how Bitcoin transactions are processed and prioritized within the global mempool queue"] },
    { q: "What makes Bitcoin transactions 'immutable' after sufficient confirmations?", a: "The cumulative proof-of-work built on top of a transaction makes it exponentially harder to reverse", w: ["An admin team at Bitcoin headquarters locks confirmed transactions", "Transactions can always be reversed by the sender", "Government regulations prevent transaction reversal", "Immutability is just a theoretical concept, not reality"] },
    { q: "What is a Bitcoin 'fork' and why do most forks fail?", a: "A fork copies Bitcoin's code but cannot replicate its network effect, security, and decentralization", w: ["Forks are improvements that always replace the original Bitcoin", "Forks cannot exist because Bitcoin's code is patented", "Every fork automatically gains Bitcoin's full hash rate", "Forks are approved by Bitcoin's governing board"] },
    { q: "Why does Bitcoin use a 10-minute block time instead of faster?", a: "It provides sufficient time for blocks to propagate globally, maintaining decentralization and reducing orphaned blocks", w: ["Ten minutes was a random choice with no technical basis", "Faster block times would increase security", "The block time will be reduced to one minute in the next upgrade", "Block time has no effect on network performance"] },

    // === BROADER IMPACT ===
    { q: "How can Bitcoin impact human rights in authoritarian countries?", a: "It provides an uncensorable financial tool that cannot be seized or frozen by oppressive governments", w: ["Authoritarian governments can easily block all Bitcoin use", "Bitcoin only works in democratic countries", "Human rights organizations oppose Bitcoin", "Bitcoin requires government permission to use in all countries"] },
    { q: "Why might a Bitcoin standard discourage war?", a: "Governments can no longer print money to fund wars — they must tax citizens directly, increasing political accountability", w: ["Bitcoin includes a built-in anti-war protocol mechanism in its consensus rules that automatically blocks any transactions associated with military spending", "Throughout human history, wars have never been meaningfully funded through money printing or currency debasement by any government or empire", "All Bitcoin users are required to digitally sign a cryptographic non-aggression pact as part of the network's terms of service during wallet setup", "The United Nations has been granted administrative control over the Bitcoin network specifically to prevent it from being used to fund armed conflicts"] },
    { q: "How does Bitcoin empower the unbanked population globally?", a: "Anyone with internet access can participate in the financial system without needing bank accounts, credit checks, or identification", w: ["It requires a bank account and credit score to use", "Only citizens of developed nations can access Bitcoin", "Bitcoin requires a physical bank branch to operate", "You need government-issued ID to create a Bitcoin wallet"] },
    { q: "Why is Bitcoin considered a tool for financial inclusion?", a: "It provides permissionless access to savings, payments, and financial services for anyone worldwide", w: ["Bitcoin's technical complexity effectively excludes anyone without at least a university-level education in computer science or financial technology", "Only SEC-accredited investors who meet specific income and net worth thresholds are legally permitted to purchase and hold Bitcoin directly", "True financial inclusion can only be achieved through the expansion of centralized banking infrastructure to underserved communities around the world", "Bitcoin's protocol enforces maximum balance limits for newly created wallets to ensure fair distribution and prevent wealth concentration among early users"] },

    // === ALTCOINS & COMPETITION ===
    { q: "Why do Bitcoin maximalists argue that altcoins are unnecessary?", a: "Bitcoin's base layer plus additional protocol layers can serve all monetary and smart contract use cases without the trade-offs altcoins make", w: ["Bitcoin maximalists are generally uninformed about modern blockchain technology advances and dismiss altcoin innovations out of ignorance rather than analysis", "Altcoins and Bitcoin serve completely different market segments and use cases, so they complement each other rather than compete for the same users", "Bitcoin maximalism is fundamentally a religious-like belief system with no logical or economic basis that relies on faith rather than technical understanding", "Bitcoin's protocol is permanently frozen and cannot be upgraded to add any new features, which is why alternative blockchain projects are necessary"] },
    { q: "What fundamental flaw do critics identify in Ethereum's monetary policy?", a: "Its monetary policy has been changed multiple times, demonstrating it has no credible commitment to a fixed supply", w: ["Ethereum has more strict monetary policy than Bitcoin", "Ethereum's monetary policy is identical to Bitcoin's", "Monetary policy is irrelevant for smart contract platforms", "Ethereum's supply is fixed at 100 million"] },
    { q: "Why is the existence of thousands of cryptocurrencies not a threat to Bitcoin?", a: "Bitcoin's value comes from its unique properties — decentralization, security, immutability — which no altcoin has replicated", w: ["All cryptocurrencies are essentially interchangeable with one another since they all use blockchain technology and serve the same fundamental purpose", "The creation of more cryptocurrency projects increases the total combined value of all crypto assets including Bitcoin through broader market awareness", "In technology markets, competition from newer and more innovative competitors always eventually destroys the first mover's dominant market position", "As the cryptocurrency market matures, all altcoin projects will eventually merge their blockchains with Bitcoin through automated cross-chain integration"] },
    { q: "What does the 'blockchain not Bitcoin' argument misunderstand?", a: "The blockchain is only valuable because of Bitcoin's decentralized consensus — without it, a blockchain is just an inefficient database", w: ["Blockchains are always superior to regular databases", "The argument correctly identifies blockchain as the real innovation", "Bitcoin and blockchain are completely unrelated technologies", "All blockchains are equally decentralized"] },

    // === PHILOSOPHY & TIME PREFERENCE ===
    { q: "How does a savings-oriented culture (low time preference) benefit civilization?", a: "It incentivizes long-term thinking, capital accumulation, investment in the future, and intergenerational wealth building", w: ["Low time preference encourages immediate spending", "Savings-oriented cultures experience faster inflation", "Long-term thinking has no benefit over short-term thinking", "Saving money harms economic growth in all cases"] },
    { q: "What is the relationship between hard money and artistic/cultural flourishing?", a: "Sound money incentivizes long-term creation and patronage, as the value of savings is preserved over time", w: ["Hard money has no effect on culture or art", "Inflationary money produces better art through urgency", "Art can only flourish under government-issued currency", "Cultural achievements require money printing to fund them"] },
    { q: "Why do Bitcoiners reference the fall of the Roman Empire as a cautionary tale?", a: "Rome debased its currency to fund military expansion, leading to economic collapse — a pattern repeated by modern governments", w: ["The Roman Empire collapsed primarily because it didn't have access to a hard digital currency like Bitcoin to maintain its economic stability and trade", "Rome's decline was caused by the systematic debasement of its military forces through poor training, not by any changes to its monetary system", "The Roman Empire ultimately ended because of a catastrophic natural disaster that destroyed its capital and disrupted all trade routes permanently", "There is absolutely no meaningful historical connection between the monetary policies of ancient Rome and the economic challenges facing modern governments"] },
    { q: "How does proof-of-work mirror the physical world's concept of value?", a: "Just as physical value requires energy to create, Bitcoin requires energy expenditure to produce, anchoring digital value to real-world cost", w: ["There is no connection between energy and value", "Digital value should be free to create without cost", "Proof-of-work wastes energy without creating value", "Physical world concepts don't apply to digital systems"] },

    // === HALVING & SUPPLY ===
    { q: "Why is each Bitcoin halving economically significant?", a: "It reduces new supply entering the market while demand typically grows, creating supply shock pressure", w: ["Each halving event doubles the total circulating supply of Bitcoin by releasing additional coins from a reserve pool held by the protocol for this purpose", "Historical data clearly shows that halvings have never had any measurable effect on Bitcoin's market dynamics, price action, or investor sentiment", "During each halving event, the block reward given to miners is doubled as an incentive to continue securing the network despite increasing difficulty", "Halving events are purely a technical detail that only matters for mining operations and has absolutely no impact on the value held by Bitcoin investors"] },
    { q: "How does Bitcoin's disinflationary schedule mimic natural resource extraction?", a: "Easy coins are mined first, then it becomes progressively harder and more expensive, similar to mining gold or oil", w: ["Bitcoin's supply schedule is random and unpredictable", "All Bitcoin were created at once when the network launched", "Mining difficulty stays constant over time", "Bitcoin mining gets easier and cheaper each year"] },

    // === NODES & VERIFICATION ===
    { q: "Why is running your own node considered a fundamental Bitcoin practice?", a: "It allows you to independently verify all transactions and consensus rules without trusting anyone", w: ["Running a Bitcoin full node earns you a steady stream of Bitcoin rewards similar to staking in proof-of-stake networks as compensation for bandwidth", "Only users who operate their own full node are technically able to send Bitcoin transactions because the network requires direct node-to-node communication", "Full nodes are exclusively needed by professional mining operations and serve no practical purpose for regular Bitcoin users or holders", "Running a full node grants you formal voting rights that allow you to directly influence and decide on all future Bitcoin protocol changes and upgrades"] },
    { q: "What does 'Don't trust, verify' mean in practice?", a: "Run your own node and verify that your Bitcoin actually exists and follows the rules, rather than trusting a third party", w: ["Never trust anyone in life, only verify their identity", "Trust is more important than verification in Bitcoin", "Verification is only done by Bitcoin exchanges", "This phrase only applies to confirming transaction fees"] },

    // === SCALABILITY ===
    { q: "Why did the Bitcoin community reject increasing the base block size as a scaling solution?", a: "It would compromise decentralization by making it expensive for ordinary users to run full nodes", w: ["Larger blocks were technically impossible to implement", "The community unanimously wanted larger blocks but Satoshi said no", "Increasing block size has no effect on scalability", "Block size increases were approved but the code was lost"] },
    { q: "How does Bitcoin's layered scaling approach mirror the internet's design?", a: "Like TCP/IP provides a secure base layer with HTTP/HTTPS on top, Bitcoin's base layer settles value while upper layers handle speed and functionality", w: ["Bitcoin doesn't use layers like the internet does", "The internet has only one layer like Bitcoin should", "Layers weaken the underlying protocol's security", "The internet was designed to be a single monolithic system"] },

    // === PSYCHOLOGY & ORANGE-PILLING ===
    { q: "Why do Bitcoiners say 'the price is the least interesting thing about Bitcoin'?", a: "Bitcoin's underlying technology, philosophy, and monetary properties are transformative regardless of short-term price movements", w: ["Bitcoin's price essentially never changes once you factor out short-term market noise, so discussing it provides no useful information to new users", "No one in the Bitcoin community actually cares about making money or increasing their wealth because the movement is purely ideological in nature", "Bitcoin's market price is ultimately set and controlled by government regulators who establish acceptable trading ranges for each fiscal quarter", "Bitcoin was designed and launched as a non-profit charity project rather than an investment vehicle, so price appreciation was never an intended outcome"] },
    { q: "What does it mean when Bitcoiners say 'every bitcoiner buys at the price they deserve'?", a: "People adopt Bitcoin when they've done enough research to understand it — delaying study delays adoption at lower prices", w: ["Wealthy individuals and institutions have access to exclusive over-the-counter markets where they can purchase Bitcoin at significantly lower prices than retail", "Bitcoin's protocol uses a dynamic pricing algorithm that calculates a personalized price for each individual buyer based on their wallet history", "Bitcoin miners set unique individual prices for each customer based on their mining pool's current profitability metrics and network congestion levels", "Government financial authorities assign specific Bitcoin purchase prices to individual citizens based on their income level and financial merit score"] },

    // === CENSORSHIP RESISTANCE ===
    { q: "What makes Bitcoin truly censorship-resistant compared to traditional payment systems?", a: "No single entity can prevent a valid transaction from being included in a block — miners compete to include any fee-paying transaction", w: ["Banks can reverse Bitcoin transactions when ordered by courts", "Bitcoin has a content moderation team that reviews transactions", "Only approved merchants can receive Bitcoin payments", "Government firewalls effectively prevent all Bitcoin transactions"] },
    { q: "How does Bitcoin protect against financial deplatforming?", a: "Self-custodied Bitcoin cannot be frozen, seized, or restricted by any institution regardless of political pressure", w: ["Bitcoin accounts can be frozen by contacting Bitcoin support", "Financial deplatforming is not a real problem that exists", "Banks can always access Bitcoin wallets through legal requests", "Bitcoin provides no protection against account restrictions"] },

    // === BITCOIN VS TRADITIONAL FINANCE ===
    { q: "Why is a 3% credit card fee more significant than most people realize?", a: "It's an invisible tax on the entire economy that disproportionately impacts small businesses and gets passed to consumers through higher prices", w: ["A 3% processing fee is far too small a percentage to have any meaningful or measurable economic impact on businesses or the broader consumer economy", "Credit card processing fees exclusively affect the credit card companies themselves and are fully absorbed without any cost being transferred to merchants", "Merchants universally absorb credit card processing fees as a cost of doing business and never pass these additional charges along to their customers", "Bitcoin on-chain transactions consistently cost significantly more than 3% of the transaction value, making them more expensive than credit card payments"] },
    { q: "How does Bitcoin's settlement finality differ from traditional banking?", a: "Bitcoin transactions are truly final and irreversible after sufficient confirmations, unlike bank transfers which can be reversed for months", w: ["Bank transfers are more final than Bitcoin transactions", "Bitcoin transactions can be reversed within 30 days", "Both systems have identical settlement finality", "Settlement finality is irrelevant in modern finance"] },
    { q: "Why do Bitcoiners say 'fiat currency is the real Ponzi scheme'?", a: "Fiat requires perpetual growth and new debt to service existing debt, while early holders' purchasing power is continuously diluted", w: ["Fiat currency is backed by tangible assets, unlike Bitcoin", "The comparison is entirely baseless and illogical", "Ponzi scheme is a compliment in financial terminology", "Only Bitcoin meets the definition of a Ponzi scheme"] },

    // === DIFFICULTY ADJUSTMENT ===
    { q: "Why is the difficulty adjustment considered one of Bitcoin's most elegant features?", a: "It automatically balances mining profitability and block production speed regardless of computing power changes, ensuring network stability", w: ["It makes mining progressively easier so anyone can participate", "It eliminates the need for miners entirely", "It was added after Bitcoin launched as an emergency fix", "It only activates during network emergencies"] },
    { q: "What would happen to Bitcoin if a large percentage of miners suddenly stopped mining?", a: "Block times would temporarily slow, then the difficulty adjustment would reduce difficulty to restore the target 10-minute block time", w: ["If a large percentage of miners suddenly stopped mining, Bitcoin would permanently cease to function because the network requires continuous mining to operate", "Transactions would become completely and permanently impossible because the network has no mechanism to recover from a significant loss of mining power", "The Bitcoin protocol includes an emergency failsafe that automatically switches the network from proof-of-work to proof-of-stake if mining power drops sharply", "Absolutely nothing would change about network performance because Bitcoin's mining difficulty is permanently fixed and does not adjust to hash rate changes"] },

    // === TAPROOT & UPGRADES ===
    { q: "How are Bitcoin protocol upgrades different from software updates at a company?", a: "Upgrades require broad consensus from the decentralized community and cannot be forced by any individual or group", w: ["Bitcoin Core developers push updates automatically to all nodes", "Satoshi still controls all updates from a secret location", "The US government approves all Bitcoin upgrades", "Updates are released monthly on a fixed schedule"] },
    { q: "Why is backward compatibility critical for Bitcoin upgrades?", a: "It ensures that non-upgraded nodes can still function and validate transactions, preventing network splits", w: ["Backward compatibility is not important for decentralized systems", "Old nodes are automatically shut down during upgrades", "Bitcoin has never maintained backward compatibility", "Backward compatibility only matters for hardware wallets"] },

    // === VOLATILITY ===
    { q: "Why do Bitcoiners argue that Bitcoin's volatility will decrease over time?", a: "As adoption grows and market capitalization increases, Bitcoin will absorb price shocks more easily, similar to how gold's volatility decreased over centuries", w: ["Volatility always increases for scarce assets", "Bitcoin is designed to become more volatile over time", "Volatility has nothing to do with market size or adoption", "Government regulations will force stable Bitcoin prices"] },
    { q: "How should Bitcoin's volatility be contextualized for new users?", a: "Short-term volatility is the price of long-term appreciation — Bitcoin has outperformed every other asset class over any 4+ year period", w: ["Significant price volatility is a clear and reliable indicator that Bitcoin is fundamentally a scam because legitimate financial assets maintain stable values", "Bitcoin should ideally trade within a narrow 1% price range at all times, and any deviation beyond this indicates serious structural problems with the network", "Price volatility exclusively affects people who are selling Bitcoin and has absolutely no impact whatsoever on buyers or long-term holders of the asset", "An asset's long-term performance track record is completely irrelevant to evaluating its quality if it experiences significant short-term price fluctuations"] },

    // === FUNGIBILITY & PRIVACY ===
    { q: "Why is fungibility important for money?", a: "Every unit must be interchangeable with any other unit — if some coins are 'tainted', it undermines the currency's usability as money", w: ["Fungibility means money can be converted to mushrooms", "Money does not need to be fungible to function properly", "Fungibility only matters for physical commodities", "Bitcoin is perfectly fungible with no privacy concerns"] },
    { q: "How do CoinJoin transactions improve Bitcoin's fungibility?", a: "They mix multiple users' transactions together, making it difficult to trace the origin and destination of specific coins", w: ["CoinJoin creates new Bitcoin during the mixing process", "CoinJoin is a method to increase transaction fees", "CoinJoin transactions are illegal in all countries", "CoinJoin sends coins to a centralized mixing service"] },

    // === CONSENSUS & GOVERNANCE ===
    { q: "Why is 'rough consensus' better than voting for Bitcoin governance?", a: "Voting can be gamed by wealthy entities, while rough consensus requires such overwhelming agreement that controversial changes are nearly impossible", w: ["Voting is more democratic and always produces better outcomes", "Rough consensus means only one person needs to agree", "Bitcoin uses formal parliamentary voting procedures", "Governance has no impact on Bitcoin's development"] },
    { q: "What does the UASF (User Activated Soft Fork) demonstrate about Bitcoin's power structure?", a: "Users and node operators — not miners — ultimately control Bitcoin's rules, as demonstrated during the Segwit activation", w: ["Miners have absolute and unchallenged control over all Bitcoin protocol rules because their computational power gives them final authority over all network decisions", "The UASF campaign was ultimately a failure that conclusively proved ordinary users and node operators have no real power over Bitcoin's protocol rules", "UASF stands for Ultra-Advanced Silicon Fabrication and refers to a specialized type of next-generation mining hardware designed for maximum hash rate efficiency", "Only cryptocurrency exchanges have the technical capability and market authority required to activate soft fork upgrades on the Bitcoin network infrastructure"] },

    // === MISCELLANEOUS DEEP UNDERSTANDING ===
    { q: "What is the most accurate way to describe what Bitcoin is?", a: "A decentralized, permissionless, censorship-resistant monetary network secured by proof-of-work", w: ["A technology company headquartered in San Francisco that sells digital currency products and manages the blockchain infrastructure on behalf of all users", "A financial website and trading platform where users can buy, sell, and trade stocks, cryptocurrencies, and other digital assets in real time", "A government-issued digital alternative to the US dollar that was created by the Federal Reserve to modernize the American payment infrastructure", "A mobile application created by a well-funded Silicon Valley startup that provides cryptocurrency wallet and payment services to retail consumers"] },
    { q: "Why do Bitcoiners say '1 BTC = 1 BTC'?", a: "To emphasize that Bitcoin's value should be measured by its properties and utility, not its fiat exchange rate", w: ["It's a mathematical equation proving Bitcoin has no value", "It means one Bitcoin can never change in dollar value", "It's confirming that Bitcoin cannot be divided", "It means you can only own exactly one Bitcoin"] },
    { q: "Why might hyperbitcoinization be considered inevitable?", a: "Bitcoin's superior monetary properties, network effects, and game theory incentivize rational adoption by all economic actors over time", w: ["An international law passed by the United Nations will eventually mandate global Bitcoin adoption as the sole legal tender in all participating member nations", "Satoshi Nakamoto personally owns enough Bitcoin to manipulate the market and economically force worldwide adoption by strategically selling holdings", "All existing fiat currencies around the world will be simultaneously destroyed by a single catastrophic economic event that leaves Bitcoin as the only option", "Bitcoin will ultimately become the mandatory global currency through military conquest by nation-states that have accumulated the largest Bitcoin reserves"] },
    { q: "What does 'stacking sats' represent philosophically?", a: "The practice of consistent, disciplined accumulation of the hardest money ever created, regardless of price", w: ["The practice of stacking physical commemorative Bitcoin coins in a decorative tower formation as a visual representation of your cryptocurrency holdings", "A competitive online game within the Bitcoin community where participants race to see who can purchase the most Bitcoin in the shortest amount of time", "A method of organizing and categorizing Bitcoin exchanges and trading platforms in alphabetical order to create a comprehensive industry reference directory", "A network monitoring practice that involves precisely counting the exact number of satoshis currently in existence across all wallets on the blockchain"] },
    { q: "Why is it said that 'Bitcoin is hope'?", a: "It provides an opt-out from a financial system that devalues savings and labor, offering a path to financial sovereignty for everyone", w: ["The phrase refers to the visual similarity between Bitcoin's orange logo and a rainbow, which has traditionally been a universal symbol of hope and promise", "Bitcoin Is Hope is specifically the name of a well-known Bitcoin charity organization that provides financial education and services to developing nations", "Hope is the pseudonymous name of Bitcoin's current lead developer who took over maintenance of the project after Satoshi Nakamoto's departure in 2011", "The phrase means that Bitcoin always goes up in price without any exception or correction, guaranteeing profits for every person who purchases it"] },

    // === ADDITIONAL DEEP QUESTIONS ===
    { q: "What makes Bitcoin's issuance schedule 'fair'?", a: "There was no premine, ICO, or insider allocation — anyone could mine from the first block under the same rules", w: ["Satoshi received 50% of all Bitcoin before launch", "The government verified Bitcoin's fair distribution", "Venture capitalists funded the fair distribution program", "A committee allocated coins to deserving applicants"] },
    { q: "Why do Bitcoiners compare the fiat system to a game of musical chairs?", a: "When money is printed, earlier receivers benefit while later receivers get diluted purchasing power — someone is always left holding devalued currency", w: ["The comparison exists because investment bankers at major financial institutions literally play musical chairs as a team-building exercise during corporate retreats", "Fiat currency physically moves in predictable circular patterns through the economy, flowing from consumers to businesses and back again in a closed loop", "The comparison arose because fiat money has historically been the primary currency used within the global entertainment industry for paying performers", "The Federal Reserve and other central banks use a musical chairs-style rotation system to determine which committee members make monetary policy decisions"] },
    { q: "What is the significance of the phrase 'exit and build' in Bitcoin culture?", a: "Rather than fighting the existing financial system, Bitcoin allows people to opt out and build a parallel, superior alternative", w: ["It refers to exiting Bitcoin positions during bear markets", "It's the name of a Bitcoin mining company", "It describes the process of closing a Bitcoin exchange", "It means deleting your Bitcoin wallet and starting over"] },
    { q: "Why is verifiable scarcity more important than just scarcity?", a: "Anyone can independently verify Bitcoin's supply using a node, while other 'scarce' assets require trusting third-party claims", w: ["The ability to verify scarcity has no practical importance for monetary assets because market prices already reflect all available information about supply limitations", "All scarce assets including gold, diamonds, real estate, and Bitcoin are equally and trivially verifiable through standard auditing processes and certification", "Only government agencies and their authorized representatives have the legal authority and technical capability to verify the true scarcity of any asset class", "Scarcity by itself is always completely sufficient for establishing monetary value, and independent verification provides no additional benefit or confidence"] },
    { q: "How does Bitcoin align incentives between savers and the monetary system?", a: "Bitcoin rewards savers with increasing purchasing power instead of punishing them with inflation as fiat systems do", w: ["Bitcoin punishes savers with transaction fees", "There is no relationship between Bitcoin and saving behavior", "Inflation is necessary and beneficial for all savers", "Bitcoin automatically spends your savings to prevent hoarding"] },
    { q: "What does 'number go up technology' refer to beyond just price?", a: "Bitcoin's fundamental properties — fixed supply, growing demand, halvings — create a structural trend toward value appreciation", w: ["A guaranteed financial scheme built into Bitcoin's code that ensures every participant becomes wealthy quickly through algorithmic price appreciation mechanisms", "A sophisticated hidden algorithm embedded in Bitcoin's protocol that artificially inflates the market price by creating synthetic demand from automated trading bots", "A classified government subsidy program that provides financial support to Bitcoin holders through tax credits and direct payments funded by central bank reserves", "An organized price manipulation scheme operated by coordinated Bitcoin whale cartels who collude to artificially drive up prices for their collective benefit"] },
    { q: "Why is understanding Bitcoin described as a 'one way door'?", a: "Once you truly understand Bitcoin's properties and the problems it solves, you cannot unsee the flaws in the existing monetary system", w: ["Bitcoin literally prevents users from selling their coins", "The Bitcoin software locks users out of traditional banking", "It refers to a door in Bitcoin's headquarters", "Bitcoin uses irreversible encryption that traps your money"] },
    { q: "What makes Bitcoin 'antifragile'?", a: "Each attack, ban, or crisis it survives makes the network stronger and more resilient", w: ["Bitcoin's network breaks down easily during periods of high stress but has a dedicated rapid response team that quickly repairs any damage and restores operations", "Bitcoin is inherently fragile and vulnerable to disruption but is protected by comprehensive insurance policies underwritten by major global reinsurance companies", "The concept of antifragility specifically means that a system never changes, adapts, or evolves in response to external conditions, maintaining permanent stability", "The term antifragile is a literary concept from philosophy that has no meaningful or practical application to technology systems like the Bitcoin network"] },
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

    // Fisher-Yates shuffle for unbiased randomization
    function fisherYates(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // Pick 25 random questions
    const shuffled = fisherYates([...SCHOLAR_POOL]);
    scholarQuestions = shuffled.slice(0, 25).map(q => {
        const options = fisherYates([q.a, ...q.w]);
        return { q: q.q, options, answer: options.indexOf(q.a) };
    });
    scholarAnswers = new Array(25).fill(-1);
    scholarTimeLeft = 600;

    if (typeof playWarriorDrum === 'function') playWarriorDrum();
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

    // Highlight correct/wrong answers on all questions
    const questions = inner.querySelectorAll('.quest-q');
    questions.forEach((q, i) => {
        const opts = q.querySelectorAll('.quest-opt');
        opts.forEach((opt, j) => {
            opt.disabled = true;
            if (j === scholarQuestions[i].answer) opt.classList.add('correct');
            if (j === scholarAnswers[i] && j !== scholarQuestions[i].answer) opt.classList.add('wrong');
        });
    });

    // Hide submit button, show review screen
    const submitBtn = document.getElementById('scholarSubmitBtn');
    if (submitBtn) submitBtn.style.display = 'none';
    const timerEl = document.getElementById('scholarTimer');
    if (timerEl) timerEl.style.display = 'none';

    // Store results for final screen
    window._scholarScore = score;
    window._scholarPassed = passed;

    // Add review header and "See Results" button at the top
    const reviewBanner = document.createElement('div');
    reviewBanner.style.cssText = 'text-align:center;padding:20px;margin-bottom:16px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;';
    reviewBanner.innerHTML = '<div style="font-size:2rem;margin-bottom:8px;">' + (passed ? '🎓' : '📝') + '</div>' +
        '<div style="font-size:1.4rem;font-weight:900;color:var(--heading);margin-bottom:4px;">' + score + ' / 25 Correct</div>' +
        '<div style="font-size:0.9rem;color:var(--text-muted);margin-bottom:12px;">Review your answers — <span style="color:#22c55e;font-weight:700;">green</span> is correct, <span style="color:#ef4444;font-weight:700;">red</span> is wrong</div>' +
        '<button onclick="showScholarFinalResults()" style="padding:12px 28px;background:linear-gradient(135deg,#f7931a,#ea580c);color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;">See Results →</button>';
    inner.insertBefore(reviewBanner, inner.firstChild);
    inner.scrollTop = 0;
    return;
}

async function showScholarFinalResults() {
    const score = window._scholarScore;
    const passed = window._scholarPassed;
    const today = new Date().toISOString().split('T')[0];
    const modal = document.getElementById('questModal');
    const inner = document.getElementById('questInner');

    if (passed) {
        if (typeof playHooraySound === 'function') playHooraySound();
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
            await awardPoints(2100, '🎓 Bitcoin Scholar Certification');
        }

        // Confetti!
        if (typeof launchConfetti === 'function') launchConfetti();
        if (typeof playBadgeSound === 'function') playBadgeSound();

        inner.innerHTML = '<div style="text-align:center;padding:30px;">' +
            '<div style="font-size:4rem;margin-bottom:16px;">🎓</div>' +
            '<div style="color:#22c55e;font-size:0.8rem;text-transform:uppercase;letter-spacing:2px;font-weight:800;">Congratulations!</div>' +
            '<h2 style="color:var(--heading);margin:8px 0 16px;">Bitcoin Scholar Certified</h2>' +
            '<div style="font-size:1.3rem;font-weight:800;color:var(--accent);">' + score + ' / 25 Correct</div>' +
            '<div style="color:var(--accent);font-size:1.2rem;font-weight:800;margin:8px 0 4px;">+2,100 points earned! 🎉</div>' +
            '<div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:20px;">The magic number — 21 million in sats!</div>' +
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
