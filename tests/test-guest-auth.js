#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
    const guestFn = ranking.slice(ranking.indexOf('function ensureGuestAuth'), ranking.indexOf('window.ensureGuestAuth = ensureGuestAuth'));
    const signAt = guestFn.indexOf('auth.signInAnonymously');
    assert.ok(signAt > guestFn.indexOf('authFirstEventPromise()'));
    assert.ok(signAt > guestFn.indexOf('return redirectResultPromise'));
    assert.ok(ranking.includes('noteAuthFirstEvent();'));
    assert.ok(ranking.includes('window.ensureGuestAuth = ensureGuestAuth'));
    assert.ok(ranking.includes('await ensureGuestAuth()'));
    assert.ok(chat.includes('ensureGuestAuth'));
    assert.ok(read('quests.js').includes('ensureGuestAuth'));
    assert.ok(nacho.includes('_nachoAppCheckDown'));
    assert.ok(app.includes('_visitAppCheckDown'));
    const index = read('functions/index.js');
    const nachoAt = index.indexOf('exports.bumpNachoAnalytics');
    const visitAt = index.indexOf('exports.recordSiteVisit');
    assert.ok(index.slice(nachoAt, nachoAt + 80).includes('enforceAppCheck: true'));
    assert.ok(index.slice(visitAt, visitAt + 80).includes('enforceAppCheck: true'));
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

function guestSandbox() {
    let redirectResolve;
    const auth = {
        currentUser: null,
        signInAnonymously: function () {
            auth.signInCalls += 1;
            const user = { uid: 'guest-' + auth.signInCalls, isAnonymous: true };
            auth.currentUser = user;
            return Promise.resolve({ user: user });
        },
        signInCalls: 0,
    };
    const sandbox = {
        Promise: Promise,
        auth: auth,
        currentUser: null,
        navigator: { webdriver: false, userAgent: 'Mozilla/5.0' },
        redirectResultPromise: new Promise(function (resolve) { redirectResolve = resolve; }),
        loadUserLocal: function (uid) { sandbox.currentUser = { uid: uid, _isLocal: true }; },
        window: {},
        resolveRedirect: function (user) { redirectResolve(user || null); },
    };
    sandbox.window = sandbox.window;
    const start = ranking.indexOf('var _authFirstEventSeen = false;');
    const end = ranking.indexOf('function loadUserLocal');
    vm.createContext(sandbox);
    vm.runInContext(ranking.slice(start, end), sandbox);
    return sandbox;
}

function flush() {
    return new Promise(function (resolve) { setImmediate(resolve); });
}

const behavior = (async function () {
    const restoring = guestSandbox();
    const pending = restoring.ensureGuestAuth();
    await flush();
    assert.strictEqual(restoring.auth.signInCalls, 0);
    restoring.noteAuthFirstEvent();
    await flush();
    assert.strictEqual(restoring.auth.signInCalls, 0, 'redirect still pending');
    restoring.auth.currentUser = { uid: 'real-user', isAnonymous: false };
    restoring.resolveRedirect(null);
    const restored = await pending;
    assert.strictEqual(restoring.auth.signInCalls, 0);
    assert.strictEqual(restored.uid, 'real-user');

    const fresh = guestSandbox();
    const first = fresh.ensureGuestAuth();
    const second = fresh.ensureGuestAuth();
    assert.strictEqual(first, second);
    fresh.noteAuthFirstEvent();
    fresh.resolveRedirect(null);
    const guests = await Promise.all([first, second]);
    assert.strictEqual(fresh.auth.signInCalls, 1);
    assert.strictEqual(guests[0].uid, guests[1].uid);
    assert.strictEqual(guests[0].isAnonymous, true);

    const bot = guestSandbox();
    bot.navigator.webdriver = true;
    const blocked = await bot.ensureGuestAuth();
    assert.strictEqual(blocked, null);
    assert.strictEqual(bot.auth.signInCalls, 0);
    bot.noteAuthFirstEvent();
    bot.resolveRedirect(null);
    await flush();
    assert.strictEqual(bot.auth.signInCalls, 0);
})();

behavior.then(function () {
    console.log('✅ guest sign-in waits for auth and the redirect');
    passed++;
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
}).catch(function (e) {
    console.log('❌ guest sign-in waits for auth and the redirect: ' + (e && e.stack || e));
    failed++;
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(1);
});
