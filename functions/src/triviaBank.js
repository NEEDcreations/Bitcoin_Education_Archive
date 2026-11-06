'use strict';

// Same daily question the client rotates. The shipped file is questions and
// options only, so this grade cannot know the correct slot. answerTrivia
// loads that key from Firestore. A missing answer is not correct.

const fs = require('fs');
const path = require('path');

let bank = null;

function load() {
    if (bank) return bank;
    // Shipped inside functions/ so a functions-only deploy can grade trivia.
    const src = fs.readFileSync(path.join(__dirname, 'trivia-bank.js'), 'utf8');
    bank = new Function(src + '\nreturn TRIVIA_BANK;')();
    return bank;
}

function questionForDay(day) {
    const questions = load();
    const dkMs = Date.parse(String(day || '') + 'T00:00:00Z');
    const epoch = Date.parse('2026-01-01T00:00:00Z');
    if (!Number.isFinite(dkMs) || !questions || !questions.length) return null;
    const dayIndex = Math.floor((dkMs - epoch) / 86400000);
    const seed = ((dayIndex * 7 + 2026) % questions.length + questions.length) % questions.length;
    const row = questions[seed] || {};
    const options = Array.isArray(row.options) ? row.options : [];
    return { index: seed, answer: row.answer, optionCount: options.length };
}

function grade(day, choice) {
    const question = questionForDay(day);
    if (!question) return { correct: false, graded: false };
    if (choice == null || choice === '') return { correct: false, graded: false };
    const picked = Number(choice);
    if (!Number.isInteger(picked) || picked < 0 || picked >= question.optionCount) {
        return { correct: false, graded: true };
    }
    return { correct: picked === question.answer, graded: true };
}

module.exports = {
    load: load,
    questionForDay: questionForDay,
    grade: grade,
};
