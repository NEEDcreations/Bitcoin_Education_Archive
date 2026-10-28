#!/usr/bin/env node
// DM pause fields stay server-only, a paused sender cannot create a message,
// and clients cannot read the alert queues.
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
        '--project', 'demo-dm-guard',
        'node tests/rules/dm-guard-rules.js',
    ], {
        cwd: root,
        stdio: 'inherit',
        env: Object.assign({}, process.env, { CI: 'true' }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, getDoc, deleteField, collection, getDocs } = require('firebase/firestore');

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const parts = emu.split(':');
const password = { firebase: { sign_in_provider: 'password' } };

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-dm-guard',
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
        await env.withSecurityRulesDisabled(async function (ctx) {
            const db = ctx.firestore();
            await setDoc(doc(db, 'users', 'alice'), { displayName: 'Alice', points: 10, dmDisabled: true, dmDisabledReason: 'seed_request', dmDisabledAt: 1 });
            await setDoc(doc(db, 'users', 'bob'), { displayName: 'Bob', points: 10 });
            await setDoc(doc(db, 'users', 'cara'), { displayName: 'Cara', points: 10, dmDisabled: false });
            await setDoc(doc(db, 'dm_conversations', 'alice_bob'), { participants: ['alice', 'bob'], participantNames: { alice: 'Alice', bob: 'Bob' } });
            await setDoc(doc(db, 'dm_conversations', 'bob_cara'), { participants: ['bob', 'cara'] });
            await setDoc(doc(db, 'admin_dm_flags', 'flag1'), { senderUid: 'alice', recipientUid: 'bob', excerpt: 'send me your seed', reasons: ['seed_request'], alerted: false });
            await setDoc(doc(db, 'admin_dm_alerts', 'alert1'), { senderUid: 'bob', recipientUid: 'admin', excerpt: 'hello', alerted: false });
        });

        const alice = env.authenticatedContext('alice', password).firestore();
        const bob = env.authenticatedContext('bob', password).firestore();
        const cara = env.authenticatedContext('cara', password).firestore();
        const dave = env.authenticatedContext('dave', password).firestore();
        const admin = env.authenticatedContext('admin1', { admin: true, firebase: { sign_in_provider: 'password' } }).firestore();

        await expect('paused sender cannot create a DM', function () {
            return setDoc(doc(alice, 'dm_conversations', 'alice_bob', 'messages', 'm1'), {
                senderUid: 'alice',
                text: 'hello'
            });
        }, false);
        await expect('sender cannot clear dmDisabled', function () {
            return updateDoc(doc(alice, 'users', 'alice'), { dmDisabled: false });
        }, false);
        await expect('sender cannot delete the pause fields', function () {
            return updateDoc(doc(alice, 'users', 'alice'), {
                dmDisabled: deleteField(),
                dmDisabledReason: deleteField(),
                dmDisabledAt: deleteField(),
                dmReenabledBy: 'alice'
            });
        }, false);
        await expect('sender can still update a profile field', function () {
            return updateDoc(doc(alice, 'users', 'alice'), { bio: 'stacking sats' });
        }, true);
        await expect('create cannot plant dmDisabled', function () {
            return setDoc(doc(dave, 'users', 'dave'), { displayName: 'Dave', points: 0, dmDisabled: false });
        }, false);
        await expect('create a plain profile still succeeds', function () {
            return setDoc(doc(dave, 'users', 'dave'), { displayName: 'Dave', points: 0 });
        }, true);
        await expect('enabled sender can create a DM', function () {
            return setDoc(doc(bob, 'dm_conversations', 'alice_bob', 'messages', 'm2'), {
                senderUid: 'bob',
                text: 'hello there'
            });
        }, true);
        await expect('explicit false still allows a DM', function () {
            return setDoc(doc(cara, 'dm_conversations', 'bob_cara', 'messages', 'm3'), {
                senderUid: 'cara',
                text: 'see you at the meetup'
            });
        }, true);
        await expect('sender cannot read admin_dm_flags', function () {
            return getDoc(doc(alice, 'admin_dm_flags', 'flag1'));
        }, false);
        await expect('sender cannot list admin_dm_alerts', function () {
            return getDocs(collection(alice, 'admin_dm_alerts'));
        }, false);
        await expect('sender cannot write alerted', function () {
            return setDoc(doc(alice, 'admin_dm_flags', 'flag1'), { alerted: true });
        }, false);
        await expect('admin claim cannot read the flag queue', function () {
            return getDoc(doc(admin, 'admin_dm_flags', 'flag1'));
        }, false);
        await expect('admin claim cannot write an alert', function () {
            return setDoc(doc(admin, 'admin_dm_alerts', 'alert2'), { senderUid: 'admin1', alerted: true });
        }, false);
    } finally {
        await env.cleanup();
    }
    process.exit(failed > 0 ? 1 : 0);
})().catch(function (err) {
    console.error(err);
    process.exit(1);
});
