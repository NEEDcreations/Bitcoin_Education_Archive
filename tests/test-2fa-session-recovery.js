#!/usr/bin/env node
'use strict';
// 2FA session recovery (Nov 11).
// Server: requireSecondFactor marks an expired session with details.reason,
// totpStatus answers "is this browser still remembered?" read-only.
// Client: a callable rejected for an expired 2FA session resumes with the
// remembered device and retries once; with no usable device it asks for the
// code with a clear message. ID token and App Check get one refresh + retry.
// awardPoints says "will sync" only when really offline.

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const secondFactor = require(path.join(root, 'functions', 'src', 'secondFactor'));
const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
const bootSrc = fs.readFileSync(path.join(root, 'app-check-boot.js'), 'utf8');

let passed = 0;
let failed = 0;
async function test(name, fn) {
    try {
        await fn();
        console.log('  ok  ' + name);
        passed++;
    } catch (e) {
        console.log('  FAIL ' + name);
        console.log('       ' + (e && e.stack ? e.stack : e));
        failed++;
    }
}

function HttpsError(code, message, details) {
    const err = new Error(message);
    err.code = code;
    if (details !== undefined) err.details = details;
    return err;
}

function createDb(initial) {
    const docs = new Map();
    Object.keys(initial || {}).forEach(function (k) { docs.set(k, Object.assign({}, initial[k])); });
    const writes = [];
    function ref(p) {
        return {
            path: p,
            id: p.split('/').pop(),
            get: async function () {
                if (!docs.has(p)) return { exists: false, id: this.id, ref: this, data: function () { return undefined; } };
                return { exists: true, id: this.id, ref: this, data: function () { return Object.assign({}, docs.get(p)); } };
            },
            set: async function (data, opts) {
                writes.push(p);
                const prev = docs.get(p) || {};
                docs.set(p, opts && opts.merge ? Object.assign({}, prev, data) : Object.assign({}, data));
            },
            update: async function (data) { writes.push(p); docs.set(p, Object.assign({}, docs.get(p) || {}, data)); },
            delete: async function () { writes.push(p); docs.delete(p); },
        };
    }
    function query(coll, filters, lim) {
        return {
            where: function (f, op, v) { return query(coll, filters.concat([{ f: f, v: v }]), lim); },
            limit: function (n) { return query(coll, filters, n); },
            get: async function () {
                const out = [];
                docs.forEach(function (data, key) {
                    const parts = key.split('/');
                    if (parts.length !== 2 || parts[0] !== coll) return;
                    if (!filters.every(function (x) { return data[x.f] === x.v; })) return;
                    out.push({ id: parts[1], ref: ref(key), data: function () { return Object.assign({}, data); } });
                });
                const sliced = lim ? out.slice(0, lim) : out;
                return { empty: !sliced.length, size: sliced.length, docs: sliced, forEach: function (fn) { sliced.forEach(fn); } };
            },
        };
    }
    return {
        docs: docs,
        writes: writes,
        collection: function (name) {
            return {
                doc: function (id) { return ref(name + '/' + id); },
                where: function (f, op, v) { return query(name, [{ f: f, v: v }]); },
            };
        },
        runTransaction: async function (fn) {
            return fn({
                get: function (r) { return r.get(); },
                set: function (r, d) { writes.push(r.path); docs.set(r.path, Object.assign({}, d)); },
                update: function (r, d) { writes.push(r.path); docs.set(r.path, Object.assign({}, docs.get(r.path) || {}, d)); },
                delete: function (r) { writes.push(r.path); docs.delete(r.path); },
            });
        },
        batch: function () {
            const ops = [];
            return { delete: function (r) { ops.push(r.path); }, update: function () {}, commit: async function () { ops.forEach(function (p) { docs.delete(p); }); } };
        },
    };
}

const NOW = 1_800_000_000_000;
const UID = 'userTotp01';
const TOKEN = 'ab'.repeat(32);
const TOKEN_HASH = crypto.createHash('sha256').update(Buffer.from(TOKEN, 'hex')).digest('hex');

