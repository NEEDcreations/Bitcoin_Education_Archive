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
//      'paying' and reserve the sats BEFORE any wallet call;
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
        const shared = validLn(ln) && Object.keys(byLn[ln] || {}).length > 1;
        // Backfills happen after close. A one-time address reset after close
        // means the frozen address may not be the close-time one: hold it.
        const changedAfterClose = Number(p.lnResetMs) > derived.completedAtMs;
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

// Pure cap check on the current counters.
function capCheck(cfg, amount, counters, catchUp) {
    const c = counters || {};
    if (amount > cfg.perClaimCapSats) return 'amount_invalid';
    if ((Number(c.uidDay) || 0) + amount > cfg.perUidDailySats) return 'uid_daily_cap';
    if ((Number(c.siteDay) || 0) + amount > cfg.siteDailySats) return 'site_daily_cap';
    if (catchUp) {
        // Hard ceiling replaces the monthly limit for epochs 1-8 only.
        if (!(Number(catchUp.ceiling) > 0)) return 'catch_up_ceiling';
        if ((Number(c.catchUp) || 0) + amount > catchUp.ceiling) return 'catch_up_ceiling';
        return '';
    }
    if ((Number(c.month) || 0) + amount > cfg.monthlySats) return 'monthly_cap';
    return '';
}

