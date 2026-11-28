'use strict';

// Satoshi's Favor per-block self-claim (Phil, Nov 14 2026).
//
// Every archived epoch block is its own claim. The winner of block B in
// epoch N is read ONLY from the server's frozen result for that epoch
// (sf_payout_results/epoch_N), which is derived from sfPoolHistory and
// re-checked against sfPoolHistory on every claim. Nothing the client sends
// (uid, amount, address, invoice) is ever used: the client sends only
// { epoch, block } and both must be plain small integers.
//
// No admin approval step. Two switches decide what can be claimed:
//   config/satoshiFavorPayouts.claimsEnabled  (global off switch, default OFF)
//   config/satoshiFavorPayouts.enabledEpochs  (per-epoch flag, default [1])
// and the app kill switch (config/killSwitch) refuses every claim while on.
//
// Money order of operations for one claim (sf_block_claims/e{N}_b{B}):
//   1. transaction: refuse if the block is paid / paying / unknown / held,
//      check per-uid daily, site daily and monthly caps, then mark the claim
//      'paying' and reserve the prize plus the maximum routing fee (in msat)
//      BEFORE any wallet call; release the reserve on failure;
//   2. wallet balance floor (halts every claim while below), own-node pubkey;
//   3. resolve an invoice for the frozen address only, decode it on the
//      server: exact net amount, not zero-amount, not expired, mainnet, not
//      our own node;
//   4. pay once. A clear refusal releases the reservation (attempt counted,
//      3 strikes -> manual review). An unknown result is looked up once and,
//      if still unknown, held as 'unknown' for a person. Never auto-retried.
//   5. paid -> write-once payout record sf_block_payouts/e{N}_b{B}.
// Every refusal and every payment writes an audit row (sf_claim_audit).
//
// Permanent records (never deleted, excluded from every cleanup):
// sfPoolHistory, sf_payout_results, sf_block_claims, sf_block_payouts,
// sf_claim_audit. See PERMANENT_COLLECTIONS.

const crypto = require('crypto');
const payoutMsat = require('./payoutMsat');

const BLOCKS_PER_EPOCH = 5;
const EPOCH_POT_SATS = 21000;
const HARD_PER_CLAIM_CAP_SATS = 5000;
const MAX_EPOCH_NUMBER = 9999;
const RESULT_VERSION = 2;
const MAINNET_PREFIX = 'lnbc';

// One-time catch-up (Phil, Nov 14 2026: "we can ignore the limit for this one
// time catch up"). Hardcoded to epochs 1-8. For those blocks only the monthly /
// Favor-budget limit is lifted; per-claim cap, one claim per block, daily caps
// and the wallet floor all stay. Instead of the monthly limit they sit under a
// HARD CEILING: the sum of the archived winner blocks of epochs 1-8 (at most
// 168,000) plus a fixed fee allowance, checked and incremented in the same
// transaction as each claim (sf_claim_counters/catchup_e1_8). There is no
// flag and no date: it ends by itself once every epoch 1-8 block is paid, and
// an unclaimed epoch 1-8 block claimed after the 2027 relaunch is still covered.
const CATCH_UP_FIRST_EPOCH = 1;
const CATCH_UP_LAST_EPOCH = 8;
const CATCH_UP_MAX_BLOCK_SATS = 168000;
const CATCH_UP_FEE_ALLOWANCE_SATS = 2000;
const CATCH_UP_COUNTER_ID = 'catchup_e1_8';

// Routing-fee cap (Red Team, Nov 14 2026). The payee controls the invoice
// through LNURL, so route hints through a private channel they own could
// carry an inflated fee that our wallet pays on top of the exact amount.
// Before paying: refuse any invoice whose worst route-hint path fee is over
// max(10 sats, 1% of the invoice amount) and set the block aside for a person.
// After paying: if the wallet's reported routing fee is over the same limit,
// halt every further claim (sf_claim_counters/fee_halt) until an admin clears it.
const ROUTE_FEE_MIN_SATS = 10;
const ROUTE_FEE_PPM = 10000; // 1%
const FEE_HALT_DOC_ID = 'fee_halt';

// Per-uid call limit on claimFavorBlock (Spam/Abuse #311 M1): at most
// RATE_MAX calls per RATE_WINDOW_MS per account. Signed-out and malformed
// calls are refused without any Firestore write.
const RATE_MAX = 20;
const RATE_WINDOW_MS = 10 * 60 * 1000;
// Codes that never write an sf_claim_audit row (no spam into a permanent log).
const NO_AUDIT_CODES = Object.freeze(['unauthenticated', 'bad_id']);

function isCatchUpEpoch(epoch) {
    return Number.isInteger(epoch) && epoch >= CATCH_UP_FIRST_EPOCH && epoch <= CATCH_UP_LAST_EPOCH;
}
function catchUpCeiling(blockSatsTotal) {
    const blocks = Math.max(0, Math.min(Math.floor(Number(blockSatsTotal) || 0), CATCH_UP_MAX_BLOCK_SATS));
    return blocks + CATCH_UP_FEE_ALLOWANCE_SATS;
}

const PERMANENT_COLLECTIONS = Object.freeze([
    'sfPoolHistory',
    'sf_payout_results',
    'sf_block_claims',
    'sf_block_payouts',
    'sf_claim_audit',
    'sf_claim_reviews',
]);

const DEFAULTS = Object.freeze({
    claimsEnabled: false,
    enabledEpochs: Object.freeze([1]),
    perClaimCapSats: HARD_PER_CLAIM_CAP_SATS,
    perUidDailySats: 12600,      // 3 blocks a day per player
    siteDailySats: 21000,        // one full epoch a day, site-wide
    monthlySats: 45000,          // Favor's share of the 100k/month app budget
    walletFloorSats: 5000,       // below this balance nothing pays
    maxAttempts: 3,              // explicit wallet refusals before manual review
    cooldownMs: 60 * 1000,       // between attempts on one block
    feeSats: 10,                 // flat Lightning fee (lnFee.js)
});

const MESSAGES = Object.freeze({
    unauthenticated: 'Sign in with your account to claim.',
    bad_id: 'That block cannot be claimed.',
    offline: 'Bitcoin Quest is offline for maintenance. Your block is saved; claim it when we are back.',
    claims_off: 'Favor claims are paused right now. Your block is saved.',
    epoch_disabled: 'Claims for this epoch are not open yet. Your block is saved.',
    epoch_not_ready: 'This epoch is not ready to claim yet.',
    history_mismatch: 'This epoch needs a quick check before it can be claimed. An admin has been alerted.',
    not_winner: 'Only the player who found this block can claim it.',
    amount_invalid: 'This block needs a manual check before it can be paid.',
    account_blocked: 'This account cannot claim sats right now.',
    age_18_required: "Confirm you're 18+ to earn sats.",
    unavailable: 'Try again later.',
    step_up_required: 'Confirm it is you to claim this block.',
    manual_review: 'This block is set aside for a manual check. Your sats are safe.',
    already_paid: 'This block was already paid.',
    in_progress: 'A payment for this block is already in progress.',
    held_unknown: 'This payment is being confirmed by a person so it cannot be paid twice.',
    cooldown: 'Wait a minute before trying this block again.',
    uid_daily_cap: 'You reached today\'s claim limit. Claim the rest tomorrow.',
    site_daily_cap: 'Today\'s Favor payouts are used up. Try again tomorrow.',
    monthly_cap: 'This month\'s Favor payout budget is used up. Your block is saved.',
    wallet_low: 'The prize wallet is being refilled. Your block is saved; try again later.',
    wallet_unavailable: 'The prize wallet did not answer. Your block is saved; try again later.',
    bad_invoice: 'Could not get a valid invoice from your Lightning address. Your block is saved.',
    pay_failed: 'Payment failed. Your block is still waiting.',
    catch_up_ceiling: 'This payout is over the catch-up total and needs a manual check. Your block is saved.',
    route_fee_high: 'Your wallet\'s invoice asks for an unusually high routing fee, so this block is set aside for a manual check. Your sats are safe.',
    fee_halt: 'Favor payouts are paused for a quick check. Your block is saved.',
    rate_limited: 'Too many tries. Wait a few minutes and try again.',
    review_rejected: 'This block was reviewed and cannot be paid.',
});

