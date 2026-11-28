#!/usr/bin/env node
// New accounts may set `created` once, as a server timestamp. Later writes cannot change it.
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..', '..');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
    const child = spawnSync('npx', [
        '--yes', 'firebase-tools',
        'emulators:exec',
        '--only', 'firestore',
        '--project', 'demo-join-date',
        'node tests/rules/join-date-rules.js',
    ], {
        cwd: root,
        stdio: 'inherit',
        env: Object.assign({}, process.env, { CI: 'true' }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, getDoc, serverTimestamp } = require('firebase/firestore');

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const parts = emu.split(':');

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-join-date',
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
        const ada = env.authenticatedContext('ada', password).firestore();
        const adaRef = doc(ada, 'users', 'ada');

        await expect('a new account can be created with a server timestamp created field', function () {
            return setDoc(adaRef, {
                points: 0,
                channelsVisited: 0,
                totalVisits: 1,
                streak: 1,
                created: serverTimestamp(),
            });
        }, true);

        const bea = env.authenticatedContext('bea', password).firestore();
        await expect('a new account can be created without created (trigger may stamp it)', function () {
            return setDoc(doc(bea, 'users', 'bea'), {
                points: 0,
                channelsVisited: 0,
                totalVisits: 1,
                streak: 1,
            });
        }, true);

        const cy = env.authenticatedContext('cy', password).firestore();
        await expect('a new account cannot send a client-chosen created value', function () {
            return setDoc(doc(cy, 'users', 'cy'), {
                points: 0,
                channelsVisited: 0,
                totalVisits: 1,
                streak: 1,
                created: new Date('2026-01-01T00:00:00.000Z'),
            });
        }, false);

        const dee = env.authenticatedContext('dee', password).firestore();
        await expect('a new account cannot write createdAt instead of created', function () {
            return setDoc(doc(dee, 'users', 'dee'), {
                points: 0,
                channelsVisited: 0,
                totalVisits: 1,
                streak: 1,
                createdAt: serverTimestamp(),
            });
        }, false);

        await expect('a later profile save is allowed when created is left alone', function () {
            return updateDoc(adaRef, { displayName: 'Ada Lovelace', country: 'Japan' });
        }, true);

        const after = await getDoc(adaRef);
        const created = after.exists() ? after.data().created : null;
        if (!created) {
            failed++;
            console.log('DENY   created still present after a profile save  ✗ missing');
        } else {
            console.log('ALLOW  created still present after a profile save  ✓');
        }

        await expect('a later write cannot change created', function () {
            return updateDoc(adaRef, { created: serverTimestamp() });
        }, false);

        await expect('a later write cannot add createdAt', function () {
            return updateDoc(adaRef, { createdAt: serverTimestamp() });
        }, false);
    } finally {
        await env.cleanup();
    }
    process.exit(failed > 0 ? 1 : 0);
})().catch(function (e) {
    console.error(e);
    process.exit(1);
});
