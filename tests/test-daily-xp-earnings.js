// Today's earnings and the Today meter share the server daily-cap counter.
// The notifications log is a history. It is not the total, and the client
// does not write users/{uid}/daily_points.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

function comma(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function loadCard(opts) {
    opts = opts || {};
    const els = {};
    function el(id) {
        if (!els[id]) {
            els[id] = {
                id: id,
                textContent: '',
                style: {},
                hidden: false,
                classList: { toggle: function () {}, add: function () {}, remove: function () {}, contains: function () { return false; } },
                setAttribute: function (k, v) { this[k] = v; },
                getAttribute: function (k) { return this[k]; },
                querySelector: function () { return { setAttribute: function () {}, style: {} }; }
            };
        }
        return els[id];
    }
    const store = {};
    const writes = [];
    const sandbox = {
        console: console,
        Date: Date,
        Math: Math,
        Number: Number,
        Object: Object,
        Array: Array,
        String: String,
        JSON: JSON,
        isFinite: isFinite,
        parseInt: parseInt,
        setInterval: function () { return 0; },
        setTimeout: function (fn) { if (opts.runTimers && typeof fn === 'function') fn(); return 0; },
        clearInterval: function () {},
        addEventListener: function () {},
        localStorage: {
            getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
            setItem: function (k, v) { store[k] = String(v); },
            removeItem: function (k) { delete store[k]; }
        },
        document: {
            readyState: 'complete',
            getElementById: function (id) {
                if (id === 'dailyXpMeter' || id === 'dailyXpMeterText' || id === 'dailyXpMeterFill') return el(id);
                return null;
            },
            querySelector: function () { return null; },
            addEventListener: function () {},
            createElement: function () { return el('made'); }
        },
        writes: writes
    };
    sandbox.window = sandbox;
    if (opts.auth) sandbox.auth = opts.auth;
    if (opts.db) sandbox.db = opts.db;
    if (opts.firebase) sandbox.firebase = opts.firebase;
    vm.createContext(sandbox);
    vm.runInContext(read('today-card.js'), sandbox, { filename: 'today-card.js' });
    return { sandbox: sandbox, els: els, writes: writes };
}

test('node --check passes for the earnings files', function () {
    ['today-card.js', 'notifications.js', 'functions/src/questCallables.js', 'sw.js', 'ranking.js'].forEach(function (file) {
        execFileSync(process.execPath, ['--check', file], { cwd: root });
    });
});

test('meter and earnings show the cap counter, not the notification sum', function () {
    const page = loadCard();
    const w = page.sandbox.window;
    const day = '2026-10-26';
    const beforeReset = Date.UTC(2026, 9, 26, 4, 30);
    const afterReset = Date.UTC(2026, 9, 26, 6, 0);
    const seen = [];
    w._subscribeDailyXp(function (snap) { seen.push(snap.dailyXp); });
    w._paintDailyXpMeter({
        signedIn: true,
        loaded: true,
        dailyXp: 42,
        uncappedXp: 2100,
        day: day
    });
    const log = [
        { pts: 8, ts: beforeReset, reason: 'yesterday' },
        { pts: 13, ts: afterReset, reason: 'quiz' }
    ];
    const figs = w._dailyXpFigures(w._serverDailyXp, log);
    assert.strictEqual(figs.used, 42);
    assert.strictEqual(figs.uncapped, 2100);
    assert.strictEqual(figs.sum, 13);
    assert.strictEqual(figs.meterLine, (42).toLocaleString() + '/1000 XP today (+' + comma(2100) + ' uncapped)');
    assert.strictEqual(figs.earningsAmount, '+' + (42).toLocaleString() + ' XP (+' + comma(2100) + ' uncapped)');
    assert.strictEqual(figs.note, 'Includes XP from activities without a notification');
    assert.strictEqual(page.els.dailyXpMeterText.textContent, figs.meterLine);
    assert.strictEqual(page.els.dailyXpMeterFill.style.width, '4.2%');
    assert.ok(seen.indexOf(42) !== -1);

    w._paintDailyXpMeter({ signedIn: true, dailyXp: 50, day: day, dailyCap: 1000 });
    const held = w._dailyXpFigures(w._serverDailyXp, log);
    assert.strictEqual(held.used, 50);
    assert.strictEqual(held.uncapped, 2100);
    assert.strictEqual(page.els.dailyXpMeterText.textContent, held.meterLine);
    assert.ok(seen.indexOf(50) !== -1);
    assert.strictEqual(held.meterLine.indexOf('(+2,100 uncapped)') > 0, true);
    assert.strictEqual(held.earningsAmount.indexOf('(+2,100 uncapped)') > 0, true);
});

test('uncapped XP is omitted on both views when the server did not record any', function () {
    const page = loadCard();
    const w = page.sandbox.window;
    w._paintDailyXpMeter({ signedIn: true, dailyXp: 42, uncappedXp: 0, day: '2026-10-26' });
    const same = [
        { pts: 42, ts: Date.UTC(2026, 9, 26, 12, 0), reason: 'trivia' }
    ];
    const figs = w._dailyXpFigures(w._serverDailyXp, same);
    assert.strictEqual(figs.meterLine, (42).toLocaleString() + '/1000 XP today');
    assert.strictEqual(figs.earningsAmount, '+' + (42).toLocaleString() + ' XP');
    assert.strictEqual(figs.note, '');
    assert.strictEqual(page.els.dailyXpMeterText.textContent, figs.meterLine);
    assert.ok(figs.meterLine.indexOf('uncapped') === -1);
    assert.ok(figs.earningsAmount.indexOf('uncapped') === -1);
});

test('a cap overflow displays as 1,000 on both views and certifications stay outside that number', function () {
    const page = loadCard();
    const w = page.sandbox.window;
    w._paintDailyXpMeter({ signedIn: true, dailyXp: 2500, uncappedXp: 2100, day: '2026-10-26' });
    const figs = w._dailyXpFigures(w._serverDailyXp, []);
    assert.strictEqual(figs.used, 1000);
    assert.strictEqual(figs.uncapped, 2100);
    assert.strictEqual(figs.meterLine, (1000).toLocaleString() + '/1000 XP today (+2,100 uncapped)');
    assert.strictEqual(figs.earningsAmount, '+' + (1000).toLocaleString() + ' XP (+2,100 uncapped)');
    assert.strictEqual(figs.note, 'Includes XP from activities without a notification');
});

test('signed-out meter and earnings say the same thing', function () {
    const page = loadCard();
    const w = page.sandbox.window;
    w._paintDailyXpMeter({ signedIn: false });
    const figs = w._dailyXpFigures(w._serverDailyXp, [{ pts: 13, ts: Date.now(), reason: 'local' }]);
    assert.strictEqual(figs.signedIn, false);
    assert.strictEqual(figs.meterLine, "Sign in to see today's XP");
    assert.strictEqual(figs.earningsAmount, figs.meterLine);
    assert.strictEqual(figs.note, '');
    assert.strictEqual(page.els.dailyXpMeterText.textContent, figs.meterLine);
    assert.strictEqual(figs.used, 0);
});

test('the daily_points listener is read-only and publishes the same snapshot', function () {
    const writes = [];
    function dailyDoc() {
        return {
            onSnapshot: function (ok) {
                ok({
                    exists: true,
                    data: function () { return { total: 42, uncapped: 2100 }; }
                });
                return function () {};
            },
            set: function () { writes.push('set'); },
            update: function () { writes.push('update'); },
            add: function () { writes.push('add'); }
        };
    }
    function userDoc() {
        return {
            collection: function (name) {
                assert.ok(name === 'daily_points' || name === 'daily_action_counts');
                return { doc: function () { return name === 'daily_points' ? dailyDoc() : {
                    onSnapshot: function (ok) {
                        ok({ exists: false, data: function () { return {}; } });
                        return function () {};
                    }
                }; } };
            }
        };
    }
    const page = loadCard({
        auth: { currentUser: { uid: 'fixture-user', isAnonymous: false } },
        firebase: { firestore: {}, functions: function () { throw new Error('callable should not run once the listener is live'); } },
        db: {
            collection: function (name) {
                assert.strictEqual(name, 'users');
                return { doc: function () { return userDoc(); } };
            }
        }
    });
    const text = page.els.dailyXpMeterText.textContent;
    const figs = page.sandbox.window._dailyXpFigures(page.sandbox.window._serverDailyXp, [
        { pts: 13, ts: Date.now(), reason: 'quiz' }
    ]);
    assert.strictEqual(text, figs.meterLine);
    assert.strictEqual(figs.used, 42);
    assert.strictEqual(figs.uncapped, 2100);
    assert.ok(text.indexOf('42/1000 XP today') === 0);
    assert.ok(text.indexOf('(+2,100 uncapped)') > 0);
    assert.strictEqual(figs.earningsAmount.indexOf('+42 XP') , 0);
    assert.deepStrictEqual(writes, []);
    assert.deepStrictEqual(page.writes, []);
});

test('rules, callable, and the XP tab do not let the client write the counter', function () {
    const rules = read('firestore.rules');
    const at = rules.indexOf('match /users/{userId}/daily_points/{docId}');
    const block = rules.slice(at, rules.indexOf('match /', at + 10));
    assert.ok(block.includes('allow read: if request.auth != null && request.auth.uid == userId'));
    assert.ok(block.includes('allow write: if false'));
    assert.ok(!block.includes('allow read, write: if false'));

    const quest = read('functions/src/questCallables.js');
    assert.ok(quest.includes('uncappedXp: uncapped'));
    assert.ok(quest.includes('doc.uncapped'));
    assert.ok(quest.includes('offsetDateKey'));

    const card = read('today-card.js');
    const watch = card.slice(card.indexOf('function watchDailyXp'), card.indexOf('function loadDailyXpMeter'));
    assert.ok(watch.includes("collection('daily_points')"));
    assert.ok(watch.includes('onSnapshot'));
    assert.ok(!watch.includes('.set('));
    assert.ok(!watch.includes('.update('));
    assert.ok(!watch.includes('.add('));
    assert.ok(card.includes("used.toLocaleString() + '/1000 XP today'"));

    const notes = read('notifications.js');
    assert.ok(card.includes('Includes XP from activities without a notification'));
    assert.ok(notes.includes('todayEarningsNote'));
    assert.ok(notes.includes('_dailyXpFigures'));
    assert.ok(notes.includes('_subscribeDailyXp'));
    assert.ok(!notes.includes('todayTotal'));
    assert.ok(!notes.includes("collection('daily_points')"));
    assert.ok(notes.includes("localStorage.removeItem(\\'btc_points_log\\')"));

    const sw = read('sw.js');
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2397'"));
    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    const patch = read('patch-notes.html');
    assert.strictEqual((patch.match(/Latest:/g) || []).length, 1);
    assert.ok(patch.includes("Latest: Today's earnings in Notifications now matches the Today card, using the same daily XP total."));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
