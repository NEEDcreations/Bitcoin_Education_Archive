#!/usr/bin/env node
// Achievement share cards: server-diff triggers, mode gates, URL, escaping, no rewards.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const share = require('../achievement-share.js');
const registry = require('../features.registry.js');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

const LATEST = "Latest: When you hit a big milestone, a share card lets friends open Bitcoin Quest from your link. Finishing the day's quests shows a small card, and a streak button lets you share your streak.";

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
    share.STREAK_PLACES.forEach(function (place) { assert.ok(src.includes(place), place); });
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

test('mode registry documents the three share rows', () => {
    const src = read('features.registry.js');
    assert.ok(src.includes('achievementShareInline'));
    assert.ok(src.includes('The streak button is user-initiated and is not a popup.'));
    assert.strictEqual(registry.BQ_EXPERIENCE_MODES.lite, 'Lite');
    assert.strictEqual(registry.BQ_EXPERIENCE_MODES.beginner, 'Guided');
    assert.strictEqual(registry.BQ_EXPERIENCE_MODES.intermediate, 'Balanced');
    assert.strictEqual(registry.BQ_EXPERIENCE_MODES.advanced, 'Everything');
    assert.strictEqual(registry.bqModeAllows('achievementShare', 'lite'), false);
    assert.strictEqual(registry.bqModeAllows('achievementShare', 'guided'), true);
    assert.strictEqual(registry.bqModeAllows('achievementShare', 'beginner'), true);
    assert.strictEqual(registry.bqModeAllows('achievementShare', 'intermediate'), true);
    assert.strictEqual(registry.bqModeAllows('achievementShare', 'advanced'), true);
    assert.strictEqual(registry.bqModeAllows('achievementShareInline', 'lite'), true);
    assert.strictEqual(registry.bqModeAllows('streakShare', 'lite'), true);
    assert.strictEqual(registry.bqModeAllows('streakShare', 'everything'), true);
    assert.strictEqual(registry.bqModeAllows('search', 'lite'), true);
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
    assert.ok(worker.includes("Satoshi's Favor block found"));
    assert.ok(worker.includes('Daily quests done'));
    assert.ok(worker.includes('Streak on Bitcoin Quest'));
    assert.strictEqual(worker.includes("searchParams.get('ref')"), false);
    assert.strictEqual(worker.includes('searchParams.get("ref")'), false);
    share.SHARE_TYPES.forEach(function (type) {
        const file = path.join(root, 'og', 'achievements', type + '.png');
        const buf = fs.readFileSync(file);
        assert.strictEqual(buf.slice(0, 8).toString('hex'), '89504e470d0a1a0a', type);
        assert.ok(worker.includes(type + ':'), type);
    });
});

test('pages ship one script, one Latest line, and the v2412 cache', () => {
    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    assert.ok(html.includes('achievement-share.js?v=20261026_v2412'));
    assert.ok(html.includes('features.registry.js?v=20261026_v2412'));
    const notes = read('patch-notes.html');
    assert.strictEqual((notes.match(/Latest:/g) || []).length, 1);
    assert.ok(notes.includes(LATEST));
    assert.ok(notes.includes('Inventory explains how sending keys works. Add Peer is on a profile opened from Global Chat or the leaderboard, and one send can include up to 3 keys per peer each day.'));
    assert.ok(!notes.includes('Latest: Inventory explains'));
    assert.ok(read('sw.js').includes("const CACHE_NAME = 'btc-archive-v2412'"));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
