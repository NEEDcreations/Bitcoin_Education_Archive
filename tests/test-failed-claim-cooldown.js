// Failed faucet claims: a definite failure gives the daily claim back after a
// short wait, an unknown outcome holds it, and the release is capped.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const pfg = require('../functions/src/payFailGuard');
const guard = require('../functions/src/faucetGuard');
const cipher = require('../functions/src/cipherClaim');
const { releaseFailedClaim } = require('../functions/src/faucetRelease');
const { makeAdmin, makeDb } = require('./helpers-fake-firestore');

let passed = 0;
let failed = 0;
const queue = [];
function test(name, fn) {
    queue.push(Promise.resolve().then(fn).then(function() {
        console.log('✅ ' + name); passed++;
    }, function(e) {
        console.log('❌ ' + name + ': ' + (e && e.message)); failed++;
    }));
}

const HOUR = 3600000;
const DAY = 24 * HOUR;
const UID = 'uidA1234';
const ADDR = 'alice@wallet.example';
const TODAY = '2026-11-18';
const PRIOR = Date.now() - 3 * DAY;

// State right after a claim transaction reserved 200 sats.
function seedClaim(fake, opts) {
    const o = opts || {};
    const uid = o.uid || UID;
    const addr = o.addr || ADDR;
    const inv = o.inv || 'inv1';
    const ts = o.ts || Date.now();
    const s = fake.db.store;
    s['users/' + uid] = s['users/' + uid] || { pointsClaimed: 0, satsWithdrawn: 0 };
    s['users/' + uid].pointsClaimed += 2000;
    s['users/' + uid].satsWithdrawn += 200;
    s['users/' + uid].lastSatsClaim = { ms: ts };
    s['users/' + uid]._pendingClaim = true;
    s['faucet_ledger/' + uid] = Object.assign(s['faucet_ledger/' + uid] || {}, {});
    s['faucet_ledger/' + uid].satsWithdrawn = (s['faucet_ledger/' + uid].satsWithdrawn || 0) + 200;
    s['faucet_ledger/' + uid].claimCount = (s['faucet_ledger/' + uid].claimCount || 0) + 1;
    s['faucet_ledger/' + uid].lastSatsClaim = { ms: ts };
    s['users/' + uid + '/sats_daily/' + TODAY] = { amount: ((s['users/' + uid + '/sats_daily/' + TODAY] || {}).amount || 0) + 200 };
    s['faucet_stats/' + TODAY] = { totalPaid: ((s['faucet_stats/' + TODAY] || {}).totalPaid || 0) + 200, claimCount: 1 };
    const rateId = 'faucet_ln_ratelimit/' + guard.addressRateDocId(addr);
    s[rateId] = Object.assign({}, s[rateId] || {});
    s[rateId].claims = (s[rateId].claims || []).concat([{ uid: uid, ts: ts, amount: 200 }]);
    s['faucet_invoices/' + inv] = {
        uid: uid, amount: 200, status: 'pending', paymentHash: 'h_' + inv,
        address: addr, rateEntryTs: ts,
        priorUserLastMs: o.prior === undefined ? PRIOR : o.prior,
        priorLedgerLastMs: o.prior === undefined ? PRIOR : o.prior,
    };
    return {
        uid: uid, amount: 200, address: addr,
        invoiceRef: fake.ref('faucet_invoices/' + inv),
        userRef: fake.ref('users/' + uid),
        rateRef: fake.ref(rateId),
    };
}

function deps(fake) {
    return { db: fake.db, admin: makeAdmin(), pointsPerSat: 10, supportError: guard.supportError };
}

function release(fake, info, kind) {
    return releaseFailedClaim(deps(fake), info, TODAY, info.rateRef, kind || 'theirs');
}

// Outcome classification (unchanged rules, pinned here).
test('success: a preimage records the payment and nothing is released', function() {
    assert.strictEqual(guard.decideFaucetPayment({ phase: 'pay', payResult: { preimage: 'ab' } }).action, 'record');
});

