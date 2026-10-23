'use strict';

// Hidden Global Chat reply bonus. The client is hostile: it may only name
// the new message id. The server reads that global_chat doc, checks the
// reply, and decides the XP. First reward is 50, every later one is 25.
//
// Text checks are the Say hi helpers (meaningful length, link placeholder,
// repeated-character spam). Account age comes from the Auth record's
// metadata.creationTime, which the client cannot set. A missing time, an
// account under a day old, a missing linked provider, a banned replier, or
// a banned original author gets nothing.

const { planDailyXp } = require('./dailyXp');
const { applyDailyXp } = require('./applyDailyXp');
const {
    timestampMs,
    offsetDateKey,
    meaningfulLength,
    extractSayHiText,
    withoutRemovedLinks,
    isSpamRepeat,
    validMessageId,
    isSayHiBlocked,
    MIN_SAY_HI_CHARS,
} = require('./sayHi');
const rewardNotify = require('./rewardNotify');

const FIRST_REPLY_XP = 50;
const LATER_REPLY_XP = 25;
const COOLDOWN_MS = 5 * 60 * 1000;
const PAIR_WINDOW_MS = 60 * 60 * 1000;
const DAILY_REPLY_CAP = 10;
const MAX_AGE_MS = 2 * 60 * 1000;
const CLOCK_SKEW_MS = 15 * 1000;
const CALL_RATE_MS = 3000;
const MAX_TEXT_CHARS = 300;
const MIN_ACCOUNT_AGE_MS = 24 * 60 * 60 * 1000;

function validUid(id) {
    return typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);
}

function isMirrorOrBot(msg) {
    if (!msg || typeof msg !== 'object') return true;
    if (msg.isNachoAuto === true || msg.isSystemPost === true) return true;
    if (msg.source === 'telegram') return true;
    const id = msg.uid;
    if (!validUid(id)) return true;
    if (id === 'nacho' || id === 'nacho-bot' || id === 'nacho-dj' || id === 'system' || id === 'telegram' || id === 'bot') {
        return true;
    }
    if (id.indexOf('tg_') === 0) return true;
    return false;
}

function pairDocId(replierUid, targetUid) {
    return 'p_' + replierUid + '__' + targetUid;
}

function noticeId(messageId) {
    return 'rx_' + messageId;
}

function replyToastText(xp, first) {
    const n = Math.round(Number(xp));
    if (!Number.isFinite(n) || n <= 0) return '';
    if (first === true) return '💬 +' + n + ' XP for joining the conversation!';
    return '+' + n + ' XP';
}

// Admin UserRecord.metadata.creationTime is a UTC date string. Missing,
// blank, and unparsable values refuse the bonus.
function authCreatedMs(record) {
    const meta = record && record.metadata;
    const raw = meta && meta.creationTime;
    if (raw == null || raw === '') return null;
    if (raw instanceof Date) {
        const ms = raw.getTime();
        return Number.isFinite(ms) && ms > 0 ? ms : null;
    }
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
    if (typeof raw === 'string') {
        const parsed = Date.parse(raw);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }
    const ms = timestampMs(raw);
    return ms > 0 ? ms : null;
}

function authAccountTooNew(createdMs, nowMs) {
    const created = Number(createdMs);
    if (!Number.isFinite(created) || created <= 0) return true;
    return (Number(nowMs) - created) < MIN_ACCOUNT_AGE_MS;
}

function fail(code) {
    return { ok: false, code: code, xp: 0, first: false, showToast: false };
}

