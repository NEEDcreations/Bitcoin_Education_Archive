#!/usr/bin/env node
// shareCardsShown: owner string, charset, length. Other profile fields stay as they were.
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
        '--project', 'demo-share-cards',
        'node tests/rules/share-cards.js',
    ], {
        cwd: root,
        stdio: 'inherit',
        env: Object.assign({}, process.env, { CI: 'true' }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc } = require('firebase/firestore');

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const parts = emu.split(':');

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-share-cards',
        firestore: { rules: rules, host: parts[0], port: Number(parts[1] || 8085) },
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
                streak: 4,
                bio: 'hello',
                beatsShowUncensored: false,
                certPassed_prop: false,
            });
        });
        const ref = doc(user, 'users', 'user1');
        await expect('valid shareCardsShown', function () {
            return updateDoc(ref, { shareCardsShown: 'popup:20261026,toast:20261026,streak:30' });
        }, true);
        await expect('bad charset', function () {
            return updateDoc(ref, { shareCardsShown: 'Popup:2026-10-26' });
        }, false);
        await expect('over 1500 chars', function () {
            return updateDoc(ref, { shareCardsShown: 'a'.repeat(1501) });
        }, false);
        await expect('bio still writable', function () {
            return updateDoc(ref, { bio: 'stacking sats' });
        }, true);
        await expect('uncensored Beats still writable', function () {
            return updateDoc(ref, { beatsShowUncensored: true });
        }, true);
        await expect('points still denied', function () {
            return updateDoc(ref, { points: 999 });
        }, false);
        await expect('cert still denied', function () {
            return updateDoc(ref, { certPassed_prop: true });
        }, false);
        await expect('streak still denied', function () {
            return updateDoc(ref, { streak: 30 });
        }, false);
    } finally {
        await env.cleanup();
    }
    if (failed) {
        console.log(failed + ' failed');
        process.exit(1);
    }
    console.log('shareCardsShown rules ok');
})().catch(function (err) {
    console.error(err);
    process.exit(1);
});
