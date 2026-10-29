#!/usr/bin/env node
'use strict';
// Loads the real Firebase 9.23.0 App Check SDK and the page boot script.
// A plain-object provider never initializes reCAPTCHA. An already-expired
// blank token makes the refresher schedule itself again immediately.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CACHE = '/tmp/firebase-js-9.23.0';
const APP_URL = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js';
const CHECK_URL = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-check-compat.js';

function fetchText(url, dest) {
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
        return Promise.resolve(fs.readFileSync(dest, 'utf8'));
    }
    return fetch(url).then(function (res) {
        if (!res.ok) throw new Error('download failed ' + url + ' ' + res.status);
        return res.text();
    }).then(function (text) {
        fs.mkdirSync(CACHE, { recursive: true });
        fs.writeFileSync(dest, text);
        return text;
    });
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

process.on('unhandledRejection', function (reason) {
    if (reason === 'cancelled') return;
    console.error(reason);
    process.exit(1);
});

async function main() {
    const appSrc = await fetchText(APP_URL, path.join(CACHE, 'firebase-app-compat.js'));
    const checkSrc = await fetchText(CHECK_URL, path.join(CACHE, 'firebase-app-check-compat.js'));
    assert.ok(appSrc.indexOf('9.23.0') !== -1 || appSrc.length > 10000);
    assert.ok(checkSrc.indexOf('ReCaptchaV3Provider') !== -1);

    const sandbox = installDom();
    const window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(appSrc, sandbox, { filename: 'firebase-app-compat.js' });
    vm.runInContext(checkSrc, sandbox, { filename: 'firebase-app-check-compat.js' });
    const firebase = sandbox.firebase;
    assert.ok(firebase && firebase.appCheck, 'App Check SDK did not load');
    assert.strictEqual(typeof firebase.appCheck.ReCaptchaV3Provider, 'function');

    let gets = 0;
    let inits = 0;
    const proto = firebase.appCheck.ReCaptchaV3Provider.prototype;
    const origGet = proto.getToken;
    const origInit = proto.initialize;
    proto.getToken = function () {
        gets++;
        const err = new Error('appCheck/recaptcha-error');
        err.code = 'appCheck/recaptcha-error';
        return Promise.reject(err);
    };
    proto.initialize = function (app) {
        inits++;
        assert.ok(app, 'initialize() was called without an app');
        return origInit.apply(this, arguments);
    };

    const boot = fs.readFileSync(path.join(__dirname, '..', 'app-check-boot.js'), 'utf8');
    vm.runInContext(boot, sandbox, { filename: 'app-check-boot.js' });

    assert.ok(inits >= 1, 'ReCaptchaV3Provider.initialize was not called');
    assert.ok(window._btcAppCheckInner, 'boot did not keep the provider');
    assert.ok(window._btcAppCheckInner._app, 'provider was not initialized with the Firebase app');
    assert.strictEqual(window._btcAppCheckInner instanceof firebase.appCheck.ReCaptchaV3Provider, true);

    const started = Date.now();
    let thrown = null;
    try {
        await firebase.appCheck().getToken(false);
    } catch (e) {
        thrown = e;
    }
    assert.ok(thrown, 'a missing real token must reject instead of returning a blank token');
    assert.ok(String(thrown.message || thrown).indexOf('app-check-unavailable') !== -1);
    await new Promise(function (resolve) { setTimeout(resolve, 250); });
    assert.ok(gets > 0, 'the real provider getToken never ran');
    assert.ok(gets < 15, 'App Check refresh looped (' + gets + ' getToken calls in ' + (Date.now() - started) + 'ms)');

    proto.getToken = origGet;
    proto.initialize = origInit;
    console.log('app check sdk: initialize=' + inits + ' getToken=' + gets);
    process.exit(0);
}

main().catch(function (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
});
