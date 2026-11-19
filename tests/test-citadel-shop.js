// Citadel shop client: Premium gate, weekly cap, lesson parts, footer, flags, SW pin. No network.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(f) { return fs.readFileSync(path.join(root, f), 'utf8'); }

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e)); failed++; }
}

const src = read('citadel-shop.js');
const sandbox = { window: {}, console: console };
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'citadel-shop.js' });
const CS = sandbox.window.CitadelShop;
const NOW = Date.parse('2026-11-19T13:00:00Z');
const OLD = NOW - 30 * 86400000;
function view(u, flags) { return CS.computeView(u, { now: NOW, signedIn: true, flags: flags || CS.DEFAULT_FLAGS }); }
function html(u, flags) { return CS.renderHtml(view(u, flags)); }

const ALL_LESSONS = { lesson_walls: true, lesson_turret: true, lesson_vault: true, lesson_tower: true, lesson_keep: true };
const free = { orangeTickets: 500, created: OLD, citadel: { lessonParts: ALL_LESSONS } };
const prem = { orangeTickets: 210, created: OLD, premium: { active: true },
    citadel: { stages: { walls: 4, turret: 2, vault: 1 }, weekSpent: 45, lessonParts: ALL_LESSONS } };

test('footer battle line is exact', () => {
    assert.strictEqual(CS.CONFIG.BATTLE_LINE, 'Paying never changes who wins a battle.');
    [free, prem].forEach(u => {
        assert.ok(html(u).includes('<p class="cs-foot" data-cs-battle="1">Paying never changes who wins a battle.</p>'));
    });
});

test('referral-week flag defaults off', () => {
    assert.strictEqual(CS.DEFAULT_FLAGS.referralWeekPremiumBuy, false);
    assert.strictEqual(view(free).referralWeek, false);
    assert.ok(!html(free).includes('data-cs-referral'));
    assert.ok(/referralWeekPremiumBuy: d\.referralWeekPremiumBuy === true/.test(src), 'flag only on when the doc says true');
    assert.ok(html(free, { referralWeekPremiumBuy: true }).includes('data-cs-referral'), 'staging can turn it on');
});

test('non-Premium sees Get Premium and no buy', () => {
    const v = view(free);
    assert.strictEqual(v.showGetPremium, true);
    const h = html(free);
    assert.ok(h.includes('data-cs-premium="1"') && h.includes('Get Premium'));
    assert.ok(!h.includes('data-cs-buy'), 'no buy buttons');
    assert.ok(!h.includes('data-cs-build'), 'no build buttons');
    v.parts.forEach(p => assert.strictEqual(p.action, 'locked'));
    assert.strictEqual((h.match(/Premium only/g) || []).length, 10, '5 shop cards + 5 lesson parts locked');
});

test('Premium sees buy buttons and no Get Premium', () => {
    const h = html(prem);
    assert.ok(!h.includes('data-cs-premium'));
    // 45 used leaves 75, below every open stage price, so nothing is buyable yet.
    assert.ok(!h.includes('data-cs-buy='));
    const fresh = JSON.parse(JSON.stringify(prem)); fresh.citadel.weekSpent = 15; // 105 left
    const hf = html(fresh);
    assert.ok(hf.includes('data-cs-buy="tower"'));
    assert.ok(!hf.includes('data-cs-buy="keep"'), 'keep stage is 115, over the 105 left');
    assert.ok(!hf.includes('data-cs-buy="vault"'), 'vault stage is 120, over the 105 left');
    assert.ok(!h.includes('data-cs-buy="walls"'), 'complete part has no buy');
    assert.ok(h.includes('7 / 15 stages'));
    assert.ok(h.includes('45 / 120 used this week'));
    assert.ok(h.includes('data-cs-remaining="75"'));
});

