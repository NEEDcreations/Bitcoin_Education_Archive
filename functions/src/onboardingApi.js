'use strict';

const crypto = require('crypto');
const quest = require('./onboardingQuest');
const names = require('./usernamePolicy');
const faucetGuard = require('./faucetGuard');
const rateSalt = require('./rateLimitSalt');
const { isSatsBanned } = require('./cipherClaim');

const QUIZ_DOC = /_(quest|trivia|poll_vote)$/;
const USERNAME_HOUR_MS = 60 * 60 * 1000;
const USERNAME_ATTEMPTS = 3;
const USERNAME_APP_ATTEMPTS = 30;
const USERNAME_IP_ATTEMPTS = 10;
const USERNAME_RATE_TTL_MS = 24 * 60 * 60 * 1000;

function httpsError(functionsV1, code, message) {
    return new functionsV1.https.HttpsError(code, message);
}

function requireUser(context, functionsV1) {
    if (!context.auth || !context.auth.uid) {
        throw httpsError(functionsV1, 'unauthenticated', 'Sign in required.');
    }
    return context.auth.uid;
}

function isAnon(context) {
    return !!(context.auth && context.auth.token && context.auth.token.firebase
        && context.auth.token.firebase.sign_in_provider === 'anonymous');
}

function quizDocId(id) {
    return QUIZ_DOC.test(String(id || ''));
}

function offsetDateKey(nowMs) {
    const shifted = new Date((Number(nowMs) || Date.now()) - 5 * 3600 * 1000);
    return shifted.toISOString().split('T')[0];
}

function timestampMs(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value.toMillis === 'function') {
        const n = value.toMillis();
        return Number.isFinite(n) ? n : null;
    }
    if (typeof value.seconds === 'number') return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
    if (typeof value === 'string') {
        const t = Date.parse(value);
        return Number.isFinite(t) ? t : null;
    }
    return null;
}

function accountBlocked(user, ledger) {
    if (!user) return false;
    if (user.ban_reason) return true;
    if (user.banned === true || user.flagged === true) return true;
    return isSatsBanned(user, ledger || {});
}

function roleMayUseReserved(user) {
    if (!user) return false;
    if (user.isAdmin === true || user.admin === true) return true;
    const role = String(user.role || '');
    return role === 'admin' || role === 'moderator';
}

function reservationView(data) {
    const row = data || {};
    return {
        uid: row.uid || '',
        anon: row.anon === true,
        at: row.atMs != null ? row.atMs : timestampMs(row.at),
        releasedAt: row.releasedAtMs != null ? row.releasedAtMs : timestampMs(row.releasedAt),
        holdUid: row.holdUid || '',
    };
}

async function gatherEvidence(db, uid) {
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const user = userSnap.exists ? (userSnap.data() || {}) : {};
    const evidence = {
        channel: (user.channelsVisited || 0) >= 1,
        spin: typeof user.lastSpinDate === 'string' && user.lastSpinDate.length >= 8,
        chat: false,
        nacho: false,
        quiz: false,
    };
    const nachoSnap = await userRef.collection('onboarding_evidence').doc('nacho').get();
    evidence.nacho = !!(nachoSnap.exists && nachoSnap.data() && nachoSnap.data().asked === true);
    const quizSnap = await userRef.collection('onboarding_evidence').doc('quiz').get();
    if (quizSnap.exists && quizSnap.data() && quizSnap.data().done === true) evidence.quiz = true;
    const counts = await userRef.collection('daily_action_counts').limit(40).get();
    counts.forEach(function (doc) {
        if (quizDocId(doc.id)) evidence.quiz = true;
    });
    const chat = await db.collection('global_chat').where('uid', '==', uid).limit(1).get();
    evidence.chat = !chat.empty;
    return {
        exists: userSnap.exists,
        user: user,
        evidence: evidence,
        mode: quest.normalizeMode(user.experienceMode),
        ledger: user.onboardingQuest || {},
    };
}

function applyPointFields(update, admin, grant) {
    if (grant.pointsOut > 0) update.points = admin.firestore.FieldValue.increment(grant.pointsOut);
    if (grant.awarded > 0) {
        update.weeklyXP = admin.firestore.FieldValue.increment(grant.awarded);
        update.monthlyXP = admin.firestore.FieldValue.increment(grant.awarded);
    }
    return update;
}

