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
    const oldNacho = { uid: 'pat', postedByUid: 'pat', isNachoAuto: true, text: legacy };
    assert.deepStrictEqual(badgeNames(api.ggBadgeSegments(legacy, oldNacho, registry)), ['First Hash']);
    const groupedSpoof = { uid: 'pat', postedByUid: 'pat', isNachoAuto: true, badgeIds: ['sf_first_hash', 'combo_trio'], text: '🏅 A player earned 3 badges: First Hash, Trio Combo' };
    assert.deepStrictEqual(badgeNames(api.ggBadgeSegments(groupedSpoof.text, groupedSpoof, registry)), []);
    assert.deepStrictEqual(badgeNames(api.ggBadgeSegments(legacy, { uid: 'pat', postedByUid: 'pat', text: legacy }, registry)), []);
    const commaReg = registry.concat([{ id: 'pow_km_1000', name: '1,000 km Titan', emoji: '🏅', desc: 'Walked 1,000 km', how: 'Walked 1,000 km', pts: 10 }]);
    const commaText = '🏅 A player earned 2 badges: 1,000 km Titan, First Hash';
    assert.deepStrictEqual(badgeNames(api.ggBadgeSegments(commaText, serverPost(commaText), commaReg)), ['1,000 km Titan', 'First Hash']);
    assert.deepStrictEqual(badgeNames(api.ggBadgeSegments(commaText, serverPost(commaText, ['pow_km_1000', 'sf_first_hash']), commaReg)), ['1,000 km Titan', 'First Hash']);
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
    assert.ok(body.includes('ggRegistryIndex()'));
    assert.ok(!body.includes('ggCollectRegistry('));
    assert.ok(!body.includes('btn.addEventListener'));
    assert.ok(!body.includes('ggBindBadgeList'));
    assert.ok(!body.includes('innerHTML'));
    assert.ok(!body.includes('insertAdjacentHTML'));
    const segments = chat.slice(start, end);
    assert.ok(segments.includes('function ggBuildNameIndex'));
    assert.ok(segments.includes('ggBucketsForIds'));
    assert.ok(!segments.includes('badges.slice().sort'));
    assert.ok(!segments.includes('all.forEach'));
    const handler = chat.slice(chat.indexOf('function ggOnBadgeListEvent'), chat.indexOf('function ggBindBadgeList'));
    assert.ok(handler.includes("e.type === 'click'"));
    assert.ok(handler.includes("e.type === 'focusin'"));
    assert.ok(handler.includes("e.type === 'focusout'"));
    assert.ok(handler.includes("e.type === 'mouseover'"));
    assert.ok(handler.includes("e.type === 'mouseout'"));
    const place = chat.slice(chat.indexOf('function ggPlaceBadgeTip'), chat.indexOf('window._showBadgeTooltip = function'));
    assert.ok(place.includes('var gap = 8'));
    assert.ok(place.includes('rect.top - height - gap'));
    assert.ok(place.includes('rect.bottom + gap'));
    assert.ok(!place.includes('+ 2'));
    assert.ok(!place.includes('- 2'));
    const panel = chat.slice(chat.indexOf('function renderAnnouncementsTab'), chat.indexOf('function renderDMsTab'));
    assert.ok(panel.includes('ggCloseBadgeTip()'));
    assert.ok(panel.includes('ggBindBadgeList(el)'));
    const overlay = chat.slice(chat.indexOf("if (_overlayTab === 'announcements')"), chat.indexOf("if (_overlayTab === 'dms')"));
    assert.ok(overlay.includes('ggCloseBadgeTip()'));
    assert.ok(overlay.includes('ggBindBadgeList(el)'));
    assert.ok(chat.includes("addEventListener('scroll'"));
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

test('badge registry is built once for a stable catalog', function () {
    const end = chat.indexOf('function ggAppendMentionText');
    assert.ok(end > start);
    const run = new Function('BADGE_DEFS', chat.slice(start, end) + '\n' + [
        'var calls = 0;',
        'var real = ggCollectRegistry;',
        'ggCollectRegistry = function () { calls++; return real(); };',
        'var defs = [];',
        'for (var i = 0; i < 40; i++) defs.push({ id: "b" + i, name: "Badge " + i, emoji: "🏅", desc: "how " + i, pts: 1 });',
        'BADGE_DEFS = defs;',
        'ggRegistry();',
        'ggRegistry();',
        'ggRegistry();',
        'if (calls !== 1) throw new Error("registry built " + calls + " times");',
        'return calls;'
    ].join('\n'));
    assert.strictEqual(run(undefined), 1);
});

function median(samples) {
    const sorted = samples.slice().sort(function (a, b) { return a - b; });
    return sorted[Math.floor(sorted.length / 2)];
}

