#!/usr/bin/env node
'use strict';
// Hotfix: adminResetSecondFactor needs App Check, a recent sign-in, a fresh
// step-up with an ESTABLISHED caller factor, and never resets the caller's
// own account or another admin (Spam/Abuse re-check A1).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const SF = require(path.join(root, 'functions', 'src', 'secondFactor'));

let passed = 0, failed = 0;
const queue = [];
function test(name, fn) { queue.push([name, fn]); }

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;
global.__BTC_MFA_NOW__ = () => NOW;

class HttpsError extends Error { constructor(code, msg) { super(msg); this.code = code; } }

function fakeDb() {
    const store = {};
    let auto = 0;
    function docRef(col, id) {
        const key = col + '/' + id;
        return {
            id, path: key,
            async get() { const v = store[key]; return { exists: v !== undefined, id, ref: this, data: () => (v === undefined ? undefined : Object.assign({}, v)) }; },
            async set(v, o) { store[key] = o && o.merge ? Object.assign({}, store[key] || {}, v) : Object.assign({}, v); },
            async update(v) { store[key] = Object.assign({}, store[key] || {}, v); },
            async delete() { delete store[key]; },
        };
    }
    function colRef(col) {
        const filters = [];
        const q = {
            doc(id) { return docRef(col, id || ('auto' + (++auto))); },
            async add(v) { const r = docRef(col, 'auto' + (++auto)); await r.set(v); return r; },
            where(f, op, val) { filters.push([f, val]); return q; },
            limit() { return q; },
            async get() {
                const docs = Object.keys(store).filter(k => k.indexOf(col + '/') === 0)
                    .filter(k => filters.every(([f, val]) => store[k][f] === val))
                    .map(k => ({ id: k.slice(col.length + 1), ref: docRef(col, k.slice(col.length + 1)), data: () => store[k] }));
                return { empty: !docs.length, size: docs.length, docs, forEach: fn => docs.forEach(fn) };
            },
        };
        return q;
    }
    return {
        store,
        collection: colRef,
        batch() { const ops = []; return { delete(r) { ops.push(() => r.delete()); }, set(r, v, o) { ops.push(() => r.set(v, o)); }, update(r, v) { ops.push(() => r.update(v)); }, async commit() { for (const f of ops) await f(); } }; },
        async runTransaction(fn) { return fn({ get: r => r.get(), set: (r, v, o) => r.set(v, o), update: (r, v) => r.update(v), delete: r => r.delete(), create: (r, v) => r.set(v) }); },
    };
}

function setup(users, opts) {
    const db = fakeDb();
    const updates = [];
    const authApi = {
        async getUser(uid) {
            const u = users[uid];
            if (!u) throw new Error('no user');
            return { uid, customClaims: u.claims || {}, multiFactor: { enrolledFactors: u.phoneAtMs ? [{ factorId: 'phone', enrollmentTime: new Date(u.phoneAtMs).toUTCString() }] : [] } };
        },
        async updateUser(uid, v) { updates.push([uid, v]); if (users[uid]) users[uid].phoneAtMs = 0; },
    };
    const api = SF.initSecondFactor({
        db,
        admin: { auth: () => authApi, firestore: { FieldValue: { serverTimestamp: () => 'ts', increment: n => n, delete: () => undefined } } },
        HttpsError,
        authenticator: { generateSecret: () => 'x', keyuri: () => 'otpauth', checkDelta: (opts && opts.checkDelta) || (() => null), options: {} },
        QRCode: { toDataURL: async () => '' },
    });
    return { db, api, updates };
}

function ctx(uid, opts) {
    const o = opts || {};
    return {
        auth: { uid, token: { admin: o.admin !== false, auth_time: Math.floor((o.authAtMs || NOW - 60000) / 1000), firebase: { sign_in_second_factor: o.mfaSignIn === false ? undefined : 'phone' } } },
        rawRequest: { headers: {} },
    };
}
const run = (fn, data, c) => fn.run(data, c);
const NOTE = 'verified by video call';