function writeDailyPoints(tx, admin, dailyRef, dailyUsed, grant) {
    if (grant.awarded > 0) {
        tx.set(dailyRef, {
            total: (Number(dailyUsed) || 0) + grant.awarded,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
}

function recentStamps(snap, nowMs) {
    const raw = snap && snap.exists && Array.isArray((snap.data() || {}).attempts) ? snap.data().attempts : [];
    return raw.filter(function (t) { return nowMs - Number(t) < USERNAME_HOUR_MS; });
}

function clearGuestNonce(tx, admin, anonRef) {
    tx.set(anonRef, {
        guestLinkNonce: admin.firestore.FieldValue.delete(),
        guestLinkNonceAt: admin.firestore.FieldValue.delete(),
    }, { merge: true });
}

function registerOnboarding(deps) {
    const db = deps.db;
    const admin = deps.admin;
    const functionsV1 = deps.functionsV1;
    const onCall = function () {
        return functionsV1.runWith({ enforceAppCheck: true }).https.onCall;
    };

    async function claimOnboardingQuestStep(data, context) {
        const secondFactor = require('./secondFactor');
        await secondFactor.requireSecondFactor(secondFactor.stamp(data, context));
        const uid = requireUser(context, functionsV1);
        if (isAnon(context)) {
            throw httpsError(functionsV1, 'permission-denied', 'Create an account to collect this reward.');
        }
        const stepId = data && data.stepId;
        const snap = await gatherEvidence(db, uid);
        if (!snap.exists) throw httpsError(functionsV1, 'not-found', 'Account not found.');
        const banSnap = await db.collection('faucet_ledger').doc(uid).get();
        if (accountBlocked(snap.user, banSnap.exists ? (banSnap.data() || {}) : {})) {
            return { ok: false, error: 'unavailable', awarded: 0, tickets: 0 };
        }
        const decision = quest.decideGrant({
            stepId: stepId,
            mode: snap.mode,
            evidence: snap.evidence,
            ledger: snap.ledger,
        });
        if (!decision.ok) {
            return { ok: false, error: decision.error, awarded: 0, tickets: 0 };
        }
        const today = offsetDateKey(Date.now());
        const userRef = db.collection('users').doc(uid);
        const ledgerRef = db.collection('faucet_ledger').doc(uid);
        const dailyRef = db.collection('users').doc(uid).collection('daily_points').doc(today);
        const written = await db.runTransaction(async function (tx) {
            const fresh = await tx.get(userRef);
            const ledgerSnap = await tx.get(ledgerRef);
            const dailySnap = await tx.get(dailyRef);
            if (!fresh.exists) throw httpsError(functionsV1, 'not-found', 'Account not found.');
            const user = fresh.data() || {};
            const ledger = ledgerSnap.exists ? (ledgerSnap.data() || {}) : {};
            if (accountBlocked(user, ledger)) return { ok: false, error: 'unavailable', awarded: 0, tickets: 0 };
            const mode = quest.normalizeMode(user.experienceMode);
            const again = quest.decideGrant({
                stepId: stepId,
                mode: mode,
                evidence: snap.evidence,
                ledger: user.onboardingQuest || {},
            });
            if (!again.ok || again.already) return Object.assign({ mode: mode }, again);
            const dailyUsed = dailySnap.exists ? Number((dailySnap.data() || {}).total) || 0 : 0;
            const grant = quest.planDailyGrant({
                dailyUsed: dailyUsed,
                amount: again.awarded,
                pendingOverflow: user.pendingOverflow || 0,
                lastOverflowDate: user.lastOverflowDate || '',
                today: today,
            });
            grant.today = today;
            const prev = (user.onboardingQuest && user.onboardingQuest.steps) || {};
            const steps = Object.assign({}, prev);
            steps[stepId] = { granted: true, pts: grant.awarded, overflow: grant.overflowAdded, tickets: again.tickets };
            const complete = quest.isComplete(mode, steps);
            const update = {
                onboardingQuest: {
                    mode: mode,
                    steps: steps,
                    complete: complete,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
            };
            applyPointFields(update, admin, grant);
            if (again.tickets > 0) update.orangeTickets = admin.firestore.FieldValue.increment(again.tickets);
            if (complete) update.nachoQuestDone = true;
            tx.update(userRef, update);
            writeDailyPoints(tx, admin, dailyRef, dailyUsed, grant);
            return {
                ok: true,
                already: false,
                mode: mode,
                awarded: grant.pointsOut,
                tickets: again.tickets,
                complete: complete,
            };
        });
        const totals = quest.catalogTotals(written.mode || snap.mode);
        return {
            ok: !!written.ok,
            already: !!written.already,
            error: written.error || '',
            awarded: written.awarded || 0,
            tickets: written.tickets || 0,
            complete: !!written.complete,
            totalPts: totals.pts,
            totalTickets: totals.tickets,
        };
    }

    async function noteNachoQuestion(data, context) {
        const uid = requireUser(context, functionsV1);
        const text = String((data && data.text) || '');
        if (text.trim().length < 1 || text.length > 400 || /[<>]/.test(text)) {
            throw httpsError(functionsV1, 'invalid-argument', 'Send a short question.');
        }
        const userRef = db.collection('users').doc(uid);
        const userSnap = await userRef.get();
        const ledgerSnap = await db.collection('faucet_ledger').doc(uid).get();
        const user = userSnap.exists ? (userSnap.data() || {}) : {};
        const ledger = ledgerSnap.exists ? (ledgerSnap.data() || {}) : {};
        if (accountBlocked(user, ledger)) return { ok: false, error: 'unavailable' };
        const ref = userRef.collection('onboarding_evidence').doc('nacho');
        const existing = await ref.get();
        if (existing.exists && existing.data() && existing.data().asked === true) {
            return { ok: true, already: true };
        }
        await ref.set({
            asked: true,
            len: text.trim().length,
            at: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { ok: true, already: false };
    }

    async function markIntroSeen(data, context) {
        const uid = requireUser(context, functionsV1);
        if (isAnon(context)) return { ok: true, stored: 'local' };
        const userSnap = await db.collection('users').doc(uid).get();
        const ledgerSnap = await db.collection('faucet_ledger').doc(uid).get();
        const user = userSnap.exists ? (userSnap.data() || {}) : {};
        const ledger = ledgerSnap.exists ? (ledgerSnap.data() || {}) : {};
        if (accountBlocked(user, ledger)) return { ok: false, error: 'unavailable' };
        await db.collection('users').doc(uid).set({
            introSeen: true,
            introSeenAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return { ok: true, stored: 'server' };
    }

    async function prepareGuestLink(data, context) {
        const uid = requireUser(context, functionsV1);
        if (!isAnon(context)) {
            throw httpsError(functionsV1, 'failed-precondition', 'Guest link is only for a guest session.');
        }
        const ref = db.collection('users').doc(uid);
        const snap = await ref.get();
        const prev = snap.exists ? (snap.data() || {}) : {};
        const ledgerSnap = await db.collection('faucet_ledger').doc(uid).get();
        const ledger = ledgerSnap.exists ? (ledgerSnap.data() || {}) : {};
        if (accountBlocked(prev, ledger)) return { ok: false, error: 'unavailable' };
        if (prev.mergedInto) return { ok: false, error: 'already_linked' };
        const nonce = crypto.randomBytes(24).toString('hex');
        await ref.set({
            guestLinkNonce: nonce,
            guestLinkNonceAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return { ok: true, nonce: nonce };
    }

    async function linkGuestAccount(data, context) {
        const secondFactor = require('./secondFactor');
        await secondFactor.requireSecondFactor(secondFactor.stamp(data, context));
        const uid = requireUser(context, functionsV1);
        if (isAnon(context)) throw httpsError(functionsV1, 'permission-denied', 'Sign in before linking a guest.');
        const anonUid = String((data && data.anonUid) || '');
        const nonce = String((data && data.nonce) || '');
        if (!/^[A-Za-z0-9]{10,128}$/.test(anonUid) || anonUid === uid) {
            throw httpsError(functionsV1, 'invalid-argument', 'Guest session could not be linked.');
        }
        let sourceUpgraded = false;
        try {
            const authUser = await admin.auth().getUser(anonUid);
            sourceUpgraded = !!(authUser && authUser.providerData && authUser.providerData.length > 0);
        } catch (e) {
            return { ok: false, error: 'bad_nonce' };
        }
        const anonRef = db.collection('users').doc(anonUid);
        const destRef = db.collection('users').doc(uid);
        const nowMs = Date.now();
        let guestHadQuiz = false;
        try {
            const counts = await anonRef.collection('daily_action_counts').limit(30).get();
            counts.forEach(function (doc) {
                if (quizDocId(doc.id)) guestHadQuiz = true;
            });
        } catch (e) { guestHadQuiz = false; }

        const written = await db.runTransaction(async function (tx) {
            const freshAnon = await tx.get(anonRef);
            const freshDest = await tx.get(destRef);
            const ledgerSnap = await tx.get(db.collection('faucet_ledger').doc(uid));
            const anonLedgerSnap = await tx.get(db.collection('faucet_ledger').doc(anonUid));
            const nachoSnap = await tx.get(anonRef.collection('onboarding_evidence').doc('nacho'));
            const quizSnap = await tx.get(anonRef.collection('onboarding_evidence').doc('quiz'));
            const row = freshAnon.exists ? (freshAnon.data() || {}) : {};
            const dest = freshDest.exists ? (freshDest.data() || {}) : {};
            const guestName = String(row.username || '').trim();
            const guestLower = String(row.username_lower || guestName.toLowerCase());
            const destName = String(dest.username || '').trim();
            let nameSnap = null;
            let nameRef = null;
            if (!destName && guestName && guestLower && guestLower.indexOf('/') === -1) {
                nameRef = db.collection('usernames').doc(guestLower);
                nameSnap = await tx.get(nameRef);
            }
            const destLedger = ledgerSnap.exists ? (ledgerSnap.data() || {}) : {};
            const anonLedger = anonLedgerSnap.exists ? (anonLedgerSnap.data() || {}) : {};
            if (accountBlocked(dest, destLedger) || accountBlocked(row, anonLedger)) {
                return { ok: false, error: 'unavailable', points: 0, tickets: 0 };
            }
            const stored = String(row.guestLinkNonce || '');
            const nonceMatches = nonce.length >= 16 && nonce === stored;
            if (sourceUpgraded) {
                if (nonceMatches) clearGuestNonce(tx, admin, anonRef);
                return { ok: false, error: 'already_linked', points: 0, tickets: 0 };
            }
            const nonceAt = timestampMs(row.guestLinkNonceAt);
            const createdAt = timestampMs(row.created);
            const again = quest.planGuestMerge({
                nonce: nonce,
                storedNonce: stored,
                mergedInto: row.mergedInto || '',
                callerUid: uid,
                serverPoints: row.points,
                serverTickets: row.orangeTickets,
                serverChannels: row.channelsVisited,
                nonceAgeMs: nonceAt == null ? null : (nowMs - nonceAt),
                guestAgeMs: createdAt == null ? null : (nowMs - createdAt),
                destMergedFromGuest: dest.mergedFromGuest === true,
            });
            if (!again.ok) {
                if (again.error !== 'bad_nonce' && nonceMatches) clearGuestNonce(tx, admin, anonRef);
                return { ok: false, error: again.error, points: 0, tickets: 0 };
            }
            if (again.already) {
                if (nonceMatches) clearGuestNonce(tx, admin, anonRef);
                return { ok: true, already: true, points: 0, tickets: 0 };
            }
            // Guest points were already earned. Moving them is not a new daily grant.
            const movedPoints = Math.max(0, Math.floor(Number(again.points) || 0));
            let movedName = '';
            if (nameRef) {
                const reserved = nameSnap && nameSnap.exists ? reservationView(nameSnap.data()) : null;
                const free = !reserved || !reserved.uid || reserved.uid === anonUid || reserved.uid === uid || !names.reservationBlocks(reserved, uid, nowMs);
                if (free) movedName = guestName;
            }
            if (!freshDest.exists) {
                const created = {
                    points: movedPoints,
                    weeklyXP: movedPoints,
                    monthlyXP: movedPoints,
                    orangeTickets: again.tickets,
                    channelsVisited: again.channelsVisited,
                    totalVisits: 1,
                    streak: 1,
                    mergedFromGuest: true,
                    created: admin.firestore.FieldValue.serverTimestamp(),
                };
                if (movedName) {
                    created.username = movedName;
                    created.username_lower = guestLower;
                }
                tx.set(destRef, created);
            } else {
                const update = { mergedFromGuest: true };
                if (movedPoints > 0) {
                    update.points = admin.firestore.FieldValue.increment(movedPoints);
                    update.weeklyXP = admin.firestore.FieldValue.increment(movedPoints);
                    update.monthlyXP = admin.firestore.FieldValue.increment(movedPoints);
                }
                if (again.tickets > 0) update.orangeTickets = admin.firestore.FieldValue.increment(again.tickets);
                const channels = Math.max(dest.channelsVisited || 0, again.channelsVisited || 0);
                if (channels > (dest.channelsVisited || 0)) update.channelsVisited = channels;
                if (movedName) {
                    update.username = movedName;
                    update.username_lower = guestLower;
                }
                tx.update(destRef, update);
            }
            if (movedName && nameRef) {
                tx.set(nameRef, {
                    uid: uid,
                    at: admin.firestore.FieldValue.serverTimestamp(),
                    atMs: nowMs,
                    anon: false,
                });
            }
            tx.set(anonRef, {
                mergedInto: uid,
                points: 0,
                weeklyXP: 0,
                monthlyXP: 0,
                orangeTickets: 0,
                channelsVisited: 0,
                guestLinkNonce: admin.firestore.FieldValue.delete(),
                guestLinkNonceAt: admin.firestore.FieldValue.delete(),
            }, { merge: true });
            if (nachoSnap.exists && nachoSnap.data() && nachoSnap.data().asked === true) {
                tx.set(destRef.collection('onboarding_evidence').doc('nacho'), {
                    asked: true,
                    len: nachoSnap.data().len || 0,
                    at: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
            const quizDone = guestHadQuiz || (quizSnap.exists && quizSnap.data() && quizSnap.data().done === true);
            if (quizDone) {
                tx.set(destRef.collection('onboarding_evidence').doc('quiz'), {
                    done: true,
                    at: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
            return { ok: true, already: false, points: movedPoints, tickets: again.tickets };
        });
        return {
            ok: !!written.ok,
            already: !!written.already,
            error: written.error || '',
            points: written.points || 0,
            tickets: written.tickets || 0,
        };
    }

    async function setUsername(data, context) {
        const secondFactor = require('./secondFactor');
        await secondFactor.requireSecondFactor(secondFactor.stamp(data, context));
        const uid = requireUser(context, functionsV1);
        const rawName = data && data.name;
        const first = names.assessUsername(rawName, { allowReserved: true });
        if (!first.ok) throw httpsError(functionsV1, 'invalid-argument', names.usernameMessage(first.error));
        const lower = first.username_lower;
        const userRef = db.collection('users').doc(uid);
        const nameRef = db.collection('usernames').doc(lower);
        const nowMs = Date.now();
        // Rate limit before any profile, ledger, or username read. Guests count
        // on both their uid and their IP. Run backfill_usernames.js --apply
        // before the front end ships; until that marker exists, refuse.
        const ip = faucetGuard.clientIpFromRequest(context && context.rawRequest) || 'unknown';
        const uidLimit = context && context.app ? USERNAME_APP_ATTEMPTS : USERNAME_ATTEMPTS;
        const uidRateRef = db.collection('rate_limits').doc('username_' + uid);
        let ipDocId = '';
        try {
            ipDocId = await rateSalt.networkRateDocId(db, 'username_ip_', ip, nowMs);
        } catch (saltErr) {
            throw httpsError(functionsV1, 'unavailable', 'Username check is unavailable right now. Try again shortly.');
        }
        const ipRateRef = db.collection('rate_limits').doc(ipDocId);
        const rateExpire = new Date(nowMs + USERNAME_RATE_TTL_MS);
        const allowed = await db.runTransaction(async function (tx) {
            const uidSnap = await tx.get(uidRateRef);
            const ipSnap = await tx.get(ipRateRef);
            const uidStamps = recentStamps(uidSnap, nowMs);
            const ipStamps = recentStamps(ipSnap, nowMs);
            if (uidStamps.length >= uidLimit || ipStamps.length >= USERNAME_IP_ATTEMPTS) return false;
            uidStamps.push(nowMs);
            ipStamps.push(nowMs);
            tx.set(uidRateRef, { attempts: uidStamps, uid: uid, expireAt: rateExpire }, { merge: true });
            tx.set(ipRateRef, { attempts: ipStamps, expireAt: rateExpire }, { merge: true });
            return true;
        });
        if (!allowed) {
            throw httpsError(functionsV1, 'resource-exhausted', 'Too many username attempts. Try again in an hour.');
        }
        const meta = await db.collection('usernames_meta').doc('backfill').get();
        if (!(meta.exists && meta.data() && meta.data().applied === true)) {
            throw httpsError(functionsV1, 'unavailable', 'Username check is still catching up. Try again shortly.');
        }
        const saved = await db.runTransaction(async function (tx) {
            const userSnap = await tx.get(userRef);
            const nameSnap = await tx.get(nameRef);
            const ledgerSnap = await tx.get(db.collection('faucet_ledger').doc(uid));
            const current = userSnap.exists ? (userSnap.data() || {}) : {};
            const ledger = ledgerSnap.exists ? (ledgerSnap.data() || {}) : {};
            const prevLower = String(current.username_lower || '');
            let oldSnap = null;
            let oldRef = null;
            if (prevLower && prevLower !== lower && prevLower.indexOf('/') === -1) {
                oldRef = db.collection('usernames').doc(prevLower);
                oldSnap = await tx.get(oldRef);
            }
            if (accountBlocked(current, ledger)) return { ok: false, error: 'unavailable' };
            const selfHasSame = prevLower === lower;
            const changedAt = timestampMs(current.usernameChangedAt);
            const renameTooSoon = !selfHasSame && !!prevLower && changedAt != null && (nowMs - changedAt) < names.RENAME_MS;
            const reservedDoc = nameSnap.exists ? reservationView(nameSnap.data()) : null;
            const reservedByOther = !!(reservedDoc && names.reservationBlocks(reservedDoc, uid, nowMs));
            const decision = names.assessUsername(rawName, {
                taken: reservedByOther,
                selfHasSame: selfHasSame,
                allowReserved: roleMayUseReserved(current),
                renameTooSoon: renameTooSoon,
            });
            if (!decision.ok) return decision;
            tx.set(nameRef, {
                uid: uid,
                at: admin.firestore.FieldValue.serverTimestamp(),
                atMs: nowMs,
                anon: isAnon(context),
            });
            if (oldSnap && oldSnap.exists && oldSnap.data() && oldSnap.data().uid === uid) {
                tx.set(oldRef, {
                    uid: uid,
                    releasedAtMs: nowMs,
                    holdUid: uid,
                    anon: false,
                }, { merge: true });
            }
            const patch = { username: decision.username, username_lower: decision.username_lower };
            if (!selfHasSame && prevLower) patch.usernameChangedAt = admin.firestore.FieldValue.serverTimestamp();
            if (!userSnap.exists) {
                tx.set(userRef, Object.assign({
                    points: 0,
                    channelsVisited: 0,
                    totalVisits: 1,
                    streak: 1,
                    created: admin.firestore.FieldValue.serverTimestamp(),
                }, patch));
            } else {
                tx.update(userRef, patch);
            }
            return { ok: true, username: decision.username, already: selfHasSame };
        });
        if (!saved.ok) {
            if (saved.error === 'rate') {
                throw httpsError(functionsV1, 'resource-exhausted', 'Too many username attempts. Try again in an hour.');
            }
            if (saved.error === 'unavailable') {
                throw httpsError(functionsV1, 'permission-denied', 'This action is unavailable.');
            }
            throw httpsError(functionsV1, 'invalid-argument', names.usernameMessage(saved.error));
        }
        return { ok: true, username: saved.username, already: !!saved.already };
    }

    return {
        claimOnboardingQuestStep: onCall()(claimOnboardingQuestStep),
        noteNachoQuestion: onCall()(noteNachoQuestion),
        markIntroSeen: onCall()(markIntroSeen),
        prepareGuestLink: onCall()(prepareGuestLink),
        linkGuestAccount: onCall()(linkGuestAccount),
        setUsername: functionsV1.runWith({ enforceAppCheck: false }).https.onCall(setUsername),
    };
}

module.exports = {
    registerOnboarding: registerOnboarding,
    gatherEvidence: gatherEvidence,
    quizDocId: quizDocId,
    offsetDateKey: offsetDateKey,
};
