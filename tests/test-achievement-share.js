#!/usr/bin/env node
// Achievement share cards: server-diff triggers, mode gates, URL, escaping, no rewards.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const share = require('../achievement-share.js');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

const LATEST = "Latest: Timechain TV: 29 new full-length documentaries on the History & Documentaries channel.";
const SHARE_NOTE = "When you hit a big milestone, a share card lets friends open Bitcoin Quest from your link. Finishing the day's quests shows a small card, and a streak button lets you share your streak.";

test('sharing grants nothing and client claims are ignored', () => {
    const src = read('achievement-share.js');
    assert.deepStrictEqual(share.shareResult(), { xp: 0, sats: 0, tickets: 0 });
    assert.strictEqual(share.shareGrantsReward(), false);
    assert.deepStrictEqual(share.clientClaimEvents(), []);
    ['awardPoints', 'claimSats', 'contributeRaid', 'logReferralVisit', 'btcClaimSessionPopup'].forEach(function (word) {
        assert.strictEqual(src.includes(word), false, word);
    });
    assert.ok(src.includes('currentUser.streak'));
    assert.ok(src.includes('Share your streak'));
    assert.ok(src.includes('min-width:44px'));
    assert.ok(src.includes('min-height:44px'));
    assert.strictEqual(share.Z_SHEET, 2200000);
    assert.deepStrictEqual(share.STREAK_PLACES, ['dailyXpMeter', 'mobileUserInfo', 'Current Streak']);
    share.STREAK_PLACES.forEach(function (place) { assert.ok(src.includes(place), place); });
    ['rank-streak', 'welcomeBanner', 'progressRings', 'streakBanner', 'userDisplay'].forEach(function (place) {
        assert.strictEqual(src.includes(place), false, place);
    });
    assert.ok(src.includes('background:#1c0f07'));
    assert.ok(src.includes('color:#fff7ed'));
    assert.ok(src.includes("typeof auth !== 'undefined'"));
    assert.ok(src.includes("typeof db !== 'undefined'"));
    assert.ok(src.includes("typeof currentUser !== 'undefined'"));
    assert.ok(src.includes('MutationObserver'));
    assert.ok(src.includes('America/New_York'));
    assert.ok(src.includes('after your exam'));
    assert.ok(src.includes('Show share cards for achievements'));
    assert.ok(src.includes('Share your progress'));
    assert.strictEqual(share.CTA, 'Learn Bitcoin and earn sats at bitcoineducation.quest');
});

test('referral URL keeps a safe code and drops email or a long uid', () => {
    assert.strictEqual(share.buildShareUrl('abc12345', 'streak'), 'https://bitcoineducation.quest/?ref=abc12345&a=streak');
    const email = share.buildShareUrl('person@example.com', 'badge');
    assert.strictEqual(email, 'https://bitcoineducation.quest/?a=badge');
    assert.strictEqual(email.includes('@'), false);
    assert.strictEqual(email.includes('example.com'), false);
    const uid = 'a'.repeat(28) + 'ZZ';
    const bare = share.buildShareUrl(uid, 'xp');
    assert.strictEqual(bare.includes(uid), false);
    assert.strictEqual(bare, 'https://bitcoineducation.quest/?a=xp');
    share.SHARE_TYPES.forEach(function (type) {
        assert.ok(share.buildShareUrl('abc12345', type).endsWith('&a=' + type));
    });
});

test('card text drops tags and control characters', () => {
    const dirty = share.escapeCardText('<script>alert(1)</script>\u0000"quoted"');
    assert.strictEqual(dirty.includes('<'), false);
    assert.strictEqual(dirty.includes('>'), false);
    assert.strictEqual(dirty.includes('"'), false);
    assert.strictEqual(share.displayName({ username: 'Ada', uid: 'abc' }), 'Ada');
    assert.strictEqual(share.displayName({ username: 'ada@example.com', uid: 'abc' }), 'Bitcoiner');
    assert.strictEqual(share.displayName({ username: 'abc', uid: 'abc' }), 'Bitcoiner');
    assert.strictEqual(share.displayName({ displayName: 'a'.repeat(24) }), 'Bitcoiner');
    const card = share.cardModel({ type: 'streak', days: 30, code: 'abc12345' }, { username: '<b>Ada</b>' });
    assert.strictEqual(card.title, '🔥 30-day streak on Bitcoin Quest');
    assert.strictEqual(card.name.includes('<'), false);
    assert.strictEqual(card.url, 'https://bitcoineducation.quest/?ref=abc12345&a=streak');
    assert.strictEqual(card.cta, share.CTA);
    const daily = share.cardModel({ type: 'daily', days: 4 }, { username: 'Ada', referralCode: 'abc12345' });
    assert.strictEqual(daily.title, 'Daily quests done 🔥 day 4 streak');
    assert.ok(daily.url.includes('a=daily'));
});

