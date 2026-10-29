// Optimistic profile paint: IndexedDB uid must match the profile cache.
// A mismatch, null, or sign-out clears the paint and the cache. needs2fa stays hidden.
// The paint is display-only: no rewards or callables.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0;
let failed = 0;
const pending = [];
function test(name, fn) {
    const done = fn();
    if (done && typeof done.then === 'function') {
        pending.push(done.then(function () { console.log('✅ ' + name); passed++; }, function (e) {
            console.log('❌ ' + name + ': ' + (e && e.stack || e));
            failed++;
        }));
        return;
    }
    console.log('✅ ' + name);
    passed++;
}

const UID = 'fakeUid123456';
const OTHER = 'otherUid999999';
const NAME = 'CachePleb';

function memStore(seed) {
    const data = Object.assign({}, seed || {});
    return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
        setItem: function (k, v) { data[k] = String(v); },
        removeItem: function (k) { delete data[k]; },
        key: function (i) { return Object.keys(data)[i] || null; },
        get length() { return Object.keys(data).length; }
    };
}

function makeEl(id) {
    const el = {
        id: id || '',
        style: {},
        attrs: {},
        className: '',
        textContent: '',
        innerHTML: '',
        children: [],
        setAttribute: function (k, v) { this.attrs[k] = String(v); },
        getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
        removeAttribute: function (k) { delete this.attrs[k]; },
        appendChild: function (child) { this.children.push(child); return child; },
        insertBefore: function (child) { return this.appendChild(child); },
        querySelector: function (sel) {
            if (sel === '.rank-info' && this.innerHTML.indexOf('rank-info') !== -1) return { textContent: this.innerHTML };
            return null;
        },
        querySelectorAll: function () { return []; },
        addEventListener: function () {},
        removeEventListener: function () {}
    };
    const classes = {};
    el.classList = {
        add: function (c) { classes[c] = 1; },
        remove: function (c) { delete classes[c]; },
        toggle: function (c, on) {
            const use = arguments.length > 1 ? on : !classes[c];
            if (use) classes[c] = 1; else delete classes[c];
            return !!classes[c];
        },
        contains: function (c) { return !!classes[c]; }
    };
    return el;
}

function cacheRecord(extra) {
    const data = Object.assign({
        username: NAME,
        points: 2500,
        pointsClaimed: 0,
        pointsDonated: 0,
        pointsExchanged: 0,
        satsWithdrawn: 0,
        totpEnabled: false,
        streak: 3
    }, (extra && extra.data) || {});
    const rec = {
        uid: (extra && extra.uid) || UID,
        ts: Date.now() - (10 * 86400000),
        data: data
    };
    if (!extra || !Object.prototype.hasOwnProperty.call(extra, 'omitTwoFa')) rec.twoFa = extra && Object.prototype.hasOwnProperty.call(extra, 'twoFa') ? extra.twoFa : false;
    return rec;
}

function boot() {
    const calls = [];
    const nodes = {};
    function byId(id) {
        if (!nodes[id]) nodes[id] = makeEl(id);
        return nodes[id];
    }
    const doc = {
        readyState: 'loading',
        hidden: true,
        body: byId('body'),
        documentElement: byId('html'),
        getElementById: function (id) { return nodes[id] || null; },
        createElement: function () { return makeEl('el'); },
        querySelector: function () { return null; },
        querySelectorAll: function () { return []; },
        addEventListener: function () {},
        removeEventListener: function () {}
    };
    byId('authBtn');
    byId('rankBar');
    byId('homeSatsValue');
    byId('userDisplay');
    const authObj = {
        currentUser: null,
        isSignInWithEmailLink: function () { return false; },
        onAuthStateChanged: function () { return function () {}; },
        signInAnonymously: function () { return Promise.resolve(); },
        signOut: function () { return Promise.resolve(); }
    };
    function docRef() {
        return {
            get: function () { return Promise.resolve({ exists: false, data: function () { return {}; } }); },
            update: function () { return Promise.resolve(); },
            set: function () { return Promise.resolve(); },
            delete: function () { return Promise.resolve(); },
            collection: function () { return { doc: docRef }; }
        };
    }
    const sandbox = {
        console: console,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval,
        Promise: Promise,
        Date: Date,
        Math: Math,
        JSON: JSON,
        Object: Object,
        Array: Array,
        String: String,
        Number: Number,
        Boolean: Boolean,
        RegExp: RegExp,
        Error: Error,
        parseInt: parseInt,
        parseFloat: parseFloat,
        isNaN: isNaN,
        isFinite: isFinite,
        encodeURIComponent: encodeURIComponent,
        decodeURIComponent: decodeURIComponent,
        Uint8Array: Uint8Array,
        Map: Map,
        Set: Set,
        document: doc,
        navigator: { userAgent: 'Mozilla/5.0' },
        location: { href: 'http://127.0.0.1/', pathname: '/', hash: '', origin: 'http://127.0.0.1', search: '' },
        history: { pushState: function () {}, replaceState: function () {} },
        localStorage: memStore(),
        sessionStorage: memStore(),
        fetch: function () { return Promise.reject(new Error('offline')); },
        innerWidth: 1200,
        FIREBASE_CONFIG: { apiKey: 'test-api-key-123' },
        firebase: {
            apps: [{}],
            initializeApp: function () {},
            appCheck: function () { return { activate: function () {} }; },
            firestore: function () {
                const db = { collection: function () { return { doc: docRef }; } };
                return db;
            },
            auth: function () { return authObj; },
            functions: function () {
                return {
                    httpsCallable: function (name) {
                        return function () {
                            calls.push(name);
                            return Promise.resolve({ data: {} });
                        };
                    }
                };
            }
        },
        calls: calls,
        authUser: authObj
    };
    sandbox.firebase.firestore.FieldValue = { serverTimestamp: function () { return {}; }, increment: function () { return {}; } };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;
    sandbox.window.auth = authObj;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'ranking.js'), 'utf8'), sandbox, { filename: 'ranking.js' });
    sandbox.initRanking();
    return { sandbox: sandbox, nodes: nodes, calls: calls, authObj: authObj };
}

