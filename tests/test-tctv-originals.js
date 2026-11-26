// Legal conditions for the Timechain TV 10-minute daily task:
// Originals-only credit, thin-library hide, Terms/card copy, catalog sync.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const server = require('../functions/src/tctvOriginals');
const client = require('../tctv-originals.js');
const watch = require('../functions/src/tctvWatch');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (err) {
        console.log('❌ ' + name + ': ' + err.message);
        failed++;
    }
}

function read(rel) {
    return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

const TASK_CARD = 'Watch 10 minutes of Bitcoin Quest Originals today to earn 100 XP and 1 OrangeTix. Only Bitcoin Quest Original videos count; other videos on Timechain TV are just for watching.';
const TERMS_LINE = 'Timechain TV daily task: earned only by watching Bitcoin Quest Original videos we host. Videos from YouTube or other third-party channels never earn XP, OrangeTix, sats, or other rewards. Rewards are fixed, capped daily, and require active playback.';
const SIGNUP_LINE = 'Watching free. Sign up free for quests, trivia and more.';

test('the published Originals catalog is empty and the task is hidden', () => {
    assert.strictEqual(server.count(), 0);
    assert.strictEqual(server.totalDurationSeconds(), 0);
    assert.strictEqual(server.taskEnabled(), false);
    assert.strictEqual(server.isOriginal('dQw4w9WgXcQ'), false);
    assert.strictEqual(server.isOriginal(''), false);
    assert.strictEqual(client.count(), 0);
    assert.strictEqual(client.taskEnabled(), false);
});

test('the browser catalog stays in sync with the server catalog', () => {
    assert.strictEqual(client.MIN_ORIGINALS_FOR_TASK, server.MIN_ORIGINALS_FOR_TASK);
    assert.strictEqual(client.MIN_DURATION_SECONDS_FOR_TASK, server.MIN_DURATION_SECONDS_FOR_TASK);
    assert.deepStrictEqual(client.list(), server.list());
    assert.strictEqual(client.TASK_CARD, server.TASK_CARD);
    assert.strictEqual(client.TASK_CARD, TASK_CARD);
    assert.strictEqual(client.TERMS_REWARDS, TERMS_LINE);
    assert.strictEqual(server.TERMS_REWARDS, TERMS_LINE);
});

test('the task stays hidden until there are enough Originals by count and duration', () => {
    assert.strictEqual(server.MIN_ORIGINALS_FOR_TASK, 1);
    assert.strictEqual(server.MIN_DURATION_SECONDS_FOR_TASK, 600);
    server.ORIGINALS.push({ id: 'short', title: 'short', durationSeconds: 59, rights: 'BQ' });
    try {
        assert.strictEqual(server.count(), 1);
        assert.strictEqual(server.taskEnabled(), false);
        server.ORIGINALS[0].durationSeconds = 600;
        assert.strictEqual(server.taskEnabled(), true);
        assert.strictEqual(server.isOriginal('short'), true);
        assert.strictEqual(server.isOriginal('youtube-id'), false);
    } finally {
        server.ORIGINALS.pop();
        assert.strictEqual(server.taskEnabled(), false);
        assert.strictEqual(server.count(), 0);
    }
});

test('rewards stay fixed at 100 XP and 1 OrangeTix with no sats or random roll', () => {
    assert.strictEqual(watch.REWARD_XP, 100);
    assert.strictEqual(watch.REWARD_TICKETS, 1);
    const logic = read('functions/src/tctvWatch.js');
    const callable = read('functions/tctv-watch-callable.js');
    assert.ok(logic.includes('const REWARD_XP = 100;'));
    assert.ok(!callable.includes('Math.random'));
    assert.ok(!logic.includes('sats'));
    assert.ok(callable.includes("ticketGrants.claimId('tctv_watch_ticket'"));
});

test('Terms and the task card use Legal\'s copy', () => {
    const terms = read('terms.html');
    const tctvTerms = read('tctv-terms.html');
    const html = read('index.html');
    const clientWatch = read('tctv-watch.js');
    assert.ok(terms.includes(TERMS_LINE));
    assert.ok(tctvTerms.includes(TERMS_LINE));
    assert.ok(html.includes(TASK_CARD));
    assert.ok(clientWatch.includes(TASK_CARD));
    assert.ok(terms.includes('America/New_York'));
    assert.ok(!terms.includes('once per reward day for 10 credited minutes of Timechain TV'));
});

test('the share row uses the Lucide share-2 icon and the approved sign-up line', () => {
    const chrome = read('tctv-chrome.js');
    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    assert.ok(chrome.includes(SIGNUP_LINE));
    assert.ok(!chrome.includes('No ads from us'));
    assert.ok(!html.includes('No ads from us'));
    assert.ok(chrome.includes('lucide-share-2'));
    assert.ok(chrome.includes('class="lucide lucide-share-2"'));
    assert.ok(chrome.includes("wrap.insertBefore(existing, host.nextSibling)"));
    assert.ok(!chrome.includes('position:absolute') && !chrome.includes('position:fixed') && !chrome.includes("position: 'fixed'"));
    assert.ok(html.includes('tctv-chrome.js?v=20261125_v2692'));
    assert.ok(html.includes('.tctv-chrome'));
    assert.ok(html.includes('position: static'));
});

test('timer-fix App Check and retry notes are still in place', () => {
    const clientWatch = read('tctv-watch.js');
    const player = read('timechain-tv.js');
    assert.ok(clientWatch.includes('window._btcAppCheckForClaim(8000)'));
    assert.ok(clientWatch.includes("Can't verify this browser, rewards paused"));
    assert.ok(clientWatch.includes("console.warn('[TCTV] tctvWatchHeartbeat failed'"));
    assert.ok(clientWatch.includes('function fail(err)'));
    assert.ok(player.includes('tctvWatchForApiUpgrade') || player.includes('Watch credit needs the full player'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
