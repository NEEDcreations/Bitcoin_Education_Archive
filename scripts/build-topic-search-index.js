#!/usr/bin/env node
/* Build topic-search-index.js from channel titles, descriptions, and topic text.
   Does not modify educational topic files. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'channel_index.js'), 'utf8') + '\nthis.CHANNELS=CHANNELS;', ctx);
const CHANNELS = ctx.CHANNELS;

const STOP = new Set(('a an the to of for and or in on my your you with do i me can please about from at it this that be is are was were we our its into just some any not by as if so than then too very how what why who when where does did have has been they their them his her she him had but will would could should also more most many much other only over after before because while these those each per via out get got make made use used using new now see way ways people time times well off down up one two may might such really still even back here there http https www com org net html amp nbsp the from this that with your have bitcoin btc crypto just like dont doesnt isnt its via per').split(/\s+/));

/* Synonyms that are not already in the title. Verified against each topic's title and text. */
const EXTRA = {
    decentralized: ['control', 'government', 'censorship', 'trustless', 'ungovernable', 'sovereign'],
    dominant: ['brand', 'network', 'adoption', 'number'],
    money: ['inflation', 'value', 'price', 'economics', 'fiat', 'sound', 'deflation', 'what', 'how', 'beginner', 'bitcoin', 'currency'],
    organic: ['growth', 'adoption', 'grassroots'],
    peaceful: ['peace', 'voluntary', 'permissionless', 'borderless', 'war', 'unstoppable'],
    programmable: ['programmable', 'programable', 'script', 'smart', 'code'],
    scarce: ['halving', 'supply', '21', 'million', 'cap', 'scarcity', 'stock', 'inflation', 'value', 'limited'],
    secure: ['security', 'hack', 'safe', 'attack', 'immutable', 'hacked'],
    supranational: ['lindy', 'nation', 'government', 'global', 'settlement'],
    'use-cases': ['spend', 'pay', 'payment', 'merchant', 'accept', 'remittance', 'savings', 'buy', 'shop', 'store'],
    whitepaper: ['white', 'paper', 'whitepaper', 'satoshi', 'genesis', 'history', 'nakamoto', 'bitcoin', 'beginner', 'what', '2008'],
    bitvm: ['bitvm', 'compute', 'contract', 'dev', 'code', 'smart'],
    'blockchain-timechain': ['blockchain', 'timechain', 'block', 'ledger', 'transaction'],
    'chaumian-mints': ['chaumian', 'ecash', 'cashu', 'mint', 'privacy', 'blind'],
    consensus: ['consensus', 'nakamoto', 'agreement'],
    'core-source-code': ['code', 'source', 'github', 'developer', 'dev', 'build', 'fork', 'upgrade', 'bip', 'core'],
    cryptography: ['cryptography', 'sha', 'hash', 'signature', 'cypherpunk', 'schnorr', 'secure'],
    'ctv-covenants': ['ctv', 'bip119', 'bip', 'covenant', 'upgrade', 'fork'],
    developers: ['developer', 'dev', 'code', 'build', 'programming', 'github', 'software'],
    'difficulty-adjustment': ['difficulty', 'mining', 'epoch', 'adjustment', 'miner'],
    energy: ['energy', 'mining', 'renewable', 'environment', 'power', 'hashrate', 'green', 'asic'],
    'evidence-against-alts': ['altcoin', 'ethereum', 'alt', 'shitcoin', 'scam', 'crypto'],
    'extension-blocks': ['scaling', 'upgrade', 'block', 'extension'],
    'fedi-ark': ['fedimint', 'ark', 'privacy', 'federation'],
    'investment-strategy': ['invest', 'dca', 'buy', 'purchase', 'tax', 'retirement', 'hodl', 'price', 'strategy'],
    'layer-2-lightning': ['lightning', 'fast', 'fee', 'fees', 'send', 'receive', 'payment', 'instant', 'pay', 'channel', 'invoice'],
    'layer-3-sidechains': ['sidechain', 'liquid', 'layer', 'drivechain'],
    maximalism: ['maximalist', 'bitcoinonly', 'only'],
    mining: ['mining', 'miner', 'mine', 'hashrate', 'asic', 'hash', 'sha', 'nonce', 'pow', 'proof'],
    nodes: ['node', 'nodes', 'run', 'sovereign', 'verify', 'full', 'umbrel', 'core'],
    'op-codes': ['opcode', 'script', 'simplicity', 'dev', 'code', 'opcat'],
    'pow-vs-pos': ['proof', 'work', 'stake', 'pos', 'pow', 'mining', 'energy'],
    'privacy-nonkyc': ['privacy', 'kyc', 'nonkyc', 'coinjoin', 'sovereign', 'anonymous', 'buy', 'stack'],
    'problems-of-money': ['inflation', 'fiat', 'money', 'economics', 'cantillon', 'price', 'value', 'printing', 'dollar'],
    regulation: ['regulation', 'legal', 'law', 'tax', 'government', 'policy', 'ban', 'etf', 'compliance'],
    'self-custody': ['wallet', 'wallets', 'storage', 'cold', 'hardware', 'seed', 'phrase', 'keys', 'key', 'backup', 'custody', 'recover', 'lost', 'safe', 'secure', 'trezor', 'ledger', 'coldcard', 'passphrase', 'mnemonic', 'multisig'],
    'smart-contracts': ['smart', 'contract', 'script', 'dev', 'code', 'dlc'],
    stablecoins: ['stablecoin', 'dollar', 'tether', 'usdt', 'usdc'],
    '0_mining__hashing': ['mining', 'miner', 'hash', 'hashing', 'sha', 'asic', 'hashrate', 'nonce'],
    '100_sats': ['sats', 'satoshi', 'spend', 'buy', 'small', 'value'],
    '1_first_principles': ['principles', 'beginner', 'basics', 'what', 'how', 'fundamental'],
    '2__solved_technical_problems': ['double', 'spend', 'byzantine', 'solved'],
    analogies: ['analogy', 'explain', 'beginner', 'what', 'how', 'metaphor'],
    austrian_school_of_economics: ['austrian', 'economics', 'mises', 'hayek', 'money', 'inflation', 'value'],
    bip119: ['bip', 'bip119', 'ctv', 'covenant', 'upgrade', 'fork'],
    bitcoin_exam: ['exam', 'test', 'quiz', 'study', 'learn'],
    bitcoin_vs_real_estate: ['estate', 'house', 'property', 'invest', 'price', 'value', 'realestate'],
    'block_time-block-size': ['block', 'time', 'size', 'minute', 'scaling'],
    burn_bitcoin: ['burn', 'unspendable', 'destroy'],
    'byzantine_generals__problem': ['byzantine', 'generals', 'consensus', 'satoshi', 'history'],
    'chaumian_e-cash_and_blind_signatures': ['chaum', 'ecash', 'blind', 'signature', 'privacy'],
    coin_mixing_coinjoin_coin_control_utxo: ['coinjoin', 'mix', 'mixing', 'privacy', 'kyc', 'utxo', 'whirlpool', 'coincontrol'],
    cyles: ['cycle', 'cycles', 'halving', 'year', 'hype'],
    derivation_path: ['derivation', 'path', 'seed', 'wallet', 'backup', 'bip32', 'hd'],
    'discrete_log_contracts__dlcs': ['dlc', 'contract', 'oracle', 'smart'],
    'dollar-bitcoin_milkshake_theory': ['dollar', 'milkshake', 'macro', 'economics', 'liquidity'],
    dust: ['dust', 'utxo', 'fee', 'sats'],
    elevator_pitches: ['pitch', 'explain', 'beginner', 'what', 'how'],
    'environment___energy': ['environment', 'energy', 'climate', 'green', 'mining', 'renewable'],
    'faith___religion': ['faith', 'religion', 'church', 'spiritual'],
    fedimints: ['fedimint', 'mint', 'privacy', 'federation', 'ecash', 'community'],
    feedback_loops: ['feedback', 'loop', 'adoption'],
    'free_and_open_source_software__foss': ['foss', 'open', 'source', 'code', 'software', 'dev', 'free'],
    game_theory: ['game', 'theory', 'incentive', 'nash'],
    'geopolitics___macroeconomics': ['geopolitics', 'macro', 'economics', 'inflation', 'money', 'dollar'],
    governance: ['governance', 'bip', 'politics', 'vote', 'regulation'],
    ham_radio: ['ham', 'radio', 'mesh', 'offline'],
    human_rights__social_justice_and_freedo: ['rights', 'freedom', 'justice', 'censorship', 'human'],
    improved_incentive_structure: ['incentive', 'reward', 'game'],
    laws_of_thermodynamics: ['thermodynamics', 'energy', 'physics', 'entropy', 'mining'],
    lightning_node: ['lightning', 'node', 'routing', 'channel', 'fee', 'run', 'sovereign'],
    lindy_effect: ['lindy', 'survival', 'history'],
    market_cap: ['market', 'cap', 'price', 'value', 'valuation'],
    math: ['math', 'mathematics', 'sha', 'probability'],
    mathematics: ['math', 'mathematics', 'elliptic', 'curve'],
    mev: ['mev', 'miner', 'extractable', 'fee'],
    network_effects: ['network', 'adoption', 'metcalfe'],
    open_source: ['open', 'source', 'code', 'foss', 'dev'],
    oracle: ['oracle', 'dlc', 'price'],
    'orange-pilling': ['orange', 'pill', 'explain', 'beginner', 'what', 'how', 'convince'],
    ordinals: ['ordinals', 'inscription', 'nft', 'taproot'],
    'ordinals__nfts_on_bitcoin__and_block_spa': ['ordinals', 'nft', 'inscription', 'blockspace', 'fee'],
    'peace_and_anti-war': ['peace', 'war', 'antiwar'],
    philosophy: ['philosophy', 'ethics', 'meaning'],
    politics: ['politics', 'government', 'election', 'regulation', 'legal'],
    predictions: ['prediction', 'price', 'future', 'forecast'],
    public_key_vs_private_key: ['key', 'keys', 'private', 'public', 'wallet', 'seed', 'custody'],
    rbf: ['rbf', 'fee', 'replace', 'stuck', 'bump', 'transaction'],
    'referral-links': ['referral', 'buy', 'purchase', 'exchange', 'river', 'strike', 'fold', 'swan', 'cashapp', 'kyc'],
    'risks__threats__attack_vectors__weaknes': ['risk', 'threat', 'attack', 'hack', 'scam', 'weakness', 'secure', 'safe'],
    rollups: ['rollup', 'scaling', 'layer'],
    'sats__or__bits': ['sats', 'bits', 'denomination', 'unit'],
    scalability: ['scale', 'scaling', 'lightning', 'throughput'],
    sidechains: ['sidechain', 'liquid'],
    'simplified_payment_verification__spv': ['spv', 'light', 'wallet', 'verify', 'node'],
    'soft_vs_hard_forks': ['fork', 'soft', 'hard', 'upgrade', 'bip', 'consensus'],
    softwar: ['softwar', 'lowery', 'war', 'military'],
    stratum_v2: ['stratum', 'mining', 'miner', 'pool', 'asic', 'hashrate'],
    submarine_swap: ['submarine', 'swap', 'lightning'],
    swaps: ['swap', 'lightning', 'submarine'],
    ta_tips: ['chart', 'price', 'trading', 'technical', 'analysis'],
    tail_emission: ['tail', 'emission', 'supply', 'subsidy', '21', 'inflation'],
    taproot: ['taproot', 'upgrade', 'bip', 'schnorr', 'fork', 'softfork', 'privacy'],
    taro: ['taro', 'taproot', 'assets', 'stablecoin'],
    the_future: ['future', 'hyperbitcoinization', 'adoption'],
    time: ['time', 'clock', 'timestamp'],
    time_preference: ['preference', 'savings', 'civilization', 'economics'],
    toxicity: ['toxic', 'maximalism', 'culture', 'community'],
    transaction_fees: ['fee', 'fees', 'transaction', 'vbyte', 'mempool', 'send'],
    unpopular_opinions: ['opinion', 'debate', 'controversial'],
    utxos: ['utxo', 'utxos', 'output', 'coin', 'wallet'],
    vbyte: ['vbyte', 'weight', 'fee', 'size', 'transaction'],
    'apps-tools': ['app', 'tool', 'wallet', 'exchange', 'service', 'buy'],
    'art-inspiration': ['art', 'inspiration', 'motivation'],
    'articles-threads': ['article', 'thread', 'essay', 'read', 'learn'],
    books: ['book', 'books', 'read', 'learn', 'standard'],
    charts: ['chart', 'price', 'data', 'value', 'stocktoflow'],
    curriculum: ['curriculum', 'learn', 'teach', 'course', 'beginner', 'school', 'education', 'class'],
    'faq-glossary': ['faq', 'glossary', 'what', 'how', 'beginner', 'bitcoin', 'question', 'definition', 'buy'],
    'fun-facts': ['fact', 'trivia', 'pizza', 'lost', 'history', 'fun'],
    games: ['game', 'play', 'learn'],
    'giga-chad': ['saylor', 'microstrategy', 'treasury', 'corporate'],
    graphics: ['graphic', 'infographic', 'visual', 'chart'],
    hardware: ['hardware', 'wallet', 'cold', 'asic', 'miner', 'trezor', 'coldcard', 'bitaxe', 'node', 'seed', 'ledger', 'mining'],
    health: ['health', 'steak', 'lifestyle'],
    history: ['history', 'satoshi', 'genesis', 'cypherpunk', 'timeline', '2009', 'past'],
    'informational-sites': ['meetup', 'meetups', 'community', 'event', 'events', 'conference', 'course', 'newsletter', 'learn'],
    international: ['international', 'language', 'global', 'translation', 'country'],
    'jobs-earn': ['job', 'jobs', 'earn', 'work', 'hire', 'salary', 'stack'],
    'memes-funny': ['meme', 'memes', 'funny', 'joke', 'humor'],
    'misconceptions-fud': ['fud', 'myth', 'scam', 'misconception', 'hack', 'debunk'],
    'movies-tv': ['movie', 'documentary', 'film', 'video', 'watch', 'tv'],
    music: ['music', 'song', 'audio'],
    'news-adoption': ['news', 'adoption', 'merchant', 'accept', 'headline', 'upgrade'],
    nostr: ['nostr', 'social', 'zaps', 'decentralized'],
    'one-stop-shop': ['beginner', 'start', 'new', 'what', 'how', 'intro', 'learn', 'bitcoin'],
    podcasts: ['podcast', 'podcasts', 'audio', 'listen', 'learn', 'interview'],
    'poems-stories': ['poem', 'story', 'joke', 'writing'],
    'projects-diy': ['diy', 'build', 'node', 'project', 'hardware'],
    'research-theses': ['research', 'thesis', 'paper', 'academic'],
    'satoshi-nakamoto': ['satoshi', 'nakamoto', 'creator', 'history', 'identity', 'genesis'],
    'social-media': ['social', 'twitter', 'community', 'follow'],
    'swag-merch': ['buy', 'purchase', 'shop', 'merch', 'swag', 'store', 'spend', 'pay', 'merchant', 'shirt', 'hoodie', 'clothing', 'gift', 'merchandise', 'accept'],
    videos: ['video', 'videos', 'watch', 'lecture', 'learn', 'talk'],
    web5: ['web5', 'identity', 'decentralized']
};

