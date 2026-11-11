// Settings consolidation: chat flair and other multiple-choice
// controls are dropdowns, and Sign-in methods recommends a backup.
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
    try {
        fn();
        console.log('  ok  ' + name);
        passed++;
    } catch (e) {
        console.log('  FAIL ' + name + ': ' + (e && e.message ? e.message : e));
        failed++;
    }
}

test('chat flair in Account is a select, not a button grid', function () {
    const src = read('ranking.js');
    const section = src.slice(src.indexOf('window._renderTitleFlairSection'), src.indexOf('window._tfRepaint'));
    assert.ok(section.indexOf('tfFlairSelect') !== -1);
    assert.ok(section.indexOf('window._tfFlairSelectHtml') !== -1);
    assert.ok(section.indexOf("card('flair'") === -1);
    assert.ok(src.indexOf('window._tfFlairChange = function') !== -1);
});

test('Stats cosmetics uses the same flair dropdown, not a Change modal', function () {
    const src = read('ranking.js');
    const start = src.indexOf("if (_settCosmetics.indexOf('chat_flair') !== -1)");
    assert.ok(start !== -1);
    const block = src.slice(start, src.indexOf("if (_settCosmetics.indexOf('profile_frame')", start));
    assert.ok(block.indexOf("window._tfFlairSelectHtml") !== -1);
    assert.ok(block.indexOf('_showChatFlairPicker') === -1);
    assert.ok(block.indexOf('Change →') === -1);
});

test('theme, font size, and display badge are selects', function () {
    const src = read('ranking.js');
    assert.ok(src.indexOf('id="themeSelect"') !== -1);
    assert.ok(src.indexOf('id="fontSizeSelect"') !== -1);
    assert.ok(src.indexOf('onchange="setFontSize(this.value)"') !== -1);
    assert.ok(src.indexOf('id="displayBadgeSelect"') !== -1);
    assert.ok(src.indexOf('window._setAppearanceTheme = function') !== -1);
    // Old 3-button theme row is gone
    assert.ok(src.indexOf('☀️ Light</button>') === -1);
});

test('Sign-in methods lists every provider and recommends a backup', function () {
    const src = read('ranking.js');
    assert.ok(src.indexOf('function signInBackupRecommendation') !== -1);
    assert.ok(src.indexOf('Add an email sign-in as a backup') !== -1);
    const details = src.slice(src.indexOf('// Sign-in methods: list every linked provider'), src.indexOf('_acctDetailsHtml += \'</div>\''));
    assert.ok(details.indexOf('listSignInMethodLabels') !== -1);
    assert.ok(details.indexOf('providerData[0]') === -1);
    const card = src.slice(src.indexOf('function renderSignInMethodsCard'), src.indexOf('// ACCOUNT_LINK_PLAN_END'));
    assert.ok(card.indexOf('signInBackupRecommendation(user, profile, methods)') !== -1);
});

test('chat flair picker overlay uses a dropdown', function () {
    const src = read('quests.js');
    const block = src.slice(src.indexOf('window._showChatFlairPicker = function'), src.indexOf('window._selectChatFlair = function'));
    assert.ok(block.indexOf('_tfFlairSelectHtml') !== -1);
    assert.ok(block.indexOf('flex-wrap:wrap') === -1);
});

test('pinned badge overlay and display-badge refresh use selects', function () {
    const quests = read('quests.js');
    const pinned = quests.slice(quests.indexOf('window._showPinnedBadgeSelector = function'), quests.indexOf('window._selectPinnedBadge = function'));
    assert.ok(pinned.indexOf('id="pinnedBadgeSelect"') !== -1);
    assert.ok(pinned.indexOf('flex-wrap:wrap') === -1);
    const ranking = read('ranking.js');
    const refresh = ranking.slice(ranking.indexOf('window.setDisplayBadge = function'), ranking.indexOf('if (typeof changeUsername === \'undefined\')'));
    assert.ok(refresh.indexOf('id="displayBadgeSelect"') !== -1);
    assert.ok(refresh.indexOf('flex-wrap:wrap') === -1);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
