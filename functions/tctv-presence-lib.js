// Shared checks for the Timechain TV live viewer counter.
// The scheduled function and the one-off cleanup script both use this.
// No Firebase import: safe to load in unit tests.

// Client heartbeat is 30s. The aggregator runs once a minute, so a 90s
// window keeps a viewer who missed two heartbeats and still covers scheduler jitter.
const FRESH_MS = 90 * 1000;

// Presence docs older than this are deleted in small batches. Matches the
// expiresAt the client writes (now + 10 min) so TTL and the job agree.
const STALE_MS = 10 * 60 * 1000;

// Upper bound on the fresh query so a doc with a far-future ts is not read
// every minute. Server timestamps land on request.time; a few minutes of skew is enough.
const FUTURE_SKEW_MS = 5 * 60 * 1000;

// Firestore batches cap at 500. Stay well under that so one minute of the
// job cannot turn into a large read or a large delete.
const STALE_DELETE_LIMIT = 100;

function timestampMillis(value) {
    if (value == null) return null;
    if (typeof value.toMillis === 'function') {
        const ms = value.toMillis();
        return typeof ms === 'number' && Number.isFinite(ms) ? ms : null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'object' && typeof value._seconds === 'number') {
        const nanos = typeof value._nanoseconds === 'number' ? value._nanoseconds : 0;
        return value._seconds * 1000 + Math.floor(nanos / 1e6);
    }
    return null;
}

// null means "keep and, if inside the fresh window, count".
// Anything else is a reason the one-off cleanup may delete the doc.
function presenceDeleteReason(data, now) {
    const doc = data || {};
    const ms = timestampMillis(doc.ts);
    const clock = ms != null ? ms : (typeof doc.tsClient === 'number' && Number.isFinite(doc.tsClient) ? doc.tsClient : null);
    if (clock == null) return 'missing-ts';
    if (clock > now + FUTURE_SKEW_MS) return 'future';
    if (now - clock > STALE_MS) return 'stale';
    return null;
}

// Count only docs whose server timestamp is inside the fresh window.
// tsClient alone is not enough: the query and the rules both key off ts.
function isFreshPresence(data, now) {
    const ms = timestampMillis(data && data.ts);
    if (ms == null) return false;
    if (ms > now + FUTURE_SKEW_MS) return false;
    return now - ms <= FRESH_MS && now - ms >= -FUTURE_SKEW_MS;
}

function accumulatePresence(counts, data, now) {
    if (!isFreshPresence(data, now)) return counts;
    const station = data && data.station;
    if (typeof station !== 'string') return counts;
    if (station.length < 1 || station.length >= 50) return counts;
    counts[station] = (counts[station] || 0) + 1;
    return counts;
}

function stationCountsEqual(prev, next) {
    const a = prev && typeof prev === 'object' ? prev : {};
    const b = next && typeof next === 'object' ? next : {};
    const aKeys = Object.keys(a);
    if (aKeys.length !== Object.keys(b).length) return false;
    for (let i = 0; i < aKeys.length; i++) {
        const key = aKeys[i];
        if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
        if (Number(a[key]) !== Number(b[key])) return false;
    }
    return true;
}

module.exports = {
    FRESH_MS,
    STALE_MS,
    FUTURE_SKEW_MS,
    STALE_DELETE_LIMIT,
    timestampMillis,
    presenceDeleteReason,
    isFreshPresence,
    accumulatePresence,
    stationCountsEqual,
};
