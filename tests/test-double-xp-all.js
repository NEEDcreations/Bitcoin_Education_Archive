// Double XP applies once, server-side, to every profile-XP source.
// Order: double the base, then the daily taper. Key sends and tips use that
// same order. Sats, tickets, and other non-XP rewards are not doubled.
// A ledger replay returns the stored base and boosted amounts and does not
// multiply again. Concurrent plans of the same base each return 2x, not 4x.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { planXpGrant, ledgerData, replayFromLedger } = require('../functions/src/grantXp');
const awardActions = require('../functions/src/awardActions');
const { planDailyXp } = require('../functions/src/dailyXp');
const certBonus = require('../functions/src/certBonus');

let passed = 0;
let failed = 0;

function test(name, fn) {
    const run = fn();
    const ok = function () { console.log('✅ ' + name); passed++; };
    const bad = function (e) { console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e)); failed++; };
    if (run && typeof run.then === 'function') return run.then(ok, bad);
    try { ok(); } catch (e) { bad(e); }
    return Promise.resolve();
}

const NOW = 1_700_000_000_000;
const ACTIVE = { doubleXpUntil: NOW + 60 * 60 * 1000 };
const EXPIRED = { doubleXpUntil: NOW - 1 };

function doubled(base, dailyUsed, extra) {
    return planXpGrant(Object.assign({
        base: base,
        user: ACTIVE,
        now: NOW,
        dailyUsed: dailyUsed || 0,
    }, extra || {}));
}

const SOURCES = [
    { name: 'awardPoints', file: 'functions/index.js', needle: 'planXpGrant' },
    { name: 'daily spin', file: 'functions/index.js', needle: 'spinPlan' },
    { name: 'pvp', file: 'functions/index.js', needle: 'base: pvpBlocked ? 0 : p.points' },
    { name: 'proof of walk', file: 'functions/index.js', needle: 'plan.rawPoints' },
    { name: 'scholar cert', file: 'functions/src/certBonus.js', needle: 'function applyXpWindow' },
    { name: 'badges', file: 'functions/src/awardBadge.js', needle: 'applyDailyXp(' },
    { name: 'badge credit', file: 'functions/src/badgeCredit.js', needle: 'applyDailyXp(' },
    { name: 'say hi', file: 'functions/src/sayHi.js', needle: 'planXpGrant' },
    { name: 'reply bonus', file: 'functions/src/replyBonus.js', needle: 'planXpGrant' },
    { name: 'trivia and quests', file: 'functions/src/questReward.js', needle: 'planXpGrant' },
    { name: 'predictions', file: 'functions/src/predictionJobs.js', needle: 'planXpGrant' },
    { name: 'raid is not a direct XP payer', file: 'functions/src/raidBossEngine.js', needle: 'noteTrusted' },
    { name: 'cipher open', file: 'functions/src/gifting.js', needle: 'reward.base = tapered.base' },
    { name: 'cipher share', file: 'functions/src/cipherShare.js', needle: 'planXpGrant' },
    { name: 'key send', file: 'functions/src/gifting.js', needle: 'KEY_SEND_XP' },
    { name: 'open gift', file: 'functions/src/gifting.js', needle: 'giftPlan' },
    { name: 'tips', file: 'functions/src/tipService.js', needle: 'call.awardXp' },
    { name: 'guest merge', file: 'functions/src/onboardingApi.js', needle: 'boost: false' },
    { name: 'tctv watch', file: 'functions/src/tctvWatch.js', needle: 'planXpGrant' },
    { name: 'onboarding', file: 'functions/src/onboardingQuest.js', needle: 'planXpGrant' },
    { name: 'peer level', file: 'functions/src/peerLevel.js', needle: 'planXpGrant' },
    { name: 'poll', file: 'functions/src/pollVote.js', needle: 'planXpGrant' },
    { name: 'daily five', file: 'functions/src/dailyFive.js', needle: 'planXpGrant' },
    { name: 'article publish', file: 'functions/src/articlePublishXp.js', needle: 'planXpGrant' },
    { name: 'topic conversation', file: 'functions/src/topicConversationXp.js', needle: 'applyDailyXp(' },
];

