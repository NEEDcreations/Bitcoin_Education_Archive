// Client notices cannot carry a target that becomes script, and the bell
// does not build onclick strings from notice fields.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const CLIENT_TYPES = ['dm', 'like', 'tip', 'mention', 'reply', 'forum', 'beats_track', 'pvp', 'buddy', 'comment', 'upvote', 'security', 'chat_mention', 'article', 'forum_post'];
const TARGET_TYPES = ['dm', 'forum_post', 'article', 'beats_track', 'marketplace', 'song', 'chat', 'pvp', 'buddy'];

function clientNoticeAllowed(data, authUid, notifId) {
    if (!data || typeof data !== 'object') return false;
    if (!ID_RE.test(notifId || '')) return false;
    const keys = Object.keys(data);
    const allowedKeys = ['recipientId', 'senderId', 'senderName', 'type', 'message', 'targetType', 'targetId', 'giftId', 'fromUid', 'read', 'createdAt'];
    if (keys.some(function(key) { return allowedKeys.indexOf(key) === -1; })) return false;
    if (!ID_RE.test(data.recipientId || '')) return false;
    if (data.senderId !== authUid) return false;
    if (typeof data.senderName !== 'string' || data.senderName.length < 1 || data.senderName.length > 40) return false;
    if (typeof data.message !== 'string' || data.message.length < 1 || data.message.length > 200) return false;
    if (CLIENT_TYPES.indexOf(data.type) === -1) return false;
    if (!(data.targetType == null || TARGET_TYPES.indexOf(data.targetType) !== -1)) return false;
    if (!(data.targetId == null || ID_RE.test(data.targetId))) return false;
    if (Object.prototype.hasOwnProperty.call(data, 'giftId') && !(data.giftId == null || ID_RE.test(data.giftId))) return false;
    if (Object.prototype.hasOwnProperty.call(data, 'fromUid') && !ID_RE.test(data.fromUid || '')) return false;
    if (data.read !== false) return false;
    const banned = ['xp', 'tickets', 'sats', 'points', 'orangeTickets', 'badgeId', 'freezes'];
    if (banned.some(function(key) { return Object.prototype.hasOwnProperty.call(data, key); })) return false;
    return true;
}

function baseNotice(extra) {
    return Object.assign({
        recipientId: 'user_abc',
        senderId: 'sender_1',
        senderName: 'Ada',
        type: 'dm',
        message: 'hello',
        targetType: 'dm',
        targetId: 'user_abc_sender_1',
        read: false,
    }, extra || {});
}

test('rules pin the id regex, target list, sender, and length caps', () => {
    const rules = read('firestore.rules');
    const block = rules.split('match /notifications/{notifId}').pop().split('match /polls/')[0];
    assert.ok(block.indexOf("v.matches('^[A-Za-z0-9_-]{1,64}$')") === -1);
    assert.ok(rules.indexOf("v.matches('^[A-Za-z0-9_-]{1,64}$')") !== -1);
    assert.ok(block.indexOf('notifIdOk(notifId)') !== -1);
    assert.ok(block.indexOf('notifIdOk(request.resource.data.recipientId)') !== -1);
    assert.ok(block.indexOf('notifIdOk(request.resource.data.targetId)') !== -1);
    assert.ok(block.indexOf('notifIdOk(request.resource.data.giftId)') !== -1);
    assert.ok(block.indexOf('request.resource.data.senderId == request.auth.uid') !== -1);
    assert.ok(block.indexOf("senderId == 'system'") === -1);
    assert.ok(block.indexOf('senderName.size() <= 40') !== -1);
    assert.ok(block.indexOf('message.size() <= 200') !== -1);
    TARGET_TYPES.forEach(function(type) {
        assert.ok(block.indexOf("'" + type + "'") !== -1, type);
    });
    assert.ok(block.indexOf("'badge'") === -1);
    assert.ok(block.indexOf("'level_up'") === -1);
    assert.ok(block.indexOf("'reward'") === -1);
});

