// Community badge percentages use the Maxi cohort, and collection sections
// render A–Z with Proof of Everything last.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e)); failed++; }
}

function grab(src, name) {
    const token = 'function ' + name;
    const at = src.indexOf(token);
    assert.ok(at !== -1, 'missing ' + name);
    let i = src.indexOf('{', at);
    let depth = 0;
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') {
            depth--;
            if (depth === 0) return src.slice(at, i + 1);
        }
    }
    throw new Error('unclosed ' + name);
}

const badges = read('badges.js');
const sandbox = { window: {}, isFinite: isFinite, Number: Number, String: String, Array: Array };
vm.createContext(sandbox);
vm.runInContext([
    "var PROOF_COLLECTION_ID = 'col_proof_of_everything';",
    grab(badges, '_isProofCollection'),
    grab(badges, '_collectionSortName'),
    grab(badges, '_sortBadgeCollections'),
    grab(badges, '_badgeDistCohort'),
    grab(badges, '_badgeDistCohortArg'),
    grab(badges, '_badgeDistPercent'),
    grab(badges, '_badgeDistFootnote'),
    grab(badges, '_badgeDistRarityOrder'),
    grab(badges, '_badgeDistSortEntries'),
    grab(badges, '_badgeDistGroupEntries'),
].join('\n'), sandbox);

const catalogSandbox = { window: {} };
vm.createContext(catalogSandbox);
vm.runInContext(read('badges.catalog.js'), catalogSandbox);
const defs = catalogSandbox.window.BADGE_COLLECTION_DEFS;

test('collection sections sort A-Z and keep Proof of Everything last', function () {
    const messy = [
        { id: 'col_proof_of_everything', name: 'Proof of Everything' },
        { id: 'z', name: 'zeta' },
        { id: 'a', name: 'Alpha' },
        { id: 'c', name: 'alpha quest' },
        { id: 'b', name: 'Beats & DJ' },
    ];
    assert.strictEqual(sandbox._sortBadgeCollections(messy).map(function (row) { return row.name; }).join('\n'), [
        'Alpha', 'alpha quest', 'Beats & DJ', 'zeta', 'Proof of Everything',
    ].join('\n'));
    const named = sandbox._sortBadgeCollections([
        { id: 'other', name: 'Proof of Everything' },
        { id: 'm', name: 'Mining' },
    ]);
    assert.strictEqual(named[named.length - 1].name, 'Proof of Everything');
    const names = sandbox._sortBadgeCollections(defs).map(function (row) { return String(row.name); });
    assert.strictEqual(names.join('\n'), [
        'Arena',
        'Beats & DJ',
        'BIP Breakthroughs · Season 1',
        'Builder and Market',
        'Chat & Forum',
        'Daily Habits',
        'Foresight and Luck',
        'Fun and Fitness',
        'IRL Meetups',
        'Learning',
        'Lightning and Giving',
        'Mining',
        'Peers & Referrals',
        'Profile and Setup',
        'Timechain TV',
        'Proof of Everything',
    ].join('\n'));
    assert.notStrictEqual(names.join('|'), defs.map(function (row) { return row.name; }).join('|'));
    assert.strictEqual(names[names.length - 1], 'Proof of Everything');
    assert.ok(names.indexOf('Timechain TV') < names.indexOf('Proof of Everything'));
    assert.ok(names.indexOf('Proof of Everything') > names.indexOf('Profile and Setup'));
});

test('build, collection cards, and Your collections all sort at render', function () {
    const build = badges.slice(badges.indexOf('function _buildBadgeCollections'), badges.indexOf('var BADGE_COLLECTIONS'));
    const progress = badges.slice(badges.indexOf('window._badgeCollectionProgress'), badges.indexOf('function _renderBadgeSets'));
    const render = badges.slice(badges.indexOf('function _renderBadgeSets'), badges.indexOf('window._claimSetBonus'));
    assert.ok(build.includes('return _sortBadgeCollections(built);'));
    assert.ok(progress.includes('_sortBadgeCollections(BADGE_COLLECTIONS || [])'));
    assert.ok(render.includes('_sortBadgeCollections((BADGE_COLLECTIONS || []).filter(Boolean))'));
    assert.ok(badges.includes("var PROOF_COLLECTION_ID = 'col_proof_of_everything';"));
});

