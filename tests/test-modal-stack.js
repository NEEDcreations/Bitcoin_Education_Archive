// Cipher, key send, and inventory opened from the gift screen paint above it.
// Esc and Back close only that layer and leave the gift where it was.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'gifting.js'), 'utf8');

function link(parent) {
    var nodes = parent.childNodes;
    parent.firstChild = nodes.length ? nodes[0] : null;
    parent.lastChild = nodes.length ? nodes[nodes.length - 1] : null;
    for (var i = 0; i < nodes.length; i++) {
        nodes[i].parentNode = parent;
        nodes[i].previousSibling = i > 0 ? nodes[i - 1] : null;
        nodes[i].nextSibling = i + 1 < nodes.length ? nodes[i + 1] : null;
    }
}

function createDocument() {
    function createText(value) {
        return { nodeType: 3, nodeValue: String(value), childNodes: [], textContent: String(value) };
    }
    function createElement(tag) {
        var el = {
            nodeType: 1,
            tagName: String(tag).toUpperCase(),
            id: '',
            className: '',
            disabled: false,
            onclick: null,
            attrs: {},
            childNodes: [],
            style: {},
            parentNode: null,
            classList: { contains: function() { return false; }, remove: function() {}, add: function() {} }
        };
        el.appendChild = function(child) {
            if (child.parentNode && child.parentNode.removeChild) child.parentNode.removeChild(child);
            el.childNodes.push(child);
            link(el);
            return child;
        };
        el.removeChild = function(child) {
            var index = el.childNodes.indexOf(child);
            if (index >= 0) el.childNodes.splice(index, 1);
            child.parentNode = null;
            link(el);
            return child;
        };
        el.remove = function() { if (el.parentNode) el.parentNode.removeChild(el); };
        el.setAttribute = function(name, value) { el.attrs[name] = String(value); };
        el.getAttribute = function(name) {
            return Object.prototype.hasOwnProperty.call(el.attrs, name) ? el.attrs[name] : null;
        };
        el.removeAttribute = function(name) { delete el.attrs[name]; };
        el.addEventListener = function() {};
        el.focus = function() { document.activeElement = el; };
        el.contains = function(node) {
            var cur = node;
            while (cur) {
                if (cur === el) return true;
                cur = cur.parentNode;
            }
            return false;
        };
        Object.defineProperty(el, 'textContent', {
            get: function() {
                var out = '';
                el.childNodes.forEach(function(child) {
                    if (child.nodeType === 3) out += child.nodeValue || '';
                    else out += child.textContent || '';
                });
                return out;
            },
            set: function(value) {
                el.childNodes = [];
                if (value != null && String(value) !== '') el.childNodes.push(createText(String(value)));
                link(el);
            }
        });
        return el;
    }
    var document = {
        createElement: createElement,
        createTextNode: createText
    };
    var html = createElement('html');
    var head = createElement('head');
    var body = createElement('body');
    html.appendChild(head);
    html.appendChild(body);
    document.documentElement = html;
    document.head = head;
    document.body = body;
    document.activeElement = body;
    document._listeners = {};
    document.addEventListener = function(type, fn) {
        if (!document._listeners[type]) document._listeners[type] = [];
        document._listeners[type].push(fn);
    };
    document.removeEventListener = function(type, fn) {
        var list = document._listeners[type] || [];
        document._listeners[type] = list.filter(function(item) { return item !== fn; });
    };
    document.dispatchEvent = function(event) {
        (document._listeners[event.type] || []).slice().forEach(function(fn) { fn(event); });
    };
    document.querySelectorAll = function() { return []; };
    document.querySelector = function() { return null; };
    document.getElementById = function(id) {
        var found = null;
        function walk(node) {
            if (!node || found) return;
            if (node.id === id) { found = node; return; }
            (node.childNodes || []).forEach(walk);
        }
        walk(html);
        return found;
    };
    return document;
}

function zOf(el) {
    return el && el.style ? parseInt(el.style.zIndex, 10) : 0;
}

