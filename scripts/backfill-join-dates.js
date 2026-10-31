#!/usr/bin/env node
'use strict';

// Report user profiles whose Joined date is missing.
//
// Reads each users doc for created and legacy createdAt, then reads Firebase
// Auth metadata.creationTime. A profile
// with no usable join field and a real Auth creation time is listed as
// "would stamp". Profiles with no Auth user, or a creation time outside
// 2020-01-01 through 48 hours from now, are counted and skipped.
//
// This script is dry-run only. It never writes. --apply and --write are
// refused before any Firebase call. It does not estimate a date from points,
// last login, or last visit.
//
//   node scripts/backfill-join-dates.js
//   node scripts/backfill-join-dates.js --help
//
// Auth is Application Default Credentials. No key file is read from the repo.
// Prints usernames and dates only. Never prints an email or a user id.

const path = require('path');
const joinDate = require(path.join(__dirname, '..', 'functions', 'src', 'joinDate'));

const PAGE = 300;
const MAX_PAGES = 10000;

function parseArgs(argv) {
    return {
        help: argv.indexOf('--help') !== -1 || argv.indexOf('-h') !== -1,
        apply: argv.indexOf('--apply') !== -1 || argv.indexOf('--write') !== -1,
    };
}

function safeError(err) {
    return String(err && err.message ? err.message : err)
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted]');
}

async function loadAuthCreation(admin) {
    const authMap = Object.create(null);
    let pageToken;
    do {
        const listed = await admin.auth().listUsers(1000, pageToken);
        listed.users.forEach(function (user) {
            const ms = joinDate.creationTimeMillis(user && user.metadata);
            if (ms != null && user && user.uid) authMap[user.uid] = ms;
        });
        pageToken = listed.pageToken;
    } while (pageToken);
    return authMap;
}

async function loadUsers(db, admin) {
    const fields = ['username'].concat(joinDate.JOIN_KEYS);
    const rows = [];
    let last = null;
    let pages = 0;
    while (pages < MAX_PAGES) {
        let query = db.collection('users');
        query = query.select.apply(query, fields)
            .orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
        if (last) query = query.startAfter(last);
        const snap = await query.get();
        if (snap.empty) break;
        snap.docs.forEach(function (doc) {
            rows.push({ id: doc.id, data: doc.data() || {} });
        });
        last = snap.docs[snap.docs.length - 1];
        pages += 1;
        if (snap.size < PAGE) break;
    }
    return rows;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.apply) {
        console.error('Dry-run only. This script does not write user documents.');
        process.exit(1);
    }
    if (args.help) {
        console.log('Usage: node scripts/backfill-join-dates.js');
        console.log('Reads users missing a join field and Firebase Auth metadata.creationTime.');
        console.log('Prints what it would stamp. Does not write. There is no --apply.');
        return;
    }
    const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const authMap = await loadAuthCreation(admin);
    const rows = await loadUsers(db, admin);
    const plan = joinDate.planJoinBackfill(rows, authMap);
    const sample = plan.wouldStamp.slice(0, 15).map(function (row) {
        return {
            username: row.username || '(no username)',
            joined: row.iso.slice(0, 10),
        };
    });
    console.log(JSON.stringify({
        dryRun: true,
        writes: false,
        scanned: rows.length,
        authTimes: Object.keys(authMap).length,
        alreadySet: plan.already,
        wouldStamp: plan.wouldStamp.length,
        skippedNoAuth: plan.skippedNoAuth,
        sample: sample,
    }));
    console.log('Dry-run only. Nothing was written.');
}

main().catch(function (err) {
    console.error(safeError(err));
    process.exit(1);
});
