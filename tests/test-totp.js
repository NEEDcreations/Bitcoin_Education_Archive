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

test('server TOTP checks are rate limited and the secret stays server-only', function () {
    const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    ['exports.totpSetup', 'exports.totpVerify', 'exports.totpCheck', 'exports.totpDisable'].forEach(function (name) {
        assert.ok(src.includes(name), name);
    });
    const check = src.slice(src.indexOf('exports.totpCheck'), src.indexOf('exports.totpDisable'));
    assert.ok(check.includes('resource-exhausted'));
    assert.ok(check.includes('120000'));
    assert.ok(check.includes('>= 5'));
    assert.ok(!check.includes('return { success: true, secret'));
    const disable = src.slice(src.indexOf('exports.totpDisable'), src.indexOf('exports.totpStatus'));
    assert.ok(disable.includes('data.code'));
    assert.ok(disable.includes('Invalid code'));
    assert.ok(disable.includes('totpEnabled: false'));
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    ['totp_pending', 'totp_secrets', 'totp_rate_limits'].forEach(function (col) {
        const at = rules.indexOf('match /' + col + '/');
        assert.ok(at > 0, col);
        const block = rules.slice(at, at + 180);
        assert.ok(block.includes('allow read, write: if false'), col);
    });
    assert.ok(!src.includes('backupCode'));
    assert.ok(!src.includes('recoveryCode'));
});

test('sign-in still reaches the authenticator gate and the phone challenge', function () {
    const client = fs.readFileSync(path.join(__dirname, '..', 'ranking.js'), 'utf8');
    assert.ok(client.includes('totpEnabled'));
    assert.ok(client.includes('_showTotpSignInChallenge'));
    assert.ok(client.includes('_showMFASignInChallenge'));
    assert.ok(client.includes('auth/requires-recent-login'));
    assert.ok(client.includes('multiFactor.unenroll'));
    assert.ok(client.includes('PhoneMultiFactorGenerator'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
