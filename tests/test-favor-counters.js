// Personal Satoshi's Favor counter, factionPoints audit, and the level whitelist.
// The trifecta credits +1 inside the contributor dedup. Badge and collection
// writes store the race result and spend the loser head-start budget.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const admin = require('../functions/src/firebaseAdmin.js');
const favor = require('../functions/src/satoshiFavor');
const { awardBadge } = require('../functions/src/awardBadge');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function applyWrite(docs, docPath, data, update, merge) {
    const base = (update || merge) && docs[docPath] ? Object.assign({}, docs[docPath]) : {};
    const next = (update || merge) ? base : {};
    Object.keys(data || {}).forEach(function (key) {
        const value = data[key];
        if (value && typeof value === 'object' && value._increment != null) {
            next[key] = (Number(next[key]) || 0) + value._increment;
        } else if (value && typeof value === 'object' && value._arrayUnion) {
            const cur = Array.isArray(next[key]) ? next[key].slice() : [];
            value._arrayUnion.forEach(function (item) {
                if (cur.indexOf(item) === -1) cur.push(item);
            });
            next[key] = cur;
        } else {
            next[key] = value;
        }
    });
    docs[docPath] = next;
}

function memoryDb(seed) {
    const docs = Object.assign({}, seed || {});
    function ref(docPath) {
        return {
            path: docPath,
            collection: function (name) { return collectionAt(docPath + '/' + name); },
            get: async function () {
                const data = docs[docPath];
                return {
                    exists: data != null,
                    data: function () { return data ? Object.assign({}, data) : undefined; },
                };
            },
        };
    }
    function collectionAt(prefix) {
        return { path: prefix, doc: function (id) { return ref(prefix + '/' + id); } };
    }
    return {
        docs: docs,
        collection: function (name) { return collectionAt(name); },
        runTransaction: async function (fn) {
            const staged = [];
            const t = {
                get: function (r) { return r.get(); },
                set: function (r, data, opts) {
                    staged.push({ path: r.path, data: data, merge: !!(opts && opts.merge) });
                },
                update: function (r, data) { staged.push({ path: r.path, data: data, update: true }); },
            };
            const result = await fn(t);
            staged.forEach(function (w) { applyWrite(docs, w.path, w.data, w.update, w.merge); });
            return result;
        },
    };
}

function useDb(mem) {
    function firestore() { return mem; }
    firestore.FieldValue = {
        increment: function (n) { return { _increment: n }; },
        serverTimestamp: function () { return { _serverTimestamp: true }; },
    };
    firestore.Timestamp = {
        now: function () {
            const ms = Date.now();
            return { toMillis: function () { return ms; } };
        },
        fromMillis: function (ms) {
            return { toMillis: function () { return ms; } };
        },
    };
    admin.firestore = firestore;
    return mem;
}

function proofs(docs, uid, day, user) {
    docs['users/' + uid] = user;
    docs['users/' + uid + '/daily_action_counts/' + day + '_trivia'] = { count: 1 };
    docs['users/' + uid + '/daily_action_counts/' + day + '_quest'] = { count: 1 };
    docs['polls/' + day + '/votes/' + uid] = { uid: uid };
}

function headStartTotals(extra) {
    return Object.assign({
        raceId: 'race2',
        cyber_hornets: 0,
        honey_badgers: 0,
        headStart: { faction: 'honey_badgers', afterRaceId: 'race1', mult: 1.1, points: 1000 },
    }, extra || {});
}

const badgeAdmin = {
    firestore: {
        FieldValue: {
            serverTimestamp: function () { return { _serverTimestamp: true }; },
            increment: function (n) { return { _increment: n }; },
            arrayUnion: function () { return { _arrayUnion: Array.prototype.slice.call(arguments) }; },
        },
        Timestamp: {
            now: function () { return { _serverNow: true }; },
            fromMillis: function (ms) { return { toMillis: function () { return ms; }, _ms: ms }; },
        },
    },
};

const tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

