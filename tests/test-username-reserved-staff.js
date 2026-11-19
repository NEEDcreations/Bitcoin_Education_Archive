#!/usr/bin/env node
'use strict';
// Staff usernames phil, rufus, bq, and 603btc are reserved as whole names
// after the same folding the PvP guest battle-name check uses. Other reserved
// words keep their existing exact / substring rules. Existing usernames are
// never changed; this only affects new picks (and assessUsername allows a
// self-same reserved name via selfHasSame).

const assert = require('assert');
const path = require('path');
const root = path.join(__dirname, '..');
const policy = require(path.join(root, 'functions', 'src', 'usernamePolicy.js'));
const reservedNames = require(path.join(root, 'functions', 'src', 'reservedNames.js'));
const pvpFlow = require(path.join(root, 'functions', 'src', 'pvpFlow.js'));

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ok  ' + name); passed++; }
    catch (e) { console.log('  FAIL ' + name + '\n   ' + (e && e.stack ? e.stack : e)); failed++; }
}

test('shared list is phil, rufus, bq, and 603btc, and PvP uses the same folding', function () {
    assert.deepStrictEqual(reservedNames.STAFF_RESERVED_EXACT.slice(), ['phil', 'rufus', 'bq', '603btc']);
    ['Ph1l', 'PHIL', 'RUFU5', '603BTC', 'bq', 'philosopher'].forEach(function (n) {
        assert.strictEqual(reservedNames.foldName(n), pvpFlow.foldName(n), n);
    });
});

test('username policy blocks look-alike and case-folded staff names as whole names', function () {
    ['Ph1l', 'PHIL', 'rufus', 'RUFU5', 'bq', '603BTC'].forEach(function (n) {
        assert.strictEqual(policy.reservedName(n), true, n);
    });
    // bq is also shorter than MIN_LEN, so assessUsername reports short first.
    // Longer folded forms still fail as reserved.
    assert.strictEqual(assessError('Ph1l'), 'reserved');
    assert.strictEqual(assessError('PHIL'), 'reserved');
    assert.strictEqual(assessError('rufus'), 'reserved');
    assert.strictEqual(assessError('RUFU5'), 'reserved');
    assert.strictEqual(assessError('603BTC'), 'reserved');
    assert.strictEqual(assessError('bq'), 'short');
    assert.strictEqual(assessError('b.q'), 'reserved');
});

test('substring names stay allowed; existing reserved words still use substring matching', function () {
    ['philosopher', 'bqfan', 'rufusfan'].forEach(function (n) {
        assert.strictEqual(policy.reservedName(n), false, n);
        const out = policy.assessUsername(n, {});
        assert.strictEqual(out.ok, true, n + ' ' + out.error);
        assert.strictEqual(out.username, n);
    });
    // Existing policy: "admin" is a substring, "mod" is exact-only.
    assert.strictEqual(policy.reservedName('AdminBot'), true);
    assert.strictEqual(policy.reservedName('modern'), false);
});

test('an account that already has a reserved staff name can keep it; others cannot take it', function () {
    const keep = policy.assessUsername('rufus', { selfHasSame: true });
    assert.strictEqual(keep.ok, true);
    const admin = policy.assessUsername('rufus', { allowReserved: true });
    assert.strictEqual(admin.ok, true);
});

function assessError(name) {
    const out = policy.assessUsername(name, {});
    assert.strictEqual(out.ok, false, name + ' should be blocked');
    return out.error;
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
