// GGs badge names are tappable tags. Grouped posts used to skip the old
// "earned a badge:" matcher. Tags come from server badge ids, or from the
// client registry for an older badge-gg post. User chat cannot mint a tag,
// and message text is never turned into HTML.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const badgeGg = require('../functions/src/badgeGg');

const root = path.join(__dirname, '..');
const chat = fs.readFileSync(path.join(root, 'global-chat.js'), 'utf8');
const start = chat.indexOf('/* GG_BADGE_TAGS_START */');
const end = chat.indexOf('/* GG_BADGE_TAGS_END */');
assert.ok(start !== -1 && end > start, 'badge tag block missing');
const api = new Function(chat.slice(start, end) + '\nreturn { ggBadgeSegments: ggBadgeSegments, ggDisplayName: ggDisplayName, ggTrustedBadgeIds: ggTrustedBadgeIds };')();

const registry = [
    { id: 'sf_first_hash', name: 'First Hash', emoji: '⛏️', desc: 'Generated your first hash during Satoshi\'s Favor', how: 'Generated your first hash during Satoshi\'s Favor', pts: 10 },
    { id: 'combo_trio', name: 'Trio Combo', emoji: '🔥', desc: 'Hit a 3-feature combo in one session', how: 'Hit a 3-feature combo in one session', pts: 50 },
    { id: 'sf_10_hashes', name: 'Pickaxe Swinger', emoji: '💥', desc: 'Generated 10 hashes during Satoshi\'s Favor', how: 'Generated 10 hashes during Satoshi\'s Favor', pts: 25 },
    { id: 'first_channel', name: 'First Steps', emoji: '👶', desc: 'Opened your first channel', how: 'Opened your first channel', pts: 10 },
    { id: 'quest_1', name: 'Quester', emoji: '⚔️', desc: 'Completed your first Quest', how: 'Completed your first Quest', pts: 10 },
    { id: 'explorer_50', name: 'Pathfinder', emoji: '🏕️', desc: 'Visited 50 topics', how: 'Visited 50 topics', pts: 50 },
    { id: 'spin_1', name: 'First Spin', emoji: '🎰', desc: 'Spun the wheel for the first time', how: 'Spun the wheel for the first time', pts: 10 },
    { id: 'flex_pattern_25', name: 'Pattern ×25', emoji: '🏅', desc: 'Completed “Pattern” 25 times', how: 'Completed “Pattern” 25 times', pts: 50 },
];

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

function serverPost(text, ids) {
    const message = { uid: 'nacho-bot', postedByUid: 'badge-gg', text: text };
    if (ids) message.badgeIds = ids;
    return message;
}

function badgeNames(segments) {
    return segments.filter(function (seg) { return seg.type === 'badge'; }).map(function (seg) { return seg.name; });
}

test('display names match the server chat line', function () {
    assert.strictEqual(api.ggDisplayName('flex_pattern_25', 'flex_pattern_25'), 'Pattern \u00d725');
    assert.strictEqual(api.ggDisplayName('p01', 'p01'), 'Checkmate Puzzle 1');
    assert.strictEqual(api.ggDisplayName('p80', 'p80'), 'Checkmate Puzzle 80');
    assert.strictEqual(api.ggDisplayName('daily_triple_30', 'Unstoppable'), 'Trifecta Engine');
    assert.strictEqual(api.ggDisplayName('quest_1', 'Quester'), 'Quester');
    assert.strictEqual(api.ggDisplayName('sf_first_hash', 'First Hash'), 'First Hash');
});

test('grouped and single badge names become tags from badge ids', function () {
    const grouped = badgeGg.formatBadgeGg('A player', [
        { badgeId: 'sf_first_hash' },
        { badgeId: 'combo_trio' },
        { badgeId: 'sf_10_hashes' },
    ]);
    assert.strictEqual(grouped, '🏅 A player earned 3 badges: First Hash, Trio Combo, Pickaxe Swinger');
    const groupedSegs = api.ggBadgeSegments(grouped, serverPost(grouped, ['sf_first_hash', 'combo_trio', 'sf_10_hashes']), registry);
    assert.deepStrictEqual(badgeNames(groupedSegs), ['First Hash', 'Trio Combo', 'Pickaxe Swinger']);
    assert.strictEqual(groupedSegs.filter(function (seg) { return seg.type === 'badge'; })[0].desc, 'Generated your first hash during Satoshi\'s Favor');

    const single = badgeGg.formatBadgeGg('A player', [{ badgeId: 'first_channel' }]);
    assert.strictEqual(single, '🏅 A player earned First Steps');
    assert.deepStrictEqual(badgeNames(api.ggBadgeSegments(single, serverPost(single, ['first_channel']), registry)), ['First Steps']);

    const major = badgeGg.formatBadgeGg('Pat', [{ badgeId: 'explorer_50', favorPoint: true }]);
    assert.strictEqual(major, '🏅 @Pat just earned the 🏕️ Pathfinder badge! 🎉 (+1 SF point)');
    assert.deepStrictEqual(badgeNames(api.ggBadgeSegments(major, serverPost(major, ['explorer_50']), registry)), ['Pathfinder']);

    const also = badgeGg.formatBadgeGg('Pat', [
        { badgeId: 'explorer_50' },
        { badgeId: 'quest_1' },
        { badgeId: 'spin_1' },
    ]);
    assert.deepStrictEqual(badgeNames(api.ggBadgeSegments(also, serverPost(also, ['explorer_50', 'quest_1', 'spin_1']), registry)), ['Pathfinder', 'Quester', 'First Spin']);

    const flex = badgeGg.formatBadgeGg('Pat', [{ badgeId: 'flex_pattern_25' }]);
    assert.strictEqual(flex, '🏅 @Pat earned Pattern \u00d725');
    assert.deepStrictEqual(badgeNames(api.ggBadgeSegments(flex, serverPost(flex, ['flex_pattern_25']), registry)), ['Pattern \u00d725']);
});

