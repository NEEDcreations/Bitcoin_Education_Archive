// Resolved action notices: pills replace buttons, live state fills in when
// the server has not stamped the doc yet, and the stamp cannot grant rewards.
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

const src = read('notifications.js');
const start = src.indexOf('var NOTIF_TARGET_TYPES');
const end = src.indexOf('function notifAmountChips');
assert.ok(start > 0 && end > start);
const sandbox = {
    formatNotifTime: function() { return 'now'; },
    notifIcon: function() { return '🔔'; },
    notifAmountChips: function() { return ''; },
};
vm.runInNewContext(src.slice(start, end), sandbox);

function card(n, live) {
    return sandbox.notifCardHtml('note_1', n, 'sheet', live);
}

function assertPill(html, label) {
    assert.ok(html.indexOf('notif-status-pill') !== -1, html);
    assert.ok(html.indexOf(label) !== -1, html);
    assert.ok(html.indexOf('notif-peer-btn') === -1, html);
    assert.ok(html.indexOf('notif-open-gift') === -1, html);
    assert.ok(html.indexOf('notif-keys-btn') === -1, html);
    assert.ok(html.indexOf('notif-go-btn') === -1, html);
    assert.ok(html.indexOf('onclick') === -1, html);
    assert.ok(html.indexOf('data-unread="0"') !== -1, html);
    assert.ok(html.indexOf('opacity:0.72') !== -1, html);
}

test('a stored resolved value replaces the buttons and dims the row', () => {
    const html = card({
        type: 'peer_request',
        message: 'Alias sent you a peer request',
        fromUid: 'alias_uid',
        targetId: 'alias_uid_me',
        resolved: 'accepted',
        read: false,
    });
    assertPill(html, 'Accepted ✓');
    assert.ok(html.indexOf('data-resolved="accepted"') !== -1, html);
    assert.strictEqual(sandbox.notifActionState({ type: 'peer_request', resolved: 'declined', fromUid: 'alias_uid' }, {
        peerRequests: { alias_uid_me: { status: 'pending' } },
        myUid: 'me',
    }), 'declined');
});

test('old peer notices fall back to the request doc and the peer list', () => {
    const base = { type: 'peer_request', message: 'Alias sent you a peer request', fromUid: 'alias_uid', targetId: 'alias_uid_me', read: false };
    const pending = card(base, { myUid: 'me', peerRequests: { alias_uid_me: { status: 'pending' } }, peers: {} });
    assert.ok(pending.indexOf('notif-peer-btn') !== -1, pending);
    assert.ok(pending.indexOf('data-peer-action="accept"') !== -1, pending);
    assert.ok(pending.indexOf('data-peer-action="decline"') !== -1, pending);
    assert.ok(pending.indexOf('notif-status-pill') === -1, pending);
    assert.ok(pending.indexOf('onclick') === -1, pending);

    const accepted = card(base, { myUid: 'me', peers: { alias_uid: true }, peerRequests: { alias_uid_me: null } });
    assertPill(accepted, 'Accepted ✓');

    const gone = card(base, { myUid: 'me', peers: {}, peerRequests: { alias_uid_me: null } });
    assertPill(gone, 'Expired');

    const unknown = card(base, { myUid: 'me' });
    assert.ok(unknown.indexOf('notif-peer-btn') !== -1, unknown);
});

test('gift and key notices follow opened, claimed, and expired', () => {
    const gift = { type: 'gift_received', message: 'orto sent you a gift!', giftId: 'gift_abc', read: false };
    assert.ok(card(gift, { gifts: { gift_abc: { status: 'sent' } } }).indexOf('notif-open-gift') !== -1);
    assertPill(card(gift, { gifts: { gift_abc: { status: 'opened' } } }), 'Opened ✓');
    assertPill(card(gift, { gifts: { gift_abc: { status: 'claimed' } } }), 'Already claimed');
    assertPill(card(gift, { gifts: { gift_abc: null } }), 'Expired');
    assert.ok(card(gift, {}).indexOf('notif-open-gift') !== -1);

    const keys = { type: 'keys_received', message: 'keys', keyIds: ['k1', 'k2'], read: true };
    assert.ok(card(keys, { keys: { k1: { status: 'consumed' }, k2: { status: 'sent' } } }).indexOf('notif-keys-btn') !== -1);
    assertPill(card(keys, { keys: { k1: { status: 'consumed' }, k2: { status: 'consumed' } } }), 'Already claimed');
    assertPill(card(keys, { keys: { k1: { status: 'consumed' }, k2: null } }), 'Expired');
    assertPill(card({ type: 'keys_received', fromUid: 'sender_1', read: true }, {
        keysBySender: { sender_1: { total: 2, open: 0 } },
    }), 'Already claimed');
});

