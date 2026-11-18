#!/usr/bin/env node
'use strict';
// QA seeder for Satoshi's Favor per-block self-claims. STAGING ONLY.
//
// Adds ONE new fake archived epoch to sfPoolHistory on bitcoin-quest-staging,
// sets fake Lightning addresses on the named test accounts, freezes the epoch
// through the same create-only freezeEpoch the admin backfill uses, and adds
// the epoch to enabledEpochs (merge; nothing else in config is changed).
// It never edits or deletes an existing history doc, payout record, audit
// row or config doc. It refuses to run on any project but staging, checked
// before the first write.
//
// Usage (staging-tester key in GOOGLE_APPLICATION_CREDENTIALS):
//   node scripts/staging/seed-favor-winners.js --project bitcoin-quest-staging \
//     --epoch 2 --winners uidA,uidA,uidB,uidC,uidD \
//     [--ln uidA=a@staging.test] [--ln-late uidB=b@staging.test] [--no-ln uidC] \
//     [--make-fakes 3]        (create N aged fake accounts; prints their masked uids)
//   Prefix matching: a winner may be given as "prefix…" (must match exactly one Auth user).
//   --ln       address saved with a lock dated BEFORE the close (a normal winner)
//   --ln-late  address saved with a lock dated NOW, after the close (M2 backfill case)
//   --no-ln    winner has no Lightning address at close (no_address review)
//   --dry-run  print the plan, write nothing

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STAGING = 'bitcoin-quest-staging';
function die(msg) { console.error('REFUSED: ' + msg); process.exit(2); }

function args(argv) {
    const o = { ln: [], lnLate: [], noLn: [], winners: [], makeFakes: 0, dryRun: false };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        const v = function () { if (i + 1 >= argv.length) die('missing value for ' + a); return argv[++i]; };
        if (a === '--project') o.project = v();
        else if (a === '--epoch') o.epoch = v();
        else if (a === '--winners') o.winners = v().split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        else if (a === '--ln') o.ln.push(v());
        else if (a === '--ln-late') o.lnLate.push(v());
        else if (a === '--no-ln') o.noLn.push(v());
        else if (a === '--make-fakes') o.makeFakes = Number(v());
        else if (a === '--dry-run') o.dryRun = true;
        else die('unknown argument ' + a);
    }
    return o;
}

// Every source of the project id must say staging, or we stop.
function resolveProject(o) {
    const ids = [];
    ids.push(o.project || '');
    ids.push(process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '');
    const cred = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';
    if (!cred) die('GOOGLE_APPLICATION_CREDENTIALS is not set (use the staging-tester key)');
    let key = {};
    try { key = JSON.parse(fs.readFileSync(cred, 'utf8')); } catch (e) { die('cannot read the credentials file'); }
    ids.push(key.project_id || '');
    if (process.env.FIREBASE_SA_JSON) die('FIREBASE_SA_JSON is set; unset it first');
    const set = Array.from(new Set(ids));
    const project = set.length === 1 ? set[0] : 'MIXED(' + set.join(',') + ')';
    return project;
}

function mask(uid) { return String(uid).slice(0, 6) + '\u2026'; }
function maskLn(a) { return String(a).replace(/^(.{3}).*@/, '$1\u2026@'); }
function pair(s) {
    const i = String(s).indexOf('=');
    if (i < 1) die('expected uid=address, got ' + s);
    return [s.slice(0, i), s.slice(i + 1).trim().toLowerCase()];
}

