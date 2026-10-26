#!/usr/bin/env node
/**
 * Read-only counts for raid-boss goals. Last 30 days. No writes.
 * Prints a number or "unavailable". Does not print uids, emails, or documents.
 *
 * Spawn computes the goal. This script is the manual check and does not write.
 * Formula raid-goal-v1, in functions/src/raidBossEngine.js:
 *   goal = clamp(round(trailing 30-day count * 1.35), per-boss floor, per-boss ceiling)
 * The static goal on the schedule is the fallback when the count fails.
 * count() is an upper bound: daily caps, text quality, and self-dealing
 * are not applied here. Per-user subcollections print "unavailable".
 *
 * Auth is Application Default Credentials. No key file is read from the repo.
 *
 *   node scripts/raid-boss-activity.js
 */
'use strict';

const path = require('path');

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'bitcoin-education-archive';
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const BOTS = { 'nacho-bot': 1, system: 1, tg_broadcast: 1, deleted: 1, 'badge-gg': 1 };

function loadAdmin() {
    try { return require('firebase-admin'); }
    catch (e) { return require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin')); }
}

function visibleLength(text) {
    return String(text || '').replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '').replace(/\s/g, '').length;
}

async function countOf(label, run) {
    try {
        const n = await run();
        console.log(label + ': ' + n);
    } catch (e) {
        console.log(label + ': unavailable');
    }
}

async function aggregate(query) {
    const snap = await query.count().get();
    return Number(snap.data().count) || 0;
}

async function main() {
    const admin = loadAdmin();
    if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
    const db = admin.firestore();
    const cutoff = admin.firestore.Timestamp.fromDate(new Date(Date.now() - WINDOW_MS));
    console.log('window_days: 30');
    console.log('formula: clamp(round(count * 1.35), floor, ceiling); spawn writes the goal; this script does not');

    await countOf('global_chat_visible', async function () {
        const snap = await db.collection('global_chat').where('ts', '>=', cutoff).select('uid', 'text', 'isNachoAuto').get();
        let n = 0;
        snap.forEach(function (doc) {
            const data = doc.data() || {};
            if (BOTS[data.uid] || data.isNachoAuto === true) return;
            if (visibleLength(data.text) < 8) return;
            n += 1;
        });
        return n;
    });

    await countOf('forum_posts', function () {
        return aggregate(db.collection('forum_posts').where('createdAt', '>=', cutoff));
    });
    await countOf('articles', function () {
        return aggregate(db.collection('articles').where('createdAt', '>=', cutoff));
    });
    await countOf('peer_requests_accepted', function () {
        return aggregate(db.collection('peer_requests').where('status', '==', 'accepted').where('acceptedAt', '>=', cutoff));
    });
    await countOf('cipher_shares_paid', function () {
        return aggregate(db.collection('cipher_shares').where('paid', '==', true).where('createdAt', '>=', cutoff));
    });
    await countOf('favor_hashes', function () {
        return aggregate(db.collection('satoshiFavor').doc('current').collection('hashes').where('timestamp', '>=', cutoff));
    });
    await countOf('scholar_passes', function () {
        return aggregate(db.collection('scholar_exam_keys').where('passed', '==', true).where('gradedAt', '>=', cutoff));
    });
    await countOf('referrals_paid', function () {
        return aggregate(db.collection('referrals').where('paidAt', '>=', cutoff));
    });

    console.log('say_hi: unavailable (per-user subcollection, not scanned)');
    console.log('trivia_correct: unavailable (per-user subcollection, not scanned)');
    console.log('quiz_passes: unavailable (per-user subcollection, not scanned)');
    console.log('poll_votes: unavailable (per-user subcollection, not scanned)');
    console.log('tctv_watch_days: unavailable (per-user subcollection, not scanned)');
    console.log('trifecta: unavailable (per-user subcollection, not scanned)');
}

main().catch(function () {
    console.error('Auth or read unavailable. No data was written.');
    process.exit(1);
});
