#!/usr/bin/env node
'use strict';
// The httpsCallable wrapper waits only for functions that enforce App Check.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');

function walk(dir, out) {
    fs.readdirSync(dir).forEach(function (name) {
        if (name === 'node_modules' || name === 'scripts' || name === 'vendor') return;
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full, out);
        else if (name.endsWith('.js')) out.push(full);
    });
}

function strip(src) {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}

function scan(src) {
    const names = new Set();
    const factories = new Set();
    const needle = 'enforceAppCheck: true';
    let idx = 0;
    while ((idx = src.indexOf(needle, idx)) !== -1) {
        const near = src.slice(Math.max(0, idx - 400), idx);
        const bound = near.match(/(?:exports\.|const\s+)([A-Za-z_$][\w$]*)\s*=\s*[^;=]*$/);
        const key = near.match(/([A-Za-z_$][\w$]*)\s*:\s*[^;=]*$/);
        if (bound && (bound[1] === 'opts' || bound[1] === 'onCall' || bound[1] === 'onCallApp' || bound[1] === 'onCallAppKey')) {
            factories.add(bound[1]);
        } else if (/function\s+onCall\s*\(/.test(near.slice(-180))) {
            factories.add('onCall');
        } else if (bound) names.add(bound[1]);
        else if (key) names.add(key[1]);
        idx += needle.length;
    }
    let match;
    if (factories.has('opts')) {
        const re = /([A-Za-z_$][\w$]*)\s*:\s*functionsV1\.runWith\(opts\)/g;
        while ((match = re.exec(src))) names.add(match[1]);
    }
    if (factories.has('onCall')) {
        const re = /(?:const\s+([A-Za-z_$][\w$]*)\s*=\s*onCall\s*\(|([A-Za-z_$][\w$]*)\s*:\s*onCall(?:\(\))?\s*\()/g;
        while ((match = re.exec(src))) names.add(match[1] || match[2]);
    }
    if (factories.has('onCallApp') || factories.has('onCallAppKey')) {
        const re = /const\s+([A-Za-z_$][\w$]*)\s*=\s*onCallApp(?:Key)?\s*\(/g;
        while ((match = re.exec(src))) names.add(match[1]);
    }
    ['onCall', 'onCallApp', 'onCallAppKey', 'opts'].forEach(function (name) { names.delete(name); });
    return names;
}

function protectedNames() {
    const files = [];
    walk(path.join(root, 'functions'), files);
    const names = new Set();
    files.forEach(function (file) {
        scan(strip(fs.readFileSync(file, 'utf8'))).forEach(function (name) { names.add(name); });
    });
    return names;
}

function extractTurnstile() {
    const start = ranking.indexOf('window._ensureTurnstile = function');
    if (start < 0) throw new Error('missing _ensureTurnstile');
    let depth = 0;
    let seen = false;
    for (let i = ranking.indexOf('{', start); i < ranking.length; i++) {
        if (ranking[i] === '{') {
            depth++;
            seen = true;
        } else if (ranking[i] === '}') {
            depth--;
            if (seen && depth === 0) return ranking.slice(start, i + 2);
        }
    }
    throw new Error('unclosed _ensureTurnstile');
}

async function main() {
    const scanned = [...protectedNames()].sort();
    assert.ok(scanned.indexOf('claimSats') !== -1);
    assert.ok(scanned.indexOf('totpResumeDevice') !== -1);
    ['setUsername', 'nostrAuth', 'lnAuthChallenge', 'lnAuthVerify', 'totpCheck', 'totpStatus', 'totpSetup', 'totpVerify', 'issueRecoveryCodes', 'recordDailyVisit', 'dailySpin', 'contributeRaid', 'contributeFavor', 'hashForFavor', 'searchUsers', 'pollVote', 'postTopicComment'].forEach(function (name) {
        assert.strictEqual(scanned.indexOf(name), -1, name + ' is not an App Check callable');
    });
    const onboarding = fs.readFileSync(path.join(root, 'functions', 'src', 'onboardingApi.js'), 'utf8');
    assert.ok(onboarding.indexOf('context && context.app ?') !== -1);
    assert.strictEqual(onboarding.indexOf('if (!context.app)'), -1);
    assert.strictEqual(onboarding.indexOf('if (!request.app)'), -1);

    const chunkStart = ranking.indexOf('var APP_CHECK_CALLABLES');
    const chunkEnd = ranking.indexOf('function _mfaFailure');
    const sandbox = {
        console: console,
        Promise: Promise,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        sent: [],
        waits: 0
    };
    sandbox.window = sandbox;
    function FunctionsClient() {}
    FunctionsClient.prototype.httpsCallable = function (name) {
        return function (data) {
            sandbox.sent.push({ name: name, data: data });
            return Promise.resolve({ data: { ok: true } });
        };
    };
    sandbox.firebase = { functions: function () { return new FunctionsClient(); } };
    let releaseClaim = function () {};
    sandbox._btcAppCheckForClaim = function () {
        sandbox.waits++;
        return new Promise(function (resolve) { releaseClaim = resolve; });
    };
    vm.createContext(sandbox);
    vm.runInContext(
        ranking.slice(chunkStart, chunkEnd) + '\nthis.installMfaCallablePatch = installMfaCallablePatch;\nthis.APP_CHECK_CALLABLES = APP_CHECK_CALLABLES;',
        sandbox
    );
    assert.deepStrictEqual(Object.keys(sandbox.APP_CHECK_CALLABLES).sort(), scanned);
    sandbox.installMfaCallablePatch();

    const setUsername = sandbox.firebase.functions().httpsCallable('setUsername');
    const saved = await setUsername({ username: 'ada' });
    assert.strictEqual(saved.data.ok, true);
    assert.strictEqual(sandbox.waits, 0);
    assert.strictEqual(sandbox.sent.length, 1);
    assert.strictEqual(sandbox.sent[0].name, 'setUsername');
    assert.strictEqual(sandbox.sent[0].data.username, 'ada');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(sandbox.sent[0].data, 'appCheckToken'), false);

    const claim = sandbox.firebase.functions().httpsCallable('claimSats')({});
    const raced = await Promise.race([
        claim.then(function () { return 'sent'; }, function (err) { return err; }),
        new Promise(function (resolve) { setTimeout(function () { resolve('waiting'); }, 40); })
    ]);
    assert.strictEqual(raced, 'waiting');
    assert.strictEqual(sandbox.sent.length, 1, 'a protected callable sent before App Check was ready');
    assert.ok(sandbox.waits >= 1);
    releaseClaim('');
    const refused = await claim.then(function () { return null; }, function (err) { return err; });
    assert.strictEqual(refused.code, 'app-check-unavailable');
    assert.strictEqual(sandbox.sent.length, 1);

    const waitsBeforeFast = sandbox.waits;
    sandbox._btcRecaptchaFailed = true;
    sandbox._btcAppCheckForClaim = function () {
        sandbox.waits++;
        return new Promise(function () {});
    };
    const fast = await sandbox.firebase.functions().httpsCallable('claimSats')({}).then(function () { return null; }, function (err) { return err; });
    assert.strictEqual(fast.code, 'app-check-unavailable');
    assert.strictEqual(fast.message, 'Security check did not load. Refresh the page and try again.');
    assert.strictEqual(sandbox.waits, waitsBeforeFast);
    assert.strictEqual(sandbox.sent.length, 1);

    const turn = extractTurnstile();
    const scripts = [];
    const page = {
        document: {
            createElement: function () {
                return {};
            },
            head: {
                appendChild: function (script) { scripts.push(script); }
            }
        }
    };
    page.window = page;
    vm.createContext(page);
    vm.runInContext(turn, page);
    page._ensureTurnstile({ id: 'lnAddrTurnstile', getAttribute: function () { return ''; }, setAttribute: function () {} });
    assert.strictEqual(scripts.length, 1);
    scripts[0].onerror();
    assert.strictEqual(page._lnTurnstileRetried, true);
    assert.strictEqual(scripts.length, 2);
    scripts[1].onerror();
    assert.strictEqual(scripts.length, 2);

    const signupScripts = [];
    const signup = {
        document: {
            createElement: function () { return {}; },
            head: { appendChild: function (script) { signupScripts.push(script); } }
        }
    };
    signup.window = signup;
    vm.createContext(signup);
    vm.runInContext(turn, signup);
    signup._ensureTurnstile({ id: 'turnstileWidget', getAttribute: function () { return ''; }, setAttribute: function () {} });
    signupScripts[0].onerror();
    assert.strictEqual(signupScripts.length, 1);
    assert.strictEqual(signup._turnstileWaiters.length, 0);

    console.log('app check callables: ' + scanned.length + ' protected');
}

main().catch(function (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
});
