#!/usr/bin/env node
// Static rules checks for account deletion and email change.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
const keysFn = rules.slice(rules.indexOf('function userProfileServerOnlyKeys()'), rules.indexOf('match /users/{userId}'));
const createRule = rules.slice(rules.indexOf('allow create: if request.auth != null'), rules.indexOf('allow update: if request.auth != null'));

assert.ok(keysFn.includes("'email'"), 'email is server-only on update');
assert.ok(keysFn.includes("'emailHash'"));
assert.ok(keysFn.includes("'satsHold'"));
assert.ok(keysFn.includes("'emailHistory'"));
assert.ok(keysFn.includes("'emailHistoryHashes'"));
assert.ok(keysFn.includes("'providersHash'"));
assert.ok(keysFn.includes("'providerHashes'"));
assert.ok(!keysFn.includes("'referredBy'"), 'referredBy stays out of userProfileServerOnlyKeys');
assert.ok(!createRule.includes("'email'"), 'create allowlist no longer includes email');
['deleted_accounts', 'email_history', 'email_change_pending', 'identity_history'].forEach(function (name) {
    const at = rules.indexOf('match /' + name + '/{docId}');
    assert.ok(at !== -1, name);
    const block = rules.slice(at, rules.indexOf('match /', at + 10));
    assert.ok(block.includes('allow read, write: if false'), name);
});
assert.ok(!rules.includes('deletionScheduledAt'));

const index = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
assert.ok(index.includes("defineSecret('DELETION_HMAC_SECRET')"));
assert.ok(index.includes('exports.prepareEmailChange'));
assert.ok(index.includes('exports.syncEmailChange'));
assert.ok(index.includes('exports.confirmAccountLink'));
assert.strictEqual((index.match(/enforceAppCheck:\s*true/g) || []).length, 8);

const emailSrc = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'emailChange.js'), 'utf8');
assert.ok(emailSrc.includes('enforceAppCheck: true'));
assert.ok(!emailSrc.includes('console.log'));
assert.ok(emailSrc.indexOf('console') === -1);

console.log('✅ account rules and callable wiring');
