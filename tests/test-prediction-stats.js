// Prediction periods, qualification minimums, payout idempotency, and copy.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ps = require('../functions/src/predictionStats');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    }
}

test('week flips at Monday 05:00 UTC, not midnight', function() {
    const before = new Date('2026-10-26T04:59:59.000Z');
    const at = new Date('2026-10-26T05:00:00.000Z');
    const later = new Date('2026-10-26T18:00:00.000Z');
    const sunday = new Date('2026-10-25T23:30:00.000Z');
    assert.strictEqual(before.getUTCDay(), 1);
    assert.notStrictEqual(ps.weekKey(before), ps.weekKey(at));
    assert.strictEqual(ps.weekKey(at), ps.weekKey(later));
    assert.strictEqual(ps.weekKey(before), ps.weekKey(sunday));
    assert.strictEqual(ps.previousWeekKey(at), ps.weekKey(before));
    assert.strictEqual(ps.previousWeekKey(new Date('2026-10-27T12:00:00.000Z')), ps.weekKey(before));
});

test('month flips at 00:00 UTC on the 1st, not at 05:00', function() {
    const oct31 = new Date('2026-10-31T23:59:59.000Z');
    const nov1 = new Date('2026-11-01T00:00:00.000Z');
    const nov1early = new Date('2026-11-01T04:30:00.000Z');
    assert.strictEqual(ps.monthKey(oct31), '2026-M10');
    assert.strictEqual(ps.monthKey(nov1), '2026-M11');
    assert.strictEqual(ps.monthKey(nov1early), '2026-M11');
    assert.strictEqual(ps.previousMonthKey(nov1), '2026-M10');
    assert.strictEqual(ps.previousMonthKey(new Date('2026-11-02T15:00:00.000Z')), '2026-M10');
});

test('a resolution in a new week or month resets that period only', function() {
    const t1 = new Date('2026-10-25T12:00:00.000Z').getTime();
    let out = ps.applyResolution(null, { direction: 'up', price: 100, time: t1 - ps.WINDOW_MS }, 110, t1);
    assert.strictEqual(out.correct, true);
    assert.strictEqual(out.stats.weekTotal, 1);
    assert.strictEqual(out.stats.weekCorrect, 1);
    assert.strictEqual(out.stats.predTotal, 1);
    assert.strictEqual(out.stats.monthKey, '2026-M10');
    const sameWeek = new Date('2026-10-26T04:00:00.000Z').getTime();
    out = ps.applyResolution(out.stats, { direction: 'down', price: 110, time: sameWeek - ps.WINDOW_MS }, 120, sameWeek);
    assert.strictEqual(out.correct, false);
    assert.strictEqual(out.stats.weekTotal, 2);
    assert.strictEqual(out.stats.weekCorrect, 1);
    assert.strictEqual(out.stats.predTotal, 2);
    assert.strictEqual(out.stats.predStreak, 0);
    const newWeek = new Date('2026-10-26T05:30:00.000Z').getTime();
    out = ps.applyResolution(out.stats, { direction: 'up', price: 120, time: newWeek - ps.WINDOW_MS }, 130, newWeek);
    assert.strictEqual(out.stats.weekKey, ps.weekKey(newWeek));
    assert.notStrictEqual(out.stats.weekKey, ps.weekKey(t1));
    assert.strictEqual(out.stats.weekTotal, 1);
    assert.strictEqual(out.stats.weekCorrect, 1);
    assert.strictEqual(out.stats.predTotal, 3);
    assert.strictEqual(out.stats.monthTotal, 3);
    const newMonth = new Date('2026-11-01T00:05:00.000Z').getTime();
    out = ps.applyResolution(out.stats, { direction: 'down', price: 130, time: newMonth - ps.WINDOW_MS }, 120, newMonth);
    assert.strictEqual(out.stats.monthKey, '2026-M11');
    assert.strictEqual(out.stats.monthTotal, 1);
    assert.strictEqual(out.stats.monthCorrect, 1);
    // Nov 1 2026 is still the week that opened Monday Oct 26 05:00 UTC.
    assert.strictEqual(out.stats.weekKey, ps.weekKey(newWeek));
    assert.strictEqual(out.stats.weekTotal, 2);
    assert.strictEqual(out.stats.predTotal, 4);
    assert.strictEqual(out.stats.predLastResult.outcome, 'correct');
    assert.strictEqual(out.stats.predLastResult.startPrice, 130);
    assert.strictEqual(out.stats.predLastResult.resolvedPrice, 120);
    assert.strictEqual(out.stats.predPending, null);
});

