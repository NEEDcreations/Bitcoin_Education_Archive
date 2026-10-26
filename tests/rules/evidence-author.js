#!/usr/bin/env node
// Author fields stay frozen, and award_doc_claims is server-only.
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..', '..');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
    const child = spawnSync('npx', [
        '--yes', 'firebase-tools',
        'emulators:exec',
        '--only', 'firestore',
        '--project', 'demo-evidence-author',
        'node tests/rules/evidence-author.js',
    ], {
        cwd: root,
        stdio: 'inherit',
        env: Object.assign({}, process.env, { CI: 'true' }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc } = require('firebase/firestore');

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const parts = emu.split(':');

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-evidence-author',
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
    try {
        await env.clearFirestore();
        const password = { firebase: { sign_in_provider: 'password' } };
        const ada = env.authenticatedContext('ada', password).firestore();
        const bea = env.authenticatedContext('bea', password).firestore();
        const admin = env.authenticatedContext('admin', { admin: true, firebase: { sign_in_provider: 'password' } }).firestore();
        await env.withSecurityRulesDisabled(async function (ctx) {
            const db = ctx.firestore();
            await setDoc(doc(db, 'forum_posts', 'post1'), {
                title: 'Hello from the forum',
                body: 'A normal pleb post.',
                authorId: 'ada',
                authorName: 'Ada',
                createdAt: new Date(),
                upvotes: 0,
                voters: [],
            });
            await setDoc(doc(db, 'forum_replies', 'reply1'), {
                postId: 'post1',
                body: 'A normal reply.',
                authorId: 'ada',
                authorName: 'Ada',
                createdAt: new Date(),
                upvotes: 0,
                voters: [],
            });
            await setDoc(doc(db, 'article_replies', 'comment1'), {
                articleId: 'article1',
                body: 'A normal comment.',
                authorId: 'ada',
                authorName: 'Ada',
                createdAt: new Date(),
                upvotes: 0,
                voters: [],
            });
            await setDoc(doc(db, 'articles', 'article1'), {
                title: 'What is a full node',
                body: 'A node checks the rules.',
                authorId: 'ada',
                authorName: 'Ada',
                createdAt: new Date(),
                agreedToTerms: true,
                upvotes: 0,
                voters: [],
            });
            await setDoc(doc(db, 'beats_tracks', 'track1'), {
                authorId: 'ada',
                authorName: 'Ada',
                title: 'Genesis',
                createdAt: new Date(),
                duration: 30,
                copyrightConfirmed: true,
                plays: 0,
                likes: 0,
                likedBy: [],
                hidden: false,
            });
            await setDoc(doc(db, 'award_doc_claims', 'forum_posts__post1'), { uid: 'ada' });
        });
        await expect('forum author edits the body', function () {
            return updateDoc(doc(ada, 'forum_posts', 'post1'), { body: 'A normal pleb post, edited.' });
        }, true);
        await expect('forum author cannot reassign authorId', function () {
            return updateDoc(doc(ada, 'forum_posts', 'post1'), { authorId: 'bea' });
        }, false);
        await expect('admin client cannot reassign forum authorId', function () {
            return updateDoc(doc(admin, 'forum_posts', 'post1'), { authorId: 'bea' });
        }, false);
        await expect('forum reply author cannot reassign authorId', function () {
            return updateDoc(doc(ada, 'forum_replies', 'reply1'), { authorId: 'bea' });
        }, false);
        await expect('article comment author cannot reassign authorId', function () {
            return updateDoc(doc(ada, 'article_replies', 'comment1'), { authorId: 'bea' });
        }, false);
        await expect('article author cannot reassign authorId', function () {
            return updateDoc(doc(ada, 'articles', 'article1'), { authorId: 'bea' });
        }, false);
        await expect('article author edits the title', function () {
            return updateDoc(doc(ada, 'articles', 'article1'), { title: 'What is a full node?' });
        }, true);
        await expect('beats author cannot reassign authorId', function () {
            return updateDoc(doc(ada, 'beats_tracks', 'track1'), { authorId: 'bea' });
        }, false);
        await expect('beats author edits the title', function () {
            return updateDoc(doc(ada, 'beats_tracks', 'track1'), { title: 'Genesis Block' });
        }, true);
        await expect('someone else can like a track', function () {
            return updateDoc(doc(bea, 'beats_tracks', 'track1'), {
                plays: 1,
                likes: 1,
                likedBy: ['bea'],
            });
        }, true);
        await expect('client cannot write an award claim marker', function () {
            return setDoc(doc(bea, 'award_doc_claims', 'forum_posts__post1'), { uid: 'bea' });
        }, false);
        await expect('client cannot read an award claim marker', function () {
            return getDoc(doc(bea, 'award_doc_claims', 'forum_posts__post1'));
        }, false);
    } finally {
        await env.cleanup();
    }
    if (failed) process.exit(1);
})().catch(function (err) {
    console.error(err);
    process.exit(1);
});
