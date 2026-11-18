'use strict';
// One live PvP match per player pair (M5). A waiting player can delete and
// re-create their lobby doc while their match is still running, so the lobby
// status alone does not prove the pair is free. pvpCreateMatch reads this lock
// inside its transaction and refuses a second match while the pair's latest
// match is still live. Lock docs live in pvp_pair_locks (server-only) and hold
// only the latest matchId and its create time; the doc id is a hash of the pair.
const pvpFlow = require('./pvpFlow');

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

function writePairLock(tx, ref, matchId, nowMs) {
    tx.set(ref, { matchId: matchId, createdAtMs: nowMs });
}

module.exports = { readPairLock: readPairLock, writePairLock: writePairLock };
