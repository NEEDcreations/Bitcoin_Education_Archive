'use strict';

// Server-side Nacho analytics counters.
// The browser is hostile: it used to set stats/nacho-analytics to any number.
// recordNachoAnalytics counts +1 per accepted event, rate-limits each account,
// and ignores a repeated event id. It never grants XP, tickets, or sats.

const WINDOW_MS = 60 * 1000;
const WINDOW_MAX = 12;
const DAY_MAX = 80;
const SEEN_MAX = 40;
const RESET_HOUR_UTC = 5;

const TOPICS = {
    lightning: 1, mining: 1, wallets: 1, basics: 1, security: 1, privacy: 1,
    economics: 1, altcoins: 1, technical: 1, history: 1, price: 1, layer2: 1,
    culture: 1, regulation: 1, onboarding: 1, other: 1,
};

// Names the client actually passes to nachoTrackTopic (answer type, or the
// explicit 'kb' / 'fallback' / 'offtopic' / 'unknown' calls). Anything else
// is stored as unknown so a hostile client cannot invent counter keys.
const SOURCES = {
    kb: 1,
    ai: 1,
    'ai+kb': 1,
    offtopic: 1,
    fallback: 1,
    safety: 1,
    unknown: 1,
    crisis: 1,
    harm: 1,
    profanity: 1,
    deepsearch: 1,
    websearch: 1,
    statement: 1,
    math: 1,
    site: 1,
    live: 1,
};

const KNOWN_KEYS = {
    totalQuestions: 1, upvotes: 1, downvotes: 1, missCount: 1,
    topics: 1, sources: 1, lastUpdated: 1, recentMisses: 1, resetAt: 1,
};

function offsetDay(nowMs) {
    const shifted = new Date((Number(nowMs) || 0) - RESET_HOUR_UTC * 3600 * 1000);
    return shifted.toISOString().slice(0, 10);
}

function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function allowTopic(value) {
    const topic = String(value || '');
    return TOPICS[topic] ? topic : 'other';
}

function allowSource(value) {
    const source = String(value || '');
    return SOURCES[source] ? source : 'unknown';
}

function eventIdOk(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(value);
}

function normalizeEvent(data) {
    const src = data && typeof data === 'object' ? data : {};
    const kind = src.kind;
    if (kind !== 'question' && kind !== 'vote' && kind !== 'miss') {
        return { ok: false, code: 'invalid-argument', message: 'Unknown analytics event' };
    }
    if (!eventIdOk(src.eventId)) {
        return { ok: false, code: 'invalid-argument', message: 'Missing event id' };
    }
    const event = {
        kind: kind,
        eventId: src.eventId,
        topic: allowTopic(src.topic),
        source: allowSource(src.source),
    };
    if (kind === 'vote') {
        const rating = Number(src.rating);
        if (rating !== 1 && rating !== -1) {
            return { ok: false, code: 'invalid-argument', message: 'Vote must be up or down' };
        }
        event.rating = rating;
    }
    return { ok: true, event: event };
}

function providerOf(context) {
    const token = context && context.auth && context.auth.token;
    const firebaseToken = token && token.firebase;
    return (firebaseToken && firebaseToken.sign_in_provider) || '';
}

function nextWindow(existing, nowMs) {
    const windowStartMs = num(existing && existing.windowStartMs);
    const count = num(existing && existing.count);
    if (!windowStartMs || nowMs - windowStartMs >= WINDOW_MS) {
        return { ok: true, windowStartMs: nowMs, count: 1 };
    }
    if (count >= WINDOW_MAX) return { ok: false, windowStartMs: windowStartMs, count: count };
    return { ok: true, windowStartMs: windowStartMs, count: count + 1 };
}

function pruneSeen(seen, eventId, nowMs) {
    const next = {};
    const rows = [];
    Object.keys(seen || {}).forEach(function (key) {
        if (!eventIdOk(key) || key === eventId) return;
        rows.push({ key: key, at: num(seen[key]) });
    });
    rows.sort(function (a, b) { return a.at - b.at; });
    const keep = rows.slice(Math.max(0, rows.length - (SEEN_MAX - 1)));
    keep.forEach(function (row) { next[row.key] = row.at || 1; });
    next[eventId] = nowMs;
    return next;
}

