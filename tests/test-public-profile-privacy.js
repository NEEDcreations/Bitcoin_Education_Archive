#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mirror = require('../functions/src/publicProfileMirror');
const boards = require('../functions/src/boardSnapshots');

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

test('the public mirror copies display fields and not lightning or presence', () => {
    const index = read('functions/index.js');
    const fields = index.slice(index.indexOf('const PUBLIC_PROFILE_FIELDS'), index.indexOf('const lbDirtyStampAt'));
    ['username', 'profilePic', 'points', 'level', 'badges', 'visibleBadges', 'displayBadge', 'country', 'ghostMode'].forEach(function (name) {
        assert.ok(fields.includes("'" + name + "'"), name);
    });
    ['lightningAddress', 'lightning', 'lastSeen', 'isOnline', 'lnAddress'].forEach(function (name) {
        assert.strictEqual(fields.includes("'" + name + "'"), false, name);
    });
    assert.ok(index.includes("collection('profile_presence')"));
    assert.ok(index.includes('publicProfileMirror.presencePatch'));
});

test('strip planner removes lightning and presence and keeps country', () => {
    const plan = mirror.planStrip('user1', {
        username: 'Ada',
        country: 'Japan',
        lightningAddress: 'ada@walletofsatoshi.com',
        lightning: 'ada@walletofsatoshi.com',
        lastSeen: 123,
        isOnline: true,
        points: 10
    });
    assert.strictEqual(plan.remove, true);
    assert.strictEqual(plan.removed.lightningAddress, 'ada@walletofsatoshi.com');
    assert.strictEqual(plan.removed.lastSeen, 123);
    assert.strictEqual(plan.removed.isOnline, true);
    assert.strictEqual(plan.removed.country, undefined);
    assert.strictEqual(plan.removed.username, undefined);
    assert.strictEqual(plan.presence.lastSeen, 123);
    assert.strictEqual(plan.presence.isOnline, true);
    assert.deepStrictEqual(mirror.planStrip('empty', { username: 'Ada', country: 'Japan' }).remove, false);
    const offline = mirror.presencePatch({ isOnline: 'yes', lastSeen: null });
    assert.strictEqual(offline.isOnline, false);
    assert.strictEqual(offline.lastSeen, null);
});

test('backup is built before any apply, and dry run is the default', () => {
    const args = mirror.parseArgs(['--backup', '/tmp/secret.json']);
    assert.strictEqual(args.apply, false);
    assert.strictEqual(args.write, false);
    assert.strictEqual(args.backup, '/tmp/secret.json');
    assert.strictEqual(mirror.parseArgs(['--apply']).apply, true);
    assert.strictEqual(mirror.parseArgs(['--write']).write, true);
    const backup = mirror.buildBackup([
        mirror.planStrip('user1', { lightningAddress: 'a@getalby.com', lastSeen: 5 }),
        mirror.planStrip('user2', { username: 'Bob' })
    ], '2026-11-09T00:00:00.000Z');
    assert.deepStrictEqual(Object.keys(backup.docs), ['user1']);
    assert.strictEqual(backup.docs.user1.lightningAddress, 'a@getalby.com');
    assert.strictEqual(backup.collection, 'public_profiles');
    const script = read('scripts/strip-public-profile-secrets.js');
    assert.ok(script.indexOf('writeFileSync') < script.indexOf('await applyPlans'));
    assert.ok(script.includes("Pass --apply"));
    assert.ok(script.includes('Refusing --write'));
    assert.ok(script.indexOf('console.log(backup)') === -1);
    assert.ok(script.includes('JSON.stringify(backup,'));
});

test('rules keep get, cap list at 50, and do not list presence', () => {
    const rules = read('firestore.rules');
    const profiles = rules.slice(rules.indexOf('match /public_profiles/{uid}'), rules.indexOf('match /profile_presence/{uid}'));
    assert.ok(profiles.includes('allow get: if request.auth != null;'));
    assert.ok(profiles.includes('allow list: if request.auth != null && request.query.limit <= 50;'));
    assert.ok(!profiles.includes('allow read:'));
    const presence = rules.slice(rules.indexOf('match /profile_presence/{uid}'), rules.indexOf('match /visits/{visitorId}'));
    assert.ok(presence.includes('allow get: if request.auth != null;'));
    assert.ok(presence.includes('allow list: if false;'));
    assert.ok(presence.includes('allow write: if false;'));
});

test('tips resolve the address from users and do not return it', () => {
    const service = read('functions/src/tipService.js');
    const fn = service.slice(service.indexOf('async function recipientLightning'), service.indexOf('async function linkedTip'));
    assert.ok(fn.includes("collection('users')"));
    assert.ok(!fn.includes('public_profiles'));
    const request = service.slice(service.indexOf('async function requestTipInvoice'));
    assert.ok(request.includes('recipientLightning(recipientUid)'));
    assert.ok(!request.includes('lightningAddress:'));
    const client = read('lightning-tips.js.src');
    assert.ok(!client.includes("collection('public_profiles')"));
    assert.ok(client.includes('requestTipInvoice'));
    const card = read('messaging.js');
    const tip = card.slice(card.indexOf('window._profileTipData'), card.indexOf('window._profileTipData') + 240);
    assert.ok(!tip.includes('lightningAddress'));
});

test('leaderboard snapshots do not store lightning or lastSeen', () => {
    const doc = boards.buildXpDoc([
        { id: 'ada', data: { username: 'Ada', points: 20, lightningAddress: 'ada@getalby.com', lastSeen: 99, country: 'Japan' } }
    ], boards.BOARDS.xpAll, 10);
    assert.strictEqual(doc.rows[0].lightningAddress, undefined);
    assert.strictEqual(doc.rows[0].lastSeen, undefined);
    assert.strictEqual(JSON.stringify(doc).indexOf('getalby'), -1);
    const pvp = boards.buildPvpDoc([
        { id: 'ada', data: { username: 'Ada', pvpWins: 2, pvpLosses: 1, lightningAddress: 'ada@getalby.com' } }
    ], [], 10);
    assert.strictEqual(pvp.rows[0].lightningAddress, undefined);
});

test('account deletion removes the presence doc', () => {
    const src = read('functions/src/deleteAccount.js');
    const direct = src.slice(src.indexOf('const direct = ['), src.indexOf('for (let i = 0; i < direct.length'));
    assert.ok(direct.includes("['profile_presence', uid, []]"));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
