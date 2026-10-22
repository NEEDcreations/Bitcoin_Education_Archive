/**
 * Price-prediction scoring, period keys, leaderboard order, and payouts.
 * Pure: no Firebase. Cloud Functions and the backfill script both use this.
 *
 * Period boundaries match the XP leaderboard resets:
 *   week  — Monday 05:00 UTC (resetWeeklyXP: "0 5 * * 1")
 *   month — 1st 00:00 UTC   (resetMonthlyXP: "0 0 1 * *")
 */

const WEEK_RESET_HOUR_UTC = 5;
const WINDOW_MS = 24 * 60 * 60 * 1000;
const CORRECT_XP = 25;
const BOARD_SIZE = 25;
const PAYOUT_SIZE = 5;
const UNKNOWN_REACHED = 9000000000000000;

const MIN = { weekly: 5, monthly: 15, alltime: 10 };

// Flat prizes. Every rank in the top 5 of a period gets the same amount.
const TICKETS = { weekly: 25, monthly: 50 };

const COPY = {
    weekly: 'This Week: make at least 5 predictions to qualify. Top 5 each win 25 orange tickets.',
    monthly: 'This Month: at least 15 predictions. Top 5 each win 50 orange tickets.',
    alltime: 'All Time: at least 10 predictions.'
};

function timeMs(value) {
    if (value == null) return 0;
    if (typeof value === 'number' && isFinite(value)) return value;
    if (typeof value === 'string' && /^[0-9]+$/.test(value)) return parseInt(value, 10);
    if (value instanceof Date) return value.getTime();
    if (typeof value.toMillis === 'function') {
        const ms = value.toMillis();
        return typeof ms === 'number' && isFinite(ms) ? ms : 0;
    }
    if (typeof value.seconds === 'number') {
        return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
    }
    return 0;
}

function asDate(value) {
    if (value instanceof Date) return value;
    return new Date(timeMs(value) || Number(value) || 0);
}

function isoWeekKeyFromUtc(utcMs) {
    const date = new Date(utcMs);
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return d.getUTCFullYear() + '-W' + String(weekNo).padStart(2, '0');
}

function weekKey(value) {
    const date = asDate(value);
    return isoWeekKeyFromUtc(date.getTime() - WEEK_RESET_HOUR_UTC * 3600 * 1000);
}

function weekStartMs(value) {
    const date = asDate(value);
    const shifted = new Date(date.getTime() - WEEK_RESET_HOUR_UTC * 3600 * 1000);
    const day = shifted.getUTCDay();
    const daysFromMon = (day + 6) % 7;
    const startShifted = Date.UTC(
        shifted.getUTCFullYear(),
        shifted.getUTCMonth(),
        shifted.getUTCDate() - daysFromMon
    );
    return startShifted + WEEK_RESET_HOUR_UTC * 3600 * 1000;
}

function previousWeekKey(value) {
    return weekKey(new Date(weekStartMs(value) - 1));
}

function monthKey(value) {
    const date = asDate(value);
    const m = date.getUTCMonth() + 1;
    return date.getUTCFullYear() + '-M' + String(m).padStart(2, '0');
}

function previousMonthKey(value) {
    const date = asDate(value);
    const prev = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
    return monthKey(prev);
}

function accuracyOf(correct, total) {
    correct = Number(correct) || 0;
    total = Number(total) || 0;
    if (total <= 0) return 0;
    return Math.round((correct / total) * 10000);
}

function displayPct(correct, total) {
    total = Number(total) || 0;
    if (total <= 0) return 0;
    return Math.round(((Number(correct) || 0) / total) * 100);
}

function sortKey(ts) {
    const n = typeof ts === 'number' ? ts : timeMs(ts);
    if (n > 0 && n < UNKNOWN_REACHED) return n;
    return UNKNOWN_REACHED;
}

function isCorrect(direction, startPrice, resolvedPrice) {
    const start = Number(startPrice);
    const end = Number(resolvedPrice);
    if (!(start > 0) || !isFinite(end)) return false;
    const diff = end - start;
    if (direction === 'up') return diff > 0;
    if (direction === 'down') return diff < 0;
    return false;
}

