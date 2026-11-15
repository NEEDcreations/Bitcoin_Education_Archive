#!/usr/bin/env node
'use strict';
// One-off backfill for the TCTV pot of sats (pot1, Nov 2026).
//
// Before the Nov 14 fix, the "Still watching?" tap was always rejected, so
// watch time on tctv_drip_watch froze, and under-3-day accounts stayed out
// for the whole pot. This raises tctv_drip_watch.seconds to the planned
// value (real recorded seconds, or a labeled estimate from the server
// lifetime watch counter) so the minute tick re-projects Your Share.
//
// Estimated rows are capped at 2 hours (7,200 s). Real recorded time is
// still capped at the pot's 8 h per-account limit.
//
// What it writes (live, only with --apply and BACKFILL_CONFIRM=pot1):
//   tctv_drip_watch/{potId}_{uid}: seconds (never lowered), ageOk,
//     acctCreatedMs (from Firebase Auth only), backfill {runId, source,
//     method, beforeSeconds, atMs}
//   tctv_drip_backfill_audit/{runId}_{uid}: one row per write (before/after)
//   tctv_drip_backfill_audit/{runId}: a run summary row, written first
//     (status: started) and updated when the run finishes, so a crash still
//     leaves a summary. This collection is permanent: keep it out of every
//     cleanup. Account deletion masks the uid and keeps the row.
// What it never touches: user balances (cipherSatsBalance), tctv_drip_payouts,
//   tctv_drip_history, tctv_drip_config/reserve, the public pot doc. No deletes.
// It moves no sats. The next pot payout (when the pot reaches its target)
// splits that pot using these seconds, through the existing payout path.
//
// Idempotent: seconds = max(current, planned), so re-running is a no-op
// and real watch time credited after the plan was made is never lost.
//
// Usage: node backfill_tctv_pot_seconds.js --plan plan.csv --project <id> [--exclude uids.txt] [--apply]
// --exclude is a file of uids (one per line, # comments ok). Those accounts
// are skipped. Re-adding a held account needs a separate reviewed run.
// Without --apply it prints what it would write and writes nothing.
// Creation time is read from Firebase Auth. A mismatch with the CSV
// created column refuses the run. The CSV time is never saved.

const fs = require('fs');

const ESTIMATE_CAP_SECONDS = 2 * 3600;
const PROTECTED_AUDIT_COLLECTION = 'tctv_drip_backfill_audit';

function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    const split = (line) => {
        const out = []; let cur = ''; let q = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
            else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
        }
        out.push(cur); return out;
    };
    const head = split(lines[0]);
    return lines.slice(1).map(l => { const v = split(l); const o = {}; head.forEach((h, i) => { o[h] = v[i]; }); return o; });
}

function parseExclude(text) {
    const set = new Set();
    String(text || '').split(/\r?\n/).forEach((line) => {
        const s = String(line || '').trim();
        if (!s || s.charAt(0) === '#') return;
        set.add(s.split(/\s+/)[0]);
    });
    return set;
}

function maskUid(uid) {
    const s = String(uid || '');
    return s ? s.slice(0, 6) + '…' : '(none)';
}

// Auth is the source of truth. A present, parseable CSV created value that
// disagrees at second precision refuses the run. The CSV time is never saved.
function resolveCreatedMs(row, authCreatedMs) {
    if (!(Number.isFinite(authCreatedMs) && authCreatedMs > 0)) {
        throw new Error('missing Auth creation time for ' + maskUid(row && row.uid));
    }
    const csv = Date.parse(row && row.created);
    if (row && row.created && Number.isFinite(csv) && Math.floor(csv / 1000) !== Math.floor(authCreatedMs / 1000)) {
        throw new Error('creation time mismatch for ' + maskUid(row.uid));
    }
    return authCreatedMs;
}

function plannedSeconds(row, limitSeconds) {
    let planned = Math.max(0, Math.floor(Number(row && row.backfill_seconds) || 0));
    if (row && row.source === 'estimate') planned = Math.min(planned, ESTIMATE_CAP_SECONDS);
    const limit = Math.max(0, Math.floor(Number(limitSeconds) || 0));
    return Math.min(planned, limit);
}

function isSkipped(row, excluded) {
    if (!row) return true;
    if (row.source === 'excluded' || row.source === 'held') return true;
    if (excluded && excluded.has(row.uid)) return true;
    return false;
}

// Pure: what to write for one plan row given the current watch doc.
// ctx.authCreatedMs must be the Firebase Auth creation time (ms).
function planWrite(existing, row, ctx) {
    const cur = existing || {};
    if (isSkipped(row, ctx && ctx.excluded)) return null;
    const createdMs = resolveCreatedMs(row, ctx && ctx.authCreatedMs);
    const planned = plannedSeconds(row, ctx.limitSeconds);
    const before = Math.max(0, Number(cur.seconds) || 0);
    const ageOk = Number.isFinite(createdMs) && createdMs > 0 && ctx.nowMs - createdMs >= ctx.minAgeMs;
    const seconds = Math.max(before, planned);
    const raise = ageOk && seconds > before;
    const flipAge = ageOk && cur.ageOk !== true;
    if (!raise && !flipAge) return null;
    if (!existing && seconds === 0) return null; // nothing to show; the next check-in creates the doc
    return { before, seconds: ageOk ? seconds : before, ageOk, createdMs };
}