test('weekly cap disables buying', () => {
    const atCap = JSON.parse(JSON.stringify(prem)); atCap.citadel.weekSpent = 120;
    const v = view(atCap);
    assert.strictEqual(v.remaining, 0);
    assert.strictEqual(v.atCap, true);
    v.parts.filter(p => !p.done).forEach(p => { assert.strictEqual(p.action, 'disabled'); assert.strictEqual(p.reason, 'weekly_cap'); });
    const h = html(atCap);
    assert.ok(!h.includes('data-cs-buy'));
    assert.ok(h.includes('Weekly limit reached'));
    const near = JSON.parse(JSON.stringify(prem)); near.citadel.weekSpent = 110; // 10 left, cheapest stage 100
    assert.ok(!html(near).includes('data-cs-buy'));
    assert.strictEqual(CS.CONFIG.WEEKLY_CAP_OT, 120);
});

test('lesson parts show owned and earned from lessons for free players', () => {
    const v = view(free);
    assert.strictEqual(v.lessons.length, 5);
    v.lessons.forEach(l => assert.strictEqual(l.owned, true));
    const h = html(free);
    assert.strictEqual((h.match(/data-earned="1">Owned, earned from lessons</g) || []).length, 5);
});

test('lesson part build is locked without Premium, with a Get Premium path', () => {
    const v = view(free);
    v.lessons.forEach(l => assert.strictEqual(l.action, 'locked'));
    const h = html(free);
    assert.ok(!h.includes('data-cs-build'));
    assert.ok(h.includes('Building with lesson parts needs Premium. <button class="cs-link" type="button" data-cs-premium="1">Get Premium</button>'));
    const pv = view(prem);
    pv.lessons.forEach(l => assert.strictEqual(l.action, 'build'));
    assert.strictEqual((html(prem).match(/data-cs-build=/g) || []).length, 5);
});

test('unearned lesson parts are not shown as owned', () => {
    const none = { orangeTickets: 0, created: OLD };
    const h = html(none);
    assert.ok(!h.includes('earned from lessons</span>'));
    assert.strictEqual((h.match(/Finish its lesson to earn it/g) || []).length, 5);
});

test('click handler re-checks Premium before any buy or build call', () => {
    assert.ok(/if \(!u \|\| !\(u\.premium && u\.premium\.active === true\)\) \{ openPremium\(\); return; \}/.test(src));
});

test('callable stubs use httpsCallable names', () => {
    assert.deepStrictEqual(JSON.parse(JSON.stringify(CS.CALLABLES)),
        { status: 'getCitadelShopStatus', buy: 'buyCitadelStage', build: 'buildCitadelPart', grant: 'claimLessonParts' });
    assert.ok(src.includes('firebase.functions().httpsCallable(name)'));
});

test('TODO(phil) toggles are present with spec defaults', () => {
    assert.strictEqual((src.match(/\/\/ TODO\(phil\):/g) || []).length, 5);
    assert.strictEqual(CS.CONFIG.PROGRESS_LABEL_MODE, 'stages');
    assert.strictEqual(CS.CONFIG.LAPSED_PARTS_MODE, 'keep_paused');
    assert.strictEqual(CS.CONFIG.PRE_JAN3_OT_SPENDABLE, true);
    assert.strictEqual(CS.CONFIG.MIN_ACCOUNT_AGE_DAYS, 7);
    assert.strictEqual(CS.CONFIG.COSMETICS_TAB, false);
});

test('new account cannot buy before the minimum age', () => {
    const young = JSON.parse(JSON.stringify(prem)); young.created = NOW - 2 * 86400000;
    view(young).parts.filter(p => !p.done).forEach(p => assert.strictEqual(p.reason, 'account_age'));
});

test('no em-dashes in the shop source', () => {
    assert.ok(!src.includes('\u2014'));
    assert.ok(!/\\u2014/.test(src));
});

test('SW is v2616 and quests.js loads citadel-shop.js at v2616', () => {
    assert.ok(read('sw.js').includes("const CACHE_NAME = 'btc-archive-v2616'"));
    const q = read('quests.js');
    assert.ok(q.includes("var CITADEL_SHOP_SRC = '/citadel-shop.js?v=20261119_v2616';"));
    assert.ok(!q.includes('USE XP TO CONSTRUCT YOUR OWN CITADEL'));
    assert.strictEqual(read('index.html'), read('404.html'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
