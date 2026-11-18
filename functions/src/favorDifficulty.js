'use strict';
// Satoshi's Favor difficulty: live target + Bitcoin-style retarget per epoch.
//
// Server-only config doc: payout_config/favorDifficulty (rules: default deny,
// clients can neither read nor write it). Public mirror for the app:
// satoshiFavor/difficultyStats.config (that doc is public-read, client-write
// false; it already only receives merge writes).
//
// Hash wins when value < target, so a BIGGER target is EASIER.
// Difficulty = odds = HASH_SPACE / target. History % is the DIFFICULTY change:
//   (newDifficulty - oldDifficulty) / oldDifficulty * 100 = (oldTarget / newTarget - 1) * 100
// e.g. 20,000 -> 25,000 is -20% (odds 1 in 5,000 -> 1 in 4,000).
//
// Retarget rule (Phil, Nov 12 2026 3:41 AM ET), like Bitcoin:
//   - The target only moves when an epoch fills 5/5 blocks. There is NO
//     time-based retarget any more (the old 14-day clock is gone).
//   - Aim: one 21,000-sat epoch about every TARGET_EPOCH_DAYS (14) days.
//   - newTarget = currentTarget * (actualEpochDuration / 14 days), factor
//     clamped to [1/4, 4] PER CLOSED EPOCH, then to [MIN_TARGET, MAX_TARGET].
//     If several epochs closed since lastRetargetEpoch, each is its own
//     step, applied in order. N fast epochs can move up to 4^N harder
//     (still bounded by MIN_TARGET/MAX_TARGET). Faster than 14 days ->
//     smaller target -> harder. Slower -> easier.
//   - Faucet and other payouts no longer feed the formula.
// Budget (Phil, Nov 12 2026): app-wide 100,000 sats/month =
//   45,000 Satoshi's Favor + 55,000 everything else.
//   21,000 sats per 14 days = 45,000 per 30 days, so the 14-day aim IS the Favor budget.
// The scheduled job checks every 30 minutes; a retarget still only happens
// when a new epoch has closed (idempotent per epoch).
//
// Epoch records: satoshiFavor/poolEpoch is the open epoch; each full epoch is
// archived once to sfPoolHistory { epochNumber, completedAt, blocks, totalSats }
// by the hash path. This module only READS those records (kept forever) and
// never pays anything: it only changes the target.

const HASH_SPACE = 100000000;
const MONTHLY_TOTAL = 100000;
const FAVOR_BUDGET = 45000;
const OTHER_BUDGET = 55000; // Informational only: not enforced by this module (or elsewhere yet). The retarget formula uses the 14-day Favor aim, not this cap.
const EPOCH_SATS = 21000;
const BLOCKS_PER_EPOCH = 5;
const TARGET_EPOCH_DAYS = 14;
const DAY_MS = 86400000;
const MAX_FACTOR = 4;
const MIN_TARGET = 100;      // odds 1 in 1,000,000 floor so repeated 1/4 steps can't reach 0
const MAX_TARGET = HASH_SPACE / 10;
const DAYS_PER_MONTH = 30;
const CACHE_MS = 60000;

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

function difficultyChangePct(oldTarget, newTarget) {
  const o = Number(oldTarget), n = Number(newTarget);
  if (!(o > 0) || !(n > 0)) return null;
  const oldD = HASH_SPACE / o, newD = HASH_SPACE / n;
  return (newD - oldD) / oldD * 100;
}
function changeLabel(oldTarget, newTarget) {
  const p = difficultyChangePct(oldTarget, newTarget);
  if (p == null) return 'Genesis';
  const r = Math.round(p * 10) / 10;
  if (r === 0) return '0%';
  return (r > 0 ? '+' : '') + r + '%';
}

// Fixed Favor share of the monthly budget. Other payouts no longer reduce it.
function favorBudgetPerMonth() { return FAVOR_BUDGET; }

// input: { currentTarget, epochDurationMs, epochs (default 1) }
// Returns null when the duration is unusable (never guesses a direction).
function planRetarget(input) {
  const src = input || {};
  const current = clamp(Math.floor(Number(src.currentTarget) || 0) || 25000, MIN_TARGET, MAX_TARGET);
  const epochs = Math.max(1, Math.floor(Number(src.epochs) || 1));
  const duration = Number(src.epochDurationMs);
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const targetMs = epochs * TARGET_EPOCH_DAYS * DAY_MS;
  const rawFactor = duration / targetMs;
  const factor = clamp(rawFactor, 1 / MAX_FACTOR, MAX_FACTOR);
  const target = clamp(Math.round(current * factor), MIN_TARGET, MAX_TARGET);
  return {
    previousTarget: current,
    target: target,
    factor: Math.round((target / current) * 10000) / 10000,
    rawFactor: Math.round(rawFactor * 10000) / 10000,
    clamped: rawFactor !== factor,
    label: changeLabel(current, target),
    difficultyChangePct: Math.round(difficultyChangePct(current, target) * 100) / 100,
    epochs: epochs,
    epochDurationDays: Math.round(duration / DAY_MS * 100) / 100,
    targetDays: epochs * TARGET_EPOCH_DAYS,
    blocksPerDay: Math.round(epochs * BLOCKS_PER_EPOCH / (duration / DAY_MS) * 10000) / 10000,
  };
}

