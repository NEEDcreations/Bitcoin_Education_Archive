// GIFs in Global chat and DMs: allowed sources, safe markup, reduced motion,
// file checks, caption checks, DM limits, and the Giphy search mapping.
// Run: node tests/test-chat-gifs.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

function loadGif(reduced) {
    const src = read('utils.js');
    const a = src.indexOf('// BQ_GIF_START'), b = src.indexOf('// BQ_GIF_END');
    assert.ok(a > 0 && b > a, 'gif block markers');
    const win = { matchMedia: () => ({ matches: !!reduced }) };
    vm.runInNewContext(src.slice(a, b), { window: win });
    return win.bqGif;
}
const G = loadGif(false);
const STORAGE = 'https://firebasestorage.googleapis.com/v0/b/bitcoin-education-archive.firebasestorage.app/o/chat-images%2Fu1%2F1731_abc.gif?alt=media&token=1a2b-3c';
const GIPHY = 'https://media2.giphy.com/media/abc123/giphy-downsized.gif?cid=790b&rid=giphy.gif&ct=g';
const TENOR = 'https://media.tenor.com/abcDEF/tenor.gif';

test('allowed sources: own Storage, Giphy, Tenor', () => {
    [STORAGE, GIPHY, TENOR, 'https://i.giphy.com/abc.gif'].forEach(u => assert.ok(G.hostOk(u), u));
});
test('refused sources', () => {
    ['http://media.giphy.com/x.gif', 'https://evil.example/p.gif', 'https://media.giphy.com.evil.example/x.gif',
     'https://evilgiphy.com/x.gif', 'javascript:alert(1)', 'data:image/gif;base64,R0lG', '', null, 42,
     'https://media.tenor.com/a"onerror="x.gif', 'https://media.tenor.com/' + 'a'.repeat(2100)]
        .forEach(u => assert.strictEqual(G.hostOk(u), false, String(u).slice(0, 60)));
});
test('isGifUrl: Storage .gif and CDN GIFs yes, Storage png no', () => {
    assert.ok(G.isGifUrl(STORAGE));
    assert.ok(G.isGifUrl(GIPHY));
    assert.ok(G.isGifUrl(TENOR));
    assert.strictEqual(G.isGifUrl(STORAGE.replace('.gif', '.png')), false);
});
test('html: lazy, no referrer, pause button, escaped', () => {
    const h = G.html(GIPHY, { reducedMotion: false });
    assert.ok(/loading="lazy"/.test(h));
    assert.ok(/referrerpolicy="no-referrer"/.test(h));
    assert.ok(/bqGifToggle\(this\)/.test(h));
    assert.ok(h.indexOf('&amp;rid=') > 0, 'ampersands escaped');
    assert.strictEqual(G.html('https://evil.example/p.gif'), '');
});
test('html: reduced motion waits for a tap', () => {
    const R = loadGif(true);
    const h = R.html(GIPHY);
    assert.ok(/data-gif-src=/.test(h));
    assert.ok(!/<img/.test(h), 'no img until tap');
    assert.ok(/<img/.test(R.html(GIPHY, { reducedMotion: false })));
});
test('fileCheck: type, size, GIF8 bytes', () => {
    const gif8 = new Uint8Array([0x47, 0x49, 0x46, 0x38]);
    assert.strictEqual(G.fileCheck({ type: 'image/gif', size: 1000 }, gif8), '');
    assert.ok(G.fileCheck({ type: 'image/gif', size: 5 * 1024 * 1024 + 1 }, gif8));
    assert.ok(G.fileCheck({ type: 'image/gif', size: 0 }, gif8));
    assert.ok(G.fileCheck({ type: 'image/png', size: 1000 }, gif8));
    assert.ok(G.fileCheck({ type: 'image/gif', size: 1000 }, new Uint8Array([0x89, 0x50, 0x4e, 0x47])));
    assert.strictEqual(G.MAX_BYTES, 5 * 1024 * 1024);
});