test('pvp, buddy, marketplace, and dm notices stop prompting when the source is done', () => {
    const invite = { type: 'pvp', message: 'PvP invite', targetType: 'pvp', targetId: 'match_1', read: false };
    assert.ok(card(invite, { matches: { match_1: { status: 'active' } }, lobbies: { match_1: null } }).indexOf('notif-go-btn') !== -1);
    assertPill(card(invite, { matches: { match_1: { status: 'finished' } }, lobbies: { match_1: null } }), 'Joined ✓');
    assertPill(card(invite, { matches: { match_1: null }, lobbies: { match_1: null } }), 'Expired');

    const buddy = { type: 'buddy', message: 'Buddy', targetType: 'buddy', targetId: 'other_uid', read: false };
    assert.ok(card(buddy, { buddies: { other_uid: { waiting: true } } }).indexOf('notif-status-pill') === -1);
    assertPill(card(buddy, { buddies: { other_uid: { matched: true } } }), 'Matched ✓');
    assertPill(card(buddy, { buddies: { other_uid: null } }), 'Expired');

    const market = { type: 'dm', message: 'interested', targetType: 'marketplace', targetId: 'list_1', read: false };
    assert.ok(card(market, { listings: { list_1: { status: 'active' } } }).indexOf('notif-status-pill') === -1);
    assertPill(card(market, { listings: { list_1: { status: 'sold' } } }), 'Sold');
    assertPill(card(market, { listings: { list_1: null } }), 'Expired');

    const dm = { type: 'dm', message: 'New message', targetType: 'dm', targetId: 'convo_1', read: false };
    assert.ok(card(dm, { convos: { convo_1: { unread: 2 } } }).indexOf('notif-status-pill') === -1);
    assert.ok(card(dm, { convos: { convo_1: { unread: 2 } } }).indexOf('data-unread="1"') !== -1);
    assertPill(card(dm, { convos: { convo_1: { unread: 0 } } }), 'Read');
});

test('a forged resolved string is ignored and cannot break out of the attribute', () => {
    const attack = 'accepted"><img src=x onerror=alert(1)>';
    const html = card({
        type: 'gift_received',
        message: 'hello',
        giftId: 'gift_abc',
        resolved: attack,
        read: false,
    }, { gifts: { gift_abc: { status: 'sent' } } });
    assert.ok(html.indexOf('onclick') === -1, html);
    assert.ok(html.indexOf('<img') === -1, html);
    assert.ok(html.indexOf('onerror') === -1, html);
    assert.ok(html.indexOf('data-resolved') === -1, html);
    assert.ok(html.indexOf('notif-open-gift') !== -1, html);
    assert.strictEqual(sandbox.notifStoredResolved({ resolved: attack }), '');
    assert.strictEqual(sandbox.notifStoredResolved({ resolved: 'opened' }), 'opened');
});

test('the panel updates a row before the call and restores it if the call fails', () => {
    const peer = src.slice(src.indexOf('window.handlePeerNotifAction'), src.indexOf('window.handleNotifClick'));
    assert.ok(peer.indexOf('notifOptimistic(notifId, state)') < peer.indexOf('httpsCallable'), peer);
    assert.ok(peer.indexOf('notifRollback(notifId)') !== -1, peer);
    assert.ok(peer.indexOf('row.remove()') === -1, peer);
    const gift = src.slice(src.indexOf('async function notifOpenGift'), src.indexOf('function notifAmountChips') === -1 ? src.length : src.indexOf('// Show notifications panel'));
    assert.ok(src.indexOf('async function notifOpenGift') !== -1);
    assert.ok(src.indexOf("notifOptimistic(notifId, 'opened')") < src.indexOf("httpsCallable('openGift')"));
    assert.ok(src.indexOf('window.revealNotifGift') < src.indexOf("httpsCallable('openGift')"));
    assert.ok(src.indexOf('notifRewardLabel(rw)') !== -1);
    assert.ok(src.indexOf('notifRollback(notifId)') !== -1);
    assert.ok(src.indexOf('openGiftModal(\'') === -1);
    assert.strictEqual(sandbox.notifRewardLabel({ rewardType: 'tickets', ticketCount: 3 }), '+3 Orange Tickets');
    assert.strictEqual(sandbox.notifRewardLabel({ rewardType: 'xp_bonus', xpAmount: 50 }), '+50 XP');
    const gifting = read('gifting.js');
    assert.ok(gifting.indexOf('window.revealNotifGift') !== -1);
    assert.ok(gifting.indexOf("_toast('🎁 ' + _rewardLabel(rw)") !== -1);
});

