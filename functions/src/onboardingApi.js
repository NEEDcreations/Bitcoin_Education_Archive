'use strict';

const crypto = require('crypto');
const quest = require('./onboardingQuest');
const names = require('./usernamePolicy');

const QUIZ_DOC = /_(quest|trivia|poll_vote)$/;

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

function registerOnboarding(deps) {
    const db = deps.db;
    const admin = deps.admin;
    const functionsV1 = deps.functionsV1;
    const onCall = function () {
        return functionsV1.runWith({ enforceAppCheck: true }).https.onCall;
    };

    async function claimOnboardingQuestStep(data, context) {
        const uid = requireUser(context, functionsV1);
        if (isAnon(context)) {
            throw httpsError(functionsV1, 'permission-denied', 'Create an account to collect this reward.');
        }
        const stepId = data && data.stepId;
        const snap = await gatherEvidence(db, uid);
        if (!snap.exists) throw httpsError(functionsV1, 'not-found', 'Account not found.');
        const decision = quest.decideGrant({
            stepId: stepId,
            mode: snap.mode,
            evidence: snap.evidence,
            ledger: snap.ledger,
        });
        if (!decision.ok) {
            return { ok: false, error: decision.error, awarded: 0, tickets: 0 };
        }
        if (decision.already) {
            const totals = quest.catalogTotals(snap.mode);
            return { ok: true, already: true, awarded: 0, tickets: 0, complete: decision.complete, totalPts: totals.pts, totalTickets: totals.tickets };
        }
        const userRef = db.collection('users').doc(uid);
        const written = await db.runTransaction(async function (tx) {
            const fresh = await tx.get(userRef);
            if (!fresh.exists) throw httpsError(functionsV1, 'not-found', 'Account not found.');
            const user = fresh.data() || {};
            const mode = quest.normalizeMode(user.experienceMode);
            const again = quest.decideGrant({
                stepId: stepId,
                mode: mode,
                evidence: snap.evidence,
                ledger: user.onboardingQuest || {},
            });
            if (!again.ok) return again;
            if (again.already) return again;
            const prev = (user.onboardingQuest && user.onboardingQuest.steps) || {};
            const steps = Object.assign({}, prev);
            steps[stepId] = { granted: true, pts: again.awarded, tickets: again.tickets };
            const complete = quest.isComplete(mode, steps);
            const update = {
                onboardingQuest: {
                    mode: mode,
                    steps: steps,
                    complete: complete,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
            };
            if (again.awarded > 0) update.points = admin.firestore.FieldValue.increment(again.awarded);
            if (again.tickets > 0) update.orangeTickets = admin.firestore.FieldValue.increment(again.tickets);
            if (complete) update.nachoQuestDone = true;
            tx.update(userRef, update);
            return Object.assign({ mode: mode }, again);
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
        const ref = db.collection('users').doc(uid).collection('onboarding_evidence').doc('nacho');
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
        if (prev.mergedInto) return { ok: false, error: 'already_linked' };
        const nonce = crypto.randomBytes(24).toString('hex');
        await ref.set({ guestLinkNonce: nonce }, { merge: true });
        return { ok: true, nonce: nonce };
    }

    async function linkGuestAccount(data, context) {
        const uid = requireUser(context, functionsV1);
        if (isAnon(context)) throw httpsError(functionsV1, 'permission-denied', 'Sign in before linking a guest.');
        const anonUid = String((data && data.anonUid) || '');
        const nonce = String((data && data.nonce) || '');
        if (!/^[A-Za-z0-9]{10,128}$/.test(anonUid) || anonUid === uid) {
            throw httpsError(functionsV1, 'invalid-argument', 'Guest session could not be linked.');
        }
        const anonRef = db.collection('users').doc(anonUid);
        const destRef = db.collection('users').doc(uid);
        const anonSnap = await anonRef.get();
        const anon = anonSnap.exists ? (anonSnap.data() || {}) : {};
        const plan = quest.planGuestMerge({
            nonce: nonce,
            storedNonce: anon.guestLinkNonce || '',
            mergedInto: anon.mergedInto || '',
            callerUid: uid,
            serverPoints: anon.points,
            serverTickets: anon.orangeTickets,
            serverChannels: anon.channelsVisited,
            clientPoints: data && data.clientPoints,
        });
        if (!plan.ok) return { ok: false, error: plan.error };
        if (plan.already) return { ok: true, already: true, points: 0, tickets: 0 };
        await db.runTransaction(async function (tx) {
            const freshAnon = await tx.get(anonRef);
            const freshDest = await tx.get(destRef);
            const row = freshAnon.exists ? (freshAnon.data() || {}) : {};
            const again = quest.planGuestMerge({
                nonce: nonce,
                storedNonce: row.guestLinkNonce || '',
                mergedInto: row.mergedInto || '',
                callerUid: uid,
                serverPoints: row.points,
                serverTickets: row.orangeTickets,
                serverChannels: row.channelsVisited,
            });
            if (!again.ok || again.already) return;
            const dest = freshDest.exists ? (freshDest.data() || {}) : {};
            if (!freshDest.exists) {
                tx.set(destRef, {
                    points: again.points,
                    orangeTickets: again.tickets,
                    channelsVisited: again.channelsVisited,
                    totalVisits: 1,
                    streak: 1,
                    mergedFromGuest: true,
                    created: admin.firestore.FieldValue.serverTimestamp(),
                });
            } else {
                const update = { mergedFromGuest: true };
                if (again.points > 0) update.points = admin.firestore.FieldValue.increment(again.points);
                if (again.tickets > 0) update.orangeTickets = admin.firestore.FieldValue.increment(again.tickets);
                const channels = Math.max(dest.channelsVisited || 0, again.channelsVisited || 0);
                if (channels > (dest.channelsVisited || 0)) update.channelsVisited = channels;
                tx.update(destRef, update);
            }
            tx.set(anonRef, {
                mergedInto: uid,
                guestLinkNonce: admin.firestore.FieldValue.delete(),
            }, { merge: true });
        });
        await copyGuestEvidence(db, admin, anonUid, uid);
        return { ok: true, already: false, points: plan.points, tickets: plan.tickets };
    }

    async function setUsername(data, context) {
        const uid = requireUser(context, functionsV1);
        const rawName = data && data.name;
        const first = names.assessUsername(rawName, {});
        if (!first.ok) throw httpsError(functionsV1, 'invalid-argument', names.usernameMessage(first.error));
        const lower = first.username_lower;
        const userRef = db.collection('users').doc(uid);
        const nameRef = db.collection('usernames').doc(lower);
        let taken = false;
        const profiles = await db.collection('public_profiles').where('username_lower', '==', lower).limit(5).get();
        profiles.forEach(function (doc) {
            if (doc.id !== uid) taken = true;
        });
        const saved = await db.runTransaction(async function (tx) {
            const userSnap = await tx.get(userRef);
            const nameSnap = await tx.get(nameRef);
            const current = userSnap.exists ? (userSnap.data() || {}) : {};
            const prevLower = current.username_lower || '';
            let oldSnap = null;
            let oldRef = null;
            if (prevLower && prevLower !== lower) {
                oldRef = db.collection('usernames').doc(prevLower);
                oldSnap = await tx.get(oldRef);
            }
            const selfHasSame = prevLower === lower;
            const reservedByOther = nameSnap.exists && nameSnap.data() && nameSnap.data().uid && nameSnap.data().uid !== uid;
            const decision = names.assessUsername(rawName, { taken: taken || reservedByOther, selfHasSame: selfHasSame });
            if (!decision.ok) return decision;
            tx.set(nameRef, { uid: uid, at: admin.firestore.FieldValue.serverTimestamp() });
            if (oldSnap && oldSnap.exists && oldSnap.data() && oldSnap.data().uid === uid) tx.delete(oldRef);
            const patch = { username: decision.username, username_lower: decision.username_lower };
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
        if (!saved.ok) throw httpsError(functionsV1, 'invalid-argument', names.usernameMessage(saved.error));
        return { ok: true, username: saved.username, already: !!saved.already };
    }

    return {
        claimOnboardingQuestStep: onCall()(claimOnboardingQuestStep),
        noteNachoQuestion: onCall()(noteNachoQuestion),
        markIntroSeen: onCall()(markIntroSeen),
        prepareGuestLink: onCall()(prepareGuestLink),
        linkGuestAccount: onCall()(linkGuestAccount),
        setUsername: onCall()(setUsername),
    };
}

async function copyGuestEvidence(db, admin, anonUid, uid) {
    const src = db.collection('users').doc(anonUid);
    const dest = db.collection('users').doc(uid);
    try {
        const nacho = await src.collection('onboarding_evidence').doc('nacho').get();
        if (nacho.exists && nacho.data() && nacho.data().asked === true) {
            await dest.collection('onboarding_evidence').doc('nacho').set({
                asked: true,
                len: nacho.data().len || 0,
                at: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
    } catch (e) { /* evidence copy is best-effort; the quest can be retried */ }
    try {
        const counts = await src.collection('daily_action_counts').limit(30).get();
        const batch = db.batch();
        let n = 0;
        counts.forEach(function (doc) {
            if (!quizDocId(doc.id)) return;
            batch.set(dest.collection('daily_action_counts').doc(doc.id), { copied: true, count: 1 }, { merge: true });
            n++;
        });
        if (n) await batch.commit();
    } catch (e) { /* same */ }
}

module.exports = {
    registerOnboarding: registerOnboarding,
    gatherEvidence: gatherEvidence,
    quizDocId: quizDocId,
};
