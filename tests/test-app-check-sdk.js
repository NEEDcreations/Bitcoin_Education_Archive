#!/usr/bin/env node
'use strict';
// Loads the vendored Firebase 9.23.0 App Check SDK and the page boot script.
// A missing token must reject instead of spinning. A token issued 40 minutes
// ago is past the SDK refresh point and must be replaced, not returned.
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const VENDOR = path.join(__dirname, 'vendor', 'firebase-9.23.0');
const HASHES = {
    'firebase-app-compat.js': '1586b85e7ecc265235f1e224c1ac1b44a2f3edb19e50e0ed369491f9bb239478',
    'firebase-app-check-compat.js': '6f6b78851830cdf6f4a2e339f14e5252fe9a3c45d9f8c81147eb798f8f115603'
};

function sha256(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
}

function readVendored(name) {
    const dest = path.join(VENDOR, name);
    if (!fs.existsSync(dest)) return '';
    const text = fs.readFileSync(dest, 'utf8');
    return sha256(text) === HASHES[name] ? text : '';
}

async function loadSdk(name) {
    const cached = readVendored(name);
    if (cached) return cached;
    const url = 'https://www.gstatic.com/firebasejs/9.23.0/' + name;
    let text = '';
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('download failed ' + res.status);
        text = await res.text();
        if (sha256(text) !== HASHES[name]) throw new Error('hash mismatch for ' + name);
        fs.mkdirSync(VENDOR, { recursive: true });
        fs.writeFileSync(path.join(VENDOR, name), text);
        return text;
    } catch (err) {
        console.log('app check sdk: skipped, Firebase 9.23.0 is not available offline (' + (err && err.message) + ')');
        process.exit(0);
    }
}

function element() {
    return {
        style: {},
        id: '',
        children: [],
        setAttribute: function () {},
        appendChild: function (child) { this.children.push(child); return child; }
    };
}

function installDom() {
    const document = {
        cookie: '',
        head: element(),
        body: element(),
        createElement: element,
        getElementsByTagName: function () { return [element()]; }
    };
    const window = {
        document: document,
        navigator: { userAgent: 'node-test' },
        location: { href: 'https://bitcoineducation.quest/', protocol: 'https:' },
        localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        Promise: Promise,
        console: console,
        Date: Date,
        FIREBASE_CONFIG: {
            apiKey: 'AIzaSyDLwucmRxjoJp2KMBTi2ujf0mlVkgLHyKk',
            authDomain: 'bitcoineducation.quest',
            projectId: 'bitcoin-education-archive',
            storageBucket: 'bitcoin-education-archive.firebasestorage.app',
            messagingSenderId: '1055248200518',
            appId: '1:1055248200518:web:6c6d64a5ee78e19bfbeb47'
        }
    };
    window.window = window;
    window.self = window;
    window.globalThis = window;
    return window;
}

function boot(appSrc, checkSrc, hook) {
    const sandbox = installDom();
    vm.createContext(sandbox);
    vm.runInContext(appSrc, sandbox, { filename: 'firebase-app-compat.js' });
    vm.runInContext(checkSrc, sandbox, { filename: 'firebase-app-check-compat.js' });
    const firebase = sandbox.firebase;
    assert.ok(firebase && firebase.appCheck, 'App Check SDK did not load');
    const proto = firebase.appCheck.ReCaptchaV3Provider.prototype;
    const state = { gets: 0, inits: 0 };
    const origInit = proto.initialize;
    proto.getToken = function () {
        state.gets++;
        return hook(state.gets);
    };
    proto.initialize = function (app) {
        state.inits++;
        assert.ok(app, 'initialize() was called without an app');
        return origInit.apply(this, arguments);
    };
    const bootSrc = fs.readFileSync(path.join(__dirname, '..', 'app-check-boot.js'), 'utf8');
    vm.runInContext(bootSrc, sandbox, { filename: 'app-check-boot.js' });
    return { sandbox: sandbox, firebase: firebase, state: state };
}

process.on('unhandledRejection', function (reason) {
    if (reason === 'cancelled') return;
    console.error(reason);
    process.exit(1);
});

