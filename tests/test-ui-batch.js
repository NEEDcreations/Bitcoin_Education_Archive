// UI batch: exclusive 2FA prompt, Honey Badgers contrast, More Quests height, no admin backfill button.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ok  ' + name); passed++; }
    catch (e) { console.log('  FAIL ' + name + ': ' + (e && e.message ? e.message : e)); failed++; }
}

function lin(c) {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function lum(hex) {
    hex = String(hex).replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a, b) {
    const L1 = lum(a);
    const L2 = lum(b);
    const hi = Math.max(L1, L2);
    const lo = Math.min(L1, L2);
    return (hi + 0.05) / (lo + 0.05);
}

test('admin historical backfill button and handler are gone from quests.js', function () {
    const quests = read('quests.js');
    assert.ok(!quests.includes('window._runFactionBackfill'));
    assert.ok(!quests.includes('_runFactionBackfill'));
    assert.ok(!quests.includes('Backfill historical data'));
    assert.ok(!quests.includes('sfAdminBackfill'));
    assert.ok(read('functions/src/satoshiFavor.js').includes('exports.backfillFactionTotals'));
});

test('Honey Badgers donation labels use #faf5ff on #4c1d95 (at least 4.5:1)', function () {
    const quests = read('quests.js');
    assert.ok(quests.includes('background:#4c1d95;color:#faf5ff;">🦡 Honey Badgers</span>'));
    assert.ok(quests.includes("background:#4c1d95;color:#faf5ff;") && quests.includes("' + badgers.toLocaleString() + ' XP</span>"));
    assert.ok(!quests.includes('color:#1a1a1a;font-weight:700;text-shadow:'));
    const ratio = contrast('faf5ff', '4c1d95');
    assert.ok(ratio >= 4.5, 'contrast ' + ratio.toFixed(2) + ' is under 4.5:1');
});

test('More Quests toggle is a 44px high-contrast secondary button in both themes', function () {
    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    assert.ok(html.includes('#todayMoreToggle { width: 100%;') && html.includes('min-height: 44px;'));
    assert.ok(html.includes('#todayFoldLine #todayMoreToggle { width:auto; margin:0; min-height:44px; padding:10px 14px; background:#111827 !important; border:1px solid #475569;'));
    assert.ok(html.includes('[data-theme="light"] #todayFoldLine #todayMoreToggle { background-color:#f8fafc !important; color:#0f172a; border-color:#64748b; }'));
    assert.ok(!html.includes('background:none !important; border:none; color:#94a3b8'));
    assert.ok(!html.includes('#todayFoldLine #todayMoreToggle { width:auto; margin:0; padding:4px 2px;'));
    const dark = contrast('f8fafc', '111827');
    const light = contrast('0f172a', 'f8fafc');
    assert.ok(dark >= 4.5, 'dark More Quests contrast ' + dark.toFixed(2));
    assert.ok(light >= 4.5, 'light More Quests contrast ' + light.toFixed(2));
});

test('service worker cache pin is v2622', function () {
    const sw = read('sw.js');
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2622'"));
    assert.ok(!sw.includes("const CACHE_NAME = 'btc-archive-v2615'"));
    assert.ok(!sw.includes("const CACHE_NAME = 'btc-archive-v2605'"));
});

test('home mobile padding clears the floating stack and stacks scroll arrows', function () {
    const html = read('index.html');
    assert.ok(html.includes('.home-page { padding:12px 12px calc(var(--above-fab) + 44px + var(--fab-gap)); }'));
    assert.ok(!html.includes('.home-page { padding:12px 12px calc(72px + env(safe-area-inset-bottom, 0px)); }'));
    assert.ok(html.includes('padding-bottom: calc(var(--above-fab) + 44px + var(--fab-gap)); scroll-padding-bottom: calc(var(--above-fab) + 44px + var(--fab-gap));'));
    assert.ok(html.includes('.back-to-top { bottom: calc(var(--above-fab) + 44px + 8px) !important; right: var(--fab-edge);'));
    assert.ok(html.includes('.scroll-to-bottom { bottom: var(--above-fab) !important; right: var(--fab-edge);'));
    assert.ok(!html.includes('.scroll-to-bottom { bottom: var(--above-fab) !important; right: calc(var(--fab-edge) + 44px + 8px);'));
});

test('Nacho mobile sheet is capped at 35vh with a 44px high-contrast close', function () {
    const src = read('nacho.js');
    assert.ok(src.includes('class="nacho-x" aria-label="Close"'));
    assert.ok(src.includes('<button type="button" class="nacho-x"'));
    assert.ok(!src.includes('<span class="nacho-x"'));
    assert.ok(src.includes('width: 44px;') && src.includes('min-height: 44px;') && src.includes('color: #f8fafc;'));
    assert.ok(src.includes('[data-theme="light"] .nacho-x {') && src.includes('color: #0f172a;'));
    assert.ok(!src.includes('opacity: 0.4;'));
    assert.strictEqual((src.match(/max-height: 35vh;/g) || []).length, 2);
    assert.ok(!src.includes('max-height: 45vh;') || src.indexOf('max-height: 45vh;') < src.indexOf('@media (max-width: 900px)'));
    const dark = contrast('f8fafc', '111827');
    const light = contrast('0f172a', 'f8fafc');
    assert.ok(dark >= 4.5, 'dark Nacho close contrast ' + dark.toFixed(2));
    assert.ok(light >= 4.5, 'light Nacho close contrast ' + light.toFixed(2));
});

if (failed) {
    console.log(failed + ' failed, ' + passed + ' passed');
    process.exit(1);
}
console.log(passed + ' passed');
