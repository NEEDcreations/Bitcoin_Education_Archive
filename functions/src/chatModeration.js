'use strict';

// Owner edits and soft deletes on Global Chat and DMs. Rewards, tickets,
// badge counts, reply bonus, say-hi, and easter eggs stay on the create
// triggers and are not called from here.
//
// Each edit or delete copies the previous text into chat_moderation_log.
// expireAt is 90 days out (Firestore TTL field). purgeExpired deletes rows
// once that time has passed, so retention does not depend on the TTL policy
// being enabled. Account deletion removes the user's rows separately.
//
// A blocked edit is logged, then the message text is restored. revertSeq
// goes up by 1 on that write so the follow-up update is ignored.
// More than 10 edits or deletes from one uid in a minute sets flagged on
// chat_edit_rate/{uid}. Nothing else happens automatically.

const { classifyChatText } = require('./chatProfanity');

const LOG_COLLECTION = 'chat_moderation_log';
const RATE_COLLECTION = 'chat_edit_rate';
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_FLAG_OVER = 10;
const DELETED_QUOTE = 'message deleted';
const DM_DELETED_PREVIEW = 'Message deleted';
const PURGE_PAGE = 400;

function textOf(data) {
    return data && typeof data.text === 'string' ? data.text : '';
}

function actorUid(data, surface) {
    if (!data) return '';
    const id = surface === 'dm' ? data.senderUid : data.uid;
    return String(id || '');
}

function rateableUid(uid) {
    if (!uid) return false;
    if (uid === 'nacho-bot' || uid === 'system' || uid === 'deleted' || uid === 'telegram') return false;
    return true;
}

function protectedMessage(data, surface) {
    if (!data) return true;
    if (data.isNachoAuto === true) return true;
    if (data.source === 'telegram' || data.fromTelegram === true) return true;
    const uid = actorUid(data, surface);
    if (uid === 'nacho-bot' || uid === 'system' || uid === 'deleted') return true;
    return false;
}

function isServerRevert(before, after) {
    const prev = Number(before && before.revertSeq) || 0;
    const next = Number(after && after.revertSeq) || 0;
    return next > prev;
}

function contentChanged(before, after) {
    if (!before || !after) return true;
    if (textOf(before) !== textOf(after)) return true;
    if ((before.deleted === true) !== (after.deleted === true)) return true;
    return false;
}

function blockReason(text) {
    return classifyChatText(text) || '';
}

function logDocId(action, path, key) {
    return (action + '_' + key + '_' + path).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 500);
}

function nextRate(prev, nowMs, eventKey) {
    const prior = prev && typeof prev === 'object' ? prev : {};
    if (prior.lastKey === eventKey) return { changed: false, data: prior };
    const start = Number(prior.windowStart) || 0;
    const inWindow = start > 0 && nowMs >= start && (nowMs - start) < RATE_WINDOW_MS;
    const count = inWindow ? (Number(prior.count) || 0) + 1 : 1;
    return {
        changed: true,
        data: {
            count: count,
            windowStart: inWindow ? start : nowMs,
            flagged: prior.flagged === true || count > RATE_FLAG_OVER,
            lastKey: eventKey,
            updatedAt: nowMs,
        },
    };
}

function stamp(admin, ms) {
    return admin.firestore.Timestamp.fromMillis(ms);
}

async function writeLog(db, admin, row, id) {
    await db.collection(LOG_COLLECTION).doc(id).set({
        surface: row.surface,
        path: row.path,
        uid: row.uid,
        before: row.before,
        after: row.after,
        action: row.action,
        at: stamp(admin, row.atMs),
        expireAt: stamp(admin, row.atMs + RETENTION_MS),
        blocked: row.blocked || '',
    });
}

async function bumpRate(db, uid, nowMs, eventKey) {
    if (!rateableUid(uid)) return;
    const ref = db.collection(RATE_COLLECTION).doc(uid);
    await db.runTransaction(async function (t) {
        const snap = await t.get(ref);
        const prev = snap && snap.exists ? (snap.data() || {}) : null;
        const next = nextRate(prev, nowMs, eventKey);
        if (!next.changed) return;
        t.set(ref, Object.assign({ uid: uid }, next.data), { merge: true });
    });
}

async function blankQuotes(db, msgId) {
    const snap = await db.collection('global_chat').where('replyTo', '==', msgId).get();
    const docs = snap && snap.docs ? snap.docs : [];
    for (let i = 0; i < docs.length; i++) {
        const data = docs[i].data() || {};
        if (data.replyToText === DELETED_QUOTE) continue;
        await docs[i].ref.update({ replyToText: DELETED_QUOTE });
    }
}

async function syncDmPreview(db, convoId, messageId, after) {
    const latest = await db.collection('dm_conversations').doc(convoId)
        .collection('messages').orderBy('createdAt', 'desc').limit(1).get();
    const docs = latest && latest.docs ? latest.docs : [];
    if (!docs.length || docs[0].id !== messageId) return { updated: false };
    const preview = after && after.deleted === true
        ? DM_DELETED_PREVIEW
        : textOf(after).slice(0, 1000);
    await db.collection('dm_conversations').doc(convoId).update({ lastMessage: preview });
    return { updated: true, lastMessage: preview };
}

