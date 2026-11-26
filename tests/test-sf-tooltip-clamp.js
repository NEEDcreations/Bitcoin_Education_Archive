// Satoshi's Favor (i) tooltip stays inside the viewport and the chat drawer.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'satoshi-favor.js'), 'utf8');
let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ok  ' + name); passed++; }
    catch (e) { console.log('  FAIL ' + name + ': ' + (e && e.message ? e.message : e)); failed++; }
}
test('bubble CSS is centred and capped to the viewport', () => {
    assert.ok(src.includes('.sf-tip-bubble{display:none;position:absolute;left:50%;right:auto;'));
    assert.ok(src.includes('width:min(260px,calc(100vw - 16px))'));
    assert.ok(!src.includes('.sf-tip-bubble{display:none;position:absolute;right:-8px;'));
});
test('clamp shifts a bubble that would open off the left edge', () => {
    const start = src.indexOf('    function sfTipBounds(el)');
    const end = src.indexOf('    function sfTipFromEvent');
    const style = {};
    let left = -207, width = 260;
    const bubble = { style, getBoundingClientRect: () => ({ left, right: left + width, top: 262, bottom: 370 }) };
    const drawer = { getBoundingClientRect: () => ({ left: 0, right: 400, top: 0, bottom: 800, width: 400, height: 800 }) };
    const wrap = { querySelector: () => bubble, parentElement: drawer, getBoundingClientRect: () => ({ top: 238, bottom: 254 }) };
    drawer.parentElement = null;
    const ctx = { window: { innerWidth: 1280, innerHeight: 800, getComputedStyle: (n) => n === drawer ? { overflowX: 'hidden', overflowY: 'auto' } : { display: 'block', overflowX: 'visible', overflowY: 'visible' } }, document: { body: {}, documentElement: {} }, Math };
    vm.runInNewContext(src.slice(start, end) + ';this.clampSfTip=clampSfTip;', ctx);
    ctx.clampSfTip(wrap);
    assert.strictEqual(style.transform, 'translateX(calc(-50% + 215px))');
    assert.strictEqual(style.top, 'calc(100% + 8px)');
    left = 300;
    ctx.clampSfTip(wrap);
    assert.strictEqual(style.transform, 'translateX(calc(-50% + -168px))');
});
test('index.html and 404.html pin satoshi-favor.js at 20261119_v2682b', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    assert.strictEqual(html, fs.readFileSync(path.join(__dirname, '..', '404.html'), 'utf8'));
    assert.strictEqual((html.match(/satoshi-favor\.js\?v=20261119_v2682b/g) || []).length, 1);
});
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
