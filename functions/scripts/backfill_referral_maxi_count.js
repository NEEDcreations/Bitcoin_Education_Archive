#!/usr/bin/env node
/**
 * Recompute users.referralMaxiCount from credited referrals whose referee
 * still holds Maxi rank and is not banned or deleted.
 *
 * Dry-run is the default and prints counts only. --apply writes the field.
 * Run this only after the dry-run counts are reviewed, and only after the
 * rules that block client writes of referralMaxiCount are deployed. Do not
 * point it at production before that. This script has not been run.
 *
 * The count includes a referral only when payIfQualified stamped it paid,
 * verified, and tickets-awarded (dedupe, same-device, and IP HMAC already
 * ran at credit time) and the referee doc still exists, is not banned,
 * sats-disabled, or ledger-banned, and has at least 2,140 points.
 *
 *   gcloud auth application-default login
 *   node functions/scripts/backfill_referral_maxi_count.js
 *   node functions/scripts/backfill_referral_maxi_count.js --apply
 *
 * Credentials are Application Default Credentials. No service-account JSON
 * is read from the repo. Output is counts only: no user id, email, or code.
 */
'use strict';

const path = require('path');
const tiers = require('../../referral-tiers');

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'bitcoin-education-archive';
const PAGE = 300;

function helpText() {
    return [
        'Usage: node functions/scripts/backfill_referral_maxi_count.js [--apply]',
        '',
        'Dry-run prints referral docs, referrers, writes, and tier counts.',
        '--apply writes users.referralMaxiCount where the stored value differs.',
        'Run only after a dry-run is reviewed and the rules deploy is live.',
    ].join('\n');
}

function loadAdmin() {
    try {
        return require('firebase-admin');
    } catch (err) {
        try {
            return require(path.join(__dirname, '..', 'node_modules', 'firebase-admin'));
        } catch (err2) {
            console.error('[referral-maxi] firebase-admin is not installed. From the repo root: cd functions && npm install');
            process.exit(1);
        }
    }
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
            const user = {
                uid: doc.id,
                points: data.points || 0,
                banned: data.banned === true,
                satsDisabled: data.satsDisabled === true,
                deleted: data.deleted === true,
                ledgerBanned: data.ledgerBanned === true,
            };
            if (Object.prototype.hasOwnProperty.call(data, 'referralMaxiCount')) {
                user.referralMaxiCount = data.referralMaxiCount;
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
                status: data.status || '',
                verified: data.verified === true,
                ticketsAwarded: data.ticketsAwarded === true,
                referrerUid: data.referrerUid || '',
                referredUid: data.referredUid || '',
                referredUserUid: data.referredUserUid || '',
                referredUser: data.referredUser || '',
            });
        });
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    return out;
}

async function loadBannedLedgers(db, admin) {
    const ledgers = {};
    let last = null;
    for (;;) {
        let q = db.collection('faucet_ledger').where('banned', '==', true).orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
        if (last) q = q.startAfter(last);
        const snap = await q.get();
        if (snap.empty) break;
        snap.docs.forEach(function (doc) { ledgers[doc.id] = { banned: true }; });
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    return ledgers;
}

function printSummary(summary, mode) {
    const tiersHit = summary.tiers || [0, 0, 0, 0, 0, 0];
    console.log('[referral-maxi] mode=' + mode);
    console.log('[referral-maxi] referralDocs=' + summary.referralDocs);
    console.log('[referral-maxi] referrers=' + summary.referrers);
    console.log('[referral-maxi] missingReferrer=' + summary.missingReferrer);
    console.log('[referral-maxi] writes=' + summary.writes);
    console.log('[referral-maxi] tier0=' + (tiersHit[0] || 0));
    console.log('[referral-maxi] tier1=' + (tiersHit[1] || 0));
    console.log('[referral-maxi] tier2=' + (tiersHit[2] || 0));
    console.log('[referral-maxi] tier3=' + (tiersHit[3] || 0));
    console.log('[referral-maxi] tier4=' + (tiersHit[4] || 0));
    console.log('[referral-maxi] tier5=' + (tiersHit[5] || 0));
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
        const current = snap.data().referralMaxiCount;
        if (current === row.to) {
            skipped++;
            continue;
        }
        await ref.update({ referralMaxiCount: row.to });
        written++;
    }
    console.log('[referral-maxi] written=' + written);
    console.log('[referral-maxi] skipped=' + skipped);
}

async function main() {
    const argv = process.argv.slice(2);
    if (argv.indexOf('--help') !== -1 || argv.indexOf('-h') !== -1) {
        console.log(helpText());
        return;
    }
    const apply = argv.indexOf('--apply') !== -1;
    const admin = loadAdmin();
    if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
    const db = admin.firestore();
    const users = await loadUsers(db, admin);
    const referrals = await loadReferrals(db, admin);
    const ledgers = await loadBannedLedgers(db, admin);
    const plan = tiers.planMaxiCountWrites({
        users: users,
        referrals: referrals,
        ledgers: ledgers,
    });
    printSummary(plan.summary, apply ? 'apply' : 'dry-run');
    if (!apply) {
        console.log('[referral-maxi] dry-run only. Review the counts, then re-run with --apply.');
        return;
    }
    await applyWrites(db, plan.writes);
}

if (require.main === module) {
    main().catch(function (err) {
        console.error('[referral-maxi]', err && err.message ? err.message : err);
        process.exit(1);
    });
}

module.exports = { printSummary: printSummary };
