'use strict';

// Topic conversation XP. Awarded only inside the server transaction that
// accepts the original post. Mirrored copies award nothing. Clients cannot
// write these totals.
//
// Amounts, before the shared daily taper:
//   start a conversation          +10
//   reply (origin only)           +5
//   someone else replies          +2 to the starter, max 5 awards per day
// Conversation XP is capped at 40 per user per day. The amount that still
// fits goes through applyDailyXp, which is full through 500, half through
// 900, and a quarter until 1,000. Nothing is banked. The day starts at 5 AM UTC.
//
// PR #79 (not merged here) pays +5 XP for a different comment path, up to 3
// a day in that branch's code, and skips posts that already belong to a topic
// conversation (channelId, topicChannel, origin, or a topic_discussions doc).
// This module is the only award for these messages. Do not also call that path.
//
// A delete does not refund XP on its own. If the post is deleted or moderated
// within 10 minutes, the stored award is subtracted (floor 0). That reversal
// is a simple subtract of the credited amount, not a replay of the taper.

const { applyDailyXp } = require('./applyDailyXp');

const START_XP = 10;
const REPLY_XP = 5;
const STARTER_XP = 2;
const CONVO_DAILY_CAP = 40;
const STARTER_AWARDS_MAX = 5;
const MIN_NON_WS = 15;
const DUP_RATIO = 0.15;
const CLAWBACK_MS = 10 * 60 * 1000;
const NACHO_UID = 'nacho-bot';
const LEDGER_SOURCE = 'topic_conversation';

function nonWhitespaceCount(text) {
    return String(text || '').replace(/\s/g, '').length;
}

function normalizeMessage(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    let prev = new Array(n + 1);
    let cur = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
        cur[0] = i;
        const ca = a.charCodeAt(i - 1);
        for (let j = 1; j <= n; j++) {
            const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
            const del = prev[j] + 1;
            const ins = cur[j - 1] + 1;
            const sub = prev[j - 1] + cost;
            let best = del < ins ? del : ins;
            if (sub < best) best = sub;
            cur[j] = best;
        }
        const swap = prev;
        prev = cur;
        cur = swap;
    }
    return prev[n];
}

function isNearDuplicate(norm, recent) {
    if (!norm) return false;
    const list = Array.isArray(recent) ? recent : [];
    for (let i = 0; i < list.length; i++) {
        const prev = normalizeMessage(list[i]);
        if (!prev) continue;
        if (prev === norm) return true;
        const maxLen = Math.max(prev.length, norm.length);
        if (!maxLen || maxLen > 500) continue;
        if (Math.abs(prev.length - norm.length) / maxLen > DUP_RATIO) continue;
        if (levenshtein(prev, norm) / maxLen <= DUP_RATIO) return true;
    }
    return false;
}

function assessText(text, recent) {
    const norm = normalizeMessage(text);
    if (nonWhitespaceCount(text) < MIN_NON_WS) return { ok: false, reason: 'short', norm: norm };
    if (isNearDuplicate(norm, recent)) return { ok: false, reason: 'duplicate', norm: norm };
    return { ok: true, reason: 'ok', norm: norm };
}

function recentNext(recent, norm) {
    const list = Array.isArray(recent) ? recent.map(normalizeMessage).filter(Boolean) : [];
    if (norm) list.push(norm);
    return list.slice(-5);
}

function convoUsed(limit, day) {
    const src = limit || {};
    if (src.convoDayKey !== day) return 0;
    return Math.max(0, Number(src.convoXp) || 0);
}

function starterAwardsUsed(limit, day) {
    const src = limit || {};
    if (src.starterReplyDayKey !== day) return 0;
    return Math.max(0, Number(src.starterReplyCount) || 0);
}

function roomFor(limit, day, want) {
    const used = convoUsed(limit, day);
    return Math.max(0, Math.min(want, CONVO_DAILY_CAP - used));
}

function toastFor(amount) {
    const n = Math.max(0, Math.floor(Number(amount) || 0));
    if (!n) return '';
    return '+' + n + ' XP';
}

function ledgerRef(userRef, postId, kind) {
    const id = ('tc_' + String(postId || '') + '_' + kind).slice(0, 700);
    return userRef.collection('xp_ledger').doc(id);
}

