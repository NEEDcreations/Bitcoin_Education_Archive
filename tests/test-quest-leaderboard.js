#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const board = require('../functions/src/questBoard');
const { parseArgs } = require('../functions/scripts/backfill_quest_leaderboard');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

let passed = 0;
let failed = 0;
const pending = [];
function test(name, fn) {
    let run;
    try { run = fn(); }
    catch (e) {
        console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e));
        failed++;
        return;
    }
    if (run && typeof run.then === 'function') {
        pending.push(run.then(function () {
            console.log('✅ ' + name);
            passed++;
        }, function (e) {
            console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e));
            failed++;
        }));
        return;
    }
    console.log('✅ ' + name);
    passed++;
}

const NOW = Date.parse('2026-10-30T16:00:00Z');
const MONDAY = Date.parse('2026-10-26T04:30:00Z');
const SUNDAY = Date.parse('2026-10-26T03:00:00Z');
const Q1 = 'quest_whitepaper__1';
const Q2 = 'quest_pow__1';

function pass(id, at, score) {
    return { questId: id, at: at, score: score == null ? 5 : score };
}

test('Eastern week starts Monday 00:00 and the month starts at midnight', () => {
    assert.strictEqual(board.weekKey(Date.parse('2026-10-26T04:00:00Z')), '2026-10-26');
    assert.strictEqual(board.weekKey(Date.parse('2026-10-26T03:59:59Z')), '2026-10-19');
    assert.strictEqual(board.monthKey(Date.parse('2026-11-01T04:00:00Z')), '2026-11');
    assert.strictEqual(board.monthKey(Date.parse('2026-11-01T03:59:59Z')), '2026-10');
    assert.strictEqual(board.weekKey(Date.parse('2026-01-05T05:00:00Z')), '2026-01-05');
    assert.strictEqual(board.weekKey(Date.parse('2026-01-05T04:59:59Z')), '2025-12-29');
    assert.strictEqual(board.monthKey(Date.parse('2026-01-01T05:00:00Z')), '2026-01');
    assert.strictEqual(board.monthKey(Date.parse('2026-01-01T04:59:59Z')), '2025-12');
    assert.strictEqual(board.weekKey(NOW), '2026-10-26');
    assert.strictEqual(board.monthKey(NOW), '2026-10');
});

test('a pass is 3/5, and a replay of a passed quest leaves the rate unchanged', () => {
    let stats = board.applyAttempt(null, { questId: Q1, score: 1, at: MONDAY }, MONDAY);
    stats = board.applyAttempt(stats, { questId: Q1, score: 2, at: MONDAY + 1000 }, MONDAY + 1000);
    stats = board.applyAttempt(stats, { questId: Q1, score: 4, at: MONDAY + 2000 }, MONDAY + 2000);
    assert.strictEqual(stats.passes, 1);
    assert.strictEqual(stats.attempts, 3);
    assert.strictEqual(stats.passedAttempts, 1);
    assert.strictEqual(stats.passedAttempts / stats.attempts, 1 / 3);
    assert.strictEqual(board.displayPct(stats.passedAttempts, stats.attempts), 33);
    const pct = board.displayPct(stats.passedAttempts, stats.attempts);
    const farmed = board.applyAttempt(stats, { questId: Q1, score: 5, at: MONDAY + 3000 }, MONDAY + 3000);
    assert.strictEqual(farmed.passes, 1);
    assert.strictEqual(farmed.attempts, 3);
    assert.strictEqual(farmed.passedAttempts, 1);
    assert.strictEqual(farmed.weekAttempts, stats.weekAttempts);
    assert.strictEqual(farmed.weekPassedAttempts, stats.weekPassedAttempts);
    assert.strictEqual(farmed.monthAttempts, stats.monthAttempts);
    assert.strictEqual(farmed.monthPassedAttempts, stats.monthPassedAttempts);
    assert.strictEqual(board.displayPct(farmed.passedAttempts, farmed.attempts), pct);
    const second = board.applyAttempt(farmed, { questId: Q2, score: 4, at: MONDAY + 4000 }, MONDAY + 4000);
    assert.strictEqual(second.passes, 2);
    assert.strictEqual(second.reachedAt, MONDAY + 4000);
});

