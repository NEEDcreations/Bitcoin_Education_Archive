#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const store = {};
const increments = [];

function loadAds(opts) {
    opts = opts || {};
    increments.length = 0;
    const sandbox = {
        console,
        Date,
        Math,
        Intl,
        Uint8Array,
        Number,
        String,
        Boolean,
        Array,
        Object,
        JSON,
        Promise,
        isFinite,
        module: { exports: {} },
        exports: {},
        BQ_ADS_NO_BOOT: true,
        BQ_ADS_HOLDOUT_PCT: opts.holdoutPct,
        localStorage: {
            getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
            setItem: function (k, v) { store[k] = String(v); },
            removeItem: function (k) { delete store[k]; },
            clear: function () { Object.keys(store).forEach(function (k) { delete store[k]; }); }
        },
        firebase: {
            firestore: function () {
                return {
                    collection: function (name) {
                        return {
                            doc: function (id) {
                                return {
                                    set: function (data, maybe) {
                                        increments.push({ collection: name, id: id, data: data, merge: !!(maybe && maybe.merge) });
                                        return Promise.resolve();
                                    }
                                };
                            }
                        };
                    }
                };
            }
        },
        currentUser: opts.user || null,
        currentPage: opts.page || 'home',
        location: { pathname: opts.path || '/' },
        document: undefined,
        window: undefined
    };
    sandbox.firebase.firestore.FieldValue = {
        increment: function (n) { return { _inc: n }; }
    };
    sandbox.global = sandbox;
    sandbox.root = sandbox;
    sandbox.window = sandbox;
    Object.keys(store).forEach(function (k) { /* keep store */ });
    if (opts.clearStore) Object.keys(store).forEach(function (k) { delete store[k]; });
    const code = fs.readFileSync(path.join(root, 'ads.js'), 'utf8');
    vm.runInNewContext(code, sandbox, { filename: 'ads.js' });
    return sandbox.bqAds || sandbox.module.exports;
}

let passed = 0, failed = 0;
function test(name, fn) {
    try {
        Object.keys(store).forEach(function (k) { delete store[k]; });
        increments.length = 0;
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e));
        failed++;
    }
}

test('default holdout percentage is one config value at 20', function () {
    const ads = loadAds();
    assert.strictEqual(ads.HOLDOUT_PCT, 20);
    assert.strictEqual(ads.holdoutPct(), 20);
});

test('holdout percentage can be overridden from one config hook', function () {
    const ads = loadAds({ holdoutPct: 10 });
    assert.strictEqual(ads.holdoutPct(), 10);
    assert.strictEqual(ads.HOLDOUT_PCT, 20);
});

test('holdout assignment is stable for the same user', function () {
    const ads = loadAds();
    const a = ads.inHoldout('user-stable-1', 10);
    const b = ads.inHoldout('user-stable-1', 10);
    const c = ads.inHoldout('user-stable-1', 10);
    assert.strictEqual(a, b);
    assert.strictEqual(b, c);
    assert.strictEqual(ads.bucket('user-stable-1'), ads.bucket('user-stable-1'));
});

test('holdout assignment is stable for the same device id', function () {
    const ads = loadAds();
    store['bq_ads_device'] = 'abcdef0123456789abcdef0123456789';
    const id = ads.deviceId();
    assert.strictEqual(id, 'abcdef0123456789abcdef0123456789');
    assert.strictEqual(ads.inHoldout('dev:' + id, 10), ads.inHoldout('dev:' + id, 10));
});

test('a 10% holdout buckets roughly one in ten ids', function () {
    const ads = loadAds();
    let held = 0;
    for (let i = 0; i < 2000; i++) {
        if (ads.inHoldout('uid-' + i, 10)) held++;
    }
    const rate = held / 2000;
    assert.ok(rate > 0.06 && rate < 0.14, 'got ' + rate);
});

test('the default 20% holdout buckets roughly one in five ids', function () {
    const ads = loadAds();
    let held = 0;
    for (let i = 0; i < 2000; i++) {
        if (ads.inHoldout('uid-' + i)) held++;
    }
    const rate = held / 2000;
    assert.ok(rate > 0.15 && rate < 0.25, 'got ' + rate);
});

test('changing the config value changes the cutoff, not the hash', function () {
    const ads = loadAds();
    const id = 'uid-reconfig-check';
    const bucket = ads.bucket(id);
    assert.strictEqual(ads.inHoldout(id, 0), false);
    assert.strictEqual(ads.inHoldout(id, 100), true);
    assert.strictEqual(ads.inHoldout(id, bucket), false);
    assert.strictEqual(ads.inHoldout(id, bucket + 1), true);
});

