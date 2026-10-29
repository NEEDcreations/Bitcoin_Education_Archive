#!/usr/bin/env node
// Account deletion: owner re-auth or admin, batched, idempotent, and it
// leaves the abuse and payout records in place.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const del = require(path.join(root, 'functions', 'src', 'deleteAccount'));
const { initSecondFactor } = require(path.join(root, 'functions', 'src', 'secondFactor'));
const _createDeleteAccountHandlers = del.createDeleteAccountHandlers;
del.createDeleteAccountHandlers = function(opts) {
    const handlers = _createDeleteAccountHandlers(opts);
    const inner = handlers.deleteAccount;
    handlers.deleteAccount = async function(data, context) {
        initSecondFactor({
            db: opts.db,
            admin: { auth: function() { return opts.authApi; } },
            HttpsError: opts.HttpsError,
            authenticator: { generateSecret: function() { return 'x'; }, keyuri: function() { return 'otpauth'; }, checkDelta: function() { return null; }, options: {} },
            QRCode: { toDataURL: async function() { return ''; } },
        });
        if (!process.env.DELETION_HMAC_SECRET) process.env.DELETION_HMAC_SECRET = 'unit-deletion-secret-0123456789';
        const body = Object.assign({}, data || {});
        if (!body.confirmUsername && opts.db && context && context.auth && context.auth.uid) {
            try {
                const snap = await opts.db.collection('users').doc(context.auth.uid).get();
                const user = snap && snap.exists ? (snap.data() || {}) : {};
                body.confirmUsername = user.username ? user.username : 'DELETE';
                const direct = Number(user.sats);
                const points = Number(user.points) || 0;
                const claimed = Number(user.pointsClaimed) || 0;
                const donated = Number(user.pointsDonated) || 0;
                const exchanged = Number(user.pointsExchanged) || 0;
                const balance = direct > 0 ? direct : Math.floor((points - claimed - donated - exchanged) / 10);
                if (balance > 0) body.acknowledgeForfeit = true;
            } catch (e) {}
        }
        return inner(body, context);
    };
    return handlers;
};

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

function matchFilters(data, filters, docId) {
    return filters.every(function(f) {
        const name = typeof f.field === 'string' ? f.field : '';
        const isId = name === '__name__' || name === '__documentId__';
        const val = isId ? docId : name.split('.').reduce(function(obj, key) {
            return obj == null ? undefined : obj[key];
        }, data);
        if (f.op === '==') return val === f.value;
        if (f.op === '>=') return val >= f.value;
        if (f.op === '>') return val > f.value;
        if (f.op === '<=') return val <= f.value;
        if (f.op === '<') return val < f.value;
        if (f.op === 'array-contains') return Array.isArray(val) && val.indexOf(f.value) !== -1;
        if (f.op === 'in') return Array.isArray(f.value) && f.value.indexOf(val) !== -1;
        throw new Error('bad op ' + f.op);
    });
}

// Empty reads of these collections are the full-database scans deleteAccount
// must not do. A matching orderBy is a capped read. A filter is the user's rows.
const SCAN_BANNED = {
    global_chat: 'ts',
    announcements: 'ts',
    raid_bosses: 'startTime',
    leaderboard_winners: 'settledAt',
    action_cooldowns: '',
    raid_daily_caps: '',
    gift_pending_pairs: '',
    stats: '',
    user_contribs: '',
};

