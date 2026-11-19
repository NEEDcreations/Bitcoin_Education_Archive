// Tip buttons and the tip overlay only accept a text name.
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
        catch (e) { console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e)); failed++; }
    });
}

function htmlDoc() {
    function makeEl() {
        const kids = [];
        const el = {
            style: { cssText: '' },
            innerHTML: '',
            id: '',
            onclick: null,
            children: kids,
            appendChild: function(n) { kids.push(n); n.parentNode = el; return n; },
        };
        return el;
    }
    const body = makeEl();
    const els = {};
    const document = {
        body: body,
        createElement: function() { return makeEl(); },
        createTextNode: function(s) { return { textContent: String(s), text: String(s) }; },
        getElementById: function(id) { return els[id] || null; },
        addEventListener: function() {},
    };
    // escapeHtml writes through createElement('div') + createTextNode + innerHTML
    const origCreate = document.createElement;
    document.createElement = function(tag) {
        const el = origCreate();
        let text = '';
        el.appendChild = function(n) {
            text += (n && (n.textContent || n.text) != null) ? String(n.textContent || n.text) : '';
            return n;
        };
        Object.defineProperty(el, 'innerHTML', {
            get: function() {
                return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            },
            set: function(v) { text = String(v == null ? '' : v); },
        });
        return el;
    };
    return { document: document, body: body, els: els };
}

function loadEscape() {
    const page = htmlDoc();
    const sandbox = {
        document: page.document,
        window: {},
        console: { log: function() {}, warn: function() {}, error: function() {} },
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    const src = read('utils.js');
    const start = src.indexOf('function escapeHtml(str) {');
    const end = src.indexOf('\n// ---- Safe URL', start);
    if (start < 0 || end < 0) throw new Error('could not find escapeHtml');
    vm.runInContext(src.slice(start, end) + '\nthis.escapeHtml = escapeHtml;', sandbox);
    return sandbox;
}

function loadTips() {
    const page = htmlDoc();
    const sandbox = {
        document: page.document,
        console: { log: function() {}, warn: function() {}, error: function() {} },
        localStorage: { getItem: function() { return null; }, setItem: function() {} },
        setTimeout: function() { return 0; },
        escapeHtml: function(s) {
            if (typeof s === 'number') s = String(s);
            else if (typeof s !== 'string') return '';
            return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        },
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(read('lightning-tips.js.src'), sandbox, { filename: 'lightning-tips.js.src' });
    return { sandbox: sandbox, page: page };
}

function loadArticle(authorName) {
    const seen = [];
    const els = {};
    function makeEl(id) {
        return {
            id: id || '', innerHTML: '', style: {}, listeners: {},
            addEventListener: function() {},
            appendChild: function() {},
            querySelector: function() { return null; },
        };
    }
    const document = {
        readyState: 'complete',
        head: { appendChild: function() {} },
        body: { appendChild: function() {} },
        createElement: function() { return makeEl(''); },
        createTextNode: function(s) { return { textContent: String(s) }; },
        addEventListener: function() {},
        getElementById: function(id) {
            if (!els[id]) els[id] = makeEl(id);
            return els[id];
        },
        querySelector: function() { return null; },
    };
    const sandbox = {
        document: document,
        console: { log: function() {}, warn: function() {}, error: function() {} },
        sessionStorage: { getItem: function() { return null; }, setItem: function() {} },
        localStorage: { getItem: function() { return null; }, setItem: function() {} },
        history: { pushState: function() {} },
        setTimeout: function() { return 0; },
        clearTimeout: function() {},
        MutationObserver: function() { this.observe = function() {}; this.disconnect = function() {}; },
        auth: { currentUser: { uid: 'viewer1', isAnonymous: false } },
        timeAgo: function() { return 'now'; },
        getLevel: function() { return { emoji: '*' }; },
        mdToHtml: function() { return ''; },
        firebase: { firestore: { FieldValue: {} } },
        db: {
            collection: function() {
                return {
                    doc: function() {
                        return {
                            get: async function() {
                                return {
                                    exists: true,
                                    data: function() {
                                        return {
                                            title: 'Hello',
                                            body: 'Hi',
                                            authorId: 'author1',
                                            authorName: authorName,
                                            authorPoints: 0,
                                            wordCount: 200,
                                        };
                                    },
                                };
                            },
                        };
                    },
                };
            },
        },
        tipButtonHtml: function(p) { seen.push(p); return '<button data-tip="stub"></button>'; },
    };
    sandbox.window = sandbox;
    sandbox._isAdminClaim = false;
    sandbox._factionNameStyle = function() { return ''; };
    vm.createContext(sandbox);
    vm.runInContext(read('forum.js'), sandbox, { filename: 'forum.js' });
    return { sandbox: sandbox, seen: seen, els: els };
}

const hostile = {
    toString: function() { return this; },
    valueOf: function() { return this; },
};

test('escapeHtml returns empty text for objects, arrays and null', function() {
    const s = loadEscape();
    assert.strictEqual(typeof s.escapeHtml, 'function');
    assert.strictEqual(s.escapeHtml({ a: 1 }), '');
    assert.strictEqual(s.escapeHtml(['x']), '');
    assert.strictEqual(s.escapeHtml(null), '');
    assert.strictEqual(s.escapeHtml(undefined), '');
    assert.doesNotThrow(function() { s.escapeHtml(hostile); });
    assert.strictEqual(s.escapeHtml(hostile), '');
});

test('escapeHtml keeps numbers and strings', function() {
    const s = loadEscape();
    assert.strictEqual(s.escapeHtml(0), '0');
    assert.strictEqual(s.escapeHtml(42), '42');
    assert.strictEqual(s.escapeHtml('Ada'), 'Ada');
    assert.strictEqual(s.escapeHtml('<b>'), '&lt;b&gt;');
    assert.strictEqual(s.escapeHtml('a"b'), 'a&quot;b');
});

test('showTipOverlay refuses a non-string name without opening or throwing', function() {
    [ {}, [], null, 12, hostile ].forEach(function(name) {
        const t = loadTips();
        const before = t.page.body.children.length;
        assert.doesNotThrow(function() {
            t.sandbox.showTipOverlay({ recipientName: name, recipientUid: 'author1' });
        });
        assert.strictEqual(t.page.body.children.length, before);
        assert.strictEqual(t.page.document.getElementById('tipOverlay'), null);
    });
});

test('showTipOverlay still opens for a text name', function() {
    const t = loadTips();
    t.sandbox.showTipOverlay({ recipientName: 'Ada', recipientUid: 'author1' });
    assert.ok(t.page.body.children.length >= 1);
    const ov = t.page.body.children[0];
    assert.strictEqual(ov.id, 'tipOverlay');
    assert.ok(String(ov.innerHTML).includes('Ada'));
});

test('articleView passes only a string name into the tip button', async function() {
    const cases = [
        [ { first: 'Ada' }, 'map' ],
        [ ['Ada'], 'array' ],
        [ null, 'null' ],
    ];
    for (const pair of cases) {
        const t = loadArticle(pair[0]);
        await t.sandbox.articleView('article1');
        assert.ok(t.seen.length >= 1, 'tip button called for ' + pair[1]);
        assert.strictEqual(typeof t.seen[0].recipientName, 'string', pair[1]);
        assert.strictEqual(t.seen[0].recipientName, '', pair[1]);
    }
    const ok = loadArticle('Ada');
    await ok.sandbox.articleView('article1');
    assert.strictEqual(ok.seen[0].recipientName, 'Ada');
});

(async function() {
    for (const run of queue) await run();
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
})();
