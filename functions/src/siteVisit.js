'use strict';

// stats/visits increases by 1, once per uid per UTC day. The client does not
// write the counter.

function utcDay(nowMs) {
    return new Date(nowMs).toISOString().slice(0, 10);
}

function createSiteVisit(opts) {
    const admin = opts.admin;
    const db = opts.db;
    const HttpsError = opts.HttpsError;

    return async function recordSiteVisit(data, context) {
        if (!context || !context.auth || !context.auth.uid) {
            throw new HttpsError('unauthenticated', 'Must be signed in');
        }
        const uid = context.auth.uid;
        const nowMs = typeof opts.now === 'function' ? opts.now() : Date.now();
        const day = utcDay(nowMs);
        const visitRef = db.collection('visits').doc(uid);
        const counterRef = db.collection('stats').doc('visits');
        const counted = await db.runTransaction(async function (t) {
            const snap = await t.get(visitRef);
            const prev = snap.exists ? String((snap.data() || {}).lastVisit || '') : '';
            if (prev === day) return false;
            t.set(visitRef, { lastVisit: day, fp: uid }, { merge: true });
            t.set(counterRef, {
                total: admin.firestore.FieldValue.increment(1),
            }, { merge: true });
            return true;
        });
        return { ok: true, counted: counted === true, day: day };
    };
}

module.exports = {
    utcDay: utcDay,
    createSiteVisit: createSiteVisit,
};
