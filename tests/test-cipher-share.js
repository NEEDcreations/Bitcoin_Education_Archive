'use strict';

// Shared cipher rewards: one roll, one pay to each, and a sender the client cannot invent.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const share = require('../functions/src/cipherShare');

const root = path.join(__dirname, '..');
const NOW = Date.parse('2026-10-24T18:00:00.000Z');
const DAY = '2026-10-24';
const OLD = NOW - (10 * 24 * 60 * 60 * 1000);

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

function person(uid, extra) {
    return Object.assign({
        uid: uid,
        username: uid,
        created: OLD,
        peers: [],
        ciphersDecryptedDate: '',
        ciphersDecryptedToday: 0,
    }, extra || {});
}

function prizeXp() {
    return { rewardType: 'xp_tickets', xpAmount: 180, ticketCount: 4, roll: 5000 };
}

function prizeSats(amount) {
    return { rewardType: 'sats', satsAmount: amount, roll: 10 };
}

function input(extra) {
    const opener = person('opener', { peers: ['sender'], username: 'bea' });
    const sender = person('sender', { peers: ['opener'], username: 'ada' });
    return Object.assign({
        cipherId: 'cipher1',
        cipherLabel: '3A',
        openerUid: 'opener',
        openerUsername: 'bea',
        opener: opener,
        sender: sender,
        openerLedger: {},
        senderLedger: {},
        key: { status: 'sent', sender: 'sender', label: '3A', ownerId: 'opener' },
        requestSender: 'forged',
        reward: prizeXp(),
        nowMs: NOW,
        today: DAY,
        senderDailyXpUsed: 0,
    }, extra || {});
}

function books() {
    return { users: { sender: { points: 10, orangeTickets: 1 } }, daily: {}, wins: [], shares: {}, notices: [] };
}

test('a sent key pays the sender the same prize once, and a retry does not pay again', function () {
    const first = share.applyCipherShare(books(), input());
    assert.strictEqual(first.plan.pay, true);
    assert.strictEqual(first.plan.reason, 'ok');
    assert.strictEqual(first.plan.prize.xpAmount, 180);
    assert.strictEqual(first.plan.prize.ticketCount, 4);
    assert.strictEqual(first.plan.credit.xp, 180);
    assert.strictEqual(first.plan.credit.tickets, 4);
    assert.strictEqual(first.plan.credit.sats, 0);
    assert.strictEqual(first.books.users.sender.points, 190);
    assert.strictEqual(first.books.users.sender.orangeTickets, 5);
    assert.strictEqual(first.books.users.sender.ciphersDecryptedToday, 1);
    assert.strictEqual(first.books.notices.length, 1);
    assert.strictEqual(first.books.shares.cipher1.paid, true);
    assert.strictEqual(first.books.notices[0].type, 'cipher_share');
    assert.strictEqual(first.books.notices[0].status, 'completed');
    assert.ok(first.books.notices[0].message.indexOf('Your key opened @bea\'s cipher. You both won 180 XP and 4 tickets!') === 0);

    const again = share.applyCipherShare(first.books, input());
    assert.strictEqual(again.plan.pay, false);
    assert.strictEqual(again.plan.reason, 'already');
    assert.strictEqual(again.books.users.sender.points, 190);
    assert.strictEqual(again.books.users.sender.orangeTickets, 5);
    assert.strictEqual(again.books.users.sender.ciphersDecryptedToday, 1);
    assert.strictEqual(again.books.notices.length, 1);
    assert.strictEqual(again.books.wins.length, 0);

    const sats = share.applyCipherShare(books(), input({
        cipherId: 'cipherSats',
        reward: prizeSats(500),
    }));
    assert.strictEqual(sats.plan.pay, true);
    assert.strictEqual(sats.plan.credit.sats, 500);
    assert.strictEqual(sats.plan.credit.satsStatus, 'claimable');
    assert.strictEqual(sats.plan.credit.xp, 0);
    assert.strictEqual(sats.plan.credit.tickets, 0);
    assert.strictEqual(sats.books.wins.length, 1);
    assert.strictEqual(sats.books.wins[0].amount, 500);
    assert.strictEqual(sats.books.wins[0].roll, 10);
    const satsAgain = share.applyCipherShare(sats.books, input({
        cipherId: 'cipherSats',
        reward: prizeSats(500),
    }));
    assert.strictEqual(satsAgain.plan.reason, 'already');
    assert.strictEqual(satsAgain.books.wins.length, 1);
    assert.strictEqual(satsAgain.books.users.sender.points, 10);

    const big = share.planCipherShare(input({ reward: prizeSats(1000) }));
    assert.strictEqual(big.credit.sats, 1000);
    assert.strictEqual(big.credit.satsStatus, 'pending');
});

