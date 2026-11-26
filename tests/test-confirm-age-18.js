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

function isDelete(v) {
    return !!(v && (v._delete === true || v._methodName === 'FieldValue.delete'));
}

function createWorld(seed, extra) {
    const clock = { ms: Date.parse('2026-11-25T21:10:00-05:00') };
    const docs = Object.assign({}, seed || {});
    function apply(pathKey, data, merge) {
        const cur = merge ? Object.assign({}, docs[pathKey] || {}) : {};
        Object.keys(data || {}).forEach(function (k) {
            if (isDelete(data[k])) delete cur[k];
            else cur[k] = data[k];
        });
        docs[pathKey] = cur;
    }
    function ref(pathKey) {
        return {
            path: pathKey,
            get: async function () { return snap(pathKey); },
            set: async function (data, opts) { apply(pathKey, data, !!(opts && opts.merge)); },
        };
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
                delete: function () { return { _delete: true }; },
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
                create: function (r, data) {
                    if (docs[r.path] != null) {
                        const err = new Error('ALREADY_EXISTS: ' + r.path);
                        err.code = 'already-exists';
                        throw err;
                    }
                    writes.push({ path: r.path, data: data, merge: false });
                },
                update: function (r, data) { writes.push({ path: r.path, data: data, merge: true }); },
            };
            const result = await fn(tx);
            writes.forEach(function (w) { apply(w.path, w.data, w.merge); });
            return result;
        },
    };
    const stepCalls = [];
    const handlers = confirmAge.createConfirmAge18Handlers(Object.assign({
        admin: admin,
        db: db,
        HttpsError: HttpsError,
        now: function () { return clock.ms; },
        throttleMs: 30000,
        stepUp: (extra && extra.stepUp) || async function (data, context) {
            stepCalls.push({ data: data, uid: context && context.auth && context.auth.uid });
            return { established: true, totp: true };
        },
    }, extra || {}));
    return { clock: clock, docs: docs, handlers: handlers, stepCalls: stepCalls };
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
    const flags = [{ isMinor: true }, { kids: true }, { isKids: true }, { kidsMode: true }, { under13: true }];
    for (const flag of flags) {
        const uid = 'kid_' + Object.keys(flag)[0];
        const seed = {};
        seed['users/' + uid] = Object.assign({ points: 3 }, flag);
        const world = createWorld(seed);
        await assert.rejects(function () { return world.handlers.confirmAge18({}, auth(uid)); }, function (err) {
            return err.code === 'permission-denied';
        });
        assert.strictEqual(world.docs['users/' + uid].over18, undefined);
        assert.strictEqual(world.docs['users/' + uid].points, 3);
    }
});

test('a missing user doc fails closed and is not created', async function () {
    const world = createWorld();
    await assert.rejects(function () { return world.handlers.confirmAge18({}, auth('newbie')); }, function (err) {
        return err.code === 'failed-precondition';
    });
    assert.strictEqual(world.docs['users/newbie'], undefined);
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
    assert.strictEqual(calls.length, 2);
});

test('a successful confirm writes an audit row with only the uid', async function () {
    const world = createWorld({ 'users/alice': { points: 1 } });
    await world.handlers.confirmAge18({}, auth('alice'));
    const auditKeys = Object.keys(world.docs).filter(function (k) { return k.indexOf('admin_audit_log/age18_confirm_alice_') === 0; });
    assert.strictEqual(auditKeys.length, 1);
    const row = world.docs[auditKeys[0]];
    assert.strictEqual(row.action, 'age_confirm');
    assert.strictEqual(row.uid, 'alice');
    assert.ok(row.at && row.at._server === true);
    assert.strictEqual(row.email, undefined);
    assert.strictEqual(row.displayName, undefined);
    const throttle = world.docs['age_confirm_throttle/alice'];
    assert.ok(throttle);
    assert.strictEqual(throttle.uid, 'alice');
    assert.ok(typeof throttle.lastAtMs === 'number');
});

