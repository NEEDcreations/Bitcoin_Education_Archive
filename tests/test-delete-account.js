#!/usr/bin/env node
// Account deletion: owner re-auth or admin, batched, idempotent, and it
// leaves the abuse and payout records in place.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const del = require(path.join(root, 'functions', 'src', 'deleteAccount'));

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        const ret = fn();
        if (ret && typeof ret.then === 'function') {
            throw new Error('async test was not awaited');
        }
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    }
}
async function testAsync(name, fn) {
    try {
        await fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.stack || e.message);
        failed++;
    }
}

function HttpsError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

function matchFilters(data, filters) {
    return filters.every(function(f) {
        const val = f.field.split('.').reduce(function(obj, key) {
            return obj == null ? undefined : obj[key];
        }, data);
        if (f.op === '==') return val === f.value;
        if (f.op === 'array-contains') return Array.isArray(val) && val.indexOf(f.value) !== -1;
        if (f.op === 'in') return Array.isArray(f.value) && f.value.indexOf(val) !== -1;
        throw new Error('bad op ' + f.op);
    });
}

function createFakeDb(initial) {
    const docs = new Map();
    Object.keys(initial || {}).forEach(function(key) {
        docs.set(key, Object.assign({}, initial[key]));
    });
    const commits = [];
    const db = { docs: docs, commits: commits, gets: 0 };

    function docRef(docPath) {
        const ref = {
            path: docPath,
            id: docPath.split('/').pop(),
            collection: function(name) { return collection(docPath + '/' + name); },
            get: async function() {
                if (!docs.has(docPath)) {
                    return { exists: false, id: ref.id, ref: ref, data: function() { return undefined; } };
                }
                return {
                    exists: true,
                    id: ref.id,
                    ref: ref,
                    data: function() { return Object.assign({}, docs.get(docPath)); },
                };
            },
            listCollections: async function() {
                const prefix = docPath + '/';
                const names = new Set();
                for (const key of docs.keys()) {
                    if (!key.startsWith(prefix)) continue;
                    const rest = key.slice(prefix.length);
                    if (!rest.includes('/')) continue;
                    names.add(rest.split('/')[0]);
                }
                return Array.from(names).map(function(name) { return collection(prefix + name); });
            },
        };
        return ref;
    }

    function makeQuery(mode, filters, limitN, cursor) {
        return {
            where: function(field, op, value) {
                return makeQuery(mode, filters.concat([{ field: field, op: op, value: value }]), limitN, cursor);
            },
            orderBy: function() { return makeQuery(mode, filters, limitN, cursor); },
            limit: function(n) { return makeQuery(mode, filters, n, cursor); },
            startAfter: function(doc) { return makeQuery(mode, filters, limitN, doc); },
            get: async function() {
                db.gets++;
                const rows = [];
                for (const [key, data] of docs) {
                    const parts = key.split('/');
                    if (parts.length % 2 !== 0) continue;
                    if (mode.kind === 'collection') {
                        const prefix = mode.path + '/';
                        if (!key.startsWith(prefix)) continue;
                        if (key.slice(prefix.length).includes('/')) continue;
                    } else if (parts[parts.length - 2] !== mode.name) {
                        continue;
                    }
                    if (!matchFilters(data, filters)) continue;
                    rows.push({ path: key, id: parts[parts.length - 1] });
                }
                rows.sort(function(a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : 0; });
                let start = 0;
                if (cursor && cursor.ref) {
                    const cpath = cursor.ref.path;
                    const idx = rows.findIndex(function(row) { return row.path === cpath; });
                    if (idx === -1) {
                        const next = rows.findIndex(function(row) { return row.path > cpath; });
                        start = next === -1 ? rows.length : next;
                    } else {
                        start = idx + 1;
                    }
                }
                const slice = rows.slice(start, limitN ? start + limitN : undefined);
                const out = slice.map(function(row) {
                    return {
                        id: row.id,
                        exists: true,
                        ref: docRef(row.path),
                        data: function() { return Object.assign({}, docs.get(row.path)); },
                    };
                });
                return {
                    empty: out.length === 0,
                    size: out.length,
                    docs: out,
                    forEach: function(fn) { out.forEach(fn); },
                };
            },
        };
    }

    function collection(collPath) {
        const query = makeQuery({ kind: 'collection', path: collPath }, [], null, null);
        query.id = collPath.split('/').pop();
        query.path = collPath;
        query.doc = function(id) { return docRef(collPath + '/' + id); };
        return query;
    }

    db.collection = collection;
    db.collectionGroup = function(name) {
        return makeQuery({ kind: 'group', name: name }, [], null, null);
    };
    db.batch = function() {
        const ops = [];
        return {
            delete: function(ref) { ops.push({ type: 'delete', path: ref.path }); },
            update: function(ref, data) { ops.push({ type: 'update', path: ref.path, data: data }); },
            set: function(ref, data) { ops.push({ type: 'set', path: ref.path, data: data }); },
            commit: async function() {
                if (ops.length > del.BATCH_LIMIT) throw new Error('batch has ' + ops.length + ' ops');
                commits.push(ops.length);
                ops.forEach(function(op) {
                    if (op.type === 'delete') docs.delete(op.path);
                    else if (op.type === 'update') {
                        if (!docs.has(op.path)) throw new Error('update missing ' + op.path);
                        docs.set(op.path, Object.assign({}, docs.get(op.path), op.data));
                    } else {
                        docs.set(op.path, Object.assign({}, op.data));
                    }
                });
                ops.length = 0;
            },
        };
    };
    return db;
}