const QUERIES = {
    'buy': ['first-purchase', 'swag-merch', 'marketplace', 'referral-links', 'use-cases', 'investment-strategy', 'privacy-nonkyc', '100_sats', 'apps-tools', 'faq-glossary'],
    'buy bitcoin': ['first-purchase', 'referral-links', 'privacy-nonkyc', 'investment-strategy', 'apps-tools'],
    'how to buy': ['first-purchase', 'referral-links', 'faq-glossary', 'one-stop-shop'],
    'how to buy bitcoin': ['first-purchase', 'referral-links', 'faq-glossary'],
    'purchase': ['first-purchase', 'swag-merch', 'referral-links', 'investment-strategy'],
    'shop': ['swag-merch', 'marketplace', 'apps-tools'],
    'merch': ['swag-merch', 'marketplace'],
    'swag': ['swag-merch'],
    'spend': ['swag-merch', 'use-cases', '100_sats', 'layer-2-lightning'],
    'merchant': ['swag-merch', 'use-cases', 'news-adoption', 'marketplace'],
    'exchange': ['referral-links', 'first-purchase', 'apps-tools'],
    'wallet': ['self-custody', 'hardware', 'public_key_vs_private_key', 'derivation_path', 'apps-tools'],
    'cold storage': ['self-custody', 'hardware'],
    'hardware wallet': ['hardware', 'self-custody'],
    'seed phrase': ['self-custody', 'derivation_path', 'public_key_vs_private_key'],
    'private key': ['public_key_vs_private_key', 'self-custody'],
    'safe': ['secure', 'self-custody', 'risks__threats__attack_vectors__weaknes'],
    'scam': ['risks__threats__attack_vectors__weaknes', 'misconceptions-fud', 'self-custody'],
    'hack': ['secure', 'risks__threats__attack_vectors__weaknes', 'self-custody'],
    'lost bitcoin': ['self-custody', 'fun-facts'],
    'mining': ['mining', '0_mining__hashing', 'hardware', 'energy', 'stratum_v2'],
    'hashrate': ['mining', '0_mining__hashing', 'energy', 'stratum_v2'],
    'asic': ['mining', 'hardware', 'stratum_v2', '0_mining__hashing'],
    'price': ['charts', 'market_cap', 'money', 'ta_tips', 'predictions', 'problems-of-money'],
    'inflation': ['problems-of-money', 'money', 'austrian_school_of_economics', 'scarce'],
    'economics': ['austrian_school_of_economics', 'problems-of-money', 'money', 'geopolitics___macroeconomics'],
    'lightning': ['layer-2-lightning', 'lightning_node', 'submarine_swap', 'swaps'],
    'fees': ['transaction_fees', 'layer-2-lightning', 'rbf'],
    'node': ['nodes', 'lightning_node', 'projects-diy'],
    'run a node': ['nodes', 'projects-diy', 'lightning_node'],
    'satoshi': ['satoshi-nakamoto', 'whitepaper', 'history'],
    'whitepaper': ['whitepaper', 'satoshi-nakamoto', 'history'],
    'white paper': ['whitepaper', 'satoshi-nakamoto'],
    'genesis': ['whitepaper', 'history', 'satoshi-nakamoto'],
    'halving': ['scarce', 'mining', 'cyles', 'tail_emission', 'charts'],
    '21 million': ['scarce', 'tail_emission'],
    'tax': ['investment-strategy', 'regulation'],
    'legal': ['regulation', 'politics'],
    'regulation': ['regulation', 'politics', 'governance'],
    'beginner': ['one-stop-shop', 'faq-glossary', 'curriculum', 'analogies', 'money', 'whitepaper'],
    'what is bitcoin': ['money', 'faq-glossary', 'one-stop-shop', 'whitepaper', 'analogies'],
    'how': ['one-stop-shop', 'faq-glossary', 'analogies', 'elevator_pitches', 'curriculum'],
    'privacy': ['privacy-nonkyc', 'coin_mixing_coinjoin_coin_control_utxo', 'chaumian-mints', 'fedimints'],
    'coinjoin': ['coin_mixing_coinjoin_coin_control_utxo', 'privacy-nonkyc'],
    'kyc': ['privacy-nonkyc', 'coin_mixing_coinjoin_coin_control_utxo', 'referral-links'],
    'developer': ['developers', 'core-source-code', 'op-codes', 'projects-diy'],
    'podcast': ['podcasts'],
    'book': ['books'],
    'video': ['videos', 'movies-tv'],
    'news': ['news-adoption'],
    'bip': ['bip119', 'ctv-covenants', 'taproot', 'soft_vs_hard_forks', 'core-source-code'],
    'fork': ['soft_vs_hard_forks', 'core-source-code', 'taproot'],
    'meetup': ['informational-sites', 'social-media'],
    'community': ['informational-sites', 'social-media', 'fedimints'],
    'events': ['informational-sites', 'news-adoption']
};

