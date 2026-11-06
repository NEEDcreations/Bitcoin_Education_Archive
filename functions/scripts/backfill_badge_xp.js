#!/usr/bin/env node
/**
 * Top up lifetime XP for badges a profile already holds at the proposed
 * amounts. Dry-run is the default. --apply writes.
 *
 * Unbanned users only (rewardBlocked). Catalog ids only, from badge_awards
 * or badges, visibleBadges, donationBadges. A hiddenBadges id counts only
 * when one of those also lists it. Client-only fields are ignored.
 * Flex is counted from daily_action_counts/{day}_flex_{action} docs, not
 * flexTotals. Pays max(0, newXP - alreadyPaid) and never claws back.
 * alreadyPaid is the award row's xp field when that field is present.
 * A legacy row with xp 0 already paid the old table amount, so only the
 * difference is added. A counter_backfill_legacy row is the same kind of
 * row. A non-legacy xp 0 was earned while the daily cap
 * recorded nothing; that badge is paid in full and listed on its own.
 * Otherwise a missing xp field uses the old XP table.
 *
 * Idempotent via users/{uid}/xp_ledger/{badgeId} tagged badge_xp_backfill.
 * The counter backfill uses that same doc id with source badge_backfill
 * and sets the award's xpSource to badge_backfill. Either one blocks a
 * second payment of that badge.
 * Writes lifetime points only. Weekly and monthly leaderboards are left
 * alone. The daily cap is bypassed on purpose:
 * applyDailyXp(uid, amount, null, { bypass: true }).
 *
 * A top-up that crosses a rank writes the same Satoshi's Favor level-up
 * contributor docs the live path would (Pleb/Stacker 1, Maxi 5, Papa John
 * or higher 10), plus faction totals and userSfPoints. Ranks already
 * credited are skipped. The live pool is not changed.
 *
 * Dry-run is the default. --dry-run is the same mode and wins over --apply.
 * It prints one line per user who would receive XP or level-up Favor
 * (uid truncated to 8 characters) and a grand total. --apply writes.
 * users/{uid}/xp_ledger/{badgeId} tagged badge_xp_backfill is the marker,
 * and a level-up contributor doc is the Favor marker. A second run pays
 * nothing.
 *
 *   node functions/scripts/backfill_badge_xp.js
 *   node functions/scripts/backfill_badge_xp.js --dry-run
 *   node functions/scripts/backfill_badge_xp.js --apply
 */
'use strict';

const { rewardBlocked } = require('../src/cipherClaim');
const { planUserBadges } = require('../src/badgeXpBackfill');
const { applyDailyXp } = require('../src/applyDailyXp');
const { userLine, grandLine, parseMode } = require('../src/backfillDryRun');

const PAGE = 200;

function helpText() {
    return [
        'Usage: node functions/scripts/backfill_badge_xp.js [--dry-run] [--apply]',
        '',
        'Dry-run prints per-user XP and Favor (truncated uids), a grand total,',
        'level-ups, Favor by faction, and capped-at-zero badges. --dry-run',
        'wins over --apply. --apply writes lifetime XP, an xp_ledger marker,',
        'and level-up Favor docs. A second run pays nothing.',
        'It does not change the live Favor pool or the weekly/monthly boards.',
    ].join('\n');
}

function parseArgs(argv) {
    return parseMode(argv);
}

function factionBucket(faction) {
    if (faction === 'cyber_hornets' || faction === 'honey_badgers') return faction;
    return 'unaffiliated';
}

