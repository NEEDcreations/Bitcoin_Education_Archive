#!/usr/bin/env node
'use strict';

// One-time closeout for users.pendingOverflow.
//
// Say-hi, reply bonus, and key sends used to bank into this same field.
// Those paths now drop overflow. This script still pays whatever is already
// banked, then deletes pendingOverflow and lastOverflowDate.
//
// Dry-run is the default. It only reads. It prints uid, banked XP, the
// capped payout, farm flags, and a status. It never prints an address or a
// profile name. Nothing is written unless --apply is passed.
//
// --apply pays min(bank, 2000) XP once, inside a transaction, then deletes
// pendingOverflow and lastOverflowDate. A user with xpBankPayoutApplied
// already set is skipped. Banned accounts and flagged-as-farmed accounts
// are listed as "held for review" and are not paid. Pass --approve-file
// with one uid per line to pay a held account. Do not run this against
// production until the dry-run report has been reviewed.
//
//   gcloud auth application-default login
//   node scripts/xp-bank-payout.js
//   node scripts/xp-bank-payout.js --apply
//   node scripts/xp-bank-payout.js --apply --approve-file ./approved-uids.txt
//
// Credentials come from Application Default Credentials. No service-account
// JSON is read from the repo.

const fs = require('fs');
const path = require('path');

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'bitcoin-education-archive';
const PAYOUT_CAP = 2000;
const PAGE_SIZE = 300;
const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function isPayoutBanned(user, ledger) {
    const src = user || {};
    const book = ledger || {};
    if (src.banned === true) return true;
    if (src.satsDisabled === true) return true;
    if (src.ban_reason) return true;
    if (book.banned === true) return true;
    return false;
}

function planBankPayout(user, ledger, approved) {
    const src = user || {};
    const banked = Math.max(0, Math.floor(Number(src.pendingOverflow) || 0));
    const points = Math.max(0, Math.floor(Number(src.points) || 0));
    const reasons = [];
    if (banked >= 10000) reasons.push('bank-over-10000');
    if (banked >= 2000 && banked > points * 5) reasons.push('bank-over-5x-points');
    if (banked >= 2000 && points < 100) reasons.push('bank-with-under-100-points');
    const farmed = reasons.length > 0;
    const banned = isPayoutBanned(src, ledger);
    if (banned) reasons.push('banned');
    const alreadyApplied = src.xpBankPayoutApplied === true;
    const uid = String(src.uid || '');
    const approvedSet = approved instanceof Set ? approved : null;
    const isApproved = !!(approvedSet && approvedSet.has(uid));
    const payout = (alreadyApplied || banked <= 0) ? 0 : Math.min(banked, PAYOUT_CAP);
    let status = 'pay';
    let willPay = true;
    if (alreadyApplied || banked <= 0) {
        status = 'skip';
        willPay = false;
    } else if (farmed || banned) {
        if (isApproved) {
            status = 'approved';
            willPay = true;
        } else {
            status = 'held for review';
            willPay = false;
        }
    }
    return {
        uid: uid,
        banked: banked,
        payout: payout,
        farmed: farmed,
        reasons: reasons,
        skip: status === 'skip',
        alreadyApplied: alreadyApplied,
        status: status,
        willPay: willPay,
        banned: banned,
    };
}

function reportRow(plan) {
    const src = plan || {};
    return {
        uid: String(src.uid || ''),
        banked: src.banked || 0,
        payout: src.payout || 0,
        farmed: src.farmed === true,
        reasons: Array.isArray(src.reasons) ? src.reasons.slice() : [],
        status: src.status || 'skip',
    };
}

function readApproveFile(filePath) {
    const approved = new Set();
    if (!filePath) return approved;
    const text = fs.readFileSync(filePath, 'utf8');
    const lines = String(text).split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        const hash = line.indexOf('#');
        if (hash !== -1) line = line.slice(0, hash).trim();
        if (!line) continue;
        if (!UID_RE.test(line)) continue;
        approved.add(line);
    }
    return approved;
}

function approveFileArg(argv) {
    const idx = argv.indexOf('--approve-file');
    if (idx === -1) return '';
    const next = argv[idx + 1];
    if (!next || next.indexOf('--') === 0) return '';
    return next;
}

