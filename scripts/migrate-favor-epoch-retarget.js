#!/usr/bin/env node
/**
 * One-time config migration for the epoch-based Satoshi's Favor retarget
 * (Phil, Nov 12 2026 3:41 AM ET). Run it right AFTER the functions deploy
 * that ships functions/src/favorDifficulty.js with runRetarget-by-epoch, and
 * before Sat Nov 21 2026 12:10 AM ET is no longer a concern (the new code has
 * no time-based retarget at all; until this runs it only logs not_migrated).
 *
 * What it changes in payout_config/favorDifficulty (merge, nothing removed):
 *   lastRetargetEpoch         = open epoch - 1 (so the FIRST retarget happens
 *                               when the currently open epoch fills 5/5).
 *                               If the open epoch is #1, this is 0, and the
 *                               baseline is poolEpoch.startedAt.
 *   lastRetargetEpochClosedMs = when that epoch closed (= open epoch start),
 *                               from sfPoolHistory, cross-checked against
 *                               satoshiFavor/poolEpoch.startedAt (or the
 *                               open epoch start when lastRetargetEpoch is 0)
 *   retargetRule              = 'epoch'
 *   targetEpochDays           = 14
 *   nextRetargetMs            = null (the old 14-day clock; nothing reads it now)
 *   budget                    = { monthlyTotal: 100000, favor: 45000, other: 55000 }
 *   epochMigration            = { atMs, openEpoch, lastRetargetEpoch, fromRule }
 * Unchanged: target, previous, label, lastRetargetMs, history.
 * It also merges the public mirror satoshiFavor/difficultyStats.config
 * (nextRetargetEpoch, retargetRule, nextRetargetMs: null).
 *
 * It never writes or deletes epoch records (satoshiFavor/poolEpoch,
 * sfPoolHistory) and never pays anything. It prints no uids or names.
 *
 * Dry-run is the default and writes nothing. --apply writes in one
 * transaction that re-checks the config is still unmigrated and the open
 * epoch number has not changed since the read.
 *
 *   node scripts/migrate-favor-epoch-retarget.js                       # dry run, live project
 *   node scripts/migrate-favor-epoch-retarget.js --project=bitcoin-quest-staging
 *   node scripts/migrate-favor-epoch-retarget.js --project=bitcoin-quest-staging --apply
 *   node scripts/migrate-favor-epoch-retarget.js --project=... --last-epoch=6 --apply
 *
 * --apply REQUIRES an explicit --project=<id>. It will refuse rather than
 * default to the live project.
 *
 * Auth is Application Default Credentials. No key file is read from the repo.
 * Needs Security Team sign-off and Phil's OK before --apply on the live project.
 *
 * RUNBOOK — rollback: after this migration (or any later epoch retarget that
 * updates lastRetargetMs), rolling back to the old 14-day-clock code would
 * fire a clock retarget 14 days after lastRetargetMs. The old job treats a
 * missing nextRetargetMs as lastRetargetMs + 14 days. Do not roll back after
 * migrate or after a live epoch retarget without a plan for that clock.
 */
'use strict';

const path = require('path');

