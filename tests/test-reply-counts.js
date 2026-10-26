#!/usr/bin/env node
'use strict';

const assert = require('assert');
const replyCounts = require('../functions/src/replyCounts');
const beatsPlays = require('../functions/src/beatsPlays');

let passed = 0;
let failed = 0;
function test(name, fn) {
    return Promise.resolve().then(fn).then(function () {
        passed++;
        console.log('  ok  ' + name);
    }).catch(function (err) {
        failed++;
        console.log('  FAIL ' + name + ': ' + (err && err.stack ? err.stack : err));
    });
}

function memory() {
    const docs = {};
    function ref(path) {
        return {
            path: path,
            get: function () {
                return Promise.resolve({
                    exists: Object.prototype.hasOwnProperty.call(docs, path),
                    data: function () { return docs[path]; },
                });
            },
        };
    }
    return {
        docs: docs,
        collection: function (name) {
            return { doc: function (id) { return ref(name + '/' + id); } };
        },
        runTransaction: function (fn) {
            const tx = {
                get: function (row) { return row.get(); },
                set: function (row, patch) {
                    const cur = docs[row.path] || {};
                    const next = Object.assign({}, cur);
                    Object.keys(patch).forEach(function (key) {
                        if (patch[key] && patch[key].__inc) next[key] = (Number(cur[key]) || 0) + patch[key].__inc;
                        else next[key] = patch[key];
                    });
                    docs[row.path] = next;
                },
            };
            return Promise.resolve(fn(tx));
        },
    };
}

const admin = { firestore: { FieldValue: { increment: function (n) { return { __inc: n }; } } } };

(async function () {
    await test('a forum reply bumps replyCount, and a topic copy does not', async function () {
        const db = memory();
        db.docs['forum_posts/post1'] = { replyCount: 2, authorId: 'ada' };
        const bumped = await replyCounts.onForumReplyCreated(db, { postId: 'post1', authorId: 'bea', body: 'hello' });
        assert.strictEqual(bumped.adjusted, true);
        assert.strictEqual(db.docs['forum_posts/post1'].replyCount, 3);
        const skipped = await replyCounts.onForumReplyCreated(db, {
            postId: 'post1', authorId: 'bea', topicPost: 'root1', topicLink: '#topic',
        });
        assert.strictEqual(skipped.adjusted, false);
        assert.strictEqual(db.docs['forum_posts/post1'].replyCount, 3);
    });

    await test('deleting a reply, including a topic copy, lowers replyCount and never goes below zero', async function () {
        const db = memory();
        db.docs['forum_posts/post1'] = { replyCount: 1 };
        await replyCounts.onForumReplyDeleted(db, { postId: 'post1', topicPost: 'root1' });
        assert.strictEqual(db.docs['forum_posts/post1'].replyCount, 0);
        await replyCounts.onForumReplyDeleted(db, { postId: 'post1', authorId: 'bea' });
        assert.strictEqual(db.docs['forum_posts/post1'].replyCount, 0);
    });

    await test('an article comment bumps the article replyCount', async function () {
        const db = memory();
        db.docs['articles/a1'] = { replyCount: 0, authorId: 'ada' };
        await replyCounts.onArticleReplyCreated(db, { articleId: 'a1', authorId: 'bea' });
        assert.strictEqual(db.docs['articles/a1'].replyCount, 1);
    });

    await test('a beats play is counted on the server, once per 45 seconds, and a missing track is left alone', async function () {
        const db = memory();
        db.docs['beats_tracks/track1'] = { plays: 4, authorId: 'ada' };
        const first = await beatsPlays.recordPlay(db, admin, 'bea', 'track1', 100000);
        assert.strictEqual(first.counted, true);
        assert.strictEqual(db.docs['beats_tracks/track1'].plays, 5);
        const again = await beatsPlays.recordPlay(db, admin, 'bea', 'track1', 100000 + 1000);
        assert.strictEqual(again.counted, false);
        assert.strictEqual(db.docs['beats_tracks/track1'].plays, 5);
        const later = await beatsPlays.recordPlay(db, admin, 'bea', 'track1', 100000 + 45000);
        assert.strictEqual(later.counted, true);
        assert.strictEqual(db.docs['beats_tracks/track1'].plays, 6);
        const missing = await beatsPlays.recordPlay(db, admin, 'bea', 'nope', 100000);
        assert.strictEqual(missing.counted, false);
        assert.strictEqual(db.docs['beats_tracks/nope'], undefined);
    });

    console.log(passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