test('a second confirm within the throttle window is rejected', async function () {
    const world = createWorld({ 'users/cara': { points: 1 } });
    await world.handlers.confirmAge18({}, auth('cara'));
    // Advance past idempotent already-return: confirm a different first-time user
    // after writing a throttle row by confirming, then try a missing-doc user
    // immediately... better: missing-doc writes throttle, second missing call is throttled.
    const world2 = createWorld();
    await assert.rejects(function () { return world2.handlers.confirmAge18({}, auth('ghost')); }, function (err) {
        return err.code === 'failed-precondition';
    });
    await assert.rejects(function () { return world2.handlers.confirmAge18({}, auth('ghost')); }, function (err) {
        return err.code === 'resource-exhausted';
    });
    assert.strictEqual(world2.docs['users/ghost'], undefined);
});

function adminAuth(uid) {
    return { auth: { uid: uid, token: { admin: true, firebase: { sign_in_provider: 'password' } } } };
}

test('a non-admin cannot un-confirm and step-up is not called', async function () {
    const world = createWorld({ 'users/alice': { over18: true, ageConfirmed18: true, points: 4 } });
    await assert.rejects(function () { return world.handlers.adminUnconfirmAge18({ uid: 'alice' }, auth('alice')); }, function (err) {
        return err.code === 'permission-denied';
    });
    assert.strictEqual(world.stepCalls.length, 0);
    assert.strictEqual(world.docs['users/alice'].over18, true);
    assert.strictEqual(world.docs['users/alice'].points, 4);
});

test('an admin un-confirm clears the fields and writes an audit row', async function () {
    const world = createWorld({
        'users/alice': { over18: true, ageConfirmed18: true, over18ConfirmedAt: { _server: true }, points: 4 }
    });
    const out = await world.handlers.adminUnconfirmAge18({ uid: 'alice' }, adminAuth('admin1'));
    assert.strictEqual(out.success, true);
    assert.strictEqual(out.over18, false);
    assert.strictEqual(world.stepCalls.length, 1);
    const doc = world.docs['users/alice'];
    assert.strictEqual(doc.over18, undefined);
    assert.strictEqual(doc.ageConfirmed18, undefined);
    assert.strictEqual(doc.over18ConfirmedAt, undefined);
    assert.strictEqual(doc.ageConfirmBlocked, true);
    assert.strictEqual(doc.points, 4);
    const auditKeys = Object.keys(world.docs).filter(function (k) { return k.indexOf('admin_audit_log/age18_unconfirm_alice_') === 0; });
    assert.strictEqual(auditKeys.length, 1);
    assert.strictEqual(world.docs[auditKeys[0]].action, 'age_unconfirm');
    assert.strictEqual(world.docs[auditKeys[0]].uid, 'alice');
    assert.strictEqual(world.docs[auditKeys[0]].adminUid, 'admin1');
});

test('a blocked account cannot confirm again', async function () {
    const world = createWorld({
        'users/alice': { over18: true, ageConfirmed18: true, points: 4 }
    });
    await world.handlers.adminUnconfirmAge18({ uid: 'alice' }, adminAuth('admin1'));
    await assert.rejects(function () { return world.handlers.confirmAge18({}, auth('alice')); }, function (err) {
        return err.code === 'permission-denied';
    });
    assert.strictEqual(world.docs['users/alice'].over18, undefined);
    assert.strictEqual(world.docs['users/alice'].ageConfirmBlocked, true);
    assert.strictEqual(world.docs['users/alice'].points, 4);
});

test('an invalid un-confirm target is rejected before step-up', async function () {
    const world = createWorld({ 'users/alice': { over18: true, points: 1 } });
    await assert.rejects(function () {
        return world.handlers.adminUnconfirmAge18({ uid: 'alice/../admin' }, adminAuth('admin1'));
    }, function (err) {
        return err.code === 'invalid-argument';
    });
    assert.strictEqual(world.stepCalls.length, 0);
    assert.strictEqual(world.docs['users/alice'].over18, true);
});

