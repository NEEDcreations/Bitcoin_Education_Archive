'use strict';

// App-wide sats payout budget (Phil, Nov 1 2026). Pure rules, no Firebase,
// so every decision is unit tested. Callers apply the results inside their
// own Firestore transactions (one per user claim).
//
// Month and day boundaries are America/New_York (luxon), so they follow DST.
// Caps, rate bounds and pacing live in payout_config/settings (server only;
// rules deny every client read/write). Defaults below are the proposal in
// the PR description and are flagged for Phil.

const { DateTime } = require('luxon');

const TZ = 'America/New_York';
const MONTHLY_TOTAL = 25000;
// Proposed re-split (Phil to confirm). favor accrues month to month so one
// 21,000-sat epoch fits roughly every 2 months.
const DEFAULT_CAPS = Object.freeze({
    faucet: 8000,
    drip: 2500,
    misc: 2500,   // ciphers + OrangeTix raffles combined
    favor: 10500, // Satoshi's Favor epochs (accrues, see favorReserve)
    buffer: 1500, // manual jackpots / slack; never auto-spent
});
const AUTO_SOURCES = ['faucet', 'drip', 'misc'];
const MANUAL_SOURCES = ['jackpot', 'favor', 'manual'];
const SOURCES = AUTO_SOURCES.concat(MANUAL_SOURCES);

const RATE_BOUNDS = Object.freeze({
    minSatsFloor: 50,
    minSatsCeil: 100,
    pointsPerSatFloor: 10, // 1,000 XP = 100 sats (today's rate, most generous)
    pointsPerSatCeil: 20,  // 1,000 XP = 50 sats
    maxDailyMovePct: 10,
});
const DEFAULT_RATES = Object.freeze({ minSats: 100, pointsPerSat: 10 });
const CLAIM_GAP_MS = 24 * 60 * 60 * 1000;
const WALLET_FLOOR_SATS = 10000; // plus the reserved drip pot
const MANUAL_REVIEW_OVER = 1000;  // cipher prizes above this wait for Phil
const EPOCH_SATS = 21000;
const BLOCKS_PER_EPOCH = 5;
const RETARGET_DAYS = 14;
const MAX_RETARGET_FACTOR = 4;
const HASH_SPACE = 100000000;

function n0(v) { const n = Math.floor(Number(v) || 0); return n > 0 ? n : 0; }
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

function et(ms) {
    return DateTime.fromMillis(Number(ms) || 0, { zone: TZ });
}

function periodInfo(ms) {
    const d = et(ms);
    const monthStart = d.startOf('month');
    const nextMonth = monthStart.plus({ months: 1 });
    const dayStart = d.startOf('day');
    const nextDay = dayStart.plus({ days: 1 });
    const monthMs = nextMonth.toMillis() - monthStart.toMillis();
    return {
        day: d.toFormat('yyyy-LL-dd'),
        prevDay: dayStart.minus({ days: 1 }).toFormat('yyyy-LL-dd'),
        month: d.toFormat('yyyy-LL'),
        daysInMonth: d.daysInMonth,
        dayOfMonth: d.day,
        monthFraction: (d.toMillis() - monthStart.toMillis()) / monthMs,
        dayStartMs: dayStart.toMillis(),
        nextDayMs: nextDay.toMillis(),
        monthStartMs: monthStart.toMillis(),
        nextMonthMs: nextMonth.toMillis(),
    };
}

function readCaps(cfg) {
    const src = (cfg && cfg.caps) || {};
    const caps = {};
    Object.keys(DEFAULT_CAPS).forEach(function(k) {
        const v = Number(src[k]);
        caps[k] = Number.isFinite(v) && v >= 0 ? Math.floor(v) : DEFAULT_CAPS[k];
    });
    const total = Number(cfg && cfg.monthlyTotal);
    caps.total = Number.isFinite(total) && total > 0 ? Math.floor(total) : MONTHLY_TOTAL;
    return caps;
}

function monthTotals(doc) {
    const d = doc || {};
    const by = d.bySource || {};
    const out = { total: 0, bySource: {} };
    SOURCES.forEach(function(s) { out.bySource[s] = n0(by[s]); out.total += out.bySource[s]; });
    return out;
}

