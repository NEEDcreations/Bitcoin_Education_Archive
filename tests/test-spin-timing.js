// Daily wheel clock: phase 1 is capped, deceleration is 800ms, and the
// wheel lands on the server index. The old clock was server RTT + 1500ms.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const start = app.indexOf('window._dailySpinClock = (function()');
const end = app.indexOf('window.showSpinWheel = function()');
assert.ok(start > 0 && end > start, 'spin clock markers');

const sandbox = { Math: Math, Date: Date, isFinite: isFinite };
sandbox.window = sandbox;
vm.runInNewContext(app.slice(start, end) + '\nthis.clock = window._dailySpinClock;', sandbox, { filename: 'spin-clock.js' });
const clock = sandbox.clock;

const handlerStart = app.indexOf("spinBtn.addEventListener('click'");
const handlerEnd = app.indexOf("modal.addEventListener('click'", handlerStart);
const handler = app.slice(handlerStart, handlerEnd);

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

test('deceleration is 800ms and phase 1 is capped at 600ms', () => {
    assert.strictEqual(clock.PHASE2_MS, 800);
    assert.strictEqual(clock.PHASE1_CAP_MS, 600);
    assert.ok(clock.SETTLE_SPEED < clock.PHASE1_SPEED);
    assert.ok(!app.includes('phase2Duration = 1500'));
});

test('click-to-result is about half the old animation and always shorter', () => {
    const samples = [0, 250, 650, 4000];
    samples.forEach(function(serverMs) {
        const after = clock.simulate(serverMs, { index: 4, rand: 0.42 });
        const before = clock.simulateLegacy(serverMs);
        console.log('TIMING serverMs=' + serverMs + ' before=' + before.ms + ' after=' + after.ms + ' settled=' + after.settled + ' landed=' + after.landed);
        assert.strictEqual(after.phase, 'done');
        assert.strictEqual(after.landed, 4);
        assert.ok(after.ms < before.ms, serverMs + ' did not get shorter');
        const saved = before.ms - after.ms;
        assert.ok(Math.abs(saved - 700) <= clock.FRAME_MS + 0.01, 'saved ' + saved + ' at ' + serverMs);
        assert.strictEqual(after.settled, serverMs > clock.PHASE1_CAP_MS);
    });
    function near(actual, expected, label) {
        assert.ok(Math.abs(actual - expected) < 20, (label || 'timing') + ' ' + actual + ' vs ' + expected);
    }
    const instant = clock.simulate(0, { index: 0 });
    const instantOld = clock.simulateLegacy(0);
    near(instant.ms, 800, 'instant');
    near(instantOld.ms, 1500, 'instant old');
    const ratio = instant.ms / instantOld.ms;
    assert.ok(Math.abs(ratio - 0.5) < 0.06, 'animation ratio ' + ratio);
    const typical = clock.simulate(650, { index: 9, rand: 0.2 });
    const typicalOld = clock.simulateLegacy(650);
    near(typical.ms, 1450, 'typical');
    near(typicalOld.ms, 2150, 'typical old');
    assert.strictEqual(typical.settled, true);
    assert.strictEqual(typical.landed, 9);
    const slow = clock.simulate(4000, { index: 2, rand: 0.8 });
    const slowOld = clock.simulateLegacy(4000);
    near(slow.ms, 4800, 'slow');
    near(slowOld.ms, 5500, 'slow old');
    assert.strictEqual(slow.settled, true);
    assert.strictEqual(slow.landed, 2);
});

test('every server index lands on that index, including a slow server', () => {
    const rands = [0, 0.15, 0.42, 0.7, 0.95];
    for (let index = 0; index < 10; index++) {
        rands.forEach(function(rand) {
            [0, 200, 650, 4000].forEach(function(serverMs) {
                const run = clock.simulate(serverMs, { index: index, rand: rand });
                assert.strictEqual(run.landed, index, 'index ' + index + ' rand ' + rand + ' server ' + serverMs + ' landed ' + run.landed);
            });
        });
    }
});

test('the wheel does not finish on a client-chosen result', () => {
    const state = clock.createState();
    state.started = 0;
    for (let t = 0; t <= 5000; t += clock.FRAME_MS) clock.step(state, t);
    assert.notStrictEqual(state.phase, 'done');
    assert.strictEqual(state.serverIndex, -1);
    assert.strictEqual(state.phase, 'settle');
    state.error = new Error('Spin failed');
    clock.step(state, 5100);
    assert.strictEqual(state.phase, 'error');
});

test('the click handler uses only the server reward', () => {
    assert.ok(handler.includes('httpsCallable(\'dailySpin\')'));
    assert.ok(handler.includes('reward.rewardIndex'));
    assert.ok(handler.includes('showSpinReward(serverReward, spinState.serverIndex)'));
    assert.ok(!handler.includes('awardOrangeTickets'));
    assert.ok(!handler.includes('awardPoints'));
    assert.ok(!handler.includes('RARE_TABLE'));
    assert.ok(!handler.includes('totalWeight'));
    assert.ok(app.includes("{ label: '⭐ 10 XP', value: 'points_10', weight: 18"));
    assert.ok(app.includes("{ label: '⭐ 25 XP', value: 'points_25', weight: 8"));
    assert.ok(app.includes("{ label: '⭐ 50 XP', value: 'points_50', weight: 3"));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
