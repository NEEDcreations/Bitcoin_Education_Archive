'use strict';

// The daily trivia answer key lives in private_banks/trivia.
// Clients cannot read that doc. This module caches a valid key in memory
// and returns null when the doc is missing or does not match the public
// question set, so grading fails closed.

const banks = require('../reward-banks.json');

const CACHE_MS = 5 * 60 * 1000;
const DOC_PATH = ['private_banks', 'trivia'];

let cached = null;
let cachedAt = 0;
let testOverride = { on: false, rows: null };

function publicTriviaRows() {
    return Array.isArray(banks.trivia) ? banks.trivia : [];
}

function questionsAligned(rows, pub) {
    const open = pub || publicTriviaRows();
    if (!Array.isArray(rows) || !Array.isArray(open) || rows.length !== open.length || !rows.length) return null;
    const out = [];
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const known = open[i];
        if (!row || !known || row.q !== known.q) return null;
        if (!Array.isArray(row.options) || !Array.isArray(known.options) || row.options.length !== 4) return null;
        if (known.options.length !== 4) return null;
        for (let j = 0; j < 4; j++) {
            if (row.options[j] !== known.options[j]) return null;
        }
        if (!Number.isInteger(row.answer) || row.answer < 0 || row.answer > 3) return null;
        if (typeof row.explanation !== 'string' || !row.explanation) return null;
        out.push({
            q: row.q,
            options: row.options.slice(),
            answer: row.answer,
            explanation: row.explanation,
        });
    }
    return out;
}

function rowsFromDoc(data) {
    if (!data || typeof data !== 'object') return null;
    if (Array.isArray(data.questions)) return data.questions;
    if (Array.isArray(data.trivia)) return data.trivia;
    return null;
}

function clearTriviaKeyCache() {
    cached = null;
    cachedAt = 0;
}

// Tests pass a fake key here. Production leaves the override off.
function useTriviaKeyForTests(rows) {
    testOverride = { on: true, rows: rows };
    clearTriviaKeyCache();
}

function resetTriviaKeyForTests() {
    testOverride = { on: false, rows: null };
    clearTriviaKeyCache();
}

async function loadTriviaKey(db, publicRows, nowMs) {
    if (testOverride.on) return testOverride.rows;
    const now = nowMs == null ? Date.now() : nowMs;
    if (cached && now - cachedAt < CACHE_MS) return cached;
    let snap = null;
    try {
        snap = await db.collection(DOC_PATH[0]).doc(DOC_PATH[1]).get();
    } catch (err) {
        return null;
    }
    if (!snap || snap.exists !== true) return null;
    const aligned = questionsAligned(rowsFromDoc(snap.data()), publicRows || publicTriviaRows());
    if (!aligned) return null;
    cached = aligned;
    cachedAt = now;
    return cached;
}

module.exports = {
    CACHE_MS: CACHE_MS,
    DOC_PATH: DOC_PATH,
    questionsAligned: questionsAligned,
    rowsFromDoc: rowsFromDoc,
    loadTriviaKey: loadTriviaKey,
    clearTriviaKeyCache: clearTriviaKeyCache,
    useTriviaKeyForTests: useTriviaKeyForTests,
    resetTriviaKeyForTests: resetTriviaKeyForTests,
    publicTriviaRows: publicTriviaRows,
};
