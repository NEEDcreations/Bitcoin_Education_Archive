// Topic Conversation modal: Posting… feedback, success confirmation,
// View in Pleb Talk deep link, and kept text on failure.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ok  ' + name); passed++; }
    catch (e) { console.log('  FAIL ' + name + ': ' + e.message); failed++; }
}

function loadClient() {
    const src = read('topic-discussions.js');
    const window = {
        addEventListener: function() {},
        location: { href: 'https://bitcoineducation.quest/', hash: '' }
    };
    const document = {
        getElementById: function() { return null; },
        createElement: function() { return { setAttribute: function() {}, appendChild: function() {}, addEventListener: function() {} }; },
        addEventListener: function() {},
        head: { appendChild: function() {} },
        body: { appendChild: function() {} }
    };
    window.document = document;
    window.window = window;
    const ctx = {
        window: window,
        document: document,
        history: { pushState: function() {}, back: function() {}, replaceState: function() {} },
        console: console
    };
    vm.createContext(ctx);
    vm.runInContext(src, ctx);
    return ctx.window;
}

const w = loadClient();
const reduce = w.bqReduceTopicConvoPost;
const forumId = w.bqForumPostIdForTopic;
const forumHash = w.bqForumHashForTopic;

test('exposes the post-state reducer and forum id helper', function() {
    assert.strictEqual(typeof reduce, 'function');
    assert.strictEqual(typeof forumId, 'function');
    assert.strictEqual(typeof forumHash, 'function');
});

test('forum post id matches the existing Pleb Talk mirror scheme', function() {
    assert.strictEqual(forumId('scarce-unforgeable-hedge', 'abc123'), 'tdforum_scarce-unforgeable-hedge_abc123');
    assert.strictEqual(forumId('', 'abc'), '');
    assert.strictEqual(forumId('mining', 'bad id'), '');
    assert.strictEqual(forumId('mining', '../../../x'), '');
});

test('topic forum hashes accept 129-256 char ids and refuse longer ones', function() {
    const mid = 'a'.repeat(129);
    const max = 'a'.repeat(256);
    const over = 'a'.repeat(257);
    assert.strictEqual(forumHash(mid), '#forum/post/' + mid);
    assert.strictEqual(forumHash(max), '#forum/post/' + max);
    assert.strictEqual(forumHash(over), '');
    assert.strictEqual(forumHash('a'.repeat(400)), '');
    const src = read('topic-discussions.js');
    const start = src.indexOf('function forumPostIdForTopic');
    const body = src.slice(start, src.indexOf('function idleConvoPostView', start));
    assert.ok(body.includes("slice(0, 256)"));
    assert.ok(!body.includes("slice(0, 400)"));
    assert.ok(body.includes('id.length > 256'));
    assert.ok(!body.includes('id.length > 400'));
});

test('submit with text goes to Posting… and disables the button', function() {
    const view = reduce(null, { type: 'submit', draft: 'What is scarce?' });
    assert.strictEqual(view.status, 'posting');
    assert.strictEqual(view.sendLabel, 'Posting…');
    assert.strictEqual(view.sendDisabled, true);
    assert.strictEqual(view.ariaBusy, true);
    assert.strictEqual(view.keepDraft, true);
    assert.strictEqual(view.draft, 'What is scarce?');
    assert.strictEqual(view.showComposer, true);
    assert.strictEqual(view.showSuccess, false);
});

test('a second submit while posting is ignored, so it cannot double-post', function() {
    const first = reduce(null, { type: 'submit', draft: 'What is scarce?' });
    const second = reduce(first, { type: 'submit', draft: 'What is scarce? again' });
    assert.strictEqual(second, first);
    assert.strictEqual(second.status, 'posting');
    assert.strictEqual(second.draft, 'What is scarce?');
});

test('empty submit stays idle and asks for a comment', function() {
    const view = reduce(null, { type: 'submit', draft: '   ' });
    assert.strictEqual(view.status, 'idle');
    assert.strictEqual(view.sendDisabled, false);
    assert.strictEqual(view.sendLabel, 'Post');
    assert.strictEqual(view.error, 'Write a comment first.');
    assert.strictEqual(view.keepDraft, true);
});

