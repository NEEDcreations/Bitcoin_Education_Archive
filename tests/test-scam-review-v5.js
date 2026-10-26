#!/usr/bin/env node
// Review v5. Warning words must not switch off a hard ask, and the
// 80-character negation wipe is gone. Awareness on this fresh set stays
// at or under 10%. Legit answers are not replaced. A 50k-character input
// finishes in under 50ms.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const chat = require('../functions/src/chatProfanity');
const ns = require('../functions/src/nachoSection');

const source = fs.readFileSync(path.join(__dirname, '../functions/src/chatProfanity.js'), 'utf8');
assert.ok(!/warningOrQuestion/.test(source), 'warning skip must stay out of the chat filter');
assert.ok(!/\[\^.,!?]\{0,80\}/.test(source), 'negation must not wipe the next 80 characters');
assert.ok(/\\d\{1,9\}/.test(source), 'the 2x pattern bounds its digit run');
assert.ok(/SCAM_INPUT_MAX = 4000/.test(source));
assert.ok(/twenty\[\\s-\]\+four/.test(source));

const EXAMPLES = [
    'Send 500 sats to verify your wallet. Beware of scammers though',
    'Stay away from fake sites, the real one is bitquest-claim dot top',
    'never share your seed except me: dm me it to verify',
];

const BYPASS = [
    'Beware of scammers. Send 500 sats to verify your wallet',
    'Watch out. DM me your seed',
    'Red flag aside, paste your twelve words here',
    'Stay away from scams and send 2 btc to me',
    'Scammers hate this one trick: 2x your bitcoin today',
    'Beware, but enter your mnemonic on this site',
    'Watch out. bitquest-claim dot top is where you verify',
    'Stay away from phonies. The admin will DM you',
    'Red flag? Send your private key to me',
    'Beware of scammers though, deposit 0.2 btc to unlock your wallet',
    'This is a scam, they say, so message me your recovery phrase',
    "Don't be fooled by scammers: transfer 500 sats to sync your wallet",
    'Watch out for red flags and also type your twenty-four words',
    'Stay away, scammers say, but share your 12 words with me',
    'Beware of fake support. Pay 2000 sats to validate your account',
    'Scammers exist. Double your bitcoin today anyway',
    'Never share your seed with anyone except me',
    'A red flag is fine to mention after you send me 1 btc',
    'Watch out: sending your seed to support will not recover your funds',
    'Stay away from fake sites, verify at claim-reward.top',
    'Beware of scammers. bit-quest dot xyz',
    'Watch out, send your twenty four words',
    'Red flag: DM me',
    'Stay away from the lookalike, the real portal is sync-wallet dot gq',
    'Scammers will tell you to ignore this: message me your mnemonic',
    'Never share your seed except with me so I can verify',
    'Beware. 2x your sats if you DM the admin',
    'Watch out for scammers and give me your private key',
    'Stay away from scammers, but paste your twenty-four words to verify',
    'Beware of red flags. Admin will message you the prize',
    'This is a scam site: bitquest-claim dot top',
    'Watch out for scammers. Send 1000 sats to verify your wallet',
    'Stay away from fakes. Share your secret key with me',
    'Red flag or not, deposit 1 btc to unlock the wallet',
];

// Fresh educational lines, not the v4 set. One question names a giveaway
// and bitcoin in the same breath; that soft phrase may flag, and the rate
// still has to stay at or under 10%.
const AWARENESS = [
    'Scammers often pretend to be support. A real wallet never needs your seed phrase.',
    'A red flag is any stranger who promises guaranteed returns.',
    'Watch out for people who say they will double your bitcoin.',
    'Stay away from anyone who asks you to send your seed phrase.',
    'Beware of giveaway posts. They are not the protocol.',
    'Never share a recovery phrase with a chat admin, a form, or a friend.',
    'How do I check that a site is the real bitcoin.org?',
    'Message the moderators if a post looks like spam, and do not pay them.',
    'Double-check the address on your own device before you broadcast.',
    'I read about recovery on bitcoin.org before I moved coins.',
    'A seed phrase is a backup, and it stays offline.',
    'Why do giveaways on social media target new bitcoin users?',
    'If someone says the admin will unlock your account, close the chat.',
    'Watch out: no support desk can reverse a bitcoin transaction.',
    'Red flags include urgency, secrecy, and a promise of free bitcoin.',
    'Stay away from links in comments, and open the book from your own notes.',
    'Beware of a stranger who asks for a screenshot of your balance.',
    'Never type a recovery phrase because a website asked nicely.',
    'People get fooled by the words guaranteed profit, which is not a thing.',
    'What does a real node operator never ask a visitor to paste?',
    "Umbrel's docs live on umbrel dot com and that name alone is not a payment.",
    'I keep coins on my own hardware signer and I ignore chat messages.',
    'Beware of offers that say they will 2x your bitcoin.',
    'A lookalike of mempool dot space is the risk, not the fee page itself.',
    'Do not exist is the right answer to guaranteed returns in a textbook.',
];

