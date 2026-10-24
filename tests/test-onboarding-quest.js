// Onboarding quest grants and username policy. No Firebase.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    decideGrant,
    planGuestMerge,
    planDailyGrant,
    catalogTotals,
    stepsForMode,
    NONCE_MAX_AGE_MS,
    GUEST_MAX_AGE_MS,
} = require('../functions/src/onboardingQuest');
const { assessUsername, reservationBlocks, HOLD_MS, ANON_SQUAT_MS } = require('../functions/src/usernamePolicy');
const { groupUsernames } = require('../functions/scripts/backfill_usernames');
const { networkRateDocIdFromSecret } = require('../functions/src/rateLimitSalt');

const FRESH = { nonceAgeMs: 1000, guestAgeMs: 1000 };

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

test('a client completed flag with no evidence grants nothing', function () {
    const out = decideGrant({
        stepId: 'first_quiz',
        mode: 'advanced',
        completed: true,
        pts: 99999,
        tickets: 50,
        evidence: {},
        ledger: {},
    });
    assert.strictEqual(out.ok, false);
    assert.strictEqual(out.error, 'not_verified');
    assert.strictEqual(out.awarded, 0);
    assert.strictEqual(out.tickets, 0);
});

test('verified channel step grants the catalog amount once', function () {
    const out = decideGrant({
        stepId: 'pick_topic',
        mode: 'advanced',
        pts: 99999,
        tickets: 50,
        completed: true,
        evidence: { channel: true },
        ledger: {},
    });
    assert.deepStrictEqual(
        { ok: out.ok, awarded: out.awarded, tickets: out.tickets, already: out.already },
        { ok: true, awarded: 25, tickets: 0, already: false }
    );
});

test('a second grant of the same step is idempotent', function () {
    const out = decideGrant({
        stepId: 'pick_topic',
        mode: 'advanced',
        evidence: { channel: true },
        pts: 99999,
        ledger: { steps: { pick_topic: { granted: true } } },
    });
    assert.strictEqual(out.ok, true);
    assert.strictEqual(out.already, true);
    assert.strictEqual(out.awarded, 0);
    assert.strictEqual(out.tickets, 0);
});

test('unknown step and a step outside the mode are rejected', function () {
    assert.strictEqual(decideGrant({ stepId: 'free_money', evidence: { channel: true } }).error, 'unknown_step');
    const spin = decideGrant({
        stepId: 'spin_wheel',
        mode: 'beginner',
        evidence: { spin: true },
        ledger: {},
    });
    assert.strictEqual(spin.error, 'not_in_mode');
    assert.strictEqual(spin.awarded, 0);
});

test('quiz evidence grants 50 XP and 2 tickets and can complete beginner', function () {
    const ledger = {
        steps: {
            pick_topic: { granted: true },
            find_nacho: { granted: true },
        },
    };
    const out = decideGrant({
        stepId: 'first_quiz',
        mode: 'beginner',
        evidence: { quiz: true },
        tickets: 50,
        ledger: ledger,
    });
    assert.strictEqual(out.awarded, 50);
    assert.strictEqual(out.tickets, 2);
    assert.strictEqual(out.complete, true);
    assert.deepStrictEqual(stepsForMode('beginner'), ['pick_topic', 'find_nacho', 'first_quiz']);
    assert.strictEqual(catalogTotals('advanced').pts, 150);
    assert.strictEqual(catalogTotals('advanced').tickets, 2);
});

test('guest merge ignores client points and caps server points', function () {
    const spoof = planGuestMerge(Object.assign({
        nonce: 'a'.repeat(32),
        storedNonce: 'a'.repeat(32),
        callerUid: 'realUser123456',
        serverPoints: 40,
        serverTickets: 3,
        serverChannels: 2,
        clientPoints: 99999,
    }, FRESH));
    assert.strictEqual(spoof.points, 40);
    assert.strictEqual(spoof.tickets, 3);
    const capped = planGuestMerge(Object.assign({
        nonce: 'b'.repeat(32),
        storedNonce: 'b'.repeat(32),
        callerUid: 'realUser123456',
        serverPoints: 9000,
        clientPoints: 1,
    }, FRESH));
    assert.strictEqual(capped.points, 500);
    assert.strictEqual(planGuestMerge(Object.assign({ nonce: 'nope', storedNonce: 'other-value-long-enough' }, FRESH)).ok, false);
    const again = planGuestMerge({
        nonce: 'c'.repeat(32),
        storedNonce: 'c'.repeat(32),
        callerUid: 'realUser123456',
        mergedInto: 'realUser123456',
        serverPoints: 100,
        nonceAgeMs: NONCE_MAX_AGE_MS + 5000,
    });
    assert.strictEqual(again.already, true);
    assert.strictEqual(again.points, 0);
});

