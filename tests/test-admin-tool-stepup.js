#!/usr/bin/env node
'use strict';

// Admin banner tools need a fresh 2FA code on every open (Phil, Nov 14).
// totpStepUp({ tool, code }) mints a short, tool-bound admin_tool_sessions
// row; every admin callable behind a banner tool refuses without it.
// In-memory fakes and the real otplib authenticator; no emulator, no network.

const assert = require('assert');
const path = require('path');
const fs = require('fs');

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-btc';
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'demo-btc';
if (!process.env.FIREBASE_CONFIG) {
    process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'demo-btc', storageBucket: 'demo-btc.appspot.com' });
}
if (!process.env.DELETION_HMAC_SECRET) process.env.DELETION_HMAC_SECRET = 'unit-deletion-secret-0123456789';
// Test-only network rate salt (not a real secret) so no salt doc is minted.
if (!process.env.DELETE_RATE_IP_SECRET) process.env.DELETE_RATE_IP_SECRET = 'unit-test-rate-salt-0123456789abcdef0123';
// Point Firestore at a closed local port so nothing can reach a real project.
if (!process.env.FIRESTORE_EMULATOR_HOST) process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:9';

const root = path.join(__dirname, '..');
const fnRoot = path.join(root, 'functions');
const { initSecondFactor, NETWORK_RATE_MAX, ON_DAILY_FAIL_MAX, DAILY_FAIL_MAX, RATE_MAX } = require(path.join(fnRoot, 'src', 'secondFactor.js'));
const tools = require(path.join(fnRoot, 'src', 'adminToolSession.js'));
const { authenticator } = require(require.resolve('otplib', { paths: [fnRoot] }));

let passed = 0;
let failed = 0;
async function test(name, fn) {
    try { await fn(); console.log('\u2705 ' + name); passed++; }
    catch (e) { console.log('\u274c ' + name + '\n   ' + (e && e.stack ? e.stack : e)); failed++; }
}

class FakeHttpsError extends Error {
    constructor(code, message, details) { super(message); this.code = code; this.details = details; }
}

function makeDb() {
    const store = new Map();
    const adds = [];
    let auto = 0;
    function docRef(col, id) {
        const key = col + '/' + id;
        return {
            id: id,
            path: key,
            async get() { const d = store.get(key); return { id: id, exists: !!d, data: function () { return d ? Object.assign({}, d) : undefined; }, ref: this }; },
            async set(data, opts) {
                const prev = (opts && opts.merge && store.get(key)) || {};
                store.set(key, Object.assign({}, prev, data));
            },
            async update(data) { store.set(key, Object.assign({}, store.get(key) || {}, data)); },
            async delete() { store.delete(key); },
        };
    }
    function collection(col) {
        return {
            doc: function (id) { return docRef(col, id || ('auto' + (++auto))); },
            async add(data) { adds.push({ col: col, data: data }); const id = 'auto' + (++auto); store.set(col + '/' + id, data); return docRef(col, id); },
            where: function () { return { async get() { return { empty: true, size: 0, docs: [], forEach: function () {} }; } }; },
        };
    }
    return {
        store: store,
        adds: adds,
        collection: collection,
        batch: function () {
            const ops = [];
            return {
                delete: function (ref) { ops.push(function () { return ref.delete(); }); },
                update: function (ref, d) { ops.push(function () { return ref.update(d); }); },
                set: function (ref, d, o) { ops.push(function () { return ref.set(d, o); }); },
                async commit() { for (const op of ops) await op(); },
            };
        },
        async runTransaction(fn) {
            return fn({
                get: function (ref) { return ref.get(); },
                set: function (ref, d, o) { return ref.set(d, o); },
                update: function (ref, d) { return ref.update(d); },
                delete: function (ref) { return ref.delete(); },
            });
        },
    };
}

const T0 = Date.parse('2026-11-14T22:00:00Z');
let NOW = T0;
global.__BTC_MFA_NOW__ = function () { return NOW; };

// Test-only TOTP seed generated per run; never a real account's secret.
const SEED = authenticator.generateSecret();
function codeAt(ms) {
    const prev = Object.assign({}, authenticator.options);
    authenticator.options = Object.assign({}, prev, { epoch: ms, step: 30 });
    try { return authenticator.generate(SEED); } finally { authenticator.options = prev; }
}

function setup(opts) {
    const o = opts || {};
    const db = makeDb();
    const phoneAt = o.phoneAt || (T0 - 3 * 86400000);
    const users = {
        adminA1: { uid: 'adminA1', customClaims: { admin: true }, multiFactor: { enrolledFactors: o.phone ? [{ uid: 'ph1', factorId: 'phone', enrollmentTime: new Date(phoneAt).toISOString() }] : [] } },
    };
    const adminSdk = {
        auth: function () { return { async getUser(uid) { if (!users[uid]) throw new Error('no user'); return users[uid]; } }; },
        firestore: {
            FieldValue: { serverTimestamp: function () { return 'ts'; } },
            Timestamp: { fromMillis: function (ms) { return { _ts: true, toMillis: function () { return ms; } }; } },
        },
    };
    const api = initSecondFactor({
        db: db,
        admin: adminSdk,
        HttpsError: FakeHttpsError,
        authenticator: authenticator,
        QRCode: { toDataURL: async function () { return ''; } },
    });
    const enabledAt = o.totpEnabledAt || (T0 - 3 * 86400000);
    if (o.totp !== false) {
        db.store.set('totp_secrets/adminA1', { uid: 'adminA1', enabled: true, secret: SEED, secretEnc: false, enabledAt: enabledAt });
    }
    const known = { uid: 'adminA1' };
    if (o.totp !== false && o.totpKnown !== false) known.totp = { enabledAtMs: o.totpKnownAt || enabledAt };
    if (o.phone && o.phoneKnown !== false) {
        known.phones = { ph1: { enrollmentTimeMs: phoneAt, recordedAtMs: o.phoneRecordedAt || phoneAt } };
    }
    db.store.set('mfa_known_factors/adminA1', known);
    return { api: api, db: db };
}

