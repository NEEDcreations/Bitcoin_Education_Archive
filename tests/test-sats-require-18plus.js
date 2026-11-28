#!/usr/bin/env node
'use strict';
// Sats require a confirmed 18+ answer (feat/sats-require-18plus, Nov 28 2026).
// Server: one shared check (functions/src/age18Sats.js) in claimSats,
// claimFavorBlock, claimCipherWin and claimCipherSats, before any reservation
// or payout. Client: re-shows the age prompt before a sats action and when a
// payout answers age_18_required; the guardian step cannot be skipped.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const gate = require(path.join(root, 'functions/src/age18Sats'));
const read = function (p) { return fs.readFileSync(path.join(root, p), 'utf8'); };

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

// ---------- shared server check ----------
test('confirmed 18+ (the fields confirmAge18 sets) may earn sats', function () {
    assert.deepStrictEqual(gate.assess({ over18: true, ageConfirmed18: true }), { ok: true });
    assert.deepStrictEqual(gate.assess({ over18: true }), { ok: true });
    assert.deepStrictEqual(gate.assess({ ageConfirmed18: true }), { ok: true });
});

test('no answer yet is refused with the code the client turns into the 18+ prompt', function () {
    [null, undefined, {}, { points: 5000 }, { over18: false, ageConfirmed18: false }, { over18: 'true' }, { over18: 1 }].forEach(function (u) {
        const v = gate.assess(u);
        assert.strictEqual(v.ok, false);
        assert.strictEqual(v.code, 'age_18_required');
        assert.strictEqual(v.reason, 'unconfirmed');
        assert.strictEqual(v.canConfirm, true);
        assert.strictEqual(v.error, "Confirm you're 18+ to earn sats.");
    });
});

test('under 18 with guardian OK is blocked from sats (runbook is silent, so fail closed)', function () {
    const v = gate.assess({ ageUnder18: true, guardianOk: true });
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.code, 'age_18_required');
    assert.strictEqual(v.reason, 'under18');
    assert.strictEqual(v.canConfirm, false);
    assert.strictEqual(gate.assess({ ageUnder18: true }).reason, 'under18');
});

test('a saved under-18 answer beats any confirm flag (conflicting data fails closed)', function () {
    assert.strictEqual(gate.assess({ ageUnder18: true, guardianOk: true, over18: true, ageConfirmed18: true }).ok, false);
});

test('an admin un-confirm (ageConfirmBlocked) and kids accounts stay blocked', function () {
    assert.strictEqual(gate.assess({ ageConfirmBlocked: true, over18: true }).reason, 'blocked');
    assert.strictEqual(gate.assess({ ageConfirmBlocked: true }).canConfirm, false);
    ['isMinor', 'under13', 'kids', 'isKids', 'kidsMode'].forEach(function (flag) {
        const u = { over18: true };
        u[flag] = true;
        const v = gate.assess(u);
        assert.strictEqual(v.ok, false, flag);
        assert.strictEqual(v.reason, 'kids');
    });
    assert.strictEqual(gate.assess({ over18: true, accountType: 'kids' }).ok, false);
});

test('responseFor and errorFor carry the code and reason, nothing else sensitive', function () {
    const v = gate.assess({});
    assert.deepStrictEqual(gate.responseFor(v), { success: false, code: 'age_18_required', reason: 'unconfirmed', error: "Confirm you're 18+ to earn sats." });
    function HttpsError(code, message, details) { const e = new Error(message); e.code = code; e.details = details; return e; }
    const err = gate.errorFor(HttpsError, v);
    assert.strictEqual(err.code, 'failed-precondition');
    assert.strictEqual(err.message, "Confirm you're 18+ to earn sats.");
    assert.deepStrictEqual(err.details, { code: 'age_18_required', reason: 'unconfirmed' });
});

