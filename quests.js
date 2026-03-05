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
    ],
    'byzantine_generals__problem': [
        { q: 'The Byzantine Generals Problem is about:', a: 'Reaching agreement when some participants may be dishonest', wrong: ['Building castles', 'Trading gold', 'Sending emails'] },
        { q: 'Bitcoin solved the Byzantine Generals Problem using:', a: 'Proof of Work consensus', wrong: ['A voting system', 'A trusted mediator', 'Encryption alone'] },
        { q: 'In the analogy, the generals need to:', a: 'Coordinate an attack without a trusted messenger', wrong: ['Build a wall', 'Trade horses', 'Sign a peace treaty'] },
        { q: 'Before Bitcoin, the Byzantine Generals Problem was considered:', a: 'Unsolvable in a trustless digital environment', wrong: ['Easy to solve', 'Irrelevant', 'Already solved by banks'] },
    ],
    'game_theory': [
        { q: 'Bitcoin\'s incentive structure uses:', a: 'Game theory to align participants', wrong: ['Threats of punishment', 'Legal contracts', 'Trust alone'] },
        { q: 'Miners are incentivized to be honest because:', a: 'Cheating costs more than playing by the rules', wrong: ['They sign contracts', 'The government watches them', 'There are no incentives'] },
        { q: 'Nash Equilibrium in Bitcoin means:', a: 'No participant benefits from changing their strategy alone', wrong: ['Everyone mines equally', 'Prices never change', 'All nodes are identical'] },
        { q: 'The prisoner\'s dilemma relates to Bitcoin because:', a: 'Cooperation is more profitable than defection', wrong: ['Miners are in prison', 'Bitcoin is illegal', 'Users are trapped'] },
    ],
    'elevator_pitches': [
        { q: 'A good Bitcoin elevator pitch should be:', a: 'Simple and compelling in under a minute', wrong: ['A 2-hour lecture', 'Only about price', 'As technical as possible'] },
        { q: 'When explaining Bitcoin to beginners, start with:', a: 'The problem it solves (broken money)', wrong: ['Mining algorithms', 'Cryptographic proofs', 'Exchange trading'] },
        { q: 'The simplest Bitcoin pitch is often:', a: 'Digital money that no one can print or confiscate', wrong: ['A get-rich-quick scheme', 'Internet points', 'A new bank'] },
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
    ],
    'dust': [
        { q: 'Bitcoin "dust" is:', a: 'An amount too small to spend because the fee exceeds the value', wrong: ['Deleted Bitcoin', 'A type of mining waste', 'A security attack'] },
        { q: 'Dust attacks are used to:', a: 'Track and deanonymize wallet owners', wrong: ['Steal Bitcoin directly', 'Mine faster', 'Create new blocks'] },
        { q: 'To avoid dust issues:', a: 'Consolidate small UTXOs when fees are low', wrong: ['Delete your wallet', 'Stop using Bitcoin', 'Only use exchanges'] },
    ],
    'rbf': [
        { q: 'RBF stands for:', a: 'Replace-By-Fee', wrong: ['Really Big Fee', 'Rapid Block Finality', 'Return Bitcoin Fast'] },
        { q: 'RBF allows you to:', a: 'Bump a stuck transaction\'s fee to speed confirmation', wrong: ['Cancel any transaction', 'Send Bitcoin for free', 'Mine your own block'] },
        { q: 'RBF is useful when:', a: 'Your transaction is stuck because the fee was too low', wrong: ['You want to mine', 'You need a new wallet', 'You want to buy altcoins'] },
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
    ],
    'smart-contracts': [
        { q: 'Bitcoin\'s scripting language has supported smart contracts:', a: 'Since the beginning — Bitcoin always had them', wrong: ['Only after Taproot in 2021', 'Only after SegWit in 2017', 'Never — only Ethereum has them'] },
        { q: 'OP_RETURN is used in Bitcoin to:', a: 'Embed small amounts of data in transactions', wrong: ['Return sent Bitcoin', 'Cancel transactions', 'Mine faster'] },
    ],
    'chaumian-mints': [
        { q: 'Cashu is an implementation of:', a: 'Chaumian ecash on Bitcoin/Lightning', wrong: ['A new blockchain', 'An altcoin', 'A mining algorithm'] },
    ],
    'swag-merch': [
        { q: 'BTCAccepted.org helps you find:', a: 'Businesses that accept Bitcoin payments', wrong: ['Mining pools', 'Lightning nodes', 'Altcoin exchanges'] },
        { q: 'Sats.host offers:', a: 'Bitcoin-powered static website hosting', wrong: ['Mining services', 'Cold storage', 'KYC verification'] },
    ],
    'apps-tools': [
        { q: 'PPQ.ai lets you use AI models and pay with:', a: 'Bitcoin per prompt — no subscription needed', wrong: ['Monthly credit card subscription', 'Ethereum gas fees', 'Free but with ads'] },
        { q: 'Angor is a platform for:', a: 'Non-custodial Bitcoin crowdfunding', wrong: ['Bitcoin mining', 'Coin mixing', 'Hardware wallets'] },
    ],
    'games': [
        { q: 'Timechain Arcade offers:', a: 'Free Bitcoin-themed video games', wrong: ['Mining services', 'Trading tools', 'Hardware wallets'] },
        { q: 'CanYouBeatBitcoin.com is:', a: 'An investing simulator comparing your picks to Bitcoin', wrong: ['A mining difficulty calculator', 'A Bitcoin wallet', 'A trading bot'] },
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
    ],

    'governance': [
        { q: 'Bitcoin governance is best described as:', a: 'Rough consensus among users, developers, miners, and node operators', wrong: ['A CEO makes all decisions', 'Miners vote on everything', 'A foundation sets the rules'] },
        { q: 'The Blocksize Wars demonstrated that:', a: 'Users and node operators ultimately control Bitcoin\'s rules, not miners alone', wrong: ['Miners have absolute power', 'Developers can force any change', 'Bitcoin cannot be upgraded'] },
    ],

    'human_rights__social_justice_and_freedo': [
        { q: 'Bitcoin supports human rights by:', a: 'Providing censorship-resistant money that cannot be confiscated by authoritarian regimes', wrong: ['Replacing all governments', 'Eliminating all poverty instantly', 'Being controlled by the UN'] },
        { q: 'Alex Gladstein advocates for Bitcoin because:', a: 'It empowers people living under authoritarian regimes with financial freedom', wrong: ['It makes trading stocks easier', 'It replaces the need for banks in wealthy countries', 'It was designed as a protest tool'] },
    ],

    'market_cap': [
        { q: 'Bitcoin\'s market cap is calculated by:', a: 'Current price multiplied by total coins in circulation', wrong: ['Total transaction volume per day', 'Number of wallets times average balance', 'Mining revenue times block height'] },
        { q: 'Why can Bitcoin\'s market cap potentially exceed gold\'s?', a: 'Bitcoin is more portable, divisible, verifiable, and scarce than gold', wrong: ['Because governments will mandate it', 'Because gold will be banned', 'Because Bitcoin mining produces gold'] },
    ],

    'the_future': [
        { q: 'Hyperbitcoinization refers to:', a: 'Mass voluntary adoption of Bitcoin as the dominant form of money', wrong: ['A Bitcoin price crash', 'A government mandate to use Bitcoin', 'A technical upgrade to the protocol'] },
        { q: 'Bitcoin is described as \'generational wealth\' because:', a: 'Its fixed supply and growing adoption may increase its value over decades', wrong: ['Only older people can buy it', 'It expires after one generation', 'Banks guarantee its value for 100 years'] },
    ],

    'orange-pilling': [
        { q: '\'Orange-pilling\' someone means:', a: 'Convincing them to understand and adopt Bitcoin', wrong: ['Selling them altcoins', 'Giving them free Bitcoin', 'Signing them up for an exchange'] },
        { q: 'The most effective way to orange-pill someone is often:', a: 'Starting with the problem Bitcoin solves (broken money) rather than technical details', wrong: ['Showing them price charts', 'Explaining SHA-256 hashing', 'Telling them to buy immediately'] },
    ],

    'maximalism': [
        { q: 'Bitcoin maximalism is the belief that:', a: 'Bitcoin is the only cryptocurrency that truly matters as sound money', wrong: ['You should invest everything in Bitcoin', 'Bitcoin should replace all technology', 'Only developers should use Bitcoin'] },
        { q: 'Maximalists argue altcoins are unnecessary because:', a: 'Bitcoin\'s base layer plus additional protocol layers can serve all use cases', wrong: ['Because altcoins are illegal', 'Because Satoshi said so', 'Because there can only be one blockchain'] },
    ],

    'developers': [
        { q: 'Bitcoin Core is primarily written in:', a: 'C++', wrong: ['Python', 'JavaScript', 'Rust'] },
        { q: 'Contributing to Bitcoin open source requires:', a: 'Anyone can propose changes — no permission needed', wrong: ['A computer science degree', 'Approval from the Bitcoin Foundation', 'Purchasing a developer license'] },
    ],

    'ham_radio': [
        { q: 'Bitcoin transactions can be sent via ham radio, which means:', a: 'Bitcoin can work without an internet connection', wrong: ['Bitcoin requires satellite dishes', 'Only miners can use radio', 'Radio transactions are free'] },
    ],

    'lightning_node': [
        { q: 'Running a Lightning node allows you to:', a: 'Route payments and earn fees while supporting the network', wrong: ['Mine Bitcoin faster', 'Create new Bitcoin', 'Access the dark web'] },
    ],

    'stablecoins': [
        { q: 'Stablecoins in the Bitcoin ecosystem are typically:', a: 'Tokens pegged to fiat currency values, sometimes built on Bitcoin layers', wrong: ['A type of mining reward', 'Bitcoins that never change price', 'Government-issued digital dollars'] },
    ],

    'consensus': [
        { q: 'Bitcoin consensus means:', a: 'All nodes agree on the state of the blockchain without a central authority', wrong: ['Everyone votes on transactions', 'Miners decide which transactions are valid alone', 'The government approves each block'] },
    ],

    'open_source': [
        { q: 'Bitcoin being open source means:', a: 'Anyone can read, audit, and propose changes to the code', wrong: ['The code is secret but free to use', 'Only approved developers can view it', 'It costs nothing to mine'] },
    ],

    'coin_mixing_coinjoin_coin_control_utxo': [
        { q: 'CoinJoin improves privacy by:', a: 'Combining multiple users\' transactions so individual spending is hard to trace', wrong: ['Encrypting the blockchain', 'Deleting transaction history', 'Creating fake transactions'] },
    ],

    'environment___energy': [
        { q: 'Bitcoin mining\'s relationship with renewable energy is:', a: 'Miners actively seek cheap renewable and stranded energy, incentivizing green energy development', wrong: ['Mining only uses coal', 'Renewable energy cannot power mining', 'Mining has no relationship with energy markets'] },
    ],

    'austrian_school_of_economics': [
        { q: 'The Austrian School of Economics relates to Bitcoin because:', a: 'It advocates for sound money with limited supply, which Bitcoin embodies', wrong: ['It was founded by Satoshi Nakamoto', 'It requires government-controlled currency', 'It predicts Bitcoin will fail'] },
    ],

    'lindy_effect': [
        { q: 'The Lindy Effect applied to Bitcoin means:', a: 'The longer Bitcoin survives, the longer it is expected to continue surviving', wrong: ['Bitcoin gets slower over time', 'Older technology always fails', 'Bitcoin will expire after 21 years'] },
    ],

    'softwar': [
        { q: 'Jason Lowery\'s Softwar thesis argues that:', a: 'Proof-of-work is a form of digital power projection analogous to military power in the physical world', wrong: ['Bitcoin is a weapon system', 'Software replaces all hardware', 'Bitcoin was created by the military'] },
    ],

    'sidechains': [
        { q: 'A Bitcoin sidechain is:', a: 'A separate blockchain that is pegged to Bitcoin, enabling additional features while settling back to the main chain', wrong: ['A backup copy of the Bitcoin blockchain', 'A faster version of Bitcoin Core', 'An altcoin that replaced Bitcoin'] },
    ],

    'submarine_swap': [
        { q: 'A submarine swap allows you to:', a: 'Exchange on-chain Bitcoin for Lightning Bitcoin (or vice versa) trustlessly', wrong: ['Mine Bitcoin underwater', 'Send Bitcoin without internet', 'Convert Bitcoin to Ethereum'] },
]
};
let isRetry = false;
let visitedForQuest = []; // Track channel visit order for quiz generation
let questCount = 0;

