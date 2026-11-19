// V4V tip amounts: the shares add up to the tip, with a cap on the list.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e));
        failed++;
    }
}

function loadAlloc() {
    const helper = path.join(root, 'functions/src/v4vAlloc.js');
    try {
        return require(helper);
    } catch (err) {
        if (!err || err.code !== 'MODULE_NOT_FOUND') throw err;
        // The formula still in v4vSplitRelay when the helper is absent.
        return {
            V4V_SPLITS_MAX: 10,
            v4vSplitsOk: function() { return true; },
            allocateV4vSats: function(amountSats, splits) {
                const rows = (splits || []).filter(function(s) { return s && s.split > 0; });
                const totalSplit = rows.reduce(function(s, r) { return s + r.split; }, 0);
                return rows.map(function(r) {
                    return Math.max(1, Math.round(amountSats * (r.split / totalSplit)));
                });
            },
        };
    }
}

const alloc = loadAlloc();

test('equal shares of an odd tip sum to the tip', function() {
    const got = alloc.allocateV4vSats(11, [{ split: 50 }, { split: 50 }]);
    assert.ok(Array.isArray(got));
    assert.strictEqual(got.reduce(function(s, n) { return s + n; }, 0), 11);
    assert.deepStrictEqual(got.slice().sort(), [5, 6]);
});

test('three equal shares of 10 sats sum to 10', function() {
    const got = alloc.allocateV4vSats(10, [{ split: 1 }, { split: 1 }, { split: 1 }]);
    assert.strictEqual(got.reduce(function(s, n) { return s + n; }, 0), 10);
    assert.deepStrictEqual(got.slice().sort(), [3, 3, 4]);
});

test('a list over the cap or a non-positive share is refused', function() {
    const eleven = [];
    for (let i = 0; i < 11; i++) eleven.push({ split: 1 });
    assert.strictEqual(alloc.v4vSplitsOk(eleven), false);
    assert.strictEqual(alloc.v4vSplitsOk([]), false);
    assert.strictEqual(alloc.v4vSplitsOk([{ split: 0 }]), false);
    assert.strictEqual(alloc.v4vSplitsOk([{ split: -1 }]), false);
    assert.strictEqual(alloc.v4vSplitsOk([{ split: 1 }, { split: 0 }]), false);
    assert.strictEqual(alloc.v4vSplitsOk(null), false);
    assert.strictEqual(alloc.v4vSplitsOk([{ split: 1 }]), true);
    const ten = [];
    for (let i = 0; i < 10; i++) ten.push({ split: 1 });
    assert.strictEqual(alloc.v4vSplitsOk(ten), true);
    assert.strictEqual(alloc.allocateV4vSats(10, eleven), null);
});

test('the relay uses the shared allocator and keeps the exact total', function() {
    const index = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    const start = index.indexOf('exports.v4vSplitRelay');
    assert.ok(start > 0);
    const body = index.slice(start, index.indexOf('async function fetchLnurlInvoice', start));
    assert.ok(body.includes('allocateV4vSats'));
    assert.ok(!body.includes('Math.max(1, Math.round(amountSats * fraction))'));
    assert.ok(body.includes('v4vSplitsOk'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
