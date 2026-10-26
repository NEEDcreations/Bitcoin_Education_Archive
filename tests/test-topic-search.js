// Browse Topics search: synonyms, stems, prefixes, and one-edit typos.
// Run: node tests/test-topic-search.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

const search = require(path.join(root, 'topic-search.js'));
const index = require(path.join(root, 'topic-search-index.js'));
const ctx = {};
vm.createContext(ctx);
vm.runInContext(read('channel_index.js') + '\nthis.CHANNELS=CHANNELS;', ctx);
const CHANNELS = ctx.CHANNELS;
const topics = Object.keys(CHANNELS).map(function (id) {
    return { id: id, title: CHANNELS[id].title, desc: CHANNELS[id].desc };
});

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

function idsFor(query) {
    return search.search(query, topics, index).matches.map(function (m) { return m.id; });
}

function hit(query) {
    return search.search(query, topics, index);
}

// Realistic queries and topics that must appear. Order is ranked, so these
// checks are membership, not a full snapshot.
const CASES = [
    ['buy', ['swag-merch', 'first-purchase', 'marketplace', 'referral-links', 'use-cases']],
    ['buying', ['swag-merch', 'first-purchase', 'marketplace']],
    ['bought', ['swag-merch', 'marketplace']],
    ['buys', ['swag-merch', 'referral-links']],
    ['BUY', ['swag-merch', 'first-purchase']],
    ['buy!', ['swag-merch', 'marketplace']],
    ['purchase', ['first-purchase', 'swag-merch', 'referral-links']],
    ['shop', ['swag-merch', 'marketplace', 'apps-tools']],
    ['merch', ['swag-merch', 'marketplace']],
    ['swag', ['swag-merch']],
    ['store', ['swag-merch', 'marketplace', 'use-cases']],
    ['spend', ['swag-merch', 'use-cases', 'layer-2-lightning']],
    ['spending', ['swag-merch', 'use-cases']],
    ['pay', ['use-cases', 'layer-2-lightning', 'swag-merch', 'marketplace']],
    ['accept', ['swag-merch', 'use-cases', 'news-adoption']],
    ['merchant', ['swag-merch', 'marketplace', 'use-cases']],
    ['exchange', ['referral-links', 'first-purchase', 'apps-tools']],
    ['wallet', ['self-custody', 'hardware', 'apps-tools']],
    ['wallets', ['self-custody', 'hardware']],
    ['walet', ['self-custody', 'hardware']],
    ['wal', ['self-custody', 'hardware']],
    ['cold', ['self-custody', 'hardware']],
    ['cold storage', ['self-custody', 'hardware']],
    ['hardware', ['hardware', 'self-custody']],
    ['hardware wallet', ['hardware', 'self-custody']],
    ['seed', ['self-custody', 'derivation_path']],
    ['seed phrase', ['self-custody', 'public_key_vs_private_key']],
    ['keys', ['public_key_vs_private_key', 'self-custody']],
    ['backup', ['self-custody']],
    ['self-custody', ['self-custody']],
    ['self custody', ['self-custody']],
    ['self-custody!!!', ['self-custody']],
    ['safe', ['secure', 'self-custody']],
    ['secure', ['secure', 'self-custody']],
    ['scam', ['risks__threats__attack_vectors__weaknes', 'misconceptions-fud']],
    ['hack', ['secure', 'risks__threats__attack_vectors__weaknes']],
    ['lost', ['self-custody', 'fun-facts']],
    ['recover', ['self-custody']],
    ['lost bitcoin', ['self-custody']],
    ['mining', ['mining', '0_mining__hashing', 'hardware']],
    ['miner', ['mining', 'stratum_v2']],
    ['hashrate', ['mining', '0_mining__hashing', 'energy']],
    ['asic', ['mining', 'hardware', 'stratum_v2']],
    ['price', ['charts', 'money', 'market_cap']],
    ['value', ['money', 'scarce']],
    ['inflation', ['problems-of-money', 'money', 'scarce']],
    ['money', ['money']],
    ['economics', ['austrian_school_of_economics', 'problems-of-money']],
    ['lightning', ['layer-2-lightning', 'lightning_node']],
    ['fast', ['layer-2-lightning']],
    ['fees', ['transaction_fees', 'layer-2-lightning']],
    ['send', ['layer-2-lightning', 'transaction_fees']],
    ['receive', ['layer-2-lightning']],
    ['node', ['nodes', 'lightning_node']],
    ['run', ['nodes']],
    ['sovereign', ['nodes', 'decentralized']],
    ['history', ['history', 'satoshi-nakamoto']],
    ['satoshi', ['satoshi-nakamoto', 'whitepaper']],
    ['whitepaper', ['whitepaper']],
    ['white paper', ['whitepaper', 'satoshi-nakamoto']],
    ['genesis', ['whitepaper', 'history']],
    ['halving', ['scarce', 'mining', 'tail_emission']],
    ['supply', ['scarce', 'tail_emission']],
    ['21 million', ['scarce', 'tail_emission']],
    ['tax', ['investment-strategy', 'regulation']],
    ['legal', ['regulation']],
    ['regulation', ['regulation']],
    ['beginner', ['one-stop-shop', 'faq-glossary', 'money']],
    ['start', ['one-stop-shop']],
    ['what is bitcoin', ['money', 'whitepaper', 'faq-glossary', 'one-stop-shop']],
    ['how to buy', ['first-purchase', 'referral-links', 'faq-glossary']],
    ['how to buy bitcoin', ['first-purchase', 'referral-links']],
    ['buy bitcoin', ['first-purchase', 'referral-links']],
    ['privacy', ['privacy-nonkyc', 'coin_mixing_coinjoin_coin_control_utxo']],
    ['coinjoin', ['coin_mixing_coinjoin_coin_control_utxo']],
    ['kyc', ['privacy-nonkyc', 'referral-links']],
    ['dev', ['developers', 'core-source-code']],
    ['code', ['core-source-code', 'developers']],
    ['build', ['projects-diy', 'developers']],
    ['podcast', ['podcasts']],
    ['book', ['books']],
    ['video', ['videos']],
    ['learn', ['curriculum', 'books', 'one-stop-shop']],
    ['news', ['news-adoption']],
    ['upgrade', ['taproot', 'soft_vs_hard_forks']],
    ['bip', ['bip119', 'ctv-covenants', 'taproot']],
    ['fork', ['soft_vs_hard_forks', 'taproot']],
    ['meetup', ['informational-sites']],
    ['community', ['informational-sites']],
    ['events', ['informational-sites']],
    ['bitcion', ['money', 'whitepaper', 'faq-glossary']]
];