test('percentages use qualified holders over qualified players', function () {
    const cohort = { qualifiedUsers: 108, qualifiedCounts: { first_channel: 80, quest_1: 150, explorer_all: 3 } };
    const used = sandbox._badgeDistCohort(294, cohort);
    assert.strictEqual(used.useQualified, true);
    assert.strictEqual(used.denom, 108);
    assert.strictEqual(sandbox._badgeDistPercent(80, used.denom), (80 / 108) * 100);
    assert.strictEqual(sandbox._badgeDistPercent(150, used.denom), 100);
    assert.strictEqual(sandbox._badgeDistPercent(3, 108) > sandbox._badgeDistPercent(3, 294), true);
    assert.strictEqual(sandbox._badgeDistPercent(0, 108), 0);
    assert.strictEqual(sandbox._badgeDistPercent(4, 0), 0);

    const missing = sandbox._badgeDistCohort(294, null);
    assert.strictEqual(missing.useQualified, false);
    assert.strictEqual(missing.denom, 294);
    assert.strictEqual(sandbox._badgeDistCohort(294, { qualifiedUsers: 108 }).useQualified, false);
    assert.strictEqual(sandbox._badgeDistCohort(294, { qualifiedCounts: { first_channel: 1 } }).useQualified, false);
    assert.strictEqual(sandbox._badgeDistCohortArg({ qualifiedUsers: null, qualifiedCounts: null }), null);
    assert.deepStrictEqual(sandbox._badgeDistCohortArg(cohort).qualifiedCounts.explorer_all, 3);

    const footnote = sandbox._badgeDistFootnote(294, null, 40, cohort);
    assert.strictEqual(footnote, 'Percentages are among players with 2,140+ XP · 108 players');
    assert.strictEqual(footnote.indexOf('real accounts'), -1);
    assert.strictEqual(footnote.indexOf('active in 30 days'), -1);
    const legacy = sandbox._badgeDistFootnote(294, null, 40, null);
    assert.strictEqual(legacy, '294 real accounts · 40 active in 30 days');
    assert.strictEqual(sandbox._badgeDistFootnote(294, null, 0, null), '294 real accounts');
});

test('the distribution renderer no longer divides by every real account', function () {
    const fn = badges.slice(badges.indexOf('window._renderBadgeDist = function'), badges.indexOf('function _hexToRgb'));
    assert.ok(fn.includes('_badgeDistPercent(holders, share.denom)'));
    assert.ok(fn.includes('share.qualifiedCounts'));
    assert.ok(fn.includes('_badgeDistFootnote'));
    assert.ok(!fn.includes('(e[1] / totalUsers) * 100'));
    assert.ok(fn.includes('holders === 0'));
    const load = badges.slice(badges.indexOf('window._loadBadgeDist = function'), badges.indexOf('window._getBadgeRarity'));
    assert.ok(load.includes('qualifiedUsers'));
    assert.ok(load.includes('qualifiedCounts'));
    assert.ok(load.includes("_badgeDistCohortArg"));
    assert.ok(!badges.includes('members_cyber_hornets'));
    assert.ok(!badges.includes('members_honey_badgers'));
    assert.ok(!badges.includes('factionMembers'));
    const render = badges.slice(badges.indexOf('window._renderBadgeDist = function'), badges.indexOf('function _hexToRgb'));
    assert.ok(render.includes('_badgeDistGroupEntries'));
    assert.ok(render.includes('data-loaded="0"'));
    assert.ok(render.includes('Most widely held among those players first'));
    assert.ok(!render.includes('class="bdr-row"'), 'tiers start collapsed; rows load on expand');
    assert.ok(badges.includes('window._badgeDistFill = function'));
    assert.ok(badges.includes('window._toggleBadgeDistGroup = function'));
    assert.ok(badges.includes('window._badgeDistPageSize = 24'));
});

test('rarity groups put the most widely held badges first', function () {
    assert.strictEqual(sandbox._badgeDistRarityOrder().join(','), 'Common,Rare,Epic,Legendary,Unclaimed');
    const groups = sandbox._badgeDistGroupEntries([
        { id: 'late', name: 'Zebra', pct: 30, rarity: { label: 'Common' } },
        { id: 'early', name: 'Alpha', pct: 80, rarity: { label: 'Common' } },
        { id: 'tie-b', name: 'Beta', pct: 40, rarity: { label: 'Common' } },
        { id: 'tie-a', name: 'Able', pct: 40, rarity: { label: 'Common' } },
        { id: 'rare', name: 'Rare One', pct: 10, rarity: { label: 'Rare' } },
        { id: 'epic', name: 'Epic One', pct: 2, rarity: { label: 'Epic' } },
        { id: 'legend', name: 'Legend One', pct: 0.2, rarity: { label: 'Legendary' } },
        { id: 'none', name: 'Secret', pct: 0, rarity: { label: 'Unclaimed' } },
        { id: 'skip', name: 'Other', pct: 1, rarity: { label: 'Mythic' } },
    ]);
    function ids(list) { return list.map(function (row) { return row.id; }).join(','); }
    assert.strictEqual(ids(groups.Common), 'early,tie-a,tie-b,late');
    assert.strictEqual(ids(groups.Rare), 'rare');
    assert.strictEqual(ids(groups.Epic), 'epic');
    assert.strictEqual(ids(groups.Legendary), 'legend');
    assert.strictEqual(ids(groups.Unclaimed), 'none');
    assert.strictEqual(groups.Mythic, undefined);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
