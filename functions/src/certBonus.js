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
// gradeScholarExam is the only caller that can credit a new pass, and it
// pays the full 2,100 for both certifications. The backfill script pays only
// the shortfall (2,100 minus the XP that passing exam already credited) and
// only with --apply. A missing or conflicting record is unknown and pays
// nothing. A pass that already received 2,100 is left alone: no zero-amount
// marker is written. A user who is banned now, or who was banned when they
// passed, is skipped. Nothing here is callable from the browser.

const { rewardBlocked } = require('./cipherClaim');
const { offsetDateKey } = require('./offsetDay');

const CERT_BONUS_XP = 2100;
const CERT_BONUS_SOURCE = 'cert_bonus';
const PASS_SCORE = 20;
// b0979d93 folded the direct 2,100 into the daily taper at this commit.
// A pass graded before this instant was incremented by exactly 2,100.
const CAP_AT_MS = Date.parse('2026-10-23T17:16:31.000Z');

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

function markerData(adminSdk, uid, type, amount, nowMs, priorCredit) {
    const data = {
        uid: uid,
        certType: type,
        source: CERT_BONUS_SOURCE,
        amount: amount,
        countedTowardDailyCap: false,
        createdAtMs: nowMs,
        createdAt: adminSdk.firestore.FieldValue.serverTimestamp(),
    };
    if (priorCredit != null && Number.isFinite(Number(priorCredit))) data.priorCredit = Number(priorCredit);
    return data;
}

function ledgerData(uid, type, amount, day, nowMs, priorCredit) {
    const data = {
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
    if (priorCredit != null && Number.isFinite(Number(priorCredit))) data.priorCredit = Number(priorCredit);
    return data;
}

function writeMarkers(tx, adminSdk, fields, plan, nowMs) {
    if (!plan || plan.pay !== true || !(Number(plan.amount) > 0)) return;
    const when = Number(nowMs) || Date.now();
    const amount = Number(plan.amount);
    const prior = plan.priorCredit;
    tx.set(fields.markerRef, markerData(adminSdk, fields.uid, fields.type, amount, when, prior));
    tx.set(fields.ledgerRef, ledgerData(fields.uid, fields.type, amount, fields.day, when, prior));
}

function cleanAward(value) {
    if (value == null || value === '') return { present: false };
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > CERT_BONUS_XP || Math.round(n) !== n) return { present: true, bad: true };
    return { present: true, amount: n };
}

function timeMs(value) {
    return gradedAtMs({ gradedAt: value });
}

function pushBanWindow(windows, startRaw, endRaw) {
    const start = timeMs(startRaw);
    const end = timeMs(endRaw);
    if (start == null && end == null) return;
    windows.push({ start: start, end: end });
}

function keyBlocksBonus(exam) {
    return !!(exam && exam.bonusBlocked != null && exam.bonusBlocked !== '');
}

// Captures the open ban, then the caller clears bannedAt. A later backfill
// reads this array. An already-clear ledger is left unchanged.
function banHistoryAfterUnban(faucet, nowMs) {
    const src = faucet || {};
    const history = Array.isArray(src.banHistory)
        ? src.banHistory.filter(function (row) { return row && typeof row === 'object'; })
        : [];
    const hadBan = src.banned === true || !!src.ban_reason || src.bannedAt != null;
    if (!hadBan) return history;
    history.push({
        bannedAt: src.bannedAt == null ? null : src.bannedAt,
        unbannedAt: nowMs,
    });
    return history;
}

function banWindows(user, faucet) {
    const windows = [];
    [user, faucet].forEach(function (doc) {
        if (!doc || typeof doc !== 'object') return;
        pushBanWindow(windows, doc.bannedAt, doc.unbannedAt || doc.banEndedAt || doc.unbanAt);
        [doc.banHistory, doc.bans, doc.banWindows].forEach(function (list) {
            if (!Array.isArray(list)) return;
            list.forEach(function (row) {
                if (!row || typeof row !== 'object') return;
                pushBanWindow(
                    windows,
                    row.bannedAt || row.start || row.from,
                    row.unbannedAt || row.banEndedAt || row.end || row.until
                );
            });
        });
    });
    return windows.filter(function (win) { return win.end != null; });
}

// True when a passing exam falls inside a closed ban window, or a closed
// window exists and that exam has no gradedAt. An open bannedAt with no end
// is not a historical window: a current ban is rewardBlocked's job, and a
// leftover start after an unban must not skip every later pass.
function bannedAtPass(user, faucet, exams) {
    const windows = banWindows(user, faucet);
    if (!windows.length) return false;
    const list = exams || [];
    let sawPass = false;
    let clean = false;
    for (let i = 0; i < list.length; i++) {
        if (!eligiblePass(list[i])) continue;
        sawPass = true;
        const when = gradedAtMs(list[i]);
        if (when == null) continue;
        let inside = false;
        for (let w = 0; w < windows.length; w++) {
            const win = windows[w];
            const afterStart = win.start == null || when >= win.start;
            if (afterStart && when < win.end) inside = true;
        }
        if (!inside) clean = true;
    }
    return sawPass && !clean;
}