function intStrict(v, lo, hi) {
    if (typeof v === 'number') {
        return Number.isInteger(v) && v >= lo && v <= hi ? v : null;
    }
    if (typeof v === 'string') {
        // Plain digits only: no padding, signs, spaces, exponents or leading zeros.
        if (!/^(0|[1-9][0-9]{0,3})$/.test(v)) return null;
        const n = Number(v);
        return n >= lo && n <= hi ? n : null;
    }
    return null;
}

// Client input is { epoch, block } only. Anything else is ignored.
function parseClaimIds(data) {
    const d = data && typeof data === 'object' && !Array.isArray(data) ? data : null;
    if (!d) return null;
    const epoch = intStrict(d.epoch, 1, MAX_EPOCH_NUMBER);
    const block = intStrict(d.block, 0, BLOCKS_PER_EPOCH - 1);
    if (epoch == null || block == null) return null;
    return { epoch: epoch, block: block };
}

function claimId(epoch, block) { return 'e' + epoch + '_b' + block; }
function resultId(epoch) { return 'epoch_' + epoch; }

function normalizeLn(addr) {
    let s = String(addr == null ? '' : addr).trim().toLowerCase();
    if (s.indexOf('lightning:') === 0) s = s.slice(10).trim();
    return s;
}
function validLn(addr) {
    const a = normalizeLn(addr);
    return a.length >= 5 && a.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a);
}
function maskLn(addr) {
    const a = normalizeLn(addr);
    if (!validLn(a)) return '';
    const at = a.indexOf('@');
    return a.slice(0, Math.min(2, at)) + '\u2026' + a.slice(at);
}
function maskUid(uid) {
    const s = String(uid || '');
    return s ? s.slice(0, 5) + '\u2026' : '';
}
function uidHash(uid) {
    return crypto.createHash('sha256').update('sfclaim:' + String(uid || '')).digest('hex').slice(0, 24);
}
function savedLn(user) {
    const u = user || {};
    return normalizeLn(u.lightningAddress || u.lightning || u.lnAddress || '');
}
function toMs(v) {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v.seconds === 'number') return v.seconds * 1000;
    if (typeof v._seconds === 'number') return v._seconds * 1000;
    const d = new Date(v).getTime();
    return Number.isFinite(d) ? d : 0;
}
function posInt(v, hi, dflt) {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n > 0 && n <= hi ? n : dflt;
}

function readConfig(raw) {
    const d = raw && typeof raw === 'object' ? raw : {};
    const epochs = Array.isArray(d.enabledEpochs)
        ? d.enabledEpochs.map(function (e) { return intStrict(e, 1, MAX_EPOCH_NUMBER); }).filter(function (e) { return e != null; })
        : DEFAULTS.enabledEpochs.slice();
    return {
        claimsEnabled: d.claimsEnabled === true,
        enabledEpochs: epochs,
        perClaimCapSats: Math.min(posInt(d.perClaimCapSats, HARD_PER_CLAIM_CAP_SATS, DEFAULTS.perClaimCapSats), HARD_PER_CLAIM_CAP_SATS),
        perUidDailySats: posInt(d.perUidDailySats, 1000000, DEFAULTS.perUidDailySats),
        siteDailySats: posInt(d.siteDailySats, 1000000, DEFAULTS.siteDailySats),
        monthlySats: posInt(d.monthlySats, 1000000, DEFAULTS.monthlySats),
        walletFloorSats: posInt(d.walletFloorSats, 10000000, DEFAULTS.walletFloorSats),
        maxAttempts: posInt(d.maxAttempts, 10, DEFAULTS.maxAttempts),
        cooldownMs: posInt(d.cooldownMs, 24 * 3600 * 1000, DEFAULTS.cooldownMs),
        feeSats: DEFAULTS.feeSats,
        mockWallet: d.mockWallet === true,
        mockWalletBalanceSats: posInt(d.mockWalletBalanceSats, 10000000, 50000),
        mockPayOutcome: typeof d.mockPayOutcome === 'string' ? d.mockPayOutcome : 'paid',
        // Staging mock only: lookup and balance outcomes (see stagingMockWallet.js).
        mockLookupOutcome: typeof d.mockLookupOutcome === 'string' ? d.mockLookupOutcome : 'pending',
        mockBalanceOutcome: typeof d.mockBalanceOutcome === 'string' ? d.mockBalanceOutcome : 'ok',
        // Staging mock wallet only (ignored unless the staging build uses the mock).
        mockRouteHint: ['none', 'normal', 'high'].indexOf(d.mockRouteHint) !== -1 ? d.mockRouteHint : 'none',
        mockFeesPaidMsat: posInt(d.mockFeesPaidMsat, 100000000, 0),
        // Staging mock only: getInfo answers with a blank pubkey, like live Alby Hub.
        mockBlankPubkey: d.mockBlankPubkey === true,
    };
}

// The blocks of one archived epoch, straight from sfPoolHistory docs.
// Exactly one doc must carry the epoch number, it must be complete
// (5 blocks, completedAt), and every block needs a winner uid.
function deriveEpochBlocks(historyDocs, epoch) {
    const docs = (historyDocs || []).filter(function (d) {
        return d && d.data && Number(d.data.epochNumber) === epoch;
    });
    if (docs.length !== 1) return { ok: false, reason: docs.length ? 'duplicate_history' : 'no_history' };
    const h = docs[0].data;
    const blocks = Array.isArray(h.blocks) ? h.blocks : [];
    if (blocks.length !== BLOCKS_PER_EPOCH) return { ok: false, reason: 'not_closed' };
    if (!toMs(h.completedAt)) return { ok: false, reason: 'not_closed' };
    const total = Number(h.totalSats) || EPOCH_POT_SATS;
    if (total !== EPOCH_POT_SATS) return { ok: false, reason: 'pot_mismatch' };
    const per = total / BLOCKS_PER_EPOCH;
    if (!Number.isInteger(per)) return { ok: false, reason: 'pot_mismatch' };
    const rows = [];
    for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i] || {};
        const uid = typeof b.uid === 'string' ? b.uid : '';
        if (!uid || uid.length > 128) return { ok: false, reason: 'bad_block' };
        rows.push({ block: i, uid: uid, amount: per });
    }
    return { ok: true, historyDocId: docs[0].id, completedAtMs: toMs(h.completedAt), totalSats: total, perBlockSats: per, rows: rows };
}

// Frozen per-block result for one epoch. Pure: callers pass the players.
// players[uid] = { ln, lnResetMs } read at close (or at backfill time).
function buildEpochResult(derived, players, opts) {
    const o = opts || {};
    const byLn = {};
    derived.rows.forEach(function (r) {
        const p = players[r.uid] || {};
        const ln = normalizeLn(p.ln);
        if (!validLn(ln)) return;
        byLn[ln] = byLn[ln] || {};
        byLn[ln][r.uid] = true;
    });
    const blocks = derived.rows.map(function (r) {
        const p = players[r.uid] || {};
        const ln = normalizeLn(p.ln);
        const priorOwners = Object.keys(((o.priorLnOwners || {})[ln]) || {}).filter(function (u) { return u !== r.uid; });
        const otherHolders = (p.otherHolders || []).filter(function (u) { return u !== r.uid; });
        const lockedByOther = !!p.lnLockOwner && p.lnLockOwner !== r.uid;
        // Shared within this epoch, with a winner of another epoch, with
        // another account now, or locked to another account.
        const shared = validLn(ln) && (Object.keys(byLn[ln] || {}).length > 1 || priorOwners.length > 0 || otherHolders.length > 0 || lockedByOther);
        // Backfills happen after close. A one-time address reset after close
        // means the frozen address may not be the close-time one: hold it.
        // Backfill only: the first save of an address is not an ln_reset, so
        // also require the address lock to predate the close. A lock made after
        // close, or with no known time, goes to review (Spam/Abuse #311 M2).
        const lockAfterClose = o.source !== 'close' && validLn(ln) && !(Number(p.lnLockMs) > 0 && Number(p.lnLockMs) <= derived.completedAtMs);
        const changedAfterClose = Number(p.lnResetMs) > derived.completedAtMs || lockAfterClose;
        let review = '';
        if (!validLn(ln)) review = 'no_address';
        else if (shared) review = 'shared_address';
        else if (changedAfterClose) review = 'address_changed_after_close';
        return {
            block: r.block,
            uid: r.uid,
            amount: r.amount,
            frozenLn: validLn(ln) ? ln : '',
            sharedLn: shared,
            lnChangedAfterClose: changedAfterClose,
            manualReview: review,
        };
    });
    return {
        kind: 'epoch_blocks',
        version: RESULT_VERSION,
        epochNumber: Number(o.epoch),
        historyDocId: derived.historyDocId,
        completedAtMs: derived.completedAtMs,
        totalSats: derived.totalSats,
        perBlockSats: derived.perBlockSats,
        frozenAtMs: Number(o.nowMs) || 0,
        frozenBy: o.source === 'close' ? 'close' : 'backfill',
        blocks: blocks,
    };
}

