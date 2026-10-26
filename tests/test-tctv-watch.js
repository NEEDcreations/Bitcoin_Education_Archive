// Daily Timechain TV watch reward.
// Heartbeats closer than 55s are not credited, two tabs share one uid
// ledger, the prize is once per server day, the toast flag flips once,
// and the reward notice uses a fixed id.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

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
    assert.strictEqual(partial.awarded, 25);
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
    assert.ok(html.includes('tctv-watch.js?v=20261023_v2340'));
    assert.ok(!html.includes('tctv-watch.js?v=20261023_v2338'));
    assert.ok(!html.includes('tctv-watch.js?v=20261022_v2301'));
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
    assert.ok(html.includes('timechain-tv.js?v=20261024_v2353'));
    assert.ok(!html.includes('timechain-tv.js?v=20261022_v2266'));
    assert.ok(html.includes('features.registry.js?v=20261024_v2368'));
    assert.ok(!html.includes('features.registry.js?v=20261024_v2361'));
    assert.ok(!html.includes('features.registry.js?v=20261024_v2357'));
    assert.ok(!html.includes('features.registry.js?v=20261024_v2355'));
    assert.ok(!html.includes('features.registry.js?v=20261024_v2350'));
    assert.ok(!html.includes('features.registry.js?v=20261023_v2342'));
    assert.ok(!html.includes('features.registry.js?v=20261023_v2341'));
    assert.ok(!html.includes('features.registry.js?v=20261023_v2339'));
    assert.ok(!html.includes('features.registry.js?v=20261023_v2330'));
    assert.ok(client.includes('getDailyKey'));
    assert.ok(client.includes('IntersectionObserver'));
    assert.ok(client.includes('function displayWatchSeconds'));
    assert.ok(client.includes('setInterval(monitor, 1000)'));
    assert.ok(client.includes('call({})'));
    assert.strictEqual(client.includes('call({ seconds'), false);
    assert.ok(html.includes('.tctv-watch-chip.is-done'));
    assert.strictEqual(client.includes('600000'), false);
    const row = html.slice(html.indexOf('id="em-quick-actions"'), html.indexOf('id="continueReading"'));
    const spin = row.indexOf('id="nqSpinBtn"');
    const watchBtn = row.indexOf('id="tctvWatchBtn"');
    const predict = row.indexOf('Predict Price');
    const story = row.indexOf("Nacho's Story");
    const hi = row.indexOf('id="sayHiBtn"');
    assert.ok(spin >= 0 && spin < watchBtn && watchBtn < predict && predict < hi && hi < story);
    const sw = read('sw.js');
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2395'"));
    assert.ok(!sw.includes('btc-archive-v2371'));
    assert.ok(!sw.includes('btc-archive-v2375'));
    assert.ok(!sw.includes('btc-archive-v2370'));    assert.ok(!sw.includes('btc-archive-v2377'));
    assert.ok(!sw.includes('btc-archive-v2376'));
    assert.ok(!sw.includes('btc-archive-v2374'));
    assert.ok(!sw.includes('btc-archive-v2373'));
    assert.ok(!sw.includes('btc-archive-v2372'));
    assert.ok(!sw.includes('btc-archive-v2371'));
    assert.ok(!sw.includes('btc-archive-v2370'));
    assert.ok(!sw.includes('btc-archive-v2369'));
    assert.ok(!sw.includes('btc-archive-v2368'));
    assert.ok(!sw.includes('btc-archive-v2367'));
    assert.ok(!sw.includes('btc-archive-v2366'));
    assert.ok(!sw.includes('btc-archive-v2365'));
    assert.ok(!sw.includes('btc-archive-v2364'));
    assert.ok(!sw.includes('btc-archive-v2363'));
    assert.ok(!sw.includes('btc-archive-v2362'));
    assert.ok(!sw.includes('btc-archive-v2361'));
    assert.ok(!sw.includes('btc-archive-v2360'));
    assert.ok(!sw.includes('btc-archive-v2359'));
    assert.ok(!sw.includes('btc-archive-v2358'));
    assert.ok(!sw.includes('btc-archive-v2357'));
    assert.ok(!sw.includes('btc-archive-v2356'));
    assert.ok(!sw.includes('btc-archive-v2355'));
    assert.ok(!sw.includes('btc-archive-v2354'));
    assert.ok(!sw.includes('btc-archive-v2353'));
    assert.ok(!sw.includes('btc-archive-v2352'));
    assert.ok(!sw.includes('btc-archive-v2351'));
    assert.ok(!sw.includes('btc-archive-v2350'));
    assert.ok(!sw.includes('btc-archive-v2349'));
    assert.ok(!sw.includes('btc-archive-v2348'));
    assert.ok(!sw.includes('btc-archive-v2347'));
    assert.ok(!sw.includes('btc-archive-v2346'));
    assert.ok(!sw.includes('btc-archive-v2345'));
    assert.ok(!sw.includes('btc-archive-v2344'));
    assert.ok(!sw.includes('btc-archive-v2343'));
    assert.ok(!sw.includes('btc-archive-v2342'));
    assert.ok(!sw.includes('btc-archive-v2340'));
    assert.ok(!sw.includes('btc-archive-v2341'));
    assert.ok(!sw.includes('btc-archive-v2339'));
    assert.ok(!sw.includes('btc-archive-v2338'));
    assert.ok(!sw.includes('btc-archive-v2334'));
    assert.ok(!sw.includes('btc-archive-v2333'));
    assert.ok(!sw.includes('btc-archive-v2332'));
    assert.ok(!sw.includes('btc-archive-v2331'));
    assert.ok(!sw.includes('btc-archive-v2330'));
    assert.ok(!sw.includes('btc-archive-v2329'));
    assert.ok(!sw.includes('btc-archive-v2325'));
});

