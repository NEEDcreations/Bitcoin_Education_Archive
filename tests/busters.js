// Cache-buster pin. This ship branch is btc-archive-v2341.
// bundle.min.js, features.registry.js, and nacho-qa.js are 20261023_v2341.
// ranking.js is 20261023_v2341. global-chat.js is 20261023_v2341.
// today-card.js and scholar.js stay 20261023_v2330.
// quests.js is 20261023_v2341. learning-quests.js and modules.js stay 20261023_v2324.
// lightning.js and satoshi-favor.js stay 20261023_v2323.
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

test('service worker cache is v2341', () => {
    const sw = read('sw.js');
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2341'"));
    assert.ok(sw.includes('./nacho-deer.svg'));
    assert.ok(!sw.includes('nacho-fly.svg'));
    ['v2340', 'v2339', 'v2338', 'v2337', 'v2336', 'v2335', 'v2334', 'v2333', 'v2332', 'v2331', 'v2330', 'v2329', 'v2328', 'v2327', 'v2326', 'v2325', 'v2324', 'v2323', 'v2322', 'v2321', 'v2320', 'v2318', 'v2315', 'v2313', 'v2312', 'v2311', 'v2302', 'v2301', 'v2300', 'v2299', 'v2298', 'v2297', 'v2296', 'v2295', 'v2293', 'v2286', 'v2279', 'v2272', 'v2271', 'v2270', 'v2269', 'v2268', 'v2267', 'v2266', 'v2265', 'v2264', 'v2263', 'v2262', 'v2261', 'v2260', 'v2259', 'v2258', 'v2257', 'v2256', 'v2255', 'v2254', 'v2253', 'v2252', 'v2251', 'v2250', 'v2249', 'v2248', 'v2247', 'v2246', 'v2245', 'v2240'].forEach(function(older) {
        assert.ok(!sw.includes('btc-archive-' + older), 'still mentions ' + older);
    });
});

test('index.html and 404.html match, and the changed script busters moved', () => {
    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    assert.strictEqual((html.match(/bundle\.min\.js\?v=20261023_v2341/g) || []).length, 2);
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2333'));
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2325'));
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2324'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2295'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2293'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2279'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2271'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2268'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2266'));
    assert.ok(!html.includes('bundle.min.js?v=20261022_v2265'));
    assert.ok(html.includes('notifications.js?v=20261022_v2322'));
    assert.ok(!html.includes('notifications.js?v=20261022_v2262'));
    assert.ok(html.includes('ranking.js?v=20261023_v2341'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2333'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2332'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2330'));
    assert.ok(!html.includes('ranking.js?v=20261022_v2269'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2324'));
    assert.ok(html.includes('scholar.js?v=20261023_v2330'));
    assert.ok(!html.includes('ranking.js?v=20261022_lightfix'));
    assert.ok(html.includes('global-chat.js?v=20261023_v2341'));
    assert.ok(!html.includes('global-chat.js?v=20261023_v2333'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2334'));
    assert.ok(!html.includes('quests.js?v=20261023_v2334'));
    assert.ok(!html.includes('global-chat.js?v=20261023_v2324'));
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
    assert.ok(html.includes('features.registry.js?v=20261023_v2341'));
    assert.ok(!html.includes('features.registry.js?v=20261023_v2330'));
    assert.ok(html.includes('nacho-qa.js?v=20261023_v2341'));
    assert.ok(!html.includes('nacho-qa.js?v=20261022_v2263'));
    assert.ok(!html.includes('features.registry.js?v=20261022_v2322'));
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
    assert.ok(html.includes('today-card.js?v=20261023_v2330'));
    assert.ok(!html.includes('today-card.js?v=20261023_v2323'));
    assert.ok(html.includes('satoshi-favor.js?v=20261023_v2323'));
    assert.ok(!html.includes('satoshi-favor.js?v=20261023_v2324'));
    assert.ok(html.includes('lightning.js?v=20261023_v2323'));
    assert.ok(!html.includes('lightning.js?v=20261022_faucet'));
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261023_v2341/g) || []).length, 4);
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261023_v2333/g) || []).length, 0);
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261023_v2326/g) || []).length, 0);
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261023_v2324/g) || []).length, 0);
    assert.strictEqual((html.match(/learning-quests\.js\?v=20261023_v2324/g) || []).length, 3);
    assert.ok(!html.includes('quests.js?v=20261023_v2323'));
    assert.ok(swVersion && swVersion[1] === 'v2341');
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

test('homepage topics ring counts explored channels and says 145', () => {
    const ux = read('mobile-ux.js');
    const start = ux.indexOf('window.renderProgressRings = function()');
    const end = ux.indexOf('// ---- #13: Welcome Back Message from Nacho ----');
    const fn = ux.slice(start, end);
    assert.ok(start !== -1 && end > start);
    assert.ok(fn.includes("var visited = window.getExploredCount ? window.getExploredCount() : safeJSON('btc_visited_channels', []).length;"));
    assert.ok(fn.includes('if (visited > totalChannels) visited = totalChannels;'));
    assert.ok(!fn.includes('readChannels'));
    assert.ok(!fn.includes('channelsVisited'));
    const html = read('index.html');
    assert.ok(!html.includes('146 topics'));
    assert.strictEqual((html.match(/145 topics/g) || []).length, 4);
    const app = read('app.js');
    assert.ok(app.includes('A curated Bitcoin education archive with 145 topics, 8800+ messages, and community tools.'));
    assert.ok(!app.includes('146 topics'));
    const src = read('bundle.src.js');
    assert.ok(src.includes("var visited = window.getExploredCount ? window.getExploredCount() : safeJSON('btc_visited_channels', []).length;"));
    const notes = read('patch-notes.html');
    assert.strictEqual((notes.match(/Latest:/g) || []).length, 1);
    assert.ok(notes.includes('Latest: Nacho answers live Bitcoin questions with the number, the source, and the time, plus topic links and follow-up questions.'));
    assert.ok(notes.includes('Daily XP is full through 500, half through 900, then a quarter until 1,000. Each tier rounds down. Extra XP is not saved.'));
    assert.ok(!notes.includes('Full XP through 600'));
    assert.ok(!notes.includes('Latest: One shared cap'));
    assert.ok(notes.includes('Badge XP now follows how long a badge takes to earn, from 10 up to 2,000. Cosmetic badges show 0.'));
    assert.ok(!notes.includes('Latest: Badge XP'));
    assert.ok(notes.includes('You can remember this device for 30 days after an authenticator code. Changing your Lightning Address, turning off 2FA, new recovery codes, and deleting the account still ask for a fresh code.'));
    assert.ok(notes.includes('The minimized Invite pill sits clear of the Bitcoin Quest title, and the Quest pill sits clear of the header buttons, the Invite pill, and the buttons along the bottom.'));
    assert.ok(!notes.includes('Latest: The minimized Invite pill'));
    assert.ok(notes.includes('Scholar and Protocol Expert certificates, and the 2,100 exam XP, are issued only from a server-recorded passing exam. Clearing profile flags cannot grant them again.'));
    assert.ok(notes.includes('The minimized Invite pill sits on the right edge, midway down the screen, clear of the header, the ticker, and the buttons along the bottom.'));
    assert.ok(notes.includes('The homepage topics ring counts the channels you have opened, and the archive lists 145 topics.'));
    assert.ok(!notes.includes('Latest: The homepage topics ring'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
