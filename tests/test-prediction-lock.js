#!/usr/bin/env node
'use strict';

// A local or server prediction older than 36h must not keep the Up/Down
// buttons locked, and a rejected Firestore write must drop the local copy.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const NOW = Date.parse('2026-11-01T18:00:00.000Z');
const HOUR = 3600000;
const DAY = 24 * HOUR;

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + (e.stack || e.message));
        failed++;
    }
}

function matchBrace(src, openIndex) {
    let depth = 0;
    let i = openIndex;
    let state = 'code';
    while (i < src.length) {
        const c = src[i];
        const n = src[i + 1];
        if (state === 'code') {
            if (c === '/' && n === '/') { state = 'line'; i += 2; continue; }
            if (c === '/' && n === '*') { state = 'block'; i += 2; continue; }
            if (c === "'") { state = 'sq'; i++; continue; }
            if (c === '"') { state = 'dq'; i++; continue; }
            if (c === '`') { state = 'bt'; i++; continue; }
            if (c === '{') depth++;
            else if (c === '}') {
                depth--;
                if (depth === 0) return i;
            }
        } else if (state === 'line') {
            if (c === '\n') state = 'code';
        } else if (state === 'block') {
            if (c === '*' && n === '/') { state = 'code'; i += 2; continue; }
        } else if (state === 'sq' || state === 'dq' || state === 'bt') {
            const quote = state === 'sq' ? "'" : state === 'dq' ? '"' : '`';
            if (c === '\\') { i += 2; continue; }
            if (c === quote) state = 'code';
        }
        i++;
    }
    throw new Error('unbalanced brace at ' + openIndex);
}

function grab(src, name) {
    const re = new RegExp('function ' + name + '\\s*\\([^)]*\\)\\s*\\{');
    const m = re.exec(src);
    if (!m) throw new Error('missing function ' + name);
    const open = m.index + m[0].length - 1;
    return src.slice(m.index, matchBrace(src, open) + 1);
}

function setNow(sandbox, now) {
    function Clock() {
        const args = arguments.length ? Array.prototype.slice.call(arguments) : [now];
        return new (Date.bind.apply(Date, [null].concat(args)))();
    }
    Clock.now = function () { return now; };
    Clock.parse = Date.parse;
    Clock.UTC = Date.UTC;
    Clock.prototype = Date.prototype;
    sandbox.Date = Clock;
}

function load(file) {
    const src = fs.readFileSync(path.join(root, file), 'utf8');
    const stale = src.match(/var PRED_STALE_MS\s*=\s*[^;]+;/);
    assert.ok(stale, file + ' is missing PRED_STALE_MS');
    const names = [
        '_fmtUsd', '_dirHtml', '_localPredModel', '_mergePredModel',
        '_lastResultHtml', '_pendingHtml', '_statsBoxHtml', '_fillPersonalLine',
        '_paintPredictionCard', '_syncPredictionToFirestore'
    ];
    const store = {};
    const toasts = [];
    const sets = [];
    const sandbox = {
        document: { getElementById: function () { return { textContent: '' }; } },
        localStorage: {
            getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
            setItem: function (k, v) { store[k] = String(v); },
            removeItem: function (k) { delete store[k]; }
        },
        showToast: function (msg) { toasts.push(String(msg)); },
        console: console,
        auth: { currentUser: null },
        db: {
            collection: function (name) {
                return {
                    doc: function (id) {
                        return {
                            set: function (payload) {
                                const row = { name: name, id: id, payload: payload };
                                sets.push(row);
                                if (sandbox.rejectWrite) return Promise.reject(new Error('permission-denied'));
                                return Promise.resolve();
                            }
                        };
                    }
                };
            }
        },
        firebase: { firestore: { FieldValue: { serverTimestamp: function () { return 'SERVER_TS'; } } } },
        rejectWrite: false
    };
    setNow(sandbox, NOW);
    vm.createContext(sandbox);
    vm.runInContext(
        stale[0] + '\n' + names.map(function (name) { return grab(src, name); }).join('\n') +
        '\nthis.api = { local: _localPredModel, merge: _mergePredModel, paint: _paintPredictionCard, sync: _syncPredictionToFirestore, STALE: PRED_STALE_MS };',
        sandbox,
        { filename: file }
    );
    return { sandbox: sandbox, store: store, toasts: toasts, sets: sets, file: file };
}

function cardHtml(page, model) {
    const card = { innerHTML: '' };
    page.sandbox.api.paint(card, model, null);
    return card.innerHTML;
}

function votesOpen(html) {
    return html.indexOf("window._savePrediction('up')") !== -1 &&
        html.indexOf("window._savePrediction('down')") !== -1;
}

