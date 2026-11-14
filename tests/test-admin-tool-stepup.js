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
const { initSecondFactor } = require(path.join(fnRoot, 'src', 'secondFactor.js'));
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
    const users = {
        adminA1: { uid: 'adminA1', customClaims: { admin: true }, multiFactor: { enrolledFactors: o.phone ? [{ uid: 'ph1', factorId: 'phone', enrollmentTime: new Date(T0 - 3 * 86400000).toISOString() }] : [] } },
    };
    const adminSdk = {
        auth: function () { return { async getUser(uid) { if (!users[uid]) throw new Error('no user'); return users[uid]; } }; },
        firestore: { FieldValue: { serverTimestamp: function () { return 'ts'; } } },
    };
    const api = initSecondFactor({
        db: db,
        admin: adminSdk,
        HttpsError: FakeHttpsError,
        authenticator: authenticator,
        QRCode: { toDataURL: async function () { return ''; } },
    });
    if (o.totp !== false) {
        db.store.set('totp_secrets/adminA1', { uid: 'adminA1', enabled: true, secret: SEED, secretEnc: false, enabledAt: T0 - 3 * 86400000 });
    }
    return { api: api, db: db };
}

function ctx(uid, tokenExtra, ip) {
    return {
        auth: { uid: uid, token: Object.assign({ admin: true, auth_time: Math.floor((NOW - 60000) / 1000), firebase: { sign_in_provider: 'password' } }, tokenExtra || {}) },
        rawRequest: { ip: ip || '203.0.113.7', headers: {} },
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
    return db.adds.filter(function (a) { return a.col === 'mfa_admin_log' && (!action || a.data.action === action); });
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
            await expectErr(api.totpStepUp.run({ tool: 'forum', code: bad }, ctx('adminA1', null, '198.51.100.' + (i + 1))), 'invalid-argument');
        }
        await expectErr(api.totpStepUp.run({ tool: 'forum', code: good }, ctx('adminA1', null, '198.51.100.99')), 'resource-exhausted');
        assert.ok(!db.store.has('admin_tool_sessions/adminA1_forum'));
    });

    await test('rate limit per IP: 5 failed tries from one address block the next', async function () {
        NOW = T0;
        const { api, db } = setup();
        // Spread the uid limit across admins so only the IP bucket is hit.
        for (let i = 0; i < 5; i++) {
            const uid = 'adminX' + i;
            await expectErr(api.totpStepUp.run({ tool: 'forum', code: '000000' }, ctx(uid, null, '192.0.2.50')), 'failed-precondition');
        }
        await expectErr(api.totpStepUp.run({ tool: 'forum', code: codeAt(NOW) }, ctx('adminA1', null, '192.0.2.50')), 'resource-exhausted');
        assert.ok(!db.store.has('admin_tool_sessions/adminA1_forum'));
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

    await test('every guarded callable source calls requireAdminToolSession with its tool', function () {
        const files = ['functions/src/gifting.js', 'functions/src/factionRaceJobs.js', 'functions/src/satoshiFavor.js', 'functions/src/topicDiscussion.js', 'functions/src/killSwitch.js', 'functions/index.js'];
        const src = files.map(function (f) { return fs.readFileSync(path.join(root, f), 'utf8'); }).join('\n');
        Object.keys(tools.GUARDED_CALLABLES).forEach(function (name) {
            const tool = tools.GUARDED_CALLABLES[name];
            assert.ok(src.includes("'" + tool + "'"), tool);
        });
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
