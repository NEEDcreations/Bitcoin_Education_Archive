#!/usr/bin/env node
'use strict';

// The built client, the public pages, and the repo must not carry the exam key.
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
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
const removed = [
    'functions/src/scholar-questions.json',
    'functions/scholar-bank.json',
];
const bannedHashes = {
    a3c3d418560d3dc48f85352d991a1cfea455b95678a5e1017358ba7f9e86dfc1: 'properties and technical answer bank',
    d055db7a1d582f98a394891f13ddfdf497f88a9f0f6ca7481c59fa39ec14e91e: 'legacy scholar bank',
};

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

function tracked() {
    return execFileSync('git', ['ls-files', '-z'], { cwd: root })
        .toString('utf8')
        .split('\0')
        .filter(Boolean);
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
});

test('the old bank paths are gone and no tracked file still names them', function () {
    const listed = tracked();
    removed.forEach(function (rel) {
        assert.ok(!fs.existsSync(path.join(root, rel)), rel + ' is still on disk');
        assert.ok(listed.indexOf(rel) === -1, rel + ' is still tracked');
    });
    listed.forEach(function (rel) {
        if (rel === 'tests/test-scholar-answer-key.js') return;
        if (!/\.(js|html|md|json)$/.test(rel)) return;
        if (rel.indexOf('node_modules/') !== -1) return;
        const text = fs.readFileSync(path.join(root, rel), 'utf8');
        removed.forEach(function (oldPath) {
            assert.ok(!text.includes(oldPath), rel + ' mentions ' + oldPath);
        });
    });
});

test('tracked function JSON does not hold a scholar answer key', function () {
    const listed = tracked().filter(function (rel) {
        return rel.indexOf('functions/') === 0 && rel.endsWith('.json') && rel.indexOf('node_modules/') === -1 && rel.indexOf('functions/private-bank/') !== 0;
    });
    let qa = 0;
    let correct = 0;
    function walk(value) {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) {
            value.forEach(walk);
            return;
        }
        // Exam rows are q, a, and w. Quest banks use wrong, and trivia uses a numeric answer.
        if (typeof value.q === 'string' && typeof value.a === 'string' && Array.isArray(value.w)) qa++;
        if (typeof value.correct === 'string' || typeof value.correctOptionId === 'string') correct++;
        Object.keys(value).forEach(function (key) { walk(value[key]); });
    }
    listed.forEach(function (rel) {
        walk(JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')));
    });
    assert.ok(qa <= 20, 'string q+a pairs: ' + qa);
    assert.ok(correct <= 20, 'correct keys: ' + correct);
});

test('no tracked file is a copy of the removed banks', function () {
    tracked().forEach(function (rel) {
        if (rel.indexOf('node_modules/') !== -1 || rel.indexOf('functions/private-bank/') === 0) return;
        const file = path.join(root, rel);
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return;
        const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
        assert.ok(!bannedHashes[hash], rel + ' matches ' + bannedHashes[hash]);
    });
});

test('exam callables enforce App Check and public verify does not', function () {
    const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    const start = index.slice(index.indexOf('exports.startScholarExam'), index.indexOf('exports.gradeScholarExam'));
    const grade = index.slice(index.indexOf('exports.gradeScholarExam'), index.indexOf('exports.startQuest'));
    const issue = index.slice(index.indexOf('exports.issueCertificate'), index.indexOf('exports.verifyCertificate'));
    const verify = index.slice(index.indexOf('exports.verifyCertificate'), index.indexOf('exports.onChatMessageCreated'));
    assert.ok(start.includes('enforceAppCheck: true'));
    assert.ok(grade.includes('enforceAppCheck: true'));
    assert.ok(issue.includes('enforceAppCheck: true'));
    assert.ok(issue.includes('snapshotName'));
    assert.ok(!verify.includes('enforceAppCheck'));
    assert.ok(verify.includes('verifyView'));
    const attemptSrc = fs.readFileSync(path.join(root, 'functions', 'src', 'scholarAttempt.js'), 'utf8');
    assert.ok(attemptSrc.includes('crypto.randomInt'));
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const certs = rules.slice(rules.indexOf('match /certs/{certId}'), rules.indexOf('match /cert_owners/'));
    assert.ok(certs.includes('allow read: if false'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
