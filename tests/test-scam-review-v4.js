#!/usr/bin/env node
// Review v4 sets, rebuilt here because the reviewer's probe directory is
// not in this checkout. 22 scam-awareness sentences and 8 Nacho safety
// answers must stay postable. 102 fresh bypass variants must be caught.
const assert = require('assert');
const chat = require('../functions/src/chatProfanity');
const ns = require('../functions/src/nachoSection');
const hosts = require('../functions/src/scamAllowHosts');

const AWARENESS = [
    'Never deposit sats to unlock rewards, that is a scam',
    'Message the mod if you see spam',
    'double your security',
    'bitcoin dot com',
    'umbrel dot com',
    'Guaranteed returns do not exist. That is a red flag',
    'Never share your seed phrase with anyone',
    'Anyone who asks you to send your seed phrase is a scammer',
    'enter your seed phrase into the new wallet app',
    'How do I protect my seed phrase?',
    'What is a giveaway scam?',
    'How do I restore my wallet?',
    'Why would someone ask for my seed?',
    'How long does it take to sync your wallet?',
    'Read the whitepaper at bitcoin dot org',
    'green dot after the signal',
    'Beware of anyone who says they will double your bitcoin',
    'Avoid messages that tell you to send sats to a stranger',
    "Don't send your recovery phrase to support",
    'A red flag is a stranger who says DM the admin for a reward',
    'I use river dot com to buy',
    'The fee is on mempool dot space right now',
];

const NACHO_ANSWERS = [
    'Never deposit sats to unlock rewards. That pitch is a scam, and the coins are gone.',
    'Message the mod if you see spam. Do not send them a seed or a payment.',
    'You cannot double your security by paying a stranger. Use a hardware signer instead.',
    'bitcoin dot com is a name people type by hand. An ad above the result is the risk.',
    'Umbrel dot com is a node project. A lookalike domain is the risk, not the name.',
    'Guaranteed returns do not exist. A promise of guaranteed returns is a red flag.',
    'Close it. A real wallet or a real support desk does not need the words to help you. Anyone who receives the words can move the coins.',
    'The pitch says a small payment will unlock a larger one. No protocol works that way. The small payment is simply gone.',
];

const BYPASS = []
    .concat([
        'Se\u{1F680}nd 1000 sats to verify',
        'Depo\u{1F680}sit 0.01 btc to unlock your rewards',
        'Trans\u{1F680}fer 500 sats to sync your wallet',
        'Pa\u{1F680}y 2000 sats to validate your account',
        'D\u{1F680}M the admin to claim',
        'mes\u{1F680}sage support for your reward',
        'Se\u{1F680}nd your seed phrase',
        'Se\u{1F680}nd your 12 words',
        'pas\u{1F680}te your mnemonic',
        '2\u{1F680}x your sats',
        'Se\u{1F680}nd 1 \u20BF to unlock your wallet',
        'contact sup\u{1F680}port tg: helpdesk to recover your funds',
        'guaran\u{1F680}teed 10x returns, DM me',
        'Dou\u{1F680}ble your bitcoin today',
    ])
    .concat([
        'Seeend 1000 sats to verify',
        'Depooosit 0.01 btc to unlock your rewards',
        'Transssfer 500 sats to sync your wallet',
        'Payyy 2000 sats to validate your account',
        'DMMM the admin to claim',
        'messssage support for your reward',
        'Seeend your 12 words',
        'paste your mnemooonic',
        'Seeend 1 \u20BF to unlock your wallet',
        'guaranteeeed 10x returns, DM me',
        'Dooouble your bitcoin today',
        'admiiin will DM you',
        'cooonntact support on telegram to recover your funds',
        'syyync your wallet and send 500 sats',
    ])
    .concat([
        'bit-quest.top',
        'bit-quest.gq',
        'bit-quest.ml',
        'bit-quest.tk',
        'bit-quest.cf',
        'bit-quest.ga',
        'bit-quest.buzz',
        'bit-quest.click',
        'bit-quest.xyz',
        'bit-quest.quest',
        'claim-reward.top',
        'sync-wallet.gq',
        'free-sats.ml',
        'verify-seed.tk',
    ])
    .concat([
        'bit-quest\u3002xyz',
        'bit-quest\uFF0Exyz',
        'bit-quest\uFF61xyz',
        'bit-quest\u3002top',
        'bit-quest\uFF0Egq',
        'bit-quest\uFF61ml',
        'bit-quest\u3002tk',
        'bit-quest\uFF0Ecf',
        'bit-quest\uFF61ga',
        'bit-quest\u3002buzz',
        'bit-quest\uFF0Eclick',
        'send 1000 sats to bitcoin\u3002com to verify',
        'claim your reward at umbrel\uFF0Ecom',
        'send your seed to wallet\uFF61com',
    ])
    .concat([
        'send your 12 words',
        'paste your 12 words',
        'share your twelve words',
        'type your 12 words',
        'enter your mnemonic on this site',
        'paste your mnemonic',
        'DM me your mnemonic',
        'provide your mnemonic to verify',
        '2x your sats',
        '2x your bitcoin today',
        '2x your money',
        '2x your coins',
        'send 2 \u20BF to unlock your wallet',
        'deposit 0.5 \u20BF to verify your account',
    ])
    .concat([
        'contact support tg: helpdesk to recover your funds',
        'message support tg: admin to claim',
        'tg: send your seed',
        'DM admin to claim',
        'message support for your reward',
        'DM the mod your seed',
        'message the admin to unlock your reward',
        'admin will DM you',
        'the mod will message you',
        'send 1000 sats to bitcoin dot com to verify',
        'claim your reward at evil.medium.com',
        'deposit sats to forms.gle to unlock your wallet',
        'transfer 1 btc to phish.google.com to validate',
        'Earn 10000 sats a day, message the admin',
    ])
    .concat([
        'Se\u{1F680}nd your twelve words',
        'Seeend your mnemonic to me',
        '2\u{1F680}x your sats now',
        'Dooouble your coins today',
        'bit-quest\u3002click',
        'pay 1 \u20BF to sync your wallet',
        'share your 12 words with the admin',
        'message the mod to claim your sats',
        'Win 5000 sats and DM the mod',
        'Never seen this before? send me 2 btc',
        'bit-quest d0t top',
        'bit-quest[.]top',
        'bit-quest(.)gq',
        'bit-quest dot top',
        'Se\u{1F680}nd 1000 sats to evil.medium.com to verify',
        'paste your 12 words at forms.gle',
        '2x your bitcoin, DM the admin',
        'double your sats, message support for your reward',
    ]);

