#!/usr/bin/env node
'use strict';

// Firestore emulator coverage for the scholar exam pass record.
// Re-grading after the profile flags are cleared must not pay XP again.
// issueCertificate must refuse when no passed scholar_exam_keys row exists.

const assert = require('assert');
const fs = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

function freeFirestorePort(start) {
    const script = [
        "const net = require('net');",
        'const start = ' + start + ';',
        'function tryPort(p) {',
        '  if (p > start + 30) { console.log(String(start)); process.exit(0); }',
        '  const server = net.createServer();',
        "  server.once('error', function () { tryPort(p + 1); });",
        "  server.listen(p, '127.0.0.1', function () {",
        "    server.close(function () { console.log(String(p)); process.exit(0); });",
        '  });',
        '}',
        'tryPort(start);',
    ].join('\n');
    const out = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
    const port = parseInt(String(out.stdout || '').trim(), 10);
    return Number.isFinite(port) ? port : start;
}

if (!process.env.FIRESTORE_EMULATOR_HOST) {
    const port = freeFirestorePort(8085);
    const cfg = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
    cfg.emulators = cfg.emulators || {};
    cfg.emulators.firestore = Object.assign({}, cfg.emulators.firestore, { port: port });
    const cfgPath = path.join('/tmp', 'firebase-scholar-' + port + '.json');
    fs.writeFileSync(cfgPath, JSON.stringify(cfg));
    const child = spawnSync('npx', [
        '--yes', 'firebase-tools',
        'emulators:exec',
        '--config', cfgPath,
        '--only', 'firestore',
        '--project', 'demo-scholar',
        'node tests/test-scholar-exam-emulator.js',
    ], {
        cwd: root,
        stdio: 'inherit',
        env: Object.assign({}, process.env, { CI: 'true' }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

let firebaseConfig = {};
try { firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG || '{}'); } catch (e) { firebaseConfig = {}; }
if (!firebaseConfig.projectId) firebaseConfig.projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'demo-scholar';
process.env.FIREBASE_CONFIG = JSON.stringify(firebaseConfig);
process.env.GCLOUD_PROJECT = firebaseConfig.projectId;
process.env.GOOGLE_CLOUD_PROJECT = firebaseConfig.projectId;
require('./totp-emulator-auth');

const admin = require('../functions/node_modules/firebase-admin');
const fns = require('../functions/index.js');
const db = admin.firestore();

function ctx(uid) {
    return {
        auth: {
            uid: uid,
            token: {
                firebase: { sign_in_provider: 'password' },
                auth_time: Math.floor(Date.now() / 1000),
            },
        },
    };
}

const attemptLib = require('../functions/src/scholarAttempt');

function pack(prefix) {
    const served = [];
    const answers = [];
    for (let i = 0; i < 25; i++) {
        const questionId = prefix + '-q' + i;
        const optionId = prefix + '-ok' + i;
        served.push({
            questionId: questionId,
            correctOptionId: optionId,
            optionIds: [optionId, prefix + '-no' + i],
        });
        answers.push({ questionId: questionId, optionId: optionId });
    }
    return { served: served, answers: answers };
}

async function plant(id, uid, type, opts) {
    const options = opts || {};
    const packed = pack(id);
    const startedAtMs = options.startedAtMs != null ? options.startedAtMs : (Date.now() - 90000);
    await db.collection('scholar_exam_keys').doc(id).set({
        uid: uid,
        type: type,
        served: packed.served,
        startedAtMs: startedAtMs,
        graded: false,
    });
    if (options.slot !== false) {
        const field = type === 'technical' ? 'examSlotId_tech' : 'examSlotId_prop';
        const patch = {};
        patch[field] = id;
        await db.collection('users').doc(uid).set(patch, { merge: true });
    }
    return packed;
}

function errorCode(err) {
    return String((err && err.code) || '').replace(/^functions\//, '');
}

async function main() {
    const uid = 'scholar-user';
    await db.collection('users').doc(uid).set({ username: 'Ada', points: 10, scholarPoints: 0 });
    const examRef = db.collection('scholar_exam_keys').doc(uid + '_properties_1');
    const firstPack = await plant(examRef.id, uid, 'properties');

    const first = await fns.gradeScholarExam.run({ examId: examRef.id, answers: firstPack.answers }, ctx(uid));
    assert.strictEqual(first.passed, true, 'first exam should pass');
    assert.strictEqual(first.pointsAwarded, 2100);
    assert.strictEqual(first.capExempt, true);
    assert.strictEqual(first.already, false);
    const after = (await db.collection('users').doc(uid).get()).data();
    assert.strictEqual(after.certPassed_prop, true);
    assert.strictEqual(after.scholarPoints, 2100);
    // 10 starting points + 2,100 cert bonus + the existing 150 scholar badge.
    // The badge still shares the daily cap. The cert bonus does not.
    assert.strictEqual(after.points, 2260, 'full cert bonus should land on the profile');
    const dailyRows = await db.collection('users').doc(uid).collection('daily_points').get();
    assert.strictEqual(dailyRows.size, 1);
    assert.strictEqual(dailyRows.docs[0].data().total, 150, 'only the scholar badge counts toward the daily cap');
    const marker = await db.collection('users').doc(uid).collection('cert_bonuses').doc('prop').get();
    assert.strictEqual(marker.exists, true);
    assert.strictEqual(marker.data().source, 'cert_bonus');
    assert.strictEqual(marker.data().amount, 2100);
    assert.strictEqual(marker.data().countedTowardDailyCap, false);
    const ledger = await db.collection('users').doc(uid).collection('xp_ledger').doc('cert_bonus_prop').get();
    assert.strictEqual(ledger.exists, true);
    assert.strictEqual(ledger.data().source, 'cert_bonus');
    assert.strictEqual(ledger.data().awarded, 2100);
    const pointsAfterFirst = after.points;
    const scholarPointsAfterFirst = after.scholarPoints;
    const passedRow = (await examRef.get()).data();
    assert.strictEqual(passedRow.passed, true);
    assert.strictEqual(passedRow.pointsAwarded, 2100);

    await db.collection('users').doc(uid).update({
        certPassed_prop: admin.firestore.FieldValue.delete(),
        certPassedAt_prop: admin.firestore.FieldValue.delete(),
        lastExamAttempt_prop: admin.firestore.FieldValue.delete(),
        scholar_exam_passed: admin.firestore.FieldValue.delete(),
        scholar_tech_passed: admin.firestore.FieldValue.delete(),
        scholar_tech_score: admin.firestore.FieldValue.delete(),
    });

    const retryRef = db.collection('scholar_exam_keys').doc(uid + '_properties_2');
    const retryPack = await plant(retryRef.id, uid, 'properties', { slot: false });
    const second = await fns.gradeScholarExam.run({ examId: retryRef.id, answers: retryPack.answers }, ctx(uid));
    assert.strictEqual(second.passed, false);
    assert.strictEqual(second.pointsAwarded, 0);
    assert.strictEqual(second.blocked, 'already_certified');
    assert.strictEqual(second.already, true);
    const afterRetry = (await db.collection('users').doc(uid).get()).data();
    assert.strictEqual(afterRetry.points, pointsAfterFirst, 'cleared flags must not pay the exam again');
    assert.strictEqual(afterRetry.scholarPoints, scholarPointsAfterFirst);
    const retryDoc = (await retryRef.get()).data();
    assert.strictEqual(retryDoc.passed, false);
    assert.strictEqual(retryDoc.blocked, 'already_certified');
    assert.strictEqual((await examRef.get()).data().passed, true);

    const bare = 'bare-user';
    await db.collection('users').doc(bare).set({
        username: 'Bea',
        certPassed_prop: true,
        scholar_exam_passed: true,
        certPassed_tech: true,
        scholar_tech_passed: true,
        scholar_tech_score: 25,
    });
    let refused = null;
    try {
        await fns.issueCertificate.run({ type: 'scholar', name: 'Bea' }, ctx(bare));
    } catch (err) {
        refused = err;
    }
    assert.ok(refused, 'issueCertificate should refuse without an exam record');
    assert.strictEqual(errorCode(refused), 'permission-denied');
    let refusedTech = null;
    try {
        await fns.issueCertificate.run({ type: 'technical', name: 'Bea' }, ctx(bare));
    } catch (err) {
        refusedTech = err;
    }
    assert.ok(refusedTech, 'technical certificate should also require an exam record');
    assert.strictEqual(errorCode(refusedTech), 'permission-denied');
    const forgedCerts = await db.collection('certs').where('uid', '==', bare).get();
    assert.strictEqual(forgedCerts.empty, true);

    const capped = 'capped-user';
    const cappedRef = db.collection('users').doc(capped);
    await cappedRef.set({ username: 'Cara', points: 50, scholarPoints: 0 });
    const { offsetDateKey } = require('../functions/src/offsetDay');
    const day = offsetDateKey(Date.now());
    await cappedRef.collection('daily_points').doc(day).set({ total: 1000 });
    const techRef = db.collection('scholar_exam_keys').doc(capped + '_technical_1');
    const techPack = await plant(techRef.id, capped, 'technical');
    const cappedPass = await fns.gradeScholarExam.run({ examId: techRef.id, answers: techPack.answers }, ctx(capped));
    assert.strictEqual(cappedPass.passed, true);
    assert.strictEqual(cappedPass.pointsAwarded, 2100, 'a full-cap day still pays the cert bonus');
    assert.strictEqual(cappedPass.capExempt, true);
    const cappedUser = (await cappedRef.get()).data();
    assert.strictEqual(cappedUser.points, 2150);
    assert.strictEqual(cappedUser.scholarPoints, 2100);
    assert.strictEqual(cappedUser.certPassed_tech, true);
    const cappedDay = await cappedRef.collection('daily_points').doc(day).get();
    assert.strictEqual(cappedDay.data().total, 1000, 'cert bonus must not raise the daily counter');
    const techMarker = await cappedRef.collection('cert_bonuses').doc('tech').get();
    assert.strictEqual(techMarker.data().source, 'cert_bonus');
    const techLedger = await cappedRef.collection('xp_ledger').doc('cert_bonus_tech').get();
    assert.strictEqual(techLedger.data().source, 'cert_bonus');
    assert.strictEqual(techLedger.data().awarded, 2100);
    assert.strictEqual((await techRef.get()).data().pointsAwarded, 2100, 'protocol expert records the same 2,100');

    const techRetry = db.collection('scholar_exam_keys').doc(capped + '_technical_2');
    const techRetryPack = await plant(techRetry.id, capped, 'technical', { slot: false });
    await cappedRef.update({
        certPassed_tech: admin.firestore.FieldValue.delete(),
        certPassedAt_tech: admin.firestore.FieldValue.delete(),
        lastExamAttempt_tech: admin.firestore.FieldValue.delete(),
    });
    const cappedSecond = await fns.gradeScholarExam.run({ examId: techRetry.id, answers: techRetryPack.answers }, ctx(capped));
    assert.strictEqual(cappedSecond.already, true);
    assert.strictEqual(cappedSecond.pointsAwarded, 0);
    assert.strictEqual((await cappedRef.get()).data().points, 2150);

    const race = 'race-user';
    const raceRef = db.collection('users').doc(race);
    await raceRef.set({ username: 'Rae', points: 0, scholarPoints: 0 });
    const raceA = db.collection('scholar_exam_keys').doc(race + '_technical_a');
    const raceB = db.collection('scholar_exam_keys').doc(race + '_technical_b');
    const racePackA = await plant(raceA.id, race, 'technical');
    const racePackB = await plant(raceB.id, race, 'technical', { slot: false });
    const raced = await Promise.all([
        fns.gradeScholarExam.run({ examId: raceA.id, answers: racePackA.answers }, ctx(race)).catch(function () {
            return { pointsAwarded: 0, passed: false };
        }),
        fns.gradeScholarExam.run({ examId: raceB.id, answers: racePackB.answers }, ctx(race)).catch(function () {
            return { pointsAwarded: 0, passed: false };
        }),
    ]);
    const racePaid = raced.reduce(function (sum, row) { return sum + (Number(row.pointsAwarded) || 0); }, 0);
    assert.strictEqual(racePaid, 2100, 'two concurrent grades pay the cert bonus once');
    assert.strictEqual(raced.filter(function (row) { return row.pointsAwarded === 2100; }).length, 1);
    assert.strictEqual(raced.filter(function (row) { return row.pointsAwarded === 0; }).length, 1);
    const raceUser = (await raceRef.get()).data();
    assert.strictEqual(raceUser.points, 2100);
    assert.strictEqual(raceUser.scholarPoints, 2100);
    const raceMarkers = await raceRef.collection('cert_bonuses').get();
    assert.strictEqual(raceMarkers.size, 1);
    assert.strictEqual(raceMarkers.docs[0].data().amount, 2100);

    const bannedUid = 'banned-user';
    const bannedRef = db.collection('users').doc(bannedUid);
    await bannedRef.set({ username: 'Ban', points: 40, scholarPoints: 0, banned: true, ban_reason: 'abuse' });
    const bannedExam = db.collection('scholar_exam_keys').doc(bannedUid + '_technical_1');
    const bannedPack = await plant(bannedExam.id, bannedUid, 'technical');
    const bannedGrade = await fns.gradeScholarExam.run({ examId: bannedExam.id, answers: bannedPack.answers }, ctx(bannedUid));
    assert.strictEqual(bannedGrade.passed, true);
    assert.strictEqual(bannedGrade.pointsAwarded, 0);
    assert.strictEqual((await bannedRef.get()).data().points, 40);
    assert.strictEqual((await bannedRef.collection('cert_bonuses').doc('tech').get()).exists, false);
    assert.strictEqual((await bannedRef.collection('xp_ledger').doc('cert_bonus_tech').get()).exists, false);
    const bannedExamData = (await bannedExam.get()).data();
    assert.strictEqual(bannedExamData.bonusBlocked, 'banned');
    assert.ok(bannedExamData.bonusBlockedAt, 'a withheld ban bonus stamps when it was blocked');
    let bannedIssue = null;
    try {
        await fns.issueCertificate.run({ type: 'technical', name: 'Ban' }, ctx(bannedUid));
    } catch (err) {
        bannedIssue = err;
    }
    assert.strictEqual(errorCode(bannedIssue), 'permission-denied');
    assert.strictEqual((await db.collection('cert_by_user').doc(bannedUid + '_technical').get()).exists, false);
    assert.strictEqual((await db.collection('certs').where('name', '==', 'Ban').get()).empty, true);
    const certBonus = require('../functions/src/certBonus');
    const banHistory = certBonus.banHistoryAfterUnban({
        banned: true,
        ban_reason: 'abuse',
        bannedAt: new Date(Date.now() - 86400000).toISOString(),
    }, Date.now() + 60000);
    await bannedRef.update({
        banned: admin.firestore.FieldValue.delete(),
        ban_reason: admin.firestore.FieldValue.delete(),
    });
    await db.collection('faucet_ledger').doc(bannedUid).set({ banned: false, banHistory: banHistory });
    const owed = await certBonus.creditExistingPass(db, admin, bannedUid, 'technical', Date.now());
    assert.strictEqual(owed.pay, false);
    assert.strictEqual(Number(owed.amount) || 0, 0);
    assert.strictEqual(owed.reason, 'banned');
    assert.strictEqual((await bannedRef.get()).data().points, 40);
    assert.strictEqual((await bannedRef.collection('cert_bonuses').doc('tech').get()).exists, false);

    const fakeUid = 'fake-score-user';
    const fakeRef = db.collection('users').doc(fakeUid);
    await fakeRef.set({ username: 'Fay', points: 7, scholarPoints: 0 });
    const fakeExam = db.collection('scholar_exam_keys').doc(fakeUid + '_properties_1');
    await plant(fakeExam.id, fakeUid, 'properties');
    const fakeGrade = await fns.gradeScholarExam.run({
        examId: fakeExam.id,
        answers: new Array(25).fill('no'),
        score: 25,
        passed: true,
    }, ctx(fakeUid));
    assert.strictEqual(fakeGrade.score, 0);
    assert.strictEqual(fakeGrade.passed, false);
    assert.strictEqual(fakeGrade.pointsAwarded, 0);
    assert.strictEqual((await fakeRef.get()).data().points, 7);
    assert.strictEqual((await fakeRef.collection('cert_bonuses').doc('prop').get()).exists, false);

    const issued = await fns.issueCertificate.run({ type: 'scholar', name: 'Someone Else' }, ctx(uid));
    assert.strictEqual(issued.success, true);
    assert.ok(issued.certId);
    assert.strictEqual(issued.name, 'Ada');
    assert.strictEqual(issued.score, 25);
    const stored = await db.collection('certs').doc(issued.certId).get();
    assert.strictEqual(stored.exists, true);
    assert.strictEqual(stored.data().uid, undefined);
    assert.strictEqual(stored.data().name, 'Ada');
    assert.strictEqual(stored.data().score, 25);
    assert.strictEqual(stored.data().quest, 'bitcoin-scholar');
    const owner = await db.collection('cert_owners').doc(issued.certId).get();
    assert.strictEqual(owner.data().uid, uid);
    const again = await fns.issueCertificate.run({ type: 'scholar', name: 'Changed' }, ctx(uid));
    assert.strictEqual(again.certId, issued.certId);
    assert.strictEqual(again.name, 'Ada');
    const certRows = await db.collection('certs').get();
    const adaCerts = certRows.docs.filter(function (doc) { return doc.data().name === 'Ada' && doc.data().type === 'scholar'; });
    assert.strictEqual(adaCerts.length, 1);

    const knownUid = 'known-key-user';
    await db.collection('users').doc(knownUid).set({ username: 'Kim', points: 4, scholarPoints: 0 });
    const knownPack = await plant('known-exam', knownUid, 'properties');
    const textAnswers = knownPack.served.map(function (row) {
        return { questionId: row.questionId, optionId: 'yes' };
    });
    const knownGrade = await fns.gradeScholarExam.run({
        examId: 'known-exam',
        answers: textAnswers,
        score: 25,
        passed: true,
    }, ctx(knownUid));
    assert.ok(knownGrade.score < 20);
    assert.strictEqual(knownGrade.passed, false);
    assert.strictEqual(knownGrade.pointsAwarded, 0);

    const fastUid = 'fast-user';
    await db.collection('users').doc(fastUid).set({ username: 'Fay', points: 2, scholarPoints: 0 });
    const fastPack = await plant('fast-exam', fastUid, 'properties', { startedAtMs: Date.now() - 1000 });
    let fastErr = null;
    try {
        await fns.gradeScholarExam.run({ examId: 'fast-exam', answers: fastPack.answers }, ctx(fastUid));
    } catch (err) {
        fastErr = err;
    }
    assert.strictEqual(errorCode(fastErr), 'failed-precondition');
    assert.strictEqual((await db.collection('scholar_exam_keys').doc('fast-exam').get()).data().graded, false);
    assert.strictEqual((await db.collection('users').doc(fastUid).get()).data().points, 2);

    const expiredUid = 'expired-user';
    await db.collection('users').doc(expiredUid).set({ username: 'Eve', points: 2, scholarPoints: 0 });
    const expiredAt = Date.now() - attemptLib.EXAM_LIMIT_MS - attemptLib.EXAM_GRACE_MS - 1000;
    const expiredPack = await plant('expired-exam', expiredUid, 'properties', { startedAtMs: expiredAt });
    let expiredErr = null;
    try {
        await fns.gradeScholarExam.run({ examId: 'expired-exam', answers: expiredPack.answers }, ctx(expiredUid));
    } catch (err) {
        expiredErr = err;
    }
    assert.strictEqual(errorCode(expiredErr), 'deadline-exceeded');
    assert.strictEqual((await db.collection('scholar_exam_keys').doc('expired-exam').get()).data().graded, false);

    const strayUid = 'stray-user';
    await db.collection('users').doc(strayUid).set({ username: 'Sue', points: 2, scholarPoints: 0 });
    const strayPack = await plant('stray-exam', strayUid, 'properties');
    const strayAnswers = strayPack.answers.slice();
    strayAnswers[0] = { questionId: 'not-in-this-attempt', optionId: strayPack.served[0].correctOptionId };
    let strayErr = null;
    try {
        await fns.gradeScholarExam.run({ examId: 'stray-exam', answers: strayAnswers }, ctx(strayUid));
    } catch (err) {
        strayErr = err;
    }
    assert.strictEqual(errorCode(strayErr), 'invalid-argument');
    assert.strictEqual((await db.collection('scholar_exam_keys').doc('stray-exam').get()).data().graded, false);
    assert.strictEqual((await db.collection('users').doc(strayUid).get()).data().points, 2);

    const starter = 'start-user';
    await db.collection('users').doc(starter).set({ username: 'Sam', points: 0, scholarPoints: 0 });
    const started = await Promise.all([
        fns.startScholarExam.run({ type: 'properties' }, ctx(starter)),
        fns.startScholarExam.run({ type: 'properties' }, ctx(starter)),
    ]);
    assert.strictEqual(started[0].examId, started[1].examId);
    assert.strictEqual(started[0].questions.length, 25);
    assert.ok(!JSON.stringify(started[0].questions).includes('correctOptionId'));
    const startRows = await db.collection('scholar_exam_keys').where('uid', '==', starter).get();
    assert.strictEqual(startRows.size, 1);

    let passedStart = null;
    try {
        await fns.startScholarExam.run({ type: 'properties' }, ctx(uid));
    } catch (err) {
        passedStart = err;
    }
    assert.strictEqual(errorCode(passedStart), 'failed-precondition');

    const dailyUid = 'daily-user';
    const oldId = 'daily-old';
    await db.collection('users').doc(dailyUid).set({
        username: 'Day',
        points: 1,
        lastExamAttempt_prop: new Date().toISOString().slice(0, 10),
        examSlotId_prop: oldId,
    });
    await db.collection('scholar_exam_keys').doc(oldId).set({
        uid: dailyUid,
        type: 'properties',
        graded: false,
        startedAtMs: Date.now() - attemptLib.EXAM_LIMIT_MS - attemptLib.EXAM_GRACE_MS - 1000,
        questions: [],
        served: [],
    });
    let dailyErr = null;
    try {
        await fns.startScholarExam.run({ type: 'properties' }, ctx(dailyUid));
    } catch (err) {
        dailyErr = err;
    }
    assert.strictEqual(errorCode(dailyErr), 'resource-exhausted');
    const dailyExamRows = await db.collection('scholar_exam_keys').where('uid', '==', dailyUid).get();
    assert.strictEqual(dailyExamRows.size, 1);

    const nextUid = 'next-day-user';
    await db.collection('users').doc(nextUid).set({
        username: 'Nia',
        points: 3,
        scholarPoints: 0,
        examSlotId_prop: 'next-slot',
        lastExamAttempt_prop: '2000-01-01',
    });
    const latePack = await plant('next-late', nextUid, 'properties', { slot: false });
    let nextErr = null;
    try {
        await fns.gradeScholarExam.run({ examId: 'next-late', answers: latePack.answers }, ctx(nextUid));
    } catch (err) {
        nextErr = err;
    }
    assert.strictEqual(errorCode(nextErr), 'resource-exhausted');
    assert.strictEqual((await db.collection('scholar_exam_keys').doc('next-late').get()).data().graded, false);
    assert.strictEqual((await db.collection('users').doc(nextUid).get()).data().points, 3);

    const { initializeTestEnvironment, assertSucceeds, assertFails } = require(path.join(root, 'tests/rules/node_modules/@firebase/rules-unit-testing'));
    const { doc, getDoc, getDocs, collection, setDoc, updateDoc } = require(path.join(root, 'tests/rules/node_modules/firebase/firestore'));
    const emu = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const env = await initializeTestEnvironment({
        projectId: firebaseConfig.projectId,
        firestore: { rules: rules, host: emu[0], port: Number(emu[1]) },
    });
    const guest = env.unauthenticatedContext();
    const dbClient = guest.firestore();
    await assertSucceeds(getDoc(doc(dbClient, 'certs', issued.certId)));
    await assertFails(getDocs(collection(dbClient, 'certs')));
    await assertFails(setDoc(doc(dbClient, 'certs', 'CERT-FORGED0001'), { name: 'Forged', type: 'scholar' }));
    await assertFails(updateDoc(doc(dbClient, 'certs', issued.certId), { name: 'Forged' }));
    await assertFails(getDoc(doc(dbClient, 'scholar_exam_keys', examRef.id)));
    await assertFails(getDoc(doc(dbClient, 'cert_owners', issued.certId)));
    await assertFails(getDocs(collection(dbClient, 'cert_by_user')));

    console.log('scholar exam emulator ok');
}

main().then(function () {
    process.exit(0);
}).catch(function (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
});
