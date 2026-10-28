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
        'Send 0.01 BTC to bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4 and I will send back 0.02',
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
    assert.strictEqual(flagged.severity, 'medium');
    assert.ok(flagged.reasons.indexOf('unknown_link') !== -1);
    const giveaway = safety.detectBuddyRisk('giveaway, send 1000 sats to claim', {});
    assert.strictEqual(giveaway.lock, false);
    assert.strictEqual(giveaway.severity, 'medium');
    const bypasses = [
        'send me your mnemonic',
        'what are your 12 words?',
        'whats your seed phrase',
        'can you share the seed phrase with me',
        'I need your seed phrase to verify',
        'DM me your seed words',
        'give me ur 12 wrds',
        'Pay 5000 sats to bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
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
    assert.strictEqual(bare.severity, 'medium');
    const invoice = safety.detectBuddyRisk('lnbc2500n1pw5k8qapp5exampleinvoicepaymentrequest');
    assert.strictEqual(invoice.lock, false);
    assert.strictEqual(invoice.severity, 'medium');
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
    assert.strictEqual(link.severity, 'medium');
    assert.ok(link.reasons.indexOf('unknown_link') !== -1);
    const move = safety.detectBuddyRisk("let's continue on telegram", {});
    assert.strictEqual(move.lock, false);
    assert.ok(move.reasons.indexOf('off_platform') !== -1);
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

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
