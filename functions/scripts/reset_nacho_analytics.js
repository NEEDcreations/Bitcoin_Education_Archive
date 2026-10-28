#!/usr/bin/env node
'use strict';

// Dry-run by default. Does not write unless --apply is passed.
// This does not run itself. A production write still needs Phil's OK.
//
//   node functions/scripts/reset_nacho_analytics.js
//   node functions/scripts/reset_nacho_analytics.js --apply
//
// Prints counts only. Does not print question text or other stored strings.
//
// Uses Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS or
// `gcloud auth application-default login`). Does not take a key path on argv.

const { planNachoReset } = require('../src/nachoAnalyticsReset');

function summary(plan) {
    const next = plan.next;
    return {
        removedFields: plan.removedFields.length,
        removedTopicKeys: plan.removedTopicKeys,
        removedSourceKeys: plan.removedSourceKeys,
        totalQuestions: next.totalQuestions,
        upvotes: next.upvotes,
        downvotes: next.downvotes,
        topics: Object.keys(next.topics).length,
        sources: Object.keys(next.sources).length,
    };
}

async function main() {
    const apply = process.argv.indexOf('--apply') !== -1;
    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const ref = db.collection('stats').doc('nacho-analytics');
    const snap = await ref.get();
    if (!snap.exists) {
        console.log(JSON.stringify({ exists: false, apply: apply }));
        return;
    }
    const plan = planNachoReset(snap.data() || {});
    const out = summary(plan);
    out.exists = true;
    out.apply = apply;
    if (apply) {
        const next = Object.assign({}, plan.next, {
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
        await ref.set(next, { merge: false });
        out.wrote = true;
    } else {
        out.wrote = false;
    }
    console.log(JSON.stringify(out));
}

if (require.main === module) {
    main().catch(function (err) {
        console.error(err && err.message ? err.message : err);
        process.exit(1);
    });
}

module.exports = { summary: summary };
