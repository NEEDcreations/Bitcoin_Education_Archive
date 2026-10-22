#!/usr/bin/env node
/**
 * Recompute prediction_stats/{uid} from existing data.
 *
 * Sources, kept disjoint on purpose:
 *   users['predictions.total'] and users['predictions.correct'] — the legacy
 *                         resolver stored these as literal dotted field names,
 *                         not a nested map. A nested users.predictions map is
 *                         used only when the dotted fields are absent. If both
 *                         shapes exist, the larger total wins and the choice is
 *                         recorded. Those numbers seed all-time accuracy only.
 *                         The new resolver does not touch them, so they are added
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

const LEGACY_KEYS = ['total', 'correct', 'streak', 'bestStreak', 'lastResolved'];

function pickLegacyFields(source, dotted) {
    if (!source || typeof source !== 'object') return null;
    const out = {};
    let present = false;
    LEGACY_KEYS.forEach(function(key) {
        const raw = dotted ? source['predictions.' + key] : source[key];
        if (raw !== undefined && raw !== null && raw !== '') {
            out[key] = raw;
            present = true;
        }
    });
    return present ? out : null;
}

function totalOf(shape) {
    if (!shape || shape.total == null || shape.total === '') return null;
    const n = Number(shape.total);
    return isFinite(n) ? n : null;
}

// Dotted keys are the live legacy shape. The nested map is the fallback.
// When both are present, the larger total is kept and shape records which one.
function legacyFromUser(data) {
    data = data || {};
    const dotted = pickLegacyFields(data, true);
    const nestedSource = data.predictions && typeof data.predictions === 'object' && !Array.isArray(data.predictions)
        ? data.predictions : null;
    const nested = nestedSource ? pickLegacyFields(nestedSource, false) : null;
    const dottedTotal = totalOf(dotted);
    const nestedTotal = totalOf(nested);
    let chosen = null;
    let shape = 'none';
    if (dotted && nested) {
        const dottedN = dottedTotal == null ? -1 : dottedTotal;
        const nestedN = nestedTotal == null ? -1 : nestedTotal;
        if (nestedN > dottedN) {
            chosen = nested;
            shape = 'both_shapes_prefer_nested';
        } else {
            chosen = dotted;
            shape = 'both_shapes_prefer_dotted';
        }
    } else if (dotted) {
        chosen = dotted;
        shape = 'dotted';
    } else if (nested) {
        chosen = nested;
        shape = 'nested';
    }
    const total = chosen ? totalOf(chosen) : null;
    const correct = chosen && chosen.correct != null && chosen.correct !== '' ? Number(chosen.correct) : 0;
    return {
        shape: shape,
        legacy: chosen ? { predictions: chosen } : null,
        total: total == null ? 0 : Math.max(0, total),
        correct: isFinite(correct) ? Math.max(0, correct) : 0
    };
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
    const shapeCounts = {};
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

    async function consider(uid, legacy, activeDoc, shape) {
        seen[uid] = true;
        const result = ps.recomputeUser({
            uid: uid,
            now: now,
            legacy: legacy,
            records: recordsByUid[uid] || [],
            active: activeDoc || null
        });
        result.shape = shape || 'none';
        if (shape && shape.indexOf('both_shapes_') === 0) result.gaps.push(shape);
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
                predAccuracy: result.stats.predAccuracy,
                weekTotal: result.stats.weekTotal,
                monthTotal: result.stats.monthTotal,
                shape: result.shape,
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
            const picked = legacyFromUser(data);
            if (picked.shape !== 'none') shapeCounts[picked.shape] = (shapeCounts[picked.shape] || 0) + 1;
            const hasLegacy = picked.total > 0 || picked.correct > 0;
            const hasOther = !!(recordsByUid[doc.id] || activeByUid[doc.id]);
            if (!hasLegacy && !hasOther) {
                skipped++;
                seen[doc.id] = true;
                continue;
            }
            await consider(doc.id, picked.legacy, activeByUid[doc.id] || null, picked.shape);
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
    console.log('legacy field shapes: ' + JSON.stringify(shapeCounts));
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

module.exports = {
    unchanged: unchanged,
    canon: canon,
    parseArgs: parseArgs,
    legacyFromUser: legacyFromUser
};
