'use strict';
// #376 staging-only mock wallet hook: gate + every QA outcome.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const queue = [];
let passed = 0, failed = 0;
// Serial: tests change process.env, so they must not overlap.
function test(name, fn) { queue.push({ name: name, fn: fn }); }

const ENV_KEYS = ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT', 'FIREBASE_CONFIG'];
function withProject(project, fn) {
    const saved = {};
    ENV_KEYS.forEach(function(k) { saved[k] = process.env[k]; delete process.env[k]; });
    if (project) process.env.GCLOUD_PROJECT = project;
    const restore = function() { ENV_KEYS.forEach(function(k) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }); };
    let out;
    try { out = fn(); } catch (e) { restore(); throw e; }
    return Promise.resolve(out).then(function(v) { restore(); return v; }, function(e) { restore(); throw e; });
}

const smw = require('../functions/src/stagingMockWallet');
const cipher = require('../functions/src/cipherClaim');
const guard = require('../functions/src/faucetGuard');

function fakeDb(doc) {
    const db = { reads: 0, collection: function(c) { return { doc: function(id) { return { get: async function() {
        db.reads++;
        assert.strictEqual(c + '/' + id, 'config/satoshiFavorPayouts');
        return { exists: !!doc, data: function() { return doc; } };
    } }; } }; } };
    return db;
}

// Run the real claim-side decision code against the mock, the way claimSats does.
async function faucetOutcome(cfg) {
    const w = smw.createMockWallet(cfg);
    let phase = 'balance', payResult = null, payError = null;
    try {
        const b = await w.getBalance();
        if (Math.floor(b.balance / 1000) < 1000) throw new Error('WALLET_LOW');
        phase = 'pay';
        payResult = await w.payInvoice({ invoice: 'x' });
    } catch (e) { payError = e; }
    const decision = guard.decideFaucetPayment({ phase: phase, error: payError, payResult: payResult });
    if (decision.action !== 'lookup') return { decision: decision.action, kind: decision.action === 'refund' ? guard.definiteFailureKind({ phase: phase, error: payError }) : null };
    const s = await cipher.lookupSettlement({ attempts: 2, intervalMs: 0, lookup: function() { return w.lookupInvoice({}); } });
    const after = guard.decideFaucetLookupResult(s, { refused: decision.refused === true });
    return { decision: 'lookup', refused: decision.refused === true, after: after.action,
        kind: after.action === 'refund' ? (decision.refused ? guard.definiteFailureKind({ phase: phase, error: payError }) : 'theirs') : null };
}

test('gate: off staging, load() returns null without reading Firestore, even with mockWallet true', function() {
    return withProject('bitcoin-education-archive', async function() {
        const db = fakeDb({ mockWallet: true });
        assert.strictEqual(await smw.load(db), null);
        assert.strictEqual(db.reads, 0);
        assert.throws(function() { smw.createMockWallet({ mockWallet: true }); }, /staging only/);
    });
});

test('gate: no project at all is treated as not staging', function() {
    return withProject('', async function() {
        assert.strictEqual(smw.isStagingProject(), false);
        assert.strictEqual(await smw.load(fakeDb({ mockWallet: true })), null);
    });
});

test('gate: on staging, the existing mockWallet flag must be exactly true', function() {
    return withProject('bitcoin-quest-staging', async function() {
        assert.strictEqual(await smw.load(fakeDb(null)), null);
        assert.strictEqual(await smw.load(fakeDb({ mockWallet: 'true' })), null);
        assert.strictEqual(await smw.load(fakeDb({ mockWallet: false, mockPayOutcome: 'refuse' })), null);
        const cfg = await smw.load(fakeDb({ mockWallet: true, mockPayOutcome: 'refuse', mockLookupOutcome: 'error' }));
        assert.strictEqual(cfg.mockPayOutcome, 'refuse');
        assert.strictEqual(cfg.mockLookupOutcome, 'error');
        assert.throws(function() { smw.createMockWallet({ mockWallet: false }); }, /off/);
    });
});

