#!/usr/bin/env node
'use strict';
// PvP QA M5 and C8 (Nov 18, 2026, staging pass on ff310446a).
// M5: a player re-created a waiting lobby while their match was still live,
// and the same opponent's second pvpCreateMatch opened another match.
// pvpCreateMatch now keeps one lock per pair and refuses while the pair's
// latest match is live.
// C8: roundExplain stayed on the match after the next question started.
// Every advance path clears it, the rules require it, and the client only
// shows it on the result screen.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const pvpFlow = require(path.join(root, 'functions', 'src', 'pvpFlow.js'));
const pvpPairLock = require(path.join(root, 'functions', 'src', 'pvpPairLock.js'));
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

let passed = 0;
let failed = 0;
const queue = [];
function test(name, fn) { queue.push([name, fn]); }

// Minimal Firestore stub: reads before writes, staged writes applied on commit.
function memoryDb(seed) {
    const docs = Object.assign({}, seed || {});
    function ref(p) {
        return {
            path: p,
            get: async function () {
                const d = docs[p];
                return { exists: d != null, data: function () { return d ? Object.assign({}, d) : undefined; } };
            },
        };
    }
    return {
        docs: docs,
        collection: function (name) { return { doc: function (id) { return ref(name + '/' + id); } }; },
        runTransaction: async function (fn) {
            const staged = [];
            let wrote = false;
            const tx = {
                get: function (r) {
                    if (wrote) throw new Error('read after write in transaction');
                    return r.get();
                },
                set: function (r, data) { wrote = true; staged.push([r.path, data]); },
            };
            const out = await fn(tx);
            staged.forEach(function (w) { docs[w[0]] = Object.assign({}, w[1]); });
            return out;
        },
    };
}

// The create path from pvpCreateMatch, reduced to the M5 decision: read the
// lobby and pair lock, refuse if either says no, else write match + lock and
// mark the lobby matched.
let nextId = 1;
async function create(db, lobbyUid, callerUid, nowMs) {
    return db.runTransaction(async function (tx) {
        const lobby = await tx.get(db.collection('pvp_lobby').doc(lobbyUid));
        if (!lobby.exists) return { code: 'not-found' };
        if (lobby.data().status !== 'waiting') return { code: 'already-exists' };
        const lock = await pvpPairLock.readPairLock(tx, db, lobbyUid, callerUid, nowMs);
        if (lock.liveMatchId) return { code: 'already-exists', live: lock.liveMatchId };
        const matchId = 'm' + (nextId++);
        tx.set(db.collection('pvp_matches').doc(matchId), {
            status: 'countdown', createdAt: { _seconds: Math.floor(nowMs / 1000) },
            player1: { uid: lobbyUid }, player2: { uid: callerUid },
        });
        pvpPairLock.writePairLock(tx, lock.ref, matchId, nowMs);
        tx.set(db.collection('pvp_lobby').doc(lobbyUid), Object.assign({}, lobby.data(), { status: 'matched', matchId: matchId }));
        return { code: 'ok', matchId: matchId };
    });
}
function waitingLobby(db, uid) { db.docs['pvp_lobby/' + uid] = { uid: uid, status: 'waiting' }; }

const T0 = Date.parse('2026-11-18T22:00:00Z');

test('M5: second create on an already-matched lobby is refused', async function () {
    const db = memoryDb();
    waitingLobby(db, 'alice');
    const first = await create(db, 'alice', 'bob', T0);
    assert.strictEqual(first.code, 'ok');
    const again = await create(db, 'alice', 'bob', T0 + 1000);
    assert.strictEqual(again.code, 'already-exists');
    assert.ok(!again.matchId);
});

