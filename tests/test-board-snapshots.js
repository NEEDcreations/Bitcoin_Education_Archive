#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const boards = require('../functions/src/boardSnapshots');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

let passed = 0;
let failed = 0;
const queue = [];
function test(name, fn) {
    queue.push({ name: name, fn: fn });
}

function profile(id, data) {
    return { id: id, data: data };
}

test('ghosts are dropped, banned players stay, and emails are not stored', () => {
    const rows = [
        profile('ghost', { username: 'Ghost', points: 99999, ghostMode: true, email: 'ghost@secret.test', banned: false }),
        profile('ban1', { username: 'Banned', points: 5000, banned: true, email: 'banned@secret.test', faction: 'honey_badgers', earnedHidden: ['cert_scholar'], lightningAddress: 'ban1@getalby.com' }),
        profile('ada', { username: 'Ada', points: 100, email: 'ada@secret.test' }),
        profile('zero', { username: 'Zero', points: 0, email: 'zero@secret.test' })
    ];
    const doc = boards.buildXpDoc(rows, boards.BOARDS.xpAll, 1000);
    const names = doc.rows.map(function (r) { return r.username; });
    assert.deepStrictEqual(names, ['Banned', 'Ada']);
    assert.strictEqual(doc.rows[0].rank, 1);
    assert.strictEqual(doc.rows[0].uid, 'ban1');
    assert.strictEqual(doc.rows[0].value, 5000);
    assert.strictEqual(doc.rows[0].certScholar, true);
    assert.strictEqual(doc.rows[0].lightningAddress, 'ban1@getalby.com');
    assert.strictEqual(doc.rows[0].banned, undefined);
    assert.strictEqual(doc.rows[0].email, undefined);
    const raw = JSON.stringify(doc);
    assert.strictEqual(raw.indexOf('secret.test'), -1);
    assert.strictEqual(raw.indexOf('email'), -1);
    assert.strictEqual(doc.rankBeyond25.exact, false);
    assert.strictEqual(doc.rankBeyond25.label, '25+');
    assert.ok(doc.rankBeyond25.reason.indexOf('not stored') !== -1);
});

test('each board stops at 25 and keeps public display fields only', () => {
    const rows = [];
    for (let i = 0; i < 40; i++) {
        rows.push(profile('u' + i, {
            username: 'N' + String(i).padStart(2, '0'),
            points: i + 1,
            weeklyXP: i + 1,
            monthlyXP: 40 - i,
            email: 'n' + i + '@secret.test',
            profilePic: 'https://example.com/a.png'
        }));
    }
    const all = boards.buildXpDoc(rows, boards.BOARDS.xpAll, 50);
    assert.strictEqual(all.rows.length, 25);
    assert.strictEqual(all.rows[0].username, 'N39');
    assert.strictEqual(all.rows[0].value, 40);
    assert.strictEqual(all.rows[24].value, 16);
    assert.strictEqual(all.intervalMs, 15 * 60 * 1000);
    const week = boards.buildXpDoc(rows, boards.BOARDS.xpWeek, 50);
    assert.strictEqual(week.intervalMs, 10 * 60 * 1000);
    assert.strictEqual(week.rows[0].value, 40);
    const month = boards.buildXpDoc(rows, boards.BOARDS.xpMonth, 50);
    assert.strictEqual(month.rows[0].username, 'N00');
    assert.strictEqual(month.rows[0].value, 40);
    const packed = JSON.stringify(all.rows[0]);
    ['email', 'bio', 'known_ips', 'fingerprint'].forEach(function (field) {
        assert.strictEqual(packed.indexOf(field), -1, field);
    });
});

test('pvp keeps wins and losses and sorts by win rate', () => {
    const people = [
        profile('low', { username: 'Low', pvpWins: 1, pvpLosses: 9, email: 'low@secret.test' }),
        profile('high', { username: 'High', pvpWins: 9, pvpLosses: 1 }),
        profile('ghost', { username: 'Ghost', pvpWins: 100, pvpLosses: 0, ghostMode: true }),
        profile('banned', { username: 'Banned', pvpWins: 3, pvpLosses: 1, banned: true })
    ];
    const doc = boards.buildPvpDoc(people, people, 80);
    assert.deepStrictEqual(doc.rows.map(function (r) { return r.username; }), ['High', 'Banned', 'Low']);
    assert.strictEqual(doc.rows[0].wins, 9);
    assert.strictEqual(doc.rows[0].losses, 1);
    assert.ok(doc.rows[0].value > doc.rows[2].value);
    assert.strictEqual(JSON.stringify(doc).indexOf('secret.test'), -1);
    assert.strictEqual(doc.intervalMs, 15 * 60 * 1000);
});