test('a badge stores race points and spends the loser head-start budget once', async function () {
    const now = 1700000000000;
    const day = '2026-10-22';
    const opts = { day: day, nowMs: now, skipCollections: true };
    const loser = useDb(memoryDb({
        'users/u': { sayHiDays: 7, points: 0, faction: 'honey_badgers' },
        'satoshiFavor/factionTotals': headStartTotals(),
        'satoshiFavor/current': { points: 0, favorActive: false, bonusMinutes: 0 },
    }));
    const first = await awardBadge(loser, badgeAdmin, 'u', 'say_hi_1', opts);
    assert.strictEqual(first.favorPoint, true);
    const row = loser.docs['satoshiFavor/current/contributors/u_badge_say_hi_1'];
    assert.strictEqual(row.pointsAdded, 1);
    assert.strictEqual(row.factionPoints, 1.1);
    assert.strictEqual(loser.docs['satoshiFavor/factionTotals'].honey_badgers, 1.1);
    assert.strictEqual(loser.docs['satoshiFavor/factionTotals'].headStartUsed_race2, 1);
    assert.strictEqual(loser.docs['satoshiFavor/userSfPoints/users/u'].points, 1);
    assert.strictEqual(loser.docs['satoshiFavor/current'].points, 1);
    const repeat = await awardBadge(loser, badgeAdmin, 'u', 'say_hi_1', opts);
    assert.strictEqual(repeat.reason, 'already');
    assert.strictEqual(loser.docs['satoshiFavor/factionTotals'].headStartUsed_race2, 1);
    assert.strictEqual(loser.docs['satoshiFavor/userSfPoints/users/u'].points, 1);
    assert.strictEqual(loser.docs['satoshiFavor/current'].points, 1);
    const second = await awardBadge(loser, badgeAdmin, 'u', 'say_hi_7', opts);
    assert.strictEqual(second.favorPoint, true);
    assert.strictEqual(loser.docs['satoshiFavor/current/contributors/u_badge_say_hi_7'].pointsAdded, 1);
    assert.strictEqual(loser.docs['satoshiFavor/current/contributors/u_badge_say_hi_7'].factionPoints, 1.1);
    assert.strictEqual(loser.docs['satoshiFavor/factionTotals'].headStartUsed_race2, 2);
    assert.strictEqual(loser.docs['satoshiFavor/factionTotals'].honey_badgers, 2.2);
    assert.strictEqual(loser.docs['satoshiFavor/userSfPoints/users/u'].points, 2);
    assert.strictEqual(loser.docs['satoshiFavor/current'].points, 2);

    const winner = useDb(memoryDb({
        'users/u': { sayHiDays: 1, points: 0, faction: 'cyber_hornets' },
        'satoshiFavor/factionTotals': headStartTotals(),
    }));
    await awardBadge(winner, badgeAdmin, 'u', 'say_hi_1', opts);
    assert.strictEqual(winner.docs['satoshiFavor/current/contributors/u_badge_say_hi_1'].factionPoints, 1);
    assert.strictEqual(winner.docs['satoshiFavor/factionTotals'].cyber_hornets, 1);
    assert.strictEqual(winner.docs['satoshiFavor/factionTotals'].headStartUsed_race2, undefined);
    assert.strictEqual(winner.docs['satoshiFavor/current'].points, 1);

    const spent = useDb(memoryDb({
        'users/u': { sayHiDays: 1, points: 0, faction: 'honey_badgers' },
        'satoshiFavor/factionTotals': headStartTotals({ headStartUsed_race2: 1000 }),
    }));
    await awardBadge(spent, badgeAdmin, 'u', 'say_hi_1', opts);
    assert.strictEqual(spent.docs['satoshiFavor/current/contributors/u_badge_say_hi_1'].factionPoints, 1);
    assert.strictEqual(spent.docs['satoshiFavor/factionTotals'].honey_badgers, 1);
    assert.strictEqual(spent.docs['satoshiFavor/factionTotals'].headStartUsed_race2, 1000);

    const partial = useDb(memoryDb({
        'users/u': { sayHiDays: 1, points: 0, faction: 'honey_badgers' },
        'satoshiFavor/factionTotals': headStartTotals({ headStartUsed_race2: 999.5 }),
    }));
    await awardBadge(partial, badgeAdmin, 'u', 'say_hi_1', opts);
    assert.strictEqual(partial.docs['satoshiFavor/current/contributors/u_badge_say_hi_1'].pointsAdded, 1);
    assert.strictEqual(partial.docs['satoshiFavor/current/contributors/u_badge_say_hi_1'].factionPoints, 1.05);
    assert.strictEqual(partial.docs['satoshiFavor/factionTotals'].honey_badgers, 1.05);
    assert.strictEqual(partial.docs['satoshiFavor/factionTotals'].headStartUsed_race2, 1000);
    assert.strictEqual(partial.docs['satoshiFavor/current'].points, 1);
});

