// Push prefs, prompt timing, and sender category checks. No network.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

const a = read('functions/src/pushPrefs.js');
const b = read('push-prefs.js');
assert.strictEqual(a, b, 'push-prefs.js must match functions/src/pushPrefs.js');

const prefs = require('../functions/src/pushPrefs');
const DAY = prefs.DAY_MS;

function test(name, fn) {
    fn();
    console.log('✅ ' + name);
}

test('push is off until the user doc opts in, then category defaults apply', function() {
    assert.strictEqual(prefs.categoryAllowed({}, 'rewards'), false);
    assert.strictEqual(prefs.categoryAllowed({}, 'gifts'), false);
    assert.strictEqual(prefs.categoryAllowed({}, 'dms'), false);
    assert.strictEqual(prefs.categoryAllowed({}, 'plebtalk'), false);
    assert.strictEqual(prefs.categoryAllowed({}, 'news'), false);
    assert.strictEqual(prefs.categoryAllowed({ notificationPrefs: {} }, 'rewards'), false);
    assert.strictEqual(prefs.categoryAllowed({ notificationPrefs: {} }, 'reminders'), false);
    assert.strictEqual(prefs.categoryAllowed({ notificationPrefs: { rewards: true } }, 'rewards'), false);
    assert.strictEqual(prefs.categoryAllowed({ notificationPrefs: { news: true } }, 'news'), false);
    assert.strictEqual(prefs.categoryAllowed({ notificationPrefs: { master: false, rewards: true } }, 'rewards'), false);
    assert.strictEqual(prefs.categoryAllowed({ notificationPrefs: { master: 'true' } }, 'rewards'), false);
    assert.strictEqual(prefs.categoryAllowed({ notificationPrefs: { rewards: 'true' } }, 'rewards'), false);
    assert.strictEqual(prefs.categoryAllowed({}, 'nope'), false);
    assert.strictEqual(prefs.categoryAllowed({ notificationPrefs: { master: true } }, 'rewards'), true);
    assert.strictEqual(prefs.categoryAllowed({ notificationPrefs: { master: true } }, 'gifts'), true);
    assert.strictEqual(prefs.categoryAllowed({ notificationPrefs: { master: true } }, 'dms'), true);
    assert.strictEqual(prefs.categoryAllowed({ notificationPrefs: { master: true } }, 'reminders'), true);
    assert.strictEqual(prefs.categoryAllowed({ notificationPrefs: { master: true } }, 'plebtalk'), false);
    assert.strictEqual(prefs.categoryAllowed({ notificationPrefs: { master: true } }, 'news'), false);
    assert.strictEqual(prefs.categoryAllowed({ notificationPrefs: { master: true, news: true } }, 'news'), true);
    assert.strictEqual(prefs.categoryAllowed({ notificationPrefs: { master: true, rewards: false } }, 'rewards'), false);
    assert.strictEqual(prefs.categoryAllowed({ notificationPrefs: { master: true, rewards: 'true' } }, 'rewards'), false);
    assert.strictEqual(prefs.categoryAllowed({ notificationPrefs: { master: true } }, 'nope'), false);
});