function seed(env, rec) {
    env.nodes.rankBar.innerHTML = '';
    env.nodes.rankBar.textContent = '';
    env.nodes.rankBar.attrs = {};
    env.nodes.authBtn.innerHTML = '';
    env.nodes.authBtn.textContent = '';
    env.nodes.homeSatsValue.textContent = '—';
    env.nodes.homeSatsValue.attrs = {};
    env.sandbox.localStorage.setItem('btc_profile_cache', JSON.stringify(rec));
}

const env = boot();

test('matching uid paints a stale cache and does not call rewards', function () {
    seed(env, cacheRecord());
    const before = env.calls.length;
    assert.strictEqual(env.sandbox.considerOptimisticProfile(UID), true);
    const bar = env.nodes.rankBar.innerHTML;
    assert.ok(bar.indexOf('rank-info') !== -1, bar);
    assert.ok(bar.indexOf(NAME) !== -1, bar);
    assert.ok(bar.indexOf('Maxi') !== -1, bar);
    assert.ok(bar.indexOf('2,500') !== -1 || bar.indexOf('2500') !== -1, bar);
    assert.strictEqual(env.nodes.rankBar.getAttribute('data-profile-cache'), '1');
    assert.strictEqual(env.nodes.rankBar.getAttribute('data-auth-live'), null);
    assert.strictEqual(env.nodes.homeSatsValue.textContent, '250');
    assert.strictEqual(env.nodes.homeSatsValue.getAttribute('data-profile-cache'), '1');
    assert.ok(env.nodes.authBtn.innerHTML.indexOf('Settings') !== -1, env.nodes.authBtn.innerHTML);
    assert.ok(env.nodes.authBtn.innerHTML.indexOf(NAME) !== -1);
    assert.strictEqual(env.sandbox._optimisticProfileUid, UID);
    env.sandbox.awardPoints(25, 'should not grant');
    assert.strictEqual(env.calls.length, before);
    assert.ok(env.sandbox.localStorage.getItem('btc_profile_cache').indexOf(NAME) !== -1);
});

test('a different uid does not paint the cached profile', function () {
    seed(env, cacheRecord());
    env.nodes.rankBar.innerHTML = '';
    assert.strictEqual(env.sandbox.considerOptimisticProfile(OTHER), false);
    assert.strictEqual(env.nodes.rankBar.innerHTML.indexOf(NAME), -1);
    assert.strictEqual(env.sandbox.profileCacheReadyForDisplay(OTHER), null);
    assert.ok(env.sandbox.profileCacheReadyForDisplay(UID));
});

test('sign-out and a uid mismatch clear the optimistic profile and the cache', function () {
    seed(env, cacheRecord());
    assert.strictEqual(env.sandbox.considerOptimisticProfile(UID), true);
    const signedOut = env.sandbox.reconcileOptimisticAuth(null, false);
    assert.strictEqual(signedOut.action, 'signed-out');
    assert.strictEqual(env.sandbox.localStorage.getItem('btc_profile_cache'), null);
    assert.strictEqual(env.nodes.rankBar.innerHTML.indexOf(NAME), -1);
    assert.strictEqual(env.nodes.homeSatsValue.textContent, '—');
    assert.ok(env.nodes.authBtn.innerHTML.indexOf(NAME) === -1);

    seed(env, cacheRecord());
    assert.strictEqual(env.sandbox.considerOptimisticProfile(UID), true);
    const mismatch = env.sandbox.reconcileOptimisticAuth({ uid: OTHER, isAnonymous: false }, false);
    assert.strictEqual(mismatch.action, 'mismatch');
    assert.strictEqual(env.sandbox.localStorage.getItem('btc_profile_cache'), null);
    assert.strictEqual(env.nodes.rankBar.innerHTML.indexOf(NAME), -1);
    assert.strictEqual(env.nodes.homeSatsValue.textContent, '—');
});

