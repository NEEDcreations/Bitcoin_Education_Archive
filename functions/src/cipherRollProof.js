'use strict';

// Commit-reveal rolls and tamper-evident receipts for locked cipher opens.
// The master secret never leaves the caller. This module never logs it.
//
// Period seed = HMAC-SHA256(secret, "bq-cipher-period-v1:" + utcDate).
// Commitment  = SHA256("bq-cipher-commit-v1:" + periodSeed), published
// ahead of time. After the UTC day ends, the period seed can be shown so
// anyone can recompute the roll. The roll is HMAC-PRF + rejection sampling
// over ROLL_SPACE, so it is uniform (equivalent to crypto.randomInt).

const crypto = require('crypto');
const {
    ROLL_SPACE,
    ROLL_SCHEMA,
    prizeFromRoll,
    verifyCipherPrize,
} = require('./cipherReward');

const PERIOD_PREFIX = 'bq-cipher-period-v1:';
const COMMIT_PREFIX = 'bq-cipher-commit-v1:';
const ROLL_PREFIX = 'bq-cipher-roll-v1:';
const XP_PREFIX = 'bq-cipher-xp-v1:';
const TIX_PREFIX = 'bq-cipher-tix-v1:';
const DAY_MS = 86400000;
const UINT64 = 1n << 64n;

function periodIdFromMs(ms) {
    const n = Number(ms);
    if (!Number.isFinite(n)) return '';
    const d = new Date(n);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
}

function periodBounds(periodId) {
    const id = String(periodId || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) return null;
    const startMs = Date.parse(id + 'T00:00:00.000Z');
    if (!Number.isFinite(startMs)) return null;
    return { startMs: startMs, endMs: startMs + DAY_MS };
}

function periodIsRevealed(periodId, nowMs) {
    const bounds = periodBounds(periodId);
    if (!bounds) return false;
    return Number(nowMs) >= bounds.endMs;
}

function periodSeed(secret, periodId) {
    const key = String(secret || '');
    const id = String(periodId || '');
    if (!key || !id) return '';
    return crypto.createHmac('sha256', key).update(PERIOD_PREFIX + id, 'utf8').digest('hex');
}

function periodCommitment(seed) {
    const value = String(seed || '');
    if (!value) return '';
    return crypto.createHash('sha256').update(COMMIT_PREFIX + value, 'utf8').digest('hex');
}

// Uniform integer in [0, space) from a PRF that returns a Buffer for each
// counter, using rejection sampling so the result is unbiased. space must
// be a safe positive integer. Same idea as Node's crypto.randomInt.
function rejectionThreshold(space) {
    const s = BigInt(space);
    if (s <= 0n) return 0n;
    return (UINT64 / s) * s;
}

function uniformInt(prf, space, maxTries) {
    if (!Number.isSafeInteger(space) || space <= 0) return null;
    const threshold = rejectionThreshold(space);
    const tries = maxTries || 64;
    for (let i = 0; i < tries; i++) {
        const buf = prf(i);
        if (!Buffer.isBuffer(buf) || buf.length < 8) return null;
        const n = buf.readBigUInt64BE(0);
        if (n >= threshold) continue;
        return Number(n % BigInt(space));
    }
    return null;
}

function hmacPrf(seed, label, parts) {
    const base = [label].concat(parts || []).join(':');
    return function (counter) {
        return crypto.createHmac('sha256', seed).update(base + ':' + counter, 'utf8').digest();
    };
}

function deriveRoll(seed, cipherId, openerUid, keyId) {
    return uniformInt(hmacPrf(seed, ROLL_PREFIX, [cipherId, openerUid, keyId]), ROLL_SPACE);
}

function deriveXp(seed, cipherId, openerUid, keyId) {
    const n = uniformInt(hmacPrf(seed, XP_PREFIX, [cipherId, openerUid, keyId]), 201);
    if (n == null) return null;
    return 50 + n;
}

function deriveTickets(seed, cipherId, openerUid, keyId) {
    return uniformInt(hmacPrf(seed, TIX_PREFIX, [cipherId, openerUid, keyId]), 11);
}

function receiptBody(fields) {
    const src = fields || {};
    return {
        cipherId: String(src.cipherId || ''),
        openerUid: String(src.openerUid || ''),
        keyId: String(src.keyId || ''),
        roll: src.roll,
        rollSpace: src.rollSpace == null ? ROLL_SPACE : src.rollSpace,
        rollSchema: src.rollSchema == null ? ROLL_SCHEMA : src.rollSchema,
        rewardType: String(src.rewardType || ''),
        satsAmount: Math.floor(Number(src.satsAmount) || 0),
        rolledXp: Math.floor(Number(src.rolledXp) || 0),
        rolledTickets: Math.floor(Number(src.rolledTickets) || 0),
        periodId: String(src.periodId || ''),
        commitment: String(src.commitment || ''),
    };
}

