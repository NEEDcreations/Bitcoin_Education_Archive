'use strict';
// Pure logic for the Timechain TV drip pot. No Firestore here so it can be
// unit tested. All accrual and share math runs server-side only.

const DEFAULTS = Object.freeze({
    enabled: true,
    targetSats: 5000,
    satsPerViewerMinute: 1,
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

// One check-in. prev = watch doc (or {}), returns {credit, reason, patch, prompt}
function planCheckin(prev, ctx) {
    const p = prev || {};
    const now = ctx.nowMs;
    const cfg = ctx.cfg;
    if (!ctx.playing) return { credit: 0, reason: 'not-playing' };
    if (!ctx.presenceFresh) return { credit: 0, reason: 'no-presence' };
    const last = num(p.lastCheckMs, 0);
    if (last && now - last < MIN_GAP_MS) return { credit: 0, reason: 'too-fast', reject: true };
    if (ctx.deviceOwner && ctx.deviceOwner !== ctx.uid && now - num(ctx.deviceLastMs, 0) < DEVICE_HOLD_MS) {
        return { credit: 0, reason: 'device-in-use', reject: true };
    }
    const patch = { lastCheckMs: now };
    let promptDue = num(p.promptDueMs, 0);
    if (!promptDue) { promptDue = nextPromptMs(now, cfg, ctx.rand); patch.promptDueMs = promptDue; }
    if (now >= promptDue) {
        const answered = ctx.promptAnswer && p.promptToken && ctx.promptAnswer === p.promptToken;
        if (answered) {
            patch.promptDueMs = nextPromptMs(now, cfg, ctx.rand);
            patch.promptToken = '';
        } else {
            if (!p.promptToken) patch.promptToken = ctx.newToken;
            // Unanswered prompt past its answer window: no credit until answered.
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

// Accrual for one minute tick.
function planAccrual(pot, activeViewers, cfg, dayKey) {
    const p = pot || {};
    const viewers = Math.min(Math.max(0, Math.floor(activeViewers)), cfg.maxCountedViewers);
    const sameDay = p.dayKey === dayKey;
    const dayUsed = sameDay ? num(p.dayAccrued, 0) : 0;
    const sats = num(p.sats, 0);
    let add = viewers * cfg.satsPerViewerMinute;
    add = Math.max(0, Math.min(add, cfg.dailyCapSats - dayUsed, cfg.targetSats - sats));
    const next = Math.round((sats + add) * 1000) / 1000;
    const prevBursts = Math.floor(sats / cfg.burstEverySats);
    const bursts = Math.floor(next / cfg.burstEverySats);
    return {
        viewers, add,
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

// Proportional shares with a per-user cap (water filling). Sats over a cap
// go to the uncapped watchers by watch time, repeated until nobody is over.
// Whole sats only: floor leftovers go 1 sat each to the largest remainders.
// Only sats left when every watcher is capped roll into the next pot.
// Fewer than minEligibleWatchers qualifiers: no payout (wait: true).
function planShares(entries, cfg) {
    const pot = Math.floor(cfg.targetSats);
    const elig = eligibleEntries(entries, cfg);
    const n = elig.length;
    const cap = shareCap(pot, n, cfg);
    const minN = Math.max(1, Math.floor(cfg.minEligibleWatchers));
    if (n < minN) return { wait: true, eligible: n, shares: [], paid: 0, rollover: 0, cap };
    const sats = new Map(elig.map(e => [e.uid, 0]));
    let open = elig.slice();
    let remaining = pot;
    for (let guard = 0; guard <= n && open.length && remaining > 0; guard++) {
        const total = open.reduce((t, e) => t + e.seconds, 0);
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
    const shares = elig.map(e => ({ uid: e.uid, seconds: e.seconds, sats: sats.get(e.uid) })).filter(e => e.sats > 0);
    const paid = shares.reduce((t, e) => t + e.sats, 0);
    return { wait: false, eligible: n, shares, paid, rollover: pot - paid, cap };
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
    readConfig, validDeviceId, nextPromptMs, planCheckin, planAccrual, planShares, eligibleEntries, shareCap, planReserve, isAgentOrBlocked,
};
