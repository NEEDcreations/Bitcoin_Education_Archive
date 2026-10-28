#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const buddy = require('../functions/src/buddyMatch');
const badgeRules = require('../functions/src/badgeRules');
const { familyFor } = require('../functions/src/grantBadge');
const cleanup = require('../scripts/cleanup_stale_buddies');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (err) {
        console.log('❌ ' + name + ': ' + (err && err.message ? err.message : err));
        failed++;
    }
}

function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

const NOW = Date.parse('2026-10-28T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function person(username) {
    return { username: username, blockedUsers: [], activeBuddyId: '' };
}

function poolRow(id, extra) {
    return Object.assign({
        id: id,
        uid: id,
        level: 'beginner',
        goal: 'teach',
        intro: 'hello',
        username: id,
        joinedAtMs: NOW - 2 * HOUR,
        waitedMs: 2 * HOUR,
        fresh: true,
        user: person(id),
    }, extra || {});
}

function me(extra) {
    return Object.assign({
        uid: 'aliceuid',
        level: 'beginner',
        goal: 'learn',
        intro: 'I want to learn',
        username: 'Alice',
        user: person('Alice'),
    }, extra || {});
}

test('intro is capped and stripped to plain text', function () {
    const raw = '<img src=x onerror="alert(1)"><b>Hello</b> &lt;script&gt;alert(1)&lt;/script&gt; ' + 'x'.repeat(250);
    const clean = buddy.plainText(raw, 200);
    assert.ok(clean.indexOf('<') === -1, clean);
    assert.ok(clean.indexOf('onerror') === -1, clean);
    assert.ok(clean.length <= 200, String(clean.length));
    assert.ok(clean.indexOf('Hello') !== -1, clean);
});

test('username comes from the profile, never a client string', function () {
    assert.strictEqual(buddy.profileUsername({ username: '<b>Ada</b>' }), 'Ada');
    assert.strictEqual(buddy.profileUsername({ username: 'A' }), '');
    const plan = buddy.buildMatchPlan({
        uid: 'aliceuid',
        level: 'beginner',
        goal: 'learn',
        intro: '<i>seeds</i>',
        now: NOW,
        user: { username: 'Alice', blockedUsers: [] },
        rate: null,
        ownPool: null,
        activeMatch: null,
        candidates: [],
    });
    assert.strictEqual(plan.status, 'waiting');
    assert.strictEqual(plan.pool.username, 'Alice');
    assert.strictEqual(plan.pool.intro, 'seeds');
    assert.ok(!plan.pool.clientName);
});

test('matching prefers the oldest same or adjacent level', function () {
    const chosen = buddy.pickPartner([
        poolRow('lateNear', { joinedAtMs: NOW - HOUR, waitedMs: HOUR, level: 'intermediate' }),
        poolRow('earlyNear', { joinedAtMs: NOW - 5 * HOUR, waitedMs: 5 * HOUR, level: 'beginner' }),
        poolRow('earlyFar', { joinedAtMs: NOW - 6 * HOUR, waitedMs: 6 * HOUR, level: 'advanced' }),
    ], me());
    assert.strictEqual(chosen.uid, 'earlyNear');
});

test('a distant level matches only after 24 hours', function () {
    const young = buddy.pickPartner([
        poolRow('faruserx', { joinedAtMs: NOW - 2 * HOUR, waitedMs: 2 * HOUR, level: 'advanced' }),
    ], me());
    assert.strictEqual(young, null);
    const old = buddy.pickPartner([
        poolRow('faruserx', { joinedAtMs: NOW - 25 * HOUR, waitedMs: 25 * HOUR, level: 'advanced' }),
    ], me());
    assert.strictEqual(old.uid, 'faruserx');
});