function ledgerData(uid, amount, kind, channelId, postId, day, nowMs, windowFields) {
    const win = windowFields || {};
    return {
        source: LEDGER_SOURCE,
        amount: amount,
        kind: kind,
        channelId: channelId || '',
        postId: postId || '',
        day: day || '',
        createdAtMs: nowMs,
        uid: uid,
        base: win.base != null ? win.base : amount,
        boosted: win.boosted != null ? win.boosted : amount,
        doubled: win.doubled === true,
    };
}

function pointsPatch(user, amount) {
    const src = user || {};
    return {
        points: (Number(src.points) || 0) + amount,
        weeklyXP: (Number(src.weeklyXP) || 0) + amount,
        monthlyXP: (Number(src.monthlyXP) || 0) + amount,
    };
}

function emptyGrant(day, nowMs, recent) {
    return {
        awarded: 0,
        toast: '',
        authorAwarded: 0,
        starterAwarded: 0,
        starterUid: '',
        day: day,
        nowMs: nowMs,
        reason: 'none',
        authorLimitPatch: recent ? { recentTexts: recent } : {},
        postFields: {},
        writes: [],
    };
}

// Reads only. Caller writes afterwards, and merges authorLimitPatch into the
// author's limit doc itself.
async function grantInTransaction(tx, opts) {
    const o = opts || {};
    const day = o.day;
    const nowMs = o.nowMs;
    const authorLimit = o.authorLimit || {};
    const assessed = assessText(o.text, authorLimit.recentTexts);
    const recent = recentNext(authorLimit.recentTexts, assessed.norm);
    const blocked = typeof o.moderationBlock === 'function' ? o.moderationBlock : function() { return ''; };

    if (o.mirrorCopy || o.noAward || o.origin === 'topic' || o.origin === 'forum' || o.isNacho || o.authorUid === NACHO_UID) {
        const grant = emptyGrant(day, nowMs, null);
        grant.reason = o.isNacho || o.authorUid === NACHO_UID ? 'nacho' : 'mirror';
        return grant;
    }

    let authorUser = o.authorUser || null;
    if (!authorUser && o.authorRef) {
        const snap = await tx.get(o.authorRef);
        authorUser = snap && snap.exists ? (snap.data() || {}) : null;
    }
    let authorLedger = o.authorLedger;
    if (authorLedger === undefined && o.db && o.authorUid) {
        const ledgerSnap = await tx.get(o.db.collection('faucet_ledger').doc(o.authorUid));
        authorLedger = ledgerSnap && ledgerSnap.exists ? (ledgerSnap.data() || {}) : null;
    }
    if (!authorUser || blocked(authorUser, authorLedger || null, nowMs) === 'banned') {
        const grant = emptyGrant(day, nowMs, recent);
        grant.reason = 'banned';
        return grant;
    }

    let authorNominal = 0;
    let starterNominal = 0;
    let starterUid = '';
    let starterUser = null;
    let starterLimit = null;
    let starterRef = null;
    let starterLimitRef = null;
    let reason = assessed.reason;

    if (!assessed.ok || o.selfReply) {
        reason = o.selfReply && assessed.ok ? 'self' : assessed.reason;
    } else {
        authorNominal = roomFor(authorLimit, day, o.isStart ? START_XP : REPLY_XP);
        const other = o.starterUid && o.starterUid !== o.authorUid && o.starterUid !== NACHO_UID && !o.starterIsNacho;
        if (!o.isStart && other && o.db) {
            starterUid = o.starterUid;
            starterRef = o.db.collection('users').doc(starterUid);
            starterLimitRef = o.db.collection('topic_discussion_limits').doc(starterUid);
            const ledgerRefStarter = o.db.collection('faucet_ledger').doc(starterUid);
            const userSnap = await tx.get(starterRef);
            const ledgerSnap = await tx.get(ledgerRefStarter);
            const limitSnap = await tx.get(starterLimitRef);
            starterUser = userSnap && userSnap.exists ? (userSnap.data() || {}) : null;
            const starterLedger = ledgerSnap && ledgerSnap.exists ? (ledgerSnap.data() || {}) : null;
            starterLimit = limitSnap && limitSnap.exists ? (limitSnap.data() || {}) : {};
            const starterBanned = !starterUser || blocked(starterUser, starterLedger, nowMs) === 'banned';
            if (!starterBanned && starterAwardsUsed(starterLimit, day) < STARTER_AWARDS_MAX) {
                starterNominal = roomFor(starterLimit, day, STARTER_XP);
            }
        }
    }

    const writes = [];
    let authorAwarded = 0;
    let starterAwarded = 0;
    if (authorNominal > 0 && o.authorRef) {
        const grant = await applyDailyXp(o.authorUid, authorNominal, tx, { day: day, userRef: o.authorRef, user: authorUser, now: nowMs });
        authorAwarded = grant.awarded;
        if (authorAwarded > 0) {
            writes.push({ ref: o.authorRef, data: pointsPatch(authorUser, authorAwarded) });
            writes.push({ ref: grant.dailyRef, data: { total: grant.dailyXp, lastUpdated: nowMs } });
            writes.push({
                ref: ledgerRef(o.authorRef, o.postId, o.isStart ? 'start' : 'reply'),
                data: ledgerData(o.authorUid, authorAwarded, o.isStart ? 'start' : 'reply', o.channelId, o.postId, day, nowMs, grant),
            });
        }
    }
    if (starterNominal > 0 && starterRef) {
        const grant = await applyDailyXp(starterUid, starterNominal, tx, { day: day, userRef: starterRef, user: starterUser, now: nowMs });
        starterAwarded = grant.awarded;
        if (starterAwarded > 0) {
            writes.push({ ref: starterRef, data: pointsPatch(starterUser, starterAwarded) });
            writes.push({ ref: grant.dailyRef, data: { total: grant.dailyXp, lastUpdated: nowMs } });
            writes.push({
                ref: ledgerRef(starterRef, o.postId, 'starter_reply'),
                data: ledgerData(starterUid, starterAwarded, 'starter_reply', o.channelId, o.postId, day, nowMs, grant),
            });
            const usedAwards = starterAwardsUsed(starterLimit, day);
            writes.push({
                ref: starterLimitRef,
                data: {
                    convoDayKey: day,
                    convoXp: convoUsed(starterLimit, day) + starterAwarded,
                    starterReplyDayKey: day,
                    starterReplyCount: usedAwards + 1,
                },
            });
        }
    }

    const authorLimitPatch = { recentTexts: recent };
    if (authorAwarded > 0) {
        authorLimitPatch.convoDayKey = day;
        authorLimitPatch.convoXp = convoUsed(authorLimit, day) + authorAwarded;
    }

    const postFields = {};
    if (authorAwarded > 0 || starterAwarded > 0) {
        postFields.xpAuthor = authorAwarded;
        postFields.xpStarter = starterAwarded;
        postFields.xpStarterUid = starterAwarded > 0 ? starterUid : '';
        postFields.xpAtMs = nowMs;
        postFields.xpDay = day;
        postFields.xpClawed = false;
    }

    return {
        awarded: authorAwarded,
        toast: toastFor(authorAwarded),
        authorAwarded: authorAwarded,
        starterAwarded: starterAwarded,
        starterUid: starterAwarded > 0 ? starterUid : '',
        day: day,
        nowMs: nowMs,
        reason: reason,
        authorLimitPatch: authorLimitPatch,
        postFields: postFields,
        writes: writes,
    };
}

