#!/usr/bin/env node
// Email change: every real change holds sats, including a prepared one.
const assert = require('assert');
const fs = require('fs');
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
        getAll: async function () {
            const refs = Array.prototype.slice.call(arguments);
            const snaps = [];
            for (let i = 0; i < refs.length; i++) snaps.push(await refs[i].get());
            return snaps;
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
        assert.strictEqual(typeof pending.stepUp.totp, 'boolean');
        assert.strictEqual(typeof pending.stepUp.phone, 'boolean');
        const changed = await api.syncEmailChange({}, auth('other@example.com'));
        assert.strictEqual(changed.changed, true);
        assert.strictEqual(changed.notice, emailChange.CHANGED_NOTICE);
        assert.strictEqual(db.docs.get('users/u1').satsHold, 1_700_000_000_000 + emailChange.SATS_HOLD_MS);
        assert.ok(db.docs.get('email_history/u1').hashes.indexOf(tomb.emailHmac('old@example.com')) !== -1);
        const auditKeys = Array.from(db.docs.keys()).filter(function (key) { return key.indexOf('admin_audit_log/') === 0; });
        assert.strictEqual(JSON.stringify(db.docs.get(auditKeys[0])).indexOf('@'), -1);
        const note = db.docs.get('notifications/emailchg_notice_u1');
        assert.strictEqual(note.recipientId, 'u1');
        assert.strictEqual(JSON.stringify(note).indexOf('@'), -1);
    });

    await test('a prepared email change still holds sats, and the first sync does not revoke', async function () {
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
            stepUp: { totp: false, phone: false },
        });
        const second = await api.syncEmailChange({}, auth('second@example.com'));
        assert.strictEqual(second.hold, true);
        assert.strictEqual(db.docs.get('users/u1').satsHold, 1_700_000_000_000 + emailChange.SATS_HOLD_MS);
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
        const referrerOnly = referrals.fraudFlags(
            { uid: 'a', email: 'a@example.com' },
            { uid: 'b', email: 'b@example.com', priorReferral: true }
        );
        assert.strictEqual(referrerOnly.indexOf('prior-referral'), -1);
    });

    await test('unverified and client-written emails do not create a tombstone identity', async function () {
        const spec = tomb.identityFrom({
            uid: 'u1',
            user: { email: 'client@example.com' },
            token: { email: 'token@example.com', email_verified: false },
            authUser: { email: 'auth@example.com', emailVerified: false, providerData: [] },
        });
        assert.strictEqual(spec.email, '');
        assert.strictEqual(spec.emailVerified, false);
        assert.deepStrictEqual(tomb.identityMaterials(spec), []);
        const db = createDb({ 'users/u1': { email: 'client@example.com' } });
        const api = handlers(db, { revokeRefreshTokens: async function () {} });
        const skipped = await api.syncEmailChange({}, {
            auth: { uid: 'u1', token: { email: 'token@example.com', email_verified: false, auth_time: 1_700_000_000 } },
        });
        assert.strictEqual(skipped.skipped, true);
        assert.ok(!db.docs.get('users/u1').emailHash);
        assert.strictEqual(db.docs.get('users/u1').email, 'client@example.com');
    });

    await test('a legacy email that differs from the verified Auth email is held without hashing it', async function () {
        const db = createDb({ 'users/u1': { email: 'legacy@example.com' } });
        let revoked = 0;
        const result = await emailChange.reconcileEmail(db, { revokeRefreshTokens: async function () { revoked++; } }, 'u1', {
            uid: 'u1',
            email: 'auth@example.com',
            emailVerified: true,
            providerData: [],
        }, 1_700_000_000_000);
        assert.strictEqual(result.hold, true);
        assert.strictEqual(revoked, 1);
        assert.strictEqual(db.docs.has('email_history/u1'), false);
        assert.strictEqual(db.docs.get('users/u1').email, 'auth@example.com');
        assert.strictEqual(db.docs.get('users/u1').emailHash, tomb.emailHmac('auth@example.com'));
        assert.notStrictEqual(db.docs.get('users/u1').emailHash, tomb.emailHmac('legacy@example.com'));
        assert.strictEqual(db.docs.get('users/u1').satsHold, 1_700_000_000_000 + emailChange.SATS_HOLD_MS);
        const legacyId = tomb.emailHmac('legacy@example.com');
        assert.strictEqual(db.docs.has('deleted_accounts/' + legacyId), false);
    });

    await test('a direct email change with no sync denies claimSats and claimCipherWin', async function () {
        const db = createDb({
            'users/u1': { email: 'old@example.com', emailHash: tomb.emailHmac('old@example.com') },
        });
        const authUser = { uid: 'u1', email: 'new@example.com', emailVerified: true, providerData: [] };
        const gate = await emailChange.beginPayout(db, { revokeRefreshTokens: async function () {} }, 'u1', authUser, 1_700_000_000_000);
        assert.strictEqual(gate.ok, false);
        assert.strictEqual(gate.error, emailChange.HOLD_ERROR);
        const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
        const claimStart = index.indexOf('exports.claimSats');
        const claim = index.slice(claimStart, index.indexOf('function _unknownPayError', claimStart));
        assert.ok(claim.includes('beginPayout'));
        assert.ok(claim.includes('secretReady'));
        assert.strictEqual(claim.includes('lookupByMaterials'), false);
        assert.ok(claim.includes('tombSummary.lastClaimAt') || claim.includes('summary.lastClaimAt') || claim.includes('millisOf(tombSummary && tombSummary.lastClaimAt)'));
        const gifting = fs.readFileSync(path.join(root, 'functions', 'src', 'gifting.js'), 'utf8');
        assert.ok(gifting.includes('secrets: [deletionHmacSecret]'));
        assert.ok(gifting.includes('beginPayout'));
        assert.ok(gifting.includes("Number(userRow.satsHold) > Date.now()"));
        assert.ok(gifting.includes('tombSatsDisabled'));
        assert.ok(gifting.includes('tombLedgerBanned'));
        const cipher = gifting.slice(gifting.indexOf('const claimCipherWin'), gifting.indexOf('const listMyCipherWins'));
        assert.strictEqual(cipher.includes('lookupByMaterials'), false);
        const referral = fs.readFileSync(path.join(root, 'functions', 'src', 'referralService.js'), 'utf8');
        assert.ok(referral.includes('beforeSnap.exists !== true'));
        assert.ok(referral.includes('applyIdentityFlags'));
        assert.ok(!referral.includes('referred.email ||'));
        assert.ok(!referral.includes('email: profile.email || referred.email'));
    });

    await test('a provider-set change holds sats and keeps the old provider hashes', async function () {
        const oldProviders = [{ providerId: 'google.com', uid: 'google-old' }];
        const oldIds = tomb.providerHashIds(tomb.identityFrom({ providers: oldProviders }));
        const db = createDb({
            'users/u1': {
                email: 'same@example.com',
                emailHash: tomb.emailHmac('same@example.com'),
                providersHash: tomb.providersHashOf(tomb.identityFrom({ providers: oldProviders })),
                providerHashes: oldIds,
            },
        });
        const result = await emailChange.reconcileEmail(db, { revokeRefreshTokens: async function () {} }, 'u1', {
            uid: 'u1',
            email: 'same@example.com',
            emailVerified: true,
            providerData: [{ providerId: 'google.com', uid: 'google-new' }],
        }, 1_700_000_000_000);
        assert.strictEqual(result.hold, true);
        assert.ok(db.docs.get('identity_history/u1').hashes.indexOf(oldIds[0]) !== -1);
        assert.strictEqual(db.docs.get('users/u1').satsHold, 1_700_000_000_000 + emailChange.SATS_HOLD_MS);
    });

    await test('removing the last sign-in provider holds sats', async function () {
        const oldProviders = [{ providerId: 'google.com', uid: 'google-last' }];
        const oldIdentity = tomb.identityFrom({ providers: oldProviders });
        const oldIds = tomb.providerHashIds(oldIdentity);
        const db = createDb({
            'users/u1': {
                email: 'same@example.com',
                emailHash: tomb.emailHmac('same@example.com'),
                providersHash: tomb.providersHashOf(oldIdentity),
                providerHashes: oldIds,
            },
        });
        let revoked = 0;
        const result = await emailChange.reconcileEmail(db, {
            revokeRefreshTokens: async function () { revoked++; },
        }, 'u1', {
            uid: 'u1',
            email: 'same@example.com',
            emailVerified: true,
            providerData: [],
        }, 1_700_000_000_000);
        assert.strictEqual(result.hold, true);
        assert.strictEqual(revoked, 1);
        assert.strictEqual(db.docs.get('users/u1').providersHash, '');
        assert.deepStrictEqual(db.docs.get('users/u1').providerHashes, []);
        assert.ok(db.docs.get('identity_history/u1').hashes.indexOf(oldIds[0]) !== -1);
        assert.strictEqual(db.docs.get('users/u1').satsHold, 1_700_000_000_000 + emailChange.SATS_HOLD_MS);
    });

    await test('claims fail closed when the deletion secret is missing', async function () {
        const prev = process.env.DELETION_HMAC_SECRET;
        delete process.env.DELETION_HMAC_SECRET;
        try {
            const db = createDb({ 'users/u1': { emailHash: tomb.emailHmac('a@example.com') } });
            const gate = await emailChange.beginPayout(db, {}, 'u1', {
                uid: 'u1', email: 'a@example.com', emailVerified: true, providerData: [],
            }, 1_700_000_000_000);
            assert.strictEqual(gate.ok, false);
            assert.strictEqual(gate.paused, true);
            assert.strictEqual(gate.error, emailChange.PAUSED_CLAIMS);
            const gifting = fs.readFileSync(path.join(root, 'functions', 'src', 'gifting.js'), 'utf8');
            assert.ok(gifting.includes("throw httpsError('failed-precondition', payoutGate.error)"));
        } finally {
            process.env.DELETION_HMAC_SECRET = prev;
        }
    });

    await test('tombstone reads use getAll and split referee from referrer', async function () {
        let calls = 0;
        const db = {
            collection: function () {
                return { doc: function (id) { return { id: id }; } };
            },
            getAll: async function () {
                calls += 1;
                return [{ exists: true, data: function () { return { banned: true, referralRedeemed: true, lastClaimAt: 50 }; } }];
            },
        };
        const docs = await tomb.readTombstones(db, ['abc']);
        assert.strictEqual(calls, 1);
        assert.strictEqual(docs[0].banned, true);
        const summary = tomb.summarizeTombstones([
            { referralRedeemed: true },
            { referrerEarned: true, lastClaimAt: 80 },
        ]);
        assert.strictEqual(summary.refereePaid, true);
        assert.strictEqual(summary.referrerEarned, true);
        assert.strictEqual(summary.lastClaimAt, 80);
        const record = tomb.buildRecord({ uid: 'u1', lastSatsClaim: 90, nowMs: 1000, refereePaid: true, referrerEarned: false });
        assert.strictEqual(record.lastClaimAt, 90);
        assert.strictEqual(record.refereePaid, true);
        assert.strictEqual(record.referrerEarned, false);
    });

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
})().catch(function (err) {
    console.error(err);
    process.exit(1);
});