test('guest link expires, allows one merge, and rejects an old guest', function () {
    const base = {
        nonce: 'd'.repeat(32),
        storedNonce: 'd'.repeat(32),
        callerUid: 'realUser123456',
        serverPoints: 10,
    };
    assert.strictEqual(planGuestMerge(Object.assign({}, base, { nonceAgeMs: NONCE_MAX_AGE_MS + 1, guestAgeMs: 1000 })).error, 'expired');
    assert.strictEqual(planGuestMerge(Object.assign({}, base, { guestAgeMs: 1000 })).error, 'expired');
    assert.strictEqual(planGuestMerge(Object.assign({}, base, { nonceAgeMs: -1, guestAgeMs: 1000 })).error, 'expired');
    assert.strictEqual(planGuestMerge(Object.assign({}, base, FRESH, { guestAgeMs: GUEST_MAX_AGE_MS + 1 })).error, 'guest_too_old');
    assert.strictEqual(planGuestMerge(Object.assign({}, base, { nonceAgeMs: 1000 })).error, 'guest_too_old');
    assert.strictEqual(planGuestMerge(Object.assign({}, base, FRESH, { destMergedFromGuest: true })).error, 'one_guest');
    assert.strictEqual(planGuestMerge(Object.assign({}, base, FRESH)).ok, true);
});

test('quest XP uses the shared taper and does not redeem a bank', function () {
    const split = planDailyGrant({ dailyUsed: 490, amount: 25, pendingOverflow: 0, lastOverflowDate: '', today: '2026-10-22' });
    assert.strictEqual(split.awarded, 17);
    assert.strictEqual(split.overflowAdded, 0);
    assert.strictEqual(split.pointsOut, 17);
    const redeem = planDailyGrant({ dailyUsed: 0, amount: 25, pendingOverflow: 40, lastOverflowDate: '2026-10-21', today: '2026-10-22' });
    assert.strictEqual(redeem.overflowRedeemed, 0);
    assert.strictEqual(redeem.awarded, 25);
    assert.strictEqual(redeem.pointsOut, 25);
    assert.strictEqual(redeem.touchOverflow, false);
    const full = planDailyGrant({ dailyUsed: 1000, amount: 500, pendingOverflow: 0, today: '2026-10-22' });
    assert.strictEqual(full.awarded, 0);
    assert.strictEqual(full.overflowAdded, 0);
    assert.strictEqual(full.pointsOut, 0);
});

test('usernames reject html, profanity, short names, and duplicates', function () {
    assert.strictEqual(assessUsername('<b>bob</b>', {}).error, 'html');
    assert.strictEqual(assessUsername('a&lt;b', {}).error, 'html');
    assert.strictEqual(assessUsername('shithead', {}).error, 'profanity');
    assert.strictEqual(assessUsername('ab', {}).error, 'short');
    assert.strictEqual(assessUsername('bob', { taken: true }).error, 'taken');
    const same = assessUsername('Satoshi', { taken: true, selfHasSame: true });
    assert.strictEqual(same.ok, true);
    assert.strictEqual(same.username_lower, 'satoshi');
});