function serverApi(extra) {
    global.__BTC_MFA_NOW__ = function () { return NOW; };
    const db = createDb(Object.assign({
        ['totp_secrets/' + UID]: { enabled: true, secret: 'JBSWY3DPEHPK3PXP' },
        ['users/' + UID]: { totpEnabled: true },
        ['recovery_codes/' + UID]: { codes: [] },
        'trusted_devices/dev1': { uid: UID, tokenHash: TOKEN_HASH, createdAtMs: NOW - 5 * 86400000, expiresAtMs: NOW + 25 * 86400000, revoked: false },
    }, extra || {}));
    const api = secondFactor.initSecondFactor({
        db: db,
        admin: {
            auth: function () {
                return {
                    getUser: async function () {
                        return { uid: UID, multiFactor: { enrolledFactors: [] }, tokensValidAfterTime: new Date(NOW - 400 * 86400000).toUTCString(), metadata: { creationTime: new Date(NOW - 400 * 86400000).toUTCString() } };
                    },
                };
            },
            firestore: { FieldValue: { serverTimestamp: function () { return 'ts'; } } },
        },
        HttpsError: HttpsError,
        authenticator: { generateSecret: function () { return 'x'; }, keyuri: function () { return ''; }, checkDelta: function () { return null; }, options: {} },
        QRCode: { toDataURL: async function () { return ''; } },
    });
    return { api: api, db: db };
}

function ctx() {
    return { auth: { uid: UID, token: { firebase: { sign_in_provider: 'google.com' } } }, rawRequest: { headers: {} } };
}

function extractFunction(src, name) {
    const start = src.indexOf('function ' + name + '(');
    if (start < 0) throw new Error('missing ' + name);
    let depth = 0;
    let seen = false;
    for (let i = start; i < src.length; i++) {
        if (src[i] === '{') { depth++; seen = true; }
        else if (src[i] === '}') { depth--; if (seen && depth === 0) return src.slice(start, i + 1); }
    }
    throw new Error('unclosed ' + name);
}

function clientSandbox(opts) {
    const o = opts || {};
    const sent = [];
    const store = new Map(Object.entries(o.storage || {}));
    const sandbox = {
        console: console,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        Promise: Promise,
        localStorage: {
            getItem: function (k) { return store.has(k) ? store.get(k) : null; },
            setItem: function (k, v) { store.set(k, String(v)); },
            removeItem: function (k) { store.delete(k); },
        },
        prompts: [],
        tokenRefreshes: 0,
    };
    sandbox.window = sandbox;
    sandbox.auth = {
        currentUser: {
            uid: UID,
            isAnonymous: false,
            getIdToken: async function (force) { if (force) sandbox.tokenRefreshes++; return 'id'; },
        },
    };
    function FunctionsClient() {}
    FunctionsClient.prototype.httpsCallable = function (name) {
        return function (data) {
            sent.push({ name: name, data: JSON.parse(JSON.stringify(data || {})) });
            return o.server(name, data || {}, sent);
        };
    };
    sandbox.firebase = { functions: function () { return new FunctionsClient(); } };
    vm.createContext(sandbox);
    const chunkStart = ranking.indexOf('function mfaSessionKey(uid)');
    const helpers = ['mfaErrorCode', 'mfaIsTransientError', 'mfaIsAppCheckError', 'mfaAllowsAfterStatusError', 'mfaRetryOnce', 'mfaClearDevice', 'mfaSessionExpiresAt', 'mfaSleep', 'mfaStoredDeviceToken', 'friendlyCallableError', 'awardFailureToast']
        .map(function (n) { return extractFunction(ranking, n); }).join('\n');
    const keys = extractFunction(ranking, 'mfaSessionKey') + '\n' + extractFunction(ranking, 'mfaDeviceKey') + '\n' + extractFunction(ranking, 'mfaSessionExpKey');
    const winFns = ['window._mfaSessionId = function', 'window._rememberMfaSession = function', 'window._rememberMfaDevice = function'];
    let winSrc = '';
    winFns.forEach(function (marker) {
        const at = ranking.indexOf(marker);
        const end = ranking.indexOf('\n};', at) + 3;
        winSrc += ranking.slice(at, end) + '\n';
    });
    const patchChunk = ranking.slice(ranking.indexOf('var APP_CHECK_CALLABLES'), ranking.indexOf('function _mfaFailure'));
    const resumeChunk = ranking.slice(ranking.indexOf('var _mfaResumeInflight = null;'), ranking.indexOf('window._promptMfaReentry = function'));
    assert.ok(chunkStart >= 0);
    vm.runInContext(
        keys + '\n' + helpers + '\n' + winSrc + '\n' + patchChunk + '\n' + resumeChunk +
        '\nthis.installMfaCallablePatch = installMfaCallablePatch; this.awardFailureToast = awardFailureToast;' +
        '\nwindow._promptMfaReentry = function (o) { window.prompts.push(o); };',
        sandbox
    );
    sandbox.installMfaCallablePatch();
    return { sandbox: sandbox, sent: sent, store: store };
}

