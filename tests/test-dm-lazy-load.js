#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('  ok  ' + name);
        passed++;
    } catch (e) {
        console.log('  FAIL ' + name);
        console.log('       ' + e.message);
        failed++;
    }
}

function read(rel) {
    return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

test('a conversation opens with the newest page and older messages use startAfter', function () {
    const src = read('messaging.js');
    assert.ok(src.includes('pageSize: 30'));
    const loadAt = src.indexOf('function loadDMMessages');
    const load = src.slice(loadAt, loadAt + 2500);
    assert.ok(load.includes("orderBy('createdAt', 'desc')"));
    assert.ok(load.includes('.limit(pageSize)'));
    assert.ok(!/orderBy\('createdAt', 'asc'\)\s*\n\s*\.limit\(MSG_CONFIG\.maxConvoHistory\)/.test(src));
    const olderAt = src.indexOf('function loadOlderDMMessages');
    assert.ok(olderAt > 0);
    const older = src.slice(olderAt, olderAt + 1600);
    assert.ok(older.includes("orderBy('createdAt', 'desc')"));
    assert.ok(older.includes('.startAfter(paging.oldestDoc)'));
    assert.ok(src.includes('container.scrollTop < 80') || src.includes('scrollTop < 80'));
    assert.ok(src.includes('Load earlier messages'));
});

test('no new Firestore indexes or rules are required for message paging', function () {
    const src = read('messaging.js');
    const older = src.slice(src.indexOf('function loadOlderDMMessages'), src.indexOf('function loadDMMessages'));
    assert.ok(older.includes("collection('messages')"));
    assert.ok(older.includes("orderBy('createdAt', 'desc')"));
    assert.ok(!older.includes('.where('));
    const rules = read('firestore.rules');
    // This PR does not touch rules.
    assert.ok(rules.includes('match /dm_conversations'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
