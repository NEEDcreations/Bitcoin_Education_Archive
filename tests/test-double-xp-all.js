// Double XP applies once, server-side, to every profile-XP source.
// Order: double the base, then the daily taper. Key sends and tips use that
// same order. Sats, tickets, and other non-XP rewards are not doubled.
// A ledger replay returns the stored base and boosted amounts and does not
// multiply again. Concurrent plans of the same base each return 2x, not 4x.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { planXpGrant, ledgerData, replayFromLedger, baseFromAllowlist } = require('../functions/src/grantXp');
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
    { name: 'daily spin', file: 'functions/index.js', needle: 'source: isBonusSpin ? \'bonus_spin\' : \'daily_spin\'' },
    { name: 'pvp', file: 'functions/index.js', needle: "source: 'pvp'" },
    { name: 'proof of walk', file: 'functions/index.js', needle: "source: 'proof_of_walk'" },
    { name: 'scholar cert', file: 'functions/src/certBonus.js', needle: 'function applyXpWindow' },
    { name: 'badges', file: 'functions/src/awardBadge.js', needle: 'applyDailyXp(' },
    { name: 'badge credit', file: 'functions/src/badgeCredit.js', needle: 'applyDailyXp(' },
    { name: 'say hi', file: 'functions/src/sayHi.js', needle: 'planXpGrant' },
    { name: 'reply bonus', file: 'functions/src/replyBonus.js', needle: 'planXpGrant' },
    { name: 'trivia and quests', file: 'functions/src/questReward.js', needle: 'planXpGrant' },
    { name: 'predictions', file: 'functions/src/predictionJobs.js', needle: 'planXpGrant' },
    { name: 'raid is not a direct XP payer', file: 'functions/src/raidBossEngine.js', needle: 'noteTrusted' },
    { name: 'cipher open', file: 'functions/src/gifting.js', needle: "source: 'cipher'" },
    { name: 'cipher share', file: 'functions/src/cipherShare.js', needle: 'planXpGrant' },
    { name: 'key send', file: 'functions/src/gifting.js', needle: 'KEY_SEND_XP' },
    { name: 'open gift', file: 'functions/src/gifting.js', needle: "source: 'open_gift'" },
    { name: 'tips', file: 'functions/src/tipService.js', needle: "source: 'tip'" },
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

test('a legacy doubled client claim is reduced to the base before the helper doubles it', () => {
    assert.strictEqual(baseFromAllowlist(10, 10, true), 5);
    assert.strictEqual(baseFromAllowlist(10, 20, true), 10);
    assert.strictEqual(baseFromAllowlist(5, 5, false), 5);
    const flex = planXpGrant({
        base: baseFromAllowlist(10, 10, true),
        user: ACTIVE,
        now: NOW,
        dailyUsed: 0,
    });
    assert.strictEqual(flex.awarded, 10);
    assert.strictEqual(flex.doubled, true);
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