function resultMatchesHistory(result, derived) {
    if (!result || result.version !== RESULT_VERSION || !Array.isArray(result.blocks)) return false;
    if (result.historyDocId !== derived.historyDocId) return false;
    if (result.blocks.length !== derived.rows.length) return false;
    for (let i = 0; i < derived.rows.length; i++) {
        const a = result.blocks[i] || {};
        const b = derived.rows[i];
        if (a.block !== b.block || a.uid !== b.uid || a.amount !== b.amount) return false;
    }
    return true;
}

// Server-side check of a decoded BOLT11 invoice.
function validateInvoice(bolt, decoded, expectedSats, nowSec, ownPubkey) {
    const s = String(bolt || '').trim().toLowerCase();
    if (s.indexOf(MAINNET_PREFIX) !== 0 || s.indexOf('lnbcrt') === 0) return { ok: false, reason: 'wrong_network' };
    if (!decoded || typeof decoded !== 'object') return { ok: false, reason: 'undecodable' };
    const msats = decoded.millisatoshis != null ? Number(decoded.millisatoshis) : NaN;
    if (!Number.isFinite(msats) || msats <= 0) return { ok: false, reason: 'zero_amount' };
    if (msats !== expectedSats * 1000) return { ok: false, reason: 'amount_mismatch' };
    const exp = Number(decoded.timeExpireDate) || 0;
    if (!exp || exp <= nowSec) return { ok: false, reason: 'expired' };
    const payee = String(decoded.payeeNodeKey || '').toLowerCase();
    if (!payee) return { ok: false, reason: 'no_payee' };
    if (ownPubkey && payee === String(ownPubkey).toLowerCase()) return { ok: false, reason: 'own_node' };
    let hash = '';
    (decoded.tags || []).forEach(function (t) {
        if (t && (t.tagName === 'payment_hash' || t.tag === 'payment_hash') && t.data) hash = String(t.data);
    });
    if (!hash) return { ok: false, reason: 'no_payment_hash' };
    return { ok: true, paymentHash: hash };
}

// Most this payout may spend on routing, in msat: max(10 sats, 1% of the invoice).
function routeFeeLimitMsat(invoiceSats) {
    const msat = Math.max(0, Math.floor(Number(invoiceSats) || 0)) * 1000;
    return Math.max(ROUTE_FEE_MIN_SATS * 1000, Math.ceil(msat * ROUTE_FEE_PPM / 1e6));
}

// Worst route-hint fee of a decoded BOLT11, in msat. Each routing_info tag is
// one hint path; its fee is the sum over its hops of
// fee_base_msat + fee_proportional_millionths * amount / 1e6.
// Anything malformed counts as infinite (fail closed).
function routeHintFeeMsat(decoded, amountMsat) {
    const amt = Number(amountMsat);
    const tags = decoded && Array.isArray(decoded.tags) ? decoded.tags : [];
    let worst = 0;
    let paths = 0;
    for (let i = 0; i < tags.length; i++) {
        const t = tags[i];
        if (!t || (t.tagName !== 'routing_info' && t.tag !== 'routing_info')) continue;
        paths++;
        if (!Array.isArray(t.data) || !Number.isFinite(amt) || amt < 0) return { worstMsat: Infinity, paths: paths };
        let sum = 0;
        for (let j = 0; j < t.data.length; j++) {
            const hop = t.data[j] || {};
            const base = Number(hop.fee_base_msat);
            const ppm = Number(hop.fee_proportional_millionths);
            if (!Number.isFinite(base) || !Number.isFinite(ppm) || base < 0 || ppm < 0) return { worstMsat: Infinity, paths: paths };
            sum += base + Math.ceil(ppm * amt / 1e6);
        }
        if (sum > worst) worst = sum;
    }
    return { worstMsat: worst, paths: paths };
}

function checkRouteFees(decoded, invoiceSats) {
    const limitMsat = routeFeeLimitMsat(invoiceSats);
    const r = routeHintFeeMsat(decoded, Number(invoiceSats) * 1000);
    return { ok: r.worstMsat <= limitMsat, worstMsat: r.worstMsat === Infinity ? -1 : r.worstMsat, limitMsat: limitMsat, paths: r.paths };
}

// Pure cap check on the current counters.
function capCheck(cfg, amount, counters, catchUp) {
    const c = counters || {};
    if (amount > cfg.perClaimCapSats) return 'amount_invalid';
    if ((Number(c.uidDay) || 0) + amount > cfg.perUidDailySats) return 'uid_daily_cap';
    if ((Number(c.siteDay) || 0) + amount > cfg.siteDailySats) return 'site_daily_cap';
    const reserved = c.reservedMsat;
    const feeFn = c.feeLimitMsatFn || routeFeeLimitMsat;
    if (reserved != null) {
        if ((Number(c.uidDayMsat) || 0) + reserved > payoutMsat.spendCapMsat(cfg.perUidDailySats, feeFn)) return 'uid_daily_cap';
        if ((Number(c.siteDayMsat) || 0) + reserved > payoutMsat.spendCapMsat(cfg.siteDailySats, feeFn)) return 'site_daily_cap';
    }
    if (catchUp) {
        // Hard ceiling replaces the monthly limit for epochs 1-8 only.
        if (!(Number(catchUp.ceiling) > 0)) return 'catch_up_ceiling';
        if (reserved != null) {
            const used = c.catchUpMsat != null ? Number(c.catchUpMsat) || 0 : payoutMsat.satsToMsat(c.catchUp);
            if (used + reserved > payoutMsat.satsToMsat(catchUp.ceiling)) return 'catch_up_ceiling';
        } else if ((Number(c.catchUp) || 0) + amount > catchUp.ceiling) return 'catch_up_ceiling';
        return '';
    }
    if (reserved != null) {
        if ((Number(c.monthMsat) || 0) + reserved > payoutMsat.spendCapMsat(cfg.monthlySats, feeFn)) return 'monthly_cap';
    } else if ((Number(c.month) || 0) + amount > cfg.monthlySats) return 'monthly_cap';
    return '';
}

function dayKey(ms) { return new Date(ms).toISOString().slice(0, 10); }
// Calendar day in America/New_York, for once-a-day admin alerts.
function etDayKey(ms) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}
function monthKey(ms) { return new Date(ms).toISOString().slice(0, 7); }

class ClaimRefusal extends Error {
    constructor(code, extra) {
        super(MESSAGES[code] || code);
        this.code = code;
        this.extra = extra || {};
    }
}

