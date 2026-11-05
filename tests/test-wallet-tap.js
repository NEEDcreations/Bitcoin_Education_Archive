// A failed wallet-router.js must not stick the Wallet tap.
// The next tap retries the load, and this tap still opens go('wallet') or #wallet.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const uxSrc = fs.readFileSync(path.join(root, 'mobile-ux.js'), 'utf8');
const guide = fs.readFileSync(path.join(root, 'guide.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const reg = require(path.join(root, 'features.registry.js'));

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ok  ' + name); passed++; }
    catch (e) { console.log('  FAIL ' + name + ': ' + e.message); failed++; }
}

function boot() {
    var timeouts = [];
    var intervals = [];
    var nextId = 1;
    function element(tag) {
        var node = {
            tagName: String(tag).toUpperCase(),
            attrs: {},
            listeners: {},
            childNodes: [],
            style: {},
            src: '',
            async: false,
            id: '',
            textContent: '',
            parentNode: null,
            classList: {
                add: function() {},
                remove: function() {},
                toggle: function() {},
                contains: function() { return false; }
            }
        };
        node.setAttribute = function(name, value) {
            node.attrs[name] = String(value);
            if (name === 'id') node.id = String(value);
        };
        node.getAttribute = function(name) {
            return Object.prototype.hasOwnProperty.call(node.attrs, name) ? node.attrs[name] : null;
        };
        node.addEventListener = function(type, fn) {
            (node.listeners[type] || (node.listeners[type] = [])).push(fn);
        };
        node.appendChild = function(child) {
            if (child.parentNode) child.parentNode.removeChild(child);
            node.childNodes.push(child);
            child.parentNode = node;
            return child;
        };
        node.removeChild = function(child) {
            var index = node.childNodes.indexOf(child);
            if (index >= 0) node.childNodes.splice(index, 1);
            child.parentNode = null;
            return child;
        };
        node.remove = function() {
            if (node.parentNode) node.parentNode.removeChild(node);
        };
        node.focus = function() {};
        return node;
    }
    function walk(node, id) {
        if (!node) return null;
        if (node.id === id || (node.attrs && node.attrs.id === id)) return node;
        var kids = node.childNodes || [];
        var i;
        for (i = 0; i < kids.length; i++) {
            var found = walk(kids[i], id);
            if (found) return found;
        }
        return null;
    }
    var document = {
        readyState: 'loading',
        visibilityState: 'visible',
        createElement: element,
        body: element('body'),
        head: element('head'),
        documentElement: element('html')
    };
    document.getElementById = function(id) {
        return walk(document.body, id) || walk(document.head, id);
    };
    document.querySelector = function(sel) {
        var src = /^script\[src="([^"]+)"\]$/.exec(sel);
        if (src) {
            var nodes = document.body.childNodes;
            var i;
            for (i = 0; i < nodes.length; i++) {
                if (nodes[i].tagName === 'SCRIPT' && nodes[i].src === src[1]) return nodes[i];
            }
            return null;
        }
        var id = /^#([\w-]+)$/.exec(sel);
        return id ? document.getElementById(id[1]) : null;
    };
    document.addEventListener = function() {};
    var sandbox = {
        console: console,
        document: document,
        navigator: { userAgent: '', platform: '', maxTouchPoints: 0, vibrate: null },
        localStorage: {
            store: {},
            getItem: function(key) { return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null; },
            setItem: function(key, value) { this.store[key] = String(value); }
        },
        location: { hash: '' },
        history: { pushState: function() {} },
        MutationObserver: function() { this.observe = function() {}; this.disconnect = function() {}; },
        matchMedia: function() { return { matches: false }; },
        setTimeout: function(fn) {
            var id = nextId++;
            timeouts.push({ id: id, fn: fn });
            return id;
        },
        clearTimeout: function(id) {
            timeouts = timeouts.filter(function(item) { return item.id !== id; });
        },
        setInterval: function(fn) {
            var id = nextId++;
            intervals.push({ id: id, fn: fn });
            return id;
        },
        clearInterval: function(id) {
            intervals = intervals.filter(function(item) { return item.id !== id; });
        },
        Date: Date,
        JSON: JSON,
        goCalls: [],
        toasts: []
    };
    sandbox.addEventListener = function() {};
    sandbox.removeEventListener = function() {};
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(uxSrc, sandbox, { filename: 'mobile-ux.js' });
    sandbox.BQ_EXPLORE_APPS = reg.BQ_EXPLORE_APPS;
    sandbox.go = function(id) { sandbox.goCalls.push(id); };
    sandbox.showToast = function(msg) { sandbox.toasts.push(msg); };
    sandbox.flushTimeouts = function() {
        var batch = timeouts.splice(0, timeouts.length);
        batch.forEach(function(item) { item.fn(); });
    };
    sandbox.pumpIntervals = function(times) {
        var n;
        for (n = 0; n < times; n++) {
            intervals.slice().forEach(function(item) { item.fn(); });
        }
    };
    sandbox.walletTags = function() {
        return document.body.childNodes.filter(function(node) {
            return node.tagName === 'SCRIPT' && node.src.indexOf('wallet-router.js') !== -1;
        });
    };
    sandbox.scriptCount = function() {
        return document.body.childNodes.filter(function(node) { return node.tagName === 'SCRIPT'; }).length;
    };
    sandbox.fire = function(node, type) {
        (node.listeners[type] || []).slice().forEach(function(fn) { fn(); });
    };
    return sandbox;
}

