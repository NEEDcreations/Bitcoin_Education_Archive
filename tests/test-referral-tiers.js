#!/usr/bin/env node
// Invite tiers: mapping, server count rules, and a client that cannot write the count.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const tiers = require(path.join(root, 'referral-tiers.js'));
const referrals = require(path.join(root, 'functions/src/referrals.js'));

function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

const NAMES = [
    { level: 0, min: 0, name: 'Attendee', emoji: '🎟️' },
    { level: 1, min: 1, name: 'Meetup Regular', emoji: '🍻' },
    { level: 2, min: 10, name: 'Meetup Organizer', emoji: '📋' },
    { level: 3, min: 25, name: 'Conference Speaker', emoji: '🎤' },
    { level: 4, min: 50, name: 'Conference Host', emoji: '🏟️' },
    { level: 5, min: 100, name: 'Keynote Legend', emoji: '🏆' }
];

test('tier names, emoji, and thresholds live in one list', () => {
    assert.strictEqual(tiers.TIERS.length, 6);
    NAMES.forEach(function (row, i) {
        assert.strictEqual(tiers.TIERS[i].level, row.level);
        assert.strictEqual(tiers.TIERS[i].min, row.min);
        assert.strictEqual(tiers.TIERS[i].name, row.name);
        assert.strictEqual(tiers.TIERS[i].emoji, row.emoji);
    });
    assert.strictEqual(tiers.MAXI_RANK_POINTS, 2140);
    assert.strictEqual(tiers.MAXI_RANK_POINTS, referrals.MAXI_POINTS);
});

test('tier mapping hits every boundary', () => {
    const cases = [
        [0, 0, 'Attendee', '0/1 to Meetup Regular'],
        [1, 1, 'Meetup Regular', '1/10 to Meetup Organizer'],
        [3, 1, 'Meetup Regular', '3/10 to Meetup Organizer'],
        [9, 1, 'Meetup Regular', '9/10 to Meetup Organizer'],
        [10, 2, 'Meetup Organizer', '10/25 to Conference Speaker'],
        [24, 2, 'Meetup Organizer', '24/25 to Conference Speaker'],
        [25, 3, 'Conference Speaker', '25/50 to Conference Host'],
        [49, 3, 'Conference Speaker', '49/50 to Conference Host'],
        [50, 4, 'Conference Host', '50/100 to Keynote Legend'],
        [99, 4, 'Conference Host', '99/100 to Keynote Legend'],
        [100, 5, 'Keynote Legend', 'Max level'],
        [250, 5, 'Keynote Legend', 'Max level']
    ];
    cases.forEach(function (row) {
        const progress = tiers.tierProgress(row[0]);
        assert.strictEqual(progress.level, row[1], 'level ' + row[0]);
        assert.strictEqual(progress.tier.name, row[2], 'name ' + row[0]);
        assert.strictEqual(progress.tierLabel, progress.tier.emoji + ' ' + row[2]);
        assert.strictEqual(progress.progressText, row[3], 'progress ' + row[0]);
        assert.strictEqual(progress.maxed, row[1] === 5);
        assert.strictEqual(progress.countText, row[0] === 1 ? '1 reached Maxi' : row[0] + ' reached Maxi');
    });
    assert.strictEqual(tiers.normalizeCount(-3), 0);
    assert.strictEqual(tiers.normalizeCount('nope'), 0);
    assert.strictEqual(tiers.normalizeCount(null), 0);
    assert.strictEqual(tiers.tierForCount(100000).level, 5);
});

function credited(extra) {
    return Object.assign({
        status: 'paid',
        verified: true,
        ticketsAwarded: true,
        referrerUid: 'referrer'
    }, extra || {});
}

function maxi(extra) {
    return Object.assign({ points: 2140 }, extra || {});
}

