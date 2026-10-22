// Nacho shoutout post decision. No Firebase.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { planShoutout, shoutoutText } = require('../functions/src/shoutout');

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
    assert.ok(plan.text.indexOf('@phil') !== -1);
    assert.ok(plan.text.indexOf('peer request') !== -1);
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

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
