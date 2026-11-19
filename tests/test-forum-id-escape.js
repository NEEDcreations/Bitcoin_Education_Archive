// PlebTalk item ids: rendered lists use data attributes and one delegated
// click listener on the forum container. Ids outside the allowed pattern are
// skipped, and valid ids still reach their actions.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

let passed = 0;
let failed = 0;
const queue = [];
function test(name, fn) {
    queue.push(async function() {
        try { await fn(); console.log('✅ ' + name); passed++; }
        catch (e) { console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e)); failed++; }
    });
}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const ODD_IDS = [
    "x' onerror='MARKQ1",
    '"><img src=x onerror=MARKQ2>',
    "a');MARKQ3();//",
    '<svg/onload=MARKQ4>',
    'MARKQ5 with space',
    'MARKQ6' + 'a'.repeat(64),
    '',
];
const ODD_AUTHOR = '"><img src=x onerror=MARKQ7>';

// ---- tiny markup reader: start tags with quoted attributes ----
const TAG_RE = /<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s=>\/"']+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g;
const ATTR_RE = /([^\s=>\/"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
function readTags(html) {
    const tags = [];
    let m;
    TAG_RE.lastIndex = 0;
    while ((m = TAG_RE.exec(html))) {
        const attrs = {};
        let a;
        ATTR_RE.lastIndex = 0;
        while ((a = ATTR_RE.exec(m[2]))) {
            const v = a[2] !== undefined ? a[2] : a[3] !== undefined ? a[3] : a[4] !== undefined ? a[4] : '';
            attrs[a[1].toLowerCase()] = v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        }
        tags.push({ name: m[1].toLowerCase(), attrs: attrs });
    }
    return tags;
}
function leftoverMarkup(html) {
    return html.replace(TAG_RE, '').replace(/<\/[a-zA-Z][a-zA-Z0-9]*\s*>/g, '');
}

// ---- fake page ----
function makeEl(id) {
    const el = {
        id: id, innerHTML: '', style: {}, scrollTop: 0, listeners: {},
        addEventListener: function(type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
        contains: function() { return true; },
        appendChild: function() {},
        querySelector: function() { return null; },
    };
    return el;
}

function makeDb(store) {
    function snapOf(list) {
        return { empty: list.length === 0, forEach: function(cb) { list.forEach(cb); } };
    }
    function docSnap(id, data) { return { id: id, exists: !!data, data: function() { return Object.assign({}, data); } }; }
    return {
        collection: function(name) {
            const rows = store[name] || {};
            const filters = [];
            const q = {
                doc: function(id) { return { get: async function() { return docSnap(id, rows[id]); } }; },
                where: function(field, op, value) { filters.push([field, value]); return q; },
                orderBy: function() { return q; },
                limit: function() { return q; },
                get: async function() {
                    const list = Object.keys(rows).filter(function(id) {
                        return filters.every(function(f) { return rows[id][f[0]] === f[1]; });
                    }).map(function(id) { return docSnap(id, rows[id]); });
                    return snapOf(list);
                },
            };
            return q;
        },
    };
}

function loadForum(store) {
    const els = {};
    const always = { forumContainer: true, main: true, forumPosts: true };
    const warnings = [];
    const document = {
        readyState: 'complete',
        head: { appendChild: function() {} },
        body: {},
        createElement: function() { return makeEl(''); },
        addEventListener: function() {},
        getElementById: function(id) {
            if (els[id]) return els[id];
            const fc = els.forumContainer;
            if (always[id] || (fc && fc.innerHTML.indexOf('id="' + id + '"') !== -1)) { els[id] = makeEl(id); return els[id]; }
            return null;
        },
        querySelector: function() { return null; },
    };
    const sandbox = {
        document: document,
        console: { log: function() {}, error: function() {}, warn: function(msg) { warnings.push(String(msg)); } },
        sessionStorage: { getItem: function() { return null; }, setItem: function() {} },
        localStorage: { getItem: function() { return null; }, setItem: function() {} },
        history: { pushState: function() {} },
        setTimeout: function() { return 0; },
        clearTimeout: function() {},
        MutationObserver: function() { this.observe = function() {}; this.disconnect = function() {}; },
        db: makeDb(store),
        auth: { currentUser: { uid: 'viewer1', isAnonymous: false } },
        timeAgo: function() { return 'now'; },
        getLevel: function() { return { emoji: '*' }; },
        firebase: { firestore: { FieldValue: {} } },
    };
    sandbox.window = sandbox;
    sandbox._isAdminClaim = true;
    sandbox._factionNameStyle = function() { return 'color:red'; };
    vm.createContext(sandbox);
    vm.runInContext(read('forum.js'), sandbox, { filename: 'forum.js' });
    return { win: sandbox, els: els, warnings: warnings };
}

function replyStore() {
    const replies = {
        'reply_A-1': { postId: 'post1', authorId: 'viewer1', authorName: 'Ada', body: 'first', upvotes: 1 },
        'reply2': { postId: 'post1', authorId: 'user_2', authorName: 'Bea', body: 'nested', parentReplyId: 'reply_A-1' },
        'reply3': { postId: 'post1', authorId: ODD_AUTHOR, authorName: 'Cy', body: 'third' },
    };
    ODD_IDS.forEach(function(id, i) {
        if (id === '') return;
        replies[id] = { postId: 'post1', authorId: 'user_' + i, authorName: 'Odd' + i, body: 'odd body ' + i };
    });
    return {
        forum_posts: {
            post1: { title: 'Hello', body: 'post body', authorId: 'viewer1', authorName: 'Ada', upvotes: 2 },
        },
        forum_replies: replies,
    };
}

async function flush() { for (let i = 0; i < 10; i++) await new Promise(function(r) { setImmediate(r); }); }

function assertClean(html) {
    assert.ok(html.length > 0);
    assert.strictEqual(html.indexOf('MARKQ'), -1, 'odd item text reached the markup');
    assert.strictEqual(/onerror|onload/i.test(html), false);
    const rest = leftoverMarkup(html);
    assert.strictEqual(/[<>]/.test(rest), false, 'unparsed markup left over');
    const tags = readTags(html);
    tags.forEach(function(t) {
        Object.keys(t.attrs).forEach(function(k) {
            if (k.indexOf('on') === 0) {
                if (k === 'onclick') assert.strictEqual(t.attrs['data-forum-action'], undefined, 'action element carries a click handler');
                assert.ok(!/reply_A-1|reply2|reply3|post1|post_ok|user_|viewer1|art_1|c_ok/.test(t.attrs[k]), 'inline handler embeds an id: ' + t.attrs[k]);
            }
        });
        if (t.attrs['data-id'] !== undefined) assert.ok(ID_RE.test(t.attrs['data-id']), 'data-id ' + t.attrs['data-id']);
        if (t.attrs['data-parent'] !== undefined) assert.ok(ID_RE.test(t.attrs['data-parent']));
    });
    return tags;
}

function elFrom(attrs) {
    return {
        nodeType: 1,
        getAttribute: function(k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
        closest: function(sel) { return sel === '[data-forum-action]' && attrs['data-forum-action'] ? this : null; },
    };
}

test('a thread with odd reply ids renders only the valid replies', async function() {
    const f = loadForum(replyStore());
    await f.win.forumViewPost('post1', true);
    await flush();
    const html = f.els.forumReplies.innerHTML;
    const tags = assertClean(html);
    const ids = tags.filter(function(t) { return t.attrs['data-forum-action'] === 'vote-reply'; }).map(function(t) { return t.attrs['data-id']; });
    assert.deepStrictEqual(ids.sort(), ['reply2', 'reply3', 'reply_A-1']);
    assert.ok(html.indexOf('3 replies') !== -1);
    assert.ok(f.warnings.length >= ODD_IDS.length - 1);
    f.warnings.forEach(function(w) { assert.strictEqual(w.indexOf('MARKQ'), -1); });
});

test('an author uid outside the pattern renders as plain text', async function() {
    const f = loadForum(replyStore());
    await f.win.forumViewPost('post1', true);
    await flush();
    const tags = readTags(f.els.forumReplies.innerHTML);
    const profiles = tags.filter(function(t) { return t.attrs['data-forum-action'] === 'profile'; }).map(function(t) { return t.attrs['data-id']; });
    assert.deepStrictEqual(profiles.sort(), ['user_2', 'viewer1']);
    assert.ok(f.els.forumReplies.innerHTML.indexOf('Cy') !== -1);
});

test('the post view has no inline handlers on item actions', async function() {
    const f = loadForum(replyStore());
    await f.win.forumViewPost('post1', true);
    await flush();
    const tags = assertClean(f.els.forumContainer.innerHTML);
    const actions = tags.map(function(t) { return t.attrs['data-forum-action']; }).filter(Boolean).sort();
    assert.deepStrictEqual(actions, ['delete-post', 'profile', 'submit-reply', 'vote-post']);
    assert.strictEqual(tags.filter(function(t) { return t.attrs['data-forum-card'] === 'post'; }).length, 1);
});

test('one delegated listener routes valid ids from the rendered markup', async function() {
    const f = loadForum(replyStore());
    await f.win.forumViewPost('post1', true);
    await f.win.forumViewPost('post1', true);
    await flush();
    const fc = f.els.forumContainer;
    assert.strictEqual((fc.listeners.click || []).length, 1);
    const calls = [];
    f.win.forumVoteReply = function(id) { calls.push(['vote', id]); };
    f.win.forumDeleteReply = function(id, parent) { calls.push(['delete', id, parent]); };
    f.win.forumReplyToReply = function(id, name) { calls.push(['reply', id, name]); };
    f.win.showUserProfile = function(id) { calls.push(['profile', id]); };
    const tags = readTags(f.els.forumReplies.innerHTML);
    const pick = function(action, id) {
        return tags.find(function(t) { return t.attrs['data-forum-action'] === action && t.attrs['data-id'] === id; });
    };
    const handler = fc.listeners.click[0];
    handler.call(fc, { target: elFrom(pick('vote-reply', 'reply_A-1').attrs) });
    handler.call(fc, { target: elFrom(pick('delete-reply', 'reply2').attrs) });
    handler.call(fc, { target: elFrom(pick('reply-to', 'reply2').attrs) });
    handler.call(fc, { target: elFrom(pick('profile', 'user_2').attrs) });
    assert.deepStrictEqual(calls, [
        ['vote', 'reply_A-1'],
        ['delete', 'reply2', 'post1'],
        ['reply', 'reply2', 'Bea'],
        ['profile', 'user_2'],
    ]);
});

test('the listener ignores elements whose ids are outside the pattern', async function() {
    const f = loadForum(replyStore());
    await f.win.forumViewPost('post1', true);
    await flush();
    const fc = f.els.forumContainer;
    const calls = [];
    f.win.forumVoteReply = function(id) { calls.push(id); };
    f.win.forumDeleteReply = function(id, parent) { calls.push(id + '|' + parent); };
    const handler = fc.listeners.click[0];
    const before = f.warnings.length;
    ODD_IDS.forEach(function(id) {
        handler.call(fc, { target: elFrom({ 'data-forum-action': 'vote-reply', 'data-id': id }) });
    });
    handler.call(fc, { target: elFrom({ 'data-forum-action': 'delete-reply', 'data-id': 'reply2', 'data-parent': ODD_IDS[0] }) });
    handler.call(fc, { target: elFrom({ 'data-forum-action': 'vote-reply' }) });
    handler.call(fc, { target: elFrom({ 'data-forum-action': 'unknown', 'data-id': 'reply2' }) });
    handler.call(fc, { target: elFrom({ 'data-forum-action': 'constructor', 'data-id': 'reply2' }) });
    assert.deepStrictEqual(calls, []);
    assert.ok(f.warnings.length > before);
});

test('the post list skips odd post ids and keeps valid ones', async function() {
    const store = { forum_posts: {
        post_ok1: { title: 'Fine', body: 'b', authorId: 'user_1', authorName: 'Ada', category: 'general', createdAt: 1 },
    } };
    ODD_IDS.forEach(function(id, i) { if (id) store.forum_posts[id] = { title: 'Odd' + i, body: 'b', authorId: 'user_9', authorName: 'Z', createdAt: 1 }; });
    store.forum_posts.post_ok2 = { title: 'Also fine', authorId: ODD_AUTHOR, authorName: 'Bo', createdAt: 1 };
    const f = loadForum(store);
    await f.win.forumLoadPosts();
    await flush();
    const tags = assertClean(f.els.forumPosts.innerHTML);
    const views = tags.filter(function(t) { return t.attrs['data-forum-action'] === 'view-post'; }).map(function(t) { return t.attrs['data-id']; });
    assert.deepStrictEqual(views.sort(), ['post_ok1', 'post_ok2']);
    const votes = tags.filter(function(t) { return t.attrs['data-forum-action'] === 'vote-post'; }).length;
    assert.strictEqual(votes, 2);
});

test('opening a post or article with an odd id does nothing', async function() {
    const f = loadForum(replyStore());
    let reads = 0;
    const realCollection = f.win.db.collection;
    f.win.db.collection = function(name) { reads++; return realCollection(name); };
    for (const id of ODD_IDS) {
        await f.win.forumViewPost(id, true);
        await f.win.articleView(id);
    }
    assert.strictEqual(reads, 0);
    assert.strictEqual(f.els.forumContainer.innerHTML, '');
});

test('article comments skip odd ids and keep valid ones', async function() {
    const store = {
        articles: { art_1: { title: 'T', body: 'x', authorId: 'viewer1', authorName: 'Ada', status: 'published' } },
        article_replies: { 'c_ok': { articleId: 'art_1', authorId: 'user_2', authorName: 'Bea', body: 'nice' } },
    };
    ODD_IDS.forEach(function(id, i) { if (id) store.article_replies[id] = { articleId: 'art_1', authorId: 'user_3', authorName: 'Z' + i, body: 'odd' }; });
    const f = loadForum(store);
    f.win.mdToHtml = undefined;
    await f.win.articleView('art_1');
    await flush();
    const page = assertClean(f.els.forumContainer.innerHTML);
    const pageActions = page.map(function(t) { return t.attrs['data-forum-action']; }).filter(Boolean).sort();
    assert.deepStrictEqual(pageActions, ['article-delete', 'article-edit', 'article-pin', 'article-submit-reply', 'article-vote', 'profile']);
    const tags = assertClean(f.els.articleReplies.innerHTML);
    const ids = tags.filter(function(t) { return t.attrs['data-forum-action'] === 'article-reply-to'; }).map(function(t) { return t.attrs['data-id']; });
    assert.deepStrictEqual(ids, ['c_ok']);
    const del = tags.find(function(t) { return t.attrs['data-forum-action'] === 'delete-reply'; });
    assert.strictEqual(del.attrs['data-parent'], 'art_1');
});

test('the tip and double-tap helpers find forum buttons by data attributes', function() {
    const tips = read('tips-integrations.js.src');
    assert.ok(tips.includes('button[data-forum-action="vote-post"], button[data-forum-action="vote-reply"]'));
    assert.ok(tips.includes("btn.closest('[data-forum-card]')"));
    assert.ok(tips.includes('[data-forum-action="profile"]'));
    assert.ok(!tips.includes('onclick*="forumVote'));
    const tipsMin = read('tips-integrations.js');
    assert.ok(tipsMin.includes('data-forum-action="vote-post"'));
    assert.ok(!tipsMin.includes('onclick*="forumVote'));
    const ux = read('mobile-ux.js');
    assert.ok(ux.includes('[data-forum-action="view-post"]'));
    assert.ok(ux.includes('[data-forum-action="vote-post"]'));
    assert.ok(!ux.includes('onclick*="forumViewPost"'));
    const forum = read('forum.js');
    assert.ok(!/onclick="[^"]*(forumVote|forumDelete|forumViewPost|articleView|articleVote|articleDelete|articleEdit|articleTogglePin|forumSubmitReply|articleSubmitReply)/.test(forum));
    const bundle = read('bundle.src.js');
    assert.ok(bundle.includes(forum));
});

(async function() {
    for (const fn of queue) await fn();
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
})();