function validTarget(t) {
  const n = Math.floor(Number(t));
  return Number.isFinite(n) && n >= MIN_TARGET && n <= MAX_TARGET ? n : null;
}

// ── Live target read (cached) ───────────────────────────────────────────
let _cache = { at: 0, target: null };
function _resetCache() { _cache = { at: 0, target: null }; }
async function getTarget(db, fallback, nowMs) {
  const now = nowMs || Date.now();
  if (_cache.target != null && now - _cache.at < CACHE_MS) return _cache.target;
  try {
    const snap = await db.collection('payout_config').doc('favorDifficulty').get();
    const t = snap.exists ? validTarget((snap.data() || {}).target) : null;
    _cache = { at: now, target: t != null ? t : fallback };
  } catch (e) {
    console.warn('[FAVOR] difficulty config read failed, using fallback:', e && e.message);
    _cache = { at: now - CACHE_MS + 5000, target: _cache.target != null ? _cache.target : fallback };
  }
  return _cache.target;
}

// Public mirror (no uids, no money figures).
function publicConfig(row) {
  const r = row || {};
  const last = Number.isInteger(r.lastRetargetEpoch) ? r.lastRetargetEpoch : null;
  return {
    target: r.target,
    odds: Math.round(HASH_SPACE / r.target),
    retargetRule: 'epoch',
    targetEpochDays: TARGET_EPOCH_DAYS,
    lastRetargetMs: r.lastRetargetMs || null,
    lastRetargetEpoch: last,
    nextRetargetEpoch: last != null ? last + 1 : null,
    nextRetargetMs: null, // no time-based retarget; clears the old date on merge
    history: (Array.isArray(r.history) ? r.history : []).map(function (h) {
      return { date: h.date, since: h.since, target: h.target, previous: h.previous, label: h.label };
    }),
  };
}

