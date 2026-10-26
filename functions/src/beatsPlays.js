'use strict';

// Play counts are not a client write. A non-author cannot increment plays
// under the track rules, and those rules stay closed. This records one play
// per listener per track, with the same 45s gap the player used to enforce.

const GAP_MS = 45000;

function cleanId(value) {
    const id = String(value || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128);
    return id;
}

async function recordPlay(db, admin, uid, trackId, nowMs) {
    const id = cleanId(trackId);
    const who = cleanId(uid);
    if (!db || !who || !id) return { counted: false };
    const markRef = db.collection('beats_play_marks').doc(who + '__' + id);
    const trackRef = db.collection('beats_tracks').doc(id);
    const clock = typeof nowMs === 'number' ? nowMs : Date.now();
    let counted = false;
    await db.runTransaction(async function (tx) {
        const mark = await tx.get(markRef);
        const track = await tx.get(trackRef);
        if (!track.exists) return;
        const last = mark.exists ? (Number((mark.data() || {}).at) || 0) : 0;
        if (clock - last < GAP_MS) return;
        tx.set(markRef, { uid: who, trackId: id, at: clock });
        tx.set(trackRef, { plays: admin.firestore.FieldValue.increment(1) }, { merge: true });
        counted = true;
    });
    return { counted: counted };
}

module.exports = {
    GAP_MS: GAP_MS,
    recordPlay: recordPlay,
};
