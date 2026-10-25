#!/usr/bin/env node
'use strict';

// Firestore emulator coverage for the scholar exam pass record.
// Re-grading after the profile flags are cleared must not pay XP again.
// issueCertificate must refuse when no passed scholar_exam_keys row exists.

const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
    const child = spawnSync('npx', [
        '--yes', 'firebase-tools',
        'emulators:exec',
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
    assert.strictEqual(after.points, 2110, 'full cert bonus should land on the profile');
    const dailyRows = await db.collection('users').doc(uid).collection('daily_points').get();
    assert.strictEqual(dailyRows.size, 0, 'cert bonus must not open a daily cap counter');
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
