#!/usr/bin/env node
'use strict';

// The sats hold banner in Settings shows the year, so a hold into next year
// (or one left over from last year) never reads as the wrong date.

process.env.TZ = 'America/New_York';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'ranking.js'), 'utf8');
let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

function loadFormatter() {
    const start = src.indexOf('function formatSatsHoldUntil(');
    assert.ok(start !== -1, 'formatSatsHoldUntil exists');
    const end = src.indexOf('\n}\n', start);
    return new Function(src.slice(start, end + 2) + '\nreturn formatSatsHoldUntil;')();
}

test('a hold into next year shows that year', function () {
    const fmt = loadFormatter();
    const ms = Date.UTC(2027, 10, 21, 0, 19); // Nov 20, 2027, 7:19 PM Eastern
    assert.strictEqual(fmt(ms, 'en-US'), 'Nov 20, 2027, 7:19 PM');
});

test('a hold from a past year shows that year', function () {
    const fmt = loadFormatter();
    const ms = Date.UTC(2025, 10, 21, 0, 19); // Nov 20, 2025, 7:19 PM Eastern
    assert.strictEqual(fmt(ms, 'en-US'), 'Nov 20, 2025, 7:19 PM');
});

test('same-year and other locales still include the year', function () {
    const fmt = loadFormatter();
    const ms = Date.UTC(2026, 11, 3, 15, 5); // Dec 3, 2026, 10:05 AM Eastern
    assert.strictEqual(fmt(ms, 'en-US'), 'Dec 3, 2026, 10:05 AM');
    assert.ok(/2026/.test(fmt(ms, 'en-GB')));
    assert.ok(/2026/.test(fmt(ms)));
    assert.ok(/2027/.test(fmt(String(Date.UTC(2027, 0, 1, 17)))));
});

test('the settings banner uses the formatter, not a yearless format', function () {
    const at = src.indexOf('id="satsHoldNotice"');
    assert.ok(at !== -1);
    const block = src.slice(src.lastIndexOf('if (satsHeld) {', at), at);
    assert.ok(block.includes('formatSatsHoldUntil(holdUntil)'));
    assert.ok(!/month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' \}/.test(src.replace(/year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'/g, '')));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
