#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const board = require('../functions/src/streakBoard');
const { offsetDateKey } = require('../functions/src/offsetDay');
const { parseArgs } = require('../functions/scripts/backfill_best_streak');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e)); failed++; }
}

const NOW = Date.UTC(2026, 9, 28, 16, 0, 0);
const TODAY = offsetDateKey(NOW);
const YDAY = board.shiftDateKey(TODAY, -1);
const TWO = board.shiftDateKey(TODAY, -2);
const THREE = board.shiftDateKey(TODAY, -3);

function user(id, fields) {
    return { id: id, data: fields };
}

test('a lapsed check-in counts as zero on Current and stays on all-time', () => {
    assert.strictEqual(TODAY, '2026-10-28');
    const rows = [
        user('old', { username: 'Old', streak: 40, bestStreak: 40, lastVisit: THREE, streakReachedAt: 10, bestStreakAt: 10 }),
        user('yday', { username: 'Yday', streak: 12, bestStreak: 12, lastVisit: YDAY, streakReachedAt: 20, bestStreakAt: 20 }),
        user('today', { username: 'Today', streak: 8, bestStreak: 8, lastVisit: TODAY, streakReachedAt: 30, bestStreakAt: 30 }),
        user('gap', { username: 'Gap', streak: 30, bestStreak: 30, lastVisit: TWO, streakFreezes: 0, streakReachedAt: 15, bestStreakAt: 15 }),
        user('freeze', { username: 'Freeze', streak: 18, bestStreak: 18, lastVisit: TWO, streakFreezes: 1, streakReachedAt: 16, bestStreakAt: 16 })
    ];
    const doc = board.buildBoards(rows, NOW);
    const currentNames = doc.current.map(function (r) { return r.username; });
    assert.deepStrictEqual(currentNames, ['Freeze', 'Yday', 'Today']);
    assert.strictEqual(doc.current.some(function (r) { return r.username === 'Old' || r.username === 'Gap'; }), false);
    assert.strictEqual(board.currentStreak(rows[0].data, TODAY), 0);
    assert.strictEqual(board.currentStreak(rows[3].data, TODAY), 0);
    assert.strictEqual(board.currentStreak(rows[4].data, TODAY), 18);
    const allNames = doc.alltime.map(function (r) { return r.username; });
    assert.strictEqual(allNames[0], 'Old');
    assert.ok(allNames.indexOf('Gap') !== -1);
});

test('current and the next visit agree on the grace window', () => {
    [TODAY, YDAY, TWO, THREE, ''].forEach(function (last) {
        [0, 1].forEach(function (freezes) {
            const row = { streak: 9, lastVisit: last, streakFreezes: freezes };
            const cur = board.currentStreak(row, TODAY);
            const next = board.nextVisitStreak(row, TODAY);
            if (last === TODAY) {
                assert.strictEqual(next.alreadyVisited, true);
                assert.strictEqual(cur, 9);
            } else if (cur > 0) {
                assert.strictEqual(next.alreadyVisited, false);
                assert.strictEqual(next.streak, cur + 1);
            } else {
                assert.strictEqual(next.streak, 1);
                assert.strictEqual(next.usedFreeze, false);
            }
        });
    });
    const saved = board.nextVisitStreak({ streak: 9, lastVisit: TWO, streakFreezes: 2 }, TODAY);
    assert.strictEqual(saved.usedFreeze, true);
    assert.strictEqual(saved.streak, 10);
});

test('ties go to whoever reached it first, then by username', () => {
    const rows = [
        user('late', { username: 'Zoe', bestStreak: 10, streak: 10, bestStreakAt: 500, streakReachedAt: 500, lastVisit: TODAY }),
        user('early', { username: 'Zoe', bestStreak: 10, streak: 10, bestStreakAt: 100, streakReachedAt: 100, lastVisit: TODAY }),
        user('mid', { username: 'Amy', bestStreak: 10, streak: 10, bestStreakAt: 300, streakReachedAt: 300, lastVisit: TODAY }),
        user('none-b', { username: 'Bea', bestStreak: 7, streak: 7, lastVisit: TODAY }),
        user('none-a', { username: 'Ada', bestStreak: 7, streak: 7, lastVisit: TODAY }),
        user('known', { username: 'Zed', bestStreak: 7, streak: 7, bestStreakAt: 50, lastVisit: TODAY })
    ];
    const doc = board.buildBoards(rows, NOW);
    assert.deepStrictEqual(doc.alltime.map(function (r) { return r.username; }), ['Zoe', 'Amy', 'Zoe', 'Zed', 'Ada', 'Bea']);
    assert.strictEqual(doc.alltime[0].rank, 1);
    assert.strictEqual(doc.alltime[1].username, 'Amy');
    assert.strictEqual(doc.alltime[3].username, 'Zed');
    assert.strictEqual(doc.alltime[5].username, 'Bea');
});