async function revertEdit(db, admin, ref, before) {
    const patch = {
        text: textOf(before),
        edited: before && before.edited === true,
        editCount: Number(before && before.editCount) || 0,
        revertSeq: (Number(before && before.revertSeq) || 0) + 1,
    };
    if (before && before.editedAt) patch.editedAt = before.editedAt;
    else patch.editedAt = admin.firestore.FieldValue.delete();
    await ref.update(patch);
}

async function recordChange(db, admin, row, id, uid, nowMs) {
    await writeLog(db, admin, row, id);
    await bumpRate(db, uid, nowMs, id);
}

async function handleGlobalUpdate(db, admin, msgId, before, after, nowMs) {
    if (!before || !after) return { skipped: 'missing' };
    if (isServerRevert(before, after)) return { skipped: 'revert' };
    if (!contentChanged(before, after)) return { skipped: 'unchanged' };
    const deleted = after.deleted === true && before.deleted !== true;
    const action = deleted ? 'delete' : 'edit';
    const locked = protectedMessage(before, 'global');
    const uid = actorUid(before, 'global') || actorUid(after, 'global');
    const path = 'global_chat/' + msgId;
    const reason = !deleted && !locked ? blockReason(textOf(after)) : '';
    const key = deleted ? 'soft' : String(Number(after.editCount) || 0);
    const id = logDocId(action, path, key);
    await recordChange(db, admin, {
        surface: 'global',
        path: path,
        uid: uid,
        before: textOf(before),
        after: deleted ? '' : textOf(after),
        action: action,
        atMs: nowMs,
        blocked: reason,
    }, id, uid, nowMs);
    if (reason) {
        await revertEdit(db, admin, db.collection('global_chat').doc(msgId), before);
        return { action: action, blocked: reason, reverted: true };
    }
    if (deleted) await blankQuotes(db, msgId);
    return { action: action, blocked: '' };
}

async function handleGlobalDelete(db, admin, msgId, before, nowMs) {
    if (!before) return { skipped: 'missing' };
    const uid = actorUid(before, 'global');
    const path = 'global_chat/' + msgId;
    const id = logDocId('delete', path, 'hard');
    await recordChange(db, admin, {
        surface: 'global',
        path: path,
        uid: uid,
        before: textOf(before),
        after: '',
        action: 'delete',
        atMs: nowMs,
        blocked: '',
    }, id, uid, nowMs);
    await blankQuotes(db, msgId);
    return { action: 'delete', hard: true };
}

async function handleDmUpdate(db, admin, convoId, messageId, before, after, nowMs) {
    if (!before || !after) return { skipped: 'missing' };
    if (isServerRevert(before, after)) return { skipped: 'revert' };
    if (!contentChanged(before, after)) return { skipped: 'unchanged' };
    const deleted = after.deleted === true && before.deleted !== true;
    const action = deleted ? 'delete' : 'edit';
    const locked = protectedMessage(before, 'dm');
    const uid = actorUid(before, 'dm') || actorUid(after, 'dm');
    const path = 'dm_conversations/' + convoId + '/messages/' + messageId;
    const reason = !deleted && !locked ? blockReason(textOf(after)) : '';
    const key = deleted ? 'soft' : String(Number(after.editCount) || 0);
    const id = logDocId(action, path, key);
    await recordChange(db, admin, {
        surface: 'dm',
        path: path,
        uid: uid,
        before: textOf(before),
        after: deleted ? '' : textOf(after),
        action: action,
        atMs: nowMs,
        blocked: reason,
    }, id, uid, nowMs);
    const ref = db.collection('dm_conversations').doc(convoId).collection('messages').doc(messageId);
    if (reason) {
        await revertEdit(db, admin, ref, before);
        return { action: action, blocked: reason, reverted: true };
    }
    const preview = await syncDmPreview(db, convoId, messageId, after);
    return { action: action, blocked: '', preview: preview };
}

async function purgeExpired(db, admin, nowMs) {
    const cutoff = stamp(admin, nowMs);
    let removed = 0;
    for (let page = 0; page < 20; page++) {
        const snap = await db.collection(LOG_COLLECTION).where('expireAt', '<', cutoff).limit(PURGE_PAGE).get();
        const docs = snap && snap.docs ? snap.docs : [];
        if (!docs.length) break;
        if (typeof db.batch === 'function') {
            const batch = db.batch();
            docs.forEach(function (doc) { batch.delete(doc.ref); });
            await batch.commit();
        } else {
            for (let i = 0; i < docs.length; i++) await docs[i].ref.delete();
        }
        removed += docs.length;
        if (docs.length < PURGE_PAGE) break;
    }
    return { removed: removed };
}

module.exports = {
    LOG_COLLECTION: LOG_COLLECTION,
    RATE_COLLECTION: RATE_COLLECTION,
    RETENTION_MS: RETENTION_MS,
    RATE_WINDOW_MS: RATE_WINDOW_MS,
    RATE_FLAG_OVER: RATE_FLAG_OVER,
    DELETED_QUOTE: DELETED_QUOTE,
    DM_DELETED_PREVIEW: DM_DELETED_PREVIEW,
    textOf: textOf,
    isServerRevert: isServerRevert,
    contentChanged: contentChanged,
    blockReason: blockReason,
    nextRate: nextRate,
    logDocId: logDocId,
    handleGlobalUpdate: handleGlobalUpdate,
    handleGlobalDelete: handleGlobalDelete,
    handleDmUpdate: handleDmUpdate,
    purgeExpired: purgeExpired,
};
