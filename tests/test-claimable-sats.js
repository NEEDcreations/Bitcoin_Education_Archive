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
    const premium = loadClaimable(true);
    assert.strictEqual(premium.getSatCap(), 15000);
    const rich = premium.claimableSats({ points: 300000, satsWithdrawn: 0 });
    assert.strictEqual(rich.cap, 15000);
    assert.strictEqual(rich.claimable, 15000);
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
    assert.ok(ranking.includes('Math.min(Number(snap.claimable) || 0, 200'));
    assert.ok(!ranking.includes('function homePreviewAllowed'));
    assert.ok(!ranking.includes('_homePreviewUser'));
    assert.ok(!ranking.includes("host === 'localhost'"));
    const tickets = read('tickets.js');
    assert.ok(!tickets.includes('_invitePreviewOn'));
    assert.ok(!tickets.includes('_homePreviewUser'));
    const bundle = read('bundle.min.js');
    assert.ok(!bundle.includes('_invitePreviewOn'));
    assert.ok(!bundle.includes('_homePreviewUser'));
    assert.ok(!bundle.includes('homePreviewAllowed'));
    const devPreview = read('dev/home-preview.js');
    assert.ok(devPreview.includes('function homePreviewAllowed'));
    assert.ok(devPreview.includes("host === 'localhost'"));
    assert.ok(devPreview.includes('_homePreviewUser'));
    assert.ok(devPreview.includes('function _invitePreviewOn'));
    const html = read('index.html');
    assert.ok(!html.includes('home-preview.js'));
    assert.ok(!read('build.sh').includes('home-preview.js'));
    assert.ok(!read('sw.js').includes('home-preview.js'));
    const app = read('app.js');
    assert.ok(app.includes("querySelectorAll('.ch-btn')"));
    assert.ok(app.includes('toggleMobileLearnMenu'));
    assert.ok(!app.includes("return slug.replace"));
    const src = read('onboarding.js.src');
    assert.ok(src.includes("setExperienceMode('advanced')"));
    assert.ok(!src.includes("setExperienceMode('intermediate')"));
    assert.ok(src.includes('homeLearnCard'));
});

test('no premium cap, learn titles, consent labels, and the xp scale', () => {
    const utils = read('utils.js');
    assert.ok(!utils.includes('function isPremium'));
    assert.ok(!utils.includes('PREMIUM_SAT_CAP'));
    assert.ok(utils.includes('SAT_LIFETIME_CAP = 15000'));
    const app = read('app.js');
    const start = app.indexOf('function prettyLearnTitle');
    const end = app.indexOf('function homeLearnTitle');
    assert.ok(start > 0 && end > start);
    const pretty = new Function(app.slice(start, end) + '\nreturn prettyLearnTitle;')();
    assert.strictEqual(pretty('\u2714 use-cases'), 'Use Cases');
    assert.strictEqual(pretty('📄 whitepaper'), 'Whitepaper');
    assert.strictEqual(pretty('👪 decentralized-censorship-resistant'), 'Decentralized Censorship Resistant');
    assert.strictEqual(pretty('™ secure-fungible'), 'Secure Fungible');
    assert.strictEqual(pretty('💯 100 Sats'), '100 Sats');
    const html = read('index.html');
    assert.ok(html.includes('<label class="consent-row" id="tosConsentRow">'));
    assert.ok(html.includes('<label class="tos-check-row" id="signupConsentRow">'));
    assert.ok(html.indexOf('id="tosModalCheck"') > html.indexOf('id="tosConsentRow"'));
    assert.ok(html.indexOf('id="signupTosCheck"') > html.indexOf('id="signupConsentRow"'));
    assert.ok(html.includes('.daily-xp-scale { position: relative; height: 22px;'));
    assert.ok(!html.includes('.daily-xp-scale { display: flex'));
    assert.ok(!html.includes('id="todayEarnFavor"'));
    assert.ok(!html.includes('#todayEarnFavor'));
    assert.ok(!html.includes('>Earn Favor</button>'));
    assert.ok(html.includes("event.key==='Enter'||event.key===' '"));
    const ranking = read('ranking.js');
    assert.ok(ranking.includes('Lifetime withdrawn: \' + satsWithdrawn.toLocaleString() + \' / 15,000 sats'));
    assert.ok(ranking.includes('Lifetime max: 15,000 sats'));
});

test('terms sheet blocks the page and the consent row is a real tap target', () => {
    const html = read('index.html');
    assert.ok(html.includes('z-index:2100010'));
    assert.ok(html.includes('Tick the box to agree first.'));
    assert.ok(html.includes('align-self:stretch'));
    assert.ok(html.includes('min-height:48px'));
    assert.ok(html.includes('width:24px; height:24px'));
    assert.ok(html.includes('id="tosConsentRow"'));
    assert.ok(html.includes('id="signupConsentRow"'));
    assert.ok(html.includes('id="headerSearchBtn"'));
    assert.ok(html.includes('max-height:calc(100dvh - 24px)'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