test('prompt timing', function() {
    const base = { now: 100 * DAY, permission: 'default', prompt: { count: 0 }, sessionCount: 1, totalVisits: 1, daysSinceVisit: 0 };
    assert.strictEqual(prefs.decidePrompt(base).reason, 'first-session');
    assert.strictEqual(prefs.decidePrompt(Object.assign({}, base, { daysSinceVisit: 30 })).reason, 'first-session');
    const second = prefs.decidePrompt(Object.assign({}, base, { sessionCount: 2, totalVisits: 1, daysSinceVisit: 0 }));
    assert.strictEqual(second.show, true);
    assert.strictEqual(second.reason, 'second-session');
    assert.strictEqual(second.showDontAsk, false);
    assert.strictEqual(second.kind, 'standard');
    const returning = prefs.decidePrompt(Object.assign({}, base, { sessionCount: 1, totalVisits: 5, daysSinceVisit: 8 }));
    assert.strictEqual(returning.reason, 'returning');
    assert.strictEqual(prefs.decidePrompt(Object.assign({}, base, { sessionCount: 1, totalVisits: 5, daysSinceVisit: 1 })).reason, 'wait');
    assert.strictEqual(prefs.decidePrompt(Object.assign({}, second && base, { permission: 'granted', sessionCount: 2 })).reason, 'granted');
    assert.strictEqual(prefs.decidePrompt(Object.assign({}, base, { permission: 'denied', sessionCount: 2 })).reason, 'denied');
    assert.strictEqual(prefs.decidePrompt(Object.assign({}, base, { permission: 'unsupported', sessionCount: 2 })).reason, 'unsupported');
    assert.strictEqual(prefs.decidePrompt(Object.assign({}, base, { sessionCount: 2, prompt: { stopped: true } })).reason, 'stopped');
    assert.strictEqual(prefs.decidePrompt(Object.assign({}, base, { sessionCount: 2, busy: true })).reason, 'busy');
    assert.strictEqual(prefs.decidePrompt(Object.assign({}, base, { sessionCount: 2, popupTaken: true })).reason, 'popup');
    const asked = { count: 1, lastAsked: 100 * DAY - 10 * DAY };
    assert.strictEqual(prefs.decidePrompt(Object.assign({}, base, { sessionCount: 3, totalVisits: 4, prompt: asked })).reason, 'needs-context');
    assert.strictEqual(prefs.decidePrompt(Object.assign({}, base, { sessionCount: 3, totalVisits: 4, prompt: asked, context: 'win' })).reason, 'too-soon');
    const reask = prefs.decidePrompt(Object.assign({}, base, {
        sessionCount: 3, totalVisits: 4, context: 'win',
        prompt: { count: 1, lastAsked: 100 * DAY - 30 * DAY }
    }));
    assert.strictEqual(reask.show, true);
    assert.strictEqual(reask.reason, 'reask');
    assert.strictEqual(reask.kind, 'context');
    assert.strictEqual(reask.showDontAsk, true);
    assert.strictEqual(prefs.decidePrompt(Object.assign({}, base, { sessionCount: 4, prompt: { count: 3 } })).reason, 'max');
    const install = prefs.decidePrompt(Object.assign({}, base, { sessionCount: 2, iosNeedsInstall: true }));
    assert.strictEqual(install.kind, 'install');
    assert.strictEqual(prefs.decidePrompt(Object.assign({}, base, { iosNeedsInstall: true })).reason, 'first-session');
});

test('web push payload and test target', function() {
    const msg = prefs.buildWebPushMessage('tok', {
        title: '<b>Hi</b>',
        body: 'a&b',
        url: 'javascript:alert(1)',
        type: 'rewards'
    });
    assert.ok(msg.notification);
    assert.ok(msg.notification.title.indexOf('<') === -1);
    assert.strictEqual(msg.data.url, 'https://bitcoineducation.quest/');
    assert.strictEqual(msg.webpush.fcmOptions.link, msg.data.url);
    assert.strictEqual(msg.data.type, 'rewards');
    const ok = prefs.buildWebPushMessage('tok', { title: 'T', body: 'B', url: 'https://bitcoineducation.quest/#pvp', type: 'pvp' });
    assert.ok(ok.data.url.indexOf('#pvp') !== -1);
    assert.strictEqual(prefs.safePushUrl('https://evil.example/phish'), 'https://bitcoineducation.quest/');
    assert.strictEqual(prefs.testPushTargetAllowed('u1', 'u1', false), true);
    assert.strictEqual(prefs.testPushTargetAllowed('u1', 'u2', false), false);
    assert.strictEqual(prefs.testPushTargetAllowed('u1', 'u2', true), true);
});

