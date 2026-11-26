#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const store = {};
const increments = [];
const callableCalls = [];

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
        ADS_EEA_ENABLED: opts.eeaEnabled,
        BQ_ADS_EEA_ENABLED: opts.bqEeaEnabled,
        navigator: opts.navigator || {},
        localStorage: {
            getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
            setItem: function (k, v) { store[k] = String(v); },
            removeItem: function (k) { delete store[k]; },
            clear: function () { Object.keys(store).forEach(function (k) { delete store[k]; }); }
        },
        sessionStorage: {
            getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, 'sess:' + k) ? store['sess:' + k] : null; },
            setItem: function (k, v) { store['sess:' + k] = String(v); },
            removeItem: function (k) { delete store['sess:' + k]; }
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
            },
            functions: function () {
                return {
                    httpsCallable: function (name) {
                        return function (payload) {
                            callableCalls.push({ name: name, payload: payload });
                            if (opts.callableReject) return Promise.reject(new Error('not deployed'));
                            return Promise.resolve({ data: { ok: true, optedOut: !!(payload && payload.optedOut) } });
                        };
                    }
                };
            }
        },
        currentUser: opts.user || null,
        currentPage: opts.page || 'home',
        location: { pathname: opts.path || '/', hash: opts.hash || '' },
        fetch: opts.fetch || undefined,
        document: undefined,
        window: undefined
    };
    sandbox.firebase.firestore.FieldValue = {
        increment: function (n) { return { _inc: n }; }
    };
    sandbox.firebase.auth = function () {
        return { currentUser: opts.authUser || null };
    };
    sandbox.global = sandbox;
    sandbox.root = sandbox;
    sandbox.window = sandbox;
    if (opts.clearStore) Object.keys(store).forEach(function (k) { delete store[k]; });
    const code = fs.readFileSync(path.join(root, 'ads.js'), 'utf8');
    vm.runInNewContext(code, sandbox, { filename: 'ads.js' });
    sandbox.api = sandbox.bqAds || sandbox.module.exports;
    return sandbox;
}

function eligibleUid(ads, prefix) {
    for (let i = 0; i < 400; i++) {
        if (!ads.inHoldout((prefix || 'ok') + i)) return (prefix || 'ok') + i;
    }
    return (prefix || 'ok') + '0';
}

function eligibleUser(ads, prefix) {
    return { uid: eligibleUid(ads, prefix), over18: true };
}

let passed = 0, failed = 0;
function test(name, fn) {
    try {
        Object.keys(store).forEach(function (k) { delete store[k]; });
        increments.length = 0;
        callableCalls.length = 0;
        const ret = fn();
        if (ret && typeof ret.then === 'function') {
            return ret.then(function () {
                console.log('✅ ' + name);
                passed++;
            }).catch(function (e) {
                console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e));
                failed++;
            });
        }
        console.log('✅ ' + name);
        passed++;
        return Promise.resolve();
    } catch (e) {
        console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e));
        failed++;
        return Promise.resolve();
    }
}

const pending = [];
pending.push(test('GPC forces AdSense npa and skips A-ADS for an eligible user', function () {
    const env = loadAds({ navigator: { globalPrivacyControl: true } });
    const ads = env.api;
    const user = eligibleUser(ads, 'gpc');
    const d = ads.decide({ user: user, surface: 'home', path: '/' });
    assert.strictEqual(d.show, true);
    assert.strictEqual(d.npa, true);
    assert.strictEqual(d.skipAads, true);
    assert.strictEqual(d.privacyOptOut, true);
    assert.strictEqual(ads.shouldSkipAads({ user: user }), true);
    assert.ok(ads.adsenseScriptSrc(true).indexOf('npa=1') !== -1);
    assert.ok(ads.adsenseScriptSrc(false).indexOf('npa=1') === -1);
    assert.strictEqual(ads.adsenseScriptSrc(false), ads.ADSENSE_SRC || env.api.ADSENSE_CLIENT && ads.adsenseScriptSrc(false));
    assert.ok(ads.adsenseScriptSrc(false).indexOf('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7244515226002177') !== -1);
    ads.applyNonPersonalizedAds(true);
    assert.strictEqual(env.adsbygoogle.requestNonPersonalizedAds, 1);
}));

pending.push(test('the Your Privacy Choices toggle forces npa and is stored locally', function () {
    const env = loadAds({ navigator: { globalPrivacyControl: false } });
    const ads = env.api;
    const user = eligibleUser(ads, 'tog');
    assert.strictEqual(ads.isPrivacyShareOptedOut({ user: user, gpc: false }), false);
    ads.setShareOptOut(true);
    assert.strictEqual(store['bq_privacy_share_opt_out'], '1');
    const d = ads.decide({ user: user, surface: 'learning-quests', gpc: false });
    assert.strictEqual(d.show, true);
    assert.strictEqual(d.npa, true);
    assert.strictEqual(d.skipAads, true);
    ads.setShareOptOut(false);
    const d2 = ads.decide({ user: user, surface: 'learning-quests', gpc: false });
    assert.strictEqual(d2.npa, false);
    assert.strictEqual(d2.skipAads, false);
    assert.strictEqual(d2.show, true);
}));

