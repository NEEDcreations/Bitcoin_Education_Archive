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
 *                               when the currently open epoch fills 5/5)
 *   lastRetargetEpochClosedMs = when that epoch closed (= open epoch start),
 *                               from sfPoolHistory, cross-checked against
 *                               satoshiFavor/poolEpoch.startedAt
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
 *   node scripts/migrate-favor-epoch-retarget.js --last-epoch=6 --apply  # pin the anchor epoch
 *
 * Auth is Application Default Credentials. No key file is read from the repo.
 * Needs Security Team sign-off and Phil's OK before --apply on the live project.
 */
'use strict';

const path = require('path');

const APPLY = process.argv.includes('--apply');
function arg(name) {
  const hit = process.argv.find((a) => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
}
const PROJECT_ID = arg('project') || 'bitcoin-education-archive';
const PIN_LAST = arg('last-epoch');

function loadAdmin() {
  try { return require('firebase-admin'); }
  catch (e) { return require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin')); }
}
const fd = require(path.join(__dirname, '..', 'functions', 'src', 'favorDifficulty'));

function ms(v) { return v && typeof v.toMillis === 'function' ? v.toMillis() : (Number(v) || 0); }
function et(t) { return t ? new Date(t).toLocaleString('en-US', { timeZone: 'America/New_York' }) + ' ET' : 'n/a'; }

async function main() {
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
  const lastEpoch = PIN_LAST != null ? Number(PIN_LAST) : openEpoch - 1;
  if (!Number.isInteger(lastEpoch) || lastEpoch < 1) throw new Error('refusing: bad lastRetargetEpoch ' + PIN_LAST);
  if (lastEpoch >= openEpoch) throw new Error('refusing: lastRetargetEpoch ' + lastEpoch + ' must be below the open epoch ' + openEpoch);
  if (lastEpoch !== openEpoch - 1) console.warn('WARNING: epochs ' + (lastEpoch + 1) + '..' + (openEpoch - 1) + ' already closed; the first retarget will count them together with the open epoch.');

  const hist = await db.collection('sfPoolHistory').where('epochNumber', '==', lastEpoch).get();
  let closedMs = 0;
  hist.forEach((d) => { const t = ms((d.data() || {}).completedAt); if (t && (!closedMs || t < closedMs)) closedMs = t; });
  if (!closedMs && lastEpoch === openEpoch - 1) closedMs = openStartMs;
  if (!closedMs) throw new Error('refusing: no close time for epoch ' + lastEpoch);
  if (lastEpoch === openEpoch - 1 && openStartMs && Math.abs(openStartMs - closedMs) > 60000) {
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
  const ifNow = fd.planRetarget({ currentTarget: fd.validTarget(cfg.target) || 25000, epochDurationMs: now - closedMs, epochs: openEpoch - lastEpoch });

  console.log('current target:', cfg.target, '(1 in ' + Math.round(fd.HASH_SPACE / cfg.target).toLocaleString('en-US') + ')');
  console.log('open epoch: #' + openEpoch + ', ' + blocks + '/5 blocks, started ' + et(openStartMs) + ' (' + elapsedDays.toFixed(2) + ' days ago)');
  console.log('first retarget: when epoch #' + (lastEpoch + 1) + (openEpoch - lastEpoch > 1 ? '..#' + openEpoch : '') + ' fills 5/5, measured from ' + et(closedMs));
  console.log('if it closed now:', JSON.stringify(ifNow));
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

main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
