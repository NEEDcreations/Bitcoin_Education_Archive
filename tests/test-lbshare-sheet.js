// Share my rank uses the in-app share sheet, reads the cached snapshot first,
// and never waits twice for App Check or auto-opens the OS share sheet.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const r = fs.readFileSync(path.join(__dirname, '..', 'ranking.js'), 'utf8');
const a = fs.readFileSync(path.join(__dirname, '..', 'achievement-share.js'), 'utf8');
const start = r.indexOf('window._lbShareRank = async function');
const body = r.slice(start, r.indexOf('// Close leaderboard when clicking', start));
assert.ok(start > 0);
assert.ok(body.includes('AS.openCanvasSheet('), 'opens in-app sheet');
assert.ok(!body.includes('navigator.share('), 'no automatic native share');
assert.ok(body.includes("e.name === 'AbortError'"), 'cancel is quiet');
const look = r.slice(r.indexOf('async function _lbShareLookup'), r.indexOf('function _lbShareFit('));
assert.ok(!look.includes('_btcAppCheckForClaim'), 'no second App Check wait');
assert.ok(look.indexOf('_lbShareSnapRow(') < look.indexOf("httpsCallable('leaderboardRank')"), 'snapshot first');
assert.ok(a.includes('openCanvasSheet: openCanvasSheet'));
assert.ok(/if \(url\.indexOf\(SITE\) !== 0\) url = SITE;/.test(a), 'sheet link stays on our site');
const AS = require('../achievement-share.js');
assert.strictEqual(typeof AS.openCanvasSheet, 'function');
console.log('test-lbshare-sheet: all passed');
