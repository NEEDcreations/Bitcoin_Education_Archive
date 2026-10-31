#!/usr/bin/env node
// Every mini app share: one referral link, deep link in that link, validated params.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root, name), 'utf8'); }

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e)); failed++; }
}

function grab(src, name) {
    const re = new RegExp('function ' + name + '\\s*\\([^)]*\\)\\s*\\{');
    const m = re.exec(src);
    if (!m) throw new Error('missing function ' + name);
    let i = m.index + m[0].length;
    let depth = 1;
    while (i < src.length && depth) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') depth--;
        i++;
    }
    return src.slice(m.index, i);
}

const ticketsSrc = read('tickets.js');
const sandbox = { encodeURIComponent: encodeURIComponent };
vm.createContext(sandbox);
vm.runInContext(grab(ticketsSrc, 'stripShareLinks'), sandbox);
global.stripShareLinks = sandbox.stripShareLinks;

const api = require('../miniapp-share.js');
const share = require('../achievement-share.js');
const CODE = 'abc12345';

function linkCount(text) {
    return (String(text || '').match(/https?:\/\/[^\s<>"')]+|bitcoineducation\.quest/gi) || []).length;
}

test('every mini app posts one referral link and the example sentence', () => {
    assert.strictEqual(api.shareGrantsReward(), false);
    assert.strictEqual(share.shareGrantsReward(), false);
    api.APPS.forEach(function (app) {
        const ctx = Object.assign({ code: CODE }, app.ctx);
        const model = api.shareModel(app.id, ctx);
        assert.strictEqual(model.sentence, app.sentence, app.id);
        assert.strictEqual(model.hash, app.hash, app.id);
        assert.strictEqual(linkCount(model.sentence), 0, app.id + ' sentence');
        const post = api.postText(model);
        assert.strictEqual(linkCount(post), 1, app.id + ' post');
        assert.strictEqual((post.match(/bitcoineducation\.quest/gi) || []).length, 1, app.id + ' domain');
        assert.ok(post.startsWith(model.sentence + '\n'), app.id);
        assert.strictEqual(model.url, 'https://bitcoineducation.quest/?ref=' + CODE + '#' + app.hash, app.id);
        const landing = api.splitLanding(model.url);
        assert.strictEqual(landing.ref, CODE, app.id);
        assert.strictEqual(landing.hash, app.hash, app.id);
        const guest = api.shareModel(app.id, Object.assign({ code: '' }, app.ctx));
        assert.strictEqual(guest.sentence, app.sentence, app.id + ' guest');
        assert.strictEqual(guest.url.includes('ref='), false, app.id + ' guest ref');
        assert.strictEqual(guest.url, 'https://bitcoineducation.quest/#' + app.hash, app.id + ' guest url');
        assert.strictEqual(linkCount(api.postText(guest)), 1, app.id + ' guest post');
        ['timechainarcade.com', 'galaxymind.space', 'ryracer.com', 'github.io'].forEach(function (host) {
            assert.strictEqual(model.url.includes(host), false, app.id + ' ' + host);
            assert.strictEqual(model.sentence.includes(host), false, app.id + ' text ' + host);
        });
    });
});

test('Timechain TV validates the channel and keeps the real name', () => {
    const health = api.shareModel('tctv', { channel: 'health-fitness', code: CODE });
    assert.strictEqual(health.sentence, "I'm watching channel 10, Health, Fitness & Mindfulness on Timechain TV! Check it out!");
    assert.strictEqual(health.hash, 'timechain-tv/health-fitness');
    assert.ok(health.sentence.includes('&'));
    const byId = api.resolveTctv('health-fitness');
    assert.strictEqual(byId.station.n, 10);
    assert.strictEqual(byId.station.id, 'health-fitness');
    assert.strictEqual(byId.fallback, false);
    // Old numbered links stay on the station that had that number.
    const oldNine = api.resolveTctv('9');
    assert.strictEqual(oldNine.station.id, 'health-fitness');
    assert.strictEqual(oldNine.fallback, false);
    assert.strictEqual(api.shareModel('tctv', { channel: '9', code: CODE }).hash, 'timechain-tv/health-fitness');
    const docs = api.resolveTctv('history');
    assert.strictEqual(docs.station.n, 7);
    assert.strictEqual(docs.station.name, 'Documentaries & History');
    assert.strictEqual(api.resolveTctv('10').station.id, 'history');
    assert.strictEqual(api.resolveTctv('7').station.id, 'economics-money');
    const zero = api.shareModel('tctv', { channel: '0', code: CODE });
    assert.strictEqual(zero.sentence, "I'm watching channel 0, Pleb Underground Unlimited on Timechain TV! Check it out!");
    assert.strictEqual(zero.hash, 'timechain-tv/pleb-underground');
    const names = api.FALLBACK_STATIONS.map(function (st) { return st.name; });
    assert.strictEqual(names[0], 'Pleb Underground Unlimited');
    const sorted = names.slice(1).slice().sort(function (a, b) { return a.localeCompare(b); });
    assert.deepStrictEqual(names.slice(1), sorted);
    const tv = read('timechain-tv.js');
    const ids = [];
    const idRe = /\{id:"([^"]+)",name:"([^"]+)"/g;
    let found;
    while ((found = idRe.exec(tv)) && ids.length < 22) ids.push(found[1] + '|' + found[2]);
    assert.deepStrictEqual(ids, api.FALLBACK_STATIONS.map(function (st) { return st.id + '|' + st.name; }));
    ['999', '9abc', '<script>', '9 ', 'health-fitness<script>'].forEach(function (bad) {
        const resolved = api.resolveTctv(bad);
        assert.strictEqual(resolved.fallback, true, bad);
        assert.strictEqual(resolved.station.n, 0, bad);
        assert.strictEqual(resolved.station.id, 'pleb-underground', bad);
        const dumped = JSON.stringify(resolved);
        assert.strictEqual(dumped.includes(bad), false, bad);
        assert.strictEqual(dumped.includes('<'), false, bad);
        const model = api.shareModel('tctv', { channel: bad, code: CODE });
        assert.strictEqual(model.hash, 'timechain-tv/pleb-underground', bad);
        assert.strictEqual(model.sentence.includes(bad), false, bad);
        assert.strictEqual(linkCount(api.postText(model)), 1, bad);
    });
    assert.strictEqual(api.resolveTctv('timechain-tv').absent, true);
    assert.strictEqual(api.resolveTctv('').absent, true);
    const picker = tv.slice(tv.indexOf('var d=r||function()'), tv.indexOf('var d=r||function()') + 500);
    assert.ok(picker.indexOf('_tctvDeepChannel') < picker.indexOf('tctv_lastStation'));
    const apply = tv.slice(tv.indexOf('window.tctvApplyDeepChannel='), tv.indexOf('window.tctvApplyDeepChannel=') + 420);
    assert.strictEqual(apply.includes('tctvRemoteSeek'), false);
    assert.strictEqual(apply.includes('seekTo(0)'), false);
    assert.ok(apply.includes('switchStation'));
    assert.ok(tv.includes('id="tctvShareBtn"'));
});

test('Bitcoin Beats strips links, caps fields, and drops an unknown track', () => {
    const dirty = api.shareModel('beats', {
        title: 'Visit https://evil.com/a and <b>Rock & Roll</b> "' + 'A'.repeat(80),
        artist: 'bad.example.com',
        trackId: 'track_1',
        code: CODE
    });
    assert.strictEqual(dirty.sentence.includes('http'), false);
    assert.strictEqual(dirty.sentence.includes('evil.com'), false);
    assert.strictEqual(dirty.sentence.includes('example.com'), false);
    assert.strictEqual(dirty.sentence.includes('<'), false);
    assert.ok(dirty.sentence.includes('Rock & Roll'));
    assert.ok(dirty.sentence.includes('by example'));
    const title = dirty.sentence.split(' by ')[0].replace("I'm listening to ", '');
    assert.ok(title.length <= 80, title.length);
    assert.ok(title.endsWith('\u2026'));
    const unknown = api.shareModel('beats', { title: 'Orange Pill', artist: 'Pleb Band', trackId: 'missing', knownIds: ['track123'], code: CODE });
    assert.strictEqual(unknown.sentence, "I'm listening on Bitcoin Beats! Check it out!");
    assert.strictEqual(unknown.hash, 'bitcoin-beats');
    const badId = api.shareModel('beats', { title: 'Orange Pill', artist: 'Pleb Band', trackId: 'bad id', code: CODE });
    assert.strictEqual(badId.hash, 'bitcoin-beats');
    assert.strictEqual(badId.sentence.includes('Orange Pill'), false);
    const quiet = api.shareModel('beats', { code: CODE });
    assert.strictEqual(quiet.sentence, "I'm listening on Bitcoin Beats! Check it out!");
    assert.strictEqual(quiet.hash, 'bitcoin-beats');
    assert.strictEqual(api.resolveBeats('9abc').ok, true);
    assert.strictEqual(api.resolveBeats('../etc').ok, false);
    assert.strictEqual(api.resolveBeats('a'.repeat(129)).ok, false);
    const beats = read('beats.js');
    assert.ok(beats.includes('id="beatsShareBtn"'));
    assert.ok(beats.includes("window.miniAppShare('beats'"));
    const trackFn = beats.slice(beats.indexOf('window.beatsShareTrack'), beats.indexOf('window.beatsShareTrack') + 800);
    assert.strictEqual(trackFn.includes('navigator.share'), false);
    global.beatsCensor = require('../beats-censor.js').beatsCensor;
    global.window = { _beatsShowUncensored: true };
    const masked = api.capField('fuck https://evil.com/track');
    assert.strictEqual(masked.includes('fuck'), false);
    assert.ok(masked.includes('f**k'));
    assert.strictEqual(masked.includes('evil.com'), false);
    const savedStrip = global.stripShareLinks;
    global.stripShareLinks = null;
    const local = api.capField('hear bad.example.com today');
    assert.strictEqual(local.includes('example.com'), false);
    assert.strictEqual(local.includes('http'), false);
    global.stripShareLinks = savedStrip;
});

test('arcade, galaxy, and RyRacer land on the in-app launcher', () => {
    assert.strictEqual(api.resolvePopTab('nope'), 'arcade');
    assert.strictEqual(api.resolvePopTab('proof-of-play/ryracer'), 'ryracer');
    assert.strictEqual(api.resolvePopTab('https://ryracer.com'), 'arcade');
    assert.strictEqual(api.shareModel('arcade', { code: CODE }).hash, 'proof-of-play/arcade');
    assert.strictEqual(api.shareModel('galaxy', { code: CODE }).hash, 'proof-of-play/galaxy');
    assert.strictEqual(api.shareModel('ryracer', { code: CODE }).hash, 'proof-of-play/ryracer');
    assert.strictEqual(api.shareModel('sat_arcade', { code: CODE }).hash, 'proof-of-play/sat_arcade');
    assert.strictEqual(api.shareModel('pop', { tab: 'arcade', code: CODE }).sentence, api.APPS.find(function (a) { return a.id === 'arcade'; }).sentence);
    const pop = read('proof-of-play.js');
    assert.ok(pop.includes('id="popShareBtn"'));
    assert.ok(pop.includes("hash.indexOf('#proof-of-play') === 0"));
});

test('experience mode hides the same apps the Explore menu hides', () => {
    ['tctv', 'nacho', 'ai', 'metrics', 'leaderboard', 'quests', 'favor', 'trails', 'learning', 'chat', 'lightning', 'first'].forEach(function (id) {
        assert.strictEqual(api.buttonVisible(id, 'beginner'), true, id);
        assert.strictEqual(api.buttonVisible(id, 'guided'), true, id);
        assert.strictEqual(api.buttonVisible(id, 'intermediate'), true, id);
        assert.strictEqual(api.buttonVisible(id, 'advanced'), true, id);
    });
    ['beats', 'pop', 'pvp', 'arcade', 'sat_arcade', 'galaxy', 'ryracer', 'forum', 'marketplace', 'irl', 'meetup'].forEach(function (id) {
        assert.strictEqual(api.buttonVisible(id, 'beginner'), false, id);
        assert.strictEqual(api.buttonVisible(id, 'guided'), false, id);
        assert.strictEqual(api.buttonVisible(id, 'intermediate'), true, id);
        assert.strictEqual(api.buttonVisible(id, 'advanced'), true, id);
        assert.strictEqual(api.buttonVisible(id, ''), true, id);
        assert.strictEqual(api.appHidden(id, 'lite'), true, id + ' lite');
        assert.strictEqual(api.buttonVisible(id, 'lite'), false, id + ' lite button');
    });
    ['ai', 'metrics', 'leaderboard', 'chat', 'favor'].forEach(function (id) {
        assert.strictEqual(api.buttonVisible(id, 'beginner'), true, id);
        assert.strictEqual(api.buttonVisible(id, 'lite'), false, id);
        assert.strictEqual(api.appHidden(id, 'lite'), true, id);
    });
    ['tctv', 'nacho', 'quests', 'trails', 'learning', 'lightning', 'first'].forEach(function (id) {
        assert.strictEqual(api.buttonVisible(id, 'lite'), true, id);
    });
    assert.strictEqual(api.buttonVisible('walk', 'advanced'), false);
    assert.strictEqual(api.appHidden('walk', 'beginner'), true);
    assert.strictEqual(api.appHidden('walk', 'lite'), true);
    assert.strictEqual(api.appHidden('walk', 'advanced'), false);
    assert.strictEqual(api.APPS.some(function (app) { return app.id === 'walk'; }), false);
});

test('the link sheet keeps the sentence and still grants nothing', () => {
    const sentence = "I'm watching channel 10, Health, Fitness & Mindfulness on Timechain TV! Check it out!";
    const url = 'https://bitcoineducation.quest/?ref=' + CODE + '#timechain-tv/health-fitness';
    const model = { linkShare: true, title: sentence, sentence: sentence, url: url };
    const text = share.shareText(model);
    assert.strictEqual(text, sentence + '\n' + url);
    assert.strictEqual(text.includes(share.SHARE_LINE), false);
    assert.strictEqual(text.includes('&'), true);
    assert.strictEqual(linkCount(text), 1);
    const payload = share.nativeSharePayload(model);
    assert.strictEqual(payload.url, undefined);
    assert.strictEqual(linkCount(payload.text), 1);
    const intent = share.xIntent(model);
    assert.strictEqual(intent.includes('&url='), false);
    assert.strictEqual(linkCount(decodeURIComponent(intent.split('text=')[1])), 1);
    const tg = share.telegramShare(model);
    assert.strictEqual(linkCount(tg.text), 0);
    assert.strictEqual(tg.text, sentence);
    assert.strictEqual(linkCount(tg.text + '\n' + tg.url), 1);
    const src = read('miniapp-share.js');
    ['awardPoints', 'claimSats', 'contributeRaid', 'logReferralVisit', 'btcClaimSessionPopup', 'tctvRemoteSeek', 'seekTo(0)'].forEach(function (word) {
        assert.strictEqual(src.includes(word), false, word);
    });
    assert.ok(read('achievement-share.js').includes('function openLinkSheet'));
});

test('a TCTV landing still stores the referral code for signup', () => {
    assert.ok(ticketsSrc.includes("localStorage.setItem('btc_referral_code', ref)"));
    assert.ok(ticketsSrc.includes('window.location.pathname + window.location.hash'));
    const attach = ticketsSrc.slice(ticketsSrc.indexOf('async function attachReferral'), ticketsSrc.indexOf('async function attachReferral') + 900);
    assert.ok(attach.includes("localStorage.getItem('btc_referral_code')"));
    assert.ok(attach.includes('registerReferral'));
    const landing = api.splitLanding('https://bitcoineducation.quest/?ref=abc12345#timechain-tv/health-fitness');
    assert.strictEqual(landing.ref, 'abc12345');
    assert.strictEqual(landing.hash, 'timechain-tv/health-fitness');
    const quests = api.shareModel('quests', { tab: 'favor', code: CODE });
    assert.strictEqual(quests.hash, 'favor');
    assert.strictEqual(quests.sentence, "I'm mining in Satoshi's Favor on Bitcoin Quest! Check it out!");
    assert.strictEqual(api.shareModel('chat', { code: CODE }).hash, 'chat');
});

test('pages ship the helper, one Latest line, and the v2447 cache', () => {
    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    assert.ok(html.includes('miniapp-share.js?v=20261031_v2447'));
    assert.ok(html.includes('achievement-share.js?v=20261031_v2447'));
    assert.ok(read('sw.js').includes("const CACHE_NAME = 'btc-archive-v2447'"));
    const notes = read('patch-notes.html');
    assert.strictEqual((notes.match(/Latest:/g) || []).length, 1);
    assert.ok(notes.includes('Latest: Search any player on the XP, Daily Streaks, Quests and Top Predictors leaderboards and see their exact rank, even outside the top 25.'));
    assert.ok(notes.includes('A returning signed-in player sees their home as soon as the page paints.'));
    assert.strictEqual(notes.includes('Latest: A returning signed-in player'), false);
    assert.ok(read('app.js').includes('window.miniAppConsumeHash'));
    assert.ok(read('pvp.js').includes('data-mini-share="pvp"'));
});

test('a live TCTV share uses the station on screen', () => {
    global.tctvCurrentStation = function () { return 'history'; };
    global._currentStation = '';
    const prevStore = global.localStorage;
    global.localStorage = { getItem: function () { return 'pleb-underground'; } };
    const model = api.open('tctv');
    assert.strictEqual(model.hash, 'timechain-tv/history');
    assert.strictEqual(model.sentence, "I'm watching channel 7, Documentaries & History on Timechain TV! Check it out!");
    delete global.tctvCurrentStation;
    global._currentStation = '';
    global.localStorage = prevStore;
    assert.ok(read('timechain-tv.js').includes('window.tctvCurrentStation=function(){return r||""}'));
});

test('hidden deep links fall back to home', () => {
    const prevStore = global.localStorage;
    const prevHome = global.goHome;
    const prevGo = global.go;
    const prevEnter = global.enterProofOfPlay;
    function mode(name) {
        global.localStorage = { getItem: function (key) { return key === 'btc_experience_mode' ? name : ''; } };
    }
    let homes = 0;
    global.goHome = function () { homes++; };
    mode('beginner');
    ['proof-of-play/arcade', 'proof-of-play/galaxy', 'proof-of-play/ryracer', 'proof-of-play/sat_arcade', 'proof-of-walk', 'beats/track123', 'forum'].forEach(function (hash) {
        assert.strictEqual(api.consumeHash(hash), true, hash);
    });
    assert.strictEqual(homes, 7);
    let went = '';
    global.go = function (id, btn, fromPop) { went = id + ':' + String(fromPop); };
    assert.strictEqual(api.consumeHash('timechain-tv/9'), true);
    assert.strictEqual(went, 'timechain-tv:true');
    homes = 0;
    mode('lite');
    ['ai-tools', 'leaderboard', 'chat', 'favor', 'pvp', 'metrics', 'proof-of-play/arcade', 'proof-of-walk'].forEach(function (hash) {
        assert.strictEqual(api.consumeHash(hash), true, hash);
    });
    assert.strictEqual(homes, 8);
    mode('advanced');
    let tab = '';
    global.enterProofOfPlay = function (name) { tab = name; };
    global._popActive = false;
    assert.strictEqual(api.consumeHash('proof-of-play/arcade'), true);
    assert.strictEqual(tab, 'arcade');
    assert.strictEqual(api.consumeHash('proof-of-walk'), false);
    global.localStorage = prevStore;
    global.goHome = prevHome;
    global.go = prevGo;
    global.enterProofOfPlay = prevEnter;
});

test('Back from each deep link still leaves TV', () => {
    const src = read('app.js');
    const start = src.indexOf("window.addEventListener('popstate'");
    const end = src.indexOf('var h = location.hash.slice(1)', start);
    const pop = src.slice(start, end);
    assert.strictEqual(pop.includes('miniAppConsumeHash'), false);
    assert.ok(pop.indexOf('leaveTimechainTV') < pop.indexOf('state.guard'));
    assert.ok(pop.includes('goHome(true)'));
    const route = src.slice(src.indexOf('function tryRoute'), src.indexOf('function tryRoute') + 2200);
    assert.ok(route.includes('miniAppConsumeHash'));
    const deep = [
        'timechain-tv/health-fitness', 'proof-of-play/arcade', 'proof-of-play/sat_arcade',
        'proof-of-play/galaxy', 'proof-of-play/ryracer', 'beats/track123', 'ai-tools',
        'leaderboard', 'proof-of-walk', 'pvp', 'forum', 'marketplace', 'nacho', 'chat',
        'favor', 'metrics', 'trails', 'lightning', 'first-purchase', 'irl-sync', 'meetup-builder'
    ];
    deep.forEach(function (hash) {
        const page = hash;
        assert.notStrictEqual(page, 'timechain-tv');
        assert.notStrictEqual(page, 'tv');
    });
    ['nacho', 'pvp', 'proof-of-play', 'marketplace', 'forum', 'beats/', 'proof-of-walk', 'lightning', 'trails', 'irl-sync', 'first-purchase', 'meetup-builder'].forEach(function (token) {
        assert.ok(pop.includes(token), token);
    });
    assert.ok(src.includes("showToast('🚧 Proof of Walk is temporarily disabled — check back soon!')"));
    const pushes = [];
    const prevHistory = global.history;
    const prevGo = global.go;
    const prevStore = global.localStorage;
    global.localStorage = { getItem: function () { return ''; } };
    global.history = {
        pushState: function () { pushes.push('push'); },
        replaceState: function () { pushes.push('replace'); }
    };
    global.go = function (id, btn, fromPop) { pushes.push('go:' + id + ':' + String(fromPop)); };
    assert.strictEqual(api.consumeHash('timechain-tv/health-fitness'), true);
    assert.strictEqual(pushes.indexOf('push'), -1);
    assert.ok(pushes.indexOf('go:timechain-tv:true') !== -1);
    global.history = prevHistory;
    global.go = prevGo;
    global.localStorage = prevStore;
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
