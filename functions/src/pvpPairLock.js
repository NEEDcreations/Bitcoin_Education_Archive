'use strict';
// One live PvP match per player pair (M5). A waiting player can delete and
// re-create their lobby doc while their match is still running, so the lobby
// status alone does not prove the pair is free. pvpCreateMatch reads this lock
// inside its transaction and refuses a second match while the pair's latest
// match is still live. Lock docs live in pvp_pair_locks (server-only) and hold
// only the latest matchId and its create time; the doc id is a hash of the pair.
// expireAt (create time + 7 days) is the Firestore TTL field for this
// collection. A lock only matters for 30 minutes (PVP_PAIR_LOCK_MS); TTL needs
// a Timestamp, so createdAtMs alone cannot drive it. The TTL policy itself is
// a console/gcloud change, not code.
const { Timestamp } = require('firebase-admin/firestore');
const pvpFlow = require('./pvpFlow');

const PAIR_LOCK_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

// Transaction reads only. Call before any transaction write.
async function readPairLock(tx, db, uidA, uidB, nowMs) {
    const ref = db.collection('pvp_pair_locks').doc(pvpFlow.pvpPairLockId(uidA, uidB));
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() || {}) : {};
    let liveMatchId = '';
    if (typeof data.matchId === 'string' && data.matchId) {
        const prev = await tx.get(db.collection('pvp_matches').doc(data.matchId));
        if (prev.exists && pvpFlow.pairMatchStillLive(prev.data(), nowMs, data.createdAtMs)) {
            liveMatchId = data.matchId;
        }
    }
    return { ref: ref, liveMatchId: liveMatchId };
}

function pairLockExpireAt(nowMs) {
    return Timestamp.fromMillis(nowMs + PAIR_LOCK_RETENTION_MS);
}

function writePairLock(tx, ref, matchId, nowMs) {
    tx.set(ref, { matchId: matchId, createdAtMs: nowMs, expireAt: pairLockExpireAt(nowMs) });
}

module.exports = {
    PAIR_LOCK_RETENTION_MS: PAIR_LOCK_RETENTION_MS,
    pairLockExpireAt: pairLockExpireAt,
    readPairLock: readPairLock,
    writePairLock: writePairLock,
};