test('flat price is wrong and a bad direction does not score correct', function() {
    const now = new Date('2026-10-20T12:00:00.000Z').getTime();
    const flat = ps.applyResolution(null, { direction: 'up', price: 50, time: now - ps.WINDOW_MS }, 50, now);
    assert.strictEqual(flat.correct, false);
    const bad = ps.applyResolution(null, { direction: 'sideways', price: 50, time: now - ps.WINDOW_MS }, 80, now);
    assert.strictEqual(bad.correct, false);
});

test('minimums are weekly 5, monthly 15, all-time 10', function() {
    assert.strictEqual(ps.MIN.weekly, 5);
    assert.strictEqual(ps.MIN.monthly, 15);
    assert.strictEqual(ps.MIN.alltime, 10);
    assert.strictEqual(ps.minimumFor('weekly'), 5);
    assert.strictEqual(ps.minimumFor('monthly'), 15);
    assert.strictEqual(ps.minimumFor('alltime'), 10);
    function row(total, correct) {
        return { uid: 'u' + total + 'x' + correct, username: 'A', correct: correct, total: total, accuracy: ps.accuracyOf(correct, total), reachedAt: 1000, satsDisabled: false };
    }
    assert.strictEqual(ps.selectBoard([row(4, 4), row(5, 3)], 'weekly').length, 1);
    assert.strictEqual(ps.selectBoard([row(5, 3)], 'weekly')[0].total, 5);
    assert.strictEqual(ps.selectBoard([row(14, 14), row(15, 8)], 'monthly').length, 1);
    assert.strictEqual(ps.selectBoard([row(9, 9), row(10, 6)], 'alltime').length, 1);
    assert.strictEqual(ps.selectBoard([row(10, 6)], 'alltime')[0].uid, 'u10x6');
});

test('tie-break is more correct, then more total, then earliest reached', function() {
    const rows = [
        { uid: 'late', correct: 5, total: 10, accuracy: ps.accuracyOf(5, 10), reachedAt: 3000 },
        { uid: 'early', correct: 5, total: 10, accuracy: ps.accuracyOf(5, 10), reachedAt: 1000 },
        { uid: 'moreCorrect', correct: 9, total: 15, accuracy: ps.accuracyOf(9, 15), reachedAt: 9000 },
        { uid: 'perfectSmall', correct: 10, total: 10, accuracy: ps.accuracyOf(10, 10), reachedAt: 5000 },
        { uid: 'banned', correct: 20, total: 20, accuracy: 10000, reachedAt: 1, satsDisabled: true },
        { uid: 'short', correct: 4, total: 4, accuracy: 10000, reachedAt: 1 }
    ];
    const board = ps.selectBoard(rows, 'alltime');
    assert.deepStrictEqual(board.map(function(r) { return r.uid; }), ['perfectSmall', 'moreCorrect', 'early', 'late']);
    assert.strictEqual(board[0].pct, 100);
    assert.strictEqual(board[1].correct, 9);
    assert.strictEqual(board[2].uid, 'early');
});