// ---------- every payout path is wired, before money moves ----------
test('claimSats: early check and in-transaction check, both before the wallet', function () {
    const src = read('functions/index.js');
    assert.ok(src.includes("const age18Sats = require('./src/age18Sats');"));
    const start = src.indexOf('exports.claimSats = ');
    const end = src.indexOf('exports.', start + 20);
    const body = src.slice(start, end);
    assert.ok(body.includes('age18Sats.assess(userPreSnap.exists ? userPreSnap.data() : null)'));
    assert.ok(body.includes('return age18Sats.responseFor(preAge18);'));
    assert.ok(body.includes('const age18 = age18Sats.assess(user);'));
    assert.ok(body.includes('if (e && e.age18) return age18Sats.responseFor(e.age18);'));
    const pay = body.indexOf('payInvoice');
    assert.ok(pay > body.indexOf('age18Sats.assess(user)'));
    assert.ok(body.indexOf('preAge18') < body.indexOf('resolveLnurlInvoice'));
    assert.ok(body.indexOf('age18Sats.assess(user)') < body.indexOf('const holdInTx'));
});

test('claimCipherWin: refused inside the transaction before the win flips to paying', function () {
    const src = read('functions/src/gifting.js');
    assert.ok(src.includes("const age18Sats = require('./age18Sats');"));
    const start = src.indexOf('const claimCipherWin = ');
    const body = src.slice(start, src.indexOf('const listMyCipherWins', start));
    const at = body.indexOf('age18Sats.assess(userRow)');
    assert.ok(at > 0);
    assert.ok(body.includes('throw age18Sats.errorFor(functionsV1.https.HttpsError, age18);'));
    assert.ok(at < body.indexOf("status: 'paying'"));
    assert.ok(at < body.indexOf('payInvoice'));
});

test('claimCipherSats: refused before the attempt counter, reservation or wallet', function () {
    const src = read('functions/src/gifting.js');
    const start = src.indexOf('const claimCipherSats = ');
    const body = src.slice(start, src.indexOf('const adminResolveCipherSatsClaim', start));
    const at = body.indexOf('age18Sats.assess(user)');
    assert.ok(at > 0);
    assert.ok(at < body.indexOf('t.set(rateRef'));
    assert.ok(at < body.indexOf("phase: 'reserved'"));
    assert.ok(body.includes('if (age18Denial) return age18Sats.responseFor(age18Denial);'));
    assert.ok(body.indexOf('if (age18Denial)') < body.indexOf('payInvoice') || body.indexOf('payInvoice') === -1);
    // The admin lookup callable never pays, so it is not a payout path.
    assert.ok(!/payInvoice/.test(src.slice(src.indexOf('const adminResolveCipherSatsClaim'), src.indexOf('module.exports'))));
});

test('claimFavorBlock: the account gate refuses before any reservation and maps to age_18_required', function () {
    const fns = read('functions/src/favorBlockClaimsFns.js');
    const core = read('functions/src/favorBlockClaims.js');
    const gateAt = fns.indexOf("require('./age18Sats').assess(u)");
    assert.ok(gateAt > 0);
    assert.ok(gateAt < fns.indexOf('emailChange.beginPayout'));
    assert.ok(core.includes("refuse('age_18_required'"));
    assert.ok(core.indexOf("refuse('age_18_required'") < core.indexOf('reserveSpendMsat'));
    assert.ok(/age_18_required: "Confirm you're 18\+ to earn sats\."/.test(core));
});

test('no other callable sends sats: payInvoice appears only in the four guarded paths', function () {
    const files = ['functions/index.js', 'functions/src/gifting.js', 'functions/src/favorBlockClaims.js', 'functions/tctv-drip.js', 'functions/src/tipService.js'];
    const hits = [];
    files.forEach(function (f) {
        const src = read(f);
        let i = -1;
        while ((i = src.indexOf('.payInvoice(', i + 1)) !== -1) hits.push(f);
    });
    // claimSats, claimCipherWin, claimCipherSats (gifting), claimFavorBlock.
    assert.deepStrictEqual(hits.sort(), ['functions/index.js', 'functions/src/favorBlockClaims.js', 'functions/src/gifting.js', 'functions/src/gifting.js'].sort());
});

