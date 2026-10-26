#!/usr/bin/env node
/**
 * Pay the unpaid certification shortfall for people who already passed.
 * Dry-run is the default. This file does not write unless --apply is passed.
 *
 * Shortfall is 2,100 minus the XP that passing exam actually credited, read
 * from the exam key (pointsAwarded / awarded / xp), an xp_ledger exam row,
 * or the grade-result notice. A pass graded before the 2026-10-23 cap
 * commit, with no conflicting record, was credited 2,100 and pays 0.
 * A recorded taper or 0 pays the difference. If those records are missing
 * or disagree, the row is unknown and pays nothing.
 *
 * --apply re-reads the pass inside a transaction and writes the marker only
 * when the shortfall is greater than 0. A full prior credit, an unknown
 * credit, a current ban, and a ban that covered the pass are not marked.
 * An exam key with bonusBlocked is ignored, so a pass taken while banned
 * stays unpaid after an unban. Closed windows live on faucet_ledger.banHistory.
 * It does not change daily_points.
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
        'Dry-run lists each passed certification, the XP already credited,',
        'and the shortfall a later --apply would add (2,100 minus that',
        'credit). Unknown credits are listed and not paid. No writes happen',
        'unless --apply is present.',
    ].join('\n');
}

function parseArgs(argv) {
    return {
        help: argv.indexOf('--help') !== -1 || argv.indexOf('-h') !== -1,
        apply: argv.indexOf('--apply') !== -1,
    };
}

function docsOf(snap) {
    const docs = [];
    if (!snap || typeof snap.forEach !== 'function') return docs;
    snap.forEach(function (doc) {
        docs.push(Object.assign({ id: doc.id }, doc.data() || {}));
    });
    return docs;
}

function idsOf(snap) {
    return docsOf(snap).map(function (doc) { return doc.id; });
}

function passedByUser(docs) {
    const map = new Map();
    docs.forEach(function (doc) {
        const row = doc.data() || {};
        if (row.passed !== true) return;
        if (row.type !== 'properties' && row.type !== 'technical') return;
        const uid = String(row.uid || '');
        if (!uid) return;
        if (!map.has(uid)) map.set(uid, { properties: [], technical: [] });
        map.get(uid)[row.type].push(row);
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

function truncateUid(uid) {
    const clean = String(uid || '').replace(/[^A-Za-z0-9]/g, '');
    if (!clean) return '…';
    return clean.slice(0, 8) + '…';
}

function lineFor(row) {
    const credited = row.credited == null ? 'unknown' : String(row.credited);
    return 'uid=' + truncateUid(row.uid) + ' cert=' + row.type + ' credited=' + credited + ' shortfall=' + (Number(row.shortfall) || 0);
}

function summarize(rows) {
    const users = new Set();
    let xp = 0;
    let unknown = 0;
    (rows || []).forEach(function (row) {
        if (row.uid) users.add(row.uid);
        if (row.reason === 'unknown') unknown += 1;
        if (row.pay) xp += Number(row.amount) || 0;
    });
    return { users: users.size, certs: (rows || []).length, xp: xp, unknown: unknown };
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
        const nowBanned = !userSnap.exists || rewardBlocked(user, faucet);
        const markerSnap = userSnap.exists ? await db.collection('users').doc(uid).collection('cert_bonuses').get() : null;
        const ledgerSnap = userSnap.exists ? await db.collection('users').doc(uid).collection('xp_ledger').get() : null;
        const markerIds = idsOf(markerSnap);
        const ledgerDocs = docsOf(ledgerSnap);
        const ledgerIds = ledgerDocs.map(function (doc) { return doc.id; });
        const bag = grouped.get(uid);
        const types = ['properties', 'technical'];
        for (let t = 0; t < types.length; t++) {
            const type = types[t];
            if (!bag[type] || !bag[type].length) continue;
            const noticeSnap = await db.collection('notifications').doc(certBonus.gradeNoticeId(uid, type)).get();
            const notice = noticeSnap.exists ? (noticeSnap.data() || null) : null;
            const row = certBonus.planBackfillRow({
                uid: uid,
                type: type,
                exams: bag[type],
                banned: nowBanned || certBonus.bannedAtPass(user, faucet, bag[type]),
                alreadyPaid: markerIds.indexOf(certBonus.markerId(type)) !== -1
                    || ledgerIds.indexOf(certBonus.ledgerId(type)) !== -1,
                ledgerDocs: ledgerDocs,
                notice: notice,
            });
            rows.push(row);
        }
    }

    console.log(args.apply ? 'APPLY cert bonus' : 'DRY RUN cert bonus (no writes)');
    for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        if (args.apply && certBonus.shouldApplyBackfill(row)) {
            const result = await certBonus.creditExistingPass(db, admin, row.uid, row.type);
            if (result) {
                row.pay = result.pay === true;
                row.amount = Number(result.amount) || 0;
                row.shortfall = Number(result.shortfall) || 0;
                row.credited = result.credited;
                row.reason = result.reason || row.reason;
            }
        }
        console.log(lineFor(row));
    }
    const totals = summarize(rows);
    console.log('users=' + totals.users + ' certs=' + totals.certs + ' xp=' + totals.xp + ' unknown=' + totals.unknown + ' apply=' + (args.apply ? 'yes' : 'no'));
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
    truncateUid: truncateUid,
    lineFor: lineFor,
    summarize: summarize,
};