function ctx(uid, tokenExtra, ip) {
    return {
        auth: { uid: uid, token: Object.assign({ admin: true, auth_time: Math.floor((NOW - 60000) / 1000), firebase: { sign_in_provider: 'password' } }, tokenExtra || {}) },
        rawRequest: { ip: ip === '' ? '' : (ip || '203.0.113.7'), headers: ip === '' ? {} : { 'x-forwarded-for': ip || '203.0.113.7' } },
    };
}

async function expectErr(promise, code, reason) {
    let err = null;
    try { await promise; } catch (e) { err = e; }
    assert.ok(err, 'expected a refusal');
    assert.strictEqual(err.code, code, 'got ' + (err && err.code) + ': ' + (err && err.message));
    if (reason) assert.strictEqual(err.details && err.details.reason, reason);
    return err;
}

function logRows(db, action) {
    const rows = [];
    db.store.forEach(function (v, k) {
        if (k.indexOf('mfa_admin_log/') === 0 && (!action || v.action === action)) rows.push({ col: 'mfa_admin_log', data: v });
    });
    return rows;
}

async function guard(db, data, tool, c) {
    return tools.requireAdminToolSession(db, data, c || ctx('adminA1'), tool, { HttpsError: FakeHttpsError });
}

function settle(promise, ms) {
    return Promise.race([
        Promise.resolve(promise).then(function () { return { ok: true }; }, function (e) { return { err: e }; }),
        new Promise(function (r) { setTimeout(function () { r({ pending: true }); }, ms); }),
    ]);
}

