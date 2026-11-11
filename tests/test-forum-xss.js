// Pleb Talk: crafted Firestore doc ids / fields cannot become markup or script.
// Regression for the Nov 8 forum_posts doc whose ID was  x53326"><img src=x onerror=alert(1)>
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'forum.js'), 'utf8');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

function storage() { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; }
function makeCtx() {
    const listeners = [];
    const calls = [];
    const document = {
        addEventListener: (t, fn) => listeners.push({ t, fn }),
        getElementById: () => null,
        createElement: () => ({ style: {}, appendChild() {}, setAttribute() {} }),
        head: { appendChild() {} },
        documentElement: { appendChild() {} },
    };
    const window = {};
    const ctx = {
        window, document, localStorage: storage(), sessionStorage: storage(), console,
        URL, Number, String, Object, Date, Math, JSON, history: { pushState() {} },
        auth: { currentUser: null }, setTimeout, clearTimeout,
        showUserProfile: (id) => calls.push(['profile', id]),
    };
    window.document = document;
    ctx.self = ctx;
    vm.createContext(ctx);
    vm.runInContext(src, ctx, { filename: 'forum.js' });
    // capture calls into the action targets
    ['forumViewPost', 'forumVotePost', 'forumDeletePost', 'articleView', 'snOpenPost'].forEach((n) => {
        ctx[n] = (...a) => calls.push([n, ...a]);
        window[n] = ctx[n];
    });
    return { ctx, listeners, calls };
}

const PAYLOADS = [
    'x53326"><img src=x onerror=alert(1)>',
    "x');alert(1);//",
    'x" onmouseover="alert(1)',
    '<script>alert(1)</script>',
    "javascript:alert(1)",
    'a b',
];

