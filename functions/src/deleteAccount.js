// Account deletion. Admin SDK only. The signed-in owner must have a recent
// sign-in. An admin may delete a different uid without that check.
// Running it twice is safe: missing docs are skipped, and chat that is
// already "[deleted]" is left alone.
//
// Index audit. Every query below is one of these shapes:
// 1. A single-collection equality, array-contains, or `in` (chunks of 10)
//    on one field, then orderBy(document id). Firestore adds __name__ to
//    every single-field index, so these do not need a composite. Nested
//    fields such as user1.uid and player1.uid are still one field.
// 2. A collection-group equality on comments.authorId, then orderBy(document
//    id). That needs the comments.authorId field override in
//    firestore.indexes.json. The override replaces automatic indexes, so it
//    lists COLLECTION and COLLECTION_GROUP, ascending and descending.
// 3. A document-id range, `>= uid_` and `< uid_\uf8ff` (or `raffle_` for
//    snapshot ids). That is the automatic __name__ index. It reads this
//    account's rows, not the whole collection.
// 4. A collection-group equality on winners.uid, participants.uid, or
//    participants.username, then orderBy(document id). Each field has a
//    field override with COLLECTION and COLLECTION_GROUP, both directions.
//    Winner rows outside raid_bosses are read and then skipped.
// 5. A bounded read: the newest messages by ts (reactions), recent
//    leaderboard history by settledAt, and recent raid bosses by startTime.
//    weekly_challenges parents are paged because the participant flag is a
//    map. Each week's user_contribs rows are a document-id range.
// Direct document gets do not need an index.
// Nacho notes, channel feedback, Beats likes, poll voters, reply-bonus
// rows, and listing-count markers use the same single-field shapes.
// likedBy and voters are array-contains on fields with no override, so the
// automatic index covers them. No new composite is required.
// Anonymous callers skip chat, raid, raffle, and weekly passes.
//
// Financial and abuse records in RETAINED_COLLECTIONS are never written.
// Per-day caps and other user-keyed limit docs are removed only after the
// Firebase Auth user is deleted in this same call.

const {
    deletionIpDocId,
    isUsableSecret,
    loadRateLimitSecret,
} = require('./rateLimitSalt');
const accountTombstone = require('./accountTombstone');

const BATCH_LIMIT = 400;
const QUERY_PAGE = 200;
const IN_LIMIT = 10;
const REAUTH_MAX_AGE_SEC = 5 * 60;
const DELETED_LABEL = '[deleted]';
const DELETED_UID = 'deleted';
// Colon is required for nostr:<pubkey> and ln:<key>. Slash, dot, and
// whitespace stay rejected, so a uid cannot escape a Storage prefix or a
// document-id range.
const UID_RE = /^[A-Za-z0-9_:-]{1,128}$/;
const ID_RANGE_END = '\uf8ff';
// Reaction maps are not queryable per uid. Read only the newest messages.
const REACTION_SCAN_CAP = 2000;
const LEADERBOARD_SCAN_CAP = 240;
const RAID_BOSS_LOOKUP_CAP = 80;
const DELETE_RATE_WINDOW_MS = 60 * 60 * 1000;
const DELETE_RATE_MAX_UID = 3;
const DELETE_RATE_MAX_IP = 8;
const DELETE_RATE_MAX_ANON_IP = 2;
const DELETE_RATE_TTL_MS = 24 * 60 * 60 * 1000;
// expireAt is a timestamp. Before deploy, enable the Firestore TTL policy:
//   gcloud firestore fields ttls update expireAt --collection-group=rate_limits --enable-ttl
// firebase.json does not declare TTL. cleanupExpiredLobbies also deletes
// rows whose expireAt has passed, so a missing policy does not keep them.

const STORAGE_PREFIXES = [
    'beats/',
    'beats-covers/',
    'avatars/',
    'article-images/',
    'articles/',
    'irl-events/',
    'chat-images/',
    'dm-images/',
    'meetup-builder/',
];

// Wiped only after admin.auth().deleteUser succeeds (or the user is already
// gone). A timeout before that step leaves these in place.
const CAP_SUBCOLLECTIONS = [
    'daily_points',
    'daily_action_counts',
    'badge_awards',
];

const USER_SUBCOLLECTIONS = [
    'sats_daily',
    'sats_withdrawals',
    'integrations',
    'proof_of_walk',
    'proof_of_walk_stats',
    'shop_purchases',
    'notifications',
];

// Dedupe rows. Removed only after the Auth user is deleted, with the caps.
const DEFERRED_USER_SUBCOLLECTIONS = [
    'sats_daily',
    'proof_of_walk',
    'proof_of_walk_stats',
    'quest_completions',
    'quest_passes',
    'lifetime_awards',
    'onboarding_evidence',
];

// These stay so a deleted account cannot reset a cap, hide a payout, or
// collect a referral bonus again. Profile copies under users/{uid} are not
// in this list; the durable copy is the top-level ledger.
const RETAINED_COLLECTIONS = [
    'faucet_ledger',
    'faucet_ip_log',
    'faucet_fingerprints',
    'faucet_invoices',
    'faucet_subnet_log',
    'faucet_uid_signals',
    'faucet_ln_ratelimit',
    'faucet_admin_flags',
    'faucet_abuse_reports',
    'faucet_stats',
    'faucet_config',
    'admin_audit_log',
    'charity_donations',
    'charity_stats',
    'cipher_wins',
    'lightning_addresses',
    'referrals',
    'reports',
    'prediction_payouts',
    'prediction_records',
    'deleted_accounts',
];

const RETAINED = new Set(RETAINED_COLLECTIONS);

const CHAT_MEDIA_FIELDS = ['imageUrl', 'gifUrl', 'imageBase64', 'storagePath', 'fileUrl', 'audioUrl', 'coverUrl'];

// Single-field collection queries. op is ==, array-contains, or in.
// childNames are deleted by name. Unknown children are not listed.
const DELETION_QUERIES = [
    ['dm_conversations', 'participants', 'array-contains', ['messages']],
    ['conversations', 'participants', 'array-contains', ['messages']],
    ['marketplace', 'sellerUid', '==', []],
    ['marketplace_messages', 'buyerUid', '==', []],
    ['marketplace_messages', 'sellerUid', '==', []],
    ['suggestions', 'uid', '==', []],
    ['telegram_mirror_queue', 'uid', '==', []],
    ['telegram_mirror_claims', 'uid', '==', []],
    ['beats_tracks', 'authorId', '==', ['comments']],
    ['irl_events', 'hostId', '==', []],
    ['notifications', 'recipientId', '==', []],
    ['notifications', 'senderId', '==', []],
    ['keys', 'ownerId', '==', []],
    ['locked_ciphers', 'ownerId', '==', []],
    ['cipher_shares', 'senderUid', '==', []],
    ['cipher_shares', 'openerUid', '==', []],
    ['peer_requests', 'from', '==', []],
    ['peer_requests', 'to', '==', []],
    ['peerRelationships', 'uid1', '==', []],
    ['peerRelationships', 'uid2', '==', []],
    ['channel_ratings', 'userId', '==', []],
    ['tctv_view_days', 'viewerId', '==', []],
    ['nacho_feedback', 'uid', '==', []],
    ['nacho_misses', 'uid', '==', []],
    ['nacho_bad_matches', 'uid', '==', []],
    ['ai_tools_opens', 'uid', '==', []],
    ['channel_feedback', 'uid', '==', []],
    ['buddy_matches', 'user1.uid', '==', []],
    ['buddy_matches', 'user2.uid', '==', []],
    ['pvp_matches', 'player1.uid', '==', []],
    ['pvp_matches', 'player2.uid', '==', []],
    ['certs', 'uid', '==', []],
    ['gifts', 'ownerId', '==', []],
    ['gift_secrets', 'ownerId', '==', []],
    ['usernames', 'uid', '==', []],
];

