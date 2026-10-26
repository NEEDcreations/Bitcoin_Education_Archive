// First-visit load must not reload. An old btc_build still nukes once.
// index.html and 404.html stay byte-identical.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    const run = Promise.resolve().then(fn);
    return run.then(function () {
        console.log('✅ ' + name);
        passed++;
    }).catch(function (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    });
}

function extractNuke(html) {
    const start = html.indexOf('// One-time cache nuke for the SW strategy change (April 2026)');
    const end = html.indexOf('})();', start);
    assert.ok(start !== -1 && end > start, 'cache nuke block missing');
    return html.slice(start, end + 5);
}

function runNuke(initial, sessionInitial) {
    const html = read('index.html');
    const storage = Object.assign({}, initial);
    const session = Object.assign({}, sessionInitial);
    const sets = [];
    const deleted = [];
    const unregistered = [];
    const timeouts = [];
    let keysCalls = 0;
    let regCalls = 0;
    const reloads = [];
    const location = {
        href: 'https://bitcoineducation.quest/',
        reload: function () { reloads.push(1); }
    };
    const caches = {
        keys: function () {
            keysCalls++;
            return Promise.resolve(['btc-archive-old']);
        },
        delete: function (name) {
            deleted.push(name);
            return Promise.resolve(true);
        }
    };
    const sandbox = {
        location: location,
        history: { replaceState: function () {} },
        localStorage: {
            getItem: function (key) { return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null; },
            setItem: function (key, value) {
                storage[key] = String(value);
                sets.push(key + '=' + value);
            }
        },
        sessionStorage: {
            getItem: function (key) { return Object.prototype.hasOwnProperty.call(session, key) ? session[key] : null; },
            setItem: function (key, value) { session[key] = String(value); }
        },
        navigator: {
            serviceWorker: {
                getRegistrations: function () {
                    regCalls++;
                    return Promise.resolve([{ unregister: function () { unregistered.push(1); } }]);
                }
            }
        },
        caches: caches,
        setTimeout: function (fn, ms) { timeouts.push({ fn: fn, ms: ms }); },
        Promise: Promise,
        window: null
    };
    sandbox.window = sandbox;
    vm.runInNewContext(extractNuke(html), sandbox);
    return {
        storage: storage,
        session: session,
        sets: sets,
        deleted: deleted,
        unregistered: unregistered,
        timeouts: timeouts,
        keysCalls: function () { return keysCalls; },
        regCalls: function () { return regCalls; },
        reloads: reloads
    };
}

function flush() {
    return Promise.resolve().then(function () { return Promise.resolve(); }).then(function () { return Promise.resolve(); });
}

function extractSwBoot(html) {
    const start = html.indexOf("if ('serviceWorker' in navigator)");
    const end = html.indexOf('</script>', start);
    assert.ok(start !== -1 && end > start, 'service worker boot missing');
    return html.slice(start, end);
}

function runSwBoot(hadController) {
    const html = read('index.html');
    const reloads = [];
    const navigations = [];
    const banners = [];
    const swListeners = {};
    const windowListeners = {};
    let locationHref = 'https://bitcoineducation.quest/#home';
    const location = {
        origin: 'https://bitcoineducation.quest',
        reload: function () { reloads.push(1); }
    };
    Object.defineProperty(location, 'href', {
        get: function () { return locationHref; },
        set: function (value) { locationHref = value; navigations.push(value); }
    });
    const document = {
        getElementById: function (id) {
            if (id === '_swRefreshBtn') return { addEventListener: function () {}, textContent: '', disabled: false };
            return null;
        },
        createElement: function () { return { style: {}, innerHTML: '', id: '' }; },
        body: { appendChild: function (el) { banners.push(el); } }
    };
    const sandbox = {
        navigator: {
            serviceWorker: {
                controller: hadController ? { scriptURL: '/sw.js' } : null,
                addEventListener: function (type, fn) {
                    (swListeners[type] = swListeners[type] || []).push(fn);
                },
                register: function () {
                    return Promise.resolve({
                        addEventListener: function () {},
                        update: function () {}
                    });
                },
                getRegistrations: function () { return Promise.resolve([]); }
            }
        },
        document: document,
        location: location,
        setInterval: function () { return 1; },
        Promise: Promise,
        window: null
    };
    sandbox.window = {
        addEventListener: function (type, fn) {
            (windowListeners[type] = windowListeners[type] || []).push(fn);
        },
        innerWidth: 400,
        location: location
    };
    vm.runInNewContext(extractSwBoot(html), sandbox);
    (windowListeners.load || []).forEach(function (fn) { fn(); });
    return { reloads: reloads, navigations: navigations, banners: banners, swListeners: swListeners };
}

