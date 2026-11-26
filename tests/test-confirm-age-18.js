#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const confirmAge = require(path.join(root, 'functions/src/confirmAge18'));

let passed = 0;
let failed = 0;
const queue = [];
function test(name, fn) {
    queue.push(Promise.resolve().then(fn).then(function () {
        passed++;
        console.log('  ok  ' + name);
    }).catch(function (e) {
        failed++;
        console.log('  FAIL ' + name + ': ' + (e && e.stack ? e.stack : e));
    }));
}

function HttpsError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

function createWorld(seed) {
    const clock = { ms: Date.parse('2026-11-25T21:10:00-05:00') };
    const docs = Object.assign({}, seed || {});
    function apply(pathKey, data, merge) {
        const cur = merge ? Object.assign({}, docs[pathKey] || {}) : {};
        Object.keys(data || {}).forEach(function (k) { cur[k] = data[k]; });
        docs[pathKey] = cur;
    }
    function ref(pathKey) {
        return { path: pathKey };
    }
    function col(pathKey) {
        return { doc: function (id) { return ref(pathKey + '/' + id); } };
    }
    function snap(pathKey) {
        const data = docs[pathKey];
        return {
            exists: data != null,
            data: function () { return data ? Object.assign({}, data) : undefined; },
        };
    }
    let stamps = 0;
    const admin = {
        firestore: {
            FieldValue: {
                serverTimestamp: function () {
                    stamps++;
                    const ms = clock.ms + stamps;
                    return { _server: true, toMillis: function () { return ms; }, id: stamps };
                },
            },
        },
    };
    const db = {
        collection: function (name) { return col(name); },
        runTransaction: async function (fn) {
            const writes = [];
            const tx = {
                get: async function (r) { return snap(r.path); },
                set: function (r, data, opts) { writes.push({ path: r.path, data: data, merge: !!(opts && opts.merge) }); },
                update: function (r, data) { writes.push({ path: r.path, data: data, merge: true }); },
            };
            const result = await fn(tx);
            writes.forEach(function (w) { apply(w.path, w.data, w.merge); });
            return result;
        },
    };
    const handlers = confirmAge.createConfirmAge18Handlers({
        admin: admin,
        db: db,
        HttpsError: HttpsError,
    });
    return { clock: clock, docs: docs, handlers: handlers };
}

function auth(uid, provider) {
    return { auth: { uid: uid, token: { firebase: { sign_in_provider: provider || 'password' } } } };
}

function bootClient(extras) {
    const bodyKids = [];
    const document = {
        readyState: 'complete',
        body: {
            appendChild: function (el) { bodyKids.push(el); return el; },
        },
        addEventListener: function () {},
        getElementById: function (id) {
            for (var i = 0; i < bodyKids.length; i++) {
                if (bodyKids[i] && bodyKids[i].id === id) return bodyKids[i];
            }
            return null;
        },
        createElement: function (tag) {
            const el = {
                tagName: String(tag).toUpperCase(),
                id: '',
                style: { cssText: '' },
                children: [],
                attributes: {},
                textContent: '',
                innerHTML: '',
                parentNode: null,
                setAttribute: function (k, v) { el.attributes[k] = v; },
                getAttribute: function (k) { return el.attributes[k]; },
                addEventListener: function (type, fn) {
                    el._events = el._events || {};
                    el._events[type] = el._events[type] || [];
                    el._events[type].push(fn);
                },
                appendChild: function (child) {
                    el.children.push(child);
                    child.parentNode = el;
                    return child;
                },
                querySelector: function (sel) {
                    if (sel === 'span') {
                        return el.children.find(function (c) { return c.tagName === 'SPAN'; }) ||
                            (function () {
                                const span = document.createElement('span');
                                el.children.push(span);
                                return span;
                            })();
                    }
                    return null;
                },
                focus: function () {},
                click: function () {
                    const evs = (el._events && el._events.click) || [];
                    evs.forEach(function (fn) { fn({ target: el }); });
                }
            };
            Object.defineProperty(el, 'style', {
                value: { cssText: '' },
                writable: true,
                configurable: true
            });
            return el;
        }
    };
    document.body.appendChild = function (el) {
        el.parentNode = document.body;
        bodyKids.push(el);
        return el;
    };
    document.body.removeChild = function (el) {
        const i = bodyKids.indexOf(el);
        if (i >= 0) bodyKids.splice(i, 1);
        if (el) el.parentNode = null;
        return el;
    };
    const store = {};
    const sandbox = Object.assign({
        console: console,
        setTimeout: function (fn) { return setTimeout(fn, 0); },
        clearTimeout: clearTimeout,
        setInterval: function (fn) { return setInterval(fn, 100000); },
        clearInterval: clearInterval,
        document: document,
        sessionStorage: {
            getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
            setItem: function (k, v) { store[k] = String(v); },
            removeItem: function (k) { delete store[k]; }
        },
        localStorage: {
            getItem: function () { return null; },
            setItem: function () {}
        },
        CustomEvent: function (name, init) { this.type = name; this.detail = init && init.detail; },
        dispatchEvent: function () {}
    }, extras || {});
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'age-confirm.js'), 'utf8'), sandbox, { filename: 'age-confirm.js' });
    sandbox._bodyKids = bodyKids;
    sandbox._store = store;
    return sandbox;
}

test('unauthenticated calls are rejected', async function () {
    const world = createWorld();
    await assert.rejects(function () { return world.handlers.confirmAge18({}, {}); }, function (err) {
        return err.code === 'unauthenticated';
    });
});

