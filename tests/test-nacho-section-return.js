#!/usr/bin/env node
// A returning player (visits = 9, tour already seen) still sends the topic
// and the paragraph anchor. The greeting bubble clears that session, and
// the section opener has to put it back before the request.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function unrefTimer(fn) {
    return function() {
        const timer = fn.apply(null, arguments);
        if (timer && typeof timer.unref === 'function') timer.unref();
        return timer;
    };
}

function makeClassList(el) {
    const names = new Set();
    return {
        add: function() {
            for (let i = 0; i < arguments.length; i++) if (arguments[i]) names.add(arguments[i]);
            el.className = Array.from(names).join(' ');
        },
        remove: function() {
            for (let i = 0; i < arguments.length; i++) names.delete(arguments[i]);
            el.className = Array.from(names).join(' ');
        },
        contains: function(name) { return names.has(name); },
        toggle: function(name) {
            if (names.has(name)) names.delete(name);
            else names.add(name);
            el.className = Array.from(names).join(' ');
        },
    };
}

function makeEl(tag) {
    const el = {
        nodeType: 1,
        tagName: String(tag || 'DIV').toUpperCase(),
        id: '',
        className: '',
        childNodes: [],
        children: [],
        parentNode: null,
        attributes: {},
        style: {},
        textContent: '',
        innerHTML: '',
    };
    el.classList = makeClassList(el);
    el.style.cssText = '';
    el.setAttribute = function(name, value) {
        const key = String(name).toLowerCase();
        el.attributes[key] = String(value);
        if (key === 'id') el.id = String(value);
        if (key === 'class') {
            el.className = String(value);
            el.classList = makeClassList(el);
            String(value).split(/\s+/).forEach(function(part) { if (part) el.classList.add(part); });
        }
        if (key === 'style') el.style.cssText = String(value);
    };
    el.getAttribute = function(name) {
        const key = String(name).toLowerCase();
        return Object.prototype.hasOwnProperty.call(el.attributes, key) ? el.attributes[key] : null;
    };
    el.removeAttribute = function(name) { delete el.attributes[String(name).toLowerCase()]; };
    el.addEventListener = function() {};
    el.removeEventListener = function() {};
    el.contains = function(node) {
        let current = node;
        while (current) {
            if (current === el) return true;
            current = current.parentNode;
        }
        return false;
    };
    el.appendChild = function(child) {
        if (child.parentNode && child.parentNode.removeChild) child.parentNode.removeChild(child);
        child.parentNode = el;
        el.childNodes.push(child);
        if (child.nodeType === 1) el.children.push(child);
        return child;
    };
    el.removeChild = function(child) {
        el.childNodes = el.childNodes.filter(function(node) { return node !== child; });
        el.children = el.children.filter(function(node) { return node !== child; });
        child.parentNode = null;
        return child;
    };
    el.querySelector = function(sel) {
        const all = el.querySelectorAll(sel);
        return all[0] || null;
    };
    el.querySelectorAll = function(sel) {
        const out = [];
        el.childNodes.forEach(function(node) {
            if (node.nodeType !== 1) return;
            if (matches(node, sel)) out.push(node);
            node.querySelectorAll(sel).forEach(function(found) { out.push(found); });
        });
        return out;
    };
    Object.defineProperty(el, 'firstChild', {
        get: function() { return el.childNodes[0] || null; },
    });
    Object.defineProperty(el, 'textContent', {
        get: function() {
            if (!el.childNodes.length) return el._text || '';
            return el.childNodes.map(function(node) { return node.textContent || ''; }).join('');
        },
        set: function(value) {
            el.childNodes = [];
            el.children = [];
            el._text = String(value == null ? '' : value);
            if (el._text) el.appendChild({ nodeType: 3, textContent: el._text, parentNode: el });
        },
    });
    Object.defineProperty(el, 'innerHTML', {
        get: function() { return el._html || ''; },
        set: function(value) {
            el._html = String(value == null ? '' : value);
            el.childNodes = [];
            el.children = [];
            parseInto(el, el._html);
        },
    });
    return el;
}

function matches(el, sel) {
    if (sel.charAt(0) === '#') return el.id === sel.slice(1);
    if (sel.charAt(0) === '.') return el.classList.contains(sel.slice(1));
    return el.tagName === String(sel).toUpperCase();
}

function appendText(parent, text) {
    if (!text) return;
    parent.appendChild({ nodeType: 3, textContent: text, parentNode: parent });
}

