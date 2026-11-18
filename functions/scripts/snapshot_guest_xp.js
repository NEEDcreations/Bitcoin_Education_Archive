'use strict';
/**
 * Read-only snapshot of every anonymous (guest) account's balances as of now.
 * Anonymous = Firebase Auth user with no sign-in provider. ln: and nostr:
 * custom-token accounts are signed in and are skipped.
 *
 * Writes one private JSON file (full uids, mode 0600) to the output folder and
 * prints only counts and masked uids. Writes nothing to Firestore or Auth.
 *
 *   FIREBASE_SA_JSON=... node functions/scripts/snapshot_guest_xp.js \
 *     [--out /workspace/private/guest-xp-snapshot-20261118]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

if (process.argv.indexOf('--apply') !== -1) {
    console.error('Refusing --apply. This script is read-only.');
    process.exit(2);
}

const DEFAULT_OUT = '/workspace/private/guest-xp-snapshot-20261118';

function argValue(name) {
    const i = process.argv.indexOf(name);
    return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : '';
}

function maskUid(uid) {
    return String(uid || '').slice(0, 4) + '…';
}

function isCustomTokenUid(uid) {
    return /^(ln|nostr):/.test(String(uid || ''));
}

function isGuestRecord(rec) {
    if (!rec || isCustomTokenUid(rec.uid)) return false;
    return !(Array.isArray(rec.providerData) && rec.providerData.length > 0);
}

function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function rowFor(uid, data, authRec) {
    const d = data || {};
    return {
        uid: uid,
        points: num(d.points),
        orangeTickets: num(d.orangeTickets),
        weeklyXP: num(d.weeklyXP),
        monthlyXP: num(d.monthlyXP),
        unclaimableXp: num(d.unclaimableXp),
        pointsClaimed: num(d.pointsClaimed),
        hasUsername: !!d.username,
        mergedInto: !!d.mergedInto,
        authCreated: authRec && authRec.metadata ? authRec.metadata.creationTime : null,
        lastSignIn: authRec && authRec.metadata ? authRec.metadata.lastSignInTime : null,
    };
}

function loadCreds() {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return null;
    const raw = process.env.FIREBASE_SA_JSON;
    if (!raw) throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SA_JSON');
    const tmp = path.join(os.tmpdir(), 'bq-guest-snapshot-' + process.pid + '.json');
    fs.writeFileSync(tmp, raw, { mode: 0o600 });
    process.env.GOOGLE_APPLICATION_CREDENTIALS = tmp;
    return tmp;
}

async function main() {
    const outDir = argValue('--out') || DEFAULT_OUT;
    const tmp = loadCreds();
    try {
        const admin = require('../src/firebaseAdmin.js');
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.applicationDefault(),
                projectId: 'bitcoin-education-archive',
            });
        }
        const db = admin.firestore();
        const takenAt = new Date();
        const guests = [];
        let pageToken;
        let authUsers = 0;
        do {
            const page = await admin.auth().listUsers(1000, pageToken);
            authUsers += page.users.length;
            page.users.forEach(function (rec) { if (isGuestRecord(rec)) guests.push(rec); });
            pageToken = page.pageToken;
        } while (pageToken);

        const rows = [];
        for (let i = 0; i < guests.length; i += 300) {
            const chunk = guests.slice(i, i + 300);
            const snaps = await db.getAll.apply(db, chunk.map(function (rec) { return db.collection('users').doc(rec.uid); }));
            snaps.forEach(function (snap, j) {
                const row = rowFor(chunk[j].uid, snap.exists ? snap.data() : null, chunk[j]);
                if (!snap.exists) row.noUserDoc = true;
                rows.push(row);
            });
        }
        const totals = rows.reduce(function (t, r) {
            t.points += r.points; t.orangeTickets += r.orangeTickets;
            t.weeklyXP += r.weeklyXP; t.monthlyXP += r.monthlyXP;
            if (r.points > 0) t.withXp++;
            if (r.orangeTickets > 0) t.withTickets++;
            if (r.hasUsername) t.withUsername++;
            if (r.noUserDoc) t.noUserDoc++;
            return t;
        }, { points: 0, orangeTickets: 0, weeklyXP: 0, monthlyXP: 0, withXp: 0, withTickets: 0, withUsername: 0, noUserDoc: 0 });

        fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
        const file = path.join(outDir, 'guest-xp-snapshot-' + takenAt.toISOString().replace(/[:.]/g, '-') + '.json');
        fs.writeFileSync(file, JSON.stringify({
            takenAt: takenAt.toISOString(),
            project: 'bitcoin-education-archive',
            authUsersScanned: authUsers,
            guestAccounts: rows.length,
            totals: totals,
            rows: rows,
        }, null, 1), { mode: 0o600, flag: 'wx' });

        const top = rows.slice().sort(function (a, b) { return b.points - a.points; }).slice(0, 5)
            .map(function (r) { return maskUid(r.uid) + ' ' + r.points + ' XP'; });
        console.log(JSON.stringify({
            takenAt: takenAt.toISOString(),
            authUsersScanned: authUsers,
            guestAccounts: rows.length,
            totals: totals,
            topByXpMasked: top,
            file: file,
        }, null, 1));
    } finally {
        if (tmp) { try { fs.unlinkSync(tmp); } catch (e) { /* ignore */ } }
    }
}

if (require.main === module) {
    main().catch(function (err) {
        console.error('[guest-snapshot] failed:', err && err.message ? String(err.message).slice(0, 200) : err);
        process.exit(1);
    });
}

module.exports = { isGuestRecord, isCustomTokenUid, maskUid, rowFor };
