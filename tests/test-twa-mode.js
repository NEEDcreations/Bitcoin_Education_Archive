#!/usr/bin/env node
'use strict';

// twa-mode.js: Android app (TWA) mode hides Premium / checkout and Kids /
// Classroom, and the plain website is left exactly as it was.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(root, 'twa-mode.js'), 'utf8');

let passed = 0;
let failed = 0;
const queue = [];
function test(name, fn) {
    queue.push(Promise.resolve().then(fn).then(function () {
        console.log('✅ ' + name); passed++;
    }, function (e) {
        console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); failed++;
    }));
}

function classList() {
    const set = new Set();
    return { add: function (c) { set.add(c); }, contains: function (c) { return set.has(c); }, size: function () { return set.size; } };
}

function makeEnv(opts) {
    const o = opts || {};
    const url = new URL(o.url || 'https://bitcoineducation.quest/');
    const log = { replaceState: [], replace: [], listeners: [], docListeners: [], appended: [], toasts: [], fetches: [], callables: [] };
    const storage = Object.assign({}, o.session || {});
    const sessionStorage = {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null; },
        setItem: function (k, v) { storage[k] = String(v); },
        removeItem: function (k) { delete storage[k]; },
    };
    const location = {
        get href() { return url.href; },
        get host() { return url.host; },
        get hostname() { return url.hostname; },
        get pathname() { return url.pathname; },
        get search() { return url.search; },
        get hash() { return url.hash; },
        replace: function (to) { log.replace.push(to); },
    };
    const head = { appendChild: function (el) { log.appended.push(el); } };
    const body = { classList: classList(), appendChild: function (el) { log.appended.push(el); } };
    const document = {
        referrer: o.referrer || '',
        readyState: o.readyState || 'loading',
        documentElement: { classList: classList(), appendChild: function (el) { log.appended.push(el); } },
        head: head,
        body: o.noBody ? null : body,
        createElement: function (tag) {
            return { tagName: tag.toUpperCase(), style: {}, setAttribute: function () {}, textContent: '', id: '' };
        },
        addEventListener: function (type, fn, cap) { log.docListeners.push({ type: type, fn: fn, cap: cap }); },
    };
    function realFetch(input) { log.fetches.push(String(input)); return Promise.resolve({ ok: true }); }
    function FakeFunctions() {}
    FakeFunctions.prototype.httpsCallable = function (name) {
        return function (data) { log.callables.push(name); return Promise.resolve({ data: { name: name, data: data } }); };
    };
    const fnInstance = new FakeFunctions();
    const window = {
        location: location,
        history: {
            state: null,
            replaceState: function (s, t, u) {
                log.replaceState.push(u);
                const next = new URL(u, url.href);
                url.pathname = next.pathname; url.search = next.search; url.hash = next.hash;
            },
        },
        sessionStorage: sessionStorage,
        addEventListener: function (type, fn) { log.listeners.push({ type: type, fn: fn }); },
        fetch: realFetch,
        firebase: o.noFirebase ? undefined : { functions: function () { return fnInstance; } },
        showToast: function (t) { log.toasts.push(t); },
        setTimeout: setTimeout,
        URL: URL,
        URLSearchParams: URLSearchParams,
        matchMedia: function (q) {
            return { matches: o.standalone === true && String(q) === '(display-mode: standalone)', media: q };
        },
    };
    window.window = window;
    const ctx = vm.createContext({
        window: window, document: document, URL: URL, URLSearchParams: URLSearchParams,
        setTimeout: function (fn) { fn(); return 0; }, Promise: Promise, Object: Object, String: String, Error: Error,
    });
    // Notices run through setTimeout(…, 0) in the page; run them right away here.
    ctx.window.setTimeout = ctx.setTimeout;
    return {
        run: function () { vm.runInContext(SRC, ctx, { filename: 'twa-mode.js' }); return this; },
        window: window, document: document, storage: storage, log: log, url: url,
        realFetch: realFetch, FakeFunctions: FakeFunctions, fnInstance: fnInstance,
        fire: function (type) {
            log.docListeners.filter(function (l) { return l.type === type; }).forEach(function (l) { l.fn(); });
            log.listeners.filter(function (l) { return l.type === type; }).forEach(function (l) { l.fn(); });
        },
        click: function (href) {
            let prevented = false;
            const a = { tagName: 'A', getAttribute: function (k) { return k === 'href' ? href : null; }, parentNode: null };
            const ev = { target: a, preventDefault: function () { prevented = true; }, stopPropagation: function () {} };
            log.docListeners.filter(function (l) { return l.type === 'click'; }).forEach(function (l) { l.fn(ev); });
            return prevented;
        },
    };
}

