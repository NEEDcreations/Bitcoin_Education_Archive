#!/usr/bin/env node
/**
 * Seed config/ageGateHeld from a private uid list (not from the repo).
 *
 * The list file is passed as an argument. It is never read from a path
 * inside this repository. Default is a READ-ONLY dry run (counts per
 * group only; no uids). Writing needs both --apply and --confirm=AGEGATEHELD.
 * --project=<id> is required (no default project).
 *
 * A payout-hold lift does not remove entries from this doc. Re-running
 * --apply replaces the doc contents with the file (it does not merge with
 * a previous seed).
 *
 * File shapes accepted:
 *   { "groups": { "A": ["uid", ...], "Watch": ["uid"] } }
 *   { "uids": ["uid", ...] }
 *   ["uid", ...]
 *   text lines: "GROUP uid" or "uid"
 *
 *   node scripts/seed-age-gate-held.js --project=<id> --file=/path/to/private.json
 *   node scripts/seed-age-gate-held.js --project=<id> --file=/path/to/private.json --apply --confirm=AGEGATEHELD
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ageGateHeld = require('../functions/src/ageGateHeld');

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
    return { apply: apply && confirm, applyRequested: apply, confirm: confirm, project: project, file: file };
}

function countsOf(groups, uids) {
    const counts = { total: uids.size, groups: {} };
    Object.keys(groups).forEach(function (g) {
        counts.groups[g] = groups[g].length;
    });
    return counts;
}

function parseListFile(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const trimmed = raw.replace(/^\uFEFF/, '').trim();
    if (!trimmed) return { ok: false, reason: 'empty_file' };
    if (trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[') {
        let data;
        try { data = JSON.parse(trimmed); } catch (e) { return { ok: false, reason: 'invalid_json' }; }
        if (Array.isArray(data)) data = { uids: data };
        const parsed = ageGateHeld.parseHeldDoc(data);
        if (!parsed.ok) return parsed;
        return { ok: true, uids: parsed.uids, groups: parsed.groups, doc: data.groups ? { groups: parsed.groups } : { uids: Array.from(parsed.uids) } };
    }
    const groups = {};
    const uids = new Set();
    trimmed.split(/\r?\n/).forEach(function (line) {
        const t = line.replace(/#.*$/, '').trim();
        if (!t) return;
        const parts = t.split(/\s+/);
        let group = '';
        let id = '';
        if (parts.length >= 2) {
            group = parts[0];
            id = parts.slice(1).join(' ').trim();
        } else {
            id = parts[0];
        }
        if (!id) return;
        uids.add(id);
        if (group) {
            groups[group] = groups[group] || [];
            if (groups[group].indexOf(id) === -1) groups[group].push(id);
        }
    });
    const doc = Object.keys(groups).length ? { groups: groups } : { uids: Array.from(uids) };
    return { ok: true, uids: uids, groups: groups, doc: doc };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.project) {
        console.error('Refusing: pass --project=<id> (there is no default project)');
        process.exit(2);
    }
    if (!args.file) {
        console.error('Refusing: pass --file=/absolute/path (the uid list is not in this repo)');
        process.exit(2);
    }
    if (args.applyRequested && !args.confirm) {
        console.error('Refusing: --apply also needs --confirm=AGEGATEHELD');
        process.exit(2);
    }
    const resolved = path.resolve(args.file);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        console.error('Refusing: file not found');
        process.exit(2);
    }
    const parsed = parseListFile(resolved);
    if (!parsed.ok) {
        console.error('Refusing: ' + (parsed.reason || 'could not parse list file'));
        process.exit(2);
    }
    const counts = countsOf(parsed.groups, parsed.uids);
    const out = { project: args.project, apply: args.apply, counts: counts };
    if (!args.apply) {
        console.log(JSON.stringify(out, null, 2));
        return;
    }
    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp({ projectId: args.project });
    const db = admin.firestore();
    await db.collection(ageGateHeld.DOC_COLLECTION).doc(ageGateHeld.DOC_ID).set(parsed.doc);
    out.written = true;
    console.log(JSON.stringify(out, null, 2));
}

module.exports = { parseArgs, parseListFile, countsOf };

if (require.main === module) {
    main().catch(function (e) { console.error('seed failed:', e && e.message); process.exit(1); });
}