test('rolling into a new week keeps the closed week counts', () => {
    const first = board.applyAttempt(null, { questId: Q1, score: 5, at: SUNDAY }, SUNDAY);
    const closed = first.weekKey;
    assert.strictEqual(first.weekPasses, 1);
    const rolled = board.applyAttempt(first, { questId: Q2, score: 5, at: MONDAY }, MONDAY);
    assert.notStrictEqual(rolled.weekKey, closed);
    assert.strictEqual(rolled.prevWeekKey, closed);
    assert.strictEqual(rolled.prevWeekPasses, 1);
    assert.strictEqual(rolled.prevWeekAttempts, first.weekAttempts);
    assert.strictEqual(rolled.weekPasses, 1);
    const closedRow = board.closedView(rolled, 'week', closed);
    assert.strictEqual(closedRow.passes, 1);
    assert.strictEqual(closedRow.attempts, first.weekAttempts);
    assert.strictEqual(board.closedView(rolled, 'week', rolled.weekKey).passes, 1);
    const monthFirst = board.applyAttempt(null, { questId: Q1, score: 5, at: Date.parse('2026-10-31T20:00:00Z') }, Date.parse('2026-10-31T20:00:00Z'));
    const monthClosed = monthFirst.monthKey;
    const monthRolled = board.applyAttempt(monthFirst, { questId: Q2, score: 5, at: Date.parse('2026-11-01T05:00:00Z') }, Date.parse('2026-11-01T05:00:00Z'));
    assert.strictEqual(monthRolled.prevMonthKey, monthClosed);
    assert.strictEqual(monthRolled.prevMonthPasses, 1);
    assert.strictEqual(board.closedView(monthRolled, 'month', monthClosed).passes, 1);
});

test('a replay of a quest passed last week does not count this week', () => {
    let stats = board.applyAttempt(null, { questId: Q1, score: 5, at: SUNDAY }, SUNDAY);
    const replay = board.applyAttempt(stats, { questId: Q1, score: 4, at: MONDAY }, MONDAY);
    assert.strictEqual(replay.passes, 1);
    assert.strictEqual(replay.attempts, 1);
    assert.strictEqual(replay.passedAttempts, 1);
    assert.strictEqual(replay.reachedAt, SUNDAY);
    assert.strictEqual(replay.weekKey, stats.weekKey);
    assert.strictEqual(replay.weekPasses, stats.weekPasses);
    assert.strictEqual(replay.weekAttempts, stats.weekAttempts);
    assert.strictEqual(replay.monthAttempts, stats.monthAttempts);
    assert.strictEqual(board.viewFromStats(replay, 'week', NOW).passes, 0);
    assert.strictEqual(board.viewFromStats(replay, 'alltime', NOW).passes, 1);
    const oldOnly = board.applyAttempt(null, { questId: Q2, score: 5, at: SUNDAY }, SUNDAY);
    assert.strictEqual(board.viewFromStats(oldOnly, 'week', NOW).passes, 0);
    assert.strictEqual(board.viewFromStats(oldOnly, 'alltime', NOW).passes, 1);
});

test('ties go to more passes, then a higher pass rate, then whoever reached it earlier', () => {
    const rows = [
        { username: 'Late', passes: 4, attempts: 5, passedAttempts: 4, reachedAt: 500 },
        { username: 'Early', passes: 4, attempts: 5, passedAttempts: 4, reachedAt: 100 },
        { username: 'Rate', passes: 4, attempts: 5, passedAttempts: 5, reachedAt: 900 },
        { username: 'More', passes: 5, attempts: 5, passedAttempts: 5, reachedAt: 800 },
        { username: 'ExactHigh', passes: 2, attempts: 100, passedAttempts: 67, reachedAt: 50 },
        { username: 'ExactLow', passes: 2, attempts: 6, passedAttempts: 4, reachedAt: 10 }
    ];
    const names = board.selectBoard(rows, 'alltime').map(function (row) { return row.username; });
    assert.deepStrictEqual(names, ['More', 'Rate', 'Early', 'Late', 'ExactHigh', 'ExactLow']);
    const packed = board.selectBoard(rows, 'alltime');
    assert.strictEqual(packed[4].pct, 67);
    assert.strictEqual(packed[5].pct, 67);
    assert.strictEqual(packed[0].rank, 1);
});