test('query table has 60 or more realistic searches', function () {
    assert.ok(CASES.length >= 60, 'got ' + CASES.length);
});

CASES.forEach(function (row) {
    const query = row[0];
    const must = row[1];
    test('"' + query + '" includes ' + must.join(', '), function () {
        const ids = idsFor(query);
        must.forEach(function (id) {
            assert.ok(ids.indexOf(id) !== -1, query + ' missed ' + id + ' (got ' + ids.slice(0, 12).join(', ') + ')');
        });
    });
});

test('curated topics lead buy, wallet, mining, and merch', function () {
    assert.deepStrictEqual(idsFor('buy').slice(0, 3), ['first-purchase', 'swag-merch', 'marketplace']);
    assert.deepStrictEqual(idsFor('wallet').slice(0, 3), ['self-custody', 'hardware', 'public_key_vs_private_key']);
    assert.deepStrictEqual(idsFor('mining').slice(0, 3), ['mining', '0_mining__hashing', 'hardware']);
    assert.deepStrictEqual(idsFor('merch').slice(0, 2), ['swag-merch', 'marketplace']);
    assert.strictEqual(hit('mining').matches[0].rank, 0);
});

test('buy returns every mapped buy topic, not a short list', function () {
    const ids = idsFor('buy');
    assert.ok(ids.length >= 10, 'only ' + ids.length);
    ['swag-merch', 'first-purchase', 'marketplace', 'referral-links', 'use-cases', 'investment-strategy', 'privacy-nonkyc', '100_sats', 'apps-tools', 'faq-glossary'].forEach(function (id) {
        assert.ok(ids.indexOf(id) !== -1, 'missing ' + id);
    });
});

