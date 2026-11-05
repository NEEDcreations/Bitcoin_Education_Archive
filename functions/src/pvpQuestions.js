'use strict';

// PvP questions come from the server's own quiz bank (reward-banks.json,
// built from QUESTION_BANK). The answer key is derived here. Anything the
// client sends as questions or answers is ignored.

const crypto = require('crypto');

let pool = null;

function validRow(r) {
    if (!r || typeof r.q !== 'string' || !r.q || r.q.length > 300) return false;
    if (typeof r.a !== 'string' || !r.a || r.a.length > 200) return false;
    if (!Array.isArray(r.wrong) || r.wrong.length < 1 || r.wrong.length > 5) return false;
    for (const w of r.wrong) {
        if (typeof w !== 'string' || !w || w.length > 200 || w === r.a) return false;
    }
    return true;
}

function buildPool(bank) {
    const out = [];
    const src = bank && typeof bank === 'object' ? bank : {};
    Object.keys(src).forEach(function (k) {
        const rows = Array.isArray(src[k]) ? src[k] : [];
        rows.forEach(function (r) { if (validRow(r)) out.push({ q: r.q, a: r.a, wrong: r.wrong.slice() }); });
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

// Returns [{ q, options, correct }] with options shuffled server-side.
function pickQuestions(count, opts) {
    const o = opts || {};
    const rows = o.pool || loadPool();
    const n = Math.max(1, Math.min(5, Math.floor(Number(count) || 5)));
    if (!rows.length) return [];
    const idx = rows.map(function (_, i) { return i; });
    for (let i = idx.length - 1; i > 0; i--) {
        const j = randInt(i + 1, o.rng);
        const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
    }
    return idx.slice(0, Math.min(n, rows.length)).map(function (i) {
        const r = rows[i];
        const options = r.wrong.slice();
        const at = randInt(options.length + 1, o.rng);
        options.splice(at, 0, r.a);
        return { q: r.q, options: options, correct: at };
    });
}

module.exports = { buildPool: buildPool, loadPool: loadPool, pickQuestions: pickQuestions, validRow: validRow };
