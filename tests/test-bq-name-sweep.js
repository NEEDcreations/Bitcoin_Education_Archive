#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function test(name, fn) {
    fn();
    console.log('✅ ' + name);
}

test('index.html and 404.html match, and pins are v2739', function() {
    const index = read('index.html');
    assert.strictEqual(index, read('404.html'));
    assert.ok(read('sw.js').includes("const CACHE_NAME = 'btc-archive-v2739'"));
    assert.ok(index.includes('bundle.min.js?v=20261127_v2739'));
    assert.ok(index.includes('ranking.js?v=20261127_v2739'));
    assert.ok(index.includes('apple-mobile-web-app-title" content="Bitcoin Quest"'));
});

test('the manifest and in-app titles use Bitcoin Quest', function() {
    const man = JSON.parse(read('manifest.json'));
    assert.strictEqual(man.name, 'Bitcoin Quest');
    assert.strictEqual(man.short_name, 'Bitcoin Quest');
    const app = read('app.js');
    assert.ok(app.includes("var baseTitle = 'Bitcoin Quest'"));
    assert.ok(!app.includes("var baseTitle = 'Bitcoin Education Archive'"));
    assert.ok(read('ranking.js').includes("document.title = 'Bitcoin Quest'"));
    assert.ok(read('terms.html').includes('<title>Terms of Service - Bitcoin Quest</title>'));
    assert.ok(read('privacy.html').includes('<title>Privacy Policy - Bitcoin Quest</title>'));
});

test('organization schema and trademark notices stay Bitcoin Education Archive', function() {
    const html = read('index.html');
    assert.ok(html.includes('"name": "Bitcoin Education Archive"'));
    assert.ok(html.includes('Bitcoin Education Archive™'));
    assert.ok(read('terms.html').includes('is a trademark'));
    assert.ok(read('privacy.html').includes('"Bitcoin Education Archive" is a trademark'));
});

test('FAQ, welcome copy, and tab titles no longer call the app Bitcoin Education Archive', function() {
    const html = read('index.html');
    assert.ok(html.includes('What is the Bitcoin Quest?'));
    assert.ok(html.includes('The Bitcoin Quest is a free, open-source platform'));
    assert.ok(html.includes('continue using Bitcoin Quest.'));
    assert.ok(!html.includes('What is the Bitcoin Education Archive?'));
    const nacho = read('nacho.js');
    assert.ok(nacho.includes('Welcome to the Bitcoin Quest'));
    assert.ok(!nacho.includes('Welcome to the Bitcoin Education Archive'));
});

console.log('---\nPassed: 4  Failed: 0');