test('weekly and monthly prizes are flat 25 and 50 for each of the top 5', function() {
    for (let rank = 1; rank <= 5; rank++) {
        assert.strictEqual(ps.ticketsForRank('weekly', rank), 25);
        assert.strictEqual(ps.ticketsForRank('monthly', rank), 50);
    }
    assert.strictEqual(ps.ticketsForRank('weekly', 6), 0);
    assert.strictEqual(ps.ticketsForRank('monthly', 0), 0);
    assert.strictEqual(ps.ticketsForRank('alltime', 1), 0);
    assert.strictEqual(ps.TICKETS.weekly, 25);
    assert.strictEqual(ps.TICKETS.monthly, 50);
    assert.deepStrictEqual(ps.COPY, {
        weekly: 'This Week: make at least 5 predictions to qualify. Top 5 each win 25 orange tickets.',
        monthly: 'This Month: at least 15 predictions. Top 5 each win 50 orange tickets.',
        alltime: 'All Time: at least 10 predictions.'
    });
});

test('payout is idempotent per period and skips users already paid', function() {
    function winner(i) {
        return { uid: 'w' + i, username: 'P' + i, correct: 20 - i, total: 20, accuracy: ps.accuracyOf(20 - i, 20), reachedAt: i * 1000, satsDisabled: false };
    }
    const winners = [1, 2, 3, 4, 5, 6].map(winner);
    winners.push({ uid: 'banned', username: 'B', correct: 20, total: 20, accuracy: 10000, reachedAt: 1, satsDisabled: true });
    const first = ps.payoutPlan(null, winners, 'weekly');
    assert.strictEqual(first.action, 'pay');
    assert.strictEqual(first.needsReset, true);
    assert.strictEqual(first.due.length, 5);
    first.due.forEach(function(d) { assert.strictEqual(d.tickets, 25); });
    assert.ok(first.due.every(function(d) { return d.uid !== 'banned' && d.uid !== 'w6'; }));
    assert.deepStrictEqual(first.due.map(function(d) { return d.rank; }), [1, 2, 3, 4, 5]);

    const partial = ps.payoutPlan({ status: 'pending', awardedUids: ['w1', 'w2'], resetDone: false }, winners, 'monthly');
    assert.strictEqual(partial.action, 'pay');
    assert.deepStrictEqual(partial.due.map(function(d) { return d.uid; }), ['w3', 'w4', 'w5']);
    partial.due.forEach(function(d) { assert.strictEqual(d.tickets, 50); });

    const paidNotReset = ps.payoutPlan({ status: 'complete', awardedUids: ['w1'], resetDone: false }, winners, 'weekly');
    assert.strictEqual(paidNotReset.action, 'reset_only');
    assert.strictEqual(paidNotReset.due.length, 0);
    assert.strictEqual(paidNotReset.needsReset, true);

    const done = ps.payoutPlan({ status: 'complete', awardedUids: first.winnerUids, resetDone: true }, winners, 'weekly');
    assert.strictEqual(done.action, 'skip');
    assert.strictEqual(done.needsReset, false);
    assert.strictEqual(done.due.length, 0);
    const again = ps.payoutPlan({ status: 'complete', awardedUids: first.winnerUids, resetDone: true }, winners, 'weekly');
    assert.deepStrictEqual(again, done);
});

test('period reset zeroes the closed period and qualification follows', function() {
    const now = new Date('2026-10-26T06:00:00.000Z').getTime();
    let stats = ps.applyResolution(null, { direction: 'up', price: 1, time: now - ps.WINDOW_MS }, 2, now).stats;
    assert.strictEqual(stats.weekTotal, 1);
    assert.strictEqual(stats.qualifiesWeek, false);
    const ended = stats.weekKey;
    const current = ps.weekKey(new Date('2026-11-02T05:00:00.000Z'));
    assert.notStrictEqual(ended, current);
    const reset = ps.resetPeriodFields(stats, 'weekly', current);
    assert.strictEqual(reset.weekKey, current);
    assert.strictEqual(reset.weekTotal, 0);
    assert.strictEqual(reset.weekCorrect, 0);
    assert.strictEqual(reset.qualifiesWeek, false);
    assert.strictEqual(reset.predTotal, 1);
    const again = ps.resetPeriodFields(reset, 'weekly', current);
    assert.deepStrictEqual(again.weekTotal, reset.weekTotal);
    assert.strictEqual(again.predTotal, 1);
});

