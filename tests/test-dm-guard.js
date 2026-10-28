#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const guard = require('../functions/src/dmGuard');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        const out = fn();
        if (out && typeof out.then === 'function') {
            return out.then(function () { console.log('✅ ' + name); passed++; }, function (e) {
                console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e));
                failed++;
            });
        }
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e));
        failed++;
    }
    return Promise.resolve();
}

function flagged(text, imageUrl) {
    const hit = guard.scoreDmText(text, imageUrl);
    assert.ok(hit.over, JSON.stringify(hit) + ' :: ' + text);
    return hit;
}
function clean(text, imageUrl) {
    const hit = guard.scoreDmText(text, imageUrl);
    assert.strictEqual(hit.over, false, JSON.stringify(hit) + ' :: ' + text);
    return hit;
}

const SEED12 = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
const WIF = 'K' + 'A'.repeat(51);
const root = path.join(__dirname, '..');

function memoryDb(initial) {
    const store = new Map();
    Object.keys(initial || {}).forEach(function (key) { store.set(key, initial[key]); });
    function apply(docPath, data, opts) {
        const prev = store.has(docPath) ? Object.assign({}, store.get(docPath)) : {};
        const next = opts && opts.merge ? prev : {};
        Object.keys(data).forEach(function (key) {
            const value = data[key];
            if (value && value.__op === 'delete') { delete next[key]; return; }
            next[key] = value;
        });
        store.set(docPath, next);
    }
    function docRef(docPath) {
        return {
            get: async function () {
                return { exists: store.has(docPath), data: function () { return store.get(docPath); }, id: docPath.split('/').pop() };
            },
            set: async function (data, opts) { apply(docPath, data, opts); }
        };
    }
    function query(col, filters) {
        const api = {
            where: function (field, op, value) { return query(col, filters.concat([{ field: field, op: op, value: value }])); },
            orderBy: function () { return api; },
            limit: function () { return api; },
            get: async function () {
                const docs = [];
                store.forEach(function (data, key) {
                    const prefix = col + '/';
                    if (key.indexOf(prefix) !== 0) return;
                    if (key.slice(prefix.length).indexOf('/') !== -1) return;
                    let ok = true;
                    filters.forEach(function (f) {
                        if (f.op === 'array-contains' && (data[f.field] || []).indexOf(f.value) === -1) ok = false;
                    });
                    if (ok) docs.push({ id: key.split('/').pop(), data: function () { return data; } });
                });
                return { empty: docs.length === 0, docs: docs, forEach: function (fn) { docs.forEach(fn); } };
            }
        };
        return api;
    }
    return {
        store: store,
        collection: function (name) {
            return {
                doc: function (id) { return docRef(name + '/' + id); },
                where: function (field, op, value) { return query(name, [{ field: field, op: op, value: value }]); }
            };
        }
    };
}

const admin = {
    firestore: {
        FieldValue: {
            serverTimestamp: function () { return { __op: 'time' }; },
            delete: function () { return { __op: 'delete' }; }
        }
    }
};

function authOf(map) {
    return {
        getUser: async function (uid) {
            if (!map[uid]) {
                const err = new Error('missing');
                err.code = 'auth/user-not-found';
                throw err;
            }
            return map[uid];
        }
    };
}

function eventFor(cid, mid, msg) {
    return { params: { cid: cid, mid: mid }, data: { data: function () { return msg; } } };
}

