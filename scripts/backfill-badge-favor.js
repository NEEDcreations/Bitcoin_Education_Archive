#!/usr/bin/env node
/**
 * Write missing Satoshi's Favor contributor docs for badges already awarded.
 *
 * This does not add pool points and does not move faction totals. A badge that
 * already has either contributor doc is left alone:
 *   satoshiFavor/current/contributors/{uid}_badge_{badgeId}
 *   satoshiFavor/current/contributors/{uid}_badge_{sanitized badge name}
 * The name key is the legacy client detail (6,866 of those records). Writing
 * the id key beside it would double-count that badge.
 *
 * Banned users (ban_reason, banned, satsDisabled, or a faucet-ledger ban)
 * are skipped. Dry-run is the default and prints counts only. --apply writes
 * the missing id-keyed docs with pointsAdded 0.
 *
 * Auth: Application Default Credentials, or GOOGLE_APPLICATION_CREDENTIALS.
 * No key is embedded in this script. Do not run it as part of a deploy.
 *
 *   node scripts/backfill-badge-favor.js
 *   node scripts/backfill-badge-favor.js --apply
 */
'use strict';

const { rewardBlocked } = require('../functions/src/cipherClaim');
const badgeRules = require('../functions/src/badgeRules');

const PAGE = 200;

function helpText() {
    return [
        'Usage: node scripts/backfill-badge-favor.js [--apply]',
        '',
        'Dry-run prints counts only. --apply writes contributor docs for',
        'unbanned users whose badge_awards row has neither an id key nor a',
        'legacy name key. Pool points are not changed.',
    ].join('\n');
}

function parseArgs(argv) {
    return {
        help: argv.indexOf('--help') !== -1 || argv.indexOf('-h') !== -1,
        apply: argv.indexOf('--apply') !== -1,
    };
}

function keyPart(value) {
    return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50);
}

function badgeName(badgeId, data) {
    const rule = badgeRules.ruleFor(badgeId);
    if (rule && rule.name) return rule.name;
    const row = badgeRules.catalog && badgeRules.catalog.badges
        ? badgeRules.catalog.badges[badgeId]
        : null;
    if (row && row.name) return row.name;
    if (data && typeof data.name === 'string') return data.name;
    return '';
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log(helpText());
        return;
    }
    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const counts = {
        users: 0,
        banned: 0,
        badgeRecords: 0,
        alreadyId: 0,
        alreadyName: 0,
        missing: 0,
        written: 0,
    };
    let cursor = null;
    let batch = db.batch();
    let pending = 0;

    async function flush() {
        if (!args.apply || pending === 0) return;
        await batch.commit();
        counts.written += pending;
        batch = db.batch();
        pending = 0;
    }

    while (true) {
        let query = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
        if (cursor) query = query.startAfter(cursor);
        const snap = await query.get();
        if (snap.empty) break;
        for (let i = 0; i < snap.docs.length; i++) {
            const userDoc = snap.docs[i];
            counts.users += 1;
            const user = userDoc.data() || {};
            const ledgerSnap = await db.collection('faucet_ledger').doc(userDoc.id).get();
            const ledger = ledgerSnap.exists ? (ledgerSnap.data() || {}) : {};
            if (rewardBlocked(user, ledger)) {
                counts.banned += 1;
                continue;
            }
            const awards = await userDoc.ref.collection('badge_awards').get();
            const contrib = db.collection('satoshiFavor').doc('current').collection('contributors');
            for (let b = 0; b < awards.docs.length; b++) {
                const award = awards.docs[b];
                const badgeId = keyPart(award.id);
                if (!badgeId) continue;
                counts.badgeRecords += 1;
                const idKey = userDoc.id + '_badge_' + badgeId;
                const nameKey = userDoc.id + '_badge_' + keyPart(badgeName(award.id, award.data() || {}));
                const idSnap = await contrib.doc(idKey).get();
                if (idSnap.exists) {
                    counts.alreadyId += 1;
                    continue;
                }
                if (nameKey !== idKey) {
                    const nameSnap = await contrib.doc(nameKey).get();
                    if (nameSnap.exists) {
                        counts.alreadyName += 1;
                        continue;
                    }
                }
                counts.missing += 1;
                if (args.apply) {
                    batch.set(contrib.doc(idKey), {
                        uid: userDoc.id,
                        source: 'badge_earned',
                        detail: badgeId,
                        badgeId: badgeId,
                        pointsAdded: 0,
                        backfill: true,
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    });
                    pending += 1;
                    if (pending >= 400) await flush();
                }
            }
        }
        cursor = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    await flush();
    console.log(args.apply ? 'applied' : 'dry-run');
    console.log(JSON.stringify(counts));
}

main().catch(function (err) {
    console.error(err && err.message ? err.message : err);
    process.exit(1);
});
