// Timechain TV: live block height chip next to the BLOCKSURF pill (RLDA-71).
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const root = path.join(__dirname, '..');
const tv = fs.readFileSync(path.join(root, 'timechain-tv.js'), 'utf8');
let passed = 0, failed = 0;
const pending = [];
function test(name, fn) {
    pending.push(Promise.resolve().then(fn).then(function () { console.log('✅ ' + name); passed++; },
        function (err) { console.log('❌ ' + name + ': ' + err.message); failed++; }));
}

function moduleSrc() {
    const start = tv.indexOf('/* TCTV live block height chip');
    assert.ok(start > 0, 'module missing');
    const end = tv.indexOf('}();', start);
    return tv.slice(start, end + 4);
}

function sandbox(opts) {
    const val = { textContent: '—' };
    const listeners = {};
    const intervals = [];
    const sb = {
        Number, isFinite, Math, parseInt, Promise,
        document: {
            hidden: !!opts.hidden,
            getElementById: function (id) {
                if (opts.noChip) return null;
                if (id === 'tctv-block-height') return {};
                if (id === 'tctv-block-height-val') return val;
                return null;
            },
            addEventListener: function (ev, fn) { listeners[ev] = fn; }
        },
        setInterval: function (fn, ms) { intervals.push(ms); return 1; },
        fetch: function (url) {
            sb._urls.push(url);
            const r = opts.responses.shift();
            if (r instanceof Error) return Promise.reject(r);
            return Promise.resolve({ ok: r.ok !== false, text: function () { return Promise.resolve(r.body); } });
        },
        _urls: []
    };
    sb.window = sb;
    vm.createContext(sb);
    vm.runInContext(moduleSrc(), sb);
    return { sb, val, listeners, intervals };
}
const flush = () => new Promise(r => setTimeout(r, 5));

test('header puts a fixed-width chip right after the BLOCKSURF pill', function () {
    const i = tv.indexOf('<span>BLOCKSURF</span>');
    const after = tv.slice(i, i + 1600);
    const chipAt = after.indexOf('id="tctv-block-height"');
    assert.ok(chipAt > 0 && chipAt < after.indexOf('tctv-main-viewers'));
    assert.ok(/id="tctv-block-height"[^>]*width:68px;flex:0 0 68px/.test(after), 'reserved width');
    assert.ok(after.includes('font-variant-numeric:tabular-nums'));
    assert.ok(after.includes('id="tctv-block-height-val"'));
});

test('formats with commas and never shows NaN or blank', function () {
    const { sb } = sandbox({ responses: [] });
    assert.strictEqual(sb.tctvFormatBlockHeight(927123), '927,123');
    ['', null, undefined, NaN, 'abc', -1, 0, 1.5].forEach(function (b) {
        assert.strictEqual(sb.tctvFormatBlockHeight(b), '—');
    });
});

test('polls every 30-60s from the existing mempool.space tip endpoint', async function () {
    const { sb, val, intervals } = sandbox({ responses: [{ body: '927123' }] });
    assert.strictEqual(intervals.length, 1);
    assert.ok(intervals[0] >= 30000 && intervals[0] <= 60000, String(intervals[0]));
    sb.tctvBlockHeightTick();
    await flush();
    assert.deepStrictEqual(sb._urls, ['https://mempool.space/api/blocks/tip/height']);
    assert.strictEqual(val.textContent, '927,123');
});

test('keeps the last value on fetch error, bad body, or HTTP error', async function () {
    const { sb, val } = sandbox({ responses: [{ body: '927123' }, new Error('net'), { body: 'oops' }, { ok: false, body: '1' }, { body: '927124' }] });
    for (let k = 0; k < 4; k++) { sb.tctvBlockHeightTick(); await flush(); assert.strictEqual(val.textContent, '927,123'); }
    sb.tctvBlockHeightTick(); await flush();
    assert.strictEqual(val.textContent, '927,124');
});

test('pauses while the tab is hidden and refreshes on return', async function () {
    const ctx = sandbox({ hidden: true, responses: [{ body: '927200' }] });
    ctx.sb.tctvBlockHeightTick(); await flush();
    assert.strictEqual(ctx.sb._urls.length, 0);
    ctx.sb.document.hidden = false;
    ctx.listeners.visibilitychange(); await flush();
    assert.strictEqual(ctx.val.textContent, '927,200');
});

test('does nothing when Timechain TV is not open', async function () {
    const { sb } = sandbox({ noChip: true, responses: [] });
    sb.tctvBlockHeightTick(); await flush();
    assert.strictEqual(sb._urls.length, 0);
});

test('uses a newer Blocksurf websocket height right away', async function () {
    const { sb, val } = sandbox({ responses: [new Error('x')] });
    sb._blockSurfHeight = 927300;
    sb.tctvBlockHeightTick(); await flush();
    assert.strictEqual(val.textContent, '927,300');
});

Promise.all(pending).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