test('the daily trifecta adds one personal point inside the contributor dedup', async function () {
    const uid = 'ada';
    const day = '2026-10-22';
    const docs = {
        'satoshiFavor/current': { points: 3, favorActive: false, bonusMinutes: 0 },
        'satoshiFavor/factionTotals': headStartTotals(),
        'satoshiFavor/userSfPoints/users/ada': { uid: uid, points: 4 },
    };
    proofs(docs, uid, day, { faction: 'honey_badgers', points: 20 });
    const db = useDb(memoryDb(docs));
    const first = await favor.creditDailyAllThree(uid, day);
    assert.strictEqual(first.ok, true);
    assert.strictEqual(first.created, true);
    assert.strictEqual(first.points, 4);
    assert.strictEqual(first.favorActive, false);
    const row = db.docs['satoshiFavor/current/contributors/' + uid + '_' + day + '_allthree'];
    assert.strictEqual(row.pointsAdded, 1);
    assert.strictEqual(row.factionPoints, 1.1);
    assert.strictEqual(row.source, 'daily_all_three');
    assert.strictEqual(db.docs['satoshiFavor/userSfPoints/users/ada'].uid, uid);
    assert.strictEqual(db.docs['satoshiFavor/userSfPoints/users/ada'].points, 5);
    assert.strictEqual(db.docs['satoshiFavor/userSfPoints/users/ada'].updatedAt._serverTimestamp, true);
    assert.strictEqual(db.docs['satoshiFavor/factionTotals'].honey_badgers, 1.1);
    assert.strictEqual(db.docs['satoshiFavor/factionTotals'].headStartUsed_race2, 1);
    assert.strictEqual(db.docs['users/ada'].trifectaDays, 1);
    assert.strictEqual(db.docs['users/ada'].sfContributions, 1);
    assert.strictEqual(db.docs['satoshiFavor/current'].points, 4);

    const second = await favor.creditDailyAllThree(uid, day);
    assert.strictEqual(second.already, true);
    assert.strictEqual(second.created, false);
    assert.strictEqual(db.docs['satoshiFavor/userSfPoints/users/ada'].points, 5);
    assert.strictEqual(db.docs['satoshiFavor/factionTotals'].honey_badgers, 1.1);
    assert.strictEqual(db.docs['satoshiFavor/factionTotals'].headStartUsed_race2, 1);
    assert.strictEqual(db.docs['satoshiFavor/current'].points, 4);
    assert.strictEqual(db.docs['users/ada'].trifectaDays, 1);

    const nextDay = '2026-10-23';
    proofs(db.docs, uid, nextDay, db.docs['users/ada']);
    const third = await favor.creditDailyAllThree(uid, nextDay);
    assert.strictEqual(third.created, true);
    assert.strictEqual(db.docs['satoshiFavor/userSfPoints/users/ada'].points, 6);
    assert.strictEqual(db.docs['satoshiFavor/current/contributors/' + uid + '_' + nextDay + '_allthree'].factionPoints, 1.1);
    assert.strictEqual(db.docs['satoshiFavor/factionTotals'].headStartUsed_race2, 2);
    assert.strictEqual(db.docs['satoshiFavor/current'].points, 5);
});

