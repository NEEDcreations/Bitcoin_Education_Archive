// Remainder rule for the 11 merged badge collections.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const collectionBonus = require('../functions/src/collectionBonus');
const { awardBadge } = require('../functions/src/awardBadge');
const { planDailyXp } = require('../functions/src/dailyXp');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;
const realPostCollectionCongrats = collectionBonus.postCollectionCongrats;
const failChatDbs = new WeakSet();
collectionBonus.postCollectionCongrats = async function (db, adminSdk, uid, col) {
    if (failChatDbs.has(db)) throw new Error('chat down');
    return realPostCollectionCongrats(db, adminSdk, uid, col);
};

function test(name, fn) {
    const run = fn();
    const ok = function () { console.log('✅ ' + name); passed++; };
    const bad = function (e) { console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e)); failed++; };
    if (run && typeof run.then === 'function') return run.then(ok, bad);
    try { ok(); } catch (e) { bad(e); }
    return Promise.resolve();
}

const admin = {
    firestore: {
        FieldValue: {
            serverTimestamp: function () { return { _serverTimestamp: true }; },
            increment: function (n) { return { _increment: n }; },
            arrayUnion: function () { return { _arrayUnion: Array.prototype.slice.call(arguments) }; },
        },
        Timestamp: {
            fromMillis: function (ms) { return { _ms: ms }; },
            now: function () { return { _serverNow: true }; },
        },
    },
};

function applyWrite(docs, docPath, data, update, merge) {
    const base = (update || merge) && docs[docPath] ? Object.assign({}, docs[docPath]) : {};
    const next = (update || merge) ? base : {};
    Object.keys(data || {}).forEach(function (key) {
        const value = data[key];
        if (value && value._increment != null) next[key] = (Number(next[key]) || 0) + value._increment;
        else if (value && value._arrayUnion) {
            const cur = Array.isArray(next[key]) ? next[key].slice() : [];
            value._arrayUnion.forEach(function (item) {
                if (cur.indexOf(item) === -1) cur.push(item);
            });
            next[key] = cur;
        } else next[key] = value;
    });
    docs[docPath] = next;
}

function memoryDb(seed) {
    const docs = Object.assign({}, seed || {});
    function collectionAt(prefix) {
        return {
            path: prefix,
            doc: function (id) { return ref(prefix + '/' + id); },
            get: async function () {
                const out = [];
                Object.keys(docs).forEach(function (p) {
                    const head = prefix + '/';
                    if (p.indexOf(head) !== 0) return;
                    const rest = p.slice(head.length);
                    if (!rest || rest.indexOf('/') !== -1) return;
                    out.push({
                        id: rest,
                        exists: true,
                        data: function () { return Object.assign({}, docs[p]); },
                    });
                });
                return {
                    empty: out.length === 0,
                    size: out.length,
                    docs: out,
                    forEach: function (fn) { out.forEach(fn); },
                };
            },
        };
    }
    function ref(docPath) {
        return {
            path: docPath,
            collection: function (name) { return collectionAt(docPath + '/' + name); },
            get: async function () {
                const data = docs[docPath];
                return { exists: data != null, data: function () { return data ? Object.assign({}, data) : undefined; } };
            },
        };
    }
    return {
        docs: docs,
        collection: function (name) {
            return { doc: function (id) { return ref(name + '/' + id); } };
        },
        runTransaction: async function (fn) {
            const staged = [];
            const t = {
                get: function (r) { return r.get(); },
                set: function (r, data, opts) {
                    staged.push({ path: r.path, data: data, merge: !!(opts && opts.merge) });
                },
                update: function (r, data) { staged.push({ path: r.path, data: data, update: true }); },
            };
            const result = await fn(t);
            staged.forEach(function (w) { applyWrite(docs, w.path, w.data, w.update, w.merge); });
            return result;
        },
    };
}

function seedAwards(ids, extra) {
    const docs = Object.assign({ 'users/u': { points: 0, visibleBadges: [] } }, extra || {});
    (ids || []).forEach(function (id) {
        docs['users/u/badge_awards/' + id] = { badge: id, xp: 0 };
        docs['users/u'].visibleBadges.push(id);
    });
    return docs;
}

const SERVER_BONUS = {
    col_learning: 300,
    col_daily_habits: 4150,
    col_mining: 500,
    col_foresight: 1000,
    col_arena: 1150,
    col_community: 800,
    col_lightning: 150,
    col_builder: 650,
    col_entertainment: 150,
    col_profile: 300,
    col_fitness: 0,
};

const APPROVED = {
    col_learning: ['set_scholar', 'set_scholar_daily', 'set_explorer', 'set_trails'],
    col_daily_habits: ['set_daily', 'set_daily_five', 'set_trifecta', 'set_streak', 'set_spin'],
    col_mining: ['set_miner', 'set_favor'],
    col_foresight: ['set_oracle', 'set_raffle'],
    col_arena: ['set_pvp', 'set_gladiator', 'set_codebreaker'],
    col_community: ['set_social', 'set_voice', 'set_network', 'set_irl'],
    col_lightning: ['set_lightning', 'set_generous'],
    col_builder: ['set_builder', 'set_trader'],
    col_entertainment: ['set_beats', 'set_tctv', 'set_tv'],
    col_profile: ['set_profile', 'set_newcomer', 'set_sovereign'],
    col_fitness: ['set_fun', 'set_pow'],
};

const NAMES = {
    set_scholar: 'The Scholar Set',
    set_scholar_daily: 'Daily Scholar',
    set_explorer: 'The Explorer Set',
    set_trails: 'The Trails Set',
    set_daily: 'The Daily Set',
    set_daily_five: 'Daily Five',
    set_trifecta: 'The Trifecta Set',
    set_streak: 'The Streak Set',
    set_spin: 'The Wheel Set',
    set_miner: 'The Miner Set',
    set_favor: 'Favor of Satoshi',
    set_oracle: 'Oracle',
    set_raffle: 'Raffle Regular',
    set_pvp: 'The Fighter Set',
    set_gladiator: 'Gladiator',
    set_codebreaker: 'Codebreaker',
    set_social: 'The Social Set',
    set_voice: 'Community Voice',
    set_network: 'Peer Network',
    set_irl: 'The IRL Set',
    set_lightning: 'The Lightning Set',
    set_generous: 'Open Hand',
    set_builder: 'The Builder Set',
    set_trader: 'Open for Business',
    set_beats: 'The Beats Set',
    set_tctv: 'The Timechain TV Set',
    set_tv: 'Prime Time',
    set_profile: 'The Profile Set',
    set_newcomer: 'Welcome Aboard',
    set_sovereign: 'Sovereign Setup',
    set_fun: 'The Calendar Set',
    set_pow: 'The Proof of Walk Set',
};

const queue = [];

queue.push(test('remainder floors at 0 for none, some, and all of the old bonuses', function () {
    assert.strictEqual(collectionBonus.remainderXp(100, []), 100);
    assert.strictEqual(collectionBonus.remainderXp(100, [40]), 60);
    assert.strictEqual(collectionBonus.remainderXp(100, [{ pts: 40 }, { pts: 60 }]), 0);
    assert.strictEqual(collectionBonus.remainderXp(100, [{ pts: 40 }, { pts: 80 }]), 0);
    const col = collectionBonus.collectionById('col_entertainment');
    assert.strictEqual(col.bonusPts, 150);
    assert.strictEqual(col.bonusPts, col.legacyBonuses.reduce(function (sum, row) { return sum + row.pts; }, 0));
    assert.strictEqual(collectionBonus.remainderXp(col.bonusPts, []), col.bonusPts);
    assert.strictEqual(collectionBonus.remainderXp(col.bonusPts, [col.legacyBonuses[0]]), col.bonusPts - col.legacyBonuses[0].pts);
    assert.strictEqual(collectionBonus.remainderXp(col.bonusPts, col.legacyBonuses), 0);
}));

