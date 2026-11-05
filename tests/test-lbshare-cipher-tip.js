'use strict';
// Share-my-rank buttons, cipher withdraw hint, and faucet requirements copy.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('✅ ' + name); } catch (e) { fail++; console.log('❌ ' + name + ': ' + e.message); } }

const ranking = read('ranking.js');
const cipherSats = require('../functions/src/cipherSatsClaim');

test('client cipher rules match the server claim constants', () => {
    const m = ranking.match(/CIPHER_SATS_RULES = \{ min: (\d+), max: (\d+), perDay: (\d+), ageDays: (\d+) \}/);
    assert.ok(m);
    assert.strictEqual(Number(m[1]), cipherSats.CLAIM_MIN);
    assert.strictEqual(Number(m[2]), cipherSats.CLAIM_MAX);
    assert.strictEqual(Number(m[3]), cipherSats.PLAYER_DAILY_CAP);
    assert.ok(read('functions/src/cipherClaim.js').includes('MIN_ACCOUNT_AGE_DAYS = ' + m[4] + ';'));
});

test('cipher hint shows on settings, inventory and gifting surfaces', () => {
    assert.ok(ranking.includes('html += window.cipherSatsHintHtml(cipherBal);'));
    assert.ok(read('quests.js').includes('window.cipherSatsHintHtml(_cipherBal)'));
    assert.ok(read('gifting.js').includes("hint.textContent = '\\u24d8 ' + window.cipherSatsWithdrawHint(bal);"));
});

test('every board gets a share button, signed-in only', () => {
    assert.ok(ranking.includes("_lbShareBtn(board) +"));
    assert.ok(ranking.includes("_lbShareBtn('pvp') +"));
    assert.ok(/function _lbShareSignedIn\(\)[\s\S]{0,200}isAnonymous/.test(ranking));
});

test('share link uses the user referral code and src=lbshare', () => {
    assert.ok(ranking.includes("'https://bitcoineducation.quest/?ref=' + encodeURIComponent(code) + '&src=lbshare'"));
    assert.ok(ranking.includes("getReferralCode()"));
});

test('share lookup is read-only and uses leaderboardRank me', () => {
    const start = ranking.indexOf('// ── Share my rank');
    const block = ranking.slice(start, ranking.indexOf('// Close leaderboard when clicking/tapping outside.'));
    assert.ok(block.includes("httpsCallable('leaderboardRank')({ board: board, period: period, me: true })"));
    assert.ok(!/\.set\(|\.update\(|\.add\(|httpsCallable\('(?!leaderboardRank)/.test(block));
    assert.ok(!/®/.test(block));
    assert.ok(!/innerHTML/.test(block));
});

test('faucet requirements list matches claimSats gates', () => {
    const idx = read('functions/index.js');
    assert.ok(idx.includes('MIN_ACCOUNT_AGE_DAYS: 7,') && idx.includes('MIN_CHANNELS_READ: 10,') && idx.includes('MAX_LIFETIME_PER_USER_SATS: 15000,') && idx.includes('COOLDOWN_HOURS: 24,'));
    ['Lightning Address saved', '1 claim every 24 hours', 'Lifetime limit 15,000 sats', 'Account in good standing', 'Minimum 100 sats (1,000 XP)'].forEach((s) => assert.ok(ranking.includes(s), s));
    assert.ok(read('terms.html').includes('a saved Lightning Address, one account per person'));
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