test('Kids, Classroom, and Premium accounts never see ads', function () {
    const ads = loadAds();
    const home = { surface: 'home', path: '/' };
    assert.strictEqual(ads.shouldShowAds(Object.assign({ user: { uid: 'p', premium: { active: true } } }, home)), false);
    assert.strictEqual(ads.decide(Object.assign({ user: { uid: 'p', premium: { active: true } } }, home)).reason, 'premium');
    assert.strictEqual(ads.shouldShowAds(Object.assign({ user: { uid: 'k', kids: true } }, home)), false);
    assert.strictEqual(ads.decide(Object.assign({ user: { uid: 'k', accountType: 'kids' } }, home)).reason, 'kids');
    assert.strictEqual(ads.shouldShowAds(Object.assign({ user: { uid: 'c', classroom: true } }, home)), false);
    assert.strictEqual(ads.decide(Object.assign({ user: { uid: 'c', planType: 'classroom' } }, home)).reason, 'classroom');
    assert.strictEqual(ads.decide(Object.assign({ user: { uid: 'p', premium: { active: true } } }, home)).experimentGroup, null);
});

test('HARD RULE: Timechain TV never gets ads, even for eligible users', function () {
    const ads = loadAds();
    const user = { uid: 'eligible-not-holdout-please' };
    // Find a user that is NOT in the default holdout so surface is the only gate.
    let uid = 'eligible-0';
    for (let i = 0; i < 200; i++) {
        if (!ads.inHoldout('u' + i)) { uid = 'u' + i; break; }
    }
    const d = ads.decide({ user: { uid: uid, over18: true }, surface: 'timechain-tv', path: '/timechain-tv' });
    assert.strictEqual(d.show, false);
    assert.strictEqual(d.reason, 'tctv');
    assert.strictEqual(d.experimentGroup, null);
    assert.strictEqual(ads.shouldShowAds({ user: { uid: uid, over18: true }, path: '/tv', tctvActive: true }), false);
});

test('ads are allowed only on homepage, Learn, and arcade for eligible users', function () {
    const ads = loadAds();
    let uid = 'ok';
    for (let i = 0; i < 400; i++) {
        if (!ads.inHoldout('ok' + i)) { uid = 'ok' + i; break; }
    }
    const user = { uid: uid, over18: true };
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'home', path: '/' }), true);
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'learning-quests' }), true);
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'proof-of-play' }), true);
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'arcade' }), true);
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'forum' }), false);
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'marketplace' }), false);
    assert.strictEqual(ads.decide({ user: user, surface: 'forum' }).experimentGroup, 'ads');
});