test('an open window still counts the personal point and only adds minutes', async function () {
    const uid = 'bee';
    const day = '2026-10-22';
    const later = Date.now() + 60 * 60 * 1000;
    const docs = {
        'satoshiFavor/current': {
            points: 21,
            favorActive: true,
            bonusMinutes: 9,
            favorEndBase: { toMillis: function () { return later; } },
            favorStart: { toMillis: function () { return later - 60 * 60 * 1000; } },
        },
        'satoshiFavor/factionTotals': headStartTotals({ headStartUsed_race2: 999.5 }),
    };
    proofs(docs, uid, day, { faction: 'honey_badgers' });
    const db = useDb(memoryDb(docs));
    const credited = await favor.creditDailyAllThree(uid, day);
    assert.strictEqual(credited.created, true);
    assert.strictEqual(credited.favorActive, true);
    assert.strictEqual(credited.points, 21);
    assert.strictEqual(credited.bonusMinutes, 12);
    assert.strictEqual(db.docs['satoshiFavor/current'].points, 21);
    assert.strictEqual(db.docs['satoshiFavor/current'].bonusMinutes, 12);
    assert.strictEqual(db.docs['satoshiFavor/userSfPoints/users/bee'].points, 1);
    assert.strictEqual(db.docs['satoshiFavor/current/contributors/' + uid + '_' + day + '_allthree'].pointsAdded, 1);
    assert.strictEqual(db.docs['satoshiFavor/current/contributors/' + uid + '_' + day + '_allthree'].factionPoints, 1.05);
    assert.strictEqual(db.docs['satoshiFavor/factionTotals'].headStartUsed_race2, 1000);
    assert.strictEqual(db.docs['satoshiFavor/factionTotals'].honey_badgers, 1.05);
    const again = await favor.creditDailyAllThree(uid, day);
    assert.strictEqual(again.already, true);
    assert.strictEqual(db.docs['satoshiFavor/current'].bonusMinutes, 12);
    assert.strictEqual(db.docs['satoshiFavor/userSfPoints/users/bee'].points, 1);
    assert.strictEqual(db.docs['satoshiFavor/factionTotals'].headStartUsed_race2, 1000);
});

test('crossing 21 still activates the pool and counts one personal point', async function () {
    const uid = 'cy';
    const day = '2026-10-22';
    const docs = { 'satoshiFavor/current': { points: 20, favorActive: false, bonusMinutes: 0 } };
    proofs(docs, uid, day, {});
    const db = useDb(memoryDb(docs));
    const credited = await favor.creditDailyAllThree(uid, day);
    assert.strictEqual(credited.created, true);
    assert.strictEqual(credited.favorActive, true);
    assert.strictEqual(credited.points, 21);
    assert.strictEqual(credited.bonusMinutes, 0);
    assert.strictEqual(db.docs['satoshiFavor/userSfPoints/users/cy'].points, 1);
    assert.strictEqual(db.docs['satoshiFavor/current/contributors/' + uid + '_' + day + '_allthree'].factionPoints, 1);
    assert.strictEqual(db.docs['satoshiFavor/factionTotals'].unaffiliated, 1);
    assert.strictEqual(db.docs['satoshiFavor/factionTotals'].headStartUsed_race2, undefined);
});

test('a blocked or unfinished trifecta does not write the personal counter', async function () {
    const day = '2026-10-22';
    const bannedDocs = {};
    proofs(bannedDocs, 'ban', day, { banned: true, faction: 'honey_badgers' });
    const banned = useDb(memoryDb(bannedDocs));
    const blocked = await favor.creditDailyAllThree('ban', day);
    assert.strictEqual(blocked.reason, 'banned');
    assert.strictEqual(banned.docs['satoshiFavor/userSfPoints/users/ban'], undefined);
    assert.strictEqual(banned.docs['satoshiFavor/current/contributors/ban_' + day + '_allthree'], undefined);

    const shortDocs = { 'users/short': { faction: 'cyber_hornets' } };
    shortDocs['users/short/daily_action_counts/' + day + '_trivia'] = { count: 1 };
    shortDocs['users/short/daily_action_counts/' + day + '_quest'] = { count: 1 };
    const short = useDb(memoryDb(shortDocs));
    const incomplete = await favor.creditDailyAllThree('short', day);
    assert.strictEqual(incomplete.reason, 'incomplete');
    assert.strictEqual(incomplete.poll, false);
    assert.strictEqual(short.docs['satoshiFavor/userSfPoints/users/short'], undefined);
    assert.strictEqual(short.docs['satoshiFavor/factionTotals'], undefined);

    const missing = useDb(memoryDb({}));
    const none = await favor.creditDailyAllThree('ghost', day);
    assert.strictEqual(none.reason, 'no_user');
    assert.strictEqual(missing.docs['satoshiFavor/userSfPoints/users/ghost'], undefined);
});