test('favor and raid drop ghosts and cap at 25', () => {
    const rows = [];
    for (let i = 0; i < 30; i++) {
        rows.push(profile('h' + i, {
            username: 'H' + i,
            sfTotalHashes: (i + 1) * 10,
            sfBlocksFound: i === 29 ? 2 : 0,
            sfBestHash: 1000 - i,
            firstHashAt: 1700000000000,
            raidDamageAllTime: i + 1,
            email: 'h' + i + '@secret.test'
        }));
    }
    rows.push(profile('gh', { username: 'Ghost', sfTotalHashes: 999999, raidDamageAllTime: 999999, ghostMode: true, email: 'g@secret.test' }));
    const active = boards.buildFavorDoc(rows, 90, true);
    const idle = boards.buildFavorDoc(rows, 90, false);
    assert.strictEqual(active.rows.length, 25);
    assert.strictEqual(active.favorActive, true);
    assert.strictEqual(active.intervalMs, 5 * 60 * 1000);
    assert.strictEqual(idle.intervalMs, 30 * 60 * 1000);
    assert.strictEqual(idle.favorActive, false);
    assert.strictEqual(active.rows[0].username, 'H29');
    assert.strictEqual(active.rows[0].blocks, 2);
    assert.strictEqual(active.rows[0].bestHash, 971);
    const raid = boards.buildRaidDoc(rows, 90);
    assert.strictEqual(raid.rows.length, 25);
    assert.strictEqual(raid.rows[0].value, 30);
    assert.strictEqual(raid.rows.some(function (r) { return r.username === 'Ghost'; }), false);
    assert.strictEqual(JSON.stringify(raid).indexOf('secret.test'), -1);
});

test('dirty stamps follow the field that changed and ignore lastSeen', () => {
    const before = { username: 'Ada', points: 10, weeklyXP: 1, lastSeen: 1 };
    function next(extra) {
        const copy = Object.assign({}, before);
        Object.keys(extra).forEach(function (key) { copy[key] = extra[key]; });
        return copy;
    }
    assert.deepStrictEqual(boards.dirtyKeys(before, next({ points: 11 })), ['xpAll']);
    assert.deepStrictEqual(boards.dirtyKeys(before, next({ weeklyXP: 4, lastSeen: 9 })), ['xpWeek']);
    assert.deepStrictEqual(boards.dirtyKeys(before, next({ monthlyXP: 2, lastSeen: 9 })), ['xpMonth']);
    assert.deepStrictEqual(boards.dirtyKeys(before, next({ pvpWins: 1 })), ['pvp']);
    assert.deepStrictEqual(boards.dirtyKeys(before, next({ sfTotalHashes: 5 })), ['favor']);
    assert.deepStrictEqual(boards.dirtyKeys(before, next({ raidDamageAllTime: 3 })), ['raid']);
    assert.deepStrictEqual(boards.dirtyKeys(before, next({ lastSeen: 99, isOnline: false })), []);
    assert.strictEqual(boards.dirtyPatch(before, next({ lastSeen: 99 }), 5), null);
    const renamed = boards.dirtyKeys(before, { username: 'Bea', points: 10 });
    assert.strictEqual(renamed.length, boards.BOARD_KEYS.length);
    assert.strictEqual(boards.dirtyKeys(null, { points: 1 }).length, boards.BOARD_KEYS.length);
    const patch = boards.dirtyPatch(before, next({ points: 12 }), 42);
    assert.deepStrictEqual(patch, { xpAll: 42 });
});

