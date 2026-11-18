#!/usr/bin/env node
'use strict';
// setUsername may hand out a reserved name only to an account whose Firebase
// custom claim admin === true. Firestore role/admin fields are not trusted.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'onboardingApi.js'), 'utf8');
let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('\u2705 ' + name); passed++; }
    catch (e) { console.log('\u274c ' + name + ': ' + (e && e.stack || e)); failed++; }
}

const start = src.indexOf('function roleMayUseReserved(');
const end = src.indexOf('\n}\n', start) + 3;
const sb = {};
vm.createContext(sb);
vm.runInContext(src.slice(start, end) + '\nthis.roleMayUseReserved = roleMayUseReserved;', sb);
const may = sb.roleMayUseReserved;

test('the admin claim allows reserved names', function () {
    assert.strictEqual(may({ auth: { uid: 'a', token: { admin: true } } }), true);
});
test('no claim, a string claim, or no auth is refused', function () {
    assert.strictEqual(may({ auth: { uid: 'a', token: {} } }), false);
    assert.strictEqual(may({ auth: { uid: 'a', token: { admin: 'true' } } }), false);
    assert.strictEqual(may({}), false);
    assert.strictEqual(may(null), false);
});
test('Firestore isAdmin/admin/role fields are ignored', function () {
    assert.strictEqual(may({ isAdmin: true, admin: true, role: 'admin' }), false);
    assert.strictEqual(may({ auth: { uid: 'a', token: {} }, isAdmin: true, role: 'moderator' }), false);
});
test('setUsername passes the callable context, not the profile', function () {
    assert.ok(src.includes('allowReserved: roleMayUseReserved(context)'));
    assert.ok(!src.includes('roleMayUseReserved(current)'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
