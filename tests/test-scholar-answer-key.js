#!/usr/bin/env node
'use strict';

// The built client and the public pages must not carry the answer key.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const bank = require('../functions/src/scholar-questions.json');
const files = [
    'scholar.js',
    'app.js',
    'bundle.js',
    'bundle.min.js',
    'bundle.src.js',
    'index.html',
    '404.html',
    'shareable-certs.js',
];

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (err) {
        console.log('❌ ' + name + ': ' + (err && err.message ? err.message : err));
        failed++;
    }
}

test('client files do not contain the answer key', function () {
    const blobs = files.map(function (name) {
        return { name: name, text: fs.readFileSync(path.join(root, name), 'utf8') };
    });
    // Quoted so the exam placeholder does not match the trivia sentence
    // "The correct answer is highlighted."
    const banned = [
        'correctOptionId',
        'SCHOLAR_PROPERTIES_POOL',
        'SCHOLAR_TECHNICAL_POOL',
        '"The correct answer"',
        '"The question"',
        '"Distractor 1"',
        '"Distractor 2"',
        '"Distractor 3"',
        '"Distractor 4"',
    ];
    blobs.forEach(function (file) {
        banned.forEach(function (needle) {
            assert.ok(!file.text.includes(needle), file.name + ' contains ' + needle);
        });
    });
    const answers = bank.properties.concat(bank.technical).map(function (q) { return q.a; });
    answers.forEach(function (answer) {
        const compact = '"a":' + JSON.stringify(answer);
        const spaced = '"a": ' + JSON.stringify(answer);
        blobs.forEach(function (file) {
            assert.ok(!file.text.includes(compact) && !file.text.includes(spaced), file.name + ' still has an answer field');
        });
    });
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
