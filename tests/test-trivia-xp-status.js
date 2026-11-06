#!/usr/bin/env node
'use strict';
// triviaXpStatus is painted from the Today card on a timer, on focus, and on
// storage events. One in-flight call and a short cache keep that from
// hitting the callable on every paint.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;
const pending = [];

function test(name, fn) {
    const done = fn();
    if (done && typeof done.then === 'function') {
        pending.push(done.then(function () {
            console.log('✅ ' + name);
            passed++;
        }, function (err) {
            console.log('❌ ' + name + ': ' + (err && err.stack || err));
            failed++;
        }));
        return;
    }
    console.log('✅ ' + name);
    passed++;
}

function walk(dir, out) {
    fs.readdirSync(dir).forEach(function (name) {
        if (name === 'node_modules' || name === 'scripts') return;
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full, out);
        else if (name.endsWith('.js')) out.push(full);
    });
}

test('only totpStatus and syncEmailChange keep a warm instance', function () {
    const files = [];
    walk(path.join(root, 'functions'), files);
    const hits = files.filter(function (file) {
        return fs.readFileSync(file, 'utf8').includes('minInstances');
    });
    assert.deepStrictEqual(hits.map(function (file) { return path.relative(root, file); }).sort(), [
        'functions/src/emailChange.js',
        'functions/src/secondFactor.js'
    ]);
    const second = fs.readFileSync(path.join(root, 'functions', 'src', 'secondFactor.js'), 'utf8');
    const status = second.slice(second.indexOf('const totpStatus'), second.indexOf('const totpRevokeSession'));
    assert.ok(status.includes('functionsV1.runWith({ minInstances: 1 }).https.onCall'));
    assert.strictEqual(status.includes('enforceAppCheck'), false);
    assert.strictEqual(status.includes('memory'), false);
    assert.strictEqual(status.includes('timeoutSeconds'), false);
    const revoke = second.slice(second.indexOf('const totpRevokeSession'), second.indexOf('const issueRecoveryCodes'));
    assert.strictEqual(revoke.includes('minInstances'), false);
    assert.ok(revoke.includes('functionsV1.https.onCall'));
    const email = fs.readFileSync(path.join(root, 'functions', 'src', 'emailChange.js'), 'utf8');
    const bound = email.slice(email.indexOf('return {'), email.indexOf('module.exports'));
    assert.ok(bound.includes('syncEmailChange: onCall(handlers.syncEmailChange, true)'));
    assert.ok(bound.includes('prepareEmailChange: onCall(handlers.prepareEmailChange),'));
    assert.ok(bound.includes('confirmAccountLink: onCall(handlers.confirmAccountLink),'));
    assert.strictEqual(bound.includes('prepareEmailChange: onCall(handlers.prepareEmailChange, true)'), false);
    assert.strictEqual(bound.includes('confirmAccountLink: onCall(handlers.confirmAccountLink, true)'), false);
    assert.ok(email.includes('if (warm === true) opts.minInstances = 1;'));
    assert.ok(email.includes('enforceAppCheck: true'));
});

test('triviaXpStatus stays one in-flight call and reuses the result for about a minute', async function () {
    const RealDate = Date;
    let clock = 1700000000000;
    function ClockDate() {
        var args = Array.prototype.slice.call(arguments);
        if (args.length) return new (Function.prototype.bind.apply(RealDate, [null].concat(args)))();
        return new RealDate(clock);
    }
    ClockDate.now = function () { return clock; };
    ClockDate.parse = RealDate.parse;
    ClockDate.UTC = RealDate.UTC;
    ClockDate.prototype = RealDate.prototype;
    const calls = [];
    let release = null;
    let failNext = false;
    const sandbox = {
        console: console,
        setTimeout: function () { return 0; },
        clearTimeout: function () {},
        setInterval: function () { return 0; },
        clearInterval: function () {},
        Date: ClockDate,
        document: {
            readyState: 'complete',
            getElementById: function () { return null; },
            querySelector: function () { return null; },
            querySelectorAll: function () { return []; },
            addEventListener: function () {},
            createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {} }; }
        },
        localStorage: {
            getItem: function () { return null; },
            setItem: function () {},
            removeItem: function () {}
        },
        addEventListener: function () {},
        removeEventListener: function () {},
        auth: { currentUser: { uid: 'userUid123456', isAnonymous: false } },
        firebase: {
            functions: function () {
                return {
                    httpsCallable: function (name) {
                        return function () {
                            calls.push(name);
                            return new Promise(function (resolve, reject) {
                                release = function () {
                                    if (failNext) {
                                        failNext = false;
                                        reject(new Error('offline'));
                                        return;
                                    }
                                    resolve({ data: { dailyXp: 40, signedIn: true } });
                                };
                            });
                        };
                    }
                };
            }
        }
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'today-card.js'), 'utf8'), sandbox, { filename: 'today-card.js' });
    assert.deepStrictEqual(calls, ['triviaXpStatus']);
    sandbox._paintTodayCard();
    sandbox._paintTodayCard();
    sandbox._paintTodayCard();
    assert.strictEqual(calls.length, 1, 'paints share the in-flight call');
    release();
    for (var i = 0; i < 8; i++) await Promise.resolve();
    sandbox._paintTodayCard();
    sandbox._paintTodayCard();
    assert.strictEqual(calls.length, 1, 'a fresh result is reused');
    clock += 61000;
    sandbox._paintTodayCard();
    assert.strictEqual(calls.length, 2, 'the cache expires after about a minute');
    sandbox._paintTodayCard();
    assert.strictEqual(calls.length, 2, 'the refresh is still the only in-flight call');
    failNext = true;
    release();
    for (var j = 0; j < 8; j++) await Promise.resolve();
    sandbox._paintTodayCard();
    assert.strictEqual(calls.length, 3, 'a failed call does not stick in the cache');
    const src = fs.readFileSync(path.join(root, 'today-card.js'), 'utf8');
    assert.ok(src.includes('var TRIVIA_XP_TTL_MS = 60000;'));
    assert.ok(src.includes('if (triviaXpInflight) return;'));
    const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
    const award = ranking.slice(ranking.indexOf('result.data.dailyXp'), ranking.indexOf('result.data.dailyXp') + 900);
    assert.ok(award.includes('_xpNotedAt: Date.now()'));
    assert.ok(award.includes('window._noteServerDailyXp(window._serverDailyXp)'));
});

