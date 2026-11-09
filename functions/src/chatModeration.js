'use strict';

// Owner edits and soft deletes on Global Chat and DMs. Rewards, tickets,
// badge counts, reply bonus, say-hi, and easter eggs stay on the create
// triggers and are not called from here.
//
// A user edit is editCount going up by exactly 1 with a new editedAt, and
// the author id unchanged. A user soft delete is deletedAt newly set, with
// the author id unchanged and not 'deleted'. Account deletion, mention
// scrubbing, quote blanking, and this module's own revert do not match, so
// they create no log row, no rate record, and no revert.
//
// Each accepted edit or delete copies the previous text into
// chat_moderation_log. The doc id is the trigger event id, not editCount,
// so a revert cannot overwrite the blocked text. expireAt is 90 days out.
// purgeExpired deletes rows once that time has passed.
//
// A blocked edit is reverted inside a transaction. If the message changed
// since this event, the revert is skipped. The previous text is restored
// only when it passes the filter; otherwise the text is blanked.
// More than 10 edits or deletes from one uid in a minute sets flagged on
// chat_edit_rate/{uid}. Nothing else happens automatically.
//
// Soft delete deletes a Storage object only from imageUrl or gifUrl, only in
// the default bucket, and only at chat-images/<author>/file (Global Chat) or
// dm-images/<author>/file (DMs). Text, another uid, another bucket, and .. are skipped.
// A 403 or 404 from that delete is logged by skipping it; other errors still throw.

const { classifyChatText } = require('./chatProfanity');

const LOG_COLLECTION = 'chat_moderation_log';
const RATE_COLLECTION = 'chat_edit_rate';
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_FLAG_OVER = 10;
const DELETED_QUOTE = 'message deleted';
const DM_DELETED_PREVIEW = 'Message deleted';
const PURGE_PAGE = 400;
const DEFAULT_MEDIA_BUCKET = 'bitcoin-education-archive.firebasestorage.app';

function textOf(data) {
    return data && typeof data.text === 'string' ? data.text : '';
}

function actorUid(data, surface) {
    if (!data) return '';
    const id = surface === 'dm' ? data.senderUid : data.uid;
    return String(id || '');
}

function millisOf(value) {
    if (!value) return 0;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value.toMillis === 'function') {
        try { return value.toMillis() || 0; } catch (err) { return 0; }
    }
    if (value._seconds) return value._seconds * 1000;
    if (value instanceof Date) return value.getTime() || 0;
    return 0;
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

function sameAuthor(before, after, surface) {
    const prev = actorUid(before, surface);
    const next = actorUid(after, surface);
    return !!prev && prev === next && prev !== 'deleted';
}

function userEdit(before, after, surface) {
    if (!before || !after || !sameAuthor(before, after, surface)) return false;
    const oldCount = Number(before.editCount) || 0;
    const newCount = Number(after.editCount);
    if (newCount !== oldCount + 1) return false;
    const oldAt = millisOf(before.editedAt);
    const newAt = millisOf(after.editedAt);
    if (!newAt || newAt === oldAt) return false;
    return true;
}

function userSoftDelete(before, after, surface) {
    if (!before || !after || !sameAuthor(before, after, surface)) return false;
    if (millisOf(before.deletedAt)) return false;
    if (!millisOf(after.deletedAt)) return false;
    return true;
}

function blockReason(text) {
    return classifyChatText(text) || '';
}

function attemptKey(eventId, after, action) {
    if (eventId) return String(eventId);
    const stampMs = action === 'delete' ? millisOf(after && after.deletedAt) : millisOf(after && after.editedAt);
    return action + '-' + (stampMs || 0);
}

function logDocId(action, path, attempt) {
    return (action + '_' + attemptKey(attempt, null, action) + '_' + path).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 500);
}

