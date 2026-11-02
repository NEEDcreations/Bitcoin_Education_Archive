'use strict';

// Pure decisions for email-link sign-in. ranking.js keeps an identical copy
// because that file is a classic script, not a module. Tests compare the two.
//
// Auth emulator check (demo-btc, Auth emulator): linking an email that already
// exists returns EMAIL_EXISTS and consumes the oob code. Signing in again with
// that same code returns INVALID_OOB_CODE. The client therefore resends a link
// when the fallback reports an invalid or expired action code, and stores the
// email so the next visit skips the in-place link.

function planEmailLinkFailure(code, hasCredential) {
    if (code === 'auth/multi-factor-auth-required') return 'mfa';
    if ((code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') && hasCredential) return 'credential';
    if (code === 'auth/email-already-in-use' || code === 'auth/credential-already-in-use' || code === 'auth/provider-already-linked') return 'email-link';
    return 'throw';
}

function planEmailSignInFailure(code) {
    if (code === 'auth/multi-factor-auth-required') return 'mfa';
    if (code === 'auth/invalid-action-code' || code === 'auth/expired-action-code') return 'resend';
    return 'toast';
}

function guestLinkShouldDrop(error) {
    return error === 'expired' || error === 'one_guest' || error === 'guest_too_old' || error === 'already_linked' || error === 'bad_nonce';
}

function shouldSkipInPlaceLink(flagEmail, email) {
    var flag = String(flagEmail || '').trim().toLowerCase();
    var current = String(email || '').trim().toLowerCase();
    return flag.length > 0 && flag === current;
}

function guestLinkIsMfaHold(message) {
    var msg = String(message || '');
    return msg.indexOf('Authenticator session required') !== -1 || msg.indexOf('phone verification') !== -1;
}

function queryValue(query, key) {
    var match = String(query || '').match(new RegExp('(?:^|[?&])' + key + '=([^&#]+)'));
    if (!match) return '';
    try { return decodeURIComponent(match[1]); } catch (e) { return match[1]; }
}

function isAccountLinkHref(href) {
    var text = String(href || '');
    if (queryValue(text, 'account_link') === '1') return true;
    var cont = queryValue(text, 'continueUrl');
    return !!cont && queryValue(cont, 'account_link') === '1';
}

function emailFromHref(href) {
    var text = String(href || '');
    var direct = queryValue(text, 'signin_email').trim().toLowerCase();
    if (direct) return direct;
    var cont = queryValue(text, 'continueUrl');
    if (!cont) return '';
    return queryValue(cont, 'signin_email').trim().toLowerCase();
}

function anonymousSignInBlocked(href, hold) {
    if (hold === true) return true;
    var text = String(href || '');
    if (isAccountLinkHref(text)) return true;
    if (queryValue(text, 'mode') === 'signIn' && queryValue(text, 'oobCode')) return true;
    var cont = queryValue(text, 'continueUrl');
    if (cont && queryValue(cont, 'mode') === 'signIn' && queryValue(cont, 'oobCode')) return true;
    return false;
}

function accountLinkCompletion(spec) {
    var src = spec || {};
    var intent = src.intent || null;
    var accountLink = src.accountLink === true;
    var user = src.user || null;
    var email = String(src.email || '').trim().toLowerCase();
    if (!intent && !accountLink) return 'ignore';
    if (intent && email && String(intent.email || '').trim().toLowerCase() !== email) {
        return accountLink ? 'mismatch' : 'stale';
    }
    if (!user) return 'need-session';
    if (user.isAnonymous) {
        if (intent && intent.uid && user.uid === intent.uid) return 'link';
        return 'need-session';
    }
    if (intent && intent.uid && user.uid !== intent.uid) return 'wrong-account';
    if (!intent && String(user.uid || '').indexOf('ln:') !== 0) return 'need-lightning';
    return 'link';
}

function accountLinkHoldMessage(decision) {
    if (decision === 'wrong-account') return 'This link adds an email to the account that asked for it. Sign in with Lightning on that account, then open the link again. We did not switch accounts.';
    if (decision === 'need-lightning') return 'Sign in with Lightning on this device, then open the link again. We did not add the email to a different account.';
    if (decision === 'mismatch') return 'That link does not match the email you asked to add. Send a new link from this account. We did not create a new account.';
    return "Open this link on the device where you're signed in, or sign in with Lightning first and then open the link again. We did not create a new account.";
}

module.exports = {
    planEmailLinkFailure: planEmailLinkFailure,
    planEmailSignInFailure: planEmailSignInFailure,
    guestLinkShouldDrop: guestLinkShouldDrop,
    shouldSkipInPlaceLink: shouldSkipInPlaceLink,
    guestLinkIsMfaHold: guestLinkIsMfaHold,
    isAccountLinkHref: isAccountLinkHref,
    emailFromHref: emailFromHref,
    anonymousSignInBlocked: anonymousSignInBlocked,
    accountLinkCompletion: accountLinkCompletion,
    accountLinkHoldMessage: accountLinkHoldMessage,
};
