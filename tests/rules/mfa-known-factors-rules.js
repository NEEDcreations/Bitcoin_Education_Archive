#!/usr/bin/env node
// mfa_known_factors is server-only: no client read or write, even the owner.
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
        '--project', 'demo-mfaknown',
        'node tests/rules/mfa-known-factors-rules.js',
    ], { cwd: root, stdio: 'inherit', env: Object.assign({}, process.env, { CI: 'true' }) });
    process.exit(child.status == null ? 1 : child.status);
}

const fs = require('fs');
const { initializeTestEnvironment, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc } = require('firebase/firestore');

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const parts = emu.split(':');

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-mfaknown',
        firestore: { rules: rules, host: parts[0], port: Number(parts[1] || 8080) },
    });
    async function deny(name, run) {
        try { await assertFails(run()); console.log('DENY   ' + name + '  ✓'); }
        catch (e) { failed++; console.log('DENY   ' + name + '  ✗ ' + (e.message || e)); }
    }
    try {
        await env.clearFirestore();
        await env.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'mfa_known_factors/owner1'), { uid: 'owner1', phones: { f1: { recordedAtMs: 1 } } });
        });
        const owner = env.authenticatedContext('owner1', { firebase: { sign_in_provider: 'password' } }).firestore();
        const adminDb = env.authenticatedContext('admin1', { admin: true, firebase: { sign_in_provider: 'password' } }).firestore();
        const anon = env.unauthenticatedContext().firestore();
        await deny('owner read', () => getDoc(doc(owner, 'mfa_known_factors/owner1')));
        await deny('owner create own', () => setDoc(doc(owner, 'mfa_known_factors/owner2'), { uid: 'owner2' }));
        await deny('owner update (seed a phone)', () => updateDoc(doc(owner, 'mfa_known_factors/owner1'), { 'phones.f2': { recordedAtMs: 0 } }));
        await deny('owner delete', () => deleteDoc(doc(owner, 'mfa_known_factors/owner1')));
        await deny('admin-claim client read', () => getDoc(doc(adminDb, 'mfa_known_factors/owner1')));
        await deny('admin-claim client write', () => setDoc(doc(adminDb, 'mfa_known_factors/owner1'), { phones: {} }));
        await deny('anonymous read', () => getDoc(doc(anon, 'mfa_known_factors/owner1')));
    } finally {
        await env.cleanup();
    }
    console.log(failed ? failed + ' failed' : 'mfa_known_factors rules: all denied');
    process.exit(failed ? 1 : 0);
})();
