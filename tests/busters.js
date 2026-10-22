// Cache-buster pin. Live gh-pages is btc-archive-v2295.
// This branch is btc-archive-v2299. bundle.min.js stays on v2295.
// global-chat.js is 20261022_acctdel. features.registry.js stays on v2266.
// notifications.js stays on v2262. ranking.js is 20261022_acctdel.
// index.html and 404.html must stay identical.
// The precache keeps the classic Nacho deer and does not include nacho-fly.svg.
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

test('service worker cache is v2299', () => {
    const sw = read('sw.js');
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2299'"));
    assert.ok(sw.includes('./nacho-deer.svg'));
    assert.ok(!sw.includes('nacho-fly.svg'));
    ['v2295', 'v2293', 'v2279', 'v2278', 'v2272', 'v2271', 'v2270', 'v2269', 'v2268', 'v2267', 'v2266', 'v2265', 'v2264', 'v2263', 'v2262', 'v2261', 'v2260', 'v2259', 'v2258', 'v2257', 'v2256', 'v2255', 'v2254', 'v2253', 'v2252', 'v2251', 'v2250', 'v2249', 'v2248', 'v2247', 'v2246', 'v2245', 'v2240'].forEach(function(older) {
        assert.ok(!sw.includes('btc-archive-' + older), 'still mentions ' + older);
    });
});

test('index.html and 404.html match, and the changed script busters moved', () => {
    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    assert.strictEqual((html.match(/bundle\.min\.js\?v=20261022_v2295/g) || []).length, 2);
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2293'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2271'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2268'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2266'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2265'));
    assert.ok(html.includes('notifications.js?v=20261022_v2262'));
    assert.ok(html.includes('ranking.js?v=20261022_acctdel'));
    assert.ok(!html.includes('ranking.js?v=20261022_v2269'));
    assert.ok(!html.includes('ranking.js?v=20261022_lightfix'));
    assert.ok(html.includes('global-chat.js?v=20261022_acctdel'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2272'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2269'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2267'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2265'));
    assert.ok(html.includes('features.registry.js?v=20261022_v2266'));
    assert.ok(!html.includes('features.registry.js?v=20261022_v2265'));
    assert.ok(html.includes('gifting.js?v=20261022_v2254'));
    assert.ok(!html.includes('notifications.js?v=20261022_v2254'));
    assert.ok(!html.includes('notifications.js?v=20261022_gifts'));
    assert.ok(!html.includes('notifications.js?v=20261022_rewards'));
    assert.ok(!html.includes('gifting.js?v=20261022_lightfix'));
});

test('rebuilt bundle contains the marketplace save and delete payloads', () => {
    const bundle = read('bundle.min.js');
    const src = read('bundle.src.js');
    assert.ok(bundle.includes('savedBy:firebase.firestore.FieldValue.arrayUnion'), 'bundle.min.js was not rebuilt from marketplace.js');
    assert.ok(bundle.includes('savedBy:firebase.firestore.FieldValue.arrayRemove'));
    assert.ok(bundle.includes('deletedBy:auth.currentUser.uid'));
    assert.ok(bundle.includes('data-mkt-action'));
    assert.ok(bundle.includes('data-mkt-root'));
    assert.ok(bundle.includes('_bqDeepLinkHandled'));
    assert.ok(!bundle.includes('nacho-fly'));
    assert.ok(!src.includes('marketListings: firebase.firestore.FieldValue.increment'));
    assert.strictEqual(read('bundle.js'), bundle);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
