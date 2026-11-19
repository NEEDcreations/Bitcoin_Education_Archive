// Cipher sats (Timechain TV drip pot balance) withdrawals: a definite failure
// gives the day's limit back after a short wait, an unknown outcome stays held,
// and the release is capped per account and per address.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const pfg = require('../functions/src/payFailGuard');
const guard = require('../functions/src/faucetGuard');
const csc = require('../functions/src/cipherSatsClaim');
const { failCipherClaim } = require('../functions/src/cipherSatsRelease');
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

const DAY = '2026-11-18';
const UID = 'uidC1234';
const ADDR = 'carol@wallet.example';

// State right after claimCipherSats reserved 200 and beginCipherPay flipped it to paying.
function seed(fake, opts) {
    const o = opts || {};
    const uid = o.uid || UID;
    const addr = o.addr || ADDR;
    const claimId = o.claimId || 'c1';
    const s = fake.db.store;
    s['users/' + uid] = s['users/' + uid] || { cipherSatsBalance: 1000 };
    s['users/' + uid].cipherSatsBalance -= 200;
    const pd = 'cipher_sats_player_daily/' + uid + '_' + DAY;
    s[pd] = { amount: ((s[pd] || {}).amount || 0) + 200, day: DAY };
    s['cipher_sats_site_daily/' + DAY] = { amount: ((s['cipher_sats_site_daily/' + DAY] || {}).amount || 0) + 200 };
    s['cipher_sats_locks/' + uid] = { uid: uid, phase: 'paying', amount: 200, claimId: claimId, day: DAY, startedAtMs: Date.now() };
    s['cipher_sats_payouts/' + claimId] = { uid: uid, amount: 200, status: o.status || 'paying', day: DAY, claimId: claimId };
    return { uid: uid, lockId: uid, claimId: claimId, amount: 200, fee: 10, net: 190, address: addr, day: DAY, playerDayId: uid + '_' + DAY };
}

function fail(fake, reserved, kind) {
    return failCipherClaim({ db: fake.db, admin: makeAdmin() }, reserved, kind || 'refused');
}

test('success: a settled claim is not touched by the failure path', async function() {
    const fake = makeDb();
    const r = seed(fake, { status: 'paid' });
    const snap = JSON.stringify(fake.db.store);
    const out = await fail(fake, r);
    assert.strictEqual(out.applied, false);
    assert.strictEqual(JSON.stringify(fake.db.store), snap);
});

test('definite failure: balance and day limit restored, lock cleared, 10 minute wait', async function() {
    const fake = makeDb();
    const r = seed(fake);
    const out = await fail(fake, r, 'refused');
    const s = fake.db.store;
    assert.strictEqual(out.applied, true);
    assert.strictEqual(out.released, true);
    assert.strictEqual(out.message, pfg.RELEASED_MESSAGE);
    assert.strictEqual(s['users/' + UID].cipherSatsBalance, 1000);
    assert.strictEqual(s['cipher_sats_player_daily/' + UID + '_' + DAY].amount, 0);
    assert.strictEqual(s['cipher_sats_site_daily/' + DAY].amount, 0);
    assert.strictEqual(s['cipher_sats_locks/' + UID], undefined);
    assert.strictEqual(s['cipher_sats_payouts/c1'].status, 'restored');
    assert.strictEqual(s['cipher_sats_payouts/c1'].released, true);
    const row = s['faucet_ledger/' + UID].cipherFailGuard;
    assert.strictEqual(pfg.assessRetryWait(row, null, Date.now()).ok, false);
    assert.strictEqual(pfg.assessRetryWait(row, null, row.retryAfterMs + 1).ok, true);
    // The faucet guard row is separate, so a cipher failure does not gate the faucet.
    assert.strictEqual(s['faucet_ledger/' + UID].faucetFailGuard, undefined);
    // With the day restored the planner allows the next claim.
    const plan = csc.planCipherSatsClaim({
        authed: true, uid: UID, email: 'c@x.example', emailVerified: true, ageKnown: true, ageDays: 30,
        balance: s['users/' + UID].cipherSatsBalance, playerDayUsed: 0, siteDayUsed: 0, day: DAY, nowMs: Date.now(),
        saved: ADDR, lockExists: true, lockOwner: UID, lock: null, rate: null, claimsDisabled: false,
    });
    assert.strictEqual(plan.ok, true);
});

