'use strict';

// Forum reply counts are not client-writable on someone else's post.
// The reply document is the source of truth. Topic copies already adjust
// the parent inside the mirror transaction, so those creates are skipped.
// Deletes still decrement, including a mirrored copy, because nothing else does.
// The event id is stored in the same transaction, so a retried delivery
// does not move the count a second time.

function cleanId(value, max) {
    const id = String(value || '');
    if (!id || id.length > (max || 400)) return '';
    return id;
}

function eventDocId(eventId) {
    const id = String(eventId || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 400);
    return id;
}

function isTopicCopy(data) {
    if (!data) return false;
    if (data.topicPost || data.topicLink || data.topicChannel) return true;
    if (data.origin === 'topic' || data.origin === 'forum') return true;
    if (data.mirrorOf || data.noAward === true) return true;
    return false;
}

async function adjust(db, collection, id, delta, eventId) {
    const docId = cleanId(id, 400);
    if (!db || !docId || !delta) return { adjusted: false, reason: 'missing' };
    const ref = db.collection(collection).doc(docId);
    const eventKey = eventDocId(eventId);
    const eventRef = eventKey ? db.collection('reply_count_events').doc(eventKey) : null;
    let adjusted = false;
    let reason = 'missing';
    await db.runTransaction(async function (tx) {
        const snap = await tx.get(ref);
        const eventSnap = eventRef ? await tx.get(eventRef) : null;
        if (eventSnap && eventSnap.exists) {
            reason = 'duplicate';
            return;
        }
        if (!snap.exists) return;
        const count = Number((snap.data() || {}).replyCount) || 0;
        const next = count + delta;
        tx.set(ref, { replyCount: next < 0 ? 0 : next }, { merge: true });
        if (eventRef) {
            tx.set(eventRef, { eventId: eventKey, collection: collection, id: docId, delta: delta });
        }
        adjusted = true;
        reason = 'ok';
    });
    return { adjusted: adjusted, reason: reason };
}

async function onForumReplyCreated(db, data, eventId) {
    if (isTopicCopy(data)) return { adjusted: false, reason: 'mirror' };
    return adjust(db, 'forum_posts', data && data.postId, 1, eventId);
}

async function onForumReplyDeleted(db, data, eventId) {
    return adjust(db, 'forum_posts', data && data.postId, -1, eventId);
}

async function onArticleReplyCreated(db, data, eventId) {
    return adjust(db, 'articles', data && data.articleId, 1, eventId);
}

module.exports = {
    isTopicCopy: isTopicCopy,
    onForumReplyCreated: onForumReplyCreated,
    onForumReplyDeleted: onForumReplyDeleted,
    onArticleReplyCreated: onArticleReplyCreated,
};
