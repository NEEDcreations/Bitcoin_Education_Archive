#!/usr/bin/env node
'use strict';

// Admin spawn is idempotent. Clients cannot write boss HP, participants,
// winners, daily caps, or damage events.

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
    const cfgPath = path.join('/tmp', 'firebase-raid-' + port + '.json');
    fs.writeFileSync(cfgPath, JSON.stringify(cfg));
    const child = spawnSync('npx', [
        '--yes', 'firebase-tools',
        'emulators:exec',
        '--config', cfgPath,
        '--only', 'firestore',
        '--project', 'demo-raid',
        'node tests/test-raid-boss-emulator.js',
    ], {
        cwd: root,
        stdio: 'inherit',
        env: Object.assign({}, process.env, { CI: 'true' }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

const { initializeTestEnvironment, assertFails, assertSucceeds } = require('./rules/node_modules/@firebase/rules-unit-testing');
const { doc, setDoc, getDoc } = require('./rules/node_modules/firebase/firestore');
const admin = require('../functions/node_modules/firebase-admin');
const engine = require('../functions/src/raidBossEngine');

if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-raid' });
const db = admin.firestore();

(async function main() {
    const emu = process.env.FIRESTORE_EMULATOR_HOST;
    const parts = emu.split(':');
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const env = await initializeTestEnvironment({
        projectId: 'demo-raid',
        firestore: { rules: rules, host: parts[0], port: Number(parts[1] || 8080) },
    });
    await env.clearFirestore();

    const when = new Date('2026-11-01T18:00:00.000Z');
    const first = await engine.runScheduledSpawn(db, admin, when);
    const second = await engine.runScheduledSpawn(db, admin, when);
    assert.strictEqual(first.created, true);
    assert.strictEqual(second.skipped, 'exists');
    const boss = await db.collection('raid_bosses').doc('2026-11').get();
    assert.strictEqual(boss.data().name, 'Chat-Charger');
    assert.strictEqual(boss.data().goalFormula, undefined);
    assert.strictEqual(boss.data().communityTarget, 250);
    const meta = await db.collection('raid_boss_meta').doc('2026-11').get();
    assert.strictEqual(meta.data().goalFormula, 'raid-goal-v1');
    assert.strictEqual(meta.data().goalSource, 'count');
    assert.strictEqual(meta.data().goalCount, 0);
    assert.strictEqual(boss.data().current, 0);

    const user = env.authenticatedContext('ada', { firebase: { sign_in_provider: 'password' } }).firestore();
    await assertSucceeds(getDoc(doc(user, 'raid_bosses', '2026-11')));
    await assertFails(setDoc(doc(user, 'raid_bosses', '2026-11'), { current: 999 }));
    await assertFails(setDoc(doc(user, 'raid_bosses', '2026-11', 'participants', 'ada'), { contributed: 50 }));
    await assertFails(setDoc(doc(user, 'raid_bosses', '2026-11', 'winners', 'ada'), { satsAwarded: 1000 }));
    await assertFails(setDoc(doc(user, 'raid_daily_caps', 'ada_2026-11-15_chatMessages'), { count: 1 }));
    await assertFails(setDoc(doc(user, 'raid_damage_events', '2026-11_chat-1'), { amount: 1 }));
    await assertFails(setDoc(doc(user, 'raid_forum_pending', 'forum-1'), { status: 'pending' }));
    await assertFails(setDoc(doc(user, 'raid_boss_meta', '2026-11'), { goalFormula: 'raid-goal-v1' }));

    const fresh = await db.collection('raid_bosses').doc('2026-11').get();
    assert.strictEqual(fresh.data().current, 0);
    assert.strictEqual(fresh.data().defeated, false);
    await env.cleanup();
    console.log('raid emulator ok');
})().catch(function (err) {
    console.error(err && err.stack || err);
    process.exit(1);
});
