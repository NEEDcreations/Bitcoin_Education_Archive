'use strict';
// 🎉 on earned GGs posts: one per player, counter never negative, rate limit,
// guests and banned users denied, and no rewards.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const gg = require('../functions/src/ggReaction');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        const out = fn();
        if (out && typeof out.then === 'function') {
            return out.then(function () {
                console.log('✅ ' + name);
                passed++;
            }, function (err) {
                console.log('❌ ' + name + ': ' + (err && err.message ? err.message : err));
                failed++;
            });
        }
        console.log('✅ ' + name);
        passed++;
    } catch (err) {
        console.log('❌ ' + name + ': ' + (err && err.message ? err.message : err));
        failed++;
    }
    return null;
}

function clone(data) {
    if (data == null) return data;
    return JSON.parse(JSON.stringify(data));
}

function memoryDb(seed) {
    const docs = Object.assign({}, seed || {});
    function ref(docPath) {
        return {
            path: docPath,
            id: docPath.split('/').pop(),
            get: async function () {
                const data = docs[docPath];
                return {
                    exists: data != null,
                    id: docPath.split('/').pop(),
                    data: function () { return data ? clone(data) : undefined; },
                };
            },
            collection: function (name) { return collectionAt(docPath + '/' + name); },
        };
    }
    function collectionAt(prefix) {
        return { doc: function (id) { return ref(prefix + '/' + id); } };
    }
    return {
        docs: docs,
        collection: function (name) { return collectionAt(name); },
        runTransaction: async function (fn) {
            const staged = [];
            const tx = {
                get: function (target) { return target.get(); },
                set: function (target, data) { staged.push({ op: 'set', path: target.path, data: clone(data) }); },
                update: function (target, data) { staged.push({ op: 'merge', path: target.path, data: clone(data) }); },
                delete: function (target) { staged.push({ op: 'delete', path: target.path }); },
            };
            const result = await fn(tx);
            staged.forEach(function (row) {
                if (row.op === 'delete') delete docs[row.path];
                else if (row.op === 'merge') docs[row.path] = Object.assign({}, docs[row.path], row.data);
                else docs[row.path] = row.data;
            });
            return result;
        },
    };
}

function player(uid) {
    return { auth: { uid: uid, token: { firebase: { sign_in_provider: 'password' } } } };
}

function earnedPost(extra) {
    return Object.assign({
        uid: 'nacho-bot',
        name: '🦌 Nacho',
        text: '🏅 @Pat just earned the 🏕️ Pathfinder badge! 🎉',
        isNachoAuto: true,
        postedByUid: 'badge-gg',
        ggKind: 'badge',
        badgeIds: ['explorer_50'],
        mentionUid: 'pat',
        partyCount: 0,
    }, extra || {});
}

function call(db, uid, postId, now) {
    return gg.toggleGgReaction(db, { postId: postId }, player(uid), now);
}

const queue = [];

queue.push(test('a signed-in player toggles one 🎉 and a second tap removes it', async function () {
    const db = memoryDb({
        'announcements/badge1': earnedPost(),
        'users/ada': { username: 'Ada', points: 40 },
    });
    const on = await call(db, 'ada', 'badge1', 1000);
    assert.deepStrictEqual(on, { reacted: true, count: 1 });
    assert.strictEqual(db.docs['announcements/badge1'].partyCount, 1);
    assert.strictEqual(db.docs['announcements/badge1/reactions/ada'].uid, 'ada');
    assert.strictEqual(db.docs['users/ada'].points, 40);
    const off = await call(db, 'ada', 'badge1', 2000);
    assert.deepStrictEqual(off, { reacted: false, count: 0 });
    assert.strictEqual(db.docs['announcements/badge1'].partyCount, 0);
    assert.strictEqual(db.docs['announcements/badge1/reactions/ada'], undefined);
    assert.deepStrictEqual(Object.keys(on).sort(), ['count', 'reacted']);
}));

