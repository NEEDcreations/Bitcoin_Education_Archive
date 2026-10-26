// Server grading for daily trivia and quiz quests. No Firebase.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const reward = require('../functions/src/questReward');
const dailyXp = require('../functions/src/dailyXp');
const rewardNotify = require('../functions/src/rewardNotify');
const { buildBanks, snapshotPrevious, GRACE_MS } = require('../functions/build-reward-banks');

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

test('daily quiz and trivia use the shared 1000 cap', function() {
    assert.strictEqual(reward.DAILY_QUIZ_XP_CAP, undefined);
    assert.strictEqual(dailyXp.DAILY_CAP, 1000);
    assert.strictEqual(dailyXp.DAILY_POINTS_CAP, dailyXp.DAILY_CAP);
    assert.strictEqual(dailyXp.TAPER_FULL_UNTIL, 500);
    assert.strictEqual(dailyXp.TAPER_HALF_UNTIL, 900);
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
    assert.strictEqual(right.optionIndex, question.options.indexOf(correctText));
    assert.strictEqual(missed.optionIndex, question.options.indexOf(wrong));
    assert.strictEqual(byIndex.optionIndex, -1);

    const answerSlot = question.options.indexOf(correctText);
    const idOnly = reward.gradeTrivia(triviaPayload({ optionId: reward.optionId(correctText) }));
    assert.strictEqual(idOnly.correct, true);
    assert.strictEqual(idOnly.optionIndex, answerSlot);
    const idString = reward.gradeTrivia(triviaPayload(reward.optionId(correctText)));
    assert.strictEqual(idString.correct, true);
    assert.strictEqual(idString.optionIndex, answerSlot);
    const mismatch = reward.gradeTrivia(triviaPayload({
        text: correctText,
        optionId: reward.optionId(wrong),
    }));
    assert.strictEqual(mismatch.correct, false);
    assert.strictEqual(mismatch.optionIndex, -1);
    const splitFields = reward.gradeTrivia(triviaPayload(correctText, { optionId: reward.optionId(wrong) }));
    assert.strictEqual(splitFields.correct, false);
    assert.strictEqual(splitFields.optionIndex, -1);
});

test('banned accounts and the daily cap hold for trivia', function() {
    const question = reward.triviaQuestion(reward.triviaIndexForDay(DAY));
    const correctText = question.options[question.answer];
    const banned = reward.gradeTrivia(triviaPayload(correctText, { banned: true }));
    assert.strictEqual(banned.correct, true);
    assert.strictEqual(banned.awarded, 0);
    assert.strictEqual(banned.reason, 'banned');
    assert.strictEqual(reward.isRewardBanned({ satsDisabled: true }, null), true);
    assert.strictEqual(reward.isRewardBanned({ ban_reason: 'spam' }, null), true);
    assert.strictEqual(reward.isRewardBanned({ banned: true }, null), true);
    assert.strictEqual(reward.isRewardBanned({}, { banned: true }), true);
    assert.strictEqual(reward.isRewardBanned({}, { banned: false }), false);

    const capped = reward.gradeTrivia(triviaPayload(correctText, { dailyUsed: 1000 }));
    assert.strictEqual(capped.awarded, 0);
    assert.strictEqual(capped.overflowAdded, 0);
    assert.strictEqual(capped.capped, true);
    const partial = reward.gradeTrivia(triviaPayload(correctText, { dailyUsed: 980 }));
    assert.strictEqual(partial.awarded, 12);
    assert.strictEqual(partial.overflowAdded, 0);
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
        dailyUsed: 1000,
        questsToday: 0,
        banned: false,
        alreadyPerfect: false,
    });
    assert.strictEqual(full.awarded, 0);
    assert.strictEqual(full.overflowAdded, 0);
    assert.strictEqual(full.capped, true);
    assert.strictEqual(full.pts, 100);
    assert.strictEqual(full.countQuest, true);

    const room = reward.settleQuizReward({
        graded: graded,
        dailyUsed: 980,
        questsToday: 0,
        banned: false,
        alreadyPerfect: false,
    });
    assert.strictEqual(room.awarded, 20);
    assert.strictEqual(room.overflowAdded, 0);
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
    assert.strictEqual((callables.match(/weeklyXP = FieldValue\.increment/g) || []).length, 2);
    assert.strictEqual((callables.match(/monthlyXP = FieldValue\.increment/g) || []).length, 2);
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

