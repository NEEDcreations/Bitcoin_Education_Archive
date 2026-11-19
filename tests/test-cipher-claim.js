// Cipher claim settlement and entry checks. No Firebase.
const assert = require('assert');
const {
    assessCipherClaim,
    isSatsBanned,
    SATS_BANNED_ERROR,
    lookupRequestFromDecoded,
    shouldLookupPay,
    payErrorAction,
    explicitPayRefusal,
    EXPLICIT_PAY_REFUSALS,
    classifyLookup,
    decideAfterLookups,
    lookupSettlement,
    adminClaimFlag,
    LOOKUP_ATTEMPTS,
    LOOKUP_INTERVAL_MS,
    SATS_DISABLED_ERROR,
} = require('../functions/src/cipherClaim');
const { rollGiftCount, rollGiftReward, pickLabel, unmatchedLabels, LABEL_BIAS_BP } = require('../functions/src/giftRoll');
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

later('an explicit wallet refusal in the pay phase is looked up, not released (N5)', function() {
    assert.strictEqual(payErrorAction({ phase: 'balance', error: new Error('[TIMEOUT] getBalance') }), 'release');
    assert.strictEqual(shouldLookupPay({ phase: 'balance', error: new Error('[TIMEOUT] getBalance') }), false);
    assert.strictEqual(payErrorAction({ phase: 'pay', error: new Error('[TIMEOUT] payInvoice') }), 'lookup');
    assert.strictEqual(payErrorAction({ phase: 'pay', error: new Error('NO_PREIMAGE') }), 'lookup');
    assert.strictEqual(payErrorAction({ phase: 'pay', payResult: null }), 'lookup');
    assert.strictEqual(payErrorAction({ phase: 'pay', payResult: { preimage: 'ee' } }), 'paid');
    EXPLICIT_PAY_REFUSALS.forEach(function(code) {
        const err = Object.assign(new Error('wallet refused'), { code: code });
        // Still recognised as an explicit refusal (exact code only)...
        assert.strictEqual(explicitPayRefusal(err), true, code);
        // ...but in the pay phase it must be looked up: an HTLC can be in flight.
        assert.strictEqual(payErrorAction({ phase: 'pay', error: err }), 'lookup', code);
        assert.strictEqual(shouldLookupPay({ phase: 'pay', error: err }), true, code);
        // Before the pay call it still releases.
        assert.strictEqual(payErrorAction({ phase: 'balance', error: err }), 'release', code);
        // A message that merely contains the code is not a refusal and is looked up.
        assert.strictEqual(explicitPayRefusal(new Error(code)), false, code);
        assert.strictEqual(payErrorAction({ phase: 'pay', error: new Error(code) }), 'lookup', code);
    });
    assert.deepStrictEqual(EXPLICIT_PAY_REFUSALS, ['PAYMENT_FAILED', 'INSUFFICIENT_BALANCE', 'QUOTA_EXCEEDED', 'RATE_LIMITED']);
});

// Drives the same pay -> payErrorAction -> lookupSettlement sequence claimCipherWin
// uses, against the staging mock wallet, counting pay calls.
async function cipherWinFlow(mockCfg) {
    const prev = process.env.GCLOUD_PROJECT;
    process.env.GCLOUD_PROJECT = 'bitcoin-quest-staging';
    try {
        const wallet = require('../functions/src/stagingMockWallet').createMockWallet(Object.assign({ mockWallet: true }, mockCfg));
        let pays = 0;
        let payResult = null;
        let payError = null;
        try {
            pays++;
            payResult = await wallet.payInvoice({ invoice: 'lnbc1' });
            if (!payResult || !payResult.preimage) throw new Error('NO_PREIMAGE');
        } catch (e) { payError = e; }
        if (payResult && payResult.preimage) return { outcome: 'paid', pays: pays };
        if (!shouldLookupPay({ phase: 'pay', error: payError, payResult: payResult })) return { outcome: 'released_without_lookup', pays: pays };
        let lookups = 0;
        const settlement = await lookupSettlement({
            lookup: function() { lookups++; return wallet.lookupInvoice({ payment_hash: 'aa' }); },
            sleep: async function() {},
            attempts: 3,
            intervalMs: 0,
        });
        const outcome = settlement.action === 'paid' ? 'paid' : settlement.action === 'release' ? 'release' : 'hold';
        return { outcome: outcome, pays: pays, lookups: lookups };
    } finally {
        if (prev === undefined) delete process.env.GCLOUD_PROJECT; else process.env.GCLOUD_PROJECT = prev;
    }
}

later('claimCipherWin: PAYMENT_FAILED + lookup pending holds (HTLC in flight)', async function() {
    const r = await cipherWinFlow({ mockPayOutcome: 'refuse', mockLookupOutcome: 'pending' });
    assert.strictEqual(r.outcome, 'hold');
    assert.strictEqual(r.pays, 1);
    assert.ok(r.lookups >= 1);
});

