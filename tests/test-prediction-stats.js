// Prediction periods, qualification minimums, payout idempotency, and copy.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ps = require('../functions/src/predictionStats');
const awardActions = require('../functions/src/awardActions');

let passed = 0;
let failed = 0;
const queue = [];

function test(name, fn) {
    queue.push({ name: name, fn: fn });
}

function mark(price, when) {
    return { serverStartPrice: price, serverPriceSetAt: Number(when) > 0 ? Number(when) : 1 };
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
    let out = ps.applyResolution(null, { direction: 'up', price: 1, time: t1 - ps.WINDOW_MS }, 110, t1, mark(100));
    assert.strictEqual(out.correct, true);
    assert.strictEqual(out.stats.weekTotal, 1);
    assert.strictEqual(out.stats.weekCorrect, 1);
    assert.strictEqual(out.stats.predTotal, 1);
    assert.strictEqual(out.stats.monthKey, '2026-M10');
    const sameWeek = new Date('2026-10-26T04:00:00.000Z').getTime();
    out = ps.applyResolution(out.stats, { direction: 'down', price: 1, time: sameWeek - ps.WINDOW_MS }, 120, sameWeek, mark(110));
    assert.strictEqual(out.correct, false);
    assert.strictEqual(out.stats.weekTotal, 2);
    assert.strictEqual(out.stats.weekCorrect, 1);
    assert.strictEqual(out.stats.predTotal, 2);
    assert.strictEqual(out.stats.predStreak, 0);
    const newWeek = new Date('2026-10-26T05:30:00.000Z').getTime();
    out = ps.applyResolution(out.stats, { direction: 'up', price: 1, time: newWeek - ps.WINDOW_MS }, 130, newWeek, mark(120));
    assert.strictEqual(out.stats.weekKey, ps.weekKey(newWeek));
    assert.notStrictEqual(out.stats.weekKey, ps.weekKey(t1));
    assert.strictEqual(out.stats.weekTotal, 1);
    assert.strictEqual(out.stats.weekCorrect, 1);
    assert.strictEqual(out.stats.predTotal, 3);
    assert.strictEqual(out.stats.monthTotal, 3);
    const newMonth = new Date('2026-11-01T00:05:00.000Z').getTime();
    out = ps.applyResolution(out.stats, { direction: 'down', price: 1, time: newMonth - ps.WINDOW_MS }, 120, newMonth, mark(130));
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
    const flat = ps.applyResolution(null, { direction: 'up', price: 1, time: now - ps.WINDOW_MS }, 50, now, mark(50));
    assert.strictEqual(flat.correct, false);
    assert.strictEqual(flat.void, undefined);
    const bad = ps.applyResolution(null, { direction: 'sideways', price: 1, time: now - ps.WINDOW_MS }, 80, now, mark(50));
    assert.strictEqual(bad.correct, false);
});

