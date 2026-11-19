// Shared helpers for markup tests: a tiny start-tag reader, a function
// slicer for big client files, a fake element and a small test runner.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

const TAG_RE = /<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s=>\/"']+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g;
const ATTR_RE = /([^\s=>\/"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
function decode(v) {
    return v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
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
            attrs[a[1].toLowerCase()] = decode(v);
        }
        tags.push({ name: m[1].toLowerCase(), attrs: attrs });
    }
    return tags;
}
function leftoverMarkup(html) {
    return html.replace(TAG_RE, '').replace(/<\/[a-zA-Z][a-zA-Z0-9]*\s*>/g, '');
}
// Every handler attribute, decoded the way a browser would before running it.
function handlerTexts(html) {
    const out = [];
    readTags(html).forEach(function(t) {
        Object.keys(t.attrs).forEach(function(k) { if (/^on/.test(k)) out.push(t.attrs[k]); });
    });
    return out;
}
// Unknown attribute names are a sign that a value escaped its quotes.
function strayAttrs(html, allowed) {
    const bad = [];
    readTags(html).forEach(function(t) {
        Object.keys(t.attrs).forEach(function(k) { if (allowed.indexOf(k) === -1 && !/^data-/.test(k)) bad.push(t.name + ' ' + k); });
    });
    return bad;
}

// Return the source of `function name(...) {...}` or `window.name = function(...) {...}`.
function sliceFunction(src, header) {
    const start = src.indexOf(header);
    if (start === -1) throw new Error('missing ' + header);
    const open = src.indexOf('{', start + header.length - 1);
    let depth = 0, i = open, q = null, esc = false, line = false, block = false, re = false;
    for (; i < src.length; i++) {
        const c = src[i], n = src[i + 1];
        if (line) { if (c === '\n') line = false; continue; }
        if (block) { if (c === '*' && n === '/') { block = false; i++; } continue; }
        if (q) {
            if (esc) { esc = false; continue; }
            if (c === '\\') { esc = true; continue; }
            if (c === q) q = null;
            continue;
        }
        if (re) {
            if (esc) { esc = false; continue; }
            if (c === '\\') { esc = true; continue; }
            if (c === '[') { re = '['; continue; }
            if (re === '[' && c === ']') { re = true; continue; }
            if (re === true && c === '/') re = false;
            continue;
        }
        if (c === '/' && n === '/') { line = true; continue; }
        if (c === '/' && n === '*') { block = true; continue; }
        if (c === '"' || c === "'" || c === '`') { q = c; continue; }
        if (c === '/') {
            let j = i - 1;
            while (j >= 0 && /\s/.test(src[j])) j--;
            if (j < 0 || /[(,=:[!&|?{};+\-*%<>~^]/.test(src[j])) { re = true; continue; }
        }
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) break; }
    }
    let end = i + 1;
    if (src[end] === ';') end++;
    return src.slice(start, end);
}
function sliceBetween(src, from, to) {
    const a = src.indexOf(from);
    const b = src.indexOf(to, a);
    if (a === -1 || b === -1) throw new Error('missing block ' + from);
    return src.slice(a, b + to.length);
}

function makeEl(id) {
    const el = {
        id: id || '', innerHTML: '', style: {}, dataset: {}, scrollTop: 0, scrollHeight: 0, clientHeight: 0,
        listeners: {}, attrs: {}, children: [], parentElement: null,
        addEventListener: function(type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
        removeEventListener: function() {},
        setAttribute: function(k, v) { el.attrs[k] = String(v); },
        getAttribute: function(k) { return Object.prototype.hasOwnProperty.call(el.attrs, k) ? el.attrs[k] : null; },
        contains: function() { return true; },
        appendChild: function(c) { el.children.push(c); return c; },
        insertBefore: function(c) { el.children.push(c); return c; },
        remove: function() {},
        querySelector: function() { return null; },
        querySelectorAll: function() { return []; },
        getBoundingClientRect: function() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
        focus: function() {},
    };
    return el;
}
// A clicked element built from parsed attributes; closest() matches itself.
function elFrom(attrs) {
    return {
        getAttribute: function(k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
        closest: function(sel) {
            const m = /^\[([a-z-]+)\]$/.exec(sel);
            if (m && Object.prototype.hasOwnProperty.call(attrs, m[1])) return this;
            // attrs.__inside names the id of a container this element sits in.
            if (sel.indexOf('#') !== -1 && typeof attrs.__inside === 'string' && sel.split(',').indexOf('#' + attrs.__inside) !== -1) return { id: attrs.__inside };
            return null;
        },
        dataset: {},
        style: {},
    };
}
function click(container, attrs, type) {
    const list = (container.listeners[type || 'click'] || []);
    const ev = { target: elFrom(attrs), stopPropagation: function() {}, preventDefault: function() {} };
    list.forEach(function(fn) { fn.call(container, ev); });
}

function runner() {
    let passed = 0, failed = 0;
    const queue = [];
    return {
        test: function(name, fn) {
            queue.push(async function() {
                try { await fn(); console.log('✅ ' + name); passed++; }
                catch (e) { console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e)); failed++; }
            });
        },
        run: async function() {
            for (const t of queue) await t();
            console.log(passed + ' passed, ' + failed + ' failed');
            if (failed) process.exitCode = 1;
        },
    };
}

const ODD_IDS = [
    "x' onerror='MARKQ1",
    '"><img src=x onerror=MARKQ2>',
    "a');MARKQ3();//",
    '<svg/onload=MARKQ4>',
    'MARKQ5 with space',
    'MARKQ6' + 'a'.repeat(123),
    "a&#39;);MARKQ8();//",
];
const ODD_NAMES = [
    "Bob&#39;);MARKQ9();//",
    '"><img src=x onerror=MARKQ10>',
    "x\\');MARKQ11();//",
];
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

module.exports = {
    read, readTags, leftoverMarkup, handlerTexts, strayAttrs, sliceFunction, sliceBetween,
    makeEl, elFrom, click, runner, ODD_IDS, ODD_NAMES, ID_RE,
};