function assessReplyBonus(input) {
    const src = input || {};
    if (!src.authed || src.anonymous) return fail('signed-out');
    if (!src.userExists) return fail('no-profile');
    if (isSayHiBlocked(src.user, src.ledger)) return fail('unavailable');

    const msg = src.message;
    if (!msg) return fail('no-message');
    if (!src.uid || msg.uid !== src.uid) return fail('not-owner');
    if (isMirrorOrBot(msg)) return fail('not-real');
    if (src.claimExists && src.claimUid === src.uid) {
        return { ok: true, code: 'already', xp: 0, first: false, showToast: false };
    }
    if (src.claimExists) return fail('not-owner');

    // Alt gate: anonymous profile, no linked Auth provider, or Auth account
    // missing / under a day old. Checked after the idempotent claim so a
    // retry of a granted message stays 'already'. The profile created field
    // is ignored.
    if (src.user && src.user.isAnonymous === true) return fail('unavailable');
    if (src.linkedProvider !== true) return fail('unavailable');
    if (authAccountTooNew(src.authCreatedMs, src.nowMs)) return fail('unavailable');

    if (src.rateLimited) return fail('rate');

    const replyTo = typeof msg.replyTo === 'string' ? msg.replyTo : '';
    if (!validMessageId(replyTo) || replyTo === src.messageId) return fail('not-reply');
    const parent = src.parent;
    if (!parent) return fail('not-reply');
    if (isMirrorOrBot(parent)) return fail('bot');
    if (!src.uid || parent.uid === src.uid) return fail('self');
    if (src.authorBanned === true) return fail('unavailable');

    const text = withoutRemovedLinks(extractSayHiText(msg));
    if (!text || !/\S/.test(text)) return fail('empty');
    if (isSpamRepeat(text)) return fail('short');
    if (meaningfulLength(text) < MIN_SAY_HI_CHARS || text.length > MAX_TEXT_CHARS) return fail('short');

    const messageMs = Number(src.messageMs) || 0;
    const nowMs = Number(src.nowMs) || 0;
    if (!messageMs || !nowMs) return fail('old');
    if (messageMs > nowMs + CLOCK_SKEW_MS) return fail('old');
    if (nowMs - messageMs > MAX_AGE_MS) return fail('old');

    const lastRewardMs = Number(src.lastRewardMs) || 0;
    if (lastRewardMs && (nowMs - lastRewardMs) < COOLDOWN_MS) return fail('cooldown');
    const pairLastMs = Number(src.pairLastMs) || 0;
    if (pairLastMs && (nowMs - pairLastMs) < PAIR_WINDOW_MS) return fail('pair');
    const dailyCount = Number(src.dailyCount) || 0;
    if (dailyCount >= DAILY_REPLY_CAP) return fail('daily');

    const first = src.firstClaimed !== true;
    const nominal = first ? FIRST_REPLY_XP : LATER_REPLY_XP;
    const split = planDailyXp(Number(src.dailyUsed) || 0, nominal);
    return {
        ok: true,
        code: 'ok',
        xp: split.awarded,
        nominal: nominal,
        first: first,
        showToast: split.awarded > 0,
        overflowAdded: split.overflowAdded,
        targetUid: parent.uid,
        replyTo: replyTo,
    };
}

// Auth lookup stays outside the Firestore transaction. One getUser read
// supplies both providerData and metadata.creationTime. Empty providerData,
// a missing creation time, a missing Auth user, and any lookup error fail closed.
async function readAuthAccount(admin, uid, getAuthUser) {
    const closed = { linked: false, createdMs: null };
    let getUser = typeof getAuthUser === 'function' ? getAuthUser : null;
    if (!getUser && admin && typeof admin.auth === 'function') {
        const authApi = admin.auth();
        if (authApi && typeof authApi.getUser === 'function') {
            getUser = function (id) { return authApi.getUser(id); };
        }
    }
    if (!getUser) return closed;
    try {
        const record = await getUser(uid);
        const providers = record && record.providerData;
        return {
            linked: !!(providers && providers.length),
            createdMs: authCreatedMs(record),
        };
    } catch (err) {
        return closed;
    }
}

