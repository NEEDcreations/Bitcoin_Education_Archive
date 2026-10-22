#!/usr/bin/env node
// Backfill referral codes, the missing referral docs, and unpaid Maxi awards.
//
// Dry-run is the default and prints counts only. Nothing is written unless
// --apply is passed. Do not point this at production until the referral
// functions and rules from this change are deployed.
//
//   gcloud auth application-default login
//   node functions/backfill_referrals.js
//   node functions/backfill_referrals.js --apply
//
// Credentials are Application Default Credentials. No service-account JSON
// is read from the repo, and no user id, email, or code is printed.

const path = require('path');
const referrals = require('./src/referrals');

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'bitcoin-education-archive';
const PAGE = 300;

function loadAdmin() {
    try {
        return require('firebase-admin');
    } catch (err) {
        try {
            return require(path.join(__dirname, 'node_modules', 'firebase-admin'));
        } catch (err2) {
            console.error('[referral-backfill] firebase-admin is not installed. From the repo root: cd functions && npm install');
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
        snap.docs.forEach(function(doc) {
            const data = doc.data() || {};
            users.push({
                uid: doc.id,
                referredBy: data.referredBy || '',
                points: data.points || 0,
                referralCode: data.referralCode || '',
                satsDisabled: data.satsDisabled === true,
                fingerprint: data.fingerprint || '',
                known_ips: data.known_ips || [],
                email: data.email || '',
                lightningAddress: data.lightningAddress || data.lightning || '',
            });
        });
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    return users;
}

async function loadReferrals(db, admin) {
    const referralsOut = [];
    let last = null;
    for (;;) {
        let q = db.collection('referrals').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
        if (last) q = q.startAfter(last);
        const snap = await q.get();
        if (snap.empty) break;
        snap.docs.forEach(function(doc) {
            const data = doc.data() || {};
            referralsOut.push(Object.assign({ id: doc.id }, data));
        });
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    return referralsOut;
}

function printCounts(counts, mode) {
    console.log('[referral-backfill] mode=' + mode);
    console.log('[referral-backfill] referralCodesToBackfill=' + counts.referralCodesToBackfill);
    console.log('[referral-backfill] referralRecordsToCreate=' + counts.referralRecordsToCreate);
    console.log('[referral-backfill] maxiPayouts=' + counts.maxiPayouts);
    console.log('[referral-backfill] ticketGrants=' + counts.ticketGrants);
    console.log('[referral-backfill] notifications=' + counts.notifications);
}

async function main() {
    const apply = process.argv.indexOf('--apply') !== -1;
    const admin = loadAdmin();
    if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
    const db = admin.firestore();
    const users = await loadUsers(db, admin);
    const existing = await loadReferrals(db, admin);
    const plan = referrals.planBackfill({ users: users, referrals: existing });
    printCounts(plan.counts, apply ? 'apply' : 'dry-run');
    if (!apply) {
        console.log('[referral-backfill] dry-run only. Re-run with --apply to write.');
        return;
    }

    const service = require('./src/referralService');
    for (let i = 0; i < plan.codesToWrite.length; i++) {
        await service.ensureReferralCode(plan.codesToWrite[i].uid);
    }
    for (let i = 0; i < plan.recordsToCreate.length; i++) {
        const record = plan.recordsToCreate[i];
        const ref = db.collection('referrals').doc(record.referredUid);
        const snap = await ref.get();
        if (snap.exists) continue;
        await ref.set({
            referredUserUid: record.referredUid,
            referredUid: record.referredUid,
            referredUser: record.referredUid,
            referrerUid: record.referrerUid || '',
            referrerCode: record.referrerCode,
            status: record.status || 'pending',
            verified: false,
            ticketsAwarded: false,
            rejectionFlags: record.flags || [],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            backfill: true,
        });
        await db.collection('users').doc(record.referredUid).set({
            referredBy: record.referrerCode,
        }, { merge: true });
    }
    let paid = 0;
    for (let i = 0; i < plan.payouts.length; i++) {
        const result = await service.payIfQualified(plan.payouts[i].referredUid);
        if (result && result.paid) paid++;
    }
    console.log('[referral-backfill] paidNow=' + paid);
}

if (require.main === module) {
    main().catch(function(err) {
        console.error('[referral-backfill]', err && err.message ? err.message : err);
        process.exit(1);
    });
}

module.exports = { printCounts: printCounts };
