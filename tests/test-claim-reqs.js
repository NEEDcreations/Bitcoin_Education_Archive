#!/usr/bin/env node
// New-account sats claim requirements. Pure decisions plus source pins.
// The Firestore emulator case lives in tests/rules/claim-req-rules.js.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.REFERRAL_IP_HMAC_SECRET = 'claim-req-test-secret-32b';

const root = path.join(__dirname, '..');
const claimReqs = require(path.join(root, 'functions', 'src', 'claimReqs'));
const visitMod = require(path.join(root, 'functions', 'src', 'claimReqVisit'));

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

const START = claimReqs.CLAIM_REQS_START;
const HEX = {
    devA: 'a'.repeat(64),
    devB: 'b'.repeat(64),
    ipA: 'c'.repeat(64),
    ipB: 'd'.repeat(64),
};

function visit(over) {
    return claimReqs.assessReferralVisit(Object.assign({
        visitDeviceHmac: HEX.devB,
        visitIpHmac: HEX.ipB,
        ownerDeviceHmacs: [HEX.devA],
        ownerIpHmacs: [HEX.ipA],
    }, over || {}));
}

test('start instant is the deploy constant', () => {
    assert.strictEqual(claimReqs.CLAIM_REQS_START_ISO, '2026-10-26T21:00:00.000Z');
    assert.strictEqual(START, Date.parse('2026-10-26T21:00:00.000Z'));
    assert.strictEqual(claimReqs.MIN_CHAT_CHARS, 3);
    assert.strictEqual(claimReqs.MIN_TCTV_SECONDS, 30);
});

test('exempt only when Auth creation is strictly before the start', () => {
    assert.strictEqual(claimReqs.isExempt(START - 1), true);
    assert.strictEqual(claimReqs.isExempt(START), false);
    assert.strictEqual(claimReqs.isExempt(START + 1), false);
    assert.strictEqual(claimReqs.isExempt(0), false);
    assert.strictEqual(claimReqs.isExempt(NaN), false);
    assert.strictEqual(claimReqs.isExempt(null), false);
    assert.strictEqual(claimReqs.isExempt(''), false);
    assert.deepStrictEqual(claimReqs.missingItems({}, START - 1), []);
    assert.deepStrictEqual(claimReqs.missingItems({ created: START + 999 }, START - 1), []);
});

test('a new account is missing each stamp until the server writes it', () => {
    assert.deepStrictEqual(claimReqs.missingItems({}, START), ['chat', 'tctv', 'referral']);
    assert.deepStrictEqual(claimReqs.missingItems({ claimReq: { chatAt: START } }, START), ['tctv', 'referral']);
    assert.deepStrictEqual(claimReqs.missingItems({ claimReq: { tctvAt: { seconds: 10 } } }, START), ['chat', 'referral']);
    assert.deepStrictEqual(claimReqs.missingItems({ claimReq: { referralAt: '2026-10-27T00:00:00.000Z' } }, START), ['chat', 'tctv']);
    const done = { claimReq: { chatAt: 1, tctvAt: 1, referralAt: 1 } };
    assert.deepStrictEqual(claimReqs.missingItems(done, START), []);
    assert.deepStrictEqual(claimReqs.missingItems({ created: START - 1 }, START), ['chat', 'tctv', 'referral']);
});

test('the claim error names only the missing items', () => {
    const chatOnly = claimReqs.missingError(['chat']);
    assert.ok(chatOnly.includes('send 1 chat message'));
    assert.ok(!chatOnly.includes('Timechain'));
    assert.ok(!chatOnly.includes('referral'));
    const tvOnly = claimReqs.missingError(['tctv']);
    assert.ok(tvOnly.includes('watch Timechain TV for 30 seconds'));
    assert.ok(!tvOnly.includes('chat message'));
    const refOnly = claimReqs.missingError(['referral']);
    assert.ok(refOnly.includes('another device and network'));
    assert.ok(!refOnly.includes('chat message'));
    const all = claimReqs.missingError(['chat', 'tctv', 'referral']);
    assert.ok(all.indexOf('send 1 chat message') < all.indexOf('watch Timechain'));
    assert.ok(all.indexOf('watch Timechain') < all.indexOf('another device'));
    assert.ok(all.indexOf('Finish these before claiming:') === 0);
});