pending.push(test('an account privacyShareOptOut field forces npa even without local storage', function () {
    const env = loadAds({ navigator: { globalPrivacyControl: false } });
    const ads = env.api;
    const user = eligibleUser(ads, 'acct');
    user.privacyShareOptOut = true;
    const d = ads.decide({ user: user, surface: 'home', gpc: false });
    assert.strictEqual(d.npa, true);
    assert.strictEqual(d.skipAads, true);
}));

pending.push(test('EEA, UK, and Switzerland get no ads while ADS_EEA_ENABLED is off', function () {
    const env = loadAds();
    const ads = env.api;
    assert.strictEqual(ads.eeaAdsEnabled(), false);
    const user = eligibleUser(ads, 'eea');
    ['DE', 'FR', 'GB', 'CH', 'IE', 'NL', 'NO', 'IS', 'LI'].forEach(function (cc) {
        const d = ads.decide({ user: user, surface: 'home', country: cc });
        assert.strictEqual(d.show, false, cc);
        assert.strictEqual(d.reason, 'geo', cc);
        assert.strictEqual(d.experimentGroup, null, cc);
        assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'home', country: cc }), false, cc);
    });
}));

pending.push(test('unknown country and failed country codes fail closed', function () {
    const env = loadAds();
    const ads = env.api;
    const user = eligibleUser(ads, 'unk');
    const cases = [null, '', 'XX', 'T1'];
    cases.forEach(function (cc) {
        const d = ads.decide({ user: user, surface: 'home', country: cc });
        assert.strictEqual(d.show, false, String(cc));
        assert.strictEqual(d.reason, 'geo', String(cc));
        assert.strictEqual(d.experimentGroup, null, String(cc));
    });
}));

pending.push(test('a US user still sees ads, and existing eligibility rules are unchanged', function () {
    const env = loadAds();
    const ads = env.api;
    const user = eligibleUser(ads, 'us');
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'home', country: 'US' }), true);
    assert.strictEqual(ads.decide({ user: user, surface: 'home', country: 'US' }).reason, null);
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'arcade', country: 'US' }), true);
    assert.strictEqual(ads.shouldShowAds({ user: { uid: 'p', premium: { active: true }, over18: true }, surface: 'home', country: 'US' }), false);
    assert.strictEqual(ads.decide({ user: { uid: 'p', premium: { active: true }, over18: true }, surface: 'home', country: 'US' }).reason, 'premium');
    assert.strictEqual(ads.shouldShowAds({ user: { uid: 'k', kids: true, over18: true }, surface: 'home', country: 'US' }), false);
    assert.strictEqual(ads.shouldShowAds({ user: { uid: 'g', isAnonymous: true, over18: true }, surface: 'home', country: 'US' }), false);
    assert.strictEqual(ads.shouldShowAds({ user: { uid: user.uid, over18: true }, surface: 'timechain-tv', country: 'US' }), false);
    assert.strictEqual(ads.decide({ user: { uid: user.uid, over18: true }, surface: 'timechain-tv', country: 'US' }).reason, 'tctv');
    // Omitting country keeps the previous decide() contract for unit tests.
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'home' }), true);
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'forum' }), false);
}));

pending.push(test('ADS_EEA_ENABLED lets a known EEA country through but still fails closed on unknown', function () {
    const env = loadAds({ eeaEnabled: true });
    const ads = env.api;
    assert.strictEqual(ads.eeaAdsEnabled(), true);
    const user = eligibleUser(ads, 'flag');
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'home', country: 'DE' }), true);
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'home', country: 'GB' }), true);
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'home', country: 'CH' }), true);
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'home', country: null }), false);
    assert.strictEqual(ads.decide({ user: user, surface: 'home', country: null }).reason, 'geo');
}));

pending.push(test('BQ_ADS_EEA_ENABLED is the same flag under the existing BQ_ prefix', function () {
    const env = loadAds({ bqEeaEnabled: true });
    const ads = env.api;
    const user = eligibleUser(ads, 'bqflag');
    assert.strictEqual(ads.eeaAdsEnabled(), true);
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'home', country: 'FR' }), true);
}));

pending.push(test('/cdn-cgi/trace loc= is parsed, and a missing loc is unknown', function () {
    const env = loadAds();
    const ads = env.api;
    assert.strictEqual(ads.TRACE_PATH, '/cdn-cgi/trace');
    assert.strictEqual(ads.parseTraceCountry('fl=1\nh=bitcoineducation.quest\nloc=DE\ncolo=FRA\n'), 'DE');
    assert.strictEqual(ads.parseTraceCountry('loc=us\n'), 'US');
    assert.strictEqual(ads.parseTraceCountry('hello'), null);
    assert.strictEqual(ads.parseTraceCountry(''), null);
}));

