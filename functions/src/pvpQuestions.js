'use strict';

// PvP questions come from the server's own quiz bank (reward-banks.json,
// built from QUESTION_BANK). The answer key is derived here. Anything the
// client sends as questions or answers is ignored.

const crypto = require('crypto');

let pool = null;

function isTimeSensitive(r) {
    if (!r || typeof r !== 'object') return false;
    return r.timeSensitive === true || r.time_sensitive === true || r.stale === true;
}

function validRow(r) {
    if (!r || typeof r.q !== 'string' || !r.q || r.q.length > 300) return false;
    if (typeof r.a !== 'string' || !r.a || r.a.length > 200) return false;
    if (!Array.isArray(r.wrong) || r.wrong.length < 1 || r.wrong.length > 5) return false;
    for (const w of r.wrong) {
        if (typeof w !== 'string' || !w || w.length > 200 || w === r.a) return false;
    }
    return true;
}

function optionalExplain(r) {
    const raw = r && (r.explain || r.explanation);
    if (typeof raw !== 'string') return '';
    const s = raw.trim();
    if (!s || s.length > 400) return '';
    return s;
}

function optionalDifficulty(r) {
    const raw = r && (r.difficulty || r.diff || r.level);
    if (typeof raw !== 'string') return '';
    const s = raw.trim().toLowerCase();
    if (!s || s.length > 20) return '';
    return s;
}

function buildPool(bank) {
    const out = [];
    const src = bank && typeof bank === 'object' ? bank : {};
    Object.keys(src).forEach(function (k) {
        const rows = Array.isArray(src[k]) ? src[k] : [];
        rows.forEach(function (r) {
            if (!validRow(r)) return;
            const row = { q: r.q, a: r.a, wrong: r.wrong.slice(), topic: String(k || '_') };
            const explain = optionalExplain(r);
            if (explain) row.explain = explain;
            const difficulty = optionalDifficulty(r);
            if (difficulty) row.difficulty = difficulty;
            if (isTimeSensitive(r)) row.timeSensitive = true;
            out.push(row);
        });
    });
    return out;
}

function loadPool() {
    if (pool) return pool;
    const banks = require('../reward-banks.json');
    pool = buildPool(banks.quests);
    return pool;
}

function randInt(n, rng) {
    if (rng) return Math.floor(rng() * n);
    return crypto.randomInt(n);
}

function shuffleInPlace(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = randInt(i + 1, rng);
        const t = arr[i];
        arr[i] = arr[j];
        arr[j] = t;
    }
    return arr;
}

function usableRows(rows, opts) {
    const o = opts || {};
    const exclude = {};
    (o.exclude || []).forEach(function (q) {
        if (q) exclude[String(q)] = true;
    });
    const available = (rows || []).filter(function (r) { return r && r.q && !exclude[r.q]; });
    const fresh = available.filter(function (r) { return !r.timeSensitive; });
    // Only skip flagged rows when a flag exists and other questions remain.
    return fresh.length ? fresh : available;
}

// Prefer a mix of topics (and difficulty, when the bank has that field).
// Never repeats a question text in one pick. exclude: prior question texts.
function pickRows(count, opts) {
    const o = opts || {};
    const rows = usableRows(o.pool || loadPool(), o);
    const n = Math.max(1, Math.min(5, Math.floor(Number(count) || 5)));
    if (!rows.length) return [];

    const byTopic = {};
    rows.forEach(function (r) {
        const t = r.topic || '_';
        (byTopic[t] = byTopic[t] || []).push(r);
    });
    Object.keys(byTopic).forEach(function (t) { shuffleInPlace(byTopic[t], o.rng); });

    const hasDiff = rows.some(function (r) { return !!r.difficulty; });
    const topicOrder = shuffleInPlace(Object.keys(byTopic), o.rng);
    const picked = [];
    const used = {};
    const diffCounts = {};

    function takeFrom(list, preferDiff) {
        for (let i = 0; i < list.length; i++) {
            const row = list[i];
            if (used[row.q]) continue;
            if (preferDiff && row.difficulty !== preferDiff) continue;
            used[row.q] = true;
            list.splice(i, 1);
            return row;
        }
        return null;
    }

    let safety = 0;
    while (picked.length < n && safety < n * 30) {
        safety++;
        const before = picked.length;
        let wantDiff = '';
        if (hasDiff) {
            const seen = Object.keys(diffCounts);
            if (seen.length) {
                wantDiff = seen.sort(function (a, b) { return (diffCounts[a] || 0) - (diffCounts[b] || 0); })[0];
                // After the first pick, prefer a difficulty we have less of, but
                // also try unseen difficulties first.
                const allDiffs = [];
                rows.forEach(function (r) {
                    if (r.difficulty && allDiffs.indexOf(r.difficulty) === -1) allDiffs.push(r.difficulty);
                });
                allDiffs.sort(function (a, b) { return (diffCounts[a] || 0) - (diffCounts[b] || 0); });
                wantDiff = allDiffs[0] || '';
            }
        }
        for (let t = 0; t < topicOrder.length && picked.length < n; t++) {
            const list = byTopic[topicOrder[t]];
            if (!list || !list.length) continue;
            let row = wantDiff ? takeFrom(list, wantDiff) : null;
            if (!row) row = takeFrom(list, '');
            if (!row) continue;
            picked.push(row);
            if (row.difficulty) diffCounts[row.difficulty] = (diffCounts[row.difficulty] || 0) + 1;
        }
        if (picked.length === before) break;
    }
    return picked.slice(0, Math.min(n, rows.length));
}

// Returns [{ q, options, correct, explain? }] with options shuffled server-side.
function pickQuestions(count, opts) {
    const o = opts || {};
    return pickRows(count, o).map(function (r) {
        const options = r.wrong.slice();
        const at = randInt(options.length + 1, o.rng);
        options.splice(at, 0, r.a);
        const out = { q: r.q, options: options, correct: at };
        if (r.explain) out.explain = r.explain;
        return out;
    });
}

module.exports = {
    buildPool: buildPool,
    loadPool: loadPool,
    pickQuestions: pickQuestions,
    validRow: validRow,
    isTimeSensitive: isTimeSensitive,
};
