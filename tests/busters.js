// Cache-buster pin. This ship branch is btc-archive-v2365.
// v2359 is reserved for another branch. timechain-tv.js stays 20261024_v2353.
// bundle.min.js, global-chat.js, and patches.js stay 20261024_v2360.
// nacho-qa.js stays 20261024_v2350.
// ranking.js, features.registry.js, and quests.js stay 20261024_v2358.
// gifting.js is 20261024_v2365.
// notifications.js stays 20261024_v2357. onboarding.js is 20261024_v2358.
// satoshi-favor.js and username-repick.js stay 20261024_v2352.
// beats.js and guide.js stay 20261023_v2349. today-card.js is 20261024_v2351.
// scholar.js stays 20261023_v2330. tctv-watch.js stays 20261023_v2340.
// learning-quests.js and modules.js stay 20261023_v2324.
// lightning.js stays 20261023_v2323.
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

test('service worker cache is v2365', () => {
    const sw = read('sw.js');
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2365'"));
    assert.ok(!sw.includes('btc-archive-v2359'));
    assert.ok(!sw.includes('btc-archive-v2358'));
    assert.ok(!sw.includes('btc-archive-v2357'));
    assert.ok(!sw.includes('btc-archive-v2356'));
    assert.ok(!sw.includes('btc-archive-v2355'));
    assert.ok(!sw.includes('btc-archive-v2354'));
    assert.ok(!sw.includes('btc-archive-v2353'));
    assert.ok(!sw.includes('btc-archive-v2352'));
    assert.ok(!sw.includes('btc-archive-v2351'));
    assert.ok(sw.includes('./nacho-deer.svg'));
    assert.ok(!sw.includes('nacho-fly.svg'));
    ['v2360', 'v2359', 'v2358', 'v2357', 'v2356', 'v2355', 'v2354', 'v2353', 'v2352', 'v2351', 'v2350', 'v2349', 'v2348', 'v2347', 'v2346', 'v2345', 'v2344', 'v2343', 'v2342', 'v2341', 'v2340', 'v2339', 'v2338', 'v2337', 'v2336', 'v2335', 'v2334', 'v2333', 'v2332', 'v2331', 'v2330', 'v2329', 'v2328', 'v2327', 'v2326', 'v2325', 'v2324', 'v2323', 'v2322', 'v2321', 'v2320', 'v2318', 'v2315', 'v2313', 'v2312', 'v2311', 'v2302', 'v2301', 'v2300', 'v2299', 'v2298', 'v2297', 'v2296', 'v2295', 'v2293', 'v2286', 'v2279', 'v2272', 'v2271', 'v2270', 'v2269', 'v2268', 'v2267', 'v2266', 'v2265', 'v2264', 'v2263', 'v2262', 'v2261', 'v2260', 'v2259', 'v2258', 'v2257', 'v2256', 'v2255', 'v2254', 'v2253', 'v2252', 'v2251', 'v2250', 'v2249', 'v2248', 'v2247', 'v2246', 'v2245', 'v2240'].forEach(function(older) {
        assert.ok(!sw.includes('btc-archive-' + older), 'still mentions ' + older);
    });
});

