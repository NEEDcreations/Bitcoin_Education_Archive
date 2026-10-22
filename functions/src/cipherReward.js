'use strict';

// Cipher-open rewards. One crypto-secure roll per open (0..999,999).
// Sats tiers are disjoint so the stated odds are exact and a single open
// can pay at most one sats amount. Anything else is XP plus tickets.
//
//   roll 0                 1/1,000,000 → 100,000 sats
//   roll 1–2               1/500,000   → 50,000
//   roll 3–12              1/100,000   → 10,000
//   roll 13–32             1/50,000    → 5,000
//   roll 33–132            1/10,000    → 1,000
//   roll 133–332           1/5,000     → 500
//   roll 333–1,332         1/1,000     → 100
//   roll 1,333–999,999     otherwise   → XP 50–250 and tickets 0–10

const crypto = require('crypto');

const ROLL_SPACE = 1000000;

const SATS_TIERS = [
    { amount: 100000, odds: 1000000 },
    { amount: 50000,  odds: 500000 },
    { amount: 10000,  odds: 100000 },
    { amount: 5000,   odds: 50000 },
    { amount: 1000,   odds: 10000 },
    { amount: 500,    odds: 5000 },
    { amount: 100,    odds: 1000 },
];

const AUTO_PAY_MAX = 999; // under 1,000 sats pay from the faucet; 1,000+ are manual

function slotsFor(odds) {
    return ROLL_SPACE / odds;
}

function rollCipherReward(forcedRoll) {
    const roll = (typeof forcedRoll === 'number')
        ? forcedRoll
        : crypto.randomInt(0, ROLL_SPACE);

    let cursor = 0;
    for (let i = 0; i < SATS_TIERS.length; i++) {
        const tier = SATS_TIERS[i];
        const slots = slotsFor(tier.odds);
        if (roll < cursor + slots) {
            return { rewardType: 'sats', satsAmount: tier.amount, roll: roll };
        }
        cursor += slots;
    }

    return {
        rewardType: 'xp_tickets',
        xpAmount: 50 + crypto.randomInt(0, 201), // 50..250
        ticketCount: crypto.randomInt(0, 11),    // 0..10
        roll: roll,
    };
}

module.exports = {
    ROLL_SPACE: ROLL_SPACE,
    SATS_TIERS: SATS_TIERS,
    AUTO_PAY_MAX: AUTO_PAY_MAX,
    rollCipherReward: rollCipherReward,
};
