'use strict';

// Gift odds, rolled with crypto.randomInt (exclusive max) when a gift is created.
// keys 30% | ciphers 20% | tickets 29.5% | xp 12% | shield 5% | nacho 0.5% | closet 3%
// Gift count: 2 (15%) | 3 (40%) | 4 (30%) | 5 (15%)

const crypto = require('crypto');

function rollGiftCount(randomInt) {
    const next = randomInt || crypto.randomInt;
    const g = next(0, 10000);
    if (g < 1500) return 2;
    if (g < 5500) return 3;
    if (g < 8500) return 4;
    return 5;
}

function rollGiftReward(opts) {
    const src = opts || {};
    const next = src.randomInt || crypto.randomInt;
    const labels = src.labels;
    const closet = src.closet;
    if (!labels || !labels.length) throw new Error('labels required');
    if (!closet || !closet.length) throw new Error('closet required');

    const r = next(0, 10000);
    if (r < 3000) {
        const countRoll = next(0, 10000);
        let count = 1;
        if (countRoll >= 5500) count = next(0, 10000) < 6500 ? 2 : 3;
        const keys = [];
        for (let i = 0; i < count; i++) keys.push(labels[next(0, labels.length)]);
        return { rewardType: 'keys', keyLabels: keys };
    }
    if (r < 5000) {
        const count = next(0, 10000) < 7000 ? 1 : 2;
        const ciphers = [];
        for (let i = 0; i < count; i++) ciphers.push(labels[next(0, labels.length)]);
        return { rewardType: 'locked_ciphers', cipherLabels: ciphers };
    }
    if (r < 7950) {
        const t = next(0, 10000);
        return { rewardType: 'tickets', ticketCount: t < 5500 ? 1 : t < 8500 ? 2 : 3 };
    }
    if (r < 9150) {
        const x = next(0, 10000);
        return { rewardType: 'xp_bonus', xpAmount: x < 5000 ? 50 : x < 8500 ? 100 : 150 };
    }
    if (r < 9650) return { rewardType: 'streak_shield' };
    if (r < 9700) return { rewardType: 'nacho_shoutout' };
    const item = closet[next(0, closet.length)];
    return { rewardType: 'closet_item', itemId: item.id, itemName: item.name, itemEmoji: item.emoji };
}

module.exports = {
    rollGiftCount: rollGiftCount,
    rollGiftReward: rollGiftReward,
};
