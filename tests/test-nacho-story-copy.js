#!/usr/bin/env node
// Nacho's Story: chapter XP copy matches the server (15 + 100 finish bonus),
// the finish UI does not claim stub orange tickets, and the unlock day is ET.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const features = fs.readFileSync(path.join(root, 'features.js'), 'utf8');
const award = fs.readFileSync(path.join(root, 'functions/src/awardActions.js'), 'utf8');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

function storySlice() {
    var start = features.indexOf('window.nachoEtDate = function');
    var end = features.indexOf('window.showPricePrediction = function');
    assert.ok(start !== -1 && end > start, 'story slice markers missing');
    return features.slice(start, end);
}

test('server pays 15 XP per chapter and 100 on finish', function () {
    assert.ok(award.indexOf('id: \'story_chapter\'') !== -1 || award.indexOf('id: "story_chapter"') !== -1);
    assert.ok(/xp:\s*15/.test(award.slice(award.indexOf('story_chapter'), award.indexOf('story_chapter') + 200)));
    var complete = award.indexOf('story_complete');
    assert.ok(complete !== -1);
    assert.ok(/xp:\s*100/.test(award.slice(complete, complete + 200)));
});

test('client chapter copy is 15 XP for every chapter, including chapter 7', function () {
    var slice = storySlice();
    assert.ok(slice.indexOf('var _chPts = 15') !== -1, 'chapter XP should be 15');
    assert.ok(slice.indexOf('? 50 : 15') === -1, 'chapter 7 must not request 50 XP');
    assert.ok(slice.indexOf('awardPoints(100,') !== -1 && slice.indexOf('Completed Nacho') !== -1, 'finish bonus 100 missing');
    assert.ok(slice.indexOf("showToast('📖 +' + _chPts + ' XP") !== -1, 'toast should use _chPts');
});

test('finish UI no longer claims +25 tickets or calls the stub grant', function () {
    var slice = storySlice();
    assert.ok(slice.indexOf('+25') === -1, 'finish UI still shows +25');
    assert.ok(slice.indexOf('TICKETS') === -1, 'finish UI still shows TICKETS');
    assert.ok(slice.indexOf('awardOrangeTickets(') === -1, 'story finish still calls awardOrangeTickets');
    assert.ok(slice.indexOf('btc_orange_tickets') === -1, 'story finish still increments local tickets');
    assert.ok(slice.indexOf('+100') !== -1, 'finish bonus copy missing');
});

test('nachoEtDate uses America/New_York, not UTC', function () {
    var start = features.indexOf('window.nachoEtDate = function');
    assert.ok(start !== -1, 'nachoEtDate missing');
    var sandbox = { window: {}, Intl: Intl, Date: Date, isNaN: isNaN };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    var end = features.indexOf('window.showNachoStory = function');
    vm.runInContext(features.slice(start, end), sandbox);
    assert.strictEqual(typeof sandbox.nachoEtDate, 'function');
    // 04:30 UTC on 18 Nov 2026 is 11:30 PM ET on 17 Nov 2026 (EST, UTC-5).
    var utcRolled = new Date('2026-11-18T04:30:00Z');
    assert.strictEqual(utcRolled.toISOString().split('T')[0], '2026-11-18');
    assert.strictEqual(sandbox.nachoEtDate(utcRolled), '2026-11-17');
    // Midday ET stays on the same calendar date as UTC that afternoon.
    var midday = new Date('2026-11-17T17:00:00Z');
    assert.strictEqual(sandbox.nachoEtDate(midday), '2026-11-17');
    var slice = storySlice();
    assert.ok(slice.indexOf('nachoEtDate()') !== -1, 'showNachoStory should use nachoEtDate');
    assert.ok(/var today = \(typeof nachoEtDate === 'function' \? nachoEtDate\(\)/.test(slice), 'today should prefer nachoEtDate');
    assert.ok(slice.indexOf('America/New_York') !== -1 || features.indexOf("timeZone: 'America/New_York'") !== -1, 'ET zone missing');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
