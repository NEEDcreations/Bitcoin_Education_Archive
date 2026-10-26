#!/usr/bin/env node
// Clients cannot write claimReq or the referral visit log.
// Starts the Firestore emulator when FIRESTORE_EMULATOR_HOST is not set.
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..', '..');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
    const child = spawnSync('npx', [
        '--yes', 'firebase-tools',
        'emulators:exec',
        '--only', 'firestore',
        '--project', 'demo-claimreq',
        'node tests/rules/claim-req-rules.js',
    ], {
        cwd: root,
        stdio: 'inherit',
        env: Object.assign({}, process.env, { CI: 'true' }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, deleteField, serverTimestamp } = require('firebase/firestore');

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const parts = emu.split(':');

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-claimreq',
        firestore: { rules: rules, host: parts[0], port: Number(parts[1] || 8080) },
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
    try {
        await env.clearFirestore();
        const password = { firebase: { sign_in_provider: 'password' } };
        const user = env.authenticatedContext('user1', password).firestore();
        await env.withSecurityRulesDisabled(async function (ctx) {
            await setDoc(doc(ctx.firestore(), 'users', 'user1'), {
                username: 'phil',
                points: 10,
                claimReq: { chatAt: 1 },
            });
        });
        const ref = doc(user, 'users', 'user1');
        await expect('profile bio is writable', function () {
            return updateDoc(ref, { bio: 'stacking sats' });
        }, true);
        await expect('client cannot replace claimReq', function () {
            return updateDoc(ref, { claimReq: { chatAt: 9, tctvAt: 9, referralAt: 9 } });
        }, false);
        await expect('client cannot stamp claimReq.chatAt', function () {
            return updateDoc(ref, { 'claimReq.chatAt': 9 });
        }, false);
        await expect('client cannot stamp claimReq.tctvAt', function () {
            return updateDoc(ref, { 'claimReq.tctvAt': 9 });
        }, false);
        await expect('client cannot stamp claimReq.referralAt', function () {
            return updateDoc(ref, { 'claimReq.referralAt': 9 });
        }, false);
        await expect('client cannot write claimReq device hmacs', function () {
            return updateDoc(ref, { 'claimReq.deviceHmacs': ['aa'] });
        }, false);
        await expect('client cannot delete claimReq', function () {
            return updateDoc(ref, { claimReq: deleteField() });
        }, false);
        const newbie = env.authenticatedContext('user2', password).firestore();
        await expect('create without claimReq', function () {
            return setDoc(doc(newbie, 'users', 'user2'), {
                displayName: 'Ada',
                created: serverTimestamp(),
            });
        }, true);
        const planted = env.authenticatedContext('user3', password).firestore();
        await expect('create with claimReq', function () {
            return setDoc(doc(planted, 'users', 'user3'), {
                displayName: 'Ada',
                created: serverTimestamp(),
                claimReq: { chatAt: 1 },
            });
        }, false);
        await expect('referral visit log is server-only', function () {
            return setDoc(doc(user, 'referral_visits', 'abc'), {
                code: 'abcdefgh',
                deviceHmac: 'a'.repeat(64),
                ipHmac: 'b'.repeat(64),
            });
        }, false);
        await expect('visit rate limit docs are server-only', function () {
            return setDoc(doc(user, 'rate_limits', 'refvisit_ip_abc'), { count: 1 });
        }, false);
    } finally {
        await env.cleanup();
    }
    if (failed) {
        console.log(failed + ' claim-req rule checks failed');
        process.exit(1);
    }
    console.log('claim-req rules ok');
})().catch(function (err) {
    console.error(err);
    process.exit(1);
});