function emptyStats() {
    return {
        predCorrect: 0,
        predTotal: 0,
        predAccuracy: 0,
        reachedAt: null,
        reachedSort: UNKNOWN_REACHED,
        predLastResult: null,
        predPending: null,
        predStreak: 0,
        predBestStreak: 0,
        weekKey: null,
        weekCorrect: 0,
        weekTotal: 0,
        weekAccuracy: 0,
        weekReachedAt: null,
        weekReachedSort: UNKNOWN_REACHED,
        qualifiesWeek: false,
        monthKey: null,
        monthCorrect: 0,
        monthTotal: 0,
        monthAccuracy: 0,
        monthReachedAt: null,
        monthReachedSort: UNKNOWN_REACHED,
        qualifiesMonth: false,
        qualifiesAllTime: false
    };
}

function cloneStats(stats) {
    const out = emptyStats();
    if (!stats || typeof stats !== 'object') return out;
    Object.keys(out).forEach(function(k) {
        if (stats[k] !== undefined) out[k] = stats[k];
    });
    out.predLastResult = stats.predLastResult ? Object.assign({}, stats.predLastResult) : null;
    out.predPending = stats.predPending ? Object.assign({}, stats.predPending) : null;
    return out;
}

function rollPeriods(stats, nowMs) {
    const wk = weekKey(nowMs);
    const mk = monthKey(nowMs);
    if (stats.weekKey !== wk) {
        stats.weekKey = wk;
        stats.weekCorrect = 0;
        stats.weekTotal = 0;
        stats.weekAccuracy = 0;
        stats.weekReachedAt = null;
        stats.weekReachedSort = UNKNOWN_REACHED;
        stats.qualifiesWeek = false;
    }
    if (stats.monthKey !== mk) {
        stats.monthKey = mk;
        stats.monthCorrect = 0;
        stats.monthTotal = 0;
        stats.monthAccuracy = 0;
        stats.monthReachedAt = null;
        stats.monthReachedSort = UNKNOWN_REACHED;
        stats.qualifiesMonth = false;
    }
    return stats;
}

function refreshFlags(stats) {
    stats.predCorrect = Math.max(0, Number(stats.predCorrect) || 0);
    stats.predTotal = Math.max(0, Number(stats.predTotal) || 0);
    if (stats.predCorrect > stats.predTotal) stats.predCorrect = stats.predTotal;
    stats.weekCorrect = Math.max(0, Number(stats.weekCorrect) || 0);
    stats.weekTotal = Math.max(0, Number(stats.weekTotal) || 0);
    if (stats.weekCorrect > stats.weekTotal) stats.weekCorrect = stats.weekTotal;
    stats.monthCorrect = Math.max(0, Number(stats.monthCorrect) || 0);
    stats.monthTotal = Math.max(0, Number(stats.monthTotal) || 0);
    if (stats.monthCorrect > stats.monthTotal) stats.monthCorrect = stats.monthTotal;
    stats.predAccuracy = accuracyOf(stats.predCorrect, stats.predTotal);
    stats.weekAccuracy = accuracyOf(stats.weekCorrect, stats.weekTotal);
    stats.monthAccuracy = accuracyOf(stats.monthCorrect, stats.monthTotal);
    stats.qualifiesAllTime = stats.predTotal >= MIN.alltime;
    stats.qualifiesWeek = !!(stats.weekKey && stats.weekTotal >= MIN.weekly);
    stats.qualifiesMonth = !!(stats.monthKey && stats.monthTotal >= MIN.monthly);
    stats.reachedSort = sortKey(stats.reachedAt);
    stats.weekReachedSort = sortKey(stats.weekReachedAt);
    stats.monthReachedSort = sortKey(stats.monthReachedAt);
    return stats;
}

function applyResolution(prev, prediction, resolvedPrice, nowMs) {
    const stats = cloneStats(prev);
    const predTime = timeMs(prediction && prediction.time);
    const direction = prediction && prediction.direction;
    const startPrice = prediction && (prediction.price != null ? prediction.price : prediction.startPrice);
    rollPeriods(stats, nowMs);
    const correct = isCorrect(direction, startPrice, resolvedPrice);
    stats.predTotal += 1;
    if (correct) stats.predCorrect += 1;
    stats.reachedAt = nowMs;
    stats.weekTotal += 1;
    if (correct) stats.weekCorrect += 1;
    stats.weekReachedAt = nowMs;
    stats.monthTotal += 1;
    if (correct) stats.monthCorrect += 1;
    stats.monthReachedAt = nowMs;
    stats.predLastResult = {
        direction: direction === 'down' ? 'down' : 'up',
        startPrice: Number(startPrice),
        resolvedPrice: Number(resolvedPrice),
        outcome: correct ? 'correct' : 'wrong',
        resolvedAt: nowMs,
        time: predTime
    };
    const pendingTime = stats.predPending ? timeMs(stats.predPending.time) : 0;
    if (!stats.predPending || !pendingTime || pendingTime <= predTime) stats.predPending = null;
    if (correct) {
        stats.predStreak = (Number(stats.predStreak) || 0) + 1;
        if (stats.predStreak > (Number(stats.predBestStreak) || 0)) stats.predBestStreak = stats.predStreak;
    } else {
        stats.predStreak = 0;
    }
    refreshFlags(stats);
    return { stats: stats, correct: correct };
}