test('definite failure: send never started (ours), or a confirmed failed lookup', function() {
    assert.strictEqual(guard.decideFaucetPayment({ phase: 'balance', error: new Error('[TIMEOUT] getBalance') }).action, 'refund');
    assert.strictEqual(guard.decideFaucetPayment({ phase: 'balance', error: new Error('WALLET_LOW') }).action, 'refund');
    const refused = Object.assign(new Error('no route'), { code: 'PAYMENT_FAILED' });
    // A pay-phase refusal is never released on its own word: it goes to lookup (K1).
    assert.strictEqual(guard.decideFaucetPayment({ phase: 'pay', error: refused }).action, 'lookup');
    assert.strictEqual(guard.decideFaucetPayment({ phase: 'pay', error: refused }).refused, true);
    assert.strictEqual(guard.definiteFailureKind({ phase: 'balance', error: new Error('x') }), 'ours');
    assert.strictEqual(guard.definiteFailureKind({ phase: 'pay', error: { code: 'INSUFFICIENT_BALANCE' } }), 'ours');
    assert.strictEqual(guard.definiteFailureKind({ phase: 'pay', error: refused }), 'theirs');
    // Exact codes only: message text from the receiving side never makes it 'ours'.
    assert.strictEqual(guard.definiteFailureKind({ phase: 'pay', error: new Error('INSUFFICIENT_BALANCE on their side') }), 'theirs');
    assert.strictEqual(guard.definiteFailureKind({ phase: 'pay', error: { code: 'RATE_LIMITED' } }), 'ours');
    assert.strictEqual(guard.decideFaucetLookupResult({ action: 'release' }).action, 'refund');
});

test('unknown: pay timeouts, relay drops, INTERNAL, and no preimage are looked up, then held', async function() {
    ['[TIMEOUT] payInvoice', 'NO_PREIMAGE', 'relay closed', 'INTERNAL'].forEach(function(msg) {
        assert.strictEqual(guard.decideFaucetPayment({ phase: 'pay', error: new Error(msg) }).action, 'lookup', msg);
    });
    // Lookup errors, empty results, pending, expired: all hold.
    const steps = [{ state: 'pending' }, null, { state: 'expired' }];
    let i = 0;
    const s = await cipher.lookupSettlement({ attempts: 3, intervalMs: 0, lookup: async function() {
        const r = steps[i++]; if (r === null) throw new Error('NOT_FOUND'); return r;
    } });
    assert.strictEqual(guard.decideFaucetLookupResult(s).action, 'unknown');
});

test('definite failure: refund, cooldown restored, address slot freed, 10 minute wait', async function() {
    const fake = makeDb();
    const info = seedClaim(fake);
    const before = Date.now();
    const out = await release(fake, info, 'theirs');
    const s = fake.db.store;
    assert.strictEqual(out.released, true);
    assert.strictEqual(out.message, 'Your wallet couldn\'t receive the payment. No sats were sent. You can try again in 10 minutes.');
    assert.strictEqual(s['users/' + UID].pointsClaimed, 0);
    assert.strictEqual(s['users/' + UID].satsWithdrawn, 0);
    assert.strictEqual(s['users/' + UID]._pendingClaim, undefined);
    assert.strictEqual(s['users/' + UID].lastSatsClaim.ms, PRIOR);
    assert.strictEqual(s['faucet_ledger/' + UID].lastSatsClaim.ms, PRIOR);
    assert.strictEqual(s['users/' + UID + '/sats_daily/' + TODAY].amount, 0);
    assert.strictEqual(s['faucet_stats/' + TODAY].totalPaid, 0);
    assert.deepStrictEqual(s[info.rateRef.path].claims, []);
    assert.strictEqual(s[info.invoiceRef.path].status, 'failed');
    assert.strictEqual(s[info.invoiceRef.path].released, true);
    const g = s['faucet_ledger/' + UID].faucetFailGuard;
    assert.ok(g.retryAfterMs >= before + pfg.RETRY_WAIT_MS);
    // The claim gate now waits 10 minutes, then allows a retry.
    const wait = pfg.assessRetryWait(g, s[info.rateRef.path].faucetFailGuard, Date.now());
    assert.strictEqual(wait.ok, false);
    assert.ok(/try again in 10 minutes/.test(wait.error));
    assert.strictEqual(pfg.assessRetryWait(g, null, g.retryAfterMs + 1).ok, true);
    // Restored stamp is older than the 24h cooldown, so the next claim is allowed.
    assert.ok(Date.now() - s['users/' + UID].lastSatsClaim.ms > DAY);
});

