#!/usr/bin/env node
'use strict';

const assert = require('assert');
const safety = require('../functions/src/buddySafety');
const corpus = require('./buddy-risk-corpus');

let passed = 0;
let failed = 0;
const counts = { lock: 0, flag: 0, none: 0, pairLock: 0, pairOpen: 0 };

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

corpus.flag.forEach(function (text) {
    check('flag: ' + text, function () {
        const found = safety.detectBuddyRisk(text);
        assert.strictEqual(found.lock, false, found.tier + ' ' + found.reasons.join(','));
        assert.strictEqual(found.tier, 'flag', found.severity + ' ' + found.reasons.join(','));
        counts.flag++;
    });
});

corpus.none.forEach(function (text) {
    check('none: ' + text, function () {
        const found = safety.detectBuddyRisk(text);
        assert.strictEqual(found.lock, false, found.tier);
        assert.strictEqual(found.tier, 'none', found.severity + ' ' + found.reasons.join(','));
        counts.none++;
    });
});

(corpus.tails || []).forEach(function (row) {
    check('tail: ' + row.text, function () {
        const written = safety.planTailWrite(row.text, 1000);
        const stored = written ? written.text : '';
        if (row.present) assert.ok(stored.indexOf(row.present) !== -1, 'stored [' + stored + ']');
        if (row.absent) assert.ok(!row.absent.test(stored), 'stored [' + stored + ']');
        assert.ok(!safety.containsRawSecret(stored), stored);
    });
});

corpus.pairs.forEach(function (row) {
    const label = (row.lock ? 'pair lock: ' : 'pair open: ') + row.previous + ' || ' + row.text;
    check(label, function () {
        const now = row.now || 2000;
        const previousAt = row.previousAt || 1000;
        const unlockedAt = row.unlockedAt || 0;
        const written = safety.planTailWrite(row.previous, previousAt);
        const readable = written ? safety.planTailRead({
            text: written.text,
            at: written.at,
            expireAt: { toMillis: function () { return written.expireAt; } },
        }, now, unlockedAt) : '';
        const found = safety.detectBuddyRisk(row.text, {
            previousText: readable,
            previousAt: readable ? previousAt : 0,
            now: now,
            unlockedAt: unlockedAt,
        });
        assert.strictEqual(found.lock, row.lock, 'stored [' + readable + '] ' + found.severity + ' ' + found.reasons.join(','));
        if (row.lock) counts.pairLock++;
        else counts.pairOpen++;
    });
});

console.log('corpus lock ' + counts.lock + ', flag ' + counts.flag + ', none ' + counts.none + ', pair lock ' + counts.pairLock + ', pair no-lock ' + counts.pairOpen);
console.log(passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