function syncThen(value) {
    return {
        then: function (onOk, onErr) {
            try {
                const next = onOk ? onOk(value) : value;
                return syncThen(next);
            } catch (err) {
                if (onErr) return syncThen(onErr(err));
                throw err;
            }
        },
        catch: function (onErr) {
            return this.then(null, onErr);
        }
    };
}

function makeEl(id, owner) {
    const el = {
        id: id || '',
        textContent: '',
        className: '',
        style: {},
        attrs: {},
        children: [],
        parent: null,
        owner: owner,
        setAttribute: function (k, v) { this.attrs[k] = String(v); },
        getAttribute: function (k) { return this.attrs[k] || null; },
        remove: function () {
            if (this.parent) this.parent.children = this.parent.children.filter(function (c) { return c !== this; }, this);
            if (this.id && this.owner && this.owner[this.id] === this) delete this.owner[this.id];
            this.parent = null;
        },
        appendChild: function (child) {
            child.remove();
            child.parent = this;
            child.owner = this.owner;
            this.children.push(child);
            if (child.id) this.owner[child.id] = child;
        },
        querySelector: function (sel) {
            const want = sel.charAt(0) === '.' ? sel.slice(1) : sel;
            const walk = function (node) {
                const names = String(node.className || '').split(/\s+/);
                if (names.indexOf(want) !== -1) return node;
                for (let i = 0; i < node.children.length; i++) {
                    const hit = walk(node.children[i]);
                    if (hit) return hit;
                }
                return null;
            };
            return walk(this);
        }
    };
    Object.defineProperty(el, 'innerHTML', {
        set: function (html) {
            el.children = [];
            ['tctv-watch-chip-text', 'tctv-watch-chip-bar', 'tctv-watch-chip-fill'].forEach(function (name) {
                if (html.indexOf(name) === -1) return;
                const child = makeEl('', el.owner);
                child.className = name;
                el.appendChild(child);
            });
        }
    });
    return el;
}

