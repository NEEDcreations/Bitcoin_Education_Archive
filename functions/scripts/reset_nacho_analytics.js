'use strict';

// Reset poisoned Nacho analytics counters on stats/nacho-analytics.
// Clients could set those numbers directly. This replaces that one document
// with zeros. It does not touch users, votes, or any other collection.
//
// Dry-run is the default. Nothing is written unless --apply is present.
// Do not run this from CI or from a deploy. This file does not call itself.
//
//   node functions/scripts/reset_nacho_analytics.js
//   node functions/scripts/reset_nacho_analytics.js --apply
//
// Prints counts only. It does not print question text, topics, or account ids.
// Uses Application Default Credentials. Does not take a key path on argv.

const { resetPlan, clearedStats } = require('../src/nachoAnalytics');

function parseArgs(argv) {
    return {
        help: argv.indexOf('--help') !== -1 || argv.indexOf('-h') !== -1,
        apply: argv.indexOf('--apply') !== -1,
    };
}

async function runReset(db, fieldValue, args) {
    const ref = db.collection('stats').doc('nacho-analytics');
    const snap = await ref.get();
    if (!snap.exists) {
        return {
            mode: args && args.apply ? 'apply' : 'dry-run',
            exists: false,
            written: false,
            before: resetPlan(null).before,
        };
    }
    const before = resetPlan(snap.data()).before;
    if (!args || !args.apply) {
        return { mode: 'dry-run', exists: true, written: false, before: before };
    }
    await ref.set(clearedStats(fieldValue));
    return { mode: 'apply', exists: true, written: true, before: before };
}

function printResult(result) {
    const before = result.before || {};
    console.log(JSON.stringify({
        mode: result.mode,
        exists: result.exists === true,
        written: result.written === true,
        totalQuestions: before.totalQuestions || 0,
        upvotes: before.upvotes || 0,
        downvotes: before.downvotes || 0,
        missCount: before.missCount || 0,
        topicKeys: before.topicKeys || 0,
        sourceKeys: before.sourceKeys || 0,
        recentMisses: before.recentMisses || 0,
        extraKeys: before.extraKeys || 0,
    }));
    if (result.mode !== 'apply') {
        console.log('dry-run only. Re-run with --apply to zero stats/nacho-analytics.');
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log('Usage: node functions/scripts/reset_nacho_analytics.js [--apply]');
        console.log('Dry-run is the default. --apply zeros stats/nacho-analytics.');
        return;
    }
    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp();
    const result = await runReset(admin.firestore(), admin.firestore.FieldValue, args);
    printResult(result);
}

if (require.main === module) {
    main().catch(function (err) {
        console.error(err && err.message ? err.message : err);
        process.exit(1);
    });
}

module.exports = {
    parseArgs: parseArgs,
    runReset: runReset,
};