function loadAdmin() {
    const local = path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin');
    try {
        return require('firebase-admin');
    } catch (err) {
        try {
            return require(local);
        } catch (err2) {
            console.error('[xp-bank] firebase-admin is not installed. From the repo root: cd functions && npm ci');
            process.exit(1);
        }
    }
}

function planFromSnap(id, data, ledger, approved) {
    const src = data || {};
    return planBankPayout({
        uid: id,
        pendingOverflow: src.pendingOverflow,
        points: src.points,
        xpBankPayoutApplied: src.xpBankPayoutApplied === true,
        banned: src.banned === true,
        satsDisabled: src.satsDisabled === true,
        ban_reason: src.ban_reason,
    }, ledger || {}, approved);
}

async function applyOne(db, admin, ref, approved) {
    const FieldValue = admin.firestore.FieldValue;
    return db.runTransaction(async function(tx) {
        const ledgerRef = db.collection('faucet_ledger').doc(ref.id);
        const snap = await tx.get(ref);
        const ledgerSnap = await tx.get(ledgerRef);
        if (!snap.exists) {
            return reportRow({ uid: ref.id, banked: 0, payout: 0, farmed: false, reasons: [], status: 'skip' });
        }
        const ledger = ledgerSnap.exists ? (ledgerSnap.data() || {}) : {};
        const plan = planFromSnap(snap.id, snap.data() || {}, ledger, approved);
        if (!plan.willPay) return reportRow(plan);
        tx.update(ref, {
            points: FieldValue.increment(plan.payout),
            pendingOverflow: FieldValue.delete(),
            lastOverflowDate: FieldValue.delete(),
            xpBankPayoutApplied: true,
            xpBankPayoutAmount: plan.payout,
            xpBankPayoutBank: plan.banked,
            xpBankPayoutAt: FieldValue.serverTimestamp(),
        });
        return reportRow(plan);
    });
}

async function main() {
    const apply = process.argv.indexOf('--apply') !== -1;
    const approved = readApproveFile(approveFileArg(process.argv));
    const admin = loadAdmin();
    if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
    const db = admin.firestore();
    let last = null;
    let scanned = 0;
    let reported = 0;
    let farmed = 0;
    let held = 0;
    let payoutSum = 0;
    let bankedSum = 0;

    console.log('[xp-bank] project=' + PROJECT_ID + ' mode=' + (apply ? 'apply' : 'dry-run'));
    if (!apply) console.log('[xp-bank] dry-run: no Firestore writes');

    while (scanned < 500000) {
        let query = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE_SIZE);
        if (last) query = query.startAfter(last);
        const snap = await query.get();
        if (snap.empty) break;
        last = snap.docs[snap.docs.length - 1];
        scanned += snap.size;
        for (let i = 0; i < snap.docs.length; i++) {
            const doc = snap.docs[i];
            const data = doc.data() || {};
            const banked = Math.floor(Number(data.pendingOverflow) || 0);
            if (banked <= 0 && data.xpBankPayoutApplied !== true) continue;
            let ledger = {};
            if (banked > 0 && data.xpBankPayoutApplied !== true) {
                const ledgerSnap = await db.collection('faucet_ledger').doc(doc.id).get();
                if (ledgerSnap.exists) ledger = ledgerSnap.data() || {};
            }
            const plan = planFromSnap(doc.id, data, ledger, approved);
            let row = reportRow(plan);
            if (apply && plan.willPay) row = await applyOne(db, admin, doc.ref, approved);
            if ((row.banked || 0) <= 0 && !plan.alreadyApplied) continue;
            reported++;
            if (row.farmed) farmed++;
            if (row.status === 'held for review') held++;
            if (row.status === 'pay' || row.status === 'approved') payoutSum += row.payout || 0;
            bankedSum += row.banked || 0;
            console.log(JSON.stringify(row));
        }
        if (snap.size < PAGE_SIZE) break;
    }

    console.log(JSON.stringify({
        mode: apply ? 'apply' : 'dry-run',
        scanned: scanned,
        reported: reported,
        farmed: farmed,
        held: held,
        banked: bankedSum,
        payout: payoutSum,
    }));
}

module.exports = {
    PAYOUT_CAP: PAYOUT_CAP,
    planBankPayout: planBankPayout,
    reportRow: reportRow,
    readApproveFile: readApproveFile,
};

if (require.main === module) {
    main().catch(function(err) {
        console.error('[xp-bank] failed:', err && err.message ? err.message : err);
        process.exit(1);
    });
}
