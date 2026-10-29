'use strict';

// Raise users.bestStreak to max(bestStreak, streak) where the stored streak
// is ahead of the all-time best. Dry-run is the default. Pass --apply to write.
// Does not invent reached-at timestamps. Do not run this from CI or from a deploy.
//
//   node functions/scripts/backfill_best_streak.js
//   node functions/scripts/backfill_best_streak.js --apply
//
// Prints counts only. Never prints names, emails, or user ids.
// Uses Application Default Credentials. Does not take a key path on argv.

const { backfillPatch } = require('../src/streakBoard');

const PAGE = 400;

function parseArgs(argv) {
    return {
        help: argv.indexOf('--help') !== -1 || argv.indexOf('-h') !== -1,
        apply: argv.indexOf('--apply') !== -1
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log('Usage: node functions/scripts/backfill_best_streak.js [--apply]');
        console.log('Dry-run is the default. --apply writes bestStreak = max(bestStreak, streak).');
        return;
    }
    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    let scanned = 0;
    let wouldUpdate = 0;
    let written = 0;
    let cursor = null;
    for (;;) {
        let q = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
        if (cursor) q = q.startAfter(cursor);
        const snap = await q.get();
        if (snap.empty) break;
        let batch = null;
        let pending = 0;
        snap.forEach(function (doc) {
            scanned++;
            const patch = backfillPatch(doc.data() || {});
            if (!patch) return;
            wouldUpdate++;
            if (!args.apply) return;
            const write = { bestStreak: patch.bestStreak };
            if (patch.bestStreakAt === null) write.bestStreakAt = admin.firestore.FieldValue.delete();
            if (!batch) batch = db.batch();
            batch.update(doc.ref, write);
            pending++;
            written++;
        });
        if (batch && pending) await batch.commit();
        cursor = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    console.log(JSON.stringify({
        mode: args.apply ? 'apply' : 'dry-run',
        scanned: scanned,
        wouldUpdate: wouldUpdate,
        written: written
    }));
    if (!args.apply) console.log('dry-run only. Re-run with --apply to write bestStreak.');
}

if (require.main === module) {
    main().catch(function (err) {
        console.error(err && err.message ? err.message : err);
        process.exit(1);
    });
}

module.exports = { parseArgs: parseArgs };
