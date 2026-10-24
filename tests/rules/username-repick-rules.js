#!/usr/bin/env node
// Clients cannot set or clear usernameNeedsRepick on users or public_profiles.
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
        '--project', 'demo-username-repick',
        'node tests/rules/username-repick-rules.js',
    ], {
        cwd: root,
        stdio: 'inherit',
        env: Object.assign({}, process.env, { CI: 'true' }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, deleteField } = require('firebase/firestore');

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const parts = emu.split(':');

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-username-repick',
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

    await env.clearFirestore();
    const password = { firebase: { sign_in_provider: 'password' } };
    const user = env.authenticatedContext('user1', password).firestore();
    await env.withSecurityRulesDisabled(async function (ctx) {
        const db = ctx.firestore();
        await setDoc(doc(db, 'users', 'user1'), {
            points: 10,
            username: 'phil',
        });
        await setDoc(doc(db, 'public_profiles', 'user1'), {
            username: 'phil',
            usernameNeedsRepick: true,
        });
    });

    const userRef = doc(user, 'users', 'user1');
    const profileRef = doc(user, 'public_profiles', 'user1');

    await expect('profile bio is still writable', function () {
        return updateDoc(userRef, { bio: 'stacking sats' });
    }, true);
    // The flag is absent on the seeded user, so this is a real set, not a no-op.
    await expect('users cannot set usernameNeedsRepick', function () {
        return updateDoc(userRef, { usernameNeedsRepick: true });
    }, false);
    await env.withSecurityRulesDisabled(async function (ctx) {
        await updateDoc(doc(ctx.firestore(), 'users', 'user1'), { usernameNeedsRepick: true });
    });
    await expect('users cannot set usernameNeedsRepick false', function () {
        return updateDoc(userRef, { usernameNeedsRepick: false });
    }, false);
    await expect('users cannot clear usernameNeedsRepick', function () {
        return updateDoc(userRef, { usernameNeedsRepick: deleteField() });
    }, false);
    await expect('users create cannot set usernameNeedsRepick', function () {
        return setDoc(doc(user, 'users', 'user2'), { points: 0, usernameNeedsRepick: true });
    }, false);
    await expect('public_profiles cannot set usernameNeedsRepick', function () {
        return setDoc(profileRef, { usernameNeedsRepick: false });
    }, false);
    await expect('public_profiles cannot clear usernameNeedsRepick', function () {
        return updateDoc(profileRef, { usernameNeedsRepick: deleteField() });
    }, false);
    await expect('public_profiles cannot set a username', function () {
        return updateDoc(profileRef, { username: 'other' });
    }, false);

    await env.cleanup();
    process.exit(failed > 0 ? 1 : 0);
})().catch(function (err) {
    console.error(err);
    process.exit(1);
});
