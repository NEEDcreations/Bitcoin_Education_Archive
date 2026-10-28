// Auth can resolve before bundle.min.js parses. loadUser must not throw on
// bundle-only globals, and the statements after that work must still run.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

const root = path.join(__dirname, '..');
const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function extract(name) {
    const start = ranking.indexOf('function ' + name);
    assert.ok(start !== -1, 'missing ' + name);
    let i = ranking.indexOf('{', start);
    let depth = 0;
    for (; i < ranking.length; i++) {
        if (ranking[i] === '{') depth++;
        else if (ranking[i] === '}') {
            depth--;
            if (depth === 0) return ranking.slice(start, i + 1);
        }
    }
    throw new Error('unclosed ' + name);
}

test('story-day merge survives auth before the bundle', () => {
    const store = { btc_nacho_story_days: '{' };
    const removed = [];
    const localStorage = {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setItem: function (k, v) { store[k] = String(v); },
        removeItem: function (k) { removed.push(k); delete store[k]; }
    };
    const sandbox = {
        console: console,
        localStorage: localStorage,
        window: null,
        globalThis: null
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(extract('safeJSON') + '\n' + extract('mergeStoredStoryDays') + '\n' + extract('whenBundleReady'), sandbox);

    let continued = false;
    sandbox.safeJSON = undefined;
    sandbox.whenBundleReady(function () {
        sandbox.mergeStoredStoryDays([1, 2, 3]);
    });
    continued = true;
    assert.strictEqual(continued, true);
    assert.strictEqual(sandbox._btcBundleReady, undefined);
    assert.strictEqual(sandbox._btcBundleQueue.length, 1);
    assert.strictEqual(store.btc_nacho_story_days, '{');

    sandbox._btcBundleWaiter();
    assert.strictEqual(sandbox._btcBundleReady, true);
    assert.strictEqual(sandbox._btcBundleQueue.length, 0);
    assert.strictEqual(store.btc_nacho_story_days, '[1,2,3]');

    store.btc_nacho_story_days = '{';
    sandbox.safeJSON = undefined;
    sandbox.mergeStoredStoryDays(['a']);
    assert.strictEqual(store.btc_nacho_story_days, '["a"]');
});

test('corrupt story days do not throw when safeJSON is the ranking fallback', () => {
    const store = { btc_nacho_story_days: '{' };
    const localStorage = {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setItem: function (k, v) { store[k] = String(v); },
        removeItem: function (k) { delete store[k]; }
    };
    const sandbox = {
        console: { warn: function () {}, log: function () {} },
        localStorage: localStorage
    };
    vm.createContext(sandbox);
    vm.runInContext(extract('safeJSON') + '\n' + extract('mergeStoredStoryDays'), sandbox);
    assert.doesNotThrow(function () { sandbox.mergeStoredStoryDays([9]); });
    assert.strictEqual(store.btc_nacho_story_days, '[9]');
});

test('loadUser defers the story-day read and does not call safeJSON bare', () => {
    const load = ranking.slice(ranking.indexOf('async function loadUser'), ranking.indexOf('function homeSignedInNow'));
    assert.ok(load.indexOf('whenBundleReady(function () { mergeStoredStoryDays(') !== -1);
    assert.strictEqual(load.indexOf("var localDays = safeJSON("), -1);
    const sync = ranking.slice(ranking.indexOf('window.syncCelebratedState'), ranking.indexOf('window.syncCelebratedState') + 800);
    assert.ok(sync.indexOf("typeof safeJSON !== 'function'") !== -1);
    assert.ok(ranking.indexOf('function safeJSON(') !== -1);
    assert.ok(ranking.indexOf('function safeJSON(') < ranking.indexOf('async function loadUser'));
});

test('firebase config is one literal shared by both boot paths', () => {
    const config = fs.readFileSync(path.join(root, 'firebase-config.js'), 'utf8');
    const boot = fs.readFileSync(path.join(root, 'auth-boot.js'), 'utf8');
    assert.ok(config.indexOf('AIzaSyDLwucmRxjoJp2KMBTi2ujf0mlVkgLHyKk') !== -1);
    assert.strictEqual(boot.indexOf('AIzaSy'), -1);
    assert.strictEqual(ranking.indexOf('AIzaSy'), -1);
    assert.ok(boot.indexOf('window.FIREBASE_CONFIG') !== -1);
    assert.ok(ranking.indexOf('window.FIREBASE_CONFIG') !== -1);
    assert.ok(html.indexOf('firebase-config.js?v=20261027_v2394') !== -1);
    assert.ok(html.indexOf('firebase-config.js?v=20261027_v2394') < html.indexOf('auth-boot.js?v=20261027_v2394'));
    assert.ok(html.indexOf('firebase-config.js?v=20261027_v2394') < html.indexOf('app-check-boot.js?v=20261028_v2403'));
    assert.ok(html.indexOf('app-check-boot.js?v=20261028_v2403') < html.indexOf('auth-boot.js?v=20261027_v2394'));
    assert.ok(html.indexOf('firebase-app-check-compat.js') < html.indexOf('firebase-auth-compat.js'));
    const appCheck = fs.readFileSync(path.join(root, 'app-check-boot.js'), 'utf8');
    assert.ok(appCheck.indexOf('6Le37votAAAAAD3n0_u1uPxgcvm4XtmOEeK1Ti9j') !== -1);
    assert.ok(appCheck.indexOf('firebase.appCheck().activate(SITE_KEY, true)') !== -1);
    assert.strictEqual(appCheck.indexOf('AIzaSy'), -1);
    assert.ok(ranking.indexOf('if (!window._btcAppCheckReady)') !== -1);
});

test('bundle preload is restored and the ready signal follows the bundle', () => {
    assert.strictEqual((html.match(/bundle\.min\.js\?v=20261027_v2395/g) || []).length, 2);
    assert.ok(html.indexOf('rel="preload" href="bundle.min.js?v=20261027_v2395" as="script"') !== -1);
    assert.ok(html.indexOf('bundle.min.js?v=20261027_v2395" defer fetchpriority="high"') !== -1);
    assert.ok(html.indexOf('bundle.min.js?v=20261027_v2395" defer') < html.indexOf('bundle-ready.js?v=20261027_v2394'));
    const ready = fs.readFileSync(path.join(root, 'bundle-ready.js'), 'utf8');
    assert.ok(ready.indexOf('_btcBundleReady = true') !== -1);
    assert.ok(ready.indexOf('btc-bundle-ready') !== -1);
});

test('update reload drops one-shot auth and referral params', () => {
    const reload = html.slice(html.indexOf('function _reloadOnce'), html.indexOf('function _reloadOnce') + 900);
    ['oobCode', 'apiKey', 'mode', 'ref', 'continueUrl', 'signin_email'].forEach(function (key) {
        assert.ok(reload.indexOf(key) !== -1, key);
    });
    assert.ok(reload.indexOf("location.replace(window.location.origin + '/')") !== -1);
    assert.ok(reload.indexOf('location.reload()') !== -1);
});

test('window load drains the bundle queue once', () => {
    const listeners = {};
    let runs = 0;
    const sandbox = {
        console: console,
        document: { readyState: 'loading' },
        addEventListener: function (name, fn) { listeners[name] = fn; }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(extract('whenBundleReady'), sandbox);
    sandbox.whenBundleReady(function () { runs++; });
    assert.strictEqual(runs, 0);
    assert.strictEqual(sandbox._btcBundleQueue.length, 1);
    assert.strictEqual(typeof listeners.load, 'function');
    assert.strictEqual(listeners.load, listeners['btc-bundle-ready']);
    listeners.load();
    assert.strictEqual(runs, 1);
    listeners.load();
    listeners['btc-bundle-ready']();
    assert.strictEqual(runs, 1);
    assert.strictEqual(sandbox._btcBundleQueue.length, 0);

    const done = {
        console: console,
        document: { readyState: 'complete' },
        addEventListener: function () {}
    };
    done.window = done;
    done.globalThis = done;
    vm.createContext(done);
    vm.runInContext(extract('whenBundleReady'), done);
    let ran = 0;
    done.whenBundleReady(function () { ran++; });
    assert.strictEqual(ran, 1);
    done.whenBundleReady(function () { ran++; });
    assert.strictEqual(ran, 2);
    const waiter = extract('whenBundleReady');
    assert.ok(waiter.indexOf("addEventListener('load', target._btcBundleWaiter)") !== -1);
    assert.ok(waiter.indexOf('_btcBundleDrained') !== -1);
});

test('a pending redirect that ends signed out clears the snapshot', () => {
    const listenAt = ranking.indexOf('auth.onAuthStateChanged(user => {');
    const listen = ranking.slice(listenAt, listenAt + 12000);
    const timeout = listen.indexOf('No real user after 8s');
    assert.ok(timeout !== -1);
    const anonEnd = listen.slice(timeout, timeout + 250);
    assert.ok(anonEnd.indexOf('clearAuthDisplay()') !== -1);
    const nullEnd = listen.indexOf('10s timeout with no user');
    assert.ok(nullEnd !== -1);
    assert.ok(listen.slice(nullEnd, nullEnd + 800).indexOf('clearAuthDisplay()') !== -1);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
