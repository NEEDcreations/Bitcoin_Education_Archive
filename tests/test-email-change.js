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
        assert.ok(claim.includes('beginPayout(db, admin.auth(), uid, userRecord, Date.now(), context.auth.token || {}, true)'));
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
        const ageLog = cipher.indexOf('[claimCipherWin] Could not verify account age');
        const retry = cipher.indexOf("throw httpsError('failed-precondition', 'Try again later.')");
        const payoutAt = cipher.indexOf('beginPayout');
        assert.ok(ageLog !== -1 && retry > ageLog && retry < payoutAt);
        assert.ok(cipher.includes('beginPayout(db, admin.auth(), uid, authUser, Date.now(), (context.auth && context.auth.token) || {}, true)'));
        assert.ok(cipher.includes('if (!authUser || !Array.isArray(authUser.providerData))'));
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
        }, 1_700_000_000_000, null, true);
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
        }, 1_700_000_000_000, null, true);
        assert.strictEqual(result.hold, true);
        assert.strictEqual(revoked, 1);
        assert.strictEqual(db.docs.get('users/u1').providersHash, emailChange.NO_PROVIDERS);
        assert.deepStrictEqual(db.docs.get('users/u1').providerHashes, [emailChange.NO_PROVIDERS]);
        assert.ok(db.docs.get('identity_history/u1').hashes.indexOf(oldIds[0]) !== -1);
        assert.strictEqual(db.docs.get('identity_history/u1').hashes.indexOf(emailChange.NO_PROVIDERS), -1);
        assert.strictEqual(db.docs.get('users/u1').satsHold, 1_700_000_000_000 + emailChange.SATS_HOLD_MS);
    });

    function googleUser(providerUid) {
        const providers = [{ providerId: 'google.com', uid: providerUid }];
        const identity = tomb.identityFrom({ providers: providers });
        return {
            providers: providers,
            providersHash: tomb.providersHashOf(identity),
            providerHashes: tomb.providerHashIds(identity),
        };
    }

    await test('an unread provider list does not clear a stored Google sign-in', async function () {
        const google = googleUser('google-real');
        const db = createDb({
            'users/u1': {
                email: 'same@example.com',
                emailHash: tomb.emailHmac('same@example.com'),
                providersHash: google.providersHash,
                providerHashes: google.providerHashes,
            },
        });
        let revoked = 0;
        const authApi = { revokeRefreshTokens: async function () { revoked++; } };
        const missing = await emailChange.reconcileEmail(db, authApi, 'u1', null, 1_700_000_000_000, {
            email: 'same@example.com',
            email_verified: true,
        }, true);
        assert.strictEqual(missing.hold, false);
        assert.strictEqual(revoked, 0);
        assert.strictEqual(db.docs.get('users/u1').providersHash, google.providersHash);
        assert.deepStrictEqual(db.docs.get('users/u1').providerHashes, google.providerHashes);
        assert.strictEqual(db.docs.has('identity_history/u1'), false);

        const empty = await emailChange.beginPayout(db, authApi, 'u1', {
            uid: 'u1',
            email: 'same@example.com',
            emailVerified: true,
            providerData: [],
        }, 1_700_000_000_000, null, false);
        assert.strictEqual(empty.ok, true);
        assert.strictEqual(revoked, 0);
        assert.strictEqual(db.docs.get('users/u1').providersHash, google.providersHash);
        assert.ok(!db.docs.get('users/u1').satsHold);
    });

    await test('sync skips providers when getUser fails and the token email is verified', async function () {
        const google = googleUser('google-real');
        const db = createDb({
            'users/u1': {
                email: 'old@example.com',
                emailHash: tomb.emailHmac('old@example.com'),
                providersHash: google.providersHash,
                providerHashes: google.providerHashes,
            },
        });
        let revoked = 0;
        const api = handlers(db, {
            revokeRefreshTokens: async function () { revoked++; },
            getUser: async function () { throw new Error('auth unavailable'); },
        });
        const result = await api.syncEmailChange({}, auth('new@example.com'));
        assert.strictEqual(result.hold, true);
        assert.strictEqual(revoked, 1);
        assert.strictEqual(db.docs.get('users/u1').email, 'new@example.com');
        assert.strictEqual(db.docs.get('users/u1').providersHash, google.providersHash);
        assert.deepStrictEqual(db.docs.get('users/u1').providerHashes, google.providerHashes);
        assert.strictEqual(db.docs.has('identity_history/u1'), false);
        assert.ok(db.docs.get('email_history/u1').hashes.indexOf(tomb.emailHmac('old@example.com')) !== -1);

        const unverified = createDb({
            'users/u1': {
                email: 'same@example.com',
                emailHash: tomb.emailHmac('same@example.com'),
                providersHash: google.providersHash,
                providerHashes: google.providerHashes,
            },
        });
        let unverifiedRevoked = 0;
        const fallback = handlers(unverified, {
            revokeRefreshTokens: async function () { unverifiedRevoked++; },
            getUser: async function () {
                return {
                    uid: 'u1',
                    email: 'stale@example.com',
                    emailVerified: false,
                    providerData: [],
                };
            },
        });
        const kept = await fallback.syncEmailChange({}, auth('same@example.com'));
        assert.strictEqual(kept.hold, false);
        assert.strictEqual(unverifiedRevoked, 0);
        assert.strictEqual(unverified.docs.get('users/u1').providersHash, google.providersHash);
        assert.deepStrictEqual(unverified.docs.get('users/u1').providerHashes, google.providerHashes);
        assert.strictEqual(unverified.docs.has('identity_history/u1'), false);
    });

    await test('a provider linked after the last one was removed holds sats', async function () {
        const original = googleUser('google-owner');
        const db = createDb({
            'users/u1': {
                email: 'same@example.com',
                emailHash: tomb.emailHmac('same@example.com'),
                providersHash: original.providersHash,
                providerHashes: original.providerHashes,
            },
        });
        let revoked = 0;
        const authApi = { revokeRefreshTokens: async function () { revoked++; } };
        const removed = await emailChange.reconcileEmail(db, authApi, 'u1', {
            uid: 'u1',
            email: 'same@example.com',
            emailVerified: true,
            providerData: [],
        }, 1_700_000_000_000, null, true);
        assert.strictEqual(removed.hold, true);
        assert.strictEqual(db.docs.get('users/u1').providersHash, emailChange.NO_PROVIDERS);
        const linked = await emailChange.reconcileEmail(db, authApi, 'u1', {
            uid: 'u1',
            email: 'same@example.com',
            emailVerified: true,
            providerData: [{ providerId: 'google.com', uid: 'google-attacker' }],
        }, 1_700_000_000_000 + emailChange.SATS_HOLD_MS, null, true);
        assert.strictEqual(linked.hold, true);
        assert.strictEqual(linked.first, undefined);
        assert.strictEqual(revoked, 2);
        const attacker = googleUser('google-attacker');
        assert.strictEqual(db.docs.get('users/u1').providersHash, attacker.providersHash);
        assert.deepStrictEqual(db.docs.get('users/u1').providerHashes, attacker.providerHashes);
        assert.ok(db.docs.get('identity_history/u1').hashes.indexOf(original.providerHashes[0]) !== -1);
        assert.strictEqual(db.docs.get('identity_history/u1').hashes.indexOf(emailChange.NO_PROVIDERS), -1);
        assert.strictEqual(db.docs.get('users/u1').satsHold, 1_700_000_000_000 + emailChange.SATS_HOLD_MS + emailChange.SATS_HOLD_MS);
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

    await test('a lightning first email without a server claim is removed and not stored', async function () {
        const db = createDb({ 'users/ln:abc': {} });
        const updates = [];
        const api = handlers(db, {
            revokeRefreshTokens: async function () {},
            updateUser: async function (uid, patch) { updates.push({ uid: uid, patch: patch }); },
            getUserByEmail: async function () {
                const err = new Error('missing');
                err.code = 'auth/user-not-found';
                throw err;
            },
            getUser: async function () {
                return {
                    uid: 'ln:abc',
                    email: 'new@example.com',
                    emailVerified: true,
                    providerData: [{ providerId: 'password', uid: 'pw' }],
                };
            },
        });
        const result = await api.syncEmailChange({}, {
            auth: { uid: 'ln:abc', token: { email: 'new@example.com', email_verified: true, auth_time: 1_700_000_000 } },
        });
        assert.strictEqual(result.conflict, true);
        assert.ok(!db.docs.get('users/ln:abc').email);
        assert.ok(!db.docs.get('users/ln:abc').emailHash);
        assert.strictEqual(updates.length, 1);
        assert.strictEqual(updates[0].uid, 'ln:abc');
        assert.deepStrictEqual(updates[0].patch.providersToUnlink, ['password']);
        assert.ok(JSON.stringify(updates).indexOf('new@example.com') === -1);
    });

    await test('a prepared lightning email attaches to that uid only', async function () {
        const hash = tomb.emailHmac('bolt@example.com');
        const db = createDb({
            'users/ln:abc': {},
            'email_change_pending/ln:abc': {
                emailHmac: hash,
                expireAt: new Date(1_700_000_000_000 + 60 * 1000),
                createdAt: 1,
            },
        });
        db.docs.set('email_link_claims/' + hash, {
            uid: 'ln:abc',
            expireAt: new Date(1_700_000_000_000 + 60 * 1000),
            createdAt: 1,
        });
        const api = handlers(db, {
            revokeRefreshTokens: async function () {},
            updateUser: async function () { throw new Error('should not detach'); },
            getUserByEmail: async function () { return { uid: 'ln:abc' }; },
            getUser: async function () {
                return {
                    uid: 'ln:abc',
                    email: 'bolt@example.com',
                    emailVerified: true,
                    providerData: [{ providerId: 'password', uid: 'pw' }],
                };
            },
        });
        const result = await api.syncEmailChange({}, {
            auth: { uid: 'ln:abc', token: { email: 'bolt@example.com', email_verified: true, auth_time: 1_700_000_000 } },
        });
        assert.strictEqual(result.first, true);
        assert.strictEqual(result.conflict, undefined);
        assert.strictEqual(db.docs.get('users/ln:abc').email, 'bolt@example.com');
        assert.strictEqual(db.docs.get('users/ln:abc').emailHash, hash);
        assert.strictEqual(db.docs.has('email_link_claims/' + hash), false);
    });

    await test('an email already stored for another account is not copied', async function () {
        const hash = tomb.emailHmac('taken@example.com');
        const db = createDb({
            'users/u1': {},
            'users/other': { emailHash: hash },
        });
        const updates = [];
        const api = handlers(db, {
            revokeRefreshTokens: async function () {},
            updateUser: async function (uid, patch) { updates.push(uid + ':' + Object.keys(patch).join(',')); },
            getUser: async function () {
                return { uid: 'u1', email: 'taken@example.com', emailVerified: true, providerData: [] };
            },
        });
        const result = await api.syncEmailChange({}, auth('taken@example.com'));
        assert.strictEqual(result.conflict, true);
        assert.ok(!db.docs.get('users/u1').emailHash);
        assert.strictEqual(db.docs.get('users/other').emailHash, hash);
        assert.strictEqual(updates.length, 0);
    });

    await test('prepare refuses an email another account already claimed', async function () {
        const hash = tomb.emailHmac('claimed@example.com');
        const db = createDb({
            'users/u1': { emailHash: tomb.emailHmac('old@example.com') },
        });
        db.docs.set('email_link_claims/' + hash, {
            uid: 'ln:other',
            expireAt: new Date(1_700_000_000_000 + 60 * 1000),
            createdAt: 1,
        });
        const api = handlers(db, {
            getUserByEmail: async function () {
                const err = new Error('missing');
                err.code = 'auth/user-not-found';
                throw err;
            },
        });
        await assert.rejects(
            function () { return api.prepareEmailChange({ email: 'claimed@example.com' }, auth('old@example.com')); },
            function (err) { return err.message === emailChange.CANT_USE && err.message.indexOf('claimed@') === -1; }
        );
        assert.strictEqual(db.docs.get('email_link_claims/' + hash).uid, 'ln:other');
    });

    await test('only a lightning account can lose an email sign-in, and never its last method', async function () {
        const hash = tomb.emailHmac('owned@example.com');
        const updates = [];
        function record(uid, patch) { updates.push({ uid: uid, patch: patch }); }
        const emailUser = createDb({ 'users/email-user': {}, 'users/other': { emailHash: hash } });
        const emailApi = handlers(emailUser, {
            revokeRefreshTokens: async function () {},
            updateUser: async function (uid, patch) { record(uid, patch); },
            getUser: async function () {
                return {
                    uid: 'email-user',
                    email: 'owned@example.com',
                    emailVerified: true,
                    providerData: [{ providerId: 'password', uid: 'pw' }],
                };
            },
        });
        const blocked = await emailApi.syncEmailChange({}, {
            auth: { uid: 'email-user', token: { email: 'owned@example.com', email_verified: true, auth_time: 1_700_000_000 } },
        });
        assert.strictEqual(blocked.conflict, true);
        assert.strictEqual(updates.length, 0);
        assert.ok(!emailUser.docs.get('users/email-user').emailHash);

        const lnDb = createDb({ 'users/ln:abc': {}, 'users/other': { emailHash: hash } });
        const lnApi = handlers(lnDb, {
            revokeRefreshTokens: async function () {},
            updateUser: async function (uid, patch) { record(uid, patch); },
            getUser: async function () {
                return {
                    uid: 'ln:abc',
                    email: 'owned@example.com',
                    emailVerified: true,
                    providerData: [{ providerId: 'password', uid: 'pw' }, { providerId: 'google.com', uid: 'g' }],
                };
            },
        });
        const stripped = await lnApi.syncEmailChange({}, {
            auth: { uid: 'ln:abc', token: { email: 'owned@example.com', email_verified: true, auth_time: 1_700_000_000 } },
        });
        assert.strictEqual(stripped.conflict, true);
        assert.strictEqual(updates.length, 1);
        assert.strictEqual(updates[0].uid, 'ln:abc');
        assert.deepStrictEqual(updates[0].patch.providersToUnlink, ['password']);
        assert.strictEqual(updates[0].patch.email, undefined);
        assert.ok(!lnDb.docs.get('users/ln:abc').emailHash);
    });

    await test('an email-link signup wins over an unconfirmed claim without losing the sign-in', async function () {
        const hash = tomb.emailHmac('inbox@example.com');
        function reservedDb() {
            const db = createDb({ 'users/owner': {} });
            db.docs.set('email_link_claims/' + hash, {
                uid: 'attacker',
                expireAt: new Date(1_700_000_000_000 + 60 * 1000),
                createdAt: 1,
            });
            return db;
        }
        const updates = [];
        function authApi() {
            return {
                revokeRefreshTokens: async function () {},
                updateUser: async function (uid, patch) { updates.push({ uid: uid, patch: patch }); },
                getUserByEmail: async function () { return { uid: 'owner' }; },
                getUser: async function (uid) {
                    if (uid === 'attacker') {
                        return { uid: 'attacker', email: '', emailVerified: false, providerData: [{ providerId: 'google.com', uid: 'g' }] };
                    }
                    return {
                        uid: 'owner',
                        email: 'inbox@example.com',
                        emailVerified: true,
                        providerData: [{ providerId: 'password', uid: 'pw' }],
                    };
                },
            };
        }
        const ownerAuth = {
            auth: { uid: 'owner', token: { email: 'inbox@example.com', email_verified: true, auth_time: 1_700_000_000 } },
        };
        const syncedDb = reservedDb();
        const synced = await handlers(syncedDb, authApi()).syncEmailChange({}, ownerAuth);
        assert.strictEqual(synced.first, true);
        assert.strictEqual(synced.conflict, undefined);
        assert.strictEqual(syncedDb.docs.get('users/owner').email, 'inbox@example.com');
        assert.strictEqual(syncedDb.docs.get('users/owner').emailHash, hash);
        assert.strictEqual(syncedDb.docs.has('email_link_claims/' + hash), false);
        assert.strictEqual(updates.length, 0);

        const payoutDb = reservedDb();
        const payout = await emailChange.beginPayout(payoutDb, authApi(), 'owner', {
            uid: 'owner',
            email: 'inbox@example.com',
            emailVerified: true,
            providerData: [{ providerId: 'password', uid: 'pw' }],
        }, 1_700_000_000_000, { email: 'inbox@example.com', email_verified: true });
        assert.strictEqual(payout.ok, true);
        assert.strictEqual(payout.conflict, undefined);
        assert.strictEqual(payoutDb.docs.get('users/owner').email, 'inbox@example.com');
        assert.strictEqual(payoutDb.docs.has('email_link_claims/' + hash), false);
        assert.strictEqual(updates.length, 0);
    });

    await test('preparing a new email releases the previous claim and leaves one', async function () {
        const first = tomb.emailHmac('first@example.com');
        const second = tomb.emailHmac('second@example.com');
        const orphan = tomb.emailHmac('orphan@example.com');
        const db = createDb({ 'users/u1': {} });
        db.docs.set('email_link_claims/' + first, {
            uid: 'u1',
            expireAt: new Date(1_700_000_000_000 + 60 * 1000),
            createdAt: 1,
        });
        db.docs.set('email_link_claims/' + orphan, {
            uid: 'u1',
            expireAt: new Date(1_700_000_000_000 + 60 * 1000),
            createdAt: 1,
        });
        db.docs.set('email_change_pending/u1', {
            emailHmac: first,
            expireAt: new Date(1_700_000_000_000 + 60 * 1000),
            createdAt: 1,
            stepUp: { totp: false, phone: false },
        });
        const api = handlers(db, {
            getUserByEmail: async function () {
                const err = new Error('missing');
                err.code = 'auth/user-not-found';
                throw err;
            },
        });
        const prepared = await api.prepareEmailChange({ email: 'second@example.com' }, auth(''));
        assert.strictEqual(prepared.ok, true);
        assert.strictEqual(db.docs.has('email_link_claims/' + first), false);
        assert.strictEqual(db.docs.has('email_link_claims/' + orphan), false);
        assert.strictEqual(db.docs.get('email_link_claims/' + second).uid, 'u1');
        assert.strictEqual(db.docs.get('email_change_pending/u1').emailHmac, second);
        let active = 0;
        db.docs.forEach(function (data, key) {
            if (key.indexOf('email_link_claims/') === 0 && data.uid === 'u1') active += 1;
        });
        assert.strictEqual(active, 1);
        assert.ok(JSON.stringify(db.docs.get('email_link_claims/' + second)).indexOf('@') === -1);
    });

    await test('prepare stores a claim without the address', async function () {
        const db = createDb({ 'users/u1': {} });
        const api = handlers(db, {
            getUserByEmail: async function () {
                const err = new Error('missing');
                err.code = 'auth/user-not-found';
                throw err;
            },
        });
        await api.prepareEmailChange({ email: 'fresh@example.com' }, auth(''));
        const hash = tomb.emailHmac('fresh@example.com');
        const claim = db.docs.get('email_link_claims/' + hash);
        assert.strictEqual(claim.uid, 'u1');
        assert.ok(JSON.stringify(claim).indexOf('@') === -1);
        assert.ok(JSON.stringify(claim).indexOf('fresh') === -1);
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