// Deleted only after deleteUser succeeds. A timeout before that keeps them.
const DEFERRED_QUERIES = [
    ['key_send_pairs', 'senderUid', '==', []],
    ['key_send_pairs', 'recipientUid', '==', []],
    ['quest_answer_keys', 'uid', '==', []],
    ['scholar_exam_keys', 'uid', '==', []],
    ['shoutout_claims', 'authorUid', '==', []],
    ['raid_deck_completions', 'uid', '==', []],
    ['reply_bonus_pairs', 'replierUid', '==', []],
    ['reply_bonus_pairs', 'targetUid', '==', []],
    ['reply_bonus_claims', 'uid', '==', []],
    ['reply_bonus_claims', 'targetUid', '==', []],
    ['market_listing_counts', 'sellerUid', '==', []],
    ['market_listing_daily', 'uid', '==', []],
    ['market_message_counts', 'buyerUid', '==', []],
    ['market_sale_counts', 'sellerUid', '==', []],
];

const COLLECTION_GROUP_QUERIES = [
    { collection: 'comments', field: 'authorId', op: '==', orderBy: '__name__' },
    { collection: 'winners', field: 'uid', op: '==', orderBy: '__name__' },
    { collection: 'participants', field: 'uid', op: '==', orderBy: '__name__' },
    { collection: 'participants', field: 'username', op: '==', orderBy: '__name__' },
    { collection: 'posts', field: 'uid', op: '==', orderBy: 'createdAt' },
];

// Document-id ranges. The end is the prefix plus U+F8FF, not a full scan.
const ID_RANGE_QUERIES = [
    { collection: 'action_cooldowns', prefix: 'uid_' },
    { collection: 'raid_daily_caps', prefix: 'uid_' },
    { collection: 'gift_pending_pairs', prefix: 'uid_' },
    { collection: 'reply_bonus_pairs', prefix: 'p_{uid}__' },
    { collection: 'weekly_challenges/{week}/user_contribs', prefix: 'uid_' },
    { collection: 'stats', prefix: 'raffle_' },
];

// Reads that are not one account's rows. Each one is capped or is the
// small weekly parent (the participant flag is a map, so it has no uid index).
const BOUNDED_READS = [
    { collection: 'global_chat', orderBy: 'ts', direction: 'desc', cap: REACTION_SCAN_CAP },
    { collection: 'announcements', orderBy: 'ts', direction: 'desc', cap: REACTION_SCAN_CAP },
    { collection: 'leaderboard_winners', orderBy: 'settledAt', direction: 'desc', cap: LEADERBOARD_SCAN_CAP },
    { collection: 'raid_bosses', orderBy: 'startTime', direction: 'desc', cap: RAID_BOSS_LOOKUP_CAP },
    { collection: 'weekly_challenges', orderBy: '__name__', reason: 'participant map' },
];

// Public posts are not in DELETION_QUERIES. A post another person replied to
// is anonymized. The rest are deleted. These lookups stay single-field.
const CONTENT_LOOKUPS = [
    ['forum_posts', 'authorId', '==', []],
    ['forum_replies', 'authorId', '==', []],
    ['forum_replies', 'postId', '==', []],
    ['forum_replies', 'parentReplyId', '==', []],
    ['articles', 'authorId', '==', []],
    ['article_replies', 'authorId', '==', []],
    ['article_replies', 'articleId', '==', []],
    ['article_replies', 'parentReplyId', '==', []],
    ['posts', 'parentId', '==', []],
];

const INDEX_AUDIT = {
    collectionQueries: DELETION_QUERIES.concat(DEFERRED_QUERIES).concat(CONTENT_LOOKUPS).concat([
        ['gifts', 'sentBy', '==', []],
        ['leaderboard_winners', 'uids', 'array-contains', []],
        ['beats_tracks', 'likedBy', 'array-contains', []],
        ['poll_votes', 'voters', 'array-contains', []],
    ]).map(function(row) {
        return { collection: row[0], field: row[1], op: row[2], orderBy: '__name__' };
    }),
    collectionGroupQueries: COLLECTION_GROUP_QUERIES,
    idRangeQueries: ID_RANGE_QUERIES,
    boundedReads: BOUNDED_READS,
};

function authorizeDeleteAccount(auth, data, nowSec) {
    if (!auth || !auth.uid) {
        return { ok: false, code: 'unauthenticated', message: 'Sign in required.' };
    }
    const raw = data && typeof data.uid === 'string' ? data.uid.trim() : '';
    if (raw && !UID_RE.test(raw)) {
        return { ok: false, code: 'invalid-argument', message: 'That account id is not valid.' };
    }
    const isAdmin = !!(auth.token && auth.token.admin === true);
    if (raw && raw !== auth.uid && !isAdmin) {
        return { ok: false, code: 'permission-denied', message: 'Only the account owner or an admin can delete this account.' };
    }
    const target = raw && isAdmin ? raw : auth.uid;
    if (typeof target !== 'string' || !UID_RE.test(target)) {
        return { ok: false, code: 'invalid-argument', message: 'That account id is not valid.' };
    }
    const ownerCall = target === auth.uid;
    if (ownerCall) {
        const authTime = auth.token && Number(auth.token.auth_time);
        const age = nowSec - authTime;
        if (!Number.isFinite(authTime) || age > REAUTH_MAX_AGE_SEC || age < 0) {
            return { ok: false, code: 'failed-precondition', message: 'Please sign in again, then delete your account.' };
        }
    }
    return { ok: true, uid: target, byAdmin: !ownerCall };
}

function isAnonymousAuth(auth) {
    const firebase = auth && auth.token && auth.token.firebase;
    return !!(firebase && firebase.sign_in_provider === 'anonymous');
}

// Rightmost X-Forwarded-For entry is the one the platform appends.
function clientIpFromContext(context) {
    const req = context && context.rawRequest;
    const headers = (req && req.headers) || {};
    let forwarded = headers['x-forwarded-for'] || headers['X-Forwarded-For'] || '';
    if (Array.isArray(forwarded)) forwarded = forwarded.join(',');
    const parts = String(forwarded).split(',').map(function(part) { return part.trim(); }).filter(Boolean);
    let ip = parts.length ? parts[parts.length - 1] : '';
    if (!ip && req) {
        const sock = req.socket || req.connection || {};
        ip = String(sock.remoteAddress || req.ip || '').trim();
    }
    ip = String(ip || 'unknown').replace(/^::ffff:/i, '');
    return ip || 'unknown';
}

function rateWindowStartMs(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value && typeof value.toMillis === 'function') return value.toMillis();
    if (value && typeof value.toDate === 'function') return value.toDate().getTime();
    return 0;
}

async function enforceDeleteRateLimit(db, spec) {
    const options = spec || {};
    const callerUid = options.callerUid;
    const ip = options.ip;
    const anonymous = options.anonymous === true;
    const nowMs = options.nowMs;
    let secret = options.ipSecret;
    if (!isUsableSecret(secret)) secret = await loadRateLimitSecret(db, nowMs);
    const limits = [];
    if (!options.byAdmin && callerUid) {
        limits.push({ id: 'delete_' + callerUid, max: DELETE_RATE_MAX_UID });
    }
    limits.push({
        id: deletionIpDocId(ip, nowMs, secret),
        max: anonymous ? DELETE_RATE_MAX_ANON_IP : (options.byAdmin ? 30 : DELETE_RATE_MAX_IP),
        expireAt: new Date(nowMs + DELETE_RATE_TTL_MS),
    });
    if (!db || typeof db.runTransaction !== 'function') {
        throw new Error('Rate limit storage is required');
    }
    await db.runTransaction(async function(tx) {
        const snaps = [];
        for (let i = 0; i < limits.length; i++) {
            const ref = db.collection('rate_limits').doc(limits[i].id);
            snaps.push({
                ref: ref,
                max: limits[i].max,
                expireAt: limits[i].expireAt,
                snap: await tx.get(ref),
            });
        }
        const writes = [];
        for (let i = 0; i < snaps.length; i++) {
            const item = snaps[i];
            const data = item.snap && item.snap.exists ? (item.snap.data() || {}) : {};
            const start = rateWindowStartMs(data.windowStart);
            const age = nowMs - start;
            const inWindow = !!start && age < DELETE_RATE_WINDOW_MS && age >= -60000;
            const count = inWindow ? (Number(data.count) || 0) : 0;
            if (count >= item.max) {
                const err = new Error('Too many deletions for this sign-in. Try again later.');
                err.code = 'resource-exhausted';
                throw err;
            }
            const next = {
                windowStart: inWindow ? data.windowStart : nowMs,
                count: count + 1,
            };
            if (item.expireAt) next.expireAt = item.expireAt;
            writes.push({ ref: item.ref, data: next });
        }
        writes.forEach(function(item) { tx.set(item.ref, item.data); });
    });
}