test('progress copy and made-count follow the open period', function() {
    assert.strictEqual(ps.progressLine('weekly', 3), "You've made 3 of 5 predictions this week.");
    assert.strictEqual(ps.progressLine('monthly', 3), "You've made 3 of 15 predictions this month.");
    assert.strictEqual(ps.progressLine('alltime', 3), "You've made 3 of 10 predictions.");
    assert.strictEqual(ps.progressLine('weekly', 5), '');
    assert.strictEqual(ps.progressLine('monthly', 15), '');
    assert.strictEqual(ps.progressLine('alltime', 10), '');
    const stats = { weekKey: '2026-W43', weekTotal: 3, monthKey: '2026-M10', monthTotal: 9, predTotal: 40 };
    assert.strictEqual(ps.madeCount(stats, 'weekly', '2026-W43', '2026-M10'), 3);
    assert.strictEqual(ps.madeCount(stats, 'weekly', '2026-W44', '2026-M10'), 0);
    assert.strictEqual(ps.madeCount(stats, 'monthly', '2026-W43', '2026-M10'), 9);
    assert.strictEqual(ps.madeCount(stats, 'monthly', '2026-W43', '2026-M11'), 0);
    assert.strictEqual(ps.madeCount(stats, 'alltime', '2026-W43', '2026-M10'), 40);
    assert.strictEqual(ps.boardInfo('weekly'), ps.COPY.weekly);
});

test('backfill recomputes from records, keeps legacy totals, and is idempotent', function() {
    const now = new Date('2026-10-26T12:00:00.000Z').getTime();
    const wk = ps.weekKey(now);
    const inWeek = new Date('2026-10-26T06:00:00.000Z').getTime();
    const old = new Date('2026-09-01T12:00:00.000Z').getTime();
    assert.strictEqual(ps.weekKey(inWeek), wk);
    assert.notStrictEqual(ps.weekKey(old), wk);
    const input = {
        uid: 'abc',
        now: now,
        legacy: { predictions: { total: 10, correct: 4, streak: 2, bestStreak: 3, lastResolved: old } },
        records: [
            { direction: 'up', startPrice: 100, resolvedPrice: 110, correct: true, time: inWeek - ps.WINDOW_MS, resolvedAt: inWeek },
            { direction: 'down', startPrice: 110, resolvedPrice: 120, outcome: 'wrong', time: inWeek - 1000, resolvedAt: inWeek + 1000 }
        ],
        active: { direction: 'up', price: 130, time: now - 3600000 }
    };
    const a = ps.recomputeUser(input);
    const b = ps.recomputeUser(input);
    assert.deepStrictEqual(a, b);
    assert.strictEqual(a.skip, false);
    assert.strictEqual(a.source, 'legacy_plus_records');
    assert.strictEqual(a.stats.predTotal, 12);
    assert.strictEqual(a.stats.predCorrect, 5);
    assert.strictEqual(a.stats.weekTotal, 2);
    assert.strictEqual(a.stats.weekCorrect, 1);
    assert.strictEqual(a.stats.predLastResult.outcome, 'wrong');
    assert.strictEqual(a.stats.predLastResult.startPrice, 110);
    assert.strictEqual(a.stats.predLastResult.resolvedPrice, 120);
    assert.strictEqual(a.stats.predPending.direction, 'up');
    assert.strictEqual(a.stats.predPending.startPrice, 130);
    assert.ok(a.gaps.indexOf('pending_open') !== -1);
    assert.ok(a.gaps.indexOf('period_history_not_in_legacy_aggregate') !== -1);

    const legacyOnly = ps.recomputeUser({
        uid: 'leg',
        now: now,
        legacy: { predictions: { total: 8, correct: 3 } },
        records: [],
        active: null
    });
    assert.strictEqual(legacyOnly.stats.predTotal, 8);
    assert.strictEqual(legacyOnly.stats.predCorrect, 3);
    assert.strictEqual(legacyOnly.stats.predLastResult, null);
    assert.strictEqual(legacyOnly.stats.weekTotal, 0);
    assert.ok(legacyOnly.gaps.indexOf('no_prediction_records') !== -1);
    assert.ok(legacyOnly.gaps.indexOf('last_result_prices_unknown') !== -1);
    assert.ok(legacyOnly.gaps.indexOf('period_counters_unknown') !== -1);

    const past = ps.recomputeUser({
        uid: 'wait',
        now: now,
        legacy: null,
        records: [],
        active: { direction: 'down', price: 50, time: now - ps.WINDOW_MS - 1000 }
    });
    assert.ok(past.gaps.indexOf('pending_past_window') !== -1);
    assert.strictEqual(past.stats.predTotal, 0);
    assert.strictEqual(past.stats.predPending.direction, 'down');

    const none = ps.recomputeUser({ uid: 'empty', now: now, legacy: null, records: [], active: null });
    assert.strictEqual(none.skip, true);
    assert.ok(none.gaps.indexOf('no_prediction_data') !== -1);
});

