// Onboarding quest grants and username policy. No Firebase.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    decideGrant,
    planGuestMerge,
    catalogTotals,
    stepsForMode,
} = require('../functions/src/onboardingQuest');
const { assessUsername } = require('../functions/src/usernamePolicy');

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
    const spoof = planGuestMerge({
        nonce: 'a'.repeat(32),
        storedNonce: 'a'.repeat(32),
        callerUid: 'realUser123456',
        serverPoints: 40,
        serverTickets: 3,
        serverChannels: 2,
        clientPoints: 99999,
    });
    assert.strictEqual(spoof.points, 40);
    assert.strictEqual(spoof.tickets, 3);
    const capped = planGuestMerge({
        nonce: 'b'.repeat(32),
        storedNonce: 'b'.repeat(32),
        callerUid: 'realUser123456',
        serverPoints: 9000,
        clientPoints: 1,
    });
    assert.strictEqual(capped.points, 500);
    assert.strictEqual(planGuestMerge({ nonce: 'nope', storedNonce: 'other-value-long-enough' }).ok, false);
    const again = planGuestMerge({
        nonce: 'c'.repeat(32),
        storedNonce: 'c'.repeat(32),
        callerUid: 'realUser123456',
        mergedInto: 'realUser123456',
        serverPoints: 100,
    });
    assert.strictEqual(again.already, true);
    assert.strictEqual(again.points, 0);
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

test('rules block client writes to reward and onboarding fields', function () {
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    const create = rules.split('allow create:')[1].split('allow update:')[0];
    const update = rules.split('allow update:')[1].split('allow delete:')[0];
    assert.ok(!create.includes("'username'"), 'create still allows username');
    ['username', 'username_lower', 'onboardingQuest', 'nachoQuestDone', 'introSeen', 'guestLinkNonce', 'mergedInto', 'orangeTickets', 'points'].forEach(function (field) {
        assert.ok(update.includes("'" + field + "'"), 'update denylist missing ' + field);
    });
    assert.ok(rules.includes('match /users/{userId}/onboarding_evidence/{docId}'));
    assert.ok(rules.includes('allow write: if false'));
});

test('awardPoints refuses a nacho quest action string', function () {
    const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    assert.ok(src.includes('nacho quest|onboarding quest'));
    assert.ok(src.includes('claimOnboardingQuestStep'));
});

test('the client quest list matches the server modes', function () {
    const src = fs.readFileSync(path.join(__dirname, '..', 'onboarding.js.src'), 'utf8');
    ['pick_topic', 'send_chat', 'spin_wheel', 'find_nacho', 'first_quiz'].forEach(function (id) {
        assert.ok(src.includes(id), id);
    });
    assert.ok(src.includes('claimOnboardingQuestStep'));
    assert.ok(!src.includes('awardPoints'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
