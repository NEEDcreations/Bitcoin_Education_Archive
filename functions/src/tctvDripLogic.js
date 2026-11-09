'use strict';
// Pure logic for the Timechain TV drip pot. No Firestore here so it can be
// unit tested. All accrual and share math runs server-side only.

const DEFAULTS = Object.freeze({
    enabled: true,
    targetSats: 5000,
    satsPerViewerMinute: 1, // kept for Firestore/readConfig compat; 1-4 band uses 1 sat/min
    satsPerFiveViewers: 5,  // >=5 viewers: floor(N/5) * this
    maxCountedViewers: 50,
    dailyCapSats: 1000,
    userShareCapPct: 5,
    minEligibleWatchers: 5, // a full pot waits until this many viewers qualify
    minQualifySeconds: 30 * 60,
    minAccountAgeDays: 3,
    perAccountLimitSeconds: 8 * 3600, // Phil may change in tctv_drip_config/settings
    burstEverySats: 1000,
    minWalletSats: 20000, // faucet keeps paying first: pot reserve may not dip below this
    promptMinMinutes: 15,
    promptMaxMinutes: 40,
    promptAnswerSeconds: 120,
});

const CREDIT_SECONDS = 60;
const MIN_GAP_MS = 55 * 1000;      // reject rapid/duplicate check-ins
const ACTIVE_WINDOW_MS = 90 * 1000; // a viewer counts if checked in this recently
const DEVICE_HOLD_MS = 3 * 60 * 1000;

function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }

function readConfig(raw) {
    const r = raw || {};
    const c = {};
    for (const k of Object.keys(DEFAULTS)) {
        if (typeof DEFAULTS[k] === 'boolean') c[k] = r[k] === undefined ? DEFAULTS[k] : r[k] === true;
        else c[k] = Math.max(0, num(r[k], DEFAULTS[k]));
    }
    if (c.promptMaxMinutes < c.promptMinMinutes) c.promptMaxMinutes = c.promptMinMinutes;
    return c;
}

function validDeviceId(id) {
    return typeof id === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(id);
}

function nextPromptMs(nowMs, cfg, rand) {
    const r = typeof rand === 'number' ? rand : Math.random();
    const mins = cfg.promptMinMinutes + r * (cfg.promptMaxMinutes - cfg.promptMinMinutes);
    return Math.floor(nowMs + mins * 60000);
}

// A highlighted "still watching?" tap sends the prompt token. That tap has to
// count even when it lands in the same minute as the check-in that raised the
// prompt. Raising the prompt must not move lastCheckMs, or the tap is rejected
// as too-fast and the watcher's seconds (and share) stay at 0.
function promptIsAnswered(p, now, answer) {
    const due = num(p.promptDueMs, 0);
    return !!(due && now >= due && answer && p.promptToken && answer === p.promptToken);
}

// One check-in. prev = watch doc (or {}), returns {credit, reason, patch, prompt}
function planCheckin(prev, ctx) {
    const p = prev || {};
    const now = ctx.nowMs;
    const cfg = ctx.cfg;
    if (!ctx.playing) return { credit: 0, reason: 'not-playing' };
    if (!ctx.presenceFresh) return { credit: 0, reason: 'no-presence' };
    if (ctx.deviceOwner && ctx.deviceOwner !== ctx.uid && now - num(ctx.deviceLastMs, 0) < DEVICE_HOLD_MS) {
        return { credit: 0, reason: 'device-in-use', reject: true };
    }
    const last = num(p.lastCheckMs, 0);
    const answered = promptIsAnswered(p, now, ctx.promptAnswer);
    if (!answered && last && now - last < MIN_GAP_MS) return { credit: 0, reason: 'too-fast', reject: true };
    const patch = { lastCheckMs: now };
    let promptDue = num(p.promptDueMs, 0);
    if (!promptDue) { promptDue = nextPromptMs(now, cfg, ctx.rand); patch.promptDueMs = promptDue; }
    if (now >= promptDue) {
        if (answered) {
            patch.promptDueMs = nextPromptMs(now, cfg, ctx.rand);
            patch.promptToken = '';
        } else {
            if (!p.promptToken) patch.promptToken = ctx.newToken;
            // Leave lastCheckMs where it was so the tap in this same minute can credit.
            delete patch.lastCheckMs;
            return { credit: 0, reason: 'prompt', prompt: true, token: p.promptToken || ctx.newToken, patch };
        }
    }
    const seconds = num(p.seconds, 0);
    const room = cfg.perAccountLimitSeconds - seconds;
    if (room <= 0) return { credit: 0, reason: 'limit', patch };
    const credit = Math.min(CREDIT_SECONDS, room);
    patch.seconds = seconds + credit;
    return { credit, reason: 'ok', patch };
}

