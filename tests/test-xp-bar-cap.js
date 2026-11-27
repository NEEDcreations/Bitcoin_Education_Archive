#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

function test(name, fn) {
    return Promise.resolve().then(fn).then(function() {
        console.log('✅ ' + name);
    }).catch(function(err) {
        console.log('❌ ' + name + ': ' + (err && err.stack || err));
        throw err;
    });
}

const tests = [];
function add(name, fn) { tests.push(test(name, fn)); }

function loadCard() {
    const text = { textContent: '' };
    const fill = { style: {} };
    const sandbox = {
        console: console,
        setTimeout: function () { return 0; },
        clearTimeout: function () {},
        setInterval: function () { return 0; },
        clearInterval: function () {},
        Date: Date,
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
        localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
        addEventListener: function () {},
        removeEventListener: function () {},
        auth: { currentUser: { uid: 'userUid123456', isAnonymous: false } }
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(read('today-card.js'), sandbox, { filename: 'today-card.js' });
    return { sandbox: sandbox, text: text, fill: fill };
}

add('index.html and 404.html match, and pins are v2738', function() {
    const index = read('index.html');
    assert.strictEqual(index, read('404.html'));
    const sw = read('sw.js');
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2738'"));
    assert.ok(index.includes('today-card.js?v=20261127_v2738'));
    assert.ok(index.includes('ranking.js?v=20261127_v2738'));
    assert.ok(!index.includes('today-card.js?v=20261109_v2538'));
    assert.ok(!index.includes('ranking.js?v=20261119_v2683'));
});

add('a later stale status reading does not drop a confirmed daily total near the cap', function() {
    const env = loadCard();
    const w = env.sandbox;
    w._noteServerDailyXp({ signedIn: true, dailyXp: 850, _xpNotedAt: 1000 });
    assert.strictEqual(env.text.textContent, '850/1000 XP today');
    w._noteServerDailyXp({ signedIn: true, dailyXp: 420, _xpNotedAt: 2000 });
    assert.strictEqual(env.text.textContent, '850/1000 XP today');
    assert.strictEqual(env.fill.style.width, '85%');
});

add('a later confirmed total can still replace an optimistic preview, including a lower cap result', function() {
    const env = loadCard();
    const w = env.sandbox;
    w._noteServerDailyXp({ signedIn: true, dailyXp: 800, _xpNotedAt: 1000 });
    const preview = w._previewDailyXpGain(400);
    assert.ok(preview.after > 800);
    assert.ok(env.text.textContent.indexOf(String(preview.after)) !== -1);
    w._noteServerDailyXp({ signedIn: true, dailyXp: 900, _xpNotedAt: Date.now() });
    assert.strictEqual(env.text.textContent, '900/1000 XP today');
});

add('home, Settings, and Profile share one display refresh and do not award XP', function() {
    const today = read('today-card.js');
    const ranking = read('ranking.js');
    assert.ok(today.includes('window.refreshXpDisplays'));
    assert.ok(today.includes("hasOwnProperty.call(serverProfile, 'points')"));
    assert.ok(today.indexOf('function applyServerProfile') < today.indexOf('user.points = next'));
    assert.ok(!/httpsCallable\(['\"]awardPoints['\"]/.test(today));
    assert.ok(ranking.includes('id="settingsAccountXp"'));
    assert.ok(ranking.includes('id="settingsDataXp"'));
    assert.ok(ranking.includes('window.refreshXpDisplays'));
    assert.ok(ranking.includes('window._xpDisplayAwardAt'));
});

Promise.all(tests).then(function(rows) {
    console.log('---\nPassed: ' + rows.length + '  Failed: 0');
}).catch(function() { process.exit(1); });