test('minimum attempts are 5 all-time and 3 for the week and month', () => {
    const rows = [
        { username: 'Short', passes: 4, attempts: 4, passedAttempts: 4, reachedAt: 10 },
        { username: 'Five', passes: 2, attempts: 5, passedAttempts: 2, reachedAt: 20 },
        { username: 'WeekShort', passes: 2, attempts: 2, passedAttempts: 2, reachedAt: 30 },
        { username: 'WeekOk', passes: 1, attempts: 3, passedAttempts: 1, reachedAt: 40 }
    ];
    assert.deepStrictEqual(board.selectBoard(rows, 'alltime').map(function (r) { return r.username; }), ['Five']);
    assert.deepStrictEqual(board.selectBoard(rows, 'week').map(function (r) { return r.username; }), ['Short', 'Five', 'WeekOk']);
    assert.deepStrictEqual(board.selectBoard(rows, 'month').map(function (r) { return r.username; }), ['Short', 'Five', 'WeekOk']);
});

test('a player with no distinct pass stays off the board', () => {
    const rows = [];
    for (let i = 0; i < 8; i++) {
        rows.push({ username: 'Zero' + i, passes: 0, attempts: 8, passedAttempts: 0, reachedAt: i });
    }
    rows.push({ username: 'One', passes: 1, attempts: 4, passedAttempts: 1, reachedAt: 20 });
    assert.deepStrictEqual(board.selectBoard(rows, 'month').map(function (r) { return r.username; }), ['One']);
    assert.deepStrictEqual(board.selectBoard(rows, 'week').map(function (r) { return r.username; }), ['One']);
    assert.strictEqual(board.selectBoard(rows, 'alltime').length, 0);
});

test('the board stops at 25 and does not need an expand', () => {
    const rows = [];
    for (let i = 0; i < 30; i++) {
        rows.push({
            username: 'N' + String(i).padStart(2, '0'),
            passes: i + 1,
            attempts: i + 5,
            passedAttempts: i + 1,
            reachedAt: 1000 + i
        });
    }
    const picked = board.selectBoard(rows, 'alltime');
    assert.strictEqual(picked.length, 25);
    assert.strictEqual(picked[0].username, 'N29');
    assert.strictEqual(picked[0].passes, 30);
    assert.strictEqual(picked[24].passes, 6);
    assert.strictEqual(board.BOARD_SIZE, 25);
});

