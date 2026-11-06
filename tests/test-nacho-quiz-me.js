#!/usr/bin/env node
// Nacho Mode Quiz Me must render a question. scholar.js dropped the shared
// fisherYates helper, and nachoQuizMe used to throw ReferenceError before
// any question was shown.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const shuffleCall = 'fisher' + 'Yates(';

function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

function walk(dir, out) {
    fs.readdirSync(dir).forEach(function (name) {
        if (name === 'node_modules' || name === '.git') return;
        var full = path.join(dir, name);
        var stat = fs.statSync(full);
        if (stat.isDirectory()) walk(full, out);
        else out.push(full);
    });
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    }
}

function makeDocument() {
    function encodeText(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
    function serialize(node) {
        if (!node) return '';
        if (node.nodeType === 3) return encodeText(node.nodeValue);
        if (node._html != null && (!node.childNodes || node.childNodes.length === 0)) return node._html;
        return (node.childNodes || []).map(serialize).join('');
    }
    function createElement(tag) {
        var el = {
            nodeType: 1,
            tagName: String(tag || 'div').toUpperCase(),
            id: '',
            className: '',
            childNodes: [],
            style: {},
            parentNode: null,
            _html: null,
            appendChild: function (child) {
                el.childNodes.push(child);
                if (child) child.parentNode = el;
                return child;
            },
            querySelector: function (sel) {
                if (typeof sel !== 'string' || sel.charAt(0) !== '#') return null;
                var id = sel.slice(1);
                var found = null;
                (function walkNode(node) {
                    if (!node || found) return;
                    if (node.id === id) { found = node; return; }
                    (node.childNodes || []).forEach(walkNode);
                })(el);
                return found;
            },
            scrollIntoView: function () {}
        };
        Object.defineProperty(el, 'innerHTML', {
            configurable: true,
            get: function () { return serialize(el); },
            set: function (value) {
                el.childNodes = [];
                el._html = value == null ? '' : String(value);
            }
        });
        return el;
    }
    var byId = {};
    var chat = createElement('div');
    chat.id = 'nachoModeChat';
    byId.nachoModeChat = chat;
    return {
        chat: chat,
        document: {
            createElement: createElement,
            createTextNode: function (value) {
                return { nodeType: 3, nodeValue: String(value == null ? '' : value), parentNode: null };
            },
            getElementById: function (id) { return byId[id] || null; },
            body: createElement('body')
        }
    };
}

function extractFunction(src, signature) {
    var at = src.indexOf(signature);
    if (at === -1) throw new Error('missing ' + signature);
    var open = src.indexOf('{', at);
    var depth = 0;
    var i = open;
    var quote = null;
    while (i < src.length) {
        var c = src[i];
        if (quote) {
            if (c === '\\') { i += 2; continue; }
            if (c === quote) quote = null;
            i++;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') { quote = c; i++; continue; }
        if (c === '{') depth++;
        else if (c === '}') {
            depth--;
            if (depth === 0) return src.slice(at, i + 1);
        }
        i++;
    }
    throw new Error('unbalanced ' + signature);
}

function loadQuiz() {
    var app = read('app.js');
    var start = app.indexOf('const GENERIC_NACHO_QUIZ');
    var end = app.indexOf('function offerConversationQuiz');
    assert.ok(start !== -1 && end > start, 'quiz slice markers missing');
    var slice = extractFunction(app, 'function nmTime(ts)') + '\n' + app.slice(start, end);
    assert.strictEqual(slice.includes(shuffleCall), false);
    assert.ok(slice.includes('function _nqShuffle'));
    assert.strictEqual((slice.match(/_nqShuffle\(/g) || []).length, 3);

    var dom = makeDocument();
    var sandbox = {
        console: console,
        Math: Object.create(Math),
        Date: Date,
        Object: Object,
        Array: Array,
        String: String,
        Number: Number,
        JSON: JSON,
        parseInt: parseInt,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        document: dom.document,
        QUESTION_BANK: {
            smoke: [{
                q: 'Which check shows Nacho Quiz Me rendered a question?',
                a: 'A question and its choices appear in the chat.',
                wrong: ['The chat stays blank.', 'Nacho closes the screen.']
            }]
        },
        _nachoMode: true,
        _nachoChatHistory: []
    };
    sandbox.Math.random = Math.random;
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.escapeHtml = function (str) {
        if (!str) return '';
        var div = sandbox.document.createElement('div');
        div.appendChild(sandbox.document.createTextNode(str));
        return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    };
    vm.createContext(sandbox);
    vm.runInContext(slice + '\nthis._nqShuffle = _nqShuffle;', sandbox, { filename: 'nacho-quiz-me.js' });
    return { sandbox: sandbox, dom: dom };
}

test('quiz source no longer calls the deleted shuffle helper', function () {
    var allowed = {
        [path.join(root, 'functions', 'src', 'nachoRadio.js')]: true,
        [path.join(root, 'tools', 'tctv-import', 'shuffle_tctv_stations.js')]: true,
        [path.join(root, 'tests', 'test-nacho-radio.js')]: true,
        [path.join(root, 'tests', 'test-nacho-quiz-me.js')]: true
    };
    var files = [];
    walk(root, files);
    var hits = [];
    files.forEach(function (file) {
        if (allowed[file]) return;
        if (!/\.(js|mjs|cjs|html)$/.test(file)) return;
        var text = fs.readFileSync(file, 'utf8');
        if (text.includes(shuffleCall)) hits.push(path.relative(root, file));
    });
    assert.deepStrictEqual(hits, []);
    var app = read('app.js');
    var quizAt = app.indexOf('window.nachoQuizMe = function');
    var helperAt = app.lastIndexOf('function _nqShuffle', quizAt);
    assert.ok(helperAt !== -1 && quizAt - helperAt < 600, 'helper must sit just above nachoQuizMe');
});

test('_nqShuffle returns a new permutation and leaves the input alone', function () {
    var loaded = loadQuiz();
    var src = ['one', 'two', 'three', 'four', 'five'];
    var snapshot = src.slice();
    var rolls = [0.9, 0.1, 0.6, 0.2];
    var n = 0;
    loaded.sandbox.Math.random = function () { return rolls[n++] == null ? 0 : rolls[n - 1]; };
    var out = loaded.sandbox._nqShuffle(src);
    assert.notStrictEqual(out, src);
    assert.deepStrictEqual(src, snapshot);
    assert.deepStrictEqual(out.slice().sort(), snapshot.slice().sort());
    assert.ok(out.some(function (item, i) { return item !== snapshot[i]; }), 'expected a changed order');
});

test('nachoQuizMe renders a question while Nacho Mode is on', function () {
    var loaded = loadQuiz();
    loaded.sandbox.Math.random = function () { return 0; };
    loaded.sandbox._nachoMode = true;
    loaded.sandbox._nachoChatHistory = [];
    assert.strictEqual(typeof loaded.sandbox.nachoQuizMe, 'function');
    loaded.sandbox.nachoQuizMe();
    var html = loaded.dom.chat.innerHTML;
    assert.ok(loaded.dom.chat.childNodes.length >= 1, 'chat received no message');
    assert.ok(html.includes('Quiz Time!'), 'quiz heading missing');
    assert.ok(html.includes('Which check shows Nacho Quiz Me rendered a question?'), 'question text missing');
    assert.ok(html.includes('A question and its choices appear in the chat.'), 'answer choice missing');
    assert.ok(html.includes('The chat stays blank.'), 'wrong choice missing');
    assert.ok(html.includes('Nacho closes the screen.'), 'wrong choice missing');
    assert.ok(html.includes('<button'), 'choices were not rendered as buttons');
    assert.ok(html.includes('data-correct="1"'), 'correct choice was not marked');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
