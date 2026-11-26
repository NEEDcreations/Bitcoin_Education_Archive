#!/usr/bin/env node
// New-account sats claim requirements. Pure decisions plus source pins.
// The Firestore emulator case lives in tests/rules/claim-req-rules.js.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const claimReqs = require(path.join(root, 'functions', 'src', 'claimReqs'));

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

const START = claimReqs.CLAIM_REQS_START;
test('no account that exists before ship is affected', () => {
    for (const t of ['2025-01-01T00:00:00Z', '2026-10-26T21:00:00Z', '2026-10-30T12:00:00Z', '2026-11-04T23:00:00Z']) {
        assert.strictEqual(claimReqs.isExempt(Date.parse(t)), true, t);
    }
    if (claimReqs.CLAIM_REQS_START_ISO === claimReqs.CLAIM_REQS_START_UNSET_ISO) {
        assert.strictEqual(claimReqs.isExempt(Date.now()), true);
    }
});

test('start instant is the deploy constant', () => {
    // Set at ship time; until then the far-future placeholder exempts everyone.
    assert.ok(!Number.isNaN(START), 'cutoff must parse');
    assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(claimReqs.CLAIM_REQS_START_ISO));
    assert.strictEqual(START, Date.parse(claimReqs.CLAIM_REQS_START_ISO));
    assert.ok(START >= Date.parse('2026-11-04T00:00:00.000Z'), 'cutoff never before Phil\'s Nov 4 decision');
    assert.strictEqual(claimReqs.MIN_CHAT_CHARS, 3);
    const watchCredit = require(path.join(root, 'functions', 'src', 'tctvWatch'));
    assert.strictEqual(claimReqs.MIN_TCTV_SECONDS, watchCredit.CREDIT_SECONDS);
    assert.strictEqual(claimReqs.MIN_TCTV_SECONDS, 60);
});

test('exempt only when Auth creation is strictly before the start', () => {
    assert.strictEqual(claimReqs.isExempt(START - 1), true);
    assert.strictEqual(claimReqs.isExempt(START), false);
    assert.strictEqual(claimReqs.isExempt(START + 1), false);
    assert.strictEqual(claimReqs.isExempt(0), false);
    assert.strictEqual(claimReqs.isExempt(NaN), false);
    assert.strictEqual(claimReqs.isExempt(null), false);
    assert.strictEqual(claimReqs.isExempt(''), false);
    assert.deepStrictEqual(claimReqs.missingItems({}, START - 1), []);
    assert.deepStrictEqual(claimReqs.missingItems({ created: START + 999 }, START - 1), []);
});

test('a new account is missing each stamp until the server writes it', () => {
    const originals = require('../functions/src/tctvOriginals');
    assert.strictEqual(originals.taskEnabled(), false);
    // Library is thin: anti-bot step is a server-verified lesson or quiz, not dropped.
    assert.deepStrictEqual(claimReqs.missingItems({}, START), ['chat', 'learn']);
    assert.deepStrictEqual(claimReqs.missingItems({ claimReq: { chatAt: START } }, START), ['learn']);
    assert.deepStrictEqual(claimReqs.missingItems({ claimReq: { tctvAt: { seconds: 10 } } }, START), ['chat']);
    const done = { claimReq: { chatAt: 1, tctvAt: 1 } };
    assert.deepStrictEqual(claimReqs.missingItems(done, START), []);
    assert.deepStrictEqual(claimReqs.missingItems({ created: START - 1 }, START), ['chat', 'learn']);
    // No referral step: a stale referralAt stamp is irrelevant.
    assert.deepStrictEqual(claimReqs.missingItems({ claimReq: { referralAt: 1 } }, START), ['chat', 'learn']);
    assert.ok(!('referral' in claimReqs.ITEM_LABEL));
    originals.ORIGINALS.push({ id: 'tmp-test', title: 'tmp', durationSeconds: 600, rights: 'BQ' });
    try {
        assert.strictEqual(originals.taskEnabled(), true);
        assert.deepStrictEqual(claimReqs.missingItems({}, START), ['chat', 'tctv']);
        assert.deepStrictEqual(claimReqs.missingItems({ claimReq: { chatAt: START } }, START), ['tctv']);
        assert.deepStrictEqual(claimReqs.missingItems({ created: START - 1 }, START), ['chat', 'tctv']);
        assert.deepStrictEqual(claimReqs.missingItems({ claimReq: { referralAt: 1 } }, START), ['chat', 'tctv']);
    } finally {
        originals.ORIGINALS.pop();
        assert.strictEqual(originals.taskEnabled(), false);
    }
});

