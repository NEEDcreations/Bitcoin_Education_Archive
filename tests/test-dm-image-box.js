// DM photos and GIFs render in a fixed box so the thread does not jump when
// the image loads. Before this, each image grew from 0 to full height and the
// DM conversation scored a layout shift of about 0.14 on a phone. (Nov 26, 2026)
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'messaging.js'), 'utf8');
const bundle = fs.readFileSync(path.join(root, 'bundle.src.js'), 'utf8');
const min = fs.readFileSync(path.join(root, 'bundle.min.js'), 'utf8');
let passed = 0, failed = 0;
function test(n, f) { try { f(); console.log('✅ ' + n); passed++; } catch (e) { console.log('❌ ' + n + ': ' + e.message); failed++; } }

function boxStyle(text) {
    const m = text.match(/var DM_IMG_BOX = '([^']+)';/);
    assert.ok(m, 'DM_IMG_BOX is defined');
    return m[1];
}

test('the DM image box reserves width and height before load', () => {
    const css = boxStyle(src);
    assert.ok(/(^|;)width:240px;/.test(css), 'fixed width');
    assert.ok(/max-width:100%;/.test(css), 'still fits a narrow bubble');
    assert.ok(/aspect-ratio:6\/5;/.test(css), 'aspect-ratio without auto keeps the box after load');
    assert.ok(!/aspect-ratio:auto/.test(css));
    assert.ok(/object-fit:contain;/.test(css), 'whole image stays visible');
    assert.ok(/display:block;/.test(css));
});

test('received DM images and the optimistic GIF use the box', () => {
    assert.ok(src.includes('imgHtml = \'<img data-dm-img="1" src="\' + sanitizeUrl(m.imageUrl) + \'" style="\' + DM_IMG_BOX + \'margin:'));
    assert.ok(src.includes('\'<img data-dm-img="1" src="\' + escapeHtml(sanitizeUrl(gifUrl)) + \'" style="\' + DM_IMG_BOX + \'" loading="lazy">\''));
    assert.strictEqual((src.match(/data-dm-img="1"/g) || []).length, 2);
    assert.ok(!src.includes('style="max-width:100%;max-height:250px;border-radius:8px;margin:'), 'old unsized DM image is gone');
});

test('the box is defined before loadDMMessages uses it', () => {
    assert.ok(src.indexOf('var DM_IMG_BOX') < src.indexOf('function loadDMMessages('));
});

test('bundle is rebuilt with the same box', () => {
    assert.strictEqual(boxStyle(bundle), boxStyle(src));
    assert.strictEqual((bundle.match(/data-dm-img="1"/g) || []).length, 2);
    assert.ok(min.includes('DM_IMG_BOX'), 'bundle.min.js carries the change');
    assert.ok(min.includes('aspect-ratio:6/5'));
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