test('a missing reached time sorts last, so streak order is total', () => {
    // The old compare skipped time when either side was missing:
    // Cee (time 1) before Aaa (time 2), Aaa before Bee (name), Bee before Cee (name).
    // That cycle is gone. Real times go earliest first, then nameKey, then uid.
    const cee = { uid: 'a', username: 'Cee', nameKey: 'cee', best: 5, current: 5, bestStreakAt: 1, streakReachedAt: 1 };
    const aaa = { uid: 'b', username: 'Aaa', nameKey: 'aaa', best: 5, current: 5, bestStreakAt: 2, streakReachedAt: 2 };
    const bee = { uid: 'c', username: 'Bee', nameKey: 'bee', best: 5, current: 5, bestStreakAt: 0, streakReachedAt: 0 };
    function cmp(x, y) { return board.compareBoard(x, y, 'best', 'bestStreakAt'); }
    assert.ok(cmp(cee, aaa) < 0);
    assert.ok(cmp(aaa, bee) < 0);
    assert.ok(cmp(cee, bee) < 0);
    assert.ok(cmp(aaa, cee) > 0);
    assert.ok(cmp(bee, aaa) > 0);
    assert.ok(cmp(bee, cee) > 0);
    const laterUid = { uid: 'm', username: 'Cee', nameKey: 'cee', best: 5, bestStreakAt: 1 };
    assert.ok(cmp(cee, laterUid) < 0);
    assert.deepStrictEqual(board.selectBoard([aaa, bee, cee], 'alltime').map(function (r) { return r.username; }), ['Cee', 'Aaa', 'Bee']);
    assert.deepStrictEqual(board.selectBoard([bee, aaa, cee], 'current').map(function (r) { return r.username; }), ['Cee', 'Aaa', 'Bee']);
    assert.strictEqual(board.REACHED_UNKNOWN, 9000000000000000);
});

test('best tracking keeps the earlier best and raises it when the streak passes it', () => {
    const raised = board.applyStreakUpdate({ streak: 4, bestStreak: 4, bestStreakAt: 1000 }, 5, 2000, null);
    assert.strictEqual(raised.streak, 5);
    assert.strictEqual(raised.bestStreak, 5);
    assert.strictEqual(raised.bestStreakAt, 2000);
    assert.strictEqual(raised.streakReachedAt, 2000);

    const held = board.applyStreakUpdate({ streak: 9, bestStreak: 10, bestStreakAt: 1000 }, 4, 2000, null);
    assert.strictEqual(held.bestStreak, 10);
    assert.strictEqual(held.bestStreakAt, undefined);
    assert.strictEqual(held.streakReachedAt, 2000);

    const capped = board.applyStreakUpdate({ streak: 3, bestStreak: 3, bestStreakAt: 1000 }, 40, 2000, 10);
    assert.strictEqual(capped.streak, 10);
    assert.strictEqual(capped.bestStreak, 10);
    assert.strictEqual(capped.bestStreakAt, 2000);

    const seed = board.applyStreakUpdate({}, 1, 3000, null);
    assert.strictEqual(seed.streak, 1);
    assert.strictEqual(seed.bestStreak, 1);
    assert.strictEqual(seed.bestStreakAt, 3000);
});

test('backfill raises a short best and clears a timestamp from the shorter best', () => {
    assert.deepStrictEqual(board.backfillPatch({ streak: 12, bestStreak: 4 }), { bestStreak: 12 });
    assert.deepStrictEqual(board.backfillPatch({ streak: 12, bestStreak: 4, bestStreakAt: 1000 }), { bestStreak: 12, bestStreakAt: null });
    assert.strictEqual(board.backfillPatch({ streak: 3, bestStreak: 9, bestStreakAt: 1000 }), null);
    assert.deepStrictEqual(board.backfillPatch({ streak: 5 }), { bestStreak: 5 });
    assert.strictEqual(board.backfillPatch({ streak: 0, bestStreak: 0 }), null);
    assert.strictEqual(parseArgs([]).apply, false);
    assert.strictEqual(parseArgs(['--apply']).apply, true);
    const script = read('functions/scripts/backfill_best_streak.js');
    assert.ok(script.includes('dry-run'));
    assert.ok(script.includes("argv.indexOf('--apply')"));
});