test('banned players stay, ghost mode stays off, and the doc has no email or uid', () => {
    const secret = 'uid-secret-abc';
    const built = board.buildBoards([
        {
            uid: secret,
            username: 'Banned',
            email: 'banned@example.com',
            banned: true,
            profilePic: 'javascript:alert(1)',
            stats: board.seedStatsFromPasses([
                pass(Q1, MONDAY, 5),
                pass(Q2, MONDAY + 1, 4),
                pass('quest_nodes__1', MONDAY + 2, 3),
                pass('quest_keys__1', MONDAY + 3, 5),
                pass('quest_fees__1', MONDAY + 4, 5)
            ])
        },
        {
            uid: 'ghost-1',
            username: 'Ghost',
            ghostMode: true,
            stats: board.seedStatsFromPasses([
                pass(Q1, MONDAY, 5), pass(Q2, MONDAY, 5), pass('quest_a__1', MONDAY, 5),
                pass('quest_b__1', MONDAY, 5), pass('quest_c__1', MONDAY, 5), pass('quest_d__1', MONDAY, 5)
            ])
        },
        {
            uid: 'mail-1',
            username: 'player@email.test',
            stats: board.seedStatsFromPasses([
                pass(Q1, MONDAY, 5), pass(Q2, MONDAY, 5), pass('quest_e__1', MONDAY, 5),
                pass('quest_f__1', MONDAY, 5), pass('quest_g__1', MONDAY, 5)
            ])
        }
    ], NOW);
    assert.deepStrictEqual(built.alltime.map(function (row) { return row.username; }), ['Anon', 'Banned']);
    const packed = JSON.stringify(built);
    assert.strictEqual(packed.indexOf(secret), -1);
    assert.strictEqual(packed.indexOf('ghost-1'), -1);
    assert.strictEqual(packed.indexOf('banned@example.com'), -1);
    assert.strictEqual(packed.indexOf('player@email.test'), -1);
    assert.strictEqual(packed.indexOf('Ghost'), -1);
    assert.strictEqual(packed.indexOf('javascript:'), -1);
    built.alltime.forEach(function (row) {
        assert.deepStrictEqual(Object.keys(row).sort(), ['passes', 'pct', 'profilePic', 'rank', 'username']);
    });
    assert.strictEqual(built.alltime[0].pct, 100);
});

test('history replays first passes, and a later live doc keeps failure attempts', () => {
    const seeded = board.seedStatsFromPasses([
        pass(Q1, SUNDAY, 5),
        pass(Q2, MONDAY, 4)
    ]);
    assert.strictEqual(seeded.passes, 2);
    assert.strictEqual(seeded.attempts, 2);
    assert.strictEqual(seeded.live, false);
    assert.strictEqual(seeded.weekPasses, 1);
    const live = board.applyAttempt(seeded, { questId: Q2, score: 1, at: MONDAY + 5000 }, MONDAY + 5000);
    live.live = true;
    const again = board.mergeForBackfill(live, [
        pass(Q1, SUNDAY, 5),
        pass(Q2, MONDAY, 4),
        pass('quest_new__1', SUNDAY - 86400000, 5)
    ], NOW);
    assert.strictEqual(again.live, true);
    assert.strictEqual(again.passes, 3);
    assert.ok(again.attempts >= 3);
    assert.strictEqual(again.weekPassedAttempts >= 1, true);
    assert.strictEqual(parseArgs([]).apply, false);
    assert.strictEqual(parseArgs(['--apply']).apply, true);
    const script = read('functions/scripts/backfill_quest_leaderboard.js');
    assert.ok(script.includes('dry-run'));
    assert.ok(script.includes("argv.indexOf('--apply')"));
    assert.ok(script.includes('quest_passes'));
    assert.ok(!script.includes('quizAnswered'));
    assert.ok(script.includes('Never prints emails or user ids'));
    assert.ok(script.includes('boardLines'));
    assert.ok(script.includes('skippedMissing'));
    assert.ok(script.includes('quest_answer_keys'));
    assert.ok(script.includes('estimatedRate'));
});

test('gradeQuest records the attempt without changing the XP payout', () => {
    const src = read('functions/src/questCallables.js');
    const start = src.indexOf('const gradeQuest = onCall');
    const end = src.indexOf('const startQuest = onCall');
    const body = src.slice(start, end);
    assert.ok(body.includes('questBoard.applyAttempt'));
    assert.ok(body.includes("collection('quest_attempts')"));
    assert.ok(body.includes("collection('quest_lb_stats')"));
    assert.ok(body.includes('userUpdate.points = FieldValue.increment(settled.awarded)'));
    assert.ok(body.indexOf("reason: 'daily-limit'") < body.indexOf('questBoard.applyAttempt'));
    assert.ok(body.indexOf('await tx.get(statsRef)') < body.indexOf('questBoard.applyAttempt'));
    assert.strictEqual(body.includes('quizAnswered'), true);
    assert.strictEqual(body.includes('payload.quizAnswered'), false);
    const reward = read('functions/src/questReward.js');
    assert.ok(reward.includes('const QUEST_PERFECT_XP = 100'));
    assert.ok(reward.includes('const QUEST_PARTIAL_XP = 50'));
    assert.ok(reward.includes('const QUEST_RETRY_XP = 25'));
    const engine = read('functions/src/questBoard.js');
    assert.strictEqual(engine.includes('quizAnswered'), false);
    assert.strictEqual(engine.includes('questsPassed'), false);
    assert.strictEqual(engine.includes('lqProgress'), false);
    const index = read('functions/index.js');
    assert.ok(index.includes('exports.refreshQuestLeaderboard'));
});

