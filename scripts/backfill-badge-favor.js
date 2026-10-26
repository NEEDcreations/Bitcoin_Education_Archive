#!/usr/bin/env node
/**
 * Write missing Satoshi's Favor contributor docs for badges a profile already holds.
 *
 * Dedupes the permanent id key, the permanent name key, and the legacy
 * date-keyed contributor docs:
 *   {uid}_badge_{badgeId}
 *   {uid}_badge_{sanitized badge name}
 *   {uid}_{YYYY-MM-DD}_badge_{sanitized id or name}
 *
 * Each new doc has pointsAdded 1, source backfill, and the user's current
 * faction (or null when they have none). factionTotals for that faction, or
 * factionTotals.unaffiliated, increases by the number of docs written so a
 * later faction choice can move them. This never changes the live pool
 * points or the Favor window.
 *
 * Credit only catalog ids that come from badge_awards or from badges,
 * visibleBadges, or donationBadges. A hiddenBadges id counts only when that
 * same id also appears in one of those sources. On live, clients could still
 * write hiddenBadges, so an id that appears only there is excluded as
 * hidden-only. Ids that appear only on earnedHidden, displayBadge, or
 * equippedBadge are excluded, and so are ids that are not in the catalog.
 * Dry-run prints those excluded counts by reason.
 *
 * Banned users are skipped. Dry-run is the default and prints counts per
 * faction. --apply writes. Do not run it as part of a deploy.
 *
 *   node scripts/backfill-badge-favor.js
 *   node scripts/backfill-badge-favor.js --apply
 */
'use strict';

const { rewardBlocked } = require('../functions/src/cipherClaim');
const badgeRules = require('../functions/src/badgeRules');
const { collectIds, canonicalBadgeId, awardCountsForBonus } = require('../functions/src/badgeProfile');

const SERVER_LIST_FIELDS = ['badges', 'visibleBadges', 'donationBadges'];
const HIDDEN_LIST_FIELDS = ['hiddenBadges'];
const CLIENT_LIST_FIELDS = ['earnedHidden'];
const CLIENT_SINGLE_FIELDS = ['displayBadge', 'equippedBadge'];

const PAGE = 200;

