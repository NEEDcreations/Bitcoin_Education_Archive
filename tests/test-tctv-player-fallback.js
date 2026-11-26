'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

const src = read('timechain-tv.js');
const html = read('index.html');
const html404 = read('404.html');

test('the YouTube API wait is 15s and is not sticky for the session', () => {
    assert.ok(src.includes('YouTube API timed out after 15s, using iframe until it loads'));
    assert.ok(!src.includes('timed out after 25 retries'));
    assert.ok(!src.includes('L=!0'));
    assert.ok(src.includes('tctvUpgradeToApiPlayer'));
    assert.ok(src.includes('YouTube API ready, upgrading to YT.Player'));
    assert.ok(src.includes('tctvWatchForApiUpgrade'));
    assert.ok(src.includes('tctvLoadYtApi'));
    assert.ok(src.includes('onYouTubeIframeAPIReady'));
});

test('the iframe fallback enables the JS API and exposes a player shim', () => {
    assert.ok(src.includes('enablejsapi=1'));
    assert.ok(src.includes('tctvIframeShim'));
    assert.ok(src.includes('window._tctvYtPlayer=tctvIframeShim'));
    assert.ok(src.includes('_tctvPlayerMode="iframe"'));
    assert.ok(src.includes('event:"listening"'));
    assert.ok(src.includes('getPlayerState:function(){return state}'));
});

test('a below-player retry note is used, never an overlay on the video', () => {
    assert.ok(src.includes('Watch credit needs the full player. Tap to retry'));
    assert.ok(src.includes('tctv-reward-note'));
    assert.ok(src.includes('host.parentNode.insertBefore(el,host.nextSibling)') || src.includes('host.parentNode.insertBefore(el, host.nextSibling)'));
    assert.ok(html.includes('#tctv-reward-note'));
    assert.ok(html404.includes('#tctv-reward-note'));
    assert.ok(!/#tctv-reward-note\s*\{[^}]*position:\s*(absolute|fixed)/.test(html));
    assert.ok(src.includes('window._tctvRetryPlayer'));
});

test('tctvParseYtMessage reads official and infoDelivery state events', () => {
    const start = src.indexOf('function tctvParseYtMessage');
    const end = src.indexOf('function tctvIframeShim');
    assert.ok(start !== -1 && end > start);
    const sandbox = { console: console };
    vm.createContext(sandbox);
    vm.runInContext(src.slice(start, end), sandbox);
    const parse = sandbox.tctvParseYtMessage;
    assert.strictEqual(parse('{"event":"onStateChange","info":1}').state, 1);
    assert.strictEqual(parse({ event: 'infoDelivery', info: { playerState: 2, currentTime: 12.5 } }).state, 2);
    assert.strictEqual(parse({ event: 'infoDelivery', info: { playerState: 2, currentTime: 12.5 } }).time, 12.5);
    assert.strictEqual(parse({ event: 'onReady' }).state, 1);
    assert.strictEqual(parse({ event: 'command', func: 'onStateChange', args: [0] }).state, 0);
    assert.strictEqual(parse('not-json'), null);
    assert.strictEqual(parse(''), null);
});

test('an iframe shim sets window._tctvYtPlayer state from postMessage and can retry', () => {
    const start = src.indexOf('function tctvEnsurePlayerState');
    const end = src.indexOf('function q(i,t)');
    assert.ok(start !== -1 && end > start);
    const listeners = {};
    const iframe = {
        id: 'tctv-player',
        contentWindow: { posts: [], postMessage: function (msg) { this.posts.push(msg); } },
        addEventListener: function (name, fn) { this['on' + name] = fn; },
        parentNode: { removeChild: function () {} }
    };
    const notes = [];
    const sandbox = {
        console: { warn: function () {} },
        window: {
            YT: undefined,
            addEventListener: function (name, fn) { listeners[name] = fn; },
            removeEventListener: function (name, fn) { if (listeners[name] === fn) delete listeners[name]; },
            _tctvRewardNote: function (opts) { notes.push(opts && opts.text); }
        },
        document: {
            getElementById: function () { return null; }
        },
        setTimeout: function (fn) { return 0; },
        setInterval: function () { return 1; },
        clearInterval: function () {},
        ei: function () {}
    };
    sandbox.window.window = sandbox.window;
    vm.createContext(sandbox);
    vm.runInContext(src.slice(start, end), sandbox);
    const shim = sandbox.tctvIframeShim(iframe, 'abc', 3);
    assert.strictEqual(shim.getPlayerState(), null);
    listeners.message({ origin: 'https://evil.example', data: '{"event":"onStateChange","info":1}' });
    assert.strictEqual(shim.getPlayerState(), null, 'ignores non-YouTube origins');
    listeners.message({ origin: 'https://www.youtube.com', data: '{"event":"onStateChange","info":1}' });
    assert.strictEqual(shim.getPlayerState(), 1);
    assert.strictEqual(shim.getCurrentTime(), 3);
    listeners.message({ origin: 'https://www.youtube.com', data: { event: 'infoDelivery', info: { playerState: 1, currentTime: 9 } } });
    assert.strictEqual(shim.getCurrentTime(), 9);
    shim.playVideo();
    assert.ok(iframe.contentWindow.posts.some(function (m) { return String(m).indexOf('playVideo') !== -1; }));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
