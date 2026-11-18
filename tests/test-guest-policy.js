#!/usr/bin/env node
'use strict';
// Shared guest rule: a guest is a missing session, or a Firebase anonymous
// session with no real sign-in method linked. Custom-token sign-ins (Nostr,
// Lightning) count as logged in. Username-only accounts are guests. An email
// alone does not count.

const assert = require('assert');
const path = require('path');
const guestPolicy = require(path.join(__dirname, '..', 'functions', 'src', 'guestPolicy.js'));

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ok  ' + name); passed++; }
    catch (e) { console.log('  FAIL ' + name + '\n   ' + (e && e.stack ? e.stack : e)); failed++; }
}
function ctx(provider, identities) {
    return { auth: { uid: 'u1', token: { firebase: { sign_in_provider: provider, identities: identities || {} } } } };
}

test('guest: no session, anonymous, and empty provider are guests', function () {
    assert.strictEqual(guestPolicy.isGuestContext(null), true);
    assert.strictEqual(guestPolicy.isGuestContext({}), true);
    assert.strictEqual(guestPolicy.isGuestContext(ctx('anonymous')), true);
    assert.strictEqual(guestPolicy.isGuestContext(ctx('')), true);
});
for (const p of ['password', 'emailLink', 'google.com', 'twitter.com', 'github.com', 'facebook.com', 'phone', 'custom']) {
    test('logged in: sign_in_provider ' + p, function () {
        assert.strictEqual(guestPolicy.isGuestContext(ctx(p)), false);
    });
}
test('logged in: anonymous session that already has a real provider linked', function () {
    assert.strictEqual(guestPolicy.isGuestContext(ctx('anonymous', { 'google.com': ['1'], email: ['a@b.c'] })), false);
});
test('record: email alone (no provider) is a guest; providers and Nostr/Lightning are not', function () {
    assert.strictEqual(guestPolicy.isGuestRecord({ uid: 'x', email: 'a@b.c', providerData: [] }, {}), true);
    assert.strictEqual(guestPolicy.isGuestRecord({ uid: 'x', providerData: [] }, { username: 'bob' }), true);
    assert.strictEqual(guestPolicy.isGuestRecord({ uid: 'x', providerData: [{ providerId: 'password' }] }, {}), false);
    assert.strictEqual(guestPolicy.isGuestRecord({ uid: 'nostr:ab', providerData: [] }, {}), false);
    assert.strictEqual(guestPolicy.isGuestRecord({ uid: 'ln:02ab', providerData: [] }, {}), false);
    assert.strictEqual(guestPolicy.isGuestRecord({ uid: 'x', providerData: [] }, { signInLinks: ['nostr'] }), false);
    assert.strictEqual(guestPolicy.isGuestRecord({ uid: 'x', providerData: [] }, { signInLinks: ['lightning'] }), false);
    assert.strictEqual(guestPolicy.isGuestRecord(null, {}), true);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
