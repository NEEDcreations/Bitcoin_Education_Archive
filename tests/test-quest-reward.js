// Server grading for daily trivia and quiz quests. No Firebase.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const reward = require('../functions/src/questReward');
const dailyXp = require('../functions/src/dailyXp');
const rewardNotify = require('../functions/src/rewardNotify');
const { buildBanks } = require('../functions/build-reward-banks');

const root = path.join(__dirname, '..');

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

function read(rel) {
    return fs.readFileSync(path.join(root, rel), 'utf8');
}

const NOW = Date.parse('2026-10-22T12:00:00Z');
const DAY = reward.offsetDateKey(NOW);

function triviaPayload(chosen, extra) {
    const src = {
        dayKey: DAY,
        questionIndex: reward.triviaIndexForDay(DAY),
        chosen: chosen,
        now: NOW,
        dailyUsed: 0,
    };
    if (extra) Object.keys(extra).forEach(function(key) { src[key] = extra[key]; });
    return src;
}

function answersFor(topicKey, questIndex, pick) {
    return reward.questionsFor(topicKey, questIndex).map(function(question) {
        const chosen = pick(question);
        return {
            q: question.q,
            topicKey: topicKey,
            questIndex: questIndex,
            chosen: chosen,
            answer: 0,
            correct: question.a,
            keys: [0, 0, 0, 0, 0],
        };
    });
}

test('daily quiz and trivia cap is the grading-path cap of 500', function() {
    assert.strictEqual(reward.DAILY_QUIZ_XP_CAP, 500);
    assert.strictEqual(dailyXp.DAILY_POINTS_CAP, 500);
    assert.strictEqual(reward.offsetDateKey(NOW), '2026-10-22');
    if (reward.triviaLength() === 158) {
        assert.strictEqual(reward.triviaIndexForDay(DAY), 134);
    }
});

test('a wrong trivia answer gets no reward', function() {
    const index = reward.triviaIndexForDay(DAY);
    const question = reward.triviaQuestion(index);
    assert.ok(question, 'today trivia question');
    const correctText = question.options[question.answer];
    const wrong = question.options.find(function(option) { return option !== correctText; });
    const missed = reward.gradeTrivia(triviaPayload(wrong));
    assert.strictEqual(missed.ok, true);
    assert.strictEqual(missed.correct, false);
    assert.strictEqual(missed.awarded, 0);
    assert.strictEqual(missed.pts, 0);
    assert.strictEqual(missed.reason, 'incorrect');

    const byIndex = reward.gradeTrivia(triviaPayload(question.answer));
    assert.strictEqual(byIndex.correct, false);
    assert.strictEqual(byIndex.awarded, 0);

    const forged = reward.gradeTrivia(triviaPayload({
        text: wrong,
        answer: question.answer,
        correct: true,
        index: question.answer,
    }));
    assert.strictEqual(forged.correct, false);
    assert.strictEqual(forged.awarded, 0);

    const otherDay = reward.gradeTrivia(triviaPayload(correctText, { questionIndex: index + 1 }));
    assert.strictEqual(otherDay.ok, false);
    assert.strictEqual(otherDay.awarded, 0);

    const right = reward.gradeTrivia(triviaPayload(correctText));
    assert.strictEqual(right.correct, true);
    assert.strictEqual(right.awarded, 50);
    assert.strictEqual(right.pts, 50);
});

test('banned accounts and the daily cap hold for trivia', function() {
    const question = reward.triviaQuestion(reward.triviaIndexForDay(DAY));
    const correctText = question.options[question.answer];
    const banned = reward.gradeTrivia(triviaPayload(correctText, { banned: true }));
    assert.strictEqual(banned.correct, true);
    assert.strictEqual(banned.awarded, 0);
    assert.strictEqual(banned.reason, 'banned');
    assert.strictEqual(reward.isRewardBanned({ satsDisabled: true }, null), true);
    assert.strictEqual(reward.isRewardBanned({}, { banned: true }), true);
    assert.strictEqual(reward.isRewardBanned({}, { banned: false }), false);

    const capped = reward.gradeTrivia(triviaPayload(correctText, { dailyUsed: 500 }));
    assert.strictEqual(capped.awarded, 0);
    assert.strictEqual(capped.overflowAdded, 50);
    assert.strictEqual(capped.capped, true);
    const partial = reward.gradeTrivia(triviaPayload(correctText, { dailyUsed: 480 }));
    assert.strictEqual(partial.awarded, 20);
    assert.strictEqual(partial.overflowAdded, 30);
});