test('the window doubles the base before the daily taper', () => {
    const on = doubled(100, 450);
    const tapered = planDailyXp(450, 200);
    assert.strictEqual(on.base, 100);
    assert.strictEqual(on.boosted, 200);
    assert.strictEqual(on.doubled, true);
    assert.strictEqual(on.awarded, tapered.awarded);
    assert.strictEqual(on.dailyXp, tapered.dailyXp);
    assert.strictEqual(on.awarded, 125);

    const off = planXpGrant({ base: 100, user: EXPIRED, now: NOW, dailyUsed: 450 });
    assert.strictEqual(off.doubled, false);
    assert.strictEqual(off.boosted, 100);
    assert.strictEqual(off.awarded, planDailyXp(450, 100).awarded);

    const exact = planXpGrant({ base: 100, user: { doubleXpUntil: NOW }, now: NOW, dailyUsed: 0 });
    assert.strictEqual(exact.doubled, false);
    assert.strictEqual(exact.awarded, 100);
});

test('the multiplier applies once and a replay does not apply it again', () => {
    const first = doubled(40, 0);
    assert.strictEqual(first.awarded, 80);
    const again = planXpGrant({
        base: first.base,
        boosted: first.boosted,
        doubled: first.doubled,
        until: first.until,
        alreadyBoosted: true,
        user: ACTIVE,
        now: NOW,
        dailyUsed: 0,
    });
    assert.strictEqual(again.boosted, 80);
    assert.strictEqual(again.awarded, 80);

    const row = ledgerData(first, { source: 'flex', day: '2026-10-29', uid: 'u' });
    assert.strictEqual(row.base, 40);
    assert.strictEqual(row.boosted, 80);
    assert.strictEqual(row.awarded, 80);
    const replay = replayFromLedger(row);
    assert.strictEqual(replay.replay, true);
    assert.strictEqual(replay.base, 40);
    assert.strictEqual(replay.boosted, 80);
    assert.strictEqual(replay.awarded, 80);
    const stacked = planXpGrant({
        base: replay.boosted,
        user: ACTIVE,
        now: NOW,
        alreadyBoosted: true,
        boosted: replay.boosted,
        doubled: replay.doubled,
    });
    assert.strictEqual(stacked.awarded, 80);
});

test('concurrent plans of one base each return 2x', () => {
    const rows = [];
    const pending = [];
    for (let i = 0; i < 24; i++) {
        pending.push(Promise.resolve().then(function () { return doubled(15, 0); }));
    }
    return Promise.all(pending).then(function (settled) {
        settled.forEach(function (row) { rows.push(row); });
        assert.strictEqual(rows.length, 24);
        rows.forEach(function (row) {
            assert.strictEqual(row.base, 15);
            assert.strictEqual(row.boosted, 30);
            assert.strictEqual(row.awarded, 30);
        });
    });
});

test('sats, tickets, and a zero base are not doubled', () => {
    ['sats', 'tickets', 'orangeTickets', 'freezes', 'closet'].forEach(function (kind) {
        const row = planXpGrant({ kind: kind, base: 25, user: ACTIVE, now: NOW });
        assert.strictEqual(row.awarded, 25, kind);
        assert.strictEqual(row.doubled, false, kind);
        assert.strictEqual(row.boosted, 25, kind);
    });
    const zero = doubled(0, 0);
    assert.strictEqual(zero.awarded, 0);
    assert.strictEqual(zero.doubled, false);
});

test('each source class plans XP through the shared helper', () => {
    const root = path.join(__dirname, '..');
    SOURCES.forEach(function (src) {
        const text = fs.readFileSync(path.join(root, src.file), 'utf8');
        assert.ok(text.indexOf(src.needle) !== -1, src.name + ' missing ' + src.needle);
    });
    const skipped = {
        'functions/src/referralService.js': 'orangeTickets',
        'functions/src/satoshiFavor.js': 'userSfPoints',
    };
    Object.keys(skipped).forEach(function (rel) {
        const text = fs.readFileSync(path.join(root, rel), 'utf8');
        assert.ok(text.indexOf(skipped[rel]) !== -1, rel);
        assert.strictEqual(text.indexOf('planXpGrant'), -1, rel + ' is not profile XP');
        assert.strictEqual(text.indexOf('boostPoints'), -1, rel);
    });
});

