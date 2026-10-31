'use strict';

// Cipher sats balance credits and claims. The faucet 24h withdrawal clock
// is not an input in either direction.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const reward = require('../functions/src/cipherReward');
const claim = require('../functions/src/cipherSatsClaim');
const share = require('../functions/src/cipherShare');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

const NOW = Date.parse('2026-10-31T18:00:00.000Z');
const DAY = '2026-10-31';

function ready(extra) {
    return Object.assign({
        authed: true,
        anonymous: false,
        uid: 'player1',
        email: 'player@example.com',
        emailVerified: true,
        ageKnown: true,
        ageDays: 30,
        satsDisabled: false,
        ledgerBanned: false,
        profileBanned: false,
        satsHeld: false,
        claimsDisabled: false,
        balance: 250,
        playerDayUsed: 0,
        siteDayUsed: 0,
        day: DAY,
        nowMs: NOW,
        saved: 'player@walletofsatoshi.com',
        lockExists: true,
        lockOwner: 'player1',
        lock: null,
        rate: null,
    }, extra || {});
}

test('under 1,000 credits the balance once per open and 1,000 stays manual', () => {
    [5, 10, 25, 50, 100, 500].forEach(function(amount) {
        assert.strictEqual(reward.satsDisposition(amount), 'balance');
        const first = claim.applyCipherBalanceCredit({ users: {}, credits: {} }, {
            cipherId: 'c1', role: 'opener', uid: 'player1', amount: amount,
        });
        assert.strictEqual(first.credited, true);
        assert.strictEqual(first.balance, amount);
        const again = claim.applyCipherBalanceCredit(first.books, {
            cipherId: 'c1', role: 'opener', uid: 'player1', amount: amount,
        });
        assert.strictEqual(again.credited, false);
        assert.strictEqual(again.reason, 'already');
        assert.strictEqual(again.books.users.player1.cipherSatsBalance, amount);
        const sender = claim.applyCipherBalanceCredit(again.books, {
            cipherId: 'c1', role: 'sender', uid: 'sender1', amount: amount,
        });
        assert.strictEqual(sender.credited, true);
        assert.strictEqual(sender.books.users.sender1.cipherSatsBalance, amount);
        assert.strictEqual(sender.books.users.player1.cipherSatsBalance, amount);
    });
    [1000, 5000, 10000, 50000, 100000].forEach(function(amount) {
        assert.strictEqual(reward.satsDisposition(amount), 'manual');
        const skipped = claim.applyCipherBalanceCredit({ users: {}, credits: {} }, {
            cipherId: 'big', role: 'opener', uid: 'player1', amount: amount,
        });
        assert.strictEqual(skipped.credited, false);
    });
});

test('the sender is offered the same roll, including the new small amounts', () => {
    [5, 10, 25, 50, 100, 500, 1000].forEach(function(amount) {
        const plan = share.planCipherShare({
            cipherId: 'same' + amount,
            cipherLabel: '3A',
            openerUid: 'opener',
            openerUsername: 'bea',
            opener: { uid: 'opener', username: 'bea', created: NOW - 10 * 86400000, peers: ['sender'] },
            sender: { uid: 'sender', username: 'ada', created: NOW - 10 * 86400000, peers: ['opener'] },
            openerLedger: {},
            senderLedger: {},
            key: { status: 'sent', sender: 'sender', label: '3A' },
            reward: { rewardType: 'sats', satsAmount: amount, roll: 4 },
            openerClaim: { email: 'bea@example.com', emailVerified: true, ageKnown: true, ageDays: 30 },
            nowMs: NOW,
            today: DAY,
            senderDailyXpUsed: 0,
        });
        assert.strictEqual(plan.pay, true, String(amount));
        assert.strictEqual(plan.credit.sats, amount);
        assert.strictEqual(plan.prize.satsAmount, amount);
        assert.strictEqual(plan.prize.roll, 4);
    });
});

