#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    }
}

function offsetDay(ms) {
    return new Date(ms - 5 * 3600000).toISOString().slice(0, 10);
}

function el(id, tag) {
    const node = {
        id: id,
        tagName: tag || 'BUTTON',
        className: '',
        hidden: false,
        textContent: '',
        style: {},
        attrs: {},
        classList: null,
        setAttribute: function (k, v) { this.attrs[k] = String(v); },
        getAttribute: function (k) { return this.attrs[k] || null; },
        closest: function () { return this; }
    };
    node.classList = {
        toggle: function (name, on) {
            const parts = node.className.split(/\s+/).filter(Boolean).filter(function (c) { return c !== name; });
            if (on) parts.push(name);
            node.className = parts.join(' ');
        }
    };
    return node;
}

function boot(user) {
    const ids = {};
    ['todayTrifectaBtn', 'todayTrifectaCount', 'todayQuizBtn', 'todayTriviaBtn', 'todayPollBtn',
        'nqSpinBtn', 'nqSpinSub', 'tctvWatchBtn', 'tctvWatchSub', 'todayPredictBtn', 'predAccuracyLabel',
        'sayHiBtn', 'sayHiBtnLabel', 'sayHiBtnSub', 'todayFlexBtn', 'todayFlexLabel', 'todayFlexSub',
        'todayDoneCount', 'todayCard'].forEach(function (id) {
        ids[id] = el(id, id.indexOf('Sub') >= 0 || id.indexOf('Label') >= 0 || id.indexOf('Count') >= 0 ? 'SPAN' : 'BUTTON');
    });
    ids.todayTrifectaBtn.querySelector = function () { return null; };
    const store = {};
    const sandbox = {
        window: {},
        document: {
            readyState: 'complete',
            getElementById: function (id) { return ids[id] || null; },
            addEventListener: function () {},
            querySelector: function () { return null; }
        },
        localStorage: {
            getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
            setItem: function (k, v) { store[k] = String(v); }
        },
        setInterval: function () { return 1; },
        setTimeout: function () { return 1; },
        clearInterval: function () {},
        addEventListener: function () {},
        currentUser: user || null,
        console: console,
        Date: Date
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'today-card.js'), 'utf8'), sandbox, { filename: 'today-card.js' });
    return { sandbox: sandbox, ids: ids, store: store };
}

const now = Date.now();
const today = offsetDay(now);
const utc = new Date(now).toISOString().slice(0, 10);

test('server day fields mark tiles completed and ignore client storage', function () {
    const page = boot({
        lastQuizDate: today,
        lastTriviaDate: today,
        lastPollDate: '2020-01-01',
        lastSpinDate: utc,
        sayHiClaimedDay: '',
        chatPostedDay: ''
    });
    page.store.btc_quest_daily = JSON.stringify({ date: today, count: 3 });
    page.store.btc_trivia_state = JSON.stringify({ date: today });
    page.store.btc_poll_state = JSON.stringify({ date: today, chosen: 1 });
    page.store.btc_last_spin_date = utc;
    page.store.btc_price_prediction = JSON.stringify({ time: now, direction: 'up', price: 1 });
    page.sandbox._paintTodayCard({ tilesOnly: true });
    assert.ok(page.ids.todayTrifectaBtn.className.indexOf('is-done') === -1);
    assert.strictEqual(page.ids.todayTrifectaCount.textContent, '2/3');
    assert.ok(page.ids.todayTrifectaBtn.getAttribute('aria-label').indexOf('completed') === -1);
    assert.ok(page.ids.nqSpinBtn.className.indexOf('is-done') !== -1);
    assert.strictEqual(page.ids.nqSpinSub.textContent, 'Done');
    assert.ok(page.ids.nqSpinBtn.getAttribute('aria-label').indexOf('completed') !== -1);
    assert.ok(page.ids.sayHiBtn.className.indexOf('is-done') === -1);
    assert.strictEqual(page.ids.sayHiBtnSub.textContent, 'to the community');
    assert.ok(page.ids.todayPredictBtn.className.indexOf('is-done') === -1);
});

