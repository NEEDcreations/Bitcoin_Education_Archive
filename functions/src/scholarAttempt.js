'use strict';

const crypto = require('crypto');
const bank = require('./scholar-questions.json');

// Players see a 10-minute timer. The attempt stays open for that same
// 10 minutes after the server start time, plus this grace period so a
// submit that is already on the wire can still land.
const EXAM_LIMIT_MS = 10 * 60 * 1000;
const EXAM_GRACE_MS = 2 * 60 * 1000;
const EXAM_MIN_SUBMIT_MS = 60 * 1000;
const EXAM_SIZE = 25;

const POOL_LENGTHS = {
    properties: bank.properties.length,
    technical: bank.technical.length,
};

function utcDay(now) {
    return new Date(now).toISOString().slice(0, 10);
}

function expired(startedAtMs, now) {
    const started = Number(startedAtMs);
    if (!Number.isFinite(started)) return true;
    return Number(now) > started + EXAM_LIMIT_MS + EXAM_GRACE_MS;
}

function tooFast(startedAtMs, now) {
    const started = Number(startedAtMs);
    if (!Number.isFinite(started)) return true;
    return Number(now) < started + EXAM_MIN_SUBMIT_MS;
}

function newExamId() {
    return 'ex_' + crypto.randomBytes(12).toString('hex');
}

function opaqueOptionId(used) {
    let id = crypto.randomBytes(6).toString('hex');
    while (used.has(id)) id = crypto.randomBytes(6).toString('hex');
    used.add(id);
    return id;
}

// Partial Fisher-Yates. Every subset of `count` indexes is equally likely.
function sampleWithoutReplacement(length, count, rng) {
    const random = rng || Math.random;
    if (count > length) throw new Error('pool smaller than draw');
    const arr = [];
    for (let i = 0; i < length; i++) arr.push(i);
    for (let i = 0; i < count; i++) {
        const span = length - i;
        const j = i + Math.floor(random() * span);
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
    return arr.slice(0, count);
}

function poolFor(type) {
    if (type === 'technical') return bank.technical;
    if (type === 'properties') return bank.properties;
    return null;
}

function shuffle(list, rng) {
    const random = rng || Math.random;
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
    }
    return out;
}

function drawExam(type, rng) {
    const pool = poolFor(type);
    if (!pool || pool.length < EXAM_SIZE) throw new Error('Exam bank misconfigured');
    const random = rng || Math.random;
    const picks = sampleWithoutReplacement(pool.length, EXAM_SIZE, random);
    const questions = [];
    const served = [];
    const usedIds = new Set();
    for (let i = 0; i < picks.length; i++) {
        const item = pool[picks[i]];
        const texts = shuffle([item.a].concat(item.w), random);
        const options = texts.map(function (text) {
            return { id: opaqueOptionId(usedIds), text: text };
        });
        let correctOptionId = '';
        const optionIds = [];
        for (let o = 0; o < options.length; o++) {
            optionIds.push(options[o].id);
            if (options[o].text === item.a && !correctOptionId) correctOptionId = options[o].id;
        }
        questions.push({ id: item.id, q: item.q, options: options });
        served.push({
            questionId: item.id,
            correctOptionId: correctOptionId,
            optionIds: optionIds,
        });
    }
    return { questions: questions, served: served };
}

function gradeByOptionId(served, answers) {
    if (!Array.isArray(served) || served.length !== EXAM_SIZE) {
        return { ok: false, reason: 'invalid', score: 0 };
    }
    if (!Array.isArray(answers)) return { ok: false, reason: 'invalid', score: 0 };
    const byId = {};
    for (let i = 0; i < served.length; i++) byId[served[i].questionId] = served[i];
    const seen = {};
    let score = 0;
    let recognized = 0;
    for (let i = 0; i < answers.length; i++) {
        const row = answers[i];
        if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
        const qid = row.questionId;
        const oid = row.optionId;
        if (typeof qid !== 'string' || typeof oid !== 'string') continue;
        if (!byId[qid]) return { ok: false, reason: 'unserved', score: 0 };
        if (seen[qid]) return { ok: false, reason: 'duplicate', score: 0 };
        seen[qid] = true;
        recognized++;
        if (oid === byId[qid].correctOptionId) score++;
    }
    if (answers.length && recognized === 0) {
        return { ok: true, reason: 'invalid', score: 0 };
    }
    return { ok: true, score: score };
}

module.exports = {
    EXAM_LIMIT_MS: EXAM_LIMIT_MS,
    EXAM_GRACE_MS: EXAM_GRACE_MS,
    EXAM_MIN_SUBMIT_MS: EXAM_MIN_SUBMIT_MS,
    EXAM_SIZE: EXAM_SIZE,
    POOL_LENGTHS: POOL_LENGTHS,
    utcDay: utcDay,
    expired: expired,
    tooFast: tooFast,
    newExamId: newExamId,
    sampleWithoutReplacement: sampleWithoutReplacement,
    poolFor: poolFor,
    drawExam: drawExam,
    gradeByOptionId: gradeByOptionId,
};