test('a claim pays min(balance, 200) only at 100 or more', () => {
    assert.strictEqual(claim.planCipherSatsClaim(ready({ balance: 99 })).ok, false);
    assert.strictEqual(claim.planCipherSatsClaim(ready({ balance: 100 })).amount, 100);
    assert.strictEqual(claim.planCipherSatsClaim(ready({ balance: 140 })).amount, 140);
    assert.strictEqual(claim.planCipherSatsClaim(ready({ balance: 250 })).amount, 200);
    const capped = claim.planCipherSatsClaim(ready({ balance: 180, playerDayUsed: 50 }));
    assert.strictEqual(capped.amount, 150);
    assert.strictEqual(claim.planCipherSatsClaim(ready({ balance: 180, playerDayUsed: 150 })).ok, false);
    assert.strictEqual(claim.planCipherSatsClaim(ready({ balance: 200, siteDayUsed: 1900 })).amount, 100);
    assert.strictEqual(claim.planCipherSatsClaim(ready({ balance: 200, siteDayUsed: 1950 })).ok, false);
    assert.strictEqual(claim.planCipherSatsClaim(ready({ claimsDisabled: true })).code, 'disabled');
});

test('gates match a cipher open: auth, email, age, ban, and a locked address', () => {
    assert.strictEqual(claim.planCipherSatsClaim(ready({ authed: false })).code, 'auth');
    assert.strictEqual(claim.planCipherSatsClaim(ready({ emailVerified: false })).code, 'gate');
    assert.strictEqual(claim.planCipherSatsClaim(ready({ ageDays: 6 })).code, 'gate');
    assert.strictEqual(claim.planCipherSatsClaim(ready({ satsDisabled: true })).code, 'gate');
    assert.strictEqual(claim.planCipherSatsClaim(ready({ ledgerBanned: true })).code, 'gate');
    assert.strictEqual(claim.planCipherSatsClaim(ready({ profileBanned: true })).code, 'banned');
    assert.strictEqual(claim.planCipherSatsClaim(ready({ lockExists: false })).code, 'unlocked');
    assert.strictEqual(claim.planCipherSatsClaim(ready({ lockOwner: 'other' })).code, 'conflict');
    const flying = claim.planCipherSatsClaim(ready({
        lock: { phase: 'paying', amount: 100, claimId: 'c', day: DAY, startedAtMs: NOW - 1000 },
    }));
    assert.strictEqual(flying.code, 'inflight');
});

test('a faucet withdrawal clock does not block a cipher claim', () => {
    const user = {
        cipherSatsBalance: 400,
        pointsClaimed: 0,
        satsWithdrawn: 0,
        lastSatsClaim: null,
    };
    const first = claim.planCipherSatsClaim(ready({ balance: user.cipherSatsBalance }));
    assert.strictEqual(first.ok, true);
    assert.strictEqual(first.amount, 200);
    assert.strictEqual(first.writesLastSatsClaim, false);
    assert.strictEqual(first.touchesFaucetCaps, false);
    assert.deepStrictEqual(first.userFields, ['cipherSatsBalance']);
    const patch = claim.cipherClaimUserPatch(first);
    assert.deepStrictEqual(Object.keys(patch), ['cipherSatsBalanceDelta']);
    assert.strictEqual(patch.cipherSatsBalanceDelta, -200);
    user.cipherSatsBalance += patch.cipherSatsBalanceDelta;
    assert.strictEqual(user.lastSatsClaim, null);
    assert.strictEqual(user.pointsClaimed, 0);
    assert.strictEqual(user.satsWithdrawn, 0);

    // A faucet withdrawal sets its own clock and does not touch the cipher balance.
    const faucetPatch = {
        pointsClaimed: 1000,
        satsWithdrawn: 100,
        lastSatsClaim: NOW,
        _pendingClaim: true,
        lightningAddress: 'player@walletofsatoshi.com',
    };
    assert.strictEqual(claim.faucetPatchTouchesCipher(faucetPatch), false);
    user.pointsClaimed += faucetPatch.pointsClaimed;
    user.satsWithdrawn += faucetPatch.satsWithdrawn;
    user.lastSatsClaim = faucetPatch.lastSatsClaim;
    assert.strictEqual(user.cipherSatsBalance, 200);

    const second = claim.planCipherSatsClaim(ready({
        balance: user.cipherSatsBalance,
        playerDayUsed: 0,
        siteDayUsed: 0,
    }));
    assert.strictEqual(second.ok, true, 'faucet clock must not block the cipher claim');
    assert.strictEqual(second.amount, 200);
    assert.strictEqual(second.writesLastSatsClaim, false);
});