function setPending(prev, prediction) {
    const stats = cloneStats(prev);
    const time = timeMs(prediction && prediction.time);
    const direction = prediction && prediction.direction;
    const price = Number(prediction && (prediction.price != null ? prediction.price : prediction.startPrice));
    if (!time || (direction !== 'up' && direction !== 'down') || !(price > 0)) return stats;
    stats.predPending = { direction: direction, startPrice: price, time: time };
    return stats;
}

function minimumFor(period) {
    if (period === 'weekly') return MIN.weekly;
    if (period === 'monthly') return MIN.monthly;
    return MIN.alltime;
}

function ticketsForPeriod(period) {
    if (period === 'weekly') return TICKETS.weekly;
    if (period === 'monthly') return TICKETS.monthly;
    return 0;
}

function ticketsForRank(period, rank) {
    if (rank < 1 || rank > PAYOUT_SIZE) return 0;
    return ticketsForPeriod(period);
}

function boardInfo(period) {
    if (period === 'weekly') return COPY.weekly;
    if (period === 'monthly') return COPY.monthly;
    return COPY.alltime;
}

function progressLine(period, made) {
    const min = minimumFor(period);
    const n = Math.max(0, Number(made) || 0);
    if (n >= min) return '';
    if (period === 'weekly') return "You've made " + n + ' of ' + min + ' predictions this week.';
    if (period === 'monthly') return "You've made " + n + ' of ' + min + ' predictions this month.';
    return "You've made " + n + ' of ' + min + ' predictions.';
}

function madeCount(stats, period, currentWeekKey, currentMonthKey) {
    if (!stats) return 0;
    if (period === 'weekly') {
        return stats.weekKey === currentWeekKey ? (Number(stats.weekTotal) || 0) : 0;
    }
    if (period === 'monthly') {
        return stats.monthKey === currentMonthKey ? (Number(stats.monthTotal) || 0) : 0;
    }
    if (stats.predTotal != null) return Number(stats.predTotal) || 0;
    return Number(stats.total) || 0;
}

function viewOf(stats, period) {
    if (!stats) return { correct: 0, total: 0, accuracy: 0, reachedAt: null };
    if (period === 'weekly') {
        return {
            correct: Number(stats.weekCorrect) || 0,
            total: Number(stats.weekTotal) || 0,
            accuracy: Number(stats.weekAccuracy) || accuracyOf(stats.weekCorrect, stats.weekTotal),
            reachedAt: stats.weekReachedAt == null ? null : stats.weekReachedAt
        };
    }
    if (period === 'monthly') {
        return {
            correct: Number(stats.monthCorrect) || 0,
            total: Number(stats.monthTotal) || 0,
            accuracy: Number(stats.monthAccuracy) || accuracyOf(stats.monthCorrect, stats.monthTotal),
            reachedAt: stats.monthReachedAt == null ? null : stats.monthReachedAt
        };
    }
    return {
        correct: Number(stats.predCorrect) || 0,
        total: Number(stats.predTotal) || 0,
        accuracy: Number(stats.predAccuracy) || accuracyOf(stats.predCorrect, stats.predTotal),
        reachedAt: stats.reachedAt == null ? null : stats.reachedAt
    };
}

function comparePredictors(a, b) {
    const aa = Number(a.accuracy) || 0;
    const ba = Number(b.accuracy) || 0;
    if (ba !== aa) return ba - aa;
    const ac = Number(a.correct) || 0;
    const bc = Number(b.correct) || 0;
    if (bc !== ac) return bc - ac;
    const at = Number(a.total) || 0;
    const bt = Number(b.total) || 0;
    if (bt !== at) return bt - at;
    const ar = sortKey(a.reachedAt);
    const br = sortKey(b.reachedAt);
    if (ar !== br) return ar - br;
    return String(a.uid || '').localeCompare(String(b.uid || ''));
}

