'use strict';

// Completion bonus for the Bitcoin Scholar certification (properties exam)
// and the Bitcoin Protocol Expert certification (technical exam).
//
// History, from git:
//   48ae8a46 (2026-04-11) started paying 2,100 XP inside gradeScholarExam.
//   The comment kept through 0715fbd7 (PR #78, merged a50bb034) said the
//   2,100 was incremented directly, outside the daily cap, once per cert type.
//   #78 stopped a second payment after the profile flags were cleared. It
//   did not lower the 2,100.
//   b0979d93 (2026-10-23) folded that 2,100 into the shared daily taper, so a
//   fresh day paid 1,000 and a full day paid 0. 8a4dfa79 recorded that taper.
//
// This module restores the 2,100 and pays it in full outside the 1,000 cap.
// gradeScholarExam is the only caller that can credit a new pass. The
// backfill script credits an older pass only with --apply, and only after it
// re-reads a server pass row whose score is at least 20. Nothing here is
// callable from the browser.

const { rewardBlocked } = require('./cipherClaim');
const { offsetDateKey } = require('./offsetDay');

const CERT_BONUS_XP = 2100;
const CERT_BONUS_SOURCE = 'cert_bonus';
const PASS_SCORE = 20;

const TYPES = {
    properties: 'prop',
    technical: 'tech',
};

function keyPrefix(type) {
    return TYPES[type] || '';
}

function markerId(type) {
    return keyPrefix(type);
}

function ledgerId(type) {
    return 'cert_bonus_' + keyPrefix(type);
}

function markerRef(userRef, type) {
    return userRef.collection('cert_bonuses').doc(markerId(type));
}

function ledgerRef(userRef, type) {
    return userRef.collection('xp_ledger').doc(ledgerId(type));
}

function snapData(snap) {
    if (!snap || snap.exists !== true || typeof snap.data !== 'function') return null;
    return snap.data() || {};
}

function alreadyPaid(markerSnap, ledgerSnap) {
    if (snapData(markerSnap)) return true;
    return !!snapData(ledgerSnap);
}

function eligiblePass(row) {
    if (!row || row.passed !== true) return false;
    const score = Number(row.score);
    return Number.isFinite(score) && score >= PASS_SCORE;
}

function planCertBonus(opts) {
    const src = opts || {};
    if (!TYPES[src.type]) return { pay: false, amount: 0, reason: 'type', source: CERT_BONUS_SOURCE };
    if (src.banned) return { pay: false, amount: 0, reason: 'banned', source: CERT_BONUS_SOURCE };
    if (src.alreadyPaid) return { pay: false, amount: 0, reason: 'already', source: CERT_BONUS_SOURCE };
    if (!src.passed) return { pay: false, amount: 0, reason: 'not-passed', source: CERT_BONUS_SOURCE };
    return {
        pay: true,
        amount: CERT_BONUS_XP,
        reason: 'cert_bonus',
        source: CERT_BONUS_SOURCE,
        capExempt: true,
    };
}

function bonusUserFields(adminSdk, plan) {
    if (!plan || !plan.pay) return {};
    return {
        points: adminSdk.firestore.FieldValue.increment(plan.amount),
        scholarPoints: adminSdk.firestore.FieldValue.increment(plan.amount),
    };
}

function markerData(adminSdk, uid, type, amount, nowMs) {
    return {
        uid: uid,
        certType: type,
        source: CERT_BONUS_SOURCE,
        amount: amount,
        countedTowardDailyCap: false,
        createdAtMs: nowMs,
        createdAt: adminSdk.firestore.FieldValue.serverTimestamp(),
    };
}

function ledgerData(uid, type, amount, day, nowMs) {
    return {
        source: CERT_BONUS_SOURCE,
        amount: amount,
        requested: amount,
        awarded: amount,
        certType: type,
        uid: uid,
        day: day || '',
        createdAtMs: nowMs,
        countedTowardDailyCap: false,
    };
}

function writeMarkers(tx, adminSdk, fields, plan, nowMs) {
    if (!plan || !plan.pay) return;
    const when = Number(nowMs) || Date.now();
    tx.set(fields.markerRef, markerData(adminSdk, fields.uid, fields.type, plan.amount, when));
    tx.set(fields.ledgerRef, ledgerData(fields.uid, fields.type, plan.amount, fields.day, when));
}

// Backfill row. A passed exam with a server score of at least 20 is payable
// once. Prior tapered exam XP is not subtracted: it was not this source.
function planBackfillRow(opts) {
    const src = opts || {};
    const passed = eligiblePass(src.exam);
    const plan = planCertBonus({
        type: src.type,
        passed: passed,
        banned: src.banned === true,
        alreadyPaid: src.alreadyPaid === true,
    });
    let reason = plan.reason;
    if (!passed && src.exam && src.exam.passed === true) reason = 'unverified-score';
    return {
        uid: src.uid || '',
        username: src.username || '',
        type: src.type,
        amount: plan.pay ? plan.amount : 0,
        reason: reason,
        pay: plan.pay,
    };
}

// Pays one older pass. The transaction re-reads the exam, the user, the ban
// ledger, and both markers. It does not touch daily_points.
async function creditExistingPass(db, adminSdk, uid, type, nowMs) {
    if (!uid || !TYPES[type]) return planCertBonus({ type: type });
    const userRef = db.collection('users').doc(uid);
    const mRef = markerRef(userRef, type);
    const lRef = ledgerRef(userRef, type);
    const faucetRef = db.collection('faucet_ledger').doc(uid);
    const when = Number(nowMs) || Date.now();
    const day = offsetDateKey(when);
    return db.runTransaction(async function (tx) {
        const userSnap = await tx.get(userRef);
        const markerSnap = await tx.get(mRef);
        const ledgerSnap = await tx.get(lRef);
        const faucetSnap = await tx.get(faucetRef);
        const exams = await tx.get(db.collection('scholar_exam_keys').where('uid', '==', uid));
        let exam = null;
        if (exams && typeof exams.forEach === 'function') {
            exams.forEach(function (doc) {
                if (exam) return;
                const row = doc.data() || {};
                if (row.type === type && eligiblePass(row)) exam = row;
            });
        }
        const user = userSnap.exists ? (userSnap.data() || {}) : null;
        const faucet = faucetSnap.exists ? (faucetSnap.data() || {}) : {};
        const plan = planCertBonus({
            type: type,
            passed: !!exam,
            banned: !user || rewardBlocked(user, faucet),
            alreadyPaid: alreadyPaid(markerSnap, ledgerSnap),
        });
        if (!plan.pay || !userSnap.exists) return plan;
        tx.update(userRef, bonusUserFields(adminSdk, plan));
        writeMarkers(tx, adminSdk, {
            uid: uid,
            type: type,
            markerRef: mRef,
            ledgerRef: lRef,
            day: day,
        }, plan, when);
        return plan;
    });
}

module.exports = {
    CERT_BONUS_XP: CERT_BONUS_XP,
    CERT_BONUS_SOURCE: CERT_BONUS_SOURCE,
    PASS_SCORE: PASS_SCORE,
    keyPrefix: keyPrefix,
    markerId: markerId,
    ledgerId: ledgerId,
    markerRef: markerRef,
    ledgerRef: ledgerRef,
    alreadyPaid: alreadyPaid,
    eligiblePass: eligiblePass,
    planCertBonus: planCertBonus,
    planBackfillRow: planBackfillRow,
    bonusUserFields: bonusUserFields,
    writeMarkers: writeMarkers,
    creditExistingPass: creditExistingPass,
};