test('A-ADS iframe uses https acceptable.a-ads.com, unit 2463147, and no z-index 99998', function () {
    const ads = loadAds();
    const html = ads.aadsIframeHtml();
    assert.ok(html.indexOf('https://acceptable.a-ads.com/2463147') === 0 || html.indexOf('src="https://acceptable.a-ads.com/2463147') >= 0);
    assert.ok(html.indexOf('data-aa="2463147"') >= 0);
    assert.ok(!html.includes('//acceptable.a-ads.com') || html.includes('https://acceptable.a-ads.com'));
    assert.ok(!/src=["']\/\//.test(html), 'protocol-relative src is not allowed');
    assert.ok(!html.includes('99998'));
    assert.ok(!html.includes('99999'));
    const src = fs.readFileSync(path.join(root, 'ads.js'), 'utf8');
    assert.ok(!/z-index\s*:\s*9999\d/.test(src), 'ads.js must not set a 9999x z-index');
    assert.ok(!/z-index\s*:\s*9999\d/.test(html));
});

test('aggregate recorder writes only holdout vs ads counts, never a user or device id', function () {
    const ads = loadAds();
    let uid = 'agg-user';
    for (let i = 0; i < 400; i++) {
        if (!ads.inHoldout('agg' + i)) { uid = 'agg' + i; break; }
    }
    const now = new Date('2026-11-25T18:00:00-05:00');
    const decision = ads.decide({ user: { uid: uid, over18: true }, surface: 'home' });
    assert.strictEqual(decision.experimentGroup, 'ads');
    const out = ads.recordDailyAggregate(decision, now);
    assert.strictEqual(out.recorded, true);
    assert.strictEqual(out.group, 'ads');
    assert.strictEqual(out.day, '2026-11-25');
    assert.ok(increments.length >= 1);
    increments.forEach(function (inc) {
        assert.strictEqual(inc.collection, 'ads_holdout_stats');
        assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(inc.id));
        const keys = Object.keys(inc.data);
        keys.forEach(function (k) {
            assert.ok(['holdoutDau', 'adsDau', 'holdoutReturned', 'adsReturned'].indexOf(k) >= 0, 'unexpected field ' + k);
        });
        const blob = JSON.stringify(inc);
        assert.ok(blob.indexOf(uid) < 0, 'uid leaked into aggregate write');
        assert.ok(blob.indexOf('assignmentId') < 0);
        assert.ok(!/"uid"/.test(blob));
    });
    const again = ads.recordDailyAggregate(decision, now);
    assert.strictEqual(again.recorded, false);
});

test('next-day return increments the previous day cohort across all daily actives', function () {
    const ads = loadAds();
    let uid = 'ret-user';
    for (let i = 0; i < 400; i++) {
        if (ads.inHoldout('ret' + i)) { uid = 'ret' + i; break; }
    }
    const day1 = new Date('2026-11-25T12:00:00-05:00');
    const day2 = new Date('2026-11-26T09:00:00-05:00');
    const d1 = ads.decide({ user: { uid: uid, over18: true }, surface: 'forum' });
    assert.strictEqual(d1.experimentGroup, 'holdout');
    ads.recordDailyAggregate(d1, day1);
    const firstFields = increments.map(function (i) { return Object.keys(i.data)[0]; });
    assert.ok(firstFields.indexOf('holdoutDau') >= 0);
    increments.length = 0;
    const d2 = ads.decide({ user: { uid: uid, over18: true }, surface: 'home' });
    const out = ads.recordDailyAggregate(d2, day2);
    assert.strictEqual(out.returned, true);
    const fields = increments.map(function (i) { return Object.keys(i.data)[0] + '@' + i.id; });
    assert.ok(fields.indexOf('holdoutDau@2026-11-26') >= 0, 'expected today DAU, got ' + fields);
    assert.ok(fields.indexOf('holdoutReturned@2026-11-25') >= 0, 'expected yesterday return, got ' + fields);
    increments.forEach(function (inc) {
        assert.ok(JSON.stringify(inc).indexOf(uid) < 0);
    });
});

test('premium/kids/classroom daily actives are not written into the experiment aggregates', function () {
    const ads = loadAds();
    const now = new Date('2026-11-25T18:00:00-05:00');
    const out = ads.recordDailyAggregate(
        ads.decide({ user: { uid: 'prem', premium: { active: true } }, surface: 'home' }),
        now
    );
    assert.strictEqual(out.recorded, false);
    assert.strictEqual(out.group, null);
    assert.strictEqual(increments.length, 0);
});

test('AdSense client, ads.txt, and CSP allow the required hosts', function () {
    const ads = loadAds();
    assert.strictEqual(ads.ADSENSE_CLIENT, 'ca-pub-7244515226002177');
    const adsTxt = fs.readFileSync(path.join(root, 'ads.txt'), 'utf8');
    assert.ok(adsTxt.indexOf('google.com, pub-7244515226002177, DIRECT, f08c47fec0942fa0') >= 0);

    const worker = fs.readFileSync(path.join(root, 'workers/seo-router/worker.js'), 'utf8');
    const frame = worker.slice(worker.indexOf('frame-src'), worker.indexOf('font-src'));
    assert.ok(frame.indexOf('https://acceptable.a-ads.com') >= 0, 'worker frame-src missing acceptable.a-ads.com');
    assert.ok(worker.indexOf('https://pagead2.googlesyndication.com') >= 0);
    assert.ok(worker.indexOf('https://googleads.g.doubleclick.net') >= 0);

    const firebase = fs.readFileSync(path.join(root, 'firebase.json'), 'utf8');
    assert.ok((firebase.match(/https:\/\/acceptable\.a-ads\.com/g) || []).length >= 2, 'both hosting CSPs need a-ads');
    assert.ok(firebase.indexOf('https://pagead2.googlesyndication.com') >= 0);

    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    assert.ok(rules.indexOf('match /ads_holdout_stats/{day}') >= 0);
    assert.ok(rules.indexOf('holdoutDau') >= 0);
    assert.ok(rules.indexOf('adsReturned') >= 0);
});

test('index.html and 404.html include ads.js, the homepage slot, and the AdSense account meta, and stay identical', function () {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const html404 = fs.readFileSync(path.join(root, '404.html'), 'utf8');
    assert.strictEqual(html, html404, '404.html must match index.html');
    assert.ok(html.includes('src="/ads.js?v=20261126_v2705"'));
    assert.ok(html.includes('defer') && html.includes('ads.js'));
    assert.ok(html.includes('id="bqAadsHome"'));
    assert.ok(html.includes('name="google-adsense-account"'));
    assert.ok(html.includes('ca-pub-7244515226002177'));
    assert.ok(!html.includes('z-index: 99998'));
    assert.ok(!html.includes("z-index:99998"));
});


test('Kids accounts match isMinor, under13, and ageBand fields used by premium checkout', function () {
    const ads = loadAds();
    const home = { surface: 'home', path: '/' };
    assert.strictEqual(ads.isKidsAccount({ uid: 'a', isMinor: true }), true);
    assert.strictEqual(ads.isKidsAccount({ uid: 'b', under13: true }), true);
    assert.strictEqual(ads.isKidsAccount({ uid: 'c', ageBand: 'under13' }), true);
    assert.strictEqual(ads.isKidsAccount({ uid: 'd', ageBand: 'minor' }), true);
    assert.strictEqual(ads.shouldShowAds(Object.assign({ user: { uid: 'a', isMinor: true } }, home)), false);
    assert.strictEqual(ads.decide(Object.assign({ user: { uid: 'c', ageBand: 'under13' } }, home)).reason, 'kids');
    assert.strictEqual(ads.decide(Object.assign({ user: { uid: 'd', ageBand: 'minor' } }, home)).experimentGroup, null);
});

test('Classroom and Family plans match premium.plan family_monthly and family_months', function () {
    const ads = loadAds();
    const home = { surface: 'home', path: '/' };
    assert.strictEqual(ads.isClassroomAccount({ uid: 'f', premium: { plan: 'family_monthly' } }), true);
    assert.strictEqual(ads.isFamilyOrClassroomPlan({ uid: 'f', premium: { plan: 'family_months' } }), true);
    assert.strictEqual(ads.isFamilyOrClassroomPlan({ uid: 'f', premium: { family: true } }), true);
    assert.strictEqual(ads.shouldShowAds(Object.assign({ user: { uid: 'f', premium: { plan: 'family_monthly' } } }, home)), false);
    assert.strictEqual(ads.decide(Object.assign({ user: { uid: 'f', premium: { plan: 'family_months' } } }, home)).reason, 'classroom');
    assert.strictEqual(ads.decide(Object.assign({ user: { uid: 'f', premium: { family: true } } }, home)).experimentGroup, null);
});

test('Kids section and topic pages are never an ad surface', function () {
    const ads = loadAds();
    let uid = 'ok';
    for (let i = 0; i < 400; i++) {
        if (!ads.inHoldout('ks' + i)) { uid = 'ks' + i; break; }
    }
    const user = { uid: uid, over18: true };
    assert.strictEqual(ads.isKidsSurface({ surface: 'marketplace', category: 'kids' }), true);
    assert.strictEqual(ads.isKidsSurface({ surface: 'timechain-tv', channel: 'kids-family' }), true);
    assert.strictEqual(ads.isKidsSurface({ path: '/marketplace', hash: '#category=kids' }), true);
    assert.strictEqual(ads.isKidsSurface({ surface: 'home', path: '/' }), false);
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'marketplace', category: 'kids', path: '/marketplace' }), false);
    assert.strictEqual(ads.decide({ user: user, surface: 'marketplace', category: 'kids' }).reason, 'kids-surface');
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'learning-quests', topic: 'kids-family' }), false);
});

