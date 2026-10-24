#!/usr/bin/env node
// Email change: prepare is generic, sync holds sats only when the prep row is missing.
const assert = require('assert');
const path = require('path');

const root = path.join(__dirname, '..');
const emailChange = require(path.join(root, 'functions', 'src', 'emailChange'));
const tomb = require(path.join(root, 'functions', 'src', 'accountTombstone'));
const referrals = require(path.join(root, 'functions', 'src', 'referrals'));
const { initSecondFactor } = require(path.join(root, 'functions', 'src', 'secondFactor'));

process.env.DELETION_HMAC_SECRET = 'unit-deletion-secret-0123456789';

function HttpsError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

function createDb(initial) {
    const docs = new Map();
    Object.keys(initial || {}).forEach(function (key) {
        docs.set(key, Object.assign({}, initial[key]));
    });
    function ref(docPath) {
        return {
            path: docPath,
            id: docPath.split('/').pop(),
            get: async function () {
                if (!docs.has(docPath)) return { exists: false, id: this.id, ref: this, data: function () { return undefined; } };
                return { exists: true, id: this.id, ref: this, data: function () { return Object.assign({}, docs.get(docPath)); } };
            },
            set: async function (data, options) {
                const prev = docs.get(docPath) || {};
                docs.set(docPath, options && options.merge ? Object.assign({}, prev, data) : Object.assign({}, data));
            },
            delete: async function () { docs.delete(docPath); },
        };
    }
    function query(coll, filters) {
        return {
            where: function (field, op, value) {
                return query(coll, filters.concat([{ field: field, op: op, value: value }]));
            },
            get: async function () {
                const out = [];
                docs.forEach(function (data, key) {
                    const parts = key.split('/');
                    if (parts.length !== 2 || parts[0] !== coll) return;
                    const ok = filters.every(function (f) { return data[f.field] === f.value; });
                    if (!ok) return;
                    const docRef = ref(key);
                    out.push({ id: parts[1], ref: docRef, data: function () { return Object.assign({}, data); } });
                });
                return { empty: out.length === 0, size: out.length, docs: out, forEach: function (fn) { out.forEach(fn); } };
            },
        };
    }
    return {
        docs: docs,
        collection: function (name) {
            return {
                doc: function (id) { return ref(name + '/' + id); },
                where: function (field, op, value) { return query(name, [{ field: field, op: op, value: value }]); },
            };
        },
        runTransaction: async function (fn) {
            const tx = {
                get: function (r) { return r.get(); },
                set: function (r, data) { docs.set(r.path, Object.assign({}, data)); },
            };
            return fn(tx);
        },
        batch: function () {
            const ops = [];
            return {
                delete: function (r) { ops.push(r.path); },
                commit: async function () { ops.forEach(function (p) { docs.delete(p); }); },
            };
        },
    };
}

function handlers(db, authApi) {
    initSecondFactor({
        db: db,
        admin: { auth: function () { return authApi || {}; } },
        HttpsError: HttpsError,
        authenticator: { generateSecret: function () { return 'x'; }, keyuri: function () { return 'otpauth'; }, checkDelta: function () { return null; }, options: {} },
        QRCode: { toDataURL: async function () { return ''; } },
    });
    return emailChange.createEmailChangeHandlers({
        db: db,
        authApi: authApi || { revokeRefreshTokens: async function () {} },
        HttpsError: HttpsError,
        nowMs: function () { return 1_700_000_000_000; },
        nowSec: function () { return 1_700_000_000; },
    });
}

function auth(email) {
    return {
        auth: {
            uid: 'u1',
            token: { email: email || '', auth_time: 1_700_000_000, email_verified: true },
        },
    };
}

