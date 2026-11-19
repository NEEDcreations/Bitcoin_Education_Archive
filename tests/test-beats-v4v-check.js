// Beats V4V split: each artist invoice is checked before it is paid or shown.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

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

// ---- bech32 invoice builder (test only) ----
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
function intWords(n, len) {
    const out = [];
    for (let i = 0; i < len; i++) { out.unshift(n % 32); n = Math.floor(n / 32); }
    return out;
}
function makeInvoice(hrp, opts) {
    opts = opts || {};
    const ts = opts.timestamp != null ? opts.timestamp : Math.floor(Date.now() / 1000);
    let words = intWords(ts, 7).concat([1], intWords(52, 2), new Array(52).fill(3), new Array(104).fill(7));
    const mod = polymod(hrpExpand(hrp).concat(words, [0, 0, 0, 0, 0, 0])) ^ 1;
    for (let i = 0; i < 6; i++) words.push((mod >>> (5 * (5 - i))) & 31);
    return hrp + '1' + words.map((w) => CHARSET[w]).join('');
}

function makeEl(id) {
    return { id: id || '', value: '', textContent: '', disabled: false, style: {}, innerHTML: '', querySelector() { return null; }, remove() {} };
}

function setup(opt) {
    opt = opt || {};
    const els = { v4vTipBtn: makeEl('v4vTipBtn'), v4vTipResult: makeEl('v4vTipResult'), v4vTipAmount: makeEl('v4vTipAmount') };
    els.v4vTipAmount.value = '1000';
    const paid = [];
    const timer = (fn, ms) => { const t = setTimeout(fn, ms); if (t && t.unref) t.unref(); return t; };
    const interval = (fn, ms) => { const t = setInterval(fn, ms); if (t && t.unref) t.unref(); return t; };
    const sandbox = {
        console: { log() {}, warn() {}, error() {}, info() {} },
        setTimeout: timer,
        clearTimeout: clearTimeout,
        setInterval: interval,
        clearInterval: clearInterval,
        localStorage: {
            getItem: (k) => (k === 'btc_ln_state' && !opt.noWallet ? JSON.stringify({ method: 'nwc', nwcRelay: 'wss://relay.example' }) : null),
            setItem() {},
            removeItem() {},
        },
        sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
        location: { hash: '', href: 'http://localhost/' },
        navigator: {},
        addEventListener() {},
        removeEventListener() {},
        Audio: function () { return { volume: 1, pause() {}, play() { return Promise.resolve(); }, addEventListener() {} }; },
        escapeHtml: (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
        safeJSON: () => [],
        _safeCover: (src) => src || '',
        beatsFormatTime: () => '0:00',
        beatsCensor: (s) => s,
        showToast() {},
        auth: { currentUser: null, onAuthStateChanged() {} },
        firebase: {
            functions: () => ({
                httpsCallable: () => async () => ({ data: { invoices: opt.invoices } }),
            }),
        },
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.document = {
        body: { appendChild() {}, children: [] },
        head: { appendChild() {} },
        getElementById: (id) => els[id] || null,
        createElement: () => makeEl(),
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener() {},
    };
    vm.createContext(sandbox);
    if (!opt.noChecker) vm.runInContext(read('lightning-tips.js'), sandbox, { filename: 'lightning-tips.js' });
    vm.runInContext(read('beats.js'), sandbox, { filename: 'beats.js' });
    sandbox.lnSendPaymentDirect = async (inv) => { paid.push(inv); };
    return { sandbox, els, paid };
}

function artist(name, sats, invoice) {
    return { name, amountSats: sats, canPay: true, canPayLnurl: true, invoice, lightningAddress: name + '@example.com' };
}

test('valid artist invoices are paid in normalized form', async () => {
    const a = makeInvoice('lnbc6u');
    const b = makeInvoice('lnbc4u');
    const t = setup({ invoices: [artist('ada', 600, 'lightning:' + a.toUpperCase()), artist('bob', 400, b)] });
    await t.sandbox.beatsExecuteV4VTip('track1');
    assert.deepStrictEqual(t.paid, [a, b]);
    assert.ok(t.els.v4vTipResult.innerHTML.includes('2 payment(s) sent'));
});

test('artist invoices that fail the check are never paid', async () => {
    const good = makeInvoice('lnbc6u');
    const bad = [
        makeInvoice('lnbc40u'),
        makeInvoice('lntb4u'),
        makeInvoice('lnbc4u', { timestamp: Math.floor(Date.now() / 1000) - 7200 }),
        "x');alert(1);('",
    ];
    for (const inv of bad) {
        const t = setup({ invoices: [artist('ada', 600, good), artist('bob', 400, inv)] });
        await t.sandbox.beatsExecuteV4VTip('track1');
        assert.deepStrictEqual(t.paid, [good], String(inv).slice(0, 20));
        const html = t.els.v4vTipResult.innerHTML;
        assert.ok(html.includes('Could not verify this invoice. No payment was sent.'));
        assert.ok(!html.includes('alert(1)'), 'invoice text not echoed');
    }
});

test('without a wallet, only checked invoices are shown to copy', async () => {
    const good = makeInvoice('lnbc6u');
    const t = setup({ noWallet: true, invoices: [artist('ada', 600, good), artist('bob', 400, makeInvoice('lnbc40u'))] });
    await t.sandbox.beatsExecuteV4VTip('track1');
    const html = t.els.v4vTipResult.innerHTML;
    assert.ok(html.includes('data-inv="' + good + '"'));
    assert.strictEqual((html.match(/data-inv=/g) || []).length, 1);
    assert.ok(html.includes('Could not verify this invoice'));
});

test('with the checker missing, nothing is paid', async () => {
    const t = setup({ noChecker: true, invoices: [artist('ada', 600, makeInvoice('lnbc6u'))] });
    await t.sandbox.beatsExecuteV4VTip('track1');
    assert.deepStrictEqual(t.paid, []);
    assert.ok(t.els.v4vTipResult.innerHTML.includes('Could not verify this invoice'));
});

(async () => {
    for (const run of pending) await run();
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
})();