test('exact titles rank first', function () {
    assert.strictEqual(hit('mining').matches[0].id, 'mining');
    assert.strictEqual(hit('mining').matches[0].rank, 0);
    assert.strictEqual(hit('self-custody').matches[0].rank, 0);
    assert.strictEqual(hit('self custody').matches[0].id, 'self-custody');
    assert.strictEqual(hit('money').matches[0].id, 'money');
    assert.strictEqual(hit('whitepaper').matches[0].rank, 0);
    assert.strictEqual(hit('hardware').matches[0].id, 'hardware');
    assert.strictEqual(hit('regulation').matches[0].id, 'regulation');
});

test('unknown query is empty and close typos stay off the wrong topic', function () {
    assert.strictEqual(idsFor('zzzzqqqq').length, 0);
    assert.strictEqual(idsFor('mining').indexOf('coin_mixing_coinjoin_coin_control_utxo'), -1);
    assert.strictEqual(idsFor('store').indexOf('poems-stories'), -1);
    assert.strictEqual(search.editAtMost1('walet', 'wallet'), true);
    assert.strictEqual(search.editAtMost1('bitcion', 'bitcoin'), true);
    assert.strictEqual(search.editAtMost1('store', 'story'), false);
    assert.strictEqual(search.editAtMost1('mining', 'mixing'), false);
});

test('stems and punctuation normalize', function () {
    assert.ok(search.stemKeys('buying').indexOf('buy') !== -1);
    assert.ok(search.stemKeys('bought').indexOf('buy') !== -1);
    assert.strictEqual(search.normalize('Self-Custody!!!'), 'self custody');
    assert.strictEqual(search.normalize('  BUY  '), 'buy');
});

test('every educational topic has search intent and nothing was added to topic files', function () {
    const ids = Object.keys(CHANNELS);
    assert.strictEqual(ids.length, 145);
    assert.strictEqual(Object.keys(index.topics).length, 145);
    ids.forEach(function (id) {
        assert.ok(index.topics[id], 'missing index row ' + id);
        assert.ok(index.topics[id].intent && index.topics[id].intent.length, 'empty intent ' + id);
    });
    assert.ok(index.extras['first-purchase']);
    assert.ok(index.extras.marketplace);
    assert.ok(index.popular.indexOf('self-custody') !== -1);
    assert.ok(index.queries.buy.indexOf('swag-merch') !== -1);
    const sample = fs.readFileSync(path.join(root, CHANNELS['swag-merch'].file), 'utf8');
    assert.strictEqual(sample.indexOf('topic-search'), -1);
    assert.strictEqual(sample.indexOf('TOPIC_SEARCH_INDEX'), -1);
});

test('index stays off the first page and results are escaped', function () {
    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    assert.strictEqual(html.indexOf('topic-search-index.js'), -1);
    assert.strictEqual(html.indexOf('topic-search.js'), -1);
    const app = read('app.js');
    assert.ok(app.indexOf("load('topic-search.js')") !== -1);
    assert.ok(app.indexOf("load('topic-search-index.js')") !== -1);
    assert.ok(app.indexOf('TOPIC_SEARCH_VERSION') !== -1);
    const start = app.indexOf('function topicSearchReady');
    const end = app.indexOf('function topicsBrowserFocusables');
    const block = app.slice(start, end);
    assert.ok(start !== -1 && end > start);
    assert.strictEqual(block.indexOf('innerHTML'), -1);
    assert.ok(block.indexOf('textContent') !== -1);
    assert.ok(block.indexOf('Ask Nacho') !== -1);
    assert.ok(block.indexOf('No topics match that search.') !== -1);
    assert.ok(block.indexOf('A few places to start') !== -1);
    assert.strictEqual(read('topic-search.js').indexOf('matches.slice'), -1);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
