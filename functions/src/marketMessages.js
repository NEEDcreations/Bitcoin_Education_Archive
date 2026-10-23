'use strict';

// One counted buyer message per listing. The client cannot bump marketMessages.

const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function buyerMessage(data) {
    if (!data || typeof data !== 'object') return null;
    const buyer = data.buyerUid;
    const sender = data.senderUid;
    const listingId = data.listingId;
    if (typeof buyer !== 'string' || !UID_RE.test(buyer)) return null;
    if (sender !== buyer) return null;
    if (typeof listingId !== 'string' || !UID_RE.test(listingId)) return null;
    return { buyer: buyer, listingId: listingId };
}

async function countMarketplaceMessage(opts) {
    const o = opts || {};
    const db = o.db;
    const adminSdk = o.admin;
    const parsed = buyerMessage(o.data);
    if (!db || !adminSdk) return { counted: false, reason: 'missing' };
    if (!parsed) return { counted: false, reason: 'skip' };
    const markerId = parsed.listingId + '_' + parsed.buyer;
    const markerRef = db.collection('market_message_counts').doc(markerId);
    const userRef = db.collection('users').doc(parsed.buyer);
    const listingRef = db.collection('marketplace').doc(parsed.listingId);

    return db.runTransaction(async function (t) {
        const marker = await t.get(markerRef);
        if (marker.exists) return { counted: false, reason: 'already_counted', uid: parsed.buyer };
        const user = await t.get(userRef);
        if (!user.exists) return { counted: false, reason: 'no_user', uid: parsed.buyer };
        t.set(markerRef, {
            buyerUid: parsed.buyer,
            listingId: parsed.listingId,
            at: adminSdk.firestore.FieldValue.serverTimestamp(),
        });
        t.update(userRef, { marketMessages: adminSdk.firestore.FieldValue.increment(1) });
        t.set(listingRef, { buyerMessageCounted: true }, { merge: true });
        return { counted: true, uid: parsed.buyer, listingId: parsed.listingId };
    });
}

async function countMarketplaceSale(opts) {
    const o = opts || {};
    const before = o.before || {};
    const after = o.after || {};
    if (before.status === 'sold' || after.status !== 'sold') return { counted: false, reason: 'not_sold' };
    if (after.buyerMessageCounted !== true) return { counted: false, reason: 'no_buyer_thread' };
    const uid = after.sellerUid;
    if (typeof uid !== 'string' || !UID_RE.test(uid)) return { counted: false, reason: 'skip' };
    const listingId = String(o.listingId || '');
    if (!UID_RE.test(listingId)) return { counted: false, reason: 'bad_id' };
    const db = o.db;
    const adminSdk = o.admin;
    const markerRef = db.collection('market_sale_counts').doc(listingId);
    const userRef = db.collection('users').doc(uid);
    return db.runTransaction(async function (t) {
        const marker = await t.get(markerRef);
        if (marker.exists) return { counted: false, reason: 'already_counted' };
        const user = await t.get(userRef);
        if (!user.exists) return { counted: false, reason: 'no_user' };
        t.set(markerRef, { sellerUid: uid, at: adminSdk.firestore.FieldValue.serverTimestamp() });
        t.update(userRef, { marketSold: adminSdk.firestore.FieldValue.increment(1) });
        return { counted: true, uid: uid };
    });
}

module.exports = {
    buyerMessage: buyerMessage,
    countMarketplaceMessage: countMarketplaceMessage,
    countMarketplaceSale: countMarketplaceSale,
};
