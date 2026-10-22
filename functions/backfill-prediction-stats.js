#!/usr/bin/env node
/**
 * Recompute prediction_stats/{uid} from existing data.
 *
 * Sources, kept disjoint on purpose:
 *   users.predictions   — legacy aggregate written by the old resolver. The new
 *                         resolver does not touch it, so these totals are added
 *                         to later prediction_records without double-counting.
 *   prediction_records  — one resolved prediction each (written after this deploy).
 *   active_predictions  — the open prediction, stored as predPending. A prediction
 *                         already past 24h is reported as pending_past_window and
 *                         is NOT scored here (this script does not call a price API).
 *
 * Dry-run is the default. Pass --apply to write. A second --apply skips a user
 * when the stats fields, source, and gaps already match.
 *
 * Auth: Application Default Credentials, or GOOGLE_APPLICATION_CREDENTIALS
 * pointing at a credentials JSON file. No key is embedded in this script.
 *
 *   cd functions && node backfill-prediction-stats.js
 *   cd functions && node backfill-prediction-stats.js --apply
 */
'use strict';

const ps = require('./src/predictionStats');
const { createPredictionJobs } = require('./src/predictionJobs');

let admin = null;
function loadAdmin() {
    admin = require('firebase-admin');
    return admin;
}

const PAGE = 400;

function helpText() {
    return [
        'Usage: node backfill-prediction-stats.js [--apply]',
        '',
        'Recomputes prediction_stats from users.predictions, prediction_records,',
        'and active_predictions. Prints counts, gap codes, a sample, and read cost.',
        'Dry-run is the default. --apply writes absolute stats docs, then refreshes',
        'stats/predictor_leaderboard. A missing composite index is reported and does',
        'not roll back the stats writes.',
        '',
        'Auth: Application Default Credentials, or GOOGLE_APPLICATION_CREDENTIALS.'
    ].join('\n');
}

function parseArgs(argv) {
    return {
        help: argv.indexOf('--help') !== -1 || argv.indexOf('-h') !== -1,
        apply: argv.indexOf('--apply') !== -1
    };
}

function canon(value) {
    if (Array.isArray(value)) return value.map(canon);
    if (value && typeof value === 'object') {
        if (typeof value.toMillis === 'function') return value.toMillis();
        const out = {};
        Object.keys(value).sort().forEach(function(key) {
            out[key] = canon(value[key]);
        });
        return out;
    }
    return value === undefined ? null : value;
}

function unchanged(existing, computed) {
    if (!existing) return false;
    const keys = Object.keys(ps.emptyStats());
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const left = existing[key] === undefined ? null : existing[key];
        const right = computed.stats[key] === undefined ? null : computed.stats[key];
        if (JSON.stringify(canon(left)) !== JSON.stringify(canon(right))) return false;
    }
    if ((existing.source || 'none') !== computed.source) return false;
    if (JSON.stringify(canon(existing.gaps || [])) !== JSON.stringify(canon(computed.gaps || []))) return false;
    return true;
}

