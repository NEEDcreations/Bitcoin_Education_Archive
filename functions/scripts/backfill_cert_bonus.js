#!/usr/bin/env node
/**
 * List certification completion bonuses for people who already passed.
 * Dry-run is the default. This file does not write unless --apply is passed.
 *
 * A payable row is one passed scholar_exam_keys document whose score is at
 * least 20, for properties (Bitcoin Scholar) or technical (Protocol Expert),
 * with no cert_bonuses marker and no xp_ledger row sourced cert_bonus.
 * Banned accounts are listed at 0. The amount is the full 2,100. Earlier
 * tapered exam XP is not subtracted, because it was not tagged cert_bonus.
 * Review the list before --apply.
 *
 * --apply re-reads the pass inside a transaction and credits points and
 * scholarPoints. It does not change daily_points.
 *
 *   node functions/scripts/backfill_cert_bonus.js
 *   node functions/scripts/backfill_cert_bonus.js --apply
 */
'use strict';

const certBonus = require('../src/certBonus');
const { rewardBlocked } = require('../src/cipherClaim');

const PAGE = 300;

function helpText() {
    return [
        'Usage: node functions/scripts/backfill_cert_bonus.js [--apply]',
        '',
        'Dry-run lists users who already passed a certification and the XP',
        'a later --apply would credit (2,100 per unpaid cert, outside the',
        'daily cap). No writes happen unless --apply is present.',
    ].join('\n');
}

function parseArgs(argv) {
    return {
        help: argv.indexOf('--help') !== -1 || argv.indexOf('-h') !== -1,
        apply: argv.indexOf('--apply') !== -1,
    };
}

function idsOf(snap) {
    const ids = [];
    if (!snap) return ids;
    if (typeof snap.forEach === 'function') snap.forEach(function (doc) { ids.push(doc.id); });
    else (snap.docs || []).forEach(function (doc) { ids.push(doc.id); });
    return ids;
}

function passedByUser(docs) {
    const map = new Map();
    docs.forEach(function (doc) {
        const row = doc.data() || {};
        if (row.passed !== true) return;
        if (row.type !== 'properties' && row.type !== 'technical') return;
        const uid = String(row.uid || '');
        if (!uid) return;
        if (!map.has(uid)) map.set(uid, {});
        const bag = map.get(uid);
        const prev = bag[row.type];
        const score = Number(row.score);
        if (!prev || (Number.isFinite(score) && score > Number(prev.score || 0))) bag[row.type] = row;
    });
    return map;
}

async function loadExamPages(db, admin) {
    const docs = [];
    let cursor = null;
    while (true) {
        let query = db.collection('scholar_exam_keys').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
        if (cursor) query = query.startAfter(cursor);
        const snap = await query.get();
        if (!snap.docs || !snap.docs.length) break;
        snap.docs.forEach(function (doc) { docs.push(doc); });
        cursor = snap.docs[snap.docs.length - 1];
        if (snap.docs.length < PAGE) break;
    }
    return docs;
}

function lineFor(row, wrote) {
    const name = row.username ? (' username=' + row.username) : '';
    const verb = wrote ? 'WROTE' : (row.pay ? 'PAY' : 'SKIP');
    return verb + ' uid=' + row.uid + name + ' type=' + row.type + ' amount=' + row.amount + ' reason=' + row.reason;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log(helpText());
        return;
    }
    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const exams = await loadExamPages(db, admin);
    const grouped = passedByUser(exams);
    const rows = [];
    const uids = Array.from(grouped.keys()).sort();
    for (let i = 0; i < uids.length; i++) {
        const uid = uids[i];
        const userSnap = await db.collection('users').doc(uid).get();
        const user = userSnap.exists ? (userSnap.data() || {}) : {};
        const faucetSnap = await db.collection('faucet_ledger').doc(uid).get();
        const faucet = faucetSnap.exists ? (faucetSnap.data() || {}) : {};
        const banned = !userSnap.exists || rewardBlocked(user, faucet);
        const markerSnap = userSnap.exists ? await db.collection('users').doc(uid).collection('cert_bonuses').get() : null;
        const ledgerSnap = userSnap.exists ? await db.collection('users').doc(uid).collection('xp_ledger').get() : null;
        const markerIds = idsOf(markerSnap);
        const ledgerIds = idsOf(ledgerSnap);
        const bag = grouped.get(uid);
        ['properties', 'technical'].forEach(function (type) {
            if (!bag[type]) return;
            const row = certBonus.planBackfillRow({
                uid: uid,
                username: String(user.username || '').replace(/[\r\n\t]/g, ' ').slice(0, 40),
                type: type,
                exam: bag[type],
                banned: banned,
                alreadyPaid: markerIds.indexOf(certBonus.markerId(type)) !== -1
                    || ledgerIds.indexOf(certBonus.ledgerId(type)) !== -1,
            });
            rows.push(row);
        });
    }

    console.log(args.apply ? 'APPLY cert bonus' : 'DRY RUN cert bonus (no writes)');
    let payable = 0;
    let xp = 0;
    for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        let wrote = false;
        if (args.apply && row.pay) {
            const result = await certBonus.creditExistingPass(db, admin, row.uid, row.type);
            wrote = !!(result && result.pay);
            if (!wrote) {
                row.pay = false;
                row.amount = 0;
                row.reason = (result && result.reason) || 'skipped';
            }
        }
        if (row.pay) {
            payable += 1;
            xp += row.amount;
        }
        console.log(lineFor(row, wrote));
    }
    console.log('passedCerts=' + rows.length + ' payable=' + payable + ' xp=' + xp + ' apply=' + (args.apply ? 'yes' : 'no'));
}

if (require.main === module) {
    main().catch(function (err) {
        console.error(err && err.stack ? err.stack : err);
        process.exit(1);
    });
}

module.exports = {
    parseArgs: parseArgs,
    passedByUser: passedByUser,
    lineFor: lineFor,
};