const SOURCES = ['features.js', 'bundle.src.js', 'bundle.min.js'];

SOURCES.forEach(function (file) {
    test(file + ' treats 36h as the lock window', function () {
        const page = load(file);
        assert.strictEqual(page.sandbox.api.STALE, 36 * HOUR);
    });

    test(file + ' keeps a fresh unresolved pick locked', function () {
        const page = load(file);
        const saved = { time: NOW - 2 * HOUR, direction: 'up', price: 64000, resolved: false };
        const model = page.sandbox.api.local(saved, 65000);
        assert.strictEqual(model.mode, 'pending');
        assert.strictEqual(model.pending.direction, 'up');
        assert.strictEqual(model.pending.startPrice, 64000);
        assert.strictEqual(model.pending.awaiting, false);
        assert.strictEqual(model.pending.hoursLeft, 22);
        const html = cardHtml(page, model);
        assert.strictEqual(votesOpen(html), false);
        assert.ok(html.indexOf('Prediction Locked In!') !== -1);
    });

    test(file + ' still locks during the score window and unlocks at 36h', function () {
        const page = load(file);
        const waiting = page.sandbox.api.local({
            time: NOW - DAY - HOUR,
            direction: 'down',
            price: 1,
            resolved: false
        }, 2);
        assert.strictEqual(waiting.mode, 'awaiting');
        assert.strictEqual(waiting.pending.awaiting, true);
        assert.strictEqual(votesOpen(cardHtml(page, waiting)), false);

        const lastMs = page.sandbox.api.local({
            time: NOW - (36 * HOUR) + 1,
            direction: 'up',
            price: 1,
            resolved: false
        }, 2);
        assert.strictEqual(lastMs.mode, 'awaiting');

        const stale = page.sandbox.api.local({
            time: NOW - 36 * HOUR,
            direction: 'up',
            price: 1,
            resolved: false
        }, 2);
        assert.strictEqual(stale.mode, 'form');
        assert.strictEqual(stale.pending, null);
        const html = cardHtml(page, stale);
        assert.strictEqual(votesOpen(html), true);
        assert.ok(html.indexOf('Will Bitcoin go') !== -1);
    });

    test(file + ' ignores a resolved local copy and a pick with no time', function () {
        const page = load(file);
        ['resolved', 'serverScored'].forEach(function (flag) {
            const saved = { time: NOW - HOUR, direction: 'up', price: 1 };
            saved[flag] = true;
            const model = page.sandbox.api.local(saved, 2);
            assert.strictEqual(model.mode, 'form', flag);
            assert.strictEqual(votesOpen(cardHtml(page, model)), true, flag);
        });
        assert.strictEqual(page.sandbox.api.local(null, 2).mode, 'form');
        assert.strictEqual(page.sandbox.api.local({ direction: 'up', price: 1 }, 2).mode, 'form');
        assert.strictEqual(page.sandbox.api.local({ time: 0, direction: 'up', price: 1 }, 2).mode, 'form');
    });

    test(file + ' drops a stale server pending pick and keeps a fresh one', function () {
        const page = load(file);
        const fresh = page.sandbox.api.merge(null, 100, {
            predPending: { time: NOW - 3 * HOUR, direction: 'down', startPrice: 70 }
        });
        assert.strictEqual(fresh.mode, 'pending');
        assert.strictEqual(fresh.pending.direction, 'down');
        assert.strictEqual(fresh.pending.startPrice, 70);
        assert.strictEqual(votesOpen(cardHtml(page, fresh)), false);

        const stale = page.sandbox.api.merge(null, 100, {
            predPending: { time: NOW - 36 * HOUR, direction: 'up', startPrice: 70 }
        });
        assert.strictEqual(stale.mode, 'form');
        assert.strictEqual(stale.pending, null);
        assert.strictEqual(votesOpen(cardHtml(page, stale)), true);

        const missingTime = page.sandbox.api.merge(null, 100, { predPending: { direction: 'up' } });
        assert.strictEqual(missingTime.mode, 'form');
    });

    test(file + ' lets a fresh server pick replace a stale local one', function () {
        const page = load(file);
        const model = page.sandbox.api.merge(
            { time: NOW - 40 * HOUR, direction: 'up', price: 10, resolved: false },
            100,
            { predPending: { time: NOW - HOUR, direction: 'down', startPrice: 80 } }
        );
        assert.strictEqual(model.mode, 'pending');
        assert.strictEqual(model.pending.direction, 'down');
        assert.strictEqual(model.pending.startPrice, 80);
        assert.strictEqual(votesOpen(cardHtml(page, model)), false);
    });

    test(file + ' uses the server start price when the direction matches', function () {
        const page = load(file);
        const same = page.sandbox.api.merge(
            { time: NOW - HOUR, direction: 'up', price: 10, resolved: false },
            100,
            { predPending: { time: NOW - HOUR, direction: 'up', startPrice: 80 } }
        );
        assert.strictEqual(same.pending.startPrice, 80);
        const other = page.sandbox.api.merge(
            { time: NOW - HOUR, direction: 'up', price: 10, resolved: false },
            100,
            { predPending: { time: NOW - HOUR, direction: 'down', startPrice: 80 } }
        );
        assert.strictEqual(other.pending.direction, 'up');
        assert.strictEqual(other.pending.startPrice, 10);
    });

    test(file + ' unlocks a pick the server already scored', function () {
        const page = load(file);
        const t = NOW - 2 * HOUR;
        const exact = page.sandbox.api.merge(
            { time: t, direction: 'up', price: 10, resolved: false },
            100,
            { predLastResult: { time: t, outcome: 'correct', direction: 'up', startPrice: 10, resolvedPrice: 12 } }
        );
        assert.strictEqual(exact.mode, 'form');
        assert.strictEqual(exact.scoredLocal, true);
        assert.strictEqual(exact.pending, null);
        assert.strictEqual(votesOpen(cardHtml(page, exact)), true);

        const near = page.sandbox.api.merge(
            { time: t, direction: 'down', price: 10, resolved: false },
            100,
            { predLastResult: { time: t + 60000, outcome: 'void', direction: 'down' } }
        );
        assert.strictEqual(near.mode, 'form');
        assert.strictEqual(near.scoredLocal, true);
        assert.ok(cardHtml(page, near).indexOf('Void') !== -1);
    });
});

