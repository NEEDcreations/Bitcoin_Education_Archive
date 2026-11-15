#!/usr/bin/env node
// N3/N4: global_chat, forum_posts, forum_replies and article_replies creates
// must use Firestore auto-ids (20 alphanumerics) and may not carry an `id`
// field, so a doc id can never smuggle markup into the page.
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
        '--project', 'demo-doc-ids',
        'node tests/rules/doc-id-rules.js',
    ], {
        cwd: root,
        stdio: 'inherit',
        env: Object.assign({}, process.env, { CI: 'true' }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, addDoc, updateDoc, collection, serverTimestamp, arrayUnion, increment } = require('firebase/firestore');

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const parts = emu.split(':');

const BAD_IDS = [
    ['double quote', 'aaaaaaaaaaaaaaaaaa"x'],
    ['angle brackets', 'x"><img src=x onerror=alert(1)>'],
    ['less-than', 'aaaaaaaaaaaaaaaaaa<b'],
    ['single quote', "aaaaaaaaaaaaaaaaaa'x"],
    ['19 chars', 'aaaaaaaaaaaaaaaaaaa'],
    ['21 chars', 'aaaaaaaaaaaaaaaaaaaaa'],
    ['underscore', 'aaaaaaaaaaaaaaaaaa_x'],
];
const GOOD = 'Ab3dEf6hIj9lMn2pQr5t';

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-doc-ids',
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
        const pw = { firebase: { sign_in_provider: 'password' } };
        const anonTok = { firebase: { sign_in_provider: 'anonymous' } };
        await env.withSecurityRulesDisabled(async function (ctx) {
            const db = ctx.firestore();
            await setDoc(doc(db, 'users', 'user1'), { username: 'phil' });
            await setDoc(doc(db, 'users', 'user2'), { username: 'bob' });
            await setDoc(doc(db, 'forum_posts', 'PostPostPostPostPost'), { title: 'Seed post', authorId: 'user1', authorName: 'phil', createdAt: 1, upvotes: 0, voters: [] });
            await setDoc(doc(db, 'forum_replies', 'ReplyReplyReplyReply'), { postId: 'PostPostPostPostPost', body: 'seed reply', authorId: 'user1', authorName: 'phil', createdAt: 1, upvotes: 0, voters: [] });
            await setDoc(doc(db, 'article_replies', 'CommentCommentCommen'), { articleId: 'art1', body: 'seed comment', authorId: 'user1', authorName: 'phil', createdAt: 1 });
        });
        const user = env.authenticatedContext('user1', pw).firestore();
        const other = env.authenticatedContext('user2', pw).firestore();
        const anon = env.authenticatedContext('anon1', anonTok).firestore();

        const chat = function () { return { uid: 'user1', name: 'phil', text: 'hello', ts: serverTimestamp() }; };
        const post = function (uid) {
            return { title: 'A forum post', body: 'body text', link: null, category: 'general', authorId: uid || 'user1',
                authorName: 'phil', authorFaction: null, authorPoints: 0, upvotes: 0, voters: [], replyCount: 0, createdAt: serverTimestamp() };
        };
        const reply = function () {
            return { postId: 'PostPostPostPostPost', body: 'a reply', authorId: 'user1', authorName: 'phil', authorFaction: null,
                authorPoints: 0, upvotes: 0, voters: [], createdAt: serverTimestamp() };
        };
        const comment = function () {
            return { articleId: 'art1', body: 'a comment', authorId: 'user1', authorName: 'phil', authorPoints: 0, createdAt: serverTimestamp() };
        };

        // Legit client paths: add() auto-ids, exactly the client payloads.
        await expect('global_chat add() auto-id', function () { return addDoc(collection(user, 'global_chat'), chat()); }, true);
        await expect('global_chat 20-char alnum id', function () { return setDoc(doc(user, 'global_chat', GOOD), chat()); }, true);
        await expect('forum_posts add() auto-id', function () { return addDoc(collection(user, 'forum_posts'), post()); }, true);
        await expect('forum_posts add() auto-id (anonymous)', function () { return addDoc(collection(anon, 'forum_posts'), post('anon1')); }, true);
        await expect('forum_replies add() auto-id', function () { return addDoc(collection(user, 'forum_replies'), reply()); }, true);
        await expect('forum_replies add() threaded reply', function () {
            return addDoc(collection(user, 'forum_replies'), Object.assign(reply(), { parentReplyId: 'ReplyReplyReplyReply', parentAuthorName: 'phil' }));
        }, true);
        await expect('article_replies add() auto-id', function () { return addDoc(collection(user, 'article_replies'), comment()); }, true);
        await expect('article_replies add() threaded reply', function () {
            return addDoc(collection(user, 'article_replies'), Object.assign(comment(), { parentReplyId: 'CommentCommentCommen', parentAuthorName: 'phil' }));
        }, true);

        // Custom ids with markup or the wrong shape.
        for (const [label, id] of BAD_IDS) {
            await expect('global_chat id with ' + label, function () { return setDoc(doc(user, 'global_chat', id), chat()); }, false);
            await expect('forum_posts id with ' + label, function () { return setDoc(doc(user, 'forum_posts', id), post()); }, false);
            await expect('forum_posts id with ' + label + ' (anonymous)', function () { return setDoc(doc(anon, 'forum_posts', id), post('anon1')); }, false);
            await expect('forum_replies id with ' + label, function () { return setDoc(doc(user, 'forum_replies', id), reply()); }, false);
            await expect('article_replies id with ' + label, function () { return setDoc(doc(user, 'article_replies', id), comment()); }, false);
        }

        // A stored `id` field (would override doc.id in old forum clients).
        const spoof = { id: 'x"><img src=x onerror=alert(1)>' };
        await expect('global_chat with id field', function () { return addDoc(collection(user, 'global_chat'), Object.assign(chat(), spoof)); }, false);
        await expect('forum_posts with id field', function () { return addDoc(collection(user, 'forum_posts'), Object.assign(post(), spoof)); }, false);
        await expect('forum_posts with innocent id field', function () { return addDoc(collection(user, 'forum_posts'), Object.assign(post(), { id: GOOD })); }, false);
        await expect('forum_replies with id field', function () { return addDoc(collection(user, 'forum_replies'), Object.assign(reply(), spoof)); }, false);
        await expect('article_replies with id field', function () { return addDoc(collection(user, 'article_replies'), Object.assign(comment(), spoof)); }, false);

        // Exact field lists on forum creates.
        await expect('forum_posts with an extra field', function () { return addDoc(collection(user, 'forum_posts'), Object.assign(post(), { onclick: 'x' })); }, false);
        await expect('forum_replies with an extra field', function () { return addDoc(collection(user, 'forum_replies'), Object.assign(reply(), { html: '<b>' })); }, false);
        await expect('article_replies with an extra field', function () { return addDoc(collection(user, 'article_replies'), Object.assign(comment(), { html: '<b>' })); }, false);

        // Updates cannot add an id field; normal updates still work.
        await expect('author adds id field to own forum post', function () { return updateDoc(doc(user, 'forum_posts', 'PostPostPostPostPost'), spoof); }, false);
        await expect('author edits own forum post body', function () { return updateDoc(doc(user, 'forum_posts', 'PostPostPostPostPost'), { body: 'edited body' }); }, true);
        await expect('upvote a forum post', function () {
            return updateDoc(doc(other, 'forum_posts', 'PostPostPostPostPost'), { upvotes: increment(1), voters: arrayUnion('user2') });
        }, true);
        await expect('author adds id field to own forum reply', function () { return updateDoc(doc(user, 'forum_replies', 'ReplyReplyReplyReply'), spoof); }, false);
        await expect('upvote a forum reply', function () {
            return updateDoc(doc(other, 'forum_replies', 'ReplyReplyReplyReply'), { upvotes: increment(1), voters: arrayUnion('user2') });
        }, true);
        await expect('author adds id field to own article comment', function () { return updateDoc(doc(user, 'article_replies', 'CommentCommentCommen'), spoof); }, false);
        await expect('author edits own article comment', function () { return updateDoc(doc(user, 'article_replies', 'CommentCommentCommen'), { body: 'edited comment' }); }, true);
    } finally {
        await env.cleanup();
    }
    console.log(failed ? '\n' + failed + ' failed' : '\nall passed');
    process.exit(failed ? 1 : 0);
})();
