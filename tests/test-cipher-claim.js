// Cipher claim settlement and entry checks. No Firebase.
const assert = require('assert');
const {
    assessCipherClaim,
    isSatsBanned,
    SATS_BANNED_ERROR,
    lookupRequestFromDecoded,
    shouldLookupPay,
    payErrorAction,
    EXPLICIT_PAY_REFUSALS,
    classifyLookup,
    decideAfterLookups,
    lookupSettlement,
    adminClaimFlag,
    LOOKUP_ATTEMPTS,
    LOOKUP_INTERVAL_MS,
    SATS_DISABLED_ERROR,
} = require('../functions/src/cipherClaim');
const { rollGiftCount, rollGiftReward } = require('../functions/src/giftRoll');
const { splitDailyXp, DAILY_POINTS_CAP } = require('../functions/src/dailyXp');

let passed = 0, failed = 0;
function test(name, fn) {
    try {
        const out = fn();
        if (out && typeof out.then === 'function') {
            return out.then(function() { console.log('✅ ' + name); passed++; }, function(e) {
                console.log('❌ ' + name + ': ' + e.message);
                failed++;
            });
        }
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    }
    return Promise.resolve();
}

function scripted(values) {
    let i = 0;
    return function(min, max) {
        const v = values[i++];
        assert.ok(v >= min && v < max, 'scripted roll ' + v + ' outside ' + min + '..' + max);
        return v;
    };
}

const LABELS = ['3A', '7F', 'B2'];
const CLOSET = [{ id: 'crown', name: 'Royal Crown', emoji: '👑' }];
const okClaim = { email: 'a@b.co', emailVerified: true, ageKnown: true, ageDays: 7, satsDisabled: false, ledgerBanned: false };

const queue = [];
function later(name, fn) { queue.push(test(name, fn)); }

later('verified email, 7-day account, and no ban can claim', function() {
    assert.deepStrictEqual(assessCipherClaim(okClaim), { ok: true });
});

later('missing or unverified email is rejected', function() {
    const missing = assessCipherClaim(Object.assign({}, okClaim, { email: '' }));
    const unverified = assessCipherClaim(Object.assign({}, okClaim, { emailVerified: false }));
    assert.strictEqual(missing.ok, false);
    assert.strictEqual(missing.error, 'Verified email required. Link and verify your email in Account settings.');
    assert.strictEqual(unverified.error, missing.error);
});

later('account younger than 7 days is rejected with the faucet message', function() {
    const young = assessCipherClaim(Object.assign({}, okClaim, { ageDays: 6 }));
    assert.strictEqual(young.ok, false);
    assert.strictEqual(young.error, 'Account must be at least 7 days old. Yours is 6 days.');
    const unknown = assessCipherClaim(Object.assign({}, okClaim, { ageKnown: false }));
    assert.strictEqual(unknown.error, 'Could not verify account age. Try again later.');
});

later('satsDisabled or a faucet ledger ban cuts off every sats path', function() {
    assert.strictEqual(isSatsBanned({ satsDisabled: true }, null), true);
    assert.strictEqual(isSatsBanned({}, { banned: true }), true);
    assert.strictEqual(isSatsBanned({ satsDisabled: true }, { banned: true }), true);
    assert.strictEqual(isSatsBanned({ satsDisabled: false }, { banned: false }), false);
    assert.strictEqual(isSatsBanned(null, null), false);
    assert.strictEqual(isSatsBanned({}, {}), false);
    assert.ok(SATS_BANNED_ERROR.indexOf('Sats are disabled') === 0);
});

later('satsDisabled or ledger ban blocks the claim', function() {
    const disabled = assessCipherClaim(Object.assign({}, okClaim, { satsDisabled: true }));
    const banned = assessCipherClaim(Object.assign({}, okClaim, { ledgerBanned: true }));
    assert.strictEqual(disabled.ok, false);
    assert.strictEqual(disabled.error, SATS_DISABLED_ERROR);
    assert.strictEqual(banned.error, SATS_DISABLED_ERROR);
});

later('payment hash is read from the decoded invoice', function() {
    const req = lookupRequestFromDecoded({
        tags: [{ tagName: 'payment_hash', data: 'abc123' }, { tagName: 'description', data: 'prize' }],
    });
    assert.deepStrictEqual(req, { payment_hash: 'abc123' });
    assert.strictEqual(lookupRequestFromDecoded({ tags: [] }), null);
});