test('a client-forged start price is ignored unless the server wrote it', function() {
    const now = new Date('2026-10-20T12:00:00.000Z').getTime();
    const when = now - ps.WINDOW_MS;
    const forged = {
        direction: 'up',
        price: 1,
        serverStartPrice: 1,
        void: true,
        voidReason: 'skip',
        time: when
    };
    // Up from the forged start of 1 to 90 would be a win. The server recorded 100, so it is a loss.
    const farm = ps.applyResolution(null, forged, 90, now, mark(100, when));
    assert.strictEqual(farm.void, undefined);
    assert.strictEqual(farm.correct, false);
    assert.strictEqual(farm.stats.predTotal, 1);
    assert.strictEqual(farm.stats.predCorrect, 0);
    assert.strictEqual(farm.stats.weekTotal, 1);
    assert.strictEqual(farm.stats.predLastResult.startPrice, 100);
    assert.strictEqual(farm.stats.predLastResult.outcome, 'wrong');
    const honest = ps.applyResolution(null, forged, 110, now, mark(100, when));
    assert.strictEqual(honest.correct, true);
    assert.strictEqual(honest.stats.predLastResult.startPrice, 100);

    const prior = ps.applyResolution(null, { direction: 'up', price: 1, serverStartPrice: 1, time: when - ps.WINDOW_MS }, 110, when, mark(100, when)).stats;
    assert.strictEqual(prior.predTotal, 1);
    const missing = ps.applyResolution(prior, forged, 2, now, null);
    assert.strictEqual(missing.void, true);
    assert.strictEqual(missing.reason, 'missing_server_start_price');
    assert.strictEqual(missing.stats.predTotal, 1);
    assert.strictEqual(missing.stats.predCorrect, 1);
    assert.strictEqual(missing.stats.weekTotal, prior.weekTotal);
    assert.strictEqual(missing.stats.predLastResult.outcome, 'void');
    const unmarked = ps.applyResolution(prior, forged, 200, now, { serverStartPrice: 1 });
    assert.strictEqual(unmarked.void, true);
    assert.strictEqual(unmarked.reason, 'missing_server_start_price');
    assert.strictEqual(unmarked.stats.predTotal, 1);
    assert.strictEqual(unmarked.stats.predCorrect, 1);
    const clientVoid = ps.applyResolution(prior, forged, 200, now, null);
    assert.strictEqual(clientVoid.void, true);
    assert.notStrictEqual(clientVoid.reason, 'skip');

    const pending = ps.setPending(null, { direction: 'up', price: 1, serverStartPrice: 1, time: now }, mark(42000, now));
    assert.strictEqual(pending.predPending.startPrice, 42000);
    const ignored = ps.setPending(null, { direction: 'up', price: 1, serverStartPrice: 999, void: true, time: now }, null);
    assert.strictEqual(ignored.predPending, null);
    const ignoredUnmarked = ps.setPending(null, { direction: 'up', price: 1, serverStartPrice: 999, time: now }, { serverStartPrice: 999 });
    assert.strictEqual(ignoredUnmarked.predPending, null);
    assert.strictEqual(ps.resolutionDecision(forged, null).action, 'void');
    assert.strictEqual(ps.resolutionDecision(forged, { serverStartPrice: 100 }).action, 'void');
    const scored = ps.resolutionDecision(forged, mark(100, now));
    assert.strictEqual(scored.action, 'score');
    assert.strictEqual(scored.startPrice, 100);
    assert.strictEqual(ps.trustedStartPrice({ serverStartPrice: 1, serverPriceSetAt: 0 }), null);
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

test('banned users stay on the board and are not paid or replaced', function() {
    function row(uid, correct, extra) {
        return Object.assign({
            uid: uid,
            username: uid,
            correct: correct,
            total: 20,
            accuracy: ps.accuracyOf(correct, 20),
            reachedAt: 1000,
            satsDisabled: false,
            ledgerBanned: false
        }, extra || {});
    }
    const rows = [
        row('sats', 20, { satsDisabled: true }),
        row('ledger', 19, { ledgerBanned: true }),
        row('next', 18),
        row('after', 10)
    ];
    const board = ps.selectBoard(rows, 'alltime');
    assert.deepStrictEqual(board.map(function(r) { return r.uid; }), ['sats', 'ledger', 'next', 'after']);
    assert.strictEqual(board[0].rank, 1);
    assert.strictEqual(board[0].banned, true);
    assert.strictEqual(board[2].rank, 3);
    assert.strictEqual(board[2].banned, false);
    const paid = ps.payoutPlan(null, rows, 'weekly');
    assert.deepStrictEqual(paid.due.map(function(d) { return d.uid; }), ['next', 'after']);
    assert.ok(paid.winnerUids.indexOf('sats') !== -1);
    rows.unshift({ uid: 'ghost', username: 'G', correct: 20, total: 20, accuracy: 10000, reachedAt: 1, ghostMode: true });
    const withGhost = ps.selectBoard(rows, 'alltime');
    assert.ok(withGhost.every(function(r) { return r.uid !== 'ghost'; }));
    assert.strictEqual(withGhost[0].uid, 'sats');
    assert.strictEqual(ps.winnerSkipReason(false, null, null), 'missing_user');
    assert.strictEqual(ps.winnerSkipReason(true, { satsDisabled: true }, { banned: false }), 'sats_banned');
    assert.strictEqual(ps.winnerSkipReason(true, { satsDisabled: false }, { banned: true }), 'sats_banned');
    assert.strictEqual(ps.winnerSkipReason(true, { satsDisabled: false }, null), '');
    assert.strictEqual(ps.isSatsBanned({ satsDisabled: true }, null), true);
    assert.strictEqual(ps.isSatsBanned(null, { banned: true }), true);
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
    assert.deepStrictEqual(board.map(function(r) { return r.uid; }), ['banned', 'perfectSmall', 'moreCorrect', 'early', 'late']);
    assert.strictEqual(board[0].banned, true);
    assert.strictEqual(board[1].pct, 100);
    assert.strictEqual(board[2].correct, 9);
    assert.strictEqual(board[3].uid, 'early');
});

test('weekly and monthly prizes are flat 25 and 100 for each of the top 10', function() {
    for (let rank = 1; rank <= 10; rank++) {
        assert.strictEqual(ps.ticketsForRank('weekly', rank), 25);
        assert.strictEqual(ps.ticketsForRank('monthly', rank), 100);
    }
    assert.strictEqual(ps.ticketsForRank('weekly', 11), 0);
    assert.strictEqual(ps.ticketsForRank('monthly', 0), 0);
    assert.strictEqual(ps.ticketsForRank('alltime', 1), 0);
    assert.strictEqual(ps.TICKETS.weekly, 25);
    assert.strictEqual(ps.TICKETS.monthly, 100);
    assert.strictEqual(ps.PAYOUT_SIZE, 10);
    assert.deepStrictEqual(ps.COPY, {
        weekly: 'This Week: make at least 5 predictions to qualify. Top 10 each win 25 orange tickets.',
        monthly: 'This Month: at least 15 predictions. Top 10 each win 100 orange tickets.',
        alltime: 'All Time: at least 10 predictions.'
    });
    assert.strictEqual(ps.boardEligible({ weekTotal: 5, weekCorrect: 3, qualifiesWeek: false }, 'weekly'), true);
    assert.strictEqual(ps.boardEligible({ weekTotal: 4, qualifiesWeek: true }, 'weekly'), false);
    assert.strictEqual(ps.boardEligible({ monthTotal: 15, qualifiesMonth: false }, 'monthly'), true);
});

test('payout is idempotent per period and skips users already paid', function() {
    function winner(i) {
        return { uid: 'w' + i, username: 'P' + i, correct: 20 - i, total: 20, accuracy: ps.accuracyOf(20 - i, 20), reachedAt: i * 1000, satsDisabled: false };
    }
    const winners = [1, 2, 3, 4, 5, 6].map(winner);
    winners.push({ uid: 'banned', username: 'B', correct: 20, total: 20, accuracy: 10000, reachedAt: 1, satsDisabled: true });
    winners.push({ uid: 'ledger', username: 'L', correct: 20, total: 20, accuracy: 10000, reachedAt: 1, ledgerBanned: true, satsDisabled: false });
    const first = ps.payoutPlan(null, winners, 'weekly');
    assert.strictEqual(first.action, 'pay');
    assert.strictEqual(first.needsReset, true);
    assert.strictEqual(first.due.length, 6);
    first.due.forEach(function(d) { assert.strictEqual(d.tickets, 25); });
    assert.ok(first.due.every(function(d) { return d.uid !== 'banned' && d.uid !== 'ledger'; }));
    assert.deepStrictEqual(first.due.map(function(d) { return d.uid; }), ['w1', 'w2', 'w3', 'w4', 'w5', 'w6']);
    assert.strictEqual(first.due[0].rank, 3);

    const partial = ps.payoutPlan({ status: 'pending', awardedUids: ['w1', 'w2'], resetDone: false }, winners, 'monthly');
    assert.strictEqual(partial.action, 'pay');
    assert.deepStrictEqual(partial.due.map(function(d) { return d.uid; }), ['w3', 'w4', 'w5', 'w6']);
    partial.due.forEach(function(d) { assert.strictEqual(d.tickets, 100); });

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
    let stats = ps.applyResolution(null, { direction: 'up', price: 1, time: now - ps.WINDOW_MS }, 2, now, mark(1)).stats;
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

test('backfill reads dotted legacy fields, prefers the larger total, and seeds all-time only', function() {
    const backfill = require('../functions/backfill-prediction-stats');
    const now = new Date('2026-10-26T12:00:00.000Z').getTime();
    const old = new Date('2026-09-01T12:00:00.000Z').getTime();
    const dottedOnly = backfill.legacyFromUser({
        'predictions.total': 20,
        'predictions.correct': 5,
        'predictions.lastResolved': old,
        'predictions.streak': 2,
        'predictions.bestStreak': 4
    });
    assert.strictEqual(dottedOnly.shape, 'dotted');
    assert.strictEqual(dottedOnly.total, 20);
    assert.strictEqual(dottedOnly.correct, 5);
    const seeded = ps.recomputeUser({
        uid: 'dot',
        now: now,
        legacy: dottedOnly.legacy,
        records: [],
        active: null
    });
    assert.strictEqual(seeded.stats.predTotal, 20);
    assert.strictEqual(seeded.stats.predCorrect, 5);
    assert.strictEqual(seeded.stats.predAccuracy, ps.accuracyOf(5, 20));
    assert.strictEqual(seeded.stats.weekTotal, 0);
    assert.strictEqual(seeded.stats.weekCorrect, 0);
    assert.strictEqual(seeded.stats.monthTotal, 0);
    assert.strictEqual(seeded.stats.monthCorrect, 0);
    assert.strictEqual(seeded.stats.weekAccuracy, 0);
    assert.strictEqual(seeded.stats.monthAccuracy, 0);
    assert.strictEqual(seeded.stats.qualifiesWeek, false);
    assert.strictEqual(seeded.stats.qualifiesMonth, false);
    assert.strictEqual(seeded.stats.predStreak, 2);
    assert.strictEqual(seeded.stats.predBestStreak, 4);
    assert.strictEqual(seeded.stats.reachedAt, old);

    const nestedOnly = backfill.legacyFromUser({ predictions: { total: 8, correct: 3, lastResolved: old } });
    assert.strictEqual(nestedOnly.shape, 'nested');
    assert.strictEqual(ps.recomputeUser({
        uid: 'nest', now: now, legacy: nestedOnly.legacy, records: [], active: null
    }).stats.predTotal, 8);

    const dottedWins = backfill.legacyFromUser({
        'predictions.total': 15,
        'predictions.correct': 9,
        'predictions.lastResolved': old,
        predictions: { total: 4, correct: 4, lastResolved: now }
    });
    assert.strictEqual(dottedWins.shape, 'both_shapes_prefer_dotted');
    assert.strictEqual(dottedWins.total, 15);
    assert.strictEqual(dottedWins.correct, 9);
    assert.strictEqual(dottedWins.legacy.predictions.lastResolved, old);

    const nestedWins = backfill.legacyFromUser({
        'predictions.total': 3,
        'predictions.correct': 1,
        predictions: { total: 12, correct: 6, lastResolved: old }
    });
    assert.strictEqual(nestedWins.shape, 'both_shapes_prefer_nested');
    assert.strictEqual(nestedWins.total, 12);
    assert.strictEqual(nestedWins.correct, 6);
    const fromNested = ps.recomputeUser({
        uid: 'both', now: now, legacy: nestedWins.legacy, records: [], active: null
    });
    assert.strictEqual(fromNested.stats.predTotal, 12);
    assert.strictEqual(fromNested.stats.predCorrect, 6);
    assert.strictEqual(fromNested.stats.predAccuracy, ps.accuracyOf(6, 12));
    assert.strictEqual(fromNested.stats.weekTotal, 0);
    assert.strictEqual(fromNested.stats.monthTotal, 0);

    const empty = backfill.legacyFromUser({ username: 'x', 'predictions.total': 0 });
    assert.strictEqual(empty.total, 0);
    assert.strictEqual(backfill.legacyFromUser({ username: 'y' }).shape, 'none');

    const script = fs.readFileSync(path.join(__dirname, '..', 'functions/backfill-prediction-stats.js'), 'utf8');
    assert.ok(script.indexOf("'predictions.' + key") !== -1);
    assert.ok(script.indexOf("'total', 'correct', 'streak', 'bestStreak', 'lastResolved'") !== -1);
    assert.ok(script.indexOf('both_shapes_prefer_dotted') !== -1);
    assert.ok(script.indexOf('both_shapes_prefer_nested') !== -1);
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
    assert.ok(features.indexOf("db.collection('prediction_stats')") !== -1);
    const statsFn = features.slice(features.indexOf('window.getPredictionStats'), features.indexOf('// Cache global prediction stats'));
    assert.ok(statsFn.indexOf('_serverPred') !== -1);
    assert.ok(statsFn.indexOf('.predictions') === -1);
    assert.ok(statsFn.indexOf("['predictions.total']") === -1);
    assert.ok(ranking.indexOf('settingsPredStats') !== -1);
    assert.ok(ranking.indexOf('stats.predTotal') !== -1);
    assert.ok(ranking.indexOf('getPredictionStats(currentUser)') === -1);
    const messaging = fs.readFileSync(path.join(root, 'messaging.js'), 'utf8');
    assert.ok(messaging.indexOf('profilePredStats') !== -1);
    assert.ok(messaging.indexOf('u.predictions') === -1);
    assert.ok(!/predictions\.correct/.test(features));
    assert.ok(!/predictions\.total/.test(features));
    assert.ok(!/active_predictions'\)\.doc\([^)]*\)\.delete/.test(features));
    assert.ok(features.indexOf('awardPoints(25') === -1);
    const keysFn = rules.slice(rules.indexOf('function userProfileServerOnlyKeys()'), rules.indexOf('match /users/{userId}'));
    ['predCorrect', 'predTotal', 'predLastResult'].forEach(function (field) {
        assert.ok(keysFn.indexOf("'" + field + "'") !== -1, field);
    });
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
    const jobs = fs.readFileSync(path.join(root, 'functions/src/predictionJobs.js'), 'utf8');
    const index = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    assert.ok(jobs.indexOf('serverStartPrice') !== -1);
    assert.ok(jobs.indexOf('serverPriceSetAt') !== -1);
    assert.ok(jobs.indexOf("collection('prediction_server')") !== -1);
    assert.ok(jobs.indexOf('faucet_ledger') !== -1);
    assert.ok(jobs.indexOf('no longer grants tickets') !== -1);
    const prizes = fs.readFileSync(path.join(root, 'functions/src/lbPrizes.js'), 'utf8');
    assert.ok(prizes.indexOf('rewardBlocked') !== -1);
    assert.ok(index.indexOf('settlePrediction') !== -1);
    assert.ok(jobs.indexOf('price: live.price') === -1);
    assert.ok(jobs.indexOf('startPrice: Number(live.price)') === -1);
    assert.ok(jobs.indexOf('serverStartPriceOf') === -1);
    assert.ok(!/where\(\s*'resolved'\s*,\s*'=='\s*,\s*false\s*\)/.test(jobs));
    assert.ok(!/resolutionDecision\(\s*live\s*\)/.test(jobs));
    assert.ok(!/resolutionDecision\(\s*doc\.data\(\)\s*(?:\|\|\s*\{\s*\})?\s*\)/.test(jobs));
    const sync = jobs.slice(jobs.indexOf('async function syncPending'), jobs.indexOf('loadRows: loadRows'));
    assert.ok(sync.indexOf('getPrice()') !== -1);
    assert.ok(!/data\.void\s*===/.test(sync));
    assert.ok(!/tx\.set\(\s*activeRef/.test(sync));
    assert.ok(sync.indexOf('serverPriceSetAt') !== -1);
    const one = jobs.slice(jobs.indexOf('async function resolveOne'), jobs.indexOf('async function resolveDue'));
    const serverRead = one.indexOf('tx.get(serverRef)');
    const firstWrite = one.indexOf('tx.set(');
    assert.ok(serverRead > 0 && firstWrite > serverRead);
    assert.ok(index.indexOf('syncPending(uid, after.data() || {}, _btcUsd)') !== -1);
    assert.ok(index.indexOf("actionKey === 'prediction_correct'") !== -1);
    assert.ok(index.indexOf("'prediction_correct': 25") === -1);
    assert.ok(index.indexOf("'prediction_correct': ['prediction_correct', 'correct prediction']") === -1);
    const made = awardActions.resolveAction({ action: '📈 Price prediction made', pts: 5 });
    assert.strictEqual(made.ok, true);
    assert.strictEqual(made.id, 'prediction');
    assert.strictEqual(made.xp, 5);
});

test('create rule rejects a client server price, void, extra keys, and a missing resolved flag', function() {
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    const activeBlock = rules.split('match /active_predictions/{uid}')[1].split('match /')[0];
    assert.ok(activeBlock.includes("keys().hasOnly(['uid', 'direction', 'price', 'time', 'resolved'])"));
    assert.ok(activeBlock.includes('request.resource.data.resolved == false'));
    assert.ok(!/keys\(\)\.hasAll\(/.test(activeBlock));
    assert.ok(/allow update: if false;/.test(activeBlock));
    assert.ok(/allow delete: if false;/.test(activeBlock));
    const serverBlock = rules.split('match /prediction_server/{docId}')[1].split('match /')[0];
    assert.ok(serverBlock.includes('allow read, write: if false'));
    const listed = activeBlock.match(/keys\(\)\.hasOnly\(\[([^\]]+)\]\)/);
    assert.ok(listed);
    const allowed = listed[1].split(',').map(function(part) { return part.trim().replace(/['"]/g, ''); });
    assert.deepStrictEqual(allowed, ['uid', 'direction', 'price', 'time', 'resolved']);

    function createAllowed(data) {
        const keys = Object.keys(data);
        for (let i = 0; i < keys.length; i++) {
            if (allowed.indexOf(keys[i]) === -1) return false;
        }
        if (data.resolved !== false) return false;
        if (data.direction !== 'up' && data.direction !== 'down') return false;
        if (!(typeof data.price === 'number' && data.price > 0)) return false;
        if (typeof data.uid !== 'string' || !data.uid) return false;
        if (data.time == null) return false;
        return true;
    }
    const ok = { uid: 'abc', direction: 'up', price: 100, time: 1, resolved: false };
    assert.strictEqual(createAllowed(ok), true);
    assert.strictEqual(createAllowed(Object.assign({ serverStartPrice: 1 }, ok)), false);
    assert.strictEqual(createAllowed(Object.assign({ void: true }, ok)), false);
    assert.strictEqual(createAllowed(Object.assign({ extra: true }, ok)), false);
    const missing = { uid: ok.uid, direction: ok.direction, price: ok.price, time: ok.time };
    assert.strictEqual(createAllowed(missing), false);
    assert.strictEqual(createAllowed(Object.assign({}, ok, { resolved: true })), false);
});

function memoryDb(initial) {
    const store = {};
    Object.keys(initial || {}).forEach(function(key) {
        store[key] = JSON.parse(JSON.stringify(initial[key]));
    });
    function clone(value) {
        return value == null ? value : JSON.parse(JSON.stringify(value));
    }
    function write(path, data, opts) {
        if (opts && opts.merge && store[path]) store[path] = Object.assign({}, store[path], clone(data));
        else store[path] = clone(data);
    }
    function snapOf(path) {
        const exists = Object.prototype.hasOwnProperty.call(store, path);
        return {
            exists: exists,
            id: path.split('/').pop(),
            data: function() { return exists ? clone(store[path]) : undefined; }
        };
    }
    function refOf(path) {
        return {
            path: path,
            id: path.split('/').pop(),
            collection: function(name) {
                return { doc: function(id) { return refOf(path + '/' + name + '/' + id); } };
            },
            get: async function() { return snapOf(path); },
            set: async function(data, opts) { write(path, data, opts); },
            update: async function(data) { write(path, data, { merge: true }); },
            delete: async function() { delete store[path]; }
        };
    }
    function emptyQuery() {
        return {
            where: function() { return emptyQuery(); },
            orderBy: function() { return emptyQuery(); },
            limit: function() { return emptyQuery(); },
            get: async function() {
                return { empty: true, size: 0, docs: [], forEach: function() {} };
            }
        };
    }
    const db = {
        collection: function(name) {
            return {
                doc: function(id) { return refOf(name + '/' + id); },
                where: function() { return emptyQuery(); },
                orderBy: function() { return emptyQuery(); },
                limit: function() { return emptyQuery(); },
                get: async function() {
                    const docs = Object.keys(store).filter(function(key) {
                        return key.indexOf(name + '/') === 0;
                    }).map(function(key) {
                        return {
                            id: key.slice(name.length + 1),
                            ref: refOf(key),
                            data: function() { return clone(store[key]); }
                        };
                    });
                    return {
                        empty: docs.length === 0,
                        size: docs.length,
                        docs: docs,
                        forEach: function(fn) { docs.forEach(fn); }
                    };
                }
            };
        },
        getAll: async function() {
            return Array.prototype.slice.call(arguments).map(function(ref) { return snapOf(ref.path); });
        },
        runTransaction: async function(fn) {
            const writes = [];
            const tx = {
                get: async function(ref) { return snapOf(ref.path); },
                set: function(ref, data, opts) { writes.push(function() { write(ref.path, data, opts); }); },
                update: function(ref, data) { writes.push(function() { write(ref.path, data, { merge: true }); }); },
                delete: function(ref) { writes.push(function() { delete store[ref.path]; }); }
            };
            const result = await fn(tx);
            writes.forEach(function(job) { job(); });
            return result;
        }
    };
    return { db: db, store: store };
}

test('resolver fetches over a forged price and scores only the server marker', async function() {
    const { createPredictionJobs } = require('../functions/src/predictionJobs');
    const admin = {
        firestore: {
            FieldValue: {
                increment: function(n) { return { __inc: n }; },
                serverTimestamp: function() { return { __ts: true }; },
                arrayUnion: function(v) { return { __arr: v }; }
            }
        }
    };
    const placed = Date.now() - ps.WINDOW_MS - 5000;
    const forged = {
        uid: 'u1',
        direction: 'up',
        price: 1,
        serverStartPrice: 1,
        void: true,
        voidReason: 'skip',
        time: placed
    };
    const mem = memoryDb({
        'active_predictions/u1': forged,
        'users/u1': { username: 'A', points: 10 }
    });
    const jobs = createPredictionJobs(mem.db, admin);
    let fetches = 0;
    const pending = await jobs.syncPending('u1', forged, async function() {
        fetches++;
        return 50000;
    });
    assert.strictEqual(fetches, 1);
    assert.strictEqual(pending.serverStartPrice, 50000);
    const serverId = 'prediction_server/' + ps.serverDocId('u1', placed);
    assert.strictEqual(mem.store[serverId].serverStartPrice, 50000);
    assert.ok(mem.store[serverId].serverPriceSetAt > 0);
    assert.strictEqual(mem.store['active_predictions/u1'].serverStartPrice, 1);
    assert.strictEqual(mem.store['active_predictions/u1'].void, true);
    assert.strictEqual(mem.store['prediction_stats/u1'].predPending.startPrice, 50000);

    delete mem.store[serverId];
    mem.store['active_predictions/u1'] = {
        uid: 'u1',
        direction: 'up',
        price: 1,
        serverStartPrice: 1,
        time: placed
    };
    const open = await jobs.resolveDue(async function() { return 90; });
    assert.strictEqual(open.voided, 1);
    assert.strictEqual(open.resolved, 0);
    assert.ok(!mem.store['prediction_records/' + ps.serverDocId('u1', placed)]);
    assert.strictEqual(mem.store['prediction_stats/u1'].predLastResult.outcome, 'void');
    assert.strictEqual(mem.store['users/u1'].points, 10);
    assert.ok(!mem.store['active_predictions/u1']);

    mem.store['active_predictions/u1'] = {
        uid: 'u1',
        direction: 'up',
        price: 1,
        serverStartPrice: 1,
        void: true,
        time: placed
    };
    assert.strictEqual(Object.prototype.hasOwnProperty.call(mem.store['active_predictions/u1'], 'resolved'), false);
    mem.store[serverId] = { uid: 'u1', time: placed, serverStartPrice: 100, serverPriceSetAt: placed };
    const scored = await jobs.resolveDue(async function() { return 90; });
    assert.strictEqual(scored.resolved, 1);
    assert.strictEqual(scored.correct, 0);
    const record = mem.store['prediction_records/' + ps.serverDocId('u1', placed)];
    assert.strictEqual(record.startPrice, 100);
    assert.strictEqual(record.correct, false);
    assert.strictEqual(record.resolvedPrice, 90);
    assert.strictEqual(mem.store['prediction_stats/u1'].predTotal, 1);
    assert.strictEqual(mem.store['prediction_stats/u1'].predCorrect, 0);
    assert.strictEqual(mem.store['prediction_stats/u1'].predLastResult.startPrice, 100);
    assert.strictEqual(mem.store['users/u1'].points, 10);
    assert.ok(!mem.store['active_predictions/u1']);
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
    process.exit(failed > 0 ? 1 : 0);
}

run();