test('index.html and 404.html match, and the changed script busters moved', () => {
    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    assert.strictEqual((html.match(/bundle\.min\.js\?v=20261024_v2360/g) || []).length, 2);
    assert.ok(html.includes('bundle.min.js?v=20261024_v2360'));
    assert.ok(!html.includes('bundle.min.js?v=20261024_v2358'));
    assert.ok(!html.includes('bundle.min.js?v=20261024_v2350'));
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2349'));
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2348'));
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2347'));
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2346'));
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2345'));
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2344'));
    assert.strictEqual(html.includes('bundle.min.js?v=20261023_v2344'), false);
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2343'));
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2342'));
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2341'));
    assert.strictEqual(html.includes('bundle.min.js?v=20261023_v2341'), false);
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2340'));
    assert.strictEqual(html.includes('bundle.min.js?v=20261023_v2340'), false);
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2342'));
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2341'));
    assert.ok(!html.includes('bundle.min.js?v=20261023_v2340'));
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
    assert.ok(html.includes('notifications.js?v=20261024_v2357'));
    assert.ok(!html.includes('notifications.js?v=20261024_v2355'));
    assert.ok(!html.includes('notifications.js?v=20261024_v2354'));
    assert.ok(!html.includes('notifications.js?v=20261024_v2352'));
    assert.ok(!html.includes('notifications.js?v=20261022_v2322'));
    assert.ok(!html.includes('notifications.js?v=20261022_v2262'));
    assert.ok(html.includes('username-repick.js?v=20261024_v2352'));
    assert.ok(!html.includes('username-repick.js?v=20261024_v2351'));
    assert.ok(html.includes('ranking.js?v=20261024_v2358'));
    assert.ok(html.indexOf('username-repick.js?v=20261024_v2352') < html.indexOf('ranking.js?v=20261024_v2358'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2357'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2356'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2355'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2354'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2352'));
    assert.ok(!html.includes('ranking.js?v=20261024_repickc'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2350'));
    assert.ok(!html.includes('ranking.js?v=20261024_repickb'));
    assert.ok(!html.includes('ranking.js?v=20261024_v2351'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2349'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2343'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2342'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2341'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2339'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2334'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2333'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2332'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2330'));
    assert.ok(!html.includes('ranking.js?v=20261022_v2269'));
    assert.ok(!html.includes('ranking.js?v=20261023_v2324'));
    assert.ok(html.includes('scholar.js?v=20261023_v2330'));
    assert.ok(!html.includes('ranking.js?v=20261022_lightfix'));
    assert.ok(html.includes('global-chat.js?v=20261024_v2360'));
    assert.ok(!html.includes('global-chat.js?v=20261024_v2350'));
    assert.ok(!html.includes('global-chat.js?v=20261023_v2349'));
    assert.ok(!html.includes('global-chat.js?v=20261023_v2346'));
    assert.ok(!html.includes('global-chat.js?v=20261023_v2345'));
    assert.ok(!html.includes('global-chat.js?v=20261023_v2343'));
    assert.ok(!html.includes('global-chat.js?v=20261023_v2342'));
    assert.ok(!html.includes('global-chat.js?v=20261023_v2341'));
    assert.ok(!html.includes('global-chat.js?v=20261023_v2333'));
    assert.strictEqual(html.includes('global-chat.js?v=20261023_v2333'), false);
    assert.ok(!html.includes('global-chat.js?v=20261023_v2324'));
    assert.ok(!html.includes('global-chat.js?v=20261023_v2323'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2272'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2269'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2267'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2265'));
    assert.ok(!html.includes('global-chat.js?v=20261022_v2252'));
    assert.ok(html.includes('beats.js?v=20261023_v2349'));
    assert.ok(!html.includes('beats.js?v=20261022_v2322'));
    assert.ok(!html.includes('beats.js?v=20261013_2307'));
    assert.ok(html.includes('beats-censor.js?v=20261022_v2322'));
    assert.ok(html.includes('features.registry.js?v=20261024_v2358'));
    assert.ok(!html.includes('features.registry.js?v=20261024_v2357'));
    assert.ok(!html.includes('features.registry.js?v=20261024_v2355'));
    assert.ok(!html.includes('features.registry.js?v=20261024_v2350'));
    assert.ok(!html.includes('features.registry.js?v=20261023_v2344'));
    assert.ok(!html.includes('features.registry.js?v=20261023_v2343'));
    assert.ok(!html.includes('features.registry.js?v=20261023_v2342'));
    assert.ok(!html.includes('features.registry.js?v=20261023_v2341'));
    assert.ok(!html.includes('features.registry.js?v=20261023_v2339'));
    assert.ok(html.indexOf('beats-censor.js?v=20261022_v2322') < html.indexOf('beats.js?v=20261023_v2349'));
    assert.ok(!html.includes('features.registry.js?v=20261023_v2330'));
    assert.ok(html.includes('nacho-qa.js?v=20261024_v2350'));
    assert.ok(!html.includes('nacho-qa.js?v=20261023_v2349'));
    assert.ok(!html.includes('nacho-qa.js?v=20261023_v2348'));
    assert.ok(!html.includes('nacho-qa.js?v=20261023_v2346'));
    assert.ok(!html.includes('nacho-qa.js?v=20261023_v2343'));
    assert.ok(!html.includes('nacho-qa.js?v=20261023_v2342'));
    assert.ok(!html.includes('nacho-qa.js?v=20261023_v2341'));
    assert.ok(!html.includes('nacho-qa.js?v=20261023_v2339'));
    assert.ok(!html.includes('nacho-qa.js?v=20261022_v2263'));
    assert.ok(!html.includes('features.registry.js?v=20261022_v2322'));
    assert.ok(!html.includes('features.registry.js?v=20261022_v2266'));
    assert.ok(!html.includes('features.registry.js?v=20261022_v2265'));
    assert.ok(html.includes('gifting.js?v=20261024_v2365'));
    assert.ok(!html.includes('gifting.js?v=20261024_v2358'));
    assert.ok(!html.includes('gifting.js?v=20261024_v2357'));
    assert.ok(!html.includes('gifting.js?v=20261024_v2355'));
    assert.ok(!html.includes('gifting.js?v=20261022_v2254'));
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
    assert.ok(html.includes('tctv-watch.js?v=20261023_v2340'));
    assert.ok(!html.includes('tctv-watch.js?v=20261023_v2338'));
    assert.ok(!html.includes('tctv-watch.js?v=20261022_v2301'));
    assert.ok(html.includes('today-card.js?v=20261024_v2351'));
    assert.ok(!html.includes('today-card.js?v=20261023_v2349'));
    assert.ok(!html.includes('today-card.js?v=20261023_v2330'));
    assert.ok(!html.includes('today-card.js?v=20261023_v2323'));
    assert.ok(html.includes('satoshi-favor.js?v=20261024_v2352'));
    assert.ok(!html.includes('satoshi-favor.js?v=20261024_v2351'));
    assert.ok(!html.includes('satoshi-favor.js?v=20261023_v2323'));
    assert.ok(!html.includes('satoshi-favor.js?v=20261023_v2324'));
    assert.ok(html.includes('lightning.js?v=20261023_v2323'));
    assert.ok(!html.includes('lightning.js?v=20261022_faucet'));
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261024_v2358/g) || []).length, 4);
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261024_v2352/g) || []).length, 0);
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261024_v2351/g) || []).length, 0);
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261024_v2350/g) || []).length, 0);
    assert.ok(!html.includes('quests.js?v=20261023_v2343'));
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261023_v2342/g) || []).length, 0);
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261023_v2341/g) || []).length, 0);
    assert.ok(!html.includes('quests.js?v=20261023_v2334'));
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261023_v2333/g) || []).length, 0);
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261023_v2326/g) || []).length, 0);
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261023_v2324/g) || []).length, 0);
    assert.strictEqual((html.match(/learning-quests\.js\?v=20261023_v2324/g) || []).length, 3);
    assert.ok(!html.includes('quests.js?v=20261023_v2323'));
    assert.ok(!html.includes('nacho-qa.js?v=20261022_v2263'));
    assert.ok(html.includes('guide.js?v=20261023_v2349'));
    assert.ok(!html.includes('guide.js?v=20261023_v2339'));
    assert.ok(html.includes('patches.js?v=20261024_v2360'));
    assert.ok(!html.includes('patches.js?v=20261023_v2349'));
    assert.ok(!html.includes('patches.js?v=20261022_v2263'));
    assert.ok(!html.includes('guide.js?v=20261022_v2322'));
    assert.ok(html.includes('timechain-tv.js?v=20261024_v2353'));
    assert.ok(!html.includes('timechain-tv.js?v=20261022_v2266'));
    assert.ok(swVersion && swVersion[1] === 'v2365');
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
    assert.ok(notes.includes('Latest: Opening gifts is faster, every button responds right away, and your prize shows the moment a gift opens.'));
    assert.ok(notes.includes('Topic conversation links open the paragraph they started from, highlight it, and leave the thread ready to reply.'));
    assert.ok(!notes.includes('Latest: Topic conversation links'));
    assert.ok(notes.includes('The share card says Let me teach you about Bitcoin, and the daily earn line and the sats stat both show 200.'));
    assert.ok(!notes.includes('Latest: The share card'));
    assert.ok(notes.includes('Key and cipher help now says that when an accepted peer opens a matching cipher with a key you sent, you both get the same prize and you see a reveal of what you won.'));
    assert.ok(!notes.includes('Latest: Key and cipher help'));
    assert.ok(notes.includes('When you send a key and a peer opens a matching cipher with it, you both win the same prize.'));
    assert.ok(!notes.includes('Latest: When you send a key'));
    assert.ok(notes.includes('Guests and Lightning-only accounts can link an email or Google from Sign-in methods, and sign-out warns them first.'));
    assert.ok(!notes.includes('Latest: Guests and Lightning-only'));
    assert.ok(notes.includes('Badges you already earned appear once, and one toast shows them.'));
    assert.ok(!notes.includes('Latest: Badges you already earned'));
    assert.ok(notes.includes('Timechain TV Music drops off-topic tracks, moves interviews and events onto the stations they belong on, and adds freedom and Bitcoin songs.'));
    assert.ok(!notes.includes('Latest: Timechain TV Music'));
    assert.ok(notes.includes('If your username was cleared, pick a new one from the prompt, and Satoshi\'s Favor shows your public name instead of Anonymous.'));
    assert.ok(!notes.includes('Latest: If your username'));
    assert.ok(notes.includes('Flex XP syncs on tap again, and Say hi shows a green dot after you say hi.'));
    assert.ok(!notes.includes('Latest: Flex XP'));
    assert.ok(notes.includes('Nacho answers from a large vetted Bitcoin knowledge base, with follow-ups he can answer and a steer back to Bitcoin.'));
    assert.ok(!notes.includes('Latest: Nacho answers from'));
    assert.ok(notes.includes('Nacho answers live Bitcoin questions with the number, the source, and the time, plus topic links and follow-up questions.'));
    assert.ok(!notes.includes('Latest: Nacho answers live'));
    assert.ok(notes.includes("On a phone, the chat, Nacho, stats, and trophy buttons sit above the bottom navigation with space from the screen edge, and Nacho's speech bubble sits fully above that row."));
    assert.ok(!notes.includes('Latest: On a phone'));
    assert.ok(notes.includes('New badges cover gifts, keys, ciphers, Nook, raffles, and setup.'));
    assert.ok(notes.includes('Satoshi\'s Favor shows how many points are left until the next hashing window, and the scroll buttons sit clear of the quest cards, the button row, and the bottom navigation.'));
    assert.ok(!notes.includes('Latest: New badges'));
    assert.ok(notes.includes('Topic conversations earn XP, a new one is also posted on Pleb Talk, and replies stay mirrored.'));
    assert.ok(!notes.includes('Latest: Topic conversations'));
    assert.ok(notes.includes('Topic pages include a Start a conversation button between the paragraphs, and each discussion post shows its date and time.'));
    assert.ok(!notes.includes('Latest: Topic pages include'));
    assert.ok(notes.includes('Google sign-in now works when you already have an account and were browsing as a guest.'));
    assert.ok(notes.includes('Google sign-in stays on this page and works on Android with the app installed.'));
    assert.ok(!notes.includes('Latest: Google sign-in'));
    assert.ok(notes.includes('The TCTV 0/10 minute timer now counts up live while you watch, and shows Done ✓ at 10.'));
    assert.ok(!notes.includes('Latest: The TCTV'));
    assert.ok(notes.includes('Daily XP is full through 500, half through 900, then a quarter until 1,000. Each tier rounds down. Extra XP is not saved.'));
    assert.ok(!notes.includes('Full XP through 600'));
    assert.ok(!notes.includes('Latest: One shared cap'));
    assert.ok(!notes.includes('Latest: Daily XP'));
    assert.ok(!notes.includes('Latest: The TCTV'));
    assert.ok(!notes.includes('Latest: Daily XP'));
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
