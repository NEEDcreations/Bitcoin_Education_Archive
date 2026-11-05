#!/usr/bin/env node
'use strict';
/**
 * Favorite apps — max 2, whitelist, toggle, localStorage.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const store = Object.create(null);
const localStorage = {
  getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem(k, v) { store[k] = String(v); },
  removeItem(k) { delete store[k]; }
};

function el() {
  return {
    style: {},
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    setAttribute() {},
    getAttribute() { return null; },
    appendChild() {},
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    textContent: '',
    firstChild: null,
    removeChild() {},
    insertBefore() {},
    parentNode: null,
    isConnected: true
  };
}

const document = {
  readyState: 'complete',
  addEventListener() {},
  getElementById() { return null; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  createElement() { return el(); },
  body: el(),
  head: el(),
  documentElement: el()
};

const windowObj = {
  localStorage,
  document,
  BQ_EXPLORE_APPS: [
    { id: 'nacho', emoji: '🦌', title: 'Nacho Mode', kind: 'fn', arg: 'enterNachoMode' },
    { id: 'pop', emoji: '🕹️', title: 'Proof of Play', kind: 'pop' },
    { id: 'forum', emoji: '🗣️', title: 'Pleb Talk', kind: 'go', arg: 'forum' },
    { id: 'market', emoji: '⚡', title: 'Lightning Mart', kind: 'go', arg: 'marketplace' },
    { id: 'irl', emoji: '🤝', title: 'IRL Sync', kind: 'go', arg: 'irl-sync' },
    { id: 'beats', emoji: '🎵', title: 'Bitcoin Beats', kind: 'go', arg: 'bitcoin-beats' },
    { id: 'tv', emoji: '📺', title: 'Timechain TV', kind: 'go', arg: 'timechain-tv' },
    { id: 'pow', emoji: '👟', title: 'Proof of Walk', kind: 'fn', arg: 'showProofOfWalk' },
    { id: 'wallet', emoji: '⚡', title: 'Wallet', kind: 'go', arg: 'wallet' }
  ],
  addEventListener() {},
  MutationObserver: function () { this.observe = function () {}; },
  showToast() {},
  setTimeout,
  clearTimeout,
  console
};
windowObj.window = windowObj;

const code = fs.readFileSync(path.join(__dirname, '..', 'favorites.js'), 'utf8');
vm.runInNewContext(code, {
  window: windowObj,
  document,
  localStorage,
  console,
  setTimeout,
  clearTimeout,
  MutationObserver: windowObj.MutationObserver
});


function listEq(actual, expected) {
  assert.deepStrictEqual(Array.from(actual || []), expected);
}
assert.strictEqual(typeof windowObj.getFavoriteApps, 'function');
listEq(windowObj.getFavoriteApps(), []);

let r = windowObj.toggleFavoriteApp('nacho');
assert.strictEqual(r.ok, true);
listEq(r.list, ['nacho']);
assert.strictEqual(windowObj.isFavoriteApp('nacho'), true);

r = windowObj.toggleFavoriteApp('tv');
assert.strictEqual(r.ok, true);
listEq(windowObj.getFavoriteApps(), ['nacho', 'tv']);

r = windowObj.toggleFavoriteApp('wallet');
assert.strictEqual(r.ok, false);
assert.strictEqual(r.reason, 'limit');
listEq(windowObj.getFavoriteApps(), ['nacho', 'tv']);

r = windowObj.toggleFavoriteApp('nacho');
assert.strictEqual(r.ok, true);
listEq(windowObj.getFavoriteApps(), ['tv']);

r = windowObj.toggleFavoriteApp('not-real');
assert.strictEqual(r.ok, false);
assert.strictEqual(r.reason, 'unknown');

windowObj.setFavoriteApps(['tv', 'beats', 'wallet', 'tv']);
listEq(windowObj.getFavoriteApps(), ['tv', 'beats']);

windowObj.setFavoriteApps(['evil', 'nacho']);
listEq(windowObj.getFavoriteApps(), ['nacho']);

assert.ok(Array.isArray(windowObj.BQ_FAVORITE_APP_IDS));
assert.strictEqual(windowObj.BQ_FAVORITE_APP_IDS.length, 9);

console.log('test-favorites: ok');
