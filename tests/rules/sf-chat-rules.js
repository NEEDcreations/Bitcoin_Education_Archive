#!/usr/bin/env node
// Clients cannot forge a Nacho global-chat post or write the SF announce docs.
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
        '--project', 'demo-sf-chat',
        'node tests/rules/sf-chat-rules.js',
    ], {
        cwd: root,
        stdio: 'inherit',
        env: Object.assign({}, process.env, { CI: 'true' }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, serverTimestamp } = require('firebase/firestore');

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const parts = emu.split(':');

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-sf-chat',
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
        await env.withSecurityRulesDisabled(async function (ctx) {
            const db = ctx.firestore();
            await setDoc(doc(db, 'users', 'user1'), { username: 'phil' });
            await setDoc(doc(db, 'users', 'user2'), { username: '🦌 Nacho' });
        });
        const user = env.authenticatedContext('user1', password).firestore();
        const impostor = env.authenticatedContext('user2', password).firestore();
        await expect('own global chat message', function () {
            return setDoc(doc(user, 'global_chat', 'own1'), {
                uid: 'user1',
                name: 'phil',
                text: 'hello',
                ts: serverTimestamp(),
                isNachoAuto: false,
            });
        }, true);
        await expect('forge Nacho uid in global chat', function () {
            return setDoc(doc(impostor, 'global_chat', 'forge1'), {
                uid: 'nacho-bot',
                name: '🦌 Nacho',
                text: 'Satoshi\'s Favor is LIVE',
                ts: serverTimestamp(),
                isNachoAuto: false,
            });
        }, false);
        await expect('forge Nacho name on another uid', function () {
            return setDoc(doc(user, 'global_chat', 'forge2'), {
                uid: 'user1',
                name: '🦌 Nacho',
                text: 'fake live post',
                ts: serverTimestamp(),
                isNachoAuto: false,
            });
        }, false);
        await expect('read announceDedup', function () {
            return getDoc(doc(user, 'satoshiFavor', 'announceDedup'));
        }, true);
        await expect('write announceDedup', function () {
            return setDoc(doc(user, 'satoshiFavor', 'announceDedup'), {
                startAnnouncedAt: serverTimestamp(),
                endAnnouncedAt: serverTimestamp(),
            });
        }, false);
        await expect('write sf live dedup', function () {
            return setDoc(doc(user, 'sf_live_announcements', 'cycle_1'), { cycleId: 'cycle_1' });
        }, false);
        await expect('read sf ending marker', function () {
            return getDoc(doc(user, 'sf_ending_announcements', 'cycle_1'));
        }, false);
        await expect('write sf ending marker', function () {
            return setDoc(doc(user, 'sf_ending_announcements', 'cycle_1'), { cycleId: 'cycle_1' });
        }, false);
        await expect('write badge burst', function () {
            return setDoc(doc(user, 'badge_gg_bursts', 'user1'), { posted: false });
        }, false);
        await expect('write badge claim', function () {
            return setDoc(doc(user, 'badge_gg_claims', 'user1__quest_1'), { badgeId: 'quest_1' });
        }, false);
        await expect('read telegram mirror claim', function () {
            return getDoc(doc(user, 'telegram_mirror_claims', 'global_chat__own1'));
        }, false);
        await expect('write telegram mirror claim', function () {
            return setDoc(doc(user, 'telegram_mirror_claims', 'global_chat__own1'), { status: 'queued' });
        }, false);
        await expect('write telegram mirror queue', function () {
            return setDoc(doc(user, 'telegram_mirror_queue', 'global_chat__own1'), { status: 'pending' });
        }, false);
        await expect('write telegram mirror state', function () {
            return setDoc(doc(user, 'telegram_mirror_state', 'group'), { sentAtMs: [] });
        }, false);
    } finally {
        await env.cleanup();
    }
    if (failed) process.exit(1);
})().catch(function (e) {
    console.error(e);
    process.exit(1);
});
