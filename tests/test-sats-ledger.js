'use strict';
// App-wide monthly sats ledger: HARD 100,000 sats per ET calendar month
// (Phil, Nov 14 2026). Pure rules, transactions under real contention
// (optimistic concurrency like Firestore), ET rollover, release/held/paid,
// manual payouts, the 80% alert, the exempt Favor catch-up, and the wiring
// of every payout path that calls payInvoice.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const L = require(path.join(root, 'functions/src/satsLedger.js'));

let passed = 0;
let failed = 0;
const queue = [];
function test(name, fn) { queue.push({ name: name, fn: fn }); }

// ---------- in-memory Firestore with OPTIMISTIC transactions ----------
// Reads record a version; commit fails and retries if any read doc changed,
// and transactions interleave at every await (like concurrent servers).
function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function makeDb() {
    const store = new Map();
    const ver = new Map();
    let retries = 0;
    function apply(k, data, opts) {
        const cur = store.get(k);
        const incoming = clone(data);
        store.set(k, opts && opts.merge && cur ? Object.assign({}, cur, incoming) : incoming);
        ver.set(k, (ver.get(k) || 0) + 1);
    }
    function snap(k, id) {
        const v = store.get(k);
        return { id: id, exists: v !== undefined, data: function () { return clone(v); } };
    }
    function docRef(col, id) {
        const k = col + '/' + id;
        return { id: id, _k: k, async get() { await tick(); return snap(k, id); }, async set(d, o) { apply(k, d, o); } };
    }
    function collection(col) { return { doc: function (id) { return docRef(col, id); } }; }
    function tick() { return new Promise(function (r) { setImmediate(r); }); }
    async function runTransaction(fn) {
        for (let attempt = 0; attempt < 2000; attempt++) {
            const reads = new Map();
            const buf = [];
            let wrote = false;
            const tx = {
                get: async function (ref) {
                    if (wrote) throw new Error('read after write in transaction');
                    await tick();
                    reads.set(ref._k, ver.get(ref._k) || 0);
                    return snap(ref._k, ref.id);
                },
                set: function (ref, d, o) { wrote = true; buf.push([ref._k, d, o]); },
                update: function (ref, d) { wrote = true; buf.push([ref._k, d, { merge: true }]); },
            };
            const out = await fn(tx);
            await tick();
            let stale = false;
            reads.forEach(function (v, k) { if ((ver.get(k) || 0) !== v) stale = true; });
            if (stale) { retries++; continue; }
            buf.forEach(function (w) { apply(w[0], w[1], w[2]); });
            return out;
        }
        throw new Error('ABORTED: too much contention');
    }
    return { store: store, collection: collection, runTransaction: runTransaction, retries: function () { return retries; } };
}
const NOV = Date.UTC(2026, 10, 14, 17, 0); // Nov 14 2026, 12:00 PM ET
function month(db, key) { return db.store.get('sats_ledger_months/' + key) || {}; }
function entry(db, id) { return db.store.get('sats_ledger_entries/' + id); }
function offOther(db) { db.store.set('sats_ledger_config/settings', { otherLineEnabled: false }); }

// ---------- pure ----------
test('cap is hard 100,000, favor line 45,000 (informational), other line 55,000', function () {
    assert.strictEqual(L.MONTHLY_CAP_SATS, 100000);
    assert.strictEqual(L.FAVOR_LINE_SATS, 45000);
    assert.strictEqual(L.OTHER_LINE_SATS, 55000);
    assert.strictEqual(L.alertThreshold(100000), 80000);
});

test('ET month keys: midnight ET rollover, not UTC (7 PM ET) and DST-safe', function () {
    // Nov 30 11:59:59 PM ET (EST, UTC-5) = Dec 1 04:59:59 UTC
    assert.strictEqual(L.etMonthKey(Date.UTC(2026, 11, 1, 4, 59, 59)), '2026-11');
    assert.strictEqual(L.etMonthKey(Date.UTC(2026, 11, 1, 5, 0, 0)), '2026-12');
    // 7:30 PM ET Nov 30 is already December in UTC; still November here.
    assert.strictEqual(L.etMonthKey(Date.UTC(2026, 11, 1, 0, 30)), '2026-11');
    // Summer (EDT, UTC-4): Jul 31 11:59 PM ET = Aug 1 03:59 UTC
    assert.strictEqual(L.etMonthKey(Date.UTC(2026, 7, 1, 3, 59)), '2026-07');
    assert.strictEqual(L.etMonthKey(Date.UTC(2026, 7, 1, 4, 0)), '2026-08');
    assert.strictEqual(L.etMonthKey(Date.UTC(2026, 11, 31, 12)), '2026-12');
    assert.strictEqual(L.etMonthKey(Date.UTC(2027, 0, 1, 5)), '2027-01');
});