function idsOf(snap) {
    const ids = [];
    if (!snap) return ids;
    if (typeof snap.forEach === 'function') snap.forEach(function (doc) { ids.push(doc.id); });
    else (snap.docs || []).forEach(function (doc) { ids.push(doc.id); });
    return ids;
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
        xp: 0,
        badges: 0,
        levelUps: 0,
        favorPoints: 0,
        markers: 0,
        favorByFaction: { cyber_hornets: 0, honey_badgers: 0, unaffiliated: 0 },
        cappedZeroBadges: 0,
        cappedZeroXp: 0,
        excluded: { 'hidden-only': 0, 'client-writable-field': 0, 'not-in-catalog': 0 },
    };
    const reportLines = [];
    let reportXp = 0;
    let reportFavor = 0;
    let cursor = null;
    let batch = db.batch();
    let pending = 0;

    async function flush() {
        if (!args.apply || pending === 0) return;
        await batch.commit();
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
            const awardById = {};
            const awardIds = [];
            awards.forEach(function (doc) {
                awardIds.push(doc.id);
                awardById[doc.id] = doc.data() || {};
            });
            const claimSnap = await userDoc.ref.collection('daily_action_counts').get();
            const flexClaimIds = idsOf(claimSnap).filter(function (id) {
                return /^\d{4}-\d{2}-\d{2}_flex_[a-z0-9]+$/.test(id);
            });
            const markerSnap = await userDoc.ref.collection('xp_ledger').get();
            const markerIds = idsOf(markerSnap);
            const contrib = db.collection('satoshiFavor').doc('current').collection('contributors');
            const existing = await contrib
                .orderBy(admin.firestore.FieldPath.documentId())
                .startAt(userDoc.id + '_')
                .endAt(userDoc.id + '_\uf8ff')
                .get();
            const levelContributorIds = [];
            existing.docs.forEach(function (doc) {
                const prefix = userDoc.id + '_level_';
                if (doc.id.indexOf(prefix) === 0) levelContributorIds.push(doc.id.slice(prefix.length));
            });
            const plan = planUserBadges({
                user: user,
                ledger: ledger,
                awardIds: awardIds,
                awardById: awardById,
                flexClaimIds: flexClaimIds,
                markerIds: markerIds,
                levelContributorIds: levelContributorIds,
            });
            counts.excluded['hidden-only'] += plan.excluded['hidden-only'] || 0;
            counts.excluded['client-writable-field'] += plan.excluded['client-writable-field'] || 0;
            counts.excluded['not-in-catalog'] += plan.excluded['not-in-catalog'] || 0;
            const paying = [];
            for (let b = 0; b < plan.topUps.length; b++) {
                const row = plan.topUps[b];
                if (row.skip === 'marker') {
                    counts.markers += 1;
                    continue;
                }
                if (!(row.topUp > 0)) continue;
                const grant = await applyDailyXp(userDoc.id, row.topUp, null, { bypass: true });
                if (!grant.bypass || grant.awarded !== row.topUp) {
                    throw new Error('badge XP backfill must bypass the daily cap');
                }
                paying.push(row);
                counts.badges += 1;
                counts.xp += grant.awarded;
                if (row.cappedZero) {
                    counts.cappedZeroBadges += 1;
                    counts.cappedZeroXp += grant.awarded;
                }
            }
            counts.levelUps += plan.levelUps.length;
            counts.favorPoints += plan.favorPoints;
            if (args.dryRun && (plan.xp > 0 || plan.favorPoints > 0)) {
                reportLines.push(userLine(userDoc.id, plan.xp, plan.favorPoints));
                reportXp += plan.xp;
                reportFavor += plan.favorPoints;
            }
            if (plan.favorPoints > 0) {
                counts.favorByFaction[factionBucket(user.faction)] += plan.favorPoints;
            }
            if (!args.apply || (paying.length === 0 && plan.levelUps.length === 0)) continue;
            if (paying.length) {
                const userUpdate = {
                    points: admin.firestore.FieldValue.increment(plan.xp),
                };
                batch.update(userDoc.ref, userUpdate);
                pending += 1;
                paying.forEach(function (row) {
                    batch.set(userDoc.ref.collection('xp_ledger').doc(row.badgeId), {
                        tag: 'badge_xp_backfill',
                        badgeId: row.badgeId,
                        xp: row.topUp,
                        newXp: row.newXp,
                        alreadyPaid: row.alreadyPaid,
                        at: admin.firestore.FieldValue.serverTimestamp(),
                    });
                    pending += 1;
                    if (awardById[row.badgeId]) {
                        batch.set(userDoc.ref.collection('badge_awards').doc(row.badgeId), {
                            xp: row.newXp,
                        }, { merge: true });
                        pending += 1;
                    }
                });
            }
            if (plan.levelUps.length) {
                const faction = user.faction === 'cyber_hornets' || user.faction === 'honey_badgers' ? user.faction : null;
                let favorSum = 0;
                plan.levelUps.forEach(function (rank) {
                    favorSum += rank.points;
                    batch.set(contrib.doc(userDoc.id + '_level_' + rank.name), {
                        uid: userDoc.id,
                        source: rank.source,
                        detail: rank.name,
                        pointsAdded: rank.points,
                        faction: faction,
                        backfill: true,
                        tag: 'badge_xp_backfill',
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    });
                    pending += 1;
                });
                batch.set(db.collection('satoshiFavor').doc('userSfPoints').collection('users').doc(userDoc.id), {
                    uid: userDoc.id,
                    points: admin.firestore.FieldValue.increment(favorSum),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
                pending += 1;
            }
            if (pending >= 400) await flush();
        }
        cursor = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    await flush();
    if (args.apply) {
        const totals = { lastUpdated: admin.firestore.FieldValue.serverTimestamp() };
        let any = false;
        ['cyber_hornets', 'honey_badgers', 'unaffiliated'].forEach(function (bucket) {
            if (counts.favorByFaction[bucket] > 0) {
                totals[bucket] = admin.firestore.FieldValue.increment(counts.favorByFaction[bucket]);
                any = true;
            }
        });
        if (any) await db.collection('satoshiFavor').doc('factionTotals').set(totals, { merge: true });
    }
    if (args.dryRun) {
        reportLines.forEach(function (line) { console.log(line); });
        console.log(grandLine(reportXp, reportFavor));
    }
    console.log(args.apply ? 'applied' : 'dry-run');
    console.log('xp: ' + counts.xp);
    console.log('badges: ' + counts.badges);
    console.log('level-ups: ' + counts.levelUps);
    console.log('favor points: ' + counts.favorPoints);
    console.log('favor cyber_hornets: ' + counts.favorByFaction.cyber_hornets);
    console.log('favor honey_badgers: ' + counts.favorByFaction.honey_badgers);
    console.log('favor unaffiliated: ' + counts.favorByFaction.unaffiliated);
    console.log('capped-at-zero badges: ' + counts.cappedZeroBadges);
    console.log('capped-at-zero xp: ' + counts.cappedZeroXp);
    console.log('banned: ' + counts.banned);
    console.log('excluded hidden-only: ' + counts.excluded['hidden-only']);
    console.log('excluded client-writable-field: ' + counts.excluded['client-writable-field']);
    console.log('excluded not-in-catalog: ' + counts.excluded['not-in-catalog']);
    console.log(JSON.stringify(counts));
}

if (require.main === module) {
    main().catch(function (err) {
        console.error(err && err.message ? err.message : err);
        process.exit(1);
    });
}

module.exports = {
    factionBucket: factionBucket,
    main: main,
};
