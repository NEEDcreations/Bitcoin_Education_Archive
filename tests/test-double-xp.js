// Double XP window: multiply while active, stop at expiry, extend from the end.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const doubleXp = require('../functions/src/doubleXp');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    }
}

test('an active window doubles and an expired one does not', () => {
    const now = 1_700_000_000_000;
    const active = { doubleXpUntil: now + 60_000 };
    const doubled = doubleXp.boostPoints(100, active, now);
    assert.strictEqual(doubled.points, 200);
    assert.strictEqual(doubled.doubled, true);

    const expired = doubleXp.boostPoints(100, { doubleXpUntil: now - 1 }, now);
    assert.strictEqual(expired.points, 100);
    assert.strictEqual(expired.doubled, false);

    const exact = doubleXp.boostPoints(100, { doubleXpUntil: now }, now);
    assert.strictEqual(exact.points, 100);
    assert.strictEqual(exact.doubled, false);

    const zero = doubleXp.boostPoints(0, active, now);
    assert.strictEqual(zero.points, 0);
    assert.strictEqual(zero.doubled, false);
});

test('buying while active extends, and an expired window starts now', () => {
    const now = 1_700_000_000_000;
    const hour = doubleXp.DOUBLE_XP_MS;
    const extended = doubleXp.extendUntil(now + 10 * 60_000, now, hour);
    assert.strictEqual(extended, now + 10 * 60_000 + hour);
    const fresh = doubleXp.extendUntil(now - 5_000, now, hour);
    assert.strictEqual(fresh, now + hour);
    assert.strictEqual(doubleXp.minutesLeft(extended, now), 70);
});

test('a Firestore timestamp-shaped expiry still counts', () => {
    const now = 1_700_000_000_000;
    const seconds = Math.floor((now + 120_000) / 1000);
    const boosted = doubleXp.boostPoints(50, { doubleXPExpiry: { seconds: seconds, nanoseconds: 0 } }, now);
    assert.strictEqual(boosted.doubled, true);
    assert.strictEqual(boosted.points, 100);
    assert.strictEqual(doubleXp.untilMillis({ doubleXpUntil: String(now + 1000) }), now + 1000);
});

test('one-time awards are not passed through boostPoints', () => {
    const root = path.join(__dirname, '..');
    function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }
    const index = read('functions/index.js');
    const scholar = index.slice(index.indexOf('exports.gradeScholarExam'), index.indexOf('exports.startQuest'));
    assert.ok(scholar.indexOf('boostPoints') === -1);
    assert.ok(scholar.indexOf('planDailyXp') === -1);
    assert.ok(scholar.indexOf('certBonus.planCertBonus') !== -1);
    const donate = index.slice(index.indexOf('exports.donatePoints'), index.indexOf('exports.searchUsers'));
    assert.ok(donate.indexOf('boostPoints') === -1);
    const weekly = index.slice(index.indexOf('exports.incrementWeeklyChallenge'), index.indexOf('exports.spendTickets'));
    assert.ok(weekly.indexOf('boostPoints') === -1);
    const award = index.slice(index.indexOf('exports.awardPoints'), index.indexOf('exports.getFaucetStats'));
    assert.ok(award.indexOf("matchedAction === 'badge_earned'") !== -1);
    assert.ok(award.indexOf('nacho quest') !== -1);
    const gifting = read('functions/src/gifting.js');
    const openGift = gifting.slice(gifting.indexOf('const openGift'), gifting.indexOf('const sendKeys'));
    assert.ok(openGift.indexOf('boostPoints') === -1);
    const decrypt = gifting.slice(gifting.indexOf('const decryptCipher'), gifting.indexOf('const claimCipherWin'));
    assert.ok(decrypt.indexOf('boostPoints') === -1);
    const keys = gifting.slice(gifting.indexOf('const sendKeys'), gifting.indexOf('const decryptCipher'));
    assert.ok(keys.indexOf('boostPoints') !== -1);
    assert.ok(read('functions/src/peerLevel.js').indexOf('boostPoints') === -1);
});