queue.push(test('each player counts at most once', async function () {
    const db = memoryDb({
        'announcements/badge1': earnedPost({ partyCount: 0 }),
        'users/ada': { username: 'Ada' },
        'users/ben': { username: 'Ben' },
    });
    await call(db, 'ada', 'badge1', 1000);
    await call(db, 'ben', 'badge1', 1100);
    assert.strictEqual(db.docs['announcements/badge1'].partyCount, 2);
    assert.ok(db.docs['announcements/badge1/reactions/ada']);
    assert.ok(db.docs['announcements/badge1/reactions/ben']);
    await call(db, 'ada', 'badge1', 1200);
    assert.strictEqual(db.docs['announcements/badge1'].partyCount, 1);
    assert.strictEqual(db.docs['announcements/badge1/reactions/ada'], undefined);
    assert.ok(db.docs['announcements/badge1/reactions/ben']);
}));

queue.push(test('the counter never goes below zero', async function () {
    const db = memoryDb({
        'announcements/badge1': earnedPost({ partyCount: 0 }),
        'announcements/badge1/reactions/ada': { uid: 'ada', at: 1 },
        'users/ada': { username: 'Ada' },
    });
    const off = await call(db, 'ada', 'badge1', 3000);
    assert.deepStrictEqual(off, { reacted: false, count: 0 });
    assert.strictEqual(db.docs['announcements/badge1'].partyCount, 0);
    assert.strictEqual(db.docs['announcements/badge1/reactions/ada'], undefined);
    const corrupt = memoryDb({
        'announcements/low': earnedPost({ partyCount: -4 }),
        'announcements/low/reactions/ada': { uid: 'ada' },
        'users/ada': {},
    });
    const fixed = await call(corrupt, 'ada', 'low', 4000);
    assert.strictEqual(fixed.count, 0);
    assert.ok(fixed.count >= 0);
    assert.strictEqual(corrupt.docs['announcements/low'].partyCount, 0);
}));

queue.push(test('thirty toggles a minute are the limit', async function () {
    const db = memoryDb({
        'announcements/badge1': earnedPost(),
        'users/ada': { username: 'Ada' },
    });
    const start = 1_700_000_000_000;
    for (let i = 0; i < gg.MAX_TOGGLES; i++) {
        await call(db, 'ada', 'badge1', start + i);
    }
    assert.strictEqual(db.docs[gg.rateDocId('ada').replace(/^/, 'rate_limits/')].count, 30);
    const before = db.docs['announcements/badge1'].partyCount;
    const marker = db.docs['announcements/badge1/reactions/ada'];
    let caught = null;
    try {
        await call(db, 'ada', 'badge1', start + 30);
    } catch (err) {
        caught = err;
    }
    assert.ok(caught);
    assert.strictEqual(caught.code, 'resource-exhausted');
    assert.strictEqual(db.docs['announcements/badge1'].partyCount, before);
    assert.strictEqual(db.docs['announcements/badge1/reactions/ada'], marker);
    const later = await call(db, 'ada', 'badge1', start + gg.WINDOW_MS + 5);
    assert.strictEqual(typeof later.reacted, 'boolean');
    assert.strictEqual(db.docs['rate_limits/' + gg.rateDocId('ada')].count, 1);
}));

queue.push(test('guests, banned players, and ordinary posts are denied', async function () {
    const db = memoryDb({
        'announcements/badge1': earnedPost({ partyCount: 2 }),
        'announcements/hello': { uid: 'nacho-bot', isNachoAuto: true, text: 'Good morning', partyCount: 0 },
        'users/ada': { username: 'Ada', points: 10 },
        'users/ban': { username: 'Ban', banned: true, points: 9 },
        'users/led': { username: 'Led', points: 8 },
        'faucet_ledger/led': { banned: true },
        'users/why': { username: 'Why', ban_reason: 'spam', points: 7 },
    });
    async function deny(label, ctx, postId, code) {
        let caught = null;
        try {
            await gg.toggleGgReaction(db, { postId: postId }, ctx, 5000);
        } catch (err) {
            caught = err;
        }
        assert.ok(caught, label);
        assert.strictEqual(caught.code, code, label + ' ' + (caught && caught.code));
    }
    await deny('guest', null, 'badge1', 'unauthenticated');
    await deny('anonymous', { auth: { uid: 'anon', token: { firebase: { sign_in_provider: 'anonymous' } } } }, 'badge1', 'permission-denied');
    await deny('banned', player('ban'), 'badge1', 'permission-denied');
    await deny('ledger', player('led'), 'badge1', 'permission-denied');
    await deny('reason', player('why'), 'badge1', 'permission-denied');
    await deny('plain', player('ada'), 'hello', 'failed-precondition');
    await deny('missing', player('ada'), 'missing', 'not-found');
    assert.strictEqual(db.docs['announcements/badge1'].partyCount, 2);
    assert.strictEqual(db.docs['announcements/badge1/reactions/ban'], undefined);
    assert.strictEqual(db.docs['announcements/badge1/reactions/ada'], undefined);
    assert.strictEqual(db.docs['users/ada'].points, 10);
    assert.strictEqual(db.docs['announcements/hello'].partyCount, 0);
}));