test('banned players stay, ghost mode stays off, and the doc has no email or uid', () => {
    const secret = 'uid-secret-abc';
    const doc = board.buildBoards([
        user(secret, { username: 'Banned', email: 'banned@example.com', banned: true, streak: 15, bestStreak: 15, lastVisit: TODAY, bestStreakAt: 10, streakReachedAt: 10, profilePic: 'javascript:alert(1)' }),
        user('ghost-1', { username: 'Ghost', ghostMode: true, streak: 99, bestStreak: 99, lastVisit: TODAY, bestStreakAt: 1, streakReachedAt: 1 }),
        user('plain', { username: 'player@email.test', streak: 4, bestStreak: 4, lastVisit: TODAY, bestStreakAt: 9, streakReachedAt: 9 })
    ], NOW);
    assert.deepStrictEqual(doc.alltime.map(function (r) { return r.username; }), ['Banned', 'Anon']);
    assert.deepStrictEqual(doc.current.map(function (r) { return r.username; }), ['Banned', 'Anon']);
    const packed = JSON.stringify(doc);
    assert.strictEqual(packed.indexOf(secret), -1);
    assert.strictEqual(packed.indexOf('banned@example.com'), -1);
    assert.strictEqual(packed.indexOf('player@email.test'), -1);
    assert.strictEqual(packed.indexOf('Ghost'), -1);
    assert.strictEqual(packed.indexOf('javascript:'), -1);
    doc.alltime.forEach(function (row) {
        assert.deepStrictEqual(Object.keys(row).sort(), ['profilePic', 'rank', 'streak', 'username']);
    });
    assert.strictEqual(doc.alltime.length <= board.BOARD_SIZE, true);
});

test('the board stops at 25', () => {
    const rows = [];
    for (let i = 0; i < 30; i++) {
        rows.push(user('u' + i, { username: 'N' + String(i).padStart(2, '0'), streak: i + 1, bestStreak: i + 1, lastVisit: TODAY, bestStreakAt: 1000 + i, streakReachedAt: 1000 + i }));
    }
    const doc = board.buildBoards(rows, NOW);
    assert.strictEqual(doc.alltime.length, 25);
    assert.strictEqual(doc.current.length, 25);
    assert.strictEqual(doc.alltime[0].streak, 30);
    assert.strictEqual(doc.alltime[0].username, 'N29');
    assert.strictEqual(doc.alltime[24].streak, 6);
});

test('rules block client streak writes and the cached doc is not client-writable', () => {
    const rules = read('firestore.rules');
    const start = rules.indexOf('function profileUpdateBlocked()');
    const end = rules.indexOf('function shareCardsShownOk()');
    const block = rules.slice(start, end);
    ['streak', 'bestStreak', 'streakReachedAt', 'bestStreakAt', 'lastVisit', 'nameKey'].forEach(function (field) {
        assert.ok(block.indexOf("'" + field + "'") !== -1, field);
    });
    assert.ok(rules.includes('stats/streak_leaderboard'));
    assert.strictEqual(rules.includes("statId == 'streak_leaderboard'"), false);
    const index = read('functions/index.js');
    assert.ok(index.includes('streakBoard.nextVisitStreak'));
    assert.ok(index.includes('streakBoard.applyStreakUpdate'));
    assert.ok(index.includes('exports.refreshStreakLeaderboard'));
    const indexes = read('firestore.indexes.json');
    assert.ok(indexes.includes('"fieldPath": "streak"'));
    assert.ok(indexes.includes('"fieldPath": "lastVisit"'));
});

test('the leaderboard section sits above Top Predictors and does not pop up', () => {
    const ranking = read('ranking.js');
    const html = read('index.html');
    assert.ok(ranking.indexOf('id="streakBoard"') !== -1);
    assert.ok(ranking.indexOf('id="streakBoard"') < ranking.indexOf('id="predictorBoard"'));
    assert.ok(ranking.includes("doc('streak_leaderboard')"));
    assert.strictEqual(ranking.includes(".orderBy('streak'"), false);
    const fn = ranking.slice(ranking.indexOf('function _renderStreakBoard'), ranking.indexOf('function _loadPVPLeaderboard'));
    assert.ok(fn.length > 100);
    assert.strictEqual(fn.includes('showToast'), false);
    assert.strictEqual(fn.includes('alert('), false);
    assert.ok(html.includes('@media (max-width: 360px)'));
    assert.ok(html.includes('.streak-board'));
    assert.strictEqual(html, read('404.html'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
