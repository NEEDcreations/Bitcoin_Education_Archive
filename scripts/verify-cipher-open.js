#!/usr/bin/env node
/**
 * Read-only audit of a locked-cipher open or pending win.
 *
 * Looks up a cipherId, winId, or uid, recomputes the prize from the stored
 * roll, checks the receipt HMAC when a record has one, and (when
 * CIPHER_ROLL_SECRET is available) recomputes the roll from the period seed.
 * Prints PASS or FAIL per check and overall. Never writes. Never prints the
 * secret. The period seed is printed only after that UTC day has ended.
 *
 *   node scripts/verify-cipher-open.js --cipherId ID
 *   node scripts/verify-cipher-open.js --winId ID
 *   node scripts/verify-cipher-open.js --uid UID
 *
 * Auth is Application Default Credentials. The secret is read from
 * CIPHER_ROLL_SECRET in the environment (or --secret-file, a file you keep
 * off this repo). Do not pass the secret on the command line.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'bitcoin-education-archive';
const proof = require(path.join(__dirname, '..', 'functions', 'src', 'cipherRollProof'));
const { cipherRollKey } = require(path.join(__dirname, '..', 'functions', 'src', 'cipherRollKey'));

function loadAdmin() {
    try { return require('firebase-admin'); }
    catch (e) {
        return require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
    }
}

function parseArgs(argv) {
    const out = { cipherId: '', winId: '', uid: '', secretFile: '', json: false };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const next = argv[i + 1];
        if (arg === '--cipherId' || arg === '--cipher-id') { out.cipherId = String(next || '').trim(); i++; }
        else if (arg === '--winId' || arg === '--win-id') { out.winId = String(next || '').trim(); i++; }
        else if (arg === '--uid') { out.uid = String(next || '').trim(); i++; }
        else if (arg === '--secret-file') { out.secretFile = String(next || '').trim(); i++; }
        else if (arg === '--json') { out.json = true; }
        else if (arg === '--help' || arg === '-h') { out.help = true; }
        else if (arg === '--secret' || arg === '--CIPHER_ROLL_SECRET') {
            throw new Error('Do not pass the secret on the command line. Use CIPHER_ROLL_SECRET or --secret-file.');
        }
    }
    return out;
}

function loadSecret(opts) {
    if (opts && opts.secretFile) {
        const raw = fs.readFileSync(opts.secretFile, 'utf8');
        return cipherRollKey(raw.split(/\r?\n/)[0] || '');
    }
    return cipherRollKey();
}

function printAudit(label, audit, json) {
    if (json) {
        const copy = JSON.parse(JSON.stringify(audit));
        // The seed is only present after the period ends. Never add a secret field.
        if (!copy.seed) delete copy.seed;
        console.log(JSON.stringify({ label: label, result: copy.ok ? 'PASS' : 'FAIL', audit: copy }));
        return copy.ok;
    }
    console.log('--- ' + label + ' ---');
    const rec = audit.record || {};
    if (rec.cipherId) console.log('cipherId: ' + rec.cipherId);
    if (rec.openerUid) console.log('openerUid: ' + rec.openerUid);
    if (rec.keyId) console.log('keyId: ' + rec.keyId);
    if (rec.roll != null) console.log('roll: ' + rec.roll);
    if (rec.rewardType) console.log('recorded prize: ' + rec.rewardType + (rec.satsAmount ? (' ' + rec.satsAmount + ' sats') : ''));
    if (rec.periodId) console.log('period: ' + rec.periodId);
    if (rec.commitment) console.log('commitment: ' + rec.commitment);
    if (audit.seed) console.log('period seed (revealed): ' + audit.seed);
    audit.checks.forEach(function (check) {
        console.log((check.ok ? 'PASS' : 'FAIL') + '  ' + check.name + (check.detail ? ('  ' + check.detail) : ''));
    });
    console.log((audit.ok ? 'PASS' : 'FAIL') + '  overall');
    return audit.ok;
}

async function loadTargets(db, opts) {
    const rows = [];
    if (opts.cipherId) {
        const snap = await db.collection('locked_ciphers').doc(opts.cipherId).get();
        if (snap.exists) rows.push({ kind: 'cipher', id: snap.id, data: snap.data() || {} });
        const wins = await db.collection('cipher_wins').where('cipherId', '==', opts.cipherId).get();
        wins.forEach(function (d) { rows.push({ kind: 'win', id: d.id, data: d.data() || {} }); });
        const share = await db.collection('cipher_shares').doc(opts.cipherId).get();
        if (share.exists) rows.push({ kind: 'share', id: share.id, data: share.data() || {} });
    }
    if (opts.winId) {
        const snap = await db.collection('cipher_wins').doc(opts.winId).get();
        if (snap.exists) rows.push({ kind: 'win', id: snap.id, data: snap.data() || {} });
    }
    if (opts.uid) {
        const wins = await db.collection('cipher_wins').where('uid', '==', opts.uid).orderBy('createdAt', 'desc').limit(50).get();
        wins.forEach(function (d) { rows.push({ kind: 'win', id: d.id, data: d.data() || {} }); });
        const ciphers = await db.collection('locked_ciphers').where('ownerId', '==', opts.uid).limit(100).get();
        ciphers.forEach(function (d) {
            const data = d.data() || {};
            if (data.status === 'opened') rows.push({ kind: 'cipher', id: d.id, data: data });
        });
    }
    const seen = {};
    return rows.filter(function (row) {
        const key = row.kind + ':' + row.id;
        if (seen[key]) return false;
        seen[key] = true;
        return true;
    });
}

function recordFor(row) {
    const data = Object.assign({ cipherId: row.kind === 'cipher' ? row.id : (row.data.cipherId || row.id) }, row.data);
    if (row.kind === 'win' && !data.openerUid) data.openerUid = data.uid || '';
    if (row.kind === 'share' && !data.openerUid) data.openerUid = data.openerUid || '';
    return data;
}

async function auditTargets(targets, secret, nowMs) {
    return targets.map(function (row) {
        const audit = proof.auditOpen(secret, recordFor(row), nowMs);
        return { label: row.kind + ' ' + row.id, audit: audit };
    });
}

async function main(argv, io) {
    const opts = parseArgs(argv || process.argv.slice(2));
    const log = (io && io.log) || console.log;
    const err = (io && io.err) || console.error;
    if (opts.help || (!opts.cipherId && !opts.winId && !opts.uid)) {
        log('Usage: node scripts/verify-cipher-open.js --cipherId ID | --winId ID | --uid UID');
        log('Read-only. Set CIPHER_ROLL_SECRET or --secret-file. Never pass the secret on the command line.');
        return opts.help ? 0 : 2;
    }
    const secret = loadSecret(opts);
    const admin = (io && io.admin) || loadAdmin();
    const db = (io && io.db) || (function () {
        if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
        return admin.firestore();
    })();
    const nowMs = (io && io.nowMs) || Date.now();
    const targets = await loadTargets(db, opts);
    if (!targets.length) {
        err('No matching cipher, win, or share found. No data was written.');
        return 1;
    }
    if (!secret) {
        log('CIPHER_ROLL_SECRET is not set; receipt HMAC and roll recompute will fail for schema 3 records.');
    }
    const results = await auditTargets(targets, secret, nowMs);
    let ok = true;
    results.forEach(function (row) {
        const passed = printAudit(row.label, row.audit, opts.json);
        if (!passed) ok = false;
    });
    return ok ? 0 : 1;
}

module.exports = {
    parseArgs: parseArgs,
    loadSecret: loadSecret,
    recordFor: recordFor,
    auditTargets: auditTargets,
    printAudit: printAudit,
    main: main,
};

if (require.main === module) {
    main(process.argv.slice(2)).then(function (code) { process.exit(code); }).catch(function (err) {
        console.error(err && err.message ? err.message : 'Audit failed. No data was written.');
        process.exit(1);
    });
}