// ---------- claimFavorBlock account gate (real accountGate) ----------
function favorGateHarness(users, docs) {
    const store = new Map(Object.keys(docs || {}).map(function (k) { return [k, Object.assign({}, docs[k])]; }));
    function ref(p) {
        return {
            get: async function () { const v = store.get(p); return { exists: v !== undefined, data: function () { return v && Object.assign({}, v); } }; },
            set: async function (d, o) { const prev = store.get(p) || {}; store.set(p, o && o.merge ? Object.assign({}, prev, d) : Object.assign({}, d)); },
            delete: async function () { store.delete(p); },
        };
    }
    const db = {
        store: store,
        collection: function (c) {
            return {
                doc: function (id) { return ref(c + '/' + id); },
                where: function () { return { limit: function () { return this; }, get: async function () { return { forEach: function () {}, docs: [], empty: true }; } }; },
            };
        },
        getAll: async function () { return Promise.all(Array.prototype.slice.call(arguments).map(function (r) { return r.get(); })); },
    };
    const authApi = {
        getUser: async function (uid) { if (!users[uid]) { const e = new Error('nf'); e.code = 'auth/user-not-found'; throw e; } return users[uid]; },
        getUserByEmail: async function (email) {
            const hit = Object.keys(users).map(function (k) { return users[k]; }).find(function (u) { return u.email === email; });
            if (!hit) { const e = new Error('nf'); e.code = 'auth/user-not-found'; throw e; }
            return hit;
        },
        revokeRefreshTokens: async function () {},
    };
    function HttpsError(code, msg) { const e = new Error(msg); e.code = code; return e; }
    const onCall = function (fn) { return fn; };
    const functionsV1 = { https: { HttpsError: HttpsError, onCall: onCall }, runWith: function () { return { https: { onCall: onCall } }; } };
    const fns = require(path.join(root, 'functions/src/favorBlockClaimsFns.js')).factory(functionsV1, { db: db, admin: { auth: function () { return authApi; } } });
    return { db: db, gate: fns.accountGate };
}
function authUser(uid, createdMs) {
    return {
        uid: uid, email: uid + '@example.com', emailVerified: true, disabled: false,
        providerData: [{ providerId: 'password', uid: uid + '@example.com' }],
        metadata: { creationTime: new Date(createdMs).toUTCString() },
    };
}
async function withHmacSecret(fn) {
    const prev = process.env.DELETION_HMAC_SECRET;
    process.env.DELETION_HMAC_SECRET = 'unit-deletion-secret-0123456789';
    try { return await fn(); } finally { if (prev === undefined) delete process.env.DELETION_HMAC_SECRET; else process.env.DELETION_HMAC_SECRET = prev; }
}

test('favor account gate: unanswered, under-18 (guardian OK) and blocked are refused; confirmed passes', async function () {
    await withHmacSecret(async function () {
        const tomb = require(path.join(root, 'functions/src/accountTombstone.js'));
        const now = Date.now();
        const uids = ['adult', 'blank', 'teen', 'unconf'];
        const users = {};
        const docs = {};
        uids.forEach(function (u) {
            users[u] = authUser(u, now - 30 * 86400000);
            docs['users/' + u] = { emailHash: tomb.emailHmac(users[u].email) };
        });
        docs['users/adult'].over18 = true;
        docs['users/adult'].ageConfirmed18 = true;
        docs['users/teen'].ageUnder18 = true;
        docs['users/teen'].guardianOk = true;
        docs['users/unconf'].ageConfirmBlocked = true;
        docs['config/ageGateHeld'] = { uids: [], groups: {} };
        require(path.join(root, 'functions/src/ageGateHeld')).resetCache();
        const h = favorGateHarness(users, docs);
        const ctxOf = function (uid) { return { auth: { uid: uid, token: { email: uid + '@example.com', email_verified: true } } }; };
        assert.deepStrictEqual(await h.gate('adult', ctxOf('adult')), { ok: true });
        const blank = await h.gate('blank', ctxOf('blank'));
        assert.strictEqual(blank.ok, false);
        assert.strictEqual(blank.code, 'age_18_required');
        assert.strictEqual(blank.reason, 'unconfirmed');
        assert.strictEqual(blank.error, "Confirm you're 18+ to earn sats.");
        const teen = await h.gate('teen', ctxOf('teen'));
        assert.strictEqual(teen.code, 'age_18_required');
        assert.strictEqual(teen.reason, 'under18');
        assert.strictEqual(teen.error, 'Sats are for players 18 and older.');
        const blocked = await h.gate('unconf', ctxOf('unconf'));
        assert.strictEqual(blocked.code, 'age_18_required');
        assert.strictEqual(blocked.reason, 'blocked');
    });
});