function dayKey(ms) { return new Date(ms).toISOString().slice(0, 10); }
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

    async function audit(row) {
        try {
            await db.collection('sf_claim_audit').add(Object.assign({ atMs: now() }, row));
        } catch (e) { console.warn('[sfclaim] audit write failed'); }
    }
    async function alert(text, extra) {
        try { if (deps.notifyAdmin) await deps.notifyAdmin(text, extra || {}); }
        catch (e) { console.warn('[sfclaim] admin alert failed'); }
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
            players[uids[i]] = { ln: savedLn(u.exists ? u.data() : {}), lnResetMs: toMs(rr.ln_reset_used) };
        }
        const result = buildEpochResult(derived, players, { epoch: e, nowMs: now(), source: o.source });
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
                await alert('Favor claim: epoch ' + ids.epoch + ' result does not match sfPoolHistory (' + (derived.reason || 'mismatch') + ').', { epoch: ids.epoch });
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
            if (!gate || !gate.ok) refuse('account_blocked', { gate: gate && gate.code });

            // Fresh 2FA when the account has 2FA on (no-op otherwise).
            try { await deps.stepUp(context, data); }
            catch (e) { refuse('step_up_required', { why: 'second_factor' }); }

            const userSnap = await db.collection('users').doc(uid).get();
            const currentLn = savedLn(userSnap.exists ? userSnap.data() : {});
            const addressChanged = row.lnChangedAfterClose === true || (currentLn && currentLn !== row.frozenLn);
            if (addressChanged) {
                await alert('Favor claim: winner ' + maskUid(uid) + ' changed their Lightning address after epoch ' + ids.epoch +
                    ' closed. The payout still goes only to the frozen address.', { epoch: ids.epoch, block: ids.block });
                if (!deps.recentSignIn(context, now())) refuse('step_up_required', { why: 'address_changed' });
            }

            const cid = claimId(ids.epoch, ids.block);
            const claimRef = db.collection('sf_block_claims').doc(cid);
            if (row.manualReview || !validLn(row.frozenLn)) {
                await db.runTransaction(async function (t) {
                    const c = await t.get(claimRef);
                    if (c.exists) return;
                    t.set(claimRef, {
                        epoch: ids.epoch, block: ids.block, uid: uid, amount: amount,
                        frozenLn: row.frozenLn || '', status: 'manual_review',
                        reviewReason: row.manualReview || 'no_address', createdAtMs: now(), attempts: 0,
                    });
                });
                await alert('Favor claim set aside for manual review: epoch ' + ids.epoch + ' block ' + ids.block + ' (' + (row.manualReview || 'no_address') + ').', { epoch: ids.epoch, block: ids.block });
                refuse('manual_review', { reason: row.manualReview || 'no_address' });
            }

            const catchUp = isCatchUpEpoch(ids.epoch) ? { ceiling: catchUpCeiling(await catchUpBlockTotal()) } : null;

            // 1. Reserve in a transaction and mark 'paying' before the wallet call.
            const nowMs = now();
            counterKeys = { day: dayKey(nowMs), month: monthKey(nowMs) };
            const uidDayRef = db.collection('sf_claim_counters').doc('uid_' + uidHash(uid) + '_' + counterKeys.day);
            const siteDayRef = db.collection('sf_claim_counters').doc('site_' + counterKeys.day);
            const monthRef = db.collection('sf_claim_counters').doc('month_' + counterKeys.month);
            const catchUpRef = db.collection('sf_claim_counters').doc(CATCH_UP_COUNTER_ID);
            // Catch-up claims count against the hard ceiling, not the month.
            const budgetRef = catchUp ? catchUpRef : monthRef;
            await db.runTransaction(async function (t) {
                const c = await t.get(claimRef);
                const ud = await t.get(uidDayRef);
                const sd = await t.get(siteDayRef);
                const md = await t.get(budgetRef);
                const cur = c.exists ? (c.data() || {}) : null;
                if (cur) {
                    if (cur.uid !== uid) refuse('not_winner');
                    if (cur.status === 'paid') refuse('already_paid');
                    if (cur.status === 'paying') refuse('in_progress');
                    if (cur.status === 'unknown') refuse('held_unknown');
                    if (cur.status === 'manual_review') refuse('manual_review');
                    if ((Number(cur.attempts) || 0) >= cfg.maxAttempts) refuse('manual_review');
                    if (cur.lastAttemptMs && nowMs - cur.lastAttemptMs < cfg.cooldownMs) refuse('cooldown');
                }
                const capCode = capCheck(cfg, amount, {
                    uidDay: ud.exists ? ud.data().sats : 0,
                    siteDay: sd.exists ? sd.data().sats : 0,
                    month: md.exists ? md.data().sats : 0,
                    catchUp: md.exists ? md.data().sats : 0,
                }, catchUp);
                if (capCode) refuse(capCode);
                const rec = {
                    epoch: ids.epoch, block: ids.block, uid: uid, amount: amount,
                    frozenLn: row.frozenLn, status: 'paying', payingAtMs: nowMs,
                    lastAttemptMs: nowMs, attempts: (cur ? (Number(cur.attempts) || 0) : 0) + 1,
                    counterDay: counterKeys.day, counterMonth: counterKeys.month,
                };
                if (!cur) rec.createdAtMs = nowMs;
                t.set(claimRef, rec, { merge: true });
                t.set(uidDayRef, { sats: (ud.exists ? Number(ud.data().sats) || 0 : 0) + amount, updatedAtMs: nowMs }, { merge: true });
                t.set(siteDayRef, { sats: (sd.exists ? Number(sd.data().sats) || 0 : 0) + amount, updatedAtMs: nowMs }, { merge: true });
                const budgetRow = { sats: (md.exists ? Number(md.data().sats) || 0 : 0) + amount, updatedAtMs: nowMs };
                if (catchUp) budgetRow.ceilingSats = catchUp.ceiling;
                t.set(budgetRef, budgetRow, { merge: true });
                rec.budget = catchUp ? CATCH_UP_COUNTER_ID : 'month';
                t.set(claimRef, { budget: rec.budget }, { merge: true });
            });
            reserved = true;

            async function release(code, extra) {
                await db.runTransaction(async function (t) {
                    const c = await t.get(claimRef);
                    const ud = await t.get(uidDayRef);
                    const sd = await t.get(siteDayRef);
                    const md = await t.get(budgetRef);
                    const cur = c.exists ? (c.data() || {}) : {};
                    if (cur.status !== 'paying') return;
                    const strikes = Number(cur.attempts) || 0;
                    t.set(claimRef, {
                        status: strikes >= cfg.maxAttempts ? 'manual_review' : 'claimable',
                        reviewReason: strikes >= cfg.maxAttempts ? 'repeat_failures' : null,
                        lastError: code, payingAtMs: null,
                    }, { merge: true });
                    t.set(uidDayRef, { sats: Math.max(0, (ud.exists ? Number(ud.data().sats) || 0 : 0) - amount) }, { merge: true });
                    t.set(siteDayRef, { sats: Math.max(0, (sd.exists ? Number(sd.data().sats) || 0 : 0) - amount) }, { merge: true });
                    t.set(budgetRef, { sats: Math.max(0, (md.exists ? Number(md.data().sats) || 0 : 0) - amount) }, { merge: true });
                });
                reserved = false;
                refuse(code, extra);
            }

            // 2. Wallet floor + own node.
            const wallet = deps.wallet(cfg);
            let walletSats = null;
            let ownPubkey = '';
            try {
                const bal = await withTimeout(wallet.getBalance(), 20000, 'getBalance');
                const raw = bal && Number(bal.balance);
                if (!Number.isFinite(raw)) throw new Error('no balance');
                walletSats = Math.floor(raw / 1000);
                const info = await withTimeout(wallet.getInfo(), 20000, 'getInfo');
                ownPubkey = String((info && info.pubkey) || '').toLowerCase();
                if (!ownPubkey) throw new Error('no pubkey');
            } catch (e) {
                await release('wallet_unavailable');
            }
            if (walletSats - amount < cfg.walletFloorSats) {
                await alert('Favor claims halted: prize wallet is below the ' + cfg.walletFloorSats + '-sat floor.', { floor: cfg.walletFloorSats });
                await release('wallet_low');
            }

            // 3. Invoice for the frozen address only; decoded and checked here.
            const net = amount - cfg.feeSats;
            let bolt = '';
            let inv = null;
            try {
                bolt = await deps.resolveInvoice(row.frozenLn, net);
                inv = validateInvoice(bolt, deps.decodeInvoice(bolt), net, Math.floor(now() / 1000), ownPubkey);
            } catch (e) {
                inv = { ok: false, reason: 'resolve_failed' };
            }
            if (!inv.ok) await release('bad_invoice', { reason: inv.reason });
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
                // Wallet spend is net + routing fee. The reservation was the gross
                // block amount; true it up so the ceiling counts real spend.
                const spent = net + routing;
                await db.runTransaction(async function (t) {
                    const p = await t.get(payoutRef);
                    const bd = await t.get(budgetRef);
                    if (spent !== amount) {
                        t.set(budgetRef, { sats: Math.max(0, (bd.exists ? Number(bd.data().sats) || 0 : 0) - amount + spent) }, { merge: true });
                    }
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
                        });
                    }
                });
                reserved = false;
                await audit(Object.assign({}, base, { type: 'paid', code: 'paid', amount: amount, netSats: net, paymentHash: inv.paymentHash, ms: now() - t0 }));
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
            if (reserved) {
                // Unexpected throw after reserving and before the wallet: leave it
                // 'paying' for a person rather than guessing. Never auto-retry.
                await alert('Favor claim stuck in paying for epoch ' + (ids && ids.epoch) + ' block ' + (ids && ids.block) + '.', {});
            }
            await audit(Object.assign({}, base, { type: 'refused', code: code, detail: (e && e.extra) || {}, ms: now() - t0 }));
            return { success: false, code: code, error: MESSAGES[code] || MESSAGES.pay_failed };
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
                    if (row.manualReview) status = 'manual_review';
                    else if (offline || !cfg.claimsEnabled || cfg.enabledEpochs.indexOf(e) === -1) status = 'not_open';
                }
                out.push({ epochNumber: e, block: row.block, winId: claimId(e, row.block), amount: row.amount,
                    status: status, payTo: maskLn(row.frozenLn) });
            }
        }
        return { claims: out };
    }

    return { claim: claim, listMine: listMine, freezeEpoch: freezeEpoch, loadConfig: loadConfig, catchUpBlockTotal: catchUpBlockTotal };
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