test('trivia stats record the bank index, not the shuffled display slot', function() {
    const src = read('quests.js');
    const start = src.indexOf('function _triviaStatIndex');
    const end = src.indexOf('function _getTriviaToday');
    assert.ok(start >= 0 && end > start);
    const statIndex = new Function(src.slice(start, end) + '\nreturn _triviaStatIndex;')();
    const shuffled = { bankIndexOfDisplay: [1, 2, 0, 3] };
    assert.strictEqual(statIndex(shuffled, 2), 0);
    assert.strictEqual(statIndex(shuffled, 0), 1);
    assert.strictEqual(statIndex({ options: ['a', 'b', 'c', 'd'] }, 2), 2);
    assert.strictEqual(statIndex(null, 1), 1);

    const finishStart = src.indexOf('function _finishTrivia');
    const finishEnd = src.indexOf('var signedIn', finishStart);
    const finish = src.slice(finishStart, finishEnd);
    assert.strictEqual(finish.includes("db.collection('trivia_stats')"), false);
    assert.strictEqual(finish.includes("db.collection('trivia_cumulative')"), false);
    assert.strictEqual(finish.includes('FieldValue.increment'), false);
    assert.ok(finish.includes('statsRecorded === true'));
    assert.strictEqual(src.includes('_triviaOptimisticStats'), false);
    assert.ok(src.includes("var statKey = 'option_' + _triviaStatIndex(trivia, oi)"));
    assert.ok(src.includes('_captureTriviaBaseline(todayKey, _triviaStatIndex(t, chosenIdx)'));

    const rewardSrc = read('functions/src/questReward.js');
    assert.ok(rewardSrc.includes('function triviaOptionIndex'));
    const body = callableBody(read('functions/src/questCallables.js'), 'answerTrivia');
    assert.ok(body.includes("db.collection('trivia_stats').doc(dayKey)"));
    assert.ok(body.includes("db.collection('trivia_cumulative').doc('t_' + graded.questionIndex)"));
    assert.ok(body.includes("statPatch[optionKey] = FieldValue.increment(1)"));
    assert.ok(body.includes('statsRecorded'));
    assert.ok(body.indexOf('if (alreadyClaimed)') < body.indexOf("collection('trivia_stats')"));
    assert.ok(body.indexOf('if (!banned)') < body.indexOf("collection('trivia_stats')"));
    const rules = read('firestore.rules');
    function rulesBlock(marker) {
        const at = rules.indexOf(marker);
        assert.ok(at > 0, marker);
        return rules.slice(at, rules.indexOf('match /', at + 10));
    }
    ['match /trivia_stats/{date}', 'match /trivia_cumulative/{triviaId}'].forEach(function(marker) {
        const block = rulesBlock(marker);
        assert.ok(block.includes('allow read: if true'), marker);
        assert.ok(block.includes('allow create, update, delete: if false'), marker);
        assert.strictEqual(block.includes('request.auth'), false, marker);
    });
    const polls = rulesBlock('match /poll_votes/{pollId}');
    assert.ok(polls.includes('allow create, update, delete: if false'));
    assert.ok(rules.includes('match /poll_cumulative/{pollId}'));
    assert.ok(rules.includes('match /satoshiFavor/announceDedup') || rules.includes('match /sf_live_announcements/{cycleId}'));
});

function cloneQuests(mutate) {
    const quests = {};
    Object.keys(reward.banks.quests).forEach(function(topic) {
        quests[topic] = reward.banks.quests[topic].map(function(row) {
            return {
                q: row.q,
                a: row.a,
                wrong: (row.wrong || []).slice(),
                questIndex: row.questIndex,
            };
        });
    });
    if (mutate) mutate(quests);
    return quests;
}