test('pure: recentSignIn needs auth_time within 10 minutes', () => {
    assert.strictEqual(SF.recentSignIn(ctx('a', { authAtMs: NOW - 9 * 60000 }), NOW), true);
    assert.strictEqual(SF.recentSignIn(ctx('a', { authAtMs: NOW - 11 * 60000 }), NOW), false);
    assert.strictEqual(SF.recentSignIn({ auth: { token: {} } }, NOW), false);
    assert.strictEqual(SF.recentSignIn(ctx('a', { authAtMs: NOW + 3600000 }), NOW), false);
});
test('pure: factorEstablished = enrolled 24h+ ago only (A1b: sign-in time does not count)', () => {
    assert.strictEqual(SF.factorEstablished(NOW - DAY - 1, NOW), true);
    assert.strictEqual(SF.factorEstablished(NOW - DAY, NOW), true);
    assert.strictEqual(SF.factorEstablished(NOW - 3600000, NOW), false, 'enrolled before this sign-in but < 24h: no');
    assert.strictEqual(SF.factorEstablished(NOW - 30000, NOW), false);
    assert.strictEqual(SF.factorEstablished(0, NOW), false, 'missing enabledAt is not established');
    assert.strictEqual(SF.factorEstablished({ toMillis: () => NOW - 2 * DAY }, NOW), true, 'Firestore Timestamp');
    const m = SF.maskUid('abcdEFGH12345678');
    assert.strictEqual(m.uidHint, 'abcd\u2026');
    assert.ok(/^[0-9a-f]{16}$/.test(m.uidHash) && m.uidHash.indexOf('abcdEFGH') === -1);
});
test('source: App Check on adminResetSecondFactor; action registered', () => {
    const src = fs.readFileSync(path.join(root, 'functions', 'src', 'secondFactor.js'), 'utf8');
    assert.ok(src.indexOf('const adminResetSecondFactor = functionsV1.runWith({ enforceAppCheck: true }).https.onCall(') > 0);
    assert.ok(/adminResetSecondFactor: true,/.test(src.slice(src.indexOf('const FRESH_ACTIONS'), src.indexOf('const RECOVERY_COUNT'))));
});
test('refuses a non-admin', async () => {
    const { api } = setup({ a1: { claims: { admin: true }, phoneAtMs: NOW - 2 * DAY }, t1: {} });
    await assert.rejects(run(api.adminResetSecondFactor, { uid: 't1abcdef', note: NOTE }, ctx('a1', { admin: false })), e => e.code === 'permission-denied');
});
test('refuses the caller\'s own uid', async () => {
    const { api, updates } = setup({ a1abcdef: { claims: { admin: true }, phoneAtMs: NOW - 2 * DAY } });
    await assert.rejects(run(api.adminResetSecondFactor, { uid: 'a1abcdef', note: NOTE }, ctx('a1abcdef')), e => e.code === 'permission-denied');
    assert.strictEqual(updates.length, 0);
});
test('refuses a stale sign-in', async () => {
    const { api, updates } = setup({ a1: { claims: { admin: true }, phoneAtMs: NOW - 2 * DAY }, t1abcdef: { phoneAtMs: NOW - DAY } });
    await assert.rejects(run(api.adminResetSecondFactor, { uid: 't1abcdef', note: NOTE }, ctx('a1', { authAtMs: NOW - 30 * 60000 })), e => e.code === 'failed-precondition');
    assert.strictEqual(updates.length, 0);
});
test('refuses a caller with no second factor', async () => {
    const { api, updates } = setup({ a1: { claims: { admin: true } }, t1abcdef: { phoneAtMs: NOW - DAY } });
    await assert.rejects(run(api.adminResetSecondFactor, { uid: 't1abcdef', note: NOTE }, ctx('a1')), e => e.code === 'failed-precondition');
    assert.strictEqual(updates.length, 0);
});
test('refuses a caller whose factor was enrolled in this session', async () => {
    const { api, updates } = setup({ a1: { claims: { admin: true }, phoneAtMs: NOW - 30000 }, t1abcdef: { phoneAtMs: NOW - DAY } });
    await assert.rejects(run(api.adminResetSecondFactor, { uid: 't1abcdef', note: NOTE }, ctx('a1', { authAtMs: NOW - 60000 })), e => e.code === 'failed-precondition' && /too new/.test(e.message));
    assert.strictEqual(updates.length, 0);
});
test('refuses a phone caller without a second-factor sign-in', async () => {
    const { api, updates } = setup({ a1: { claims: { admin: true }, phoneAtMs: NOW - 2 * DAY }, t1abcdef: { phoneAtMs: NOW - DAY } });
    await assert.rejects(run(api.adminResetSecondFactor, { uid: 't1abcdef', note: NOTE }, ctx('a1', { mfaSignIn: false })), e => e.code === 'failed-precondition');
    assert.strictEqual(updates.length, 0);
});
test('refuses a target with the admin claim, logs the refusal', async () => {
    const { api, db, updates } = setup({ a1: { claims: { admin: true }, phoneAtMs: NOW - 2 * DAY }, t2admin: { claims: { admin: true }, phoneAtMs: NOW - DAY } });
    await assert.rejects(run(api.adminResetSecondFactor, { uid: 't2admin', note: NOTE }, ctx('a1')), e => e.code === 'permission-denied');
    assert.strictEqual(updates.length, 0);
    assert.ok(Object.keys(db.store).some(k => k.indexOf('mfa_admin_log/') === 0 && db.store[k].action === 'admin_reset_refused'));
});
test('refuses an unreadable target (fails closed)', async () => {
    const { api, updates } = setup({ a1: { claims: { admin: true }, phoneAtMs: NOW - 2 * DAY } });
    await assert.rejects(run(api.adminResetSecondFactor, { uid: 'ghost123', note: NOTE }, ctx('a1')), e => e.code === 'failed-precondition');
    assert.strictEqual(updates.length, 0);
});
test('allowed: established admin factor, fresh sign-in, non-admin target', async () => {
    const { api, db, updates } = setup({ a1: { claims: { admin: true }, phoneAtMs: NOW - 2 * DAY }, t1abcdef: { phoneAtMs: NOW - DAY } });
    const res = await run(api.adminResetSecondFactor, { uid: 't1abcdef', note: NOTE }, ctx('a1'));
    assert.deepStrictEqual(res, { success: true });
    assert.strictEqual(updates.length, 1);
    assert.strictEqual(updates[0][0], 't1abcdef');
    assert.ok(Object.keys(db.store).some(k => k.indexOf('mfa_admin_log/') === 0 && db.store[k].action === 'admin_reset'));
});

