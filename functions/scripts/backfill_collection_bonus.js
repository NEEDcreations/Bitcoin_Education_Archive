#!/usr/bin/env node
/**
 * Count users who already qualify for a merged collection bonus.
 * Dry-run is the default and prints counts only. It does not print
 * user ids or emails. Banned users are skipped. Remainder XP is the
 * new bonus minus old set bonuses already held, floored at 0, and is
 * printed before the daily cap.
 *
 * --apply pays that remainder through grantCollectionBonus. That writes
 * xp_ledger, counts the XP under the shared daily cap via applyDailyXp
 * (full to 500, half from 500 to 900, a quarter from 900 to 1,000), and
 * adds one Satoshi's Favor point. A remainder of 0 still records the
 * bonus so it cannot be paid later.
 *
 * Do not pass --apply as part of a deploy. This script has not been run.
 *
 *   node functions/scripts/backfill_collection_bonus.js
 *   node functions/scripts/backfill_collection_bonus.js --apply
 */
'use strict';

const { rewardBlocked } = require('../src/cipherClaim');
const { profileBadgeIds } = require('../src/badgeProfile');
const collectionBonus = require('../src/collectionBonus');

const PAGE = 200;

function parseArgs(argv) {
    const args = argv || [];
    return {
        help: args.indexOf('--help') !== -1 || args.indexOf('-h') !== -1,
        apply: args.indexOf('--apply') !== -1,
    };
}

function helpText() {
    return [
        'Usage: node functions/scripts/backfill_collection_bonus.js [--apply]',
        '',
        'Dry-run prints counts only: scanned, banned skips, and per collection',
        'complete, already, payUsers, remainderXp, and zeroRemainder.',
        'remainderXp is before the daily cap. --apply uses applyDailyXp.',
        'No user ids or emails are printed.',
    ].join('\n');
}

function printCounts(counts, apply) {
    const src = counts || { scanned: 0, bannedSkipped: 0, collections: {} };
    console.log('[collection-bonus] scanned ' + src.scanned);
    console.log('[collection-bonus] banned skipped ' + src.bannedSkipped);
    Object.keys(src.collections || {}).forEach(function (id) {
        const row = src.collections[id];
        console.log(
            '[collection-bonus] ' + row.name +
            ' complete ' + row.complete +
            ' already ' + row.already +
            ' payUsers ' + row.payUsers +
            ' remainderXp ' + row.remainderXp +
            ' zeroRemainder ' + row.zeroRemainder
        );
    });
    console.log('[collection-bonus] remainderXp is before the daily cap. --apply uses applyDailyXp.');
    console.log('[collection-bonus] mode ' + (apply ? 'apply' : 'dry-run'));
    console.log(JSON.stringify({
        scanned: src.scanned,
        bannedSkipped: src.bannedSkipped,
        collections: src.collections,
        mode: apply ? 'apply' : 'dry-run',
    }));
}

async function heldIdsFor(userDoc, user) {
    const held = profileBadgeIds(user);
    const awards = await userDoc.ref.collection('badge_awards').get();
    awards.forEach(function (doc) { if (doc.id) held.add(doc.id); });
    const ledger = await userDoc.ref.collection('xp_ledger').get();
    ledger.forEach(function (doc) { if (doc.id) held.add(doc.id); });
    return held;
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
    const counts = collectionBonus.emptyCounts();
    let cursor = null;
    const idField = admin.firestore.FieldPath.documentId();
    while (true) {
        let query = db.collection('users').orderBy(idField).limit(PAGE);
        if (cursor) query = query.startAfter(cursor);
        const snap = await query.get();
        if (snap.empty) break;
        for (let i = 0; i < snap.docs.length; i++) {
            const userDoc = snap.docs[i];
            const user = userDoc.data() || {};
            const ledgerSnap = await db.collection('faucet_ledger').doc(userDoc.id).get();
            const ledger = ledgerSnap.exists ? (ledgerSnap.data() || {}) : {};
            if (rewardBlocked(user, ledger)) {
                collectionBonus.addUser(counts, { banned: true, rows: [] });
                continue;
            }
            const held = await heldIdsFor(userDoc, user);
            const summary = collectionBonus.summarizeUser(user, ledger, held);
            collectionBonus.addUser(counts, summary);
            if (!args.apply) continue;
            for (let r = 0; r < summary.rows.length; r++) {
                const plan = summary.rows[r].plan || {};
                if (!plan.eligible) continue;
                await collectionBonus.grantCollectionBonus(db, admin, userDoc.id, summary.rows[r].id, {});
            }
        }
        cursor = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    printCounts(counts, args.apply);
}

module.exports = {
    parseArgs: parseArgs,
    printCounts: printCounts,
    helpText: helpText,
};

if (require.main === module) {
    main().then(function () {
        process.exit(0);
    }).catch(function (err) {
        console.error(err && err.stack ? err.stack : err);
        process.exit(1);
    });
}
