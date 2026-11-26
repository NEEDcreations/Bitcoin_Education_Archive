#!/usr/bin/env node
// In-app survey rules: survey_responses and survey_audit are admin-read
// only and nobody writes them from a client (submitSurvey uses the Admin
// SDK). config/survey is public-read, never client-written. Players cannot
// set their own survey-done flag or OrangeTix.
// Uses a throwaway Firestore emulator on 8191 so we don't touch port 8085.
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const root = path.join(__dirname, '..', '..');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
    const cfg = path.join(root, 'firebase.killswitch.json');
    const javaBins = ['/tmp/jre/bin', '/home/box/jre/bin', '/home/box/jdk/jdk-21.0.13+9-jre/bin'].filter(function (d) {
        return fs.existsSync(path.join(d, 'java'));
    });
    const child = spawnSync('npx', [
        '--yes', 'firebase-tools',
        'emulators:exec',
        '--only', 'firestore',
        '--project', 'demo-survey',
        '--config', cfg,
        'node tests/rules/survey-rules.js',
    ], {
        cwd: root,
        stdio: 'inherit',
        env: Object.assign({}, process.env, {
            CI: 'true',
            FIRESTORE_EMULATOR_HOST: '127.0.0.1:8191',
            PATH: javaBins.concat([process.env.PATH || '']).join(path.delimiter),
        }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, getDoc, getDocs, deleteDoc, collection } = require('firebase/firestore');

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8191';
const parts = emu.split(':');

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-survey',
        firestore: { rules: rules, host: parts[0], port: Number(parts[1] || 8191) },
    });
    async function expect(name, run, shouldAllow) {
        try {
            if (shouldAllow) await assertSucceeds(run());
            else await assertFails(run());
            console.log((shouldAllow ? 'ALLOW' : 'DENY ') + '  ' + name + '  ✓');
        } catch (e) {
            failed++;
            console.log((shouldAllow ? 'ALLOW' : 'DENY ') + '  ' + name + '  ✗ ' + (e.message || e));
        }
    }
    const password = { firebase: { sign_in_provider: 'password' } };
    try {
        await env.clearFirestore();
        await env.withSecurityRulesDisabled(async function (ctx) {
            const db = ctx.firestore();
            await setDoc(doc(db, 'users', 'ada'), { displayName: 'Ada', points: 0, streak: 0, orangeTickets: 5 });
            await setDoc(doc(db, 'survey_responses', 'ada'), { uid: 'ada', surveyId: 'citadel_spark_2026', variant: 'full', answers: { q1: 'friend' } });
            await setDoc(doc(db, 'survey_audit', 'a1'), { action: 'survey_reward_granted', uid: 'ada', tickets: 25 });
            await setDoc(doc(db, 'config', 'survey'), { closed: false });
        });
        const ada = env.authenticatedContext('ada', password).firestore();
        const bob = env.authenticatedContext('bob', password).firestore();
        const admin = env.authenticatedContext('phil', { ...password, admin: true }).firestore();
        const anon = env.unauthenticatedContext().firestore();

        await expect('player cannot read their own survey response', function () { return getDoc(doc(ada, 'survey_responses', 'ada')); }, false);
        await expect('another player cannot read a survey response', function () { return getDoc(doc(bob, 'survey_responses', 'ada')); }, false);
        await expect('signed-out visitor cannot read a survey response', function () { return getDoc(doc(anon, 'survey_responses', 'ada')); }, false);
        await expect('admin can read a survey response', function () { return getDoc(doc(admin, 'survey_responses', 'ada')); }, true);
        await expect('player cannot create their own survey response', function () { return setDoc(doc(bob, 'survey_responses', 'bob'), { uid: 'bob', answers: { q1: 'x' } }); }, false);
        await expect('player cannot overwrite a survey response', function () { return updateDoc(doc(ada, 'survey_responses', 'ada'), { variant: 'lapsed' }); }, false);
        await expect('admin cannot write a survey response from the client', function () { return setDoc(doc(admin, 'survey_responses', 'zed'), { uid: 'zed' }); }, false);
        await expect('player cannot delete a survey response', function () { return deleteDoc(doc(ada, 'survey_responses', 'ada')); }, false);
        await expect('player cannot read survey audit', function () { return getDoc(doc(ada, 'survey_audit', 'a1')); }, false);
        await expect('admin can read survey audit', function () { return getDoc(doc(admin, 'survey_audit', 'a1')); }, true);
        await expect('admin cannot write survey audit from the client', function () { return setDoc(doc(admin, 'survey_audit', 'a2'), { action: 'x' }); }, false);
        await expect('player cannot list survey responses', function () { return getDocs(collection(ada, 'survey_responses')); }, false);
        await expect('signed-out visitor can read config/survey', function () { return getDoc(doc(anon, 'config', 'survey')); }, true);
        await expect('player cannot write config/survey', function () { return setDoc(doc(ada, 'config', 'survey'), { closed: true }); }, false);
        await expect('admin cannot write config/survey from the client', function () { return setDoc(doc(admin, 'config', 'survey'), { closed: true }); }, false);
        await expect('control: player can still save an allowed profile field', function () { return updateDoc(doc(ada, 'users', 'ada'), { nachoNickname: 'Nacho' }); }, true);
        await expect('player cannot set their own survey-done flag', function () { return updateDoc(doc(ada, 'users', 'ada'), { surveyDone_citadel_spark_2026: new Date() }); }, false);
        await expect('player cannot raise their own OrangeTix', function () { return updateDoc(doc(ada, 'users', 'ada'), { orangeTickets: 30 }); }, false);
        await expect('player cannot write their own survey award claim', function () { return setDoc(doc(ada, 'users', 'ada', 'award_claims', 'once_survey_citadel_spark_2026'), { tickets: 25 }); }, false);
    } finally {
        await env.cleanup();
    }
    if (failed) {
        console.log('\n' + failed + ' survey rules tests failed');
        process.exit(1);
    }
    console.log('\nAll survey rules tests passed');
})().catch(function (e) {
    console.error(e);
    process.exit(1);
});