test('a wallet-router error clears the queue, drops the tag, toasts, and the next tap retries', function() {
    var env = boot();
    env.openWalletWhenReady();
    assert.strictEqual(env.walletTags().length, 1);
    assert.strictEqual(env.scriptCount(), 3);
    env.openWalletWhenReady();
    assert.strictEqual(env.scriptCount(), 3);
    env.fire(env.walletTags()[0], 'error');
    env.flushTimeouts();
    assert.strictEqual(env.scriptCount(), 0);
    assert.deepStrictEqual(env.goCalls, ['wallet']);
    assert.strictEqual(env.toasts.length, 1);
    assert.ok(env.toasts[0].indexOf('Wallet did not load') !== -1);
    env.openWalletWhenReady();
    assert.strictEqual(env.walletTags().length, 1);
    assert.strictEqual(env.scriptCount(), 3);
});

test('a poll timeout uses the same recovery and can fall back to the hash', function() {
    var env = boot();
    env.go = null;
    env.openWalletWhenReady();
    assert.strictEqual(env.walletTags().length, 1);
    env.pumpIntervals(80);
    assert.strictEqual(env.walletTags().length, 1);
    env.pumpIntervals(1);
    assert.strictEqual(env.scriptCount(), 0);
    assert.strictEqual(env.location.hash, 'wallet');
    assert.strictEqual(env.toasts.length, 1);
    env.go = function(id) { env.goCalls.push(id); };
    env.openWalletWhenReady();
    assert.strictEqual(env.walletTags().length, 1);
});

test('a wallet tap that becomes ready still opens the wallet without a toast', function() {
    var env = boot();
    env.renderLightning = function() {};
    env.openWalletWhenReady();
    env._bqWalletRouteReady = true;
    env.fire(env.walletTags()[0], 'load');
    assert.deepStrictEqual(env.goCalls, ['wallet']);
    assert.strictEqual(env.toasts.length, 0);
    assert.strictEqual(env.walletTags()[0].getAttribute('data-loaded'), '1');
    env.pumpIntervals(81);
    assert.strictEqual(env.toasts.length, 0);
    assert.deepStrictEqual(env.goCalls, ['wallet']);
});

test('the mini-app answer follows the same mode filter as the phone sheet', function() {
    var env = boot();
    env.localStorage.setItem('btc_experience_mode', 'beginner');
    var beginner = env.exploreAppsForMode();
    assert.strictEqual(beginner.length, 6);
    assert.strictEqual(Array.prototype.map.call(beginner, function(item) { return item.id; }).join(','), 'nacho,tv,ai,metrics,lb,wallet');
    env.localStorage.setItem('btc_experience_mode', 'advanced');
    assert.strictEqual(env.exploreAppsForMode().length, 12);
    assert.ok(guide.includes('window.exploreAppsForMode()'));
    assert.ok(guide.includes('climbs through Curious, Pleb'));
    assert.ok(guide.includes("you\\'ve reached a sufficient rank."));
    assert.ok(!html.includes('7 mini-apps'));
    assert.strictEqual(html, fs.readFileSync(path.join(root, '404.html'), 'utf8'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
