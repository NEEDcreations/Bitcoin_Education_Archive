'use strict';

// Server-side Nacho posts for a new PlebTalk thread or Marketplace listing.
// Reuses publishShoutoutOnce (global_chat, deterministic id) and
// mirrorShoutoutOnce (Telegram + reaction stamp). Clients never write these.

const {
    planActivityShoutout,
    activityLimitDocId,
    activityHourDocId,
    activityIds,
    applyActivityRate,
} = require('./shoutout');
const { publishShoutoutOnce } = require('./shoutoutPublish');
const { mirrorShoutoutOnce, deleteTelegramMessage } = require('./telegramBridge');

const ACTIVITY_GRACE_MS = 10000;

function delay(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

function sourceCollection(kind) {
    return kind === 'marketplace' ? 'marketplace' : 'forum_posts';
}

function authorUidOf(kind, data) {
    const src = data || {};
    return kind === 'marketplace' ? String(src.sellerUid || '') : String(src.authorId || '');
}

function cheapActivityGate(kind, data) {
    if (!data || typeof data !== 'object') return 'missing';
    if (typeof data.title !== 'string' || !String(data.title).trim()) return 'missing';
    const uid = authorUidOf(kind, data);
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return 'no_uid';
    return '';
}

function normalizeKind(kind) {
    return kind === 'marketplace' ? 'marketplace' : (kind === 'forum' ? 'forum' : '');
}

async function rememberSkip(db, ids, reason, uid, nowMs) {
    const claimRef = db.collection('shoutout_claims').doc(ids.docId);
    return db.runTransaction(async function(t) {
        const snap = await t.get(claimRef);
        if (snap.exists) {
            const claim = snap.data() || {};
            return {
                posted: false,
                reason: claim.status === 'posted' ? 'already_posted' : 'skipped',
                docId: ids.docId,
            };
        }
        t.set(claimRef, {
            status: 'skipped',
            reason: reason,
            activityRef: ids.activityRef,
            authorUid: uid || '',
            atMs: nowMs,
        });
        return { posted: false, reason: reason, docId: ids.docId };
    });
}

async function authorIsGuest(admin, uid, user, getAuthUser) {
    if (user && user.isAnonymous === true) return true;
    const canLookup = typeof getAuthUser === 'function' || (admin && typeof admin.auth === 'function');
    if (!canLookup) return false;
    try {
        const record = typeof getAuthUser === 'function'
            ? await getAuthUser(uid)
            : await admin.auth().getUser(uid);
        const providers = record && record.providerData;
        return !providers || !providers.length;
    } catch (err) {
        const code = err && (err.code || (err.errorInfo && err.errorInfo.code));
        if (code === 'auth/user-not-found') return true;
        throw err;
    }
}

async function announceActivity(opts) {
    const o = opts || {};
    const kind = normalizeKind(o.kind);
    const id = String(o.id || '');
    const db = o.db;
    if (!kind || !db || !o.admin) return { posted: false, reason: 'bad_kind' };
    const ids = activityIds(kind, id);
    if (!ids) return { posted: false, reason: 'bad_id' };
    const nowMs = typeof o.nowMs === 'number' ? o.nowMs : Date.now();

    let preview = o.eventData || null;
    if (!preview) {
        const preSnap = await db.collection(sourceCollection(kind)).doc(ids.id).get();
        if (!preSnap.exists) return { posted: false, reason: 'deleted' };
        preview = preSnap.data() || {};
    }
    const gate = cheapActivityGate(kind, preview);
    if (gate) return { posted: false, reason: gate };
    const uid = authorUidOf(kind, preview);
    const limitId = activityLimitDocId(kind, uid);
    const hourId = activityHourDocId(uid);
    if (!limitId || !hourId) return { posted: false, reason: 'no_uid' };

    const claimSnap = await db.collection('shoutout_claims').doc(ids.docId).get();
    if (claimSnap.exists) {
        const claim = claimSnap.data() || {};
        if (claim.status === 'posted') {
            const mirror = o.mirror || function(args) {
                return mirrorShoutoutOnce({
                    db: db,
                    docId: args.docId,
                    collection: args.collection,
                    text: args.text,
                });
            };
            await mirror({ docId: ids.docId, collection: 'global_chat' });
            return { posted: false, reason: 'already_posted', docId: ids.docId };
        }
        return { posted: false, reason: 'skipped', docId: ids.docId };
    }
    const limitSnap = await db.collection('shoutout_limits').doc(limitId).get();
    const hourSnap = await db.collection('shoutout_limits').doc(hourId).get();
    const early = applyActivityRate({
        author: limitSnap.exists ? limitSnap.data() : null,
        hour: hourSnap.exists ? hourSnap.data() : null,
        global: { stamps: [] },
        nowMs: nowMs,
    });
    if (!early.allow) {
        return rememberSkip(db, ids, early.reason, uid, nowMs);
    }

    const sleep = o.sleep || delay;
    const graceMs = typeof o.graceMs === 'number' ? o.graceMs : ACTIVITY_GRACE_MS;
    if (graceMs > 0) await sleep(graceMs);

    const freshSnap = await db.collection(sourceCollection(kind)).doc(ids.id).get();
    if (!freshSnap.exists) return { posted: false, reason: 'deleted' };
    const fresh = freshSnap.data() || {};
    const freshUid = authorUidOf(kind, fresh);
    let user = null;
    let ledger = null;
    let addressLock = null;
    if (/^[A-Za-z0-9_-]{1,128}$/.test(freshUid)) {
        const userSnap = await db.collection('users').doc(freshUid).get();
        if (userSnap.exists) user = userSnap.data() || {};
        const ledgerSnap = await db.collection('faucet_ledger').doc(freshUid).get();
        if (ledgerSnap.exists) ledger = ledgerSnap.data() || {};
        const addr = String((user && (user.lightningAddress || user.lightning)) || '').trim().toLowerCase();
        if (addr && addr.indexOf('/') === -1 && addr.length <= 300) {
            const lockSnap = await db.collection('lightning_addresses').doc(addr).get();
            if (lockSnap.exists) addressLock = lockSnap.data() || {};
        }
    }

    if (await authorIsGuest(o.admin, freshUid, user, o.getAuthUser)) {
        return rememberSkip(db, ids, 'anonymous', freshUid, nowMs);
    }

    const plan = planActivityShoutout({
        kind: kind,
        id: ids.id,
        uid: freshUid,
        item: fresh,
        user: user,
        ledger: ledger,
        addressLock: addressLock,
        nowMs: nowMs,
    });
    if (!plan.post) {
        if (plan.reason === 'deleted' || plan.reason === 'missing' || plan.reason === 'bad_id') {
            return { posted: false, reason: plan.reason };
        }
        return rememberSkip(db, ids, plan.reason, freshUid, nowMs);
    }

    const published = await publishShoutoutOnce({
        db: db,
        admin: o.admin,
        plan: plan,
        claimRef: db.collection('shoutout_claims').doc(plan.docId),
        authorLimitRef: db.collection('shoutout_limits').doc(activityLimitDocId(kind, freshUid)),
        hourLimitRef: db.collection('shoutout_limits').doc(activityHourDocId(freshUid)),
        globalLimitRef: db.collection('shoutout_limits').doc('global'),
        nowMs: nowMs,
    });
    if (published && (published.wrote || published.reason === 'already_posted')) {
        const mirror = o.mirror || function(args) {
            return mirrorShoutoutOnce({
                db: db,
                docId: args.docId,
                collection: args.collection,
                text: args.text,
            });
        };
        await mirror({ docId: plan.docId, collection: plan.collection, text: plan.text });
    }
    return {
        posted: !!(published && published.wrote),
        reason: published ? published.reason : 'bad_plan',
        docId: plan.docId,
        text: plan.post ? plan.text : '',
    };
}

// A listing or post left the public feed. Marketplace removal sets status
// 'deleted' and deletedAt. Forum posts are hard-deleted today; the same
// check covers a later soft-delete or hide. 'sold' stays up.
function activityRemovedState(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.deletedAt != null && data.deletedAt !== '') return true;
    if (data.deleted === true || data.removed === true || data.hidden === true) return true;
    const status = String(data.status || '').toLowerCase();
    return status === 'deleted' || status === 'removed' || status === 'hidden';
}

