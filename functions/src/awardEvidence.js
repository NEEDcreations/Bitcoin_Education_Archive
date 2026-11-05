'use strict';

// Evidence for awardPoints. The client phrase is not proof.
// Verified actions keep their allowlist amount only when a server read matches.
// Unverified actions share a 100 XP daily pool. That XP still lands in the
// daily total and the weekly boards, and it does not count toward claimSats.
// A document pays once, across every account, and only within 24 hours of creation.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const UNVERIFIED_DAILY_CAP = 100;
const ANON_POINT_CAP = 500;
const FRESH_MS = 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;

const GENERIC_QUIZ = [
    {
        q: 'What is the primary benefit of running a Bitcoin full node?',
        a: 'You can independently verify the consensus rules and your own transactions.',
    },
    {
        q: "What does 'Satoshi' represent in the context of Bitcoin?",
        a: 'The smallest unit of Bitcoin, equal to 0.00000001 BTC.',
    },
    {
        q: "Why is Bitcoin's difficulty adjustment important?",
        a: 'It ensures blocks are produced roughly every 10 minutes regardless of total hash rate.',
    },
    {
        q: 'What happens if you lose your 12 or 24-word seed phrase?',
        a: "You lose access to your funds forever, as there is no central 'reset' authority.",
    },
    {
        q: 'What is the primary function of the Lightning Network?',
        a: 'To enable instant, near-free Bitcoin payments by moving them off-chain.',
    },
];

const EXPLORE_NEED = {
    explore_10: { count: 10 },
    explore_25: { pct: 25 },
    explore_50: { pct: 50 },
    explore_75: { pct: 75 },
    explore_100: { pct: 100 },
};

const DOC_ACTIONS = {
    chat_message: { field: 'messageId', owner: 'uid', collection: 'global_chat' },
    forum_post: { field: 'postId', owner: 'authorId', collection: 'forum_posts' },
    forum_reply: { field: 'replyId', owner: 'authorId', collection: 'forum_replies' },
    article_comment: { field: 'commentId', owner: 'authorId', collection: 'article_replies' },
    feedback: { field: 'feedbackId', owner: 'uid', collection: 'channel_feedback' },
    beats_upload: { field: 'trackId', owner: 'authorId', collection: 'beats_tracks' },
    beats_comment: { field: 'commentId', owner: 'authorId', collection: 'beats_comment' },
};

let channelSet = null;
let quizMap = null;

