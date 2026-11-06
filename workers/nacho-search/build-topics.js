#!/usr/bin/env node
// Build the Nacho topic index from channel_index.js and app page links
// in features.registry.js. Does not edit topic lesson content.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const channelSrc = fs.readFileSync(path.join(root, 'channel_index.js'), 'utf8');
const CHANNELS = new Function(channelSrc + '\nreturn CHANNELS;')();
const registry = require(path.join(root, 'features.registry.js'));
const pool = JSON.parse(fs.readFileSync(path.join(root, 'workers/nacho-search/followup-pool.json'), 'utf8'));

const EXTRA = {
    charts: 'price usd eur gbp jpy cad aud chf dollar market ath chart trading',
    transaction_fees: 'fee fees sat vbyte mempool cost',
    vbyte: 'fee vbyte weight',
    'blockchain-timechain': 'block height timechain chain tip transaction',
    'block_time-block-size': 'block time height',
    scarce: 'halving supply 21 million subsidy countdown',
    mining: 'hashrate hash rate miner difficulty nonce',
    '0_mining__hashing': 'hashrate sha256 mining',
    'difficulty-adjustment': 'difficulty retarget adjustment',
    'self-custody': 'wallet seed phrase custody keys',
    'public_key_vs_private_key': 'public key address',
    'investment-strategy': 'dca buy invest horizon retirement',
    'layer-2-lightning': 'lightning payment invoice',
    lightning_node: 'lightning node',
    utxos: 'utxo unspent coin',
    whitepaper: 'whitepaper satoshi paper',
    'satoshi-nakamoto': 'satoshi nakamoto creator',
    'one-stop-shop': 'beginner start new',
    money: 'money supply sound',
    nodes: 'node verify full node',
    'pow-vs-pos': 'proof of work energy',
    cyles: 'cycle ath halving',
    market_cap: 'market cap price',
    ta_tips: 'chart price change',
    history: 'history satoshi',
    'sats__or__bits': 'satoshi sat sats',
    curriculum: 'quiz learn',
    games: 'raffle game',
    health: 'walk health'
};

function plainTitle(title) {
    return String(title || '')
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D]/gu, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function shortTitle(id, plain) {
    const cleaned = String(plain || '').replace(/\s+/g, ' ').trim();
    if (cleaned && cleaned.length <= 40) {
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    const fromId = String(id || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    const titled = fromId.replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); });
    return titled.length <= 40 ? titled : titled.slice(0, 40).trim();
}

const topics = [];
Object.keys(CHANNELS).forEach(function (id) {
    const row = CHANNELS[id] || {};
    const plain = plainTitle(row.title);
    topics.push({
        id: id,
        kind: 'topic',
        title: shortTitle(id, plain),
        plain: plain,
        hash: id,
        desc: String(row.desc || '').slice(0, 280),
        keywords: [id.replace(/[_-]+/g, ' '), plain, row.desc || '', EXTRA[id] || ''].join(' ')
    });
});

const channelIds = new Set(Object.keys(CHANNELS));
(registry.FEATURES || []).forEach(function (f) {
    if (!f || f.aux || !f.id || channelIds.has(f.id)) return;
    const hash = f.hash || ('app/' + f.id);
    topics.push({
        id: f.id,
        kind: 'app',
        title: String(f.title || f.id).slice(0, 60),
        plain: String(f.title || f.id),
        hash: hash,
        desc: String(f.desc || '').slice(0, 280),
        keywords: [f.id, f.title || '', f.kw || '', f.desc || '', (f.aliases || []).join(' ')].join(' ')
    });
});

const index = {};
topics.forEach(function (t) {
    if (!index[t.id]) index[t.id] = { title: t.title, hash: t.hash, kind: t.kind };
});

const dataPath = path.join(root, 'workers/nacho-search/topics-data.mjs');
const indexPath = path.join(root, 'functions/src/nachoTopicIndex.json');
fs.writeFileSync(dataPath, 'export const TOPICS = ' + JSON.stringify(topics) + ';\nexport const POOL = ' + JSON.stringify(pool) + ';\n');
fs.writeFileSync(indexPath, JSON.stringify(index));
console.log('topics', topics.length, 'pool', pool.length, 'index', Object.keys(index).length);
