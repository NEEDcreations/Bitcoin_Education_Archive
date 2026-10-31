#!/usr/bin/env node
'use strict';

// Seed the six public leaderboard snapshots.
//
// Dry-run is the default. It reads the top source pages and prints the top 25
// usernames for each board. --apply writes stats/lb_xp_alltime, lb_xp_week,
// lb_xp_month, lb_pvp, lb_favor_hashers, and lb_raid_alltime, and stamps
// stats/lb_dirty so the next scheduled run skips until a profile changes.
//
//   node scripts/backfill-leaderboard-snapshots.js
//   node scripts/backfill-leaderboard-snapshots.js --apply
//
// Prints usernames and counts only. Never prints emails or user ids.
// Uses Application Default Credentials. Does not take a key path on argv.
// Do not run this from CI or from a deploy.

const path = require('path');
const boards = require('../functions/src/boardSnapshots');

function parseArgs(argv) {
    return {
        help: argv.indexOf('--help') !== -1 || argv.indexOf('-h') !== -1,
        apply: argv.indexOf('--apply') !== -1
    };
}

function safeError(err) {
    return String(err && err.message ? err.message : err)
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted]');
}

function line(result, doc) {
    const rows = (doc && doc.rows) || [];
    const names = rows.map(function (row) { return row.username; });
    return {
        docId: result.docId,
        rows: rows.length,
        skipped: !!result.skipped,
        reason: result.reason,
        names: names
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log('Usage: node scripts/backfill-leaderboard-snapshots.js [--apply]');
        console.log('Dry-run is the default. --apply writes the six snapshot docs.');
        return;
    }
    const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const now = Date.now();
    const keys = boards.BOARD_KEYS.slice();
    if (!args.apply) {
        let favorActive = false;
        try {
            const favor = await db.collection('satoshiFavor').doc('current').get();
            favorActive = !!(favor.exists && favor.data() && favor.data().favorActive === true);
        } catch (err) {
            console.log('favor state unreadable: ' + safeError(err));
        }
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const doc = await boards.loadBoard(db, key, now, favorActive);
            const summary = line({ docId: boards.BOARDS[key].docId, skipped: false, reason: 'dry-run' }, doc);
            console.log(JSON.stringify(summary));
        }
        console.log('dry-run only. pass --apply to write the snapshots.');
        return;
    }
    const stamp = {};
    keys.forEach(function (key) { stamp[key] = now; });
    await db.collection('stats').doc(boards.DIRTY_DOC).set(stamp, { merge: true });
    const results = await boards.refreshMany(db, keys, now, { force: true });
    results.forEach(function (result) {
        console.log(JSON.stringify(line(result, result.doc)));
    });
    console.log('applied ' + results.length + ' snapshots');
}

main().catch(function (err) {
    console.error(safeError(err));
    process.exit(1);
});