pending.push(test('ensureGeo uses /cdn-cgi/trace and fails closed when the fetch fails', async function () {
    const env = loadAds({
        fetch: function (url) {
            assert.strictEqual(url, '/cdn-cgi/trace');
            return Promise.reject(new Error('offline'));
        }
    });
    const ads = env.api;
    const user = eligibleUser(ads, 'fetchfail');
    const country = await ads.ensureGeo();
    assert.strictEqual(country, null);
    assert.strictEqual(ads.isGeoBlocked({}), true);
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'home' }), false);
    assert.strictEqual(ads.decide({ user: user, surface: 'home' }).reason, 'geo');
}));

pending.push(test('ensureGeo with loc=US unblocks ads for an eligible user', async function () {
    const env = loadAds({
        fetch: function () {
            return Promise.resolve({ ok: true, text: function () { return Promise.resolve('h=bitcoineducation.quest\nloc=US\n'); } });
        }
    });
    const ads = env.api;
    const user = eligibleUser(ads, 'fetchus');
    await ads.ensureGeo();
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'home' }), true);
}));

pending.push(test('A-ADS is skipped on GPC because its policy allows cookies and device identifiers', function () {
    const env = loadAds({ navigator: { globalPrivacyControl: true } });
    const ads = env.api;
    const user = eligibleUser(ads, 'aads');
    assert.strictEqual(ads.shouldSkipAads({ user: user }), true);
    const src = fs.readFileSync(path.join(root, 'ads.js'), 'utf8');
    assert.ok(src.indexOf("A-ADS's policy allows cookies") !== -1 || src.indexOf('A-ADS') !== -1);
}));

pending.push(test('the official AdSense client tag is unchanged when npa is off, for Funding Choices', function () {
    const env = loadAds();
    const ads = env.api;
    const src = ads.adsenseScriptSrc(false);
    assert.strictEqual(src, 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7244515226002177');
    assert.ok(src.indexOf('npa=') === -1);
    const worker = fs.readFileSync(path.join(root, 'workers/seo-router/worker.js'), 'utf8');
    assert.ok(worker.indexOf('https://fundingchoicesmessages.google.com') !== -1);
    const firebase = fs.readFileSync(path.join(root, 'firebase.json'), 'utf8');
    assert.ok(firebase.indexOf('https://fundingchoicesmessages.google.com') !== -1);
}));

pending.push(test('index.html and 404.html have the footer link, the hash handoff, and stay identical', function () {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const html404 = fs.readFileSync(path.join(root, '404.html'), 'utf8');
    assert.strictEqual(html, html404);
    assert.ok(html.indexOf('Your Privacy Choices') !== -1);
    assert.ok(html.indexOf('href="#privacy-choices"') !== -1);
    assert.ok(html.indexOf("btc_open_privacy_choices") !== -1);
    assert.ok(html.indexOf('src="/ads.js?v=20261126_v2705"') !== -1);
    assert.ok(html.indexOf('src="/ranking.js?v=20261126_v2705"') !== -1);
    const settings = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
    assert.ok(settings.indexOf('id="bqPrivacyChoices"') !== -1);
    assert.ok(settings.indexOf('Do not sell or share my personal information') !== -1);
}));

pending.push(test('legal and support pages link to Your Privacy Choices', function () {
    const files = ['privacy.html', 'terms.html', 'deletion.html', 'dmca.html', 'tctv-terms.html', 'raffle-rules.html', 'patch-notes.html', 'resets.html', 'waitlist.html'];
    files.forEach(function (name) {
        const html = fs.readFileSync(path.join(root, name), 'utf8');
        assert.ok(html.indexOf('Your Privacy Choices') !== -1, name);
        assert.ok(html.indexOf('privacy-choices') !== -1, name);
    });
}));

pending.push(test('firestore.rules are unchanged: no new client-writable privacy field', function () {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    assert.ok(rules.indexOf('privacyShareOptOut') === -1);
    assert.ok(rules.indexOf('match /ads_holdout_stats/{day}') !== -1);
}));

pending.push(test('the callable name is setPrivacyShareOptOut and the default EEA flag is off', function () {
    const env = loadAds();
    const ads = env.api;
    assert.strictEqual(ads.CALLABLE_NAME, 'setPrivacyShareOptOut');
    assert.strictEqual(ads.ACCOUNT_OPTOUT_FIELD, 'privacyShareOptOut');
    assert.strictEqual(ads.eeaAdsEnabled(), false);
    const src = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    assert.ok(src.indexOf('exports.setPrivacyShareOptOut') !== -1);
    const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    assert.ok(sw.indexOf("const CACHE_NAME = 'btc-archive-v2705'") !== -1);
}));

Promise.all(pending).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