function gradedAtMs(exam) {
    const g = exam && exam.gradedAt;
    if (g == null || g === '') return null;
    if (typeof g === 'number' && Number.isFinite(g)) return g < 1e12 ? g * 1000 : g;
    if (typeof g === 'string') {
        const parsed = Date.parse(g);
        return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof g.toDate === 'function') {
        const date = g.toDate();
        const ms = date && date.getTime();
        return Number.isFinite(ms) ? ms : null;
    }
    const sec = g.seconds != null ? g.seconds : g._seconds;
    if (typeof sec === 'number' && Number.isFinite(sec)) return sec * 1000;
    return null;
}

// Same id rewardNotify writes for onceKey scholar_prop / scholar_tech.
function gradeNoticeId(uid, type) {
    const prefix = keyPrefix(type);
    if (!prefix) return '';
    const safe = String(uid || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
    return 'rn_' + safe + '_scholar_' + prefix;
}

function ledgerIsExamCredit(doc, type) {
    if (!doc || !TYPES[type]) return false;
    const prefix = keyPrefix(type);
    const id = String(doc.id || '');
    if (id === ledgerId(type) || doc.source === CERT_BONUS_SOURCE) return false;
    if (doc.certType && doc.certType !== type) return false;
    if (id === 'scholar_' + prefix) return true;
    if (doc.source === 'scholar_exam' || doc.source === 'gradeScholarExam') return doc.certType === type;
    return false;
}

// credited is the XP that passing exam already added. known is false when
// the records disagree or a post-cap pass has no stored amount.
function resolvePriorCredit(opts) {
    const src = opts || {};
    const exams = src.exams || (src.exam ? [src.exam] : []);
    const amounts = [];
    let conflict = false;
    function add(hit) {
        if (!hit.present) return;
        if (hit.bad) conflict = true;
        else amounts.push(hit.amount);
    }
    exams.forEach(function (exam) {
        if (!exam) return;
        ['pointsAwarded', 'awarded', 'xp'].forEach(function (key) {
            if (exam[key] == null || exam[key] === '') return;
            add(cleanAward(exam[key]));
        });
    });
    (src.ledgerDocs || []).forEach(function (doc) {
        if (!ledgerIsExamCredit(doc, src.type)) return;
        const raw = doc.awarded != null ? doc.awarded : (doc.amount != null ? doc.amount : doc.xp);
        add(cleanAward(raw));
    });
    if (src.notice && src.notice.xp != null && src.notice.xp !== '') add(cleanAward(src.notice.xp));
    if (conflict) return { known: false, reason: 'unknown' };
    if (amounts.length) {
        const first = amounts[0];
        for (let i = 1; i < amounts.length; i++) {
            if (amounts[i] !== first) return { known: false, reason: 'unknown' };
        }
        return { known: true, credited: first, reason: 'recorded' };
    }
    if (!exams.length) return { known: false, reason: 'unknown' };
    for (let i = 0; i < exams.length; i++) {
        const when = gradedAtMs(exams[i]);
        if (when == null || when >= CAP_AT_MS) return { known: false, reason: 'unknown' };
    }
    return { known: true, credited: CERT_BONUS_XP, reason: 'pre-cap' };
}

function examList(src) {
    if (src.exams && src.exams.length) return src.exams;
    if (src.exam) return [src.exam];
    return [];
}

// Shortfall only. A full pre-cap 2,100 leaves 0. A recorded taper or 0 leaves
// the difference. Unknown and already-settled rows pay nothing.
function planBackfillRow(opts) {
    const src = opts || {};
    const allExams = examList(src);
    const blockedKeys = allExams.filter(keyBlocksBonus);
    const exams = allExams.filter(function (exam) { return !keyBlocksBonus(exam); });
    const row = {
        uid: src.uid || '',
        type: src.type,
        amount: 0,
        shortfall: 0,
        credited: null,
        reason: 'type',
        pay: false,
    };
    if (!TYPES[src.type]) return row;
    const passed = exams.some(eligiblePass);
    if (!passed) {
        if (blockedKeys.some(eligiblePass)) {
            row.reason = 'banned';
            row.credited = 0;
            row.shortfall = 0;
            row.amount = 0;
            return row;
        }
        row.reason = exams.some(function (exam) { return exam && exam.passed === true; }) ? 'unverified-score' : 'not-passed';
        return row;
    }
    const prior = resolvePriorCredit(Object.assign({}, src, { exams: exams }));
    if (src.banned) {
        row.reason = 'banned';
        if (prior.known) row.credited = prior.credited;
        return row;
    }
    if (src.alreadyPaid) {
        row.reason = 'already';
        if (prior.known) row.credited = prior.credited;
        return row;
    }
    if (!prior.known) {
        row.reason = 'unknown';
        return row;
    }
    const shortfall = CERT_BONUS_XP - prior.credited;
    row.credited = prior.credited;
    row.shortfall = shortfall;
    row.amount = shortfall;
    row.pay = shortfall > 0;
    row.reason = shortfall > 0 ? 'shortfall' : 'settled';
    return row;
}

// --apply writes only when XP is still owed. Settled, banned, unknown, and
// already-paid rows stay unmarked, including a zero amount.
function shouldApplyBackfill(row) {
    return !!(row && row.pay === true && Number(row.amount) > 0);
}

// Pays the shortfall for one older pass. The transaction re-reads the exam,
// the grade-result notice, the ledger, and both markers. It does not write a
// marker when nothing is owed, and it does not touch daily_points.
async function creditExistingPass(db, adminSdk, uid, type, nowMs) {
    if (!uid || !TYPES[type]) return planCertBonus({ type: type });
    const userRef = db.collection('users').doc(uid);
    const mRef = markerRef(userRef, type);
    const lRef = ledgerRef(userRef, type);
    const faucetRef = db.collection('faucet_ledger').doc(uid);
    const noticeRef = db.collection('notifications').doc(gradeNoticeId(uid, type));
    const when = Number(nowMs) || Date.now();
    const day = offsetDateKey(when);
    return db.runTransaction(async function (tx) {
        const userSnap = await tx.get(userRef);
        const markerSnap = await tx.get(mRef);
        const ledgerSnap = await tx.get(lRef);
        const faucetSnap = await tx.get(faucetRef);
        const noticeSnap = await tx.get(noticeRef);
        const ledgerCol = await tx.get(userRef.collection('xp_ledger'));
        const exams = await tx.get(db.collection('scholar_exam_keys').where('uid', '==', uid));
        const examRows = [];
        if (exams && typeof exams.forEach === 'function') {
            exams.forEach(function (doc) {
                const data = doc.data() || {};
                if (data.type === type && data.passed === true) examRows.push(data);
            });
        }
        const ledgerDocs = [];
        if (ledgerCol && typeof ledgerCol.forEach === 'function') {
            ledgerCol.forEach(function (doc) {
                ledgerDocs.push(Object.assign({ id: doc.id }, doc.data() || {}));
            });
        }
        const user = userSnap.exists ? (userSnap.data() || {}) : null;
        const faucet = faucetSnap.exists ? (faucetSnap.data() || {}) : {};
        const notice = noticeSnap && noticeSnap.exists === true ? (noticeSnap.data() || {}) : null;
        const row = planBackfillRow({
            uid: uid,
            type: type,
            exams: examRows,
            banned: !user || rewardBlocked(user, faucet) || bannedAtPass(user, faucet, examRows),
            alreadyPaid: alreadyPaid(markerSnap, ledgerSnap),
            ledgerDocs: ledgerDocs,
            notice: notice,
        });
        if (!userSnap.exists || !shouldApplyBackfill(row)) return row;
        const plan = {
            pay: true,
            amount: row.amount,
            priorCredit: row.credited,
            source: CERT_BONUS_SOURCE,
            capExempt: true,
        };
        tx.update(userRef, bonusUserFields(adminSdk, plan));
        writeMarkers(tx, adminSdk, {
            uid: uid,
            type: type,
            markerRef: mRef,
            ledgerRef: lRef,
            day: day,
        }, plan, when);
        return row;
    });
}

module.exports = {
    CERT_BONUS_XP: CERT_BONUS_XP,
    CERT_BONUS_SOURCE: CERT_BONUS_SOURCE,
    PASS_SCORE: PASS_SCORE,
    CAP_AT_MS: CAP_AT_MS,
    keyPrefix: keyPrefix,
    markerId: markerId,
    ledgerId: ledgerId,
    markerRef: markerRef,
    ledgerRef: ledgerRef,
    alreadyPaid: alreadyPaid,
    eligiblePass: eligiblePass,
    planCertBonus: planCertBonus,
    gradeNoticeId: gradeNoticeId,
    resolvePriorCredit: resolvePriorCredit,
    planBackfillRow: planBackfillRow,
    shouldApplyBackfill: shouldApplyBackfill,
    bannedAtPass: bannedAtPass,
    banHistoryAfterUnban: banHistoryAfterUnban,
    keyBlocksBonus: keyBlocksBonus,
    bonusUserFields: bonusUserFields,
    writeMarkers: writeMarkers,
    creditExistingPass: creditExistingPass,
};
