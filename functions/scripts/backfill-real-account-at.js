#!/usr/bin/env node
/**
 * Claims age-gate hardening (Nov 27 2026): set users.realAccountAt.
 *
 * Run this RIGHT BEFORE the functions deploy that ships the cutoff rule in
 * realAccountAge.js. Every Auth account created before REAL_ACCOUNT_CUTOFF_MS
 * that is not in config/ageGateHeld gets realAccountAt = Auth creationTime
 * (guests, Lightning, Nostr, and email; points and withdrawals do not
 * matter). Held uids stay unset so the 7-day clock starts when they are
 * first stamped (now). Accounts created at or after the cutoff are left
 * alone and keep the live stamp-now behavior.
 *
 * The held list is read from config/ageGateHeld (Admin SDK). If that doc is
 * missing or cannot be read, this script exits without writing (fail-closed).
 *
 * Never lowers anything, never touches XP, sats, tickets or claims.
 * Only writes realAccountAt when the field is missing. Never overwrites.
 *
 * --project=<id> is required (no default project). Default is a READ-ONLY
 * dry run (counts only, including per held group; no uids, no emails).
 * Writing needs BOTH --apply and --confirm=REALACCOUNT, and Phil's OK.
 * Each write re-reads the profile in a transaction and skips it if the
 * plan is no longer 'set'.
 *
 *   node functions/scripts/backfill-real-account-at.js --project=bitcoin-quest-staging
 *   node functions/scripts/backfill-real-account-at.js --project=<id> --apply --confirm=REALACCOUNT
 */
'use strict';

const realAccountAge = require('../src/realAccountAge');
const ageGateHeld = require('../src/ageGateHeld');

const PAGE = 1000;

function parseArgs(argv) {
    const apply = argv.indexOf('--apply') !== -1;
    const confirm = argv.some(function (a) { return a === '--confirm=REALACCOUNT'; });
    let project = '';
    argv.forEach(function (a) {
        const m = /^--project=([a-z0-9-]{4,40})$/.exec(String(a));
        if (m) project = m[1];
    });
    return { apply: apply && confirm, applyRequested: apply, confirm: confirm, project: project };
}

function emptyGroupCounts(held) {
    const out = {};
    if (held && held.groups) {
        Object.keys(held.groups).forEach(function (g) { out[g] = 0; });
    }
    return out;
}

// Inside a transaction: re-read the profile and write only if the plan still
// says 'set' (realAccountAt still missing, still pre-cutoff and not held).
async function applyOne(db, authUser, held) {
    const ref = db.collection('users').doc(authUser.uid);
    return db.runTransaction(async function (t) {
        const snap = await t.get(ref);
        const plan = planFor(authUser, snap.exists ? (snap.data() || {}) : null, held);
        if (plan.action !== 'set') return { written: false, reason: plan.reason };
        t.update(ref, { realAccountAt: plan.realAccountAt });
        return { written: true };
    });
}

// Pure: what to do for one Auth user + users doc (null when missing).
function planFor(authUser, userDoc, held) {
    if (!held || held.ok !== true) return { action: 'skip', reason: 'held_list_unavailable' };
    const created = realAccountAge.createdMsOf(authUser);
    if (!Number.isFinite(created)) return { action: 'skip', reason: 'no_creation_time' };
    if (ageGateHeld.isHeldUid(authUser && authUser.uid, held)) {
        return { action: 'skip', reason: 'held', group: ageGateHeld.groupOf(authUser && authUser.uid, held) || 'held' };
    }
    if (created >= ageGateHeld.cutoffMs()) return { action: 'skip', reason: 'post_cutoff' };
    if (!userDoc) return { action: 'skip', reason: 'no_profile' };
    if (realAccountAge.millisOf(userDoc.realAccountAt) > 0) return { action: 'skip', reason: 'already_set' };
    return { action: 'set', realAccountAt: created };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.project) {
        console.error('Refusing: pass --project=<id> (there is no default project)');
        process.exit(2);
    }
    if (args.applyRequested && !args.confirm) {
        console.error('Refusing: --apply also needs --confirm=REALACCOUNT');
        process.exit(2);
    }
    const PROJECT_ID = args.project;
    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
    const db = admin.firestore();
    ageGateHeld.resetCache();
    const held = await ageGateHeld.loadHeld(db);
    if (!held.ok) {
        console.error('Refusing: config/ageGateHeld is ' + (held.reason || 'unavailable') + ' (fail-closed, no writes)');
        process.exit(2);
    }
    const counts = {};
    const heldCounts = emptyGroupCounts(held);
    let pageToken;
    do {
        const page = await admin.auth().listUsers(PAGE, pageToken);
        for (const u of page.users) {
            const snap = await db.collection('users').doc(u.uid).get();
            const plan = planFor(u, snap.exists ? (snap.data() || {}) : null, held);
            if (plan.reason === 'held') {
                const g = plan.group || 'held';
                heldCounts[g] = (heldCounts[g] || 0) + 1;
            } else {
                const key = plan.action === 'set' ? 'set' : plan.reason;
                counts[key] = (counts[key] || 0) + 1;
            }
            if (plan.action !== 'set') continue;
            if (args.apply) {
                const res = await applyOne(db, u, held);
                if (!res.written) counts['raced_' + res.reason] = (counts['raced_' + res.reason] || 0) + 1;
                else counts.written = (counts.written || 0) + 1;
            }
        }
        pageToken = page.pageToken;
    } while (pageToken);
    counts.held = heldCounts;
    console.log(JSON.stringify({ project: PROJECT_ID, apply: args.apply, counts: counts }, null, 2));
}

module.exports = { planFor, parseArgs, applyOne };

if (require.main === module) {
    main().catch(function (e) { console.error('backfill failed:', e && e.message); process.exit(1); });
}
