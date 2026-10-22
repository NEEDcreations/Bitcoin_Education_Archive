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

// Channels the TV page can tune. A presence note or a tune doc for any other
// string is ignored, so a client cannot mint extra views by inventing ids.
const TCTV_STATIONS = [
    'pleb-underground',
    'ai-nostr',
    'art-philosophy',
    'orange-pill',
    'conferences-events',
    'culture-travel',
    'dev-privacy-nodes',
    'economics-money',
    'freedom-sovereignty',
    'health-fitness',
    'history',
    'kids-family',
    'lightning',
    'memes-comedy',
    'mining',
    'music',
    'news',
    'podcasts-debates',
    'politics-regulation',
    'saylor',
    'future-predictions',
    'tutorials',
];

function isTctvStation(station) {
    return typeof station === 'string' && TCTV_STATIONS.indexOf(station) !== -1;
}

function accumulatePresence(counts, data, now) {
    if (!isFreshPresence(data, now)) return counts;
    const station = data && data.station;
    if (!isTctvStation(station)) return counts;
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

// Tune docs are kept long enough for the minute job to fold them after a
// short outage, then deleted. Three days is well past one UTC day.
const VIEW_RETAIN_MS = 3 * 24 * 60 * 60 * 1000;

// First run looks back a few minutes so a tune written as the function
// starts is not missed. After that the cursor only moves forward.
const VIEW_LOOKBACK_MS = 10 * 60 * 1000;

// Firestore transaction cap is 500. Stay under it.
const VIEW_FOLD_LIMIT = 200;

// How long a folded tune doc should live if TTL is turned on for expiresAt.
const VIEW_TTL_MS = 3 * 24 * 60 * 60 * 1000;

function utcDayKey(ms) {
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getUTCFullYear();
    const mo = d.getUTCMonth() + 1;
    const da = d.getUTCDate();
    return String(y) + (mo < 10 ? '0' : '') + mo + (da < 10 ? '0' : '') + da;
}

function viewDocId(dayKey, viewerId, stationId) {
    return dayKey + '_' + viewerId + '_' + stationId;
}

// null means "do not write a tune doc". Block-surf passes surf=true.
// The id is the dedupe key: one doc per viewer, channel, and UTC day.
function tuneToRecord(viewerId, stationId, nowMs, surf) {
    if (surf) return null;
    if (typeof viewerId !== 'string' || viewerId.length < 1 || viewerId.length > 128) return null;
    if (!isTctvStation(stationId)) return null;
    const day = utcDayKey(nowMs);
    if (!day) return null;
    return {
        id: viewDocId(day, viewerId, stationId),
        viewerId: viewerId,
        station: stationId,
        day: day,
    };
}

function validViewDoc(data, id, nowMs) {
    if (!data || typeof data !== 'object') return false;
    if (data.counted === true) return false;
    if (typeof data.viewerId !== 'string' || !isTctvStation(data.station)) return false;
    if (typeof data.day !== 'string' || !/^[0-9]{8}$/.test(data.day)) return false;
    const ts = timestampMillis(data.ts);
    if (ts == null) return false;
    if (utcDayKey(ts) !== data.day) return false;
    if (typeof nowMs === 'number' && ts > nowMs + FUTURE_SKEW_MS) return false;
    if (id !== viewDocId(data.day, data.viewerId, data.station)) return false;
    return true;
}

// Absolute count after adding `add` new tunes. null means "do not write".
// Never replaces a stored total with the live viewer number.
function addedViews(storedCount, add) {
    if (typeof add !== 'number' || !Number.isFinite(add) || add <= 0 || Math.floor(add) !== add) return null;
    if (storedCount == null) return add;
    if (typeof storedCount !== 'number' || !Number.isFinite(storedCount)) return null;
    return storedCount + add;
}

// null means "do not write". A stored peak is only replaced when this run's
// concurrent total is strictly higher. A missing doc is not a stored peak.
function nextPeak(storedPeak, liveTotal) {
    if (typeof liveTotal !== 'number' || !Number.isFinite(liveTotal) || liveTotal < 0 || Math.floor(liveTotal) !== liveTotal) {
        return null;
    }
    if (storedPeak == null) return liveTotal > 0 ? liveTotal : null;
    if (typeof storedPeak !== 'number' || !Number.isFinite(storedPeak)) return null;
    if (liveTotal > storedPeak) return liveTotal;
    return null;
}

// cursorMs null means there is no saved cursor yet.
// newestMs null means the query returned nothing.
// A full batch steps one millisecond back so a sibling with the same
// timestamp is retried; `counted` keeps that from incrementing twice.
function advanceViewCursor(cursorMs, nowMs, newestMs, batchSize, limit) {
    if (newestMs == null) {
        if (cursorMs == null) return nowMs - 30 * 1000;
        return cursorMs;
    }
    const cap = typeof limit === 'number' && limit > 0 ? limit : VIEW_FOLD_LIMIT;
    let next = newestMs;
    if (batchSize >= cap) {
        const back = newestMs - 1;
        next = cursorMs == null || back > cursorMs ? back : newestMs;
    }
    if (cursorMs != null && next < cursorMs) return cursorMs;
    return next;
}

module.exports = {
    FRESH_MS,
    STALE_MS,
    FUTURE_SKEW_MS,
    STALE_DELETE_LIMIT,
    TCTV_STATIONS,
    VIEW_RETAIN_MS,
    VIEW_LOOKBACK_MS,
    VIEW_FOLD_LIMIT,
    VIEW_TTL_MS,
    timestampMillis,
    presenceDeleteReason,
    isFreshPresence,
    isTctvStation,
    accumulatePresence,
    stationCountsEqual,
    utcDayKey,
    viewDocId,
    tuneToRecord,
    validViewDoc,
    addedViews,
    nextPeak,
    advanceViewCursor,
};
