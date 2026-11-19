'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const root = path.join(__dirname, '..');

const catalog = JSON.parse(fs.readFileSync(path.join(root, 'functions/src/badges.catalog.json'), 'utf8'));
const titles = JSON.parse(fs.readFileSync(path.join(root, 'functions/src/title-defs.json'), 'utf8'));
global.BADGE_CATALOG = catalog.badges || catalog;
global.TITLE_DEFS = titles;

const idx = require('../badge-index.js');
const core = require('../functions/src/coreContributor.js');

function test(name, fn) { fn(); console.log('ok', name); }

test('core contributor is searchable by name', () => {
    const hits = idx.search('core contributor');
    assert.ok(hits.length, 'expected hits');
    assert.strictEqual(hits[0].id, 'core_contributor');
    assert.strictEqual(hits[0].kind, 'title');
    assert.ok(/7 daily spins/i.test(hits[0].desc) || /7 New York calendar days/i.test(hits[0].how));
});

test('secret badges are omitted unless earned', () => {
    const secrets = idx.allEntries().filter((e) => e.secret);
    if (!secrets.length) return;
    const id = secrets[0].id;
    const hiddenHits = idx.search(id, { includeSecret: false });
    assert.ok(!hiddenHits.some((h) => h.id === id));
    const earned = {}; earned[id] = true;
    const shown = idx.search(id, { earnedIds: earned });
    assert.ok(shown.some((h) => h.id === id));
});

test('missing descriptions use the fallback, not invented requirements', () => {
    const missing = idx.allEntries().filter((e) => !e.hasOfficialDesc);
    assert.ok(missing.length > 0);
    missing.slice(0, 20).forEach((e) => {
        assert.strictEqual(e.desc, idx.FALLBACK_DESC);
        assert.ok(e.how.indexOf('fuller how-to') !== -1 || e.how === idx.FALLBACK_HOW);
    });
});

test('nacho answers core contributor but not bitcoin core developers', () => {
    const a = idx.nachoAnswer('what is the core contributor badge');
    assert.ok(a && a.id === 'core_contributor');
    assert.ok(/BIP/i.test(a.answer));
    assert.strictEqual(idx.nachoAnswer('who are bitcoin core contributors'), null);
    assert.strictEqual(idx.nachoAnswer('who develops bitcoin'), null);
    assert.ok(idx.isBitcoinCoreDevQuestion('bitcoin core developers'));
});

test('visibility: window plus owner toggle; expired needs a new week', () => {
    const now = 1_700_000_000_000;
    assert.strictEqual(core.isVisible({ coreContributorUntil: now + 1000 }, now), true);
    assert.strictEqual(core.isVisible({ coreContributorUntil: now + 1000, showCoreContributor: false }, now), false);
    assert.strictEqual(core.isVisible({ coreContributorUntil: now - 1, showCoreContributor: true }, now), false);
    assert.strictEqual(idx.coreContributorVisible({ coreContributorUntil: now + 1000, showCoreContributor: false }, now), false);
    assert.strictEqual(core.titleActive({ coreContributorUntil: now - 1 }, now), false);
});


test('faction champion titles do not carry the BIP description', () => {
    const hive = idx.get('hive_mind_champion');
    const badger = idx.get('honey_badger_champion');
    const bip = /Merged this week's BIP after 7 daily spins/i;
    assert.ok(hive && /hive mind/i.test(hive.name), hive && hive.name);
    assert.ok(badger && /honey badger/i.test(badger.name), badger && badger.name);
    assert.ok(!bip.test(hive.desc), hive.desc);
    assert.ok(!bip.test(badger.desc), badger.desc);
    idx.allEntries().forEach((e) => {
        if (e.id === 'core_contributor') return;
        assert.ok(!bip.test(e.desc || ''), 'stolen BIP desc on ' + e.id);
        assert.ok(!bip.test(e.how || ''), 'stolen BIP how on ' + e.id);
    });
});

test('displayBadge only renders earned non-title badges', () => {
    const user = { visibleBadges: ['explorer_10'], hiddenBadges: [], bipBadges: ['bip_360'] };
    assert.strictEqual(idx.canDisplayBadge(user, 'explorer_10'), true);
    assert.strictEqual(idx.canDisplayBadge(user, 'explorer_25'), false);
    assert.strictEqual(idx.canDisplayBadge(user, 'bip_360'), true);
    assert.strictEqual(idx.canDisplayBadge(user, 'core_contributor'), false);
    const secrets = idx.allEntries().filter((e) => e.secret);
    if (secrets.length) {
        const sid = secrets[0].id;
        assert.strictEqual(idx.canDisplayBadge({ visibleBadges: [sid] }, sid), false);
        assert.strictEqual(idx.canDisplayBadge({ hiddenBadges: [sid] }, sid), true);
    }
});

test('public profile flag is enough to decide visibility', () => {
    assert.strictEqual(idx.coreContributorVisible({ coreContributorVisible: true }), true);
    assert.strictEqual(idx.coreContributorVisible({ coreContributorVisible: false }), false);
    const now = 1_700_000_000_000;
    assert.strictEqual(idx.coreContributorVisible({ coreContributorUntil: now + 1000, showCoreContributor: true }, now), true);
});

console.log('test-badge-index passed');