const POPULAR = ['one-stop-shop', 'money', 'faq-glossary', 'self-custody', 'mining', 'layer-2-lightning', 'whitepaper'];

const EXTRAS = {
    'first-purchase': {
        title: 'Your First Bitcoin Purchase',
        desc: 'Step-by-step guide to buying bitcoin safely from a trusted exchange, then moving it to a wallet you control.',
        emoji: '🛒',
        intent: ['buy', 'purchase', 'shop', 'exchange', 'first', 'beginner', 'kyc', 'strike', 'river', 'cashapp', 'dca', 'how', 'start', 'spend']
    },
    marketplace: {
        title: 'Marketplace',
        desc: 'A bitcoin marketplace for buying and selling goods, merch, and services.',
        emoji: '⚡',
        intent: ['buy', 'shop', 'store', 'marketplace', 'merchant', 'sell', 'spend', 'pay', 'merch', 'swag']
    }
};

function tokensOf(text) {
    return String(text || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/https?:\/\/\S+/gi, ' ')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .split(' ')
        .filter(Boolean);
}

function titleWords(id, meta) {
    const raw = ((meta.title || '') + ' ' + id).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w.length >= 3 && !STOP.has(w));
    return raw;
}

const docs = {};
Object.keys(CHANNELS).forEach(id => {
    const meta = CHANNELS[id];
    let text = (meta.title || '') + ' ' + (meta.desc || '');
    try {
        const json = JSON.parse(fs.readFileSync(path.join(root, meta.file), 'utf8'));
        (json.msgs || []).forEach(m => { text += ' ' + (m.text || ''); });
    } catch (e) {}
    const counts = {};
    tokensOf(text).forEach(w => {
        if (w.length < 4 || STOP.has(w) || !/[a-z]/.test(w)) return;
        counts[w] = (counts[w] || 0) + 1;
    });
    docs[id] = counts;
});