function rootCollection(path) {
    return String(path || '').split('/')[0];
}

function assertMutable(path) {
    const root = rootCollection(path);
    if (RETAINED.has(root)) {
        throw new Error('Refusing to write retained collection ' + root);
    }
}

function chatTombstone(data) {
    const src = data || {};
    const patch = {};
    let changed = false;
    if (src.uid !== DELETED_UID) { patch.uid = DELETED_UID; changed = true; }
    if (src.name !== DELETED_LABEL) { patch.name = DELETED_LABEL; changed = true; }
    if (src.text !== DELETED_LABEL) { patch.text = DELETED_LABEL; changed = true; }
    if (src.caption && src.caption !== DELETED_LABEL) { patch.caption = DELETED_LABEL; changed = true; }
    CHAT_MEDIA_FIELDS.forEach(function(key) {
        if (src[key]) { patch[key] = ''; changed = true; }
    });
    if (src.faction) { patch.faction = ''; changed = true; }
    if (src.hasChatFlair) { patch.hasChatFlair = false; changed = true; }
    if (src.chatFlairEmoji) { patch.chatFlairEmoji = ''; changed = true; }
    if (src.mentionUid) { patch.mentionUid = ''; changed = true; }
    if (!changed) return null;
    patch.deleted = true;
    return patch;
}