function createReplyBonusHandlers(opts) {
    const admin = opts.admin;
    const db = opts.db;
    const now = opts.now || function () { return Date.now(); };
    const HttpsError = opts.HttpsError;
    const getAuthUser = opts.getAuthUser;

    function signedOut() {
        throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    function authState(context) {
        if (!context || !context.auth || !context.auth.uid) return { authed: false, anonymous: false, uid: '' };
        const provider = context.auth.token
            && context.auth.token.firebase
            && context.auth.token.firebase.sign_in_provider;
        return {
            authed: true,
            anonymous: provider === 'anonymous',
            uid: context.auth.uid,
        };
    }

    function publicResult(result) {
        const code = result && result.code ? result.code : 'no-message';
        const xp = code === 'ok' ? (Math.round(Number(result.xp)) || 0) : 0;
        return {
            success: code === 'ok' || code === 'already',
            code: code,
            xp: xp,
            first: code === 'ok' && result.first === true,
            showToast: code === 'ok' && result.showToast === true && xp > 0,
        };
    }

    const claimReplyBonus = async function (data, context) {
        const auth = authState(context);
        if (!auth.authed || auth.anonymous) signedOut();
        const uid = auth.uid;
        // The only client input. XP, first-flag, text, and replyTo are ignored.
        const messageId = data && typeof data.messageId === 'string' ? data.messageId : '';
        if (!validMessageId(messageId)) return publicResult(fail('no-message'));
        const nowMs = now();
        const account = await readAuthAccount(admin, uid, getAuthUser);

        const result = await db.runTransaction(async function (tx) {
            const today = offsetDateKey(nowMs);
            const userRef = db.collection('users').doc(uid);
            const ledgerRef = db.collection('faucet_ledger').doc(uid);
            const rateRef = db.collection('rate_limits').doc('reply_' + uid);
            const claimRef = db.collection('reply_bonus_claims').doc(messageId);
            const stateRef = db.collection('reply_bonus_state').doc(uid);
            const dailyRef = userRef.collection('daily_points').doc(today);
            const countRef = userRef.collection('daily_action_counts').doc(today + '_reply_bonus');
            const msgRef = db.collection('global_chat').doc(messageId);

            const userSnap = await tx.get(userRef);
            const ledgerSnap = await tx.get(ledgerRef);
            const rateSnap = await tx.get(rateRef);
            const claimSnap = await tx.get(claimRef);
            const stateSnap = await tx.get(stateRef);
            const dailySnap = await tx.get(dailyRef);
            const countSnap = await tx.get(countRef);
            const msgSnap = await tx.get(msgRef);

            const user = userSnap.exists ? (userSnap.data() || {}) : {};
            const ledger = ledgerSnap.exists ? (ledgerSnap.data() || {}) : {};
            const rate = rateSnap.exists ? (rateSnap.data() || {}) : {};
            const claim = claimSnap.exists ? (claimSnap.data() || {}) : null;
            const state = stateSnap.exists ? (stateSnap.data() || {}) : {};
            const msg = msgSnap.exists ? (msgSnap.data() || {}) : null;
            const replyTo = msg && typeof msg.replyTo === 'string' ? msg.replyTo : '';
            const replyToOk = validMessageId(replyTo) && replyTo !== messageId;
            const parentSnap = replyToOk ? await tx.get(db.collection('global_chat').doc(replyTo)) : null;
            const parent = parentSnap && parentSnap.exists ? (parentSnap.data() || {}) : null;
            const targetUid = parent && typeof parent.uid === 'string' ? parent.uid : '';
            const canPair = !!parent && !isMirrorOrBot(parent) && validUid(targetUid) && targetUid !== uid;
            const pairRef = canPair ? db.collection('reply_bonus_pairs').doc(pairDocId(uid, targetUid)) : null;
            const pairSnap = pairRef ? await tx.get(pairRef) : null;
            const pair = pairSnap && pairSnap.exists ? (pairSnap.data() || {}) : null;
            let authorBanned = false;
            if (canPair) {
                const authorSnap = await tx.get(db.collection('users').doc(targetUid));
                const authorLedgerSnap = await tx.get(db.collection('faucet_ledger').doc(targetUid));
                authorBanned = isSayHiBlocked(
                    authorSnap.exists ? (authorSnap.data() || {}) : {},
                    authorLedgerSnap.exists ? (authorLedgerSnap.data() || {}) : {}
                );
            }
            const lastCallMs = timestampMs(rate.lastCall);
            const dailyCount = countSnap.exists ? (Number((countSnap.data() || {}).count) || 0) : 0;

            const decision = assessReplyBonus({
                authed: true,
                anonymous: false,
                userExists: userSnap.exists,
                user: user,
                ledger: ledger,
                linkedProvider: account.linked,
                authCreatedMs: account.createdMs,
                authorBanned: authorBanned,
                claimExists: !!claim,
                claimUid: claim ? (claim.uid || '') : '',
                rateLimited: !!(lastCallMs && (nowMs - lastCallMs) < CALL_RATE_MS),
                message: msg,
                messageMs: msg ? timestampMs(msg.ts) : 0,
                nowMs: nowMs,
                messageId: messageId,
                uid: uid,
                parent: parent,
                lastRewardMs: timestampMs(rate.lastReward),
                pairLastMs: pair ? timestampMs(pair.at) : 0,
                dailyCount: dailyCount,
                firstClaimed: state.firstClaimed === true,
                dailyUsed: dailySnap.exists ? (Number((dailySnap.data() || {}).total) || 0) : 0,
            });

            if (decision.code === 'already' || decision.code === 'rate') return decision;
            if (decision.ok && !pairRef) return fail('not-reply');
            if (decision.ok) {
                const grant = await applyDailyXp(uid, decision.nominal, tx, { day: today, userRef: userRef });
                decision.xp = grant.awarded;
                decision.dailyXp = grant.dailyXp;
                decision.dailyRef = grant.dailyRef;
                decision.showToast = grant.awarded > 0;
            }

            let rankPrev = {};
            if (decision.ok && decision.xp > 0) {
                rankPrev = await rewardNotify.readRankPrev(tx, db, uid, Number(user.points) || 0, decision.xp);
            }

            const ts = admin.firestore.FieldValue.serverTimestamp();
            tx.set(rateRef, decision.ok ? { lastCall: ts, lastReward: ts } : { lastCall: ts }, { merge: true });
            if (!decision.ok) return decision;

            const userUpdate = {};
            if (decision.xp > 0) {
                userUpdate.points = admin.firestore.FieldValue.increment(decision.xp);
                userUpdate.weeklyXP = admin.firestore.FieldValue.increment(decision.xp);
                userUpdate.monthlyXP = admin.firestore.FieldValue.increment(decision.xp);
                tx.set(decision.dailyRef, {
                    total: decision.dailyXp,
                    lastUpdated: ts,
                }, { merge: true });
            }
            userUpdate.replyBonusCount = admin.firestore.FieldValue.increment(1);
            if (Object.keys(userUpdate).length) tx.update(userRef, userUpdate);

            tx.set(stateRef, { firstClaimed: true, uid: uid }, { merge: true });
            tx.set(claimRef, {
                uid: uid,
                messageId: messageId,
                replyTo: decision.replyTo,
                targetUid: decision.targetUid,
                xp: decision.xp,
                first: decision.first === true,
                at: ts,
            });
            tx.set(pairRef, {
                replierUid: uid,
                targetUid: decision.targetUid,
                at: ts,
            }, { merge: true });
            tx.set(countRef, {
                count: dailyCount + 1,
                lastAt: ts,
            }, { merge: true });

            if (decision.xp > 0) {
                const plans = rewardNotify.plan({
                    uid: uid,
                    pointsBefore: Number(user.points) || 0,
                    pointsDelta: decision.xp,
                    prevById: rankPrev,
                });
                plans.push({
                    id: noticeId(messageId),
                    grouped: false,
                    prev: null,
                    data: {
                        recipientId: uid,
                        senderId: 'system',
                        senderName: 'Bitcoin Quest',
                        type: 'reward',
                        message: replyToastText(decision.xp, decision.first === true),
                        targetType: null,
                        targetId: null,
                        read: false,
                        source: 'reply_bonus',
                        xp: decision.xp,
                        tickets: 0,
                        sats: 0,
                        freezes: 0,
                        count: 1,
                        icon: '💬',
                        badgeId: null,
                        badgeName: null,
                    },
                });
                rewardNotify.apply(tx, db, ts, plans);
            }
            return decision;
        });

        if (result && result.ok) {
            try {
                const grantBadge = require('./grantBadge');
                await grantBadge.grantFamily(db, admin, uid, grantBadge.familyFor('replyBonusCount'));
            } catch (err) {
                console.warn('[replyBonus] badges', err && err.message);
            }
        }
        if (result && result.code === 'signed-out') signedOut();
        return publicResult(result);
    };

    return { claimReplyBonus: claimReplyBonus };
}

function bindReplyBonus(functionsV1, admin, db) {
    const handlers = createReplyBonusHandlers({
        admin: admin,
        db: db,
        HttpsError: functionsV1.https.HttpsError,
    });
    // Same App Check gate as claimSats: the callable is rejected without a valid token.
    const opts = { enforceAppCheck: true };
    return {
        claimReplyBonus: functionsV1.runWith(opts).https.onCall(handlers.claimReplyBonus),
    };
}

module.exports = {
    FIRST_REPLY_XP: FIRST_REPLY_XP,
    LATER_REPLY_XP: LATER_REPLY_XP,
    COOLDOWN_MS: COOLDOWN_MS,
    PAIR_WINDOW_MS: PAIR_WINDOW_MS,
    DAILY_REPLY_CAP: DAILY_REPLY_CAP,
    MAX_AGE_MS: MAX_AGE_MS,
    MIN_ACCOUNT_AGE_MS: MIN_ACCOUNT_AGE_MS,
    validMessageId: validMessageId,
    isMirrorOrBot: isMirrorOrBot,
    pairDocId: pairDocId,
    noticeId: noticeId,
    replyToastText: replyToastText,
    authCreatedMs: authCreatedMs,
    authAccountTooNew: authAccountTooNew,
    assessReplyBonus: assessReplyBonus,
    readAuthAccount: readAuthAccount,
    createReplyBonusHandlers: createReplyBonusHandlers,
    bindReplyBonus: bindReplyBonus,
};
