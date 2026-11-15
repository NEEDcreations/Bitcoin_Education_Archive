#!/usr/bin/env node
// N3/N4 + B1-B3: global_chat, forum_posts, forum_replies, article_replies,
// beats_tracks (+comments), articles and users/*/playlists creates
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
            await setDoc(doc(db, 'beats_tracks', 'TrackTrackTrackTrack'), { title: 'Seed track', authorId: 'user1', authorName: 'phil', duration: 60, plays: 0, likes: 0, copyrightConfirmed: true, createdAt: 1 });
            // Legacy docs with a non-auto id stay editable, likeable and deletable.
            await setDoc(doc(db, 'beats_tracks', 'legacy_track-1'), { title: 'Old track', authorId: 'user1', authorName: 'phil', duration: 60, plays: 0, likes: 0, createdAt: 1 });
            await setDoc(doc(db, 'articles', 'ArticleArticleArticl'), { title: 'A seeded article title', body: 'b', authorId: 'user1', authorName: 'phil', status: 'published', upvotes: 0, voters: [], createdAt: 1 });
            await setDoc(doc(db, 'users', 'user1', 'playlists', 'PlaylistPlaylistPlay'), { name: 'mix', trackIds: [], createdAt: 1 });
            await setDoc(doc(db, 'beats_artists', 'user1'), { name: 'phil' });
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

        const track = function () {
            return { title: 'My track', artist: 'phil', genre: 'Hip Hop', audioUrl: 'https://x/y.mp3', duration: 60, authorId: 'user1',
                authorName: 'phil', plays: 0, likes: 0, copyrightConfirmed: true, createdAt: serverTimestamp() };
        };
        const album = function () {
            return Object.assign(track(), { coverUrl: 'https://x/c.png', albumId: 'alb1', albumTitle: 'LP', albumType: 'album',
                trackNumber: 1, albumTotalTracks: 3, albumYear: 2026 });
        };
        const article = function () {
            return { title: 'A long article title', subtitle: 's', body: 'body', tags: ['btc'], wordCount: 600, readTime: 3,
                authorId: 'user1', authorName: 'phil', authorPoints: 0, authorPic: '', upvotes: 0, voters: [], replyCount: 0,
                tipTotal: 0, status: 'published', pinned: false, agreedToTerms: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
        };
        const tcomment = function () { return { text: 'nice', authorId: 'user1', authorName: 'phil', createdAt: serverTimestamp() }; };
        const playlist = function (ids) { return { name: 'mix', trackIds: ids || [], createdAt: serverTimestamp() }; };
        const adminDb = env.authenticatedContext('admin1', { admin: true, firebase: { sign_in_provider: 'password' } }).firestore();

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

        // B1-B3: beats tracks, track comments, articles, playlists, artists.
        await expect('beats_tracks add() single upload', function () { return addDoc(collection(user, 'beats_tracks'), track()); }, true);
        await expect('beats_tracks add() base64 upload with cover art', function () {
            const t = track(); delete t.audioUrl; t.audioData = 'data:audio/mp3;base64,AAAA'; t.coverArt = 'data:image/png;base64,AA';
            return addDoc(collection(user, 'beats_tracks'), t);
        }, true);
        await expect('beats_tracks add() album track', function () { return addDoc(collection(user, 'beats_tracks'), album()); }, true);
        await expect('beats track comment add()', function () { return addDoc(collection(user, 'beats_tracks', 'TrackTrackTrackTrack', 'comments'), tcomment()); }, true);
        await expect('articles add() publish', function () { return addDoc(collection(user, 'articles'), article()); }, true);
        await expect('articles add() publish with cover', function () { return addDoc(collection(user, 'articles'), Object.assign(article(), { coverUrl: 'https://x/c.png' })); }, true);
        await expect('playlist add() empty', function () { return addDoc(collection(user, 'users', 'user1', 'playlists'), playlist()); }, true);
        await expect('playlist add() with track', function () { return addDoc(collection(user, 'users', 'user1', 'playlists'), playlist(['TrackTrackTrackTrack'])); }, true);
        await expect('admin creates beats_artists doc keyed by uid', function () { return setDoc(doc(adminDb, 'beats_artists', 'user2'), { name: 'bob' }); }, true);
        await expect('admin creates beats_artists doc keyed by ln: uid', function () { return setDoc(doc(adminDb, 'beats_artists', 'ln:02' + 'ab'.repeat(32)), { name: 'ln' }); }, true);
        for (const [label, id] of BAD_IDS) {
            await expect('beats_tracks id with ' + label, function () { return setDoc(doc(user, 'beats_tracks', id), track()); }, false);
            await expect('beats track comment id with ' + label, function () { return setDoc(doc(user, 'beats_tracks', 'TrackTrackTrackTrack', 'comments', id), tcomment()); }, false);
            await expect('articles id with ' + label, function () { return setDoc(doc(user, 'articles', id), article()); }, false);
            await expect('playlist id with ' + label, function () { return setDoc(doc(user, 'users', 'user1', 'playlists', id), playlist()); }, false);
        }
        for (const [label, id] of BAD_IDS.slice(0, 4)) {
            await expect('admin beats_artists id with ' + label, function () { return setDoc(doc(adminDb, 'beats_artists', id), { name: 'x' }); }, false);
        }
        await expect('beats_tracks with id field', function () { return addDoc(collection(user, 'beats_tracks'), Object.assign(track(), spoof)); }, false);
        await expect('beats_tracks with innocent id field', function () { return addDoc(collection(user, 'beats_tracks'), Object.assign(track(), { id: GOOD })); }, false);
        await expect('beats track comment with id field', function () { return addDoc(collection(user, 'beats_tracks', 'TrackTrackTrackTrack', 'comments'), Object.assign(tcomment(), spoof)); }, false);
        await expect('articles with id field', function () { return addDoc(collection(user, 'articles'), Object.assign(article(), spoof)); }, false);
        await expect('playlist with id field', function () { return addDoc(collection(user, 'users', 'user1', 'playlists'), Object.assign(playlist(), spoof)); }, false);
        await expect('admin beats_artists with id field', function () { return setDoc(doc(adminDb, 'beats_artists', 'user3'), Object.assign({ name: 'x' }, spoof)); }, false);
        await expect('beats_tracks with an extra field', function () { return addDoc(collection(user, 'beats_tracks'), Object.assign(track(), { onclick: 'x' })); }, false);
        await expect('beats_tracks with hidden:false', function () { return addDoc(collection(user, 'beats_tracks'), Object.assign(track(), { hidden: false })); }, false);
        await expect('beats track comment with an extra field', function () { return addDoc(collection(user, 'beats_tracks', 'TrackTrackTrackTrack', 'comments'), Object.assign(tcomment(), { html: '<b>' })); }, false);
        await expect('articles with an extra field', function () { return addDoc(collection(user, 'articles'), Object.assign(article(), { html: '<b>' })); }, false);
        await expect('playlist with an extra field', function () { return addDoc(collection(user, 'users', 'user1', 'playlists'), Object.assign(playlist(), { html: '<b>' })); }, false);
        await expect('articles add() as draft', function () { return addDoc(collection(user, 'articles'), Object.assign(article(), { status: 'draft' })); }, true);
        await expect('articles with status featured', function () { return addDoc(collection(user, 'articles'), Object.assign(article(), { status: 'featured' })); }, false);
        await expect('articles with status markup', function () { return addDoc(collection(user, 'articles'), Object.assign(article(), { status: '"><img>' })); }, false);
        await expect('articles created pinned', function () { return addDoc(collection(user, 'articles'), Object.assign(article(), { pinned: true })); }, false);
        await expect('articles created with upvotes', function () { return addDoc(collection(user, 'articles'), Object.assign(article(), { upvotes: 5 })); }, false);
        // Updates: no id field, status limited; normal edits, likes, upvotes, playlist adds still work.
        await expect('author adds id field to own track', function () { return updateDoc(doc(user, 'beats_tracks', 'TrackTrackTrackTrack'), spoof); }, false);
        await expect('author edits own track title', function () { return updateDoc(doc(user, 'beats_tracks', 'TrackTrackTrackTrack'), { title: 'Renamed' }); }, true);
        await expect('like a track', function () {
            return updateDoc(doc(other, 'beats_tracks', 'TrackTrackTrackTrack'), { likes: increment(1), likedBy: arrayUnion('user2') });
        }, true);
        await expect('author edits legacy-id track', function () { return updateDoc(doc(user, 'beats_tracks', 'legacy_track-1'), { title: 'Renamed old' }); }, true);
        await expect('author adds id field to own article', function () { return updateDoc(doc(user, 'articles', 'ArticleArticleArticl'), Object.assign({ title: 'A seeded article title', body: 'b' }, spoof)); }, false);
        await expect('author edits own article', function () { return updateDoc(doc(user, 'articles', 'ArticleArticleArticl'), { title: 'An edited article title', body: 'b2' }); }, true);
        await expect('author sets article status featured', function () { return updateDoc(doc(user, 'articles', 'ArticleArticleArticl'), { title: 'An edited article title', body: 'b2', status: 'featured' }); }, false);
        await expect('author sets article status draft', function () { return updateDoc(doc(user, 'articles', 'ArticleArticleArticl'), { title: 'An edited article title', body: 'b2', status: 'draft' }); }, true);
        await expect('upvote an article', function () {
            return updateDoc(doc(other, 'articles', 'ArticleArticleArticl'), { upvotes: increment(1), voters: arrayUnion('user2') });
        }, true);
        await expect('owner adds id field to playlist', function () { return updateDoc(doc(user, 'users', 'user1', 'playlists', 'PlaylistPlaylistPlay'), spoof); }, false);
        await expect('owner adds track to playlist', function () { return updateDoc(doc(user, 'users', 'user1', 'playlists', 'PlaylistPlaylistPlay'), { trackIds: arrayUnion('TrackTrackTrackTrack') }); }, true);
        await expect('admin adds id field to beats_artists doc', function () { return updateDoc(doc(adminDb, 'beats_artists', 'user1'), spoof); }, false);
        await expect('admin edits beats_artists doc', function () { return updateDoc(doc(adminDb, 'beats_artists', 'user1'), { name: 'phil2' }); }, true);
        await expect('non-admin creates beats_artists doc', function () { return setDoc(doc(user, 'beats_artists', 'user1x'), { name: 'x' }); }, false);
    } finally {
        await env.cleanup();
    }
    console.log(failed ? '\n' + failed + ' failed' : '\nall passed');
    process.exit(failed ? 1 : 0);
})();
