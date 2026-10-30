'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const lb = require('../functions/src/lbPrizes');
const ps = require('../functions/src/predictionStats');
const questBoard = require('../functions/src/questBoard');
const dry = require('../functions/scripts/dry-run-lb-prizes');

let passed = 0;
let failed = 0;
const queue = [];
function test(name, fn) {
    queue.push({ name: name, fn: fn });
}

test('ISO week-year does not reuse the next year for the week that crosses New Year', function () {
    const at = new Date('2027-01-04T05:00:00.000Z');
    assert.strictEqual(ps.previousWeekKey(at), '2026-W53');
    assert.strictEqual(lb.legacyXpWeekKey(at), '2027-W01');
    assert.notStrictEqual(ps.previousWeekKey(at), lb.legacyXpWeekKey(at));
    assert.strictEqual(ps.previousWeekKey(new Date('2026-11-02T05:00:00.000Z')), '2026-W44');
});

test('banned display slots are not paid and the next player does not move up', function () {
    const rows = [
        { uid: 'a', username: 'A', rank: 1, banned: true, score: 90 },
        { uid: 'b', username: 'B', rank: 2, score: 80 },
        { uid: 'c', username: 'hidden@email.test', rank: 3, ghostMode: true, score: 70 },
        { uid: 'd', username: 'D', rank: 4, score: 60 }
    ];
    const plan = lb.payableFromDisplayed(rows, 25);
    assert.deepStrictEqual(plan.paid.map(function (row) { return row.uid; }), ['b', 'd']);
    assert.deepStrictEqual(plan.paid.map(function (row) { return row.rank; }), [2, 4]);
    assert.strictEqual(plan.paid[0].tickets, 25);
    assert.strictEqual(plan.skipped[0].uid, 'a');
    assert.strictEqual(plan.skipped[0].skipped, 'banned');
    assert.strictEqual(plan.paid[0].username, 'B');
    assert.ok(plan.skipped.some(function (row) { return row.uid === 'c' && row.username === 'Anon'; }));
    assert.strictEqual(lb.truncateUid('abcdefghij'), 'abcdef…');
    assert.strictEqual(lb.prizeReason('xp', '2026-W44', 1), 'Week 2026-W44 Top 1!');
    assert.strictEqual(lb.prizeReason('xp', '2026-M10', 2), 'Month 2026-M10 Top 2!');
});

test('quest prize rank matches the public board and keeps a banned player in place', function () {
    const rows = [
        { uid: 'ghost', username: 'Ghost', ghostMode: true, banned: false, passes: 9, attempts: 9, passedAttempts: 9, reachedAt: 1 },
        { uid: 'ban', username: 'Ban', ghostMode: false, banned: true, passes: 8, attempts: 8, passedAttempts: 8, reachedAt: 2 },
        { uid: 'ok', username: 'Ok', ghostMode: false, banned: false, passes: 7, attempts: 7, passedAttempts: 7, reachedAt: 3 }
    ];
    const ranked = questBoard.rankForPrize(rows, 'week');
    assert.deepStrictEqual(ranked.map(function (row) { return row.uid; }), ['ban', 'ok']);
    assert.strictEqual(ranked[0].rank, 1);
    assert.strictEqual(ranked[0].banned, true);
    assert.strictEqual(ranked[1].rank, 2);
    const pub = questBoard.selectBoard(rows, 'week');
    assert.strictEqual(JSON.stringify(pub).indexOf('ghost'), -1);
    assert.deepStrictEqual(Object.keys(pub[0]).sort(), ['passes', 'pct', 'profilePic', 'rank', 'username']);
    const paid = lb.payableFromDisplayed(ranked.slice(0, lb.TOP), 100);
    assert.deepStrictEqual(paid.paid.map(function (row) { return row.uid; }), ['ok']);
    assert.strictEqual(paid.paid[0].rank, 2);
    assert.strictEqual(paid.paid[0].tickets, 100);
});

test('quest month job at 05:00 UTC on the 1st pays the Eastern month that just closed', function () {
    const job = new Date('2026-11-01T05:00:00.000Z').getTime();
    assert.strictEqual(lb.questKeyForJob('monthly', job), lb.closedQuestMonthKey(job));
    assert.strictEqual(lb.questKeyForJob('monthly', job), '2026-10');
    assert.notStrictEqual(lb.questKeyForJob('monthly', job), questBoard.monthKey(job));
    const monday = new Date('2026-11-02T05:00:00.000Z').getTime();
    assert.notStrictEqual(lb.questKeyForJob('weekly', monday), questBoard.weekKey(monday));
    assert.strictEqual(lb.questKeyForJob('weekly', monday), lb.closedQuestWeekKey(monday));
});