test('reserved names catch leetspeak, separators, and lookalikes', function () {
    ['N4cho', 'nacho.', 'Admin_', 'n.a.c.h.o', 'NachoBot', 'Satoshi', 'mod', 'm.o.d', 'NEEDcreations2', 'BitcoinQuest1', 'Satoshi_Nakamoto'].forEach(function (name) {
        const out = assessUsername(name, {});
        assert.strictEqual(out.ok, false, name);
        assert.strictEqual(out.error, 'reserved', name);
    });
    assert.strictEqual(assessUsername('N4cho', {}).ok, false);
    const msg = require('../functions/src/usernamePolicy').usernameMessage('reserved');
    assert.strictEqual(msg, 'That name is reserved.');
    assert.strictEqual(assessUsername('modern', {}).ok, true);
    assert.strictEqual(assessUsername('modern2', {}).ok, true);
    assert.strictEqual(assessUsername('Nacho', { allowReserved: true }).ok, true);
    assert.strictEqual(assessUsername('Satoshi', { selfHasSame: true }).ok, true);
    const held = reservationBlocks({ uid: 'other', releasedAt: Date.now() - 1000, holdUid: 'other' }, 'me', Date.now());
    assert.strictEqual(held, true);
    const reclaim = reservationBlocks({ uid: 'me', releasedAt: Date.now() - 1000, holdUid: 'me' }, 'me', Date.now());
    assert.strictEqual(reclaim, false);
    const expiredHold = reservationBlocks({ uid: 'other', releasedAt: Date.now() - HOLD_MS - 1000, holdUid: 'other' }, 'me', Date.now());
    assert.strictEqual(expiredHold, false);
    const squat = reservationBlocks({ uid: 'anon1', anon: true, at: Date.now() - ANON_SQUAT_MS - 1000 }, 'me', Date.now());
    assert.strictEqual(squat, false);
    assert.strictEqual(assessUsername('bob', { renameTooSoon: true }).error, 'rename_limit');
});

test('backfill age is only the last tiebreaker', function () {
    const grouped = groupUsernames([
        { uid: 'u1', lower: 'alice', created: 200, col: 'users' },
        { uid: 'u2', lower: 'alice', created: 100, col: 'users' },
        { uid: 'u3', lower: 'bob', created: 50, col: 'public_profiles' },
    ]);
    assert.strictEqual(grouped.unique.get('alice'), 'u2');
    assert.strictEqual(grouped.unique.get('bob'), 'u3');
    assert.strictEqual(grouped.repicks.length, 1);
    assert.strictEqual(grouped.repicks[0].uid, 'u1');
    assert.strictEqual(grouped.collisions.length, 1);
    const linked = groupUsernames([
        { uid: 'guest', lower: 'alice', created: 100, isAnonymous: true, col: 'users' },
        { uid: 'mail', lower: 'alice', created: 900, email: 'kept-out-of-logs@example.com', col: 'users' },
    ]);
    assert.strictEqual(linked.unique.get('alice'), 'mail');
    assert.strictEqual(linked.repicks[0].uid, 'guest');
    const tied = groupUsernames([
        { uid: 'b', lower: 'sam', created: 5 },
        { uid: 'a', lower: 'sam', created: 5 },
    ]);
    assert.strictEqual(tied.unique.get('sam'), 'a');
    const script = fs.readFileSync(path.join(__dirname, '..', 'functions', 'scripts', 'backfill_usernames.js'), 'utf8');
    assert.ok(script.includes('before the front end ships'));
    assert.ok(script.includes('applied: true'));
    assert.ok(!script.includes('unresolved === 0'));
    assert.ok(!script.includes('collision uids='));
});

test('rules block client writes to reward and onboarding fields', function () {
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    const create = rules.split('allow create:')[1].split('allow update:')[0];
    const update = rules.split('allow update:')[1].split('allow delete:')[0];
    assert.ok(!create.includes("'username'"), 'create still allows username');
    ['username', 'username_lower', 'onboardingQuest', 'nachoQuestDone', 'introSeen', 'guestLinkNonce', 'guestLinkNonceAt', 'usernameChangedAt', 'mergedInto', 'orangeTickets', 'points'].forEach(function (field) {
        assert.ok(update.includes("'" + field + "'"), 'update denylist missing ' + field);
    });
    assert.ok(rules.includes('match /users/{userId}/onboarding_evidence/{docId}'));
    assert.ok(rules.includes('allow write: if false'));
});

