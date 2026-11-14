#!/usr/bin/env node
'use strict';
// Home page: Start Here embed, metric-circle size, and Lite/Guided More hiding.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + (e && e.message || e));
        failed++;
    }
}

test('Start Here id is one constant and the old tutorial file is gone', function () {
    const app = read('app.js');
    const assigns = app.match(/START_HERE_YT_ID\s*=\s*'[^']*'/g) || [];
    assert.deepStrictEqual(assigns, ["START_HERE_YT_ID = 'zOQetZgXz48'"]);
    assert.ok(app.includes('https://www.youtube-nocookie.com/embed/'));
    assert.ok(app.includes("allow', 'autoplay; encrypted-media'"));
    assert.ok(!app.includes('intro-tutorial.mp4'));
    assert.ok(!app.includes('TODO'));
    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    assert.ok(html.includes('>Start Here</button>'));
    assert.ok(html.includes('>Start Here</div>'));
    assert.ok(html.includes('>Start Here</span>'));
    assert.ok(!html.includes('Introduction / Tutorial'));
    assert.ok(!html.includes('Watch the intro'));
    assert.ok(!html.includes('intro-tutorial'));
    assert.ok(!html.includes('zOQetZgXz48'), 'the id stays in the constant, not the markup');
    assert.ok(html.includes('data-home-more-quiet'));
    assert.ok(html.includes("mode === 'beginner'"));
    const ranking = read('ranking.js');
    const previewAt = ranking.indexOf('_previewDailyXpGain');
    const awaitAt = ranking.indexOf('var result = await awardPointsFn');
    assert.ok(previewAt > 0 && previewAt < awaitAt);
    assert.ok(ranking.includes('_revertDailyXpPreview'));
});

test('metric circles grow with percentile and stay inside min and max', function () {
    const ux = read('mobile-ux.js');
    const start = ux.indexOf('window.metricCircleBounds = function()');
    const end = ux.indexOf('function metricSnapValues');
    assert.ok(start > 0 && end > start);
    const sandbox = { window: {}, localStorage: { getItem: function () { return null; } } };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(ux.slice(start, end), sandbox, { filename: 'metric-circles.js' });
    assert.strictEqual(sandbox.metricCircleSize(0, { min: 48, max: 64 }), 48);
    assert.strictEqual(sandbox.metricCircleSize(100, { min: 48, max: 64 }), 64);
    assert.strictEqual(sandbox.metricCircleSize(50, { min: 48, max: 64 }), 56);
    assert.ok(sandbox.metricCircleSize(100) <= 88);
    assert.ok(sandbox.metricCircleSize(0) >= 48);
    const peers = [100, 80, 60, 40, 20];
    assert.strictEqual(sandbox.metricPercentileVsActive(0, peers, 200), 0);
    assert.strictEqual(sandbox.metricPercentileVsActive(120, peers, 200), 100);
    const low = sandbox.metricPercentileVsActive(10, peers, 200);
    const mid = sandbox.metricPercentileVsActive(50, peers, 200);
    assert.ok(low < mid && mid < 100);
    assert.strictEqual(sandbox.metricPercentileVsActive(50, [], 200), null);
    sandbox._badgeDistActive = 180;
    assert.strictEqual(sandbox.metricActiveUserCount(), 180);
    const fn = ux.slice(ux.indexOf('window.renderProgressRings = function()'), ux.indexOf('// ---- #13: Welcome Back Message from Nacho ----'));
    assert.ok(fn.includes('metricCircleSize'));
    assert.ok(fn.includes('metricPercentileVsActive'));
    assert.ok(fn.includes("safeJSON('btc_visited_channels', []).length"));
});

function homeDom() {
    const ids = {};
    function relink(parent) {
        parent.children.forEach(function (child, i) {
            child.parentNode = parent;
            child.nextSibling = parent.children[i + 1] || null;
        });
    }
    function detach(child) {
        const parent = child.parentNode;
        if (!parent) return;
        const at = parent.children.indexOf(child);
        if (at >= 0) parent.children.splice(at, 1);
        relink(parent);
        child.parentNode = null;
        child.nextSibling = null;
    }
    function place(parent, child, ref) {
        detach(child);
        let at = ref ? parent.children.indexOf(ref) : parent.children.length;
        if (at < 0) at = parent.children.length;
        parent.children.splice(at, 0, child);
        child.parentNode = parent;
        relink(parent);
    }
    function make(id) {
        const el = {
            id: id,
            hidden: false,
            parentNode: null,
            nextSibling: null,
            children: [],
            attributes: {},
            style: {
                setProperty: function (key, value) { this[key] = value; },
                removeProperty: function (key) { delete this[key]; }
            },
            setAttribute: function (key, value) { this.attributes[key] = String(value); },
            getAttribute: function (key) { return this.attributes[key]; },
            removeAttribute: function (key) { delete this.attributes[key]; },
            appendChild: function (child) { place(this, child, null); return child; },
            insertBefore: function (child, ref) { place(this, child, ref); return child; }
        };
        ids[id] = el;
        return el;
    }
    const home = make('home');
    const today = make('todayCard');
    const btn = make('homeMoreToggle');
    const more = make('homeMore');
    const quest = make('questGuideBanner');
    const intro = make('introVideoSection');
    home.appendChild(today);
    home.appendChild(btn);
    home.appendChild(more);
    more.appendChild(quest);
    more.appendChild(intro);
    const classes = new Set();
    const body = {
        classList: {
            add: function (name) { classes.add(name); },
            remove: function () { Array.prototype.slice.call(arguments).forEach(function (name) { classes.delete(name); }); },
            toggle: function (name, on) { if (on) classes.add(name); else classes.delete(name); },
            contains: function (name) { return classes.has(name); }
        }
    };
    global.document = {
        body: body,
        head: { appendChild: function () {} },
        createElement: function () { return { id: '', textContent: '', appendChild: function () {}, setAttribute: function () {} }; },
        getElementById: function (id) { return ids[id] || null; },
        querySelectorAll: function () { return []; }
    };
    return { quest: quest, more: more, btn: btn, today: today, intro: intro };
}

test('Lite hides More and Guided keeps Your Quest Begins', function () {
    const reg = require('../features.registry.js');
    const lite = homeDom();
    reg.bqApplyExperienceSurfaces('lite');
    assert.strictEqual(lite.more.style.display, 'none');
    assert.strictEqual(lite.btn.style.display, 'none');
    assert.strictEqual(lite.btn.getAttribute('data-home-more-quiet'), 'lite');
    assert.strictEqual(lite.quest.parentNode, lite.more);
    assert.ok(!lite.quest.getAttribute('data-quest-kept'));
    const guided = homeDom();
    reg.bqApplyExperienceSurfaces('beginner');
    assert.strictEqual(guided.quest.getAttribute('data-quest-kept'), '1');
    assert.strictEqual(guided.quest.nextSibling, guided.today);
    assert.notStrictEqual(guided.quest.parentNode, guided.more);
    assert.strictEqual(guided.more.style.display, 'none');
    assert.strictEqual(guided.btn.style.display, 'none');
    assert.strictEqual(guided.intro.parentNode, guided.more);
    reg.bqApplyExperienceSurfaces('advanced');
    assert.strictEqual(guided.quest.parentNode, guided.more);
    assert.ok(!guided.btn.style.display);
    assert.ok(!guided.more.getAttribute('data-home-more-quiet'));
    assert.strictEqual(reg.bqModeAllows('introVideo', 'lite'), true);
    assert.strictEqual(reg.bqModeAllows('featuredOn', 'beginner'), true);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