test('unknown outcome: a held claim is never restored and still blocks new claims', async function() {
    const fake = makeDb();
    const r = seed(fake, { status: 'unknown' });
    fake.db.store['cipher_sats_locks/' + UID].phase = 'unknown';
    const snap = JSON.stringify(fake.db.store);
    const out = await fail(fake, r);
    assert.strictEqual(out.applied, false);
    assert.strictEqual(JSON.stringify(fake.db.store), snap);
    const norm = csc.normalizeClaimState({ lock: fake.db.store['cipher_sats_locks/' + UID], nowMs: Date.now() + 48 * 3600000, day: DAY });
    assert.strictEqual(norm.inFlight, true);
});

test('pending (paying) lock blocks a second claim and is never treated as abandoned', function() {
    const norm = csc.normalizeClaimState({ lock: { phase: 'paying', startedAtMs: 1, amount: 200 }, nowMs: Date.now(), day: DAY });
    assert.strictEqual(norm.inFlight, true);
    assert.strictEqual(norm.abandon, null);
});

test('4th failure in 24h: balance restored, but the day limit stays used', async function() {
    const fake = makeDb();
    for (let i = 1; i <= 3; i++) {
        const out = await fail(fake, seed(fake, { claimId: 'k' + i }));
        assert.strictEqual(out.released, true, 'release ' + i);
    }
    const out = await fail(fake, seed(fake, { claimId: 'k4' }));
    const s = fake.db.store;
    assert.strictEqual(out.applied, true);
    assert.strictEqual(out.released, false);
    assert.strictEqual(out.message, pfg.CAPPED_MESSAGE);
    assert.strictEqual(s['users/' + UID].cipherSatsBalance, 1000);
    assert.strictEqual(s['cipher_sats_player_daily/' + UID + '_' + DAY].amount, 200);
    assert.strictEqual(s['cipher_sats_site_daily/' + DAY].amount, 200);
});

test('parallel race: the same failed claim restores once', async function() {
    const fake = makeDb();
    const r = seed(fake);
    const outs = await Promise.all([fail(fake, r), fail(fake, r), fail(fake, r)]);
    assert.strictEqual(outs.filter(function(o) { return o.applied; }).length, 1);
    assert.strictEqual(fake.db.store['users/' + UID].cipherSatsBalance, 1000);
    assert.strictEqual(fake.db.store['cipher_sats_player_daily/' + UID + '_' + DAY].amount, 0);
});

test('shared address across uids: the address cap holds for a fresh uid', async function() {
    const fake = makeDb();
    for (let i = 1; i <= 3; i++) {
        const out = await fail(fake, seed(fake, { uid: 'uidT' + i, claimId: 't' + i }));
        assert.strictEqual(out.released, true);
    }
    const out = await fail(fake, seed(fake, { uid: 'uidT4', claimId: 't4' }));
    assert.strictEqual(out.released, false);
    assert.strictEqual(fake.db.store['cipher_sats_player_daily/uidT4_' + DAY].amount, 200);
});

test('changing the address does not reset the uid count', async function() {
    const fake = makeDb();
    for (let i = 1; i <= 3; i++) await fail(fake, seed(fake, { addr: 'x' + i + '@w.example', claimId: 'a' + i }));
    const out = await fail(fake, seed(fake, { addr: 'new@w.example', claimId: 'a4' }));
    assert.strictEqual(out.released, false);
});