test('client copy, aria hook, and server-only scoring are wired', function() {
    const root = path.join(__dirname, '..');
    const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
    const features = fs.readFileSync(path.join(root, 'features.js'), 'utf8');
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    assert.ok(ranking.indexOf(ps.COPY.weekly) !== -1);
    assert.ok(ranking.indexOf(ps.COPY.monthly) !== -1);
    assert.ok(ranking.indexOf(ps.COPY.alltime) !== -1);
    assert.ok(ranking.indexOf('aria-label="How Top Predictors works"') !== -1);
    assert.ok(ranking.indexOf('aria-expanded') !== -1);
    assert.ok(ranking.indexOf("setAttribute('aria-describedby', 'predLbTip')") !== -1);
    assert.ok(ranking.indexOf("setAttribute('role', 'tooltip')") !== -1);
    assert.ok(ranking.indexOf("You've made ") !== -1);
    assert.ok(features.indexOf('Correct ✅') !== -1 || features.indexOf('Correct \\u2705') !== -1 || features.indexOf('outcome === \'correct\'') !== -1);
    assert.ok(features.indexOf('serverTimestamp') !== -1);
    assert.ok(!/predictions\.correct/.test(features));
    assert.ok(!/predictions\.total/.test(features));
    assert.ok(!/active_predictions'\)\.doc\([^)]*\)\.delete/.test(features));
    assert.ok(features.indexOf('awardPoints(25') === -1);
    assert.ok(rules.indexOf("'predCorrect'") !== -1);
    assert.ok(rules.indexOf("'predTotal'") !== -1);
    assert.ok(rules.indexOf("'predLastResult'") !== -1);
    assert.ok(rules.indexOf('match /prediction_stats/{uid}') !== -1);
    const activeBlock = rules.split('match /active_predictions/{uid}')[1].split('match /')[0];
    assert.ok(/allow delete: if false;/.test(activeBlock));
    assert.ok(!/allow delete: if request\.auth/.test(activeBlock));
    const script = fs.readFileSync(path.join(root, 'functions/backfill-prediction-stats.js'), 'utf8');
    assert.ok(script.indexOf("indexOf('--apply')") !== -1);
    assert.ok(script.indexOf('applicationDefault') !== -1);
    assert.ok(script.indexOf('service-account') === -1);
    assert.ok(script.indexOf('recomputeUser') !== -1);
    assert.ok(script.indexOf('refreshLeaderboard') !== -1);
    assert.ok(script.indexOf('dry-run') !== -1);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
