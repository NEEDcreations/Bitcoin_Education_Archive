// Flex day goal: 5 server-counted completions, or the catalog size when smaller.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const awardActions = require('../functions/src/awardActions');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

test('goal is 5, or the catalog size when that is smaller', function () {
    assert.strictEqual(awardActions.FLEX_DAY_GOAL, 5);
    assert.ok(awardActions.FLEX_IDS.length > 5);
    assert.strictEqual(awardActions.flexDayGoal(), 5);
    assert.strictEqual(awardActions.flexDayGoal(30), 5);
    assert.strictEqual(awardActions.flexDayGoal(3), 3);
    assert.strictEqual(awardActions.flexDayGoal(0), 0);
    assert.strictEqual(awardActions.flexDayStatus(4).complete, false);
    assert.strictEqual(awardActions.flexDayStatus(5).complete, true);
    assert.strictEqual(awardActions.flexDayStatus(9).complete, true);
    assert.strictEqual(awardActions.flexDayStatus(2, 3).complete, false);
    assert.strictEqual(awardActions.flexDayStatus(3, 3).complete, true);
    assert.strictEqual(awardActions.flexDayStatus(0, 0).complete, false);
});

test('a full day increments flexFullDays once per offset day', function () {
    const first = awardActions.nextFlexFullDays({ flexFullDays: 2 }, '2026-10-23', 5);
    assert.strictEqual(first.incremented, true);
    assert.strictEqual(first.complete, true);
    assert.strictEqual(first.flexFullDays, 3);
    assert.strictEqual(first.flexFullDay, '2026-10-23');
    const again = awardActions.nextFlexFullDays({ flexFullDays: 3, flexFullDay: '2026-10-23' }, '2026-10-23', 8);
    assert.strictEqual(again.incremented, false);
    assert.strictEqual(again.complete, true);
    assert.strictEqual(again.flexFullDays, 3);
    const short = awardActions.nextFlexFullDays({}, '2026-10-23', 4);
    assert.strictEqual(short.incremented, false);
    assert.strictEqual(short.complete, false);
    assert.strictEqual(short.flexFullDays, 0);
});

test('flex_all badges require that many full days, and the day bonus is 50 XP once', function () {
    assert.strictEqual(awardActions.flexAllBadgeMet('flex_all_1', 0), false);
    assert.strictEqual(awardActions.flexAllBadgeMet('flex_all_1', 1), true);
    assert.strictEqual(awardActions.flexAllBadgeMet('flex_all_5', 4), false);
    assert.strictEqual(awardActions.flexAllBadgeMet('flex_all_5', 5), true);
    assert.strictEqual(awardActions.flexAllBadgeMet('flex_all_500', 499), false);
    assert.strictEqual(awardActions.flexAllBadgeMet('flex_rookie', 100), null);
    const day = awardActions.resolveAction({ actionKey: 'flex_day_complete', pts: 50, action: 'flex day' });
    assert.strictEqual(day.ok, true);
    assert.strictEqual(day.xp, 50);
    assert.strictEqual(day.dailyLimit, 1);
    assert.strictEqual(day.dedupGroup, 'flex_day');
    assert.strictEqual(day.requiresDoubleXp, false);
    assert.strictEqual(awardActions.resolveAction({ actionKey: 'flex_day_complete', pts: 100, action: 'flex day' }).ok, false);
    assert.strictEqual(awardActions.resolveAction({ actionKey: 'flex_day_complete', pts: 5, action: 'flex day' }).ok, false);
    const action = awardActions.resolveAction({ actionKey: 'flex_action', flexActionId: 'steak', pts: 5, action: 'flex' });
    assert.strictEqual(action.xp, 5);
    assert.strictEqual(action.dedupGroup, 'flex');
});

test('awardPoints uses the same goal for the counter, the day bonus, and flex_all badges', function () {
    const src = read('functions/index.js');
    const start = src.indexOf('exports.awardPoints = functionsV1.https.onCall');
    const end = src.indexOf('exports.getFaucetStats = functionsV1.https.onCall');
    const body = src.slice(start, end);
    assert.ok(body.indexOf('nextFlexFullDays') > 0);
    assert.ok(body.indexOf('flexFullDays') > 0);
    assert.ok(body.indexOf('flexFullDay') > 0);
    assert.ok(body.indexOf('FLEX_DAY_NOT_MET') > 0);
    assert.ok(body.indexOf('flexAllBadgeMet') > 0);
    assert.ok(body.indexOf("offsetToday + '_flex'") > 0);
    assert.ok(body.indexOf('flexDayComplete') > 0);
    assert.ok(body.indexOf('.includes(') === -1);
    const rules = read('firestore.rules');
    const denyAt = rules.indexOf("'ln_reset_used'");
    const flexAt = rules.indexOf("'flexFullDays', 'flexFullDay'");
    assert.ok(denyAt > 0 && flexAt > denyAt);
});

