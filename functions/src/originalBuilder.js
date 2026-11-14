'use strict';

// Original Builder badge for returning players.
// Eligibility: at least one completed quest before the kill-switch cutoff,
// awarded the first time that account signs in on or after unlockAt (Jan 3, 2027).
// Behind config/originalBuilder.enabled, which defaults OFF.
// The exact cutoff is a config value because the kill-switch time is not set yet.

const BADGE_ID = 'original_builder';
const CONFIG_COLLECTION = 'config';
const CONFIG_DOC = 'originalBuilder';
const CLAIMS_COLLECTION = 'original_builder_claims';
const ELIGIBLE_COLLECTION = 'original_builder_eligible';

// Placeholder cutoff: 12:00 AM America/New_York on Dec 1, 2026 (EST = UTC-5).
// Replace via config/originalBuilder.cutoffAt once the kill-switch time is set.
const DEFAULT_CUTOFF_MS = Date.parse('2026-12-01T05:00:00.000Z');
// 12:00 AM America/New_York on Jan 3, 2027 (EST = UTC-5).
const DEFAULT_UNLOCK_MS = Date.parse('2027-01-03T05:00:00.000Z');

function toMillis(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number' && isFinite(value)) return value;
    if (typeof value === 'string') {
        const ms = Date.parse(value);
        return isNaN(ms) ? null : ms;
    }
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') {
        const d = value.toDate();
        return d && typeof d.getTime === 'function' ? d.getTime() : null;
    }
    if (value instanceof Date) return value.getTime();
    if (typeof value._seconds === 'number') return value._seconds * 1000 + Math.floor((value._nanoseconds || 0) / 1e6);
    if (typeof value.seconds === 'number') return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
    return null;
}

function stampForQuery(adminSdk, ms) {
    if (adminSdk && adminSdk.firestore && adminSdk.firestore.Timestamp && typeof adminSdk.firestore.Timestamp.fromMillis === 'function') {
        return adminSdk.firestore.Timestamp.fromMillis(ms);
    }
    return new Date(ms);
}

function readConfigFromData(data) {
    const row = data || {};
    const testOnlyUids = Array.isArray(row.testOnlyUids)
        ? row.testOnlyUids.map(function (u) { return String(u || ''); }).filter(Boolean)
        : [];
    return {
        enabled: row.enabled === true,
        cutoffAtMs: toMillis(row.cutoffAt) || DEFAULT_CUTOFF_MS,
        unlockAtMs: toMillis(row.unlockAt) || DEFAULT_UNLOCK_MS,
        testOnlyUids: testOnlyUids,
    };
}

async function readConfig(db) {
    const snap = await db.collection(CONFIG_COLLECTION).doc(CONFIG_DOC).get();
    const data = snap && snap.exists && typeof snap.data === 'function' ? (snap.data() || {}) : {};
    return readConfigFromData(data);
}

function userHasTimestampedQuest(user, cutoffMs) {
    if (!user) return false;
    const first = toMillis(user.firstQuestAt) || toMillis(user.firstQuestPassedAt) || toMillis(user.questsPassedAt);
    return first != null && first < cutoffMs;
}

async function hasQuestBeforeCutoff(db, adminSdk, uid, cutoffMs, user) {
    const userRef = db.collection('users').doc(uid);

    // Frozen snapshot, if one was taken at (or before) the kill switch.
    try {
        const eligibleSnap = await db.collection(ELIGIBLE_COLLECTION).doc(uid).get();
        if (eligibleSnap && eligibleSnap.exists) return { ok: true, via: 'snapshot' };
    } catch (e) {}

    if (user && user.originalBuilderEligible === true) {
        return { ok: true, via: 'user_flag' };
    }
    if (userHasTimestampedQuest(user, cutoffMs)) {
        return { ok: true, via: 'user_first_quest' };
    }

    // quest_passes.at is a server timestamp written on each passed quest.
    try {
        const cutoffStamp = stampForQuery(adminSdk, cutoffMs);
        const passSnap = await userRef.collection('quest_passes')
            .where('at', '<', cutoffStamp)
            .limit(1)
            .get();
        if (passSnap && !passSnap.empty) return { ok: true, via: 'quest_passes' };
    } catch (e) {}

    // Fallback: a quest_* badge awarded before the cutoff.
    try {
        const awardsSnap = await userRef.collection('badge_awards').get();
        let found = false;
        const visit = function (doc) {
            if (found || !doc || !doc.id) return;
            if (!/^quest_/.test(doc.id)) return;
            const data = typeof doc.data === 'function' ? (doc.data() || {}) : {};
            const at = toMillis(data.awardedAt);
            if (at != null && at < cutoffMs) found = true;
        };
        if (awardsSnap && typeof awardsSnap.forEach === 'function') awardsSnap.forEach(visit);
        else if (awardsSnap && awardsSnap.docs) awardsSnap.docs.forEach(visit);
        if (found) return { ok: true, via: 'quest_badge_award' };
    } catch (e) {}

    return { ok: false, via: null };
}

