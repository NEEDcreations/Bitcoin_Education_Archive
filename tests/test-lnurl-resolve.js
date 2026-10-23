// LNURL-pay lookup. Hosts, redirects, and invoices are checked here with a fake fetch.
const assert = require('assert');
const lnurl = require('../functions/src/lnurlResolve');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        const pending = fn();
        if (pending && typeof pending.then === 'function') {
            return pending.then(function () {
                console.log('✅ ' + name);
                passed++;
            }).catch(function (e) {
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

function jsonRes(body, status) {
    const code = status || 200;
    return {
        ok: code >= 200 && code < 300,
        status: code,
        json: async function () { return body; },
        headers: { get: function () { return ''; } },
    };
}

function redirectRes(location) {
    return {
        ok: false,
        status: 302,
        json: async function () { return {}; },
        headers: { get: function (name) { return String(name).toLowerCase() === 'location' ? location : ''; } },
    };
}

function bolt11(msats, network) {
    return {
        decode: function () {
            return { millisatoshis: String(msats), network: { bech32: network || 'bc' } };
        },
    };
}

function publicHost(blocked) {
    return async function (hostname) {
        if (blocked && blocked[hostname]) {
            const err = new Error('private host');
            err.code = 'private_host';
            throw err;
        }
    };
}

function harness(routes, extra) {
    const calls = [];
    const logs = [];
    const options = extra || {};
    const fetch = async function (url) {
        calls.push(String(url));
        const hit = routes[String(url)];
        if (!hit) throw new Error('unexpected url ' + url);
        return hit;
    };
    const resolve = lnurl.createLnurlResolver({
        fetch: fetch,
        bolt11: options.bolt11 || bolt11(1000, 'bc'),
        assertPublicHost: options.assertPublicHost || publicHost(options.blocked),
        log: {
            log: function (line) { logs.push(String(line)); },
            error: function (line) { logs.push(String(line)); },
        },
    }).resolveLnurlInvoice;
    return { resolve: resolve, calls: calls, logs: logs };
}

const queue = [];

queue.push(test('normalize strips lightning: and mailto:', function () {
    assert.strictEqual(lnurl.normalizeLnAddress('  Lightning:Alice@Wallet.com '), 'alice@wallet.com');
    assert.strictEqual(lnurl.normalizeLnAddress('mailto:bob@example.com'), 'bob@example.com');
    assert.strictEqual(lnurl.RESOLVE_ERROR, 'Could not resolve Lightning Address. Check the address and try again.');
}));

queue.push(test('Wallet of Satoshi callback may live on another host', async function () {
    const meta = 'https://walletofsatoshi.com/.well-known/lnurlp/alice';
    const invoice = 'https://livingroomofsatoshi.com/api/pay?amount=1000';
    const h = harness({
        [meta]: jsonRes({ callback: 'https://livingroomofsatoshi.com/api/pay', minSendable: 1000, maxSendable: 100000000 }),
        [invoice]: jsonRes({ pr: 'lnbc10n1example' }),
    });
    const out = await h.resolve({ address: 'alice@walletofsatoshi.com', msats: 1000 });
    assert.strictEqual(out.pr, 'lnbc10n1example');
    assert.strictEqual(out.domain, 'walletofsatoshi.com');
    assert.strictEqual(out.callbackHost, 'livingroomofsatoshi.com');
    assert.deepStrictEqual(h.calls, [meta, invoice]);
    assert.ok(h.logs.join('\n').indexOf('alice@') === -1);
    assert.ok(h.logs.join('\n').indexOf('walletofsatoshi.com') > 0);
}));

queue.push(test('Blink callback may live on another host', async function () {
    const meta = 'https://blink.sv/.well-known/lnurlp/bob';
    const invoice = 'https://api.blink.sv/lnurl/pay?amount=1000';
    const h = harness({
        [meta]: jsonRes({ callback: 'https://api.blink.sv/lnurl/pay', minSendable: 1000, maxSendable: 5000000 }),
        [invoice]: jsonRes({ pr: 'lnbc10n1blink' }),
    });
    const out = await h.resolve({ address: 'bob@blink.sv', msats: 1000 });
    assert.strictEqual(out.callbackHost, 'api.blink.sv');
    assert.strictEqual(out.pr, 'lnbc10n1blink');
}));

queue.push(test('Speed may redirect the metadata request and stay on https', async function () {
    const first = 'https://speed.app/.well-known/lnurlp/cara';
    const next = 'https://api.speed.app/.well-known/lnurlp/cara';
    const invoice = 'https://api.speed.app/lnurlp/invoice?amount=1000';
    const h = harness({
        [first]: redirectRes(next),
        [next]: jsonRes({ callback: 'https://api.speed.app/lnurlp/invoice', minSendable: 1000, maxSendable: 100000000 }),
        [invoice]: jsonRes({ pr: 'lnbc10n1speed' }),
    });
    const out = await h.resolve({ address: 'cara@speed.app', msats: 1000 });
    assert.strictEqual(out.pr, 'lnbc10n1speed');
    assert.deepStrictEqual(h.calls, [first, next, invoice]);
}));

queue.push(test('a redirect onto a private address is rejected', async function () {
    const first = 'https://speed.app/.well-known/lnurlp/cara';
    const h = harness({
        [first]: redirectRes('https://10.0.0.1/lnurl'),
    }, { blocked: { '10.0.0.1': true } });
    await assert.rejects(function () { return h.resolve({ address: 'cara@speed.app', msats: 1000 }); }, function (err) {
        return err && err.code === 'private_host';
    });
    assert.deepStrictEqual(h.calls, [first]);
}));

queue.push(test('an http callback is rejected before the invoice fetch', async function () {
    const meta = 'https://wallet.example/.well-known/lnurlp/supersecret';
    const h = harness({
        [meta]: jsonRes({ callback: 'http://wallet.example/pay', minSendable: 1000, maxSendable: 100000 }),
    });
    await assert.rejects(function () { return h.resolve({ address: 'supersecret@wallet.example', msats: 1000 }); }, function (err) {
        return err && err.code === 'http_callback';
    });
    assert.deepStrictEqual(h.calls, [meta]);
}));

queue.push(test('userinfo and a non-default port are rejected', async function () {
    const meta = 'https://wallet.example/.well-known/lnurlp/supersecret';
    const userinfo = harness({
        [meta]: jsonRes({ callback: 'https://user:pass@wallet.example/pay', minSendable: 1000, maxSendable: 100000 }),
    });
    await assert.rejects(function () { return userinfo.resolve({ address: 'supersecret@wallet.example', msats: 1000 }); }, function (err) {
        return err && err.code === 'userinfo';
    });
    const port = harness({
        [meta]: jsonRes({ callback: 'https://wallet.example:8443/pay', minSendable: 1000, maxSendable: 100000 }),
    });
    await assert.rejects(function () { return port.resolve({ address: 'supersecret@wallet.example', msats: 1000 }); }, function (err) {
        return err && err.code === 'bad_port';
    });
}));

queue.push(test('LNURL status ERROR is returned and the invoice is not fetched', async function () {
    const meta = 'https://wallet.example/.well-known/lnurlp/supersecret';
    const h = harness({
        [meta]: jsonRes({ status: 'ERROR', reason: 'unknown user' }),
    });
    await assert.rejects(function () { return h.resolve({ address: 'supersecret@wallet.example', msats: 1000 }); }, function (err) {
        return err && err.code === 'lnurl_error' && err.message === 'unknown user';
    });
    assert.deepStrictEqual(h.calls, [meta]);
    assert.ok(h.logs.join('\n').indexOf('supersecret') === -1);
}));

queue.push(test('an amount outside min or max does not fetch an invoice', async function () {
    const meta = 'https://wallet.example/.well-known/lnurlp/supersecret';
    const low = harness({
        [meta]: jsonRes({ callback: 'https://pay.wallet.example/inv', minSendable: 5000, maxSendable: 100000 }),
    });
    await assert.rejects(function () { return low.resolve({ address: 'supersecret@wallet.example', msats: 1000 }); }, function (err) {
        return err && err.code === 'below_min' && err.minSendable === 5000;
    });
    assert.deepStrictEqual(low.calls, [meta]);
    const high = harness({
        [meta]: jsonRes({ callback: 'https://pay.wallet.example/inv', minSendable: 1000, maxSendable: 1500 }),
    });
    await assert.rejects(function () { return high.resolve({ address: 'supersecret@wallet.example', msats: 2000 }); }, function (err) {
        return err && err.code === 'above_max';
    });
    assert.deepStrictEqual(high.calls, [meta]);
}));

queue.push(test('the invoice must be mainnet and the requested amount', async function () {
    const meta = 'https://wallet.example/.well-known/lnurlp/supersecret';
    const invoice = 'https://pay.wallet.example/inv?amount=1000';
    const routes = {
        [meta]: jsonRes({ callback: 'https://pay.wallet.example/inv', minSendable: 1000, maxSendable: 100000 }),
        [invoice]: jsonRes({ pr: 'lntb1testnet' }),
    };
    const wrongNet = harness(routes, { bolt11: bolt11(1000, 'tb') });
    await assert.rejects(function () { return wrongNet.resolve({ address: 'supersecret@wallet.example', msats: 1000 }); }, function (err) {
        return err && err.code === 'wrong_network';
    });
    const mismatch = harness(routes, { bolt11: bolt11(2000, 'bc') });
    await assert.rejects(function () { return mismatch.resolve({ address: 'supersecret@wallet.example', msats: 1000 }); }, function (err) {
        return err && err.code === 'amount_mismatch';
    });
}));

Promise.all(queue).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