test('a board rebuilds only after its interval and only when the marker moved', () => {
    const now = 1e7;
    assert.strictEqual(boards.shouldRebuild({
        now: now, updatedAt: now - 60 * 1000, intervalMs: 15 * 60 * 1000,
        hasRows: true, dirtyAt: now, sourceRev: 1
    }).reason, 'interval');
    assert.strictEqual(boards.shouldRebuild({
        now: now, updatedAt: now - 20 * 60 * 1000, intervalMs: 15 * 60 * 1000,
        hasRows: true, dirtyAt: 50, sourceRev: 50
    }).reason, 'clean');
    assert.strictEqual(boards.shouldRebuild({
        now: now, updatedAt: now - 20 * 60 * 1000, intervalMs: 15 * 60 * 1000,
        hasRows: true, dirtyAt: 80, sourceRev: 50
    }).reason, 'dirty');
    assert.strictEqual(boards.shouldRebuild({ hasRows: false, force: false }).reason, 'missing');
    assert.strictEqual(boards.shouldRebuild({ force: true, hasRows: true }).reason, 'force');
    assert.strictEqual(boards.favorIntervalMs(true), 5 * 60 * 1000);
    assert.strictEqual(boards.favorIntervalMs(false), 30 * 60 * 1000);
});

test('a clean marker still rebuilds once the snapshot is older than its max age', () => {
    const now = 20 * 60 * 60 * 1000;
    assert.strictEqual(boards.BOARDS.xpWeek.maxAgeMs, 60 * 60 * 1000);
    assert.strictEqual(boards.BOARDS.xpMonth.maxAgeMs, 60 * 60 * 1000);
    ['xpAll', 'pvp', 'favor', 'raid'].forEach(function (key) {
        assert.strictEqual(boards.BOARDS[key].maxAgeMs, 6 * 60 * 60 * 1000, key);
    });
    const weekYoung = boards.shouldRebuild({
        now: now,
        updatedAt: now - 59 * 60 * 1000,
        intervalMs: 10 * 60 * 1000,
        maxAgeMs: boards.BOARDS.xpWeek.maxAgeMs,
        hasRows: true,
        dirtyAt: 10,
        sourceRev: 10
    });
    assert.strictEqual(weekYoung.reason, 'clean');
    const weekOld = boards.shouldRebuild({
        now: now,
        updatedAt: now - 60 * 60 * 1000,
        intervalMs: 10 * 60 * 1000,
        maxAgeMs: boards.BOARDS.xpWeek.maxAgeMs,
        hasRows: true,
        dirtyAt: 10,
        sourceRev: 10
    });
    assert.strictEqual(weekOld.rebuild, true);
    assert.strictEqual(weekOld.reason, 'max-age');
    const allYoung = boards.shouldRebuild({
        now: now,
        updatedAt: now - 2 * 60 * 60 * 1000,
        intervalMs: 15 * 60 * 1000,
        maxAgeMs: boards.BOARDS.xpAll.maxAgeMs,
        hasRows: true,
        dirtyAt: 0,
        sourceRev: 5
    });
    assert.strictEqual(allYoung.reason, 'clean');
    const allOld = boards.shouldRebuild({
        now: now,
        updatedAt: now - 6 * 60 * 60 * 1000,
        intervalMs: 15 * 60 * 1000,
        maxAgeMs: boards.BOARDS.xpAll.maxAgeMs,
        hasRows: true,
        dirtyAt: 0,
        sourceRev: 5
    });
    assert.strictEqual(allOld.reason, 'max-age');
});

test('an instance skips a dirty stamp it already wrote in the last 60 seconds', () => {
    const memory = {};
    const first = boards.throttleDirtyPatch({ xpAll: 1000, xpWeek: 1000 }, 1000, memory);
    assert.deepStrictEqual(first, { xpAll: 1000, xpWeek: 1000 });
    memory.xpAll = 1000;
    memory.xpWeek = 1000;
    const soon = boards.throttleDirtyPatch({ xpAll: 30000, pvp: 30000 }, 30000, memory);
    assert.deepStrictEqual(soon, { pvp: 30000 });
    const later = boards.throttleDirtyPatch({ xpAll: 61001 }, 1000 + boards.STAMP_THROTTLE_MS, memory);
    assert.deepStrictEqual(later, { xpAll: 61001 });
    assert.strictEqual(boards.STAMP_THROTTLE_MS, 60 * 1000);
    assert.strictEqual(boards.throttleDirtyPatch(null, 1000, memory), null);
});