// ---------- client ----------
function el(tag) {
    const e = {
        tagName: String(tag).toUpperCase(), id: '', children: [], attributes: {}, textContent: '', innerHTML: '', parentNode: null,
        setAttribute: function (k, v) { e.attributes[k] = v; },
        getAttribute: function (k) { return e.attributes[k]; },
        addEventListener: function (type, fn) { e._events = e._events || {}; (e._events[type] = e._events[type] || []).push(fn); },
        appendChild: function (c) { e.children.push(c); c.parentNode = e; return c; },
        querySelector: function (sel) {
            if (sel !== 'span') return null;
            return e.children.find(function (c) { return c.tagName === 'SPAN'; }) || null;
        },
        focus: function () {},
        click: function () { ((e._events && e._events.click) || []).forEach(function (fn) { fn({ target: e }); }); },
    };
    Object.defineProperty(e, 'style', { value: { cssText: '' }, writable: true, configurable: true });
    return e;
}

function bootClient(extras) {
    const bodyKids = [];
    const closers = new Map();
    const toasts = [];
    const document = {
        readyState: 'complete',
        body: {
            appendChild: function (n) { n.parentNode = document.body; bodyKids.push(n); return n; },
            removeChild: function (n) { const i = bodyKids.indexOf(n); if (i >= 0) bodyKids.splice(i, 1); n.parentNode = null; },
        },
        addEventListener: function () {},
        createElement: el,
        getElementById: function (id) {
            function find(n) {
                if (!n) return null;
                if (n.id === id) return n;
                for (let i = 0; i < (n.children || []).length; i++) { const hit = find(n.children[i]); if (hit) return hit; }
                return null;
            }
            for (let i = 0; i < bodyKids.length; i++) { const hit = find(bodyKids[i]); if (hit) return hit; }
            return null;
        },
    };
    const store = {};
    const sandbox = Object.assign({
        console: console,
        setTimeout: function (fn) { return setTimeout(fn, 0); },
        clearTimeout: clearTimeout,
        setInterval: function () { return 0; },
        clearInterval: function () {},
        document: document,
        sessionStorage: {
            getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
            setItem: function (k, v) { store[k] = String(v); },
            removeItem: function (k) { delete store[k]; },
        },
        localStorage: { getItem: function () { return null; }, setItem: function () {} },
        CustomEvent: function (name, init) { this.type = name; this.detail = init && init.detail; },
        dispatchEvent: function () {},
        showToast: function (m) { toasts.push(m); },
        btcSheet: {
            setCloser: function (node, fn) { closers.set(node, fn); },
            sync: function () {},
        },
    }, extras || {});
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(read('age-confirm.js'), sandbox, { filename: 'age-confirm.js' });
    sandbox._toasts = toasts;
    sandbox._closers = closers;
    sandbox._store = store;
    return sandbox;
}
const overlayOf = function (env) { return env.document.getElementById('ageConfirmOverlay'); };