test('50 badge posts render inside the budget and keep 152 tags', function () {
    const win = {};
    new Function('window', fs.readFileSync(path.join(root, 'badges.catalog.js'), 'utf8'))(win);
    assert.ok(Object.keys(win.BADGE_CATALOG).length >= 900);
    const bindAt = chat.indexOf('function ggPlaceBadgeTip');
    assert.ok(bindAt > start);
    function makeEl() {
        return {
            children: [],
            style: {},
            attrs: {},
            listeners: {},
            _ggBadgeBound: false,
            setAttribute: function (key, value) { this.attrs[key] = value; },
            appendChild: function (child) { this.children.push(child); return child; },
            addEventListener: function (type, fn) {
                if (!this.listeners[type]) this.listeners[type] = [];
                this.listeners[type].push(fn);
            }
        };
    }
    const doc = {
        createElement: function () { return makeEl(); },
        createTextNode: function (text) { return { nodeType: 3, textContent: text }; },
        getElementById: function () { return null; },
        addEventListener: function () {}
    };
    const api = new Function('window', 'document', chat.slice(start, bindAt) + '\nreturn { ggBadgeSegments: ggBadgeSegments, ggRegistry: ggRegistry, ggRegistryIndex: ggRegistryIndex, ggAppendBadgeBody: ggAppendBadgeBody, ggBindBadgeList: ggBindBadgeList, ggCatalogCount: ggCatalogCount };')(win, doc);
    const reg = api.ggRegistry();
    const index = api.ggRegistryIndex();
    const names = reg.filter(function (badge) { return badge.name && badge.name.length >= 2; });
    assert.ok(names.length >= 900);
    const batches = [];
    for (let i = 0; i < 50; i++) {
        const count = i >= 48 ? 4 : 3;
        const batch = [];
        for (let k = 0; k < count; k++) batch.push(names[(i * 3 + k) % names.length]);
        batches.push(batch);
    }
    function line(batch) {
        return '🏅 A player earned ' + batch.length + ' badges: ' + batch.map(function (badge) { return badge.name; }).join(', ');
    }
    const oldPosts = batches.map(function (batch) {
        const text = line(batch);
        return { uid: 'nacho-bot', postedByUid: 'badge-gg', text: text };
    });
    const idPosts = batches.map(function (batch) {
        const text = line(batch);
        return { uid: 'nacho-bot', postedByUid: 'badge-gg', text: text, badgeIds: batch.map(function (badge) { return badge.id; }) };
    });
    function tagIds(message) {
        return api.ggBadgeSegments(message.text, message, index).filter(function (seg) { return seg.type === 'badge'; }).map(function (seg) { return seg.id; });
    }
    const oldIds = oldPosts.map(tagIds);
    const idIds = idPosts.map(tagIds);
    const oldCount = oldIds.reduce(function (sum, ids) { return sum + ids.length; }, 0);
    const idCount = idIds.reduce(function (sum, ids) { return sum + ids.length; }, 0);
    assert.strictEqual(oldCount, 152);
    assert.strictEqual(idCount, 152);
    oldIds.forEach(function (ids, i) {
        assert.deepStrictEqual(ids, idIds[i]);
        assert.deepStrictEqual(ids, batches[i].map(function (badge) { return badge.id; }));
    });
    const keys = Object.keys;
    let keyCalls = 0;
    Object.keys = function (value) {
        keyCalls++;
        return keys.apply(Object, arguments);
    };
    try {
        api.ggRegistry();
        const afterWarm = keyCalls;
        for (let i = 0; i < 50; i++) api.ggRegistry();
        assert.strictEqual(keyCalls, afterWarm);
    } finally {
        Object.keys = keys;
    }
    function render(posts) {
        const list = doc.createElement('div');
        posts.forEach(function (message) {
            const post = doc.createElement('div');
            api.ggAppendBadgeBody(post, message);
            assert.strictEqual(post.listeners.click, undefined);
            list.appendChild(post);
        });
        api.ggBindBadgeList(list);
        api.ggBindBadgeList(list);
        assert.strictEqual(list.listeners.click.length, 1);
        assert.strictEqual(list.listeners.focusin.length, 1);
        assert.strictEqual(list.listeners.focusout.length, 1);
        assert.strictEqual(list.listeners.mouseover.length, 1);
        assert.strictEqual(list.listeners.mouseout.length, 1);
        let buttons = 0;
        list.children.forEach(function (post) {
            post.children.forEach(function (node) {
                if (node.attrs && node.attrs['data-badge-id']) buttons++;
            });
        });
        assert.strictEqual(buttons, 152);
        return list;
    }
    render(oldPosts);
    function time(posts) {
        const samples = [];
        for (let i = 0; i < 5; i++) {
            const t0 = process.hrtime.bigint();
            render(posts);
            samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
        }
        return median(samples);
    }
    const oldMs = time(oldPosts);
    const idMs = time(idPosts);
    console.log('50-post render ms  old-format=' + oldMs.toFixed(2) + '  id-format=' + idMs.toFixed(2));
    assert.ok(oldMs < 6, 'old-format render ' + oldMs.toFixed(2) + ' ms');
    assert.ok(idMs < 6, 'id-format render ' + idMs.toFixed(2) + ' ms');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