// Own media only: default bucket, and exactly folder/<author uid>/<file>
// with no extra slash. Global Chat is chat-images; DMs are dm-images.
// text is never a source. A foreign uid, bucket, folder, or .. is skipped.
function storageObjectPath(url, authorUid, folder) {
    const raw = String(url || '');
    const uid = String(authorUid || '');
    if (!raw || raw.indexOf('https://') !== 0) return '';
    if (!uid || uid.indexOf('/') !== -1 || uid.indexOf('..') !== -1) return '';
    if (folder !== 'chat-images' && folder !== 'dm-images') return '';
    let bucket = '';
    let encoded = '';
    const gcs = raw.match(/^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/([^?#]+)/);
    const app = raw.match(/^https:\/\/([a-z0-9.-]+\.firebasestorage\.app)\/(?:v0\/b\/[^/]+\/o\/)?([^?#]+)/);
    if (gcs) {
        bucket = gcs[1];
        encoded = gcs[2];
    } else if (app) {
        bucket = app[1];
        encoded = app[2];
    } else return '';
    if (bucket !== DEFAULT_MEDIA_BUCKET) return '';
    let path = '';
    try { path = decodeURIComponent(encoded); } catch (err) { return ''; }
    if (path.charAt(0) === '/') path = path.slice(1);
    if (!path || path.indexOf('\\') !== -1 || path.indexOf('..') !== -1) return '';
    const prefix = folder + '/' + uid + '/';
    if (path.slice(0, prefix.length) !== prefix) return '';
    const name = path.slice(prefix.length);
    if (!name || name.indexOf('/') !== -1) return '';
    return path;
}

function permanentStorageError(err) {
    if (!err) return false;
    const code = err.code != null ? err.code : (err.statusCode != null ? err.statusCode : err.status);
    const num = Number(code);
    if (num === 403 || num === 404) return true;
    const text = String(code || '');
    return text === '403' || text === '404';
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
    const preview = after && millisOf(after.deletedAt)
        ? DM_DELETED_PREVIEW
        : textOf(after).slice(0, 1000);
    await db.collection('dm_conversations').doc(convoId).update({ lastMessage: preview });
    return { updated: true, lastMessage: preview };
}

async function deleteStoredMedia(before, deleteFile, surface) {
    if (typeof deleteFile !== 'function' || !before) return [];
    const folder = surface === 'dm' ? 'dm-images' : 'chat-images';
    const uid = actorUid(before, surface);
    const urls = [before.imageUrl, before.gifUrl];
    const seen = {};
    const removed = [];
    for (let i = 0; i < urls.length; i++) {
        const path = storageObjectPath(urls[i], uid, folder);
        if (!path || seen[path]) continue;
        seen[path] = true;
        try {
            await deleteFile(path);
            removed.push(path);
        } catch (err) {
            // 403/404 will not succeed on retry. Other errors still fail the trigger.
            if (permanentStorageError(err)) continue;
            throw err;
        }
    }
    return removed;
}

// Re-reads the message. Skips when text or editCount moved on since `after`.
// Restores before.text only when that text is clean. Otherwise blanks it.
async function revertEdit(db, admin, ref, before, after) {
    const previous = textOf(before);
    const restore = blockReason(previous) ? '' : previous;
    return db.runTransaction(async function (t) {
        const snap = await t.get(ref);
        if (!snap || snap.exists === false) return { skipped: 'gone' };
        const cur = snap.data() || {};
        if (textOf(cur) !== textOf(after)) return { skipped: 'changed' };
        if ((Number(cur.editCount) || 0) !== (Number(after.editCount) || 0)) return { skipped: 'changed' };
        const patch = {
            text: restore,
            edited: !!(before && before.edited === true) && restore === previous,
            editCount: Number(before && before.editCount) || 0,
            revertSeq: (Number(cur.revertSeq) || 0) + 1,
            filterRemoved: true,
        };
        if (before && before.editedAt && restore === previous) patch.editedAt = before.editedAt;
        else patch.editedAt = admin.firestore.FieldValue.delete();
        t.update(ref, patch);
        return { reverted: true, blanked: restore !== previous, text: restore };
    });
}

async function recordChange(db, admin, row, id, uid, nowMs, eventKey) {
    await writeLog(db, admin, row, id);
    await bumpRate(db, uid, nowMs, eventKey);
}

function optsOf(opts) {
    return opts && typeof opts === 'object' ? opts : {};
}

async function handleGlobalUpdate(db, admin, msgId, before, after, nowMs, opts) {
    const options = optsOf(opts);
    if (!before || !after) return { skipped: 'missing' };
    const deleted = userSoftDelete(before, after, 'global');
    const edited = !deleted && userEdit(before, after, 'global');
    if (!deleted && !edited) return { skipped: 'server' };
    if (protectedMessage(before, 'global')) return { skipped: 'protected' };
    const action = deleted ? 'delete' : 'edit';
    const uid = actorUid(before, 'global');
    const path = 'global_chat/' + msgId;
    const reason = edited ? blockReason(textOf(after)) : '';
    const attempt = attemptKey(options.eventId, after, action);
    const id = logDocId(action, path, attempt);
    await recordChange(db, admin, {
        surface: 'global',
        path: path,
        uid: uid,
        before: textOf(before),
        after: deleted ? '' : textOf(after),
        action: action,
        atMs: nowMs,
        blocked: reason,
    }, id, uid, nowMs, attempt);
    if (reason) {
        const reverted = await revertEdit(db, admin, db.collection('global_chat').doc(msgId), before, after);
        return { action: action, blocked: reason, reverted: !!(reverted && reverted.reverted), revert: reverted };
    }
    let removed = [];
    if (deleted) {
        await blankQuotes(db, msgId);
        removed = await deleteStoredMedia(before, options.deleteFile, 'global');
    }
    return { action: action, blocked: '', removed: removed };
}

async function handleGlobalDelete(db, admin, msgId, before, nowMs, opts) {
    const options = optsOf(opts);
    if (!before) return { skipped: 'missing' };
    const uid = actorUid(before, 'global');
    if (!uid || uid === 'deleted') return { skipped: 'deleted-account' };
    const path = 'global_chat/' + msgId;
    const attempt = attemptKey(options.eventId, before, 'hard');
    const id = logDocId('delete', path, attempt);
    await recordChange(db, admin, {
        surface: 'global',
        path: path,
        uid: uid,
        before: textOf(before),
        after: '',
        action: 'delete',
        atMs: nowMs,
        blocked: '',
    }, id, uid, nowMs, attempt);
    await blankQuotes(db, msgId);
    return { action: 'delete', hard: true };
}

async function handleDmUpdate(db, admin, convoId, messageId, before, after, nowMs, opts) {
    const options = optsOf(opts);
    if (!before || !after) return { skipped: 'missing' };
    const deleted = userSoftDelete(before, after, 'dm');
    const edited = !deleted && userEdit(before, after, 'dm');
    if (!deleted && !edited) return { skipped: 'server' };
    if (protectedMessage(before, 'dm')) return { skipped: 'protected' };
    const action = deleted ? 'delete' : 'edit';
    const uid = actorUid(before, 'dm');
    const path = 'dm_conversations/' + convoId + '/messages/' + messageId;
    const reason = edited ? blockReason(textOf(after)) : '';
    const attempt = attemptKey(options.eventId, after, action);
    const id = logDocId(action, path, attempt);
    await recordChange(db, admin, {
        surface: 'dm',
        path: path,
        uid: uid,
        before: textOf(before),
        after: deleted ? '' : textOf(after),
        action: action,
        atMs: nowMs,
        blocked: reason,
    }, id, uid, nowMs, attempt);
    const ref = db.collection('dm_conversations').doc(convoId).collection('messages').doc(messageId);
    if (reason) {
        const reverted = await revertEdit(db, admin, ref, before, after);
        return { action: action, blocked: reason, reverted: !!(reverted && reverted.reverted), revert: reverted };
    }
    let removed = [];
    if (deleted) removed = await deleteStoredMedia(before, options.deleteFile, 'dm');
    const preview = await syncDmPreview(db, convoId, messageId, after);
    return { action: action, blocked: '', preview: preview, removed: removed };
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
    userEdit: userEdit,
    userSoftDelete: userSoftDelete,
    blockReason: blockReason,
    nextRate: nextRate,
    logDocId: logDocId,
    DEFAULT_MEDIA_BUCKET: DEFAULT_MEDIA_BUCKET,
    storageObjectPath: storageObjectPath,
    permanentStorageError: permanentStorageError,
    handleGlobalUpdate: handleGlobalUpdate,
    handleGlobalDelete: handleGlobalDelete,
    handleDmUpdate: handleDmUpdate,
    purgeExpired: purgeExpired,
};
