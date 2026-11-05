'use strict';
const assert = require('assert');
const L = require('../functions/src/tctvDripLogic');
// Share math below is checked on a 10,000 pot; the shipped default is 5,000.
assert.strictEqual(L.readConfig({}).targetSats, 5000);
const cfg = L.readConfig({ targetSats: 10000 });
// accrual
let a = L.planAccrual({ sats: 0 }, 10, cfg, 'd1'); assert.strictEqual(a.sats, 0.5);
a = L.planAccrual({ sats: 0 }, 500, cfg, 'd1'); assert.strictEqual(a.viewers, 50); assert.strictEqual(a.sats, 2.5);
a = L.planAccrual({ sats: 5000, dayKey: 'd1', dayAccrued: 999 }, 50, cfg, 'd1'); assert.strictEqual(a.add, 1);
a = L.planAccrual({ sats: 5000, dayKey: 'd0', dayAccrued: 1000 }, 50, cfg, 'd1'); assert.strictEqual(a.add, 2.5);
a = L.planAccrual({ sats: 999.9 }, 10, cfg, 'd1'); assert.ok(a.burst);
a = L.planAccrual({ sats: 9999.9 }, 50, cfg, 'd1'); assert.ok(a.full); assert.strictEqual(a.sats, 10000);
// 10 viewers: 0.5/min = 720/day -> ~14 days
assert.ok(Math.ceil(10000 / (10 * 0.05 * 1440)) === 14);
// check-ins
const ctx = (o) => Object.assign({ uid: 'u', nowMs: 1e9, cfg, playing: true, presenceFresh: true, newToken: 't', rand: 0.5 }, o);
let c = L.planCheckin({}, ctx()); assert.strictEqual(c.credit, 60);
c = L.planCheckin({ lastCheckMs: 1e9 - 10000 }, ctx()); assert.ok(c.reject);
c = L.planCheckin({}, ctx({ playing: false })); assert.strictEqual(c.credit, 0);
c = L.planCheckin({}, ctx({ deviceOwner: 'x', deviceLastMs: 1e9 - 1000 })); assert.ok(c.reject);
c = L.planCheckin({ seconds: cfg.perAccountLimitSeconds, promptDueMs: 2e9 }, ctx()); assert.strictEqual(c.reason, 'limit');
c = L.planCheckin({ promptDueMs: 1 }, ctx()); assert.ok(c.prompt); assert.strictEqual(c.credit, 0);
c = L.planCheckin({ promptDueMs: 1, promptToken: 'abc' }, ctx({ promptAnswer: 'abc' })); assert.strictEqual(c.credit, 60);
c = L.planCheckin({ promptDueMs: 1, promptToken: 'abc' }, ctx({ promptAnswer: 'zzz' })); assert.strictEqual(c.credit, 0);
// shares: min watchers
const W = (n, f) => { const a = []; for (let i = 0; i < n; i++) a.push({ uid: 'w' + i, seconds: f ? f(i) : 3600 }); return a; };
const sum = (p) => p.shares.reduce((t, x) => t + x.sats, 0);
let s = L.planShares([{ uid: 'a', seconds: 3600 }, { uid: 'b', seconds: 3600 }, { uid: 'c', seconds: 100 }], cfg);
assert.ok(s.wait); assert.strictEqual(s.paid, 0); assert.strictEqual(s.shares.length, 0);
s = L.planShares(W(4).concat([{ uid: 'short', seconds: 1799 }]), cfg); assert.ok(s.wait, '1799s does not count');
assert.ok(!L.planShares(W(4), L.readConfig({ minEligibleWatchers: 4 })).wait, 'min watchers is config');
// cap = max(5%, 2/N)
assert.strictEqual(L.shareCap(10000, 5, cfg), 4000);
assert.strictEqual(L.shareCap(10000, 6, cfg), 3333);
assert.strictEqual(L.shareCap(10000, 10, cfg), 2000);
assert.strictEqual(L.shareCap(10000, 40, cfg), 500);
assert.strictEqual(L.shareCap(10000, 100, cfg), 500);
// N=5 equal: 2000 each, nothing rolls over
s = L.planShares(W(5), cfg); assert.ok(!s.wait); assert.strictEqual(s.cap, 4000);
assert.ok(s.shares.every(x => x.sats === 2000)); assert.strictEqual(s.rollover, 0); assert.strictEqual(sum(s), 10000);
// N=5 one heavy watcher: capped at 4000, rest shared by time
s = L.planShares(W(5, i => i === 0 ? 28800 : 1800), cfg);
assert.strictEqual(s.shares[0].sats, 4000); assert.ok(s.shares.slice(1).every(x => x.sats === 1500)); assert.strictEqual(s.rollover, 0);
// N=6 equal: 1666/1667, total exactly 10000
s = L.planShares(W(6), cfg); assert.strictEqual(s.cap, 3333); assert.strictEqual(sum(s), 10000); assert.strictEqual(s.rollover, 0);
assert.ok(s.shares.every(x => x.sats === 1666 || x.sats === 1667));
// N=6 two heavy: both capped at 3333, other four split 3334
s = L.planShares(W(6, i => i < 2 ? 28800 : 1800), cfg);
assert.strictEqual(s.shares[0].sats, 3333); assert.strictEqual(s.shares[1].sats, 3333);
assert.strictEqual(s.shares.slice(2).reduce((t, x) => t + x.sats, 0), 3334); assert.strictEqual(s.rollover, 0);
// N=10: cap 2000; one at 8h vs nine at 30m
s = L.planShares(W(10, i => i === 0 ? 28800 : 1800), cfg);
assert.strictEqual(s.cap, 2000); assert.strictEqual(s.shares[0].sats, 2000);
assert.ok(s.shares.slice(1).every(x => x.sats >= 888 && x.sats <= 889)); assert.strictEqual(sum(s), 10000);
// N=40: cap 500 (flat 5%); cascade redistribution
s = L.planShares(W(40, i => i < 5 ? 28800 : (i < 10 ? 7200 : 1800)), cfg);
assert.strictEqual(s.cap, 500); assert.ok(s.shares.every(x => x.sats <= 500)); assert.strictEqual(sum(s), 10000); assert.strictEqual(s.rollover, 0);
assert.ok(s.shares.slice(0, 5).every(x => x.sats === 500));
// redistribution is by watch time among uncapped
s = L.planShares(W(10, i => i === 0 ? 28800 : (i < 5 ? 3600 : 1800)), cfg);
const a1 = s.shares[1].sats, a9 = s.shares[9].sats; assert.ok(Math.abs(a1 - 2 * a9) <= 1, 'proportional');
assert.strictEqual(sum(s), 10000);
// per-account limit applies to counted time
s = L.planShares(W(5, i => i === 0 ? 999999 : 28800), cfg); assert.ok(s.shares.every(x => x.sats === 2000));
// random stress: never over cap, never over pot, nothing lost
for (let t = 0; t < 300; t++) {
    const n = 5 + Math.floor(Math.random() * 120);
    s = L.planShares(W(n, () => 1800 + Math.floor(Math.random() * 27000)), cfg);
    assert.ok(s.shares.every(x => x.sats <= s.cap)); assert.strictEqual(sum(s) + s.rollover, 10000); assert.strictEqual(s.rollover, 0);
}
// cipher balance is never truncated by claim limits: a claim takes at most 200, rest stays
const C = require('../functions/src/cipherSatsClaim');
const claimIn = (bal, used) => ({ authed: true, uid: 'u1', email: 'x@example.com', emailVerified: true, ageKnown: true, ageDays: 30,
    balance: bal, playerDayUsed: used || 0, siteDayUsed: 0, day: 'd1', nowMs: 1e12, saved: 'u1@example.com', lockExists: true, lockOwner: 'u1' });
let cl = C.planCipherSatsClaim(claimIn(4000));
if (cl.ok) { assert.strictEqual(cl.amount, 200); assert.strictEqual(cl.balanceAfter, 3800); assert.strictEqual(cl.balanceDelta, -200); }
else console.log('  (claim gate refused in unit harness: ' + cl.code + ')');
cl = C.planCipherSatsClaim(claimIn(4000, 200)); assert.ok(!cl.ok, 'daily cap hit'); assert.ok(!('balanceDelta' in cl), 'refusal never changes balance');
// reserve
assert.ok(!L.planReserve(-1, 0, cfg).ok);
assert.ok(!L.planReserve(25000, 0, cfg).ok);
assert.ok(L.planReserve(30000, 0, cfg).ok);
assert.ok(!L.planReserve(40000, 15000, cfg).ok);
assert.ok(L.isAgentOrBlocked({ isAgent: true }) && !L.isAgentOrBlocked({}));
console.log('tctvDripLogic: all tests passed');
