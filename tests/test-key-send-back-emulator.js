#!/usr/bin/env node
'use strict';

// Firestore emulator coverage for sendKeys send-back.
// A returned key uses the same callable as a normal send. Opening it must
// not increment giftsExchanged. A first handoff between two distinct,
// 10-day-old peers still does.

const assert = require('assert');
const fs = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

function freeFirestorePort(start) {
    const script = [
        "const net = require('net');",
        'const start = ' + start + ';',
        'function tryPort(p) {',
        '  if (p > start + 30) { console.log(String(start)); process.exit(0); }',
        '  const server = net.createServer();',
        "  server.once('error', function () { tryPort(p + 1); });",
        "  server.listen(p, '127.0.0.1', function () {",
        "    server.close(function () { console.log(String(p)); process.exit(0); });",
        '  });',
        '}',
        'tryPort(start);',
    ].join('\n');
    const out = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
    const port = parseInt(String(out.stdout || '').trim(), 10);
    return Number.isFinite(port) ? port : start;
}

if (!process.env.FIRESTORE_EMULATOR_HOST) {
    const port = freeFirestorePort(8085);
    const cfg = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
    cfg.emulators = cfg.emulators || {};
    cfg.emulators.firestore = Object.assign({}, cfg.emulators.firestore, { port: port });
    const cfgPath = path.join('/tmp', 'firebase-key-send-' + port + '.json');
    fs.writeFileSync(cfgPath, JSON.stringify(cfg));
    const child = spawnSync('npx', [
        '--yes', 'firebase-tools',
        'emulators:exec',
        '--config', cfgPath,
        '--only', 'firestore',
        '--project', 'demo-key-send',
        'node tests/test-key-send-back-emulator.js',
    ], {
        cwd: root,
        stdio: 'inherit',
        env: Object.assign({}, process.env, { CI: 'true' }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

let firebaseConfig = {};
try { firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG || '{}'); } catch (e) { firebaseConfig = {}; }
if (!firebaseConfig.projectId) firebaseConfig.projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'demo-key-send';
process.env.FIREBASE_CONFIG = JSON.stringify(firebaseConfig);
process.env.GCLOUD_PROJECT = firebaseConfig.projectId;
process.env.GOOGLE_CLOUD_PROJECT = firebaseConfig.projectId;
require('./totp-emulator-auth');

const admin = require('../functions/node_modules/firebase-admin');
const fns = require('../functions/index.js');
const db = admin.firestore();

function ctx(uid) {
    return {
        auth: {
            uid: uid,
            token: {
                firebase: { sign_in_provider: 'password' },
                auth_time: Math.floor(Date.now() / 1000),
            },
        },
    };
}

function codeOf(err) {
    return String((err && err.code) || '').replace(/^functions\//, '');
}

async function rejects(promise) {
    try {
        await promise;
    } catch (err) {
        return err;
    }
    throw new Error('expected the call to fail');
}

const BORN = Date.now() - (10 * 24 * 60 * 60 * 1000);

function person(uid, extra) {
    return Object.assign({
        username: uid,
        email: uid + '@peers.example',
        fingerprint: 'fp-' + uid,
        lightning: uid + '@wallet.example',
        known_ips: ['198.51.100.' + (uid.charCodeAt(uid.length - 1) % 200)],
        created: BORN,
        points: 100,
        peers: [],
    }, extra || {});
}

async function putUser(uid, extra) {
    await db.collection('users').doc(uid).set(person(uid, extra));
}

async function inventoryKey(id, owner) {
    await db.collection('keys').doc(id).set({
        ownerId: owner,
        status: 'inventory',
        label: '7F',
    });
}

async function cipherFor(id, owner) {
    await db.collection('locked_ciphers').doc(id).set({
        ownerId: owner,
        status: 'inventory',
        label: '7F',
    });
}

async function pairGifts(a, b) {
    const pairId = [a, b].sort().join('_');
    const snap = await db.collection('peerRelationships').doc(pairId).get();
    if (!snap.exists) return 0;
    return Number((snap.data() || {}).giftsExchanged) || 0;
}

async function main() {
    await putUser('alice', { peers: ['bob'] });
    await putUser('bob', { peers: ['alice'] });
    await inventoryKey('key-fresh', 'alice');

    const forged = await fns.sendKeys.run({
        keyIds: ['key-fresh'],
        recipientUid: 'bob',
        skipPeerLevel: true,
        sender: 'attacker',
        originUid: 'attacker',
    }, ctx('alice'));
    assert.strictEqual(forged.success, true);
    assert.ok(forged.xpAwarded > 0);
    const sent = (await db.collection('keys').doc('key-fresh').get()).data();
    assert.strictEqual(sent.status, 'sent');
    assert.strictEqual(sent.ownerId, 'bob');
    assert.strictEqual(sent.sentBy, 'alice');
    assert.strictEqual(sent.sender, 'alice');
    assert.strictEqual(sent.originUid, 'alice');
    assert.deepStrictEqual(sent.priorSenders, ['alice']);
    assert.strictEqual(sent.skipPeerLevel, false);
    assert.strictEqual(await pairGifts('alice', 'bob'), 0);

    await cipherFor('cipher-bob', 'bob');
    await fns.decryptCipher.run({ cipherId: 'cipher-bob', keyId: 'key-fresh' }, ctx('bob'));
    assert.strictEqual(await pairGifts('alice', 'bob'), 1);
    const bob = (await db.collection('users').doc('bob').get()).data();
    assert.strictEqual(bob.peerData.alice.giftsExchanged, 1);
    assert.strictEqual(bob.peerData.alice.level >= 2, true);

    await putUser('cara', { peers: ['dan'] });
    await putUser('dan', { peers: ['cara'] });
    await inventoryKey('key-back', 'cara');
    await fns.sendKeys.run({ keyIds: ['key-back'], recipientUid: 'dan' }, ctx('cara'));
    const returned = await fns.sendKeys.run({ keyIds: ['key-back'], recipientUid: 'cara' }, ctx('dan'));
    assert.strictEqual(returned.success, true);
    assert.ok(returned.xpAwarded > 0);
    const back = (await db.collection('keys').doc('key-back').get()).data();
    assert.strictEqual(back.ownerId, 'cara');
    assert.strictEqual(back.sentBy, 'dan');
    assert.strictEqual(back.sender, 'dan');
    assert.strictEqual(back.originUid, 'cara');
    assert.strictEqual(back.skipPeerLevel, true);
    assert.ok(back.priorSenders.indexOf('cara') !== -1);
    assert.ok(back.priorSenders.indexOf('dan') !== -1);
    await cipherFor('cipher-cara', 'cara');
    await fns.decryptCipher.run({ cipherId: 'cipher-cara', keyId: 'key-back' }, ctx('cara'));
    assert.strictEqual(await pairGifts('cara', 'dan'), 0, 'send-back must not add a peer gift');

    await db.collection('keys').doc('key-back-2').set({
        ownerId: 'dan',
        status: 'sent',
        label: 'F6',
        sentBy: 'cara',
        sender: 'cara',
        originUid: 'cara',
        priorSenders: ['cara'],
        skipPeerLevel: false,
    });
    const second = await rejects(fns.sendKeys.run({ keyIds: ['key-back-2'], recipientUid: 'cara' }, ctx('dan')));
    assert.strictEqual(codeOf(second), 'failed-precondition');

    await putUser('erin', { peers: ['finn'] });
    await putUser('finn', { peers: ['erin'], fingerprint: 'fp-erin' });
    await inventoryKey('key-farm', 'erin');
    await fns.sendKeys.run({ keyIds: ['key-farm'], recipientUid: 'finn' }, ctx('erin'));
    await cipherFor('cipher-finn', 'finn');
    await fns.decryptCipher.run({ cipherId: 'cipher-finn', keyId: 'key-farm' }, ctx('finn'));
    assert.strictEqual(await pairGifts('erin', 'finn'), 0, 'same fingerprint must not gain a peer level');

    await putUser('gina', { peers: ['hank'], created: Date.now() });
    await putUser('hank', { peers: ['gina'], created: Date.now() });
    await inventoryKey('key-young', 'gina');
    await fns.sendKeys.run({ keyIds: ['key-young'], recipientUid: 'hank' }, ctx('gina'));
    await cipherFor('cipher-hank', 'hank');
    await fns.decryptCipher.run({ cipherId: 'cipher-hank', keyId: 'key-young' }, ctx('hank'));
    assert.strictEqual(await pairGifts('gina', 'hank'), 0, 'accounts under 7 days must not gain a peer level');

    await putUser('ivy', { peers: ['june'], banned: true });
    await putUser('june', { peers: ['ivy'] });
    await inventoryKey('key-ban-sender', 'ivy');
    const bannedSender = await rejects(fns.sendKeys.run({ keyIds: ['key-ban-sender'], recipientUid: 'june' }, ctx('ivy')));
    assert.strictEqual(codeOf(bannedSender), 'permission-denied');

    await putUser('kate', { peers: ['leo'] });
    await putUser('leo', { peers: ['kate'], banned: true });
    await inventoryKey('key-ban-recip', 'kate');
    const bannedRecip = await rejects(fns.sendKeys.run({ keyIds: ['key-ban-recip'], recipientUid: 'leo' }, ctx('kate')));
    assert.strictEqual(codeOf(bannedRecip), 'permission-denied');

    await putUser('maya', { peers: ['nate'], blockedUsers: ['nate'] });
    await putUser('nate', { peers: ['maya'] });
    await inventoryKey('key-block', 'maya');
    const blocked = await rejects(fns.sendKeys.run({ keyIds: ['key-block'], recipientUid: 'nate' }, ctx('maya')));
    assert.strictEqual(codeOf(blocked), 'failed-precondition');

    await putUser('otto', { peers: ['pia'] });
    await putUser('pia', { peers: ['otto'], blockedUsers: ['otto'] });
    await inventoryKey('key-block-2', 'otto');
    const blockedBack = await rejects(fns.sendKeys.run({ keyIds: ['key-block-2'], recipientUid: 'pia' }, ctx('otto')));
    assert.strictEqual(codeOf(blockedBack), 'failed-precondition');

    await putUser('quinn', { peers: ['ruth'] });
    await putUser('ruth', { peers: ['quinn'] });
    await db.collection('keys').doc('key-stolen').set({ ownerId: 'ruth', status: 'inventory', label: '7F' });
    const stolen = await rejects(fns.sendKeys.run({ keyIds: ['key-stolen'], recipientUid: 'ruth' }, ctx('quinn')));
    assert.strictEqual(codeOf(stolen), 'permission-denied');

    await putUser('sam', { peers: ['tia', 'uma'] });
    await putUser('tia', { peers: ['sam', 'uma'] });
    await putUser('uma', { peers: ['sam', 'tia'] });
    await db.collection('keys').doc('key-held').set({
        ownerId: 'tia',
        status: 'sent',
        label: '3A',
        sentBy: 'sam',
        sender: 'sam',
        originUid: 'sam',
        priorSenders: ['sam'],
    });
    const third = await rejects(fns.sendKeys.run({ keyIds: ['key-held'], recipientUid: 'uma' }, ctx('tia')));
    assert.strictEqual(codeOf(third), 'failed-precondition');
    assert.ok(String(third.message || '').indexOf('only go back') !== -1, third.message);

    console.log('key send-back emulator ok');
}

main().catch(function(err) {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
});
