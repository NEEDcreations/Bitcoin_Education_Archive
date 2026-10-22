// Account deletion. Admin SDK only. The signed-in owner must have a recent
// sign-in. An admin may delete a different uid without that check.
// Running it twice is safe: missing docs are skipped, and chat that is
// already "[deleted]" is left alone.
//
// Financial and abuse records in RETAINED_COLLECTIONS are never written.

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

const USER_SUBCOLLECTIONS = [
    'daily_points',
    'daily_action_counts',
    'badge_awards',
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

function createBatcher(db) {
    let batch = db.batch();
    let count = 0;
    const queuedDeletes = new Set();
    return {
        async update(ref, data) {
            assertMutable(ref.path);
            batch.update(ref, data);
            count++;
            if (count >= BATCH_LIMIT) await this.flush();
        },
        async remove(ref) {
            if (!ref || !ref.path || queuedDeletes.has(ref.path)) return;
            assertMutable(ref.path);
            queuedDeletes.add(ref.path);
            batch.delete(ref);
            count++;
            if (count >= BATCH_LIMIT) await this.flush();
        },
        async flush() {
            if (count === 0) return;
            await batch.commit();
            batch = db.batch();
            count = 0;
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

async function childCollections(ref, knownNames) {
    const map = new Map();
    (knownNames || []).forEach(function(name) {
        map.set(name, ref.collection(name));
    });
    if (typeof ref.listCollections === 'function') {
        const listed = await ref.listCollections();
        (listed || []).forEach(function(col) {
            const id = col.id || (col.path ? col.path.split('/').pop() : '');
            if (id) map.set(id, col);
        });
    }
    return Array.from(map.values());
}

async function deleteDocTree(batcher, ref, knownNames, documentIdField) {
    const cols = await childCollections(ref, knownNames);
    for (let i = 0; i < cols.length; i++) {
        const children = await collectDocs(cols[i], documentIdField);
        for (let c = 0; c < children.length; c++) {
            await deleteDocTree(batcher, children[c].ref, [], documentIdField);
        }
    }
    await batcher.remove(ref);
}

async function deleteWhere(db, batcher, collectionName, field, op, value, childNames, documentIdField) {
    assertMutable(collectionName);
    const docs = await collectDocs(db.collection(collectionName).where(field, op, value), documentIdField);
    for (let i = 0; i < docs.length; i++) {
        await deleteDocTree(batcher, docs[i].ref, childNames || [], documentIdField);
    }
    return docs.length;
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

async function anonymizeFavorNames(db, batcher, uid, documentIdField) {
    const sessionRef = db.collection('satoshiFavor').doc('current').collection('session_hashes').doc(uid);
    const session = await sessionRef.get();
    if (session.exists) {
        const data = session.data() || {};
        if (data.username && data.username !== DELETED_LABEL) {
            await batcher.update(sessionRef, { username: DELETED_LABEL });
        }
    }
    const hashes = await collectDocs(
        db.collection('satoshiFavor').doc('current').collection('hashes').where('uid', '==', uid),
        documentIdField
    );
    for (let i = 0; i < hashes.length; i++) {
        const data = hashes[i].data() || {};
        if (data.username && data.username !== DELETED_LABEL) {
            await batcher.update(hashes[i].ref, { username: DELETED_LABEL });
        }
    }
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

async function purgeAccount({ db, bucket, uid, documentIdField }) {
    if (!UID_RE.test(uid)) throw new Error('Invalid uid');
    const batcher = createBatcher(db);

    const userSnap = await db.collection('users').doc(uid).get();
    const userData = userSnap.exists ? (userSnap.data() || {}) : null;

    const chat = await anonymizeGlobalChat(db, batcher, uid, documentIdField);
    await anonymizeFavorNames(db, batcher, uid, documentIdField);
    await deleteUsernameReservations(db, batcher, uid, userData, documentIdField);

    const queries = [
        ['dm_conversations', 'participants', 'array-contains', uid, ['messages']],
        ['conversations', 'participants', 'array-contains', uid, ['messages']],
        ['forum_posts', 'authorId', '==', uid, ['replies', 'comments']],
        ['forum_replies', 'authorId', '==', uid, []],
        ['marketplace', 'sellerUid', '==', uid, []],
        ['marketplace_messages', 'buyerUid', '==', uid, []],
        ['marketplace_messages', 'sellerUid', '==', uid, []],
        ['suggestions', 'uid', '==', uid, []],
        ['beats_tracks', 'authorId', '==', uid, ['comments']],
        ['articles', 'authorId', '==', uid, ['replies', 'comments']],
        ['article_replies', 'authorId', '==', uid, []],
        ['irl_events', 'hostId', '==', uid, []],
        ['notifications', 'recipientId', '==', uid, []],
        ['notifications', 'senderId', '==', uid, []],
        ['gifts', 'ownerId', '==', uid, []],
        ['keys', 'ownerId', '==', uid, []],
        ['locked_ciphers', 'ownerId', '==', uid, []],
        ['peer_requests', 'from', '==', uid, []],
        ['peer_requests', 'to', '==', uid, []],
        ['peerRelationships', 'uid1', '==', uid, []],
        ['peerRelationships', 'uid2', '==', uid, []],
        ['channel_ratings', 'userId', '==', uid, []],
        ['tctv_view_days', 'viewerId', '==', uid, []],
        ['key_send_pairs', 'senderUid', '==', uid, []],
        ['key_send_pairs', 'recipientUid', '==', uid, []],
        ['buddy_matches', 'user1.uid', '==', uid, []],
        ['buddy_matches', 'user2.uid', '==', uid, []],
        ['pvp_matches', 'player1.uid', '==', uid, []],
        ['pvp_matches', 'player2.uid', '==', uid, []],
        ['certs', 'uid', '==', uid, []],
        ['quest_answer_keys', 'uid', '==', uid, []],
        ['scholar_exam_keys', 'uid', '==', uid, []],
    ];
    let deletedDocs = 0;
    for (let i = 0; i < queries.length; i++) {
        const q = queries[i];
        deletedDocs += await deleteWhere(db, batcher, q[0], q[1], q[2], q[3], q[4], documentIdField);
    }

    if (typeof db.collectionGroup === 'function') {
        const comments = await collectDocs(db.collectionGroup('comments').where('authorId', '==', uid), documentIdField);
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
        ['totp_rate_limits', uid, []],
        ['suggestions', uid, []],
    ];
    for (let i = 0; i < direct.length; i++) {
        await deleteDocTree(batcher, db.collection(direct[i][0]).doc(direct[i][1]), direct[i][2], documentIdField);
        deletedDocs++;
    }
    await deleteDocTree(
        batcher,
        db.collection('global_chat_meta').doc('live_dj').collection('dj_queue').doc(uid),
        [],
        documentIdField
    );
    await deleteDocTree(
        batcher,
        db.collection('satoshiFavor').doc('personalBests').collection('users').doc(uid),
        [],
        documentIdField
    );
    // User tree last so a retry can still read the username if we stopped early.
    await deleteDocTree(batcher, db.collection('users').doc(uid), USER_SUBCOLLECTIONS, documentIdField);
    deletedDocs++;

    await batcher.flush();
    const storagePrefixes = await deleteStorageForUser(bucket, uid);
    return {
        uid: uid,
        anonymizedChat: chat.anonymized,
        deletedDocs: deletedDocs,
        storagePrefixes: storagePrefixes,
    };
}

function createDeleteAccountHandlers({ db, bucket, HttpsError, nowSec, documentIdField }) {
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
            };
        },
    };
}

function bindDeleteAccount(functionsV1, admin, db) {
    const handlers = createDeleteAccountHandlers({
        db: db,
        bucket: admin.storage().bucket(),
        HttpsError: functionsV1.https.HttpsError,
        documentIdField: admin.firestore.FieldPath.documentId(),
    });
    return {
        deleteAccount: functionsV1.https.onCall(handlers.deleteAccount),
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
    authorizeDeleteAccount: authorizeDeleteAccount,
    chatTombstone: chatTombstone,
    quoteTombstone: quoteTombstone,
    purgeAccount: purgeAccount,
    createDeleteAccountHandlers: createDeleteAccountHandlers,
    bindDeleteAccount: bindDeleteAccount,
};
