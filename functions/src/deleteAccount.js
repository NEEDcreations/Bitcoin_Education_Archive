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
// 3. A whole-collection page ordered only by document id (reactions, gift
//    pairs, winner lists, and user-keyed limit ids). The automatic __name__
//    index serves that.
// Direct document gets do not need an index.
//
// Financial and abuse records in RETAINED_COLLECTIONS are never written.
// Per-day caps and other user-keyed limit docs are removed only after the
// Firebase Auth user is deleted in this same call.

const BATCH_LIMIT = 400;
const QUERY_PAGE = 200;
const IN_LIMIT = 10;
const REAUTH_MAX_AGE_SEC = 5 * 60;
const DELETED_LABEL = '[deleted]';
const DELETED_UID = 'deleted';
const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;

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
];

const RETAINED = new Set(RETAINED_COLLECTIONS);

const CHAT_MEDIA_FIELDS = ['imageUrl', 'gifUrl', 'imageBase64', 'storagePath', 'fileUrl', 'audioUrl', 'coverUrl'];

// Single-field collection queries. op is ==, array-contains, or in.
// childNames are deleted by name. Unknown children are not listed.
const DELETION_QUERIES = [
    ['dm_conversations', 'participants', 'array-contains', ['messages']],
    ['conversations', 'participants', 'array-contains', ['messages']],
    ['forum_posts', 'authorId', '==', ['replies', 'comments']],
    ['forum_replies', 'authorId', '==', []],
    ['marketplace', 'sellerUid', '==', []],
    ['marketplace_messages', 'buyerUid', '==', []],
    ['marketplace_messages', 'sellerUid', '==', []],
    ['suggestions', 'uid', '==', []],
    ['beats_tracks', 'authorId', '==', ['comments']],
    ['articles', 'authorId', '==', ['replies', 'comments']],
    ['article_replies', 'authorId', '==', []],
    ['irl_events', 'hostId', '==', []],
    ['notifications', 'recipientId', '==', []],
    ['notifications', 'senderId', '==', []],
    ['keys', 'ownerId', '==', []],
    ['locked_ciphers', 'ownerId', '==', []],
    ['peer_requests', 'from', '==', []],
    ['peer_requests', 'to', '==', []],
    ['peerRelationships', 'uid1', '==', []],
    ['peerRelationships', 'uid2', '==', []],
    ['channel_ratings', 'userId', '==', []],
    ['tctv_view_days', 'viewerId', '==', []],
    ['key_send_pairs', 'senderUid', '==', []],
    ['key_send_pairs', 'recipientUid', '==', []],
    ['buddy_matches', 'user1.uid', '==', []],
    ['buddy_matches', 'user2.uid', '==', []],
    ['pvp_matches', 'player1.uid', '==', []],
    ['pvp_matches', 'player2.uid', '==', []],
    ['certs', 'uid', '==', []],
    ['quest_answer_keys', 'uid', '==', []],
    ['scholar_exam_keys', 'uid', '==', []],
    ['shoutout_claims', 'authorUid', '==', []],
    ['gifts', 'ownerId', '==', []],
    ['gift_secrets', 'ownerId', '==', []],
    ['raid_deck_completions', 'uid', '==', []],
    ['usernames', 'uid', '==', []],
];

const COLLECTION_GROUP_QUERIES = [
    { collection: 'comments', field: 'authorId', op: '==', orderBy: '__name__' },
];

// Paged by document id only. No extra field filter, so no composite index.
const DOCUMENT_ID_SCANS = [
    'gift_pending_pairs',
    'global_chat',
    'announcements',
    'leaderboard_winners',
    'stats',
    'weekly_challenges',
    'raid_bosses',
    'action_cooldowns',
    'raid_daily_caps',
];

