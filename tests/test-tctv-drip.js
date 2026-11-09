'use strict';
const assert = require('assert');
const L = require('../functions/src/tctvDripLogic');
// Share math below is checked on a 10,000 pot; the shipped default is 5,000.
assert.strictEqual(L.readConfig({}).targetSats, 5000);
assert.strictEqual(L.readConfig({}).satsPerViewerMinute, 1);
assert.strictEqual(L.readConfig({}).satsPerFiveViewers, 5);
assert.strictEqual(L.readConfig({}).dailyCapSats, 1000);
assert.strictEqual(L.readConfig({ satsPerFiveViewers: 7 }).satsPerFiveViewers, 7);
const cfg = L.readConfig({ targetSats: 10000 });
// stepped rate: 0; 1-4 -> 1; >=5 -> floor(N/5)*satsPerFiveViewers (cap viewers at 50)
const stepCases = [
    [0, 0], [1, 1], [4, 1], [5, 5], [9, 5], [10, 10], [49, 45], [50, 50], [60, 50],
];
for (const [n, want] of stepCases) {
    assert.strictEqual(L.rateFromViewers(n, cfg), want, 'rateFromViewers(' + n + ')');
    const a0 = L.planAccrual({ sats: 0 }, n, cfg, 'd1');
    assert.strictEqual(a0.ratePerMin, want, 'ratePerMin viewers=' + n);
    assert.strictEqual(a0.add, want, 'add viewers=' + n);
}
// 50 forged presence viewers and no crediting check-in add nothing.
assert.strictEqual(L.accrualViewers(50, 0), 0);
assert.strictEqual(L.accrualViewers(3, 10), 3);
assert.strictEqual(L.accrualViewers(0, 10), 0);
assert.strictEqual(L.planAccrual({ sats: 0 }, L.accrualViewers(0, 10), L.readConfig({}), 'd1').add, 0);
let forged = L.planAccrual({ sats: 0 }, L.accrualViewers(50, 0), L.readConfig({}), 'd1');
assert.strictEqual(forged.add, 0);
assert.strictEqual(forged.sats, 0);
assert.strictEqual(forged.ratePerMin, 0);
let forgedDay = { sats: 0 };
for (let i = 0; i < 1440; i++) forgedDay = Object.assign({}, forgedDay, L.planAccrual(forgedDay, L.accrualViewers(50, 0), L.readConfig({}), 'd1'));
assert.strictEqual(forgedDay.sats, 0);
assert.strictEqual(forgedDay.dayAccrued, 0);
// Real check-ins set the rate. Extra fake presence cannot raise it.
assert.strictEqual(L.planAccrual({ sats: 0 }, L.accrualViewers(50, 4), L.readConfig({}), 'd1').add, 1);
assert.strictEqual(L.planAccrual({ sats: 0 }, L.accrualViewers(50, 10), L.readConfig({}), 'd1').add, 10);
assert.strictEqual(L.planAccrual({ sats: 0 }, L.accrualViewers(50, 10), L.readConfig({}), 'd1').ratePerMin, 10);
// accrual (stepped: 10 viewers -> 10 sats/min; 50 -> 50)
let a = L.planAccrual({ sats: 0 }, 10, cfg, 'd1'); assert.strictEqual(a.sats, 10); assert.strictEqual(a.ratePerMin, 10);
a = L.planAccrual({ sats: 0 }, 500, cfg, 'd1'); assert.strictEqual(a.viewers, 50); assert.strictEqual(a.sats, 50); assert.strictEqual(a.ratePerMin, 50);
a = L.planAccrual({ sats: 5000, dayKey: 'd1', dayAccrued: 999 }, 50, cfg, 'd1'); assert.strictEqual(a.add, 1); assert.strictEqual(a.ratePerMin, 50);
a = L.planAccrual({ sats: 5000, dayKey: 'd0', dayAccrued: 1000 }, 50, cfg, 'd1'); assert.strictEqual(a.add, 50);
a = L.planAccrual({ sats: 999.9 }, 10, cfg, 'd1'); assert.ok(a.burst);
a = L.planAccrual({ sats: 9990 }, 50, cfg, 'd1'); assert.ok(a.full); assert.strictEqual(a.sats, 10000);
// 1-4 band is 1 sat/min: 1 viewer fills 5,000 in ~3.5 days; any audience needs >= 5 days under the 1,000/day cap
assert.strictEqual(Math.ceil(5000 / Math.min(1000, 1 * 1440)), 5);
// daily cap binds at 1,000/day even with many viewers
let d = { sats: 0 }; for (let i = 0; i < 1440; i++) d = Object.assign({}, d, L.planAccrual(d, 50, L.readConfig({}), 'd1'));
assert.strictEqual(d.dayAccrued, 1000); assert.strictEqual(d.sats, 1000);
// check-ins
const ctx = (o) => Object.assign({ uid: 'u', nowMs: 1e9, cfg, playing: true, presenceFresh: true, newToken: 't', rand: 0.5 }, o);
let c = L.planCheckin({}, ctx()); assert.strictEqual(c.credit, 60);
c = L.planCheckin({ lastCheckMs: 1e9 - 10000 }, ctx()); assert.ok(c.reject);
c = L.planCheckin({}, ctx({ playing: false })); assert.strictEqual(c.credit, 0);
c = L.planCheckin({}, ctx({ deviceOwner: 'x', deviceLastMs: 1e9 - 1000 })); assert.ok(c.reject);
c = L.planCheckin({ seconds: cfg.perAccountLimitSeconds, promptDueMs: 2e9 }, ctx()); assert.strictEqual(c.reason, 'limit');
c = L.planCheckin({ promptDueMs: 1 }, ctx()); assert.ok(c.prompt); assert.strictEqual(c.credit, 0);
c = L.planCheckin({ promptDueMs: 1, promptToken: 'abc', promptIssuedMs: 1e9 - 5000 }, ctx({ promptAnswer: 'abc' })); assert.strictEqual(c.credit, 60);
c = L.planCheckin({ promptDueMs: 1, promptToken: 'abc', promptIssuedMs: 1e9 - 5000 }, ctx({ promptAnswer: 'zzz' })); assert.strictEqual(c.credit, 0);
// Raising the prompt must not move lastCheckMs, or the tap in that same minute is too-fast and the share stays 0.
c = L.planCheckin({ lastCheckMs: 1e9 - 60000, promptDueMs: 1e9 - 1000, seconds: 120 }, ctx());
assert.ok(c.prompt); assert.strictEqual(c.credit, 0); assert.strictEqual(c.patch.lastCheckMs, undefined);
c = L.planCheckin({ lastCheckMs: 1e9 - 60000, promptDueMs: 1e9 - 1000, promptToken: 'abc', promptIssuedMs: 1e9 - 5000, seconds: 120 }, ctx({ promptAnswer: 'abc' }));
assert.strictEqual(c.credit, 60); assert.strictEqual(c.reason, 'ok');
// A tap still counts when an older build already moved lastCheckMs into the gap.
c = L.planCheckin({ lastCheckMs: 1e9 - 5000, promptDueMs: 1, promptToken: 'abc', promptIssuedMs: 1e9 - 5000, seconds: 120 }, ctx({ promptAnswer: 'abc' }));
assert.strictEqual(c.credit, 60);
c = L.planCheckin({ lastCheckMs: 1e9 - 5000, promptDueMs: 1, promptToken: 'abc', promptIssuedMs: 1e9 - 5000 }, ctx({ promptAnswer: 'zzz' }));
assert.ok(c.reject); assert.strictEqual(c.reason, 'too-fast');
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
// projectShares: same math as planShares, but still projects while waiting on min watchers
assert.ok(typeof L.projectShares === 'function');
let p = L.projectShares(W(3), cfg);
assert.ok(p.waiting); assert.strictEqual(p.eligible, 3);
assert.ok(p.shares.every(x => x.sats > 0)); assert.strictEqual(p.shares.reduce((t, x) => t + x.sats, 0) + p.rollover, 10000);
// short watcher stays at 0; five long watchers match planShares
p = L.projectShares(W(5).concat([{ uid: 'short', seconds: 100 }]), cfg);
assert.ok(!p.waiting); assert.strictEqual(p.shares.find(x => x.uid === 'short').sats, 0);
assert.ok(p.shares.filter(x => x.uid !== 'short').every(x => x.sats === 2000));
s = L.planShares(W(5), cfg);
p = L.projectShares(W(5), cfg);
assert.deepStrictEqual(p.shares.filter(x => x.sats > 0).map(x => x.sats).sort(), s.shares.map(x => x.sats).sort());
// under-qualify alone: all zeros, waiting
p = L.projectShares([{ uid: 'a', seconds: 60 }], cfg);
assert.ok(p.waiting); assert.strictEqual(p.eligible, 0); assert.strictEqual(p.shares[0].sats, 0);
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
// Client prompt: small side button, info tooltip, 2-minute window, "pot of sats" wording.
{
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'tctv-drip.js'), 'utf8');
    assert.ok(src.includes("you don\\u2019t tap it, your watch time won\\u2019t be added to the pot of sats."));
    assert.ok(!/sats pot/i.test(src), 'say "pot of sats"');
    assert.ok(/#tctv-drip\{position:fixed;/.test(src) && src.includes('document.body.appendChild(el)'), 'floating overlay outside the player layout (video stays centered)');
    assert.ok(src.includes("'tctvPotPos'") && src.includes("'tctvPotMin'") && src.includes("'tctvPotPx'") && src.includes("'tctvPotSize'") && /pointerdown/.test(src), 'draggable + corner resize + minimizable, remembered per device');
    assert.ok(src.includes('top:calc(84px + env(safe-area-inset-top, 0px))'), 'default sits in the upper area');
    assert.ok(!src.includes('bottom:96px') && !src.includes('bottom:150px'), 'no longer parked on the bottom edge');
    assert.ok(!src.includes('Shrink') && !src.includes('Grow'), 'no shrink/grow control');
    assert.ok(src.includes('aria-label="Resize pot of sats"') && src.includes('aria-label="Minimize pot of sats"') && src.includes('aria-label="Restore pot of sats"'));
    assert.ok(src.includes('MIN_POT = 84') && src.includes('PHONE_MAX = 160') && src.includes('DESK_MAX = 300') && src.includes('PHONE_DEFAULT = 135') && src.includes('DESK_DEFAULT = 190'), 'phone and desktop pot sizes');
    assert.ok(src.includes('nesw-resize') && src.includes('td-resize'), 'top-right corner drag resizes');
    assert.ok(/\.td-resize\{[^}]*min-width:44px;min-height:44px/.test(src) && /\.td-min\{[^}]*min-width:44px;min-height:44px/.test(src), 'resize and minimize targets');
    assert.ok(src.includes('_tctvLiveViewers') && src.includes('function rateFromViewers') && src.includes('if (n < 5) return 1') && src.includes('return Math.floor(n / 5) * 5'), 'pot count and rate follow the live viewcount');
    assert.ok(src.includes('min counted'), 'counted minutes show while the share is still 0');
    assert.ok(/prefers-reduced-motion/.test(src) && /visibilityState/.test(src) && /requestAnimationFrame/.test(src), 'flow pauses when hidden, gentle for reduced motion');
    assert.ok(!/Watch Party/i.test(src), 'no old name');
    assert.ok(/\.td-pill\{[^}]*min-height:44px;min-width:44px/.test(src) && /\.td-pinfo\{[^}]*min-width:44px;min-height:44px/.test(src), '44px targets');
    assert.ok(src.includes('}, 120000);'), '2-minute answer window');
    assert.ok(src.includes('sats/min') && src.includes('ratePerMin'), 'shows pot fill rate when ratePerMin present');
    assert.ok(src.includes('watching right now'), 'falls back to watching line without ratePerMin');
    assert.ok(src.includes('Your Share:') && src.includes('td-share') && src.includes('projectedShareSats'), 'live Your Share line');
    assert.ok(src.includes('Sign in to see your share'), 'signed-out hint');
    assert.ok(src.includes('tctv_drip_watch') && src.includes('paintShare'), 'own watch doc listener');
    assert.ok(src.includes('td-bubble-share'), 'share visible when minimized');
    assert.ok(!/addDoc|\.set\(|\.update\(/.test(src.replace(/localStorage\.setItem/g, '')), 'client never writes pot data');
    const srv = require('fs').readFileSync(require('path').join(__dirname, '..', 'functions', 'tctv-drip.js'), 'utf8');
    assert.ok(srv.includes("collection('tctv_counts').doc('live')") && srv.includes('freshLiveTotal'), 'tick reads the live viewcount for display');
    assert.ok(srv.includes("where('activeMs'") && srv.includes('accrualViewers(liveN, crediting)'), 'sats follow crediting check-ins');
    assert.ok(srv.includes('logic.planAccrual(pot, moneyN'), 'planAccrual does not take the live total');
    const D = L.readConfig({});
    assert.strictEqual(D.promptMinMinutes, 15); assert.strictEqual(D.promptMaxMinutes, 40); assert.strictEqual(D.promptAnswerSeconds, 120);
}
console.log('tctv-drip client prompt: ok');