later('claimCipherWin: PAYMENT_FAILED + lookup failed releases', async function() {
    const r = await cipherWinFlow({ mockPayOutcome: 'refuse', mockLookupOutcome: 'failed' });
    assert.strictEqual(r.outcome, 'release');
    assert.strictEqual(r.pays, 1);
    assert.strictEqual(r.lookups, 1);
});

later('claimCipherWin: PAYMENT_FAILED + lookup settled is paid once, never re-paid', async function() {
    const r = await cipherWinFlow({ mockPayOutcome: 'refuse', mockLookupOutcome: 'settled' });
    assert.strictEqual(r.outcome, 'paid');
    assert.strictEqual(r.pays, 1);
});

later('claimCipherWin: PAYMENT_FAILED + lookup error or empty holds', async function() {
    assert.strictEqual((await cipherWinFlow({ mockPayOutcome: 'refuse', mockLookupOutcome: 'error' })).outcome, 'hold');
    assert.strictEqual((await cipherWinFlow({ mockPayOutcome: 'refuse', mockLookupOutcome: 'unknown' })).outcome, 'hold');
    assert.strictEqual((await cipherWinFlow({ mockPayOutcome: 'refuse_ours', mockLookupOutcome: 'pending' })).outcome, 'hold');
});

later('claimCipherWin: PAYMENT_FAILED only in the message is still looked up', async function() {
    const text = await cipherWinFlow({ mockPayOutcome: 'refuse_text', mockLookupOutcome: 'pending' });
    assert.strictEqual(text.outcome, 'hold');
    assert.ok(text.lookups >= 1);
    const msg = await cipherWinFlow({ mockPayOutcome: 'message_only', mockLookupOutcome: 'failed' });
    assert.strictEqual(msg.outcome, 'release');
    assert.strictEqual(msg.lookups, 1);
});

later('claimCipherWin wiring: release only after a failed lookup, invoice row kept with its hash', function() {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'functions', 'src', 'gifting.js'), 'utf8');
    const body = src.slice(src.indexOf('const claimCipherWin = '), src.indexOf('function winForUser('));
    assert.ok(body.length > 1000, 'claimCipherWin body found');
    // releaseUnpaid (deletes the invoice row) only runs on the pre-pay branch.
    assert.strictEqual(body.split('await releaseUnpaid()').length - 1, 1);
    const prePay = body.indexOf('if (!shouldLookupPay({ phase: phase, error: payError, payResult: payResult })) {');
    const lookup = body.indexOf('await lookupSettlement(');
    const firstRelease = body.indexOf('await releaseUnpaid()');
    assert.ok(prePay !== -1 && lookup !== -1 && prePay < firstRelease && firstRelease < lookup);
    // After the lookup: release keeps a failed row with the payment hash.
    assert.ok(/if \(settlement\.action === 'release'\) \{\s*try \{\s*await releaseAfterFailedLookup\(lookupReq\.payment_hash\);/.test(body));
    const relFn = body.slice(body.indexOf('async function releaseAfterFailedLookup'), body.indexOf('async function holdUnknown'));
    assert.ok(relFn.indexOf('invoiceRef.delete') === -1);
    assert.ok(/status: 'failed',\s*paymentHash: paymentHash \|\| ''/.test(relFn));
    // Anything else after the lookup holds.
    assert.ok(/await holdUnknown\(lookupReq\.payment_hash\);/.test(body.slice(lookup)));
});

// Pulls one inner helper out of claimCipherWin and runs it against fake refs.
function cipherHelper(name, scope) {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'functions', 'src', 'gifting.js'), 'utf8');
    const body = src.slice(src.indexOf('const claimCipherWin = '), src.indexOf('function winForUser('));
    const start = body.indexOf('    async function ' + name + '(');
    assert.ok(start !== -1, name + ' found');
    const end = body.indexOf('\n    }\n', start) + 7;
    const keys = Object.keys(scope);
    const factory = new Function(keys.join(','), body.slice(start, end) + '\nreturn ' + name + ';');
    return factory.apply(null, keys.map(function(k) { return scope[k]; }));
}
function fakeCipherDb(opts) {
    const o = opts || {};
    const store = { win: { status: 'paying', payingAt: 1 }, invoice: { status: 'pending' } };
    const FV = { serverTimestamp: function() { return 'TS'; }, delete: function() { return '__DEL__'; } };
    function apply(key, data, merge) {
        const next = merge ? Object.assign({}, store[key], data) : Object.assign({}, data);
        Object.keys(next).forEach(function(k) { if (next[k] === '__DEL__') delete next[k]; });
        store[key] = next;
    }
    const winRef = { key: 'win', update: async function(d) { apply('win', d, true); } };
    const invoiceRef = {
        key: 'invoice',
        set: async function(d, op) { if (o.invoiceWriteFails) throw new Error('invoice write failed'); apply('invoice', d, op && op.merge); },
        delete: async function() { delete store.invoice; },
    };
    const db = {
        runTransaction: async function(fn) {
            const buf = [];
            const t = {
                get: async function(ref) { const d = store[ref.key]; return { exists: !!d, data: function() { return d; } }; },
                set: function(ref, d, op) { buf.push([ref.key, d, !!(op && op.merge)]); },
                update: function(ref, d) { buf.push([ref.key, d, true]); },
            };
            const out = await fn(t);
            // Atomic commit: any failing write aborts every write.
            if (o.invoiceWriteFails && buf.some(function(w) { return w[0] === 'invoice'; })) throw new Error('commit failed');
            buf.forEach(function(w) { apply(w[0], w[1], w[2]); });
            return out;
        },
    };
    return { store: store, scope: { db: db, winRef: winRef, invoiceRef: invoiceRef, admin: { firestore: { FieldValue: FV } }, uid: 'u1', winId: 'w1', amount: 100, invoiceHash: 'ih' } };
}

