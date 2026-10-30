'use strict';

// Sats vs Bits tally. Clients may read polls/sats_vs_bits. They cannot create
// it. This callable creates the document and increments it in one transaction
// with the daily IP and device counters.

const DOC_PATH = 'polls/sats_vs_bits';
const MAX_BATCH = 50;
const MAX_PER_DAY = 200;

function cleanIp(value) {
    const cleaned = String(value || 'unknown').replace(/[.\/:]/g, '_').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
    return cleaned || 'unknown';
}

function cleanFp(value) {
    const cleaned = String(value || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
    return cleaned || 'none';
}

function requestedCounts(data) {
    const src = data || {};
    let sats = Math.max(0, Math.min(parseInt(src.satsCount, 10) || 0, MAX_BATCH));
    let bits = Math.max(0, Math.min(parseInt(src.bitsCount, 10) || 0, MAX_BATCH));
    if (sats === 0 && bits === 0) {
        if (src.side === 'sats') sats = 1;
        else if (src.side === 'bits') bits = 1;
        else return { ok: false, error: 'Invalid side' };
    }
    if (sats + bits === 0) return { ok: false, error: 'No votes' };
    return { ok: true, sats: sats, bits: bits };
}

function createSvbVote(opts) {
    const admin = opts.admin;
    const db = opts.db;
    const HttpsError = opts.HttpsError;
    const FieldValue = admin.firestore.FieldValue;

    return async function pollVote(data, context) {
        const counts = requestedCounts(data);
        if (!counts.ok) return { success: false, error: counts.error };
        const ctx = context || {};
        const ip = cleanIp(ctx.rawRequest && ctx.rawRequest.ip);
        const fp = cleanFp(data && data.fingerprint);
        const dayKey = new Date().toISOString().split('T')[0];
        const ipKey = 'ip_' + ip;
        const fpKey = 'fp_' + fp;
        const pollRef = db.doc(DOC_PATH);
        const rateRef = db.doc('poll_rate_limits/' + dayKey);

        await db.runTransaction(async function (tx) {
            const pollSnap = await tx.get(pollRef);
            const rateDoc = await tx.get(rateRef);
            const rateData = rateDoc.exists ? (rateDoc.data() || {}) : {};
            const ipCount = Number(rateData[ipKey] || 0);
            const fpCount = Number(rateData[fpKey] || 0);
            if (ipCount >= MAX_PER_DAY) throw new HttpsError('resource-exhausted', 'Daily IP limit reached');
            if (fpCount >= MAX_PER_DAY) throw new HttpsError('resource-exhausted', 'Daily device limit reached');

            const totalInc = counts.sats + counts.bits;
            const remaining = Math.max(0, MAX_PER_DAY - Math.max(ipCount, fpCount));
            const allowed = Math.min(totalInc, remaining);
            const ratio = totalInc ? allowed / totalInc : 0;
            const aSats = Math.round(counts.sats * ratio);
            const aBits = allowed - aSats;
            const inc = {};
            if (aSats > 0) inc.sats = FieldValue.increment(aSats);
            if (aBits > 0) inc.bits = FieldValue.increment(aBits);
            if (aSats > 0 || aBits > 0) tx.set(pollRef, inc, { merge: true });
            const rateInc = {};
            rateInc[ipKey] = FieldValue.increment(allowed);
            rateInc[fpKey] = FieldValue.increment(allowed);
            tx.set(rateRef, rateInc, { merge: true });
            return pollSnap.exists;
        });

        const pollDoc = await pollRef.get();
        const pollData = pollDoc.exists ? (pollDoc.data() || {}) : {};
        return { success: true, sats: pollData.sats || 0, bits: pollData.bits || 0 };
    };
}

module.exports = {
    DOC_PATH: DOC_PATH,
    MAX_BATCH: MAX_BATCH,
    createSvbVote: createSvbVote,
    requestedCounts: requestedCounts,
};
