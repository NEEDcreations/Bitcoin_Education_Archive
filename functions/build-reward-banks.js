#!/usr/bin/env node
'use strict';

// Copies the client trivia, quiz, and learning-quest banks into
// functions/reward-banks.json. Cloud Functions grade from that file.
// build.sh runs this. tests/test-quest-reward.js fails if the committed
// file drifts from the client sources.
//
// When the committed bank differs from the fresh build, the previous
// committed bank is saved as functions/reward-banks.prev.json with
// validUntil 72 hours later. A second run that does not change the bank
// leaves that snapshot and its timestamp alone.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'functions', 'reward-banks.json');
const PREV = path.join(ROOT, 'functions', 'reward-banks.prev.json');
const GRACE_MS = 72 * 60 * 60 * 1000;

function matchBracket(src, openIndex, openChar, closeChar) {
    let depth = 0;
    let i = openIndex;
    let quote = null;
    while (i < src.length) {
        const c = src[i];
        if (quote) {
            if (c === '\\') { i += 2; continue; }
            if (c === quote) quote = null;
            i++;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') { quote = c; i++; continue; }
        if (c === '/' && src[i + 1] === '/') {
            const nl = src.indexOf('\n', i);
            i = nl === -1 ? src.length : nl;
            continue;
        }
        if (c === '/' && src[i + 1] === '*') {
            const end = src.indexOf('*/', i + 2);
            i = end === -1 ? src.length : end + 2;
            continue;
        }
        if (c === openChar) depth++;
        else if (c === closeChar) {
            depth--;
            if (depth === 0) return i;
        }
        i++;
    }
    throw new Error('Unbalanced ' + openChar + ' starting at ' + openIndex);
}

function evalSource(src, exportName) {
    const fn = new Function(src + '\nreturn ' + exportName + ';');
    return fn();
}

function sliceNamed(src, decl, openChar, closeChar) {
    const at = src.indexOf(decl);
    if (at === -1) throw new Error('Missing ' + decl);
    const open = src.indexOf(openChar, at);
    const close = matchBracket(src, open, openChar, closeChar);
    return src.slice(at, close + 1);
}

function questRows(list) {
    const rows = [];
    for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (!item || typeof item.q !== 'string' || typeof item.a !== 'string' || !Array.isArray(item.wrong)) {
            throw new Error('Malformed quiz question at index ' + i);
        }
        rows.push({
            q: item.q,
            a: item.a,
            wrong: item.wrong.slice(),
            questIndex: Math.floor(i / 5),
        });
    }
    return rows;
}

function buildBanks() {
    const triviaSrc = fs.readFileSync(path.join(ROOT, 'data', 'trivia-bank.js'), 'utf8');
    const trivia = evalSource(triviaSrc, 'TRIVIA_BANK');
    if (!Array.isArray(trivia) || !trivia.length) throw new Error('TRIVIA_BANK missing');

    const questSrc = fs.readFileSync(path.join(ROOT, 'quests.js'), 'utf8');
    const questionBank = evalSource(
        sliceNamed(questSrc, 'const QUESTION_BANK = {', '{', '}'),
        'QUESTION_BANK'
    );

    const lqSrc = fs.readFileSync(path.join(ROOT, 'learning-quests.js'), 'utf8');
    const topics = evalSource(
        sliceNamed(lqSrc, 'var LQ_TOPICS = [', '[', ']'),
        'LQ_TOPICS'
    );

    const triviaOut = trivia.map(function(item, i) {
        if (!item || typeof item.q !== 'string' || !Array.isArray(item.options) || item.options.length !== 4) {
            throw new Error('Malformed trivia question at ' + i);
        }
        if (!Number.isInteger(item.answer) || item.answer < 0 || item.answer > 3) {
            throw new Error('Trivia answer out of range at ' + i);
        }
        return { q: item.q, options: item.options.slice(), answer: item.answer };
    });

    const quests = {};
    Object.keys(questionBank).sort().forEach(function(topic) {
        quests[topic] = questRows(questionBank[topic]);
    });

    const learning = {};
    topics.forEach(function(topic) {
        if (!topic || typeof topic.slug !== 'string' || !Array.isArray(topic.questions)) {
            throw new Error('Malformed learning topic');
        }
        learning[topic.slug] = questRows(topic.questions);
    });

    return { trivia: triviaOut, quests: quests, learning: learning };
}

function bankBody(doc) {
    if (!doc || !Array.isArray(doc.trivia) || !doc.quests || !doc.learning) return null;
    return { trivia: doc.trivia, quests: doc.quests, learning: doc.learning };
}

// Previous committed banks, kept for GRACE_MS after a content change.
// Identical banks do not refresh validUntil or replace an existing snapshot.
function snapshotPrevious(committed, fresh, now, existingPrev) {
    const previous = bankBody(committed);
    if (!previous) return existingPrev || null;
    const next = bankBody(fresh);
    const same = !!next && JSON.stringify(previous) === JSON.stringify(next);
    if (same && existingPrev && existingPrev.validUntil != null) return existingPrev;
    return {
        validUntil: Number(now) + GRACE_MS,
        trivia: previous.trivia,
        quests: previous.quests,
        learning: previous.learning,
    };
}

function readJson(file) {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function main() {
    const banks = buildBanks();
    const committed = readJson(OUT);
    const existingPrev = readJson(PREV);
    const prev = snapshotPrevious(committed, banks, Date.now(), existingPrev);
    fs.writeFileSync(OUT, JSON.stringify(banks));
    if (prev && prev !== existingPrev) fs.writeFileSync(PREV, JSON.stringify(prev));
    const questCount = Object.keys(banks.quests).reduce(function(n, key) {
        return n + banks.quests[key].length;
    }, 0);
    const learnCount = Object.keys(banks.learning).reduce(function(n, key) {
        return n + banks.learning[key].length;
    }, 0);
    const until = prev && prev.validUntil ? new Date(prev.validUntil).toISOString() : 'none';
    console.log('reward-banks.json trivia=' + banks.trivia.length + ' quiz=' + questCount + ' learning=' + learnCount + ' prevUntil=' + until);
}

if (require.main === module) main();

module.exports = { buildBanks: buildBanks, snapshotPrevious: snapshotPrevious, GRACE_MS: GRACE_MS };