function planAcceptance(existing, event, nowMs) {
    const src = existing || {};
    const seen = src.seen && typeof src.seen === 'object' ? src.seen : {};
    if (seen[event.eventId]) return { duplicate: true };
    const window = nextWindow(src, nowMs);
    if (!window.ok) return { rateLimited: true };
    const day = offsetDay(nowMs);
    const sameDay = src.dayKey === day;
    const dayCount = sameDay ? num(src.dayCount) : 0;
    if (dayCount >= DAY_MAX) return { rateLimited: true };
    return {
        ok: true,
        rate: {
            windowStartMs: window.windowStartMs,
            count: window.count,
            dayKey: day,
            dayCount: dayCount + 1,
            kind: 'nacho_analytics',
            seen: pruneSeen(seen, event.eventId, nowMs),
        },
    };
}

function createBody(kind, event) {
    if (kind === 'vote') {
        return {
            totalQuestions: 0,
            upvotes: event.rating === 1 ? 1 : 0,
            downvotes: event.rating === -1 ? 1 : 0,
            missCount: 0,
            topics: {},
            sources: {},
        };
    }
    return {
        totalQuestions: 0,
        upvotes: 0,
        downvotes: 0,
        missCount: 1,
        topics: {},
        sources: {},
    };
}

function updateBody(kind, event, FieldValue) {
    const patch = { lastUpdated: FieldValue.serverTimestamp() };
    if (kind === 'vote') {
        patch[event.rating === 1 ? 'upvotes' : 'downvotes'] = FieldValue.increment(1);
        return patch;
    }
    if (kind === 'miss') {
        patch.missCount = FieldValue.increment(1);
        return patch;
    }
    return patch;
}

// sources['ai+kb'] is one map key. A dotted update string would be a field
// path. FieldPath segments are not split, so '+' stays inside the key.
function writeQuestionStats(tx, snap, ref, event, FieldValue, FieldPath) {
    if (!snap.exists) {
        const topics = {};
        const sources = {};
        topics[event.topic] = 1;
        sources[event.source] = 1;
        tx.set(ref, {
            totalQuestions: 1,
            upvotes: 0,
            downvotes: 0,
            missCount: 0,
            topics: topics,
            sources: sources,
            lastUpdated: FieldValue.serverTimestamp(),
        });
        return;
    }
    tx.update(
        ref,
        'totalQuestions', FieldValue.increment(1),
        'lastUpdated', FieldValue.serverTimestamp(),
        new FieldPath('topics', event.topic), FieldValue.increment(1),
        new FieldPath('sources', event.source), FieldValue.increment(1)
    );
}

function writeCounter(tx, snap, ref, create, update, FieldValue) {
    if (!snap.exists) {
        const body = Object.assign({}, create, { lastUpdated: FieldValue.serverTimestamp() });
        tx.set(ref, body);
        return;
    }
    tx.update(ref, update);
}

function feedbackCreate(event) {
    return {
        total: 1,
        thumbsUp: event.rating === 1 ? 1 : 0,
        thumbsDown: event.rating === -1 ? 1 : 0,
    };
}

function feedbackUpdate(event, FieldValue) {
    const patch = {
        total: FieldValue.increment(1),
        lastUpdated: FieldValue.serverTimestamp(),
    };
    patch[event.rating === 1 ? 'thumbsUp' : 'thumbsDown'] = FieldValue.increment(1);
    return patch;
}

function resetPlan(data) {
    const src = data && typeof data === 'object' ? data : {};
    const topics = src.topics && typeof src.topics === 'object' ? src.topics : {};
    const sources = src.sources && typeof src.sources === 'object' ? src.sources : {};
    const recent = src.recentMisses && typeof src.recentMisses === 'object' ? src.recentMisses : {};
    let extraKeys = 0;
    Object.keys(src).forEach(function (key) {
        if (!KNOWN_KEYS[key]) extraKeys++;
    });
    return {
        before: {
            totalQuestions: num(src.totalQuestions),
            upvotes: num(src.upvotes),
            downvotes: num(src.downvotes),
            missCount: num(src.missCount),
            topicKeys: Object.keys(topics).length,
            sourceKeys: Object.keys(sources).length,
            recentMisses: Object.keys(recent).length,
            extraKeys: extraKeys,
        },
    };
}

