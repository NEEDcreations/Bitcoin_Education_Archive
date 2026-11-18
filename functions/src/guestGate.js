'use strict';

// Who counts as a guest for server-side earning.
//
// A guest is a Firebase anonymous session with no real sign-in method on the
// account. A token minted before an in-place link can still say "anonymous"
// for up to an hour, so an anonymous token is checked against Auth before it
// is refused. Custom-token sessions (ln:, nostr:) report "custom" and are
// signed in. A failed Auth lookup is treated as a guest (fail closed).

function tokenProvider(context) {
    const token = context && context.auth && context.auth.token;
    const fb = token && token.firebase;
    return fb && typeof fb.sign_in_provider === 'string' ? fb.sign_in_provider : '';
}

function hasRealProvider(record) {
    return !!(record && Array.isArray(record.providerData) && record.providerData.length > 0);
}

async function isGuestCaller(admin, context) {
    if (!context || !context.auth || !context.auth.uid) return true;
    if (tokenProvider(context) !== 'anonymous') return false;
    try {
        const record = await admin.auth().getUser(context.auth.uid);
        return !hasRealProvider(record);
    } catch (e) {
        return true;
    }
}

// Response for an earning callable called by a guest. Same shape as other
// zero grants so the client does not throw.
const GUEST_EARN_ERROR = 'Sign in to earn rewards';

module.exports = {
    tokenProvider,
    hasRealProvider,
    isGuestCaller,
    GUEST_EARN_ERROR,
};
