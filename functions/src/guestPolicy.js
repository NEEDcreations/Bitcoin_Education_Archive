'use strict';
// One guest definition for the whole app. PvP's client check in pvp.js.src
// follows the same rule; mini-app guest-access.js lives on the guest-access PR.
//
// A player is a GUEST when there is no session, or the session is a Firebase
// anonymous session with no real sign-in method linked to it.
// Everything else is LOGGED IN:
//   email (password or email link), Google, X, GitHub, Facebook, phone,
//   and custom-token sign-ins (Nostr and Lightning use custom tokens, so the
//   token's sign_in_provider is 'custom').
// A username alone does not make an account logged in: username-only signup
// is an anonymous session with a profile doc, so it is a guest until the
// player links a sign-in method. An email address alone (with no provider)
// does not count either.
// Guests can play. They never earn XP, badges, OrangeTix, sats, streaks or
// leaderboard entries, never chat, and never link outside accounts.

const NOT_REAL = { anonymous: true, '': true };
// Firebase also lists 'email' and 'phone' under token.firebase.identities.
// Those keys only appear when a real provider is linked, so they count.
function realIds(ids) {
    const out = [];
    (ids || []).forEach(function (id) {
        const s = String(id || '');
        if (!NOT_REAL[s] && out.indexOf(s) < 0) out.push(s);
    });
    return out;
}

// The shared rule on a plain identity:
//   { signedIn: bool, signInProvider: string, providerIds: [string] }
function isGuestIdentity(identity) {
    const id = identity || {};
    if (id.signedIn !== true) return true;
    const provider = String(id.signInProvider || '');
    if (!provider) return true;
    if (provider !== 'anonymous') return false;
    return realIds(id.providerIds).length === 0;
}

// Callable context (ID token claims).
function identityFromContext(context) {
    if (!context || !context.auth) return { signedIn: false, signInProvider: '', providerIds: [] };
    const token = context.auth.token || {};
    const fb = token.firebase || {};
    const identities = fb.identities && typeof fb.identities === 'object' ? Object.keys(fb.identities) : [];
    return { signedIn: true, signInProvider: String(fb.sign_in_provider || ''), providerIds: identities };
}

function isGuestContext(context) {
    return isGuestIdentity(identityFromContext(context));
}

// Admin Auth user record, for a player who is not the caller (PvP opponent,
// lobby summary). A record has no session, so a custom-token account is
// recognised by its Nostr / Lightning uid or by a server-written sign-in link
// on its profile. An email on the record with no provider does not count.
function identityFromRecord(record, profile) {
    if (!record || !record.uid) return { signedIn: false, signInProvider: '', providerIds: [] };
    const ids = (record.providerData || []).map(function (p) { return p && p.providerId; });
    const uid = String(record.uid || '');
    const links = profile && Array.isArray(profile.signInLinks) ? profile.signInLinks : [];
    const custom = uid.indexOf('nostr:') === 0 || uid.indexOf('ln:') === 0
        || links.indexOf('nostr') >= 0 || links.indexOf('lightning') >= 0;
    if (custom) return { signedIn: true, signInProvider: 'custom', providerIds: ids };
    return { signedIn: true, signInProvider: realIds(ids).length ? String(realIds(ids)[0]) : 'anonymous', providerIds: ids };
}

function isGuestRecord(record, profile) {
    return isGuestIdentity(identityFromRecord(record, profile));
}

// The zero result a reward callable returns to a guest. success:false with
// guest:true lets the client show the "log in" note instead of an error.
function guestRewardResult() {
    return { success: false, guest: true, error: 'Log in to earn rewards', awarded: 0, tickets: 0 };
}

module.exports = {
    isGuestIdentity,
    identityFromContext,
    isGuestContext,
    identityFromRecord,
    isGuestRecord,
    guestRewardResult,
};