later('only an explicit wallet refusal skips the lookup and releases', function() {
    assert.strictEqual(payErrorAction({ phase: 'balance', error: new Error('[TIMEOUT] getBalance') }), 'release');
    assert.strictEqual(shouldLookupPay({ phase: 'balance', error: new Error('[TIMEOUT] getBalance') }), false);
    assert.strictEqual(payErrorAction({ phase: 'pay', error: new Error('[TIMEOUT] payInvoice') }), 'lookup');
    assert.strictEqual(payErrorAction({ phase: 'pay', error: new Error('NO_PREIMAGE') }), 'lookup');
    assert.strictEqual(payErrorAction({ phase: 'pay', payResult: null }), 'lookup');
    assert.strictEqual(payErrorAction({ phase: 'pay', payResult: { preimage: 'ee' } }), 'paid');
    EXPLICIT_PAY_REFUSALS.forEach(function(code) {
        const err = Object.assign(new Error('wallet refused'), { code: code });
        assert.strictEqual(payErrorAction({ phase: 'pay', error: err }), 'release', code);
        assert.strictEqual(shouldLookupPay({ phase: 'pay', error: err }), false, code);
        assert.strictEqual(payErrorAction({ phase: 'pay', error: new Error(code) }), 'release', code);
    });
    assert.deepStrictEqual(EXPLICIT_PAY_REFUSALS, ['PAYMENT_FAILED', 'INSUFFICIENT_BALANCE', 'QUOTA_EXCEEDED', 'RATE_LIMITED']);
});

later('settled lookup is paid, failed lookup releases, pending holds', function() {
    assert.strictEqual(classifyLookup({ preimage: 'deadbeef', payment_hash: 'abc' }).kind, 'paid');
    assert.strictEqual(classifyLookup({ settled_at: 10, payment_hash: 'abc' }).kind, 'paid');
    assert.strictEqual(classifyLookup({ state: 'failed', payment_hash: 'abc' }).kind, 'failed');
    assert.strictEqual(classifyLookup({ payment_hash: 'abc', invoice: 'lnbc1' }).kind, 'pending');
    assert.deepStrictEqual(decideAfterLookups([{ kind: 'pending' }, { kind: 'paid', preimage: 'abc' }]), { action: 'paid', preimage: 'abc' });
    assert.strictEqual(decideAfterLookups([{ kind: 'pending' }, { kind: 'failed' }]).action, 'release');
    assert.strictEqual(decideAfterLookups([{ kind: 'pending' }, { kind: 'pending' }]).action, 'hold');
    assert.strictEqual(decideAfterLookups([{ kind: 'error' }, { kind: 'unknown' }, { kind: 'error' }]).action, 'hold');
    assert.strictEqual(decideAfterLookups([]).action, 'hold');
    assert.notStrictEqual(classifyLookup({ state: 'expired', payment_hash: 'abc' }).kind, 'failed');
    assert.notStrictEqual(classifyLookup({ state: 'failure' }).kind, 'failed');
    assert.strictEqual(decideAfterLookups([{ kind: 'pending' }, { kind: 'error' }]).action, 'hold');
});

later('lookup retries a few times across 60s, then holds a still-pending payment', async function() {
    const sleeps = [];
    let calls = 0;
    const decision = await lookupSettlement({
        lookup: async function() {
            calls++;
            return { payment_hash: 'abc', invoice: 'lnbc1' };
        },
        sleep: async function(ms) { sleeps.push(ms); },
    });
    assert.strictEqual(decision.action, 'hold');
    assert.strictEqual(calls, LOOKUP_ATTEMPTS);
    assert.strictEqual(sleeps.length, LOOKUP_ATTEMPTS - 1);
    assert.ok(sleeps.every(function(ms) { return ms === LOOKUP_INTERVAL_MS; }));
    assert.strictEqual(LOOKUP_INTERVAL_MS * (LOOKUP_ATTEMPTS - 1), 60000);
});