function quoteTombstone(data) {
    const src = data || {};
    if (src.replyToName === DELETED_LABEL && src.replyToText === DELETED_LABEL) return null;
    if (!src.replyToName && !src.replyToText) return null;
    return { replyToName: DELETED_LABEL, replyToText: DELETED_LABEL };
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Replace the tagged user's @name. Other @mentions stay. If the username is
// already gone, only the first @token is replaced.
function anonymizeMentionText(text, username) {
    const src = String(text || '');
    const name = username ? String(username).trim() : '';
    if (name) {
        const probe = new RegExp('@' + escapeRegExp(name) + '(?![\\p{L}\\p{N}_])', 'iu');
        if (probe.test(src)) {
            const all = new RegExp('@' + escapeRegExp(name) + '(?![\\p{L}\\p{N}_])', 'giu');
            return src.replace(all, '@' + DELETED_LABEL);
        }
    }
    return src.replace(/@[\p{L}\p{N}_]+/u, '@' + DELETED_LABEL);
}

function reactionsWithoutUid(reactions, uid) {
    if (!reactions || typeof reactions !== 'object' || Array.isArray(reactions)) return null;
    const next = {};
    let changed = false;
    const keys = Object.keys(reactions);
    for (let i = 0; i < keys.length; i++) {
        const emoji = keys[i];
        const users = reactions[emoji];
        if (!Array.isArray(users)) {
            next[emoji] = users;
            continue;
        }
        const filtered = [];
        for (let u = 0; u < users.length; u++) {
            if (users[u] !== uid) filtered.push(users[u]);
        }
        if (filtered.length !== users.length) changed = true;
        if (filtered.length) next[emoji] = filtered;
        else changed = true;
    }
    return changed ? next : null;
}

function authErrorCode(err) {
    if (!err) return '';
    if (typeof err.code === 'string') return err.code;
    if (err.errorInfo && typeof err.errorInfo.code === 'string') return err.errorInfo.code;
    return '';
}

function isUserNotFound(err) {
    const code = authErrorCode(err);
    return code === 'auth/user-not-found' || code === 'user-not-found';
}

function createBatcher(db) {
    let batch = db.batch();
    const staged = new Map();
    return {
        async update(ref, data) {
            assertMutable(ref.path);
            const prev = staged.get(ref.path);
            if (prev && prev.type === 'delete') return;
            if (prev && prev.type === 'update') {
                Object.assign(prev.data, data);
                return;
            }
            staged.set(ref.path, { type: 'update', ref: ref, data: Object.assign({}, data) });
            if (staged.size >= BATCH_LIMIT) await this.flush();
        },
        async remove(ref) {
            if (!ref || !ref.path) return;
            assertMutable(ref.path);
            const prev = staged.get(ref.path);
            if (prev && prev.type === 'delete') return;
            staged.set(ref.path, { type: 'delete', ref: ref });
            if (staged.size >= BATCH_LIMIT) await this.flush();
        },
        async flush() {
            if (staged.size === 0) return;
            const ops = Array.from(staged.values());
            staged.clear();
            for (let i = 0; i < ops.length; i++) {
                const op = ops[i];
                if (op.type === 'delete') batch.delete(op.ref);
                else batch.update(op.ref, op.data);
            }
            await batch.commit();
            batch = db.batch();
        },
    };
}

async function collectDocs(query, documentIdField, opts) {
    const options = opts || {};
    const cap = options.cap > 0 ? options.cap : 0;
    const out = [];
    const seen = new Set();
    let cursor = null;
    for (let page = 0; page < 10000; page++) {
        if (cap && out.length >= cap) break;
        let q = query;
        if (documentIdField && !options.ordered && typeof q.orderBy === 'function') {
            q = q.orderBy(documentIdField);
        }
        const pageSize = cap ? Math.min(QUERY_PAGE, cap - out.length) : QUERY_PAGE;
        if (pageSize <= 0) break;
        q = q.limit(pageSize);
        if (cursor && typeof q.startAfter === 'function') q = q.startAfter(cursor);
        const snap = await q.get();
        if (!snap || snap.empty || !snap.docs || snap.docs.length === 0) break;
        let added = 0;
        snap.docs.forEach(function(doc) {
            const key = (doc.ref && doc.ref.path) || doc.id;
            if (seen.has(key)) return;
            seen.add(key);
            out.push(doc);
            added++;
        });
        if (added === 0 || snap.size < pageSize) break;
        cursor = snap.docs[snap.docs.length - 1];
    }
    return out;
}

function idPrefixStart(prefix) {
    return prefix;
}

function idPrefixEnd(prefix) {
    return prefix + ID_RANGE_END;
}

async function collectIdPrefix(collectionRef, prefix, documentIdField) {
    const query = collectionRef
        .where(documentIdField, '>=', idPrefixStart(prefix))
        .where(documentIdField, '<', idPrefixEnd(prefix));
    return collectDocs(query, documentIdField);
}

function collectionNameOf(col) {
    if (col && col.id) return col.id;
    if (col && col.path) return String(col.path).split('/').pop();
    return '';
}

async function childCollections(ref, knownNames, listUnknown) {
    const map = new Map();
    (knownNames || []).forEach(function(name) {
        map.set(name, ref.collection(name));
    });
    if (listUnknown && typeof ref.listCollections === 'function') {
        const listed = await ref.listCollections();
        (listed || []).forEach(function(col) {
            const id = collectionNameOf(col);
            if (id) map.set(id, col);
        });
    }
    return Array.from(map.values());
}

async function deleteDocTree(batcher, ref, knownNames, documentIdField, listUnknown) {
    const cols = await childCollections(ref, knownNames, listUnknown === true);
    for (let i = 0; i < cols.length; i++) {
        const children = await collectDocs(cols[i], documentIdField);
        for (let c = 0; c < children.length; c++) {
            await deleteDocTree(batcher, children[c].ref, [], documentIdField, false);
        }
    }
    await batcher.remove(ref);
}

async function deleteWhere(db, batcher, collectionName, field, op, value, childNames, documentIdField) {
    assertMutable(collectionName);
    const docs = await collectDocs(db.collection(collectionName).where(field, op, value), documentIdField);
    for (let i = 0; i < docs.length; i++) {
        await deleteDocTree(batcher, docs[i].ref, childNames || [], documentIdField, false);
    }
    return docs;
}

async function deleteUsernameReservations(db, batcher, uid, userData, documentIdField) {
    const ids = new Set([uid]);
    if (userData) {
        if (userData.username) ids.add(String(userData.username).trim().toLowerCase());
        if (userData.username_lower) ids.add(String(userData.username_lower).trim().toLowerCase());
    }
    for (const id of ids) {
        if (!id || id.length > 128 || id.indexOf('/') !== -1) continue;
        const ref = db.collection('usernames').doc(id);
        const snap = await ref.get();
        if (!snap.exists) continue;
        const data = snap.data() || {};
        if (data.uid === uid) await batcher.remove(ref);
    }
    await deleteWhere(db, batcher, 'usernames', 'uid', '==', uid, [], documentIdField);
}

async function anonymizeGlobalChat(db, batcher, uid, documentIdField) {
    const mine = await collectDocs(db.collection('global_chat').where('uid', '==', uid), documentIdField);
    const ids = [];
    const quoteDocs = [];
    for (let i = 0; i < mine.length; i += IN_LIMIT) {
        const chunk = [];
        for (let j = i; j < mine.length && j < i + IN_LIMIT; j++) {
            chunk.push(mine[j].id);
            ids.push(mine[j].id);
        }
        if (!chunk.length) continue;
        const quotes = await collectDocs(db.collection('global_chat').where('replyTo', 'in', chunk), documentIdField);
        quotes.forEach(function(doc) { quoteDocs.push(doc); });
    }
    // One write per document. A message can also be a quote of another
    // message from the same account, and a batch cannot write it twice.
    // Quotes are collected before any uid change, so a retry still finds
    // messages that were not tombstoned yet.
    const writes = new Map();
    function queue(doc, patch) {
        if (!patch) return;
        const prev = writes.get(doc.ref.path);
        if (prev) Object.assign(prev.patch, patch);
        else writes.set(doc.ref.path, { ref: doc.ref, patch: Object.assign({}, patch) });
    }
    quoteDocs.forEach(function(doc) { queue(doc, quoteTombstone(doc.data() || {})); });
    let anonymized = 0;
    mine.forEach(function(doc) {
        const patch = chatTombstone(doc.data() || {});
        if (!patch) return;
        queue(doc, patch);
        anonymized++;
    });
    for (const item of writes.values()) {
        await batcher.update(item.ref, item.patch);
    }
    return { anonymized: anonymized, ids: ids };
}

async function anonymizeMentions(db, batcher, uid, username, documentIdField) {
    const docs = await collectDocs(db.collection('global_chat').where('mentionUid', '==', uid), documentIdField);
    for (let i = 0; i < docs.length; i++) {
        const data = docs[i].data() || {};
        if (data.uid === uid) continue;
        const text = anonymizeMentionText(data.text, username);
        const patch = { mentionUid: '' };
        if (text !== data.text) patch.text = text;
        if (data.mentionUid === '' && text === data.text) continue;
        await batcher.update(docs[i].ref, patch);
    }
}

async function stripReactionUid(db, batcher, collectionName, uid) {
    let query = db.collection(collectionName);
    if (typeof query.orderBy === 'function') query = query.orderBy('ts', 'desc');
    const docs = await collectDocs(query, null, { ordered: true, cap: REACTION_SCAN_CAP });
    for (let i = 0; i < docs.length; i++) {
        const data = docs[i].data() || {};
        const next = reactionsWithoutUid(data.reactions, uid);
        if (!next) continue;
        await batcher.update(docs[i].ref, { reactions: next });
    }
}

async function anonymizeFavorNames(db, batcher, uid, documentIdField) {
    const stateRef = db.collection('satoshiFavor').doc('current');
    const state = await stateRef.get();
    if (state.exists) {
        const data = state.data() || {};
        if (data.lowestHashThisWindowUid === uid && data.lowestHashThisWindowUsername && data.lowestHashThisWindowUsername !== DELETED_LABEL) {
            await batcher.update(stateRef, { lowestHashThisWindowUsername: DELETED_LABEL });
        }
    }
    const sessionRef = stateRef.collection('session_hashes').doc(uid);
    const session = await sessionRef.get();
    if (session.exists) {
        const data = session.data() || {};
        if (data.username && data.username !== DELETED_LABEL) {
            await batcher.update(sessionRef, { username: DELETED_LABEL });
        }
    }
    const hashes = await collectDocs(
        stateRef.collection('hashes').where('uid', '==', uid),
        documentIdField
    );
    for (let i = 0; i < hashes.length; i++) {
        const data = hashes[i].data() || {};
        if (data.username && data.username !== DELETED_LABEL) {
            await batcher.update(hashes[i].ref, { username: DELETED_LABEL });
        }
    }
    const contributors = await collectDocs(
        stateRef.collection('contributors').where('uid', '==', uid),
        documentIdField
    );
    for (let i = 0; i < contributors.length; i++) {
        const data = contributors[i].data() || {};
        if (data.username && data.username !== DELETED_LABEL) {
            await batcher.update(contributors[i].ref, { username: DELETED_LABEL });
        }
    }
}

async function anonymizeNameOnRef(batcher, ref, snap) {
    if (!snap || !snap.exists) return;
    const data = snap.data() || {};
    if (data.username && data.username !== DELETED_LABEL) {
        await batcher.update(ref, { username: DELETED_LABEL });
    }
}

function isRaidPath(path) {
    return String(path || '').indexOf('raid_bosses/') === 0;
}

async function anonymizeRaidParticipants(db, batcher, uid, username, documentIdField) {
    const seen = new Set();
    async function anonymizeParticipantDoc(doc) {
        if (!doc || !doc.ref || !isRaidPath(doc.ref.path) || seen.has(doc.ref.path)) return;
        const data = doc.data() || {};
        if (doc.id !== uid && data.uid !== uid) return;
        seen.add(doc.ref.path);
        if (data.username && data.username !== DELETED_LABEL) {
            await batcher.update(doc.ref, { username: DELETED_LABEL });
        }
    }
    if (typeof db.collectionGroup === 'function') {
        const winners = await collectDocs(
            db.collectionGroup('winners').where('uid', '==', uid),
            documentIdField
        );
        for (let i = 0; i < winners.length; i++) {
            const doc = winners[i];
            if (!isRaidPath(doc.ref.path)) continue;
            await anonymizeNameOnRef(batcher, doc.ref, { exists: true, data: function() { return doc.data() || {}; } });
        }
        const byUid = await collectDocs(
            db.collectionGroup('participants').where('uid', '==', uid),
            documentIdField
        );
        for (let i = 0; i < byUid.length; i++) await anonymizeParticipantDoc(byUid[i]);
        if (username && username !== DELETED_LABEL) {
            const byName = await collectDocs(
                db.collectionGroup('participants').where('username', '==', username),
                documentIdField
            );
            for (let i = 0; i < byName.length; i++) await anonymizeParticipantDoc(byName[i]);
        }
    }
    // Recent bosses, by document id, cover participant rows that have no uid field.
    let bossesQuery = db.collection('raid_bosses');
    if (typeof bossesQuery.orderBy === 'function') bossesQuery = bossesQuery.orderBy('startTime', 'desc');
    const bosses = await collectDocs(bossesQuery, null, { ordered: true, cap: RAID_BOSS_LOOKUP_CAP });
    for (let i = 0; i < bosses.length; i++) {
        const participantRef = bosses[i].ref.collection('participants').doc(uid);
        const winnerRef = bosses[i].ref.collection('winners').doc(uid);
        const participant = await participantRef.get();
        const winner = await winnerRef.get();
        if (participant.exists) {
            await anonymizeParticipantDoc({
                id: uid,
                ref: participantRef,
                data: function() { return participant.data() || {}; },
            });
        }
        await anonymizeNameOnRef(batcher, winnerRef, winner);
    }
}

function anonymizeWinnerArray(winners, uid) {
    if (!Array.isArray(winners)) return null;
    let changed = false;
    const next = winners.map(function(winner) {
        if (!winner || winner.uid !== uid || winner.username === DELETED_LABEL) return winner;
        changed = true;
        return Object.assign({}, winner, { username: DELETED_LABEL });
    });
    return changed ? next : null;
}

async function anonymizeLeaderboardDoc(batcher, doc, uid) {
    const data = doc.data() || {};
    const next = anonymizeWinnerArray(data.winners, uid);
    if (next) await batcher.update(doc.ref, { winners: next });
}

async function anonymizeWinnerLists(db, batcher, uid, documentIdField) {
    const seen = new Set();
    const tagged = await collectDocs(
        db.collection('leaderboard_winners').where('uids', 'array-contains', uid),
        documentIdField
    );
    for (let i = 0; i < tagged.length; i++) {
        seen.add(tagged[i].ref.path);
        await anonymizeLeaderboardDoc(batcher, tagged[i], uid);
    }
    let recent = db.collection('leaderboard_winners');
    if (typeof recent.orderBy === 'function') recent = recent.orderBy('settledAt', 'desc');
    const boards = await collectDocs(recent, null, { ordered: true, cap: LEADERBOARD_SCAN_CAP });
    for (let i = 0; i < boards.length; i++) {
        if (seen.has(boards[i].ref.path)) continue;
        await anonymizeLeaderboardDoc(batcher, boards[i], uid);
    }
    const stats = await collectIdPrefix(db.collection('stats'), 'raffle_', documentIdField);
    for (let i = 0; i < stats.length; i++) {
        const id = stats[i].id || '';
        if (id.indexOf('raffle_') !== 0 || id.slice(-9) !== '_snapshot') continue;
        const data = stats[i].data() || {};
        const patch = {};
        if (data.winnerUid === uid && data.winner && data.winner !== DELETED_LABEL) {
            patch.winner = DELETED_LABEL;
        }
        if (data.allEntrants && data.allEntrants[uid] && data.allEntrants[uid].username !== DELETED_LABEL) {
            const copy = Object.assign({}, data.allEntrants);
            copy[uid] = Object.assign({}, data.allEntrants[uid], { username: DELETED_LABEL });
            patch.allEntrants = copy;
        }
        if (Object.keys(patch).length) await batcher.update(stats[i].ref, patch);
    }
}

async function loadWeeklyChallenges(db, documentIdField) {
    return collectDocs(db.collection('weekly_challenges'), documentIdField);
}

async function clearWeeklyParticipantFlag(db, batcher, uid, documentIdField, weeks) {
    const rows = weeks || await loadWeeklyChallenges(db, documentIdField);
    for (let i = 0; i < rows.length; i++) {
        const data = rows[i].data() || {};
        const participants = data.participants;
        if (!participants || typeof participants !== 'object' || !Object.prototype.hasOwnProperty.call(participants, uid)) continue;
        const next = Object.assign({}, participants);
        delete next[uid];
        await batcher.update(rows[i].ref, { participants: next });
    }
    return rows;
}

async function giftRecipientPairIds(db, uid, documentIdField) {
    const ids = new Set();
    const owned = await collectDocs(db.collection('gifts').where('ownerId', '==', uid), documentIdField);
    for (let i = 0; i < owned.length; i++) {
        const sender = String((owned[i].data() || {}).sentBy || '');
        if (!sender || sender === uid || sender.indexOf('/') !== -1 || !UID_RE.test(sender)) continue;
        ids.add(sender + '_' + uid);
    }
    const sent = await collectDocs(db.collection('gifts').where('sentBy', '==', uid), documentIdField);
    for (let i = 0; i < sent.length; i++) {
        const owner = String((sent[i].data() || {}).ownerId || '');
        if (!owner || owner.indexOf('/') !== -1 || !UID_RE.test(owner)) continue;
        ids.add(uid + '_' + owner);
    }
    return ids;
}

async function deleteGiftPairs(db, batcher, uid, pairIds, documentIdField) {
    const prefixed = await collectIdPrefix(db.collection('gift_pending_pairs'), uid + '_', documentIdField);
    for (let i = 0; i < prefixed.length; i++) await batcher.remove(prefixed[i].ref);
    const ids = pairIds || new Set();
    for (const id of ids) {
        if (!id || id.indexOf('/') !== -1) continue;
        await deleteExactIfPresent(db, batcher, 'gift_pending_pairs', id);
    }
}

async function deleteOwnedGifts(db, batcher, uid, documentIdField) {
    const gifts = await deleteWhere(db, batcher, 'gifts', 'ownerId', '==', uid, [], documentIdField);
    for (let i = 0; i < gifts.length; i++) {
        const secret = db.collection('gift_secrets').doc(gifts[i].id);
        const snap = await secret.get();
        if (snap.exists) await batcher.remove(secret);
    }
    await deleteWhere(db, batcher, 'gift_secrets', 'ownerId', '==', uid, [], documentIdField);
}

async function deleteUserTree(batcher, userRef, documentIdField) {
    const cols = await childCollections(userRef, USER_SUBCOLLECTIONS, true);
    for (let i = 0; i < cols.length; i++) {
        const name = collectionNameOf(cols[i]);
        if (CAP_SUBCOLLECTIONS.indexOf(name) !== -1) continue;
        if (DEFERRED_USER_SUBCOLLECTIONS.indexOf(name) !== -1) continue;
        const children = await collectDocs(cols[i], documentIdField);
        for (let c = 0; c < children.length; c++) {
            await deleteDocTree(batcher, children[c].ref, [], documentIdField, false);
        }
    }
    await batcher.remove(userRef);
}

async function deleteExactIfPresent(db, batcher, collectionName, id) {
    if (!id || String(id).indexOf('/') !== -1) return;
    const ref = db.collection(collectionName).doc(id);
    const snap = await ref.get();
    if (snap.exists) await batcher.remove(ref);
}

async function deleteIdPrefix(db, batcher, collectionName, uid, documentIdField) {
    const docs = await collectIdPrefix(db.collection(collectionName), uid + '_', documentIdField);
    for (let i = 0; i < docs.length; i++) await batcher.remove(docs[i].ref);
}

async function removeBeatsLikes(db, batcher, uid, documentIdField) {
    const docs = await collectDocs(
        db.collection('beats_tracks').where('likedBy', 'array-contains', uid),
        documentIdField
    );
    for (let i = 0; i < docs.length; i++) {
        const data = docs[i].data() || {};
        const likedBy = Array.isArray(data.likedBy) ? data.likedBy.filter(function(id) { return id !== uid; }) : [];
        const likes = Math.max(0, (Number(data.likes) || 0) - 1);
        await batcher.update(docs[i].ref, { likedBy: likedBy, likes: likes });
    }
}

async function stripPollVoters(db, batcher, uid, documentIdField) {
    const docs = await collectDocs(
        db.collection('poll_votes').where('voters', 'array-contains', uid),
        documentIdField
    );
    for (let i = 0; i < docs.length; i++) {
        const data = docs[i].data() || {};
        const voters = Array.isArray(data.voters) ? data.voters.filter(function(id) { return id !== uid; }) : [];
        await batcher.update(docs[i].ref, { voters: voters });
    }
}

const CONTENT_CLEAR_FIELDS = [
    'link', 'imageUrl', 'gifUrl', 'coverUrl', 'authorPic', 'fileUrl', 'audioUrl',
    'storagePath', 'imageBase64', 'mediaUrl', 'thumbnail', 'subtitle', 'summary', 'authorFaction',
];

function authorOf(data) {
    const src = data || {};
    return String(src.authorId || src.uid || src.author || '');
}

function repliedByOther(docs, uid) {
    for (let i = 0; i < docs.length; i++) {
        const who = authorOf(docs[i].data ? docs[i].data() : docs[i]);
        // A reply already marked deleted still belongs to someone else.
        if (who && who !== uid) return true;
    }
    return false;
}

async function subcollectionReplies(parentRef) {
    if (!parentRef || typeof parentRef.collection !== 'function') return [];
    const names = ['replies', 'comments'];
    const out = [];
    for (let i = 0; i < names.length; i++) {
        let snap = null;
        try {
            snap = await parentRef.collection(names[i]).get();
        } catch (err) {
            snap = null;
        }
        if (!snap || typeof snap.forEach !== 'function') continue;
        snap.forEach(function (doc) { out.push(doc); });
    }
    return out;
}

async function priorIdentityHashes(db, uid, userData) {
    const out = [];
    function add(value) {
        const hash = String(value || '').trim().toLowerCase();
        if (!/^[a-f0-9]{64}$/.test(hash)) return;
        if (out.indexOf(hash) === -1) out.push(hash);
    }
    const user = userData || {};
    add(user.emailHash);
    if (Array.isArray(user.providerHashes)) user.providerHashes.forEach(add);
    try {
        const hist = await db.collection('email_history').doc(uid).get();
        const hashes = hist && hist.exists && hist.data() && hist.data().hashes;
        if (Array.isArray(hashes)) hashes.forEach(add);
    } catch (err) { /* history is included when the read succeeds */ }
    try {
        const ident = await db.collection('identity_history').doc(uid).get();
        const hashes = ident && ident.exists && ident.data() && ident.data().hashes;
        if (Array.isArray(hashes)) hashes.forEach(add);
    } catch (err) { /* provider history is included when the read succeeds */ }
    return out;
}

function authoredTombstone() {
    const patch = {
        deleted: true,
        authorId: DELETED_UID,
        author: DELETED_UID,
        uid: DELETED_UID,
        authorName: DELETED_LABEL,
        name: DELETED_LABEL,
        username: DELETED_LABEL,
        body: DELETED_LABEL,
        text: DELETED_LABEL,
        title: DELETED_LABEL,
    };
    CONTENT_CLEAR_FIELDS.forEach(function (key) { patch[key] = ''; });
    return patch;
}

async function repliesWhere(db, collectionName, field, id, documentIdField) {
    if (!id || String(id).indexOf('/') !== -1) return [];
    return collectDocs(db.collection(collectionName).where(field, '==', id), documentIdField);
}

async function settleAuthoredDoc(db, batcher, doc, uid, replyDocs, documentIdField, childNames) {
    if (repliedByOther(replyDocs, uid)) {
        await batcher.update(doc.ref, authoredTombstone());
        return 'anon';
    }
    await deleteDocTree(batcher, doc.ref, childNames || [], documentIdField, false);
    return 'delete';
}

async function anonymizeOrDeleteAuthored(db, batcher, uid, documentIdField) {
    const posts = await collectDocs(
        db.collection('forum_posts').where('authorId', '==', uid),
        documentIdField
    );
    for (let i = 0; i < posts.length; i++) {
        const replies = await repliesWhere(db, 'forum_replies', 'postId', posts[i].id, documentIdField);
        const nested = await subcollectionReplies(posts[i].ref);
        await settleAuthoredDoc(db, batcher, posts[i], uid, replies.concat(nested), documentIdField, ['replies', 'comments']);
    }
    const forumReplies = await collectDocs(
        db.collection('forum_replies').where('authorId', '==', uid),
        documentIdField
    );
    for (let i = 0; i < forumReplies.length; i++) {
        const children = await repliesWhere(db, 'forum_replies', 'parentReplyId', forumReplies[i].id, documentIdField);
        await settleAuthoredDoc(db, batcher, forumReplies[i], uid, children, documentIdField, []);
    }
    const articles = await collectDocs(
        db.collection('articles').where('authorId', '==', uid),
        documentIdField
    );
    for (let i = 0; i < articles.length; i++) {
        const replies = await repliesWhere(db, 'article_replies', 'articleId', articles[i].id, documentIdField);
        const nested = await subcollectionReplies(articles[i].ref);
        await settleAuthoredDoc(db, batcher, articles[i], uid, replies.concat(nested), documentIdField, ['replies', 'comments']);
    }
    const articleReplies = await collectDocs(
        db.collection('article_replies').where('authorId', '==', uid),
        documentIdField
    );
    for (let i = 0; i < articleReplies.length; i++) {
        const children = await repliesWhere(db, 'article_replies', 'parentReplyId', articleReplies[i].id, documentIdField);
        await settleAuthoredDoc(db, batcher, articleReplies[i], uid, children, documentIdField, []);
    }
}

async function dropPendingCipherReveals(db, batcher, uid, documentIdField) {
    const shares = await collectDocs(
        db.collection('cipher_shares').where('senderUid', '==', uid),
        documentIdField
    );
    for (let i = 0; i < shares.length; i++) {
        const data = shares[i].data() || {};
        if (data.revealed === true) continue;
        const shareId = String(data.shareId || shares[i].id || '').replace(/[^A-Za-z0-9_-]/g, '');
        if (!shareId) continue;
        await deleteExactIfPresent(db, batcher, 'notifications', 'cshare_' + shareId);
    }
}

function usernameConfirmed(user, typed) {
    const name = String(user && user.username || '').trim();
    const input = String(typed || '').trim();
    if (!name) return input.toUpperCase() === 'DELETE';
    return input.toLowerCase() === name.toLowerCase();
}

function satsBalanceOf(user) {
    const src = user || {};
    const direct = Number(src.sats);
    if (direct > 0) return direct;
    const points = Number(src.points) || 0;
    const claimed = Number(src.pointsClaimed) || 0;
    const donated = Number(src.pointsDonated) || 0;
    const exchanged = Number(src.pointsExchanged) || 0;
    return Math.floor((points - claimed - donated - exchanged) / 10);
}

function forfeitRequired(user, withdrawals) {
    if (satsBalanceOf(user) > 0) return true;
    const rows = withdrawals || [];
    for (let i = 0; i < rows.length; i++) {
        const status = String((rows[i] && rows[i].status) || '').toLowerCase();
        if (status === 'pending' || status === 'processing') return true;
    }
    return false;
}

async function deleteTopicPosts(db, batcher, uid, documentIdField) {
    await deleteExactIfPresent(db, batcher, 'topic_discussion_limits', uid);
    await deleteExactIfPresent(db, batcher, 'nacho_section_limits', uid);
    if (typeof db.collectionGroup !== 'function') return;
    const posts = await collectDocs(
        db.collectionGroup('posts').where('uid', '==', uid).orderBy('createdAt', 'desc'),
        documentIdField,
        { ordered: true }
    );
    for (let i = 0; i < posts.length; i++) {
        const parts = String(posts[i].ref && posts[i].ref.path || '').split('/');
        if (parts.length < 4 || parts[0] !== 'topic_discussions' || parts[2] !== 'posts') continue;
        const parentPath = parts.slice(0, 3).join('/');
        const replies = await collectDocs(
            db.collection(parentPath).where('parentId', '==', parts[3]),
            documentIdField
        );
        await deleteExactIfPresent(db, batcher, 'topic_discussion_private', parts[1] + '~' + parts[3]);
        if (repliedByOther(replies, uid)) {
            await batcher.update(posts[i].ref, authoredTombstone());
            continue;
        }
        await deleteDocTree(batcher, posts[i].ref, ['reports'], documentIdField, false);
    }
}

async function deleteReplyBonus(db, batcher, uid, documentIdField) {
    await deleteExactIfPresent(db, batcher, 'reply_bonus_state', uid);
    await deleteExactIfPresent(db, batcher, 'rate_limits', 'reply_' + uid);
    const prefixed = await collectIdPrefix(db.collection('reply_bonus_pairs'), 'p_' + uid + '__', documentIdField);
    for (let i = 0; i < prefixed.length; i++) await batcher.remove(prefixed[i].ref);
}

async function deleteWeeklyContribs(db, batcher, uid, documentIdField, weeks) {
    const rows = weeks || await loadWeeklyChallenges(db, documentIdField);
    for (let i = 0; i < rows.length; i++) {
        const contribs = await collectIdPrefix(rows[i].ref.collection('user_contribs'), uid + '_', documentIdField);
        for (let c = 0; c < contribs.length; c++) await batcher.remove(contribs[c].ref);
    }
}

async function deleteAuthUser(authApi, uid) {
    if (!authApi || typeof authApi.deleteUser !== 'function') {
        throw new Error('Auth deletion is required before cap records can be removed');
    }
    if (typeof authApi.revokeRefreshTokens === 'function') {
        try {
            await authApi.revokeRefreshTokens(uid);
        } catch (err) {
            if (!isUserNotFound(err)) throw err;
        }
    }
    try {
        await authApi.deleteUser(uid);
    } catch (err) {
        if (!isUserNotFound(err)) throw err;
    }
}

async function wipeCapsAndUserLimits(db, batcher, uid, documentIdField, opts) {
    const options = opts || {};
    const userRef = db.collection('users').doc(uid);
    for (let i = 0; i < CAP_SUBCOLLECTIONS.length; i++) {
        const docs = await collectDocs(userRef.collection(CAP_SUBCOLLECTIONS[i]), documentIdField);
        for (let c = 0; c < docs.length; c++) await batcher.remove(docs[c].ref);
    }
    for (let i = 0; i < DEFERRED_USER_SUBCOLLECTIONS.length; i++) {
        const docs = await collectDocs(userRef.collection(DEFERRED_USER_SUBCOLLECTIONS[i]), documentIdField);
        for (let c = 0; c < docs.length; c++) {
            await deleteDocTree(batcher, docs[c].ref, [], documentIdField, false);
        }
    }
    for (let i = 0; i < DEFERRED_QUERIES.length; i++) {
        const q = DEFERRED_QUERIES[i];
        await deleteWhere(db, batcher, q[0], q[1], q[2], uid, q[3], documentIdField);
    }
    const exact = [
        ['shoutout_limits', 'forum_' + uid],
        ['shoutout_limits', 'market_' + uid],
        ['shoutout_limits', 'hour_' + uid],
        ['rate_limits', 'bridge_' + uid],
        ['rate_limits', 'v4v_' + uid],
        ['rate_limits', 'sayhi_' + uid],
        ['rate_limits', 'announce_' + uid],
        ['rate_limits', 'delete_' + uid],
        ['rate_limits', 'reply_' + uid],
        ['totp_rate_limits', uid],
        ['totp_rate_limits', uid + '_day'],
        ['totp_rate_limits', uid + '_verify'],
        ['totp_rate_limits', uid + '_disable'],
        ['totp_rate_limits', uid + '_regen'],
        ['recovery_codes', uid],
    ];
    for (let i = 0; i < exact.length; i++) {
        await deleteExactIfPresent(db, batcher, exact[i][0], exact[i][1]);
    }
    await deleteIdPrefix(db, batcher, 'action_cooldowns', uid, documentIdField);
    await deleteIdPrefix(db, batcher, 'raid_daily_caps', uid, documentIdField);
    await deleteGiftPairs(db, batcher, uid, options.pairIds, documentIdField);
    await deleteReplyBonus(db, batcher, uid, documentIdField);
    await stripPollVoters(db, batcher, uid, documentIdField);
    await deleteExactIfPresent(db, batcher, 'tctv_watch', uid);
    if (!options.light) await deleteWeeklyContribs(db, batcher, uid, documentIdField, options.weeks);
}

async function deleteStorageForUser(bucket, uid) {
    const prefixes = STORAGE_PREFIXES.map(function(prefix) { return prefix + uid + '/'; });
    if (!bucket || typeof bucket.deleteFiles !== 'function') return prefixes;
    for (let i = 0; i < prefixes.length; i++) {
        try {
            await bucket.deleteFiles({ prefix: prefixes[i] });
        } catch (err) {
            const code = err && (err.code || err.statusCode);
            if (code === 404 || code === '404') continue;
            // Auth and Firestore emulators do not run Storage. Production
            // still deletes every prefix and still fails closed on other errors.
            if (process.env.FIRESTORE_EMULATOR_HOST && !process.env.FIREBASE_STORAGE_EMULATOR_HOST) continue;
            throw err;
        }
    }
    return prefixes;
}

async function purgeAccount({ db, bucket, authApi, uid, documentIdField, light }) {
    if (!UID_RE.test(uid)) throw new Error('Invalid uid');
    const batcher = createBatcher(db);
    const guest = light === true;

    const userSnap = await db.collection('users').doc(uid).get();
    const userData = userSnap.exists ? (userSnap.data() || {}) : null;
    const username = userData && (userData.username || userData.displayName) ? (userData.username || userData.displayName) : '';
    // Read pair ids before the gift docs are deleted. The recipient side is
    // sender_uid, which a uid_ range cannot see.
    const pairIds = await giftRecipientPairIds(db, uid, documentIdField);

    let chat = { anonymized: 0, ids: [] };
    let weeks = null;
    if (!guest) {
        chat = await anonymizeGlobalChat(db, batcher, uid, documentIdField);
        await anonymizeMentions(db, batcher, uid, username, documentIdField);
        await stripReactionUid(db, batcher, 'global_chat', uid);
        await stripReactionUid(db, batcher, 'announcements', uid);
        await anonymizeRaidParticipants(db, batcher, uid, username, documentIdField);
        await anonymizeWinnerLists(db, batcher, uid, documentIdField);
        weeks = await clearWeeklyParticipantFlag(db, batcher, uid, documentIdField);
    }
    await anonymizeFavorNames(db, batcher, uid, documentIdField);
    await deleteUsernameReservations(db, batcher, uid, userData, documentIdField);
    await removeBeatsLikes(db, batcher, uid, documentIdField);
    await deleteTopicPosts(db, batcher, uid, documentIdField);
    await anonymizeOrDeleteAuthored(db, batcher, uid, documentIdField);
    await dropPendingCipherReveals(db, batcher, uid, documentIdField);

    let deletedDocs = 0;
    for (let i = 0; i < DELETION_QUERIES.length; i++) {
        const q = DELETION_QUERIES[i];
        if (q[0] === 'gifts' || q[0] === 'gift_secrets' || q[0] === 'usernames') continue;
        const found = await deleteWhere(db, batcher, q[0], q[1], q[2], uid, q[3], documentIdField);
        deletedDocs += found.length;
    }
    await deleteOwnedGifts(db, batcher, uid, documentIdField);
    const mirrorRateRef = db.collection('telegram_mirror_state').doc('rate_' + String(uid).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120));
    const mirrorRateSnap = await mirrorRateRef.get();
    if (mirrorRateSnap && mirrorRateSnap.exists) await batcher.remove(mirrorRateRef);

    if (typeof db.collectionGroup === 'function') {
        const comments = await collectDocs(
            db.collectionGroup('comments').where('authorId', '==', uid),
            documentIdField
        );
        for (let i = 0; i < comments.length; i++) {
            await batcher.remove(comments[i].ref);
            deletedDocs++;
        }
    }

    const direct = [
        ['public_profiles', uid, []],
        // Old name, new name, and date. Deleting the user doc and the public
        // profile clears the migrated-from fields and the free-rename flag.
        // This row would otherwise keep a real name after the account is gone.
        ['username_migrations', uid, []],
        ['push_tokens', uid, ['devices']],
        ['visits', uid, []],
        ['presence', uid, []],
        ['giveaway_entries', uid, []],
        ['active_predictions', uid, []],
        ['prediction_stats', uid, []],
        ['tctv_presence', uid, []],
        ['buddy_pool', uid, []],
        ['pvp_lobby', uid, []],
        ['totp_secrets', uid, []],
        ['totp_pending', uid, []],
        ['totp_sessions', uid, []],
        ['recovery_codes', uid, []],
        ['suggestions', uid, []],
        ['referral_signals', uid, []],
        ['email_change_pending', uid, []],
        ['email_history', uid, []],
    ];
    for (let i = 0; i < direct.length; i++) {
        await deleteDocTree(batcher, db.collection(direct[i][0]).doc(direct[i][1]), direct[i][2], documentIdField, false);
        deletedDocs++;
    }
    // Session ids are uid + '_' + sessionId, so the single doc above is only
    // the legacy row. Every live session is stored under its own id.
    await deleteWhere(db, batcher, 'totp_sessions', 'uid', '==', uid, [], documentIdField);
    await deleteWhere(db, batcher, 'trusted_devices', 'uid', '==', uid, [], documentIdField);
    await deleteWhere(db, batcher, 'totp_fresh_proofs', 'uid', '==', uid, [], documentIdField);
    await deleteDocTree(
        batcher,
        db.collection('global_chat_meta').doc('live_dj').collection('dj_queue').doc(uid),
        [],
        documentIdField,
        false
    );
    await deleteDocTree(
        batcher,
        db.collection('satoshiFavor').doc('personalBests').collection('users').doc(uid),
        [],
        documentIdField,
        false
    );
    // Profile tree before the auth user. Cap subcollections stay until the
    // sign-in is gone, so a stopped call cannot reset them and keep the uid.
    await deleteUserTree(batcher, db.collection('users').doc(uid), documentIdField);
    deletedDocs++;

    await batcher.flush();
    await deleteAuthUser(authApi, uid);
    await wipeCapsAndUserLimits(db, batcher, uid, documentIdField, {
        light: guest,
        pairIds: pairIds,
        weeks: weeks,
    });
    await batcher.flush();
    const storagePrefixes = await deleteStorageForUser(bucket, uid);
    return {
        uid: uid,
        anonymizedChat: chat.anonymized,
        deletedDocs: deletedDocs,
        storagePrefixes: storagePrefixes,
        authDeleted: true,
        light: guest,
    };
}

