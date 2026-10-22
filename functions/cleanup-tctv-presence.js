#!/usr/bin/env node
// One-off cleanup for tctv_presence.
//
// The live counter no longer reads this whole collection. Docs are only
// removed on a clean page close, so most of the ~1,141 docs are stale and
// will never age out of a query that filters on ts (missing or non-timestamp
// ts is invisible to that query). This script pages the collection once and
// deletes docs that are missing a usable time, older than 10 minutes, or
// more than 5 minutes in the future. It also deletes leftover per-station
// tctv_counts docs, leaving tctv_counts/live alone.
//
// Dry-run is the default. Nothing is deleted unless --apply is passed.
// Credentials come from Application Default Credentials. No service-account
// JSON is read from the repo and nothing secret is printed.
//
//   gcloud auth application-default login
//   node functions/cleanup-tctv-presence.js
//   node functions/cleanup-tctv-presence.js --apply
//
// TTL backstop (run once, after the new client is writing expiresAt):
//   gcloud firestore fields ttls update expiresAt \
//     --collection-group=tctv_presence \
//     --enable-ttl \
//     --project=bitcoin-education-archive
//
// Firestore TTL can lag up to about a day. The scheduled function also
// deletes timestamped docs older than 10 minutes, 100 per minute.

const path = require('path');
const {
    presenceDeleteReason,
    STALE_MS,
    FUTURE_SKEW_MS,
} = require('./tctv-presence-lib');

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'bitcoin-education-archive';
const PAGE_SIZE = 200;
const MAX_DOCS = 20000;

function loadAdmin() {
    const local = path.join(__dirname, 'node_modules', 'firebase-admin');
    try {
        return require('firebase-admin');
    } catch (err) {
        try {
            return require(local);
        } catch (err2) {
            console.error('[tctv-cleanup] firebase-admin is not installed. From the repo root: cd functions && npm install');
            process.exit(1);
        }
    }
}

async function main() {
    const apply = process.argv.indexOf('--apply') !== -1;
    const admin = loadAdmin();
    if (!admin.apps.length) {
        admin.initializeApp({ projectId: PROJECT_ID });
    }
    const db = admin.firestore();
    const now = Date.now();
    const reasons = { stale: 0, future: 0, 'missing-ts': 0, fresh: 0 };
    let scanned = 0;
    let deleted = 0;
    let last = null;

    console.log('[tctv-cleanup] project=' + PROJECT_ID + ' mode=' + (apply ? 'apply' : 'dry-run'));
    console.log('[tctv-cleanup] delete when ts/tsClient is older than ' + (STALE_MS / 60000) + ' min, more than ' + (FUTURE_SKEW_MS / 60000) + ' min ahead, or missing');

    while (scanned < MAX_DOCS) {
        let query = db.collection('tctv_presence')
            .orderBy(admin.firestore.FieldPath.documentId())
            .limit(PAGE_SIZE);
        if (last) query = query.startAfter(last);
        const snap = await query.get();
        if (snap.empty) break;
        last = snap.docs[snap.docs.length - 1];
        scanned += snap.size;

        const batch = db.batch();
        let pending = 0;
        snap.forEach(doc => {
            const reason = presenceDeleteReason(doc.data(), now);
            if (!reason) {
                reasons.fresh++;
                return;
            }
            reasons[reason] = (reasons[reason] || 0) + 1;
            if (apply) {
                batch.delete(doc.ref);
                pending++;
            }
        });
        if (apply && pending > 0) {
            await batch.commit();
            deleted += pending;
        }
        if (snap.size < PAGE_SIZE) break;
    }

    if (scanned >= MAX_DOCS) {
        console.log('[tctv-cleanup] stopped at ' + MAX_DOCS + ' docs. Re-run to continue.');
    }

    const countsSnap = await db.collection('tctv_counts').limit(50).get();
    const legacyCounts = [];
    countsSnap.forEach(doc => {
        if (doc.id !== 'live') legacyCounts.push(doc.id);
    });
    if (apply && legacyCounts.length) {
        const batch = db.batch();
        legacyCounts.forEach(id => batch.delete(db.collection('tctv_counts').doc(id)));
        await batch.commit();
    }

    console.log('[tctv-cleanup] scanned=' + scanned +
        ' fresh=' + reasons.fresh +
        ' stale=' + reasons.stale +
        ' future=' + reasons.future +
        ' missingTs=' + reasons['missing-ts'] +
        ' deleted=' + (apply ? deleted : 0) +
        ' legacyCountDocs=' + legacyCounts.length +
        (legacyCounts.length ? ' (' + legacyCounts.join(',') + ')' : ''));
    if (!apply) {
        const doomed = reasons.stale + reasons.future + reasons['missing-ts'];
        console.log('[tctv-cleanup] dry-run only. Re-run with --apply to delete ' + doomed + ' presence docs' +
            (legacyCounts.length ? ' and ' + legacyCounts.length + ' old tctv_counts docs' : '') + '.');
    }
}

if (require.main === module) {
    main().then(() => process.exit(0)).catch(err => {
        console.error('[tctv-cleanup] failed:', err && err.message ? err.message : err);
        process.exit(1);
    });
}
