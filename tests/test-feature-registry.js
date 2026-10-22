#!/usr/bin/env node
// Feature registry: search, Nacho resolver, deep-link openers, and the 76-feature eval.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const reg = require(path.join(root, 'features.registry.js'));
const features = require(path.join(__dirname, 'fixtures/features.json'));

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('  ok  ' + name); }
    catch (e) { failed++; console.log('  FAIL ' + name + ': ' + e.message); }
}

const corpus = fs.readdirSync(root).filter(function (f) {
    return f.endsWith('.js') && f.indexOf('bundle') !== 0;
}).map(function (f) {
    return fs.readFileSync(path.join(root, f), 'utf8');
}).join('\n');

function defined(name) {
    return corpus.indexOf('function ' + name) !== -1
        || corpus.indexOf('window.' + name + ' =') !== -1
        || corpus.indexOf('window.' + name + '=') !== -1
        || corpus.indexOf(name + ' = function') !== -1
        || corpus.indexOf(name + ' = async function') !== -1;
}

test('registry covers every audited feature', function () {
    features.forEach(function (f) {
        assert.ok(reg.BY_ID[f.id], 'missing ' + f.id);
    });
});

test('Nacho resolver hits the right feature with a working link (>= 95%, links 100%)', function () {
    const bad = [];
    features.forEach(function (f) {
        const hit = reg.resolveNachoFeature(f.q);
        const ans = hit ? String(hit.answer).toLowerCase() : '';
        const rel = !!(hit && f.w.some(function (w) { return ans.indexOf(w) !== -1; }));
        const link = !!(hit && hit.siteAction && hit.siteAction.indexOf("'" + f.id + "'") !== -1);
        if (!rel || !link || (hit && hit.featureId !== f.id)) {
            bad.push(f.id + ' got=' + (hit && hit.featureId) + ' rel=' + rel + ' link=' + link);
        }
    });
    const correct = features.length - bad.length;
    assert.ok(correct / features.length >= 0.95, correct + '/' + features.length + ' ' + bad.join('; '));
    assert.strictEqual(bad.length, 0, bad.join('; '));
});

test('search finds every feature name in the top 3', function () {
    const bad = [];
    features.forEach(function (f) {
        const q = String(reg.BY_ID[f.id].title);
        const top = reg.searchFeatures(q).slice(0, 3).map(function (row) { return row.feature.id; });
        if (top.indexOf(f.id) === -1) bad.push(f.id + ' title=' + q + ' top=' + top.join(','));
    });
    assert.strictEqual(bad.length, 0, bad.join('; '));
});

test('common phrasings, typos, and sentence queries', function () {
    const cases = [
        ['how do i open a locked cipher', 'ciphers'],
        ['how do i open a locked cypher', 'ciphers'],
        ['how do i get a key for my cipher', 'keys'],
        ['keys', 'keys'],
        ['what is the raid boss', 'raid'],
        ['how do i turn on 2fa', 'security'],
        ['how do i tip another user', 'tips'],
        ['how do i donate xp to charity', 'charity'],
        ['how do i donate', 'donate'],
        ['how does the referral program work', 'referral'],
        ['refer a friend', 'referral'],
        ['what are the hot topics this week', 'hot-topics'],
        ['what is the citadel', 'citadel'],
        ['where is the faq', 'faq'],
        ['how does price prediction work', 'predictions'],
        ['predictions', 'predictions'],
        ['how do i claim sats', 'sats'],
        ['what is a nacho shoutout', 'shoutout'],
        ['how do i open my gifts', 'gifts']
    ];
    cases.forEach(function (pair) {
        const hit = reg.resolveNachoFeature(pair[0]);
        assert.ok(hit && hit.featureId === pair[1], pair[0] + ' -> ' + (hit && hit.featureId));
        const search = reg.searchFeatures(pair[0]).slice(0, 3).map(function (row) { return row.feature.id; });
        assert.ok(search.indexOf(pair[1]) !== -1, 'search ' + pair[0] + ' top=' + search.join(','));
    });
    const keys = reg.searchFeatures('keys').map(function (row) { return row.feature.id; });
    const keyAt = keys.indexOf('keys');
    const shortAt = keys.indexOf('shortcuts');
    assert.ok(keyAt === 0 && (shortAt === -1 || keyAt < shortAt), 'keys before shortcuts: ' + keys.slice(0, 4).join(','));
});

test('sats answers do not publish faucet limits', function () {
    const hit = reg.resolveNachoFeature('how do i claim sats');
    assert.ok(hit);
    assert.ok(/settings/i.test(hit.answer) && /sats/i.test(hit.answer));
    assert.ok(!/lightning address/i.test(hit.answer));
    assert.ok(!/\b200 sats\b|\b15,?000\b|\b100 sats\b|\b7 days\b|\b1,000 points\b/i.test(hit.answer));
    const ref = reg.resolveNachoFeature('how does the referral program work');
    assert.ok(/maxi/i.test(ref.answer) && /50/.test(ref.answer) && /orange ticket/i.test(ref.answer));
    const qa = fs.readFileSync(path.join(root, 'nacho-qa.js'), 'utf8');
    const faucet = qa.slice(qa.indexOf('Sats Faucet'), qa.indexOf('points to sats'));
    assert.ok(faucet.length > 100);
    assert.ok(!/lightning address saved/i.test(faucet));
});

