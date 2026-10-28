'use strict';

// stats/nacho-analytics is server-owned. Each accepted call adds 1.
// The client cannot name the total.

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 30;

function sanitizeKey(value) {
    const raw = String(value || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
    if (!raw || raw === 'constructor' || raw === 'prototype' || raw === '__proto__') return '';
    return raw;
}

function kindOf(value) {
    const kind = String(value || '');
    if (kind === 'question' || kind === 'up' || kind === 'down') return kind;
    return '';
}

function recentStamps(prev, nowMs, windowMs) {
    const stamps = prev && Array.isArray(prev.stamps) ? prev.stamps : [];
    const kept = [];
    for (let i = 0; i < stamps.length; i++) {
        const n = Number(stamps[i]);
        if (Number.isFinite(n) && nowMs - n < windowMs) kept.push(n);
    }
    return kept;
}

function rateDecision(prev, nowMs, windowMs, max) {
    const stamps = recentStamps(prev, nowMs, windowMs);
    if (stamps.length >= max) return { ok: false, stamps: stamps };
    stamps.push(nowMs);
    return { ok: true, stamps: stamps };
}

function bumpPatch(kind, topic, source, FieldValue) {
    const patch = { lastUpdated: FieldValue.serverTimestamp() };
    if (kind === 'question') {
        patch.totalQuestions = FieldValue.increment(1);
        if (topic) patch['topics.' + topic] = FieldValue.increment(1);
        if (source) patch['sources.' + source] = FieldValue.increment(1);
        return patch;
    }
    if (kind === 'up') patch.upvotes = FieldValue.increment(1);
    else patch.downvotes = FieldValue.increment(1);
    return patch;
}

function createNachoBump(opts) {
    const admin = opts.admin;
    const db = opts.db;
    const HttpsError = opts.HttpsError;
    const windowMs = opts.windowMs || WINDOW_MS;
    const max = opts.maxPerWindow || MAX_PER_WINDOW;

    return async function bumpNachoAnalytics(data, context) {
        if (!context || !context.auth || !context.auth.uid) {
            throw new HttpsError('unauthenticated', 'Must be signed in');
        }
        const kind = kindOf(data && data.kind);
        if (!kind) throw new HttpsError('invalid-argument', 'Unknown analytics event');
        const topic = kind === 'question' ? sanitizeKey(data && data.topic) : '';
        const source = kind === 'question' ? sanitizeKey(data && data.source) : '';
        const uid = context.auth.uid;
        const nowMs = typeof opts.now === 'function' ? opts.now() : Date.now();
        const rateRef = db.collection('nacho_analytics_rate').doc(uid);
        const statsRef = db.collection('stats').doc('nacho-analytics');
        const FieldValue = admin.firestore.FieldValue;

        await db.runTransaction(async function (t) {
            const rateSnap = await t.get(rateRef);
            const prev = rateSnap.exists ? (rateSnap.data() || {}) : {};
            const rate = rateDecision(prev, nowMs, windowMs, max);
            if (!rate.ok) throw new HttpsError('resource-exhausted', 'Slow down');
            t.set(rateRef, {
                uid: uid,
                stamps: rate.stamps,
                updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
            t.set(statsRef, bumpPatch(kind, topic, source, FieldValue), { merge: true });
        });
        return { ok: true, kind: kind };
    };
}

module.exports = {
    WINDOW_MS: WINDOW_MS,
    MAX_PER_WINDOW: MAX_PER_WINDOW,
    sanitizeKey: sanitizeKey,
    kindOf: kindOf,
    rateDecision: rateDecision,
    bumpPatch: bumpPatch,
    createNachoBump: createNachoBump,
};