test('decide defaults to no ads while the user is unknown and does not record a cohort', function () {
    const ads = loadAds();
    const d = ads.decide({ userUnknown: true, surface: 'home', path: '/' });
    assert.strictEqual(d.show, false);
    assert.strictEqual(d.reason, 'unknown');
    assert.strictEqual(d.experimentGroup, null);
    assert.strictEqual(ads.shouldShowAds({ userUnknown: true, surface: 'home' }), false);
    const knownGuest = ads.decide({ user: null, surface: 'home', path: '/' });
    assert.notStrictEqual(knownGuest.reason, 'unknown');
    assert.strictEqual(knownGuest.show, false);
    assert.strictEqual(knownGuest.reason, 'guest');
    assert.strictEqual(knownGuest.experimentGroup, null);
});

test('A-ADS iframe is sandboxed without top navigation and sends no referrer', function () {
    const ads = loadAds();
    const html = ads.aadsIframeHtml();
    assert.ok(html.indexOf('sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"') >= 0);
    assert.ok(html.indexOf('referrerpolicy="no-referrer"') >= 0);
    assert.ok(html.indexOf('allow-top-navigation') < 0);
});

test('claim, withdraw, wallet, login, and admin are not ad surfaces', function () {
    const ads = loadAds();
    let uid = 'ok';
    for (let i = 0; i < 400; i++) {
        if (!ads.inHoldout('sens' + i)) { uid = 'sens' + i; break; }
    }
    const user = { uid: uid, over18: true };
    ['claim', 'withdraw', 'wallet', 'nwc', 'login', 'admin'].forEach(function (surface) {
        assert.strictEqual(ads.isSensitiveSurface({ surface: surface }), true, surface);
        assert.strictEqual(ads.shouldShowAds({ user: user, surface: surface }), false, surface);
        assert.strictEqual(ads.adsenseAllowed(ads.decide({ user: user, surface: surface }), { user: user, surface: surface }), false, surface);
    });
});