test('client and workers share the safe push path', function() {
    const client = read('notifications.js');
    const sw = read('sw.js');
    const fcm = read('firebase-messaging-sw.js');
    const rules = read('firestore.rules');
    const push = read('functions/src/push.js');
    assert.ok(client.includes('decidePrompt'));
    assert.ok(client.includes('categoryAllowed'));
    const sync = client.slice(client.indexOf('window.syncPushRegistration = function'), client.indexOf('window.schedulePushPrompt = function'));
    assert.ok(sync.includes('master !== true'), 'silent sync must require an explicit opt-in');
    assert.strictEqual(sync.includes('master === false'), false, 'granted permission must not subscribe when master is missing');
    const mode = client.slice(client.indexOf('function masterMode'), client.indexOf('function toast'));
    assert.ok(mode.includes('map.master === true'));
    assert.ok(client.includes('BF_YipiWF9DWsA4HA44xJwYOZkHuLZ1lE9nBxiF96Ba7mgGgWA3IsG4aUjEnc_PoLuYpsxRLsmjsHSjEvL_Xt-E'));
    assert.strictEqual(client.includes('BEGIN PRIVATE'), false);
    assert.ok(client.includes('settings-notifications'));
    assert.ok(client.includes('serviceWorkerRegistration'));
    assert.ok(sw.includes('stopImmediatePropagation'));
    assert.ok(sw.includes('clients.matchAll'));
    assert.ok(sw.includes('navigate'));
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2321'"));
    assert.strictEqual(sw.includes('btc-archive-v2314'), false);
    assert.strictEqual(sw.includes('btc-archive-v2295'), false);
    assert.strictEqual(sw.includes('btc-archive-v2273'), false);
    assert.strictEqual(sw.includes('btc-archive-v2272'), false);
    assert.strictEqual(sw.includes('btc-archive-v2271'), false);
    assert.strictEqual(sw.includes('btc-archive-v2270'), false);
    assert.strictEqual(sw.includes('btc-archive-v2269'), false);
    assert.strictEqual(sw.includes('btc-archive-v2268'), false);
    assert.strictEqual(sw.includes('btc-archive-v2267'), false);
    assert.strictEqual(sw.includes('btc-archive-v2266'), false);
    assert.strictEqual(sw.includes('btc-archive-v2265'), false);
    assert.strictEqual(sw.includes('btc-archive-v2264'), false);
    assert.strictEqual(sw.includes('btc-archive-v2263'), false);
    assert.strictEqual(sw.includes('btc-archive-v2252'), false);
    assert.strictEqual(sw.includes('btc-archive-v2253'), false);
    assert.ok(fcm.includes('stopImmediatePropagation'));
    assert.ok(push.includes('categoryAllowed'));
    assert.ok(rules.includes('notificationPrefs'));
    assert.ok(rules.includes('notifPrompt'));
    assert.ok(rules.includes('devices'));
    assert.ok(rules.includes('request.auth.uid == uid'));
    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    assert.ok(html.includes('push-prefs.js?v=20261022_v2321'));
    assert.ok(html.includes('id="settings-notifications"') === false);
    assert.ok(html.includes("sessionStorage.setItem('btc_open_notif_settings'"));
    assert.ok(read('ranking.js').includes('id="settings-notifications"'));
});

test('every sender names a category the prefs module knows', function() {
    const files = {
        'functions/index.js': ['reminders', 'rewards', 'gifts', 'pvp', 'referrals', 'mentions', 'dms', 'plebtalk', 'news'],
        'functions/src/gifting.js': ['gifts', 'mentions'],
        'functions/src/predictionJobs.js': ['predictions'],
        'functions/src/peerLevel.js': ['gifts'],
        'functions/src/tweetSatoshisFavor.js': ['favor']
    };
    Object.keys(files).forEach(function(file) {
        const text = read(file);
        assert.ok(text.includes('sendUserPush') || text.includes('broadcastCategory') || text.includes('pushHooks.sendPush'), file);
        files[file].forEach(function(cat) {
            assert.ok(prefs.CATEGORIES.indexOf(cat) !== -1, cat);
            assert.ok(text.includes("'" + cat + "'"), file + ' ' + cat);
        });
    });
    const tree = ['functions/index.js', 'functions/src/gifting.js', 'functions/src/predictionJobs.js', 'functions/src/peerLevel.js', 'functions/src/tweetSatoshisFavor.js'];
    tree.forEach(function(file) {
        assert.strictEqual(read(file).includes('admin.messaging('), false, file);
    });
    assert.ok(read('functions/src/push.js').includes('admin.messaging('));
    assert.ok(read('functions/index.js').includes('exports.sendTestPush'));
});

