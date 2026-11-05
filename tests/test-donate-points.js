#!/usr/bin/env node
'use strict';

// donatePoints returns donationTicket from outside the transaction.
// A let inside the callback throws ReferenceError at the return, so the
// orange-ticket grant never reached the client.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');

let passed = 0;
let failed = 0;
const tests = [];

function test(name, fn) {
    tests.push({ name: name, fn: fn });
}

function matchBrace(src, openIndex) {
    let depth = 0;
    let i = openIndex;
    let state = 'code';
    while (i < src.length) {
        const c = src[i];
        const n = src[i + 1];
        if (state === 'code') {
            if (c === '/' && n === '/') { state = 'line'; i += 2; continue; }
            if (c === '/' && n === '*') { state = 'block'; i += 2; continue; }
            if (c === "'") { state = 'sq'; i++; continue; }
            if (c === '"') { state = 'dq'; i++; continue; }
            if (c === '`') { state = 'bt'; i++; continue; }
            if (c === '{') depth++;
            else if (c === '}') {
                depth--;
                if (depth === 0) return i;
            }
        } else if (state === 'line') {
            if (c === '\n') state = 'code';
        } else if (state === 'block') {
            if (c === '*' && n === '/') { state = 'code'; i += 2; continue; }
        } else if (state === 'sq' || state === 'dq' || state === 'bt') {
            const quote = state === 'sq' ? "'" : state === 'dq' ? '"' : '`';
            if (c === '\\') { i += 2; continue; }
            if (c === quote) state = 'code';
        }
        i++;
    }
    throw new Error('unbalanced brace at ' + openIndex);
}

function donateBody() {
    const sig = 'exports.donatePoints = functionsV1.https.onCall(async (data, context) =>';
    const start = index.indexOf(sig);
    assert.ok(start !== -1, 'donatePoints missing');
    const open = index.indexOf('{', start + sig.length);
    const close = matchBrace(index, open);
    return index.slice(open + 1, close);
}

function transactionBody(body) {
    const marker = 'await db.runTransaction(async (tx) =>';
    const at = body.indexOf(marker);
    assert.ok(at !== -1, 'transaction missing');
    const open = body.indexOf('{', at + marker.length);
    const close = matchBrace(body, open);
    return { at: at, text: body.slice(open, close + 1) };
}

const body = donateBody();
const tx = transactionBody(body);
const beforeTx = body.slice(0, tx.at);

function setNow(sandbox, now) {
    function Clock() {
        const args = arguments.length ? Array.prototype.slice.call(arguments) : [now];
        return new (Date.bind.apply(Date, [null].concat(args)))();
    }
    Clock.now = function () { return now; };
    Clock.parse = Date.parse;
    Clock.UTC = Date.UTC;
    Clock.prototype = Date.prototype;
    sandbox.Date = Clock;
}

const state = {
    now: Date.parse('2026-11-01T12:00:00.000Z'),
    uid: 'ada',
    user: null,
    ticketExists: false,
    writes: [],
    gets: [],
    grants: []
};

function ref(docPath) {
    return {
        path: docPath,
        id: docPath.split('/').pop(),
        collection: function (name) {
            return {
                doc: function (id) {
                    return ref(docPath + '/' + name + '/' + (id || 'auto'));
                }
            };
        }
    };
}

const db = {
    collection: function (name) {
        return {
            doc: function (id) {
                return ref(name + '/' + (id || 'auto-' + name));
            }
        };
    },
    runTransaction: async function (fn) {
        const tx = {
            get: async function (docRef) {
                state.gets.push(docRef.path);
                if (docRef.path === 'users/' + state.uid) {
                    return { exists: !!state.user, data: function () { return state.user; } };
                }
                if (docRef.path.indexOf('_donate_ticket') !== -1) {
                    return { exists: state.ticketExists, data: function () { return { amount: 1000 }; } };
                }
                return { exists: false, data: function () { return {}; } };
            },
            set: function (docRef, data) {
                state.writes.push({ op: 'set', path: docRef.path, data: data });
            },
            update: function (docRef, data) {
                state.writes.push({ op: 'update', path: docRef.path, data: data });
            }
        };
        await fn(tx);
    }
};

