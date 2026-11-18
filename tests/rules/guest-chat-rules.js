#!/usr/bin/env node
// Guests (anonymous sessions) can read chat but cannot post. Logged-in
// accounts are unaffected. Guests never write watch-time docs.
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
        '--project', 'demo-guest-chat',
        'node tests/rules/guest-chat-rules.js',
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

const rules = fs.readFileSync(process.env.GUEST_RULES_PATH || path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const parts = emu.split(':');

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-guest-chat',
        firestore: { rules: rules, host: parts[0], port: Number(parts[1] || 8085) },
    });
    async function expect(name, run, shouldAllow) {
        try {
            if (shouldAllow) await assertSucceeds(run());
            else await assertFails(run());
            console.log((shouldAllow ? 'ALLOW' : 'DENY ') + '  ' + name + '  \u2713');
        } catch (e) {
            failed++;
            console.log((shouldAllow ? 'ALLOW' : 'DENY ') + '  ' + name + '  \u2717 ' + (e.message || e));
        }
    }
    try {
        await env.clearFirestore();
        await env.withSecurityRulesDisabled(async function (ctx) {
            const db = ctx.firestore();
            await setDoc(doc(db, 'users', 'real1'), { username: 'phil' });
            await setDoc(doc(db, 'users', 'anon1'), { username: 'guest' });
            await setDoc(doc(db, 'forum_posts', 'p0'), { title: 'Existing post', authorId: 'real1', authorName: 'phil', createdAt: 1 });
        });
        const real = env.authenticatedContext('real1', { firebase: { sign_in_provider: 'password' } }).firestore();
        const google = env.authenticatedContext('real1', { firebase: { sign_in_provider: 'google.com' } }).firestore();
        const anon = env.authenticatedContext('anon1', { firebase: { sign_in_provider: 'anonymous' } }).firestore();

        function post(uid, name) {
            return { title: 'Hello from the trail', body: 'First post here', authorId: uid, authorName: name, createdAt: serverTimestamp() };
        }
        function reply(uid, name) {
            return { postId: 'p0', body: 'Nice post', authorId: uid, authorName: name, createdAt: serverTimestamp() };
        }
        function chat(uid, name) {
            return { uid: uid, name: name, text: 'gm', ts: serverTimestamp(), isNachoAuto: false };
        }

        await expect('guest reads forum posts', function () { return getDoc(doc(anon, 'forum_posts', 'p0')); }, true);
        await expect('guest creates a forum post', function () { return setDoc(doc(anon, 'forum_posts', 'g1'), post('anon1', 'guest')); }, false);
        await expect('logged-in (password) creates a forum post', function () { return setDoc(doc(real, 'forum_posts', 'r1'), post('real1', 'phil')); }, true);
        await expect('logged-in (google) creates a forum post', function () { return setDoc(doc(google, 'forum_posts', 'r2'), post('real1', 'phil')); }, true);
        await expect('guest replies on the forum', function () { return setDoc(doc(anon, 'forum_replies', 'g2'), reply('anon1', 'guest')); }, false);
        await expect('logged-in replies on the forum', function () { return setDoc(doc(real, 'forum_replies', 'r3'), reply('real1', 'phil')); }, true);
        await expect('guest posts in global chat', function () { return setDoc(doc(anon, 'global_chat', 'g3'), chat('anon1', 'guest')); }, false);
        await expect('logged-in posts in global chat', function () { return setDoc(doc(real, 'global_chat', 'r4'), chat('real1', 'phil')); }, true);
        await expect('guest writes TCTV watch time', function () {
            return setDoc(doc(anon, 'tctv_drip_watch', 'anon1_2026-11-18'), { uid: 'anon1', activeMs: 600000 });
        }, false);
        await expect('logged-in writes TCTV watch time directly', function () {
            return setDoc(doc(real, 'tctv_drip_watch', 'real1_2026-11-18'), { uid: 'real1', activeMs: 600000 });
        }, false);
    } finally {
        await env.cleanup();
    }
    if (failed) process.exit(1);
})().catch(function (e) {
    console.error(e);
    process.exit(1);
});
