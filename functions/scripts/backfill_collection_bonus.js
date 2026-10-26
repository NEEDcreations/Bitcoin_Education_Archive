#!/usr/bin/env node
/**
 * Count users who already qualify for a merged collection bonus.
 * Dry-run is the default and prints counts only. It does not print
 * user ids or emails. Banned users are skipped. Remainder XP is the
 * new bonus minus old set bonuses already held, floored at 0. That amount
 * is paid in full. It is not limited by the daily cap and it is not added
 * to that day's capped total.
 *
 * --apply pays that remainder through grantCollectionBonus. That writes
 * xp_ledger with source collection_bonus, does not call applyDailyXp, does
 * not write daily_points, and adds ten Satoshi's Favor points. A remainder
 * of 0 still records the bonus so it cannot be paid later. Chat posts are
 * off, and congratsPending stays false. The badge_awards doc sets ggSkip
 * true so GGs does not post, and records favorPoint. There is no flag that
 * turns chat or GGs on.
 *
 * Held badges are badge_awards plus badges, visibleBadges, and donationBadges.
 * A hiddenBadges id counts only when that same id is already in one of those.
 * earnedHidden, displayBadge, and equippedBadge do not count. xp_ledger ids
 * are not treated as held.
 *
 * Do not pass --apply as part of a deploy. This script has not been run.
 *
 *   node functions/scripts/backfill_collection_bonus.js
 *   node functions/scripts/backfill_collection_bonus.js --apply
 */
'use strict';

const { rewardBlocked } = require('../src/cipherClaim');
const { serverHeldBadgeIds } = require('../src/badgeProfile');
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
        'complete, already, payUsers, remainderXp, zeroRemainder, and favorPoints.',
        'favorPoints is 10 for each bonus this run would record.',
        'remainderXp is paid in full and is not limited by the daily cap.',
        'Chat posts stay off. The award doc sets ggSkip so GGs does not post.',
        'This script never posts Nacho messages.',
        'No user ids or emails are printed.',
    ].join('\n');
}

function favorPointsFor(row) {
    const fresh = (Number(row && row.payUsers) || 0) + (Number(row && row.zeroRemainder) || 0);
    return fresh * 10;
}

function printCounts(counts, apply) {
    const src = counts || { scanned: 0, bannedSkipped: 0, collections: {} };
    let favorPoints = 0;
    console.log('[collection-bonus] scanned ' + src.scanned);
    console.log('[collection-bonus] banned skipped ' + src.bannedSkipped);
    Object.keys(src.collections || {}).forEach(function (id) {
        const row = src.collections[id];
        const favor = favorPointsFor(row);
        favorPoints += favor;
        console.log(
            '[collection-bonus] ' + row.name +
            ' complete ' + row.complete +
            ' already ' + row.already +
            ' payUsers ' + row.payUsers +
            ' remainderXp ' + row.remainderXp +
            ' zeroRemainder ' + row.zeroRemainder +
            ' favorPoints ' + favor
        );
    });
    console.log('[collection-bonus] favorPoints ' + favorPoints + ' at 10 per recorded bonus');
    console.log('[collection-bonus] remainderXp is paid in full and is not limited by the daily cap.');
    console.log('[collection-bonus] chat posts off');
    console.log('[collection-bonus] mode ' + (apply ? 'apply' : 'dry-run'));
    console.log(JSON.stringify({
        scanned: src.scanned,
        bannedSkipped: src.bannedSkipped,
        favorPoints: favorPoints,
        favorPerBonus: 10,
        collections: src.collections,
        mode: apply ? 'apply' : 'dry-run',
    }));
}

async function heldIdsFor(userDoc, user) {
    const awards = await userDoc.ref.collection('badge_awards').get();
    const ids = [];
    awards.forEach(function (doc) { if (doc.id) ids.push(doc.id); });
    return serverHeldBadgeIds(user, ids);
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
                await collectionBonus.grantCollectionBonus(db, admin, userDoc.id, summary.rows[r].id, {
                    postChat: false,
                });
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
    favorPointsFor: favorPointsFor,
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
