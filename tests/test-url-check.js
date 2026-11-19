// One shared url check: utils.js owns sanitizeUrl, nacho-qa.js only fills it
// in when loaded on its own, and callers escape the result once.
const assert = require('assert');
const vm = require('vm');
const H = require('./helpers-markup.js');

const { test, run } = H.runner();
const UTILS = H.read('utils.js');
const NQA = H.read('nacho-qa.js');
const FORUM = H.read('forum.js');
const MSG = H.read('messaging.js');
const RANK = H.read('ranking.js');
const TIPS = H.read('lightning-tips.js.src');
const quiet = { log: function() {}, warn: function() {}, error: function() {} };

function esc(s) {
    if (typeof s === 'number') s = String(s);
    else if (typeof s !== 'string') return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function ctx() {
    const sandbox = {
        console: quiet,
        document: {
            createElement: function() { return { appendChild: function() {}, style: {}, setAttribute: function() {} }; },
            createTextNode: function(s) { return { textContent: String(s) }; },
            getElementById: function() { return null; },
            querySelector: function() { return null; },
            querySelectorAll: function() { return []; },
            addEventListener: function() {},
            body: { appendChild: function() {} },
        },
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
function runUtilsUrl(s) {
    vm.runInContext(H.sliceFunction(UTILS, 'function sanitizeUrl(url) {'), s, { filename: 'utils.js' });
}
function runNacho(s) {
    try { vm.runInContext(NQA, s, { filename: 'nacho-qa.js' }); } catch (e) { /* later browser-only setup */ }
}

const REJECT = [
    '\x01javascript:alert(1)', '\x00javascript:alert(1)', 'java\tscript:alert(1)', 'java\nscript:alert(1)',
    'javascript:alert(1)', ' JavaScript:alert(1)', 'vbscript:x', 'blob:https://a.example/x',
    '//evil.host/x', '\\\\evil/x', '/\\evil/x', '//', 'https:///evil.host', 'https:\\\\evil.host', 'http:/\\evil.host',
    'https://a.example/x y', 'https://a.example/\u0085x', 'https://a.example/\u007fx',
    'data:text/html;base64,PHNjcmlwdD4=', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png,abc',
    'ftp://a.example/', 'mailto:a@b.c', 'relative/path', '', null, undefined, 42, {}, ['https://a.example/'],
];
const ALLOW = [
    ['https://a.example/x?a=1&b=2', 'https://a.example/x?a=1&b=2'],
    ['  http://a.example  ', 'http://a.example'],
    ['HTTPS://A.example/', 'HTTPS://A.example/'],
    ['/path/to?x=1', '/path/to?x=1'],
    ['/', '/'],
    ['data:image/png;base64,iVBORw0KGgo=', 'data:image/png;base64,iVBORw0KGgo='],
    ['data:image/jpeg;base64,/9j/4AAQ', 'data:image/jpeg;base64,/9j/4AAQ'],
    ['data:image/jpg;base64,AA==', 'data:image/jpg;base64,AA=='],
    ['data:image/gif;base64,R0lG', 'data:image/gif;base64,R0lG'],
    ['data:image/webp;base64,UklG', 'data:image/webp;base64,UklG'],
];

function checkRules(fn, label) {
    REJECT.forEach(function(v) { assert.strictEqual(fn(v), '', label + ' ' + JSON.stringify(v)); });
    ALLOW.forEach(function(p) { assert.strictEqual(fn(p[0]), p[1], label + ' ' + JSON.stringify(p[0])); });
}

test('utils url check: only the listed forms pass', function() {
    const s = ctx();
    runUtilsUrl(s);
    checkRules(s.sanitizeUrl, 'utils');
});

test('utils url check returns the raw url and callers escape once', function() {
    const s = ctx();
    runUtilsUrl(s);
    const out = s.sanitizeUrl('https://a.example/?a=1&b="2"');
    assert.strictEqual(out, 'https://a.example/?a=1&b="2"');
    assert.strictEqual(esc(out), 'https://a.example/?a=1&amp;b=&quot;2&quot;');
});

test('nacho-qa alone fills in the url check with the same rules', function() {
    const s = ctx();
    s.escapeHtml = esc;
    runNacho(s);
    assert.strictEqual(typeof s.sanitizeUrl, 'function');
    checkRules(s.sanitizeUrl, 'nacho-qa');
    assert.strictEqual(esc(s.sanitizeUrl('https://a.example/?a=1&b=2')), 'https://a.example/?a=1&amp;b=2');
});

test('utils then nacho-qa: the shared url check stays in place', function() {
    const s = ctx();
    s.escapeHtml = esc;
    runUtilsUrl(s);
    const shared = s.sanitizeUrl;
    runNacho(s);
    assert.strictEqual(s.sanitizeUrl, shared);
    assert.ok(!/function\s+sanitizeUrl\s*\(/.test(NQA));
    assert.ok(!/window\.sanitizeUrl\s*=/.test(NQA));
});

test('nacho-qa link markup escapes the url once', function() {
    const n = (NQA.match(/escapeHtml\(sanitizeUrl\(results\[ri\]\.url\)\)/g) || []).length;
    assert.strictEqual(n, 2);
    const block = H.sliceBetween(NQA, "if (typeof sanitizeUrl !== 'function') {", '\n}\n');
    assert.ok(!/escapeHtml/.test(block));
});

test('forum markdown links and images escape the url exactly once', function() {
    const s = ctx();
    s.escapeHtml = esc;
    s.forumRenderMentions = function(h) { return h; };
    runUtilsUrl(s);
    vm.runInContext(H.sliceFunction(FORUM, 'function fEsc(str) {'), s);
    vm.runInContext(H.sliceFunction(FORUM, 'function mdUnEsc(s) {'), s);
    vm.runInContext(H.sliceFunction(FORUM, 'function mdToHtml(md) {'), s);
    const a = s.mdToHtml('[go](https://a.example/?a=1&b=2)');
    assert.ok(a.indexOf('href="https://a.example/?a=1&amp;b=2"') !== -1, a);
    assert.ok(a.indexOf('&amp;amp;') === -1, a);
    const i = s.mdToHtml('![pic](https://a.example/p.png?a=1&b=2)');
    assert.ok(i.indexOf('src="https://a.example/p.png?a=1&amp;b=2"') !== -1, i);
    const q = s.mdToHtml('[go](https://a.example/"onmouseover="x)');
    assert.ok(q.indexOf('"onmouseover="') === -1, q);
    assert.strictEqual(s.mdToHtml('[go](//evil.host/x)').indexOf('<a '), -1);
});

test('forum post link text is shortened before it is escaped', function() {
    assert.ok(FORUM.indexOf("fEsc(safeLink.substring(0, 60))") !== -1);
    assert.ok(FORUM.indexOf("fEsc(safeLink).substring(0, 60)") === -1);
});

test('messaging image and avatar markup escape the checked url', function() {
    assert.ok(MSG.indexOf("'<img src=\"' + escapeHtml(sanitizeUrl(m.imageUrl)) + '\"") !== -1);
    assert.ok(MSG.indexOf("'<img src=\"' + sanitizeUrl(") === -1);
    assert.ok(MSG.indexOf("'<img src=\"' + escapeHtml(_safePickUrl) + '\" ' +") !== -1);
    assert.ok(MSG.indexOf("sanitizeUrl(_picUrl) : _picUrl") === -1);
    assert.ok(MSG.indexOf('_isDataImg ? _safePickUrl') === -1);
});

test('ranking profile picture markup escapes the checked url', function() {
    assert.strictEqual((RANK.match(/'<img src="' \+ escapeHtml\(sanitizeUrl\(_pfpUrl\)\) \+ '"/g) || []).length, 2);
    assert.ok(RANK.indexOf('? _pfpUrl : escapeHtml') === -1);
});

test('ranking.js keeps the shared escapeHtml when it is already loaded', function() {
    assert.ok(!/function\s+escapeHtml\s*\(/.test(RANK));
    const block = H.sliceBetween(RANK, "if (typeof escapeHtml !== 'function') {", '\n}\n');
    const s = ctx();
    const shared = function shared(x) { return 'S' + x; };
    s.escapeHtml = shared;
    vm.runInContext(block, s);
    assert.strictEqual(s.escapeHtml, shared);
    const solo = ctx();
    vm.runInContext(block, solo);
    assert.strictEqual(solo.escapeHtml('<a href="x">\'&</a>'), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&lt;/a&gt;');
    assert.strictEqual(solo.escapeHtml(null), '');
});

test('tip text trimming keeps whole characters', function() {
    const s = ctx();
    vm.runInContext(H.sliceFunction(TIPS, 'function tipText(v, max) {'), s);
    assert.strictEqual(s.tipText('ab\uD83D\uDE00', 3), 'ab');
    assert.strictEqual(s.tipText('ab\uD83D\uDE00', 4), 'ab\uD83D\uDE00');
    assert.strictEqual(s.tipText('abc', 2), 'ab');
    assert.strictEqual(s.tipText(5, 2), '');
});

run();
