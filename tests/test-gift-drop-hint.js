// Unmatched locked-cipher cards show a short need-label hint.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const gifting = fs.readFileSync(path.join(root, 'gifting.js'), 'utf8');
const giftRoll = fs.readFileSync(path.join(root, 'functions/src/giftRoll.js'), 'utf8');

assert.ok(gifting.includes("Need a ' + which + ' · ask in Chat") ||
    gifting.includes('Need a \' + which + \' · ask in Chat'),
    'top locked-cipher note must use short Need a … · ask in Chat copy');
assert.ok(gifting.includes("Need a ' + label + ' key · ask in Chat"),
    'per-cipher card must use short Need a [label] key · ask in Chat copy');
assert.ok(!gifting.includes('Ask a peer to send you a matching key. Ask in Chat whether anyone has the key.'),
    'old long unmatched copy should be gone');

assert.ok(giftRoll.includes('keys 22%'), 'giftRoll comment should list keys 22%');
assert.ok(giftRoll.includes('ciphers 28%'), 'giftRoll comment should list ciphers 28%');
assert.ok(giftRoll.includes('r < 2200'), 'keys band ends at 2200');
assert.ok(giftRoll.includes('LABEL_BIAS_BP = 7000'), '70% label bias');
assert.ok(!giftRoll.includes('count = 1;\n        if (countRoll'), 'multi-key stack roll removed');

const { rollGiftReward } = require('../functions/src/giftRoll');
const labels = ['3A', '7F', 'B2', 'D9', '1C', '8E', 'A4', 'F6'];
const closet = [{ id: 'crown', name: 'Crown', emoji: '👑' }];
function scripted(values) {
    let i = 0;
    return function() {
        const v = values[Math.min(i, values.length - 1)];
        i += 1;
        return v;
    };
}
const key = rollGiftReward({ randomInt: scripted([100, 0]), labels: labels, closet: closet });
assert.strictEqual(key.rewardType, 'keys');
assert.strictEqual(key.keyLabels.length, 1);

console.log('✅ gift drop hint + odds source checks');