function makeDb(seed) {
    const state = { reads: 0, profileReads: 0, writes: 0, docs: Object.assign({}, seed.docs || {}), profiles: seed.profiles || [] };
    function query(limitN) {
        return {
            where: function () { return query(limitN); },
            orderBy: function () { return query(limitN); },
            limit: function (n) { return query(n); },
            get: async function () {
                const rows = state.profiles.slice(0, limitN || state.profiles.length);
                state.reads += rows.length;
                state.profileReads += rows.length;
                return {
                    forEach: function (fn) {
                        rows.forEach(function (row) {
                            fn({ id: row.id, data: function () { return row.data; } });
                        });
                    }
                };
            }
        };
    }
    function docRef(key) {
        return {
            get: async function () {
                state.reads += 1;
                const data = state.docs[key];
                return { exists: data != null, data: function () { return data; } };
            },
            set: async function (data) {
                state.writes += 1;
                state.docs[key] = data;
            }
        };
    }
    return {
        state: state,
        collection: function (name) {
            return {
                doc: function (id) { return docRef(name + '/' + id); },
                where: function () { return query(null); }
            };
        }
    };
}

test('opening a fresh board costs one snapshot read and a cold rebuild reads the top source page once', async () => {
    const now = 5000000;
    const profiles = [];
    for (let i = 0; i < 80; i++) profiles.push(profile('p' + i, { username: 'P' + i, points: 80 - i, weeklyXP: i + 1 }));
    const fresh = makeDb({
        docs: {
            'stats/lb_xp_alltime': { updatedAt: now - 60 * 1000, sourceRev: 10, rows: [{ rank: 1, uid: 'p0', username: 'P0', value: 80 }], intervalMs: 15 * 60 * 1000 }
        }
    });
    const skipped = await boards.refreshBoard(fresh, 'xpAll', now, {});
    assert.strictEqual(skipped.reason, 'interval');
    assert.strictEqual(fresh.state.reads, 1);
    assert.strictEqual(fresh.state.profileReads, 0);
    assert.strictEqual(fresh.state.writes, 0);

    const clean = makeDb({
        docs: {
            'stats/lb_xp_alltime': { updatedAt: now - 20 * 60 * 1000, sourceRev: 10, rows: [{ rank: 1 }], intervalMs: 15 * 60 * 1000 },
            'stats/lb_dirty': { xpAll: 10 }
        },
        profiles: profiles
    });
    const cleanResult = await boards.refreshBoard(clean, 'xpAll', now, {});
    assert.strictEqual(cleanResult.reason, 'clean');
    assert.strictEqual(clean.state.profileReads, 0);
    assert.strictEqual(clean.state.reads, 2);

    const aged = makeDb({
        docs: {
            'stats/lb_xp_week': { updatedAt: now - 2 * 60 * 60 * 1000, sourceRev: 10, rows: [{ rank: 1, uid: 'p0', username: 'P0', value: 1 }], intervalMs: 10 * 60 * 1000 },
            'stats/lb_dirty': { xpWeek: 10 }
        },
        profiles: profiles
    });
    const agedResult = await boards.refreshBoard(aged, 'xpWeek', now, {});
    assert.strictEqual(agedResult.reason, 'max-age');
    assert.strictEqual(agedResult.skipped, false);
    assert.strictEqual(aged.state.profileReads, 60);

    const dirty = makeDb({
        docs: {
            'stats/lb_xp_week': { updatedAt: now - 20 * 60 * 1000, sourceRev: 10, rows: [{ rank: 1 }], intervalMs: 10 * 60 * 1000 },
            'stats/lb_dirty': { xpWeek: 11 }
        },
        profiles: profiles
    });
    const built = await boards.refreshBoard(dirty, 'xpWeek', now, {});
    assert.strictEqual(built.skipped, false);
    assert.strictEqual(built.rows, 25);
    assert.strictEqual(dirty.state.profileReads, 60);
    assert.strictEqual(dirty.state.writes, 1);
    assert.strictEqual(dirty.state.docs['stats/lb_xp_week'].rows[0].username, 'P59');
    assert.strictEqual(JSON.stringify(dirty.state.docs['stats/lb_xp_week']).indexOf('@'), -1);
});