test('profile picture opens account, and leaderbord search is the leaderboard', function () {
    const pic = reg.resolveNachoFeature('profile picture settings');
    assert.ok(pic && pic.featureId === 'profile-picture', 'got ' + (pic && pic.featureId));
    assert.strictEqual(reg.BY_ID['profile-picture'].arg, 'account');
    assert.ok(reg.BY_ID['exploration-map'] && reg.BY_ID['online-status']);
    const rows = reg.searchFeatures('leaderbord').slice(0, 3).map(function (row) { return row.feature.id; });
    assert.strictEqual(rows[0], 'leaderboard');
    const src = fs.readFileSync(path.join(root, 'features.registry.js'), 'utf8');
    assert.ok(src.indexOf('bestSim(t, blobT) >= 0.82') === -1);
});

test('every quest hub tab, settings page, and hash route has a registry entry', function () {
    const quests = fs.readFileSync(path.join(root, 'quests.js'), 'utf8');
    const hubStart = quests.indexOf("if (tab === 'quiz')");
    const hub = quests.slice(hubStart, hubStart + 800);
    const tabs = [];
    hub.replace(/tab === '([a-z]+)'/g, function (_, tab) { tabs.push(tab); return _; });
    assert.ok(tabs.indexOf('quiz') !== -1 && tabs.indexOf('citadel') !== -1, 'parser missed tabs');
    tabs.forEach(function (tab) {
        const hit = reg.FEATURES.some(function (f) { return f.questTab === tab || f.arg === tab; });
        assert.ok(hit, 'quest tab ' + tab);
    });
    ['account', 'scholar', 'sats', 'prefs', 'security', 'data', 'peers', 'profile'].forEach(function (page) {
        const hit = reg.FEATURES.some(function (f) {
            return (f.settingsPages || []).indexOf(page) !== -1 || (f.kind === 'settings' && f.arg === page);
        });
        assert.ok(hit, 'settings page ' + page);
    });
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    const start = app.indexOf('function handleHash()');
    const end = app.indexOf('handleHash();', start);
    const block = app.slice(start, end);
    const cases = [];
    block.replace(/case '([^']+)'/g, function (_, id) { cases.push(id); return _; });
    const skip = { 'beats': 0 };
    cases.forEach(function (id) {
        if (id.indexOf('beats/') === 0 || id.indexOf('cert/') === 0) return;
        const feat = reg.featureByHash(id) || reg.featureByHash('app/' + id);
        assert.ok(feat, 'hash route #' + id);
    });
    assert.ok(reg.featureByHash('questhub'), '#questhub');
    assert.ok(reg.featureByHash('app/ciphers'), '#app/ciphers');
    assert.ok(reg.featureByHash('app/predictions'), '#app/predictions');
    assert.strictEqual(reg.featureByHash('predictions'), null);
});

test('every registry opener calls a function that exists', function () {
    reg.FEATURES.forEach(function (f) {
        const src = f.open.toString();
        const names = [];
        src.replace(/win\.([A-Za-z_][A-Za-z0-9_]*)/g, function (_, name) { names.push(name); return _; });
        const called = names.filter(function (name) {
            return name !== '_questHubTab' && name !== '_nookSubTab' && name !== '_renderQuestHubTab' && name !== 'location' && name !== 'history';
        });
        assert.ok(called.length, f.id + ' opener calls nothing');
        called.forEach(function (name) {
            assert.ok(defined(name), f.id + ' calls missing ' + name);
        });
    });
});

test('show/open/enter navigation openers are in the registry', function () {
    const files = ['app.js', 'quests.js', 'ranking.js', 'guide.js', 'gifting.js', 'global-chat.js', 'features.js', 'nacho.js', 'messaging.js', 'proof-of-play.js', 'proof-of-walk.js', 'notifications.js', 'satoshi-favor.js', 'bitcoin-buddy.js'];
    const names = new Set();
    files.forEach(function (file) {
        const src = fs.readFileSync(path.join(root, file), 'utf8');
        src.replace(/window\.((?:show|open|enter)[A-Z][A-Za-z0-9_]*)\s*=/g, function (_, name) { names.add(name); return _; });
        src.replace(/function ((?:show|open|enter)[A-Z][A-Za-z0-9_]*)\s*\(/g, function (_, name) { names.add(name); return _; });
    });
    const helpers = new Set([
        'openGiftModal', 'openImg', 'showACResults', 'showAccountInfo', 'showArtistProfileModal',
        'showBeginnerGuide', 'showBubble', 'showCelebration', 'showChatRules', 'showCipherClaim',
        'showContinueReading', 'showConvoQuizQuestion', 'showDJBar', 'showDJControlPanel',
        'showDMGifPicker', 'showDMImagePreview', 'showDMWindow', 'showDeleteAccountConfirm',
        'showEmojiPicker', 'showFloatingBtn', 'showFriendsInDistressWarning', 'showGifPicker',
        'showGuideBanner', 'showGuideReturnBtn', 'showImagePreview', 'showLevelUpCelebration',
        'showMinerModal', 'showOverlayBtn', 'showPWAAuthFallback', 'showPartnershipLevelUpPopup',
        'showPostSpinGiftModal', 'showQuestFinalResults', 'showReactPicker', 'showSignInOnly',
        'showSignInPrompt', 'showSkeletonLoader', 'showSpinReward', 'showToast', 'showTrendingTopics',
        'showTroubleSigningIn', 'showUserProfile', 'showUserProfileByUsername',
        'openNow'
    ]);
    const regSrc = fs.readFileSync(path.join(root, 'features.registry.js'), 'utf8');
    const missing = [];
    names.forEach(function (name) {
        if (helpers.has(name)) return;
        if (regSrc.indexOf(name) === -1) missing.push(name);
    });
    assert.strictEqual(missing.length, 0, 'openers missing from registry: ' + missing.join(', '));
});

test('changed files parse', function () {
    ['features.registry.js', 'nacho-qa.js', 'app.js', 'global-chat.js', 'sw.js', 'workers/nacho-search/worker.js'].forEach(function (file) {
        execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' });
    });
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