later('lookup stops when the payment has settled and returns the preimage', async function() {
    const sleeps = [];
    let calls = 0;
    const decision = await lookupSettlement({
        lookup: async function() {
            calls++;
            if (calls < 2) return { state: 'pending', payment_hash: 'abc' };
            return { preimage: 'cafebabe', payment_hash: 'abc' };
        },
        sleep: async function(ms) { sleeps.push(ms); },
    });
    assert.deepStrictEqual(decision, { action: 'paid', preimage: 'cafebabe' });
    assert.strictEqual(calls, 2);
    assert.deepStrictEqual(sleeps, [LOOKUP_INTERVAL_MS]);
});

later('unknown lookups with no preimage hold the prize', async function() {
    const decision = await lookupSettlement({
        lookup: async function() { throw new Error('[TIMEOUT] lookupInvoice'); },
        sleep: async function() {},
        attempts: 3,
        intervalMs: 0,
    });
    assert.strictEqual(decision.action, 'hold');
});

later('an expired invoice is not treated as a failed payment', async function() {
    const decision = await lookupSettlement({
        lookup: async function() { return { state: 'expired', payment_hash: 'abc', invoice: 'lnbc1' }; },
        sleep: async function() {},
        attempts: 2,
        intervalMs: 0,
    });
    assert.strictEqual(classifyLookup({ state: 'expired' }).kind !== 'failed', true);
    assert.strictEqual(decision.action, 'hold');
});

later('NOT_FOUND lookups hold the prize', async function() {
    const decision = await lookupSettlement({
        lookup: async function() {
            const err = new Error('NOT_FOUND');
            err.code = 'NOT_FOUND';
            throw err;
        },
        sleep: async function() {},
        attempts: 3,
        intervalMs: 0,
    });
    assert.strictEqual(decision.action, 'hold');
    const empty = await lookupSettlement({
        lookup: async function() { return null; },
        sleep: async function() {},
        attempts: 2,
        intervalMs: 0,
    });
    assert.strictEqual(empty.action, 'hold');
    const blank = await lookupSettlement({
        lookup: async function() { return {}; },
        sleep: async function() {},
        attempts: 1,
        intervalMs: 0,
    });
    assert.strictEqual(blank.action, 'hold');
});

later('a connection drop is looked up and then held', async function() {
    const dropped = new Error('websocket closed');
    assert.strictEqual(payErrorAction({ phase: 'pay', error: dropped }), 'lookup');
    assert.strictEqual(payErrorAction({ phase: 'pay', error: Object.assign(new Error('wallet'), { code: 'INTERNAL' }) }), 'lookup');
    assert.strictEqual(payErrorAction({ phase: 'pay', error: Object.assign(new Error('wallet'), { code: 'OTHER' }) }), 'lookup');
    const decision = await lookupSettlement({
        lookup: async function() { throw new Error('connect ECONNRESET'); },
        sleep: async function() {},
        attempts: 2,
        intervalMs: 0,
    });
    assert.strictEqual(decision.action, 'hold');
});

later('a 1,000+ win for a banned account is flagged for admin', function() {
    const big = adminClaimFlag({ amount: 1000 }, { satsDisabled: false }, { banned: true });
    assert.strictEqual(big.claimBlocked, true);
    assert.strictEqual(big.claimBlockReason, 'banned');
    assert.strictEqual(big.flagForAdmin, true);
    const disabled = adminClaimFlag({ amount: 5000 }, { satsDisabled: true }, {});
    assert.strictEqual(disabled.flagForAdmin, true);
    assert.strictEqual(disabled.claimBlockReason, 'sats_disabled');
    const small = adminClaimFlag({ amount: 500 }, {}, { banned: true });
    assert.strictEqual(small.claimBlocked, true);
    assert.strictEqual(small.flagForAdmin, false);
    const clear = adminClaimFlag({ amount: 10000 }, {}, {});
    assert.strictEqual(clear.claimBlocked, false);
    assert.strictEqual(clear.flagForAdmin, false);
});

