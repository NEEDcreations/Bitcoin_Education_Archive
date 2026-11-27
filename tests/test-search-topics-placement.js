#!/usr/bin/env node
// Search all topics sits just above the topics list, below Hot Topics and
// the Citadel Wire link, not under the LIVE ticker. Ids and behavior stay.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

const html = read('index.html');
const notFound = read('404.html');
const sw = read('sw.js');
const hot = read('hot-topics.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e)); failed++; }
}

function idAt(src, id) {
    return src.indexOf('id="' + id + '"');
}

test('index.html and 404.html stay identical, with SW v2744 and the new pin', function () {
    assert.strictEqual(html, notFound);
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2744'"));
    assert.ok(html.includes('hot-topics.js?v=20261128_v2744'));
    assert.ok(!html.includes('hot-topics.js?v=20261114_citadelwire3'));
});

test('the live ticker stays in the search-box area, and Search all topics stays above the topics list', function () {
    const tick = idAt(html, 'activity-ticker');
    const box = html.indexOf('<div class="search-box">');
    const boxEnd = html.indexOf('</div>', html.indexOf('id="searchInput"'));
    const input = idAt(html, 'searchInput');
    const results = idAt(html, 'sidebarSearchResults');
    const list = idAt(html, 'channelList');
    assert.ok(tick > 0 && box > 0);
    assert.strictEqual((html.match(/id="activity-ticker"/g) || []).length, 1, 'one ticker');
    // Friday placed the live ticker in the search-box area; do not treat that as a regression.
    assert.ok(tick > box, 'ticker is in the search-box area');
    assert.ok(input > box && input < boxEnd, 'search input stays in .search-box');
    assert.ok(box < results && results < list, 'results stay just above the topics list');
    assert.ok(html.includes('id="searchInput"'));
    assert.ok(html.includes('placeholder="🔍 Search all topics..."'));
    assert.ok(html.includes('oninput="doSearch(this.value)"'));
    assert.ok(html.includes('id="ticker-label"'));
    assert.ok(html.includes('id="ticker-content"'));
});

test('hot-topics.js prefers to inject the section before the search box', function () {
    assert.ok(hot.includes("getElementById('searchInput')"));
    assert.ok(hot.includes('searchBox.parentNode.insertBefore(wrapper, searchBox)'));
    assert.ok(hot.includes('channelList.insertBefore(wrapper, channelList.firstChild)'));
});

function el(tag, doc) {
    const node = {
        tagName: String(tag).toUpperCase(),
        id: '',
        className: '',
        children: [],
        parentNode: null,
        nodeType: 1,
        attrs: {},
        doc: doc,
        setAttribute: function (name, val) {
            this.attrs[name] = val;
            if (name === 'id') {
                this.id = val;
                if (doc) doc._byId[val] = this;
            }
            if (name === 'class') this.className = val;
        },
        getAttribute: function (name) { return this.attrs[name]; },
        appendChild: function (child) {
            if (child.parentNode) child.parentNode.removeChild(child);
            child.parentNode = this;
            this.children.push(child);
            if (child.id && doc) doc._byId[child.id] = child;
            return child;
        },
        removeChild: function (child) {
            const i = this.children.indexOf(child);
            if (i >= 0) { this.children.splice(i, 1); child.parentNode = null; }
            return child;
        },
        insertBefore: function (child, ref) {
            if (child.parentNode) child.parentNode.removeChild(child);
            child.parentNode = this;
            const i = ref ? this.children.indexOf(ref) : -1;
            if (i >= 0) this.children.splice(i, 0, child);
            else this.children.push(child);
            if (child.id && doc) doc._byId[child.id] = child;
            return child;
        },
        addEventListener: function () {},
        querySelector: function () { return null; },
        insertAdjacentElement: function (pos, child) {
            if (pos !== 'afterend' || !this.parentNode) throw new Error('unsupported ' + pos);
            const parent = this.parentNode;
            const i = parent.children.indexOf(this);
            if (child.parentNode) child.parentNode.removeChild(child);
            child.parentNode = parent;
            parent.children.splice(i + 1, 0, child);
            if (child.id && doc) doc._byId[child.id] = child;
            return child;
        },
        get firstChild() { return this.children[0] || null; },
        get previousSibling() {
            if (!this.parentNode) return null;
            const i = this.parentNode.children.indexOf(this);
            return i > 0 ? this.parentNode.children[i - 1] : null;
        }
    };
    Object.defineProperty(node, 'innerHTML', {
        get: function () { return this._html || ''; },
        set: function (html) {
            this._html = String(html || '');
            const re = /id="([^"]+)"/g;
            let m;
            while ((m = re.exec(this._html))) {
                if (doc && !doc._byId[m[1]]) {
                    const child = el('div', doc);
                    child.setAttribute('id', m[1]);
                    node.appendChild(child);
                } else if (doc && doc._byId[m[1]]) {
                    const child = doc._byId[m[1]];
                    if (!child.parentNode) node.appendChild(child);
                }
            }
        }
    });
    return node;
}