// Global chat
const gc = read('global-chat.js');
test('Global chat allowlist includes Giphy (search picks were refused)', () => {
    const m = gc.match(/var ALLOWED_MEDIA_HOSTS = (\/.*\/i);/);
    assert.ok(m);
    const re = vm.runInNewContext(m[1]);
    assert.ok(re.test(GIPHY) && re.test(TENOR) && re.test(STORAGE));
    assert.ok(!re.test('https://evil.example/x.gif'));
});
test('Global chat GIF render goes through the shared helper', () => {
    assert.ok(/window\.bqGif\.html\(m\.text/.test(gc));
    assert.ok(/GIF hidden \(unsupported source\)/.test(gc));
});
test('Global chat captions get the text-message checks', () => {
    const a = gc.indexOf('function _gcCaptionProblem');
    const b = gc.indexOf('window._gcCaptionProblem', a);
    const ctx = { containsProfanity: (t) => /badword/.test(t), isSpammy: (t) => /(.)\1{9,}/.test(t), window: {} };
    vm.runInNewContext(gc.slice(a, b), ctx);
    const f = ctx._gcCaptionProblem;
    assert.strictEqual(f('gm bitcoiners'), '');
    assert.ok(f('see https://scam.example'));
    assert.ok(f('visit freebtc.xyz'));
    assert.ok(f('badword'));
    assert.ok(f('aaaaaaaaaaaaaa'));
    assert.ok(f('call 603-555-1234'));
    assert.ok(f('me@example.com'));
    assert.ok(/_gcCaptionProblem\(caption\)/.test(gc), 'used in the send path');
});

// DMs
const dm = read('messaging.js');
test('DM GIF and image sends use the DM limits', () => {
    const sendGif = dm.slice(dm.indexOf('window.sendDMGif = function'), dm.indexOf('window.sendDMGif = function') + 1500);
    assert.ok(/_dmMediaGuard\(convo\.recipientUid\)/.test(sendGif));
    assert.ok(/bqGif\.hostOk\(gifUrl\)/.test(sendGif));
    const img = dm.slice(dm.indexOf('window.handleDMImage = function'), dm.indexOf('window.handleDMImage = function') + 3000);
    assert.ok(/_dmMediaGuard\(recipientUid\)/.test(img));
    assert.ok(/bqGif\.fileCheck/.test(img));
});
test('DM guard: block list, new-recipient cap, hourly limit', () => {
    const a = dm.indexOf('function _dmMediaGuard');
    const b = dm.indexOf('\n}\n', a) + 3;
    const toasts = [];
    const ctx = {
        blocked: false, canStart: true, rateOk: true, pushed: 0, logged: 0,
        MSG_CONFIG: { maxMsgsPerHour: 30 },
        showToast: (t) => toasts.push(t),
    };
    ctx.isUserBlocked = () => ctx.blocked;
    ctx._canStartNewConvo = () => ctx.canStart;
    ctx.checkRateLimit = () => ctx.rateOk;
    ctx._msgSentTimestamps = { push: () => ctx.pushed++ };
    ctx._logNewConvo = () => ctx.logged++;
    vm.runInNewContext(dm.slice(a, b), ctx);
    assert.strictEqual(ctx._dmMediaGuard('u2'), true);
    assert.strictEqual(ctx.pushed, 1); assert.strictEqual(ctx.logged, 1);
    ctx.blocked = true; assert.strictEqual(ctx._dmMediaGuard('u2'), false); ctx.blocked = false;
    ctx.canStart = false; assert.strictEqual(ctx._dmMediaGuard('u2'), false); ctx.canStart = true;
    ctx.rateOk = false; assert.strictEqual(ctx._dmMediaGuard('u2'), false);
    assert.strictEqual(ctx.pushed, 1, 'refused sends are not counted');
});
test('DM GIF render uses the shared helper', () => {
    assert.ok(/window\.bqGif\.html\(m\.imageUrl/.test(dm));
});

// Functions: Giphy mapping
const gs = require(path.join(root, 'functions', 'src', 'gifSearch.js'));
test('Giphy mapping prefers downsized and drops other hosts', () => {
    const out = gs.mapGiphyResults({ data: [
        { images: {
            fixed_height_small: { url: 'https://media1.giphy.com/media/a/100.gif' },
            downsized: { url: 'https://media1.giphy.com/media/a/giphy-downsized.gif', size: '900000' },
            original: { url: 'https://media1.giphy.com/media/a/giphy.gif', size: '12000000' } } },
        { images: { fixed_height_small: { url: 'https://evil.example/x.gif' } } },
        { images: {
            fixed_height_small: { url: 'https://media3.giphy.com/media/b/100.gif' },
            downsized: { url: 'https://media3.giphy.com/media/b/d.gif', size: '9000000' },
            original: { url: 'https://media3.giphy.com/media/b/o.gif', size: '9000000' } } },
        null,
    ] });
    assert.strictEqual(out.length, 2);
    assert.strictEqual(out[0].full, 'https://media1.giphy.com/media/a/giphy-downsized.gif');
    assert.strictEqual(out[1].full, 'https://media3.giphy.com/media/b/100.gif', 'oversize renditions fall back to the thumb');
    assert.deepStrictEqual(gs.mapGiphyResults({}), []);
    assert.deepStrictEqual(gs.mapGiphyResults(null), []);
});
test('Giphy rating is pg and searchGifs uses it', () => {
    assert.strictEqual(gs.GIPHY_RATING, 'pg');
    const idx = read('functions/index.js');
    const fn = idx.slice(idx.indexOf('exports.searchGifs'), idx.indexOf('exports.searchGifs') + 2500);
    assert.ok(/'&rating=' \+ gifSearch\.GIPHY_RATING/.test(fn));
    assert.ok(!/rating=pg-13/.test(fn));
});
test('query and limit are clamped', () => {
    assert.strictEqual(gs.clampQuery('  hi\u0000there  '), 'hi there');
    assert.strictEqual(gs.clampQuery('x'.repeat(300)).length, 100);
    assert.strictEqual(gs.clampLimit(999), 50);
    assert.strictEqual(gs.clampLimit(-3), 1);
    assert.strictEqual(gs.clampLimit('abc'), 20);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
