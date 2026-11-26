// First-load CLS: satoshi-favor.js must not prepend the fallback Favor banner
// above #homeHero while the today card's #todayFavorStrip (static markup) is
// waiting for today-card.js to define _paintTodayFavor.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'satoshi-favor.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('✅ ' + name); } catch (e) { failed++; console.log('❌ ' + name + ': ' + e.message); } }
const body = src.slice(src.indexOf('function renderHomeBanner()'), src.indexOf('function renderChatBanner()'));

test('the today card ships #todayFavorStrip in the page markup', () => {
    assert.ok(html.includes('<div id="todayFavorStrip"'));
});
test('renderHomeBanner waits for _paintTodayFavor while the strip exists', () => {
    const wait = body.indexOf("if (strip && typeof window._paintTodayFavor !== 'function' && _favorPaintWaitTries < 50)");
    const prepend = body.indexOf('homeInner.prepend(banner)');
    assert.ok(wait !== -1 && prepend !== -1 && wait < prepend, 'wait branch must come before the fallback prepend');
    assert.ok(/_favorPaintWaitTimer = setTimeout\(function \(\) \{[\s\S]{0,120}renderHomeBanner\(\);[\s\S]{0,20}\}, 200\);/.test(body));
});
test('the fallback banner still exists for a home without the strip', () => {
    assert.ok(body.includes("banner.id = 'satoshiFavorHomeBanner';"));
});
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
