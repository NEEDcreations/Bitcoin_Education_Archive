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
        source: 'live',
        dailyXp: 42,
        day: day,
        uid: 'u1'
    });
    const log = [
        { pts: 8, ts: beforeReset, reason: 'yesterday', uid: 'u1' },
        { pts: 5, ts: afterReset, reason: 'quiz', uid: 'u1' },
        { pts: 100, ts: afterReset, reason: 'other account', uid: 'u2' }
    ];
    const figs = w._dailyXpFigures(w._serverDailyXp, log);
    assert.strictEqual(figs.used, 42);
    assert.strictEqual(figs.sum, 5);
    assert.strictEqual(figs.meterLine, (42).toLocaleString() + '/1000 XP today');
    assert.strictEqual(figs.earningsAmount, '+' + (42).toLocaleString() + ' XP');
    assert.strictEqual(figs.note, 'Includes XP from activities without a notification');
    assert.ok(figs.meterLine.indexOf('uncapped') === -1);
    assert.strictEqual(page.els.dailyXpMeterText.textContent, figs.meterLine);
    assert.strictEqual(page.els.dailyXpMeterFill.style.width, '4.2%');
    assert.ok(seen.indexOf(42) !== -1);

    w._paintDailyXpMeter({ signedIn: true, source: 'live', dailyXp: 50, day: day, dailyCap: 1000, uid: 'u1' });
    const held = w._dailyXpFigures(w._serverDailyXp, log);
    assert.strictEqual(held.used, 50);
    assert.strictEqual(held.note, 'Includes XP from activities without a notification');
    assert.ok(seen.indexOf(50) !== -1);
});

test('the earnings note is hidden when this user\'s lines are not below the server total', function () {
    const page = loadCard();
    const w = page.sandbox.window;
    const day = '2026-10-26';
    const ts = Date.UTC(2026, 9, 26, 12, 0);
    w._paintDailyXpMeter({ signedIn: true, source: 'live', dailyXp: 42, day: day, uid: 'u1' });
    const equal = w._dailyXpFigures(w._serverDailyXp, [{ pts: 42, ts: ts, uid: 'u1' }]);
    assert.strictEqual(equal.note, '');
    assert.strictEqual(equal.sum, 42);
    const over = w._dailyXpFigures(w._serverDailyXp, [{ pts: 80, ts: ts, uid: 'u1' }]);
    assert.strictEqual(over.sum, 80);
    assert.strictEqual(over.note, '');
    assert.strictEqual(over.meterLine, (42).toLocaleString() + '/1000 XP today');
});

test('a late lower award does not replace a newer live total for the same day', function () {
    const page = loadCard();
    const w = page.sandbox.window;
    const day = '2026-10-26';
    w._paintDailyXpMeter({ signedIn: true, source: 'live', dailyXp: 42, day: day, uid: 'u1' });
    const liveAt = Date.now();
    w._paintDailyXpMeter({
        signedIn: true,
        source: 'award',
        sentAt: liveAt - 1000,
        dailyXp: 13,
        day: day,
        uid: 'u1'
    });
    assert.strictEqual(w._serverDailyXp.dailyXp, 42);
    assert.strictEqual(w._serverDailyXp.day, day);
    w._paintDailyXpMeter({
        signedIn: true,
        source: 'award',
        sentAt: Date.now() + 1000,
        dailyXp: 50,
        day: day,
        uid: 'u1'
    });
    assert.strictEqual(w._serverDailyXp.dailyXp, 50);
    w._paintDailyXpMeter({
        signedIn: true,
        source: 'award',
        sentAt: Date.now(),
        dailyXp: 90,
        day: '2026-10-25',
        uid: 'u1'
    });
    assert.strictEqual(w._serverDailyXp.dailyXp, 50);
    assert.strictEqual(w._serverDailyXp.day, day);
    assert.strictEqual(page.els.dailyXpMeterText.textContent, (50).toLocaleString() + '/1000 XP today');
});

test('a cap overflow displays as 1,000 on both views', function () {
    const page = loadCard();
    const w = page.sandbox.window;
    w._paintDailyXpMeter({ signedIn: true, source: 'live', dailyXp: 2500, day: '2026-10-26', uid: 'u1' });
    const figs = w._dailyXpFigures(w._serverDailyXp, []);
    assert.strictEqual(figs.used, 1000);
    assert.strictEqual(figs.meterLine, (1000).toLocaleString() + '/1000 XP today');
    assert.strictEqual(figs.earningsAmount, '+' + (1000).toLocaleString() + ' XP');
    assert.ok(figs.meterLine.indexOf('uncapped') === -1);
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
                    data: function () { return { total: 42 }; }
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
        { pts: 13, ts: Date.now(), reason: 'quiz', uid: 'fixture-user' }
    ]);
    assert.strictEqual(text, figs.meterLine);
    assert.strictEqual(figs.used, 42);
    assert.strictEqual(figs.sum, 13);
    assert.strictEqual(text, '42/1000 XP today');
    assert.ok(text.indexOf('uncapped') === -1);
    assert.strictEqual(figs.earningsAmount, '+42 XP');
    assert.strictEqual(figs.note, 'Includes XP from activities without a notification');
    assert.deepStrictEqual(writes, []);
    assert.deepStrictEqual(page.writes, []);
});