// deps:
//   db                      Firestore-like (collection/doc/get/set/create/update, runTransaction)
//   nowMs()                 clock
//   isOffline()             kill switch reader (fail closed: throw or true)
//   accountGate(uid, ctx)   -> { ok, code?, detail? } bans, deletes, merges, holds, email, age
//   stepUp(ctx, data)       throws when a fresh 2FA proof is needed and missing
//   recentSignIn(ctx, now)  boolean
//   wallet(cfg)             -> { getBalance, getInfo, payInvoice, lookupInvoice }
//   resolveInvoice(ln, sats)-> bolt11 string (LNURL-pay of the frozen address)
//   decodeInvoice(bolt)     -> decoded bolt11
//   shouldLookupPay, lookupSettlement   (from cipherClaim.js)
//   notifyAdmin(text, extra)
//   withTimeout(promise, ms, label)
function createBlockClaimService(deps) {
    const db = deps.db;
    const now = deps.nowMs || Date.now;
    const withTimeout = deps.withTimeout || function (p) { return p; };
    const logWarn = deps.logWarn || function (msg, data) { console.warn(msg, JSON.stringify(data || {})); };

    async function audit(row) {
        try {
            await db.collection('sf_claim_audit').add(Object.assign({ atMs: now() }, row));
        } catch (e) { console.warn('[sfclaim] audit write failed'); }
    }
    async function alert(text, extra) {
        try { if (deps.notifyAdmin) await deps.notifyAdmin(text, extra || {}); }
        catch (e) { console.warn('[sfclaim] admin alert failed'); }
    }
    // Same alert at most once per key per ET day (key = reason/epoch/block).
    async function alertOnce(key, text, extra) {
        const id = 'alert_' + String(key).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120) + '_' + etDayKey(now());
        try {
            await db.collection('sf_claim_counters').doc(id).create({ atMs: now(), key: String(key).slice(0, 120) });
        } catch (e) { return false; } // already alerted today (or write failed: stay quiet)
        await alert(text, extra);
        return true;
    }
    // Sliding fixed window per uid. Returns { ok, first } where first marks
    // the first refused call of a window (the only one that is audited).
    async function rateCheck(uid) {
        const ref = db.collection('sf_claim_counters').doc('rate_' + uidHash(uid));
        const t = now();
        let out = { ok: true, first: false };
        await db.runTransaction(async function (tx) {
            const snap = await tx.get(ref);
            const cur = snap.exists ? (snap.data() || {}) : {};
            const fresh = !cur.windowStartMs || t - Number(cur.windowStartMs) >= RATE_WINDOW_MS;
            const count = fresh ? 1 : (Number(cur.count) || 0) + 1;
            tx.set(ref, { windowStartMs: fresh ? t : Number(cur.windowStartMs), count: count, updatedAtMs: t });
            out = { ok: count <= RATE_MAX, first: count === RATE_MAX + 1 };
        });
        return out;
    }
    async function loadConfig() {
        const snap = await db.collection('config').doc('satoshiFavorPayouts').get();
        return readConfig(snap.exists ? snap.data() : {});
    }
    async function loadHistory(epoch) {
        const snap = await db.collection('sfPoolHistory').where('epochNumber', '==', epoch).get();
        return (snap.docs || []).map(function (d) { return { id: d.id, data: d.data() || {} }; });
    }

    // Sum of archived winner blocks for epochs 1-8, straight from sfPoolHistory.
    async function catchUpBlockTotal() {
        let total = 0;
        for (let e = CATCH_UP_FIRST_EPOCH; e <= CATCH_UP_LAST_EPOCH; e++) {
            const d = deriveEpochBlocks(await loadHistory(e), e);
            if (d.ok) d.rows.forEach(function (r) { total += r.amount; });
        }
        return Math.min(total, CATCH_UP_MAX_BLOCK_SATS);
    }

    // Freeze (or re-read) an epoch's per-block result. Create-only and
    // deterministic; never writes sfPoolHistory.
    async function freezeEpoch(epoch, opts) {
        const o = opts || {};
        const e = intStrict(epoch, 1, MAX_EPOCH_NUMBER);
        if (e == null) return { ok: false, reason: 'bad_epoch' };
        const derived = deriveEpochBlocks(await loadHistory(e), e);
        if (!derived.ok) return derived;
        const ref = db.collection('sf_payout_results').doc(resultId(e));
        const existing = await ref.get();
        if (existing.exists) {
            const cur = existing.data() || {};
            return { ok: resultMatchesHistory(cur, derived), existed: true, reason: resultMatchesHistory(cur, derived) ? '' : 'existing_mismatch', result: cur };
        }
        const players = {};
        const uids = Array.from(new Set(derived.rows.map(function (r) { return r.uid; })));
        for (let i = 0; i < uids.length; i++) {
            const u = await db.collection('users').doc(uids[i]).get();
            const r = await db.collection('ln_resets').doc(uids[i]).get();
            const rr = r.exists ? (r.data() || {}) : {};
            const ln = savedLn(u.exists ? u.data() : {});
            const p = { ln: ln, lnResetMs: toMs(rr.ln_reset_used), lnLockMs: 0, lnLockOwner: '', otherHolders: [] };
            if (validLn(ln)) {
                // The address lock (lightning_addresses/{ln}) dates the first save.
                const lock = await db.collection('lightning_addresses').doc(ln).get();
                if (lock.exists) {
                    const ld = lock.data() || {};
                    p.lnLockOwner = String(ld.uid || '');
                    p.lnLockMs = toMs(ld.lockedAt) || toMs(lock.createTime);
                }
                // Other accounts holding the same address right now.
                for (const field of ['lightningAddress', 'lightning', 'lnAddress']) {
                    const q = await db.collection('users').where(field, '==', ln).limit(5).get();
                    (q.docs || []).forEach(function (d) { if (d.id !== uids[i]) p.otherHolders.push(d.id); });
                }
            }
            players[uids[i]] = p;
        }
        // Addresses already frozen for other winners in other epochs.
        const priorLnOwners = {};
        const prior = await db.collection('sf_payout_results').get();
        (prior.docs || []).forEach(function (d) {
            if (d.id === resultId(e)) return;
            const blocks = ((d.data() || {}).blocks) || [];
            blocks.forEach(function (b) {
                if (!b || !validLn(b.frozenLn)) return;
                priorLnOwners[b.frozenLn] = priorLnOwners[b.frozenLn] || {};
                priorLnOwners[b.frozenLn][b.uid] = true;
            });
        });
        const result = buildEpochResult(derived, players, { epoch: e, nowMs: now(), source: o.source, priorLnOwners: priorLnOwners });
        if (o.dryRun) return { ok: true, dryRun: true, result: result };
        try {
            await ref.create(result);
        } catch (err) {
            // Lost a race with another freezer: re-read and compare.
            const again = await ref.get();
            const cur = again.exists ? again.data() : null;
            return { ok: !!cur && resultMatchesHistory(cur, derived), existed: true, result: cur };
        }
        await audit({ type: 'freeze', epoch: e, source: result.frozenBy, blocks: result.blocks.length });
        return { ok: true, created: true, result: result };
    }

    function refuse(code, extra) { throw new ClaimRefusal(code, extra); }

    async function claim(context, data) {
        const t0 = now();
        const auth = context && context.auth;
        const uid = auth && typeof auth.uid === 'string' ? auth.uid : '';
        const provider = auth && auth.token && auth.token.firebase && auth.token.firebase.sign_in_provider;
        let ids = null;
        let reserved = false;
        let counterKeys = null;
        let amount = 0;
        const base = { uidMasked: maskUid(uid), uidHash: uid ? uidHash(uid) : '' };
        try {
            if (!uid || provider === 'anonymous') refuse('unauthenticated');
            const rate = await rateCheck(uid);
            if (!rate.ok) refuse('rate_limited', { quiet: !rate.first });
            ids = parseClaimIds(data);
            if (!ids) refuse('bad_id');
            base.epoch = ids.epoch; base.block = ids.block;
            if (await deps.isOffline()) refuse('offline');
            const cfg = await loadConfig();
            if (!cfg.claimsEnabled) refuse('claims_off');
            if (cfg.enabledEpochs.indexOf(ids.epoch) === -1) refuse('epoch_disabled');

            const resSnap = await db.collection('sf_payout_results').doc(resultId(ids.epoch)).get();
            const result = resSnap.exists ? (resSnap.data() || {}) : null;
            if (!result || result.version !== RESULT_VERSION) refuse('epoch_not_ready');
            const derived = deriveEpochBlocks(await loadHistory(ids.epoch), ids.epoch);
            if (!derived.ok || !resultMatchesHistory(result, derived)) {
                await alertOnce('history_mismatch_e' + ids.epoch, 'Favor claim: epoch ' + ids.epoch + ' result does not match sfPoolHistory (' + (derived.reason || 'mismatch') + ').', { epoch: ids.epoch });
                refuse('history_mismatch');
            }
            const row = result.blocks[ids.block];
            if (!row || row.block !== ids.block) refuse('bad_id');
            // THE winner check: server data only.
            if (row.uid !== uid) refuse('not_winner');
            amount = row.amount;
            if (!Number.isInteger(amount) || amount <= cfg.feeSats || amount !== derived.perBlockSats || amount > cfg.perClaimCapSats) {
                refuse('amount_invalid');
            }

            const gate = await deps.accountGate(uid, context);
            if (!gate || !gate.ok) {
                if (gate && gate.code === 'unavailable') refuse('unavailable');
                // Sats need a confirmed 18+ answer. The block stays saved; nothing is reserved.
                if (gate && gate.code === 'age_18_required') refuse('age_18_required', { reason: gate.reason || '', userMessage: gate.error || '' });
                refuse('account_blocked', { gate: gate && gate.code });
            }

            // Fresh 2FA when the account has 2FA on (no-op otherwise).
            try { await deps.stepUp(context, data); }
            catch (e) { refuse('step_up_required', { why: 'second_factor' }); }

            const userSnap = await db.collection('users').doc(uid).get();
            const currentLn = savedLn(userSnap.exists ? userSnap.data() : {});
            const addressChanged = row.lnChangedAfterClose === true || (currentLn && currentLn !== row.frozenLn);
            if (addressChanged) {
                await alertOnce('address_changed_e' + ids.epoch + '_b' + ids.block, 'Favor claim: winner ' + maskUid(uid) + ' changed their Lightning address after epoch ' + ids.epoch +
                    ' closed. The payout still goes only to the frozen address.', { epoch: ids.epoch, block: ids.block });
                if (!deps.recentSignIn(context, now())) refuse('step_up_required', { why: 'address_changed' });
            }

            const cid = claimId(ids.epoch, ids.block);
            const claimRef = db.collection('sf_block_claims').doc(cid);
            const rejectRef = db.collection('sf_claim_reviews').doc(cid + '_rejected');
            const preSnap = await claimRef.get();
            const pre = preSnap.exists ? (preSnap.data() || {}) : null;
            if ((pre && pre.status === 'rejected') || (await rejectRef.get()).exists) refuse('review_rejected');
            // Read-only: refuse paid/paying before the manual-review gate. A
            // released block that later paid still carries the frozen
            // manualReview flag, so this gate would otherwise return
            // manual_review instead of already_paid (QA case e).
            if (pre && pre.status === 'paid') refuse('already_paid');
            if (pre && pre.status === 'paying') refuse('in_progress');
            // An admin release (adminResolveFavorReview) lets a frozen-review block
            // through to the normal checks below; it never changes winner or address.
            const released = !!pre && pre.reviewReleased === true && pre.status === 'claimable';
            if ((row.manualReview && !released) || !validLn(row.frozenLn)) {
                await db.runTransaction(async function (t) {
                    const c = await t.get(claimRef);
                    if (c.exists) return;
                    t.set(claimRef, {
                        epoch: ids.epoch, block: ids.block, uid: uid, amount: amount,
                        frozenLn: row.frozenLn || '', status: 'manual_review',
                        reviewReason: row.manualReview || 'no_address', createdAtMs: now(), attempts: 0,
                    });
                });
                await alertOnce('manual_review_e' + ids.epoch + '_b' + ids.block + '_' + (row.manualReview || 'no_address'), 'Favor claim set aside for manual review: epoch ' + ids.epoch + ' block ' + ids.block + ' (' + (row.manualReview || 'no_address') + ').', { epoch: ids.epoch, block: ids.block });
                refuse('manual_review', { reason: row.manualReview || 'no_address' });
            }

            const catchUp = isCatchUpEpoch(ids.epoch) ? { ceiling: catchUpCeiling(await catchUpBlockTotal()) } : null;

            // 1. Reserve in a transaction and mark 'paying' before the wallet call.
            // Wallet outflow is net + routing fee. Reserve the maximum fee too,
            // in msat, so concurrent claims cannot slip under a cap.
            const nowMs = now();
            const net = amount - cfg.feeSats;
            const feeLimitMsat = routeFeeLimitMsat(net);
            const reservedMsat = payoutMsat.reserveSpendMsat(net, feeLimitMsat);
            counterKeys = { day: dayKey(nowMs), month: monthKey(nowMs) };
            const uidDayRef = db.collection('sf_claim_counters').doc('uid_' + uidHash(uid) + '_' + counterKeys.day);
            const siteDayRef = db.collection('sf_claim_counters').doc('site_' + counterKeys.day);
            const monthRef = db.collection('sf_claim_counters').doc('month_' + counterKeys.month);
            const catchUpRef = db.collection('sf_claim_counters').doc(CATCH_UP_COUNTER_ID);
            // Catch-up claims count against the hard ceiling, not the month.
            const budgetRef = catchUp ? catchUpRef : monthRef;
            const haltRef = db.collection('sf_claim_counters').doc(FEE_HALT_DOC_ID);
            await db.runTransaction(async function (t) {
                const c = await t.get(claimRef);
                const ud = await t.get(uidDayRef);
                const sd = await t.get(siteDayRef);
                const md = await t.get(budgetRef);
                const hd = await t.get(haltRef);
                if (hd.exists && (hd.data() || {}).halted === true) refuse('fee_halt');
                const rj = await t.get(rejectRef);
                if (rj.exists) refuse('review_rejected');
                const cur = c.exists ? (c.data() || {}) : null;
                if (cur) {
                    if (cur.uid !== uid) refuse('not_winner');
                    if (cur.status === 'paid') refuse('already_paid');
                    if (cur.status === 'paying') refuse('in_progress');
                    if (cur.status === 'unknown') refuse('held_unknown');
                    if (cur.status === 'manual_review') refuse('manual_review');
                    if (cur.status === 'rejected') refuse('review_rejected');
                    if ((Number(cur.attempts) || 0) >= cfg.maxAttempts) refuse('manual_review');
                    if (cur.lastAttemptMs && nowMs - cur.lastAttemptMs < cfg.cooldownMs) refuse('cooldown');
                }
                const capCode = capCheck(cfg, amount, {
                    uidDay: ud.exists ? payoutMsat.counterSats(ud.data()) : 0,
                    siteDay: sd.exists ? payoutMsat.counterSats(sd.data()) : 0,
                    month: md.exists ? payoutMsat.counterSats(md.data()) : 0,
                    catchUp: md.exists ? payoutMsat.counterSats(md.data()) : 0,
                    uidDayMsat: ud.exists ? payoutMsat.counterMsats(ud.data()) : 0,
                    siteDayMsat: sd.exists ? payoutMsat.counterMsats(sd.data()) : 0,
                    monthMsat: md.exists ? payoutMsat.counterMsats(md.data()) : 0,
                    catchUpMsat: md.exists ? payoutMsat.counterMsats(md.data()) : 0,
                    reservedMsat: reservedMsat,
                    feeLimitMsatFn: routeFeeLimitMsat,
                }, catchUp);
                if (capCode) refuse(capCode);
                const rec = {
                    epoch: ids.epoch, block: ids.block, uid: uid, amount: amount,
                    frozenLn: row.frozenLn, status: 'paying', payingAtMs: nowMs,
                    lastAttemptMs: nowMs, attempts: (cur ? (Number(cur.attempts) || 0) : 0) + 1,
                    counterDay: counterKeys.day, counterMonth: counterKeys.month,
                    reservedMsat: reservedMsat, netSats: net,
                };
                if (!cur) rec.createdAtMs = nowMs;
                t.set(claimRef, rec, { merge: true });
                t.set(uidDayRef, payoutMsat.addReserved(ud.exists ? ud.data() : null, amount, reservedMsat, nowMs), { merge: true });
                t.set(siteDayRef, payoutMsat.addReserved(sd.exists ? sd.data() : null, amount, reservedMsat, nowMs), { merge: true });
                const budgetRow = payoutMsat.addReserved(md.exists ? md.data() : null, amount, reservedMsat, nowMs);
                if (catchUp) budgetRow.ceilingSats = catchUp.ceiling;
                t.set(budgetRef, budgetRow, { merge: true });
                rec.budget = catchUp ? CATCH_UP_COUNTER_ID : 'month';
                t.set(claimRef, { budget: rec.budget }, { merge: true });
            });
            reserved = true;

            // opts.review: set the block aside for a person instead of letting
            // the player retry (counters are still released).
            async function release(code, extra, opts) {
                const review = opts && opts.review ? String(opts.review) : '';
                await db.runTransaction(async function (t) {
                    const c = await t.get(claimRef);
                    const ud = await t.get(uidDayRef);
                    const sd = await t.get(siteDayRef);
                    const md = await t.get(budgetRef);
                    const cur = c.exists ? (c.data() || {}) : {};
                    if (cur.status !== 'paying') return;
                    const strikes = Number(cur.attempts) || 0;
                    const toReview = !!review || strikes >= cfg.maxAttempts;
                    t.set(claimRef, {
                        status: toReview ? 'manual_review' : 'claimable',
                        reviewReason: review || (strikes >= cfg.maxAttempts ? 'repeat_failures' : null),
                        lastError: code, payingAtMs: null,
                    }, { merge: true });
                    const giveBack = (cur.reservedMsat != null) ? Number(cur.reservedMsat) : reservedMsat;
                    t.set(uidDayRef, payoutMsat.releaseReserved(ud.exists ? ud.data() : null, amount, giveBack), { merge: true });
                    t.set(siteDayRef, payoutMsat.releaseReserved(sd.exists ? sd.data() : null, amount, giveBack), { merge: true });
                    t.set(budgetRef, payoutMsat.releaseReserved(md.exists ? md.data() : null, amount, giveBack), { merge: true });
                });
                reserved = false;
                refuse(code, extra);
            }

            // 2. Wallet floor + own node.
            let wallet = null;
            let walletSats = null;
            let ownPubkey = '';
            try {
                // Inside the try: NO_WALLET or mock-off releases the reservation.
                wallet = deps.wallet(cfg);
                const bal = await withTimeout(wallet.getBalance(), 20000, 'getBalance');
                const raw = bal && Number(bal.balance);
                if (!Number.isFinite(raw)) throw new Error('no balance');
                walletSats = Math.floor(raw / 1000);
                // getInfo must still answer with an object: a throw, timeout or
                // empty reply fails closed. Only a blank pubkey inside a real
                // reply (Alby Hub hides it on some NWC connections) is allowed;
                // validateInvoice then skips just the own_node check.
                const info = await withTimeout(wallet.getInfo(), 20000, 'getInfo');
                if (!info || typeof info !== 'object') throw new Error('no info');
                ownPubkey = String(info.pubkey || '').toLowerCase();
            } catch (e) {
                await release('wallet_unavailable');
            }
            const ownNodeCheck = !!ownPubkey;
            if (!ownNodeCheck) {
                // No uid or address in this line: epoch and block only.
                logWarn('[sfclaim] claim running WITHOUT own_node check: wallet getInfo returned a blank pubkey', { epoch: ids.epoch, block: ids.block });
            }
            if (walletSats - amount < cfg.walletFloorSats) {
                await alertOnce('wallet_low', 'Favor claims halted: prize wallet is below the ' + cfg.walletFloorSats + '-sat floor.', { floor: cfg.walletFloorSats });
                await release('wallet_low');
            }

            // 3. Invoice for the frozen address only; decoded and checked here.
            let bolt = '';
            let inv = null;
            let decoded = null;
            try {
                bolt = await deps.resolveInvoice(row.frozenLn, net, cfg);
                decoded = deps.decodeInvoice(bolt);
                inv = validateInvoice(bolt, decoded, net, Math.floor(now() / 1000), ownPubkey);
            } catch (e) {
                inv = { ok: false, reason: 'resolve_failed' };
            }
            if (!inv.ok) await release('bad_invoice', { reason: inv.reason });
            // Route-hint fee cap, before any wallet call. feeLimitMsat was
            // computed before the reserve so the reserved spend matches it.
            const hintFees = checkRouteFees(decoded, net);
            if (!hintFees.ok) {
                await alert('Favor claim set aside: the invoice for epoch ' + ids.epoch + ' block ' + ids.block +
                    ' carries a route-hint fee over the ' + Math.round(feeLimitMsat / 1000) + '-sat limit. Not paid.', { epoch: ids.epoch, block: ids.block });
                await release('route_fee_high', { worstHintFeeMsat: hintFees.worstMsat, limitMsat: hintFees.limitMsat, hintPaths: hintFees.paths }, { review: 'route_fee_high' });
            }
            const invoiceHash = crypto.createHash('sha256').update(bolt).digest('hex').slice(0, 32);
            await claimRef.set({ paymentHash: inv.paymentHash, invoiceHash: invoiceHash, netSats: net, feeSats: cfg.feeSats }, { merge: true });

            // 4. Pay exactly once.
            let payResult = null;
            let payError = null;
            try {
                payResult = await withTimeout(wallet.payInvoice({ invoice: bolt }), 30000, 'payInvoice');
                if (!payResult || !payResult.preimage) throw new Error('NO_PREIMAGE');
            } catch (e) { payError = e; }

            async function markPaid(preimage, how, routingFeeSats) {
                const paidAtMs = now();
                const payoutRef = db.collection('sf_block_payouts').doc(cid);
                const routing = Math.max(0, Math.ceil(Number(routingFeeSats) || 0));
                // Wallet spend is net + routing fee, in msat. The reservation
                // was net + max fee; true it up to the actual outflow and
                // release unused fee headroom. Budget prize sats move from
                // the gross amount to spent, same as before.
                const spent = net + routing;
                const spentMsat = payoutMsat.satsToMsat(net) + Math.max(0, Math.ceil(Number(routingFeeSats) * 1000 || 0));
                // Post-pay check: wallet spend over net must stay inside the fee limit.
                const routingMsat = Math.max(0, Number(routingFeeSats) * 1000 || 0);
                const overspend = routingMsat > feeLimitMsat;
                await db.runTransaction(async function (t) {
                    const p = await t.get(payoutRef);
                    const ud = await t.get(uidDayRef);
                    const sd = await t.get(siteDayRef);
                    const bd = await t.get(budgetRef);
                    if (overspend) {
                        t.set(haltRef, { halted: true, reason: 'routing_fee_over_limit', epoch: ids.epoch, block: ids.block,
                            routingFeeSats: routing, limitSats: Math.ceil(feeLimitMsat / 1000), atMs: paidAtMs }, { merge: true });
                    }
                    t.set(uidDayRef, payoutMsat.trueUpSpend(ud.exists ? ud.data() : null, reservedMsat, spentMsat, 0), { merge: true });
                    t.set(siteDayRef, payoutMsat.trueUpSpend(sd.exists ? sd.data() : null, reservedMsat, spentMsat, 0), { merge: true });
                    t.set(budgetRef, payoutMsat.trueUpSpend(bd.exists ? bd.data() : null, reservedMsat, spentMsat, -amount + spent), { merge: true });
                    t.set(claimRef, { status: 'paid', paidAtMs: paidAtMs, payingAtMs: null, paidVia: how,
                        preimageHash: preimage ? crypto.createHash('sha256').update(String(preimage)).digest('hex') : '' }, { merge: true });
                    if (!p.exists) {
                        t.create(payoutRef, {
                            epoch: ids.epoch, block: ids.block,
                            uidMasked: maskUid(uid), uidHash: uidHash(uid),
                            amount: amount, netSats: net, feeSats: cfg.feeSats,
                            frozenLn: row.frozenLn, paymentHash: inv.paymentHash,
                            routingFeeSats: routing, walletSpentSats: spent,
                            budget: catchUp ? CATCH_UP_COUNTER_ID : 'month',
                            paidAtMs: paidAtMs, paidVia: how,
                            ownNodeCheck: ownNodeCheck,
                        });
                    }
                });
                reserved = false;
                await audit(Object.assign({}, base, { type: 'paid', code: 'paid', amount: amount, netSats: net, routingFeeSats: routing, paymentHash: inv.paymentHash, ownNodeCheck: ownNodeCheck, ms: now() - t0 }));
                if (overspend) {
                    await audit(Object.assign({}, base, { type: 'fee_halt', code: 'fee_halt', routingFeeSats: routing,
                        walletSpentSats: spent, netSats: net, limitSats: Math.ceil(feeLimitMsat / 1000) }));
                    await alert('Favor claims HALTED: epoch ' + ids.epoch + ' block ' + ids.block + ' paid a ' + routing +
                        '-sat routing fee, over the ' + Math.ceil(feeLimitMsat / 1000) + '-sat limit. Clear sf_claim_counters/fee_halt only after a check.', { epoch: ids.epoch, block: ids.block });
                }
                return { success: true, epoch: ids.epoch, block: ids.block, amount: amount, sent: net, fee: cfg.feeSats };
            }

            if (payResult && payResult.preimage) {
                const feesMsat = Number(payResult.fees_paid != null ? payResult.fees_paid : payResult.feesPaid) || 0;
                return await markPaid(payResult.preimage, 'pay', feesMsat / 1000);
            }
            if (!deps.shouldLookupPay({ phase: 'pay', error: payError, payResult: payResult })) {
                await release('pay_failed');
            }
            const settlement = await deps.lookupSettlement({
                lookup: function () { return withTimeout(wallet.lookupInvoice({ payment_hash: inv.paymentHash }), 10000, 'lookupInvoice'); },
                sleep: function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); },
                intervalMs: deps.lookupIntervalMs,
            });
            if (settlement.action === 'paid') return await markPaid(settlement.preimage || '', 'lookup', 0);
            if (settlement.action === 'release') await release('pay_failed');
            await claimRef.set({ status: 'unknown', needsReview: true, payingAtMs: null }, { merge: true });
            reserved = false; // counters stay reserved: the sats may have left
            await alert('Favor claim payment unknown for epoch ' + ids.epoch + ' block ' + ids.block + '. Held for manual review; never retried automatically.', { epoch: ids.epoch, block: ids.block });
            refuse('held_unknown');
        } catch (e) {
            const code = e instanceof ClaimRefusal ? e.code : 'pay_failed';
            if (!(e instanceof ClaimRefusal)) console.error('[sfclaim] unexpected', e && e.message);
            if (['uid_daily_cap', 'site_daily_cap', 'monthly_cap', 'catch_up_ceiling'].indexOf(code) !== -1) {
                await alertOnce('cap_' + code, 'Favor payout cap hit: ' + code.replace(/_/g, ' ') +
                    ' on epoch ' + (ids && ids.epoch) + ' block ' + (ids && ids.block) + '.', { epoch: ids && ids.epoch, block: ids && ids.block, cap: code });
            }
            if (reserved) {
                // Unexpected throw after reserving and before the wallet: leave it
                // 'paying' for a person rather than guessing. Never auto-retry.
                await alert('Favor claim stuck in paying for epoch ' + (ids && ids.epoch) + ' block ' + (ids && ids.block) + '.', {});
            }
            const quiet = NO_AUDIT_CODES.indexOf(code) !== -1 || (code === 'rate_limited' && e && e.extra && e.extra.quiet);
            if (!quiet) await audit(Object.assign({}, base, { type: 'refused', code: code, detail: (e && e.extra) || {}, ms: now() - t0 }));
            const out = { success: false, code: code, error: MESSAGES[code] || MESSAGES.pay_failed };
            if (code === 'age_18_required') {
                out.reason = (e && e.extra && e.extra.reason) || 'unconfirmed';
                if (e && e.extra && e.extra.userMessage) out.error = e.extra.userMessage;
            }
            return out;
        }
    }

    // The caller's own blocks for the asked epochs. Never anyone else's rows.
    async function listMine(context, data) {
        const uid = context && context.auth && context.auth.uid;
        const provider = context && context.auth && context.auth.token && context.auth.token.firebase && context.auth.token.firebase.sign_in_provider;
        if (!uid || provider === 'anonymous') return { claims: [] };
        const asked = Array.isArray(data && data.epochNumbers) ? data.epochNumbers.slice(0, 20) : [];
        const epochs = Array.from(new Set(asked.map(function (e) { return intStrict(e, 1, MAX_EPOCH_NUMBER); }).filter(function (e) { return e != null; })));
        const cfg = await loadConfig();
        const offline = await deps.isOffline().catch(function () { return true; });
        const out = [];
        for (let i = 0; i < epochs.length; i++) {
            const e = epochs[i];
            const snap = await db.collection('sf_payout_results').doc(resultId(e)).get();
            const res = snap.exists ? (snap.data() || {}) : null;
            if (!res || res.version !== RESULT_VERSION) continue;
            for (let j = 0; j < res.blocks.length; j++) {
                const row = res.blocks[j];
                if (!row || row.uid !== uid) continue;
                const c = await db.collection('sf_block_claims').doc(claimId(e, row.block)).get();
                const cd = c.exists ? (c.data() || {}) : null;
                let status = cd ? cd.status : 'claimable';
                if (status === 'claimable') {
                    // An admin release leaves the frozen manualReview flag in
                    // place (that record is permanent). Honor the release so
                    // the winner sees a Claim button.
                    const released = !!cd && cd.reviewReleased === true;
                    if (row.manualReview && !released) status = 'manual_review';
                    else if (offline || !cfg.claimsEnabled || cfg.enabledEpochs.indexOf(e) === -1) status = 'not_open';
                }
                out.push({ epochNumber: e, block: row.block, winId: claimId(e, row.block), amount: row.amount,
                    status: status, payTo: maskLn(row.frozenLn) });
            }
        }
        return { claims: out };
    }

    // Admin: release a manual-review block back to its FROZEN winner, or reject
    // it for good. Inputs are only { epoch, block, action, note }; no uid,
    // address or amount is ever taken from the caller. Never pays. The next
    // claim after a release runs every normal check (winner, caps, ceiling,
    // fee_halt, route-hint fee, attempts). Every call writes an audit row.
    // The caller (Fns) has already checked the admin claim and fresh step-up.
    async function resolveReview(adminUid, data) {
        const d = data && typeof data === 'object' ? data : {};
        const ids = parseClaimIds({ epoch: d.epoch, block: d.block });
        const action = d.action === 'release' || d.action === 'reject' ? d.action : '';
        const note = typeof d.note === 'string' ? d.note.trim().slice(0, 300) : '';
        const by = maskUid(adminUid);
        const row0 = { type: 'admin_review', action: action || String(d.action || '').slice(0, 20), by: by, note: note };
        async function done(code, before, after, extra) {
            await audit(Object.assign({}, row0, { epoch: ids ? ids.epoch : null, block: ids ? ids.block : null,
                code: code, before: before || null, after: after || null }, extra || {}));
            return Object.assign({ ok: code === 'released' || code === 'rejected' || code === 'noop', code: code, before: before || null, after: after || null }, extra || {});
        }
        if (!adminUid) return done('unauthenticated');
        if (!ids) return done('bad_id');
        if (!action) return done('bad_action');
        if (!note) return done('note_required');
        const resSnap = await db.collection('sf_payout_results').doc(resultId(ids.epoch)).get();
        const result = resSnap.exists ? (resSnap.data() || {}) : null;
        const row = result && result.version === RESULT_VERSION && Array.isArray(result.blocks) ? result.blocks[ids.block] : null;
        if (!row || row.block !== ids.block) return done('epoch_not_ready');
        const cid = claimId(ids.epoch, ids.block);
        const claimRef = db.collection('sf_block_claims').doc(cid);
        const rejectRef = db.collection('sf_claim_reviews').doc(cid + '_rejected');
        const snap0 = await claimRef.get();
        const cur0 = snap0.exists ? (snap0.data() || {}) : null;
        const before0 = cur0 ? cur0.status : (row.manualReview ? 'manual_review(frozen)' : 'claimable');

        if (action === 'reject') {
            let out = null;
            await db.runTransaction(async function (t) {
                const c = await t.get(claimRef);
                const rj = await t.get(rejectRef);
                const cur = c.exists ? (c.data() || {}) : null;
                const before = cur ? cur.status : before0;
                if (rj.exists || (cur && cur.status === 'rejected')) { out = ['noop', before, 'rejected']; return; }
                if (cur && (cur.status === 'paid' || cur.status === 'paying' || cur.status === 'unknown')) { out = ['refused_' + cur.status, before, before]; return; }
                // Final: create-only marker; nothing ever deletes or flips it back.
                t.create(rejectRef, { epoch: ids.epoch, block: ids.block, by: by, note: note, atMs: now(), before: before });
                t.set(claimRef, Object.assign(cur ? {} : { epoch: ids.epoch, block: ids.block, uid: row.uid, amount: row.amount, frozenLn: row.frozenLn || '', createdAtMs: now(), attempts: 0 },
                    { status: 'rejected', reviewRejectedAtMs: now(), reviewRejectedBy: by, payingAtMs: null }), { merge: true });
                out = ['rejected', before, 'rejected'];
            });
            return done(out[0], out[1], out[2]);
        }

        // release
        if (!validLn(row.frozenLn)) return done('no_frozen_address', before0, before0);
        if ((await rejectRef.get()).exists || (cur0 && cur0.status === 'rejected')) return done('refused_rejected', before0, before0);
        if (cur0 && cur0.status === 'paid') return done('refused_paid', before0, before0);
        if (cur0 && cur0.status === 'claimable' && cur0.reviewReleased === true) return done('noop', before0, before0);
        const inFlight = !!cur0 && (cur0.status === 'paying' || cur0.status === 'unknown');
        const hash = cur0 && cur0.paymentHash ? String(cur0.paymentHash) : '';
        if (!cur0 && !row.manualReview) return done('not_in_review', before0, before0);
        if (cur0 && !inFlight && cur0.status !== 'manual_review') return done('not_in_review', before0, before0);
        if (inFlight && !hash) return done('refused_unverifiable', before0, before0);
        // A block at max strikes (repeat_failures) stays refused by the claim
        // path, which never resets attempts. Releasing it would report success
        // while the next claim is still refused, so refuse here and write nothing.
        const relCfg = await loadConfig();
        if (cur0 && (Number(cur0.attempts) || 0) >= relCfg.maxAttempts) {
            return done('refused_repeat_failures', before0, before0, { attempts: Number(cur0.attempts) || 0, maxAttempts: relCfg.maxAttempts });
        }
        let lookupKind = '';
        if (hash) {
            // A payment may have left: only an explicit failed lookup proves it did not.
            try {
                const wallet = deps.wallet(relCfg);
                const raw = await withTimeout(wallet.lookupInvoice({ payment_hash: hash }), 15000, 'lookupInvoice');
                lookupKind = deps.classifyLookup ? deps.classifyLookup(raw).kind : 'unknown';
            } catch (e) { lookupKind = 'error'; }
            if (lookupKind !== 'failed') return done('refused_payment_not_failed', before0, before0, { lookup: lookupKind });
        }
        let out = null;
        await db.runTransaction(async function (t) {
            const c = await t.get(claimRef);
            const rj = await t.get(rejectRef);
            const cur = c.exists ? (c.data() || {}) : null;
            const before = cur ? cur.status : before0;
            if (rj.exists || (cur && cur.status === 'rejected')) { out = ['refused_rejected', before, before]; return; }
            if (cur && cur.status === 'paid') { out = ['refused_paid', before, before]; return; }
            // Re-check inside the transaction: nothing may have changed since the lookup.
            if (cur && (cur.status !== (cur0 ? cur0.status : '') || String(cur.paymentHash || '') !== hash)) { out = ['refused_changed', before, before]; return; }
            if (!cur && cur0) { out = ['refused_changed', before, before]; return; }
            if (cur && (Number(cur.attempts) || 0) >= relCfg.maxAttempts) { out = ['refused_repeat_failures', before, before]; return; }
            const wasReserved = !!cur && (cur.status === 'paying' || cur.status === 'unknown');
            if (wasReserved && cur.counterDay) {
                // The sats provably did not leave: give back what the attempt reserved.
                const amt = Number(cur.amount) || 0;
                const giveBack = payoutMsat.reservedMsatFromClaim(cur, amt, 0);
                const refs = [db.collection('sf_claim_counters').doc('uid_' + uidHash(cur.uid) + '_' + cur.counterDay),
                    db.collection('sf_claim_counters').doc('site_' + cur.counterDay),
                    db.collection('sf_claim_counters').doc(cur.budget === CATCH_UP_COUNTER_ID ? CATCH_UP_COUNTER_ID : 'month_' + cur.counterMonth)];
                const snaps = [];
                for (let i = 0; i < refs.length; i++) snaps.push(await t.get(refs[i]));
                refs.forEach(function (r, i) {
                    t.set(r, payoutMsat.releaseReserved(snaps[i].exists ? snaps[i].data() : null, amt, giveBack), { merge: true });
                });
            }
            const patch = { status: 'claimable', reviewReleased: true, reviewReleasedAtMs: now(), reviewReleasedBy: by,
                releasedFrom: before, payingAtMs: null, needsReview: false };
            if (hash) patch.lookupFailedHashes = (cur && Array.isArray(cur.lookupFailedHashes) ? cur.lookupFailedHashes : []).concat([hash]).slice(-10);
            if (!cur) Object.assign(patch, { epoch: ids.epoch, block: ids.block, uid: row.uid, amount: row.amount, frozenLn: row.frozenLn, createdAtMs: now(), attempts: 0 });
            // attempts, frozenLn, uid and amount are never changed here.
            t.set(claimRef, patch, { merge: true });
            out = ['released', before, 'claimable'];
        });
        return done(out[0], out[1], out[2], lookupKind ? { lookup: lookupKind } : null);
    }

    return { claim: claim, listMine: listMine, freezeEpoch: freezeEpoch, loadConfig: loadConfig, catchUpBlockTotal: catchUpBlockTotal, resolveReview: resolveReview };
}