test('server stamps are display-only and clients still cannot write resolved', () => {
    const lib = require('../functions/src/notifResolved');
    const patch = lib.resolvedPatch('opened', 'ts');
    assert.deepStrictEqual(Object.keys(patch).sort(), ['read', 'resolved', 'resolvedAt']);
    assert.strictEqual(patch.resolved, 'opened');
    assert.strictEqual(lib.resolvedPatch('free-tickets', 'ts'), null);
    assert.deepStrictEqual(lib.pickNotifs([
        { id: 'n1', data: { type: 'gift_received', recipientId: 'me', giftId: 'g1' } },
        { id: 'n2', data: { type: 'gift_received', recipientId: 'other', giftId: 'g1' } },
        { id: 'n3', data: { type: 'gift_received', recipientId: 'me', giftId: 'g1', resolved: 'opened' } },
        { id: 'bad id', data: { type: 'gift_received', recipientId: 'me', giftId: 'g1' } },
    ], { type: 'gift_received', recipientId: 'me', giftId: 'g1', state: 'opened' }), ['n1']);
    assert.strictEqual(lib.keysStillOpen([
        { exists: true, data: { status: 'consumed' } },
        { exists: false, data: null },
    ]), false);
    assert.strictEqual(lib.keysStillOpen([{ exists: true, data: { status: 'sent' } }]), true);

    const reward = read('functions/src/rewardNotify.js');
    assert.ok(!/resolved/.test(reward), 'reward notices must not read resolved');
    const rules = read('firestore.rules');
    const block = rules.split('match /notifications/{notifId}').pop().split('match /polls/')[0];
    assert.ok(block.indexOf("affectedKeys().hasOnly(['read'])") !== -1);
    assert.ok(block.indexOf("'resolved'") === -1 || block.indexOf('server-only') !== -1);
    ['managePeer', 'openGift', 'decryptCipher', 'pvpResolveRound'].forEach(function(name) {
        const hit = [read('functions/index.js'), read('functions/src/gifting.js'), read('functions/src/pvpResolve.js')].join('\n');
        assert.ok(hit.indexOf('notifResolved.') !== -1, name);
    });
    assert.ok(read('functions/index.js').indexOf("state: 'accepted'") !== -1);
    assert.ok(read('functions/index.js').indexOf("state: 'declined'") !== -1);
    assert.ok(read('functions/src/gifting.js').indexOf("state: 'opened'") !== -1);
    assert.ok(read('functions/src/gifting.js').indexOf('stampConsumedKey') !== -1);
    assert.ok(read('functions/src/gifting.js').indexOf('keyIds: keyIds') !== -1);
    const pvp = read('functions/src/pvpResolve.js');
    assert.ok(pvp.indexOf("data.status === 'finished' ? 'joined' : 'expired'") !== -1);
    assert.ok(pvp.indexOf('beforeStatus !== data.status') !== -1);
    assert.ok(pvp.indexOf('recipientId: recipientId') !== -1);
    const peers = read('functions/index.js');
    assert.ok(peers.indexOf('recipientId: uid') !== -1);
    assert.ok(peers.indexOf('recipientId: targetUid') !== -1);
    assert.ok(src.indexOf('NOTIF_LOOK_TTL = 60000') !== -1);
    assert.ok(src.indexOf('NOTIF_LIVE_CAP = 15') !== -1);
    assert.ok(src.indexOf(".orderBy('createdAt', 'desc')") !== -1);
    assert.ok(src.indexOf('db.batch()') !== -1);
    assert.ok(src.indexOf('permission-denied') !== -1);
    assert.ok(src.indexOf('.limit(80)') === -1);
    assert.ok(src.indexOf('.slice(0, 40)') === -1);
});

test('a denied or missing source read is expired and stamps stay on the recipient', () => {
    assert.strictEqual(sandbox.notifReadDenied({ code: 'permission-denied' }), true);
    assert.strictEqual(sandbox.notifReadDenied({ code: 'unavailable' }), false);
    assert.strictEqual(sandbox.notifLiveState({
        type: 'dm', targetType: 'dm', targetId: 'convo_gone',
    }, { convos: { convo_gone: null }, myUid: 'me' }), 'expired');
});

const lib = require('../functions/src/notifResolved');
const wheres = [];
const query = {
    where: function(field, op, value) { wheres.push([field, op, value]); return query; },
    limit: function() { return query; },
    get: function() { return Promise.resolve({ docs: [] }); },
};
lib.stampMatching({ collection: function() { return query; } }, {
    state: 'accepted',
    whereField: 'fromUid',
    whereValue: 'alice',
    recipientId: 'bob',
    timestamp: 'ts',
}).then(function() {
    try {
        assert.deepStrictEqual(wheres, [['fromUid', '==', 'alice'], ['recipientId', '==', 'bob']]);
        console.log('✅ fallback lookup is limited to the recipient');
        passed++;
    } catch (e) {
        console.log('❌ fallback lookup is limited to the recipient: ' + e.message);
        failed++;
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
}).catch(function(e) {
    console.log('❌ fallback lookup is limited to the recipient: ' + e.message);
    process.exit(1);
});