later('F3: releaseAfterFailedLookup writes the failed invoice row and the win flip together', async function() {
    const ok = fakeCipherDb();
    const release = cipherHelper('releaseAfterFailedLookup', ok.scope);
    await release('hash1');
    assert.strictEqual(ok.store.invoice.status, 'failed');
    assert.strictEqual(ok.store.invoice.paymentHash, 'hash1');
    assert.strictEqual(ok.store.win.status, 'claimable');
    assert.ok(!('payingAt' in ok.store.win));

    // If the failed row cannot be written, the win must NOT become claimable,
    // and the error reaches the caller (no swallowed .catch).
    const bad = fakeCipherDb({ invoiceWriteFails: true });
    const release2 = cipherHelper('releaseAfterFailedLookup', bad.scope);
    let threw = false;
    try { await release2('hash2'); } catch (e) { threw = true; }
    assert.strictEqual(threw, true);
    assert.strictEqual(bad.store.win.status, 'paying');
    assert.strictEqual(bad.store.invoice.status, 'pending');

    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'functions', 'src', 'gifting.js'), 'utf8');
    const body = src.slice(src.indexOf('const claimCipherWin = '), src.indexOf('function winForUser('));
    const relFn = body.slice(body.indexOf('async function releaseAfterFailedLookup'), body.indexOf('async function holdUnknown'));
    assert.strictEqual(relFn.indexOf('.catch('), -1, 'no swallowed write in releaseAfterFailedLookup');
    // The release call site holds the win if the release throws.
    const site = body.slice(body.indexOf("if (settlement.action === 'release') {"));
    const siteCatch = site.slice(0, 900);
    assert.ok(/catch \(e\) \{[\s\S]*?await holdUnknownIfPaying\(lookupReq\.payment_hash\);[\s\S]*?return \{ success: false, error: holdMessage \};/.test(siteCatch));
    assert.ok(!/catch \(e\) \{[\s\S]*?await holdUnknown\(lookupReq\.payment_hash\);/.test(siteCatch.slice(0, siteCatch.indexOf('return { success: false, error: holdMessage };'))), 'fallback never calls the unguarded holdUnknown');
});

later('F3 fallback: holdUnknownIfPaying holds only a win that is still paying', async function() {
    const paying = fakeCipherDb();
    const held = await cipherHelper('holdUnknownIfPaying', paying.scope)('hash4');
    assert.strictEqual(held, true);
    assert.strictEqual(paying.store.win.status, 'unknown');
    assert.strictEqual(paying.store.win.paymentHash, 'hash4');
    assert.strictEqual(paying.store.invoice.status, 'unknown');
    assert.strictEqual(paying.store.invoice.paymentHash, 'hash4');
    for (const status of ['paid', 'claimable', 'unknown']) {
        const f = fakeCipherDb();
        f.store.win = { status: status, preimage: 'keep' };
        const before = JSON.stringify(f.store);
        const r = await cipherHelper('holdUnknownIfPaying', f.scope)('hash5');
        assert.strictEqual(r, false, status);
        assert.strictEqual(JSON.stringify(f.store), before, status + ' left unchanged');
    }
});

later('F2: holdUnknown stamps paymentHash on the unknown faucet_invoices row', async function() {
    const f = fakeCipherDb();
    const hold = cipherHelper('holdUnknown', f.scope);
    await hold('hash3');
    assert.strictEqual(f.store.win.status, 'unknown');
    assert.strictEqual(f.store.win.paymentHash, 'hash3');
    assert.strictEqual(f.store.invoice.status, 'unknown');
    assert.strictEqual(f.store.invoice.paymentHash, 'hash3');
    const g = fakeCipherDb();
    await cipherHelper('holdUnknown', g.scope)('');
    assert.strictEqual(g.store.invoice.paymentHash, '');
});

