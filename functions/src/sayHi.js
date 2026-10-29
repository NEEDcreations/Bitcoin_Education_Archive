'use strict';

// Daily "say hi" reward. The client is hostile: it may only name a Global Chat
// message id. The day, the button press, the text, and the reward are all
// decided here. One claim per uid per server day, inside one transaction.

const { planXpGrant } = require('./grantXp');
const { rewardBlocked } = require('./cipherClaim');
const { grantFamily } = require('./grantBadge');
const dailyFive = require('./dailyFive');
const { offsetDateKey } = require('./offsetDay');

const SAY_HI_XP = 50;
const SAY_HI_TICKETS = 1;
// "hi" is the shortest real greeting this button asks for. One character is not.
const MIN_SAY_HI_CHARS = 2;
const MAX_SAY_HI_CHARS = 300;
// Firestore request.time and the arm timestamp can differ by a little.
const ARM_SKEW_MS = 15000;
const SAY_HI_RATE_MS = 3000;

function timestampMs(ts) {
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') {
        const ms = ts.toMillis();
        return Number.isFinite(ms) ? ms : 0;
    }
    if (typeof ts.toDate === 'function') {
        const d = ts.toDate();
        const ms = d && d.getTime ? d.getTime() : 0;
        return Number.isFinite(ms) ? ms : 0;
    }
    if (typeof ts === 'number' && Number.isFinite(ts)) return ts;
    if (typeof ts === 'string') {
        const parsed = Date.parse(ts);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    if (typeof ts === 'object') {
        const seconds = ts._seconds != null ? ts._seconds : ts.seconds;
        if (typeof seconds === 'number') {
            const nanos = ts._nanoseconds || ts.nanoseconds || 0;
            return seconds * 1000 + Math.floor(nanos / 1e6);
        }
    }
    return 0;
}

function normalizeSayHiText(raw) {
    return String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
}

// Letters, numbers, and non-ascii symbols (emoji). Ascii punctuation does not count.
function meaningfulLength(text) {
    const s = String(text || '');
    let n = 0;
    for (let i = 0; i < s.length;) {
        const cp = s.codePointAt(i);
        i += cp > 0xffff ? 2 : 1;
        if (cp <= 32) continue;
        if (cp < 127) {
            const ch = String.fromCharCode(cp);
            if (!/[A-Za-z0-9]/.test(ch)) continue;
        }
        n += 1;
    }
    return n;
}

