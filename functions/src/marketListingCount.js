'use strict';

// One count per marketplace listing, written only by the Admin SDK.
// The client cannot bump users.marketListings. A retry of this trigger
// sees the marker and does not count the same listing twice.

const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const LISTING_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function marketListingOwnerUid(data) {
    if (!data || typeof data !== 'object') return '';
    if (data.moderated === true || data.moderationHidden === true || data.hidden === true) return '';
    if (data.status !== 'active') return '';
    const uid = data.sellerUid;
    if (typeof uid !== 'string' || !UID_RE.test(uid)) return '';
    return uid;
}

async function countMarketplaceListing(opts) {
    const o = opts || {};
    const db = o.db;
    const adminSdk = o.admin;
    const listingId = String(o.listingId || '');
    if (!db || !adminSdk) return { counted: false, reason: 'missing' };
    if (!LISTING_ID_RE.test(listingId)) return { counted: false, reason: 'bad_id' };
    const uid = marketListingOwnerUid(o.data);
    if (!uid) return { counted: false, reason: 'skip' };

    const userRef = db.collection('users').doc(uid);
    const markerRef = db.collection('market_listing_counts').doc(listingId);
    const day = o.day || offsetListingDay(o.nowMs || Date.now());
    const dailyRef = db.collection('market_listing_daily').doc(uid + '_' + day);
    const DAILY_CAP = 3;

    return db.runTransaction(async function(t) {
        const marker = await t.get(markerRef);
        if (marker.exists) return { counted: false, reason: 'already_counted', uid: uid };
        const user = await t.get(userRef);
        if (!user.exists) return { counted: false, reason: 'no_user', uid: uid };
        const daily = await t.get(dailyRef);
        const n = daily.exists ? Number(daily.data().n || 0) : 0;
        if (n >= DAILY_CAP) {
            t.set(markerRef, {
                sellerUid: uid,
                counted: false,
                day: day,
                at: adminSdk.firestore.FieldValue.serverTimestamp(),
            });
            return { counted: false, reason: 'daily_cap', uid: uid, day: day };
        }
        t.set(markerRef, {
            sellerUid: uid,
            counted: true,
            day: day,
            at: adminSdk.firestore.FieldValue.serverTimestamp(),
        });
        t.set(dailyRef, { uid: uid, day: day, n: n + 1 }, { merge: true });
        t.update(userRef, {
            marketListings: adminSdk.firestore.FieldValue.increment(1),
        });
        return { counted: true, uid: uid, day: day, n: n + 1 };
    });
}

function offsetListingDay(nowMs) {
    const shifted = new Date(Number(nowMs) - 5 * 3600 * 1000);
    return shifted.toISOString().slice(0, 10);
}

module.exports = {
    countMarketplaceListing,
    marketListingOwnerUid,
    offsetListingDay,
};
