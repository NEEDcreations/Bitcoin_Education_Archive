#!/usr/bin/env node
'use strict';
// resets.html (Resets, Timelines & Odds) must match the server code it documents.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const bip = require('../functions/src/bipBreakthrough');
const questBoard = require('../functions/src/questBoard');
const giftRoll = require('../functions/src/giftRoll');

const html = fs.readFileSync(path.join(__dirname, '..', 'resets.html'), 'utf8');
let pass = 0;
function test(name, fn) { fn(); pass++; console.log('  ok ' + name); }

const script = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
const sandbox = { window: {}, document: { getElementById: () => null }, Intl, Date };
vm.runInNewContext(script, sandbox);
const pageBip = sandbox.window.__bqBipForWeek;

test('page BIP list matches BIP_CATALOG order', () => {
    const m = script.match(/var BIPS = (\[[\s\S]*?\]);\n/);
    const list = vm.runInNewContext(m[1]);
    assert.strictEqual(JSON.stringify(list.map((r) => r[0])), JSON.stringify(bip.BIP_CATALOG.map((r) => r.number)));
    list.forEach((r, i) => {
        assert.strictEqual(r[1], bip.BIP_CATALOG[i].short);
        assert.strictEqual(r[2], bip.BIP_CATALOG[i].title);
    });
});

test('page picks the same BIP as the server for 160 weeks', () => {
    const start = Date.parse('2026-11-18T17:00:00Z');
    for (let w = 0; w < 160; w++) {
        const key = questBoard.weekKey(start + w * 7 * 86400000);
        assert.strictEqual(pageBip(key)[0], bip.bipForWeek(key).number, key);
    }
});

test('static fallback rows match the server', () => {
    const rows = html.match(/<tbody id="bipScheduleRows">([\s\S]*?)<\/tbody>/)[1];
    const re = /<td class="when">(\d{4}-\d{2}-\d{2})<\/td><td>BIP (\d+) /g;
    let m, n = 0;
    while ((m = re.exec(rows))) { assert.strictEqual(Number(m[2]), bip.bipForWeek(m[1]).number, m[1]); n++; }
    assert.ok(n >= 6);
});

test('streak target and title length match the page', () => {
    assert.strictEqual(bip.STREAK_TARGET, 7);
    assert.strictEqual(bip.TITLE_DAYS_MS, 7 * 86400000);
    assert.ok(html.includes('7 Eastern calendar days in a row'));
    assert.ok(html.includes('Core Contributor chat title for 7 days'));
});

test('gift count odds match giftRoll', () => {
    const counts = { 2: 0, 3: 0, 4: 0, 5: 0 };
    for (let g = 0; g < 10000; g++) counts[giftRoll.rollGiftCount(() => g)]++;
    assert.deepStrictEqual(counts, { 2: 1500, 3: 4000, 4: 3000, 5: 1500 });
    assert.ok(html.includes('2 gifts (15%), 3 (40%), 4 (30%) or 5 (15%)'));
});

test('cipher odds rows match cipherReward', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'cipherReward.js'), 'utf8');
    const re = /\{ amount: (\d+),\s+odds: (\d+) \}/g;
    let m, n = 0;
    while ((m = re.exec(src))) {
        const row = '<td>' + Number(m[1]).toLocaleString('en-US') + ' sats</td><td class="num">1 in ' + Number(m[2]).toLocaleString('en-US') + '</td>';
        assert.ok(html.includes(row), row);
        n++;
    }
    assert.strictEqual(n, 12);
});

test('spin wheel weights match dailySpin', () => {
    const idx = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    const at = idx.indexOf('exports.dailySpin');
    const body = idx.slice(at, at + 6000);
    const w = [...body.matchAll(/rare: (?:true|false),\s+weight: ([\d.]+) \}/g)].map((x) => Number(x[1]));
    assert.deepStrictEqual(w, [25, 22, 18, 12, 8, 5, 4, 3, 1.5, 1.5]);
    const r = [...body.matchAll(/tickets: (\d+),\s+weight: (\d+) \}/g)].map((x) => Number(x[2]));
    assert.deepStrictEqual(r, [1000, 500, 100, 50, 10, 3]);
});

test('page has jump links and an Odds section', () => {
    ['daily', 'weekly', 'monthly', 'other', 'bip-breakthrough', 'odds'].forEach((id) => {
        assert.ok(html.includes('id="' + id + '"'), id);
        assert.ok(html.includes('href="#' + id + '"'), id);
    });
});

console.log('resets page: ' + pass + ' passed');