test('prediction history that already paid blocks another grant', function () {
    assert.strictEqual(lb.legacySettled({ status: 'complete', awardedUids: [] }), true);
    assert.strictEqual(lb.legacySettled({ status: 'pending', awardedUids: ['u1'] }), true);
    assert.strictEqual(lb.legacySettled({ status: 'pending', awardedUids: [] }), false);
    assert.strictEqual(lb.legacySettled({ winners: [{ uid: 'u1' }], uids: ['u1'] }), true);
    assert.deepStrictEqual(lb.PREDICTION_BEFORE, {
        weekly: { top: 5, tickets: 25, min: 5 },
        monthly: { top: 5, tickets: 50, min: 15 },
        alltime: { top: 0, tickets: 0, min: 10 }
    });
    assert.strictEqual(lb.TICKETS.weekly, 25);
    assert.strictEqual(lb.TICKETS.monthly, 100);
    assert.strictEqual(lb.TOP, 10);
});

test('rules keep prize markers server-only', function () {
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    const block = rules.split('match /lb_prize_markers/{markerId}')[1].split('match /')[0];
    assert.ok(block.indexOf('allow read, write: if false') !== -1);
    assert.ok(rules.indexOf('match /winners/{winnerId}') !== -1);
    const users = rules.split('match /users/{userId}')[1].split('match /visits/')[0];
    assert.ok(users.indexOf("'orangeTickets'") !== -1);
    const retained = fs.readFileSync(path.join(__dirname, '..', 'functions/src/deleteAccount.js'), 'utf8');
    assert.ok(retained.indexOf("'lb_prize_markers'") !== -1);
});

test('dry-run script does not write', function () {
    dry.assertReadOnlySource();
    const src = fs.readFileSync(path.join(__dirname, '..', 'functions/scripts/dry-run-lb-prizes.js'), 'utf8');
    assert.ok(src.indexOf('truncateUid') !== -1);
    assert.ok(src.indexOf('PREDICTION_BEFORE') !== -1);
});

function memoryDb() {
    const store = {};
    function apply(target, data) {
        Object.keys(data || {}).forEach(function (key) {
            const value = data[key];
            if (value && value.__inc != null) target[key] = (Number(target[key]) || 0) + value.__inc;
            else if (value && value.__arr) target[key] = (target[key] || []).concat(value.__arr);
            else if (value && value.__ts) target[key] = 1;
            else target[key] = value;
        });
    }
    function snap(path) {
        const exists = Object.prototype.hasOwnProperty.call(store, path);
        return {
            exists: exists,
            id: path.split('/').pop(),
            data: function () { return exists ? JSON.parse(JSON.stringify(store[path])) : undefined; }
        };
    }
    function write(path, data, opts) {
        if (!store[path]) store[path] = {};
        if (opts && opts.merge) apply(store[path], JSON.parse(JSON.stringify(data, function (k, v) {
            if (v && v.__inc != null) return { __inc: v.__inc };
            if (v && v.__arr) return { __arr: v.__arr };
            if (v && v.__ts) return { __ts: true };
            return v;
        })));
        else store[path] = JSON.parse(JSON.stringify(data, function (k, v) {
            if (v && (v.__inc != null || v.__arr || v.__ts)) return v;
            return v;
        }));
        if (!(opts && opts.merge)) {
            const copy = {};
            apply(copy, data);
            store[path] = copy;
        }
    }
    function ref(path) {
        return {
            path: path,
            id: path.split('/').pop(),
            get: async function () { return snap(path); },
            set: async function (data, opts) { write(path, data, opts || { merge: false }); },
            update: async function (data) { if (!store[path]) store[path] = {}; apply(store[path], data); },
            collection: function (name) {
                return { doc: function (id) { return ref(path + '/' + name + '/' + id); } };
            }
        };
    }
    const db = {
        collection: function (name) {
            return { doc: function (id) { return ref(name + '/' + id); } };
        },
        runTransaction: async function (fn) {
            const tx = {
                get: async function (r) { return r.get(); },
                set: function (r, data, opts) { return r.set(data, opts); },
                update: function (r, data) { return r.update(data); }
            };
            return fn(tx);
        }
    };
    return { db: db, store: store };
}