test('planReserve boundary: 100,000 exactly fits, 100,001 does not; bad amounts refused', function () {
    assert.ok(L.planReserve({ committedSats: 99999 }, null, 1, { source: 'favor' }).ok);
    assert.strictEqual(L.planReserve({ committedSats: 99999 }, null, 2, { source: 'favor' }).code, 'monthly_cap');
    assert.ok(L.planReserve({}, null, 100000, { source: 'favor' }).ok);
    assert.strictEqual(L.planReserve({}, null, 100001, { source: 'favor' }).code, 'monthly_cap');
    [0, -5, 1.5, NaN, '12abc', null].forEach(function (a) { assert.strictEqual(L.planReserve({}, null, a, { source: 'favor' }).code, 'bad_amount', String(a)); });
    assert.ok(L.planReserve({ committedSats: 100000 }, { status: 'reserved' }, 500, { source: 'favor' }).already, 'already counted is idempotent');
    assert.strictEqual(L.planReserve({}, { status: 'exempt' }, 5, { source: 'favor' }).code, 'exempt_entry');
});

test('other line (non-Favor) 55,000 is ON by default and only an explicit false turns it off', function () {
    const m = { committedSats: 55000, bySource: { faucet: 55000 } };
    assert.strictEqual(L.planReserve(m, null, 1, { source: 'faucet', config: {} }).code, 'monthly_cap');
    assert.strictEqual(L.planReserve(m, null, 1, { source: 'faucet', config: {} }).line, 'other');
    assert.strictEqual(L.planReserve(m, null, 1, { source: 'cipher_sats', config: { otherLineEnabled: 'no' } }).code, 'monthly_cap');
    assert.ok(L.planReserve(m, null, 1, { source: 'faucet', config: { otherLineEnabled: false } }).ok);
    assert.ok(L.planReserve(m, null, 45000, { source: 'favor', config: {} }).ok, 'favor is not on the other line');
    assert.strictEqual(L.planReserve(m, null, 45001, { source: 'favor', config: {} }).code, 'monthly_cap', 'total still hard');
    assert.strictEqual(L.planReserve({ committedSats: 100000, bySource: { favor: 50000, faucet: 50000 } }, null, 1, { source: 'faucet', config: { otherLineEnabled: false } }).code, 'monthly_cap', 'flag off never lifts the 100k total');
});

test('exemption is ONLY the Favor catch-up for epochs 1-8', function () {
    for (let e = 1; e <= 8; e++) assert.ok(L.isExempt({ source: 'favor', catchUp: true, epoch: e }));
    assert.ok(!L.isExempt({ source: 'favor', catchUp: true, epoch: 9 }));
    assert.ok(!L.isExempt({ source: 'favor', catchUp: false, epoch: 1 }));
    assert.ok(!L.isExempt({ source: 'faucet', catchUp: true, epoch: 1 }));
    assert.ok(!L.isExempt({ source: 'favor', catchUp: true, epoch: '1' }));
    assert.ok(!L.isExempt({}));
});

// ---------- transactional ----------
test('reserve up to the cap, then refused; nothing written on a refusal', async function () {
    const db = makeDb();
    offOther(db);
    assert.ok((await L.reserve(db, 'a', { source: 'faucet', amount: 99999, nowMs: NOV })).ok);
    assert.ok((await L.reserve(db, 'b', { source: 'faucet', amount: 1, nowMs: NOV })).ok);
    const r = await L.reserve(db, 'c', { source: 'faucet', amount: 1, nowMs: NOV });
    assert.strictEqual(r.code, 'monthly_cap');
    assert.strictEqual(entry(db, 'c'), undefined);
    assert.strictEqual(month(db, '2026-11').committedSats, 100000);
    assert.strictEqual(month(db, '2026-11').bySource.faucet, 100000);
});