test('client: a confirmed adult goes straight through, no prompt, no toast', function () {
    const env = bootClient();
    const user = { over18: true, ageConfirmed18: true };
    assert.strictEqual(env.bqSatsAge18Check(user), true);
    assert.strictEqual(overlayOf(env), null);
    assert.strictEqual(env._toasts.length, 0);
});

test('client: no profile loaded yet lets the server decide', function () {
    const env = bootClient();
    assert.strictEqual(env.bqSatsAge18Check(null), true);
    assert.strictEqual(overlayOf(env), null);
});

test('client: unconfirmed profile is stopped before the sats action and the age prompt is shown', function () {
    const env = bootClient();
    const user = { points: 900 };
    assert.strictEqual(env.bqSatsAge18Check(user), false);
    assert.deepStrictEqual(env._toasts, ["Confirm you're 18+ to earn sats."]);
    const overlay = overlayOf(env);
    assert.ok(overlay);
    assert.ok(env.document.getElementById('ageConfirmBtn'));
    assert.ok(env.document.getElementById('ageUnder18Btn'));
});

test('client: a stale session dismiss does not hide the prompt for a sats action', function () {
    const env = bootClient();
    env.sessionStorage.setItem('bq_age_confirm_dismissed', '1');
    assert.strictEqual(env.bqSatsAge18Check({}), false);
    assert.ok(overlayOf(env));
});

test('client: the sats prompt closes with Escape or the X without marking the session dismissed', function () {
    const env = bootClient();
    env.bqSatsAge18Check({});
    const overlay = overlayOf(env);
    env._closers.get(overlay)();
    assert.strictEqual(overlayOf(env), null);
    assert.strictEqual(env.sessionStorage.getItem('bq_age_confirm_dismissed'), null);
    // Asking again re-shows it, because the age is still unconfirmed.
    assert.strictEqual(env.bqSatsAge18Check({}), false);
    assert.ok(overlayOf(env));
});

test('client: confirming 18+ from the sats prompt updates the profile object and says to try again', async function () {
    const env = bootClient({
        _btcAppCheckForClaim: function () { return Promise.resolve('skip'); },
        firebase: {
            functions: function () {
                return { httpsCallable: function (name) { return function () { return Promise.resolve({ data: { success: true, over18: true, ageConfirmed18: true, name: name } }); }; } };
            },
        },
    });
    const user = {};
    assert.strictEqual(env.bqSatsAge18Check(user), false);
    env.document.getElementById('ageConfirmBtn').click();
    await new Promise(function (r) { setTimeout(r, 10); });
    assert.strictEqual(overlayOf(env), null);
    assert.strictEqual(user.over18, true);
    assert.strictEqual(user.ageConfirmed18, true);
    assert.strictEqual(env.bqSatsAge18Check(user), true);
    assert.ok(env._toasts.indexOf("Thanks! You're confirmed. Try that again.") !== -1);
});

test('client: under-18 with guardian OK gets the 18+ message and no prompt (cannot confirm)', function () {
    const env = bootClient();
    assert.strictEqual(env.bqSatsAge18Check({ ageUnder18: true, guardianOk: true }), false);
    assert.deepStrictEqual(env._toasts, ['Sats are for players 18 and older.']);
    assert.strictEqual(overlayOf(env), null);
});

test('client: a saved under-18 answer without the guardian box gets the guardian step, not skippable', function () {
    const env = bootClient();
    assert.strictEqual(env.bqSatsAge18Check({ ageUnder18: true }), false);
    const overlay = overlayOf(env);
    assert.ok(overlay);
    assert.strictEqual(overlay.getAttribute('data-age-step'), 'guardian-required');
    assert.ok(env.document.getElementById('ageGuardianOk'));
    assert.strictEqual(env.document.getElementById('ageGuardianNotNow'), null);
    // Escape (the registered closer) does nothing.
    env._closers.get(overlay)();
    assert.ok(overlayOf(env));
    assert.strictEqual(overlay.children[0].children[0].style.display, 'none');
});

