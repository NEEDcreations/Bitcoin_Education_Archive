'use strict';

// Pure decisions for email-link sign-in. ranking.js keeps an identical copy
// because that file is a classic script, not a module. Tests compare the two.
//
// Auth emulator check (demo-btc, Auth emulator): linking an email that already
// exists returns EMAIL_EXISTS and consumes the oob code. Signing in again with
// that same code returns INVALID_OOB_CODE. The client therefore resends a link
// when the fallback reports an invalid or expired action code.

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

module.exports = {
    planEmailLinkFailure: planEmailLinkFailure,
    planEmailSignInFailure: planEmailSignInFailure,
    guestLinkShouldDrop: guestLinkShouldDrop,
};