test('forged quiz keys are ignored and grading uses answer text', function() {
    const part = reward.questionsFor('whitepaper', 1);
    assert.strictEqual(part.length, 5);
    const wrong = answersFor('whitepaper', 1, function(question) {
        return question.wrong[0];
    });
    const forged = reward.gradeQuestSubmission({
        topicKey: 'whitepaper',
        questIndex: 1,
        keys: wrong.map(function(row) { return row.correct; }),
        answer: 0,
        answers: wrong,
    });
    assert.strictEqual(forged.ok, true);
    assert.strictEqual(forged.score, 0);
    assert.strictEqual(forged.pts, 0);
    assert.strictEqual(forged.completeSet, true);

    const positional = answersFor('whitepaper', 1, function() { return 0; });
    const byPosition = reward.gradeQuestSubmission({
        topicKey: 'whitepaper',
        questIndex: 1,
        answers: positional,
    });
    assert.strictEqual(byPosition.score, 0);
    assert.strictEqual(byPosition.pts, 0);

    const byOptionId = reward.questionsFor('whitepaper', 1).map(function(question) {
        return {
            q: question.q,
            topicKey: 'whitepaper',
            questIndex: 1,
            chosen: '',
            optionId: reward.optionId(question.a),
            answer: 0,
        };
    });
    const identified = reward.gradeQuestSubmission({ answers: byOptionId });
    assert.strictEqual(identified.score, 5);
    assert.strictEqual(identified.pts, 100);
    assert.strictEqual(identified.completionKey, 'quest_whitepaper__2');
});

test('a perfect part 2 still pays after part 1 was perfected', function() {
    const correct = answersFor('whitepaper', 1, function(question) { return question.a; });
    const graded = reward.gradeQuestSubmission({
        topicKey: 'whitepaper',
        questIndex: 1,
        keys: [0, 0, 0, 0, 0],
        answers: correct,
    });
    assert.strictEqual(graded.score, 5);
    assert.strictEqual(graded.pts, 100);
    assert.strictEqual(graded.completionKey, 'quest_whitepaper__2');

    const paid = reward.settleQuizReward({
        graded: graded,
        dailyUsed: 0,
        questsToday: 0,
        banned: false,
        alreadyPerfect: false,
    });
    assert.strictEqual(paid.awarded, 100);
    assert.strictEqual(paid.overflowAdded, 0);
    assert.strictEqual(paid.completionKey, 'quest_whitepaper__2');
    assert.strictEqual(paid.reason, '');

    const part1 = reward.gradeQuestSubmission({
        answers: answersFor('whitepaper', 0, function(question) { return question.a; }),
    });
    assert.strictEqual(part1.completionKey, 'quest_whitepaper__1');
    const blocked = reward.settleQuizReward({
        graded: part1,
        dailyUsed: 0,
        questsToday: 0,
        banned: false,
        alreadyPerfect: true,
    });
    assert.strictEqual(blocked.awarded, 0);
    assert.strictEqual(blocked.pts, 0);
    assert.strictEqual(blocked.reason, 'already-perfect');
    assert.strictEqual(blocked.completionKey, '');
});

test('the daily quiz cap holds and banned accounts are paid nothing', function() {
    const graded = reward.gradeQuestSubmission({
        answers: answersFor('whitepaper', 1, function(question) { return question.a; }),
    });
    const full = reward.settleQuizReward({
        graded: graded,
        dailyUsed: 500,
        questsToday: 0,
        banned: false,
        alreadyPerfect: false,
    });
    assert.strictEqual(full.awarded, 0);
    assert.strictEqual(full.overflowAdded, 100);
    assert.strictEqual(full.capped, true);
    assert.strictEqual(full.pts, 100);

    const room = reward.settleQuizReward({
        graded: graded,
        dailyUsed: 450,
        questsToday: 0,
        banned: false,
        alreadyPerfect: false,
    });
    assert.strictEqual(room.awarded, 50);
    assert.strictEqual(room.overflowAdded, 50);
    assert.strictEqual(room.capped, true);

    const banned = reward.settleQuizReward({
        graded: graded,
        dailyUsed: 0,
        questsToday: 0,
        banned: true,
        alreadyPerfect: false,
    });
    assert.strictEqual(banned.awarded, 0);
    assert.strictEqual(banned.overflowAdded, 0);
    assert.strictEqual(banned.reason, 'banned');
    assert.strictEqual(banned.countQuest, false);
    assert.strictEqual(banned.completionKey, '');
});