function signedIn(page, uid) {
    page.sandbox.auth.currentUser = { uid: uid, isAnonymous: false };
}

const asyncQueue = [];
function testAsync(name, fn) {
    asyncQueue.push(fn().then(function () {
        console.log('✅ ' + name);
        passed++;
    }, function (e) {
        console.log('❌ ' + name + ': ' + (e.stack || e.message));
        failed++;
    }));
}

SOURCES.forEach(function (file) {
    testAsync(file + ' clears the local pick when the server rejects the write', async function () {
        const page = load(file);
        signedIn(page, 'user-1');
        page.store.btc_price_prediction = JSON.stringify({ direction: 'up', price: 1, time: NOW });
        page.sandbox.rejectWrite = true;
        page.sandbox.api.sync({ direction: 'up', price: 1, time: NOW });
        assert.strictEqual(page.sets.length, 1);
        assert.strictEqual(page.sets[0].name, 'active_predictions');
        assert.strictEqual(page.sets[0].id, 'user-1');
        assert.strictEqual(page.sets[0].payload.direction, 'up');
        assert.strictEqual(page.sets[0].payload.resolved, false);
        assert.strictEqual(page.sets[0].payload.time, 'SERVER_TS');
        await Promise.resolve();
        await Promise.resolve();
        assert.strictEqual(Object.prototype.hasOwnProperty.call(page.store, 'btc_price_prediction'), false);
        assert.ok(page.toasts.some(function (msg) { return msg.indexOf('Could not save that prediction') !== -1; }));
    });

    testAsync(file + ' keeps the local pick when the write succeeds', async function () {
        const page = load(file);
        signedIn(page, 'user-1');
        page.store.btc_price_prediction = '{"direction":"down"}';
        page.sandbox.api.sync({ direction: 'down', price: 2, time: NOW });
        await Promise.resolve();
        assert.strictEqual(page.store.btc_price_prediction, '{"direction":"down"}');
        assert.strictEqual(page.toasts.length, 0);
    });

    test(file + ' does not touch storage when the write never starts', function () {
        const page = load(file);
        page.store.btc_price_prediction = '{"direction":"up"}';
        page.sandbox.auth.currentUser = { uid: 'guest', isAnonymous: true };
        page.sandbox.api.sync({ direction: 'up', price: 1, time: NOW });
        assert.strictEqual(page.sets.length, 0);
        assert.strictEqual(page.store.btc_price_prediction, '{"direction":"up"}');

        page.sandbox.auth.currentUser = { uid: 'user-1', isAnonymous: false };
        page.sandbox.firebase = undefined;
        page.sandbox.api.sync({ direction: 'up', price: 1, time: NOW });
        assert.strictEqual(page.sets.length, 0);
        assert.strictEqual(page.store.btc_price_prediction, '{"direction":"up"}');
    });
});

Promise.all(asyncQueue).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
}).catch(function (err) {
    console.error(err);
    process.exit(1);
});
