#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { authenticator } = require('../functions/node_modules/otplib');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('  ok  ' + name);
        passed++;
    } catch (e) {
        console.log('  FAIL ' + name);
        console.log('       ' + e.message);
        failed++;
    }
}

function read(rel) {
    return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function withWindow(step, window, fn) {
    const prev = Object.assign({}, authenticator.options);
    authenticator.options = Object.assign({}, prev, { step: step, window: window });
    try { return fn(); }
    finally { authenticator.options = prev; }
}

test('enrollment accepts the current code and rejects a wrong code', function () {
    withWindow(30, 1, function () {
        const secret = authenticator.generateSecret();
        const token = authenticator.generate(secret);
        assert.strictEqual(authenticator.verify({ token: token, secret: secret }), true);
        assert.strictEqual(authenticator.verify({ token: '000000', secret: secret }), false);
    });
});

test('a code from outside the step window is expired', function () {
    const secret = authenticator.generateSecret();
    const prev = Object.assign({}, authenticator.options);
    const now = Date.now();
    authenticator.options = Object.assign({}, prev, { step: 30, window: 1, epoch: now });
    const fresh = authenticator.generate(secret);
    authenticator.options = Object.assign({}, prev, { step: 30, window: 1, epoch: now - 5 * 60 * 1000 });
    const past = authenticator.generate(secret);
    authenticator.options = Object.assign({}, prev, { step: 30, window: 1, epoch: now });
    assert.notStrictEqual(past, fresh);
    assert.strictEqual(authenticator.verify({ token: past, secret: secret }), false);
    assert.strictEqual(authenticator.verify({ token: fresh, secret: secret }), true);
    authenticator.options = prev;
});

test('server session, recovery hashes, and fail-closed key live in the second-factor module', function () {
    const src = read('functions/src/secondFactor.js');
    const index = read('functions/index.js');
    ['totpSetup', 'totpVerify', 'totpCheck', 'totpDisable', 'totpStatus', 'totpRevokeSession',
        'totpResumeDevice', 'totpStepUp', 'totpListDevices', 'totpRevokeDevice',
        'totpSignOutOtherDevices', 'totpRevokeAllTrust',
        'issueRecoveryCodes', 'regenerateRecoveryCodes', 'useRecoveryCode', 'phoneFactorRemoved',
        'adminResetSecondFactor', 'deleteAccount'].forEach(function (name) {
        assert.ok(index.includes('exports.' + name), name);
    });
    assert.ok(src.includes('resource-exhausted'));
    assert.ok(src.includes('120000'));
    assert.ok(src.includes('>= 5') || src.includes('>= RATE_MAX'));
    assert.ok(src.includes('Authenticator session required'));
    assert.ok(src.includes('totp_sessions'));
    assert.ok(src.includes('scryptSync'));
    assert.ok(src.includes('timingSafeEqual'));
    assert.ok(src.includes('This code was already used'));
    assert.ok(src.includes('secretEnc'));
    assert.ok(src.includes('TOTP_ENCRYPTION_KEY missing'));
    assert.ok(src.includes("secrets: ['TOTP_ENCRYPTION_KEY']"));
    ['totpSetup', 'totpVerify', 'totpCheck', 'totpDisable', 'regenerateRecoveryCodes'].forEach(function (name) {
        assert.ok(src.includes('const ' + name + ' = onCallWithKey'), name + ' secret binding');
    });
    assert.ok(src.includes('sign_in_second_factor'));
    assert.ok(!src.includes('console.log'));
    assert.ok(index.includes('requireSecondFactor'));
    assert.ok(src.includes('expireAt: new Date(windowStart + RATE_WINDOW_MS)'));
    assert.ok(src.includes("doc(uid + '_day')"), 'daily failure doc');
    assert.ok(src.includes('expireAt: new Date(failStart + DAILY_WINDOW_MS)'));
    assert.ok(src.includes('sweepExpiredMfaRows'));
    assert.ok(src.includes("networkRateDocId(db, 'recover_'"), 'recovery bucket');
    assert.ok(!src.includes("takeAttempt('recover_' + "));
    assert.ok(index.includes('sweepExpiredMfaRows(db, new Date())'));
    const gated = ['claimSats', 'awardPoints', 'dailySpin', 'donatePoints', 'v4vSplitRelay',
        'spendTickets', 'spendTicketsForFreeze', 'convertPointsToTickets', 'activateHashBooster',
        'useHintToken', 'activateDoubleXP', 'useBonusSpin', 'mergeAnonBadges'];
    gated.forEach(function (name) {
        const at = index.indexOf('exports.' + name);
        assert.ok(at > 0, name);
        const body = index.slice(at, at + 900);
        assert.ok(body.includes('requireSecondFactor'), name + ' gate');
    });
    ['functions/src/gifting.js', 'functions/src/onboardingApi.js', 'functions/src/satoshiFavor.js', 'functions/src/contributeRaid.js'].forEach(function (file) {
        assert.ok(read(file).includes('requireSecondFactor'), file);
    });
    const rules = read('firestore.rules');
    ['totp_pending', 'totp_secrets', 'totp_rate_limits', 'totp_sessions', 'trusted_devices', 'totp_fresh_proofs', 'recovery_codes', 'mfa_admin_log'].forEach(function (col) {
        const at = rules.indexOf('match /' + col + '/');
        assert.ok(at > 0, col);
        assert.ok(rules.slice(at, at + 180).includes('allow read, write: if false'), col);
    });
    assert.ok(rules.includes("'totpEnabled'"));
    assert.ok(rules.includes("'phoneVerified'"));
    const migrate = read('functions/migrate-totp-secrets.js');
    assert.ok(migrate.includes('--apply'));
    assert.ok(migrate.includes('Refusing to apply'));
    assert.ok(!migrate.includes('console.log(process.env'));
});

test('the app asks the server, and every sign-in method can reach a challenge or recovery', function () {
    const client = read('ranking.js');
    assert.ok(client.includes('totpEnabled'));
    assert.ok(client.includes('_showTotpSignInChallenge'));
    assert.ok(client.includes('_showMFASignInChallenge'));
    assert.ok(client.includes('auth/requires-recent-login'));
    assert.ok(client.includes('multiFactor.unenroll'));
    assert.ok(client.includes('PhoneMultiFactorGenerator'));
    assert.ok(client.includes('useRecoveryCode'));
    assert.ok(client.includes('mfaRecoveryEmail'));
    assert.ok(client.includes('_serverTotpAllows'));
    assert.ok(client.includes('btc_mfa_session_'));
    assert.ok(client.includes('btc_mfa_device_'));
    assert.ok(client.includes('Remember this device for 30 days'));
    assert.ok(client.includes('totpRememberDevice'));
    assert.ok(client.includes("httpsCallable('totpResumeDevice')"));
    assert.ok(client.includes('mfaRetryOnce'));
    assert.ok(client.includes('Sign out other devices'));
    assert.ok(client.includes('function mfaIsTransientError'));
    const src = read('functions/src/secondFactor.js');
    assert.ok(src.includes('trusted_devices'));
    assert.ok(src.includes('enforceAppCheck: true'));
    assert.ok(src.includes('const totpResumeDevice = onCallApp'));
    assert.ok(src.includes('DEVICE_TTL_MS'));
    assert.ok(src.includes('FRESH_TTL_MS'));
    assert.ok(src.includes('Enter a fresh authenticator code for this action.'));
    assert.ok(!client.includes("getItem('btc_totp_verified_"));
    assert.ok(!client.includes('getItem("btc_totp_verified_'));
    assert.ok(client.includes("removeItem('btc_totp_verified_'"));
    assert.ok(client.includes('Nostr and Lightning use an authenticator app'));
    ['finishEmailSignIn', 'signInWithGoogle', 'signInWithTwitter', 'signInWithGithub',
        'signInWithFacebook', 'nostrCompleteAuth', 'signInWithLightning', 'surfaceMfaRequired'].forEach(function (name) {
        assert.ok(client.includes(name), name);
    });
    assert.ok(client.includes("httpsCallable('deleteAccount', { timeout: 540000 })"));
    assert.strictEqual(read('index.html'), read('404.html'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