test('a cipher claim does not start the faucet withdrawal clock', () => {
    const user = { cipherSatsBalance: 180, lastSatsClaim: 0, pointsClaimed: 0, satsWithdrawn: 0 };
    const plan = claim.planCipherSatsClaim(ready({ balance: user.cipherSatsBalance }));
    user.cipherSatsBalance += claim.cipherClaimUserPatch(plan).cipherSatsBalanceDelta;
    assert.strictEqual(user.cipherSatsBalance, 0);
    assert.strictEqual(user.lastSatsClaim, 0);
    assert.strictEqual(user.pointsClaimed, 0);
    assert.strictEqual(user.satsWithdrawn, 0);
    // The faucet clock is still empty, so a faucet withdrawal would not be waiting on this claim.
    assert.strictEqual(!!user.lastSatsClaim, false);
});

test('claim source does not read or write the faucet clock, and the faucet does not read cipher claims', () => {
    const gifting = fs.readFileSync(path.join(root, 'functions/src/gifting.js'), 'utf8');
    const body = gifting.slice(gifting.indexOf('const claimCipherSats'), gifting.indexOf('module.exports'));
    const payPath = gifting.slice(gifting.indexOf('async function payCipherBalanceInvoice'), gifting.indexOf('const claimCipherSats'));
    assert.ok(body.indexOf('const claimCipherSats') === 0);
    assert.strictEqual(body.indexOf('lastSatsClaim'), -1);
    assert.strictEqual(body.indexOf('faucet_stats'), -1);
    assert.strictEqual(body.indexOf('sats_daily'), -1);
    assert.strictEqual(body.indexOf('COOLDOWN'), -1);
    assert.strictEqual(body.indexOf('pointsClaimed'), -1);
    assert.strictEqual(body.indexOf('data.lightningAddress'), -1);
    assert.strictEqual(body.indexOf('data.invoice'), -1);
    assert.ok(body.includes('cipherSatsBalance'));
    assert.ok(body.includes("collection('cipher_sats_payouts')"));
    assert.ok(body.includes('payCipherBalanceInvoice'));
    assert.ok(body.includes('_resolvePrizeInvoice'));
    assert.ok(body.includes('requireSecondFactor'));
    assert.ok(payPath.includes('WALLET_FLOOR_SATS'));
    assert.ok(payPath.includes('nwc.payInvoice'));

    const moduleSrc = fs.readFileSync(path.join(root, 'functions/src/cipherSatsClaim.js'), 'utf8');
    assert.strictEqual(moduleSrc.indexOf('lastSatsClaim'), -1);
    assert.strictEqual(moduleSrc.indexOf('faucet_stats'), -1);
    assert.strictEqual(moduleSrc.indexOf('sats_daily'), -1);

    const index = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    const faucet = index.slice(index.indexOf('exports.claimSats ='), index.indexOf('// =====', index.indexOf('exports.claimSats =') + 10));
    assert.ok(faucet.indexOf('exports.claimSats') === 0);
    assert.ok(faucet.includes('lastSatsClaim'));
    assert.strictEqual(faucet.indexOf('cipherSatsBalance'), -1);
    assert.strictEqual(faucet.indexOf('cipher_sats'), -1);
    assert.strictEqual(faucet.indexOf('claimCipherSats'), -1);
    assert.ok(index.includes('exports.claimCipherSats = claimCipherSats'));

    const decrypt = gifting.slice(gifting.indexOf('const decryptCipher'), gifting.indexOf('const claimCipherWin'));
    assert.ok(decrypt.includes('ALLOWED_SATS_AMOUNTS'));
    assert.ok(decrypt.includes('100000, 50000, 10000, 5000, 1000, 500, 100, 50, 25, 10, 5'));
    assert.strictEqual(decrypt.indexOf('[100, 500, 1000, 5000, 10000, 50000, 100000]'), -1);
    assert.ok(decrypt.includes("collection('cipher_sats_credits')"));
    assert.ok(decrypt.includes('cipherSatsBalance'));
    assert.ok(decrypt.includes("sats added to your cipher balance"));
    assert.deepStrictEqual(reward.ALLOWED_SATS_AMOUNTS, [100000, 50000, 10000, 5000, 1000, 500, 100, 50, 25, 10, 5]);
});

