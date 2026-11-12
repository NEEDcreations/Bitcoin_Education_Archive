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
            return { uid, customClaims: u.claims || {}, multiFactor: { enrolledFactors: u.phoneAtMs ? [{ uid: u.phoneId || ('ph-' + uid), factorId: 'phone', enrollmentTime: new Date(u.phoneAtMs).toUTCString() }] : [] } };
        },
        async updateUser(uid, v) { updates.push([uid, v]); if (users[uid]) users[uid].phoneAtMs = 0; },
    };
    // Seed the server-recorded factor list for phones the test marks as
    // recorded (default: recorded when the phone was enrolled).
    Object.keys(users).forEach(uid => {
        const u = users[uid];
        if (!u.phoneAtMs || u.recorded === false) return;
        const enr = Math.floor(u.phoneAtMs / 1000) * 1000;
        const phones = {};
        phones[u.phoneId || ('ph-' + uid)] = { recordedAtMs: u.recordedAtMs || enr, enrollmentTimeMs: enr };
        db.store['mfa_known_factors/' + uid] = { uid, phones };
    });
    const api = SF.initSecondFactor({
        db,
        admin: { auth: () => authApi, firestore: { FieldValue: { serverTimestamp: () => new Date((global.__BTC_MFA_NOW__ || Date.now)()), increment: n => n, delete: () => undefined } } },
        HttpsError,
        authenticator: { generateSecret: () => 'x', keyuri: () => 'otpauth', checkDelta: (opts && opts.checkDelta) || (() => null), options: {} },
        QRCode: { toDataURL: async () => '' },
    });
    return { db, api, updates };
}

