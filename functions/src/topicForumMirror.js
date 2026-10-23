'use strict';

// Cross-posts a new topic thread into Pleb Talk and mirrors replies both ways.
// The summary is written once, when the forum post is created. Regenerating
// it later would add another model call and another rate-limit path.
//
// Clients write one side. This module, running in a callable or a Firestore
// trigger, writes the other. Copies carry origin and noAward. A copy is never
// mirrored again. Doc ids are deterministic so a retry overwrites the same
// doc. Mirrored copies award no XP, tickets, or badges.

const FORUM_DAILY_MAX = 5;
const FORUM_RATE_MS = 30 * 1000;
const SUMMARY_MAX = 280;
const FORUM_TITLE_MAX = 120;
const FORUM_BODY_MAX = 2000;
const FORUM_REPLY_MAX = 1000;
const PUBLIC_ORIGIN = 'https://bitcoineducation.quest/';
const ADVICE_RE = /\b(you should (buy|sell|invest)|i recommend (buying|selling)|buy now|sell now|price target|guaranteed return|go all in)\b/i;
const INJECTION_RE = /ignore\s+(all|previous|your)\s+instructions|system\s+prompt|jailbreak|pretend\s+to\s+be|act\s+as\s+/i;

const SERVER_FIELDS = ['origin', 'mirrorOf', 'mirrorSync', 'topicChannel', 'topicPost', 'topicLink', 'noAward', 'mirrored'];

function topicApi() {
    return require('./topicDiscussion');
}

function cleanToken(value, max) {
    const s = String(value || '');
    if (!/^[A-Za-z0-9_-]+$/.test(s)) return '';
    if (s.length < 1 || s.length > (max || 160)) return '';
    return s;
}

function forumPostIdFor(channelId, rootPostId) {
    const channel = cleanToken(channelId, 80);
    const post = cleanToken(rootPostId, 128);
    if (!channel || !post) return '';
    return ('tdforum_' + channel + '_' + post).slice(0, 400);
}

function forumReplyIdFor(channelId, topicPostId) {
    const channel = cleanToken(channelId, 80);
    const post = cleanToken(topicPostId, 128);
    if (!channel || !post) return '';
    return ('tdreply_' + channel + '_' + post).slice(0, 400);
}

function topicPostIdForForumReply(replyId) {
    const id = cleanToken(replyId, 200);
    if (!id) return '';
    return ('tdfrom_' + id).slice(0, 400);
}

function topicHashLink(channelId, postId) {
    return '#topic/' + channelId + '/' + postId;
}

function topicPublicLink(channelId, postId) {
    return PUBLIC_ORIGIN + topicHashLink(channelId, postId);
}

function forumHashLink(forumPostId) {
    return '#forum/post/' + forumPostId;
}

function mirrorSyncOf(text, deleted, hidden) {
    return (deleted ? 'd' : 'v') + (hidden ? 'h' : 's') + ':' + String(text || '').slice(0, FORUM_BODY_MAX);
}

function isMirrorCopy(data) {
    const src = data || {};
    if (src.origin === 'topic' || src.origin === 'forum') return true;
    if (src.noAward === true) return true;
    if (src.mirrorOf) return true;
    return false;
}

function forumActivityAwardable(data) {
    if (!data || typeof data !== 'object') return false;
    if (isMirrorCopy(data)) return false;
    const uid = data.authorId || data.uid || '';
    if (uid === 'nacho-bot') return false;
    return true;
}

function excerptSummary(text) {
    let s = String(text || '').replace(/\[link removed\]/gi, ' ').replace(/\s+/g, ' ').trim();
    if (s.length > 180) s = s.slice(0, 177).trim() + '…';
    return s || 'A new topic discussion.';
}