// Loads the real page script with a stand-in YouTube player and ledger read.
function bootWatch(opts) {
    const ids = {};
    function el(id) {
        const node = makeEl(id, ids);
        if (id) ids[id] = node;
        return node;
    }
    el('tctvWatchBtn');
    el('tctvWatchEmoji');
    el('tctvWatchLabel');
    el('tctvWatchSub');
    el('tctv-video-container');
    const timers = [];
    const calls = [];
    const toasts = [];
    let painted = 0;
    let now = opts.now;
    let playerState = opts.playerState == null ? 1 : opts.playerState;
    const user = opts.user === undefined ? { uid: 'user_1', isAnonymous: false } : opts.user;
    const document = {
        readyState: 'complete',
        visibilityState: opts.visibility || 'visible',
        getElementById: function (id) { return ids[id] || null; },
        createElement: function () { return makeEl('', ids); },
        addEventListener: function (name, fn) { document.listeners[name] = fn; },
        listeners: {}
    };
    const sandbox = {
        console: console,
        document: document,
        Date: {
            now: function () { return now; },
            parse: Date.parse,
            UTC: Date.UTC
        },
        setInterval: function (fn, ms) {
            const id = timers.length + 1;
            timers.push({ id: id, fn: fn, ms: ms, cleared: false });
            return id;
        },
        clearInterval: function (id) {
            const found = timers.find(function (t) { return t.id === id; });
            if (found) found.cleared = true;
        },
        setTimeout: function (fn) { fn(); return 0; },
        clearTimeout: function () {}
    };
    sandbox.window = sandbox;
    sandbox.window.getDailyKey = function () { return opts.day || '2026-10-23'; };
    sandbox.window._tctvActive = opts.active !== false;
    sandbox.window._tctvYtPlayer = {
        getPlayerState: function () { return playerState; }
    };
    sandbox.window.YT = { PlayerState: { PLAYING: 1, PAUSED: 2, BUFFERING: 3, ENDED: 0 } };
    sandbox.window.showToast = function (text) { toasts.push(text); };
    sandbox.window._paintTodayCard = function () { painted += 1; };
    sandbox.firebase = {
        auth: function () {
            return {
                currentUser: user,
                onAuthStateChanged: function (cb) { cb(user); }
            };
        },
        firestore: function () {
            return {
                collection: function () {
                    return {
                        doc: function () {
                            return {
                                get: function () {
                                    return syncThen({
                                        exists: !!(opts.snap && opts.snap.exists !== false && opts.snap.data),
                                        data: function () { return (opts.snap && opts.snap.data) || {}; }
                                    });
                                }
                            };
                        }
                    };
                }
            };
        },
        functions: function () {
            return {
                httpsCallable: function (name) {
                    return function (payload) {
                        calls.push({ name: name, payload: payload });
                        const data = typeof opts.heartbeat === 'function' ? opts.heartbeat(calls.length) : (opts.heartbeat || { seconds: 0, done: false, reason: 'clock' });
                        return syncThen({ data: data });
                    };
                }
            };
        }
    };
    vm.createContext(sandbox);
    vm.runInContext(read('tctv-watch.js'), sandbox, { filename: 'tctv-watch.js' });
    return {
        ids: ids,
        document: document,
        calls: calls,
        toasts: toasts,
        timers: timers,
        display: sandbox.displayWatchSeconds,
        setNow: function (value) { now = value; },
        setState: function (value) { playerState = value; },
        painted: function () { return painted; },
        run: function (ms) {
            timers.filter(function (t) { return !t.cleared && t.ms === ms; }).forEach(function (t) { t.fn(); });
        },
        armed: function (ms) {
            return timers.filter(function (t) { return !t.cleared && t.ms === ms; }).length;
        }
    };
}

function bootReady(opts) {
    const page = bootWatch(opts);
    page.run(250);
    page.run(1000);
    return page;
}