test('chat counts only a short real message the filter would keep', () => {
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'hi' }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'hey' }), true);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'hello there' }), true);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'fuck this place' }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'hey', deleted: true }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'hey', status: 'deleted' }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'nacho-bot', text: 'hello friends' }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'tg_123', text: 'hello friends' }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'hey', isNachoAuto: true }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'hey', source: 'telegram' }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'https://example.com' }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: '[link removed]' }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'aaaaaaa' }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'mail me at pleb@example.com' }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'double your bitcoin now' }), false);
});

test('Timechain TV counts at 30 recorded seconds', () => {
    assert.strictEqual(claimReqs.tctvQualifies(29), false);
    assert.strictEqual(claimReqs.tctvQualifies(29.9), false);
    assert.strictEqual(claimReqs.tctvQualifies(30), true);
    assert.strictEqual(claimReqs.tctvQualifies('30'), true);
    assert.strictEqual(claimReqs.tctvQualifies(0), false);
    assert.strictEqual(claimReqs.tctvQualifies(null), false);
});

test('a referral visit counts only from a different device and a different network', () => {
    const sameBoth = visit({ visitDeviceHmac: HEX.devA, visitIpHmac: HEX.ipA });
    assert.strictEqual(sameBoth.count, false);
    assert.strictEqual(sameBoth.reason, 'same-device-ip');
    const sameDevice = visit({ visitDeviceHmac: HEX.devA, visitIpHmac: HEX.ipB });
    assert.strictEqual(sameDevice.count, false);
    assert.strictEqual(sameDevice.reason, 'same-device');
    const sameIp = visit({ visitDeviceHmac: HEX.devB, visitIpHmac: HEX.ipA });
    assert.strictEqual(sameIp.count, false);
    assert.strictEqual(sameIp.reason, 'same-ip');
    const different = visit();
    assert.strictEqual(different.count, true);
    assert.strictEqual(different.reason, 'counted');
    const noBase = visit({ ownerDeviceHmacs: [], ownerIpHmacs: [] });
    assert.strictEqual(noBase.count, false);
    assert.strictEqual(noBase.reason, 'no-baseline');
    const noIps = visit({ ownerIpHmacs: [] });
    assert.strictEqual(noIps.count, false);
    assert.strictEqual(noIps.reason, 'no-baseline');
    const owner = visit({ callerIsOwner: true, visitDeviceHmac: HEX.devB, visitIpHmac: HEX.ipB });
    assert.strictEqual(owner.count, false);
    assert.strictEqual(owner.remember, true);
    assert.strictEqual(owner.reason, 'owner');
    const missing = visit({ visitDeviceHmac: 'not-an-hmac' });
    assert.strictEqual(missing.count, false);
    assert.strictEqual(missing.remember, false);
});

test('visit logging is rate limited per gap and per hour', () => {
    const first = claimReqs.visitRateDecision({}, 10000, 20);
    assert.strictEqual(first.ok, true);
    assert.strictEqual(first.count, 1);
    const soon = claimReqs.visitRateDecision({ lastMs: 10000, windowStart: 10000, count: 1 }, 11999, 20);
    assert.strictEqual(soon.ok, false);
    const later = claimReqs.visitRateDecision({ lastMs: 10000, windowStart: 10000, count: 1 }, 12000, 20);
    assert.strictEqual(later.ok, true);
    assert.strictEqual(later.count, 2);
    const capped = claimReqs.visitRateDecision({ lastMs: 10000, windowStart: 10000, count: 20 }, 10000 + 60000, 20);
    assert.strictEqual(capped.ok, false);
    assert.strictEqual(capped.reason, 'rate-hour');
});