function extractSayHiText(msg) {
    if (!msg || typeof msg !== 'object') return '';
    const text = normalizeSayHiText(msg.text);
    const caption = normalizeSayHiText(msg.caption);
    if (msg.isGif === true || /^https?:\/\//i.test(text)) return caption;
    return text;
}

// Chat replaces stripped URLs with this placeholder. A placeholder alone is not a hello.
function withoutRemovedLinks(text) {
    return normalizeSayHiText(String(text || '').replace(/\[link removed\]/gi, ' '));
}

function isSpamRepeat(text) {
    return /(.)\1{6,}/u.test(String(text || ''));
}

function isSayHiBlocked(user, ledger) {
    return rewardBlocked(user, ledger);
}

function planSayHiXp(dailyUsed, pendingOverflow, lastOverflowDate, today, ctx) {
    void pendingOverflow;
    void lastOverflowDate;
    void today;
    const extra = ctx || {};
    const split = planXpGrant({
        base: SAY_HI_XP,
        user: extra.user,
        now: extra.now,
        dailyUsed: Number(dailyUsed) || 0,
    });
    return {
        awarded: split.awarded,
        base: split.base,
        boosted: split.boosted,
        doubled: split.doubled === true,
        until: split.until || 0,
        dailyXp: split.dailyXp,
        overflowAdded: 0,
        overflowRedeemed: 0,
        pendingOverflow: 0,
        touchOverflow: false,
        tickets: SAY_HI_TICKETS,
    };
}

function fail(code) {
    return { ok: false, code: code, showToast: false };
}

function assessSayHiArm(input) {
    const src = input || {};
    if (!src.authed || src.anonymous) return fail('signed-out');
    if (src.rateLimited) return fail('rate');
    if (!src.userExists) return fail('no-profile');
    if (isSayHiBlocked(src.user, src.ledger)) return fail('unavailable');
    if (src.claimExists || (src.claimedDay && src.claimedDay === src.today)) {
        return { ok: true, code: 'already', alreadyClaimed: true, showToast: false };
    }
    if (src.armedDay === src.today && src.armedAtMs) {
        return { ok: true, code: 'armed', alreadyArmed: true, showToast: false };
    }
    return { ok: true, code: 'arm', showToast: false };
}

function assessSayHiClaim(input) {
    const src = input || {};
    if (!src.authed || src.anonymous) return fail('signed-out');
    if (src.rateLimited) return fail('rate');
    if (!src.userExists) return fail('no-profile');
    if (isSayHiBlocked(src.user, src.ledger)) return fail('unavailable');
    if (src.claimExists || (src.claimedDay && src.claimedDay === src.today)) {
        return { ok: false, code: 'already', alreadyClaimed: true, showToast: false };
    }
    if (!src.armedDay || src.armedDay !== src.today || !src.armedAtMs) return fail('no-arm');
    if (offsetDateKey(src.armedAtMs) !== src.today) return fail('no-arm');

    const msg = src.message;
    if (!msg) return fail('no-message');
    if (!src.uid || msg.uid !== src.uid) return fail('not-owner');
    if (msg.isNachoAuto === true || msg.isSystemPost === true || msg.uid === 'nacho-bot' || msg.uid === 'system' || msg.source === 'telegram') {
        return fail('not-real');
    }
    if (src.claimedMessageId && src.messageId && src.claimedMessageId === src.messageId) {
        return fail('duplicate');
    }

    const text = withoutRemovedLinks(extractSayHiText(msg));
    if (!text || !/\S/.test(text)) return fail('empty');
    if (isSpamRepeat(text)) return fail('short');
    const textLength = meaningfulLength(text);
    if (textLength < MIN_SAY_HI_CHARS || text.length > MAX_SAY_HI_CHARS) return fail('short');

    const messageMs = Number(src.messageMs) || 0;
    const nowMs = Number(src.nowMs) || 0;
    if (!messageMs) return fail('no-time');
    if (offsetDateKey(messageMs) !== src.today) return fail('not-today');
    if (messageMs + ARM_SKEW_MS < src.armedAtMs) return fail('before-press');
    if (nowMs && messageMs > nowMs + ARM_SKEW_MS) return fail('no-time');

    const xp = planSayHiXp(src.dailyUsed, src.pendingOverflow, src.lastOverflowDate, src.today, {
        user: src.user,
        now: src.nowMs,
    });
    return {
        ok: true,
        code: 'ok',
        showToast: src.toastSeen !== true,
        textLength: textLength,
        xp: xp,
    };
}

function validMessageId(id) {
    return typeof id === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(id);
}

function createSayHiHandlers(opts) {
    const admin = opts.admin;
    const db = opts.db;
    const now = opts.now || function () { return Date.now(); };
    const HttpsError = opts.HttpsError;

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

    function rateLimited(snap, nowMs, field) {
        if (!snap || !snap.exists) return false;
        const data = snap.data() || {};
        const last = timestampMs(data[field]);
        return !!(last && (nowMs - last) < SAY_HI_RATE_MS);
    }

    async function readCommon(tx, uid, nowMs) {
        const today = offsetDateKey(nowMs);
        const userRef = db.collection('users').doc(uid);
        const ledgerRef = db.collection('faucet_ledger').doc(uid);
        const rateRef = db.collection('rate_limits').doc('sayhi_' + uid);
        const claimRef = userRef.collection('daily_action_counts').doc(today + '_say_hi');
        const dailyRef = userRef.collection('daily_points').doc(today);
        const userSnap = await tx.get(userRef);
        const ledgerSnap = await tx.get(ledgerRef);
        const rateSnap = await tx.get(rateRef);
        const claimSnap = await tx.get(claimRef);
        const dailySnap = await tx.get(dailyRef);
        const user = userSnap.exists ? (userSnap.data() || {}) : {};
        return {
            today: today,
            userRef: userRef,
            rateRef: rateRef,
            claimRef: claimRef,
            dailyRef: dailyRef,
            userSnap: userSnap,
            user: user,
            ledger: ledgerSnap.exists ? (ledgerSnap.data() || {}) : {},
            rateSnap: rateSnap,
            claimSnap: claimSnap,
            dailyUsed: dailySnap.exists ? ((dailySnap.data() || {}).total || 0) : 0,
        };
    }

    function stampRate(tx, rateRef, field) {
        const patch = {};
        // Arm and claim are limited separately so a real hello can follow the button press.
        patch[field] = admin.firestore.FieldValue.serverTimestamp();
        tx.set(rateRef, patch, { merge: true });
    }

    const armSayHi = async function (data, context) {
        const auth = authState(context);
        if (!auth.authed || auth.anonymous) signedOut();
        const uid = auth.uid;
        const nowMs = now();

        const result = await db.runTransaction(async function (tx) {
            const bag = await readCommon(tx, uid, nowMs);
            const decision = assessSayHiArm({
                authed: true,
                anonymous: false,
                rateLimited: rateLimited(bag.rateSnap, nowMs, 'lastArm'),
                userExists: bag.userSnap.exists,
                user: bag.user,
                ledger: bag.ledger,
                claimExists: bag.claimSnap.exists,
                claimedDay: bag.user.sayHiClaimedDay || '',
                armedDay: bag.user.sayHiArmedDay || '',
                armedAtMs: timestampMs(bag.user.sayHiArmedAt),
                today: bag.today,
            });
            if (decision.code === 'rate') return decision;
            stampRate(tx, bag.rateRef, 'lastArm');
            if (!decision.ok) return decision;
            if (decision.alreadyClaimed || decision.alreadyArmed) {
                return { ok: true, code: decision.code, alreadyClaimed: !!decision.alreadyClaimed, day: bag.today, showToast: false };
            }
            tx.update(bag.userRef, {
                sayHiArmedDay: bag.today,
                sayHiArmedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { ok: true, code: 'armed', day: bag.today, showToast: false };
        });

        if (result.code === 'signed-out') signedOut();
        return {
            success: !!result.ok,
            code: result.code,
            alreadyClaimed: !!result.alreadyClaimed,
            day: result.day || offsetDateKey(nowMs),
            showToast: false,
        };
    };

    const claimSayHi = async function (data, context) {
        const auth = authState(context);
        if (!auth.authed || auth.anonymous) signedOut();
        const uid = auth.uid;
        // The only client input. Day, text, XP, and "I pressed the button" are ignored.
        const messageId = data && typeof data.messageId === 'string' ? data.messageId : '';
        if (!validMessageId(messageId)) {
            return { success: false, code: 'no-message', showToast: false };
        }
        const nowMs = now();
        const msgRef = db.collection('global_chat').doc(messageId);

        const result = await db.runTransaction(async function (tx) {
            const bag = await readCommon(tx, uid, nowMs);
            const msgSnap = await tx.get(msgRef);
            const msg = msgSnap.exists ? (msgSnap.data() || {}) : null;
            const decision = assessSayHiClaim({
                authed: true,
                anonymous: false,
                rateLimited: rateLimited(bag.rateSnap, nowMs, 'lastClaim'),
                userExists: bag.userSnap.exists,
                user: bag.user,
                ledger: bag.ledger,
                claimExists: bag.claimSnap.exists,
                claimedDay: bag.user.sayHiClaimedDay || '',
                claimedMessageId: bag.user.sayHiClaimedMessageId || '',
                armedDay: bag.user.sayHiArmedDay || '',
                armedAtMs: timestampMs(bag.user.sayHiArmedAt),
                toastSeen: bag.user.sayHiToastSeen === true,
                today: bag.today,
                uid: uid,
                messageId: messageId,
                message: msg,
                messageMs: msg ? timestampMs(msg.ts) : 0,
                nowMs: nowMs,
                dailyUsed: bag.dailyUsed,
                pendingOverflow: bag.user.pendingOverflow || 0,
                lastOverflowDate: bag.user.lastOverflowDate || '',
            });
            if (decision.code === 'rate') return decision;
            stampRate(tx, bag.rateRef, 'lastClaim');
            if (decision.alreadyClaimed) {
                return { ok: true, code: 'already', alreadyClaimed: true, day: bag.today, showToast: false };
            }
            if (!decision.ok) return decision;

            const xp = decision.xp;
            const userUpdate = {
                sayHiClaimedDay: bag.today,
                sayHiClaimedMessageId: messageId,
                sayHiToastSeen: true,
                sayHiDays: admin.firestore.FieldValue.increment(1),
                orangeTickets: admin.firestore.FieldValue.increment(xp.tickets),
            };
            if (xp.awarded > 0) {
                userUpdate.points = admin.firestore.FieldValue.increment(xp.awarded);
                userUpdate.weeklyXP = admin.firestore.FieldValue.increment(xp.awarded);
                userUpdate.monthlyXP = admin.firestore.FieldValue.increment(xp.awarded);
            }
            tx.update(bag.userRef, userUpdate);
            if (xp.awarded > 0) {
                tx.set(bag.dailyRef, {
                    total: (Number(bag.dailyUsed) || 0) + xp.awarded,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
            tx.set(bag.claimRef, {
                uid: uid,
                messageId: messageId,
                textLength: decision.textLength,
                day: bag.today,
                at: admin.firestore.FieldValue.serverTimestamp(),
                base: xp.base || 0,
                boosted: xp.boosted || 0,
                doubled: xp.doubled === true,
                awarded: xp.awarded,
            });
            const { ledgerData: xpLedgerData, ledgerRefFor } = require('./grantXp');
            tx.set(ledgerRefFor(bag.userRef, 'sayhi_' + bag.today), xpLedgerData(xp, {
                source: 'say_hi',
                day: bag.today,
                uid: uid,
            }));
            return {
                ok: true,
                code: 'ok',
                showToast: decision.showToast === true,
                day: bag.today,
                xpAwarded: xp.awarded,
                doubled: xp.doubled === true,
                overflowRedeemed: xp.overflowRedeemed,
                tickets: xp.tickets,
            };
        });

        if (result.code === 'ok') {
            try {
                await grantFamily(db, admin, uid, ['say_hi_1', 'say_hi_7', 'say_hi_30', 'say_hi_100']);
            } catch (grantErr) {
                console.warn('[sayHi] badge grant skipped', grantErr && grantErr.message);
            }
            try {
                await dailyFive.maybeCompleteDailyFive({ db: db, admin: admin, uid: uid, day: result.day });
            } catch (fiveErr) {
                console.warn('[sayHi] daily five skipped', fiveErr && fiveErr.message);
            }
            try {
                await require('./raidBossEngine').noteTrusted(db, admin, {
                    metric: 'sayHi',
                    uid: uid,
                    dedupeKey: 'sayhi-' + uid + '-' + (result.day || ''),
                    amount: 1,
                    now: new Date(nowMs),
                });
            } catch (raidErr) {
                console.warn('[sayHi] raid', raidErr && raidErr.message);
            }
        }
        if (result.code === 'signed-out') signedOut();
        return {
            success: result.code === 'ok' || result.alreadyClaimed === true,
            code: result.code,
            alreadyClaimed: !!result.alreadyClaimed,
            showToast: result.showToast === true,
            day: result.day || offsetDateKey(nowMs),
            xpAwarded: result.xpAwarded || 0,
            doubled: result.doubled === true,
            overflowRedeemed: result.overflowRedeemed || 0,
            tickets: result.code === 'ok' ? (result.tickets || 0) : 0,
        };
    };

    return { armSayHi: armSayHi, claimSayHi: claimSayHi };
}

function bindSayHi(functionsV1, admin, db) {
    const handlers = createSayHiHandlers({
        admin: admin,
        db: db,
        HttpsError: functionsV1.https.HttpsError,
    });
    // Same App Check gate as claimSats: the callable is rejected without a valid token.
    const opts = { enforceAppCheck: true };
    return {
        armSayHi: functionsV1.runWith(opts).https.onCall(handlers.armSayHi),
        claimSayHi: functionsV1.runWith(opts).https.onCall(handlers.claimSayHi),
    };
}

module.exports = {
    SAY_HI_XP: SAY_HI_XP,
    SAY_HI_TICKETS: SAY_HI_TICKETS,
    MIN_SAY_HI_CHARS: MIN_SAY_HI_CHARS,
    SAY_HI_RATE_MS: SAY_HI_RATE_MS,
    offsetDateKey: offsetDateKey,
    timestampMs: timestampMs,
    normalizeSayHiText: normalizeSayHiText,
    meaningfulLength: meaningfulLength,
    extractSayHiText: extractSayHiText,
    withoutRemovedLinks: withoutRemovedLinks,
    isSpamRepeat: isSpamRepeat,
    isSayHiBlocked: isSayHiBlocked,
    planSayHiXp: planSayHiXp,
    assessSayHiArm: assessSayHiArm,
    assessSayHiClaim: assessSayHiClaim,
    validMessageId: validMessageId,
    createSayHiHandlers: createSayHiHandlers,
    bindSayHi: bindSayHi,
};
