'use strict';

// Cipher-open rewards. One crypto-secure roll per open (0 .. ROLL_SPACE-1).
// Sats tiers are disjoint so the stated odds are exact and a single open
// can pay at most one sats amount. Anything else is XP plus tickets.
//
// Schema 3 (current, ROLL_SPACE = 1,000,000,000,000). The slot map is the same
// as the unshipped schema 2 table; only how the roll is produced changed:
//   roll 0                                      1/1,000,000,000,000 → 10,000,000 sats
//   roll 1–1,000                                1/1,000,000,000     → 1,000,000
//   roll 1,001–101,000                          1/10,000,000        → 100,000
//   roll 101,001–1,101,000                      1/1,000,000         → 50,000
//   roll 1,101,001–3,101,000                    1/500,000           → 10,000
//   roll 3,101,001–13,101,000                   1/100,000           → 5,000
//   roll 13,101,001–33,101,000                  1/50,000            → 1,000
//   roll 33,101,001–133,101,000                 1/10,000            → 500
//   roll 133,101,001–333,101,000                1/5,000             → 250
//   roll 333,101,001–1,333,101,000              1/1,000             → 100
//   roll 1,333,101,001–11,333,101,000           1/100               → 50
//   roll 11,333,101,001–31,333,101,000          1/50                → 25
//   roll 31,333,101,001–131,333,101,000         1/10                → 10
//   roll 131,333,101,001–331,333,101,000        1/5                 → 5
//   roll 331,333,101,001–999,999,999,999        otherwise           → XP 50–250 and tickets 0–10
//
// Schema 1 (legacy, ROLL_SPACE = 10,000,000) had the same 100,000-and-under
// odds and no jackpot tiers. verifyCipherPrize uses that table when a
// record has no rollSpace, or rollSpace 10,000,000, so older pending wins
// still check out after this change.

const crypto = require('crypto');

// Schema 3 is commit-reveal (see cipherRollProof.js). Schema 2 (1e12 space
// with crypto.randomInt) was never shipped. Schema 1 is live until this ships:
// 10,000,000 space and no jackpot tiers.
const ROLL_SCHEMA = 3;
const ROLL_SPACE = 1000000000000;
const LEGACY_ROLL_SCHEMA = 1;
const LEGACY_ROLL_SPACE = 10000000;
// Under 1,000 sats credit cipherSatsBalance. 1,000 and above stay manual.
const BALANCE_UNDER = 1000;

const LEGACY_SATS_TIERS = [
    { amount: 100000, odds: 10000000 },
    { amount: 50000,  odds: 1000000 },
    { amount: 10000,  odds: 500000 },
    { amount: 5000,   odds: 100000 },
    { amount: 1000,   odds: 50000 },
    { amount: 500,    odds: 10000 },
    { amount: 250,    odds: 5000 },
    { amount: 100,    odds: 1000 },
    { amount: 50,     odds: 100 },
    { amount: 25,     odds: 50 },
    { amount: 10,     odds: 10 },
    { amount: 5,      odds: 5 },
];

const SATS_TIERS = [
    { amount: 10000000, odds: 1000000000000 },
    { amount: 1000000,  odds: 1000000000 },
].concat(LEGACY_SATS_TIERS);

const ALLOWED_SATS_AMOUNTS = SATS_TIERS.map(function(tier) { return tier.amount; });

function slotsFor(odds, space) {
    const denom = space == null ? ROLL_SPACE : space;
    return denom / odds;
}

function satsDisposition(amount) {
    const n = Math.floor(Number(amount));
    if (ALLOWED_SATS_AMOUNTS.indexOf(n) === -1) return 'invalid';
    return n >= BALANCE_UNDER ? 'manual' : 'balance';
}

function tiersForSpace(space) {
    if (space === ROLL_SPACE) return SATS_TIERS;
    if (space === LEGACY_ROLL_SPACE) return LEGACY_SATS_TIERS;
    return null;
}