test('rarity threshold is the badge registry, with xp fallback only when distribution is absent', () => {
    assert.strictEqual(share.rarityLabel(0.5), 'Legendary');
    assert.strictEqual(share.rarityLabel(4.9), 'Epic');
    assert.strictEqual(share.rarityLabel(25), 'Rare');
    assert.strictEqual(share.rarityLabel(25.1), 'Common');
    assert.strictEqual(share.rarityLabel(40), 'Common');
    assert.deepStrictEqual(share.RARITY_THRESHOLDS.shareWorthy, ['Unclaimed', 'Legendary', 'Epic', 'Rare']);
    assert.strictEqual(share.RARITY_THRESHOLDS.xpFallback, 500);
    const dist = { totalUsers: 1000, counts: { common: 400, rare: 100, epic: 40, legend: 5, none: 0 } };
    assert.strictEqual(share.badgeWorthy('common', dist, { common: { xp: 2000, name: 'Common' } }).ok, false);
    assert.strictEqual(share.badgeWorthy('rare', dist, {}).rarity, 'Rare');
    assert.strictEqual(share.badgeWorthy('epic', dist, {}).rarity, 'Epic');
    assert.strictEqual(share.badgeWorthy('legend', dist, {}).rarity, 'Legendary');
    assert.strictEqual(share.badgeWorthy('none', dist, {}).rarity, 'Unclaimed');
    assert.strictEqual(share.badgeWorthy('none', dist, {}).ok, true);
    assert.strictEqual(share.badgeWorthy('hard', null, { hard: { xp: 500, name: 'Hard' } }).ok, true);
    assert.strictEqual(share.badgeWorthy('easy', null, { easy: { xp: 150, name: 'Easy' } }).ok, false);
});