test('blocked, matched, stale, and same-goal people are skipped', function () {
    const blockedMe = me();
    blockedMe.user = { username: 'Alice', blockedUsers: ['blockeduid'] };
    const none = buddy.pickPartner([
        poolRow('blockeduid', { user: person('Blocked') }),
        poolRow('staleuid', { joinedAtMs: NOW - 8 * DAY, waitedMs: 8 * DAY, fresh: false }),
        poolRow('samegoal', { goal: 'learn' }),
        poolRow('busyuid', { user: Object.assign(person('Busy'), { activeBuddyId: 'busyuid_otheruid' }) }),
        poolRow('aliceuid'),
    ], blockedMe);
    assert.strictEqual(none, null);
    const reverse = buddy.pickPartner([
        poolRow('revuid', { user: Object.assign(person('Rev'), { blockedUsers: ['aliceuid'] }) }),
    ], me());
    assert.strictEqual(reverse, null);
});

test('a match writes both sides and a plain Nacho welcome', function () {
    const plan = buddy.buildMatchPlan({
        uid: 'aliceuid',
        level: 'beginner',
        goal: 'learn',
        intro: '<b>fees</b>',
        now: NOW,
        user: { username: 'Alice', blockedUsers: [] },
        rate: null,
        candidates: [poolRow('bobuidxx', { username: 'Bob', intro: '<script>nope</script>utxo', user: person('Bob'), level: 'intermediate', goal: 'teach' })],
    });
    assert.strictEqual(plan.status, 'matched');
    assert.strictEqual(plan.created, true);
    assert.strictEqual(plan.matchId, buddy.matchIdFor('aliceuid', 'bobuidxx'));
    assert.strictEqual(plan.storedMatch.user1.username, 'Alice');
    assert.strictEqual(plan.storedMatch.user2.username, 'Bob');
    assert.ok(plan.welcome.indexOf('jump in') === -1, plan.welcome);
    assert.ok(plan.welcome.indexOf('<') === -1, plan.welcome);
    assert.ok(plan.welcome.indexOf('fees') !== -1);
    assert.strictEqual(plan.notices.length, 2);
    assert.strictEqual(plan.notices[0].type, 'buddy');
    assert.strictEqual(plan.notices[1].type, 'buddy');
});

test('no match stores the requester and an expiry', function () {
    const plan = buddy.buildMatchPlan({
        uid: 'aliceuid',
        level: 'advanced',
        goal: 'teach',
        intro: 'hello',
        now: NOW,
        user: { username: 'Alice', blockedUsers: [] },
        rate: null,
        candidates: [],
    });
    assert.strictEqual(plan.status, 'waiting');
    assert.strictEqual(plan.pool.expiresAtMs - plan.pool.joinedAtMs, buddy.POOL_TTL_MS);
});

test('rate limit and a missing username fail closed', function () {
    const fast = buddy.buildMatchPlan({
        uid: 'aliceuid',
        level: 'beginner',
        goal: 'learn',
        intro: '',
        now: NOW,
        user: { username: 'Alice' },
        rate: { lastMs: NOW - 1000, day: '2026-10-28', count: 1 },
        candidates: [],
    });
    assert.strictEqual(fast.error.buddyCode, 'rate');
    const nameless = buddy.buildMatchPlan({
        uid: 'aliceuid',
        level: 'beginner',
        goal: 'learn',
        intro: '',
        now: NOW,
        user: { username: 'A' },
        candidates: [],
    });
    assert.strictEqual(nameless.error.buddyCode, 'profile');
    const bad = buddy.buildMatchPlan({
        uid: 'aliceuid',
        level: 'wizard',
        goal: 'learn',
        now: NOW,
        user: { username: 'Alice' },
        candidates: [],
    });
    assert.strictEqual(bad.error.buddyCode, 'level');
});