test('finishing the set shows the check, Done, and a completed label', function () {
    const page = boot({
        lastQuizDate: today,
        lastTriviaDate: today,
        lastPollDate: today,
        lastSpinDate: utc,
        sayHiClaimedDay: today,
        chatPostedDay: ''
    });
    page.sandbox._tctvWatchDoneToday = true;
    page.sandbox._todayFlexCount = 5;
    page.sandbox._todayPredStats = { predPending: { time: now, direction: 'up', startPrice: 1 } };
    page.sandbox._paintTodayCard({ tilesOnly: true });
    ['todayTrifectaBtn', 'nqSpinBtn', 'tctvWatchBtn', 'todayPredictBtn', 'sayHiBtn', 'todayFlexBtn'].forEach(function (id) {
        assert.ok(page.ids[id].className.indexOf('is-done') !== -1, id);
        assert.ok(page.ids[id].getAttribute('aria-label').indexOf('completed') !== -1, page.ids[id].getAttribute('aria-label'));
    });
    assert.strictEqual(page.ids.todayTrifectaCount.textContent, '3/3');
    assert.strictEqual(page.ids.sayHiBtnSub.textContent, 'Done');
    assert.strictEqual(page.ids.sayHiBtnLabel.textContent, 'Say hi!');
    assert.strictEqual(page.ids.predAccuracyLabel.textContent, 'Done');
    assert.strictEqual(page.ids.todayFlexSub.textContent, '5/5');
    assert.strictEqual(page.ids.todayDoneCount.textContent, '6/6 done today');
});

test('a chat post today completes Say hi without the reward field, and yesterday resets', function () {
    const page = boot({ sayHiClaimedDay: '2020-01-01', chatPostedDay: '2020-01-01' });
    page.sandbox._noteTodayChatPosted();
    assert.ok(page.ids.sayHiBtn.className.indexOf('is-done') !== -1);
    assert.strictEqual(page.ids.sayHiBtnSub.textContent, 'Done');
    assert.ok(page.ids.sayHiBtn.getAttribute('aria-label').indexOf('completed') !== -1);
    page.sandbox._todayChatPostedDay = '2020-01-01';
    page.sandbox.serverProfile = null;
    page.sandbox.currentUser.chatPostedDay = '2020-01-01';
    page.sandbox._paintTodayCard({ tilesOnly: true });
    assert.ok(page.ids.sayHiBtn.className.indexOf('is-done') === -1);
    assert.strictEqual(page.ids.sayHiBtnSub.textContent, 'to the community');
});

test('predict stays open until the save is confirmed', function () {
    const page = boot({});
    page.sandbox._todayPredictStamp = Date.now();
    page.sandbox._paintTodayCard({ tilesOnly: true });
    assert.ok(page.ids.todayPredictBtn.className.indexOf('is-done') === -1);
    assert.ok(page.ids.todayPredictBtn.getAttribute('aria-label').indexOf('completed') === -1);
    page.sandbox._todayPredictConfirmed = true;
    page.sandbox._paintTodayCard({ tilesOnly: true });
    assert.ok(page.ids.todayPredictBtn.className.indexOf('is-done') !== -1);
    assert.strictEqual(page.ids.predAccuracyLabel.textContent, 'Done');
    assert.ok(page.ids.todayPredictBtn.getAttribute('aria-label').indexOf('completed') !== -1);
});

test('a scored prediction is no longer completed', function () {
    const page = boot({});
    page.sandbox._todayPredStats = {
        predPending: null,
        predLastResult: { time: now - 86400000, outcome: 'correct' }
    };
    page.sandbox._paintTodayCard({ tilesOnly: true });
    assert.ok(page.ids.todayPredictBtn.className.indexOf('is-done') === -1);
    page.sandbox._todayPredStats = {
        predPending: { time: now, direction: 'down' },
        predLastResult: { time: now, outcome: 'correct' }
    };
    page.sandbox._paintTodayCard({ tilesOnly: true });
    assert.ok(page.ids.todayPredictBtn.className.indexOf('is-done') === -1);
});

test('the home card styles a check badge for dark, light, and oled', function () {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.strictEqual(html, fs.readFileSync(path.join(root, '404.html'), 'utf8'));
    assert.ok(html.includes("content: '\\2713'"));
    assert.ok(html.includes('#em-quick-actions .today-tile.is-done'));
    assert.ok(html.includes('[data-theme="light"] #em-quick-actions .today-tile.is-done'));
    assert.ok(html.includes('.oled-theme #em-quick-actions .today-tile.is-done'));
    assert.ok(html.includes('id="todayPredictBtn"'));
    assert.ok(html.includes('id="nqSpinSub"'));
    assert.strictEqual((html.match(/Latest:/g) || []).length, 0);
    const notes = fs.readFileSync(path.join(root, 'patch-notes.html'), 'utf8');
    assert.strictEqual((notes.match(/Latest:/g) || []).length, 1);
    assert.ok(notes.includes('Latest: Search any player on the XP, Daily Streaks, Quests and Top Predictors leaderboards and see their exact rank, even outside the top 25.'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