test('first ever claim failed: the cooldown stamp is removed, not backdated', async function() {
    const fake = makeDb();
    const info = seedClaim(fake, { prior: 0 });
    await release(fake, info, 'ours');
    assert.strictEqual(fake.db.store['users/' + UID].lastSatsClaim, undefined);
    assert.strictEqual(fake.db.store['faucet_ledger/' + UID].lastSatsClaim, undefined);
});

test('node offline before the send gets the our-side message', async function() {
    const fake = makeDb();
    const info = seedClaim(fake);
    const out = await release(fake, info, 'ours');
    assert.strictEqual(out.released, true);
    assert.strictEqual(out.message, pfg.OUR_SIDE_MESSAGE);
});

test('unknown outcome: nothing calls the release, so the hold and cooldown stay', function() {
    const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    const start = src.indexOf('exports.claimSats');
    const end = src.indexOf('function _unknownPayError');
    const body = src.slice(start, end);
    // Every release call sits behind a refund decision.
    const calls = body.split('_releaseFailedClaim(').length - 1;
    assert.strictEqual(calls, 3);
    assert.ok(body.indexOf("if (afterLookup.action === 'refund_only') {") !== -1);
    assert.ok(body.indexOf("_releaseFailedClaim(payInfo, today, lnRateRef, 'unconfirmed')") !== -1);
    assert.ok(body.indexOf("if (decision.action === 'refund') {") < body.indexOf('_releaseFailedClaim('));
    assert.ok(body.indexOf("if (afterLookup.action === 'refund') {") !== -1);
    // Unknown paths still hold and alert.
    assert.ok(body.split('_holdFaucetUnknown(').length - 1 >= 2);
    assert.ok(src.indexOf("type: 'unknown_payment'") !== -1);
    // No client field reaches the release decision.
    assert.ok(!/data\.(release|failed|retry|forceRelease)/.test(body));
});

test('unknown hold record is never released: a held invoice is skipped', async function() {
    const fake = makeDb();
    const info = seedClaim(fake);
    fake.db.store[info.invoiceRef.path].status = 'unknown';
    const snapshot = JSON.stringify(fake.db.store);
    const out = await release(fake, info, 'theirs');
    assert.strictEqual(out.released, false);
    assert.strictEqual(JSON.stringify(fake.db.store), snapshot);
});

test('4th failure in 24h: points refunded, but the normal cooldown applies', async function() {
    const fake = makeDb();
    for (let i = 1; i <= 3; i++) {
        const info = seedClaim(fake, { inv: 'inv' + i, ts: Date.now() - (4 - i) * 1000 });
        const out = await release(fake, info, 'theirs');
        assert.strictEqual(out.released, true, 'release ' + i);
    }
    const info = seedClaim(fake, { inv: 'inv4' });
    const stamp = fake.db.store['users/' + UID].lastSatsClaim.ms;
    const out = await release(fake, info, 'theirs');
    const s = fake.db.store;
    assert.strictEqual(out.released, false);
    assert.strictEqual(out.message, pfg.CAPPED_MESSAGE);
    assert.strictEqual(s['users/' + UID].pointsClaimed, 0);
    assert.strictEqual(s['users/' + UID].lastSatsClaim.ms, stamp);
    assert.strictEqual(s['faucet_ledger/' + UID].lastSatsClaim.ms, stamp);
    assert.strictEqual(s[info.rateRef.path].claims.length, 1);
    assert.strictEqual(s['faucet_ledger/' + UID].faucetFailGuard.at.length, 3);
    assert.strictEqual(s[info.invoiceRef.path].released, false);
    // The 4th refunds the points but keeps the daily slot and counts used.
    assert.strictEqual(s['users/' + UID + '/sats_daily/' + TODAY].amount, 200);
    assert.strictEqual(s['faucet_ledger/' + UID].claimCount, 1);
    assert.strictEqual(s['faucet_stats/' + TODAY].totalPaid, 200);
});

