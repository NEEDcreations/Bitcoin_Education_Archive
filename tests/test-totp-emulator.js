#!/usr/bin/env node
'use strict';

// Auth + Firestore emulator coverage for authenticator sessions, phone
// enrollment, recovery, and the calls that must refuse a forged local flag.
// When the emulator hosts are missing, this starts them and re-runs itself.

const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    const child = spawnSync('npx', [
        '--yes', 'firebase-tools',
        'emulators:exec',
        '--only', 'auth,firestore',
        '--project', 'demo-btc',
        'node tests/test-totp-emulator.js',
    ], {
        cwd: root,
        stdio: 'inherit',
        env: Object.assign({}, process.env, { CI: 'true' }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

process.env.TOTP_ENCRYPTION_KEY = 'ab'.repeat(32);
let firebaseConfig = {};
try { firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG || '{}'); } catch (e) { firebaseConfig = {}; }
if (!firebaseConfig.projectId) firebaseConfig.projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'demo-btc';
process.env.FIREBASE_CONFIG = JSON.stringify(firebaseConfig);
process.env.GCLOUD_PROJECT = firebaseConfig.projectId;
process.env.GOOGLE_CLOUD_PROJECT = firebaseConfig.projectId;
let now = 1700000000000;
global.__BTC_MFA_NOW__ = function () { return now; };
require('./totp-emulator-auth');

const admin = require('../functions/node_modules/firebase-admin');
const { authenticator } = require('../functions/node_modules/otplib');
const fns = require('../functions/index.js');

const db = admin.firestore();
let passed = 0;
let failed = 0;

function test(name, fn) {
    return Promise.resolve().then(fn).then(function () {
        console.log('  ok  ' + name);
        passed++;
    }).catch(function (e) {
        console.log('  FAIL ' + name);
        console.log('       ' + (e && e.stack ? e.stack : e));
        failed++;
    });
}

function codeAt(secret, when) {
    const prev = Object.assign({}, authenticator.options);
    authenticator.options = Object.assign({}, prev, { step: 30, window: 1, epoch: when });
    try { return authenticator.generate(secret); }
    finally { authenticator.options = prev; }
}

function ctx(uid, opts) {
    opts = opts || {};
    const firebase = { sign_in_provider: opts.provider || 'password' };
    if (opts.secondFactor) firebase.sign_in_second_factor = opts.secondFactor;
    const token = {
        email: opts.email || undefined,
        email_verified: !!opts.email,
        auth_time: Math.floor(Date.now() / 1000),
        firebase: firebase,
    };
    if (opts.admin) token.admin = true;
    return {
        auth: { uid: uid, token: token },
        app: opts.app ? { appId: 'test' } : undefined,
        rawRequest: {
            headers: { 'x-forwarded-for': opts.ip || '203.0.113.10' },
            ip: opts.ip || '203.0.113.10',
        },
    };
}

function httpCode(err) {
    return String((err && err.code) || '').replace(/^functions\//, '');
}

async function expectThrow(fn, code, part) {
    try {
        await fn();
    } catch (e) {
        assert.strictEqual(httpCode(e), code, (e && e.message) || 'missing code');
        if (part) assert.ok(String(e.message).indexOf(part) !== -1, e.message);
        return;
    }
    throw new Error('expected ' + code + (part ? ' ' + part : ''));
}

async function pastGate(callable, data, context) {
    try {
        const result = await callable.run(data, context);
        const error = result && result.error ? String(result.error) : '';
        assert.ok(error.indexOf('Authenticator session required') === -1, error || JSON.stringify(result));
        assert.ok(error.indexOf('phone verification') === -1, error || JSON.stringify(result));
        return result;
    } catch (e) {
        const msg = String(e && e.message || '');
        assert.ok(msg.indexOf('Authenticator session required') === -1, msg);
        assert.ok(msg.indexOf('phone verification') === -1, msg);
        return e;
    }
}

async function createUser(uid, email) {
    const body = { uid: uid };
    if (email) {
        body.email = email;
        body.password = 'test-pass-123';
        body.emailVerified = true;
    }
    try { await admin.auth().deleteUser(uid); } catch (e) {}
    await admin.auth().createUser(body);
    await db.collection('users').doc(uid).set({ points: 0, created: admin.firestore.FieldValue.serverTimestamp() });
}

async function enrollTotp(uid, provider, email) {
    const context = ctx(uid, { provider: provider, email: email });
    const setup = await fns.totpSetup.run({}, context);
    assert.ok(setup.secret);
    assert.ok(setup.qr);
    const pending = await db.collection('totp_pending').doc(uid).get();
    assert.strictEqual(pending.data().secretEnc, true);
    assert.notStrictEqual(pending.data().secret, setup.secret);
    const verified = await fns.totpVerify.run({ code: codeAt(setup.secret, now) }, context);
    assert.strictEqual(verified.success, true);
    assert.ok(/^[a-f0-9]{64}$/.test(verified.sessionId));
    assert.strictEqual(verified.recoveryCodes.length, 10);
    const stored = await db.collection('totp_secrets').doc(uid).get();
    assert.strictEqual(stored.data().secretEnc, true);
    assert.strictEqual(stored.data().enabled, true);
    assert.notStrictEqual(stored.data().secret, setup.secret);
    const user = await db.collection('users').doc(uid).get();
    assert.strictEqual(user.data().totpEnabled, true);
    return { secret: setup.secret, sessionId: verified.sessionId, codes: verified.recoveryCodes, context: context };
}

async function enrollPhone(uid, phoneNumber) {
    await admin.auth().updateUser(uid, {
        multiFactor: {
            enrolledFactors: [{
                uid: 'ph' + uid.slice(0, 20),
                factorId: 'phone',
                phoneNumber: phoneNumber,
                displayName: 'Phone',
            }],
        },
    });
    const rec = await admin.auth().getUser(uid);
    const factors = (rec.multiFactor && rec.multiFactor.enrolledFactors) || [];
    assert.ok(factors.some(function (f) { return f.factorId === 'phone'; }), 'phone factor missing');
    return factors[0];
}

async function clearPhone(uid) {
    await admin.auth().updateUser(uid, { multiFactor: { enrolledFactors: null } });
}

const PROVIDERS = [
    { id: 'password', email: true, phone: true, label: 'email' },
    { id: 'google.com', email: true, phone: true, label: 'google' },
    { id: 'facebook.com', email: true, phone: true, label: 'facebook' },
    { id: 'twitter.com', email: true, phone: true, label: 'twitter' },
    { id: 'github.com', email: true, phone: true, label: 'github' },
    { id: 'custom', email: false, phone: false, label: 'nostr-lightning' },
];

async function main() {
    for (const provider of PROVIDERS) {
        const uid = 'e2e' + provider.label.replace(/[^a-z]/g, '');
        const email = provider.email ? (uid + '@example.com') : '';
        await test(provider.label + ' can turn authenticator on, sign in, and turn it off', async function () {
            now = 1700000000000 + PROVIDERS.indexOf(provider) * 1000000;
            await createUser(uid, email);
            const first = await enrollTotp(uid, provider.id, email);
            await expectThrow(function () {
                return fns.claimSats.run({}, first.context);
            }, 'failed-precondition', 'Authenticator session required');
            await expectThrow(function () {
                return fns.claimSats.run({ mfaSessionId: '1' }, first.context);
            }, 'failed-precondition', 'Authenticator session required');
            await pastGate(fns.claimSats, { mfaSessionId: first.sessionId }, first.context);
            await expectThrow(function () {
                return fns.setUsername.run({ name: 'OkName', mfaSessionId: '1' }, first.context);
            }, 'failed-precondition', 'Authenticator session required');
            await pastGate(fns.setUsername, { name: 'OkName', mfaSessionId: first.sessionId }, first.context);
            await expectThrow(function () {
                return fns.openGift.run({ giftId: 'missing-gift', mfaSessionId: '1' }, first.context);
            }, 'failed-precondition', 'Authenticator session required');
            await pastGate(fns.openGift, { giftId: 'missing-gift', mfaSessionId: first.sessionId }, first.context);
            await expectThrow(function () {
                return fns.deleteAccount.run({ confirm: 'DELETE' }, first.context);
            }, 'failed-precondition', 'Authenticator session required');

            now += 60000;
            const secondCode = codeAt(first.secret, now);
            const second = await fns.totpCheck.run({ code: secondCode }, first.context);
            assert.ok(second.sessionId && second.sessionId !== first.sessionId);
            const legacy = await db.collection('totp_sessions').doc(uid).get();
            assert.strictEqual(legacy.exists, false);

            now += 30000;
            await expectThrow(function () {
                return fns.totpCheck.run({ code: secondCode }, first.context);
            }, 'invalid-argument', 'already used');

            now += 60000;
            await fns.totpDisable.run({ code: codeAt(first.secret, now) }, first.context);
            const afterOff = await db.collection('totp_secrets').doc(uid).get();
            assert.strictEqual(afterOff.exists, false);
            const sessions = await db.collection('totp_sessions').where('uid', '==', uid).get();
            assert.strictEqual(sessions.size, 0);
            const statusOff = await fns.totpStatus.run({}, first.context);
            assert.strictEqual(statusOff.enabled, false);

            now += 60000;
            const again = await enrollTotp(uid, provider.id, email);
            await fns.totpRevokeSession.run({ sessionId: again.sessionId }, first.context);
            const revoked = await db.collection('totp_sessions').doc(uid + '_' + again.sessionId).get();
            assert.strictEqual(revoked.exists, false);
            await expectThrow(function () {
                return fns.claimSats.run({ mfaSessionId: again.sessionId }, first.context);
            }, 'failed-precondition', 'Authenticator session required');

            now += 60000;
            await fns.totpCheck.run({ code: codeAt(again.secret, now) }, first.context);
            if (email) {
                const guest = ctx('guest' + uid, { provider: 'anonymous' });
                await fns.useRecoveryCode.run({ email: email, code: again.codes[0] }, guest);
            } else {
                await fns.useRecoveryCode.run({ code: again.codes[0] }, first.context);
            }
            const cleared = await db.collection('totp_secrets').doc(uid).get();
            assert.strictEqual(cleared.exists, false);
            const codesGone = await db.collection('recovery_codes').doc(uid).get();
            assert.strictEqual(codesGone.exists, false);
            const note = await db.collection('notifications').where('recipientId', '==', uid).get();
            assert.ok(note.size >= 1);
            const adminNote = await db.collection('admin_notifications').where('uid', '==', uid).get();
            assert.ok(adminNote.docs.some(function (doc) { return doc.data().type === 'mfa_recovery'; }));
            await pastGate(fns.claimSats, {}, first.context);
        });
    }

    await test('phone verification blocks sensitive calls until the next sign-in, then a recovery code removes it', async function () {
        now = 1700001000000;
        const uid = 'e2ephone';
        const email = 'e2ephone@example.com';
        await createUser(uid, email);
        const factor = await enrollPhone(uid, '+15555550100');
        const enrolledAt = factor.enrollmentTime ? new Date(factor.enrollmentTime).getTime() : now;
        now = enrolledAt + 1000;
        const context = ctx(uid, { provider: 'google.com', email: email });
        let issued;
        try {
            issued = await fns.issueRecoveryCodes.run({}, context);
        } catch (e) {
            if (String(e.message).indexOf('Confirm') === -1) throw e;
            issued = await fns.issueRecoveryCodes.run({}, ctx(uid, { provider: 'google.com', email: email, secondFactor: 'phone' }));
        }
        assert.strictEqual(issued.recoveryCodes.length, 10);
        const user = await db.collection('users').doc(uid).get();
        assert.strictEqual(user.data().phoneVerified, true);
        await expectThrow(function () {
            return fns.claimSats.run({}, context);
        }, 'failed-precondition', 'phone verification');
        const signed = ctx(uid, { provider: 'google.com', email: email, secondFactor: 'phone' });
        await pastGate(fns.claimSats, {}, signed);
        const guest = ctx('e2eguestphone', { provider: 'anonymous' });
        await fns.useRecoveryCode.run({ email: email, code: issued.recoveryCodes[3] }, guest);
        const after = await admin.auth().getUser(uid);
        const left = (after.multiFactor && after.multiFactor.enrolledFactors) || [];
        assert.strictEqual(left.length, 0);
        const flag = await db.collection('users').doc(uid).get();
        assert.strictEqual(flag.data().phoneVerified, false);
        await enrollPhone(uid, '+15555550101');
        await clearPhone(uid);
        await fns.phoneFactorRemoved.run({}, context);
        const status = await fns.totpStatus.run({}, context);
        assert.strictEqual(status.phoneEnabled, false);
        await enrollPhone(uid, '+15555550102');
        const back = await fns.totpStatus.run({}, context);
        assert.strictEqual(back.phoneEnabled, true);
    });

    await test('wrong, expired, and repeated authenticator codes are refused, and the bucket rate-limits', async function () {
        now = 1700002000000;
        const uid = 'e2ewrong';
        await createUser(uid, 'e2ewrong@example.com');
        const enrolled = await enrollTotp(uid, 'password', 'e2ewrong@example.com');
        const context = enrolled.context;
        now += 60000;
        await expectThrow(function () {
            return fns.totpCheck.run({ code: '000000' }, context);
        }, 'invalid-argument', 'Invalid code');
        const fresh = codeAt(enrolled.secret, now);
        const staleWhen = now;
        now += 5 * 60 * 1000;
        await expectThrow(function () {
            return fns.totpCheck.run({ code: codeAt(enrolled.secret, staleWhen) }, context);
        }, 'invalid-argument', 'Invalid code');
        now += 60000;
        const once = codeAt(enrolled.secret, now);
        await fns.totpCheck.run({ code: once }, context);
        await expectThrow(function () {
            return fns.totpCheck.run({ code: once }, context);
        }, 'invalid-argument', 'already used');
        const other = 'e2erate';
        await createUser(other, 'e2erate@example.com');
        await enrollTotp(other, 'password', 'e2erate@example.com');
        const rateCtx = ctx(other, { provider: 'password', email: 'e2erate@example.com', ip: '198.51.100.8' });
        for (let i = 0; i < 5; i++) {
            await expectThrow(function () {
                return fns.totpCheck.run({ code: '11111' + i }, rateCtx);
            }, 'invalid-argument', 'Invalid code');
        }
        await expectThrow(function () {
            return fns.totpCheck.run({ code: '222222' }, rateCtx);
        }, 'resource-exhausted', 'Too many attempts');
        void fresh;
    });

    await test('an existing authenticator user gets recovery codes without re-enrolling', async function () {
        now = 1700003000000;
        const uid = 'e2elegacy';
        await createUser(uid, 'e2elegacy@example.com');
        const secret = authenticator.generateSecret();
        await db.collection('totp_secrets').doc(uid).set({
            secretEnc: false,
            secret: secret,
            enabled: true,
            lastAcceptedStep: Math.floor(now / 30000) - 5,
        });
        await db.collection('users').doc(uid).set({ totpEnabled: true }, { merge: true });
        await db.collection('totp_sessions').doc(uid).set({ verified: true, uid: uid });
        const context = ctx(uid, { provider: 'password', email: 'e2elegacy@example.com' });
        const checked = await fns.totpCheck.run({ code: codeAt(secret, now) }, context);
        assert.strictEqual(checked.recoveryCodes.length, 10);
        const still = await db.collection('totp_secrets').doc(uid).get();
        assert.strictEqual(still.data().enabled, true);
        assert.strictEqual(still.data().secret, secret);
        const status = await fns.totpStatus.run({ sessionId: checked.sessionId }, context);
        assert.strictEqual(status.enabled, true);
        assert.strictEqual(status.sessionVerified, true);
        assert.strictEqual(status.needsRecoveryCodes, false);
        const saved = await db.collection('recovery_codes').doc(uid).get();
        const blob = JSON.stringify(saved.data());
        checked.recoveryCodes.forEach(function (code) {
            assert.ok(blob.indexOf(code) === -1, 'plaintext recovery code stored');
        });
        const oldFlag = await fns.totpStatus.run({ sessionId: '1' }, context);
        assert.strictEqual(oldFlag.sessionVerified, false);
    });

    await test('setup fails closed without the encryption key and does not store a secret', async function () {
        now = 1700004000000;
        const uid = 'e2enokey';
        await createUser(uid, 'e2enokey@example.com');
        const previous = process.env.TOTP_ENCRYPTION_KEY;
        delete process.env.TOTP_ENCRYPTION_KEY;
        try {
            await expectThrow(function () {
                return fns.totpSetup.run({}, ctx(uid, { provider: 'password', email: 'e2enokey@example.com' }));
            }, 'failed-precondition', 'unavailable');
        } finally {
            process.env.TOTP_ENCRYPTION_KEY = previous;
        }
        const pending = await db.collection('totp_pending').doc(uid).get();
        assert.strictEqual(pending.exists, false);
    });

    await test('migration dry-run does not write, and apply encrypts plaintext secrets', async function () {
        now = 1700005000000;
        const uid = 'e2emigrate';
        const secret = authenticator.generateSecret();
        await db.collection('totp_secrets').doc(uid).set({ secret: secret, enabled: true, secretEnc: false });
        const migrateEnv = Object.assign({}, process.env, {
            NODE_OPTIONS: '--require ' + path.join(root, 'tests', 'totp-emulator-auth.js'),
        });
        const dry = spawnSync(process.execPath, ['functions/migrate-totp-secrets.js'], {
            cwd: root,
            encoding: 'utf8',
            env: migrateEnv,
        });
        assert.strictEqual(dry.status, 0, dry.stderr);
        assert.ok(dry.stdout.indexOf(secret) === -1);
        const dryJson = JSON.parse(dry.stdout.trim().split('\n').pop());
        assert.ok(dryJson.plaintext >= 1);
        assert.strictEqual(dryJson.updated, 0);
        const unchanged = await db.collection('totp_secrets').doc(uid).get();
        assert.strictEqual(unchanged.data().secret, secret);
        const apply = spawnSync(process.execPath, ['functions/migrate-totp-secrets.js', '--apply'], {
            cwd: root,
            encoding: 'utf8',
            env: migrateEnv,
        });
        assert.strictEqual(apply.status, 0, apply.stderr);
        assert.ok(apply.stdout.indexOf(secret) === -1);
        const row = await db.collection('totp_secrets').doc(uid).get();
        assert.strictEqual(row.data().secretEnc, true);
        assert.notStrictEqual(row.data().secret, secret);
        const refuse = spawnSync(process.execPath, ['functions/migrate-totp-secrets.js', '--apply'], {
            cwd: root,
            encoding: 'utf8',
            env: Object.assign({}, migrateEnv, { TOTP_ENCRYPTION_KEY: '' }),
        });
        assert.notStrictEqual(refuse.status, 0);
        assert.ok(String(refuse.stderr).indexOf('Refusing to apply') !== -1);
        assert.ok(String(refuse.stderr).indexOf(secret) === -1);
    });

    await test('a guest link and account deletion wait for the authenticator session', async function () {
        now = 1700006000000;
        const uid = 'e2eguestlink';
        const email = 'e2eguestlink@example.com';
        await createUser(uid, email);
        const enrolled = await enrollTotp(uid, 'password', email);
        const guestUid = 'guestlinkuser1';
        await createUser(guestUid, '');
        await db.collection('users').doc(guestUid).set({ points: 3, guestLinkNonce: 'not-the-nonce' });
        const link = { anonUid: guestUid, nonce: '0123456789abcdef' };
        await expectThrow(function () {
            return fns.linkGuestAccount.run(link, enrolled.context);
        }, 'failed-precondition', 'Authenticator session required');
        const moved = await fns.linkGuestAccount.run(Object.assign({ mfaSessionId: enrolled.sessionId }, link), enrolled.context);
        assert.notStrictEqual(moved && moved.error, undefined);
        assert.ok(String(JSON.stringify(moved)).indexOf('Authenticator session required') === -1);
        await expectThrow(function () {
            return fns.deleteAccount.run({}, enrolled.context);
        }, 'failed-precondition', 'Authenticator session required');
        const deleted = await fns.deleteAccount.run({ mfaSessionId: enrolled.sessionId }, enrolled.context);
        assert.strictEqual(deleted.ok, true);
        let gone = false;
        try { await admin.auth().getUser(uid); } catch (e) { gone = true; }
        assert.strictEqual(gone, true);
        const profile = await db.collection('users').doc(uid).get();
        assert.strictEqual(profile.exists, false);
        const secretGone = await db.collection('totp_secrets').doc(uid).get();
        assert.strictEqual(secretGone.exists, false);
        const codesGone = await db.collection('recovery_codes').doc(uid).get();
        assert.strictEqual(codesGone.exists, false);
        const sessionsGone = await db.collection('totp_sessions').where('uid', '==', uid).get();
        assert.strictEqual(sessionsGone.empty, true);
    });

    await test('admin reset requires an admin, a note, and writes a log', async function () {
        now = 1700007000000;
        const uid = 'e2eadmintarget';
        const email = 'e2eadmintarget@example.com';
        await createUser(uid, email);
        await enrollTotp(uid, 'password', email);
        const adminUid = 'e2eadmin';
        await createUser(adminUid, 'e2eadmin@example.com');
        await admin.auth().setCustomUserClaims(adminUid, { admin: true });
        const userCtx = ctx(adminUid, { provider: 'password', email: 'e2eadmin@example.com' });
        await expectThrow(function () {
            return fns.adminResetSecondFactor.run({ uid: uid, note: 'checked their id' }, userCtx);
        }, 'permission-denied', 'Admin only');
        const adminCtx = ctx(adminUid, { provider: 'password', email: 'e2eadmin@example.com', admin: true });
        await expectThrow(function () {
            return fns.adminResetSecondFactor.run({ uid: uid, note: 'short' }, adminCtx);
        }, 'invalid-argument', 'verified');
        const reset = await fns.adminResetSecondFactor.run({ uid: uid, note: 'Matched a support ticket and their email.' }, adminCtx);
        assert.strictEqual(reset.success, true);
        const secret = await db.collection('totp_secrets').doc(uid).get();
        assert.strictEqual(secret.exists, false);
        const log = await db.collection('mfa_admin_log').where('targetUid', '==', uid).get();
        assert.ok(log.docs.some(function (doc) { return doc.data().action === 'admin_reset'; }));
        assert.ok(String(log.docs[0].data().note).length >= 8);
    });

    await test('anonymous users cannot turn an authenticator on or off', async function () {
        now = 1700008000000;
        const uid = 'e2eanon2fa';
        await createUser(uid, '');
        const anon = ctx(uid, { provider: 'anonymous' });
        await expectThrow(function () {
            return fns.totpSetup.run({}, anon);
        }, 'permission-denied', 'Create an account');
        await expectThrow(function () {
            return fns.totpVerify.run({ code: '123456' }, anon);
        }, 'permission-denied', 'Create an account');
        await expectThrow(function () {
            return fns.totpDisable.run({ code: '123456' }, anon);
        }, 'permission-denied', 'Create an account');
        const pending = await db.collection('totp_pending').doc(uid).get();
        assert.strictEqual(pending.exists, false);
    });

    await test('phone sign-in can turn an authenticator on, sign in, and recover without email', async function () {
        now = 1700009000000;
        const uid = 'e2ephoneprimary';
        await createUser(uid, '');
        const phoneCtx = ctx(uid, { provider: 'phone' });
        const enrolled = await enrollTotp(uid, 'phone', '');
        const sessions = await db.collection('totp_sessions').where('uid', '==', uid).get();
        assert.ok(sessions.docs.length >= 1);
        assert.ok(sessions.docs[0].data().expireAt);
        await pastGate(fns.claimSats, { mfaSessionId: enrolled.sessionId }, phoneCtx);
        await expectThrow(function () {
            return fns.useRecoveryCode.run({ code: 'ZZZZZZZZ' }, phoneCtx);
        }, 'invalid-argument', 'Invalid recovery code');
        const limits = await db.collection('rate_limits').get();
        const salted = limits.docs.filter(function (doc) { return doc.id.indexOf('recoverip_') === 0; });
        assert.ok(salted.length >= 1);
        assert.ok(salted[0].data().expireAt);
        assert.strictEqual(/[0-9]+\.[0-9]+/.test(salted[0].id), false);
        const attemptSnap = await db.collection('totp_rate_limits').get();
        const recoverRows = attemptSnap.docs.filter(function (doc) { return doc.id.indexOf('recover_') === 0; });
        assert.ok(recoverRows.length >= 1, 'recovery account bucket missing');
        assert.ok(recoverRows[0].data().expireAt, 'recovery row has no expireAt');
        assert.ok(/^recover_[a-f0-9]{40}$/.test(recoverRows[0].id));
        const unsalted = require('crypto').createHash('sha256').update(uid).digest('hex').slice(0, 40);
        assert.notStrictEqual(recoverRows[0].id, 'recover_' + unsalted);
        assert.strictEqual(recoverRows[0].id.indexOf(uid), -1);
        const used = await fns.useRecoveryCode.run({ code: enrolled.codes[0] }, phoneCtx);
        assert.strictEqual(used.success, true);
        const secret = await db.collection('totp_secrets').doc(uid).get();
        assert.strictEqual(secret.exists, false);
    });

    await test('client auth cannot write secrets, sessions, recovery codes, or the 2FA flags', async function () {
        const email = 'e2erules@example.com';
        const password = 'test-pass-123';
        await createUser('e2erules', email);
        const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
        const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
        const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'demo-btc';
        const sign = await fetch('http://' + authHost + '/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: password, returnSecureToken: true }),
        });
        const signed = await sign.json();
        assert.ok(signed.idToken, JSON.stringify(signed));
        async function clientWrite(docPath, fields) {
            const url = 'http://' + firestoreHost + '/v1/projects/' + projectId + '/databases/(default)/documents/' + docPath;
            const res = await fetch(url, {
                method: 'PATCH',
                headers: {
                    Authorization: 'Bearer ' + signed.idToken,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ fields: fields }),
            });
            return res.status;
        }
        const secretStatus = await clientWrite('totp_secrets/e2erules?updateMask.fieldPaths=secret', { secret: { stringValue: 'nope' } });
        const sessionStatus = await clientWrite('totp_sessions/e2erules_abcd?updateMask.fieldPaths=uid', { uid: { stringValue: 'e2erules' } });
        const codeStatus = await clientWrite('recovery_codes/e2erules?updateMask.fieldPaths=uid', { uid: { stringValue: 'e2erules' } });
        const flagStatus = await clientWrite('users/e2erules?updateMask.fieldPaths=totpEnabled', { totpEnabled: { booleanValue: true } });
        assert.strictEqual(secretStatus, 403);
        assert.strictEqual(sessionStatus, 403);
        assert.strictEqual(codeStatus, 403);
        assert.strictEqual(flagStatus, 403);
        await db.collection('totp_secrets').doc('e2erules').set({ secretEnc: true, secret: 'server-only', enabled: false });
        const stored = await db.collection('totp_secrets').doc('e2erules').get();
        assert.strictEqual(stored.data().secret, 'server-only');
    });

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(function (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
});