function formatWait(ms) {
    const mins = Math.max(1, Math.ceil(Math.max(0, Number(ms) || 0) / 60000));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h >= 24) {
        const d = Math.floor(h / 24);
        return d + 'd ' + (h % 24) + 'h';
    }
    return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
}

// Automatic payouts only. Manual sources are recorded, never blocked.
function assessPayout(monthDoc, source, amount, caps, nowMs) {
    const c = caps || readCaps(null);
    const amt = n0(amount);
    const t = monthTotals(monthDoc);
    const resumeAtMs = periodInfo(nowMs).nextMonthMs;
    if (AUTO_SOURCES.indexOf(source) === -1) return { ok: false, code: 'bad_source', error: 'Payouts are paused.' };
    if (t.bySource[source] + amt > c[source]) {
        return {
            ok: false, code: 'budget_source', resumeAtMs: resumeAtMs,
            error: 'This month\'s payouts for this reward are used up. They restart on the 1st (midnight ET).',
        };
    }
    // Auto sources never dip into the buffer or the favor allocation.
    const autoRoom = c.total - c.buffer - c.favor;
    const autoUsed = AUTO_SOURCES.reduce(function(s, k) { return s + t.bySource[k]; }, 0);
    if (autoUsed + amt > autoRoom || t.total + amt > c.total) {
        return {
            ok: false, code: 'budget_total', resumeAtMs: resumeAtMs,
            error: 'This month\'s sats budget is used up. Payouts restart on the 1st (midnight ET).',
        };
    }
    return { ok: true, amount: amt, after: t.total + amt };
}

// Global daily faucet ceiling (Red Team M3): the faucet's remaining monthly
// room, as of the start of this ET day, spread over the days left. Stops a
// group of accounts draining the whole month in one day. paidToday comes from
// the server-only payout_rates/{ET day}.faucetPaid counter.
function faucetDailyCeiling(monthDoc, paidToday, caps, nowMs) {
    const c = caps || readCaps(null);
    const info = periodInfo(nowMs);
    const t = monthTotals(monthDoc);
    const today = n0(paidToday);
    const before = Math.max(0, t.bySource.faucet - today);
    const room = Math.max(0, c.faucet - before);
    const daysLeft = Math.max(1, info.daysInMonth - info.dayOfMonth + 1);
    return Math.ceil(room / daysLeft);
}
function assessFaucetDaily(monthDoc, paidToday, amount, caps, nowMs) {
    const ceiling = faucetDailyCeiling(monthDoc, paidToday, caps, nowMs);
    if (n0(paidToday) + n0(amount) > ceiling) {
        return {
            ok: false, code: 'budget_daily', resumeAtMs: periodInfo(nowMs).nextDayMs,
            error: 'Today\'s sats payouts are used up. They restart at midnight ET.',
        };
    }
    return { ok: true };
}

function assessClaimGap(lastClaimMs, nowMs) {
    const last = Number(lastClaimMs) || 0;
    const now = Number(nowMs) || 0;
    if (!last) return { ok: true };
    const next = last + CLAIM_GAP_MS;
    if (now < next) {
        return {
            ok: false, code: 'claim_gap', retryAtMs: next, waitMs: next - now,
            error: 'You can claim again in ' + formatWait(next - now) + '. Claims are 24 hours apart.',
        };
    }
    return { ok: true };
}

function walletFloor(reservedPotSats) {
    return WALLET_FLOOR_SATS + n0(reservedPotSats);
}

function readBounds(cfg) {
    const b = Object.assign({}, RATE_BOUNDS, (cfg && cfg.rateBounds) || {});
    return {
        minSatsFloor: n0(b.minSatsFloor) || RATE_BOUNDS.minSatsFloor,
        minSatsCeil: n0(b.minSatsCeil) || RATE_BOUNDS.minSatsCeil,
        pointsPerSatFloor: Number(b.pointsPerSatFloor) || RATE_BOUNDS.pointsPerSatFloor,
        pointsPerSatCeil: Number(b.pointsPerSatCeil) || RATE_BOUNDS.pointsPerSatCeil,
        maxDailyMovePct: clamp(Number(b.maxDailyMovePct) || 10, 0, 10),
    };
}

