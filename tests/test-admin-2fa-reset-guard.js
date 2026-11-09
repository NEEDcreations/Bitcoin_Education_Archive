#!/usr/bin/env node
'use strict';

// adminResetSecondFactor must refuse when the target account holds the admin
// claim (another admin, or the caller), keep an audit row, and still reset a
// normal account. Uses in-memory fakes, so no emulator is needed.

const assert = require('assert');
const path = require('path');

if (!process.env.DELETION_HMAC_SECRET) process.env.DELETION_HMAC_SECRET = 'unit-deletion-secret-0123456789';
const { initSecondFactor } = require(path.join(__dirname, '..', 'functions', 'src', 'secondFactor.js'));

let passed = 0;
let failed = 0;
async function test(name, fn) {
    try { await fn(); console.log('\u2705 ' + name); passed++; }
    catch (e) { console.log('\u274c ' + name + '\n   ' + (e && e.stack ? e.stack : e)); failed++; }
}

class FakeHttpsError extends Error {
    constructor(code, message) { super(message); this.code = code; }
}

function makeDb() {
    const store = new Map(); // "col/id" -> data
    const adds = [];
    let auto = 0;
    function docRef(col, id) {
        const key = col + '/' + id;
        return {
            id: id,
            path: key,
            async get() { const d = store.get(key); return { id: id, exists: !!d, data: function () { return d; }, ref: this }; },
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
            where: function () {
                return { async get() { return { empty: true, size: 0, docs: [], forEach: function () {} }; } };
            },
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

function makeAdmin(users) {
    const updates = [];
    const auth = {
        async getUser(uid) {
            if (!users[uid]) { const e = new Error('no user'); e.code = 'auth/user-not-found'; throw e; }
            return users[uid];
        },
        async updateUser(uid, patch) { updates.push({ uid: uid, patch: patch }); return users[uid]; },
    };
    const adminSdk = {
        auth: function () { return auth; },
        firestore: { FieldValue: { serverTimestamp: function () { return 'ts'; } } },
        updates: updates,
    };
    return adminSdk;
}

function adminCtx(uid) {
    return { auth: { uid: uid, token: { admin: true, firebase: { sign_in_provider: 'password' } } } };
}

function setup() {
    const users = {
        adminAaaa01: { uid: 'adminAaaa01', customClaims: { admin: true }, multiFactor: { enrolledFactors: [] } },
        adminBbbb02: { uid: 'adminBbbb02', customClaims: { admin: true }, multiFactor: { enrolledFactors: [] } },
        playerCc03: { uid: 'playerCc03', customClaims: {}, multiFactor: { enrolledFactors: [] } },
    };
    const db = makeDb();
    const adminSdk = makeAdmin(users);
    const api = initSecondFactor({
        db: db,
        admin: adminSdk,
        HttpsError: FakeHttpsError,
        authenticator: { options: {}, verify: function () { return false; }, generateSecret: function () { return 'x'; } },
        QRCode: { toDataURL: async function () { return ''; } },
    });
    db.store.set('totp_secrets/adminBbbb02', { secret: 'enc' });
    db.store.set('recovery_codes/adminBbbb02', { codes: [] });
    db.store.set('totp_secrets/playerCc03', { secret: 'enc' });
    db.store.set('recovery_codes/playerCc03', { codes: [] });
    return { api: api, db: db };
}

async function expectCode(promise, code) {
    let err = null;
    try { await promise; } catch (e) { err = e; }
    assert.ok(err, 'expected a refusal');
    assert.strictEqual(err.code, code, 'got ' + (err && err.code) + ': ' + (err && err.message));
    return err;
}

(async function main() {
    await test('an admin cannot reset another admin, and the refusal is logged', async function () {
        const { api, db } = setup();
        const err = await expectCode(api.adminResetSecondFactor.run(
            { uid: 'adminBbbb02', note: 'Matched a support ticket and their email.' }, adminCtx('adminAaaa01')), 'permission-denied');
        assert.ok(/recovery code/i.test(err.message));
        assert.ok(db.store.has('totp_secrets/adminBbbb02'), 'target authenticator must stay on');
        assert.ok(db.store.has('recovery_codes/adminBbbb02'), 'target recovery codes must stay');
        const log = db.adds.filter(function (a) { return a.col === 'mfa_admin_log'; });
        assert.strictEqual(log.length, 1);
        assert.strictEqual(log[0].data.action, 'admin_reset_refused');
        assert.strictEqual(log[0].data.reason, 'target_is_admin');
        assert.strictEqual(log[0].data.targetUid, 'adminBbbb02');
        assert.strictEqual(log[0].data.adminUid, 'adminAaaa01');
        assert.ok(!db.adds.some(function (a) { return a.col === 'mfa_admin_log' && a.data.action === 'admin_reset'; }));
    });

    await test('an admin cannot reset their own two-factor through this callable', async function () {
        const { api } = setup();
        await expectCode(api.adminResetSecondFactor.run(
            { uid: 'adminAaaa01', note: 'Resetting my own account.' }, adminCtx('adminAaaa01')), 'permission-denied');
    });

    await test('an unknown target fails closed', async function () {
        const { api, db } = setup();
        await expectCode(api.adminResetSecondFactor.run(
            { uid: 'nobodyZz99', note: 'Matched a support ticket and their email.' }, adminCtx('adminAaaa01')), 'failed-precondition');
        assert.strictEqual(db.adds.filter(function (a) { return a.col === 'mfa_admin_log'; }).length, 0);
    });

    await test('a non-admin caller is still refused before any lookup', async function () {
        const { api } = setup();
        await expectCode(api.adminResetSecondFactor.run(
            { uid: 'playerCc03', note: 'Matched a support ticket and their email.' },
            { auth: { uid: 'playerCc03', token: { firebase: {} } } }), 'permission-denied');
    });

    await test('an admin can still reset a normal account and it is logged', async function () {
        const { api, db } = setup();
        const res = await api.adminResetSecondFactor.run(
            { uid: 'playerCc03', note: 'Matched a support ticket and their email.' }, adminCtx('adminAaaa01'));
        assert.strictEqual(res.success, true);
        assert.ok(!db.store.has('totp_secrets/playerCc03'));
        assert.ok(!db.store.has('recovery_codes/playerCc03'));
        assert.ok(db.adds.some(function (a) { return a.col === 'mfa_admin_log' && a.data.action === 'admin_reset' && a.data.targetUid === 'playerCc03'; }));
    });

    await test('the guard reads the Auth claim, not a Firestore field', async function () {
        const src = require('fs').readFileSync(path.join(__dirname, '..', 'functions', 'src', 'secondFactor.js'), 'utf8');
        const start = src.indexOf('const adminResetSecondFactor');
        const chunk = src.slice(start, src.indexOf('const api = {', start));
        assert.ok(chunk.includes('targetRec.customClaims && targetRec.customClaims.admin === true'));
        assert.ok(chunk.indexOf('targetIsAdmin') < chunk.indexOf('unenrollPhone(targetUid)'));
    });

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
