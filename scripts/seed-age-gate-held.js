#!/usr/bin/env node
/**
 * Seed config/ageGateHeld from a private uid list (not from the repo).
 *
 * The list file is passed as an argument. It is never read from a path
 * inside this repository. Default is a READ-ONLY dry run (counts only;
 * no uids). Writing needs --apply, --confirm=AGEGATEHELD, and
 * --expect-count=<n> equal to the dry-run total.
 * --project=<id> is required (no default project). Staging in the output
 * is true only when --project=bitcoin-quest-staging, never from env.
 *
 * A payout-hold lift does not remove entries from this doc. Re-running
 * --apply replaces the doc contents with the file (it does not merge with
 * a previous seed).
 *
 * File shape accepted (only):
 *   ["uid", ...]
 * Duplicates, blanks, non-strings, objects, wrappers, and text lists
 * are rejected. The applied total must match --expect-count.
 *
 *   node scripts/seed-age-gate-held.js --project=<id> --file=/path/to/private.json
 *   node scripts/seed-age-gate-held.js --project=<id> --file=/path/to/private.json --expect-count=<n> --apply --confirm=AGEGATEHELD
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ageGateHeld = require('../functions/src/ageGateHeld');
const uidList = require('./age-gate-uid-list');

function parseArgs(argv) {
    const apply = argv.indexOf('--apply') !== -1;
    const confirm = argv.some(function (a) { return a === '--confirm=AGEGATEHELD'; });
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

async function main(argv, deps) {
    const args = parseArgs(argv || process.argv.slice(2));
    if (!args.project) uidList.refuse('Refusing: pass --project=<id> (there is no default project)');
    if (!args.file) uidList.refuse('Refusing: pass --file=/absolute/path (the uid list is not in this repo)');
    if (args.applyRequested && !args.confirm) {
        uidList.refuse('Refusing: --apply also needs --confirm=AGEGATEHELD');
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
    if (!args.apply) {
        console.log(JSON.stringify(out, null, 2));
        return out;
    }
    const admin = (deps && deps.admin) || require('../functions/src/firebaseAdmin');
    const db = ensureFirestore(admin, args.project);
    await db.collection(ageGateHeld.DOC_COLLECTION).doc(ageGateHeld.DOC_ID).set(parsed.doc);
    out.written = true;
    console.log(JSON.stringify(out, null, 2));
    return out;
}

module.exports = { parseArgs, parseListFile, countsOf, ensureFirestore, main };

if (require.main === module) {
    main().catch(function (e) {
        const msg = e && e.message ? String(e.message) : 'unknown error';
        console.error(msg.indexOf('Refusing:') === 0 ? msg : ('seed failed: ' + msg));
        process.exit(e && e.exitCode ? e.exitCode : 1);
    });
}