test('a retry pays the locked list and does not add a new winner', async function () {
    const mem = memoryDb();
    mem.store['users/u1'] = { username: 'Ada', orangeTickets: 0, ghostMode: false };
    mem.store['users/extra'] = { username: 'Extra', orangeTickets: 0, ghostMode: false };
    mem.store['lb_prize_markers/xp_2026-W44'] = {
        status: 'pending',
        tickets: 25,
        paidUids: [],
        plan: [
            { uid: 'u1', username: 'Ada', rank: 1, tickets: 25, skipped: '' },
            { uid: 'ban', username: 'Ban', rank: 2, tickets: 0, skipped: 'banned' }
        ]
    };
    const admin = {
        firestore: {
            FieldValue: {
                increment: function (n) { return { __inc: n }; },
                arrayUnion: function (v) { return { __arr: [v] }; },
                serverTimestamp: function () { return { __ts: true }; }
            }
        }
    };
    const result = await lb.payWinners(mem.db, admin, {
        board: 'xp',
        period: 'weekly',
        periodKey: '2026-W44',
        tickets: 25,
        rows: [
            { uid: 'extra', username: 'Extra', rank: 1, score: 99 },
            { uid: 'u1', username: 'Ada', rank: 2, score: 1 },
            { uid: 'third', username: 'Third', rank: 3, score: 1 }
        ]
    });
    assert.strictEqual(result.paidCount, 1);
    assert.strictEqual(result.paid[0].uid, 'u1');
    assert.strictEqual(mem.store['users/u1'].orangeTickets, 25);
    assert.strictEqual(mem.store['users/extra'].orangeTickets, 0);
    assert.ok(!mem.store['users/third']);
    assert.deepStrictEqual(mem.store['lb_prize_markers/xp_2026-W44'].plan.map(function (row) { return row.uid; }), ['u1', 'ban']);
});

test('a retry does not grant the same winner twice', async function () {
    const mem = memoryDb();
    mem.store['users/u1'] = { username: 'Ada', orangeTickets: 3, ghostMode: false };
    const admin = {
        firestore: {
            FieldValue: {
                increment: function (n) { return { __inc: n }; },
                arrayUnion: function (v) { return { __arr: [v] }; },
                serverTimestamp: function () { return { __ts: true }; }
            }
        }
    };
    const rows = [
        { uid: 'u1', username: 'Ada', rank: 1, score: 10 },
        { uid: 'ban', username: 'Ban', rank: 2, banned: true, score: 9 }
    ];
    const first = await lb.payWinners(mem.db, admin, {
        board: 'xp', period: 'weekly', periodKey: '2026-W44', tickets: 25, rows: rows
    });
    assert.strictEqual(first.action, 'pay');
    assert.strictEqual(first.paidCount, 1);
    assert.strictEqual(mem.store['users/u1'].orangeTickets, 28);
    const second = await lb.payWinners(mem.db, admin, {
        board: 'xp', period: 'weekly', periodKey: '2026-W44', tickets: 25, rows: rows
    });
    assert.strictEqual(second.action, 'skip');
    assert.strictEqual(second.reason, 'marker');
    assert.strictEqual(mem.store['users/u1'].orangeTickets, 28);
    assert.strictEqual(mem.store['lb_prize_markers/xp_2026-W44'].status, 'complete');
    assert.deepStrictEqual(mem.store['lb_prize_markers/xp_2026-W44'].plan.map(function (row) { return row.uid; }), ['u1', 'ban']);
    const noteKey = Object.keys(mem.store).filter(function (key) { return key.indexOf('notifications/') === 0; })[0];
    assert.ok(noteKey);
    assert.ok(String(mem.store[noteKey].message).indexOf('25') !== -1);
});

async function run() {
    for (let i = 0; i < queue.length; i++) {
        try {
            await queue[i].fn();
            console.log('✅ ' + queue[i].name);
            passed++;
        } catch (e) {
            console.log('❌ ' + queue[i].name + ': ' + (e && e.stack ? e.stack : e));
            failed++;
        }
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
}

run();
