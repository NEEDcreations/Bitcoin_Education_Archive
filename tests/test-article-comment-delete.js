#!/usr/bin/env node
'use strict';
// Article comment delete must hit article_replies, not forum_replies.
// Run: node tests/test-article-comment-delete.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const forum = fs.readFileSync(path.join(root, 'forum.js'), 'utf8');
const bundle = fs.readFileSync(path.join(root, 'bundle.min.js'), 'utf8');

let passed = 0;
let failed = 0;
const queue = [];

function test(name, fn) {
    let run;
    try { run = fn(); }
    catch (e) {
        console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e));
        failed++;
        return Promise.resolve();
    }
    const finish = function () {
        console.log('✅ ' + name);
        passed++;
    };
    const fail = function (e) {
        console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e));
        failed++;
    };
    if (run && typeof run.then === 'function') return run.then(finish, fail);
    finish();
    return Promise.resolve();
}

function extractWindowFn(src, name) {
    const startToken = 'window.' + name + ' = async function';
    const start = src.indexOf(startToken);
    if (start < 0) throw new Error('missing window.' + name);
    let i = src.indexOf('{', start);
    if (i < 0) throw new Error('missing body for ' + name);
    let depth = 0;
    for (; i < src.length; i++) {
        const ch = src[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) return src.slice(start, i + 1);
        }
    }
    throw new Error('unclosed body for ' + name);
}

function mockDb() {
    const deletes = [];
    function collection(name) {
        return {
            doc: function (id) {
                return {
                    delete: async function () {
                        deletes.push({ collection: name, id: id });
                    }
                };
            }
        };
    }
    return { collection: collection, deletes: deletes };
}

queue.push(test('article comment delete button calls articleDeleteReply, not forumDeleteReply', function () {
    const renderStart = forum.indexOf('function _renderArticleComment');
    const renderEnd = forum.indexOf('topLevel.forEach', renderStart);
    assert.ok(renderStart > 0 && renderEnd > renderStart, 'render helper not found');
    const render = forum.slice(renderStart, renderEnd);
    assert.ok(render.indexOf('articleDeleteReply') !== -1, 'button must call articleDeleteReply');
    assert.ok(render.indexOf('forumDeleteReply') === -1, 'button must not call forumDeleteReply');
}));

queue.push(test('forum reply delete button still calls forumDeleteReply', function () {
    const renderStart = forum.indexOf('function _renderReplyCard');
    const renderEnd = forum.indexOf('topLevel.forEach', renderStart);
    assert.ok(renderStart > 0 && renderEnd > renderStart, 'forum render helper not found');
    const render = forum.slice(renderStart, renderEnd);
    assert.ok(render.indexOf('forumDeleteReply') !== -1, 'forum button must stay on forumDeleteReply');
    assert.ok(render.indexOf('articleDeleteReply') === -1, 'forum button must not call articleDeleteReply');
}));

queue.push(test('articleDeleteReply deletes from article_replies only', function () {
    const fn = extractWindowFn(forum, 'articleDeleteReply');
    assert.ok(fn.includes("db.collection('article_replies').doc(replyId).delete()"));
    assert.ok(!fn.includes('forum_replies'));
    assert.ok(fn.includes('articleLoadReplies(articleId)'));
}));

queue.push(test('forumDeleteReply still deletes from forum_replies only', function () {
    const fn = extractWindowFn(forum, 'forumDeleteReply');
    assert.ok(fn.includes("db.collection('forum_replies').doc(replyId).delete()"));
    assert.ok(!fn.includes('article_replies'));
}));

queue.push(test('bundle includes the article comment delete fix', function () {
    assert.ok(bundle.includes('articleDeleteReply'));
    assert.ok(bundle.includes('article_replies'));
    assert.ok(bundle.indexOf('window.articleDeleteReply') !== -1);
    assert.ok(!/onclick=\\?"forumDeleteReply\('"[+][a-zA-Z.]+[+]"','"[+]t[+]/.test(bundle));
}));

queue.push(test('articleDeleteReply runtime hits article_replies and reloads comments', async function () {
    const fnSrc = extractWindowFn(forum, 'articleDeleteReply');
    const db = mockDb();
    const reloads = [];
    const toasts = [];
    const sandbox = {
        auth: { currentUser: { uid: 'user-aaaa' } },
        db: db,
        confirm: function () { return true; },
        isForumAdmin: function () { return false; },
        showToast: function (msg) { toasts.push(msg); },
        articleLoadReplies: function (id) { reloads.push(id); },
        window: {}
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fnSrc + ';', sandbox);
    await sandbox.window.articleDeleteReply('comm-bbbb', 'art-cccc');
    assert.deepStrictEqual(db.deletes, [{ collection: 'article_replies', id: 'comm-bbbb' }]);
    assert.deepStrictEqual(reloads, ['art-cccc']);
    assert.ok(toasts.some(function (t) { return String(t).indexOf('deleted') !== -1; }));
}));

queue.push(test('articleDeleteReply does nothing when the user cancels or is signed out', async function () {
    const fnSrc = extractWindowFn(forum, 'articleDeleteReply');

    const signedOut = mockDb();
    const s1 = {
        auth: { currentUser: null },
        db: signedOut,
        confirm: function () { return true; },
        isForumAdmin: function () { return false; },
        showToast: function () {},
        articleLoadReplies: function () { throw new Error('should not reload'); },
        window: {}
    };
    s1.window = s1;
    vm.createContext(s1);
    vm.runInContext(fnSrc + ';', s1);
    await s1.window.articleDeleteReply('comm-bbbb', 'art-cccc');
    assert.deepStrictEqual(signedOut.deletes, []);

    const cancelled = mockDb();
    const s2 = {
        auth: { currentUser: { uid: 'user-aaaa' } },
        db: cancelled,
        confirm: function () { return false; },
        isForumAdmin: function () { return false; },
        showToast: function () {},
        articleLoadReplies: function () { throw new Error('should not reload'); },
        window: {}
    };
    s2.window = s2;
    vm.createContext(s2);
    vm.runInContext(fnSrc + ';', s2);
    await s2.window.articleDeleteReply('comm-bbbb', 'art-cccc');
    assert.deepStrictEqual(cancelled.deletes, []);
}));

Promise.all(queue).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
