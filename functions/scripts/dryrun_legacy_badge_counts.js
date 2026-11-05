'use strict';
/**
 * Read-only live scan for the legacy-badge hotfix (#118 rebuild).
 * Counts hidden-only profile badges and unbacked source:legacy award rows.
 * Refuses --apply. Prints truncated uids only. Writes nothing.
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=... node functions/scripts/dryrun_legacy_badge_counts.js
 *   # or FIREBASE_SA_JSON in env (JSON string); this script loads it to a temp file.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

if (process.argv.indexOf('--apply') !== -1) {
    console.error('Refusing --apply. This script is read-only.');
    process.exit(2);
}

const admin = require('firebase-admin');
const badgeRules = require('../src/badgeRules');
const badgeXp = require('../src/badgeXpTable');
const {
    serverHoldsBadge,
    hiddenOnlyBadge,
    profileBadgeIds,
    progressAwardIds,
    awardCountsForBonus,
} = require('../src/badgeProfile');
const { hiddenOnlyGrantPlan } = require('../src/awardBadge');

function truncateUid(uid) {
    const s = String(uid || '');
    return s.length <= 8 ? s : s.slice(0, 8);
}

function loadCreds() {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return null;
    const raw = process.env.FIREBASE_SA_JSON;
    if (!raw) throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SA_JSON');
    const tmp = path.join(os.tmpdir(), 'bq-legacy-dryrun-' + process.pid + '.json');
    fs.writeFileSync(tmp, raw, { mode: 0o600 });
    process.env.GOOGLE_APPLICATION_CREDENTIALS = tmp;
    return tmp;
}

async function main() {
    const tmp = loadCreds();
    try {
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.applicationDefault(),
                projectId: 'bitcoin-education-archive',
            });
        }
        const db = admin.firestore();
        const totals = {
            users: 0,
            withHiddenOnly: 0,
            hiddenOnlyBadgeIds: 0,
            hiddenOnlyDeltaXp: 0,
            hiddenOnlyFavor: 0,
            unbackedLegacyRows: 0,
            usersWithUnbackedLegacy: 0,
            backedLegacyRows: 0,
            progressOnlyLegacy: 0,
        };
        const samples = { hiddenOnly: [], unbacked: [] };
        let last = null;
        for (;;) {
            let q = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(200);
            if (last) q = q.startAfter(last);
            const snap = await q.get();
            if (snap.empty) break;
            for (const doc of snap.docs) {
                totals.users += 1;
                const uid = doc.id;
                const user = doc.data() || {};
                const awardsSnap = await doc.ref.collection('badge_awards').get();
                const rows = [];
                awardsSnap.forEach(function (a) {
                    rows.push({ id: a.id, award: a.data() || {} });
                });
                let userUnbacked = 0;
                let userHidden = 0;
                let userDelta = 0;
                let userFavor = 0;
                const profileIds = profileBadgeIds(user);
                profileIds.forEach(function (id) {
                    if (!hiddenOnlyBadge(user, id)) return;
                    if (rows.some(function (r) { return r.id === id; })) return;
                    userHidden += 1;
                    const rule = badgeRules.ruleFor(id);
                    const catalog = rule ? (Number(rule.xp) || 0) : 0;
                    const plan = hiddenOnlyGrantPlan(id, catalog);
                    userDelta += plan.xp;
                    if (plan.favor) userFavor += 1;
                });
                rows.forEach(function (row) {
                    const award = row.award || {};
                    if (String(award.source || '') !== 'legacy') return;
                    if (awardCountsForBonus(user, row.id, award)) {
                        totals.backedLegacyRows += 1;
                        return;
                    }
                    userUnbacked += 1;
                });
                const progress = progressAwardIds(user, rows, { signedIn: true });
                rows.forEach(function (row) {
                    if (String((row.award || {}).source || '') !== 'legacy') return;
                    if (awardCountsForBonus(user, row.id, row.award)) return;
                    if (progress.has(row.id)) totals.progressOnlyLegacy += 1;
                });
                if (userHidden) {
                    totals.withHiddenOnly += 1;
                    totals.hiddenOnlyBadgeIds += userHidden;
                    totals.hiddenOnlyDeltaXp += userDelta;
                    totals.hiddenOnlyFavor += userFavor;
                    if (samples.hiddenOnly.length < 5) {
                        samples.hiddenOnly.push({
                            uid: truncateUid(uid),
                            badges: userHidden,
                            deltaXp: userDelta,
                            favor: userFavor,
                        });
                    }
                }
                if (userUnbacked) {
                    totals.usersWithUnbackedLegacy += 1;
                    totals.unbackedLegacyRows += userUnbacked;
                    if (samples.unbacked.length < 5) {
                        samples.unbacked.push({ uid: truncateUid(uid), rows: userUnbacked });
                    }
                }
                last = doc;
            }
            if (snap.size < 200) break;
            process.stdout.write('scanned ' + totals.users + ' users\r');
        }
        console.log(JSON.stringify({ ok: true, dryRun: true, totals: totals, samples: samples }, null, 2));
    } finally {
        if (tmp) try { fs.unlinkSync(tmp); } catch (e) {}
    }
}

main().catch(function (err) {
    console.error(err && err.message ? err.message : err);
    process.exit(1);
});