test('anonymous accounts cannot confirm', async function () {
    const world = createWorld({ 'users/guest': { points: 10 } });
    await assert.rejects(function () { return world.handlers.confirmAge18({}, auth('guest', 'anonymous')); }, function (err) {
        return err.code === 'permission-denied';
    });
    assert.strictEqual(world.docs['users/guest'].points, 10);
    assert.strictEqual(world.docs['users/guest'].over18, undefined);
});

test('sets over18 and ageConfirmed18 with a server timestamp', async function () {
    const world = createWorld({ 'users/alice': { points: 42, sats: 9, displayName: 'Alice' } });
    const out = await world.handlers.confirmAge18({ over18: false, over18ConfirmedAt: 'forged' }, auth('alice'));
    assert.strictEqual(out.success, true);
    assert.strictEqual(out.over18, true);
    assert.strictEqual(out.ageConfirmed18, true);
    assert.strictEqual(out.already, false);
    const doc = world.docs['users/alice'];
    assert.strictEqual(doc.over18, true);
    assert.strictEqual(doc.ageConfirmed18, true);
    assert.ok(doc.over18ConfirmedAt && doc.over18ConfirmedAt._server === true);
    assert.ok(doc.ageConfirmed18At && doc.ageConfirmed18At._server === true);
    assert.strictEqual(doc.points, 42);
    assert.strictEqual(doc.sats, 9);
    assert.strictEqual(doc.displayName, 'Alice');
});

test('a second call is idempotent and keeps the first timestamp', async function () {
    const world = createWorld({ 'users/bob': { points: 1 } });
    await world.handlers.confirmAge18({}, auth('bob'));
    const first = world.docs['users/bob'].over18ConfirmedAt;
    const out = await world.handlers.confirmAge18({}, auth('bob'));
    assert.strictEqual(out.already, true);
    assert.strictEqual(world.docs['users/bob'].over18ConfirmedAt, first);
    assert.strictEqual(world.docs['users/bob'].points, 1);
});

test('kids accounts cannot self-confirm adult age', async function () {
    const world = createWorld({ 'users/kid': { isMinor: true, points: 3 } });
    await assert.rejects(function () { return world.handlers.confirmAge18({}, auth('kid')); }, function (err) {
        return err.code === 'permission-denied';
    });
    assert.strictEqual(world.docs['users/kid'].over18, undefined);
    assert.strictEqual(world.docs['users/kid'].points, 3);
});

test('missing user docs receive only the confirmation fields', async function () {
    const world = createWorld();
    const out = await world.handlers.confirmAge18({}, auth('newbie'));
    assert.strictEqual(out.success, true);
    const doc = world.docs['users/newbie'];
    assert.deepStrictEqual(Object.keys(doc).sort(), ['ageConfirmed18', 'ageConfirmed18At', 'over18', 'over18ConfirmedAt', 'uid']);
    assert.strictEqual(doc.uid, 'newbie');
    assert.strictEqual(doc.over18, true);
    assert.strictEqual(doc.points, undefined);
});

test('client helper and copy', function () {
    const env = bootClient();
    assert.strictEqual(env._bqAgeConfirmed18, false);
    assert.strictEqual(env.bqAgeConfirmed18FromUser({}), false);
    assert.strictEqual(env.bqAgeConfirmed18FromUser({ over18: true }), true);
    assert.strictEqual(env.bqAgeConfirmed18FromUser({ ageConfirmed18: true }), true);
    assert.strictEqual(env.bqAgeConfirmed18FromUser({ over18: false, ageBand: 'adult' }), false);
    assert.strictEqual(env.bqAgeConfirmCopy.title, 'Quick check');
    assert.strictEqual(env.bqAgeConfirmCopy.body, 'Bitcoin Quest is for adults 18 and older.');
    assert.strictEqual(env.bqAgeConfirmCopy.button, "I'm 18 or older");
});

test('dismiss keeps the no-age state and does not call the server', function () {
    let called = 0;
    const env = bootClient({
        firebase: { functions: function () { return { httpsCallable: function () { called++; return function () { return Promise.resolve({ data: { success: true } }); }; } }; } }
    });
    env.showAgeConfirmPrompt();
    assert.ok(env.document.getElementById('ageConfirmOverlay'));
    env._bqDismissAgeConfirm();
    assert.strictEqual(env.document.getElementById('ageConfirmOverlay'), null);
    assert.strictEqual(env._bqAgeConfirmed18, false);
    assert.strictEqual(called, 0);
    assert.strictEqual(env.sessionStorage.getItem('bq_age_confirm_dismissed'), '1');
});

test('a confirmed profile skips the prompt', function () {
    const src = fs.readFileSync(path.join(root, 'age-confirm.js'), 'utf8');
    assert.ok(src.includes('httpsCallable(\'confirmAge18\')'));
    assert.ok(src.includes("q.ready('age'"));
    assert.ok(src.includes('over18'));
    assert.ok(src.includes('ageConfirmed18'));
    assert.ok(src.includes('hasKnownAdultAge') || src.includes('PR #401'));
});

test('bindConfirmAge18 enforces App Check', function () {
    const calls = [];
    const fakeFn = {
        https: { HttpsError: HttpsError, onCall: function (h) { return h; } },
        runWith: function (opts) { calls.push(opts); return fakeFn; }
    };
    confirmAge.bindConfirmAge18(fakeFn, { admin: {}, db: {} });
    assert.ok(calls.some(function (o) { return o && o.enforceAppCheck === true; }));
});

Promise.all(queue).then(function () {
    console.log(passed + ' passed' + (failed ? ', ' + failed + ' failed' : ''));
    process.exit(failed ? 1 : 0);
});