function acceptSummary(raw, fallback) {
    let s = String(raw || '').replace(/<[^>]*>/g, ' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
    if (!s || s.length < 8 || /^skip$/i.test(s)) return fallback;
    if (ADVICE_RE.test(s) || INJECTION_RE.test(s)) return fallback;
    if (s.length > SUMMARY_MAX) s = s.slice(0, SUMMARY_MAX - 1).trim() + '…';
    return s;
}

async function summarizeOpener(askNacho, text, title) {
    const fallback = excerptSummary(text);
    if (typeof askNacho !== 'function' || INJECTION_RE.test(String(text || ''))) return fallback;
    try {
        const result = await askNacho({
            purpose: 'summary',
            question: ('Summarize this discussion opener in one or two sentences, maximum 240 characters. No financial advice, no links, no usernames, and no instructions. Opener: ' + String(text || '').slice(0, 280)).slice(0, 500),
            grounding: ('Write a public summary for the Bitcoin education topic "' + String(title || 'this topic').slice(0, 80) + '". Output only the summary.').slice(0, 500),
        });
        return acceptSummary(result && result.answer, fallback);
    } catch (err) {
        return fallback;
    }
}

function forumTitleFor(topicTitle) {
    let title = ('Discussion: ' + String(topicTitle || 'this topic')).replace(/\s+/g, ' ').trim();
    if (title.length > FORUM_TITLE_MAX) title = title.slice(0, FORUM_TITLE_MAX - 1).trim() + '…';
    if (title.length < 5) title = 'Discussion';
    return title;
}

function forumBodyFor(summary, channelId, postId) {
    const link = topicPublicLink(channelId, postId);
    const body = String(summary || excerptSummary('')) + '\n\nThis discussion is about the topic. Continue it here: ' + link;
    return body.slice(0, FORUM_BODY_MAX);
}

function reserveForumSlot(limit, nowMs, offsetDateKey) {
    const src = limit || {};
    const last = Number(src.lastForumPostMs) || 0;
    if (last && (Number(nowMs) - last) < FORUM_RATE_MS) return { ok: false, code: 'rate' };
    const day = offsetDateKey(nowMs);
    const count = src.forumDayKey === day ? (Number(src.forumDayCount) || 0) : 0;
    if (count >= FORUM_DAILY_MAX) return { ok: false, code: 'daily' };
    return {
        ok: true,
        forumDayKey: day,
        forumDayCount: count + 1,
        lastForumPostMs: Number(nowMs) || 0,
    };
}

function stamp(admin, nowMs) {
    if (admin && admin.firestore && admin.firestore.Timestamp && typeof admin.firestore.Timestamp.fromMillis === 'function') {
        return admin.firestore.Timestamp.fromMillis(nowMs);
    }
    return nowMs;
}

function announcementLinks(channelId, postId, forumPostId) {
    const topic = '[the topic](' + topicHashLink(channelId, postId) + ')';
    const forum = forumPostId ? '[Pleb Talk](' + forumHashLink(forumPostId) + ')' : '';
    return forum ? (topic + ' · ' + forum) : topic;
}

function buildForumPostDoc(input) {
    const src = input || {};
    const channelId = cleanToken(src.channelId, 80);
    const postId = cleanToken(src.postId, 128);
    const forumPostId = src.forumPostId || forumPostIdFor(channelId, postId);
    if (!channelId || !postId || !forumPostId) return null;
    const summary = acceptSummary(src.summary, excerptSummary(src.text));
    const body = forumBodyFor(summary, channelId, postId);
    const link = topicPublicLink(channelId, postId).slice(0, 200);
    return {
        id: forumPostId,
        data: {
            title: forumTitleFor(src.title),
            body: body,
            link: link,
            category: 'general',
            authorId: src.uid,
            authorName: String(src.name || 'Anon').slice(0, 40),
            authorFaction: src.faction || null,
            authorPoints: Number(src.points) || 0,
            upvotes: 0,
            voters: [],
            replyCount: 0,
            createdAt: stamp(src.admin, src.nowMs),
            origin: 'topic',
            mirrorOf: postId,
            mirrorSync: mirrorSyncOf(body, false, false),
            topicChannel: channelId,
            topicPost: postId,
            topicLink: topicHashLink(channelId, postId),
            noAward: true,
            summary: summary,
        },
    };
}

function buildForumReplyDoc(input) {
    const src = input || {};
    const channelId = cleanToken(src.channelId, 80);
    const postId = cleanToken(src.postId, 128);
    const forumPostId = cleanToken(src.forumPostId, 400);
    const replyId = src.forumReplyId || forumReplyIdFor(channelId, postId);
    if (!channelId || !postId || !forumPostId || !replyId) return null;
    let body = String(src.text || '').slice(0, FORUM_REPLY_MAX);
    if (src.deleted || src.hidden) body = '';
    return {
        id: replyId,
        data: {
            postId: forumPostId,
            body: body,
            authorId: src.uid,
            authorName: String(src.name || 'Anon').slice(0, 40),
            authorFaction: src.faction || null,
            authorPoints: Number(src.points) || 0,
            upvotes: 0,
            voters: [],
            createdAt: stamp(src.admin, src.nowMs),
            origin: 'topic',
            mirrorOf: postId,
            mirrorSync: mirrorSyncOf(body, src.deleted === true, src.hidden === true),
            topicChannel: channelId,
            topicPost: postId,
            noAward: true,
            deleted: src.deleted === true,
            hidden: src.hidden === true,
        },
    };
}

async function mirrorTopicPost(opts) {
    const o = opts || {};
    const db = o.db;
    const post = o.post || {};
    const channelId = cleanToken(o.channelId || post.channelId, 80);
    const postId = cleanToken(o.postId, 128);
    if (!db || !channelId || !postId) return { mirrored: false, reason: 'bad_id' };
    if (post.origin === 'forum') return { mirrored: false, reason: 'origin' };
    if (!post.parentId) {
        const built = buildForumPostDoc({
            channelId: channelId,
            postId: postId,
            forumPostId: post.forumPostId,
            title: o.title,
            summary: post.summary || o.summary,
            text: post.text,
            uid: post.uid,
            name: post.name,
            faction: o.faction,
            points: o.points,
            admin: o.admin,
            nowMs: post.createdAtMs || o.nowMs,
        });
        if (!built) return { mirrored: false, reason: 'bad_id' };
        const ref = db.collection('forum_posts').doc(built.id);
        const snap = await ref.get();
        if (snap.exists) return { mirrored: false, reason: 'exists', forumPostId: built.id };
        await ref.set(built.data);
        return { mirrored: true, forumPostId: built.id };
    }
    const parentRef = db.collection('topic_discussions').doc(channelId).collection('posts').doc(post.parentId);
    const parentSnap = await parentRef.get();
    if (!parentSnap.exists) return { mirrored: false, reason: 'no_parent' };
    const parent = parentSnap.data() || {};
    const forumPostId = cleanToken(parent.forumPostId, 400);
    if (!forumPostId) return { mirrored: false, reason: 'no_forum' };
    const built = buildForumReplyDoc({
        channelId: channelId,
        postId: postId,
        forumPostId: forumPostId,
        text: post.text,
        uid: post.uid,
        name: post.name,
        faction: o.faction,
        points: o.points,
        admin: o.admin,
        nowMs: post.createdAtMs || o.nowMs,
        deleted: post.deleted === true,
        hidden: post.hidden === true,
    });
    if (!built) return { mirrored: false, reason: 'bad_id' };
    const replyRef = db.collection('forum_replies').doc(built.id);
    const forumRef = db.collection('forum_posts').doc(forumPostId);
    let created = false;
    await db.runTransaction(async function(tx) {
        const again = await tx.get(replyRef);
        if (again.exists) return;
        const forumSnap = await tx.get(forumRef);
        tx.set(replyRef, built.data);
        const count = forumSnap.exists ? (Number((forumSnap.data() || {}).replyCount) || 0) : 0;
        tx.set(forumRef, { replyCount: count + 1 }, { merge: true });
        created = true;
    });
    return { mirrored: created, reason: created ? 'ok' : 'exists', forumReplyId: built.id, forumPostId: forumPostId };
}

async function authorProfile(db, uid, nowMs) {
    const api = topicApi();
    const safe = cleanToken(uid, 128);
    if (!safe || safe === 'nacho-bot') return { ok: false, code: 'author' };
    const userSnap = await db.collection('users').doc(safe).get();
    const ledgerSnap = await db.collection('faucet_ledger').doc(safe).get();
    if (!userSnap.exists) return { ok: false, code: 'author' };
    const user = userSnap.data() || {};
    const block = api.moderationBlock(user, ledgerSnap.exists ? ledgerSnap.data() : null, nowMs);
    if (block) return { ok: false, code: block === 'banned' ? 'banned' : block };
    const name = String(user.username || '').replace(/[\u0000-\u001F<>]/g, '').trim().slice(0, 40);
    if (name.length < 2) return { ok: false, code: 'author' };
    return {
        ok: true,
        uid: safe,
        name: name,
        faction: user.faction || null,
        points: Number(user.points) || 0,
    };
}

async function mirrorForumReplyToTopic(opts) {
    const o = opts || {};
    const db = o.db;
    const replyId = cleanToken(o.replyId, 200);
    const data = o.data || {};
    if (!db || !replyId) return { mirrored: false, reason: 'bad_id' };
    if (data.origin === 'topic' || data.origin === 'forum' || data.mirrorOf) {
        return { mirrored: false, reason: 'origin' };
    }
    const forumPostId = cleanToken(data.postId, 400);
    if (!forumPostId) return { mirrored: false, reason: 'no_post' };
    const forumSnap = await db.collection('forum_posts').doc(forumPostId).get();
    if (!forumSnap.exists) return { mirrored: false, reason: 'no_post' };
    const forum = forumSnap.data() || {};
    if (forum.origin !== 'topic' || !cleanToken(forum.topicChannel, 80) || !cleanToken(forum.topicPost, 128)) {
        return { mirrored: false, reason: 'not_topic' };
    }
    const channelId = forum.topicChannel;
    const rootId = forum.topicPost;
    const nowMs = typeof o.nowMs === 'number' ? o.nowMs : Date.now();
    const who = await authorProfile(db, data.authorId, nowMs);
    if (!who.ok) return { mirrored: false, reason: who.code === 'banned' ? 'banned' : who.code };
    const api = topicApi();
    const prepared = api.preparePostText(data.body);
    if (!prepared.ok) return { mirrored: false, reason: 'filter' };
    const topicId = topicPostIdForForumReply(replyId);
    const topicRef = db.collection('topic_discussions').doc(channelId).collection('posts').doc(topicId);
    const rootRef = db.collection('topic_discussions').doc(channelId).collection('posts').doc(rootId);
    const limitRef = db.collection('topic_discussion_limits').doc(who.uid);
    const forumReplyRef = db.collection('forum_replies').doc(replyId);
    let result = { mirrored: false, reason: 'exists', topicPostId: topicId };
    await db.runTransaction(async function(tx) {
        const existing = await tx.get(topicRef);
        if (existing.exists) return;
        const limitSnap = await tx.get(limitRef);
        const rootSnap = await tx.get(rootRef);
        if (!rootSnap.exists) {
            result = { mirrored: false, reason: 'no_root' };
            return;
        }
        const root = rootSnap.data() || {};
        if (root.deleted === true || root.hidden === true) {
            result = { mirrored: false, reason: 'removed' };
            return;
        }
        const rate = api.decideRate(limitSnap.exists ? limitSnap.data() : {}, nowMs);
        if (!rate.ok) {
            result = { mirrored: false, reason: rate.code };
            return;
        }
        const sync = mirrorSyncOf(prepared.text, false, false);
        tx.set(limitRef, { lastPostMs: rate.lastPostMs, dayKey: rate.dayKey, dayCount: rate.dayCount }, { merge: true });
        tx.set(topicRef, {
            channelId: channelId,
            uid: who.uid,
            name: who.name,
            text: prepared.text,
            parentId: rootId,
            anchorIndex: null,
            anchorId: '',
            createdAt: stamp(o.admin, nowMs),
            createdAtMs: nowMs,
            hidden: false,
            deleted: false,
            isNacho: false,
            linksRemoved: prepared.linksRemoved === true,
            replyCount: 0,
            origin: 'forum',
            mirrorOf: replyId,
            forumReplyId: replyId,
            mirrorSync: sync,
        });
        tx.set(rootRef, { replyCount: (Number(root.replyCount) || 0) + 1 }, { merge: true });
        tx.set(forumReplyRef, {
            authorId: who.uid,
            authorName: who.name,
            topicChannel: channelId,
            topicPost: topicId,
            mirrorSync: sync,
        }, { merge: true });
        result = { mirrored: true, reason: 'ok', topicPostId: topicId };
    });
    return result;
}

async function syncTopicToForum(opts) {
    const o = opts || {};
    const db = o.db;
    const after = o.after || null;
    const before = o.before || null;
    const channelId = cleanToken(o.channelId || (after && after.channelId) || (before && before.channelId), 80);
    const postId = cleanToken(o.postId, 128);
    if (!db || !channelId || !postId) return { synced: false, reason: 'bad_id' };
    const source = after || before;
    if (!source) return { synced: false, reason: 'missing' };
    if (source.origin === 'forum' && after && after.mirrorSync && after.mirrorSync === mirrorSyncOf(after.deleted || after.hidden ? '' : after.text, after.deleted === true, after.hidden === true)) {
        if (before && before.mirrorSync === after.mirrorSync) return { synced: false, reason: 'echo' };
    }
    const deleted = !!(after && after.deleted);
    const hidden = !!(after && after.hidden);
    const text = !after || deleted || hidden ? '' : String(after.text || '');
    const hash = mirrorSyncOf(text, deleted || !after, hidden);
    if (!after) {
        // Hard delete. Soft-delete the forum side so a second pass is a no-op.
    }
    if (source.parentId) {
        const replyId = (after && after.forumReplyId) || (before && before.forumReplyId) || forumReplyIdFor(channelId, postId);
        if (!replyId) return { synced: false, reason: 'no_reply' };
        const replyRef = db.collection('forum_replies').doc(replyId);
        const snap = await replyRef.get();
        if (!snap.exists) return { synced: false, reason: 'missing' };
        const current = snap.data() || {};
        if (current.mirrorSync === hash && String(current.body || '') === text && current.deleted === (deleted || !after)) {
            return { synced: false, reason: 'exists' };
        }
        await replyRef.set({
            body: text,
            deleted: deleted || !after,
            hidden: hidden,
            mirrorSync: hash,
            origin: current.origin || 'topic',
            noAward: true,
        }, { merge: true });
        return { synced: true, forumReplyId: replyId };
    }
    const forumPostId = (after && after.forumPostId) || (before && before.forumPostId) || forumPostIdFor(channelId, postId);
    if (!forumPostId) return { synced: false, reason: 'no_forum' };
    const forumRef = db.collection('forum_posts').doc(forumPostId);
    const snap = await forumRef.get();
    if (!snap.exists) return { synced: false, reason: 'missing' };
    const current = snap.data() || {};
    if (current.mirrorSync === hash && current.deleted === (deleted || !after) && current.hidden === hidden) {
        return { synced: false, reason: 'exists' };
    }
    const patch = {
        deleted: deleted || !after,
        hidden: hidden,
        mirrorSync: hash,
        noAward: true,
        origin: current.origin || 'topic',
    };
    if (deleted || !after || hidden) patch.body = '';
    await forumRef.set(patch, { merge: true });
    return { synced: true, forumPostId: forumPostId };
}

async function syncForumReplyEdit(opts) {
    const o = opts || {};
    const before = o.before || {};
    const after = o.after || {};
    if (after.origin === 'topic' && after.mirrorSync && after.mirrorSync === mirrorSyncOf(after.deleted ? '' : after.body, after.deleted === true, after.hidden === true)) {
        if (before.mirrorSync === after.mirrorSync && before.body === after.body && before.deleted === after.deleted) {
            return { synced: false, reason: 'echo' };
        }
    }
    const channelId = cleanToken(after.topicChannel || before.topicChannel, 80);
    const topicPostId = cleanToken(after.topicPost || before.topicPost, 400);
    if (!o.db || !channelId || !topicPostId) return { synced: false, reason: 'not_topic' };
    if (before.body === after.body && before.deleted === after.deleted && before.hidden === after.hidden) {
        return { synced: false, reason: 'unchanged' };
    }
    const api = topicApi();
    const removed = after.deleted === true || after.hidden === true;
    let text = '';
    if (!removed) {
        const prepared = api.preparePostText(after.body);
        if (!prepared.ok) return { synced: false, reason: 'filter' };
        text = prepared.text;
    }
    const hash = mirrorSyncOf(text, removed, after.hidden === true);
    const topicRef = o.db.collection('topic_discussions').doc(channelId).collection('posts').doc(topicPostId);
    const snap = await topicRef.get();
    if (!snap.exists) return { synced: false, reason: 'missing' };
    const current = snap.data() || {};
    if (current.mirrorSync === hash && String(current.text || '') === text && current.deleted === removed) {
        return { synced: false, reason: 'exists' };
    }
    await topicRef.set({
        text: removed ? '' : text,
        deleted: removed,
        hidden: false,
        mirrorSync: hash,
    }, { merge: true });
    return { synced: true, topicPostId: topicPostId };
}

async function syncForumReplyDelete(opts) {
    const o = opts || {};
    const before = o.before || {};
    const channelId = cleanToken(before.topicChannel, 80);
    const topicPostId = cleanToken(before.topicPost, 400);
    if (!o.db || !channelId || !topicPostId) return { synced: false, reason: 'not_topic' };
    const hash = mirrorSyncOf('', true, false);
    const topicRef = o.db.collection('topic_discussions').doc(channelId).collection('posts').doc(topicPostId);
    const snap = await topicRef.get();
    if (!snap.exists) return { synced: false, reason: 'missing' };
    const current = snap.data() || {};
    if (current.deleted === true && current.text === '' && current.mirrorSync === hash) {
        return { synced: false, reason: 'exists' };
    }
    await topicRef.set({ deleted: true, hidden: false, text: '', mirrorSync: hash }, { merge: true });
    return { synced: true, topicPostId: topicPostId };
}

async function syncForumPostDelete(opts) {
    const o = opts || {};
    const before = o.before || {};
    if (before.origin !== 'topic') return { synced: false, reason: 'not_topic' };
    const channelId = cleanToken(before.topicChannel, 80);
    const topicPostId = cleanToken(before.topicPost, 128);
    if (!o.db || !channelId || !topicPostId) return { synced: false, reason: 'bad_id' };
    const hash = mirrorSyncOf('', true, false);
    const topicRef = o.db.collection('topic_discussions').doc(channelId).collection('posts').doc(topicPostId);
    const snap = await topicRef.get();
    if (!snap.exists) return { synced: false, reason: 'missing' };
    const current = snap.data() || {};
    if (current.deleted === true && current.mirrorSync === hash) return { synced: false, reason: 'exists' };
    await topicRef.set({ deleted: true, hidden: false, text: '', mirrorSync: hash }, { merge: true });
    return { synced: true, topicPostId: topicPostId };
}

async function noteClientForumPost(opts) {
    const o = opts || {};
    const data = o.data || {};
    if (!forumActivityAwardable(data)) return { counted: false, reason: 'mirror' };
    const uid = cleanToken(data.authorId, 128);
    const postId = cleanToken(o.postId, 400);
    if (!o.db || !uid || !postId) return { counted: false, reason: 'bad_id' };
    const api = topicApi();
    const nowMs = typeof o.nowMs === 'number' ? o.nowMs : Date.now();
    const limitRef = o.db.collection('topic_discussion_limits').doc(uid);
    const postRef = o.db.collection('forum_posts').doc(postId);
    return o.db.runTransaction(async function(tx) {
        const limSnap = await tx.get(limitRef);
        const postSnap = await tx.get(postRef);
        if (!postSnap.exists) return { counted: false, reason: 'gone' };
        const post = postSnap.data() || {};
        if (!forumActivityAwardable(post)) return { counted: false, reason: 'mirror' };
        const slot = reserveForumSlot(limSnap.exists ? limSnap.data() : {}, nowMs, api.offsetDateKey);
        if (!slot.ok) {
            tx.delete(postRef);
            return { counted: false, reason: slot.code, deleted: true };
        }
        tx.set(limitRef, {
            forumDayKey: slot.forumDayKey,
            forumDayCount: slot.forumDayCount,
            lastForumPostMs: slot.lastForumPostMs,
        }, { merge: true });
        return { counted: true };
    });
}

module.exports = {
    FORUM_DAILY_MAX: FORUM_DAILY_MAX,
    FORUM_RATE_MS: FORUM_RATE_MS,
    SUMMARY_MAX: SUMMARY_MAX,
    SERVER_FIELDS: SERVER_FIELDS,
    forumPostIdFor: forumPostIdFor,
    forumReplyIdFor: forumReplyIdFor,
    topicPostIdForForumReply: topicPostIdForForumReply,
    topicHashLink: topicHashLink,
    topicPublicLink: topicPublicLink,
    forumHashLink: forumHashLink,
    mirrorSyncOf: mirrorSyncOf,
    isMirrorCopy: isMirrorCopy,
    forumActivityAwardable: forumActivityAwardable,
    excerptSummary: excerptSummary,
    acceptSummary: acceptSummary,
    summarizeOpener: summarizeOpener,
    forumTitleFor: forumTitleFor,
    forumBodyFor: forumBodyFor,
    reserveForumSlot: reserveForumSlot,
    announcementLinks: announcementLinks,
    buildForumPostDoc: buildForumPostDoc,
    buildForumReplyDoc: buildForumReplyDoc,
    mirrorTopicPost: mirrorTopicPost,
    mirrorForumReplyToTopic: mirrorForumReplyToTopic,
    syncTopicToForum: syncTopicToForum,
    syncForumReplyEdit: syncForumReplyEdit,
    syncForumReplyDelete: syncForumReplyDelete,
    syncForumPostDelete: syncForumPostDelete,
    noteClientForumPost: noteClientForumPost,
};