test('xp is 20 only after both buddies write, and only once per 30 days', function () {
    const convo = { isBuddyMatch: true, participants: ['aliceuid', 'bobuidxx'] };
    const first = buddy.planBuddyXp({
        convo: convo,
        match: {},
        message: { text: 'hello', senderUid: 'aliceuid' },
        senderUid: 'aliceuid',
        messageId: 'm1',
        users: {},
        now: NOW,
    });
    assert.strictEqual(first.awards.length, 0);
    assert.strictEqual(first.spoke.aliceuid, true);
    const second = buddy.planBuddyXp({
        convo: convo,
        match: { spoke: { aliceuid: true } },
        message: { text: 'hi', senderUid: 'bobuidxx' },
        senderUid: 'bobuidxx',
        messageId: 'm2',
        users: { aliceuid: {}, bobuidxx: {} },
        now: NOW,
    });
    assert.deepStrictEqual(second.awards.map(function (row) { return row.uid; }).sort(), ['aliceuid', 'bobuidxx']);
    assert.strictEqual(second.awards[0].amount, 20);
    const cooled = buddy.planBuddyXp({
        convo: convo,
        match: { spoke: { aliceuid: true } },
        message: { text: 'hi', senderUid: 'bobuidxx' },
        senderUid: 'bobuidxx',
        messageId: 'm3',
        users: { aliceuid: { buddyXpGrantedAt: NOW - DAY }, bobuidxx: {} },
        now: NOW,
    });
    assert.deepStrictEqual(cooled.awards.map(function (row) { return row.uid; }), ['bobuidxx']);
    const bot = buddy.planBuddyXp({
        convo: convo,
        match: {},
        message: { text: 'welcome', senderUid: 'nacho-bot', isNachoAuto: true },
        senderUid: 'nacho-bot',
        messageId: 'welcome',
        users: {},
        now: NOW,
    });
    assert.strictEqual(bot.skip, 'bot');
});

test('quiet matches expire after 30 days and pool entries after 7', function () {
    assert.strictEqual(buddy.matchExpired({ matchedAtMs: NOW - 31 * DAY, spoke: {} }, NOW), true);
    assert.strictEqual(buddy.matchExpired({ matchedAtMs: NOW - 31 * DAY, spoke: { aliceuid: true } }, NOW), false);
    assert.strictEqual(buddy.matchExpired({ matchedAtMs: NOW - 2 * DAY, spoke: {} }, NOW), false);
    assert.strictEqual(buddy.poolExpired({ joinedAtMs: NOW - 8 * DAY }, NOW), true);
    assert.strictEqual(buddy.poolExpired({ joinedAtMs: NOW - DAY }, NOW), false);
    assert.strictEqual(buddy.poolExpired({}, NOW), true);
    assert.strictEqual(buddy.poolExpired({ joinedAt: { seconds: Math.floor((NOW - 8 * DAY) / 1000) } }, NOW), true);
    assert.strictEqual(buddy.poolExpired({ joinedAt: { seconds: Math.floor((NOW - DAY) / 1000) } }, NOW), false);
});

test('nostr and lightning uids can request a buddy', function () {
    const nostr = 'nostr:' + 'a'.repeat(64);
    const ln = 'ln:' + 'b'.repeat(66);
    assert.ok(buddy.UID_RE.test(nostr));
    assert.ok(buddy.UID_RE.test(ln));
    const plan = buddy.buildMatchPlan({
        uid: nostr,
        level: 'beginner',
        goal: 'learn',
        intro: '',
        now: NOW,
        user: { username: 'NostrPlebs', blockedUsers: [] },
        rate: null,
        candidates: [],
    });
    assert.strictEqual(plan.status, 'waiting');
    assert.strictEqual(plan.pool.uid, nostr);
    const lnPlan = buddy.buildMatchPlan({
        uid: ln,
        level: 'advanced',
        goal: 'teach',
        intro: '',
        now: NOW,
        user: { username: 'Lightning', blockedUsers: [] },
        rate: null,
        candidates: [],
    });
    assert.strictEqual(lnPlan.status, 'waiting');
});

