#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const plan = require('../functions/src/emailLinkPlan');

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

test('returning email falls through to signInWithEmailLink when the link has no credential', function () {
    assert.strictEqual(plan.planEmailLinkFailure('auth/email-already-in-use', false), 'email-link');
    assert.strictEqual(plan.planEmailLinkFailure('auth/credential-already-in-use', false), 'email-link');
    assert.strictEqual(plan.planEmailLinkFailure('auth/provider-already-linked', false), 'email-link');
});

test('a recovered OAuth credential signs in with that credential', function () {
    assert.strictEqual(plan.planEmailLinkFailure('auth/credential-already-in-use', true), 'credential');
    assert.strictEqual(plan.planEmailLinkFailure('auth/email-already-in-use', true), 'credential');
});

test('phone 2FA is never swallowed by the email-link fallback', function () {
    assert.strictEqual(plan.planEmailLinkFailure('auth/multi-factor-auth-required', false), 'mfa');
    assert.strictEqual(plan.planEmailLinkFailure('auth/multi-factor-auth-required', true), 'mfa');
    assert.strictEqual(plan.planEmailSignInFailure('auth/multi-factor-auth-required'), 'mfa');
});

test('a consumed one-time link asks for an automatic resend', function () {
    assert.strictEqual(plan.planEmailSignInFailure('auth/invalid-action-code'), 'resend');
    assert.strictEqual(plan.planEmailSignInFailure('auth/expired-action-code'), 'resend');
    assert.strictEqual(plan.planEmailSignInFailure('auth/invalid-email'), 'toast');
});

test('other link errors still throw', function () {
    assert.strictEqual(plan.planEmailLinkFailure('auth/invalid-action-code', false), 'throw');
    assert.strictEqual(plan.planEmailLinkFailure('auth/network-request-failed', false), 'throw');
});

test('permanent guest-merge failures drop the stored token', function () {
    ['expired', 'one_guest', 'guest_too_old', 'already_linked', 'bad_nonce'].forEach(function (code) {
        assert.strictEqual(plan.guestLinkShouldDrop(code), true, code);
    });
    assert.strictEqual(plan.guestLinkShouldDrop('unavailable'), false);
    assert.strictEqual(plan.guestLinkShouldDrop(''), false);
});

test('ranking.js uses the same email-link decisions and does not rethrow a bare email-already-in-use', function () {
    const src = fs.readFileSync(path.join(__dirname, '..', 'ranking.js'), 'utf8');
    const moduleSrc = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'emailLinkPlan.js'), 'utf8');
    ['function planEmailLinkFailure', 'function planEmailSignInFailure', 'function guestLinkShouldDrop'].forEach(function (name) {
        const start = moduleSrc.indexOf(name);
        const next = moduleSrc.indexOf('\nfunction ', start + name.length);
        const body = moduleSrc.slice(start, next === -1 ? moduleSrc.indexOf('\nmodule.exports') : next).trim();
        assert.ok(src.includes(body), 'ranking.js drifted from ' + name);
    });
    const emailFn = src.slice(src.indexOf('async function finishEmailSignIn'), src.indexOf('// Google Sign-In'));
    assert.ok(emailFn.includes("planEmailLinkFailure"));
    assert.ok(emailFn.includes('signInWithEmailLink'));
    assert.ok(emailFn.includes('sendMagicLink'));
    assert.ok(emailFn.includes('auth/link-consumed'));
    assert.ok(emailFn.includes('surfaceMfaRequired'));
    assert.ok(!emailFn.includes('&& linkErr.credential) {'));
    ['signInWithGoogle', 'signInWithFacebook', 'signInWithTwitter', 'signInWithGithub', 'nostrCompleteAuth', 'signInWithProvider'].forEach(function (name) {
        const at = src.indexOf('function ' + name) >= 0 ? src.indexOf('function ' + name) : src.indexOf(name + ' =');
        assert.ok(at > 0, name);
        const slice = src.slice(at, at + 8000);
        assert.ok(slice.includes('surfaceMfaRequired'), name + ' must surface phone 2FA');
    });
    const ln = src.indexOf('window.signInWithLightning');
    assert.ok(src.slice(ln, ln + 9000).includes('surfaceMfaRequired'));
    assert.ok(src.includes('guestLinkShouldDrop'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