test('awardPoints refuses a nacho quest action string', function () {
    const actions = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'awardActions.js'), 'utf8');
    const api = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'onboardingApi.js'), 'utf8');
    const index = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    assert.ok(actions.includes('nacho quest|onboarding quest'));
    assert.ok(api.includes('claimOnboardingQuestStep'));
    assert.ok(index.includes('registerOnboarding'));
    assert.ok(!actions.includes('NACHO_QUESTS'));
});

test('the client quest list matches the server modes', function () {
    const src = fs.readFileSync(path.join(__dirname, '..', 'onboarding.js.src'), 'utf8');
    ['pick_topic', 'send_chat', 'spin_wheel', 'find_nacho', 'first_quiz'].forEach(function (id) {
        assert.ok(src.includes(id), id);
    });
    assert.ok(src.includes('claimOnboardingQuestStep'));
    assert.ok(!src.includes('awardPoints'));
    assert.ok(src.includes("beacon: '#onboardingQuizEntry'"));
    assert.ok(src.includes('z-index:2100001'));
    assert.ok(src.includes('usernameModal'));
    assert.ok(src.includes("Satoshi's Favor"));
    assert.ok(src.includes('id = \'onboardingQuizEntry\''));
});

test('guest merge never writes daily action counts and usernames survive a missing app check', function () {
    const api = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'onboardingApi.js'), 'utf8');
    assert.ok(!api.includes('copied: true'));
    assert.ok(!api.includes("daily_action_counts').doc"));
    assert.ok(api.includes("doc('quiz')"));
    assert.ok(api.includes('done: true'));
    assert.ok(api.includes('guestLinkNonceAt'));
    assert.ok(api.includes('mergedFromGuest'));
    assert.ok(api.includes('points: 0'));
    assert.ok(api.includes('weeklyXP: 0'));
    assert.ok(api.includes('monthlyXP: 0'));
    assert.ok(api.includes('splitDailyXp') === false);
    assert.ok(api.includes('planDailyGrant'));
    assert.ok(api.includes('enforceAppCheck: false'));
    assert.ok(api.includes('username_'));
    assert.ok(api.includes('username_ip_'));
    assert.ok(api.includes('networkRateDocId'));
    assert.ok(api.includes('expireAt: rateExpire'));
    assert.ok(!api.includes('function usernameIpDocId'));
    assert.ok(!api.includes('ip: ip'));
    assert.ok(api.includes('Try again shortly'));
    assert.ok(!api.includes('scanLegacyNames'));
    assert.ok(!api.includes('profileNameOwners'));
    const hashed = networkRateDocIdFromSecret('username_ip_', '203.0.113.9', Date.UTC(2026, 9, 22), 'a'.repeat(32));
    assert.ok(/^username_ip_[a-f0-9]{40}$/.test(hashed), hashed);
    assert.ok(hashed.indexOf('203') === -1 && hashed.indexOf('113') === -1);
    const same = networkRateDocIdFromSecret('username_ip_', '203.0.113.9', Date.UTC(2026, 9, 22), 'a'.repeat(32));
    const nextDay = networkRateDocIdFromSecret('username_ip_', '203.0.113.9', Date.UTC(2026, 9, 23), 'a'.repeat(32));
    assert.strictEqual(hashed, same);
    assert.notStrictEqual(hashed, nextDay);
    const setAt = api.indexOf('async function setUsername');
    const rateAt = api.indexOf("doc('username_' + uid)", setAt);
    const markerAt = api.indexOf("doc('backfill')", setAt);
    assert.ok(setAt > 0 && rateAt > setAt && markerAt > rateAt, 'rate limit runs before the backfill marker read');
    const client = fs.readFileSync(path.join(__dirname, '..', 'ranking.js'), 'utf8');
    assert.ok(client.includes('linkWithPopup'));
    assert.ok(client.includes('linkWithCredential'));
    assert.ok(client.includes('linkWithRedirect'));
    assert.ok(!client.includes('await stashGuestLink'));
    const quests = fs.readFileSync(path.join(__dirname, '..', 'quests.js'), 'utf8');
    assert.ok(!quests.includes('p.displayName || p.username'));
    assert.ok(!quests.includes('u.displayName || u.username'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