test('rules deny client writes and the page reads one doc per tab', () => {
    const rules = read('firestore.rules');
    assert.ok(rules.includes('match /quest_lb_stats/{uid}'));
    assert.ok(rules.includes('match /users/{userId}/quest_attempts/{docId}'));
    ['quest_lb_stats/{uid}', 'users/{userId}/quest_attempts/{docId}'].forEach(function (marker) {
        const at = rules.indexOf('match /' + marker);
        const block = rules.slice(at, rules.indexOf('match /', at + 10));
        assert.ok(block.includes('allow read, write: if false'), marker);
    });
    assert.ok(rules.includes('quest_leaderboard_alltime'));
    assert.ok(rules.includes('quest_leaderboard_week'));
    assert.ok(rules.includes('quest_leaderboard_month'));
    ['alltime', 'week', 'month'].forEach(function (period) {
        assert.strictEqual(rules.includes("statId == 'quest_leaderboard_" + period + "'"), false);
    });
    const ranking = read('ranking.js');
    assert.ok(ranking.indexOf('id="streakBoard"') < ranking.indexOf('id="questBoard"'));
    assert.ok(ranking.indexOf('id="questBoard"') < ranking.indexOf('id="predictorBoard"'));
    const fnStart = ranking.indexOf('// Quests — All Time');
    const fnEnd = ranking.indexOf('// PVP leaderboard. One snapshot doc');
    const fn = ranking.slice(fnStart, fnEnd);
    assert.ok(fn.includes("doc(QUEST_LB_DOC[period])"));
    assert.ok(fn.includes('window._questLbTab'));
    assert.strictEqual(fn.includes('window._questLbPeriod ='), false);
    assert.strictEqual(fn.includes('quizAnswered'), false);
    assert.strictEqual(fn.includes('quest_passes'), false);
    assert.strictEqual(fn.includes('quest_lb_stats'), false);
    assert.strictEqual(fn.includes('Show all'), false);
    assert.strictEqual(fn.includes('expandLeaderboard'), false);
    assert.ok(fn.includes(' · '));
    assert.ok(fn.includes('%'));
    const indexes = read('firestore.indexes.json');
    assert.ok(indexes.includes('"collectionGroup": "quest_lb_stats"'));
    assert.ok(indexes.includes('"fieldPath": "weekPasses"'));
    assert.ok(indexes.includes('"fieldPath": "monthPasses"'));
    assert.strictEqual(read('index.html'), read('404.html'));
});