test('claimCipherSats wiring: wait checked in the claim transaction, release only after a definite failure', function() {
    const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'gifting.js'), 'utf8');
    const body = src.slice(src.indexOf('const claimCipherSats = '), src.indexOf('const adminResolveCipherSatsClaim'));
    const wait = body.indexOf('payFailGuard.assessRetryWait(');
    const reserve = body.indexOf('t.set(lockRef, {');
    assert.ok(wait !== -1 && reserve !== -1 && wait < reserve);
    const hold = body.indexOf("if (paid.action === 'hold') {");
    const release = body.indexOf("failCipherClaim(");
    assert.ok(hold !== -1 && release > hold);
    assert.strictEqual(body.split('failCipherClaim(').length - 1, 1);
    assert.ok(!/data\.(release|failed|retry|forceRelease)/.test(body));
    // The guard row read happens before the first write in the transaction.
    const read = body.indexOf("doc(faucetGuard.addressRateDocId(saved))");
    const firstWrite = body.indexOf('t.set(rateRef');
    assert.ok(read !== -1 && read < firstWrite);
    // payCipherBalanceInvoice reports which side failed; lookups that are not failed hold.
    assert.ok(/kind: faucetGuard\.definiteFailureKind\(\{ phase: phase, error: payError \}\)/.test(src));
    // K1: a pay-phase refusal is looked up; release only on a confirmed failed lookup.
    // N5: payErrorAction no longer releases pay-phase refusals, so only a
    // balance-phase failure skips the lookup.
    const payFn = src.slice(src.indexOf('async function payCipherBalanceInvoice'), src.indexOf('async function finishCipherClaim'));
    assert.ok(/if \(!shouldLookupPay\(\{ phase: phase, error: payError, payResult: payResult \}\)\) \{/.test(payFn));
    assert.ok(/kind: explicitPayRefusal\(payError\) \? faucetGuard\.definiteFailureKind/.test(payFn));
    // Inconclusive lookups (pending, empty, error, unclassified) hold, even after a refusal.
    assert.ok(src.indexOf("refund_only") === -1);
    assert.ok(/failKind = paid\.kind \|\| 'theirs';/.test(src));
    const pay = src.slice(src.indexOf('async function payCipherBalanceInvoice'), src.indexOf('async function finishCipherClaim'));
    assert.ok(/if \(settlement\.action === 'release'\) \{/.test(pay));
    assert.ok(/\n    return \{ action: 'hold' \};\n\}\s*$/.test(pay));
});


const cipherClaim = require('../functions/src/cipherClaim');
function auditRows(fake) {
    return Object.keys(fake.db.store).filter(function(k) { return k.indexOf(pfg.AUDIT_COLLECTION + '/') === 0; })
        .map(function(k) { return fake.db.store[k]; });
}

test('our-side failure restores the day with the 10 minute wait but never counts', async function() {
    const fake = makeDb();
    for (let i = 1; i <= 5; i++) {
        const out = await fail(fake, seed(fake, { claimId: 'o' + i }), 'ours');
        assert.strictEqual(out.released, true, 'ours ' + i);
    }
    const row = fake.db.store['faucet_ledger/' + UID].cipherFailGuard;
    assert.strictEqual(row.at.length, 0);
    assert.strictEqual(pfg.assessRetryWait(row, null, Date.now()).ok, false);
    assert.strictEqual(fake.db.store['cipher_sats_player_daily/' + UID + '_' + DAY].amount, 0);
});

test('their-side failure counts toward the cap', async function() {
    const fake = makeDb();
    await fail(fake, seed(fake), 'theirs');
    assert.strictEqual(fake.db.store['faucet_ledger/' + UID].cipherFailGuard.at.length, 1);
    assert.strictEqual(fake.db.store['faucet_ln_ratelimit/' + guard.addressRateDocId(ADDR)].cipherFailGuard.at.length, 1);
});

test('every processed failure writes one masked audit row', async function() {
    const fake = makeDb();
    await fail(fake, seed(fake, { claimId: 'x1' }), 'ours');
    await fail(fake, seed(fake, { claimId: 'x2' }), 'theirs');
    const rows = auditRows(fake);
    assert.strictEqual(rows.length, 2);
    rows.forEach(function(r) {
        assert.strictEqual(r.path, 'cipher');
        assert.strictEqual(r.uidMasked, UID.slice(0, 5) + '\u2026');
        assert.strictEqual(r.uidHash, pfg.uidHash(UID));
        assert.strictEqual(r.addressHash, pfg.addressHash(ADDR));
        assert.ok(r.createdAtMs > 0);
    });
    const theirs = rows.filter(function(r) { return r.reasonClass === 'theirs'; })[0];
    const ours = rows.filter(function(r) { return r.reasonClass === 'ours'; })[0];
    assert.strictEqual(ours.uidCount, 0);
    assert.strictEqual(theirs.uidCount, 1);
    assert.strictEqual(theirs.claimId, 'x2');
    const flat = JSON.stringify(rows);
    assert.ok(flat.indexOf(UID) === -1 && flat.indexOf(ADDR) === -1);
});