// ---- Normal web ----

test('web: no referrer, no param, no flag leaves the page untouched', function () {
    const env = makeEnv({ url: 'https://bitcoineducation.quest/?premium=buy&plan=yearly#premium' }).run();
    assert.strictEqual(env.window.bqIsTwa(), false);
    assert.strictEqual(env.document.documentElement.classList.size(), 0);
    assert.strictEqual(env.document.body.classList.size(), 0);
    assert.deepStrictEqual(env.storage, {});
    assert.strictEqual(env.log.appended.length, 0);
    assert.strictEqual(env.log.listeners.length, 0);
    assert.strictEqual(env.log.docListeners.length, 0);
    assert.strictEqual(env.log.replaceState.length, 0);
    assert.strictEqual(env.log.replace.length, 0);
    assert.strictEqual(env.window.fetch, env.realFetch);
    assert.strictEqual(env.FakeFunctions.prototype.httpsCallable.name, '');
    assert.ok(!env.FakeFunctions.prototype.httpsCallable._bqTwaGuard);
    assert.strictEqual(env.url.search, '?premium=buy&plan=yearly');
    assert.strictEqual(env.url.hash, '#premium');
    assert.strictEqual(env.window.bqTwaNotice, undefined);
    assert.strictEqual(env.log.toasts.length, 0);
});

test('web: Premium openers and checkout calls behave as before', async function () {
    const env = makeEnv({}).run();
    function opener() { return 'opened'; }
    env.window.bqOpenPremium = opener;
    env.window.bqPremiumBilling = opener;
    assert.strictEqual(env.window.bqOpenPremium, opener);
    assert.strictEqual(env.window.bqPremiumBilling(), 'opened');
    const r = await env.fnInstance.httpsCallable('createPremiumCheckout')({ plan: 'monthly' });
    assert.strictEqual(r.data.name, 'createPremiumCheckout');
    await env.window.fetch('https://us-central1-x.cloudfunctions.net/premiumPublicCheckout');
    assert.deepStrictEqual(env.log.fetches, ['https://us-central1-x.cloudfunctions.net/premiumPublicCheckout']);
});

test('web: other android-app referrers and look-alike hosts do not turn TWA on', function () {
    [
        'android-app://com.android.chrome',
        'android-app://quest.bitcoineducation.app.evil',
        'android-app://quest.bitcoineducation.apps/',
        'https://quest.bitcoineducation.app/',
        'https://bitcoineducation.quest/?client=android-twa',
    ].forEach(function (ref) {
        const env = makeEnv({ referrer: ref }).run();
        assert.strictEqual(env.window.bqIsTwa(), false, ref);
        assert.deepStrictEqual(env.storage, {}, ref);
    });
    ['?client=android', '?client=ANDROID-TWA', '?src=android-twa', '?client=android-twa-x'].forEach(function (q) {
        const env = makeEnv({ url: 'https://bitcoineducation.quest/' + q }).run();
        assert.strictEqual(env.window.bqIsTwa(), false, q);
    });
    const other = makeEnv({ session: { bq_twa: '0' } }).run();
    assert.strictEqual(other.window.bqIsTwa(), false);
});

// ---- TWA mode ----

