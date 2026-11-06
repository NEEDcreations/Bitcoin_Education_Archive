#!/usr/bin/env node
/**
 * Grandfather backfill for 5-tier badges (badgeTiers ACTIVE families).
 *
 * For every player, each tier they ALREADY qualify for when this runs is
 * written to the once-per-user award record users/{uid}/badge_awards/{id}
 * with xp 0, tickets 0 and grandfathered: true. awardBadge treats an existing
 * award doc as "already", so those tiers can never pay later. Tiers reached
 * after this run pay normally.
 *
 * Qualifies = the server-side counter (e.g. users.tctvLifetimeSeconds) meets
 * the tier threshold, OR the profile already shows the tier id, OR it shows
 * an older one-off badge for the same milestone (LEGACY_MAP).
 *
 * Default is a READ-ONLY dry run (counts only, uids truncated, no emails).
 * Writing needs BOTH --apply and --confirm=GRANDFATHER, and Phil's OK.
 *
 *   node functions/scripts/backfill_tier_grandfather.js
 *   node functions/scripts/backfill_tier_grandfather.js --apply --confirm=GRANDFATHER
 */
'use strict';

const path = require('path');
const badgeTiers = require('../src/badgeTiers');
const { profileHoldsBadge } = require('../src/badgeProfile');

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'bitcoin-education-archive';
const PAGE = 300;

// Older one-off badges that mark the same milestone as a tier.
const LEGACY_MAP = {
    tctv_watch: { 1: ['tctv_tuned_in'], 2: ['tctv_binge_watcher'], 3: ['tctv_satellite'] },
};

function shortUid(uid) {
    return String(uid || '').slice(0, 6) + '…';
}

function parseArgs(argv) {
    const apply = argv.indexOf('--apply') !== -1;
    const confirm = argv.some(function (a) { return a === '--confirm=GRANDFATHER'; });
    return { apply: apply && confirm, applyRequested: apply, confirm: confirm };
}

// Pure: which tier ids a user doc qualifies for, and why.
function qualifyingTiers(user) {
    const out = [];
    Object.keys(badgeTiers.ACTIVE).forEach(function (family) {
        const prog = badgeTiers.progress(family, user) || { tier: 0 };
        const legacy = LEGACY_MAP[family] || {};
        badgeTiers.familyIds(family).forEach(function (id) {
            const info = badgeTiers.tierInfo(id);
            let reason = null;
            if (prog.tier >= info.n) reason = 'counter';
            else if (profileHoldsBadge(user, id)) reason = 'profile';
            else if ((legacy[info.n] || []).some(function (old) { return profileHoldsBadge(user, old); })) reason = 'legacy_badge';
            if (reason) out.push({ id: id, family: family, n: info.n, reason: reason });
        });
    });
    return out;
}

function grandfatherRecord(adminSdk, id, reason, day) {
    return {
        awardedAt: adminSdk.firestore.FieldValue.serverTimestamp(),
        badge: id,
        xp: 0,
        requestedXp: 0,
        tickets: 0,
        day: day,
        source: 'grandfather',
        grandfathered: true,
        ggSkip: true, // no global-chat GG burst for grandfathered records (badgeGg.skipBadgeGg)
        grandfatherReason: reason,
    };
}

function loadAdmin() {
    try { return require('../src/firebaseAdmin.js'); } catch (e) { return require(path.join(__dirname, '..', 'node_modules', 'firebase-admin')); }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.applyRequested && !args.confirm) {
        console.error('--apply also needs --confirm=GRANDFATHER. Nothing written.');
        process.exit(2);
    }
    const admin = loadAdmin();
    const init = { projectId: PROJECT_ID };
    if (process.env.FIREBASE_SA_JSON) init.credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SA_JSON));
    admin.initializeApp(init);
    const db = admin.firestore();
    const day = require('../src/offsetDay').offsetDateKey(Date.now());

    console.log('mode', args.apply ? 'APPLY' : 'DRY RUN (read-only)', 'project', PROJECT_ID);
    const counts = {};
    badgeTiers.allIds().forEach(function (id) { counts[id] = { qualify: 0, alreadyRecorded: 0, toWrite: 0, counter: 0, profile: 0, legacy_badge: 0 }; });
    const samples = [];
    let users = 0; let written = 0; let last = null;
    for (;;) {
        let q = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
        if (last) q = q.startAfter(last);
        const snap = await q.get();
        if (snap.empty) break;
        for (const doc of snap.docs) {
            users += 1;
            const tiers = qualifyingTiers(doc.data() || {});
            for (const t of tiers) {
                const c = counts[t.id];
                c.qualify += 1; c[t.reason] += 1;
                const ref = doc.ref.collection('badge_awards').doc(t.id);
                const existing = await ref.get();
                if (existing.exists) { c.alreadyRecorded += 1; continue; }
                c.toWrite += 1;
                if (samples.length < 10) samples.push(shortUid(doc.id) + ' ' + t.id + ' (' + t.reason + ')');
                if (args.apply) {
                    // create() fails if a real award landed meanwhile; never overwrite.
                    try { await ref.create(grandfatherRecord(admin, t.id, t.reason, day)); written += 1; } catch (e) { c.toWrite -= 1; c.alreadyRecorded += 1; }
                }
            }
        }
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    console.log('users scanned', users);
    Object.keys(counts).forEach(function (id) {
        const c = counts[id]; const info = badgeTiers.tierInfo(id);
        console.log(id, info.tierName, 'qualify', c.qualify, '(counter', c.counter + ', profile', c.profile + ', legacy', c.legacy_badge + ')', 'already', c.alreadyRecorded, args.apply ? 'written' : 'would write', c.toWrite);
    });
    if (samples.length) console.log('sample:', samples.join('; '));
    console.log(args.apply ? ('written ' + written) : 'No writes made.');
}

module.exports = { qualifyingTiers: qualifyingTiers, grandfatherRecord: grandfatherRecord, parseArgs: parseArgs, shortUid: shortUid, LEGACY_MAP: LEGACY_MAP };

if (require.main === module) {
    main().catch(function (e) { console.error('failed:', e && e.message); process.exit(1); });
}
