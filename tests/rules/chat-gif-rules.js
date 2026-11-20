#!/usr/bin/env node
// Global chat GIF/image posts must point at the sender's own chat upload or
// the GIF search CDNs. Text messages and admin posts are unchanged.
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
        '--project', 'demo-chat-gif',
        'node tests/rules/chat-gif-rules.js',
    ], { cwd: root, stdio: 'inherit', env: Object.assign({}, process.env, { CI: 'true' }) });
    process.exit(child.status == null ? 1 : child.status);
}

const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, serverTimestamp } = require('firebase/firestore');

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const parts = emu.split(':');

const BUCKET = 'https://firebasestorage.googleapis.com/v0/b/bitcoin-education-archive.firebasestorage.app/o/';
const own = (uid, f) => BUCKET + 'chat-images%2F' + uid + '%2F' + (f || '1731630000000_abc123.gif') + '?alt=media&token=test-token';

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-chat-gif',
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
            await setDoc(doc(db, 'users', 'user2'), { username: 'other' });
        });
        const user = env.authenticatedContext('user1', password).firestore();
        let n = 0;
        const post = (text, extra) => setDoc(doc(user, 'global_chat', 'gif' + (++n)),
            Object.assign({ uid: 'user1', name: 'phil', text: text, ts: serverTimestamp(), isNachoAuto: false }, extra || {}));

        await expect('plain text message', () => post('gm'), true);
        await expect('own uploaded GIF', () => post(own('user1'), { isGif: true }), true);
        await expect('own uploaded PNG (image posts use isGif too)', () => post(own('user1', '1731_abc.png'), { isGif: true }), true);
        await expect('own GIF with caption', () => post(own('user1'), { isGif: true, caption: 'stack sats' }), true);
        await expect('Giphy GIF from search', () => post('https://media2.giphy.com/media/abc123/giphy-downsized.gif?cid=790b&rid=giphy.gif&ct=g', { isGif: true }), true);
        await expect('Tenor GIF', () => post('https://media.tenor.com/abcDEF/tenor.gif', { isGif: true }), true);
        await expect('outside host GIF', () => post('https://evil.example/pixel.gif', { isGif: true }), false);
        await expect('short outside host GIF', () => post('https://e.x/p.gif', { isGif: true }), false);
        await expect('lookalike Giphy host', () => post('https://media.giphy.com.evil.example/x.gif', { isGif: true }), false);
        await expect('someone else\'s upload', () => post(own('user2'), { isGif: true }), false);
        await expect('other bucket', () => post(own('user1').replace('bitcoin-education-archive', 'attacker-proj'), { isGif: true }), false);
        await expect('http (not https) Giphy', () => post('http://media2.giphy.com/media/abc/giphy.gif', { isGif: true }), false);
        await expect('data URL as GIF', () => post('data:image/gif;base64,R0lGODlhAQABAAAAACw=', { isGif: true }), false);
        await expect('quote in GIF URL', () => post('https://media.tenor.com/a"b.gif', { isGif: true }), false);
        await expect('over 500 chars', () => post('https://media.tenor.com/' + 'a'.repeat(490) + '.gif', { isGif: true }), false);
    } finally {
        await env.cleanup();
    }
    if (failed) process.exit(1);
})().catch(function (e) { console.error(e); process.exit(1); });
