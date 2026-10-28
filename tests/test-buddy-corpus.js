#!/usr/bin/env node
'use strict';

const assert = require('assert');
const safety = require('../functions/src/buddySafety');
const corpus = require('./buddy-risk-corpus');

let passed = 0;
let failed = 0;
const counts = { lock: 0, open: 0, pairLock: 0, pairOpen: 0 };

function check(name, fn) {
    try {
        fn();
        passed++;
    } catch (err) {
        failed++;
        console.log('❌ ' + name);
        console.log('   ' + (err && err.message ? err.message : err));
    }
}

corpus.lock.forEach(function (text) {
    check('lock: ' + text, function () {
        const found = safety.detectBuddyRisk(text);
        assert.strictEqual(found.lock, true, found.reasons.join(','));
        counts.lock++;
    });
});

corpus.open.forEach(function (text) {
    check('open: ' + text, function () {
        const found = safety.detectBuddyRisk(text);
        assert.strictEqual(found.lock, false, found.severity + ' ' + found.reasons.join(','));
        counts.open++;
    });
});

corpus.pairs.forEach(function (row) {
    const label = (row.lock ? 'pair lock: ' : 'pair open: ') + row.previous + ' || ' + row.text;
    check(label, function () {
        const now = row.now || 2000;
        const previousAt = row.previousAt || 1000;
        const found = safety.detectBuddyRisk(row.text, {
            previousText: row.previous,
            previousAt: previousAt,
            now: now,
            unlockedAt: row.unlockedAt || 0,
        });
        assert.strictEqual(found.lock, row.lock, found.severity + ' ' + found.reasons.join(','));
        if (row.lock) counts.pairLock++;
        else counts.pairOpen++;
    });
});

console.log('corpus lock ' + counts.lock + ', no-lock ' + counts.open + ', pair lock ' + counts.pairLock + ', pair no-lock ' + counts.pairOpen);
console.log(passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
