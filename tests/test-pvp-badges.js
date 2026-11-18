#!/usr/bin/env node
// PvP badge eligibility and once-per-match played counts. Uses an in-memory Firestore stub.
const assert = require('assert');
const { awardBadge } = require('../functions/src/awardBadge');
const badgeRules = require('../functions/src/badgeRules');
const { recordPvpPlayed } = require('../functions/src/activityCounters');

let passed = 0;
let failed = 0;
function test(name, fn) {
    return Promise.resolve().then(fn).then(function () {
        passed++;
        console.log('  ok  ' + name);
    }, function (e) {
        failed++;
        console.log('  FAIL ' + name + ': ' + (e && e.message ? e.message : e));
    });
}

const admin = {
    firestore: {
        FieldValue: {
            serverTimestamp: function () { return { _serverTimestamp: true }; },
            increment: function (n) { return { _increment: n }; },
            arrayUnion: function () { return { _arrayUnion: Array.prototype.slice.call(arguments) }; },
        },
    },
};

function memoryDb(seed) {
    const docs = Object.assign({}, seed || {});
    function ref(docPath) {
        return {
            path: docPath,
            collection: function (name) { return { doc: function (id) { return ref(docPath + '/' + name + '/' + id); } }; },
            get: async function () {
                const data = docs[docPath];
                return { exists: data != null, data: function () { return data ? Object.assign({}, data) : undefined; } };
            },
        };
    }
    return {
        docs: docs,
        collection: function (name) {
            return { doc: function (id) { return ref(name + '/' + id); } };
        },
        runTransaction: async function (fn) {
            const staged = [];
            const t = {
                get: function (r) { return r.get(); },
                set: function (r, data) { staged.push({ path: r.path, data: data }); },
                update: function (r, data) { staged.push({ path: r.path, data: data, update: true }); },
            };
            const result = await fn(t);
            staged.forEach(function (w) {
                if (w.update) {
                    const next = Object.assign({}, docs[w.path]);
                    Object.keys(w.data).forEach(function (key) {
                        const value = w.data[key];
                        if (value && value._increment) next[key] = (next[key] || 0) + value._increment;
                        else next[key] = value;
                    });
                    docs[w.path] = next;
                } else {
                    docs[w.path] = w.data;
                }
            });
            return result;
        },
    };
}

async function main() {
    await test('awardBadge rejects a PvP badge when the server counters are short', async function () {
        assert.strictEqual(badgeRules.isCosmetic('pvp_win_streak_3'), false);
        assert.strictEqual(badgeRules.isCosmetic('pvp_win_streak_5'), false);
        assert.strictEqual(badgeRules.xpOf('pvp_win_streak_3'), 75);
        assert.strictEqual(badgeRules.xpOf('pvp_win_streak_5'), 150);
        const db = memoryDb({
            'users/u': { points: 0, pvpWins: 0, pvpPlayed: 0, pvpBestStreak: 0 },
        });
        const rejected = await awardBadge(db, admin, 'u', 'pvp_first');
        assert.strictEqual(rejected.granted || rejected.success, false);
        assert.strictEqual(rejected.reason, 'criteria');
        assert.strictEqual(rejected.xp || rejected.awarded || 0, 0);
        assert.ok(!db.docs['users/u/badge_awards/pvp_first']);
        db.docs['users/u'] = { points: 0, pvpWins: 1, pvpPlayed: 1, pvpBestStreak: 0 };
        const paid = await awardBadge(db, admin, 'u', 'pvp_first');
        assert.ok(paid.granted || paid.success);
        assert.ok((paid.xp || paid.awarded) > 0);
        const streak = await awardBadge(memoryDb({
            'users/u': { points: 0, pvpWins: 10, pvpBestStreak: 3 },
        }), admin, 'u', 'pvp_win_streak_3');
        assert.ok(streak.granted || streak.success);
        assert.strictEqual(streak.xp || streak.awarded, 75);
        const shortStreak = await awardBadge(memoryDb({
            'users/u': { points: 0, pvpWins: 10, pvpBestStreak: 2 },
        }), admin, 'u', 'pvp_win_streak_3');
        assert.strictEqual(shortStreak.reason, 'criteria');
    });

    await test('recordPvpPlayed counts a match once, including forfeits, and skips anonymous uids', async function () {
        const after = {
            status: 'forfeit',
            player1: { uid: 'a' },
            player2: { uid: 'b' },
        };
        const db = memoryDb({
            'users/a': { pvpPlayed: 0 },
            'users/b': { pvpPlayed: 4 },
        });
        const first = await recordPvpPlayed(db, admin, after, 'match-1', { skipUids: ['b'], guestMatch: false });
        assert.strictEqual(first.bumped, true);
        assert.deepStrictEqual(first.uids, ['a']);
        assert.strictEqual(db.docs['users/a'].pvpPlayed, 1);
        assert.strictEqual(db.docs['users/b'].pvpPlayed, 4);
        assert.ok(db.docs['pvp_played/match-1']);
        const second = await recordPvpPlayed(db, admin, after, 'match-1', { skipUids: [], guestMatch: false });
        assert.strictEqual(second.bumped, false);
        assert.strictEqual(second.reason, 'already');
        assert.strictEqual(db.docs['users/a'].pvpPlayed, 1);
        assert.strictEqual(db.docs['users/b'].pvpPlayed, 4);
        const finished = {
            status: 'finished',
            player1: { uid: 'a' },
            player2: { uid: 'c' },
        };
        const db2 = memoryDb({
            'users/a': { pvpPlayed: 1 },
            'users/c': { pvpPlayed: 0 },
        });
        const both = await recordPvpPlayed(db2, admin, finished, 'match-2', { guestMatch: false });
        assert.strictEqual(both.bumped, true);
        assert.strictEqual(db2.docs['users/a'].pvpPlayed, 2);
        assert.strictEqual(db2.docs['users/c'].pvpPlayed, 1);
    });

    await test('recordPvpPlayed: a guest match (or a missing stamp) bumps nobody', async function () {
        const after = { status: 'finished', player1: { uid: 'a' }, player2: { uid: 'b' } };
        const db = memoryDb({ 'users/a': { pvpPlayed: 3 }, 'users/b': { pvpPlayed: 0 } });
        const r = await recordPvpPlayed(db, admin, after, 'match-g', { guestMatch: true });
        assert.deepStrictEqual(r.uids, []);
        assert.strictEqual(db.docs['users/a'].pvpPlayed, 3);
        assert.strictEqual(db.docs['users/b'].pvpPlayed, 0);
        const db2 = memoryDb({ 'users/a': { pvpPlayed: 3 }, 'users/b': { pvpPlayed: 0 } });
        const r2 = await recordPvpPlayed(db2, admin, after, 'match-h');
        assert.deepStrictEqual(r2.uids, []);
        assert.strictEqual(db2.docs['users/a'].pvpPlayed, 3);
    });

    console.log(failed ? ('\n' + failed + ' failed') : ('\n' + passed + ' passed'));
    if (failed) process.exit(1);
}

main().catch(function (err) {
    console.error(err);
    process.exit(1);
});