queue.push(test('the 32 sets map onto the 11 approved collections once each', function () {
    const badges = fs.readFileSync(path.join(root, 'badges.js'), 'utf8');
    const sets = collectionBonus.parseSets(badges);
    assert.strictEqual(sets.length, 32);
    const seen = {};
    collectionBonus.GROUPS.forEach(function (group) {
        assert.deepStrictEqual(group.setIds, APPROVED[group.id], group.id);
        group.setIds.forEach(function (id) {
            assert.strictEqual(seen[id], undefined, id);
            seen[id] = group.id;
            const set = sets.filter(function (row) { return row.id === id; })[0];
            assert.ok(set, id);
            assert.strictEqual(set.name, NAMES[id], id);
        });
    });
    sets.forEach(function (set) { assert.ok(seen[set.id], set.id); });
    assert.strictEqual(Object.keys(seen).length, 32);
    const saved = JSON.parse(fs.readFileSync(path.join(root, 'functions/src/collection-sets.json'), 'utf8'));
    assert.strictEqual(saved.length, 32);
    assert.deepStrictEqual(saved.map(function (row) { return row.id; }), sets.map(function (row) { return row.id; }));
    const groups = badges.slice(badges.indexOf('var BADGE_COLLECTION_GROUPS'), badges.indexOf('function _shortCollectionSetName'));
    collectionBonus.GROUPS.forEach(function (group) {
        assert.ok(groups.includes("collectionId: '" + group.collectionId + "'") || groups.includes("collectionId: '" + group.id + "'"), group.id);
        group.setIds.forEach(function (id) { assert.ok(groups.includes("'" + id + "'"), id); });
    });
    assert.ok(!/id:\s*'col_/.test(badges));
    const claim = badges.slice(badges.indexOf('window._claimSetBonus'), badges.indexOf('window._checkBadgeSets'));
    assert.ok(!claim.includes('awardPoints'));
    const check = badges.slice(badges.indexOf('window._checkBadgeSets'), badges.indexOf('Community Badge Distribution'));
    assert.ok(!check.includes('_claimSetBonus'));
    let bonusSum = 0;
    collectionBonus.collections().forEach(function (col) {
        assert.strictEqual(col.bonusPts, col.legacyBonuses.reduce(function (sum, row) { return sum + row.pts; }, 0), col.id);
        assert.strictEqual(col.bonusPts, SERVER_BONUS[col.id], col.id);
        const proof = collectionBonus.proofMemberIds(col);
        const required = collectionBonus.requiredMembers(col);
        assert.deepStrictEqual(required, proof.length ? proof : col.badgeIds.slice(), col.id);
        assert.ok(required.length <= col.badgeIds.length, col.id);
        required.forEach(function (id) { assert.ok(col.badgeIds.indexOf(id) !== -1, id); });
        bonusSum += col.bonusPts;
        const groupLine = groups.slice(groups.indexOf(col.id), groups.indexOf(col.id) + 700);
        assert.ok(groupLine.includes('serverBonusPts: ' + col.bonusPts), col.id);
    });
    assert.strictEqual(bonusSum, 9150);
}));

queue.push(test('a retired set bonus is not paid even when its members are held', async function () {
    const db = memoryDb({
        'users/u': { points: 10, visibleBadges: [] },
        'users/u/badge_awards/daily_five_1': { badge: 'daily_five_1' },
    });
    const result = await awardBadge(db, admin, 'u', 'set_daily_five', { day: '2026-10-24', nowMs: 1700000000000 });
    assert.strictEqual(result.granted, false);
    assert.strictEqual(result.reason, 'retired');
    assert.strictEqual(result.xp, 0);
    assert.strictEqual(db.docs['users/u'].points, 10);
    assert.strictEqual(db.docs['users/u/badge_awards/set_daily_five'], undefined);
    assert.strictEqual(db.docs['users/u/xp_ledger/set_daily_five'], undefined);
}));

async function grantEntertainment(extraIds, dailyTotal) {
    const col = collectionBonus.collectionById('col_entertainment');
    const ids = collectionBonus.requiredMembers(col).concat(extraIds || []);
    const seed = seedAwards(ids);
    if (dailyTotal != null) seed['users/u/daily_points/2026-10-24'] = { total: dailyTotal };
    const db = memoryDb(seed);
    const result = await collectionBonus.grantCollectionBonus(db, admin, 'u', col.id, { day: '2026-10-24', nowMs: 1700000000000 });
    return { col: col, db: db, result: result };
}

queue.push(test('a finished collection pays the full bonus when no old bonus is held', async function () {
    const { col, db, result } = await grantEntertainment([], 0);
    const expect = planDailyXp(0, col.bonusPts);
    assert.strictEqual(result.granted, true);
    assert.strictEqual(result.requested, col.bonusPts);
    assert.strictEqual(result.xp, expect.awarded);
    const ledger = db.docs['users/u/xp_ledger/' + col.bonusId];
    assert.strictEqual(ledger.source, 'collection_bonus');
    assert.strictEqual(ledger.requested, col.bonusPts);
    assert.strictEqual(ledger.awarded, expect.awarded);
    assert.ok(db.docs['users/u'].visibleBadges.indexOf(col.bonusId) !== -1);
    assert.strictEqual(db.docs['satoshiFavor/userSfPoints/users/u'].points, 10);
}));

queue.push(test('a finished collection subtracts the old bonuses already held', async function () {
    const col = collectionBonus.collectionById('col_entertainment');
    const held = col.legacyBonuses.filter(function (row) { return row.id === 'set_tv'; })[0];
    assert.strictEqual(held.pts, 150);
    const { db, result } = await grantEntertainment([held.id], 0);
    const remainder = col.bonusPts - held.pts;
    const expect = planDailyXp(0, remainder);
    assert.strictEqual(result.granted, true);
    assert.strictEqual(result.requested, remainder);
    assert.strictEqual(result.xp, expect.awarded);
    assert.strictEqual(db.docs['users/u/xp_ledger/' + col.bonusId].requested, remainder);
    assert.strictEqual(db.docs['satoshiFavor/userSfPoints/users/u'].points, 10);
}));

queue.push(test('holding every old bonus pays nothing more and still records the badge once', async function () {
    const col = collectionBonus.collectionById('col_entertainment');
    const { db, result } = await grantEntertainment(col.legacyBonuses.map(function (row) { return row.id; }), 0);
    assert.strictEqual(result.granted, true);
    assert.strictEqual(result.requested, 0);
    assert.strictEqual(result.xp, 0);
    assert.strictEqual(db.docs['users/u/xp_ledger/' + col.bonusId].awarded, 0);
    assert.strictEqual(db.docs['users/u'].points, 0);
    assert.strictEqual(db.docs['satoshiFavor/userSfPoints/users/u'].points, 10);
    const again = await collectionBonus.grantCollectionBonus(db, admin, 'u', col.id, { day: '2026-10-24', nowMs: 1700000000000 });
    assert.strictEqual(again.reason, 'already');
    assert.strictEqual(again.granted, false);
    assert.strictEqual(db.docs['satoshiFavor/userSfPoints/users/u'].points, 10);
    assert.strictEqual(db.docs['users/u'].points, 0);
}));

queue.push(test('a full-cap day still pays the full collection bonus and a second grant is already', async function () {
    assert.strictEqual(planDailyXp(500, 100).awarded, 50);
    assert.strictEqual(planDailyXp(1000, 4150).awarded, 0);
    const col = collectionBonus.collectionById('col_builder');
    const held = col.legacyBonuses.filter(function (row) { return row.pts === 500; })[0];
    const remainder = col.bonusPts - held.pts;
    assert.strictEqual(remainder, 150);
    const ids = collectionBonus.requiredMembers(col).concat([held.id]);
    const seed = seedAwards(ids, { 'users/u/daily_points/2026-10-24': { total: 1000 } });
    const db = memoryDb(seed);
    const result = await collectionBonus.grantCollectionBonus(db, admin, 'u', col.id, { day: '2026-10-24', nowMs: 1700000000000, postChat: false });
    assert.strictEqual(result.granted, true);
    assert.strictEqual(result.requested, 150);
    assert.strictEqual(result.xp, 150);
    assert.strictEqual(result.dropped, 0);
    assert.strictEqual(result.capped, false);
    assert.strictEqual(db.docs['users/u'].points, 150);
    assert.strictEqual(db.docs['users/u/daily_points/2026-10-24'].total, 1000);
    assert.strictEqual(db.docs['users/u'].payingBadgeCount, undefined);
    const ledger = db.docs['users/u/xp_ledger/' + col.bonusId];
    assert.strictEqual(ledger.source, 'collection_bonus');
    assert.strictEqual(ledger.awarded, 150);
    assert.strictEqual(ledger.dropped, 0);
    assert.strictEqual(db.docs['users/u/badge_awards/' + col.bonusId].congratsPending, false);
    const again = await collectionBonus.grantCollectionBonus(db, admin, 'u', col.id, { day: '2026-10-24', nowMs: 1700000000000 });
    assert.strictEqual(again.reason, 'already');
    assert.strictEqual(again.granted, false);
    assert.strictEqual(db.docs['users/u'].points, 150);
    assert.strictEqual(db.docs['users/u/daily_points/2026-10-24'].total, 1000);
    assert.strictEqual(db.docs['satoshiFavor/userSfPoints/users/u'].points, 10);

    const habits = collectionBonus.collectionById('col_daily_habits');
    const habitsDb = memoryDb(seedAwards(collectionBonus.requiredMembers(habits), {
        'users/u/daily_points/2026-10-24': { total: 1000 },
    }));
    const paid = await collectionBonus.grantCollectionBonus(habitsDb, admin, 'u', habits.id, { day: '2026-10-24', nowMs: 1700000000000, postChat: false });
    assert.strictEqual(paid.granted, true);
    assert.strictEqual(paid.xp, 4150);
    assert.strictEqual(habitsDb.docs['users/u'].points, 4150);
    assert.strictEqual(habitsDb.docs['users/u/daily_points/2026-10-24'].total, 1000);
    assert.strictEqual(habitsDb.docs['users/u/xp_ledger/' + habits.bonusId].source, 'collection_bonus');
    const habitsAgain = await collectionBonus.grantCollectionBonus(habitsDb, admin, 'u', habits.id, { day: '2026-10-24', nowMs: 1700000000000 });
    assert.strictEqual(habitsAgain.reason, 'already');
    assert.strictEqual(habitsDb.docs['users/u'].points, 4150);

    const awardSrc = fs.readFileSync(path.join(root, 'functions/src/collectionBonus.js'), 'utf8');
    assert.ok(!awardSrc.includes('applyDailyXp('));
    assert.ok(!awardSrc.includes('bypass: true'));
    assert.ok(!awardSrc.includes("collection('daily_points')"));
    assert.ok(!awardSrc.includes('dailyRef'));
    assert.ok(!awardSrc.includes('payingBadgeCount'));
    assert.ok(awardSrc.includes("source: 'collection_bonus'"));
    const indexSrc = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    assert.ok(!indexSrc.includes('grantCollectionBonus'));

    const banned = memoryDb(seedAwards(collectionBonus.requiredMembers(col), {
        'users/u': { points: 4, ban_reason: 'ledger', visibleBadges: collectionBonus.requiredMembers(col).slice() },
    }));
    const blocked = await collectionBonus.grantCollectionBonus(banned, admin, 'u', col.id, { day: '2026-10-24', nowMs: 1700000000000 });
    assert.strictEqual(blocked.reason, 'banned');
    assert.strictEqual(blocked.granted, false);
    assert.strictEqual(banned.docs['users/u'].points, 4);
    assert.strictEqual(banned.docs['users/u/xp_ledger/' + col.bonusId], undefined);
    assert.strictEqual(banned.docs['satoshiFavor/userSfPoints/users/u'], undefined);

    const missing = collectionBonus.requiredMembers(col).slice(1);
    const incomplete = memoryDb(seedAwards(missing));
    const early = await collectionBonus.grantCollectionBonus(incomplete, admin, 'u', col.id, { day: '2026-10-24', nowMs: 1700000000000 });
    assert.strictEqual(early.reason, 'incomplete');
    assert.strictEqual(early.granted, false);
    assert.strictEqual(incomplete.docs['users/u/xp_ledger/' + col.bonusId], undefined);
}));

queue.push(test('the dry-run backfill prints counts and does not apply unless asked', function () {
    const script = require('../functions/scripts/backfill_collection_bonus');
    assert.strictEqual(script.parseArgs([]).apply, false);
    assert.strictEqual(script.parseArgs(['--apply']).apply, true);
    assert.strictEqual(script.parseArgs(['--apply', '--post-chat']).postChat, undefined);
    assert.strictEqual(script.favorPointsFor({ payUsers: 2, zeroRemainder: 1 }), 30);
    const src = fs.readFileSync(path.join(root, 'functions/scripts/backfill_collection_bonus.js'), 'utf8');
    assert.ok(src.includes('if (require.main === module)'));
    assert.ok(src.includes('postChat: false'));
    assert.ok(src.includes('ggSkip'));
    assert.ok(!src.includes('--post-chat'));
    assert.ok(!src.includes("collection('xp_ledger')"));
    assert.ok(src.includes('heldIdsForCollection'));
    assert.ok(src.includes('backfill: true'));
    assert.ok(!src.includes('profileBadgeIds'));
    assert.ok(!src.includes('console.log(uid'));
    assert.ok(!src.includes('console.log(email'));
    const lines = [];
    const orig = console.log;
    console.log = function (line) { lines.push(String(line)); };
    try {
        script.printCounts({
            scanned: 3,
            bannedSkipped: 1,
            collections: {
                col_learning: { name: 'Learning', complete: 1, already: 0, payUsers: 1, remainderXp: 1650, zeroRemainder: 0 },
            },
        }, false);
    } finally {
        console.log = orig;
    }
    const text = lines.join('\n');
    assert.ok(text.includes('scanned 3'));
    assert.ok(text.includes('banned skipped 1'));
    assert.ok(text.includes('remainderXp 1650'));
    assert.ok(text.includes('mode dry-run'));
    assert.ok(text.includes('paid in full and is not limited by the daily cap'));
    assert.ok(!text.includes('before the daily cap'));
    assert.ok(!text.includes('EXCEEDS'));
    assert.ok(!text.includes('[collection-bonus] cap '));
    assert.ok(text.includes('favorPoints 10'));
    assert.ok(text.includes('at 10 per recorded bonus'));
    assert.ok(text.includes('chat posts off'));
    assert.ok(!text.includes('@'));
}));

function chatDocs(db) {
    return Object.keys(db.docs).filter(function (key) { return key.indexOf('global_chat/') === 0; });
}

queue.push(test('ten Favor points use the contributor total and the multi-point pool', async function () {
    const { planFavorPoints, planFavorPoint } = require('../functions/src/favorPool');
    const now = 1700000000000;
    assert.strictEqual(planFavorPoint({ points: 0 }, now).points, 1);
    assert.strictEqual(planFavorPoints({ points: 0 }, now, 10).points, 10);
    assert.strictEqual(planFavorPoints({ points: 0 }, now, 10).favorActive, false);
    const crossed = planFavorPoints({ points: 15 }, now, 10);
    assert.strictEqual(crossed.points, 25);
    assert.strictEqual(crossed.favorActive, true);
    assert.strictEqual(crossed.activated, true);
    assert.strictEqual(crossed.bonusMinutes, 12);
    const extended = planFavorPoints({ points: 21, favorActive: true, bonusMinutes: 170, favorEndBase: { toMillis: function () { return now + 60000; } } }, now, 10);
    assert.strictEqual(extended.bonusMinutes, 180);
    assert.strictEqual(extended.points, 21);

    const col = collectionBonus.collectionById('col_builder');
    const seed = seedAwards(collectionBonus.requiredMembers(col), {
        'satoshiFavor/current': { points: 15, favorActive: false, bonusMinutes: 0 },
        'users/u': { points: 0, visibleBadges: collectionBonus.requiredMembers(col).slice(), faction: 'cyber_hornets' },
    });
    const db = memoryDb(seed);
    const result = await collectionBonus.grantCollectionBonus(db, admin, 'u', col.id, { day: '2026-10-24', nowMs: now });
    assert.strictEqual(result.granted, true);
    assert.strictEqual(result.favor, true);
    const contributor = db.docs['satoshiFavor/current/contributors/u_badge_' + col.bonusId];
    assert.strictEqual(contributor.pointsAdded, 10);
    assert.strictEqual(contributor.source, 'badge_earned');
    assert.strictEqual(contributor.backfill, undefined);
    assert.strictEqual(db.docs['satoshiFavor/userSfPoints/users/u'].points, 10);
    assert.strictEqual(db.docs['satoshiFavor/factionTotals'].cyber_hornets, 10);
    assert.strictEqual(db.docs['satoshiFavor/current'].points, 25);
    assert.strictEqual(db.docs['satoshiFavor/current'].favorActive, true);
    assert.strictEqual(db.docs['satoshiFavor/current'].bonusMinutes, 12);

    const backfill = memoryDb(seedAwards(collectionBonus.requiredMembers(col), {
        'satoshiFavor/current': { points: 15, favorActive: false, bonusMinutes: 0 },
        'users/u': { points: 0, visibleBadges: collectionBonus.requiredMembers(col).slice(), faction: 'cyber_hornets' },
    }));
    const quiet = await collectionBonus.grantCollectionBonus(backfill, admin, 'u', col.id, { day: '2026-10-24', nowMs: now, postChat: false, backfill: true });
    assert.strictEqual(quiet.granted, true);
    assert.strictEqual(quiet.favor, true);
    const quietRow = backfill.docs['satoshiFavor/current/contributors/u_badge_' + col.bonusId];
    assert.strictEqual(quietRow.backfill, true);
    assert.strictEqual(quietRow.pointsAdded, 10);
    assert.strictEqual(backfill.docs['satoshiFavor/userSfPoints/users/u'].points, 10);
    assert.strictEqual(backfill.docs['satoshiFavor/factionTotals'].cyber_hornets, 10);
    assert.strictEqual(backfill.docs['satoshiFavor/current'].points, 15);
    assert.strictEqual(backfill.docs['satoshiFavor/current'].favorActive, false);
    assert.strictEqual(backfill.docs['satoshiFavor/current'].currentCycleId, undefined);
    assert.strictEqual(chatDocs(backfill).length, 0);
    const { shouldAnnounceLive } = require('../functions/src/favorLiveAnnounce');
    assert.strictEqual(shouldAnnounceLive(
        { points: 15, favorActive: false },
        backfill.docs['satoshiFavor/current']
    ), false);
}));

queue.push(test('Nacho tags a public username once and skips Anonymous', async function () {
    const col = collectionBonus.collectionById('col_learning');
    const now = 1700000000000;
    const uid = 'learner_1';
    function seed(username) {
        const ids = collectionBonus.requiredMembers(col);
        const docs = { 'users/learner_1': { points: 0, visibleBadges: ids.slice() } };
        ids.forEach(function (id) {
            docs['users/learner_1/badge_awards/' + id] = { badge: id, xp: 0 };
        });
        if (username != null) docs['public_profiles/learner_1'] = { username: username };
        return memoryDb(docs);
    }

    const tagged = seed('SatoshiFan');
    const first = await collectionBonus.grantCollectionBonus(tagged, admin, uid, col.id, { day: '2026-10-24', nowMs: now });
    assert.strictEqual(first.granted, true);
    assert.strictEqual(first.chatPosted, true);
    const docId = collectionBonus.collectionChatDocId(col.bonusId, uid);
    const msg = tagged.docs['global_chat/' + docId];
    assert.strictEqual(msg.uid, 'nacho-bot');
    assert.strictEqual(msg.isNachoAuto, false);
    assert.strictEqual(msg.mentionUid, uid);
    assert.strictEqual(msg.text, collectionBonus.collectionCongratsText('SatoshiFan', col.name));
    assert.ok(msg.text.indexOf('@SatoshiFan') !== -1);
    assert.ok(msg.text.indexOf('Learning') !== -1);
    assert.strictEqual(/anonymous/i.test(msg.text), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(msg, 'mentions'), false);
    const note = tagged.docs['notifications/' + docId];
    assert.strictEqual(note.type, 'chat_mention');
    assert.strictEqual(note.recipientId, uid);
    assert.strictEqual(note.senderId, 'nacho-bot');
    assert.strictEqual(note.targetType, 'chat');
    assert.strictEqual(note.targetId, docId);
    const again = await collectionBonus.postCollectionCongrats(tagged, admin, uid, col);
    assert.strictEqual(again.wrote, false);
    assert.strictEqual(chatDocs(tagged).length, 1);
    const second = await collectionBonus.grantCollectionBonus(tagged, admin, uid, col.id, { day: '2026-10-24', nowMs: now });
    assert.strictEqual(second.reason, 'already');
    assert.strictEqual(chatDocs(tagged).length, 1);
    assert.strictEqual(tagged.docs['satoshiFavor/userSfPoints/users/' + uid].points, 10);

    const quiet = seed('SatoshiFan');
    const recorded = await collectionBonus.grantCollectionBonus(quiet, admin, uid, col.id, { day: '2026-10-24', nowMs: now, postChat: false });
    assert.strictEqual(recorded.granted, true);
    assert.strictEqual(recorded.chatPosted, undefined);
    assert.strictEqual(quiet.docs['users/' + uid + '/badge_awards/' + col.bonusId].congratsPending, false);
    assert.strictEqual(chatDocs(quiet).length, 0);
    assert.strictEqual(quiet.docs['notifications/' + docId], undefined);
    assert.strictEqual(quiet.docs['satoshiFavor/userSfPoints/users/' + uid].points, 10);

    for (const name of [undefined, '', 'Anonymous', 'anonymous', 'ANONYMOUS']) {
        const db = seed(name);
        const result = await collectionBonus.grantCollectionBonus(db, admin, uid, col.id, { day: '2026-10-24', nowMs: now });
        assert.strictEqual(result.chatPosted, true, String(name));
        const row = db.docs['global_chat/' + docId];
        assert.strictEqual(row.mentionUid, undefined, String(name));
        assert.strictEqual(row.text.indexOf('@'), -1, String(name));
        assert.ok(row.text.indexOf('A Bitcoiner') !== -1, String(name));
        assert.ok(row.text.indexOf(col.name) !== -1, String(name));
        assert.strictEqual(/anonymous/i.test(row.text), false, String(name));
        assert.strictEqual(db.docs['notifications/' + docId], undefined, String(name));
    }

    const bannedSeed = seed('SatoshiFan');
    bannedSeed.docs['users/learner_1'].ban_reason = 'ledger';
    const bannedDb = memoryDb(bannedSeed.docs);
    const blocked = await collectionBonus.grantCollectionBonus(bannedDb, admin, uid, col.id, { day: '2026-10-24', nowMs: now });
    assert.strictEqual(blocked.reason, 'banned');
    assert.strictEqual(chatDocs(bannedDb).length, 0);
    assert.strictEqual(bannedDb.docs['notifications/' + docId], undefined);
    assert.strictEqual(collectionBonus.mentionUsername({ username: 'Anonymous' }), '');
    assert.strictEqual(collectionBonus.mentionUsername({ username: 'SatoshiFan' }), 'SatoshiFan');
}));

queue.push(test('earnedHidden plus one cheap award does not complete a collection', async function () {
    const { serverHeldBadgeIds } = require('../functions/src/badgeProfile');
    const col = collectionBonus.collectionById('col_entertainment');
    const cheap = 'tctv_daily_1';
    assert.ok(col.badgeIds.indexOf(cheap) !== -1);
    const stuffed = {
        points: 0,
        earnedHidden: col.badgeIds.slice(),
        displayBadge: col.badgeIds[0],
        equippedBadge: col.badgeIds[1],
        visibleBadges: [],
        badges: [],
        hiddenBadges: [],
        donationBadges: [],
    };
    const forged = serverHeldBadgeIds(stuffed, [cheap]);
    assert.strictEqual(collectionBonus.planGrant(col, forged).reason, 'incomplete');
    col.badgeIds.forEach(function (id) {
        forged.add('xp_ledger_should_not_count');
    });
    const docs = {
        'users/u': stuffed,
        'users/u/badge_awards/tctv_daily_1': { badge: cheap, xp: 10 },
    };
    col.badgeIds.forEach(function (id) {
        docs['users/u/xp_ledger/' + id] = { source: 'client_noise', amount: 1 };
    });
    const db = memoryDb(docs);
    const result = await collectionBonus.grantCollectionBonus(db, admin, 'u', col.id, { day: '2026-10-24', nowMs: 1700000000000 });
    assert.strictEqual(result.granted, false);
    assert.strictEqual(result.reason, 'incomplete');
    assert.strictEqual(db.docs['users/u/xp_ledger/' + col.bonusId], undefined);
    assert.strictEqual(db.docs['users/u'].points, 0);

    const hiddenOnly = serverHeldBadgeIds({ hiddenBadges: col.badgeIds.slice() }, []);
    assert.strictEqual(collectionBonus.planGrant(col, hiddenOnly).reason, 'incomplete');
    const hiddenDb = memoryDb({
        'users/u': { points: 0, hiddenBadges: col.badgeIds.slice(), visibleBadges: [], badges: [], donationBadges: [] },
    });
    const hiddenPaid = await collectionBonus.grantCollectionBonus(hiddenDb, admin, 'u', col.id, { day: '2026-10-24', nowMs: 1700000000000, postChat: false });
    assert.strictEqual(hiddenPaid.granted, false);
    assert.strictEqual(hiddenPaid.reason, 'incomplete');
    assert.strictEqual(hiddenDb.docs['users/u/xp_ledger/' + col.bonusId], undefined);

    const corroborated = serverHeldBadgeIds({
        hiddenBadges: collectionBonus.requiredMembers(col).slice(),
        visibleBadges: collectionBonus.requiredMembers(col).slice(),
    }, []);
    assert.strictEqual(collectionBonus.planGrant(col, corroborated).eligible, true);
}));

queue.push(test('client profile fields cannot mint an award or complete a collection', async function () {
    const { awardBadge } = require('../functions/src/awardBadge');
    const { legacyAwardCounts, heldIdsForCollection } = require('../functions/src/badgeProfile');
    const col = collectionBonus.collectionById('col_daily_habits');
    const members = collectionBonus.requiredMembers(col);
    const day = { day: '2026-10-24', nowMs: 1700000000000 };
    const clientFields = {
        points: 0,
        displayBadge: members[0],
        equippedBadge: members[1],
        earnedHidden: members.slice(),
        visibleBadges: [],
        badges: [],
        donationBadges: [],
        hiddenBadges: [],
    };
    assert.strictEqual(legacyAwardCounts(clientFields, members[0]), false);
    const minted = memoryDb({ 'users/u': clientFields });
    const attempt = await awardBadge(minted, admin, 'u', members[0], day);
    assert.notStrictEqual(attempt.reason, 'legacy');
    assert.strictEqual(attempt.granted, false);
    assert.strictEqual(minted.docs['users/u/badge_awards/' + members[0]], undefined);
    assert.strictEqual(minted.docs['users/u'].points, 0);
    assert.strictEqual(minted.docs['satoshiFavor/current'], undefined);

    const legacyRows = {};
    const forgedDocs = { 'users/u': clientFields };
    members.forEach(function (id) {
        legacyRows[id] = { badge: id, xp: 0, source: 'legacy' };
        forgedDocs['users/u/badge_awards/' + id] = legacyRows[id];
    });
    assert.strictEqual(collectionBonus.planGrant(col, heldIdsForCollection(clientFields, legacyRows)).reason, 'incomplete');
    const forged = memoryDb(forgedDocs);
    const paid = await collectionBonus.grantCollectionBonus(forged, admin, 'u', col.id, day);
    assert.strictEqual(paid.granted, false);
    assert.strictEqual(paid.reason, 'incomplete');
    assert.strictEqual(forged.docs['users/u/xp_ledger/' + col.bonusId], undefined);
    assert.strictEqual(forged.docs['users/u'].points, 0);
    assert.strictEqual(forged.docs['satoshiFavor/userSfPoints/users/u'], undefined);
    const triggered = await collectionBonus.maybeGrantForBadge(forged, admin, 'u', members[0], day);
    assert.ok(triggered.every(function (row) { return row.granted !== true; }));
    assert.strictEqual(forged.docs['users/u/badge_awards/' + col.bonusId], undefined);

    const backedUser = {
        points: 0,
        visibleBadges: members.slice(),
        badges: [],
        donationBadges: [],
        hiddenBadges: [],
    };
    const backedDocs = { 'users/u': backedUser };
    members.forEach(function (id) {
        backedDocs['users/u/badge_awards/' + id] = { badge: id, xp: 0, source: 'legacy' };
    });
    assert.strictEqual(legacyAwardCounts(backedUser, members[0]), true);
    const backed = memoryDb(backedDocs);
    const real = await collectionBonus.grantCollectionBonus(backed, admin, 'u', col.id, Object.assign({ postChat: false }, day));
    assert.strictEqual(real.granted, true);
    assert.ok(real.xp > 0);
}));

queue.push(test('Entertainment pays 150 when its three server-proof badges are held', async function () {
    const col = collectionBonus.collectionById('col_entertainment');
    assert.strictEqual(col.badgeIds.length, 28);
    assert.strictEqual(collectionBonus.requiredMembers(col).length, 3);
    assert.strictEqual(col.bonusPts, 150);
    const three = ['tctv_daily_1', 'tctv_daily_7', 'tctv_daily_30'];
    assert.deepStrictEqual(collectionBonus.requiredMembers(col), three);
    const partial = memoryDb(seedAwards(three.slice(0, 2)));
    const missing = await collectionBonus.grantCollectionBonus(partial, admin, 'u', col.id, { day: '2026-10-24', nowMs: 1700000000000, postChat: false });
    assert.strictEqual(missing.reason, 'incomplete');
    assert.strictEqual(missing.granted, false);
    const db = memoryDb(seedAwards(three));
    const result = await collectionBonus.grantCollectionBonus(db, admin, 'u', col.id, { day: '2026-10-24', nowMs: 1700000000000, postChat: false });
    assert.strictEqual(result.granted, true);
    assert.strictEqual(result.requested, 150);
    assert.strictEqual(result.xp, 150);
    assert.notStrictEqual(result.requested, 1500);
}));

queue.push(test('Daily Habits deducts the 2000 the server paid for Trifecta and Streak', async function () {
    const col = collectionBonus.collectionById('col_daily_habits');
    assert.strictEqual(col.bonusPts, 4150);
    const trifecta = col.legacyBonuses.filter(function (row) { return row.id === 'set_trifecta_complete'; })[0];
    const streak = col.legacyBonuses.filter(function (row) { return row.id === 'set_streak_complete'; })[0];
    const dailyFive = col.legacyBonuses.filter(function (row) { return row.id === 'set_daily_five'; })[0];
    assert.strictEqual(trifecta.pts, 2000);
    assert.strictEqual(streak.pts, 2000);
    assert.strictEqual(dailyFive.pts, 150);

    async function grant(extra) {
        const ids = collectionBonus.requiredMembers(col).concat(extra);
        const db = memoryDb(seedAwards(ids));
        const result = await collectionBonus.grantCollectionBonus(db, admin, 'u', col.id, { day: '2026-10-24', nowMs: 1700000000000, postChat: false });
        return result;
    }
    const both = await grant(['set_trifecta_complete', 'set_streak_complete']);
    assert.strictEqual(both.granted, true);
    assert.strictEqual(both.requested, 150);
    assert.strictEqual(both.xp, 150);
    const allPaying = await grant(['set_trifecta_complete', 'set_streak_complete', 'set_daily_five']);
    assert.strictEqual(allPaying.granted, true);
    assert.strictEqual(allPaying.requested, 0);
    assert.strictEqual(allPaying.xp, 0);
    const fresh = planDailyXp(0, 4150);
    assert.strictEqual(fresh.awarded, 1000);
    assert.strictEqual(fresh.dropped, 3150);
}));

queue.push(test('Fun and Fitness pays no XP and still records Favor and the congrats', async function () {
    const col = collectionBonus.collectionById('col_fitness');
    assert.strictEqual(col.bonusPts, 0);
    assert.strictEqual(collectionBonus.requiredMembers(col).length, 19);
    const ids = collectionBonus.requiredMembers(col);
    const docs = seedAwards(ids, {
        'users/fit_user': { points: 0, visibleBadges: ids.slice() },
        'public_profiles/fit_user': { username: 'TrailFan' },
    });
    delete docs['users/u'];
    Object.keys(docs).forEach(function (key) {
        if (key.indexOf('users/u/') === 0) delete docs[key];
    });
    ids.forEach(function (id) {
        docs['users/fit_user/badge_awards/' + id] = { badge: id, xp: 0 };
    });
    const db = memoryDb(docs);
    const result = await collectionBonus.grantCollectionBonus(db, admin, 'fit_user', col.id, { day: '2026-10-24', nowMs: 1700000000000 });
    assert.strictEqual(result.granted, true);
    assert.strictEqual(result.requested, 0);
    assert.strictEqual(result.xp, 0);
    assert.strictEqual(db.docs['users/fit_user'].points, 0);
    assert.strictEqual(db.docs['satoshiFavor/userSfPoints/users/fit_user'].points, 10);
    assert.strictEqual(result.chatPosted, true);
    assert.strictEqual(db.docs['users/fit_user/badge_awards/' + col.bonusId].congratsPending, false);
    const msg = db.docs['global_chat/' + collectionBonus.collectionChatDocId(col.bonusId, 'fit_user')];
    assert.strictEqual(msg.mentionUid, 'fit_user');
    assert.ok(msg.text.indexOf('@TrailFan') !== -1);
    assert.ok(msg.text.indexOf('Fun and Fitness') !== -1);
}));

queue.push(test('a failed congrats stays pending and the next grant posts once', async function () {
    const col = collectionBonus.collectionById('col_builder');
    const db = memoryDb(seedAwards(collectionBonus.requiredMembers(col), {
        'public_profiles/u': { username: 'BuilderFan' },
    }));
    failChatDbs.add(db);
    let threw = false;
    try {
        await collectionBonus.grantCollectionBonus(db, admin, 'u', col.id, { day: '2026-10-24', nowMs: 1700000000000 });
    } catch (err) {
        threw = err && err.message === 'chat down' && err.collectionChat === true && err.grantResult && err.grantResult.granted === true && err.grantResult.congratsPending === true;
    } finally {
        failChatDbs.delete(db);
    }
    assert.strictEqual(threw, true);
    assert.strictEqual(db.docs['users/u/badge_awards/' + col.bonusId].congratsPending, true);
    assert.strictEqual(db.docs['users/u/badge_awards/' + col.bonusId].source, 'collection_bonus');
    assert.strictEqual(chatDocs(db).length, 0);
    assert.strictEqual(db.docs['satoshiFavor/userSfPoints/users/u'].points, 10);
    const second = await collectionBonus.grantCollectionBonus(db, admin, 'u', col.id, { day: '2026-10-24', nowMs: 1700000000000 });
    assert.strictEqual(second.reason, 'already');
    assert.strictEqual(second.granted, false);
    assert.strictEqual(second.chatPosted, true);
    assert.strictEqual(db.docs['users/u/badge_awards/' + col.bonusId].congratsPending, false);
    assert.strictEqual(chatDocs(db).length, 1);
    assert.strictEqual(db.docs['satoshiFavor/userSfPoints/users/u'].points, 10);
    const third = await collectionBonus.grantCollectionBonus(db, admin, 'u', col.id, { day: '2026-10-24', nowMs: 1700000000000 });
    assert.strictEqual(third.reason, 'already');
    assert.strictEqual(third.chatPosted, undefined);
    assert.strictEqual(chatDocs(db).length, 1);

    const quiet = memoryDb(seedAwards(collectionBonus.requiredMembers(col)));
    const recorded = await collectionBonus.grantCollectionBonus(quiet, admin, 'u', col.id, { day: '2026-10-24', nowMs: 1700000000000, postChat: false });
    assert.strictEqual(recorded.granted, true);
    assert.strictEqual(quiet.docs['users/u/badge_awards/' + col.bonusId].congratsPending, false);
    assert.strictEqual(chatDocs(quiet).length, 0);
    assert.strictEqual(quiet.docs['users/u'].payingBadgeCount, undefined);
}));

queue.push(test('the award trigger skips unrelated badges and retries a pending congrats', async function () {
    assert.strictEqual(collectionBonus.collectionsTouching('not_a_member').length, 0);
    assert.strictEqual(collectionBonus.collectionsTouching('set_tv').length, 0);
    const overlap = collectionBonus.collectionsTouching('tctv_daily_1').map(function (col) { return col.id; }).sort();
    assert.deepStrictEqual(overlap, ['col_daily_habits', 'col_entertainment']);
    const sayHi = memoryDb(seedAwards(['say_hi_1']));
    assert.strictEqual(await collectionBonus.awardAlreadySettled(sayHi, 'u', 'say_hi_1', {}), true);
    const col = collectionBonus.collectionById('col_entertainment');
    const pendingDocs = seedAwards(collectionBonus.requiredMembers(col));
    pendingDocs['users/u'].visibleBadges.push(col.bonusId);
    pendingDocs['users/u/badge_awards/' + col.bonusId] = { badge: col.bonusId, source: 'collection_bonus', congratsPending: true, xp: 150 };
    pendingDocs['users/u/xp_ledger/' + col.bonusId] = { source: 'collection_bonus', awarded: 150 };
    const pendingDb = memoryDb(pendingDocs);
    assert.strictEqual(await collectionBonus.awardAlreadySettled(pendingDb, 'u', col.bonusId, { congratsPending: true }), false);
    const posted = await collectionBonus.maybeGrantForBadge(pendingDb, admin, 'u', col.bonusId, { day: '2026-10-24', nowMs: 1700000000000 });
    assert.strictEqual(posted.length, 1);
    assert.strictEqual(posted[0].reason, 'already');
    assert.strictEqual(posted[0].chatPosted, true);
    assert.strictEqual(pendingDb.docs['users/u/badge_awards/' + col.bonusId].congratsPending, false);
    assert.strictEqual(chatDocs(pendingDb).length, 1);
    assert.strictEqual(pendingDb.docs['users/u'].points, 0);
    assert.strictEqual(await collectionBonus.awardAlreadySettled(pendingDb, 'u', col.bonusId, {}), true);

    const index = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    assert.strictEqual((index.match(/exports\.onBadgeAwardCreated\s*=/g) || []).length, 1);
    const block = index.slice(index.indexOf('exports.onBadgeAwardCreated'), index.indexOf('exports.onBadgeAwardCreated') + 2200);
    assert.ok(block.includes('exports.onBadgeAwardCreated'));
    assert.ok(block.includes("document: 'users/{uid}/badge_awards/{badgeId}'"));
    assert.ok(block.includes('retry: true'));
    assert.ok(!block.includes('maxInstances'));
    assert.ok(block.includes('queueBadgeGg(db, admin, uid, badgeId, data, Date.now())'));
    assert.ok(block.includes("data.source || '') === 'legacy'"));
    assert.ok(block.includes('legacyAwardCounts(user, badgeId)'));
    assert.ok(block.includes('collectionsTouching(badgeId)'));
    assert.ok(block.includes('awardAlreadySettled(db, uid, badgeId, data)'));
    assert.ok(block.includes('maybeGrantForBadge(db, admin, uid, badgeId)'));
    const awardSrc = fs.readFileSync(path.join(root, 'functions/src/awardBadge.js'), 'utf8');
    assert.ok(awardSrc.includes('[collectionBonus] retry'));
    assert.ok(awardSrc.includes('const result = await db.runTransaction'));
    assert.ok(awardSrc.includes('nowMs: result.nowMs'));
    assert.ok(awardSrc.includes('day: result.day'));
    const clockAt = awardSrc.indexOf('const nowMs = Number(options.nowMs) || Date.now();');
    const txAt = awardSrc.indexOf('const result = await db.runTransaction');
    assert.ok(txAt > 0 && clockAt > txAt);
    const badges = fs.readFileSync(path.join(root, 'badges.js'), 'utf8');
    assert.ok(badges.includes('XP bonus (not limited by the daily cap)'));
    assert.ok(badges.includes('_collectionMemberLists'));
    assert.ok(badges.includes('optional'));
    assert.ok(!badges.includes("(+ ' + col.bonusPts"));
    assert.ok(badges.includes('function _collectionRemainder'));
    assert.ok(badges.includes('window.BADGE_COLLECTION_PAY'));
    assert.ok(!badges.includes('_collectionBonusCopy(col.bonusPts)'));
    const bonusSrc = fs.readFileSync(path.join(root, 'functions/src/collectionBonus.js'), 'utf8');
    assert.ok(!bonusSrc.includes('failChat'));
    const clientSrc = fs.readFileSync(path.join(root, 'badges.catalog.js'), 'utf8');
    const clientStart = clientSrc.indexOf('window.BADGE_CATALOG=') + 'window.BADGE_CATALOG='.length;
    const clientEnd = clientSrc.indexOf(';\nwindow.BADGE_CATALOG_VERSION');
    const client = JSON.parse(clientSrc.slice(clientStart, clientEnd));
    collectionBonus.collections().forEach(function (row) {
        const flagged = row.badgeIds.filter(function (id) { return client[id] && client[id].serverAward === true; });
        const proof = collectionBonus.proofMemberIds(row).slice().sort();
        flagged.sort();
        assert.deepStrictEqual(flagged, proof, row.id);
    });
}));

queue.push(test('the collection card remainder matches the server subtraction', function () {
    const vm = require('vm');
    const badges = fs.readFileSync(path.join(root, 'badges.js'), 'utf8');
    const start = badges.indexOf('function _collectionRemainder');
    const end = badges.indexOf('function _collectionMemberLists');
    assert.ok(start > 0 && end > start);
    const clientSrc = fs.readFileSync(path.join(root, 'badges.catalog.js'), 'utf8');
    const payStart = clientSrc.indexOf('window.BADGE_COLLECTION_PAY=');
    assert.ok(payStart > 0);
    const pay = JSON.parse(clientSrc.slice(payStart + 'window.BADGE_COLLECTION_PAY='.length).replace(/;\s*$/, ''));
    const remainder = vm.runInNewContext(badges.slice(start, end) + '\n_collectionRemainder(col, earned);', {
        window: { BADGE_COLLECTION_PAY: pay },
        col: { id: 'col_daily_habits' },
        earned: new Set(['set_trifecta_complete', 'set_streak_complete']),
    });
    assert.strictEqual(remainder, 150);
    const none = vm.runInNewContext(badges.slice(start, end) + '\n_collectionRemainder(col, earned);', {
        window: { BADGE_COLLECTION_PAY: pay },
        col: { id: 'col_daily_habits' },
        earned: new Set(),
    });
    assert.strictEqual(none, 4150);
    const missing = vm.runInNewContext(badges.slice(start, end) + '\n_collectionRemainder(col, earned);', {
        window: {},
        col: { id: 'col_daily_habits' },
        earned: new Set(),
    });
    assert.strictEqual(missing, 0);
    collectionBonus.collections().forEach(function (col) {
        const row = pay[col.id];
        assert.ok(row, col.id);
        assert.strictEqual(row.bonusPts, col.bonusPts, col.id);
        assert.deepStrictEqual(row.legacy.map(function (item) { return item.id + ':' + item.pts; }), col.legacyBonuses.map(function (item) { return item.id + ':' + item.pts; }));
        const held = new Set(col.legacyBonuses.map(function (item) { return item.id; }));
        const shown = vm.runInNewContext(badges.slice(start, end) + '\n_collectionRemainder(col, earned);', {
            window: { BADGE_COLLECTION_PAY: pay },
            col: { id: col.id },
            earned: held,
        });
        assert.strictEqual(shown, collectionBonus.remainderXp(col.bonusPts, col.legacyBonuses), col.id);
    });
}));

queue.push(test('a quiet collection award skips GGs and an expired window stamps lastReset', async function () {
    const col = collectionBonus.collectionById('col_builder');
    const now = 1700000000000;
    const members = collectionBonus.requiredMembers(col);
    const quiet = memoryDb(seedAwards(members));
    const skipped = await collectionBonus.grantCollectionBonus(quiet, admin, 'u', col.id, { day: '2026-10-24', nowMs: now, postChat: false });
    assert.strictEqual(skipped.granted, true);
    assert.strictEqual(skipped.favor, true);
    const quietAward = quiet.docs['users/u/badge_awards/' + col.bonusId];
    assert.strictEqual(quietAward.ggSkip, true);
    assert.strictEqual(quietAward.favorPoint, false);
    assert.strictEqual(quietAward.congratsPending, false);
    assert.strictEqual(quietAward.source, 'collection_bonus');
    assert.strictEqual(quiet.docs['satoshiFavor/current/contributors/u_badge_' + col.bonusId].backfill, true);
    assert.strictEqual(quiet.docs['satoshiFavor/current'], undefined);
    assert.strictEqual(quiet.docs['satoshiFavor/userSfPoints/users/u'].points, 10);
    assert.strictEqual(chatDocs(quiet).length, 0);

    const live = memoryDb(seedAwards(members, {
        'public_profiles/u': { username: 'BuilderFan' },
    }));
    const posted = await collectionBonus.grantCollectionBonus(live, admin, 'u', col.id, { day: '2026-10-24', nowMs: now });
    const liveAward = live.docs['users/u/badge_awards/' + col.bonusId];
    assert.strictEqual(posted.chatPosted, true);
    assert.strictEqual(liveAward.favorPoint, true);
    assert.strictEqual(liveAward.ggSkip, true);
    assert.strictEqual(chatDocs(live).length, 1);
    const badgeGg = require('../functions/src/badgeGg');
    assert.strictEqual(badgeGg.skipBadgeGg({ source: 'collection_bonus', ggSkip: true, favorPoint: true }), true);
    assert.strictEqual(badgeGg.skipBadgeGg({ source: 'collection_bonus', favorPoint: true }), false);
    const openBurst = memoryDb({
        'users/u': { username: 'BuilderFan' },
        'badge_gg_bursts/u': {
            uid: 'u',
            startedAtMs: now - 120000,
            flushAfterMs: now - 60000,
            posted: false,
            items: [{ badgeId: 'say_hi_1', favorPoint: true }],
        },
    });
    const skippedBurst = await badgeGg.queueBadgeGg(openBurst, admin, 'u', col.bonusId, liveAward, now);
    assert.strictEqual(skippedBurst.reason, 'skip');
    assert.strictEqual(openBurst.docs['badge_gg_bursts/u'].posted, false);
    assert.strictEqual(Object.keys(openBurst.docs).some(function (key) { return key.indexOf('announcements/') === 0; }), false);
    assert.strictEqual(openBurst.docs['badge_gg_claims/u__' + col.bonusId], undefined);
    const wouldFlush = await badgeGg.queueBadgeGg(openBurst, admin, 'u', col.bonusId, {
        source: 'collection_bonus',
        favorPoint: true,
    }, now);
    assert.strictEqual(wouldFlush.queued, true);
    assert.strictEqual(Object.keys(openBurst.docs).some(function (key) { return key.indexOf('announcements/badgegg_') === 0; }), true);

    const open = memoryDb(seedAwards(members, {
        'satoshiFavor/current': {
            points: 21,
            favorActive: true,
            bonusMinutes: 10,
            favorEndBase: { toMillis: function () { return now + 60000; } },
        },
    }));
    const extended = await collectionBonus.grantCollectionBonus(open, admin, 'u', col.id, { day: '2026-10-24', nowMs: now });
    assert.strictEqual(extended.favor, true);
    const openAward = open.docs['users/u/badge_awards/' + col.bonusId];
    assert.strictEqual(openAward.favorPoint, false);
    assert.strictEqual(openAward.ggSkip, true);
    assert.strictEqual(open.docs['satoshiFavor/current'].lastReset, undefined);

    const expired = memoryDb(seedAwards(members, {
        'satoshiFavor/current': {
            points: 21,
            favorActive: true,
            bonusMinutes: 0,
            eraHashes: 7,
            currentCycleId: 'cycle_old',
            lastReset: { _ms: 1 },
            favorEndBase: { toMillis: function () { return now - 60000; } },
        },
    }));
    const reset = await collectionBonus.grantCollectionBonus(expired, admin, 'u', col.id, { day: '2026-10-24', nowMs: now });
    assert.strictEqual(reset.favor, true);
    const state = expired.docs['satoshiFavor/current'];
    assert.deepStrictEqual(state.lastReset, { _serverNow: true });
    assert.strictEqual(state.eraHashes, 7);
    assert.strictEqual(state.favorActive, false);
    assert.strictEqual(state.points, 10);
    assert.strictEqual(expired.docs['satoshiFavor/lastWindow'].cycleId, 'cycle_old');
    assert.strictEqual(expired.docs['users/u/badge_awards/' + col.bonusId].ggSkip, true);
    assert.strictEqual(expired.docs['users/u/badge_awards/' + col.bonusId].favorPoint, true);
    const src = fs.readFileSync(path.join(root, 'functions/scripts/backfill_collection_bonus.js'), 'utf8');
    assert.ok(src.includes('postChat: false'));
    assert.ok(src.includes('ggSkip'));
}));

queue.push(test('a failed congrats retry is logged granted false and stays pending', async function () {
    const col = collectionBonus.collectionById('col_entertainment');
    const pendingDocs = seedAwards(collectionBonus.requiredMembers(col));
    pendingDocs['users/u'].visibleBadges.push(col.bonusId);
    pendingDocs['users/u/badge_awards/' + col.bonusId] = { badge: col.bonusId, source: 'collection_bonus', congratsPending: true, xp: 150 };
    pendingDocs['users/u/xp_ledger/' + col.bonusId] = { source: 'collection_bonus', awarded: 150 };
    const db = memoryDb(pendingDocs);
    failChatDbs.add(db);
    let caught = null;
    try {
        await collectionBonus.maybeGrantForBadge(db, admin, 'u', col.bonusId, { day: '2026-10-24', nowMs: 1700000000000 });
    } catch (err) {
        caught = err;
    } finally {
        failChatDbs.delete(db);
    }
    assert.ok(caught && caught.collectionChat === true);
    assert.strictEqual(caught.grantResult.reason, 'already');
    assert.strictEqual(caught.grantResult.granted, false);
    assert.strictEqual(caught.chatReport.granted, false);
    assert.strictEqual(caught.chatReport.congratsPending, true);
    assert.strictEqual(caught.chatReport.reason, 'chat');
    assert.strictEqual(db.docs['users/u/badge_awards/' + col.bonusId].congratsPending, true);
    assert.strictEqual(chatDocs(db).length, 0);
    assert.ok(!fs.readFileSync(path.join(root, 'functions/src/collectionBonus.js'), 'utf8').includes('failChat'));
}));

Promise.all(queue).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