test('TWA: the app referrer turns it on, persists the flag and marks the page', function () {
    ['android-app://quest.bitcoineducation.app', 'android-app://quest.bitcoineducation.app/'].forEach(function (ref) {
        const env = makeEnv({ referrer: ref }).run();
        assert.strictEqual(env.window.bqIsTwa(), true, ref);
        assert.strictEqual(env.storage.bq_twa, '1');
        assert.ok(env.document.documentElement.classList.contains('bq-twa'));
        assert.ok(env.document.body.classList.contains('bq-twa'));
    });
});

test('TWA: ?client=android-twa alone does not turn it on', function () {
    const env = makeEnv({ url: 'https://bitcoineducation.quest/?client=android-twa' }).run();
    assert.strictEqual(env.window.bqIsTwa(), false);
    assert.deepStrictEqual(env.storage, {});
    assert.strictEqual(env.document.documentElement.classList.size(), 0);
});

test('TWA: standalone plus a crafted ?client=android-twa link does not turn it on', function () {
    const env = makeEnv({ url: 'https://bitcoineducation.quest/?client=android-twa', standalone: true }).run();
    assert.strictEqual(env.window.bqIsTwa(), false);
    assert.deepStrictEqual(env.storage, {});
    assert.strictEqual(env.document.documentElement.classList.size(), 0);
});

test('TWA: ?client=android-twa plus the app referrer turns it on', function () {
    const env = makeEnv({
        url: 'https://bitcoineducation.quest/?client=android-twa',
        referrer: 'android-app://quest.bitcoineducation.app',
    }).run();
    assert.strictEqual(env.window.bqIsTwa(), true);
    assert.strictEqual(env.storage.bq_twa, '1');
});

test('TWA: standalone display mode alone does not turn it on', function () {
    const env = makeEnv({ url: 'https://bitcoineducation.quest/', standalone: true }).run();
    assert.strictEqual(env.window.bqIsTwa(), false);
    assert.deepStrictEqual(env.storage, {});
});

test('TWA: sessionStorage alone does not turn it on', function () {
    const env = makeEnv({ session: { bq_twa: '1' } }).run();
    assert.strictEqual(env.window.bqIsTwa(), false);
    assert.strictEqual(env.document.documentElement.classList.size(), 0);
});

test('TWA: the sessionStorage flag survives navigation in a standalone shell', function () {
    const first = makeEnv({
        url: 'https://bitcoineducation.quest/?client=android-twa',
        referrer: 'android-app://quest.bitcoineducation.app',
        standalone: true,
    }).run();
    assert.strictEqual(first.storage.bq_twa, '1');
    const next = makeEnv({ url: 'https://bitcoineducation.quest/forum', session: first.storage, standalone: true }).run();
    assert.strictEqual(next.window.bqIsTwa(), true);
    assert.ok(next.document.documentElement.classList.contains('bq-twa'));
    const web = makeEnv({ url: 'https://bitcoineducation.quest/forum', session: first.storage }).run();
    assert.strictEqual(web.window.bqIsTwa(), false);
});

test('TWA: the body class lands once the body exists', function () {
    const env = makeEnv({ referrer: 'android-app://quest.bitcoineducation.app', noBody: true }).run();
    const body = { classList: classList(), appendChild: function () {} };
    env.document.body = body;
    env.fire('DOMContentLoaded');
    assert.ok(body.classList.contains('bq-twa'));
});

test('TWA: CSS hides every Premium, checkout, Kids and Classroom entry point', function () {
    const env = makeEnv({ referrer: 'android-app://quest.bitcoineducation.app' }).run();
    const style = env.log.appended.find(function (el) { return el.id === 'bqTwaHide'; });
    assert.ok(style);
    const css = style.textContent;
    assert.ok(/\{display:none!important\}$/.test(css));
    [
        '[data-twa-hide]', '[data-premium-entry]', '[data-kids-entry]', '[data-classroom-entry]',
        '#settingsPremiumBilling', '.premium-cta', '.kids-entry', '.classroom-entry',
        'a[href^="/premium"]', 'a[href*="premium.html"]', 'a[href*="?premium="]', 'a[href*="&premium="]',
        'a[href^="/checkout"]', 'a[href*="checkout.stripe.com"]', 'a[href*="billing.stripe.com"]',
        'a[href^="/kids"]', 'a[href^="/classroom"]', 'a[href^="#premium"]', 'a[href^="#kids"]', 'a[href^="#classroom"]',
    ].forEach(function (sel) { assert.ok(css.includes('html.bq-twa ' + sel), sel); });
});

