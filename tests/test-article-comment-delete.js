#!/usr/bin/env node
'use strict';
// Article comment delete targets article_replies (where comments are stored),
// and the server rule allows it only for the author or an admin.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }
const forum = read('forum.js');

let passed = 0;
let failed = 0;
const queue = [];
function test(name, fn) { queue.push({ name: name, fn: fn }); }

function sliceFn(src, startMarker) {
    const start = src.indexOf(startMarker);
    assert.ok(start >= 0, 'missing ' + startMarker);
    let depth = 0;
    for (let i = src.indexOf('{', start); i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1) + ';'; }
    }
    throw new Error('unclosed ' + startMarker);
}

function load(opts) {
    const o = opts || {};
    const ops = [];
    const toasts = [];
    const reloads = [];
    const confirms = [];
    const ctx = {
        window: {},
        auth: o.signedOut ? { currentUser: null } : { currentUser: { uid: 'uidAuthor01' } },
        db: {
            collection: function (col) {
                return { doc: function (id) { return { delete: function () {
                    ops.push(col + '/' + id);
                    return o.denied ? Promise.reject(new Error('permission-denied')) : Promise.resolve();
                } }; } };
            }
        },
        isForumAdmin: function () { return o.admin === true; },
        confirm: function (m) { confirms.push(m); return o.cancel !== true; },
        showToast: function (m) { toasts.push(m); },
        articleLoadReplies: function (id) { reloads.push(id); },
        Promise: Promise
    };
    vm.createContext(ctx);
    const helper = forum.slice(forum.indexOf('var ARTICLE_REPLY_ID_RE'), forum.indexOf('window.articleDeleteReply'));
    vm.runInContext(helper + '\n' + sliceFn(forum, 'window.articleDeleteReply = async function'), ctx);
    return { fn: ctx.window.articleDeleteReply, ops: ops, toasts: toasts, reloads: reloads, confirms: confirms };
}

test('article comments are written to and read from article_replies', function () {
    assert.ok(forum.includes("db.collection('article_replies').add(replyData)"));
    assert.ok(forum.includes("db.collection('article_replies').where('articleId', '==', articleId)"));
});

test('the article comment trash button calls articleDeleteReply, not forumDeleteReply', function () {
    const start = forum.indexOf('function _renderArticleComment');
    const end = forum.indexOf('topLevel.forEach', start);
    const render = forum.slice(start, end);
    assert.ok(render.includes('articleDeleteReply('), 'uses the article delete');
    assert.ok(!render.includes('forumDeleteReply('), 'never the forum reply delete');
    assert.ok(render.includes('articleReplyIdOk(r.id) && articleReplyIdOk(articleId)'), 'ids checked before the button renders');
});

test('delete removes article_replies/<id> and reloads the comments', async function () {
    const t = load();
    await t.fn('abcDEF123_-x', 'art0001');
    assert.deepStrictEqual(t.ops, ['article_replies/abcDEF123_-x']);
    assert.deepStrictEqual(t.reloads, ['art0001']);
    assert.ok(t.toasts[0].includes('Comment deleted'));
    assert.ok(t.confirms[0].includes('Delete your comment'));
});

test('admin sees the admin confirm and deletes the same doc', async function () {
    const t = load({ admin: true });
    await t.fn('reply42', 'art0001');
    assert.ok(t.confirms[0].startsWith('Admin:'));
    assert.deepStrictEqual(t.ops, ['article_replies/reply42']);
});

test('a refused delete (not the author, not admin) shows an error and does not reload', async function () {
    const t = load({ denied: true });
    await t.fn('reply42', 'art0001');
    assert.deepStrictEqual(t.ops, ['article_replies/reply42']);
    assert.deepStrictEqual(t.reloads, []);
    assert.strictEqual(t.toasts[0], 'Error deleting comment');
});

test('cancel, signed out, or a malformed id writes nothing', async function () {
    const c = load({ cancel: true });
    await c.fn('reply42', 'art0001');
    assert.deepStrictEqual(c.ops, []);
    const s = load({ signedOut: true });
    await s.fn('reply42', 'art0001');
    assert.deepStrictEqual(s.ops, []);
    const bad = ['', 'a/b', "x');alert(1);('", '../reply', 'a'.repeat(129), null, 7];
    for (const id of bad) {
        const t = load();
        await t.fn(id, 'art0001');
        await t.fn('reply42', id);
        assert.deepStrictEqual(t.ops, [], String(id));
        assert.deepStrictEqual(t.confirms, [], 'no prompt for ' + String(id));
    }
});

test('rules: article_replies delete is author or admin only', function () {
    const rules = read('firestore.rules');
    const start = rules.indexOf('match /article_replies/{replyId}');
    assert.ok(start >= 0);
    const block = rules.slice(start, rules.indexOf('\n    }\n', start));
    const del = block.slice(block.indexOf('allow delete:'));
    assert.ok(/resource\.data\.authorId == request\.auth\.uid/.test(del));
    assert.ok(/isAdmin\(\)/.test(del));
    assert.ok(/request\.auth != null/.test(del));
});

(async function () {
    for (const t of queue) {
        try { await t.fn(); console.log('✅ ' + t.name); passed++; }
        catch (e) { console.log('❌ ' + t.name + ': ' + (e && e.message ? e.message : e)); failed++; }
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
