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
    assert.strictEqual(s['cipher_sats_site_daily/' + DAY].amount, 0);
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
    assert.ok(/settlement\.action === 'release'\) return \{ action: 'release', low: false, kind: 'refused' \}/.test(src));
});

Promise.all(queue).then(function() {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