test('M5 (QA path): lobby re-created as waiting mid-match, same opponent create is refused, no second match', async function () {
    const db = memoryDb();
    waitingLobby(db, 'alice');
    const first = await create(db, 'alice', 'bob', T0);
    assert.strictEqual(first.code, 'ok');
    waitingLobby(db, 'alice'); // delete + create from the client, allowed by rules
    const again = await create(db, 'alice', 'bob', T0 + 5000);
    assert.strictEqual(again.code, 'already-exists');
    assert.strictEqual(again.live, first.matchId);
    const matches = Object.keys(db.docs).filter(function (k) { return k.indexOf('pvp_matches/') === 0; });
    assert.strictEqual(matches.length, 1, 'still one match');
    assert.strictEqual(db.docs['pvp_lobby/alice'].status, 'waiting', 'refusal writes nothing');
});

test('M5: swapped roles (bob waiting, alice creates) is the same pair and is refused', async function () {
    const db = memoryDb();
    waitingLobby(db, 'alice');
    await create(db, 'alice', 'bob', T0);
    waitingLobby(db, 'bob');
    const swapped = await create(db, 'bob', 'alice', T0 + 2000);
    assert.strictEqual(swapped.code, 'already-exists');
});

for (const st of ['active', 'question_result']) {
    test('M5: pair stays locked while the match is ' + st, async function () {
        const db = memoryDb();
        waitingLobby(db, 'alice');
        const first = await create(db, 'alice', 'bob', T0);
        db.docs['pvp_matches/' + first.matchId].status = st;
        waitingLobby(db, 'alice');
        assert.strictEqual((await create(db, 'alice', 'bob', T0 + 60000)).code, 'already-exists');
    });
}

for (const st of ['finished', 'forfeit']) {
    test('M5: a rematch after the match is ' + st + ' is allowed and moves the lock', async function () {
        const db = memoryDb();
        waitingLobby(db, 'alice');
        const first = await create(db, 'alice', 'bob', T0);
        db.docs['pvp_matches/' + first.matchId].status = st;
        waitingLobby(db, 'alice');
        const re = await create(db, 'alice', 'bob', T0 + 60000);
        assert.strictEqual(re.code, 'ok');
        assert.strictEqual(db.docs['pvp_pair_locks/' + pvpFlow.pvpPairLockId('alice', 'bob')].matchId, re.matchId);
    });
}

test('M5: a different opponent is not blocked by the alice/bob lock', async function () {
    const db = memoryDb();
    waitingLobby(db, 'alice');
    await create(db, 'alice', 'bob', T0);
    waitingLobby(db, 'carol');
    assert.strictEqual((await create(db, 'carol', 'bob', T0 + 1000)).code, 'ok');
});

test('M5: a match stuck live past the lock window stops blocking the pair', async function () {
    const db = memoryDb();
    waitingLobby(db, 'alice');
    await create(db, 'alice', 'bob', T0);
    waitingLobby(db, 'alice');
    assert.strictEqual((await create(db, 'alice', 'bob', T0 + pvpFlow.PVP_PAIR_LOCK_MS - 1)).code, 'already-exists');
    assert.strictEqual((await create(db, 'alice', 'bob', T0 + pvpFlow.PVP_PAIR_LOCK_MS + 1)).code, 'ok');
});

test('M5: a lock pointing at a deleted match does not block', async function () {
    const db = memoryDb();
    db.docs['pvp_pair_locks/' + pvpFlow.pvpPairLockId('alice', 'bob')] = { matchId: 'gone', createdAtMs: T0 };
    waitingLobby(db, 'alice');
    assert.strictEqual((await create(db, 'alice', 'bob', T0 + 1000)).code, 'ok');
});

test('pair lock id: order-independent, distinct per pair, no raw uid', function () {
    const a = pvpFlow.pvpPairLockId('uidA', 'uidB');
    assert.strictEqual(a, pvpFlow.pvpPairLockId('uidB', 'uidA'));
    assert.notStrictEqual(a, pvpFlow.pvpPairLockId('uidA', 'uidC'));
    assert.notStrictEqual(pvpFlow.pvpPairLockId('a', 'bc'), pvpFlow.pvpPairLockId('ab', 'c'));
    assert.ok(/^pair_[0-9a-f]{40}$/.test(a));
    assert.ok(a.indexOf('uidA') === -1 && a.indexOf('uidB') === -1);
});

