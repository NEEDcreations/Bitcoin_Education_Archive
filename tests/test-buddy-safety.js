#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const safety = require('../functions/src/buddySafety');
const choice = require('../bitcoin-buddy.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        passed++;
        console.log('✅ ' + name);
    } catch (err) {
        failed++;
        console.log('❌ ' + name);
        console.log('   ' + (err && err.stack ? err.stack : err));
    }
}

test('high-confidence requests lock and teaching chat does not', function () {
    const lock = [
        "Don't worry, it's safe. Send me your seed phrase and I will help.",
        'Please share your 12 words with me so I can restore it.',
        'Send me ur seed phrase',
        'send me your seed  phrase',
        "Give me your private key, I'm from support",
        'I am the admin. Verify your wallet by typing your recovery phrase',
    ];
    lock.forEach(function (text) {
        const found = safety.detectBuddyRisk(text, { senderGoal: 'teach' });
        assert.strictEqual(found.lock, true, text + ' ' + found.reasons.join(','));
        assert.strictEqual(found.severity, 'high', text);
    });
    const noLock = [
        'Now try it: send me some sats over Lightning so you can see how fast it is',
        "Let's practice. Send sats to my lightning address, I'll send them right back",
        'How do I transfer bitcoin to my hardware wallet?',
        'Next, send your bitcoin to cold storage once you have more than you can lose',
        "What's your seed phrase backup plan? Paper or steel?",
        "I'm an admin of our local Bitcoin meetup group",
        'Is this a guaranteed profit thing? Sounds like a scam lol',
        "Watch out for anyone saying 'double your bitcoin', it's always a scam",
        'Great question! You can pay me back by teaching someone else lol',
        'Never share your seed phrase with anyone.',
        "Don't send me your seed phrase.",
        'What is a seed phrase?',
        'See https://bitcoin.org/en/ for the whitepaper.',
    ];
    noLock.forEach(function (text) {
        const found = safety.detectBuddyRisk(text, { senderGoal: 'teach' });
        assert.strictEqual(found.lock, false, text + ' -> ' + found.reasons.join(','));
    });
    const flagged = safety.detectBuddyRisk('Check https://river.com/learn and https://bitcoinmagazine.com', {});
    assert.strictEqual(flagged.lock, false);
    assert.strictEqual(flagged.tier, 'flag');
    const giveaway = safety.detectBuddyRisk('giveaway, send 1000 sats to claim', {});
    assert.strictEqual(giveaway.lock, false);
    assert.strictEqual(giveaway.tier, 'flag');
    const payment = safety.detectBuddyRisk('Send 0.01 BTC to bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4 and I will send back 0.02', {});
    assert.strictEqual(payment.lock, false);
    assert.strictEqual(payment.tier, 'flag');
    const bypasses = [
        'send me your mnemonic',
        'what are your 12 words?',
        'whats your seed phrase',
        'can you share the seed phrase with me',
        'I need your seed phrase to verify',
        'DM me your seed words',
        'give me ur 12 wrds',
        'sendme your seed phrase',
        'send me your seed_phrase',
        'send me your s e e d phrase',
        'send me your s.e.e.d phrase',
        'send me your \u0455eed phrase',
        'send me your se\u0435d phrase',
        'send me your se\u200Bed phrase',
        'send me your\u200B seed phrase',
        'send\u200Bme your seed phrase',
        'Ｓｅｎｄ ｍｅ ｙｏｕｒ ｓｅｅｄ ｐｈｒａｓｅ',
        "Don't worry, send me your seed phrase",
        'Do not worry. Send me your seed phrase',
        'No stress, do not panic send me your private key',
    ];
    bypasses.forEach(function (text) {
        const found = safety.detectBuddyRisk(text);
        assert.strictEqual(found.lock, true, text + ' ' + found.reasons.join(','));
    });
    const bare = safety.detectBuddyRisk('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
    assert.strictEqual(bare.lock, false);
    assert.strictEqual(bare.tier, 'none');
    const invoice = safety.detectBuddyRisk('lnbc2500n1pw5k8qapp5exampleinvoicepaymentrequest');
    assert.strictEqual(invoice.lock, false);
    assert.strictEqual(invoice.tier, 'none');
    const payAddress = safety.detectBuddyRisk('Pay 5000 sats to bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
    assert.strictEqual(payAddress.lock, false);
    assert.strictEqual(payAddress.tier, 'flag');
    const teaching = [
        'Enter your 24 words on the device itself, not on your computer',
        'Type your seed words into the Coldcard to restore',
        'Type your seed words into the Trezor to restore',
        'Type your recovery phrase into the Ledger',
        'When you restore, enter your recovery phrase on the hardware wallet only',
        'Write down your 12 words and enter your seed phrase only into your own wallet',
        "What's your seed phrase storage method?",
        "If someone says 'send me your seed phrase', block them",
        'Ignore anyone who says "tell me your private key"',
        "I'm an admin here, never send anyone your seed phrase",
        "I'm the admin of a Telegram group, I'd never ask you for sats",
        'Send a test transaction first. Example address format: bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    ];
    teaching.forEach(function (text) {
        const found = safety.detectBuddyRisk(text);
        assert.strictEqual(found.lock, false, text + ' -> ' + found.severity + ' ' + found.reasons.join(','));
    });
});

test('an unknown link or an off-platform nudge does not lock', function () {
    const link = safety.detectBuddyRisk('look at http://free-btc.example/claim', {});
    assert.strictEqual(link.lock, false);
    assert.strictEqual(link.tier, 'flag');
    const move = safety.detectBuddyRisk("let's continue on telegram", {});
    assert.strictEqual(move.lock, false);
    assert.strictEqual(move.tier, 'flag');
    const known = safety.detectBuddyRisk('https://bitcoineducation.quest/learn', {});
    assert.strictEqual(known.severity, 'none');
});

test('reports use the existing shape, dedupe per reason per hour, and cap the snippet', function () {
    const now = Date.parse('2026-10-28T15:10:00Z');
    const later = now + 10 * 60 * 1000;
    const nextHour = now + 60 * 60 * 1000;
    const id = safety.flagDocId('alice_bob', 'send_funds', now);
    assert.strictEqual(id, safety.flagDocId('alice_bob', 'send_funds', later));
    assert.notStrictEqual(id, safety.flagDocId('alice_bob', 'seed_or_key', now));
    assert.notStrictEqual(id, safety.flagDocId('alice_bob', 'send_funds', nextHour));
    const report = safety.buildBuddyReport({
        reportedUid: 'aliceuidLONG',
        otherUid: 'bobuidxxLONG',
        reportedName: 'Alice',
        reasons: ['seed_request'],
        severity: 'high',
        convoId: 'aliceuidLONG_bobuidxxLONG',
        snippet: 'x'.repeat(500),
        messageId: 'm1',
    });
    assert.strictEqual(report.type, 'buddy_dm_lock');
    assert.strictEqual(report.lockApplied, true);
    assert.strictEqual(report.status, 'pending');
    assert.strictEqual(report.reporterUid, 'system');
    assert.strictEqual(report.reportedUid, 'aliceu');
    assert.strictEqual(report.reportedName, 'Alice');
    assert.strictEqual(report.reason, 'seed_request');
    assert.strictEqual(report.reportedUidShort, 'aliceu');
    assert.strictEqual(report.otherUidShort, 'bobuid');
    assert.strictEqual(report.snippet.length, 200);
    assert.strictEqual(report.convoId, undefined);
    assert.deepStrictEqual(report.actions, ['unlock', 'keep_locked', 'ban', 'unlock_and_dismiss']);
    const low = safety.buildBuddyReport({ reportedUid: 'a', reasons: ['unknown_link'], severity: 'medium', snippet: 'hi', convoId: 'a_b' });
    assert.strictEqual(low.type, 'buddy_dm_flag');
    assert.strictEqual(low.lockApplied, false);
    assert.strictEqual(low.reportedUid, 'a');
    assert.strictEqual(safety.warningCopy('high'), safety.WARNING_HIGH);
    assert.ok(safety.WARNING_LOW.indexOf('paused') === -1);
    assert.strictEqual(safety.warningDocId('high'), 'safety-review');
    assert.strictEqual(safety.warningDocId('low'), 'safety-review');
});

test('a buddy report locks only for the other person and the same chat', function () {
    const report = { type: 'buddy', reason: 'buddy', reporterUid: 'bob', reportedUid: 'alice' };
    const convo = { id: 'alice_bob', participants: ['alice', 'bob'] };
    assert.strictEqual(safety.planUserReportLock(report, [], convo).lock, false);
    const otherChat = safety.planUserReportLock(report, [{
        source: 'server', severity: 'high', convoId: 'alice_cara', reportedUid: 'alice',
    }], convo);
    assert.strictEqual(otherChat.lock, false);
    const lowOnly = safety.planUserReportLock(report, [{
        source: 'server', severity: 'medium', convoId: 'alice_bob', reportedUid: 'alice',
    }], convo);
    assert.strictEqual(lowOnly.lock, false);
    const stranger = safety.planUserReportLock(
        { type: 'buddy', reporterUid: 'cara', reportedUid: 'alice' },
        [{ source: 'server', severity: 'high', convoId: 'alice_bob', reportedUid: 'alice' }],
        convo
    );
    assert.strictEqual(stranger.lock, false);
    const backed = safety.planUserReportLock(report, [{
        source: 'server', severity: 'high', convoId: 'alice_bob', reportedUid: 'alice', status: 'open', createdAtMs: 200, reasons: ['seed_request'],
    }], convo);
    assert.strictEqual(backed.lock, true);
    assert.strictEqual(backed.sender, 'alice');
    const dismissed = safety.planUserReportLock(report, [{
        source: 'server', severity: 'high', convoId: 'alice_bob', reportedUid: 'alice', status: 'dismissed', createdAtMs: 200, reasons: ['seed_request'],
    }], convo);
    assert.strictEqual(dismissed.lock, false);
    const afterUnlock = safety.planUserReportLock(report, [{
        source: 'server', severity: 'high', convoId: 'alice_bob', reportedUid: 'alice', status: 'open', createdAtMs: 50, reasons: ['seed_request'],
    }], { id: 'alice_bob', participants: ['alice', 'bob'], unlockedAt: 100 });
    assert.strictEqual(afterUnlock.lock, false);
    const freshFlag = safety.planUserReportLock(report, [{
        source: 'server', severity: 'high', convoId: 'alice_bob', reportedUid: 'alice', status: 'open', createdAtMs: 150, reasons: ['seed_request'],
    }], { id: 'alice_bob', participants: ['alice', 'bob'], unlockedAt: 100 });
    assert.strictEqual(freshFlag.lock, true);
    const userReportFlag = safety.planUserReportLock(report, [{
        source: 'server', severity: 'high', convoId: 'alice_bob', reportedUid: 'alice', status: 'open', createdAtMs: 200, reasons: ['user_report'],
    }], convo);
    assert.strictEqual(userReportFlag.lock, false);
    const missingTime = safety.planUserReportLock(report, [{
        source: 'server', severity: 'high', convoId: 'alice_bob', reportedUid: 'alice', status: 'open', reasons: ['seed_request'],
    }], { id: 'alice_bob', participants: ['alice', 'bob'], unlockedAt: 100 });
    assert.strictEqual(missingTime.lock, false);
    const twoFlags = safety.planUserReportLock(report, [
        { source: 'server', severity: 'medium', convoId: 'alice_bob', reportedUid: 'alice', status: 'open', createdAtMs: 200, reasons: ['unknown_link'] },
        { source: 'server', severity: 'medium', convoId: 'alice_bob', reportedUid: 'alice', status: 'open', createdAtMs: 200, reasons: ['off_platform'] },
    ], convo);
    assert.strictEqual(twoFlags.lock, false);
    assert.strictEqual(safety.planUserReportLock({ type: 'buddy_dm_lock', reporterUid: 'bob', reportedUid: 'alice' }, [{
        source: 'server', severity: 'high', convoId: 'alice_bob', reportedUid: 'alice',
    }], convo).lock, false);
});

test('admin actions unlock, keep, ban, or dismiss, and a bad action is rejected', function () {
    assert.strictEqual(safety.planAdminResolve('unlock').clearLock, true);
    assert.strictEqual(safety.planAdminResolve('unlock').resumeChat, true);
    assert.strictEqual(safety.planAdminResolve('unlock').ban, false);
    assert.strictEqual(safety.planAdminResolve('keep_locked').clearLock, false);
    assert.strictEqual(safety.planAdminResolve('keep_locked').resumeChat, false);
    assert.strictEqual(safety.planAdminResolve('ban').ban, true);
    assert.strictEqual(safety.planAdminResolve('ban').clearLock, false);
    assert.strictEqual(safety.planAdminResolve('unlock_and_dismiss').clearLock, true);
    assert.strictEqual(safety.planAdminResolve('unlock_and_dismiss').resumeChat, true);
    assert.strictEqual(safety.planAdminResolve('unlock_and_dismiss').reportStatus, 'dismissed');
    assert.strictEqual(safety.planAdminResolve('nope').error, 'action');
    const lock = safety.publicLock(5);
    assert.strictEqual(lock.state, 'locked');
    assert.strictEqual(lock.source, 'buddy_dm');
    assert.strictEqual(lock.reason, undefined);
    assert.strictEqual(lock.reportIds, undefined);
    assert.strictEqual(safety.accountLocked({ lock: lock }), true);
    assert.strictEqual(safety.alreadyLockedFor({ lock: lock }), true);
    assert.ok(safety.randomDocId('bf').indexOf('alice') === -1);
});

test('onboarding can opt in to learn or teach, or store nothing', function () {
    assert.deepStrictEqual(choice.planOnboardingChoice({ choice: 'learn', level: 'advanced' }).store, { level: 'advanced', goal: 'learn' });
    assert.deepStrictEqual(choice.planOnboardingChoice({ choice: 'teach', level: 'wizard' }).store, { level: 'beginner', goal: 'teach' });
    const skip = choice.planOnboardingChoice({ choice: 'Not now' });
    assert.strictEqual(skip.choice, 'later');
    assert.strictEqual(skip.store, null);
    const src = fs.readFileSync(path.join(__dirname, '..', 'onboarding.js.src'), 'utf8');
    assert.ok(src.includes('Want a Bitcoin Buddy?'));
    assert.ok(src.includes('data-buddy-choice'));
    assert.ok(src.includes("localStorage.setItem('btc_buddy_pending'"));
    assert.ok(src.includes("localStorage.removeItem('btc_buddy_pending'"));
    assert.ok(src.includes('_submitBuddyFromOnboarding'));
    assert.ok(src.includes('A Bitcoin Buddy is optional'));
    const client = fs.readFileSync(path.join(__dirname, '..', 'bitcoin-buddy.js'), 'utf8');
    assert.ok(client.includes('window._submitBuddyFromOnboarding'));
    assert.ok(client.includes('requestBuddyMatch'));
    assert.ok(client.indexOf('awardPoints') === -1);
    const ranking = fs.readFileSync(path.join(__dirname, '..', 'ranking.js'), 'utf8');
    assert.ok(ranking.includes('window._submitBuddyFromOnboarding'));
    assert.strictEqual(ranking.indexOf("removeItem('btc_buddy_pending')"), -1);
});

test('teaching lines do not lock and a scam quote is only a flag', function () {
    const teaching = [
        "You'll need your 24 words if your device breaks",
        'Hackers need your private key to move funds',
        'Why do people need your seed phrase to steal your coins?',
        'Share your seed phrase with no one',
        'A scammer might say send me your private key to verify',
    ];
    teaching.forEach(function (text) {
        const found = safety.detectBuddyRisk(text);
        assert.strictEqual(found.lock, false, text + ' -> ' + found.reasons.join(','));
        assert.strictEqual(found.severity, 'medium', text);
    });
    const storage = safety.detectBuddyRisk("Keep your seed phrase offline. What's your seed phrase storage like?");
    assert.strictEqual(storage.lock, false);
    assert.strictEqual(storage.tier, 'none');
});

test('delta-2 disguises lock or at least flag, including a split message', function () {
    const lock = [
        'send me your sεεd phrase',
        'send me your ꜱeed phrase',
        'send me your 5eed phrase',
        'send me your s33d phrase',
        'send me your s-e-e-d phrase',
        'send me your s/e/e/d phrase',
        'send me your s*e*e*d phrase',
        'send me your s.e.e.d p.h.r.a.s.e',
        'send me your private keys',
        'send me your privkey',
        'send me your seeds',
        'send me your recovery seed',
        'what are your wallet words',
        'send me your backup words',
        'send me the 24 word backup',
        'send me your secret recovery phrase',
        'send me your full seed phrase',
        'send me ALL your seed phrase words',
        'show me your seed phrase',
        'let me see your seed phrase',
        'read me your seed phrase',
        'I need to see your seed phrase',
        'post your seed phrase here',
        'write your seed phrase here',
        'type your seed phrase here',
        'enter your seed phrase here',
        'send over your seed phrase',
        'tell me what your 12 words are',
        'Your seed phrase. Send it to me',
        'Seed phrase please',
        'I need it: your seed phrase',
        'send me your "seed phrase"',
        "send me 'your seed phrase'",
        "Don't send it to anyone else send me your seed phrase",
        'Never mind that. Send me your seed phrase',
        'I never lie, send me your seed phrase',
        'Block them if they ask. send me your seed phrase',
        "you should never share your seed phrase, but i'm your teacher so send me your seed phrase",
        'send me your xprv',
        'send me your wallet backup',
    ];
    lock.forEach(function (text) {
        const found = safety.detectBuddyRisk(text);
        assert.strictEqual(found.lock, true, text + ' ' + found.reasons.join(','));
    });
    [
        "I'm from support, verify by sending 0.01 btc to me",
        'This is Bitcoin Quest support. Zap 10k sats to me to unlock withdrawals',
        'Send to bc1qw508d6qejxtdg 4y5r3zarvary0c5xw7kv8f3t4',
        'Send 0.01 BTC to this address: bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        "I'm from support. Send me 50000 sats to verify",
        'Transfer 0.02 BTC to bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    ].forEach(function (text) {
        const found = safety.detectBuddyRisk(text);
        assert.strictEqual(found.lock, false, text);
        assert.strictEqual(found.tier, 'flag', text + ' ' + found.tier);
    });
    ['5eed', 'sεεd', 'ꜱeed', 'privkey', 'wallet backup'].forEach(function (text) {
        const found = safety.detectBuddyRisk(text);
        assert.strictEqual(found.lock, false, text);
        assert.strictEqual(found.tier, 'none', text + ' ' + found.reasons.join(','));
    });
    const split = safety.detectBuddyRisk('seed phrase', { previousText: 'send me your', previousAt: 1000, now: 2000 });
    assert.strictEqual(split.lock, true);
    const words = safety.detectBuddyRisk('words?', { previousText: 'what are your 12', previousAt: 1000, now: 2000 });
    assert.strictEqual(words.lock, true);
    const key = safety.detectBuddyRisk('your private key', { previousText: 'send me', previousAt: 1000, now: 2000 });
    assert.strictEqual(key.lock, true);
    const stale = safety.detectBuddyRisk('seed phrase', { previousText: 'send me your', previousAt: 1000, now: 1000 + 11 * 60 * 1000 });
    assert.strictEqual(stale.lock, false);
    assert.strictEqual(stale.tier, 'none');
});

test('learner questions do not lock and a split request still does', function () {
    const questions = [
        'tell me about seed phrases',
        'Tell me about seed phrase best practices',
        'can you tell me what a seed phrase is',
        'tell me more about private keys',
        'tell me why I need a seed phrase',
        'explain seed phrases to me',
        'show me how to back up my seed phrase',
        'show me where to write my seed phrase',
        'Show me the seed phrase screen in Sparrow',
        'show me an example seed phrase',
        'send me a guide on seed phrases',
        'Can you send me a link about seed phrases?',
        'give me tips on storing my seed phrase',
        'Send me your questions about seed phrases',
        'I need your help with my seed phrase',
        'Give me a sec, my seed phrase is on steel',
        'Send me a pic of your setup, not your seed phrase',
        'Show me how you back up, but never show me your seed phrase',
        'A scammer will ask you to send your seed phrase',
        'A scammer may ask you to send your seed phrase',
        'Scammers will tell you to send your seed phrase',
    ];
    questions.forEach(function (text) {
        const found = safety.detectBuddyRisk(text);
        assert.strictEqual(found.lock, false, text + ' -> ' + found.reasons.join(','));
        assert.strictEqual(found.severity, 'medium', text);
    });
    const notes = safety.detectBuddyRisk('Send me your notes', {
        previousText: "What's a seed phrase?",
        previousAt: 1000,
        now: 2000,
    });
    assert.strictEqual(notes.lock, false);
    const afterUnlock = safety.detectBuddyRisk('seed phrase', {
        previousText: 'send me your',
        previousAt: 50,
        now: 150,
        unlockedAt: 100,
    });
    assert.strictEqual(afterUnlock.lock, false);
});

test('direct handoffs that used to be warnings now lock', function () {
    [
        'Can I have your seed phrase?',
        'gimme your seed',
        'reply with your seed phrase',
        'pls drop ur seed phrase in here',
        'seed phrase -> me',
        's e e d p h r a s e send it',
    ].forEach(function (text) {
        const found = safety.detectBuddyRisk(text);
        assert.strictEqual(found.lock, true, text + ' ' + found.reasons.join(','));
    });
    const frozen = safety.detectBuddyRisk("I'm support, your account is frozen, send 100k sats to unlock");
    assert.strictEqual(frozen.lock, false);
    assert.strictEqual(frozen.tier, 'flag');
});

test('a message tail expires and never keeps a secret', function () {
    const kept = safety.planTailWrite('send me your', 1000);
    assert.strictEqual(kept.text, 'send me your');
    assert.strictEqual(kept.expireAt, 1000 + 10 * 60 * 1000);
    const marked = safety.planTailWrite('Your seed phrase.', 1000);
    assert.strictEqual(marked.text, 'your seed phrase');
    assert.ok(marked.text.indexOf('Your') === -1);
    assert.strictEqual(safety.planTailWrite('abandon ability able about zoo', 1000), null);
    assert.strictEqual(safety.planTailRead(kept, 2000, 0), 'send me your');
    assert.strictEqual(safety.planTailRead(kept, 1000 + 11 * 60 * 1000, 0), '');
    assert.strictEqual(safety.planTailRead(kept, 2000, 1500), '');
    assert.strictEqual(safety.tailIsStale(kept, 2000, 0), false);
});

test('borderline mail sends once each ten minutes and can lock, ban, or dismiss', function () {
    const now = 1_700_000_000_000;
    const first = safety.planBorderlineMail({}, now);
    assert.strictEqual(first.send, true);
    assert.strictEqual(first.batched, 0);
    const soon = safety.planBorderlineMail({ lastEmailAt: now, pending: 0 }, now + 60 * 1000);
    assert.strictEqual(soon.send, false);
    assert.strictEqual(soon.pending, 1);
    const later = safety.planBorderlineMail({ lastEmailAt: now, pending: 4 }, now + 10 * 60 * 1000);
    assert.strictEqual(later.send, true);
    assert.strictEqual(later.batched, 4);
    assert.strictEqual(safety.planBorderlineResolve('lock').applyLock, true);
    assert.strictEqual(safety.planBorderlineResolve('ban').ban, true);
    assert.strictEqual(safety.planBorderlineResolve('dismiss').status, 'dismissed');
    assert.strictEqual(safety.planBorderlineResolve('unlock').error, 'action');
    assert.strictEqual(safety.BORDERLINE_LABEL, 'Borderline buddy DM (not locked)');
    assert.strictEqual(safety.BORDERLINE_TTL_MS, 90 * 24 * 60 * 60 * 1000);
    assert.strictEqual(safety.snippetOf('abandon ability able about above absent absorb abstract absurd absent absorb abstract'), 'abandon [redacted 11 words]');
    assert.strictEqual(safety.snippetOf('xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jP'), '[redacted 1 words]');
    assert.strictEqual(safety.alreadyLockedFor({ lock: safety.publicLock(5) }), true);
    const firstTail = safety.planTailWrite('What is your seed phrase for?', 1000);
    const keptTail = safety.planTailWrite('thanks', 2000, firstTail.text);
    assert.ok(keptTail.text.indexOf('seed') !== -1);
    const follow = safety.detectBuddyRisk("send it to me, I'll check your answer", {
        previousText: keptTail.text,
        previousAt: 2000,
        now: 3000,
    });
    assert.strictEqual(follow.lock, true);
    const guess = safety.detectBuddyRisk('Give me your best guess', {
        previousText: keptTail.text,
        previousAt: 2000,
        now: 3000,
    });
    assert.strictEqual(guess.lock, false);
});

test('report limits count every type inside a rolling day', function () {
    const now = 1_700_000_000_000;
    assert.strictEqual(safety.shouldCountReport({ reporterUid: 'bob', reportedUid: 'alice', reason: 'spam' }), true);
    assert.strictEqual(safety.shouldCountReport({ reporterUid: 'bob', type: 'buddy', reason: 'buddy' }), true);
    assert.strictEqual(safety.shouldCountReport({ reporterUid: 'system', type: 'buddy_dm_flag' }), false);
    assert.strictEqual(safety.shouldCountReport({ reporterUid: 'bob', quotaAt: 5 }), false);
    const first = safety.planReportQuota({}, 'alice', now);
    assert.strictEqual(first.allow, true);
    assert.deepStrictEqual(first.hits, [now]);
    const same = safety.planReportQuota(first, 'alice', now + 1000);
    assert.strictEqual(same.allow, false);
    const nextDay = safety.planReportQuota(first, 'alice', now + 24 * 60 * 60 * 1000);
    assert.strictEqual(nextDay.allow, true);
    let state = { hits: [], targets: {} };
    ['a', 'b', 'c', 'd', 'e'].forEach(function (uid, index) {
        state = safety.planReportQuota(state, uid, now + index);
        assert.strictEqual(state.allow, true, uid);
    });
    const sixth = safety.planReportQuota(state, 'f', now + 10);
    assert.strictEqual(sixth.allow, false);
    const later = safety.planReportQuota(state, 'f', now + 24 * 60 * 60 * 1000);
    assert.strictEqual(later.allow, true);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
