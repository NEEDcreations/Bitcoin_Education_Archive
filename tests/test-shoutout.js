// Nacho shoutout post decision. No Firebase.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    planShoutout,
    shoutoutText,
    applyShoutoutCap,
    SHOUTOUT_WINDOW_MS,
    SHOUTOUT_CONVERTED_MESSAGE,
} = require('../functions/src/shoutout');

let passed = 0, failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    }
}

test('a shoutout plans one visible Nacho message that tags the winner', function() {
    const plan = planShoutout({
        rewardType: 'nacho_shoutout',
        username: 'phil',
        uid: 'uid_phil',
        prizeId: 'gift_abc',
        banned: false,
        alreadyPosted: false,
    });
    assert.strictEqual(plan.post, true);
    assert.strictEqual(plan.collection, 'global_chat');
    assert.strictEqual(plan.authorUid, 'nacho-bot');
    assert.strictEqual(plan.authorName, 'Nacho 🦌');
    assert.strictEqual(plan.mentionUid, 'uid_phil');
    assert.strictEqual(plan.isNachoAuto, false);
    assert.strictEqual(plan.docId, 'shoutout_gift_abc');
    assert.strictEqual(plan.text, shoutoutText('phil'));
    assert.strictEqual(plan.text, '🎉 Shoutout to @phil! They just unlocked a rare Nacho Shoutout. Go send phil a peer request! 🤝');
    assert.strictEqual((plan.text.match(/@/g) || []).length, 1);
    assert.ok(plan.text.indexOf('@phil') !== -1);
    assert.ok(plan.text.indexOf('Go send phil a peer request') !== -1);
    assert.strictEqual(plan.text.indexOf('Go send @'), -1);
    assert.strictEqual(
        shoutoutText('Dihn Aviney'),
        '🎉 Shoutout to @Dihn Aviney! They just unlocked a rare Nacho Shoutout. Go send Dihn Aviney a peer request! 🤝'
    );
    const again = planShoutout({
        rewardType: 'nacho_shoutout',
        username: 'phil',
        uid: 'uid_phil',
        prizeId: 'gift_abc',
    });
    assert.strictEqual(again.docId, plan.docId);
});

test('the same prize is not posted twice', function() {
    const plan = planShoutout({
        rewardType: 'nacho_shoutout',
        username: 'phil',
        uid: 'uid_phil',
        prizeId: 'gift_abc',
        alreadyPosted: true,
    });
    assert.strictEqual(plan.post, false);
    assert.strictEqual(plan.reason, 'already_posted');
});

test('banned accounts are skipped', function() {
    const disabled = planShoutout({
        rewardType: 'nacho_shoutout',
        username: 'phil',
        uid: 'uid_phil',
        prizeId: 'gift_abc',
        banned: true,
    });
    assert.strictEqual(disabled.post, false);
    assert.strictEqual(disabled.reason, 'banned');
});

test('other rewards and missing ids do not post', function() {
    assert.strictEqual(planShoutout({ rewardType: 'tickets', uid: 'u', prizeId: 'g' }).reason, 'not_shoutout');
    assert.strictEqual(planShoutout({ rewardType: 'nacho_shoutout', uid: 'u', prizeId: '' }).reason, 'no_prize');
    assert.strictEqual(planShoutout({ rewardType: 'nacho_shoutout', uid: '', prizeId: 'g' }).reason, 'no_uid');
});

test('usernames are stripped before they go into chat', function() {
    const plan = planShoutout({
        rewardType: 'nacho_shoutout',
        username: 'phi\nl <script>',
        uid: 'uid_phil',
        prizeId: 'cipher_f6',
    });
    assert.strictEqual(plan.post, true);
    assert.ok(plan.text.indexOf('\n') === -1);
    assert.ok(plan.text.indexOf('<') === -1);
    assert.strictEqual(plan.docId, 'shoutout_cipher_f6');
});

test('cipher rewards do not roll a Nacho shoutout', function() {
    const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'cipherReward.js'), 'utf8');
    assert.ok(src.indexOf('nacho_shoutout') === -1, 'cipher odds must stay sats or XP/tickets');
});