test('holdout rules text limits writable days to a today/yesterday window', function () {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    assert.ok(rules.indexOf('function adsHoldoutDayOk') >= 0);
    assert.ok(rules.indexOf('adsHoldoutDayOk(day)') >= 0);
    assert.ok(rules.indexOf("duration.value(1, 'd')") >= 0);
    assert.ok(rules.indexOf("duration.value(2, 'd')") >= 0);
});


function findEligibleUid(ads, prefix) {
    let uid = prefix + '0';
    for (let i = 0; i < 800; i++) {
        if (!ads.inHoldout(prefix + i)) { uid = prefix + i; break; }
    }
    return uid;
}

function findEligibleDevice(ads) {
    for (let i = 0; i < 800; i++) {
        const id = ('0000000000000000' + i.toString(16)).slice(-16);
        if (!ads.inHoldout('dev:' + id)) return id;
    }
    return 'abcdef0123456789';
}

test('guests and signed-out users get no ads at all, including A-ADS', function () {
    const ads = loadAds();
    store['bq_ads_device'] = findEligibleDevice(ads);
    const guests = [
        { user: null },
        { user: { uid: 'anon', isAnonymous: true } },
        { user: {} }
    ];
    guests.forEach(function (guest) {
        ['home', 'learning-quests', 'proof-of-play', 'arcade'].forEach(function (surface) {
            const input = Object.assign({ surface: surface, path: surface === 'home' ? '/' : undefined }, guest);
            const d = ads.decide(input);
            assert.strictEqual(d.show, false, JSON.stringify(guest) + ' ' + surface);
            assert.strictEqual(d.reason, 'guest', JSON.stringify(guest) + ' ' + surface);
            assert.strictEqual(d.experimentGroup, null);
            assert.strictEqual(ads.adsenseAllowed(d, input), false);
        });
        assert.strictEqual(ads.hasKnownAdultAge(guest.user), false);
        assert.strictEqual(ads.isGuestUser(guest.user), true);
    });
    const now = new Date('2026-11-25T18:00:00-05:00');
    const out = ads.recordDailyAggregate(ads.decide({ user: null, surface: 'home', path: '/' }), now);
    assert.strictEqual(out.recorded, false);
    assert.strictEqual(out.group, null);
    assert.strictEqual(increments.length, 0);
});

test('signed-in users with no age fields get no ads at all, including A-ADS', function () {
    const ads = loadAds();
    const uid = findEligibleUid(ads, 'noage');
    const user = { uid: uid };
    assert.strictEqual(ads.hasKnownAdultAge(user), false);
    assert.strictEqual(ads.isGuestUser(user), false);
    ['home', 'learning-quests', 'proof-of-play', 'arcade'].forEach(function (surface) {
        const input = { user: user, surface: surface, path: surface === 'home' ? '/' : undefined };
        const d = ads.decide(input);
        assert.strictEqual(d.show, false, surface);
        assert.strictEqual(d.reason, 'age', surface);
        assert.strictEqual(d.experimentGroup, null);
        assert.strictEqual(ads.adsenseAllowed(d, input), false);
    });
    const now = new Date('2026-11-25T18:00:00-05:00');
    const out = ads.recordDailyAggregate(ads.decide({ user: user, surface: 'home', path: '/' }), now);
    assert.strictEqual(out.recorded, false);
    assert.strictEqual(out.group, null);
    assert.strictEqual(increments.length, 0);
});