test('previous bank answers grade for 72 hours and cannot be claimed twice', function() {
    assert.strictEqual(GRACE_MS, 72 * 60 * 60 * 1000);

    const fresh = buildBanks();
    const oldBanks = {
        trivia: [{ q: 'old trivia', options: ['a', 'b', 'c', 'd'], answer: 0 }],
        quests: { whitepaper: [{ q: 'old q', a: 'old a', wrong: ['no'], questIndex: 0 }] },
        learning: fresh.learning,
    };
    const opened = snapshotPrevious(oldBanks, fresh, NOW, null);
    assert.strictEqual(opened.validUntil, NOW + GRACE_MS);
    assert.strictEqual(opened.trivia[0].q, 'old trivia');
    assert.notStrictEqual(opened.trivia[0].q, fresh.trivia[0].q);
    const existing = { validUntil: 50, trivia: oldBanks.trivia, quests: oldBanks.quests, learning: oldBanks.learning };
    assert.strictEqual(snapshotPrevious(fresh, fresh, NOW + GRACE_MS, existing), existing);

    const committed = JSON.parse(read('functions/reward-banks.json'));
    const prevFile = JSON.parse(read('functions/reward-banks.prev.json'));
    assert.strictEqual(typeof prevFile.validUntil, 'number');
    assert.ok(Array.isArray(prevFile.trivia) && prevFile.trivia.length > 0);
    assert.strictEqual(snapshotPrevious(committed, fresh, NOW + 1, prevFile), prevFile);

    const prevTrivia = reward.banks.trivia.map(function(item) {
        return { q: item.q, options: item.options.slice(), answer: item.answer };
    });
    prevTrivia.pop();
    const prevIndex = reward.triviaIndexForDay(DAY, prevTrivia.length);
    const currentIndex = reward.triviaIndexForDay(DAY);
    assert.notStrictEqual(prevIndex, currentIndex);
    const oldTrivia = {
        q: 'Which previous-bank line is still accepted during the grace window?',
        options: ['The published previous answer', 'A display slot', 'A forged index', 'Tomorrow'],
        answer: 0,
    };
    prevTrivia[prevIndex] = oldTrivia;
    const prev = {
        validUntil: NOW + GRACE_MS,
        trivia: prevTrivia,
        quests: cloneQuests(function(quests) {
            quests.whitepaper.forEach(function(row) {
                if (row.questIndex === 0) {
                    row.q = 'PREV ' + row.q;
                    row.a = 'PREV ' + row.a;
                } else if (row.questIndex === 1 && row === quests.whitepaper.filter(function(item) { return item.questIndex === 1; })[0]) {
                    row.a = 'PREVIOUS ANSWER TEXT';
                }
            });
        }),
        learning: {},
    };

    const oldRight = reward.gradeTrivia(triviaPayload(oldTrivia.options[0], {
        questionIndex: prevIndex,
        q: oldTrivia.q,
        prev: prev,
    }));
    assert.strictEqual(oldRight.ok, true);
    assert.strictEqual(oldRight.correct, true);
    assert.strictEqual(oldRight.awarded, 50);

    const oldWrong = reward.gradeTrivia(triviaPayload(oldTrivia.options[1], {
        questionIndex: prevIndex,
        q: oldTrivia.q,
        prev: prev,
    }));
    assert.strictEqual(oldWrong.ok, true);
    assert.strictEqual(oldWrong.correct, false);
    assert.strictEqual(oldWrong.awarded, 0);

    const wrongText = reward.gradeTrivia(triviaPayload(oldTrivia.options[0], {
        questionIndex: prevIndex,
        q: 'not the previous question',
        prev: prev,
    }));
    assert.strictEqual(wrongText.ok, false);
    assert.strictEqual(wrongText.awarded, 0);
    assert.strictEqual(wrongText.reason, 'wrong-question');

    const otherIndex = reward.gradeTrivia(triviaPayload(oldTrivia.options[0], {
        questionIndex: prevIndex === 3 ? 4 : 3,
        q: oldTrivia.q,
        prev: prev,
    }));
    assert.strictEqual(otherIndex.ok, false);
    assert.strictEqual(otherIndex.awarded, 0);

    const current = reward.triviaQuestion(currentIndex);
    const stillCurrent = reward.gradeTrivia(triviaPayload(current.options[current.answer], {
        questionIndex: currentIndex,
        q: current.q,
        prev: prev,
    }));
    assert.strictEqual(stillCurrent.correct, true);
    assert.strictEqual(stillCurrent.awarded, 50);

    const expired = reward.gradeTrivia(triviaPayload(oldTrivia.options[0], {
        questionIndex: prevIndex,
        q: oldTrivia.q,
        prev: { validUntil: NOW, trivia: prevTrivia, quests: prev.quests, learning: {} },
    }));
    assert.strictEqual(expired.ok, false);
    assert.strictEqual(expired.awarded, 0);
    assert.strictEqual(expired.reason, 'wrong-question');

    const oldPart = prev.quests.whitepaper.filter(function(row) { return row.questIndex === 0; });
    assert.strictEqual(oldPart.length, 5);
    const oldAnswers = oldPart.map(function(row) {
        return { q: row.q, topicKey: 'whitepaper', questIndex: 0, chosen: row.a, answer: 0, correct: true, keys: [0] };
    });
    const oldQuiz = reward.gradeQuestSubmission({
        topicKey: 'whitepaper',
        questIndex: 0,
        answers: oldAnswers,
        prev: prev,
        now: NOW + GRACE_MS + 1,
        serverNow: NOW,
    });
    assert.strictEqual(oldQuiz.score, 5);
    assert.strictEqual(oldQuiz.pts, 100);
    assert.strictEqual(oldQuiz.completeSet, true);
    assert.strictEqual(oldQuiz.completionKey, 'quest_whitepaper__1');
    const oldPaid = reward.settleQuizReward({
        graded: oldQuiz, dailyUsed: 0, questsToday: 0, banned: false, alreadyPerfect: false,
    });
    assert.strictEqual(oldPaid.awarded, 100);
    assert.strictEqual(oldPaid.completionKey, 'quest_whitepaper__1');
    const second = reward.settleQuizReward({
        graded: oldQuiz, dailyUsed: 100, questsToday: 1, banned: false, alreadyPerfect: true,
    });
    assert.strictEqual(second.awarded, 0);
    assert.strictEqual(second.pts, 0);
    assert.strictEqual(second.reason, 'already-perfect');
    assert.strictEqual(second.completionKey, '');

    const currentPart = reward.gradeQuestSubmission({
        answers: answersFor('whitepaper', 0, function(question) { return question.a; }),
        prev: prev,
        serverNow: NOW,
    });
    assert.strictEqual(currentPart.completionKey, oldQuiz.completionKey);
    const currentBlocked = reward.settleQuizReward({
        graded: currentPart, dailyUsed: 0, questsToday: 0, banned: false, alreadyPerfect: true,
    });
    assert.strictEqual(currentBlocked.awarded, 0);
    assert.strictEqual(currentBlocked.reason, 'already-perfect');

    const misplaced = reward.gradeQuestSubmission({
        answers: oldPart.map(function(row) {
            return { q: row.q, topicKey: 'whitepaper', questIndex: 1, chosen: row.a };
        }),
        prev: prev,
        serverNow: NOW,
    });
    assert.strictEqual(misplaced.score, 0);
    assert.strictEqual(misplaced.completeSet, false);
    assert.strictEqual(misplaced.pts, 0);

    const part1 = reward.questionsFor('whitepaper', 1);
    const oldAnswerAccepted = reward.gradeQuestSubmission({
        answers: part1.map(function(question, i) {
            return {
                q: question.q,
                topicKey: 'whitepaper',
                questIndex: 1,
                chosen: i === 0 ? 'PREVIOUS ANSWER TEXT' : question.a,
            };
        }),
        prev: prev,
        serverNow: NOW,
    });
    assert.strictEqual(oldAnswerAccepted.score, 5);
    assert.strictEqual(oldAnswerAccepted.pts, 100);
    assert.strictEqual(oldAnswerAccepted.completionKey, 'quest_whitepaper__2');

    const afterExpiry = reward.gradeQuestSubmission({
        answers: oldAnswers,
        prev: prev,
        now: NOW,
        serverNow: prev.validUntil,
    });
    assert.strictEqual(afterExpiry.score, 0);
    assert.strictEqual(afterExpiry.completeSet, false);

    const unrelated = reward.gradeQuestSubmission({
        answers: [0, 1, 2, 3, 4].map(function() {
            return { q: 'not in either bank', topicKey: 'whitepaper', questIndex: 0, chosen: 'nope' };
        }),
        prev: prev,
        serverNow: NOW,
    });
    assert.strictEqual(unrelated.score, 0);

    const capped = reward.settleQuizReward({
        graded: oldQuiz, dailyUsed: 0, questsToday: 3, banned: false, alreadyPerfect: false,
    });
    assert.strictEqual(capped.reason, 'daily-limit');
    assert.strictEqual(capped.awarded, 0);

    const callables = read('functions/src/questCallables.js');
    const triviaBody = callableBody(callables, 'answerTrivia');
    const questBody = callableBody(callables, 'gradeQuest');
    assert.strictEqual(triviaBody.includes('payload.prev'), false);
    assert.strictEqual(triviaBody.includes('payload.now'), false);
    assert.ok(triviaBody.includes("doc(dayKey + '_trivia')"));
    assert.ok(triviaBody.indexOf('if (alreadyClaimed)') < triviaBody.indexOf('tx.set(claimRef'));
    assert.strictEqual(questBody.includes('payload.prev'), false);
    assert.strictEqual(questBody.includes('payload.now'), false);
    assert.ok(questBody.includes('serverNow: now'));
});

