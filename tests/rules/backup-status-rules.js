#!/usr/bin/env node
// backup_status and backup_history are server-only.
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
        '--project', 'demo-backup-status',
        'node tests/rules/backup-status-rules.js',
    ], {
        cwd: root,
        stdio: 'inherit',
        env: Object.assign({}, process.env, { CI: 'true' }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

const fs = require('fs');
const { initializeTestEnvironment, assertFails } = require('@firebase/rules-unit-testing');
const {
    collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
} = require('firebase/firestore');

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const parts = emu.split(':');

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-backup-status',
        firestore: { rules: rules, host: parts[0], port: Number(parts[1] || 8085) },
    });

    async function expectDeny(name, run) {
        try {
            await assertFails(run());
            console.log('DENY   ' + name + '  ✓');
        } catch (e) {
            failed++;
            console.log('DENY   ' + name + '  ✗ ' + (e.message || e));
        }
    }

    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async function (ctx) {
        const db = ctx.firestore();
        await setDoc(doc(db, 'backup_status', 'latest'), { ok: false, detail: 'seed' });
        await setDoc(doc(db, 'backup_history', 'run1'), { ok: false, detail: 'seed' });
    });

    const contexts = [
        ['unauth', env.unauthenticatedContext().firestore()],
        ['auth', env.authenticatedContext('user1', { firebase: { sign_in_provider: 'password' } }).firestore()],
        ['admin-claim', env.authenticatedContext('admin1', { admin: true }).firestore()],
    ];

    for (let i = 0; i < contexts.length; i++) {
        const label = contexts[i][0];
        const db = contexts[i][1];
        const latest = doc(db, 'backup_status', 'latest');
        const history = doc(db, 'backup_history', 'run1');
        await expectDeny(label + ' get backup_status/latest', function () { return getDoc(latest); });
        await expectDeny(label + ' list backup_status', function () { return getDocs(collection(db, 'backup_status')); });
        await expectDeny(label + ' create backup_status', function () {
            return setDoc(doc(db, 'backup_status', 'other'), { ok: true });
        });
        await expectDeny(label + ' update backup_status/latest', function () {
            return updateDoc(latest, { ok: true });
        });
        await expectDeny(label + ' delete backup_status/latest', function () { return deleteDoc(latest); });
        await expectDeny(label + ' get backup_history/run1', function () { return getDoc(history); });
        await expectDeny(label + ' list backup_history', function () { return getDocs(collection(db, 'backup_history')); });
        await expectDeny(label + ' create backup_history', function () {
            return setDoc(doc(db, 'backup_history', 'run2'), { ok: false, expireAt: null });
        });
        await expectDeny(label + ' update backup_history/run1', function () {
            return updateDoc(history, { ok: true });
        });
        await expectDeny(label + ' delete backup_history/run1', function () { return deleteDoc(history); });
    }

    await env.cleanup();
    process.exit(failed > 0 ? 1 : 0);
})().catch(function (err) {
    console.error(err);
    process.exit(1);
});
