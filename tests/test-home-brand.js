#!/usr/bin/env node
'use strict';
// App header brand: BITCOIN QUEST with the graduate-cap logo, not the coin SVG.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

const html = read('index.html');
const COIN = '<circle cx="32" cy="32" r="30" fill="#f7931a"/><g transform="rotate(14,32,32)">';

test('index.html and 404.html stay identical', () => {
    assert.strictEqual(html, read('404.html'));
});

test('desktop sidebar brand reads BITCOIN QUEST with the cap logo', () => {
    const start = html.indexOf('<div class="sidebar-header">');
    assert.ok(start > 0);
    const block = html.slice(start, html.indexOf('</h2>', start) + 5);
    assert.ok(block.includes('BITCOIN<br>QUEST'));
    assert.ok(!block.includes('EDUCATION'));
    assert.ok(block.includes('class="bq-brand-logo"'));
    assert.ok(block.includes('sizes="44px"'));
    assert.ok(!block.includes(COIN));
});

test('mobile bar brand reads BITCOIN QUEST + HOME with the cap logo', () => {
    const start = html.indexOf('<div class="mobile-brand"');
    assert.ok(start > 0);
    const block = html.slice(start, html.indexOf('mobile-brand-home', start) + 40);
    assert.ok(block.includes('<span>BITCOIN</span><span>QUEST</span>'));
    assert.ok(block.includes('>HOME<'));
    assert.ok(block.includes('class="bq-brand-logo"'));
    assert.ok(block.includes('sizes="30px"'));
    assert.ok(!block.includes(COIN));
});

test('no header still says BITCOIN EDUCATION ARCHIVE', () => {
    assert.ok(!html.includes('BITCOIN<br>EDUCATION ARCHIVE'));
    assert.ok(!html.includes('<span>EDUCATION</span><span>ARCHIVE</span>'));
    assert.ok(html.includes('<h1 class="home-title">BITCOIN QUEST<span'));
});

test('cap logo srcset files exist at 1x through 4x and are square PNGs', () => {
    const m = html.match(/class="bq-brand-logo" src="([^"]+)" srcset="([^"]+)"/);
    assert.ok(m);
    const files = [m[1]].concat(m[2].split(',').map((s) => s.trim().split(' ')[0]));
    for (const f of files) {
        const buf = fs.readFileSync(path.join(root, f.replace(/^\//, '').replace(/\?.*$/, '')));
        assert.strictEqual(buf.slice(1, 4).toString(), 'PNG', f);
        const w = buf.readUInt32BE(16);
        const h = buf.readUInt32BE(20);
        assert.strictEqual(w, h, f);
        assert.ok(f.includes('-' + w + '.png'), f);
        assert.strictEqual(buf[25], 6, f + ' must be RGBA');
    }
    assert.ok(m[2].includes('128w'));
    assert.ok(m[2].includes('384w'));
});

test('desktop header keeps sound, volume and theme in their own row and docks the bell', () => {
    const start = html.indexOf('<div class="sidebar-header">');
    const block = html.slice(start, html.indexOf('<div class="search-box">', start));
    assert.ok(block.includes('<div class="sb-controls">'));
    assert.ok(block.indexOf('id="audioBtn"') > block.indexOf('sb-controls'));
    assert.ok(block.indexOf('id="themeBtn"') > block.indexOf('sb-controls'));
    assert.ok(block.includes('id="sidebarBellSlot"'));
    assert.ok(html.includes('body.ticker-visible #notifOverlayBtn:not(.bell-docked) { top: 44px !important; }'));
    assert.ok(html.includes('#notifOverlayBtn.bell-docked { position: relative !important;'));
    assert.ok(html.includes('document.getElementById("notifBellPlaceholder")'));
});

test('hero logo omits the referrer so the assets host can serve it on previews', () => {
    const start = html.indexOf('id="homeHero"');
    assert.ok(start > 0);
    const block = html.slice(start, html.indexOf('id="homeGuestActions"', start));
    assert.ok(block.includes('src="https://assets.bitcoineducation.quest/images/btc-grad-logo-sm.jpg"'));
    assert.ok(block.includes('referrerpolicy="no-referrer"'));
    assert.ok(block.includes('alt="Bitcoin Quest"'));
    assert.ok(html.includes('href="https://assets.bitcoineducation.quest/images/btc-grad-logo-sm.jpg" as="image" referrerpolicy="no-referrer"'));
});

test('home title comes before the Experience bar anchor and guest actions', () => {
    const hero = html.indexOf('id="homeHero"');
    const guest = html.indexOf('id="homeGuestActions"');
    const topic = html.indexOf('id="homeTopicCount"');
    const subtitle = html.indexOf('Play, Learn, and Earn real bitcoin!');
    assert.ok(hero > 0);
    assert.ok(guest > hero);
    assert.ok(topic > hero && topic < guest);
    assert.ok(subtitle > hero && subtitle < guest);
    assert.ok(html.includes('<h1 class="home-title">BITCOIN QUEST<span'));
    assert.ok(html.includes('<p class="home-kicker">HOME</p>'));
});

test('legal and schema names stay Bitcoin Education Archive', () => {
    assert.ok(html.includes('"name": "Bitcoin Education Archive"'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