const INDEX_AUDIT = {
    collectionQueries: DELETION_QUERIES.map(function(row) {
        return { collection: row[0], field: row[1], op: row[2], orderBy: '__name__' };
    }),
    collectionGroupQueries: COLLECTION_GROUP_QUERIES,
    documentIdScans: DOCUMENT_ID_SCANS,
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

async function collectDocs(query, documentIdField) {
    const out = [];
    const seen = new Set();
    let cursor = null;
    for (let page = 0; page < 10000; page++) {
        let q = query;
        if (documentIdField && typeof q.orderBy === 'function') q = q.orderBy(documentIdField);
        q = q.limit(QUERY_PAGE);
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
        if (added === 0 || snap.size < QUERY_PAGE) break;
        cursor = snap.docs[snap.docs.length - 1];
    }
    return out;
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
        if (!data.uid || data.uid === uid) await batcher.remove(ref);
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

async function stripReactionUid(db, batcher, collectionName, uid, documentIdField) {
    const docs = await collectDocs(db.collection(collectionName), documentIdField);
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

async function anonymizeRaidParticipants(db, batcher, uid, documentIdField) {
    const bosses = await collectDocs(db.collection('raid_bosses'), documentIdField);
    for (let i = 0; i < bosses.length; i++) {
        const ref = bosses[i].ref.collection('participants').doc(uid);
        const snap = await ref.get();
        if (!snap.exists) continue;
        const data = snap.data() || {};
        if (data.username && data.username !== DELETED_LABEL) {
            await batcher.update(ref, { username: DELETED_LABEL });
        }
    }
}

async function anonymizeWinnerLists(db, batcher, uid, documentIdField) {
    const boards = await collectDocs(db.collection('leaderboard_winners'), documentIdField);
    for (let i = 0; i < boards.length; i++) {
        const data = boards[i].data() || {};
        if (!Array.isArray(data.winners)) continue;
        let changed = false;
        const next = data.winners.map(function(winner) {
            if (!winner || winner.uid !== uid || winner.username === DELETED_LABEL) return winner;
            changed = true;
            return Object.assign({}, winner, { username: DELETED_LABEL });
        });
        if (changed) await batcher.update(boards[i].ref, { winners: next });
    }
    const stats = await collectDocs(db.collection('stats'), documentIdField);
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

async function clearWeeklyParticipantFlag(db, batcher, uid, documentIdField) {
    const weeks = await collectDocs(db.collection('weekly_challenges'), documentIdField);
    for (let i = 0; i < weeks.length; i++) {
        const data = weeks[i].data() || {};
        const participants = data.participants;
        if (!participants || typeof participants !== 'object' || !Object.prototype.hasOwnProperty.call(participants, uid)) continue;
        const next = Object.assign({}, participants);
        delete next[uid];
        await batcher.update(weeks[i].ref, { participants: next });
    }
}

function giftPairMatches(id, uid) {
    return id.indexOf(uid + '_') === 0 || id.slice(-(uid.length + 1)) === ('_' + uid);
}

async function deleteGiftPairs(db, batcher, uid, documentIdField) {
    const docs = await collectDocs(db.collection('gift_pending_pairs'), documentIdField);
    for (let i = 0; i < docs.length; i++) {
        if (!giftPairMatches(docs[i].id, uid)) continue;
        await batcher.remove(docs[i].ref);
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
    const docs = await collectDocs(db.collection(collectionName), documentIdField);
    const prefix = uid + '_';
    for (let i = 0; i < docs.length; i++) {
        if (docs[i].id.indexOf(prefix) !== 0) continue;
        await batcher.remove(docs[i].ref);
    }
}

async function deleteWeeklyContribs(db, batcher, uid, documentIdField) {
    const weeks = await collectDocs(db.collection('weekly_challenges'), documentIdField);
    const prefix = uid + '_';
    for (let i = 0; i < weeks.length; i++) {
        const contribs = await collectDocs(weeks[i].ref.collection('user_contribs'), documentIdField);
        for (let c = 0; c < contribs.length; c++) {
            if (contribs[c].id.indexOf(prefix) !== 0) continue;
            await batcher.remove(contribs[c].ref);
        }
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

async function wipeCapsAndUserLimits(db, batcher, uid, documentIdField) {
    const userRef = db.collection('users').doc(uid);
    for (let i = 0; i < CAP_SUBCOLLECTIONS.length; i++) {
        const docs = await collectDocs(userRef.collection(CAP_SUBCOLLECTIONS[i]), documentIdField);
        for (let c = 0; c < docs.length; c++) await batcher.remove(docs[c].ref);
    }
    const exact = [
        ['shoutout_limits', 'forum_' + uid],
        ['shoutout_limits', 'market_' + uid],
        ['shoutout_limits', 'hour_' + uid],
        ['rate_limits', 'bridge_' + uid],
        ['rate_limits', 'v4v_' + uid],
        ['rate_limits', 'sayhi_' + uid],
        ['rate_limits', 'announce_' + uid],
        ['totp_rate_limits', uid],
        ['totp_rate_limits', uid + '_verify'],
        ['totp_rate_limits', uid + '_disable'],
    ];
    for (let i = 0; i < exact.length; i++) {
        await deleteExactIfPresent(db, batcher, exact[i][0], exact[i][1]);
    }
    await deleteIdPrefix(db, batcher, 'action_cooldowns', uid, documentIdField);
    await deleteIdPrefix(db, batcher, 'raid_daily_caps', uid, documentIdField);
    await deleteWeeklyContribs(db, batcher, uid, documentIdField);
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
            throw err;
        }
    }
    return prefixes;
}

async function purgeAccount({ db, bucket, authApi, uid, documentIdField }) {
    if (!UID_RE.test(uid)) throw new Error('Invalid uid');
    const batcher = createBatcher(db);

    const userSnap = await db.collection('users').doc(uid).get();
    const userData = userSnap.exists ? (userSnap.data() || {}) : null;
    const username = userData && (userData.username || userData.displayName) ? (userData.username || userData.displayName) : '';

    const chat = await anonymizeGlobalChat(db, batcher, uid, documentIdField);
    await anonymizeMentions(db, batcher, uid, username, documentIdField);
    await stripReactionUid(db, batcher, 'global_chat', uid, documentIdField);
    await stripReactionUid(db, batcher, 'announcements', uid, documentIdField);
    await anonymizeFavorNames(db, batcher, uid, documentIdField);
    await anonymizeRaidParticipants(db, batcher, uid, documentIdField);
    await anonymizeWinnerLists(db, batcher, uid, documentIdField);
    await clearWeeklyParticipantFlag(db, batcher, uid, documentIdField);
    await deleteUsernameReservations(db, batcher, uid, userData, documentIdField);

    let deletedDocs = 0;
    for (let i = 0; i < DELETION_QUERIES.length; i++) {
        const q = DELETION_QUERIES[i];
        if (q[0] === 'gifts' || q[0] === 'gift_secrets' || q[0] === 'usernames') continue;
        const found = await deleteWhere(db, batcher, q[0], q[1], q[2], uid, q[3], documentIdField);
        deletedDocs += found.length;
    }
    await deleteOwnedGifts(db, batcher, uid, documentIdField);
    await deleteGiftPairs(db, batcher, uid, documentIdField);

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
        ['suggestions', uid, []],
    ];
    for (let i = 0; i < direct.length; i++) {
        await deleteDocTree(batcher, db.collection(direct[i][0]).doc(direct[i][1]), direct[i][2], documentIdField, false);
        deletedDocs++;
    }
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
    const storagePrefixes = await deleteStorageForUser(bucket, uid);
    await deleteAuthUser(authApi, uid);
    await wipeCapsAndUserLimits(db, batcher, uid, documentIdField);
    await batcher.flush();
    return {
        uid: uid,
        anonymizedChat: chat.anonymized,
        deletedDocs: deletedDocs,
        storagePrefixes: storagePrefixes,
        authDeleted: true,
    };
}

function createDeleteAccountHandlers({ db, bucket, authApi, HttpsError, nowSec, documentIdField }) {
    return {
        async deleteAccount(data, context) {
            const now = typeof nowSec === 'function'
                ? nowSec()
                : (typeof nowSec === 'number' ? nowSec : Math.floor(Date.now() / 1000));
            const decision = authorizeDeleteAccount(context && context.auth, data || {}, now);
            if (!decision.ok) throw new HttpsError(decision.code, decision.message);
            const summary = await purgeAccount({
                db: db,
                bucket: bucket,
                authApi: authApi,
                uid: decision.uid,
                documentIdField: documentIdField,
            });
            return {
                ok: true,
                uid: decision.uid,
                byAdmin: decision.byAdmin,
                anonymizedChat: summary.anonymizedChat,
                deletedDocs: summary.deletedDocs,
                storagePrefixes: summary.storagePrefixes,
                authDeleted: summary.authDeleted,
            };
        },
    };
}

function bindDeleteAccount(functionsV1, admin, db) {
    const handlers = createDeleteAccountHandlers({
        db: db,
        bucket: admin.storage().bucket(),
        authApi: admin.auth(),
        HttpsError: functionsV1.https.HttpsError,
        documentIdField: admin.firestore.FieldPath.documentId(),
    });
    return {
        deleteAccount: functionsV1.runWith({ timeoutSeconds: 540, memory: '1GB' }).https.onCall(handlers.deleteAccount),
    };
}

module.exports = {
    BATCH_LIMIT: BATCH_LIMIT,
    QUERY_PAGE: QUERY_PAGE,
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
    createDeleteAccountHandlers: createDeleteAccountHandlers,
    bindDeleteAccount: bindDeleteAccount,
};
