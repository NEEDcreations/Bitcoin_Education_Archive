#!/usr/bin/env node
'use strict';
// Static /premium page: standalone, card prices only, approved perks copy,
// no existing-player discount, ?src= passthrough, staging endpoint off-prod.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'premium.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'premium.js'), 'utf8');
const text = html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('✅ ' + name); }
    catch (e) { failed++; console.log('❌ ' + name + ': ' + e.message); }
}

test('standalone: no Firebase, no app bundle, no service worker', function () {
    ['firebase', 'ranking.js', 'utils.js', 'serviceWorker', 'sw.js'].forEach(function (w) {
        assert.strictEqual((html + js).indexOf(w), -1, w);
    });
});
test('card prices shown: $5/month, $50/year, $150 Founders, 500 seats', function () {
    assert.ok(/\$5 \/ month/.test(text));
    assert.ok(/\$50 \/ year/.test(text));
    assert.ok(/\$150 one time/.test(text));
    assert.ok(/500 seats/.test(text));
});
test('no existing-player discount and no BTC price line until enabled', function () {
    assert.ok(!/5%|5 percent|15%|existing (player|user)s? (get|save)|lock in/i.test(text));
    assert.ok(/var SHOW_BTC_LINE = false;/.test(js));
    assert.ok(/id="btcNote" hidden/.test(html));
    assert.ok(!/\$45|\$135|\$4\.50|\$42\.50|\$127\.50/.test(text));
});
test('approved perks present, dropped perks absent, banned claims absent', function () {
    assert.ok(text.indexOf('Premium perks unlock with Citadel Spark on Jan 3.') !== -1);
    assert.ok(/Compute Games Pass\. Watching is free, and paying never buys influence\./.test(text));
    assert.ok(/Paying never changes who wins a battle\./.test(text));
    assert.ok(/No pool fee when you mine/.test(text));
    assert.ok(/Higher chat limit/.test(text));
    assert.ok(/One username change and one faction change per year/.test(text));
    assert.ok(/60 days old/.test(text));
    assert.ok(/can't become sats/.test(text));
    ['supporter badge', 'badge', 'frame', 'streak freeze', 'unlimited', 'no ceiling', 'better odds', 'more raffle entries'].forEach(function (w) {
        assert.strictEqual(text.toLowerCase().indexOf(w), -1, w);
    });
});
test('Turnstile widget and plan values match the server', function () {
    assert.ok(/class="cf-turnstile" data-sitekey="0x4AAAAAAD-ivgpRkbXpgz86"/.test(html));
    ['monthly', 'yearly', 'founders'].forEach(function (p) { assert.ok(html.indexOf('value="' + p + '"') !== -1, p); });
    assert.ok(/rail: 'card'/.test(js));
});

// Run premium.js in a tiny fake DOM to check endpoint choice, src and redirect guard.
function run(hostname, search, reply) {
    const sent = [];
    const nodes = {};
    function el(id) { return nodes[id] || (nodes[id] = { id: id, hidden: true, disabled: false, value: '', textContent: '', className: '', focus: function () {}, appendChild: function () {} }); }
    let submit = null;
    const form = el('premiumForm');
    form.addEventListener = function (t, fn) { if (t === 'submit') submit = fn; };
    form.querySelector = function (sel) { return sel.indexOf('plan') !== -1 ? { value: 'yearly' } : null; };
    el('pmEmail').value = 'buyer@example.com';
    let assigned = null;
    const ctx = {
        location: { hostname: hostname, search: search, assign: function (u) { assigned = u; } },
        URLSearchParams: URLSearchParams,
        document: { getElementById: el, createElement: function () { return {}; }, head: { appendChild: function () {} } },
        window: { turnstile: { getResponse: function () { return 'tok'; }, reset: function () {} } },
        fetch: function (url, init) { sent.push({ url: url, body: JSON.parse(init.body) }); return Promise.resolve({ json: function () { return Promise.resolve(reply); } }); },
    };
    vm.runInNewContext(js, ctx);
    submit({ preventDefault: function () {} });
    return new Promise(function (r) { setTimeout(function () { r({ sent: sent, assigned: assigned, msg: el('pmMsg') }); }, 20); });
}

(async function () {
    const okReply = { ok: true, url: 'https://checkout.stripe.com/c/pay/cs_test_1' };
    const a = await run('preview1.bitcoin-quest.pages.dev', '?src=YT-1217', okReply);
    test('preview host posts to staging with src tag', function () {
        assert.strictEqual(a.sent[0].url, 'https://us-central1-bitcoin-quest-staging.cloudfunctions.net/premiumPublicCheckout');
        assert.deepStrictEqual(a.sent[0].body, { plan: 'yearly', rail: 'card', email: 'buyer@example.com', turnstileToken: 'tok', src: 'yt-1217' });
        assert.strictEqual(a.assigned, okReply.url);
    });
    const b = await run('bitcoineducation.quest', '?src=%3Cscript%3E', okReply);
    test('live host posts to live; bad src dropped', function () {
        assert.strictEqual(b.sent[0].url, 'https://us-central1-bitcoin-education-archive.cloudfunctions.net/premiumPublicCheckout');
        assert.ok(!('src' in b.sent[0].body));
    });
    const c = await run('bitcoin-quest-staging.web.app', '', { ok: true, url: 'https://evil.example/pay' });
    test('never redirects anywhere but Stripe Checkout', function () {
        assert.strictEqual(c.assigned, null);
    });
    const d = await run('bitcoin-quest-staging.web.app', '', { ok: false, reason: 'checkout_closed' });
    test('closed checkout shows a friendly message', function () {
        assert.ok(/opens soon/.test(d.msg.textContent));
    });
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
