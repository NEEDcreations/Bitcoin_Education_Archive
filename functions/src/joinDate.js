'use strict';

// Join instant for a user profile.
// The profile card reads public_profiles. The field written on signup is
// `created`. Older and newer paths have also used createdAt, joinedAt, a
// millisecond number, a unix-seconds number, or a date string.
// lastLogin, lastSeen, and lastVisit are not join dates and are never used.
// A value before 2020-01-01 or more than 48 hours in the future is rejected
// so a seconds/milliseconds mixup cannot show 1970.

const JOIN_KEYS = [
    'created', 'createdAt', 'joinedAt', 'joined',
    'signupAt', 'accountCreated', 'createdAtMs', 'joinedAtMs',
];
const MIN_MS = Date.UTC(2020, 0, 1);
const MAX_FUTURE_MS = 48 * 60 * 60 * 1000;

function numberMillis(n) {
    // A bare number is milliseconds. Values in the unix-seconds range are
    // rejected here: treating them as seconds would turn a 1970 millisecond
    // instant into a modern date. Firestore seconds live on .seconds.
    if (typeof n !== 'number' || !isFinite(n) || n <= 0) return null;
    if (n >= 1e12 && n < 1e14) return Math.round(n);
    return null;
}

function secondsMillis(sec, nano) {
    const s = Number(sec);
    if (!isFinite(s) || s <= 0) return null;
    let n = Number(nano);
    if (!isFinite(n)) n = 0;
    if (s >= 1e12 && s < 1e14) return Math.round(s);
    if (s >= 1e9 && s < 1e12) return Math.round(s * 1000 + n / 1e6);
    return null;
}

function rawMillis(value) {
    if (value == null || value === false) return null;
    if (typeof value === 'number') return numberMillis(value);
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        if (/^\d+(\.\d+)?$/.test(trimmed)) return numberMillis(Number(trimmed));
        const parsed = Date.parse(trimmed);
        return isFinite(parsed) ? parsed : null;
    }
    if (typeof value === 'object') {
        if (typeof value.toDate === 'function') {
            try {
                const d = value.toDate();
                if (d && typeof d.getTime === 'function') {
                    const t = d.getTime();
                    if (isFinite(t)) return t;
                }
            } catch (e) { /* try the next shape */ }
        }
        if (typeof value.toMillis === 'function') {
            try {
                const n = Number(value.toMillis());
                if (isFinite(n)) return n;
            } catch (e2) { /* try the next shape */ }
        }
        if (typeof value.getTime === 'function' && typeof value.toDate !== 'function') {
            try {
                const t = value.getTime();
                if (isFinite(t)) return t;
            } catch (e3) { /* try the next shape */ }
        }
        const seconds = value.seconds != null ? value.seconds : value._seconds;
        if (seconds != null && seconds !== '') {
            const nano = value.nanoseconds != null ? value.nanoseconds : value._nanoseconds;
            return secondsMillis(seconds, nano);
        }
    }
    return null;
}

function joinMillis(value, nowMs) {
    const now = typeof nowMs === 'number' && isFinite(nowMs) ? nowMs : Date.now();
    const ms = rawMillis(value);
    if (ms == null) return null;
    if (ms < MIN_MS || ms > now + MAX_FUTURE_MS) return null;
    return ms;
}

function hasJoin(data, nowMs) {
    const row = data || null;
    if (!row) return false;
    for (let i = 0; i < JOIN_KEYS.length; i++) {
        const key = JOIN_KEYS[i];
        if (!Object.prototype.hasOwnProperty.call(row, key)) continue;
        if (joinMillis(row[key], nowMs) != null) return true;
    }
    return false;
}

function creationTimeMillis(metadata, nowMs) {
    if (!metadata) return null;
    return joinMillis(metadata.creationTime, nowMs);
}

function timestampFromMillis(admin, ms) {
    if (ms == null || !admin || !admin.firestore || !admin.firestore.Timestamp) return null;
    return admin.firestore.Timestamp.fromMillis(ms);
}

function timestampFromUserRecord(admin, userRecord, nowMs) {
    const ms = creationTimeMillis(userRecord && userRecord.metadata, nowMs);
    return timestampFromMillis(admin, ms);
}

async function authJoinTimestamp(admin, uid, nowMs) {
    if (!admin || !uid || typeof admin.auth !== 'function') return null;
    try {
        const authApi = admin.auth();
        if (!authApi || typeof authApi.getUser !== 'function') return null;
        const user = await authApi.getUser(uid);
        return timestampFromUserRecord(admin, user, nowMs);
    } catch (e) {
        return null;
    }
}

// Sets patch.created when the existing doc has no usable join field.
// Auth metadata.creationTime is the only source. When that is missing, a
// brand-new doc (or allowNow on the create trigger) may use the server clock.
// An existing doc is never stamped with "now", and a valid join is never replaced.
async function applyMissingJoin(admin, uid, patch, existingSnap, opts) {
    const target = patch || {};
    const exists = !!(existingSnap && existingSnap.exists);
    const data = exists && typeof existingSnap.data === 'function' ? (existingSnap.data() || null) : null;
    if (hasJoin(data)) return target;
    const stamp = await authJoinTimestamp(admin, uid);
    if (stamp) {
        target.created = stamp;
        return target;
    }
    const allowNow = !exists || !!(opts && opts.allowNow);
    if (allowNow && admin && admin.firestore && admin.firestore.FieldValue
        && typeof admin.firestore.FieldValue.serverTimestamp === 'function') {
        target.created = admin.firestore.FieldValue.serverTimestamp();
    }
    return target;
}

function lookupAuthMillis(map, id) {
    if (!map || id == null) return null;
    if (typeof map.get === 'function') return map.get(id);
    return map[id];
}

// rows: [{ id, data }]. authMillisByUid maps uid to creationTime millis.
// Would-stamp rows carry a username and an ISO time, never a uid or email.
function planJoinBackfill(rows, authMillisByUid, nowMs) {
    const now = typeof nowMs === 'number' && isFinite(nowMs) ? nowMs : Date.now();
    let already = 0;
    let skippedNoAuth = 0;
    const wouldStamp = [];
    (rows || []).forEach(function (row) {
        const data = row && row.data ? row.data : {};
        if (hasJoin(data, now)) {
            already += 1;
            return;
        }
        const ms = joinMillis(lookupAuthMillis(authMillisByUid, row && row.id), now);
        if (ms == null) {
            skippedNoAuth += 1;
            return;
        }
        const rawName = data.username ? String(data.username).trim() : '';
        const name = rawName && rawName.indexOf('@') === -1 ? rawName.slice(0, 40) : '';
        wouldStamp.push({ username: name, iso: new Date(ms).toISOString() });
    });
    return { already: already, skippedNoAuth: skippedNoAuth, wouldStamp: wouldStamp };
}

module.exports = {
    JOIN_KEYS: JOIN_KEYS,
    MIN_MS: MIN_MS,
    MAX_FUTURE_MS: MAX_FUTURE_MS,
    joinMillis: joinMillis,
    hasJoin: hasJoin,
    creationTimeMillis: creationTimeMillis,
    timestampFromUserRecord: timestampFromUserRecord,
    authJoinTimestamp: authJoinTimestamp,
    applyMissingJoin: applyMissingJoin,
    planJoinBackfill: planJoinBackfill,
};
