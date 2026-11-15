// Citadel Wire panel: open/close toggle and sidebar fit. No network.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e));
        failed++;
    }
}

function el(tag, doc) {
    const node = {
        tagName: String(tag).toUpperCase(),
        id: '',
        className: '',
        attrs: {},
        style: {},
        children: [],
        parent: null,
        listeners: {},
        doc: doc,
        get classList() {
            const self = node;
            function set() {
                const s = new Set((self.className || '').split(/\s+/).filter(Boolean));
                return s;
            }
            function write(s) {
                self.className = [...s].join(' ');
                if (self.className) self.attrs.class = self.className;
                else delete self.attrs.class;
            }
            return {
                add: function(c) { const s = set(); s.add(c); write(s); },
                remove: function(c) { const s = set(); s.delete(c); write(s); },
                contains: function(c) { return set().has(c); }
            };
        },
        hasAttribute: function(n) { return Object.prototype.hasOwnProperty.call(this.attrs, n); },
        getAttribute: function(n) {
            if (!this.hasAttribute(n)) return null;
            const v = this.attrs[n];
            return v === true ? '' : String(v);
        },
        setAttribute: function(n, v) {
            this.attrs[n] = v === undefined || v === null ? '' : String(v);
            if (n === 'id') {
                this.id = this.attrs[n];
                if (this.doc) this.doc._byId[this.id] = this;
            }
            if (n === 'class') this.className = this.attrs[n];
        },
        removeAttribute: function(n) {
            delete this.attrs[n];
            if (n === 'class') this.className = '';
            if (n === 'id') this.id = '';
        },
        addEventListener: function(type, fn) {
            (this.listeners[type] || (this.listeners[type] = [])).push(fn);
        },
        querySelector: function(sel) {
            return this.querySelectorAll(sel)[0] || null;
        },
        querySelectorAll: function(sel) {
            const out = [];
            function walk(n) {
                if (matches(n, sel)) out.push(n);
                (n.children || []).forEach(walk);
            }
            (this.children || []).forEach(walk);
            return out;
        },
        insertAdjacentElement: function(pos, child) {
            if (pos === 'afterend') {
                const parent = this.parent;
                if (!parent) return child;
                const idx = parent.children.indexOf(this);
                parent.children.splice(idx + 1, 0, child);
                child.parent = parent;
                if (child.id && this.doc) this.doc._byId[child.id] = child;
                return child;
            }
            throw new Error('unsupported ' + pos);
        },
        appendChild: function(child) {
            this.children.push(child);
            child.parent = this;
            if (child.id && this.doc) this.doc._byId[child.id] = child;
            return child;
        },
        insertBefore: function(child, ref) {
            const i = ref ? this.children.indexOf(ref) : -1;
            if (i >= 0) this.children.splice(i, 0, child);
            else this.children.push(child);
            child.parent = this;
            if (child.id && this.doc) this.doc._byId[child.id] = child;
            return child;
        },
        click: function() {
            const ev = {
                type: 'click',
                preventDefault: function() {},
                stopPropagation: function() { this._stopped = true; },
                _stopped: false,
                target: node
            };
            const path = [];
            let n = node;
            while (n) { path.push(n); n = n.parent; }
            for (let i = 0; i < path.length; i++) {
                if (ev._stopped) break;
                const fns = path[i].listeners.click || [];
                for (let j = 0; j < fns.length; j++) fns[j](ev);
            }
            return ev;
        }
    };
    Object.defineProperty(node, 'innerHTML', {
        get: function() { return this._html || ''; },
        set: function(html) {
            this._html = html;
            this.children = [];
            parseHtml(html, this, doc);
        }
    });
    Object.defineProperty(node, 'firstChild', {
        get: function() { return this.children[0] || null; }
    });
    return node;
}

