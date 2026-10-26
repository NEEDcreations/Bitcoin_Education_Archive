// Claimable sats share one lifetime cap with the server faucet.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

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

function loadClaimable(premium) {
    const utils = read('utils.js');
    const start = utils.indexOf('var SAT_LIFETIME_CAP');
    const marker = 'window.claimableSats = claimableSats;';
    const end = utils.indexOf(marker);
    assert.ok(start > 0 && end > start, 'claimableSats block missing');
    const chunk = utils.slice(start, end + marker.length);
    const fn = new Function('isPremium', 'window', chunk + '\nreturn { SAT_LIFETIME_CAP: SAT_LIFETIME_CAP, getSatCap: getSatCap, claimableSats: claimableSats };');
    return fn(function () { return !!premium; }, global);
}

test('lifetime cap matches the server faucet', () => {
    const api = loadClaimable(false);
    const server = read('functions/index.js');
    const cap = server.match(/MAX_LIFETIME_PER_USER_SATS:\s*(\d+)/);
    assert.ok(cap, 'server cap missing');
    assert.strictEqual(api.SAT_LIFETIME_CAP, 15000);
    assert.strictEqual(api.SAT_LIFETIME_CAP, Number(cap[1]));
    assert.strictEqual(api.getSatCap(), 15000);
    assert.strictEqual(loadClaimable(true).getSatCap(), 21000);
});

test('users past 10k withdrawn still see claimable sats', () => {
    const api = loadClaimable(false);
    const over = api.claimableSats({ points: 200000, satsWithdrawn: 12000 }, 15000);
    assert.strictEqual(over.balance, 20000);
    assert.strictEqual(over.lifetimeLeft, 3000);
    assert.strictEqual(over.claimable, 3000);
    const under = api.claimableSats({ points: 5000, satsWithdrawn: 12000 }, 15000);
    assert.strictEqual(under.balance, 500);
    assert.strictEqual(under.claimable, 500);
    const oldBug = api.claimableSats({ points: 200000, satsWithdrawn: 12000 }, 10000);
    assert.strictEqual(oldBug.claimable, 0);
    const home = api.claimableSats({ points: 12340 }, 15000);
    assert.strictEqual(home.claimable, 1234);
});

test('ranking no longer falls back to a 10000 cap', () => {
    const ranking = read('ranking.js');
    assert.ok(!ranking.includes('getSatCap() : 10000'));
    assert.ok(!ranking.includes('? 10000'));
    assert.ok(ranking.includes('function lifetimeSatCap'));
    assert.ok(ranking.includes('return 15000'));
});

test('terms sheet blocks the page and the consent row is a real tap target', () => {
    const html = read('index.html');
    assert.ok(html.includes('z-index:2100010'));
    assert.ok(html.includes('Tick the box to agree first'));
    assert.ok(html.includes('min-height:48px'));
    assert.ok(html.includes('width:24px; height:24px'));
    assert.ok(html.includes('id="tosConsentRow"'));
    assert.ok(html.includes('id="signupConsentRow"'));
    assert.ok(html.includes('max-height:calc(100dvh - 24px)'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