test('server profile diff fires only the significant achievements', () => {
    assert.deepStrictEqual(share.diffServerProfile(null, { streak: 30 }), []);
    const week = share.diffServerProfile({ streak: 6 }, { streak: 7 });
    assert.strictEqual(week.some(function (ev) { return ev.type === 'streak'; }), false);
    const month = share.diffServerProfile({ streak: 29 }, { streak: 30 });
    assert.strictEqual(month[0].id, 'streak:30');
    assert.strictEqual(month[0].title, '🔥 30-day streak on Bitcoin Quest');
    assert.deepStrictEqual(share.LONG_STREAKS, [30, 60, 100, 200, 365]);
    const quiet = share.diffServerProfile({ raidBossesDefeated: 1, raidDamageAllTime: 0 }, { raidBossesDefeated: 2, raidDamageAllTime: 0 });
    assert.strictEqual(quiet.some(function (ev) { return ev.type === 'raid'; }), false);
    const raid = share.diffServerProfile({ raidBossesDefeated: 1, raidDamageAllTime: 3 }, { raidBossesDefeated: 2, raidDamageAllTime: 8 });
    assert.strictEqual(raid[0].id, 'raid:2');
    const pleb = share.diffServerProfile({ points: 100 }, { points: 500 });
    assert.strictEqual(pleb.some(function (ev) { return ev.type === 'rank'; }), false);
    const maxi = share.diffServerProfile({ points: 2016 }, { points: 2140 });
    assert.strictEqual(maxi[0].id, 'rank:maxi');
    assert.strictEqual(share.NOTABLE_RANKS[0].name, 'Maxi');
    assert.strictEqual(share.NOTABLE_RANKS[share.NOTABLE_RANKS.length - 1].name, 'Satoshi');
    const same = share.diffServerProfile({ certPassed_prop: true }, { certPassed_prop: true });
    assert.strictEqual(same.some(function (ev) { return ev.type === 'cert_scholar'; }), false);
    const scholar = share.diffServerProfile({ certPassed_prop: false }, { certPassed_prop: true });
    assert.strictEqual(scholar[0].type, 'cert_scholar');
    const protocol = share.diffServerProfile({}, { certPassed_tech: true });
    assert.strictEqual(protocol[0].id, 'cert_protocol');
    const block = share.diffServerProfile({ sfBlocksFound: 1 }, { sfBlocksFound: 2 });
    assert.strictEqual(block[0].id, 'sf_block:2');
    const solver = share.diffServerProfile({ sfBlockSolver: false, sfBlocksFound: 0 }, { sfBlockSolver: true, sfBlocksFound: 0 });
    assert.strictEqual(solver[0].type, 'sf_block');
    const common = share.diffServerProfile({ badges: [] }, { badges: ['common'] }, {
        distribution: { totalUsers: 100, counts: { common: 40 } },
        catalog: { common: { name: 'Common', xp: 2000 } }
    });
    assert.strictEqual(common.some(function (ev) { return ev.type === 'badge'; }), false);
    const rare = share.diffServerProfile({ badges: [] }, { badges: ['rare'] }, {
        distribution: { totalUsers: 100, counts: { rare: 10 } },
        catalog: { rare: { name: 'Rare Badge', xp: 10 } }
    });
    assert.strictEqual(rare[0].id, 'badge:rare');
    const hard = share.diffServerProfile({ badges: [] }, { badges: ['hard'] }, {
        catalog: { hard: { name: 'Hard', xp: 500 } }
    });
    assert.strictEqual(hard[0].type, 'badge');
    const day = share.diffServerProfile({ trifectaDays: 1, streak: 4 }, { trifectaDays: 2, streak: 5 }, { today: '2026-10-26' });
    assert.strictEqual(day[0].kind, 'toast');
    assert.strictEqual(day[0].id, 'daily:2026-10-26');
    assert.strictEqual(day[0].title, 'Daily quests done 🔥 day 5 streak');
});

test('popups are once each, one a day, and the daily toast does not spend that cap', () => {
    const today = '2026-10-26';
    const base = { mode: 'advanced', toggleOn: true, today: today, allowsPopup: true, allowsInline: true };
    const first = share.decideShare({ type: 'rank', id: 'rank:maxi', kind: 'popup' }, share.emptyState(), base);
    assert.strictEqual(first.action, 'popup');
    assert.strictEqual(first.state.popupDay, today);
    const again = share.decideShare({ type: 'rank', id: 'rank:maxi', kind: 'popup' }, first.state, base);
    assert.strictEqual(again.action, 'skip');
    const second = share.decideShare({ type: 'raid', id: 'raid:2', kind: 'popup' }, first.state, base);
    assert.strictEqual(second.action, 'queue');
    assert.strictEqual(second.state.popupDay, today);
    assert.strictEqual(second.state.shown['raid:2'], undefined);
    const tomorrow = share.decideShare({ type: 'raid', id: 'raid:2', kind: 'popup' }, first.state, Object.assign({}, base, { today: '2026-10-27' }));
    assert.strictEqual(tomorrow.action, 'popup');
    const toast = share.decideShare({ type: 'daily', id: 'daily:2026-10-26', kind: 'toast' }, share.emptyState(), base);
    assert.strictEqual(toast.action, 'toast');
    assert.strictEqual(toast.state.popupDay, '');
    assert.strictEqual(toast.state.dailyToastDay, today);
    const popupAfter = share.decideShare({ type: 'rank', id: 'rank:maxi', kind: 'popup' }, toast.state, base);
    assert.strictEqual(popupAfter.action, 'popup');
    const toastAgain = share.decideShare({ type: 'daily', id: 'daily:2026-10-26', kind: 'toast' }, toast.state, base);
    assert.strictEqual(toastAgain.action, 'skip');
    const busy = share.decideShare({ type: 'rank', id: 'rank:maxi', kind: 'popup' }, share.emptyState(), Object.assign({}, base, { exam: true, busy: true }));
    assert.strictEqual(busy.action, 'queue');
    assert.strictEqual(busy.state.shown['rank:maxi'], undefined);
});

