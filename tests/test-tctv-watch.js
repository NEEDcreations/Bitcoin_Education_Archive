// Daily Timechain TV watch reward.
// Heartbeats closer than 55s are not credited, two tabs share one uid
// ledger, the prize is once per server day, the toast flag flips once,
// and the reward notice uses a fixed id.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const watch = require('../functions/src/tctvWatch');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (err) {
        console.log('❌ ' + name + ': ' + err.message);
        failed++;
    }
}

function read(rel) {
    return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

const T0 = Date.parse('2026-10-22T15:00:00.000Z');

function fresh(extra) {
    return Object.assign({ uid: 'user_1', presenceFresh: true, toastSeen: false }, extra || {});
}

function step(prev, now) {
    const result = watch.applyWatchHeartbeat(Object.assign({ uid: 'user_1', presenceFresh: true }, prev), now);
    const next = result.write && result.state ? Object.assign({ uid: 'user_1' }, result.state) : Object.assign({}, prev);
    return { result: result, state: next };
}

test('a heartbeat sooner than 55s is not credited', () => {
    const clock = step(fresh(), T0);
    assert.strictEqual(clock.result.reason, 'clock');
    assert.strictEqual(clock.result.creditSeconds, 0);
    assert.strictEqual(clock.result.write, true);
    assert.strictEqual(clock.state.lastCreditMs, T0);
    const early = step(clock.state, T0 + watch.MIN_GAP_MS - 1000);
    assert.strictEqual(early.result.reason, 'too-fast');
    assert.strictEqual(early.result.creditSeconds, 0);
    assert.strictEqual(early.result.write, false);
    assert.strictEqual(early.result.view.seconds, 0);
    const edge = step(clock.state, T0 + watch.MIN_GAP_MS);
    assert.strictEqual(edge.result.reason, 'credited');
    assert.strictEqual(edge.result.creditSeconds, 55);
    assert.strictEqual(edge.result.view.seconds, 55);
    const full = step(clock.state, T0 + 60000);
    assert.strictEqual(full.result.reason, 'credited');
    assert.strictEqual(full.result.creditSeconds, 60);
    assert.strictEqual(full.result.view.seconds, 60);
});

test('a gap past 3 minutes only starts the clock', () => {
    const clock = step(fresh(), T0);
    const kept = Object.assign({}, clock.state, { seconds: 120 });
    const later = step(kept, T0 + 10 * 60 * 1000);
    assert.strictEqual(later.result.reason, 'clock');
    assert.strictEqual(later.result.creditSeconds, 0);
    assert.strictEqual(later.result.write, true);
    assert.strictEqual(later.result.view.seconds, 120);
    assert.strictEqual(later.state.lastCreditMs, T0 + 10 * 60 * 1000);
    const exact = step(clock.state, T0 + watch.CLOCK_GAP_MS);
    assert.strictEqual(exact.result.reason, 'credited');
    assert.strictEqual(exact.result.creditSeconds, 60);
    const over = step(clock.state, T0 + watch.CLOCK_GAP_MS + 1);
    assert.strictEqual(over.result.reason, 'clock');
    assert.strictEqual(over.result.creditSeconds, 0);
    assert.strictEqual(over.result.view.seconds, 0);
});

test('a 90 second gap credits 60 seconds', () => {
    const clock = step(fresh(), T0);
    const later = step(clock.state, T0 + 90 * 1000);
    assert.strictEqual(later.result.reason, 'credited');
    assert.strictEqual(later.result.creditSeconds, 60);
    assert.strictEqual(later.result.view.seconds, 60);
});

test('two tabs at the same time do not double the credit', () => {
    let state = fresh();
    let credited = 0;
    let reasons = [];
    for (let i = 0; i < 5; i++) {
        const hit = step(state, T0);
        reasons.push(hit.result.reason);
        if (hit.result.creditSeconds > 0) credited += hit.result.creditSeconds;
        state = hit.state;
    }
    assert.strictEqual(credited, 0);
    assert.strictEqual(state.seconds, 0);
    assert.strictEqual(state.lastCreditMs, T0);
    assert.strictEqual(reasons[0], 'clock');
    assert.deepStrictEqual(reasons.slice(1), ['too-fast', 'too-fast', 'too-fast', 'too-fast']);
});

test('reaching 10 minutes takes at least 10 real minutes', () => {
    let state = fresh();
    let now = T0;
    const started = step(state, now);
    assert.strictEqual(started.result.reason, 'clock');
    assert.strictEqual(started.result.creditSeconds, 0);
    state = started.state;
    let awardedAt = null;
    for (let i = 0; i < 20 && awardedAt == null; i++) {
        now += watch.MIN_GAP_MS;
        const hit = step(state, now);
        state = hit.state;
        if (hit.result.view.awarded) awardedAt = now;
    }
    assert.ok(awardedAt, 'reward should land');
    assert.ok(awardedAt - T0 >= 10 * 60 * 1000, 'award arrived in ' + (awardedAt - T0) + 'ms');
    assert.strictEqual(state.seconds, watch.GOAL_SECONDS);
});

test('the reward is once per server day and the notice is written once that day', () => {
    let state = fresh();
    let now = T0;
    let awards = 0;
    let notices = [];
    for (let i = 0; i < 12; i++) {
        const hit = step(state, now);
        state = hit.state;
        if (hit.result.view.awarded) {
            awards += 1;
            notices.push(hit.result.notice);
        }
        now += 60 * 1000;
    }
    assert.strictEqual(awards, 1);
    assert.strictEqual(state.seconds, watch.GOAL_SECONDS);
    assert.strictEqual(state.awardedDay, '2026-10-22');
    assert.strictEqual(notices.length, 1);
    assert.ok(notices[0]);
    assert.strictEqual(notices[0].id, watch.watchNoticeId('user_1', '2026-10-22'));
    assert.strictEqual(notices[0].data.message, watch.TOAST_TEXT);
    assert.strictEqual(notices[0].data.recipientId, 'user_1');
    assert.strictEqual(notices[0].data.read, false);
    assert.strictEqual(notices[0].data.type, 'reward');
    assert.strictEqual(notices[0].data.xp, 100);
    assert.strictEqual(notices[0].data.tickets, 1);
    assert.strictEqual(notices[0].id, 'rn_user_1_tctv_watch_20261022');
    const again = step(state, now);
    assert.strictEqual(again.result.view.awarded, false);
    assert.strictEqual(again.result.notice, null);
    assert.strictEqual(again.result.reason, 'done');

    const nextDay = step(state, Date.parse('2026-10-23T15:00:00.000Z'));
    // The first heartbeat of the new day only starts the clock.
    assert.strictEqual(nextDay.result.reason, 'clock');
    assert.strictEqual(nextDay.result.view.awarded, false);
    assert.strictEqual(nextDay.result.creditSeconds, 0);
    assert.strictEqual(nextDay.result.view.seconds, 0);
    assert.strictEqual(nextDay.result.view.day, '2026-10-23');
    let dayState = nextDay.state;
    let dayNow = Date.parse('2026-10-23T15:00:00.000Z');
    let second = null;
    for (let i = 0; i < 12; i++) {
        dayNow += 60 * 1000;
        const hit = step(dayState, dayNow);
        dayState = hit.state;
        if (hit.result.view.awarded) {
            second = hit.result;
            break;
        }
    }
    assert.ok(second, 'second day should award');
    assert.strictEqual(second.view.awarded, true);
    assert.strictEqual(second.notice.id, watch.watchNoticeId('user_1', '2026-10-23'));
    assert.notStrictEqual(second.notice.id, notices[0].id);
    const dup = watch.buildWatchNotice('user_1', '2026-10-23');
    assert.strictEqual(dup.id, second.notice.id);
});

test('the toast flag is set only the first time the reward is earned', () => {
    let state = fresh();
    let now = T0;
    const toasts = [];
    for (let day = 0; day < 3; day++) {
        const base = T0 + day * 86400000;
        now = base;
        for (let i = 0; i < 12; i++) {
            const hit = step(state, now);
            state = hit.state;
            if (hit.result.view.showToast) toasts.push(hit.result.view.day);
            now += 60 * 1000;
        }
    }
    assert.deepStrictEqual(toasts, ['2026-10-22']);
    assert.strictEqual(state.toastSeen, true);
});

test('a banned account is not credited and is not paid', () => {
    const hit = watch.applyWatchHeartbeat(fresh({
        banned: true,
        seconds: 540,
        day: '2026-10-22',
        lastCreditMs: T0 - 120000,
    }), T0);
    assert.strictEqual(hit.reason, 'banned');
    assert.strictEqual(hit.write, false);
    assert.strictEqual(hit.view.awarded, false);
    assert.strictEqual(hit.view.seconds, 0);
    assert.strictEqual(hit.notice, null);
});

test('without a fresh presence heartbeat nothing is credited', () => {
    const hit = watch.applyWatchHeartbeat(fresh({ presenceFresh: false, lastCreditMs: null }), T0);
    assert.strictEqual(hit.reason, 'not-watching');
    assert.strictEqual(hit.creditSeconds, 0);
    assert.strictEqual(hit.write, false);
});

test('presence must be fresh and on a real station', () => {
    const now = T0;
    assert.strictEqual(watch.presenceIsWatching(null, now), false);
    assert.strictEqual(watch.presenceIsWatching({ station: 'not-a-station', ts: { toMillis: function () { return now; } } }, now), false);
    assert.strictEqual(watch.presenceIsWatching({ station: 'news', ts: { toMillis: function () { return now - 120000; } } }, now), false);
    assert.strictEqual(watch.presenceIsWatching({ station: 'news', ts: { toMillis: function () { return now - 1000; } } }, now), true);
});

test('the offset day flips at 05:00 UTC', () => {
    const before = Date.parse('2026-10-22T04:59:59.000Z');
    const after = Date.parse('2026-10-22T05:00:00.000Z');
    assert.strictEqual(watch.offsetDateKey(before), '2026-10-21');
    assert.strictEqual(watch.offsetDateKey(after), '2026-10-22');
    const yesterday = fresh({
        day: '2026-10-21',
        seconds: 600,
        awardedDay: '2026-10-21',
        lastCreditMs: before - 10 * 60 * 1000,
        toastSeen: true,
    });
    const hit = watch.applyWatchHeartbeat(yesterday, after);
    assert.strictEqual(hit.view.day, '2026-10-22');
    assert.strictEqual(hit.reason, 'clock');
    assert.strictEqual(hit.creditSeconds, 0);
    assert.strictEqual(hit.view.seconds, 0);
    assert.strictEqual(hit.view.done, false);
    assert.strictEqual(hit.view.awarded, false);
    assert.strictEqual(hit.notice, null);
});

test('xp uses the shared taper and does not redeem yesterday overflow', () => {
    const full = watch.planWatchXp(0, 0, '', '2026-10-22');
    assert.strictEqual(full.awarded, 100);
    assert.strictEqual(full.overflowAdded, 0);
    assert.strictEqual(full.overflowRedeemed, 0);
    assert.strictEqual(full.tickets, 1);
    const partial = watch.planWatchXp(950, 0, '', '2026-10-22');
    assert.strictEqual(partial.awarded, 50);
    assert.strictEqual(partial.overflowAdded, 0);
    assert.strictEqual(partial.pendingOverflow, 0);
    assert.strictEqual(partial.touchOverflow, false);
    assert.strictEqual(partial.tickets, 1);
    const capped = watch.planWatchXp(1000, 0, '', '2026-10-22');
    assert.strictEqual(capped.awarded, 0);
    assert.strictEqual(capped.overflowAdded, 0);
    assert.strictEqual(capped.pendingOverflow, 0);
    assert.strictEqual(capped.tickets, 0);
    const redeem = watch.planWatchXp(0, 80, '2026-10-21', '2026-10-22');
    assert.strictEqual(redeem.overflowRedeemed, 0);
    assert.strictEqual(redeem.awarded, 100);
    assert.strictEqual(redeem.pendingOverflow, 0);
    assert.strictEqual(redeem.touchOverflow, false);
    const sameDay = watch.planWatchXp(0, 80, '2026-10-22', '2026-10-22');
    assert.strictEqual(sameDay.overflowRedeemed, 0);
    assert.strictEqual(sameDay.pendingOverflow, 0);
});

test('button text shows minutes, then done', () => {
    assert.deepStrictEqual(watch.watchButtonText(0, false), { emoji: '📺', label: 'Watch TV', sub: '0/10 min' });
    assert.deepStrictEqual(watch.watchButtonText(240, false), { emoji: '📺', label: 'Watch TV', sub: '4/10 min' });
    assert.deepStrictEqual(watch.watchButtonText(600, true), { emoji: '📺', label: 'Watch TV', sub: 'Done ✓' });
});

test('rate limit allows four calls a minute and rejects the fifth', () => {
    let prev = null;
    for (let i = 0; i < watch.RATE_MAX; i++) {
        const hit = watch.nextWatchRate(prev, T0 + i * 1000);
        assert.strictEqual(hit.ok, true);
        prev = hit;
    }
    const blocked = watch.nextWatchRate(prev, T0 + 5000);
    assert.strictEqual(blocked.ok, false);
    const later = watch.nextWatchRate(prev, T0 + watch.RATE_WINDOW_MS);
    assert.strictEqual(later.ok, true);
    assert.strictEqual(later.count, 1);
});

test('callable ignores the client body and writes the notice server-side', () => {
    const src = read('functions/tctv-watch-callable.js');
    assert.ok(src.includes('enforceAppCheck: true'));
    assert.ok(src.includes("collection('tctv_watch')"));
    assert.ok(src.includes("collection('tctv_presence')"));
    assert.ok(src.includes('isFreshPresence'));
    assert.ok(src.includes('isTctvStation'));
    assert.ok(src.includes('rewardBlocked'));
    assert.ok(src.includes('rewardNotify.apply'));
    assert.ok(src.includes('decision.notice'));
    assert.ok(src.includes('planWatchXp'));
    assert.ok(src.includes('weeklyXP'));
    assert.ok(src.includes('monthlyXP'));
    assert.ok(src.includes('pendingOverflow'));
    assert.ok(src.includes('lastOverflowDate'));
    assert.ok(src.includes("collection('daily_points')"));
    assert.ok(src.includes("decision.reason !== 'done' && decision.reason !== 'too-fast'"));
    const logic = read('functions/src/tctvWatch.js');
    assert.ok(logic.includes("onceKey: 'tctv_watch_' + cleanDay"));
    assert.ok(logic.includes('rewardNotify.plan'));
    assert.ok(logic.includes('planDailyXp'));
    assert.ok(logic.includes('offsetDateKey'));
    assert.ok(src.includes('runTransaction'));
    assert.ok(src.includes('orangeTickets'));
    assert.ok(src.includes('REWARD_TICKETS'));
    assert.strictEqual(src.includes('data.seconds'), false);
    assert.strictEqual(src.includes('data.elapsed'), false);
    assert.strictEqual(src.includes('data.minutes'), false);
    const fn = src.slice(src.indexOf('await db.runTransaction'), src.indexOf('module.exports'));
    const dailyGet = fn.indexOf('tx.get(dailyRef)');
    const firstSet = fn.indexOf('tx.set(');
    assert.ok(dailyGet > 0 && firstSet > dailyGet, 'daily_points is read before any write');
    const awardAt = fn.indexOf('view.awarded');
    assert.ok(awardAt > 0);
    assert.ok(fn.indexOf('weeklyXP', awardAt) > awardAt);
    assert.ok(fn.indexOf('rewardNotify.apply', awardAt) > awardAt);
    const rateSet = fn.indexOf('tx.set(rateRef');
    const skip = fn.indexOf("decision.reason !== 'done' && decision.reason !== 'too-fast'");
    assert.ok(skip > 0 && rateSet > skip);
});

test('rules block client writes to the watch ledger and economy fields', () => {
    const rules = read('firestore.rules');
    const start = rules.indexOf('match /tctv_watch/{uid}');
    const end = rules.indexOf('match /{document=**}', start);
    assert.ok(start > 0 && end > start);
    const block = rules.slice(start, end);
    assert.ok(block.includes('allow create, update, delete: if false'));
    assert.ok(block.includes('request.auth.uid == uid'));
    assert.ok(rules.includes("'points'"));
    assert.ok(rules.includes("'orangeTickets'"));
    assert.ok(rules.includes("'tctvWatchSeconds'"));
    assert.ok(rules.includes("'tctvWatchAwardedDay'"));
    assert.ok(rules.includes("'tctvWatchToastSeen'"));
    assert.ok(rules.includes('match /rate_limits/{docId}'));
    const rates = rules.slice(rules.indexOf('match /rate_limits/{docId}'), rules.indexOf('match /tctv_watch/{uid}'));
    assert.ok(rates.includes('allow read, write: if false'));
});

test('the page heartbeats only while playing and visible, and does not write the ledger', () => {
    const client = read('tctv-watch.js');
    assert.ok(client.includes('document.visibilityState'));
    assert.ok(client.includes('PlayerState.PLAYING'));
    assert.ok(client.includes("httpsCallable('tctvWatchHeartbeat')"));
    assert.ok(client.includes('60000'));
    assert.ok(client.includes('function startTctvDailyWatch'));
    assert.ok(client.includes(watch.TOAST_TEXT));
    assert.strictEqual(/tctv_watch'\)\.doc\([^)]*\)\.(set|update|delete)\(/.test(client), false);
    assert.strictEqual(client.includes('orangeTickets'), false);
    assert.ok(client.includes(".collection('tctv_watch').doc(user.uid).get()"));
    const tv = read('timechain-tv.js');
    assert.ok(tv.includes('P=window._tctvYtPlayer=new YT.Player("tctv-player"'));
    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    assert.ok(html.includes('id="tctvWatchBtn"'));
    assert.ok(html.includes('id="sayHiBtn"'));
    assert.ok(html.includes('startTctvDailyWatch()'));
    assert.ok(html.includes('#em-quick-actions { display:grid; gap:8px; grid-template-columns: repeat(6, minmax(0, 1fr)); }'));
    assert.strictEqual(html.includes('.em-quick-actions {'), false);
    assert.ok(html.includes('tctv-watch.js?v=20261022_v2301'));
    assert.ok(html.includes('id="tctvWatchSub"'));
    assert.ok(html.includes('>0/10 min</span>'));
    const watchTag = html.slice(html.indexOf('id="tctvWatchBtn"'), html.indexOf('id="tctvWatchBtn"') + 900);
    const spinTag = html.slice(html.indexOf('id="nqSpinBtn"'), html.indexOf('id="nqSpinBtn"') + 500);
    const watchStyle = watchTag.slice(watchTag.indexOf('style="'), watchTag.indexOf('">'));
    const spinStyle = spinTag.slice(spinTag.indexOf('style="'), spinTag.indexOf('">'));
    assert.strictEqual(watchStyle, spinStyle);
    assert.ok(watchTag.includes('color:var(--text-faint)'));
    assert.strictEqual(client.includes('borderColor'), false);
    assert.strictEqual(client.includes('style.color'), false);
    assert.ok(html.includes('timechain-tv.js?v=20261022_v2266'));
    assert.ok(html.includes('features.registry.js?v=20261023_v2337'));
    assert.ok(client.includes('getDailyKey'));
    assert.ok(client.includes('IntersectionObserver'));
    assert.strictEqual(client.includes('600000'), false);
    const row = html.slice(html.indexOf('id="em-quick-actions"'), html.indexOf('id="continueReading"'));
    const spin = row.indexOf('id="nqSpinBtn"');
    const watchBtn = row.indexOf('id="tctvWatchBtn"');
    const predict = row.indexOf('Predict Price');
    const story = row.indexOf("Nacho's Story");
    const hi = row.indexOf('id="sayHiBtn"');
    assert.ok(spin >= 0 && spin < watchBtn && watchBtn < predict && predict < hi && hi < story);
    const sw = read('sw.js');
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2337'"));
    assert.ok(!sw.includes('btc-archive-v2333'));
    assert.ok(!sw.includes('btc-archive-v2332'));
    assert.ok(!sw.includes('btc-archive-v2331'));
    assert.ok(!sw.includes('btc-archive-v2330'));
    assert.ok(!sw.includes('btc-archive-v2329'));
    assert.ok(!sw.includes('btc-archive-v2325'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
