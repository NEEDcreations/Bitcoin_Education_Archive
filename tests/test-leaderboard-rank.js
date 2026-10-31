#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rank = require('../functions/src/leaderboardRank');
const boards = require('../functions/src/boardSnapshots');
const questBoard = require('../functions/src/questBoard');
const predictionStats = require('../functions/src/predictionStats');
const streakBoard = require('../functions/src/streakBoard');
const { offsetDateKey } = require('../functions/src/offsetDay');

const root = path.join(__dirname, '..');
const NOW = Date.parse('2026-10-31T15:00:00Z');
const docId = { _docId: true };
const admin = {
    firestore: Object.assign(function () {}, {
        FieldPath: { documentId: function () { return docId; } }
    })
};

function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

function memoryDb(seed) {
    const store = {};
    const meter = { reads: 0 };
    Object.keys(seed || {}).forEach(function (key) {
        store[key] = JSON.parse(JSON.stringify(seed[key]));
    });

    function sortValue(doc, field) {
        if (field && field._docId) return doc.id;
        return doc.data[field];
    }

    function matched(coll, filters) {
        const prefix = coll + '/';
        return Object.keys(store).filter(function (key) {
            return key.indexOf(prefix) === 0 && key.indexOf('/', prefix.length) === -1;
        }).map(function (key) {
            return { id: key.slice(prefix.length), data: store[key] };
        }).filter(function (doc) {
            return filters.every(function (filter) {
                const val = sortValue(doc, filter.field);
                if (filter.op === '==') return val === filter.value;
                if (filter.op === '>') return val > filter.value;
                if (filter.op === '>=') return val >= filter.value;
                if (filter.op === '<') return val < filter.value;
                if (filter.op === '<=') return val <= filter.value;
                return false;
            });
        });
    }

    function cursorVals(args) {
        if (!args) return null;
        if (args.length === 1 && args[0] && args[0].id && typeof args[0].data === 'function') return [args[0].id];
        return args.slice();
    }

    function isAfter(doc, orders, args) {
        const vals = cursorVals(args);
        if (!vals) return true;
        const docVals = orders.map(function (field) { return sortValue(doc, field); });
        for (let i = 0; i < docVals.length; i++) {
            if (docVals[i] === vals[i]) continue;
            return docVals[i] > vals[i];
        }
        return false;
    }

    function rowsOf(coll, filters, orders, limitN, cursor) {
        let rows = matched(coll, filters);
        const order = orders && orders.length ? orders : [docId];
        rows.sort(function (a, b) {
            for (let i = 0; i < order.length; i++) {
                const av = sortValue(a, order[i]);
                const bv = sortValue(b, order[i]);
                if (av === bv) continue;
                if (av == null) return -1;
                if (bv == null) return 1;
                return av > bv ? 1 : -1;
            }
            return a.id > b.id ? 1 : (a.id < b.id ? -1 : 0);
        });
        if (cursor) rows = rows.filter(function (doc) { return isAfter(doc, order, cursor); });
        if (limitN != null) rows = rows.slice(0, limitN);
        return rows;
    }

    function snap(doc) {
        return {
            id: doc.id,
            exists: true,
            data: function () { return doc.data; }
        };
    }

    function makeQuery(coll, filters, orders, limitN, cursor) {
        return {
            where: function (field, op, value) {
                return makeQuery(coll, filters.concat([{ field: field, op: op, value: value }]), orders, limitN, cursor);
            },
            orderBy: function (field) {
                return makeQuery(coll, filters, orders.concat([field]), limitN, cursor);
            },
            limit: function (n) {
                return makeQuery(coll, filters, orders, n, cursor);
            },
            startAfter: function () {
                return makeQuery(coll, filters, orders, limitN, Array.prototype.slice.call(arguments));
            },
            count: function () {
                return {
                    get: async function () {
                        return { data: function () { return { count: matched(coll, filters).length }; } };
                    }
                };
            },
            get: async function () {
                const docs = rowsOf(coll, filters, orders, limitN, cursor).map(snap);
                meter.reads += docs.length;
                return {
                    empty: docs.length === 0,
                    size: docs.length,
                    docs: docs,
                    forEach: function (fn) { docs.forEach(fn); }
                };
            }
        };
    }

    return {
        get reads() { return meter.reads; },
        set reads(n) { meter.reads = n; },
        collection: function (name) {
            return {
                doc: function (id) {
                    const key = name + '/' + id;
                    return {
                        id: id,
                        path: key,
                        get: async function () {
                            meter.reads += 1;
                            if (!Object.prototype.hasOwnProperty.call(store, key)) {
                                return { id: id, exists: false, data: function () { return undefined; } };
                            }
                            return { id: id, exists: true, data: function () { return store[key]; } };
                        }
                    };
                },
                where: function (field, op, value) {
                    return makeQuery(name, [{ field: field, op: op, value: value }], [], null, null);
                }
            };
        },
        runTransaction: async function (fn) {
            const tx = {
                get: function (ref) { return ref.get(); },
                set: function (ref, data) { store[ref.path] = Object.assign({}, data); }
            };
            return fn(tx);
        }
    };
}

