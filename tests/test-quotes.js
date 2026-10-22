// Quote of the Day: every line is sourced, and the daily pick
// walks a seeded shuffle so the list completes before it repeats.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

function normText(s) {
    return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

test('quotes.json entries are complete, https, and unique', () => {
    const quotes = JSON.parse(read('data/quotes.json'));
    assert.ok(quotes.length >= 250, 'expected at least 250 quotes, got ' + quotes.length);
    const seen = new Set();
    const channels = new Set([...read('channel_index.js').matchAll(/"([a-z0-9_-]+)"\s*:\s*\{"cat"/g)].map(m => m[1]));
    quotes.forEach(function(q, i) {
        assert.ok(q.text && String(q.text).trim(), 'empty text at ' + i);
        assert.ok(q.author && String(q.author).trim(), 'empty author at ' + i);
        assert.ok(q.source && String(q.source).trim(), 'empty source at ' + i);
        assert.strictEqual(typeof q.year, 'number', 'year not a number at ' + i);
        assert.ok(q.year >= 1500 && q.year <= 2026, 'year out of range at ' + i + ': ' + q.year);
        assert.ok(/^https:\/\/[^\s]+$/.test(q.url), 'url is not https at ' + i + ': ' + q.url);
        assert.ok(channels.has(q.channel), 'unknown channel at ' + i + ': ' + q.channel);
        const key = normText(q.text);
        assert.ok(!seen.has(key), 'duplicate text at ' + i);
        seen.add(key);
    });
});

test('daily order is a full cycle and stays put for one UTC day', () => {
    const src = read('features.js');
    const m = src.match(/\/\/ QOTD-PURE-START([\s\S]*?)\/\/ QOTD-PURE-END/);
    assert.ok(m, 'pure functions not marked');
    const api = new Function(m[1] + '\nreturn { qotdMulberry32: qotdMulberry32, qotdOrder: qotdOrder, qotdDayNumber: qotdDayNumber, qotdIndex: qotdIndex };')();
    const quotes = JSON.parse(read('data/quotes.json'));
    const n = quotes.length;
    const start = Date.UTC(2020, 0, 1);
    const seen = new Set();
    for (let i = 0; i < n; i++) {
        seen.add(api.qotdIndex(n, new Date(start + i * 86400000)));
    }
    assert.strictEqual(seen.size, n, 'a full cycle missed or repeated an index');
    const morning = new Date(Date.UTC(2026, 9, 22, 0, 30));
    const evening = new Date(Date.UTC(2026, 9, 22, 23, 30));
    assert.strictEqual(api.qotdIndex(n, morning), api.qotdIndex(n, evening));
    const next = new Date(Date.UTC(2026, 9, 23, 0, 30));
    assert.notStrictEqual(api.qotdIndex(n, morning), api.qotdIndex(n, next));
    const again = new Date(start + n * 86400000);
    assert.strictEqual(api.qotdIndex(n, new Date(start)), api.qotdIndex(n, again));
    assert.deepStrictEqual(api.qotdOrder(n), api.qotdOrder(n));
});

test('fallback quotes are a subset of quotes.json and the card escapes the source link', () => {
    const src = read('features.js');
    const quotes = JSON.parse(read('data/quotes.json'));
    const texts = new Set(quotes.map(q => q.text));
    const block = src.match(/var QOTD_FALLBACK = (\[[\s\S]*?\]);/);
    assert.ok(block, 'fallback array missing');
    const fallback = JSON.parse(block[1]);
    assert.ok(fallback.length >= 1);
    fallback.forEach(function(q) {
        assert.ok(texts.has(q.text), 'fallback not in quotes.json: ' + q.text);
        assert.ok(/^https:\/\//.test(q.url));
    });
    assert.ok(src.includes('escapeHtml(quote.text)'));
    assert.ok(src.includes('escapeHtml(href)'));
    assert.ok(src.includes('event.stopPropagation()'));
    assert.ok(src.includes("fetch('data/quotes.json?v=20261022_v2282'"));
    assert.ok(!src.includes('BITCOIN_QUOTES'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