function selectBoard(rows, period) {
    const min = minimumFor(period);
    const qualified = (rows || []).filter(function(r) {
        return r && r.satsDisabled !== true && (Number(r.total) || 0) >= min;
    });
    qualified.sort(comparePredictors);
    return qualified.slice(0, BOARD_SIZE).map(function(r, i) {
        return {
            rank: i + 1,
            uid: r.uid,
            username: r.username || 'Anon',
            profilePic: r.profilePic || '',
            pct: displayPct(r.correct, r.total),
            correct: Number(r.correct) || 0,
            total: Number(r.total) || 0,
            accuracy: Number(r.accuracy) || 0,
            reachedAt: r.reachedAt == null ? null : r.reachedAt
        };
    });
}

function payoutPlan(existing, rankedWinners, period) {
    const top = selectBoard(rankedWinners || [], period).slice(0, PAYOUT_SIZE);
    const complete = !!(existing && existing.status === 'complete');
    const resetDone = !!(existing && existing.resetDone);
    if (complete && resetDone) {
        return { action: 'skip', due: [], needsReset: false, ticketsEach: ticketsForPeriod(period), winnerUids: top.map(function(w) { return w.uid; }) };
    }
    const awarded = {};
    ((existing && existing.awardedUids) || []).forEach(function(uid) { awarded[uid] = true; });
    const due = [];
    if (!complete) {
        top.forEach(function(w) {
            if (awarded[w.uid]) return;
            due.push({
                uid: w.uid,
                username: w.username || 'Anon',
                rank: w.rank,
                tickets: ticketsForRank(period, w.rank),
                correct: w.correct,
                total: w.total,
                pct: w.pct
            });
        });
    }
    return {
        action: due.length ? 'pay' : 'reset_only',
        due: due,
        needsReset: !resetDone,
        ticketsEach: ticketsForPeriod(period),
        winnerUids: top.map(function(w) { return w.uid; })
    };
}

function resetPeriodFields(stats, period, currentKey) {
    const next = cloneStats(stats);
    if (period === 'weekly') {
        next.weekKey = currentKey;
        next.weekCorrect = 0;
        next.weekTotal = 0;
        next.weekAccuracy = 0;
        next.weekReachedAt = null;
        next.weekReachedSort = UNKNOWN_REACHED;
        next.qualifiesWeek = false;
    } else if (period === 'monthly') {
        next.monthKey = currentKey;
        next.monthCorrect = 0;
        next.monthTotal = 0;
        next.monthAccuracy = 0;
        next.monthReachedAt = null;
        next.monthReachedSort = UNKNOWN_REACHED;
        next.qualifiesMonth = false;
    }
    return next;
}

function legacyNumbers(legacy) {
    const total = legacy && legacy.total != null ? Number(legacy.total) || 0
        : (legacy && legacy.predictions && Number(legacy.predictions.total)) || 0;
    let correct = legacy && legacy.correct != null ? Number(legacy.correct) || 0
        : (legacy && legacy.predictions && Number(legacy.predictions.correct)) || 0;
    const src = (legacy && legacy.predictions) ? legacy.predictions : (legacy || {});
    return {
        total: Math.max(0, total),
        correct: Math.max(0, correct),
        streak: Number(src.streak) || 0,
        bestStreak: Number(src.bestStreak) || 0,
        lastResolved: timeMs(src.lastResolved)
    };
}

