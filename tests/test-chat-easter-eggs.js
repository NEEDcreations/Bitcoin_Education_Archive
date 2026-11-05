#!/usr/bin/env node
'use strict';
// Chat easter eggs: code matching, one-time tiny XP, rate limits, no sats.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const eggs = require('../functions/src/chatEasterEggs');

let passed = 0, failed = 0;
const queue = [];
function test(name, fn) { queue.push([name, fn]); }

function fakeAdmin() {
    return { firestore: { FieldValue: { serverTimestamp: () => 'TS', increment: (n) => ({ inc: n }) } } };
}
function fakeDb(store) {
    function ref(p) { return { _path: p, collection: (c) => ({ doc: (id) => ref(p + '/' + c + '/' + id) }) }; }
    return {
        store: store,
        collection: (c) => ({ doc: (id) => ref(c + '/' + id) }),
        runTransaction: async (fn) => {
            const writes = [];
            const tx = {
                get: async (r) => ({ exists: Object.prototype.hasOwnProperty.call(store, r._path), data: () => store[r._path] }),
                set: (r, v) => writes.push([r._path, v]),
                update: (r, v) => writes.push([r._path, Object.assign({}, store[r._path] || {}, v)]),
            };
            const out = await fn(tx);
            for (const [p, v] of writes) store[p] = v;
            return out;
        },
    };
}
function deps(now, awarded) {
    return {
        now: now,
        offsetDateKey: () => '2026-11-04',
        applyDailyXp: async (uid, amt, tx, o) => ({ awarded: awarded == null ? amt : awarded, dailyXp: 10 + amt, dailyRef: o.userRef.collection('daily_points').doc(o.day) }),
    };
}
const msg = (text, uid) => ({ uid: uid || 'u1', name: 'Phil', text: text });

test('has 10-15 codes, each unique, all tiny XP, no sats anywhere', () => {
    assert.ok(eggs.EGGS.length >= 10 && eggs.EGGS.length <= 15, String(eggs.EGGS.length));
    assert.ok(eggs.EGG_XP > 0 && eggs.EGG_XP <= 25);
    const seen = new Set();
    for (const e of eggs.EGGS) for (const c of e.codes) {
        const k = eggs.normalize(c);
        assert.ok(!seen.has(k), 'dup ' + k); seen.add(k);
    }
    const src = fs.readFileSync(path.join(__dirname, '../functions/src/chatEasterEggs.js'), 'utf8');
    assert.ok(!/sats(Balance|Earned|Claim)|claimableSats|pendingSats/i.test(src));
});
test('matches whole message only, case/space/punctuation tolerant', () => {
    assert.strictEqual(eggs.findEgg('HODL').id, 'hodl');
    assert.strictEqual(eggs.findEgg('  Orange   Pill!! ').id, 'orangepill');
    assert.strictEqual(eggs.findEgg('block 0').id, 'genesis');
    assert.strictEqual(eggs.findEgg('10000 BTC').id, 'pizza');
    assert.strictEqual(eggs.findEgg('i will hodl forever'), null);
    assert.strictEqual(eggs.findEgg('few'), null);
    assert.strictEqual(eggs.findEgg('x'.repeat(200)), null);
    assert.strictEqual(eggs.findEgg(null), null);
});
test('ignores Nacho, system, telegram, auto and GIF messages', () => {
    for (const m of [{ uid: 'nacho-bot', text: 'hodl' }, { uid: 'system', text: 'hodl' }, { uid: 'u', text: 'hodl', source: 'telegram' },
        { uid: 'u', text: 'hodl', isNachoAuto: true }, { uid: 'u', text: 'hodl', isGif: true }, { text: 'hodl' }]) {
        assert.strictEqual(eggs.isEligibleMessage(m), false);
    }
});
test('first find pays tiny XP once, Nacho replies', async () => {
    const db = fakeDb({ 'users/u1': { points: 100 } });
    const r = await eggs.handle(db, fakeAdmin(), 'm1', msg('hodl'), deps(1e6));
    assert.deepStrictEqual([r.code, r.xp], ['ok', eggs.EGG_XP]);
    assert.ok(db.store['easter_egg_claims/u1_hodl']);
    assert.deepStrictEqual(db.store['users/u1'].points, { inc: eggs.EGG_XP });
    const reply = db.store['global_chat/egg_m1'];
    assert.strictEqual(reply.uid, 'nacho-bot');
    assert.ok(/\+21 XP/.test(reply.text) && reply.replyTo === 'm1');
    const r2 = await eggs.handle(db, fakeAdmin(), 'm2', msg('HODL'), deps(1e6 + eggs.USER_COOLDOWN_MS + 1));
    assert.deepStrictEqual([r2.code, r2.xp, r2.already], ['ok', 0, true]);
    assert.ok(/already found/.test(db.store['global_chat/egg_m2'].text));
});
test('per-user and global cooldowns, and duplicate trigger is a no-op', async () => {
    const db = fakeDb({ 'users/u1': {}, 'users/u2': {} });
    await eggs.handle(db, fakeAdmin(), 'a', msg('hodl'), deps(1e6));
    assert.strictEqual((await eggs.handle(db, fakeAdmin(), 'a', msg('hodl'), deps(1e6 + 1e6))).code, 'replay');
    assert.strictEqual((await eggs.handle(db, fakeAdmin(), 'b', msg('21m', 'u2'), deps(1e6 + 1000))).code, 'rate');
    assert.strictEqual((await eggs.handle(db, fakeAdmin(), 'c', msg('21m'), deps(1e6 + eggs.GLOBAL_COOLDOWN_MS + 1))).code, 'rate');
    assert.strictEqual((await eggs.handle(db, fakeAdmin(), 'd', msg('21m', 'u2'), deps(1e6 + eggs.GLOBAL_COOLDOWN_MS + 1))).code, 'ok');
});
test('daily cap respected: capped grant pays 0 but still claims', async () => {
    const db = fakeDb({ 'users/u1': {} });
    const r = await eggs.handle(db, fakeAdmin(), 'm', msg('halving'), deps(5e6, 0));
    assert.deepStrictEqual([r.code, r.xp], ['ok', 0]);
    assert.strictEqual(db.store['users/u1'].points, undefined);
});
test('no user doc: reply, no claim, no XP', async () => {
    const db = fakeDb({});
    const r = await eggs.handle(db, fakeAdmin(), 'm', msg('pizza day', 'ghost'), deps(1));
    assert.strictEqual(r.xp, 0);
    assert.ok(!db.store['easter_egg_claims/ghost_pizza']);
});
test('server-only collections fall under deny-all rules; trigger is wired', () => {
    const rules = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8');
    assert.ok(!/match \/easter_egg_(claims|rate)/.test(rules));
    const idx = fs.readFileSync(path.join(__dirname, '../functions/index.js'), 'utf8');
    assert.ok(/exports\.onGlobalChatEasterEgg = onDocumentCreated\(\{ document: 'global_chat\/\{msgId\}'/.test(idx));
});

(async () => {
    for (const [n, f] of queue) {
        try { await f(); console.log('✅ ' + n); passed++; } catch (e) { console.log('❌ ' + n + ': ' + e.message); failed++; }
    }
    console.log(passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