test('a missing match clears the stale pointer and an existing chat is merged', function () {
    assert.strictEqual(buddy.pointerIsDangling('alice_bob', false), true);
    assert.strictEqual(buddy.pointerIsDangling('alice_bob', true), false);
    assert.strictEqual(buddy.pointerIsDangling('', false), false);
    const plan = buddy.buildMatchPlan({
        uid: 'aliceuid',
        level: 'beginner',
        goal: 'learn',
        intro: '',
        now: NOW,
        user: { username: 'Alice', blockedUsers: [], activeBuddyId: 'aliceuid_goneuser' },
        rate: null,
        staleActiveId: 'aliceuid_goneuser',
        activeMatch: null,
        candidates: [],
    });
    assert.strictEqual(plan.status, 'waiting');
    assert.strictEqual(plan.clearStaleActive, true);
    const full = {
        participants: ['aliceuid', 'bobuidxx'],
        participantNames: { aliceuid: 'Alice' },
        isBuddyMatch: true,
        buddyMatchId: 'aliceuid_bobuidxx',
        lastMessage: 'hello',
        lastSenderUid: 'aliceuid',
    };
    assert.deepStrictEqual(buddy.convoPatch(true, full), {
        isBuddyMatch: true,
        buddyMatchId: 'aliceuid_bobuidxx',
    });
    assert.strictEqual(buddy.convoPatch(false, full).lastMessage, 'hello');
});

test('buddy xp remembers only a short list of message ids', function () {
    const ids = [];
    for (let i = 0; i < 30; i++) ids.push('m' + i);
    const capped = buddy.planBuddyXp({
        convo: { isBuddyMatch: true, participants: ['aliceuid', 'bobuidxx'] },
        match: { recentMessageIds: ids, spoke: { bobuidxx: true }, xpPaid: { bobuidxx: true } },
        message: { text: 'again', senderUid: 'aliceuid' },
        senderUid: 'aliceuid',
        messageId: 'm-new',
        users: { aliceuid: {}, bobuidxx: { buddyXpGrantedAt: NOW } },
        now: NOW,
    });
    assert.ok(capped.recentIds.length <= buddy.SEEN_CAP);
    assert.ok(capped.recentIds.indexOf('m-new') !== -1);
    assert.ok(capped.recentIds.indexOf('m0') === -1);
    const replay = buddy.planBuddyXp({
        convo: { isBuddyMatch: true, participants: ['aliceuid', 'bobuidxx'] },
        match: { recentMessageIds: capped.recentIds },
        message: { text: 'again', senderUid: 'aliceuid' },
        senderUid: 'aliceuid',
        messageId: 'm-new',
        users: {},
        now: NOW,
    });
    assert.strictEqual(replay.skip, 'seen');
});

test('Buddy Up depends on a real buddy match count', function () {
    const rule = badgeRules.ruleFor('dm_buddy');
    assert.strictEqual(rule.source.field, 'buddyMatchCount');
    assert.strictEqual(rule.source.gte, 1);
    assert.strictEqual(badgeRules.meets(rule, { dmCount: 50, buddyMatchCount: 0 }, {}), false);
    assert.strictEqual(badgeRules.meets(rule, { buddyMatchCount: 1 }, {}), true);
    assert.ok(familyFor('buddyMatchCount').indexOf('dm_buddy') !== -1);
    assert.ok(familyFor('dmCount').indexOf('dm_buddy') === -1);
});