const sandbox = {
    console: console,
    secondFactor: {
        stamp: function (data, context) { return { data: data, context: context }; },
        requireSecondFactor: async function () {}
    },
    functionsV1: { https: {} },
    admin: {
        firestore: function () { return db; }
    },
    rewardNotify: {
        readRankPrev: async function () { return null; },
        plan: function () { return []; },
        apply: function () {}
    },
    grantFamily: async function () { return state.grants; },
    familyFor: function (name) { return name; }
};
sandbox.admin.firestore.FieldValue = {
    serverTimestamp: function () { return { op: 'ts' }; },
    increment: function (n) { return { op: 'inc', n: n }; },
    arrayUnion: function () { return { op: 'union', args: Array.prototype.slice.call(arguments) }; }
};
setNow(sandbox, state.now);
vm.createContext(sandbox);
const donatePoints = vm.runInContext(
    "'use strict';\n" +
    "function HttpsError(code, message) {\n" +
    "  const err = new Error(message);\n" +
    "  err.code = code;\n" +
    "  err.name = 'HttpsError';\n" +
    "  return err;\n" +
    "}\n" +
    "functionsV1.https.HttpsError = HttpsError;\n" +
    "function getOffsetDateKey() {\n" +
    "  const RESET_HOUR_UTC = 5;\n" +
    "  const shifted = new Date(Date.now() - RESET_HOUR_UTC * 3600 * 1000);\n" +
    "  return shifted.toISOString().split('T')[0];\n" +
    "}\n" +
    "async function donatePoints(data, context) {\n" + body + "\n}\n" +
    "donatePoints;",
    sandbox,
    { filename: 'functions/index.js' }
);

function user(extra) {
    return Object.assign({
        points: 20000,
        pointsClaimed: 0,
        pointsDonated: 0,
        pointsExchanged: 0,
        faction: 'cyber_hornets',
        donationBadges: [],
        username: 'Ada'
    }, extra || {});
}

function reset(extra) {
    state.user = user(extra);
    state.ticketExists = false;
    state.writes = [];
    state.gets = [];
    state.grants = [];
    state.uid = 'ada';
}

function auth(provider) {
    return { auth: { uid: 'ada', token: { firebase: { sign_in_provider: provider || 'password' } } } };
}

function plain(result) {
    return {
        success: result.success,
        newBadges: Array.prototype.slice.call(result.newBadges),
        bonusPts: result.bonusPts,
        donationTicket: result.donationTicket
    };
}

function write(pathEnds, op) {
    const row = state.writes.filter(function (item) {
        return item.path.indexOf(pathEnds) !== -1 && (!op || item.op === op);
    })[0];
    assert.ok(row, 'missing write ' + pathEnds + ' ' + (op || ''));
    return row;
}

async function expectCode(fn, code) {
    try {
        await fn();
    } catch (e) {
        assert.strictEqual(e.code, code, e.message);
        return;
    }
    throw new Error('expected ' + code);
}

test('donationTicket is declared before the transaction and returned', async function () {
    assert.ok(/\blet donationTicket = 0\b/.test(beforeTx), beforeTx.slice(-200));
    assert.strictEqual(/\b(?:let|const|var)\s+donationTicket\b/.test(tx.text), false);
    assert.ok(/donationTicket = 0/.test(tx.text));
    assert.ok(/donationTicket = 1/.test(tx.text));
    assert.ok(/return \{ success: true, newBadges, bonusPts, donationTicket \}/.test(body));
    assert.ok(tx.text.indexOf("'_donate_ticket'") !== -1);
    assert.ok(tx.text.indexOf('getOffsetDateKey()') !== -1);
    assert.ok(tx.text.indexOf('amount >= 1000') !== -1);
});

test('a donation under 1,000 XP returns no ticket', async function () {
    reset();
    const result = await donatePoints({ amount: 999 }, auth());
    assert.deepStrictEqual(plain(result), { success: true, newBadges: ['donor_100', 'donor_500'], bonusPts: 0, donationTicket: 0 });
    assert.strictEqual(write('users/ada', 'update').data.orangeTickets, undefined);
    assert.strictEqual(state.writes.some(function (item) { return item.path.indexOf('_donate_ticket') !== -1; }), false);
    assert.deepStrictEqual(write('users/ada', 'update').data.pointsDonated, { op: 'inc', n: 999 });
});

