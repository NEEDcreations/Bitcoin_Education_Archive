#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('  ok  ' + name);
        passed++;
    } catch (e) {
        console.log('  FAIL ' + name);
        console.log('       ' + (e.stack || e.message));
        failed++;
    }
}

function read(rel) {
    return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

test('Blocksurf shows height and an ET timestamp, and falls back when the fetch fails', function () {
    const src = read('timechain-tv.js');
    assert.ok(src.includes('id="tctv-blocksurf-meta"'));
    assert.ok(src.includes('window.tctvFormatBlockTime'));
    assert.ok(src.includes('window.tctvRenderBlockSurfMeta'));
    assert.ok(src.includes('window.tctvFetchBlockTime'));
    assert.ok(src.includes("timeZone:'America/New_York'") || src.includes('timeZone:"America/New_York"'));
    assert.ok(src.includes('time unavailable'));
    assert.ok(src.includes('https://mempool.space/api/v1/blocks/'));
    assert.ok(src.includes('t.block.timestamp||t.block.time'));
    assert.ok(src.includes('function E(t,s)'));
});

test('tctvFormatBlockTime labels the block time in ET', function () {
    const src = read('timechain-tv.js');
    const start = src.indexOf('window.tctvFormatBlockTime=');
    const end = src.indexOf('window.tctvRenderBlockSurfMeta=', start);
    assert.ok(start > 0 && end > start);
    const sandbox = { window: {}, Date, isNaN };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(src.slice(start, end), sandbox);
    const ts = Date.UTC(2026, 10, 17, 13, 45, 0) / 1000; // 1:45 PM UTC = 8:45 AM ET
    const text = sandbox.window.tctvFormatBlockTime(ts);
    assert.ok(/ET$/.test(text), text);
    assert.ok(/8:45/.test(text) && /AM/.test(text), text);
    assert.ok(/Nov/.test(text), text);
});

test('tctvRenderBlockSurfMeta writes height, time, or the fallback', function () {
    const src = read('timechain-tv.js');
    const start = src.indexOf('window.tctvFormatBlockTime=');
    const end = src.indexOf('window.tctvFetchBlockTime=', start);
    const el = { textContent: '', title: '' };
    const sandbox = {
        window: {},
        Date: Date,
        isNaN: isNaN,
        document: { getElementById: function (id) { return id === 'tctv-blocksurf-meta' ? el : null; } }
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(src.slice(start, end), sandbox);
    sandbox.window.tctvRenderBlockSurfMeta(920000, Date.UTC(2026, 10, 17, 13, 45, 0) / 1000, false);
    assert.ok(el.textContent.indexOf('#920000') === 0, el.textContent);
    assert.ok(el.textContent.indexOf('ET') !== -1, el.textContent);
    sandbox.window.tctvRenderBlockSurfMeta(920000, null, true);
    assert.strictEqual(el.textContent, '#920000 · time unavailable');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
