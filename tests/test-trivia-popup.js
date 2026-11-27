#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

function test(name, fn) {
    return Promise.resolve().then(fn).then(function() {
        console.log('✅ ' + name);
    }).catch(function(err) {
        console.log('❌ ' + name + ': ' + (err && err.stack || err));
        throw err;
    });
}

const tests = [];
function add(name, fn) { tests.push(test(name, fn)); }

add('index.html and 404.html match, and pins are v2737', function() {
    const index = read('index.html');
    assert.strictEqual(index, read('404.html'));
    const sw = read('sw.js');
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2737'"));
    assert.ok(index.includes('bundle.min.js?v=20261127_v2737'));
    assert.strictEqual((index.match(/bundle\.min\.js\?v=20261127_v2737/g) || []).length, 2);
});

add('the trivia bubble can expand and answer buttons are tappable', function() {
    const css = read('nacho.js');
    const js = read('nacho-engage.js');
    assert.ok(css.includes('#nacho-bubble[data-trivia="1"]'));
    assert.ok(css.includes('pointer-events: auto'));
    assert.ok(css.includes('trivia-expanded'));
    assert.ok(css.includes('min-height: 44px'));
    assert.ok(js.includes("id=\"nachoTriviaOptions\"") || js.includes("id='nachoTriviaOptions'") || js.includes("id=\"nachoTriviaOptions\"") || js.includes("nachoTriviaOptions"));
    assert.ok(js.includes('expandNachoTrivia'));
    assert.ok(js.includes('Show all answers'));
    assert.ok(js.includes('data-trivia-opt'));
    assert.ok(js.includes('escapeHtml') || js.includes("replace(/&/g, '&amp;')"));
    assert.ok(js.includes('button[data-trivia-opt]'));
});

add('options are escaped, and expand reveals every answer', function() {
    const src = read('nacho-engage.js');
    const start = src.indexOf('function renderNachoTrivia');
    const end = src.indexOf('window.showNachoTrivia');
    const expandEnd = src.indexOf('window.showNachoTrivia = function');
    assert.ok(start > 0 && expandEnd > start);
    const chunk = src.slice(start, expandEnd);
    const buttons = [];
    const el = function(tag, attrs) {
        const node = {
            tag: tag,
            attrs: attrs || {},
            children: [],
            hidden: false,
            className: (attrs && attrs.class) || '',
            style: {},
            classList: {
                _n: this,
                add: function(c) { node.className += ' ' + c; },
                remove: function(c) { node.className = node.className.replace(c, ''); },
                contains: function(c) { return node.className.indexOf(c) !== -1; }
            },
            setAttribute: function(k, v) { node.attrs[k] = v; },
            getAttribute: function(k) { return node.attrs[k]; },
            appendChild: function(c) { node.children.push(c); },
            querySelectorAll: function(sel) {
                if (sel.indexOf('button') !== -1) return buttons.slice();
                return [];
            }
        };
        node.classList._n = node;
        return node;
    };
    const bubble = el('div', {});
    bubble.classList = {
        add: function(c) { bubble.className = (bubble.className || '') + ' ' + c; },
        remove: function(c) { bubble.className = String(bubble.className || '').replace(c, ''); },
        contains: function(c) { return String(bubble.className || '').indexOf(c) !== -1; }
    };
    const textEl = { innerHTML: '' };
    const doc = {
        getElementById: function(id) {
            if (id === 'nacho-bubble') return bubble;
            if (id === 'nacho-text') return textEl;
            if (id === 'nachoTriviaOptions') return {
                classList: { add: function(c) { doc._optsClass = c; } }
            };
            if (id === 'nachoTriviaExpand') return { classList: { remove: function() {} }, hidden: false };
            return null;
        }
    };
    const sandbox = {
        window: {},
        document: doc,
        escapeHtml: function(s) {
            return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        },
        setPose: function() {},
        clearNachoBubbleTimeout: function() {},
        console: console
    };
    sandbox.window = sandbox;
    vm.runInNewContext(chunk + '\nthis.renderNachoTrivia = renderNachoTrivia;\n', sandbox);
    const ok = sandbox.renderNachoTrivia({
        q: 'Who said <b>hello</b>?',
        options: ['<script>x</script>', 'Satoshi', 'Alice', 'Eve'],
        correct: 1,
        pts: 10
    });
    assert.strictEqual(ok, true);
    assert.ok(textEl.innerHTML.indexOf('<script>') === -1);
    assert.ok(textEl.innerHTML.indexOf('&lt;script&gt;') !== -1);
    assert.ok(textEl.innerHTML.indexOf('&lt;b&gt;hello&lt;/b&gt;') !== -1);
    assert.ok(textEl.innerHTML.indexOf('nachoTriviaOptions') !== -1);
    assert.ok(textEl.innerHTML.indexOf('Show all answers') !== -1);
    assert.ok(typeof sandbox.window.expandNachoTrivia === 'function' || typeof sandbox.expandNachoTrivia === 'function');
    const expand = sandbox.window.expandNachoTrivia || sandbox.expandNachoTrivia;
    expand();
    assert.ok(String(bubble.className).indexOf('trivia-expanded') !== -1);
    assert.strictEqual(doc._optsClass, 'is-expanded');
});

Promise.all(tests).then(function(rows) {
    console.log('---\nPassed: ' + rows.length + '  Failed: 0');
}).catch(function() { process.exit(1); });