async function writeClaim(db, adminSdk, uid, nowMs, extra) {
    const ref = db.collection(CLAIMS_COLLECTION).doc(uid);
    const existing = await ref.get();
    if (existing && existing.exists) return;
    const FieldValue = adminSdk && adminSdk.firestore && adminSdk.firestore.FieldValue;
    const payload = {
        uid: uid,
        badge: BADGE_ID,
        claimedAt: FieldValue && typeof FieldValue.serverTimestamp === 'function'
            ? FieldValue.serverTimestamp()
            : new Date(nowMs),
        claimedAtMs: nowMs,
    };
    if (extra && extra.via) payload.via = String(extra.via);
    await ref.set(payload, { merge: true });
}

async function maybeAward(db, adminSdk, uid, opts) {
    const options = opts || {};
    const nowMs = Number(options.nowMs) || Date.now();
    if (!uid) return { granted: false, reason: 'no_uid', badgeId: BADGE_ID };

    const config = options.config || await readConfig(db);
    if (!config.enabled) return { granted: false, reason: 'disabled', badgeId: BADGE_ID };
    if (config.testOnlyUids && config.testOnlyUids.length && config.testOnlyUids.indexOf(uid) === -1) {
        return { granted: false, reason: 'not_in_test_allowlist', badgeId: BADGE_ID };
    }
    if (nowMs < config.unlockAtMs) {
        return { granted: false, reason: 'too_early', badgeId: BADGE_ID, unlockAtMs: config.unlockAtMs };
    }

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap || !userSnap.exists) return { granted: false, reason: 'no_user', badgeId: BADGE_ID };
    const user = typeof userSnap.data === 'function' ? (userSnap.data() || {}) : {};

    const already = await userRef.collection('badge_awards').doc(BADGE_ID).get();
    if (already && already.exists) {
        try { await writeClaim(db, adminSdk, uid, nowMs, { via: 'already' }); } catch (e) {}
        return { granted: false, reason: 'already', success: true, badgeId: BADGE_ID };
    }

    const evidence = await hasQuestBeforeCutoff(db, adminSdk, uid, config.cutoffAtMs, user);
    if (!evidence.ok) return { granted: false, reason: 'ineligible', badgeId: BADGE_ID };

    const awardFn = options.awardFn || function (id, awardOpts) {
        return require('./awardBadge').awardBadge(db, adminSdk, uid, id, awardOpts);
    };
    const result = await awardFn(BADGE_ID, {
        verified: true,
        favor: false,
        source: 'original_builder',
        nowMs: nowMs,
    });
    if (result && (result.granted || result.reason === 'already' || result.reason === 'legacy')) {
        try { await writeClaim(db, adminSdk, uid, nowMs, { via: evidence.via }); } catch (e) {}
    }
    if (result) result.via = evidence.via;
    return result || { granted: false, reason: 'award_failed', badgeId: BADGE_ID };
}

function makeClaimOriginalBuilder(deps) {
    const db = deps.db;
    const adminSdk = deps.admin;
    const functionsV1 = deps.functionsV1;
    return async function claimOriginalBuilder(data, context) {
        if (!context || !context.auth) {
            throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
        }
        if (context.auth.token && context.auth.token.firebase && context.auth.token.firebase.sign_in_provider === 'anonymous') {
            throw new functionsV1.https.HttpsError('permission-denied', 'Sign in required');
        }
        const uid = context.auth.uid;
        try {
            const result = await maybeAward(db, adminSdk, uid, {});
            return Object.assign({ success: true }, result);
        } catch (e) {
            console.warn('[originalBuilder] claim failed', e && e.message);
            return { success: false, granted: false, reason: 'error', badgeId: BADGE_ID };
        }
    };
}

module.exports = {
    BADGE_ID: BADGE_ID,
    CONFIG_DOC: CONFIG_DOC,
    CLAIMS_COLLECTION: CLAIMS_COLLECTION,
    ELIGIBLE_COLLECTION: ELIGIBLE_COLLECTION,
    DEFAULT_CUTOFF_MS: DEFAULT_CUTOFF_MS,
    DEFAULT_UNLOCK_MS: DEFAULT_UNLOCK_MS,
    toMillis: toMillis,
    readConfigFromData: readConfigFromData,
    readConfig: readConfig,
    hasQuestBeforeCutoff: hasQuestBeforeCutoff,
    maybeAward: maybeAward,
    makeClaimOriginalBuilder: makeClaimOriginalBuilder,
};
