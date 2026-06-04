const QUESTION_BANK = {
    'whitepaper': [
        { q: 'When was the Bitcoin Whitepaper published?', a: 'October 31, 2008', wrong: ['January 3, 2009', 'March 15, 2007', 'December 25, 2010'] },
        { q: 'How many pages of text is the Bitcoin Whitepaper?', a: '8 pages', wrong: ['20 pages', '50 pages', '2 pages'] },
        { q: 'The Whitepaper was published on:', a: 'A cryptography mailing list', wrong: ['Twitter', 'A Bitcoin forum', 'The New York Times'] },
        { q: 'What is the title of the Bitcoin Whitepaper?', a: 'Bitcoin: A Peer-to-Peer Electronic Cash System', wrong: ['Digital Gold: The Future', 'How to Mine Cryptocurrency', 'The Blockchain Revolution'] },
        { q: 'The Whitepaper proposed a solution to:', a: 'The double-spending problem', wrong: ['Climate change', 'Internet speed', 'Social media addiction'] },
    ],

    'whitepaper_pt2': [
        { q: 'Who is credited as the author of the Whitepaper?', a: 'Satoshi Nakamoto', wrong: ['Vitalik Buterin', 'Elon Musk', 'Hal Finney'] },
        { q: 'The Whitepaper describes Bitcoin as:', a: 'A peer-to-peer electronic cash system', wrong: ['A stock trading platform', 'A social network', 'A video game currency'] },
        { q: 'What concept does the Whitepaper use to timestamp transactions?', a: 'A chain of hashed blocks', wrong: ['A central database', 'Email timestamps', 'GPS coordinates'] },
        { q: 'The Bitcoin whitepaper solved what previously unsolvable problem?', a: 'Digital scarcity without a trusted third party', wrong: ['Faster internet speeds', 'Quantum-proof encryption', 'Free worldwide communication'] },
        { q: 'What did Satoshi embed in the Genesis Block\'s coinbase transaction?', a: 'A newspaper headline about bank bailouts', wrong: ['Their real name', 'A mathematical formula', 'Instructions for miners'] },
    ],

    'decentralized': [
        { q: 'How many people are "in charge" of Bitcoin?', a: 'No one', wrong: ['Satoshi Nakamoto', 'A board of directors', 'The Bitcoin Foundation'] },
        { q: 'What is needed for code updates to Bitcoin?', a: 'Deep consensus from the network', wrong: ['A CEO decision', 'A government vote', 'Permission from miners only'] },
        { q: 'Bitcoin is described as:', a: 'A protocol, not a company', wrong: ['A company based in Japan', 'A government project', 'A bank product'] },
        { q: 'Bitcoin nodes are run by:', a: 'Anyone who wants to, worldwide', wrong: ['Only by miners', 'Only in the United States', 'Only by approved operators'] },
        { q: 'If one country shuts down all Bitcoin mining:', a: 'The network continues in other countries', wrong: ['Bitcoin dies', 'All coins are lost', 'The price goes to zero permanently'] },
    ],

    'decentralized_pt2': [
        { q: 'Bitcoin has no:', a: 'Central point of failure', wrong: ['Users', 'Transactions', 'Value'] },
        { q: 'Decentralization means:', a: 'No single entity controls the network', wrong: ['One company runs everything', 'The government manages it', 'Only banks can use it'] },
        { q: 'What happens to Bitcoin if one country bans it?', a: 'The network continues operating globally since no single country controls it', wrong: ['Bitcoin shuts down in that country', 'All nodes worldwide go offline', 'Miners must relocate to that country'] },
        { q: 'How many Bitcoin full nodes are estimated to run worldwide?', a: 'Tens of thousands across dozens of countries', wrong: ['About 100 in the United States', 'One per continent', 'Only miners run nodes'] },
        { q: 'Why is geographic distribution of nodes important?', a: 'It prevents any single jurisdiction from shutting down the network', wrong: ['It makes Bitcoin faster', 'It reduces electricity costs', 'It increases the block size'] },
    ],

    'scarce': [
        { q: 'What is the maximum supply of Bitcoin?', a: '21 million', wrong: ['100 million', '1 billion', 'Unlimited'] },
        { q: 'How many Bitcoin are estimated to be lost forever?', a: '2-3 million', wrong: ['None', '10 million', '100,000'] },
        { q: 'Bitcoin\'s code is:', a: 'Open source and auditable by anyone', wrong: ['Private and closed', 'Only visible to developers', 'Controlled by a company'] },
        { q: 'What event cuts Bitcoin\'s new supply in half?', a: 'The halving', wrong: ['The merge', 'The split', 'The fork'] },
        { q: 'How often does the halving occur?', a: 'Approximately every 4 years', wrong: ['Every year', 'Every 10 years', 'Every month'] },
    ],

    'scarce_pt2': [
        { q: 'Bitcoin is often compared to which precious metal?', a: 'Gold', wrong: ['Silver', 'Platinum', 'Copper'] },
        { q: 'The last Bitcoin will be mined around the year:', a: '2140', wrong: ['2030', '2050', '2025'] },
        { q: 'Bitcoin scarcity is enforced by:', a: 'Math and code', wrong: ['Government regulations', 'A central bank', 'Mining companies'] },
        { q: 'What is the smallest unit of Bitcoin called?', a: 'A satoshi (0.00000001 BTC)', wrong: ['A bit (0.01 BTC)', 'A wei', 'A gwei'] },
        { q: 'How does Bitcoin\'s stock-to-flow ratio compare to gold after the 2024 halving?', a: 'Bitcoin\'s stock-to-flow surpassed gold\'s', wrong: ['Gold\'s is still much higher', 'They are identical', 'Stock-to-flow doesn\'t apply to Bitcoin'] },
    ],

    'secure': [
        { q: 'Bitcoin has been under attack since gaining significant value around:', a: '2013', wrong: ['2020', '2009', '2017'] },
        { q: 'How many potential Bitcoin wallets exist?', a: '2^160', wrong: ['21 million', 'A few billion', '2^16'] },
        { q: 'Bitcoin\'s monetary policy is:', a: 'Set in stone and immutable', wrong: ['Changed annually', 'Decided by miners', 'Flexible based on market'] },
        { q: 'A 51% attack would require:', a: 'More computing power than the rest of the network combined', wrong: ['A password', 'Government approval', 'Hacking one computer'] },
        { q: 'Bitcoin has experienced how many hours of downtime since 2013?', a: 'Zero', wrong: ['Hundreds', 'A few days each year', 'One week'] },
    ],

    'secure_pt2': [
        { q: 'Bitcoin uses which hashing algorithm?', a: 'SHA-256', wrong: ['MD5', 'RSA', 'AES'] },
        { q: 'The cost to attack Bitcoin\'s network is:', a: 'Billions of dollars', wrong: ['A few hundred dollars', 'Free', 'A few thousand dollars'] },
        { q: 'What is Bitcoin\'s uptime percentage since launch in 2009?', a: 'Over 99.98% — virtually no downtime', wrong: ['About 95%', 'Around 80% due to attacks', '100% with zero interruptions'] },
        { q: 'Why does higher hashrate make Bitcoin more secure?', a: 'More computational power means an attacker needs proportionally more resources to overpower the network', wrong: ['Higher hashrate makes transactions free', 'It allows more coins to be mined', 'It reduces the block time to seconds'] },
        { q: 'What makes a 51% attack on Bitcoin impractical?', a: 'The enormous cost of acquiring more mining power than all honest miners combined', wrong: ['The government protects Bitcoin', 'Satoshi can reverse any attack', 'Bitcoin uses a firewall'] },
    ],

    'money': [
        { q: 'How many satoshis are in one Bitcoin?', a: '100,000,000', wrong: ['1,000,000', '1,000', '10,000'] },
        { q: 'Bitcoin payments are compared to:', a: 'Email — anyone with your address can send', wrong: ['Fax machines', 'Phone calls', 'Physical mail'] },
        { q: 'Bitcoin\'s distribution was fair because:', a: 'There was no premine', wrong: ['A company sold coins early', 'The government distributed it', 'Only miners got coins'] },
        { q: 'A satoshi is named after:', a: 'Bitcoin\'s creator, Satoshi Nakamoto', wrong: ['A Japanese emperor', 'A type of sushi', 'A programming language'] },
        { q: 'Bitcoin is divisible to how many decimal places?', a: '8', wrong: ['2', '4', '16'] },
    ],

    'money_pt2': [
        { q: 'Bitcoin can function as:', a: 'A store of value, medium of exchange, and unit of account', wrong: ['Only a store of value', 'Only for payments', 'Only for speculation'] },
        { q: 'What makes Bitcoin "sound money"?', a: 'Fixed supply and predictable issuance', wrong: ['Government backing', 'Bank guarantees', 'Corporate ownership'] },
        { q: 'Which property of money does Bitcoin\'s 21 million cap satisfy?', a: 'Scarcity — it cannot be inflated or debased', wrong: ['Acceptability — everyone must use it', 'Portability — it weighs nothing', 'Cognizability — it looks like gold'] },
        { q: 'Why are satoshis important for Bitcoin as money?', a: 'They allow micropayments and make Bitcoin divisible enough for everyday transactions', wrong: ['They increase the total supply', 'They are a separate cryptocurrency', 'They can only be used on Lightning'] },
        { q: 'What gives Bitcoin its monetary value according to Austrian economics?', a: 'Subjective value from its useful properties: scarcity, portability, divisibility, and censorship resistance', wrong: ['Government decree', 'Gold backing', 'The electricity used to mine it'] },
    ],

    'peaceful': [
        { q: 'When China banned Bitcoin:', a: 'Bitcoin just moved and kept going', wrong: ['Bitcoin shut down', 'The price went to zero', 'The code was deleted'] },
        { q: 'Bitcoin is described as:', a: 'Permissionless and borderless', wrong: ['Government-regulated', 'Country-specific', 'Requiring a bank account'] },
        { q: 'Bitcoin enables protest by:', a: 'Allowing people to transact without government permission', wrong: ['Sending angry emails', 'Blocking websites', 'Hacking banks'] },
        { q: 'Bitcoin is called "peaceful" because:', a: 'It opts out of the existing system without force', wrong: ['It prevents all crime', 'It eliminates wars', 'It makes everyone rich'] },
        { q: 'Bitcoin helps people in authoritarian regimes by:', a: 'Providing censorship-resistant money', wrong: ['Overthrowing governments', 'Hacking military systems', 'Printing local currency'] },
    ],

    'peaceful_pt2': [
        { q: 'Bitcoin adoption is described as:', a: 'Voluntary and organic', wrong: ['Mandatory and forced', 'Government-mandated', 'Corporate-controlled'] },
        { q: 'How does Bitcoin function as a peaceful protest tool?', a: 'It allows people to opt out of inflationary monetary systems without violence', wrong: ['It funds protest organizations', 'It blocks government websites', 'It replaces voting systems'] },
        { q: 'Why is Bitcoin described as "opt-in" money?', a: 'Nobody is forced to use it — participation is entirely voluntary', wrong: ['You must opt in through a bank', 'Governments assign Bitcoin to citizens', 'Mining is mandatory for users'] },
        { q: 'How did Bitcoin help protestors in authoritarian regimes?', a: 'It allowed them to receive donations that could not be frozen by the government', wrong: ['It gave them free internet access', 'It replaced their national ID systems', 'It provided encrypted phone calls'] },
        { q: 'What makes Bitcoin "permissionless"?', a: 'Anyone can send, receive, or hold Bitcoin without needing approval from any authority', wrong: ['You need a license to own it', 'Only approved wallets can transact', 'Miners must approve each transaction manually'] },
    ],

    'dominant': [
        { q: '∞/21M means:', a: 'All world wealth funneling into 21 million coins', wrong: ['Bitcoin is infinite', 'There are infinite users', '21 million blockchains'] },
        { q: 'Bitcoin\'s growth pattern resembles:', a: 'A J-shaped curve', wrong: ['A straight line', 'A bell curve', 'A flat line'] },
        { q: 'Bitcoin is said to change you by:', a: 'Lowering your time preference', wrong: ['Making you rich instantly', 'Increasing spending', 'Nothing changes'] },
        { q: 'Bitcoin\'s market dominance refers to:', a: 'Its share of total cryptocurrency market cap', wrong: ['How many users it has', 'Its mining speed', 'Its block size'] },
        { q: 'The Lindy Effect suggests Bitcoin:', a: 'Will last longer the longer it survives', wrong: ['Will die soon', 'Is a fad', 'Needs government support'] },
    ],

    'dominant_pt2': [
        { q: 'Bitcoin is considered dominant because:', a: 'It has the strongest network effect and security', wrong: ['It was the cheapest', 'A government chose it', 'It has the most features'] },
        { q: 'What is the "Lindy effect" as applied to Bitcoin\'s dominance?', a: 'The longer Bitcoin survives and grows, the more likely it is to continue dominating', wrong: ['Old technology always fails eventually', 'Bitcoin dominance decreases with age', 'Lindy only applies to physical goods'] },
        { q: 'Why do network effects favor Bitcoin over altcoins?', a: 'More users, miners, developers, and infrastructure create a self-reinforcing cycle that\'s hard for competitors to match', wrong: ['Bitcoin has the best marketing team', 'Altcoins are illegal', 'Network effects only apply to social media'] },
        { q: 'What does Bitcoin\'s "dominance" metric measure?', a: 'Bitcoin\'s share of total cryptocurrency market capitalization', wrong: ['The number of Bitcoin nodes vs altcoin nodes', 'Bitcoin\'s hash rate compared to all others', 'The percentage of merchants accepting Bitcoin'] },
        { q: 'Why has no altcoin overtaken Bitcoin despite thousands of attempts?', a: 'Bitcoin\'s first-mover advantage, network effects, decentralization, and brand recognition create an insurmountable moat', wrong: ['The government protects Bitcoin specifically', 'Altcoins are all scams with no technology', 'Satoshi prevents forks from succeeding'] },
    ],

    'use-cases': [
        { q: 'Bitcoin is described as better than gold because:', a: 'It can be sent across the planet instantly', wrong: ['It\'s heavier', 'It\'s shinier', 'It\'s backed by gold'] },
        { q: 'How do Bitcoin remittance fees compare to Western Union?', a: 'Much cheaper, nearly free', wrong: ['About the same', 'More expensive', 'Double the cost'] },
        { q: 'Credit card merchants pay about what fee?', a: '3%', wrong: ['0%', '10%', '25%'] },
        { q: 'Bitcoin can help the unbanked because:', a: 'You only need a phone and internet to use it', wrong: ['Banks distribute it', 'The government gives it away', 'You need a credit score'] },
        { q: 'Bitcoin as a hedge against inflation means:', a: 'Its fixed supply protects purchasing power', wrong: ['It always goes up', 'The government guarantees its value', 'It pays interest'] },
    ],

    'use-cases_pt2': [
        { q: 'Micropayments on Bitcoin are possible through:', a: 'The Lightning Network', wrong: ['Visa', 'PayPal', 'Wire transfer'] },
        { q: 'Bitcoin enables financial sovereignty by:', a: 'Letting you be your own bank', wrong: ['Requiring a bank account', 'Needing government ID', 'Using credit scores'] },
        { q: 'Why is Bitcoin especially valuable for international remittances?', a: 'It settles in minutes with low fees compared to days and high fees with traditional wire transfers', wrong: ['It automatically converts to local currency', 'Banks process Bitcoin remittances for free', 'It requires no internet connection'] },
        { q: 'How does Bitcoin serve as a "savings technology"?', a: 'Its fixed supply and deflationary nature preserve purchasing power over time', wrong: ['It pays interest like a savings account', 'Banks guarantee Bitcoin deposits', 'It automatically grows by 10% annually'] },
        { q: 'What makes Bitcoin useful for micropayments via Lightning?', a: 'Sub-penny transaction fees and instant settlement enable payments too small for traditional systems', wrong: ['Lightning removes the need for Bitcoin', 'Micropayments require on-chain transactions', 'Only amounts over $1 can be sent'] },
    ],

    'mining': [
        { q: 'What do miners do?', a: 'Secure the network and process transactions', wrong: ['Create Bitcoin from nothing', 'Print digital money', 'Delete old transactions'] },
        { q: 'Miners are paid in:', a: 'New Bitcoin and transaction fees', wrong: ['US dollars', 'Ethereum', 'Company stock'] },
        { q: 'Mining difficulty adjusts approximately every:', a: '2 weeks (2016 blocks)', wrong: ['Every day', 'Every hour', 'Never'] },
        { q: 'A mining pool is:', a: 'A group of miners combining computing power', wrong: ['A swimming pool for tech workers', 'A single powerful computer', 'A government facility'] },
        { q: 'The mining reward after the 2024 halving is:', a: '3.125 BTC per block', wrong: ['6.25 BTC', '50 BTC', '12.5 BTC'] },
    ],

    'mining_pt2': [
        { q: 'ASIC miners are:', a: 'Specialized hardware designed only for mining', wrong: ['Regular laptops', 'Gaming consoles', 'Smart phones'] },
        { q: 'What prevents miners from cheating?', a: 'Other nodes verify their work', wrong: ['The honor system', 'Government oversight', 'Nothing'] },
        { q: 'What milestone did Bitcoin hash rate reach in September 2025?', a: '1 Zettahash per second', wrong: ['500 Exahash', '10 Petahash', '100 Terahash'] },
        { q: 'Pleb Pool and Atlas Pool are examples of:', a: 'Solo Bitcoin mining pools', wrong: ['Lightning wallets', 'Bitcoin exchanges', 'Hardware wallets'] },
        { q: 'D-Central Technologies specializes in:', a: 'Home mining equipment and support', wrong: ['Bitcoin trading', 'Lightning channels', 'Cold storage'] },
    ],

    'mining_pt3': [
        { q: 'Constellation Heating combines mining with:', a: 'Heating swimming pools', wrong: ['Cooling data centers', 'Wind power', 'Solar panels'] },
        { q: 'What is a "nonce" in Bitcoin mining?', a: 'A "number used once" that miners change to find a valid hash', wrong: ['A type of mining hardware', 'A fee paid to nodes', 'The total number of Bitcoins'] },
        { q: 'Mining pools allow small miners to:', a: 'Receive more frequent, smaller payouts', wrong: ['Control the entire network', 'Mine without using electricity', 'Change the supply of Bitcoin'] },
        { q: 'Bitcoin difficulty adjusts every how many blocks?', a: '2,016 blocks (roughly 2 weeks)', wrong: ['210,000 blocks', 'Only during halvings', 'Every single block'] },
        { q: 'Bitcoin mining is best described as:', a: 'A brute-force lottery of guessing nonces until a valid hash is found', wrong: ['Solving complex mathematical equations', 'Running an algorithm that factors large prime numbers', 'Decrypting encrypted transaction data'] },
    ],

    'mining_pt4': [
        { q: 'What happens when a miner finds a valid block hash?', a: 'They broadcast the block to the network, collect the block reward and transaction fees', wrong: ['They must wait for government approval before adding it', 'The block is sent to Satoshi for verification', 'All other miners must restart their hardware'] },
        { q: 'Why does Bitcoin mining use so much energy?', a: 'Energy expenditure is what gives Bitcoin its security — it makes attacks prohibitively expensive', wrong: ['The code is poorly optimized', 'Miners are required to run 24/7 by law', 'Each transaction requires its own mining operation'] },
        { q: 'What is "hash rate" in Bitcoin mining?', a: 'The total computational power being used to process transactions and secure the network', wrong: ['The speed at which new coins are printed', 'The rate at which transactions are deleted', 'The number of miners currently online'] },
        { q: 'What is "stranded energy" and why do Bitcoin miners seek it?', a: 'Energy produced in remote locations with no local demand — miners can monetize it at low cost', wrong: ['Energy that has been stored in batteries', 'Solar power generated at night', 'Electricity from decommissioned plants only'] },
        { q: 'What is a mining "share" in a pool?', a: 'Proof that a miner contributed valid work toward finding a block, used to split rewards proportionally', wrong: ['A stock in the mining company', 'A partial Bitcoin sent to the miner', 'A vote on which transactions to include'] },
    ],

    'nodes': [
        { q: 'Running a node lets you:', a: 'Verify transactions independently', wrong: ['Mine Bitcoin', 'Print money', 'Control the network'] },
        { q: '"Don\'t trust, verify" means:', a: 'Run your own node to check the truth', wrong: ['Trust your bank', 'Believe what others say', 'Ignore Bitcoin'] },
        { q: 'A full node stores:', a: 'The entire blockchain history', wrong: ['Only your transactions', 'Just the latest block', 'Nothing'] },
        { q: 'How many Bitcoin nodes exist approximately?', a: 'Tens of thousands worldwide', wrong: ['Only 5', 'Exactly 21 million', 'One per country'] },
        { q: 'Running a node requires:', a: 'A regular computer with enough storage', wrong: ['A supercomputer', 'Government permission', 'A mining rig'] },
    ],

    'nodes_pt2': [
        { q: 'Nodes enforce:', a: 'The consensus rules of Bitcoin', wrong: ['Government laws', 'Company policies', 'Social media rules'] },
        { q: 'Clark Moody dashboard is useful for tracking:', a: 'Bitcoin network stats and Knots adoption', wrong: ['Altcoin prices', 'Social media followers', 'Email subscribers'] },
        { q: 'Matt Hill is the founder and CEO of:', a: 'Start9 (node-in-a-box solution)', wrong: ['Bitcoin Magazine', 'Coinbase', 'Blockstream'] },
        { q: 'The Bitcoin Commons governance model proposes:', a: 'Coordination without authority for Bitcoin implementations', wrong: ['Central planning of upgrades', 'Voting on block size', 'Government oversight'] },
        { q: 'A pruned node saves space by:', a: 'Deleting old block data after validating it', wrong: ['Only downloading headers', 'Charging other nodes for storage', 'Reducing the frequency of blocks'] },
    ],

    'nodes_pt3': [
        { q: 'A full node is different from a miner because:', a: 'It enforces all rules but doesn\'t create new blocks', wrong: ['It is faster than a miner', 'It requires more electricity', 'It is only for experts'] },
        { q: 'How does your node know if a transaction is valid?', a: 'It checks the signatures and inputs against the consensus rules', wrong: ['It asks a central server', 'It votes with other nodes', 'It waits for a tweet from Satoshi'] },
        { q: 'What is the main benefit of running your own Bitcoin node?', a: 'You verify all transactions and blocks yourself without trusting any third party', wrong: ['You earn Bitcoin rewards for running it', 'You can mine Bitcoin more efficiently', 'You get faster transaction speeds'] },
        { q: 'What does "initial block download" (IBD) mean?', a: 'The process of downloading and validating the entire blockchain when first setting up a node', wrong: ['The time it takes to mine the first block', 'Downloading the Bitcoin software installer', 'Syncing your wallet with an exchange'] },
        { q: 'How does a Bitcoin node protect you from accepting fake transactions?', a: 'It independently validates every transaction against consensus rules before accepting it', wrong: ['It contacts Satoshi for verification', 'It checks with three other nodes and takes a vote', 'It uses AI to detect fraud patterns'] },
    ],

    'pow-vs-pos': [
        { q: 'Bitcoin uses which consensus mechanism?', a: 'Proof of Work', wrong: ['Proof of Stake', 'Proof of Authority', 'Proof of Space'] },
        { q: 'In Proof of Work, security comes from:', a: 'Computational work and electricity', wrong: ['Staking coins', 'Voting', 'Government approval'] },
        { q: 'Proof of Stake has been criticized for:', a: 'Favoring wealthy holders (the rich get richer)', wrong: ['Using too much energy', 'Being too decentralized', 'Being too slow'] },
        { q: 'Proof of Work connects Bitcoin to:', a: 'The physical world through energy expenditure', wrong: ['The stock market', 'Social media', 'Government databases'] },
        { q: 'In PoW, you can\'t fake:', a: 'The energy spent to mine a block', wrong: ['Your username', 'Your IP address', 'The current time'] },
    ],

    'pow-vs-pos_pt2': [
        { q: 'Proof of Work was chosen because:', a: 'It provides unforgeable costliness', wrong: ['It was the cheapest option', 'Satoshi had no other ideas', 'The government required it'] },
        { q: 'What real-world resource does Proof of Work consume that Proof of Stake does not?', a: 'Energy (electricity used for computation)', wrong: ['Hard drive space', 'Internet bandwidth', 'RAM memory'] },
        { q: 'What is the "nothing at stake" problem in Proof of Stake?', a: 'Validators can sign multiple competing chain forks at no cost, weakening consensus', wrong: ['Stakers lose all their tokens if they validate', 'There is no block reward in PoS', 'Validators must buy mining hardware'] },
        { q: 'Why do PoW proponents argue it provides stronger security guarantees?', a: 'Attacking PoW requires massive ongoing real-world energy expenditure that can\'t be faked', wrong: ['PoW has more developers working on it', 'PoW chains are always faster', 'PoW was invented first so it must be better'] },
        { q: 'How does Proof of Stake differ from Proof of Work in block producer selection?', a: 'PoS selects validators based on the amount of coins they lock up, while PoW requires solving computational puzzles', wrong: ['PoS uses random lottery tickets purchased with fiat', 'PoW lets the richest miner always win', 'There is no difference in selection mechanism'] },
    ],

    'layer-2-lightning': [
        { q: 'Lightning is which layer of Bitcoin?', a: 'Layer 2', wrong: ['Layer 1', 'Layer 3', 'Layer 0'] },
        { q: 'Lightning uses what for privacy?', a: 'Onion routing', wrong: ['GPS tracking', 'Public ledger', 'Email verification'] },
        { q: 'Opening a Lightning channel is like:', a: 'Opening a bar tab', wrong: ['Buying a car', 'Getting a loan', 'Opening a bank account'] },
        { q: 'Lightning transactions are:', a: 'Nearly instant and very cheap', wrong: ['Slow and expensive', 'Free but take hours', 'Only for large amounts'] },
        { q: 'Lightning channels are settled on:', a: 'The Bitcoin base layer', wrong: ['Ethereum', 'A separate blockchain', 'A bank ledger'] },
    ],

    'layer-2-lightning_pt2': [
        { q: 'Lightning enables:', a: 'Micropayments as small as 1 satoshi', wrong: ['Only large transactions', 'Only fiat payments', 'Only international transfers'] },
        { q: 'Lightning capacity refers to:', a: 'The total Bitcoin locked in payment channels', wrong: ['Internet bandwidth', 'Mining power', 'Number of nodes'] },
        { q: 'Satogram allows you to:', a: 'Send messages across the Lightning network', wrong: ['Mine Bitcoin', 'Create NFTs', 'Swap altcoins'] },
        { q: 'Lightning Cats and Lightning Goats let you:', a: 'Feed real animals using Lightning payments', wrong: ['Trade animal NFTs', 'Mine with animal power', 'Buy pets with Bitcoin'] },
        { q: 'Pay With Flash is a service for:', a: 'Businesses to accept Bitcoin payments', wrong: ['Mining Bitcoin', 'Cold storage', 'Coin mixing'] },
    ],

    'layer-2-lightning_pt3': [
        { q: 'LNgigs is a Bitcoin-powered:', a: 'Freelance marketplace', wrong: ['Mining pool', 'Exchange', 'Hardware wallet'] },
        { q: 'The Lightning Network whitepaper was written by:', a: 'Joseph Poon and Thaddeus Dryja', wrong: ['Satoshi Nakamoto', 'Vitalik Buterin', 'Adam Back'] },
        { q: 'Lightning Network payment channels work by:', a: 'Opening a channel with an on-chain transaction, then transacting off-chain instantly', wrong: ['Creating a separate blockchain for each payment', 'Sending Bitcoin through email servers', 'Using proof of stake instead of proof of work'] },
        { q: 'Why is Lightning considered a Layer 2 solution?', a: 'It builds on top of Bitcoin\'s base layer without changing the protocol', wrong: ['Because it is the second cryptocurrency ever created', 'Because it requires two confirmations per transaction', 'Because only two people can use it at a time'] },
        { q: 'A Lightning invoice is:', a: 'A payment request containing the amount, destination, and expiry time', wrong: ['A monthly bill for using the Lightning Network', 'A receipt showing your mining rewards', 'A document required by tax authorities'] },
    ],

    'self-custody': [
        { q: '"Not your keys, not your..."', a: 'Bitcoin', wrong: ['Wallet', 'Password', 'Account'] },
        { q: 'The most secure long-term storage is:', a: 'Hardware wallet', wrong: ['Exchange account', 'Phone app', 'Email attachment'] },
        { q: 'A seed phrase is typically:', a: '12 or 24 words that recover your wallet', wrong: ['Your email password', 'A website URL', 'A phone number'] },
        { q: 'You should store your seed phrase:', a: 'On paper or metal in a secure location', wrong: ['In a screenshot on your phone', 'In your email drafts', 'On social media'] },
        { q: 'Multi-sig means:', a: 'Multiple keys required to authorize a transaction', wrong: ['Multiple Bitcoin addresses', 'Multiple blockchains', 'Multiple exchanges'] },
    ],

    'self-custody_pt2': [
        { q: 'When an exchange holds your Bitcoin:', a: 'You have an IOU, not actual Bitcoin', wrong: ['It\'s completely safe', 'You own it fully', 'The government insures it'] },
        { q: 'Cold storage means:', a: 'Keeping keys offline, disconnected from the internet', wrong: ['Storing Bitcoin in a freezer', 'A cold climate mining facility', 'An inactive exchange account'] },
        { q: 'A hardware wallet provides security by:', a: 'Keeping private keys on a dedicated device that never exposes them to the internet', wrong: ['Storing Bitcoin inside the physical device', 'Encrypting the blockchain so only you can read it', 'Requiring government approval for each transaction'] },
        { q: 'If you lose your hardware wallet but have your seed phrase, you can:', a: 'Recover all your Bitcoin on a new wallet using the seed phrase', wrong: ['Nothing — the Bitcoin is permanently lost', 'Contact the wallet manufacturer for a replacement', 'File a claim with Bitcoin insurance'] },
        { q: 'Multisig (multi-signature) wallets require:', a: 'Multiple keys to authorize a transaction (e.g., 2-of-3)', wrong: ['Multiple Bitcoin addresses to send from', 'Multiple confirmations from the same key', 'Multiple mining pools to verify'] },
    ],

    'privacy-nonkyc': [
        { q: 'KYC stands for:', a: 'Know Your Customer', wrong: ['Keep Your Coins', 'Keys You Control', 'Knowledge Yields Crypto'] },
        { q: 'CoinJoin is used for:', a: 'Mixing transactions for privacy', wrong: ['Joining mining pools', 'Merging blockchains', 'Creating altcoins'] },
        { q: 'Non-KYC Bitcoin means:', a: 'Bitcoin acquired without identity verification', wrong: ['Stolen Bitcoin', 'Fake Bitcoin', 'Government Bitcoin'] },
        { q: 'Bitcoin\'s blockchain is:', a: 'Public — anyone can see transactions', wrong: ['Completely private', 'Only visible to miners', 'Encrypted and hidden'] },
        { q: 'Why do some people prefer non-KYC Bitcoin?', a: 'To maintain financial privacy', wrong: ['To pay lower fees', 'To mine faster', 'To get a better price'] },
    ],

    'privacy-nonkyc_pt2': [
        { q: 'A Bitcoin address should ideally be:', a: 'Used only once for privacy', wrong: ['Shared with everyone', 'Used for all transactions', 'Posted on social media'] },
        { q: 'The first recorded address poisoning attack on Bitcoin happened in:', a: '2025', wrong: ['2021', '2013', '2009'] },
        { q: 'Shielded CSV on Bitcoin promises:', a: 'Better than Zcash-level privacy as an L1.5', wrong: ['Faster mining', 'Bigger blocks', 'More altcoins'] },
        { q: 'Briar messenger is engineered for:', a: 'Privacy in hostile environments using Tor', wrong: ['Fast video calls', 'Social media sharing', 'Cloud storage'] },
        { q: 'What is a "Dust Attack"?', a: 'Tiny amounts of BTC sent to addresses to track the owner\'s movement', wrong: ['A network overload', 'A type of mining hardware failure', 'Deleting your private keys by accident'] },
    ],

    'privacy-nonkyc_pt3': [
        { q: '"WabiSabi" and "Whirlpool" are types of:', a: 'CoinJoin coordination protocols', wrong: ['Mining hardware', 'Wallet brand names', 'Bitcoin address formats'] },
        { q: 'KYC (Know Your Customer) in Bitcoin refers to:', a: 'Identity verification required by regulated exchanges', wrong: ['A type of encryption algorithm', 'A consensus mechanism used by altcoins', 'The name of a Bitcoin wallet'] },
        { q: 'Why do some Bitcoiners prefer non-KYC acquisition?', a: 'To protect financial privacy and avoid linking identity to Bitcoin holdings', wrong: ['Because it is cheaper than using exchanges', 'Because KYC Bitcoin is worth less', 'Because non-KYC Bitcoin mines faster'] },
        { q: 'What is "address reuse" and why is it a privacy concern?', a: 'Using the same Bitcoin address multiple times lets observers link all those transactions to one entity', wrong: ['It causes transactions to fail', 'It increases mining fees', 'It violates Bitcoin consensus rules'] },
        { q: 'What does "non-KYC Bitcoin" mean?', a: 'Bitcoin acquired without providing identity documents, such as through peer-to-peer trades or mining', wrong: ['Bitcoin that has never been in a wallet', 'Bitcoin mined before 2013', 'Bitcoin stored on a hardware wallet'] },
    ],

    'problems-of-money': [
        { q: 'The Cantillon Effect describes:', a: 'Those closest to money printing benefit most', wrong: ['Bitcoin mining', 'The halving', 'Lightning fees'] },
        { q: 'Fractional reserve banking means:', a: 'Banks hold only a fraction of deposits', wrong: ['Banks hold all deposits', 'Bitcoin is fractional', 'Miners keep fractions'] },
        { q: 'Inflation is often called:', a: 'A hidden tax on savings', wrong: ['A bonus for savers', 'A mining reward', 'A blockchain feature'] },
        { q: 'Fiat currency is backed by:', a: 'Government decree and trust', wrong: ['Gold reserves', 'Bitcoin', 'Real estate'] },
        { q: 'The US dollar has lost what percentage of purchasing power since 1913?', a: 'Over 96%', wrong: ['About 10%', 'None', 'About 50%'] },
    ],

    'problems-of-money_pt2': [
        { q: 'Money printing causes:', a: 'Devaluation of existing currency', wrong: ['Deflation', 'Higher savings rates', 'Stronger currency'] },
        { q: 'Sound money historically meant:', a: 'Money that couldn\'t be easily debased', wrong: ['Money that makes noise', 'Digital currency', 'Credit cards'] },
        { q: 'The Cantillon Effect describes how:', a: 'Those closest to new money benefit most from inflation', wrong: ['Bitcoin mining gets harder', 'Banks lose money', 'Gold prices drop'] },
        { q: 'ShadowStats.com tracks:', a: 'Real inflation rates vs official government numbers', wrong: ['Bitcoin mining difficulty', 'Lightning channel capacity', 'Altcoin prices'] },
        { q: '"The Four Horsemen" documentary (2013) exposes:', a: 'The fiat monetary system scam', wrong: ['Bitcoin mining farms', 'Social media dangers', 'Space exploration'] },
    ],

    'problems-of-money_pt3': [
        { q: '"Nixon Shock" in 1971 refers to:', a: 'The US ending the dollar\'s convertibility into gold', wrong: ['The launch of Bitcoin', 'A global stock market crash', 'The creation of the first bank'] },
        { q: 'Gresham\'s Law states that:', a: '"Bad money drives out good money"', wrong: ['"Bitcoin will replace fiat"', '"Gold is always better than silver"', '"Taxes are voluntary"'] },
        { q: 'What happened in 1971?', a: 'Nixon ended the gold standard, allowing unlimited fiat money printing', wrong: ['Bitcoin was invented', 'The first digital computer was built', 'The Euro was introduced'] },
        { q: 'Inflation is often called a "hidden tax" because:', a: 'It silently erodes the purchasing power of your savings', wrong: ['The IRS taxes Bitcoin gains at a hidden rate', 'Banks charge fees that are not disclosed', 'Governments print money in secret locations'] },
        { q: 'What is seigniorage?', a: 'The profit a government makes by issuing currency that costs less to produce than its face value', wrong: ['A tax on gold mining', 'Interest earned on savings accounts', 'The fee banks charge for wire transfers'] },
    ],

    'investment-strategy': [
        { q: 'DCA stands for:', a: 'Dollar Cost Averaging', wrong: ['Digital Currency Account', 'Decentralized Crypto Asset', 'Direct Coin Access'] },
        { q: 'A common Bitcoin investment strategy is:', a: 'Buy regularly and hold long-term', wrong: ['Day trade constantly', 'Sell every week', 'Only buy at the top'] },
        { q: 'HODL originated from:', a: 'A misspelled forum post saying "I AM HODLING"', wrong: ['A financial textbook', 'A government document', 'A bank term'] },
        { q: 'Bitcoin\'s 4-year cycle is often tied to:', a: 'The halving events', wrong: ['US elections', 'Solar cycles', 'Stock market seasons'] },
        { q: 'The best time to buy Bitcoin according to Bitcoiners is:', a: 'Always — time in the market beats timing the market', wrong: ['Only at all-time highs', 'Only on Mondays', 'Only in December'] },
    ],

    'investment-strategy_pt2': [
        { q: 'Stacking sats means:', a: 'Accumulating small amounts of Bitcoin over time', wrong: ['Building satellite dishes', 'Stacking physical coins', 'Creating smart contracts'] },
        { q: 'The biggest drawdown in Bitcoin history was:', a: '94% decline from $32 to $2 in July 2011', wrong: ['50% in 2018', '70% in 2022', '80% in 2014'] },
        { q: 'MNAV.com tracks:', a: 'Bitcoin treasury companies and their metrics', wrong: ['Lightning channels', 'Mining pools', 'Altcoin prices'] },
        { q: 'Lump-sum investing means:', a: 'Buying a large amount of Bitcoin all at once', wrong: ['Buying a fixed amount every week', 'Selling all your holdings', 'Trading only on weekends'] },
        { q: 'Dollar Cost Averaging (DCA) means:', a: 'Buying a fixed amount of Bitcoin at regular intervals regardless of price', wrong: ['Only buying when the price drops below a target', 'Investing your entire savings at once', 'Selling Bitcoin every time it rises 10%'] },
    ],

    'investment-strategy_pt3': [
        { q: 'The Bitcoin phrase "zoom out" means:', a: 'Look at the long-term price trend instead of daily volatility', wrong: ['Reduce your Bitcoin position size', 'Use a magnifying glass to read the whitepaper', 'Exit the market during a downturn'] },
        { q: 'What does "stacking sats" mean in Bitcoin culture?', a: 'Regularly accumulating small amounts of Bitcoin (satoshis) over time', wrong: ['Building a stack of physical Bitcoin coins', 'Storing Bitcoin on multiple exchanges', 'Running multiple mining rigs simultaneously'] },
        { q: 'Why do Bitcoiners say "time in the market beats timing the market"?', a: 'Long-term holders historically outperform those trying to buy dips and sell tops', wrong: ['Because Bitcoin\'s price never goes down', 'Because exchanges charge timing fees', 'Because mining rewards increase over time'] },
        { q: 'What is the "HODL" strategy?', a: 'Buying Bitcoin and holding it long-term regardless of short-term price volatility', wrong: ['A day-trading technique for quick profits', 'An automated trading bot strategy', 'Holding exactly 1 Bitcoin at all times'] },
        { q: 'Why is cold storage recommended for long-term Bitcoin holdings?', a: 'Keeping private keys offline eliminates the risk of remote hacking or exchange failure', wrong: ['Cold storage earns interest on your Bitcoin', 'It makes transactions faster', 'Cold wallets automatically back up to the cloud'] },
    ],

    'cryptography': [
        { q: 'Bitcoin uses cryptography that has been:', a: 'Used for decades in other applications', wrong: ['Invented specifically for Bitcoin', 'Never tested before', 'Made by AI'] },
        { q: 'A private key is:', a: 'A secret number that controls your Bitcoin', wrong: ['Your email password', 'A physical key', 'Your bank PIN'] },
        { q: 'A public key is derived from:', a: 'The private key using one-way math', wrong: ['Your name', 'Random chance', 'The blockchain'] },
        { q: 'Digital signatures prove:', a: 'You own the private key without revealing it', wrong: ['Your identity', 'Your location', 'Your bank balance'] },
        { q: 'Hashing is:', a: 'Converting data into a fixed-length fingerprint', wrong: ['Deleting data', 'Encrypting emails', 'Mining Bitcoin'] },
    ],

    'cryptography_pt2': [
        { q: 'Elliptic curve cryptography is used for:', a: 'Generating Bitcoin key pairs', wrong: ['Mining blocks', 'Sending emails', 'Browsing the web'] },
        { q: 'What type of cryptography does Bitcoin use for digital signatures?', a: 'Elliptic Curve Digital Signature Algorithm (ECDSA) on the secp256k1 curve', wrong: ['RSA 2048-bit encryption', 'AES-256 symmetric encryption', 'Triple DES block cipher'] },
        { q: 'What is a hash function\'s role in Bitcoin?', a: 'It creates a fixed-size, unique digital fingerprint of any input data, used for block headers, addresses, and mining', wrong: ['It encrypts all Bitcoin transactions end-to-end', 'It compresses the blockchain to save space', 'It converts Bitcoin to other cryptocurrencies'] },
        { q: 'Why can\'t you derive a private key from a public key?', a: 'Elliptic curve math is a one-way function — easy to compute forward, computationally infeasible to reverse', wrong: ['Because private keys are longer than public keys', 'Because the blockchain deletes private keys', 'Because Satoshi encrypted all key pairs'] },
        { q: 'What does SHA-256 stand for and where is it used in Bitcoin?', a: 'Secure Hash Algorithm 256-bit — used in mining (proof of work) and creating transaction IDs', wrong: ['Super Hash Accelerator — used in wallet encryption only', 'Satoshi Hash Algorithm — used in signature verification', 'Shared Hash Array — used in peer-to-peer networking'] },
    ],

    'regulation': [
        { q: 'Bitcoin\'s response to bans has been:', a: 'Moving to friendlier jurisdictions', wrong: ['Shutting down', 'Complying immediately', 'Becoming illegal forever'] },
        { q: 'El Salvador made Bitcoin:', a: 'Legal tender in 2021', wrong: ['Illegal in 2020', 'A national secret', 'Only for tourists'] },
        { q: 'Bitcoin regulation varies by:', a: 'Country — each has different rules', wrong: ['There are no rules anywhere', 'One global law covers it', 'Bitcoin regulates itself'] },
        { q: 'A Bitcoin ETF allows:', a: 'Traditional investors to get Bitcoin exposure through stock markets', wrong: ['Free Bitcoin for everyone', 'Government-controlled mining', 'Printing new Bitcoin'] },
        { q: 'The SEC has classified Bitcoin as:', a: 'A commodity, not a security', wrong: ['A security', 'A currency', 'Illegal'] },
    ],

    'regulation_pt2': [
        { q: 'What is a "Self-Custody" regulation attempt?', a: 'Rules that try to force users to use custodial services', wrong: ['Laws that guarantee free Bitcoin', 'Mining equipment safety standards', 'Bitcoin price caps'] },
        { q: 'Can a government effectively ban Bitcoin?', a: 'They can restrict fiat on-ramps but cannot stop peer-to-peer transactions', wrong: ['Yes — turning off the internet kills Bitcoin permanently', 'Yes — all nodes can be identified and shut down simultaneously', 'No bans have ever been attempted by any country'] },
        { q: 'China has banned Bitcoin mining multiple times, yet:', a: 'Miners relocated and the network hash rate recovered within months', wrong: ['Bitcoin permanently lost 50% of its value', 'All Chinese Bitcoin was confiscated', 'The Bitcoin network was offline for weeks'] },
        { q: 'How is Bitcoin classified for tax purposes in most jurisdictions?', a: 'As property or a capital asset, meaning gains are subject to capital gains tax', wrong: ['As currency, exempt from all taxes', 'As a commodity with no reporting requirements', 'As digital cash with no tax implications'] },
        { q: 'What does the "Travel Rule" require for crypto transactions?', a: 'Regulated exchanges must share sender and receiver identity information for transfers above a threshold', wrong: ['Users must physically travel to an exchange to withdraw', 'Bitcoin can only be sent within your home country', 'Miners must verify passport numbers for each block'] },
    ],

    'energy': [
        { q: 'Bitcoin mining and energy:', a: 'Promotes renewable energy and uses wasted energy', wrong: ['Only uses coal', 'Wastes all energy', 'Uses no energy'] },
        { q: 'Stranded energy refers to:', a: 'Energy produced in remote locations with no buyers', wrong: ['Electricity outages', 'Solar panels at night', 'Wind on calm days'] },
        { q: 'Bitcoin miners often locate near:', a: 'Cheap renewable energy sources', wrong: ['Shopping malls', 'Government buildings', 'Residential areas'] },
        { q: 'Bitcoin mining can help stabilize:', a: 'Electrical grids by acting as a flexible load', wrong: ['The stock market', 'Internet speeds', 'Political systems'] },
        { q: 'Compared to traditional banking, Bitcoin\'s energy use is:', a: 'Debatable but often comparable or less', wrong: ['1000x more', 'Zero', 'Exactly the same'] },
    ],

    'energy_pt2': [
        { q: 'Methane flaring and Bitcoin mining:', a: 'Miners can capture and use flared gas productively', wrong: ['They are unrelated', 'Mining increases flaring', 'Flaring powers all mining'] },
        { q: 'Bitcoin mining primarily uses which type of energy?', a: 'Over 50% renewable — often stranded or wasted energy', wrong: ['100% coal and natural gas', 'Nuclear power exclusively', 'Solar panels attached to mining rigs'] },
        { q: 'Bitcoin mining can actually help the environment by:', a: 'Monetizing flared methane that would otherwise be released into the atmosphere', wrong: ['Reducing the total electricity consumed worldwide', 'Creating new renewable energy out of thin air', 'Cooling the planet through heat dissipation'] },
        { q: 'How do Bitcoin miners contribute to grid stability?', a: 'They can instantly power down during peak demand, acting as flexible load that balances the grid', wrong: ['They generate excess electricity for the grid', 'They replace power plants entirely', 'They only mine during off-peak hours by law'] },
        { q: 'What percentage of Bitcoin mining uses renewable energy sources according to recent estimates?', a: 'Over 50% and growing, driven by miners seeking the cheapest energy', wrong: ['Less than 5%', 'Exactly 100% — all mining is renewable', 'About 10%, mostly nuclear'] },
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
    ],

    'blockchain-timechain_pt2': [
        { q: 'Block height refers to:', a: 'The sequential number of a block in the chain', wrong: ['How tall a server rack is', 'The size of the block', 'Mining difficulty'] },
        { q: 'Satoshi originally called the blockchain the:', a: 'Timechain', wrong: ['Hashchain', 'Blockweb', 'Cryptoledger'] },
        { q: 'Each Bitcoin block contains a reference to:', a: 'The hash of the previous block, creating an unbreakable chain', wrong: ['The next block that will be mined', 'All future transactions that will occur', 'A backup of the entire blockchain'] },
        { q: 'The mempool is:', a: 'A waiting area where unconfirmed transactions sit until miners include them in a block', wrong: ['A type of Bitcoin storage device', 'The total amount of memory used by Bitcoin nodes', 'A pool of memory shared between mining hardware'] },
        { q: 'Why did Satoshi originally call it a "timechain" rather than "blockchain"?', a: 'Because each block timestamps transactions in chronological order, creating a chain of time-stamped records', wrong: ['Because blocks are mined at exactly 10-minute intervals', 'Because it tracks time zones for each transaction', 'Because the name "blockchain" was already trademarked'] },
    ],

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
        { q: 'What type of signature scheme did Taproot introduce to Bitcoin?', a: 'Schnorr signatures', wrong: ['RSA signatures', 'Ring signatures', 'Lamport signatures'] },
    ],

    'taproot_pt2': [
        { q: 'Taproot improves Bitcoin by:', a: 'Enhancing privacy, efficiency, and smart contract capabilities using Schnorr signatures', wrong: ['Increasing the total supply above 21 million', 'Removing the need for mining', 'Making all transactions completely anonymous'] },
        { q: 'When was the Taproot upgrade activated on Bitcoin?', a: 'November 2021 at block 709,632', wrong: ['August 2017 with SegWit', 'January 2009 at genesis', 'June 2023 with Ordinals'] },
        { q: 'What is MAST (Merkelized Abstract Syntax Trees) in Taproot?', a: 'A structure that reveals only the executed spending condition, hiding unused conditions for privacy', wrong: ['A new mining algorithm that replaces SHA-256', 'A type of Lightning channel', 'A database for storing smart contract state'] },
        { q: 'How does Taproot improve multi-signature transactions?', a: 'Schnorr signatures allow multiple signers to produce a single compact signature indistinguishable from a regular one', wrong: ['It removes the need for multiple signatures entirely', 'It stores each signature in a separate block', 'It requires all signers to be online simultaneously'] },
        { q: 'What is Tapscript?', a: 'An updated version of Bitcoin Script that enables new opcodes and improved scripting with Taproot', wrong: ['A programming language for building altcoins', 'A tool for writing Bitcoin Core patches', 'The scripting language used in Lightning Network'] },
    ],

    'scalability': [
        { q: 'Bitcoin base layer processes roughly:', a: '7 transactions per second', wrong: ['7 million per second', '1 per minute', '100,000 per second'] },
        { q: 'Bitcoin scales primarily through:', a: 'Layer 2 solutions like Lightning', wrong: ['Making blocks bigger forever', 'Removing the block limit', 'Using faster internet'] },
        { q: 'The block size limit exists to:', a: 'Keep node requirements low and maintain decentralization', wrong: ['Slow down transactions', 'Limit Bitcoin\'s value', 'Help miners make more money'] },
        { q: 'The Blocksize Wars were about:', a: 'Whether to increase block size or use Layer 2', wrong: ['Mining profitability', 'Bitcoin\'s name', 'Which exchange to use'] },
        { q: 'Bitcoin\'s block size is limited to approximately:', a: '1-4 MB (with SegWit)', wrong: ['100 MB', 'Unlimited — it grows with demand', '1 KB'] },
    ],

    'scalability_pt2': [
        { q: 'What did SegWit (Segregated Witness) do for Bitcoin scalability?', a: 'Separated signature data from transaction data, effectively increasing block capacity to ~2 MB equivalent', wrong: ['Doubled the block size to 2 MB', 'Removed the block size limit entirely', 'Moved all transactions to a sidechain'] },
        { q: 'What is transaction batching?', a: 'Combining multiple payments into a single on-chain transaction to save block space and fees', wrong: ['Sending the same transaction multiple times for reliability', 'Grouping transactions by sender country', 'Waiting until a block is full before broadcasting'] },
        { q: 'Why did the Bitcoin community reject simply raising the block size limit?', a: 'Larger blocks increase node operating costs, risking centralization and reducing censorship resistance', wrong: ['Larger blocks would break all existing wallets', 'Satoshi explicitly forbade any block size changes', 'Larger blocks would reduce the total Bitcoin supply'] },
        { q: 'How does the Lightning Network improve Bitcoin\'s throughput?', a: 'By processing millions of transactions off-chain and only settling final balances on the Bitcoin blockchain', wrong: ['By replacing Bitcoin\'s blockchain with a faster one', 'By increasing the block size to 100 MB', 'By reducing the time between blocks to 1 second'] },
        { q: 'What is payment channel batching on Lightning?', a: 'Opening or closing multiple channels in a single on-chain transaction to save fees and block space', wrong: ['Sending the same payment to multiple recipients', 'Mining multiple blocks at once', 'Compressing transaction data for faster processing'] },
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
        { q: 'What is "low time preference" in Bitcoin culture?', a: 'Prioritizing long-term saving over short-term spending', wrong: ['Trading Bitcoin frequently for quick profits', 'Spending all your Bitcoin before the next halving', 'Checking the price every 5 minutes'] },
    ],

    'time_preference_pt2': [
        { q: 'A Bitcoin standard encourages low time preference because:', a: 'Saving is rewarded since the money appreciates over time', wrong: ['Bitcoin transactions are extremely slow', 'The government mandates holding periods', 'You can only sell Bitcoin once per year'] },
        { q: 'What does "low time preference" mean in the context of Bitcoin?', a: 'Prioritizing long-term value and future rewards over immediate gratification', wrong: ['Preferring to spend Bitcoin quickly before it loses value', 'Setting a time limit on how long you hold Bitcoin', 'Trading Bitcoin on short timeframes'] },
        { q: 'How does fiat money encourage high time preference?', a: 'Inflation erodes purchasing power, incentivizing spending now rather than saving for later', wrong: ['Fiat money expires after a certain date', 'Banks charge fees for holding money too long', 'Governments tax savings but not spending'] },
        { q: 'Why do Bitcoiners say Bitcoin "fixes" time preference?', a: 'A deflationary hard money incentivizes saving and long-term thinking since purchasing power increases over time', wrong: ['Bitcoin automatically invests your savings', 'Bitcoin transactions are slower, forcing patience', 'Bitcoin wallets lock funds for a minimum of one year'] },
        { q: 'How does time preference relate to civilization building?', a: 'Lower time preference leads to more capital accumulation, investment, and long-term infrastructure development', wrong: ['Higher time preference builds civilizations faster', 'Time preference has no relationship to economic development', 'Only governments can lower society\'s time preference'] },
    ],

    'soft_vs_hard_forks': [
        { q: 'A soft fork is:', a: 'Backward-compatible upgrade', wrong: ['A completely new blockchain', 'Deleting Bitcoin', 'A type of altcoin'] },
        { q: 'A hard fork creates:', a: 'A permanent chain split if not everyone upgrades', wrong: ['A temporary pause', 'More Bitcoin', 'A faster network'] },
        { q: 'Bitcoin Cash was created by:', a: 'A hard fork of Bitcoin in 2017', wrong: ['Satoshi Nakamoto in 2009', 'The US government', 'Ethereum developers'] },
        { q: 'SegWit was activated as:', a: 'A soft fork', wrong: ['A hard fork', 'A new blockchain', 'An altcoin'] },
        { q: 'The key difference between a soft fork and a hard fork is:', a: 'Soft forks are backwards-compatible; hard forks are not', wrong: ['Soft forks are temporary; hard forks are permanent', 'Soft forks require less code; hard forks need more', 'Soft forks are approved by vote; hard forks by mining'] },
    ],

    'soft_vs_hard_forks_pt2': [
        { q: 'The Blocksize Wars resulted in:', a: 'Bitcoin Cash splitting off as a hard fork while Bitcoin kept small blocks + SegWit', wrong: ['Bitcoin doubling its block size to 2 MB', 'All miners switching to Bitcoin Cash', 'The creation of Ethereum'] },
        { q: 'What is a soft fork in Bitcoin?', a: 'A backward-compatible protocol upgrade where old nodes still accept new blocks', wrong: ['A complete restart of the blockchain', 'A split that creates a new cryptocurrency', 'An update that requires all nodes to upgrade immediately'] },
        { q: 'What is a hard fork?', a: 'A non-backward-compatible change that requires all nodes to upgrade or they\'ll follow a different chain', wrong: ['A bug fix that doesn\'t change consensus rules', 'A minor update to wallet software', 'A temporary network outage'] },
        { q: 'What was the Bitcoin Cash (BCH) hard fork about?', a: 'A disagreement over scaling — BCH proponents wanted larger blocks while Bitcoin kept the 1 MB base limit with SegWit', wrong: ['A dispute over who created Bitcoin', 'A fix for a critical security bug', 'A change to Bitcoin\'s monetary policy'] },
        { q: 'Why are soft forks generally preferred over hard forks for Bitcoin upgrades?', a: 'They maintain backward compatibility, don\'t force upgrades, and don\'t risk splitting the network', wrong: ['They are faster to implement', 'They don\'t require any code changes', 'Hard forks are illegal in most countries'] },
    ],

    'fedimints': [
        { q: 'Fedimint helps with:', a: 'Community custody with privacy', wrong: ['Solo mining', 'Creating altcoins', 'Government reporting'] },
        { q: 'A Fedimint uses:', a: 'Federated guardians who jointly custody Bitcoin', wrong: ['A single custodian', 'Government vaults', 'Exchange accounts'] },
        { q: 'Fedimint provides privacy through:', a: 'Chaumian eCash tokens', wrong: ['Public blockchain', 'KYC verification', 'IP tracking'] },
        { q: 'Fedimints are designed for:', a: 'Communities that trust each other but want privacy', wrong: ['Individual use only', 'Government agencies', 'Large corporations'] },
        { q: 'A Fedimint (Federated Mint) provides:', a: 'Community-custodial privacy through Chaumian ecash on Bitcoin', wrong: ['A new type of Bitcoin mining pool', 'A government-approved Bitcoin exchange', 'A way to increase Bitcoin\'s supply above 21 million'] },
    ],

    'fedimints_pt2': [
        { q: 'Fedimints improve Bitcoin privacy by:', a: 'Using blinded signatures so the mint cannot link deposits to withdrawals', wrong: ['Deleting transaction data from the blockchain', 'Requiring all users to share their identity', 'Converting Bitcoin into a different cryptocurrency'] },
        { q: 'What is a Fedimint?', a: 'A federated Chaumian eCash mint where a group of guardians custody Bitcoin and issue private eCash tokens', wrong: ['A government-run Bitcoin exchange', 'A type of Bitcoin mining pool', 'A centralized bank built on Lightning'] },
        { q: 'How do Fedimints provide privacy?', a: 'Using blind signatures so the mint cannot link who deposited Bitcoin with who redeems eCash tokens', wrong: ['By encrypting the blockchain', 'By hiding all transactions from the public', 'By requiring users to use VPNs'] },
        { q: 'What is the trust model of a Fedimint?', a: 'Users trust a federation of guardians (e.g., 3-of-5 multisig) rather than a single custodian', wrong: ['Completely trustless like on-chain Bitcoin', 'Users trust a single company', 'The government guarantees deposits'] },
        { q: 'How do Fedimints interact with the Lightning Network?', a: 'They can send and receive Lightning payments, allowing private transactions with the broader Bitcoin network', wrong: ['They replace Lightning entirely', 'Lightning cannot connect to Fedimints', 'Fedimints require their own separate payment network'] },
    ],

    'books': [
        { q: 'The Bitcoin Standard is a popular book about:', a: 'Sound money and Bitcoin economics', wrong: ['Bitcoin mining hardware', 'How to day trade', 'Building websites'] },
        { q: 'Mastering Bitcoin by Andreas Antonopoulos is:', a: 'A technical deep-dive into how Bitcoin works', wrong: ['A children\'s book', 'A cookbook', 'A fitness guide'] },
        { q: 'The Sovereign Individual predicted:', a: 'Digital money and the decline of nation-states', wrong: ['Social media', 'Electric cars', 'Space travel'] },
        { q: '21 Lessons by Gigi explores:', a: 'Philosophical lessons learned from going down the Bitcoin rabbit hole', wrong: ['21 mining techniques', '21 trading strategies', '21 altcoins to buy'] },
        { q: '"The Bitcoin Standard" by Saifedean Ammous primarily argues:', a: 'Bitcoin is the hardest money ever invented and will replace fiat', wrong: ['Bitcoin is a useful technology but too volatile to be money', 'Gold is still superior to Bitcoin as a store of value', 'Central banks should adopt Bitcoin as a reserve currency'] },
    ],

    'books_pt2': [
        { q: 'Gigi\'s "21 Lessons" is structured around:', a: '21 philosophical, economic, and technical lessons learned from Bitcoin', wrong: ['A 21-day guide to becoming a Bitcoin trader', 'The 21 richest Bitcoin holders and their strategies', 'The history of 21 failed cryptocurrencies'] },
        { q: 'Who wrote "The Bitcoin Standard"?', a: 'Saifedean Ammous', wrong: ['Andreas Antonopoulos', 'Satoshi Nakamoto', 'Michael Saylor'] },
        { q: 'What book by Jimmy Song teaches Bitcoin programming and development?', a: 'Programming Bitcoin', wrong: ['The Bitcoin Standard', 'Digital Gold', 'Cryptoassets'] },
        { q: 'What book by Lyn Alden provides a broad investment perspective including Bitcoin?', a: 'Broken Money', wrong: ['The Bitcoin Standard', 'Digital Gold', 'The Internet of Money'] },
        { q: 'What is "The Blocksize War" by Jonathan Bier about?', a: 'The history of Bitcoin\'s scaling debate, SegWit activation, and the BCH fork', wrong: ['How to increase your Bitcoin block rewards', 'A fiction novel about cryptocurrency battles', 'Military applications of blockchain technology'] },
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

    'satoshi-nakamoto_pt2': [
        { q: 'Why is it important that Satoshi Nakamoto disappeared?', a: 'Bitcoin has no leader who can be arrested, corrupted, or pressured', wrong: ['Because they were wanted by law enforcement', 'So they could secretly accumulate more Bitcoin', 'Because the code was finished and needed no more work'] },
        { q: 'What evidence suggests Satoshi Nakamoto was likely one person rather than a team?', a: 'Consistent writing style, coding patterns, and posting times across years of activity', wrong: ['A signed confession published on the Bitcoin Talk forum', 'DNA evidence found on the original Bitcoin server hardware', 'A government investigation that confirmed a single identity'] },
        { q: 'When did Satoshi Nakamoto stop posting publicly?', a: 'Around December 2010, with a final known post in April 2011', wrong: ['January 2009 right after launching Bitcoin', 'They never stopped and still post today', 'In 2015 during the block size debate'] },
        { q: 'How many Bitcoin did Satoshi Nakamoto reportedly mine?', a: 'Approximately 1 million BTC based on analysis of early mining patterns', wrong: ['Exactly 21 million (the entire supply)', 'Zero — Satoshi never mined', 'About 100 BTC from the genesis block only'] },
        { q: 'What famous message did Satoshi embed in the Bitcoin genesis block?', a: '"The Times 03/Jan/2009 Chancellor on brink of second bailout for banks"', wrong: ['"Hello World — Bitcoin is born"', '"In code we trust"', '"The revolution will not be centralized"'] },
    ],

    'history': [
        { q: 'The Bitcoin Genesis Block was mined in:', a: 'January 2009', wrong: ['October 2008', 'June 2010', 'December 2007'] },
        { q: 'The first real-world Bitcoin transaction was:', a: '10,000 BTC for two pizzas', wrong: ['1 BTC for a car', '100 BTC for a house', '1 BTC for a coffee'] },
        { q: 'Bitcoin Pizza Day is celebrated on:', a: 'May 22', wrong: ['January 3', 'October 31', 'December 25'] },
        { q: 'Mt. Gox was:', a: 'An early Bitcoin exchange that was hacked and collapsed', wrong: ['A mining company', 'A Bitcoin wallet', 'A government agency'] },
        { q: 'The first Bitcoin block is called:', a: 'The Genesis Block (Block 0)', wrong: ['The Alpha Block', 'Block One', 'The Origin Block'] },
    ],

    'history_pt2': [
        { q: 'Hal Finney received:', a: 'The first Bitcoin transaction from Satoshi', wrong: ['The last Bitcoin ever', 'A medal from the government', 'The Bitcoin trademark'] },
        { q: 'Laszlo\'s famous pizza order was called from:', a: 'London (Laszlo was in Florida)', wrong: ['New York', 'San Francisco', 'Tokyo'] },
        { q: 'The Bitcoin Wiki has been online since:', a: '2010', wrong: ['2015', '2009', '2013'] },
        { q: 'Tim Draper is known in Bitcoin for:', a: 'Buying seized Silk Road Bitcoin at US Marshals auction', wrong: ['Creating the Lightning Network', 'Writing the whitepaper', 'Mining the genesis block'] },
        { q: 'The "Lightning Torch" was:', a: 'A Lightning payment passed between notable Bitcoiners', wrong: ['A mining competition', 'A hardware wallet', 'A documentary'] },
    ],

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
        { q: 'What is the total number of satoshis that will ever exist?', a: '2.1 quadrillion (2,100,000,000,000,000)', wrong: ['21 million', '100 billion', '21 quadrillion'] },
        { q: 'Bitcoin Pizza Day is celebrated on:', a: 'May 22', wrong: ['January 3', 'October 31', 'April 15'] },
        { q: 'The first Bitcoin exchange rate was established at approximately:', a: '$0.00099 per BTC (less than one penny)', wrong: ['$1.00 per BTC', '$0.10 per BTC', '$100 per BTC'] },
        { q: 'HODL originated from:', a: 'A misspelled Bitcoin forum post from 2013 ("I AM HODLING")', wrong: ['An acronym created by a Bitcoin company', 'A Japanese word meaning "to hold"', 'A technical term in Bitcoin\'s source code'] },
        { q: 'The phrase "Not your keys, not your coins" warns against:', a: 'Keeping Bitcoin on exchanges where you don\'t control the private keys', wrong: ['Using physical Bitcoin coins instead of digital', 'Sharing your public key with other people', 'Using hardware wallets instead of software'] },
    ],

    'risks__threats__attack_vectors__weaknes': [
        { q: 'Which Bitcoin address type is better for quantum resistance?', a: 'SegWit (bc1q) because Taproot exposes the public key', wrong: ['Taproot (bc1p)', 'Legacy (1...)', 'All are equally vulnerable'] },
        { q: 'BIP 360 proposes:', a: 'Pay to Quantum Resistant Hash', wrong: ['Bigger blocks', 'Faster mining', 'New altcoin support'] },
        { q: 'A 51% attack would require:', a: 'Controlling more than half of Bitcoin\'s total mining hash rate', wrong: ['Owning 51% of all existing Bitcoin', 'Having 51% of all Bitcoin nodes vote together', 'Hacking 51% of Bitcoin wallets simultaneously'] },
        { q: 'Why is a 51% attack impractical against Bitcoin?', a: 'The hash rate is so massive it would cost billions and be unprofitable', wrong: ['Because Bitcoin automatically detects and blocks attacks', 'Because Satoshi built in a secret defense mechanism', 'Because only 21 mining pools exist worldwide'] },
        { q: 'Quantum computing threatens Bitcoin by potentially:', a: 'Breaking ECDSA signatures used to authorize spending', wrong: ['Mining all remaining Bitcoin in seconds', 'Deleting the entire blockchain', 'Creating unlimited new Bitcoin addresses'] },
    ],

    'evidence-against-alts': [
        { q: 'Ethereum\'s original sale page reveals that ETH was:', a: 'Pre-sold as a security to fund development', wrong: ['Mined fairly like Bitcoin', 'Distributed equally', 'Created by Satoshi'] },
        { q: 'What fundamental difference exists between Bitcoin and altcoins regarding decentralization?', a: 'Altcoin founders often hold large pre-mines or centralized control', wrong: ['Altcoins are too cheap', 'Bitcoin has better marketing', 'Altcoins use different blockchains'] },
        { q: 'Why do Bitcoiners say "there is no second best"?', a: 'No other crypto achieves Bitcoin\'s decentralization, security, and immutability', wrong: ['Bitcoin was the first, so it automatically wins', 'The SEC has declared all other cryptos illegal', 'Satoshi patented the blockchain concept'] },
        { q: 'What is a "pre-mine" and why is it concerning?', a: 'Founders allocate coins to themselves before public launch — unfair distribution', wrong: ['A technique to speed up transaction processing', 'A security measure that protects the network', 'A method of testing the blockchain before launch'] },
        { q: 'Most altcoins are considered securities because:', a: 'They have identifiable teams profiting from token sales with promises of returns', wrong: ['They use the same code as Bitcoin', 'The SEC approves them as securities automatically', 'They are traded on stock exchanges'] },
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
        { q: 'Cashu is:', a: 'An ecash protocol built on Bitcoin using Chaumian blind signatures', wrong: ['A competing cryptocurrency to Bitcoin', 'A hardware wallet manufacturer', 'A type of Bitcoin mining software'] },
        { q: 'What are "blind signatures" in ecash?', a: 'The mint signs tokens without knowing which user they belong to', wrong: ['Signatures that expire after 24 hours', 'A way to sign transactions without a private key', 'Signatures that can only be verified by the government'] },
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

    'difficulty-adjustment': [
        { q: 'How often does Bitcoin\'s difficulty adjustment occur?', a: 'Every 2,016 blocks (approximately 2 weeks)', wrong: ['Every 1,000 blocks', 'Every month', 'Every day'] },
        { q: 'What does the difficulty adjustment ensure?', a: 'Blocks are found roughly every 10 minutes regardless of hash power changes', wrong: ['Transaction fees stay constant', 'Mining rewards increase', 'Block size adjusts automatically'] },
        { q: 'Bitcoin\'s difficulty adjusts every:', a: '2,016 blocks (roughly every 2 weeks)', wrong: ['Every single block', 'Once per year', 'Every 210,000 blocks (at each halving)'] },
        { q: 'If miners leave the network, difficulty adjustment:', a: 'Lowers the difficulty so blocks are found at the target rate', wrong: ['Increases difficulty to punish remaining miners', 'Has no effect — blocks just take longer forever', 'Automatically doubles the block reward'] },
        { q: 'The target time between Bitcoin blocks is approximately:', a: '10 minutes', wrong: ['1 minute', '1 hour', '30 seconds'] },
    ],

    'nostr': [
        { q: 'Nostr is:', a: 'A decentralized social media protocol where no one controls content', wrong: ['A Bitcoin mining pool', 'A Lightning wallet', 'A blockchain explorer'] },
        { q: 'What makes Nostr unique from typical social media?', a: 'Your identity is uncensorable and no single entity controls the platform', wrong: ['It pays users in Bitcoin automatically', 'It only works on mobile', 'It requires KYC verification'] },
        { q: 'Nostr is best described as:', a: 'A decentralized social protocol that cannot be censored', wrong: ['A Bitcoin wallet application', 'A new cryptocurrency competing with Bitcoin', 'An encrypted messaging app owned by a company'] },
        { q: 'Nostr uses cryptographic keys to:', a: 'Allow users to own their identity without a central authority', wrong: ['Mine new coins on the Nostr blockchain', 'Encrypt all messages so no one can read them', 'Create smart contracts between users'] },
        { q: 'How is Nostr connected to Bitcoin?', a: 'Many clients integrate Lightning for tips and payments', wrong: ['Nostr runs on the Bitcoin blockchain directly', 'You must own Bitcoin to create a Nostr account', 'Nostr mining validates Bitcoin transactions'] },
    ],

    'network_effects': [
        { q: 'Bitcoin\'s network effect means:', a: 'Each new user increases the value and utility for all existing users', wrong: ['The internet gets faster', 'Mining gets easier', 'Fees decrease to zero'] },
        { q: 'Why is Bitcoin\'s network effect considered a strong moat?', a: 'It creates a self-reinforcing cycle of liquidity, security, and adoption that competitors cannot easily replicate', wrong: ['Because Bitcoin has patents', 'Because the government protects it', 'Because the code is encrypted'] },
        { q: 'What economic principle explains Bitcoin\\\'s value increasing as more people use it?', a: 'Metcalfe\\\'s Law — network value proportional to connected users squared', wrong: ['Moore\\\'s Law', 'Murphy\\\'s Law', 'Pareto Principle'] },
        { q: 'Metcalfe\'s Law applied to Bitcoin suggests:', a: 'Its value grows proportionally to the square of its users', wrong: ['The price will always increase linearly', 'Only the first users receive any benefit', 'Network effects only apply to social media'] },
        { q: 'What is the flywheel effect in Bitcoin adoption?', a: 'More users attract more developers, merchants, and infrastructure, which attracts even more users', wrong: ['Mining gets easier as more people join', 'Transaction fees decrease as the network grows', 'Bitcoin price always goes up with more users'] },
    ],

    'governance': [
        { q: 'Bitcoin governance is best described as:', a: 'Rough consensus among users, developers, miners, and node operators', wrong: ['A CEO makes all decisions', 'Miners vote on everything', 'A foundation sets the rules'] },
        { q: 'The Blocksize Wars demonstrated that:', a: 'Users and node operators ultimately control Bitcoin\'s rules, not miners alone', wrong: ['Miners have absolute power', 'Developers can force any change', 'Bitcoin cannot be upgraded'] },
        { q: 'What is the BIP process in Bitcoin?', a: 'Bitcoin Improvement Proposals for suggesting protocol changes', wrong: ['Bitcoin Investment Plan', 'Blockchain IP Protection', 'Banking Integration Protocol'] },
        { q: 'How is Bitcoin governed?', a: 'Through rough consensus among users, developers, miners, and node operators', wrong: ['By a board of directors at the Bitcoin Foundation', 'Through shareholder voting like a corporation', 'By whoever owns the most Bitcoin'] },
        { q: 'A BIP (Bitcoin Improvement Proposal) is:', a: 'A formal document proposing changes to Bitcoin\'s protocol or processes', wrong: ['A mandatory update that all nodes must accept', 'A financial investment in Bitcoin development', 'A bug report filed to the Bitcoin support team'] },
    ],

    'human_rights__social_justice_and_freedo': [
        { q: 'Bitcoin supports human rights by:', a: 'Providing censorship-resistant money that cannot be confiscated by authoritarian regimes', wrong: ['Replacing all governments', 'Eliminating all poverty instantly', 'Being controlled by the UN'] },
        { q: 'Alex Gladstein advocates for Bitcoin because:', a: 'It empowers people living under authoritarian regimes with financial freedom', wrong: ['It makes trading stocks easier', 'It replaces the need for banks in wealthy countries', 'It was designed as a protest tool'] },
        { q: 'How has Bitcoin helped activists in authoritarian regimes?', a: 'By enabling uncensorable fundraising and protecting wealth from seizure', wrong: ['By hiding their identity completely', 'By earning interest from banks', 'By creating new currencies'] },
        { q: 'How does Bitcoin help people under authoritarian regimes?', a: 'It provides censorship-resistant money that governments cannot freeze', wrong: ['It automatically reports suspicious activity to authorities', 'It requires government ID to transact', 'It only works in democratic countries'] },
        { q: 'Alex Gladstein of the Human Rights Foundation argues that:', a: 'Bitcoin is the most important tool for financial freedom globally', wrong: ['Only wealthy nations benefit from Bitcoin', 'Bitcoin should be controlled by human rights organizations', 'Proof of Stake is better for human rights than Proof of Work'] },
    ],

    'market_cap': [
        { q: 'Bitcoin\'s market cap is calculated by:', a: 'Current price multiplied by total coins in circulation', wrong: ['Total transaction volume per day', 'Number of wallets times average balance', 'Mining revenue times block height'] },
        { q: 'Why can Bitcoin\'s market cap potentially exceed gold\'s?', a: 'Bitcoin is more portable, divisible, verifiable, and scarce than gold', wrong: ['Because governments will mandate it', 'Because gold will be banned', 'Because Bitcoin mining produces gold'] },
        { q: 'What metric compares Bitcoin\\\'s market value to all other cryptocurrencies combined?', a: 'Bitcoin Dominance Index', wrong: ['Coin Market Gap', 'Crypto Index Fund', 'Volatility Ratio'] },
        { q: 'Bitcoin\'s market capitalization represents:', a: 'The total value of all existing Bitcoin at the current price', wrong: ['The maximum number of coins that can ever exist', 'The amount of money invested in Bitcoin mining', 'The total transaction volume over the past year'] },
        { q: 'If Bitcoin captured gold\'s market cap, each coin would be worth approximately:', a: 'Over $500,000', wrong: ['$100,000', '$50,000', '$10,000'] },
    ],

    'the_future': [
        { q: 'Hyperbitcoinization refers to:', a: 'Mass voluntary adoption of Bitcoin as the dominant form of money', wrong: ['A Bitcoin price crash', 'A government mandate to use Bitcoin', 'A technical upgrade to the protocol'] },
        { q: 'Bitcoin is described as \'generational wealth\' because:', a: 'Its fixed supply and growing adoption may increase its value over decades', wrong: ['Only older people can buy it', 'It expires after one generation', 'Banks guarantee its value for 100 years'] },
        { q: 'What is hyperbitcoinization?', a: 'The hypothetical point where Bitcoin becomes the world\\\'s dominant form of money', wrong: ['Overheating of mining equipment', 'Excessive Bitcoin advertising', 'A type of Bitcoin hack'] },
        { q: 'What happens when the last Bitcoin is mined (~2140)?', a: 'Miners will be compensated solely through transaction fees', wrong: ['The network will shut down permanently', 'A new supply of 21 million coins will be created', 'Mining will become free with no reward'] },
        { q: 'What does hyperbitcoinization refer to?', a: 'A theoretical tipping point where Bitcoin becomes the dominant global monetary system', wrong: ['Bitcoin reaching a price of one million dollars', 'Every country banning Bitcoin simultaneously', 'Bitcoin hash rate exceeding all supercomputers combined'] },
    ],

    'orange-pilling': [
        { q: '\'Orange-pilling\' someone means:', a: 'Convincing them to understand and adopt Bitcoin', wrong: ['Selling them altcoins', 'Giving them free Bitcoin', 'Signing them up for an exchange'] },
        { q: 'The most effective way to orange-pill someone is often:', a: 'Starting with the problem Bitcoin solves (broken money) rather than technical details', wrong: ['Showing them price charts', 'Explaining SHA-256 hashing', 'Telling them to buy immediately'] },
        { q: 'What does "orange pilling" someone mean?', a: 'Educating them about Bitcoin until they understand its importance', wrong: ['Giving them actual pills', 'Selling them mining equipment', 'Creating a Bitcoin wallet for them'] },
        { q: 'What is the best approach when orange-pilling a skeptic?', a: 'Start with their specific pain point (inflation, remittances, censorship) rather than technical details', wrong: ['Show them price charts and promise guaranteed returns', 'Pressure them into buying immediately before the next halving', 'Explain the full UTXO model and Merkle trees first'] },
        { q: 'The most effective orange-pilling strategy is:', a: 'Meeting people where they are and addressing their specific concerns', wrong: ['Posting price predictions on social media', 'Telling people they are stupid for not buying', 'Promising guaranteed financial returns'] },
    ],

    'maximalism': [
        { q: 'Bitcoin maximalism is the belief that:', a: 'Bitcoin is the only cryptocurrency that truly matters as sound money', wrong: ['You should invest everything in Bitcoin', 'Bitcoin should replace all technology', 'Only developers should use Bitcoin'] },
        { q: 'Maximalists argue altcoins are unnecessary because:', a: 'Bitcoin\'s base layer plus additional protocol layers can serve all use cases', wrong: ['Because altcoins are illegal', 'Because Satoshi said so', 'Because there can only be one blockchain'] },
        { q: 'What is Bitcoin maximalism?', a: 'The belief that Bitcoin will be the only cryptocurrency to achieve long-term dominance', wrong: ['Investing only in altcoins', 'Maximizing one\\\'s bitcoin holdings at all costs', 'Running multiple full nodes'] },
        { q: 'Why do deep Bitcoin researchers tend to become maximalists?', a: 'They realize no other project achieves true decentralization and immutability', wrong: ['They are paid by Bitcoin companies to promote it', 'They lack knowledge of other technologies', 'It is required to participate in the Bitcoin community'] },
        { q: 'What is the core argument of Bitcoin maximalists?', a: 'Only Bitcoin achieves true decentralization and sound money; altcoins compromise on critical aspects', wrong: ['Bitcoin should be the only legal currency', 'All other technology besides Bitcoin is useless', 'Maximalists refuse to use the internet'] },
    ],

    'developers': [
        { q: 'Bitcoin Core is primarily written in:', a: 'C++', wrong: ['Python', 'JavaScript', 'Rust'] },
        { q: 'Contributing to Bitcoin open source requires:', a: 'Anyone can propose changes — no permission needed', wrong: ['A computer science degree', 'Approval from the Bitcoin Foundation', 'Purchasing a developer license'] },
        { q: 'Who is considered Bitcoin\\\'s lead maintainer as of recent years?', a: 'There is no formal leader; Bitcoin Core has multiple maintainers', wrong: ['Satoshi Nakamoto', 'Vitalik Buterin', 'Elon Musk'] },
        { q: 'What organization has historically funded Bitcoin Core development?', a: 'MIT Digital Currency Initiative, Chaincode Labs, Brink, Spiral', wrong: ['World Bank', 'Federal Reserve', 'Goldman Sachs'] },
        { q: 'Which version control system hosts Bitcoin Core’s source code?', a: 'Git', wrong: ['SVN', 'Mercurial', 'Bazaar'] },
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
        { q: 'Stablecoins are NOT a threat to Bitcoin because:', a: 'They are centralized IOUs that can be frozen, while Bitcoin is permissionless', wrong: ['Stablecoins use the same technology as Bitcoin', 'Bitcoin automatically converts to stablecoins during crashes', 'Stablecoins have a higher market cap than Bitcoin'] },
    ],

    'consensus': [
        { q: 'Bitcoin consensus means:', a: 'All nodes agree on the state of the blockchain without a central authority', wrong: ['Everyone votes on transactions', 'Miners decide which transactions are valid alone', 'The government approves each block'] },
        { q: 'What is Nakamoto Consensus?', a: 'The combination of proof-of-work, longest chain rule, and economic incentives', wrong: ['Voting by coin holders', 'Consensus by the Bitcoin Foundation', 'Agreement between exchanges'] },
        { q: 'Why does Bitcoin use the longest chain as the valid chain?', a: 'Most proof-of-work indicates most energy/computational investment', wrong: ['Random selection', 'Shortest chains are invalid', 'User voting'] },
        { q: 'Nakamoto Consensus achieves agreement by:', a: 'Having nodes follow the longest valid proof-of-work chain', wrong: ['Requiring all nodes to vote on each transaction', 'Letting the wealthiest node decide which blocks are valid', 'Using a central server to broadcast the correct chain'] },
        { q: 'What happens if two miners find a valid block at nearly the same time?', a: 'A temporary fork occurs and resolves when the next block is found', wrong: ['Both blocks are permanently added to the chain', 'The network shuts down until the conflict is resolved', 'The older miner\'s block always wins'] },
    ],

    'open_source': [
        { q: 'Bitcoin being open source means:', a: 'Anyone can read, audit, and propose changes to the code', wrong: ['The code is secret but free to use', 'Only approved developers can view it', 'It costs nothing to mine'] },
        { q: 'What license is Bitcoin Core released under?', a: 'MIT License (open source)', wrong: ['Proprietary commercial license', 'GPL v3 only', 'Patent-encumbered license'] },
        { q: 'How can anyone contribute to Bitcoin Core?', a: 'Submit pull requests on GitHub after code review', wrong: ['Pay a developer fee', 'Get hired by a bank', 'Apply for a license'] },
        { q: 'What is the purpose of code review in Bitcoin development?', a: 'To catch bugs and security issues before deployment', wrong: ['To slow down development', 'To charge developers money', 'To keep the code secret'] },
        { q: 'Why is peer review critical in Bitcoin Core development?', a: 'It catches bugs and vulnerabilities before they reach production, since changes affect billions in value', wrong: ['It is just a formality required by the MIT license', 'Only one reviewer is needed for minor patches', 'Peer review slows down development unnecessarily'] },
    ],

    'coin_mixing_coinjoin_coin_control_utxo': [
        { q: 'CoinJoin improves privacy by:', a: 'Combining multiple users\' transactions so individual spending is hard to trace', wrong: ['Encrypting the blockchain', 'Deleting transaction history', 'Creating fake transactions'] },
        { q: 'What is CoinJoin?', a: 'A privacy technique combining multiple users\\\' transactions to break heuristics', wrong: ['A cryptocurrency mixer token', 'A type of hardware wallet', 'An exchange withdrawal method'] },
        { q: 'What does coin control allow Bitcoin users to do?', a: 'Manually select which UTXOs to spend in a transaction', wrong: ['Control the price of bitcoin', 'Limit mining difficulty', 'Set transaction speed'] },
        { q: 'What privacy benefit does proper UTXO management provide?', a: 'Preventing address clustering and transaction graph analysis', wrong: ['Increasing mining rewards', 'Reducing transaction fees', 'Speeding up confirmations'] },
        { q: 'What is "coin control" in a Bitcoin wallet?', a: 'The ability to manually select which UTXOs to spend in a transaction for better privacy', wrong: ['A government program to regulate Bitcoin spending', 'Software that limits how much Bitcoin you can buy', 'A mining feature that controls block production'] },
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
        { q: 'The Austrian School of Economics emphasizes:', a: 'Sound money, free markets, and the dangers of central banking', wrong: ['Government control of all monetary systems', 'That inflation is beneficial for economic growth', 'That central banks should print unlimited money'] },
        { q: 'Who wrote "The Theory of Money and Credit"?', a: 'Ludwig von Mises', wrong: ['John Maynard Keynes', 'Paul Krugman', 'Adam Smith'] },
        { q: 'Bitcoin aligns with Austrian economics because:', a: 'It has a fixed supply and cannot be debased by any authority', wrong: ['It was invented by an Austrian economist', 'The Austrian government officially endorses it', 'It uses the Austrian Schilling as its base currency'] },
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
        { q: 'How does the Softwar thesis view Bitcoin mining in terms of national security?', a: 'As a strategic asset that projects power in cyberspace, similar to how militaries project power in physical space', wrong: ['As a threat to national security that should be banned', 'As purely an economic activity with no geopolitical significance', 'As a replacement for nuclear deterrence'] },
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
        { q: 'What technology makes submarine swaps trustless?', a: 'Hash Time-Locked Contracts (HTLCs) that ensure both sides complete or neither does', wrong: ['A centralized escrow service that holds funds during the swap', 'Blockchain validators who verify the exchange manually', 'Smart contracts on Ethereum that bridge to Bitcoin'] },
    ],

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

    'op-codes': [
        { q: 'Bitcoin OP_CODES are:', a: 'Instructions in Bitcoin\'s scripting language that define spending conditions', wrong: ['Error codes returned when a transaction fails', 'Codes used to communicate between mining pools', 'Secret backdoor commands for Bitcoin developers'] },
        { q: 'OP_RETURN allows:', a: 'Embedding small amounts of arbitrary data in the blockchain', wrong: ['Reversing a confirmed transaction', 'Returning stolen Bitcoin to its owner', 'Increasing the block size limit'] },
        { q: 'What is OP_CHECKSIG in Bitcoin Script?', a: 'Verifies a digital signature against a public key', wrong: ['Creates new bitcoins', 'Encrypts transaction data', 'Connects to mining pools'] },
        { q: 'What was the OP_RETURN controversy?', a: 'Its limit was reduced to prevent blockchain bloat from non-financial data', wrong: ['It was used to hack exchanges', 'It created unlimited bitcoins', 'It stopped all transactions'] },
        { q: 'What did Taproot enable for Bitcoin opcodes?', a: 'More flexible scripting through Schnorr signatures and Merkle branches', wrong: ['Removal of all previous scripts', 'Conversion to Ethereum compatibility', 'Centralized script approval'] },
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


    // ============================================================
    // NEW TOPICS — Generated 2026-05-31 (250 questions, 50 topics)
    // ============================================================

'bitcoin_vs_real_estate': [
        { q: 'What key property rights advantage does Bitcoin have over real estate?', a: 'It cannot be seized, taxed annually, or confiscated via eminent domain', wrong: ['Real estate has stronger rights because it is protected by law', 'Bitcoin and real estate have identical property rights protections', 'Bitcoin ownership is not recognized by any major legal system'] },
        { q: 'How do maintenance costs compare between Bitcoin and real estate?', a: 'Bitcoin has near-zero costs; real estate requires taxes, insurance, and repairs', wrong: ['Bitcoin requires expensive monthly server fees to maintain ownership', 'Real estate has no maintenance costs once the mortgage is paid off', 'Both assets have roughly equivalent ongoing maintenance expenses'] },
        { q: 'Why is Bitcoin considered superior to real estate in terms of portability?', a: 'A seed phrase can be memorized and carried across any border instantly', wrong: ['Real estate deeds can be memorized and are just as portable', 'Bitcoin is less portable because it always requires internet access', 'Portability is irrelevant when comparing long-term stores of value'] },
        { q: 'How does Bitcoin\'s divisibility compare to real estate?', a: 'Bitcoin divides into 100 million satoshis; real estate cannot be micro-divided', wrong: ['Real estate is more divisible because you can rent individual rooms', 'Bitcoin cannot be divided at all — you must buy a whole coin', 'Both assets offer identical divisibility through financial derivatives'] },
        { q: 'What risk does real estate face that Bitcoin does not, related to government power?', a: 'Eminent domain seizure, property tax liens, and government confiscation', wrong: ['Governments can easily confiscate Bitcoin but not real estate', 'Neither asset faces any confiscation risk in democratic nations', 'Bitcoin faces greater government risk because it can be fully banned'] },
    ],

    'bitvm': [
        { q: 'What does BitVM enable on Bitcoin without requiring a protocol change?', a: 'Arbitrary computation verification through fraud proofs', wrong: ['Turing-complete smart contracts executed by miners', 'On-chain virtual machine execution like the EVM', 'Zero-knowledge proof generation inside Bitcoin Script'] },
        { q: 'BitVM uses which computational model to verify off-chain computation?', a: 'An optimistic model with prover claims and verifier challenges', wrong: ['A zero-knowledge model where proofs are posted each block', 'A consensus model where all nodes re-execute computation', 'A federated model where trusted signers attest to results'] },
        { q: 'In BitVM, what is the fundamental logic gate used to represent any computable function?', a: 'NAND gates', wrong: ['AND gates', 'XOR gates', 'NOR gates'] },
        { q: 'Who proposed the original BitVM whitepaper?', a: 'Robin Linus', wrong: ['Peter Todd', 'Jeremy Rubin', 'Andrew Poelstra'] },
        { q: 'How does BitVM2 improve upon the original BitVM design?', a: 'It reduces on-chain transactions needed for dispute resolution', wrong: ['It adds Turing-complete execution directly on base layer', 'It eliminates the need for a verifier role entirely', 'It requires a soft fork to enable several new opcodes'] },
    ],

    'block_time-block-size': [
        { q: 'Why did Satoshi choose approximately 10 minutes for Bitcoin\'s target block time?', a: 'It balances throughput with time needed for global block propagation', wrong: ['It was arbitrary with no real technical justification behind it', 'Faster blocks would make mining unprofitable due to power costs', 'It matches the average time needed for international wire transfers'] },
        { q: 'What is the difference between block weight and block size in Bitcoin?', a: 'Weight counts witness bytes at a discount versus non-witness bytes', wrong: ['Block weight and block size are identical with different names', 'Block weight measures computational effort to validate a block', 'Block weight only applies to Lightning Network transactions'] },
        { q: 'What is the maximum block weight allowed by Bitcoin\'s consensus rules?', a: '4 million weight units (4 MWU)', wrong: ['1 megabyte of raw data', '8 million weight units (8 MWU)', '2 million weight units (2 MWU)'] },
        { q: 'Why does SegWit give witness data a discount in the block weight calculation?', a: 'Witness data costs less for nodes to process, incentivizing adoption', wrong: ['Witness data is encrypted and takes up less physical storage', 'The discount was a political compromise with no technical basis', 'Witness data is stored temporarily then deleted after 100 blocks'] },
        { q: 'What is "blockspace economics" in Bitcoin?', a: 'The fee market where users bid for limited space in each block', wrong: ['A government program subsidizing mining in renewable energy zones', 'The cost of running a full node in electricity and bandwidth', 'A pricing model used for Lightning Network channel capacity'] },
    ],

    'burn_bitcoin': [
        { q: 'What is the maximum amount of data that can be stored in an OP_RETURN output?', a: '80 bytes', wrong: ['40 bytes', '160 bytes', '1000 bytes'] },
        { q: 'What does it mean for Bitcoin to be provably unspendable through OP_RETURN?', a: 'The output has no valid script path to spend it', wrong: ['It requires a special private key to spend', 'It can only be spent after 100 confirmations', 'It is temporarily locked until a timelock expires'] },
        { q: 'Roughly how many Bitcoin are estimated to be permanently lost or burned?', a: 'Between 3-4 million BTC', wrong: ['Less than 1 million BTC', 'Over 10 million BTC', 'Exactly 1 million BTC'] },
        { q: 'What type of Bitcoin address output is provably unspendable with no script?', a: 'Bare multisig with invalid pubkeys', wrong: ['Standard P2PKH addresses', 'Wrapped P2SH addresses', 'Native P2WPKH addresses'] },
        { q: 'What is proof of burn in the context of cryptocurrency?', a: 'Demonstrating coins were sent to an unspendable address', wrong: ['Mining blocks without ever receiving any block rewards', 'Permanently deleting the private keys to a wallet', 'Sending coins to a wallet whose owner has died'] },
    ],

    'consensus_pt2': [
        { q: 'What does finality mean in Nakamoto Consensus?', a: 'Reversals become exponentially harder with each confirmation', wrong: ['Transactions are instantly and permanently irreversible', 'Miners hold a formal vote on transaction validity', 'The longest chain is always guaranteed to be correct'] },
        { q: 'What are orphan blocks in Bitcoin?', a: 'Valid blocks not included in the main chain', wrong: ['Invalid blocks rejected by network nodes', 'Blocks that contain zero transactions inside', 'Alternative variants of the genesis block'] },
        { q: 'What is selfish mining in Bitcoin?', a: 'Withholding found blocks to gain unfair advantage', wrong: ['Mining solo without joining any mining pool', 'Using only renewable energy sources for mining', 'Deliberately refusing to validate any transactions'] },
        { q: 'What is the typical Bitcoin block propagation time?', a: '1-10 seconds globally', wrong: ['About 60 seconds on average', 'Nearly instantaneous at all times', 'Approximately 10 full minutes'] },
        { q: 'What was the FIBRE network designed to improve?', a: 'Block propagation speed between miners', wrong: ['Lightning Network payment routing', 'Wallet synchronization with nodes', 'Mining difficulty adjustment calculations'] },
    ],'cryptography_pt3': [
        { q: 'What advantage do Schnorr signatures provide over ECDSA in Bitcoin?', a: 'Key aggregation for efficient multi-signature transactions', wrong: ['Quantum resistance that ECDSA fundamentally lacks', 'Smaller size in all cases regardless of signers', 'Available since day one but never actually used'] },
        { q: 'What is MuSig2 in Bitcoin?', a: 'A Schnorr-based multi-sig scheme producing one standard-looking signature', wrong: ['A second version of the Bitcoin music streaming protocol', 'A next-generation mining algorithm replacing SHA-256 hashing', 'A Lightning Network routing protocol for two-hop payments'] },
        { q: 'What are adaptor signatures used for in Bitcoin?', a: 'Conditional payments where signing reveals a secret value', wrong: ['Converting old formats to be Taproot-compatible ones', 'Signing transactions using multiple keys simultaneously', 'Adapting Script to support Turing-complete contracts'] },
        { q: 'What is a Pedersen commitment?', a: 'A commitment that hides a value while allowing math verification', wrong: ['A legal agreement between developers to maintain the protocol', 'A type of fee commitment that is included in every block', 'A signed pledge by miners to always follow consensus rules'] },
        { q: 'What is the current status of zero-knowledge proofs on Bitcoin?', a: 'Being explored via projects like BitVM and validity rollups', wrong: ['Fully implemented in Bitcoin Core since the Taproot upgrade', 'Impossible on Bitcoin due to fundamental Script limitations', 'Removed from Bitcoin in 2015 due to critical security risks'] },
    ],

    'ctv-covenants': [
        { q: 'What does BIP-119 (CheckTemplateVerify) allow a Bitcoin output to do?', a: 'Commit to a specific future transaction template for spending', wrong: ['Execute arbitrary smart contract code when it is spent', 'Lock funds until a specific block height has been reached', 'Require multiple signatures from different keys to spend'] },
        { q: 'What is a "covenant" in the context of Bitcoin?', a: 'A restriction on how a UTXO can be spent in the future', wrong: ['A multisig arrangement between federation member nodes', 'A legal agreement between Lightning channel counterparties', 'A time-locked contract that expires after a set period'] },
        { q: 'What Bitcoin use case does CTV enable through "congestion control"?', a: 'Batching many payments into one transaction claimable later', wrong: ['Auto-adjusting fees based on current mempool congestion', 'Throttling transactions a wallet can send within a block', 'Limiting block size during periods of high network load'] },
        { q: 'What is OP_VAULT designed to provide using covenants?', a: 'Time-delayed withdrawals with an emergency clawback option', wrong: ['A decentralized exchange built for trustless atomic swaps', 'Cold storage that auto-moves funds to hardware wallets', 'Multi-party escrow designed for marketplace transactions'] },
        { q: 'Why are covenants considered controversial by some Bitcoiners?', a: 'They could enable coin censorship or spending blacklists', wrong: ['They require a hard fork that would split the network', 'They make all transactions public and remove user privacy', 'They increase block size beyond what nodes can handle'] },
    ],

    'cycles': [
        { q: 'What drives Bitcoin\'s historically observed ~4-year market cycle?', a: 'The halving, which cuts new supply in half every ~4 years', wrong: ['Government regulations that shift with 4-year election cycles', 'A scheduled software update that resets the network state', 'Random market psychology with no underlying structural driver'] },
        { q: 'How does the Gartner Hype Cycle apply to each Bitcoin halving era?', a: 'Each cycle shows trigger, peak hype, disillusionment, then recovery to a plateau', wrong: ['Bitcoin skips disillusionment because the price only goes up long-term', 'The Gartner Hype Cycle only applies to new tech products, not currencies', 'Each Bitcoin cycle follows the exact same price pattern as the last one'] },
        { q: 'What is the "lengthening cycles" debate in Bitcoin?', a: 'The theory that each bull run takes longer to peak with smaller percentage gains', wrong: ['The theory that mining cycles get shorter as hardware gets faster', 'A proposal to extend the halving interval from four years to eight', 'The idea that transaction confirmation times increase every year'] },
        { q: 'Which on-chain metrics are commonly used to analyze Bitcoin market cycles?', a: 'MVRV, NUPL, and the Pi Cycle Top indicator', wrong: ['GDP growth, unemployment, and consumer price index', 'Twitter followers, Google Trends, and Reddit subs', 'Block size, node count, and developer commit stats'] },
        { q: 'What is the "diminishing returns" theory in Bitcoin cycles?', a: 'Each cycle\'s percentage gain shrinks, though absolute highs keep rising', wrong: ['Returns are accelerating each cycle with larger percentage gains', 'Bitcoin will eventually produce negative returns in every cycle', 'It refers to decreasing energy efficiency of mining each cycle'] },
    ],

    'derivation_path': [
        { q: 'What does a BIP-32 HD (Hierarchical Deterministic) wallet allow you to do?', a: 'Generate unlimited key pairs from a single master seed', wrong: ['Store multiple cryptocurrencies in one single private key', 'Recover funds without a seed phrase using only email', 'Connect directly to the network without running a node'] },
        { q: 'In the derivation path m/84\'/0\'/0\'/0/0, what does the "84" represent?', a: 'BIP-84, the Native SegWit (bech32) address standard', wrong: ['The year 1984 when public key crypto was standardized', 'The 84th account stored inside this particular wallet', 'The total number of addresses that can be derived'] },
        { q: 'Which BIP defines the derivation path standard for Taproot (bc1p) addresses?', a: 'BIP-86', wrong: ['BIP-84', 'BIP-49', 'BIP-44'] },
        { q: 'Why is sharing an xpub (extended public key) a privacy concern?', a: 'It lets anyone see all addresses and balances from that account', wrong: ['It allows someone to spend your Bitcoin without the private key', 'It broadcasts your seed phrase to every node on the network', 'It reveals your real-world name and identity on the blockchain'] },
        { q: 'What is the "gap limit" in HD wallet address discovery?', a: 'How many consecutive unused addresses are checked before stopping', wrong: ['The maximum number of addresses a wallet can generate total', 'The time delay required between generating new addresses', 'The minimum spacing between two UTXOs in a transaction'] },
    ],

    'difficulty-adjustment_pt2': [
        { q: 'What algorithm does Bitcoin use for difficulty adjustment?', a: 'Direct calculation based on actual vs target time', wrong: ['PID controller algorithm with feedback loops', 'Neural network prediction of future hash rate', 'Moving average of recent hash rate samples'] },
        { q: 'How many blocks is the difficulty retarget period?', a: '2,016 blocks', wrong: ['1,008 blocks', '4,032 blocks', '10,080 blocks'] },
        { q: 'What causes hash rate oscillation between mining pools?', a: 'Miners chasing short-term luck variance', wrong: ['Scheduled Bitcoin Core software update cycles', 'Daily difficulty adjustment recalculations', 'Network communication delays between nodes'] },
        { q: 'What variance measure describes pool mining luck?', a: 'Statistical variance around expected block discovery', wrong: ['Fixed reward percentage distributed to miners', 'Difficulty share ratio across pool participants', 'Network propagation delay between peer nodes'] },
        { q: 'How long does a difficulty epoch typically last?', a: 'Approximately 2 weeks', wrong: ['Exactly 1 week', 'About 1 month', 'Approximately 4 days'] },
    ],'dlcs': [
        { q: 'In a Discreet Log Contract (DLC), what role does an oracle play?', a: 'It signs a real-world outcome that determines how the contract pays out', wrong: ['It holds the funds in escrow until both parties agree on the result', 'It executes smart contract code on a sidechain to settle the bet', 'It mines the specific transaction that settles the contract on-chain'] },
        { q: 'What cryptographic technique makes DLCs "discreet" — invisible to the oracle?', a: 'Adaptor signatures that use the oracle\'s attestation privately', wrong: ['Zero-knowledge proofs that hide the contract from participants', 'Ring signatures that mix the contract with unrelated transactions', 'Homomorphic encryption that processes data without decrypting it'] },
        { q: 'What is a common real-world use case for Discreet Log Contracts?', a: 'Financial derivatives and betting settled by price or event data', wrong: ['Decentralized file storage using the Bitcoin network as a backend', 'Privacy-preserving identity verification on the Bitcoin blockchain', 'Automated market making for Lightning Network liquidity pools'] },
        { q: 'Why is the oracle in a DLC considered more trustworthy than traditional smart contract oracles?', a: 'The oracle doesn\'t know the contract exists or what depends on it', wrong: ['The oracle stakes Bitcoin collateral that is slashed if it lies', 'Multiple oracles must all agree before any payout can occur', 'The oracle runs inside a trusted execution environment on-chain'] },
        { q: 'DLC.Link enables Discreet Log Contracts to be used primarily for what purpose?', a: 'Bridging Bitcoin as collateral into DeFi without giving up custody', wrong: ['Mining pool payout distribution based on individual hash rate', 'Decentralized DNS registration on the Bitcoin base layer', 'Cross-chain atomic swaps between Bitcoin and Ethereum directly'] },
    ],

    'dollar-bitcoin_milkshake_theory': [
        { q: 'Who originated the "Dollar Milkshake Theory"?', a: 'Brent Johnson of Santiago Capital', wrong: ['Ray Dalio of Bridgewater Associates', 'Michael Saylor of MicroStrategy', 'Saifedean Ammous of The Bitcoin Standard'] },
        { q: 'What is the core thesis of the Dollar Milkshake Theory?', a: 'The dollar strengthens by sucking up global liquidity while other fiat currencies weaken', wrong: ['All fiat currencies collapse simultaneously and get replaced by Bitcoin', 'The dollar weakens as other currencies collectively strengthen against it', 'Central banks coordinate to create and adopt a single global currency'] },
        { q: 'What is the "dollar strength paradox" in the Milkshake Theory?', a: 'The dollar gets stronger vs other currencies while losing purchasing power vs hard assets', wrong: ['A strong dollar always means the Bitcoin price will go down in tandem', 'Dollar strength is a reliable signal that the US economy is healthy', 'Nobody wants dollars but everyone needs them to service their debts'] },
        { q: 'How does Bitcoin fit into the Dollar Milkshake Theory\'s endgame?', a: 'After the dollar absorbs global liquidity, Bitcoin becomes the ultimate fiat exit', wrong: ['Bitcoin is irrelevant to the theory because it isn\'t a fiat currency', 'Bitcoin collapses alongside other currencies during the dollar\'s rise', 'The theory predicts Bitcoin gets banned and replaced by state CBDCs'] },
        { q: 'Why does global dollar demand play a central role in the Milkshake Theory?', a: 'Trillions in dollar-denominated debt forces nations to buy dollars, strengthening it', wrong: ['Global dollar demand is declining rapidly as nations actively de-dollarize', 'Dollar demand only matters for US domestic transactions and trade', 'The theory says dollar demand is irrelevant — only money supply matters'] },
    ],

    'el-salvador': [
        { q: 'What was the Chivo wallet in El Salvador\'s Bitcoin adoption?', a: 'A government-issued Lightning wallet that gave citizens $30 in Bitcoin', wrong: ['A private hardware wallet manufactured locally in El Salvador', 'An exchange platform where Salvadorans could trade altcoins', 'A banking app that only supported US dollar-based transactions'] },
        { q: 'What is "Bitcoin Beach" and why is it significant to El Salvador\'s Bitcoin story?', a: 'El Zonte — a village that built a grassroots Bitcoin economy before the national law', wrong: ['A luxury resort in San Salvador that exclusively accepts Bitcoin payments', 'A government-built tourist attraction designed to promote Bitcoin adoption', 'A cryptocurrency exchange headquartered on the Salvadoran coastal region'] },
        { q: 'What was President Bukele\'s core strategy behind making Bitcoin legal tender?', a: 'Financial inclusion for the unbanked, foreign investment, and cheaper remittances', wrong: ['Replacing the US dollar entirely with Bitcoin as the sole currency', 'Mining Bitcoin profitably using El Salvador\'s untapped oil reserves', 'Creating a government-controlled cryptocurrency to replace Bitcoin'] },
        { q: 'How did the World Bank and IMF respond to El Salvador\'s Bitcoin law?', a: 'They pushed back — the World Bank refused help and the IMF warned of risks', wrong: ['Both organizations fully endorsed and helped fund the entire initiative', 'The IMF designed and helped build the Chivo wallet infrastructure', 'The World Bank provided a $500 million loan specifically for adoption'] },
        { q: 'How did Lightning Network adoption benefit El Salvador\'s economy?', a: 'It enabled fast, near-free payments and remittances, cutting out costly services', wrong: ['Lightning was not used — only on-chain Bitcoin transactions were supported', 'Lightning made transactions faster but significantly more expensive overall', 'El Salvador banned Lightning in favor of on-chain-only Bitcoin payments'] },
    ],

    'evidence-against-alts_pt2': [
        { q: 'What is a "premine" and why is it a red flag for altcoins?', a: 'Founders create and keep tokens before public launch, giving insiders an unfair edge', wrong: ['A premine is a security feature that helps blockchains launch more quickly', 'A premine means the coin was tested before release, which is good practice', 'A premine is when miners validate the genesis block without earning fees'] },
        { q: 'Why are many altcoin tokens considered securities under US law?', a: 'They pass the Howey Test — buyers expect profits from a centralized team\'s efforts', wrong: ['The SEC automatically classifies every digital asset as a regulated security', 'Any token traded on a cryptocurrency exchange is legally a security by default', 'Only tokens with market caps above $1 billion can qualify as securities'] },
        { q: 'What is "VC token dumping" in the altcoin market?', a: 'VCs invest early at a discount, then sell their tokens on retail investors at launch', wrong: ['VCs donate their discounted tokens to charity projects after launch', 'VCs permanently lock their tokens to show support for the project', 'VCs use their tokens to fund open-source Bitcoin core development'] },
        { q: 'Why do Bitcoiners argue that "decentralized governance tokens" are an oxymoron?', a: 'Token voting concentrates power with whales and VCs, recreating inequality', wrong: ['Governance tokens are too technically complex to ever implement properly', 'Bitcoin already uses governance tokens internally for protocol upgrades', 'Governance tokens have been declared illegal in every jurisdiction'] },
        { q: 'What key evidence do Bitcoiners cite about Ethereum\'s centralization?', a: 'A massive premine to insiders, repeated monetary policy changes, and known leadership', wrong: ['Ethereum runs on a single server that is controlled by Vitalik Buterin', 'Ethereum transactions require explicit government approval before processing', 'Ethereum has fewer active nodes than a typical corporate cloud database'] },
    ],

    'extension-blocks': [
        { q: 'What are extension blocks in Bitcoin?', a: 'Additional block space running alongside the main chain without changing it', wrong: ['Larger blocks created by increasing the block size limit via a hard fork', 'Blocks reserved exclusively for Lightning Network channel operations', 'Compressed blocks that store only transaction hashes to save space'] },
        { q: 'How do extension blocks differ from a traditional soft fork upgrade?', a: 'Old nodes see extension transactions as "anyone-can-spend" outputs', wrong: ['Extension blocks require all nodes to upgrade or be forked off the network', 'Extension blocks reduce the block size to improve network decentralization', 'Extension blocks are identical to soft forks but use a different label'] },
        { q: 'What is the "space chain" concept related to extension blocks?', a: 'A separate chain whose block space is auctioned via the main chain', wrong: ['A satellite network that broadcasts Bitcoin blocks from orbit', 'A virtual reality environment where Bitcoin nodes operate in 3D', 'A specialized blockchain optimized for storing files over 4MB'] },
        { q: 'What is a key trade-off of extension blocks?', a: 'Non-upgraded nodes cannot fully validate extension block transactions', wrong: ['All miners must upgrade their hardware simultaneously to participate', 'The main block size permanently increases for all future blocks', 'Lightning Network channels become incompatible with the base layer'] },
        { q: 'Why have extension block proposals historically been controversial in Bitcoin development?', a: 'They risk creating a second-class zone that weakens full node security', wrong: ['They were proposed by altcoin developers trying to undermine Bitcoin', 'They would eliminate the need for the Lightning Network entirely', 'They require replacing SHA-256 with a completely different hash algorithm'] },
    ],    'feedback_loops': [
        { q: 'What is the price-hashrate-security feedback loop in Bitcoin?', a: 'Higher price attracts miners, boosting hashrate, security, and confidence in a rising cycle', wrong: ['Higher price causes miners to shut down, reducing hashrate and network security', 'Hashrate and price are completely independent with no meaningful connection', 'Security drops as price rises because more hackers are attracted to attack'] },
        { q: 'How does the adoption-liquidity-utility feedback loop work in Bitcoin?', a: 'More users deepen liquidity, making Bitcoin more useful, which attracts even more users', wrong: ['More users raise fees, which drives away users and decreases overall liquidity', 'Liquidity falls as adoption grows because the total supply is permanently fixed', 'Adoption and liquidity have an inverse relationship in the Bitcoin network'] },
        { q: 'How does the Lindy Effect create a reinforcing feedback loop for Bitcoin?', a: 'Each day Bitcoin survives boosts confidence in its longevity, drawing more adoption', wrong: ['The Lindy Effect means Bitcoin gets less reliable as its codebase ages', 'Older technology always gets replaced, so the Lindy Effect hurts Bitcoin', 'The Lindy Effect only applies to physical objects, not digital protocols'] },
        { q: 'What is reflexivity in the context of Bitcoin market cycles?', a: 'Perceptions influence fundamentals, which reinforce perceptions, creating self-amplifying cycles', wrong: ['Reflexivity means Bitcoin\'s price always reflects its true fundamental value', 'It describes the tendency of Bitcoin to always revert to the same price', 'Reflexivity is a mining technique that increases block production speed'] },
        { q: 'Why are Bitcoin\'s feedback loops considered among the most powerful in economics?', a: 'Multiple self-reinforcing loops in price, hashrate, adoption, and security amplify together', wrong: ['Bitcoin has only one feedback loop but it happens to be extremely strong', 'Bitcoin\'s feedback loops are actually weak compared to traditional market loops', 'Feedback loops only work in bull markets and reverse completely in bear runs'] },
    ],

    'first_principles': [
        { q: 'What does "first principles thinking" mean when applied to Bitcoin?', a: 'Breaking money down to fundamental properties and reasoning up from there', wrong: ['Copying the design of existing currencies and then improving them', 'Following the majority opinion of mainstream economists on money', 'Starting with government approval and working backward from there'] },
        { q: 'Which philosopher is most associated with the first principles method of reasoning from fundamental truths?', a: 'Aristotle', wrong: ['Plato', 'Socrates', 'Descartes'] },
        { q: 'When reasoning from first principles about what makes good money, which set of properties matters most?', a: 'Scarcity, portability, durability, divisibility, and fungibility', wrong: ['Government backing, legal enforcement, and central bank control', 'Physical weight, aesthetic beauty, and historical tradition', 'Ease of printing, widespread banking, and inflation targeting'] },
        { q: 'First principles thinking reveals what fundamental connection between energy and money?', a: 'Money should represent stored energy — unforgeable costliness gives it value', wrong: ['Money has no relationship to energy since it is purely a social construct', 'Only physical commodities can serve as money because they contain atoms', 'Energy is irrelevant to money if a government declares it legal tender'] },
        { q: 'Why does first principles reasoning tend to lead people toward Bitcoin rather than altcoins?', a: 'Bitcoin best satisfies the fundamental properties of sound money from first principles', wrong: ['Bitcoin was the first cryptocurrency so it wins by default over altcoins', 'Altcoins are illegal in most countries so Bitcoin is the only legal option', 'Bitcoin has the best marketing team and strongest brand awareness overall'] },
    ],

    'foss': [
        { q: 'What type of software license does Bitcoin Core use?', a: 'MIT License', wrong: ['GPL v3', 'Apache License 2.0', 'Creative Commons'] },
        { q: 'Why is it important that Bitcoin Core is free and open-source software (FOSS)?', a: 'Anyone can audit the code to verify no backdoors or hidden rules exist', wrong: ['It makes Bitcoin free to use with zero transaction fees for users', 'It allows developers to create unlimited Bitcoin through the code', 'It means no one actually needs to run the Bitcoin software'] },
        { q: 'What are "reproducible builds" in the context of Bitcoin Core?', a: 'A process to compile source code and verify the binary matches the official release', wrong: ['A method of mining Bitcoin blocks more efficiently using parallel processing', 'A way to duplicate Bitcoin wallets for secure backup across multiple devices', 'A technique for copying the entire blockchain to new nodes more quickly'] },
        { q: '"Linus\'s Law" states that "given enough eyeballs, all bugs are shallow." How does this apply to Bitcoin?', a: 'Thousands of developers review Bitcoin\'s code, so vulnerabilities get found and fixed faster', wrong: ['Linux servers are the only machines capable of running Bitcoin full nodes properly', 'Linus Torvalds personally reviews and audits every Bitcoin Core release himself', 'Bitcoin can only run on open-source operating systems like Linux and FreeBSD'] },
        { q: 'Why does open-source matter specifically for money/monetary software like Bitcoin?', a: 'Users must verify the rules of their money — no hidden inflation or secret changes', wrong: ['Open-source software is always faster and more efficient than proprietary code', 'It allows banks to freely copy Bitcoin and make their own branded version', 'It makes Bitcoin significantly easier for governments to regulate and control'] },
    ],

    'geopolitics___macroeconomics_pt2': [
        { q: 'What is the BRICS de-dollarization movement and how does it relate to Bitcoin?', a: 'BRICS nations are reducing dollar dependence, creating demand for neutral reserves like Bitcoin', wrong: ['BRICS is a Bitcoin mining pool that is jointly operated by five nations', 'BRICS nations have collectively banned Bitcoin to protect local currencies', 'BRICS de-dollarization means these countries adopted Bitcoin as legal tender'] },
        { q: 'What is the "strategic Bitcoin reserve" concept that multiple nations are exploring?', a: 'Nations accumulating Bitcoin as a reserve asset alongside gold for its scarcity and hedge value', wrong: ['A requirement for all nations to back their fiat currency reserves with Bitcoin', 'A UN mandate requiring every country to hold at least one thousand Bitcoin', 'A program where central banks replace all existing gold reserves with Bitcoin'] },
        { q: 'What is the "nation-state game theory" argument for Bitcoin adoption?', a: 'Early adopter nations gain a massive strategic edge, pressuring others to follow or fall behind', wrong: ['Nations banning Bitcoin grow stronger because they fully control their money supply', 'Game theory proves that no nation will ever voluntarily adopt Bitcoin as a reserve', 'Nation-state game theory only applies to countries that possess nuclear weapons'] },
        { q: 'How do proponents respond to critics who say Bitcoin is used for sanctions evasion?', a: 'Bitcoin\'s transparent public ledger makes transactions easier to trace than physical cash', wrong: ['Bitcoin supporters agree that sanctions evasion is its primary real-world use case', 'Bitcoin transactions are completely invisible and undetectable to all governments', 'Sanctions don\'t apply to digital assets under any current international law'] },
        { q: 'How do institutions like the IMF and World Bank view Bitcoin?', a: 'Generally hostile — they\'ve pressured nations like El Salvador to drop Bitcoin legal tender status', wrong: ['The IMF and World Bank are actually the largest institutional Bitcoin holders today', 'Both organizations have publicly endorsed Bitcoin as the future of global finance', 'The IMF created Bitcoin as a planned replacement for Special Drawing Rights'] },
    ],

    'governance_pt2': [
        { q: 'Who can submit a Bitcoin Improvement Proposal (BIP)?', a: 'Anyone in the Bitcoin community', wrong: ['Only Bitcoin Core maintainers', 'Only miners with enough hash rate', 'Only officially registered developers'] },
        { q: 'What activation method does BIP 9 use?', a: 'Miner signaling with version bits', wrong: ['User activation without miners', 'Mandatory soft fork by Core devs', 'Core developer approval voting'] },
        { q: 'What activation method does BIP 8 use?', a: 'Mandatory activation with optional miner signaling', wrong: ['Complete miner control over activation timing', 'Exchange approval and coordinated agreement', 'Proof of stake voting by Bitcoin holders'] },
        { q: 'What does UASF stand for?', a: 'User-Activated Soft Fork', wrong: ['Unified Active Soft Fork', 'Universal Auto Soft Fork', 'User Approval Soft Fork'] },
        { q: 'What was Speedy Trial used for in Bitcoin?', a: 'Taproot activation with a shortened signaling period', wrong: ['SegWit activation with extended miner coordination', 'Lightning Network deployment across mainnet nodes', 'Difficulty adjustment algorithm changes and updates'] },
    ],
    'hardware': [
        { q: 'What makes the Coldcard hardware wallet stand out among Bitcoin hardware wallets?', a: 'It\'s air-gapped, Bitcoin-only, and supports NFC signing', wrong: ['It supports thousands of altcoins and NFTs', 'It connects directly to the internet for speed', 'It\'s the cheapest hardware wallet available'] },
        { q: 'What is a PSBT (Partially Signed Bitcoin Transaction) and why is it important for hardware wallets?', a: 'A format for building transactions on one device and signing on another', wrong: ['A Bitcoin address type exclusive to hardware wallets', 'A protocol for sending Bitcoin over Bluetooth', 'A backup format for storing seed phrases digitally'] },
        { q: 'What is SeedSigner?', a: 'A DIY, open-source, air-gapped wallet built on a Raspberry Pi', wrong: ['A cloud service that generates seed phrases for you', 'A proprietary hardware wallet made by Ledger', 'An app that signs transactions via phone fingerprint'] },
        { q: 'What is a "secure element" chip in hardware wallets?', a: 'A tamper-resistant chip that stores keys and blocks extraction', wrong: ['A chip that connects the wallet to Wi-Fi securely', 'A component that speeds up transaction processing', 'A GPS module that tracks the wallet for recovery'] },
        { q: 'What does "air-gapped" mean when describing a hardware wallet like Coldcard or Foundation Passport?', a: 'It never connects to internet — data moves via SD card, QR, or NFC', wrong: ['The wallet is sealed in a vacuum to prevent tampering', 'The wallet uses satellite connections instead of Wi-Fi', 'The wallet can only be used outdoors for security'] },
    ],

    'history_pt3': [
        { q: 'Approximately how many BTC did Mt. Gox lose in its collapse?', a: '850,000 BTC', wrong: ['100,000 BTC', '2 million BTC', '50,000 BTC'] },
        { q: 'What year did the Silk Road marketplace get seized?', a: '2013', wrong: ['2011', '2015', '2017'] },
        { q: 'How many Bitcoins were exchanged for two pizzas on Bitcoin Pizza Day?', a: '10,000 BTC', wrong: ['1,000 BTC', '100,000 BTC', '1,000,000 BTC'] },
        { q: 'What was the main conflict of the Blocksize War?', a: 'Whether to increase block size limit', wrong: ['Changing Bitcoin to proof of stake', 'Adding privacy features to Bitcoin', 'Changing the halving schedule'] },
        { q: 'What was SegWit2x?', a: 'Failed agreement to double block size after SegWit', wrong: ['Successful hard fork increasing block size', 'A new proof-of-work mining algorithm', 'A second layer scaling protocol'] },
    ],

    'improved_incentive_structure': [
        { q: 'How does Bitcoin "fix broken incentives" in the current monetary system?', a: 'By removing money printing, it forces honest accounting and ends inflation of debt', wrong: ['It gives governments better tools to manage the economy', 'It doesn\'t change incentives — just moves them to digital', 'It fixes incentives by making all transactions government-traceable'] },
        { q: 'What does "low time preference society" mean in the context of a Bitcoin standard?', a: 'People plan long-term and save more because their money gains value over time', wrong: ['A society that doesn\'t care about time and works fewer hours', 'A society where transactions must complete within strict time limits', 'A society that only uses Bitcoin for short-term speculation'] },
        { q: 'Why is proof of work considered a "fair distribution" mechanism for new Bitcoin?', a: 'Anyone can mine by spending real energy — no pre-mines or insider allocations', wrong: ['Proof of work gives equal Bitcoin to every person on Earth', 'Early miners got special privileges that later miners don\'t', 'Proof of work distributes Bitcoin based on geographic location'] },
        { q: 'How does sound money (like Bitcoin) change savings and investment behavior?', a: 'People save more and only invest in projects with real returns above deflation', wrong: ['Sound money discourages saving because money becomes too valuable', 'Investment behavior stays the same regardless of monetary system', 'Sound money causes everyone to hoard and collapse the economy'] },
        { q: 'What broken incentive does fiat money create that Bitcoin eliminates?', a: 'Fiat rewards borrowing over saving because inflation erodes purchasing power', wrong: ['Fiat incentivizes too much saving, which Bitcoin fixes', 'Fiat money has no broken incentives — it works as designed', 'Bitcoin creates the same borrow incentive since rates exist'] },
    ],

    'investment-strategy_pt4': [
        { q: 'What is UTXO management for tax optimization?', a: 'Choosing specific UTXOs with known cost bases to minimize capital gains taxes', wrong: ['Automatically hiding Bitcoin transactions from the IRS', 'Converting all UTXOs to altcoins before tax season', 'Splitting Bitcoin into $600 transactions to avoid reporting'] },
        { q: 'What does "step-up in cost basis" mean for inherited Bitcoin?', a: 'Cost basis resets to market price at owner\'s death, erasing prior gains', wrong: ['Inherited Bitcoin is always taxed at the original purchase price', 'There is no tax on inherited Bitcoin in any jurisdiction', 'The cost basis doubles each year after inheritance'] },
        { q: 'What is a Bitcoin IRA?', a: 'A self-directed retirement account holding Bitcoin with tax advantages', wrong: ['A government program that pays retirees in Bitcoin', 'An insurance policy replacing lost or stolen Bitcoin', 'A bank savings account that earns interest in Bitcoin'] },
        { q: 'Why do experienced Bitcoiners warn against lending out your Bitcoin?', a: 'Lending platforms like Celsius and BlockFi collapsed, losing depositor funds', wrong: ['Bitcoin code prevents any form of lending or borrowing', 'Lending Bitcoin causes the network to slow down significantly', 'Bitcoin interest rates are always negative so you lose money'] },
        { q: 'Why is cost basis tracking important for Bitcoin investors?', a: 'Each purchase creates a separate tax lot needed for capital gains calculations', wrong: ['Cost basis tracking is only needed for exchange-held Bitcoin', 'The IRS uses a flat tax rate on all Bitcoin regardless of price', 'Cost basis is irrelevant since Bitcoin is classified as currency'] },
    ],

    'laws_of_thermodynamics': [
        { q: 'How does the First Law of Thermodynamics (conservation of energy) relate to Bitcoin mining?', a: 'Miners convert electricity into computational work securing the ledger', wrong: ['Bitcoin mining creates energy from nothing to power the network', 'The First Law means Bitcoin can only exist in cold climates', 'Energy is destroyed during mining, explaining the high usage'] },
        { q: 'What does "unforgeable costliness" mean in Bitcoin\'s thermodynamic context?', a: 'Real energy must be spent to produce Bitcoin and this cost can\'t be faked', wrong: ['Bitcoin transactions are free because the network is decentralized', 'The cost of mining is purely artificial with no security purpose', 'Unforgeable costliness means Bitcoin wallets cannot be hacked'] },
        { q: 'How does the Second Law of Thermodynamics (entropy always increases) connect to Bitcoin?', a: 'Proof of work creates order in the ledger by increasing entropy via energy use', wrong: ['Bitcoin violates the Second Law by creating value from nothing', 'Entropy has no connection to digital systems like Bitcoin', 'The Second Law means Bitcoin will eventually stop working'] },
        { q: 'Why do some physicists describe proof of work as "thermodynamic security"?', a: 'Reversing the chain would require re-spending all the energy that built it', wrong: ['Because Bitcoin mining rigs get very hot during operation', 'Because proof of work requires cooling systems to function', 'Because thermodynamic equations are used to set transaction fees'] },
        { q: 'What is the "Maxwell\'s Demon" analogy sometimes applied to Bitcoin?', a: 'You can\'t sort molecules or secure a ledger without real energy expenditure', wrong: ['Maxwell\'s Demon is the name of the first Bitcoin mining software', 'It describes a theoretical AI attack that takes over the network', 'It refers to Bitcoin price randomness being like particle motion'] },
    ],
'layer-2-lightning_pt4': [
        { q: 'What is a submarine swap on the Lightning Network?', a: 'A trustless exchange between on-chain and off-chain Bitcoin using HTLCs', wrong: ['A method to secretly close Lightning channels without notice', 'A way to mine Bitcoin directly through Lightning Network nodes', 'An attack vector that drains funds from open Lightning channels'] },
        { q: 'What is Multi-Path Payments (MPP) on Lightning?', a: 'Splitting a payment across multiple routes to exceed single-channel limits', wrong: ['Making multiple payments to different recipients simultaneously', 'A backup payment method used only if Lightning is offline', 'Sending the same payment through multiple channels for redundancy'] },
        { q: 'What is AMP (Atomic Multi-Path Payments) on Lightning?', a: 'A method where split parts are only redeemable together atomically', wrong: ['An amplifier that boosts signal strength between Lightning nodes', 'A method to increase the maximum capacity of any channel', 'An automatic mining protocol built into the Lightning layer'] },
        { q: 'What is trampoline routing on the Lightning Network?', a: 'Delegating route calculation to intermediate nodes for lighter clients', wrong: ['Bouncing payments off satellites for wider global coverage area', 'A routing method that always prioritizes the fastest available path', 'A security protocol that encrypts all payment amounts in transit'] },
        { q: 'What are channel factories in the Lightning Network?', a: 'Opening many channels among multiple parties in one on-chain transaction', wrong: ['Physical facilities where Lightning network nodes are manufactured', 'Automated systems that create channels based on user demand levels', 'Software that converts on-chain wallets into Lightning-ready wallets'] },
    ],

    'layer-2-lightning_pt5': [
        { q: 'What is liquidity management on the Lightning Network?', a: 'Balancing inbound and outbound capacity to reliably route payments', wrong: ['Converting Lightning Bitcoin back to regular on-chain Bitcoin', 'Managing the total circulating supply of Bitcoin on Lightning', 'Keeping Lightning nodes continuously connected to the internet'] },
        { q: 'What is channel rebalancing on Lightning?', a: 'Moving funds between your own channels to redistribute liquidity', wrong: ['Closing and reopening channels with updated funding parameters', 'Resetting all channel state back to the initial funding amount', 'Transferring full channel ownership to a different Lightning node'] },
        { q: 'What is a Lightning Service Provider (LSP)?', a: 'A service offering liquidity and channel management for easy onboarding', wrong: ['An internet service provider that specializes in Bitcoin traffic', 'A government-licensed operator required to run Lightning nodes', 'A cloud service that mines Bitcoin using collected Lightning fees'] },
        { q: 'What are zero-conf channels on Lightning?', a: 'Channels usable immediately without waiting for on-chain confirmation', wrong: ['Channels that require zero Bitcoin as a deposit to open them', 'Channels that provide completely zero-fee routing for payments', 'Channels that are permanent and cannot be closed once opened'] },
        { q: 'How do Lightning routing nodes earn revenue?', a: 'By charging small fees for forwarding payments through their channels', wrong: ['By mining new Bitcoin on the Lightning Network second layer', 'By collecting a percentage of all Lightning transactions globally', 'By selling their channel and routing data to analytics companies'] },
    ],

    'layer-3-sidechains': [
        { q: 'How does the Liquid Network secure its two-way peg to Bitcoin?', a: 'Through a federation of functionaries managing the peg via multisig', wrong: ['Through merge-mining where Bitcoin miners also validate Liquid', 'Through a trustless smart contract deployed on Bitcoin\'s base layer', 'Through proof-of-stake consensus among Liquid token holder nodes'] },
        { q: 'How does RSK (Rootstock) secure its sidechain?', a: 'Through merge-mining where Bitcoin miners also validate RSK blocks', wrong: ['Through a federation of trusted companies that collectively sign', 'Through proof-of-stake where RSK token holders vote on blocks', 'Through BitVM fraud proofs posted to Bitcoin\'s main base layer'] },
        { q: 'What consensus mechanism does Stacks use to connect to Bitcoin?', a: 'Proof of Transfer (PoX), where miners spend BTC to produce blocks', wrong: ['Proof of Work using the same SHA-256 algorithm as Bitcoin mining', 'Delegated Proof of Stake with community-elected block producers', 'Proof of Authority using a fixed and permissioned validator set'] },
        { q: 'What are drivechains (BIP-300) designed to enable?', a: 'Permissionless sidechains with miner-voted withdrawals to mainchain', wrong: ['Faster block times on Bitcoin by reducing difficulty adjustment', 'A new Lightning channel type that skips on-chain funding steps', 'Decentralized mining pools that auto-distribute block rewards'] },
        { q: 'What is the primary security concern with federated sidechains like Liquid?', a: 'Users must trust federation members not to collude and steal funds', wrong: ['The sidechain can reverse Bitcoin base layer transactions at will', 'Federated sidechains consume more energy than Bitcoin\'s proof-of-work', 'The federation has the power to change Bitcoin\'s 21 million cap'] },
    ],

    'maximalism_pt2': [
        { q: 'What do Bitcoiners mean when they call "toxic maximalism" an immune response?', a: 'Aggressive pushback against scams protects newcomers like an immune system', wrong: ['Maximalists spread computer viruses to attack competing altcoin networks', 'Toxic maximalism is a disease Bitcoin developers are actively trying to cure', 'It means Bitcoin\'s code automatically rejects transactions from altcoins'] },
        { q: 'What is the "altcoin opportunity cost" argument made by Bitcoin maximalists?', a: 'Money spent on altcoins could have gone to Bitcoin, which outperforms long-term', wrong: ['Altcoins are free to create so there is no real opportunity cost at all', 'Bitcoin maximalists believe altcoin trading increases Bitcoin\'s overall value', 'Opportunity cost is a fiat concept that does not apply to digital assets'] },
        { q: 'Why do Bitcoin-only companies (like Swan, River, and Unchained) choose not to support altcoins?', a: 'They see promoting altcoins as ethically wrong since most will fail and harm users', wrong: ['They lack the technical capability needed to support other cryptocurrency tokens', 'Government regulations currently prohibit companies from offering multiple cryptos', 'Supporting altcoins would make their exchange and wallet software too slow'] },
        { q: 'What is the "ethical case" for Bitcoin maximalism?', a: 'Promoting risky altcoins to unsophisticated investors causes real financial harm', wrong: ['Bitcoin maximalists believe they have a religious duty to spread adoption', 'Ethics demand that all financial technologies be treated equally by default', 'The ethical case is that Bitcoin miners deserve all cryptocurrency profits'] },
        { q: 'How does Gresham\'s Law ("bad money drives out good") apply to the Bitcoin maximalism argument?', a: 'People spend weak fiat and altcoins while hoarding Bitcoin as the hardest money', wrong: ['Gresham\'s Law proves that cheaper altcoins will eventually replace Bitcoin', 'It means governments will ultimately force citizens to use Bitcoin only', 'Gresham\'s Law only applies to physical coins and not digital currencies'] },
    ],

    'mining_pt5': [
        { q: 'What does Stratum V2 allow individual miners to do that Stratum V1 does not?', a: 'Choose their own transactions for block templates', wrong: ['Mine without needing any internet connection', 'Bypass the network difficulty adjustment algorithm', 'Mine multiple different coins at the same time'] },
        { q: 'What is a block template in Bitcoin mining?', a: 'A candidate block with selected transactions awaiting a valid hash', wrong: ['A design blueprint for building new ASIC mining hardware', 'A backup copy of the entire Bitcoin blockchain ledger', 'A reusable template for creating new cryptocurrency mining pools'] },
        { q: 'What is a selfish mining attack?', a: 'Withholding discovered blocks to gain an unfair chain advantage', wrong: ['Refusing to share mining profits with other pool members', 'Mining only low-fee transactions for the miner\'s personal gain', 'Using stolen electricity to illegally power Bitcoin mining rigs'] },
        { q: 'What is ASICBoost?', a: 'A technique that optimizes SHA-256 to reduce energy per hash', wrong: ['A specific brand of mining hardware manufactured by Bitmain', 'A firmware update that automatically doubles any miner\'s hashrate', 'A method to cool ASIC miners using advanced liquid nitrogen'] },
        { q: 'What is the difference between overt and covert ASICBoost?', a: 'Overt is visible in block headers; covert is hidden from view', wrong: ['Overt is legal in all jurisdictions while covert is illegal', 'Overt uses significantly more energy per hash than covert does', 'Overt works on any ASIC while covert is Bitmain hardware only'] },
    ],'mining_pt6': [
        { q: 'What is "hash price" in Bitcoin mining economics?', a: 'Revenue earned per unit of hash rate per day', wrong: ['Cost to purchase a single ASIC miner', 'Bitcoin\'s price divided by total hash rate', 'Electricity cost per hash computation'] },
        { q: 'What typically happens to less efficient miners shortly after a Bitcoin halving?', a: 'They become unprofitable and may shut down', wrong: ['They automatically receive double the reward', 'Their hash rate doubles to compensate', 'They permanently switch to mining altcoins'] },
        { q: 'What is the typical operational lifespan of an ASIC miner before it becomes obsolete?', a: 'Approximately 3 to 5 years', wrong: ['About 6 months on average', 'Over 20 years with maintenance', 'Exactly one halving cycle'] },
        { q: 'What is the breakeven electricity cost for Bitcoin mining?', a: 'The kWh price where revenue equals costs', wrong: ['A fixed rate set by Bitcoin developers', 'The average electricity cost worldwide', 'The minimum power to run one ASIC'] },
        { q: 'As block subsidies decrease over time, what must replace them to incentivize miners?', a: 'Transaction fees paid by users', wrong: ['Government subsidies for miners', 'Increased mining difficulty', 'New coins from hard forks'] },
    ],

    'misconceptions-fud_pt2': [
        { q: 'How do Bitcoiners respond to "Bitcoin is too volatile to be money"?', a: 'Every 4-year period has been profitable and volatility decreases over time', wrong: ['They agree volatility makes Bitcoin unsuitable as money', 'They say volatility doesn\'t exist if you ignore the price', 'They claim Bitcoin\'s price is actually fixed by miners'] },
        { q: 'Why is the claim "quantum computers will break Bitcoin" misleading?', a: 'Such computers don\'t exist yet and Bitcoin can upgrade before they do', wrong: ['Bitcoin already uses quantum-resistant encryption algorithms', 'Quantum computers actually strengthen Bitcoin\'s security', 'Satoshi designed Bitcoin to be immune to all future computing'] },
        { q: 'What is the rebuttal to "Tether (USDT) props up Bitcoin\'s price"?', a: 'Bitcoin grew for years before Tether and kept rising through its controversies', wrong: ['Tether holds 100% of its reserves in Bitcoin directly', 'Bitcoin\'s price is determined solely by mining costs', 'Tether was created by Satoshi as part of Bitcoin\'s design'] },
        { q: 'Why is "Bitcoin is a pyramid scheme" factually wrong?', a: 'It has no company, no CEO, no return promises, and no recruitment profits', wrong: ['Because early adopters are guaranteed profits by the protocol', 'Because Satoshi Nakamoto still runs the company behind Bitcoin', 'Because the Bitcoin protocol pays dividends to long-term holders'] },
        { q: 'What is the strongest argument against "governments will ban Bitcoin"?', a: 'China banned it multiple times yet it kept growing, and the US approved ETFs', wrong: ['Governments lack the technology to detect Bitcoin transactions', 'International law prevents any country from banning crypto', 'Bitcoin automatically shuts down in countries where it\'s banned'] },
    ],

    'nodes_pt4': [
        { q: 'What is the key difference between a pruned node and an archival (full) node?', a: 'A pruned node deletes old block data after verifying it', wrong: ['A pruned node skips transaction verification entirely', 'An archival node only stores the UTXO set', 'A pruned node cannot validate new transactions'] },
        { q: 'What does BIP 152 (Compact Block Relay) do?', a: 'Sends short transaction IDs instead of full transactions', wrong: ['Compresses the entire blockchain into smaller files', 'Allows nodes to skip blocks during initial sync', 'Encrypts block data for privacy between nodes'] },
        { q: 'What is the Erlay protocol designed to improve?', a: 'Transaction relay efficiency between nodes', wrong: ['Block mining speed via nonce optimization', 'Lightning Network channel capacity', 'Wallet synchronization for mobile devices'] },
        { q: 'What is the UTXO set and why does its size matter for nodes?', a: 'All unspent outputs nodes must keep in memory for validation', wrong: ['A list of all transactions ever made on Bitcoin', 'A record of all mining rewards ever distributed', 'A backup of private keys stored across the network'] },
        { q: 'What is a major concern about running a Bitcoin full node related to bandwidth?', a: 'Relaying transactions and blocks uses significant upload bandwidth', wrong: ['Nodes must pay per-megabyte fees to the network', 'Bandwidth usage is zero after initial block download', 'Only mining nodes consume significant bandwidth'] },
    ],

    'nodes_pt5': [
        { q: 'What programming language is Bitcoin Core primarily written in?', a: 'C++', wrong: ['Rust', 'Python', 'Java'] },
        { q: 'What is btcd?', a: 'An alternative Bitcoin full node written in Go', wrong: ['A Bitcoin wallet for desktop computers', 'A command-line tool for Bitcoin mining', 'A testing framework for Bitcoin Core'] },
        { q: 'What are reproducible builds in the context of Bitcoin Core?', a: 'Anyone can compile source and get an identical binary', wrong: ['A system where Bitcoin Core auto-updates itself', 'A method to restore a node from a backup', 'A way to compile Bitcoin Core faster on CPUs'] },
        { q: 'What is Guix used for in Bitcoin Core development?', a: 'A build system for reproducible, verifiable builds', wrong: ['A graphical interface for running a Bitcoin node', 'A security scanner for checking vulnerabilities', 'A package manager for installing Bitcoin wallets'] },
        { q: 'Why is it important to be able to build Bitcoin Core from source?', a: 'To verify the code and ensure your binary matches it', wrong: ['Because pre-built binaries aren\'t available', 'To get access to hidden developer features', 'Because source builds make the node faster'] },
    ],

    'op-codes_pt2': [
        { q: 'What would OP_CAT enable if re-enabled?', a: 'Concatenation of data values in script', wrong: ['Comparison of timestamp values', 'Multiplication of numeric values', 'Direct verification of signatures'] },
        { q: 'What does OP_CHECKSIGFROMSTACK verify?', a: 'Arbitrary message signatures on the stack', wrong: ['Only standard transaction signatures', 'Block signatures submitted by miners', 'Lightning Network commitment signatures'] },
        { q: 'What is Simplicity designed for in Bitcoin?', a: 'Formal verification of smart contracts', wrong: ['Faster transaction processing speeds', 'Simplified wallet address formats', 'Reduced overall block sizes'] },
        { q: 'What is a major limitation of Bitcoin Script?', a: 'No loops or complex control flow', wrong: ['Maximum of 100 opcodes per script', 'Cannot handle any signatures', 'Requires active internet access'] },
        { q: 'Which script type was introduced with Taproot?', a: 'P2TR (Pay to Taproot)', wrong: ['P2SH (Pay to Script Hash)', 'P2WSH (Pay to Witness Script)', 'P2PKH (Pay to Pub Key Hash)'] },
    ],'orange-pilling_pt2': [
        { q: 'What is the "Socratic method" approach to orange-pilling someone about Bitcoin?', a: 'Asking questions that lead them to discover Bitcoin\'s value themselves', wrong: ['Quoting ancient Greek philosophers who predicted digital money', 'Having the person read the Bitcoin whitepaper out loud to you', 'Debating them aggressively until they agree Bitcoin is good'] },
        { q: 'What is "progressive disclosure" when introducing someone to Bitcoin?', a: 'Starting with simple concepts they care about, then going deeper', wrong: ['Showing them Bitcoin\'s full transaction history from genesis', 'Revealing your entire Bitcoin portfolio to build their trust', 'Disclosing all of Bitcoin\'s technical flaws upfront to seem honest'] },
        { q: 'When orange-pilling family members, what is generally the most effective approach?', a: 'Focus on what they care about — savings, retirement, their future', wrong: ['Send them a 3-hour technical podcast about mining and hashing', 'Buy them Bitcoin without asking and surprise them with it later', 'Bring it up at every family dinner until they finally agree'] },
        { q: 'What is one of the biggest mistakes people make when trying to orange-pill someone?', a: 'Information overload — dumping too much detail at once', wrong: ['Being too patient and waiting for them to ask questions', 'Starting with how Bitcoin helps people in other countries', 'Recommending they read a book about the history of money'] },
        { q: 'Which book is widely considered the best starting point for orange-pilling someone interested in economics and sound money?', a: 'The Bitcoin Standard by Saifedean Ammous', wrong: ['Mastering Bitcoin by Andreas Antonopoulos', 'Programming Bitcoin by Jimmy Song', 'The Blocksize War by Jonathan Bier'] },
    ],

    'ordinals_inscriptions': [
        { q: 'Who proposed the Ordinal Theory for Bitcoin?', a: 'Casey Rodarmor', wrong: ['Adam Back', 'Pieter Wuille', 'Satoshi Nakamoto'] },
        { q: 'How are individual satoshis numbered in Ordinal Theory?', a: 'Sequentially based on mining order', wrong: ['Randomly assigned by the network', 'By their transaction ID hash', 'By the receiving wallet address'] },
        { q: 'What do inscriptions attach to specific satoshis?', a: 'Arbitrary data like images or text', wrong: ['Private keys for spending them', 'Their full transaction history', 'Multisig spending conditions'] },
        { q: 'What token standard emerged from Ordinals functionality?', a: 'BRC-20', wrong: ['ERC-20', 'RGB', 'Omni Layer'] },
        { q: 'What was a major criticism of Ordinals regarding block space?', a: 'They use limited block space for non-monetary data', wrong: ['They significantly reduce mining reward amounts', 'They break Bitcoin\'s core consensus rules', 'They allow theft of other users\' funds'] },
    ],

    'philosophy_pt2': [
        { q: 'Who wrote the Cypherpunk Manifesto?', a: 'Eric Hughes', wrong: ['Timothy May', 'Julian Assange', 'Nick Szabo'] },
        { q: 'What concept did Timothy May advocate for in the Crypto-Anarchist Manifesto?', a: 'Using cryptography to protect individual privacy', wrong: ['Building centralized digital currency systems', 'Government regulation of all encryption tools', 'Corporate ownership of communication networks'] },
        { q: 'What was Nick Szabo\'s Bit Gold concept?', a: 'A digital collectible using proof of work', wrong: ['A stablecoin backed by physical gold', 'A centralized government digital currency', 'A Lightning-style payment channel design'] },
        { q: 'What did Wei Dai propose with b-money?', a: 'Anonymous digital cash with decentralized minting', wrong: ['A blockchain with standard mining rewards', 'A central bank controlled digital currency', 'A system of gold-backed certificates'] },
        { q: 'What was Hal Finney\'s famous contribution to Bitcoin?', a: 'Received the first Bitcoin transaction from Satoshi', wrong: ['Wrote the original Bitcoin whitepaper himself', 'Created the SHA-256 based mining algorithm', 'Founded the first Bitcoin trading exchange'] },
    ],

    'privacy-nonkyc_pt4': [
        { q: 'What is a PayJoin (P2EP) transaction?', a: 'Both sender and receiver contribute inputs, obscuring who paid whom', wrong: ['A payment split equally between two participating parties', 'A transaction requiring two separate network confirmations', 'A joint mining operation shared between two mining pools'] },
        { q: 'What are Silent Payments (BIP 352)?', a: 'One static address generates a unique on-chain address per payment', wrong: ['Transactions that are hidden from the public mempool entirely', 'Payments delayed until network activity drops to low levels', 'A method to send Bitcoin without paying any transaction fees'] },
        { q: 'What is the Boltzmann entropy score used for in Bitcoin privacy?', a: 'Measuring ambiguity of a transaction\'s input-output linkages', wrong: ['Calculating the thermodynamic energy cost of a transaction', 'Rating the randomness quality of a wallet\'s seed phrase', 'Scoring how quickly a transaction will get confirmed'] },
        { q: 'What does Whirlpool do for Bitcoin privacy?', a: 'Mixes UTXOs via CoinJoin to break transaction history links', wrong: ['Provides a VPN service designed specifically for Bitcoin nodes', 'Encrypts Bitcoin transactions end-to-end before broadcast', 'Runs a privacy coin layer on top of the Bitcoin blockchain'] },
        { q: 'What is CoinSwap and how does it differ from CoinJoin?', a: 'Uses atomic swaps so mixing is invisible on-chain, unlike CoinJoin', wrong: ['Converts Bitcoin to privacy coins and back for mixing purposes', 'Is faster but provides less privacy protection than CoinJoin', 'Requires a trusted third party while CoinJoin does not need one'] },
    ],

    'problems-of-money_pt4': [
        { q: 'The Cantillon Effect describes how newly printed money benefits those closest to its creation. Who benefits MOST from money printing?', a: 'Banks and the politically connected who receive new money first', wrong: ['Average workers who receive higher wages from inflation', 'Retirees on fixed incomes who get cost-of-living adjustments', 'Small business owners who can raise their prices immediately'] },
        { q: 'What is Quantitative Easing (QE)?', a: 'A central bank creating new money to buy bonds, expanding supply', wrong: ['A method of reducing government debt by printing less money', 'A technique for making international trade easier between nations', 'A system where banks lend to each other at zero percent interest'] },
        { q: 'What is the "repo market" and why does it matter for understanding fiat fragility?', a: 'Overnight lending market using bonds as collateral — its 2019 crisis exposed systemic fragility', wrong: ['A marketplace where banks sell repossessed homes and vehicles for profit', 'A government repository that stores and audits physical gold reserves', 'A database where central banks track and monitor all global transfers'] },
        { q: 'What is the "Eurodollar system"?', a: 'US dollars held and created by banks outside the US, forming a shadow system', wrong: ['The system that converts Euros to Dollars at European exchange desks', 'A European Central Bank program to replace the Dollar with the Euro', 'A cryptocurrency project backed equally by both Euros and US Dollars'] },
        { q: 'What does the decline of the "petrodollar" system mean for global finance?', a: 'Oil nations moving away from dollar pricing weakens its reserve status', wrong: ['Oil companies are switching from drilling to mining Bitcoin instead', 'The petrodollar decline means that oil is becoming nearly worthless', 'European nations are being forced to buy all their oil with gold'] },
    ],    'regulation_pt3': [
        { q: 'In the US, what is the key difference between SEC and CFTC jurisdiction over digital assets?', a: 'SEC regulates securities (most altcoins); CFTC regulates Bitcoin as a commodity', wrong: ['SEC handles Bitcoin while CFTC handles all altcoins separately', 'Both agencies share identical authority over all digital assets', 'CFTC only regulates physical commodities, not any digital assets'] },
        { q: 'What is the Howey Test and how does it apply to Bitcoin?', a: 'A legal test for securities — Bitcoin fails to qualify since it has no central enterprise', wrong: ['A technical test that measures a blockchain\'s degree of decentralization', 'Bitcoin fails the Howey Test, making it an SEC-regulated security asset', 'A test that determines the appropriate tax rate on crypto investments'] },
        { q: 'What is the "Travel Rule" in cryptocurrency regulation?', a: 'A FATF rule requiring institutions to share sender/receiver identity above a threshold', wrong: ['A regulation that limits Bitcoin transfers to within a single country', 'A requirement for Bitcoin miners to register their physical locations', 'A law that bans carrying hardware wallets across international borders'] },
        { q: 'What is the FATF and why is it significant for Bitcoin privacy?', a: 'An international body pushing KYC/AML standards that threaten self-custodial privacy', wrong: ['A global mining consortium that coordinates difficulty adjustment levels', 'A nonprofit organization promoting Bitcoin adoption in developing nations', 'A technology standard designed for faster Bitcoin transaction processing'] },
        { q: 'How have US states approached Bitcoin regulation differently from the federal government?', a: 'Several states passed pro-Bitcoin laws like reserve bills and transmitter exemptions', wrong: ['All 50 states enforce identical cryptocurrency regulations matching federal law', 'States are constitutionally prohibited from creating crypto-related legislation', 'Most states have banned Bitcoin mining operations due to energy concerns'] },
    ],

    'rollups': [
        { q: 'What is a validity rollup on Bitcoin?', a: 'A system that bundles off-chain transactions and posts a ZK proof to Bitcoin', wrong: ['A sidechain that copies Bitcoin\'s consensus rules exactly as written', 'A Lightning Network channel that batches together multiple payments', 'A mining pool feature that combines block templates from miners'] },
        { q: 'How do sovereign rollups differ from validity rollups?', a: 'Users verify rollup state themselves rather than relying on the base layer', wrong: ['Sovereign rollups use a central authority; validity rollups are decentralized', 'Sovereign rollups use proof-of-stake; validity rollups use proof-of-work', 'Sovereign rollups are limited to only seven transactions per second'] },
        { q: 'How could BitVM enable rollups on Bitcoin?', a: 'By allowing fraud proofs to verify rollup state without needing new opcodes', wrong: ['By adding a Turing-complete VM directly into Bitcoin\'s consensus layer', 'By creating a dedicated sidechain specifically for validating rollup data', 'By replacing Bitcoin\'s existing Script language with Solidity contracts'] },
        { q: 'How do Bitcoin rollups differ from sidechains?', a: 'Rollups post proofs or data to Bitcoin, inheriting its security guarantees', wrong: ['Rollups use a separate token for gas while sidechains use native BTC', 'Rollups need a federation of signers while sidechains are fully trustless', 'Rollups are faster than sidechains but limited to simple transfers only'] },
        { q: 'What is the main trust assumption difference between a validity rollup and an optimistic rollup?', a: 'Validity rollups prove correctness upfront; optimistic rollups assume it until challenged', wrong: ['Validity rollups trust a federation of signers; optimistic rollups trust miners', 'Validity rollups need a soft fork to work; optimistic rollups work on Bitcoin today', 'Validity rollups are run centrally; optimistic rollups are always fully decentralized'] },
    ],

    'self-custody_pt3': [
        { q: 'What is Sparrow Wallet known for in multisig coordination?', a: 'Deep UTXO management and easy multisig setup with hardware signers', wrong: ['A mobile-only wallet with cloud-based multisig coordination', 'A hardware wallet that stores multiple seed phrases internally', 'A browser extension designed primarily for Lightning payments'] },
        { q: 'What is a PSBT (Partially Signed Bitcoin Transaction)?', a: 'A standard format letting a transaction be built and signed by multiple parties', wrong: ['A special Bitcoin transaction type that only sends partial amounts', 'A privacy protocol that hides the identity of a transaction sender', 'A transaction format exclusively used by mining pool operators'] },
        { q: 'What are output descriptors in Bitcoin?', a: 'A standard way to describe how a wallet derives addresses for reliable recovery', wrong: ['Labels attached to individual transaction outputs for bookkeeping purposes', 'A complete list of all outputs ever created on the Bitcoin blockchain', 'Metadata that mining pools attach to the transactions they broadcast'] },
        { q: 'Why is multisig generally preferred over Shamir Secret Sharing (SSS) for Bitcoin custody?', a: 'Multisig never reconstructs the full private key in one place; SSS does when signing', wrong: ['Multisig transactions cost significantly less in fees than SSS schemes', 'SSS requires more hardware devices to operate than multisig setups', 'Multisig predates SSS and has substantially better documentation available'] },
        { q: 'What is Nunchuk known for in the Bitcoin wallet space?', a: 'Easy collaborative multisig setup and built-in inheritance planning', wrong: ['Being the first wallet to natively support Lightning payments', 'A hardware-only wallet designed exclusively for cold storage use', 'A privacy wallet that uses CoinJoin mixing transactions by default'] },
    ],

    'self-custody_pt4': [
        { q: 'Why is titanium preferred over stainless steel for seed phrase backup plates?', a: 'Higher melting point and better corrosion resistance in extreme conditions', wrong: ['Titanium is significantly cheaper and more widely available worldwide', 'Titanium plates can fit more seed words than steel backup plates', 'Titanium is the only metal undetectable by standard metal detectors'] },
        { q: 'What is a passphrase (25th word) in Bitcoin seed phrase security?', a: 'An extra user-chosen word that generates an entirely different wallet', wrong: ['The password you enter to unlock your hardware wallet device', 'A recovery phrase issued to you by the wallet manufacturer', 'An encryption key used to protect the local blockchain data'] },
        { q: 'Why is geographic distribution important for Bitcoin seed phrase storage?', a: 'It protects against localized disasters destroying all backup copies at once', wrong: ['It speeds up the wallet by routing through the nearest Bitcoin nodes', 'It is a legal requirement enforced in most regulatory jurisdictions', 'It mathematically increases the entropy of the generated seed phrase'] },
        { q: 'What is a dead man\'s switch in Bitcoin inheritance planning?', a: 'A mechanism that triggers key release if the owner fails to check in', wrong: ['A physical switch on hardware wallets that wipes them if tampered', 'A transaction that auto-sends all Bitcoin to a burn address on a timer', 'A self-destruct feature built directly into the Bitcoin Core software'] },
        { q: 'What is the biggest risk of not having a Bitcoin inheritance plan?', a: 'Your Bitcoin could be permanently lost since no one else has the keys', wrong: ['The government will automatically seize all of your Bitcoin holdings', 'Your Bitcoin gets redistributed among other active network participants', 'Your Bitcoin will steadily lose value without an actively managed wallet'] },
    ],

    'softwar_pt2': [
        { q: 'What military rank is Jason Lowery?', a: 'Major', wrong: ['Colonel', 'Lieutenant', 'Captain'] },
        { q: 'What university did Jason Lowery work with on his thesis?', a: 'MIT', wrong: ['Harvard', 'Stanford', 'Caltech'] },
        { q: 'According to Softwar, what does proof of work project?', a: 'Physical power through cyberspace', wrong: ['Financial return on investment', 'Social consensus via voting', 'Network speed and throughput'] },
        { q: 'How does Softwar view Bitcoin for nation-states?', a: 'A strategic defense technology', wrong: ['A replacement for fiat currency', 'A consumer payment system', 'An unregulated security asset'] },
        { q: 'What energy concept is central to the Softwar thesis?', a: 'Using energy to secure cyberspace property', wrong: ['Reducing global carbon emissions', 'Accelerating solar power adoption', 'Profiting from energy arbitrage'] },
    ],
    'spv': [
        { q: 'What does SPV (Simplified Payment Verification) allow a lightweight client to do?', a: 'Verify transaction inclusion using block headers and Merkle proofs', wrong: ['Mine Bitcoin blocks using minimal computing power', 'Send transactions without paying any network fees', 'Run a full node on a mobile phone with limited storage'] },
        { q: 'What privacy problem did the original SPV bloom filters (BIP-37) have?', a: 'They leaked which addresses the wallet cared about to the server', wrong: ['They revealed the user\'s IP address to every network node', 'They broadcast the user\'s seed phrase as part of filter data', 'They required users to share real names with node operators'] },
        { q: 'What do BIP-157 and BIP-158 (compact block filters) improve over bloom filters?', a: 'Clients download pre-computed filters without revealing their addresses', wrong: ['They compress the entire blockchain into a single downloadable file', 'They allow nodes to verify transactions without any network access', 'They replace Merkle proofs with zero-knowledge proofs for speed'] },
        { q: 'What is Neutrino in the context of Bitcoin light clients?', a: 'A light client protocol using BIP-157/158 compact block filters', wrong: ['A privacy coin built as a Bitcoin sidechain project', 'A mining algorithm designed for mobile phone hardware', 'A wallet that runs a full node in the cloud for you'] },
        { q: 'What is the main security tradeoff of SPV compared to running a full node?', a: 'SPV clients trust miners produce valid blocks without full verification', wrong: ['SPV clients cannot receive Bitcoin, they can only send it', 'SPV clients must pay higher transaction fees than full nodes', 'SPV clients can only connect to one peer node at a time'] },
    ],

    'submarine_swap_pt2': [
        { q: 'What is a Loop Out in Lightning?', a: 'Moving funds from Lightning back to on-chain', wrong: ['Opening a new payment channel', 'Receiving inbound Lightning payments', 'Closing all channels at once'] },
        { q: 'What is Boltz Exchange known for?', a: 'Trustless on-chain and Lightning swaps', wrong: ['Running a Bitcoin mining pool', 'Operating a centralized exchange', 'Selling Bitcoin hardware wallets'] },
        { q: 'What makes submarine swaps trustless?', a: 'Atomic hash time-locked contracts', wrong: ['Multi-signature escrow wallets', 'Trusted third-party verification', 'Proof of stake consensus rules'] },
        { q: 'How do submarine swaps differ from atomic swaps?', a: 'They move between layers of the same chain', wrong: ['Submarine swaps always require trust', 'Atomic swaps are significantly faster', 'Submarine swaps use different coins'] },
        { q: 'What enables cross-chain atomic swaps without intermediaries?', a: 'HTLCs combining hashlock and timelock', wrong: ['Trusted custodial escrow services', 'Centralized exchange order books', 'Smart contract platforms only'] },
    ],

    'tail_emission': [
        { q: 'What is "tail emission" in the context of cryptocurrency monetary policy?', a: 'A small perpetual block reward ensuring miners always get some subsidy', wrong: ['The final Bitcoin expected to be mined around the year 2140', 'The process of burning unsold Bitcoin to reduce total supply', 'A mechanism that increases block rewards over time for miners'] },
        { q: 'Which major cryptocurrency implements tail emission as part of its monetary policy?', a: 'Monero, with a permanent minimum reward of 0.6 XMR per block', wrong: ['Bitcoin, which added tail emission in the Taproot upgrade', 'Ethereum, which introduced it during the merge to proof of stake', 'Litecoin, which activated it after its third halving event'] },
        { q: 'What concern about Bitcoin\'s long-term security does the tail emission debate address?', a: 'Whether fees alone can incentivize miners after block rewards end', wrong: ['Whether Bitcoin\'s encryption can withstand quantum computers', 'Whether the 21 million supply cap should be raised over time', 'Whether nodes will have enough storage for the growing chain'] },
        { q: 'What is the main argument AGAINST adding tail emission to Bitcoin?', a: 'It would break the 21 million cap and destroy sound money credibility', wrong: ['Tail emission would make mining too profitable and attract too many', 'It would speed up transaction confirmation times excessively', 'Tail emission is technically impossible to implement on Bitcoin'] },
        { q: 'What is the "fee market sufficiency" argument against the need for tail emission?', a: 'Growing adoption and scarce block space will naturally raise fee revenue', wrong: ['Miners will voluntarily work for free because they believe in Bitcoin', 'The government will subsidize mining to keep the network running', 'New Bitcoin will be discovered on the network like finding new gold'] },
    ],

    'time_preference_pt3': [
        { q: 'According to Saifedean Ammous in "The Bitcoin Standard," what is the relationship between sound money and time preference?', a: 'Sound money lowers time preference, encouraging saving and long-term investment', wrong: ['Sound money raises time preference because people rush to spend currency', 'There is no meaningful relationship between money type and time preference', 'Sound money eliminates time preference, making people totally indifferent'] },
        { q: 'How does Ammous argue that low time preference connects to civilization building?', a: 'People invest in long-term projects when money reliably holds its value', wrong: ['Civilizations advance fastest when people spend money as quickly as possible', 'Low time preference leads to stagnation because nobody takes any risks', 'Civilization building is completely unrelated to the monetary system'] },
        { q: 'What behavioral effect does fiat money have on time preference according to the Austrian economics perspective?', a: 'Fiat raises time preference — inflation punishes savers and rewards debtors', wrong: ['Fiat lowers time preference because stable inflation aids long-term planning', 'Fiat has no effect on time preference, which is determined by culture', 'Fiat encourages saving because interest rates compensate for inflation'] },
        { q: 'How does the concept of delayed gratification relate to Bitcoin and sound money?', a: 'Sound money rewards patience by preserving purchasing power over time', wrong: ['Delayed gratification is irrelevant to any monetary system design', 'Bitcoin punishes patience because its price is far too volatile', 'Sound money discourages waiting by making everything too expensive'] },
        { q: 'What is the key difference between how fiat and Bitcoin influence personal financial behavior?', a: 'Fiat incentivizes consumption and debt; Bitcoin incentivizes saving', wrong: ['Both systems produce identical behavior — spending stays the same', 'Bitcoin makes people spend more as they feel wealthy from gains', 'Fiat encourages saving; Bitcoin encourages spending due to deflation'] },
    ],

    'vbyte': [
        { q: 'What is a virtual byte (vbyte) in Bitcoin?', a: 'A unit where 1 vbyte equals 4 weight units, used for fee calculation', wrong: ['A compressed byte format that reduces transaction size by 75%', 'The amount of data a Bitcoin node can process per second', 'A unit measuring the electricity cost of validating transactions'] },
        { q: 'How did SegWit change the way Bitcoin transaction fees are calculated?', a: 'Fees use weight units or vbytes, giving witness data a discount', wrong: ['SegWit made all transactions free for the first year after launch', 'SegWit replaced fee priority with a first-come-first-served queue', 'SegWit doubled the base fee rate for all transaction types'] },
        { q: 'What is the witness discount ratio in SegWit?', a: 'Witness data costs 1 weight unit per byte; non-witness costs 4', wrong: ['Witness data is free; non-witness data costs 2 weight units', 'Both witness and non-witness data cost 2 weight units per byte', 'Witness data costs 3 weight units; non-witness data costs 4'] },
        { q: 'Why is understanding vbytes important for optimizing Bitcoin transaction costs?', a: 'Using SegWit addresses moves data into the discounted witness section', wrong: ['Vbytes determine how many confirmations a transaction needs', 'Using fewer vbytes increases the mining reward for the block', 'Transactions with more vbytes get higher priority in mempool'] },
        { q: 'A typical single-input, single-output SegWit transaction is approximately how many vbytes?', a: 'About 110 vbytes', wrong: ['About 500 vbytes', 'About 10 vbytes', 'About 1,000 vbytes'] },
    ],

};

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

    // Use topic-based ID so perfect scores are tracked per topic
    var questId = targetChannelId ? ('quest_' + targetChannelId) : ('quest_dynamic_' + questCount);
    // Block retake if user already got a perfect 5/5 on this topic
    if (targetChannelId && completedQuests.has(questId)) {
        if (typeof showToast === 'function') showToast('\u2705 You already aced ' + targetChannelId.replace(/[-_]+/g, ' ') + ' with a perfect score!');
        return;
    }
    if (!targetChannelId && completedQuests.has(questId)) return;

    // Track these questions as asked
    const newAsked = [...askedQuestions, ...selected.map(q => q.q)];
    localStorage.setItem('btc_asked_questions', JSON.stringify(newAsked));

    // Build multiple choice format
    const questions = selected.map(q => {
        const options = [q.a, ...q.wrong].sort(() => Math.random() - 0.5);
        const correctIdx = options.indexOf(q.a);
        return { q: q.q, options, answer: correctIdx };
    });

    currentQuest = { id: questId, topicKey: targetChannelId || null, title: getQuestTitle(questCount, targetChannelId), questions };

    // Register quest server-side for secure grading
    window._currentQuestServerId = null;
    if (typeof firebase !== 'undefined' && firebase.functions) {
        firebase.functions().httpsCallable('startQuest')({
            questions: questions.map(function(q) { return { answer: q.answer }; }),
            topicKey: targetChannelId || null
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
            msg = '😅 ' + score + '/5 — Better luck next time! Keep reading and try again.';
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

        // Satoshi's Favor: 3 daily quests completed = 1 point
        if (qLog.count === 3) {
            // contributeSatoshiFavor handles all Nacho announcements internally
            if (typeof window.contributeSatoshiFavor === 'function') {
                window.contributeSatoshiFavor('quiz_daily_3');
            }
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
        var label = key.replace(/_pt(\d+)$/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
        var ptMatch = key.match(/_pt(\d+)$/);
        if (ptMatch) label += ' (Part ' + ptMatch[1] + ')';
        var baseKey2 = key.replace(/_pt\d+$/, '');
        var emoji = topicEmojis[key] || topicEmojis[baseKey2] || '📖';
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
        '<div style="color:var(--text-muted);font-size:0.82rem;margin-bottom:16px;">Community mining when the community earns 21 points</div>';

    if (isActive) {
        var endBase = state.favorEndBase ? state.favorEndBase.toMillis() : 0;
        var bonusMs = (state.bonusMinutes || 0) * 60 * 1000;
        var remainingMs = (endBase + bonusMs) - Date.now();
        var remainingMin = Math.floor(remainingMs / 60000);
        var remainingSec = Math.floor((remainingMs % 60000) / 1000);

        html += '<div style="background:linear-gradient(135deg,rgba(247,147,26,0.15),rgba(247,147,26,0.05));border:2px solid var(--accent);border-radius:12px;padding:16px;margin-bottom:16px;animation:favorPulse 2s ease-in-out infinite;">' +
            '<div style="font-size:1.2rem;font-weight:800;color:var(--accent);margin-bottom:8px;">🎉 SATOSHI\'S FAVOR IS ACTIVE!</div>' +
            '<div style="font-size:2rem;font-weight:900;color:#fff;font-family:monospace;" id="favorTabTimer">' + remainingMin + 'm ' + remainingSec + 's</div>' +
            '<div style="color:var(--text-muted);font-size:0.8rem;margin-top:8px;">Mine below 1,000 to win 21,000 sats!</div>' +
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

    html += '<div style="background:rgba(247,147,26,0.06);border:1px solid rgba(247,147,26,0.2);border-radius:10px;padding:12px;text-align:left;font-size:0.78rem;color:var(--text-muted);line-height:1.5;">' +
        '<strong style="color:var(--accent);">How it works:</strong><br>' +
        'This is a <strong>community challenge</strong> — everyone\'s points combine!<br><br>' +
        '• Complete 3 daily quiz quests = 1 point<br>' +
        '• Earn a badge = 1 point<br>' +
        '• Level up to Pleb/Stacker ranks = 1 point each<br>' +
        '• Level up to Maxi ranks = 5 points each<br>' +
        '• Level up to Papa John or higher = 10 points<br>' +
        '• At 21 points, a mining competition opens for 60 minutes<br>' +
        '• Extra points beyond 21 add +3 min each (even while active!)<br>' +
        '• 10 hashes max per minute per user (60 second cooldown)<br>' +
        '• Generate a random hash. Below 1,000 = win 21,000 sats!'
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

    html += '</div>';
    body.innerHTML = html;

    // Load top hashes + personal best
    _loadFavorLeaderboards();

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
};

function _loadFavorLeaderboards() {
    if (typeof db === 'undefined') return;
    var myUid = (typeof auth !== 'undefined' && auth && auth.currentUser) ? auth.currentUser.uid : null;

    // Top 10 lowest hashes
    db.collection('satoshiFavor').doc('topHashes').get().then(function(doc) {
        var el = document.getElementById('favorTopHashes');
        if (!el) return;
        if (!doc.exists || !doc.data().entries || doc.data().entries.length === 0) {
            el.innerHTML = '<div style="text-align:center;color:var(--text-faint);padding:8px;">No hashes yet. Be the first to mine!</div>';
            return;
        }
        var entries = doc.data().entries;
        var html = '';
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            var isMe = e.uid === myUid;
            var rank = i + 1;
            var rankIcon = rank === 1 ? '\uD83E\uDD47' : (rank === 2 ? '\uD83E\uDD48' : (rank === 3 ? '\uD83E\uDD49' : rank + '.'));
            var name = typeof escapeHtml === 'function' ? escapeHtml(e.username || 'Anon') : (e.username || 'Anon');
            var isWin = e.value < 1000;
            html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;margin-bottom:3px;' +
                'background:' + (isWin ? 'rgba(34,197,94,0.12)' : (isMe ? 'rgba(247,147,26,0.1)' : 'transparent')) + ';' +
                'border:1px solid ' + (isWin ? '#22c55e' : (isMe ? 'var(--accent)' : 'var(--border)')) + ';border-radius:8px;">' +
                '<div style="display:flex;align-items:center;gap:6px;">' +
                    '<span style="font-size:0.78rem;min-width:22px;">' + rankIcon + '</span>' +
                    '<span onclick="if(typeof showUserProfile===\'function\')showUserProfile(\'' + e.uid + '\')" style="font-size:0.8rem;font-weight:' + (isMe ? '800' : '600') + ';color:' + (isMe ? 'var(--accent)' : 'var(--text)') + ';cursor:pointer;">' + (isWin ? '\uD83C\uDFC6 ' : '') + name + (isMe ? ' (you)' : '') + '</span>' +
                '</div>' +
                '<span style="font-family:monospace;font-size:0.82rem;font-weight:800;color:' + (isWin ? '#22c55e' : (e.value < 10000 ? 'var(--accent)' : 'var(--text-muted)')) + ';">' + e.value.toLocaleString() + '</span>' +
            '</div>';
        }
        el.innerHTML = html;
    }).catch(function() {
        var el = document.getElementById('favorTopHashes');
        if (el) el.innerHTML = '<div style="text-align:center;color:var(--text-faint);padding:8px;">Could not load leaderboard</div>';
    });

    // Personal best
    if (!myUid) {
        var pbEl = document.getElementById('favorPersonalBest');
        if (pbEl) pbEl.innerHTML = '<div style="text-align:center;color:var(--text-faint);padding:8px;">Sign in to track your personal best</div>';
        return;
    }
    db.collection('satoshiFavor').doc('personalBests').get().then(function(doc) {
        var pbEl = document.getElementById('favorPersonalBest');
        if (!pbEl) return;
        if (!doc.exists) { pbEl.innerHTML = '<div style="text-align:center;color:var(--text-faint);padding:8px;">No hashes yet. Start mining!</div>'; return; }
        var users = doc.data().users || {};
        var myBest = users[myUid];
        if (!myBest) { pbEl.innerHTML = '<div style="text-align:center;color:var(--text-faint);padding:8px;">No hashes yet. Start mining!</div>'; return; }
        var isWin = myBest.value < 1000;
        pbEl.innerHTML = '<div style="text-align:center;padding:8px;">' +
            '<div style="font-size:1.8rem;font-weight:900;font-family:monospace;color:' + (isWin ? '#22c55e' : (myBest.value < 10000 ? 'var(--accent)' : 'var(--heading)')) + ';">' + (isWin ? '\uD83C\uDFC6 ' : '') + myBest.value.toLocaleString() + '</div>' +
            '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">Your all-time lowest hash</div>' +
        '</div>';
    }).catch(function() {
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
// QUEST HUB — Quiz / Trivia / Poll tabs
// ============================================================

window._questHubTab = 'quiz';

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
        '<button id="qhTabFavor" onclick="window._questHubTab=\'favor\';_renderQuestHubTab()" style="flex:1;padding:10px 0;border-radius:12px;border:1px solid var(--border);background:none;color:var(--text-muted);font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;">✨⛏️ Favor</button>' +
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
    else if (tab === 'favor') _renderFavorTab(body);
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
        // Check server-side if user already voted (covers localStorage cleared / different device)
        var uid = (typeof auth !== 'undefined' && auth && auth.currentUser) ? auth.currentUser.uid : null;
        var pollId = p.id || ('poll_day_' + todayKey);
        if (uid && typeof db !== 'undefined') {
            db.collection('poll_votes').doc(pollId).get().then(function(doc) {
                if (doc.exists && doc.data().voters && doc.data().voters.indexOf(uid) !== -1) {
                    // User already voted server-side — sync local state and show results
                    var serverVoterIdx = state.chosen; // May not have local chosen
                    state = { date: todayKey, index: today.index, chosen: typeof serverVoterIdx === 'number' ? serverVoterIdx : -1, pollId: p.id };
                    _setPollState(state);
                    _renderPollResults(body, html, p, state, todayKey);
                } else {
                    _showPollVoteButtons(body, html, p);
                }
            }).catch(function() {
                _showPollVoteButtons(body, html, p);
            });
        } else {
            _showPollVoteButtons(body, html, p);
        }
    }
}

function _showPollVoteButtons(body, html, p) {
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
    if (state.date === todayKey && typeof state.chosen === 'number') return; // Already voted (local)

    // Disable buttons immediately to prevent double-tap
    var pollBtns = document.querySelectorAll('#pollOptions button');
    pollBtns.forEach(function(b) { b.disabled = true; b.style.opacity = '0.5'; b.style.cursor = 'default'; });

    var pollId = p.id || ('poll_day_' + todayKey);
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
            // Vote succeeded — save local state + award XP
            state = { date: todayKey, index: today.index, chosen: chosenIdx, pollId: p.id };
            _setPollState(state);
            if (typeof awardPoints === 'function') awardPoints(50, '📊 Poll Quest vote');
            if (typeof window._raidOnPollVote === 'function') window._raidOnPollVote();
            if (typeof window._raidOnXPEarned === 'function') window._raidOnXPEarned(50);
            if (typeof showToast === 'function') showToast('📊 Vote recorded! +50 XP', 3000);

            // Track on user doc
            if (!auth.currentUser.isAnonymous) {
                db.collection('users').doc(uid).update({
                    lastPollDate: todayKey,
                    pollsVoted: firebase.firestore.FieldValue.increment(1)
                }).catch(function() {});
            }

            var body = document.getElementById('questHubBody');
            if (body) _renderPollTab(body);
        }).catch(function(e) {
            if (e && e.code === 'already-voted') {
                // Already voted server-side — sync local state
                state = { date: todayKey, index: today.index, chosen: chosenIdx, pollId: p.id };
                _setPollState(state);
                if (typeof showToast === 'function') showToast('You already voted on this poll today!', 3000);
            } else {
                console.error('[POLL] Vote failed:', e);
                if (typeof showToast === 'function') showToast('⚠️ Vote failed — try again', 3000);
                // Re-enable buttons on error
                pollBtns.forEach(function(b) { b.disabled = false; b.style.opacity = '1'; b.style.cursor = 'pointer'; });
                return;
            }
            var body = document.getElementById('questHubBody');
            if (body) _renderPollTab(body);
        });
    } else {
        // No auth or offline — local-only vote (no XP, no server record)
        state = { date: todayKey, index: today.index, chosen: chosenIdx, pollId: p.id };
        _setPollState(state);
        if (typeof showToast === 'function') showToast('📊 Vote recorded locally', 3000);
        var body = document.getElementById('questHubBody');
        if (body) _renderPollTab(body);
    }
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
    if (window._raidAllTimeUnsub) { window._raidAllTimeUnsub(); window._raidAllTimeUnsub = null; }
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
                    // Active boss — non-placeholder, started, not expired
                    if (!activeBoss) activeBoss = d;
                } else if (d.placeholder && startMs > now) {
                    // Upcoming placeholder — pick the soonest
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
                '<div style="font-size:0.82rem;color:var(--text);margin-top:4px;">Extra orange ticket drawing for <strong style=\"color:var(--accent);\">21,000 sats</strong> — <strong>this Friday night!</strong></div>' +
            '</div>' +
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
            winnersHtml +
        '</div>';
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
// Raid Boss — Auto-contribution hooks
// Fire-and-forget calls to contributeRaid Cloud Function
// =============================================
window._raidContribute = function(metric, amount, detail) {
    if (typeof firebase === 'undefined' || !firebase.auth || !firebase.auth().currentUser) return;
    if (firebase.auth().currentUser.isAnonymous) return;
    try {
        console.log('[RAID] Contributing:', metric, amount || 1);
        var fn = firebase.functions().httpsCallable('contributeRaid');
        fn({ metric: metric, amount: amount || 1, detail: detail || '' }).then(function(r) {
            if (r && r.data) console.log('[RAID] Result:', r.data.success, r.data.current + '/' + r.data.target, r.data.message || '');
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