// Daily pacing. Called once per ET day (scheduler at midnight, or lazily by
// the first claim of the day). Uses the auto-source spend only, measured
// against the auto share of the month (total - buffer - favor).
function planDailyRates(prev, ctx) {
    const p = prev || DEFAULT_RATES;
    const c = ctx || {};
    const b = readBounds(c.config);
    const caps = readCaps(c.config);
    const info = periodInfo(c.nowMs);
    const autoRoom = Math.max(1, caps.total - caps.buffer - caps.favor);
    const t = monthTotals(c.monthDoc);
    const spent = AUTO_SOURCES.reduce(function(s, k) { return s + t.bySource[k]; }, 0);
    // At midnight on day d, days 1..d-1 are done.
    const daysDone = Math.max(0, info.dayOfMonth - 1);
    const expected = autoRoom * (daysDone / info.daysInMonth);
    const pace = daysDone === 0 ? 1 : spent / Math.max(1, expected);
    let step = 0; // + means stingier (higher minimum, more XP per sat)
    if (c.walletLow === true || pace > 1.15) step = 1;
    else if (pace > 1.02) step = 0.5;
    else if (pace < 0.8) step = -1;
    else if (pace < 0.95) step = -0.5;
    const move = b.maxDailyMovePct / 100 * step;
    const prevMin = clamp(Number(p.minSats) || DEFAULT_RATES.minSats, b.minSatsFloor, b.minSatsCeil);
    const prevPps = clamp(Number(p.pointsPerSat) || DEFAULT_RATES.pointsPerSat, b.pointsPerSatFloor, b.pointsPerSatCeil);
    let minSats = Math.round(prevMin * (1 + move));
    // Rounding must never exceed the 10% bound.
    const maxDelta = Math.floor(prevMin * b.maxDailyMovePct / 100);
    minSats = clamp(minSats, prevMin - maxDelta, prevMin + maxDelta);
    minSats = clamp(minSats, b.minSatsFloor, b.minSatsCeil);
    let pps = Math.round(prevPps * (1 + move) * 10) / 10;
    pps = clamp(pps, prevPps * (1 - b.maxDailyMovePct / 100), prevPps * (1 + b.maxDailyMovePct / 100));
    pps = Math.round(clamp(pps, b.pointsPerSatFloor, b.pointsPerSatCeil) * 10) / 10;
    return {
        day: info.day,
        minSats: minSats,
        pointsPerSat: pps,
        xpPer100Sats: Math.round(pps * 100),
        pace: Math.round(pace * 1000) / 1000,
        spentAuto: spent,
        expectedAuto: Math.round(expected),
        walletLow: c.walletLow === true,
        step: step,
    };
}

// XP to sats under a rate. Floors so a client can never round up.
function satsForPoints(points, pointsPerSat) {
    const pps = Number(pointsPerSat) || DEFAULT_RATES.pointsPerSat;
    return Math.floor(Math.max(0, Number(points) || 0) / pps);
}
function pointsForSats(sats, pointsPerSat) {
    const pps = Number(pointsPerSat) || DEFAULT_RATES.pointsPerSat;
    return Math.ceil(n0(sats) * pps);
}

// Single source of truth for the cipher manual-review threshold (> 1000).
function cipherNeedsReview(amount) {
    return n0(amount) > MANUAL_REVIEW_OVER;
}

// Expected sats per cipher open from the locked odds table.
function cipherExpectedValue(tiers) {
    return (tiers || []).reduce(function(s, t) { return s + t.amount / t.odds; }, 0);
}