function sessionError() {
    return HttpsError('functions/failed-precondition', 'Authenticator session required', { reason: 'mfa_session_required' });
}

(async function main() {
    await test('server: an expired session is marked mfa_session_required', async function () {
        const { api } = serverApi();
        const c = ctx();
        c.mfaSessionId = 'f'.repeat(64);
        await assert.rejects(api.requireSecondFactor(c), function (e) {
            return e.code === 'failed-precondition' && e.message === 'Authenticator session required' && e.details && e.details.reason === 'mfa_session_required';
        });
    });

    await test('server: a valid session still passes and no session still fails (2FA not weakened)', async function () {
        const sid = 'c'.repeat(64);
        const { api } = serverApi({ ['totp_sessions/' + UID + '_' + sid]: { uid: UID, sessionId: sid, expiresAtMs: NOW + 3600000, revoked: false } });
        const ok = ctx(); ok.mfaSessionId = sid;
        const res = await api.requireSecondFactor(ok);
        assert.strictEqual(res.totp, true);
        await assert.rejects(api.requireSecondFactor(ctx()), function (e) { return e.code === 'failed-precondition'; });
        const late = serverApi({ ['totp_sessions/' + UID + '_' + sid]: { uid: UID, sessionId: sid, expiresAtMs: NOW - 1, revoked: false } });
        const c2 = ctx(); c2.mfaSessionId = sid;
        await assert.rejects(late.api.requireSecondFactor(c2), function (e) { return e.details && e.details.reason === 'mfa_session_required'; });
    });

    await test('server: totpStatus reports a remembered device read-only (no session, no guess charge, no write)', async function () {
        const { api, db } = serverApi();
        const res = await api.totpStatus.run({ sessionId: '', deviceToken: TOKEN }, ctx());
        assert.strictEqual(res.enabled, true);
        assert.strictEqual(res.sessionVerified, false);
        assert.strictEqual(res.deviceRemembered, true);
        assert.strictEqual(res.deviceExpiresAt, NOW + 25 * 86400000);
        assert.deepStrictEqual(db.writes, []);
        assert.ok(![...db.docs.keys()].some(function (k) { return k.indexOf('totp_sessions/') === 0 || k.indexOf('totp_rate_limits/') === 0; }));
    });

    await test('server: totpStatus says not remembered for revoked, expired, foreign, or unknown tokens', async function () {
        const revoked = serverApi({ 'trusted_devices/dev1': { uid: UID, tokenHash: TOKEN_HASH, createdAtMs: NOW - 1000, expiresAtMs: NOW + 1000, revoked: true } });
        assert.strictEqual((await revoked.api.totpStatus.run({ deviceToken: TOKEN }, ctx())).deviceRemembered, false);
        const expired = serverApi({ 'trusted_devices/dev1': { uid: UID, tokenHash: TOKEN_HASH, createdAtMs: NOW - 31 * 86400000, expiresAtMs: NOW - 1, revoked: false } });
        assert.strictEqual((await expired.api.totpStatus.run({ deviceToken: TOKEN }, ctx())).deviceRemembered, false);
        const foreign = serverApi({ 'trusted_devices/dev1': { uid: 'someoneElse', tokenHash: TOKEN_HASH, createdAtMs: NOW - 1000, expiresAtMs: NOW + 1000, revoked: false } });
        assert.strictEqual((await foreign.api.totpStatus.run({ deviceToken: TOKEN }, ctx())).deviceRemembered, false);
        const unknown = serverApi();
        assert.strictEqual((await unknown.api.totpStatus.run({ deviceToken: 'cd'.repeat(32) }, ctx())).deviceRemembered, false);
        const none = await unknown.api.totpStatus.run({}, ctx());
        assert.strictEqual(Object.prototype.hasOwnProperty.call(none, 'deviceRemembered'), false);
    });

    await test('server: totpResumeDevice still enforces App Check', function () {
        const src = fs.readFileSync(path.join(root, 'functions', 'src', 'secondFactor.js'), 'utf8');
        assert.ok(/const onCallApp = functionsV1\.runWith\(\{ enforceAppCheck: true \}\)/.test(src));
        assert.ok(src.indexOf('const totpResumeDevice = onCallApp(') !== -1);
    });

    await test('client: expired session on dailySpin resumes the remembered device and retries once', async function () {
        const oldSid = '1'.repeat(64);
        const newSid = '2'.repeat(64);
        let spins = 0;
        const env = clientSandbox({
            storage: { ['btc_mfa_session_' + UID]: oldSid, ['btc_mfa_device_' + UID]: TOKEN },
            server: async function (name, data) {
                if (name === 'totpResumeDevice') return { data: { success: true, sessionId: newSid, expiresAt: Date.now() + 12 * 3600000 } };
                if (name === 'dailySpin') {
                    spins++;
                    if (data.mfaSessionId !== newSid) throw sessionError();
                    return { data: { success: true } };
                }
                throw new Error('unexpected ' + name);
            },
        });
        env.sandbox._btcAppCheckForClaim = function () { return Promise.resolve('tok'); };
        const res = await env.sandbox.firebase.functions().httpsCallable('dailySpin')({});
        assert.strictEqual(res.data.success, true);
        assert.strictEqual(spins, 2);
        assert.deepStrictEqual(env.sent.map(function (x) { return x.name; }), ['dailySpin', 'totpResumeDevice', 'dailySpin']);
        assert.strictEqual(env.store.get('btc_mfa_session_' + UID), newSid);
        assert.ok(Number(env.store.get('btc_mfa_session_exp_' + UID)) > Date.now());
        assert.strictEqual(env.sandbox.prompts.length, 0);
    });

    await test('client: two callables failing together share one resume', async function () {
        const newSid = '3'.repeat(64);
        let resumes = 0;
        const env = clientSandbox({
            storage: { ['btc_mfa_device_' + UID]: TOKEN },
            server: async function (name, data) {
                if (name === 'totpResumeDevice') { resumes++; await new Promise(function (r) { setTimeout(r, 20); }); return { data: { sessionId: newSid, expiresAt: Date.now() + 3600000 } }; }
                if (data.mfaSessionId !== newSid) throw sessionError();
                return { data: { ok: name } };
            },
        });
        env.sandbox._btcAppCheckForClaim = function () { return Promise.resolve('tok'); };
        const f = env.sandbox.firebase.functions();
        const both = await Promise.all([f.httpsCallable('decryptCipher')({ cipherId: 'c', keyId: 'k' }), f.httpsCallable('awardPoints')({ pts: 1 })]);
        assert.strictEqual(both[0].data.ok, 'decryptCipher');
        assert.strictEqual(both[1].data.ok, 'awardPoints');
        assert.strictEqual(resumes, 1);
    });

    await test('client: no remembered device -> clear "re-enter your 2FA code" error and one prompt', async function () {
        const env = clientSandbox({
            storage: { ['btc_mfa_session_' + UID]: '4'.repeat(64) },
            server: async function (name) {
                if (name === 'decryptCipher') throw sessionError();
                throw new Error('unexpected ' + name);
            },
        });
        const err = await env.sandbox.firebase.functions().httpsCallable('decryptCipher')({ cipherId: 'c', keyId: 'k' }).then(function () { return null; }, function (e) { return e; });
        assert.strictEqual(err.code, 'mfa-required');
        assert.strictEqual(err.message, 'Please re-enter your 2FA code to continue.');
        assert.strictEqual(env.sandbox.prompts.length, 1);
        assert.deepStrictEqual(env.sent.map(function (x) { return x.name; }), ['decryptCipher']);
    });

    await test('client: "Device is not trusted." forgets the device and asks for the code', async function () {
        const env = clientSandbox({
            storage: { ['btc_mfa_device_' + UID]: TOKEN },
            server: async function (name) {
                if (name === 'totpResumeDevice') throw HttpsError('functions/failed-precondition', 'Device is not trusted.');
                throw sessionError();
            },
        });
        env.sandbox._btcAppCheckForClaim = function () { return Promise.resolve('tok'); };
        const err = await env.sandbox.firebase.functions().httpsCallable('dailySpin')({}).then(function () { return null; }, function (e) { return e; });
        assert.strictEqual(err.code, 'mfa-required');
        assert.strictEqual(env.store.has('btc_mfa_device_' + UID), false);
        assert.strictEqual(env.sandbox.prompts[0].reason, 'not-trusted');
    });

    await test('client: App Check failure on resume keeps the device, retries App Check once, then says so', async function () {
        let appCheckRetries = 0;
        const env = clientSandbox({
            storage: { ['btc_mfa_device_' + UID]: TOKEN },
            server: async function (name) {
                if (name === 'dailySpin') throw sessionError();
                throw new Error('unexpected ' + name);
            },
        });
        env.sandbox._btcAppCheckForClaim = function () { return Promise.resolve(''); };
        env.sandbox._btcRetryAppCheck = function () { appCheckRetries++; return Promise.resolve(''); };
        const err = await env.sandbox.firebase.functions().httpsCallable('dailySpin')({}).then(function () { return null; }, function (e) { return e; });
        assert.strictEqual(err.code, 'mfa-required');
        assert.ok(/Security check did not load/.test(err.message));
        assert.strictEqual(appCheckRetries, 1);
        assert.strictEqual(env.store.get('btc_mfa_device_' + UID), TOKEN, 'an App Check failure must not forget the remembered device');
        assert.strictEqual(env.sandbox.prompts[0].reason, 'app-check');
    });

    await test('client: rejected ID token is refreshed and the call retried once', async function () {
        let calls = 0;
        const env = clientSandbox({
            server: async function (name) {
                calls++;
                if (calls === 1) throw HttpsError('functions/unauthenticated', 'Must be signed in');
                return { data: { success: true } };
            },
        });
        const res = await env.sandbox.firebase.functions().httpsCallable('awardPoints')({ pts: 5 });
        assert.strictEqual(res.data.success, true);
        assert.strictEqual(env.sandbox.tokenRefreshes, 1);
        assert.strictEqual(calls, 2);
    });

    await test('client: a second unauthenticated answer is final (no loop)', async function () {
        let calls = 0;
        const env = clientSandbox({ server: async function () { calls++; throw HttpsError('functions/unauthenticated', 'Must be signed in'); } });
        const err = await env.sandbox.firebase.functions().httpsCallable('awardPoints')({ pts: 5 }).then(function () { return null; }, function (e) { return e; });
        assert.ok(/unauthenticated/.test(err.code));
        assert.strictEqual(calls, 2);
    });

    await test('client: 2FA flow callables never trigger a resume or retry', async function () {
        const env = clientSandbox({
            storage: { ['btc_mfa_device_' + UID]: TOKEN },
            server: async function () { throw sessionError(); },
        });
        env.sandbox._btcAppCheckForClaim = function () { return Promise.resolve('tok'); };
        await env.sandbox.firebase.functions().httpsCallable('totpStepUp')({ action: 'deleteAccount', code: '123456' }).catch(function () {});
        assert.deepStrictEqual(env.sent.map(function (x) { return x.name; }), ['totpStepUp']);
    });

    await test('client: other server errors are not retried', async function () {
        let calls = 0;
        const env = clientSandbox({ server: async function () { calls++; throw HttpsError('functions/already-exists', 'Already spun today'); } });
        const err = await env.sandbox.firebase.functions().httpsCallable('dailySpin')({}).then(function () { return null; }, function (e) { return e; });
        assert.strictEqual(err.message, 'Already spun today');
        assert.strictEqual(calls, 1);
    });

    await test('client: a session another tab already renewed is used without a new resume', async function () {
        const fresh = '5'.repeat(64);
        const stale = '6'.repeat(64);
        const env = clientSandbox({
            storage: { ['btc_mfa_session_' + UID]: stale, ['btc_mfa_device_' + UID]: TOKEN },
            server: async function (name, data) {
                if (name === 'totpResumeDevice') throw new Error('should not resume');
                if (data.mfaSessionId !== fresh) {
                    env.store.set('btc_mfa_session_' + UID, fresh);
                    env.store.set('btc_mfa_session_exp_' + UID, String(Date.now() + 3600000));
                    throw sessionError();
                }
                return { data: { success: true } };
            },
        });
        const res = await env.sandbox.firebase.functions().httpsCallable('openGift')({ giftId: 'g' });
        assert.strictEqual(res.data.success, true);
        assert.deepStrictEqual(env.sent.map(function (x) { return x.name; }), ['openGift', 'openGift']);
    });

    await test('toast: "XP will sync" only when really offline', function () {
        const env = clientSandbox({ server: async function () { return {}; } });
        const t = env.sandbox.awardFailureToast;
        assert.ok(/will sync/.test(t(Object.assign(new Error('x'), { code: 'functions/unavailable' }), true).text));
        assert.ok(/will sync/.test(t(new Error('Failed to fetch'), true).text));
        assert.ok(/will sync/.test(t(Object.assign(new Error('anything'), { code: 'functions/internal' }), false).text));
        const mfa = t(Object.assign(new Error('Please re-enter your 2FA code to continue.'), { code: 'mfa-required' }), true);
        assert.ok(mfa.mfa && /re-enter your 2FA code/.test(mfa.text));
        assert.ok(!/will sync/.test(t(Object.assign(new Error('Authenticator session required'), { code: 'functions/failed-precondition' }), true).text));
        assert.ok(/Security check/.test(t(Object.assign(new Error('App Check token is not ready'), { code: 'app-check-unavailable' }), true).text));
        assert.ok(/sign-in expired/.test(t(Object.assign(new Error('Must be signed in'), { code: 'functions/unauthenticated' }), true).text));
    });

    await test('ranking: awardPoints catch uses awardFailureToast, not a blanket "will sync"', function () {
        const at = ranking.indexOf("console.warn('[POINTS] Cloud Function failed:'");
        const block = ranking.slice(at, at + 900);
        assert.ok(block.indexOf('awardFailureToast(') !== -1);
        assert.strictEqual(block.indexOf("showToast('⏳ XP will sync when connection restores')"), -1);
    });

    await test('ranking: keep-alive is installed with the callable patch and the challenge can say "re-enter"', function () {
        assert.ok(/installMfaCallablePatch\(\);\s*\n\s*installMfaKeepAlive\(\);/.test(ranking));
        const show = ranking.slice(ranking.indexOf('window._showTotpSignInChallenge = function'), ranking.indexOf('window._submitTotpSignIn = async function'));
        assert.ok(show.indexOf('Please re-enter your 2FA code to continue.') !== -1);
        assert.ok(show.indexOf('_retryRememberedDevice') !== -1);
        assert.ok(ranking.indexOf("window._rememberMfaSession(auth.currentUser.uid, checkedData.sessionId, checkedData.expiresAt)") !== -1);
    });

    await test('app-check-boot: a loaded reCAPTCHA that times out is not sticky; _btcRetryAppCheck retries', async function () {
        let calls = 0;
        let mode = 'timeout';
        function Provider() {}
        Provider.prototype.getToken = function () {
            calls++;
            if (mode === 'timeout') { const e = new Error('appCheck/recaptcha-error'); e.code = 'appCheck/recaptcha-error'; return Promise.reject(e); }
            return Promise.resolve({ token: 'fresh', issuedAtTimeMillis: Date.now(), expireTimeMillis: Date.now() + 3600000 });
        };
        Provider.prototype.initialize = function () {};
        const page = {
            setTimeout: setTimeout, clearTimeout: clearTimeout, Promise: Promise, console: console,
            grecaptcha: { ready: function () {} },
            FIREBASE_CONFIG: { apiKey: 'k' },
        };
        page.window = page;
        page.firebase = { apps: [{}], initializeApp: function () {}, appCheck: function () { return { activate: function () {} }; } };
        page.firebase.appCheck.ReCaptchaV3Provider = Provider;
        vm.createContext(page);
        vm.runInContext(bootSrc, page);
        const first = await page._btcAppCheckForClaim(200);
        assert.strictEqual(first, '');
        assert.notStrictEqual(page._btcRecaptchaFailed, true, 'a loaded script that timed out must not fail every later call');
        mode = 'ok';
        const again = await page._btcRetryAppCheck(500);
        assert.strictEqual(again, 'fresh');
        assert.ok(calls >= 2);
    });

    await test('app-check-boot: a script that never loaded stays fail-fast', async function () {
        function Provider() {}
        Provider.prototype.getToken = function () { const e = new Error('appCheck/recaptcha-error'); e.code = 'appCheck/recaptcha-error'; return Promise.reject(e); };
        Provider.prototype.initialize = function () {};
        const page = { setTimeout: setTimeout, clearTimeout: clearTimeout, Promise: Promise, console: console, FIREBASE_CONFIG: { apiKey: 'k' } };
        page.window = page;
        page.firebase = { apps: [{}], initializeApp: function () {}, appCheck: function () { return { activate: function () {} }; } };
        page.firebase.appCheck.ReCaptchaV3Provider = Provider;
        vm.createContext(page);
        vm.runInContext(bootSrc, page);
        await page._btcAppCheckForClaim(200);
        assert.strictEqual(page._btcRecaptchaFailed, true);
        assert.strictEqual(await page._btcRetryAppCheck(500), '');
    });

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
