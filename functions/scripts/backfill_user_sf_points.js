'use strict';

// Fill satoshiFavor/userSfPoints/users/{uid}.points from existing contributor
// docs. Dry-run by default. Pass --apply to write. Do not run this from CI.
//
//   node functions/scripts/backfill_user_sf_points.js
//   node functions/scripts/backfill_user_sf_points.js --apply
//
// Writes the absolute sum for each uid, so a second --apply does not add the
// same history twice. New contributions after this script still increment the
// counter inside contributeFavor. Prints counts only, never addresses or names.
//
// Uses Application Default Credentials. Does not take a key path on argv.

const admin = require('firebase-admin');
const { tallyUserSfPoints, contributionPoints } = require('../src/userSfPoints');

const PAGE = 400;

async function pageContributors(db) {
    const rows = [];
    let cursor = null;
    for (;;) {
        let q = db.collection('satoshiFavor').doc('current').collection('contributors')
            .orderBy(admin.firestore.FieldPath.documentId())
            .limit(PAGE);
        if (cursor) q = q.startAfter(cursor);
        const snap = await q.get();
        if (snap.empty) break;
        snap.forEach(function (doc) {
            const data = doc.data() || {};
            rows.push({
                uid: data.uid || '',
                pointsAdded: data.pointsAdded,
                source: data.source,
            });
        });
        cursor = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    return rows;
}

async function main() {
    const apply = process.argv.indexOf('--apply') !== -1;
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const rows = await pageContributors(db);
    const tally = tallyUserSfPoints(rows);
    console.log(JSON.stringify({
        mode: apply ? 'apply' : 'dry-run',
        docs: tally.docs,
        users: tally.users,
        points: tally.points,
    }));
    if (!apply) {
        console.log('dry-run only. Re-run with --apply to write each user\'s all-time total.');
        return;
    }
    const uids = Object.keys(tally.byUid);
    let batch = db.batch();
    let pending = 0;
    let written = 0;
    async function flush() {
        if (!pending) return;
        await batch.commit();
        batch = db.batch();
        pending = 0;
    }
    for (let i = 0; i < uids.length; i++) {
        const uid = uids[i];
        batch.set(db.collection('satoshiFavor').doc('userSfPoints').collection('users').doc(uid), {
            uid: uid,
            points: tally.byUid[uid],
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            backfill: true,
        });
        pending++;
        written++;
        if (pending >= PAGE) await flush();
    }
    await flush();
    console.log(JSON.stringify({ wrote: written }));
}

module.exports = {
    pageContributors: pageContributors,
    contributionPoints: contributionPoints,
};

if (require.main === module) {
    main().then(function () { process.exit(0); }).catch(function (err) {
        console.error('backfill failed');
        process.exit(1);
    });
}