function activityShouldRetract(before, after) {
    return activityRemovedState(after) && !activityRemovedState(before || {});
}

async function retractIfRemoved(opts) {
    const o = opts || {};
    if (!activityShouldRetract(o.before, o.after)) return { deleted: false, reason: 'still_live' };
    return retractActivity(o);
}

async function retractActivity(opts) {
    const o = opts || {};
    const kind = normalizeKind(o.kind);
    const db = o.db;
    const ids = activityIds(kind, o.id);
    if (!kind || !db || !ids) return { deleted: false, reason: 'bad_id' };
    const chatRef = db.collection('global_chat').doc(ids.docId);
    const snap = await chatRef.get();
    if (!snap.exists) return { deleted: false, reason: 'missing' };
    const data = snap.data() || {};
    if (data.uid !== 'nacho-bot' || data.activityRef !== ids.activityRef) {
        return { deleted: false, reason: 'mismatch' };
    }
    const dropTelegram = o.deleteTelegram || function(args) {
        return deleteTelegramMessage({
            chatId: args.chatId,
            messageId: args.messageId,
            env: o.env,
            fetch: o.fetch,
            token: o.token,
        });
    };
    try {
        await dropTelegram({ chatId: data.telegramChatId, messageId: data.telegramMsgId });
    } catch (err) {
        // The chat doc still has to go. A Telegram miss can be cleaned up later.
    }
    await chatRef.delete();
    try {
        await db.collection('notifications').doc(ids.docId).delete();
    } catch (err) {}
    return { deleted: true, docId: ids.docId };
}

module.exports = {
    announceActivity: announceActivity,
    retractActivity: retractActivity,
    retractIfRemoved: retractIfRemoved,
    activityRemovedState: activityRemovedState,
    activityShouldRetract: activityShouldRetract,
    cheapActivityGate: cheapActivityGate,
    ACTIVITY_GRACE_MS: ACTIVITY_GRACE_MS,
};
