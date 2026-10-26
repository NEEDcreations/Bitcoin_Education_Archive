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

function keys() {
    const rows = [];
    for (let i = 0; i < 25; i++) rows.push({ index: i, correct: 'yes' });
    return rows;
}

function answers() {
    return new Array(25).fill('yes');
}

function errorCode(err) {
    return String((err && err.code) || '').replace(/^functions\//, '');
}

async function main() {
    const uid = 'scholar-user';
    await db.collection('users').doc(uid).set({ username: 'Ada', points: 10, scholarPoints: 0 });
    const examRef = db.collection('scholar_exam_keys').doc(uid + '_properties_1');
    await examRef.set({
        uid: uid,
        type: 'properties',
        keys: keys(),
        graded: false,
    });

    const first = await fns.gradeScholarExam.run({ examId: examRef.id, answers: answers() }, ctx(uid));
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
    await retryRef.set({
        uid: uid,
        type: 'properties',
        keys: keys(),
        graded: false,
    });
    const second = await fns.gradeScholarExam.run({ examId: retryRef.id, answers: answers() }, ctx(uid));
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
    await techRef.set({
        uid: capped,
        type: 'technical',
        keys: keys(),
        graded: false,
    });
    const cappedPass = await fns.gradeScholarExam.run({ examId: techRef.id, answers: answers() }, ctx(capped));
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
    await techRetry.set({ uid: capped, type: 'technical', keys: keys(), graded: false });
    await cappedRef.update({
        certPassed_tech: admin.firestore.FieldValue.delete(),
        certPassedAt_tech: admin.firestore.FieldValue.delete(),
        lastExamAttempt_tech: admin.firestore.FieldValue.delete(),
    });
    const cappedSecond = await fns.gradeScholarExam.run({ examId: techRetry.id, answers: answers() }, ctx(capped));
    assert.strictEqual(cappedSecond.already, true);
    assert.strictEqual(cappedSecond.pointsAwarded, 0);
    assert.strictEqual((await cappedRef.get()).data().points, 2150);

    const race = 'race-user';
    const raceRef = db.collection('users').doc(race);
    await raceRef.set({ username: 'Rae', points: 0, scholarPoints: 0 });
    const raceA = db.collection('scholar_exam_keys').doc(race + '_technical_a');
    const raceB = db.collection('scholar_exam_keys').doc(race + '_technical_b');
    await raceA.set({ uid: race, type: 'technical', keys: keys(), graded: false });
    await raceB.set({ uid: race, type: 'technical', keys: keys(), graded: false });
    const raced = await Promise.all([
        fns.gradeScholarExam.run({ examId: raceA.id, answers: answers() }, ctx(race)).catch(function () {
            return { pointsAwarded: 0, passed: false };
        }),
        fns.gradeScholarExam.run({ examId: raceB.id, answers: answers() }, ctx(race)).catch(function () {
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
    await bannedExam.set({ uid: bannedUid, type: 'technical', keys: keys(), graded: false });
    const bannedGrade = await fns.gradeScholarExam.run({ examId: bannedExam.id, answers: answers() }, ctx(bannedUid));
    assert.strictEqual(bannedGrade.passed, true);
    assert.strictEqual(bannedGrade.pointsAwarded, 0);
    assert.strictEqual((await bannedRef.get()).data().points, 40);
    assert.strictEqual((await bannedRef.collection('cert_bonuses').doc('tech').get()).exists, false);
    assert.strictEqual((await bannedRef.collection('xp_ledger').doc('cert_bonus_tech').get()).exists, false);

    const fakeUid = 'fake-score-user';
    const fakeRef = db.collection('users').doc(fakeUid);
    await fakeRef.set({ username: 'Fay', points: 7, scholarPoints: 0 });
    const fakeExam = db.collection('scholar_exam_keys').doc(fakeUid + '_properties_1');
    await fakeExam.set({ uid: fakeUid, type: 'properties', keys: keys(), graded: false });
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

    const issued = await fns.issueCertificate.run({ type: 'scholar', name: 'Ada' }, ctx(uid));
    assert.strictEqual(issued.success, true);
    assert.ok(issued.certId);
    const stored = await db.collection('certs').doc(issued.certId).get();
    assert.strictEqual(stored.exists, true);
    assert.strictEqual(stored.data().uid, uid);

    console.log('scholar exam emulator ok');
}

main().then(function () {
    process.exit(0);
}).catch(function (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
});
