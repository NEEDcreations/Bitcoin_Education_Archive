'use strict';

// Server-side grading for daily trivia and quiz quests.
// The browser is hostile: answer keys, indexes, and "correct" flags it sends
// are ignored. Points are decided from functions/reward-banks.json, which
// build.sh copies from data/trivia-bank.js, quests.js, and learning-quests.js.
//
// Daily quiz XP cap is 500. That is the cap gradeQuest already applied on the
// offset-day daily_points doc (functions/src/dailyXp.js). awardPoints still
// uses its own 1,000 cap for other actions. Trivia and quiz rewards use 500.

const crypto = require('crypto');
const banks = require('../reward-banks.json');
const { splitDailyXp, DAILY_POINTS_CAP } = require('./dailyXp');

const DAILY_QUIZ_XP_CAP = DAILY_POINTS_CAP;
const TRIVIA_CORRECT_XP = 50;
const QUEST_PERFECT_XP = 100;
const QUEST_PARTIAL_XP = 50;
const QUEST_RETRY_XP = 25;
const DAILY_QUEST_LIMIT = 3;
const RESET_HOUR_UTC = 5;

function sha16(prefix, text) {
    return crypto.createHash('sha256').update(prefix + String(text || ''), 'utf8').digest('hex').slice(0, 16);
}

function questionHash(text) {
    return sha16('q\n', text);
}

function optionId(text) {
    return sha16('o\n', text);
}

function offsetDateKey(nowMs) {
    const shifted = new Date((Number(nowMs) || 0) - RESET_HOUR_UTC * 3600 * 1000);
    return shifted.toISOString().split('T')[0];
}

function previousDateKey(dayKey) {
    const ms = Date.parse(String(dayKey || '') + 'T00:00:00Z');
    if (!Number.isFinite(ms)) return '';
    return new Date(ms - 86400000).toISOString().split('T')[0];
}

function triviaIndexForDay(dayKey, length) {
    const len = length == null ? banks.trivia.length : length;
    const dkMs = Date.parse(String(dayKey || '') + 'T00:00:00Z');
    const epoch = Date.parse('2026-01-01T00:00:00Z');
    if (!Number.isFinite(dkMs) || !len) return -1;
    const dayIndex = Math.floor((dkMs - epoch) / 86400000);
    return ((dayIndex * 7 + 2026) % len + len) % len;
}

function isRewardBanned(user, ledger) {
    return !!(user && user.satsDisabled === true) || !!(ledger && ledger.banned === true);
}

function nextCallRate(existing, nowMs, windowMs, max) {
    const src = existing || {};
    const windowStartMs = Number(src.windowStartMs) || 0;
    const count = Number(src.count) || 0;
    const now = Number(nowMs) || 0;
    const span = Number(windowMs) || 60000;
    const limit = Number(max) || 1;
    if (!windowStartMs || now - windowStartMs >= span) {
        return { ok: true, windowStartMs: now, count: 1 };
    }
    if (count >= limit) return { ok: false, windowStartMs: windowStartMs, count: count };
    return { ok: true, windowStartMs: windowStartMs, count: count + 1 };
}

function sanitizeTopic(value) {
    const s = String(value == null ? '' : value).trim();
    if (!s || s.length > 80) return '';
    if (!/^[a-zA-Z0-9_-]+$/.test(s)) return '';
    return s;
}

function clampIndex(value) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 40) return -1;
    return n;
}

function indexTopic(list) {
    const parts = {};
    const rows = Array.isArray(list) ? list : [];
    for (let i = 0; i < rows.length; i++) {
        const item = rows[i];
        const questIndex = Number.isInteger(item.questIndex) ? item.questIndex : Math.floor(i / 5);
        if (!parts[questIndex]) parts[questIndex] = {};
        const qHash = questionHash(item.q);
        parts[questIndex][qHash] = {
            q: item.q,
            a: item.a,
            wrong: item.wrong || [],
            qHash: qHash,
            questIndex: questIndex,
        };
    }
    return parts;
}

const questParts = {};
Object.keys(banks.quests || {}).forEach(function(topic) {
    questParts[topic] = indexTopic(banks.quests[topic]);
});

function triviaQuestion(index) {
    const item = banks.trivia[index];
    if (!item) return null;
    return { q: item.q, options: item.options.slice(), answer: item.answer };
}

function triviaLength() {
    return banks.trivia.length;
}

function questionsFor(topicKey, questIndex) {
    const topic = questParts[topicKey];
    if (!topic || !topic[questIndex]) return [];
    const part = topic[questIndex];
    return Object.keys(part).map(function(hash) { return part[hash]; });
}