function commitGrant(tx, grant) {
    const writes = grant && grant.writes ? grant.writes : [];
    writes.forEach(function(entry) {
        tx.set(entry.ref, entry.data, { merge: true });
    });
}

function clawEligible(post, nowMs) {
    if (!post || post.xpClawed === true) return false;
    const at = Number(post.xpAtMs) || 0;
    if (!at || (Number(nowMs) - at) > CLAWBACK_MS) return false;
    return (Number(post.xpAuthor) || 0) > 0 || (Number(post.xpStarter) || 0) > 0;
}

async function clawbackReads(tx, db, post, nowMs, postId, channelId) {
    if (!clawEligible(post, nowMs)) return null;
    const day = post.xpDay || '';
    const byUid = {};
    function add(uid, amount, kind) {
        if (!uid || amount <= 0 || uid === NACHO_UID) return;
        if (!byUid[uid]) byUid[uid] = { amount: 0, kinds: [] };
        byUid[uid].amount += amount;
        byUid[uid].kinds.push({ kind: kind, amount: amount });
    }
    add(post.uid, Number(post.xpAuthor) || 0, 'author');
    add(post.xpStarterUid, Number(post.xpStarter) || 0, 'starter_reply');
    const uids = Object.keys(byUid);
    const parties = [];
    for (let i = 0; i < uids.length; i++) {
        const uid = uids[i];
        const userRef = db.collection('users').doc(uid);
        const dailyRef = userRef.collection('daily_points').doc(day);
        const limitRef = db.collection('topic_discussion_limits').doc(uid);
        const userSnap = await tx.get(userRef);
        const dailySnap = await tx.get(dailyRef);
        const limitSnap = await tx.get(limitRef);
        parties.push({
            uid: uid,
            amount: byUid[uid].amount,
            kinds: byUid[uid].kinds,
            userRef: userRef,
            dailyRef: dailyRef,
            limitRef: limitRef,
            user: userSnap && userSnap.exists ? (userSnap.data() || {}) : {},
            daily: dailySnap && dailySnap.exists ? (dailySnap.data() || {}) : {},
            limit: limitSnap && limitSnap.exists ? (limitSnap.data() || {}) : {},
        });
    }
    return {
        day: day,
        nowMs: nowMs,
        postId: postId,
        channelId: channelId || post.channelId || '',
        parties: parties,
    };
}