test('releases age out after 24 hours', function() {
    const now = Date.now();
    const old = { at: [now - DAY - 1, now - DAY - 2, now - DAY - 3], retryAfterMs: 0 };
    assert.strictEqual(pfg.planRelease({ nowMs: now, uidRow: old, addrRow: null }).release, true);
});

test('parallel race: two releases of the same claim refund once', async function() {
    const fake = makeDb();
    const info = seedClaim(fake);
    const both = await Promise.all([release(fake, info, 'theirs'), release(fake, info, 'theirs')]);
    const s = fake.db.store;
    assert.strictEqual(both.filter(function(o) { return o.released; }).length, 1);
    assert.strictEqual(s['users/' + UID].pointsClaimed, 0);
    assert.strictEqual(s['users/' + UID].satsWithdrawn, 0);
    assert.strictEqual(s['faucet_ledger/' + UID].faucetFailGuard.at.length, 1);
});

test('parallel race: concurrent failures cannot pass the cap', async function() {
    const fake = makeDb();
    const infos = [];
    for (let i = 1; i <= 5; i++) infos.push(seedClaim(fake, { inv: 'p' + i, ts: Date.now() - i }));
    const outs = await Promise.all(infos.map(function(info) { return release(fake, info, 'theirs'); }));
    assert.strictEqual(outs.filter(function(o) { return o.released; }).length, 3);
    assert.strictEqual(fake.db.store['faucet_ledger/' + UID].faucetFailGuard.at.length, 3);
});

test('a pending claim blocks a second claim, and the release is server-only', function() {
    const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    const body = src.slice(src.indexOf('exports.claimSats'), src.indexOf('function _unknownPayError'));
    const pend = body.indexOf("deny('A previous claim is still processing. Try again in a minute.')");
    const wait = body.indexOf('payFailGuard.assessRetryWait(');
    const write = body.indexOf('t.update(userRef, userUpdate)');
    assert.ok(pend !== -1 && wait !== -1 && write !== -1);
    assert.ok(pend < write && wait < write);
    assert.ok(/PENDING_TTL_MS = 10 \* 60 \* 1000/.test(body));
    // The guard rows live on server-only collections.
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    ['faucet_ledger', 'faucet_ln_ratelimit', 'faucet_invoices'].forEach(function(c) {
        const at = rules.indexOf('match /' + c + '/{docId}');
        assert.ok(at !== -1, c);
        assert.ok(/allow read, write: if false;/.test(rules.slice(at, at + 160)), c);
    });
});

test('shared address across uids: the address cap holds even with fresh uids', async function() {
    const fake = makeDb();
    for (let i = 1; i <= 3; i++) {
        const out = await release(fake, seedClaim(fake, { uid: 'uidS' + i, inv: 's' + i, ts: Date.now() - i }), 'theirs');
        assert.strictEqual(out.released, true);
    }
    const info = seedClaim(fake, { uid: 'uidS4', inv: 's4' });
    const out = await release(fake, info, 'theirs');
    assert.strictEqual(out.released, false);
    // uidS4 keeps its cooldown even though its own count is zero.
    assert.ok(fake.db.store['users/uidS4'].lastSatsClaim.ms > PRIOR);
    // The address also waits 10 minutes for every uid after a release.
    const addrRow = fake.db.store[info.rateRef.path].faucetFailGuard;
    assert.strictEqual(pfg.assessRetryWait(null, addrRow, Date.now()).ok, false);
});

test('changing the address does not reset the uid count', async function() {
    const fake = makeDb();
    for (let i = 1; i <= 3; i++) {
        await release(fake, seedClaim(fake, { addr: 'a' + i + '@w.example', inv: 'c' + i, ts: Date.now() - i }), 'theirs');
    }
    const out = await release(fake, seedClaim(fake, { addr: 'fresh@w.example', inv: 'c4' }), 'theirs');
    assert.strictEqual(out.released, false);
    // The address itself is locked to the account by the claim transaction.
    const r = guard.assessAddressLock({ callerUid: UID, requested: 'other@w.example', saved: 'fresh@w.example', lockOwner: UID });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, 'address_changed');
});