test('rules deny client writes of the balance and the claim collections', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const keysFn = rules.slice(rules.indexOf('function userProfileServerOnlyKeys()'), rules.indexOf('match /users/{userId}'));
    assert.ok(keysFn.includes("'cipherSatsBalance'"));
    const blocked = rules.slice(rules.indexOf('function profileUpdateBlocked()'), rules.indexOf('function profileShapeOk()'));
    assert.ok(blocked.includes("'cipherSatsBalance'"));
    ['cipher_sats_credits', 'cipher_sats_locks', 'cipher_sats_player_daily', 'cipher_sats_site_daily', 'cipher_sats_payouts', 'cipher_sats_invoices'].forEach(function(name) {
        const chunk = rules.slice(rules.indexOf('match /' + name + '/{docId}'));
        assert.ok(chunk.indexOf('allow read, write: if false') !== -1, name);
    });
    const config = rules.slice(rules.indexOf('match /cipher_sats_config/{docId}'));
    assert.ok(config.includes('allow write: if false'));
});

test('the client shows the balance and claim button without publishing caps', () => {
    function cipherUi(src, id) {
        const at = src.indexOf(id);
        assert.ok(at !== -1, id);
        return src.slice(at, at + 1800);
    }
    const gifting = fs.readFileSync(path.join(root, 'gifting.js'), 'utf8');
    const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
    const quests = fs.readFileSync(path.join(root, 'quests.js'), 'utf8');
    const mount = gifting.slice(gifting.indexOf('function mountCipherSatsBalance'), gifting.indexOf('function _lockedCipherNote'));
    assert.ok(mount.includes("btn.textContent = 'Claim ' + Math.min(bal, 200).toLocaleString() + ' sats'"));
    assert.ok(mount.includes('Cipher sats balance'));
    assert.strictEqual(mount.indexOf('claim 100-200 sats'), -1);
    assert.ok(gifting.includes('cipherSatsBalanceOpen'));
    assert.ok(gifting.includes('cipherSatsBalanceCiphers'));
    assert.ok(gifting.includes("getElementById('cipherSatsBalanceInventory')"));
    [mount, cipherUi(ranking, 'cipherSatsBalanceSettings'), cipherUi(quests, 'cipherSatsBalanceInventory')].forEach(function(chunk) {
        assert.ok(chunk.includes('Claim '));
        assert.strictEqual(chunk.indexOf('claim 100-200 sats'), -1);
        assert.strictEqual(chunk.indexOf('2,000'), -1);
        assert.strictEqual(/kill switch/i.test(chunk), false);
        assert.strictEqual(chunk.indexOf('per day'), -1);
    });
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    assert.ok(app.includes('Smaller sats wins are added to your cipher sats balance.'));
    const open = fs.readFileSync(path.join(root, 'gifting.js'), 'utf8');
    assert.ok(open.includes("'+' + amt + ' sats added to your cipher balance'"));
});

test('a pay starts only while this claim is still reserved', () => {
    const claimId = 'claimA';
    const uid = 'player1';
    assert.strictEqual(claim.claimReadyToPay({
        lock: { claimId: claimId, phase: 'reserved', uid: uid },
        audit: { claimId: claimId, status: 'reserved' },
        claimId: claimId,
        uid: uid,
    }), true);
    assert.strictEqual(claim.claimReadyToPay({
        lock: { claimId: 'claimB', phase: 'reserved', uid: uid },
        audit: { claimId: claimId, status: 'reserved' },
        claimId: claimId,
        uid: uid,
    }), false);
    assert.strictEqual(claim.claimReadyToPay({
        lock: { claimId: claimId, phase: 'paying', uid: uid },
        audit: { claimId: claimId, status: 'reserved' },
        claimId: claimId,
        uid: uid,
    }), false);
    assert.strictEqual(claim.claimReadyToPay({
        lock: null,
        audit: { claimId: claimId, status: 'reserved' },
        claimId: claimId,
        uid: uid,
    }), false);
    assert.strictEqual(claim.claimReadyToPay({
        lock: { claimId: claimId, phase: 'reserved', uid: uid },
        audit: { claimId: claimId, status: 'restored' },
        claimId: claimId,
        uid: uid,
    }), false);
    assert.strictEqual(claim.lockOwnedByClaim({ claimId: 'claimB', phase: 'reserved' }, claimId), false);
    assert.strictEqual(claim.lockOwnedByClaim({ claimId: claimId, phase: 'paying' }, claimId), true);
    assert.strictEqual(claim.ABANDON_MS, 10 * 60 * 1000);
    assert.ok(claim.ABANDON_MS > 180 * 1000);
    const fresh = claim.planCipherSatsClaim(ready({
        balance: 200,
        lock: { phase: 'reserved', amount: 100, claimId: 'old', day: DAY, startedAtMs: NOW - (9 * 60 * 1000) },
    }));
    assert.strictEqual(fresh.code, 'inflight');
    const stale = claim.planCipherSatsClaim(ready({
        balance: 100,
        lock: { phase: 'reserved', amount: 100, claimId: 'old', day: DAY, startedAtMs: NOW - claim.ABANDON_MS },
    }));
    assert.strictEqual(stale.ok, true);
});

