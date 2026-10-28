'use strict';

// Pleb numbers and stats/global.userCount are assigned once, on the server.
// An empty guest shell does not count. A counted profile keeps its number.

function pointsOf(data) {
    const n = Number(data && data.points);
    return Number.isFinite(n) ? n : 0;
}

function providerIds(authUser) {
    const list = authUser && authUser.providerData;
    if (!Array.isArray(list)) return [];
    const ids = [];
    for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const id = item && (item.providerId || item.id);
        if (id) ids.push(String(id));
    }
    return ids;
}

// Nostr and Lightning accounts are custom-token users. Their uid prefix is
// the signed-in signal, because providerData stays empty. Anonymous Firebase
// users have an empty provider list and no email.
function isSignedInAccount(uid, authUser) {
    const id = String(uid || '');
    if (id.indexOf('nostr:') === 0 || id.indexOf('ln:') === 0) return true;
    if (!authUser) return false;
    if (authUser.email) return true;
    const ids = providerIds(authUser);
    for (let i = 0; i < ids.length; i++) {
        if (ids[i] && ids[i] !== 'anonymous') return true;
    }
    return false;
}

// before is null on create. An existing plebNumber is never replaced and
// never increments userCount again, including guests who already have one.
function countDecision(input) {
    const before = input && input.before ? input.before : null;
    const after = (input && input.after) || {};
    if (after.plebNumber || (before && before.plebNumber)) {
        return { count: false, reason: 'already' };
    }
    const beforePts = before ? pointsOf(before) : 0;
    const afterPts = pointsOf(after);
    if (afterPts > beforePts && afterPts > 0 && beforePts <= 0) {
        return { count: true, reason: 'xp' };
    }
    if (input && input.signedIn === true) {
        return { count: true, reason: 'signed-in' };
    }
    return { count: false, reason: 'shell' };
}

async function assignPlebNumber(db, admin, uid) {
    const userRef = db.collection('users').doc(uid);
    const statsRef = db.collection('stats').doc('global');
    return db.runTransaction(async function (t) {
        const userSnap = await t.get(userRef);
        if (!userSnap.exists) return { assigned: false, reason: 'missing' };
        const data = userSnap.data() || {};
        if (data.plebNumber) {
            return { assigned: false, reason: 'already', plebNumber: data.plebNumber };
        }
        const statsSnap = await t.get(statsRef);
        const current = statsSnap.exists ? Number((statsSnap.data() || {}).userCount) || 0 : 0;
        const plebNumber = current + 1;
        t.set(statsRef, { userCount: admin.firestore.FieldValue.increment(1) }, { merge: true });
        t.set(userRef, { plebNumber: plebNumber }, { merge: true });
        return { assigned: true, reason: 'assigned', plebNumber: plebNumber };
    });
}

// An update of a guest who still has no points and no Pleb number is not an
// upgrade. Skip the Auth lookup. A brand-new doc (before is null) can still
// be a signed-in account, so that path may call getUser.
function shouldLookupAuth(before, after) {
    if (!after) return false;
    if (after.plebNumber || (before && before.plebNumber)) return false;
    if (pointsOf(after) > 0) return false;
    if (!before) return true;
    return false;
}

async function maybeCountMember(db, admin, uid, before, after) {
    if (!after) return { count: false, reason: 'deleted' };
    const xp = countDecision({ before: before, after: after, signedIn: false });
    if (xp.reason === 'already') return { count: false, reason: 'already' };
    if (xp.count) {
        const assigned = await assignPlebNumber(db, admin, uid);
        return { count: !!assigned.assigned, reason: 'xp', plebNumber: assigned.plebNumber };
    }
    if (isSignedInAccount(uid, null)) {
        const assigned = await assignPlebNumber(db, admin, uid);
        return { count: !!assigned.assigned, reason: 'signed-in', plebNumber: assigned.plebNumber };
    }
    if (!shouldLookupAuth(before, after)) return { count: false, reason: 'shell' };
    let authUser = null;
    try {
        const api = admin && typeof admin.auth === 'function' ? admin.auth() : null;
        if (api && typeof api.getUser === 'function') authUser = await api.getUser(uid);
    } catch (e) {
        authUser = null;
    }
    const signed = countDecision({
        before: before,
        after: after,
        signedIn: isSignedInAccount(uid, authUser),
    });
    if (!signed.count) return { count: false, reason: signed.reason };
    const assigned = await assignPlebNumber(db, admin, uid);
    return { count: !!assigned.assigned, reason: 'signed-in', plebNumber: assigned.plebNumber };
}

module.exports = {
    pointsOf: pointsOf,
    providerIds: providerIds,
    isSignedInAccount: isSignedInAccount,
    countDecision: countDecision,
    assignPlebNumber: assignPlebNumber,
    shouldLookupAuth: shouldLookupAuth,
    maybeCountMember: maybeCountMember,
};
