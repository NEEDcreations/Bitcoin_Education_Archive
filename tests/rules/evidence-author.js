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
        const guest = env.authenticatedContext('guest', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
        await expect('guest cannot add a play', function () {
            return updateDoc(doc(guest, 'beats_tracks', 'track1'), { plays: 1 });
        }, false);
        await expect('someone else cannot set plays to zero', function () {
            return updateDoc(doc(bea, 'beats_tracks', 'track1'), { plays: 0 });
        }, false);
        await expect('someone else cannot set plays negative', function () {
            return updateDoc(doc(bea, 'beats_tracks', 'track1'), { plays: -500 });
        }, false);
        await expect('someone else cannot drop likes by 50', function () {
            return updateDoc(doc(bea, 'beats_tracks', 'track1'), { likes: -50 });
        }, false);
        await expect('the author cannot set plays to a million', function () {
            return updateDoc(doc(ada, 'beats_tracks', 'track1'), { plays: 1000000 });
        }, false);
        await expect('a forum author cannot set replyCount to 9999', function () {
            return updateDoc(doc(ada, 'forum_posts', 'post1'), { replyCount: 9999 });
        }, false);
        await expect('an article author cannot set replyCount to 9999', function () {
            return updateDoc(doc(ada, 'articles', 'article1'), { replyCount: 9999 });
        }, false);
        await expect('a forum post cannot be created with replyCount 500', function () {
            return setDoc(doc(ada, 'forum_posts', 'post500'), {
                title: 'A brand new post',
                authorId: 'ada',
                authorName: 'Ada',
                createdAt: new Date(),
                replyCount: 500,
            });
        }, false);
        await expect('a forum post can be created with replyCount 0', function () {
            return setDoc(doc(ada, 'forum_posts', 'post0'), {
                title: 'A brand new post',
                authorId: 'ada',
                authorName: 'Ada',
                createdAt: new Date(),
                replyCount: 0,
            });
        }, true);
        await expect('an article cannot be created with replyCount 500', function () {
            return setDoc(doc(ada, 'articles', 'article500'), {
                title: 'What a full node checks',
                body: 'The rules.',
                authorId: 'ada',
                agreedToTerms: true,
                replyCount: 500,
            });
        }, false);
        await expect('a track cannot be created with plays already set', function () {
            return setDoc(doc(ada, 'beats_tracks', 'track500'), {
                authorId: 'ada',
                copyrightConfirmed: true,
                duration: 30,
                plays: 5,
                likes: 0,
            });
        }, false);
        await expect('a track can be created with plays and likes at zero', function () {
            return setDoc(doc(ada, 'beats_tracks', 'track0'), {
                authorId: 'ada',
                copyrightConfirmed: true,
                duration: 30,
                plays: 0,
                likes: 0,
            });
        }, true);
        await expect('someone else can like a track', function () {
            return updateDoc(doc(bea, 'beats_tracks', 'track1'), {
                likes: 1,
                likedBy: ['bea'],
            });
        }, true);
        await expect('someone else can unlike a track', function () {
            return updateDoc(doc(bea, 'beats_tracks', 'track1'), {
                likes: 0,
                likedBy: [],
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