// How many viewers may move sats on this tick.
// liveTotal is the public header (tctv_counts/live). Logged-out clients can
// create v_ presence docs, so that total must not fill the pot. crediting is
// the count of signed-in, age-ok, device-locked check-ins that actually
// credited inside the fresh window. Zero of those means zero accrual, even
// if liveTotal is maxed out.
function accrualViewers(liveTotal, crediting) {
    void liveTotal;
    const n = Math.floor(Number(crediting));
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n;
}

// Stepped fill rate from active viewers (capped at maxCountedViewers).
// 0 -> 0; 1-4 -> 1 sat/min; >=5 -> floor(N/5) * satsPerFiveViewers.
function rateFromViewers(activeViewers, cfg) {
    const viewers = Math.min(Math.max(0, Math.floor(activeViewers)), cfg.maxCountedViewers);
    if (viewers <= 0) return 0;
    if (viewers < 5) return 1;
    return Math.floor(viewers / 5) * cfg.satsPerFiveViewers;
}

// Accrual for one minute tick.
function planAccrual(pot, activeViewers, cfg, dayKey) {
    const p = pot || {};
    const viewers = Math.min(Math.max(0, Math.floor(activeViewers)), cfg.maxCountedViewers);
    const ratePerMin = rateFromViewers(viewers, cfg);
    const sameDay = p.dayKey === dayKey;
    const dayUsed = sameDay ? num(p.dayAccrued, 0) : 0;
    const sats = num(p.sats, 0);
    let add = ratePerMin;
    add = Math.max(0, Math.min(add, cfg.dailyCapSats - dayUsed, cfg.targetSats - sats));
    const next = Math.round((sats + add) * 1000) / 1000;
    const prevBursts = Math.floor(sats / cfg.burstEverySats);
    const bursts = Math.floor(next / cfg.burstEverySats);
    return {
        viewers, add, ratePerMin,
        sats: next,
        dayKey, dayAccrued: Math.round((dayUsed + add) * 1000) / 1000,
        burst: bursts > prevBursts,
        full: next >= cfg.targetSats,
    };
}

// Who counts as an eligible watcher for a pot.
function eligibleEntries(entries, cfg) {
    return (entries || []).filter(e => e && e.uid && Number(e.seconds) >= cfg.minQualifySeconds)
        .map(e => ({ uid: String(e.uid), seconds: Math.min(Number(e.seconds), cfg.perAccountLimitSeconds) }));
}

// Per-user cap in whole sats: the larger of userShareCapPct and 2/N of the pot.
function shareCap(pot, n, cfg) {
    const pct = cfg.userShareCapPct / 100;
    const frac = n > 0 ? Math.max(pct, 2 / n) : pct;
    return Math.floor(pot * Math.min(1, frac));
}

