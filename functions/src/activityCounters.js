'use strict';

const { grantFamily, familyFor } = require('./grantBadge');
const { forumActivityAwardable } = require('./topicForumMirror');
const { rewardBlocked } = require('./cipherClaim');
const { noteComboZone } = require('./comboActivity');
const { offsetDateKey } = require('./offsetDay');

const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function cleanUid(uid) {
    return typeof uid === 'string' && UID_RE.test(uid) ? uid : '';
}

async function bumpCounter(db, adminSdk, uid, field) {
    const safe = cleanUid(uid);
    if (!safe || !field) return { bumped: false };
    const ref = db.collection('users').doc(safe);
    const ledgerRef = db.collection('faucet_ledger').doc(safe);
    const snap = await ref.get();
    const ledgerSnap = await ledgerRef.get();
    if (!snap.exists) return { bumped: false, reason: 'no_user' };
    const ledger = ledgerSnap && ledgerSnap.exists ? (ledgerSnap.data() || {}) : {};
    if (rewardBlocked(snap.data() || {}, ledger)) return { bumped: false, reason: 'banned' };
    await ref.update({ [field]: adminSdk.firestore.FieldValue.increment(1) });
    const ids = familyFor(field);
    if (ids.length) await grantFamily(db, adminSdk, safe, ids);
    return { bumped: true, uid: safe, field: field };
}

function chatAuthor(data) {
    if (!data || typeof data !== 'object') return '';
    if (data.isNachoAuto === true || data.isSystemPost === true) return '';
    if (data.uid === 'nacho-bot' || data.uid === 'system') return '';
    if (data.source === 'telegram') return '';
    return cleanUid(data.uid);
}

function noteZone(db, adminSdk, result, zone) {
    if (!result || !result.bumped || !result.uid) return Promise.resolve(result);
    return noteComboZone(db, adminSdk, result.uid, zone, offsetDateKey(Date.now())).catch(function () {
        return null;
    }).then(function () { return result; });
}

function recordChat(db, adminSdk, data) {
    return bumpCounter(db, adminSdk, chatAuthor(data), 'chatCount').then(function (result) {
        return noteZone(db, adminSdk, result, 'chat');
    });
}

function recordDm(db, adminSdk, data) {
    if (!data || data.isSystem === true) return Promise.resolve({ bumped: false });
    return bumpCounter(db, adminSdk, cleanUid(data.senderUid), 'dmCount');
}

function recordForumPost(db, adminSdk, data) {
    if (!forumActivityAwardable(data)) return Promise.resolve({ bumped: false, reason: 'mirror' });
    return bumpCounter(db, adminSdk, cleanUid(data && (data.authorId || data.uid)), 'forumPosts').then(function (result) {
        return noteZone(db, adminSdk, result, 'forum');
    });
}

async function parentIsTopicMirror(db, data) {
    const postId = data && typeof data.postId === 'string' ? data.postId : '';
    if (!db || !/^[A-Za-z0-9_-]{1,400}$/.test(postId)) return false;
    const snap = await db.collection('forum_posts').doc(postId).get();
    if (!snap.exists) return false;
    const parent = snap.data() || {};
    if (parent.origin === 'topic' || parent.origin === 'forum') return true;
    if (parent.noAward === true || parent.mirrorOf) return true;
    if (parent.topicChannel || parent.topicPost) return true;
    return false;
}

async function recordForumReply(db, adminSdk, data) {
    if (!forumActivityAwardable(data)) return { bumped: false, reason: 'mirror' };
    try {
        if (await parentIsTopicMirror(db, data)) return { bumped: false, reason: 'mirror' };
    } catch (err) {
        return { bumped: false, reason: 'mirror' };
    }
    const result = await bumpCounter(db, adminSdk, cleanUid(data && (data.authorId || data.uid)), 'forumReplies');
    return noteZone(db, adminSdk, result, 'forum');
}

function recordBeatsUpload(db, adminSdk, data) {
    return bumpCounter(db, adminSdk, cleanUid(data && (data.authorId || data.uid)), 'beatsUploads').then(function (result) {
        return noteZone(db, adminSdk, result, 'beats');
    });
}

function recordArticle(db, adminSdk, data) {
    return bumpCounter(db, adminSdk, cleanUid(data && (data.authorId || data.uid)), 'articlesPublished');
}

async function recordPvpPlayed(db, adminSdk, after) {
    if (!after || after.status !== 'finished') return { bumped: false, reason: 'not_finished' };
    const p1 = after.player1 || {};
    const p2 = after.player2 || {};
    const u1 = cleanUid(p1.uid || after.player1Uid);
    const u2 = cleanUid(p2.uid || after.player2Uid);
    const jobs = [];
    if (u1) jobs.push(bumpCounter(db, adminSdk, u1, 'pvpPlayed'));
    if (u2 && u2 !== u1) jobs.push(bumpCounter(db, adminSdk, u2, 'pvpPlayed'));
    await Promise.all(jobs);
    const day = offsetDateKey(Date.now());
    const zones = [];
    if (u1) zones.push(noteComboZone(db, adminSdk, u1, 'pvp', day).catch(function () { return null; }));
    if (u2 && u2 !== u1) zones.push(noteComboZone(db, adminSdk, u2, 'pvp', day).catch(function () { return null; }));
    await Promise.all(zones);
    return { bumped: true };
}

async function recordPvpFinished(db, adminSdk, before, after) {
    if (!after || after.status !== 'finished') return { bumped: false, reason: 'not_finished' };
    if (before && before.status === 'finished') return { bumped: false, reason: 'already' };
    const p1 = after.player1 || {};
    const p2 = after.player2 || {};
    const u1 = cleanUid(p1.uid || after.player1Uid);
    const u2 = cleanUid(p2.uid || after.player2Uid);
    const s1 = Number(p1.score || 0);
    const s2 = Number(p2.score || 0);
    const jobs = [];
    if (u1) jobs.push(bumpCounter(db, adminSdk, u1, 'pvpPlayed'));
    if (u2) jobs.push(bumpCounter(db, adminSdk, u2, 'pvpPlayed'));
    if (s1 > s2 && u1) jobs.push(bumpCounter(db, adminSdk, u1, 'pvpWins'));
    if (s2 > s1 && u2) jobs.push(bumpCounter(db, adminSdk, u2, 'pvpWins'));
    await Promise.all(jobs);
    const day = offsetDateKey(Date.now());
    const zones = [];
    if (u1) zones.push(noteComboZone(db, adminSdk, u1, 'pvp', day).catch(function () { return null; }));
    if (u2 && u2 !== u1) zones.push(noteComboZone(db, adminSdk, u2, 'pvp', day).catch(function () { return null; }));
    await Promise.all(zones);
    return { bumped: true };
}

module.exports = {
    forumActivityAwardable: forumActivityAwardable,
    bumpCounter: bumpCounter,
    chatAuthor: chatAuthor,
    recordChat: recordChat,
    recordDm: recordDm,
    recordForumPost: recordForumPost,
    recordForumReply: recordForumReply,
    recordBeatsUpload: recordBeatsUpload,
    recordArticle: recordArticle,
    recordPvpPlayed: recordPvpPlayed,
    recordPvpFinished: recordPvpFinished,
};