function boot() {
    var document = createDocument();
    var listeners = {};
    var stack = [{}];
    var wentHome = false;
    var sandbox = {
        console: console,
        setTimeout: function(fn, ms) {
            var id = setTimeout(fn, ms);
            if (id && typeof id.unref === 'function') id.unref();
            return id;
        },
        clearTimeout: clearTimeout,
        setInterval: function(fn, ms) {
            var id = setInterval(fn, ms);
            if (id && typeof id.unref === 'function') id.unref();
            return id;
        },
        clearInterval: clearInterval,
        Promise: Promise,
        Date: Date,
        Math: Math,
        Number: Number,
        String: String,
        Object: Object,
        Array: Array,
        Error: Error,
        parseInt: parseInt,
        parseFloat: parseFloat,
        isFinite: isFinite,
        document: document,
        audioEnabled: false,
        auth: { currentUser: { uid: 'opener', isAnonymous: false } },
        currentUser: { peers: ['peer-1'], satsDisabled: false },
        location: { href: 'https://quest.test/app', hash: '' },
        showToast: function() {},
        goHome: function() { wentHome = true; },
        _wentHome: function() { return wentHome; }
    };
    sandbox.window = sandbox;
    sandbox.addEventListener = function(type, fn) {
        if (!listeners[type]) listeners[type] = [];
        listeners[type].push(fn);
    };
    sandbox.removeEventListener = function(type, fn) {
        listeners[type] = (listeners[type] || []).filter(function(item) { return item !== fn; });
    };
    function fire(type) {
        (listeners[type] || []).slice().forEach(function(fn) { fn({ type: type }); });
    }
    sandbox.history = {
        pushState: function(state) { stack.push(state || {}); },
        back: function() {
            if (stack.length) stack.pop();
            fire('popstate');
        },
        get length() { return stack.length; }
    };
    sandbox._stack = function() { return stack.slice(); };
    sandbox.showQuestHub = function() {
        var hub = document.createElement('div');
        hub.id = 'questHubOverlay';
        hub.style.zIndex = '100000';
        var modal = document.createElement('div');
        var btn = document.createElement('button');
        btn.textContent = 'Inventory';
        modal.appendChild(btn);
        hub.appendChild(modal);
        document.body.appendChild(hub);
        sandbox.location.hash = '#questhub';
        sandbox._qhPopHandler = function() {
            var open = document.getElementById('questHubOverlay');
            if (open && open.parentNode) open.remove();
        };
        sandbox.addEventListener('popstate', sandbox._qhPopHandler);
    };
    sandbox.firebase = {
        functions: function() {
            return {
                httpsCallable: function() {
                    return function() { return new Promise(function() {}); };
                }
            };
        }
    };
    vm.runInNewContext(src, sandbox, { filename: 'gifting.js' });
    return { sandbox: sandbox, document: document };
}

function pressEscape(document) {
    document.dispatchEvent({
        type: 'keydown',
        key: 'Escape',
        keyCode: 27,
        preventDefault: function() {},
        stopPropagation: function() {}
    });
}

function wait(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

async function flush() {
    for (var i = 0; i < 8; i++) await Promise.resolve();
    await wait(40);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
    try { await fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + (e.stack || e.message)); failed++; }
}

