#!/usr/bin/env node
// Clients cannot write partyCount or announcements/{id}/reactions/{uid}.
// An existing GGs reactions-map update still passes. Starts the Firestore
// emulator when FIRESTORE_EMULATOR_HOST is not set.
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..', '..');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
    const child = spawnSync('npx', [
        '--yes', 'firebase-tools',
        'emulators:exec',
        '--only', 'firestore',
        '--project', 'demo-gg-reaction',
        'node tests/rules/gg-reaction-rules.js',
    ], {
        cwd: root,
        stdio: 'inherit',
        env: Object.assign({}, process.env, { CI: 'true' }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, deleteDoc, getDoc } = require('firebase/firestore');

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const parts = emu.split(':');

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-gg-reaction',
        firestore: { rules: rules, host: parts[0], port: Number(parts[1] || 8080) },
    });
    async function expect(name, run, shouldAllow) {
        try {
            if (shouldAllow) await assertSucceeds(run());
            else await assertFails(run());
            console.log((shouldAllow ? 'ALLOW' : 'DENY ') + '  ' + name + '  ✓');
        } catch (err) {
            failed++;
            console.log((shouldAllow ? 'ALLOW' : 'DENY ') + '  ' + name + '  ✗ ' + (err.message || err));
        }
    }
    try {
        await env.clearFirestore();
        const password = { firebase: { sign_in_provider: 'password' } };
        const anonToken = { firebase: { sign_in_provider: 'anonymous' } };
        const ada = env.authenticatedContext('ada', password).firestore();
        const ben = env.authenticatedContext('ben', password).firestore();
        const guest = env.authenticatedContext('guest', anonToken).firestore();
        const anon = env.unauthenticatedContext().firestore();
        await env.withSecurityRulesDisabled(async function (ctx) {
            const db = ctx.firestore();
            await setDoc(doc(db, 'announcements', 'badge1'), {
                uid: 'nacho-bot',
                text: '🏅 @Pat just earned the Pathfinder badge!',
                postedByUid: 'badge-gg',
                ggKind: 'badge',
                isNachoAuto: true,
                partyCount: 2,
                reactions: {},
            });
            await setDoc(doc(db, 'announcements', 'badge1', 'reactions', 'ada'), { uid: 'ada', at: 1 });
        });
        const post = doc(ada, 'announcements', 'badge1');
        await expect('existing GGs reaction-map write', function () {
            return updateDoc(post, { reactions: { ada: true } });
        }, true);
        await expect('client partyCount write', function () {
            return updateDoc(post, { partyCount: 99 });
        }, false);
        await expect('client partyCount mixed with reactions', function () {
            return updateDoc(post, { partyCount: 3, reactions: { ada: true } });
        }, false);
        await expect('client creates an announcement', function () {
            return setDoc(doc(ada, 'announcements', 'forged'), {
                uid: 'nacho-bot',
                text: 'earned a badge',
                partyCount: 1,
            });
        }, false);
        await expect('client writes own reaction marker', function () {
            return setDoc(doc(ada, 'announcements', 'badge1', 'reactions', 'ada'), { uid: 'ada' });
        }, false);
        await expect('client writes another reaction marker', function () {
            return setDoc(doc(ada, 'announcements', 'badge1', 'reactions', 'ben'), { uid: 'ben' });
        }, false);
        await expect('client deletes a reaction marker', function () {
            return deleteDoc(doc(ada, 'announcements', 'badge1', 'reactions', 'ada'));
        }, false);
        await expect('owner reads own reaction marker', function () {
            return getDoc(doc(ada, 'announcements', 'badge1', 'reactions', 'ada'));
        }, true);
        await expect('other player reads a reaction marker', function () {
            return getDoc(doc(ben, 'announcements', 'badge1', 'reactions', 'ada'));
        }, false);
        await expect('guest writes a reaction marker', function () {
            return setDoc(doc(guest, 'announcements', 'badge1', 'reactions', 'guest'), { uid: 'guest' });
        }, false);
        await expect('signed-out write of partyCount', function () {
            return updateDoc(doc(anon, 'announcements', 'badge1'), { partyCount: 0 });
        }, false);
        const live = await getDoc(post);
        if (!live.exists() || live.data().partyCount !== 2) {
            failed++;
            console.log('DENY   partyCount stayed server-owned  ✗');
        } else {
            console.log('ALLOW  partyCount stayed server-owned  ✓');
        }
    } finally {
        await env.cleanup();
    }
    process.exit(failed > 0 ? 1 : 0);
})().catch(function (err) {
    console.error(err);
    process.exit(1);
});
