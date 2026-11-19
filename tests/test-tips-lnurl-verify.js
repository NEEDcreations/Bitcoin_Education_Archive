// Tips: the client LNURL fallback checks the returned invoice before paying.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const nodeCrypto = require('crypto');

let passed = 0;
let failed = 0;
const pending = [];

function test(name, fn) {
    pending.push(async () => {
        try {
            await fn();
            console.log('✅ ' + name);
            passed++;
        } catch (e) {
            console.log('❌ ' + name + ': ' + e.message);
            failed++;
        }
    });
}

// ---- bech32 encoder used only to build test invoices ----
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function polymod(values) {
    const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
    let chk = 1;
    for (const v of values) {
        const top = chk >>> 25;
        chk = ((chk & 0x1ffffff) << 5) ^ v;
        for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= GEN[i];
    }
    return chk >>> 0;
}
function hrpExpand(hrp) {
    const out = [];
    for (const c of hrp) out.push(c.charCodeAt(0) >> 5);
    out.push(0);
    for (const c of hrp) out.push(c.charCodeAt(0) & 31);
    return out;
}
function encode(hrp, words) {
    const mod = polymod(hrpExpand(hrp).concat(words, [0, 0, 0, 0, 0, 0])) ^ 1;
    const sum = [];
    for (let i = 0; i < 6; i++) sum.push((mod >>> (5 * (5 - i))) & 31);
    return hrp + '1' + words.concat(sum).map((w) => CHARSET[w]).join('');
}
function intWords(n, len) {
    const out = [];
    for (let i = 0; i < len; i++) { out.unshift(n % 32); n = Math.floor(n / 32); }
    return out;
}
function hexWords(hex) {
    const bytes = Buffer.from(hex, 'hex');
    const out = [];
    let acc = 0;
    let bits = 0;
    for (const b of bytes) {
        acc = (acc << 8) | b;
        bits += 8;
        while (bits >= 5) { bits -= 5; out.push((acc >> bits) & 31); }
        acc &= (1 << bits) - 1;
    }
    if (bits > 0) out.push((acc << (5 - bits)) & 31);
    return out;
}
const sha = (str) => nodeCrypto.createHash('sha256').update(Buffer.from(str, 'utf8')).digest('hex');
function routeHex(hops) {
    return hops.map((hop) => {
        const b = Buffer.alloc(51);
        b[0] = 2;
        b.writeUInt32BE(hop.base >>> 0, 41);
        b.writeUInt32BE(hop.ppm >>> 0, 45);
        b.writeUInt16BE(40, 49);
        return b.toString('hex');
    }).join('');
}
function makeInvoice(hrp, opts) {
    opts = opts || {};
    const ts = opts.timestamp != null ? opts.timestamp : Math.floor(Date.now() / 1000);
    let words = intWords(ts, 7);
    // payment hash tag (p = 1), 52 words
    words = words.concat([1], intWords(52, 2), new Array(52).fill(3));
    (opts.r || []).forEach((route) => {
        const hex = typeof route === 'string' ? route : routeHex(route);
        const rw = hexWords(hex);
        words = words.concat([3], intWords(rw.length, 2), rw);
    });
    (opts.h || []).forEach((hex) => {
        const hw = hexWords(hex);
        words = words.concat([23], intWords(hw.length, 2), hw);
    });
    if (opts.expiry != null) {
        const ew = intWords(opts.expiry, 3);
        words = words.concat([6], intWords(ew.length, 2), ew);
    }
    words = words.concat(new Array(104).fill(7)); // signature is not checked here
    return encode(hrp, words);
}

