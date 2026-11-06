// Tapping the pinned banner must land on the pinned message itself.
// Reply quotes used to carry the same data-msg-id, so the scroll could hit a
// quote, and older pinned messages never loaded. (Nov 4, 2026)
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'global-chat.js'), 'utf8');
let passed = 0, failed = 0;
function test(n, f) { try { f(); console.log('✅ ' + n); passed++; } catch (e) { console.log('❌ ' + n + ': ' + e.message); failed++; } }
test('reply quotes use data-reply-to, not data-msg-id', () => {
    assert.ok(src.includes('data-reply-to="\' + esc(_replyId)'));
    assert.ok(!src.includes('data-msg-id="\' + esc(_replyId)'));
    assert.ok(src.includes('_scrollToChatMsg(this.dataset.replyTo)'));
});
test('scroll helper sanitizes the id and offsets the sticky banner', () => {
    assert.ok(src.includes("replace(/[^A-Za-z0-9_-]/g, '')"));
    assert.ok(/pinBanner\.offsetHeight/.test(src));
});
test('older pinned messages page back before giving up', () => {
    assert.ok(/tries < 5/.test(src));
    assert.ok(/return db\.collection\(CHAT_COLLECTION\)\s*\.orderBy\('ts', 'asc'\)\s*\.endBefore\(oldest\.ts\)/.test(src));
});
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