test('one edited question still completes the previous part once', function() {
    const prevQuests = cloneQuests(function(bank) {
        const row = bank.whitepaper.filter(function(item) { return item.questIndex === 0; })[0];
        row.q = 'OLD ' + row.q;
        row.a = 'OLD ' + row.a;
    });
    const oldRows = prevQuests.whitepaper.filter(function(row) { return row.questIndex === 0; });
    const currentText = reward.questionsFor('whitepaper', 0).map(function(question) { return question.q; });
    assert.strictEqual(currentText.indexOf(oldRows[0].q), -1);
    assert.ok(currentText.indexOf(oldRows[1].q) !== -1);
    const prev = {
        validUntil: NOW + GRACE_MS,
        trivia: reward.banks.trivia,
        quests: prevQuests,
        learning: reward.banks.learning,
    };
    const answers = oldRows.map(function(row) {
        return { q: row.q, topicKey: 'whitepaper', questIndex: 0, chosen: row.a };
    });
    const first = reward.gradeQuestSubmission({
        topicKey: 'whitepaper',
        questIndex: 0,
        answers: answers,
        prev: prev,
        serverNow: NOW,
    });
    assert.strictEqual(first.score, 5);
    assert.strictEqual(first.pts, 100);
    assert.strictEqual(first.completeSet, true);
    assert.strictEqual(first.completionKey, 'quest_whitepaper__1');
    const paid = reward.settleQuizReward({
        graded: first, dailyUsed: 0, questsToday: 0, banned: false, alreadyPerfect: false,
    });
    assert.strictEqual(paid.awarded, 100);
    assert.strictEqual(paid.completionKey, 'quest_whitepaper__1');
    const second = reward.settleQuizReward({
        graded: first, dailyUsed: 100, questsToday: 1, banned: false, alreadyPerfect: true,
    });
    assert.strictEqual(second.awarded, 0);
    assert.strictEqual(second.pts, 0);
    assert.strictEqual(second.reason, 'already-perfect');
    assert.strictEqual(second.completionKey, '');

    const questBody = callableBody(read('functions/src/questCallables.js'), 'gradeQuest');
    const checkAt = questBody.indexOf('completionDoc.exists');
    const writeAt = questBody.indexOf('if (settled.completionKey && completionRef)');
    assert.ok(checkAt > 0 && writeAt > checkAt);
    assert.ok(questBody.indexOf('legacyPartRecorded') < writeAt);
    assert.ok(questBody.includes('reward.questCompletionKey(graded.topicKey, graded.questIndex)'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
