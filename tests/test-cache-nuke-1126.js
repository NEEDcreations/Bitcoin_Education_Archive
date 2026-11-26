// One-time cache nuke (April 2026 SW change) must not reload a brand-new
// profile, must still purge a stale client, and must wait while signup is open.
// Speed v2715 run: the unconditional reload wiped an early Sign up tap.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let passed = 0, failed = 0;
const queue = [];
function test(name, fn) {
    queue.push(Promise.resolve().then(fn).then(function () { passed++; console.log('✅ ' + name); }, function (e) { failed++; console.log('❌ ' + name + ': ' + e.message); }));
}
const start = html.indexOf('// One-time cache nuke for the SW strategy change (April 2026)');
const end = html.indexOf('})();', start) + 5;
const src = html.slice(start, end);

function run(opts) {
    const ls = Object.assign({}, opts.local || {});
    const ss = Object.assign({}, opts.session || {});
    const calls = { reload: 0, deleted: [], unregistered: 0 };
    const open = { usernameModal: !!opts.modalOpen };
    const timers = [];
    const intervals = [];
    const sandbox = {
        location: { href: 'https://x.test/', reload: function () { calls.reload++; } },
        history: { replaceState: function () {} },
        sessionStorage: { getItem: function (k) { return k in ss ? ss[k] : null; }, setItem: function (k, v) { ss[k] = String(v); } },
        localStorage: { getItem: function (k) { return k in ls ? ls[k] : null; }, setItem: function (k, v) { ls[k] = String(v); } },
        caches: { keys: function () { return Promise.resolve(opts.keys || []); }, delete: function (n) { calls.deleted.push(n); return Promise.resolve(true); } },
        navigator: { serviceWorker: { getRegistrations: function () { return Promise.resolve((opts.regs || 0) ? [{ unregister: function () { calls.unregistered++; return Promise.resolve(true); } }] : []); } } },
        document: { getElementById: function (id) { return open[id] ? { classList: { contains: function (c) { return c === 'open'; } } } : null; } },
        setTimeout: function (fn) { timers.push(fn); return timers.length; },
        setInterval: function (fn) { intervals.push(fn); return intervals.length; },
        clearInterval: function (id) { intervals[id - 1] = null; },
        Promise: Promise
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);
    async function settle() {
        for (let i = 0; i < 10; i++) {
            await new Promise(function (r) { setImmediate(r); });
            const fns = timers.splice(0, timers.length);
            fns.forEach(function (f) { f(); });
            intervals.slice().forEach(function (f) { if (f) f(); });
        }
    }
    return { calls, ls, ss, open, settle };
}

test('the old unconditional reload is gone and the guard is present', function () {
    assert.ok(src.length > 200);
    assert.ok(src.includes('if (!keys.length && !regs.length) return;'));
    assert.ok(!/setTimeout\(function\(\)\{ if \(location\.href !== _href\) history\.replaceState\(null, '', _href\); location\.reload\(\); \}, 500\);/.test(src));
    assert.strictEqual(html, fs.readFileSync(path.join(root, '404.html'), 'utf8'));
});

test('brand-new profile: flags set, nothing purged, no reload', async function () {
    const r = run({});
    await r.settle();
    assert.strictEqual(r.calls.reload, 0);
    assert.strictEqual(r.calls.deleted.length, 0);
    assert.strictEqual(r.ls.btc_build, '20260405e');
    assert.strictEqual(r.ss._cnuke, '1');
});

test('stale client with old caches and an old SW: purged and reloaded once', async function () {
    const r = run({ keys: ['btc-archive-v2400'], regs: 1 });
    await r.settle();
    assert.deepStrictEqual(r.calls.deleted, ['btc-archive-v2400']);
    assert.strictEqual(r.calls.unregistered, 1);
    assert.strictEqual(r.calls.reload, 1);
});

test('stale client with the signup modal open: reload waits until it closes', async function () {
    const r = run({ keys: ['btc-archive-v2400'], modalOpen: true });
    await r.settle();
    assert.strictEqual(r.calls.reload, 0);
    r.open.usernameModal = false;
    await r.settle();
    assert.strictEqual(r.calls.reload, 1);
});

test('already-current client: no work at all', async function () {
    const r = run({ local: { btc_build: '20260405e' }, keys: ['btc-archive-v2716'], regs: 1 });
    await r.settle();
    assert.strictEqual(r.calls.reload, 0);
    assert.strictEqual(r.calls.deleted.length, 0);
});

Promise.all(queue).then(function () {
    console.log(passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
});
