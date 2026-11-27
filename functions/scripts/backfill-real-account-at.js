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
 * Default is a READ-ONLY dry run (counts only, uids truncated, no emails).
 * Writing needs BOTH --apply and --confirm=REALACCOUNT, and Phil's OK.
 *
 *   node functions/scripts/backfill-real-account-at.js
 *   node functions/scripts/backfill-real-account-at.js --apply --confirm=REALACCOUNT
 */
'use strict';

const realAccountAge = require('../src/realAccountAge');

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'bitcoin-education-archive';
const PAGE = 1000;

function shortUid(uid) {
    return String(uid || '').slice(0, 6) + '…';
}

function parseArgs(argv) {
    const apply = argv.indexOf('--apply') !== -1;
    const confirm = argv.some(function (a) { return a === '--confirm=REALACCOUNT'; });
    return { apply: apply && confirm, applyRequested: apply, confirm: confirm };
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
    if (args.applyRequested && !args.confirm) {
        console.error('Refusing: --apply also needs --confirm=REALACCOUNT');
        process.exit(2);
    }
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
                await db.collection('users').doc(u.uid).set({ realAccountAt: plan.realAccountAt }, { merge: true });
            }
        }
        pageToken = page.pageToken;
    } while (pageToken);
    console.log(JSON.stringify({ project: PROJECT_ID, apply: args.apply, counts: counts, sample: sample }, null, 2));
}

module.exports = { planFor, hasRealIdentity, parseArgs };

if (require.main === module) {
    main().catch(function (e) { console.error('backfill failed:', e && e.message); process.exit(1); });
}