function norm(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function cleanId(value, max) {
    return String(value || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, max || 120);
}

function fail(error) {
    return { ok: false, error: error || 'Evidence required' };
}

function pass(extra) {
    return Object.assign({ ok: true }, extra || {});
}

function channels() {
    if (channelSet) return channelSet;
    const src = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
    const match = src.match(/const VALID_CHANNEL_IDS = new Set\(\[([\s\S]*?)\]\)/);
    const ids = match ? match[1].split(',') : [];
    channelSet = new Set(ids.map(function (part) {
        return part.trim().replace(/^["']|["']$/g, '');
    }).filter(Boolean));
    return channelSet;
}

function quizzes() {
    if (quizMap) return quizMap;
    const banks = require('../reward-banks.json');
    const map = new Map();
    function addAnswer(q, a) {
        const question = norm(q);
        const answer = norm(a);
        if (!question || !answer) return;
        let set = map.get(question);
        if (!set) {
            set = new Set();
            map.set(question, set);
        }
        set.add(answer);
        const plain = answer.replace(/\\/g, '');
        if (plain && plain !== answer) set.add(plain);
    }
    function add(list) {
        const rows = Array.isArray(list) ? list : [];
        rows.forEach(function (item) {
            addAnswer(item && item.q, item && item.a);
        });
    }
    Object.keys(banks.quests || {}).forEach(function (topic) { add(banks.quests[topic]); });
    Object.keys(banks.learning || {}).forEach(function (topic) { add(banks.learning[topic]); });
    add(GENERIC_QUIZ);
    quizMap = map;
    return quizMap;
}

function gradeQuiz(question, choice) {
    const q = norm(question);
    const chosen = norm(choice);
    if (!q || !chosen || q.length > 600 || chosen.length > 400) return fail('Quiz answer did not match');
    const answers = quizzes().get(q);
    if (!answers || !answers.has(chosen)) return fail('Quiz answer did not match');
    const key = crypto.createHash('sha256').update(q).digest('hex').slice(0, 20);
    return pass({ key: key });
}

function idList(value, max) {
    const raw = Array.isArray(value) ? value.join(',') : String(value || '');
    const parts = raw.split(/[,\s]+/);
    const out = [];
    const seen = {};
    for (let i = 0; i < parts.length && out.length < max; i++) {
        const id = cleanId(parts[i], 128);
        if (!id || seen[id]) continue;
        seen[id] = true;
        out.push(id);
    }
    return out;
}

function createdMillis(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof value.toMillis === 'function') {
        const millis = value.toMillis();
        return Number.isFinite(millis) ? millis : null;
    }
    if (typeof value.seconds === 'number') {
        return (value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1e6);
    }
    if (typeof value._seconds === 'number') {
        return (value._seconds * 1000) + Math.floor((value._nanoseconds || 0) / 1e6);
    }
    return null;
}

function freshEnough(value, now) {
    const ms = createdMillis(value);
    if (ms == null) return false;
    const clock = typeof now === 'number' ? now : Date.now();
    if (ms > clock + CLOCK_SKEW_MS) return false;
    if (clock - ms > FRESH_MS) return false;
    return true;
}

function docTime(row, proof) {
    if (proof && proof.createdAt != null) return proof.createdAt;
    if (!row) return null;
    if (row.createdAt != null) return row.createdAt;
    if (row.ts != null) return row.ts;
    return null;
}

function markerIdFor(actionId, target, data) {
    const id = cleanId(target, 128);
    if (!id) return '';
    if (actionId === 'beats_upload' || actionId === 'beats_upload_batch') return 'beats_tracks__' + id;
    if (actionId === 'beats_comment') {
        const trackId = cleanId(data && data.trackId, 128);
        if (!trackId) return '';
        return 'beats_comment__' + trackId + '__' + id;
    }
    const spec = DOC_ACTIONS[actionId];
    if (!spec) return '';
    return spec.collection + '__' + id;
}

// New claims use "__". A marker written before that change used a single "_"
// and is still honored, so an old claim cannot be paid again.
function markerReadIds(actionId, target, data) {
    const primary = markerIdFor(actionId, target, data);
    if (!primary) return [];
    const ids = [primary];
    if (actionId === 'beats_comment') {
        const trackId = cleanId(data && data.trackId, 128);
        const commentId = cleanId(target, 128);
        const legacy = trackId && commentId ? ('beats_comment_' + trackId + '_' + commentId) : '';
        if (legacy && ids.indexOf(legacy) === -1) ids.push(legacy);
    }
    return ids;
}

function topicCopy(row, proof) {
    const doc = row || {};
    const src = proof || {};
    return !!(doc.topicPost || doc.topicLink || src.topicPost || src.topicLink);
}

function markerIds(actionId, targets, data) {
    const list = Array.isArray(targets) ? targets : [targets];
    const out = [];
    for (let i = 0; i < list.length; i++) {
        const id = markerIdFor(actionId, list[i], data);
        if (id && out.indexOf(id) === -1) out.push(id);
    }
    return out;
}

function markerTaken(ctx, id) {
    if (!id) return false;
    const context = ctx || {};
    if (context.globalClaims && context.globalClaims[id]) return true;
    const snap = context.snaps && context.snaps['marker:' + id];
    return !!(snap && (snap.exists === true || (snap.exists !== false && snap.data)));
}

function ownerOf(row, field) {
    if (!row) return '';
    if (field === 'uid') return String(row.uid || '');
    return String(row.authorId || row.uid || '');
}

function countVisited(user, catalog) {
    const src = user || {};
    const list = [].concat(src.visitedChannelsList || [], src.readChannels || []);
    const seen = {};
    let n = 0;
    list.forEach(function (id) {
        if (typeof id !== 'string' || !catalog.has(id) || seen[id]) return;
        seen[id] = true;
        n += 1;
    });
    return n;
}

function chapterMarked(ctx, n) {
    const proof = ctx.proof || {};
    if (Array.isArray(proof.chapters) && proof.chapters.map(String).indexOf(String(n)) !== -1) return true;
    const key = (ctx.claimPrefix || '') + 'once_story_chapter_' + n;
    if (ctx.claims && ctx.claims[key]) return true;
    if (ctx.snaps && ctx.snaps['ch' + n] && ctx.snaps['ch' + n].exists) return true;
    return false;
}

function snapRow(ctx, key) {
    const snap = ctx.snaps && ctx.snaps[key];
    if (!snap) return null;
    if (snap.exists === false) return null;
    const data = typeof snap.data === 'function' ? snap.data() : snap.data;
    if (!data && snap.exists !== true) return null;
    return data || {};
}

// Sync gate: ids, catalog membership, and quiz grading. No Firestore.
function precheck(resolved, data) {
    const src = data || {};
    if (!resolved || !resolved.ok) return fail('Unknown action');
    if (resolved.badge || resolved.unverified) return pass({ xp: resolved.xp, target: resolved.target });

    if (resolved.id === 'quiz_correct') {
        const graded = gradeQuiz(src.quizQuestion, src.quizChoice);
        if (!graded.ok) return graded;
        return pass({ xp: resolved.xp, target: graded.key, onceId: true });
    }

    if (resolved.id === 'channel_read') {
        if (!channels().has(resolved.target)) return fail('Unknown channel');
        return pass({ xp: resolved.xp, target: resolved.target });
    }

    if (DOC_ACTIONS[resolved.id]) {
        const spec = DOC_ACTIONS[resolved.id];
        const id = cleanId(src[spec.field], 128);
        if (!id) return fail('Evidence required');
        if (resolved.id === 'beats_comment' && !cleanId(src.trackId, 128)) return fail('Evidence required');
        return pass({ xp: resolved.xp, target: id, onceId: true });
    }

    if (resolved.id === 'beats_upload_batch') {
        const ids = idList(src.trackIds, 8);
        if (!ids.length) return fail('Evidence required');
        return pass({ xp: resolved.xp, target: ids[0], onceId: true, trackIds: ids });
    }

    if (resolved.id === 'anon_merge') {
        const anonUid = cleanId(src.anonUid, 128);
        if (!anonUid || anonUid.length < 10) return fail('Anonymous account was not verified');
        return pass({ xp: 0, target: anonUid });
    }

    if (resolved.id === 'chat_streak_3' || resolved.id === 'chat_streak_7' || resolved.id === 'chat_streak_30') {
        return pass({ xp: resolved.xp, target: resolved.target });
    }

    return pass({ xp: resolved.xp, target: resolved.target });
}

function planReads(db, userRef, uid, resolved, data) {
    const src = data || {};
    const out = [];
    function add(key, ref) {
        if (ref) out.push({ key: key, ref: ref });
    }
    if (!resolved) return out;
    const spec = DOC_ACTIONS[resolved.id];
    if (spec && spec.collection !== 'beats_comment') {
        const docId = cleanId(src[spec.field], 128);
        add('doc', db.collection(spec.collection).doc(docId));
        markerReadIds(resolved.id, docId, src).forEach(function (marker) {
            add('marker:' + marker, db.collection('award_doc_claims').doc(marker));
        });
    }
    if (resolved.id === 'beats_comment') {
        const trackId = cleanId(src.trackId, 128);
        const commentId = cleanId(src.commentId, 128);
        if (trackId && commentId) {
            add('doc', db.collection('beats_tracks').doc(trackId).collection('comments').doc(commentId));
            markerReadIds(resolved.id, commentId, src).forEach(function (marker) {
                add('marker:' + marker, db.collection('award_doc_claims').doc(marker));
            });
        }
    }
    if (resolved.id === 'beats_upload_batch') {
        idList(src.trackIds, 8).forEach(function (id, index) {
            add('track' + index, db.collection('beats_tracks').doc(id));
            const marker = markerIdFor('beats_upload', id, src);
            if (marker) add('marker:' + marker, db.collection('award_doc_claims').doc(marker));
        });
    }
    if (resolved.id === 'story_complete') {
        for (let n = 1; n <= 7; n++) {
            add('ch' + n, userRef.collection('award_claims').doc('once_story_chapter_' + n));
        }
    }
    if (resolved.id === 'prediction') add('prediction', db.collection('active_predictions').doc(uid));
    if (resolved.id === 'anon_merge') add('anon', db.collection('users').doc(cleanId(src.anonUid, 128)));
    return out;
}

async function anonAuth(admin, anonUid) {
    const id = cleanId(anonUid, 128);
    if (!id || id.length < 10) return fail('Anonymous account was not verified');
    try {
        const user = await admin.auth().getUser(id);
        const providers = user && user.providerData ? user.providerData.length : 0;
        if (!user || providers > 0) return fail('Anonymous account was not verified');
        return pass({ anonUid: id });
    } catch (err) {
        return fail('Anonymous account was not verified');
    }
}

// Second gate, after server docs are loaded. proof stands in for those docs in unit tests.
function confirm(resolved, data, ctx) {
    const context = ctx || {};
    const proof = context.proof || {};
    const uid = context.uid;
    if (!resolved || !resolved.ok) return fail('Unknown action');
    if (resolved.badge) return pass({ xp: resolved.xp });
    if (resolved.unverified) return pass({ xp: resolved.xp, unverified: true });

    if (resolved.id === 'story_complete') {
        for (let n = 1; n <= 7; n++) {
            if (!chapterMarked(context, n)) return fail('Finish every chapter first');
        }
        return pass({ xp: resolved.xp });
    }

    if (EXPLORE_NEED[resolved.id]) {
        const catalog = channels();
        const size = (typeof proof.catalogSize === 'number' && proof.catalogSize > 0) ? proof.catalogSize : (catalog.size || 1);
        const visited = typeof proof.visited === 'number' ? proof.visited : countVisited(context.user, catalog);
        const need = EXPLORE_NEED[resolved.id];
        if (need.count != null && visited < need.count) return fail('Not enough channels explored');
        if (need.pct != null && Math.round((visited / size) * 100) < need.pct) return fail('Not enough channels explored');
        return pass({ xp: resolved.xp });
    }

    if (resolved.id === 'daily_visit') {
        const last = proof.lastVisit != null ? proof.lastVisit : ((context.user && context.user.lastVisit) || '');
        if (last !== context.day) return fail('Visit was not recorded');
        return pass({ xp: resolved.xp });
    }

    if (resolved.id === 'chat_streak_3' || resolved.id === 'chat_streak_7' || resolved.id === 'chat_streak_30') {
        const need = parseInt(resolved.target, 10) || 0;
        const streak = proof.chatStreak != null ? proof.chatStreak : ((context.user && context.user.chatXpStreak) || 0);
        if (streak < need) return fail('Chat streak was not reached');
        return pass({ xp: resolved.xp });
    }

    if (resolved.id === 'prediction') {
        const row = snapRow(context, 'prediction');
        const marked = proof.prediction === true || !!row;
        if (!marked) return fail('Prediction was not saved');
        if (row && row.uid && row.uid !== uid) return fail('Prediction was not saved');
        return pass({ xp: resolved.xp });
    }

    if (DOC_ACTIONS[resolved.id]) {
        const spec = DOC_ACTIONS[resolved.id];
        const row = snapRow(context, 'doc');
        const owner = proof.docOwner != null ? proof.docOwner : ownerOf(row, spec.owner);
        if (!owner || owner !== uid) return fail('Evidence required');
        if ((resolved.id === 'forum_post' || resolved.id === 'forum_reply') && topicCopy(row, proof)) {
            return fail('Evidence required');
        }
        if (!freshEnough(docTime(row, proof), context.now)) return fail('Evidence expired');
        const markers = markerReadIds(resolved.id, resolved.target || (data && data[spec.field]), data);
        for (let mi = 0; mi < markers.length; mi++) {
            if (markerTaken(context, markers[mi])) return fail('Already claimed');
        }
        return pass({ xp: resolved.xp });
    }

    if (resolved.id === 'beats_upload_batch') {
        const ids = idList((data && data.trackIds) || proof.trackIds, 8);
        const ownedIds = [];
        const times = {};
        if (typeof proof.ownedTracks === 'number') {
            for (let i = 0; i < Math.min(proof.ownedTracks, ids.length); i++) {
                ownedIds.push(ids[i]);
                times[ids[i]] = proof.createdAt;
            }
        } else if (proof.docOwner === uid) {
            ids.forEach(function (id) {
                ownedIds.push(id);
                times[id] = proof.createdAt;
            });
        } else {
            ids.forEach(function (id, index) {
                const row = snapRow(context, 'track' + index);
                if (row && ownerOf(row, 'authorId') === uid) {
                    ownedIds.push(id);
                    times[id] = docTime(row, proof);
                }
            });
        }
        if (!ownedIds.length) return fail('Evidence required');
        for (let oi = 0; oi < ownedIds.length; oi++) {
            if (!freshEnough(times[ownedIds[oi]], context.now)) return fail('Evidence expired');
            if (markerTaken(context, markerIdFor('beats_upload', ownedIds[oi], data))) return fail('Already claimed');
        }
        let xp = Math.min(25 * ownedIds.length, 50);
        if (resolved.requiresDoubleXp) xp = Math.min(xp * 2, 50);
        if (resolved.xp != null && xp > resolved.xp) xp = resolved.xp;
        return pass({ xp: xp, claimTargets: ownedIds });
    }

    if (resolved.id === 'anon_merge') {
        const anon = proof.anon || null;
        const row = snapRow(context, 'anon');
        const exists = (anon && anon.exists === true) || !!row;
        const anonymous = anon ? anon.anonymous === true : context.anonAnonymous === true;
        const mergedInto = anon && anon.mergedInto != null ? anon.mergedInto : (row && row.mergedInto) || '';
        const points = anon && anon.points != null ? anon.points : (row && row.points) || 0;
        if (!exists || !anonymous || mergedInto !== uid) return fail('Anonymous account was not verified');
        const serverPts = Math.max(0, Math.floor(Number(points) || 0));
        return pass({ xp: Math.min(ANON_POINT_CAP, serverPts) });
    }

    return pass({ xp: resolved.xp });
}

function claimablePoints(user) {
    const src = user || {};
    const points = Number(src.points) || 0;
    const claimed = Number(src.pointsClaimed) || 0;
    const donated = Number(src.pointsDonated) || 0;
    const exchanged = Number(src.pointsExchanged) || 0;
    const unclaimable = Number(src.unclaimableXp) || 0;
    return points - claimed - donated - exchanged - (unclaimable > 0 ? unclaimable : 0);
}

function previousDay(day) {
    const ms = Date.parse(String(day || '') + 'T00:00:00Z');
    if (!Number.isFinite(ms)) return '';
    return new Date(ms - 86400000).toISOString().split('T')[0];
}

function nextChatStreak(user, day) {
    const src = user || {};
    const today = String(day || '');
    const prev = String(src.chatXpDay || '');
    const streak = Math.max(0, parseInt(src.chatXpStreak, 10) || 0);
    if (prev === today) return { streak: streak || 1, changed: false };
    const next = prev && prev === previousDay(today) ? streak + 1 : 1;
    return { streak: next, changed: true };
}

module.exports = {
    UNVERIFIED_DAILY_CAP: UNVERIFIED_DAILY_CAP,
    ANON_POINT_CAP: ANON_POINT_CAP,
    channels: channels,
    gradeQuiz: gradeQuiz,
    precheck: precheck,
    confirm: confirm,
    planReads: planReads,
    anonAuth: anonAuth,
    claimablePoints: claimablePoints,
    nextChatStreak: nextChatStreak,
    cleanId: cleanId,
    markerIds: markerIds,
    freshEnough: freshEnough,
};