test('a server-written lesson or quiz satisfies the anti-bot step while Originals are thin', () => {
    const originals = require('../functions/src/tctvOriginals');
    assert.strictEqual(originals.taskEnabled(), false);
    assert.strictEqual(claimReqs.learnQualifies({ completedQuests: ['quest_fake'] }), false);
    assert.strictEqual(claimReqs.learnQualifies({ questsPassed: 1 }), true);
    assert.strictEqual(claimReqs.learnQualifies({ lqPassed: ['lq_what_is_bitcoin'] }), true);
    assert.strictEqual(claimReqs.learnQualifies({ lqPassed: 1 }), true);
    assert.strictEqual(claimReqs.learnQualifies({ lqPassed: [] }), false);
    assert.strictEqual(claimReqs.learnQualifies({ triviaCorrect: 1 }), false);
    assert.strictEqual(claimReqs.learnQualifies({ triviaCorrect: 2, questsPassed: 1 }), true);
    assert.strictEqual(claimReqs.learnQualifies({ triviaCorrect: 2, lqPassed: ['lq_mining'] }), true);
    assert.deepStrictEqual(claimReqs.missingItems({ claimReq: { chatAt: START }, questsPassed: 1 }, START), []);
    assert.deepStrictEqual(claimReqs.missingItems({ claimReq: { chatAt: START }, lqPassed: ['lq_what_is_bitcoin'] }, START), []);
    assert.deepStrictEqual(claimReqs.missingItems({ claimReq: { chatAt: START }, lqPassed: 1 }, START), []);
    assert.deepStrictEqual(claimReqs.missingItems({ claimReq: { chatAt: START }, triviaCorrect: 2 }, START), ['learn']);
    // learnAt has no writer and does not qualify.
    assert.deepStrictEqual(claimReqs.missingItems({ claimReq: { chatAt: START, learnAt: START } }, START), ['learn']);
    // Client-owned completedQuests must not satisfy the step.
    assert.deepStrictEqual(claimReqs.missingItems({ claimReq: { chatAt: START }, completedQuests: ['quest_x'] }, START), ['learn']);
    // Already-qualified accounts stay qualified after Originals go live.
    originals.ORIGINALS.push({ id: 'tmp-test', title: 'tmp', durationSeconds: 600, rights: 'BQ' });
    try {
        assert.deepStrictEqual(claimReqs.missingItems({ claimReq: { chatAt: START }, questsPassed: 1 }, START), []);
        assert.deepStrictEqual(claimReqs.missingItems({ claimReq: { chatAt: START }, lqPassed: ['lq_what_is_bitcoin'] }, START), []);
        assert.deepStrictEqual(claimReqs.missingItems({ claimReq: { chatAt: START, tctvAt: START } }, START), []);
        assert.deepStrictEqual(claimReqs.missingItems({ claimReq: { chatAt: START, learnAt: START } }, START), ['tctv']);
        assert.deepStrictEqual(claimReqs.missingItems({ claimReq: { chatAt: START } }, START), ['tctv']);
    } finally {
        originals.ORIGINALS.pop();
    }
});