function helpText() {
    return [
        'Usage: node scripts/backfill-badge-favor.js [--apply]',
        '',
        'Dry-run prints counts per faction and writes nothing. --apply writes',
        'contributor docs and increments faction totals. The live pool is not touched.',
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

function escapeReg(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function badgeName(badgeId) {
    const rule = badgeRules.ruleFor(badgeId);
    if (rule && rule.name) return rule.name;
    const row = badgeRules.catalog && badgeRules.catalog.badges
        ? badgeRules.catalog.badges[badgeId]
        : null;
    if (row && row.name) return row.name;
    return '';
}

function factionOf(user) {
    const faction = user && user.faction;
    if (faction === 'cyber_hornets' || faction === 'honey_badgers') return faction;
    return null;
}

function factionBucket(faction) {
    return faction === 'cyber_hornets' || faction === 'honey_badgers' ? faction : 'unaffiliated';
}

function creditsBadge(docId, uid, badgeId, name) {
    const idToken = keyPart(badgeId);
    const nameToken = keyPart(name);
    if (!uid || !idToken || !docId) return false;
    if (docId === uid + '_badge_' + idToken) return true;
    if (nameToken && docId === uid + '_badge_' + nameToken) return true;
    const tokens = nameToken && nameToken !== idToken ? (idToken + '|' + nameToken) : idToken;
    const re = new RegExp('^' + escapeReg(uid) + '_\\d{4}-\\d{2}-\\d{2}_badge_(' + tokens + ')$');
    return re.test(docId);
}

function classifyHeld(input) {
    const src = input || {};
    const user = src.user || {};
    const server = new Set();
    const hidden = new Set();
    const client = new Set();
    const awards = new Set();
    const excluded = { 'client-writable-field': 0, 'not-in-catalog': 0, 'hidden-only': 0, 'unbacked-legacy': 0 };
    collectIds(user, SERVER_LIST_FIELDS, []).forEach(function (id) {
        const clean = canonicalBadgeId(id);
        if (clean) server.add(clean);
    });
    collectIds(user, HIDDEN_LIST_FIELDS, []).forEach(function (id) {
        const clean = keyPart(id);
        if (clean) hidden.add(clean);
    });
    collectIds(user, CLIENT_LIST_FIELDS, CLIENT_SINGLE_FIELDS).forEach(function (id) {
        const clean = keyPart(id);
        if (clean) client.add(clean);
    });
    (src.awardIds || []).forEach(function (id) {
        const clean = canonicalBadgeId(id);
        if (!clean) return;
        if (src.awardById) {
            const award = src.awardById[clean] || src.awardById[id] || null;
            if (!award || !awardCountsForBonus(user, clean, award)) {
                if (award && award.source === 'legacy') excluded['unbacked-legacy'] += 1;
                return;
            }
        }
        awards.add(clean);
    });
    const credit = [];
    const seen = {};
    function consider(id) {
        if (!id || seen[id]) return;
        seen[id] = true;
        const trusted = server.has(id) || awards.has(id);
        const known = badgeRules.isKnown(id);
        if (!trusted && hidden.has(id)) excluded['hidden-only'] += 1;
        if (!trusted && client.has(id)) excluded['client-writable-field'] += 1;
        if (!known) excluded['not-in-catalog'] += 1;
        if (trusted && known) credit.push(id);
    }
    server.forEach(consider);
    awards.forEach(consider);
    hidden.forEach(consider);
    client.forEach(consider);
    return { credit: credit, excluded: excluded };
}

function planUser(input) {
    const src = input || {};
    const uid = String(src.uid || '');
    const held = [];
    const seen = {};
    (src.held || []).forEach(function (id) {
        const badgeId = keyPart(id);
        if (!badgeId || seen[badgeId] || !badgeRules.isKnown(badgeId)) return;
        seen[badgeId] = true;
        held.push(badgeId);
    });
    const faction = factionOf(src.user);
    const ids = src.contributorIds || [];
    const missing = [];
    const skipped = { id: 0, name: 0, date: 0 };
    held.forEach(function (badgeId) {
        const name = (src.names && src.names[badgeId]) || badgeName(badgeId);
        let credited = false;
        for (let i = 0; i < ids.length; i++) {
            if (!creditsBadge(ids[i], uid, badgeId, name)) continue;
            credited = true;
            if (ids[i] === uid + '_badge_' + keyPart(badgeId)) skipped.id += 1;
            else if (ids[i].indexOf('_badge_') > uid.length && ids[i].indexOf(uid + '_') === 0 && !/_\d{4}-\d{2}-\d{2}_badge_/.test(ids[i])) skipped.name += 1;
            else skipped.date += 1;
            break;
        }
        if (credited) return;
        missing.push({
            docId: uid + '_badge_' + badgeId,
            doc: {
                uid: uid,
                source: 'backfill',
                detail: badgeId,
                badgeId: badgeId,
                pointsAdded: 1,
                faction: faction,
                backfill: true,
            },
        });
    });
    const byFaction = { cyber_hornets: 0, honey_badgers: 0, unaffiliated: 0 };
    byFaction[factionBucket(faction)] = missing.length;
    return { missing: missing, skipped: skipped, byFaction: byFaction, faction: faction };
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
        alreadyCredited: 0,
        missing: 0,
        written: 0,
        byFaction: { cyber_hornets: 0, honey_badgers: 0, unaffiliated: 0 },
        excluded: { 'client-writable-field': 0, 'not-in-catalog': 0, 'hidden-only': 0, 'unbacked-legacy': 0 },
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
            const awardById = {};
            awards.docs.forEach(function (award) {
                awardById[award.id] = award.data() || {};
            });
            const classified = classifyHeld({
                user: user,
                awardIds: awards.docs.map(function (award) { return award.id; }),
                awardById: awardById,
            });
            counts.excluded['client-writable-field'] += classified.excluded['client-writable-field'];
            counts.excluded['not-in-catalog'] += classified.excluded['not-in-catalog'];
            counts.excluded['hidden-only'] += classified.excluded['hidden-only'];
            counts.excluded['unbacked-legacy'] += classified.excluded['unbacked-legacy'] || 0;
            const contrib = db.collection('satoshiFavor').doc('current').collection('contributors');
            const existing = await contrib
                .orderBy(admin.firestore.FieldPath.documentId())
                .startAt(userDoc.id + '_')
                .endAt(userDoc.id + '_\uf8ff')
                .get();
            const contributorIds = existing.docs.map(function (doc) { return doc.id; });
            const plan = planUser({
                uid: userDoc.id,
                user: user,
                held: classified.credit,
                contributorIds: contributorIds,
            });
            counts.badgeRecords += classified.credit.length;
            counts.alreadyCredited += (classified.credit.length - plan.missing.length);
            plan.missing.forEach(function (row) {
                counts.missing += 1;
                counts.byFaction[factionBucket(plan.faction)] += 1;
                if (!args.apply) return;
                batch.set(contrib.doc(row.docId), Object.assign({}, row.doc, {
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                }));
                pending += 1;
            });
            if (pending >= 400) await flush();
        }
        cursor = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    await flush();
    if (args.apply) {
        const inc = admin.firestore.FieldValue.increment;
        const totals = {};
        ['cyber_hornets', 'honey_badgers', 'unaffiliated'].forEach(function (bucket) {
            if (counts.byFaction[bucket] > 0) totals[bucket] = inc(counts.byFaction[bucket]);
        });
        if (Object.keys(totals).length) {
            totals.lastUpdated = admin.firestore.FieldValue.serverTimestamp();
            await db.collection('satoshiFavor').doc('factionTotals').set(totals, { merge: true });
        }
    }
    console.log(args.apply ? 'applied' : 'dry-run');
    console.log('cyber_hornets: ' + counts.byFaction.cyber_hornets);
    console.log('honey_badgers: ' + counts.byFaction.honey_badgers);
    console.log('unaffiliated: ' + counts.byFaction.unaffiliated);
    console.log('excluded client-writable-field: ' + counts.excluded['client-writable-field']);
    console.log('excluded not-in-catalog: ' + counts.excluded['not-in-catalog']);
    console.log('excluded hidden-only: ' + counts.excluded['hidden-only']);
    console.log('excluded unbacked-legacy: ' + counts.excluded['unbacked-legacy']);
    console.log(JSON.stringify(counts));
}

if (require.main === module) {
    main().catch(function (err) {
        console.error(err && err.message ? err.message : err);
        process.exit(1);
    });
}

module.exports = {
    keyPart: keyPart,
    creditsBadge: creditsBadge,
    planUser: planUser,
    classifyHeld: classifyHeld,
    factionOf: factionOf,
    factionBucket: factionBucket,
    badgeName: badgeName,
};
