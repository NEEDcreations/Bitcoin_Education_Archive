#!/usr/bin/env node
/**
 * Recompute users.referralInvited from the live referrals collection size
 * per referrerUid. The register path used to increment that field only for
 * pending or flagged signups, so late "joined before using your code"
 * docs can leave the stored counter behind the live doc count.
 *
 * Dry-run is the default and prints counts only (no user ids).
 * --apply is blocked on the production project. Do not run this against
 * live from this branch. Applying the writes needs Phil's card.
 *
 *   node functions/scripts/backfill_referral_invited.js
 *   node functions/scripts/backfill_referral_invited.js --apply
 *
 * Credentials are Application Default Credentials. No service-account JSON
 * is read from the repo.
 */
'use strict';

const path = require('path');
const tiers = require('../referral-tiers');
const referrals = require('../src/referrals');

const PRODUCTION_PROJECT = 'bitcoin-education-archive';
const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || PRODUCTION_PROJECT;
const PAGE = 300;

function helpText() {
    return [
        'Usage: node functions/scripts/backfill_referral_invited.js [--apply]',
        '',
        'Dry-run prints referral docs, referrers, and planned writes.',
        '--apply is blocked on the production project and needs Phil\'s card.',
    ].join('\n');
}

function loadAdmin() {
    try {
        return require('../src/firebaseAdmin.js');
    } catch (err) {
        try {
            return require(path.join(__dirname, '..', 'node_modules', 'firebase-admin'));
        } catch (err2) {
            console.error('[referral-invited] firebase-admin is not installed. From the repo root: cd functions && npm install');
            process.exit(1);
        }
    }
}

function keyProjectId() {
    return process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '';
}

async function loadUsers(db, admin) {
    const users = [];
    let last = null;
    for (;;) {
        let q = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
        if (last) q = q.startAfter(last);
        const snap = await q.get();
        if (snap.empty) break;
        snap.docs.forEach(function (doc) {
            const data = doc.data() || {};
            const user = { uid: doc.id };
            if (Object.prototype.hasOwnProperty.call(data, 'referralInvited')) {
                user.referralInvited = data.referralInvited;
            }
            users.push(user);
        });
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    return users;
}

async function loadReferrals(db, admin) {
    const out = [];
    let last = null;
    for (;;) {
        let q = db.collection('referrals').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
        if (last) q = q.startAfter(last);
        const snap = await q.get();
        if (snap.empty) break;
        snap.docs.forEach(function (doc) {
            const data = doc.data() || {};
            out.push({
                id: doc.id,
                referrerUid: data.referrerUid || '',
            });
        });
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    return out;
}

function printSummary(summary, mode) {
    console.log('[referral-invited] mode=' + mode);
    console.log('[referral-invited] referralDocs=' + summary.referralDocs);
    console.log('[referral-invited] referrers=' + summary.referrers);
    console.log('[referral-invited] missingUser=' + summary.missingUser);
    console.log('[referral-invited] writes=' + summary.writes);
}

async function applyWrites(db, writes) {
    let written = 0;
    let skipped = 0;
    for (let i = 0; i < writes.length; i++) {
        const row = writes[i];
        const ref = db.collection('users').doc(row.uid);
        const snap = await ref.get();
        if (!snap.exists) {
            skipped++;
            continue;
        }
        const current = snap.data().referralInvited;
        if (current === row.to) {
            skipped++;
            continue;
        }
        await ref.update({ referralInvited: row.to });
        written++;
    }
    console.log('[referral-invited] written=' + written);
    console.log('[referral-invited] skipped=' + skipped);
}

function applyBlocked(projectId) {
    const id = String(projectId || '');
    if (referrals.blocksProductionApply(id, keyProjectId())) return true;
    if (id === PRODUCTION_PROJECT) return true;
    return false;
}

async function main() {
    const argv = process.argv.slice(2);
    if (argv.indexOf('--help') !== -1 || argv.indexOf('-h') !== -1) {
        console.log(helpText());
        return;
    }
    const apply = argv.indexOf('--apply') !== -1;
    if (apply && applyBlocked(PROJECT_ID)) {
        console.error('[referral-invited] --apply is blocked on the production project. Needs Phil\'s card. Dry-run only.');
        process.exit(1);
    }
    const admin = loadAdmin();
    if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
    const db = admin.firestore();
    const users = await loadUsers(db, admin);
    const referralDocs = await loadReferrals(db, admin);
    const plan = tiers.planInvitedCountWrites({
        users: users,
        referrals: referralDocs,
    });
    printSummary(plan.summary, apply ? 'apply' : 'dry-run');
    if (!apply) {
        console.log('[referral-invited] dry-run only. Applying writes needs Phil\'s card and is blocked on production.');
        return;
    }
    await applyWrites(db, plan.writes);
}

if (require.main === module) {
    main().catch(function (err) {
        console.error('[referral-invited]', err && err.message ? err.message : err);
        process.exit(1);
    });
}

module.exports = {
    printSummary: printSummary,
    applyBlocked: applyBlocked,
};