test('TWA: Premium openers are replaced and cannot be reassigned', function () {
    const env = makeEnv({ referrer: 'android-app://quest.bitcoineducation.app' }).run();
    const openDesc = Object.getOwnPropertyDescriptor(env.window, 'bqOpenPremium');
    const billDesc = Object.getOwnPropertyDescriptor(env.window, 'bqPremiumBilling');
    assert.strictEqual(openDesc.configurable, true);
    assert.strictEqual(billDesc.configurable, true);
    env.window.bqOpenPremium = function () { return 'opened'; };
    env.window.bqPremiumBilling = function () { return 'opened'; };
    assert.strictEqual(env.window.bqOpenPremium('buy'), false);
    assert.strictEqual(env.window.bqPremiumBilling({}), false);
    assert.doesNotThrow(function () {
        Object.defineProperty(env.window, 'bqOpenPremium', { configurable: true, value: function () { return 'x'; } });
    });
    env.fire('DOMContentLoaded');
    assert.ok(env.log.toasts.indexOf('Premium is not available in the Android app.') !== -1);
});

test('TWA: checkout callables and fetches reject before any request', async function () {
    const env = makeEnv({ referrer: 'android-app://quest.bitcoineducation.app' }).run();
    for (const name of ['createPremiumCheckout', 'createPremiumPortal', 'premiumPublicCheckout']) {
        await assert.rejects(env.fnInstance.httpsCallable(name)({}), function (e) { return e.code === 'twa-blocked'; }, name);
    }
    assert.deepStrictEqual(env.log.callables, []);
    const ok = await env.fnInstance.httpsCallable('getPremiumStatus')({});
    assert.strictEqual(ok.data.name, 'getPremiumStatus');
    await env.fnInstance.httpsCallable('claimSats')({});
    assert.deepStrictEqual(env.log.callables, ['getPremiumStatus', 'claimSats']);
    for (const u of [
        'https://us-central1-bitcoin-education-archive.cloudfunctions.net/premiumPublicCheckout',
        'https://checkout.stripe.com/c/pay/cs_test',
        'https://billing.stripe.com/p/session/x',
    ]) {
        await assert.rejects(env.window.fetch(u), function (e) { return e.code === 'twa-blocked'; }, u);
    }
    // 'btcpay' in a path or on an unknown host is not a checkout URL.
    await env.window.fetch('https://pay.example.com/btcpay/invoice');
    await env.window.fetch('https://bitcoineducation.quest/learn?q=btcpay');
    await env.window.fetch('https://mempool.space/api/blocks');
    assert.deepStrictEqual(env.log.fetches, [
        'https://pay.example.com/btcpay/invoice',
        'https://bitcoineducation.quest/learn?q=btcpay',
        'https://mempool.space/api/blocks',
    ]);
});

test('TWA: the callable guard waits for Firebase and keeps the MFA patch marker', async function () {
    const env = makeEnv({ referrer: 'android-app://quest.bitcoineducation.app', noFirebase: true }).run();
    const proto = env.FakeFunctions.prototype;
    proto.httpsCallable._mfaPatched = true;
    env.window.firebase = { functions: function () { return env.fnInstance; } };
    env.fire('DOMContentLoaded');
    assert.ok(proto.httpsCallable._bqTwaGuard);
    assert.ok(proto.httpsCallable._mfaPatched);
    env.fire('load');
    assert.ok(proto.httpsCallable._bqTwaGuard);
    await assert.rejects(env.fnInstance.httpsCallable('createPremiumCheckout')({}));
});

