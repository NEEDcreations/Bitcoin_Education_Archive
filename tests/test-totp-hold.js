// A stuck 2FA hold locks Settings and turns the guest button into another
// authenticator challenge. These cover the release paths: profile no longer
// has totpEnabled, a passing server check, and a session that ends without
// signOutUser.
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
        value: '',
        children: [],
        parentNode: null,
        classList: null,
        setAttribute: function (k, v) { this.attrs[k] = String(v); },
        getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
        removeAttribute: function (k) { delete this.attrs[k]; },
        appendChild: function (child) { child.parentNode = this; this.children.push(child); return child; },
        insertBefore: function (child) { return this.appendChild(child); },
        querySelector: function () { return null; },
        querySelectorAll: function () { return []; },
        addEventListener: function () {},
        removeEventListener: function () {},
        focus: function () {},
        click: function () { if (typeof this.onclick === 'function') this.onclick(); },
        remove: function () {}
    };
    const classes = {};
    el.classList = {
        add: function (c) { classes[c] = 1; },
        remove: function (c) { delete classes[c]; },
        toggle: function (c, on) { if (on) classes[c] = 1; else delete classes[c]; },
        contains: function (c) { return !!classes[c]; }
    };
    return el;
}

function page() {
    const nodes = {};
    function byId(id) {
        if (!nodes[id]) nodes[id] = makeEl(id);
        return nodes[id];
    }
    const modal = byId('usernameModal');
    const box = makeEl('username-box');
    box.className = 'username-box';
    modal.querySelector = function (sel) {
        if (sel === '.username-box') return box;
        return null;
    };
    const doc = {
        readyState: 'loading',
        hidden: true,
        title: '',
        body: byId('body'),
        documentElement: byId('html'),
        getElementById: function (id) { return nodes[id] || null; },
        createElement: function (tag) { return makeEl(tag); },
        querySelector: function () { return null; },
        querySelectorAll: function () { return []; },
        addEventListener: function () {},
        removeEventListener: function () {}
    };
    // The auth button and the settings modal exist on the real homepage.
    byId('authBtn');
    byId('usernameModal');
    return { doc: doc, nodes: nodes, modal: modal, box: box };
}

function boot(opts) {
    const ui = page();
    const resetHour = 5;
    const today = new Date(Date.now() - resetHour * 3600000).toISOString().split('T')[0];
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
    function firestore() {
        return { collection: function () { return { doc: docRef }; } };
    }
    firestore.FieldValue = { serverTimestamp: function () { return {}; } };
    const sandbox = {
        console: console,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval,
        requestAnimationFrame: function (fn) { return setTimeout(fn, 0); },
        cancelAnimationFrame: function (id) { clearTimeout(id); },
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
        Symbol: Symbol,
        document: ui.doc,
        navigator: { userAgent: 'Mozilla/5.0' },
        location: { href: 'http://127.0.0.1/', pathname: '/', hash: '', origin: 'http://127.0.0.1', search: '' },
        history: { pushState: function () {}, replaceState: function () {}, state: null },
        localStorage: memStore({
            btc_last_price: '64000',
            btc_price_ts: String(Date.now()),
            btc_last_height: '800000',
            btc_height_ts: String(Date.now())
        }),
        sessionStorage: memStore(),
        fetch: function () { return Promise.reject(new Error('offline')); },
        innerWidth: 1200,
        firebase: {
            apps: [{}],
            initializeApp: function () {},
            appCheck: function () { return { activate: function () {} }; },
            firestore: firestore,
            auth: function () { return authObj; }
        },
        authUser: authObj,
        challenges: 0
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;
    sandbox.window.auth = authObj;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'ranking.js'), 'utf8'), sandbox, { filename: 'ranking.js' });
    if (!opts || opts.init !== false) sandbox.initRanking();
    sandbox._showTotpSignInChallenge = function () { sandbox.challenges++; };
    sandbox._serverTotpAllows = async function () { return true; };
    return { sandbox: sandbox, ui: ui, today: today, authObj: authObj };
}

const rankingSrc = fs.readFileSync(path.join(__dirname, '..', 'ranking.js'), 'utf8');

test('server pass clears the hold even when totpEnabled is already false', function () {
    const gate = rankingSrc.indexOf('await window._serverTotpAllows');
    assert.ok(gate > 0);
    const after = rankingSrc.slice(gate, gate + 900);
    const clearAt = after.indexOf('clearTotpHold()');
    const noteAt = after.indexOf('noteTotpVerified(');
    assert.ok(clearAt > 0);
    assert.ok(noteAt > clearAt);
    const early = rankingSrc.slice(rankingSrc.indexOf('async function loadUser'), gate);
    assert.ok(early.indexOf('if (!currentUser.totpEnabled) clearTotpHold()') !== -1);
    const sync = rankingSrc.slice(rankingSrc.indexOf('function syncTotpVerified'), rankingSrc.indexOf('function syncTotpVerified') + 700);
    assert.ok(sync.indexOf('clearTotpHold()') !== -1);
});

test('hold then loadUser with totpEnabled false opens Settings and a signed-in button', async function () {
    const env = boot();
    const uid = 'userUid123456';
    env.authObj.currentUser = {
        uid: uid,
        isAnonymous: false,
        getIdTokenResult: async function () { return { claims: {} }; }
    };
    env.sandbox.noteTotpHold(uid);
    env.sandbox._btcTotpHold = true;
    assert.strictEqual(env.sandbox._btcTotpHold, true);
    const doc = {
        exists: true,
        data: function () {
            return {
                username: 'MeasurePleb',
                points: 2500,
                totpEnabled: false,
                tosVersion: '2026-10-23',
                lastVisit: env.today
            };
        }
    };
    await env.sandbox.loadUser(uid, doc);
    assert.strictEqual(env.sandbox._btcTotpHold, false, 'hold cleared');
    assert.strictEqual(env.sandbox.challenges, 0);
    const btn = env.ui.nodes.authBtn;
    assert.ok(String(btn.innerHTML).indexOf('Settings') !== -1, btn.innerHTML);
    assert.strictEqual(btn.getAttribute('data-auth-live'), '1');
    assert.strictEqual(btn.style.border, '2px solid #3b82f6');
    assert.strictEqual(btn.style.color, '#3b82f6');
    assert.ok(env.ui.doc.documentElement.classList.contains('home-signed-in'));
    env.sandbox.showSettingsPage('account');
    assert.ok(env.ui.modal.classList.contains('open'), 'settings modal opened');
    assert.strictEqual(env.sandbox.challenges, 0);
    btn.onclick();
    assert.strictEqual(env.sandbox.challenges, 0);
    assert.ok(env.ui.modal.classList.contains('open'));
});

test('signed-out auth state without signOutUser opens the sign-in prompt', async function () {
    const env = boot({ init: false });
    env.sandbox.noteTotpHold('userUid123456');
    env.sandbox.updateAuthButton();
    const btn = env.ui.nodes.authBtn;
    assert.strictEqual(btn.textContent, 'Create Free Account / Sign In');
    assert.strictEqual(env.sandbox._btcTotpHold, true);
    // Revoked or expired session: the auth listener runs, signOutUser does not.
    env.sandbox.syncTotpVerified(null);
    assert.strictEqual(env.sandbox._btcTotpHold, false);
    assert.strictEqual(env.sandbox._btcTotpHoldUid, '');
    btn.onclick();
    await Promise.resolve();
    await Promise.resolve();
    assert.strictEqual(env.sandbox.challenges, 0);
    assert.ok(env.ui.modal.classList.contains('open'), 'username prompt opened');
});

Promise.all(pending).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