test('over18 users get A-ADS on the homepage and AdSense on Learn and PoP', function () {
    const ads = loadAds();
    const uid = findEligibleUid(ads, 'adult');
    const adults = [
        { uid: uid, over18: true },
        { uid: uid, over18: true, ageUnder18: false, ageConfirmBlocked: false }
    ];
    adults.forEach(function (user) {
        assert.strictEqual(ads.hasKnownAdultAge(user), true, JSON.stringify(user));
        assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'home', path: '/' }), true);
        assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'learning-quests' }), true);
        assert.strictEqual(ads.adsenseAllowed(ads.decide({ user: user, surface: 'learning-quests' }), { user: user, surface: 'learning-quests' }), true);
        assert.strictEqual(ads.adsenseAllowed(ads.decide({ user: user, surface: 'proof-of-play' }), { user: user, surface: 'proof-of-play' }), true);
        assert.strictEqual(ads.adsenseAllowed(ads.decide({ user: user, surface: 'arcade' }), { user: user, surface: 'arcade' }), true);
        // Homepage stays A-ADS even for adults.
        assert.strictEqual(ads.adsenseAllowed(ads.decide({ user: user, surface: 'home', path: '/' }), { user: user, surface: 'home' }), false);
    });
    // Only over18 on the user doc counts. Other age-looking fields do not.
    [{ uid: uid, ageBand: 'adult' }, { uid: uid, ageBand: 'over18' }, { uid: uid, age: 18 }, { uid: uid, isAdult: true }, { uid: uid, ageConfirmed18: true }].forEach(function (u) {
        assert.strictEqual(ads.hasKnownAdultAge(u), false, JSON.stringify(u));
        assert.strictEqual(ads.shouldShowAds({ user: u, surface: 'home', path: '/' }), false, JSON.stringify(u));
    });
    const under = { uid: uid, age: 17 };
    assert.strictEqual(ads.hasKnownAdultAge(under), false);
    assert.strictEqual(ads.shouldShowAds({ user: under, surface: 'home', path: '/' }), false);
    assert.strictEqual(ads.shouldShowAds({ user: under, surface: 'learning-quests' }), false);
    assert.strictEqual(ads.decide({ user: under, surface: 'learning-quests' }).reason, 'age');
    assert.strictEqual(ads.adsenseAllowed(ads.decide({ user: under, surface: 'learning-quests' }), { user: under, surface: 'learning-quests' }), false);
});

test('ageUnder18 on the user doc gives no ads, even with over18', function () {
    const ads = loadAds();
    const uid = findEligibleUid(ads, 'u18');
    const user = { uid: uid, over18: true, ageUnder18: true };
    assert.strictEqual(ads.hasKnownAdultAge(user), false);
    ['home', 'learning-quests', 'proof-of-play', 'arcade'].forEach(function (surface) {
        const input = { user: user, surface: surface, path: surface === 'home' ? '/' : undefined };
        const d = ads.decide(input);
        assert.strictEqual(d.show, false, surface);
        assert.strictEqual(d.reason, 'age', surface);
        assert.strictEqual(ads.adsenseAllowed(d, input), false, surface);
    });
});

test('ageConfirmBlocked (admin un-confirm) gives no ads, even with over18', function () {
    const ads = loadAds();
    const uid = findEligibleUid(ads, 'blk');
    const user = { uid: uid, over18: true, ageConfirmBlocked: true };
    assert.strictEqual(ads.hasKnownAdultAge(user), false);
    ['home', 'learning-quests', 'proof-of-play', 'arcade'].forEach(function (surface) {
        const input = { user: user, surface: surface, path: surface === 'home' ? '/' : undefined };
        const d = ads.decide(input);
        assert.strictEqual(d.show, false, surface);
        assert.strictEqual(d.reason, 'age', surface);
        assert.strictEqual(ads.adsenseAllowed(d, input), false, surface);
    });
});

test('kids accounts with over18 still get no ads', function () {
    const ads = loadAds();
    const user = { uid: findEligibleUid(ads, 'kid18'), over18: true, isMinor: true };
    assert.strictEqual(ads.hasKnownAdultAge(user), false);
    assert.strictEqual(ads.decide({ user: user, surface: 'home', path: '/' }).reason, 'kids');
});