test('the claim error names only the missing items', () => {
    const chatOnly = claimReqs.missingError(['chat']);
    assert.ok(chatOnly.includes('send 1 chat message'));
    assert.ok(!chatOnly.includes('Timechain'));
    assert.ok(!chatOnly.includes('referral'));
    const tvOnly = claimReqs.missingError(['tctv']);
    assert.ok(tvOnly.includes('watch Bitcoin Quest Originals for 60 seconds'));
    assert.ok(!tvOnly.includes('chat message'));
    const all = claimReqs.missingError(['chat', 'tctv']);
    assert.ok(all.indexOf('send 1 chat message') < all.indexOf('watch Bitcoin Quest Originals'));
    assert.ok(!all.includes('referral'));
    assert.ok(all.indexOf('Finish these before claiming:') === 0);
    const learnOnly = claimReqs.missingError(['learn']);
    assert.ok(learnOnly.includes('complete 1 lesson or quiz'));
    assert.ok(!learnOnly.includes('chat message'));
});

test('chat counts only a short real message the filter would keep', () => {
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'hi' }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'hey' }), true);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'hello there' }), true);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'fuck this place' }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'hey', deleted: true }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'hey', status: 'deleted' }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'nacho-bot', text: 'hello friends' }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'tg_123', text: 'hello friends' }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'hey', isNachoAuto: true }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'hey', source: 'telegram' }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'https://example.com' }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: '[link removed]' }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'aaaaaaa' }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'mail me at pleb@example.com' }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'double your bitcoin now' }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'hey', hidden: true }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'hey', moderated: true }), false);
    assert.strictEqual(claimReqs.chatQualifies({ uid: 'abc', text: 'hey', status: 'hidden' }), false);
});

test('a deleted or hidden chat message does not satisfy the requirement', () => {
    const kept = { uid: 'abc', text: 'hey' };
    const stamped = { uid: 'abc', claimReq: { chatAt: START, chatMsgId: 'msgOne', chatMsgIds: ['msgOne'] } };
    assert.strictEqual(claimReqs.chatRequirementMet(stamped, [{ id: 'msgOne', exists: false, data: null }]), false);
    assert.strictEqual(claimReqs.chatRequirementMet(stamped, [{ id: 'msgOne', exists: true, data: { uid: 'abc', text: 'hey', deleted: true } }]), false);
    assert.strictEqual(claimReqs.chatRequirementMet(stamped, [{ id: 'msgOne', exists: true, data: { uid: 'abc', text: 'hey', hidden: true } }]), false);
    assert.strictEqual(claimReqs.chatRequirementMet(stamped, [{ id: 'msgOne', exists: true, data: { uid: 'abc', text: 'hey', moderated: true } }]), false);
    assert.strictEqual(claimReqs.chatRequirementMet({ claimReq: { chatAt: START } }, []), false);
    assert.strictEqual(claimReqs.chatRequirementMet(stamped, [{ id: 'msgOne', exists: true, data: kept }]), true);
    const ids = claimReqs.nextChatMsgIds({ chatMsgIds: ['msgOne'] }, 'msgTwo');
    assert.deepStrictEqual(ids, ['msgOne', 'msgTwo']);
    const replaced = { uid: 'abc', claimReq: { chatAt: START, chatMsgId: 'msgTwo', chatMsgIds: ids } };
    assert.strictEqual(claimReqs.chatRequirementMet(replaced, [
        { id: 'msgOne', exists: false, data: null },
        { id: 'msgTwo', exists: true, data: kept },
    ]), true);
    const capped = claimReqs.nextChatMsgIds({ chatMsgIds: ['a1', 'b2', 'c3', 'd4', 'e5'] }, 'f6');
    assert.deepStrictEqual(capped, ['b2', 'c3', 'd4', 'e5', 'f6']);
});

test('a chat message counts only when its uid is the claimant', () => {
    const stamped = { uid: 'abc', claimReq: { chatAt: START, chatMsgId: 'msgOne', chatMsgIds: ['msgOne'] } };
    const kept = { uid: 'abc', text: 'hey' };
    assert.strictEqual(claimReqs.chatRequirementMet(stamped, [{ id: 'msgOne', exists: true, data: kept }]), true);
    assert.strictEqual(claimReqs.chatRequirementMet(stamped, [{ id: 'msgOne', exists: true, data: { uid: 'other', text: 'hey' } }]), false);
    assert.strictEqual(claimReqs.chatRequirementMet({ claimReq: stamped.claimReq }, [{ id: 'msgOne', exists: true, data: kept }]), false);
});