function canonicalReceipt(fields) {
    const body = receiptBody(fields);
    return [
        'v3',
        body.cipherId,
        body.openerUid,
        body.keyId,
        String(body.roll),
        String(body.rollSpace),
        String(body.rollSchema),
        body.rewardType,
        String(body.satsAmount),
        String(body.rolledXp),
        String(body.rolledTickets),
        body.periodId,
        body.commitment,
    ].join('|');
}

function signReceipt(secret, fields) {
    const key = String(secret || '');
    if (!key) return '';
    return crypto.createHmac('sha256', key).update(canonicalReceipt(fields), 'utf8').digest('hex');
}

function macsEqual(a, b) {
    const left = String(a || '');
    const right = String(b || '');
    if (!left || !right || left.length !== right.length) return false;
    try {
        return crypto.timingSafeEqual(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
    } catch (e) {
        return false;
    }
}

function verifyReceiptMac(secret, fields, mac) {
    if (!secret) return { ok: false, reason: 'no-secret' };
    const expected = signReceipt(secret, fields);
    if (!expected || !macsEqual(expected, mac)) return { ok: false, reason: 'mac-mismatch' };
    return { ok: true };
}

function openCipherReward(secret, input) {
    const src = input || {};
    const key = String(secret || '');
    const cipherId = String(src.cipherId || '');
    const openerUid = String(src.openerUid || '');
    const keyId = String(src.keyId || '');
    const nowMs = src.nowMs == null ? Date.now() : Number(src.nowMs);
    if (!key || !cipherId || !openerUid || !keyId || !Number.isFinite(nowMs)) return null;
    const periodId = periodIdFromMs(nowMs);
    const seed = periodSeed(key, periodId);
    const commitment = periodCommitment(seed);
    const roll = deriveRoll(seed, cipherId, openerUid, keyId);
    if (roll == null) return null;
    const prize = prizeFromRoll(roll);
    if (!prize) return null;
    let rolledXp = 0;
    let rolledTickets = 0;
    let reward;
    if (prize.rewardType === 'sats') {
        reward = { rewardType: 'sats', satsAmount: prize.satsAmount, roll: roll };
    } else {
        rolledXp = deriveXp(seed, cipherId, openerUid, keyId);
        rolledTickets = deriveTickets(seed, cipherId, openerUid, keyId);
        if (rolledXp == null || rolledTickets == null) return null;
        reward = {
            rewardType: 'xp_tickets',
            xpAmount: rolledXp,
            ticketCount: rolledTickets,
            roll: roll,
        };
    }
    const body = receiptBody({
        cipherId: cipherId,
        openerUid: openerUid,
        keyId: keyId,
        roll: roll,
        rollSpace: ROLL_SPACE,
        rollSchema: ROLL_SCHEMA,
        rewardType: reward.rewardType,
        satsAmount: reward.satsAmount || 0,
        rolledXp: rolledXp,
        rolledTickets: rolledTickets,
        periodId: periodId,
        commitment: commitment,
    });
    const receiptMac = signReceipt(key, body);
    reward.periodId = periodId;
    reward.commitment = commitment;
    reward.rollSpace = ROLL_SPACE;
    reward.rollSchema = ROLL_SCHEMA;
    reward.rolledXp = rolledXp;
    reward.rolledTickets = rolledTickets;
    reward.receiptMac = receiptMac;
    return {
        reward: reward,
        body: body,
        receiptMac: receiptMac,
        periodId: periodId,
        commitment: commitment,
        roll: roll,
    };
}

function recomputeRoll(secret, fields) {
    const body = receiptBody(fields);
    const seed = periodSeed(secret, body.periodId);
    if (!seed) return null;
    return deriveRoll(seed, body.cipherId, body.openerUid, body.keyId);
}

function listPeriodPublic(secret, nowMs, opts) {
    const now = Number(nowMs);
    const back = (opts && opts.back) || 30;
    const forward = (opts && opts.forward) || 14;
    const rows = [];
    for (let i = -back; i <= forward; i++) {
        const ms = now + i * DAY_MS;
        const periodId = periodIdFromMs(ms);
        const bounds = periodBounds(periodId);
        if (!bounds) continue;
        const revealed = periodIsRevealed(periodId, now);
        const seed = periodSeed(secret, periodId);
        rows.push({
            periodId: periodId,
            commitment: periodCommitment(seed),
            startMs: bounds.startMs,
            endMs: bounds.endMs,
            revealed: revealed,
            seed: revealed ? seed : null,
        });
    }
    // De-dupe by periodId (stepping by DAY_MS can hit DST-less UTC repeats? shouldn't, but be safe)
    const seen = {};
    return rows.filter(function (row) {
        if (seen[row.periodId]) return false;
        seen[row.periodId] = true;
        return true;
    });
}

function recordFromOpen(open) {
    const c = open || {};
    return {
        cipherId: c.cipherId || '',
        openerUid: c.openerUid || c.openedBy || c.ownerId || c.uid || '',
        keyId: c.keyId || c.openedWithKeyId || '',
        roll: c.roll,
        rollSpace: c.rollSpace,
        rollSchema: c.rollSchema,
        rewardType: c.rewardType || (c.satsAmount || c.amount ? 'sats' : ''),
        satsAmount: c.satsAmount != null ? c.satsAmount : c.amount,
        rolledXp: c.rolledXp,
        rolledTickets: c.rolledTickets,
        periodId: c.periodId || '',
        commitment: c.commitment || '',
        receiptMac: c.receiptMac || '',
    };
}

function auditOpen(secret, record, nowMs) {
    const rec = recordFromOpen(record);
    const checks = [];
    function add(name, ok, detail) {
        checks.push({ name: name, ok: !!ok, detail: detail || '' });
    }

    const prize = verifyCipherPrize({
        roll: rec.roll,
        rollSpace: rec.rollSpace,
        rewardType: rec.rewardType,
        satsAmount: rec.satsAmount,
    });
    add('prize-matches-roll', prize.ok, prize.ok ? 'ok' : (prize.reason || 'mismatch'));

    const schema = Number(rec.rollSchema || 0);
    const hasReceipt = !!(rec.periodId && rec.commitment && rec.receiptMac);
    if (schema >= 3 || hasReceipt) {
        if (!secret) {
            add('receipt-mac', false, 'no-secret');
            add('roll-recompute', false, 'no-secret');
        } else {
            const mac = verifyReceiptMac(secret, rec, rec.receiptMac);
            add('receipt-mac', mac.ok, mac.ok ? 'ok' : (mac.reason || 'mismatch'));
            const expectedCommit = periodCommitment(periodSeed(secret, rec.periodId));
            add('commitment-matches-period', expectedCommit === rec.commitment, expectedCommit === rec.commitment ? 'ok' : 'mismatch');
            const recomputed = recomputeRoll(secret, rec);
            const rollOk = recomputed === rec.roll;
            add('roll-recompute', rollOk, rollOk ? 'ok' : 'mismatch');
        }
        const bounds = periodBounds(rec.periodId);
        const revealed = periodIsRevealed(rec.periodId, nowMs);
        add('period-id', !!bounds, bounds ? rec.periodId : 'invalid');
        if (revealed) add('period-revealed', true, rec.periodId);
        else add('period-unrevealed', true, 'seed withheld until period ends');
    } else {
        add('legacy-record', true, 'no receipt (pre-commit-reveal); prize check only');
    }

    const failed = checks.filter(function (c) { return c.name !== 'period-unrevealed' && !c.ok; });
    return {
        ok: failed.length === 0,
        checks: checks,
        record: {
            cipherId: rec.cipherId,
            openerUid: rec.openerUid,
            keyId: rec.keyId,
            roll: rec.roll,
            rollSpace: rec.rollSpace,
            rollSchema: rec.rollSchema,
            rewardType: rec.rewardType,
            satsAmount: rec.satsAmount,
            periodId: rec.periodId,
            commitment: rec.commitment,
        },
        expected: prize.expected || null,
        seed: (secret && periodIsRevealed(rec.periodId, nowMs)) ? periodSeed(secret, rec.periodId) : null,
    };
}

function publicProof(secret, record, nowMs) {
    const audit = auditOpen(secret, record, nowMs);
    const revealed = periodIsRevealed(record && record.periodId, nowMs);
    return {
        ok: audit.ok,
        checks: audit.checks,
        record: audit.record,
        expected: audit.expected,
        seed: revealed ? audit.seed : null,
        revealed: revealed,
    };
}

module.exports = {
    DAY_MS: DAY_MS,
    UINT64: UINT64,
    periodIdFromMs: periodIdFromMs,
    periodBounds: periodBounds,
    periodIsRevealed: periodIsRevealed,
    periodSeed: periodSeed,
    periodCommitment: periodCommitment,
    rejectionThreshold: rejectionThreshold,
    uniformInt: uniformInt,
    deriveRoll: deriveRoll,
    deriveXp: deriveXp,
    deriveTickets: deriveTickets,
    receiptBody: receiptBody,
    canonicalReceipt: canonicalReceipt,
    signReceipt: signReceipt,
    verifyReceiptMac: verifyReceiptMac,
    openCipherReward: openCipherReward,
    recomputeRoll: recomputeRoll,
    listPeriodPublic: listPeriodPublic,
    recordFromOpen: recordFromOpen,
    auditOpen: auditOpen,
    publicProof: publicProof,
};