test('client: a blocked (admin un-confirmed) account is told to contact support, no prompt', function () {
    const env = bootClient();
    assert.strictEqual(env.bqSatsAge18Check({ ageConfirmBlocked: true }), false);
    assert.strictEqual(overlayOf(env), null);
    assert.ok(/support/i.test(env._toasts[0]));
});

test('client: age_18_required from a payout (returned body or thrown HttpsError) re-shows the prompt', function () {
    const env = bootClient();
    assert.strictEqual(env.bqIsAge18Required({ success: false, code: 'age_18_required' }), true);
    assert.strictEqual(env.bqIsAge18Required({ code: 'functions/failed-precondition', details: { code: 'age_18_required', reason: 'unconfirmed' } }), true);
    assert.strictEqual(env.bqIsAge18Required({ success: false, code: 'address_unresolved' }), false);
    assert.strictEqual(env.bqIsAge18Required(null), false);
    assert.strictEqual(env.bqSatsAge18Handle({ success: false, code: 'wallet_low', error: 'x' }, {}), false);
    assert.strictEqual(overlayOf(env), null);
    // Body from claimSats / claimFavorBlock / claimCipherSats.
    assert.strictEqual(env.bqSatsAge18Handle({ success: false, code: 'age_18_required', reason: 'unconfirmed', error: "Confirm you're 18+ to earn sats." }, {}), true);
    assert.ok(overlayOf(env));
    assert.ok(env._toasts.indexOf("Confirm you're 18+ to earn sats.") !== -1);
});

test('client: a thrown HttpsError (claimCipherWin) shows the prompt, and an under18 answer does not', function () {
    const env = bootClient();
    assert.strictEqual(env.bqSatsAge18Handle({ code: 'functions/failed-precondition', details: { code: 'age_18_required', reason: 'under18' } }, {}), true);
    assert.strictEqual(overlayOf(env), null);
    assert.deepStrictEqual(env._toasts, ['Sats are for players 18 and older.']);
    const env2 = bootClient();
    assert.strictEqual(env2.bqSatsAge18Handle({ code: 'functions/failed-precondition', details: { code: 'age_18_required', reason: 'unconfirmed' } }, {}), true);
    assert.ok(overlayOf(env2));
});

function bootUnder18Client(storeFlag, invoke) {
    return bootClient({
        _btcAppCheckForClaim: function () { return Promise.resolve(invoke ? 'skip' : ''); },
        firebase: {
            auth: function () { return { onAuthStateChanged: function (cb) { cb({ uid: 'u1', isAnonymous: false }); } }; },
            firestore: function () {
                return { collection: function () { return { doc: function () { return { get: function () { return Promise.resolve({ exists: true, data: function () { return { points: 1, ageUnder18: true }; } }); } }; } }; } };
            },
            functions: function () {
                return { httpsCallable: function () { return function () { return invoke ? invoke() : Promise.resolve({ data: {} }); }; } };
            },
        },
    });
}

test('guardian step: Escape, the backdrop and a session-dismiss flag never skip the checkbox', async function () {
    const env = bootUnder18Client();
    env.sessionStorage.setItem('bq_age_confirm_dismissed', '1');
    // Re-run the load now that the flag is set.
    env.bqAgeConfirmRecheck && env.bqAgeConfirmRecheck();
    await new Promise(function (r) { setTimeout(r, 5); });
    let overlay = overlayOf(env);
    if (!overlay) {
        // The boot already ran before the flag; ask the way a sats action does.
        env.bqSatsAge18Check({ ageUnder18: true });
        overlay = overlayOf(env);
    }
    assert.ok(overlay);
    assert.strictEqual(overlay.getAttribute('data-age-step'), 'guardian-required');
    env._closers.get(overlay)();
    (overlay._events && overlay._events.click || []).forEach(function (fn) { fn({ target: overlay }); });
    assert.ok(overlayOf(env));
    assert.strictEqual(env.document.getElementById('ageGuardianNotNow'), null);
});