later('L1: claimCipherWin re-checks the 48h address-change hold inside the claim transaction', function() {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'functions', 'src', 'gifting.js'), 'utf8');
    const body = src.slice(src.indexOf('const claimCipherWin = '), src.indexOf('function winForUser('));
    const tx = body.slice(body.indexOf('await db.runTransaction(async (t) => {'), body.indexOf("status: 'paying',"));
    assert.ok(/const addrHold = faucetGuard\.assessAddressChangeHold\(userRow, Date\.now\(\)\);\s*if \(!addrHold\.ok\) throw httpsError\('failed-precondition', addrHold\.error\);/.test(tx));
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

    // keys band is now 0..2199 (22%). Always exactly one key.
    const oneKey = rollGiftReward({ randomInt: scripted([0, 0]), labels: LABELS, closet: CLOSET });
    assert.deepStrictEqual(oneKey, { rewardType: 'keys', keyLabels: ['3A'] });
    const edgeKey = rollGiftReward({ randomInt: scripted([2199, 1]), labels: LABELS, closet: CLOSET });
    assert.strictEqual(edgeKey.rewardType, 'keys');
    assert.deepStrictEqual(edgeKey.keyLabels, ['7F']);
    assert.strictEqual(edgeKey.keyLabels.length, 1);

    // ciphers band 2200..4999 (28%). Count roll still 1 or 2.
    const twoCiphers = rollGiftReward({ randomInt: scripted([2200, 7000, 1, 2]), labels: LABELS, closet: CLOSET });
    assert.deepStrictEqual(twoCiphers.cipherLabels, ['7F', 'B2']);
    const oneCipher = rollGiftReward({ randomInt: scripted([4999, 0, 2]), labels: LABELS, closet: CLOSET });
    assert.strictEqual(oneCipher.rewardType, 'locked_ciphers');
    assert.deepStrictEqual(oneCipher.cipherLabels, ['B2']);

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

later('a Nacho shoutout is 0.5 percent; keys 22 and ciphers 28', function() {
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
    assert.strictEqual(counts.keys, 2200);
    assert.strictEqual(counts.locked_ciphers, 2800);
    assert.strictEqual(counts.xp_bonus, 1200);
    assert.strictEqual(counts.streak_shield, 500);
    assert.strictEqual(counts.closet_item, 300);
});

later('key drops never stack above one key', function() {
    for (let r = 0; r < 2200; r++) {
        let n = 0;
        const reward = rollGiftReward({
            randomInt: function() {
                n += 1;
                // first call = reward band, later calls = label picks / bias coin
                return n === 1 ? r : 0;
            },
            labels: LABELS,
            closet: CLOSET,
        });
        assert.strictEqual(reward.rewardType, 'keys');
        assert.strictEqual(reward.keyLabels.length, 1);
    }
});

later('unmatchedLabels and 70 percent label bias', function() {
    assert.strictEqual(LABEL_BIAS_BP, 7000);
    const u = unmatchedLabels(['3A', '7F', '3A'], ['7F', 'B2']);
    assert.deepStrictEqual(u.forKeys.sort(), ['B2']); // cipher B2 has no key
    assert.deepStrictEqual(u.forCiphers.sort(), ['3A']); // key 3A has no cipher

    // bias hit (<7000) picks from preferred
    assert.strictEqual(pickLabel(LABELS, ['B2'], scripted([0, 0])), 'B2');
    // bias miss (>=7000) falls back to full labels
    assert.strictEqual(pickLabel(LABELS, ['B2'], scripted([7000, 1])), '7F');
    // empty preferred always uses full labels
    assert.strictEqual(pickLabel(LABELS, [], scripted([2])), 'B2');

    const biasedKey = rollGiftReward({
        randomInt: scripted([0, 0, 0]), // keys band, bias hit, preferred[0]
        labels: LABELS,
        closet: CLOSET,
        preferredKeyLabels: ['B2'],
    });
    assert.deepStrictEqual(biasedKey.keyLabels, ['B2']);

    const unbiasedKey = rollGiftReward({
        randomInt: scripted([0, 7000, 1]), // keys band, bias miss, labels[1]
        labels: LABELS,
        closet: CLOSET,
        preferredKeyLabels: ['B2'],
    });
    assert.deepStrictEqual(unbiasedKey.keyLabels, ['7F']);

    const biasedCipher = rollGiftReward({
        randomInt: scripted([2200, 0, 0, 0]), // cipher band, count=1, bias hit, preferred[0]
        labels: LABELS,
        closet: CLOSET,
        preferredCipherLabels: ['3A'],
    });
    assert.deepStrictEqual(biasedCipher.cipherLabels, ['3A']);
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
