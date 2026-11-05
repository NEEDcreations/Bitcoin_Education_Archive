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
    let plays = 0;
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
        plays = (userMark.exists ? (Number((userMark.data() || {}).plays) || 0) : 0) + 1;
        tx.set(userRef, { uid: who, at: clock, plays: plays });
        tx.set(trackRef, { plays: admin.firestore.FieldValue.increment(1) }, { merge: true });
        counted = true;
    });
    return { counted: counted, reason: counted ? 'counted' : reason, plays: counted ? plays : undefined };
}

// Beats listening badges, from the server play count above (Nov 5, 2026).
// The old client localStorage counter was never server proof.
const PLAY_TIERS = [['beats_first_listen', 1], ['beats_50_plays', 50], ['beats_100_plays', 100], ['beats_200_plays', 200], ['beats_500_plays', 500]];

function playBadgesFor(plays) {
    const n = Number(plays) || 0;
    return PLAY_TIERS.filter(function (t) { return n >= t[1]; }).map(function (t) { return t[0]; });
}

// Only on a tier boundary, so a normal play costs no extra reads.
async function grantPlayBadges(db, adminSdk, uid, plays) {
    const hit = PLAY_TIERS.filter(function (t) { return Number(plays) === t[1]; });
    if (!hit.length) return [];
    const { awardBadge } = require('./awardBadge');
    const out = [];
    const ids = playBadgesFor(plays);
    for (let i = 0; i < ids.length; i++) {
        out.push(await awardBadge(db, adminSdk, uid, ids[i], { verified: true, source: 'beats_plays' }));
    }
    return out;
}

module.exports = {
    PLAY_TIERS: PLAY_TIERS,
    playBadgesFor: playBadgesFor,
    grantPlayBadges: grantPlayBadges,
    GAP_MS: GAP_MS,
    USER_GAP_MS: USER_GAP_MS,
    recordPlay: recordPlay,
};