function createDeleteAccountHandlers({ db, bucket, authApi, HttpsError, nowSec, nowMs, documentIdField, ipSecret }) {
    return {
        async deleteAccount(data, context) {
            const now = typeof nowSec === 'function'
                ? nowSec()
                : (typeof nowSec === 'number' ? nowSec : Math.floor(Date.now() / 1000));
            const decision = authorizeDeleteAccount(context && context.auth, data || {}, now);
            if (!decision.ok) throw new HttpsError(decision.code, decision.message);
            if (!decision.byAdmin) {
                const secondFactor = require('./secondFactor');
                await secondFactor.requireFreshStepUp(secondFactor.stamp(data, context), 'deleteAccount');
            }
            const clock = typeof nowMs === 'function'
                ? nowMs()
                : (typeof nowMs === 'number' ? nowMs : Date.now());
            const anonymous = isAnonymousAuth(context && context.auth);
            try {
                await enforceDeleteRateLimit(db, {
                    callerUid: context.auth.uid,
                    byAdmin: decision.byAdmin,
                    anonymous: anonymous,
                    ip: clientIpFromContext(context),
                    nowMs: clock,
                    ipSecret: ipSecret,
                });
            } catch (err) {
                if (err && err.code === 'resource-exhausted') {
                    throw new HttpsError('resource-exhausted', err.message);
                }
                throw err;
            }
            const targetUid = decision.uid;
            const userSnap = await db.collection('users').doc(targetUid).get();
            const userData = userSnap.exists ? (userSnap.data() || {}) : {};
            if (!decision.byAdmin) {
                if (!usernameConfirmed(userData, data && data.confirmUsername)) {
                    throw new HttpsError('failed-precondition', 'Type your username to confirm deletion.');
                }
                const withdrawalDocs = await collectDocs(
                    db.collection('users').doc(targetUid).collection('sats_withdrawals'),
                    documentIdField
                );
                const withdrawals = withdrawalDocs.map(function (doc) { return doc.data() || {}; });
                if (forfeitRequired(userData, withdrawals) && !(data && data.acknowledgeForfeit === true)) {
                    throw new HttpsError('failed-precondition', 'Confirm that your sats balance is forfeited.');
                }
            }
            const light = anonymous && !decision.byAdmin;
            if (!light) {
                let authUser = null;
                if (authApi && typeof authApi.getUser === 'function') {
                    try {
                        authUser = await authApi.getUser(targetUid);
                    } catch (err) {
                        if (!isUserNotFound(err)) throw err;
                    }
                }
                const ownerCaller = !decision.byAdmin && context.auth && context.auth.uid === targetUid;
                const identity = accountTombstone.identityFrom({
                    uid: targetUid,
                    authUser: authUser,
                    token: ownerCaller ? ((context.auth && context.auth.token) || {}) : null,
                });
                const priorHashes = await priorIdentityHashes(db, targetUid, userData);
                let gate;
                try {
                    gate = await accountTombstone.assertDeletionAllowed(db, identity, clock, priorHashes);
                } catch (err) {
                    if (err && err.code === 'resource-exhausted') {
                        throw new HttpsError('resource-exhausted', 'Too many deletions for this sign-in. Try again later.');
                    }
                    if (err && err.code === 'failed-precondition') {
                        throw new HttpsError('failed-precondition', 'Account deletion is unavailable right now.');
                    }
                    throw err;
                }
                const ledgerSnap = await db.collection('faucet_ledger').doc(targetUid).get();
                const ledger = ledgerSnap.exists ? (ledgerSnap.data() || {}) : {};
                const referralSnap = await db.collection('referrals').doc(targetUid).get();
                const referral = referralSnap.exists ? (referralSnap.data() || {}) : {};
                const createdRaw = authUser && authUser.metadata && authUser.metadata.creationTime;
                const createdMs = Date.parse(createdRaw || '') || 0;
                const ageDays = createdMs ? Math.max(0, Math.floor((clock - createdMs) / 86400000)) : 0;
                const withdrawn = Math.max(Number(userData.satsWithdrawn) || 0, Number(ledger.satsWithdrawn) || 0);
                const lastClaim = userData.lastSatsClaim || ledger.lastSatsClaim || 0;
                await accountTombstone.writeTombstones(db, {
                    hashes: gate.hashes,
                    docs: gate.docs,
                    nowMs: clock,
                    uid: targetUid,
                    ageDays: ageDays,
                    banned: userData.banned === true,
                    satsDisabled: userData.satsDisabled === true,
                    flagged: userData.flagged === true,
                    ledgerBanned: ledger.banned === true,
                    satsWithdrawn: withdrawn,
                    ledgerSatsWithdrawn: Number(ledger.satsWithdrawn) || 0,
                    lastSatsClaim: lastClaim,
                    faucetClaimed: withdrawn > 0 || !!lastClaim,
                    refereePaid: !!referral.ticketsAwarded || referral.status === 'paid',
                    referrerEarned: (Number(userData.referralTicketsEarned) || 0) > 0,
                });
            }
            const summary = await purgeAccount({
                db: db,
                bucket: bucket,
                authApi: authApi,
                uid: targetUid,
                documentIdField: documentIdField,
                light: light,
            });
            return {
                ok: true,
                uid: decision.uid,
                byAdmin: decision.byAdmin,
                anonymizedChat: summary.anonymizedChat,
                deletedDocs: summary.deletedDocs,
                storagePrefixes: summary.storagePrefixes,
                authDeleted: summary.authDeleted,
                light: summary.light,
            };
        },
    };
}