test('an award total replaces the triviaXpStatus cache instead of being painted over', async function () {
    const RealDate = Date;
    let clock = 1700000000000;
    function ClockDate() {
        var args = Array.prototype.slice.call(arguments);
        if (args.length) return new (Function.prototype.bind.apply(RealDate, [null].concat(args)))();
        return new RealDate(clock);
    }
    ClockDate.now = function () { return clock; };
    ClockDate.parse = RealDate.parse;
    ClockDate.UTC = RealDate.UTC;
    ClockDate.prototype = RealDate.prototype;
    const text = { textContent: '' };
    const fill = { style: {} };
    let pending = null;
    let nextXp = 40;
    const calls = [];
    const sandbox = {
        console: console,
        setTimeout: function () { return 0; },
        clearTimeout: function () {},
        setInterval: function () { return 0; },
        clearInterval: function () {},
        Date: ClockDate,
        document: {
            readyState: 'complete',
            getElementById: function (id) {
                if (id === 'dailyXpMeterText') return text;
                if (id === 'dailyXpMeterFill') return fill;
                if (id === 'dailyXpMeter') return { setAttribute: function () {}, querySelector: function () { return null; } };
                return null;
            },
            querySelector: function () { return null; },
            querySelectorAll: function () { return []; },
            addEventListener: function () {},
            createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {} }; }
        },
        localStorage: {
            getItem: function () { return null; },
            setItem: function () {},
            removeItem: function () {}
        },
        addEventListener: function () {},
        removeEventListener: function () {},
        auth: { currentUser: { uid: 'userUid123456', isAnonymous: false } },
        firebase: {
            functions: function () {
                return {
                    httpsCallable: function (name) {
                        return function () {
                            calls.push(name);
                            return new Promise(function (resolve) {
                                pending = function () {
                                    resolve({ data: { dailyXp: nextXp, signedIn: true } });
                                };
                            });
                        };
                    }
                };
            }
        }
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'today-card.js'), 'utf8'), sandbox, { filename: 'today-card.js' });
    pending();
    for (var i = 0; i < 8; i++) await Promise.resolve();
    assert.strictEqual(text.textContent, '40/1000 XP today');
    clock += 1000;
    sandbox._noteServerDailyXp({
        signedIn: true,
        dailyXp: 80,
        dailyCap: 1000,
        _xpNotedAt: clock
    });
    assert.strictEqual(text.textContent, '80/1000 XP today');
    sandbox._paintTodayCard();
    assert.strictEqual(calls.length, 1, 'the cached status is not fetched again');
    assert.strictEqual(text.textContent, '80/1000 XP today');
    sandbox._serverDailyXp = { signedIn: true, dailyXp: 100, _xpNotedAt: clock + 5 };
    sandbox._paintTodayCard();
    assert.strictEqual(text.textContent, '100/1000 XP today', 'a newer total wins over the cached status');
    clock += 61000;
    nextXp = 40;
    sandbox._paintTodayCard();
    assert.strictEqual(calls.length, 2);
    clock += 10;
    sandbox._noteServerDailyXp({ signedIn: true, dailyXp: 120, _xpNotedAt: clock });
    pending();
    for (var j = 0; j < 8; j++) await Promise.resolve();
    assert.strictEqual(text.textContent, '120/1000 XP today', 'a status result that started earlier does not cover the award');
});

Promise.all(pending).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
});
