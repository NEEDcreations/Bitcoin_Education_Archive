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

test('default holdout percentage is one config value at 10', function () {
    const ads = loadAds();
    assert.strictEqual(ads.HOLDOUT_PCT, 10);
    assert.strictEqual(ads.holdoutPct(), 10);
});

test('holdout percentage can be overridden from one config hook', function () {
    const ads = loadAds({ holdoutPct: 20 });
    assert.strictEqual(ads.holdoutPct(), 20);
    assert.strictEqual(ads.HOLDOUT_PCT, 10);
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
    // Find a user that is NOT in the 10% holdout so surface is the only gate.
    let uid = 'eligible-0';
    for (let i = 0; i < 200; i++) {
        if (!ads.inHoldout('u' + i, 10)) { uid = 'u' + i; break; }
    }
    const d = ads.decide({ user: { uid: uid }, surface: 'timechain-tv', path: '/timechain-tv' });
    assert.strictEqual(d.show, false);
    assert.strictEqual(d.reason, 'tctv');
    assert.strictEqual(d.experimentGroup, null);
    assert.strictEqual(ads.shouldShowAds({ user: { uid: uid }, path: '/tv', tctvActive: true }), false);
});

test('ads are allowed only on homepage, Learn, and arcade for eligible users', function () {
    const ads = loadAds();
    let uid = 'ok';
    for (let i = 0; i < 400; i++) {
        if (!ads.inHoldout('ok' + i, 10)) { uid = 'ok' + i; break; }
    }
    const user = { uid: uid };
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
        if (!ads.inHoldout('agg' + i, 10)) { uid = 'agg' + i; break; }
    }
    const now = new Date('2026-11-25T18:00:00-05:00');
    const decision = ads.decide({ user: { uid: uid }, surface: 'home' });
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
        if (ads.inHoldout('ret' + i, 10)) { uid = 'ret' + i; break; }
    }
    const day1 = new Date('2026-11-25T12:00:00-05:00');
    const day2 = new Date('2026-11-26T09:00:00-05:00');
    const d1 = ads.decide({ user: { uid: uid }, surface: 'forum' });
    assert.strictEqual(d1.experimentGroup, 'holdout');
    ads.recordDailyAggregate(d1, day1);
    const firstFields = increments.map(function (i) { return Object.keys(i.data)[0]; });
    assert.ok(firstFields.indexOf('holdoutDau') >= 0);
    increments.length = 0;
    const d2 = ads.decide({ user: { uid: uid }, surface: 'home' });
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
    assert.ok(html.includes('src="/ads.js?v=20261125_v2691"'));
    assert.ok(html.includes('defer') && html.includes('ads.js'));
    assert.ok(html.includes('id="bqAadsHome"'));
    assert.ok(html.includes('name="google-adsense-account"'));
    assert.ok(html.includes('ca-pub-7244515226002177'));
    assert.ok(!html.includes('z-index: 99998'));
    assert.ok(!html.includes("z-index:99998"));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
