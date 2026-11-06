// Raid boss displays share one remaining-HP helper.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const hp = require('../raid-hp.js');

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

const boss = { name: 'Poll-Patroller', current: 564, target: 1000 };

test('remaining is max(0, maxHp - damage)', function () {
    assert.strictEqual(hp.raidHpRemaining(1000, 564), 436);
    assert.strictEqual(hp.raidHpRemaining(1000, 0), 1000);
    assert.strictEqual(hp.raidHpRemaining(1000, 1000), 0);
    assert.strictEqual(hp.raidHpRemaining(1000, 1500), 0);
    assert.strictEqual(hp.raidHpRemaining(1000, -5), 1005);
    assert.strictEqual(hp.raidHpRemaining(-10, 0), 0);
    assert.strictEqual(hp.raidHpRemaining('1000', '564'), 436);
    assert.strictEqual(hp.raidHpRemaining(undefined, undefined), 0);
    assert.strictEqual(hp.raidHpRemaining(NaN, 10), 0);
    assert.ok(read('raid-hp.js').includes('return Math.max(0, max - dealt);'));
});

test('boss stats use remaining health for the bar and keep damage percent', function () {
    const stats = hp.raidBossStats(boss);
    assert.strictEqual(stats.damage, 564);
    assert.strictEqual(stats.maxHp, 1000);
    assert.strictEqual(stats.remaining, 436);
    assert.strictEqual(stats.damagePct, 56);
    assert.strictEqual(stats.hpPct, 44);
    assert.ok(stats.hpPct < stats.damagePct);
    assert.strictEqual(stats.hpPct + stats.damagePct, 100);
    const full = hp.raidBossStats({ current: 0, target: 1000 });
    assert.strictEqual(full.remaining, 1000);
    assert.strictEqual(full.hpPct, 100);
    assert.strictEqual(full.damagePct, 0);
    const down = hp.raidBossStats({ current: 1000, target: 1000 });
    assert.strictEqual(down.remaining, 0);
    assert.strictEqual(down.hpPct, 0);
    const legacy = hp.raidBossStats({ currentHP: 200, targetHP: 800 });
    assert.strictEqual(legacy.remaining, 600);
    const preferCurrent = hp.raidBossStats({ current: 564, currentHP: 1, target: 1000, targetHP: 2 });
    assert.strictEqual(preferCurrent.remaining, 436);
    assert.strictEqual(preferCurrent.maxHp, 1000);
});

test('home pill and readout show remaining over max HP', function () {
    assert.strictEqual(hp.raidHpReadout(436, 1000), '436/1,000 HP');
    assert.strictEqual(hp.raidHpCount(1000), '1,000');
    assert.strictEqual(
        hp.raidHomePillText('Poll-Patroller', boss),
        '⚔️ Raid: Poll-Patroller ❤️ 436/1,000 HP'
    );
    assert.strictEqual(hp.raidHomePillText('', { current: 0, target: 10 }), '⚔️ Raid: Boss ❤️ 10/10 HP');
});

test('missing or zero max HP hides the label and does not fill a full bar', function () {
    [{ current: 564 }, { current: 564, target: 0 }, { current: 564, target: null }, { current: 564, target: '' }, { current: 10, target: -1 }].forEach(function (b) {
        const stats = hp.raidBossStats(b);
        assert.strictEqual(stats.maxHp <= 0, true);
        assert.strictEqual(stats.hasMax, false);
        assert.strictEqual(stats.hpPct, 0);
        assert.notStrictEqual(stats.hpPct, 100);
        const pill = hp.raidHomePillText('Poll-Patroller', b);
        assert.strictEqual(pill, '⚔️ Raid: Poll-Patroller');
        assert.strictEqual(pill.includes('0/0'), false);
        assert.strictEqual(pill.includes('HP'), false);
    });
    const known = hp.raidBossStats({ current: 0, target: 1000 });
    assert.strictEqual(known.hasMax, true);
    assert.strictEqual(known.hpPct, 100);
    const ux = read('mobile-ux.js');
    const home = ux.slice(ux.indexOf('if (activeBoss)'), ux.indexOf('if (upcomingBoss)'));
    assert.ok(home.includes("escapeHtml(activeBoss.name || 'Raid Boss')"));
    assert.ok(home.includes('if (stats.hasMax)'));
    const beforeGuard = home.slice(0, home.indexOf('if (stats.hasMax)'));
    assert.strictEqual(beforeGuard.includes('raidHpReadout'), false);
    assert.strictEqual(beforeGuard.includes("width:' + hpPct"), false);
    const shown = home.slice(home.indexOf('if (stats.hasMax)'), home.indexOf('window._raidActiveEndMs'));
    assert.ok(shown.includes('raidHpReadout(stats.remaining, stats.maxHp)'));
    assert.ok(shown.includes("width:' + hpPct + '%"));
    const quests = read('quests.js');
    const card = quests.slice(quests.indexOf('// Case 3: Active boss'), quests.indexOf('function _startRaidCountdown'));
    assert.ok(card.includes('if (stats.hasMax)'));
    const qBefore = card.slice(0, card.indexOf('if (stats.hasMax)'));
    assert.strictEqual(qBefore.includes('raidProgressBar'), false);
    assert.strictEqual(qBefore.includes('raidHpReadout'), false);
    assert.ok(card.includes("pct + '% damage dealt"));
    const live = quests.slice(quests.indexOf('Patch HP bar in real-time'), quests.indexOf('window._raidOnQuizComplete = function'));
    assert.ok(live.includes('!_stats.hasMax'));
});

test('home pill, home card, and raid modal call the shared helper', function () {
    const ux = read('mobile-ux.js');
    const pill = ux.slice(ux.indexOf("var raidLine = document.getElementById('todayRaidLine')"), ux.indexOf('window._raidHomeTimer = setInterval'));
    assert.ok(pill.includes('raidHomePillText(activeBoss.name, activeBoss)'));
    assert.strictEqual(pill.includes('activeBoss.current'), false);
    assert.ok(ux.includes('raidBossStats(activeBoss)'));
    assert.ok(ux.includes('raidHpReadout(stats.remaining, stats.maxHp)'));
    assert.ok(ux.includes("width:' + hpPct + '%"));
    const quests = read('quests.js');
    const card = quests.slice(quests.indexOf('// Case 3: Active boss'), quests.indexOf('function _startRaidCountdown'));
    assert.ok(card.includes('window.raidBossStats(boss)'));
    assert.ok(card.includes('window.raidHpReadout(remainingHP, target)'));
    assert.ok(card.includes("width:' + hpPct + '%"));
    assert.ok(card.includes("pct + '% damage dealt"));
    assert.strictEqual(card.includes('Math.max(0, target - current)'), false);
    const live = quests.slice(quests.indexOf('Patch HP bar in real-time'), quests.indexOf('window._raidOnQuizComplete = function'));
    assert.ok(live.includes('window.raidBossStats({ current: _cur, target: _tgt })'));
    assert.ok(live.includes('_stats.hpPct'));
    assert.ok(live.includes('window.raidHpReadout(_stats.remaining, _stats.maxHp)'));
    assert.ok(live.includes("_stats.damagePct + '% damage dealt'"));
    assert.ok(live.includes('window.raidHpCount(_stats.remaining)'));
    assert.strictEqual(live.includes('Math.max(0, _tgt - _cur)'), false);
    const src = read('bundle.src.js');
    assert.ok(src.includes('function raidHpRemaining'));
    assert.ok(src.includes('raidHomePillText(activeBoss.name, activeBoss)'));
    assert.ok(read('build.sh').includes('raid-hp.js'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
