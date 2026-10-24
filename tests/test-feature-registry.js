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
    assert.strictEqual(reg.featureByHash('questhub').id, 'raid', '#questhub opens Raid');
    assert.strictEqual(reg.featureByHash('quests').id, 'quest-hub');
    assert.ok(reg.featureByHash('app/ciphers'), '#app/ciphers');
    assert.ok(reg.featureByHash('app/predictions'), '#app/predictions');
    assert.strictEqual(reg.featureByHash('predictions'), null);
    const hubHit = reg.resolveNachoFeature('what is the quest hub');
    assert.strictEqual(hubHit && hubHit.featureId, 'quest-hub');
});

test('fresh load keeps #app/raid, #app/ciphers, and #questhub on the right tab', function () {
    const origSetTimeout = global.setTimeout;
    const origClearTimeout = global.clearTimeout;
    const queue = [];
    let now = 0;
    let seq = 1;
    global.setTimeout = function (fn, ms) {
        const id = seq++;
        queue.push({ id: id, fn: fn, at: now + (ms || 0) });
        return id;
    };
    global.clearTimeout = function (id) {
        const i = queue.findIndex(function (t) { return t.id === id; });
        if (i >= 0) queue.splice(i, 1);
    };
    function advance(ms) {
        const end = now + ms;
        let guard = 0;
        while (guard++ < 500) {
            queue.sort(function (a, b) { return a.at - b.at; });
            const next = queue[0];
            if (!next || next.at > end) break;
            queue.shift();
            now = next.at;
            next.fn();
        }
        now = end;
    }
    function reset() {
        queue.length = 0;
        now = 0;
        global._bqSuppressRoute = false;
        global._bqDeepLinkHandled = false;
        global._bqLastRouted = '';
        global._bqLastRoutedAt = 0;
        global._questHubTab = 'quiz';
        global._nookSubTab = '';
        global._renders = [];
        global.location = { hash: '', pathname: '/' };
    }
    function tabLabel() {
        return global._questHubTab + (global._questHubTab === 'nook' && global._nookSubTab ? '>' + global._nookSubTab : '');
    }
    function handleHashLoop(hash) {
        let waited = 0;
        function tryRoute() {
            if (waited > 8000) return;
            if (global.bqRouteHash(hash)) return;
            waited += 200;
            global.setTimeout(tryRoute, 200);
        }
        global.setTimeout(tryRoute, 500);
    }
    function install() {
        global.history = {
            pushState: function (_s, _t, url) {
                global.location.hash = url;
                handleHashLoop(String(url).replace(/^#/, ''));
            }
        };
        global._renderQuestHubTab = function () { global._renders.push(tabLabel()); };
        global.showQuestHub = function () {
            global._renders.push(tabLabel());
            if (global.location.hash !== '#questhub') {
                global.history.pushState({ overlay: 'questhub' }, '', '#questhub');
            }
        };
        global.openRaidHub = function () {
            global._questHubTab = 'raid';
            global._nookSubTab = '';
            global.showQuestHub();
            global._questHubTab = 'raid';
            global._renderQuestHubTab();
        };
        global.openNookInventory = function () {
            global.showQuestHub();
            global._questHubTab = 'nook';
            global._nookSubTab = 'inventory';
            global._renderQuestHubTab();
        };
        global.openKeysAndCiphers = function () { global.openNookInventory(); };
    }
    function questsLoad() {
        global.setTimeout(function () {
            const hash = global.location.hash;
            if (hash === '#questhub' || hash === '#raid' || hash === '#raid-hub') {
                if (global._bqDeepLinkHandled) return;
                global.openRaidHub();
            }
        }, 500);
    }

    try {
        reset();
        install();
        global.location.hash = '#app/raid';
        assert.strictEqual(global.bqRouteHash('app/raid'), true);
        questsLoad();
        advance(3000);
        assert.strictEqual(global._questHubTab, 'raid', 'raid renders ' + global._renders.join(','));
        assert.ok(global._renders.indexOf('quiz') === -1, global._renders.join(','));

        reset();
        install();
        global.location.hash = '#app/ciphers';
        assert.strictEqual(global.bqRouteHash('app/ciphers'), true);
        questsLoad();
        advance(3000);
        assert.strictEqual(global._questHubTab, 'nook', 'cipher tab ' + global._renders.join(','));
        assert.strictEqual(global._nookSubTab, 'inventory');
        assert.strictEqual(global._renders[global._renders.length - 1], 'nook>inventory', global._renders.join(','));
        // The 2.5s hub lock and the 1.5s ignore-route window have expired.
        // #questhub is the rewritten hash and must not open Raid over Nook.
        advance(2000);
        global._bqSuppressRoute = false;
        if (global._bqHubLock) global._bqHubLock.until = Date.now() - 1;
        assert.strictEqual(global.bqRouteHash('questhub'), true);
        assert.strictEqual(global._questHubTab, 'nook', 'late questhub kept cipher tab ' + global._renders.join(','));
        assert.strictEqual(global._nookSubTab, 'inventory');

        reset();
        install();
        global.location.hash = '#questhub';
        questsLoad();
        handleHashLoop('questhub');
        advance(3000);
        assert.strictEqual(global._questHubTab, 'raid', 'questhub renders ' + global._renders.join(','));
        assert.ok(global._renders.indexOf('quiz') === -1, global._renders.join(','));
    } finally {
        global.setTimeout = origSetTimeout;
        global.clearTimeout = origClearTimeout;
        global._bqSuppressRoute = false;
        global._bqDeepLinkHandled = false;
    }

    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const fast = html.slice(html.indexOf('function _onScriptLoad'), html.indexOf('_toLoad.forEach'));
    assert.ok(fast.indexOf("hash === 'app'") !== -1, fast);
    assert.ok(fast.indexOf("hash === 'app' || hash === 'questhub'") === -1, fast);
    assert.ok(fast.indexOf("hash !== 'questhub'") !== -1, fast);
    const quests = fs.readFileSync(path.join(root, 'quests.js'), 'utf8');
    assert.strictEqual((quests.match(/if \(window\._bqDeepLinkHandled\) return;/g) || []).length, 2);
    assert.ok(html.indexOf('var _href = location.href') !== -1);
    assert.ok(html.indexOf("if (location.href !== _href) history.replaceState(null, '', _href); location.reload();") !== -1);
    assert.ok(html.indexOf('location.replace(_href)') === -1);
    assert.ok(html.indexOf('id="searchOverlay" style="display:none;position:fixed;top:0;right:0;bottom:0;left:0;z-index:20000;background:var(--bg);') !== -1);
    assert.ok(html.indexOf('#searchOverlay {') !== -1 && html.indexOf('background: var(--bg) !important;') !== -1);
    assert.ok(html.indexOf('patches.js?v=20261023_v2349') !== -1);
    assert.ok(html.indexOf('patches.js?v=20261022_v2263') === -1);
    const appSrc = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    const fallbackAt = appSrc.indexOf('Post-load fallback routing to:');
    const fallback = appSrc.slice(Math.max(0, fallbackAt - 700), fallbackAt);
    assert.ok(fallback.indexOf('window._bqDeepLinkHandled') !== -1, fallback);
    assert.ok(fallback.indexOf("getElementById('questHubOverlay')") !== -1, fallback);
    const patches = fs.readFileSync(path.join(root, 'patches.js'), 'utf8');
    assert.ok(patches.indexOf('[data-theme="light"] #searchOverlay {\',"  background: var(--bg) !important;') !== -1);
    assert.ok(patches.indexOf('#searchOverlay {\',"  background: rgba(255,255,255,0.95) !important;') === -1);
});

test('#questhub keeps an already open Quest Hub tab', function () {
    global._bqSuppressRoute = false;
    global._bqDeepLinkHandled = false;
    global._bqLastRouted = '';
    global._questHubTab = 'nook';
    global._nookSubTab = 'inventory';
    global.document = {
        getElementById: function (id) { return id === 'questHubOverlay' ? { id: id } : null; }
    };
    try {
        assert.strictEqual(global.bqRouteHash('questhub'), true);
        assert.strictEqual(global._questHubTab, 'nook');
        assert.strictEqual(global._nookSubTab, 'inventory');
    } finally {
        delete global.document;
        global._bqSuppressRoute = false;
        global._bqDeepLinkHandled = false;
    }
});

test('suppress swallows feature hashes and leaves channel taps alone', function () {
    global._bqSuppressRoute = true;
    try {
        assert.strictEqual(global.bqRouteHash('mining'), false);
        assert.strictEqual(global.bqRouteHash('self-custody'), false);
        assert.strictEqual(global.bqRouteHash('questhub'), true);
    } finally {
        global._bqSuppressRoute = false;
    }
});

test('search drops duplicate app rows and linked answers skip the generic tip', function () {
    assert.strictEqual(reg.titleKey('🗺️ Exploration Map'), reg.titleKey('Exploration Map'));
    assert.strictEqual(reg.titleKey('⚡ Raid Boss'), 'raid boss');
    function div(cls, text, extra) {
        return {
            tag: 'div',
            attrs: Object.assign({ class: cls || '' }, extra || {}),
            textContent: text || '',
            kids: [],
            parentNode: null,
            getAttribute: function (name) { return this.attrs[name] == null ? null : this.attrs[name]; },
            querySelector: function (sel) { const all = this.querySelectorAll(sel); return all[0] || null; },
            querySelectorAll: function (sel) {
                const out = [];
                function walk(list) {
                    for (let i = 0; i < list.length; i++) {
                        if (matches(list[i], sel)) out.push(list[i]);
                        walk(list[i].kids);
                    }
                }
                walk(this.kids);
                return out;
            },
            removeChild: function (child) { this.kids = this.kids.filter(function (k) { return k !== child; }); }
        };
    }
    function matches(n, sel) {
        if (sel === 'div') return n.tag === 'div';
        if (sel === '.sr-item') return n.attrs.class === 'sr-item';
        if (sel === '.sr-cat') return n.attrs.class === 'sr-cat';
        if (sel === '[data-bq-feature]') return !!n.attrs['data-bq-feature'];
        return false;
    }
    function nest(parent, child) { child.parentNode = parent; parent.kids.push(child); return child; }
    const sr = div('', '');
    const card = div('sr-item', '', { 'data-bq-feature': 'exploration-map' });
    nest(card, div('sr-cat', 'Feature'));
    nest(card, div('', 'Exploration Map'));
    nest(sr, card);
    const dup = div('sr-item', '');
    nest(dup, div('sr-cat', '⚡ App'));
    nest(dup, div('', '🗺️ Exploration Map'));
    nest(sr, dup);
    const other = div('sr-item', '');
    nest(other, div('sr-cat', '⚡ App'));
    nest(other, div('', 'Leaderboard'));
    nest(sr, other);
    const channel = div('sr-item', '');
    nest(channel, div('sr-cat', 'Channel'));
    nest(channel, div('', 'Exploration Map'));
    nest(sr, channel);
    const raffle = div('sr-item', '', { 'data-bq-feature': 'raffle' });
    nest(raffle, div('sr-cat', 'Feature'));
    nest(raffle, div('', 'Orange ticket raffle'));
    nest(sr, raffle);
    const raffleDup = div('sr-item', '');
    nest(raffleDup, div('sr-cat', '⚡ App'));
    nest(raffleDup, div('', '🍒 Raffle'));
    nest(sr, raffleDup);
    const gifts = div('sr-item', '', { 'data-bq-feature': 'gifts' });
    nest(gifts, div('sr-cat', 'Feature'));
    nest(gifts, div('', 'Gifts'));
    nest(sr, gifts);
    const giftsDup = div('sr-item', '');
    nest(giftsDup, div('sr-cat', '⚡ App'));
    nest(giftsDup, div('', '📬 Open gifts'));
    nest(sr, giftsDup);
    reg.dropDuplicateAppRows(sr);
    const left = sr.kids.map(function (row) { return row.kids[1].textContent; });
    assert.deepStrictEqual(left, ['Exploration Map', 'Leaderboard', 'Exploration Map', 'Orange ticket raffle', 'Gifts']);

    function answer(question, result) {
        let got = null;
        reg.wrapUnified(function (_q, cb) { cb(result); })(question, function (out) { got = out; });
        return got;
    }
    const linked = answer('what is the halving', {
        type: 'kb',
        answer: 'The halving cuts the block subsidy. See the Scarce channel.',
        channel: 'scarce'
    });
    assert.ok(linked && !/Orange Tickets/i.test(linked.answer) && !/data-bq-chip/.test(linked.answer), linked && linked.answer);
    const topical = answer('what is the halving', {
        type: 'kb',
        answer: 'The halving cuts the block subsidy every 210,000 blocks.'
    });
    assert.ok(topical && /Scarce channel/.test(topical.answer), topical && topical.answer);
    assert.ok(!/Orange Tickets/i.test(topical.answer));
    const plain = answer('what is a utxo', {
        type: 'kb',
        answer: 'A UTXO is an unspent transaction output.'
    });
    assert.ok(plain && !/Orange Tickets/i.test(plain.answer) && !/Quest Hub/i.test(plain.answer), plain && plain.answer);
});

test('every registry opener calls a function that exists', function () {
    reg.FEATURES.forEach(function (f) {
        const src = f.open.toString();
        const names = [];
        src.replace(/win\.([A-Za-z_][A-Za-z0-9_]*)/g, function (_, name) { names.push(name); return _; });
        const called = names.filter(function (name) {
            return name !== '_questHubTab' && name !== '_nookSubTab' && name !== '_renderQuestHubTab' && name !== '_bqHubLock' && name !== 'location' && name !== 'history';
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
        'showMinerModal', 'showOverlayBtn', 'showPWAAuthFallback', 'showPartnershipLevelUpPopup', 'showOptInCard', 'openNotificationSettings',
        'showPostSpinGiftModal', 'showQuestFinalResults', 'showReactPicker', 'showSignInOnly',
        'showSignInPrompt', 'showSkeletonLoader', 'showSpinReward', 'showToast', 'showTrendingTopics',
        'showTroubleSigningIn', 'showUserProfile', 'showUserProfileByUsername',
        'openNow',
        'openWithdrawalAddress', 'showWithdrawalAddressReadonly',
        'showUsernameRepickPrompt'
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
    ['features.registry.js', 'quests.js', 'nacho-qa.js', 'app.js', 'global-chat.js', 'sw.js', 'workers/nacho-search/worker.js'].forEach(function (file) {
        execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' });
    });
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