later('gift count and reward rolls use the integer odds', function() {
    assert.strictEqual(rollGiftCount(scripted([0])), 2);
    assert.strictEqual(rollGiftCount(scripted([1499])), 2);
    assert.strictEqual(rollGiftCount(scripted([1500])), 3);
    assert.strictEqual(rollGiftCount(scripted([5499])), 3);
    assert.strictEqual(rollGiftCount(scripted([5500])), 4);
    assert.strictEqual(rollGiftCount(scripted([8499])), 4);
    assert.strictEqual(rollGiftCount(scripted([8500])), 5);
    assert.strictEqual(rollGiftCount(scripted([9999])), 5);

    const oneKey = rollGiftReward({ randomInt: scripted([0, 0, 0]), labels: LABELS, closet: CLOSET });
    assert.deepStrictEqual(oneKey, { rewardType: 'keys', keyLabels: ['3A'] });
    const threeKeys = rollGiftReward({ randomInt: scripted([2999, 5500, 6500, 1, 2, 0]), labels: LABELS, closet: CLOSET });
    assert.deepStrictEqual(threeKeys.keyLabels, ['7F', 'B2', '3A']);
    const twoCiphers = rollGiftReward({ randomInt: scripted([3000, 7000, 1, 2]), labels: LABELS, closet: CLOSET });
    assert.deepStrictEqual(twoCiphers.cipherLabels, ['7F', 'B2']);
    const tickets = rollGiftReward({ randomInt: scripted([7949, 9000]), labels: LABELS, closet: CLOSET });
    assert.strictEqual(tickets.rewardType, 'tickets');
    assert.strictEqual(tickets.ticketCount, 3);
    const xp = rollGiftReward({ randomInt: scripted([7950, 4999]), labels: LABELS, closet: CLOSET });
    assert.strictEqual(xp.rewardType, 'xp_bonus');
    assert.strictEqual(xp.xpAmount, 50);
    assert.strictEqual(rollGiftReward({ randomInt: scripted([9149, 8499]), labels: LABELS, closet: CLOSET }).xpAmount, 100);
    assert.strictEqual(rollGiftReward({ randomInt: scripted([9150]), labels: LABELS, closet: CLOSET }).rewardType, 'streak_shield');
    assert.strictEqual(rollGiftReward({ randomInt: scripted([9649]), labels: LABELS, closet: CLOSET }).rewardType, 'streak_shield');
    assert.strictEqual(rollGiftReward({ randomInt: scripted([9650]), labels: LABELS, closet: CLOSET }).rewardType, 'nacho_shoutout');
    assert.strictEqual(rollGiftReward({ randomInt: scripted([9699]), labels: LABELS, closet: CLOSET }).rewardType, 'nacho_shoutout');
    assert.strictEqual(rollGiftReward({ randomInt: scripted([9700, 0]), labels: LABELS, closet: CLOSET }).itemId, 'crown');
});

later('a Nacho shoutout is 0.5 percent and the freed share is tickets', function() {
    const counts = {};
    for (let r = 0; r < 10000; r++) {
        let n = 0;
        const reward = rollGiftReward({
            randomInt: function() {
                n += 1;
                return n === 1 ? r : 0;
            },
            labels: LABELS,
            closet: CLOSET,
        });
        counts[reward.rewardType] = (counts[reward.rewardType] || 0) + 1;
    }
    assert.strictEqual(counts.nacho_shoutout, 50);
    assert.strictEqual(counts.nacho_shoutout / 10000, 0.005);
    assert.strictEqual(counts.tickets, 2950);
    assert.strictEqual(counts.keys, 3000);
    assert.strictEqual(counts.locked_ciphers, 2000);
    assert.strictEqual(counts.xp_bonus, 1200);
    assert.strictEqual(counts.streak_shield, 500);
    assert.strictEqual(counts.closet_item, 300);
});

later('key-send XP uses the shared 500/900/1000 taper', function() {
    assert.strictEqual(DAILY_POINTS_CAP, 1000);
    assert.deepStrictEqual(splitDailyXp(0, 25), { awarded: 25, overflowAdded: 0, capped: false });
    // 10 at full rate, then floor(15 / 2) = 7 in the half tier.
    assert.deepStrictEqual(splitDailyXp(490, 25), { awarded: 17, overflowAdded: 0, capped: false });
    // Quarter tier: floor(25 / 4) = 6, which does not fill the last 20.
    assert.deepStrictEqual(splitDailyXp(980, 25), { awarded: 6, overflowAdded: 0, capped: false });
    assert.deepStrictEqual(splitDailyXp(1000, 25), { awarded: 0, overflowAdded: 0, capped: true });
});

Promise.all(queue).then(function() {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
