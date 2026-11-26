#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const helper = require(path.join(root, 'kids-account.js'));
const fnHelper = require(path.join(root, 'functions/kids-account.js'));

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ok  ' + name); passed++; }
    catch (e) { console.log('  FAIL ' + name + ': ' + (e && e.stack ? e.stack : e)); failed++; }
}

test('root and functions copies are identical', function () {
    assert.strictEqual(
        fs.readFileSync(path.join(root, 'kids-account.js'), 'utf8'),
        fs.readFileSync(path.join(root, 'functions/kids-account.js'), 'utf8')
    );
    assert.strictEqual(helper.isKidsAccount, helper.isKidsAccount);
    assert.strictEqual(typeof fnHelper.isKidsAccount, 'function');
});

test('shared helper covers kids, isKids, kidsMode and the existing flags', function () {
    assert.strictEqual(helper.isKidsAccount(null), false);
    assert.strictEqual(helper.isKidsAccount({}), false);
    assert.strictEqual(helper.isKidsAccount({ over18: true }), false);
    assert.ok(helper.isKidsAccount({ isMinor: true }));
    assert.ok(helper.isKidsAccount({ under13: true }));
    assert.ok(helper.isKidsAccount({ kids: true }));
    assert.ok(helper.isKidsAccount({ isKids: true }));
    assert.ok(helper.isKidsAccount({ kidsMode: true }));
    assert.ok(helper.isKidsAccount({ ageBand: 'minor' }));
    assert.ok(helper.isKidsAccount({ age_band: 'under13' }));
    assert.ok(helper.isKidsAccount({ accountType: 'family-child' }));
    assert.ok(helper.KIDS_BOOL_FLAGS.indexOf('kids') !== -1);
    assert.ok(helper.KIDS_BOOL_FLAGS.indexOf('isKids') !== -1);
    assert.ok(helper.KIDS_BOOL_FLAGS.indexOf('kidsMode') !== -1);
});

test('ads.js flag list stays in sync when ads.js is present', function () {
    const adsPath = path.join(root, 'ads.js');
    if (!fs.existsSync(adsPath)) {
        console.log('  skip  ads.js is not on this branch (PR #401); helper is ready for the merge');
        return;
    }
    const src = fs.readFileSync(adsPath, 'utf8');
    helper.KIDS_BOOL_FLAGS.forEach(function (flag) {
        assert.ok(src.indexOf('user.' + flag + ' === true') !== -1, 'ads.js missing ' + flag);
    });
    helper.KIDS_AGE_BANDS.forEach(function (band) {
        assert.ok(src.indexOf("'" + band + "'") !== -1 || src.indexOf('"' + band + '"') !== -1, 'ads.js missing band ' + band);
    });
    helper.KIDS_ACCOUNT_LABELS.forEach(function (label) {
        assert.ok(src.indexOf("'" + label + "'") !== -1 || src.indexOf('"' + label + '"') !== -1, 'ads.js missing label ' + label);
    });
});

console.log(passed + ' passed' + (failed ? ', ' + failed + ' failed' : ''));
process.exit(failed ? 1 : 0);