function recomputeUser(input) {
    const now = timeMs(input && input.now) || Date.now();
    const uid = input && input.uid;
    const gaps = [];
    const records = ((input && input.records) || []).slice().sort(function(a, b) {
        return (timeMs(a.resolvedAt) || timeMs(a.time)) - (timeMs(b.resolvedAt) || timeMs(b.time));
    });
    const legacy = legacyNumbers(input && input.legacy);
    if (legacy.correct > legacy.total && legacy.total >= 0) gaps.push('legacy_correct_exceeds_total');

    const stats = emptyStats();
    let source = 'none';
    if (legacy.total > 0) {
        source = 'legacy_aggregate';
        stats.predTotal = legacy.total;
        stats.predCorrect = Math.min(legacy.correct, legacy.total);
        stats.predStreak = legacy.streak;
        stats.predBestStreak = Math.max(legacy.bestStreak, legacy.streak);
        stats.reachedAt = legacy.lastResolved || null;
        if (!records.length) {
            gaps.push('no_prediction_records');
            gaps.push('last_result_prices_unknown');
            gaps.push('period_counters_unknown');
            if (!legacy.lastResolved) gaps.push('reached_at_unknown');
        }
    }

    const wk = weekKey(now);
    const mk = monthKey(now);
    stats.weekKey = wk;
    stats.monthKey = mk;
    let streak = records.length ? 0 : (stats.predStreak || 0);
    let best = records.length ? 0 : (stats.predBestStreak || 0);
    records.forEach(function(rec) {
        const correct = rec.correct === true || rec.outcome === 'correct' || rec.correct === 1;
        const when = timeMs(rec.resolvedAt) || timeMs(rec.time);
        stats.predTotal += 1;
        if (correct) stats.predCorrect += 1;
        stats.reachedAt = when || stats.reachedAt;
        if (correct) {
            streak += 1;
            if (streak > best) best = streak;
        } else {
            streak = 0;
        }
        stats.predLastResult = {
            direction: rec.direction === 'down' ? 'down' : 'up',
            startPrice: Number(rec.startPrice != null ? rec.startPrice : rec.price),
            resolvedPrice: Number(rec.resolvedPrice),
            outcome: correct ? 'correct' : 'wrong',
            resolvedAt: when,
            time: timeMs(rec.time)
        };
        if (when && weekKey(when) === wk) {
            stats.weekTotal += 1;
            if (correct) stats.weekCorrect += 1;
            stats.weekReachedAt = when;
        }
        if (when && monthKey(when) === mk) {
            stats.monthTotal += 1;
            if (correct) stats.monthCorrect += 1;
            stats.monthReachedAt = when;
        }
    });
    if (records.length) {
        source = legacy.total > 0 ? 'legacy_plus_records' : 'records';
        stats.predStreak = streak;
        stats.predBestStreak = Math.max(best, stats.predBestStreak || 0);
        if (legacy.total > 0) gaps.push('period_history_not_in_legacy_aggregate');
    }

    const active = input && input.active;
    if (active && active.direction && Number(active.price) > 0 && timeMs(active.time)) {
        const activeTime = timeMs(active.time);
        const already = records.some(function(r) { return timeMs(r.time) === activeTime; });
        const lastTime = stats.predLastResult ? timeMs(stats.predLastResult.time) : 0;
        if (!already && activeTime !== lastTime) {
            stats.predPending = {
                direction: active.direction === 'down' ? 'down' : 'up',
                startPrice: Number(active.price),
                time: activeTime
            };
            if (now - activeTime >= WINDOW_MS) gaps.push('pending_past_window');
            else gaps.push('pending_open');
        }
    }

    refreshFlags(stats);
    const hasData = stats.predTotal > 0 || records.length > 0 || !!stats.predPending || legacy.total > 0;
    if (!hasData) {
        return { uid: uid, skip: true, gaps: ['no_prediction_data'], stats: null, source: 'none' };
    }
    return { uid: uid, skip: false, gaps: gaps, stats: stats, source: source };
}

module.exports = {
    WEEK_RESET_HOUR_UTC: WEEK_RESET_HOUR_UTC,
    WINDOW_MS: WINDOW_MS,
    CORRECT_XP: CORRECT_XP,
    BOARD_SIZE: BOARD_SIZE,
    PAYOUT_SIZE: PAYOUT_SIZE,
    UNKNOWN_REACHED: UNKNOWN_REACHED,
    MIN: MIN,
    TICKETS: TICKETS,
    COPY: COPY,
    timeMs: timeMs,
    weekKey: weekKey,
    weekStartMs: weekStartMs,
    previousWeekKey: previousWeekKey,
    monthKey: monthKey,
    previousMonthKey: previousMonthKey,
    accuracyOf: accuracyOf,
    displayPct: displayPct,
    isCorrect: isCorrect,
    emptyStats: emptyStats,
    applyResolution: applyResolution,
    setPending: setPending,
    minimumFor: minimumFor,
    ticketsForPeriod: ticketsForPeriod,
    ticketsForRank: ticketsForRank,
    boardInfo: boardInfo,
    progressLine: progressLine,
    madeCount: madeCount,
    viewOf: viewOf,
    comparePredictors: comparePredictors,
    selectBoard: selectBoard,
    payoutPlan: payoutPlan,
    resetPeriodFields: resetPeriodFields,
    recomputeUser: recomputeUser,
    refreshFlags: refreshFlags
};
