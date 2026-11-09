// Titles and chat flair are server-decided. Rebalanced collections, the
// Proof of Everything meta collection, and server-verified walk and Beats badges.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const collectionBonus = require('../functions/src/collectionBonus');
const titleFlair = require('../functions/src/titleFlair');
const powBadges = require('../functions/src/powBadges');
const beatsPlays = require('../functions/src/beatsPlays');
const extractTitles = require('../functions/src/titleDefsFromSource').extract;

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;
async function test(name, fn) {
    try { await fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e)); failed++; }
}

const admin = { firestore: { FieldValue: { delete: function () { return { _delete: true }; } } } };

function fakeDb(docs) {
    function ref(p) {
        return {
            path: p,
            get: async function () { const d = docs[p]; return { exists: d != null, data: function () { return d ? Object.assign({}, d) : undefined; } }; },
            set: async function (data, opts) {
                const next = opts && opts.merge && docs[p] ? Object.assign({}, docs[p]) : {};
                Object.keys(data).forEach(function (k) { if (data[k] && data[k]._delete) delete next[k]; else next[k] = data[k]; });
                docs[p] = next;
            },
            collection: function (name) {
                const head = p + '/' + name + '/';
                return {
                    get: async function () {
                        const rows = Object.keys(docs).filter(function (k) { return k.indexOf(head) === 0 && k.slice(head.length).indexOf('/') < 0; })
                            .map(function (k) { return { id: k.slice(head.length), data: function () { return Object.assign({}, docs[k]); } }; });
                        return { forEach: function (fn) { rows.forEach(fn); } };
                    },
                };
            },
        };
    }
    return { docs: docs, collection: function (name) { return { doc: function (id) { return ref(name + '/' + id); } }; } };
}