test('older badge-gg posts match the registry when badge ids are absent', function () {
    const text = '🏅 A player earned 3 badges: First Hash, Trio Combo, Pickaxe Swinger';
    const segs = api.ggBadgeSegments(text, serverPost(text), registry);
    assert.deepStrictEqual(badgeNames(segs), ['First Hash', 'Trio Combo', 'Pickaxe Swinger']);
    const limited = api.ggBadgeSegments(text, serverPost(text, ['sf_first_hash']), registry);
    assert.deepStrictEqual(badgeNames(limited), ['First Hash']);
    assert.deepStrictEqual(badgeNames(api.ggBadgeSegments(text, serverPost(text, []), registry)), []);
    const legacy = '🏅 @Pat earned a badge: ⛏️ First Hash!';
    assert.deepStrictEqual(badgeNames(api.ggBadgeSegments(legacy, serverPost(legacy), registry)), ['First Hash']);
});

test('user-written chat cannot fake a badge tag', function () {
    const text = '🏅 A player earned 3 badges: First Hash, Trio Combo, Pickaxe Swinger <img src=x onerror=alert(1)>';
    const user = { uid: 'evil', postedByUid: 'evil', badgeIds: ['sf_first_hash', 'combo_trio', 'sf_10_hashes'], text: text };
    const segs = api.ggBadgeSegments(text, user, registry);
    assert.strictEqual(segs.length, 1);
    assert.strictEqual(segs[0].type, 'text');
    assert.strictEqual(segs[0].text, text);
    assert.strictEqual(api.ggTrustedBadgeIds(user), null);
    assert.strictEqual(api.ggTrustedBadgeIds({ uid: 'nacho-bot', postedByUid: 'badge-gg', badgeIds: ['<script>', 'quest_1', 12] }).join(','), 'quest_1');
    const chatFn = chat.slice(chat.indexOf('function formatChatText'), chat.indexOf('function handleAutocomplete'));
    assert.ok(!chatFn.includes('gg-badge-tag'));
    assert.ok(!chatFn.includes('ggBadgeSegments'));
});

test('badge text stays text and tooltip fields come from the registry', function () {
    const text = '🏅 <img src=x onerror=alert(1)> earned <b>Quester</b>';
    const segs = api.ggBadgeSegments(text, serverPost(text, ['quest_1']), registry);
    const badge = segs.filter(function (seg) { return seg.type === 'badge'; })[0];
    assert.ok(badge);
    assert.strictEqual(badge.name, 'Quester');
    assert.strictEqual(badge.name.indexOf('<'), -1);
    assert.strictEqual(badge.desc, 'Completed your first Quest');
    assert.deepStrictEqual(segs.map(function (seg) { return seg.type === 'badge' ? 'badge:' + seg.name : 'text:' + seg.text; }), [
        'text:🏅 <img src=x onerror=alert(1)> earned <b>',
        'badge:Quester',
        'text:</b>',
    ]);
    const body = chat.slice(chat.indexOf('function ggAppendBadgeBody'), chat.indexOf('function ggPlaceBadgeTip'));
    assert.ok(body.includes('textContent'));
    assert.ok(!body.includes('innerHTML'));
    assert.ok(!body.includes('insertAdjacentHTML'));
    const tip = chat.slice(chat.indexOf('window._showBadgeTooltip = function'), chat.indexOf('// Safe hash navigation'));
    assert.ok(tip.includes('textContent'));
    assert.ok(tip.includes('How to earn:'));
    assert.ok(tip.includes('z-index:2147483646'));
    assert.ok(!tip.includes('innerHTML'));
    assert.ok(chat.includes("avatar.src = '/nacho-deer.svg'"));
    assert.ok(chat.includes('aria-expanded'));
    assert.ok(chat.includes("e.key !== 'Escape'"));
});

test('server badge ids stay off the client write path and out of the Telegram text', function () {
    const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    const announceAt = index.indexOf('exports.nachoAnnounce');
    const announceEnd = index.indexOf('exports.pvpResolveRound', announceAt);
    const announce = index.slice(announceAt, announceEnd);
    assert.ok(announceAt !== -1 && announceEnd > announceAt);
    assert.ok(announce.includes('postedByUid: uid'));
    assert.ok(!announce.includes('badgeIds'));
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const ann = rules.slice(rules.indexOf('match /announcements/{msgId}'), rules.indexOf('match /global_chat/{msgId}'));
    assert.ok(ann.includes('allow create: if false'));
    assert.ok(ann.includes("hasOnly(['reactions'])"));
    const mirror = fs.readFileSync(path.join(root, 'functions', 'src', 'chatTelegramMirror.js'), 'utf8');
    const visible = mirror.slice(mirror.indexOf('function visibleBody'), mirror.indexOf('function graphemeParts'));
    assert.ok(visible.includes('src.text'));
    assert.ok(!visible.includes('badgeIds'));
    const plain = badgeGg.formatBadgeGg('Pat', [{ badgeId: 'quest_1', favorPoint: true }]);
    assert.strictEqual(plain.indexOf('<'), -1);
    assert.deepStrictEqual(badgeGg.postedBadgeIds([
        { badgeId: 'quest_1' },
        { badgeId: 'quest_1' },
        { badgeId: '<script>' },
        { badgeId: 'spin_1' },
    ]), ['quest_1', 'script', 'spin_1']);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
