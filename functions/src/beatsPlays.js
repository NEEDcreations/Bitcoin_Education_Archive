'use strict';

// Play counts are not a client write. This records one play per listener
// per track, with the 45s gap the player used to enforce, and at most one
// counted play per listener across every track in 25 seconds. Hidden tracks
// are skipped.

const GAP_MS = 45000;
const USER_GAP_MS = 25000;

function cleanId(value) {
    const id = String(value || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128);
    return id;
}

async function recordPlay(db, admin, uid, trackId, nowMs) {
    const id = cleanId(trackId);
    const who = cleanId(uid);
    if (!db || !who || !id) return { counted: false };
    const markRef = db.collection('beats_play_marks').doc(who + '__' + id);
    const userRef = db.collection('beats_play_user').doc(who);
    const trackRef = db.collection('beats_tracks').doc(id);
    const clock = typeof nowMs === 'number' ? nowMs : Date.now();
    let counted = false;
    let reason = '';
    await db.runTransaction(async function (tx) {
        const mark = await tx.get(markRef);
        const userMark = await tx.get(userRef);
        const track = await tx.get(trackRef);
        if (!track.exists) {
            reason = 'missing';
            return;
        }
        const row = track.data() || {};
        if (row.hidden === true) {
            reason = 'hidden';
            return;
        }
        const last = mark.exists ? (Number((mark.data() || {}).at) || 0) : 0;
        const lastUser = userMark.exists ? (Number((userMark.data() || {}).at) || 0) : 0;
        if (clock - last < GAP_MS) {
            reason = 'track';
            return;
        }
        if (clock - lastUser < USER_GAP_MS) {
            reason = 'user';
            return;
        }
        tx.set(markRef, { uid: who, trackId: id, at: clock });
        tx.set(userRef, { uid: who, at: clock });
        tx.set(trackRef, { plays: admin.firestore.FieldValue.increment(1) }, { merge: true });
        counted = true;
    });
    return { counted: counted, reason: counted ? 'counted' : reason };
}

module.exports = {
    GAP_MS: GAP_MS,
    USER_GAP_MS: USER_GAP_MS,
    recordPlay: recordPlay,
};