test('the Today tile reads the server count and shows n/5', function () {
    const card = read('today-card.js');
    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    assert.ok(card.indexOf('btc_flex_state') === -1);
    assert.ok(card.indexOf('daily_action_counts') > 0);
    assert.ok(card.indexOf("day + '_flex'") > 0);
    assert.ok(card.indexOf('onSnapshot') > 0);
    assert.ok(card.indexOf('window._noteTodayFlexCount') > 0);
    assert.ok(card.indexOf("label.textContent = 'Flex'") > 0);
    assert.ok(card.indexOf('shown + \'/\' + goal') > 0);
    assert.ok(card.indexOf('5 * 3600000') > 0 || card.indexOf('getDailyKey') > 0);
    assert.ok(html.indexOf('id="todayFlexLabel"') > 0);
    assert.ok(html.indexOf('>Flex</span>') > 0);
    assert.ok(html.indexOf('id="todayFlexSub"') > 0);
    assert.ok(html.indexOf('>0/5</span>') > 0);
    assert.ok(html.indexOf('today-card.js?v=20261026_v2405') > 0);
    assert.ok(html.indexOf('today-card.js?v=20261026_v2375') === -1);
    assert.ok(html.indexOf('today-card.js?v=20261026_v2365') === -1);
    assert.ok(html.indexOf('today-card.js?v=20261024_v2368') === -1);
    assert.ok(html.indexOf('today-card.js?v=20261024_v2351') === -1);
    assert.ok(html.indexOf('today-card.js?v=20261023_v2349') === -1);
    assert.ok(card.indexOf("meter.setAttribute('aria-label', label)") > 0);
    assert.ok(card.indexOf("used.toLocaleString() + '/1000 XP today'") > 0);
    assert.ok(card.indexOf('Full rate to 500 XP, half rate to 900, quarter rate to 1,000 cap') > 0);
    assert.ok(html.indexOf('today-card.js?v=20261023_v2330') === -1);
    const quests = read('quests.js');
    assert.ok(quests.indexOf("actionKey: 'flex_day_complete'") > 0);
    assert.ok(quests.indexOf('data.flexFullDays') > 0);
    assert.ok(quests.indexOf('__flex_all_done__') === -1);
    assert.ok(quests.indexOf('FLEX_ACTIONS.every') === -1);
    assert.ok(quests.indexOf('_flexDayGoal') > 0);
    assert.ok(quests.indexOf('5 * 3600000') > 0);
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261026_v2372/g) || []).length, 4);
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261024_v2358/g) || []).length, 0);
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261024_v2352/g) || []).length, 0);
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261024_v2351/g) || []).length, 0);
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261024_v2350/g) || []).length, 0);
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261023_v2342/g) || []).length, 0);
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261023_v2341/g) || []).length, 0);
    assert.ok(!html.includes('quests.js?v=20261023_v2334'));
    assert.strictEqual((html.match(/(^|[^a-z-])quests\.js\?v=20261023_v2333/g) || []).length, 0);
});

test('Say hi stays labeled Say hi, and an active Favor banner can pulse', function () {
    const html = read('index.html');
    const card = read('today-card.js');
    const chat = read('global-chat.js');
    assert.ok(html.indexOf('id="sayHiBtnLabel">Say hi!</span>') > 0);
    assert.ok(html.indexOf('Said hi') === -1);
    assert.ok(card.indexOf("sayHiLabel.textContent = 'Say hi!'") > 0);
    const userExpr = "(typeof currentUser !== 'undefined' && currentUser) || window.currentUser";
    assert.strictEqual((card.split(userExpr).length - 1), 2);
    assert.ok(chat.indexOf("label.textContent = 'Say hi!'") > 0);
    assert.ok(chat.indexOf('Said hi') === -1);
    assert.ok(html.indexOf('todayFavorPulse 2s') > 0);
    assert.ok(html.indexOf('todayFavorShimmer 2s') > 0);
    assert.ok(html.indexOf('todayEarnPulse 2s') > 0);
    assert.ok(html.indexOf('prefers-reduced-motion: reduce') > 0);
    assert.ok(html.indexOf('#todayFavorStrip.is-favor-active, #todayFavorStrip.is-favor-active::after, #todayEarnFavor.is-favor-active { animation: none;') > 0);
    assert.ok(card.indexOf("Satoshi's Favor is LIVE") > 0);
    const notes = read('patch-notes.html');
    assert.ok(notes.indexOf('Flex counts as done after 5 in a day.') > 0);
    assert.ok(notes.indexOf('Say hi!') > 0);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