test('an old server completion key blocks that part and nothing else', function() {
    const part1 = reward.gradeQuestSubmission({
        answers: answersFor('whitepaper', 0, function(question) { return question.a; }),
    });
    const part2 = reward.gradeQuestSubmission({
        answers: answersFor('whitepaper', 1, function(question) { return question.a; }),
    });
    assert.strictEqual(reward.legacyPartRecorded(['quest_whitepaper'], 'whitepaper', 0), true);
    assert.strictEqual(reward.legacyPartRecorded(['quest_whitepaper'], 'whitepaper', 1), false);
    assert.strictEqual(reward.legacyPartRecorded(['quest_whitepaper__1'], 'whitepaper', 0), true);
    assert.strictEqual(reward.legacyPartRecorded(['quest_whitepaper__2'], 'whitepaper', 1), true);
    assert.strictEqual(reward.legacyPartRecorded(['quest_whitepaper__2'], 'whitepaper', 0), false);
    assert.strictEqual(reward.legacyPartRecorded(['q__whitepaper__1'], 'whitepaper', 0), false);

    function settle(graded, completed) {
        return reward.settleQuizReward({
            graded: graded,
            dailyUsed: 0,
            questsToday: 0,
            banned: false,
            alreadyPerfect: reward.legacyPartRecorded(completed, graded.topicKey, graded.questIndex),
        });
    }
    const blocked = settle(part1, ['quest_whitepaper']);
    assert.strictEqual(blocked.awarded, 0);
    assert.strictEqual(blocked.pts, 0);
    assert.strictEqual(blocked.reason, 'already-perfect');
    assert.strictEqual(blocked.completionKey, '');

    const part2Blocked = settle(part2, ['quest_whitepaper__2']);
    assert.strictEqual(part2Blocked.awarded, 0);
    assert.strictEqual(part2Blocked.reason, 'already-perfect');

    const part2Paid = settle(part2, ['quest_whitepaper', 'q__whitepaper__2']);
    assert.strictEqual(part2Paid.awarded, 100);
    assert.strictEqual(part2Paid.completionKey, 'quest_whitepaper__2');

    const clientIdOnly = settle(part1, ['q__whitepaper__1']);
    assert.strictEqual(clientIdOnly.awarded, 100);
    assert.strictEqual(clientIdOnly.completionKey, 'quest_whitepaper__1');
});

test('the functions bank matches the client trivia, quiz, and learning files', function() {
    const fresh = buildBanks();
    const committed = JSON.parse(read('functions/reward-banks.json'));
    assert.deepStrictEqual(fresh, committed);
    assert.ok(fresh.learning['what-is-bitcoin'].length >= 5);
    assert.ok(fresh.quests.whitepaper.length >= 10);
    assert.ok(fresh.trivia.length > 0);
});

test('callables enforce App Check, bans, and rate limits, and ignore client keys', function() {
    const callables = read('functions/src/questCallables.js');
    const index = read('functions/index.js');
    const quests = read('quests.js');
    assert.ok(callables.includes('enforceAppCheck: true'));
    assert.ok(callables.includes('faucet_ledger'));
    assert.ok(callables.includes('isRewardBanned'));
    assert.ok(callables.includes('rate_limits'));
    assert.ok(callables.includes("require('./rewardNotify')"));
    assert.ok(callables.includes('quest_completions'));
    assert.ok(callables.includes('claimDoc.data().correct === true'));
    assert.ok(callables.includes('reward.legacyPartRecorded(user.completedQuests, graded.topicKey, graded.questIndex)'));
    assert.strictEqual(callables.includes('completedQuests:'), false);
    assert.strictEqual(callables.includes('quest_answer_keys'), false);
    assert.ok(index.includes('Quiz and trivia rewards are graded on the server'));
    assert.strictEqual(index.includes("'trivia_correct': 50"), false);
    assert.strictEqual(index.includes("'quest_complete': 100"), false);
    assert.ok(quests.includes("httpsCallable('answerTrivia')"));
    assert.ok(quests.includes("httpsCallable('gradeQuest')"));
    assert.ok(quests.includes('chosen: chosenText'));
    assert.ok(quests.includes('typeof serverData.awarded === \'number\''));
    assert.strictEqual(quests.includes('Trivia Quest correct'), false);
    assert.strictEqual(quests.includes("httpsCallable('startQuest')"), false);
    assert.ok(quests.includes('Trivia updated, please refresh'));
    assert.ok(quests.includes('data/trivia-bank.js?v=20261022_v2270'));
    assert.ok(read('patch-notes.html').includes('Quiz and trivia rewards are now checked by the server, and Part 2 quizzes pay out correctly again.'));
    assert.ok(read('firestore.rules').includes('quest_completions'));
});

