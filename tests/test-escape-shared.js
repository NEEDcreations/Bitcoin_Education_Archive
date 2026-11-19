// One shared escapeHtml: utils.js owns it, and nacho-qa.js uses it instead
// of replacing it. Loaded on its own, nacho-qa.js fills in the same rules.
const assert = require('assert');
const vm = require('vm');
const H = require('./helpers-markup.js');

const { test, run } = H.runner();
const UTILS = H.read('utils.js');
const NQA = H.read('nacho-qa.js');
const quiet = { log: function() {}, warn: function() {}, error: function() {} };

function domStub() {
    return {
        createElement: function() {
            let text = '';
            const el = { appendChild: function(n) { text += n.textContent; return n; } };
            Object.defineProperty(el, 'innerHTML', { get: function() { return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); } });
            return el;
        },
        createTextNode: function(s) { return { textContent: String(s) }; },
        getElementById: function() { return null; },
        querySelector: function() { return null; },
        querySelectorAll: function() { return []; },
        addEventListener: function() {},
        body: { appendChild: function() {} },
    };
}
function ctx() {
    const sandbox = {
        document: domStub(),
        console: quiet,
        localStorage: { getItem: function() { return null; }, setItem: function() {}, removeItem: function() {} },
        sessionStorage: { getItem: function() { return null; }, setItem: function() {} },
        navigator: { userAgent: '' },
        setTimeout: function() { return 0; },
        setInterval: function() { return 0; },
        clearTimeout: function() {},
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    return sandbox;
}
function runUtilsEscape(s) {
    const start = UTILS.indexOf('function escapeHtml(str) {');
    const end = UTILS.indexOf('\n// ---- Safe URL', start);
    assert.ok(start >= 0 && end > start, 'utils escapeHtml found');
    vm.runInContext(UTILS.slice(start, end), s, { filename: 'utils.js' });
}
function runNacho(s) {
    try { vm.runInContext(NQA, s, { filename: 'nacho-qa.js' }); } catch (e) { /* later browser-only setup */ }
}
const SAMPLES = [0, 42, 'Ada', '<b>"x"</b>', "it's & co", '', null, undefined, { a: 1 }, ['x']];

test('nacho-qa.js does not declare or assign its own escapeHtml', function() {
    assert.ok(!/function\s+escapeHtml\s*\(/.test(NQA));
    assert.ok(!/window\.escapeHtml\s*=/.test(NQA));
});

test('utils then nacho-qa: the shared escapeHtml stays in place', function() {
    const s = ctx();
    runUtilsEscape(s);
    const shared = s.escapeHtml;
    assert.strictEqual(typeof shared, 'function');
    runNacho(s);
    assert.strictEqual(s.escapeHtml, shared);
    assert.strictEqual(s.escapeHtml(0), '0');
    assert.strictEqual(s.escapeHtml({ a: 1 }), '');
    assert.strictEqual(s.escapeHtml('<a href="x">\'</a>'), '&lt;a href=&quot;x&quot;&gt;&#39;&lt;/a&gt;');
});

test('nacho-qa alone fills in escapeHtml with the same results', function() {
    const ref = ctx();
    runUtilsEscape(ref);
    const solo = ctx();
    runNacho(solo);
    assert.strictEqual(typeof solo.escapeHtml, 'function');
    SAMPLES.forEach(function(v) { assert.strictEqual(solo.escapeHtml(v), ref.escapeHtml(v), String(v)); });
});

test('nacho-qa then utils: utils escapeHtml wins', function() {
    const s = ctx();
    runNacho(s);
    runUtilsEscape(s);
    assert.strictEqual(s.escapeHtml(0), '0');
    assert.strictEqual(s.escapeHtml({ a: 1 }), '');
});

run();
