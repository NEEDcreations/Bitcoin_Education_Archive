#!/usr/bin/env node
// Backfill referral codes, the missing referral docs, and unpaid Maxi awards.
//
// Dry-run is the default and prints counts only. --apply does nothing unless
// the owner has reviewed those counts and also passes --approved.
// Records that exist only because users.referredBy was set are created as
// untrusted and are not paid. A referral doc is paid only when
// referral_signals/{uid} exists and the anti-alt gates pass. Docs with no
// signal are legacy and are never paid, including with --apply --approved.
// Do not point this at production until the referral functions and rules
// from this change are deployed.
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
                banned: data.banned === true,
                fingerprint: data.fingerprint || '',
                known_ips: data.known_ips || [],
                email: data.email || '',
                lightningAddress: data.lightningAddress || data.lightning || '',
                scholarPoints: data.scholarPoints || 0,
                activeDayKeys: data.activeDayKeys || [],
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

async function loadSignalIds(db, admin) {
    const ids = [];
    let last = null;
    for (;;) {
        let q = db.collection('referral_signals').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
        if (last) q = q.startAfter(last);
        const snap = await q.get();
        if (snap.empty) break;
        snap.docs.forEach(function(doc) { ids.push(doc.id); });
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    return ids;
}

async function attachAuth(admin, users, signalSet) {
    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        if (!signalSet[user.uid]) continue;
        try {
            const record = await admin.auth().getUser(user.uid);
            const ms = Date.parse(record && record.metadata && record.metadata.creationTime || '');
            user.createdMs = isFinite(ms) ? ms : null;
            user.emailVerified = !!(record && record.emailVerified);
            user.providers = ((record && record.providerData) || []).map(function(row) {
                return row && row.providerId ? String(row.providerId) : '';
            }).filter(Boolean);
        } catch (e) {
            user.createdMs = null;
            user.emailVerified = false;
            user.providers = [];
        }
    }
}

async function attachPayLimits(db, admin, users) {
    const limits = {};
    let last = null;
    for (;;) {
        let q = db.collection('referral_pay_limits').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
        if (last) q = q.startAfter(last);
        const snap = await q.get();
        if (snap.empty) break;
        snap.docs.forEach(function(doc) { limits[doc.id] = (doc.data() || {}).paidAtMs || []; });
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    users.forEach(function(user) {
        if (limits[user.uid]) user.recentPaidAt = limits[user.uid];
    });
}

async function attachLedgerBans(db, admin, users) {
    const banned = {};
    let last = null;
    for (;;) {
        let q = db.collection('faucet_ledger').where('banned', '==', true).orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
        if (last) q = q.startAfter(last);
        const snap = await q.get();
        if (snap.empty) break;
        snap.docs.forEach(function(doc) { banned[doc.id] = true; });
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    users.forEach(function(user) {
        user.ledgerBanned = !!banned[user.uid];
    });
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
    const approved = process.argv.indexOf('--approved') !== -1;
    const admin = loadAdmin();
    if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
    const db = admin.firestore();
    const users = await loadUsers(db, admin);
    await attachLedgerBans(db, admin, users);
    const signalIds = await loadSignalIds(db, admin);
    const signalSet = {};
    signalIds.forEach(function(id) { signalSet[id] = true; });
    await attachAuth(admin, users, signalSet);
    await attachPayLimits(db, admin, users);
    const existing = await loadReferrals(db, admin);
    const plan = referrals.planBackfill({
        users: users,
        referrals: existing,
        signals: signalIds,
        nowMs: Date.now(),
    });
    printCounts(plan.counts, apply && approved ? 'apply' : 'dry-run');
    if (!apply || !approved) {
        console.log('[referral-backfill] dry-run only. The owner reviews these counts, then re-runs with --apply --approved.');
        if (apply && !approved) console.log('[referral-backfill] --apply refused without --approved.');
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
            status: 'untrusted',
            verified: false,
            ticketsAwarded: false,
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