test('known IP material is hashed and raw addresses are not kept', () => {
    const raw = '203.0.113.10';
    const hashed = visitMod.ipMaterials([raw, HEX.ipA, 'not an ip']);
    assert.ok(hashed.indexOf(raw) === -1);
    assert.ok(hashed.indexOf(HEX.ipA) !== -1);
    hashed.forEach(function (item) {
        assert.ok(/^[a-f0-9]{64}$/.test(item));
    });
    assert.strictEqual(visitMod.deviceMaterial('abc_1234'), 'device:abc_1234');
    assert.strictEqual(visitMod.deviceMaterial('short'), '');
});

test('claimSats decides from Auth creation time and returns the missing list', () => {
    const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    const early = index.indexOf('const authCreatedMs = creationDate.getTime()');
    assert.ok(early !== -1);
    const earlyBlock = index.slice(early, early + 500);
    assert.ok(earlyBlock.includes('claimReqs.missingItems'));
    assert.ok(earlyBlock.includes('claimReqs.missingError'));
    assert.ok(earlyBlock.includes('success: false'));
    assert.ok(!earlyBlock.includes('user.created'));
    assert.ok(!earlyBlock.includes('.created'));
    const tx = index.indexOf('const claimMissing = claimReqs.missingItems');
    assert.ok(tx !== -1);
    const txBlock = index.slice(tx, tx + 220);
    assert.ok(txBlock.includes('userRecord.metadata.creationTime'));
    assert.ok(txBlock.includes('deny(claimReqs.missingError'));
    const chat = index.indexOf("exports.onChatMessageCreated");
    const chatBlock = index.slice(chat, chat + 1800);
    assert.ok(chatBlock.includes('claimReqs.chatQualifies'));
    assert.ok(chatBlock.includes("'claimReq.chatAt'"));
    assert.ok(index.includes('exports.logReferralVisit'));
    assert.strictEqual((index.match(/enforceAppCheck:\s*true/g) || []).length, 5);
});

test('watch heartbeat and the visit callable stamp server-side only', () => {
    const watch = fs.readFileSync(path.join(root, 'functions', 'tctv-watch-callable.js'), 'utf8');
    assert.ok(watch.includes('claimReqs.tctvQualifies(watchedSeconds)'));
    assert.ok(watch.includes("'claimReq.tctvAt'"));
    const visit = fs.readFileSync(path.join(root, 'functions', 'src', 'claimReqVisit.js'), 'utf8');
    assert.ok(visit.includes('enforceAppCheck: true'));
    assert.ok(visit.includes('deviceHmac: visitDeviceHmac'));
    assert.ok(visit.includes('ipHmac: visitIpHmac'));
    assert.ok(visit.includes("'claimReq.referralAt'"));
    assert.ok(visit.includes('refvisit_ip_'));
    assert.ok(visit.includes('refvisit_code_'));
    assert.ok(!visit.includes('rawIp:'));
    assert.ok(!visit.includes('console.log'));
    assert.ok(!visit.includes('console.warn'));
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const keysFn = rules.slice(rules.indexOf('function userProfileServerOnlyKeys()'), rules.indexOf('match /users/{userId}'));
    assert.ok(keysFn.includes("'claimReq'"));
    const blocked = rules.slice(rules.indexOf('function profileUpdateBlocked()'), rules.indexOf('function profileShapeOk()'));
    assert.ok(blocked.includes("'claimReq'"));
    const createRule = rules.slice(rules.indexOf('allow create: if request.auth != null'), rules.indexOf('allow update: if request.auth != null'));
    assert.ok(!createRule.includes("'claimReq'"));
    const visits = rules.slice(rules.indexOf('match /referral_visits/{docId}'), rules.indexOf('match /referral_visits/{docId}') + 180);
    assert.ok(visits.includes('allow read, write: if false'));
    const pub = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    const fields = pub.slice(pub.indexOf('const PUBLIC_PROFILE_FIELDS'), pub.indexOf('exports.syncPublicProfile'));
    assert.ok(!fields.includes('claimReq'));
});

