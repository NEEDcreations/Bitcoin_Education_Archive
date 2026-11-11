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
    // Linked accounts (same exact IP or same device key) share one share-cap
    // bucket at payout. Subnet linking is stricter and off by default (CGNAT /
    // campus networks would merge strangers). Phil may flip it in config.
    linkBySubnet: false,
});

const CREDIT_SECONDS = 60;
const MIN_GAP_MS = 55 * 1000;      // reject rapid/duplicate check-ins
const ACTIVE_WINDOW_MS = 90 * 1000; // a viewer counts if checked in this recently
const DEVICE_HOLD_MS = 3 * 60 * 1000;
// Slack on top of promptAnswerSeconds for the round trip of the tap.
const ANSWER_GRACE_MS = 10 * 1000;
const MAX_LINKS = 8;

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
// The answer window (promptAnswerSeconds) runs from when the server issued
// the token (promptIssuedMs). A token without an issue time predates the
// window and counts as expired, so it is re-issued once.
function promptExpired(p, now, cfg) {
    if (!p || !p.promptToken) return false;
    const issued = num(p.promptIssuedMs, 0);
    if (!issued) return true;
    const windowMs = num(cfg && cfg.promptAnswerSeconds, DEFAULTS.promptAnswerSeconds) * 1000 + ANSWER_GRACE_MS;
    return now - issued > windowMs;
}

