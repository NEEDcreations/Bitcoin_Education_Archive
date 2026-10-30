'use strict';

// 🎉 on an earned GGs post. The client is hostile: auth, a ban check, an
// earned-post check, and a per-user rate limit all happen here. One marker
// per player lives at announcements/{postId}/reactions/{uid}. The public
// count is partyCount on the post. This grants no XP, sats, tickets, or badges.

const POSTS = 'announcements';
const COUNTER_FIELD = 'partyCount';
const RATE_COLLECTION = 'rate_limits';
const RATE_PREFIX = 'ggreact_';
const WINDOW_MS = 60 * 1000;
const MAX_TOGGLES = 30;
const POST_ID_RE = /^[A-Za-z0-9_-]{1,200}$/;
const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;

const EARNED_KIND = {
    badge: 1,
    achievement: 1,
    levelup: 1,
    'level-up': 1,
    level_up: 1,
    earned: 1,
};

function HttpError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

function isEarnedGgPost(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.deleted === true || data.hidden === true || data.uid === 'deleted') return false;
    const kind = String(data.ggKind || data.earnedKind || '').toLowerCase();
    if (EARNED_KIND[kind]) return true;
    if (data.postedByUid === 'badge-gg' && data.uid === 'nacho-bot') return true;
    if (data.uid === 'nacho-bot' && Array.isArray(data.badgeIds) && data.badgeIds.length > 0) return true;
    const auto = data.isNachoAuto === true || data.uid === 'nacho-bot' || data.uid === 'system';
    if (!auto) return false;
    const text = String(data.text || '');
    if (/\bearned\b/i.test(text)) return true;
    if (/\blevel(?:ed)?[\s-]?up\b/i.test(text)) return true;
    if (/\bachievement\b/i.test(text)) return true;
    if (/\bbadges?\b/i.test(text)) return true;
    if (/\baced\b/i.test(text)) return true;
    if (/\btrifecta\b/i.test(text)) return true;
    return false;
}

function countOf(data) {
    const n = Number(data && data[COUNTER_FIELD]);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.floor(n);
}

function isBannedAccount(user, ledger) {
    const u = user || {};
    const l = ledger || {};
    if (u.banned === true) return true;
    if (u.ban_reason) return true;
    if (l.banned === true) return true;
    return false;
}

function rateDocId(uid) {
    return RATE_PREFIX + String(uid || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120);
}

function authFailure(context, Err) {
    if (!context || !context.auth || !context.auth.uid) {
        return new Err('unauthenticated', 'Sign in required.');
    }
    const token = context.auth.token || {};
    const firebaseToken = token.firebase || {};
    if (firebaseToken.sign_in_provider === 'anonymous') {
        return new Err('permission-denied', 'Sign in required.');
    }
    if (!UID_RE.test(context.auth.uid)) {
        return new Err('permission-denied', 'Sign in required.');
    }
    return null;
}

function snapData(snap) {
    if (!snap || snap.exists !== true) return null;
    return snap.data() || {};
}

async function toggleGgReaction(db, data, context, nowMs, HttpsError) {
    const Err = HttpsError || HttpError;
    const denied = authFailure(context, Err);
    if (denied) throw denied;
    const postId = data && typeof data.postId === 'string' ? data.postId : '';
    if (!POST_ID_RE.test(postId)) throw new Err('invalid-argument', 'Invalid post.');
    const uid = context.auth.uid;
    const now = Number(nowMs) || Date.now();
    const postRef = db.collection(POSTS).doc(postId);
    const markerRef = postRef.collection('reactions').doc(uid);
    const userRef = db.collection('users').doc(uid);
    const ledgerRef = db.collection('faucet_ledger').doc(uid);
    const rateRef = db.collection(RATE_COLLECTION).doc(rateDocId(uid));

    const outcome = await db.runTransaction(async function (tx) {
        const postSnap = await tx.get(postRef);
        const markerSnap = await tx.get(markerRef);
        const userSnap = await tx.get(userRef);
        const ledgerSnap = await tx.get(ledgerRef);
        const rateSnap = await tx.get(rateRef);

        const rate = snapData(rateSnap) || {};
        let windowStart = Number(rate.windowStartMs) || 0;
        let used = Number(rate.count) || 0;
        if (!windowStart || now - windowStart >= WINDOW_MS) {
            windowStart = now;
            used = 0;
        }
        if (used >= MAX_TOGGLES) {
            throw new Err('resource-exhausted', 'Too many reactions. Try again in a minute.');
        }
        const nextRate = { windowStartMs: windowStart, count: used + 1 };

        if (isBannedAccount(snapData(userSnap), snapData(ledgerSnap))) {
            tx.set(rateRef, nextRate);
            return { error: 'permission-denied', message: 'Reactions are unavailable.' };
        }
        const post = snapData(postSnap);
        if (!post) {
            tx.set(rateRef, nextRate);
            return { error: 'not-found', message: 'Post not found.' };
        }
        if (!isEarnedGgPost(post)) {
            tx.set(rateRef, nextRate);
            return { error: 'failed-precondition', message: 'This post cannot be celebrated.' };
        }

        const had = !!(markerSnap && markerSnap.exists);
        const next = had ? Math.max(0, countOf(post) - 1) : countOf(post) + 1;
        if (had) tx.delete(markerRef);
        else tx.set(markerRef, { uid: uid, at: now });
        const patch = {};
        patch[COUNTER_FIELD] = next;
        tx.update(postRef, patch);
        tx.set(rateRef, nextRate);
        return { reacted: !had, count: next };
    });

    if (outcome && outcome.error) throw new Err(outcome.error, outcome.message);
    return { reacted: !!(outcome && outcome.reacted), count: outcome.count };
}

function bindToggleGgReaction(functionsV1, deps) {
    const db = deps && deps.db;
    const HttpsError = functionsV1 && functionsV1.https && functionsV1.https.HttpsError;
    const opts = { enforceAppCheck: true };
    return {
        toggleGgReaction: functionsV1.runWith(opts).https.onCall(function (data, context) {
            return toggleGgReaction(db, data, context, Date.now(), HttpsError);
        }),
    };
}

module.exports = {
    POSTS: POSTS,
    COUNTER_FIELD: COUNTER_FIELD,
    MAX_TOGGLES: MAX_TOGGLES,
    WINDOW_MS: WINDOW_MS,
    isEarnedGgPost: isEarnedGgPost,
    countOf: countOf,
    isBannedAccount: isBannedAccount,
    rateDocId: rateDocId,
    toggleGgReaction: toggleGgReaction,
    bindToggleGgReaction: bindToggleGgReaction,
};
