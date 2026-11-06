'use strict';

// Fill the sort keys the exact-rank counts use.
//
// quest_lb_stats: nameKey, passRate, reachedSort, and the week and month
// copies, plus ghostMode from the user doc.
// prediction_stats: ghostMode from the user doc.
// users: nameKey, and streakReachedAt / bestStreakAt set to 0 when missing.
//
// Dry-run is the default. Pass --apply to write. Do not run this from CI.
//
//   node functions/scripts/backfill_leaderboard_sort_keys.js
//   node functions/scripts/backfill_leaderboard_sort_keys.js --apply
//
// Prints counts only. Never prints names, emails, or user ids.
// Uses Application Default Credentials. Does not take a key path on argv.

const questBoard = require('../src/questBoard');

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

function planQuest(stats, user) {
    const src = stats || {};
    const stamped = questBoard.stampSortKeys(Object.assign({}, src), user && user.username);
    const ghost = !!(user && user.ghostMode === true);
    const patch = {};
    if (src.nameKey !== stamped.nameKey) patch.nameKey = stamped.nameKey;
    if (src.ghostMode !== ghost) patch.ghostMode = ghost;
    ['passRate', 'reachedSort', 'weekPassRate', 'weekReachedSort', 'monthPassRate', 'monthReachedSort'].forEach(function (key) {
        if (src[key] !== stamped[key]) patch[key] = stamped[key];
    });
    return Object.keys(patch).length ? patch : null;
}

function planPredict(stats, user) {
    const ghost = !!(user && user.ghostMode === true);
    if ((stats || {}).ghostMode === ghost) return null;
    return { ghostMode: ghost };
}

function planUser(user) {
    const src = user || {};
    const patch = {};
    const nameKey = questBoard.nameKeyOf(src.username);
    if (src.nameKey !== nameKey) patch.nameKey = nameKey;
    if (src.streakReachedAt == null || src.streakReachedAt === '') patch.streakReachedAt = 0;
    if (src.bestStreakAt == null || src.bestStreakAt === '') patch.bestStreakAt = 0;
    return Object.keys(patch).length ? patch : null;
}

function summarize(plans) {
    const src = plans || {};
    return {
        questChecked: src.questChecked || 0,
        questWrites: src.questWrites || 0,
        predictChecked: src.predictChecked || 0,
        predictWrites: src.predictWrites || 0,
        userChecked: src.userChecked || 0,
        userWrites: src.userWrites || 0
    };
}

async function pageDocs(db, coll, documentId, onDoc) {
    let cursor = null;
    let checked = 0;
    for (;;) {
        let q = db.collection(coll).orderBy(documentId).limit(PAGE);
        if (cursor) q = q.startAfter(cursor);
        const snap = await q.get();
        if (!snap || snap.empty) break;
        const docs = snap.docs || [];
        for (let i = 0; i < docs.length; i++) {
            checked++;
            await onDoc(docs[i]);
        }
        cursor = docs[docs.length - 1];
        if (docs.length < PAGE) break;
    }
    return checked;
}

async function commitWrites(db, writes) {
    const batchSize = 400;
    for (let i = 0; i < writes.length; i += batchSize) {
        const slice = writes.slice(i, i + batchSize);
        const batch = db.batch();
        slice.forEach(function (row) { batch.update(row.ref, row.patch); });
        await batch.commit();
    }
}

async function run(db, documentId, apply) {
    const users = {};
    await pageDocs(db, 'users', documentId, async function (doc) {
        users[doc.id] = doc.data() || {};
    });
    const questWrites = [];
    const predictWrites = [];
    const userWrites = [];
    let questChecked = 0;
    let predictChecked = 0;
    const userChecked = Object.keys(users).length;
    Object.keys(users).forEach(function (id) {
        const patch = planUser(users[id]);
        if (patch) userWrites.push({ ref: db.collection('users').doc(id), patch: patch });
    });
    await pageDocs(db, 'quest_lb_stats', documentId, async function (doc) {
        questChecked++;
        const patch = planQuest(doc.data() || {}, users[doc.id] || {});
        if (patch) questWrites.push({ ref: doc.ref, patch: patch });
    });
    await pageDocs(db, 'prediction_stats', documentId, async function (doc) {
        predictChecked++;
        const patch = planPredict(doc.data() || {}, users[doc.id] || {});
        if (patch) predictWrites.push({ ref: doc.ref, patch: patch });
    });
    if (apply) {
        await commitWrites(db, userWrites.concat(questWrites, predictWrites));
    }
    return summarize({
        questChecked: questChecked,
        questWrites: questWrites.length,
        predictChecked: predictChecked,
        predictWrites: predictWrites.length,
        userChecked: userChecked,
        userWrites: userWrites.length
    });
}

function printSummary(summary, apply) {
    const s = summarize(summary);
    console.log('quest checked ' + s.questChecked + ', writes ' + s.questWrites);
    console.log('prediction checked ' + s.predictChecked + ', writes ' + s.predictWrites);
    console.log('users checked ' + s.userChecked + ', writes ' + s.userWrites);
    console.log(apply ? 'applied' : 'dry-run');
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log('Usage: node functions/scripts/backfill_leaderboard_sort_keys.js [--apply]');
        console.log('Dry-run is the default. --apply writes sort keys and ghostMode.');
        return;
    }
    const admin = require('firebase-admin');
    if (!admin.apps || !admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const documentId = admin.firestore.FieldPath.documentId();
    try {
        const summary = await run(db, documentId, args.apply);
        printSummary(summary, args.apply);
    } catch (err) {
        console.error(safeError(err));
        process.exitCode = 1;
    }
}

module.exports = {
    parseArgs: parseArgs,
    planQuest: planQuest,
    planPredict: planPredict,
    planUser: planUser,
    summarize: summarize,
    safeError: safeError,
    run: run
};

if (require.main === module) main();