function bindDeleteAccount(functionsV1, admin, db, secrets) {
    const handlers = createDeleteAccountHandlers({
        db: db,
        bucket: admin.storage().bucket(),
        authApi: admin.auth(),
        HttpsError: functionsV1.https.HttpsError,
        documentIdField: admin.firestore.FieldPath.documentId(),
    });
    return {
        deleteAccount: functionsV1.runWith({
            timeoutSeconds: 540,
            memory: '1GB',
            enforceAppCheck: true,
            secrets: secrets || [],
        }).https.onCall(handlers.deleteAccount),
    };
}

module.exports = {
    BATCH_LIMIT: BATCH_LIMIT,
    QUERY_PAGE: QUERY_PAGE,
    REACTION_SCAN_CAP: REACTION_SCAN_CAP,
    LEADERBOARD_SCAN_CAP: LEADERBOARD_SCAN_CAP,
    RAID_BOSS_LOOKUP_CAP: RAID_BOSS_LOOKUP_CAP,
    DELETE_RATE_MAX_UID: DELETE_RATE_MAX_UID,
    DELETE_RATE_MAX_ANON_IP: DELETE_RATE_MAX_ANON_IP,
    DELETE_RATE_TTL_MS: DELETE_RATE_TTL_MS,
    UID_RE: UID_RE,
    deletionIpDocId: deletionIpDocId,
    REAUTH_MAX_AGE_SEC: REAUTH_MAX_AGE_SEC,
    DELETED_LABEL: DELETED_LABEL,
    DELETED_UID: DELETED_UID,
    STORAGE_PREFIXES: STORAGE_PREFIXES,
    RETAINED_COLLECTIONS: RETAINED_COLLECTIONS,
    USER_SUBCOLLECTIONS: USER_SUBCOLLECTIONS,
    CAP_SUBCOLLECTIONS: CAP_SUBCOLLECTIONS,
    DELETION_QUERIES: DELETION_QUERIES,
    INDEX_AUDIT: INDEX_AUDIT,
    authorizeDeleteAccount: authorizeDeleteAccount,
    chatTombstone: chatTombstone,
    quoteTombstone: quoteTombstone,
    anonymizeMentionText: anonymizeMentionText,
    reactionsWithoutUid: reactionsWithoutUid,
    purgeAccount: purgeAccount,
    usernameConfirmed: usernameConfirmed,
    forfeitRequired: forfeitRequired,
    satsBalanceOf: satsBalanceOf,
    authoredTombstone: authoredTombstone,
    createDeleteAccountHandlers: createDeleteAccountHandlers,
    bindDeleteAccount: bindDeleteAccount,
};
