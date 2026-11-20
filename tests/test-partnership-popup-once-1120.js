#!/usr/bin/env node
'use strict';
// Partnership level-up popup shows once per user, peer and level. Spin streak
// line matches the server's BIP Breakthrough gate. Spin "already counted" state.
// TCTV pot info has the invite button.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const server = require('../functions/src/bipBreakthrough');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

// --- popup: run the real function in a sandbox ---
function popupSandbox() {
    const store = {};
    const updates = [];
    const appended = [];
    const doc = {
        getElementById() { return null; },
        createElement() { return { style: {}, addEventListener() {}, remove() {} }; },
        body: { appendChild(n) { appended.push(n); } },
        querySelectorAll() { return []; },
        addEventListener() {},
    };
    const sb = {
        console, setTimeout() {}, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {}, Promise, JSON, Date, Math, Set,
        localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
        sessionStorage: { getItem: () => null, setItem() {} },
        document: doc, navigator: {}, location: { hash: '' },
        auth: { currentUser: { uid: 'userA' }, onAuthStateChanged() {} },
        db: {
            collection(name) {
                return {
                    doc(id) {
                        return {
                            update(v) { updates.push({ name, id, v }); return Promise.resolve(); },
                            get() { return Promise.resolve({ exists: true, data: () => ({ username: 'orto' }) }); },
                            set() { return Promise.resolve(); },
                        };
                    },
                    where() { return this; }, orderBy() { return this; }, limit() { return this; }, onSnapshot() { return () => {}; },
                };
            },
        },
        escapeHtml: (s) => String(s),
    };
    sb.window = sb;
    vm.createContext(sb);
    vm.runInContext(read('notifications.js'), sb, { filename: 'notifications.js' });
    return { sb, store, updates, appended };
}

test('popup shows once, marks the notification read, and skips after reload', () => {
    const a = popupSandbox();
    a.sb.showPartnershipLevelUpPopup({ id: 'n1', type: 'peer_level_up', levelNum: 2, peerId: 'peerB', read: false });
    assert.strictEqual(a.updates.filter((u) => u.name === 'notifications' && u.id === 'n1' && u.v.read === true).length, 1);
    const saved = a.store['bq_partner_lvl_seen_v1'];
    assert.ok(saved && saved.includes('userA:peerB:2'));
    // "Reload": new sandbox, same localStorage contents.
    const b = popupSandbox();
    Object.assign(b.store, a.store);
    let shown = 0;
    b.sb.claimSessionPopup = () => { shown++; return true; };
    b.sb.showPartnershipLevelUpPopup({ id: 'n1', type: 'peer_level_up', levelNum: 2, peerId: 'peerB', read: false });
    assert.strictEqual(shown, 0, 'not shown again');
    // Seen copy still heals the server flag.
    assert.ok(b.updates.some((u) => u.id === 'n1' && u.v.read === true));
});

test('a new level for the same peer still shows', () => {
    const a = popupSandbox();
    a.store['bq_partner_lvl_seen_v1'] = JSON.stringify(['userA:peerB:2']);
    let shown = 0;
    a.sb.claimSessionPopup = () => { shown++; return true; };
    a.sb.showPartnershipLevelUpPopup({ id: 'n2', type: 'peer_level_up', levelNum: 3, peerId: 'peerB', read: false });
    assert.strictEqual(shown, 1);
});

test('a read notification never shows', () => {
    const a = popupSandbox();
    let shown = 0;
    a.sb.claimSessionPopup = () => { shown++; return true; };
    a.sb.showPartnershipLevelUpPopup({ id: 'n3', levelNum: 2, peerId: 'peerC', read: true });
    assert.strictEqual(shown, 0);
});

test('the listener passes the notification id to the popup', () => {
    const src = read('notifications.js');
    assert.ok(src.includes('lvlPayload.id = change.doc.id;'));
    assert.ok(src.includes('showPartnershipLevelUpPopup(lvlPayload)'));
});

// --- spin streak ---
const bsb = { console, Intl, Date, Math, JSON };
bsb.window = bsb; bsb.globalThis = bsb;
vm.createContext(bsb);
vm.runInContext(read('bip-breakthrough.js'), bsb, { filename: 'bip-breakthrough.js' });
const B = bsb.BipBreakthrough;

test('client streak matches the server plan after each counted spin in a week', () => {
    let user = {};
    // Mon Nov 16 .. Sun Nov 22 2026, noon ET.
    for (let d = 16; d <= 22; d++) {
        const now = Date.UTC(2026, 10, d, 17, 0, 0);
        const plan = server.planStreak(user, now);
        user = Object.assign({}, user, plan.update || {});
        if (plan.completes) user.bipBreakthroughClaimedWeek = plan.weekKey;
        const info = B.spinStreakInfo(user, now);
        assert.strictEqual(info.streak, plan.streak, 'day ' + d);
        assert.strictEqual(info.weekKey, plan.weekKey);
    }
    const done = B.spinStreakInfo(user, Date.UTC(2026, 10, 22, 20, 0, 0));
    assert.ok(done.claimed);
    assert.ok(/unlocked this week/.test(B.spinStreakText(done)));
});