test('backfill drops ids that are not in the quest catalog', () => {
    const catalog = board.questCatalog();
    assert.ok(catalog.ids['quest_whitepaper__1']);
    assert.ok(catalog.ids['quest_whitepaper__2']);
    assert.ok(catalog.ids['quest_nodes__2']);
    assert.ok(catalog.ids['quest_mining__1']);
    assert.strictEqual(catalog.ids['quest_dynamic_1'], undefined);
    assert.strictEqual(catalog.ids['quest_dynamic_12__1'], undefined);
    const before = board.CUTOVER_MS - 86400000;
    const after = board.CUTOVER_MS + 3600000;
    const built = board.buildLegacyStats({
        completedQuests: [
            'quest_whitepaper',
            'quest_dynamic_12',
            'quest_nodes__2',
            'quest_not_real__1',
            'q__whitepaper__2'
        ],
        answerKeys: [
            { graded: true, topicKey: 'whitepaper', score: 5, createdAt: before },
            { graded: true, topicKey: 'whitepaper', questIndex: 0, score: 5, createdAt: before + 10 },
            { graded: true, topicKey: 'whitepaper', partNum: 2, score: 4, createdAt: before + 20 },
            { graded: true, topicKey: 'nodes', questIndex: 0, score: 1, createdAt: before + 30 },
            { graded: true, topicKey: 'nodes', questIndex: 0, score: 2, createdAt: before + 40 },
            { graded: true, topicKey: 'fees', score: 1, createdAt: before + 50 },
            { graded: true, topicKey: 'quest_dynamic_3', score: 5, createdAt: before + 60 },
            { graded: true, topicKey: 'nodes', score: 1, createdAt: before + 70 },
            { graded: true, topicKey: 'mining', questIndex: 0, score: 5, createdAt: after },
            { graded: true, topicKey: 'not-a-quest', score: 2, createdAt: after },
            { graded: false, topicKey: 'nodes', questIndex: 0, score: 1, createdAt: before }
        ],
        passes: [
            { questId: 'quest_nodes__3', score: 5, at: MONDAY },
            { questId: 'quest_dynamic_9', score: 5, at: MONDAY }
        ],
        attempts: [
            { questId: 'quest_mining__1', score: 1, at: MONDAY },
            { questId: 'quest_mining__1', score: 2, at: MONDAY + 1 },
            { questId: 'quest_mining__1', score: 4, at: MONDAY + 2 },
            { questId: 'quest_mining__1', score: 5, at: MONDAY + 3 },
            { questId: 'quest_dynamic_4', score: 1, at: MONDAY }
        ]
    }, NOW);
    const stats = built.stats;
    assert.strictEqual(built.dropped, 7);
    assert.strictEqual(stats.passes, 5);
    assert.strictEqual(stats.passedAttempts, 5);
    assert.strictEqual(stats.attempts, 10);
    assert.strictEqual(built.oldFails, 3);
    assert.strictEqual(stats.passed['quest_dynamic_12'], undefined);
    assert.strictEqual(stats.passed['quest_dynamic_12__1'], undefined);
    assert.strictEqual(stats.passed['quest_not_real__1'], undefined);
    assert.strictEqual(stats.passed['quest_fees__1'], undefined);
    assert.ok(stats.passed['quest_whitepaper__1'] != null);
    assert.ok(stats.passed['quest_whitepaper__2'] != null);
    assert.ok(stats.passed['quest_nodes__2'] != null);
    assert.ok(stats.passed['quest_nodes__3'] != null);
    assert.ok(stats.passed['quest_mining__1'] != null);
    const week = board.viewFromStats(stats, 'week', NOW);
    assert.strictEqual(week.passes, 2);
    assert.strictEqual(week.attempts, 4);
    assert.strictEqual(week.passedAttempts, 2);
    const onlyOld = board.buildLegacyStats({
        completedQuests: ['quest_whitepaper', 'quest_dynamic_1'],
        estimatedRate: 65.5
    }, NOW);
    assert.strictEqual(onlyOld.dropped, 1);
    assert.strictEqual(onlyOld.stats.passes, 1);
    assert.strictEqual(onlyOld.stats.attempts, 1);
    assert.strictEqual(board.viewFromStats(onlyOld.stats, 'week', NOW).passes, 0);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(onlyOld.stats, 'estimatedRate'), false);
    const lines = board.boardLines([
        { rank: 1, username: 'Ada', passes: 6, pct: 60 },
        { rank: 2, username: 'ada@secret.test', passes: 1, pct: 100, uid: 'uid-secret' }
    ]);
    assert.strictEqual(lines[0], '1. Ada  6  60%');
    assert.strictEqual(lines[1], '2. Anon  1  100%');
    assert.strictEqual(lines.join('\n').indexOf('uid-secret'), -1);
    assert.strictEqual(lines.join('\n').indexOf('ada@secret.test'), -1);
    const script = read('functions/scripts/backfill_quest_leaderboard.js');
    assert.ok(script.includes('dropped'));
    assert.ok(script.includes('byUid[uid].push(data)'));
    assert.ok(!script.includes('topicKey: data.topicKey'));
});

