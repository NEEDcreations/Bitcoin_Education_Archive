// Leaderboard badge search: ids, punctuation, accents, emoji, and no silent cap.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const BadgeSearch = require('../badge-search.js');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

function row(partial) {
    return Object.assign({ desc: '', emoji: '', category: '', collections: [], xp: 10, earned: false, hidden: false }, partial);
}

const fixtures = [];
for (let i = 1; i <= 10; i++) {
    fixtures.push(row({ id: 'pvp_' + i, name: 'PvP ' + i, desc: 'Win PvP matches', category: 'Fighter', xp: i * 10 }));
}
fixtures.push(row({ id: 'pvp_first', name: 'First Blood', desc: 'Win a PvP match', category: 'Fighter' }));
fixtures.push(row({ id: 'satoshis_cipher', name: "Satoshi's Cipher", emoji: '🔐', xp: 5000 }));
fixtures.push(row({ id: 'cafe_jose', name: 'Café José', desc: 'A cafe badge', emoji: '☕' }));
fixtures.push(row({ id: 'flex_findq_1', name: 'Find Q', desc: 'Flex action', xp: 0, category: 'Flex' }));
fixtures.push(row({ id: 'lq_mining', name: 'Mining Lesson', desc: 'Learning quest', xp: 100, category: 'Learning' }));
for (let s = 1; s <= 12; s++) fixtures.push(row({ id: 'streak_' + s, name: 'Streak ' + s, desc: 'Keep a streak' }));
fixtures.push(row({ id: 'night_secret', name: 'Real Secret Name', hidden: true, earned: false }));
fixtures.push(row({ id: 'night_earned', name: 'Earned Secret', hidden: true, earned: true }));

const index = BadgeSearch.buildIndex(fixtures);

test('pvp is not silently capped at 8', function () {
    const page = BadgeSearch.search(index, 'pvp');
    const all = BadgeSearch.search(index, '  PvP  ', { showAll: true });
    assert.ok(page.total >= 10);
    assert.strictEqual(page.shown.length, 8);
    assert.strictEqual(page.truncated, true);
    assert.strictEqual(all.shown.length, all.total);
});

test('ids, curly apostrophes, accents, and emoji match', function () {
    const byId = BadgeSearch.search(index, 'pvp_5');
    assert.ok(byId.shown.some(function (b) { return b.id === 'pvp_5'; }));
    const curly = BadgeSearch.search(index, 'satoshi\u2019s');
    assert.ok(curly.shown.some(function (b) { return b.id === 'satoshis_cipher'; }));
    assert.ok(BadgeSearch.search(index, 'cafe').shown.some(function (b) { return b.id === 'cafe_jose'; }));
    assert.ok(BadgeSearch.search(index, 'josé').shown.some(function (b) { return b.id === 'cafe_jose'; }));
    assert.ok(BadgeSearch.search(index, '☕').shown.some(function (b) { return b.id === 'cafe_jose'; }));
    assert.strictEqual(BadgeSearch.normalize('Café'), 'cafe');
    assert.strictEqual(BadgeSearch.normalize('pvp_5'), BadgeSearch.normalize('pvp 5'));
});

test('streak is not capped and flex XP is not milestone times two', function () {
    const streak = BadgeSearch.search(index, 'streak', { showAll: true });
    assert.ok(streak.total > 8);
    const flex = BadgeSearch.search(index, 'findq');
    assert.strictEqual(flex.shown[0].xp, 0);
    const lesson = BadgeSearch.search(index, 'lq_mining');
    assert.strictEqual(lesson.shown[0].xp, 100);
});

test('unearned secrets stay out of the results', function () {
    assert.strictEqual(BadgeSearch.search(index, 'Real Secret').total, 0);
    assert.ok(BadgeSearch.search(index, 'Earned Secret').shown.some(function (b) { return b.id === 'night_earned'; }));
});

test('the renderer uses textContent and jump uses CSS.escape', function () {
    const searchSrc = fs.readFileSync(path.join(root, 'badge-search.js'), 'utf8');
    const badges = fs.readFileSync(path.join(root, 'badges.js'), 'utf8');
    assert.ok(searchSrc.includes('textContent'));
    assert.ok(!searchSrc.includes('innerHTML'));
    assert.ok(badges.includes('CSS.escape'));
    const searchField = badges.slice(badges.indexOf('id="badgeSearchInput"'), badges.indexOf('id="badgeSearchResults"'));
    assert.ok(searchField.includes('</div>'), 'the clear control is positioned on the input, not the results');
    assert.ok(badges.includes('This badge is in Collections'));
    const features = fs.readFileSync(path.join(root, 'features.js'), 'utf8');
    assert.strictEqual((features.match(/id: 'explorer_10'/g) || []).length, 0);
    assert.strictEqual((features.match(/id: 'night_owl'/g) || []).length, 0);
    const sets = badges.slice(badges.indexOf('var BADGE_SETS'), badges.indexOf('function _renderBadgeSets'));
    assert.ok(!/\n\s*,\s*\n/.test(sets), 'collections array has holes');
    assert.ok(sets.includes('set_daily_five'));
    assert.ok(sets.includes('set_favor'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