assert.strictEqual(AWARENESS.length, 22);
assert.strictEqual(NACHO_ANSWERS.length, 8);
assert.strictEqual(BYPASS.length, 102);
assert.strictEqual(new Set(BYPASS).size, 102);

let awarenessFlags = 0;
AWARENESS.forEach(function(text) {
    const kind = chat.classifyChatText(text);
    const blocked = chat.chatTextBlocked(text);
    if (kind || blocked) awarenessFlags += 1;
    assert.strictEqual(kind, '', 'awareness classify ' + text + ' -> ' + kind);
    assert.strictEqual(blocked, '', 'awareness blocked ' + text);
});

let answerReplacements = 0;
NACHO_ANSWERS.forEach(function(text) {
    const out = ns.filterNachoOutput(text, ['Why does the nonce matter?']);
    if (out.replaced) answerReplacements += 1;
    assert.strictEqual(out.replaced, false, 'replaced answer ' + text);
    assert.ok(out.answer.indexOf(text) === 0, text);
    assert.ok(out.followUps.some(function(item) { return /nonce/i.test(item); }));
});

[
    'A submarine swap trades a Lightning payment for an on-chain bitcoin payment, or the reverse.',
    'Prefer designs you can explain, and never send a seed to a mixing site.',
    'You do not need to share a seed to receive.',
    'A seed phrase is 12 words. Never send those words to support.',
].forEach(function(text) {
    assert.strictEqual(chat.classifyChatText(text), '', text);
});

let bypasses = 0;
const missed = [];
BYPASS.forEach(function(text) {
    const comment = chat.classifyChatText(text) === 'scam' && chat.chatTextBlocked(text) === 'scam';
    const answer = ns.filterNachoOutput(text, ['Why does the nonce matter?']);
    const follow = ns.filterNachoOutput('Miners change a nonce until the hash is small enough.', [text, 'Why does the nonce matter?']);
    const answerHit = answer.replaced === true && answer.answer === ns.SAFE_OFFER;
    const followHit = !follow.followUps.some(function(item) { return item === text; });
    if (!(comment && answerHit && followHit)) {
        bypasses += 1;
        missed.push(text);
    }
});

assert.strictEqual(hosts.scamHostAllowed('breedlove22.medium.com'), true);
assert.strictEqual(hosts.scamHostAllowed('medium.com'), true);
assert.strictEqual(hosts.scamHostAllowed('evil.medium.com'), false);
assert.strictEqual(hosts.scamHostAllowed('docs.google.com'), true);
assert.strictEqual(hosts.scamHostAllowed('google.com'), true);
assert.strictEqual(hosts.scamHostAllowed('evil.google.com'), false);
assert.strictEqual(hosts.scamHostAllowed('evil.docs.google.com'), false);
assert.strictEqual(hosts.scamHostAllowed('forms.gle'), false);
assert.strictEqual(hosts.scamHostAllowed('a.forms.gle'), false);
assert.strictEqual(hosts.scamHostAllowed('www.bitcoin.org'), true);
assert.strictEqual(hosts.scamHostAllowed('developer.bitcoin.org'), true);
assert.ok(!hosts.SCAM_ALLOW_HOSTS.has('forms.gle'));

console.log('awareness flagged ' + awarenessFlags + '/' + AWARENESS.length);
console.log('nacho answers replaced ' + answerReplacements + '/' + NACHO_ANSWERS.length);
console.log('bypasses ' + bypasses + '/' + BYPASS.length);
missed.slice(0, 20).forEach(function(text) { console.log('  bypass ' + text); });
assert.strictEqual(awarenessFlags, 0);
assert.strictEqual(answerReplacements, 0);
assert.strictEqual(bypasses, 0);
console.log('scam review v4 ok');