async function pageCollection(db, name, onDoc) {
    let last = null;
    let reads = 0;
    let count = 0;
    while (true) {
        let query = db.collection(name).orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
        if (last) query = query.startAfter(last);
        const snap = await query.get();
        reads += snap.size;
        if (snap.empty) break;
        snap.forEach(function(doc) {
            count++;
            onDoc(doc);
        });
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    return { reads: reads, count: count };
}

async function main() {
    const args = parseArgs(process.argv);
    if (args.help) {
        console.log(helpText());
        return;
    }
    loadAdmin();
    if (!admin.apps.length) {
        admin.initializeApp({ credential: admin.credential.applicationDefault() });
    }
    const db = admin.firestore();
    const now = Date.now();
    const recordsByUid = {};
    const activeByUid = {};
    const seen = {};
    const gapCounts = {};
    const sample = [];
    const pendingWrites = [];
    let wouldWrite = 0;
    let unchangedCount = 0;
    let skipped = 0;
    let statsReads = 0;

    const records = await pageCollection(db, 'prediction_records', function(doc) {
        const data = doc.data() || {};
        const uid = data.uid || String(doc.id).split('_')[0];
        if (!uid) return;
        if (!recordsByUid[uid]) recordsByUid[uid] = [];
        recordsByUid[uid].push(data);
    });
    const active = await pageCollection(db, 'active_predictions', function(doc) {
        activeByUid[doc.id] = doc.data() || {};
    });

    function tally(result) {
        (result.gaps || []).forEach(function(gap) {
            gapCounts[gap] = (gapCounts[gap] || 0) + 1;
        });
    }

    async function consider(uid, legacy, activeDoc) {
        seen[uid] = true;
        const result = ps.recomputeUser({
            uid: uid,
            now: now,
            legacy: legacy,
            records: recordsByUid[uid] || [],
            active: activeDoc || null
        });
        tally(result);
        if (result.skip) {
            skipped++;
            return;
        }
        const existingSnap = await db.collection('prediction_stats').doc(uid).get();
        statsReads++;
        const existing = existingSnap.exists ? (existingSnap.data() || {}) : null;
        if (unchanged(existing, result)) {
            unchangedCount++;
            return;
        }
        wouldWrite++;
        if (sample.length < 8) {
            sample.push({
                uid: uid,
                source: result.source,
                gaps: result.gaps,
                predCorrect: result.stats.predCorrect,
                predTotal: result.stats.predTotal,
                weekTotal: result.stats.weekTotal,
                monthTotal: result.stats.monthTotal,
                pending: result.stats.predPending ? result.stats.predPending.direction : null
            });
        }
        if (args.apply) {
            const data = Object.assign({}, result.stats, {
                source: result.source,
                gaps: result.gaps,
                backfilledAt: now
            });
            pendingWrites.push({ ref: db.collection('prediction_stats').doc(uid), data: data });
        }
    }

    let userReads = 0;
    let userCount = 0;
    let lastUser = null;
    while (true) {
        let query = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
        if (lastUser) query = query.startAfter(lastUser);
        const snap = await query.get();
        userReads += snap.size;
        if (snap.empty) break;
        for (let i = 0; i < snap.docs.length; i++) {
            const doc = snap.docs[i];
            userCount++;
            const data = doc.data() || {};
            const predictions = data.predictions || null;
            const legacyTotal = predictions ? (Number(predictions.total) || 0) : 0;
            const legacyCorrect = predictions ? (Number(predictions.correct) || 0) : 0;
            const hasLegacy = legacyTotal > 0 || legacyCorrect > 0;
            const hasOther = !!(recordsByUid[doc.id] || activeByUid[doc.id]);
            if (!hasLegacy && !hasOther) {
                skipped++;
                seen[doc.id] = true;
                continue;
            }
            await consider(doc.id, predictions ? { predictions: predictions } : null, activeByUid[doc.id] || null);
        }
        lastUser = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }

    const extras = {};
    Object.keys(recordsByUid).forEach(function(uid) { if (!seen[uid]) extras[uid] = true; });
    Object.keys(activeByUid).forEach(function(uid) { if (!seen[uid]) extras[uid] = true; });
    const extraIds = Object.keys(extras);
    for (let i = 0; i < extraIds.length; i++) {
        const uid = extraIds[i];
        await consider(uid, null, activeByUid[uid] || null);
    }

    let written = 0;
    if (args.apply) {
        for (let i = 0; i < pendingWrites.length; i += PAGE) {
            const batch = db.batch();
            const slice = pendingWrites.slice(i, i + PAGE);
            slice.forEach(function(row) { batch.set(row.ref, row.data); });
            await batch.commit();
            written += slice.length;
        }
    }

    const reads = records.reads + active.reads + userReads + statsReads;
    console.log('mode: ' + (args.apply ? 'apply' : 'dry-run'));
    console.log('users scanned: ' + userCount);
    console.log('prediction_records: ' + records.count);
    console.log('active_predictions: ' + active.count);
    console.log('reads: ' + reads);
    console.log('would write: ' + wouldWrite);
    console.log('unchanged: ' + unchangedCount);
    console.log('skipped: ' + skipped);
    console.log('writes: ' + (args.apply ? written : 0));
    console.log('gaps: ' + JSON.stringify(gapCounts));
    console.log('sample: ' + JSON.stringify(sample, null, 2));
    if (!records.count) {
        console.log('gap note: no prediction_records yet. Legacy users.predictions totals are seeded, but last prices and week/month history cannot be reconstructed.');
    }

    let leaderboard = 'not requested';
    if (args.apply) {
        try {
            const jobs = createPredictionJobs(db, admin);
            await jobs.refreshLeaderboard(new Date(now));
            leaderboard = 'refreshed';
        } catch (err) {
            leaderboard = 'failed: ' + (err && err.message ? err.message : String(err));
            console.error('leaderboard refresh failed (stats writes were kept): ' + (err && err.message ? err.message : err));
        }
    }
    console.log('leaderboard: ' + leaderboard);
}

if (require.main === module) {
    const args = parseArgs(process.argv);
    if (args.help) {
        console.log(helpText());
    } else {
        main().catch(function(err) {
            console.error(err);
            process.exit(1);
        });
    }
}

module.exports = { unchanged: unchanged, canon: canon, parseArgs: parseArgs };
