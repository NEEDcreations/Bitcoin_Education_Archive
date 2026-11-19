#!/usr/bin/env node
'use strict';
// In-app Premium buy screen (premium-buy.js): textContent-only DOM, final-sale
// box before payment, acceptNoRefunds sent, Jan 3 perks note, no trial copy,
// only Stripe / https BTCPay URLs followed, loaded identically on index/404.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'premium-buy.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const notFound = fs.readFileSync(path.join(root, '404.html'), 'utf8');
let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('✅ ' + name); }
    catch (e) { failed++; console.log('❌ ' + name + ': ' + e.message); }
}

test('no innerHTML / insertAdjacentHTML / document.write', function () {
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(js));
});
test('final-sale box required and acceptNoRefunds sent', function () {
    assert.ok(/agree\.checked !== true\) \{ msg\.textContent = REASONS\.terms_required; return; \}/.test(js));
    assert.ok(/acceptNoRefunds: true/.test(js));
    assert.ok(/All sales are final\. No refunds\./.test(js));
    assert.ok(js.indexOf("You're charged today.") !== -1);
    assert.ok(/Embers and Citadel perks start ' \+ etDate\(st\.perksStartAtMs\) \+ ' at 12:00 AM ET\. Your other Premium perks start right away\./.test(js));
    assert.ok(!/free trial|7-day/i.test(js));
});
test('kill switch and other server reasons have friendly messages', function () {
    ['kill_switch', 'terms_required', 'checkout_closed', 'founders_sold_out', 'founders_busy', 'hold_exists_ip', 'email_not_verified'].forEach(function (k) {
        assert.ok(js.indexOf(k + ':') !== -1, k);
    });
});
test('loaded on index.html and 404.html with the same buster', function () {
    const tag = '<script src="/premium-buy.js?v=20261118_v2606" defer></script>';
    assert.ok(index.includes(tag));
    assert.ok(notFound.includes(tag));
    assert.strictEqual(index, notFound);
});

const toasts = [];
const ctx = {
    location: { search: '', hostname: 'dev.bitcoineducation.quest', href: 'https://dev.bitcoineducation.quest/', assign: function () {} },
    URL: URL,
    URLSearchParams: URLSearchParams,
    sessionStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
    history: { replaceState: function () {}, state: null },
    document: { readyState: 'complete', addEventListener: function () {}, createElement: function () { return {}; }, body: { appendChild: function () {} } },
    showToast: function (m) { toasts.push(m); },
    setTimeout: setTimeout,
    Intl: Intl,
};
ctx.window = ctx;
vm.runInNewContext(js, ctx);
const T = ctx._bqPremiumBuyTest;
test('window.bqOpenPremium is exposed', function () {
    assert.strictEqual(typeof ctx.bqOpenPremium, 'function');
});
test('card: only checkout.stripe.com over https', function () {
    assert.strictEqual(T.safeCheckoutUrl('https://checkout.stripe.com/c/pay/cs_test_1', 'card'), 'https://checkout.stripe.com/c/pay/cs_test_1');
    assert.strictEqual(T.safeCheckoutUrl('https://evil.example/pay', 'card'), null);
    assert.strictEqual(T.safeCheckoutUrl('http://checkout.stripe.com/x', 'card'), null);
    assert.strictEqual(T.safeCheckoutUrl('javascript:alert(1)', 'card'), null);
    assert.strictEqual(T.safeCheckoutUrl(null, 'card'), null);
});
test('bitcoin: https BTCPay only, never javascript:/http:', function () {
    assert.ok(T.safeCheckoutUrl('https://pay.example.com/i/abc', 'lightning'));
    assert.strictEqual(T.safeCheckoutUrl('javascript:alert(1)', 'lightning'), null);
    assert.strictEqual(T.safeCheckoutUrl('http://pay.example.com/i/abc', 'lightning'), null);
    assert.strictEqual(T.safeCheckoutUrl('https://dev.bitcoineducation.quest/x', 'lightning'), null);
});
test('portal: only billing.stripe.com', function () {
    assert.ok(T.safePortalUrl('https://billing.stripe.com/p/session/test_1'));
    assert.strictEqual(T.safePortalUrl('https://evil.example/p'), null);
});
test('prices format', function () {
    assert.strictEqual(T.usd(500), '$5');
    assert.strictEqual(T.usd(450), '$4.50');
    assert.strictEqual(T.usd(12750), '$127.50');
});
test('signed-out open asks to sign in (no checkout call)', function () {
    ctx.bqOpenPremium('founders');
    assert.ok(toasts.indexOf('Sign in to buy Premium.') !== -1);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