test('a commit failure releases nothing and says so', async function() {
    const fake = makeDb();
    const info = seedClaim(fake);
    const broken = Object.assign({}, deps(fake), { db: Object.assign({}, fake.db, {
        runTransaction: async function() { throw new Error('ABORTED'); },
        collection: fake.db.collection,
    }) });
    const out = await releaseFailedClaim(broken, info, TODAY, info.rateRef, 'theirs');
    assert.strictEqual(out.released, false);
    assert.ok(/No sats were sent/.test(out.message));
});


function auditRows(fake) {
    return Object.keys(fake.db.store).filter(function(k) { return k.indexOf(pfg.AUDIT_COLLECTION + '/') === 0; })
        .map(function(k) { return fake.db.store[k]; });
}

test('our-side failure releases with the 10 minute wait but never counts toward the cap', async function() {
    const fake = makeDb();
    for (let i = 1; i <= 5; i++) {
        const out = await release(fake, seedClaim(fake, { inv: 'o' + i, ts: Date.now() - i }), 'ours');
        assert.strictEqual(out.released, true, 'our-side release ' + i);
        assert.strictEqual(out.message, pfg.OUR_SIDE_MESSAGE);
    }
    const g = fake.db.store['faucet_ledger/' + UID].faucetFailGuard;
    assert.strictEqual(g.at.length, 0);
    assert.strictEqual(pfg.assessRetryWait(g, null, Date.now()).ok, false);
    const a = fake.db.store['faucet_ln_ratelimit/' + guard.addressRateDocId(ADDR)].faucetFailGuard;
    assert.strictEqual(a.at.length, 0);
    // Three their-side failures still release after five our-side ones.
    for (let i = 1; i <= 3; i++) {
        const out = await release(fake, seedClaim(fake, { inv: 't' + i, ts: Date.now() - 10 - i }), 'theirs');
        assert.strictEqual(out.released, true, 'their-side release ' + i);
    }
    const capped = await release(fake, seedClaim(fake, { inv: 't4' }), 'theirs');
    assert.strictEqual(capped.released, false);
    // An our-side failure past the cap still releases.
    const ours = await release(fake, seedClaim(fake, { inv: 'o6' }), 'ours');
    assert.strictEqual(ours.released, true);
});

test('their-side failure counts toward the cap', async function() {
    const fake = makeDb();
    await release(fake, seedClaim(fake), 'theirs');
    assert.strictEqual(fake.db.store['faucet_ledger/' + UID].faucetFailGuard.at.length, 1);
    assert.strictEqual(fake.db.store['faucet_ln_ratelimit/' + guard.addressRateDocId(ADDR)].faucetFailGuard.at.length, 1);
});

test('every processed failure writes one masked audit row', async function() {
    const fake = makeDb();
    await release(fake, seedClaim(fake, { inv: 'a1' }), 'ours');
    await release(fake, seedClaim(fake, { inv: 'a2' }), 'theirs');
    const rows = auditRows(fake).sort(function(x, y) { return x.reasonClass < y.reasonClass ? -1 : 1; });
    assert.strictEqual(rows.length, 2);
    const ours = rows[0];
    const theirs = rows[1];
    assert.strictEqual(ours.reasonClass, 'ours');
    assert.strictEqual(theirs.reasonClass, 'theirs');
    assert.strictEqual(ours.path, 'faucet');
    assert.strictEqual(ours.uidCount, 0);
    assert.strictEqual(theirs.uidCount, 1);
    assert.strictEqual(theirs.addrCount, 1);
    assert.strictEqual(theirs.released, true);
    assert.ok(theirs.retryAfterMs > Date.now());
    assert.ok(theirs.createdAtMs > 0 && theirs.createdAt);
    assert.strictEqual(theirs.uidMasked, UID.slice(0, 5) + '\u2026');
    assert.strictEqual(theirs.uidHash, pfg.uidHash(UID));
    assert.strictEqual(theirs.addressHash, pfg.addressHash(ADDR));
    const flat = JSON.stringify(rows);
    assert.ok(flat.indexOf(UID) === -1, 'no raw uid');
    assert.ok(flat.indexOf(ADDR) === -1, 'no raw address');
});

