// © 2024-2026 603BTC LLC. All rights reserved.
// This code is proprietary. See LICENSE file. Do not copy or redistribute.
// =============================================
// Bitcoin Education Archive - Dynamic Quest System
// Questions based on channels the user has visited
// =============================================

// Question bank mapped to channel IDs
const QUESTION_BANK = {
    // Properties Layer 1
    'whitepaper': [
        { q: 'When was the Bitcoin Whitepaper published?', a: 'October 31, 2008', wrong: ['January 3, 2009', 'March 15, 2007', 'December 25, 2010'] },
        { q: 'How many pages of text is the Bitcoin Whitepaper?', a: '8 pages', wrong: ['20 pages', '50 pages', '2 pages'] },
        { q: 'The Whitepaper was published on:', a: 'A cryptography mailing list', wrong: ['Twitter', 'A Bitcoin forum', 'The New York Times'] },
        { q: 'What is the title of the Bitcoin Whitepaper?', a: 'Bitcoin: A Peer-to-Peer Electronic Cash System', wrong: ['Digital Gold: The Future', 'How to Mine Cryptocurrency', 'The Blockchain Revolution'] },
        { q: 'The Whitepaper proposed a solution to:', a: 'The double-spending problem', wrong: ['Climate change', 'Internet speed', 'Social media addiction'] },
        { q: 'Who is credited as the author of the Whitepaper?', a: 'Satoshi Nakamoto', wrong: ['Vitalik Buterin', 'Elon Musk', 'Hal Finney'] },
        { q: 'The Whitepaper describes Bitcoin as:', a: 'A peer-to-peer electronic cash system', wrong: ['A stock trading platform', 'A social network', 'A video game currency'] },
        { q: 'What concept does the Whitepaper use to timestamp transactions?', a: 'A chain of hashed blocks', wrong: ['A central database', 'Email timestamps', 'GPS coordinates'] },
    ],
    'decentralized': [
        { q: 'How many people are "in charge" of Bitcoin?', a: 'No one', wrong: ['Satoshi Nakamoto', 'A board of directors', 'The Bitcoin Foundation'] },
        { q: 'What is needed for code updates to Bitcoin?', a: 'Deep consensus from the network', wrong: ['A CEO decision', 'A government vote', 'Permission from miners only'] },
        { q: 'Bitcoin is described as:', a: 'A protocol, not a company', wrong: ['A company based in Japan', 'A government project', 'A bank product'] },
        { q: 'Bitcoin nodes are run by:', a: 'Anyone who wants to, worldwide', wrong: ['Only by miners', 'Only in the United States', 'Only by approved operators'] },
        { q: 'If one country shuts down all Bitcoin mining:', a: 'The network continues in other countries', wrong: ['Bitcoin dies', 'All coins are lost', 'The price goes to zero permanently'] },
        { q: 'Bitcoin has no:', a: 'Central point of failure', wrong: ['Users', 'Transactions', 'Value'] },
        { q: 'Decentralization means:', a: 'No single entity controls the network', wrong: ['One company runs everything', 'The government manages it', 'Only banks can use it'] },
    ],
    'scarce': [
        { q: 'What is the maximum supply of Bitcoin?', a: '21 million', wrong: ['100 million', '1 billion', 'Unlimited'] },
        { q: 'How many Bitcoin are estimated to be lost forever?', a: '2-3 million', wrong: ['None', '10 million', '100,000'] },
        { q: 'Bitcoin\'s code is:', a: 'Open source and auditable by anyone', wrong: ['Private and closed', 'Only visible to developers', 'Controlled by a company'] },
        { q: 'What event cuts Bitcoin\'s new supply in half?', a: 'The halving', wrong: ['The merge', 'The split', 'The fork'] },
        { q: 'How often does the halving occur?', a: 'Approximately every 4 years', wrong: ['Every year', 'Every 10 years', 'Every month'] },
        { q: 'Bitcoin is often compared to which precious metal?', a: 'Gold', wrong: ['Silver', 'Platinum', 'Copper'] },
        { q: 'The last Bitcoin will be mined around the year:', a: '2140', wrong: ['2030', '2050', '2025'] },
        { q: 'Bitcoin scarcity is enforced by:', a: 'Math and code', wrong: ['Government regulations', 'A central bank', 'Mining companies'] },
    ],
    'secure': [
        { q: 'Bitcoin has been under attack since gaining significant value around:', a: '2013', wrong: ['2020', '2009', '2017'] },
        { q: 'How many potential Bitcoin wallets exist?', a: '2^160', wrong: ['21 million', 'A few billion', '2^16'] },
        { q: 'Bitcoin\'s monetary policy is:', a: 'Set in stone and immutable', wrong: ['Changed annually', 'Decided by miners', 'Flexible based on market'] },
        { q: 'A 51% attack would require:', a: 'More computing power than the rest of the network combined', wrong: ['A password', 'Government approval', 'Hacking one computer'] },
        { q: 'Bitcoin has experienced how many hours of downtime since 2013?', a: 'Zero', wrong: ['Hundreds', 'A few days each year', 'One week'] },
        { q: 'Bitcoin uses which hashing algorithm?', a: 'SHA-256', wrong: ['MD5', 'RSA', 'AES'] },
        { q: 'The cost to attack Bitcoin\'s network is:', a: 'Billions of dollars', wrong: ['A few hundred dollars', 'Free', 'A few thousand dollars'] },
    ],
    'money': [
        { q: 'How many satoshis are in one Bitcoin?', a: '100,000,000', wrong: ['1,000,000', '1,000', '10,000'] },
        { q: 'Bitcoin payments are compared to:', a: 'Email — anyone with your address can send', wrong: ['Fax machines', 'Phone calls', 'Physical mail'] },
        { q: 'Bitcoin\'s distribution was fair because:', a: 'There was no premine', wrong: ['A company sold coins early', 'The government distributed it', 'Only miners got coins'] },
        { q: 'A satoshi is named after:', a: 'Bitcoin\'s creator, Satoshi Nakamoto', wrong: ['A Japanese emperor', 'A type of sushi', 'A programming language'] },
        { q: 'Bitcoin is divisible to how many decimal places?', a: '8', wrong: ['2', '4', '16'] },
        { q: 'Bitcoin can function as:', a: 'A store of value, medium of exchange, and unit of account', wrong: ['Only a store of value', 'Only for payments', 'Only for speculation'] },
        { q: 'What makes Bitcoin "sound money"?', a: 'Fixed supply and predictable issuance', wrong: ['Government backing', 'Bank guarantees', 'Corporate ownership'] },
    ],
    'peaceful': [
        { q: 'When China banned Bitcoin:', a: 'Bitcoin just moved and kept going', wrong: ['Bitcoin shut down', 'The price went to zero', 'The code was deleted'] },
        { q: 'Bitcoin is described as:', a: 'Permissionless and borderless', wrong: ['Government-regulated', 'Country-specific', 'Requiring a bank account'] },
        { q: 'Bitcoin enables protest by:', a: 'Allowing people to transact without government permission', wrong: ['Sending angry emails', 'Blocking websites', 'Hacking banks'] },
        { q: 'Bitcoin is called "peaceful" because:', a: 'It opts out of the existing system without force', wrong: ['It prevents all crime', 'It eliminates wars', 'It makes everyone rich'] },
        { q: 'Bitcoin helps people in authoritarian regimes by:', a: 'Providing censorship-resistant money', wrong: ['Overthrowing governments', 'Hacking military systems', 'Printing local currency'] },
        { q: 'Bitcoin adoption is described as:', a: 'Voluntary and organic', wrong: ['Mandatory and forced', 'Government-mandated', 'Corporate-controlled'] },
    ],
    'dominant': [
        { q: '∞/21M means:', a: 'All world wealth funneling into 21 million coins', wrong: ['Bitcoin is infinite', 'There are infinite users', '21 million blockchains'] },
        { q: 'Bitcoin\'s growth pattern resembles:', a: 'A J-shaped curve', wrong: ['A straight line', 'A bell curve', 'A flat line'] },
        { q: 'Bitcoin is said to change you by:', a: 'Lowering your time preference', wrong: ['Making you rich instantly', 'Increasing spending', 'Nothing changes'] },
        { q: 'Bitcoin\'s market dominance refers to:', a: 'Its share of total cryptocurrency market cap', wrong: ['How many users it has', 'Its mining speed', 'Its block size'] },
        { q: 'The Lindy Effect suggests Bitcoin:', a: 'Will last longer the longer it survives', wrong: ['Will die soon', 'Is a fad', 'Needs government support'] },
        { q: 'Bitcoin is considered dominant because:', a: 'It has the strongest network effect and security', wrong: ['It was the cheapest', 'A government chose it', 'It has the most features'] },
    ],
    'use-cases': [
        { q: 'Bitcoin is described as better than gold because:', a: 'It can be sent across the planet instantly', wrong: ['It\'s heavier', 'It\'s shinier', 'It\'s backed by gold'] },
        { q: 'How do Bitcoin remittance fees compare to Western Union?', a: 'Much cheaper, nearly free', wrong: ['About the same', 'More expensive', 'Double the cost'] },
        { q: 'Credit card merchants pay about what fee?', a: '3%', wrong: ['0%', '10%', '25%'] },
        { q: 'Bitcoin can help the unbanked because:', a: 'You only need a phone and internet to use it', wrong: ['Banks distribute it', 'The government gives it away', 'You need a credit score'] },
        { q: 'Bitcoin as a hedge against inflation means:', a: 'Its fixed supply protects purchasing power', wrong: ['It always goes up', 'The government guarantees its value', 'It pays interest'] },
        { q: 'Micropayments on Bitcoin are possible through:', a: 'The Lightning Network', wrong: ['Visa', 'PayPal', 'Wire transfer'] },
        { q: 'Bitcoin enables financial sovereignty by:', a: 'Letting you be your own bank', wrong: ['Requiring a bank account', 'Needing government ID', 'Using credit scores'] },
    ],

    // Experienced Topics
    'mining': [
        { q: 'What do miners do?', a: 'Secure the network and process transactions', wrong: ['Create Bitcoin from nothing', 'Print digital money', 'Delete old transactions'] },
        { q: 'Miners are paid in:', a: 'New Bitcoin and transaction fees', wrong: ['US dollars', 'Ethereum', 'Company stock'] },
        { q: 'Mining difficulty adjusts approximately every:', a: '2 weeks (2016 blocks)', wrong: ['Every day', 'Every hour', 'Never'] },
        { q: 'A mining pool is:', a: 'A group of miners combining computing power', wrong: ['A swimming pool for tech workers', 'A single powerful computer', 'A government facility'] },
        { q: 'The mining reward after the 2024 halving is:', a: '3.125 BTC per block', wrong: ['6.25 BTC', '50 BTC', '12.5 BTC'] },
        { q: 'ASIC miners are:', a: 'Specialized hardware designed only for mining', wrong: ['Regular laptops', 'Gaming consoles', 'Smart phones'] },
        { q: 'What prevents miners from cheating?', a: 'Other nodes verify their work', wrong: ['The honor system', 'Government oversight', 'Nothing'] },
    ],
    'nodes': [
        { q: 'Running a node lets you:', a: 'Verify transactions independently', wrong: ['Mine Bitcoin', 'Print money', 'Control the network'] },
        { q: '"Don\'t trust, verify" means:', a: 'Run your own node to check the truth', wrong: ['Trust your bank', 'Believe what others say', 'Ignore Bitcoin'] },
        { q: 'A full node stores:', a: 'The entire blockchain history', wrong: ['Only your transactions', 'Just the latest block', 'Nothing'] },
        { q: 'How many Bitcoin nodes exist approximately?', a: 'Tens of thousands worldwide', wrong: ['Only 5', 'Exactly 21 million', 'One per country'] },
        { q: 'Running a node requires:', a: 'A regular computer with enough storage', wrong: ['A supercomputer', 'Government permission', 'A mining rig'] },
        { q: 'Nodes enforce:', a: 'The consensus rules of Bitcoin', wrong: ['Government laws', 'Company policies', 'Social media rules'] },
    ],
    'pow-vs-pos': [
        { q: 'Bitcoin uses which consensus mechanism?', a: 'Proof of Work', wrong: ['Proof of Stake', 'Proof of Authority', 'Proof of Space'] },
        { q: 'In Proof of Work, security comes from:', a: 'Computational work and electricity', wrong: ['Staking coins', 'Voting', 'Government approval'] },
        { q: 'Proof of Stake has been criticized for:', a: 'Favoring wealthy holders (the rich get richer)', wrong: ['Using too much energy', 'Being too decentralized', 'Being too slow'] },
        { q: 'Proof of Work connects Bitcoin to:', a: 'The physical world through energy expenditure', wrong: ['The stock market', 'Social media', 'Government databases'] },
        { q: 'In PoW, you can\'t fake:', a: 'The energy spent to mine a block', wrong: ['Your username', 'Your IP address', 'The current time'] },
        { q: 'Proof of Work was chosen because:', a: 'It provides unforgeable costliness', wrong: ['It was the cheapest option', 'Satoshi had no other ideas', 'The government required it'] },
    ],
    'layer-2-lightning': [
        { q: 'Lightning is which layer of Bitcoin?', a: 'Layer 2', wrong: ['Layer 1', 'Layer 3', 'Layer 0'] },
        { q: 'Lightning uses what for privacy?', a: 'Onion routing', wrong: ['GPS tracking', 'Public ledger', 'Email verification'] },
        { q: 'Opening a Lightning channel is like:', a: 'Opening a bar tab', wrong: ['Buying a car', 'Getting a loan', 'Opening a bank account'] },
        { q: 'Lightning transactions are:', a: 'Nearly instant and very cheap', wrong: ['Slow and expensive', 'Free but take hours', 'Only for large amounts'] },
        { q: 'Lightning channels are settled on:', a: 'The Bitcoin base layer', wrong: ['Ethereum', 'A separate blockchain', 'A bank ledger'] },
        { q: 'Lightning enables:', a: 'Micropayments as small as 1 satoshi', wrong: ['Only large transactions', 'Only fiat payments', 'Only international transfers'] },
        { q: 'Lightning capacity refers to:', a: 'The total Bitcoin locked in payment channels', wrong: ['Internet bandwidth', 'Mining power', 'Number of nodes'] },
    ],
    'self-custody': [
        { q: '"Not your keys, not your..."', a: 'Bitcoin', wrong: ['Wallet', 'Password', 'Account'] },
        { q: 'The most secure long-term storage is:', a: 'Hardware wallet', wrong: ['Exchange account', 'Phone app', 'Email attachment'] },
        { q: 'A seed phrase is typically:', a: '12 or 24 words that recover your wallet', wrong: ['Your email password', 'A website URL', 'A phone number'] },
        { q: 'You should store your seed phrase:', a: 'On paper or metal in a secure location', wrong: ['In a screenshot on your phone', 'In your email drafts', 'On social media'] },
        { q: 'Multi-sig means:', a: 'Multiple keys required to authorize a transaction', wrong: ['Multiple Bitcoin addresses', 'Multiple blockchains', 'Multiple exchanges'] },
        { q: 'When an exchange holds your Bitcoin:', a: 'You have an IOU, not actual Bitcoin', wrong: ['It\'s completely safe', 'You own it fully', 'The government insures it'] },
        { q: 'Cold storage means:', a: 'Keeping keys offline, disconnected from the internet', wrong: ['Storing Bitcoin in a freezer', 'A cold climate mining facility', 'An inactive exchange account'] },
    ],
    'privacy-nonkyc': [
        { q: 'KYC stands for:', a: 'Know Your Customer', wrong: ['Keep Your Coins', 'Keys You Control', 'Knowledge Yields Crypto'] },
        { q: 'CoinJoin is used for:', a: 'Mixing transactions for privacy', wrong: ['Joining mining pools', 'Merging blockchains', 'Creating altcoins'] },
        { q: 'Non-KYC Bitcoin means:', a: 'Bitcoin acquired without identity verification', wrong: ['Stolen Bitcoin', 'Fake Bitcoin', 'Government Bitcoin'] },
        { q: 'Bitcoin\'s blockchain is:', a: 'Public — anyone can see transactions', wrong: ['Completely private', 'Only visible to miners', 'Encrypted and hidden'] },
        { q: 'Why do some people prefer non-KYC Bitcoin?', a: 'To maintain financial privacy', wrong: ['To pay lower fees', 'To mine faster', 'To get a better price'] },
        { q: 'A Bitcoin address should ideally be:', a: 'Used only once for privacy', wrong: ['Shared with everyone', 'Used for all transactions', 'Posted on social media'] },
    ],
    'problems-of-money': [
        { q: 'The Cantillon Effect describes:', a: 'Those closest to money printing benefit most', wrong: ['Bitcoin mining', 'The halving', 'Lightning fees'] },
        { q: 'Fractional reserve banking means:', a: 'Banks hold only a fraction of deposits', wrong: ['Banks hold all deposits', 'Bitcoin is fractional', 'Miners keep fractions'] },
        { q: 'Inflation is often called:', a: 'A hidden tax on savings', wrong: ['A bonus for savers', 'A mining reward', 'A blockchain feature'] },
        { q: 'Fiat currency is backed by:', a: 'Government decree and trust', wrong: ['Gold reserves', 'Bitcoin', 'Real estate'] },
        { q: 'The US dollar has lost what percentage of purchasing power since 1913?', a: 'Over 96%', wrong: ['About 10%', 'None', 'About 50%'] },
        { q: 'Money printing causes:', a: 'Devaluation of existing currency', wrong: ['Deflation', 'Higher savings rates', 'Stronger currency'] },
        { q: 'Sound money historically meant:', a: 'Money that couldn\'t be easily debased', wrong: ['Money that makes noise', 'Digital currency', 'Credit cards'] },
    ],
    'investment-strategy': [
        { q: 'DCA stands for:', a: 'Dollar Cost Averaging', wrong: ['Digital Currency Account', 'Decentralized Crypto Asset', 'Direct Coin Access'] },
        { q: 'A common Bitcoin investment strategy is:', a: 'Buy regularly and hold long-term', wrong: ['Day trade constantly', 'Sell every week', 'Only buy at the top'] },
        { q: 'HODL originated from:', a: 'A misspelled forum post saying "I AM HODLING"', wrong: ['A financial textbook', 'A government document', 'A bank term'] },
        { q: 'Bitcoin\'s 4-year cycle is often tied to:', a: 'The halving events', wrong: ['US elections', 'Solar cycles', 'Stock market seasons'] },
        { q: 'The best time to buy Bitcoin according to Bitcoiners is:', a: 'Always — time in the market beats timing the market', wrong: ['Only at all-time highs', 'Only on Mondays', 'Only in December'] },
        { q: 'Stacking sats means:', a: 'Accumulating small amounts of Bitcoin over time', wrong: ['Building satellite dishes', 'Stacking physical coins', 'Creating smart contracts'] },
    ],
    'cryptography': [
        { q: 'Bitcoin uses cryptography that has been:', a: 'Used for decades in other applications', wrong: ['Invented specifically for Bitcoin', 'Never tested before', 'Made by AI'] },
        { q: 'A private key is:', a: 'A secret number that controls your Bitcoin', wrong: ['Your email password', 'A physical key', 'Your bank PIN'] },
        { q: 'A public key is derived from:', a: 'The private key using one-way math', wrong: ['Your name', 'Random chance', 'The blockchain'] },
        { q: 'Digital signatures prove:', a: 'You own the private key without revealing it', wrong: ['Your identity', 'Your location', 'Your bank balance'] },
        { q: 'Hashing is:', a: 'Converting data into a fixed-length fingerprint', wrong: ['Deleting data', 'Encrypting emails', 'Mining Bitcoin'] },
        { q: 'Elliptic curve cryptography is used for:', a: 'Generating Bitcoin key pairs', wrong: ['Mining blocks', 'Sending emails', 'Browsing the web'] },
    ],
    'regulation': [
        { q: 'Bitcoin\'s response to bans has been:', a: 'Moving to friendlier jurisdictions', wrong: ['Shutting down', 'Complying immediately', 'Becoming illegal forever'] },
        { q: 'El Salvador made Bitcoin:', a: 'Legal tender in 2021', wrong: ['Illegal in 2020', 'A national secret', 'Only for tourists'] },
        { q: 'Bitcoin regulation varies by:', a: 'Country — each has different rules', wrong: ['There are no rules anywhere', 'One global law covers it', 'Bitcoin regulates itself'] },
        { q: 'A Bitcoin ETF allows:', a: 'Traditional investors to get Bitcoin exposure through stock markets', wrong: ['Free Bitcoin for everyone', 'Government-controlled mining', 'Printing new Bitcoin'] },
        { q: 'The SEC has classified Bitcoin as:', a: 'A commodity, not a security', wrong: ['A security', 'A currency', 'Illegal'] },
    ],
    'energy': [
        { q: 'Bitcoin mining and energy:', a: 'Promotes renewable energy and uses wasted energy', wrong: ['Only uses coal', 'Wastes all energy', 'Uses no energy'] },
        { q: 'Stranded energy refers to:', a: 'Energy produced in remote locations with no buyers', wrong: ['Electricity outages', 'Solar panels at night', 'Wind on calm days'] },
        { q: 'Bitcoin miners often locate near:', a: 'Cheap renewable energy sources', wrong: ['Shopping malls', 'Government buildings', 'Residential areas'] },
        { q: 'Bitcoin mining can help stabilize:', a: 'Electrical grids by acting as a flexible load', wrong: ['The stock market', 'Internet speeds', 'Political systems'] },
        { q: 'Compared to traditional banking, Bitcoin\'s energy use is:', a: 'Debatable but often comparable or less', wrong: ['1000x more', 'Zero', 'Exactly the same'] },
        { q: 'Methane flaring and Bitcoin mining:', a: 'Miners can capture and use flared gas productively', wrong: ['They are unrelated', 'Mining increases flaring', 'Flaring powers all mining'] },
    ],
    'core-source-code': [
        { q: 'Changes to Bitcoin Core require:', a: 'Careful testing and peer review', wrong: ['One person\'s approval', 'A company decision', 'Government permission'] },
        { q: 'Bitcoin Core is written primarily in:', a: 'C++', wrong: ['Python', 'JavaScript', 'Java'] },
        { q: 'Anyone can:', a: 'Read, review, and propose changes to Bitcoin\'s code', wrong: ['Change Bitcoin without review', 'Delete the blockchain', 'Add more coins'] },
        { q: 'A BIP is:', a: 'A Bitcoin Improvement Proposal', wrong: ['A Bitcoin Investment Plan', 'A Block Information Protocol', 'A Banking Integration Process'] },
        { q: 'Bitcoin\'s code repository is hosted on:', a: 'GitHub', wrong: ['Facebook', 'A secret server', 'The dark web'] },
    ],
    'blockchain-timechain': [
        { q: 'A new Bitcoin block is produced approximately every:', a: '10 minutes', wrong: ['1 second', '1 hour', '1 day'] },
        { q: 'Each block contains:', a: 'A list of transactions and a reference to the previous block', wrong: ['Just one transaction', 'Pictures', 'Email addresses'] },
        { q: 'The blockchain is often called:', a: 'An immutable ledger', wrong: ['A cloud server', 'A website', 'A database that can be edited'] },
        { q: 'Satoshi originally called it:', a: 'A timechain', wrong: ['A blockchain', 'A datachain', 'A coinchain'] },
        { q: 'The Genesis Block contains a message about:', a: 'A newspaper headline about bank bailouts', wrong: ['A recipe', 'A love letter', 'A stock tip'] },
        { q: 'Block height refers to:', a: 'The sequential number of a block in the chain', wrong: ['How tall a server rack is', 'The size of the block', 'Mining difficulty'] },
    ],

    // Additional Info threads
    'analogies': [
        { q: 'In the airport analogy, Lightning is like:', a: 'A bicycle courier in the terminal', wrong: ['The runway', 'A cargo plane', 'Air traffic control'] },
        { q: 'Bitcoin is often compared to:', a: 'Digital gold', wrong: ['Digital silver', 'Digital stocks', 'Digital bonds'] },
        { q: 'The Bitcoin network is sometimes compared to:', a: 'The internet protocol (TCP/IP)', wrong: ['A single website', 'A phone call', 'A TV channel'] },
        { q: 'Holding Bitcoin is compared to:', a: 'Holding property in cyberspace', wrong: ['Renting a movie', 'Subscribing to a service', 'Opening a bank account'] },
    
        { q: 'Bitcoin is often compared to digital gold because both are scarce, durable, and serve as stores of value outside government control.', a: 'Digital gold', wrong: ['Digital cash', 'Digital silver', 'Digital oil'] },
    ],
    'byzantine_generals__problem': [
        { q: 'The Byzantine Generals Problem is about:', a: 'Reaching agreement when some participants may be dishonest', wrong: ['Building castles', 'Trading gold', 'Sending emails'] },
        { q: 'Bitcoin solved the Byzantine Generals Problem using:', a: 'Proof of Work consensus', wrong: ['A voting system', 'A trusted mediator', 'Encryption alone'] },
        { q: 'In the analogy, the generals need to:', a: 'Coordinate an attack without a trusted messenger', wrong: ['Build a wall', 'Trade horses', 'Sign a peace treaty'] },
        { q: 'Before Bitcoin, the Byzantine Generals Problem was considered:', a: 'Unsolvable in a trustless digital environment', wrong: ['Easy to solve', 'Irrelevant', 'Already solved by banks'] },
    
        { q: 'The Byzantine Generals Problem asks how dispersed parties can reach consensus without trusting each other. What mechanism did Bitcoin invent to solve this?', a: 'Nakamoto Consensus (proof-of-work + longest chain)', wrong: ['Voting by validator nodes', 'Centralized coordinator server', 'Proof of stake randomization'] },
    ],
    'game_theory': [
        { q: 'Bitcoin\'s incentive structure uses:', a: 'Game theory to align participants', wrong: ['Threats of punishment', 'Legal contracts', 'Trust alone'] },
        { q: 'Miners are incentivized to be honest because:', a: 'Cheating costs more than playing by the rules', wrong: ['They sign contracts', 'The government watches them', 'There are no incentives'] },
        { q: 'Nash Equilibrium in Bitcoin means:', a: 'No participant benefits from changing their strategy alone', wrong: ['Everyone mines equally', 'Prices never change', 'All nodes are identical'] },
        { q: 'The prisoner\'s dilemma relates to Bitcoin because:', a: 'Cooperation is more profitable than defection', wrong: ['Miners are in prison', 'Bitcoin is illegal', 'Users are trapped'] },
    
        { q: 'What game theory concept explains why Bitcoin miners are incentivized to stay honest rather than attack the network?', a: 'Nash equilibrium — attacking costs more than honest mining', wrong: ['Prisoner\\\'s dilemma', 'Zero-sum game', 'Pareto inefficiency'] },
    ],
    'elevator_pitches': [
        { q: 'A good Bitcoin elevator pitch should be:', a: 'Simple and compelling in under a minute', wrong: ['A 2-hour lecture', 'Only about price', 'As technical as possible'] },
        { q: 'When explaining Bitcoin to beginners, start with:', a: 'The problem it solves (broken money)', wrong: ['Mining algorithms', 'Cryptographic proofs', 'Exchange trading'] },
        { q: 'The simplest Bitcoin pitch is often:', a: 'Digital money that no one can print or confiscate', wrong: ['A get-rich-quick scheme', 'Internet points', 'A new bank'] },
    
        { q: 'How would you explain Bitcoin to a complete newcomer in one sentence?', a: 'A digital form of money that no government or company can print, freeze, or control', wrong: ['A speculative investment to get rich quick', 'A credit card for online shopping', 'A bank account with higher interest'] },
        { q: 'What is the most important feature for Bitcoin newcomers to understand first?', a: 'Nobody can confiscate or freeze your bitcoin if you hold your own keys', wrong: ['The price will always go up', 'It\\\'s anonymous like cash', 'Transactions are free'] },
    ],
    'taproot': [
        { q: 'Taproot is a Bitcoin:', a: 'Upgrade that improves privacy and smart contracts', wrong: ['New cryptocurrency', 'Mining algorithm', 'Exchange platform'] },
        { q: 'Taproot was activated in:', a: 'November 2021', wrong: ['January 2009', 'March 2015', 'June 2023'] },
        { q: 'Taproot uses Schnorr signatures which:', a: 'Make multi-sig transactions look like regular ones', wrong: ['Speed up mining', 'Create new coins', 'Delete old blocks'] },
        { q: 'Taproot improves:', a: 'Privacy, efficiency, and smart contract capabilities', wrong: ['Mining speed only', 'Block size only', 'Transaction fees only'] },
    ],
    'scalability': [
        { q: 'Bitcoin base layer processes roughly:', a: '7 transactions per second', wrong: ['7 million per second', '1 per minute', '100,000 per second'] },
        { q: 'Bitcoin scales primarily through:', a: 'Layer 2 solutions like Lightning', wrong: ['Making blocks bigger forever', 'Removing the block limit', 'Using faster internet'] },
        { q: 'The block size limit exists to:', a: 'Keep node requirements low and maintain decentralization', wrong: ['Slow down transactions', 'Limit Bitcoin\'s value', 'Help miners make more money'] },
        { q: 'The Blocksize Wars were about:', a: 'Whether to increase block size or use Layer 2', wrong: ['Mining profitability', 'Bitcoin\'s name', 'Which exchange to use'] },
    ],
    'utxos': [
        { q: 'UTXO stands for:', a: 'Unspent Transaction Output', wrong: ['Universal Token Exchange Order', 'Unified Transaction eXecution Object', 'Ultra-fast Transfer of eXchange Operations'] },
        { q: 'A UTXO is like:', a: 'A specific bill in your wallet that you spend whole', wrong: ['A bank balance', 'A credit limit', 'An account number'] },
        { q: 'When you spend a UTXO:', a: 'It\'s consumed entirely and change is returned as a new UTXO', wrong: ['Part of it disappears', 'It stays in your wallet', 'It\'s deleted from the blockchain'] },
        { q: 'UTXO management matters for:', a: 'Privacy and minimizing future transaction fees', wrong: ['Mining speed', 'Block creation', 'Node operation'] },
    
        { q: 'What is a UTXO in Bitcoin?', a: 'Unspent Transaction Output — the amount of bitcoin remaining after a transaction', wrong: ['A type of digital signature', 'A mining reward token', 'A user transaction ID'] },
    ],
    'dust': [
        { q: 'Bitcoin "dust" is:', a: 'An amount too small to spend because the fee exceeds the value', wrong: ['Deleted Bitcoin', 'A type of mining waste', 'A security attack'] },
        { q: 'Dust attacks are used to:', a: 'Track and deanonymize wallet owners', wrong: ['Steal Bitcoin directly', 'Mine faster', 'Create new blocks'] },
        { q: 'To avoid dust issues:', a: 'Consolidate small UTXOs when fees are low', wrong: ['Delete your wallet', 'Stop using Bitcoin', 'Only use exchanges'] },
    
        { q: 'What is a "dust attack" in Bitcoin?', a: 'Sending tiny amounts of bitcoin to wallets to track and de-anonymize users', wrong: ['Overloading the network with large transactions', 'Physical dirt damaging mining hardware', 'A bug in the Bitcoin software'] },
        { q: 'Why should users consolidate small UTXOs when fees are low?', a: 'To reduce future transaction costs, as each UTXO adds to transaction size', wrong: ['To increase bitcoin value', 'To improve privacy', 'To earn mining rewards'] },
    ],
    'rbf': [
        { q: 'RBF stands for:', a: 'Replace-By-Fee', wrong: ['Really Big Fee', 'Rapid Block Finality', 'Return Bitcoin Fast'] },
        { q: 'RBF allows you to:', a: 'Bump a stuck transaction\'s fee to speed confirmation', wrong: ['Cancel any transaction', 'Send Bitcoin for free', 'Mine your own block'] },
        { q: 'RBF is useful when:', a: 'Your transaction is stuck because the fee was too low', wrong: ['You want to mine', 'You need a new wallet', 'You want to buy altcoins'] },
    
        { q: 'What does RBF (Replace-by-Fee) allow users to do?', a: 'Replace an unconfirmed transaction with a higher-fee version', wrong: ['Reverse a confirmed transaction', 'Increase their total bitcoin balance', 'Prevent double spending'] },
        { q: 'What is CPFP (Child Pays for Parent) used for?', a: 'Accelerating confirmation by spending an unconfirmed output with a high-fee transaction', wrong: ['Splitting bitcoin for children', 'Creating child wallets', 'Reducing transaction size'] },
    ],
    'time_preference': [
        { q: 'Low time preference means:', a: 'Saving for the future instead of spending now', wrong: ['Spending everything today', 'Not caring about money', 'Only day trading'] },
        { q: 'Bitcoin encourages low time preference because:', a: 'Its value tends to increase over time due to scarcity', wrong: ['It loses value quickly', 'It pays interest', 'The government mandates savings'] },
        { q: 'High time preference leads to:', a: 'Overconsumption and debt', wrong: ['Wealth building', 'Better savings', 'Financial freedom'] },
        { q: 'Fiat currency encourages:', a: 'Spending now because money loses value over time', wrong: ['Long-term saving', 'Low time preference', 'Financial responsibility'] },
    ],
    'soft_vs_hard_forks': [
        { q: 'A soft fork is:', a: 'Backward-compatible upgrade', wrong: ['A completely new blockchain', 'Deleting Bitcoin', 'A type of altcoin'] },
        { q: 'A hard fork creates:', a: 'A permanent chain split if not everyone upgrades', wrong: ['A temporary pause', 'More Bitcoin', 'A faster network'] },
        { q: 'Bitcoin Cash was created by:', a: 'A hard fork of Bitcoin in 2017', wrong: ['Satoshi Nakamoto in 2009', 'The US government', 'Ethereum developers'] },
        { q: 'SegWit was activated as:', a: 'A soft fork', wrong: ['A hard fork', 'A new blockchain', 'An altcoin'] },
    ],
    'fedimints': [
        { q: 'Fedimint helps with:', a: 'Community custody with privacy', wrong: ['Solo mining', 'Creating altcoins', 'Government reporting'] },
        { q: 'A Fedimint uses:', a: 'Federated guardians who jointly custody Bitcoin', wrong: ['A single custodian', 'Government vaults', 'Exchange accounts'] },
        { q: 'Fedimint provides privacy through:', a: 'Chaumian eCash tokens', wrong: ['Public blockchain', 'KYC verification', 'IP tracking'] },
        { q: 'Fedimints are designed for:', a: 'Communities that trust each other but want privacy', wrong: ['Individual use only', 'Government agencies', 'Large corporations'] },
    ],

    // Resources
    'books': [
        { q: 'The Bitcoin Standard is a popular book about:', a: 'Sound money and Bitcoin economics', wrong: ['Bitcoin mining hardware', 'How to day trade', 'Building websites'] },
        { q: 'Mastering Bitcoin by Andreas Antonopoulos is:', a: 'A technical deep-dive into how Bitcoin works', wrong: ['A children\'s book', 'A cookbook', 'A fitness guide'] },
        { q: 'The Sovereign Individual predicted:', a: 'Digital money and the decline of nation-states', wrong: ['Social media', 'Electric cars', 'Space travel'] },
        { q: '21 Lessons by Gigi explores:', a: 'Philosophical lessons learned from going down the Bitcoin rabbit hole', wrong: ['21 mining techniques', '21 trading strategies', '21 altcoins to buy'] },
    ],
    'misconceptions-fud': [
        { q: 'FUD stands for:', a: 'Fear, Uncertainty, and Doubt', wrong: ['Fully Unified Database', 'First User Downloaded', 'Financial Update Daily'] },
        { q: '"Bitcoin is used by criminals" ignores that:', a: 'Cash is used far more for crime and Bitcoin is traceable', wrong: ['Bitcoin is untraceable', 'There are no criminals', 'Crime doesn\'t exist'] },
        { q: '"Bitcoin has no intrinsic value" ignores:', a: 'Its network security, scarcity, and utility', wrong: ['Its physical weight', 'Its smell', 'Its color'] },
        { q: '"Bitcoin is too volatile" ignores:', a: 'Its long-term upward trend and decreasing volatility over time', wrong: ['That it never moves', 'That it only goes down', 'Government price controls'] },
        { q: '"Bitcoin wastes energy" ignores:', a: 'Its use of stranded/renewable energy and the value it secures', wrong: ['That it uses no energy', 'Solar panels', 'Wind turbines only'] },
    ],
    'satoshi-nakamoto': [
        { q: 'Satoshi Nakamoto:', a: 'Stepped down and disappeared', wrong: ['Is currently the CEO of Bitcoin', 'Was arrested', 'Sold all Bitcoin'] },
        { q: 'Satoshi\'s last known communication was around:', a: '2011', wrong: ['2020', '2015', '2009'] },
        { q: 'Satoshi\'s Bitcoin holdings are estimated at:', a: 'About 1 million BTC that have never moved', wrong: ['Zero', '100 BTC', 'All 21 million'] },
        { q: 'Satoshi\'s disappearance is seen as:', a: 'A feature — it made Bitcoin truly decentralized', wrong: ['A bug', 'A crime', 'A marketing strategy'] },
        { q: 'Satoshi\'s true identity is:', a: 'Unknown — it could be one person or a group', wrong: ['Confirmed to be Elon Musk', 'A CIA agent', 'The President'] },
    ],
    'history': [
        { q: 'The Bitcoin Genesis Block was mined in:', a: 'January 2009', wrong: ['October 2008', 'June 2010', 'December 2007'] },
        { q: 'The first real-world Bitcoin transaction was:', a: '10,000 BTC for two pizzas', wrong: ['1 BTC for a car', '100 BTC for a house', '1 BTC for a coffee'] },
        { q: 'Bitcoin Pizza Day is celebrated on:', a: 'May 22', wrong: ['January 3', 'October 31', 'December 25'] },
        { q: 'Mt. Gox was:', a: 'An early Bitcoin exchange that was hacked and collapsed', wrong: ['A mining company', 'A Bitcoin wallet', 'A government agency'] },
        { q: 'The first Bitcoin block is called:', a: 'The Genesis Block (Block 0)', wrong: ['The Alpha Block', 'Block One', 'The Origin Block'] },
        { q: 'Hal Finney received:', a: 'The first Bitcoin transaction from Satoshi', wrong: ['The last Bitcoin ever', 'A medal from the government', 'The Bitcoin trademark'] },
    ],

    // General Bitcoin knowledge (available for any quest)
    '_general': [
        { q: 'What is the smallest unit of Bitcoin called?', a: 'A satoshi', wrong: ['A bit', 'A wei', 'A penny'] },
        { q: 'Bitcoin was launched in which year?', a: '2009', wrong: ['2008', '2010', '2012'] },
        { q: 'Bitcoin transactions are recorded on:', a: 'A public distributed ledger', wrong: ['A private server', 'A bank database', 'An email chain'] },
        { q: 'Who can send you Bitcoin?', a: 'Anyone who knows your address', wrong: ['Only your bank', 'Only verified users', 'Only people in your country'] },
        { q: 'Bitcoin operates on:', a: '24/7, 365 days a year', wrong: ['Banking hours only', 'Weekdays only', 'It shuts down for maintenance'] },
        { q: 'The total number of Bitcoins that will ever exist is:', a: 'Exactly 21 million', wrong: ['Unlimited', '100 million', 'It changes yearly'] },
        { q: 'Bitcoin is often abbreviated as:', a: 'BTC', wrong: ['BTN', 'BCN', 'BIT'] },
        { q: 'A Bitcoin wallet stores:', a: 'Private keys, not actual Bitcoin', wrong: ['Physical coins', 'Digital files of Bitcoin', 'Pictures of Bitcoin'] },
        { q: 'To receive Bitcoin you need:', a: 'A Bitcoin address', wrong: ['A bank account', 'A social security number', 'A credit card'] },
        { q: 'The Bitcoin network is maintained by:', a: 'Thousands of volunteers running nodes worldwide', wrong: ['A company in California', 'The United Nations', 'A single supercomputer'] },
        { q: 'Bitcoin confirmation time depends on:', a: 'Network congestion and fee paid', wrong: ['Time of day', 'Your internet speed', 'Which country you are in'] },
        { q: 'A mempool is:', a: 'Where unconfirmed transactions wait to be included in a block', wrong: ['A mining pool', 'A type of wallet', 'A cryptocurrency exchange'] },
        { q: 'Bitcoin difficulty adjustment ensures:', a: 'Blocks are found roughly every 10 minutes regardless of hash power', wrong: ['Prices stay stable', 'Miners earn the same amount', 'Transactions are free'] },
        { q: 'SegWit stands for:', a: 'Segregated Witness', wrong: ['Secure Widget', 'Sequential Witness', 'Segment Width'] },
        { q: 'A Bitcoin address starts with:', a: '1, 3, or bc1', wrong: ['0x', 'BTC', 'Any letter'] },
        { q: 'The Lightning Network whitepaper was published by:', a: 'Joseph Poon and Thaddeus Dryja', wrong: ['Satoshi Nakamoto', 'Vitalik Buterin', 'Elon Musk'] },
        { q: 'Bitcoin hash rate measures:', a: 'The total computing power securing the network', wrong: ['Transaction speed', 'Number of users', 'Price changes'] },
        { q: 'A nonce in mining is:', a: 'A number miners change to find a valid block hash', wrong: ['A type of fee', 'A wallet address', 'A block reward'] },
        { q: 'The term "NGMI" in Bitcoin culture means:', a: 'Not Gonna Make It', wrong: ['New Global Money Index', 'Next Generation Mining Interface', 'Network Growth Metric Indicator'] },
        { q: 'Hyperbitcoinization refers to:', a: 'Mass voluntary adoption of Bitcoin as money', wrong: ['A Bitcoin price crash', 'A mining difficulty spike', 'A new altcoin launch'] },
        { q: 'Strike, Cash App, and River are all:', a: 'Apps that let you buy Bitcoin', wrong: ['Mining pools', 'Altcoins', 'Bitcoin forks'] },
        { q: 'Nostr is:', a: 'A decentralized social protocol popular in the Bitcoin community', wrong: ['A mining algorithm', 'A Bitcoin fork', 'An exchange'] },
        { q: 'The phrase "fix the money, fix the world" means:', a: 'Sound money leads to better societal outcomes', wrong: ['Print more money', 'Ban all currencies', 'Use only credit cards'] },
        { q: 'A timelock in Bitcoin allows:', a: 'Locking funds until a specific block height or time', wrong: ['Freezing the blockchain', 'Stopping mining', 'Deleting transactions'] },
        { q: 'Block reward plus transaction fees equals:', a: 'The total miner revenue per block', wrong: ['The Bitcoin price', 'The network speed', 'The difficulty level'] },
        { q: 'Ordinals on Bitcoin are:', a: 'A way to inscribe data on individual satoshis', wrong: ['A ranking system for miners', 'A type of wallet', 'A government regulation'] },
        { q: 'A paper wallet is:', a: 'A printed private key for cold storage', wrong: ['A paper receipt from an ATM', 'A bank statement', 'A type of fiat currency'] },
        { q: 'The Lightning Network can theoretically handle:', a: 'Millions of transactions per second', wrong: ['7 per second', '100 per second', '1 per minute'] },
        { q: 'A watch-only wallet lets you:', a: 'Monitor a balance without being able to spend', wrong: ['Mine Bitcoin', 'Create new coins', 'Edit the blockchain'] },
        { q: 'Pleb is a term of endearment in Bitcoin meaning:', a: 'An everyday Bitcoiner, not wealthy but committed', wrong: ['A professional trader', 'A mining executive', 'A government official'] },
    ],

    // New questions from Discord 2025 content migration
    'mining': [
        { q: 'What milestone did Bitcoin hash rate reach in September 2025?', a: '1 Zettahash per second', wrong: ['500 Exahash', '10 Petahash', '100 Terahash'] },
        { q: 'Pleb Pool and Atlas Pool are examples of:', a: 'Solo Bitcoin mining pools', wrong: ['Lightning wallets', 'Bitcoin exchanges', 'Hardware wallets'] },
        { q: 'D-Central Technologies specializes in:', a: 'Home mining equipment and support', wrong: ['Bitcoin trading', 'Lightning channels', 'Cold storage'] },
        { q: 'Constellation Heating combines mining with:', a: 'Heating swimming pools', wrong: ['Cooling data centers', 'Wind power', 'Solar panels'] },
    ],
    'layer-2-lightning': [
        { q: 'Satogram allows you to:', a: 'Send messages across the Lightning network', wrong: ['Mine Bitcoin', 'Create NFTs', 'Swap altcoins'] },
        { q: 'Lightning Cats and Lightning Goats let you:', a: 'Feed real animals using Lightning payments', wrong: ['Trade animal NFTs', 'Mine with animal power', 'Buy pets with Bitcoin'] },
        { q: 'Pay With Flash is a service for:', a: 'Businesses to accept Bitcoin payments', wrong: ['Mining Bitcoin', 'Cold storage', 'Coin mixing'] },
        { q: 'LNgigs is a Bitcoin-powered:', a: 'Freelance marketplace', wrong: ['Mining pool', 'Exchange', 'Hardware wallet'] },
        { q: 'The Lightning Network whitepaper was written by:', a: 'Joseph Poon and Thaddeus Dryja', wrong: ['Satoshi Nakamoto', 'Vitalik Buterin', 'Adam Back'] },
    ],
    'privacy-nonkyc': [
        { q: 'The first recorded address poisoning attack on Bitcoin happened in:', a: '2025', wrong: ['2021', '2013', '2009'] },
        { q: 'Shielded CSV on Bitcoin promises:', a: 'Better than Zcash-level privacy as an L1.5', wrong: ['Faster mining', 'Bigger blocks', 'More altcoins'] },
        { q: 'Briar messenger is engineered for:', a: 'Privacy in hostile environments using Tor', wrong: ['Fast video calls', 'Social media sharing', 'Cloud storage'] },
    ],
    'problems-of-money': [
        { q: 'The Cantillon Effect describes how:', a: 'Those closest to new money benefit most from inflation', wrong: ['Bitcoin mining gets harder', 'Banks lose money', 'Gold prices drop'] },
        { q: 'ShadowStats.com tracks:', a: 'Real inflation rates vs official government numbers', wrong: ['Bitcoin mining difficulty', 'Lightning channel capacity', 'Altcoin prices'] },
        { q: '"The Four Horsemen" documentary (2013) exposes:', a: 'The fiat monetary system scam', wrong: ['Bitcoin mining farms', 'Social media dangers', 'Space exploration'] },
    ],
    'nodes': [
        { q: 'Clark Moody dashboard is useful for tracking:', a: 'Bitcoin network stats and Knots adoption', wrong: ['Altcoin prices', 'Social media followers', 'Email subscribers'] },
        { q: 'Matt Hill is the founder and CEO of:', a: 'Start9 (node-in-a-box solution)', wrong: ['Bitcoin Magazine', 'Coinbase', 'Blockstream'] },
        { q: 'The Bitcoin Commons governance model proposes:', a: 'Coordination without authority for Bitcoin implementations', wrong: ['Central planning of upgrades', 'Voting on block size', 'Government oversight'] },
    ],
    'risks__threats__attack_vectors__weaknes': [
        { q: 'Which Bitcoin address type is better for quantum resistance?', a: 'SegWit (bc1q) because Taproot exposes the public key', wrong: ['Taproot (bc1p)', 'Legacy (1...)', 'All are equally vulnerable'] },
        { q: 'BIP 360 proposes:', a: 'Pay to Quantum Resistant Hash', wrong: ['Bigger blocks', 'Faster mining', 'New altcoin support'] },
    ],
    'investment-strategy': [
        { q: 'The biggest drawdown in Bitcoin history was:', a: '94% decline from $32 to $2 in July 2011', wrong: ['50% in 2018', '70% in 2022', '80% in 2014'] },
        { q: 'MNAV.com tracks:', a: 'Bitcoin treasury companies and their metrics', wrong: ['Lightning channels', 'Mining pools', 'Altcoin prices'] },
    ],
    'history': [
        { q: 'Laszlo\'s famous pizza order was called from:', a: 'London (Laszlo was in Florida)', wrong: ['New York', 'San Francisco', 'Tokyo'] },
        { q: 'The Bitcoin Wiki has been online since:', a: '2010', wrong: ['2015', '2009', '2013'] },
        { q: 'Tim Draper is known in Bitcoin for:', a: 'Buying seized Silk Road Bitcoin at US Marshals auction', wrong: ['Creating the Lightning Network', 'Writing the whitepaper', 'Mining the genesis block'] },
        { q: 'The "Lightning Torch" was:', a: 'A Lightning payment passed between notable Bitcoiners', wrong: ['A mining competition', 'A hardware wallet', 'A documentary'] },
    ],
    'evidence-against-alts': [
        { q: 'Ethereum\'s original sale page reveals that ETH was:', a: 'Pre-sold as a security to fund development', wrong: ['Mined fairly like Bitcoin', 'Distributed equally', 'Created by Satoshi'] },
    
        { q: 'What fundamental difference exists between Bitcoin and altcoins regarding decentralization?', a: 'Altcoin founders often hold large pre-mines or centralized control', wrong: ['Altcoins are too cheap', 'Bitcoin has better marketing', 'Altcoins use different blockchains'] },
    ],
    'smart-contracts': [
        { q: 'Bitcoin\'s scripting language has supported smart contracts:', a: 'Since the beginning — Bitcoin always had them', wrong: ['Only after Taproot in 2021', 'Only after SegWit in 2017', 'Never — only Ethereum has them'] },
        { q: 'OP_RETURN is used in Bitcoin to:', a: 'Embed small amounts of data in transactions', wrong: ['Return sent Bitcoin', 'Cancel transactions', 'Mine faster'] },
    
        { q: 'What is Bitcoin\\\'s native scripting language called?', a: 'Bitcoin Script', wrong: ['Solidity', 'Python Script', 'JavaScript'] },
        { q: 'What does OP_RETURN allow users to do on Bitcoin?', a: 'Embed up to 80 bytes of arbitrary data in a transaction', wrong: ['Execute Ethereum-style smart contracts', 'Change transaction amounts', 'Create new bitcoins'] },
        { q: 'What are DLCs (Discreet Log Contracts) on Bitcoin?', a: 'Smart contracts that settle based on external oracle data without revealing details', wrong: ['Private keys stored in logs', 'Debug contracts for developers', 'Decentralized lending contracts on Ethereum'] },
    ],
    'chaumian-mints': [
        { q: 'Cashu is an implementation of:', a: 'Chaumian ecash on Bitcoin/Lightning', wrong: ['A new blockchain', 'An altcoin', 'A mining algorithm'] },
    
        { q: 'Who invented the blind signature technology used in Chaumian eCash?', a: 'David Chaum in 1982', wrong: ['Satoshi Nakamoto in 2008', 'Adam Back in 1997', 'Hal Finney in 2004'] },
        { q: 'What modern Bitcoin layer implements Chaumian eCash for minting privacy-preserving tokens?', a: 'Cashu and Fedimint protocols', wrong: ['Lightning Network', 'Liquid Network', 'Ethereum ERC-20'] },
    ],
    'swag-merch': [
        { q: 'BTCAccepted.org helps you find:', a: 'Businesses that accept Bitcoin payments', wrong: ['Mining pools', 'Lightning nodes', 'Altcoin exchanges'] },
        { q: 'Sats.host offers:', a: 'Bitcoin-powered static website hosting', wrong: ['Mining services', 'Cold storage', 'KYC verification'] },
    
        { q: 'What annual Bitcoin conference is often called "the Super Bowl of Bitcoin"?', a: 'Bitcoin Conference (formerly Miami/Bitcoin 2021)', wrong: ['Consensus', 'DevCon', 'ETHDenver'] },
        { q: 'What is the significance of wearing an orange pill at Bitcoin conferences?', a: 'Signifies being "orange pilled" — awakened to Bitcoin\\\'s importance', wrong: ['Medical supplement promotion', 'Conference staff identifier', 'VIP pass indicator'] },
        { q: 'What popular Bitcoin merchandise item satirizes central banking?', a: '"End the Fed" t-shirts and posters', wrong: ['Bitcoin gaming chairs', 'Satoshi action figures', 'Mining rig keychains'] },
    ],
    'apps-tools': [
        { q: 'PPQ.ai lets you use AI models and pay with:', a: 'Bitcoin per prompt — no subscription needed', wrong: ['Monthly credit card subscription', 'Ethereum gas fees', 'Free but with ads'] },
        { q: 'Angor is a platform for:', a: 'Non-custodial Bitcoin crowdfunding', wrong: ['Bitcoin mining', 'Coin mixing', 'Hardware wallets'] },
    
        { q: 'What website provides real-time visualization of the Bitcoin mempool?', a: 'mempool.space', wrong: ['blockchain.com', 'coinmarketcap.com', 'bitcoincharts.com'] },
        { q: 'What popular hardware wallet supports both Bitcoin and Lightning?', a: 'Coldcard and BitBox02', wrong: ['PayPal Card', 'Venmo Wallet', 'Apple Pay'] },
        { q: 'What full node implementation is the most widely used for running Bitcoin?', a: 'Bitcoin Core', wrong: ['Bitcoin Cash', 'Ethereum Classic', 'Ripple Node'] },
    ],
    'games': [
        { q: 'Timechain Arcade offers:', a: 'Free Bitcoin-themed video games', wrong: ['Mining services', 'Trading tools', 'Hardware wallets'] },
        { q: 'CanYouBeatBitcoin.com is:', a: 'An investing simulator comparing your picks to Bitcoin', wrong: ['A mining difficulty calculator', 'A Bitcoin wallet', 'A trading bot'] },
    
        { q: 'What type of Bitcoin games reward players with satoshis?', a: 'Play-to-earn Lightning games', wrong: ['Casino-style gambling', 'Console RPGs', 'Mobile ad games'] },
        { q: 'What popular Bitcoin trivia app lets users earn sats for answering questions?', a: 'THNDR Games (like Bitcoin Bounce, Bitcoin Bay)', wrong: ['Fortnite', 'Candy Crush', 'Minecraft'] },
        { q: 'What is Zebedee known for in the Bitcoin gaming space?', a: 'A platform enabling Lightning payments in games', wrong: ['Hardware mining rigs', 'Altcoin exchange', 'NFT marketplace'] },
    ],

    // ---- NEW QUESTIONS (batch 2) ----

    'difficulty-adjustment': [
        { q: 'How often does Bitcoin\'s difficulty adjustment occur?', a: 'Every 2,016 blocks (approximately 2 weeks)', wrong: ['Every 1,000 blocks', 'Every month', 'Every day'] },
        { q: 'What does the difficulty adjustment ensure?', a: 'Blocks are found roughly every 10 minutes regardless of hash power changes', wrong: ['Transaction fees stay constant', 'Mining rewards increase', 'Block size adjusts automatically'] },
    ],

    'nostr': [
        { q: 'Nostr is:', a: 'A decentralized social media protocol where no one controls content', wrong: ['A Bitcoin mining pool', 'A Lightning wallet', 'A blockchain explorer'] },
        { q: 'What makes Nostr unique from typical social media?', a: 'Your identity is uncensorable and no single entity controls the platform', wrong: ['It pays users in Bitcoin automatically', 'It only works on mobile', 'It requires KYC verification'] },
    ],

    'network_effects': [
        { q: 'Bitcoin\'s network effect means:', a: 'Each new user increases the value and utility for all existing users', wrong: ['The internet gets faster', 'Mining gets easier', 'Fees decrease to zero'] },
        { q: 'Why is Bitcoin\'s network effect considered a strong moat?', a: 'It creates a self-reinforcing cycle of liquidity, security, and adoption that competitors cannot easily replicate', wrong: ['Because Bitcoin has patents', 'Because the government protects it', 'Because the code is encrypted'] },
    
        { q: 'What economic principle explains Bitcoin\\\'s value increasing as more people use it?', a: 'Metcalfe\\\'s Law — network value proportional to connected users squared', wrong: ['Moore\\\'s Law', 'Murphy\\\'s Law', 'Pareto Principle'] },
    ],

    'governance': [
        { q: 'Bitcoin governance is best described as:', a: 'Rough consensus among users, developers, miners, and node operators', wrong: ['A CEO makes all decisions', 'Miners vote on everything', 'A foundation sets the rules'] },
        { q: 'The Blocksize Wars demonstrated that:', a: 'Users and node operators ultimately control Bitcoin\'s rules, not miners alone', wrong: ['Miners have absolute power', 'Developers can force any change', 'Bitcoin cannot be upgraded'] },
    
        { q: 'What is the BIP process in Bitcoin?', a: 'Bitcoin Improvement Proposals for suggesting protocol changes', wrong: ['Bitcoin Investment Plan', 'Blockchain IP Protection', 'Banking Integration Protocol'] },
    ],

    'human_rights__social_justice_and_freedo': [
        { q: 'Bitcoin supports human rights by:', a: 'Providing censorship-resistant money that cannot be confiscated by authoritarian regimes', wrong: ['Replacing all governments', 'Eliminating all poverty instantly', 'Being controlled by the UN'] },
        { q: 'Alex Gladstein advocates for Bitcoin because:', a: 'It empowers people living under authoritarian regimes with financial freedom', wrong: ['It makes trading stocks easier', 'It replaces the need for banks in wealthy countries', 'It was designed as a protest tool'] },
    
        { q: 'How has Bitcoin helped activists in authoritarian regimes?', a: 'By enabling uncensorable fundraising and protecting wealth from seizure', wrong: ['By hiding their identity completely', 'By earning interest from banks', 'By creating new currencies'] },
    ],

    'market_cap': [
        { q: 'Bitcoin\'s market cap is calculated by:', a: 'Current price multiplied by total coins in circulation', wrong: ['Total transaction volume per day', 'Number of wallets times average balance', 'Mining revenue times block height'] },
        { q: 'Why can Bitcoin\'s market cap potentially exceed gold\'s?', a: 'Bitcoin is more portable, divisible, verifiable, and scarce than gold', wrong: ['Because governments will mandate it', 'Because gold will be banned', 'Because Bitcoin mining produces gold'] },
    
        { q: 'What metric compares Bitcoin\\\'s market value to all other cryptocurrencies combined?', a: 'Bitcoin Dominance Index', wrong: ['Coin Market Gap', 'Crypto Index Fund', 'Volatility Ratio'] },
    ],

    'the_future': [
        { q: 'Hyperbitcoinization refers to:', a: 'Mass voluntary adoption of Bitcoin as the dominant form of money', wrong: ['A Bitcoin price crash', 'A government mandate to use Bitcoin', 'A technical upgrade to the protocol'] },
        { q: 'Bitcoin is described as \'generational wealth\' because:', a: 'Its fixed supply and growing adoption may increase its value over decades', wrong: ['Only older people can buy it', 'It expires after one generation', 'Banks guarantee its value for 100 years'] },
    
        { q: 'What is hyperbitcoinization?', a: 'The hypothetical point where Bitcoin becomes the world\\\'s dominant form of money', wrong: ['Overheating of mining equipment', 'Excessive Bitcoin advertising', 'A type of Bitcoin hack'] },
    ],

    'orange-pilling': [
        { q: '\'Orange-pilling\' someone means:', a: 'Convincing them to understand and adopt Bitcoin', wrong: ['Selling them altcoins', 'Giving them free Bitcoin', 'Signing them up for an exchange'] },
        { q: 'The most effective way to orange-pill someone is often:', a: 'Starting with the problem Bitcoin solves (broken money) rather than technical details', wrong: ['Showing them price charts', 'Explaining SHA-256 hashing', 'Telling them to buy immediately'] },
    
        { q: 'What does "orange pilling" someone mean?', a: 'Educating them about Bitcoin until they understand its importance', wrong: ['Giving them actual pills', 'Selling them mining equipment', 'Creating a Bitcoin wallet for them'] },
    ],

    'maximalism': [
        { q: 'Bitcoin maximalism is the belief that:', a: 'Bitcoin is the only cryptocurrency that truly matters as sound money', wrong: ['You should invest everything in Bitcoin', 'Bitcoin should replace all technology', 'Only developers should use Bitcoin'] },
        { q: 'Maximalists argue altcoins are unnecessary because:', a: 'Bitcoin\'s base layer plus additional protocol layers can serve all use cases', wrong: ['Because altcoins are illegal', 'Because Satoshi said so', 'Because there can only be one blockchain'] },
    
        { q: 'What is Bitcoin maximalism?', a: 'The belief that Bitcoin will be the only cryptocurrency to achieve long-term dominance', wrong: ['Investing only in altcoins', 'Maximizing one\\\'s bitcoin holdings at all costs', 'Running multiple full nodes'] },
    ],

    'developers': [
        { q: 'Bitcoin Core is primarily written in:', a: 'C++', wrong: ['Python', 'JavaScript', 'Rust'] },
        { q: 'Contributing to Bitcoin open source requires:', a: 'Anyone can propose changes — no permission needed', wrong: ['A computer science degree', 'Approval from the Bitcoin Foundation', 'Purchasing a developer license'] },
    
        { q: 'Who is considered Bitcoin\\\'s lead maintainer as of recent years?', a: 'There is no formal leader; Bitcoin Core has multiple maintainers', wrong: ['Satoshi Nakamoto', 'Vitalik Buterin', 'Elon Musk'] },
        { q: 'What organization has historically funded Bitcoin Core development?', a: 'MIT Digital Currency Initiative, Chaincode Labs, Brink, Spiral', wrong: ['World Bank', 'Federal Reserve', 'Goldman Sachs'] },
        { q: 'What programming language is Bitcoin Core primarily written in?', a: 'C++', wrong: ['Python', 'Java', 'Solidity'] },
    ],

    'ham_radio': [
        { q: 'Bitcoin transactions can be sent via ham radio, which means:', a: 'Bitcoin can work without an internet connection', wrong: ['Bitcoin requires satellite dishes', 'Only miners can use radio', 'Radio transactions are free'] },
    
        { q: 'How can Bitcoin transactions be sent without internet?', a: 'Via ham radio operators broadcasting signed transactions', wrong: ['Via postal mail', 'Via telephone calls', 'Via satellite TV only'] },
        { q: 'What mesh network protocol has been used to broadcast Bitcoin transactions?', a: 'Blockstream Satellite and goTenna mesh networks', wrong: ['Bluetooth Classic', 'NFC payments', 'Zigbee home network'] },
        { q: 'What is the benefit of Bitcoin over ham radio?', a: 'Censorship resistance even when governments shut down internet', wrong: ['Faster than fiber internet', 'Lower transaction fees', 'Better for large file transfers'] },
        { q: 'Who demonstrated sending Bitcoin via ham radio in 2019?', a: 'Rodolfo Novak co-founder of Coinkite', wrong: ['Elon Musk', 'Jack Dorsey', 'Andreas Antonopoulos'] },
    ],

    'lightning_node': [
        { q: 'Running a Lightning node allows you to:', a: 'Route payments and earn fees while supporting the network', wrong: ['Mine Bitcoin faster', 'Create new Bitcoin', 'Access the dark web'] },
    
        { q: 'What is a Lightning node?', a: 'Software that routes payments on the Lightning Network using payment channels', wrong: ['A physical Bitcoin ATM', 'A mining rig', 'A Bitcoin exchange server'] },
        { q: 'What do node operators lock up to open payment channels?', a: 'Bitcoin as liquidity for routing payments', wrong: ['Ethereum tokens', 'Fiat currency', 'Computing power'] },
        { q: 'What fee do Lightning routing nodes typically charge?', a: 'Routing fees measured in milli-satoshis (very small fraction of a cent)', wrong: ['1% of transaction amount', '$5 per payment', 'No fees allowed'] },
        { q: 'What is inbound liquidity for a Lightning node?', a: 'The ability to receive payments based on funds others have locked with you', wrong: ['Money coming from bank deposits', 'Mining rewards', 'Exchange trading profits'] },
    ],

    'stablecoins': [
        { q: 'Stablecoins in the Bitcoin ecosystem are typically:', a: 'Tokens pegged to fiat currency values, sometimes built on Bitcoin layers', wrong: ['A type of mining reward', 'Bitcoins that never change price', 'Government-issued digital dollars'] },
    
        { q: 'What backs the majority of USDT (Tether)?', a: 'Commercial paper, cash equivalents, and other reserves (historically controversial)', wrong: ['100% US dollars in bank', 'Gold reserves', 'Bitcoin collateral'] },
        { q: 'What major risk do centralized stablecoins pose?', a: 'Issuer can freeze funds or fail to maintain peg', wrong: ['They mine too slowly', 'High transaction fees', 'Private key loss'] },
        { q: 'What caused USDC to depeg temporarily in March 2023?', a: 'Exposure to failed Silicon Valley Bank', wrong: ['Bitcoin price crash', 'Lightning Network bug', 'Satoshi selling coins'] },
    ],

    'consensus': [
        { q: 'Bitcoin consensus means:', a: 'All nodes agree on the state of the blockchain without a central authority', wrong: ['Everyone votes on transactions', 'Miners decide which transactions are valid alone', 'The government approves each block'] },
    
        { q: 'What is Nakamoto Consensus?', a: 'The combination of proof-of-work, longest chain rule, and economic incentives', wrong: ['Voting by coin holders', 'Consensus by the Bitcoin Foundation', 'Agreement between exchanges'] },
        { q: 'Why does Bitcoin use the longest chain as the valid chain?', a: 'Most proof-of-work indicates most energy/computational investment', wrong: ['Random selection', 'Shortest chains are invalid', 'User voting'] },
    ],

    'open_source': [
        { q: 'Bitcoin being open source means:', a: 'Anyone can read, audit, and propose changes to the code', wrong: ['The code is secret but free to use', 'Only approved developers can view it', 'It costs nothing to mine'] },
    
        { q: 'What license is Bitcoin Core released under?', a: 'MIT License (open source)', wrong: ['Proprietary commercial license', 'GPL v3 only', 'Patent-encumbered license'] },
        { q: 'How can anyone contribute to Bitcoin Core?', a: 'Submit pull requests on GitHub after code review', wrong: ['Pay a developer fee', 'Get hired by a bank', 'Apply for a license'] },
        { q: 'What is the purpose of code review in Bitcoin development?', a: 'To catch bugs and security issues before deployment', wrong: ['To slow down development', 'To charge developers money', 'To keep the code secret'] },
    ],

    'coin_mixing_coinjoin_coin_control_utxo': [
        { q: 'CoinJoin improves privacy by:', a: 'Combining multiple users\' transactions so individual spending is hard to trace', wrong: ['Encrypting the blockchain', 'Deleting transaction history', 'Creating fake transactions'] },
    
        { q: 'What is CoinJoin?', a: 'A privacy technique combining multiple users\\\' transactions to break heuristics', wrong: ['A cryptocurrency mixer token', 'A type of hardware wallet', 'An exchange withdrawal method'] },
        { q: 'What does coin control allow Bitcoin users to do?', a: 'Manually select which UTXOs to spend in a transaction', wrong: ['Control the price of bitcoin', 'Limit mining difficulty', 'Set transaction speed'] },
        { q: 'What privacy benefit does proper UTXO management provide?', a: 'Preventing address clustering and transaction graph analysis', wrong: ['Increasing mining rewards', 'Reducing transaction fees', 'Speeding up confirmations'] },
    ],

    'environment___energy': [
        { q: 'Bitcoin mining\'s relationship with renewable energy is:', a: 'Miners actively seek cheap renewable and stranded energy, incentivizing green energy development', wrong: ['Mining only uses coal', 'Renewable energy cannot power mining', 'Mining has no relationship with energy markets'] },
    
        { q: 'What percentage of Bitcoin mining comes from renewable energy (estimates)?', a: 'Estimates range from 50-60% using renewable or stranded energy', wrong: ['0% — all coal', '100% renewable', 'Less than 10%'] },
        { q: 'What is "stranded energy" in Bitcoin mining?', a: 'Energy that would otherwise go to waste due to lack of transmission infrastructure', wrong: ['Energy from broken solar panels', 'Leftover battery power', 'Natural gas used for heating'] },
        { q: 'How does Bitcoin mining help stabilize electrical grids?', a: 'Miners can rapidly reduce load during peak demand (demand response)', wrong: ['By storing electricity in batteries', 'By donating profits to utilities', 'By building more coal plants'] },
        { q: 'What common criticism about Bitcoin energy use is often misrepresented?', a: 'Per-transaction energy cost (Bitcoin uses same energy regardless of transaction count)', wrong: ['It uses no energy at all', 'All energy comes from coal', 'Mining makes computers explode'] },
    ],

    'austrian_school_of_economics': [
        { q: 'The Austrian School of Economics relates to Bitcoin because:', a: 'It advocates for sound money with limited supply, which Bitcoin embodies', wrong: ['It was founded by Satoshi Nakamoto', 'It requires government-controlled currency', 'It predicts Bitcoin will fail'] },
    
        { q: 'Which Austrian economist emphasized the importance of sound money and criticized fiat?', a: 'Ludwig von Mises and Friedrich Hayek', wrong: ['John Maynard Keynes', 'Karl Marx', 'Milton Friedman'] },
    ],

    'lindy_effect': [
        { q: 'The Lindy Effect applied to Bitcoin means:', a: 'The longer Bitcoin survives, the longer it is expected to continue surviving', wrong: ['Bitcoin gets slower over time', 'Older technology always fails', 'Bitcoin will expire after 21 years'] },
    
        { q: 'What is the Lindy Effect?', a: 'The longer something survives, the longer its remaining life expectancy', wrong: ['A measure of mining difficulty', 'A type of cryptographic hash', 'A brand of hardware wallet'] },
        { q: 'How does the Lindy Effect apply to Bitcoin?', a: 'Each year without failure increases confidence in future survival', wrong: ['Bitcoin becomes less secure over time', 'Only old coins have value', 'Newer cryptocurrencies are safer'] },
        { q: 'What concept is closely related to Lindy Effect in Bitcoin?', a: 'Antifragility — stress makes the system stronger', wrong: ['Inflation targeting', 'Proof of stake', 'Central banking'] },
        { q: 'Why is Bitcoin\\\'s 15+ year survival significant for the Lindy Effect?', a: 'Demonstrates resilience to attacks, bugs, and regulatory pressure', wrong: ['Proves it cannot be upgraded', 'Makes it obsolete', 'Shows it uses too much energy'] },
    ],

    'softwar': [
        { q: 'Jason Lowery\'s Softwar thesis argues that:', a: 'Proof-of-work is a form of digital power projection analogous to military power in the physical world', wrong: ['Bitcoin is a weapon system', 'Software replaces all hardware', 'Bitcoin was created by the military'] },
    
        { q: 'Who authored the "Softwar" thesis about Bitcoin?', a: 'Major Jason Lowery of the US Space Force', wrong: ['Michael Saylor', 'Nick Szabo', 'Elizabeth Warren'] },
        { q: 'What is the core argument of the Softwar thesis?', a: 'Proof-of-work is a form of kinetic power projection for cyberspace', wrong: ['Bitcoin should be banned', 'Proof of stake is superior', 'Bitcoin is a company'] },
        { q: 'What does Softwar compare Bitcoin\\\'s hash rate to?', a: 'Physical military power projection and deterrence', wrong: ['Social media likes', 'Stock market volume', 'Bank transaction counts'] },
    ],

    'sidechains': [
        { q: 'A Bitcoin sidechain is:', a: 'A separate blockchain that is pegged to Bitcoin, enabling additional features while settling back to the main chain', wrong: ['A backup copy of the Bitcoin blockchain', 'A faster version of Bitcoin Core', 'An altcoin that replaced Bitcoin'] },
    
        { q: 'What is the Liquid Network?', a: 'A federated sidechain enabling faster confidential Bitcoin transactions', wrong: ['An Ethereum scaling solution', 'A mining pool', 'A hardware wallet'] },
        { q: 'What is RSK (Rootstock)?', a: 'A Bitcoin sidechain supporting smart contracts with merged mining', wrong: ['A Russian Bitcoin exchange', 'A hardware wallet brand', 'A Lightning wallet'] },
        { q: 'How are assets secured when moving to a sidechain?', a: 'Through a federated peg locking bitcoin on mainchain', wrong: ['By burning bitcoin permanently', 'By trusting a single company', 'No security is provided'] },
        { q: 'What is a downside of federated sidechains compared to Bitcoin mainchain?', a: 'Less decentralization due to reliance on federation members', wrong: ['Higher transaction fees', 'Slower block times', 'No programming capabilities'] },
    ],

    'submarine_swap': [
        { q: 'A submarine swap allows you to:', a: 'Exchange on-chain Bitcoin for Lightning Bitcoin (or vice versa) trustlessly', wrong: ['Mine Bitcoin underwater', 'Send Bitcoin without internet', 'Convert Bitcoin to Ethereum'] },

        { q: 'What is a submarine swap?', a: 'An atomic swap between on-chain Bitcoin and Lightning Network off-chain', wrong: ['A type of mining pool payout', 'A DeFi lending protocol', 'An underwater transaction method'] },
        { q: 'What enables submarine swaps to be trustless?', a: 'HTLCs (Hash Time Locked Contracts)', wrong: ['Centralized exchange custody', 'Bank wire confirmation', 'Social media verification'] },
        { q: 'What problem do submarine swaps solve?', a: 'Moving funds between on-chain and Lightning without closing channels', wrong: ['Mining difficulty adjustment', 'Exchange rate volatility', 'Wallet password recovery'] },
    ]
};
let isRetry = false;
let visitedForQuest = []; // Track channel visit order for quiz generation
let questCount = 0;