test('guardian step reached from "I\'m under 18": X is hidden and Escape goes back, never straight out', function () {
    const env = bootClient();
    env.bqSatsAge18Check({});
    env.document.getElementById('ageUnder18Btn').click();
    const overlay = overlayOf(env);
    assert.strictEqual(overlay.getAttribute('data-age-step'), 'guardian');
    assert.strictEqual(overlay.children[0].children[0].style.display, 'none');
    assert.strictEqual(env.document.getElementById('ageGuardianNotNow'), null);
    // Escape returns to the two-button prompt (still a sats prompt), not to the app.
    env._closers.get(overlay)();
    assert.ok(overlayOf(env));
    assert.ok(env.document.getElementById('ageConfirmBtn'));
    assert.strictEqual(env.sessionStorage.getItem('bq_age_confirm_dismissed'), null);
});

test('guardian step: Continue stays disabled until the box is checked; a failed save keeps the step open', async function () {
    const env = bootUnder18Client(false, function () { return Promise.reject({ code: 'functions/unavailable' }); });
    await new Promise(function (r) { setTimeout(r, 5); });
    const overlay = overlayOf(env);
    assert.ok(overlay);
    const cont = env.document.getElementById('ageGuardianContinue');
    assert.strictEqual(cont.disabled, true);
    const box = env.document.getElementById('ageGuardianOk');
    box.checked = true;
    ((box._events && box._events.change) || []).forEach(function (fn) { fn({ target: box }); });
    cont.click();
    await new Promise(function (r) { setTimeout(r, 10); });
    assert.ok(overlayOf(env), 'still open after a failed save');
    assert.ok(env.document.getElementById('ageGuardianError'));
    assert.strictEqual(env.document.getElementById('ageGuardianNotNow'), null);
    assert.strictEqual(env.sessionStorage.getItem('bq_age_confirm_dismissed'), null);
});

// ---------- wiring on every client sats entry point ----------
test('client wiring: all four sats entry points check first and handle the server code', function () {
    const ranking = read('ranking.js');
    const quests = read('quests.js');
    const gifting = read('gifting.js');
    assert.ok(/window\.initSatsClaim = function\(\) \{[\s\S]{0,900}bqSatsAge18Check\(currentUser\)/.test(ranking));
    assert.ok(/window\.claimCipherSats = async function\(\) \{[\s\S]{0,700}bqSatsAge18Check\(currentUser\)/.test(ranking));
    assert.ok(ranking.includes('bqSatsAge18Handle(result.data, currentUser)'));
    assert.ok(ranking.includes('bqSatsAge18Handle(e, currentUser)'));
    assert.ok(ranking.includes('bqSatsAge18Handle(d, currentUser)'));
    assert.ok(/function _sfDoClaim\([^)]*\) \{[\s\S]{0,500}bqSatsAge18Check\(/.test(quests));
    assert.ok(quests.includes('bqSatsAge18Handle(d,'));
    assert.ok(/window\.showCipherClaim = function\(win\) \{[\s\S]{0,700}bqSatsAge18Check\(/.test(gifting));
    assert.ok(gifting.includes('bqSatsAge18Handle(d,'));
    assert.ok(gifting.includes('bqSatsAge18Handle(e,'));
});

test('service worker is v2746 and the changed files carry the new cache buster', function () {
    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    assert.ok(read('sw.js').includes("const CACHE_NAME = 'btc-archive-v2746'"));
    assert.ok(html.includes('src="/age-confirm.js?v=20261128_v2746"'));
    assert.ok(html.includes('src="/ranking.js?v=20261128_v2746"'));
    assert.ok(html.includes("'quests.js?v=20261128_v2746'"));
    assert.ok(html.includes("'gifting.js?v=20261128_v2746'"));
    assert.ok(read('patch-notes.html').includes('data-sw-cache="v2746"'));
});

Promise.all(queue).then(function () {
    console.log(passed + ' passed' + (failed ? ', ' + failed + ' failed' : ''));
    process.exit(failed ? 1 : 0);
});
