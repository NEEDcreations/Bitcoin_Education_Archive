// Nov 4 batch: badge tier ladder mirror, custom emoji renderer, tip lookup,
// SF remaining copy, heat meter repaint, chat/⋯ buttons stay visible.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const tiers = require('../functions/src/badgeTiers');
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log('✅ ' + name); passed++; } catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; } }

function sliceBetween(src, a, b) { const i = src.indexOf(a); const j = src.indexOf(b, i + a.length); return src.slice(i, j); }

test('client tier ladder mirrors server ACTIVE families and tickets', () => {
    const badges = read('badges.js');
    const block = sliceBetween(badges, 'var BADGE_TIER_TICKETS', 'window.BADGE_TIER_FAMILIES');
    const ctx = {}; vm.runInNewContext(block, ctx);
    assert.strictEqual(Object.keys(ctx.BADGE_TIER_FAMILIES).sort().join(), Object.keys(tiers.ACTIVE).sort().join());
    Object.keys(tiers.ACTIVE).forEach((f) => {
        assert.strictEqual(JSON.stringify(ctx.BADGE_TIER_FAMILIES[f].tiers), JSON.stringify(tiers.ACTIVE[f].tiers));
        assert.strictEqual(ctx.BADGE_TIER_FAMILIES[f].field, tiers.ACTIVE[f].field);
        assert.strictEqual(ctx.BADGE_TIER_FAMILIES[f].unit || 1, tiers.ACTIVE[f].unit || 1);
    });
    assert.strictEqual(JSON.stringify(ctx.BADGE_TIER_TICKETS), JSON.stringify(tiers.TIER_TICKETS));
});

test('custom emoji renderer only swaps allowlisted shortcodes in text, never attributes', () => {
    const chat = read('global-chat.js');
    const block = sliceBetween(chat, 'var CUSTOM_EMOJIS', 'window.CUSTOM_EMOJIS');
    const ctx = {}; vm.runInNewContext(block, ctx);
    const out = ctx.renderCustomEmojis('gm :btc: <a href="x:btc:y" title=":btc:">:btc:</a> :nope: :BTC:');
    assert.strictEqual((out.match(/<img class="bq-cemoji"/g) || []).length, 2);
    assert.ok(out.indexOf('href="x:btc:y"') !== -1 && out.indexOf('title=":btc:"') !== -1);
    assert.ok(out.indexOf(':nope:') !== -1 && out.indexOf(':BTC:') !== -1);
    assert.ok(/src="\/assets\/emoji\/btc\.svg"/.test(out));
    assert.ok(chat.indexOf('return renderCustomEmojis(text);') !== -1);
    assert.ok(fs.existsSync(path.join(root, 'assets/emoji/btc.svg')));
    assert.ok(!/<script|on\w+=/i.test(read('assets/emoji/btc.svg')));
});

test('reaction picker keeps unicode-only categories', () => {
    const chat = read('global-chat.js');
    const react = sliceBetween(chat, '// ---- Emoji Reaction System ----', 'window.toggleReaction');
    assert.ok(react.indexOf('EMOJI_INPUT_CATEGORIES') === -1);
});

test('tip fallback reads public_profiles, not the owner-only users doc', () => {
    const src = read('lightning-tips.js.src');
    const block = sliceBetween(src, 'If no Lightning Address provided', 'If recipient has a Lightning Address');
    assert.ok(block.indexOf("collection('public_profiles')") !== -1);
    assert.ok(block.indexOf("collection('users')") === -1);
});

test('SF strip shows points remaining and has an info tooltip', () => {
    const tc = read('today-card.js');
    assert.ok(tc.indexOf('remaining to activate!') !== -1);
    ['index.html', '404.html'].forEach((f) => {
        const h = read(f);
        assert.ok(h.indexOf('id="todayFavorInfo"') !== -1 && h.indexOf('id="todayFavorTip"') !== -1, f);
        assert.ok(/community total/.test(h), f);
    });
});

test('heat meter repaints from the live favor listener', () => {
    const sf = read('satoshi-favor.js');
    const block = sliceBetween(sf, '_sfTotalHashes = (favorState.totalHashes || 0);', 'Cache to localStorage');
    assert.ok(block.indexOf('_repaintHeatMeter()') !== -1);
});

test('chat and ⋯ buttons are not hidden by fab-hold or the chat hub', () => {
    ['index.html', '404.html'].forEach((f) => {
        const h = read(f);
        assert.ok(h.indexOf('body.fab-hold:not(.kb-open) #chatOverlayBtn') !== -1, f);
    });
    const chat = read('global-chat.js');
    const hub = sliceBetween(chat, 'window.renderChatHub = function(tab) {', 'return _origRenderChatHub(tab);');
    assert.ok(hub.indexOf("btn.style.display = 'none'") === -1);
    const tog = sliceBetween(chat, 'window.toggleChatOverlay = function() {', 'tabHtml');
    assert.ok(tog.indexOf("_overlayOpen ? 'none'") === -1);
});

test('share my rank waits for App Check once and retries', () => {
    const r = read('ranking.js');
    const block = sliceBetween(r, 'async function _lbShareLookup', 'function _lbShareFit');
    assert.ok(block.indexOf('_btcAppCheckForClaim(10000)') !== -1);
    assert.strictEqual((block.match(/httpsCallable\('leaderboardRank'\)/g) || []).length, 2);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