async function main() {
    const appSrc = await loadSdk('firebase-app-compat.js');
    const checkSrc = await loadSdk('firebase-app-check-compat.js');
    assert.strictEqual(sha256(appSrc), HASHES['firebase-app-compat.js']);
    assert.strictEqual(sha256(checkSrc), HASHES['firebase-app-check-compat.js']);
    assert.ok(checkSrc.indexOf('ReCaptchaV3Provider') !== -1);

    const missing = boot(appSrc, checkSrc, function () {
        const err = new Error('appCheck/recaptcha-error');
        err.code = 'appCheck/recaptcha-error';
        return Promise.reject(err);
    });
    assert.ok(missing.state.inits >= 1, 'ReCaptchaV3Provider.initialize was not called');
    assert.ok(missing.sandbox._btcAppCheckInner, 'boot did not keep the provider');
    assert.ok(missing.sandbox._btcAppCheckInner._app, 'provider was not initialized with the Firebase app');
    assert.strictEqual(missing.sandbox._btcAppCheckInner instanceof missing.firebase.appCheck.ReCaptchaV3Provider, true);
    const started = Date.now();
    let thrown = null;
    try {
        await missing.firebase.appCheck().getToken(false);
    } catch (e) {
        thrown = e;
    }
    assert.ok(thrown, 'a missing real token must reject instead of returning a blank token');
    assert.ok(String(thrown.message || thrown).indexOf('app-check-unavailable') !== -1);
    await new Promise(function (resolve) { setTimeout(resolve, 250); });
    assert.ok(missing.state.gets > 0, 'the real provider getToken never ran');
    assert.ok(missing.state.gets < 15, 'App Check refresh looped (' + missing.state.gets + ' getToken calls)');
    console.log('app check sdk: initialize=' + missing.state.inits + ' getToken=' + missing.state.gets + ' in ' + (Date.now() - started) + 'ms');

    let mode = 'old';
    const stale = boot(appSrc, checkSrc, function () {
        const now = Date.now();
        if (mode === 'old') {
            return Promise.resolve({
                token: 'old-token',
                issuedAtTimeMillis: now - 40 * 60 * 1000,
                expireTimeMillis: now + 20 * 60 * 1000
            });
        }
        return Promise.resolve({
            token: 'new-token',
            issuedAtTimeMillis: now,
            expireTimeMillis: now + 60 * 60 * 1000
        });
    });
    await stale.sandbox._btcAppCheckForClaim(1000);
    mode = 'new';
    const callsBefore = stale.state.gets;
    let events = 0;
    stale.firebase.appCheck().onTokenChanged(function () { events++; });
    const refreshed = await stale.firebase.appCheck().getToken(true);
    await new Promise(function (resolve) { setTimeout(resolve, 300); });
    assert.strictEqual(refreshed.token, 'new-token');
    assert.ok(stale.state.gets > callsBefore, 'a 40-minute-old token was returned instead of exchanged');
    assert.ok(events <= 3, 'App Check token events ran away (' + events + ')');
    assert.ok(stale.state.gets - callsBefore <= 3, 'fresh exchange was repeated (' + (stale.state.gets - callsBefore) + ')');
    console.log('app check sdk: 40-min refresh events=' + events + ' newCalls=' + (stale.state.gets - callsBefore));

    const fast = installDom();
    function FakeProvider() {}
    FakeProvider.prototype.getToken = function () { return new Promise(function () {}); };
    FakeProvider.prototype.initialize = function (app) { this._app = app || {}; };
    fast.firebase = {
        apps: [{}],
        initializeApp: function () {},
        app: function () { return {}; },
        appCheck: function () { return { activate: function () {} }; }
    };
    fast.firebase.appCheck.ReCaptchaV3Provider = FakeProvider;
    vm.createContext(fast);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'app-check-boot.js'), 'utf8'), fast, { filename: 'app-check-boot.js' });
    const firstAt = Date.now();
    const first = await fast._btcAppCheckForClaim(40);
    const firstWait = Date.now() - firstAt;
    assert.strictEqual(first, '');
    assert.strictEqual(fast._btcRecaptchaFailed, true);
    const secondAt = Date.now();
    const second = await fast._btcAppCheckForClaim(8000);
    const secondWait = Date.now() - secondAt;
    assert.strictEqual(second, '');
    assert.ok(firstWait >= 30, 'the first script-load failure waited ' + firstWait + 'ms');
    assert.ok(secondWait < 20, 'a later protected wait did not fail fast (' + secondWait + 'ms)');
    console.log('app check sdk: recaptcha fail-fast first=' + firstWait + 'ms second=' + secondWait + 'ms');

    process.exit(0);
}

main().catch(function (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
});