const df = {};
Object.keys(docs).forEach(id => {
    Object.keys(docs[id]).forEach(w => { df[w] = (df[w] || 0) + 1; });
});
const N = Object.keys(CHANNELS).length;

function contentFor(id, intentSet) {
    const counts = docs[id] || {};
    return Object.keys(counts)
        .filter(w => !intentSet[w] && (df[w] || 0) <= 36)
        .map(w => ({ w, score: counts[w] * Math.log(N / (df[w] || 1)) }))
        .sort((a, b) => b.score - a.score || a.w.localeCompare(b.w))
        .slice(0, 16)
        .map(item => item.w);
}

const topics = {};
const missing = [];
Object.keys(CHANNELS).forEach(id => {
    const base = titleWords(id, CHANNELS[id]);
    const extra = EXTRA[id] || [];
    if (!EXTRA[id]) missing.push(id);
    const intent = [];
    const seen = {};
    base.concat(extra).forEach(w => {
        const n = String(w || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
        if (!n || seen[n]) return;
        seen[n] = 1;
        intent.push(n);
    });
    topics[id] = { intent: intent, content: contentFor(id, seen) };
});

if (missing.length) {
    console.error('Missing extra intent map for: ' + missing.join(', '));
    process.exit(1);
}

const index = {
    topics: topics,
    extras: EXTRAS,
    queries: QUERIES,
    popular: POPULAR
};

function jsString(s) {
    return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}
function jsArray(list) {
    return '[' + list.map(jsString).join(', ') + ']';
}

let out = '';
out += '/* Browse Topics search metadata.\n';
out += '   Intent words and synonyms were read from each topic title and body.\n';
out += '   Educational topic files are not modified. Loaded only when Browse Topics opens. */\n';
out += '(function (root, factory) {\n';
out += '    var api = factory();\n';
out += '    if (typeof module === \'object\' && module.exports) module.exports = api;\n';
out += '    if (root) root.TOPIC_SEARCH_INDEX = api;\n';
out += '})(typeof window !== \'undefined\' ? window : (typeof globalThis !== \'undefined\' ? globalThis : this), function () {\n';
out += '    return {\n';
out += '        popular: ' + jsArray(POPULAR) + ',\n';
out += '        queries: {\n';
Object.keys(QUERIES).forEach(q => {
    out += '            ' + jsString(q) + ': ' + jsArray(QUERIES[q]) + ',\n';
});
out += '        },\n';
out += '        extras: {\n';
Object.keys(EXTRAS).forEach(id => {
    const e = EXTRAS[id];
    out += '            ' + jsString(id) + ': { title: ' + jsString(e.title) + ', desc: ' + jsString(e.desc) + ', emoji: ' + jsString(e.emoji) + ', intent: ' + jsArray(e.intent) + ' },\n';
});
out += '        },\n';
out += '        topics: {\n';
Object.keys(topics).forEach(id => {
    const t = topics[id];
    out += '            ' + jsString(id) + ': { intent: ' + jsArray(t.intent) + ', content: ' + jsArray(t.content) + ' },\n';
});
out += '        }\n';
out += '    };\n';
out += '});\n';

fs.writeFileSync(path.join(root, 'topic-search-index.js'), out);
console.log('topics', Object.keys(topics).length, 'bytes', out.length);
