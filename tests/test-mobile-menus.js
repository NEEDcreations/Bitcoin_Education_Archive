#!/usr/bin/env node
// Mobile Learn and Explore Apps share the catalogs in features.registry.js.
// Desktop and phone Learn / Explore Apps both render BQ_LEARN_MENU and BQ_EXPLORE_APPS.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}
const reg = require(path.join(root, 'features.registry.js'));
const html = read('index.html');
const ux = read('mobile-ux.js');
const app = read('app.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ok  ' + name); passed++; }
    catch (e) { console.log('  FAIL ' + name + ': ' + e.message); failed++; }
}

function ids(list, mode) {
    return (list || []).filter(function (item) {
        return !item.modes || item.modes.indexOf(mode) !== -1;
    }).map(function (item) { return item.id; });
}

test('Learn root order matches the phone menu Phil asked for', function () {
    assert.deepStrictEqual(ids(reg.BQ_LEARN_MENU.root, 'advanced'), [
        'brand-new', 'quests', 'first-purchase', 'meetup', 'spend'
    ]);
    assert.deepStrictEqual(reg.BQ_LEARN_MENU.root.map(function (item) { return item.title; }), [
        'Brand new to Bitcoin', 'Quests', 'First Bitcoin purchase', 'Meetup builder', 'Spend Bitcoin'
    ]);
});

test('Quests hub holds lessons, trails, daily quests, and both certifications', function () {
    assert.deepStrictEqual(ids(reg.BQ_LEARN_MENU.quests, 'advanced'), [
        'learning-quests', 'trails', 'daily-quests', 'scholar', 'protocol'
    ]);
    assert.deepStrictEqual(reg.BQ_LEARN_MENU.quests.map(function (item) { return item.title; }), [
        'Learning Quests', "Nacho's Trails", 'Daily Quests', 'Bitcoin Scholar', 'Bitcoin Protocol Expert'
    ]);
    assert.strictEqual(reg.BQ_LEARN_MENU.quests[3].arg, 'properties');
    assert.strictEqual(reg.BQ_LEARN_MENU.quests[4].arg, 'technical');
});

test('beginner mode hides daily quests, meetup, spend, and the same six apps', function () {
    assert.deepStrictEqual(ids(reg.BQ_LEARN_MENU.root, 'beginner'), ['brand-new', 'quests', 'first-purchase']);
    assert.deepStrictEqual(ids(reg.BQ_LEARN_MENU.quests, 'beginner'), ['learning-quests', 'trails', 'scholar', 'protocol']);
    const hidden = ids(reg.BQ_EXPLORE_APPS, 'beginner');
    ['pop', 'forum', 'market', 'irl', 'beats', 'pow'].forEach(function (id) {
        assert.ok(hidden.indexOf(id) === -1, id);
    });
    ['nacho', 'tv', 'ai', 'metrics', 'lb', 'wallet'].forEach(function (id) {
        assert.ok(hidden.indexOf(id) !== -1, id);
    });
});

test('phone and desktop menus both render the same registry lists', function () {
    assert.ok(ux.includes('window.renderDesktopLearnMenu'));
    assert.ok(ux.includes('window.renderDesktopAppsMenu'));
    assert.ok(ux.includes('window.renderMobileLearnMenu'));
    assert.ok(ux.includes('window.BQ_LEARN_MENU'));
    assert.ok(ux.includes('window.BQ_EXPLORE_APPS'));
    assert.ok(read('features.registry.js').includes('win.renderDesktopHomeMenus'));
    assert.ok(read('ux-patches.js').includes('window.renderDesktopHomeMenus()'));
    const learnStart = html.indexOf('id="homeLearnMenu"');
    const learnEnd = html.indexOf('id="homeAppsBtn"');
    const learn = html.slice(learnStart, learnEnd);
    assert.ok(!learn.includes("go('learning-quests')"));
    assert.ok(!learn.includes('showQuestHub'));
    assert.ok(!learn.includes('Nacho\'s Trails: Guided Learning'));
    const appsStart = html.indexOf('id="homeAppsMenu"');
    const appsEnd = html.indexOf('id="continueReading"');
    const apps = html.slice(appsStart, appsEnd);
    assert.ok(apps.includes('data-apps-grid="1"'));
    assert.ok(!apps.includes('class="app-title"'));
    assert.ok(ux.includes("btn.setAttribute('data-wallet-nav', '1')"));
    assert.ok(ux.includes("e.key !== 'Escape'"));
    assert.ok(ux.includes('desktopModalOpen'));
    const rootIds = reg.BQ_LEARN_MENU.root.map(function (item) { return item.id; });
    const questIds = reg.BQ_LEARN_MENU.quests.map(function (item) { return item.id; });
    assert.deepStrictEqual(rootIds, ['brand-new', 'quests', 'first-purchase', 'meetup', 'spend']);
    assert.deepStrictEqual(questIds, ['learning-quests', 'trails', 'daily-quests', 'scholar', 'protocol']);
    assert.deepStrictEqual(reg.BQ_EXPLORE_APPS.map(function (item) { return item.title; }), [
        'Nacho Mode', 'Proof of Play', 'Pleb Talk', 'Lightning Mart', 'IRL Sync', 'Bitcoin Beats',
        'Timechain TV', 'Proof of Walk', 'AI Tools', 'Metrics', 'Leaderboard', 'Wallet'
    ]);
    assert.strictEqual(html, read('404.html'));
});

test('mobile sheets sit above Settings and skip the old scattered quest buttons', function () {
    assert.ok(ux.includes('window.BQ_LEARN_MENU'));
    assert.ok(ux.includes('window.BQ_EXPLORE_APPS'));
    assert.ok(ux.includes('2100020'));
    assert.ok(ux.includes('2100030'));
    assert.ok(ux.includes('Browse all 145 topics'));
    assert.ok(!ux.includes('Browse All Topics'));
    assert.ok(!ux.includes('146'));
    assert.ok(!ux.includes('_learnBtns'));
    assert.ok(ux.includes('min-height:44px'));
    assert.ok(app.includes('window.openMobileExploreApps'));
    assert.ok(!app.includes('function appBtn'));
    assert.ok(!app.includes('z-index:100001'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
