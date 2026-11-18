#!/usr/bin/env node
// PvP badge eligibility and once-per-match played counts. Uses an in-memory Firestore stub.
const assert = require('assert');
const { awardBadge } = require('../functions/src/awardBadge');
const badgeRules = require('../functions/src/badgeRules');
const { recordPvpPlayed } = require('../functions/src/activityCounters');
const { grantFamily, familyFor } = require('../functions/src/grantBadge');
const pvpFlow = require('../functions/src/pvpFlow');
const fs = require('fs');
const path = require('path');

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
    // Signed-in account for #372's guest gate in awardBadge (an email sign-in on record).
    auth: function () { return { getUser: async function (uid) { return { uid: uid, providerData: [{ providerId: 'password' }] }; } }; },
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
    function subcollection(colPath) {
        return {
            doc: function (id) { return ref(colPath + '/' + id); },
            get: async function () {
                const out = [];
                Object.keys(docs).forEach(function (k) {
                    if (k.indexOf(colPath + '/') !== 0) return;
                    const rest = k.slice(colPath.length + 1);
                    if (rest.indexOf('/') !== -1 || docs[k] == null) return;
                    const data = docs[k];
                    out.push({ id: rest, data: function () { return Object.assign({}, data); } });
                });
                return { docs: out, forEach: function (fn) { out.forEach(fn); } };
            },
        };
    }
    function ref(docPath) {
        return {
            path: docPath,
            collection: function (name) { return subcollection(docPath + '/' + name); },
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

    await test('K9: pvpBestStreak family is Hot Streak and Unstoppable, and grantFamily pays them at streaks 3 and 5', async function () {
        assert.deepStrictEqual(familyFor('pvpBestStreak'), ['pvp_win_streak_3', 'pvp_win_streak_5']);
        // Streak 2: nothing.
        const db2 = memoryDb({ 'users/u': { points: 0, pvpWins: 2, pvpBestStreak: 2 } });
        const r2 = await grantFamily(db2, admin, 'u', familyFor('pvpBestStreak'));
        assert.ok(!r2.some(function (r) { return r && r.granted; }));
        assert.ok(!db2.docs['users/u/badge_awards/pvp_win_streak_3']);
        // Streak 3: Hot Streak only.
        const db3 = memoryDb({ 'users/u': { points: 0, pvpWins: 3, pvpBestStreak: 3 } });
        const r3 = await grantFamily(db3, admin, 'u', familyFor('pvpBestStreak'));
        assert.ok(r3[0] && r3[0].granted, 'pvp_win_streak_3 granted at 3');
        assert.strictEqual(r3[0].xp || r3[0].awarded, 75);
        assert.ok(!(r3[1] && r3[1].granted), 'pvp_win_streak_5 not granted at 3');
        assert.ok(db3.docs['users/u/badge_awards/pvp_win_streak_3']);
        assert.ok(!db3.docs['users/u/badge_awards/pvp_win_streak_5']);
        // Streak 5 later: Unstoppable is added, Hot Streak is not paid twice.
        db3.docs['users/u'] = Object.assign({}, db3.docs['users/u'], { pvpWins: 5, pvpBestStreak: 5 });
        const r5 = await grantFamily(db3, admin, 'u', familyFor('pvpBestStreak'));
        assert.strictEqual(r5[0].reason, 'already');
        assert.ok(r5[1] && r5[1].granted, 'pvp_win_streak_5 granted at 5');
        assert.strictEqual(r5[1].xp || r5[1].awarded, 150);
        assert.ok(db3.docs['users/u/badge_awards/pvp_win_streak_5']);
    });

    await test('K9: a guest match (or a missing stamp) grants no badge family, a signed-in match grants all three', async function () {
        const guest = pvpFlow.planPvpBadgeGrants(['a', 'b'], pvpFlow.readGuestStamp({ guestStamp: { version: 1, player1: false, player2: true } }));
        assert.deepStrictEqual(guest.rewardUids, []);
        assert.deepStrictEqual(guest.fields, []);
        assert.deepStrictEqual(guest.skipUids, ['a', 'b']);
        const missing = pvpFlow.planPvpBadgeGrants(['a', 'b'], pvpFlow.readGuestStamp(null));
        assert.deepStrictEqual(missing.rewardUids, []);
        const signed = pvpFlow.planPvpBadgeGrants(['a', 'b'], pvpFlow.readGuestStamp({ guestStamp: { version: 1, player1: false, player2: false } }));
        assert.deepStrictEqual(signed.rewardUids, ['a', 'b']);
        assert.deepStrictEqual(signed.fields, ['pvpWins', 'pvpPlayed', 'pvpBestStreak']);
        // A guest at streak 5 (e.g. a stale counter) still gets nothing, because
        // no family is granted for a guest match.
        const db = memoryDb({ 'users/g': { points: 0, pvpWins: 5, pvpBestStreak: 5 } });
        for (let i = 0; i < guest.fields.length; i++) await grantFamily(db, admin, 'g', familyFor(guest.fields[i]));
        assert.ok(!db.docs['users/g/badge_awards/pvp_win_streak_3']);
        assert.ok(!db.docs['users/g/badge_awards/pvp_win_streak_5']);
    });

    await test('K9: onPvpMatchFinished grants every planned family to each reward uid', async function () {
        const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
        const fin = src.slice(src.indexOf('exports.onPvpMatchFinished'), src.indexOf('exports.onUserDocCreated'));
        assert.ok(/pvpFlow\.planPvpBadgeGrants\(sideUids, stamp\)/.test(fin));
        ['pvpWins', 'pvpPlayed', 'pvpBestStreak'].forEach(function (f) {
            assert.ok(fin.includes("grantFamily(db, admin, rewardUids[ri], familyFor('" + f + "'))"), f);
        });
        assert.ok(/const rewardUids = badgePlan\.rewardUids;/.test(fin));
        assert.ok(fin.indexOf('recordPvpPlayed') < fin.indexOf("familyFor('pvpBestStreak')"), 'played count first, then badges');
    });

    console.log(failed ? ('\n' + failed + ' failed') : ('\n' + passed + ' passed'));
    if (failed) process.exit(1);
}

main().catch(function (err) {
    console.error(err);
    process.exit(1);
});