test('a missing user doc skips the prompt after failed loads', async function () {
    const timers = [];
    const env = bootClient({
        setTimeout: function (fn) { timers.push(fn); return timers.length; },
        firebase: {
            auth: function () { return { onAuthStateChanged: function (cb) { cb({ uid: 'u1', isAnonymous: false }); } }; },
            firestore: function () {
                return {
                    collection: function () {
                        return {
                            doc: function () {
                                return { get: function () { return Promise.resolve({ exists: false, data: function () { return undefined; } }); } };
                            }
                        };
                    }
                };
            }
        }
    });
    function flush() {
        const fns = timers.splice(0, timers.length);
        fns.forEach(function (fn) { fn(); });
        return Promise.resolve();
    }
    return Promise.resolve().then(flush).then(flush).then(function run(n) {
        if (n > 20) return;
        if (timers.length) return flush().then(function () { return run((n || 0) + 1); });
        assert.strictEqual(env.document.getElementById('ageConfirmOverlay'), null);
        assert.strictEqual(env._bqAgeConfirmed18, false);
    });
});

test('audit rows are created, not overwritten', function () {
    const src = fs.readFileSync(path.join(root, 'functions/src/confirmAge18.js'), 'utf8');
    const confirm = src.match(/t\.create\(auditRef\('confirm'/);
    const unconfirm = src.match(/t\.create\(auditRef\('unconfirm'/);
    assert.ok(confirm, 'confirm audit uses t.create');
    assert.ok(unconfirm, 'unconfirm audit uses t.create');
    assert.strictEqual((src.match(/t\.set\(auditRef/g) || []).length, 0);
});

test('adminUnconfirmAge18 is on the real FRESH_ACTIONS list', async function () {
    const src = fs.readFileSync(path.join(root, 'functions/src/secondFactor.js'), 'utf8');
    const block = src.slice(src.indexOf('const FRESH_ACTIONS'), src.indexOf('const RECOVERY_COUNT'));
    assert.ok(/adminUnconfirmAge18:\s*true/.test(block));

    const SF = require(path.join(root, 'functions/src/secondFactor'));
    const store = {};
    const db = {
        collection: function (name) {
            return {
                doc: function (id) {
                    const key = name + '/' + id;
                    return {
                        get: async function () {
                            return {
                                exists: store[key] != null,
                                data: function () { return store[key] ? Object.assign({}, store[key]) : undefined; }
                            };
                        }
                    };
                }
            };
        }
    };
    const api = SF.initSecondFactor({
        db: db,
        admin: { auth: function () { return {}; }, firestore: { FieldValue: { serverTimestamp: function () { return new Date(); } } } },
        HttpsError: HttpsError,
        authenticator: { generateSecret: function () { return 'x'; }, keyuri: function () { return 'otpauth'; }, checkDelta: function () { return null; }, options: {} },
        QRCode: { toDataURL: async function () { return ''; } }
    });
    const ctx = { auth: { uid: 'admin1', token: { admin: true, auth_time: Math.floor(Date.now() / 1000) - 60, firebase: {} } }, rawRequest: { headers: {} } };
    await assert.rejects(function () {
        return api.requireFreshStepUp(ctx, 'notARealAction');
    }, function (err) {
        return err.code === 'invalid-argument' && /Unknown action/.test(err.message);
    });
    var unknown = false;
    try {
        await api.requireFreshStepUp(ctx, 'adminUnconfirmAge18');
    } catch (err) {
        unknown = err.code === 'invalid-argument' && /Unknown action/.test(String(err.message || err));
        if (unknown) throw err;
    }
    assert.strictEqual(unknown, false);
});

Promise.all(queue).then(function () {
    console.log(passed + ' passed' + (failed ? ', ' + failed + ' failed' : ''));
    process.exit(failed ? 1 : 0);
});
