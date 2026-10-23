#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const secondFactor = require('../functions/src/secondFactor');

let passed = 0;
let failed = 0;

function test(name, fn) {
    return Promise.resolve().then(fn).then(function () {
        console.log('  ok  ' + name);
        passed++;
    }).catch(function (e) {
        console.log('  FAIL ' + name);
        console.log('       ' + (e && e.stack ? e.stack : e));
        failed++;
    });
}

function extractFunction(src, name) {
    const start = src.indexOf('function ' + name + '(');
    if (start < 0) throw new Error('missing ' + name);
    let depth = 0;
    let seen = false;
    for (let i = start; i < src.length; i++) {
        if (src[i] === '{') {
            depth++;
            seen = true;
        } else if (src[i] === '}') {
            depth--;
            if (seen && depth === 0) return src.slice(start, i + 1);
        }
    }
    throw new Error('unclosed ' + name);
}

const ranking = fs.readFileSync(path.join(__dirname, '..', 'ranking.js'), 'utf8');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(
    extractFunction(ranking, 'mfaErrorCode') + '\n' +
    extractFunction(ranking, 'mfaIsTransientError') + '\n' +
    extractFunction(ranking, 'mfaAllowsAfterStatusError') + '\n' +
    extractFunction(ranking, 'mfaRetryOnce') + '\n' +
    'this.mfaIsTransientError = mfaIsTransientError; this.mfaRetryOnce = mfaRetryOnce; this.mfaAllowsAfterStatusError = mfaAllowsAfterStatusError;',
    sandbox
);

function err(code, message) {
    return Object.assign(new Error(message || code), { code: code });
}

async function main() {
    await test('labels keep the browser and system and drop an address', function () {
        assert.strictEqual(
            secondFactor.deviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'),
            'Chrome on macOS'
        );
        assert.strictEqual(
            secondFactor.deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'),
            'Edge on Windows'
        );
        assert.strictEqual(
            secondFactor.deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'),
            'Safari on iOS'
        );
        const labeled = secondFactor.deviceLabel('Mozilla/5.0 (X11; Linux x86_64) 203.0.113.10 Firefox/121.0');
        assert.strictEqual(labeled, 'Firefox on Linux');
        assert.ok(labeled.indexOf('203.0.113.10') === -1);
        assert.strictEqual(secondFactor.DEVICE_TTL_MS, 30 * 24 * 60 * 60 * 1000);
        assert.strictEqual(secondFactor.FRESH_TTL_MS, 5 * 60 * 1000);
    });

    await test('a device token is hashed as raw bytes', function () {
        const crypto = require('crypto');
        const token = 'ab'.repeat(32);
        const expected = crypto.createHash('sha256').update(Buffer.from(token, 'hex')).digest('hex');
        assert.strictEqual(secondFactor.hashDeviceToken(token), expected);
        assert.notStrictEqual(secondFactor.hashDeviceToken(token), crypto.createHash('sha256').update(token).digest('hex'));
        assert.strictEqual(secondFactor.hashDeviceToken('true'), '');
        assert.strictEqual(secondFactor.hashDeviceToken('AB'.repeat(32)), '');
    });

    await test('a successful status call is not retried', async function () {
        let calls = 0;
        let sleeps = 0;
        const value = await sandbox.mfaRetryOnce(function () {
            calls++;
            return Promise.resolve('ok');
        }, function () {
            sleeps++;
            return Promise.resolve();
        });
        assert.strictEqual(value, 'ok');
        assert.strictEqual(calls, 1);
        assert.strictEqual(sleeps, 0);
    });

    await test('one transient failure retries once', async function () {
        let calls = 0;
        let sleeps = 0;
        const value = await sandbox.mfaRetryOnce(function () {
            calls++;
            if (calls === 1) return Promise.reject(err('unavailable', 'cold start'));
            return Promise.resolve('back');
        }, function (ms) {
            sleeps++;
            assert.strictEqual(ms, 700);
            return Promise.resolve();
        });
        assert.strictEqual(value, 'back');
        assert.strictEqual(calls, 2);
        assert.strictEqual(sleeps, 1);
    });

    await test('a second transient failure is returned', async function () {
        let calls = 0;
        await assert.rejects(function () {
            return sandbox.mfaRetryOnce(function () {
                calls++;
                return Promise.reject(err('deadline-exceeded', 'network'));
            }, function () { return Promise.resolve(); });
        }, function (e) { return e.code === 'deadline-exceeded'; });
        assert.strictEqual(calls, 2);
    });

    await test('permission denied and rate limits are not retried', async function () {
        let denied = 0;
        await assert.rejects(function () {
            return sandbox.mfaRetryOnce(function () {
                denied++;
                return Promise.reject(err('permission-denied', 'no'));
            }, function () { throw new Error('slept'); });
        }, function (e) { return e.code === 'permission-denied'; });
        assert.strictEqual(denied, 1);

        let limited = 0;
        await assert.rejects(function () {
            return sandbox.mfaRetryOnce(function () {
                limited++;
                return Promise.reject(err('resource-exhausted', 'Too many attempts'));
            }, function () { throw new Error('slept'); });
        }, function (e) { return e.code === 'resource-exhausted'; });
        assert.strictEqual(limited, 1);
        assert.strictEqual(sandbox.mfaIsTransientError(err('failed-precondition', 'Device is not trusted.')), false);
        assert.strictEqual(sandbox.mfaIsTransientError(err('failed-precondition', 'Authenticator is temporarily unavailable.')), false);
        assert.strictEqual(sandbox.mfaIsTransientError(err('functions/unavailable', 'cold start')), true);
        assert.strictEqual(sandbox.mfaIsTransientError(err('internal', 'cold start')), true);
        assert.strictEqual(sandbox.mfaIsTransientError(err('', 'Failed to fetch')), false);
        assert.strictEqual(sandbox.mfaIsTransientError(err('', 'unavailable')), false);
        assert.strictEqual(sandbox.mfaAllowsAfterStatusError(true), false);
        assert.strictEqual(sandbox.mfaAllowsAfterStatusError(false), true);
    });

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(function (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
});