// Browser-like sandbox: document is defined, so a caller-supplied user and
// currentUser are ignored, and only a server-fresh users/{uid} read counts.
function loadBrowserAds(opts) {
    opts = opts || {};
    const reads = [];
    const authState = { currentUser: opts.signedIn === false ? null : { uid: opts.uid, isAnonymous: false } };
    const sandbox = {
        console, Date, Math, Intl, Uint8Array, Number, String, Boolean, Array, Object, JSON, Promise, isFinite,
        module: { exports: {} }, exports: {},
        BQ_ADS_NO_BOOT: true,
        localStorage: {
            getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
            setItem: function (k, v) { store[k] = String(v); },
            removeItem: function (k) { delete store[k]; }
        },
        firebase: {
            auth: function () { return authState; },
            firestore: function () {
                return {
                    collection: function (name) {
                        return {
                            doc: function (id) {
                                return {
                                    get: function (o) {
                                        reads.push({ collection: name, id: id, source: o && o.source });
                                        const data = (opts.docs || {})[name + '/' + id];
                                        return Promise.resolve({
                                            exists: !!data,
                                            metadata: { fromCache: opts.fromCache === true },
                                            data: function () { return data ? Object.assign({}, data) : undefined; }
                                        });
                                    },
                                    set: function () { return Promise.resolve(); }
                                };
                            }
                        };
                    }
                };
            }
        },
        currentUser: opts.currentUser || null,
        currentPage: 'home',
        location: { pathname: '/', hash: '', search: '' },
        document: {
            readyState: 'complete',
            getElementById: function () { return null; },
            querySelector: function () { return null; },
            querySelectorAll: function () { return []; },
            createElement: function () { return { setAttribute: function () {}, classList: { contains: function () { return false; } } }; },
            body: null
        }
    };
    sandbox.firebase.firestore.FieldValue = { increment: function (n) { return { _inc: n }; } };
    sandbox.global = sandbox;
    sandbox.root = sandbox;
    sandbox.window = sandbox;
    if (opts.windowFlag) sandbox._bqAgeConfirmed18 = true;
    sandbox._bqAdsAuthReady = true;
    sandbox._bqAdsUserUnknown = false;
    const code = fs.readFileSync(path.join(root, 'ads.js'), 'utf8');
    vm.runInNewContext(code, sandbox, { filename: 'ads.js' });
    return { ads: sandbox.bqAds || sandbox.module.exports, reads: reads, sandbox: sandbox, authState: authState };
}

function asyncTest(name, fn) {
    pending.push(Promise.resolve().then(function () {
        Object.keys(store).forEach(function (k) { delete store[k]; });
        return fn();
    }).then(function () {
        console.log('✅ ' + name);
        passed++;
    }).catch(function (e) {
        console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e));
        failed++;
    }));
}
const pending = [];

function cacheSaysAdult(uid) {
    store['btc_profile_cache'] = JSON.stringify({ uid: uid, ts: Date.now(), twoFa: false, data: { username: 'x', over18: true, ageConfirmed18: true } });
}

asyncTest('btc_profile_cache over18 alone gives no ads', async function () {
    const uid = 'cacheonly-' + findEligibleUid(loadAds(), 'c');
    const env = loadBrowserAds({ uid: uid, docs: { ['users/' + uid]: { username: 'x' } } });
    cacheSaysAdult(uid);
    await env.ads.fetchFreshUserDoc(uid);
    assert.strictEqual(env.ads.shouldShowAds({ surface: 'home', path: '/' }), false);
    assert.strictEqual(env.ads.decide({ surface: 'learning-quests' }).reason, 'age');
});

asyncTest('window._bqAgeConfirmed18 alone gives no ads', async function () {
    const uid = 'flagonly-' + findEligibleUid(loadAds(), 'f');
    const env = loadBrowserAds({ uid: uid, windowFlag: true, docs: { ['users/' + uid]: { username: 'x' } } });
    await env.ads.fetchFreshUserDoc(uid);
    assert.strictEqual(env.sandbox._bqAgeConfirmed18, true);
    assert.strictEqual(env.ads.shouldShowAds({ surface: 'home', path: '/' }), false);
});

asyncTest('currentUser over18 and a console-passed user give no ads without a fresh doc', async function () {
    const uid = 'console-' + findEligibleUid(loadAds(), 'k');
    const env = loadBrowserAds({ uid: uid, currentUser: { uid: uid, over18: true }, docs: {} });
    cacheSaysAdult(uid);
    assert.strictEqual(env.ads.shouldShowAds({ surface: 'home', path: '/' }), false);
    assert.strictEqual(env.ads.shouldShowAds({ user: { uid: uid, over18: true }, surface: 'home', path: '/' }), false);
    assert.strictEqual(env.ads.adsenseAllowed({ show: true, surface: 'learning-quests' }, { user: { uid: uid, over18: true }, surface: 'learning-quests' }), false);
});

