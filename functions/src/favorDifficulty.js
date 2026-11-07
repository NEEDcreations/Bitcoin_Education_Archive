'use strict';
// Satoshi's Favor difficulty: live target + automatic retarget (~every 14 days).
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
// Budget (Phil, Nov 6 2026): Favor budget per month =
//   min(FAVOR_CAP 10,500, MONTHLY_TOTAL 25,000 - BUFFER 1,500 - other payouts per month)
// One epoch = 5 blocks = 21,000 sats. Each retarget moves at most 4x either way.
// No payouts happen here: this only changes the target. SF epochs stay manual.

const HASH_SPACE = 100000000;
const MONTHLY_TOTAL = 25000;
const BUFFER = 1500;
const FAVOR_CAP = 10500;
const EPOCH_SATS = 21000;
const BLOCKS_PER_EPOCH = 5;
const RETARGET_DAYS = 14;
const DAY_MS = 86400000;
const MAX_FACTOR = 4;
const MIN_TARGET = 100;      // odds 1 in 1,000,000 floor so repeated 1/4 steps can't reach 0
const MAX_TARGET = HASH_SPACE / 10;
const DAYS_PER_MONTH = 30;
const CACHE_MS = 60000;

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function n0(v) { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; }

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

function favorBudgetPerMonth(otherPaidPerMonth) {
  return Math.max(0, Math.min(FAVOR_CAP, MONTHLY_TOTAL - BUFFER - n0(otherPaidPerMonth)));
}