test('display seconds stay inside the next server credit', () => {
    const page = bootWatch({ now: T0, snap: { data: null } });
    const show = page.display;
    assert.strictEqual(show(0, null, 30000, T0 + 30000, false), 0);
    assert.strictEqual(show(120, T0, 0, T0, false), 120);
    assert.strictEqual(show(120, T0, 30000, T0 + 30000, false), 150);
    assert.strictEqual(show(120, T0, 90000, T0 + 90000, false), 180);
    assert.strictEqual(show(120, T0, 30000, T0 + 10000, false), 130);
    assert.strictEqual(show(120, T0, 30000, T0 + watch.CLOCK_GAP_MS + 1, false), 120);
    assert.strictEqual(show(540, T0, 90000, T0 + 90000, false), 600);
    assert.strictEqual(show(120, T0, 90000, T0 + 90000, true), 600);
    assert.strictEqual(show(50, T0 + 1000, 30000, T0, false), 50);
});

test('the chip and the button tick while playing, then pause', () => {
    const page = bootReady({
        now: T0,
        snap: { data: { day: '2026-10-23', seconds: 120, lastCreditMs: T0, awardedDay: '' } }
    });
    assert.strictEqual(page.ids.tctvWatchSub.textContent, '2/10 min');
    assert.strictEqual(page.ids.tctvWatchChip.querySelector('.tctv-watch-chip-text').textContent, '📺 2/10 min');
    assert.strictEqual(page.ids.tctvWatchChip.querySelector('.tctv-watch-chip-fill').style.width, '20%');
    assert.strictEqual(page.calls.length, 0);

    page.setNow(T0 + 30000);
    page.run(1000);
    assert.strictEqual(page.ids.tctvWatchSub.textContent, '2/10 min');
    assert.strictEqual(page.ids.tctvWatchChip.querySelector('.tctv-watch-chip-fill').style.width, '25%');

    page.setNow(T0 + 60000);
    page.run(1000);
    assert.strictEqual(page.ids.tctvWatchSub.textContent, '3/10 min');
    assert.strictEqual(page.ids.tctvWatchChip.querySelector('.tctv-watch-chip-text').textContent, '📺 3/10 min');
    assert.strictEqual(page.ids.tctvWatchChip.querySelector('.tctv-watch-chip-fill').style.width, '30%');

    page.setNow(T0 + 90000);
    page.run(1000);
    assert.strictEqual(page.ids.tctvWatchSub.textContent, '3/10 min');
    assert.strictEqual(page.ids.tctvWatchChip.querySelector('.tctv-watch-chip-fill').style.width, '30%');

    page.setState(2);
    page.setNow(T0 + 120000);
    page.run(1000);
    assert.strictEqual(page.ids.tctvWatchSub.textContent, '3/10 min');
    assert.strictEqual(page.ids.tctvWatchChip.querySelector('.tctv-watch-chip-fill').style.width, '30%');
    assert.strictEqual(page.armed(60000), 0);

    page.setState(1);
    page.setNow(T0 + 121000);
    page.run(1000);
    page.document.visibilityState = 'hidden';
    page.setNow(T0 + 150000);
    page.run(1000);
    assert.strictEqual(page.ids.tctvWatchSub.textContent, '3/10 min');
    assert.strictEqual(page.calls.length, 0);
});

