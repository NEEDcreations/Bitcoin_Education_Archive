// #278 follow-ups (Spam/Abuse review M2, L2, L3): linked-account share bucket,
// one-transaction reserve release on success, server-side prompt answer window.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const L = require('../functions/src/tctvDripLogic');
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log('✅ ' + name); passed++; } catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; } }
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const cfg = L.readConfig({});
const H8 = 8 * 3600;
const sum = (p) => p.shares.reduce((t, s) => t + s.sats, 0);
const byUid = (p) => new Map(p.shares.map(s => [s.uid, s.sats]));

// ---- M2: linked-account bucket ----
test('no links: identical to the per-account split', () => {
    const W = Array.from({ length: 6 }, (_, i) => ({ uid: 'u' + i, seconds: i < 2 ? H8 : 1800 }));
    const a = L.planShares(W, cfg);
    const b = L.planShares(W.map(w => Object.assign({ links: ['ip:' + w.uid] }, w)), cfg);
    assert.deepStrictEqual(a.shares, b.shares);
    assert.strictEqual(a.eligible, 6);
});
test('a 5-account ring on one IP is one bucket; threshold counts accounts (Spam/Abuse #287 M1)', () => {
    const ring = Array.from({ length: 5 }, (_, i) => ({ uid: 'r' + i, seconds: H8, links: ['ip:same'] }));
    const p = L.planShares(ring, cfg);
    assert.ok(!p.wait, 'shared-IP accounts count toward minEligibleWatchers');
    assert.strictEqual(p.eligible, 5);
    assert.strictEqual(p.accounts, 5);
    assert.strictEqual(p.groups, 1);
    assert.strictEqual(p.linkedGroups, 1);
    assert.ok(sum(p) <= cfg.targetSats);
});
test('classroom NAT: 30 honest viewers on one IP do not wait forever', () => {
    const room = Array.from({ length: 30 }, (_, i) => ({ uid: 'c' + i, seconds: 3600 + i * 60, links: ['ip:school'] }));
    const p = L.planShares(room, cfg);
    assert.ok(!p.wait);
    assert.strictEqual(p.groups, 1);
    assert.ok(p.shares.length === 30 && sum(p) > 0 && sum(p) <= cfg.targetSats);
});
test('below the account threshold still waits; projection agrees', () => {
    const four = Array.from({ length: 4 }, (_, i) => ({ uid: 'f' + i, seconds: H8, links: ['ip:f' + i] }));
    assert.ok(L.planShares(four, cfg).wait);
    const proj = L.projectShares(four, cfg);
    assert.ok(proj.waiting);
    assert.strictEqual(proj.eligible, 4);
    assert.strictEqual(proj.groups, 4);
});
test('ring + 5 honest viewers: ring capped to one share in total', () => {
    const ring = Array.from({ length: 5 }, (_, i) => ({ uid: 'r' + i, seconds: H8, links: ['ip:same'] }));
    const honest = Array.from({ length: 5 }, (_, i) => ({ uid: 'h' + i, seconds: 3 * 3600, links: ['ip:h' + i] }));
    const p = L.planShares(ring.concat(honest), cfg);
    assert.ok(!p.wait);
    assert.strictEqual(p.eligible, 10);
    assert.strictEqual(p.groups, 6);
    assert.strictEqual(p.linkedGroups, 1);
    const m = byUid(p);
    const ringTotal = ring.reduce((t, r) => t + (m.get(r.uid) || 0), 0);
    assert.ok(ringTotal <= p.cap, 'ring total ' + ringTotal + ' <= cap ' + p.cap);
    // Old per-account split would have paid the ring 5 caps.
    const old = L.planShares(ring.concat(honest).map(e => ({ uid: e.uid, seconds: e.seconds })), cfg);
    const oldRing = ring.reduce((t, r) => t + (byUid(old).get(r.uid) || 0), 0);
    assert.ok(oldRing > ringTotal * 2, 'old ' + oldRing + ' vs new ' + ringTotal);
    assert.ok(sum(p) <= cfg.targetSats);
});
test('hasLinks: true only while any link list is non-empty', () => {
    assert.strictEqual(L.hasLinks({}), false);
    assert.strictEqual(L.hasLinks({ linkIps: [], linkDevices: [], linkNets: [] }), false);
    assert.strictEqual(L.hasLinks({ linkDevices: ['x'] }), true);
});
test('links chain transitively (A-B by IP, B-C by device)', () => {
    const g = L.groupLinked([
        { uid: 'a', seconds: 1, links: ['ip:1'] },
        { uid: 'b', seconds: 1, links: ['ip:1', 'dev:x'] },
        { uid: 'c', seconds: 1, links: ['dev:x'] },
        { uid: 'd', seconds: 1, links: ['ip:9'] },
    ]);
    assert.deepStrictEqual(g.map(x => x.map(e => e.uid).sort()).sort(), [['a', 'b', 'c'], ['d']]);
});
test('subnet links only with linkBySubnet', () => {
    const w = { linkIps: ['i1'], linkDevices: ['d1'], linkNets: ['n1'] };
    assert.deepStrictEqual(L.linkKeys(w, cfg).sort(), ['dev:d1', 'ip:i1']);
    assert.deepStrictEqual(L.linkKeys(w, L.readConfig({ linkBySubnet: true })).sort(), ['dev:d1', 'ip:i1', 'net:n1']);
    assert.strictEqual(cfg.linkBySubnet, false);
});
test('group split is whole sats, deterministic, by seconds', () => {
    const s = L.splitGroup([{ uid: 'b', seconds: 100 }, { uid: 'a', seconds: 100 }, { uid: 'c', seconds: 200 }], 101);
    assert.strictEqual(s.reduce((t, x) => t + x.sats, 0), 101);
    const m = new Map(s.map(x => [x.uid, x.sats]));
    assert.strictEqual(m.get('c'), 51);
    assert.strictEqual(m.get('a'), 25);
    assert.strictEqual(m.get('b'), 25);
    assert.deepStrictEqual(L.splitGroup([{ uid: 'b', seconds: 100 }, { uid: 'a', seconds: 100 }], 3), L.splitGroup([{ uid: 'b', seconds: 100 }, { uid: 'a', seconds: 100 }], 3));
});
test('mergeLinks dedupes and caps', () => {
    let l = [];
    for (let i = 0; i < 20; i++) l = L.mergeLinks(l, 'k' + (i % 12));
    assert.ok(l.length <= L.MAX_LINKS);
    assert.deepStrictEqual(L.mergeLinks(['a'], 'a'), ['a']);
    assert.deepStrictEqual(L.mergeLinks(['a'], ''), ['a']);
});
test('projection uses the same grouping', () => {
    const ring = Array.from({ length: 3 }, (_, i) => ({ uid: 'r' + i, seconds: H8, links: ['dev:x'] }));
    const honest = Array.from({ length: 5 }, (_, i) => ({ uid: 'h' + i, seconds: 3600 }));
    const proj = L.projectShares(ring.concat(honest), cfg);
    const plan = L.planShares(ring.concat(honest), cfg);
    const pm = new Map(proj.shares.map(s => [s.uid, s.sats]));
    for (const s of plan.shares) assert.strictEqual(pm.get(s.uid), s.sats, s.uid);
});