// input: { currentTarget, windowDays, blocksInWindow, otherPaidInWindow }
function planRetarget(input) {
  const src = input || {};
  const current = clamp(Math.floor(Number(src.currentTarget) || 0) || 25000, MIN_TARGET, MAX_TARGET);
  const windowDays = Math.max(1, Number(src.windowDays) || RETARGET_DAYS);
  const otherPerMonth = n0(src.otherPaidInWindow) * (DAYS_PER_MONTH / windowDays);
  const favorPerMonth = favorBudgetPerMonth(otherPerMonth);
  const targetBlocksPerDay = (favorPerMonth / EPOCH_SATS) * BLOCKS_PER_EPOCH / DAYS_PER_MONTH;
  const blocks = n0(src.blocksInWindow);
  const actualBlocksPerDay = blocks / windowDays;
  let factor;
  if (targetBlocksPerDay <= 0) factor = 1 / MAX_FACTOR;          // no budget: harder
  else if (actualBlocksPerDay <= 0) factor = MAX_FACTOR;         // no blocks: easier
  else factor = targetBlocksPerDay / actualBlocksPerDay;
  factor = clamp(factor, 1 / MAX_FACTOR, MAX_FACTOR);
  const target = clamp(Math.round(current * factor), MIN_TARGET, MAX_TARGET);
  return {
    previousTarget: current,
    target: target,
    factor: Math.round((target / current) * 10000) / 10000,
    label: changeLabel(current, target),
    difficultyChangePct: Math.round(difficultyChangePct(current, target) * 100) / 100,
    otherPaidPerMonth: Math.round(otherPerMonth),
    favorBudgetPerMonth: Math.round(favorPerMonth),
    targetBlocksPerDay: Math.round(targetBlocksPerDay * 10000) / 10000,
    actualBlocksPerDay: Math.round(actualBlocksPerDay * 10000) / 10000,
    blocksInWindow: blocks,
    windowDays: Math.round(windowDays * 100) / 100,
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

// Public mirror (no uids, no money figures beyond the plan inputs).
function publicConfig(row) {
  const r = row || {};
  return {
    target: r.target,
    odds: Math.round(HASH_SPACE / r.target),
    lastRetargetMs: r.lastRetargetMs || null,
    nextRetargetMs: r.nextRetargetMs || null,
    history: (Array.isArray(r.history) ? r.history : []).map(function (h) {
      return { date: h.date, since: h.since, target: h.target, previous: h.previous, label: h.label };
    }),
  };
}

function isoDay(ms) { return new Date(ms).toISOString().slice(0, 10); }

function daysBetween(fromMs, toMs) {
  const out = [];
  const last = isoDay(toMs);
  for (let t = Date.parse(isoDay(fromMs) + 'T00:00:00Z'); out.length < 400; t += DAY_MS) {
    const day = isoDay(t);
    out.push(day);
    if (day >= last) break;
  }
  return out;
}

// Other auto payouts in the window (faucet + cipher sats), from the existing
// per-UTC-day totals. Whole days at both ends, so it slightly over-counts.
async function sumOtherPaid(db, fromMs, toMs) {
  let total = 0;
  for (const day of daysBetween(fromMs, toMs)) {
    const [f, c] = await Promise.all([
      db.collection('faucet_stats').doc(day).get(),
      db.collection('cipher_sats_site_daily').doc(day).get(),
    ]);
    if (f.exists) total += n0((f.data() || {}).totalPaid);
    if (c.exists) total += n0((c.data() || {}).amount);
  }
  return total;
}

async function countBlocks(db, fromMs, toMs) {
  const snap = await db.collection('satoshiFavor').doc('current').collection('hashes')
    .where('isWinner', '==', true).get();
  let n = 0;
  snap.forEach(function (doc) {
    const ts = (doc.data() || {}).timestamp;
    const ms = ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0;
    if (ms >= fromMs && ms < toMs) n++;
  });
  return n;
}

// Scheduled entry. Only acts once nextRetargetMs has passed. Never seeds: the
// doc is written once by Phil-approved apply script. Idempotent via a
// transaction keyed on lastRetargetMs.
async function runRetarget(db, admin, nowMs, deps) {
  const now = nowMs || Date.now();
  const d = deps || {};
  const ref = db.collection('payout_config').doc('favorDifficulty');
  const snap = await ref.get();
  if (!snap.exists) { console.warn('[FAVOR] retarget: config missing, skipped'); return { skipped: 'missing' }; }
  const row = snap.data() || {};
  const last = Number(row.lastRetargetMs) || 0;
  const next = Number(row.nextRetargetMs) || (last + RETARGET_DAYS * DAY_MS);
  if (!last || now < next) return { skipped: 'not_due', nextRetargetMs: next };
  const blocks = await (d.countBlocks || countBlocks)(db, last, now);
  const otherPaid = await (d.sumOtherPaid || sumOtherPaid)(db, last, now);
  let result = null;
  await db.runTransaction(async (t) => {
    const cur = await t.get(ref);
    const c = cur.data() || {};
    if ((Number(c.lastRetargetMs) || 0) !== last) return; // already retargeted
    const plan = planRetarget({
      currentTarget: validTarget(c.target) || 25000,
      windowDays: (now - last) / DAY_MS,
      blocksInWindow: blocks,
      otherPaidInWindow: otherPaid,
    });
    const entry = { date: isoDay(now), since: now, target: plan.target, previous: plan.previousTarget,
      label: plan.label, factor: plan.factor, blocks: plan.blocksInWindow, windowDays: plan.windowDays,
      favorBudgetPerMonth: plan.favorBudgetPerMonth, otherPaidPerMonth: plan.otherPaidPerMonth };
    const updated = {
      target: plan.target,
      previous: plan.previousTarget,
      label: plan.label,
      lastRetargetMs: now,
      nextRetargetMs: now + RETARGET_DAYS * DAY_MS,
      history: (Array.isArray(c.history) ? c.history : []).concat([entry]),
      lastPlan: plan,
    };
    t.set(ref, updated, { merge: true });
    t.set(db.collection('satoshiFavor').doc('difficultyStats'),
      { config: publicConfig(Object.assign({}, c, updated)) }, { merge: true });
    result = plan;
  });
  _resetCache();
  if (result) console.log('[FAVOR] retarget', JSON.stringify(result));
  return result ? Object.assign({ retargeted: true }, result) : { skipped: 'raced' };
}

module.exports = {
  HASH_SPACE, MONTHLY_TOTAL, BUFFER, FAVOR_CAP, EPOCH_SATS, BLOCKS_PER_EPOCH, RETARGET_DAYS, DAY_MS,
  MAX_FACTOR, MIN_TARGET, MAX_TARGET, CACHE_MS,
  difficultyChangePct, changeLabel, favorBudgetPerMonth, planRetarget, validTarget, getTarget,
  publicConfig, runRetarget, sumOtherPaid, daysBetween, countBlocks, _resetCache,
};
