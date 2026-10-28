#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

const ranking = read('ranking.js');
const tickets = read('tickets.js');
const nacho = read('nacho-qa.js');
const app = read('app.js');
const chat = read('global-chat.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

test('page load does not sign every visitor in', function () {
    const listenAt = ranking.indexOf('auth.onAuthStateChanged(user => {');
    const listen = ranking.slice(listenAt, ranking.indexOf('async function handleEmailSignIn'));
    assert.ok(listenAt > 0);
    assert.strictEqual(listen.includes('signInAnonymously'), false);
    assert.ok(listen.includes('10s timeout with no user'));
    assert.ok(listen.includes('clearAuthDisplay()'));
    assert.ok(listen.includes('btc_profile_cache'));
    assert.ok(listen.includes('rankingReady = true'));
    assert.strictEqual(listen.includes("removeItem('btc_referral_code')"), false);
});

test('guest auth is lazy and skips obvious automation', function () {
    const fn = ranking.slice(ranking.indexOf('function guestAuthBlocked'), ranking.indexOf('function loadUserLocal'));
    assert.ok(fn.includes('navigator.webdriver'));
    assert.ok(fn.includes('HeadlessChrome'));
    assert.ok(fn.includes('auth.signInAnonymously'));
    assert.ok(ranking.includes('window.ensureGuestAuth = ensureGuestAuth'));
    assert.ok(ranking.includes('await ensureGuestAuth()'));
    assert.ok(chat.includes('ensureGuestAuth'));
    assert.ok(read('quests.js').includes('ensureGuestAuth'));
});

test('referral codes stay local until sign-in', function () {
    const capture = tickets.slice(tickets.indexOf('function captureReferralCode'), tickets.indexOf('async function awardDailyTicket'));
    assert.ok(capture.includes("localStorage.setItem('btc_referral_code', ref)"));
    const attach = tickets.slice(tickets.indexOf('async function attachReferral'), tickets.indexOf('function inviteSharePayload') > -1 ? tickets.length : tickets.indexOf('async function attachReferral') + 800);
    assert.ok(tickets.includes("const refCode = localStorage.getItem('btc_referral_code')"));
    assert.ok(tickets.includes('localStorage.removeItem(\'btc_referral_code\')') || tickets.includes('localStorage.removeItem("btc_referral_code")'));
});

test('clients no longer write the community counters', function () {
    assert.strictEqual(app.includes('channelVisits:'), false);
    assert.strictEqual(app.includes('watchTimeMinutes:'), false);
    assert.strictEqual(app.includes("httpsCallable('recordSiteVisit')"), true);
    assert.strictEqual(chat.includes('chatMessages:'), false);
    assert.strictEqual(ranking.includes('userCount:'), false);
    assert.strictEqual(nacho.includes("doc('nacho-analytics')"), false);
    assert.ok(nacho.includes('bumpNachoAnalytics'));
    assert.strictEqual(nacho.includes('recentMisses'), false);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