test('concurrency: 150 parallel reserves of 1,000 (150,000 asked) never exceed 100,000', async function () {
    const db = makeDb();
    offOther(db);
    const jobs = [];
    for (let i = 0; i < 150; i++) {
        const src = ['faucet', 'cipher_sats', 'cipher_win', 'favor'][i % 4];
        // A transaction Firestore gives up on (ABORTED) is a refusal: nothing paid.
        jobs.push(L.reserve(db, 'p' + i, { source: src, amount: 1000, nowMs: NOV }).catch(function () { return { ok: false, code: 'aborted' }; }));
    }
    const res = await Promise.all(jobs);
    const ok = res.filter(function (r) { return r.ok; }).length;
    assert.strictEqual(ok, 100);
    assert.strictEqual(month(db, '2026-11').committedSats, 100000);
    let sum = 0;
    db.store.forEach(function (v, k) { if (k.indexOf('sats_ledger_entries/') === 0 && L.COUNTED[v.status]) sum += v.amount; });
    assert.strictEqual(sum, 100000, 'entries agree with the month total');
    assert.ok(db.retries() > 0, 'the test really contended');
});

test('concurrency: the 55k other line also holds under contention', async function () {
    const db = makeDb();
    const res = await Promise.all(Array.from({ length: 150 }, function (_, i) { return L.reserve(db, 'o' + i, { source: 'faucet', amount: 1000, nowMs: NOV }); }));
    assert.strictEqual(res.filter(function (r) { return r.ok; }).length, 55);
    assert.strictEqual(month(db, '2026-11').committedSats, 55000);
    assert.ok((await L.reserve(db, 'fav', { source: 'favor', amount: 45000, nowMs: NOV })).ok);
    assert.strictEqual((await L.reserve(db, 'fav2', { source: 'favor', amount: 1, nowMs: NOV })).code, 'monthly_cap');
});

test('same entry reserved twice in parallel is counted once (idempotent)', async function () {
    const db = makeDb();
    await Promise.all([1, 2, 3, 4, 5].map(function () { return L.reserve(db, 'same', { source: 'faucet', amount: 200, nowMs: NOV }); }));
    assert.strictEqual(month(db, '2026-11').committedSats, 200);
    assert.strictEqual(entry(db, 'same').attempts, 1);
});

test('month rollover at midnight ET: a full November does not block December', async function () {
    const db = makeDb();
    offOther(db);
    const lastNov = Date.UTC(2026, 11, 1, 4, 59, 59); // Nov 30 11:59:59 PM ET
    const firstDec = Date.UTC(2026, 11, 1, 5, 0, 0); // Dec 1 12:00:00 AM ET
    assert.ok((await L.reserve(db, 'n', { source: 'faucet', amount: 100000, nowMs: lastNov })).ok);
    assert.strictEqual((await L.reserve(db, 'n2', { source: 'faucet', amount: 1, nowMs: Date.UTC(2026, 11, 1, 0, 30) })).code, 'monthly_cap', '7:30 PM ET Nov 30 is still November');
    assert.ok((await L.reserve(db, 'd', { source: 'faucet', amount: 100000, nowMs: firstDec })).ok);
    assert.strictEqual(month(db, '2026-12').committedSats, 100000);
});

test('release gives sats back to the month they were reserved in, even after rollover; idempotent', async function () {
    const db = makeDb();
    offOther(db);
    await L.reserve(db, 'r', { source: 'cipher_sats', amount: 700, nowMs: Date.UTC(2026, 11, 1, 4, 0) });
    assert.ok(await L.release(db, 'r', { reason: 'pay_failed', nowMs: Date.UTC(2026, 11, 2) }));
    assert.ok(!(await L.release(db, 'r', { reason: 'again', nowMs: Date.UTC(2026, 11, 2) })), 'second release is a no-op');
    assert.strictEqual(month(db, '2026-11').committedSats, 0);
    assert.strictEqual(month(db, '2026-12').committedSats, undefined);
    assert.strictEqual(entry(db, 'r').status, 'released');
    // Retry after release re-reserves once.
    assert.ok((await L.reserve(db, 'r', { source: 'cipher_sats', amount: 700, nowMs: NOV })).ok);
    assert.strictEqual(entry(db, 'r').attempts, 2);
    assert.strictEqual(month(db, '2026-11').committedSats, 700);
});