test('A1b: signing out and back in does not make a new factor count', async () => {
    // Phone enrolled 2h ago, fresh sign-in 1 min ago: auth_time is after
    // enrollment, but the factor is < 24h old, so it is refused.
    const { api, updates } = setup({ a1: { claims: { admin: true }, phoneAtMs: NOW - 2 * 3600000 }, t1abcdef: { phoneAtMs: NOW - DAY } });
    await assert.rejects(run(api.adminResetSecondFactor, { uid: 't1abcdef', note: NOTE }, ctx('a1', { authAtMs: NOW - 60000 })), e => e.code === 'failed-precondition' && /too new/.test(e.message));
    assert.strictEqual(updates.length, 0);
});
test('A1b: requireAdminStepUp busts the phoneInfo cache before reading', async () => {
    const users = { a1: { claims: { admin: true }, phoneAtMs: NOW - 2 * DAY }, t1abcdef: { phoneAtMs: NOW - DAY } };
    const { api } = setup(users);
    // Warm the 60 s cache with the old, established phone factor...
    await api.requireAdminStepUp(ctx('a1'), 'adminResetSecondFactor');
    // ...then the phone is removed and re-enrolled just now.
    users.a1.phoneAtMs = NOW - 10000;
    await assert.rejects(api.requireAdminStepUp(ctx('a1'), 'adminResetSecondFactor'), e => e.code === 'failed-precondition' && /too new/.test(e.message));
    const src = fs.readFileSync(path.join(root, 'functions', 'src', 'secondFactor.js'), 'utf8');
    const fn = src.slice(src.indexOf('async function requireAdminStepUp('), src.indexOf('const adminResetSecondFactor = '));
    assert.ok(fn.indexOf('forgetPhone(context.auth.uid)') > 0 && fn.indexOf('forgetPhone(context.auth.uid)') < fn.indexOf('requireFreshStepUp('));
});
function adminAlerts(db) {
    return Object.keys(db.store).filter(k => k.indexOf('admin_notifications/') === 0).map(k => db.store[k]).filter(r => r.type === 'admin_factor_change');
}
test('A1b: admin enrolling TOTP alerts admins (masked uid); a non-admin does not', async () => {
    const prevKey = process.env.TOTP_ENCRYPTION_KEY;
    process.env.TOTP_ENCRYPTION_KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
    try {
        for (const who of [{ uid: 'adminUid0001', admin: true }, { uid: 'plainUid0001', admin: false }]) {
            const users = {}; users[who.uid] = { claims: who.admin ? { admin: true } : {} };
            const { api, db } = setup(users, { checkDelta: () => 0 });
            await db.collection('totp_pending').doc(who.uid).set({ secret: 'JBSWY3DPEHPK3PXP', secretEnc: false });
            const c = ctx(who.uid, { admin: who.admin });
            c.auth.token.firebase = { sign_in_provider: 'password' };
            await run(api.totpVerify, { code: '123456' }, c).catch(e => { if (e.code !== undefined) throw e; });
            const alerts = adminAlerts(db);
            if (who.admin) {
                assert.strictEqual(alerts.length, 1, 'one alert for the admin');
                assert.strictEqual(alerts[0].change, 'added');
                assert.strictEqual(alerts[0].factor, 'totp');
                assert.strictEqual(JSON.stringify(alerts[0]).indexOf(who.uid), -1, 'raw uid never in the alert');
                assert.strictEqual(alerts[0].uidHint, 'admi\u2026');
            } else {
                assert.strictEqual(alerts.length, 0, 'no alert for a non-admin');
            }
        }
    } finally {
        if (prevKey === undefined) delete process.env.TOTP_ENCRYPTION_KEY; else process.env.TOTP_ENCRYPTION_KEY = prevKey;
    }
});
test('A1b: admin removing a phone factor alerts admins', async () => {
    const { api, db } = setup({ adminUid0002: { claims: { admin: true } } });
    await run(api.phoneFactorRemoved, {}, ctx('adminUid0002'));
    const alerts = adminAlerts(db);
    assert.strictEqual(alerts.length, 1);
    assert.strictEqual(alerts[0].change, 'removed');
    assert.strictEqual(JSON.stringify(alerts[0]).indexOf('adminUid0002'), -1);
});
test('A1b: every factor add/remove path calls the alert (source)', () => {
    const src = fs.readFileSync(path.join(root, 'functions', 'src', 'secondFactor.js'), 'utf8');
    const between = (a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a) + 1));
    assert.ok(between('const totpVerify = ', 'const totpCheck = ').indexOf("alertAdminFactorChange(uid, 'added', 'totp')") > 0);
    assert.ok(between('const totpDisable = ', 'const totpStatus = ').indexOf("alertAdminFactorChange(uid, 'removed', 'totp')") > 0);
    assert.ok(between('const useRecoveryCode = ', 'const phoneFactorRemoved = ').indexOf("alertAdminFactorChange(uid, 'removed'") > 0);
    assert.ok(between('const phoneFactorRemoved = ', 'async function requireAdminStepUp(').indexOf("alertAdminFactorChange(uid, 'removed', 'phone')") > 0);
    assert.ok(src.indexOf("if (freshPhone) await alertAdminFactorChange(uid, 'added', 'phone')") > 0);
    const helper = between('async function alertAdminFactorChange(', 'async function clearTotp(');
    assert.ok(helper.indexOf('customClaims.admin !== true') > 0 && helper.indexOf('notifyAdmin(') > 0);
    assert.strictEqual(helper.indexOf('uid: uid'), -1, 'no raw uid field');
});

(async () => {
    for (const [name, fn] of queue) {
        try { await fn(); console.log('✅ ' + name); passed++; }
        catch (e) { console.log('❌ ' + name + ': ' + (e && e.message)); failed++; }
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