// ---- L3: promptAnswerSeconds on the server ----
const NOW = 1e9;
const ctx = (o) => Object.assign({ uid: 'u', nowMs: NOW, cfg, playing: true, presenceFresh: true, newToken: 'NEW', rand: 0.5 }, o);
test('answer inside the window credits', () => {
    const c = L.planCheckin({ promptDueMs: 1, promptToken: 'abc', promptIssuedMs: NOW - 119000 }, ctx({ promptAnswer: 'abc' }));
    assert.strictEqual(c.credit, 60);
    assert.strictEqual(c.patch.promptIssuedMs, 0);
});
test('answer after 120s (+10s grace) does not credit and re-issues the prompt', () => {
    const c = L.planCheckin({ promptDueMs: 1, promptToken: 'abc', promptIssuedMs: NOW - 131000 }, ctx({ promptAnswer: 'abc' }));
    assert.strictEqual(c.credit, 0);
    assert.strictEqual(c.reason, 'prompt-expired');
    assert.ok(c.prompt);
    assert.strictEqual(c.token, 'NEW');
    assert.strictEqual(c.patch.promptToken, 'NEW');
    assert.strictEqual(c.patch.promptIssuedMs, NOW);
});
test('window is config (promptAnswerSeconds)', () => {
    const c2 = L.readConfig({ promptAnswerSeconds: 300 });
    const c = L.planCheckin({ promptDueMs: 1, promptToken: 'abc', promptIssuedMs: NOW - 200000 }, ctx({ cfg: c2, promptAnswer: 'abc' }));
    assert.strictEqual(c.credit, 60);
});
test('a token from before this change (no issue time) is re-issued once', () => {
    const c = L.planCheckin({ promptDueMs: 1, promptToken: 'old' }, ctx({ promptAnswer: 'old' }));
    assert.strictEqual(c.credit, 0);
    assert.strictEqual(c.token, 'NEW');
    const again = L.planCheckin(Object.assign({ promptDueMs: 1 }, c.patch), ctx({ nowMs: NOW + 5000, promptAnswer: 'NEW' }));
    assert.strictEqual(again.credit, 60);
});
test('an open prompt keeps its token and issue time inside the window', () => {
    const c = L.planCheckin({ promptDueMs: 1, promptToken: 'abc', promptIssuedMs: NOW - 60000 }, ctx());
    assert.strictEqual(c.token, 'abc');
    assert.strictEqual(c.patch.promptToken, undefined);
    assert.strictEqual(c.patch.promptIssuedMs, undefined);
});
test('a fresh prompt records its issue time', () => {
    const c = L.planCheckin({ promptDueMs: 1 }, ctx());
    assert.strictEqual(c.patch.promptIssuedMs, NOW);
});

