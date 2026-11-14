#!/usr/bin/env node
// Titles and chat flair are server-set. A chat message may only carry the
// flair the server equipped on the sender's profile.
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..', '..');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
    const child = spawnSync('npx', [
        '--yes', 'firebase-tools',
        'emulators:exec',
        '--only', 'firestore',
        '--project', 'demo-title-flair',
        'node tests/rules/title-flair-rules.js',
    ], {
        cwd: root,
        stdio: 'inherit',
        env: Object.assign({}, process.env, { CI: 'true' }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, serverTimestamp } = require('firebase/firestore');

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const parts = emu.split(':');

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-title-flair',
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
    function msg(uid, name, extra) {
        return Object.assign({ uid: uid, name: name, text: 'gm', isNachoAuto: false, ts: serverTimestamp() }, extra || {});
    }
    try {
        await env.clearFirestore();
        const password = { firebase: { sign_in_provider: 'password' } };
        await env.withSecurityRulesDisabled(async function (ctx) {
            const db = ctx.firestore();
            await setDoc(doc(db, 'users', 'plain'), { username: 'plainuser' });
            await setDoc(doc(db, 'users', 'nook'), { username: 'nookuser', ownedCosmetics: ['chat_flair'] });
            await setDoc(doc(db, 'users', 'equip'), { username: 'equipuser', chatFlairEmoji: '🎓', activeTitle: 'col_title_learning' });
        });
        const plain = env.authenticatedContext('plain', password).firestore();
        const nook = env.authenticatedContext('nook', password).firestore();
        const equip = env.authenticatedContext('equip', password).firestore();

        await expect('message with no flair', function () {
            return setDoc(doc(plain, 'global_chat', 'm1'), msg('plain', 'plainuser'));
        }, true);
        await expect('deny flair the sender does not hold', function () {
            return setDoc(doc(plain, 'global_chat', 'm2'), msg('plain', 'plainuser', { hasChatFlair: true, chatFlairEmoji: '⚡🛡️' }));
        }, false);
        await expect('deny hasChatFlair without flair', function () {
            return setDoc(doc(plain, 'global_chat', 'm3'), msg('plain', 'plainuser', { hasChatFlair: true }));
        }, false);
        await expect('Nook owner default flame', function () {
            return setDoc(doc(nook, 'global_chat', 'm4'), msg('nook', 'nookuser', { hasChatFlair: true, chatFlairEmoji: '🔥' }));
        }, true);
        await expect('deny Nook owner unequipped emoji', function () {
            return setDoc(doc(nook, 'global_chat', 'm5'), msg('nook', 'nookuser', { hasChatFlair: true, chatFlairEmoji: '👑' }));
        }, false);
        await expect('equipped flair', function () {
            return setDoc(doc(equip, 'global_chat', 'm6'), msg('equip', 'equipuser', { hasChatFlair: true, chatFlairEmoji: '🎓' }));
        }, true);
        await expect('deny other flair than equipped', function () {
            return setDoc(doc(equip, 'global_chat', 'm7'), msg('equip', 'equipuser', { hasChatFlair: true, chatFlairEmoji: '⚡🛡️' }));
        }, false);
        await expect('deny self-equip flair', function () {
            return updateDoc(doc(equip, 'users', 'equip'), { chatFlairEmoji: '⚡🛡️' });
        }, false);
        await expect('deny self-equip title', function () {
            return updateDoc(doc(equip, 'users', 'equip'), { activeTitle: 'col_title_proof_of_everything' });
        }, false);
        await expect('deny self-grant titles', function () {
            return updateDoc(doc(equip, 'users', 'equip'), { earnedTitles: ['col_title_proof_of_everything'] });
        }, false);
        await expect('deny grandfathered plant', function () {
            return updateDoc(doc(equip, 'users', 'equip'), { grandfatheredTitles: ['hash_god'] });
        }, false);
        await expect('profile bio still writable', function () {
            return updateDoc(doc(equip, 'users', 'equip'), { bio: 'stacking' });
        }, true);
    } finally {
        await env.cleanup();
    }
    process.exit(failed > 0 ? 1 : 0);
})().catch(function (e) {
    console.error(e);
    process.exit(1);
});