test('streak line text: counts, plural, and days left', () => {
    const now = Date.UTC(2026, 10, 20, 15, 0, 0); // Fri 10am ET
    const t = B.spinStreakText(B.spinStreakInfo({ bipBreakthroughStreak: 4, bipBreakthroughLastDay: '2026-11-19', bipBreakthroughWeekKey: '2026-11-16' }, now));
    assert.strictEqual(t, '🔥 Spin streak: 4 days · 3 more for BIP Breakthrough');
    const one = B.spinStreakText(B.spinStreakInfo({ bipBreakthroughStreak: 1, bipBreakthroughLastDay: '2026-11-16', bipBreakthroughWeekKey: '2026-11-16' }, Date.UTC(2026, 10, 16, 20)));
    assert.strictEqual(one, '🔥 Spin streak: 1 day · 6 more for BIP Breakthrough');
});

test('zero, broken, and last-week streaks show 0 days', () => {
    const now = Date.UTC(2026, 10, 16, 15, 0, 0); // Mon 10am ET
    assert.strictEqual(B.spinStreakInfo({}, now).streak, 0);
    assert.strictEqual(B.spinStreakText(B.spinStreakInfo({}, now)), '🔥 Spin streak: 0 days · 7 more for BIP Breakthrough');
    // Missed a day.
    assert.strictEqual(B.spinStreakInfo({ bipBreakthroughStreak: 3, bipBreakthroughLastDay: '2026-11-18', bipBreakthroughWeekKey: '2026-11-16' }, Date.UTC(2026, 10, 20, 15)).streak, 0);
    // Weekly reset.
    assert.strictEqual(B.spinStreakInfo({ bipBreakthroughStreak: 6, bipBreakthroughLastDay: '2026-11-15', bipBreakthroughWeekKey: '2026-11-09' }, now).streak, 0);
    // Too late in the week to reach 7.
    assert.ok(/restarts Monday/.test(B.spinStreakText(B.spinStreakInfo({}, Date.UTC(2026, 10, 20, 15)))));
});

test('guests get no streak line', () => {
    const el = { hidden: false, textContent: 'x' };
    bsb.auth = { currentUser: { isAnonymous: true } };
    B.paintSpinStreak(el, { bipBreakthroughStreak: 3 });
    assert.strictEqual(el.hidden, true);
    assert.strictEqual(el.textContent, '');
    bsb.auth = { currentUser: { isAnonymous: false, uid: 'u' } };
    B.paintSpinStreak(el, {});
    assert.strictEqual(el.hidden, false);
});

test('applySpinResponse folds the server streak in; bonus spins do not', () => {
    const now = Date.UTC(2026, 10, 20, 15);
    const u = {};
    B.applySpinResponse(u, { countedDay: true, breakthrough: { streak: 5, weekKey: '2026-11-16' } }, now);
    assert.strictEqual(u.bipBreakthroughStreak, 5);
    assert.strictEqual(u.bipBreakthroughLastDay, '2026-11-20');
    const v = {};
    B.applySpinResponse(v, { countedDay: false, breakthrough: null }, now);
    assert.deepStrictEqual(v, {});
});

test('Daily Spin modal has the streak line and the already-counted state', () => {
    const app = read('app.js');
    assert.ok(app.includes('id="spinStreakLine"'));
    assert.ok(app.includes('function showSpinAlreadyCounted()'));
    assert.ok(app.includes('Your spin already counted today'));
    assert.ok(!app.includes("showToast('🎡 You already spun today! Come back tomorrow!');\n                } else"));
    const bundle = read('bundle.min.js');
    assert.ok(bundle.includes('Your spin already counted today'));
    assert.ok(read('bundle.src.js').includes('function showSpinAlreadyCounted()'));
});

test('TCTV pot info explains the rate and has an Invite friends button', () => {
    const src = read('tctv-drip.js');
    assert.ok(src.includes('More people watching means a faster sats rate. Invite friends to watch Timechain TV together!'));
    assert.ok(src.includes('class="td-invite"'));
    assert.ok(src.includes("window.miniAppShare('tctv')"));
    assert.ok(src.includes('role="dialog" aria-label="About the pot of sats"'));
});

test('pins are 20261120_v2685 and SW is v2685', () => {
    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    ['notifications.js', 'bip-breakthrough.js', 'tctv-drip.js'].forEach((f) => assert.ok(html.includes(f + '?v=20261120_v2685'), f));
    assert.strictEqual((html.match(/bundle\.min\.js\?v=20261120_v2685/g) || []).length, 2);
    assert.ok(read('sw.js').includes("const CACHE_NAME = 'btc-archive-v2685'"));
});

console.log(passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