test('only a credited referee who still holds Maxi counts', () => {
    const good = { referral: credited({ referredUid: 'a' }), referee: maxi() };
    assert.strictEqual(tiers.countsForLevel(good.referral, good.referee, null), true);
    assert.strictEqual(tiers.holdsMaxiRank({ points: 2139 }), false);
    assert.strictEqual(tiers.holdsMaxiRank({ points: 2140 }), true);
    assert.strictEqual(tiers.holdsMaxiRank({ points: 10000 }), true);
    assert.strictEqual(tiers.countsForLevel(credited({ referredUid: 'a' }), { points: 2139 }, null), false);
    assert.strictEqual(tiers.countsForLevel(credited({ referredUid: 'a' }), { points: 10000 }, null), true);
    assert.strictEqual(tiers.countsForLevel(credited({ referredUid: 'a' }), maxi({ banned: true }), null), false);
    assert.strictEqual(tiers.countsForLevel(credited({ referredUid: 'a' }), maxi({ satsDisabled: true }), null), false);
    assert.strictEqual(tiers.countsForLevel(credited({ referredUid: 'a' }), maxi({ ledgerBanned: true }), null), false);
    assert.strictEqual(tiers.countsForLevel(credited({ referredUid: 'a' }), maxi(), { banned: true }), false);
    assert.strictEqual(tiers.countsForLevel(credited({ referredUid: 'a' }), null, null), false);
    assert.strictEqual(tiers.countsForLevel(credited({ referredUid: 'a' }), maxi({ deleted: true }), null), false);
    assert.strictEqual(tiers.countsForLevel(credited({ referredUid: 'a', status: 'pending' }), maxi(), null), false);
    assert.strictEqual(tiers.countsForLevel(credited({ referredUid: 'a', verified: false }), maxi(), null), false);
    assert.strictEqual(tiers.countsForLevel(credited({ referredUid: 'a', ticketsAwarded: false }), maxi(), null), false);
    assert.strictEqual(tiers.countsForLevel(credited({ referredUid: 'referrer', referrerUid: 'referrer' }), maxi(), null), false);
    const rows = [
        good,
        { referral: credited({ referredUid: 'a' }), referee: maxi() },
        { referral: credited({ referredUid: 'b' }), referee: maxi({ points: 5000 }) }
    ];
    assert.strictEqual(tiers.countCreditedMaxi(rows), 2);
});

test('backfill writes only when the stored count would change', () => {
    const referral = credited({ referredUid: 'ref', referrerUid: 'host' });
    const referee = Object.assign({ uid: 'ref' }, maxi());
    const match = tiers.planMaxiCountWrites({
        users: [
            { uid: 'host', points: 10, referralMaxiCount: 1 },
            referee
        ],
        referrals: [referral],
        ledgers: {}
    });
    assert.strictEqual(match.writes.length, 0);
    const missing = tiers.planMaxiCountWrites({
        users: [{ uid: 'host', points: 10 }, referee],
        referrals: [referral],
        ledgers: {}
    });
    assert.strictEqual(missing.writes.length, 1);
    assert.strictEqual(missing.writes[0].to, 1);
    assert.strictEqual(missing.writes[0].from, null);
    const stale = tiers.planMaxiCountWrites({
        users: [{ uid: 'host', points: 10, referralMaxiCount: 4 }],
        referrals: [],
        ledgers: {}
    });
    assert.strictEqual(stale.writes.length, 1);
    assert.strictEqual(stale.writes[0].to, 0);
    const absentZero = tiers.planMaxiCountWrites({
        users: [{ uid: 'host', points: 10 }],
        referrals: [],
        ledgers: {}
    });
    assert.strictEqual(absentZero.writes.length, 0);
    assert.strictEqual(absentZero.summary.writes, 0);
    assert.ok(!JSON.stringify(absentZero.summary).includes('host'));
});

test('clients cannot write referralMaxiCount', () => {
    const rules = read('firestore.rules');
    const createStart = rules.indexOf('allow create: if request.auth != null');
    const updateStart = rules.indexOf('allow update:', createStart);
    const createSlice = rules.slice(createStart, updateStart);
    assert.ok(createStart > 0 && updateStart > createStart);
    assert.strictEqual(createSlice.includes('referralMaxiCount'), false);
    const denyAt = rules.indexOf("'referralInvited', 'referralMaxiCount'");
    assert.ok(denyAt > updateStart);
    assert.ok(rules.includes('allow create, update, delete: if false'));
    const referralsAt = rules.indexOf('match /referrals/{referralId}');
    const referralsSlice = rules.slice(referralsAt, referralsAt + 900);
    assert.ok(referralsSlice.includes('allow create, update, delete: if false'));
    ['ranking.js', 'tickets.js', 'referral-tiers.js', 'app.js', 'auth-display.js'].forEach(function (file) {
        assert.strictEqual(/referralMaxiCount[ \t]*:/.test(read(file)), false, file);
    });
    const service = read('functions/src/referralService.js');
    assert.ok(/referralMaxiCount:[ \t]*count/.test(service));
    const refreshStart = read('ranking.js').indexOf('window.refreshHomeStrip = function()');
    const refresh = read('ranking.js').slice(refreshStart, refreshStart + 1800);
    assert.strictEqual(refresh.includes('getReferralStats'), false);
    assert.ok(refresh.includes('serverMaxiReferralCount') || read('ranking.js').includes('user.referralMaxiCount'));
    assert.ok(read('ranking.js').includes('user.referralMaxiCount'));
    const names = ['Meetup Organizer', 'Keynote Legend', 'Meetup Regular', 'Conference Speaker', 'Conference Host', 'Attendee'];
    names.forEach(function (name) {
        assert.strictEqual(read('ranking.js').includes(name), false, name);
        assert.strictEqual(read('index.html').includes(name), false, name);
    });
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
