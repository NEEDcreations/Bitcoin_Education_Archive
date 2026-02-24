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
};

// State
let questTimerStart = Date.now();
let completedQuests = new Set();
let questCheckInterval = null;
let currentQuest = null;
let isRetry = false;
let visitedForQuest = []; // Track channel visit order for quiz generation
let questCount = 0;

// Quest triggers: after visiting X channels
const QUEST_TRIGGERS = [5, 15, 25, 40, 60, 80, 100];

function initQuests() {
    // Load previously visited channels from localStorage
    const visited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]');
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

function generateAndShowQuest(manual) {
    // Track previously asked questions to avoid repeats
    const askedQuestions = JSON.parse(localStorage.getItem('btc_asked_questions') || '[]');

    // Collect available questions from visited channels + general pool
    let pool = [];
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
            '<button class="quest-done" onclick="showQuestFinalResults()" style="margin-bottom:8px;">Show What You've Earned! →</button>';
    }

    // Scroll modal to top so user sees the header, then can scroll through answers
    const inner = document.getElementById('questInner');
    if (inner) inner.scrollTop = 0;
}

function playHooraySound() {
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

function startQuestManual() {
    if (currentQuest) return; // Already showing one
    if (visitedForQuest.length < 1) {
        if (typeof showToast === 'function') showToast('Explore some channels first to unlock a Quest!');
        return;
    }
    generateAndShowQuest(true);
    if (typeof isMobile === 'function' && isMobile()) {
        document.getElementById('sidebar').classList.remove('open');
    }
}

function skipQuest() { closeQuest(); }

function closeQuest() {
    document.getElementById('questModal').classList.remove('open');
    currentQuest = null;
    isRetry = false;
}

setTimeout(initQuests, 3000);