const LOG_UID = 'uLogXabcdef0123456789';
test('logs never print the full uid', async function() {
    const fake = makeDb();
    const lines = [];
    const orig = { log: console.log, error: console.error };
    console.log = function() { lines.push(Array.prototype.join.call(arguments, ' ')); };
    console.error = console.log;
    try {
        const info = seedClaim(fake, { uid: LOG_UID, inv: 'log1' });
        await release(fake, info, 'theirs');
        await release(fake, info, 'theirs'); // skipped: not pending
        const broken = Object.assign({}, deps(fake), { db: Object.assign({}, fake.db, {
            runTransaction: async function() { throw new Error('ABORTED'); }, collection: fake.db.collection,
        }) });
        await releaseFailedClaim(broken, info, TODAY, info.rateRef, 'theirs');
    } finally { console.log = orig.log; console.error = orig.error; }
    const mine = lines.filter(function(l) { return l.indexOf(LOG_UID.slice(0, 5)) !== -1; });
    assert.strictEqual(mine.length, 3);
    lines.forEach(function(l) { assert.ok(l.indexOf(LOG_UID) === -1, l); });
    mine.forEach(function(l) { assert.ok(l.indexOf(LOG_UID.slice(0, 5) + '\u2026') !== -1, l); });
});

test('held HTLC: pay refusal with a pending lookup is held, never released or refunded', async function() {
    const refusal = guard.decideFaucetPayment({ phase: 'pay', error: { code: 'PAYMENT_FAILED', message: 'x' } });
    assert.strictEqual(refusal.action, 'lookup');
    const s = await cipher.lookupSettlement({ attempts: 2, intervalMs: 0, lookup: async function() { return { state: 'pending', payment_hash: 'ab' }; } });
    assert.strictEqual(s.pending, true);
    assert.strictEqual(guard.decideFaucetLookupResult(s, { refused: true }).action, 'unknown');
    // A confirmed failed lookup is the only pay-phase release.
    assert.strictEqual(guard.decideFaucetLookupResult({ action: 'release' }, { refused: true }).action, 'refund');
    // Refusal with lookups that error out (not seen in flight): refund only.
    const e = await cipher.lookupSettlement({ attempts: 2, intervalMs: 0, lookup: async function() { throw new Error('NOT_FOUND'); } });
    assert.strictEqual(guard.decideFaucetLookupResult(e, { refused: true }).action, 'refund_only');
    // Without an explicit refusal the same lookups hold, as before.
    assert.strictEqual(guard.decideFaucetLookupResult(e).action, 'unknown');
});

test('unconfirmed refusal: points refunded, cooldown, cap slot and counts all stay', async function() {
    const fake = makeDb();
    const info = seedClaim(fake);
    const stamp = fake.db.store['users/' + UID].lastSatsClaim.ms;
    const out = await release(fake, info, 'unconfirmed');
    const st = fake.db.store;
    assert.strictEqual(out.released, false);
    assert.strictEqual(out.message, pfg.UNCONFIRMED_MESSAGE);
    assert.strictEqual(st['users/' + UID].pointsClaimed, 0);
    assert.strictEqual(st['users/' + UID].lastSatsClaim.ms, stamp);
    assert.strictEqual(st['faucet_ledger/' + UID].lastSatsClaim.ms, stamp);
    assert.strictEqual(st['faucet_ledger/' + UID].claimCount, 1);
    assert.strictEqual(st['users/' + UID + '/sats_daily/' + TODAY].amount, 200);
    assert.strictEqual(st['faucet_stats/' + TODAY].totalPaid, 200);
    assert.strictEqual(st[info.rateRef.path].claims.length, 1);
    assert.strictEqual(st['faucet_ledger/' + UID].faucetFailGuard.at.length, 0);
    assert.strictEqual(st[info.invoiceRef.path].status, 'failed');
    assert.strictEqual(st[info.invoiceRef.path].failKind, 'unconfirmed');
    const rows = auditRows(fake);
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].reasonClass, 'unconfirmed');
    assert.strictEqual(rows[0].released, false);
});