const APPLY = process.argv.includes('--apply');
function arg(name) {
  const hit = process.argv.find((a) => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
}
const PROJECT_FLAG = arg('project');
const PROJECT_ID = PROJECT_FLAG || 'bitcoin-education-archive';
const PIN_LAST = arg('last-epoch');

// firebase-admin 14 dropped admin.apps / admin.firestore() on the default
// export. functions/src/firebaseAdmin.js restores that surface.
function loadAdmin() {
  return require(path.join(__dirname, '..', 'functions', 'src', 'firebaseAdmin'));
}
const fd = require(path.join(__dirname, '..', 'functions', 'src', 'favorDifficulty'));

function ms(v) { return v && typeof v.toMillis === 'function' ? v.toMillis() : (Number(v) || 0); }
function et(t) { return t ? new Date(t).toLocaleString('en-US', { timeZone: 'America/New_York' }) + ' ET' : 'n/a'; }

// Pure helper (unit-tested). lastRetargetEpoch may be 0 when the open epoch is #1.
function resolveAnchor(input) {
  const src = input || {};
  const openEpoch = Number(src.openEpoch) || 1;
  const openStartMs = Number(src.openStartMs) || 0;
  const pinLast = src.pinLast;
  const historyClosedMs = Number(src.historyClosedMs) || 0;
  const lastEpoch = pinLast != null && pinLast !== '' ? Number(pinLast) : openEpoch - 1;
  if (!Number.isInteger(lastEpoch) || lastEpoch < 0) {
    throw new Error('refusing: bad lastRetargetEpoch ' + pinLast);
  }
  if (lastEpoch >= openEpoch) {
    throw new Error('refusing: lastRetargetEpoch ' + lastEpoch + ' must be below the open epoch ' + openEpoch);
  }
  let closedMs = historyClosedMs;
  if (!closedMs && lastEpoch === openEpoch - 1) closedMs = openStartMs;
  if (!closedMs && lastEpoch === 0) closedMs = openStartMs;
  if (!closedMs) throw new Error('refusing: no close time for epoch ' + lastEpoch);
  return { lastEpoch: lastEpoch, closedMs: closedMs, openEpoch: openEpoch };
}

async function main() {
  if (APPLY && !PROJECT_FLAG) {
    throw new Error('refusing: --apply requires an explicit --project=<id> (never defaults to the live project)');
  }
  const admin = loadAdmin();
  if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
  const db = admin.firestore();
  const cfgRef = db.collection('payout_config').doc('favorDifficulty');
  const epochRef = db.collection('satoshiFavor').doc('poolEpoch');
  const [cfgSnap, epochSnap] = await Promise.all([cfgRef.get(), epochRef.get()]);
  console.log('project:', PROJECT_ID, APPLY ? '(APPLY)' : '(dry run)');
  if (!cfgSnap.exists) throw new Error('refusing: payout_config/favorDifficulty is missing');
  const cfg = cfgSnap.data() || {};
  if (Number.isInteger(cfg.lastRetargetEpoch)) throw new Error('refusing: already migrated (lastRetargetEpoch = ' + cfg.lastRetargetEpoch + ')');
  if (!epochSnap.exists) throw new Error('refusing: satoshiFavor/poolEpoch is missing');
  const pe = epochSnap.data() || {};
  const openEpoch = Number(pe.epochNumber) || 1;
  const openStartMs = ms(pe.startedAt);
  const blocks = Array.isArray(pe.blocks) ? pe.blocks.length : 0;

  const lastEpochGuess = PIN_LAST != null ? Number(PIN_LAST) : openEpoch - 1;
  const hist = await db.collection('sfPoolHistory').where('epochNumber', '==', lastEpochGuess).get();
  let historyClosedMs = 0;
  hist.forEach((d) => { const t = ms((d.data() || {}).completedAt); if (t && (!historyClosedMs || t < historyClosedMs)) historyClosedMs = t; });

  const anchor = resolveAnchor({ openEpoch: openEpoch, openStartMs: openStartMs, pinLast: PIN_LAST, historyClosedMs: historyClosedMs });
  const lastEpoch = anchor.lastEpoch;
  const closedMs = anchor.closedMs;
  if (lastEpoch !== openEpoch - 1) {
    console.warn('WARNING: epochs ' + (lastEpoch + 1) + '..' + (openEpoch - 1) + ' already closed; the first retarget will apply one clamped step per already-closed epoch, then another when the open epoch fills.');
  }
  if (lastEpoch === openEpoch - 1 && lastEpoch !== 0 && openStartMs && Math.abs(openStartMs - closedMs) > 60000) {
    console.warn('WARNING: sfPoolHistory close (' + et(closedMs) + ') and poolEpoch.startedAt (' + et(openStartMs) + ') differ by more than 60 s; using sfPoolHistory.');
  }

  const now = Date.now();
  const update = {
    lastRetargetEpoch: lastEpoch,
    lastRetargetEpochClosedMs: closedMs,
    retargetRule: 'epoch',
    targetEpochDays: fd.TARGET_EPOCH_DAYS,
    nextRetargetMs: null,
    budget: { monthlyTotal: fd.MONTHLY_TOTAL, favor: fd.FAVOR_BUDGET, other: fd.OTHER_BUDGET },
    epochMigration: { atMs: now, openEpoch: openEpoch, lastRetargetEpoch: lastEpoch, fromRule: '14-day clock', by: 'Phil, Nov 12 2026 3:41 AM ET' },
  };
  const pub = { config: fd.publicConfig(Object.assign({}, cfg, update)) };
  const elapsedDays = (now - closedMs) / fd.DAY_MS;
  const ifNow = fd.planRetarget({ currentTarget: fd.validTarget(cfg.target) || 25000, epochDurationMs: now - closedMs, epochs: 1 });

  console.log('current target:', cfg.target, '(1 in ' + Math.round(fd.HASH_SPACE / cfg.target).toLocaleString('en-US') + ')');
  console.log('open epoch: #' + openEpoch + ', ' + blocks + '/5 blocks, started ' + et(openStartMs) + ' (' + elapsedDays.toFixed(2) + ' days ago)');
  console.log('first retarget: when epoch #' + (lastEpoch + 1) + (openEpoch - lastEpoch > 1 ? '..#' + openEpoch : '') + ' fills 5/5, measured from ' + et(closedMs) + (openEpoch - lastEpoch > 1 ? ', one clamped step per epoch' : ''));
  console.log('if the next epoch closed now (single step):', JSON.stringify(ifNow));
  console.log('MERGE payout_config/favorDifficulty =', JSON.stringify(update));
  console.log('MERGE satoshiFavor/difficultyStats =', JSON.stringify(pub));
  if (!APPLY) { console.log('DRY RUN: nothing written. Re-run with --apply after Security sign-off and Phil\'s OK.'); return; }

  await db.runTransaction(async (t) => {
    const [c, e] = await Promise.all([t.get(cfgRef), t.get(epochRef)]);
    if (!c.exists) throw new Error('refusing: config disappeared');
    if (Number.isInteger((c.data() || {}).lastRetargetEpoch)) throw new Error('refusing: already migrated');
    if ((Number((e.data() || {}).epochNumber) || 1) !== openEpoch) throw new Error('refusing: open epoch changed since the read; re-run the dry run');
    t.set(cfgRef, update, { merge: true });
    t.set(db.collection('satoshiFavor').doc('difficultyStats'), pub, { merge: true });
  });
  console.log('APPLIED');
}

if (require.main === module) {
  main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
}

module.exports = { resolveAnchor, arg, APPLY };
