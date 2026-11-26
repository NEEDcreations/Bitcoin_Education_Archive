// Onboarding asks the mode questions first, then shows the mode picker with
// the answer-based mode marked "Recommended for you". Any mode stays pickable.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

// Tiny DOM: enough for bqFillModePicker.
function el(tag) {
    const node = {
        tagName: String(tag).toUpperCase(), children: [], attrs: {}, style: {}, className: '', id: '',
        _text: '', listeners: {},
        appendChild: function (c) { this.children.push(c); c.parentNode = this; return c; },
        setAttribute: function (k, v) { this.attrs[k] = String(v); },
        getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
        addEventListener: function (t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
        click: function () { (this.listeners.click || []).forEach(function (fn) { fn({}); }); }
    };
    Object.defineProperty(node, 'textContent', {
        get: function () { return this._text + this.children.map(function (c) { return c.textContent; }).join(''); },
        set: function (v) { this._text = String(v); this.children = []; }
    });
    return node;
}
function all(node, out) {
    out = out || [];
    node.children.forEach(function (c) { out.push(c); all(c, out); });
    return out;
}
const store = {};
global.localStorage = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
};
global.document = {
    getElementById: function () { return null; },
    createElement: el,
    head: { appendChild: function () {} }
};
const reg = require('../features.registry.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ok  ' + name); passed++; }
    catch (e) { console.log('  FAIL ' + name + ': ' + (e && e.message ? e.message : e)); failed++; }
}
function buttons(box) { return all(box).filter(function (n) { return n.tagName === 'BUTTON' && n.getAttribute('data-mode'); }); }
function byMode(box, id) { return buttons(box).filter(function (b) { return b.getAttribute('data-mode') === id; })[0]; }

test('queue order puts the questions before the mode picker', function () {
    const src = read('popup-stack.js');
    assert.ok(src.includes("var ORDER = ['gift', 'terms', 'age', 'quiz', 'pace', 'quest'];"));
    const sandbox = {
        setTimeout: function () { return 0; }, clearTimeout: function () {}, WeakMap: WeakMap,
        MutationObserver: function () { this.observe = function () {}; },
        document: { readyState: 'complete', addEventListener: function () {}, getElementById: function () { return null; }, querySelectorAll: function () { return []; }, createElement: function () { return { appendChild: function () {} }; }, head: { appendChild: function () {} }, body: { classList: { toggle: function () {} } }, documentElement: { classList: { toggle: function () {} } } },
        history: { pushState: function () {}, back: function () {} }, location: { href: 'https://quest.test/' }, addEventListener: function () {}
    };
    sandbox.window = sandbox; sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);
    const q = sandbox.btcOnboardingQueue;
    const seen = [];
    q.skip('gift'); q.skip('terms'); q.skip('age');
    q.ready('pace', function () { seen.push('pace'); });
    q.ready('quiz', function () { seen.push('quiz'); });
    q.ready('quest', function () { seen.push('quest'); });
    q.onSignedIn();
    assert.deepStrictEqual(seen, ['quiz']);
    q.done('quiz');
    assert.deepStrictEqual(seen, ['quiz', 'pace']);
    q.done('pace');
    assert.deepStrictEqual(seen, ['quiz', 'pace', 'quest']);
});

test('onboarding picker tags the recommended mode even after a default was saved', function () {
    localStorage.setItem('btc_experience_mode', 'lite');
    const box = el('div');
    globalThis.bqFillModePicker(box, { recommended: 'lite', preselect: 'lite', ignoreStored: true, onPick: function () {} });
    const lite = byMode(box, 'lite');
    assert.strictEqual(lite.getAttribute('aria-pressed'), 'true');
    assert.strictEqual(lite.getAttribute('data-recommended'), '1');
    assert.ok(lite.textContent.includes('Recommended for you'));
    assert.ok(!box.textContent.includes('(current)'));
    assert.strictEqual(buttons(box).filter(function (b) { return b.getAttribute('data-recommended'); }).length, 1);
});

test('picking another mode moves the selection and keeps the recommendation tag', function () {
    const box = el('div');
    let picked = 'intermediate';
    const fill = function () {
        globalThis.bqFillModePicker(box, { recommended: 'intermediate', preselect: picked, ignoreStored: true, onPick: function (id) { picked = id; fill(); } });
    };
    fill();
    byMode(box, 'advanced').click();
    assert.strictEqual(picked, 'advanced');
    assert.strictEqual(byMode(box, 'advanced').getAttribute('aria-pressed'), 'true');
    assert.strictEqual(byMode(box, 'intermediate').getAttribute('aria-pressed'), 'false');
    assert.ok(byMode(box, 'intermediate').textContent.includes('Recommended for you'));
    assert.ok(!byMode(box, 'advanced').textContent.includes('Recommended'));
    assert.strictEqual(buttons(box).length, 4);
});

test('skipped questions fall back to the Guided default', function () {
    const box = el('div');
    globalThis.bqFillModePicker(box, { recommended: '', preselect: 'beginner', ignoreStored: true });
    const b = byMode(box, 'beginner');
    assert.strictEqual(b.getAttribute('aria-pressed'), 'true');
    assert.ok(b.textContent.includes(' · Recommended'));
    assert.ok(!b.textContent.includes('for you'));
});

test('settings picker still shows the saved mode as current', function () {
    localStorage.setItem('btc_experience_mode', 'advanced');
    const box = el('div');
    globalThis.bqFillModePicker(box, { recommended: 'lite' });
    assert.ok(byMode(box, 'advanced').textContent.includes('(current)'));
    assert.strictEqual(byMode(box, 'advanced').getAttribute('aria-pressed'), 'true');
});

test('answer mapping is unchanged', function () {
    assert.strictEqual(reg.bqRecommendMode([0, 0, 1]), 'lite');
    assert.strictEqual(reg.bqRecommendMode([1, 1, 1]), 'beginner');
    assert.strictEqual(reg.bqRecommendMode([2, 2, 1]), 'intermediate');
    assert.strictEqual(reg.bqRecommendMode([2, 2, 2]), 'advanced');
});

test('questions show the Bitcoin Quest title, logo and description; pace uses the answer', function () {
    const src = read('onboarding.js.src');
    const quiz = src.slice(src.indexOf('function appIntroHeader'), src.indexOf('function renderIntro'));
    assert.ok(quiz.includes("'Bitcoin Quest'"));
    assert.ok(quiz.includes('/icons/bq-logo-96.png'));
    assert.ok(src.includes("var APP_BLURB = 'A free, gamified app for learning Bitcoin. Read topics, complete quests, and earn real sats as you go.';"));
    assert.ok(quiz.includes('blurb.textContent = APP_BLURB'));
    assert.ok(quiz.includes('card.appendChild(appIntroHeader())'));
    assert.ok(!/db\.collection|\.set\(|\.update\(/.test(quiz));
    const pace = src.slice(src.indexOf('window.btcShowPaceStep'), src.indexOf('window.btcShowQuizStep'));
    assert.ok(pace.includes("readPace() || rec || 'beginner'"));
    assert.ok(pace.includes('ignoreStored: true'));
    assert.ok(pace.includes('recommended: rec'));
    assert.ok(!pace.includes('Before you begin'));
    const min = read('onboarding.js');
    assert.ok(min.includes('A free, gamified app for learning Bitcoin.'));
    assert.ok(min.includes('ignoreStored'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