function promptIsAnswered(p, now, answer, cfg) {
    const due = num(p.promptDueMs, 0);
    if (!(due && now >= due && answer && p.promptToken && answer === p.promptToken)) return false;
    return !promptExpired(p, now, cfg);
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
    const answered = promptIsAnswered(p, now, ctx.promptAnswer, cfg);
    if (!answered && last && now - last < MIN_GAP_MS) return { credit: 0, reason: 'too-fast', reject: true };
    const patch = { lastCheckMs: now };
    let promptDue = num(p.promptDueMs, 0);
    if (!promptDue) { promptDue = nextPromptMs(now, cfg, ctx.rand); patch.promptDueMs = promptDue; }
    if (now >= promptDue) {
        if (answered) {
            patch.promptDueMs = nextPromptMs(now, cfg, ctx.rand);
            patch.promptToken = '';
            patch.promptIssuedMs = 0;
        } else {
            const expired = promptExpired(p, now, cfg);
            let token = p.promptToken || '';
            if (!token || expired) {
                token = ctx.newToken;
                patch.promptToken = token;
                patch.promptIssuedMs = now;
            }
            // Leave lastCheckMs where it was so the tap in this same minute can credit.
            delete patch.lastCheckMs;
            return { credit: 0, reason: expired ? 'prompt-expired' : 'prompt', prompt: true, token: token, patch };
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
// liveTotal is the public header after the staleness check (0 when the
// aggregate is older than 3 minutes). crediting is signed-in, age-ok,
// device-locked check-ins that actually credited. Forged presence can raise
// the header, so accrual is the smaller of the two. Zero crediting check-ins
// means zero sats, even when liveTotal is 50.
function accrualViewers(liveTotal, crediting) {
    const live = Math.floor(Number(liveTotal));
    const credit = Math.floor(Number(crediting));
    const liveN = Number.isFinite(live) && live > 0 ? live : 0;
    const creditN = Number.isFinite(credit) && credit > 0 ? credit : 0;
    return Math.min(liveN, creditN);
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
        .map(e => ({ uid: String(e.uid), seconds: Math.min(Number(e.seconds), cfg.perAccountLimitSeconds), links: Array.isArray(e.links) ? e.links : [] }));
}

// Link keys for one watch doc. ip:/dev: always, net: only with linkBySubnet.
function linkKeys(w, cfg) {
    const src = w || {};
    const out = [];
    const add = (prefix, list) => { (Array.isArray(list) ? list : []).slice(0, MAX_LINKS).forEach(v => { if (v) out.push(prefix + String(v)); }); };
    add('ip:', src.linkIps);
    add('dev:', src.linkDevices);
    if (cfg && cfg.linkBySubnet) add('net:', src.linkNets);
    return out;
}

// Merge a capped, de-duplicated list of link ids (newest last).
function mergeLinks(prev, value) {
    const list = (Array.isArray(prev) ? prev : []).filter(Boolean).map(String);
    const v = value ? String(value) : '';
    if (!v || list.indexOf(v) !== -1) return list.slice(-MAX_LINKS);
    return list.concat([v]).slice(-MAX_LINKS);
}

// Union-find over accounts that share any link key. Returns groups of
// eligible entries (Spam/Abuse #278 follow-up: one share-cap bucket per group).
function groupLinked(elig) {
    const parent = elig.map((_, i) => i);
    const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    const owner = new Map();
    elig.forEach((e, i) => {
        (e.links || []).forEach(k => {
            if (!owner.has(k)) { owner.set(k, i); return; }
            const a = find(owner.get(k)), b = find(i);
            if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
        });
    });
    const byRoot = new Map();
    elig.forEach((e, i) => {
        const r = find(i);
        if (!byRoot.has(r)) byRoot.set(r, []);
        byRoot.get(r).push(e);
    });
    return Array.from(byRoot.values());
}

// Split a group's sats among its members by seconds. Whole sats, largest
// remainder first, ties by uid, so the split is deterministic.
function splitGroup(members, sats) {
    const total = members.reduce((t, m) => t + m.seconds, 0);
    if (members.length === 1) return [{ uid: members[0].uid, seconds: members[0].seconds, sats: sats }];
    const raw = members.map(m => ({ m, v: total > 0 ? sats * m.seconds / total : sats / members.length }));
    let given = 0;
    const out = new Map();
    raw.forEach(r => { const f = Math.floor(r.v); out.set(r.m.uid, f); given += f; });
    let left = sats - given;
    raw.slice().sort((a, b) => (b.v - Math.floor(b.v)) - (a.v - Math.floor(a.v)) || (a.m.uid < b.m.uid ? -1 : 1)).forEach(r => {
        if (left > 0) { out.set(r.m.uid, out.get(r.m.uid) + 1); left--; }
    });
    return members.map(m => ({ uid: m.uid, seconds: m.seconds, sats: out.get(m.uid) || 0 }));
}

// Water-fill across linked groups, then split inside each group.
function fillGrouped(elig, pot, cfg) {
    const groups = groupLinked(elig);
    const n = groups.length;
    const cap = shareCap(pot, n, cfg);
    const bucket = groups.map((g, i) => ({ uid: 'g' + i, seconds: g.reduce((t, m) => t + m.seconds, 0) }));
    const filled = fillShares(bucket, pot, cap);
    const bySats = new Map(filled.shares.map(s => [s.uid, s.sats]));
    let shares = [];
    groups.forEach((g, i) => { shares = shares.concat(splitGroup(g, bySats.get('g' + i) || 0)); });
    shares = shares.filter(e => e.sats > 0);
    const paid = shares.reduce((t, e) => t + e.sats, 0);
    return { groups: n, linked: groups.filter(g => g.length > 1).length, cap, shares, paid, rollover: pot - paid };
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
// Fewer than minEligibleWatchers qualifying ACCOUNTS: no payout (wait: true).
// Spam/Abuse #287 M1: the threshold counts raw accounts, so a classroom or
// household behind one IP is not stuck waiting forever. Linked accounts
// (same exact IP or device; subnet only with linkBySubnet) still share ONE
// share-cap bucket (Phil Nov 9), and the 2/N cap uses the group count.
// eligible = accounts (threshold), groups = linked groups (cap).
function planShares(entries, cfg) {
    const pot = Math.floor(cfg.targetSats);
    const elig = eligibleEntries(entries, cfg);
    const groups = groupLinked(elig).length;
    const cap = shareCap(pot, groups, cfg);
    const minN = Math.max(1, Math.floor(cfg.minEligibleWatchers));
    if (elig.length < minN) return { wait: true, eligible: elig.length, accounts: elig.length, groups, shares: [], paid: 0, rollover: 0, cap };
    const filled = fillGrouped(elig, pot, cfg);
    return { wait: false, eligible: elig.length, accounts: elig.length, groups, linkedGroups: filled.linked, shares: filled.shares, paid: filled.paid, rollover: filled.rollover, cap };
}

// True when a watch doc still carries any link id (scrubbed at pot close).
function hasLinks(w) {
    const src = w || {};
    return ['linkIps', 'linkDevices', 'linkNets'].some(k => Array.isArray(src[k]) && src[k].length > 0);
}

// Live UI projection: same math as planShares, but still returns per-uid sats
// when the pot is waiting on more eligible watchers (payout still waits).
// Watchers below minQualifySeconds get 0. Does not change payout behavior.
function projectShares(entries, cfg) {
    const pot = Math.floor(cfg.targetSats);
    const all = (entries || []).filter(e => e && e.uid).map(e => ({
        uid: String(e.uid),
        seconds: Math.min(Math.max(0, Number(e.seconds) || 0), cfg.perAccountLimitSeconds),
        links: Array.isArray(e.links) ? e.links : [],
    }));
    const elig = eligibleEntries(all, cfg);
    const groups = groupLinked(elig).length;
    const cap = shareCap(pot, groups, cfg);
    const minN = Math.max(1, Math.floor(cfg.minEligibleWatchers));
    const waiting = elig.length < minN;
    const n = elig.length;
    const byUid = new Map(all.map(e => [e.uid, 0]));
    if (n > 0) {
        const filled = fillGrouped(elig, pot, cfg);
        for (const s of filled.shares) byUid.set(s.uid, s.sats);
    }
    const shares = all.map(e => ({ uid: e.uid, seconds: e.seconds, sats: byUid.get(e.uid) || 0 }));
    const paid = shares.reduce((t, e) => t + e.sats, 0);
    return { waiting, eligible: n, groups, shares, paid, rollover: Math.max(0, pot - paid), cap };
}

// Reserve check: the faucet floor always stays covered.
function planReserve(walletSats, alreadyReserved, cfg) {
    if (!(walletSats >= 0)) return { ok: false, reason: 'wallet-unknown' };
    const after = walletSats - num(alreadyReserved, 0) - cfg.targetSats;
    if (after < cfg.minWalletSats) return { ok: false, reason: 'wallet-low', after };
    return { ok: true, after };
}

// What a distributing pot gives back to the reserve. Pots reserved before
// reservedAmount existed fall back to the current targetSats (old behavior).
function reservedAmountOf(pot, cfg) {
    const n = Math.floor(num(pot && pot.reservedAmount, 0));
    return n > 0 ? n : Math.floor(cfg.targetSats);
}

// The next pot after a successful distribution (whole doc, replaces current).
function nextPotDoc(cur, plan, cfg, nowMs) {
    const c = cur || {};
    const nextNum = (parseInt(String(c.potId).replace(/\D/g, ''), 10) || 1) + 1;
    return {
        potId: 'pot' + nextNum, status: 'filling', sats: Math.max(0, Math.min(num(plan && plan.rollover, 0), cfg.targetSats - 1)), viewers: 0, bursts: 0,
        target: cfg.targetSats, createdMs: nowMs, lastPaidPot: c.potId, lastPaidWinners: (plan && plan.shares ? plan.shares.length : 0),
        dayKey: c.dayKey || '', dayAccrued: c.dayAccrued || 0,
    };
}

function isAgentOrBlocked(user) {
    const u = user || {};
    return u.isBot === true || u.isAgent === true || u.aiAgent === true || u.accountType === 'agent' ||
        u.isTest === true || u.banned === true || !!u.ban_reason || u.satsDisabled === true;
}

module.exports = {
    DEFAULTS, CREDIT_SECONDS, MIN_GAP_MS, ACTIVE_WINDOW_MS, DEVICE_HOLD_MS, ANSWER_GRACE_MS, MAX_LINKS,
    promptExpired, linkKeys, mergeLinks, hasLinks, groupLinked, splitGroup, fillGrouped, reservedAmountOf, nextPotDoc,
    readConfig, validDeviceId, nextPromptMs, promptIsAnswered, planCheckin, accrualViewers, rateFromViewers, planAccrual, planShares, projectShares, fillShares, eligibleEntries, shareCap, planReserve, isAgentOrBlocked,
};
