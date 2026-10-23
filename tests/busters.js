// Cache-buster pin. This ship branch is btc-archive-v2326.
// ranking.js, global-chat.js, learning-quests.js, and modules.js are 20261023_v2324.
// quests.js is 20261023_v2326 (donation badge XP reads the shared table).
// lightning.js, today-card.js, and satoshi-favor.js stay 20261023_v2323.
// tctv-watch.js stays on v2301.
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

test('service worker cache is v2326', () => {
    const sw = read('sw.js');
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2326'"));
    assert.ok(sw.includes('./nacho-deer.svg'));
    assert.ok(!sw.includes('nacho-fly.svg'));
    ['v2325', 'v2324', 'v2323', 'v2322', 'v2321', 'v2320', 'v2318', 'v2315', 'v2313', 'v2312', 'v2311', 'v2302', 'v2301', 'v2300', 'v2299', 'v2298', 'v2297', 'v2296', 'v2295', 'v2293', 'v2286', 'v2279', 'v2272', 'v2271', 'v2270', 'v2269', 'v2268', 'v2267', 'v2266', 'v2265', 'v2264', 'v2263', 'v2262', 'v2261', 'v2260', 'v2259', 'v2258', 'v2257', 'v2256', 'v2255', 'v2254', 'v2253', 'v2252', 'v2251', 'v2250', 'v2249', 'v2248', 'v2247', 'v2246', 'v2245', 'v2240'].forEach(function(older) {
        assert.ok(!sw.includes('btc-archive-' + older), 'still mentions ' + older);
    });
});

test('index.html and 404.html match, and the changed script busters moved', () => {
    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    assert.strictEqual((html.match(/bundle\.min\.js\?v=20261023_v2326/g) || []).length, 2);
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2295'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2293'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2279'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2271'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2268'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2266'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2265'));
    assert.ok(html.includes('notifications.js?v=20261022_v2322'));
    assert.ok(!html.includes('notifications.js?v=20261022_v2262'));
    assert.ok(html.includes('ranking.js?v=20261023_v2324'));
    assert.ok(!html.includes('ranking.js?v=20261022_v2269'));
    assert.ok(!html.includes('ranking.js?v=20261022_lightfix'));
    assert.ok(html.includes('global-chat.js?v=20261023_v2324'));
    assert.ok(!html.includes('global-chat.js?v=20261023_v2323'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2272'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2269'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2267'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2265'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2252'));
    assert.ok(html.includes('beats.js?v=20261022_v2322'));
    assert.ok(!html.includes('beats.js?v=20261013_2307'));
    assert.ok(html.includes('beats-censor.js?v=20261022_v2322'));
    assert.ok(html.indexOf('beats-censor.js?v=20261022_v2322') < html.indexOf('beats.js?v=20261022_v2322'));
    assert.ok(html.includes('features.registry.js?v=20261022_v2322'));
    assert.ok(!html.includes('features.registry.js?v=20261022_v2266'));
    assert.ok(!html.includes('features.registry.js?v=20261022_v2265'));
    assert.ok(html.includes('gifting.js?v=20261022_v2254'));
    assert.ok(!html.includes('notifications.js?v=20261022_v2254'));
    assert.ok(!html.includes('notifications.js?v=20261022_gifts'));
    assert.ok(!html.includes('notifications.js?v=20261022_rewards'));
    assert.ok(!html.includes('gifting.js?v=20261022_lightfix'));
    assert.ok(html.includes('id="patchNotesLink"'));
    assert.ok(!html.includes('Latest updates (v'), 'home link must not hardcode a version');
    assert.ok(html.includes('link.textContent = base + \' (\' + match[1] + \')\''));
    assert.ok(html.includes("/CACHE_NAME\\s*=\\s*'btc-archive-(v\\d+)'/"));
    assert.ok(html.includes("fetch('/sw.js'"));
    assert.ok(!html.includes("const CACHE_NAME = 'btc-archive-v2279'"));
    var swVersion = read('sw.js').match(/CACHE_NAME\s*=\s*'btc-archive-(v\d+)'/);
    assert.ok(html.includes('today-card.js?v=20261023_v2323'));
    assert.ok(html.includes('satoshi-favor.js?v=20261023_v2323'));
    assert.ok(!html.includes('satoshi-favor.js?v=20261023_v2324'));
    assert.ok(html.includes('lightning.js?v=20261023_v2323'));
    assert.ok(!html.includes('lightning.js?v=20261022_faucet'));
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261023_v2326/g) || []).length, 4);
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261023_v2324/g) || []).length, 0);
    assert.strictEqual((html.match(/learning-quests\.js\?v=20261023_v2324/g) || []).length, 3);
    assert.ok(!html.includes('quests.js?v=20261023_v2323'));
    assert.ok(swVersion && swVersion[1] === 'v2326');
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
