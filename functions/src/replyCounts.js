'use strict';

// Forum reply counts are not client-writable on someone else's post.
// The reply document is the source of truth. Topic copies already adjust
// the parent inside the mirror transaction, so those creates are skipped.
// Deletes still decrement, including a mirrored copy, because nothing else does.

function cleanId(value, max) {
    const id = String(value || '');
    if (!id || id.length > (max || 400)) return '';
    return id;
}

function isTopicCopy(data) {
    if (!data) return false;
    if (data.topicPost || data.topicLink || data.topicChannel) return true;
    if (data.origin === 'topic' || data.origin === 'forum') return true;
    if (data.mirrorOf || data.noAward === true) return true;
    return false;
}

async function adjust(db, collection, id, delta) {
    const docId = cleanId(id, 400);
    if (!db || !docId || !delta) return { adjusted: false, reason: 'missing' };
    const ref = db.collection(collection).doc(docId);
    let adjusted = false;
    await db.runTransaction(async function (tx) {
        const snap = await tx.get(ref);
        if (!snap.exists) return;
        const count = Number((snap.data() || {}).replyCount) || 0;
        const next = count + delta;
        tx.set(ref, { replyCount: next < 0 ? 0 : next }, { merge: true });
        adjusted = true;
    });
    return { adjusted: adjusted };
}

async function onForumReplyCreated(db, data) {
    if (isTopicCopy(data)) return { adjusted: false, reason: 'mirror' };
    return adjust(db, 'forum_posts', data && data.postId, 1);
}

async function onForumReplyDeleted(db, data) {
    return adjust(db, 'forum_posts', data && data.postId, -1);
}

async function onArticleReplyCreated(db, data) {
    return adjust(db, 'articles', data && data.articleId, 1);
}

module.exports = {
    isTopicCopy: isTopicCopy,
    onForumReplyCreated: onForumReplyCreated,
    onForumReplyDeleted: onForumReplyDeleted,
    onArticleReplyCreated: onArticleReplyCreated,
};