test('an ineligible sender is skipped and the prize is not credited', function () {
    function skipped(extra, reason) {
        const plan = share.planCipherShare(input(extra));
        assert.strictEqual(plan.pay, false, reason);
        assert.strictEqual(plan.reason, reason);
        assert.strictEqual(plan.credit.xp, 0);
        assert.strictEqual(plan.credit.tickets, 0);
        assert.strictEqual(plan.credit.sats, 0);
        const applied = share.applyCipherShare(books(), input(extra));
        assert.strictEqual(applied.books.users.sender.points, 10);
        assert.strictEqual(applied.books.notices.length, 0);
        assert.strictEqual(Object.keys(applied.books.shares).length, 0);
    }
    skipped({
        opener: person('opener', { peers: ['sender'], fingerprint: 'same' }),
        sender: person('sender', { peers: ['opener'], fingerprint: 'same' }),
    }, 'linked');
    skipped({
        sender: person('sender', { peers: ['opener'], linkedBanned: true }),
    }, 'linked');
    skipped({
        opener: person('opener', { peers: ['sender'], multiAccount: true }),
    }, 'linked');
    skipped({
        sender: person('sender', { peers: ['opener'], banned: true }),
    }, 'banned');
    skipped({
        opener: person('opener', { peers: ['sender'], ban_reason: 'farm' }),
    }, 'banned');
    skipped({
        openerLedger: { banned: true },
    }, 'banned');
    skipped({
        sender: person('sender', { peers: ['opener'], satsDisabled: true }),
    }, 'sats-disabled');
    skipped({
        opener: person('opener', { peers: ['sender'], satsDisabled: true }),
    }, 'sats-disabled');
    skipped({
        sender: person('sender', { peers: ['opener'], created: NOW - (2 * 24 * 60 * 60 * 1000) }),
    }, 'young');
    skipped({
        sender: person('sender', { peers: ['opener'], created: null }),
    }, 'young');
    skipped({
        opener: person('opener', { peers: [] }),
        sender: person('sender', { peers: ['opener'] }),
    }, 'not-peers');
    skipped({
        opener: person('opener', { peers: ['sender'] }),
        sender: person('sender', { peers: [] }),
    }, 'not-peers');
    skipped({
        sender: person('sender', {
            peers: ['opener'],
            ciphersDecryptedDate: DAY,
            ciphersDecryptedToday: 21,
        }),
    }, 'cap');
    const room = share.planCipherShare(input({
        sender: person('sender', {
            peers: ['opener'],
            ciphersDecryptedDate: DAY,
            ciphersDecryptedToday: 20,
        }),
    }));
    assert.strictEqual(room.pay, true);
    assert.strictEqual(room.credit.opensToday, 21);
    assert.strictEqual(room.credit.fullRing, true);
    const yesterday = share.planCipherShare(input({
        sender: person('sender', {
            peers: ['opener'],
            ciphersDecryptedDate: '2026-10-23',
            ciphersDecryptedToday: 21,
        }),
    }));
    assert.strictEqual(yesterday.pay, true);
    assert.strictEqual(yesterday.credit.opensToday, 1);
});

