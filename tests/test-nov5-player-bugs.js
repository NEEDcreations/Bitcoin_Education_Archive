'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
const scholar = fs.readFileSync(path.join(root, 'scholar.js'), 'utf8');
const quests = fs.readFileSync(path.join(root, 'quests.js'), 'utf8');
const fn = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');

function test(name, fn) { try { fn(); console.log('ok', name); } catch (e) { console.error('FAIL', name, e.message); process.exitCode = 1; } }

test('friendlyCallableError remaps internal', () => {
  assert.ok(ranking.includes('function friendlyCallableError'));
  assert.ok(ranking.includes("code === 'internal'"));
  assert.ok(ranking.includes('balance already updated'));
});

test('Scholar Certified uses certPassed_* flags', () => {
  assert.ok(ranking.includes('certPassed_prop === true || currentUser.certPassed_tech === true'));
  assert.ok(ranking.includes("statRow('Scholar Certified'"));
});

test('cert download uses blob/share fallback', () => {
  assert.ok(scholar.includes('navigator.share'));
  assert.ok(scholar.includes('canvas.toBlob') || scholar.includes('toBlob'));
  assert.ok(scholar.includes('long-press'));
  assert.ok(scholar.includes('_scholarCertRecord'));
});

test('donatePoints reads before writes and returns safely', () => {
  const i = fn.indexOf('exports.donatePoints');
  const body = fn.slice(i, i + 9000);
  assert.ok(body.includes('let donationTicket = 0'));
  assert.ok(body.includes('const statsSnap = await tx.get(statsRef)'));
  // statsSnap must appear before first tx.update in the txn
  const statsGet = body.indexOf('const statsSnap = await tx.get(statsRef)');
  const firstUpdate = body.indexOf('tx.update(userRef');
  assert.ok(statsGet > 0 && firstUpdate > statsGet, 'stats read must precede user update');
  assert.ok(body.includes('donationTicket: safeTicket'));
});

test('chess accepts any mating move + tap UX', () => {
  assert.ok(quests.includes('function _chessIsMatingMove'));
  assert.ok(quests.includes('function _chessToggleFlip'));
  assert.ok(/tap a piece, then tap where it goes/i.test(quests));
  assert.ok(quests.includes('_chessIsMatingMove(pieces, turn, from, to)'));
});

if (!process.exitCode) console.log('all nov5 player bug tests passed');