function isoDay(ms) { return new Date(ms).toISOString().slice(0, 10); }
function tsMs(v) {
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Closed epochs from sfPoolHistory with epochNumber > afterEpoch, earliest
// completedAt per epoch number (guards against a duplicate archive row).
async function loadClosedEpochs(db, afterEpoch) {
  const snap = await db.collection('sfPoolHistory').where('epochNumber', '>', afterEpoch).get();
  const byNum = {};
  snap.forEach(function (doc) {
    const d = doc.data() || {};
    const n = Number(d.epochNumber);
    const ms = tsMs(d.completedAt);
    if (!Number.isInteger(n) || !ms) return;
    if (!byNum[n] || ms < byNum[n]) byNum[n] = ms;
  });
  return Object.keys(byNum).map(function (k) { return { epochNumber: Number(k), completedAtMs: byNum[k] }; })
    .sort(function (a, b) { return a.epochNumber - b.epochNumber; });
}

// When epoch `n` closed (the start of epoch n + 1). 0 if unknown.
async function loadEpochClosedMs(db, n) {
  const snap = await db.collection('sfPoolHistory').where('epochNumber', '==', n).get();
  let best = 0;
  snap.forEach(function (doc) {
    const ms = tsMs((doc.data() || {}).completedAt);
    if (ms && (!best || ms < best)) best = ms;
  });
  return best;
}

// Scheduled entry (every 30 minutes). Retargets only when a new epoch has
// filled 5/5 since lastRetargetEpoch. Each newly closed epoch is its own
// step, clamped to [1/4, 4] on its own duration, applied in order. Never
// time-based, never seeds, never pays. Idempotent per epoch: the transaction
// re-checks lastRetargetEpoch before writing, and the written lastRetargetEpoch
// makes the next run skip until another epoch closes.
async function runRetarget(db, admin, nowMs, deps) {
  const now = nowMs || Date.now();
  const d = deps || {};
  const ref = db.collection('payout_config').doc('favorDifficulty');
  const snap = await ref.get();
  if (!snap.exists) { console.warn('[FAVOR] retarget: config missing, skipped'); return { skipped: 'missing' }; }
  const row = snap.data() || {};
  const lastEpoch = row.lastRetargetEpoch;
  // Not migrated yet: no epoch anchor. Do nothing (there is no time fallback).
  if (!Number.isInteger(lastEpoch) || lastEpoch < 0) return { skipped: 'not_migrated' };
  const closed = (await (d.loadClosedEpochs || loadClosedEpochs)(db, lastEpoch))
    .filter(function (e) { return e.epochNumber > lastEpoch && e.completedAtMs <= now; });
  if (!closed.length) return { skipped: 'no_new_epoch', waitingForEpoch: lastEpoch + 1 };
  const newest = closed[closed.length - 1];
  let startMs = Number(row.lastRetargetEpochClosedMs) || 0;
  if (!startMs) startMs = await (d.loadEpochClosedMs || loadEpochClosedMs)(db, lastEpoch);
  if (!startMs) return { skipped: 'no_epoch_start', epoch: closed[0].epochNumber };

  // One clamped step per closed epoch, in order. Duration of epoch n is
  // completedAt(n) - completedAt(n-1) (or lastRetargetEpochClosedMs for the first).
  const steps = [];
  let prevClose = startMs;
  for (let i = 0; i < closed.length; i++) {
    const e = closed[i];
    const durationMs = e.completedAtMs - prevClose;
    if (!(durationMs > 0)) return { skipped: 'bad_duration', epoch: e.epochNumber };
    steps.push({ epochNumber: e.epochNumber, startMs: prevClose, closedMs: e.completedAtMs, durationMs: durationMs });
    prevClose = e.completedAtMs;
  }

  let result = null;
  await db.runTransaction(async (t) => {
    const cur = await t.get(ref);
    const c = cur.data() || {};
    if (c.lastRetargetEpoch !== lastEpoch) return; // already retargeted for this epoch
    let current = validTarget(c.target) || 25000;
    const entries = [];
    let lastPlan = null;
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const plan = planRetarget({ currentTarget: current, epochDurationMs: s.durationMs, epochs: 1 });
      if (!plan) return;
      entries.push({
        date: isoDay(now), since: now, target: plan.target, previous: plan.previousTarget,
        label: plan.label, factor: plan.factor, rawFactor: plan.rawFactor,
        reason: 'Epoch #' + s.epochNumber + ' filled 5/5',
        epoch: s.epochNumber, epochs: 1, epochStartMs: s.startMs, epochClosedMs: s.closedMs,
        epochDurationDays: plan.epochDurationDays, targetDays: plan.targetDays
      });
      current = plan.target;
      lastPlan = plan;
    }
    const first = entries[0];
    const updated = {
      target: lastPlan.target,
      previous: first.previous,
      label: changeLabel(first.previous, lastPlan.target),
      retargetRule: 'epoch',
      lastRetargetMs: now,
      lastRetargetEpoch: newest.epochNumber,
      lastRetargetEpochClosedMs: newest.completedAtMs,
      nextRetargetMs: null,
      history: (Array.isArray(c.history) ? c.history : []).concat(entries),
      lastPlan: lastPlan,
    };
    t.set(ref, updated, { merge: true });
    t.set(db.collection('satoshiFavor').doc('difficultyStats'),
      { config: publicConfig(Object.assign({}, c, updated)) }, { merge: true });
    result = {
      epoch: newest.epochNumber,
      epochs: steps.length,
      previousTarget: first.previous,
      target: lastPlan.target,
      label: updated.label,
      factor: Math.round((lastPlan.target / first.previous) * 10000) / 10000,
      steps: entries.map(function (e) {
        return { epoch: e.epoch, previous: e.previous, target: e.target, factor: e.factor, label: e.label, epochDurationDays: e.epochDurationDays };
      }),
    };
  });
  _resetCache();
  if (result) console.log('[FAVOR] retarget', JSON.stringify(result));
  return result ? Object.assign({ retargeted: true }, result) : { skipped: 'raced' };
}

module.exports = {
  HASH_SPACE, MONTHLY_TOTAL, FAVOR_BUDGET, OTHER_BUDGET, EPOCH_SATS, BLOCKS_PER_EPOCH, TARGET_EPOCH_DAYS,
  DAY_MS, DAYS_PER_MONTH, MAX_FACTOR, MIN_TARGET, MAX_TARGET, CACHE_MS,
  difficultyChangePct, changeLabel, favorBudgetPerMonth, planRetarget, validTarget, getTarget,
  publicConfig, runRetarget, loadClosedEpochs, loadEpochClosedMs, _resetCache,
};