function clearedStats(FieldValue) {
    return {
        totalQuestions: 0,
        upvotes: 0,
        downvotes: 0,
        missCount: 0,
        topics: {},
        sources: {},
        lastUpdated: FieldValue.serverTimestamp(),
        resetAt: FieldValue.serverTimestamp(),
    };
}

function createRecordNachoAnalytics(opts) {
    const admin = opts.admin;
    const db = opts.db;
    const HttpsError = opts.HttpsError;
    const FieldValue = admin.firestore.FieldValue;

    return async function recordNachoAnalytics(data, context) {
        if (!context || !context.auth || !context.auth.uid) {
            throw new HttpsError('unauthenticated', 'Must be signed in');
        }
        if (providerOf(context) === 'anonymous') {
            throw new HttpsError('permission-denied', 'Sign in to send stats');
        }
        const parsed = normalizeEvent(data);
        if (!parsed.ok) throw new HttpsError(parsed.code, parsed.message);
        const event = parsed.event;
        const uid = context.auth.uid;
        const now = typeof opts.now === 'function' ? opts.now() : Date.now();
        const rateRef = db.collection('rate_limits').doc('nacho_analytics_' + uid);
        const statsRef = db.collection('stats').doc('nacho-analytics');
        const feedbackRef = db.collection('analytics').doc('nacho_feedback');
        const missRef = db.collection('analytics').doc('nacho_misses');

        return db.runTransaction(async function (tx) {
            const rateSnap = await tx.get(rateRef);
            const statsSnap = await tx.get(statsRef);
            const feedbackSnap = event.kind === 'vote' ? await tx.get(feedbackRef) : null;
            const missSnap = event.kind === 'miss' ? await tx.get(missRef) : null;
            const plan = planAcceptance(rateSnap.exists ? rateSnap.data() : null, event, now);
            if (plan.duplicate) return { ok: true, duplicate: true, counted: false };
            if (plan.rateLimited) {
                throw new HttpsError('resource-exhausted', 'Too many Nacho stats. Try again in a minute.');
            }
            tx.set(rateRef, plan.rate);
            if (event.kind === 'question') {
                writeQuestionStats(tx, statsSnap, statsRef, event, FieldValue, admin.firestore.FieldPath);
            } else {
                writeCounter(
                    tx,
                    statsSnap,
                    statsRef,
                    createBody(event.kind, event),
                    updateBody(event.kind, event, FieldValue),
                    FieldValue
                );
            }
            if (event.kind === 'vote') {
                writeCounter(
                    tx,
                    feedbackSnap,
                    feedbackRef,
                    feedbackCreate(event),
                    feedbackUpdate(event, FieldValue),
                    FieldValue
                );
            }
            if (event.kind === 'miss') {
                writeCounter(
                    tx,
                    missSnap,
                    missRef,
                    { total: 1 },
                    { total: FieldValue.increment(1), lastMiss: FieldValue.serverTimestamp() },
                    FieldValue
                );
            }
            return { ok: true, duplicate: false, counted: true, kind: event.kind };
        });
    };
}

function attachRecordNachoAnalytics(functionsV1, admin, db) {
    const recordNachoAnalytics = functionsV1.runWith({ enforceAppCheck: true }).https.onCall(
        createRecordNachoAnalytics({
            admin: admin,
            db: db,
            HttpsError: functionsV1.https.HttpsError,
        })
    );
    return recordNachoAnalytics;
}

module.exports = {
    WINDOW_MAX: WINDOW_MAX,
    DAY_MAX: DAY_MAX,
    offsetDay: offsetDay,
    normalizeEvent: normalizeEvent,
    planAcceptance: planAcceptance,
    resetPlan: resetPlan,
    clearedStats: clearedStats,
    createRecordNachoAnalytics: createRecordNachoAnalytics,
    attachRecordNachoAnalytics: attachRecordNachoAnalytics,
};