test('malicious targetType, targetId, and giftId are rejected', () => {
    const uid = 'sender_1';
    const id = 'note_1';
    assert.strictEqual(clientNoticeAllowed(baseNotice(), uid, id), true);
    assert.strictEqual(clientNoticeAllowed(baseNotice({ targetType: "');alert(1)//" }), uid, id), false);
    assert.strictEqual(clientNoticeAllowed(baseNotice({ targetType: 'javascript' }), uid, id), false);
    assert.strictEqual(clientNoticeAllowed(baseNotice({ targetId: "');alert(1)//" }), uid, id), false);
    assert.strictEqual(clientNoticeAllowed(baseNotice({ targetId: '<img src=x onerror=alert(1)>' }), uid, id), false);
    assert.strictEqual(clientNoticeAllowed(baseNotice({ targetId: 'a'.repeat(65) }), uid, id), false);
    assert.strictEqual(clientNoticeAllowed(baseNotice({ giftId: "');alert(1)//" }), uid, id), false);
    assert.strictEqual(clientNoticeAllowed(baseNotice({ giftId: '../gift' }), uid, id), false);
    assert.strictEqual(clientNoticeAllowed(baseNotice({ senderId: 'system' }), uid, id), false);
    assert.strictEqual(clientNoticeAllowed(baseNotice({ senderId: 'someone_else' }), uid, id), false);
    assert.strictEqual(clientNoticeAllowed(baseNotice({ type: 'badge' }), uid, id), false);
    assert.strictEqual(clientNoticeAllowed(baseNotice({ type: 'level_up' }), uid, id), false);
    assert.strictEqual(clientNoticeAllowed(baseNotice({ xp: 50 }), uid, id), false);
    assert.strictEqual(clientNoticeAllowed(baseNotice({ message: 'x'.repeat(201) }), uid, id), false);
    assert.strictEqual(clientNoticeAllowed(baseNotice({ giftId: 'gift_abc' }), uid, id), true);
});

const src = read('notifications.js');
const start = src.indexOf('var NOTIF_TARGET_TYPES');
const end = src.indexOf('function notifAmountChips');
assert.ok(start > 0 && end > start);
const sandbox = { formatNotifTime: function() { return 'now'; }, notifIcon: function() { return '🔔'; }, notifAmountChips: function() { return ''; } };
vm.runInNewContext(src.slice(start, end), sandbox);

test('a malicious notice renders with no inline handler and no payload', () => {
    const attack = "');alert(1)//<img src=x onerror=alert(1)>";
    const html = sandbox.notifCardHtml('note_1', {
        type: 'gift_received',
        message: 'hello',
        targetType: attack,
        targetId: attack,
        giftId: attack,
        fromUid: attack,
        read: false,
    }, 'sheet');
    assert.ok(html.indexOf('onclick') === -1, html);
    assert.ok(html.indexOf('onmouseover') === -1, html);
    assert.ok(html.indexOf('alert') === -1, html);
    assert.ok(html.indexOf('<img') === -1, html);
    assert.ok(html.indexOf('notif-open-gift') === -1, html);
    assert.ok(html.indexOf('data-target-type=""') !== -1, html);
    assert.ok(html.indexOf('data-target-id=""') !== -1, html);
    assert.strictEqual(sandbox.notifSafeTarget(attack, attack).type, '');
    assert.strictEqual(sandbox.notifSafeId(attack, 64), false);
});

test('a safe gift id is a data attribute, not an onclick string', () => {
    const html = sandbox.notifCardHtml('note_1', {
        type: 'gift_received',
        message: 'A gift',
        giftId: 'gift_abc',
        targetType: 'dm',
        targetId: 'user_a_user_b',
        read: false,
    }, 'panel');
    assert.ok(html.indexOf('onclick') === -1, html);
    assert.ok(html.indexOf('data-gift-id="gift_abc"') !== -1, html);
    assert.ok(html.indexOf('data-target-type="dm"') !== -1, html);
    assert.ok(html.indexOf('data-target-id="user_a_user_b"') !== -1, html);
    assert.ok(html.indexOf('class="notif-open-gift"') !== -1, html);
    assert.ok(src.indexOf('addEventListener') !== -1);
    assert.ok(src.indexOf("onclick=\"handleNotifClick") === -1);
    assert.ok(src.indexOf('openGiftModal(\'') === -1);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