const queue = [];

queue.push(test('index.html and 404.html stay byte-identical', function () {
    assert.strictEqual(read('index.html'), read('404.html'));
}));

queue.push(test('a fresh localStorage does not trigger reload', async function () {
    const result = runNuke({}, {});
    await flush();
    assert.strictEqual(result.timeouts.length, 0);
    assert.strictEqual(result.reloads.length, 0);
    assert.strictEqual(result.keysCalls(), 0);
    assert.strictEqual(result.regCalls(), 0);
    assert.strictEqual(result.deleted.length, 0);
    assert.strictEqual(result.unregistered.length, 0);
    assert.strictEqual(result.storage.btc_build, '20260405e');
    assert.strictEqual(result.session._cnuke, undefined);
    assert.deepStrictEqual(result.sets, ['btc_build=20260405e']);
}));

queue.push(test('an old btc_build still nukes once and the session guard holds', async function () {
    const result = runNuke({ btc_build: '20260301a' }, {});
    assert.strictEqual(result.timeouts.length, 1);
    assert.strictEqual(result.timeouts[0].ms, 500);
    assert.strictEqual(result.session._cnuke, '1');
    assert.strictEqual(result.storage.btc_build, '20260405e');
    result.timeouts[0].fn();
    assert.strictEqual(result.reloads.length, 1);
    await flush();
    assert.deepStrictEqual(result.deleted, ['btc-archive-old']);
    assert.strictEqual(result.unregistered.length, 1);

    const guarded = runNuke({ btc_build: '20260301a' }, { _cnuke: '1' });
    await flush();
    assert.strictEqual(guarded.timeouts.length, 0);
    assert.strictEqual(guarded.reloads.length, 0);
    assert.strictEqual(guarded.keysCalls(), 0);
    assert.strictEqual(guarded.storage.btc_build, '20260301a');
}));

queue.push(test('the current build does not nuke', async function () {
    const result = runNuke({ btc_build: '20260405e' }, {});
    await flush();
    assert.strictEqual(result.timeouts.length, 0);
    assert.strictEqual(result.reloads.length, 0);
    assert.strictEqual(result.keysCalls(), 0);
    assert.deepStrictEqual(result.sets, []);
}));

queue.push(test('service worker controllerchange does not reload a first install', async function () {
    const html = read('index.html');
    const handlerAt = html.indexOf("navigator.serviceWorker.addEventListener('controllerchange'");
    const handler = html.slice(handlerAt, html.indexOf('navigator.serviceWorker.register', handlerAt));
    assert.ok(handler.includes('if (!hadController) return'));
    assert.ok(!handler.includes('location.reload'));
    assert.ok(html.includes('if (!newWorker || !hadController) return'));

    const fresh = runSwBoot(false);
    assert.ok(fresh.swListeners.controllerchange && fresh.swListeners.controllerchange.length === 1);
    fresh.swListeners.controllerchange[0]();
    await flush();
    assert.strictEqual(fresh.reloads.length, 0);
    assert.strictEqual(fresh.navigations.length, 0);
    assert.strictEqual(fresh.banners.length, 0);

    const returning = runSwBoot(true);
    returning.swListeners.controllerchange[0]();
    await flush();
    assert.strictEqual(returning.reloads.length, 0);
    assert.strictEqual(returning.navigations.length, 0);
    assert.strictEqual(returning.banners.length, 1);
}));

Promise.all(queue).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