test('lite skips popups, keeps the toast and the streak button, and the toggle blocks only automatic cards', () => {
    const today = '2026-10-26';
    const event = { type: 'rank', id: 'rank:maxi', kind: 'popup' };
    const lite = share.decideShare(event, share.emptyState(), { mode: 'lite', toggleOn: true, today: today, allowsPopup: false, allowsInline: true });
    assert.strictEqual(lite.action, 'skip');
    const toast = share.decideShare({ type: 'daily', id: 'daily:2026-10-26', kind: 'toast' }, share.emptyState(), { mode: 'lite', toggleOn: true, today: today, allowsPopup: false, allowsInline: true });
    assert.strictEqual(toast.action, 'toast');
    const streak = share.decideShare({ type: 'streak', id: 'streak:now', kind: 'manual', manual: true }, share.emptyState(), { mode: 'lite', toggleOn: false, today: today });
    assert.strictEqual(streak.action, 'sheet');
    const badge = share.decideShare({ type: 'badge', id: 'badge:rare', kind: 'manual', manual: true }, share.emptyState(), { mode: 'lite', toggleOn: true, today: today });
    assert.strictEqual(badge.action, 'skip');
    const off = share.decideShare(event, share.emptyState(), { mode: 'advanced', toggleOn: false, today: today, allowsPopup: true });
    assert.strictEqual(off.action, 'skip');
    ['beginner', 'intermediate', 'advanced'].forEach(function (mode) {
        const on = share.decideShare(event, share.emptyState(), { mode: mode, toggleOn: true, today: today, allowsPopup: true });
        assert.strictEqual(on.action, 'popup', mode);
    });
    assert.strictEqual(share.modeAllows('achievementShare', 'lite'), false);
    assert.strictEqual(share.modeAllows('achievementShareInline', 'lite'), true);
    assert.strictEqual(share.modeAllows('streakShare', 'lite'), true);
    assert.strictEqual(share.modeAllows('streakShare', 'advanced'), true);
});

test('share modes live in the share module and the registry stays untouched', () => {
    const src = read('features.registry.js');
    assert.strictEqual(src.includes('BQ_EXPERIENCE_MODES'), false);
    assert.strictEqual(src.includes('bqModeAllows'), false);
    assert.strictEqual(share.modeAllows('achievementShare', 'lite'), false);
    assert.strictEqual(share.modeAllows('achievementShareInline', 'lite'), true);
    assert.strictEqual(share.modeAllows('streakShare', 'lite'), true);
});

test('script-scope let bindings resolve before window', () => {
    const src = read('achievement-share.js');
    const script = [
        "let auth = { marker: 'script-auth', currentUser: { uid: 'abc12345', isAnonymous: false }, onAuthStateChanged: function (fn) { fn(auth.currentUser); return function () {}; } };",
        "let db = { marker: 'script-db', collection: function () { return { doc: function () { return { onSnapshot: function () { return function () {}; }, update: function () { return Promise.resolve(); } }; } }; } };",
        "let currentUser = { marker: 'script-user', streak: 12, username: 'Ada', referralCode: 'abc12345' };",
        src
    ].join('\n');
    const sandbox = { window: {}, console: console, setTimeout: setTimeout, clearTimeout: clearTimeout, Intl: Intl, Date: Date };
    sandbox.window.window = sandbox.window;
    vm.runInNewContext(script, sandbox, { filename: 'share-scope.js' });
    const api = sandbox.window.AchievementShare;
    assert.strictEqual(api.getAuth().marker, 'script-auth');
    assert.strictEqual(api.getDb().marker, 'script-db');
    assert.strictEqual(api.getCurrentUser().marker, 'script-user');
    assert.strictEqual(api.getCurrentUser().streak, 12);
    assert.strictEqual(sandbox.window.auth, undefined);
    assert.strictEqual(sandbox.window.db, undefined);
    assert.strictEqual(sandbox.window.currentUser, undefined);
});