test('a missing cipher sats config disables claims', () => {
    assert.strictEqual(claim.claimsDisabledFromConfig(false, null), true);
    assert.strictEqual(claim.claimsDisabledFromConfig(false, { disabled: false }), true);
    assert.strictEqual(claim.claimsDisabledFromConfig(true, { disabled: true }), true);
    assert.strictEqual(claim.claimsDisabledFromConfig(true, { disabled: false }), false);
    assert.strictEqual(claim.claimsDisabledFromConfig(true, {}), false);
    const gifting = fs.readFileSync(path.join(root, 'functions/src/gifting.js'), 'utf8');
    const body = gifting.slice(gifting.indexOf('const claimCipherSats'), gifting.indexOf('module.exports'));
    const payAt = body.indexOf('const paid = await payCipherBalanceInvoice(invoice)');
    const gateAt = body.indexOf('readyToPay = await beginCipherPay(reserved)');
    assert.ok(gateAt !== -1 && payAt !== -1 && gateAt < payAt);
    assert.ok(body.includes('if (!readyToPay)'));
    assert.ok(body.includes('claimsDisabledFromConfig'));
    assert.ok(body.includes('lockOwnedByClaim'));
    assert.ok(body.includes("claim=' + reserved.claimId"));
    assert.ok(body.includes('const adminResolveCipherSatsClaim'));
    assert.ok(body.includes("collection('admin_audit_log')"));
    assert.strictEqual(body.indexOf('callerIp'), -1);
    assert.ok(body.includes('requireAdmin(context)'));
    assert.ok(body.includes('enforceAppCheck: true'));
    assert.ok(body.includes('adminMayResolveClaim'));
    assert.ok(body.includes('adminReleaseFromLookup'));
    assert.ok(body.includes('lookupInvoice'));
    assert.ok(body.includes('invoiceHash: invoiceHash'));
    assert.ok(body.includes('paymentHash: paymentHash'));
    const settings = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
    assert.ok(settings.includes('Separate from your faucet balance'));
    assert.ok(settings.includes('adminResolveCipherSatsClaim: 1'));
});

test('admin resolve allows held claims and only a stale paying claim', () => {
    assert.deepStrictEqual(claim.adminMayResolveClaim({ status: 'unknown', nowMs: NOW }), { ok: true, reason: 'held' });
    assert.deepStrictEqual(claim.adminMayResolveClaim({ status: 'hold', nowMs: NOW }), { ok: true, reason: 'held' });
    assert.strictEqual(claim.adminMayResolveClaim({
        status: 'paying',
        payingAtMs: NOW - claim.ABANDON_MS,
        nowMs: NOW,
    }).ok, true);
    assert.strictEqual(claim.adminMayResolveClaim({
        status: 'paying',
        payingAtMs: NOW - (9 * 60 * 1000),
        nowMs: NOW,
    }).reason, 'paying-fresh');
    assert.strictEqual(claim.adminMayResolveClaim({ status: 'paying', nowMs: NOW }).ok, false);
    ['reserved', 'paid', 'restored', 'claimable', ''].forEach(function(status) {
        assert.strictEqual(claim.adminMayResolveClaim({ status: status, nowMs: NOW }).reason, 'not-held', status);
    });
});

test('a release refunds only when the wallet says the payment failed', () => {
    assert.strictEqual(claim.adminReleaseFromLookup('failed'), 'release');
    assert.strictEqual(claim.adminReleaseFromLookup('paid'), 'paid');
    ['pending', 'unknown', 'error', '', 'expired'].forEach(function(kind) {
        assert.strictEqual(claim.adminReleaseFromLookup(kind), 'refuse', kind);
    });
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