test('a VPN, proxy, or datacenter rejection tells the player to turn the VPN off', () => {
    const text = 'Turn off your VPN and try again.';
    assert.strictEqual(claimReqs.blockedConnectionError('vpn'), text);
    assert.strictEqual(claimReqs.blockedConnectionError('proxy'), text);
    assert.strictEqual(claimReqs.blockedConnectionError('datacenter'), text);
    assert.strictEqual(claimReqs.blockedConnectionError('tor'), text);
    assert.strictEqual(claimReqs.blockedConnectionError('network_hard'), '');
    const denied = claimReqs.connectionClaimResult({ action: 'deny', reason: 'datacenter', message: 'Try home Wi-Fi.' });
    assert.strictEqual(denied.error, text);
    assert.strictEqual(denied.code, 'datacenter');
    const held = claimReqs.connectionClaimResult({ action: 'hold', reason: 'proxy', message: 'long hold copy' });
    assert.strictEqual(held.error, text);
    assert.strictEqual(claimReqs.connectionClaimResult({ action: 'allow', reason: 'clean' }), null);
    assert.strictEqual(claimReqs.connectionClaimResult({ action: 'hold', reason: 'device-fraud', message: 'This device is already linked to another account.' }).error, 'This device is already linked to another account.');
    const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    const at = index.indexOf('const connectionClaim = claimReqs.connectionClaimResult');
    assert.ok(at !== -1);
    assert.ok(index.indexOf("require('./src/ipReputation')") !== -1);
    assert.ok(index.indexOf("connectionErr.code !== 'MODULE_NOT_FOUND'") !== -1);
});

test('the Requirements card shows the three rows, Go, and Share', () => {
    const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
    assert.ok(ranking.includes("Date.parse('2026-10-26T21:00:00.000Z')"));
    assert.ok(ranking.includes('Send 1 message in Chat'));
    assert.ok(ranking.includes('Watch Timechain TV'));
    assert.ok(ranking.includes('Share your referral link'));
    assert.ok(ranking.includes("go: 'openClaimChat()'"));
    assert.ok(ranking.includes("go: 'openClaimTv()'"));
    assert.ok(ranking.includes("go: 'shareClaimReferral()'"));
    assert.ok(ranking.includes("goLabel: 'Share'"));
    assert.ok(ranking.includes('if (!claimExempt)'));
    const note = '🔒 VPNs must be off to claim sats.';
    const noteAt = ranking.indexOf(note);
    assert.ok(noteAt > ranking.indexOf('checks.forEach(function(c)'));
    assert.ok(noteAt < ranking.indexOf('How It Works'));
    assert.ok(ranking.includes('color:var(--text-muted)'));
    assert.ok(ranking.includes('navigator.share'));
    assert.ok(ranking.includes('copyClaimReferralLink'));
    assert.ok(ranking.includes("err.name === 'AbortError'"));
    const tickets = fs.readFileSync(path.join(root, 'tickets.js'), 'utf8');
    assert.ok(tickets.includes('function logReferralVisit(code)'));
    assert.ok(tickets.includes("httpsCallable('logReferralVisit')"));
    assert.ok(tickets.includes('window.logReferralVisit = logReferralVisit'));
    const capture = tickets.slice(tickets.indexOf('function captureReferralCode'), tickets.indexOf('function awardDailyTicket'));
    assert.ok(capture.includes('logReferralVisit(ref)'));
});

if (failed) {
    console.log(failed + ' failed, ' + passed + ' passed');
    process.exit(1);
}
console.log(passed + ' passed');
