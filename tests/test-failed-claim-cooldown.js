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
    return releaseFailedClaim(deps(fake), info, TODAY, info.rateRef, kind || 'refused');
}

// Outcome classification (unchanged rules, pinned here).
test('success: a preimage records the payment and nothing is released', function() {
    assert.strictEqual(guard.decideFaucetPayment({ phase: 'pay', payResult: { preimage: 'ab' } }).action, 'record');
});

test('definite failure: node unreachable before the send, low balance, or an explicit refusal', function() {
    assert.strictEqual(guard.decideFaucetPayment({ phase: 'balance', error: new Error('[TIMEOUT] getBalance') }).action, 'refund');
    assert.strictEqual(guard.decideFaucetPayment({ phase: 'balance', error: new Error('WALLET_LOW') }).action, 'refund');
    const refused = Object.assign(new Error('no route'), { code: 'PAYMENT_FAILED' });
    assert.strictEqual(guard.decideFaucetPayment({ phase: 'pay', error: refused }).action, 'refund');
    assert.strictEqual(guard.definiteFailureKind({ phase: 'balance', error: new Error('x') }), 'ours');
    assert.strictEqual(guard.definiteFailureKind({ phase: 'pay', error: { code: 'INSUFFICIENT_BALANCE' } }), 'ours');
    assert.strictEqual(guard.definiteFailureKind({ phase: 'pay', error: refused }), 'refused');
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
    const out = await release(fake, info, 'refused');
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
    assert.strictEqual(calls, 2);
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
    const out = await release(fake, info, 'refused');
    assert.strictEqual(out.released, false);
    assert.strictEqual(JSON.stringify(fake.db.store), snapshot);
});

test('4th failure in 24h: points refunded, but the normal cooldown applies', async function() {
    const fake = makeDb();
    for (let i = 1; i <= 3; i++) {
        const info = seedClaim(fake, { inv: 'inv' + i, ts: Date.now() - (4 - i) * 1000 });
        const out = await release(fake, info, 'refused');
        assert.strictEqual(out.released, true, 'release ' + i);
    }
    const info = seedClaim(fake, { inv: 'inv4' });
    const stamp = fake.db.store['users/' + UID].lastSatsClaim.ms;
    const out = await release(fake, info, 'refused');
    const s = fake.db.store;
    assert.strictEqual(out.released, false);
    assert.strictEqual(out.message, pfg.CAPPED_MESSAGE);
    assert.strictEqual(s['users/' + UID].pointsClaimed, 0);
    assert.strictEqual(s['users/' + UID].lastSatsClaim.ms, stamp);
    assert.strictEqual(s['faucet_ledger/' + UID].lastSatsClaim.ms, stamp);
    assert.strictEqual(s[info.rateRef.path].claims.length, 1);
    assert.strictEqual(s['faucet_ledger/' + UID].faucetFailGuard.at.length, 3);
    assert.strictEqual(s[info.invoiceRef.path].released, false);
});

test('releases age out after 24 hours', function() {
    const now = Date.now();
    const old = { at: [now - DAY - 1, now - DAY - 2, now - DAY - 3], retryAfterMs: 0 };
    assert.strictEqual(pfg.planRelease({ nowMs: now, uidRow: old, addrRow: null }).release, true);
});

test('parallel race: two releases of the same claim refund once', async function() {
    const fake = makeDb();
    const info = seedClaim(fake);
    const both = await Promise.all([release(fake, info, 'refused'), release(fake, info, 'refused')]);
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
    const outs = await Promise.all(infos.map(function(info) { return release(fake, info, 'refused'); }));
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
        const out = await release(fake, seedClaim(fake, { uid: 'uidS' + i, inv: 's' + i, ts: Date.now() - i }), 'refused');
        assert.strictEqual(out.released, true);
    }
    const info = seedClaim(fake, { uid: 'uidS4', inv: 's4' });
    const out = await release(fake, info, 'refused');
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
        await release(fake, seedClaim(fake, { addr: 'a' + i + '@w.example', inv: 'c' + i, ts: Date.now() - i }), 'refused');
    }
    const out = await release(fake, seedClaim(fake, { addr: 'fresh@w.example', inv: 'c4' }), 'refused');
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
    const out = await releaseFailedClaim(broken, info, TODAY, info.rateRef, 'refused');
    assert.strictEqual(out.released, false);
    assert.ok(/No sats were sent/.test(out.message));
});

Promise.all(queue).then(function() {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