function createBucket(files) {
    const set = new Set(files);
    const calls = [];
    return {
        files: set,
        calls: calls,
        deleteFiles: async function(opts) {
            calls.push(opts.prefix);
            for (const file of Array.from(set)) {
                if (file.startsWith(opts.prefix)) set.delete(file);
            }
        },
    };
}

function world() {
    const data = {
        'users/u1': { username: 'Alice', username_lower: 'alice', points: 10, profilePic: 'data:image/png;base64,abc' },
        'users/u1/daily_points/2026-10-22': { total: 40 },
        'users/u1/daily_action_counts/2026-10-22': { say_hi: 1 },
        'users/u1/badge_awards/b1': { badge: 'x' },
        'users/u1/sats_withdrawals/w1': { amount: 100, invoice: 'lnbc...' },
        'users/u1/notifications/in1': { message: 'profile inbox' },
        'users/u2': { username: 'Bob', points: 3 },
        'public_profiles/u1': { username: 'Alice', points: 10 },
        'public_profiles/u2': { username: 'Bob' },
        'usernames/alice': { uid: 'u1' },
        'usernames/u1': { uid: 'u1' },
        'usernames/bob': { uid: 'u2' },
        'push_tokens/u1': { token: 'tok-u1' },
        'push_tokens/u1/devices/phone': { token: 'phone-u1' },
        'push_tokens/u2': { token: 'tok-u2' },
        'push_tokens/u2/devices/tablet': { token: 'tab-u2' },
        'dm_conversations/u1_u2': { participants: ['u1', 'u2'], participantNames: { u1: 'Alice', u2: 'Bob' } },
        'dm_conversations/u1_u2/messages/m1': { senderUid: 'u1', text: 'secret dm' },
        'dm_conversations/u1_u2/messages/m2': { senderUid: 'u2', text: 'reply dm' },
        'dm_conversations/u2_u3': { participants: ['u2', 'u3'] },
        'dm_conversations/u2_u3/messages/m9': { senderUid: 'u2', text: 'keep this thread' },
        'conversations/legacy1': { participants: ['u1', 'u9'] },
        'conversations/legacy1/messages/old1': { text: 'legacy dm' },
        'global_chat/m1': {
            uid: 'u1', name: 'Alice', text: 'hello secret', replyTo: 'older', replyToName: 'Bob', replyToText: 'yo',
            imageUrl: 'https://cdn.example/a.png', gifUrl: 'https://cdn.example/a.gif', caption: 'cap', faction: 'hornet',
        },
        'global_chat/m2': { uid: 'u2', name: 'Bob', text: 'I quote you', replyTo: 'm1', replyToName: 'Alice', replyToText: 'hello secret' },
        'global_chat/m3': { uid: 'u2', name: 'Bob', text: 'unrelated' },
        'global_chat/already': { uid: 'deleted', name: '[deleted]', text: '[deleted]', replyTo: 'z' },
        'notifications/n1': { recipientId: 'u1', message: 'inbox' },
        'notifications/n2': { senderId: 'u1', recipientId: 'u2', senderName: 'Alice', message: 'sent' },
        'notifications/n3': { recipientId: 'u2', senderId: 'u9', message: 'keep' },
        'forum_posts/p1': { authorId: 'u1', title: 'post' },
        'forum_posts/p2': { authorId: 'u2', title: 'keep post' },
        'forum_replies/r1': { authorId: 'u1', text: 'reply' },
        'marketplace/l1': { sellerUid: 'u1', title: 'item' },
        'marketplace/l2': { sellerUid: 'u2', title: 'keep item' },
        'marketplace_messages/mm1': { buyerUid: 'u1', sellerUid: 'u2', message: 'buy' },
        'suggestions/u1': { uid: 'u1', text: 'idea' },
        'suggestions/s2': { uid: 'u2', text: 'keep idea' },
        'beats_tracks/t1': { authorId: 'u1', title: 'song' },
        'beats_tracks/t1/comments/c1': { authorId: 'u1', text: 'own comment' },
        'beats_tracks/t2': { authorId: 'u2', title: 'other song' },
        'beats_tracks/t2/comments/c2': { authorId: 'u1', text: 'on their track' },
        'beats_tracks/t2/comments/c3': { authorId: 'u2', text: 'their comment' },
        'gifts/g1': { ownerId: 'u1', sentBy: 'u2' },
        'gifts/g2': { ownerId: 'u2', sentBy: 'u1' },
        'keys/k1': { ownerId: 'u1' },
        'locked_ciphers/c1': { ownerId: 'u1' },
        'peer_requests/pr1': { from: 'u1', to: 'u2' },
        'peerRelationships/rel12': { uid1: 'u1', uid2: 'u2', giftsExchanged: 2 },
        'peerRelationships/rel23': { uid1: 'u2', uid2: 'u3', giftsExchanged: 1 },
        'tctv_presence/u1': { viewerId: 'u1', station: 'main' },
        'tctv_presence/u2': { viewerId: 'u2' },
        'tctv_view_days/20261022_u1_main': { viewerId: 'u1', station: 'main', day: '20261022' },
        'certs/cert1': { uid: 'u1', name: 'Alice' },
        'faucet_ledger/u1': { satsWithdrawn: 500, lastSatsClaim: 111 },
        'faucet_ip_log/ip1': { uid: 'u1', ip: '203.0.113.8' },
        'faucet_fingerprints/fp1': { uid: 'u1', hash: 'devhash' },
        'faucet_invoices/inv1': { uid: 'u1', invoice: 'lnbc50...' },
        'admin_audit_log/a1': { uid: 'u1', action: 'review', ip: '203.0.113.9' },
        'charity_donations/d1': { uid: 'u1', amount: 25, username: 'Alice' },
        'cipher_wins/win1': { uid: 'u1', sats: 21 },
        'lightning_addresses/addr1': { uid: 'u1', address: 'alice@getalby.com' },
        'referrals/u1': { referredUserUid: 'u1', referrerUid: 'u9', ticketsAwarded: 50 },
        'reports/rep1': { reporterUid: 'u1', reason: 'spam' },
        'satoshiFavor/current/session_hashes/u1': { uid: 'u1', username: 'Alice', count: 4 },
        'satoshiFavor/current/hashes/h1': { uid: 'u1', username: 'Alice', value: '000abc' },
        'satoshiFavor/current/cooldowns/u1_rig1': { uid: 'u1', last: 99 },
        'satoshiFavor/personalBests/users/u1': { username: 'Alice', best: 9 },
        'global_chat_meta/live_dj/dj_queue/u1': { uid: 'u1', name: 'Alice' },
        'totp_secrets/u1': { secret: 'should-go' },
    };
    for (let i = 0; i < del.BATCH_LIMIT + 50; i++) {
        data['notifications/bulk' + String(i).padStart(4, '0')] = { recipientId: 'u1', message: 'n' + i };
    }
    return data;
}