queue.push(test('level-ups, achievements, and earned lines qualify, and nothing else pays', function () {
    assert.strictEqual(gg.isEarnedGgPost(earnedPost()), true);
    assert.strictEqual(gg.isEarnedGgPost({
        uid: 'player',
        isNachoAuto: true,
        text: '📊 @Pat just leveled up to Maxi!',
    }), true);
    assert.strictEqual(gg.isEarnedGgPost({
        uid: 'player',
        isNachoAuto: true,
        text: '🏆 @Pat just aced a Quiz Quest with a PERFECT 5/5!',
    }), true);
    assert.strictEqual(gg.isEarnedGgPost({
        uid: 'nacho-bot',
        isNachoAuto: true,
        text: '🦌 @Pat crushed the daily trifecta',
    }), true);
    assert.strictEqual(gg.isEarnedGgPost({
        uid: 'nacho-bot',
        isNachoAuto: true,
        ggKind: 'achievement',
        text: 'nice work',
    }), true);
    assert.strictEqual(gg.isEarnedGgPost({ uid: 'someone', text: 'I earned a badge', isNachoAuto: false }), false);
    assert.strictEqual(gg.isEarnedGgPost({ uid: 'nacho-bot', text: 'I earned a badge', deleted: true, isNachoAuto: true }), false);
    const chat = fs.readFileSync(path.join(root, 'global-chat.js'), 'utf8');
    const start = chat.indexOf('function ggIsEarnedPost');
    const end = chat.indexOf('function ggSignedInUser');
    const client = new Function(chat.slice(start, end) + '\nreturn ggIsEarnedPost;')();
    const samples = [
        earnedPost(),
        { uid: 'player', isNachoAuto: true, text: '📊 @Pat just leveled up to Maxi!' },
        { uid: 'player', isNachoAuto: true, text: '🏆 @Pat just aced a Quiz Quest' },
        { uid: 'nacho-bot', isNachoAuto: true, text: 'crushed the daily trifecta' },
        { uid: 'nacho-bot', ggKind: 'earned', text: 'hello' },
        { uid: 'someone', text: 'I earned a badge' },
        { uid: 'nacho-bot', text: 'Good morning', isNachoAuto: true },
        null,
    ];
    samples.forEach(function (sample, i) {
        assert.strictEqual(client(sample), gg.isEarnedGgPost(sample), 'sample ' + i);
    });
    const src = fs.readFileSync(path.join(root, 'functions', 'src', 'ggReaction.js'), 'utf8');
    ['awardPoints', 'grantXp', 'claimSats', 'orangeTickets', 'awardBadge'].forEach(function (word) {
        assert.strictEqual(src.includes(word), false, word);
    });
    const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    assert.ok(src.includes('enforceAppCheck: true'));
    assert.ok(index.includes('exports.toggleGgReaction = ggFns.toggleGgReaction'));
    assert.strictEqual((index.match(/enforceAppCheck:\s*true/g) || []).length, 8);
    const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
    assert.ok(ranking.includes('toggleGgReaction: 1'));
    const party = chat.slice(chat.indexOf('function ggIsEarnedPost'), chat.indexOf('function _buildAnnReactBar'));
    assert.ok(party.includes('🎉'));
    assert.strictEqual(party.includes('➕'), false);
    assert.strictEqual(party.includes('_showAnnReactPicker'), false);
    assert.ok(party.includes("httpsCallable('toggleGgReaction')"));
    assert.strictEqual(party.includes('.update('), false);
    assert.strictEqual(party.includes('awardPoints'), false);
}));

Promise.all(queue).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
