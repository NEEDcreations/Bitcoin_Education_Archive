'use strict';

// Reserve usernames/{lower} for profiles that already have a username.
// Dry-run by default. Pass --apply to write.
// Prints counts and colliding uids only. Never prints names or emails.
//
//   node functions/scripts/backfill_usernames.js
//   node functions/scripts/backfill_usernames.js --apply
//
// Uses Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS or
// `gcloud auth application-default login`). Does not take a key path on argv.

const admin = require('firebase-admin');

const PAGE = 400;

function lowerOf(data) {
    const raw = data && (data.username_lower || data.username);
    if (raw == null) return '';
    return String(raw).trim().toLowerCase();
}

function validDocId(id) {
    if (!id || id === '.' || id === '..') return false;
    if (id.indexOf('/') !== -1) return false;
    if (id.length > 700) return false;
    return true;
}

// rows: [{uid, lower}]
// Returns { unique: Map lower -> uid, collisions: Array<string[]> }
function groupUsernames(rows) {
    const buckets = new Map();
    (rows || []).forEach(function (row) {
        if (!row || !row.uid || !row.lower) return;
        if (!buckets.has(row.lower)) buckets.set(row.lower, new Set());
        buckets.get(row.lower).add(row.uid);
    });
    const unique = new Map();
    const collisions = [];
    buckets.forEach(function (uids, lower) {
        const list = Array.from(uids);
        if (list.length === 1 && validDocId(lower)) unique.set(lower, list[0]);
        else if (list.length > 1) collisions.push(list);
    });
    return { unique: unique, collisions: collisions };
}

async function pageCollection(db, name) {
    const rows = [];
    let cursor = null;
    for (;;) {
        let q = db.collection(name).orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE).select('username', 'username_lower');
        if (cursor) q = q.startAfter(cursor);
        const snap = await q.get();
        if (snap.empty) break;
        snap.forEach(function (doc) {
            const lower = lowerOf(doc.data());
            if (!lower) return;
            rows.push({ uid: doc.id, lower: lower });
        });
        cursor = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    return rows;
}

async function reservationConflicts(db, pairs) {
    const conflicts = [];
    const writable = [];
    for (let i = 0; i < pairs.length; i += 100) {
        const chunk = pairs.slice(i, i + 100);
        const refs = chunk.map(function (pair) { return db.collection('usernames').doc(pair[0]); });
        const snaps = await db.getAll.apply(db, refs);
        snaps.forEach(function (snap, idx) {
            const pair = chunk[idx];
            if (!snap.exists) {
                writable.push(pair);
                return;
            }
            const owner = (snap.data() || {}).uid || '';
            if (owner && owner !== pair[1]) conflicts.push([owner, pair[1]]);
        });
    }
    return { writable: writable, conflicts: conflicts };
}

async function main() {
    const apply = process.argv.indexOf('--apply') !== -1;
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const users = await pageCollection(db, 'users');
    const profiles = await pageCollection(db, 'public_profiles');
    const grouped = groupUsernames(users.concat(profiles));
    const pairs = Array.from(grouped.unique.entries());
    console.log(JSON.stringify({
        mode: apply ? 'apply' : 'dry-run',
        profilesSeen: users.length + profiles.length,
        distinctNames: grouped.unique.size + grouped.collisions.length,
        unique: grouped.unique.size,
        collisionGroups: grouped.collisions.length,
    }));
    grouped.collisions.forEach(function (uids) {
        console.log('collision uids=' + uids.join(','));
    });
    if (!apply) {
        console.log('dry-run only. Re-run with --apply to write reservation docs.');
        return;
    }
    const checked = await reservationConflicts(db, pairs);
    checked.conflicts.forEach(function (uids) {
        console.log('reservation-conflict uids=' + uids.join(','));
    });
    let written = 0;
    let batch = db.batch();
    let pending = 0;
    for (let i = 0; i < checked.writable.length; i++) {
        const pair = checked.writable[i];
        batch.set(db.collection('usernames').doc(pair[0]), {
            uid: pair[1],
            at: admin.firestore.FieldValue.serverTimestamp(),
            backfill: true,
        });
        pending++;
        written++;
        if (pending >= 400) {
            await batch.commit();
            batch = db.batch();
            pending = 0;
        }
    }
    if (pending) await batch.commit();
    const unresolved = grouped.collisions.length + checked.conflicts.length;
    if (unresolved === 0) {
        await db.collection('usernames_meta').doc('backfill').set({
            applied: true,
            at: admin.firestore.FieldValue.serverTimestamp(),
            unique: grouped.unique.size,
        });
        console.log(JSON.stringify({ wrote: written, marker: true }));
    } else {
        console.log(JSON.stringify({ wrote: written, marker: false, unresolved: unresolved }));
    }
}

module.exports = {
    groupUsernames: groupUsernames,
    lowerOf: lowerOf,
    validDocId: validDocId,
};

if (require.main === module) {
    main().then(function () { process.exit(0); }).catch(function (err) {
        console.error('backfill failed');
        process.exit(1);
    });
}