test('config: unknown values fall back to paid / pending / ok', function() {
    const c = smw.readMockConfig({ mockWallet: true, mockPayOutcome: 'free_money', mockLookupOutcome: 'paid_please', mockBalanceOutcome: 'huge' });
    assert.strictEqual(c.mockPayOutcome, 'paid');
    assert.strictEqual(c.mockLookupOutcome, 'pending');
    assert.strictEqual(c.mockBalanceOutcome, 'ok');
});

test('wiring: claimSats, claimCipherSats and claimCipherWin only use the mock via load()', function() {
    const idx = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    const body = idx.slice(idx.indexOf('exports.claimSats'), idx.indexOf('function _unknownPayError'));
    assert.ok(body.indexOf("const stagingMock = await require('./src/stagingMockWallet').load(db);") !== -1);
    assert.ok(/nwc = stagingMock\s*\? require\('\.\/src\/stagingMockWallet'\)\.createMockWallet\(stagingMock\)/.test(body));
    const g = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'gifting.js'), 'utf8');
    assert.strictEqual(g.split("await require('./stagingMockWallet').load(db)").length - 1, 2);
    assert.strictEqual(g.split("require('./stagingMockWallet').createMockWallet(stagingMock)").length - 1, 2);
});

const S = 'bitcoin-quest-staging';
function onStaging(name, cfg, expect) {
    test(name, function() {
        return withProject(S, async function() {
            const out = await faucetOutcome(Object.assign({ mockWallet: true }, cfg));
            Object.keys(expect).forEach(function(k) { assert.strictEqual(out[k], expect[k], k + ' was ' + out[k]); });
        });
    });
}
onStaging('(a) paid', { mockPayOutcome: 'paid' }, { decision: 'record' });
onStaging('(b)+lookup failed: exact PAYMENT_FAILED, lookup failed -> refund, theirs', { mockPayOutcome: 'refuse', mockLookupOutcome: 'failed' }, { decision: 'lookup', refused: true, after: 'refund', kind: 'theirs' });
onStaging('(b) exact refusal + pending -> held', { mockPayOutcome: 'refuse', mockLookupOutcome: 'pending' }, { after: 'unknown' });
onStaging('(i) exact refusal + lookup error -> HELD', { mockPayOutcome: 'refuse', mockLookupOutcome: 'error' }, { refused: true, after: 'unknown' });
onStaging('(f) exact refusal + lookup empty -> HELD', { mockPayOutcome: 'refuse', mockLookupOutcome: 'empty' }, { after: 'unknown' });
onStaging('(f) exact refusal + unclassified -> HELD', { mockPayOutcome: 'refuse', mockLookupOutcome: 'unclassified' }, { after: 'unknown' });
onStaging('(c) message-only PAYMENT_FAILED with code INTERNAL -> lookup, not a refusal', { mockPayOutcome: 'message_only', mockLookupOutcome: 'pending' }, { decision: 'lookup', refused: false, after: 'unknown' });
onStaging('(c) message-only + lookup failed -> refund as theirs', { mockPayOutcome: 'message_only', mockLookupOutcome: 'failed' }, { after: 'refund', kind: 'theirs' });
onStaging('(d) pay timeout -> lookup, not a refusal', { mockPayOutcome: 'timeout', mockLookupOutcome: 'pending' }, { decision: 'lookup', refused: false, after: 'unknown' });
onStaging('settle: refusal + lookup settled -> record once', { mockPayOutcome: 'refuse', mockLookupOutcome: 'settled' }, { after: 'record' });
onStaging('our side: INSUFFICIENT_BALANCE + lookup failed -> refund, ours', { mockPayOutcome: 'refuse_ours', mockLookupOutcome: 'failed' }, { after: 'refund', kind: 'ours' });
onStaging('our side: getBalance timeout -> refund before pay, ours', { mockBalanceOutcome: 'timeout' }, { decision: 'refund', kind: 'ours' });
onStaging('our side: wallet low -> refund before pay, ours', { mockBalanceOutcome: 'low' }, { decision: 'refund', kind: 'ours' });

(async function() {
    for (const t of queue) {
        try { await t.fn(); passed++; console.log('✅ ' + t.name); }
        catch (e) { failed++; console.log('❌ ' + t.name + ': ' + (e && e.message)); }
    }
    console.log(passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
