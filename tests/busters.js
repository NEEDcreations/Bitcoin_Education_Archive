// Cache-buster pin. gh-pages after #42 is btc-archive-v2265.
// This branch is btc-archive-v2273 (v2266–v2272 are reserved; re-bumped again at merge).
// index.html and 404.html must stay identical.
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

test('service worker cache is v2273', () => {
    const sw = read('sw.js');
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2273'"));
    ['v2272', 'v2271', 'v2270', 'v2269', 'v2268', 'v2267', 'v2266', 'v2265', 'v2264', 'v2263', 'v2262', 'v2261', 'v2260', 'v2259', 'v2258', 'v2257', 'v2256', 'v2255', 'v2254', 'v2253', 'v2252', 'v2251', 'v2250', 'v2249', 'v2248', 'v2247', 'v2246', 'v2245', 'v2240'].forEach(function(older) {
        assert.ok(!sw.includes('btc-archive-' + older), 'still mentions ' + older);
    });
});

test('index.html and 404.html match, and the changed script busters moved', () => {
    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    assert.ok(html.includes('notifications.js?v=20261022_push'));
    assert.ok(html.includes('gifting.js?v=20261022_push'));
    assert.ok(html.includes('ranking.js?v=20261022_push'));
    assert.ok(html.includes('bundle.min.js?v=20261022_v2265'));
    assert.ok(html.includes('global-chat.js?v=20261022_v2265'));
    assert.ok(!html.includes('notifications.js?v=20261022_v2262'));
    assert.ok(!html.includes('notifications.js?v=20261022_v2254'));
    assert.ok(!html.includes('notifications.js?v=20261022_gifts'));
    assert.ok(!html.includes('notifications.js?v=20261022_rewards'));
    assert.ok(!html.includes('gifting.js?v=20261022_v2254'));
    assert.ok(!html.includes('gifting.js?v=20261022_lightfix'));
    assert.ok(!html.includes('ranking.js?v=20261022_lightfix'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
