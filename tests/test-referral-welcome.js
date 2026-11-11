#!/usr/bin/env node
// Referral welcome popup: public username only, once per code, copy matches 50 OT.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

const tickets = read('tickets.js');
const service = read('functions/src/referralService.js');
const indexJs = read('functions/index.js');
const referrals = require(path.join(root, 'functions/src/referrals.js'));

function extract(src, start, end) {
    const a = src.indexOf(start);
    const b = src.indexOf(end, a);
    if (a < 0 || b < 0) throw new Error('extract failed for ' + start);
    return src.slice(a, b);
}

const store = {};
const sandbox = {
    window: {},
    document: {
        getElementById: function () { return null; },
        createElement: function () {
            return { style: {}, setAttribute: function () {}, addEventListener: function () {}, innerHTML: '' };
        },
        body: { appendChild: function () {} }
    },
    localStorage: {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setItem: function (k, v) { store[k] = String(v); }
    },
    auth: { currentUser: { uid: 'guest1', isAnonymous: true }, onAuthStateChanged: function () {} },
    firebase: undefined,
    console: console
};
sandbox.window = sandbox;
vm.createContext(sandbox);
const chunk = extract(tickets, '// ---- One-time referral welcome', '// ---- Award daily login ticket ----');
vm.runInContext(chunk, sandbox);

test('copy uses the inviter name, Maxi rank, and 50 Orange Tickets', () => {
    const copy = sandbox.formatReferralWelcome('Alex');
    assert.strictEqual(copy.title, 'Alex invited you to Bitcoin Quest!');
    assert.strictEqual(copy.body, 'Reach Maxi rank to earn 50 Orange Tickets for you and Alex.');
    assert.strictEqual(referrals.REFERRAL_TICKETS, 50);
    assert.strictEqual(referrals.MAXI_POINTS, 2140);
});

test('rejects emails, markup, and empty names', () => {
    assert.strictEqual(sandbox.referralWelcomeNameOk(''), '');
    assert.strictEqual(sandbox.referralWelcomeNameOk('ada@example.com'), '');
    assert.strictEqual(sandbox.referralWelcomeNameOk('<script>x</script>'), '');
    assert.strictEqual(sandbox.referralWelcomeNameOk('https://evil.test'), '');
    assert.strictEqual(sandbox.formatReferralWelcome('ada@example.com'), null);
    assert.ok(sandbox.referralWelcomeNameOk('Satoshi_1'));
});

test('welcome is marked shown once per referral code', () => {
    assert.strictEqual(sandbox.hasReferralWelcomeShown('abc12345'), false);
    sandbox.markReferralWelcomeShown('abc12345');
    assert.strictEqual(sandbox.hasReferralWelcomeShown('abc12345'), true);
    assert.strictEqual(sandbox.hasReferralWelcomeShown('othercode'), false);
});

test('lookup callable is exported and is a no-secret onCall', () => {
    assert.ok(indexJs.includes('exports.lookupReferralInvite = functionsV1.https.onCall'));
    assert.ok(!/exports\.lookupReferralInvite[\s\S]{0,200}secrets/.test(indexJs));
    assert.ok(indexJs.includes("runtimeSa('registerReferral')"));
    assert.ok(!indexJs.includes("runtimeSa('lookupReferralInvite')"));
});

test('lookup returns only a public name and never scans user ids', () => {
    const fn = extract(service, 'async function lookupReferralInvite', 'async function lookupReferrerUid');
    assert.ok(fn.includes("collection('referralCodes')"));
    assert.ok(fn.includes("collection('public_profiles')"));
    assert.ok(!fn.includes("collection('users')"));
    assert.ok(!fn.includes('startAt'));
    assert.ok(!fn.includes('orderBy'));
    assert.ok(fn.includes('return { name: username }') || fn.includes('return { name: null }'));
    assert.ok(fn.includes('/@/.test(username)'));
    assert.ok(!fn.includes('email'));
    assert.ok(!fn.includes('return { name: username, uid'));
});

test('client calls lookupReferralInvite and never writes referrals', () => {
    assert.ok(tickets.includes("httpsCallable('lookupReferralInvite')"));
    const welcome = extract(tickets, '// ---- One-time referral welcome', '// ---- Award daily login ticket ----');
    assert.ok(!welcome.includes("collection('referrals')"));
    assert.ok(!welcome.includes("collection('referralCodes')"));
    assert.ok(!welcome.includes("collection('users')"));
    assert.ok(!welcome.includes("collection('public_profiles')"));
});

test('index.html and SW use the v2547 placeholder', () => {
    const html = read('index.html');
    const sw = read('sw.js');
    assert.ok(html.includes('bundle.min.js?v=20261111_v2547'));
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2547'"));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
