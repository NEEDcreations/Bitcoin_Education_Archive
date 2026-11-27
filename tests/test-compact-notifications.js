#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

function test(name, fn) {
    return Promise.resolve().then(fn).then(function() {
        console.log('✅ ' + name);
    }).catch(function(err) {
        console.log('❌ ' + name + ': ' + err.message);
        throw err;
    });
}

const tests = [];
function add(name, fn) { tests.push(test(name, fn)); }

add('index.html and 404.html match, and pins are v2737', function() {
    const index = read('index.html');
    const html404 = read('404.html');
    assert.strictEqual(index, html404);
    const sw = read('sw.js');
    assert.ok(sw.includes("const CACHE_NAME = 'btc-archive-v2737'"));
    assert.ok(!sw.includes("const CACHE_NAME = 'btc-archive-v2690'"));
    assert.ok(index.includes('notifications.js?v=20261127_v2737'));
    assert.ok(!index.includes('notifications.js?v=20261106_v2512'));
});

add('the wallet row is Sats, Withdraw, Invites', function() {
    const html = read('index.html');
    const sats = html.indexOf('id="homeSatsTile"');
    const withdraw = html.indexOf('id="homeWithdrawTile"');
    const invites = html.indexOf('id="homeInvitesTile"');
    const tip = html.indexOf('id="homeInvitesInfoText"');
    assert.ok(sats > 0 && withdraw > sats && invites > withdraw);
    assert.ok(tip > invites);
    const stripStart = html.indexOf('id="homeWalletStrip"');
    const stripEnd = html.indexOf('</div>', html.indexOf('id="homeWithdrawTile"') > invites ? html.indexOf('id="homeInvitesTile"') : withdraw);
    // Withdraw sits between Sats and Invites in the strip.
    assert.ok(html.includes('grid-template-columns:minmax(0,1fr) minmax(0,1.15fr) minmax(0,1fr)'));
    assert.ok(!html.includes('grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1.15fr)'));
    // The tooltip lives inside the Invites tile so it does not take a grid cell.
    const tileStart = html.indexOf('id="homeInvitesTile"');
    const tileEnd = html.indexOf('</div>', html.indexOf('id="homeInvitesInfo"'));
    assert.ok(tip > tileStart && tip < tileEnd);
});

add('a decided notifications banner shrinks to a compact button', function() {
    const js = read('notifications.js');
    assert.ok(js.includes("id = 'homePushCompact'"));
    assert.ok(js.includes("classList.add('is-compact')"));
    assert.ok(js.includes("function hasPushDecision"));
    assert.ok(js.includes("function markPushDecision"));
    assert.ok(js.includes("btc_home_push_decided"));
    assert.ok(js.includes('#homePush.is-compact:not(.is-open) .home-push-bar'));
    assert.ok(js.includes("if (state === 'on') return true"));
    assert.ok(js.includes('markPushDecision()'));
});

Promise.all(tests).then(function(rows) {
    console.log('---\nPassed: ' + rows.length + '  Failed: 0');
}).catch(function() {
    process.exit(1);
});
