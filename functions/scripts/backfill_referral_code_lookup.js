#!/usr/bin/env node
// Backfill referralCodes/{code} for users missing from the code lookup.
//
// Dry-run is the default and prints counts only. --apply writes the lookup
// docs and, for a Lightning uid, the minted code on the user doc.
// This script refuses --apply when the project is production.
// Do not run it against production.
//
//   node functions/scripts/backfill_referral_code_lookup.js
//   node functions/scripts/backfill_referral_code_lookup.js --apply
//
// No user id, email, code, or address is printed.

const fs = require('fs');
const path = require('path');
const referrals = require('../src/referrals');

const PRODUCTION_PROJECT = 'bitcoin-education-archive';
const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || PRODUCTION_PROJECT;
const PAGE = 300;

function loadAdmin() {
    try {
        return require('firebase-admin');
    } catch (err) {
        try {
            return require(path.join(__dirname, '..', 'node_modules', 'firebase-admin'));
        } catch (err2) {
            console.error('[referral-code-lookup] firebase-admin is not installed. From the repo root: cd functions && npm install');
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
            users.push({
                uid: doc.id,
                referralCode: data.referralCode || '',
            });
        });
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    return users;
}

async function loadCodeIndex(db, admin) {
    const index = {};
    let last = null;
    for (;;) {
        let q = db.collection('referralCodes').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
        if (last) q = q.startAfter(last);
        const snap = await q.get();
        if (snap.empty) break;
        snap.docs.forEach(function (doc) {
            index[doc.id] = String((doc.data() || {}).uid || '');
        });
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE) break;
    }
    return index;
}

function keyProjectId() {
    const file = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';
    if (!file) return '';
    try {
        const json = JSON.parse(fs.readFileSync(file, 'utf8'));
        return String(json && json.project_id || '');
    } catch (e) {
        return '';
    }
}

function printCounts(counts, mode) {
    console.log('[referral-code-lookup] mode=' + mode);
    console.log('[referral-code-lookup] missing=' + counts.missing);
    console.log('[referral-code-lookup] collisions=' + counts.collisions);
}

async function main() {
    const apply = process.argv.indexOf('--apply') !== -1;
    if (apply && referrals.blocksProductionApply(PROJECT_ID, keyProjectId())) {
        console.error('[referral-code-lookup] refusing --apply against production');
        process.exit(1);
    }
    const admin = loadAdmin();
    if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
    const db = admin.firestore();
    const users = await loadUsers(db, admin);
    const index = await loadCodeIndex(db, admin);
    const plan = referrals.planCodeLookup(users, index);
    printCounts(plan.counts, apply ? 'apply' : 'dry-run');
    if (!apply) {
        console.log('[referral-code-lookup] dry-run only. Re-run with --apply on a non-production project.');
        return;
    }
    let written = 0;
    for (let i = 0; i < plan.writes.length; i++) {
        const row = plan.writes[i];
        const code = referrals.normalizeCode(row.code);
        if (!code) continue;
        const codeRef = db.collection('referralCodes').doc(code);
        const userRef = db.collection('users').doc(row.uid);
        await db.runTransaction(async function (t) {
            const [codeDoc, userDoc] = await Promise.all([t.get(codeRef), t.get(userRef)]);
            if (!userDoc.exists) return;
            const owner = codeDoc.exists ? String((codeDoc.data() || {}).uid || '') : '';
            if (owner && owner !== row.uid) return;
            if (!owner) {
                t.set(codeRef, {
                    uid: row.uid,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
            if (referrals.needsMintedReferralCode(row.uid) && userDoc.data().referralCode !== code) {
                t.update(userRef, { referralCode: code });
            } else if (!referrals.normalizeCode(userDoc.data().referralCode)) {
                t.update(userRef, { referralCode: code });
            }
        });
        written++;
    }
    console.log('[referral-code-lookup] wrote=' + written);
}

main().catch(function (err) {
    console.error('[referral-code-lookup] failed');
    process.exit(1);
});
