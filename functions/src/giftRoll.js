'use strict';

// Gift odds, rolled with crypto.randomInt (exclusive max) when a gift is created.
// keys 22% | ciphers 28% | tickets 29.5% | xp 12% | shield 5% | nacho 0.5% | closet 3%
// Gift count: 2 (15%) | 3 (40%) | 4 (30%) | 5 (15%)
// Key drops always grant exactly 1 key (no 2-3 stacks).
// When preferredLabels is set, ~70% of label picks come from that list.

const crypto = require('crypto');

const LABEL_BIAS_BP = 7000; // 70% toward preferred unmatched labels

function rollGiftCount(randomInt) {
    const next = randomInt || crypto.randomInt;
    const g = next(0, 10000);
    if (g < 1500) return 2;
    if (g < 5500) return 3;
    if (g < 8500) return 4;
    return 5;
}

function pickLabel(labels, preferred, next) {
    const pool = (preferred && preferred.length && next(0, 10000) < LABEL_BIAS_BP)
        ? preferred
        : labels;
    return pool[next(0, pool.length)];
}

// keyLabels / cipherLabels: arrays of label strings the player currently holds.
// forKeys = cipher labels with no matching key (bias key drops toward these).
// forCiphers = key labels with no matching cipher (bias cipher drops toward these).
function unmatchedLabels(keyLabels, cipherLabels) {
    const keySet = Object.create(null);
    const cipherSet = Object.create(null);
    (keyLabels || []).forEach(function(l) {
        if (l) keySet[l] = true;
    });
    (cipherLabels || []).forEach(function(l) {
        if (l) cipherSet[l] = true;
    });
    const forKeys = [];
    const forCiphers = [];
    Object.keys(cipherSet).forEach(function(l) {
        if (!keySet[l]) forKeys.push(l);
    });
    Object.keys(keySet).forEach(function(l) {
        if (!cipherSet[l]) forCiphers.push(l);
    });
    return { forKeys: forKeys, forCiphers: forCiphers };
}

function rollGiftReward(opts) {
    const src = opts || {};
    const next = src.randomInt || crypto.randomInt;
    const labels = src.labels;
    const closet = src.closet;
    if (!labels || !labels.length) throw new Error('labels required');
    if (!closet || !closet.length) throw new Error('closet required');

    const preferredKeys = Array.isArray(src.preferredKeyLabels) ? src.preferredKeyLabels : null;
    const preferredCiphers = Array.isArray(src.preferredCipherLabels) ? src.preferredCipherLabels : null;

    const r = next(0, 10000);
    // keys 22% (0..2199)
    if (r < 2200) {
        return { rewardType: 'keys', keyLabels: [pickLabel(labels, preferredKeys, next)] };
    }
    // locked ciphers 28% (2200..4999)
    if (r < 5000) {
        const count = next(0, 10000) < 7000 ? 1 : 2;
        const ciphers = [];
        for (let i = 0; i < count; i++) ciphers.push(pickLabel(labels, preferredCiphers, next));
        return { rewardType: 'locked_ciphers', cipherLabels: ciphers };
    }
    // tickets 29.5% (5000..7949)
    if (r < 7950) {
        const t = next(0, 10000);
        return { rewardType: 'tickets', ticketCount: t < 5500 ? 1 : t < 8500 ? 2 : 3 };
    }
    // xp 12% (7950..9149)
    if (r < 9150) {
        const x = next(0, 10000);
        return { rewardType: 'xp_bonus', xpAmount: x < 5000 ? 50 : x < 8500 ? 100 : 150 };
    }
    // shield 5% (9150..9649)
    if (r < 9650) return { rewardType: 'streak_shield' };
    // nacho 0.5% (9650..9699)
    if (r < 9700) return { rewardType: 'nacho_shoutout' };
    // closet 3% (9700..9999)
    const item = closet[next(0, closet.length)];
    return { rewardType: 'closet_item', itemId: item.id, itemName: item.name, itemEmoji: item.emoji };
}

module.exports = {
    rollGiftCount: rollGiftCount,
    rollGiftReward: rollGiftReward,
    pickLabel: pickLabel,
    unmatchedLabels: unmatchedLabels,
    LABEL_BIAS_BP: LABEL_BIAS_BP,
};
