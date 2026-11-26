// Inline Conversation reply: after a successful send the composer is usable
// again (not left in Posting), and a failed send keeps the text and re-enables.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'topic-discussions.js'), 'utf8');

let passed = 0;
let failed = 0;
const queue = [];
function test(name, fn) { queue.push({ name: name, fn: fn }); }

function makeEnv(callImpl) {
    const all = [];
    function node(tag) {
        const n = {
            tagName: String(tag || '').toUpperCase(),
            nodeType: 1,
            children: [],
            parentNode: null,
            attrs: {},
            listeners: {},
            style: {},
            hidden: false,
            disabled: false,
            value: '',
            textContent: '',
            className: '',
            id: '',
            classList: { add: function() {}, remove: function() {}, contains: function() { return false; }, toggle: function() {} },
            get firstChild() { return this.children[0] || null; },
            get nextSibling() {
                if (!this.parentNode) return null;
                const sib = this.parentNode.children;
                return sib[sib.indexOf(this) + 1] || null;
            },
            appendChild: function(c) {
                if (c.parentNode) c.parentNode.removeChild(c);
                c.parentNode = this; this.children.push(c); return c;
            },
            insertBefore: function(c, ref) {
                if (c.parentNode) c.parentNode.removeChild(c);
                const i = this.children.indexOf(ref);
                c.parentNode = this;
                if (i < 0) this.children.push(c); else this.children.splice(i, 0, c);
                return c;
            },
            removeChild: function(c) {
                const i = this.children.indexOf(c);
                if (i >= 0) this.children.splice(i, 1);
                c.parentNode = null; return c;
            },
            setAttribute: function(k, v) { this.attrs[k] = String(v); },
            getAttribute: function(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
            removeAttribute: function(k) { delete this.attrs[k]; },
            hasAttribute: function(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k); },
            addEventListener: function(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
            removeEventListener: function() {},
            querySelector: function() { return null; },
            querySelectorAll: function() { return []; },
            getBoundingClientRect: function() { return { top: 0, bottom: 0, left: 0, right: 0, height: 0, width: 0 }; },
            scrollIntoView: function() {},
            focus: function() {},
            click: function() { (this.listeners.click || []).forEach(function(fn) { fn({ preventDefault: function() {} }); }); }
        };
        all.push(n);
        return n;
    }
    const body = node('body');
    function connected(n) {
        while (n) { if (n === body) return true; n = n.parentNode; }
        return false;
    }
    const document = {
        body: body,
        head: node('head'),
        documentElement: node('html'),
        createElement: node,
        createTextNode: function(t) { return { nodeType: 3, nodeValue: String(t), parentNode: null }; },
        getElementById: function(id) {
            for (let i = 0; i < all.length; i++) if (all[i].id === id && connected(all[i])) return all[i];
            return null;
        },
        querySelector: function() { return null; },
        querySelectorAll: function() { return []; },
        addEventListener: function() {}
    };
    const calls = [];
    function chain() {
        const f = function() { return chain(); };
        return new Proxy(f, {
            get: function(t, k) {
                if (k === 'onSnapshot') return function() { return function() {}; };
                if (k === 'get') return function() { return Promise.resolve({ docs: [], empty: true, forEach: function() {}, exists: false, data: function() { return null; } }); };
                if (k === 'then') return undefined;
                return chain();
            },
            apply: function() { return chain(); }
        });
    }
    const authCbs = [];
    const window = {
        addEventListener: function() {},
        removeEventListener: function() {},
        location: { href: 'https://bitcoineducation.quest/', hash: '' },
        matchMedia: function() { return { matches: false, addEventListener: function() {} }; },
        scrollTo: function() {},
        innerHeight: 800,
        innerWidth: 400
    };
    window.document = document;
    window.window = window;
    const toasts = [];
    const ctx = {
        window: window,
        document: document,
        console: console,
        setTimeout: function(fn) { return 0; },
        clearTimeout: function() {},
        requestAnimationFrame: function() { return 0; },
        sessionStorage: { getItem: function() { return null; }, setItem: function() {}, removeItem: function() {} },
        localStorage: { getItem: function() { return null; }, setItem: function() {}, removeItem: function() {} },
        history: { pushState: function() {}, back: function() {}, replaceState: function() {} },
        showToast: function(m) { toasts.push(m); },
        db: chain(),
        auth: {
            currentUser: { uid: 'uidAlice0001', isAnonymous: false },
            onAuthStateChanged: function(cb) { authCbs.push(cb); }
        },
        currentUser: { username: 'alice' },
        firebase: {
            functions: function() {
                return {
                    httpsCallable: function(name) {
                        return function(payload) { calls.push({ name: name, payload: payload }); return callImpl(calls.length, payload); };
                    }
                };
            }
        }
    };
    vm.createContext(ctx);
    vm.runInContext(src, ctx);
    const msgs = node('div');
    msgs.id = 'msgs';
    body.appendChild(msgs);
    window.mountTopicDiscussion('mining');
    // An open inline Conversation card for root post p1.
    const card = node('section');
    card.id = 'td-inline-thread';
    card.setAttribute('data-post-id', 'p1');
    const host = node('div');
    host.id = 'td-inline-composer';
    card.appendChild(host);
    msgs.appendChild(card);
    authCbs.forEach(function(cb) { cb(); });
    function find(id) { return document.getElementById(id); }
    function sendBtn() {
        const row = host.children[host.children.length - 1];
        return row && row.children[row.children.length - 1];
    }
    return { find: find, host: host, card: card, msgs: msgs, sendBtn: sendBtn, calls: calls, toasts: toasts, authCbs: authCbs };
}

function flush() { return new Promise(function(r) { setImmediate(r); }); }

test('inline reply renders a Reply composer', async function() {
    const env = makeEnv(function() { return Promise.resolve({ data: { postId: 'r1' } }); });
    const area = env.find('td-inline-input');
    assert.ok(area, 'inline textarea');
    const send = env.sendBtn();
    assert.strictEqual(send.textContent, 'Reply');
    assert.strictEqual(send.disabled, false);
});

test('after a successful inline reply the clicked button is not left in Posting', async function() {
    let release;
    const env = makeEnv(function() { return new Promise(function(r) { release = r; }); });
    const area = env.find('td-inline-input');
    const send = env.sendBtn();
    area.value = 'Thanks, that helps';
    send.click();
    assert.strictEqual(send.disabled, true, 'busy while posting');
    assert.strictEqual(send.textContent, 'Posting…');
    assert.strictEqual(area.disabled, true);
    // The card closes before the server answers, so nothing re-renders it.
    env.msgs.removeChild(env.card);
    release({ data: { postId: 'r1' } });
    await flush();
    assert.strictEqual(send.disabled, false, 'button re-enabled on success');
    assert.strictEqual(send.textContent, 'Reply');
    assert.strictEqual(send.getAttribute('aria-busy'), 'false');
    assert.strictEqual(area.disabled, false);
    assert.strictEqual(area.value, '');
});

test('a second inline reply after success posts and ends enabled', async function() {
    const env = makeEnv(function(n) { return Promise.resolve({ data: { postId: 'r' + n } }); });
    env.find('td-inline-input').value = 'first';
    env.sendBtn().click();
    await flush();
    const area2 = env.find('td-inline-input');
    const send2 = env.sendBtn();
    assert.strictEqual(send2.disabled, false);
    area2.value = 'second';
    send2.click();
    assert.strictEqual(send2.textContent, 'Posting…');
    await flush();
    assert.strictEqual(env.calls.length, 2);
    assert.strictEqual(env.calls[1].payload.text, 'second');
    assert.strictEqual(env.calls[1].payload.parentId, 'p1');
    const send3 = env.sendBtn();
    assert.strictEqual(send3.disabled, false);
    assert.strictEqual(send3.textContent, 'Reply');
});

test('after an inline reply, the bottom composer posts its own text', async function() {
    const env = makeEnv(function(n) {
        return n === 1 ? Promise.resolve({ data: { postId: 'r1' } }) : Promise.reject(new Error('Slow down'));
    });
    env.find('td-inline-input').value = 'inline text';
    env.sendBtn().click();
    await flush();
    const main = env.find('topic-discussion-input');
    assert.ok(main, 'bottom composer textarea');
    const composer = env.find('topic-discussion-composer');
    const row = composer.children[composer.children.length - 1];
    const post = row.children[row.children.length - 1];
    main.value = 'bottom text';
    post.click();
    assert.strictEqual(post.textContent, 'Posting…');
    await flush();
    assert.strictEqual(env.calls.length, 2);
    assert.strictEqual(env.calls[1].payload.text, 'bottom text');
    assert.strictEqual(post.disabled, false, 'failure re-enables Post');
    assert.strictEqual(main.value, 'bottom text', 'failure keeps the text');
});

test('a failed inline reply keeps the text and re-enables Reply', async function() {
    const env = makeEnv(function() { return Promise.reject(new Error('Slow down')); });
    const area = env.find('td-inline-input');
    const send = env.sendBtn();
    area.value = 'keep me';
    send.click();
    await flush();
    assert.strictEqual(send.disabled, false);
    assert.strictEqual(send.textContent, 'Reply');
    assert.strictEqual(send.getAttribute('aria-busy'), 'false');
    assert.strictEqual(area.value, 'keep me');
    assert.ok(env.toasts.indexOf('Slow down') !== -1);
});

(async function() {
    for (const t of queue) {
        try { await t.fn(); console.log('  ok  ' + t.name); passed++; }
        catch (e) { console.log('  FAIL ' + t.name + ': ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); failed++; }
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
})();