function matches(n, sel) {
    if (!n || !n.tagName) return false;
    if (sel.charAt(0) === '#') return n.id === sel.slice(1);
    if (sel.charAt(0) === '.') return n.classList.contains(sel.slice(1));
    const m = sel.match(/^([#.]?[\w-]+)\s+([#.]?[\w-]+)$/);
    if (m) {
        // only used as wrap.querySelector from panel
        return matches(n, m[2]);
    }
    const idm = sel.match(/^(\w+)?#([\w-]+)$/);
    if (idm) return (!idm[1] || n.tagName === idm[1].toUpperCase()) && n.id === idm[2];
    const cl = sel.match(/^(\w+)?\.([\w-]+)$/);
    if (cl) return (!cl[1] || n.tagName === cl[1].toUpperCase()) && n.classList.contains(cl[2]);
    return n.tagName === String(sel).toUpperCase();
}

function parseHtml(html, parent, doc) {
    const re = /<(\w+)([^>]*)>([\s\S]*?)<\/\1>|<(\w+)([^>]*)\/?>/g;
    // Simple stackless pass for our known markup (no unexpected nesting of same tags)
    function parse(str, owner) {
        const token = /<(\/)?(\w+)([^>]*)>/g;
        const stack = [owner];
        let last = 0;
        let m;
        while ((m = token.exec(str))) {
            last = m.index + m[0].length;
            const closing = !!m[1];
            const tag = m[2];
            const attr = m[3] || '';
            if (closing) {
                if (stack.length > 1) stack.pop();
                continue;
            }
            const child = el(tag, doc);
            const attrRe = /([\w:-]+)(?:="([^"]*)")?/g;
            let a;
            while ((a = attrRe.exec(attr))) {
                const name = a[1];
                const val = a[2] !== undefined ? a[2] : '';
                child.setAttribute(name, val);
                if (name === 'hidden') child.setAttribute('hidden', '');
            }
            stack[stack.length - 1].appendChild(child);
            const selfClosing = /\/\s*$/.test(attr) || /^(iframe|br|img|input)$/i.test(tag);
            if (!selfClosing) stack.push(child);
        }
    }
    parse(html, parent);
}

function makeDocument() {
    const doc = {
        readyState: 'complete',
        _byId: {},
        addEventListener: function() {}
    };
    const head = el('head', doc);
    const body = el('body', doc);
    const channelList = el('div', doc);
    channelList.setAttribute('id', 'channelList');
    body.appendChild(channelList);
    doc.head = head;
    doc.body = body;
    doc.documentElement = el('html', doc);
    doc.getElementById = function(id) { return doc._byId[id] || null; };
    doc.createElement = function(tag) { return el(tag, doc); };
    doc.querySelector = function(sel) {
        if (sel === '#channelList') return channelList;
        if (sel === '#citadelWirePanel .cw-frame-wrap') {
            const panel = doc.getElementById('citadelWirePanel');
            return panel ? panel.querySelector('.cw-frame-wrap') : null;
        }
        return null;
    };
    doc.channelList = channelList;
    return doc;
}

function loadPanel() {
    const document = makeDocument();
    const window = {
        document: document,
        addEventListener: function() {},
        ResizeObserver: undefined,
        localStorage: { getItem: function() { return null; }, setItem: function() {} }
    };
    document.defaultView = window;
    const code = fs.readFileSync(path.join(__dirname, '../hot-topics.js'), 'utf8');
    function noopTimer() { return 0; }
    vm.runInNewContext(code, {
        window: window,
        document: document,
        localStorage: window.localStorage,
        console: console,
        setTimeout: noopTimer,
        clearTimeout: noopTimer,
        setInterval: noopTimer,
        clearInterval: noopTimer,
        module: undefined,
        exports: undefined,
        require: undefined
    });
    return { window: window, document: document };
}

test('panel starts collapsed', function() {
    const ctx = loadPanel();
    const embed = ctx.document.getElementById('cwEmbed');
    const toggle = ctx.document.getElementById('cwToggle');
    const panel = ctx.document.getElementById('citadelWirePanel');
    assert.ok(embed, 'embed exists');
    assert.ok(toggle, 'toggle exists');
    assert.ok(embed.hasAttribute('hidden'));
    assert.ok(!embed.classList.contains('is-open'));
    assert.ok(!panel.classList.contains('is-open'));
    assert.strictEqual(toggle.getAttribute('aria-expanded'), 'false');
});

test('header tap opens, second header tap closes', function() {
    const ctx = loadPanel();
    const toggle = ctx.document.getElementById('cwToggle');
    const embed = ctx.document.getElementById('cwEmbed');
    const frame = ctx.document.getElementById('cwFrame');
    toggle.click();
    assert.ok(embed.classList.contains('is-open'));
    assert.ok(!embed.hasAttribute('hidden'));
    assert.strictEqual(toggle.getAttribute('aria-expanded'), 'true');
    assert.strictEqual(frame.getAttribute('src'), 'https://citadelwire.com');
    toggle.click();
    assert.ok(!embed.classList.contains('is-open'));
    assert.ok(embed.hasAttribute('hidden'));
    assert.strictEqual(toggle.getAttribute('aria-expanded'), 'false');
});

test('Collapse closes the open panel and stays closed after repeated clicks', function() {
    const ctx = loadPanel();
    const toggle = ctx.document.getElementById('cwToggle');
    const collapse = ctx.document.getElementById('cwCollapse');
    const embed = ctx.document.getElementById('cwEmbed');
    toggle.click();
    assert.ok(embed.classList.contains('is-open'));
    collapse.click();
    assert.ok(!embed.classList.contains('is-open'), 'first collapse should close');
    assert.ok(embed.hasAttribute('hidden'));
    assert.strictEqual(toggle.getAttribute('aria-expanded'), 'false');
    collapse.click();
    collapse.click();
    assert.ok(!embed.classList.contains('is-open'), 'repeated collapse stays closed');
    assert.strictEqual(toggle.getAttribute('aria-expanded'), 'false');
});

test('Collapse stopPropagation prevents a parent click from reopening', function() {
    const ctx = loadPanel();
    const toggle = ctx.document.getElementById('cwToggle');
    const collapse = ctx.document.getElementById('cwCollapse');
    const embed = ctx.document.getElementById('cwEmbed');
    const panel = ctx.document.getElementById('citadelWirePanel');
    // A parent listener that would reopen if the collapse click bubbled.
    panel.addEventListener('click', function() { ctx.window._cwToggle(); });
    toggle.click();
    assert.ok(embed.classList.contains('is-open'));
    const ev = collapse.click();
    assert.ok(ev._stopped, 'collapse click stops propagation');
    assert.ok(!embed.classList.contains('is-open'), 'must not reopen via bubbled parent toggle');
});

test('cwSetOpen(false) is a close, not a toggle', function() {
    const ctx = loadPanel();
    const embed = ctx.document.getElementById('cwEmbed');
    ctx.window._cwSetOpen(true);
    assert.ok(embed.classList.contains('is-open'));
    ctx.window._cwSetOpen(false);
    assert.ok(!embed.classList.contains('is-open'));
    ctx.window._cwSetOpen(false);
    assert.ok(!embed.classList.contains('is-open'));
});

test('narrow sidebar gets a scale-down, wide sidebar stays 1', function() {
    const ctx = loadPanel();
    assert.strictEqual(ctx.window._cwScaleForWidth(290, 404), 290 / 404);
    assert.strictEqual(ctx.window._cwScaleForWidth(390, 404), 390 / 404);
    assert.strictEqual(ctx.window._cwScaleForWidth(404, 404), 1);
    assert.strictEqual(ctx.window._cwScaleForWidth(440, 404), 1);
    assert.strictEqual(ctx.window._cwScaleForWidth(0, 404), 1);
});

test('fitFrame scales the iframe to the wrap width and does not set a fixed min-width CSS', function() {
    const ctx = loadPanel();
    const wrap = ctx.document.querySelector('#citadelWirePanel .cw-frame-wrap');
    const frame = ctx.document.getElementById('cwFrame');
    wrap.clientWidth = 290;
    wrap.clientHeight = 640;
    ctx.window._cwSetOpen(true);
    // _cwSetOpen calls cwFitFrame
    assert.strictEqual(frame.style.width, '404px');
    assert.strictEqual(frame.style.maxWidth, 'none');
    assert.strictEqual(frame.style.minWidth, '0');
    assert.ok(frame.style.transform.indexOf('scale(') === 0);
    const scale = 290 / 404;
    assert.strictEqual(frame.style.height, String(Math.round(640 / scale)) + 'px');
    wrap.clientWidth = 440;
    wrap.clientHeight = 640;
    ctx.window._cwSetOpen(true);
    assert.strictEqual(frame.style.width, '100%');
    assert.strictEqual(frame.style.height, '100%');
    assert.strictEqual(frame.style.transform, 'none');
});

const src = fs.readFileSync(path.join(__dirname, '../hot-topics.js'), 'utf8');
test('wrap uses overflow hidden and no wrap-level overflow auto', function() {
    const wrapCss = src.slice(src.indexOf('.cw-frame-wrap {'), src.indexOf('#cwFrame {'));
    assert.ok(wrapCss.indexOf('overflow: hidden') !== -1);
    assert.ok(wrapCss.indexOf('overflow: auto') === -1);
    assert.ok(wrapCss.indexOf('min-width: 0') !== -1);
    assert.ok(wrapCss.indexOf('min(70vh, 640px)') !== -1);
    const frameCss = src.slice(src.indexOf('#cwFrame {'), src.indexOf('#cwFrame {') + 500);
    assert.ok(frameCss.indexOf('min-width: 0') !== -1);
    assert.ok(frameCss.indexOf('width: 100%') !== -1);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