test('a manual share during an exam is not queued, and a capped popup does not block the toast', () => {
    const today = '2026-10-26';
    const base = { mode: 'advanced', toggleOn: true, today: today, allowsPopup: true, allowsInline: true };
    const manual = share.decideShare({ type: 'streak', id: 'streak:now', kind: 'manual', manual: true }, share.emptyState(), Object.assign({}, base, { exam: true }));
    assert.strictEqual(manual.action, 'later');
    assert.strictEqual(manual.state.queue.length, 0);
    assert.strictEqual(manual.state.shown['streak:now'], undefined);
    const queued = share.emptyState();
    queued.popupDay = today;
    queued.queue = [
        { type: 'rank', id: 'rank:maxi', kind: 'popup' },
        { type: 'daily', id: 'daily:2026-10-26', kind: 'toast' }
    ];
    const picked = share.pickQueued(queued, base);
    assert.strictEqual(picked.action, 'toast');
    assert.strictEqual(picked.state.queue.length, 1);
    assert.strictEqual(picked.state.queue[0].id, 'rank:maxi');
    assert.strictEqual(picked.state.dailyToastDay, today);
});

test('compact shown keeps the newest keys and the day is America/New_York', () => {
    const state = share.emptyState();
    state.popupDay = '2026-10-26';
    state.dailyToastDay = '2026-10-26';
    for (var i = 0; i < 400; i++) state.shown['k' + String(i).padStart(4, '0')] = 1;
    const text = share.compactShown(state);
    assert.ok(text.length <= 1500);
    assert.ok(text.indexOf('popup:20261026') === 0);
    assert.ok(text.includes('toast:20261026'));
    assert.ok(text.includes('k0399'));
    assert.strictEqual(text.includes('k0000'), false);
    state.shown['daily:20261025'] = 1;
    assert.strictEqual(share.compactShown(state).includes('daily:'), false);
    const legacy = share.mergeShown('toast:20261025,daily:20261026', share.emptyState());
    assert.strictEqual(legacy.dailyToastDay, '2026-10-26');
    assert.strictEqual(legacy.shown['daily:20261026'], undefined);
    const older = share.mergeShown('toast:20261026,daily:20261025', share.emptyState());
    assert.strictEqual(older.dailyToastDay, '2026-10-26');
    assert.strictEqual(share.questDay(Date.UTC(2026, 9, 27, 3, 30)), '2026-10-26');
    assert.strictEqual(share.questDay(Date.UTC(2026, 9, 27, 5, 0)), '2026-10-27');
});

test('celebrations, dialogs, and large overlays count as busy', () => {
    function el(id, extra) {
        extra = extra || {};
        return {
            id: id,
            style: extra.style || {},
            classList: { contains: function (name) { return (extra.classes || []).indexOf(name) >= 0; } },
            getAttribute: function (name) { return extra.attr ? extra.attr[name] : null; },
            getBoundingClientRect: function () { return extra.rect || { width: 800, height: 600 }; },
            querySelector: function () { return extra.child || null; },
            querySelectorAll: function () { return []; }
        };
    }
    const badge = el('badgeCelebration', { style: { position: 'fixed', zIndex: '400', display: 'flex' } });
    const sheet = el('bqShareSheet', { style: { position: 'fixed', zIndex: '2200000', display: 'flex' }, attr: { role: 'dialog', 'aria-modal': 'true' } });
    const toast = el('bqDailyShareToast', { style: { position: 'fixed', zIndex: '400', display: 'flex' } });
    const overlay = el('customOverlay', { style: { position: 'fixed', zIndex: '1200', display: 'flex' } });
    const dialog = el('welcome', { style: { position: 'fixed', zIndex: '10', display: 'flex' }, attr: { role: 'dialog' } });
    const nodes = [badge, sheet, toast, overlay, dialog];
    const doc = {
        getElementById: function (id) {
            for (var i = 0; i < nodes.length; i++) if (nodes[i].id === id) return nodes[i];
            return null;
        },
        querySelector: function () { return null; },
        querySelectorAll: function (sel) {
            if (sel === '[role="dialog"], [aria-modal="true"]') return [sheet, dialog];
            if (sel === '*') return nodes;
            return [];
        }
    };
    const busy = share.detectBusy(doc, {});
    assert.strictEqual(busy.busy, true);
    assert.strictEqual(busy.modal, true);
    const onlySheet = share.detectBusy({
        getElementById: function () { return null; },
        querySelector: function () { return null; },
        querySelectorAll: function (sel) {
            if (sel === '*') return [sheet, toast];
            if (sel.indexOf('dialog') >= 0) return [sheet];
            return [];
        }
    }, {});
    assert.strictEqual(onlySheet.busy, false);
    function chat(open) {
        return {
            id: 'chatOverlay',
            style: { position: 'fixed', zIndex: '250000', display: 'flex', opacity: '1' },
            classList: { contains: function () { return false; } },
            getBoundingClientRect: function () {
                if (open) return { top: 68, left: 0, right: 390, bottom: 844, width: 390, height: 776 };
                return { top: 844, left: 0, right: 390, bottom: 1620, width: 390, height: 776 };
            },
            querySelector: function () { return null; },
            querySelectorAll: function () { return []; }
        };
    }
    function chatDoc(panel) {
        return {
            getElementById: function (id) { return panel.id === id ? panel : null; },
            querySelector: function () { return null; },
            querySelectorAll: function (sel) { return sel === '*' ? [panel] : []; }
        };
    }
    const view = { innerHeight: 844, innerWidth: 390 };
    const parked = share.detectBusy(chatDoc(chat(false)), view);
    assert.strictEqual(parked.busy, false);
    const openChat = share.detectBusy(chatDoc(chat(true)), view);
    assert.strictEqual(openChat.busy, true);
    const faded = chat(true);
    faded.style.opacity = '0';
    assert.strictEqual(share.detectBusy(chatDoc(faded), view).busy, false);
});

