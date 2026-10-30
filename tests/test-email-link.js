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
    ['function planEmailLinkFailure', 'function planEmailSignInFailure', 'function guestLinkShouldDrop', 'function shouldSkipInPlaceLink', 'function guestLinkIsMfaHold', 'function queryValue', 'function isAccountLinkHref', 'function emailFromHref', 'function anonymousSignInBlocked', 'function accountLinkCompletion', 'function accountLinkHoldMessage'].forEach(function (name) {
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

test('a pending authenticator check blocks linking and cancel signs straight out', function () {
    const src = fs.readFileSync(path.join(__dirname, '..', 'ranking.js'), 'utf8');
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const block = src.slice(src.indexOf('// ACCOUNT_LINK_PLAN_START'), src.indexOf('// ACCOUNT_LINK_PLAN_END'));
    const sandbox = {
        document: {
            getElementById: function (id) { return id === 'totpSignInOverlay' ? { id: id } : null; }
        }
    };
    vm.createContext(sandbox);
    vm.runInContext(block, sandbox);
    assert.strictEqual(sandbox.accountLinkTotpPending(), true);
    const guest = { uid: 'guest-1', isAnonymous: true, providerData: [] };
    const held = sandbox.renderSignInMethodsCard(guest, {});
    assert.ok(held.includes('Finish the authenticator check before linking a sign-in.'));
    assert.ok(!held.includes('id="accountLinkEmail"'));
    assert.ok(!held.includes('id="accountGsiButtonHost"'));
    assert.ok(!held.includes('onclick="sendAccountLinkEmail()"'));
    assert.ok(!held.includes('onclick="linkGoogleFromAccount()"'));

    const totp = src.slice(src.indexOf('window._showTotpSignInChallenge = function'), src.indexOf('window._submitTotpSignIn = async function'));
    assert.ok(totp.includes('Cancel (Sign out)'));
    assert.ok(totp.includes('onclick="signOutUser(true)"'));
    assert.ok(!totp.includes('onclick="signOutUser()"'));
    const go = src.slice(src.indexOf('function goToSignInMethods'), src.indexOf('window.goToSignInMethods'));
    assert.ok(!go.includes('totpSignInOverlay'));
    assert.ok(!go.includes("getElementById('totpSignInOverlay')"));
    const tos = html.slice(html.indexOf('class="tos-signout"'), html.indexOf('class="tos-signout"') + 180);
    assert.ok(tos.includes('Sign out instead'));
    assert.ok(tos.includes('signOutUser(true)'));
    assert.ok(!tos.includes('signOutUser()"'));

    const handlerEnd = {
        'window.sendAccountLinkEmail': 'window.linkGoogleFromAccount',
        'window.linkGoogleFromAccount': 'function presentSignOutLinkWarning',
        'async function linkGoogleOntoCurrentAccount': 'function surfaceMfaRequired',
        'async function finishAccountEmailLink': 'async function linkGoogleOntoCurrentAccount'
    };
    Object.keys(handlerEnd).forEach(function (name) {
        const at = src.indexOf(name);
        const end = src.indexOf(handlerEnd[name], at + name.length);
        assert.ok(at > 0 && end > at, name);
        const slice = src.slice(at, end);
        assert.ok(slice.includes('accountLinkTotpPending'), name + ' checks the authenticator overlay');
        if (slice.includes('linkWith')) {
            assert.ok(slice.indexOf('accountLinkTotpPending') < slice.indexOf('linkWith'), name);
        }
    });
    const send = src.slice(src.indexOf('window.sendAccountLinkEmail'), src.indexOf('window.linkGoogleFromAccount'));
    assert.ok(send.indexOf('accountLinkTotpPending') < send.indexOf('writeAccountLinkIntent'));
});

test('a guest link creates the profile and a stale intent falls through', function () {
    const src = fs.readFileSync(path.join(__dirname, '..', 'ranking.js'), 'utf8');
    const block = src.slice(src.indexOf('// ACCOUNT_LINK_PLAN_START'), src.indexOf('// ACCOUNT_LINK_PLAN_END'));
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(block, sandbox);
    const now = 1700000000000;
    const hour = sandbox.ACCOUNT_LINK_MAX_AGE_MS;
    assert.strictEqual(hour, 60 * 60 * 1000);
    assert.strictEqual(sandbox.accountLinkIntentFresh({ kind: 'email', uid: 'guest-1', email: 'guest@example.com', at: now }, now), true);
    assert.strictEqual(sandbox.accountLinkIntentFresh({ kind: 'email', uid: 'guest-1', email: 'guest@example.com', at: now - hour }, now), true);
    assert.strictEqual(sandbox.accountLinkIntentFresh({ kind: 'email', uid: 'guest-1', email: 'guest@example.com', at: now - hour - 1 }, now), false);
    assert.strictEqual(sandbox.accountLinkIntentFresh({ kind: 'email', uid: '', email: 'guest@example.com', at: now }, now), false);
    assert.strictEqual(sandbox.accountLinkIntentFresh({ kind: 'email', uid: 'guest-1', email: 'guest@example.com' }, now), false);

    const read = src.slice(src.indexOf('function readAccountLinkIntent'), src.indexOf('function writeAccountLinkIntent'));
    assert.ok(read.includes('accountLinkIntentFresh'));
    assert.ok(read.includes('clearAccountLinkIntent()'));

    assert.strictEqual(plan.accountLinkCompletion({
        intent: { uid: 'ln:abc', email: 'a@example.com' },
        accountLink: true,
        user: null,
        email: 'a@example.com',
    }), 'need-session');
    assert.strictEqual(plan.accountLinkCompletion({
        intent: { uid: 'ln:abc', email: 'a@example.com' },
        accountLink: true,
        user: { uid: 'anon-new', isAnonymous: true },
        email: 'a@example.com',
    }), 'need-session');
    assert.strictEqual(plan.accountLinkCompletion({
        intent: { uid: 'guest', email: 'a@example.com' },
        accountLink: true,
        user: { uid: 'guest', isAnonymous: true },
        email: 'a@example.com',
    }), 'link');
    assert.strictEqual(plan.accountLinkCompletion({
        intent: { uid: 'ln:abc', email: 'a@example.com' },
        accountLink: true,
        user: { uid: 'ln:abc', isAnonymous: false },
        email: 'a@example.com',
    }), 'link');
    assert.strictEqual(plan.accountLinkCompletion({
        intent: { uid: 'ln:abc', email: 'a@example.com' },
        accountLink: true,
        user: { uid: 'ln:other', isAnonymous: false },
        email: 'a@example.com',
    }), 'wrong-account');
    assert.strictEqual(plan.accountLinkCompletion({
        intent: null,
        accountLink: true,
        user: { uid: 'google-user', isAnonymous: false },
        email: 'a@example.com',
    }), 'need-lightning');
    assert.strictEqual(plan.accountLinkCompletion({
        intent: null,
        accountLink: true,
        user: { uid: 'ln:abc', isAnonymous: false },
        email: 'a@example.com',
    }), 'link');
    assert.strictEqual(plan.accountLinkCompletion({
        intent: { uid: 'ln:abc', email: 'a@example.com' },
        accountLink: false,
        user: { uid: 'ln:abc', isAnonymous: false },
        email: 'other@example.com',
    }), 'stale');
    assert.strictEqual(plan.accountLinkCompletion({ intent: null, accountLink: false, user: null, email: 'a@example.com' }), 'ignore');
    assert.strictEqual(plan.isAccountLinkHref('https://bitcoineducation.quest/?signin_email=a%40e.com&account_link=1'), true);
    assert.strictEqual(plan.isAccountLinkHref('https://bitcoineducation.quest/?continueUrl=' + encodeURIComponent('https://bitcoineducation.quest/?account_link=1&signin_email=a%40e.com')), true);
    assert.strictEqual(plan.isAccountLinkHref('https://bitcoineducation.quest/?signin_email=a%40e.com'), false);
    assert.strictEqual(plan.emailFromHref('https://bitcoineducation.quest/?signin_email=a%40e.com&account_link=1'), 'a@e.com');
    assert.strictEqual(plan.anonymousSignInBlocked('https://bitcoineducation.quest/?mode=signIn&oobCode=abc', false), true);
    assert.strictEqual(plan.anonymousSignInBlocked('https://bitcoineducation.quest/', false), false);
    assert.strictEqual(plan.anonymousSignInBlocked('https://bitcoineducation.quest/', true), true);
    assert.ok(plan.accountLinkHoldMessage('need-session').indexOf('did not create a new account') !== -1);
    assert.ok(plan.accountLinkHoldMessage('need-session').indexOf('Lightning') !== -1);
    assert.ok(plan.accountLinkHoldMessage('wrong-account').indexOf('did not switch') !== -1);
    assert.ok(plan.accountLinkHoldMessage('need-lightning').indexOf('different account') !== -1);

    const emailLinkFn = src.slice(src.indexOf('async function finishAccountEmailLink'), src.indexOf('async function linkGoogleOntoCurrentAccount'));
    const stale = emailLinkFn.slice(emailLinkFn.indexOf("decision === 'stale'"), emailLinkFn.indexOf("decision !== 'link'"));
    assert.ok(stale.includes('clearAccountLinkIntent()'));
    assert.ok(stale.includes('return false'));
    assert.ok(emailLinkFn.includes("presentAccountLinkHold(decision)"));
    assert.ok(emailLinkFn.includes('accountLinkCompletion'));
    assert.ok(emailLinkFn.includes('intent.uid'));
    assert.ok(!emailLinkFn.includes('signInAnonymously'));
    assert.ok(emailLinkFn.includes('var wasGuest = !!user.isAnonymous'));
    assert.ok(emailLinkFn.indexOf('var wasGuest = !!user.isAnonymous') < emailLinkFn.indexOf('linkWithCredential'));
    assert.ok(emailLinkFn.includes('if (wasGuest && typeof _handleSignInResultGlobal === \'function\')'));
    assert.ok(emailLinkFn.includes('_handleSignInResultGlobal(auth.currentUser, null, null)'));
    assert.ok(!emailLinkFn.includes('signInWithCredential'));
    assert.ok(!emailLinkFn.includes("collection('users')"));
    assert.ok(src.includes('function startAnonymousSession()'));
    assert.ok(src.includes('function anonymousSignInBlockedNow()'));
    assert.ok(src.indexOf('auth.signInAnonymously().then(() => {})') === -1);
    const listener = src.slice(src.indexOf('auth.onAuthStateChanged(user => {'), src.indexOf('async function handleEmailSignIn'));
    assert.ok(listener.includes('startAnonymousSession()'));
    assert.ok(!listener.includes('auth.signInAnonymously()'));
    assert.ok(src.includes('z-index:2200010'));
    assert.ok(src.includes('accountLink: true'));
    assert.ok(src.includes("localStorage.setItem('emailForSignIn', email)"));
    const addModal = src.slice(src.indexOf('window.showChangeEmailModal = function'), src.indexOf('window.submitEmailChange'));
    assert.ok(addModal.includes('z-index:2200010'));
    assert.ok(addModal.includes('does not open a new one'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