(async function main() {
    const positives = [
        ['send me your seed', 'seed_request'],
        ["what's your recovery phrase", 'seed_request'],
        ['paste your 12 words here', 'seed_request'],
        ['send me your s33d phrase', 'seed_request'],
        ['send me your private key', 'private_key_request'],
        ['enter your private key on this website', 'private_key_request'],
        ['my key is ' + WIF, 'private_key_material'],
        [SEED12, 'seed_paste'],
        ["I'm Bitcoin Quest support. Verify your wallet or your account will be locked.", 'admin_impersonation'],
        ['your account has been suspended. Click to verify your wallet.', 'admin_impersonation'],
        ['https://claim-airdrop.xyz/connect', 'drainer_domain'],
        ['https://metamask-secure.io/login', 'phishing_link'],
        ['verify your wallet https://bit.ly/freebtc', 'short_link'],
        ['https://bit.ly/x', 'short_link'],
        ["send me 10000 sats and I'll double it", 'double_scam'],
        ['pay this invoice to unlock your withdrawal', 'invoice_scam']
    ];
    for (let i = 0; i < positives.length; i++) {
        await test('flags ' + positives[i][0].slice(0, 48), function () {
            const hit = flagged(positives[i][0]);
            assert.ok(hit.reasons.indexOf(positives[i][1]) !== -1, hit.reasons.join(','));
        });
    }

    const negatives = [
        'seed',
        'What is a seed phrase?',
        'A seed phrase is 12 or 24 words you write on paper.',
        'Never share your seed phrase or private key.',
        'A private key is a secret number. A public key is derived from it.',
        'type your seed phrase onto paper',
        'paste your 12 words onto a metal plate',
        'enter your private key on the hardware wallet',
        'The halving does not double the supply.',
        'Never send sats to someone who says they will double them.',
        "Why do scammers say send me sats and I'll double it?",
        'How do I contact support?',
        "I'm an admin of our local meetup this weekend.",
        'Bitcoin Quest support will never ask for your seed phrase.',
        'A lightning invoice starts with lnbc and is how you request a payment.',
        'Read the whitepaper at https://bitcoin.org/bitcoin.pdf',
        'https://metamask.io/download',
        'Great essay on cold storage https://bit.ly/coldstore-notes',
        'The BIP39 test vector people quote in lessons starts with abandon ability able about above absent absorb abstract absurd abuse access accident and it is only an example.'
    ];
    for (let n = 0; n < negatives.length; n++) {
        await test('allows ' + negatives[n].slice(0, 48), function () { clean(negatives[n]); });
    }

    await test('image-only drainer still scores', function () {
        const hit = flagged('', 'https://claim-airdrop.xyz/a.png');
        assert.ok(hit.reasons.indexOf('drainer_domain') !== -1);
    });

    await test('excerpt stays within 200 characters', function () {
        const long = 'send me your seed ' + 'x'.repeat(400);
        assert.ok(guard.excerptOf(long).length <= 200);
        assert.ok(guard.excerptOf(long).indexOf('@') === -1);
    });

    await test('rate signal pauses a new account messaging many people', function () {
        const now = Date.now();
        const docs = [];
        for (let i = 0; i < 5; i++) {
            docs.push({
                participants: ['sender0001', 'user' + i + 'xxxx'],
                lastSenderUid: 'sender0001',
                lastMessage: 'hello from the meetup ' + i,
                lastMessageTime: { toMillis: function () { return now - 1000; } }
            });
        }
        const hit = guard.rateSignals(docs, 'sender0001', now, now - 60 * 60 * 1000);
        assert.ok(hit.reasons.indexOf('mass_dm_new_account') !== -1);
        assert.ok(hit.score >= guard.SCORE_THRESHOLD);
    });

    await test('an older account can message several people', function () {
        const now = Date.now();
        const docs = [];
        for (let i = 0; i < 5; i++) {
            docs.push({
                participants: ['sender0001', 'user' + i + 'xxxx'],
                lastSenderUid: 'sender0001',
                lastMessage: 'hello from the meetup ' + i,
                lastMessageTime: { toMillis: function () { return now - 1000; } }
            });
        }
        const hit = guard.rateSignals(docs, 'sender0001', now, now - 30 * 24 * 60 * 60 * 1000);
        assert.deepStrictEqual(hit.reasons, []);
    });

    await test('identical text to many recipients pauses any account', function () {
        const now = Date.now();
        const docs = [];
        for (let i = 0; i < 4; i++) {
            docs.push({
                participants: ['sender0001', 'user' + i + 'xxxx'],
                lastSenderUid: 'sender0001',
                lastMessage: 'are you going to the meetup on saturday',
                lastMessageTime: { toMillis: function () { return now - 1000; } }
            });
        }
        const hit = guard.rateSignals(docs, 'sender0001', now, now - 30 * 24 * 60 * 60 * 1000);
        assert.ok(hit.reasons.indexOf('identical_blast') !== -1);
    });

    await test('three copies of the same note stay under the blast line', function () {
        const now = Date.now();
        const docs = [];
        for (let i = 0; i < 3; i++) {
            docs.push({
                participants: ['sender0001', 'user' + i + 'xxxx'],
                lastSenderUid: 'sender0001',
                lastMessage: 'are you going to the meetup on saturday',
                lastMessageTime: { toMillis: function () { return now - 1000; } }
            });
        }
        const hit = guard.rateSignals(docs, 'sender0001', now, 0);
        assert.deepStrictEqual(hit.reasons, []);
    });

    await test('trigger writes a flag and pauses the sender', async function () {
        const db = memoryDb({
            'dm_conversations/alice0001_bob0000001': { participants: ['alice0001', 'bob0000001'] },
            'users/alice0001': { username: 'alice' }
        });
        const result = await guard.handleDmMessageCreated({
            db: db,
            admin: admin,
            auth: authOf({ alice0001: { metadata: { creationTime: '2020-01-01T00:00:00.000Z' } }, bob0000001: {} })
        }, eventFor('alice0001_bob0000001', 'm1', { senderUid: 'alice0001', senderName: 'Alice Example', text: 'send me your seed phrase' }));
        assert.strictEqual(result.flagged, true);
        const user = db.store.get('users/alice0001');
        assert.strictEqual(user.dmDisabled, true);
        assert.ok(String(user.dmDisabledReason).indexOf('seed_request') !== -1);
        const flag = db.store.get('admin_dm_flags/alice0001_bob0000001_m1');
        assert.ok(flag);
        assert.strictEqual(flag.alerted, false);
        assert.strictEqual(flag.senderUid, 'alice0001');
        assert.strictEqual(flag.recipientUid, 'bob0000001');
        assert.ok(flag.excerpt.length <= 200);
        assert.strictEqual(flag.senderName, undefined);
        assert.strictEqual(flag.email, undefined);
        assert.ok(JSON.stringify(flag).indexOf('Alice') === -1);
        assert.strictEqual(db.store.has('admin_dm_alerts/alice0001_bob0000001_m1'), false);
    });

    await test('a second delivery does not duplicate the flag', async function () {
        const db = memoryDb({
            'dm_conversations/alice0001_bob0000001': { participants: ['alice0001', 'bob0000001'] }
        });
        const deps = { db: db, admin: admin, auth: authOf({}) };
        const ev = eventFor('alice0001_bob0000001', 'm2', { senderUid: 'alice0001', text: 'send me your private key' });
        await guard.handleDmMessageCreated(deps, ev);
        await guard.handleDmMessageCreated(deps, ev);
        const flags = [];
        db.store.forEach(function (value, key) { if (key.indexOf('admin_dm_flags/') === 0) flags.push(key); });
        assert.strictEqual(flags.length, 1);
        assert.strictEqual(db.store.get(flags[0]).alerted, false);
    });

    await test('every admin DM is queued and a hello is not paused', async function () {
        const adminUid = guard.ADMIN_UIDS[0];
        const initial = {};
        initial['dm_conversations/bob0000001_' + adminUid] = { participants: ['bob0000001', adminUid] };
        const db = memoryDb(initial);
        const result = await guard.handleDmMessageCreated({
            db: db,
            admin: admin,
            auth: authOf({ bob0000001: { metadata: { creationTime: '2020-01-01T00:00:00.000Z' } } })
        }, eventFor('bob0000001_' + adminUid, 'm3', { senderUid: 'bob0000001', text: 'hello from the study group' }));
        assert.strictEqual(result.flagged, false);
        const alert = db.store.get('admin_dm_alerts/bob0000001_' + adminUid + '_m3');
        assert.ok(alert);
        assert.strictEqual(alert.alerted, false);
        assert.strictEqual(alert.adminSide, 'recipient');
        assert.strictEqual(alert.email, undefined);
        assert.strictEqual(db.store.has('users/bob0000001'), false);
    });

    await test('a message from an admin account is queued too', async function () {
        const adminUid = guard.ADMIN_UIDS[0];
        const initial = {};
        initial['dm_conversations/' + adminUid + '_bob0000001'] = { participants: [adminUid, 'bob0000001'] };
        const db = memoryDb(initial);
        await guard.handleDmMessageCreated({
            db: db,
            admin: admin,
            auth: authOf((function () { const map = {}; map[adminUid] = { email: 'someone-else@example.com', customClaims: {} }; return map; })())
        }, eventFor(adminUid + '_bob0000001', 'm4', { senderUid: adminUid, text: 'the meetup is at 7' }));
        const alert = db.store.get('admin_dm_alerts/' + adminUid + '_bob0000001_m4');
        assert.ok(alert);
        assert.strictEqual(alert.adminSide, 'sender');
        assert.ok(JSON.stringify(alert).indexOf('@') === -1);
    });

    await test('an admin custom claim is enough to queue the alert', async function () {
        const db = memoryDb({
            'dm_conversations/mod0000001_bob0000001': { participants: ['mod0000001', 'bob0000001'] }
        });
        await guard.handleDmMessageCreated({
            db: db,
            admin: admin,
            auth: authOf({ mod0000001: { customClaims: { admin: true } } })
        }, eventFor('mod0000001_bob0000001', 'm5', { senderUid: 'mod0000001', text: 'welcome' }));
        assert.ok(db.store.get('admin_dm_alerts/mod0000001_bob0000001_m5'));
    });

    await test('a new account blast is paused by the trigger', async function () {
        const now = Date.now();
        const initial = { 'dm_conversations/newuser001_bob0000001': { participants: ['newuser001', 'bob0000001'], lastSenderUid: 'newuser001', lastMessage: 'hello from the meetup 0', lastMessageTime: { toMillis: function () { return now; } } } };
        for (let i = 1; i < 5; i++) {
            initial['dm_conversations/newuser001_user' + i + 'xxxx'] = {
                participants: ['newuser001', 'user' + i + 'xxxx'],
                lastSenderUid: 'newuser001',
                lastMessage: 'hello from the meetup ' + i,
                lastMessageTime: { toMillis: function () { return now - 1000; } }
            };
        }
        const db = memoryDb(initial);
        const result = await guard.handleDmMessageCreated({
            db: db,
            admin: admin,
            auth: authOf({ newuser001: { metadata: { creationTime: new Date(now - 60 * 60 * 1000).toISOString() } } })
        }, eventFor('newuser001_bob0000001', 'm6', { senderUid: 'newuser001', text: 'hello from the meetup 0' }));
        assert.strictEqual(result.flagged, true);
        assert.ok(result.reasons.indexOf('mass_dm_new_account') !== -1);
        assert.strictEqual(db.store.get('users/newuser001').dmDisabled, true);
    });

    await test('nacho lines do not pause the account', async function () {
        const db = memoryDb({
            'dm_conversations/alice0001_bob0000001': { participants: ['alice0001', 'bob0000001'] }
        });
        const result = await guard.handleDmMessageCreated({
            db: db, admin: admin, auth: authOf({})
        }, eventFor('alice0001_bob0000001', 'm7', { senderUid: 'alice0001', text: 'send me your seed', isNachoAuto: true }));
        assert.strictEqual(result.flagged, false);
        assert.strictEqual(db.store.has('users/alice0001'), false);
    });

    await test('a disabled sender is rejected before a callable write', function () {
        assert.throws(function () { guard.assertDmSendAllowed({ dmDisabled: true }); }, function (err) {
            return err.code === 'permission-denied';
        });
        assert.doesNotThrow(function () { guard.assertDmSendAllowed({ dmDisabled: false }); });
        assert.doesNotThrow(function () { guard.assertDmSendAllowed(null); });
    });

    await test('only an admin can clear the pause, and the clear is logged', async function () {
        const db = memoryDb({ 'users/alice0001': { dmDisabled: true, dmDisabledReason: 'seed_request', dmDisabledAt: 1, email: 'alice@example.com' } });
        await assert.rejects(function () {
            return guard.reenableDms({ db: db, admin: admin }, { uid: 'bob0000001', token: {} }, 'alice0001');
        });
        const cleared = await guard.reenableDms({ db: db, admin: admin }, { uid: 'mod0000001', token: { admin: true } }, 'alice0001');
        assert.strictEqual(cleared.ok, true);
        const user = db.store.get('users/alice0001');
        assert.strictEqual(user.dmDisabled, false);
        assert.strictEqual(user.dmDisabledReason, undefined);
        assert.strictEqual(user.dmDisabledAt, undefined);
        assert.strictEqual(user.dmReenabledBy, 'mod0000001');
        assert.ok(user.dmReenabledAt && user.dmReenabledAt.__op === 'time');
        assert.strictEqual(user.email, 'alice@example.com');
        await guard.reenableDms({ db: db, admin: admin }, { uid: 'mailadmin1', token: { email: guard.ADMIN_EMAILS[0] } }, 'alice0001');
        assert.strictEqual(db.store.get('users/alice0001').dmReenabledBy, 'mailadmin1');
        await assert.rejects(function () {
            return guard.reenableDms({ db: db, admin: admin }, { uid: guard.ADMIN_UIDS[0], token: {} }, 'no');
        });
    });

    await test('client copy, rules, and exports stay wired', function () {
        const messaging = fs.readFileSync(path.join(root, 'messaging.js'), 'utf8');
        const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
        const index = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
        const src = fs.readFileSync(path.join(root, 'functions/src/dmGuard.js'), 'utf8');
        assert.ok(messaging.includes("var DM_PAUSED_NOTICE = 'Your messages are paused pending review'"));
        assert.ok(messaging.includes('dmIsPausedLocal'));
        assert.ok(messaging.includes('id="dmPauseNotice"'));
        assert.ok(rules.includes("'dmDisabled', 'dmDisabledReason', 'dmDisabledAt', 'dmReenabledAt', 'dmReenabledBy'"));
        assert.ok(rules.includes('function dmSenderDisabled()'));
        assert.ok(rules.includes('&& !dmSenderDisabled()'));
        assert.ok(rules.includes('match /admin_dm_flags/{docId}'));
        assert.ok(rules.includes('match /admin_dm_alerts/{docId}'));
        assert.ok(index.includes('exports.onDmMessageGuard'));
        assert.ok(index.includes('exports.adminReenableDms'));
        assert.ok(!src.includes('nodemailer'));
        assert.ok(!src.includes('sendMail'));
        assert.ok(src.includes('alerted: false'));
    });

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
})().catch(function (err) {
    console.error(err);
    process.exit(1);
});