test('success shows Posted to Pleb Talk, a view link, and a reprompt', function() {
    const posting = reduce(null, { type: 'submit', draft: 'What is scarce?' });
    const view = reduce(posting, {
        type: 'success',
        postId: 'post99',
        channelId: 'mining',
        crossPosted: true,
        draft: ''
    });
    assert.strictEqual(view.status, 'success');
    assert.strictEqual(view.confirmation, 'Posted to Pleb Talk');
    assert.strictEqual(view.prompt, 'Post something else on this topic?');
    assert.strictEqual(view.forumPostId, 'tdforum_mining_post99');
    assert.strictEqual(view.forumHref, '#forum/post/tdforum_mining_post99');
    assert.strictEqual(view.viewLabel, 'View in Pleb Talk');
    assert.strictEqual(view.draft, '');
    assert.strictEqual(view.keepDraft, false);
    assert.strictEqual(view.showComposer, false);
    assert.strictEqual(view.showSuccess, true);
    assert.strictEqual(view.sendDisabled, true);
    assert.strictEqual(view.ariaBusy, false);
});

test('a skipped forum cross-post still confirms, without a view link', function() {
    const posting = reduce(null, { type: 'submit', draft: 'A comment' });
    const view = reduce(posting, {
        type: 'success',
        postId: 'post1',
        channelId: 'mining',
        crossPosted: false,
        crossPostNote: 'Your message was posted in this topic. It was not cross-posted to Pleb Talk.'
    });
    assert.strictEqual(view.status, 'success');
    assert.strictEqual(view.confirmation, 'Your message was posted in this topic. It was not cross-posted to Pleb Talk.');
    assert.strictEqual(view.forumHref, '');
    assert.strictEqual(view.viewLabel, '');
    assert.strictEqual(view.prompt, 'Post something else on this topic?');
});

test('failure keeps the typed text, shows the error, and re-enables Post', function() {
    const posting = reduce(null, { type: 'submit', draft: 'What is scarce?' });
    const view = reduce(posting, { type: 'error', message: 'Slow down — wait a moment before posting again.', draft: 'What is scarce?' });
    assert.strictEqual(view.status, 'error');
    assert.strictEqual(view.draft, 'What is scarce?');
    assert.strictEqual(view.keepDraft, true);
    assert.strictEqual(view.error, 'Slow down — wait a moment before posting again.');
    assert.strictEqual(view.confirmation, '');
    assert.strictEqual(view.sendLabel, 'Post');
    assert.strictEqual(view.sendDisabled, false);
    assert.strictEqual(view.ariaBusy, false);
    assert.strictEqual(view.showComposer, true);
});

test('Post something else returns to an empty, enabled composer', function() {
    const success = reduce(reduce(null, { type: 'submit', draft: 'Hi' }), {
        type: 'success',
        postId: 'p1',
        channelId: 'mining',
        crossPosted: true
    });
    const again = reduce(success, { type: 'again' });
    assert.strictEqual(again.status, 'idle');
    assert.strictEqual(again.draft, '');
    assert.strictEqual(again.confirmation, '');
    assert.strictEqual(again.forumHref, '');
    assert.strictEqual(again.sendDisabled, false);
    assert.strictEqual(again.sendLabel, 'Post');
    assert.strictEqual(again.showComposer, true);
    assert.strictEqual(again.showSuccess, false);
});

test('client wires posting, confirmation, and the existing forum opener', function() {
    const client = read('topic-discussions.js');
    assert.ok(client.includes("sendLabel: 'Posting…'"));
    assert.ok(client.includes("'Posted to Pleb Talk'"));
    assert.ok(client.includes("'Post something else on this topic?'"));
    assert.ok(client.includes("'View in Pleb Talk'"));
    assert.ok(client.includes("window.bqOpenForumPost"));
    assert.ok(client.includes("closeConvoSheet('back')"));
    assert.ok(client.includes('keepDraft'));
    assert.ok(client.includes("type: 'error'"));
    assert.ok(client.indexOf('innerHTML') === -1);
    assert.ok(client.includes('min-height:44px'));
    assert.ok(client.includes('.td-convo-success{border:1px solid #15803d;background:#14532d;color:#ecfce5;}'));
    assert.ok(client.includes('[data-theme="light"] .td-convo-success{border-color:#166534;background:#dcfce7;color:#14532d;}'));
    assert.ok(client.includes('.oled-theme .td-convo-success{border-color:#4ade80;background:#052e16;color:#bbf7d0;}'));
});

test('service worker is at or past v2635 and the bundle pin matches the ship version', function() {
    const sw = read('sw.js');
    const html = read('index.html');
    const swVersion = sw.match(/CACHE_NAME = 'btc-archive-v(\d+)'/);
    assert.ok(swVersion && Number(swVersion[1]) >= 2635);
    assert.strictEqual(html, read('404.html'));
    assert.strictEqual((html.match(/bundle\.min\.js\?v=20261126_v2698/g) || []).length, 2);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