test('shown marker is an owner string and the worker OG is static', () => {
    const rules = read('firestore.rules');
    assert.ok(rules.includes('function shareCardsShownOk()'));
    assert.ok(rules.includes("(!changed.hasAny(['shareCardsShown']) || shareCardsShownOk())"));
    assert.ok(rules.includes('1500'));
    const state = share.emptyState();
    state.popupDay = '2026-10-26';
    state.dailyToastDay = '2026-10-26';
    state.shown['streak:30'] = 1;
    const compact = share.compactShown(state);
    assert.ok(compact.length <= 1500);
    assert.ok(/^[a-z0-9_:,]+$/.test(compact));
    assert.strictEqual(compact.includes('-'), false);
    const merged = share.mergeShown(compact, share.emptyState());
    assert.strictEqual(merged.popupDay, '2026-10-26');
    assert.strictEqual(merged.shown['streak:30'], 1);
    const worker = read('workers/seo-router/worker.js');
    assert.ok(worker.includes("'/og/achievements/'"));
    assert.ok(worker.includes("origin + '/?a='"));
    assert.ok(worker.slice(worker.indexOf('function renderAchievementPage')).includes('content="noindex, follow"'));
    assert.ok(worker.includes("'Vary': 'User-Agent'") || worker.includes('"Vary": "User-Agent"'));
    assert.ok(worker.includes("Satoshi's Favor block found"));
    assert.ok(worker.includes('Daily quests done'));
    assert.ok(worker.includes('Streak on Bitcoin Quest'));
    assert.strictEqual(worker.includes("searchParams.get('ref')"), false);
    assert.strictEqual(worker.includes('searchParams.get("ref")'), false);
    share.SHARE_TYPES.forEach(function (type) {
        const file = path.join(root, 'og', 'achievements', type + '.png');
        const buf = fs.readFileSync(file);
        assert.strictEqual(buf.slice(0, 8).toString('hex'), '89504e470d0a1a0a', type);
        assert.strictEqual(buf.readUInt32BE(16), 1200, type);
        assert.strictEqual(buf.readUInt32BE(20), 630, type);
        assert.ok(worker.includes(type + ':'), type);
    });
});

test('pages ship one script, one Latest line, and the v2384 cache', () => {
    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    assert.ok(html.includes('achievement-share.js?v=20261026_v2384'));
    assert.ok(html.includes('timechain-tv.js?v=20261026_v2383'));
    assert.ok(html.includes('features.registry.js?v=20261024_v2368'));
    const notes = read('patch-notes.html');
    assert.strictEqual((notes.match(/Latest:/g) || []).length, 1);
    assert.ok(notes.includes(LATEST));
    assert.ok(notes.includes(SHARE_NOTE));
    assert.ok(!notes.includes('Latest: ' + SHARE_NOTE));
    assert.ok(notes.includes('Inventory explains how sending keys works. Add Peer is on a profile opened from Global Chat or the leaderboard, and one send can include up to 3 keys per peer each day.'));
    assert.ok(!notes.includes('Latest: Inventory explains'));
    assert.ok(read('sw.js').includes("const CACHE_NAME = 'btc-archive-v2384'"));
    const src = read('achievement-share.js');
    const flushSrc = src.slice(src.indexOf('function flush()'), src.indexOf('function openManual'));
    assert.ok(flushSrc.indexOf('state.queue') >= 0 && flushSrc.indexOf('state.queue') < flushSrc.indexOf('busyState()'));
});