(async function () {
    let passed = 0;
    let failed = 0;
    async function test(name, fn) {
        try {
            await fn();
            console.log('✅ ' + name);
            passed++;
        } catch (e) {
            console.log('❌ ' + name + ': ' + (e.stack || e.message));
            failed++;
        }
    }

    await test('disposable and duplicate addresses get one generic error', async function () {
        assert.strictEqual(emailChange.assessEmail('person@mailinator.com'), '');
        assert.strictEqual(emailChange.assessEmail('a@10.0.0.1'), '');
        assert.ok(emailChange.assessEmail('person@example.com'));
        const db = createDb({ 'users/u1': { emailHash: 'old' } });
        const api = handlers(db, {
            revokeRefreshTokens: async function () {},
            getUserByEmail: async function () { return { uid: 'someone-else' }; },
        });
        await assert.rejects(
            function () { return api.prepareEmailChange({ email: 'taken@example.com' }, auth('old@example.com')); },
            function (err) { return err.message === emailChange.CANT_USE && err.message.indexOf('taken@') === -1; }
        );
        assert.strictEqual(db.docs.has('email_change_pending/u1'), false);
    });

    await test('prepare stores only an hmac and sync without it holds sats', async function () {
        const db = createDb({ 'users/u1': { email: 'old@example.com', emailHash: tomb.emailHmac('old@example.com') } });
        const api = handlers(db, {
            revokeRefreshTokens: async function () {},
            getUserByEmail: async function () { const err = new Error('missing'); err.code = 'auth/user-not-found'; throw err; },
        });
        const prepared = await api.prepareEmailChange({ email: 'new@example.com' }, auth('old@example.com'));
        assert.strictEqual(prepared.ok, true);
        const pending = db.docs.get('email_change_pending/u1');
        assert.strictEqual(pending.emailHmac, tomb.emailHmac('new@example.com'));
        assert.ok(JSON.stringify(pending).indexOf('new@example.com') === -1);
        const changed = await api.syncEmailChange({}, auth('other@example.com'));
        assert.strictEqual(changed.changed, true);
        assert.strictEqual(changed.notice, emailChange.CHANGED_NOTICE);
        assert.strictEqual(db.docs.get('users/u1').satsHold, 1_700_000_000_000 + emailChange.SATS_HOLD_MS);
        assert.ok(db.docs.get('email_history/u1').hashes.indexOf(tomb.emailHmac('old@example.com')) !== -1);
        const auditKeys = Array.from(db.docs.keys()).filter(function (key) { return key.indexOf('admin_audit_log/') === 0; });
        assert.strictEqual(JSON.stringify(db.docs.get(auditKeys[0])).indexOf('@'), -1);
    });

    await test('a matching prep row does not hold sats, and the first sync does not revoke', async function () {
        const db = createDb({ 'users/u1': {} });
        let revoked = 0;
        const api = handlers(db, { revokeRefreshTokens: async function () { revoked++; } });
        const first = await api.syncEmailChange({}, auth('first@example.com'));
        assert.strictEqual(first.first, true);
        assert.strictEqual(revoked, 0);
        assert.ok(!db.docs.get('users/u1').satsHold);
        db.docs.set('users/u1', { email: 'first@example.com', emailHash: tomb.emailHmac('first@example.com') });
        db.docs.set('email_change_pending/u1', {
            emailHmac: tomb.emailHmac('second@example.com'),
            expireAt: new Date(1_700_000_000_000 + 60 * 1000),
            createdAt: 1,
        });
        const second = await api.syncEmailChange({}, auth('second@example.com'));
        assert.strictEqual(second.hold, false);
        assert.ok(!db.docs.get('users/u1').satsHold);
        assert.strictEqual(db.docs.has('email_change_pending/u1'), false);
    });

    await test('a banned tombstone email cannot be prepared', async function () {
        const db = createDb({ 'users/u1': { emailHash: tomb.emailHmac('old@example.com') } });
        const id = tomb.emailHmac('banned@example.com');
        db.docs.set('deleted_accounts/' + id, { banned: true, lifetimeSats: 0, ageDays: 10, deletionHits: [] });
        const api = handlers(db, {
            getUserByEmail: async function () { const err = new Error('missing'); err.code = 'auth/user-not-found'; throw err; },
        });
        await assert.rejects(
            function () { return api.prepareEmailChange({ email: 'banned@example.com' }, auth('old@example.com')); },
            function (err) { return err.message === emailChange.CANT_USE; }
        );
    });

    await test('referral same-email uses current and historical hashes', function () {
        const shared = tomb.emailHmac('same@example.com');
        const flags = referrals.fraudFlags(
            { uid: 'a', email: 'now-a@example.com', emailHash: 'hash-a', emailHistoryHashes: [shared] },
            { uid: 'b', email: 'now-b@example.com', emailHash: shared, emailHistoryHashes: [] }
        );
        assert.ok(flags.indexOf('same-email') !== -1);
        const prior = referrals.fraudFlags(
            { uid: 'a', email: 'a@example.com', priorReferral: true },
            { uid: 'b', email: 'b@example.com' }
        );
        assert.ok(prior.indexOf('prior-referral') !== -1);
        assert.strictEqual(referrals.BLOCKING_FLAGS['prior-referral'], 'rejected');
        const plain = referrals.fraudFlags(
            { uid: 'a', email: 'same@example.com' },
            { uid: 'b', email: 'same@example.com' }
        );
        assert.ok(plain.indexOf('same-email') !== -1);
    });

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
})().catch(function (err) {
    console.error(err);
    process.exit(1);
});
