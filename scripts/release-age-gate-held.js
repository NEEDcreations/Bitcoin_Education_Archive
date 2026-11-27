#!/usr/bin/env node
/**
 * Release uids from config/ageGateHeld and stamp a fresh 7-day wait.
 *
 * The list file is passed as an argument. It is never read from a path
 * inside this repository. Default is a READ-ONLY dry run (counts only;
 * no uids). Writing needs --apply, --confirm=AGEGATERELEASE, and
 * --expect-count=<n> equal to the dry-run total.
 * --project=<id> is required (no default project). Staging in the output
 * is true only when --project=bitcoin-quest-staging, never from env.
 *
 * File shape accepted (only):
 *   ["uid", ...]
 * Duplicates, blanks, non-strings, objects, wrappers, and text lists
 * are rejected. The applied total must match --expect-count.
 *
 * Each apply step is one transaction per uid. Membership is decided
 * inside that transaction: if the uid is in the held doc, remove it
 * (uids array and any groups) AND set users/{uid}.realAccountAt to
 * server now (merge), so a released account always gets a fresh 7-day
 * wait even if it was already stamped or legacy-synced. If the uid is
 * not in the held doc, skip it: no stamp and no write. It is counted
 * as not_held. If the held doc is missing or unreadable, the
 * transaction fails closed and does not stamp.
 *
 * The dry run is also read-only against the held doc and reports
 * not_held (and held) alongside the file total. A missing or
 * unreadable held doc fails closed. --expect-count still has to match
 * the file total, including not_held entries, so a changed file
 * cannot be applied.
 *
 *   node scripts/release-age-gate-held.js --project=<id> --file=/path/to/private.json
 *   node scripts/release-age-gate-held.js --project=<id> --file=/path/to/private.json --expect-count=<n> --apply --confirm=AGEGATERELEASE
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ageGateHeld = require('../functions/src/ageGateHeld');
const uidList = require('./age-gate-uid-list');

function parseArgs(argv) {
    const apply = argv.indexOf('--apply') !== -1;
    const confirm = argv.some(function (a) { return a === '--confirm=AGEGATERELEASE'; });
    let project = '';
    let file = '';
    argv.forEach(function (a) {
        const p = /^--project=([a-z0-9-]{4,40})$/.exec(String(a));
        if (p) project = p[1];
        const f = /^--file=(.+)$/.exec(String(a));
        if (f) file = f[1];
    });
    return {
        apply: apply && confirm,
        applyRequested: apply,
        confirm: confirm,
        project: project,
        file: file,
        expectCount: uidList.parseExpectCount(argv),
        staging: uidList.isStagingProject(project),
    };
}

function countsOf(uids) {
    return { total: Array.isArray(uids) ? uids.length : uids.size };
}

function parseListFile(filePath) {
    return uidList.parseUidArrayFile(filePath);
}

const ensureFirestore = uidList.ensureFirestore;

function failHeld(reason) {
    const msg = reason === 'held_doc_missing'
        ? 'Refusing: held doc is missing'
        : 'Refusing: held doc is unreadable';
    const e = new Error(msg);
    e.exitCode = 1;
    throw e;
}

async function loadHeld(db) {
    const heldRef = db.collection(ageGateHeld.DOC_COLLECTION).doc(ageGateHeld.DOC_ID);
    const snap = await heldRef.get();
    if (!snap.exists) failHeld('held_doc_missing');
    const parsed = ageGateHeld.parseHeldDoc(snap.data() || {});
    if (!parsed.ok) failHeld('held_doc_unreadable');
    return parsed;
}

function membershipCounts(fileUids, heldParsed) {
    let held = 0;
    let notHeld = 0;
    fileUids.forEach(function (uid) {
        if (heldParsed.uids.has(uid)) held += 1;
        else notHeld += 1;
    });
    return { held: held, not_held: notHeld };
}

function stripUid(data, uid) {
    const next = Object.assign({}, data);
    let removed = false;
    if (Array.isArray(data.uids)) {
        next.uids = data.uids.filter(function (id) { return id !== uid; });
        if (next.uids.length !== data.uids.length) removed = true;
    }
    if (data.groups && typeof data.groups === 'object' && !Array.isArray(data.groups)) {
        const groups = {};
        Object.keys(data.groups).forEach(function (g) {
            const rows = data.groups[g];
            if (!Array.isArray(rows)) {
                groups[g] = rows;
                return;
            }
            groups[g] = rows.filter(function (id) { return id !== uid; });
            if (groups[g].length !== rows.length) removed = true;
        });
        next.groups = groups;
    }
    return { data: next, removed: removed };
}

async function releaseOne(db, FieldValue, uid) {
    const heldRef = db.collection(ageGateHeld.DOC_COLLECTION).doc(ageGateHeld.DOC_ID);
    const userRef = db.collection('users').doc(uid);
    let removed = false;
    let stamped = false;
    let notHeld = false;
    await db.runTransaction(async function (tx) {
        const snap = await tx.get(heldRef);
        if (!snap.exists) failHeld('held_doc_missing');
        const current = snap.data() || {};
        const parsed = ageGateHeld.parseHeldDoc(current);
        if (!parsed.ok) failHeld('held_doc_unreadable');
        if (!parsed.uids.has(uid)) {
            notHeld = true;
            return;
        }
        const next = stripUid(current, uid);
        removed = next.removed;
        tx.set(heldRef, next.data);
        tx.set(userRef, { realAccountAt: FieldValue.serverTimestamp() }, { merge: true });
        stamped = true;
    });
    return { removed: removed, stamped: stamped, not_held: notHeld };
}

async function main(argv, deps) {
    const args = parseArgs(argv || process.argv.slice(2));
    if (!args.project) uidList.refuse('Refusing: pass --project=<id> (there is no default project)');
    if (!args.file) uidList.refuse('Refusing: pass --file=/absolute/path (the uid list is not in this repo)');
    if (args.applyRequested && !args.confirm) {
        uidList.refuse('Refusing: --apply also needs --confirm=AGEGATERELEASE');
    }
    const resolved = path.resolve(args.file);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        uidList.refuse('Refusing: file not found');
    }
    const parsed = parseListFile(resolved);
    if (!parsed.ok) {
        uidList.refuse('Refusing: ' + (parsed.reason || 'could not parse list file'));
    }
    const counts = countsOf(parsed.uids);
    if (args.apply) {
        const check = uidList.checkExpectCount(args.expectCount, counts.total);
        if (!check.ok) {
            if (check.reason === 'missing_expect_count') {
                uidList.refuse('Refusing: --apply also needs --expect-count=<n> from the dry-run total');
            }
            if (check.reason === 'invalid_expect_count') {
                uidList.refuse('Refusing: --expect-count must be a positive integer');
            }
            uidList.refuse('Refusing: --expect-count does not match the parsed total');
        }
    }
    const out = {
        project: args.project,
        staging: args.staging,
        apply: args.apply,
        counts: counts,
    };
    const admin = (deps && deps.admin) || require('../functions/src/firebaseAdmin');
    const db = ensureFirestore(admin, args.project);
    if (!args.apply) {
        const held = await loadHeld(db);
        const mem = membershipCounts(parsed.uids, held);
        out.counts.held = mem.held;
        out.counts.not_held = mem.not_held;
        console.log(JSON.stringify(out, null, 2));
        return out;
    }
    const FieldValue = admin.firestore && admin.firestore.FieldValue;
    if (!FieldValue || typeof FieldValue.serverTimestamp !== 'function') {
        const e = new Error('missing FieldValue.serverTimestamp');
        e.exitCode = 1;
        throw e;
    }
    let removed = 0;
    let stamped = 0;
    let notHeld = 0;
    for (let i = 0; i < parsed.uids.length; i++) {
        const result = await releaseOne(db, FieldValue, parsed.uids[i]);
        if (result.removed) removed += 1;
        if (result.stamped) stamped += 1;
        if (result.not_held) notHeld += 1;
    }
    out.counts.held = stamped;
    out.counts.removed = removed;
    out.counts.stamped = stamped;
    out.counts.not_held = notHeld;
    out.written = stamped > 0;
    console.log(JSON.stringify(out, null, 2));
    return out;
}

module.exports = {
    parseArgs: parseArgs,
    parseListFile: parseListFile,
    countsOf: countsOf,
    ensureFirestore: ensureFirestore,
    stripUid: stripUid,
    releaseOne: releaseOne,
    loadHeld: loadHeld,
    membershipCounts: membershipCounts,
    main: main,
};

if (require.main === module) {
    main().catch(function (e) {
        const msg = e && e.message ? String(e.message) : 'unknown error';
        console.error(msg.indexOf('Refusing:') === 0 ? msg : ('release failed: ' + msg));
        process.exit(e && e.exitCode ? e.exitCode : 1);
    });
}