function callableBody(src, name) {
    const start = src.indexOf('const ' + name + ' = onCall');
    assert.ok(start >= 0, name + ' missing');
    let end = src.length;
    ['answerTrivia', 'gradeQuest', 'startQuest'].forEach(function(other) {
        if (other === name) return;
        const at = src.indexOf('const ' + other + ' = onCall');
        if (at > start && at < end) end = at;
    });
    return src.slice(start, end);
}

function assertReadsBeforeWrites(body, name) {
    const rankAt = body.indexOf('readRankPrev');
    const rateAt = body.indexOf('applyRate(');
    const applyAt = body.indexOf('rewardNotify.apply');
    assert.ok(rankAt > 0, name + ' reads rank notices');
    assert.ok(rankAt < rateAt, name + ' reads rank notices before the rate write');
    assert.ok(applyAt > rateAt, name + ' writes the notification after the payout');
    assert.strictEqual(/tx\.(set|update)\(/.test(body.slice(0, rankAt)), false, name + ' writes before readRankPrev');
}

test('answerTrivia and gradeQuest each write a reward notification', function() {
    const callables = read('functions/src/questCallables.js');
    const trivia = callableBody(callables, 'answerTrivia');
    const quest = callableBody(callables, 'gradeQuest');
    assertReadsBeforeWrites(trivia, 'answerTrivia');
    assertReadsBeforeWrites(quest, 'gradeQuest');
    assert.ok(trivia.includes("onceKey: 'trivia_' + dayKey"));
    assert.ok(trivia.includes("sourceLabel: 'daily trivia'"));
    assert.ok(trivia.includes("icon: '🧠'"));
    assert.ok(quest.includes("onceKey: 'quest_' + dayKey + '_' + (questsToday + 1)"));
    assert.ok(quest.includes("sourceLabel: 'a quest'"));
    assert.ok(quest.includes("icon: '🏆'"));
    assert.ok(trivia.includes('try {') && trivia.includes('rewardNotify.apply'));
    assert.ok(quest.includes('try {') && quest.includes('rewardNotify.apply'));

    const writes = [];
    const tx = {
        set: function(ref, data) { writes.push({ path: ref.path, data: data }); },
    };
    const db = {
        collection: function(name) {
            return { doc: function(id) { return { path: name + '/' + (id || 'auto') }; } };
        },
    };
    function capture(spec) {
        const before = writes.length;
        rewardNotify.apply(tx, db, { seconds: 1 }, rewardNotify.plan(spec));
        return writes.slice(before);
    }
    const triviaWrites = capture({
        uid: 'alice',
        onceKey: 'trivia_2026-10-22',
        xp: 50,
        sourceLabel: 'daily trivia',
        icon: '🧠',
        pointsBefore: 300000,
        pointsDelta: 50,
        prevById: {},
    });
    const questWrites = capture({
        uid: 'alice',
        onceKey: 'quest_2026-10-22_1',
        xp: 100,
        sourceLabel: 'a quest',
        icon: '🏆',
        pointsBefore: 300000,
        pointsDelta: 100,
        prevById: {},
    });
    assert.strictEqual(triviaWrites.length, 1);
    assert.strictEqual(questWrites.length, 1);
    assert.ok(triviaWrites[0].path.indexOf('notifications/') === 0);
    assert.ok(questWrites[0].path.indexOf('notifications/') === 0);
    assert.ok(triviaWrites[0].data.message.indexOf('daily trivia') !== -1);
    assert.ok(triviaWrites[0].data.message.indexOf('50') !== -1);
    assert.ok(questWrites[0].data.message.indexOf('a quest') !== -1);
    assert.ok(questWrites[0].data.message.indexOf('100') !== -1);
    assert.strictEqual(triviaWrites[0].data.icon, '🧠');
    assert.strictEqual(questWrites[0].data.icon, '🏆');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