test('needs2fa and an unknown flag stay hidden', function () {
    seed(env, cacheRecord({ twoFa: true, data: { username: NAME, points: 2500, totpEnabled: true } }));
    assert.strictEqual(env.sandbox.considerOptimisticProfile(UID), false);
    assert.strictEqual(env.nodes.rankBar.innerHTML.indexOf(NAME), -1);
    assert.ok(env.nodes.authBtn.innerHTML.indexOf('Settings') === -1);

    seed(env, cacheRecord({ omitTwoFa: true, data: { username: NAME, points: 2500 } }));
    const raw = JSON.parse(env.sandbox.localStorage.getItem('btc_profile_cache'));
    delete raw.twoFa;
    delete raw.data.totpEnabled;
    env.sandbox.localStorage.setItem('btc_profile_cache', JSON.stringify(raw));
    assert.strictEqual(env.sandbox.profileCacheReadyForDisplay(UID), null);
    assert.strictEqual(env.sandbox.considerOptimisticProfile(UID), false);
    assert.strictEqual(env.nodes.rankBar.innerHTML.indexOf(NAME), -1);
});

test('IndexedDB uid is the gate and a stale cache still paints', async function () {
    seed(env, cacheRecord());
    env.nodes.rankBar.innerHTML = '';
    env.sandbox.indexedDB = {
        open: function () {
            var req = {};
            setTimeout(function () {
                req.result = {
                    objectStoreNames: { contains: function (n) { return n === 'firebaseLocalStorage'; } },
                    close: function () {},
                    transaction: function () {
                        return {
                            objectStore: function () {
                                return {
                                    get: function () {
                                        var getReq = {};
                                        setTimeout(function () {
                                            getReq.result = { value: { uid: UID } };
                                            if (getReq.onsuccess) getReq.onsuccess();
                                        }, 0);
                                        return getReq;
                                    }
                                };
                            }
                        };
                    }
                };
                if (req.onsuccess) req.onsuccess();
            }, 0);
            return req;
        }
    };
    const uid = await env.sandbox.readPersistedAuthUid();
    assert.strictEqual(uid, UID);
    assert.strictEqual(env.sandbox.considerOptimisticProfile(uid), true);
    assert.ok(env.nodes.rankBar.innerHTML.indexOf(NAME) !== -1);
    const tenDays = JSON.parse(env.sandbox.localStorage.getItem('btc_profile_cache'));
    assert.ok(Date.now() - tenDays.ts > 86400000);
});

test('loadUser does not await a forced token refresh before the profile UI', function () {
    const src = fs.readFileSync(path.join(__dirname, '..', 'ranking.js'), 'utf8');
    assert.strictEqual(src.indexOf('await auth.currentUser.getIdTokenResult(true)'), -1);
    assert.strictEqual(src.indexOf('(Date.now() - _cp.ts) < 86400000'), -1);
    const init = src.slice(src.indexOf('function initRanking'), src.indexOf('auth.onAuthStateChanged'));
    assert.ok(init.indexOf('startOptimisticProfilePaint()') !== -1);
    const cb = src.slice(src.indexOf('auth.onAuthStateChanged(user =>'), src.indexOf('auth.onAuthStateChanged(user =>') + 900);
    assert.ok(cb.indexOf('reconcileOptimisticAuth(user, _pendingRedirect)') !== -1);
    const load = src.slice(src.indexOf('async function loadUser'), src.indexOf('function homeSignedInNow'));
    assert.ok(load.indexOf('settleAdminClaim()') !== -1);
    assert.ok(load.indexOf('settleAdminClaim()') < load.indexOf('updateRankUI()'));
    const settle = src.slice(src.indexOf('function settleAdminClaim'), src.indexOf('async function loadUser'));
    assert.ok(settle.indexOf('getIdTokenResult()') !== -1);
    assert.ok(settle.indexOf('getIdTokenResult(true)') !== -1);
    assert.strictEqual(settle.indexOf('await '), -1);
    assert.ok(src.indexOf('optimisticProfilePending()') !== -1);
});

Promise.all(pending).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
});
