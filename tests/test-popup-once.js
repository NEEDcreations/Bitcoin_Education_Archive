#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('  ok  ' + name);
        passed++;
    } catch (e) {
        console.log('  FAIL ' + name);
        console.log('       ' + e.message);
        failed++;
    }
}

function read(rel) {
    return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

test('partnership level-up stays until dismissed and records a per-user seen flag', function () {
    const src = read('notifications.js');
    assert.ok(src.includes('window.showPartnershipLevelUpPopup'));
    assert.ok(!/Auto-dismiss after 12s/.test(src));
    const fnAt = src.indexOf('window.showPartnershipLevelUpPopup');
    const fn = src.slice(fnAt, fnAt + 5000);
    assert.ok(!/setTimeout\(function\(\) \{\s*var m = document\.getElementById\('partnershipLevelUpModal'\)/.test(fn));
    assert.ok(src.includes('data-partnership-close'));
    assert.ok(src.includes('_markPartnershipSeen'));
    assert.ok(src.includes('_readPartnershipSeen'));
    assert.ok(src.includes('celebratedState.partnershipPopupsSeen'));
    assert.ok(src.includes("arrayUnion(key)"));
    assert.ok(src.includes('btc_partnership_popups_seen_'));
    assert.ok(src.includes("if (_readPartnershipSeen()[guardKey])"));
});

test('exploration milestones honor the user-doc flag so login does not replay the popup', function () {
    const src = read('features.js');
    assert.ok(src.includes('function explorationAlreadySeen'));
    assert.ok(src.includes("explorationMilestone_' + m.pct"));
    assert.ok(src.includes("if (explorationAlreadySeen(m))"));
    const fnAt = src.indexOf('window._checkExplorationMilestones');
    const fn = src.slice(fnAt, fnAt + 2500);
    assert.ok(fn.indexOf('explorationAlreadySeen(m)') < fn.indexOf('awardPoints'));
    assert.ok(fn.includes("btc_' + m.key + '_celebrated_'"));
});

test('existing celebratedState and explorationMilestone fields stay on the user-doc allowlist', function () {
    const rules = read('firestore.rules');
    assert.ok(rules.includes("'celebratedState'"));
    assert.ok(rules.includes("'explorationMilestone_100'"));
    assert.ok(!rules.includes("'popupSeen'"));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