test('a popup and a toast that arrive together show the toast only after the sheet closes', () => {
    const today = share.questDay();
    const events = share.diffServerProfile(
        { points: 2000, trifectaDays: 1, streak: 4, badges: [] },
        { points: 2140, trifectaDays: 2, streak: 5, badges: [] },
        { today: today }
    );
    assert.strictEqual(events.length, 2);
    assert.strictEqual(events[0].type, 'rank');
    assert.strictEqual(events[1].kind, 'toast');
    let scans = 0;
    function el() {
        const node = {
            id: '',
            style: {},
            children: [],
            parentNode: null,
            attr: {},
            setAttribute: function (k, v) { node.attr[k] = v; },
            getAttribute: function (k) { return node.attr[k] || null; },
            appendChild: function (child) {
                if (child.parentNode && child.parentNode.children) {
                    child.parentNode.children = child.parentNode.children.filter(function (c) { return c !== child; });
                }
                child.parentNode = node;
                node.children.push(child);
                return child;
            },
            remove: function () {
                const p = node.parentNode;
                if (!p || !p.children) return;
                p.children = p.children.filter(function (c) { return c !== node; });
                node.parentNode = null;
            },
            addEventListener: function () {},
            focus: function () {},
            querySelector: function () { return null; },
            querySelectorAll: function () { return []; },
            classList: { contains: function () { return false; } },
            getBoundingClientRect: function () { return { top: 0, left: 0, right: 390, bottom: 844, width: 390, height: 844 }; }
        };
        return node;
    }
    function find(n, id) {
        if (!n) return null;
        if (n.id === id) return n;
        const kids = n.children || [];
        for (let i = 0; i < kids.length; i++) {
            const hit = find(kids[i], id);
            if (hit) return hit;
        }
        return null;
    }
    const body = el();
    const doc = {
        body: body,
        activeElement: null,
        head: el(),
        createElement: function () { return el(); },
        getElementById: function (id) { return find(body, id); },
        querySelector: function () { return null; },
        querySelectorAll: function () { scans++; return []; }
    };
    const store = {};
    const win = {
        document: doc,
        innerWidth: 390,
        innerHeight: 844,
        localStorage: { getItem: function (k) { return store[k] || null; }, setItem: function (k, v) { store[k] = String(v); } },
        sessionStorage: { getItem: function () { return null; }, setItem: function () {} },
        getComputedStyle: function (node) { return node.style || {}; },
        location: { hostname: 'bitcoineducation.quest', search: '' }
    };
    try {
        share.bindHost(win);
        share.resetState();
        scans = 0;
        share.closeSheet();
        assert.strictEqual(scans, 0);
        share.acceptEvents(events);
        assert.ok(doc.getElementById('bqShareSheet'));
        assert.strictEqual(doc.getElementById('bqDailyShareToast'), null);
        assert.strictEqual(share.currentState().dailyToastDay, '');
        assert.strictEqual(share.currentState().queue.length, 1);
        assert.strictEqual(share.currentState().queue[0].type, 'daily');
        share.closeSheet();
        const toast = doc.getElementById('bqDailyShareToast');
        assert.ok(toast);
        assert.strictEqual(doc.getElementById('bqShareSheet'), null);
        assert.strictEqual(share.currentState().dailyToastDay, today);
        assert.strictEqual(share.currentState().queue.length, 0);
        assert.strictEqual(share.compactShown(share.currentState()).includes('daily:'), false);
        toast.marker = 'once';
        share.acceptEvents([events[1]]);
        assert.strictEqual(doc.getElementById('bqDailyShareToast').marker, 'once');
        assert.strictEqual(share.currentState().dailyToastDay, today);
        assert.strictEqual(share.currentState().queue.length, 0);
    } finally {
        share.resetState();
        share.bindHost({});
    }
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