function clawbackWrites(tx, spec) {
    if (!spec) return;
    spec.parties.forEach(function(party) {
        const user = party.user || {};
        const limit = party.limit || {};
        tx.set(party.userRef, {
            points: Math.max(0, (Number(user.points) || 0) - party.amount),
            weeklyXP: Math.max(0, (Number(user.weeklyXP) || 0) - party.amount),
            monthlyXP: Math.max(0, (Number(user.monthlyXP) || 0) - party.amount),
        }, { merge: true });
        const used = Number(party.daily.total) || 0;
        tx.set(party.dailyRef, {
            total: Math.max(0, used - party.amount),
            lastUpdated: spec.nowMs,
        }, { merge: true });
        const limitPatch = {};
        if (limit.convoDayKey === spec.day) {
            limitPatch.convoDayKey = spec.day;
            limitPatch.convoXp = Math.max(0, (Number(limit.convoXp) || 0) - party.amount);
        }
        const starterKind = party.kinds.some(function(item) { return item.kind === 'starter_reply'; });
        if (starterKind && limit.starterReplyDayKey === spec.day) {
            limitPatch.starterReplyDayKey = spec.day;
            limitPatch.starterReplyCount = Math.max(0, (Number(limit.starterReplyCount) || 0) - 1);
        }
        if (Object.keys(limitPatch).length) tx.set(party.limitRef, limitPatch, { merge: true });
        party.kinds.forEach(function(item) {
            tx.set(ledgerRef(party.userRef, spec.postId, item.kind + '_claw'), ledgerData(
                party.uid,
                -item.amount,
                'clawback',
                spec.channelId,
                spec.postId,
                spec.day,
                spec.nowMs
            ));
        });
    });
}

async function clawbackTopicPost(db, channelId, postId, nowMs) {
    if (!db || !channelId || !postId) return { clawed: false };
    const postRef = db.collection('topic_discussions').doc(channelId).collection('posts').doc(postId);
    let clawed = false;
    await db.runTransaction(async function(tx) {
        const snap = await tx.get(postRef);
        if (!snap.exists) return;
        const post = snap.data() || {};
        const spec = await clawbackReads(tx, db, post, nowMs, postId, channelId);
        if (!spec) return;
        tx.set(postRef, { xpClawed: true }, { merge: true });
        clawbackWrites(tx, spec);
        clawed = true;
    });
    return { clawed: clawed };
}

module.exports = {
    START_XP: START_XP,
    REPLY_XP: REPLY_XP,
    STARTER_XP: STARTER_XP,
    CONVO_DAILY_CAP: CONVO_DAILY_CAP,
    STARTER_AWARDS_MAX: STARTER_AWARDS_MAX,
    MIN_NON_WS: MIN_NON_WS,
    DUP_RATIO: DUP_RATIO,
    CLAWBACK_MS: CLAWBACK_MS,
    LEDGER_SOURCE: LEDGER_SOURCE,
    nonWhitespaceCount: nonWhitespaceCount,
    normalizeMessage: normalizeMessage,
    isNearDuplicate: isNearDuplicate,
    assessText: assessText,
    toastFor: toastFor,
    grantInTransaction: grantInTransaction,
    commitGrant: commitGrant,
    clawbackReads: clawbackReads,
    clawbackWrites: clawbackWrites,
    clawbackTopicPost: clawbackTopicPost,
};