function loadHotTopics() {
    const doc = { _byId: {}, readyState: 'complete', addEventListener: function () {} };
    const body = el('div', doc);
    const ticker = el('div', doc);
    ticker.setAttribute('id', 'activity-ticker');
    const searchBox = el('div', doc);
    searchBox.setAttribute('class', 'search-box');
    searchBox.className = 'search-box';
    const input = el('input', doc);
    input.setAttribute('id', 'searchInput');
    searchBox.appendChild(input);
    const results = el('div', doc);
    results.setAttribute('id', 'sidebarSearchResults');
    const channelList = el('div', doc);
    channelList.setAttribute('id', 'channelList');
    const topic = el('div', doc);
    topic.setAttribute('id', 'some-topic');
    channelList.appendChild(topic);
    body.appendChild(ticker);
    body.appendChild(searchBox);
    body.appendChild(results);
    body.appendChild(channelList);
    doc.body = body;
    doc.head = el('head', doc);
    doc.documentElement = el('html', doc);
    doc.getElementById = function (id) { return doc._byId[id] || null; };
    doc.createElement = function (tag) { return el(tag, doc); };
    const windowObj = {
        document: doc,
        addEventListener: function () {},
        localStorage: { getItem: function () { return null; }, setItem: function () {} }
    };
    function noop() { return 0; }
    vm.runInNewContext(hot, {
        window: windowObj,
        document: doc,
        localStorage: windowObj.localStorage,
        console: { log: function () {}, warn: function () {}, error: function () {} },
        setTimeout: noop,
        clearTimeout: noop,
        setInterval: noop,
        clearInterval: noop,
        module: undefined,
        exports: undefined,
        require: undefined
    });
    return { body: body, ticker: ticker, searchBox: searchBox, results: results, channelList: channelList, doc: doc, topic: topic };
}

test('after inject, order is ticker, Hot Topics, Citadel Wire, search, topics list', function () {
    const page = loadHotTopics();
    const kids = page.body.children.map(function (n) { return n.id || n.className; });
    assert.deepStrictEqual(kids, [
        'activity-ticker',
        'hotTopicsSectionWrapper',
        'citadelWirePanel',
        'search-box',
        'sidebarSearchResults',
        'channelList'
    ]);
    assert.strictEqual(page.searchBox.previousSibling.id, 'citadelWirePanel');
    const wrap = page.doc.getElementById('hotTopicsSectionWrapper');
    const citadel = page.doc.getElementById('citadelWirePanel');
    assert.ok(wrap && citadel);
    assert.strictEqual(citadel.previousSibling, wrap);
    assert.strictEqual(page.topic.parentNode, page.channelList);
    assert.ok(page.channelList.children.indexOf(wrap) < 0, 'hot topics is not inside the topics list');
    assert.strictEqual(page.doc.getElementById('searchInput').parentNode, page.searchBox);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