test('cleanup lists the eight April 2026 matches and empty buddy conversations', function () {
    const matches = [];
    for (let i = 0; i < 8; i++) {
        matches.push({
            id: 'april_match_' + i,
            data: {
                matchedAtMs: Date.parse('2026-04-0' + ((i % 9) + 1) + 'T00:00:00Z') || Date.parse('2026-04-15T00:00:00Z'),
                user1: { uid: 'u' + i + 'aaaa' },
                user2: { uid: 'v' + i + 'bbbb' },
            },
        });
    }
    matches[7].data.matchedAtMs = Date.parse('2026-04-20T00:00:00Z');
    matches.push({
        id: 'may_match',
        data: { matchedAtMs: Date.parse('2026-05-02T00:00:00Z'), user1: { uid: 'lateraaa' }, user2: { uid: 'laterbbb' } },
    });
    const conversations = [
        { id: 'empty_one', data: { isBuddyMatch: true, participants: ['u0aaaa', 'v0bbbb'] }, messages: [{ senderUid: 'nacho-bot', isNachoAuto: true }] },
        { id: 'lived_one', data: { isBuddyMatch: true, participants: ['u1aaaa', 'v1bbbb'] }, messages: [{ senderUid: 'u1aaaa', text: 'hi' }] },
        { id: 'not_buddy', data: { isBuddyMatch: false, participants: ['u2aaaa'] }, messages: [] },
    ];
    const plan = cleanup.planCleanup(matches, conversations);
    assert.strictEqual(plan.matches.length, 8);
    assert.ok(plan.matches.every(function (row) { return cleanup.isApril2026Match(matches.find(function (item) { return item.id === row.id; }).data); }));
    assert.deepStrictEqual(plan.conversations.map(function (row) { return row.id; }), ['empty_one']);
});

test('client does not render buddy text as HTML or award its own XP', function () {
    const src = read('bitcoin-buddy.js');
    assert.strictEqual(src.indexOf('innerHTML'), -1);
    assert.strictEqual(src.indexOf('onclick'), -1);
    assert.strictEqual(src.indexOf('awardPoints'), -1);
    assert.strictEqual(src.indexOf("collection('buddy_pool').get"), -1);
    assert.strictEqual(src.indexOf('collection("buddy_pool").get'), -1);
    assert.ok(src.indexOf('requestBuddyMatch') !== -1);
    assert.ok(src.indexOf('leaveBuddyPool') !== -1);
    assert.ok(src.indexOf('endBuddy') !== -1);
    assert.ok(src.indexOf('Never share keys or seed words, and never send money.') !== -1);
    assert.ok(src.indexOf('You have been waiting') !== -1);
    assert.ok(src.indexOf('notifies your buddy') !== -1);
    const rules = read('firestore.rules');
    const pool = rules.slice(rules.indexOf('match /buddy_pool/'), rules.indexOf('match /faucet_invoices/'));
    assert.ok(pool.indexOf('allow create, update: if false') !== -1);
    assert.ok(pool.indexOf('allow list: if false') !== -1);
    const matches = rules.slice(rules.indexOf('match /buddy_matches/'), rules.indexOf('match /timechain_viewers/'));
    assert.ok(matches.indexOf('allow create, update, delete: if false') !== -1);
    assert.ok(rules.indexOf("'buddyMatchCount'") !== -1);
    assert.ok(rules.indexOf("'buddyXpGrantedAt'") !== -1);
    assert.ok(rules.indexOf("'activeBuddyId'") !== -1);
    const app = read('app.js');
    const buddyRow = app.slice(app.indexOf("id: '_buddy'"), app.indexOf("id: '_certs'"));
    const findRow = app.slice(app.indexOf("id: '_buddyfind'"), app.indexOf("id: '_favor'"));
    assert.ok(buddyRow.indexOf('showBuddyFinder') !== -1);
    assert.ok(findRow.indexOf('showBuddyFinder') !== -1);
    assert.strictEqual(buddyRow.indexOf("renderChatHub('global')"), -1);
    assert.strictEqual(findRow.indexOf("renderChatHub('global')"), -1);
    const messaging = read('messaging.js');
    assert.strictEqual(messaging.indexOf('Nacho will jump in'), -1);
    const badge = read('badges.js');
    assert.strictEqual(badge.indexOf("localStorage.getItem('btc_buddy_matched')"), -1);
    assert.ok(badge.indexOf('buddyMatchCount') !== -1);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
