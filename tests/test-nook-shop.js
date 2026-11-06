'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const shop = require('../functions/src/nookShop');
let pass = 0;
function t(name, fn) { fn(); pass++; console.log('ok', name); }
const now = Date.UTC(2026, 10, 2, 12);
const throwsCode = (fn, code) => assert.throws(fn, e => e.shopCode === code);

t('insufficient balance rejected', () => throwsCode(() => shop.plan('hash_booster_3', 1, { orangeTickets: 26 }, {}, now), 'failed-precondition'));
t('exact balance ok, cost once', () => { const p = shop.plan('hash_booster_3', 1, { orangeTickets: 27 }, {}, now); assert.strictEqual(p.totalCost, 27); assert.strictEqual(p.units, 3); });
t('bundle ignores quantity', () => { const p = shop.plan('bonus_spin_3', 10, { orangeTickets: 999 }, {}, now); assert.strictEqual(p.qty, 1); assert.strictEqual(p.units, 3); assert.strictEqual(p.totalCost, 14); });
t('quantity clamped 1..10, garbage -> 1', () => {
  assert.strictEqual(shop.plan('raffle_entry', 50, { orangeTickets: 9999 }, {}, now).qty, 10);
  assert.strictEqual(shop.plan('raffle_entry', -5, { orangeTickets: 9999 }, {}, now).qty, 1);
  assert.strictEqual(shop.plan('raffle_entry', 'x', { orangeTickets: 9999 }, {}, now).qty, 1);
});
t('NaN/negative balance rejected', () => { throwsCode(() => shop.plan('hint_token', 1, { orangeTickets: 'abc' }, {}, now), 'failed-precondition'); throwsCode(() => shop.plan('hint_token', 1, { orangeTickets: -10 }, {}, now), 'failed-precondition'); });
t('hold cap freezes', () => { throwsCode(() => shop.plan('streak_freeze_3', 1, { orangeTickets: 99, streakFreezes: 8 }, {}, now), 'resource-exhausted'); shop.plan('streak_freeze_3', 1, { orangeTickets: 99, streakFreezes: 7 }, {}, now); });
t('hold cap rig', () => throwsCode(() => shop.plan('second_rig_3', 1, { orangeTickets: 999, secondRigCharges: 8 }, {}, now), 'resource-exhausted'));
t('daily cap shared spin group', () => { throwsCode(() => shop.plan('bonus_spin_3', 1, { orangeTickets: 99 }, { daily: 3 }, now), 'resource-exhausted'); shop.plan('bonus_spin', 2, { orangeTickets: 99 }, { daily: 3 }, now); });
t('daily cap hash group', () => throwsCode(() => shop.plan('hash_booster_3', 1, { orangeTickets: 99 }, { daily: 8 }, now), 'resource-exhausted'));
t('monthly raffle cap', () => { throwsCode(() => shop.plan('raffle_entry_10', 1, { orangeTickets: 9999 }, { monthly: 141 }, now), 'resource-exhausted'); shop.plan('raffle_entry_10', 1, { orangeTickets: 9999 }, { monthly: 140 }, now); });
t('cosmetic owned rejected', () => throwsCode(() => shop.plan('profile_frame', 1, { orangeTickets: 999, ownedCosmetics: ['profile_frame'] }, {}, now), 'already-exists'));
t('retired/unknown rejected', () => { throwsCode(() => shop.plan('gift_bag', 1, { orangeTickets: 999 }, {}, now), 'invalid-argument'); throwsCode(() => shop.plan('__proto__', 1, { orangeTickets: 999 }, {}, now), 'invalid-argument'); throwsCode(() => shop.plan('constructor', 1, { orangeTickets: 999 }, {}, now), 'invalid-argument'); });
t('catalog hides retired, no sats fields', () => { const c = shop.publicCatalog(); assert(!c.gift_bag); assert(c.double_xp_3h.isNew); assert(!JSON.stringify(c).match(/"sats\w*":/i)); });
t('client fallbacks match server prices', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'quests.js'), 'utf8');
  const m = src.match(/var _NOOK_FALLBACK = (\{[^}]+\})/); const fb = eval('(' + m[1] + ')');
  const cat = shop.publicCatalog(); for (const id of Object.keys(cat)) assert.strictEqual(fb[id], cat[id].cost, id);
});
t('bundles never cheaper-per-unit exploit beyond singles', () => { for (const [id, it] of Object.entries(shop.ITEMS)) if (it.bundle && it.units) { const single = Object.values(shop.ITEMS).find(x => !x.bundle && x.field === it.field); assert(it.cost / it.units <= single.cost && it.cost / it.units >= single.cost * 0.75, id); } });

// Optimistic-concurrency simulation of the spendTickets transaction (Firestore
// retries a transaction whose read set changed). Two parallel buys with balance
// for one: exactly one succeeds and OT is deducted once.
async function simulate(user, itemId, n) {
  const store = { user: { ...user }, ver: 0, cap: 0 };
  async function buy() {
    for (let attempt = 0; attempt < 5; attempt++) {
      const snap = { ...store.user }, ver = store.ver, cap = store.cap;
      await new Promise(r => setImmediate(r));
      const p = shop.plan(itemId, 1, snap, { daily: cap }, now);
      if (store.ver !== ver) continue; // contention -> retry
      store.user.orangeTickets -= p.totalCost; if (p.field) store.user[p.field] = (store.user[p.field] || 0) + p.units; store.cap += p.units; store.ver++;
      return 'ok';
    }
    throw new Error('aborted');
  }
  const r = await Promise.allSettled(Array.from({ length: n }, buy));
  return { store, ok: r.filter(x => x.status === 'fulfilled').length };
}
(async () => {
  const a = await simulate({ orangeTickets: 30 }, 'hash_booster_3', 2);
  assert.strictEqual(a.ok, 1); assert.strictEqual(a.store.user.orangeTickets, 3); assert.strictEqual(a.store.user.hashBoosters, 3); pass++; console.log('ok concurrent double-buy -> one success, OT deducted once');
  const b = await simulate({ orangeTickets: 1000 }, 'bonus_spin_3', 5);
  assert.strictEqual(b.ok, 1); assert.strictEqual(b.store.user.bonusSpins, 3); pass++; console.log('ok concurrent buys cannot pass daily cap');
  const idx = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
  const f = idx.slice(idx.indexOf('exports.spendTicketsForFreeze'), idx.indexOf('exports.spendTicketsForFreeze') + 3000);
  assert(/if \(amount !== 1 && amount !== 3\)/.test(f) && /holdCap/.test(f)); pass++; console.log('ok spendTicketsForFreeze validates amount + hold cap');
  console.log(pass, 'passed');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