test('TWA: deep links to Premium or Kids pages go home with a notice', function () {
    ['/premium', '/premium.html', '/premium/', '/checkout', '/kids', '/classroom', '/Kids.html'].forEach(function (p) {
        const env = makeEnv({ url: 'https://bitcoineducation.quest' + p, session: { bq_twa: '1' }, standalone: true }).run();
        assert.deepStrictEqual(env.log.replace, ['/'], p);
        env.fire('DOMContentLoaded');
        assert.ok(env.log.toasts.length === 1, p);
    });
    const fine = makeEnv({ url: 'https://bitcoineducation.quest/premiums-explained', session: { bq_twa: '1' }, standalone: true }).run();
    assert.deepStrictEqual(fine.log.replace, []);
});

test('TWA: Premium query links and hash routes are stripped before the app routes', function () {
    const env = makeEnv({
        url: 'https://bitcoineducation.quest/?client=android-twa&premium=buy&plan=yearly#premium',
        referrer: 'android-app://quest.bitcoineducation.app',
        session: { bq_premium_pending: 'buy' },
    }).run();
    assert.strictEqual(env.url.search, '?client=android-twa');
    assert.strictEqual(env.url.hash, '');
    assert.strictEqual(env.storage.bq_premium_pending, undefined);
    env.fire('DOMContentLoaded');
    assert.ok(env.log.toasts.indexOf('Premium is not available in the Android app.') !== -1);

    const kids = makeEnv({ url: 'https://bitcoineducation.quest/#classroom', session: { bq_twa: '1' }, standalone: true }).run();
    assert.strictEqual(kids.url.hash, '');
    kids.fire('DOMContentLoaded');
    assert.ok(kids.log.toasts.indexOf('Kids and Classroom are not available in the Android app.') !== -1);

    const later = makeEnv({ url: 'https://bitcoineducation.quest/#forum', session: { bq_twa: '1' }, standalone: true }).run();
    assert.strictEqual(later.url.hash, '#forum');
    later.url.hash = '#kids';
    later.fire('hashchange');
    assert.strictEqual(later.url.hash, '');
    later.url.hash = '#/checkout';
    later.fire('popstate');
    assert.strictEqual(later.url.hash, '');
    later.url.hash = '#forum';
    later.fire('hashchange');
    assert.strictEqual(later.url.hash, '#forum');
    later.url.hash = '#kids-family';
    later.fire('hashchange');
    assert.strictEqual(later.url.hash, '#kids-family');
});

test('TWA: clicks on hidden Premium or Kids links are cancelled', function () {
    const env = makeEnv({ session: { bq_twa: '1' }, standalone: true }).run();
    [
        '/premium', 'https://bitcoineducation.quest/premium?plan=yearly', '/?premium=founders',
        'https://checkout.stripe.com/c/pay/x', '#premium', '/kids', '#classroom',
    ].forEach(function (href) { assert.strictEqual(env.click(href), true, href); });
    ['/forum', '#forum', 'https://example.com/premium', '/terms.html'].forEach(function (href) {
        assert.strictEqual(env.click(href), false, href);
    });
});

test('index.html and 404.html load twa-mode.js early, before Firebase and the app', function () {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.strictEqual(html, fs.readFileSync(path.join(root, '404.html'), 'utf8'));
    const tag = '<script src="/twa-mode.js?v=20261126_v2699"></script>';
    assert.strictEqual(html.split(tag).length - 1, 1);
    const at = html.indexOf(tag);
    assert.ok(at > 0 && at < html.indexOf('</head>'));
    assert.ok(at < html.indexOf('firebase-functions-compat.js'));
    assert.ok(at < html.indexOf('/ranking.js?v='));
    assert.ok(at < html.indexOf('/bundle.min.js?v='));
});

Promise.all(queue).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
});