test('a legacy doubled client integer resolves to the base and is doubled once', () => {
    const streak = awardActions.resolveAction({ action: '🔥 7-day chat streak!', pts: 50 });
    assert.strictEqual(streak.ok, true);
    assert.strictEqual(streak.xp, 25);
    assert.strictEqual(streak.requiresDoubleXp, true);
    const on = awardActions.applyAward({ users: {} }, 'u', { action: '🔥 7-day chat streak!', pts: 50 }, { doubleXpActive: true, now: NOW });
    assert.strictEqual(on.success, true);
    assert.strictEqual(on.awarded, 50);
    const off = awardActions.applyAward({ users: {} }, 'u2', { action: '🔥 7-day chat streak!', pts: 50 }, { now: NOW });
    assert.strictEqual(off.success, false);
    assert.strictEqual(off.awarded, 0);
    const baseOn = awardActions.applyAward({ users: {} }, 'u3', { action: '🔥 7-day chat streak!', pts: 25 }, { doubleXpActive: true, now: NOW });
    assert.strictEqual(baseOn.awarded, 50);
    const baseOff = awardActions.applyAward({ users: {} }, 'u4', { action: '🔥 7-day chat streak!', pts: 25 }, { now: NOW });
    assert.strictEqual(baseOff.awarded, 25);
});

test('hostile pts are rejected with Double XP on and off', () => {
    const hostile = ['50x', '50.9', ' 50', [50], -5];
    const actions = ['🔥 7-day chat streak!', 'Uploaded a track to Bitcoin Beats! 🎵'];
    hostile.forEach(function (pts) {
        actions.forEach(function (action) {
            [true, false].forEach(function (on) {
                const result = awardActions.applyAward({ users: {} }, 'u', { action: action, pts: pts }, on ? { doubleXpActive: true, now: NOW } : { now: NOW });
                assert.strictEqual(result.success, false, action + ' ' + String(pts) + ' on=' + on);
                assert.strictEqual(result.awarded, 0, action + ' ' + String(pts) + ' on=' + on);
            });
        });
    });
    // 1e3 is the integer 1000, not a parseInt prefix. It is not a streak amount.
    [true, false].forEach(function (on) {
        const streak = awardActions.applyAward({ users: {} }, 'u', { action: '🔥 7-day chat streak!', pts: 1e3 }, on ? { doubleXpActive: true, now: NOW } : { now: NOW });
        assert.strictEqual(streak.success, false);
        assert.strictEqual(streak.awarded, 0);
    });
    const beatsOff = awardActions.applyAward({ users: {} }, 'b', { action: 'Uploaded a track to Bitcoin Beats! 🎵', pts: 1e3 }, { now: NOW });
    const beatsOn = awardActions.applyAward({ users: {} }, 'b2', { action: 'Uploaded a track to Bitcoin Beats! 🎵', pts: 1e3 }, { doubleXpActive: true, now: NOW });
    assert.strictEqual(beatsOff.awarded, 50);
    assert.strictEqual(beatsOn.awarded, 100);
});

test('a missing or invalid now uses server time', () => {
    const past = { doubleXpUntil: 1 };
    assert.strictEqual(planXpGrant({ base: 10, user: past, now: 0 }).doubled, false);
    assert.strictEqual(planXpGrant({ base: 10, user: past, now: Number.NaN }).doubled, false);
    const open = planXpGrant({ base: 10, user: { doubleXpUntil: Date.now() + 60000 } });
    assert.strictEqual(open.doubled, true);
    assert.strictEqual(open.awarded, 20);
});

test('the certification bonus doubles outside the daily cap', () => {
    const plain = certBonus.planCertBonus({ type: 'properties', passed: true, banned: false, alreadyPaid: false });
    assert.strictEqual(plain.amount, 2100);
    const open = certBonus.applyXpWindow(plain, ACTIVE, NOW);
    assert.strictEqual(open.base, 2100);
    assert.strictEqual(open.boosted, 4200);
    assert.strictEqual(open.amount, 4200);
    assert.strictEqual(open.doubled, true);
    assert.strictEqual(open.capExempt, true);
    const shut = certBonus.applyXpWindow(plain, EXPIRED, NOW);
    assert.strictEqual(shut.amount, 2100);
    assert.strictEqual(shut.doubled, false);
});

test('boostPoints is only the primitive inside the shared helper', () => {
    const root = path.join(__dirname, '..', 'functions');
    const hits = [];
    function walk(dir) {
        fs.readdirSync(dir).forEach(function (name) {
            const full = path.join(dir, name);
            if (fs.statSync(full).isDirectory()) {
                if (name === 'node_modules') return;
                walk(full);
                return;
            }
            if (!full.endsWith('.js')) return;
            const rel = path.relative(root, full);
            if (rel === path.join('src', 'doubleXp.js') || rel === path.join('src', 'grantXp.js')) return;
            if (fs.readFileSync(full, 'utf8').indexOf('boostPoints') !== -1) hits.push(rel);
        });
    }
    walk(root);
    assert.deepStrictEqual(hits, []);
});

setTimeout(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
}, 50);