test('a key the user got themselves has no sender and pays only the opener', function () {
    const own = share.planCipherShare(input({
        key: { status: 'inventory', label: '3A', ownerId: 'opener', sentBy: null },
    }));
    assert.strictEqual(own.pay, false);
    assert.strictEqual(own.reason, 'no-sender');
    assert.strictEqual(share.senderFromKey({ status: 'inventory', sender: 'someone' }), '');
    assert.strictEqual(share.senderFromKey({ status: 'sent', sender: '' }), '');
    assert.strictEqual(share.senderFromKey({ status: 'sent', sentBy: 'old-sender' }), '');
    const self = share.planCipherShare(input({
        openerUid: 'sender',
        key: { status: 'sent', sender: 'sender', ownerId: 'sender' },
    }));
    assert.strictEqual(self.pay, false);
    assert.strictEqual(self.reason, 'self');
});

test('the client cannot forge the sender', function () {
    const forged = share.planCipherShare(input({
        key: { status: 'inventory', label: '3A', ownerId: 'opener' },
        requestSender: 'attacker',
    }));
    assert.strictEqual(forged.pay, false);
    assert.strictEqual(forged.reason, 'no-sender');
    assert.strictEqual(share.senderFromKey({ status: 'sent', sender: 'sender' }, { sender: 'attacker' }), 'sender');
    const swapped = share.planCipherShare(input({
        requestSender: 'attacker',
        key: { status: 'sent', sender: 'sender', label: '3A' },
    }));
    assert.strictEqual(swapped.pay, true);
    assert.strictEqual(swapped.senderUid, 'sender');
    assert.notStrictEqual(swapped.senderUid, 'attacker');

    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const keys = rules.slice(rules.indexOf('match /keys/{keyId}'), rules.indexOf('match /locked_ciphers/{cipherId}'));
    assert.ok(keys.includes('allow write: if false'));
    assert.ok(keys.indexOf('allow create') === -1);
    assert.ok(keys.indexOf('allow update') === -1);
    const deny = rules.slice(rules.indexOf('function profileUpdateBlocked()'), rules.indexOf('function profileShapeOk()'));
    assert.ok(deny.includes("'sender'"));
    const shares = rules.slice(rules.indexOf('match /cipher_shares/{shareId}'), rules.indexOf('match /peer_requests/{reqId}'));
    assert.ok(shares.includes('allow read, write: if false'));

    const src = fs.readFileSync(path.join(root, 'functions/src/gifting.js'), 'utf8');
    const open = src.slice(src.indexOf('const openGift'), src.indexOf('const sendKeys'));
    const keyCreate = open.slice(open.indexOf("reward.rewardType === 'keys'"));
    assert.ok(keyCreate.indexOf('sender:') === -1);
    const send = src.slice(src.indexOf('const sendKeys'), src.indexOf('const decryptCipher'));
    assert.ok(send.includes('sender: uid'));
    assert.ok(send.indexOf('data.sender') === -1);
    assert.ok(send.indexOf('sender: data') === -1);
    const decrypt = src.slice(src.indexOf('const decryptCipher'), src.indexOf('const claimCipherWin'));
    assert.ok(decrypt.includes('planCipherShare'));
    assert.ok(decrypt.includes('const sharedPrize = clonePrize(reward)'));
    assert.ok(decrypt.includes('reward: sharedPrize'));
    assert.ok(decrypt.includes("collection('cipher_shares')"));
    assert.ok(decrypt.includes('senderFromKey'));
    assert.ok(decrypt.indexOf('data.sender') === -1);
    assert.ok(decrypt.indexOf('sendUserPush') === -1);
    assert.ok(src.includes('const ackCipherShare'));
    assert.ok(src.includes('revealed: true'));
});

test('sender XP uses the shared roll and the same daily taper', function () {
    const full = share.planCipherShare(input({ senderDailyXpUsed: 0 }));
    assert.strictEqual(full.credit.xp, full.prize.xpAmount);
    const capped = share.planCipherShare(input({ senderDailyXpUsed: 1000 }));
    assert.strictEqual(capped.pay, true);
    assert.strictEqual(capped.prize.xpAmount, 180);
    assert.strictEqual(capped.credit.xp, 0);
    assert.strictEqual(capped.credit.tickets, 4);
    assert.strictEqual(capped.notice.prizeXp, 180);
    assert.ok(capped.notice.message.indexOf('180 XP and 4 tickets') !== -1);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
