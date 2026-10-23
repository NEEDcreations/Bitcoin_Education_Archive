// Cache-buster pin. gh-pages is btc-archive-v2295.
// This branch is btc-archive-v2316 (v2295–v2315 are reserved).
// global-chat.js is v2272. features.registry.js and satoshi-favor.js are v2316.
// notifications.js, gifting.js, ranking.js, and push-prefs.js are 20261022_push.
// index.html and 404.html must stay identical. The precache keeps the
// classic Nacho deer and does not include nacho-fly.svg.
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

test('service worker cache is v2316', () => {
    const sw = read('sw.js');
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2316'"));
    assert.ok(sw.includes('./nacho-deer.svg'));
    assert.ok(!sw.includes('nacho-fly.svg'));
    for (var n = 2315; n >= 2240; n--) {
        assert.ok(!sw.includes('btc-archive-v' + n), 'still mentions v' + n);
    }
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
    assert.ok(html.includes('notifications.js?v=20261022_push'));
    assert.ok(html.includes('gifting.js?v=20261022_push'));
    assert.ok(html.includes('ranking.js?v=20261022_push'));
    assert.ok(html.includes('push-prefs.js?v=20261022_push'));
    assert.ok(!html.includes('notifications.js?v=20261022_v2262'));
    assert.ok(!html.includes('ranking.js?v=20261022_v2269'));
    assert.ok(!html.includes('ranking.js?v=20261022_lightfix'));
    assert.ok(html.includes('global-chat.js?v=20261022_v2272'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2269'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2267'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2265'));
    assert.ok(html.includes('features.registry.js?v=20261022_v2316'));
    assert.ok(!html.includes('features.registry.js?v=20261022_v2266'));
    assert.ok(!html.includes('features.registry.js?v=20261022_v2265'));
    assert.ok(html.includes('satoshi-favor.js?v=20261022_v2316'));
    assert.ok(!html.includes('satoshi-favor.js?v=20261022_v2250'));
    assert.ok(!html.includes('notifications.js?v=20261022_v2254'));
    assert.ok(!html.includes('notifications.js?v=20261022_gifts'));
    assert.ok(!html.includes('notifications.js?v=20261022_rewards'));
    assert.ok(!html.includes('gifting.js?v=20261022_v2254'));
    assert.ok(!html.includes('gifting.js?v=20261022_lightfix'));
    assert.ok(!html.includes('ranking.js?v=20261022_lightfix'));
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
