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
// What it writes (live, only with --apply and BACKFILL_CONFIRM=pot1):
//   tctv_drip_watch/{potId}_{uid}: seconds (never lowered), ageOk,
//     acctCreatedMs, backfill {runId, source, method, beforeSeconds, atMs}
//   tctv_drip_backfill_audit/{runId}_{uid}: one row per write (before/after)
//   tctv_drip_backfill_audit/{runId}: a run summary row
// What it never touches: user balances (cipherSatsBalance), tctv_drip_payouts,
//   tctv_drip_history, tctv_drip_config/reserve, the public pot doc. No deletes.
// It moves no sats. The next pot payout (when the pot reaches its target)
// splits that pot using these seconds, through the existing payout path.
//
// Idempotent: seconds = max(current, planned), so re-running is a no-op
// and real watch time credited after the plan was made is never lost.
//
// Usage: node backfill_tctv_pot_seconds.js --plan plan.csv --project <id> [--apply]
// Without --apply it prints what it would write and writes nothing.

const fs = require('fs');

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

// Pure: what to write for one plan row given the current watch doc.
function planWrite(existing, row, ctx) {
    const cur = existing || {};
    if (row.source === 'excluded') return null;
    const planned = Math.max(0, Math.min(ctx.limitSeconds, Math.floor(Number(row.backfill_seconds) || 0)));
    const before = Math.max(0, Number(cur.seconds) || 0);
    const createdMs = Date.parse(row.created) || Number(cur.acctCreatedMs) || 0;
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
    if (!planPath || !project) throw new Error('usage: --plan plan.csv --project <id> [--apply]');
    if (apply && process.env.BACKFILL_CONFIRM !== 'pot1') throw new Error('refusing: set BACKFILL_CONFIRM=pot1 to apply');
    const admin = require('../src/firebaseAdmin.js');
    if (!admin.apps || !admin.apps.length) admin.initializeApp({ projectId: project });
    const db = admin.firestore(); const FV = admin.firestore.FieldValue;
    const logic = require('../src/tctvDripLogic');
    const cfg = logic.readConfig(((await db.collection('tctv_drip_config').doc('settings').get()).data()) || null);
    const pot = (await db.collection('tctv_drip_pot').doc('current').get()).data() || {};
    if (pot.potId !== 'pot1' || pot.status !== 'filling') throw new Error('refusing: pot is ' + pot.potId + '/' + pot.status + ', plan was made for pot1/filling');
    const rows = parseCsv(fs.readFileSync(planPath, 'utf8'));
    const runId = 'bf_' + new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const ctx = { nowMs: Date.now(), limitSeconds: cfg.perAccountLimitSeconds, minAgeMs: cfg.minAccountAgeDays * 86400000 };
    let n = 0, added = 0;
    for (const row of rows) {
        const wRef = db.collection('tctv_drip_watch').doc('pot1_' + row.uid);
        const aRef = db.collection('tctv_drip_backfill_audit').doc(runId + '_' + row.uid);
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
        if (done) { n++; added += done.seconds - done.before; console.log((apply ? 'WROTE ' : 'WOULD ') + String(row.uid).slice(0, 4) + '… ' + done.before + ' -> ' + done.seconds + ' (' + row.source + ')'); }
    }
    if (apply) await db.collection('tctv_drip_backfill_audit').doc(runId).create({ runId, kind: 'summary', writes: n, secondsAdded: added, rows: rows.length, at: FV.serverTimestamp() });
    console.log((apply ? 'applied ' : 'dry run: would write ') + n + ' docs, +' + added + ' seconds, run ' + runId);
}

module.exports = { parseCsv, planWrite };
if (require.main === module) main().then(() => process.exit(0), (e) => { console.error(e.message); process.exit(1); });
