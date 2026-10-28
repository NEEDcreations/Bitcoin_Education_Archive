'use strict';

// Server-side grading for daily trivia and quiz quests.
// The browser is hostile: answer keys, indexes, and "correct" flags it sends
// are ignored. Points are decided from functions/reward-banks.json, which
// build.sh copies from functions/src/trivia-bank.js, quests.js, and
// learning-quests.js. The public trivia file has no answer index.
//
// Trivia and quiz XP use the shared daily counter: full through 500, half
// through 900, then a quarter until 1,000, on the offset-day daily_points
// doc. Each tier floors on its own. Wrong answers pay 0.

const crypto = require('crypto');
const banks = require('../reward-banks.json');
const { planDailyXp } = require('./dailyXp');

// Previous published bank. build-reward-banks.js writes this when the
// client banks change, with validUntil 72 hours later. Grading uses it
// only for a question whose text or daily index matches that version.
let prevDoc = null;
try {
    prevDoc = require('../reward-banks.prev.json');
} catch (err) {
    prevDoc = null;
}

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
    if (user && user.ban_reason) return true;
    if (user && user.banned === true) return true;
    return !!(user && user.satsDisabled === true) || !!(ledger && ledger.banned === true);
}

function nextActivityStreak(lastDate, streak, today, yesterday) {
    const last = String(lastDate || '');
    const current = Math.max(0, Math.floor(Number(streak) || 0));
    if (last && last === String(today || '')) return current || 1;
    if (last && last === String(yesterday || '')) return current + 1;
    return 1;
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

function indexQuestBank(quests) {
    const parts = {};
    Object.keys(quests || {}).forEach(function(topic) {
        parts[topic] = indexTopic(quests[topic]);
    });
    return parts;
}

const questParts = indexQuestBank(banks.quests);
const prevParts = prevDoc && prevDoc.quests ? indexQuestBank(prevDoc.quests) : null;

function activePrevious(now, override) {
    if (override === null) return null;
    const src = override === undefined ? prevDoc : override;
    if (!src || src.validUntil == null) return null;
    if (!(Number(now) < Number(src.validUntil))) return null;
    return src;
}

function previousQuestParts(prev) {
    if (!prev || !prev.quests) return null;
    if (prev === prevDoc) return prevParts;
    return indexQuestBank(prev.quests);
}

function triviaQuestionFrom(item) {
    if (!item || !Array.isArray(item.options)) return null;
    return {
        q: item.q,
        options: item.options.slice(),
        answer: item.answer,
        explanation: typeof item.explanation === 'string' ? item.explanation : '',
    };
}

function triviaQuestion(index) {
    return triviaQuestionFrom(banks.trivia[index]);
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

function lookupQuestionIn(parts, topicKey, questIndex, ans) {
    const topic = parts && parts[topicKey];
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

function lookupQuestion(topicKey, questIndex, ans) {
    return lookupQuestionIn(questParts, topicKey, questIndex, ans);
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

function triviaSlots(question) {
    if (!question || !Array.isArray(question.options)) return [];
    const limit = Math.min(question.options.length, 4);
    const slots = [];
    for (let i = 0; i < limit; i++) {
        const text = String(question.options[i] || '').trim();
        slots.push({ text: text, id: optionId(text) });
    }
    return slots;
}

function slotByText(slots, text) {
    if (!text) return -1;
    for (let i = 0; i < slots.length; i++) {
        if (slots[i].text === text) return i;
    }
    return -1;
}

function slotById(slots, id) {
    if (!id) return -1;
    for (let i = 0; i < slots.length; i++) {
        if (slots[i].id === id) return i;
    }
    return -1;
}

// One bank slot for grading and for the tally. A valid optionId wins.
// Otherwise the matched answer text is used. A numeric index is never
// trusted. When text and optionId both resolve and disagree, the choice
// is unmatched so it is neither graded nor counted.
function triviaOptionIndex(question, chosen) {
    if (!question || chosen == null || typeof chosen === 'number') return -1;
    const slots = triviaSlots(question);
    if (!slots.length) return -1;
    if (typeof chosen === 'string') {
        const raw = chosen.trim();
        if (!raw) return -1;
        const byText = slotByText(slots, raw);
        const byId = slotById(slots, raw);
        if (byText >= 0 && byId >= 0 && byText !== byId) return -1;
        if (byId >= 0 && byText < 0) return byId;
        return byText;
    }
    if (typeof chosen !== 'object' || Array.isArray(chosen)) return -1;
    const text = String(chosen.text || chosen.chosen || chosen.chosenText || '').trim();
    const id = typeof chosen.optionId === 'string' ? chosen.optionId.trim() : '';
    const byText = slotByText(slots, text);
    const byId = slotById(slots, id);
    if (text && id && byText >= 0 && byId >= 0 && byText !== byId) return -1;
    if (id && byId >= 0) return byId;
    return byText;
}

function triviaChoiceCorrect(question, chosen) {
    if (!question || chosen == null || typeof chosen === 'number') return false;
    const slot = triviaOptionIndex(question, chosen);
    if (slot < 0) return false;
    return slot === Number(question.answer);
}

// Top-level optionId and chosen.optionId are the same field. Two different
// ids are a mismatch. A bare string plus an optionId is one choice.
function triviaChoiceFrom(src) {
    const chosen = src ? src.chosen : undefined;
    const extra = src && typeof src.optionId === 'string' ? src.optionId.trim() : '';
    if (chosen && typeof chosen === 'object' && !Array.isArray(chosen)) {
        const own = typeof chosen.optionId === 'string' ? chosen.optionId.trim() : '';
        if (extra && own && extra !== own) return null;
        if (extra && !own) return Object.assign({}, chosen, { optionId: extra });
        return chosen;
    }
    if (extra) return { text: typeof chosen === 'string' ? chosen : '', optionId: extra };
    return chosen;
}

function clientQuestionText(src) {
    if (!src) return '';
    if (typeof src.question === 'string') return src.question;
    if (typeof src.q === 'string') return src.q;
    return '';
}

// Today's question in the current bank, or in the previous bank while
// validUntil is open. The previous copy is used only when the client's
// index is that version's daily index and, if they sent question text,
// the text matches too. One caller still records a single daily claim.
function selectTriviaQuestion(src, now) {
    const today = offsetDateKey(now);
    const questionIndex = Number(src.questionIndex);
    const currentIndex = triviaIndexForDay(today);
    const currentQ = triviaQuestion(currentIndex);
    const prev = activePrevious(now, src.prev);
    const prevLen = prev && Array.isArray(prev.trivia) ? prev.trivia.length : 0;
    const prevIndex = prevLen ? triviaIndexForDay(today, prevLen) : -1;
    const prevQ = prevIndex >= 0 ? triviaQuestionFrom(prev.trivia[prevIndex]) : null;
    const currentHit = Number.isInteger(questionIndex) && questionIndex === currentIndex;
    const prevHit = !!(prevQ && Number.isInteger(questionIndex) && questionIndex === prevIndex);
    if (!currentHit && !prevHit) {
        return { ok: false, reason: 'wrong-question', questionIndex: currentIndex };
    }
    const text = clientQuestionText(src);
    if (text) {
        if (currentHit && currentQ && text === currentQ.q) return { ok: true, question: currentQ, questionIndex: currentIndex };
        if (prevHit && prevQ && text === prevQ.q) return { ok: true, question: prevQ, questionIndex: prevIndex };
        return { ok: false, reason: 'wrong-question', questionIndex: currentIndex };
    }
    if (currentHit && prevHit && currentQ && prevQ && currentQ.q !== prevQ.q) {
        const prevRight = triviaChoiceCorrect(prevQ, src.chosen);
        const currentRight = triviaChoiceCorrect(currentQ, src.chosen);
        if (prevRight && !currentRight) return { ok: true, question: prevQ, questionIndex: prevIndex };
        return { ok: true, question: currentQ, questionIndex: currentIndex };
    }
    if (prevHit && !currentHit && prevQ) return { ok: true, question: prevQ, questionIndex: prevIndex };
    if (!currentQ) return { ok: false, reason: 'wrong-question', questionIndex: currentIndex };
    return { ok: true, question: currentQ, questionIndex: currentIndex };
}

function gradeTrivia(input) {
    const src = input || {};
    const now = src.now == null ? Date.now() : src.now;
    const today = offsetDateKey(now);
    const dayKey = String(src.dayKey || '');
    if (dayKey !== today) {
        return { ok: false, correct: false, awarded: 0, overflowAdded: 0, capped: false, pts: 0, reason: 'wrong-day', optionIndex: -1 };
    }
    const choice = triviaChoiceFrom(src);
    const selected = selectTriviaQuestion(Object.assign({}, src, { chosen: choice }), now);
    if (!selected.ok) {
        return { ok: false, correct: false, awarded: 0, overflowAdded: 0, capped: false, pts: 0, reason: selected.reason, questionIndex: selected.questionIndex, optionIndex: -1 };
    }
    const question = selected.question;
    const expected = selected.questionIndex;
    const optionIndex = choice == null ? -1 : triviaOptionIndex(question, choice);
    const correct = optionIndex >= 0 && triviaChoiceCorrect(question, choice);
    // Returned only after the choice is graded. A wrong day or wrong question
    // leaves before this, so a probe does not learn the answer.
    const explanation = typeof question.explanation === 'string' ? question.explanation : '';
    const answerIndex = Number.isInteger(question.answer) ? question.answer : -1;
    if (src.banned === true) {
        return { ok: true, correct: correct, awarded: 0, overflowAdded: 0, capped: false, pts: 0, reason: 'banned', banned: true, questionIndex: expected, optionIndex: optionIndex, explanation: explanation, answerIndex: answerIndex };
    }
    const pts = correct ? TRIVIA_CORRECT_XP : 0;
    const split = planDailyXp(src.dailyUsed || 0, pts);
    return {
        ok: true,
        correct: correct,
        awarded: split.awarded,
        overflowAdded: split.overflowAdded,
        capped: split.capped,
        pts: pts,
        reason: correct ? '' : 'incorrect',
        questionIndex: expected,
        optionIndex: optionIndex,
        explanation: explanation,
        answerIndex: answerIndex,
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
    const now = src.serverNow == null ? Date.now() : src.serverNow;
    const prev = activePrevious(now, src.prev);
    const olderParts = previousQuestParts(prev);
    const seen = Object.create(null);
    const matched = [];
    let score = 0;
    for (let i = 0; i < objects.length; i++) {
        const ans = objects[i];
        const topicKey = sanitizeTopic(ans.topicKey) || fallbackTopic;
        const questIndex = (ans.questIndex == null || ans.questIndex === '') ? fallbackIndex : clampIndex(ans.questIndex);
        let question = lookupQuestionIn(questParts, topicKey, questIndex, ans);
        let bank = question ? 'current' : '';
        if (!question && olderParts) {
            question = lookupQuestionIn(olderParts, topicKey, questIndex, ans);
            if (question) bank = 'prev';
        }
        if (!question) continue;
        const seenKey = topicKey + ':' + questIndex + ':' + question.qHash;
        if (seen[seenKey]) continue;
        seen[seenKey] = true;
        matched.push({ topicKey: topicKey, questIndex: questIndex, qHash: question.qHash, bank: bank });
        let correct = choiceCorrect(question, ans);
        if (!correct && bank === 'current' && olderParts) {
            const prior = lookupQuestionIn(olderParts, topicKey, questIndex, ans);
            if (prior && choiceCorrect(prior, ans)) correct = true;
        }
        if (correct) score++;
    }
    // A full previous part still counts when only some questions changed.
    // Unchanged questions are found in the current bank, so the rows can
    // carry both bank tags and still be that previous part.
    const part = samePart(matched, { current: questParts, prev: olderParts });
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

function partHashes(part) {
    if (!part) return null;
    const expected = Object.keys(part).sort();
    if (expected.length !== 5) return null;
    return expected;
}

function sameHashes(expected, matched) {
    if (!expected) return false;
    const got = matched.map(function(m) { return m.qHash; }).sort();
    for (let i = 0; i < 5; i++) {
        if (got[i] !== expected[i]) return false;
    }
    return true;
}

// The five questions are one part when they are exactly that part in the
// current bank or exactly that part in the previous bank. Mixed bank tags
// are fine: an edited question is previous-only, and the rest still resolve
// from the current bank.
function samePart(matched, partsByBank) {
    if (!matched || matched.length !== 5) return null;
    const topicKey = matched[0].topicKey;
    const questIndex = matched[0].questIndex;
    for (let i = 1; i < matched.length; i++) {
        if (matched[i].topicKey !== topicKey || matched[i].questIndex !== questIndex) return null;
    }
    const banks = partsByBank || {};
    const currentPart = banks.current && banks.current[topicKey] && banks.current[topicKey][questIndex];
    const prevPart = banks.prev && banks.prev[topicKey] && banks.prev[topicKey][questIndex];
    if (!sameHashes(partHashes(currentPart), matched) && !sameHashes(partHashes(prevPart), matched)) return null;
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
    // stored on completedQuests. It blocks a repeat for this part on the
    // current bank and on the previous bank during the grace window, including
    // when this call will not write the completion doc.
    const already = src.alreadyPerfect === true;
    const pts = already ? 0 : (graded.pts || 0);
    const split = planDailyXp(src.dailyUsed || 0, pts);
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
    nextActivityStreak: nextActivityStreak,
    nextCallRate: nextCallRate,
    gradeTrivia: gradeTrivia,
    gradeQuestSubmission: gradeQuestSubmission,
    questCompletionKey: questCompletionKey,
    legacyPartRecorded: legacyPartRecorded,
    settleQuizReward: settleQuizReward,
};