async function main() {
    const o = args(process.argv);
    const project = resolveProject(o);
    if (project !== STAGING) die('project is ' + project + '; this seeder only runs on ' + STAGING);
    process.env.GCLOUD_PROJECT = STAGING;

    const epoch = Number(o.epoch);
    if (!Number.isInteger(epoch) || epoch < 1 || epoch > 9999) die('bad --epoch');

    const admin = require(path.join(__dirname, '../../functions/src/firebaseAdmin.js'));
    admin.initializeApp({ projectId: STAGING });
    if (admin.app().options.projectId !== STAGING) die('admin app project is not staging');
    const db = admin.firestore();
    const core = require(path.join(__dirname, '../../functions/src/favorBlockClaims.js'));

    // Resolve prefixes against staging Auth (each must match exactly one user).
    const all = [];
    let tok;
    do { const l = await admin.auth().listUsers(1000, tok); all.push.apply(all, l.users); tok = l.pageToken; } while (tok);
    function resolveUid(s) {
        const p = String(s).replace(/(\u2026|\.\.\.)$/, '');
        const hits = all.filter(function (u) { return s.endsWith('\u2026') || s.endsWith('...') ? u.uid.indexOf(p) === 0 : u.uid === p; });
        if (hits.length !== 1) die('"' + s + '" matches ' + hits.length + ' staging accounts (need exactly 1)');
        return hits[0];
    }

    // Optional: fresh aged fake accounts (import lets us date creation 10 days back).
    const fakes = [];
    if (o.makeFakes > 0) {
        if (o.makeFakes > 10) die('at most 10 fakes');
        const created = new Date(Date.now() - 10 * 86400000).toUTCString();
        const recs = [];
        for (let i = 0; i < o.makeFakes; i++) {
            const id = 'sfFake311' + crypto.randomBytes(6).toString('hex');
            recs.push({ uid: id, email: 'sf-' + id.toLowerCase() + '@staging.test', emailVerified: true,
                metadata: { creationTime: created, lastSignInTime: created },
                providerData: [{ uid: 'sf-' + id.toLowerCase() + '@staging.test', email: 'sf-' + id.toLowerCase() + '@staging.test', providerId: 'password' }] });
        }
        if (!o.dryRun) {
            const r = await admin.auth().importUsers(recs);
            if (r.failureCount) die('importUsers failed for ' + r.failureCount);
            for (const rec of recs) {
                await db.collection('users').doc(rec.uid).set({ username: 'qa' + rec.uid.slice(-6), qaSeed: true, createdAt: admin.firestore.Timestamp.fromDate(new Date(created)) }, { merge: true });
            }
        }
        recs.forEach(function (r) { fakes.push(r.uid); console.log('  fake ' + mask(r.uid) + ' (' + r.uid + ')'); });
        if (o.dryRun) return;
        all.push.apply(all, (await Promise.all(recs.map(function (r) { return admin.auth().getUser(r.uid); }))));
    }

    if (o.winners.length !== core.BLOCKS_PER_EPOCH) die('need exactly ' + core.BLOCKS_PER_EPOCH + ' --winners');
    const winners = o.winners.map(function (w) { return /^fake(\d)$/.test(w) ? fakes[Number(w.slice(4))] : w; }).map(function (w) {
        if (!w) die('fakeN refers to a fake that was not made');
        return resolveUid(w).uid;
    });
    function uidOf(s) { return /^fake(\d)$/.test(s) ? fakes[Number(s.slice(4))] : resolveUid(s).uid; }
    const lnEarly = o.ln.map(pair).map(function (p) { return [uidOf(p[0]), p[1]]; });
    const lnLate = o.lnLate.map(pair).map(function (p) { return [uidOf(p[0]), p[1]]; });
    const noLn = o.noLn.map(uidOf);
    [].concat(lnEarly, lnLate).forEach(function (p) { if (!core.validLn(p[1])) die('bad address for ' + mask(p[0])); });

    // Never edit an existing epoch.
    const existing = await db.collection('sfPoolHistory').where('epochNumber', '==', epoch).get();
    if (!existing.empty) {
        const same = existing.size === 1 && JSON.stringify((existing.docs[0].data().blocks || []).map(function (b) { return b.uid; })) === JSON.stringify(winners);
        if (!same) die('epoch ' + epoch + ' already exists with other winners; pick a new epoch number');
        console.log('  epoch ' + epoch + ' already seeded with these winners; only re-checking the freeze');
    }

    const closedMs = Date.now() - 3600 * 1000;
    console.log('Project: ' + project + (o.dryRun ? ' (dry run)' : ''));
    winners.forEach(function (u, i) { console.log('  block ' + i + ' -> ' + mask(u)); });
    if (o.dryRun) return;

    // Addresses + locks (fake staging accounts only).
    const Timestamp = admin.firestore.Timestamp;
    async function setLn(uid, ln, lockMs) {
        await db.collection('users').doc(uid).set({ lightningAddress: ln }, { merge: true });
        const lockRef = db.collection('lightning_addresses').doc(ln);
        const lock = await lockRef.get();
        if (!lock.exists) await lockRef.set({ uid: uid, address: ln, lockedAt: Timestamp.fromMillis(lockMs), qaSeed: true });
        console.log('  ' + mask(uid) + ' LN ' + maskLn(ln) + (lock.exists ? ' (lock already held by ' + mask(lock.data().uid) + ')' : ' lock ' + (lockMs < closedMs ? 'before' : 'after') + ' close'));
    }
    for (const p of lnEarly) await setLn(p[0], p[1], closedMs - 2 * 3600 * 1000);
    for (const p of lnLate) await setLn(p[0], p[1], Date.now());
    for (const u of noLn) {
        await db.collection('users').doc(u).set({ lightningAddress: '', lightning: '', lnAddress: '' }, { merge: true });
        console.log('  ' + mask(u) + ' no LN address at close');
    }

    if (existing.empty) {
        const doc = {
            epochNumber: epoch,
            blocks: winners.map(function (u, i) { return { uid: u, username: 'qa' + i, value: 'qa', foundAt: Timestamp.fromMillis(closedMs - (5 - i) * 60000) }; }),
            completedAt: Timestamp.fromMillis(closedMs),
            totalSats: core.EPOCH_POT_SATS,
            qaSeed: true,
        };
        await db.collection('sfPoolHistory').doc().set(doc);
        console.log('  - sfPoolHistory epoch ' + epoch + ': create (qaSeed)');
    }
    const svc = core.createBlockClaimService({ db: db, nowMs: Date.now });
    const fr = await svc.freezeEpoch(epoch, { source: 'backfill' });
    if (!fr.ok) die('freeze failed: ' + (fr.reason || 'unknown'));
    console.log('  freeze: ' + (fr.created ? 'created' : 'existed'));
    (fr.result.blocks || []).forEach(function (b) {
        console.log('    block ' + b.block + ' ' + mask(b.uid) + ' ' + b.amount + ' sats -> ' + (b.frozenLn ? maskLn(b.frozenLn) : '(none)') + (b.manualReview ? ' [review: ' + b.manualReview + ']' : ''));
    });
    // Open the epoch for claims: append only, merge, nothing else changes.
    await db.collection('config').doc('satoshiFavorPayouts').set({ enabledEpochs: admin.firestore.FieldValue.arrayUnion(epoch) }, { merge: true });
    await db.collection('sf_claim_audit').add({ type: 'qa_seed', epoch: epoch, atMs: Date.now(), blocks: winners.map(mask) });
    console.log('  config/satoshiFavorPayouts.enabledEpochs += ' + epoch);
    console.log('Seeded.');
}

main().then(function () { process.exit(0); }).catch(function (e) { console.error('ERR ' + (e && e.message)); process.exit(1); });