test('a heartbeat snaps the label back to the server total', () => {
    const page = bootReady({
        now: T0,
        snap: { data: { day: '2026-10-23', seconds: 0, lastCreditMs: T0, awardedDay: '' } },
        heartbeat: { seconds: 60, minutes: 1, done: false, reason: 'credited' }
    });
    page.setNow(T0 + 50000);
    page.run(1000);
    assert.strictEqual(page.ids.tctvWatchSub.textContent, '0/10 min');
    assert.strictEqual(page.ids.tctvWatchChip.querySelector('.tctv-watch-chip-fill').style.width, '8%');
    page.run(60000);
    assert.strictEqual(page.calls.length, 1);
    assert.strictEqual(page.calls[0].name, 'tctvWatchHeartbeat');
    assert.strictEqual(JSON.stringify(page.calls[0].payload), '{}');
    assert.strictEqual(page.ids.tctvWatchSub.textContent, '1/10 min');
    assert.strictEqual(page.ids.tctvWatchChip.querySelector('.tctv-watch-chip-fill').style.width, '10%');
});

test('reaching the server goal shows done and keeps the chip', () => {
    const page = bootReady({
        now: T0,
        snap: { data: { day: '2026-10-23', seconds: 600, lastCreditMs: T0, awardedDay: '2026-10-23' } },
        heartbeat: {
            seconds: 600,
            done: true,
            reason: 'done',
            showToast: true,
            toast: watch.TOAST_TEXT
        }
    });
    const chip = page.ids.tctvWatchChip;
    assert.ok(chip);
    assert.strictEqual(page.ids.tctvWatchSub.textContent, 'Done ✓');
    assert.strictEqual(chip.querySelector('.tctv-watch-chip-text').textContent, 'Done ✓');
    assert.strictEqual(chip.querySelector('.tctv-watch-chip-fill').style.width, '100%');
    assert.ok(chip.className.indexOf('is-done') !== -1);
    assert.strictEqual(page.painted() > 0, true);
    page.setNow(T0 + 20000);
    page.run(1000);
    assert.strictEqual(page.ids.tctvWatchSub.textContent, 'Done ✓');
    assert.strictEqual(page.calls.length, 0);
    assert.strictEqual(page.ids.tctvWatchBtn.getAttribute('aria-label'), 'Watch Timechain TV, done for today');
});

test('a signed-out viewer does not get a ticking chip', () => {
    const page = bootReady({
        now: T0,
        user: null,
        snap: { data: { day: '2026-10-23', seconds: 120, lastCreditMs: T0 } }
    });
    assert.strictEqual(page.ids.tctvWatchChip, undefined);
    assert.strictEqual(page.ids.tctvWatchSub.textContent, '0/10 min');
    assert.strictEqual(page.calls.length, 0);
});

test('playback with no server clock asks the server to start it and does not invent minutes', () => {
    const page = bootReady({
        now: T0,
        snap: { data: { day: '2026-10-23', seconds: 40, awardedDay: '' } },
        heartbeat: { seconds: 40, done: false, reason: 'clock' }
    });
    assert.strictEqual(page.calls.length, 1);
    assert.strictEqual(JSON.stringify(page.calls[0].payload), '{}');
    assert.strictEqual(page.ids.tctvWatchSub.textContent, '0/10 min');
    page.setNow(T0 + 5000);
    page.run(1000);
    assert.strictEqual(page.ids.tctvWatchSub.textContent, '0/10 min');
    assert.strictEqual(page.ids.tctvWatchChip.querySelector('.tctv-watch-chip-fill').style.width, '8%');
    page.setState(0);
    page.run(1000);
    const sent = page.calls.length;
    const width = page.ids.tctvWatchChip.querySelector('.tctv-watch-chip-fill').style.width;
    page.setNow(T0 + 20000);
    page.run(1000);
    assert.strictEqual(page.calls.length, sent);
    assert.strictEqual(page.ids.tctvWatchChip.querySelector('.tctv-watch-chip-fill').style.width, width);
    assert.strictEqual(width, '8%');
});

