#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
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

test('a resend flag skips the in-place link for that email only', function () {
    assert.strictEqual(plan.shouldSkipInPlaceLink('User@Example.com', 'user@example.com'), true);
    assert.strictEqual(plan.shouldSkipInPlaceLink('', 'user@example.com'), false);
    assert.strictEqual(plan.shouldSkipInPlaceLink('other@example.com', 'user@example.com'), false);
});

test('a 2FA gate holds the guest token instead of dropping it', function () {
    assert.strictEqual(plan.guestLinkIsMfaHold('Authenticator session required'), true);
    assert.strictEqual(plan.guestLinkIsMfaHold('Sign in again so your phone verification applies.'), true);
    assert.strictEqual(plan.guestLinkIsMfaHold('Guest session could not be linked.'), false);
    assert.strictEqual(plan.guestLinkIsMfaHold(''), false);
});

test('ranking.js uses the same email-link decisions and does not rethrow a bare email-already-in-use', function () {
    const src = fs.readFileSync(path.join(__dirname, '..', 'ranking.js'), 'utf8');
    const moduleSrc = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'emailLinkPlan.js'), 'utf8');
    ['function planEmailLinkFailure', 'function planEmailSignInFailure', 'function guestLinkShouldDrop', 'function shouldSkipInPlaceLink', 'function guestLinkIsMfaHold'].forEach(function (name) {
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
    assert.ok(emailFn.includes('shouldSkipInPlaceLink'));
    assert.ok(emailFn.includes("setItem('btc_skip_email_link'"));
    assert.ok(emailFn.indexOf("setItem('btc_skip_email_link'") < emailFn.indexOf('sendMagicLink'));
    assert.ok(emailFn.includes('!guestHold'));
    assert.ok(!emailFn.includes('&& linkErr.credential) {'));
    const guestFn = src.slice(src.indexOf('async function tryLinkGuest'), src.indexOf('async function createUser'));
    assert.ok(guestFn.indexOf('guestLinkIsMfaHold') < guestFn.indexOf("removeItem('btc_guest_link')"));
    assert.ok(guestFn.includes('window._pendingGuestLink = true'));
    assert.ok(guestFn.includes("return 'mfa'"));
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

test('sign-in methods card shows for guests and Lightning-only accounts, and sign-out warns them', function () {
    const src = fs.readFileSync(path.join(__dirname, '..', 'ranking.js'), 'utf8');
    const block = src.slice(src.indexOf('// ACCOUNT_LINK_PLAN_START'), src.indexOf('// ACCOUNT_LINK_PLAN_END'));
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(block, sandbox);

    const guest = { uid: 'guest-1', isAnonymous: true, providerData: [] };
    const guestHtml = sandbox.renderSignInMethodsCard(guest, {});
    assert.ok(guestHtml.includes('id="signInMethodsCard"'));
    assert.ok(guestHtml.includes('Sign-in methods'));
    assert.ok(guestHtml.includes('>Guest<'));
    assert.ok(guestHtml.includes('Link email'));
    assert.ok(guestHtml.includes('Link Google'));
    assert.ok(guestHtml.includes('id="accountGsiButtonHost"'));
    assert.strictEqual(sandbox.accountCanLinkSignIn(guest, {}), true);
    const guestWarn = sandbox.signOutWarningForAccount(guest, {});
    assert.strictEqual(guestWarn.kind, 'guest');
    assert.strictEqual(guestWarn.message, "You'll lose this account unless you link a sign-in first.");

    const ln = { uid: 'ln:' + 'ab'.repeat(16), isAnonymous: false, providerData: [] };
    const lnProfile = { authMethod: 'lightning' };
    const lnHtml = sandbox.renderSignInMethodsCard(ln, lnProfile);
    assert.ok(lnHtml.includes('>Lightning<'));
    assert.ok(lnHtml.includes('Lightning only'));
    assert.ok(lnHtml.includes('Link email'));
    assert.ok(lnHtml.includes('Link Google'));
    assert.strictEqual(sandbox.accountCanLinkSignIn(ln, lnProfile), true);
    assert.strictEqual(sandbox.isLightningOnlyAccount(ln, lnProfile), true);
    const lnWarn = sandbox.signOutWarningForAccount(ln, lnProfile);
    assert.strictEqual(lnWarn.kind, 'lightning');
    assert.strictEqual(lnWarn.message, "To sign back in you'll need the same Lightning wallet. Link an email or Google first to make it easier.");

    const google = { uid: 'google-user', isAnonymous: false, providerData: [{ providerId: 'google.com' }] };
    const googleHtml = sandbox.renderSignInMethodsCard(google, {});
    assert.ok(googleHtml.includes('>Google<'));
    assert.ok(!googleHtml.includes('id="accountLinkEmail"'));
    assert.ok(!googleHtml.includes('id="accountGsiButtonHost"'));
    assert.strictEqual(sandbox.accountCanLinkSignIn(google, {}), false);
    assert.strictEqual(sandbox.signOutWarningForAccount(google, {}), null);

    const emailUser = { uid: 'email-user', isAnonymous: false, providerData: [{ providerId: 'password' }] };
    const emailHtml = sandbox.renderSignInMethodsCard(emailUser, {});
    assert.ok(emailHtml.includes('>Email<'));
    assert.ok(!emailHtml.includes('Link email</button>'));
    assert.strictEqual(sandbox.signOutWarningForAccount(emailUser, {}), null);

    const linkedLn = { uid: 'ln:deadbeef', isAnonymous: false, providerData: [{ providerId: 'google.com' }] };
    const linkedHtml = sandbox.renderSignInMethodsCard(linkedLn, lnProfile);
    assert.ok(linkedHtml.includes('>Google<'));
    assert.ok(linkedHtml.includes('>Lightning<'));
    assert.ok(!linkedHtml.includes('id="accountLinkEmail"'));
    assert.strictEqual(sandbox.isLightningOnlyAccount(linkedLn, lnProfile), false);
    assert.strictEqual(sandbox.signOutWarningForAccount(linkedLn, lnProfile), null);

    assert.strictEqual(sandbox.isLightningOnlyAccount({ uid: 'ln:deadbeef', isAnonymous: false, providerData: [] }, { authMethod: 'email' }), false);
    assert.strictEqual(sandbox.isLightningOnlyAccount({ uid: 'ln:deadbeef', isAnonymous: false, providerData: [] }, null), false);
    assert.strictEqual(sandbox.signOutWarningForAccount({ uid: 'ln:deadbeef', isAnonymous: false, providerData: [] }, null), null);

    const guestWithGoogle = { uid: 'g', isAnonymous: true, providerData: [{ providerId: 'google.com' }] };
    assert.strictEqual(sandbox.accountCanLinkSignIn(guestWithGoogle, {}), false);
    assert.strictEqual(sandbox.signOutWarningForAccount(guestWithGoogle, {}), null);
    assert.ok(!sandbox.renderSignInMethodsCard(guestWithGoogle, {}).includes('id="accountGsiButtonHost"'));

    assert.ok(sandbox.accountLinkConflictMessage('auth/credential-already-in-use').indexOf('did not combine') !== -1);
    assert.ok(sandbox.accountLinkConflictMessage('auth/email-already-in-use').indexOf('another account') !== -1);
    assert.ok(sandbox.accountLinkConflictMessage('auth/account-exists-with-different-credential').indexOf('another account') !== -1);
    assert.strictEqual(sandbox.accountLinkConflictMessage('auth/network-request-failed'), '');

    assert.ok(src.includes('html += renderSignInMethodsCard(user,'));
    assert.ok(src.includes('Link an email from the Sign-in methods card on the Account tab, then you can enable 2FA.'));
    assert.ok(!src.includes('Link an email to your account first (in Account tab)'));
    assert.ok(src.includes('>Link a sign-in</button>'));
    assert.ok(src.includes('>Sign out anyway</button>'));
    const signOut = src.slice(src.indexOf('async function signOutUser'), src.indexOf('async function signOutUser') + 2200);
    assert.ok(signOut.includes('force !== true'));
    assert.ok(signOut.includes('signOutWarningForAccount'));
    assert.ok(signOut.indexOf('signOutWarningForAccount') < signOut.indexOf("collection('push_tokens')"));
    assert.ok(src.includes('onclick="signOutUser()"'));
    assert.ok(src.includes('onclick="signOutUser(true)"'));

    const emailLinkFn = src.slice(src.indexOf('async function finishAccountEmailLink'), src.indexOf('async function linkGoogleOntoCurrentAccount'));
    assert.ok(emailLinkFn.includes('credentialWithLink'));
    assert.ok(emailLinkFn.includes('linkWithCredential'));
    assert.ok(!emailLinkFn.includes('signInWithCredential'));
    assert.ok(!emailLinkFn.includes('signInWithEmailLink'));
    assert.ok(!emailLinkFn.includes("collection('users')"));
    assert.ok(!emailLinkFn.includes('email: email'));
    assert.ok(emailLinkFn.includes('intent.uid'));

    const stash = src.slice(src.indexOf('async function stashGuestLink'), src.indexOf('window.stashGuestLink = stashGuestLink'));
    assert.ok(stash.includes('attempt < 2'));
    assert.ok(stash.includes("showToast('Could not save this guest session. Try again before you sign in.')"));
    assert.ok(stash.indexOf('for (attempt = 0; attempt < 2; attempt++)') < stash.indexOf('showToast'));

    const fnSrc = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    const callback = fnSrc.slice(fnSrc.indexOf('exports.lnAuthCallback'), fnSrc.indexOf('exports.lnAuthVerify'));
    assert.ok(callback.includes("displayName: '⚡wallet-' + key.substring(0, 12)"));
    assert.ok(!callback.includes('⚡anon-'));
    assert.ok(callback.includes('await admin.auth().getUser(lnUid)'));
    const createAt = callback.indexOf('createUser');
    const nameAt = callback.indexOf("displayName: '⚡wallet-'");
    assert.ok(createAt > 0 && nameAt > callback.indexOf('getUser(lnUid)'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
