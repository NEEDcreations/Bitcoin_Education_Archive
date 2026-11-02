'use strict';

// Cipher-open rewards. One crypto-secure roll per open (0..9,999,999).
// Sats tiers are disjoint so the stated odds are exact and a single open
// can pay at most one sats amount. Anything else is XP plus tickets.
//
//   roll 0                         1/10,000,000 → 100,000 sats
//   roll 1–10                      1/1,000,000  → 50,000
//   roll 11–30                     1/500,000    → 10,000
//   roll 31–130                    1/100,000    → 5,000
//   roll 131–330                   1/50,000     → 1,000
//   roll 331–1,330                 1/10,000     → 500
//   roll 1,331–3,330               1/5,000      → 250
//   roll 3,331–13,330              1/1,000      → 100
//   roll 13,331–113,330            1/100        → 50
//   roll 113,331–313,330           1/50         → 25
//   roll 313,331–1,313,330         1/10         → 10
//   roll 1,313,331–3,313,330       1/5          → 5
//   roll 3,313,331–9,999,999       otherwise    → XP 50–250 and tickets 0–10

const crypto = require('crypto');

const ROLL_SPACE = 10000000;
// Under 1,000 sats credit cipherSatsBalance. 1,000 and above stay manual.
const BALANCE_UNDER = 1000;

const SATS_TIERS = [
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

const ALLOWED_SATS_AMOUNTS = SATS_TIERS.map(function(tier) { return tier.amount; });

function slotsFor(odds) {
    return ROLL_SPACE / odds;
}

function satsDisposition(amount) {
    const n = Math.floor(Number(amount));
    if (ALLOWED_SATS_AMOUNTS.indexOf(n) === -1) return 'invalid';
    return n >= BALANCE_UNDER ? 'manual' : 'balance';
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
    BALANCE_UNDER: BALANCE_UNDER,
    SATS_TIERS: SATS_TIERS,
    ALLOWED_SATS_AMOUNTS: ALLOWED_SATS_AMOUNTS,
    AUTO_PAY_MAX: BALANCE_UNDER - 1,
    slotsFor: slotsFor,
    satsDisposition: satsDisposition,
    rollCipherReward: rollCipherReward,
};