test('Normie and Curious are off the contributeFavor whitelist and still award nothing', function () {
    assert.deepStrictEqual(favor.LEVEL_TIERS.level_up, ['Pleb', 'Pleb II', 'Pleb III', 'Stacker', 'Stacker II', 'Stacker III']);
    assert.ok(favor.LEVEL_TIERS.level_up.indexOf('Normie') === -1);
    assert.ok(favor.LEVEL_TIERS.level_up.indexOf('Curious') === -1);
    assert.deepStrictEqual(favor.LEVEL_TIERS.level_up_5, ['Maxi', 'Maxi II', 'Maxi III']);
    assert.deepStrictEqual(favor.LEVEL_TIERS.level_up_10, ['Papa John', 'Full Node', 'Whale', 'Sovereign', 'Cypherpunk', 'Satoshi']);

    const pleb = favor.planLevelFavor(0, 144);
    assert.strictEqual(pleb.length, 1);
    assert.strictEqual(pleb[0].name, 'Pleb');
    assert.strictEqual(pleb[0].source, 'level_up');
    assert.strictEqual(pleb[0].points, 1);
    assert.strictEqual(favor.planLevelFavor(0, 0).length, 0);
    assert.strictEqual(favor.planLevelFavor(0, 10).length, 0);
    const maxi = favor.planLevelFavor(2016, 2140);
    assert.strictEqual(maxi.length, 1);
    assert.strictEqual(maxi[0].name, 'Maxi');
    assert.strictEqual(maxi[0].points, 5);
    assert.strictEqual(maxi[0].source, 'level_up_5');
    const top = favor.planLevelFavor(133336, 210000);
    assert.strictEqual(top[top.length - 1].name, 'Satoshi');
    assert.strictEqual(top[top.length - 1].points, 10);
    assert.strictEqual(top[top.length - 1].source, 'level_up_10');
    const names = favor.levelFavorRows().map(function (row) { return row.name; });
    assert.ok(names.indexOf('Normie') === -1);
    assert.ok(names.indexOf('Curious') === -1);

    const src = fs.readFileSync(path.join(root, 'functions/src/satoshiFavor.js'), 'utf8');
    const callable = src.slice(src.indexOf('exports.contributeFavor'), src.indexOf('exports.hashForFavor'));
    assert.ok(callable.indexOf('const validLevels = LEVEL_TIERS[source]') > 0);
    assert.ok(callable.indexOf('validLevels.includes(levelName)') > 0);
    assert.ok(callable.indexOf("doc('userSfPoints')") > callable.indexOf('transaction.set(contributorRef'));
    const fn = src.slice(src.indexOf('async function creditDailyAllThree'), src.indexOf('exports.creditDailyAllThree'));
    const gate = fn.indexOf('if (contributorDoc.exists)');
    const counter = fn.indexOf("doc('userSfPoints')");
    assert.ok(gate > 0 && counter > gate);
    const personal = fn.slice(counter, counter + 400);
    assert.ok(personal.indexOf('FieldValue.increment(1)') > 0);
    assert.ok(personal.indexOf('uid: uid') > 0);
    assert.ok(personal.indexOf('updatedAt:') > 0);
    const values = src.slice(src.indexOf('const POINT_VALUES'), src.indexOf('function favorSourceAllowed'));
    assert.ok(values.indexOf("'daily_all_three': 1") > 0);
    assert.ok(values.indexOf("'level_up': 1") > 0);
    assert.ok(values.indexOf("'level_up_5': 5") > 0);
    assert.ok(values.indexOf("'level_up_10': 10") > 0);
    assert.ok(src.indexOf('const POINTS_TO_ACTIVATE = 21') > 0);

    ['awardBadge.js', 'collectionBonus.js'].forEach(function (name) {
        const body = fs.readFileSync(path.join(root, 'functions/src', name), 'utf8');
        assert.ok(body.indexOf('factionPoints: race.points') > 0, name);
        assert.ok(body.indexOf('race.headStartField') > 0, name);
        assert.ok(body.indexOf('race.headStartBase') > 0, name);
    });
});

(async function () {
    for (let i = 0; i < tests.length; i++) {
        try {
            await tests[i].fn();
            console.log('✅ ' + tests[i].name);
            passed++;
        } catch (e) {
            console.log('❌ ' + tests[i].name + ': ' + (e && e.message ? e.message : e));
            failed++;
        }
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
