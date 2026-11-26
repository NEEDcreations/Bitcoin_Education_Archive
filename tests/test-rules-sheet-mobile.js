// PlebTalk and LightningMart rules: the Accept button sits in a footer outside the
// scrolling list, and the overlay stacks above the bottom nav and floating pills.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ok  ' + name); passed++; }
    catch (e) { console.log('  FAIL ' + name + ': ' + (e && e.message ? e.message : e)); failed++; }
}
const forum = read('forum.js');
const market = read('marketplace.js');
const css = forum.slice(forum.indexOf('function _bqEnsureRulesSheetCss'), forum.indexOf('window._bqEnsureRulesSheetCss ='));
function body(src, name) { const i = src.indexOf('function ' + name); return src.slice(i, src.indexOf('\n}\n', i)); }

test('shared rules sheet CSS: above nav, dvh height, safe-area footer', () => {
    const z = Number((css.match(/\.bq-rules-overlay\{[^}]*z-index:(\d+)/) || [])[1]);
    assert.ok(z > 200130 && z > 250000, 'z-index above bottom nav, FABs and chat overlay');
    assert.ok(z < 2100008, 'username modal stays on top');
    assert.ok(/\.bq-rules-card\{[^}]*display:flex;flex-direction:column/.test(css));
    assert.ok(css.includes('100dvh'));
    assert.ok(/\.bq-rules-scroll\{[^}]*overflow-y:auto/.test(css));
    assert.ok(/\.bq-rules-footer\{[^}]*env\(safe-area-inset-bottom/.test(css));
    ['#spinReminderFab', '.fab-btn', '#nachoQuestPill', '#nachoHideBtn'].forEach((sel) => assert.ok(css.includes('body:has(.bq-rules-overlay) ' + sel), sel));
});

[['PlebTalk', forum, 'showForumRules', 'acceptForumRules'], ['LightningMart', market, 'showMarketRules', 'acceptMarketRules']].forEach(([name, src, fn, accept]) => {
    test(name + ' rules use the sheet with Accept outside the scroll list', () => {
        const b = body(src, fn);
        assert.ok(b.includes("window._bqEnsureRulesSheetCss()"));
        assert.ok(b.includes('class="bq-rules-overlay"'));
        assert.ok(b.includes('<div class="bq-rules-card"><div class="bq-rules-scroll">'));
        assert.ok(b.includes('</div><div class="bq-rules-footer"><button type="button" class="bq-rules-accept" onclick="' + accept + '()">'));
        assert.ok(!b.includes('z-index:9999'));
        assert.ok(!b.includes('max-height:85vh'));
    });
});

test('bundle carries the rules sheet', () => {
    const bundle = read('bundle.src.js');
    assert.ok(bundle.includes('bqRulesSheetCss'));
    assert.ok(bundle.includes('bq-rules-footer'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