// Satoshi's Favor epoch: covered when the favor allocation accrued so far
// (months since the reserve started x favor cap, minus epochs already paid)
// holds a full epoch AND the month total still has room for it.
function assessFavorEpoch(info) {
    const src = info || {};
    const caps = src.caps || readCaps(null);
    const reserve = n0(src.favorReserve);
    const t = monthTotals(src.monthDoc);
    const amount = n0(src.amount) || EPOCH_SATS;
    if (reserve < amount) return { ok: false, code: 'favor_reserve', reserve: reserve };
    // Hard app-wide monthly limit (Phil: epochs paid "in accordance to our
    // 25k/mo limit"). An epoch that doesn't fit waits (pending) for Phil.
    if (t.total + amount > caps.total) return { ok: false, code: 'budget_total', reserve: reserve, monthAfter: t.total + amount };
    return { ok: true, amount: amount, monthAfter: t.total + amount };
}

// Difficulty retarget (~every 14 days). Hash wins when value < target, so a
// bigger target is easier. Budget left for Favor = monthly total minus what
// the other sources actually paid in the trailing window (scaled to 30 days)
// minus the buffer. That sets the target epoch rate; compare to the actual
// block rate and move the target by at most 4x either way.
function planRetarget(input) {
    const src = input || {};
    const current = clamp(Math.floor(Number(src.currentTarget) || 20000), 1, HASH_SPACE);
    const windowDays = Math.max(1, Number(src.windowDays) || RETARGET_DAYS);
    const caps = src.caps || readCaps(null);
    const otherPaid = n0(src.otherPaidInWindow);
    const otherPerMonth = otherPaid * (30 / windowDays);
    const favorPerMonth = Math.max(0, caps.total - caps.buffer - otherPerMonth);
    const targetEpochsPerMonth = favorPerMonth / EPOCH_SATS;
    const targetBlocksPerDay = targetEpochsPerMonth * BLOCKS_PER_EPOCH / 30;
    const blocks = n0(src.blocksInWindow);
    const actualBlocksPerDay = blocks / windowDays;
    let factor;
    if (targetBlocksPerDay <= 0) factor = 1 / MAX_RETARGET_FACTOR;
    else if (actualBlocksPerDay <= 0) factor = MAX_RETARGET_FACTOR;
    else factor = targetBlocksPerDay / actualBlocksPerDay;
    factor = clamp(factor, 1 / MAX_RETARGET_FACTOR, MAX_RETARGET_FACTOR);
    const next = clamp(Math.round(current * factor), 1, HASH_SPACE);
    return {
        previousTarget: current,
        target: next,
        factor: Math.round(factor * 10000) / 10000,
        favorBudgetPerMonth: Math.round(favorPerMonth),
        targetEpochsPerMonth: Math.round(targetEpochsPerMonth * 1000) / 1000,
        targetBlocksPerDay: Math.round(targetBlocksPerDay * 10000) / 10000,
        actualBlocksPerDay: Math.round(actualBlocksPerDay * 10000) / 10000,
        blocksInWindow: blocks,
        windowDays: windowDays,
    };
}

// history: [{ target, since }] oldest first; since is ISO or ms.
function targetAtTime(history, tsMs, fallback) {
    const list = Array.isArray(history) ? history : [];
    let best = null;
    for (let i = 0; i < list.length; i++) {
        const h = list[i];
        const at = typeof h.since === 'number' ? h.since : new Date(h.since).getTime();
        if (at <= tsMs && (!best || at >= best.at)) best = { at: at, target: h.target };
    }
    if (best) return best.target;
    return list.length ? list[0].target : fallback;
}

module.exports = {
    TZ, MONTHLY_TOTAL, DEFAULT_CAPS, AUTO_SOURCES, MANUAL_SOURCES, SOURCES, RATE_BOUNDS, DEFAULT_RATES,
    CLAIM_GAP_MS, WALLET_FLOOR_SATS, MANUAL_REVIEW_OVER, EPOCH_SATS, BLOCKS_PER_EPOCH, RETARGET_DAYS,
    MAX_RETARGET_FACTOR, HASH_SPACE,
    periodInfo, readCaps, faucetDailyCeiling, assessFaucetDaily, readBounds, monthTotals, formatWait, assessPayout, assessClaimGap, walletFloor,
    planDailyRates, satsForPoints, pointsForSats, cipherNeedsReview, cipherExpectedValue,
    assessFavorEpoch, planRetarget, targetAtTime,
};
