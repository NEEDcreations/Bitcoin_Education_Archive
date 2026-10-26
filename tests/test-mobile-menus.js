#!/usr/bin/env node
// Mobile Learn and Explore Apps share the catalogs in features.registry.js.
// Desktop #homeLearnMenu and #homeAppsMenu stay the live markup.
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

function plainTitle(text) {
    return text.replace(/^\s*\S+\s+/, '').trim();
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
        'Learning Quests', "Nacho's trails", 'Daily quests', 'Bitcoin Scholar', 'Bitcoin Protocol Expert'
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

test('Explore Apps titles match the desktop grid, plus Wallet', function () {
    const start = html.indexOf('id="homeAppsMenu"');
    const end = html.indexOf('id="continueReading"');
    const menu = html.slice(start, end);
    const desktop = [];
    const re = /class="app-title">([^<]+)</g;
    let match;
    while ((match = re.exec(menu))) desktop.push(plainTitle(match[1]));
    const shared = reg.BQ_EXPLORE_APPS.filter(function (item) { return item.id !== 'wallet'; }).map(function (item) { return item.title; });
    assert.deepStrictEqual(shared, desktop);
    assert.ok(desktop.indexOf('AI Tools') !== -1);
    assert.ok(desktop.indexOf('Metrics') !== -1);
    assert.ok(desktop.indexOf('Leaderboard') !== -1);
    assert.strictEqual(reg.BQ_EXPLORE_APPS[reg.BQ_EXPLORE_APPS.length - 1].id, 'wallet');
    assert.strictEqual(reg.BQ_EXPLORE_APPS[reg.BQ_EXPLORE_APPS.length - 1].wide, true);
});

test('mobile sheets render the shared catalogs and sit above Settings', function () {
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

test('desktop Learn menu is still the flat list', function () {
    const start = html.indexOf('id="homeLearnMenu"');
    const end = html.indexOf('id="homeAppsBtn"');
    const menu = html.slice(start, end);
    assert.ok(menu.includes("go('learning-quests')"));
    assert.ok(menu.includes("go('trails')"));
    assert.ok(menu.includes('Daily Quests'));
    assert.ok(menu.includes('showQuestHub'));
    assert.ok(menu.includes('Meetup Builder'));
    assert.ok(menu.includes('Spend Bitcoin'));
    assert.ok(!menu.includes('Bitcoin Scholar'));
    assert.ok(!menu.includes('Bitcoin Protocol Expert'));
    assert.strictEqual(html, read('404.html'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