function ctx(uid, opts) {
    const o = opts || {};
    const firebase = { sign_in_second_factor: o.mfaSignIn === false ? undefined : 'phone' };
    if (o.secondFactorId) firebase.second_factor_identifier = o.secondFactorId;
    return {
        auth: { uid, token: { admin: o.admin !== false, auth_time: Math.floor((o.authAtMs || NOW - 60000) / 1000), firebase } },
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
test('source: App Check, TOTP key, and runtime SA on adminResetSecondFactor; action registered', () => {
    const src = fs.readFileSync(path.join(root, 'functions', 'src', 'secondFactor.js'), 'utf8');
    const fn = src.slice(src.indexOf('const adminResetSecondFactor = '), src.indexOf('await requireAdminStepUp(stamp(data, context), \'adminResetSecondFactor\')'));
    assert.ok(fn.indexOf('enforceAppCheck: true') > 0);
    assert.ok(fn.indexOf("secrets: ['TOTP_ENCRYPTION_KEY']") > 0);
    assert.ok(fn.indexOf("runtimeSa('adminResetSecondFactor')") > 0);
    assert.ok(/adminResetSecondFactor: true,/.test(src.slice(src.indexOf('const FRESH_ACTIONS'), src.indexOf('const RECOVERY_COUNT'))));
});
test('source: other step-up callables that decrypt TOTP also bind TOTP_ENCRYPTION_KEY', () => {
    const del = fs.readFileSync(path.join(root, 'functions', 'src', 'deleteAccount.js'), 'utf8');
    const delBind = del.slice(del.indexOf('function bindDeleteAccount'), del.indexOf('module.exports'));
    assert.ok(delBind.indexOf("TOTP_ENCRYPTION_KEY") > 0);
    const email = fs.readFileSync(path.join(root, 'functions', 'src', 'emailChange.js'), 'utf8');
    const emailBind = email.slice(email.indexOf('function bindEmailChange'), email.indexOf('module.exports'));
    assert.ok(emailBind.indexOf("prepareEmailChange: onCall('prepareEmailChange', handlers.prepareEmailChange, false, true)") > 0);
    assert.ok(emailBind.indexOf("confirmAccountLink: onCall('confirmAccountLink', handlers.confirmAccountLink, false, true)") > 0);
    assert.ok(emailBind.indexOf("syncEmailChange: onCall('syncEmailChange', handlers.syncEmailChange, true)") > 0);
    assert.ok(emailBind.indexOf("[secret, 'TOTP_ENCRYPTION_KEY']") > 0);
    const ln = fs.readFileSync(path.join(root, 'functions', 'src', 'resetLightningAddress.js'), 'utf8');
    const lnBind = ln.slice(ln.indexOf('function bindResetLightningAddress'), ln.indexOf('module.exports'));
    assert.ok(lnBind.indexOf("TOTP_ENCRYPTION_KEY") > 0);
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
    await assert.rejects(api.requireAdminStepUp(ctx('a1'), 'adminResetSecondFactor'), e => e.code === 'failed-precondition' && /too new|not added through the app/.test(e.message));
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
    assert.ok(between('const phoneFactorRemoved = ', 'async function requireAdminStepUp(').indexOf("alertAdminFactorChange(uid, 'removed', 'phone', { dedupeDaily: true })") > 0);
    assert.ok(src.indexOf("if (newPhones.length || freshPhone) await alertAdminFactorChange(uid, 'added', 'phone')") > 0);
    const helper = between('async function alertAdminFactorChange(', 'function knownRef(');
    assert.ok(helper.indexOf('customClaims.admin !== true') > 0 && helper.indexOf('notifyAdmin(') > 0);
    assert.strictEqual(helper.indexOf('uid: uid'), -1, 'no raw uid field');
});

// ---- Red Team #302 follow-up: server-recorded known factors ----
const KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
function withKey(fn) {
    return async () => {
        const prev = process.env.TOTP_ENCRYPTION_KEY;
        process.env.TOTP_ENCRYPTION_KEY = KEY;
        try { await fn(); } finally { if (prev === undefined) delete process.env.TOTP_ENCRYPTION_KEY; else process.env.TOTP_ENCRYPTION_KEY = prev; }
    };
}
const unrecAlerts = (db) => Object.keys(db.store).filter(k => k.indexOf('admin_notifications/') === 0).map(k => db.store[k]).filter(r => r.type === 'admin_factor_unrecorded');
test('known factors: an unrecorded admin phone (client-side enroll) is refused and alerts, rate-limited', async () => {
    const { api, db, updates } = setup({ a1: { claims: { admin: true }, phoneAtMs: NOW - 3 * DAY, recorded: false }, t1abcdef: { phoneAtMs: NOW - DAY } });
    await assert.rejects(run(api.adminResetSecondFactor, { uid: 't1abcdef', note: NOTE }, ctx('a1')), e => e.code === 'failed-precondition' && /not added through the app/.test(e.message));
    await assert.rejects(run(api.adminResetSecondFactor, { uid: 't1abcdef', note: NOTE }, ctx('a1')), e => e.code === 'failed-precondition');
    assert.strictEqual(updates.length, 0);
    const a = unrecAlerts(db);
    assert.strictEqual(a.length, 1, 'second refusal inside 6h does not alert again');
    assert.strictEqual(JSON.stringify(a[0]).indexOf('"a1"'), -1, 'no raw uid');
    assert.ok(a[0].uidHash && !('uid' in a[0]));
    assert.ok(!db.store['mfa_known_factors/a1'] || !db.store['mfa_known_factors/a1'].phones, 'step-up never records what Auth shows');
});
test('known factors: a recorded phone older than 24h passes', async () => {
    const { api, updates } = setup({ a1: { claims: { admin: true }, phoneAtMs: NOW - 3 * DAY, recordedAtMs: NOW - 2 * DAY }, t1abcdef: { phoneAtMs: NOW - DAY } });
    const res = await run(api.adminResetSecondFactor, { uid: 't1abcdef', note: NOTE }, ctx('a1'));
    assert.deepStrictEqual(res, { success: true });
    assert.strictEqual(updates.length, 1);
});
test('known factors: a recorded phone under 24h is refused (record or enrollment too new)', async () => {
    const a = setup({ a1: { claims: { admin: true }, phoneAtMs: NOW - 3 * DAY, recordedAtMs: NOW - 3600000 }, t1abcdef: {} });
    await assert.rejects(a.api.requireAdminStepUp(ctx('a1'), 'adminResetSecondFactor'), e => /too new/.test(e.message));
    const b = setup({ a1: { claims: { admin: true }, phoneAtMs: NOW - 3600000 } });
    await assert.rejects(b.api.requireAdminStepUp(ctx('a1'), 'adminResetSecondFactor'), e => /too new/.test(e.message));
});
async function seedTotp(db, uid, enabledAtMs) {
    await db.collection('totp_secrets').doc(uid).set({ secret: 'JBSWY3DPEHPK3PXP', secretEnc: false, enabled: true, enabledAt: new Date(enabledAtMs), lastAcceptedStep: 0 });
}
test("known factors: Phil-style legacy TOTP (totp_secrets server enabledAt, no list entry) keeps working", withKey(async () => {
    const { api, db } = setup({ phil0001: { claims: { admin: true } } }, { checkDelta: () => 0 });
    await seedTotp(db, 'phil0001', NOW - 29 * DAY);
    const sf = await api.requireAdminStepUp(Object.assign(ctx('phil0001', { mfaSignIn: false }), { freshCode: '123456' }), 'adminResetSecondFactor');
    assert.strictEqual(sf.established, true);
    assert.strictEqual(unrecAlerts(db).length, 0);
}));
test('known factors: TOTP whose enabledAt does not match the recorded entry is refused and alerts', withKey(async () => {
    const { api, db } = setup({ a2: { claims: { admin: true } } }, { checkDelta: () => 0 });
    await seedTotp(db, 'a2', NOW - 10 * DAY);
    db.store['mfa_known_factors/a2'] = { uid: 'a2', totp: { enabledAtMs: NOW - 40 * DAY, recordedAtMs: NOW - 40 * DAY } };
    await assert.rejects(api.requireAdminStepUp(Object.assign(ctx('a2', { mfaSignIn: false }), { freshCode: '123456' }), 'adminResetSecondFactor'), e => /does not match/.test(e.message));
    assert.strictEqual(unrecAlerts(db).length, 1);
}));
test('known factors: totpVerify records the TOTP with the exact server enabledAt', withKey(async () => {
    const { api, db } = setup({ adminUid0003: { claims: { admin: true } } }, { checkDelta: () => 0 });
    await db.collection('totp_pending').doc('adminUid0003').set({ secret: 'JBSWY3DPEHPK3PXP', secretEnc: false });
    const c = ctx('adminUid0003'); c.auth.token.firebase = { sign_in_provider: 'password' };
    await run(api.totpVerify, { code: '123456' }, c);
    const rec = db.store['mfa_known_factors/adminUid0003'];
    const sec = db.store['totp_secrets/adminUid0003'];
    assert.ok(rec && rec.totp && rec.totp.enabledAtMs > 0);
    assert.strictEqual(rec.totp.enabledAtMs, sec.enabledAt.getTime());
}));
test('known factors: issueRecoveryCodes records a proven phone (keyed by factor uid) and alerts', async () => {
    const { api, db } = setup({ adminUid0004: { claims: { admin: true }, phoneAtMs: NOW - 60000, recorded: false, phoneId: 'mfaEnroll123' } });
    await run(api.issueRecoveryCodes, {}, ctx('adminUid0004'));
    const rec = db.store['mfa_known_factors/adminUid0004'];
    assert.ok(rec && rec.phones && rec.phones.mfaEnroll123 && rec.phones.mfaEnroll123.recordedAtMs === NOW);
    assert.ok(adminAlerts(db).some(r => r.change === 'added' && r.factor === 'phone'));
});
test('known factors (c): codes already exist -> nothing recorded, unrecorded admin phone still alerts; step-up refuses', async () => {
    const { api, db } = setup({ adminUid0005: { claims: { admin: true }, phoneAtMs: NOW - 3 * DAY, recorded: false } });
    await db.collection('recovery_codes').doc('adminUid0005').set({ codes: [] });
    const r = await run(api.issueRecoveryCodes, {}, ctx('adminUid0005'));
    assert.deepStrictEqual(r, { already: true });
    assert.ok(!(db.store['mfa_known_factors/adminUid0005'] || {}).phones, 'no recording without proof');
    assert.strictEqual(unrecAlerts(db).length, 1);
    await assert.rejects(api.requireAdminStepUp(ctx('adminUid0005'), 'adminResetSecondFactor'), e => /not added through the app/.test(e.message));
});
test('known factors: non-admin phone factors are unaffected (normal second factor still passes)', async () => {
    const { api, db } = setup({ user0001: { claims: {}, phoneAtMs: NOW - 60000, recorded: false } });
    const sf = await api.requireSecondFactor(ctx('user0001', { admin: false }));
    assert.strictEqual(sf.phone, true);
    await db.collection('recovery_codes').doc('user0001').set({ codes: [] });
    await run(api.issueRecoveryCodes, {}, ctx('user0001', { admin: false }));
    assert.strictEqual(unrecAlerts(db).length + adminAlerts(db).length, 0, 'no admin alerts for a non-admin');
});
test('(a) phoneFactorRemoved notices dedupe per uid, change and day', async () => {
    const users = { adminUid0006: { claims: { admin: true } } };
    const { api, db } = setup(users);
    await run(api.phoneFactorRemoved, {}, ctx('adminUid0006'));
    await run(api.phoneFactorRemoved, {}, ctx('adminUid0006'));
    await run(api.phoneFactorRemoved, {}, ctx('adminUid0006'));
    assert.strictEqual(adminAlerts(db).filter(r => r.change === 'removed').length, 1);
    const prev = global.__BTC_MFA_NOW__;
    global.__BTC_MFA_NOW__ = () => NOW + DAY;
    try { await run(api.phoneFactorRemoved, {}, ctx('adminUid0006')); } finally { global.__BTC_MFA_NOW__ = prev; }
    assert.strictEqual(adminAlerts(db).filter(r => r.change === 'removed').length, 2, 'next day alerts again');
});
test('(b) mfa_admin_reset and mfa_recovery notices carry no raw uid', async () => {
    const { api, db } = setup({ a1: { claims: { admin: true }, phoneAtMs: NOW - 2 * DAY }, t1abcdef: { phoneAtMs: NOW - DAY } });
    await run(api.adminResetSecondFactor, { uid: 't1abcdef', note: NOTE }, ctx('a1'));
    const row = Object.keys(db.store).filter(k => k.indexOf('admin_notifications/') === 0).map(k => db.store[k]).find(r => r.type === 'mfa_admin_reset');
    assert.ok(row && row.uidHash && row.adminUidHash);
    assert.ok(!('uid' in row) && !('adminUid' in row));
    assert.strictEqual(JSON.stringify(row).indexOf('t1abcdef'), -1);
    const src = fs.readFileSync(path.join(root, 'functions', 'src', 'secondFactor.js'), 'utf8');
    const rec = src.slice(src.indexOf("type: 'mfa_recovery'") - 80, src.indexOf("type: 'mfa_recovery'") + 300);
    assert.ok(rec.indexOf('maskUid(uid)') > 0 && rec.indexOf('uid: uid') === -1);
});

test('source: App Check, rate limit, and key-bound SA on recordKnownPhoneFactor; not a session proof', () => {
    const src = fs.readFileSync(path.join(root, 'functions', 'src', 'secondFactor.js'), 'utf8');
    const fn = src.slice(src.indexOf('const recordKnownPhoneFactor = '), src.indexOf('async function requireAdminStepUp('));
    assert.ok(fn.indexOf('enforceAppCheck: true') > 0);
    assert.ok(fn.indexOf("secrets: ['TOTP_ENCRYPTION_KEY']") > 0);
    assert.ok(fn.indexOf("runtimeSa('recordKnownPhoneFactor')") > 0);
    assert.ok(fn.indexOf("takeAttempt('recordKnownPhone:' + uid, nowMs)") > 0);
    assert.ok(fn.indexOf('acceptTotp(') > 0);
    assert.ok(fn.indexOf('secretRecord(uid)') > 0);
    assert.ok(fn.indexOf('if (secret)') < fn.indexOf('else if (phoneFresh)'), 'TOTP accounts cannot use the phone-token branch');
    assert.ok(fn.indexOf('sessionValid(') === -1, 'sessions must not count as proof');
    assert.ok(fn.indexOf('FRESH_TTL_MS') > 0, 'phone sign-in must be within 5 minutes');
    assert.ok(fn.indexOf('second_factor_identifier') > 0);
    const idx = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    assert.ok(idx.indexOf('exports.recordKnownPhoneFactor = secondFactor.recordKnownPhoneFactor') > 0);
});
test('D1: fresh TOTP records current phone factors, stores enrollment + recordedAt, and alerts', withKey(async () => {
    const { api, db } = setup({ adminUidD101: { claims: { admin: true }, phoneAtMs: NOW - 3 * DAY, recorded: false, phoneId: 'mfaLegacyPhone' } }, { checkDelta: () => 0 });
    await seedTotp(db, 'adminUidD101', NOW - 29 * DAY);
    const res = await run(api.recordKnownPhoneFactor, { code: '123456' }, ctx('adminUidD101', { mfaSignIn: false }));
    assert.deepStrictEqual(res, { success: true, recorded: 1 });
    const rec = db.store['mfa_known_factors/adminUidD101'].phones.mfaLegacyPhone;
    const enr = Math.floor((NOW - 3 * DAY) / 1000) * 1000;
    assert.strictEqual(rec.recordedAtMs, NOW);
    assert.strictEqual(rec.enrollmentTimeMs, enr);
    const alerts = adminAlerts(db);
    assert.strictEqual(alerts.length, 1);
    assert.strictEqual(alerts[0].change, 'added');
    assert.strictEqual(alerts[0].factor, 'phone');
    assert.strictEqual(JSON.stringify(alerts[0]).indexOf('adminUidD101'), -1, 'raw uid never in the alert');
    assert.strictEqual(SF.factorEstablished(rec.recordedAtMs, NOW), false, '24h clock starts at recordedAt');
    assert.strictEqual(SF.factorEstablished(rec.enrollmentTimeMs, NOW), true, 'enrollment can already be 24h old');
}));
test('D1: already-recorded matching phone is a no-op (no second alert)', withKey(async () => {
    const { api, db } = setup({ adminUidD102: { claims: { admin: true }, phoneAtMs: NOW - 3 * DAY, recorded: true, phoneId: 'mfaAlready' } }, { checkDelta: () => 0 });
    await seedTotp(db, 'adminUidD102', NOW - 29 * DAY);
    const res = await run(api.recordKnownPhoneFactor, { code: '123456' }, ctx('adminUidD102', { mfaSignIn: false }));
    assert.deepStrictEqual(res, { success: true, recorded: 0 });
    assert.strictEqual(adminAlerts(db).length, 0);
}));
test('D1: enrollmentTime mismatch is refused and the record is not overwritten', withKey(async () => {
    const { api, db } = setup({ adminUidD103: { claims: { admin: true }, phoneAtMs: NOW - 3 * DAY, recorded: true, phoneId: 'mfaMismatch' } }, { checkDelta: () => 0 });
    await seedTotp(db, 'adminUidD103', NOW - 29 * DAY);
    db.store['mfa_known_factors/adminUidD103'].phones.mfaMismatch.enrollmentTimeMs = NOW - 40 * DAY;
    const before = Object.assign({}, db.store['mfa_known_factors/adminUidD103'].phones.mfaMismatch);
    await assert.rejects(run(api.recordKnownPhoneFactor, { code: '123456' }, ctx('adminUidD103', { mfaSignIn: false })), e => e.code === 'failed-precondition' && /does not match/.test(e.message));
    assert.deepStrictEqual(db.store['mfa_known_factors/adminUidD103'].phones.mfaMismatch, before);
    assert.strictEqual(adminAlerts(db).length, 0, 'no factor-change alert');
    assert.strictEqual(unrecAlerts(db).length, 1, 'P3: mismatch alerts before the throw');
}));
test('P2/P3: issueRecoveryCodes checks factor mismatch before storing codes, and alerts', async () => {
    const { api, db } = setup({ adminUidP201: { claims: { admin: true }, phoneAtMs: NOW - 3 * DAY, recorded: true, phoneId: 'mfaIrcMismatch' } });
    db.store['mfa_known_factors/adminUidP201'].phones.mfaIrcMismatch.enrollmentTimeMs = NOW - 40 * DAY;
    const before = Object.assign({}, db.store['mfa_known_factors/adminUidP201'].phones.mfaIrcMismatch);
    await assert.rejects(run(api.issueRecoveryCodes, {}, ctx('adminUidP201')), e => e.code === 'failed-precondition' && /does not match/.test(e.message));
    assert.deepStrictEqual(db.store['mfa_known_factors/adminUidP201'].phones.mfaIrcMismatch, before);
    assert.ok(!db.store['recovery_codes/adminUidP201'], 'codes must not be stored after a mismatch');
    assert.strictEqual(unrecAlerts(db).length, 1, 'P3: mismatch alerts before the throw');
    const src = fs.readFileSync(path.join(root, 'functions', 'src', 'secondFactor.js'), 'utf8');
    const fn = src.slice(src.indexOf('const issueRecoveryCodes = '), src.indexOf('const regenerateRecoveryCodes'));
    assert.ok(fn.indexOf('recordPhoneFactors(') < fn.indexOf('storeRecoveryCodes('), 'P2: record before store');
});
test('D1: fresh phone second-factor sign-in records that exact factor uid', async () => {
    const { api, db } = setup({ adminUidD104: { claims: { admin: true }, phoneAtMs: NOW - 2 * DAY, recorded: false, phoneId: 'mfaPhoneA' } });
    const res = await run(api.recordKnownPhoneFactor, {}, ctx('adminUidD104', { secondFactorId: 'mfaPhoneA', authAtMs: NOW - 60000 }));
    assert.deepStrictEqual(res, { success: true, recorded: 1 });
    const rec = db.store['mfa_known_factors/adminUidD104'].phones.mfaPhoneA;
    assert.ok(rec && rec.recordedAtMs === NOW);
    assert.ok(adminAlerts(db).some(r => r.change === 'added' && r.factor === 'phone'));
});
test('D1: phone sign-in older than 5 minutes is refused', async () => {
    const { api, db } = setup({ adminUidD105: { claims: { admin: true }, phoneAtMs: NOW - 2 * DAY, recorded: false, phoneId: 'mfaStale' } });
    await assert.rejects(run(api.recordKnownPhoneFactor, {}, ctx('adminUidD105', { secondFactorId: 'mfaStale', authAtMs: NOW - 6 * 60000 })), e => e.code === 'failed-precondition' && /Sign in again/.test(e.message));
    assert.ok(!(db.store['mfa_known_factors/adminUidD105'] || {}).phones);
});
test('D1: phone sign-in with a different factor uid is refused', async () => {
    const { api, db } = setup({ adminUidD106: { claims: { admin: true }, phoneAtMs: NOW - 2 * DAY, recorded: false, phoneId: 'mfaReal' } });
    await assert.rejects(run(api.recordKnownPhoneFactor, {}, ctx('adminUidD106', { secondFactorId: 'mfaOther', authAtMs: NOW - 60000 })), e => e.code === 'failed-precondition' && /does not match/.test(e.message));
    assert.ok(!(db.store['mfa_known_factors/adminUidD106'] || {}).phones);
});
test('D1: a TOTP session is not accepted as proof; no code and no phone sign-in is refused', withKey(async () => {
    const { api, db } = setup({ adminUidD107: { claims: { admin: true }, phoneAtMs: NOW - 2 * DAY, recorded: false, phoneId: 'mfaSess' } }, { checkDelta: () => 0 });
    await seedTotp(db, 'adminUidD107', NOW - 29 * DAY);
    await db.collection('totp_sessions').doc('adminUidD107').set({ uid: 'adminUidD107', sessionId: 'abcd', expiresAtMs: NOW + 3600000, expireAt: new Date(NOW + 3600000) });
    const c = ctx('adminUidD107', { mfaSignIn: false });
    c.mfaSessionId = 'abcd';
    await assert.rejects(run(api.recordKnownPhoneFactor, { mfaSessionId: 'abcd' }, c), e => e.code === 'failed-precondition' && /fresh authenticator code/.test(e.message));
    assert.ok(!(db.store['mfa_known_factors/adminUidD107'] || {}).phones);
}));
test('D1: rate limit is 5 attempts per 2 minutes', async () => {
    const { api } = setup({ adminUidD108: { claims: { admin: true }, phoneAtMs: NOW - 2 * DAY, recorded: false } });
    const c = ctx('adminUidD108', { mfaSignIn: false });
    for (let i = 0; i < 5; i++) {
        await assert.rejects(run(api.recordKnownPhoneFactor, {}, c), e => e.code === 'failed-precondition');
    }
    await assert.rejects(run(api.recordKnownPhoneFactor, {}, c), e => e.code === 'resource-exhausted');
});
test('D1: unsigned-in caller is refused; no phone enrolled is refused', withKey(async () => {
    const { api, db } = setup({ adminUidD109: { claims: { admin: true } } }, { checkDelta: () => 0 });
    await seedTotp(db, 'adminUidD109', NOW - 29 * DAY);
    await assert.rejects(run(api.recordKnownPhoneFactor, { code: '123456' }, { rawRequest: { headers: {} } }), e => e.code === 'unauthenticated');
    await assert.rejects(run(api.recordKnownPhoneFactor, { code: '123456' }, ctx('adminUidD109', { mfaSignIn: false })), e => e.code === 'failed-precondition' && /phone verification first/.test(e.message));
}));

test('Red Team: TOTP account + fresh phone token + no code is refused and records nothing', withKey(async () => {
    const { api, db } = setup({ adminUidRT01: { claims: { admin: true }, phoneAtMs: NOW - 2 * DAY, recorded: false, phoneId: 'mfaRtPhone' } }, { checkDelta: () => 0 });
    await seedTotp(db, 'adminUidRT01', NOW - 29 * DAY);
    await assert.rejects(run(api.recordKnownPhoneFactor, {}, ctx('adminUidRT01', { secondFactorId: 'mfaRtPhone', authAtMs: NOW - 60000 })), e => e.code === 'failed-precondition' && /fresh authenticator code/.test(e.message));
    assert.ok(!(db.store['mfa_known_factors/adminUidRT01'] || {}).phones, 'phone-token must not record on a TOTP account');
    assert.strictEqual(adminAlerts(db).length, 0);
}));
test('Red Team: TOTP account + valid fresh TOTP code records the phone', withKey(async () => {
    const { api, db } = setup({ adminUidRT02: { claims: { admin: true }, phoneAtMs: NOW - 2 * DAY, recorded: false, phoneId: 'mfaRtTotp' } }, { checkDelta: () => 0 });
    await seedTotp(db, 'adminUidRT02', NOW - 29 * DAY);
    // A fresh phone token may also be present; the code is what counts.
    const res = await run(api.recordKnownPhoneFactor, { code: '123456' }, ctx('adminUidRT02', { secondFactorId: 'mfaRtTotp', authAtMs: NOW - 60000 }));
    assert.deepStrictEqual(res, { success: true, recorded: 1 });
    assert.strictEqual(db.store['mfa_known_factors/adminUidRT02'].phones.mfaRtTotp.recordedAtMs, NOW);
    assert.ok(adminAlerts(db).some(r => r.change === 'added' && r.factor === 'phone'));
}));
test('Red Team: no-TOTP account + fresh phone token records the phone', async () => {
    const { api, db } = setup({ adminUidRT03: { claims: { admin: true }, phoneAtMs: NOW - 2 * DAY, recorded: false, phoneId: 'mfaRtNoTotp' } });
    const res = await run(api.recordKnownPhoneFactor, {}, ctx('adminUidRT03', { secondFactorId: 'mfaRtNoTotp', authAtMs: NOW - 60000 }));
    assert.deepStrictEqual(res, { success: true, recorded: 1 });
    assert.strictEqual(db.store['mfa_known_factors/adminUidRT03'].phones.mfaRtNoTotp.recordedAtMs, NOW);
});
test('step-up: TOTP-enabled admin cannot satisfy step-up with a recorded phone alone', withKey(async () => {
    // Established recorded phone, but the authenticator is under 24h old.
    // requireFreshStepUp still gets a valid code; phone must not waive the TOTP age.
    const { api, db } = setup({ adminUidRT04: { claims: { admin: true }, phoneAtMs: NOW - 3 * DAY, recordedAtMs: NOW - 3 * DAY, phoneId: 'mfaRtStep' } }, { checkDelta: () => 0 });
    await seedTotp(db, 'adminUidRT04', NOW - 3600000);
    await assert.rejects(api.requireAdminStepUp(Object.assign(ctx('adminUidRT04', { secondFactorId: 'mfaRtStep' }), { freshCode: '123456' }), 'adminResetSecondFactor'), e => e.code === 'failed-precondition' && /too new/.test(e.message));
    const src = fs.readFileSync(path.join(root, 'functions', 'src', 'secondFactor.js'), 'utf8');
    const fn = src.slice(src.indexOf('async function requireAdminStepUp('), src.indexOf('const adminResetSecondFactor = '));
    assert.ok(fn.indexOf('secret ? !totpOk : !phoneOk') > 0, 'TOTP-enabled step-up requires totpOk');
}));
test('step-up: TOTP-enabled admin with established TOTP still passes (phone also recorded)', withKey(async () => {
    const { api, db } = setup({ adminUidRT05: { claims: { admin: true }, phoneAtMs: NOW - 3 * DAY, recordedAtMs: NOW - 3 * DAY, phoneId: 'mfaRtOk' } }, { checkDelta: () => 0 });
    await seedTotp(db, 'adminUidRT05', NOW - 29 * DAY);
    const sf = await api.requireAdminStepUp(Object.assign(ctx('adminUidRT05', { secondFactorId: 'mfaRtOk' }), { freshCode: '123456' }), 'adminResetSecondFactor');
    assert.strictEqual(sf.established, true);
    assert.strictEqual(sf.totp, true);
}));
test('rules + deletion: mfa_known_factors is server-only and removed with the account', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    assert.ok(/match \/mfa_known_factors\/\{userId\} \{\s*allow read, write: if false;\s*\}/.test(rules));
    const del = fs.readFileSync(path.join(root, 'functions', 'src', 'deleteAccount.js'), 'utf8');
    assert.ok(del.indexOf("['mfa_known_factors', uid, []]") > 0);
    assert.ok(fs.existsSync(path.join(root, 'tests', 'rules', 'mfa-known-factors-rules.js')), 'emulator rules test present');
});

(async () => {
    for (const [name, fn] of queue) {
        try { await fn(); console.log('✅ ' + name); passed++; }
        catch (e) { console.log('❌ ' + name + ': ' + (e && e.message)); failed++; }
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
