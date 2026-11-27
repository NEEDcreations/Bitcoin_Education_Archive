#!/usr/bin/env node
/**
 * Claims age-gate hardening (Nov 27 2026): grandfather users.realAccountAt.
 *
 * Run this RIGHT BEFORE the functions deploy that ships realAccountAge.js.
 * It covers existing players whose profile was never synced (no emailHash and
 * no providersHash) but who already have a verified email or a real sign-in
 * provider in Auth. Their realAccountAt is set to Auth creationTime, so the
 * 7-day claim clock is unchanged for them. Already-synced profiles need
 * nothing: the server treats them as creationTime without this field.
 *
 * Never lowers anything, never touches XP, sats, tickets or claims.
 * Only writes realAccountAt when the field is missing.
 *
 * --project=<id> is required (no default project). Default is a READ-ONLY
 * dry run (counts only, uids truncated, no emails). Writing needs BOTH --apply
 * and --confirm=REALACCOUNT, and Phil's OK. Each write re-reads the profile in
 * a transaction and skips it if realAccountAt (or a sync) appeared meanwhile.
 *
 *   node functions/scripts/backfill-real-account-at.js --project=bitcoin-quest-staging
 *   node functions/scripts/backfill-real-account-at.js --project=<id> --apply --confirm=REALACCOUNT
 */
'use strict';

const realAccountAge = require('../src/realAccountAge');

const PAGE = 1000;

function shortUid(uid) {
    return String(uid || '').slice(0, 6) + '…';
}

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

function hasRealIdentity(authUser) {
    const a = authUser || {};
    if (a.email && a.emailVerified === true) return true;
    const rows = Array.isArray(a.providerData) ? a.providerData : [];
    for (let i = 0; i < rows.length; i++) {
        const id = rows[i] && rows[i].providerId;
        if (id && id !== 'anonymous') return true;
    }
    return false;
}

// Inside a transaction: re-read the profile and write only if the plan still
// says 'set' (realAccountAt still missing, profile still unsynced).
async function applyOne(db, authUser) {
    const ref = db.collection('users').doc(authUser.uid);
    return db.runTransaction(async function (t) {
        const snap = await t.get(ref);
        const plan = planFor(authUser, snap.exists ? (snap.data() || {}) : null);
        if (plan.action !== 'set') return { written: false, reason: plan.reason };
        t.update(ref, { realAccountAt: plan.realAccountAt });
        return { written: true };
    });
}

// Pure: what to do for one Auth user + users doc (null when missing).
function planFor(authUser, userDoc) {
    if (!hasRealIdentity(authUser)) return { action: 'skip', reason: 'no_real_identity' };
    if (!userDoc) return { action: 'skip', reason: 'no_profile' };
    if (realAccountAge.millisOf(userDoc.realAccountAt) > 0) return { action: 'skip', reason: 'already_set' };
    if (realAccountAge.legacySynced(userDoc)) return { action: 'skip', reason: 'synced_uses_creation' };
    const created = realAccountAge.createdMsOf(authUser);
    if (!Number.isFinite(created)) return { action: 'skip', reason: 'no_creation_time' };
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
    const counts = {};
    const sample = [];
    let pageToken;
    do {
        const page = await admin.auth().listUsers(PAGE, pageToken);
        for (const u of page.users) {
            const snap = await db.collection('users').doc(u.uid).get();
            const plan = planFor(u, snap.exists ? (snap.data() || {}) : null);
            const key = plan.action === 'set' ? 'set' : plan.reason;
            counts[key] = (counts[key] || 0) + 1;
            if (plan.action !== 'set') continue;
            if (sample.length < 10) sample.push(shortUid(u.uid));
            if (args.apply) {
                const res = await applyOne(db, u);
                if (!res.written) counts['raced_' + res.reason] = (counts['raced_' + res.reason] || 0) + 1;
                else counts.written = (counts.written || 0) + 1;
            }
        }
        pageToken = page.pageToken;
    } while (pageToken);
    console.log(JSON.stringify({ project: PROJECT_ID, apply: args.apply, counts: counts, sample: sample }, null, 2));
}

module.exports = { planFor, hasRealIdentity, parseArgs, applyOne };

if (require.main === module) {
    main().catch(function (e) { console.error('backfill failed:', e && e.message); process.exit(1); });
}
