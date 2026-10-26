#!/usr/bin/env node
// 12 scam seeds x 14 obfuscations. The comment filter, the model answer,
// and the follow-up chips all use classifyChatText. Allowlisted domains
// in an ordinary sentence stay postable.
const assert = require('assert');
const chat = require('../functions/src/chatProfanity');
const ns = require('../functions/src/nachoSection');

const SEEDS = [
    'send 1000 sats to verify',
    'admin will DM you',
    'bit-quest dot xyz',
    "Don't sleep on this: guaranteed 10x returns, DM me",
    'Double your bitcoin today, don\'t miss it',
    'Never seen this before? send me 2 btc and get 4',
    'deposit 0.01 btc to unlock your rewards',
    'Transfer 500 sats to sync your wallet',
    'Pay 2000 sats to validate your account',
    'Contact support on telegram to recover your funds',
    'Earn 10000 sats a day, message the admin',
    'Win 5000 sats: DM the mod your seed to verify',
];

const CYR = {
    a: '\u0430', c: '\u0441', e: '\u0435', o: '\u043e', p: '\u0440', x: '\u0445',
    y: '\u0443', i: '\u0456', s: '\u0455', k: '\u043a', m: '\u043c', t: '\u0442',
    b: '\u0432', h: '\u04bb', d: '\u0501', n: '\u03b7', u: '\u03c5', g: '\u0261',
    r: '\u0433', f: '\ua730', l: '\u04cf', j: '\u0458', q: '\u051b', w: '\u051d',
    v: '\u0475', z: '\u1d22',
};

function mapChars(text, fn) {
    return Array.from(text).map(fn).join('');
}

const OBFUSCATIONS = [
    { name: 'plain', fn: function(text) { return text; } },
    { name: 'cyrillic', fn: function(text) {
        return mapChars(text, function(ch) {
            const sub = CYR[ch.toLowerCase()];
            return sub && /[a-z]/i.test(ch) ? sub : ch;
        });
    } },
    { name: 'zwsp', fn: function(text) { return mapChars(text, function(ch) { return ch + '\u200B'; }); } },
    { name: 'word-joiner', fn: function(text) { return mapChars(text, function(ch) { return ch + '\u2060'; }); } },
    { name: 'soft-hyphen', fn: function(text) { return mapChars(text, function(ch) { return ch + '\u00AD'; }); } },
    { name: 'fullwidth', fn: function(text) {
        return mapChars(text, function(ch) {
            const code = ch.charCodeAt(0);
            if (code >= 33 && code <= 126) return String.fromCharCode(code + 0xFEE0);
            if (ch === ' ') return '\u3000';
            return ch;
        });
    } },
    { name: 'letter-spacing', fn: function(text) {
        return mapChars(text, function(ch) {
            if (/[A-Za-z]/.test(ch)) return ch + ' ';
            if (ch === ' ') return '  ';
            return ch;
        });
    } },
    { name: 'leet', fn: function(text) {
        return text.replace(/[a-z]/gi, function(ch) {
            return { s: '5', e: '3', a: '4', t: '7', o: '0', i: '1', b: '8' }[ch.toLowerCase()] || ch;
        });
    } },
    { name: 'inner-punct', fn: function(text) {
        return text.replace(/[A-Za-z]{2,}/g, function(word) { return word.split('').join('.'); });
    } },
    { name: 'newlines', fn: function(text) { return text.replace(/ /g, '\n'); } },
    { name: 'number-words', fn: function(text) {
        return text
            .replace(/\b0\.01\b/g, 'zero point zero one')
            .replace(/\b10000\b/g, 'ten thousand')
            .replace(/\b5000\b/g, 'five thousand')
            .replace(/\b2000\b/g, 'two thousand')
            .replace(/\b1000\b/g, 'one thousand')
            .replace(/\b500\b/g, 'five hundred')
            .replace(/\b2\b/g, 'two');
    } },
    { name: 'extra-spaces', fn: function(text) { return text.replace(/ /g, '   '); } },
    { name: 'nbsp', fn: function(text) { return text.replace(/ /g, '\u00A0'); } },
    { name: 'bracket-dot', fn: function(text) {
        return text.replace(/\bdot\b/gi, '___DOT___').replace(/\./g, '[.]').replace(/___DOT___/g, '[.]');
    } },
];

assert.strictEqual(SEEDS.length, 12);
assert.strictEqual(OBFUSCATIONS.length, 14);

let caught = 0;
const total = SEEDS.length * OBFUSCATIONS.length;
const misses = [];
SEEDS.forEach(function(seed) {
    OBFUSCATIONS.forEach(function(ob) {
        const text = ob.fn(seed);
        const comment = chat.classifyChatText(text) === 'scam';
        const answer = ns.filterNachoOutput(text, ['Why does the nonce matter?']);
        const follow = ns.filterNachoOutput('Miners change a nonce until the hash is small enough.', [text, 'Why does the nonce matter?']);
        const answerHit = answer.replaced === true && answer.answer === ns.SAFE_OFFER;
        const followHit = !follow.followUps.some(function(item) { return item === text; })
            && follow.followUps.some(function(item) { return /nonce/i.test(item); });
        if (comment && answerHit && followHit) caught += 1;
        else misses.push(ob.name + ' :: ' + seed + ' :: ' + JSON.stringify(text).slice(0, 180) + ' comment=' + comment + ' answer=' + answerHit + ' follow=' + followHit);
    });
});

const rate = caught / total;
console.log('scam fuzz ' + caught + '/' + total + ' = ' + (rate * 100).toFixed(1) + '%');
misses.slice(0, 20).forEach(function(line) { console.log('  miss ' + line); });
assert.ok(rate >= 0.95, 'fuzz pass rate ' + rate);

[
    'Read the whitepaper at bitcoin dot org',
    'I use river dot com to buy',
    'The fee is on mempool dot space right now',
    'See the map at bitcoineducation dot quest',
    'How long does it take to sync your wallet?',
    'Never share your seed phrase with anyone',
    'hello there',
    'green dot after the signal',
].forEach(function(text) {
    assert.strictEqual(chat.classifyChatText(text), '', text);
    assert.strictEqual(chat.chatTextBlocked(text), '', text);
});

[
    'bit-quest[.]xyz',
    'bit-quest(.)xyz',
    'bit-quest d0t xyz',
    'bit-quest . xyz',
    'bit-quest\u200B.\u200Bxyz',
].forEach(function(text) {
    assert.strictEqual(chat.classifyChatText(text), 'scam', text);
});

const safeAnswer = ns.filterNachoOutput('Read the whitepaper at bitcoin dot org.', ['Why does the nonce matter?']);
assert.ok(safeAnswer.answer.toLowerCase().includes('bitcoin'));
assert.ok(!safeAnswer.replaced);

console.log('scam fuzz ok');