async function main() {
    await test('a cipher opened from the gift screen stacks above it', async function() {
        var env = boot();
        var opener = env.document.createElement('button');
        opener.textContent = 'Open cipher';
        env.document.body.appendChild(opener);
        env.sandbox.showPostSpinGiftModal([{ id: 'g1', rewardType: 'tickets' }]);
        opener.focus();
        var gift = env.document.getElementById('postSpinGiftOverlay');
        assert.ok(gift);
        env.sandbox.decryptCipherModal('c1', '3A', { id: 'k1', status: 'inventory', label: '3A' });
        await flush();
        var cipher = env.document.getElementById('decryptCipherOverlay');
        assert.ok(cipher, 'cipher overlay missing');
        assert.ok(zOf(cipher) > zOf(gift), 'cipher z ' + zOf(cipher) + ' gift z ' + zOf(gift));
        var dialog = cipher.childNodes[0];
        assert.strictEqual(dialog.getAttribute('role'), 'dialog');
        assert.strictEqual(dialog.getAttribute('aria-modal'), 'true');
        assert.strictEqual(env.document.activeElement, dialog);
        var bodyKids = env.document.body.childNodes.map(function(node) { return node.id; });
        assert.ok(bodyKids.indexOf('postSpinGiftOverlay') < bodyKids.indexOf('decryptCipherOverlay'));
        pressEscape(env.document);
        assert.strictEqual(env.document.getElementById('decryptCipherOverlay'), null);
        assert.ok(env.document.getElementById('postSpinGiftOverlay'));
        assert.strictEqual(env.document.activeElement, opener);
        assert.strictEqual(env.sandbox._wentHome(), false);
    });

    await test('Back closes the cipher and returns to the gift', async function() {
        var env = boot();
        env.sandbox.showPostSpinGiftModal([{ id: 'g1', rewardType: 'tickets' }]);
        env.sandbox.decryptCipherModal('c2', '7C', { id: 'k2', status: 'inventory' });
        await flush();
        assert.ok(env.document.getElementById('decryptCipherOverlay'));
        env.sandbox.history.back();
        await flush();
        assert.strictEqual(env.document.getElementById('decryptCipherOverlay'), null);
        assert.ok(env.document.getElementById('postSpinGiftOverlay'));
        assert.strictEqual(env.sandbox._wentHome(), false);
    });

    await test('key send and the key picker stack above the gift', async function() {
        var env = boot();
        env.sandbox.showPostSpinGiftModal([{ id: 'g1', rewardType: 'keys' }]);
        var gift = env.document.getElementById('postSpinGiftOverlay');
        await env.sandbox.showPeerPickerForKeys(['k1', 'k2']);
        await flush();
        var peer = env.document.getElementById('peerPickerOverlay');
        assert.ok(peer);
        assert.ok(zOf(peer) > zOf(gift));
        assert.strictEqual(peer.childNodes[0].getAttribute('role'), 'dialog');
        pressEscape(env.document);
        assert.strictEqual(env.document.getElementById('peerPickerOverlay'), null);
        assert.ok(env.document.getElementById('postSpinGiftOverlay'));
        await env.sandbox.showKeyPickerForPeer('peer-1', 'Ada');
        await flush();
        var keys = env.document.getElementById('keyPickerOverlay');
        assert.ok(keys);
        assert.ok(zOf(keys) > zOf(gift));
        env.sandbox.history.back();
        await flush();
        assert.strictEqual(env.document.getElementById('keyPickerOverlay'), null);
        assert.ok(env.document.getElementById('postSpinGiftOverlay'));
        assert.strictEqual(env.sandbox._wentHome(), false);
    });

    await test('inventory opened from the gift screen stacks above it', async function() {
        var env = boot();
        var opener = env.document.createElement('button');
        opener.textContent = 'Inventory';
        env.document.body.appendChild(opener);
        env.sandbox.showPostSpinGiftModal([{ id: 'g1', rewardType: 'tickets' }]);
        opener.focus();
        var giftZ = zOf(env.document.getElementById('postSpinGiftOverlay'));
        env.sandbox.openNookInventory();
        await wait(160);
        var hub = env.document.getElementById('questHubOverlay');
        assert.ok(hub);
        assert.ok(zOf(hub) > giftZ, 'hub z ' + zOf(hub) + ' gift z ' + giftZ);
        assert.strictEqual(hub.childNodes[0].getAttribute('role'), 'dialog');
        pressEscape(env.document);
        assert.strictEqual(env.document.getElementById('questHubOverlay'), null);
        assert.ok(env.document.getElementById('postSpinGiftOverlay'));
        assert.strictEqual(env.document.activeElement, opener);
        assert.strictEqual(env.sandbox._wentHome(), false);
    });

    await test('an unsolicited cipher share stays behind the gift', async function() {
        var env = boot();
        env.sandbox.showPostSpinGiftModal([{ id: 'g1', rewardType: 'tickets' }]);
        var gift = env.document.getElementById('postSpinGiftOverlay');
        env.sandbox.showCipherShareReveal({ shareId: 's1', cipherLabel: '3A', openerUsername: 'Ada' });
        var share = env.document.getElementById('cipherShareOverlay');
        assert.ok(share);
        assert.ok(zOf(share) < zOf(gift), 'share z ' + zOf(share) + ' gift z ' + zOf(gift));
        assert.strictEqual(share.style.zIndex, '480000');
    });

    await test('Escape still closes the gift when nothing is in front of it', async function() {
        var env = boot();
        env.sandbox.showPostSpinGiftModal([{ id: 'g1', rewardType: 'tickets' }]);
        pressEscape(env.document);
        assert.strictEqual(env.document.getElementById('postSpinGiftOverlay'), null);
        assert.strictEqual(env.sandbox._wentHome(), false);
    });

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    if (failed) process.exit(1);
}

main().catch(function(err) {
    console.error(err);
    process.exit(1);
});