test('push security: sign-out, identity, dead tokens, caps, and click links', function() {
    const push = read('functions/src/push.js');
    const index = read('functions/index.js');
    const ranking = read('ranking.js');
    const sw = read('sw.js');
    const fcm = read('firebase-messaging-sw.js');
    const notes = read('patch-notes.html');
    const privacy = read('privacy.html');
    assert.strictEqual(push.includes('messaging/invalid-argument'), false);
    assert.ok(push.includes('messaging/registration-token-not-registered'));
    assert.ok(push.includes('messaging/invalid-registration-token'));
    assert.ok(push.includes('MAX_DEVICES = 10'));
    assert.ok(push.includes('releaseTokenFromOthers'));
    assert.ok(push.includes('capUserDevices'));
    assert.ok(push.includes('banned === true'));
    assert.ok(push.includes('sendEach'));
    assert.ok(push.includes('PREP_CHUNK'));
    const signOut = ranking.slice(ranking.indexOf('async function signOutUser'), ranking.indexOf('window.hideUsernamePrompt'));
    assert.ok(signOut.indexOf('deleteToken') < signOut.indexOf('auth.signOut'));
    assert.ok(signOut.includes("collection('devices')"));
    assert.ok(signOut.includes('.delete()'));
    const between = signOut.slice(signOut.indexOf('.delete()'), signOut.indexOf('deleteToken'));
    assert.ok(between.includes('catch'), 'token delete and deleteToken are separate tries');
    const gift = read('functions/src/gifting.js');
    const shout = gift.slice(gift.indexOf('async function publishShoutout'), gift.indexOf('async function maybeAnnounceShoutout'));
    assert.ok(shout.includes('publishShoutoutOnce'));
    assert.ok(shout.includes('published.wrote'));
    assert.strictEqual(shout.includes('runTransaction'), false);
    assert.ok(!read('functions/src/activityShoutout.js').includes('sendUserPush'));
    const helpers = index.slice(index.indexOf('function _pushUidOk'), index.indexOf('exports.onDmMessageCreated'));
    assert.ok(helpers.includes('blockedUsers'));
    assert.ok(helpers.includes('banned === true'));
    assert.ok(helpers.includes('anonymous === true'));
    assert.ok(helpers.includes('username'));
    const dm = index.slice(index.indexOf('exports.onDmMessageCreated'), index.indexOf('exports.onMarketplaceMessageCreated'));
    assert.strictEqual(dm.includes('msg.senderName'), false);
    assert.ok(dm.includes('_pushDisplayName'));
    assert.ok(dm.includes('_pushSenderBlocked'));
    assert.ok(dm.includes('_pushSenderEligible'));
    const market = index.slice(index.indexOf('exports.onMarketplaceMessageCreated'), index.indexOf('exports.onPushDeviceWritten'));
    assert.strictEqual(market.includes('msg.buyerName'), false);
    assert.strictEqual(market.includes('msg.sellerUid'), false);
    assert.ok(market.includes("collection('marketplace')"));
    assert.ok(market.includes('sellerUid'));
    assert.ok(market.includes('_pushDisplayName'));
    assert.ok(market.includes('_pushSenderBlocked'));
    assert.ok(market.includes('_pushSenderEligible'));
    assert.ok(index.includes('exports.onPushDeviceWritten'));
    assert.ok(index.includes('timeoutSeconds: 540'));
    assert.ok(read('functions/src/tweetSatoshisFavor.js').includes('timeoutSeconds: 540'));
    assert.ok(sw.includes('try {'));
    assert.ok(sw.includes('importScripts('));
    assert.ok(sw.includes("u.protocol === 'https:'"));
    assert.ok(sw.includes('u.origin === self.location.origin'));
    assert.strictEqual(sw.includes("u.protocol === 'http:'"), false);
    assert.ok(fcm.includes('try {'));
    assert.ok(fcm.includes('importScripts('));
    assert.strictEqual(fcm.includes("u.protocol === 'http:'"), false);
    assert.ok(notes.includes('Push notifications now work, with per-category controls in Settings.'));
    assert.ok(privacy.includes('Signing out removes this device\'s token'));
});

console.log('push tests ok');