test('trivia and poll awards use boostPoints before the daily taper', () => {
    const root = path.join(__dirname, '..');
    function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }
    const rewardSrc = read('functions/src/questReward.js');
    const grade = rewardSrc.slice(rewardSrc.indexOf('function gradeTrivia'), rewardSrc.indexOf('function gradeQuestSubmission'));
    assert.ok(grade.indexOf('doubleXp.boostPoints(base, src.user, now)') !== -1);
    assert.ok(grade.indexOf('doubleXp.boostPoints(base, src.user, now)') < grade.indexOf('planDailyXp(src.dailyUsed || 0, boost.points)'));
    assert.ok(rewardSrc.slice(rewardSrc.indexOf('function gradeQuestSubmission')).indexOf('boostPoints') === -1);
    const poll = read('functions/src/pollVote.js');
    assert.ok(poll.indexOf('doubleXp.boostPoints(POLL_XP, user, now)') !== -1);
    assert.ok(poll.indexOf('doubleXp.boostPoints(POLL_XP, user, now)') < poll.indexOf('planDailyXp(dailyUsed, boost.points)'));
    const callables = read('functions/src/questCallables.js');
    const gradeCall = callables.slice(callables.indexOf('reward.gradeTrivia({'), callables.indexOf('const awarded = (graded.ok'));
    assert.ok(gradeCall.includes('user: user'));

    const reward = require('../functions/src/questReward');
    const now = 1_700_000_000_000;
    const dayKey = reward.offsetDateKey(now);
    const index = reward.triviaIndexForDay(dayKey);
    const question = reward.triviaQuestion(index);
    const correctText = question.options[question.answer];
    const wrong = question.options.find(function(option) { return option !== correctText; });
    const active = { doubleXpUntil: now + 60_000 };
    const base = { dayKey: dayKey, questionIndex: index, q: question.q, now: now, dailyUsed: 0 };
    const doubled = reward.gradeTrivia(Object.assign({}, base, { chosen: correctText, user: active }));
    assert.strictEqual(doubled.correct, true);
    assert.strictEqual(doubled.pts, 50);
    assert.strictEqual(doubled.awarded, 100);
    const expired = reward.gradeTrivia(Object.assign({}, base, { chosen: correctText, user: { doubleXpUntil: now - 1 } }));
    assert.strictEqual(expired.awarded, 50);
    assert.strictEqual(expired.pts, 50);
    const plain = reward.gradeTrivia(Object.assign({}, base, { chosen: correctText }));
    assert.strictEqual(plain.awarded, 50);
    const quarter = reward.gradeTrivia(Object.assign({}, base, { chosen: correctText, user: active, dailyUsed: 980 }));
    assert.strictEqual(quarter.awarded, 20);
    assert.strictEqual(quarter.pts, 50);
    const missed = reward.gradeTrivia(Object.assign({}, base, { chosen: wrong, user: active }));
    assert.strictEqual(missed.awarded, 0);
    assert.strictEqual(missed.pts, 0);
    const banned = reward.gradeTrivia(Object.assign({}, base, { chosen: correctText, user: active, banned: true }));
    assert.strictEqual(banned.awarded, 0);
});

function voteOnce(user, dailyUsed) {
    const { createPollVote } = require('../functions/src/pollVote');
    const state = { docs: Object.create(null) };
    function applyWrite(pathKey, data, merge) {
        const cur = merge && state.docs[pathKey] ? Object.assign({}, state.docs[pathKey]) : {};
        Object.keys(data || {}).forEach(function(key) {
            const value = data[key];
            if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, '_inc')) {
                cur[key] = (Number(cur[key]) || 0) + value._inc;
            } else {
                cur[key] = value;
            }
        });
        state.docs[pathKey] = cur;
    }
    function ref(pathKey) {
        return {
            path: pathKey,
            get: async function() {
                const data = state.docs[pathKey];
                return { exists: data != null, data: function() { return data; } };
            },
            collection: function(name) {
                return { get: async function() { throw new Error('badge reads stay outside the vote'); }, doc: function(id) { return ref(pathKey + '/' + name + '/' + id); } };
            },
        };
    }
    function col(pathKey) {
        return { doc: function(id) { return ref(pathKey + '/' + id); } };
    }
    const db = {
        collection: function(name) { return col(name); },
        runTransaction: async function(fn) {
            const pending = [];
            const tx = {
                get: async function(docRef) {
                    const data = state.docs[docRef.path];
                    return { exists: data != null, data: function() { return data; } };
                },
                set: function(docRef, data, opts) { pending.push({ path: docRef.path, data: data, merge: !!(opts && opts.merge) }); },
                update: function(docRef, data) { pending.push({ path: docRef.path, data: data, merge: true }); },
            };
            const result = await fn(tx);
            pending.forEach(function(write) { applyWrite(write.path, write.data, write.merge); });
            return result;
        },
    };
    const admin = { firestore: { FieldValue: {
        serverTimestamp: function() { return { _serverTimestamp: true }; },
        increment: function(n) { return { _inc: n }; },
    } } };
    const HttpsError = function(code, message) { const err = new Error(message); err.code = code; return err; };
    const day = require('../functions/src/grantBadge').offsetDateKey(Date.now());
    state.docs['users/voter'] = user;
    if (dailyUsed) state.docs['users/voter/daily_points/' + day] = { total: dailyUsed };
    const pollVote = createPollVote({ admin: admin, db: db, HttpsError: HttpsError });
    return pollVote({ chosenIdx: 0 }, { auth: { uid: 'voter', token: { firebase: { sign_in_provider: 'password' } } } });
}

const pendingAsync = voteOnce({ points: 10, doubleXpUntil: Date.now() + 60_000 }, 0).then(function(active) {
    assert.strictEqual(active.success, true);
    assert.strictEqual(active.already, false);
    assert.strictEqual(active.awarded, 100);
    return voteOnce({ points: 10, doubleXpUntil: 1 }, 0);
}).then(function(expired) {
    assert.strictEqual(expired.awarded, 50);
    return voteOnce({ points: 10, doubleXpUntil: Date.now() + 60_000 }, 980);
}).then(function(quarter) {
    assert.strictEqual(quarter.awarded, 20);
    console.log('✅ dailyPollVote doubles XP with the shared helper, then tapers');
    passed++;
}).catch(function(err) {
    console.log('❌ dailyPollVote doubles XP with the shared helper, then tapers: ' + (err && err.stack ? err.stack : err));
    failed++;
}).then(function() {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
void pendingAsync;