async function main() {
    const args = process.argv.slice(2);
    const get = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : ''; };
    const apply = args.includes('--apply');
    const planPath = get('--plan'); const project = get('--project');
    const excludePath = get('--exclude');
    if (!planPath || !project) throw new Error('usage: --plan plan.csv --project <id> [--exclude uids.txt] [--apply]');
    if (apply && process.env.BACKFILL_CONFIRM !== 'pot1') throw new Error('refusing: set BACKFILL_CONFIRM=pot1 to apply');
    const admin = require('../src/firebaseAdmin.js');
    if (!admin.apps || !admin.apps.length) admin.initializeApp({ projectId: project });
    const db = admin.firestore(); const FV = admin.firestore.FieldValue;
    const logic = require('../src/tctvDripLogic');
    const cfg = logic.readConfig(((await db.collection('tctv_drip_config').doc('settings').get()).data()) || null);
    const pot = (await db.collection('tctv_drip_pot').doc('current').get()).data() || {};
    if (pot.potId !== 'pot1' || pot.status !== 'filling') throw new Error('refusing: pot is ' + pot.potId + '/' + pot.status + ', plan was made for pot1/filling');
    const rows = parseCsv(fs.readFileSync(planPath, 'utf8'));
    const excluded = excludePath ? parseExclude(fs.readFileSync(excludePath, 'utf8')) : new Set();
    const runId = 'bf_' + new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const baseCtx = { nowMs: Date.now(), limitSeconds: cfg.perAccountLimitSeconds, minAgeMs: cfg.minAccountAgeDays * 86400000, excluded };
    const authCreatedByUid = new Map();
    for (const row of rows) {
        if (isSkipped(row, excluded)) continue;
        let authCreatedMs = 0;
        try {
            const u = await admin.auth().getUser(row.uid);
            authCreatedMs = new Date(u.metadata.creationTime).getTime();
        } catch (e) {
            throw new Error('Auth creation time unavailable for ' + maskUid(row.uid));
        }
        resolveCreatedMs(row, authCreatedMs);
        authCreatedByUid.set(row.uid, authCreatedMs);
    }
    if (apply) {
        await db.collection(PROTECTED_AUDIT_COLLECTION).doc(runId).create({
            runId, kind: 'summary', status: 'started', writes: 0, secondsAdded: 0,
            rows: rows.length, excluded: excluded.size, at: FV.serverTimestamp()
        });
    }
    let n = 0, added = 0;
    for (const row of rows) {
        if (isSkipped(row, excluded)) {
            console.log('SKIP ' + maskUid(row.uid) + ' (held/excluded)');
            continue;
        }
        const wRef = db.collection('tctv_drip_watch').doc('pot1_' + row.uid);
        const aRef = db.collection(PROTECTED_AUDIT_COLLECTION).doc(runId + '_' + row.uid);
        const ctx = Object.assign({}, baseCtx, { authCreatedMs: authCreatedByUid.get(row.uid) });
        const done = await db.runTransaction(async (tx) => {
            const snap = await tx.get(wRef);
            const w = planWrite(snap.exists ? snap.data() : null, row, ctx);
            if (!w) return null;
            if (!apply) return w;
            tx.set(wRef, { uid: row.uid, potId: 'pot1', seconds: w.seconds, ageOk: true, acctCreatedMs: w.createdMs,
                backfill: { runId, source: row.source, method: String(row.method || '').slice(0, 200), beforeSeconds: w.before, atMs: ctx.nowMs } }, { merge: true });
            tx.create(aRef, { runId, uid: row.uid, potId: 'pot1', beforeSeconds: w.before, afterSeconds: w.seconds, source: row.source,
                method: String(row.method || '').slice(0, 200), createdDoc: !snap.exists, at: FV.serverTimestamp() });
            return w;
        });
        if (done) { n++; added += done.seconds - done.before; console.log((apply ? 'WROTE ' : 'WOULD ') + maskUid(row.uid) + ' ' + done.before + ' -> ' + done.seconds + ' (' + row.source + ')'); }
    }
    if (apply) {
        await db.collection(PROTECTED_AUDIT_COLLECTION).doc(runId).set({
            status: 'done', writes: n, secondsAdded: added, finishedAt: FV.serverTimestamp()
        }, { merge: true });
    }
    console.log((apply ? 'applied ' : 'dry run: would write ') + n + ' docs, +' + added + ' seconds, run ' + runId + (excluded.size ? (', excluded ' + excluded.size) : ''));
}

module.exports = {
    parseCsv, parseExclude, planWrite, resolveCreatedMs, plannedSeconds, isSkipped,
    ESTIMATE_CAP_SECONDS, PROTECTED_AUDIT_COLLECTION, maskUid
};
if (require.main === module) main().then(() => process.exit(0), (e) => { console.error(e.message); process.exit(1); });
