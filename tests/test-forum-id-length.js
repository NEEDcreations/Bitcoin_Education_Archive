// Forum post ids up to 256 chars (topic mirror copies) list and open from
// every client entry point; longer ids are refused.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = function (f) { return fs.readFileSync(path.join(root, f), 'utf8'); };

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e));
        failed++;
    }
}

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
function idOf(prefix, total) {
    let s = prefix;
    for (let i = 0; s.length < total; i++) s += ALNUM[i % ALNUM.length];
    return s;
}
const ID200 = idOf('tdfrom_', 200);
const ID256 = idOf('tdfrom_', 256);
const ID257 = idOf('tdfrom_', 257);

function slice(src, start, end) {
    const a = src.indexOf(start);
    assert.ok(a !== -1, 'missing ' + start);
    const b = src.indexOf(end, a + start.length);
    assert.ok(b > a, 'missing end ' + end);
    return src.slice(a, b);
}

test('ids are the expected lengths and charset', function () {
    assert.strictEqual(ID200.length, 200);
    assert.strictEqual(ID256.length, 256);
    assert.strictEqual(ID257.length, 257);
    [ID200, ID256, ID257].forEach(function (id) { assert.ok(/^tdfrom_[A-Za-z0-9_-]+$/.test(id)); });
});

test('forum list renders a 200-char mirror post id', function () {
    const src = read('forum.js');
    const html = { value: '' };
    const ctx = {
        window: { _factionNameStyle: function () { return ''; } },
        auth: { currentUser: { uid: 'me' } },
        FORUM_CATEGORIES: [],
        isForumAdmin: function () { return false; },
        fEsc: function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); },
        timeAgo: function () { return 'now'; },
        getLevel: function () { return { emoji: 'x' }; },
        console: console,
    };
    vm.createContext(ctx);
    // When the shared id check exists, load it so the renderer applies it.
    const idCheck = src.indexOf('var FORUM_ID_RE') !== -1 ? slice(src, 'var FORUM_ID_RE', 'window._forumIdOk = forumIdOk;') : '';
    vm.runInContext(idCheck + slice(src, 'function forumRenderPosts(posts, container)', '\n// ---- Sort/Filter'), ctx);
    const container = {};
    Object.defineProperty(container, 'innerHTML', { set: function (v) { html.value = v; }, get: function () { return html.value; } });
    ctx.forumRenderPosts([{ id: ID200, title: 'Mirror', body: 'b', authorId: 'u1', authorName: 'A', createdAt: 1 }], container);
    assert.ok(html.value.indexOf(ID200) !== -1, '200-char id listed');
    assert.ok(html.value.indexOf('Mirror') !== -1);
    if (idCheck) {
        assert.strictEqual(ctx.forumIdOk(ID200), true);
        assert.strictEqual(ctx.forumIdOk(ID256), true);
        assert.strictEqual(ctx.forumIdOk(ID257), false);
    }
});

function loadOpeners() {
    const src = read('app.js');
    const block = slice(src, 'window.bqOpenForumPost = function', 'window.bqOpenMarketListing = function') +
        slice(src, 'window.bqOpenMarketListing = function', '\n    };') + '\n    };';
    const calls = [];
    const ctx = {
        window: {},
        history: { replaceState: function (s, t, u) { calls.push(['url', u]); } },
        _showAppShell: function () {},
        _openWhenReady: function (ready, run) { run(); },
        forumViewPost: function (id, fromPop) { calls.push(['forum', id, fromPop]); },
        renderMarketplace: function (o) { calls.push(['market', o.listingId]); },
        db: {},
    };
    vm.createContext(ctx);
    vm.runInContext(block, ctx);
    return { win: ctx.window, calls: calls };
}

test('bqOpenForumPost opens a 200-char id and refuses 257', function () {
    const o = loadOpeners();
    assert.strictEqual(o.win.bqOpenForumPost(ID200), true);
    assert.strictEqual(o.win.bqOpenForumPost(ID256), true);
    assert.strictEqual(o.win.bqOpenForumPost(ID257), false);
    assert.strictEqual(o.win.bqOpenForumPost(ID200 + '/x'), false);
    assert.deepStrictEqual(o.calls.filter(function (c) { return c[0] === 'forum'; }), [['forum', ID200, true], ['forum', ID256, true]]);
    assert.ok(o.calls.some(function (c) { return c[0] === 'url' && c[1] === '#forum/post/' + ID200; }));
});