function lookupQuestion(topicKey, questIndex, ans) {
    const topic = questParts[topicKey];
    if (!topic) return null;
    const part = topic[questIndex];
    if (!part) return null;
    const text = ans && typeof ans.q === 'string' ? ans.q
        : (ans && typeof ans.question === 'string' ? ans.question : '');
    if (text) return part[questionHash(text)] || null;
    const hash = ans && typeof ans.qHash === 'string' ? ans.qHash : '';
    if (hash && part[hash]) return part[hash];
    return null;
}

function choiceCorrect(question, ans) {
    if (!question || !ans || typeof ans !== 'object' || Array.isArray(ans)) return false;
    const correctText = String(question.a || '').trim();
    const correctOpt = optionId(correctText);
    const raw = typeof ans.chosen === 'string' ? ans.chosen
        : (typeof ans.chosenText === 'string' ? ans.chosenText : '');
    const text = raw.trim();
    const id = typeof ans.optionId === 'string' ? ans.optionId.trim() : '';
    if (text && (text === correctText || text === correctOpt)) return true;
    if (id && id === correctOpt) return true;
    return false;
}

function triviaChoiceCorrect(question, chosen) {
    if (!question || chosen == null || typeof chosen === 'number') return false;
    const correctText = String(question.options[question.answer] || '').trim();
    const correctOpt = optionId(correctText);
    if (typeof chosen === 'string') {
        const text = chosen.trim();
        return text === correctText || text === correctOpt;
    }
    if (typeof chosen === 'object') {
        const text = String(chosen.text || chosen.chosen || chosen.chosenText || '').trim();
        const id = String(chosen.optionId || '').trim();
        if (text && text === correctText) return true;
        if (id && id === correctOpt) return true;
        return false;
    }
    return false;
}

function gradeTrivia(input) {
    const src = input || {};
    const now = src.now == null ? Date.now() : src.now;
    const today = offsetDateKey(now);
    const dayKey = String(src.dayKey || '');
    const questionIndex = Number(src.questionIndex);
    if (dayKey !== today) {
        return { ok: false, correct: false, awarded: 0, overflowAdded: 0, capped: false, pts: 0, reason: 'wrong-day' };
    }
    const expected = triviaIndexForDay(today);
    if (!Number.isInteger(questionIndex) || questionIndex !== expected) {
        return { ok: false, correct: false, awarded: 0, overflowAdded: 0, capped: false, pts: 0, reason: 'wrong-question', questionIndex: expected };
    }
    const question = triviaQuestion(expected);
    const correct = triviaChoiceCorrect(question, src.chosen);
    if (src.banned === true) {
        return { ok: true, correct: correct, awarded: 0, overflowAdded: 0, capped: false, pts: 0, reason: 'banned', banned: true, questionIndex: expected };
    }
    const pts = correct ? TRIVIA_CORRECT_XP : 0;
    const split = splitDailyXp(src.dailyUsed || 0, pts, DAILY_QUIZ_XP_CAP);
    return {
        ok: true,
        correct: correct,
        awarded: split.awarded,
        overflowAdded: split.overflowAdded,
        capped: split.capped,
        pts: pts,
        reason: correct ? '' : 'incorrect',
        questionIndex: expected,
    };
}

// Grades one quiz submission. Client `keys`, `answer`, and `correct` fields
// are not read. Chosen answer text or a stable option id is.
function gradeQuestSubmission(data) {
    const src = data || {};
    const answers = Array.isArray(src.answers) ? src.answers.slice(0, 5) : [];
    const objects = [];
    for (let i = 0; i < answers.length; i++) {
        const ans = answers[i];
        if (ans && typeof ans === 'object' && !Array.isArray(ans)) objects.push(ans);
    }
    if (objects.length !== 5) {
        return { ok: false, reason: 'need-text-answers', score: 0, pts: 0, completeSet: false, completionKey: '', topicKey: '', questIndex: -1 };
    }
    const fallbackTopic = sanitizeTopic(src.topicKey);
    const fallbackIndex = clampIndex(src.questIndex);
    const seen = Object.create(null);
    const matched = [];
    let score = 0;
    for (let i = 0; i < objects.length; i++) {
        const ans = objects[i];
        const topicKey = sanitizeTopic(ans.topicKey) || fallbackTopic;
        const questIndex = (ans.questIndex == null || ans.questIndex === '') ? fallbackIndex : clampIndex(ans.questIndex);
        const question = lookupQuestion(topicKey, questIndex, ans);
        if (!question) continue;
        const seenKey = topicKey + ':' + questIndex + ':' + question.qHash;
        if (seen[seenKey]) continue;
        seen[seenKey] = true;
        matched.push({ topicKey: topicKey, questIndex: questIndex, qHash: question.qHash });
        if (choiceCorrect(question, ans)) score++;
    }
    const part = samePart(matched);
    let pts = 0;
    if (score >= 3) {
        if (src.isRetry === true) pts = QUEST_RETRY_XP;
        else if (score === 5) pts = QUEST_PERFECT_XP;
        else pts = QUEST_PARTIAL_XP;
    }
    return {
        ok: true,
        score: score,
        pts: pts,
        completeSet: !!part,
        completionKey: part ? questCompletionKey(part.topicKey, part.questIndex) : '',
        topicKey: part ? part.topicKey : (matched[0] ? matched[0].topicKey : fallbackTopic),
        questIndex: part ? part.questIndex : (matched[0] ? matched[0].questIndex : fallbackIndex),
    };
}

