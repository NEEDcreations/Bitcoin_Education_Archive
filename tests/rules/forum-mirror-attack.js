#!/usr/bin/env node
// Mirrored Pleb Talk docs cannot be restored by their author.
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
        '--project', 'demo-forum-mirror',
        'node tests/rules/forum-mirror-attack.js',
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
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const parts = emu.split(':');

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-forum-mirror',
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
        await env.withSecurityRulesDisabled(async function (ctx) {
            const db = ctx.firestore();
            await setDoc(doc(db, 'topic_discussion_limits', 'ada'), {
                lastForumPostMs: Date.now(),
                forumDayCount: 5,
                forumDayKey: '2026-10-23',
            });
            await setDoc(doc(db, 'forum_replies', 'hidden1'), {
                postId: 'tdforum_mining_root1',
                body: '',
                authorId: 'ada',
                authorName: 'Ada',
                createdAt: new Date(),
                origin: 'topic',
                mirrorOf: 'hidden1',
                mirrorSync: 'vh:',
                topicChannel: 'mining',
                topicPost: 'tdfrom_hidden1',
                noAward: true,
                hidden: true,
                deleted: false,
                upvotes: 0,
                voters: [],
            });
            await setDoc(doc(db, 'forum_replies', 'visible1'), {
                postId: 'tdforum_mining_root1',
                body: 'A visible mirrored reply.',
                authorId: 'ada',
                authorName: 'Ada',
                createdAt: new Date(),
                origin: 'topic',
                mirrorOf: 'visible1',
                topicChannel: 'mining',
                topicPost: 'tdfrom_visible1',
                noAward: true,
                hidden: false,
                deleted: false,
                upvotes: 0,
                voters: [],
            });
        });
        await expect('ordinary forum post ignores the topic pace', function () {
            return setDoc(doc(ada, 'forum_posts', 'ordinary1'), {
                title: 'Hello from Pleb Talk',
                authorId: 'ada',
                authorName: 'Ada',
                body: 'A normal post that should not wait on the topic pace.',
                createdAt: serverTimestamp(),
            });
        }, true);
        await expect('ATTACK author sets hidden false and a new body', function () {
            return updateDoc(doc(ada, 'forum_replies', 'hidden1'), {
                hidden: false,
                body: 'Restored by the author after moderation.',
            });
        }, false);
        await expect('ATTACK author clears hidden only', function () {
            return updateDoc(doc(ada, 'forum_replies', 'hidden1'), { hidden: false });
        }, false);
        await expect('ATTACK author edits body while hidden', function () {
            return updateDoc(doc(ada, 'forum_replies', 'hidden1'), { body: 'Still hidden, new words.' });
        }, false);
        await expect('author edits body of a visible mirrored reply', function () {
            return updateDoc(doc(ada, 'forum_replies', 'visible1'), { body: 'A visible mirrored reply, edited.' });
        }, true);
        await expect('ATTACK author changes a mirror field', function () {
            return updateDoc(doc(ada, 'forum_replies', 'visible1'), { origin: 'forum', body: 'Forged origin.' });
        }, false);
    } finally {
        await env.cleanup();
    }
    process.exit(failed > 0 ? 1 : 0);
})().catch(function (e) {
    console.error(e);
    process.exit(1);
});