test('pairMatchStillLive: live statuses only, createdAt fallback', function () {
    assert.strictEqual(pvpFlow.pairMatchStillLive(null, T0), false);
    assert.strictEqual(pvpFlow.pairMatchStillLive({ status: 'finished' }, T0, T0), false);
    assert.strictEqual(pvpFlow.pairMatchStillLive({ status: 'countdown' }, T0, T0), true);
    assert.strictEqual(pvpFlow.pairMatchStillLive({ status: 'active', createdAt: { _seconds: T0 / 1000 } }, T0 + 1000), true);
    assert.strictEqual(pvpFlow.pairMatchStillLive({ status: 'active' }, T0), true, 'unknown age fails closed');
});

test('index.js: pvpCreateMatch reads the pair lock inside the transaction, refuses, and writes the lock', function () {
    const src = read('functions/index.js');
    assert.ok(src.indexOf("const pvpPairLock = require('./src/pvpPairLock');") !== -1);
    const c = src.slice(src.indexOf('exports.pvpCreateMatch ='), src.indexOf('// ── Scholar Exam'));
    const tx = c.indexOf('db.runTransaction');
    const read1 = c.indexOf('pvpPairLock.readPairLock(tx, db, p1Uid, callerUid, createNow)');
    assert.ok(tx > 0 && read1 > tx, 'lock read inside the transaction');
    assert.ok(read1 < c.indexOf('pvpTxCharge('), 'lock read before any write');
    assert.ok(/if \(pairLock\.liveMatchId\) \{\s*throw new functionsV1\.https\.HttpsError\('already-exists'/.test(c));
    assert.ok(c.indexOf('pvpPairLock.writePairLock(tx, pairLock.ref, matchRef.id, createNow)') > read1);
});

test('rules: pvp_pair_locks is server-only', function () {
    const rules = read('firestore.rules');
    assert.ok(/match \/pvp_pair_locks\/\{docId\} \{\s*allow read, write: if false;\s*\}/.test(rules));
});

test('rules: pvp_pair_daily is server-only', function () {
    const rules = read('firestore.rules');
    assert.ok(/match \/pvp_pair_daily\/\{docId\} \{\s*allow read, write: if false;\s*\}/.test(rules));
});

test('M5 retention: the lock carries expireAt = create time + 7 days as a Firestore Timestamp', async function () {
    const { Timestamp } = require(require.resolve('firebase-admin/firestore', { paths: [path.join(root, 'functions')] }));
    assert.strictEqual(pvpPairLock.PAIR_LOCK_RETENTION_MS, 7 * 24 * 60 * 60 * 1000);
    const db = memoryDb();
    waitingLobby(db, 'alice');
    const r = await create(db, 'alice', 'bob', T0);
    assert.strictEqual(r.code, 'ok');
    const lock = db.docs['pvp_pair_locks/' + pvpFlow.pvpPairLockId('alice', 'bob')];
    assert.deepStrictEqual(Object.keys(lock).sort(), ['createdAtMs', 'expireAt', 'matchId']);
    assert.strictEqual(lock.createdAtMs, T0);
    assert.ok(lock.expireAt instanceof Timestamp, 'expireAt is a Firestore Timestamp (TTL cannot use a number)');
    assert.strictEqual(lock.expireAt.toMillis(), T0 + 7 * 24 * 60 * 60 * 1000);
    // A re-lock after the match ends moves expireAt forward with the new match.
    db.docs['pvp_matches/' + r.matchId].status = 'finished';
    waitingLobby(db, 'bob');
    assert.strictEqual((await create(db, 'bob', 'alice', T0 + 60000)).code, 'ok');
    assert.strictEqual(db.docs['pvp_pair_locks/' + pvpFlow.pvpPairLockId('alice', 'bob')].expireAt.toMillis(), T0 + 60000 + 7 * 24 * 60 * 60 * 1000);
});

// ---- C8 ----
test('C8 / Red Team F1: rules do NOT require roundExplain on an advance (old live clients omit it), and still refuse a non-empty value', function () {
    const rules = read('firestore.rules');
    assert.strictEqual(rules.indexOf("request.resource.data.get('roundExplain', '') == ''"), -1, 'C8 advance clause removed (F1)');
    assert.ok(/&& \(!request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasAny\(\['roundExplain'\]\)\s*\|\| request\.resource\.data\.roundExplain == ''\)/.test(rules),
        'client may only write roundExplain as empty');
});

test('C8: housekeeping advances (next question and reroll) clear roundExplain', function () {
    const src = read('functions/index.js');
    const h = src.slice(src.indexOf('async function pvpHousekeepMatches'), src.indexOf('// ===== PVP LOBBY CLEANUP'));
    const results = h.slice(h.indexOf("where('status', '==', 'question_result')"));
    const updates = results.match(/status: 'active',[\s\S]*?\}\);/g) || [];
    assert.strictEqual(updates.length, 2);
    updates.forEach(function (u) { assert.ok(u.indexOf("roundExplain: ''") !== -1, u); });
});

