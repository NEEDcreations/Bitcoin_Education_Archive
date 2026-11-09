#!/usr/bin/env node
'use strict';

// Remove Lightning addresses and presence from public_profiles.
//
// Dry run by default. Nothing is written, and no backup file is created,
// because the backup holds the removed Lightning addresses.
//
//   node scripts/strip-public-profile-secrets.js
//   node scripts/strip-public-profile-secrets.js --apply
//   node scripts/strip-public-profile-secrets.js --apply --backup /tmp/public-profile-secrets.json
//
// --apply writes a JSON backup of the removed values first. If that write
// fails, no profile is changed. Then it deletes lightningAddress, lightning,
// lastSeen, and isOnline from public_profiles. lastSeen and isOnline are
// copied onto profile_presence/{uid} so profile dots still have a home.
// --write is refused. Country stays; profile cards render it.
//
// Run this before deploying syncPublicProfile. A later user write replaces
// the public doc and would drop these fields without adding them to the backup.
//
// Auth is Application Default Credentials. No key file is read from the repo.
// The backup is secret. Do not commit it. Stdout prints counts only.

const fs = require('fs');
const os = require('os');
const path = require('path');
const mirror = require(path.join(__dirname, '..', 'functions', 'src', 'publicProfileMirror'));

const PAGE = 300;

function safeError(err) {
    return String(err && err.message ? err.message : err)
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted]');
}

function backupPath(args) {
    if (args.backup) return path.resolve(args.backup);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(os.tmpdir(), 'public-profile-secrets-' + stamp + '.json');
}

async function loadProfiles(db, admin) {
    const rows = [];
    let last = null;
    let pages = 0;
    while (pages < 10000) {
        let query = db.collection('public_profiles');
        query = query.select.apply(query, mirror.STRIP_FIELDS)
            .orderBy(admin.firestore.FieldPath.documentId())
            .limit(PAGE);
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

function countKinds(plans) {
    let lightning = 0;
    let presence = 0;
    plans.forEach(function (plan) {
        if (plan.removed.lightningAddress || plan.removed.lightning) lightning += 1;
        if (Object.prototype.hasOwnProperty.call(plan.removed, 'lastSeen')
            || Object.prototype.hasOwnProperty.call(plan.removed, 'isOnline')) presence += 1;
    });
    return { lightning: lightning, presence: presence };
}

async function applyPlans(db, admin, plans) {
    const FieldValue = admin.firestore.FieldValue;
    let batch = db.batch();
    let ops = 0;
    let updated = 0;
    async function flush() {
        if (!ops) return;
        await batch.commit();
        batch = db.batch();
        ops = 0;
    }
    for (let i = 0; i < plans.length; i++) {
        const plan = plans[i];
        if (!plan.remove || plan.id.indexOf('/') !== -1) continue;
        const del = {};
        Object.keys(plan.removed).forEach(function (key) {
            del[key] = FieldValue.delete();
        });
        batch.update(db.collection('public_profiles').doc(plan.id), del);
        ops += 1;
        if (Object.keys(plan.presence).length) {
            batch.set(db.collection('profile_presence').doc(plan.id), plan.presence, { merge: true });
            ops += 1;
        }
        updated += 1;
        if (ops >= 400) await flush();
    }
    await flush();
    return updated;
}

async function main() {
    const args = mirror.parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log('Usage: node scripts/strip-public-profile-secrets.js [--apply] [--backup <file>]');
        console.log('Dry run by default. --apply writes a JSON backup, then deletes the fields.');
        console.log('--write is not accepted.');
        return;
    }
    if (args.write) {
        console.error('Refusing --write. Pass --apply to delete the fields after the backup is written.');
        process.exit(1);
    }
    const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const rows = await loadProfiles(db, admin);
    const plans = rows.map(function (row) { return mirror.planStrip(row.id, row.data); })
        .filter(function (plan) { return plan.remove; });
    const kinds = countKinds(plans);
    const summary = {
        dryRun: !args.apply,
        writes: false,
        scanned: rows.length,
        wouldUpdate: plans.length,
        withLightning: kinds.lightning,
        withPresence: kinds.presence
    };
    if (!args.apply) {
        console.log(JSON.stringify(summary));
        console.log('Dry run. Nothing was written. Pass --apply to write a backup and delete the fields.');
        return;
    }
    const file = backupPath(args);
    const backup = mirror.buildBackup(plans, new Date().toISOString());
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(backup, function (key, value) {
        if (value && typeof value.toMillis === 'function') return value.toMillis();
        if (value && typeof value === 'object' && typeof value._seconds === 'number') {
            return value._seconds * 1000 + Math.floor((Number(value._nanoseconds) || 0) / 1e6);
        }
        return value;
    }), { mode: 0o600 });
    const written = fs.statSync(file).size;
    if (!written) throw new Error('Backup file is empty. No profiles were changed.');
    const updated = await applyPlans(db, admin, plans);
    summary.writes = true;
    summary.updated = updated;
    summary.backupBytes = written;
    summary.backup = file;
    console.log(JSON.stringify(summary));
    console.log('Backup written before any profile update. Do not commit that file.');
}

if (require.main === module) {
    main().catch(function (err) {
        console.error(safeError(err));
        process.exit(1);
    });
}

module.exports = { backupPath: backupPath, countKinds: countKinds };