// Water-fill proportional shares for an already-filtered eligible list.
// Whole sats only: floor leftovers go 1 sat each to the largest remainders.
// Only sats left when every watcher is capped roll into the next pot.
function fillShares(elig, pot, cap) {
    const n = elig.length;
    const sats = new Map(elig.map(e => [e.uid, 0]));
    let open = elig.slice();
    let remaining = pot;
    for (let guard = 0; guard <= n && open.length && remaining > 0; guard++) {
        const total = open.reduce((t, e) => t + e.seconds, 0);
        if (total <= 0) break;
        const over = open.filter(e => remaining * e.seconds / total > cap);
        if (over.length) {
            for (const e of over) { sats.set(e.uid, cap); remaining -= cap; }
            open = open.filter(e => over.indexOf(e) === -1);
            continue;
        }
        const raw = open.map(e => ({ e, v: remaining * e.seconds / total }));
        let given = 0;
        for (const r of raw) { const f = Math.floor(r.v); sats.set(r.e.uid, f); given += f; }
        let left = remaining - given;
        raw.sort((a, b) => (b.v - Math.floor(b.v)) - (a.v - Math.floor(a.v)) || b.e.seconds - a.e.seconds || (a.e.uid < b.e.uid ? -1 : 1));
        for (const r of raw) {
            if (left <= 0) break;
            if (sats.get(r.e.uid) < cap) { sats.set(r.e.uid, sats.get(r.e.uid) + 1); left--; }
        }
        remaining = left;
        open = [];
    }
    const shares = elig.map(e => ({ uid: e.uid, seconds: e.seconds, sats: sats.get(e.uid) || 0 })).filter(e => e.sats > 0);
    const paid = shares.reduce((t, e) => t + e.sats, 0);
    return { shares, paid, rollover: pot - paid };
}

// Proportional shares with a per-user cap (water filling).
// Fewer than minEligibleWatchers qualifiers: no payout (wait: true).
function planShares(entries, cfg) {
    const pot = Math.floor(cfg.targetSats);
    const elig = eligibleEntries(entries, cfg);
    const n = elig.length;
    const cap = shareCap(pot, n, cfg);
    const minN = Math.max(1, Math.floor(cfg.minEligibleWatchers));
    if (n < minN) return { wait: true, eligible: n, shares: [], paid: 0, rollover: 0, cap };
    const filled = fillShares(elig, pot, cap);
    return { wait: false, eligible: n, shares: filled.shares, paid: filled.paid, rollover: filled.rollover, cap };
}

// Live UI projection: same math as planShares, but still returns per-uid sats
// when the pot is waiting on more eligible watchers (payout still waits).
// Watchers below minQualifySeconds get 0. Does not change payout behavior.
function projectShares(entries, cfg) {
    const pot = Math.floor(cfg.targetSats);
    const all = (entries || []).filter(e => e && e.uid).map(e => ({
        uid: String(e.uid),
        seconds: Math.min(Math.max(0, Number(e.seconds) || 0), cfg.perAccountLimitSeconds),
    }));
    const elig = eligibleEntries(all, cfg);
    const n = elig.length;
    const cap = shareCap(pot, n, cfg);
    const minN = Math.max(1, Math.floor(cfg.minEligibleWatchers));
    const waiting = n < minN;
    const byUid = new Map(all.map(e => [e.uid, 0]));
    if (n > 0) {
        const filled = fillShares(elig, pot, cap);
        for (const s of filled.shares) byUid.set(s.uid, s.sats);
    }
    const shares = all.map(e => ({ uid: e.uid, seconds: e.seconds, sats: byUid.get(e.uid) || 0 }));
    const paid = shares.reduce((t, e) => t + e.sats, 0);
    return { waiting, eligible: n, shares, paid, rollover: Math.max(0, pot - paid), cap };
}

// Reserve check: the faucet floor always stays covered.
function planReserve(walletSats, alreadyReserved, cfg) {
    if (!(walletSats >= 0)) return { ok: false, reason: 'wallet-unknown' };
    const after = walletSats - num(alreadyReserved, 0) - cfg.targetSats;
    if (after < cfg.minWalletSats) return { ok: false, reason: 'wallet-low', after };
    return { ok: true, after };
}

function isAgentOrBlocked(user) {
    const u = user || {};
    return u.isBot === true || u.isAgent === true || u.aiAgent === true || u.accountType === 'agent' ||
        u.isTest === true || u.banned === true || !!u.ban_reason || u.satsDisabled === true;
}

module.exports = {
    DEFAULTS, CREDIT_SECONDS, MIN_GAP_MS, ACTIVE_WINDOW_MS, DEVICE_HOLD_MS,
    readConfig, validDeviceId, nextPromptMs, promptIsAnswered, planCheckin, accrualViewers, rateFromViewers, planAccrual, planShares, projectShares, fillShares, eligibleEntries, shareCap, planReserve, isAgentOrBlocked,
};