// DOM check: run the client's two helpers against a fake document.
function clientHelpers() {
    const src = read('pvp.js.src');
    const a = src.indexOf('    function roundExplainText(matchData)');
    const b = src.indexOf('    // =============================================\n    // RENDER QUESTION\n');
    assert.ok(a > 0 && b > a);
    const removed = [];
    const nodes = {};
    const document = {
        getElementById: function (id) { return nodes[id] || null; },
    };
    const ctx = { document: document };
    vm.runInNewContext(src.slice(a, b) + '\nthis.roundExplainText = roundExplainText; this.clearRoundExplain = clearRoundExplain;', ctx);
    return {
        ctx: ctx,
        nodes: nodes,
        removed: removed,
        addBox: function () {
            const parent = { removeChild: function (n) { removed.push(n); delete nodes.pvpRoundExplain; } };
            nodes.pvpRoundExplain = { id: 'pvpRoundExplain', parentNode: parent };
        },
    };
}

test('C8 (client): explanation text only on the result screen', function () {
    const h = clientHelpers();
    assert.strictEqual(h.ctx.roundExplainText({ status: 'question_result', roundExplain: '  why  ' }), 'why');
    assert.strictEqual(h.ctx.roundExplainText({ status: 'active', roundExplain: 'stale' }), '');
    assert.strictEqual(h.ctx.roundExplainText({ status: 'finished', roundExplain: 'stale' }), '');
    assert.strictEqual(h.ctx.roundExplainText({ status: 'question_result' }), '');
});

test('C8 (client): clearRoundExplain removes the box and is safe when absent', function () {
    const h = clientHelpers();
    h.addBox();
    h.ctx.clearRoundExplain();
    assert.strictEqual(h.removed.length, 1);
    assert.strictEqual(h.nodes.pvpRoundExplain, undefined);
    h.ctx.clearRoundExplain();
    assert.strictEqual(h.removed.length, 1);
});

test('C8 (client): wired into the result box, renderQuestion and the active snapshot', function () {
    const src = read('pvp.js.src');
    assert.ok(src.indexOf('var explain = roundExplainText(matchData);') !== -1);
    assert.ok(src.indexOf('<div id="pvpRoundExplain"') !== -1);
    const rq = src.slice(src.indexOf('    function renderQuestion(matchData) {'), src.indexOf('    function renderQuestion(matchData) {') + 300);
    assert.ok(rq.indexOf('clearRoundExplain();') !== -1);
    assert.ok(/if \(data\.status === 'active' && data\.currentQ !== undefined\) \{\s*clearRoundExplain\(\);/.test(src));
    assert.ok(src.indexOf("roundExplain: ''") !== -1, 'startNextQuestion still clears the field');
    const built = read('pvp.js');
    assert.ok(built.indexOf('pvpRoundExplain') !== -1, 'pvp.js rebuilt from pvp.js.src');
});

(async function () {
    for (const [name, fn] of queue) {
        try { await fn(); console.log('  ok  ' + name); passed++; }
        catch (e) { console.log('  FAIL ' + name + '\n   ' + (e && e.stack ? e.stack : e)); failed++; }
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
