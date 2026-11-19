#!/usr/bin/env node
// Client-created Pleb Talk doc ids must be plain tokens (^[A-Za-z0-9_-]{1,256}$,
// same as the client FORUM_ID_RE). Ids with quotes, angle brackets, parens or
// spaces are refused on create for forum_posts, forum_replies, articles and
// article_replies. Requires FIRESTORE_EMULATOR_HOST on an allowed port; does not
// fall back to 8085 or start the firebase.json emulator.
'use strict';
const path = require('path');
const root = path.join(__dirname, '..', '..');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.error('FIRESTORE_EMULATOR_HOST is required. Point it at an allowed emulator port; this test does not start one and does not fall back to 8085.');
    process.exit(1);
}

const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, serverTimestamp } = require('firebase/firestore');

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST;
const parts = emu.split(':');

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
function idOf(prefix, total) {
    let s = prefix;
    for (let i = 0; s.length < total; i++) s += ALNUM[i % ALNUM.length];
    return s;
}
const ID256 = idOf('tdfrom_', 256);
const ID257 = idOf('tdfrom_', 257);
const BAD_IDS = [
    ['double quote', 'x"y'],
    ['single quote', "x'y"],
    ['angle brackets', 'x<img>'],
    ['closing angle', 'x>y'],
    ['parens', 'alert(1)'],
    ['space', 'two words'],
    ['onclick breakout', 'x");alert(1);("'],
    ['too long (257)', ID257],
];
const GOOD_IDS = [
    ['auto id', 'AbCdEf0123456789wxyz'],
    ['dash and underscore', 'tdforum_mining-root_1'],
    ['single char', 'a'],
    ['256 chars', ID256],
];

(async function main() {
    let failed = 0;
    let passed = 0;
    let seq = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-forum-docid',
        firestore: { rules: rules, host: parts[0], port: Number(parts[1]) },
    });
    async function expect(name, run, shouldAllow) {
        try {
            if (shouldAllow) await assertSucceeds(run());
            else await assertFails(run());
            passed++;
            console.log((shouldAllow ? 'ALLOW' : 'DENY ') + '  ' + name + '  ✓');
        } catch (e) {
            failed++;
            console.log((shouldAllow ? 'ALLOW' : 'DENY ') + '  ' + name + '  ✗ ' + (e.message || e));
        }
    }
    const post = function () {
        return { title: 'Hello from Pleb Talk', authorId: 'ada', authorName: 'Ada', body: 'A normal post.', createdAt: serverTimestamp() };
    };
    const reply = function (postId) {
        return { postId: postId, body: 'A normal reply.', authorId: 'ada', authorName: 'Ada', createdAt: serverTimestamp() };
    };
    const article = function () {
        return { title: 'A normal article title', authorId: 'ada', authorName: 'Ada', body: 'Body.', agreedToTerms: true, status: 'published', createdAt: serverTimestamp() };
    };
    const articleReply = function (articleId) {
        return { articleId: articleId, body: 'A comment.', authorId: 'ada', authorName: 'Ada', createdAt: serverTimestamp() };
    };
    try {
        await env.clearFirestore();
        const ada = env.authenticatedContext('ada', { firebase: { sign_in_provider: 'password' } }).firestore();

        for (const [label, id] of GOOD_IDS) {
            await expect('forum_posts id ok: ' + label, function () { return setDoc(doc(ada, 'forum_posts', id), post()); }, true);
            await expect('forum_replies id ok: ' + label, function () { return setDoc(doc(ada, 'forum_replies', id), reply(id)); }, true);
            await expect('articles id ok: ' + label, function () { return setDoc(doc(ada, 'articles', id), article()); }, true);
            await expect('article_replies id ok: ' + label, function () { return setDoc(doc(ada, 'article_replies', id), articleReply(id)); }, true);
        }
        for (const [label, id] of BAD_IDS) {
            await expect('ATTACK forum_posts id: ' + label, function () { return setDoc(doc(ada, 'forum_posts', id), post()); }, false);
            await expect('ATTACK forum_replies id: ' + label, function () { return setDoc(doc(ada, 'forum_replies', id), reply('okpost1')); }, false);
            await expect('ATTACK forum_replies postId: ' + label, function () { return setDoc(doc(ada, 'forum_replies', 'okreply_' + (++seq)), reply(id)); }, false);
            await expect('ATTACK articles id: ' + label, function () { return setDoc(doc(ada, 'articles', id), article()); }, false);
            await expect('ATTACK article_replies id: ' + label, function () { return setDoc(doc(ada, 'article_replies', id), articleReply('okart1')); }, false);
            await expect('ATTACK article_replies articleId: ' + label, function () { return setDoc(doc(ada, 'article_replies', 'okar_' + (++seq)), articleReply(id)); }, false);
        }
        await expect('ATTACK forum_replies without postId', function () {
            const r = reply('x'); delete r.postId;
            return setDoc(doc(ada, 'forum_replies', 'nopost1'), r);
        }, false);
        await expect('ATTACK forum_replies numeric postId', function () {
            return setDoc(doc(ada, 'forum_replies', 'numpost1'), reply(12345));
        }, false);

        const admin = env.authenticatedContext('mod', { admin: true, firebase: { sign_in_provider: 'password' } }).firestore();
        const replyId = 'AbCdEf0123456789wxyz';
        const articleId = 'AbCdEf0123456789wxyz';
        await expect('forum_replies author may edit body', function () {
            return updateDoc(doc(ada, 'forum_replies', replyId), { body: 'An edited reply.' });
        }, true);
        await expect('ATTACK forum_replies author cannot change postId', function () {
            return updateDoc(doc(ada, 'forum_replies', replyId), { postId: 'other_post' });
        }, false);
        await expect('ATTACK forum_replies author cannot change postId with body', function () {
            return updateDoc(doc(ada, 'forum_replies', replyId), { postId: 'other_post', body: 'Still trying.' });
        }, false);
        await expect('article_replies author may edit body', function () {
            return updateDoc(doc(ada, 'article_replies', articleId), { body: 'An edited comment.' });
        }, true);
        await expect('ATTACK article_replies author cannot change articleId', function () {
            return updateDoc(doc(ada, 'article_replies', articleId), { articleId: 'other_art' });
        }, false);
        await expect('admin may still update a forum reply (postId frozen only for non-admins)', function () {
            return updateDoc(doc(admin, 'forum_replies', replyId), { postId: 'other_post' });
        }, true);
    } finally {
        await env.cleanup();
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})().catch(function (e) {
    console.error(e);
    process.exit(1);
});