test('patch notes keep one Latest line for shared cipher rewards', () => {
    const notes = read('patch-notes.html');
    const latest = 'Latest: XP awards now require server-checked evidence, and profile saves only allow known non-reward fields.';    const previousLatest = 'Nacho now announces in global chat when Satoshi\'s Favor goes live, every badge you earn shows in GGs chat, and GGs and global chat now appear in our Telegram group.';
    const gifts = 'Opening gifts is faster, every button responds right away, and your prize shows the moment a gift opens.';
    assert.ok(notes.includes(gifts));
    assert.ok(!notes.includes('Latest: Opening gifts'));
    const invite = 'The Invite button now stays on the home screen as a small pill, so you can always invite a friend.';
    assert.ok(notes.includes(invite));
    assert.ok(!notes.includes('Latest: The Invite button'));
    const favorLive = 'Nacho now announces in global chat when Satoshi\'s Favor goes live, every badge you earn shows in GGs chat, and GGs and global chat now appear in our Telegram group.';
    const topics = 'On a computer, Browse topics opens a full-screen browser of every topic, grouped like the sidebar, with live title search and the same completed, locked, and new marks.';
    assert.ok(notes.includes(topics));
    assert.ok(!notes.includes('Latest: On a computer'));
    const tools = 'A More tools button beside chat opens AI Tools, Metrics, and Leaderboard, and those three apps are in the desktop Explore Apps grid too.';
    assert.ok(notes.includes(tools));
    assert.ok(!notes.includes('Latest: A More tools button'));
    const xpBar = 'The daily XP bar now labels the full, half and quarter rate sections underneath so it is clear how much XP each part pays.';
    assert.ok(notes.includes(xpBar));
    assert.ok(!notes.includes('Latest: The daily XP bar'));
    const trivia = 'Trivia and poll community totals now update the moment you answer and stay live while the results are open.';
    assert.ok(notes.includes(trivia));
    assert.ok(!notes.includes('Latest: Trivia'));
    const usernames = 'Usernames can no longer contain spaces, so an existing name with a space is ready to become an underscore name, and that account gets one free change in Settings.';
    assert.ok(notes.includes(usernames));
    assert.ok(!notes.includes('Latest: Usernames'));
    assert.ok(notes.includes('Nacho now announces in global chat when Satoshi\'s Favor goes live, every badge you earn shows in GGs chat, and GGs and global chat now appear in our Telegram group.'));
    assert.ok(!notes.includes('Latest: Nacho now announces'));
    const favor = 'Satoshi\'s Favor now explains that unclaimed points come from players without a faction, and shows them a button to pick one.';
    const deleted = 'You can delete your account from Settings → Account after confirming your username, and you can change the email on an email sign-in.';
    const share = 'The share card says Let me teach you about Bitcoin, and the daily earn line and the sats stat both show 200.';
    const anchors = 'Topic conversation links open the paragraph they started from, highlight it, and leave the thread ready to reply.';
    const music = 'Timechain TV Music drops off-topic tracks, moves interviews and events onto the stations they belong on, and adds freedom and Bitcoin songs.';
    const repick = 'If your username was cleared, pick a new one from the prompt, and Satoshi\'s Favor shows your public name instead of Anonymous.';
    const flex = 'Flex XP syncs on tap again, and Say hi shows a green dot after you say hi.';
    const live = 'Nacho answers live Bitcoin questions with the number, the source, and the time, plus topic links and follow-up questions.';
    const google = 'Google sign-in stays on this page and works on Android with the app installed.';
    const guest = 'Google sign-in now works when you already have an account and were browsing as a guest.';
    const timer = 'The TCTV 0/10 minute timer now counts up live while you watch, and shows Done ✓ at 10.';
    const taper = 'Daily XP is full through 500, half through 900, then a quarter until 1,000. Each tier rounds down. Extra XP is not saved.';
    assert.strictEqual((notes.match(/Latest:/g) || []).length, 1);
    assert.ok(notes.includes(latest));
    assert.ok(notes.includes(previousLatest));
    assert.ok(!notes.includes('Latest: ' + previousLatest));
    assert.ok(notes.includes(favor));
    assert.ok(!notes.includes('Latest: Satoshi\'s Favor'));
    assert.ok(!notes.includes('Latest: Satoshi'));
    assert.ok(notes.includes(favorLive));
    assert.ok(!notes.includes('Latest: ' + favorLive));
    const moreTools = 'A More tools button beside chat opens AI Tools, Metrics, and Leaderboard, and those three apps are in the desktop Explore Apps grid too.';
    assert.ok(notes.includes(moreTools));
    assert.ok(!notes.includes('Latest: ' + moreTools));
    assert.ok(notes.includes('On a computer, Browse topics opens a full-screen browser of every topic, grouped like the sidebar, with live title search and the same completed, locked, and new marks.'));
    assert.ok(!notes.includes('Latest: On a computer, Browse topics opens a full-screen browser of every topic, grouped like the sidebar, with live title search and the same completed, locked, and new marks.'));
    assert.ok(notes.includes(deleted));
    assert.ok(!notes.includes('Latest: You can delete your account'));
    assert.ok(notes.includes(favor));
    assert.ok(!notes.includes('Latest: Satoshi\'s Favor'));
    assert.ok(notes.includes(anchors));
    assert.ok(!notes.includes('Latest: Topic conversation links'));
    assert.ok(notes.includes(share));
    assert.ok(notes.includes(anchors));
    assert.ok(!notes.includes('Latest: Topic conversation'));
    assert.ok(!notes.includes('Latest: The share card'));
    assert.ok(notes.includes('Key and cipher help now says that when an accepted peer opens a matching cipher with a key you sent, you both get the same prize and you see a reveal of what you won.'));
    assert.ok(!notes.includes('Latest: Key and cipher help'));
    assert.ok(notes.includes('When you send a key and a peer opens a matching cipher with it, you both win the same prize.'));
    assert.ok(!notes.includes('Latest: When you send a key'));
    assert.ok(notes.includes(music));
    assert.ok(!notes.includes('Latest: Timechain TV Music'));
    assert.ok(notes.includes(repick));
    assert.ok(!notes.includes('Latest: If your username'));
    assert.ok(notes.includes(flex));
    assert.ok(notes.includes('If your username was cleared, pick a new one from the prompt, and Satoshi\'s Favor shows your public name instead of Anonymous.'));
    assert.ok(!notes.includes('Latest: If your username'));
    assert.ok(!notes.includes('Latest: Flex XP'));
    assert.ok(notes.includes('Nacho answers from a large vetted Bitcoin knowledge base, with follow-ups he can answer and a steer back to Bitcoin.'));
    assert.ok(!notes.includes('Latest: Nacho answers from'));
    assert.ok(notes.includes(live));
    assert.ok(!notes.includes('Latest: Nacho answers live'));
    assert.ok(notes.includes(guest));
    assert.ok(notes.includes(google));
    assert.ok(notes.includes('Topic conversations earn XP, a new one is also posted on Pleb Talk, and replies stay mirrored.'));
    assert.ok(!notes.includes('Latest: Topic conversations'));
    assert.ok(notes.includes('Topic pages include a Start a conversation button between the paragraphs, and each discussion post shows its date and time.'));
    assert.ok(!notes.includes('Latest: Topic pages include'));
    assert.ok(notes.includes("On a phone, the chat, Nacho, stats, and trophy buttons sit above the bottom navigation with space from the screen edge, and Nacho's speech bubble sits fully above that row."));
    assert.ok(!notes.includes('Latest: On a phone'));
    assert.ok(notes.includes('New badges cover gifts, keys, ciphers, Nook, raffles, and setup.'));
    assert.ok(!notes.includes('Latest: New badges'));
    assert.ok(!notes.includes('Latest: Google sign-in'));
    assert.ok(notes.includes(timer));
    assert.ok(!notes.includes('Latest: The TCTV'));
    assert.ok(notes.includes(taper));
    assert.ok(!notes.includes('Latest: Daily XP'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