// ---- L2: one-transaction reserve release ----
test('reservedAmountOf: stored amount wins, falls back to targetSats', () => {
    assert.strictEqual(L.reservedAmountOf({ reservedAmount: 7000 }, cfg), 7000);
    assert.strictEqual(L.reservedAmountOf({}, cfg), cfg.targetSats);
});
test('nextPotDoc carries rollover, clamps, increments id', () => {
    const d = L.nextPotDoc({ potId: 'pot7', dayKey: 'd', dayAccrued: 12 }, { rollover: 999999, shares: [1, 2] }, cfg, 5);
    assert.strictEqual(d.potId, 'pot8');
    assert.strictEqual(d.sats, cfg.targetSats - 1);
    assert.strictEqual(d.lastPaidPot, 'pot7');
    assert.strictEqual(d.lastPaidWinners, 2);
    assert.strictEqual(d.status, 'filling');
});
test('server wiring', () => {
    const src = read('functions/tctv-drip.js');
    const tail = src.slice(src.indexOf('The reserve becomes user balances'));
    const tx = tail.indexOf('db.runTransaction');
    assert.ok(tx > 0 && tx < tail.indexOf('reservedSats'), 'release inside a transaction');
    assert.ok(/cur\.potId !== pot\.potId \|\| cur\.status !== 'distributing'\) return false;\s*tx\.set\(db\.collection\('tctv_drip_config'\)\.doc\('reserve'\)/.test(tail));
    assert.ok(tail.indexOf('tx.set(potRef, logic.nextPotDoc(cur, plan, cfg, nowMs))') > 0);
    assert.ok(src.indexOf('reservedAmount: cfg.targetSats') > 0);
    // No non-transactional reserve decrement left.
    assert.strictEqual((src.match(/await db\.collection\('tctv_drip_config'\)\.doc\('reserve'\)\.set\(\{ reservedSats/g) || []).length, 0);
    assert.ok(src.indexOf('links: logic.linkKeys(w, cfg)') > 0, 'loadEntries passes links');
    assert.ok(src.indexOf('patch.linkIps = logic.mergeLinks(prev.linkIps, links.ip)') > 0);
    assert.ok(src.indexOf("linkHash('ip', net.exactId)") > 0, 'IP stored hashed');
});

// ---- #287 fix pass: HMAC link ids (Secret Manager), scrub at pot close, deleteAccount ----
test('linkHmac: keyed, deterministic, empty without a key, no raw value', () => {
    const S = require('../functions/src/tctvLinkSecret');
    const prev = process.env[S.SECRET_ENV];
    delete process.env[S.SECRET_ENV];
    assert.strictEqual(S.secretReady(), false);
    assert.strictEqual(S.linkHmac('ip', '203.0.113.7'), '');
    process.env[S.SECRET_ENV] = 'short';
    assert.strictEqual(S.linkHmac('ip', '203.0.113.7'), '', 'too-short key is treated as missing');
    process.env[S.SECRET_ENV] = 'test-only-tctv-link-key-not-real';
    const a = S.linkHmac('ip', '203.0.113.7');
    assert.ok(/^[0-9a-f]{24}$/.test(a));
    assert.strictEqual(S.linkHmac('ip', '203.0.113.7'), a);
    assert.notStrictEqual(S.linkHmac('net', '203.0.113.7'), a, 'kind is bound');
    assert.strictEqual(S.linkHmac('ip', ''), '');
    process.env[S.SECRET_ENV] = 'another-test-only-tctv-key-xyz';
    assert.notStrictEqual(S.linkHmac('ip', '203.0.113.7'), a, 'depends on the key');
    if (prev === undefined) delete process.env[S.SECRET_ENV]; else process.env[S.SECRET_ENV] = prev;
});
test('tctvDripCheckin: secret bound, own runtime SA, no static-salt sha256 link hash', () => {
    const src = read('functions/tctv-drip.js');
    const sec = read('functions/src/tctvLinkSecret.js');
    assert.ok(sec.indexOf("defineSecret(SECRET_ENV)") > 0 && sec.indexOf("'TCTV_LINK_HMAC_KEY'") > 0);
    assert.ok(sec.indexOf('createHmac') > 0);
    assert.ok(src.indexOf("secrets: [tctvLink.tctvLinkSecret], serviceAccount: runtimeSa('tctvDripCheckin')") > 0);
    assert.strictEqual(src.indexOf("'bq-tctv-link:'"), -1, 'old static salt gone');
    assert.ok(src.indexOf("linkHash('dev', deviceKey)") > 0, 'device link HMAC too');
    // The tick never reads the link key.
    const tick = src.slice(src.indexOf('const tctvDripTick = onSchedule('));
    assert.strictEqual(tick.slice(0, tick.indexOf('async')).indexOf('tctvLinkSecret'), -1);
    const M = require('../functions/src/runtimeServiceAccounts');
    assert.strictEqual(M.RUNTIME_SERVICE_ACCOUNTS.tctvDripCheckin.id, 'fn-tctv-drip-checkin');
});
test('pot close scrubs link ids after the success transaction', () => {
    const src = read('functions/tctv-drip.js');
    const adv = src.indexOf('if (!advanced) return;');
    const scrub = src.indexOf('await scrubPotLinks(pot.potId)');
    assert.ok(adv > 0 && scrub > adv, 'scrub only after the pot advanced');
    const fn = src.slice(src.indexOf('async function scrubPotLinks('), src.indexOf('const tctvDripTick = onSchedule('));
    assert.ok(fn.indexOf("where('potId', '==', potId)") > 0);
    assert.ok(fn.indexOf('linkIps: del, linkDevices: del, linkNets: del') > 0);
    assert.ok(fn.indexOf('logic.hasLinks(') > 0, 'idempotent');
});
test('deleteAccount removes tctv_drip_watch and device locks, keeps drip payouts/history', () => {
    const D = require('../functions/src/deleteAccount');
    const q = D.DELETION_QUERIES.map(x => x.slice(0, 3).join('|'));
    assert.ok(q.indexOf('tctv_drip_watch|uid|==') !== -1);
    assert.ok(q.indexOf('tctv_drip_devices|uid|==') !== -1);
    assert.ok(!q.some(x => x.indexOf('tctv_drip_payouts') === 0 || x.indexOf('tctv_drip_history') === 0), 'payout records kept');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