test('unknown result: held stays counted; only allowHeld (proven failed) releases it; paid never releases', async function () {
    const db = makeDb();
    await L.reserve(db, 'h', { source: 'faucet', amount: 300, nowMs: NOV });
    assert.ok(await L.markHeld(db, 'h', { nowMs: NOV }));
    assert.ok(!(await L.release(db, 'h', { nowMs: NOV })));
    assert.strictEqual(month(db, '2026-11').committedSats, 300);
    assert.ok(await L.release(db, 'h', { allowHeld: true, reason: 'admin_release', nowMs: NOV }));
    assert.strictEqual(month(db, '2026-11').committedSats, 0);
    await L.reserve(db, 'p', { source: 'faucet', amount: 300, nowMs: NOV });
    assert.ok(await L.markPaid(db, 'p', { nowMs: NOV }));
    assert.ok(!(await L.release(db, 'p', { allowHeld: true, nowMs: NOV })));
    assert.strictEqual(month(db, '2026-11').committedSats, 300);
    assert.strictEqual(entry(db, 'p').status, 'paid');
});

test('paid trues up the month to the real spend', async function () {
    const db = makeDb();
    await L.reserve(db, 'f', { source: 'favor', amount: 4200, nowMs: NOV });
    await L.markPaid(db, 'f', { spentSats: 4193, nowMs: NOV });
    assert.strictEqual(month(db, '2026-11').committedSats, 4193);
    assert.strictEqual(entry(db, 'f').reservedSats, 4200);
});

test('manual payouts: never refused, count toward the month, idempotent, block automated payouts', async function () {
    const db = makeDb();
    offOther(db);
    await L.reserve(db, 'a', { source: 'faucet', amount: 90000, nowMs: NOV });
    const m1 = await L.recordManual(db, 'manual_raffle_2026-11', { amount: 21000, kind: 'raffle', nowMs: NOV });
    assert.ok(m1.recorded && m1.overCap);
    assert.strictEqual(month(db, '2026-11').committedSats, 111000);
    const again = await L.recordManual(db, 'manual_raffle_2026-11', { amount: 21000, kind: 'raffle', nowMs: NOV });
    assert.ok(again.already && !again.recorded);
    assert.strictEqual(month(db, '2026-11').committedSats, 111000);
    assert.strictEqual((await L.reserve(db, 'b', { source: 'faucet', amount: 1, nowMs: NOV })).code, 'monthly_cap');
    // paidAtMs decides the month (ET).
    await L.recordManual(db, 'manual_jackpot_x', { amount: 5000, kind: 'jackpot', paidAtMs: Date.UTC(2026, 9, 31, 12), nowMs: NOV });
    assert.strictEqual(month(db, '2026-10').committedSats, 5000);
    assert.strictEqual(entry(db, 'manual_jackpot_x').status, 'paid');
});

test('manual payout input: amount, kind, ref and date are validated', function () {
    const now = NOV;
    assert.ok(L.parseManualPayout({ amount: 21000, kind: 'raffle', ref: 'raffle-2026-11' }, now).ok);
    assert.strictEqual(L.parseManualPayout({ amount: 21000, kind: 'raffle', ref: 'raffle-2026-11' }, now).id, 'manual_raffle_raffle-2026-11');
    [{ amount: 0, kind: 'raffle', ref: 'x' }, { amount: 1.5, kind: 'raffle', ref: 'x' }, { amount: 2000000, kind: 'raffle', ref: 'x' },
        { amount: 5, kind: 'gift', ref: 'x' }, { amount: 5, kind: 'raffle' }, { amount: 5, kind: 'raffle', ref: 'a/b' },
        { amount: 5, kind: 'raffle', ref: 'x', paidAtMs: now + 3600000 }, { amount: 5, kind: 'raffle', ref: 'x', paidAtMs: now - 400 * 86400000 }, null]
        .forEach(function (d) { assert.ok(!L.parseManualPayout(d, now).ok, JSON.stringify(d)); });
});

