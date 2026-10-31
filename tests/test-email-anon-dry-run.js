#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const script = require('../functions/scripts/dry-run-email-anon');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('  ok  ' + name);
        passed++;
    } catch (e) {
        console.log('  FAIL ' + name);
        console.log('       ' + (e.stack || e.message));
        failed++;
    }
}

test('truncated uids are shorter than the real id and do not equal it', function () {
    const full = 'ln:' + 'ab'.repeat(32);
    const short = script.truncUid(full);
    assert.notStrictEqual(short, full);
    assert.ok(short.length < full.length);
    assert.ok(short.indexOf('…') !== -1);
    assert.strictEqual(script.truncUid(''), '');
    const anon = 'abcdefghijklmnopqrstuvwxyz012345';
    assert.notStrictEqual(script.truncUid(anon), anon);
    assert.ok(script.truncUid(anon).indexOf(anon) === -1);
});

test('a password-only non-lightning user is the guest-shaped account', function () {
    const info = script.classifyAuthUser({
        uid: 'guestAccountUid0123456789',
        providerData: [{ providerId: 'password' }],
    });
    assert.strictEqual(info.linkedGuest, true);
    assert.strictEqual(info.anonymous, false);
    assert.strictEqual(info.lightning, false);
    assert.notStrictEqual(info.uid, 'guestAccountUid0123456789');
    assert.ok(JSON.stringify(info).indexOf('guestAccountUid0123456789') === -1);
});

test('an empty provider list is anonymous and a lightning uid is not a guest', function () {
    const anon = script.classifyAuthUser({ uid: 'anonUidValue0123456789', providerData: [] });
    assert.strictEqual(anon.anonymous, true);
    assert.strictEqual(anon.linkedGuest, false);
    const ln = script.classifyAuthUser({
        uid: 'ln:' + 'cd'.repeat(20),
        providerData: [{ providerId: 'password' }],
    });
    assert.strictEqual(ln.lightning, true);
    assert.strictEqual(ln.anonymous, false);
    assert.strictEqual(ln.linkedGuest, false);
    assert.strictEqual(ln.providers.join(','), 'password');
});

test('the script does not run or write when it is loaded', function () {
    const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'scripts', 'dry-run-email-anon.js'), 'utf8');
    assert.ok(src.includes('require.main === module'));
    assert.ok(src.indexOf('initializeApp') > src.indexOf('async function main'));
    assert.ok(src.indexOf("require('firebase-admin')") > src.indexOf('async function main'));
    assert.ok(!src.includes('.set('));
    assert.ok(!src.includes('.update('));
    assert.ok(!src.includes('.delete('));
    assert.ok(!src.includes('createUser'));
    assert.ok(!src.includes('updateUser'));
    assert.ok(src.includes('process.argv[2]'));
    assert.ok(src.includes('truncUid'));
    assert.strictEqual(script.normalizeEmail('  Person@Example.com '), 'person@example.com');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
