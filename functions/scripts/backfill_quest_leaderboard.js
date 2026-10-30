'use strict';

// Quest leaderboard backfill v2.
//
// Pre-cutover history (quest_answer_keys created before commit 0730b656,
// 2026-10-23 17:14:38 UTC, plus users.completedQuests) is unioned with
// quest_passes. Only ids in the current or previous quest bank count.
// quest_dynamic_N and any other unknown id are dropped, including a
// failed answer key whose topic or part is not a real quest. Repeat
// passes add nothing. An answer key stores a part only when the doc has
// questIndex (0-based), part, or partNum (1-based). With no part it is
// an attempt only, never a distinct pass. A known part with score under
// 3 is one failed attempt. Server passes and quest_attempts at or after
// the cutover are added on top. Answer keys from the cutover onward are
// ignored so the Oct 22–23 overlap is not counted twice. Week and month
// use dated rows only. The summary includes how many ids were dropped.
//
// Dry-run is the default. Pass --apply to write quest_lb_stats and the
// three public docs. Do not run this from CI or from a deploy.
//
//   node functions/scripts/backfill_quest_leaderboard.js
//   node functions/scripts/backfill_quest_leaderboard.js --apply
//
// Prints summary counts and the top 25 usernames on each board.
// Never prints emails or user ids.
// Uses Application Default Credentials. Does not take a key path on argv.

const board = require('../src/questBoard');

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

function rowsOf(snap) {
    const out = [];
    if (!snap || !snap.forEach) return out;
    snap.forEach(function (doc) { out.push({ id: doc.id, data: doc.data() || {} }); });
    return out;
}

async function loadAnswerKeys(db, documentId) {
    const byUid = Object.create(null);
    let cursor = null;
    for (;;) {
        let q = db.collection('quest_answer_keys').orderBy(documentId).limit(PAGE);
        if (cursor) q = q.startAfter(cursor);
        const snap = await q.get();
        if (snap.empty) break;
        snap.forEach(function (doc) {
            const data = doc.data() || {};
            if (data.graded !== true) return;
            const uid = String(data.uid || '');
            if (!uid) return;
            if (!byUid[uid]) byUid[uid] = [];
            byUid[uid].push({
                graded: true,
                uid: uid,
                topicKey: data.topicKey,
                score: data.score,
                createdAt: data.createdAt
            });
        });
        cursor = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    return byUid;
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
    const keysByUid = await loadAnswerKeys(db, admin.firestore.FieldPath.documentId());
    const seen = Object.create(null);
    let scanned = 0;
    let skippedMissing = 0;
    let oldFails = 0;
    let dropped = 0;
    let distinctPasses = 0;
    let postEvents = 0;
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
            if (!doc.exists) {
                skippedMissing++;
                continue;
            }
            seen[doc.id] = true;
            const user = doc.data() || {};
            const passSnap = await doc.ref.collection('quest_passes').get();
            const attemptSnap = await doc.ref.collection('quest_attempts').get();
            const passes = rowsOf(passSnap).map(function (row) {
                return {
                    questId: row.id,
                    score: row.data.score,
                    at: row.data.at
                };
            });
            const attempts = rowsOf(attemptSnap).map(function (row) {
                return {
                    questId: row.data.questId,
                    score: row.data.score,
                    at: row.data.at
                };
            });
            const built = board.buildLegacyStats({
                completedQuests: user.completedQuests,
                answerKeys: keysByUid[doc.id] || [],
                passes: passes,
                attempts: attempts,
                cutoverMs: board.CUTOVER_MS
            }, now);
            oldFails += built.oldFails;
            dropped += built.dropped;
            distinctPasses += built.distinctPasses;
            postEvents += built.postEvents;
            if (!(built.stats.attempts > 0) && !(built.stats.passes > 0)) continue;
            wouldWrite++;
            const stats = built.stats;
            delete stats.estimatedRate;
            entries.push({
                stats: stats,
                username: user.username,
                profilePic: user.profilePic,
                ghostMode: user.ghostMode === true
            });
            if (!args.apply) continue;
            await db.collection('quest_lb_stats').doc(doc.id).set(stats);
            written++;
        }
        cursor = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    Object.keys(keysByUid).forEach(function (uid) {
        if (seen[uid]) return;
        skippedMissing++;
    });
    const boards = board.buildBoards(entries, now);
    let publicDocs = 'not-written';
    if (args.apply) {
        const week = board.weekKey(now);
        const month = board.monthKey(now);
        await db.collection('stats').doc(board.DOC.alltime).set(board.packPeriod('alltime', boards.alltime, now, {}));
        await db.collection('stats').doc(board.DOC.week).set(board.packPeriod('week', boards.week, now, { weekKey: week }));
        await db.collection('stats').doc(board.DOC.month).set(board.packPeriod('month', boards.month, now, { monthKey: month }));
        publicDocs = 'written';
    }
    console.log(JSON.stringify({
        mode: args.apply ? 'apply' : 'dry-run',
        scanned: scanned,
        skippedMissing: skippedMissing,
        oldFails: oldFails,
        dropped: dropped,
        distinctPasses: distinctPasses,
        postEvents: postEvents,
        wouldWrite: wouldWrite,
        written: written,
        alltime: boards.alltime.length,
        week: boards.week.length,
        month: boards.month.length,
        publicDocs: publicDocs
    }));
    console.log('All time');
    board.boardLines(boards.alltime).forEach(function (line) { console.log(line); });
    console.log('This week');
    board.boardLines(boards.week).forEach(function (line) { console.log(line); });
    console.log('This month');
    board.boardLines(boards.month).forEach(function (line) { console.log(line); });
    if (!args.apply) console.log('dry-run only. Re-run with --apply to write the quest leaderboard.');
}

if (require.main === module) {
    main().catch(function (err) {
        console.error(safeError(err));
        process.exit(1);
    });
}

module.exports = { parseArgs: parseArgs, rowsOf: rowsOf };