test('80% alert: written once per month to admin_notifications, in the same transaction', async function () {
    const db = makeDb();
    offOther(db);
    await L.reserve(db, 'a', { source: 'faucet', amount: 79999, nowMs: NOV });
    assert.strictEqual(db.store.get('admin_notifications/sats_cap_80_2026-11'), undefined);
    await L.reserve(db, 'b', { source: 'faucet', amount: 1, nowMs: NOV });
    const a = db.store.get('admin_notifications/sats_cap_80_2026-11');
    assert.ok(a && a.type === 'sats_cap' && a.read === false && a.committedSats === 80000);
    const at = month(db, '2026-11').alert80AtMs;
    await L.reserve(db, 'c', { source: 'faucet', amount: 5000, nowMs: NOV + 1000 });
    assert.strictEqual(month(db, '2026-11').alert80AtMs, at, 'not re-alerted');
    let n = 0;
    db.store.forEach(function (v, k) { if (k.indexOf('admin_notifications/') === 0) n++; });
    assert.strictEqual(n, 1);
});

test('records are permanent: no delete anywhere in the ledger module', function () {
    const src = fs.readFileSync(path.join(root, 'functions/src/satsLedger.js'), 'utf8');
    assert.ok(!/\.delete\(|FieldValue\.delete/.test(src));
    assert.deepStrictEqual(L.PERMANENT_COLLECTIONS.slice().sort(), ['sats_ledger_entries', 'sats_ledger_months']);
});

// ---------- wiring of each payout path ----------
const idx = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
const gift = fs.readFileSync(path.join(root, 'functions/src/gifting.js'), 'utf8');
const fav = fs.readFileSync(path.join(root, 'functions/src/favorBlockClaims.js'), 'utf8');
function between(src, a, b) { const i = src.indexOf(a); assert.ok(i !== -1, a); const j = src.indexOf(b, i + a.length); assert.ok(j !== -1, b); return src.slice(i, j); }

test('only four functions call payInvoice, and each one reserves in the ledger first', function () {
    const all = [['functions/index.js', idx], ['functions/src/gifting.js', gift], ['functions/src/favorBlockClaims.js', fav]];
    let calls = 0;
    all.forEach(function (p) { calls += (p[1].match(/\.payInvoice\(\{/g) || []).length; });
    assert.strictEqual(calls, 4, 'claimSats, claimCipherWin, claimCipherSats (via payCipherBalanceInvoice), claimFavorBlock');
});

test('faucet (claimSats): reserve inside the claim transaction before the wallet; release/held/paid after', function () {
    const body = between(idx, 'exports.claimSats = ', 'function _unknownPayError');
    const iRes = body.indexOf("satsL.reserve(satsEntryId, { source: 'faucet'");
    const iLoad = body.indexOf('await satsL.loadForReserve(satsEntryId)');
    const iPay = body.indexOf('nwc.payInvoice(');
    assert.ok(iLoad !== -1 && iRes > iLoad && iPay > iRes);
    assert.ok(body.indexOf('const pointsToClaim') > iRes, 'reserved before the first write');
    assert.ok(/satsLedger\.CAP_MESSAGE/.test(body));
    assert.strictEqual((body.match(/satsLedger\.release\(db, satsEntryId/g) || []).length, 2, 'both refund paths release');
    assert.strictEqual((body.match(/satsLedger\.markHeld\(db, satsEntryId/g) || []).length, 2, 'both unknown paths hold');
    assert.strictEqual((body.match(/satsLedger\.markPaid\(db, satsEntryId/g) || []).length, 2, 'both paid paths mark paid');
});

test('cipher wins incl. faction pots (claimCipherWin): reserve in the paying transaction; every unpaid exit releases', function () {
    const body = between(gift, 'const claimCipherWin = ', 'function winForUser');
    const iRes = body.indexOf("satsL.reserve(satsEntryId, { source: 'cipher_win'");
    assert.ok(iRes !== -1 && iRes < body.indexOf("status: 'paying'") && iRes < body.indexOf('nwc.payInvoice('));
    assert.ok(/resource-exhausted/.test(body));
    assert.strictEqual((body.match(/await releaseSats\(/g) || []).length, 4, 'fee, invoice, invoice used, pay failed');
    assert.ok(/markHeld\(db, satsEntryId/.test(between(body, 'async function holdUnknown', 'async function markPaid')));
    assert.ok(/markPaid\(db, satsEntryId/.test(between(body, 'async function markPaid', 'const nwc = new NWCClient')));
});

test('cipher sats incl. the TCTV drip (claimCipherSats): reserve in the claim transaction; finish moves the ledger atomically', function () {
    const body = between(gift, 'const claimCipherSats = ', 'const adminResolveCipherSatsClaim');
    const iLoad = body.indexOf('await satsL.loadForReserve(satsEntryId)');
    assert.ok(iLoad !== -1 && iLoad < body.indexOf('t.set(rateRef'), 'reads before the first write');
    assert.ok(body.indexOf("satsL.reserve(satsEntryId, { source: 'cipher_sats'") < body.indexOf('payCipherBalanceInvoice('));
    assert.ok(/satsL\.release\(staleEntryId, \{ reason: 'abandoned' \}\)/.test(body), 'an abandoned stale claim gives its sats back');
    const fin = between(gift, 'async function finishCipherClaim', 'async function beginCipherPay');
    assert.ok(/satsL\.paid\(satsEntryId/.test(fin) && /satsL\.held\(satsEntryId/.test(fin) && /satsL\.release\(satsEntryId, \{ reason: 'restore' \}\)/.test(fin));
    const drip = fs.readFileSync(path.join(root, 'functions/tctv-drip.js'), 'utf8');
    assert.ok(!/payInvoice/.test(drip) && /cipherSatsBalance/.test(drip), 'drip credits cipherSatsBalance, paid out only through claimCipherSats');
});

test('admin resolutions update the ledger: cipher sats resolve, mark cipher win paid, Favor review release', function () {
    const res = between(gift, 'const adminResolveCipherSatsClaim', 'module.exports');
    assert.ok(/satsL\.paid\(satsLedger\.entryId\('cipher_sats', claimId\)/.test(res));
    assert.ok(/satsL\.release\(satsLedger\.entryId\('cipher_sats', claimId\), \{ reason: 'admin_release', allowHeld: true \}\)/.test(res));
    const mark = between(gift, 'const adminMarkCipherWinPaid', 'const adminRecordManualPayout');
    assert.ok(/satsL\.paid\(satsEntryId/.test(mark) && /satsL\.recordManual\(manualEntryId/.test(mark));
    assert.ok(/sl\.release\(cur\.ledgerId, \{ reason: 'admin_release', allowHeld: true \}\)/.test(fav));
});

test('adminRecordManualPayout: admin + fresh step-up + App Check, records only, exported', function () {
    const body = between(gift, 'const adminRecordManualPayout', '// The sender marks');
    assert.ok(/enforceAppCheck: true/.test(body));
    assert.ok(body.indexOf('requireAdmin(context)') < body.indexOf('requireAdminStepUp'));
    assert.ok(body.indexOf('requireAdminStepUp') < body.indexOf('satsLedger.recordManual'));
    assert.ok(!/payInvoice|NWCClient/.test(body), 'never pays');
    assert.ok(/exports\.adminRecordManualPayout = adminRecordManualPayout;/.test(idx));
    const sf = fs.readFileSync(path.join(root, 'functions/src/secondFactor.js'), 'utf8');
    assert.ok(/adminRecordManualPayout: true/.test(sf), 'step-up action registered');
});

test('Favor: catch-up (epochs 1-8) is exempt by code; the 45k Favor line is untouched', function () {
    assert.ok(/const ledgerExempt = satsLedger\.isExempt\(\{ source: 'favor', catchUp: !!catchUp, epoch: ids\.epoch \}\);/.test(fav));
    assert.ok(/const ledgerId = ledgerExempt \? '' :/.test(fav));
    assert.ok(/monthlySats: 45000/.test(fav));
    assert.ok(/if \(\(Number\(c\.month\) \|\| 0\) \+ amount > cfg\.monthlySats\) return 'monthly_cap';/.test(fav));
});

(async function main() {
    for (const t of queue) {
        try { await t.fn(); console.log('\u2705 ' + t.name); passed++; }
        catch (e) { console.log('\u274c ' + t.name + ': ' + (e && e.stack || e)); failed++; }
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
