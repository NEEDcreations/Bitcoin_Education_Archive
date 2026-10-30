'use strict';

// One-time Quest leaderboard seed from users/{uid}/quest_passes.
// Those docs are the server-graded first pass of each quest. Failed attempts
// were not stored, so historical pass rate counts each recorded pass as one
// attempt. Later gradeQuest writes include fails and retakes.
//
// Dry-run is the default. Pass --apply to write quest_lb_stats and the three
// public leaderboard docs. Do not run this from CI or from a deploy.
//
//   node functions/scripts/backfill_quest_leaderboard.js
//   node functions/scripts/backfill_quest_leaderboard.js --apply
//
// Prints counts only. Never prints names, emails, or user ids.
// Uses Application Default Credentials. Does not take a key path on argv.

const board = require('../src/questBoard');
const { passEventFromDoc, mergeForBackfill, sameTotals, buildBoards, packPeriod, weekKey, monthKey, DOC } = board;

const PAGE = 200;

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

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log('Usage: node functions/scripts/backfill_quest_leaderboard.js [--apply]');
        console.log('Dry-run is the default. --apply writes quest stats and the three public docs.');
        return;
    }
    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const now = Date.now();
    let scanned = 0;
    let passDocs = 0;
    let usersWithPasses = 0;
    let wouldWrite = 0;
    let written = 0;
    const entries = [];
    let cursor = null;
    for (;;) {
        let q = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
        if (cursor) q = q.startAfter(cursor);
        const snap = await q.get();
        if (snap.empty) break;
        for (let i = 0; i < snap.docs.length; i++) {
            const doc = snap.docs[i];
            scanned++;
            const passes = await doc.ref.collection('quest_passes').get();
            if (passes.empty) continue;
            usersWithPasses++;
            const events = [];
            passes.forEach(function (pass) {
                passDocs++;
                events.push(passEventFromDoc(pass.id, pass.data() || {}));
            });
            const existingSnap = await db.collection('quest_lb_stats').doc(doc.id).get();
            const existing = existingSnap.exists ? (existingSnap.data() || {}) : null;
            const next = mergeForBackfill(existing, events, now);
            if (existing && sameTotals(existing, next)) {
                entries.push(entryFrom(doc, next));
                continue;
            }
            wouldWrite++;
            entries.push(entryFrom(doc, next));
            if (!args.apply) continue;
            await db.collection('quest_lb_stats').doc(doc.id).set(next);
            written++;
        }
        cursor = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    const built = buildBoards(entries, now);
    let publicDocs = 'not-written';
    if (args.apply) {
        try {
            await board.refresh(db, now, { force: true });
            publicDocs = 'refresh';
        } catch (err) {
            const week = weekKey(now);
            const month = monthKey(now);
            await db.collection('stats').doc(DOC.alltime).set(packPeriod('alltime', built.alltime, now, {}));
            await db.collection('stats').doc(DOC.week).set(packPeriod('week', built.week, now, { weekKey: week }));
            await db.collection('stats').doc(DOC.month).set(packPeriod('month', built.month, now, { monthKey: month }));
            publicDocs = 'pass-scan';
            console.log('leaderboard query unavailable, wrote the pass scan instead');
            console.log(safeError(err));
        }
    }
    console.log(JSON.stringify({
        mode: args.apply ? 'apply' : 'dry-run',
        scanned: scanned,
        passDocs: passDocs,
        usersWithPasses: usersWithPasses,
        wouldWrite: wouldWrite,
        written: written,
        alltime: built.alltime.length,
        week: built.week.length,
        month: built.month.length,
        publicDocs: publicDocs
    }));
    if (!args.apply) console.log('dry-run only. Re-run with --apply to write the quest leaderboard.');
}

function entryFrom(doc, stats) {
    const user = doc.data() || {};
    return {
        stats: stats,
        username: user.username,
        profilePic: user.profilePic,
        ghostMode: user.ghostMode === true
    };
}

if (require.main === module) {
    main().catch(function (err) {
        console.error(safeError(err));
        process.exit(1);
    });
}

module.exports = { parseArgs: parseArgs };