test('unconfirmed refusal: balance back, both day totals stay used, nothing counted', async function() {
    const fake = makeDb();
    const out = await fail(fake, seed(fake), 'unconfirmed');
    const s = fake.db.store;
    assert.strictEqual(out.applied, true);
    assert.strictEqual(out.released, false);
    assert.strictEqual(out.message, pfg.UNCONFIRMED_MESSAGE);
    assert.strictEqual(s['users/' + UID].cipherSatsBalance, 1000);
    assert.strictEqual(s['cipher_sats_player_daily/' + UID + '_' + DAY].amount, 200);
    assert.strictEqual(s['cipher_sats_site_daily/' + DAY].amount, 200);
    assert.strictEqual(s['faucet_ledger/' + UID].cipherFailGuard.at.length, 0);
    assert.strictEqual(auditRows(fake)[0].reasonClass, 'unconfirmed');
});

test('message-only refusal text (code INTERNAL, or a timeout) goes to lookup, never release', function() {
    const internal = Object.assign(new Error('PAYMENT_FAILED: route hint'), { code: 'INTERNAL' });
    assert.strictEqual(cipherClaim.payErrorAction({ phase: 'pay', error: internal }), 'lookup');
    assert.strictEqual(cipherClaim.payErrorAction({ phase: 'pay', error: new Error('[TIMEOUT] payInvoice PAYMENT_FAILED') }), 'lookup');
    assert.strictEqual(cipherClaim.explicitPayRefusal(new Error('INSUFFICIENT_BALANCE')), false);
    assert.strictEqual(cipherClaim.explicitPayRefusal({ code: 'PAYMENT_FAILED' }), true);
});

test('held HTLC: a pending lookup after a refusal is held (cipher)', async function() {
    const s = await cipherClaim.lookupSettlement({ attempts: 2, intervalMs: 0, lookup: async function() { return { state: 'in_flight' }; } });
    assert.strictEqual(s.action, 'hold');
    assert.strictEqual(s.pending, true);
    // payCipherBalanceInvoice never refunds an inconclusive lookup.
    const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'gifting.js'), 'utf8');
    assert.ok(src.indexOf("refund_only") === -1);
});

test('exact refusal + lookup empty or error is held (cipher); a later settle cannot double-pay', async function() {
    const err = await cipherClaim.lookupSettlement({ attempts: 2, intervalMs: 0, lookup: async function() { throw new Error('NOT_FOUND'); } });
    assert.strictEqual(err.action, 'hold');
    assert.notStrictEqual(err.pending, true);
    const empty = await cipherClaim.lookupSettlement({ attempts: 2, intervalMs: 0, lookup: async function() { return {}; } });
    assert.strictEqual(empty.action, 'hold');
    // A held claim goes to finishCipherClaim(reserved, 'hold'): status unknown, balance NOT restored.
    const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'gifting.js'), 'utf8');
    const fin = src.slice(src.indexOf('async function finishCipherClaim'), src.indexOf('async function beginCipherPay'));
    const holdAt = fin.indexOf("if (outcome === 'hold') {");
    const returnAt = fin.indexOf('return;', holdAt);
    const refundAt = fin.indexOf('cipherSatsBalance: admin.firestore.FieldValue.increment(reserved.amount)');
    assert.ok(holdAt !== -1 && returnAt > holdAt && refundAt > returnAt);
    // And a finished claim (paid, restored or unknown) is never touched again by this path.
    assert.ok(fin.indexOf("if (status === 'paid' || status === 'restored' || status === 'unknown') return;") !== -1);
});

test('cipher receiver address failure gets the address message', function() {
    const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'gifting.js'), 'utf8');
    const body = src.slice(src.indexOf('const claimCipherSats = '), src.indexOf('const adminResolveCipherSatsClaim'));
    assert.ok(body.indexOf("return { success: false, error: payFailGuard.RECEIVER_UNRESPONSIVE_MESSAGE };") !== -1);
});

Promise.all(queue).then(function() {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