test('favor waits 30 minutes when the cycle is idle and 5 when it is active', async () => {
    const now = 8000000;
    const idle = makeDb({
        docs: {
            'stats/lb_favor_hashers': { updatedAt: now - 10 * 60 * 1000, sourceRev: 1, rows: [{ rank: 1 }], intervalMs: 30 * 60 * 1000 },
            'satoshiFavor/current': { favorActive: false },
            'stats/lb_dirty': { favor: now }
        },
        profiles: [profile('a', { username: 'A', sfTotalHashes: 10 })]
    });
    const idleResult = await boards.refreshBoard(idle, 'favor', now, {});
    assert.strictEqual(idleResult.reason, 'interval');
    assert.strictEqual(idle.state.profileReads, 0);

    const active = makeDb({
        docs: {
            'stats/lb_favor_hashers': { updatedAt: now - 10 * 60 * 1000, sourceRev: 1, rows: [{ rank: 1 }], intervalMs: 5 * 60 * 1000 },
            'satoshiFavor/current': { favorActive: true },
            'stats/lb_dirty': { favor: 2 }
        },
        profiles: [profile('a', { username: 'Ada', sfTotalHashes: 10, email: 'ada@secret.test' })]
    });
    const activeResult = await boards.refreshBoard(active, 'favor', now, {});
    assert.strictEqual(activeResult.skipped, false);
    assert.strictEqual(active.state.docs['stats/lb_favor_hashers'].favorActive, true);
    assert.strictEqual(active.state.docs['stats/lb_favor_hashers'].intervalMs, 5 * 60 * 1000);
    assert.strictEqual(JSON.stringify(active.state.docs['stats/lb_favor_hashers']).indexOf('secret.test'), -1);
});

test('the client, the visit path, and the rules match the snapshot plan', () => {
    const ranking = read('ranking.js');
    const features = read('features.js');
    const bundle = read('bundle.min.js');
    const quests = read('quests.js');
    const index = read('functions/index.js');
    const rules = read('firestore.rules');
    assert.strictEqual(ranking.includes('function _prefetchLeaderboard'), false);
    assert.strictEqual(ranking.includes("orderBy('points', 'desc').limit(150)"), false);
    assert.strictEqual(ranking.includes("orderBy('weeklyXP'"), false);
    assert.strictEqual(ranking.includes("orderBy('pvpWins'"), false);
    assert.ok(ranking.includes("docId: 'lb_xp_alltime'"));
    assert.ok(ranking.includes("docId: 'lb_xp_week'"));
    assert.ok(ranking.includes("docId: 'lb_xp_month'"));
    assert.ok(ranking.includes("docId: 'lb_pvp'"));
    assert.ok(ranking.includes('15 * 60 * 1000'));
    assert.ok(ranking.includes('10 * 60 * 1000'));
    assert.ok(ranking.includes('btc_lb_snap_'));
    assert.ok(ranking.includes("_rankLabel: '25+'"));
    assert.ok(ranking.includes("doc('streak_leaderboard')"));
    assert.ok(ranking.includes("doc('predictor_leaderboard')"));
    assert.ok(ranking.includes('quest_leaderboard_'));
    assert.strictEqual(features.includes("orderBy('points'"), false);
    assert.ok(features.includes('btc_lb_snap_lb_xp_alltime'));
    assert.strictEqual(bundle.includes('orderBy("points"'), false);
    assert.ok(bundle.includes('btc_lb_snap_lb_xp_alltime'));
    assert.strictEqual(quests.includes("orderBy('sfTotalHashes'"), false);
    assert.strictEqual(quests.includes("orderBy('raidDamageAllTime'"), false);
    assert.ok(quests.includes('_loadFavorHasherSnapshot'));
    assert.ok(quests.includes('_raidAllTimeHtml'));
    assert.ok(quests.includes("orderBy('contributed', 'desc')"));
    const visitAt = index.indexOf('exports.recordDailyVisit');
    const visit = index.slice(visitAt, index.indexOf('exports.refreshStreakLeaderboard', visitAt));
    assert.strictEqual(visit.includes('streakBoard.refresh'), false);
    assert.ok(visit.includes('streakBoard.nextVisitStreak'));
    assert.ok(visit.includes('streakBoard.applyStreakUpdate'));
    assert.ok(index.includes('exports.refreshXpPeriodBoards'));
    assert.ok(index.includes('exports.refreshXpAllPvpRaidBoards'));
    assert.ok(index.includes('exports.refreshFavorHashersBoard'));
    assert.ok(index.includes("schedule: 'every 10 minutes'"));
    assert.ok(index.includes("schedule: 'every 15 minutes'"));
    assert.ok(index.includes("schedule: 'every 5 minutes'"));
    ['lb_xp_alltime', 'lb_xp_week', 'lb_xp_month', 'lb_pvp', 'lb_favor_hashers', 'lb_raid_alltime', 'lb_dirty'].forEach(function (id) {
        assert.ok(rules.includes('stats/' + id), id);
        assert.strictEqual(rules.includes("statId == '" + id + "'"), false, id);
    });
    const statsAt = rules.indexOf('match /stats/{statId}');
    const statsEnd = rules.indexOf('match /', statsAt + 20);
    const statsBlock = rules.slice(statsAt, statsEnd > statsAt ? statsEnd : statsAt + 2500);
    assert.ok(statsBlock.includes("allow read: if !statId.matches('lb_.*') || request.auth != null"));
    assert.strictEqual(statsBlock.includes('allow read: if true'), false);
    const stampAt = index.indexOf('async function stampLeaderboardDirty');
    const stamp = index.slice(stampAt, index.indexOf('exports.syncPublicProfile', stampAt));
    assert.ok(stamp.includes('throttleDirtyPatch'));
    assert.ok(stamp.includes("console.error('[lb dirty] stamp failed:'"));
    assert.strictEqual(stamp.includes('catch (e) {}'), false);
    assert.ok(stamp.includes('delete lbDirtyStampAt[key]'));
});

