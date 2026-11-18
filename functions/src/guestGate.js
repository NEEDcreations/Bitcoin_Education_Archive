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

// A real sign-in method is any providerData entry other than anonymous.
// Auth does not list anonymous there today; the check keeps an anonymous-only
// record a guest if it ever does.
function hasRealProvider(record) {
    if (!record || !Array.isArray(record.providerData)) return false;
    return record.providerData.some(function (p) {
        return !!(p && typeof p.providerId === 'string' && p.providerId && p.providerId !== 'anonymous');
    });
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

// Same rule for a uid taken from a document (triggers, server award paths)
// where there is no caller token. Custom-token uids (ln:, nostr:) are
// signed in and have no providerData, so they are never guests. Anything
// else is a guest when Auth shows no real sign-in method. A failed lookup,
// including a missing Auth user, is treated as a guest (fail closed), the
// same as isGuestCaller.
function isCustomTokenUid(uid) {
    return typeof uid === 'string' && /^(ln|nostr):/.test(uid);
}

async function isGuestUid(admin, uid) {
    if (typeof uid !== 'string' || !uid) return true;
    if (isCustomTokenUid(uid)) return false;
    try {
        const record = await admin.auth().getUser(uid);
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
    isCustomTokenUid,
    isGuestUid,
    GUEST_EARN_ERROR,
};