asyncTest('the explicit-user flag plus a doc-shaped over18 user is ignored when document is present', async function () {
    const uid = 'flaguser-' + findEligibleUid(loadAds(), 'e');
    const env = loadBrowserAds({ uid: uid, docs: {} });
    const input = { _bqAdsAllowExplicitUser: true, user: { uid: uid, over18: true }, surface: 'home', path: '/' };
    assert.strictEqual(env.ads.shouldShowAds(input), false);
    assert.strictEqual(env.ads.decide(input).show, false);
});

asyncTest('a fresh server read of the own user doc with over18 gives ads', async function () {
    const base = loadAds();
    let uid = null;
    for (let i = 0; i < 500; i++) { if (!base.inHoldout('fresh' + i)) { uid = 'fresh' + i; break; } }
    const env = loadBrowserAds({ uid: uid, docs: { ['users/' + uid]: { username: 'x', over18: true } } });
    await env.ads.fetchFreshUserDoc(uid);
    assert.deepStrictEqual(env.reads.map(function (r) { return r.collection + '/' + r.id + ':' + r.source; }), ['users/' + uid + ':server']);
    assert.strictEqual(env.ads.shouldShowAds({ surface: 'home', path: '/' }), true);
    assert.strictEqual(env.ads.adsenseAllowed(env.ads.decide({ surface: 'learning-quests' }), { surface: 'learning-quests' }), true);
});

asyncTest('fresh doc ageUnder18 or ageConfirmBlocked gives no ads in the browser', async function () {
    const base = loadAds();
    let uid = null;
    for (let i = 0; i < 500; i++) { if (!base.inHoldout('fb' + i)) { uid = 'fb' + i; break; } }
    for (const extra of [{ ageUnder18: true }, { ageConfirmBlocked: true }]) {
        const env = loadBrowserAds({ uid: uid, windowFlag: true, docs: { ['users/' + uid]: Object.assign({ over18: true }, extra) } });
        cacheSaysAdult(uid);
        await env.ads.fetchFreshUserDoc(uid);
        assert.strictEqual(env.ads.shouldShowAds({ surface: 'home', path: '/' }), false, JSON.stringify(extra));
    }
});

asyncTest('an admin un-confirm sticks on the next fresh read', async function () {
    const base = loadAds();
    let uid = null;
    for (let i = 0; i < 500; i++) { if (!base.inHoldout('un' + i)) { uid = 'un' + i; break; } }
    const docs = { ['users/' + uid]: { over18: true } };
    const env = loadBrowserAds({ uid: uid, docs: docs });
    await env.ads.fetchFreshUserDoc(uid);
    assert.strictEqual(env.ads.shouldShowAds({ surface: 'home', path: '/' }), true);
    docs['users/' + uid] = { over18: false, ageConfirmBlocked: true };
    cacheSaysAdult(uid);
    await env.ads.fetchFreshUserDoc(uid);
    assert.strictEqual(env.ads.shouldShowAds({ surface: 'home', path: '/' }), false);
});

asyncTest('a cache-only Firestore snapshot is not trusted as fresh', async function () {
    const uid = 'cachesnap-' + findEligibleUid(loadAds(), 's');
    const env = loadBrowserAds({ uid: uid, fromCache: true, docs: { ['users/' + uid]: { over18: true } } });
    await env.ads.fetchFreshUserDoc(uid);
    assert.strictEqual(env.ads.getFreshUserDoc(), null);
    assert.strictEqual(env.ads.shouldShowAds({ surface: 'home', path: '/' }), false);
});

asyncTest('guests and another uid doc give no ads in the browser', async function () {
    const env = loadBrowserAds({ signedIn: false, docs: { 'users/x': { over18: true } } });
    await env.ads.fetchFreshUserDoc('x');
    assert.strictEqual(env.ads.shouldShowAds({ surface: 'home', path: '/' }), false);
    const env2 = loadBrowserAds({ uid: 'me', docs: { 'users/other': { over18: true } } });
    await env2.ads.fetchFreshUserDoc('other');
    assert.strictEqual(env2.ads.getFreshUserDoc(), null);
    assert.strictEqual(env2.ads.shouldShowAds({ surface: 'home', path: '/' }), false);
});

Promise.all(pending).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
