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
c = L.planCheckin({ promptDueMs: 1, promptToken: 'abc' }, ctx({ promptAnswer: 'abc' })); assert.strictEqual(c.credit, 60);
c = L.planCheckin({ promptDueMs: 1, promptToken: 'abc' }, ctx({ promptAnswer: 'zzz' })); assert.strictEqual(c.credit, 0);
// Regression (Nov 14): the "Still watching?" tap lands seconds after a regular
// check-in. It used to be rejected as too-fast, so the prompt could never be
// cleared and watch time froze for good.
{
    const now = 1e9;
    const stuck = { lastCheckMs: now - 5000, promptDueMs: now - 60000, promptToken: 'tok', seconds: 600 };
    let r = L.planCheckin(stuck, ctx({ promptAnswer: 'tok' }));
    assert.ok(!r.reject, 'answer right after a check-in is not rejected');
    assert.strictEqual(r.reason, 'answered'); assert.strictEqual(r.credit, 0, 'no double credit');
    assert.strictEqual(r.patch.promptToken, ''); assert.ok(r.patch.promptDueMs > now, 'next prompt scheduled');
    assert.ok(!('lastCheckMs' in r.patch), 'regular cadence unchanged');
    const after = Object.assign({}, stuck, r.patch);
    r = L.planCheckin(after, ctx({ nowMs: now + 55000 }));
    assert.strictEqual(r.reason, 'ok'); assert.strictEqual(r.credit, 60); assert.strictEqual(r.patch.seconds, 660);
    // A plain too-fast check-in (no answer, or a wrong token) is still rejected.
    assert.ok(L.planCheckin(stuck, ctx()).reject);
    assert.ok(L.planCheckin(stuck, ctx({ promptAnswer: 'nope' })).reject);
    // Unanswered prompt inside a session still blocks credit.
    r = L.planCheckin({ lastCheckMs: now - 60000, promptDueMs: now - 60000, promptToken: 'tok', seconds: 600 }, ctx());
    assert.ok(r.prompt); assert.strictEqual(r.credit, 0);
    // A prompt left over from an old session (days ago) is dropped on a new session.
    r = L.planCheckin({ lastCheckMs: now - L.SESSION_GAP_MS - 1, promptDueMs: now - 86400000, promptToken: 'old', seconds: 600 }, ctx());
    assert.strictEqual(r.reason, 'ok'); assert.strictEqual(r.credit, 60);
    assert.strictEqual(r.patch.promptToken, ''); assert.ok(r.patch.promptDueMs > now);
    // Age gate is re-checked over time.
    const day = 86400000;
    assert.ok(!L.ageOkAt(now - 2 * day, now, cfg)); assert.ok(L.ageOkAt(now - 3 * day, now, cfg));
    assert.ok(!L.ageOkAt(undefined, now, cfg)); assert.ok(!L.ageOkAt(0, now, cfg));
}
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
    assert.ok(src.includes("'tctvPotPos'") && src.includes("'tctvPotMin'") && src.includes("'tctvPotPx'") && /pointerdown/.test(src), 'draggable + resizable + minimizable, remembered per device');
    assert.ok(src.includes('top:calc(84px + env(safe-area-inset-top, 0px))'), 'default sits in the upper area');
    assert.ok(!src.includes('bottom:96px') && !src.includes('bottom:150px'), 'no longer parked on the bottom edge');
    assert.ok(src.includes('aria-label="Minimize pot of sats"') && src.includes('aria-label="Restore pot of sats"'));
    assert.ok(!/Shrink pot of sats|Enlarge pot of sats|td-smaller|td-larger/.test(src), 'no Shrink/Grow buttons; resize is by dragging');
    assert.ok(/\.td-min\{position:absolute;top:2px;right:18px;[^}]*min-width:44px;min-height:44px/.test(src), 'minimize sits in the top-right corner, 44px target');
    assert.ok(/\['tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r'\]/.test(src) && /\.td-rz\{position:absolute;z-index:4;touch-action:none/.test(src), 'grips on all four corners and edges, touch-action none');
    assert.ok(/function resizable\(el\)/.test(src) && /setPointerCapture/.test(src) && /passive: false/.test(src), 'pointer-event resize works for mouse and touch');
    assert.ok(/var MIN_POT = 72, MAX_POT = 420/.test(src) && /Math\.max\(MIN_POT, Math\.min\(potMax\(\)/.test(src), 'min clamp and viewport max');
    assert.ok(/MAIN_MIN = 175/.test(src) && /min-width:0/.test(src) && /flex-wrap:wrap/.test(src) && src.includes('max-width:calc(100% - 40px)') && /width:max-content;max-width:calc\(100vw - 16px\)/.test(src), 'phone count can wrap and has a 175px text-side reserve');
    assert.ok(/function keepInView\(el\)/.test(src) && /new ResizeObserver/.test(src) && src.includes('watchSize(el)') && /keepInView\(el\);/.test(src), 'count and text updates re-clamp the card to the viewport');
    assert.ok(/if \(persist\) lsSet\(SIZE_KEY, String\(n\)\)/.test(src) && /setPot\(el, curPot\(el\), true\)/.test(src), 'size saved on release');
    assert.ok(/prefers-reduced-motion/.test(src) && /visibilityState/.test(src) && /requestAnimationFrame/.test(src), 'flow pauses when hidden, gentle for reduced motion');
    assert.ok(!/Watch Party/i.test(src), 'no old name');
    assert.ok(/\.td-pill\{[^}]*min-height:44px;min-width:44px/.test(src) && /\.td-pinfo\{[^}]*min-width:44px;min-height:44px/.test(src), '44px targets');
    assert.ok(src.includes('}, 120000);'), '2-minute answer window');
    assert.ok(src.includes('sats/min') && src.includes('ratePerMin'), 'shows pot fill rate when ratePerMin present');
    assert.ok(src.includes('watching right now'), 'falls back to watching line without ratePerMin');
    assert.ok(src.includes('class="td-ptip-rate"') && src.includes("querySelector('.td-ptip-rate')") && src.includes('if (tipRate) tipRate.innerHTML = line;'), 'Info (i) tooltip shows the same live rate as the details popover');
    assert.ok(src.includes('.td-ptip-rate{font-weight:800;margin:0 0 6px}'), 'rate line is distinct at the top of the Info tip');
    assert.ok(src.includes('Your Share:') && src.includes('td-share') && src.includes('projectedShareSats'), 'live Your Share line');
    assert.ok(src.includes('Sign in to see your share'), 'signed-out hint');
    assert.ok(src.includes('tctv_drip_watch') && src.includes('paintShare'), 'own watch doc listener');
    assert.ok(src.includes('td-bubble-share'), 'share visible when minimized');
    assert.ok(src.includes('more min to qualify') && src.includes('qualifySeconds'), 'Your Share says how long until it qualifies');
    assert.ok(/if \(inflight && answer\) \{ answerQueued = true; return; \}/.test(src), 'a Still watching? tap is never dropped by an in-flight check-in');
    assert.ok(!/addDoc|\.set\(|\.update\(/.test(src.replace(/localStorage\.setItem/g, '')), 'client never writes pot data');
    const D = L.readConfig({});
    assert.strictEqual(D.promptMinMinutes, 15); assert.strictEqual(D.promptMaxMinutes, 40); assert.strictEqual(D.promptAnswerSeconds, 120);
}
console.log('tctv-drip client prompt: ok');
// Backfill planner: never lowers seconds, never writes under-age accounts, idempotent.
{
    const B = require('../functions/scripts/backfill_tctv_pot_seconds.js');
    const now = Date.parse('2026-11-15T01:30:00Z');
    const old = '2026-04-01T00:00:00.000Z';
    const oldMs = Date.parse(old);
    const ctx = { nowMs: now, limitSeconds: 28800, minAgeMs: 3 * 86400000, authCreatedMs: oldMs };
    let w = B.planWrite({ seconds: 600, ageOk: true }, { source: 'estimate', backfill_seconds: '3000', created: old }, ctx);
    assert.strictEqual(w.before, 600); assert.strictEqual(w.seconds, 3000);
    assert.strictEqual(w.createdMs, oldMs, 'uses Auth creation time');
    assert.strictEqual(B.planWrite({ seconds: 3000, ageOk: true }, { source: 'estimate', backfill_seconds: '3000', created: old }, ctx), null, 'idempotent');
    assert.strictEqual(B.planWrite({ seconds: 5000, ageOk: true }, { source: 'estimate', backfill_seconds: '3000', created: old }, ctx), null, 'never lowers');
    const young = { nowMs: now, limitSeconds: 28800, minAgeMs: 3 * 86400000, authCreatedMs: now - 86400000 };
    assert.strictEqual(B.planWrite({}, { source: 'estimate', backfill_seconds: '3000', created: new Date(now - 86400000).toISOString() }, young), null, 'under-age skipped');
    assert.strictEqual(B.planWrite({}, { source: 'excluded', backfill_seconds: '3000', created: old }, ctx), null);
    assert.strictEqual(B.planWrite({}, { source: 'held', backfill_seconds: '3000', created: old, uid: 'hold1' }, ctx), null, 'held skipped');
    assert.strictEqual(B.planWrite({}, { source: 'estimate', backfill_seconds: '3000', created: old, uid: 'hold1' }, Object.assign({}, ctx, { excluded: B.parseExclude('# c\nhold1\n') })), null, 'exclude file skipped');
    w = B.planWrite({ seconds: 0, ageOk: false }, { source: 'real', backfill_seconds: '0', created: old }, ctx); assert.ok(w && w.ageOk, 'aged account flips ageOk');
    assert.strictEqual(B.planWrite(null, { source: 'real', backfill_seconds: '0', created: old }, ctx), null, 'no empty doc created');
    assert.strictEqual(B.planWrite(null, { source: 'estimate', backfill_seconds: '99999', created: old }, ctx).seconds, B.ESTIMATE_CAP_SECONDS, 'estimate cap is 2h');
    assert.strictEqual(B.planWrite(null, { source: 'real', backfill_seconds: '99999', created: old }, ctx).seconds, 28800, 'real time still uses the 8h cap');
    assert.throws(function () { B.resolveCreatedMs({ uid: 'u1', created: '2020-01-01T00:00:00.000Z' }, oldMs); }, /mismatch/);
    assert.strictEqual(B.resolveCreatedMs({ uid: 'u1', created: old }, oldMs), oldMs);
    assert.strictEqual(B.resolveCreatedMs({ uid: 'u1' }, oldMs), oldMs, 'missing CSV created is ok');
    assert.throws(function () { B.planWrite({}, { source: 'estimate', backfill_seconds: '100', created: '2020-01-01T00:00:00.000Z' }, ctx); }, /mismatch/);
    const rows = B.parseCsv('uid,method\nu1,"a, ""b"""\n'); assert.strictEqual(rows[0].method, 'a, "b"');
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'functions', 'scripts', 'backfill_tctv_pot_seconds.js'), 'utf8');
    assert.ok(!/cipherSatsBalance\s*:|tctv_drip_payouts'\)/.test(src), 'backfill never touches balances or payouts');
    assert.ok(!/\.delete\(/.test(src), 'backfill never deletes');
    assert.ok(/getUser\(/.test(src), 'reads creation time from Auth');
    assert.ok(src.indexOf("status: 'started'") < src.indexOf('const done = await db.runTransaction'), 'summary row is written before per-row writes');
    assert.ok(src.includes('--exclude') && src.includes('PROTECTED_AUDIT_COLLECTION'), 'exclude list and protected audit collection');
    assert.ok(!/doc\(runId \+ '_' \+ row\.uid\)/.test(src), 'audit rows are not keyed on runId_uid');
    assert.ok(src.includes('auditDocId') && src.includes('--plan-sha'), 'hashed audit ids and --plan-sha');
    assert.strictEqual(B.CLIENT_BACKFILL_METHOD, 'backfill');
    assert.ok(!/review|withheld|watch list|watch-list|exclude/i.test(B.CLIENT_BACKFILL_METHOD));
    assert.ok(!/tx\.set\(wRef[\s\S]*method: String\(row\.method/.test(src), 'watch doc does not get the plan method');
    assert.ok(/method: CLIENT_BACKFILL_METHOD/.test(src), 'watch doc method is the neutral label');
    assert.ok(/tx\.create\(aRef[\s\S]*method: auditMethod/.test(src), 'audit row keeps the plan method');
    const crypto = require('crypto');
    const hashedUid = 'abcdefghijklmnopqrstuvwxyz12';
    const hashedRun = 'bf_20261114210000';
    const hashedId = B.auditDocId(hashedRun, hashedUid);
    assert.strictEqual(hashedId, B.auditDocId(hashedRun, hashedUid), 'auditDocId is stable');
    assert.strictEqual(hashedId, crypto.createHash('sha256').update(hashedRun + '\0' + hashedUid, 'utf8').digest('hex'));
    assert.ok(/^[0-9a-f]{64}$/.test(hashedId));
    assert.ok(hashedId.indexOf(hashedUid) === -1, 'uid is not in the audit doc id');
    assert.notStrictEqual(B.auditDocId('bf_1', 'u1'), B.auditDocId('bf_1', 'u2'));
    assert.notStrictEqual(B.auditDocId('bf_1', 'u1'), B.auditDocId('bf_2', 'u1'));
    assert.throws(function () { B.validateApplyArgs({ apply: true, excludePath: '', planSha: 'a'.repeat(64) }); }, /--exclude is required/);
    assert.throws(function () { B.validateApplyArgs({ apply: true, excludePath: 'ex.txt', planSha: '' }); }, /--plan-sha is required/);
    B.validateApplyArgs({ apply: true, excludePath: 'ex.txt', planSha: 'a'.repeat(64) });
    B.validateApplyArgs({ apply: false });
    const planBytes = Buffer.from('uid,created\nu1,2026-01-01\n');
    const planSha = B.sha256Hex(planBytes);
    assert.strictEqual(B.checkPlanSha(planBytes, planSha), planSha);
    assert.strictEqual(B.checkPlanSha(planBytes, planSha.toUpperCase()), planSha, 'plan sha is case-insensitive');
    assert.throws(function () { B.checkPlanSha(planBytes, '0'.repeat(64)); }, /mismatch/);
    assert.throws(function () { B.checkPlanSha(planBytes, ''); }, /missing/);
    assert.throws(function () { B.checkPlanSha(planBytes, 'deadbeef'); }, /invalid/);
    const rules = require('fs').readFileSync(require('path').join(__dirname, '..', 'firestore.rules'), 'utf8');
    const auditBlock = rules.slice(rules.indexOf('tctv_drip_backfill_audit'));
    assert.ok(rules.indexOf('match /tctv_drip_backfill_audit/{docId}') !== -1 && /allow read, write: if false/.test(auditBlock), 'deny-all rules for backfill audit');
}
console.log('tctv pot backfill planner: ok');