test('1,000 XP awards one orange ticket once per 5 AM UTC day', async function () {
    reset();
    state.now = Date.parse('2026-11-01T04:30:00.000Z');
    setNow(sandbox, state.now);
    state.grants = [{ granted: true, xp: 9 }, { granted: false, xp: 50 }];
    const result = await donatePoints({ amount: 1000.9 }, auth());
    assert.deepStrictEqual(plain(result), {
        success: true,
        newBadges: ['donor_100', 'donor_500', 'donor_1000'],
        bonusPts: 9,
        donationTicket: 1
    });
    const userUpdate = write('users/ada', 'update');
    assert.deepStrictEqual(userUpdate.data.pointsDonated, { op: 'inc', n: 1000 });
    assert.deepStrictEqual(userUpdate.data.orangeTickets, { op: 'inc', n: 1 });
    assert.deepStrictEqual(userUpdate.data.donationBadges, { op: 'union', args: ['donor_100', 'donor_500', 'donor_1000'] });
    const ticket = write('_donate_ticket', 'set');
    assert.strictEqual(ticket.path, 'users/ada/daily_action_counts/2026-10-31_donate_ticket');
    assert.strictEqual(ticket.data.amount, 1000);
    const stats = write('charity_stats/global', 'update');
    assert.deepStrictEqual(stats.data['factionTotals.cyber_hornets'], { op: 'inc', n: 1000 });
    assert.deepStrictEqual(stats.data.totalDonated, { op: 'inc', n: 1000 });
    const donation = write('charity_donations/', 'set');
    assert.strictEqual(donation.data.username, 'Ada');
    assert.strictEqual(donation.data.faction, 'cyber_hornets');
    assert.strictEqual(donation.data.amount, 1000);

    state.ticketExists = true;
    state.writes = [];
    const again = await donatePoints({ amount: '1000', anonymous: true }, auth());
    assert.strictEqual(again.donationTicket, 0);
    assert.strictEqual(write('users/ada', 'update').data.orangeTickets, undefined);
    assert.strictEqual(state.writes.some(function (item) { return item.path.indexOf('_donate_ticket') !== -1; }), false);
    assert.strictEqual(write('charity_donations/', 'set').data.username, 'Anonymous');
});

test('the ticket day flips at 05:00 UTC, not midnight', async function () {
    reset({
        points: 200000,
        pointsDonated: 100000,
        donationBadges: ['donor_100', 'donor_500', 'donor_1000', 'donor_5000', 'donor_10000', 'donor_25000', 'donor_50000', 'donor_100000']
    });
    state.now = Date.parse('2026-11-01T05:00:00.000Z');
    setNow(sandbox, state.now);
    const result = await donatePoints({ amount: 1000 }, auth());
    assert.deepStrictEqual(plain(result), { success: true, newBadges: [], bonusPts: 0, donationTicket: 1 });
    assert.strictEqual(write('_donate_ticket', 'set').path, 'users/ada/daily_action_counts/2026-11-01_donate_ticket');
});

test('honey badger donations land in that faction total', async function () {
    // available = 1000 - 200 - 300 - 100
    reset({ faction: 'honey_badgers', points: 1000, pointsClaimed: 200, pointsDonated: 300, pointsExchanged: 100 });
    const result = await donatePoints({ amount: 400 }, auth());
    assert.strictEqual(result.donationTicket, 0);
    assert.deepStrictEqual(write('charity_stats/global', 'update').data['factionTotals.honey_badgers'], { op: 'inc', n: 400 });
    assert.strictEqual(write('charity_stats/global', 'update').data['factionTotals.cyber_hornets'], undefined);
});

test('rejects bad amounts, missing auth, guests, faction, balance, and unknown users', async function () {
    reset();
    await expectCode(function () { return donatePoints({ amount: 1 }, {}); }, 'unauthenticated');
    await expectCode(function () { return donatePoints({ amount: 1 }, auth('anonymous')); }, 'permission-denied');
    await expectCode(function () { return donatePoints({ amount: 0 }, auth()); }, 'invalid-argument');
    await expectCode(function () { return donatePoints({ amount: -5 }, auth()); }, 'invalid-argument');
    await expectCode(function () { return donatePoints({ amount: 'nope' }, auth()); }, 'invalid-argument');
    await expectCode(function () { return donatePoints({ amount: 1000001 }, auth()); }, 'invalid-argument');
    state.user = user({ faction: '' });
    await expectCode(function () { return donatePoints({ amount: 1 }, auth()); }, 'failed-precondition');
    state.user = user({ faction: 'other' });
    await expectCode(function () { return donatePoints({ amount: 1 }, auth()); }, 'failed-precondition');
    state.user = user({ points: 1000, pointsClaimed: 200, pointsDonated: 300, pointsExchanged: 100 });
    await expectCode(function () { return donatePoints({ amount: 401 }, auth()); }, 'failed-precondition');
    state.user = null;
    await expectCode(function () { return donatePoints({ amount: 1 }, auth()); }, 'not-found');
    assert.strictEqual(state.writes.length, 0);
});

(async function main() {
    for (let i = 0; i < tests.length; i++) {
        try {
            await tests[i].fn();
            console.log('✅ ' + tests[i].name);
            passed++;
        } catch (e) {
            console.log('❌ ' + tests[i].name + ': ' + (e.stack || e.message));
            failed++;
        }
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
})().catch(function (err) {
    console.error(err);
    process.exit(1);
});