test('read counts versus the live board, measured on a fake Firestore', async () => {
    const before = {
        loginPrefetchProfiles: 150,
        tickerProfiles: 10,
        xpTab: 150,
        pvp: 100,
        favorListener: 50,
        raidAllTime: 25
    };
    const now = 9000000;
    const profiles = [];
    for (let i = 0; i < 150; i++) {
        profiles.push(profile('u' + i, { username: 'U' + i, points: 150 - i, pvpWins: (i % 20) + 1, pvpLosses: (i % 7), sfTotalHashes: i + 1, raidDamageAllTime: i + 1 }));
    }
    async function open(key, favorActive) {
        const spec = boards.BOARDS[key];
        const db = makeDb({
            docs: {
                'stats/lb_dirty': {},
                'satoshiFavor/current': { favorActive: favorActive === true }
            },
            profiles: profiles
        });
        const result = await boards.refreshBoard(db, key, now, { force: true });
        return { rows: result.rows, profileReads: db.state.profileReads, docReads: 1 };
    }
    const xp = await open('xpAll');
    const week = await open('xpWeek');
    const month = await open('xpMonth');
    const pvp = await open('pvp');
    const favor = await open('favor', true);
    const raid = await open('raid');
    assert.strictEqual(xp.rows, 25);
    assert.strictEqual(week.profileReads, 60);
    assert.strictEqual(month.profileReads, 60);
    assert.strictEqual(pvp.profileReads, 120);
    assert.strictEqual(favor.profileReads, 60);
    assert.strictEqual(raid.profileReads, 60);
    const afterOpen = { xp: xp.docReads, week: week.docReads, month: month.docReads, pvp: pvp.docReads, favor: favor.docReads, raid: raid.docReads };
    console.log('BEFORE reads per open ' + JSON.stringify(before));
    console.log('AFTER reads per open (client snapshot, localStorage miss) ' + JSON.stringify(afterOpen));
    console.log('AFTER login leaderboard reads 0 (prefetch removed, ticker uses localStorage)');
    console.log('Server rebuild reads, only when dirty: xp/week/month/favor/raid ' + xp.profileReads + ' source docs, pvp ' + pvp.profileReads);
    assert.strictEqual(afterOpen.xp, 1);
    assert.strictEqual(before.xpTab, 150);
});

(async function main() {
    for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        try {
            await item.fn();
            console.log('✅ ' + item.name);
            passed++;
        } catch (e) {
            console.log('❌ ' + item.name + ': ' + (e && e.message ? e.message : e));
            failed++;
        }
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    if (failed) process.exit(1);
})();