function createFakeDb(initial) {
    const docs = new Map();
    Object.keys(initial || {}).forEach(function(key) {
        docs.set(key, Object.assign({}, initial[key]));
    });
    const commits = [];
    const listCalls = [];
    const db = { docs: docs, commits: commits, gets: 0, listCalls: listCalls };

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
                listCalls.push(docPath);
                if (db.omitListed === true) return [];
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
            set: async function(data, options) {
                const prev = docs.has(docPath) ? docs.get(docPath) : {};
                if (options && options.merge) docs.set(docPath, Object.assign({}, prev, data));
                else docs.set(docPath, Object.assign({}, data));
            },
            delete: async function() { docs.delete(docPath); },
        };
        return ref;
    }

    function makeQuery(mode, filters, limitN, cursor, orderField) {
        return {
            where: function(field, op, value) {
                return makeQuery(mode, filters.concat([{ field: field, op: op, value: value }]), limitN, cursor, orderField);
            },
            orderBy: function(field) { return makeQuery(mode, filters, limitN, cursor, field); },
            limit: function(n) { return makeQuery(mode, filters, n, cursor, orderField); },
            startAfter: function(doc) { return makeQuery(mode, filters, limitN, doc, orderField); },
            get: async function() {
                const name = mode.kind === 'group'
                    ? mode.name
                    : String(mode.path || '').split('/').pop();
                if (mode.kind === 'group' && filters.length === 0) {
                    throw new Error('unbounded group ' + name);
                }
                if (filters.length === 0 && Object.prototype.hasOwnProperty.call(SCAN_BANNED, name)) {
                    const required = SCAN_BANNED[name];
                    if (!required || orderField !== required) throw new Error('unbounded scan ' + name);
                }
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
                    if (!matchFilters(data, filters, parts[parts.length - 1])) continue;
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
        return makeQuery({ kind: 'group', name: name }, [], null, null, null);
    };
    db.runTransaction = async function(fn) {
        const tx = {
            get: function(ref) { return ref.get(); },
            set: function(ref, data) { docs.set(ref.path, Object.assign({}, data)); },
            update: function(ref, data) {
                if (!docs.has(ref.path)) throw new Error('update missing ' + ref.path);
                docs.set(ref.path, Object.assign({}, docs.get(ref.path), data));
            },
            delete: function(ref) { docs.delete(ref.path); },
        };
        return fn(tx);
    };
    db.getAll = async function() {
        const refs = Array.prototype.slice.call(arguments);
        const snaps = [];
        for (let i = 0; i < refs.length; i++) snaps.push(await refs[i].get());
        return snaps;
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
        'users/u1': {
            username: 'Alice', username_lower: 'alice', points: 10, profilePic: 'data:image/png;base64,abc',
            usernameMigratedFrom: 'Alice Smith', usernameMigratedAt: 1, usernameFreeRename: true,
        },
        'users/u1/daily_points/2026-10-22': { total: 40 },
        'users/u1/daily_action_counts/2026-10-22': { say_hi: 1 },
        'users/u1/badge_awards/b1': { badge: 'x' },
        'users/u1/sats_withdrawals/w1': { amount: 100, invoice: 'lnbc...' },
        'users/u1/notifications/in1': { message: 'profile inbox' },
        'users/u1/sats_daily/2026-10-22': { claimed: 1 },
        'users/u1/proof_of_walk/act1': { id: 'act1' },
        'users/u1/proof_of_walk_stats/daily': { n: 1 },
        'users/u2': { username: 'Bob', points: 3 },
        'public_profiles/u1': { username: 'Alice', points: 10, usernameMigratedFrom: 'Alice Smith' },
        'public_profiles/u2': { username: 'Bob' },
        'username_migrations/u1': { uid: 'u1', from: 'Alice Smith', to: 'Alice', atMs: 1 },
        'username_migrations/u2': { uid: 'u2', from: 'Bob Two', to: 'Bob', atMs: 1 },
        'usernames/alice': { uid: 'u1' },
        'usernames/u1': { uid: 'u1' },
        'usernames/bob': { uid: 'u2' },
        'usernames/orphan': { reserved: true },
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
        'telegram_mirror_queue/global_chat__m1': { uid: 'u1', line: '[Global] Alice: hello secret', status: 'pending' },
        'telegram_mirror_queue/global_chat__m2': { uid: 'u2', line: '[Global] Bob: keep', status: 'sent' },
        'telegram_mirror_claims/global_chat__m1': { uid: 'u1', status: 'queued' },
        'telegram_mirror_state/rate_u1': { uid: 'u1', recentAtMs: [1] },
        'telegram_mirror_state/group': { sentAtMs: [1] },
        'global_chat/m1': {
            uid: 'u1', name: 'Alice', text: 'hello secret', replyTo: 'older', replyToName: 'Bob', replyToText: 'yo',
            imageUrl: 'https://cdn.example/a.png', gifUrl: 'https://cdn.example/a.gif', caption: 'cap', faction: 'hornet',
        },
        'global_chat/m2': { uid: 'u2', name: 'Bob', text: 'I quote you', replyTo: 'm1', replyToName: 'Alice', replyToText: 'hello secret' },
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
        'beats_tracks/t2': { authorId: 'u2', title: 'other song', likedBy: ['u1', 'u2'], likes: 2 },
        'beats_tracks/t3': { authorId: 'u9', title: 'untouched', likedBy: ['u2'], likes: 1 },
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
        'totp_sessions/u1': { verified: true, verifiedAt: 1 },
        'trusted_devices/devu1': { uid: 'u1', tokenHash: 'abc', label: 'Chrome on macOS' },
        'trusted_devices/devu2': { uid: 'u2', tokenHash: 'def', label: 'Firefox on Linux' },
        'nacho_feedback/f1': { uid: 'u1', question: 'what is a utxo' },
        'nacho_feedback/f2': { uid: 'u2', question: 'keep' },
        'nacho_misses/miss1': { uid: 'u1', question: 'missed' },
        'nacho_bad_matches/bad1': { uid: 'u1', question: 'bad' },
        'analytics/nacho_feedback': { count: 9 },
        'analytics/nacho_misses': { count: 3 },
        'ai_tools_opens/open1': { uid: 'u1', tool: 'explorer' },
        'ai_tools_opens/open2': { uid: 'u2', tool: 'keep' },
        'channel_feedback/cf1': { uid: 'u1', text: 'loud' },
        'channel_feedback/cf2': { uid: 'u2', text: 'keep' },
        'poll_votes/poll1': { voters: ['u1', 'u2'], votes: [1, 1, 0, 0] },
        'poll_votes/poll2': { voters: ['u2'], votes: [0, 1, 0, 0] },
        'reply_bonus_state/u1': { uid: 'u1', firstClaimed: true },
        'reply_bonus_state/u2': { uid: 'u2', firstClaimed: true },
        'reply_bonus_pairs/p_u1__u2': { replierUid: 'u1', targetUid: 'u2' },
        'reply_bonus_pairs/p_u2__u1': { replierUid: 'u2', targetUid: 'u1' },
        'reply_bonus_pairs/p_u2__u3': { replierUid: 'u2', targetUid: 'u3' },
        'reply_bonus_claims/msg1': { uid: 'u1', targetUid: 'u2', messageId: 'msg1' },
        'reply_bonus_claims/msg2': { uid: 'u2', targetUid: 'u1', messageId: 'msg2' },
        'reply_bonus_claims/msg3': { uid: 'u2', targetUid: 'u3', messageId: 'msg3' },
        'rate_limits/reply_u1': { count: 2 },
        'rate_limits/reply_u2': { count: 1 },
        'market_listing_counts/l1': { sellerUid: 'u1' },
        'market_listing_counts/l2': { sellerUid: 'u2' },
        'tctv_watch/u1': { minutes: 10 },
        'tctv_watch/u2': { minutes: 4 },
        'users/u1/quest_completions/q9': { questId: 'q9' },
        'users/u1/quest_passes/q9': { questId: 'q9' },
        'users/u1/lifetime_awards/life1': { award: 'first' },
        'users/u1/onboarding_evidence/ev1': { note: 'joined' },
        'suspicious_activity/sa1': { uid: 'u1', email: 'alice@example.com' },
        'watchlist_snapshots/u1': { uid: 'u1', note: 'watch' },
        'beats_reports/br1': { reporterId: 'u1', trackId: 't2' },
        'global_chat/nacho1': {
            uid: 'nacho-bot', name: '🦌 Nacho', mentionUid: 'u1',
            text: 'Shoutout to @Alice and also @Bob stays',
        },
        'global_chat/m3': { uid: 'u2', name: 'Bob', text: 'unrelated', reactions: { '🔥': ['u1', 'u2'] } },
        'announcements/a1': { text: 'announce', reactions: { '🎉': ['u1', 'u9'] } },
        'shoutout_claims/claim1': { authorUid: 'u1' },
        'shoutout_claims/claim2': { authorUid: 'u2' },
        'shoutout_limits/forum_u1': { count: 2 },
        'shoutout_limits/market_u1': { count: 1 },
        'shoutout_limits/hour_u1': { count: 1 },
        'shoutout_limits/global': { count: 9 },
        'gift_secrets/g1': { ownerId: 'u1', reward: 'secret' },
        'gift_secrets/loose': { ownerId: 'u1', reward: 'loose' },
        'gift_secrets/keep': { ownerId: 'u2', reward: 'theirs' },
        'gift_pending_pairs/u1_u2': { n: 1 },
        'gift_pending_pairs/u2_u1': { n: 1 },
        'gift_pending_pairs/u2_u3': { n: 1 },
        'raid_bosses/b1': { name: 'boss' },
        'raid_bosses/b1/participants/u1': { username: 'Alice', contributed: 12 },
        'raid_bosses/b1/participants/u2': { username: 'Bob', contributed: 4 },
        'raid_bosses/b1/winners/u1': { uid: 'u1', username: 'Alice', satsAwarded: 1000 },
        'raid_bosses/b1/winners/u2': { uid: 'u2', username: 'Bob', satsAwarded: 1000 },
        'raid_bosses/old/participants/u1': { uid: 'u1', username: 'Alice', contributed: 1 },
        'raid_daily_caps/u1_2026-10-22_chat': { contributed: 3 },
        'raid_daily_caps/u2_2026-10-22_chat': { contributed: 1 },
        'raid_deck_completions/b1_u1_deck': { uid: 'u1', deck: 'deck' },
        'raid_deck_completions/b1_u2_deck': { uid: 'u2', deck: 'deck' },
        'raid_damage_events/2026-11_u1_chat-1': { uid: 'u1', metric: 'chatMessages' },
        'raid_damage_events/2026-11_u2_chat-1': { uid: 'u2', metric: 'chatMessages' },
        'raid_forum_pending/forum-u1': { uid: 'u1', status: 'pending' },
        'raid_forum_pending/forum-u2': { uid: 'u2', status: 'pending' },
        'action_cooldowns/u1_chat_message': { t: 1 },
        'action_cooldowns/u2_chat_message': { t: 1 },
        'rate_limits/bridge_u1': { n: 1 },
        'rate_limits/v4v_u1': { n: 1 },
        'rate_limits/sayhi_u1': { n: 1 },
        'rate_limits/announce_u1': { n: 1 },
        'rate_limits/nostr_203_0_113_8': { n: 1 },
        'totp_rate_limits/u1': { n: 1 },
        'totp_rate_limits/u1_day': { failedAttempts: 3 },
        'totp_rate_limits/u1_verify': { n: 1 },
        'weekly_challenges/w1': { participants: { u1: true, u2: true } },
        'weekly_challenges/w1/user_contribs/u1_chat': { count: 2 },
        'weekly_challenges/w1/user_contribs/u2_chat': { count: 1 },
        'leaderboard_winners/week': { winners: [{ uid: 'u1', username: 'Alice', xp: 10 }, { uid: 'u2', username: 'Bob', xp: 3 }] },
        'stats/raffle_2026-09_snapshot': {
            winner: 'Alice', winnerUid: 'u1',
            allEntrants: { u1: { username: 'Alice', entries: 4 }, u2: { username: 'Bob', entries: 1 } },
        },
        'stats/global': { chatMessages: 10 },
        'stats/countries': { counts: { US: 1 } },
        'key_send_pairs/u1_u2': { senderUid: 'u1', recipientUid: 'u2' },
        'key_send_pairs/u9_u1': { senderUid: 'u9', recipientUid: 'u1' },
        'key_send_pairs/u2_u3': { senderUid: 'u2', recipientUid: 'u3' },
        'quest_answer_keys/q1': { uid: 'u1', answer: '21' },
        'quest_answer_keys/q2': { uid: 'u2', answer: '1' },
        'scholar_exam_keys/e1': { uid: 'u1' },
        'channel_ratings/rate1': { userId: 'u1', rating: 5 },
        'channel_ratings/rate2': { userId: 'u2', rating: 4 },
        'satoshiFavor/current': { lowestHashThisWindowUid: 'u1', lowestHashThisWindowUsername: 'Alice' },
        'satoshiFavor/current/contributors/u1_chat': { uid: 'u1', username: 'Alice', points: 5 },
        'buddy_matches/bm1': { user1: { uid: 'u1', name: 'Alice' }, user2: { uid: 'u2', name: 'Bob' } },
        'pvp_matches/pm1': { player1: { uid: 'u2' }, player2: { uid: 'u1' } },
        'hotTopics/latest': { summary: 'public topics' },
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

function okAuth(db, capPath, extras) {
    const calls = [];
    return {
        calls: calls,
        revokeRefreshTokens: async function(uid) { calls.push('revoke:' + uid); },
        deleteUser: async function(uid) {
            calls.push('delete:' + uid);
            if (db && capPath) calls.push(db.docs.has(capPath) ? 'caps-present' : 'caps-gone');
            (extras || []).forEach(function(item) {
                calls.push(item.label + ':' + (item.present() ? 'present' : 'gone'));
            });
        },
    };
}

function auth(uid, extras) {
    return Object.assign({ uid: uid, token: { auth_time: 1000, admin: false } }, extras || {});
}

(async function() {
    execFileSync(process.execPath, ['--check', path.join(root, 'functions', 'src', 'deleteAccount.js')], { stdio: 'pipe' });
    execFileSync(process.execPath, ['--check', path.join(root, 'functions', 'src', 'secondFactor.js')], { stdio: 'pipe' });
    execFileSync(process.execPath, ['--check', path.join(root, 'functions', 'src', 'rateLimitSalt.js')], { stdio: 'pipe' });

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
        const nostr = 'nostr:' + 'ab'.repeat(32);
        const ln = 'ln:' + 'cd'.repeat(33);
        assert.strictEqual(del.authorizeDeleteAccount(auth(nostr, { token: { auth_time: 1000 } }), {}, now).uid, nostr);
        assert.strictEqual(del.authorizeDeleteAccount(auth(ln, { token: { auth_time: 1000 } }), {}, now).uid, ln);
        assert.strictEqual(del.authorizeDeleteAccount(auth('a/b', { token: { auth_time: 1000 } }), {}, now).code, 'invalid-argument');
        assert.strictEqual(del.authorizeDeleteAccount(auth('has space', { token: { auth_time: 1000 } }), {}, now).code, 'invalid-argument');
        assert.strictEqual(del.UID_RE.test('..'), false);
        assert.strictEqual(del.UID_RE.test('guestAnon1'), true);
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
        const authApi = okAuth(db, 'users/u1/daily_points/2026-10-22', [
            { label: 'storage', present: function() { return bucket.files.has('beats/u1/song.mp3'); } },
            { label: 'dedupe', present: function() { return db.docs.has('raid_deck_completions/b1_u1_deck'); } },
            { label: 'claims', present: function() { return db.docs.has('shoutout_claims/claim1'); } },
            { label: 'pairs', present: function() { return db.docs.has('gift_pending_pairs/u1_u2'); } },
            { label: 'walk', present: function() { return db.docs.has('users/u1/proof_of_walk/act1'); } },
        ]);
        const summary = await del.purgeAccount({ db: db, bucket: bucket, authApi: authApi, uid: 'u1', documentIdField: '__name__' });
        assert.strictEqual(summary.anonymizedChat, 1);
        assert.strictEqual(summary.authDeleted, true);
        assert.ok(authApi.calls.indexOf('revoke:u1') !== -1);
        assert.ok(authApi.calls.indexOf('revoke:u1') < authApi.calls.indexOf('delete:u1'));
        assert.ok(authApi.calls.indexOf('caps-present') !== -1);
        assert.ok(authApi.calls.indexOf('storage:present') !== -1);
        assert.ok(authApi.calls.indexOf('dedupe:present') !== -1);
        assert.ok(authApi.calls.indexOf('claims:present') !== -1);
        assert.ok(authApi.calls.indexOf('pairs:present') !== -1);
        assert.ok(authApi.calls.indexOf('walk:present') !== -1);
        assert.ok(db.commits.some(function(n) { return n === del.BATCH_LIMIT; }), 'a batch should fill to the limit');
        assert.ok(db.commits.every(function(n) { return n <= del.BATCH_LIMIT; }));

        assert.strictEqual(db.docs.has('users/u1'), false);
        assert.strictEqual(db.docs.has('telegram_mirror_queue/global_chat__m1'), false);
        assert.ok(db.docs.has('telegram_mirror_queue/global_chat__m2'));
        assert.strictEqual(db.docs.has('telegram_mirror_claims/global_chat__m1'), false);
        assert.strictEqual(db.docs.has('telegram_mirror_state/rate_u1'), false);
        assert.ok(db.docs.has('telegram_mirror_state/group'));
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
        assert.deepStrictEqual(db.docs.get('global_chat/m3').reactions, { '🔥': ['u2'] });
        assert.strictEqual(db.docs.get('global_chat/nacho1').mentionUid, '');
        assert.ok(db.docs.get('global_chat/nacho1').text.indexOf('@[deleted]') !== -1);
        assert.ok(db.docs.get('global_chat/nacho1').text.indexOf('@Bob') !== -1);
        assert.strictEqual(db.docs.get('global_chat/nacho1').uid, 'nacho-bot');
        assert.deepStrictEqual(db.docs.get('announcements/a1').reactions, { '🎉': ['u9'] });
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
        assert.ok(db.docs.has('usernames/orphan'));
        assert.strictEqual(db.docs.has('public_profiles/u1'), false);
        assert.ok(db.docs.has('public_profiles/u2'));
        assert.strictEqual(db.docs.has('username_migrations/u1'), false);
        assert.strictEqual(db.docs.get('username_migrations/u2').from, 'Bob Two');
        assert.strictEqual(db.docs.has('users/u1'), false);

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
        assert.deepStrictEqual(db.docs.get('beats_tracks/t2').likedBy, ['u2']);
        assert.strictEqual(db.docs.get('beats_tracks/t2').likes, 1);
        assert.deepStrictEqual(db.docs.get('beats_tracks/t3').likedBy, ['u2']);
        assert.strictEqual(db.docs.get('beats_tracks/t3').likes, 1);
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
        assert.strictEqual(db.docs.has('totp_sessions/u1'), false);
        assert.strictEqual(db.docs.has('trusted_devices/devu1'), false);
        assert.ok(db.docs.has('trusted_devices/devu2'));
        assert.strictEqual(db.docs.has('nacho_feedback/f1'), false);
        assert.ok(db.docs.has('nacho_feedback/f2'));
        assert.strictEqual(db.docs.has('nacho_misses/miss1'), false);
        assert.strictEqual(db.docs.has('nacho_bad_matches/bad1'), false);
        assert.strictEqual(db.docs.get('analytics/nacho_feedback').count, 9);
        assert.strictEqual(db.docs.get('analytics/nacho_misses').count, 3);
        assert.strictEqual(db.docs.has('ai_tools_opens/open1'), false);
        assert.ok(db.docs.has('ai_tools_opens/open2'));
        assert.strictEqual(db.docs.has('channel_feedback/cf1'), false);
        assert.ok(db.docs.has('channel_feedback/cf2'));
        assert.deepStrictEqual(db.docs.get('poll_votes/poll1').voters, ['u2']);
        assert.deepStrictEqual(db.docs.get('poll_votes/poll1').votes, [1, 1, 0, 0]);
        assert.deepStrictEqual(db.docs.get('poll_votes/poll2').voters, ['u2']);
        assert.deepStrictEqual(db.docs.get('poll_votes/poll2').votes, [0, 1, 0, 0]);
        assert.strictEqual(db.docs.has('reply_bonus_state/u1'), false);
        assert.ok(db.docs.has('reply_bonus_state/u2'));
        assert.strictEqual(db.docs.has('reply_bonus_pairs/p_u1__u2'), false);
        assert.strictEqual(db.docs.has('reply_bonus_pairs/p_u2__u1'), false);
        assert.ok(db.docs.has('reply_bonus_pairs/p_u2__u3'));
        assert.strictEqual(db.docs.has('reply_bonus_claims/msg1'), false);
        assert.strictEqual(db.docs.has('reply_bonus_claims/msg2'), false);
        assert.ok(db.docs.has('reply_bonus_claims/msg3'));
        assert.strictEqual(db.docs.has('rate_limits/reply_u1'), false);
        assert.ok(db.docs.has('rate_limits/reply_u2'));
        assert.strictEqual(db.docs.has('market_listing_counts/l1'), false);
        assert.ok(db.docs.has('market_listing_counts/l2'));
        assert.strictEqual(db.docs.has('tctv_watch/u1'), false);
        assert.ok(db.docs.has('tctv_watch/u2'));
        assert.strictEqual(db.docs.has('users/u1/quest_completions/q9'), false);
        assert.strictEqual(db.docs.has('users/u1/quest_passes/q9'), false);
        assert.strictEqual(db.docs.has('users/u1/lifetime_awards/life1'), false);
        assert.strictEqual(db.docs.has('users/u1/onboarding_evidence/ev1'), false);
        assert.strictEqual(db.docs.get('suspicious_activity/sa1').email, 'alice@example.com');
        assert.ok(db.docs.has('watchlist_snapshots/u1'));
        assert.strictEqual(db.docs.get('beats_reports/br1').reporterId, 'u1');
        assert.strictEqual(db.docs.has('global_chat_meta/live_dj/dj_queue/u1'), false);
        assert.strictEqual(db.docs.has('satoshiFavor/personalBests/users/u1'), false);
        assert.strictEqual(db.docs.get('satoshiFavor/current/session_hashes/u1').username, '[deleted]');
        assert.strictEqual(db.docs.get('satoshiFavor/current/session_hashes/u1').count, 4);
        assert.strictEqual(db.docs.get('satoshiFavor/current/hashes/h1').username, '[deleted]');
        assert.strictEqual(db.docs.get('satoshiFavor/current/hashes/h1').value, '000abc');
        assert.strictEqual(db.docs.get('satoshiFavor/current').lowestHashThisWindowUsername, '[deleted]');
        assert.strictEqual(db.docs.get('satoshiFavor/current').lowestHashThisWindowUid, 'u1');
        assert.strictEqual(db.docs.get('satoshiFavor/current/contributors/u1_chat').username, '[deleted]');
        assert.strictEqual(db.docs.get('satoshiFavor/current/contributors/u1_chat').points, 5);
        assert.strictEqual(db.docs.get('raid_bosses/b1/participants/u1').username, '[deleted]');
        assert.strictEqual(db.docs.get('raid_bosses/b1/participants/u1').contributed, 12);
        assert.strictEqual(db.docs.get('raid_bosses/b1/participants/u2').username, 'Bob');
        assert.strictEqual(db.docs.get('raid_bosses/b1/winners/u1').username, '[deleted]');
        assert.strictEqual(db.docs.get('raid_bosses/b1/winners/u1').satsAwarded, 1000);
        assert.strictEqual(db.docs.get('raid_bosses/b1/winners/u1').uid, 'u1');
        assert.strictEqual(db.docs.get('raid_bosses/b1/winners/u2').username, 'Bob');
        assert.strictEqual(db.docs.get('raid_bosses/old/participants/u1').username, '[deleted]');
        assert.strictEqual(db.docs.get('raid_bosses/old/participants/u1').contributed, 1);
        assert.strictEqual(db.docs.has('raid_deck_completions/b1_u1_deck'), false);
        assert.ok(db.docs.has('raid_deck_completions/b1_u2_deck'));
        assert.strictEqual(db.docs.has('raid_damage_events/2026-11_u1_chat-1'), false);
        assert.ok(db.docs.has('raid_damage_events/2026-11_u2_chat-1'));
        assert.strictEqual(db.docs.has('raid_forum_pending/forum-u1'), false);
        assert.ok(db.docs.has('raid_forum_pending/forum-u2'));
        assert.strictEqual(db.docs.has('shoutout_claims/claim1'), false);
        assert.ok(db.docs.has('shoutout_claims/claim2'));
        assert.strictEqual(db.docs.has('shoutout_limits/forum_u1'), false);
        assert.strictEqual(db.docs.has('shoutout_limits/market_u1'), false);
        assert.strictEqual(db.docs.has('shoutout_limits/hour_u1'), false);
        assert.strictEqual(db.docs.get('shoutout_limits/global').count, 9);
        assert.strictEqual(db.docs.has('gift_secrets/g1'), false);
        assert.strictEqual(db.docs.has('gift_secrets/loose'), false);
        assert.strictEqual(db.docs.get('gift_secrets/keep').ownerId, 'u2');
        assert.strictEqual(db.docs.has('gift_pending_pairs/u1_u2'), false);
        assert.strictEqual(db.docs.has('gift_pending_pairs/u2_u1'), false);
        assert.ok(db.docs.has('gift_pending_pairs/u2_u3'));
        assert.strictEqual(db.docs.has('action_cooldowns/u1_chat_message'), false);
        assert.ok(db.docs.has('action_cooldowns/u2_chat_message'));
        assert.strictEqual(db.docs.has('raid_daily_caps/u1_2026-10-22_chat'), false);
        assert.ok(db.docs.has('raid_daily_caps/u2_2026-10-22_chat'));
        assert.strictEqual(db.docs.has('rate_limits/bridge_u1'), false);
        assert.strictEqual(db.docs.has('rate_limits/v4v_u1'), false);
        assert.strictEqual(db.docs.has('rate_limits/sayhi_u1'), false);
        assert.strictEqual(db.docs.has('rate_limits/announce_u1'), false);
        assert.strictEqual(db.docs.get('rate_limits/nostr_203_0_113_8').n, 1);
        assert.strictEqual(db.docs.has('totp_rate_limits/u1'), false);
        assert.strictEqual(db.docs.has('totp_rate_limits/u1_day'), false);
        assert.strictEqual(db.docs.has('totp_rate_limits/u1_verify'), false);
        assert.strictEqual(db.docs.get('weekly_challenges/w1').participants.u1, undefined);
        assert.strictEqual(db.docs.get('weekly_challenges/w1').participants.u2, true);
        assert.strictEqual(db.docs.has('weekly_challenges/w1/user_contribs/u1_chat'), false);
        assert.strictEqual(db.docs.get('weekly_challenges/w1/user_contribs/u2_chat').count, 1);
        assert.strictEqual(db.docs.get('leaderboard_winners/week').winners[0].username, '[deleted]');
        assert.strictEqual(db.docs.get('leaderboard_winners/week').winners[0].xp, 10);
        assert.strictEqual(db.docs.get('leaderboard_winners/week').winners[1].username, 'Bob');
        const raffle = db.docs.get('stats/raffle_2026-09_snapshot');
        assert.strictEqual(raffle.winner, '[deleted]');
        assert.strictEqual(raffle.winnerUid, 'u1');
        assert.strictEqual(raffle.allEntrants.u1.username, '[deleted]');
        assert.strictEqual(raffle.allEntrants.u1.entries, 4);
        assert.strictEqual(raffle.allEntrants.u2.username, 'Bob');
        assert.strictEqual(db.docs.get('stats/global').chatMessages, 10);
        assert.strictEqual(db.docs.get('stats/countries').counts.US, 1);
        assert.strictEqual(db.docs.has('channel_ratings/rate1'), false);
        assert.ok(db.docs.has('channel_ratings/rate2'));
        assert.strictEqual(db.docs.has('key_send_pairs/u1_u2'), false);
        assert.strictEqual(db.docs.has('key_send_pairs/u9_u1'), false);
        assert.ok(db.docs.has('key_send_pairs/u2_u3'));
        assert.strictEqual(db.docs.has('quest_answer_keys/q1'), false);
        assert.ok(db.docs.has('quest_answer_keys/q2'));
        assert.strictEqual(db.docs.has('scholar_exam_keys/e1'), false);
        assert.strictEqual(db.docs.has('users/u1/sats_daily/2026-10-22'), false);
        assert.strictEqual(db.docs.has('users/u1/proof_of_walk/act1'), false);
        assert.strictEqual(db.docs.has('users/u1/proof_of_walk_stats/daily'), false);
        assert.strictEqual(db.docs.has('buddy_matches/bm1'), false);
        assert.strictEqual(db.docs.has('pvp_matches/pm1'), false);
        assert.strictEqual(db.docs.get('hotTopics/latest').summary, 'public topics');
        assert.ok(db.listCalls.indexOf('users/u1') !== -1);
        ['notifications/n1', 'keys/k1', 'peer_requests/pr1', 'dm_conversations/u1_u2', 'push_tokens/u1'].forEach(function(leaf) {
            assert.strictEqual(db.listCalls.indexOf(leaf), -1, leaf);
        });

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
        const again = await del.purgeAccount({ db: db, bucket: bucket, authApi: okAuth(), uid: 'u1', documentIdField: '__name__' });
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
        const first = await del.purgeAccount({ db: db, bucket: bucket, authApi: okAuth(), uid: 'u4', documentIdField: '__name__' });
        assert.strictEqual(first.anonymizedChat, 0);
        assert.strictEqual(db.docs.has('users/u4'), false);
        assert.strictEqual(db.docs.get('faucet_ledger/u4').satsWithdrawn, 10);
        await del.purgeAccount({ db: db, bucket: bucket, authApi: okAuth(), uid: 'u4', documentIdField: '__name__' });
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
        const adminAuth = okAuth();
        const adminHandlers = del.createDeleteAccountHandlers({
            db: db,
            bucket: createBucket(['beats/victim/a.mp3']),
            authApi: adminAuth,
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
        assert.strictEqual(result.authDeleted, true);
        assert.ok(adminAuth.calls.indexOf('delete:victim') !== -1);
        assert.strictEqual(db.docs.has('users/victim'), false);
        assert.strictEqual(db.docs.get('faucet_ledger/victim').satsWithdrawn, 7);
    });

    test('the client calls the server wipe and does not delete Firestore itself', function() {
        const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
        assert.ok(ranking.includes('z-index:450000'));
        assert.ok(ranking.includes('z-index:490000'));
        assert.ok(ranking.includes('html += accountEmailCardHtml(user)'));
        assert.ok(ranking.includes('html += accountDeleteRowHtml(user)'));
        assert.ok(ranking.includes('id="accountEmailCard"'));
        assert.ok(ranking.includes('id="accountDeleteButton"'));
        assert.strictEqual(ranking.includes('userData.email'), false);
        const createPayload = ranking.slice(ranking.indexOf('function clientCreatePayload'), ranking.indexOf('async function applyServerUsername'));
        assert.ok(!createPayload.includes('email'));
        const createUser = ranking.slice(ranking.indexOf('async function createUser'), ranking.indexOf('async function awardVisitPoints'));
        assert.ok(!createUser.includes('.email'));
        assert.ok(!createUser.includes('email:'));
        const finishEmail = ranking.slice(ranking.indexOf('async function finishEmailSignIn'), ranking.indexOf('function gisApiReady'));
        assert.ok(finishEmail.includes("collection('users')"));
        assert.ok(!finishEmail.includes('email:'));
        assert.ok(!finishEmail.includes('.email ='));
        assert.ok(ranking.includes("httpsCallable('deleteAccount', { timeout: 540000 })"));
        assert.ok(ranking.includes('_isMfaBlock'));
        assert.ok(ranking.includes('_showTotpSignInChallenge'));
        assert.ok(ranking.includes('Enter your authenticator code first.'));
        assert.strictEqual(ranking.includes('_promptDeleteAccountTotp'), false);
        assert.ok(fs.readFileSync(path.join(root, 'functions', 'src', 'deleteAccount.js'), 'utf8').includes("secondFactor.requireFreshStepUp(secondFactor.stamp(data, context), 'deleteAccount')"));
        assert.ok(ranking.includes("httpsCallable('totpCheck')"));
        assert.ok(ranking.includes('user.delete()'));
        assert.ok(ranking.includes('auth/user-not-found'));
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
        assert.ok(terms.includes('Settings includes a referral card with your personal link and a copy button.'));
        assert.strictEqual(terms.includes('You can mark a notice read or delete it'), false);
        assert.ok(terms.includes('You can mark a notice read.'));
        assert.ok(terms.includes('Nacho may announce a new thread in Global Chat.'));
        assert.ok(terms.includes('Nacho may announce a new listing in Global Chat.'));
        assert.ok(privacy.includes('deletes the Firebase sign-in itself'));
        assert.ok(privacy.includes('other person\'s messages'));
        assert.ok(privacy.includes('deleted for both people'));
        assert.ok(privacy.includes('keyed hash'));
        assert.ok(privacy.includes('expires after about a day'));
        assert.ok(privacy.includes('suspicious-activity notes'));
        assert.ok(privacy.includes('watchlist snapshots'));
        assert.ok(privacy.includes('Beats reports'));
        assert.ok(privacy.includes('vote totals stay'));
        assert.ok(privacy.includes('The referral reward at Maxi is 50 Orange Tickets') === false);
        const chat = fs.readFileSync(path.join(root, 'global-chat.js'), 'utf8');
        assert.ok(chat.includes("m.uid === 'deleted'"));
        assert.ok(chat.includes('!isDeleted'));
        assert.ok(chat.includes("uid !== 'deleted'"));
    });

    test('comments.authorId has a collection-group index, and other deletion queries stay single-field', function() {
        const indexes = JSON.parse(fs.readFileSync(path.join(root, 'firestore.indexes.json'), 'utf8'));
        const override = (indexes.fieldOverrides || []).find(function(item) {
            return item.collectionGroup === 'comments' && item.fieldPath === 'authorId';
        });
        assert.ok(override, 'missing comments.authorId override');
        const scopes = (override.indexes || []).map(function(item) { return item.queryScope + ':' + item.order; }).sort();
        assert.deepStrictEqual(scopes, [
            'COLLECTION:ASCENDING',
            'COLLECTION:DESCENDING',
            'COLLECTION_GROUP:ASCENDING',
            'COLLECTION_GROUP:DESCENDING',
        ]);
        const groups = del.INDEX_AUDIT.collectionGroupQueries.map(function(query) {
            return query.collection + '.' + query.field;
        }).sort();
        assert.deepStrictEqual(groups, [
            'comments.authorId',
            'participants.uid',
            'participants.username',
            'posts.uid',
            'winners.uid',
        ]);
        del.INDEX_AUDIT.collectionQueries.forEach(function(query) {
            assert.ok(query.op === '==' || query.op === 'array-contains' || query.op === 'in', query.collection);
            assert.strictEqual(query.field.indexOf(','), -1, query.field);
            assert.strictEqual(query.orderBy, '__name__');
        });
        ['winners.uid', 'participants.uid', 'participants.username'].forEach(function(key) {
            const parts = key.split('.');
            const override = (indexes.fieldOverrides || []).find(function(item) {
                return item.collectionGroup === parts[0] && item.fieldPath === parts[1];
            });
            assert.ok(override, 'missing override ' + key);
            const scopes = (override.indexes || []).map(function(item) { return item.queryScope + ':' + item.order; }).sort();
            assert.deepStrictEqual(scopes, [
                'COLLECTION:ASCENDING',
                'COLLECTION:DESCENDING',
                'COLLECTION_GROUP:ASCENDING',
                'COLLECTION_GROUP:DESCENDING',
            ]);
        });
        const src = fs.readFileSync(path.join(root, 'functions', 'src', 'deleteAccount.js'), 'utf8');
        assert.ok(src.includes("collectionGroup('comments')"));
        assert.ok(src.includes("collectionGroup('winners')"));
        assert.ok(src.includes("collectionGroup('participants')"));
        assert.ok(src.includes('timeoutSeconds: 540'));
        assert.ok(src.includes("memory: '1GB'"));
        assert.ok(src.includes('enforceAppCheck: true'));
        assert.ok(src.includes('deleteUser'));
        assert.ok(src.includes('revokeRefreshTokens'));
        assert.ok(src.includes('REACTION_SCAN_CAP'));
        assert.ok(src.includes("'\\uf8ff'") || src.includes('\\uf8ff'));
        assert.strictEqual(src.includes("collectDocs(db.collection('global_chat'),"), false);
        assert.strictEqual(src.includes("collectDocs(db.collection('raid_bosses'),"), false);
        assert.strictEqual(src.includes("collectDocs(db.collection('stats'),"), false);
        assert.strictEqual(src.includes("collectDocs(db.collection('gift_pending_pairs'),"), false);
        assert.strictEqual(src.includes("collectDocs(db.collection('action_cooldowns'),"), false);
    });

    test('a shoutout keeps every @mention except the tagged user', function() {
        const both = del.anonymizeMentionText('Shoutout to @Alice and @Bob', 'Alice');
        assert.strictEqual(both, 'Shoutout to @[deleted] and @Bob');
        const twice = del.anonymizeMentionText('Go send @Alice a request, @Alice', 'Alice');
        assert.strictEqual(twice, 'Go send @[deleted] a request, @[deleted]');
        const unknown = del.anonymizeMentionText('Hi @Alice and @Bob', '');
        assert.strictEqual(unknown, 'Hi @[deleted] and @Bob');
        assert.deepStrictEqual(del.reactionsWithoutUid({ '🔥': ['u1', 'u2'], '✨': ['u1'] }, 'u1'), { '🔥': ['u2'] });
    });

    await testAsync('caps stay when auth deletion fails, and a missing user still clears them', async function() {
        const db = createFakeDb(world());
        const failing = {
            calls: [],
            revokeRefreshTokens: async function(uid) { this.calls.push('revoke:' + uid); },
            deleteUser: async function(uid) {
                this.calls.push('delete:' + uid);
                const err = new Error('unavailable');
                err.code = 'auth/internal-error';
                throw err;
            },
        };
        const bucket = createBucket(['beats/u1/song.mp3']);
        await assert.rejects(
            del.purgeAccount({ db: db, bucket: bucket, authApi: failing, uid: 'u1', documentIdField: '__name__' }),
            function(err) { return err.code === 'auth/internal-error'; }
        );
        assert.ok(failing.calls.indexOf('delete:u1') !== -1);
        assert.ok(db.docs.has('users/u1/daily_points/2026-10-22'));
        assert.ok(db.docs.has('users/u1/daily_action_counts/2026-10-22'));
        assert.ok(db.docs.has('users/u1/badge_awards/b1'));
        assert.ok(db.docs.has('shoutout_limits/forum_u1'));
        assert.ok(db.docs.has('action_cooldowns/u1_chat_message'));
        assert.ok(db.docs.has('raid_daily_caps/u1_2026-10-22_chat'));
        assert.ok(db.docs.has('shoutout_claims/claim1'));
        assert.ok(db.docs.has('key_send_pairs/u1_u2'));
        assert.ok(db.docs.has('gift_pending_pairs/u1_u2'));
        assert.ok(db.docs.has('users/u1/sats_daily/2026-10-22'));
        assert.ok(db.docs.has('users/u1/proof_of_walk/act1'));
        assert.ok(db.docs.has('users/u1/quest_completions/q9'));
        assert.ok(db.docs.has('users/u1/quest_passes/q9'));
        assert.ok(db.docs.has('users/u1/lifetime_awards/life1'));
        assert.ok(db.docs.has('users/u1/onboarding_evidence/ev1'));
        assert.ok(db.docs.has('reply_bonus_state/u1'));
        assert.ok(db.docs.has('reply_bonus_pairs/p_u1__u2'));
        assert.ok(db.docs.has('market_listing_counts/l1'));
        assert.ok(db.docs.has('tctv_watch/u1'));
        assert.deepStrictEqual(db.docs.get('poll_votes/poll1').voters, ['u1', 'u2']);
        assert.strictEqual(db.docs.has('totp_sessions/u1'), false);
        assert.strictEqual(db.docs.has('nacho_feedback/f1'), false);
        assert.deepStrictEqual(db.docs.get('beats_tracks/t2').likedBy, ['u2']);
        assert.ok(db.docs.has('quest_answer_keys/q1'));
        assert.ok(bucket.files.has('beats/u1/song.mp3'));

        const missing = {
            revokeRefreshTokens: async function() {
                const err = new Error('gone');
                err.code = 'auth/user-not-found';
                throw err;
            },
            deleteUser: async function() {
                const err = new Error('gone');
                err.code = 'auth/user-not-found';
                throw err;
            },
        };
        const summary = await del.purgeAccount({
            db: db,
            bucket: createBucket([]),
            authApi: missing,
            uid: 'u1',
            documentIdField: '__name__',
        });
        assert.strictEqual(summary.authDeleted, true);
        assert.strictEqual(db.docs.has('users/u1/daily_points/2026-10-22'), false);
        assert.strictEqual(db.docs.has('users/u1/daily_action_counts/2026-10-22'), false);
        assert.strictEqual(db.docs.has('users/u1/badge_awards/b1'), false);
        assert.strictEqual(db.docs.has('users/u1/quest_completions/q9'), false);
        assert.strictEqual(db.docs.has('users/u1/quest_passes/q9'), false);
        assert.strictEqual(db.docs.has('users/u1/lifetime_awards/life1'), false);
        assert.strictEqual(db.docs.has('users/u1/onboarding_evidence/ev1'), false);
        assert.strictEqual(db.docs.has('reply_bonus_state/u1'), false);
        assert.strictEqual(db.docs.has('market_listing_counts/l1'), false);
        assert.strictEqual(db.docs.has('tctv_watch/u1'), false);
        assert.deepStrictEqual(db.docs.get('poll_votes/poll1').voters, ['u2']);
        assert.strictEqual(db.docs.has('shoutout_limits/forum_u1'), false);
        assert.strictEqual(db.docs.has('action_cooldowns/u1_chat_message'), false);
        assert.ok(db.docs.has('shoutout_limits/global'));
        assert.ok(db.docs.has('rate_limits/nostr_203_0_113_8'));
    });

    await testAsync('a guest delete skips chat, raid, raffle, and weekly, and still removes the sign-in', async function() {
        const db = createFakeDb(world());
        const now = 1000 + del.REAUTH_MAX_AGE_SEC;
        const authApi = okAuth();
        const handlers = del.createDeleteAccountHandlers({
            db: db,
            bucket: createBucket([]),
            authApi: authApi,
            HttpsError: HttpsError,
            nowSec: function() { return now; },
            nowMs: function() { return 5000; },
            documentIdField: '__name__',
            ipSecret: 'unit-secret',
        });
        const result = await handlers.deleteAccount({}, {
            auth: { uid: 'u1', token: { auth_time: 1000, firebase: { sign_in_provider: 'anonymous' } } },
            rawRequest: { headers: { 'x-forwarded-for': '198.51.100.8, 203.0.113.9' } },
        });
        assert.strictEqual(result.light, true);
        assert.strictEqual(result.authDeleted, true);
        assert.ok(authApi.calls.indexOf('delete:u1') !== -1);
        assert.strictEqual(db.docs.get('global_chat/m1').uid, 'u1');
        assert.strictEqual(db.docs.get('global_chat/m1').text, 'hello secret');
        assert.deepStrictEqual(db.docs.get('global_chat/m3').reactions['🔥'], ['u1', 'u2']);
        assert.strictEqual(db.docs.get('raid_bosses/b1/winners/u1').username, 'Alice');
        assert.strictEqual(db.docs.get('weekly_challenges/w1').participants.u1, true);
        assert.ok(db.docs.has('weekly_challenges/w1/user_contribs/u1_chat'));
        assert.strictEqual(db.docs.has('users/u1'), false);
        assert.strictEqual(db.docs.has('forum_posts/p1'), false);
        assert.strictEqual(db.docs.has('users/u1/daily_points/2026-10-22'), false);
        const ipDoc = del.deletionIpDocId('203.0.113.9', 5000, 'unit-secret');
        const ipRow = db.docs.get('rate_limits/' + ipDoc);
        assert.strictEqual(ipRow.count, 1);
        assert.ok(ipRow.expireAt instanceof Date);
        assert.strictEqual(ipRow.expireAt.getTime(), 5000 + del.DELETE_RATE_TTL_MS);
        assert.strictEqual(JSON.stringify(ipRow).indexOf('203.0.113.9'), -1);
        assert.strictEqual(JSON.stringify(ipRow).indexOf('198.51.100.8'), -1);
        assert.strictEqual(db.docs.has('rate_limits/deleteip_203_0_113_9'), false);
        assert.ok(db.docs.has('rate_limits/nostr_203_0_113_8'));
    });

    await testAsync('account deletion is rate limited per account and per network', async function() {
        const now = 1000 + del.REAUTH_MAX_AGE_SEC;
        const db = createFakeDb({ 'users/u1': { username: 'Alice' }, 'faucet_ledger/u1': { satsWithdrawn: 3 } });
        db.docs.set('rate_limits/delete_u1', { windowStart: 5000, count: del.DELETE_RATE_MAX_UID });
        const authApi = okAuth();
        const handlers = del.createDeleteAccountHandlers({
            db: db,
            bucket: createBucket([]),
            authApi: authApi,
            HttpsError: HttpsError,
            nowSec: function() { return now; },
            nowMs: function() { return 5000; },
            documentIdField: '__name__',
            ipSecret: 'unit-secret',
        });
        await assert.rejects(
            handlers.deleteAccount({}, { auth: auth('u1', { token: { auth_time: 1000 } }) }),
            function(err) { return err.code === 'resource-exhausted'; }
        );
        assert.strictEqual(authApi.calls.length, 0);
        assert.ok(db.docs.has('users/u1'));
        assert.strictEqual(db.docs.get('faucet_ledger/u1').satsWithdrawn, 3);

        const anonDb = createFakeDb({ 'users/guest': { username: 'Guest' } });
        const anonIp = del.deletionIpDocId('203.0.113.9', 5000, 'unit-secret');
        anonDb.docs.set('rate_limits/' + anonIp, { windowStart: 5000, count: del.DELETE_RATE_MAX_ANON_IP });
        const anonHandlers = del.createDeleteAccountHandlers({
            db: anonDb,
            bucket: createBucket([]),
            authApi: okAuth(),
            HttpsError: HttpsError,
            nowSec: function() { return now; },
            nowMs: function() { return 5000; },
            documentIdField: '__name__',
            ipSecret: 'unit-secret',
        });
        await assert.rejects(
            anonHandlers.deleteAccount({}, {
                auth: { uid: 'guest', token: { auth_time: 1000, firebase: { sign_in_provider: 'anonymous' } } },
                rawRequest: { headers: { 'x-forwarded-for': '10.0.0.1, 203.0.113.9' } },
            }),
            function(err) { return err.code === 'resource-exhausted'; }
        );
        assert.ok(anonDb.docs.has('users/guest'));
    });

    await testAsync('Google, email, Nostr, Lightning, and guest ids can be deleted', async function() {
        const ids = [
            'G00gleUser_1',
            'emailUser_2',
            'nostr:' + 'ab'.repeat(32),
            'ln:' + 'cd'.repeat(33),
            'guestAnon99',
        ];
        for (let i = 0; i < ids.length; i++) {
            const uid = ids[i];
            const db = createFakeDb({});
            db.docs.set('users/' + uid, { username: 'P' + i });
            const authApi = okAuth();
            const handlers = del.createDeleteAccountHandlers({
                db: db,
                bucket: createBucket([]),
                authApi: authApi,
                HttpsError: HttpsError,
                nowSec: function() { return 1000 + del.REAUTH_MAX_AGE_SEC; },
                nowMs: function() { return 5000; },
                documentIdField: '__name__',
                ipSecret: 'unit-secret',
            });
            const token = { auth_time: 1000 };
            if (uid.indexOf('guest') === 0) token.firebase = { sign_in_provider: 'anonymous' };
            const result = await handlers.deleteAccount({}, {
                auth: { uid: uid, token: token },
                rawRequest: { headers: { 'x-forwarded-for': '203.0.113.50' } },
            });
            assert.strictEqual(result.authDeleted, true, uid);
            assert.strictEqual(db.docs.has('users/' + uid), false, uid);
            assert.ok(authApi.calls.indexOf('delete:' + uid) !== -1, uid);
            const ipPath = 'rate_limits/' + del.deletionIpDocId('203.0.113.50', 5000, 'unit-secret');
            const row = db.docs.get(ipPath);
            assert.ok(row, uid);
            assert.strictEqual(JSON.stringify(row).indexOf('203.0.113.50'), -1, uid);
            assert.ok(!(ipPath.indexOf('203.0.113.50') !== -1), uid);
        }
    });

    await testAsync('an invalid id is rejected before a rate-limit row is written', async function() {
        const db = createFakeDb({ 'users/bad': { username: 'Bad' } });
        const handlers = del.createDeleteAccountHandlers({
            db: db,
            bucket: createBucket([]),
            authApi: okAuth(),
            HttpsError: HttpsError,
            nowSec: function() { return 1000 + del.REAUTH_MAX_AGE_SEC; },
            nowMs: function() { return 5000; },
            documentIdField: '__name__',
            ipSecret: 'unit-secret',
        });
        const badIds = ['../x', 'a/b', 'has space', '..'];
        for (let i = 0; i < badIds.length; i++) {
            await assert.rejects(
                handlers.deleteAccount({}, { auth: { uid: badIds[i], token: { auth_time: 1000 } } }),
                function(err) { return err.code === 'invalid-argument'; }
            );
        }
        for (const key of db.docs.keys()) {
            assert.strictEqual(key.indexOf('rate_limits/'), -1, key);
        }
        assert.ok(db.docs.has('users/bad'));
    });

    await testAsync('authenticator 2FA is required for the owner and skipped for an admin', async function() {
        const now = 1000 + del.REAUTH_MAX_AGE_SEC;
        const sessionId = 'ab'.repeat(32);
        const expiresAtMs = Date.now() + (12 * 60 * 60 * 1000);
        function handlers(db) {
            return del.createDeleteAccountHandlers({
                db: db,
                bucket: createBucket([]),
                authApi: okAuth(),
                HttpsError: HttpsError,
                nowSec: function() { return now; },
                nowMs: function() { return 5000; },
                documentIdField: '__name__',
                ipSecret: 'unit-secret',
            });
        }
        function call(db, auth, data) {
            return handlers(db).deleteAccount(data || {}, { auth: auth, rawRequest: { headers: {} } });
        }
        const blocked = createFakeDb({
            'users/u1': { username: 'Alice' },
            'totp_secrets/u1': { enabled: true, secret: 'abc' },
        });
        await assert.rejects(
            call(blocked, { uid: 'u1', token: { auth_time: 1000 } }),
            function(err) { return err.code === 'failed-precondition' && /fresh authenticator/.test(err.message); }
        );
        assert.ok(blocked.docs.has('users/u1'));
        for (const key of blocked.docs.keys()) {
            assert.strictEqual(key.indexOf('rate_limits/delete'), -1, key);
        }

        const stale = createFakeDb({
            'users/u1': { username: 'Alice' },
            'totp_secrets/u1': { enabled: true },
            'totp_sessions/u1': { verified: true, verifiedAt: 999000 },
        });
        await assert.rejects(
            call(stale, { uid: 'u1', token: { auth_time: 1000 } }, { mfaSessionId: sessionId }),
            function(err) { return err.code === 'failed-precondition' && /fresh authenticator/.test(err.message); }
        );
        assert.ok(stale.docs.has('users/u1'));
        assert.ok(stale.docs.has('totp_sessions/u1'));

        const proofId = 'cd'.repeat(16);
        const sessionOnly = createFakeDb({
            'users/u1': { username: 'Alice' },
            'totp_secrets/u1': { enabled: true },
            ['totp_sessions/u1_' + sessionId]: {
                uid: 'u1',
                sessionId: sessionId,
                expiresAtMs: expiresAtMs,
                expireAt: new Date(expiresAtMs),
                revoked: false,
            },
        });
        await assert.rejects(
            call(sessionOnly, { uid: 'u1', token: { auth_time: 1000 } }, { mfaSessionId: sessionId }),
            function(err) { return err.code === 'failed-precondition' && /fresh authenticator/.test(err.message); }
        );
        assert.ok(sessionOnly.docs.has('users/u1'));
        const fresh = createFakeDb({
            'users/u1': { username: 'Alice' },
            'totp_secrets/u1': { enabled: true },
            'totp_pending/u1': { secret: 'pending' },
            'recovery_codes/u1': { codes: [{ used: false }] },
            'totp_rate_limits/u1_regen': { attempts: 1 },
            'totp_rate_limits/u1_day': { failedAttempts: 2 },
            ['totp_sessions/u1_' + sessionId]: {
                uid: 'u1',
                sessionId: sessionId,
                expiresAtMs: expiresAtMs,
                expireAt: new Date(expiresAtMs),
                revoked: false,
            },
            'totp_fresh_proofs/u1_deleteAccount': {
                uid: 'u1',
                action: 'deleteAccount',
                proofId: proofId,
                verifiedAtMs: Date.now(),
                expiresAtMs: Date.now() + (5 * 60 * 1000),
                consumed: false,
            },
            'trusted_devices/keepme': { uid: 'u1', tokenHash: 'abc', revoked: false },
        });
        const freshResult = await call(fresh, { uid: 'u1', token: { auth_time: 1000 } }, { mfaSessionId: sessionId, freshProofId: proofId });
        assert.strictEqual(freshResult.authDeleted, true);
        assert.strictEqual(fresh.docs.has('users/u1'), false);
        assert.strictEqual(fresh.docs.has('totp_secrets/u1'), false);
        assert.strictEqual(fresh.docs.has('totp_pending/u1'), false);
        assert.strictEqual(fresh.docs.has('recovery_codes/u1'), false);
        assert.strictEqual(fresh.docs.has('totp_rate_limits/u1_regen'), false);
        assert.strictEqual(fresh.docs.has('totp_rate_limits/u1_day'), false);
        assert.strictEqual(fresh.docs.has('totp_sessions/u1_' + sessionId), false);

        const off = createFakeDb({ 'users/u1': { username: 'Alice' } });
        const offResult = await call(off, { uid: 'u1', token: { auth_time: 1000 } });
        assert.strictEqual(offResult.authDeleted, true);

        const disabled = createFakeDb({
            'users/u1': { username: 'Alice' },
            'totp_secrets/u1': { enabled: false },
            'totp_sessions/u1': { verified: true, verifiedAt: 1 },
        });
        const disabledResult = await call(disabled, { uid: 'u1', token: { auth_time: 1000 } });
        assert.strictEqual(disabledResult.authDeleted, true);
        assert.strictEqual(disabled.docs.has('totp_sessions/u1'), false);

        const phone = createFakeDb({ 'users/u1': { username: 'Alice' } });
        const phoneResult = await call(phone, {
            uid: 'u1',
            token: { auth_time: 1000, firebase: { sign_in_provider: 'phone' } },
        });
        assert.strictEqual(phoneResult.authDeleted, true);

        const adminDb = createFakeDb({
            'users/u2': { username: 'Bob' },
            'totp_secrets/admin': { enabled: true },
            'totp_secrets/u2': { enabled: true },
            'recovery_codes/u2': { codes: [] },
            'totp_sessions/u2_deadbeef': { uid: 'u2', sessionId: 'deadbeef', expiresAtMs: expiresAtMs },
        });
        const adminResult = await handlers(adminDb).deleteAccount(
            { uid: 'u2' },
            { auth: { uid: 'admin', token: { admin: true, auth_time: 1 } }, rawRequest: { headers: {} } }
        );
        assert.strictEqual(adminResult.byAdmin, true);
        assert.strictEqual(adminResult.authDeleted, true);
        assert.strictEqual(adminDb.docs.has('users/u2'), false);
        assert.strictEqual(adminDb.docs.has('totp_secrets/u2'), false);
        assert.strictEqual(adminDb.docs.has('recovery_codes/u2'), false);
        assert.strictEqual(adminDb.docs.has('totp_sessions/u2_deadbeef'), false);
        assert.ok(adminDb.docs.has('totp_secrets/admin'));
    });

    await testAsync('a missing secret never uses the public daily string', async function() {
        const crypto = require('crypto');
        const prev = process.env.DELETE_RATE_IP_SECRET;
        delete process.env.DELETE_RATE_IP_SECRET;
        const saltMod = require(path.join(root, 'functions', 'src', 'rateLimitSalt'));
        saltMod.clearRateLimitSaltCache();
        try {
            assert.throws(function() { del.deletionIpDocId('203.0.113.9', 5000, ''); }, /missing/);
            assert.throws(function() { del.deletionIpDocId('203.0.113.9', 5000, 'delete-rate-1970-01-01'); }, /missing/);
            const publicId = 'deleteip_' + crypto.createHmac('sha256', 'delete-rate-1970-01-01').update('203.0.113.9|1970-01-01').digest('hex').slice(0, 40);
            const now = 1000 + del.REAUTH_MAX_AGE_SEC;
            const db = createFakeDb({ 'users/u1': { username: 'Alice' } });
            const handlers = del.createDeleteAccountHandlers({
                db: db,
                bucket: createBucket([]),
                authApi: okAuth(),
                HttpsError: HttpsError,
                nowSec: function() { return now; },
                nowMs: function() { return 5000; },
                documentIdField: '__name__',
            });
            const context = {
                auth: { uid: 'u1', token: { auth_time: 1000 } },
                rawRequest: { headers: { 'x-forwarded-for': '203.0.113.9' } },
            };
            await handlers.deleteAccount({}, context);
            const saltDoc = db.docs.get('rate_limit_salts/1970-01-01');
            assert.ok(saltDoc, 'server salt was not created');
            assert.ok(/^[a-f0-9]{64}$/.test(saltDoc.salt));
            assert.notStrictEqual(saltDoc.salt, 'delete-rate-1970-01-01');
            const ipDoc = del.deletionIpDocId('203.0.113.9', 5000, saltDoc.salt);
            assert.notStrictEqual(ipDoc, publicId);
            const row = db.docs.get('rate_limits/' + ipDoc);
            assert.strictEqual(row.count, 1);
            assert.strictEqual(JSON.stringify(row).indexOf('203.0.113.9'), -1);
            assert.strictEqual(ipDoc.indexOf('203.0.113.9'), -1);
            await handlers.deleteAccount({}, context);
            assert.strictEqual(db.docs.get('rate_limit_salts/1970-01-01').salt, saltDoc.salt);
            assert.strictEqual(db.docs.get('rate_limits/' + ipDoc).count, 2);

            saltMod.clearRateLimitSaltCache();
            process.env.DELETE_RATE_IP_SECRET = 'delete-rate-1970-01-01';
            const ignored = createFakeDb({ 'users/u9': { username: 'Nine' } });
            const ignoredHandlers = del.createDeleteAccountHandlers({
                db: ignored,
                bucket: createBucket([]),
                authApi: okAuth(),
                HttpsError: HttpsError,
                nowSec: function() { return now; },
                nowMs: function() { return 5000; },
                documentIdField: '__name__',
            });
            await ignoredHandlers.deleteAccount({}, {
                auth: { uid: 'u9', token: { auth_time: 1000 } },
                rawRequest: { headers: { 'x-forwarded-for': '203.0.113.9' } },
            });
            const ignoredSalt = ignored.docs.get('rate_limit_salts/1970-01-01').salt;
            assert.ok(/^[a-f0-9]{64}$/.test(ignoredSalt));
            const ignoredId = del.deletionIpDocId('203.0.113.9', 5000, ignoredSalt);
            assert.notStrictEqual(ignoredId, publicId);
            assert.ok(ignored.docs.has('rate_limits/' + ignoredId));

            saltMod.clearRateLimitSaltCache();
            const broken = createFakeDb({ 'users/u8': { username: 'Eight' } });
            broken.runTransaction = async function() { throw new Error('salt store down'); };
            const brokenHandlers = del.createDeleteAccountHandlers({
                db: broken,
                bucket: createBucket([]),
                authApi: okAuth(),
                HttpsError: HttpsError,
                nowSec: function() { return now; },
                nowMs: function() { return 5000; },
                documentIdField: '__name__',
            });
            delete process.env.DELETE_RATE_IP_SECRET;
            await assert.rejects(
                brokenHandlers.deleteAccount({}, {
                    auth: { uid: 'u8', token: { auth_time: 1000 } },
                    rawRequest: { headers: { 'x-forwarded-for': '203.0.113.9' } },
                }),
                function(err) { return /missing|salt store down/.test(err.message); }
            );
            for (const key of broken.docs.keys()) {
                assert.strictEqual(key.indexOf('rate_limits/deleteip_'), -1, key);
                assert.notStrictEqual(key, 'rate_limits/' + publicId);
            }

            const src = fs.readFileSync(path.join(root, 'functions', 'src', 'rateLimitSalt.js'), 'utf8');
            const accountSrc = fs.readFileSync(path.join(root, 'functions', 'src', 'deleteAccount.js'), 'utf8');
            const indexSrc = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
            const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
            assert.ok(src.includes('crypto.randomBytes(32)'));
            assert.ok(!src.includes("secret || ('delete-rate-'"));
            assert.ok(!src.includes("'delete-rate-' +"));
            assert.ok(!accountSrc.includes('delete-rate-'));
            assert.ok(!indexSrc.includes("nostr_' + nostrIP.replace"));
            assert.ok(!indexSrc.includes("lnauth_' + lnIP.replace"));
            assert.ok(!indexSrc.includes("lnverify_' + verifyIP.replace"));
            assert.ok(indexSrc.includes('networkRateDocId'));
            assert.ok(indexSrc.includes('deleteExpiredRateRows'));
            assert.ok(rules.includes('match /rate_limit_salts/{docId}'));
            assert.ok(rules.slice(rules.indexOf('match /rate_limit_salts/{docId}'), rules.indexOf('match /rate_limit_salts/{docId}') + 120).includes('allow read, write: if false'));
            assert.strictEqual(saltMod.PUBLIC_RATE_KEY.test('delete-rate-1970-01-01'), true);
        } finally {
            if (prev == null) delete process.env.DELETE_RATE_IP_SECRET;
            else process.env.DELETE_RATE_IP_SECRET = prev;
        }
    });

    await testAsync('expired rate rows and legacy address ids are deleted by the cleanup', async function() {
        const saltMod = require(path.join(root, 'functions', 'src', 'rateLimitSalt'));
        const hashed = 'a'.repeat(40);
        const db = createFakeDb({
            'rate_limits/deleteip_expired': { count: 1, expireAt: new Date(1000) },
            'rate_limits/deleteip_fresh': { count: 1, expireAt: new Date(Date.now() + 86400000) },
            'rate_limits/nostr_203_0_113_8': { n: 1 },
            'rate_limits/lnauth_198_51_100_7': { n: 1 },
            'rate_limits/lnverify_203_0_113_9': { n: 1 },
            ['rate_limits/nostr_' + hashed]: { attempts: 1, expireAt: new Date(Date.now() + 86400000) },
            ['rate_limits/lnverify_' + hashed]: { attempts: 1, expireAt: new Date(Date.now() + 86400000) },
            'rate_limit_salts/1970-01-01': { salt: 'b'.repeat(64), expireAt: new Date(1000) },
            'rate_limit_salts/2099-01-01': { salt: 'c'.repeat(64), expireAt: new Date(Date.now() + 86400000) },
        });
        const swept = await saltMod.deleteExpiredRateRows(db, Date.now(), { documentIdField: '__name__' });
        assert.ok(swept.rateLimits >= 1);
        assert.ok(swept.legacy >= 3);
        assert.strictEqual(db.docs.has('rate_limits/deleteip_expired'), false);
        assert.ok(db.docs.has('rate_limits/deleteip_fresh'));
        assert.strictEqual(db.docs.has('rate_limits/nostr_203_0_113_8'), false);
        assert.strictEqual(db.docs.has('rate_limits/lnauth_198_51_100_7'), false);
        assert.strictEqual(db.docs.has('rate_limits/lnverify_203_0_113_9'), false);
        assert.ok(db.docs.has('rate_limits/nostr_' + hashed));
        assert.ok(db.docs.has('rate_limits/lnverify_' + hashed));
        assert.strictEqual(db.docs.has('rate_limit_salts/1970-01-01'), false);
        assert.ok(db.docs.has('rate_limit_salts/2099-01-01'));
    });

    await testAsync('the daily salt is cached and Lightning verify rows are hashed', async function() {
        const saltMod = require(path.join(root, 'functions', 'src', 'rateLimitSalt'));
        const prev = process.env.DELETE_RATE_IP_SECRET;
        delete process.env.DELETE_RATE_IP_SECRET;
        saltMod.clearRateLimitSaltCache();
        try {
            const db = createFakeDb({});
            let txns = 0;
            const orig = db.runTransaction.bind(db);
            db.runTransaction = async function(fn) {
                txns++;
                return orig(fn);
            };
            const now = Date.UTC(2026, 0, 2);
            const id1 = await saltMod.networkRateDocId(db, 'lnverify_', '203.0.113.9', now);
            assert.strictEqual(txns, 1);
            const id2 = await saltMod.networkRateDocId(db, 'lnverify_', '203.0.113.9', now);
            assert.strictEqual(txns, 1);
            assert.strictEqual(id1, id2);
            assert.ok(/^lnverify_[a-f0-9]{40}$/.test(id1));
            assert.strictEqual(id1.indexOf('203.0.113.9'), -1);
            assert.strictEqual(id1.indexOf('203_0_113'), -1);
            const next = Date.UTC(2026, 0, 3);
            const id3 = await saltMod.networkRateDocId(db, 'lnverify_', '203.0.113.9', next);
            assert.strictEqual(txns, 2);
            assert.notStrictEqual(id1, id3);
            const indexSrc = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
            const verifyBlock = indexSrc.slice(indexSrc.indexOf('exports.lnAuthVerify'), indexSrc.indexOf('exports.lnAuthVerify') + 2200);
            assert.ok(verifyBlock.includes("networkRateDocId(db, 'lnverify_'"));
            assert.ok(!verifyBlock.includes("lnverify_' + verifyIP"));
            const rateTx = verifyBlock.slice(0, verifyBlock.indexOf('Atomic consume'));
            assert.strictEqual((rateTx.match(/expireAt:/g) || []).length, 3);
            const saltSrc = fs.readFileSync(path.join(root, 'functions', 'src', 'rateLimitSalt.js'), 'utf8');
            assert.ok(saltSrc.includes("'lnverify_'"));
            assert.ok(saltSrc.includes('cachedSalt'));
        } finally {
            saltMod.clearRateLimitSaltCache();
            if (prev == null) delete process.env.DELETE_RATE_IP_SECRET;
            else process.env.DELETE_RATE_IP_SECRET = prev;
        }
    });

    await testAsync('username confirm and sats forfeit are server checks', async function() {
        const db = createFakeDb(world());
        initSecondFactor({
            db: db,
            admin: { auth: function() { return okAuth(db); } },
            HttpsError: HttpsError,
            authenticator: { generateSecret: function() { return 'x'; }, keyuri: function() { return 'otpauth'; }, checkDelta: function() { return null; }, options: {} },
            QRCode: { toDataURL: async function() { return ''; } },
        });
        const handlers = _createDeleteAccountHandlers({
            db: db,
            bucket: createBucket([]),
            authApi: okAuth(db),
            HttpsError: HttpsError,
            nowSec: function() { return 1000 + del.REAUTH_MAX_AGE_SEC; },
            nowMs: function() { return 5000; },
            documentIdField: '__name__',
            ipSecret: 'unit-secret',
        });
        const context = { auth: auth('u1'), rawRequest: { headers: {} } };
        await assert.rejects(
            function() { return handlers.deleteAccount({ confirmUsername: 'nope', acknowledgeForfeit: true }, context); },
            function(err) { return err.code === 'failed-precondition' && /username/i.test(err.message); }
        );
        assert.ok(db.docs.has('users/u1'));
        await assert.rejects(
            function() { return handlers.deleteAccount({ confirmUsername: 'Alice' }, context); },
            function(err) { return err.code === 'failed-precondition' && /forfeit/i.test(err.message); }
        );
        assert.ok(db.docs.has('users/u1'));
    });

    await testAsync('tombstone records the email hash and blocks a fourth deletion in 30 days', async function() {
        process.env.DELETION_HMAC_SECRET = 'unit-deletion-secret-0123456789';
        const tomb = require(path.join(root, 'functions', 'src', 'accountTombstone'));
        const db = createFakeDb(world());
        db.docs.set('users/u1', Object.assign({}, db.docs.get('users/u1'), { email: 'Alice@Example.com', banned: true }));
        initSecondFactor({
            db: db,
            admin: { auth: function() { return okAuth(db); } },
            HttpsError: HttpsError,
            authenticator: { generateSecret: function() { return 'x'; }, keyuri: function() { return 'otpauth'; }, checkDelta: function() { return null; }, options: {} },
            QRCode: { toDataURL: async function() { return ''; } },
        });
        const authApi = okAuth(db);
        authApi.getUser = async function(uid) {
            const email = uid === 'u9' ? 'ned@example.com' : 'alice@example.com';
            return { uid: uid, email: email, emailVerified: true, providerData: [] };
        };
        const handlers = _createDeleteAccountHandlers({
            db: db,
            bucket: createBucket([]),
            authApi: authApi,
            HttpsError: HttpsError,
            nowSec: function() { return 1000 + del.REAUTH_MAX_AGE_SEC; },
            nowMs: function() { return Date.now(); },
            documentIdField: '__name__',
            ipSecret: 'unit-secret-tomb',
        });
        await handlers.deleteAccount({ confirmUsername: 'Alice', acknowledgeForfeit: true }, {
            auth: auth('u1', { token: { auth_time: 1000, email: 'alice@example.com', email_verified: true } }),
            rawRequest: { headers: {} },
        });
        const id = tomb.emailHmac('alice@example.com');
        assert.ok(id && db.docs.has('deleted_accounts/' + id));
        const row = db.docs.get('deleted_accounts/' + id);
        assert.strictEqual(row.banned, true);
        assert.ok(JSON.stringify(row).toLowerCase().indexOf('alice@') === -1);
        assert.ok(!row.expireAt, 'banned tombstone is kept');
        row.deletionHits = [Date.now(), Date.now() - 1000, Date.now() - 2000];
        db.docs.set('users/u1', { username: 'Alice', email: 'alice@example.com', points: 10 });
        await assert.rejects(
            function() {
                return handlers.deleteAccount({ confirmUsername: 'Alice', acknowledgeForfeit: true }, {
                    auth: auth('u1', { token: { auth_time: 1000, email: 'alice@example.com', email_verified: true } }),
                    rawRequest: { headers: {} },
                });
            },
            function(err) { return err.code === 'resource-exhausted'; }
        );
        const prev = process.env.DELETION_HMAC_SECRET;
        delete process.env.DELETION_HMAC_SECRET;
        db.docs.set('users/u9', { username: 'Ned', email: 'ned@example.com', points: 0 });
        await assert.rejects(
            function() {
                return handlers.deleteAccount({ confirmUsername: 'Ned' }, {
                    auth: auth('u9', { token: { auth_time: 1000, email: 'ned@example.com', email_verified: true } }),
                    rawRequest: { headers: {} },
                });
            },
            function(err) { return err.code === 'failed-precondition'; }
        );
        process.env.DELETION_HMAC_SECRET = prev;
    });

    await testAsync('article XP markers stay without the account id, and daily article counters are deleted', async function() {
        const db = createFakeDb(world());
        db.docs.set('users/u1/article_publish_days/2026-10-26', { count: 2, uid: 'u1', day: '2026-10-26' });
        db.docs.set('article_xp/a1', { uid: 'u1', awarded: 30, reason: 'paid', reversed: false });
        db.docs.set('article_xp/other', { uid: 'u2', awarded: 30, reason: 'paid', reversed: false });
        const handlers = del.createDeleteAccountHandlers({
            db: db,
            bucket: createBucket([]),
            authApi: okAuth(db),
            HttpsError: HttpsError,
            nowSec: function() { return 1000 + del.REAUTH_MAX_AGE_SEC; },
            nowMs: function() { return 5000; },
            documentIdField: '__name__',
            ipSecret: 'unit-secret-article-xp',
        });
        await handlers.deleteAccount({}, { auth: auth('u1'), rawRequest: { headers: {} } });
        assert.strictEqual(db.docs.has('users/u1/article_publish_days/2026-10-26'), false);
        const marker = db.docs.get('article_xp/a1');
        assert.ok(marker);
        assert.strictEqual(marker.uid, '');
        assert.strictEqual(marker.awarded, 30);
        assert.strictEqual(marker.reason, 'paid');
        assert.strictEqual(db.docs.get('article_xp/other').uid, 'u2');
        const src = fs.readFileSync(path.join(root, 'functions', 'src', 'deleteAccount.js'), 'utf8');
        assert.ok(src.includes("'article_publish_days'"));
        assert.ok(src.includes("collection('article_xp').where('uid', '==', uid)"));
    });

    await testAsync('posts other people replied to are anonymized and the rest are deleted', async function() {
        const db = createFakeDb(world());
        db.docs.set('forum_replies/fromBob', { authorId: 'u2', postId: 'p1', body: 'still here', parentReplyId: '' });
        db.docs.set('forum_posts/lonely', { authorId: 'u1', title: 'alone', body: 'secret' });
        db.docs.set('articles/a1', { authorId: 'u1', title: 'essay', body: 'text', coverUrl: 'https://cdn.example/c.png' });
        db.docs.set('article_replies/ar1', { authorId: 'u2', articleId: 'a1', body: 'kept' });
        db.docs.set('topic_discussions/general/posts/tp1', { uid: 'u1', name: 'Alice', text: 'topic secret', parentId: '', createdAt: 10 });
        db.docs.set('topic_discussions/general/posts/tp2', { uid: 'u2', name: 'Bob', text: 'answer', parentId: 'tp1', createdAt: 11 });
        db.docs.set('cipher_shares/s1', { senderUid: 'u1', shareId: 's1', revealed: false });
        db.docs.set('cipher_shares/s2', { senderUid: 'u1', shareId: 's2', revealed: true });
        db.docs.set('notifications/cshare_s1', { recipientId: 'u9', message: 'pending reveal' });
        db.docs.set('notifications/cshare_s2', { recipientId: 'u9', message: 'already open' });
        const handlers = del.createDeleteAccountHandlers({
            db: db,
            bucket: createBucket([]),
            authApi: okAuth(db),
            HttpsError: HttpsError,
            nowSec: function() { return 1000 + del.REAUTH_MAX_AGE_SEC; },
            nowMs: function() { return 5000; },
            documentIdField: '__name__',
            ipSecret: 'unit-secret-posts',
        });
        await handlers.deleteAccount({}, { auth: auth('u1'), rawRequest: { headers: {} } });
        assert.strictEqual(db.docs.has('forum_posts/lonely'), false);
        const kept = db.docs.get('forum_posts/p1');
        assert.ok(kept);
        assert.strictEqual(kept.authorId, 'deleted');
        assert.strictEqual(kept.body, '[deleted]');
        assert.strictEqual(kept.title, '[deleted]');
        assert.strictEqual(kept.authorName, '[deleted]');
        assert.ok(db.docs.has('forum_replies/fromBob'));
        const article = db.docs.get('articles/a1');
        assert.strictEqual(article.authorId, 'deleted');
        assert.strictEqual(article.coverUrl, '');
        assert.ok(db.docs.has('article_replies/ar1'));
        const topic = db.docs.get('topic_discussions/general/posts/tp1');
        assert.strictEqual(topic.uid, 'deleted');
        assert.strictEqual(topic.name, '[deleted]');
        assert.strictEqual(topic.text, '[deleted]');
        assert.ok(db.docs.has('topic_discussions/general/posts/tp2'));
        assert.strictEqual(db.docs.has('notifications/cshare_s1'), false);
        assert.ok(db.docs.has('notifications/cshare_s2'));
        assert.strictEqual(db.docs.has('cipher_shares/s1'), false);
        assert.strictEqual(db.docs.has('dm_conversations/u1_u2'), false);
    });

    await testAsync('an admin delete of an email-less lightning user does not tombstone the admin email', async function() {
        const tomb = require(path.join(root, 'functions', 'src', 'accountTombstone'));
        const lnUid = 'ln:' + 'ab'.repeat(32);
        const adminEmail = 'admin-secret@example.com';
        const clientEmail = 'client-written@example.com';
        const db = createFakeDb({
            ['users/' + lnUid]: { username: 'Zap', banned: true, email: clientEmail },
        });
        const handlers = del.createDeleteAccountHandlers({
            db: db,
            bucket: createBucket([]),
            authApi: okAuth(db),
            HttpsError: HttpsError,
            nowSec: function() { return 1000; },
            nowMs: function() { return 5000; },
            documentIdField: '__name__',
            ipSecret: 'unit-secret-admin-ln',
        });
        const result = await handlers.deleteAccount(
            { uid: lnUid },
            { auth: { uid: 'admin', token: { admin: true, email: adminEmail, email_verified: true, auth_time: 1 } } }
        );
        assert.strictEqual(result.ok, true);
        assert.strictEqual(db.docs.has('deleted_accounts/' + tomb.emailHmac(adminEmail)), false);
        assert.strictEqual(db.docs.has('deleted_accounts/' + tomb.emailHmac(clientEmail)), false);
        const lnHash = tomb.hmacHex('ln:' + lnUid.slice(3));
        const row = db.docs.get('deleted_accounts/' + lnHash);
        assert.ok(row);
        assert.strictEqual(row.banned, true);
    });

    await testAsync('deletion keeps previous email hashes and merges their tombstones', async function() {
        const tomb = require(path.join(root, 'functions', 'src', 'accountTombstone'));
        const oldHash = tomb.emailHmac('old-banned@example.com');
        const nowHash = tomb.emailHmac('now-banned@example.com');
        const db = createFakeDb({
            'users/u1': { username: 'Ada', banned: true, emailHash: nowHash, satsWithdrawn: 5 },
            'email_history/u1': { hashes: [oldHash] },
            ['deleted_accounts/' + oldHash]: { lifetimeSats: 40, deletionHits: [1000], banned: false, ageDays: 3 },
        });
        const authApi = okAuth(db);
        authApi.getUser = async function() {
            return {
                uid: 'u1',
                email: 'now-banned@example.com',
                emailVerified: true,
                providerData: [],
                metadata: { creationTime: '2020-01-01T00:00:00.000Z' },
            };
        };
        const handlers = del.createDeleteAccountHandlers({
            db: db,
            bucket: createBucket([]),
            authApi: authApi,
            HttpsError: HttpsError,
            nowSec: function() { return 1000 + del.REAUTH_MAX_AGE_SEC; },
            nowMs: function() { return 5000; },
            documentIdField: '__name__',
            ipSecret: 'unit-secret-history',
        });
        await handlers.deleteAccount({}, {
            auth: auth('u1', { token: { auth_time: 1000, email: 'now-banned@example.com', email_verified: true } }),
            rawRequest: { headers: {} },
        });
        const oldDoc = db.docs.get('deleted_accounts/' + oldHash);
        assert.ok(oldDoc);
        assert.strictEqual(oldDoc.banned, true);
        assert.ok(oldDoc.lifetimeSats >= 45);
        assert.ok(oldDoc.deletionHits.length >= 2);
        assert.ok(db.docs.has('deleted_accounts/' + nowHash));
        const unverified = tomb.identityFrom({
            uid: 'u9',
            user: { email: 'plain@example.com' },
            token: { email: 'plain@example.com', email_verified: false },
        });
        assert.strictEqual(unverified.emailVerified, false);
        assert.deepStrictEqual(tomb.identityMaterials(unverified), []);
    });

    await testAsync('a deleted-user reply and a legacy subcollection reply keep the parent', async function() {
        const db = createFakeDb({
            'users/u1': { username: 'Ada' },
            'forum_posts/nested': { authorId: 'u1', body: 'keep me', title: 'thread' },
            'forum_posts/nested/replies/r1': { authorId: 'deleted', body: 'old' },
            'articles/nestedA': { authorId: 'u1', body: 'essay', title: 'piece' },
            'articles/nestedA/comments/c1': { authorId: 'someone', body: 'hi' },
            'forum_posts/legacy': { authorId: 'u1', body: 'top', title: 't' },
            'forum_replies/gone': { authorId: 'deleted', postId: 'legacy', body: 'was here' },
        });
        const handlers = del.createDeleteAccountHandlers({
            db: db,
            bucket: createBucket([]),
            authApi: okAuth(db),
            HttpsError: HttpsError,
            nowSec: function() { return 1000 + del.REAUTH_MAX_AGE_SEC; },
            nowMs: function() { return 5000; },
            documentIdField: '__name__',
            ipSecret: 'unit-secret-replies',
        });
        await handlers.deleteAccount({}, { auth: auth('u1'), rawRequest: { headers: {} } });
        assert.strictEqual(db.docs.get('forum_posts/nested').authorId, 'deleted');
        assert.strictEqual(db.docs.get('forum_posts/nested').body, '[deleted]');
        assert.strictEqual(db.docs.get('articles/nestedA').authorId, 'deleted');
        assert.strictEqual(db.docs.get('forum_posts/legacy').authorId, 'deleted');
        assert.ok(db.docs.has('forum_posts/nested/replies/r1'));
        assert.ok(db.docs.has('articles/nestedA/comments/c1'));
    });

    await testAsync('cert_bonuses and xp_ledger are deleted by name when listCollections is empty', async function() {
        assert.ok(del.USER_SUBCOLLECTIONS.indexOf('cert_bonuses') !== -1);
        assert.ok(del.USER_SUBCOLLECTIONS.indexOf('xp_ledger') !== -1);
        assert.ok(del.CAP_SUBCOLLECTIONS.indexOf('cert_bonuses') === -1);
        assert.ok(del.CAP_SUBCOLLECTIONS.indexOf('xp_ledger') === -1);
        assert.ok(del.RETAINED_COLLECTIONS.indexOf('cert_bonuses') === -1);
        assert.ok(del.RETAINED_COLLECTIONS.indexOf('xp_ledger') === -1);
        const db = createFakeDb({
            'users/u1': { username: 'Ada', points: 10 },
            'users/u1/cert_bonuses/prop': { amount: 2100, source: 'cert_bonus' },
            'users/u1/xp_ledger/cert_bonus_prop': { amount: 2100, source: 'cert_bonus' },
            'users/u2': { username: 'Bea' },
            'users/u2/cert_bonuses/prop': { amount: 2100 },
            'users/u2/xp_ledger/cert_bonus_prop': { amount: 2100 },
        });
        db.omitListed = true;
        const handlers = del.createDeleteAccountHandlers({
            db: db,
            bucket: createBucket([]),
            authApi: okAuth(db),
            HttpsError: HttpsError,
            nowSec: function() { return 1000 + del.REAUTH_MAX_AGE_SEC; },
            nowMs: function() { return 5000; },
            documentIdField: '__name__',
            ipSecret: 'unit-secret-cert-ledger',
        });
        await handlers.deleteAccount({}, { auth: auth('u1'), rawRequest: { headers: {} } });
        assert.ok(db.listCalls.indexOf('users/u1') !== -1);
        assert.strictEqual(db.docs.has('users/u1/cert_bonuses/prop'), false);
        assert.strictEqual(db.docs.has('users/u1/xp_ledger/cert_bonus_prop'), false);
        assert.strictEqual(db.docs.has('users/u1'), false);
        assert.ok(db.docs.has('users/u2/cert_bonuses/prop'));
        assert.ok(db.docs.has('users/u2/xp_ledger/cert_bonus_prop'));
    });

    await testAsync('the hash limit names the sign-in, and the delete overlay scrolls', async function() {
        const tomb = require(path.join(root, 'functions', 'src', 'accountTombstone'));
        const email = 'limited@example.com';
        const id = tomb.emailHmac(email);
        const now = Date.now();
        const db = createFakeDb({
            ['deleted_accounts/' + id]: { deletionHits: [now - 1000, now - 2000, now - 3000] },
        });
        await assert.rejects(
            function() {
                return tomb.assertDeletionAllowed(db, tomb.identityFrom({
                    uid: 'u1',
                    authUser: { email: email, emailVerified: true },
                }), now);
            },
            function(err) { return err.message === 'Too many deletions for this sign-in. Try again later.'; }
        );
        const src = fs.readFileSync(path.join(root, 'functions', 'src', 'deleteAccount.js'), 'utf8');
        assert.ok(src.includes('Too many deletions for this sign-in. Try again later.'));
        assert.ok(!src.includes('Too many account deletions from this network. Try again later.'));
        const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
        assert.ok(ranking.includes('align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;-webkit-overflow-scrolling:touch'));
        assert.ok(ranking.includes('margin:auto 0'));
        assert.ok(ranking.includes('Sats withdrawals are paused until '));
        assert.ok(ranking.includes('id="satsHoldNotice"'));
        const terms = fs.readFileSync(path.join(root, 'terms.html'), 'utf8');
        const magic = 'If you register with an email address, a verification magic link will be sent to your inbox. Nostr sign-in requires a NIP-07 compatible browser extension (Alby, nos2x). Lightning sign-in uses LNURL-auth — scan a QR code with a compatible Lightning wallet. Accounts that violate these terms may be suspended or deleted.';
        const deletion = 'You can delete the account from Settings → Account after confirming your username.';
        assert.ok(terms.includes(magic));
        assert.ok(terms.indexOf(magic) < terms.indexOf(deletion));
    });

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
})();