test('Timechain TV counts at one watch-credit block', () => {
    const watchCredit = require(path.join(root, 'functions', 'src', 'tctvWatch'));
    assert.strictEqual(claimReqs.tctvQualifies(watchCredit.CREDIT_SECONDS - 1), false);
    assert.strictEqual(claimReqs.tctvQualifies(59.9), false);
    assert.strictEqual(claimReqs.tctvQualifies(watchCredit.CREDIT_SECONDS), true);
    assert.strictEqual(claimReqs.tctvQualifies('60'), true);
    assert.strictEqual(claimReqs.tctvQualifies(30), false);
    assert.strictEqual(claimReqs.tctvQualifies(0), false);
    assert.strictEqual(claimReqs.tctvQualifies(null), false);
});

test('claimSats decides from Auth creation time and returns the missing list', () => {
    const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    const early = index.indexOf('const authCreatedMs = creationDate.getTime()');
    assert.ok(early !== -1);
    const earlyBlock = index.slice(early, early + 900);
    assert.ok(earlyBlock.includes('claimReqs.missingItems'));
    assert.ok(earlyBlock.includes('claimReqs.missingError'));
    assert.ok(earlyBlock.includes('success: false'));
    assert.ok(!earlyBlock.includes('user.created'));
    assert.ok(!earlyBlock.includes('.created'));
    const tx = index.indexOf('const claimCreatedMs = new Date(userRecord.metadata.creationTime).getTime()');
    assert.ok(tx !== -1);
    const txBlock = index.slice(tx, tx + 520);
    assert.ok(txBlock.includes('claimReqs.missingItems'));
    assert.ok(txBlock.includes('claimChatStillLive'));
    assert.ok(txBlock.includes('deny(claimReqs.missingError'));
    const chat = index.indexOf("exports.onChatMessageCreated");
    const chatBlock = index.slice(chat, chat + 2200);
    assert.ok(chatBlock.includes('claimReqs.chatQualifies'));
    assert.ok(chatBlock.includes("'claimReq.chatAt'"));
    assert.ok(chatBlock.includes("'claimReq.chatMsgId'"));
    assert.ok(chatBlock.includes("'claimReq.chatMsgIds'"));
    assert.ok(index.includes('claimChatStillLive'));
    assert.ok(index.includes('claimReqs.chatRequirementMet'));
    assert.ok(index.includes('claimChatStillLive(earlyUser, function (ref) { return ref.get(); }, uid)'));
    assert.ok(index.includes('claimChatStillLive(user, function (ref) { return t.get(ref); }, uid)'));
    assert.ok(index.includes('row.data.uid !== user.uid') || fs.readFileSync(path.join(root, 'functions', 'src', 'claimReqs.js'), 'utf8').includes('row.data.uid !== user.uid'));
    assert.ok(!index.includes('assessReward'));
    assert.ok(!index.includes('logReferralVisit'));
    assert.ok(!index.includes('claimReqVisit'));
    assert.strictEqual((index.match(/enforceAppCheck:\s*true/g) || []).length, 14);
});