// Quest triggers: after visiting X channels
const QUEST_TRIGGERS = [5, 15, 25, 40, 60, 80, 100];
let currentQuest = null;
let completedQuests = new Set();

function initQuests() {
    // Load previously visited channels from localStorage
    const visited = safeJSON('btc_visited_channels', []);
    visited.forEach(ch => {
        if (!visitedForQuest.includes(ch)) visitedForQuest.push(ch);
    });

    if (typeof auth !== 'undefined' && auth.currentUser) {
        loadCompletedQuests(auth.currentUser.uid);
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
    
    // Priority 1: Current Channel (highly requested)
    if (targetChannelId && QUESTION_BANK[targetChannelId]) {
        QUESTION_BANK[targetChannelId].forEach(q => pool.push({...q, source: targetChannelId}));
    }

    // Priority 2: Other visited channels
    for (const chId of visitedForQuest) {
        if (chId === targetChannelId) continue;
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

    if (pool.length < 5) return;

    // Filter out already-asked questions first
    let freshPool = pool.filter(q => !askedQuestions.includes(q.q));

    // If we've asked most questions, reset the tracker
    if (freshPool.length < 5) {
        localStorage.setItem('btc_asked_questions', '[]');
        freshPool = pool;
    }

    // Shuffle and pick 5
    freshPool.sort(() => Math.random() - 0.5);

    const questId = 'quest_dynamic_' + questCount;
    if (completedQuests.has(questId)) return;

    const selected = freshPool.slice(0, 5);

    // Track these questions as asked
    const newAsked = [...askedQuestions, ...selected.map(q => q.q)];
    localStorage.setItem('btc_asked_questions', JSON.stringify(newAsked));

    // Build multiple choice format
    const questions = selected.map(q => {
        const options = [q.a, ...q.wrong].sort(() => Math.random() - 0.5);
        const correctIdx = options.indexOf(q.a);
        return { q: q.q, options, answer: correctIdx };
    });

    currentQuest = { id: questId, title: getQuestTitle(questCount), questions };
    showQuest(currentQuest, false);
}

function getQuestTitle(num) {
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
    playWarriorDrum();

    const modal = document.getElementById('questModal');
    const inner = document.getElementById('questInner');

    let html = '<div class="quest-header">';
    html += '<div class="quest-badge">⚡ QUEST</div>';
    html += '<h2>' + quest.title + '</h2>';
    html += '<p>' + (retry ? 'Retry! Get 3+ correct for 25 pts!' : 'Answer 5 questions. 3+ correct = 50 pts. All 5 = 100 pts!') + '</p>';
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
    const answers = window._questAnswers;
    const correct = window._questCorrect;
    let score = 0;

    answers.forEach((a, i) => { if (a === correct[i]) score++; });

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

    let pts = 0;
    let msg = '';
    if (isRetry) {
        if (score >= 3) {
            pts = 25;
            msg = '🎉 ' + score + '/5 correct on retry! +25 pts!';
            completedQuests.add(currentQuest.id);
            questCount++;
        } else {
            msg = '😅 ' + score + '/5 — Better luck next time! Keep reading and try again.';
        }
    } else {
        if (score === 5) {
            pts = 100;
            msg = '🏆 PERFECT! 5/5! +100 pts!';
            completedQuests.add(currentQuest.id);
            questCount++;
        } else if (score >= 3) {
            pts = 50;
            msg = '🎉 ' + score + '/5 correct! +50 pts!';
            completedQuests.add(currentQuest.id);
            questCount++;
        } else {
            msg = '😅 ' + score + '/5 — You can retry for 25 pts!';
        }
    }

    if (pts > 0 && typeof awardPoints === 'function') {
        await awardPoints(pts, 'Quest: ' + currentQuest.title);
        // Track daily quest count
        var todayQ = new Date().toISOString().split('T')[0];
        var qLog = safeJSON('btc_quest_daily', {});
        if (qLog.date !== todayQ) qLog = { date: todayQ, count: 0 };
        qLog.count++;
        localStorage.setItem('btc_quest_daily', JSON.stringify(qLog));
        // [AUDIT FIX] Sync quest count to Firestore
        if (typeof db !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) {
            db.collection('users').doc(auth.currentUser.uid).update({
                questsCompletedToday: (qLog[today] || 0),
                lastQuestDate: today
            }).catch(function(e) { console.error('Quest sync failed:', e); });
        }
    }
    if (completedQuests.has(currentQuest.id) && typeof db !== 'undefined' && auth.currentUser) {
        await db.collection('users').doc(auth.currentUser.uid).update({
            completedQuests: firebase.firestore.FieldValue.arrayUnion(currentQuest.id)
        });
    }

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

    // Scroll modal to top so user sees the header, then can scroll through answers
    const inner = document.getElementById('questInner');
    if (inner) inner.scrollTop = 0;
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
            (pts > 0 ? '<div style="font-size:1.3rem;font-weight:800;color:var(--accent);margin-bottom:20px;">+' + pts + ' points earned!</div>' : '') +
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
    
    // If no target ID provided, check if we have enough visited channels OR if we can use general pool
    if (!targetChannelId) {
        // Build a temporary pool to see if we HAVE enough questions to even start
        let tempPool = [];
        if (QUESTION_BANK['_general']) QUESTION_BANK['_general'].forEach(q => tempPool.push(q));
        
        for (const chId of visitedForQuest) {
            const questions = QUESTION_BANK[chId];
            if (questions) questions.forEach(q => tempPool.push(q));
        }

        if (tempPool.length < 5) {
            // Still too few? Fallback to pulling 5 random questions from any channel
            let allQs = [];
            for (const [chId, questions] of Object.entries(QUESTION_BANK)) {
                questions.forEach(q => allQs.push(q));
            }
            if (allQs.length < 5) {
                if (typeof showToast === 'function') showToast('📚 Learning materials loading... try again in a second!');
                return;
            }
        }
    }
    
    generateAndShowQuest(true, targetChannelId);
    if (typeof isMobile === 'function' && isMobile()) {
        const sb = document.getElementById('sidebar');
        if (sb) sb.classList.remove('open');
    }
}

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
    ],
    'organic': [
        { q: 'Bitcoin grew organically because:', a: 'It had no pre-mine, no ICO, and no marketing budget', wrong: ['A major corporation funded its development', 'Governments agreed to adopt it simultaneously', 'Social media algorithms promoted it automatically'] },
        { q: 'What makes Bitcoin\'s distribution unique among cryptocurrencies?', a: 'Fair launch — no coins were pre-allocated to founders', wrong: ['Satoshi kept 50% of all coins before launch', 'Venture capitalists funded the initial distribution', 'Coins were distributed based on national GDP'] },
    ],
    'programmable': [
        { q: 'Bitcoin Script is intentionally limited because:', a: 'Simplicity reduces attack surface and increases security', wrong: ['Satoshi was not a skilled programmer', 'The blockchain cannot process complex instructions', 'It was a temporary design meant to be upgraded'] },
        { q: 'What does "Turing-incomplete" mean for Bitcoin Script?', a: 'It cannot run arbitrary programs or infinite loops', wrong: ['It cannot process any transactions at all', 'It requires a separate computer to verify', 'It can only handle one transaction per block'] },
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
    ],
    'geopolitics___macroeconomics': [
        { q: 'Why is Bitcoin relevant to geopolitics?', a: 'It provides a neutral monetary system outside any nation\'s control', wrong: ['Major governments collectively control Bitcoin\'s code', 'Bitcoin mining is only legal in 5 countries', 'The UN regulates Bitcoin\'s international transfers'] },
        { q: 'What is the "petrodollar" system?', a: 'Oil is priced in US dollars, forcing global demand for the dollar', wrong: ['A cryptocurrency backed by oil reserves', 'A Bitcoin mining technique using petroleum', 'A tax imposed on Bitcoin by oil-producing nations'] },
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
    ],
    'transaction_fees': [
        { q: 'Bitcoin transaction fees are determined by:', a: 'The size of the transaction in bytes and current network demand', wrong: ['A fixed percentage of the transaction amount', 'The number of Bitcoin being sent', 'The geographic distance between sender and receiver'] },
        { q: 'When the mempool is full:', a: 'Transactions with higher fees get confirmed first', wrong: ['All transactions are rejected until it clears', 'The block size automatically increases', 'Transaction fees are refunded to senders'] },
    ],
    'philosophy': [
        { q: '"Don\'t trust, verify" means:', a: 'Run your own node to independently verify all Bitcoin rules', wrong: ['Never use Bitcoin because it cannot be trusted', 'Only trust exchanges that are government-regulated', 'Verify your identity before making transactions'] },
        { q: 'The concept "Bitcoin is Time" by Gigi suggests:', a: 'Bitcoin creates a decentralized clock through proof of work', wrong: ['Bitcoin transactions can travel back in time', 'Bitcoin was invented to save people time', 'Bitcoin mining uses atomic clocks'] },
    ],
    'halving': [
        { q: 'The Bitcoin halving occurs every:', a: '210,000 blocks (approximately every 4 years)', wrong: ['Every calendar year on January 3', 'Every 100,000 blocks', 'Whenever the price doubles'] },
        { q: 'After the 2024 halving, the block reward is:', a: '3.125 BTC per block', wrong: ['6.25 BTC per block', '1.5625 BTC per block', '50 BTC per block'] },
        { q: 'The halving is significant because it:', a: 'Mathematically enforces Bitcoin\'s decreasing supply issuance', wrong: ['Doubles the total supply of Bitcoin', 'Reduces the number of active miners by half', 'Changes Bitcoin\'s consensus mechanism'] },
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