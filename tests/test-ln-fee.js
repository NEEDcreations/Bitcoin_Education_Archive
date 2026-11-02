// Flat Lightning fee paid by the player (Phil, Nov 2 2026).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const lnFee = require('../functions/src/lnFee');
const cipher = require('../functions/src/cipherSatsClaim');
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log('✅ ' + name); passed++; } catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; } }
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

test('one server fee value: 3 sats', () => { assert.strictEqual(lnFee.LN_FEE_SATS, 3); });
test('100 gross -> 97 net, 3 fee', () => { const q = lnFee.quote(100); assert.deepStrictEqual([q.ok, q.gross, q.fee, q.net], [true, 100, 3, 97]); });
test('200 and 500 nets', () => { assert.strictEqual(lnFee.quote(200).net, 197); assert.strictEqual(lnFee.quote(500).net, 497); });
test('net can never be 0 or below', () => {
    for (const g of [0, 1, 2, 3, -5, NaN, 'x', null, undefined, Infinity]) assert.strictEqual(lnFee.quote(g).ok, false, String(g));
    assert.strictEqual(lnFee.quote(4).net, 1);
});
test('fractional gross floors', () => { assert.strictEqual(lnFee.quote(100.9).net, 97); });
test('net + fee == gross whenever ok', () => { for (let g = 4; g <= 1000; g++) { const q = lnFee.quote(g); assert.ok(q.ok && q.net + q.fee === g && q.net >= 1); } });
test('fee_paid msat rounds up and unknown is null', () => {
    assert.strictEqual(lnFee.feePaidSats({ fees_paid: 612 }), 1);
    assert.strictEqual(lnFee.feePaidSats({ fees_paid: 2786 }), 3);
    assert.strictEqual(lnFee.feePaidSats({ fees_paid: 0 }), 0);
    assert.strictEqual(lnFee.feePaidSats({}), null);
    assert.strictEqual(lnFee.feePaidSats(null), null);
    assert.strictEqual(lnFee.feePaidSats({ fees_paid: -1 }), null);
});
test('ledger fields carry charged, net and paid', () => {
    const f = lnFee.feeFields(lnFee.quote(100), { fees_paid: 2301 });
    assert.deepStrictEqual([f.fee_charged, f.net_sent, f.gross, f.fee_paid, f.fee_paid_msat], [3, 97, 100, 3, 2301]);
});
test('CLAIM_MIN leaves a positive net', () => { assert.ok(lnFee.quote(cipher.CLAIM_MIN).net >= 1); });
test('client display fee matches server', () => {
    const m = read('ranking.js').match(/window\.BQ_LN_FEE_SATS = (\d+);/);
    assert.ok(m && Number(m[1]) === lnFee.LN_FEE_SATS);
});
test('server invoices are requested for the net amount', () => {
    const idx = read('functions/index.js');
    assert.ok(idx.includes('msats: netSendAmount * 1000'));
    assert.ok(!idx.includes('msats: lnAddrAmount * 1000'));
    const g = read('functions/src/gifting.js');
    assert.ok(g.includes("_resolvePrizeInvoice('', reserved.address, reserved.net)"));
    assert.ok(g.includes('_resolvePrizeInvoice(data.invoice, data.lightningAddress, netAmount)'));
});
test('every server payInvoice site is covered by the fee', () => {
    const files = ['functions/index.js', 'functions/src/gifting.js'];
    let n = 0;
    for (const f of files) n += (read(f).match(/nwc\.payInvoice\(/g) || []).length;
    assert.strictEqual(n, 3, 'new payInvoice site: add the flat fee there and update this test');
});
test('no "zero fees" claim copy left', () => {
    for (const f of ['ranking.js', 'index.html', 'terms.html', 'nacho-qa.js', 'gifting.js']) {
        assert.ok(!/Zero fees for you|we cover all routing|receive the full amount you claim/i.test(read(f)), f);
    }
});
test('every claim screen confirms the fee first', () => {
    const r = read('ranking.js');
    assert.ok(r.indexOf("bqConfirmLnFee(lnAmt") !== -1 && r.indexOf("bqConfirmLnFee(lnAmt") < r.indexOf("httpsCallable('claimSats')"));
    assert.ok(r.indexOf("bqConfirmLnFee(_gross") < r.indexOf("httpsCallable('claimCipherSats')"));
    assert.ok(read('gifting.js').includes("bqConfirmLnFee(win.amount || 0, 'Cipher prize')"));
});
test('cipher sats plan carries fee and net', () => {
    const src = read('functions/src/cipherSatsClaim.js');
    assert.ok(src.includes('fee: feeQuote.fee') && src.includes('net: feeQuote.net'));
});
console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