function prizeFromRoll(roll, opts) {
    const space = opts && opts.rollSpace != null ? opts.rollSpace : ROLL_SPACE;
    const tiers = (opts && opts.tiers) || tiersForSpace(space) || SATS_TIERS;
    if (!Number.isSafeInteger(roll) || roll < 0 || !Number.isSafeInteger(space) || space <= 0 || roll >= space) {
        return null;
    }
    let cursor = 0;
    for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        const slots = slotsFor(tier.odds, space);
        if (slots !== Math.floor(slots)) return null;
        if (roll < cursor + slots) {
            return { rewardType: 'sats', satsAmount: tier.amount, roll: roll };
        }
        cursor += slots;
    }
    return { rewardType: 'xp_tickets', roll: roll };
}

function otherwiseShare(space, tiers) {
    const used = (tiers || SATS_TIERS).reduce(function(sum, tier) {
        return sum + slotsFor(tier.odds, space);
    }, 0);
    return (space - used) / space;
}

function verifyCipherPrize(record) {
    const rec = record || {};
    const space = rec.rollSpace != null ? rec.rollSpace : LEGACY_ROLL_SPACE;
    const tiers = tiersForSpace(space);
    if (!tiers) return { ok: false, reason: 'unknown-space' };
    const expected = prizeFromRoll(rec.roll, { rollSpace: space, tiers: tiers });
    if (!expected) return { ok: false, reason: 'bad-roll' };
    const type = rec.rewardType || '';
    const amount = rec.satsAmount != null ? rec.satsAmount : rec.amount;
    const amountN = Math.floor(Number(amount) || 0);
    if (expected.rewardType === 'sats') {
        if (type && type !== 'sats') {
            return { ok: false, reason: 'type-mismatch', expected: expected };
        }
        if (amountN !== expected.satsAmount) {
            return { ok: false, reason: 'amount-mismatch', expected: expected };
        }
        return { ok: true, expected: expected };
    }
    if (type === 'sats' || amountN > 0) {
        return { ok: false, reason: 'amount-mismatch', expected: expected };
    }
    return { ok: true, expected: expected };
}

function rollCipherReward(forcedRoll) {
    const roll = (typeof forcedRoll === 'number')
        ? forcedRoll
        : crypto.randomInt(0, ROLL_SPACE);

    const prize = prizeFromRoll(roll);
    if (!prize) {
        return { rewardType: 'xp_tickets', xpAmount: 50, ticketCount: 0, roll: roll };
    }
    if (prize.rewardType === 'sats') {
        return { rewardType: 'sats', satsAmount: prize.satsAmount, roll: roll };
    }
    return {
        rewardType: 'xp_tickets',
        xpAmount: 50 + crypto.randomInt(0, 201), // 50..250
        ticketCount: crypto.randomInt(0, 11),    // 0..10
        roll: roll,
    };
}

module.exports = {
    ROLL_SCHEMA: ROLL_SCHEMA,
    ROLL_SPACE: ROLL_SPACE,
    LEGACY_ROLL_SCHEMA: LEGACY_ROLL_SCHEMA,
    LEGACY_ROLL_SPACE: LEGACY_ROLL_SPACE,
    BALANCE_UNDER: BALANCE_UNDER,
    LEGACY_SATS_TIERS: LEGACY_SATS_TIERS,
    SATS_TIERS: SATS_TIERS,
    ALLOWED_SATS_AMOUNTS: ALLOWED_SATS_AMOUNTS,
    AUTO_PAY_MAX: BALANCE_UNDER - 1,
    slotsFor: slotsFor,
    satsDisposition: satsDisposition,
    prizeFromRoll: prizeFromRoll,
    otherwiseShare: otherwiseShare,
    verifyCipherPrize: verifyCipherPrize,
    rollCipherReward: rollCipherReward,
};