(async function () {
    const doc = JSON.parse(fs.readFileSync(path.join(root, 'functions/src/collection-groups.json'), 'utf8'));
    const catalog = require('../functions/src/badges.catalog.json').badges;

    await test('core collections hold 12 to 15 badges, each badge in one collection', function () {
        const seen = {};
        collectionBonus.collections().forEach(function (col) {
            col.badgeIds.forEach(function (id) {
                // BIP badge ids live in the bipBadges field (PR #238), not the catalog.
                if (col.kind !== 'bip') assert.ok(catalog[id], 'unknown badge ' + id);
                if (col.kind === 'meta') return;
                assert.strictEqual(seen[id], undefined, id + ' in ' + seen[id] + ' and ' + col.id);
                seen[id] = col.id;
            });
        });
        doc.legend.forEach(function (id) { assert.strictEqual(seen[id], undefined, 'legend ' + id + ' still in ' + seen[id]); });
        doc.retired.badgeIds.forEach(function (id) { assert.strictEqual(seen[id], undefined, 'retired ' + id); });
        doc.groups.filter(function (g) { return !g.optional; }).forEach(function (g) {
            assert.ok(g.badgeIds.length <= 15, g.id);
        });
        ['col_learning', 'col_daily_habits', 'col_mining', 'col_arena', 'col_chat_forum', 'col_peers', 'col_lightning', 'col_tctv', 'col_beats', 'col_profile'].forEach(function (id) {
            const n = collectionBonus.collectionById(id).badgeIds.length;
            assert.ok(n >= 12 && n <= 15, id + ' has ' + n);
        });
        assert.strictEqual(collectionBonus.collectionById('col_community'), null);
        assert.strictEqual(collectionBonus.collectionById('col_entertainment'), null);
    });

    await test('every collection has its own title and flair', function () {
        const titleIds = {};
        collectionBonus.collections().forEach(function (col) {
            assert.ok(col.title && col.title.id && col.title.title, col.id);
            assert.ok(col.flair, col.id);
            assert.strictEqual(titleIds[col.title.id], undefined, col.title.id);
            titleIds[col.title.id] = true;
        });
        const meta = collectionBonus.collectionById('col_proof_of_everything');
        assert.strictEqual(meta.title.title, 'Unconfiscatable');
        assert.strictEqual(meta.flair, '⚡🛡️');
        assert.strictEqual(collectionBonus.collectionById('col_chat_forum').title.title !== collectionBonus.collectionById('col_peers').title.title, true);
        assert.strictEqual(collectionBonus.collectionById('col_tctv').title.title !== collectionBonus.collectionById('col_beats').title.title, true);
    });

    await test('Proof of Everything follows the core collections, not a fixed list', function () {
        const meta = collectionBonus.collectionById('col_proof_of_everything');
        const core = collectionBonus.metaMemberGroups().map(function (g) { return g.id + '_bonus'; });
        assert.deepStrictEqual(meta.badgeIds, core);
        assert.ok(meta.badgeIds.indexOf('col_irl_bonus') < 0, 'IRL is optional');
        assert.ok(meta.badgeIds.indexOf('col_bip_s1_bonus') < 0, 'BIP seasons are separate');
        assert.deepStrictEqual(collectionBonus.requiredMembers(meta), meta.badgeIds);
        assert.strictEqual(meta.bonusPts, 0);
    });

    await test('Diamond Hands and Master Miner flairs are not Nook emojis; BIP Merger title is ready', function () {
        const nook = new Set(titleFlair.NOOK_FLAIR);
        const habits = collectionBonus.collectionById('col_daily_habits');
        const mining = collectionBonus.collectionById('col_mining');
        const bip = collectionBonus.collectionById('col_bip_s1');
        assert.strictEqual(habits.flair, '🙌');
        assert.strictEqual(habits.title.emoji, '🙌');
        assert.strictEqual(mining.flair, '⚒️');
        assert.strictEqual(mining.title.emoji, '⚒️');
        assert.ok(!nook.has(habits.flair), 'Diamond Hands flair must not be a Nook emoji');
        assert.ok(!nook.has(mining.flair), 'Master Miner flair must not be a Nook emoji');
        assert.strictEqual(bip.title.title, 'BIP Merger');
        assert.strictEqual(bip.title.emoji, '📜');
        assert.strictEqual(bip.flair, '📜');
        assert.ok(!nook.has(bip.flair));
    });

    await test('BIP season 1 counts the server bipBadges field', function () {
        const col = collectionBonus.collectionById('col_bip_s1');
        assert.strictEqual(col.badgeIds.length, 12);
        const held = collectionBonus.collectionHeldIds({ bipBadges: col.badgeIds.concat(['bip_x', 'set_tv']) }, {});
        col.badgeIds.forEach(function (id) { assert.ok(held.has(id), id); });
        assert.ok(!held.has('bip_x'));
        assert.ok(!held.has('set_tv'));
    });

    await test('server title table matches badges.js', function () {
        const fromSource = extractTitles(fs.readFileSync(path.join(root, 'badges.js'), 'utf8'));
        const saved = require('../functions/src/title-defs.json');
        assert.deepStrictEqual(saved, JSON.parse(JSON.stringify(fromSource)));
        assert.ok(saved.length > 30);
    });

    await test('earned titles come only from held badges, collections, and the BIP window', function () {
        const held = new Set(['sf_100000_hashes', 'col_learning_bonus']);
        const now = 1800000000000;
        const e = titleFlair.earnedFor({ ownedCosmetics: [], coreContributorUntil: now + 1000, grandfatheredTitles: ['quest_legend', 'made_up'] }, held, now);
        assert.ok(e.titles.indexOf('hash_god') >= 0);
        assert.ok(e.titles.indexOf('col_title_learning') >= 0);
        assert.ok(e.titles.indexOf('core_contributor') >= 0);
        assert.ok(e.titles.indexOf('quest_legend') >= 0, 'grandfathered');
        assert.ok(e.titles.indexOf('made_up') < 0);
        assert.ok(e.titles.indexOf('col_title_proof_of_everything') < 0);
        assert.deepStrictEqual(e.flair, ['🎓']);
        const expired = titleFlair.earnedFor({ coreContributorUntil: now - 1 }, new Set(), now);
        assert.ok(expired.titles.indexOf('core_contributor') < 0);
        const nook = titleFlair.earnedFor({ ownedCosmetics: ['chat_flair'] }, new Set(), now);
        assert.deepStrictEqual(nook.flair, titleFlair.NOOK_FLAIR);
    });

    await test('equip accepts only earned values and null unequips', function () {
        const earned = { titles: ['hash_god'], flair: ['🔥'] };
        assert.deepStrictEqual(titleFlair.planEquip(earned, { title: 'hash_god' }), { ok: true, patch: { activeTitle: 'hash_god' } });
        assert.strictEqual(titleFlair.planEquip(earned, { title: 'col_title_proof_of_everything' }).ok, false);
        assert.strictEqual(titleFlair.planEquip(earned, { flair: '⚡🛡️' }).ok, false);
        assert.strictEqual(titleFlair.planEquip(earned, { title: { id: 'hash_god' } }).ok, false);
        assert.deepStrictEqual(titleFlair.planEquip(earned, { title: null, flair: null }), { ok: true, patch: { activeTitle: null, chatFlairEmoji: null } });
    });

    await test('callable writes earned lists, equips, and strips a lapsed title', async function () {
        const db = fakeDb({
            'users/aa': { activeTitle: 'core_contributor', coreContributorUntil: 1, earnedTitles: ['forged'] },
            'users/aa/badge_awards/col_tctv_bonus': { badge: 'col_tctv_bonus', source: 'collection_bonus' },
        });
        const listed = await titleFlair.handle(db, admin, 'aa', { action: 'list' }, 1800000000000);
        assert.deepStrictEqual(listed.titles, ['col_title_tctv']);
        assert.strictEqual(listed.activeTitle, null);
        assert.strictEqual(db.docs['users/aa'].activeTitle, undefined);
        assert.deepStrictEqual(db.docs['users/aa'].earnedTitles, ['col_title_tctv']);
        const bad = await titleFlair.handle(db, admin, 'aa', { action: 'equip', title: 'hash_god' }, 1800000000000);
        assert.strictEqual(bad.ok, false);
        const good = await titleFlair.handle(db, admin, 'aa', { action: 'equip', title: 'col_title_tctv', flair: '📺' }, 1800000000000);
        assert.strictEqual(good.ok, true);
        assert.strictEqual(db.docs['users/aa'].activeTitle, 'col_title_tctv');
        assert.strictEqual(db.docs['users/aa'].chatFlairEmoji, '📺');
        await titleFlair.handle(db, admin, 'aa', { action: 'equip', flair: null }, 1800000000000);
        assert.strictEqual(db.docs['users/aa'].chatFlairEmoji, undefined);
    });

    await test('rules: titles and flair are not client fields', function () {
        const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
        const list = rules.match(/function profileClientFields\(\) \{\s*return \[([\s\S]*?)\];/)[1];
        ['activeTitle', 'earnedTitles', 'chatFlairEmoji', 'earnedFlair', 'grandfatheredTitles', 'grandfatheredFlair'].forEach(function (f) {
            assert.ok(list.indexOf("'" + f + "'") < 0, f);
        });
        assert.ok(rules.indexOf('chatFlairOk(get(') > 0);
        ['badges.js', 'ranking.js', 'quests.js'].forEach(function (file) {
            const src = fs.readFileSync(path.join(root, file), 'utf8');
            assert.ok(!/update\(\{\s*(activeTitle|earnedTitles|chatFlairEmoji)\s*:/.test(src), file);
        });
    });

    await test('Proof of Walk tiers come from synced distance and streak', function () {
        const day = 86400000;
        const now = Date.parse('2026-11-05T12:00:00Z');
        const rows = [];
        for (let i = 0; i < 8; i++) rows.push({ distance: 7, date: new Date(now - i * day).toISOString().slice(0, 10) });
        rows.push({ distance: 43, date: '2026-01-01' });
        const ids = powBadges.planPowBadges(rows, now);
        ['pow_first_step', 'pow_km_10', 'pow_km_50', 'pow_marathoner', 'pow_streak_3', 'pow_streak_7'].forEach(function (id) { assert.ok(ids.indexOf(id) >= 0, id); });
        assert.ok(ids.indexOf('pow_km_100') < 0);
        assert.ok(ids.indexOf('pow_streak_30') < 0);
        assert.deepStrictEqual(powBadges.planPowBadges([], now), []);
        assert.deepStrictEqual(powBadges.planPowBadges([{ distance: 99999, date: '2026-11-05' }], now), ['pow_first_step']);
        powBadges.KM_TIERS.forEach(function (t) { assert.ok(collectionBonus.SERVER_VERIFIED.has(t[0]), t[0]); });
    });

    await test('Beats play tiers', function () {
        assert.deepStrictEqual(beatsPlays.playBadgesFor(0), []);
        assert.deepStrictEqual(beatsPlays.playBadgesFor(1), ['beats_first_listen']);
        assert.deepStrictEqual(beatsPlays.playBadgesFor(120), ['beats_first_listen', 'beats_50_plays', 'beats_100_plays']);
        beatsPlays.PLAY_TIERS.forEach(function (t) { assert.ok(collectionBonus.SERVER_VERIFIED.has(t[0]), t[0]); });
    });

    await test('settings title is one compact dropdown', function () {
        const src = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
        const section = src.slice(src.indexOf('window._renderTitleFlairSection'), src.indexOf('window._tfRepaint'));
        assert.ok(section.indexOf('id="tfTitleSelect"') !== -1);
        assert.ok(section.indexOf('class="tf-select"') !== -1);
        assert.ok(section.indexOf('optgroup label="Locked"') !== -1);
        assert.ok(section.indexOf('optgroup label="Unlocked"') !== -1);
        assert.strictEqual(section.indexOf("card('title'"), -1);
        assert.ok(section.indexOf("card('flair'") !== -1);
        assert.ok(src.indexOf('window._tfTitleChange = function') !== -1);
    });

    await test('profile_complete has a client def so it can be requested', function () {
        const src = fs.readFileSync(path.join(root, 'badges.js'), 'utf8');
        assert.ok(/id: 'profile_complete', name: 'Filled In'/.test(src));
    });

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
