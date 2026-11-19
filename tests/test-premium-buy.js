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
    assert.ok(/Embers and Citadel cosmetics start ' \+ etDate\(st\.perksStartAtMs\) \+ ' at 12:00 AM ET\. Your other Premium perks start right away\./.test(js));
    assert.ok(!/free trial|7-day/i.test(js));
});
test('kill switch and other server reasons have friendly messages', function () {
    ['kill_switch', 'terms_required', 'checkout_closed', 'founders_sold_out', 'founders_busy', 'hold_exists_ip', 'email_not_verified'].forEach(function (k) {
        assert.ok(js.indexOf(k + ':') !== -1, k);
    });
});
test('loaded on index.html and 404.html with the same buster', function () {
    const tag = '<script src="/premium-buy.js?v=20261118_v2611" defer></script>';
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
test('bitcoin: pinned to the configured BTCPay host exactly (Red Team F3)', function () {
    const H = 'pay.example.com';
    assert.strictEqual(T.safeCheckoutUrl('https://pay.example.com/i/abc', 'lightning', H), 'https://pay.example.com/i/abc');
    assert.strictEqual(T.safeCheckoutUrl('https://PAY.example.com/i/abc', 'lightning', 'PAY.EXAMPLE.COM'), 'https://pay.example.com/i/abc');
    // No configured host: every bitcoin link refused.
    assert.strictEqual(T.safeCheckoutUrl('https://pay.example.com/i/abc', 'lightning'), null);
    assert.strictEqual(T.safeCheckoutUrl('https://pay.example.com/i/abc', 'lightning', ''), null);
    // Any other https host, look-alikes and sub/parent domains refused.
    ['https://evil.example/i/abc', 'https://pay.example.com.evil.example/i/abc', 'https://x.pay.example.com/i/abc',
        'https://example.com/i/abc', 'https://pay.example.co/i/abc', 'https://user@pay.example.com/i/abc',
        'https://pay.example.com:8443/i/abc', 'http://pay.example.com/i/abc', 'javascript:alert(1)',
        'https://dev.bitcoineducation.quest/x', 'https://checkout.stripe.com/c/pay/cs_test_1'].forEach(function (u) {
        assert.strictEqual(T.safeCheckoutUrl(u, 'lightning', H), null, u);
    });
    // A bad configured host (scheme, path, our own host) is refused too.
    assert.strictEqual(T.safeCheckoutUrl('https://pay.example.com/i/abc', 'lightning', 'https://pay.example.com'), null);
    assert.strictEqual(T.safeCheckoutUrl('https://dev.bitcoineducation.quest/x', 'lightning', 'dev.bitcoineducation.quest'), null);
    // Card links ignore btcpayHost and stay pinned to Stripe.
    assert.strictEqual(T.safeCheckoutUrl('https://pay.example.com/i/abc', 'card', H), null);
    assert.strictEqual(T.safeCheckoutUrl('https://x', 'other', H), null);
});
test('buy screen passes status btcpayHost to the link check and hides bitcoin without it', function () {
    assert.ok(/safeCheckoutUrl\(r && r\.url, state\.rail, st && st\.btcpayHost\)/.test(js));
    assert.ok(/if \(st\.lightningOpen && st\.btcpayHost\)/.test(js));
});
test('Founders seat hold countdown: "Your Founders seat is held for N minutes" (Red Team F2-R)', function () {
    const now = 1000000;
    assert.strictEqual(T.holdText(now + 10 * 60000, now), 'Your Founders seat is held for 10 minutes (10:00 left).');
    assert.strictEqual(T.holdText(now + 9 * 60000 + 5000, now), 'Your Founders seat is held for 10 minutes (9:05 left).');
    assert.strictEqual(T.holdText(now + 30000, now), 'Your Founders seat is held for 1 minute (0:30 left).');
    assert.strictEqual(T.holdMinutesLeft(now - 1, now), 0);
    // Founders checkout shows the hold box with a Pay now button instead of redirecting at once.
    assert.ok(/state\.plan === 'founders' && r && Number\(r\.holdExpMs\) > Date\.now\(\)/.test(js));
    assert.ok(/showHold\(holdBox, buy, u, Number\(r\.holdExpMs\)\)/.test(js));
    assert.ok(js.indexOf("'Your Founders seat hold ran out. Start again to hold a new seat.'") !== -1);
    assert.ok(/if \(Date\.now\(\) < expMs\) location\.assign\(url\)/.test(js));
    assert.ok(/founders_cooldown_ip:/.test(js));
    // Red Team N1: no promise that the checkout itself closes.
    assert.ok(js.indexOf('After that your seat is released and may go to someone else.') !== -1);
    assert.ok(js.indexOf('checkout closes') === -1);
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

test('Manage billing only for active card subscribers (QA P2)', function () {
    assert.strictEqual(T.isCardSubscriber({ active: true, founders: false, autoRenew: true }), true);
    assert.strictEqual(T.isCardSubscriber({ active: true, founders: true, autoRenew: true }), false);
    assert.strictEqual(T.isCardSubscriber({ active: true, founders: false, autoRenew: false }), false);
    assert.strictEqual(T.isCardSubscriber({ active: false, autoRenew: true }), false);
    assert.strictEqual(T.isCardSubscriber(null), false);
    assert.ok(/isCardSubscriber\(st\)\) body\.appendChild\(billingButton\(\)\)/.test(js));
});
test('Settings > Account has a hidden billing slot mounted by premium-buy.js', function () {
    const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
    assert.ok(ranking.indexOf('<div id="settingsPremiumBilling" hidden') !== -1);
    assert.ok(ranking.indexOf("window.bqPremiumBilling(document.getElementById('settingsPremiumBilling'))") !== -1);
    assert.strictEqual(typeof ctx.bqPremiumBilling, 'function');
});

function fakeNode(tag) {
    return { tag: tag, style: {}, children: [], hidden: true, isConnected: true, textContent: '',
        appendChild: function (c) { this.children.push(c); return c; },
        removeChild: function (c) { this.children.splice(this.children.indexOf(c), 1); },
        get firstChild() { return this.children[0] || null; },
        addEventListener: function (n, f) { this['on' + n] = f; }, setAttribute: function () {} };
}
async function mountWith(status, fail) {
    const calls = [];
    ctx.document.createElement = fakeNode;
    ctx.auth = { currentUser: { isAnonymous: false } };
    ctx.firebase = { functions: function () { return { httpsCallable: function (n) { return function (d) { calls.push(n); return fail ? Promise.reject(new Error('x')) : Promise.resolve({ data: status }); }; } }; } };
    const holder = fakeNode('div');
    T.mountSettingsBilling(holder);
    await new Promise(function (r) { setTimeout(r, 0); });
    return { holder: holder, calls: calls };
}
(async function () {
    async function atest(name, fn) {
        try { await fn(); passed++; console.log('✅ ' + name); }
        catch (e) { failed++; console.log('❌ ' + name + ': ' + e.message); }
    }
    await atest('Settings billing card shows for a card subscriber and opens the portal', async function () {
        const r = await mountWith({ active: true, founders: false, autoRenew: true });
        assert.strictEqual(r.holder.hidden, false);
        const btn = r.holder.children[r.holder.children.length - 1];
        assert.strictEqual(btn.textContent, 'Manage billing');
        btn.onclick();
        assert.deepStrictEqual(r.calls, ['getPremiumStatus', 'createPremiumPortal']);
    });
    await atest('Settings billing card stays hidden for Founders, bitcoin prepay, non-Premium and errors', async function () {
        for (const st of [{ active: true, founders: true }, { active: true, founders: false, autoRenew: false }, { active: false }]) {
            const r = await mountWith(st);
            assert.strictEqual(r.holder.hidden, true);
            assert.strictEqual(r.holder.children.length, 0);
        }
        const e = await mountWith(null, true);
        assert.strictEqual(e.holder.hidden, true);
    });
    await atest('Settings billing card makes no call when signed out or anonymous', async function () {
        ctx.auth = { currentUser: { isAnonymous: true } };
        let called = 0;
        ctx.firebase = { functions: function () { called++; return {}; } };
        T.mountSettingsBilling(fakeNode('div'));
        assert.strictEqual(called, 0);
    });
    function texts(n, out) { out = out || []; if (n && n.textContent) out.push(n.textContent); (n && n.children || []).forEach(function (c) { texts(c, out); }); return out; }
    await atest('kill switch paused: buy dialog shows the pause note and no buy flow', async function () {
        ctx.document.createElement = fakeNode;
        const box = fakeNode('div');
        T.render(box, { active: false, checkoutOpen: false, checkoutPaused: true, offers: [{ plan: 'yearly', rail: 'card', amountCents: 5000 }] }, 'buy');
        const t = texts(box);
        assert.ok(t.indexOf('Checkout is paused right now.') !== -1);
        assert.strictEqual(t.indexOf('Continue to payment'), -1);
        assert.strictEqual(t.indexOf(T.REASONS.checkout_closed), -1);
    });
    await atest('kill switch paused: card subscriber still gets Manage billing plus the pause note', async function () {
        ctx.document.createElement = fakeNode;
        const box = fakeNode('div');
        T.render(box, { active: true, founders: false, autoRenew: true, checkoutPaused: true }, 'buy');
        const t = texts(box);
        assert.ok(t.indexOf('Checkout is paused right now.') !== -1);
        assert.ok(t.indexOf('Manage billing') !== -1);
        const r = await mountWith({ active: true, founders: false, autoRenew: true, checkoutPaused: true });
        const st = texts(r.holder);
        assert.ok(st.indexOf('Checkout is paused right now.') !== -1);
        assert.ok(st.indexOf('Manage billing') !== -1);
        const r2 = await mountWith({ active: true, founders: false, autoRenew: true, checkoutPaused: false });
        assert.strictEqual(texts(r2.holder).indexOf('Checkout is paused right now.'), -1);
    });
    await atest('not paused: buy dialog still offers Continue to payment', async function () {
        ctx.document.createElement = fakeNode;
        const box = fakeNode('div');
        T.render(box, { active: false, checkoutOpen: true, checkoutPaused: false, offers: [{ plan: 'yearly', rail: 'card', amountCents: 5000 }] }, 'buy');
        assert.ok(texts(box).indexOf('Continue to payment') !== -1);
    });
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