// ---- load the shipped file and the source in a sandbox ----
function load(file, extra) {
    const win = {};
    const sb = Object.assign({
        window: win,
        document: { addEventListener() {}, getElementById() { return null; } },
        console: { log() {}, warn() {} },
        localStorage: { getItem() { return null; } },
        escapeHtml: (s) => String(s).replace(/[&<>"']/g, ''),
        crypto: globalThis.crypto,
        TextEncoder: TextEncoder,
        Uint8Array: Uint8Array,
    }, extra || {});
    vm.createContext(sb);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sb);
    return { win, sb };
}

const NOW = Date.now();
const MSATS = 1000 * 1000; // 1000 sats
const valid = makeInvoice('lnbc10u');

['lightning-tips.js.src', 'lightning-tips.js'].forEach((file) => {
    const check = (pr, msats, now) => {
        const fn = load(file).win._tipCheckInvoice;
        assert.strictEqual(typeof fn, 'function', 'checker missing');
        return fn(pr, msats, now == null ? NOW : now);
    };

    test(file + ': test encoder matches a published bech32 vector', () => {
        const words = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'.split('').map((c) => CHARSET.indexOf(c));
        assert.strictEqual(encode('abcdef', words), 'abcdef1qpzry9x8gf2tvdw0s3jn54khce6mua7lmqqqxw');
    });

    test(file + ': published BOLT11 vector passes inside its 60s window only', () => {
        const v = 'lnbc2500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpuaztrnwngzn3kdzw5hydlzf03qdgm2hdq27cqv3agm2awhz5se903vruatfhq77w3ls4evs3ch9zw97j25emudupq63nyw24cg27h2rspfj9srp';
        const t0 = 1496314658 * 1000;
        assert.strictEqual(check(v, 250000000, t0 + 1000), v);
        assert.strictEqual(check(v, 250000000, t0 + 61000), null);
    });

    test(file + ': a valid invoice for the expected amount passes', () => {
        assert.strictEqual(check(valid, MSATS), valid);
        assert.strictEqual(check(makeInvoice('lnbc1m'), 100000000), makeInvoice('lnbc1m'));
        assert.strictEqual(check(makeInvoice('lnbc10n'), 1000), makeInvoice('lnbc10n'));
        assert.strictEqual(check(makeInvoice('lnbc10p'), 1), makeInvoice('lnbc10p'));
    });

    test(file + ': the wrong amount is refused', () => {
        assert.strictEqual(check(valid, MSATS + 1000), null);
        assert.strictEqual(check(makeInvoice('lnbc100u'), MSATS), null);
        assert.strictEqual(check(makeInvoice('lnbc1'), MSATS), null);
        assert.strictEqual(check(makeInvoice('lnbc15p'), 1), null);
    });

    test(file + ': a missing amount is refused', () => {
        assert.strictEqual(check(makeInvoice('lnbc'), MSATS), null);
        assert.strictEqual(check(makeInvoice('lnbcu'), MSATS), null);
        assert.strictEqual(check(makeInvoice('lnbc0u'), 0), null);
    });

    test(file + ': testnet, signet and regtest are refused', () => {
        assert.strictEqual(check(makeInvoice('lntb10u'), MSATS), null);
        assert.strictEqual(check(makeInvoice('lntbs10u'), MSATS), null);
        assert.strictEqual(check(makeInvoice('lnbcrt10u'), MSATS), null);
        assert.strictEqual(check(makeInvoice('lnsb10u'), MSATS), null);
    });

    test(file + ': an expired invoice is refused (default 3600s and x tag)', () => {
        const now = Math.floor(NOW / 1000);
        assert.strictEqual(check(makeInvoice('lnbc10u', { timestamp: now - 3601 }), MSATS), null);
        assert.ok(check(makeInvoice('lnbc10u', { timestamp: now - 3500 }), MSATS));
        assert.strictEqual(check(makeInvoice('lnbc10u', { timestamp: now - 120, expiry: 60 }), MSATS), null);
        assert.ok(check(makeInvoice('lnbc10u', { timestamp: now - 120, expiry: 600 }), MSATS));
    });

    test(file + ': a lightning: prefix is stripped', () => {
        assert.strictEqual(check('lightning:' + valid, MSATS), valid);
        assert.strictEqual(check('LIGHTNING:' + valid, MSATS), valid);
        assert.strictEqual(check('  lightning:' + valid + '\n', MSATS), valid);
    });

    test(file + ': upper case is accepted and normalized, mixed case is not', () => {
        assert.strictEqual(check(valid.toUpperCase(), MSATS), valid);
        assert.strictEqual(check('LIGHTNING:' + valid.toUpperCase(), MSATS), valid);
        const mixed = valid.slice(0, 20) + valid.slice(20).toUpperCase();
        assert.strictEqual(check(mixed, MSATS), null);
    });

    test(file + ': a bad checksum is refused', () => {
        const i = valid.length - 10;
        const swap = valid[i] === 'q' ? 'p' : 'q';
        assert.strictEqual(check(valid.slice(0, i) + swap + valid.slice(i + 1), MSATS), null);
        assert.strictEqual(check(valid.slice(0, -1), MSATS), null);
    });

    test(file + ': garbage is refused', () => {
        [undefined, null, 42, {}, [], '', 'lnbc', 'lnbc10u1', 'not an invoice',
            'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns',
            valid + '"onerror="x', valid.slice(0, -3) + 'b' + valid.slice(-2), 'lnbc10u1' + 'q'.repeat(3000),
            makeInvoice('lnbc10u').replace('lnbc10u1', 'lnbc10u1x'), '<img src=x>' + valid,
        ].forEach((g) => assert.strictEqual(check(g, MSATS), null, String(g).slice(0, 40)));
    });
});

// ---- flow: the LNURL fallback never pays an invoice that fails the check ----
const META = JSON.stringify([['text/plain', 'Tip for alice'], ['text/identifier', 'alice@example.com']]);
const META_HASH = sha(META);
const goodInvoice = makeInvoice('lnbc10u', { h: [META_HASH] });
async function runFallback(file, pr, opt) {
    opt = opt || {};
    const meta = 'metadata' in opt ? opt.metadata : META;
    const els = {};
    const mk = (id) => (els[id] = els[id] || { id, innerHTML: '', textContent: '', disabled: false, value: '', style: {}, querySelector() { return null; } });
    const paid = [];
    const qr = [];
    const calls = [];
    const serverCalls = [];
    const extra = {};
    if ('serverInvoice' in opt) {
        extra.firebase = {
            functions: () => ({
                httpsCallable: (name) => async (data) => {
                    serverCalls.push(name);
                    return { data: { invoice: opt.serverInvoice, paymentHash: 'ab'.repeat(32) } };
                },
            }),
        };
    }
    const { win } = load(file, Object.assign(extra, {
        document: { addEventListener() {}, getElementById: (id) => (id === 'tipOverlay' ? null : mk(id)) },
        localStorage: { getItem: () => (opt.noWallet ? null : JSON.stringify({ method: 'nwc', nwcRelay: 'wss://relay.example' })) },
        fetch: async (url) => {
            calls.push(url);
            if (calls.length === 1) {
                const body = { callback: 'https://example.com/cb' };
                if (meta !== undefined) body.metadata = meta;
                return { ok: true, json: async () => body };
            }
            return { ok: true, json: async () => ({ pr }) };
        },
        setTimeout: () => 0,
        ...('crypto' in opt ? { crypto: opt.crypto } : {}),
    }));
    win.lnSendPaymentDirect = async (inv) => { paid.push(inv); };
    win._renderQRCode = (el, data) => { qr.push(data); };
    win._tipOpts = opt.tipOpts || { lightningAddress: 'alice@example.com', fixedAmount: true, suggestedAmount: 1000 };
    await win.executeTip();
    return { paid, qr, res: mk('tipResult').innerHTML, calls, serverCalls };
}

['lightning-tips.js.src', 'lightning-tips.js'].forEach((file) => {
    test(file + ': fallback pays a valid invoice for the asked amount', async () => {
        const out = await runFallback(file, 'lightning:' + goodInvoice.toUpperCase());
        assert.deepStrictEqual(out.paid, [goodInvoice]);
        assert.ok(out.calls[1].includes('amount=' + MSATS));
    });

    test(file + ': fallback refuses invoices that fail the check and shows a fixed error', async () => {
        const hostile = [
            makeInvoice('lnbc100u', { h: [META_HASH] }),
            makeInvoice('lnbc', { h: [META_HASH] }),
            makeInvoice('lntb10u', { h: [META_HASH] }),
            makeInvoice('lnbcrt10u', { h: [META_HASH] }),
            makeInvoice('lnbc10u', { h: [META_HASH], timestamp: Math.floor(NOW / 1000) - 7200 }),
            goodInvoice.slice(0, -1) + (goodInvoice.slice(-1) === 'q' ? 'p' : 'q'),
            "x');alert(1);('",
            { pr: 'obj' },
        ];
        for (const pr of hostile) {
            const out = await runFallback(file, pr);
            assert.deepStrictEqual(out.paid, [], 'paid: ' + String(pr).slice(0, 30));
            assert.deepStrictEqual(out.qr, [], 'qr: ' + String(pr).slice(0, 30));
            assert.ok(out.res.includes('No payment was sent'), 'error: ' + String(pr).slice(0, 30));
            assert.ok(!out.res.includes('alert'), 'echo');
        }
    });
});

// ---- LUD-06: description hash must match the LNURL-pay metadata ----
function expectRefused(out, label) {
    assert.deepStrictEqual(out.paid, [], 'paid: ' + label);
    assert.deepStrictEqual(out.qr, [], 'qr: ' + label);
    assert.ok(out.res.includes('No payment was sent'), 'error: ' + label);
}

['lightning-tips.js.src', 'lightning-tips.js'].forEach((file) => {
    test(file + ': test encoder writes the h tag the decoder reads', () => {
        const parsed = load(file).win._tipParseInvoice(goodInvoice, MSATS, NOW);
        assert.ok(parsed);
        assert.deepStrictEqual(Array.from(parsed.descHashes), [META_HASH]);
    });

    test(file + ': metadata check passes only on an exact match', async () => {
        const { win } = load(file);
        const parsed = win._tipParseInvoice(goodInvoice, MSATS, NOW);
        assert.strictEqual(await win._tipMetadataOk(parsed, META), true);
        assert.strictEqual(await win._tipMetadataOk(parsed, META + ' '), false);
        assert.strictEqual(await win._tipMetadataOk(parsed, ''), false);
        assert.strictEqual(await win._tipMetadataOk(parsed, undefined), false);
        assert.strictEqual(await win._tipMetadataOk(parsed, JSON.parse(META)), false);
        assert.strictEqual(await win._tipMetadataOk(null, META), false);
    });

    test(file + ': matching metadata hash pays', async () => {
        const out = await runFallback(file, goodInvoice);
        assert.deepStrictEqual(out.paid, [goodInvoice]);
    });

    test(file + ': mismatched metadata hash never pays', async () => {
        expectRefused(await runFallback(file, makeInvoice('lnbc10u', { h: [sha(META + 'x')] })), 'mismatch');
        expectRefused(await runFallback(file, goodInvoice, { metadata: META.replace('alice', 'mallory') }), 'other meta');
    });

    test(file + ': missing or non-string metadata never pays', async () => {
        expectRefused(await runFallback(file, goodInvoice, { metadata: undefined }), 'missing');
        expectRefused(await runFallback(file, goodInvoice, { metadata: '' }), 'empty');
        expectRefused(await runFallback(file, goodInvoice, { metadata: JSON.parse(META) }), 'array');
        expectRefused(await runFallback(file, goodInvoice, { metadata: null }), 'null');
    });

    test(file + ': missing, duplicate or short h tag never pays', async () => {
        expectRefused(await runFallback(file, makeInvoice('lnbc10u')), 'no h');
        expectRefused(await runFallback(file, makeInvoice('lnbc10u', { h: [META_HASH, META_HASH] })), 'two h');
        expectRefused(await runFallback(file, makeInvoice('lnbc10u', { h: [META_HASH.slice(0, 62)] })), 'short h');
    });

    test(file + ': no crypto.subtle never pays', async () => {
        expectRefused(await runFallback(file, goodInvoice, { crypto: {} }), 'no subtle');
        expectRefused(await runFallback(file, goodInvoice, { crypto: undefined }), 'no crypto');
        expectRefused(await runFallback(file, goodInvoice, { crypto: { subtle: { digest: () => Promise.reject(new Error('x')) } } }), 'digest throws');
    });
});

// ---- route hint fees, every pay path, and the address box ----
['lightning-tips.js.src', 'lightning-tips.js'].forEach((file) => {
    const check = (pr, msats) => load(file).win._tipCheckInvoice(pr, msats, NOW);

    test(file + ': route hint base fee up to max(10 sat, 1%) passes, over fails', () => {
        // 1000 sats: the limit is 10 sat = 10,000 msat.
        assert.ok(check(makeInvoice('lnbc10u', { r: [[{ base: 10000, ppm: 100 }]] }), MSATS));
        assert.ok(check(makeInvoice('lnbc10u', { r: [[{ base: 4000, ppm: 0 }, { base: 6000, ppm: 0 }]] }), MSATS));
        assert.strictEqual(check(makeInvoice('lnbc10u', { r: [[{ base: 10001, ppm: 0 }]] }), MSATS), null);
        assert.strictEqual(check(makeInvoice('lnbc10u', { r: [[{ base: 6000, ppm: 0 }, { base: 5000, ppm: 0 }]] }), MSATS), null);
        // 1,000,000 sats: 1% is 10,000 sat = 10,000,000 msat.
        assert.ok(check(makeInvoice('lnbc10m', { r: [[{ base: 10000000, ppm: 0 }]] }), 1e9));
        assert.strictEqual(check(makeInvoice('lnbc10m', { r: [[{ base: 10000001, ppm: 0 }]] }), 1e9), null);
        assert.strictEqual(check(makeInvoice('lnbc10u', { r: [[{ base: 0xffffffff, ppm: 0 }]] }), MSATS), null);
    });

    test(file + ': route hint fee rate up to 10,000 ppm passes, over fails', () => {
        assert.ok(check(makeInvoice('lnbc10u', { r: [[{ base: 0, ppm: 10000 }]] }), MSATS));
        assert.strictEqual(check(makeInvoice('lnbc10u', { r: [[{ base: 0, ppm: 10001 }]] }), MSATS), null);
        assert.strictEqual(check(makeInvoice('lnbc10u', { r: [[{ base: 0, ppm: 1 }, { base: 0, ppm: 20000 }]] }), MSATS), null);
        // A second route is checked on its own.
        assert.strictEqual(check(makeInvoice('lnbc10u', { r: [[{ base: 0, ppm: 1 }], [{ base: 0, ppm: 50000 }]] }), MSATS), null);
    });

    test(file + ': route hint fee rate is capped across the route and hop count is capped', () => {
        // Three hops at the cap still pass; one millionth over, or a fourth hop, fails.
        assert.ok(check(makeInvoice('lnbc10u', { r: [[{ base: 0, ppm: 4000 }, { base: 0, ppm: 4000 }, { base: 0, ppm: 2000 }]] }), MSATS));
        assert.strictEqual(check(makeInvoice('lnbc10u', { r: [[{ base: 0, ppm: 4000 }, { base: 0, ppm: 4000 }, { base: 0, ppm: 2001 }]] }), MSATS), null);
        assert.ok(check(makeInvoice('lnbc10u', { r: [[{ base: 0, ppm: 5000 }, { base: 0, ppm: 5000 }]] }), MSATS));
        assert.strictEqual(check(makeInvoice('lnbc10u', { r: [[{ base: 0, ppm: 5000 }, { base: 0, ppm: 5001 }]] }), MSATS), null);
        const fourLow = [{ base: 0, ppm: 0 }, { base: 0, ppm: 0 }, { base: 0, ppm: 0 }, { base: 0, ppm: 0 }];
        assert.strictEqual(check(makeInvoice('lnbc10u', { r: [fourLow] }), MSATS), null);
        const threeOk = [{ base: 1000, ppm: 0 }, { base: 1000, ppm: 0 }, { base: 1000, ppm: 0 }];
        assert.ok(check(makeInvoice('lnbc10u', { r: [threeOk] }), MSATS));
    });

    test(file + ': malformed route hints are refused', () => {
        const one = routeHex([{ base: 1, ppm: 1 }]);
        assert.strictEqual(check(makeInvoice('lnbc10u', { r: [one.slice(0, 100)] }), MSATS), null, 'short hop');
        assert.strictEqual(check(makeInvoice('lnbc10u', { r: [one + 'ff'] }), MSATS), null, 'trailing bytes');
        assert.strictEqual(check(makeInvoice('lnbc10u', { r: [''] }), MSATS), null, 'empty');
    });

    test(file + ': a given invoice is checked before paying', async () => {
        const tipOpts = (bolt11) => ({ bolt11, fixedAmount: true, suggestedAmount: 1000 });
        const ok = await runFallback(file, null, { tipOpts: tipOpts('lightning:' + valid.toUpperCase()) });
        assert.deepStrictEqual(ok.paid, [valid]);
        for (const bad of [makeInvoice('lnbc100u'), makeInvoice('lntb10u'), makeInvoice('lnbc10u', { timestamp: Math.floor(NOW / 1000) - 7200 }),
            makeInvoice('lnbc10u', { r: [[{ base: 20000, ppm: 0 }]] }), "x');alert(1);('"]) {
            expectRefused(await runFallback(file, null, { tipOpts: tipOpts(bad) }), 'given ' + bad.slice(0, 20));
            expectRefused(await runFallback(file, null, { tipOpts: tipOpts(bad), noWallet: true }), 'given qr ' + bad.slice(0, 20));
        }
        const qrOk = await runFallback(file, null, { tipOpts: tipOpts(valid), noWallet: true });
        assert.deepStrictEqual(qrOk.paid, []);
        assert.deepStrictEqual(qrOk.qr, ['lightning:' + valid]);
    });

    test(file + ': a server invoice is checked before paying', async () => {
        const tipOpts = { recipientUid: 'recipient1', fixedAmount: true, suggestedAmount: 1000 };
        const ok = await runFallback(file, null, { tipOpts, serverInvoice: valid.toUpperCase() });
        assert.deepStrictEqual(ok.serverCalls, ['requestTipInvoice']);
        assert.deepStrictEqual(ok.paid, [valid]);
        for (const bad of [makeInvoice('lnbc10010n'), makeInvoice('lnbc100u'), makeInvoice('lnbcrt10u'),
            makeInvoice('lnbc10u', { timestamp: Math.floor(NOW / 1000) - 7200 }),
            makeInvoice('lnbc10u', { r: [[{ base: 0, ppm: 20000 }]] }), 'lnbc10u1garbage']) {
            const out = await runFallback(file, null, { tipOpts, serverInvoice: bad });
            expectRefused(out, 'server ' + bad.slice(0, 20));
            assert.deepStrictEqual(out.calls, [], 'no fallback fetch after a refused server invoice');
            expectRefused(await runFallback(file, null, { tipOpts, serverInvoice: bad, noWallet: true }), 'server qr ' + bad.slice(0, 20));
        }
    });

    test(file + ': a failed metadata check shows the Lightning Address box', async () => {
        const out = await runFallback(file, makeInvoice('lnbc10u', { h: [sha(META + 'x')] }));
        expectRefused(out, 'hash');
        assert.ok(out.res.includes('_tipCopyLnBtn'), 'copy button');
        assert.ok(out.res.includes('alice@example.com'), 'address shown');
        const missing = await runFallback(file, goodInvoice, { metadata: undefined });
        assert.ok(missing.res.includes('_tipCopyLnBtn'));
        const amount = await runFallback(file, makeInvoice('lnbc100u', { h: [META_HASH] }));
        expectRefused(amount, 'amount');
        assert.ok(!amount.res.includes('_tipCopyLnBtn'), 'no address box for a wrong amount');
    });

    test(file + ': fallback refuses route hints over the fee limit', async () => {
        expectRefused(await runFallback(file, makeInvoice('lnbc10u', { h: [META_HASH], r: [[{ base: 10001, ppm: 0 }]] })), 'fallback fee');
        const ok = await runFallback(file, makeInvoice('lnbc10u', { h: [META_HASH], r: [[{ base: 10000, ppm: 10000 }]] }));
        assert.strictEqual(ok.paid.length, 1);
    });
});

(async () => {
    for (const run of pending) await run();
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
})();
