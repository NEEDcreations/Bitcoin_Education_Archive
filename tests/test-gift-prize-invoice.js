// Gift prize invoices: the paid amount must match the prize in millisatoshis.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        const result = fn();
        if (result && typeof result.then === 'function') throw new Error('use testAsync');
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e));
        failed++;
    }
}
async function testAsync(name, fn) {
    try {
        await fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e));
        failed++;
    }
}

function loadResolve() {
    const src = fs.readFileSync(path.join(root, 'functions/src/gifting.js'), 'utf8');
    const start = src.indexOf('async function _resolvePrizeInvoice');
    const end = src.indexOf('\nconst claimCipherWin');
    if (start < 0 || end < 0 || end <= start) throw new Error('could not find _resolvePrizeInvoice');
    const tipConfirm = require('../functions/src/tipConfirm');
    const sandbox = {
        bolt11: { decode: function() { return sandbox._decoded; } },
        resolveLnurlInvoice: async function() { throw new Error('lnurl should not run'); },
        tipConfirm: tipConfirm,
        console: { error: function() {}, log: function() {}, warn: function() {} },
    };
    vm.createContext(sandbox);
    vm.runInContext(src.slice(start, end) + '\nthis._resolvePrizeInvoice = _resolvePrizeInvoice;', sandbox);
    return sandbox;
}

function bolt() {
    return 'lnbc1000u1' + 'p'.repeat(80);
}

(async function main() {
    await testAsync('an invoice with leftover millisatoshis is refused', async function() {
        const s = loadResolve();
        s._decoded = { millisatoshis: '1000999', timeExpireDate: Math.floor(Date.now() / 1000) + 600 };
        await assert.rejects(function() { return s._resolvePrizeInvoice(bolt(), '', 1000); }, function(err) {
            return err && /exactly 1000 sats/.test(err.message);
        });
    });

    await testAsync('an invoice for the exact prize amount is accepted', async function() {
        const s = loadResolve();
        s._decoded = { millisatoshis: '1000000', timeExpireDate: Math.floor(Date.now() / 1000) + 600 };
        const out = await s._resolvePrizeInvoice(bolt(), '', 1000);
        assert.strictEqual(out, bolt());
    });

    test('the prize path uses the shared exact-sats helper', function() {
        const src = fs.readFileSync(path.join(root, 'functions/src/gifting.js'), 'utf8');
        const start = src.indexOf('async function _resolvePrizeInvoice');
        const end = src.indexOf('\nconst claimCipherWin');
        const body = src.slice(start, end);
        assert.ok(body.includes('tipConfirm.invoiceSatsFromDecoded'));
        assert.ok(!body.includes('Math.floor((decoded.millisatoshis || 0) / 1000)'));
    });

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
})().catch(function(err) {
    console.error(err);
    process.exit(1);
});