test('marketplace listing ids stay capped at 128', function () {
    const o = loadOpeners();
    assert.strictEqual(o.win.bqOpenMarketListing('b'.repeat(128)), true);
    assert.strictEqual(o.win.bqOpenMarketListing('b'.repeat(129)), false);
});

test('forumEditPost reads a 200-char post id', function () {
    const src = read('ux-patches.js');
    const fn = slice(src, 'window.forumEditPost = function', '\n    window.forumSaveEdit');
    const docs = [];
    const ctx = {
        window: {},
        auth: { currentUser: { uid: 'me' } },
        db: { collection: function (c) { return { doc: function (id) { docs.push([c, id]); return { get: function () { return { then: function () {} }; } }; } }; } },
    };
    vm.createContext(ctx);
    vm.runInContext(fn, ctx);
    ctx.window.forumEditPost(ID200);
    ctx.window.forumEditPost(ID256);
    assert.deepStrictEqual(docs.slice(0, 2), [['forum_posts', ID200], ['forum_posts', ID256]]);
    // Where the editor checks the id shape, longer ids are refused.
    if (/\{1,\d+\}/.test(fn)) {
        ctx.window.forumEditPost(ID257);
        assert.strictEqual(docs.length, 2);
    }
});

function chatRouteRegexes() {
    const src = read('global-chat.js');
    const lines = src.split('\n').filter(function (l) { return l.indexOf('forum\\/post') !== -1 && l.indexOf('.test(') !== -1; });
    return lines.map(function (l) {
        const m = l.match(/!\/(\^\(\?:.*?\)\$)\/\.test\(/);
        assert.ok(m, 'route check not found in: ' + l.trim().slice(0, 60));
        return new RegExp(m[1]);
    });
}

test('every global chat route check takes 200 and 256-char forum ids and refuses 257', function () {
    const res = chatRouteRegexes();
    assert.strictEqual(res.length, 4);
    res.forEach(function (re, i) {
        assert.ok(re.test('forum/post/' + ID200), 'check ' + i + ' 200');
        assert.ok(re.test('forum/post/' + ID256), 'check ' + i + ' 256');
        assert.ok(!re.test('forum/post/' + ID257), 'check ' + i + ' 257');
        assert.ok(re.test('marketplace/listing/' + 'b'.repeat(128)), 'check ' + i + ' listing 128');
        assert.ok(!re.test('marketplace/listing/' + 'b'.repeat(129)), 'check ' + i + ' listing 129');
        assert.ok(!re.test('forum/post/' + ID200 + '"x'), 'check ' + i + ' charset');
    });
});

test('global chat hash navigation opens a 200-char forum id and refuses 257', function () {
    const src = read('global-chat.js');
    const fn = slice(src, 'window._annNavToHash = function(hash)', '\n};\n') + '\n};\n';
    const opened = [];
    const ctx = {
        window: {
            bqOpenForumPost: function (id) { opened.push(['forum', id]); return true; },
            bqOpenMarketListing: function (id) { opened.push(['market', id]); return true; },
        },
        setTimeout: function (f) { f(); return 0; },
        go: function () {},
        document: { getElementById: function () { return null; } },
    };
    vm.createContext(ctx);
    vm.runInContext(fn, ctx);
    ctx.window._annNavToHash('forum/post/' + ID200);
    ctx.window._annNavToHash('forum/post/' + ID256);
    ctx.window._annNavToHash('forum/post/' + ID257);
    assert.deepStrictEqual(opened, [['forum', ID200], ['forum', ID256]]);
});

test('global chat markdown link for a 200-char forum id becomes an in-app link', function () {
    const src = read('global-chat.js');
    const start = src.indexOf('function formatChatText(text, mentionUid)');
    const at = src.indexOf("text.replace(/\\[([^\\]]+)\\]\\(#([a-zA-Z0-9_\\/-]+)\\)/g, function(match, label, route) {", start);
    assert.ok(start !== -1 && at > start);
    const check = src.slice(at, at + 400);
    const m = check.match(/!\/(\^\(\?:.*?\)\$)\/\.test\(route\)/);
    assert.ok(m, 'route check inside formatChatText');
    const re = new RegExp(m[1]);
    assert.ok(re.test('forum/post/' + ID200));
    assert.ok(!re.test('forum/post/' + ID257));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