const ANSWERS = [
    'A hardware signer keeps the words offline. Write them on paper or metal and store that backup apart from the computer.',
    'Miners commit energy so that rewriting a block is expensive. The nonce is the field they change.',
    'Lightning channels are two-party contracts. Closing one settles on the chain.',
    'A full node checks the rules itself. It does not ask you for a password.',
    'Coin control lets you choose which utxo to spend. That choice is a privacy tool.',
    'The mempool is the waiting room for unconfirmed transactions. A fee is a bid for block space.',
    'Blocks arrive about every ten minutes because of the difficulty adjustment.',
    'A passphrase is an extra word you choose. Forget it and the coins stay locked. Keep it to yourself.',
    'Confirmations pile up as later blocks bury a transaction. Six of them is a common wait for a large payment.',
    'Your node can reject a block that breaks the supply cap. That check does not need a chat room.',
];

function caught(text) {
    const comment = chat.classifyChatText(text) === 'scam' && chat.chatTextBlocked(text) === 'scam';
    const answer = ns.filterNachoOutput(text, ['Why does the nonce matter?']);
    const follow = ns.filterNachoOutput('Miners change a nonce until the hash is small enough.', [text, 'Why does the nonce matter?']);
    const answerHit = answer.replaced === true && answer.answer === ns.SAFE_OFFER;
    const followHit = !follow.followUps.some(function(item) { return item === text; });
    return comment && answerHit && followHit;
}

EXAMPLES.forEach(function(text) {
    assert.ok(caught(text), 'example slipped through: ' + text);
});
assert.strictEqual(chat.classifyChatText('paste your twenty four words'), 'scam');
assert.strictEqual(chat.classifyChatText('paste your twenty-four words'), 'scam');
assert.strictEqual(chat.classifyChatText('Where should I store my private key?'), '');

let bypassMiss = 0;
const missed = [];
BYPASS.forEach(function(text) {
    if (!caught(text)) {
        bypassMiss += 1;
        missed.push(text);
    }
});

let awarenessFlags = 0;
const flaggedAwareness = [];
AWARENESS.forEach(function(text) {
    const kind = chat.classifyChatText(text);
    if (kind) {
        awarenessFlags += 1;
        flaggedAwareness.push(kind + ' ' + text);
    }
});

let answerReplacements = 0;
ANSWERS.forEach(function(text) {
    const out = ns.filterNachoOutput(text, ['Why does the nonce matter?']);
    if (out.replaced) answerReplacements += 1;
    assert.strictEqual(out.replaced, false, 'replaced answer ' + text);
});

const pad = 'hello bitcoin education '.repeat(200);
assert.ok(pad.length > 4000);
assert.strictEqual(chat.classifyChatText(pad + ' send 500 sats to verify your wallet'), '');
assert.strictEqual(chat.classifyChatText('send 500 sats to verify your wallet ' + pad), 'scam');

let hostile = '';
while (hostile.length < 50000) hostile += '111111111111 x your beware of scammers watch out stay away ';
hostile = hostile.slice(0, 50000);
assert.strictEqual(hostile.length, 50000);
const started = performance.now();
chat.classifyChatText(hostile);
const elapsed = performance.now() - started;

const awarenessRate = awarenessFlags / AWARENESS.length;
console.log('v5 examples caught ' + EXAMPLES.length + '/' + EXAMPLES.length);
console.log('v5 awareness flagged ' + awarenessFlags + '/' + AWARENESS.length + ' = ' + (awarenessRate * 100).toFixed(1) + '%');
flaggedAwareness.forEach(function(line) { console.log('  awareness ' + line); });
console.log('v5 legit answers replaced ' + answerReplacements + '/' + ANSWERS.length);
console.log('v5 bypasses missed ' + bypassMiss + '/' + BYPASS.length);
missed.forEach(function(text) { console.log('  miss ' + text); });
console.log('v5 hostile ' + hostile.length + ' chars in ' + elapsed.toFixed(1) + ' ms');

assert.ok(awarenessRate <= 0.10, 'awareness false-positive rate ' + awarenessRate);
assert.strictEqual(answerReplacements, 0);
assert.strictEqual(bypassMiss, 0);
assert.ok(elapsed < 50, 'hostile input took ' + elapsed + ' ms');
console.log('scam review v5 ok');