function applyAttrs(el, src) {
    const re = /([:@\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"']+)))?/g;
    let match;
    while ((match = re.exec(src))) {
        const val = match[2] != null ? match[2] : match[3] != null ? match[3] : match[4] != null ? match[4] : '';
        el.setAttribute(match[1], val);
    }
}

function parseInto(parent, html) {
    const stack = [parent];
    const s = String(html || '');
    let i = 0;
    while (i < s.length) {
        if (s.charAt(i) !== '<') {
            let j = s.indexOf('<', i);
            if (j < 0) j = s.length;
            appendText(stack[stack.length - 1], s.slice(i, j));
            i = j;
            continue;
        }
        if (s.slice(i, i + 4) === '<!--') {
            const end = s.indexOf('-->', i);
            i = end < 0 ? s.length : end + 3;
            continue;
        }
        const close = s.indexOf('>', i);
        if (close < 0) break;
        const raw = s.slice(i + 1, close).trim();
        i = close + 1;
        if (raw.charAt(0) === '/') {
            const name = raw.slice(1).split(/\s/)[0].toUpperCase();
            if (stack.length > 1 && stack[stack.length - 1].tagName === name) stack.pop();
            else if (stack.length > 1) stack.pop();
            continue;
        }
        const self = /\/$/.test(raw);
        const body = self ? raw.slice(0, -1).trim() : raw;
        const tagMatch = /^([a-zA-Z][\w:-]*)([\s\S]*)$/.exec(body);
        if (!tagMatch) continue;
        const el = makeEl(tagMatch[1]);
        applyAttrs(el, tagMatch[2] || '');
        stack[stack.length - 1].appendChild(el);
        const voidTag = /^(IMG|BR|HR|INPUT|META|LINK|SOURCE|WBR)$/.test(el.tagName);
        if (!self && !voidTag) stack.push(el);
    }
}

function findId(el, id) {
    if (!el || el.nodeType !== 1) return null;
    if (el.id === id) return el;
    const nodes = el.childNodes || [];
    for (let i = 0; i < nodes.length; i++) {
        const found = findId(nodes[i], id);
        if (found) return found;
    }
    return null;
}

const calls = [];
const store = {
    btc_nacho_tour_shown: 'true',
};
const documentEl = makeEl('html');
const head = makeEl('head');
const body = makeEl('body');
documentEl.appendChild(head);
documentEl.appendChild(body);

const document = {
    readyState: 'complete',
    head: head,
    body: body,
    documentElement: documentEl,
    activeElement: null,
    createElement: function(tag) { return makeEl(tag); },
    getElementById: function(id) { return findId(documentEl, id); },
    querySelector: function(sel) {
        const all = document.querySelectorAll(sel);
        return all[0] || null;
    },
    querySelectorAll: function(sel) { return documentEl.querySelectorAll(sel); },
    addEventListener: function() {},
    removeEventListener: function() {},
};

const sandbox = {
    console: console,
    setTimeout: unrefTimer(setTimeout),
    clearTimeout: clearTimeout,
    setInterval: unrefTimer(setInterval),
    clearInterval: clearInterval,
    requestAnimationFrame: unrefTimer(function(fn) { return setTimeout(fn, 16); }),
    cancelAnimationFrame: clearTimeout,
    Date: Date,
    Math: Math,
    JSON: JSON,
    Promise: Promise,
    Set: Set,
    Map: Map,
    Array: Array,
    Object: Object,
    String: String,
    Number: Number,
    RegExp: RegExp,
    Error: Error,
    parseInt: parseInt,
    parseFloat: parseFloat,
    isNaN: isNaN,
    Uint32Array: Uint32Array,
    Uint8Array: Uint8Array,
    ArrayBuffer: ArrayBuffer,
    DataView: DataView,
    currentUser: { totalVisits: 9, channelsVisited: 4, username: 'Ada' },
    document: document,
    location: { hash: '', pathname: '/', href: 'https://example.test/' },
    localStorage: {
        getItem: function(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
        setItem: function(key, value) { store[key] = String(value); },
        removeItem: function(key) { delete store[key]; },
    },
    firebase: {
        functions: function() {
            return {
                httpsCallable: function(name) {
                    return function(payload) {
                        calls.push({ name: name, payload: payload });
                        return Promise.resolve({ data: { answer: 'Miners pack transactions into a block.', links: [], followUps: [] } });
                    };
                },
            };
        },
    },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
sandbox.addEventListener = function() {};
sandbox.removeEventListener = function() {};
vm.createContext(sandbox);

const root = path.join(__dirname, '..');
vm.runInContext(fs.readFileSync(path.join(root, 'nacho.js'), 'utf8'), sandbox, { filename: 'nacho.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'nacho-qa.js'), 'utf8'), sandbox, { filename: 'nacho-qa.js' });

assert.ok(sandbox.document.getElementById('nacho-bubble'), 'greeting needs a real bubble or the clear never runs');
assert.ok(sandbox.document.getElementById('nacho-text'), 'greeting needs the bubble text');

sandbox.window._nachoSectionSession = { channelId: 'temp', anchorIndex: 0, anchorHash: 'aaaaaaaa' };
sandbox.window.showNacho();
assert.strictEqual(sandbox.window._nachoSectionSession, null, 'the returning-player greeting clears the section');

calls.length = 0;
sandbox.window.nachoAskSection({
    channelId: 'mining',
    anchorIndex: 3,
    anchorHash: 'ab12cd34',
    conversationId: 'conv9',
});

assert.strictEqual(calls.length, 1);
assert.strictEqual(calls[0].name, 'askNachoAboutSection');
assert.strictEqual(calls[0].payload.channelId, 'mining');
assert.strictEqual(calls[0].payload.anchorIndex, 3);
assert.strictEqual(calls[0].payload.anchorHash, 'ab12cd34');
assert.strictEqual(calls[0].payload.conversationId, 'conv9');
assert.strictEqual(sandbox.window._nachoSectionSession.channelId, 'mining');
assert.strictEqual(sandbox.window._nachoSectionSession.anchorHash, 'ab12cd34');

calls.length = 0;
sandbox.currentUser.totalVisits = 1;
sandbox.window.nachoAskSection({
    channelId: 'fees',
    anchorIndex: 1,
    anchorHash: 'ff00aa11',
});
assert.strictEqual(calls.length, 1, 'tour seen still opens the section');
assert.strictEqual(calls[0].payload.channelId, 'fees');
assert.strictEqual(calls[0].payload.anchorIndex, 1);
assert.strictEqual(calls[0].payload.anchorHash, 'ff00aa11');

console.log('returning player section request carries topic and anchor');