function samePart(matched) {
    if (!matched || matched.length !== 5) return null;
    const topicKey = matched[0].topicKey;
    const questIndex = matched[0].questIndex;
    for (let i = 1; i < matched.length; i++) {
        if (matched[i].topicKey !== topicKey || matched[i].questIndex !== questIndex) return null;
    }
    const part = questParts[topicKey] && questParts[topicKey][questIndex];
    if (!part) return null;
    const expected = Object.keys(part).sort();
    if (expected.length !== 5) return null;
    const got = matched.map(function(m) { return m.qHash; }).sort();
    for (let i = 0; i < 5; i++) {
        if (got[i] !== expected[i]) return null;
    }
    return { topicKey: topicKey, questIndex: questIndex };
}

function questCompletionKey(topicKey, questIndex) {
    return 'quest_' + topicKey + '__' + (questIndex + 1);
}

// Keys the old gradeQuest wrote onto users.completedQuests. Part 1 used
// quest_<topic>. Later parts, and part 1 after the part-specific write,
// used quest_<topic>__N. A match only blocks another payout.
function legacyPartRecorded(completed, topicKey, questIndex) {
    const list = Array.isArray(completed) ? completed : [];
    const topic = String(topicKey || '');
    const part = questIndex + 1;
    if (!topic || part < 1) return false;
    if (list.indexOf('quest_' + topic + '__' + part) !== -1) return true;
    if (part === 1 && list.indexOf('quest_' + topic) !== -1) return true;
    return false;
}

function settleQuizReward(input) {
    const src = input || {};
    const graded = src.graded || {};
    const score = graded.score || 0;
    if (!graded.ok) {
        return { awarded: 0, overflowAdded: 0, capped: false, pts: 0, score: 0, reason: graded.reason || 'invalid', completionKey: '', countQuest: false, blocked: true };
    }
    const questsToday = Number(src.questsToday) || 0;
    if (questsToday >= DAILY_QUEST_LIMIT) {
        return { awarded: 0, overflowAdded: 0, capped: false, pts: 0, score: score, reason: 'daily-limit', completionKey: '', countQuest: false, blocked: true };
    }
    if (src.banned === true) {
        return { awarded: 0, overflowAdded: 0, capped: false, pts: 0, score: score, reason: 'banned', completionKey: '', countQuest: false, blocked: true, banned: true };
    }
    // alreadyPerfect is a quest_completions doc, or a server key already
    // stored on completedQuests. Either one only blocks a repeat payout.
    const already = graded.completeSet && src.alreadyPerfect === true;
    const pts = already ? 0 : (graded.pts || 0);
    const split = splitDailyXp(src.dailyUsed || 0, pts, DAILY_QUIZ_XP_CAP);
    return {
        awarded: split.awarded,
        overflowAdded: split.overflowAdded,
        capped: split.capped,
        pts: pts,
        score: score,
        reason: already ? 'already-perfect' : '',
        completionKey: (!already && graded.score === 5 && graded.completeSet) ? graded.completionKey : '',
        countQuest: true,
        blocked: false,
    };
}

module.exports = {
    DAILY_QUIZ_XP_CAP: DAILY_QUIZ_XP_CAP,
    TRIVIA_CORRECT_XP: TRIVIA_CORRECT_XP,
    QUEST_PERFECT_XP: QUEST_PERFECT_XP,
    QUEST_PARTIAL_XP: QUEST_PARTIAL_XP,
    QUEST_RETRY_XP: QUEST_RETRY_XP,
    DAILY_QUEST_LIMIT: DAILY_QUEST_LIMIT,
    banks: banks,
    questionHash: questionHash,
    optionId: optionId,
    offsetDateKey: offsetDateKey,
    previousDateKey: previousDateKey,
    triviaIndexForDay: triviaIndexForDay,
    triviaQuestion: triviaQuestion,
    triviaLength: triviaLength,
    questionsFor: questionsFor,
    isRewardBanned: isRewardBanned,
    nextCallRate: nextCallRate,
    gradeTrivia: gradeTrivia,
    gradeQuestSubmission: gradeQuestSubmission,
    questCompletionKey: questCompletionKey,
    legacyPartRecorded: legacyPartRecorded,
    settleQuizReward: settleQuizReward,
};