function memoryDb(initial) {
    const store = Object.assign({}, initial);
    function snapOf(path) {
        const id = path.slice(path.lastIndexOf('/') + 1);
        const data = Object.prototype.hasOwnProperty.call(store, path) ? store[path] : undefined;
        return {
            id: id,
            exists: data != null,
            data: function () { return data; }
        };
    }
    function ref(path) {
        return {
            id: path.slice(path.lastIndexOf('/') + 1),
            path: path,
            get: async function () { return snapOf(path); },
            set: async function (data) { store[path] = data; }
        };
    }
    function statsQuery() {
        const rows = Object.keys(store).filter(function (path) {
            return path.indexOf('quest_lb_stats/') === 0;
        }).map(function (path) {
            return { id: path.slice('quest_lb_stats/'.length), data: function () { return store[path]; } };
        });
        return {
            get: async function () {
                return { forEach: function (fn) { rows.forEach(fn); } };
            }
        };
    }
    const limited = { limit: function () { return statsQuery(); } };
    return {
        store: store,
        getAll: function () {
            const refs = Array.prototype.slice.call(arguments);
            return Promise.resolve(refs.map(function (item) { return snapOf(item.path); }));
        },
        collection: function (name) {
            return {
                doc: function (id) { return ref(name + '/' + id); },
                orderBy: function () { return limited; },
                where: function () { return { orderBy: function () { return limited; } }; }
            };
        }
    };
}

test('refresh keeps a packed percent instead of writing 0', async () => {
    const week = board.weekKey(NOW);
    const month = board.monthKey(NOW);
    const packed = board.packPeriod('alltime', [
        { rank: 1, username: 'Ada', passes: 6, pct: 80, profilePic: '' }
    ], NOW, {});
    assert.strictEqual(packed.rows[0].pct, 80);
    assert.strictEqual(packed.rows[0].passes, 6);

    const db = memoryDb({
        'quest_lb_stats/ada': {
            attempts: 10,
            passedAttempts: 8,
            passes: 6,
            reachedAt: MONDAY,
            passed: {},
            weekKey: week,
            weekAttempts: 4,
            weekPassedAttempts: 3,
            weekPasses: 2,
            weekReachedAt: MONDAY,
            weekPassed: {},
            monthKey: month,
            monthAttempts: 5,
            monthPassedAttempts: 4,
            monthPasses: 3,
            monthReachedAt: MONDAY,
            monthPassed: {},
            live: true,
            updatedAt: NOW
        },
        'users/ada': { username: 'Ada', profilePic: '', ghostMode: false }
    });
    const result = await board.refresh(db, NOW, { force: true });
    assert.strictEqual(result.skipped, false);
    const all = db.store['stats/quest_leaderboard_alltime'];
    const wk = db.store['stats/quest_leaderboard_week'];
    const mo = db.store['stats/quest_leaderboard_month'];
    assert.strictEqual(all.rows[0].username, 'Ada');
    assert.strictEqual(all.rows[0].passes, 6);
    assert.strictEqual(all.rows[0].pct, 80);
    assert.strictEqual(wk.rows[0].pct, 75);
    assert.strictEqual(wk.rows[0].passes, 2);
    assert.strictEqual(mo.rows[0].pct, 80);
    assert.strictEqual(mo.rows[0].passes, 3);
    assert.strictEqual(JSON.stringify(all).indexOf('ada'), -1);
});

function finish() {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    if (failed) process.exit(1);
}

if (pending.length) Promise.all(pending).then(finish, finish);
else finish();
