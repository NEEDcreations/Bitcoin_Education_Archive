// Tips: the client LNURL fallback checks the returned invoice before paying.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
function makeInvoice(hrp, opts) {
    opts = opts || {};
    const ts = opts.timestamp != null ? opts.timestamp : Math.floor(Date.now() / 1000);
    let words = intWords(ts, 7);
    // payment hash tag (p = 1), 52 words
    words = words.concat([1], intWords(52, 2), new Array(52).fill(3));
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
async function runFallback(file, pr) {
    const els = {};
    const mk = (id) => (els[id] = els[id] || { id, innerHTML: '', textContent: '', disabled: false, value: '', style: {}, querySelector() { return null; } });
    const paid = [];
    const qr = [];
    const calls = [];
    const { win } = load(file, {
        document: { addEventListener() {}, getElementById: (id) => (id === 'tipOverlay' ? null : mk(id)) },
        localStorage: { getItem: () => JSON.stringify({ method: 'nwc', nwcRelay: 'wss://relay.example' }) },
        fetch: async (url) => {
            calls.push(url);
            if (calls.length === 1) return { ok: true, json: async () => ({ callback: 'https://example.com/cb' }) };
            return { ok: true, json: async () => ({ pr }) };
        },
        setTimeout: () => 0,
    });
    win.lnSendPaymentDirect = async (inv) => { paid.push(inv); };
    win._renderQRCode = (el, data) => { qr.push(data); };
    win._tipOpts = { lightningAddress: 'alice@example.com', fixedAmount: true, suggestedAmount: 1000 };
    await win.executeTip();
    return { paid, qr, res: mk('tipResult').innerHTML, calls };
}

['lightning-tips.js.src', 'lightning-tips.js'].forEach((file) => {
    test(file + ': fallback pays a valid invoice for the asked amount', async () => {
        const out = await runFallback(file, 'lightning:' + valid.toUpperCase());
        assert.deepStrictEqual(out.paid, [valid]);
        assert.ok(out.calls[1].includes('amount=' + MSATS));
    });

    test(file + ': fallback refuses invoices that fail the check and shows a fixed error', async () => {
        const hostile = [
            makeInvoice('lnbc100u'),
            makeInvoice('lnbc'),
            makeInvoice('lntb10u'),
            makeInvoice('lnbcrt10u'),
            makeInvoice('lnbc10u', { timestamp: Math.floor(NOW / 1000) - 7200 }),
            valid.slice(0, -1) + (valid.slice(-1) === 'q' ? 'p' : 'q'),
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

(async () => {
    for (const run of pending) await run();
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
})();