test('forum.js has no inline handler built from a doc id, uid, or article id', () => {
    const bad = src.match(/on[a-z]+="[^"\n]*\\'' \+ (p\.id|p\.authorId|r\.id|r\.authorId|r\.postId|a\.id|a\.authorId|articleId|item\.id) \+/g);
    assert.strictEqual(bad, null, String(bad));
    assert.ok(!/snOpenPost\(' \+ item\.id/.test(src));
});

test('fId accepts plain tokens (incl. 46-char mirror ids) and rejects payloads', () => {
    const { ctx } = makeCtx(); const S = ctx.window._forumSafe;
    assert.strictEqual(S.fId('VA7aTZ8Q2IcWNITVqPBQ'), 'VA7aTZ8Q2IcWNITVqPBQ');
    assert.strictEqual(S.fId('tdforum_problems-of-money_kFmhpdzU92fJ0vxOpuQT'), 'tdforum_problems-of-money_kFmhpdzU92fJ0vxOpuQT');
    PAYLOADS.forEach((p) => assert.strictEqual(S.fId(p), '', p));
    assert.strictEqual(S.fId(null), '');
});

test('fEsc encodes & < > " \'', () => {
    const { ctx } = makeCtx(); const S = ctx.window._forumSafe;
    assert.strictEqual(S.fEsc(`<a href="x" onclick='y'>&`), '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;');
});

test('fSafeUrl keeps http(s) only', () => {
    const { ctx } = makeCtx(); const S = ctx.window._forumSafe;
    assert.strictEqual(S.fSafeUrl('https://ex.com/a.png'), 'https://ex.com/a.png');
    ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>', 'vbscript:x'].forEach((u) => assert.strictEqual(S.fSafeUrl(u), '', u));
});

function renderList(posts) {
    const { ctx } = makeCtx();
    ctx.getLevel = () => ({ emoji: '🟢' });
    ctx.timeAgo = () => '1h';
    // signed in as the author so the delete button (another id sink) renders too
    ctx.auth.currentUser = { uid: posts[0].authorId, email: '' };
    const container = { innerHTML: '' };
    ctx.window._forumSafe.renderPosts(posts, container);
    return container.innerHTML;
}

test('the live crafted-id post renders inert and its text renders correctly', () => {
    const html = renderList([{ id: 'x53326"><img src=x onerror=alert(1)>', title: 'docid-test-i53326', body: 'canary', authorId: 'u1', authorName: 'c', upvotes: 0 }]);
    assert.ok(!/<img/i.test(html), 'img tag leaked');
    assert.ok(!/onerror/i.test(html), 'onerror leaked');
    assert.ok(!/onmouseover|onmouseout/.test(html), 'inline hover handlers remain');
    assert.ok(!/data-fa="(viewPost|votePost|deletePost)"/.test(html), 'bad id should not be clickable');
    assert.ok(html.includes('docid-test-i53326'), 'title missing');
    assert.ok(html.includes('canary'), 'body missing');
});

test('payloads in every post field stay text', () => {
    PAYLOADS.forEach((p) => {
        const html = renderList([{ id: p, title: p + ' title', body: p, authorId: p, authorName: p, category: p, upvotes: 0 }]);
        assert.ok(!/<(img|script|svg)/i.test(html), 'tag leaked for ' + p);
        assert.ok(!/ on[a-z]+="[^"]*alert/i.test(html), 'handler leaked for ' + p);
        assert.ok(!/data-id="[^"]*[<>"' ]/.test(html), 'data-id leaked for ' + p);
    });
});

test('a normal post is clickable through delegated data-fa', () => {
    const html = renderList([{ id: 'VA7aTZ8Q2IcWNITVqPBQ', title: "How'd you hear?", authorId: 'EzWnUid1', authorName: 'Ada', upvotes: 1 }]);
    assert.ok(html.includes('data-fa="viewPost" data-id="VA7aTZ8Q2IcWNITVqPBQ"'));
    assert.ok(html.includes('data-fa="votePost"'));
    assert.ok(html.includes('data-fa="profile" data-id="EzWnUid1"'));
    assert.ok(html.includes('How&#39;d you hear?'));
});

test('delegated click handler rejects crafted ids and dispatches clean ones', () => {
    const { ctx, listeners, calls } = makeCtx();
    const click = listeners.find((l) => l.t === 'click');
    assert.ok(click, 'no click listener');
    function fire(attrs) {
        const el = { getAttribute: (k) => (k in attrs ? attrs[k] : null) };
        let stopped = false;
        click.fn({ target: { closest: () => el }, stopPropagation: () => { stopped = true; } });
        return stopped;
    }
    fire({ 'data-fa': 'viewPost', 'data-id': 'x"><img src=x onerror=alert(1)>' });
    fire({ 'data-fa': 'constructor', 'data-id': 'abc' });
    fire({ 'data-fa': '__proto__', 'data-id': 'abc' });
    fire({ 'data-fa': 'snOpen', 'data-id': '1);alert(1' });
    assert.deepStrictEqual(calls, []);
    fire({ 'data-fa': 'viewPost', 'data-id': 'abc123' });
    fire({ 'data-fa': 'snOpen', 'data-id': '424242' });
    assert.deepStrictEqual(calls, [['forumViewPost', 'abc123'], ['snOpenPost', 424242]]);
});

test('rules: client-created forum/article ids must be plain tokens', () => {
    assert.ok(/function forumDocIdOk\(id\)[\s\S]{0,120}\^\[A-Za-z0-9_-\]\{1,64\}\$/.test(rules));
    [['forum_posts', 'postId'], ['forum_replies', 'replyId'], ['articles', 'articleId'], ['article_replies', 'replyId']].forEach(([c, v]) => {
        const re = new RegExp('match /' + c + '/\\{' + v + '\\} \\{[\\s\\S]{0,200}allow create: if request\\.auth != null\\s*&& forumDocIdOk\\(' + v + '\\)');
        assert.ok(re.test(rules), c);
    });
    const ID = /^[A-Za-z0-9_-]{1,64}$/;
    assert.ok(!ID.test('x53326"><img src=x onerror=alert(1)>'));
    assert.ok(ID.test('tdreply_problems-of-money_kFmhpdzU92fJ0vxOpuQT'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