async function call(db, uid, data, context) {
    db.reads = 0;
    const ctx = context || { auth: { uid: uid } };
    try {
        const result = await rank.handleLeaderboardRank(db, admin, data, ctx, NOW);
        assert.ok(db.reads <= 20, 'lookup read ' + db.reads + ' docs');
        return result;
    } catch (err) {
        assert.ok(db.reads <= 20, 'lookup read ' + db.reads + ' docs');
        throw err;
    }
}

function xpProfile(id, username, points, extra) {
    const row = Object.assign({
        username: username,
        username_lower: String(username).toLowerCase(),
        points: points,
        weeklyXP: points,
        monthlyXP: points,
        email: username.toLowerCase() + '@secret.test',
        lightningAddress: username.toLowerCase() + '@getalby.com'
    }, extra || {});
    return row;
}

async function main() {
    assert.strictEqual(rank.canonBoard('price'), 'predict');
    assert.strictEqual(rank.canonPeriod('quest', 'weekly'), 'week');
    assert.strictEqual(rank.canonPeriod('streak', 'current'), 'current');
    assert.deepStrictEqual(rank.nextRate(null, 1000), { allowed: true, count: 1, windowStartMs: 1000 });
    assert.strictEqual(rank.nextRate({ count: 20, windowStartMs: 1000 }, 2000).allowed, false);
    assert.strictEqual(rank.nextRate({ count: 20, windowStartMs: 1000 }, 1000 + 60000).allowed, true);

    const profiles = {};
    const built = [];
    for (let i = 1; i <= 30; i++) {
        const name = 'P' + String(i).padStart(2, '0');
        const id = 'p' + String(i).padStart(2, '0');
        profiles['public_profiles/' + id] = xpProfile(id, name, i);
        built.push({ id: id, data: profiles['public_profiles/' + id] });
    }
    profiles['public_profiles/ban'] = xpProfile('ban', 'Banned', 50, { banned: true });
    profiles['public_profiles/ghost'] = xpProfile('ghost', 'Ghosty', 500, { ghostMode: true });
    profiles['public_profiles/ada'] = xpProfile('ada', 'Ada', 100);
    profiles['public_profiles/amy'] = xpProfile('amy', 'Amy', 100);
    profiles['public_profiles/zoe'] = xpProfile('zoe', 'Zoe', 100);
    profiles['users/ada'] = { username: 'Ada', username_lower: 'ada' };
    built.push({ id: 'ban', data: profiles['public_profiles/ban'] });
    built.push({ id: 'ghost', data: profiles['public_profiles/ghost'] });
    built.push({ id: 'ada', data: profiles['public_profiles/ada'] });
    built.push({ id: 'amy', data: profiles['public_profiles/amy'] });
    built.push({ id: 'zoe', data: profiles['public_profiles/zoe'] });

    const snap = boards.buildXpDoc(built, boards.BOARDS.xpAll, NOW);
    assert.strictEqual(snap.rows.map(function (row) { return row.username; }).indexOf('Ghosty'), -1);
    assert.strictEqual(snap.rows[0].username, 'Ada');
    assert.ok(snap.rows.some(function (row) { return row.username === 'Banned'; }));
    assert.strictEqual(snap.rows[0].email, undefined);

    const db = memoryDb(profiles);
    const low = await call(db, 'p01', { board: 'xp', period: 'alltime', username: 'P01' });
    assert.strictEqual(low.status, 'ok');
    assert.strictEqual(low.rank, 34);
    assert.strictEqual(low.score, 1);
    assert.strictEqual(low.username, 'P01');
    assert.strictEqual(JSON.stringify(low).indexOf('secret.test'), -1);
    assert.strictEqual(JSON.stringify(low).indexOf('getalby'), -1);
    assert.strictEqual(JSON.stringify(low).indexOf('"uid"'), -1);

    const ada = await call(db, 'p01', { board: 'xp', period: 'alltime', username: '@Ada' });
    const amy = await call(db, 'p01', { board: 'xp', period: 'weekly', username: 'amy' });
    const zoe = await call(db, 'p01', { board: 'xp', period: 'monthly', username: 'Zoe' });
    assert.deepStrictEqual([ada.rank, amy.rank, zoe.rank], [1, 2, 3]);
    assert.strictEqual(amy.score, 100);

    const hidden = await call(db, 'p01', { board: 'xp', period: 'alltime', username: 'Ghosty' });
    assert.strictEqual(hidden.status, 'not_found');
    assert.strictEqual(JSON.stringify(hidden).indexOf('500'), -1);
    const selfGhost = await call(db, 'ghost', { board: 'xp', period: 'alltime', me: true });
    assert.strictEqual(selfGhost.status, 'ok');
    assert.strictEqual(selfGhost.username, 'Ghosty');
    assert.ok(selfGhost.rank >= 1);

    const zero = await call(db, 'p01', { board: 'xp', period: 'alltime', username: 'Nope' });
    assert.strictEqual(zero.status, 'not_found');
    assert.strictEqual(zero.message, 'No player named @Nope');
    const mail = await call(db, 'p01', { board: 'xp', period: 'alltime', username: 'a@secret.test' });
    assert.strictEqual(mail.message, 'No player found');
    assert.strictEqual(JSON.stringify(mail).indexOf('secret.test'), -1);

    profiles['public_profiles/none'] = xpProfile('none', 'None', 0);
    const db2 = memoryDb(profiles);
    const unqualified = await call(db2, 'none', { board: 'xp', period: 'alltime', me: true });
    assert.strictEqual(unqualified.status, 'unqualified');
    assert.ok(unqualified.message.indexOf('needs XP') !== -1);

    const weekKey = questBoard.weekKey(NOW);
    const monthKey = questBoard.monthKey(NOW);
    const questSeed = {};
    function questPlayer(id, name, passes, attempts, reached, ghost) {
        questSeed['public_profiles/' + id] = {
            username: name,
            username_lower: name.toLowerCase(),
            ghostMode: ghost === true
        };
        const stats = {
            passes: passes,
            attempts: attempts,
            passedAttempts: passes,
            reachedAt: reached,
            weekKey: weekKey,
            weekPasses: passes,
            weekAttempts: attempts,
            weekPassedAttempts: passes,
            weekReachedAt: reached,
            monthKey: monthKey,
            monthPasses: passes,
            monthAttempts: attempts,
            monthPassedAttempts: passes,
            monthReachedAt: reached
        };
        questBoard.stampSortKeys(stats, name);
        stats.ghostMode = ghost === true;
        questSeed['quest_lb_stats/' + id] = stats;
        questSeed['users/' + id] = { username: name, nameKey: questBoard.nameKeyOf(name), ghostMode: ghost === true };
    }
    questPlayer('q1', 'QuestAda', 4, 8, 3000, false);
    questPlayer('q2', 'QuestBo', 4, 4, 2000, false);
    questPlayer('q3', 'QuestCy', 9, 10, 1000, false);
    questPlayer('q4', 'QuestGhost', 20, 20, 500, true);
    questPlayer('q5', 'QuestNew', 1, 2, 4000, false);
    questPlayer('q6', 'QuestMiss', 0, 8, 0, false);
    const qdb = memoryDb(questSeed);
    const qNew = await call(qdb, 'q1', { board: 'quest', period: 'alltime', username: 'QuestNew' });
    assert.strictEqual(qNew.status, 'unqualified');
    assert.strictEqual(qNew.message, '@QuestNew needs 5 attempts');
    const qMiss = await call(qdb, 'q1', { board: 'quest', period: 'week', username: 'QuestMiss' });
    assert.strictEqual(qMiss.status, 'unqualified');
    assert.ok(qMiss.message.indexOf('passed quest') !== -1);
    const qAda = await call(qdb, 'q1', { board: 'quest', period: 'month', username: 'QuestAda' });
    const qBo = await call(qdb, 'q1', { board: 'quest', period: 'month', username: 'QuestBo' });
    const qBoAll = await call(qdb, 'q1', { board: 'quest', period: 'alltime', username: 'QuestBo' });
    const qCy = await call(qdb, 'q1', { board: 'quest', period: 'alltime', username: 'QuestCy' });
    const qGhost = await call(qdb, 'q1', { board: 'quest', period: 'alltime', username: 'QuestGhost' });
    assert.strictEqual(qGhost.status, 'not_found');
    assert.strictEqual(qBoAll.status, 'unqualified');
    assert.strictEqual(qBoAll.message, '@QuestBo needs 5 attempts');
    assert.strictEqual(qCy.rank, 1);
    assert.strictEqual(qCy.score, 9);
    assert.strictEqual(qBo.rank, 2);
    assert.strictEqual(qBo.pct, 100);
    assert.strictEqual(qAda.rank, 3);
    assert.strictEqual(qAda.pct, 50);
    const qSelf = await call(qdb, 'q4', { board: 'quest', period: 'alltime', me: true });
    assert.strictEqual(qSelf.status, 'ok');
    assert.strictEqual(qSelf.rank, 1);

    const predSeed = {};
    function pred(id, name, correct, total, reached, ghost, stale) {
        predSeed['public_profiles/' + id] = {
            username: name,
            username_lower: name.toLowerCase(),
            ghostMode: ghost === true
        };
        const accuracy = predictionStats.accuracyOf(correct, total);
        const week = predictionStats.weekKey(NOW);
        predSeed['prediction_stats/' + id] = {
            predCorrect: correct,
            predTotal: total,
            predAccuracy: accuracy,
            reachedAt: reached,
            reachedSort: reached,
            ghostMode: ghost === true,
            weekKey: stale ? '1999-W01' : week,
            weekCorrect: correct,
            weekTotal: total,
            weekAccuracy: accuracy,
            weekReachedAt: reached,
            weekReachedSort: reached,
            monthKey: predictionStats.monthKey(NOW),
            monthCorrect: correct,
            monthTotal: total,
            monthAccuracy: accuracy,
            monthReachedAt: reached,
            monthReachedSort: reached
        };
    }
    pred('a', 'PredAda', 8, 10, 5000, false, false);
    pred('b', 'PredBo', 16, 20, 4000, false, false);
    pred('c', 'PredCy', 9, 10, 1000, false, false);
    pred('d', 'PredDee', 8, 10, 2000, false, false);
    pred('g', 'PredGhost', 20, 20, 100, true, false);
    pred('s', 'PredStale', 4, 4, 100, false, true);
    predSeed['prediction_stats/s'].weekTotal = 20;
    predSeed['prediction_stats/s'].weekCorrect = 20;
    predSeed['prediction_stats/s'].weekAccuracy = predictionStats.accuracyOf(20, 20);
    pred('n', 'PredNew', 2, 2, 100, false, false);
    const pdb = memoryDb(predSeed);
    const predNew = await call(pdb, 'a', { board: 'price', period: 'alltime', username: 'PredNew' });
    assert.strictEqual(predNew.status, 'unqualified');
    assert.strictEqual(predNew.message, '@PredNew needs 10 predictions');
    const weekNew = await call(pdb, 'n', { board: 'predict', period: 'weekly', me: true });
    assert.strictEqual(weekNew.status, 'unqualified');
    assert.ok(weekNew.message.indexOf('needs 5 predictions') !== -1);
    const predBo = await call(pdb, 'a', { board: 'predict', period: 'alltime', username: 'PredBo' });
    const predCy = await call(pdb, 'a', { board: 'predict', period: 'alltime', username: 'PredCy' });
    const predDee = await call(pdb, 'a', { board: 'predict', period: 'alltime', username: 'PredDee' });
    const predAda = await call(pdb, 'a', { board: 'predict', period: 'alltime', username: 'PredAda' });
    const predGhost = await call(pdb, 'a', { board: 'predict', period: 'weekly', username: 'PredGhost' });
    const predStale = await call(pdb, 'a', { board: 'predict', period: 'weekly', username: 'PredStale' });
    assert.strictEqual(predGhost.status, 'not_found');
    assert.strictEqual(predStale.status, 'unqualified');
    assert.deepStrictEqual([predCy.rank, predBo.rank, predDee.rank, predAda.rank], [1, 2, 3, 4]);
    assert.strictEqual(predCy.score, 90);
    assert.strictEqual(predCy.pct, 90);
    assert.strictEqual(predBo.pct, 80);

    const today = offsetDateKey(NOW);
    const yesterday = streakBoard.shiftDateKey(today, -1);
    const twoAgo = streakBoard.shiftDateKey(today, -2);
    const old = streakBoard.shiftDateKey(today, -10);
    const streakSeed = {};
    function streakUser(id, name, best, streak, lastVisit, extra) {
        const row = Object.assign({
            username: name,
            username_lower: name.toLowerCase(),
            bestStreak: best,
            streak: streak,
            lastVisit: lastVisit,
            bestStreakAt: extra && extra.bestStreakAt || 0,
            streakReachedAt: extra && extra.streakReachedAt || 0,
            streakFreezes: extra && extra.streakFreezes || 0,
            ghostMode: !!(extra && extra.ghost)
        }, {});
        streakSeed['users/' + id] = row;
        streakSeed['public_profiles/' + id] = {
            username: name,
            username_lower: name.toLowerCase(),
            ghostMode: row.ghostMode,
            bestStreak: best,
            streak: streak
        };
    }
    streakUser('s1', 'StreakAda', 5, 4, today, { bestStreakAt: 1000, streakReachedAt: 3000 });
    streakUser('s2', 'StreakBo', 9, 8, today, { bestStreakAt: 2000, streakReachedAt: 2000 });
    streakUser('s3', 'StreakCy', 2, 12, old, { bestStreakAt: 50, streakReachedAt: 4000 });
    streakUser('s4', 'StreakDee', 5, 1, yesterday, { bestStreakAt: 5000, streakReachedAt: 1000 });
    streakUser('s5', 'StreakGhost', 80, 80, today, { ghost: true, bestStreakAt: 1, streakReachedAt: 1 });
    streakUser('s6', 'StreakOld', 3, 2, old, { streakReachedAt: 1 });
    streakUser('s7', 'StreakFreeze', 1, 6, twoAgo, { streakFreezes: 1, streakReachedAt: 2500 });
    streakUser('s8', 'StreakMelt', 4, 4, twoAgo, { streakFreezes: 0, streakReachedAt: 1 });
    const sdb = memoryDb(streakSeed);
    const allCy = await call(sdb, 's1', { board: 'streak', period: 'alltime', username: 'StreakCy' });
    const allBo = await call(sdb, 's1', { board: 'streak', period: 'alltime', username: 'StreakBo' });
    const allAda = await call(sdb, 's1', { board: 'streak', period: 'alltime', username: 'StreakAda' });
    const allDee = await call(sdb, 's1', { board: 'streak', period: 'alltime', username: 'StreakDee' });
    const allGhost = await call(sdb, 's1', { board: 'streak', period: 'alltime', username: 'StreakGhost' });
    assert.strictEqual(allGhost.status, 'not_found');
    assert.strictEqual(allCy.rank, 1);
    assert.strictEqual(allCy.score, 12);
    assert.strictEqual(allBo.rank, 2);
    assert.strictEqual(allAda.rank, 4);
    assert.strictEqual(allDee.rank, 5);
    const curBo = await call(sdb, 's1', { board: 'streak', period: 'current', username: 'StreakBo' });
    const curFreeze = await call(sdb, 's1', { board: 'streak', period: 'current', username: 'StreakFreeze' });
    const curAda = await call(sdb, 's1', { board: 'streak', period: 'current', username: 'StreakAda' });
    const curOld = await call(sdb, 's1', { board: 'streak', period: 'current', username: 'StreakOld' });
    const curMelt = await call(sdb, 's1', { board: 'streak', period: 'current', username: 'StreakMelt' });
    assert.strictEqual(curOld.status, 'unqualified');
    assert.ok(curOld.message.indexOf('no current streak') !== -1);
    assert.strictEqual(curMelt.status, 'unqualified');
    assert.strictEqual(curBo.rank, 1);
    assert.strictEqual(curBo.score, 8);
    assert.strictEqual(curFreeze.rank, 2);
    assert.strictEqual(curAda.score, 4);
    assert.ok(curAda.rank > curFreeze.rank);

    const names = {};
    names['public_profiles/me'] = xpProfile('me', 'Finder', 3);
    for (let i = 0; i < 10; i++) {
        const name = 'Ab' + i;
        names['public_profiles/ab' + i] = xpProfile('ab' + i, name, 1);
    }
    names['public_profiles/abg'] = xpProfile('abg', 'Abghost', 9, { ghostMode: true });
    const ndb = memoryDb(names);
    const missing = await call(ndb, 'me', { board: 'xp', period: 'alltime', username: 'ab' });
    assert.strictEqual(missing.status, 'not_found');
    assert.ok(missing.suggestions && missing.suggestions.length === 8);
    missing.suggestions.forEach(function (row) {
        assert.strictEqual(row.username.indexOf('Abghost'), -1);
        assert.strictEqual(Object.keys(row).join(','), 'username');
    });

    const rateDb = memoryDb({ 'public_profiles/me': xpProfile('me', 'Finder', 3), 'users/me': { username: 'Finder' } });
    for (let i = 0; i < 20; i++) {
        const row = await call(rateDb, 'me', { board: 'xp', period: 'alltime', me: true });
        assert.strictEqual(row.status, 'ok');
    }
    let limited = null;
    try {
        await call(rateDb, 'me', { board: 'xp', period: 'alltime', me: true });
    } catch (err) {
        limited = err;
    }
    assert.ok(limited);
    assert.strictEqual(limited.code, 'resource-exhausted');

    const anonDb = memoryDb({ 'public_profiles/guest': xpProfile('guest', 'Guest', 4), 'users/guest': { username: 'Guest' } });
    const anonCtx = { auth: { uid: 'guest', token: { firebase: { sign_in_provider: 'anonymous' } } } };
    for (let i = 0; i < rank.RATE_ANON_MAX; i++) {
        const row = await call(anonDb, 'guest', { board: 'xp', period: 'alltime', me: true }, anonCtx);
        assert.strictEqual(row.status, 'ok');
    }
    let anonLimited = null;
    try {
        await call(anonDb, 'guest', { board: 'xp', period: 'alltime', me: true }, anonCtx);
    } catch (err) {
        anonLimited = err;
    }
    assert.ok(anonLimited);
    assert.strictEqual(anonLimited.code, 'resource-exhausted');

    let signedOut = null;
    try {
        await rank.handleLeaderboardRank(memoryDb({}), admin, { board: 'xp' }, {}, NOW);
    } catch (err) {
        signedOut = err;
    }
    assert.strictEqual(signedOut.code, 'unauthenticated');

    const tieSeed = {};
    function tieQuest(id, name, passes, attempts, passed, ghost) {
        tieSeed['public_profiles/' + id] = {
            username: name,
            username_lower: name.toLowerCase(),
            ghostMode: ghost === true
        };
        const stats = {
            passes: passes,
            attempts: attempts,
            passedAttempts: passed,
            reachedAt: 0,
            weekKey: questBoard.weekKey(NOW),
            weekPasses: passes,
            weekAttempts: attempts,
            weekPassedAttempts: passed,
            weekReachedAt: 0,
            monthKey: questBoard.monthKey(NOW),
            monthPasses: passes,
            monthAttempts: attempts,
            monthPassedAttempts: passed,
            monthReachedAt: 0
        };
        questBoard.stampSortKeys(stats, name);
        stats.ghostMode = ghost === true;
        tieSeed['quest_lb_stats/' + id] = stats;
    }
    tieQuest('low', 'FiveSeven', 5, 7, 5, false);
    tieQuest('high', 'SixEight', 5, 8, 6, false);
    tieQuest('sur', 'Suraz2', 3, 5, 3, false);
    tieQuest('yuv', 'Yuv_s', 3, 5, 3, false);
    tieQuest('g', 'AaaGhost', 3, 5, 3, true);
    const tieDb = memoryDb(tieSeed);
    const six = await call(tieDb, 'low', { board: 'quest', period: 'alltime', username: 'SixEight' });
    const five = await call(tieDb, 'low', { board: 'quest', period: 'alltime', username: 'FiveSeven' });
    const sur = await call(tieDb, 'low', { board: 'quest', period: 'alltime', username: 'Suraz2' });
    const yuv = await call(tieDb, 'low', { board: 'quest', period: 'alltime', username: 'Yuv_s' });
    const hiddenName = await call(tieDb, 'low', { board: 'quest', period: 'alltime', username: 'AaaGhost' });
    assert.strictEqual(hiddenName.status, 'not_found');
    assert.ok(six.rank < five.rank, '6/8 outranks 5/7');
    assert.ok(questBoard.passRateOf(6, 8) > questBoard.passRateOf(5, 7));
    assert.ok(sur.rank < yuv.rank, 'name tiebreak');
    const boardOrder = questBoard.selectBoard([
        { uid: 'low', username: 'FiveSeven', passes: 5, attempts: 7, passedAttempts: 5, reachedAt: 0 },
        { uid: 'high', username: 'SixEight', passes: 5, attempts: 8, passedAttempts: 6, reachedAt: 0 },
        { uid: 'sur', username: 'Suraz2', passes: 3, attempts: 5, passedAttempts: 3, reachedAt: 0 },
        { uid: 'yuv', username: 'Yuv_s', passes: 3, attempts: 5, passedAttempts: 3, reachedAt: 0 },
        { uid: 'g', username: 'AaaGhost', ghostMode: true, passes: 3, attempts: 5, passedAttempts: 3, reachedAt: 0 }
    ], 'alltime').map(function (row) { return row.username; });
    assert.deepStrictEqual(boardOrder, ['SixEight', 'FiveSeven', 'Suraz2', 'Yuv_s']);
    assert.deepStrictEqual([six.rank, five.rank, sur.rank, yuv.rank], [1, 2, 3, 4]);

    const streakTie = {};
    const tieDay = offsetDateKey(NOW);
    function tieStreak(id, name, ghost) {
        streakTie['users/' + id] = {
            username: name,
            nameKey: questBoard.nameKeyOf(name),
            streak: 4,
            bestStreak: 4,
            lastVisit: tieDay,
            streakReachedAt: 0,
            bestStreakAt: 0,
            ghostMode: ghost === true
        };
        streakTie['public_profiles/' + id] = {
            username: name,
            username_lower: name.toLowerCase(),
            ghostMode: ghost === true
        };
    }
    tieStreak('azi', 'Azi_Za', false);
    tieStreak('astro', 'AstroFounder32', false);
    tieStreak('gg', 'Aaa', true);
    const streakTieDb = memoryDb(streakTie);
    const astro = await call(streakTieDb, 'azi', { board: 'streak', period: 'current', username: 'AstroFounder32' });
    const azi = await call(streakTieDb, 'azi', { board: 'streak', period: 'current', username: 'Azi_Za' });
    const streakNames = streakBoard.selectBoard([
        { uid: 'azi', username: 'Azi_Za', current: 4, streakReachedAt: 0, ghostMode: false },
        { uid: 'astro', username: 'AstroFounder32', current: 4, streakReachedAt: 0, ghostMode: false },
        { uid: 'gg', username: 'Aaa', current: 4, streakReachedAt: 0, ghostMode: true }
    ], 'current').map(function (row) { return row.username; });
    assert.deepStrictEqual(streakNames, ['AstroFounder32', 'Azi_Za']);
    assert.deepStrictEqual([astro.rank, azi.rank], [1, 2]);

    const cycle = {};
    const cycleDay = offsetDateKey(NOW);
    function cycleUser(id, name, best, streak, bestAt, reachedAt, lastVisit) {
        cycle['users/' + id] = {
            username: name,
            nameKey: questBoard.nameKeyOf(name),
            bestStreak: best,
            streak: streak,
            lastVisit: lastVisit || cycleDay,
            bestStreakAt: bestAt,
            streakReachedAt: reachedAt,
            streakFreezes: 0,
            ghostMode: false
        };
        cycle['public_profiles/' + id] = {
            username: name,
            username_lower: name.toLowerCase(),
            ghostMode: false
        };
    }
    const lapsed = streakBoard.shiftDateKey(cycleDay, -10);
    cycleUser('cee', 'Cee', 5, 5, 1, 1);
    cycleUser('aaa', 'Aaa', 5, 5, 2, 2);
    cycleUser('bee', 'Bee', 5, 5, 0, 0);
    cycleUser('best', 'Best', 5, 1, 50, 50, lapsed);
    cycleUser('via', 'Via', 2, 5, 100, 100, lapsed);
    cycleUser('miss', 'Miss', 5, 1, 0, 9, lapsed);
    const cycleDb = memoryDb(cycle);
    const cycleRows = [
        { uid: 'cee', username: 'Cee', nameKey: 'cee', best: 5, current: 5, bestStreakAt: 1, streakReachedAt: 1 },
        { uid: 'aaa', username: 'Aaa', nameKey: 'aaa', best: 5, current: 5, bestStreakAt: 2, streakReachedAt: 2 },
        { uid: 'bee', username: 'Bee', nameKey: 'bee', best: 5, current: 5, bestStreakAt: 0, streakReachedAt: 0 }
    ];
    const cycleBoard = streakBoard.selectBoard(cycleRows, 'current').map(function (row) { return row.username; });
    assert.deepStrictEqual(cycleBoard, ['Cee', 'Aaa', 'Bee']);
    const ceeRank = await call(cycleDb, 'cee', { board: 'streak', period: 'current', username: 'Cee' });
    const aaaRank = await call(cycleDb, 'cee', { board: 'streak', period: 'current', username: 'Aaa' });
    const beeRank = await call(cycleDb, 'cee', { board: 'streak', period: 'current', username: 'Bee' });
    assert.deepStrictEqual([ceeRank.rank, aaaRank.rank, beeRank.rank], [1, 2, 3]);
    const allBest = await call(cycleDb, 'cee', { board: 'streak', period: 'alltime', username: 'Best' });
    const allVia = await call(cycleDb, 'cee', { board: 'streak', period: 'alltime', username: 'Via' });
    const allMiss = await call(cycleDb, 'cee', { board: 'streak', period: 'alltime', username: 'Miss' });
    const allCee = await call(cycleDb, 'cee', { board: 'streak', period: 'alltime', username: 'Cee' });
    assert.ok(allBest.rank < allVia.rank);
    assert.ok(allVia.rank < allMiss.rank);
    assert.ok(allCee.rank < allBest.rank);
    assert.strictEqual(allCee.score, 5);

    const indexes = JSON.parse(read('firestore.indexes.json'));
    function hasIndex(coll, fields) {
        return indexes.indexes.some(function (entry) {
            if (entry.collectionGroup !== coll) return false;
            const paths = (entry.fields || []).map(function (field) { return field.fieldPath; });
            return paths.join(',') === fields.join(',');
        });
    }
    // Firestore, with no orderBy, sorts range fields by name and appends __name__.
    // This is independent of indexFields, so a helper that keeps filter order fails.
    function firestoreIndex(clauses) {
        const equality = [];
        const range = [];
        let documentId = false;
        const seen = {};
        clauses.forEach(function (clause) {
            const field = clause[0];
            if (seen[field]) return;
            seen[field] = true;
            if (clause[1] === '==') equality.push(field);
            else if (field === '__name__') documentId = true;
            else range.push(field);
        });
        range.sort();
        if (documentId) range.push('__name__');
        return equality.concat(range);
    }
    assert.deepStrictEqual(rank.indexFields([['passes', '>', 1], ['attempts', '>=', 5]]), ['attempts', 'passes']);
    assert.deepStrictEqual(rank.indexFields([['streak', '==', 3], ['bestStreakAt', '>', 0], ['bestStreak', '<', 3]]), ['streak', 'bestStreak', 'bestStreakAt']);
    assert.deepStrictEqual(
        rank.indexFields([['streak', '==', 3], ['bestStreakAt', '==', 1], ['nameKey', '==', 'a'], ['bestStreak', '<', 3], ['__name__', '<', 'u']]),
        ['streak', 'bestStreakAt', 'nameKey', 'bestStreak', '__name__']
    );
    rank.queryCatalog(NOW).forEach(function (row) {
        const shapes = [row[1], rank.ghostClauses(row[1])];
        shapes.forEach(function (clauses) {
            assert.ok(rank.clausesServable(clauses), 'unservable ' + row[0] + ' ' + JSON.stringify(clauses));
            const fields = firestoreIndex(clauses);
            assert.deepStrictEqual(rank.indexFields(clauses), fields, row[0] + ' ' + JSON.stringify(clauses));
            if (fields.length < 2) return;
            assert.ok(hasIndex(row[0], fields), 'missing index ' + row[0] + ' ' + fields.join(','));
        });
    });
    rank.INDEX_SPECS.forEach(function (spec) {
        assert.ok(hasIndex(spec[0], spec[1]), 'missing index ' + spec[0] + ' ' + spec[1].join(','));
    });
    assert.ok(hasIndex('quest_lb_stats', ['attempts', 'passes']));
    assert.ok(hasIndex('quest_lb_stats', ['ghostMode', 'attempts', 'passes']));
    assert.ok(hasIndex('users', ['streak', 'bestStreak', 'bestStreakAt']));
    assert.ok(hasIndex('users', ['ghostMode', 'streak', 'bestStreak', 'bestStreakAt']));
    assert.ok(hasIndex('users', ['streak', 'bestStreakAt', 'bestStreak', 'nameKey']));
    assert.ok(hasIndex('users', ['ghostMode', 'streak', 'bestStreakAt', 'bestStreak', 'nameKey']));
    assert.ok(hasIndex('users', ['lastVisit', 'streak', 'streakReachedAt', 'nameKey', 'streakFreezes']));
    assert.ok(hasIndex('users', ['ghostMode', 'lastVisit', 'streak', 'streakReachedAt', 'nameKey', 'streakFreezes']));

    const src = read('functions/src/leaderboardRank.js');
    const ranking = read('ranking.js');
    const index = read('functions/index.js');
    assert.ok(src.indexOf('enforceAppCheck: true') !== -1);
    assert.strictEqual(src.indexOf('queryDocs'), -1);
    assert.strictEqual(src.indexOf('4000'), -1);
    assert.strictEqual(rank.RATE_ANON_MAX, 5);
    assert.ok(index.indexOf('exports.leaderboardRank') !== -1);
    assert.ok(ranking.indexOf("httpsCallable('leaderboardRank')") !== -1);
    assert.strictEqual(ranking.indexOf("httpsCallable('searchUsers')"), -1);
    assert.ok(ranking.indexOf("lbRankInput-' + board") !== -1);
    ['xp', 'quest', 'predict', 'streak'].forEach(function (board) {
        assert.ok(ranking.indexOf("_lbRankBox('" + board + "')") !== -1, board);
    });
    assert.ok(ranking.indexOf('Find me') !== -1);
    assert.ok(read('sw.js').indexOf("const CACHE_NAME = 'btc-archive-v2451'") !== -1);
    assert.strictEqual(read('index.html'), read('404.html'));

    const ordered = questBoard.selectBoard([
        { username: 'QuestAda', passes: 4, attempts: 8, passedAttempts: 4, reachedAt: 3000 },
        { username: 'QuestBo', passes: 4, attempts: 4, passedAttempts: 4, reachedAt: 2000 },
        { username: 'QuestCy', passes: 9, attempts: 10, passedAttempts: 9, reachedAt: 1000 },
        { username: 'QuestGhost', ghostMode: true, passes: 20, attempts: 20, passedAttempts: 20, reachedAt: 500 }
    ], 'month');
    assert.deepStrictEqual(ordered.map(function (row) { return row.username; }), ['QuestCy', 'QuestBo', 'QuestAda']);
    assert.deepStrictEqual(ordered.map(function (row) { return row.rank; }), [qCy.rank, qBo.rank, qAda.rank]);

    console.log('leaderboard rank tests passed');
}

main().catch(function (err) {
    console.error(err);
    process.exit(1);
});
