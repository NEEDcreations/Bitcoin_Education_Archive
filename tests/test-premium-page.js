#!/usr/bin/env node
'use strict';
// Static /premium page: standalone, card prices only, approved perks copy,
// no existing-player discount, ?src= passthrough, staging endpoint off-prod,
// no free trial copy, final-sale terms before payment, live launch gate.
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
    assert.ok(text.indexOf('Embers and Citadel cosmetics unlock with Citadel Spark on Jan 3. Every other perk starts the moment you buy.') !== -1);
    assert.ok(/Compute Games Pass\. Watching is free, and paying never buys influence\./.test(text));
    assert.ok(/Paying never changes who wins a battle\./.test(text));
    assert.ok(/No pool fee when you mine/.test(text));
    assert.ok(/Higher chat limit/.test(text));
    assert.ok(/One username change and one faction change per year/.test(text));
    // Only approved limit: 20 OrangeTix a day bought with the player's own XP (Phil, Nov 18).
    assert.ok(/Buy up to 20 OrangeTix a day with your own XP/.test(text));
    assert.ok(/Your Founders seat is held for 10 minutes once checkout opens/.test(text));
    assert.ok(!/Higher rewards limit/i.test(text));
    // Citadel perks are cosmetic only (Citadel spec, Nov 18, Red Team C1).
    assert.ok(!/build slot/i.test(text));
    assert.ok(/never speed up collecting Citadel parts/.test(text));
    assert.ok(!/parts? tickets?/i.test(text));
    assert.ok(/can't become sats/.test(text));
    assert.ok(/100 Embers a month to spend on cosmetics in the Nook/.test(text));
    ['supporter badge', 'badge', 'frame', 'streak freeze', 'unlimited', 'no ceiling', 'better odds', 'more raffle entries'].forEach(function (w) {
        assert.strictEqual(text.toLowerCase().indexOf(w), -1, w);
    });
});
test('no free trial anywhere on the page (Phil, Nov 18)', function () {
    assert.ok(!/free trial|trial/i.test(text), 'trial copy found');
    assert.ok(!/7-day/i.test(html + js));
    assert.ok(/Charged today, then monthly\./.test(text));
    assert.ok(/Charged today, then yearly\./.test(text));
});
test('final-sale terms and a required box sit above the pay button', function () {
    const terms = html.indexOf('id="pmTerms"');
    const box = html.indexOf('id="pmAgree"');
    const pay = html.indexOf('id="pmSubmit"');
    assert.ok(terms !== -1 && box !== -1 && pay !== -1 && terms < pay && box < pay);
    assert.ok(/All sales are final\. No refunds\./.test(text));
    assert.ok(/canceled any time and keep Premium until the end of the period you paid for/.test(text));
    assert.ok(/Founders' Lifetime and bitcoin payments are final\./.test(text));
    const server = require('../functions/src/premiumPricing').REFUND_POLICY.text;
    assert.ok(text.indexOf(server.replace(/^All sales are final\. No refunds\. /, '')) !== -1, 'page copy matches server REFUND_POLICY');
});
test('not indexed until launch; live launch gate is closed', function () {
    assert.ok(/<meta name="robots" content="noindex,nofollow">/.test(html));
    assert.ok(/var PAGE_OPEN_ON_LIVE = false;/.test(js));
    const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
    assert.strictEqual(sitemap.indexOf('/premium'), -1);
});
test('Turnstile widget and plan values match the server', function () {
    assert.ok(/class="cf-turnstile" data-sitekey="0x4AAAAAAD-ivgpRkbXpgz86" data-action="premium_checkout"/.test(html));
    ['monthly', 'yearly', 'founders'].forEach(function (p) { assert.ok(html.indexOf('value="' + p + '"') !== -1, p); });
    assert.ok(/rail: 'card'/.test(js));
});

// Run premium.js in a tiny fake DOM to check endpoint choice, src and redirect guard.
function run(hostname, search, reply, plan, opts) {
    const o = opts || {};
    const sent = [];
    const nodes = {};
    function el(id) { return nodes[id] || (nodes[id] = { id: id, hidden: true, disabled: false, value: '', textContent: '', className: '', focus: function () {}, appendChild: function () {} }); }
    let submit = null;
    const form = el('premiumForm');
    form.addEventListener = function (t, fn) { if (t === 'submit') submit = fn; };
    form.querySelector = function (sel) { return sel.indexOf('plan') !== -1 ? { value: plan || 'yearly' } : null; };
    el('pmEmail').value = 'buyer@example.com';
    el('pmAgree').checked = o.agree !== false;
    el('pmCheckout').hidden = false;
    let assigned = null;
    const ctx = {
        location: { hostname: hostname, search: search, assign: function (u) { assigned = u; } },
        URLSearchParams: URLSearchParams,
        document: { getElementById: el, createElement: function () { return {}; }, head: { appendChild: function () {} } },
        window: { turnstile: { getResponse: function () { return 'tok'; }, reset: function () {} } },
        fetch: function (url, init) { sent.push({ url: url, body: JSON.parse(init.body) }); return Promise.resolve({ json: function () { return Promise.resolve(reply); } }); },
    };
    vm.runInNewContext(o.js || js, ctx);
    submit({ preventDefault: function () {} });
    return new Promise(function (r) { setTimeout(function () { r({ sent: sent, assigned: assigned, msg: el('pmMsg'), nodes: nodes }); }, 20); });
}

(async function () {
    const okReply = { ok: true, url: 'https://checkout.stripe.com/c/pay/cs_test_1' };
    const a = await run('preview1.bitcoin-quest.pages.dev', '?src=YT-1217', okReply);
    test('preview host posts to staging with src tag', function () {
        assert.strictEqual(a.sent[0].url, 'https://us-central1-bitcoin-quest-staging.cloudfunctions.net/premiumPublicCheckout');
        assert.deepStrictEqual(a.sent[0].body, { plan: 'yearly', rail: 'card', email: 'buyer@example.com', turnstileToken: 'tok', acceptNoRefunds: true, src: 'yt-1217' });
        assert.strictEqual(a.assigned, okReply.url);
    });
    const closed = await run('bitcoineducation.quest', '', okReply);
    test('live host: checkout closed until PAGE_OPEN_ON_LIVE (no post, no redirect)', function () {
        assert.strictEqual(closed.sent.length, 0);
        assert.strictEqual(closed.assigned, null);
        assert.strictEqual(closed.nodes.pmCheckout.hidden, true);
        assert.strictEqual(closed.nodes.pmClosed.hidden, false);
    });
    const openJs = js.replace('var PAGE_OPEN_ON_LIVE = false;', 'var PAGE_OPEN_ON_LIVE = true;');
    const b = await run('bitcoineducation.quest', '?src=%3Cscript%3E', okReply, null, { js: openJs });
    test('live host (after launch OK) posts to live; bad src dropped', function () {
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
    const noBox = await run('dev.bitcoineducation.quest', '', okReply, 'monthly', { agree: false });
    test('unticked final-sale box: no post, friendly message', function () {
        assert.strictEqual(noBox.sent.length, 0);
        assert.ok(/all sales are final/i.test(noBox.msg.textContent));
    });
    const f = await run('bitcoineducation.quest', '?src=yt-1217', okReply, 'founders', { js: openJs });
    test("Founders goes to app sign-in (with src), never the public email checkout", function () {
        assert.strictEqual(f.sent.length, 0);
        assert.strictEqual(f.assigned, '/?premium=founders&src=yt-1217');
        assert.ok(/Sign in to Bitcoin Quest to buy/.test(text));
    });
    const g = await run('bitcoin-quest-staging.web.app', '', { ok: false, reason: 'rate_limited_global' });
    test('global cap and Founders reasons have friendly messages', function () {
        assert.ok(/busy/.test(g.msg.textContent));
        ['founders_sign_in', 'founders_busy', 'hold_exists_ip', 'rate_limited_global'].forEach(function (k) { assert.ok(js.indexOf(k + ':') !== -1, k); });
    });
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