test('watch heartbeat stamps server-side only and no referral-visit pieces remain', () => {
    const watch = fs.readFileSync(path.join(root, 'functions', 'tctv-watch-callable.js'), 'utf8');
    assert.ok(watch.includes('claimReqs.tctvQualifies(watchedSeconds)'));
    assert.ok(watch.includes("'claimReq.tctvAt'"));
    assert.ok(!fs.existsSync(path.join(root, 'functions', 'src', 'claimReqVisit.js')));
    const deletion = fs.readFileSync(path.join(root, 'functions', 'src', 'deleteAccount.js'), 'utf8');
    assert.ok(!deletion.includes('referral_visits'));
    const privacy = fs.readFileSync(path.join(root, 'privacy.html'), 'utf8');
    assert.ok(!privacy.includes('visit record'));
    const tickets = fs.readFileSync(path.join(root, 'tickets.js'), 'utf8');
    assert.ok(!tickets.includes('logReferralVisit'));
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const keysFn = rules.slice(rules.indexOf('function userProfileServerOnlyKeys()'), rules.indexOf('match /users/{userId}'));
    assert.ok(keysFn.includes("'claimReq'"));
    const blocked = rules.slice(rules.indexOf('function profileUpdateBlocked()'), rules.indexOf('function profileShapeOk()'));
    assert.ok(blocked.includes("'claimReq'"));
    const createRule = rules.slice(rules.indexOf('allow create: if request.auth != null'), rules.indexOf('allow update: if request.auth != null'));
    assert.ok(!createRule.includes("'claimReq'"));
    assert.ok(!rules.includes('referral_visits'));
    const pub = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    const fields = pub.slice(pub.indexOf('const PUBLIC_PROFILE_FIELDS'), pub.indexOf('exports.syncPublicProfile'));
    assert.ok(!fields.includes('claimReq'));
});

test('no #100 VPN hook or VPN copy ships with #126', () => {
    const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    assert.ok(!index.includes('assessReward'));
    assert.ok(!index.includes("require('./src/ipReputation')"));
    assert.ok(!index.includes('rewardGate'));
});

test('the Requirements card shows the chat and TCTV rows with Go', () => {
    const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
    const clientCut = ranking.match(/var CLAIM_REQS_START_ISO = '([^']+)'/);
    assert.ok(clientCut, 'client cutoff constant present');
    assert.strictEqual(clientCut[1], claimReqs.CLAIM_REQS_START_ISO, 'client and server cutoff must match');
    assert.ok(ranking.includes('Date.parse(CLAIM_REQS_START_ISO)'));
    assert.ok(ranking.includes('Send 1 message in Chat'));
    assert.ok(ranking.includes('Watch Bitcoin Quest Originals') || ranking.includes('Watch Timechain TV'));
    assert.ok(ranking.includes('Complete 1 lesson or quiz'));
    assert.ok(ranking.includes('Pass one learning quest or lesson'));
    assert.ok(!ranking.includes('or trivia quiz'));
    assert.ok(!ranking.includes('Share your referral link'));
    assert.ok(!ranking.includes('referralReqMet'));
    assert.ok(ranking.includes("go: 'openClaimChat()'"));
    assert.ok(ranking.includes("go: 'openClaimTv()'"));
    assert.ok(ranking.includes("go: 'openClaimLearn()'"));
    assert.ok(!ranking.includes('shareClaimReferral'));
    assert.ok(ranking.includes('var CLAIM_TCTV_SECONDS = 60'));
    assert.ok(ranking.includes("Watch at least ' + CLAIM_TCTV_SECONDS + ' seconds"));
    assert.ok(ranking.includes('class="claim-req-go"'));
    assert.ok(ranking.includes('width:auto;min-width:44px'));
    assert.ok(ranking.includes('white-space:nowrap'));
    assert.ok(ranking.includes('if (window._chatOverlayOpen) return;'));
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.ok(html.includes('.username-box button.claim-req-go { width: auto; min-width: 44px; max-width: 88px; white-space: nowrap;'));
    assert.strictEqual(html, fs.readFileSync(path.join(root, '404.html'), 'utf8'));
    assert.ok(ranking.includes("N/A · account before Nov 5"));
    assert.ok(ranking.includes('na: true'));
    assert.ok(ranking.includes("c.na ? '➖'"));
    assert.ok(!ranking.includes('if (!claimExempt)'));
    assert.ok(!ranking.includes('VPNs must be off'));
    assert.ok(ranking.includes('color:var(--text-muted)'));
    assert.ok(!ranking.includes('copyClaimReferralLink'));
    assert.ok(!ranking.includes('logReferralVisit'));
});

if (failed) {
    console.log(failed + ' failed, ' + passed + ' passed');
    process.exit(1);
}
console.log(passed + ' passed');