// Quest triggers: after visiting X channels
const QUEST_TRIGGERS = [5, 15, 25, 40, 60, 80, 100];
let currentQuest = null;
let completedQuests = new Set();
let weeklyCompleted = [];

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

function generateAndShowQuest(manual, targetChannelId) {
    // Limit quests to 3 per day to prevent point farming
    var today = new Date().toISOString().split('T')[0];
    var questLog = safeJSON('btc_quest_daily', {});
    if (questLog.date !== today) {
        questLog = { date: today, count: 0 };
    }
    if (questLog.count >= 3) {
        if (manual && typeof showToast === 'function') showToast('⏰ You\'ve completed 3 quests today! Come back tomorrow for more.');
        return;
    }

    // Track previously asked questions to avoid repeats
    const askedQuestions = safeJSON('btc_asked_questions', []);

    // Collect available questions
    let pool = [];
    
    // If a specific topic was selected from the picker, ONLY use that topic's questions
    if (targetChannelId && QUESTION_BANK[targetChannelId]) {
        QUESTION_BANK[targetChannelId].forEach(q => pool.push({...q, source: targetChannelId}));
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

    // Deduplicate by topic — extract key words and prevent similar questions in same quest
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

    const questId = 'quest_dynamic_' + questCount;
    if (completedQuests.has(questId)) return;

    // Track these questions as asked
    const newAsked = [...askedQuestions, ...selected.map(q => q.q)];
    localStorage.setItem('btc_asked_questions', JSON.stringify(newAsked));

    // Build multiple choice format
    const questions = selected.map(q => {
        const options = [q.a, ...q.wrong].sort(() => Math.random() - 0.5);
        const correctIdx = options.indexOf(q.a);
        return { q: q.q, options, answer: correctIdx };
    });

    currentQuest = { id: questId, title: getQuestTitle(questCount, targetChannelId), questions };

    // Register quest server-side for secure grading
    window._currentQuestServerId = null;
    if (typeof firebase !== 'undefined' && firebase.functions) {
        firebase.functions().httpsCallable('startQuest')({
            questions: questions.map(function(q) { return { answer: q.answer }; })
        }).then(function(res) {
            window._currentQuestServerId = res.data.questId;
        }).catch(function(e) { console.warn('Quest registration failed:', e); });
    }

    showQuest(currentQuest, false);
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
        var emoji = topicEmojis[topicKey] || '⚡';
        var label = topicKey.replace(/[-_]+/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
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
            // Impact tone — sharp attack at 150Hz dropping to 60Hz
            const osc1 = ctx.createOscillator();
            const g1 = ctx.createGain();
            osc1.connect(g1); g1.connect(ctx.destination);
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(150, now + time);
            osc1.frequency.exponentialRampToValueAtTime(60, now + time + 0.15);
            g1.gain.setValueAtTime(0.7 * vol, now + time);
            g1.gain.exponentialRampToValueAtTime(0.001, now + time + 0.4);
            osc1.start(now + time); osc1.stop(now + time + 0.4);

            // Drum body resonance — 80Hz sustained thump
            const osc2 = ctx.createOscillator();
            const g2 = ctx.createGain();
            osc2.connect(g2); g2.connect(ctx.destination);
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(80, now + time);
            osc2.frequency.exponentialRampToValueAtTime(50, now + time + 0.3);
            g2.gain.setValueAtTime(0.5 * vol, now + time);
            g2.gain.exponentialRampToValueAtTime(0.001, now + time + 0.5);
            osc2.start(now + time); osc2.stop(now + time + 0.5);

            // Skin slap — short burst of low-pass noise
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
        html += '<div class="quest-q">';
        html += '<div class="quest-q-num">Question ' + (i + 1) + ' of 5</div>';
        html += '<div class="quest-q-text">' + q.q + '</div>';
        html += '<div class="quest-options">';
        q.options.forEach((opt, j) => {
            html += '<button class="quest-opt" onclick="selectAnswer(this,' + i + ',' + j + ')">' + opt + '</button>';
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

    // Grade server-side if registered
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
    if (isRetry) {
        if (score >= 3) {
            if (!pts) pts = 25;
            msg = '🎉 ' + score + '/5 correct on retry! +' + pts + ' XP!';
            completedQuests.add(currentQuest.id);
            questCount++;
        } else {
            msg = '😅 ' + score + '/5 — Better luck next time! Keep reading and try again.';
        }
    } else {
        if (score === 5) {
            if (!pts) pts = 100;
            msg = '🏆 PERFECT! 5/5! +' + pts + ' XP!';
            completedQuests.add(currentQuest.id);
            questCount++;
        } else if (score >= 3) {
            if (!pts) pts = 50;
            msg = '🎉 ' + score + '/5 correct! +' + pts + ' XP!';
            completedQuests.add(currentQuest.id);
            questCount++;
        } else {
            msg = '😅 ' + score + '/5 — You can retry for 25 XP!';
        }
    }

    if (pts > 0) {
        // Points already awarded server-side by gradeQuest
        if (typeof notifySelfQuest === 'function') notifySelfQuest(currentQuest.title);
        // Log to local XP history for the Points notification tab
        if (typeof notifySelfPoints === 'function') notifySelfPoints(pts, '🏆 Quest: ' + (currentQuest.title || 'Quest'));
        // Raid Boss: quiz completion
        if (typeof window._raidOnQuizComplete === 'function') window._raidOnQuizComplete();
        if (typeof window._raidOnXPEarned === 'function') window._raidOnXPEarned(pts);
        var todayQ = new Date().toISOString().split('T')[0];
        var qLog = safeJSON('btc_quest_daily', {});
        if (qLog.date !== todayQ) qLog = { date: todayQ, count: 0 };
        qLog.count++;
        localStorage.setItem('btc_quest_daily', JSON.stringify(qLog));
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
            '<div style="font-size:0.95rem;color:var(--text-muted);margin-bottom:16px;">Review your answers below — <span style="color:#22c55e;font-weight:700;">green</span> is correct, <span style="color:#ef4444;font-weight:700;">red</span> is wrong</div>' +
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

        // Final sustained major chord — the hooray moment
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

function showQuestFinalResults() {
    const score = window._questScore;
    const msg = window._questMsg;
    const pts = window._questPts;

    // Play hooray sound if they passed
    if (score >= 3) playHooraySound();

    // Hide the questions
    const questionsDiv = document.querySelector('.quest-questions');
    if (questionsDiv) questionsDiv.style.display = 'none';

    // Show final results screen
    const header = document.querySelector('.quest-header');
    if (header) {
        header.innerHTML = '<div class="quest-badge">⚡ QUEST COMPLETE</div>' +
            '<h2>' + currentQuest.title + '</h2>' +
            '<div style="font-size:3rem;margin:20px 0;">' + (score === 5 ? '🏆' : score >= 3 ? '🎉' : '😅') + '</div>' +
            '<div style="font-size:1.8rem;font-weight:900;color:var(--heading);margin-bottom:8px;">' + score + ' / 5 Correct</div>' +
            '<div style="font-size:1.1rem;color:var(--text-muted);margin-bottom:20px;">' + msg + '</div>' +
            (pts > 0 ? '<div style="font-size:1.3rem;font-weight:800;color:var(--accent);margin-bottom:20px;">+' + pts + ' XP earned!</div>' : '') +
            (score < 3 ? '<button class="quest-retry" onclick="retryQuest()">🔄 Retry Quest' + (isRetry ? '' : ' for 25 pts') + '</button>' : '') +
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

    for (var key in QUESTION_BANK) {
        if (key === '_general') continue; // Skip general pool in picker
        var qs = QUESTION_BANK[key];
        if (!qs || qs.length < 3) continue; // Need at least 3 questions
        var label = key.replace(/[-_]+/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
        var emoji = topicEmojis[key] || '📖';
        var done = completedQuests.has('quest_' + key) || completedQuests.has(key) || weeklyCompleted.indexOf(key) !== -1;
        topics.push({ key: key, label: label, emoji: emoji, count: qs.length, done: done });
    }

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

    // Random option
    html += '<button onclick="_startQuestTopic(null)" style="width:100%;padding:12px;background:linear-gradient(135deg,rgba(247,147,26,0.1),rgba(247,147,26,0.03));border:1px solid var(--accent);border-radius:12px;color:var(--accent);font-weight:800;font-size:0.85rem;cursor:pointer;font-family:inherit;margin-bottom:12px;transition:0.2s;">🎲 Random Topic</button>';

    // Search field
    html += '<input id="questSearch" type="text" placeholder="Search topics…" style="width:100%;padding:8px;margin-bottom:8px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);font-size:0.85rem;" />';

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
        // Random — pick an incomplete topic
        var incomplete = [];
        for (var key in QUESTION_BANK) {
            if (key === '_general') continue;
            if (QUESTION_BANK[key].length < 3) continue;
            if (!completedQuests.has('quest_' + key) && !completedQuests.has(key) && weeklyCompleted.indexOf(key) === -1) incomplete.push(key);
        }
        if (incomplete.length > 0) {
            topicKey = incomplete[Math.floor(Math.random() * incomplete.length)];
        } else {
            // All done — pick any
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
}

setTimeout(initQuests, 3000);

const NEW_BANK_QUESTIONS = {
    'mining': [
        { q: 'What is a "nonce" in Bitcoin mining?', a: 'A "number used once" that miners change to find a valid hash', wrong: ['A type of mining hardware', 'A fee paid to nodes', 'The total number of Bitcoins'] },
        { q: 'Mining pools allow small miners to:', a: 'Receive more frequent, smaller payouts', wrong: ['Control the entire network', 'Mine without using electricity', 'Change the supply of Bitcoin'] },
        { q: 'Bitcoin difficulty adjusts every how many blocks?', a: '2,016 blocks (roughly 2 weeks)', wrong: ['210,000 blocks', 'Only during halvings', 'Every single block'] }
    ],
    'nodes': [
        { q: 'A pruned node saves space by:', a: 'Deleting old block data after validating it', wrong: ['Only downloading headers', 'Charging other nodes for storage', 'Reducing the frequency of blocks'] },
        { q: 'A full node is different from a miner because:', a: 'It enforces all rules but doesn\'t create new blocks', wrong: ['It is faster than a miner', 'It requires more electricity', 'It is only for experts'] },
        { q: 'How does your node know if a transaction is valid?', a: 'It checks the signatures and inputs against the consensus rules', wrong: ['It asks a central server', 'It votes with other nodes', 'It waits for a tweet from Satoshi'] }
    ],
    'privacy-nonkyc': [
        { q: 'What is a "Dust Attack"?', a: 'Tiny amounts of BTC sent to addresses to track the owner\'s movement', wrong: ['A network overload', 'A type of mining hardware failure', 'Deleting your private keys by accident'] },
        { q: '"WabiSabi" and "Whirlpool" are types of:', a: 'CoinJoin coordination protocols', wrong: ['Mining hardware', 'Wallet brand names', 'Bitcoin address formats'] }
    ],
    'problems-of-money': [
        { q: '"Nixon Shock" in 1971 refers to:', a: 'The US ending the dollar\'s convertibility into gold', wrong: ['The launch of Bitcoin', 'A global stock market crash', 'The creation of the first bank'] },
        { q: 'Gresham\'s Law states that:', a: '"Bad money drives out good money"', wrong: ['"Bitcoin will replace fiat"', '"Gold is always better than silver"', '"Taxes are voluntary"'] }
    ],
    'investment-strategy': [
        { q: 'Lump-sum investing means:', a: 'Buying a large amount of Bitcoin all at once', wrong: ['Buying a fixed amount every week', 'Selling all your holdings', 'Trading only on weekends'] }
    ],
    'regulation': [
        { q: 'What is a "Self-Custody" regulation attempt?', a: 'Rules that try to force users to use custodial services', wrong: ['Laws that guarantee free Bitcoin', 'Mining equipment safety standards', 'Bitcoin price caps'] }
    ]
};

// Merge into QUESTION_BANK
for(const cat in NEW_BANK_QUESTIONS) {
    if(QUESTION_BANK[cat]) {
        NEW_BANK_QUESTIONS[cat].forEach(q => {
            if(!QUESTION_BANK[cat].some(p => p.q === q.q)) {
                QUESTION_BANK[cat].push(q);
            }
        });
    } else {
        QUESTION_BANK[cat] = NEW_BANK_QUESTIONS[cat];
    }
}


// =============================================
// EXPANSION PACK — 120+ new questions (March 2026)
// Covers missing channels + deeper content for existing ones
// =============================================
const NEW_BANK_QUESTIONS_2 = {
    'supranational': [
        { q: 'What does "supranational" mean in the context of Bitcoin?', a: 'It transcends national borders and governments', wrong: ['It is backed by the United Nations', 'It requires international approval to use', 'It can only be used between countries'] },
        { q: 'The Lindy Effect suggests that Bitcoin:', a: 'The longer it survives, the longer it is expected to survive', wrong: ['Will eventually be replaced by newer technology', 'Has a fixed expiration date coded into its protocol', 'Must be upgraded every 10 years to remain relevant'] },
        { q: 'Bitcoin settlement finality means:', a: 'Once confirmed, transactions cannot be reversed', wrong: ['Transactions can be disputed within 30 days', 'A central authority must approve each transaction', 'Only miners can verify if a transaction is final'] },
    
        { q: 'Why is Bitcoin considered "supranational" money?', a: 'It operates beyond any single nation\\\'s jurisdiction or control', wrong: ['It is owned by the UN', 'Only governments can use it', 'It requires international banking licenses'] },
        { q: 'What makes Bitcoin different from national currencies like the dollar or euro?', a: 'No central bank can print more or manipulate its supply', wrong: ['It is backed by gold reserves', 'It requires government approval', 'It only works online'] },
    ],
    'organic': [
        { q: 'Bitcoin grew organically because:', a: 'It had no pre-mine, no ICO, and no marketing budget', wrong: ['A major corporation funded its development', 'Governments agreed to adopt it simultaneously', 'Social media algorithms promoted it automatically'] },
        { q: 'What makes Bitcoin\'s distribution unique among cryptocurrencies?', a: 'Fair launch — no coins were pre-allocated to founders', wrong: ['Satoshi kept 50% of all coins before launch', 'Venture capitalists funded the initial distribution', 'Coins were distributed based on national GDP'] },
    
        { q: 'How has Bitcoin grown without traditional marketing?', a: 'Through grassroots adoption and word-of-mouth from users', wrong: ['Massive advertising budgets', 'Celebrity endorsements', 'Government subsidies'] },
        { q: 'What drives Bitcoin\\\'s organic adoption in developing countries?', a: 'Real need for inflation protection and remittance savings', wrong: ['Central bank mandates', 'Corporate marketing campaigns', 'Mandatory school education'] },
        { q: 'What is the role of Bitcoin\\\'s open source community?', a: 'Volunteer developers contribute code without corporate hierarchy', wrong: ['They control Bitcoin Foundation', 'They receive government salaries', 'They own all bitcoins'] },
    ],
    'programmable': [
        { q: 'Bitcoin Script is intentionally limited because:', a: 'Simplicity reduces attack surface and increases security', wrong: ['Satoshi was not a skilled programmer', 'The blockchain cannot process complex instructions', 'It was a temporary design meant to be upgraded'] },
        { q: 'What does "Turing-incomplete" mean for Bitcoin Script?', a: 'It cannot run arbitrary programs or infinite loops', wrong: ['It cannot process any transactions at all', 'It requires a separate computer to verify', 'It can only handle one transaction per block'] },
    
        { q: 'What makes Bitcoin programmable money?', a: 'Bitcoin Script enables conditional spending and smart contracts', wrong: ['Only banks can program it', 'It runs Python code directly', 'Central programmers control all transactions'] },
        { q: 'What are timelocks in Bitcoin?', a: 'Conditions preventing spending until a specific time or block height', wrong: ['Physical locks on hardware wallets', 'Password requirements', 'Banking hours restrictions'] },
        { q: 'What is a multisig (multi-signature) transaction?', a: 'Requires multiple private keys to authorize spending', wrong: ['Multiple transactions combined', 'Multiple miners confirming', 'Multiple exchanges involved'] },
    ],
    'difficulty-adjustment': [
        { q: 'Bitcoin\'s difficulty adjusts every:', a: '2,016 blocks (roughly every 2 weeks)', wrong: ['Every single block', 'Once per year', 'Every 210,000 blocks (at each halving)'] },
        { q: 'If miners leave the network, difficulty adjustment:', a: 'Lowers the difficulty so blocks are found at the target rate', wrong: ['Increases difficulty to punish remaining miners', 'Has no effect — blocks just take longer forever', 'Automatically doubles the block reward'] },
        { q: 'The target time between Bitcoin blocks is approximately:', a: '10 minutes', wrong: ['1 minute', '1 hour', '30 seconds'] },
    ],
    'nostr': [
        { q: 'Nostr is best described as:', a: 'A decentralized social protocol that cannot be censored', wrong: ['A Bitcoin wallet application', 'A new cryptocurrency competing with Bitcoin', 'An encrypted messaging app owned by a company'] },
        { q: 'Nostr uses cryptographic keys to:', a: 'Allow users to own their identity without a central authority', wrong: ['Mine new coins on the Nostr blockchain', 'Encrypt all messages so no one can read them', 'Create smart contracts between users'] },
        { q: 'How is Nostr connected to Bitcoin?', a: 'Many clients integrate Lightning for tips and payments', wrong: ['Nostr runs on the Bitcoin blockchain directly', 'You must own Bitcoin to create a Nostr account', 'Nostr mining validates Bitcoin transactions'] },
    ],
    'network_effects': [
        { q: 'Bitcoin\'s network effect means:', a: 'The more people who use it, the more valuable and useful it becomes', wrong: ['Mining becomes easier with more users', 'Transaction fees decrease as adoption grows', 'New coins are created when users join'] },
        { q: 'Metcalfe\'s Law applied to Bitcoin suggests:', a: 'Its value grows proportionally to the square of its users', wrong: ['The price will always increase linearly', 'Only the first users receive any benefit', 'Network effects only apply to social media'] },
    ],
    'ordinals': [
        { q: 'Bitcoin Ordinals allow:', a: 'Inscribing data (images, text) directly on individual satoshis', wrong: ['Creating new tokens on the Bitcoin network', 'Speeding up transaction confirmation times', 'Reducing the total supply of Bitcoin'] },
        { q: 'Why are Ordinals controversial in the Bitcoin community?', a: 'They increase block space demand and fees for financial transactions', wrong: ['They change the 21 million supply cap', 'They require a hard fork to implement', 'They give miners control over which transactions are valid'] },
    
        { q: 'What are Bitcoin Ordinals?', a: 'A numbering system for satoshis enabling inscription of arbitrary data', wrong: ['A type of altcoin token', 'A mining algorithm', 'A Lightning channel type'] },
        { q: 'What controversial use case emerged from Ordinals?', a: 'BRC-20 tokens creating fungible tokens on Bitcoin', wrong: ['Instant payment settlement', 'Hardware wallet security', 'Private key encryption'] },
        { q: 'What is the debate around Ordinals inscriptions?', a: 'They use block space, potentially raising fees for regular transactions', wrong: ['They steal bitcoin from wallets', 'They hack the blockchain', 'They prevent mining from working'] },
    ],
    'geopolitics___macroeconomics': [
        { q: 'Why is Bitcoin relevant to geopolitics?', a: 'It provides a neutral monetary system outside any nation\'s control', wrong: ['Major governments collectively control Bitcoin\'s code', 'Bitcoin mining is only legal in 5 countries', 'The UN regulates Bitcoin\'s international transfers'] },
        { q: 'What is the "petrodollar" system?', a: 'Oil is priced in US dollars, forcing global demand for the dollar', wrong: ['A cryptocurrency backed by oil reserves', 'A Bitcoin mining technique using petroleum', 'A tax imposed on Bitcoin by oil-producing nations'] },
    
        { q: 'Which country was the first to adopt Bitcoin as legal tender?', a: 'El Salvador in September 2021', wrong: ['United States', 'Japan', 'Germany'] },
        { q: 'How do sanctions-evading nations view Bitcoin?', a: 'As a way to circumvent SWIFT restrictions and frozen reserves', wrong: ['As a threat to their currencies', 'As a US surveillance tool', 'As illegal everywhere'] },
        { q: 'What macro trend drives Bitcoin adoption during inflation?', a: 'Currency debasement making bitcoin\\\'s fixed supply attractive', wrong: ['Lower interest rates on bitcoin', 'Government bitcoin subsidies', 'Bank account requirements'] },
    ],
    'human_rights__social_justice_and_freedo': [
        { q: 'How does Bitcoin help people under authoritarian regimes?', a: 'It provides censorship-resistant money that governments cannot freeze', wrong: ['It automatically reports suspicious activity to authorities', 'It requires government ID to transact', 'It only works in democratic countries'] },
        { q: 'Alex Gladstein of the Human Rights Foundation argues that:', a: 'Bitcoin is the most important tool for financial freedom globally', wrong: ['Only wealthy nations benefit from Bitcoin', 'Bitcoin should be controlled by human rights organizations', 'Proof of Stake is better for human rights than Proof of Work'] },
    ],
    'maximalism': [
        { q: 'Bitcoin maximalism is the belief that:', a: 'Bitcoin is the only cryptocurrency that truly matters', wrong: ['Every cryptocurrency is equally valuable', 'Bitcoin should be controlled by a single organization', 'Multiple blockchains should merge into Bitcoin'] },
        { q: 'Why do deep Bitcoin researchers tend to become maximalists?', a: 'They realize no other project achieves true decentralization and immutability', wrong: ['They are paid by Bitcoin companies to promote it', 'They lack knowledge of other technologies', 'It is required to participate in the Bitcoin community'] },
    ],
    'austrian_school_of_economics': [
        { q: 'The Austrian School of Economics emphasizes:', a: 'Sound money, free markets, and the dangers of central banking', wrong: ['Government control of all monetary systems', 'That inflation is beneficial for economic growth', 'That central banks should print unlimited money'] },
        { q: 'Who wrote "The Theory of Money and Credit"?', a: 'Ludwig von Mises', wrong: ['John Maynard Keynes', 'Paul Krugman', 'Adam Smith'] },
        { q: 'Bitcoin aligns with Austrian economics because:', a: 'It has a fixed supply and cannot be debased by any authority', wrong: ['It was invented by an Austrian economist', 'The Austrian government officially endorses it', 'It uses the Austrian Schilling as its base currency'] },
    ],
    'softwar': [
        { q: 'Jason Lowery\'s "Softwar" thesis argues that:', a: 'Proof of Work is a form of power projection in cyberspace, analogous to physical warfare', wrong: ['Bitcoin should be used to fund military operations', 'Proof of Stake is militarily superior to Proof of Work', 'Software companies should replace national armies'] },
    ],
    'time_preference': [
        { q: 'What is "low time preference" in Bitcoin culture?', a: 'Prioritizing long-term saving over short-term spending', wrong: ['Trading Bitcoin frequently for quick profits', 'Spending all your Bitcoin before the next halving', 'Checking the price every 5 minutes'] },
        { q: 'A Bitcoin standard encourages low time preference because:', a: 'Saving is rewarded since the money appreciates over time', wrong: ['Bitcoin transactions are extremely slow', 'The government mandates holding periods', 'You can only sell Bitcoin once per year'] },
    ],
    'evidence-against-alts': [
        { q: 'Why do Bitcoiners say "there is no second best"?', a: 'No other crypto achieves Bitcoin\'s decentralization, security, and immutability', wrong: ['Bitcoin was the first, so it automatically wins', 'The SEC has declared all other cryptos illegal', 'Satoshi patented the blockchain concept'] },
        { q: 'What is a "pre-mine" and why is it concerning?', a: 'Founders allocate coins to themselves before public launch — unfair distribution', wrong: ['A technique to speed up transaction processing', 'A security measure that protects the network', 'A method of testing the blockchain before launch'] },
        { q: 'Most altcoins are considered securities because:', a: 'They have identifiable teams profiting from token sales with promises of returns', wrong: ['They use the same code as Bitcoin', 'The SEC approves them as securities automatically', 'They are traded on stock exchanges'] },
    ],
    'fedimints': [
        { q: 'A Fedimint (Federated Mint) provides:', a: 'Community-custodial privacy through Chaumian ecash on Bitcoin', wrong: ['A new type of Bitcoin mining pool', 'A government-approved Bitcoin exchange', 'A way to increase Bitcoin\'s supply above 21 million'] },
        { q: 'Fedimints improve Bitcoin privacy by:', a: 'Using blinded signatures so the mint cannot link deposits to withdrawals', wrong: ['Deleting transaction data from the blockchain', 'Requiring all users to share their identity', 'Converting Bitcoin into a different cryptocurrency'] },
    ],
    'chaumian-mints': [
        { q: 'Cashu is:', a: 'An ecash protocol built on Bitcoin using Chaumian blind signatures', wrong: ['A competing cryptocurrency to Bitcoin', 'A hardware wallet manufacturer', 'A type of Bitcoin mining software'] },
        { q: 'What are "blind signatures" in ecash?', a: 'The mint signs tokens without knowing which user they belong to', wrong: ['Signatures that expire after 24 hours', 'A way to sign transactions without a private key', 'Signatures that can only be verified by the government'] },
    ],
    'op-codes': [
        { q: 'Bitcoin OP_CODES are:', a: 'Instructions in Bitcoin\'s scripting language that define spending conditions', wrong: ['Error codes returned when a transaction fails', 'Codes used to communicate between mining pools', 'Secret backdoor commands for Bitcoin developers'] },
        { q: 'OP_RETURN allows:', a: 'Embedding small amounts of arbitrary data in the blockchain', wrong: ['Reversing a confirmed transaction', 'Returning stolen Bitcoin to its owner', 'Increasing the block size limit'] },
    
        { q: 'What is OP_CHECKSIG in Bitcoin Script?', a: 'Verifies a digital signature against a public key', wrong: ['Creates new bitcoins', 'Encrypts transaction data', 'Connects to mining pools'] },
        { q: 'What was the OP_RETURN controversy?', a: 'Its limit was reduced to prevent blockchain bloat from non-financial data', wrong: ['It was used to hack exchanges', 'It created unlimited bitcoins', 'It stopped all transactions'] },
        { q: 'What did Taproot enable for Bitcoin opcodes?', a: 'More flexible scripting through Schnorr signatures and Merkle branches', wrong: ['Removal of all previous scripts', 'Conversion to Ethereum compatibility', 'Centralized script approval'] },
    ],
    'consensus': [
        { q: 'Nakamoto Consensus achieves agreement by:', a: 'Having nodes follow the longest valid proof-of-work chain', wrong: ['Requiring all nodes to vote on each transaction', 'Letting the wealthiest node decide which blocks are valid', 'Using a central server to broadcast the correct chain'] },
        { q: 'What happens if two miners find a valid block at nearly the same time?', a: 'A temporary fork occurs and resolves when the next block is found', wrong: ['Both blocks are permanently added to the chain', 'The network shuts down until the conflict is resolved', 'The older miner\'s block always wins'] },
    ],
    'governance': [
        { q: 'How is Bitcoin governed?', a: 'Through rough consensus among users, developers, miners, and node operators', wrong: ['By a board of directors at the Bitcoin Foundation', 'Through shareholder voting like a corporation', 'By whoever owns the most Bitcoin'] },
        { q: 'A BIP (Bitcoin Improvement Proposal) is:', a: 'A formal document proposing changes to Bitcoin\'s protocol or processes', wrong: ['A mandatory update that all nodes must accept', 'A financial investment in Bitcoin development', 'A bug report filed to the Bitcoin support team'] },
    ],
    'open_source': [
        { q: 'Bitcoin\'s code being open source means:', a: 'Anyone can read, audit, copy, and propose changes to the code', wrong: ['Anyone can change the live network\'s rules', 'The code has no copyright protection', 'Only open-source developers can own Bitcoin'] },
    ],
    'submarine_swap': [
        { q: 'A submarine swap allows:', a: 'Trustlessly exchanging on-chain Bitcoin for Lightning Bitcoin', wrong: ['Mining Bitcoin underwater for cooling efficiency', 'Sending Bitcoin without an internet connection', 'Converting Bitcoin into a different cryptocurrency'] },
    ],
    'market_cap': [
        { q: 'Bitcoin\'s market capitalization represents:', a: 'The total value of all existing Bitcoin at the current price', wrong: ['The maximum number of coins that can ever exist', 'The amount of money invested in Bitcoin mining', 'The total transaction volume over the past year'] },
        { q: 'If Bitcoin captured gold\'s market cap, each coin would be worth approximately:', a: 'Over $500,000', wrong: ['$100,000', '$50,000', '$10,000'] },
    ],
    'orange-pilling': [
        { q: '"Orange-pilling" someone means:', a: 'Helping them understand why Bitcoin matters', wrong: ['Forcing them to buy Bitcoin immediately', 'Sending them unsolicited Bitcoin transactions', 'Signing them up for a Bitcoin exchange without consent'] },
        { q: 'The most effective orange-pilling strategy is:', a: 'Meeting people where they are and addressing their specific concerns', wrong: ['Posting price predictions on social media', 'Telling people they are stupid for not buying', 'Promising guaranteed financial returns'] },
    ],
    'the_future': [
        { q: 'Hyperbitcoinization refers to:', a: 'The theoretical tipping point where Bitcoin becomes the dominant global money', wrong: ['A Bitcoin price crash of over 90%', 'The moment when all 21 million coins are mined', 'A software bug that causes infinite Bitcoin creation'] },
        { q: 'What happens when the last Bitcoin is mined (~2140)?', a: 'Miners will be compensated solely through transaction fees', wrong: ['The network will shut down permanently', 'A new supply of 21 million coins will be created', 'Mining will become free with no reward'] },
    ],
    'public_key_vs_private_key': [
        { q: 'Your Bitcoin public key is like:', a: 'Your email address — you share it so people can send you Bitcoin', wrong: ['Your password — never share it with anyone', 'Your bank PIN number — used to authorize spending', 'Your social security number — it proves your identity'] },
        { q: 'If someone has your private key, they can:', a: 'Spend all the Bitcoin controlled by that key', wrong: ['Only view your transaction history', 'Reset your password and lock you out', 'Create new Bitcoin out of thin air'] },
    
        { q: 'What is the relationship between private and public keys?', a: 'Public keys are derived from private keys via one-way cryptographic function', wrong: ['Private keys are given to everyone', 'Public keys encrypt private keys', 'They are identical numbers'] },
        { q: 'What should you do with your private keys?', a: 'Keep them secret and secure, never share with anyone', wrong: ['Publish them online', 'Email them to exchanges', 'Print them on merchandise'] },
        { q: 'What is the purpose of a public key?', a: 'To receive bitcoin and verify signatures without revealing the private key', wrong: ['To spend bitcoin alone', 'To mine new blocks', 'To create private keys'] },
    ],
    'transaction_fees': [
        { q: 'Bitcoin transaction fees are determined by:', a: 'The size of the transaction in bytes and current network demand', wrong: ['A fixed percentage of the transaction amount', 'The number of Bitcoin being sent', 'The geographic distance between sender and receiver'] },
        { q: 'When the mempool is full:', a: 'Transactions with higher fees get confirmed first', wrong: ['All transactions are rejected until it clears', 'The block size automatically increases', 'Transaction fees are refunded to senders'] },
    
        { q: 'What determines Bitcoin transaction fees?', a: 'Transaction size in bytes and current network demand (mempool congestion)', wrong: ['Transaction amount in bitcoin', 'Sender\\\'s reputation', 'Government regulation'] },
        { q: 'What is the mempool?', a: 'A waiting area for unconfirmed transactions held by nodes', wrong: ['A mining hardware pool', 'A cryptocurrency exchange', 'A type of Bitcoin wallet'] },
        { q: 'Why do fees spike during network congestion?', a: 'Users compete for limited block space by bidding higher fees', wrong: ['Miners arbitrarily raise prices', 'Exchanges charge extra', 'Bitcoin supply decreases'] },
    ],
    'philosophy': [
        { q: '"Don\'t trust, verify" means:', a: 'Run your own node to independently verify all Bitcoin rules', wrong: ['Never use Bitcoin because it cannot be trusted', 'Only trust exchanges that are government-regulated', 'Verify your identity before making transactions'] },
        { q: 'The concept "Bitcoin is Time" by Gigi suggests:', a: 'Bitcoin creates a decentralized clock through proof of work', wrong: ['Bitcoin transactions can travel back in time', 'Bitcoin was invented to save people time', 'Bitcoin mining uses atomic clocks'] },
    
        { q: 'What is the cypherpunk movement that birthed Bitcoin?', a: 'Advocates for privacy through cryptography and code over trust', wrong: ['Bankers wanting digital currency', 'Gamers creating virtual money', 'Governments tracking transactions'] },
        { q: 'What does "don\\\'t trust, verify" mean in Bitcoin?', a: 'Run your own node to validate transactions rather than trusting third parties', wrong: ['Trust banks with your bitcoin', 'Verify your email address', 'Don\\\'t check transactions yourself'] },
        { q: 'What does Bitcoin\\\'s "monetary policy" refer to?', a: 'Fixed supply schedule with predictable issuance rate until 21 million', wrong: ['Central bank interest rates', 'Government fiscal policy', 'Investment fund strategies'] },
    ],
    'halving': [
        { q: 'The Bitcoin halving occurs every:', a: '210,000 blocks (approximately every 4 years)', wrong: ['Every calendar year on January 3', 'Every 100,000 blocks', 'Whenever the price doubles'] },
        { q: 'After the 2024 halving, the block reward is:', a: '3.125 BTC per block', wrong: ['6.25 BTC per block', '1.5625 BTC per block', '50 BTC per block'] },
        { q: 'The halving is significant because it:', a: 'Mathematically enforces Bitcoin\'s decreasing supply issuance', wrong: ['Doubles the total supply of Bitcoin', 'Reduces the number of active miners by half', 'Changes Bitcoin\'s consensus mechanism'] },
    
        { q: 'What happens during a Bitcoin halving?', a: 'Block reward paid to miners is cut in half', wrong: ['Transaction fees double', 'Bitcoin supply doubles', 'Mining difficulty halves'] },
        { q: 'When will the final bitcoin be mined?', a: 'Around year 2140 when all 21 million are issued', wrong: ['2025', '2040', 'Never — mining continues forever'] },
    ],
    'books': [
        { q: '"The Bitcoin Standard" by Saifedean Ammous primarily argues:', a: 'Bitcoin is the hardest money ever invented and will replace fiat', wrong: ['Bitcoin is a useful technology but too volatile to be money', 'Gold is still superior to Bitcoin as a store of value', 'Central banks should adopt Bitcoin as a reserve currency'] },
        { q: 'Gigi\'s "21 Lessons" is structured around:', a: '21 philosophical, economic, and technical lessons learned from Bitcoin', wrong: ['A 21-day guide to becoming a Bitcoin trader', 'The 21 richest Bitcoin holders and their strategies', 'The history of 21 failed cryptocurrencies'] },
    ],
    'satoshi-nakamoto': [
        { q: 'Why is it important that Satoshi Nakamoto disappeared?', a: 'Bitcoin has no leader who can be arrested, corrupted, or pressured', wrong: ['Because they were wanted by law enforcement', 'So they could secretly accumulate more Bitcoin', 'Because the code was finished and needed no more work'] },
        { q: 'Satoshi\'s estimated Bitcoin holdings are approximately:', a: '~1 million BTC, which have never been moved', wrong: ['50,000 BTC, all of which were donated', 'Zero — Satoshi gave away all their coins', '10 million BTC stored in a special wallet'] },
    ],
    'stablecoins': [
        { q: 'Stablecoins are NOT a threat to Bitcoin because:', a: 'They are centralized IOUs that can be frozen, while Bitcoin is permissionless', wrong: ['Stablecoins use the same technology as Bitcoin', 'Bitcoin automatically converts to stablecoins during crashes', 'Stablecoins have a higher market cap than Bitcoin'] },
    ],
    'risks__threats__attack_vectors__weaknes': [
        { q: 'A 51% attack would require:', a: 'Controlling more than half of Bitcoin\'s total mining hash rate', wrong: ['Owning 51% of all existing Bitcoin', 'Having 51% of all Bitcoin nodes vote together', 'Hacking 51% of Bitcoin wallets simultaneously'] },
        { q: 'Why is a 51% attack impractical against Bitcoin?', a: 'The hash rate is so massive it would cost billions and be unprofitable', wrong: ['Because Bitcoin automatically detects and blocks attacks', 'Because Satoshi built in a secret defense mechanism', 'Because only 21 mining pools exist worldwide'] },
        { q: 'Quantum computing threatens Bitcoin by potentially:', a: 'Breaking ECDSA signatures used to authorize spending', wrong: ['Mining all remaining Bitcoin in seconds', 'Deleting the entire blockchain', 'Creating unlimited new Bitcoin addresses'] },
    ],
    'coin_mixing_coinjoin_coin_control_utxo': [
        { q: 'A CoinJoin transaction improves privacy by:', a: 'Combining multiple users\' inputs and outputs so links between them are broken', wrong: ['Encrypting the Bitcoin blockchain so nobody can read it', 'Sending Bitcoin through a centralized mixing server', 'Converting Bitcoin to a different cryptocurrency and back'] },
    ],
    'whitepaper': [
        { q: 'The Bitcoin whitepaper solved what previously unsolvable problem?', a: 'Digital scarcity without a trusted third party', wrong: ['Faster internet speeds', 'Quantum-proof encryption', 'Free worldwide communication'] },
        { q: 'What did Satoshi embed in the Genesis Block\'s coinbase transaction?', a: 'A newspaper headline about bank bailouts', wrong: ['Their real name', 'A mathematical formula', 'Instructions for miners'] },
    ],
    'mining': [
        { q: 'Bitcoin mining is best described as:', a: 'A brute-force lottery of guessing nonces until a valid hash is found', wrong: ['Solving complex mathematical equations', 'Running an algorithm that factors large prime numbers', 'Decrypting encrypted transaction data'] },
        { q: 'What is the "nonce" in Bitcoin mining?', a: 'A number miners change each guess to find a hash below the target', wrong: ['The name for a new block', 'A fee paid to the network', 'A type of mining hardware'] },
        { q: 'Why does Bitcoin mining use so much energy?', a: 'Energy expenditure is what gives Bitcoin its security — it makes attacks prohibitively expensive', wrong: ['The code is poorly optimized', 'Miners are required to run 24/7 by law', 'Each transaction requires its own mining operation'] },
        { q: 'What is a mining pool?', a: 'A group of miners who combine hash power and share rewards proportionally', wrong: ['A physical pool where mining hardware is cooled', 'A government-regulated mining operation', 'A savings account for miners'] },
    ],
    'self-custody': [
        { q: 'A hardware wallet provides security by:', a: 'Keeping private keys on a dedicated device that never exposes them to the internet', wrong: ['Storing Bitcoin inside the physical device', 'Encrypting the blockchain so only you can read it', 'Requiring government approval for each transaction'] },
        { q: 'If you lose your hardware wallet but have your seed phrase, you can:', a: 'Recover all your Bitcoin on a new wallet using the seed phrase', wrong: ['Nothing — the Bitcoin is permanently lost', 'Contact the wallet manufacturer for a replacement', 'File a claim with Bitcoin insurance'] },
        { q: 'Multisig (multi-signature) wallets require:', a: 'Multiple keys to authorize a transaction (e.g., 2-of-3)', wrong: ['Multiple Bitcoin addresses to send from', 'Multiple confirmations from the same key', 'Multiple mining pools to verify'] },
    ],
    'layer-2-lightning': [
        { q: 'Lightning Network payment channels work by:', a: 'Opening a channel with an on-chain transaction, then transacting off-chain instantly', wrong: ['Creating a separate blockchain for each payment', 'Sending Bitcoin through email servers', 'Using proof of stake instead of proof of work'] },
        { q: 'Why is Lightning considered a Layer 2 solution?', a: 'It builds on top of Bitcoin\'s base layer without changing the protocol', wrong: ['Because it is the second cryptocurrency ever created', 'Because it requires two confirmations per transaction', 'Because only two people can use it at a time'] },
        { q: 'A Lightning invoice is:', a: 'A payment request containing the amount, destination, and expiry time', wrong: ['A monthly bill for using the Lightning Network', 'A receipt showing your mining rewards', 'A document required by tax authorities'] },
    ],
    'privacy-nonkyc': [
        { q: 'KYC (Know Your Customer) in Bitcoin refers to:', a: 'Identity verification required by regulated exchanges', wrong: ['A type of encryption algorithm', 'A consensus mechanism used by altcoins', 'The name of a Bitcoin wallet'] },
        { q: 'Why do some Bitcoiners prefer non-KYC acquisition?', a: 'To protect financial privacy and avoid linking identity to Bitcoin holdings', wrong: ['Because it is cheaper than using exchanges', 'Because KYC Bitcoin is worth less', 'Because non-KYC Bitcoin mines faster'] },
    ],
    'blockchain-timechain': [
        { q: 'Satoshi originally called the blockchain the:', a: 'Timechain', wrong: ['Hashchain', 'Blockweb', 'Cryptoledger'] },
        { q: 'Each Bitcoin block contains a reference to:', a: 'The hash of the previous block, creating an unbreakable chain', wrong: ['The next block that will be mined', 'All future transactions that will occur', 'A backup of the entire blockchain'] },
        { q: 'The mempool is:', a: 'A waiting area where unconfirmed transactions sit until miners include them in a block', wrong: ['A type of Bitcoin storage device', 'The total amount of memory used by Bitcoin nodes', 'A pool of memory shared between mining hardware'] },
    ],
    'scalability': [
        { q: 'Bitcoin\'s block size is limited to approximately:', a: '1-4 MB (with SegWit)', wrong: ['100 MB', 'Unlimited — it grows with demand', '1 KB'] },
        { q: 'Bitcoin scales primarily through:', a: 'Layered solutions like Lightning rather than increasing block size', wrong: ['Simply making blocks bigger indefinitely', 'Reducing the number of nodes', 'Using faster internet connections'] },
    ],
    'taproot': [
        { q: 'Taproot was activated on Bitcoin in:', a: 'November 2021', wrong: ['January 2009', 'August 2017', 'April 2024'] },
        { q: 'Taproot improves Bitcoin by:', a: 'Enhancing privacy, efficiency, and smart contract capabilities using Schnorr signatures', wrong: ['Increasing the total supply above 21 million', 'Removing the need for mining', 'Making all transactions completely anonymous'] },
    ],
    'soft_vs_hard_forks': [
        { q: 'The key difference between a soft fork and a hard fork is:', a: 'Soft forks are backwards-compatible; hard forks are not', wrong: ['Soft forks are temporary; hard forks are permanent', 'Soft forks require less code; hard forks need more', 'Soft forks are approved by vote; hard forks by mining'] },
        { q: 'The Blocksize Wars resulted in:', a: 'Bitcoin Cash splitting off as a hard fork while Bitcoin kept small blocks + SegWit', wrong: ['Bitcoin doubling its block size to 2 MB', 'All miners switching to Bitcoin Cash', 'The creation of Ethereum'] },
    ],
    'regulation': [
        { q: 'Can a government effectively ban Bitcoin?', a: 'They can restrict fiat on-ramps but cannot stop peer-to-peer transactions', wrong: ['Yes — turning off the internet kills Bitcoin permanently', 'Yes — all nodes can be identified and shut down simultaneously', 'No bans have ever been attempted by any country'] },
        { q: 'China has banned Bitcoin mining multiple times, yet:', a: 'Miners relocated and the network hash rate recovered within months', wrong: ['Bitcoin permanently lost 50% of its value', 'All Chinese Bitcoin was confiscated', 'The Bitcoin network was offline for weeks'] },
    ],
    'energy': [
        { q: 'Bitcoin mining primarily uses which type of energy?', a: 'Over 50% renewable — often stranded or wasted energy', wrong: ['100% coal and natural gas', 'Nuclear power exclusively', 'Solar panels attached to mining rigs'] },
        { q: 'Bitcoin mining can actually help the environment by:', a: 'Monetizing flared methane that would otherwise be released into the atmosphere', wrong: ['Reducing the total electricity consumed worldwide', 'Creating new renewable energy out of thin air', 'Cooling the planet through heat dissipation'] },
    ],
    'investment-strategy': [
        { q: 'Dollar Cost Averaging (DCA) means:', a: 'Buying a fixed amount of Bitcoin at regular intervals regardless of price', wrong: ['Only buying when the price drops below a target', 'Investing your entire savings at once', 'Selling Bitcoin every time it rises 10%'] },
        { q: 'The Bitcoin phrase "zoom out" means:', a: 'Look at the long-term price trend instead of daily volatility', wrong: ['Reduce your Bitcoin position size', 'Use a magnifying glass to read the whitepaper', 'Exit the market during a downturn'] },
    ],
    'problems-of-money': [
        { q: 'The Cantillon Effect describes how:', a: 'Those closest to newly created money benefit most, widening inequality', wrong: ['Bitcoin mining becomes more difficult over time', 'Interest rates affect mortgage payments', 'Tax policy reduces the wealth gap'] },
        { q: 'What happened in 1971?', a: 'Nixon ended the gold standard, allowing unlimited fiat money printing', wrong: ['Bitcoin was invented', 'The first digital computer was built', 'The Euro was introduced'] },
        { q: 'Inflation is often called a "hidden tax" because:', a: 'It silently erodes the purchasing power of your savings', wrong: ['The IRS taxes Bitcoin gains at a hidden rate', 'Banks charge fees that are not disclosed', 'Governments print money in secret locations'] },
    ],
    '_general': [
        { q: 'What is the total number of satoshis that will ever exist?', a: '2.1 quadrillion (2,100,000,000,000,000)', wrong: ['21 million', '100 billion', '21 quadrillion'] },
        { q: 'Bitcoin Pizza Day is celebrated on:', a: 'May 22', wrong: ['January 3', 'October 31', 'April 15'] },
        { q: 'The first Bitcoin exchange rate was established at approximately:', a: '$0.00099 per BTC (less than one penny)', wrong: ['$1.00 per BTC', '$0.10 per BTC', '$100 per BTC'] },
        { q: 'HODL originated from:', a: 'A misspelled Bitcoin forum post from 2013 ("I AM HODLING")', wrong: ['An acronym created by a Bitcoin company', 'A Japanese word meaning "to hold"', 'A technical term in Bitcoin\'s source code'] },
        { q: 'The phrase "Not your keys, not your coins" warns against:', a: 'Keeping Bitcoin on exchanges where you don\'t control the private keys', wrong: ['Using physical Bitcoin coins instead of digital', 'Sharing your public key with other people', 'Using hardware wallets instead of software'] },
    ],
};

// Merge expansion pack into QUESTION_BANK
for(const cat in NEW_BANK_QUESTIONS_2) {
    if(QUESTION_BANK[cat]) {
        NEW_BANK_QUESTIONS_2[cat].forEach(q => {
            if(!QUESTION_BANK[cat].some(p => p.q === q.q)) {
                QUESTION_BANK[cat].push(q);
            }
        });
    } else {
        QUESTION_BANK[cat] = NEW_BANK_QUESTIONS_2[cat];
    }
}

// ---- OPENCLAW EXPORTS ----
if (typeof startQuestManual !== "undefined") window.startQuestManual = startQuestManual;
// ============================================================
// QUEST HUB — Quiz / Trivia / Poll tabs
// ============================================================

window._questHubTab = 'quiz';

window.showQuestHub = function() {
    // Remove existing
    var existing = document.getElementById('questHubOverlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'questHubOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.88);z-index:100000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);padding:20px;animation:nachoPop 0.25s ease;';
    overlay.onclick = function(e) { if (e.target === overlay) { window._cleanupRaidBoss(); overlay.remove(); } };

    var modal = document.createElement('div');
    modal.style.cssText = 'background:var(--bg-side,#141425);border:1px solid var(--border);width:100%;max-width:520px;max-height:85vh;border-radius:24px;overflow:hidden;display:flex;flex-direction:column;position:relative;';

    // Header
    var header = document.createElement('div');
    header.style.cssText = 'padding:20px 24px 0;flex-shrink:0;';
    header.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
        '<div><h2 style="margin:0;color:var(--heading);font-size:1.3rem;">⚔️ Quest Hub</h2>' +
        '<div style="color:var(--text-muted);font-size:0.8rem;margin-top:4px;">Earn XP by testing your Bitcoin knowledge</div></div>' +
        '<button onclick="window._cleanupRaidBoss();document.getElementById(\'questHubOverlay\').remove()" style="background:none;border:none;color:var(--text-muted);font-size:1.5rem;cursor:pointer;padding:4px;">✕</button></div>' +
        // Tabs
        '<div id="questHubTabs" style="display:flex;gap:8px;margin-bottom:16px;">' +
        '<button id="qhTabQuiz" onclick="window._questHubTab=\'quiz\';_renderQuestHubTab()" style="flex:1;padding:10px 0;border-radius:12px;border:1px solid var(--border);background:none;color:var(--text-muted);font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">📝 Quiz</button>' +
        '<button id="qhTabTrivia" onclick="window._questHubTab=\'trivia\';_renderQuestHubTab()" style="flex:1;padding:10px 0;border-radius:12px;border:1px solid var(--border);background:none;color:var(--text-muted);font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">🧠 Trivia</button>' +
        '<button id="qhTabPoll" onclick="window._questHubTab=\'poll\';_renderQuestHubTab()" style="flex:1;padding:10px 0;border-radius:12px;border:1px solid var(--border);background:none;color:var(--text-muted);font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">📊 Poll</button>' +
        '<button id="qhTabRaid" onclick="window._questHubTab=\'raid\';_renderQuestHubTab()" style="flex:1;padding:10px 0;border-radius:12px;border:1px solid var(--border);background:none;color:var(--text-muted);font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">⚔️ Raid</button>' +
        '</div>';

    var body = document.createElement('div');
    body.id = 'questHubBody';
    body.style.cssText = 'padding:0 24px 24px;overflow-y:auto;flex:1;';

    modal.appendChild(header);
    modal.appendChild(body);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    _renderQuestHubTab();
};

function _renderQuestHubTab() {
    var tab = window._questHubTab || 'quiz';
    // Update active tab styles
    ['Quiz', 'Trivia', 'Poll', 'Raid'].forEach(function(t) {
        var btn = document.getElementById('qhTab' + t);
        if (!btn) return;
        var isActive = tab === t.toLowerCase();
        var raidActive = t === 'Raid' && isActive;
        btn.style.background = raidActive ? 'linear-gradient(135deg,#8b5cf6,#7c3aed)' : (isActive ? 'var(--accent)' : 'none');
        btn.style.color = isActive ? '#fff' : 'var(--text-muted)';
        btn.style.borderColor = raidActive ? '#8b5cf6' : (isActive ? 'var(--accent)' : 'var(--border)');
    });

    var body = document.getElementById('questHubBody');
    if (!body) return;

    // Cleanup raid listeners when switching away
    if (tab !== 'raid') window._cleanupRaidBoss();

    if (tab === 'quiz') _renderQuizTab(body);
    else if (tab === 'trivia') _renderTriviaTab(body);
    else if (tab === 'poll') _renderPollTab(body);
    else if (tab === 'raid') _renderRaidTab(body);
}

// ── QUIZ TAB (existing system) ──
function _renderQuizTab(body) {
    var todayKey = new Date().toISOString().split('T')[0];
    var qLog = safeJSON('btc_quest_daily', {});
    var completedToday = (qLog.date === todayKey) ? qLog.count : 0;
    var completed = completedQuests ? completedQuests.size : 0;

    body.innerHTML = '<div style="text-align:center;padding:16px 0;">' +
        '<div style="font-size:2.5rem;margin-bottom:8px;">📝</div>' +
        '<div style="font-size:1.1rem;font-weight:800;color:var(--heading);margin-bottom:4px;">Quiz Quests</div>' +
        '<div style="color:var(--text-muted);font-size:0.82rem;margin-bottom:16px;">5-question quizzes on Bitcoin topics</div>' +
        '<div style="display:flex;justify-content:center;gap:20px;margin-bottom:20px;">' +
            '<div style="text-align:center;"><div style="font-size:1.2rem;font-weight:800;color:var(--accent);">' + completedToday + '</div><div style="font-size:0.7rem;color:var(--text-faint);">Today</div></div>' +
            '<div style="text-align:center;"><div style="font-size:1.2rem;font-weight:800;color:var(--heading);">' + completed + '</div><div style="font-size:0.7rem;color:var(--text-faint);">All Time</div></div>' +
        '</div>' +
        '<div style="display:flex;justify-content:center;gap:12px;margin-bottom:12px;">' +
            '<div style="padding:6px 14px;background:rgba(34,197,94,0.1);border-radius:8px;font-size:0.75rem;color:#22c55e;font-weight:700;">3+ correct = 50 XP</div>' +
            '<div style="padding:6px 14px;background:rgba(247,147,26,0.1);border-radius:8px;font-size:0.75rem;color:#f7931a;font-weight:700;">Perfect = 100 XP</div>' +
        '</div>' +
        '<button onclick="document.getElementById(\'questHubOverlay\').remove();setTimeout(function(){if(typeof _showQuestTopicPicker===\'function\')_showQuestTopicPicker();else if(typeof startQuestManual===\'function\')startQuestManual()},200)" style="padding:14px 32px;background:linear-gradient(135deg,#f7931a,#e8720c);border:none;border-radius:14px;color:#fff;font-size:1rem;font-weight:800;cursor:pointer;font-family:inherit;letter-spacing:0.5px;transition:0.2s;">Start Quiz Quest ⚔️</button>' +
    '</div>';
}

// ============================================================
// TRIVIA QUEST SYSTEM — 1 per day, standalone question
// ============================================================

function _getTriviaToday() {
    if (typeof TRIVIA_BANK === 'undefined' || !TRIVIA_BANK || !TRIVIA_BANK.length) return null;
    // Deterministic daily rotation: day-of-year * year seed
    var now = new Date();
    var start = new Date(now.getFullYear(), 0, 0);
    var dayOfYear = Math.floor((now - start) / 86400000);
    var seed = (dayOfYear * 7 + now.getFullYear()) % TRIVIA_BANK.length;
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
    var todayKey = new Date().toISOString().split('T')[0];
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
            html += '<div style="padding:12px 16px;background:' + bg + ';border:2px solid ' + border + ';border-radius:12px;color:var(--text);font-size:0.85rem;font-weight:600;display:flex;align-items:center;gap:10px;opacity:' + (isCorrect || wasChosen ? '1' : '0.5') + ';">' +
                '<span style="min-width:22px;height:22px;border-radius:50%;border:2px solid ' + border + ';display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:800;color:var(--text-faint);">' + String.fromCharCode(65 + i) + '</span>' +
                optText + (icon ? '<span style="margin-left:auto;">' + icon + '</span>' : '') +
            '</div>';
        } else {
            html += '<button onclick="triviaAnswer(' + i + ')" style="padding:12px 16px;background:var(--card-bg,#1a1a2e);border:2px solid var(--border);border-radius:12px;color:var(--text);font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit;text-align:left;transition:all 0.2s;display:flex;align-items:center;gap:10px;">' +
                '<span style="min-width:22px;height:22px;border-radius:50%;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:800;color:var(--text-faint);">' + String.fromCharCode(65 + i) + '</span>' +
                optText +
            '</button>';
        }
    }
    html += '</div>';

    // Show explanation if answered
    if (answered) {
        html += '<div style="margin-top:16px;padding:16px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:12px;">' +
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
    var todayKey = new Date().toISOString().split('T')[0];
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
    if (typeof window._raidOnXPEarned === 'function') window._raidOnXPEarned(xp);

    // Also sync to Firestore for signed-in users
    if (typeof db !== 'undefined' && typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) {
        db.collection('users').doc(auth.currentUser.uid).update({
            lastTriviaDate: todayKey,
            triviaAnswered: firebase.firestore.FieldValue.increment(1),
            triviaCorrect: firebase.firestore.FieldValue.increment(isCorrect ? 1 : 0)
        }).catch(function() {});
    }

    // Re-render to show result
    var body = document.getElementById('questHubBody');
    if (body) _renderTriviaTab(body);

    if (typeof showToast === 'function') {
        showToast(isCorrect ? '✅ Correct! +50 XP 🧠' : '❌ Wrong — +10 XP for trying!', 3000);
    }
};

// ============================================================
// POLL QUEST SYSTEM — 1 per day, vote to see results
// ============================================================

function _getPollToday() {
    if (typeof POLL_BANK === 'undefined' || !POLL_BANK || !POLL_BANK.length) return null;
    var now = new Date();
    var start = new Date(now.getFullYear(), 0, 0);
    var dayOfYear = Math.floor((now - start) / 86400000);
    var seed = (dayOfYear * 13 + now.getFullYear()) % POLL_BANK.length;
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
    var todayKey = new Date().toISOString().split('T')[0];
    var hasVoted = state.date === todayKey && typeof state.chosen === 'number';
    var p = today.poll;

    var html = '<div style="text-align:center;padding:8px 0 16px;">' +
        '<div style="font-size:2.5rem;margin-bottom:8px;">📊</div>' +
        '<div style="font-size:1.1rem;font-weight:800;color:var(--heading);margin-bottom:4px;">Poll Quest</div>' +
        '<div style="color:var(--text-muted);font-size:0.82rem;margin-bottom:4px;">Vote daily — see what the community thinks</div>' +
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
        // Show voting options
        html += '<div id="pollOptions" style="display:flex;flex-direction:column;gap:8px;">';
        for (var i = 0; i < p.options.length; i++) {
            var optText = typeof escapeHtml === 'function' ? escapeHtml(p.options[i]) : p.options[i];
            html += '<button onclick="pollVote(' + i + ')" style="padding:14px 16px;background:var(--card-bg,#1a1a2e);border:2px solid var(--border);border-radius:12px;color:var(--text);font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit;text-align:left;transition:all 0.2s;display:flex;align-items:center;gap:10px;">' +
                '<span style="min-width:22px;height:22px;border-radius:50%;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:800;color:var(--text-faint);">' + String.fromCharCode(65 + i) + '</span>' +
                optText +
            '</button>';
        }
        html += '</div>';
        body.innerHTML = html;
    }
}

function _renderPollResults(body, htmlPrefix, poll, state, todayKey) {
    var pollId = poll.id || ('poll_day_' + todayKey);
    // Fetch results from Firestore
    if (typeof db !== 'undefined') {
        db.collection('poll_votes').doc(pollId).get().then(function(doc) {
            var votes = doc.exists ? (doc.data().votes || [0, 0, 0, 0]) : [0, 0, 0, 0];
            var total = votes.reduce(function(a, b) { return a + b; }, 0) || 1;
            _drawPollResults(body, htmlPrefix, poll, votes, total, state.chosen);
        }).catch(function() {
            // Offline fallback
            _drawPollResults(body, htmlPrefix, poll, [0, 0, 0, 0], 1, state.chosen);
        });
    } else {
        _drawPollResults(body, htmlPrefix, poll, [0, 0, 0, 0], 1, state.chosen);
    }
}

function _drawPollResults(body, htmlPrefix, poll, votes, total, chosen) {
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
                '<span style="font-size:0.85rem;font-weight:800;color:' + colors[i] + ';">' + pct + '%</span>' +
            '</div>' +
        '</div>';
    }
    html += '</div>';
    html += '<div style="text-align:center;margin-top:12px;color:var(--text-faint);font-size:0.72rem;">' + total + ' total vote' + (total !== 1 ? 's' : '') + ' · Come back tomorrow for a new poll!</div>';
    body.innerHTML = html;
}

window.pollVote = function(chosenIdx) {
    var today = _getPollToday();
    if (!today || !today.poll) return;
    var p = today.poll;
    var todayKey = new Date().toISOString().split('T')[0];
    var state = _getPollState();
    if (state.date === todayKey && typeof state.chosen === 'number') return; // Already voted

    // Save state
    state = { date: todayKey, index: today.index, chosen: chosenIdx, pollId: p.id };
    _setPollState(state);

    // Award XP
    if (typeof awardPoints === 'function') awardPoints(50, '📊 Poll Quest vote');
    // Raid Boss: poll vote + XP
    if (typeof window._raidOnPollVote === 'function') window._raidOnPollVote();
    if (typeof window._raidOnXPEarned === 'function') window._raidOnXPEarned(50);

    // Record vote in Firestore
    var pollId = p.id || ('poll_day_' + todayKey);
    if (typeof db !== 'undefined') {
        var voteField = 'votes';
        db.collection('poll_votes').doc(pollId).get().then(function(doc) {
            var votes = doc.exists ? (doc.data().votes || [0, 0, 0, 0]) : [0, 0, 0, 0];
            votes[chosenIdx] = (votes[chosenIdx] || 0) + 1;
            return db.collection('poll_votes').doc(pollId).set({
                pollId: pollId,
                question: p.q,
                options: p.options,
                votes: votes,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }).then(function() {
            // Re-render with results
            var body = document.getElementById('questHubBody');
            if (body) _renderPollTab(body);
        }).catch(function(e) {
            console.error('[POLL] Vote save failed:', e);
            // Still show results from local state
            var body = document.getElementById('questHubBody');
            if (body) _renderPollTab(body);
        });

        // Also track on user doc
        if (typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) {
            db.collection('users').doc(auth.currentUser.uid).update({
                lastPollDate: todayKey,
                pollsVoted: firebase.firestore.FieldValue.increment(1)
            }).catch(function() {});
        }
    } else {
        // Offline — just re-render
        var body = document.getElementById('questHubBody');
        if (body) _renderPollTab(body);
    }

    if (typeof showToast === 'function') showToast('📊 Vote recorded! +50 XP', 3000);
};

// ============================================================
// RAID BOSS SYSTEM — Real-time collaborative boss fights
// ============================================================

// Cleanup state for raid boss listeners/intervals
window._raidBossUnsub = null;
window._raidParticipantsUnsub = null;
window._raidTimerInterval = null;

window._cleanupRaidBoss = function() {
    if (window._raidBossUnsub) { window._raidBossUnsub(); window._raidBossUnsub = null; }
    if (window._raidParticipantsUnsub) { window._raidParticipantsUnsub(); window._raidParticipantsUnsub = null; }
    if (window._raidTimerInterval) { clearInterval(window._raidTimerInterval); window._raidTimerInterval = null; }
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

    // Listen to the latest raid boss in real-time
    window._raidBossUnsub = db.collection('raid_bosses')
        .orderBy('startTime', 'desc')
        .limit(1)
        .onSnapshot(function(snapshot) {
            if (snapshot.empty) {
                container.innerHTML = _raidEmptyState();
                return;
            }
            var doc = snapshot.docs[0];
            var boss = doc.data();
            boss._id = doc.id;
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

function _renderRaidBossCard(container, boss) {
    var now = Date.now();
    var startMs = boss.startTime ? (boss.startTime.toMillis ? boss.startTime.toMillis() : boss.startTime) : 0;
    var endMs = boss.endTime ? (boss.endTime.toMillis ? boss.endTime.toMillis() : boss.endTime) : 0;

    // Case 1: Placeholder / upcoming boss
    if (boss.placeholder) {
        var startDate = startMs ? new Date(startMs) : null;
        var dateStr = startDate ? startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Soon';
        container.innerHTML = '<div style="padding:20px 0;">' +
            '<div style="font-size:3rem;margin-bottom:12px;">⚔️</div>' +
            '<div style="font-size:1.1rem;font-weight:800;color:var(--heading);margin-bottom:8px;">Upcoming Raid Boss!</div>' +
            '<div style="color:#8b5cf6;font-size:0.95rem;font-weight:700;margin-bottom:12px;">' + (typeof escapeHtml === 'function' ? escapeHtml(dateStr) : dateStr) + '</div>' +
            '<div id="raidCountdownPlaceholder" style="font-size:1.5rem;font-weight:800;color:var(--heading);font-variant-numeric:tabular-nums;"></div>' +
            '<div style="color:var(--text-faint);font-size:0.75rem;margin-top:12px;">Get ready to team up and take it down!</div>' +
        '</div>';
        _startRaidCountdown('raidCountdownPlaceholder', startMs);
        return;
    }

    // Case 2: Defeated
    if (boss.defeated) {
        var winners = boss.winners || [];
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
        container.innerHTML = '<div style="padding:20px 0;">' +
            '<div style="font-size:3rem;margin-bottom:8px;">💀</div>' +
            '<div style="padding:12px 24px;background:linear-gradient(135deg,rgba(34,197,94,0.15),rgba(34,197,94,0.05));border:2px solid #22c55e;border-radius:16px;margin-bottom:16px;">' +
                '<div style="font-size:1.3rem;font-weight:900;color:#22c55e;letter-spacing:2px;">DEFEATED!</div>' +
            '</div>' +
            '<div style="font-size:1.1rem;font-weight:800;color:var(--heading);margin-bottom:4px;">' + (typeof escapeHtml === 'function' ? escapeHtml(boss.name || 'Raid Boss') : (boss.name || 'Raid Boss')) + '</div>' +
            '<div style="color:var(--text-muted);font-size:0.82rem;">' + (typeof escapeHtml === 'function' ? escapeHtml(boss.description || '') : (boss.description || '')) + '</div>' +
            winnersHtml +
        '</div>';
        return;
    }

    // Case 3: Active boss
    var current = boss.currentHP !== undefined ? boss.currentHP : 0;
    var target = boss.targetHP || 1;
    var pct = Math.min(100, Math.round((current / target) * 100));
    var bossName = typeof escapeHtml === 'function' ? escapeHtml(boss.name || 'Raid Boss') : (boss.name || 'Raid Boss');
    var bossDesc = typeof escapeHtml === 'function' ? escapeHtml(boss.description || '') : (boss.description || '');
    var bossEmoji = boss.emoji || '👹';

    container.innerHTML = '<div style="padding:12px 0;">' +
        // Boss header
        '<div style="margin-bottom:16px;">' +
            '<div style="font-size:2.5rem;margin-bottom:8px;">' + bossEmoji + '</div>' +
            '<div style="font-size:1.15rem;font-weight:900;color:var(--heading);margin-bottom:4px;">' + bossName + '</div>' +
            '<div style="color:var(--text-muted);font-size:0.82rem;line-height:1.5;">' + bossDesc + '</div>' +
        '</div>' +
        // Progress bar
        '<div style="margin-bottom:16px;">' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:6px;">' +
                '<span style="font-size:0.72rem;font-weight:800;color:#8b5cf6;text-transform:uppercase;">Damage Dealt</span>' +
                '<span style="font-size:0.72rem;font-weight:800;color:var(--heading);font-variant-numeric:tabular-nums;">' + current.toLocaleString() + ' / ' + target.toLocaleString() + '</span>' +
            '</div>' +
            '<div style="height:20px;background:rgba(139,92,246,0.1);border-radius:10px;overflow:hidden;border:1px solid rgba(139,92,246,0.2);">' +
                '<div id="raidProgressBar" style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#8b5cf6,#a78bfa);border-radius:10px;transition:width 0.8s ease;position:relative;overflow:hidden;">' +
                    '<div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent);animation:raidShimmer 2s infinite;"></div>' +
                '</div>' +
            '</div>' +
            '<div style="text-align:center;margin-top:4px;font-size:0.75rem;font-weight:800;color:#8b5cf6;">' + pct + '%</div>' +
        '</div>' +
        // Timer
        '<div style="margin-bottom:16px;padding:12px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:12px;">' +
            '<div style="font-size:0.68rem;font-weight:800;color:#ef4444;text-transform:uppercase;margin-bottom:4px;">⏰ Time Remaining</div>' +
            '<div id="raidTimer" style="font-size:1.3rem;font-weight:900;color:var(--heading);font-variant-numeric:tabular-nums;"></div>' +
        '</div>' +
        // Contribute button
        '<button id="raidContributeBtn" onclick="window._contributeRaid()" style="width:100%;padding:14px;background:linear-gradient(135deg,#8b5cf6,#7c3aed);border:none;border-radius:14px;color:#fff;font-size:1rem;font-weight:800;cursor:pointer;font-family:inherit;letter-spacing:0.5px;transition:all 0.2s;margin-bottom:16px;">⚔️ Attack Boss</button>' +
        // Participants list
        '<div>' +
            '<div style="font-size:0.72rem;font-weight:800;color:var(--text-faint);text-transform:uppercase;margin-bottom:8px;">🏆 Top Raiders</div>' +
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

    // Listen to participants
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
                el.innerHTML = '<div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:12px;">No raiders yet — be the first! ⚔️</div>';
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
                html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:' + (isMe ? 'rgba(139,92,246,0.1)' : 'var(--card-bg,#1a1a2e)') + ';border:1px solid ' + (isMe ? 'rgba(139,92,246,0.3)' : 'var(--border)') + ';border-radius:10px;">' +
                    '<div style="display:flex;align-items:center;gap:8px;">' +
                        '<span style="font-size:0.8rem;min-width:24px;">' + rankIcon + '</span>' +
                        '<span style="font-size:0.82rem;font-weight:' + (isMe ? '800' : '600') + ';color:' + (isMe ? '#8b5cf6' : 'var(--text)') + ';">' + displayName + (isMe ? ' (you)' : '') + '</span>' +
                    '</div>' +
                    '<span style="font-size:0.78rem;font-weight:800;color:#8b5cf6;font-variant-numeric:tabular-nums;">' + contributed.toLocaleString() + ' dmg</span>' +
                '</div>';
            });
            el.innerHTML = html;
        }, function(err) {
            console.error('[RAID] Participants listener error:', err);
        });
}

window._contributeRaid = function() {
    var boss = window._currentRaidBoss;
    if (!boss || !boss._id) {
        if (typeof showToast === 'function') showToast('⚠️ No active raid boss', 2000);
        return;
    }

    if (typeof auth === 'undefined' || !auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        if (typeof showToast === 'function') showToast('⚠️ Sign in to attack the boss!', 2500);
        return;
    }

    // Disable button while processing
    var btn = document.getElementById('raidContributeBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⚔️ Attacking...';
        btn.style.opacity = '0.6';
    }

    var contributeRaid = firebase.functions().httpsCallable('contributeRaid');
    contributeRaid({ bossId: boss._id }).then(function(result) {
        var data = result.data || {};
        if (btn) {
            btn.disabled = false;
            btn.textContent = '⚔️ Attack Boss';
            btn.style.opacity = '1';
        }
        if (data.damage) {
            if (typeof showToast === 'function') showToast('⚔️ Dealt ' + data.damage + ' damage!' + (data.xp ? ' +' + data.xp + ' XP' : ''), 2500);
        }
        if (data.defeated) {
            if (typeof showToast === 'function') showToast('🎉 BOSS DEFEATED! Great work!', 4000);
        }
    }).catch(function(err) {
        console.error('[RAID] Contribute error:', err);
        if (btn) {
            btn.disabled = false;
            btn.textContent = '⚔️ Attack Boss';
            btn.style.opacity = '1';
        }
        var msg = (err && err.message) ? err.message : 'Attack failed';
        if (typeof showToast === 'function') showToast('⚠️ ' + msg, 2500);
    });
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
        }
    });
    if (location.hash === '#quests') {
        setTimeout(function() { if (typeof showQuestHub === 'function') showQuestHub(); }, 500);
    }
}

// =============================================
// Raid Boss — Auto-contribution hooks
// Fire-and-forget calls to contributeRaid Cloud Function
// =============================================
window._raidContribute = function(metric, amount, detail) {
    if (typeof firebase === 'undefined' || !firebase.auth || !firebase.auth().currentUser) return;
    try {
        var fn = firebase.functions().httpsCallable('contributeRaid');
        fn({ metric: metric, amount: amount || 1, detail: detail || '' }).catch(function() {});
    } catch(e) { /* silent */ }
};

// Hook: channel visit (called from go() in app.js after navigating to a topic)
// Usage: window._raidContribute('channelVisit', 1, channelId)

// Hook: quiz quest completion
window._raidOnQuizComplete = function() {
    window._raidContribute('quizCompleted', 1);
};

// Hook: trivia correct answer
window._raidOnTriviaCorrect = function() {
    window._raidContribute('triviaCorrect', 1);
};

// Hook: poll vote
window._raidOnPollVote = function() {
    window._raidContribute('pollVote', 1);
};

// Hook: flashcard set completion
window._raidOnFlashcardComplete = function() {
    window._raidContribute('flashcardCompleted', 1);
};

// Hook: XP earned (amount = XP gained)
window._raidOnXPEarned = function(amount) {
    window._raidContribute('xpEarned', amount || 1);
};

// Hook: chat message sent
window._raidOnChatMessage = function() {
    window._raidContribute('chatMessage', 1);
};

// Hook: badge earned
window._raidOnBadgeEarned = function() {
    window._raidContribute('badgeEarned', 1);
};

// Hook: tip sent
window._raidOnTipSent = function() {
    window._raidContribute('tipSent', 1);
};

// Hook: forum post created
window._raidOnForumPost = function() {
    window._raidContribute('forumPost', 1);
};