module.exports = {
    BLOCKS_PER_EPOCH,
    EPOCH_POT_SATS,
    HARD_PER_CLAIM_CAP_SATS,
    PERMANENT_COLLECTIONS,
    CATCH_UP_FIRST_EPOCH,
    CATCH_UP_LAST_EPOCH,
    CATCH_UP_MAX_BLOCK_SATS,
    CATCH_UP_FEE_ALLOWANCE_SATS,
    CATCH_UP_COUNTER_ID,
    ROUTE_FEE_MIN_SATS,
    ROUTE_FEE_PPM,
    FEE_HALT_DOC_ID,
    routeFeeLimitMsat,
    routeHintFeeMsat,
    checkRouteFees,
    RATE_MAX,
    RATE_WINDOW_MS,
    NO_AUDIT_CODES,
    etDayKey,
    isCatchUpEpoch,
    catchUpCeiling,
    DEFAULTS,
    MESSAGES,
    parseClaimIds,
    claimId,
    resultId,
    readConfig,
    deriveEpochBlocks,
    buildEpochResult,
    resultMatchesHistory,
    validateInvoice,
    capCheck,
    maskUid,
    maskLn,
    uidHash,
    normalizeLn,
    validLn,
    createBlockClaimService,
    ClaimRefusal,
};