function snapshot(db, keys) {
    const out = {};
    keys.forEach(function(key) {
        out[key] = db.docs.has(key) ? JSON.stringify(db.docs.get(key)) : null;
    });
    return out;
}

const RETAINED_KEYS = [
    'faucet_ledger/u1',
    'faucet_ip_log/ip1',
    'faucet_fingerprints/fp1',
    'faucet_invoices/inv1',
    'admin_audit_log/a1',
    'charity_donations/d1',
    'cipher_wins/win1',
    'lightning_addresses/addr1',
    'referrals/u1',
    'reports/rep1',
    'satoshiFavor/current/cooldowns/u1_rig1',
];

function auth(uid, extras) {
    return Object.assign({ uid: uid, token: { auth_time: 1000, admin: false } }, extras || {});
}

(async function() {
    execFileSync(process.execPath, ['--check', path.join(root, 'functions', 'src', 'deleteAccount.js')], { stdio: 'pipe' });

    test('owner needs a recent sign-in, and only an admin can name another uid', function() {
        const now = 1000 + del.REAUTH_MAX_AGE_SEC;
        assert.strictEqual(del.authorizeDeleteAccount(null, {}, now).code, 'unauthenticated');
        assert.strictEqual(del.authorizeDeleteAccount(auth('u1', { token: {} }), {}, now).code, 'failed-precondition');
        assert.strictEqual(del.authorizeDeleteAccount(auth('u1', { token: { auth_time: 1000 } }), {}, now).ok, true);
        assert.strictEqual(del.authorizeDeleteAccount(auth('u1', { token: { auth_time: 999 } }), {}, now).code, 'failed-precondition');
        const other = del.authorizeDeleteAccount(auth('u1'), { uid: 'u2' }, now);
        assert.strictEqual(other.code, 'permission-denied');
        const adminOld = del.authorizeDeleteAccount(
            { uid: 'admin', token: { admin: true, auth_time: 1 } },
            { uid: 'u2' },
            now
        );
        assert.strictEqual(adminOld.ok, true);
        assert.strictEqual(adminOld.uid, 'u2');
        assert.strictEqual(adminOld.byAdmin, true);
        const adminSelf = del.authorizeDeleteAccount(
            { uid: 'admin', token: { admin: true, auth_time: 1 } },
            {},
            now
        );
        assert.strictEqual(adminSelf.code, 'failed-precondition');
        assert.strictEqual(del.authorizeDeleteAccount(auth('u1'), { uid: 'u1' }, now).ok, true);
        assert.strictEqual(del.authorizeDeleteAccount(
            { uid: 'admin', token: { admin: true, auth_time: now } },
            { uid: '../u1' },
            now
        ).code, 'invalid-argument');
        assert.strictEqual(del.authorizeDeleteAccount(
            auth('u1'),
            { uid: 'u2' },
            now
        ).code, 'permission-denied');
    });

    test('chat tombstone keeps the reply link and clears the author, text, and media', function() {
        const patch = del.chatTombstone({
            uid: 'u1', name: 'Alice', text: 'secret', replyTo: 'older', replyToName: 'Bob', replyToText: 'yo', imageUrl: 'https://x',
        });
        assert.strictEqual(patch.uid, 'deleted');
        assert.strictEqual(patch.name, '[deleted]');
        assert.strictEqual(patch.text, '[deleted]');
        assert.strictEqual(patch.imageUrl, '');
        assert.strictEqual(patch.replyTo, undefined);
        assert.strictEqual(patch.replyToName, undefined);
        assert.strictEqual(del.chatTombstone({ uid: 'deleted', name: '[deleted]', text: '[deleted]' }), null);
        assert.deepStrictEqual(del.quoteTombstone({ replyTo: 'm1', replyToName: 'Alice', replyToText: 'secret' }), {
            replyToName: '[deleted]',
            replyToText: '[deleted]',
        });
        assert.strictEqual(del.quoteTombstone({ replyTo: 'm1', replyToName: '[deleted]', replyToText: '[deleted]' }), null);
    });

    await testAsync('purge deletes the account a person would expect and keeps abuse records', async function() {
        const db = createFakeDb(world());
        const before = snapshot(db, RETAINED_KEYS);
        const bucket = createBucket([
            'beats/u1/song.mp3',
            'beats-covers/u1/cover.png',
            'avatars/u1/face.png',
            'chat-images/u1/pic.jpg',
            'dm-images/u1/dm.jpg',
            'article-images/u1/a.jpg',
            'articles/u1/cover.jpg',
            'irl-events/u1/meetup.jpg',
            'meetup-builder/u1/plan.jpg',
            'beats/u2/keep.mp3',
        ]);
        const summary = await del.purgeAccount({ db: db, bucket: bucket, uid: 'u1', documentIdField: '__name__' });
        assert.strictEqual(summary.anonymizedChat, 1);
        assert.ok(db.commits.some(function(n) { return n === del.BATCH_LIMIT; }), 'a batch should fill to the limit');
        assert.ok(db.commits.every(function(n) { return n <= del.BATCH_LIMIT; }));

        assert.strictEqual(db.docs.has('users/u1'), false);
        assert.strictEqual(db.docs.has('users/u1/daily_points/2026-10-22'), false);
        assert.strictEqual(db.docs.has('users/u1/daily_action_counts/2026-10-22'), false);
        assert.strictEqual(db.docs.has('users/u1/badge_awards/b1'), false);
        assert.strictEqual(db.docs.has('users/u1/sats_withdrawals/w1'), false);
        assert.strictEqual(db.docs.has('users/u1/notifications/in1'), false);
        assert.ok(db.docs.has('users/u2'));

        assert.strictEqual(db.docs.has('dm_conversations/u1_u2'), false);
        assert.strictEqual(db.docs.has('dm_conversations/u1_u2/messages/m1'), false);
        assert.strictEqual(db.docs.has('dm_conversations/u1_u2/messages/m2'), false);
        assert.ok(db.docs.has('dm_conversations/u2_u3'));
        assert.strictEqual(db.docs.get('dm_conversations/u2_u3/messages/m9').text, 'keep this thread');
        assert.strictEqual(db.docs.has('conversations/legacy1'), false);
        assert.strictEqual(db.docs.has('conversations/legacy1/messages/old1'), false);

        const mine = db.docs.get('global_chat/m1');
        assert.strictEqual(mine.uid, 'deleted');
        assert.strictEqual(mine.name, '[deleted]');
        assert.strictEqual(mine.text, '[deleted]');
        assert.strictEqual(mine.caption, '[deleted]');
        assert.strictEqual(mine.imageUrl, '');
        assert.strictEqual(mine.gifUrl, '');
        assert.strictEqual(mine.replyTo, 'older');
        assert.strictEqual(mine.replyToName, 'Bob');
        assert.strictEqual(mine.replyToText, 'yo');
        const quote = db.docs.get('global_chat/m2');
        assert.strictEqual(quote.uid, 'u2');
        assert.strictEqual(quote.text, 'I quote you');
        assert.strictEqual(quote.replyTo, 'm1');
        assert.strictEqual(quote.replyToName, '[deleted]');
        assert.strictEqual(quote.replyToText, '[deleted]');
        assert.strictEqual(db.docs.get('global_chat/m3').text, 'unrelated');
        assert.strictEqual(db.docs.get('global_chat/already').replyTo, 'z');

        assert.strictEqual(db.docs.has('notifications/n1'), false);
        assert.strictEqual(db.docs.has('notifications/n2'), false);
        assert.ok(db.docs.has('notifications/n3'));
        for (let i = 0; i < del.BATCH_LIMIT + 50; i++) {
            assert.strictEqual(db.docs.has('notifications/bulk' + String(i).padStart(4, '0')), false);
        }

        assert.strictEqual(db.docs.has('push_tokens/u1'), false);
        assert.strictEqual(db.docs.has('push_tokens/u1/devices/phone'), false);
        assert.strictEqual(db.docs.get('push_tokens/u2').token, 'tok-u2');
        assert.strictEqual(db.docs.get('push_tokens/u2/devices/tablet').token, 'tab-u2');
        assert.strictEqual(db.docs.has('usernames/alice'), false);
        assert.strictEqual(db.docs.has('usernames/u1'), false);
        assert.strictEqual(db.docs.get('usernames/bob').uid, 'u2');
        assert.strictEqual(db.docs.has('public_profiles/u1'), false);
        assert.ok(db.docs.has('public_profiles/u2'));

        assert.strictEqual(db.docs.has('forum_posts/p1'), false);
        assert.ok(db.docs.has('forum_posts/p2'));
        assert.strictEqual(db.docs.has('forum_replies/r1'), false);
        assert.strictEqual(db.docs.has('marketplace/l1'), false);
        assert.ok(db.docs.has('marketplace/l2'));
        assert.strictEqual(db.docs.has('marketplace_messages/mm1'), false);
        assert.strictEqual(db.docs.has('suggestions/u1'), false);
        assert.ok(db.docs.has('suggestions/s2'));
        assert.strictEqual(db.docs.has('beats_tracks/t1'), false);
        assert.strictEqual(db.docs.has('beats_tracks/t1/comments/c1'), false);
        assert.ok(db.docs.has('beats_tracks/t2'));
        assert.strictEqual(db.docs.has('beats_tracks/t2/comments/c2'), false);
        assert.strictEqual(db.docs.get('beats_tracks/t2/comments/c3').text, 'their comment');
        assert.strictEqual(db.docs.has('gifts/g1'), false);
        assert.strictEqual(db.docs.get('gifts/g2').ownerId, 'u2');
        assert.strictEqual(db.docs.has('keys/k1'), false);
        assert.strictEqual(db.docs.has('locked_ciphers/c1'), false);
        assert.strictEqual(db.docs.has('peer_requests/pr1'), false);
        assert.strictEqual(db.docs.has('peerRelationships/rel12'), false);
        assert.ok(db.docs.has('peerRelationships/rel23'));
        assert.strictEqual(db.docs.has('tctv_presence/u1'), false);
        assert.ok(db.docs.has('tctv_presence/u2'));
        assert.strictEqual(db.docs.has('tctv_view_days/20261022_u1_main'), false);
        assert.strictEqual(db.docs.has('certs/cert1'), false);
        assert.strictEqual(db.docs.has('totp_secrets/u1'), false);
        assert.strictEqual(db.docs.has('global_chat_meta/live_dj/dj_queue/u1'), false);
        assert.strictEqual(db.docs.has('satoshiFavor/personalBests/users/u1'), false);
        assert.strictEqual(db.docs.get('satoshiFavor/current/session_hashes/u1').username, '[deleted]');
        assert.strictEqual(db.docs.get('satoshiFavor/current/session_hashes/u1').count, 4);
        assert.strictEqual(db.docs.get('satoshiFavor/current/hashes/h1').username, '[deleted]');
        assert.strictEqual(db.docs.get('satoshiFavor/current/hashes/h1').value, '000abc');

        assert.deepStrictEqual(snapshot(db, RETAINED_KEYS), before);
        ['beats/u1/', 'beats-covers/u1/', 'avatars/u1/'].forEach(function(prefix) {
            assert.ok(bucket.calls.indexOf(prefix) !== -1, prefix);
        });
        assert.strictEqual(bucket.files.has('beats/u1/song.mp3'), false);
        assert.strictEqual(bucket.files.has('avatars/u1/face.png'), false);
        assert.strictEqual(bucket.files.has('chat-images/u1/pic.jpg'), false);
        assert.ok(bucket.files.has('beats/u2/keep.mp3'));

        const chatAfter = JSON.stringify(db.docs.get('global_chat/m1'));
        const commitsAfter = db.commits.length;
        const again = await del.purgeAccount({ db: db, bucket: bucket, uid: 'u1', documentIdField: '__name__' });
        assert.strictEqual(again.anonymizedChat, 0);
        assert.strictEqual(JSON.stringify(db.docs.get('global_chat/m1')), chatAfter);
        assert.deepStrictEqual(snapshot(db, RETAINED_KEYS), before);
        assert.ok(db.docs.has('users/u2'));
        assert.ok(db.docs.has('gifts/g2'));
        assert.ok(db.commits.length >= commitsAfter);
    });

    await testAsync('a missing username reservation and a second empty account still succeed', async function() {
        const db = createFakeDb({
            'users/u4': { points: 1 },
            'faucet_ledger/u4': { satsWithdrawn: 10 },
        });
        const bucket = createBucket([]);
        const first = await del.purgeAccount({ db: db, bucket: bucket, uid: 'u4', documentIdField: '__name__' });
        assert.strictEqual(first.anonymizedChat, 0);
        assert.strictEqual(db.docs.has('users/u4'), false);
        assert.strictEqual(db.docs.get('faucet_ledger/u4').satsWithdrawn, 10);
        await del.purgeAccount({ db: db, bucket: bucket, uid: 'u4', documentIdField: '__name__' });
        assert.strictEqual(db.docs.get('faucet_ledger/u4').satsWithdrawn, 10);
        assert.ok(bucket.calls.indexOf('avatars/u4/') !== -1);
    });

    await testAsync('the callable rejects a stale owner and another user, and an admin may proceed', async function() {
        const now = 5000;
        const boom = {
            collection: function() { throw new Error('database should not be read'); },
            batch: function() { throw new Error('database should not be written'); },
        };
        const handlers = del.createDeleteAccountHandlers({
            db: boom,
            bucket: createBucket([]),
            HttpsError: HttpsError,
            nowSec: function() { return now; },
            documentIdField: '__name__',
        });
        await assert.rejects(
            handlers.deleteAccount({}, { auth: { uid: 'u1', token: { auth_time: now - del.REAUTH_MAX_AGE_SEC - 1 } } }),
            function(err) { return err.code === 'failed-precondition'; }
        );
        await assert.rejects(
            handlers.deleteAccount({ uid: 'u2' }, { auth: auth('u1', { token: { auth_time: now } }) }),
            function(err) { return err.code === 'permission-denied'; }
        );

        const db = createFakeDb({ 'users/victim': { username: 'Vic' }, 'faucet_ledger/victim': { satsWithdrawn: 7 } });
        const adminHandlers = del.createDeleteAccountHandlers({
            db: db,
            bucket: createBucket(['beats/victim/a.mp3']),
            HttpsError: HttpsError,
            nowSec: function() { return now; },
            documentIdField: '__name__',
        });
        const result = await adminHandlers.deleteAccount(
            { uid: 'victim' },
            { auth: { uid: 'admin', token: { admin: true, auth_time: 1 } } }
        );
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.byAdmin, true);
        assert.strictEqual(db.docs.has('users/victim'), false);
        assert.strictEqual(db.docs.get('faucet_ledger/victim').satsWithdrawn, 7);
    });

    test('the client calls the server wipe and does not delete Firestore itself', function() {
        const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
        assert.ok(ranking.includes("httpsCallable('deleteAccount')"));
        assert.ok(ranking.includes('user.delete()'));
        assert.strictEqual(ranking.includes("collection('conversations')"), false);
        assert.strictEqual(ranking.includes("collection('dm_conversations')"), false);
        assert.strictEqual(ranking.includes("collection('forum_posts')"), false);
        assert.strictEqual(ranking.includes('localStorage.clear()'), false);
        const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
        assert.ok(index.includes('exports.deleteAccount = deleteAccountFns.deleteAccount'));
        const privacy = fs.readFileSync(path.join(root, 'privacy.html'), 'utf8');
        assert.ok(privacy.includes('dm_conversations'));
        assert.ok(privacy.includes('[deleted]'));
        assert.ok(privacy.includes('faucet ledger'));
        assert.ok(privacy.includes('50 Orange Tickets') === false || privacy.includes('referral') );
        // The reward sentence in the terms is unchanged. Privacy still describes the check.
        const terms = fs.readFileSync(path.join(root, 'terms.html'), 'utf8');
        assert.ok(terms.includes('The referral reward at Maxi is 50 Orange Tickets for the person who shared the link and 50 Orange Tickets for the referred account.'));
    });

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
})();