(async function main() {
    await test('every banner tile has a tool id the server knows', function () {
        const src = fs.readFileSync(path.join(root, 'admin-panel.js'), 'utf8');
        const ids = [];
        src.replace(/id: '([A-Za-z]+)', icon:/g, function (_, id) { ids.push(id); return _; });
        assert.ok(ids.length >= 10, 'found ' + ids.length + ' tiles');
        ids.forEach(function (id) { assert.ok(tools.isAdminTool(id), id + ' missing from ADMIN_TOOLS'); });
        Object.keys(tools.ADMIN_TOOLS).forEach(function (id) { assert.ok(ids.indexOf(id) !== -1, id + ' is not on the banner'); });
    });

    await test('valid code mints a 5-minute session for that tool only, and audits it', async function () {
        NOW = T0;
        const { api, db } = setup();
        const res = await api.totpStepUp.run({ tool: 'cipherWins', code: codeAt(NOW) }, ctx('adminA1'));
        assert.strictEqual(res.success, true);
        assert.ok(/^[a-f0-9]{32}$/.test(res.adminToolSession));
        assert.strictEqual(res.expiresAt, NOW + 5 * 60 * 1000);
        const row = db.store.get('admin_tool_sessions/adminA1_cipherWins');
        assert.strictEqual(row.tool, 'cipherWins');
        assert.strictEqual(row.method, 'totp');
        const ok = await guard(db, { adminToolSession: res.adminToolSession }, 'cipherWins');
        assert.strictEqual(ok.tool, 'cipherWins');
        const log = logRows(db, 'admin_tool_step_up');
        assert.strictEqual(log.length, 1);
        assert.strictEqual(log[0].data.tool, 'cipherWins');
        assert.strictEqual(log[0].data.adminUid, 'adminA1');
        assert.ok(!JSON.stringify(log[0].data).includes(SEED), 'no secret in the audit row');
    });

    await test('wrong tool: a session for one tool never opens another', async function () {
        NOW = T0;
        const { api, db } = setup();
        const res = await api.totpStepUp.run({ tool: 'cipherWins', code: codeAt(NOW) }, ctx('adminA1'));
        await expectErr(guard(db, { adminToolSession: res.adminToolSession }, 'killSwitch'), 'failed-precondition', 'admin-step-up');
        await expectErr(guard(db, { adminToolSession: res.adminToolSession }, 'factionPrize'), 'failed-precondition', 'admin-step-up');
    });

    await test('expired: the session stops working after 5 minutes', async function () {
        NOW = T0;
        const { api, db } = setup();
        const res = await api.totpStepUp.run({ tool: 'killSwitch', code: codeAt(NOW) }, ctx('adminA1'));
        NOW = T0 + 5 * 60 * 1000 - 1;
        await guard(db, { adminToolSession: res.adminToolSession }, 'killSwitch');
        NOW = T0 + 5 * 60 * 1000;
        await expectErr(guard(db, { adminToolSession: res.adminToolSession }, 'killSwitch'), 'failed-precondition', 'admin-step-up');
        NOW = T0;
    });

    await test('re-open: a new step-up replaces the previous opening of that tool', async function () {
        NOW = T0;
        const { api, db } = setup();
        const first = await api.totpStepUp.run({ tool: 'topics', code: codeAt(NOW) }, ctx('adminA1'));
        NOW = T0 + 31000;
        const second = await api.totpStepUp.run({ tool: 'topics', code: codeAt(NOW) }, ctx('adminA1'));
        assert.notStrictEqual(first.adminToolSession, second.adminToolSession);
        await expectErr(guard(db, { adminToolSession: first.adminToolSession }, 'topics'), 'failed-precondition');
        await guard(db, { adminToolSession: second.adminToolSession }, 'topics');
        NOW = T0;
    });

    await test('closing the tool ends its session', async function () {
        NOW = T0;
        const { api, db } = setup();
        const res = await api.totpStepUp.run({ tool: 'killSwitch', code: codeAt(NOW) }, ctx('adminA1'));
        await api.totpStepUp.run({ tool: 'killSwitch', end: true, adminToolSession: res.adminToolSession }, ctx('adminA1'));
        await expectErr(guard(db, { adminToolSession: res.adminToolSession }, 'killSwitch'), 'failed-precondition');
    });

    await test('replay: the same TOTP code cannot open a second tool, and the failure is audited', async function () {
        NOW = T0;
        const { api, db } = setup();
        const code = codeAt(NOW);
        await api.totpStepUp.run({ tool: 'cipherWins', code: code }, ctx('adminA1'));
        await expectErr(api.totpStepUp.run({ tool: 'killSwitch', code: code }, ctx('adminA1')), 'invalid-argument');
        assert.ok(!db.store.has('admin_tool_sessions/adminA1_killSwitch'));
        const fails = logRows(db, 'admin_tool_step_up_failed');
        assert.strictEqual(fails.length, 1);
        assert.strictEqual(fails[0].data.tool, 'killSwitch');
    });

    await test('a code already used for another 2FA action cannot be reused here', async function () {
        NOW = T0;
        const { api } = setup();
        const code = codeAt(NOW);
        await api.totpStepUp.run({ action: 'adminSetKillSwitch', code: code }, ctx('adminA1'));
        await expectErr(api.totpStepUp.run({ tool: 'killSwitch', code: code }, ctx('adminA1')), 'invalid-argument');
    });

    await test('wrong code is refused and audited; no session is written', async function () {
        NOW = T0;
        const { api, db } = setup();
        const good = codeAt(NOW);
        const bad = good === '000000' ? '111111' : '000000';
        await expectErr(api.totpStepUp.run({ tool: 'forum', code: bad }, ctx('adminA1')), 'invalid-argument');
        assert.ok(!db.store.has('admin_tool_sessions/adminA1_forum'));
        assert.strictEqual(logRows(db, 'admin_tool_step_up_failed').length, 1);
    });

    await test('missing code is refused (a remembered device or session is never enough)', async function () {
        NOW = T0;
        const { api } = setup();
        await expectErr(api.totpStepUp.run({ tool: 'forum', mfaSessionId: 'a'.repeat(64) }, ctx('adminA1')), 'invalid-argument', 'code-required');
    });

    await test('no 2FA: an admin with no authenticator or phone is blocked', async function () {
        NOW = T0;
        const { api, db } = setup({ totp: false });
        await expectErr(api.totpStepUp.run({ tool: 'killSwitch', code: '123456' }, ctx('adminA1')), 'failed-precondition', 'no-2fa');
        assert.ok(!db.store.has('admin_tool_sessions/adminA1_killSwitch'));
        assert.strictEqual(logRows(db, 'admin_tool_step_up_failed')[0].data.reason, 'no-2fa');
    });

    await test('phone-only admin: needs a phone sign-in from the last 5 minutes, once per sign-in', async function () {
        NOW = T0;
        const { api } = setup({ totp: false, phone: true });
        await expectErr(api.totpStepUp.run({ tool: 'beats' }, ctx('adminA1')), 'failed-precondition', 'phone-resign');
        const fresh = { auth_time: Math.floor((NOW - 30000) / 1000), firebase: { sign_in_provider: 'password', sign_in_second_factor: 'phone' } };
        const ok = await api.totpStepUp.run({ tool: 'beats' }, ctx('adminA1', fresh));
        assert.strictEqual(ok.method, 'phone');
        await expectErr(api.totpStepUp.run({ tool: 'market' }, ctx('adminA1', fresh)), 'failed-precondition', 'phone-resign');
        const stale = { auth_time: Math.floor((NOW - 6 * 60000) / 1000), firebase: { sign_in_provider: 'password', sign_in_second_factor: 'phone' } };
        await expectErr(api.totpStepUp.run({ tool: 'market' }, ctx('adminA1', stale)), 'failed-precondition', 'phone-resign');
    });

    await test('rate limit per uid: the 6th guess in 2 minutes is refused even with a good code', async function () {
        NOW = T0;
        const { api, db } = setup();
        const good = codeAt(NOW);
        const bad = good === '000000' ? '111111' : '000000';
        for (let i = 0; i < 5; i++) {
            await expectErr(api.totpStepUp.run({ tool: 'forum', code: bad }, ctx('adminA1', null, '198.51.' + (100 + i) + '.1')), 'invalid-argument');
        }
        await expectErr(api.totpStepUp.run({ tool: 'forum', code: good }, ctx('adminA1', null, '198.51.120.1')), 'resource-exhausted');
        assert.ok(!db.store.has('admin_tool_sessions/adminA1_forum'));
    });

    await test('rate limit per IP: NETWORK_RATE_MAX failed tries from one address block the next; fewer do not', async function () {
        NOW = T0;
        const { api, db } = setup();
        assert.strictEqual(NETWORK_RATE_MAX, 12);
        assert.strictEqual(RATE_MAX, 5);
        // Spread the uid limit across admins so only the IP bucket is hit.
        for (let i = 0; i < NETWORK_RATE_MAX - 1; i++) {
            const uid = 'adminX' + i;
            await expectErr(api.totpStepUp.run({ tool: 'forum', code: '000000' }, ctx(uid, null, '192.0.2.50')), 'failed-precondition');
        }
        const stillOk = await api.totpStepUp.run({ tool: 'forum', code: codeAt(NOW) }, ctx('adminA1', null, '192.0.2.50'));
        assert.strictEqual(stillOk.success, true, 'the 12th try on this address is still allowed');
        // A new window of 12 failures then blocks the next.
        NOW = T0;
        const { api: api2, db: db2 } = setup();
        for (let i = 0; i < NETWORK_RATE_MAX; i++) {
            const uid = 'adminX' + i;
            await expectErr(api2.totpStepUp.run({ tool: 'forum', code: '000000' }, ctx(uid, null, '192.0.2.50')), 'failed-precondition');
        }
        await expectErr(api2.totpStepUp.run({ tool: 'forum', code: codeAt(NOW) }, ctx('adminA1', null, '192.0.2.50')), 'resource-exhausted');
        assert.ok(!db2.store.has('admin_tool_sessions/adminA1_forum'));
    });

    await test('non-admins and anonymous users cannot mint a tool session', async function () {
        NOW = T0;
        const { api } = setup();
        await expectErr(api.totpStepUp.run({ tool: 'killSwitch', code: codeAt(NOW) }, ctx('adminA1', { admin: false })), 'permission-denied');
        await expectErr(api.totpStepUp.run({ tool: 'killSwitch', code: codeAt(NOW) }, ctx('adminA1', { admin: 'true' })), 'permission-denied');
        await expectErr(api.totpStepUp.run({ tool: 'killSwitch', code: codeAt(NOW) }, ctx('adminA1', { firebase: { sign_in_provider: 'anonymous' } })), 'permission-denied');
        await expectErr(api.totpStepUp.run({ tool: 'notATool', code: codeAt(NOW) }, ctx('adminA1')), 'invalid-argument');
    });

    await test('guard: forged, missing, other-uid and revoked sessions are refused', async function () {
        NOW = T0;
        const db = makeDb();
        const sid = 'ab'.repeat(16);
        db.store.set('admin_tool_sessions/adminA1_market', { uid: 'adminA1', tool: 'market', sessionId: sid, verifiedAtMs: NOW, expiresAtMs: NOW + 300000 });
        await guard(db, { adminToolSession: sid }, 'market');
        await expectErr(guard(db, {}, 'market'), 'failed-precondition', 'admin-step-up');
        await expectErr(guard(db, { adminToolSession: 'cd'.repeat(16) }, 'market'), 'failed-precondition');
        await expectErr(guard(db, { adminToolSession: sid }, 'market', ctx('adminB2')), 'failed-precondition');
        await expectErr(guard(db, { adminToolSession: sid }, 'market', ctx('adminA1', { admin: false })), 'permission-denied');
        db.store.set('admin_tool_sessions/adminA1_market', { uid: 'adminA1', tool: 'market', sessionId: sid, verifiedAtMs: NOW, expiresAtMs: NOW + 300000, revoked: true });
        await expectErr(guard(db, { adminToolSession: sid }, 'market'), 'failed-precondition');
        db.store.set('admin_tool_sessions/adminA1_market', { uid: 'adminA1', tool: 'market', sessionId: sid, verifiedAtMs: NOW - 3600000, expiresAtMs: NOW + 3600000 });
        await expectErr(guard(db, { adminToolSession: sid }, 'market'), 'failed-precondition');
    });


    // ── Red Team #325 fixes ──
    await test('F3: bad codes from different addresses in one IPv6 /64 share the network limit', async function () {
        NOW = T0;
        const { api, db } = setup();
        for (let i = 0; i < NETWORK_RATE_MAX; i++) {
            await expectErr(api.totpStepUp.run({ tool: 'forum', code: '000000' }, ctx('adminX' + i, null, '2001:db8:1:2::' + (i + 1))), 'failed-precondition');
        }
        await expectErr(api.totpStepUp.run({ tool: 'forum', code: codeAt(NOW) }, ctx('adminA1', null, '2001:db8:1:2:aaaa::ff')), 'resource-exhausted');
        assert.ok(!db.store.has('admin_tool_sessions/adminA1_forum'));
        // Another /64 has its own bucket.
        const ok = await api.totpStepUp.run({ tool: 'forum', code: codeAt(NOW) }, ctx('adminA1', null, '2001:db8:1:3::1'));
        assert.strictEqual(ok.success, true);
    });

    await test('F3: IPv4 addresses in one /24 share the network limit', async function () {
        NOW = T0;
        const { api } = setup();
        for (let i = 0; i < NETWORK_RATE_MAX; i++) {
            await expectErr(api.totpStepUp.run({ tool: 'forum', code: '000000' }, ctx('adminY' + i, null, '192.0.2.' + (10 + i))), 'failed-precondition');
        }
        await expectErr(api.totpStepUp.run({ tool: 'forum', code: codeAt(NOW) }, ctx('adminA1', null, '192.0.2.200')), 'resource-exhausted');
    });

    await test('F3: an empty IP skips the network limit (no shared unknown bucket), notes it in the audit row', async function () {
        NOW = T0;
        const { api, db } = setup();
        for (let i = 0; i < 6; i++) {
            await expectErr(api.totpStepUp.run({ tool: 'forum', code: '000000' }, ctx('adminZ' + i, null, '')), 'failed-precondition');
        }
        const res = await api.totpStepUp.run({ tool: 'forum', code: codeAt(NOW) }, ctx('adminA1', null, ''));
        assert.strictEqual(res.success, true, 'other admins with no IP never lock this admin out');
        let ipRows = 0;
        db.store.forEach(function (v, k) { if (k.indexOf('rate_limits/admintoolip_') === 0) ipRows++; });
        assert.strictEqual(ipRows, 0, 'no network bucket written');
        const ok = logRows(db, 'admin_tool_step_up');
        assert.strictEqual(ok.length, 1);
        assert.strictEqual(ok[0].data.ipLimit, 'skipped-no-ip');
        assert.ok(logRows(db, 'admin_tool_step_up_failed').every(function (r) { return r.data.ipLimit === 'skipped-no-ip'; }));
        // Per-uid limit still applies with no IP.
        const bad = codeAt(NOW) === '000000' ? '111111' : '000000';
        NOW = T0 + 60000;
        for (let i = 0; i < 5; i++) await expectErr(api.totpStepUp.run({ tool: 'beats', code: bad }, ctx('adminA1', null, '')), 'invalid-argument');
        await expectErr(api.totpStepUp.run({ tool: 'beats', code: codeAt(NOW) }, ctx('adminA1', null, '')), 'resource-exhausted');
        NOW = T0;
    });

    await test('F3: source keys the network limit on faucetGuard.networkKeys(ip).rangeId, never a shared unknown bucket', function () {
        const src = fs.readFileSync(path.join(fnRoot, 'src', 'secondFactor.js'), 'utf8');
        const body = src.slice(src.indexOf('async function adminToolStepUp'), src.indexOf('const totpStepUp = onCallAppKey'));
        assert.ok(src.includes('faucetGuard.networkKeys(raw)') && src.includes('keys.rangeId'));
        assert.ok(!body.includes("|| 'unknown'"), 'no shared unknown bucket');
    });

    await test('F4: a TOTP enrolled less than 24 h ago cannot open an admin tool', async function () {
        NOW = T0;
        const { api, db } = setup({ totpEnabledAt: T0 - 3600000 });
        await expectErr(api.totpStepUp.run({ tool: 'killSwitch', code: codeAt(NOW) }, ctx('adminA1')), 'failed-precondition', 'factor-too-new');
        assert.ok(!db.store.has('admin_tool_sessions/adminA1_killSwitch'));
        assert.strictEqual(logRows(db, 'admin_tool_step_up_failed')[0].data.reason, 'factor-too-new');
    });

    await test('F4: a TOTP that does not match the server record is refused', async function () {
        NOW = T0;
        const { api, db } = setup({ totpKnownAt: T0 - 9 * 86400000 });
        await expectErr(api.totpStepUp.run({ tool: 'killSwitch', code: codeAt(NOW) }, ctx('adminA1')), 'failed-precondition', 'factor-unrecorded');
        assert.ok(!db.store.has('admin_tool_sessions/adminA1_killSwitch'));
    });

    await test('F4: a TOTP admin with an unrecorded phone factor is refused', async function () {
        NOW = T0;
        const { api } = setup({ phone: true, phoneKnown: false });
        await expectErr(api.totpStepUp.run({ tool: 'killSwitch', code: codeAt(NOW) }, ctx('adminA1')), 'failed-precondition', 'factor-unrecorded');
    });

    await test('F4: phone-only admin with a phone added less than 24 h ago is refused', async function () {
        NOW = T0;
        const { api } = setup({ totp: false, phone: true, phoneAt: T0 - 3600000 });
        const fresh = { auth_time: Math.floor((NOW - 30000) / 1000), firebase: { sign_in_provider: 'password', sign_in_second_factor: 'phone' } };
        await expectErr(api.totpStepUp.run({ tool: 'beats' }, ctx('adminA1', fresh)), 'failed-precondition', 'factor-too-new');
    });

    await test('F4: phone-only admin with an unrecorded phone factor is refused', async function () {
        NOW = T0;
        const { api } = setup({ totp: false, phone: true, phoneKnown: false });
        const fresh = { auth_time: Math.floor((NOW - 30000) / 1000), firebase: { sign_in_provider: 'password', sign_in_second_factor: 'phone' } };
        await expectErr(api.totpStepUp.run({ tool: 'beats' }, ctx('adminA1', fresh)), 'failed-precondition', 'factor-unrecorded');
    });

    await test('F6: the success audit row is written in the same batch as the session', async function () {
        NOW = T0;
        const { api, db } = setup();
        const res = await api.totpStepUp.run({ tool: 'market', code: codeAt(NOW) }, ctx('adminA1'));
        assert.ok(res.adminToolSession);
        assert.strictEqual(db.adds.filter(function (a) { return a.data.action === 'admin_tool_step_up'; }).length, 0, 'not a best-effort add()');
        assert.strictEqual(logRows(db, 'admin_tool_step_up').length, 1);
        // A failed commit writes neither the session nor the success row.
        NOW = T0 + 31000;
        const realBatch = db.batch;
        db.batch = function () { const b = realBatch(); b.commit = async function () { throw new Error('commit failed'); }; return b; };
        let err = null;
        try { await api.totpStepUp.run({ tool: 'beats', code: codeAt(NOW) }, ctx('adminA1')); } catch (e) { err = e; }
        db.batch = realBatch;
        assert.ok(err);
        assert.ok(!db.store.has('admin_tool_sessions/adminA1_beats'));
        assert.strictEqual(logRows(db, 'admin_tool_step_up').filter(function (r) { return r.data.tool === 'beats'; }).length, 0);
        NOW = T0;
    });

    await test('F9: sessions carry an expireAt Timestamp equal to expiresAtMs (for a later TTL policy)', async function () {
        NOW = T0;
        const { api, db } = setup();
        const res = await api.totpStepUp.run({ tool: 'chat', code: codeAt(NOW) }, ctx('adminA1'));
        const row = db.store.get('admin_tool_sessions/adminA1_chat');
        assert.ok(row.expireAt && row.expireAt._ts === true, 'Timestamp, not a number');
        assert.strictEqual(row.expireAt.toMillis(), res.expiresAt);
        assert.strictEqual(row.expiresAtMs, res.expiresAt);
    });

    await test('F2: docs call it a 5-minute tool window, not single-use', function () {
        const src = fs.readFileSync(path.join(fnRoot, 'src', 'adminToolSession.js'), 'utf8');
        assert.ok(src.includes('5-minute tool window'));
        assert.ok(src.includes('NOT single-use'));
    });

    await test('F2: adminApproveFactionPayout needs a single-use proof on top of the tool window (and stays unexported)', async function () {
        NOW = T0;
        const { api, db } = setup();
        const v1 = require(require.resolve('firebase-functions/v1', { paths: [fnRoot] }));
        const jobs = require(path.join(fnRoot, 'src', 'factionRaceJobs.js')).factory({
            functionsV1: v1, admin: { firestore: { FieldValue: {} } }, db: db, onDocumentWritten: function () { return function () {}; },
        });
        const open = await api.totpStepUp.run({ tool: 'factionPrize', code: codeAt(NOW) }, ctx('adminA1'));
        const r = await settle(jobs.adminApproveFactionPayout.run({ raceId: 'r1', confirm: 'APPROVE r1', adminToolSession: open.adminToolSession }, ctx('adminA1')), 1500);
        assert.ok(r.err, 'refused without a fresh proof');
        assert.strictEqual(r.err.code, 'failed-precondition');
        assert.notStrictEqual(r.err.details && r.err.details.reason, 'admin-step-up', 'the tool window passed; the proof is what failed');
        // A proof for the payout action is consumed once.
        NOW = T0 + 31000;
        const proof = await api.totpStepUp.run({ action: 'adminApproveFactionPayout', code: codeAt(NOW) }, ctx('adminA1'));
        await settle(jobs.adminApproveFactionPayout.run({ raceId: 'r1', confirm: 'APPROVE r1', adminToolSession: open.adminToolSession, freshProofId: proof.freshProofId }, ctx('adminA1')), 1500);
        assert.strictEqual(db.store.get('totp_fresh_proofs/adminA1_adminApproveFactionPayout').consumed, true);
        const again = await settle(jobs.adminApproveFactionPayout.run({ raceId: 'r1', confirm: 'APPROVE r1', adminToolSession: open.adminToolSession, freshProofId: proof.freshProofId }, ctx('adminA1')), 1500);
        assert.ok(again.err && again.err.code === 'failed-precondition', 'a proof is single-use');
        const killSwitch = fs.readFileSync(path.join(fnRoot, 'src', 'killSwitch.js'), 'utf8');
        assert.ok(killSwitch.includes("NEVER_EXPORTED = Object.freeze(['adminApproveFactionPayout'])"));
        NOW = T0;
    });

    // Each guarded callable refuses an admin who has no tool session.
    const fns = require(path.join(fnRoot, 'index.js'));
    const ADMIN = { auth: { uid: 'adminA1', token: { admin: true, firebase: { sign_in_provider: 'password' } } } };
    const PLAYER = { auth: { uid: 'playerP1', token: { firebase: { sign_in_provider: 'password' } } } };

    await test('adminApproveFactionPayout stays undeployed', function () {
        assert.strictEqual(fns.adminApproveFactionPayout, undefined);
    });

    const direct = {
        adminListCipherWins: require(path.join(fnRoot, 'src', 'gifting.js')).adminListCipherWins,
        adminMarkCipherWinPaid: require(path.join(fnRoot, 'src', 'gifting.js')).adminMarkCipherWinPaid,
        backfillFactionTotals: require(path.join(fnRoot, 'src', 'satoshiFavor.js')).backfillFactionTotals,
        banReportedFaucetUser: fns.banReportedFaucetUser,
        adminFactionRaceBreakdown: fns.adminFactionRaceBreakdown,
        moderateTopicPost: fns.moderateTopicPost,
    };
    (function () {
        const v1 = require(require.resolve('firebase-functions/v1', { paths: [fnRoot] }));
        const jobs = require(path.join(fnRoot, 'src', 'factionRaceJobs.js')).factory({
            functionsV1: v1, admin: { firestore: { FieldValue: {} } }, db: makeDb(), onDocumentWritten: function () { return function () {}; },
        });
        direct.adminApproveFactionPayout = jobs.adminApproveFactionPayout;
        const ks = require(path.join(fnRoot, 'src', 'killSwitch.js'));
        const ksFn = ks.makeAdminSetKillSwitch({
            functionsV1: { https: { HttpsError: v1.https.HttpsError, onCall: function (h) { return h; } }, runWith: function () { return { https: { onCall: function (h) { return h; } } }; } },
            admin: { firestore: { FieldValue: { serverTimestamp: function () { return 'ts'; } } } },
            db: makeDb(),
            backupDeps: {},
        });
        direct.adminSetKillSwitch = { run: function (data, c) { return ksFn.__handler(Object.assign({}, data, { action: 'status' }), c); } };
    })();

    Object.keys(tools.GUARDED_CALLABLES).forEach(function (name) {
        assert.ok(direct[name], 'test covers ' + name);
    });

    for (const name of Object.keys(tools.GUARDED_CALLABLES)) {
        await test(name + ' refuses an admin with no fresh 2FA tool session', async function () {
            const r = await settle(direct[name].run({ winId: 'w1', uid: 'targetU1', raceId: 'r1', confirm: 'APPROVE r1', channelId: 'mining', postId: 'p1', action: 'hide' }, ADMIN), 1500);
            assert.ok(r.err, 'expected a refusal, got ' + JSON.stringify(r));
            assert.strictEqual(r.err.code, 'failed-precondition', String(r.err && r.err.message));
            assert.strictEqual(r.err.details && r.err.details.reason, 'admin-step-up');
        });
        await test(name + ' still refuses a non-admin first', async function () {
            const r = await settle(direct[name].run({}, PLAYER), 1500);
            assert.ok(r.err);
            assert.strictEqual(r.err.code, 'permission-denied', String(r.err && r.err.message));
        });
    }


    // After a proof is accepted these functions go on to the real Firestore
    // client, which points at a closed local port; ignore those late network
    // rejections (nothing here can reach a real project).
    process.on('unhandledRejection', function (e) {
        const msg = String((e && e.message) || e);
        if (/default credentials|ECONNREFUSED|UNAVAILABLE|DEADLINE|ETIMEDOUT/i.test(msg)) return;
        console.log('\u274c unhandled rejection: ' + msg);
        failed++;
    });
    for (const spec of [
        { name: 'toggleFaucet', fn: function () { return fns.toggleFaucet; }, data: { paused: false } },
        { name: 'adminResolveCipherSatsClaim', fn: function () { return require(path.join(fnRoot, 'src', 'gifting.js')).adminResolveCipherSatsClaim; }, data: { claimId: 'c1', action: 'release' } },
    ]) {
        await test('F7: ' + spec.name + ' refuses a non-admin first', async function () {
            const r = await settle(spec.fn().run(spec.data, PLAYER), 1500);
            assert.ok(r.err && r.err.code === 'permission-denied', JSON.stringify(r) + ' ' + String(r.err && r.err.message));
        });
        await test('F7: ' + spec.name + ' refuses an admin with no fresh proof, and a raw code is not accepted', async function () {
            NOW = T0;
            const { db } = setup();
            const r = await settle(spec.fn().run(spec.data, ctx('adminA1')), 1500);
            assert.ok(r.err && r.err.code === 'failed-precondition', String(r.err && r.err.message));
            const r2 = await settle(spec.fn().run(Object.assign({ code: codeAt(NOW) }, spec.data), ctx('adminA1')), 1500);
            assert.ok(r2.err && r2.err.code === 'failed-precondition', 'raw code refused');
            assert.ok(!db.store.has('totp_fresh_proofs/adminA1_' + spec.name));
        });
        await test('F7: ' + spec.name + ' consumes a single-use proof and refuses it the second time', async function () {
            NOW = T0;
            const { api, db } = setup();
            const proof = await api.totpStepUp.run({ action: spec.name, code: codeAt(NOW) }, ctx('adminA1'));
            await settle(spec.fn().run(Object.assign({ freshProofId: proof.freshProofId }, spec.data), ctx('adminA1')), 1500);
            assert.strictEqual(db.store.get('totp_fresh_proofs/adminA1_' + spec.name).consumed, true);
            const again = await settle(spec.fn().run(Object.assign({ freshProofId: proof.freshProofId }, spec.data), ctx('adminA1')), 1500);
            assert.ok(again.err && again.err.code === 'failed-precondition');
        });
        await test('F7: ' + spec.name + ' refuses a proof minted for another action', async function () {
            NOW = T0;
            const { api } = setup();
            const proof = await api.totpStepUp.run({ action: 'adminSetKillSwitch', code: codeAt(NOW) }, ctx('adminA1'));
            const r = await settle(spec.fn().run(Object.assign({ freshProofId: proof.freshProofId }, spec.data), ctx('adminA1')), 1500);
            assert.ok(r.err && r.err.code === 'failed-precondition');
        });
    }

    await test('every guarded callable source calls requireAdminToolSession with its tool', function () {
        const files = ['functions/src/gifting.js', 'functions/src/factionRaceJobs.js', 'functions/src/satoshiFavor.js', 'functions/src/topicDiscussion.js', 'functions/src/killSwitch.js', 'functions/index.js'];
        const src = files.map(function (f) { return fs.readFileSync(path.join(root, f), 'utf8'); }).join('\n');
        Object.keys(tools.GUARDED_CALLABLES).forEach(function (name) {
            const tool = tools.GUARDED_CALLABLES[name];
            assert.ok(src.includes("'" + tool + "'"), tool);
        });
    });


    await test('MED1: kill-switch ON skips the 20/day cap but keeps the 2-minute limit; OFF keeps the daily cap', async function () {
        NOW = T0;
        const { api, db } = setup();
        db.store.set('totp_rate_limits/adminA1_day', {
            uid: 'adminA1',
            failedAttempts: 20,
            failedWindowStartMs: NOW,
            expireAt: new Date(NOW + 24 * 60 * 60 * 1000),
        });
        const offErr = await expectErr(api.totpStepUp.run({ action: 'adminSetKillSwitch', code: codeAt(NOW) }, ctx('adminA1')), 'resource-exhausted');
        assert.ok(/tomorrow/i.test(offErr.message), offErr.message);
        const onProof = await api.totpStepUp.run({ action: 'adminSetKillSwitchOn', code: codeAt(NOW) }, ctx('adminA1'));
        assert.ok(/^[a-f0-9]{32}$/.test(onProof.freshProofId), 'ON still accepts a good code after the daily cap');
        const dayAfterOn = db.store.get('totp_rate_limits/adminA1_day');
        assert.ok(dayAfterOn && dayAfterOn.failedAttempts === 20, 'ON success must not clear the shared daily count');
        // A raw code on requireAdminStepUp for ON also skips the daily cap.
        NOW = T0 + 31000;
        db.store.set('totp_rate_limits/adminA1_day', {
            uid: 'adminA1',
            failedAttempts: 20,
            failedWindowStartMs: NOW,
            expireAt: new Date(NOW + 24 * 60 * 60 * 1000),
        });
        const stamped = api.stamp({ code: codeAt(NOW) }, ctx('adminA1'));
        const stepped = await api.requireAdminStepUp(stamped, 'adminSetKillSwitchOn', { skipDailyCap: true });
        assert.strictEqual(stepped.totp, true);
        const dayAfterStep = db.store.get('totp_rate_limits/adminA1_day');
        assert.ok(dayAfterStep && dayAfterStep.failedAttempts === 20, 'requireAdminStepUp ON success must not clear the shared daily count');
        // The 2-minute window still blocks ON after 5 guesses.
        const bad = codeAt(NOW) === '000000' ? '111111' : '000000';
        for (let i = 0; i < 5; i++) {
            await expectErr(api.totpStepUp.run({ action: 'adminSetKillSwitchOn', code: bad }, ctx('adminA1')), 'invalid-argument');
        }
        const winErr = await expectErr(api.totpStepUp.run({ action: 'adminSetKillSwitchOn', code: codeAt(NOW) }, ctx('adminA1')), 'resource-exhausted');
        assert.ok(/2 minutes/i.test(winErr.message), winErr.message);
        NOW = T0;
    });

    await test('L1: totpStepUp adminSetKillSwitchOn is refused for non-admins before the code is used', async function () {
        NOW = T0;
        const { api } = setup();
        const code = codeAt(NOW);
        const err = await expectErr(api.totpStepUp.run({ action: 'adminSetKillSwitchOn', code: code }, ctx('adminA1', { admin: false })), 'permission-denied');
        assert.ok(/admin/i.test(err.message), err.message);
        // The same code still works for an admin, so it was not consumed.
        const onProof = await api.totpStepUp.run({ action: 'adminSetKillSwitchOn', code: code }, ctx('adminA1'));
        assert.ok(/^[a-f0-9]{32}$/.test(onProof.freshProofId));
        // Other actions stay open to a signed-in non-admin (the proof is still
        // useless on admin callables, which check the claim themselves).
        NOW = T0 + 31000;
        const other = await api.totpStepUp.run({ action: 'toggleFaucet', code: codeAt(NOW) }, ctx('adminA1', { admin: false }));
        assert.ok(other && other.freshProofId);
        NOW = T0;
    });

    await test('S2: ON success leaves other actions capped at the shared 20/day count', async function () {
        NOW = T0;
        const { api, db } = setup();
        db.store.set('totp_rate_limits/adminA1_day', {
            uid: 'adminA1',
            failedAttempts: 20,
            failedWindowStartMs: NOW,
            expireAt: new Date(NOW + 24 * 60 * 60 * 1000),
        });
        const onProof = await api.totpStepUp.run({ action: 'adminSetKillSwitchOn', code: codeAt(NOW) }, ctx('adminA1'));
        assert.ok(onProof && onProof.freshProofId);
        assert.strictEqual(db.store.get('totp_rate_limits/adminA1_day').failedAttempts, 20);
        const offErr = await expectErr(api.totpStepUp.run({ action: 'toggleFaucet', code: codeAt(NOW) }, ctx('adminA1')), 'resource-exhausted');
        assert.ok(/tomorrow/i.test(offErr.message), offErr.message);
        NOW = T0;
    });

    await test('S2: ON path uses a separate 100/day cap, audits failures, and alerts past 20', async function () {
        NOW = T0;
        const { api, db } = setup();
        assert.strictEqual(ON_DAILY_FAIL_MAX, 100);
        assert.strictEqual(DAILY_FAIL_MAX, 20);
        const bad = codeAt(NOW) === '000000' ? '111111' : '000000';
        db.store.set('totp_rate_limits/adminA1_day_killswitch_on', {
            uid: 'adminA1',
            failedAttempts: 20,
            failedWindowStartMs: NOW,
            expireAt: new Date(NOW + 24 * 60 * 60 * 1000),
        });
        await expectErr(api.totpStepUp.run({ action: 'adminSetKillSwitchOn', code: bad }, ctx('adminA1')), 'invalid-argument');
        const onDay = db.store.get('totp_rate_limits/adminA1_day_killswitch_on');
        assert.strictEqual(onDay.failedAttempts, 21);
        assert.strictEqual(onDay.alertedOver20, true);
        const logs = logRows(db, 'admin_killswitch_on_step_up_failed');
        assert.ok(logs.some(function (r) { return r.data.failedAttempts === 21 && r.data.reason === 'invalid'; }));
        function noteCount() {
            let n = 0;
            db.store.forEach(function (v, k) {
                if (k.indexOf('admin_notifications/') === 0 && v.type === 'killswitch_on_failures') n++;
            });
            return n;
        }
        assert.strictEqual(noteCount(), 1, 'one admin alert when ON failures go past 20');
        await expectErr(api.totpStepUp.run({ action: 'adminSetKillSwitchOn', code: bad }, ctx('adminA1')), 'invalid-argument');
        assert.strictEqual(db.store.get('totp_rate_limits/adminA1_day_killswitch_on').failedAttempts, 22);
        assert.strictEqual(noteCount(), 1, 'later failures do not send another alert the same day');

        NOW = T0 + 130000;
        db.store.set('totp_rate_limits/adminA1_day_killswitch_on', {
            uid: 'adminA1',
            failedAttempts: 100,
            failedWindowStartMs: NOW,
            expireAt: new Date(NOW + 24 * 60 * 60 * 1000),
        });
        const capErr = await expectErr(api.totpStepUp.run({ action: 'adminSetKillSwitchOn', code: codeAt(NOW) }, ctx('adminA1')), 'resource-exhausted');
        assert.ok(/tomorrow/i.test(capErr.message), capErr.message);
        assert.ok(logRows(db, 'admin_killswitch_on_step_up_failed').some(function (r) { return r.data.reason === 'on-day-cap'; }));

        NOW = T0 + 260000;
        db.store.set('totp_rate_limits/adminA1_day_killswitch_on', {
            uid: 'adminA1',
            failedAttempts: 99,
            failedWindowStartMs: NOW,
            expireAt: new Date(NOW + 24 * 60 * 60 * 1000),
        });
        const still = await api.totpStepUp.run({ action: 'adminSetKillSwitchOn', code: codeAt(NOW) }, ctx('adminA1'));
        assert.ok(still && still.freshProofId, 'ON still works until the 100/day cap');
        assert.strictEqual(db.store.get('totp_rate_limits/adminA1_day_killswitch_on').failedAttempts, 99, 'ON success does not clear the ON-path daily count');
        NOW = T0;
    });

    await test('L1: a too-new factor after the proof is consumed marks proofConsumed and the proof cannot be reused', async function () {
        NOW = T0;
        const { api } = setup({ totpEnabledAt: T0 - 3600000 });
        const onProof = await api.totpStepUp.run({ action: 'adminSetKillSwitchOn', code: codeAt(NOW) }, ctx('adminA1'));
        assert.ok(onProof && onProof.freshProofId);
        const stamped = api.stamp({ freshProofId: onProof.freshProofId }, ctx('adminA1'));
        const err = await expectErr(api.requireAdminStepUp(stamped, 'adminSetKillSwitchOn', { skipDailyCap: true }), 'failed-precondition');
        assert.ok(/too new/i.test(err.message), err.message);
        assert.strictEqual(err.details && err.details.proofConsumed, true);
        const again = await expectErr(api.requireAdminStepUp(stamped, 'adminSetKillSwitchOn', { skipDailyCap: true }), 'failed-precondition');
        assert.ok(/fresh authenticator code/i.test(again.message), again.message);
        NOW = T0;
    });

    await test('MED2: phone-only requireAdminStepUp consumes the sign-in once per action', async function () {
        NOW = T0;
        const { api, db } = setup({ totp: false, phone: true });
        const fresh = { auth_time: Math.floor((NOW - 30000) / 1000), firebase: { sign_in_provider: 'password', sign_in_second_factor: 'phone' } };
        const first = await api.requireAdminStepUp(ctx('adminA1', fresh), 'toggleFaucet');
        assert.strictEqual(first.phone, true);
        const row = db.store.get('admin_tool_sessions/adminA1__phone_step_toggleFaucet');
        assert.ok(row, 'phone step-up row written');
        assert.strictEqual(row.lastAuthTimeMs, fresh.auth_time * 1000);
        assert.strictEqual(row.consumed, true);
        await expectErr(api.requireAdminStepUp(ctx('adminA1', fresh), 'toggleFaucet'), 'failed-precondition');
        // Different action is separately consumed (unlike the tool-open
        // {uid}__phone row, which is once per sign-in across all tools).
        const other = await api.requireAdminStepUp(ctx('adminA1', fresh), 'adminSetKillSwitch');
        assert.strictEqual(other.phone, true);
        await expectErr(api.requireAdminStepUp(ctx('adminA1', fresh), 'adminSetKillSwitch'), 'failed-precondition');
        // A newer phone sign-in can prove the same action again.
        const later = { auth_time: Math.floor((NOW - 5000) / 1000), firebase: { sign_in_provider: 'password', sign_in_second_factor: 'phone' } };
        const again = await api.requireAdminStepUp(ctx('adminA1', later), 'toggleFaucet');
        assert.strictEqual(again.phone, true);
        NOW = T0;
    });

    await test('client: every banner tile asks for a fresh code before it opens', function () {
        const panel = fs.readFileSync(path.join(root, 'admin-panel.js'), 'utf8');
        assert.ok(/bqAdminToolStepUp\(t\.id/.test(panel), 'tile click goes through bqAdminToolStepUp');
        const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
        assert.ok(ranking.includes('window.bqAdminToolStepUp = function'));
        assert.ok(ranking.includes("httpsCallable('totpStepUp')({ tool: tool"));
    });

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