test('a shoutout inside 7 days converts to 100 XP', function() {
    const now = 1700000000000;
    const recent = applyShoutoutCap({
        reward: { rewardType: 'nacho_shoutout', ownerId: 'uid_phil' },
        lastShoutoutAt: now - (SHOUTOUT_WINDOW_MS - 1),
        nowMs: now,
    });
    assert.strictEqual(recent.converted, true);
    assert.strictEqual(recent.awarded, false);
    assert.strictEqual(recent.reason, 'weekly_cap');
    assert.strictEqual(recent.reward.rewardType, 'xp_bonus');
    assert.strictEqual(recent.reward.xpAmount, 100);
    assert.strictEqual(recent.reward.shoutoutConverted, true);
    assert.strictEqual(recent.reward.conversionMessage, SHOUTOUT_CONVERTED_MESSAGE);
    assert.strictEqual(recent.reward.conversionMessage, "You already got a Nacho shoutout this week, so here's +100 XP!");
    const viaDate = applyShoutoutCap({
        reward: { rewardType: 'nacho_shoutout' },
        lastShoutoutAt: new Date(now - 60 * 1000),
        nowMs: now,
    });
    assert.strictEqual(viaDate.converted, true);
    const viaStamp = applyShoutoutCap({
        reward: { rewardType: 'nacho_shoutout' },
        lastShoutoutAt: { seconds: Math.floor((now - 1000) / 1000), nanoseconds: 0 },
        nowMs: now,
    });
    assert.strictEqual(viaStamp.converted, true);
});

test('the first shoutout in a week is awarded, including one from an older roll', function() {
    const now = 1700000000000;
    const stored = { rewardType: 'nacho_shoutout', rolledAt: '2026-10-01' };
    const first = applyShoutoutCap({ reward: stored, lastShoutoutAt: null, nowMs: now });
    assert.strictEqual(first.awarded, true);
    assert.strictEqual(first.converted, false);
    assert.strictEqual(first.reward, stored);
    const exact = applyShoutoutCap({
        reward: stored,
        lastShoutoutAt: now - SHOUTOUT_WINDOW_MS,
        nowMs: now,
    });
    assert.strictEqual(exact.awarded, true);
    assert.strictEqual(exact.converted, false);
    const older = applyShoutoutCap({
        reward: stored,
        lastShoutoutAt: { toMillis: function() { return now - SHOUTOUT_WINDOW_MS - 1; } },
        nowMs: now,
    });
    assert.strictEqual(older.awarded, true);
    const other = applyShoutoutCap({ reward: { rewardType: 'tickets', ticketCount: 2 }, nowMs: now });
    assert.strictEqual(other.reason, 'not_shoutout');
    assert.strictEqual(other.reward.rewardType, 'tickets');
});

test('openGift caps a stored shoutout and awardDailyGifts only rolls it', function() {
    const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'gifting.js'), 'utf8');
    const awardAt = src.indexOf('const awardDailyGifts =');
    const openAt = src.indexOf('const openGift =');
    const sendAt = src.indexOf('const sendKeys =');
    assert.ok(awardAt !== -1 && openAt > awardAt && sendAt > openAt);
    const award = src.slice(awardAt, openAt);
    const open = src.slice(openAt, sendAt);
    assert.ok(award.indexOf('rollGiftReward') !== -1);
    assert.strictEqual(award.indexOf('applyShoutoutCap'), -1);
    assert.ok(open.indexOf('applyShoutoutCap') !== -1);
    assert.ok(open.indexOf('user.lastShoutoutAt') !== -1);
    assert.ok(open.indexOf('userUpdate.lastShoutoutAt') !== -1);
    const capAt = open.indexOf('applyShoutoutCap');
    const announceAt = open.indexOf('maybeAnnounceShoutout');
    assert.ok(capAt !== -1 && announceAt > capAt);
    assert.ok(open.indexOf("rewardResult.rewardType === 'nacho_shoutout'") !== -1);
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    const keysFn = rules.slice(rules.indexOf('function userProfileServerOnlyKeys()'), rules.indexOf('match /users/{userId}'));
    assert.ok(keysFn.indexOf("'lastShoutoutAt'") !== -1);
    assert.ok(rules.indexOf('userProfileServerOnlyKeys()') !== -1);
    const client = fs.readFileSync(path.join(__dirname, '..', 'gifting.js'), 'utf8');
    assert.ok(client.indexOf('shoutoutConverted') !== -1);
    assert.ok(client.indexOf(SHOUTOUT_CONVERTED_MESSAGE) !== -1);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