test('a denied live read retries once on the next repaint after auth refresh', function () {
    let snaps = 0;
    let tokenCb = null;
    const day = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
    function dailyDoc() {
        return {
            onSnapshot: function (ok, err) {
                snaps += 1;
                if (snaps === 1) err({ code: 'permission-denied' });
                else ok({ exists: true, data: function () { return { total: 42 }; } });
                return function () {};
            }
        };
    }
    const page = loadCard({
        auth: {
            currentUser: { uid: 'fixture-user', isAnonymous: false },
            onIdTokenChanged: function (cb) { tokenCb = cb; }
        },
        firebase: {
            firestore: {},
            functions: function () {
                return { httpsCallable: function () { return function () {
                    return { then: function (ok) { ok({ data: { dailyXp: 7, day: day, dailyCap: 1000 } }); return { catch: function () {} }; } };
                }; } };
            }
        },
        db: {
            collection: function () {
                return { doc: function () { return {
                    collection: function (name) {
                        return { doc: function () { return name === 'daily_points' ? dailyDoc() : {
                            onSnapshot: function (ok) {
                                ok({ exists: false, data: function () { return {}; } });
                                return function () {};
                            }
                        }; } };
                    }
                }; } };
            }
        }
    });
    assert.strictEqual(snaps, 1);
    assert.strictEqual(page.els.dailyXpMeterText.textContent, '7/1000 XP today');
    page.sandbox.window._ensureDailyXp();
    assert.strictEqual(snaps, 1);
    tokenCb(page.sandbox.auth.currentUser);
    page.sandbox.window._ensureDailyXp();
    assert.strictEqual(snaps, 2);
    assert.strictEqual(page.els.dailyXpMeterText.textContent, '42/1000 XP today');
    page.sandbox.window._ensureDailyXp();
    assert.strictEqual(snaps, 2);
});

test('rules, callable, and the XP tab do not let the client write the counter', function () {
    const rules = read('firestore.rules');
    const at = rules.indexOf('match /users/{userId}/daily_points/{docId}');
    const block = rules.slice(at, rules.indexOf('match /', at + 10));
    assert.ok(block.includes('allow read: if request.auth != null && request.auth.uid == userId'));
    assert.ok(block.includes('allow write: if false'));
    assert.ok(!block.includes('allow read, write: if false'));

    const quest = read('functions/src/questCallables.js');
    assert.ok(!quest.includes('uncapped'));
    assert.ok(quest.includes('offsetDateKey'));
    assert.ok(quest.includes('meterFrom(used, 0)'));

    const card = read('today-card.js');
    const watch = card.slice(card.indexOf('function watchDailyXp'), card.indexOf('function loadDailyXpMeter'));
    assert.ok(watch.includes("collection('daily_points')"));
    assert.ok(watch.includes('onSnapshot'));
    assert.ok(watch.includes('dailyDeniedGen'));
    assert.ok(card.includes('onIdTokenChanged'));
    assert.ok(!watch.includes('.set('));
    assert.ok(!watch.includes('.update('));
    assert.ok(!watch.includes('.add('));
    assert.ok(!card.includes('uncapped'));
    assert.ok(card.includes('if (sum < used) note = EARNINGS_NOTE'));
    assert.ok(card.includes("source === 'award'"));
    assert.ok(card.includes("used.toLocaleString() + '/1000 XP today'"));

    const ranking = read('ranking.js');
    assert.ok(ranking.includes("source: 'award'"));
    assert.ok(ranking.includes('sentAt: _awardSentAt'));
    assert.ok(ranking.includes('uid: uid'));

    const notes = read('notifications.js');
    assert.ok(card.includes('Includes XP from activities without a notification'));
    assert.ok(notes.includes('todayEarningsNote'));
    assert.ok(notes.includes('_dailyXpFigures'));
    assert.ok(notes.includes('_subscribeDailyXp'));
    assert.ok(notes.includes('function _pointsUid'));
    assert.ok(notes.includes('e.uid === uid'));
    assert.ok(notes.includes('window._clearPointsHistory'));
    assert.ok(!notes.includes('todayTotal'));
    assert.ok(!notes.includes("collection('daily_points')"));
    assert.ok(notes.includes("localStorage.removeItem('btc_points_log')"));

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