test('receiver address failure before the send gets the address message', function() {
    const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    const body = src.slice(src.indexOf('exports.claimSats'), src.indexOf('function _unknownPayError'));
    assert.ok(body.indexOf("error: clear && e.message ? e.message : payFailGuard.RECEIVER_UNRESPONSIVE_MESSAGE") !== -1);
    assert.strictEqual(pfg.RECEIVER_UNRESPONSIVE_MESSAGE, 'Your wallet\'s address didn\'t respond. No sats were sent. You can try again in 10 minutes.');
});

test('the audit collection is server-only through the catch-all rule (no rules change)', function() {
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    assert.ok(rules.indexOf('match /' + pfg.AUDIT_COLLECTION) === -1);
    const at = rules.indexOf('match /{document=**}');
    assert.ok(at !== -1);
    assert.ok(/allow read, write: if false;/.test(rules.slice(at, at + 80)));
});


test('message-only refusal text (code INTERNAL, or a timeout) goes to lookup, never release', function() {
    const internal = Object.assign(new Error('PAYMENT_FAILED: no route'), { code: 'INTERNAL' });
    const d1 = guard.decideFaucetPayment({ phase: 'pay', error: internal });
    assert.strictEqual(d1.action, 'lookup');
    assert.notStrictEqual(d1.refused, true);
    const d2 = guard.decideFaucetPayment({ phase: 'pay', error: new Error('[TIMEOUT] payInvoice PAYMENT_FAILED') });
    assert.strictEqual(d2.action, 'lookup');
    assert.notStrictEqual(d2.refused, true);
    // Not a refusal, so an inconclusive lookup holds instead of refunding.
    assert.strictEqual(guard.decideFaucetLookupResult({ action: 'hold' }, { refused: d2.refused === true }).action, 'unknown');
});

test('a pending claim under 10 minutes blocks a second pay', function() {
    const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    const body = src.slice(src.indexOf('exports.claimSats'), src.indexOf('function _unknownPayError'));
    const m = body.match(/if \(user\._pendingClaim === true\) \{[\s\S]*?PENDING_TTL_MS = 10 \* 60 \* 1000;[\s\S]*?Date\.now\(\) - pendingAt\.getTime\(\) <= PENDING_TTL_MS[\s\S]*?deny\('A previous claim is still processing/);
    assert.ok(m, 'pending gate');
    // The gate sits inside the claim transaction, before any reservation write.
    assert.ok(body.indexOf(m[0]) < body.indexOf('t.update(userRef, userUpdate)'));
    assert.ok(body.indexOf('await db.runTransaction(async (t) => {') < body.indexOf(m[0]));
});

test('audit window: failed records never push paid ones out', async function() {
    const { collectWithdrawalWindow } = require('../functions/src/faucetRelease');
    // 450 newest records are failed, then 250 paid ones.
    const all = [];
    for (let i = 0; i < 450; i++) all.push({ id: 'f' + i, data: { status: 'failed', amount: 200 } });
    for (let i = 0; i < 250; i++) all.push({ id: 'p' + i, data: { status: 'used', amount: 200 } });
    // The page fetcher returns the row objects themselves so startAfter can find them.
    const pageRows = async function(after) {
        const start = after ? all.indexOf(after) + 1 : 0;
        return all.slice(start, start + 200);
    };
    const win = await collectWithdrawalWindow(pageRows, { want: 200, maxPages: 10 });
    assert.strictEqual(win.withdrawals.length, 200);
    assert.ok(win.withdrawals.every(function(d) { return d.status === 'used'; }));
    assert.strictEqual(win.failed.length, 450);
    assert.strictEqual(win.truncated, false);
    // auditWithdrawals uses it and reports the failed view separately.
    const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    const body = src.slice(src.indexOf('exports.auditWithdrawals'), src.indexOf('exports.auditWithdrawals') + 6000);
    assert.ok(body.indexOf('collectWithdrawalWindow(') !== -1);
    assert.ok(body.indexOf('out.failedClaimCount') !== -1);
    assert.ok(body.indexOf('.limit(200).get();\n        invoiceSnap.forEach') === -1);
});

Promise.all(queue).then(function() {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
