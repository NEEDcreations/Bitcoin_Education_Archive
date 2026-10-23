'use strict';

// Read-only. Prints aggregate counts of badge awards that would fail the new
// server rules. It does not write, revoke, or print user ids.
//
//   node functions/dry-run-badge-criteria.js
//   node functions/dry-run-badge-criteria.js --fixture
//
// A live read needs Application Default Credentials and is still read-only.
// Tracked here because the repo gitignores every scripts/ directory.

const { heldThatFail } = require('./src/badgeDistribution');

function tally(rows) {
    const counts = {};
    rows.forEach(function (row) {
        heldThatFail(row.user, row.awards, row.ctx).forEach(function (id) {
            counts[id] = (counts[id] || 0) + 1;
        });
    });
    return counts;
}

function fixture() {
    return [
        { user: { marketListings: 0, sayHiDays: 0 }, awards: ['market_listed_5', 'say_hi_1', 'night_owl'] },
        { user: { marketListings: 5, chatCount: 100 }, awards: ['market_listed_5', 'chat_100'] },
    ];
}

async function live() {
    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const rows = [];
    let cursor = null;
    while (true) {
        let q = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(200);
        if (cursor) q = q.startAfter(cursor);
        const snap = await q.get();
        if (snap.empty) break;
        for (let i = 0; i < snap.docs.length; i++) {
            const doc = snap.docs[i];
            const awards = await doc.ref.collection('badge_awards').get();
            const ids = [];
            awards.forEach(function (row) {
                const data = row.data() || {};
                ids.push(/^[A-Za-z0-9]{20,}$/.test(row.id) ? (data.badge || data.badgeId || '') : row.id);
            });
            let ctx = null;
            if (ids.indexOf('scholar') !== -1) {
                const exams = await db.collection('scholar_exam_keys').where('uid', '==', doc.id).get();
                ctx = { scholarExamPassed: !!require('./src/scholarExam').passedExam(exams, 'properties', null) };
            }
            rows.push({ user: doc.data() || {}, awards: ids.filter(Boolean), ctx: ctx });
        }
        cursor = snap.docs[snap.docs.length - 1];
        if (snap.size < 200) break;
    }
    return rows;
}

async function main() {
    const useFixture = process.argv.indexOf('--fixture') !== -1;
    let rows;
    if (useFixture) {
        rows = fixture();
        console.log('fixture dry-run (no writes)');
    } else {
        try {
            rows = await live();
            console.log('live dry-run (no writes), users read:', rows.length);
        } catch (err) {
            console.log('No live credentials. Nothing was read or written.');
            console.log('Run with --fixture to see the aggregate shape, or set Application Default Credentials.');
            console.log(err && err.message ? err.message : err);
            process.exit(0);
        }
    }
    const counts = tally(rows);
    const ids = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    if (!ids.length) {
        console.log('No held paying badges fail the new rules in this set.');
        return;
    }
    console.log('badge\tholders_failing_new_rule');
    ids.forEach(function (id) { console.log(id + '\t' + counts[id]); });
}

if (require.main === module) {
    main().catch(function (err) {
        console.error(err && err.message ? err.message : err);
        process.exit(1);
    });
}

module.exports = { tally: tally };
