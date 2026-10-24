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
        Timestamp: { fromMillis: function (ms) { return { _ms: ms }; } },
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
        assert.strictEqual(collectionBonus.requiredMembers(col).length, col.badgeIds.length, col.id);
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

queue.push(test('the daily cap tapers a remainder and a banned or incomplete user is not paid', async function () {
    assert.strictEqual(planDailyXp(500, 100).awarded, 50);
    const col = collectionBonus.collectionById('col_builder');
    const held = col.legacyBonuses.filter(function (row) { return row.pts === 500; })[0];
    const remainder = col.bonusPts - held.pts;
    assert.strictEqual(remainder, 150);
    const ids = collectionBonus.requiredMembers(col).concat([held.id]);
    const seed = seedAwards(ids, { 'users/u/daily_points/2026-10-24': { total: 500 } });
    const db = memoryDb(seed);
    const result = await collectionBonus.grantCollectionBonus(db, admin, 'u', col.id, { day: '2026-10-24', nowMs: 1700000000000 });
    assert.strictEqual(result.requested, 150);
    assert.strictEqual(result.xp, planDailyXp(500, 150).awarded);
    assert.strictEqual(result.xp, 75);
    assert.strictEqual(db.docs['users/u/daily_points/2026-10-24'].total, 575);
    const awardSrc = fs.readFileSync(path.join(root, 'functions/src/collectionBonus.js'), 'utf8');
    assert.ok(awardSrc.includes('applyDailyXp(uid, plan.remainder, t, { day: day, userRef: userRef })'));
    assert.ok(!awardSrc.includes('bypass: true'));

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
    assert.ok(!src.includes('--post-chat'));
    assert.ok(!src.includes("collection('xp_ledger')"));
    assert.ok(src.includes('serverHeldBadgeIds'));
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
    assert.ok(text.includes('before the daily cap'));
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
    const result = await collectionBonus.grantCollectionBonus(db, admin, 'u', col.id, { day: '2026-10-24', nowMs: now, postChat: false });
    assert.strictEqual(result.granted, true);
    assert.strictEqual(result.favor, true);
    const contributor = db.docs['satoshiFavor/current/contributors/u_badge_' + col.bonusId];
    assert.strictEqual(contributor.pointsAdded, 10);
    assert.strictEqual(contributor.source, 'badge_earned');
    assert.strictEqual(db.docs['satoshiFavor/userSfPoints/users/u'].points, 10);
    assert.strictEqual(db.docs['satoshiFavor/factionTotals'].cyber_hornets, 10);
    assert.strictEqual(db.docs['satoshiFavor/current'].points, 25);
    assert.strictEqual(db.docs['satoshiFavor/current'].favorActive, true);
    assert.strictEqual(db.docs['satoshiFavor/current'].bonusMinutes, 12);
    assert.strictEqual(chatDocs(db).length, 0);
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

    const proven = serverHeldBadgeIds({ hiddenBadges: col.badgeIds.slice() }, []);
    assert.strictEqual(collectionBonus.planGrant(col, proven).eligible, true);
    const listed = memoryDb({
        'users/u': { points: 0, hiddenBadges: col.badgeIds.slice(), visibleBadges: [] },
    });
    const paid = await collectionBonus.grantCollectionBonus(listed, admin, 'u', col.id, { day: '2026-10-24', nowMs: 1700000000000, postChat: false });
    assert.strictEqual(paid.granted, true);
    assert.strictEqual(paid.requested, 150);
}));

queue.push(test('Entertainment does not complete on its three non-cosmetic badges', async function () {
    const col = collectionBonus.collectionById('col_entertainment');
    assert.ok(col.badgeIds.length > 3);
    const three = ['tctv_daily_1', 'tctv_daily_7', 'tctv_daily_30'];
    three.forEach(function (id) { assert.ok(col.badgeIds.indexOf(id) !== -1, id); });
    const db = memoryDb(seedAwards(three));
    const result = await collectionBonus.grantCollectionBonus(db, admin, 'u', col.id, { day: '2026-10-24', nowMs: 1700000000000 });
    assert.strictEqual(result.reason, 'incomplete');
    assert.strictEqual(result.granted, false);
    assert.strictEqual(db.docs['users/u/badge_awards/' + col.bonusId], undefined);
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
    const msg = db.docs['global_chat/' + collectionBonus.collectionChatDocId(col.bonusId, 'fit_user')];
    assert.strictEqual(msg.mentionUid, 'fit_user');
    assert.ok(msg.text.indexOf('@TrailFan') !== -1);
    assert.ok(msg.text.indexOf('Fun and Fitness') !== -1);
}));

queue.push(test('a fresh day drops XP past the 1000 cap and the award trigger retries', function () {
    const report = {};
    collectionBonus.dailyCapReport().forEach(function (row) { report[row.id] = row; });
    assert.strictEqual(report.col_daily_habits.awarded, 1000);
    assert.strictEqual(report.col_daily_habits.dropped, 3150);
    assert.strictEqual(report.col_arena.awarded, 825);
    assert.strictEqual(report.col_arena.dropped, 325);
    assert.strictEqual(report.col_foresight.awarded, 750);
    assert.strictEqual(report.col_foresight.dropped, 250);
    assert.strictEqual(report.col_community.awarded, 650);
    assert.strictEqual(report.col_community.dropped, 150);
    assert.strictEqual(report.col_builder.awarded, 575);
    assert.strictEqual(report.col_builder.dropped, 75);
    ['col_learning', 'col_mining', 'col_lightning', 'col_entertainment', 'col_profile', 'col_fitness'].forEach(function (id) {
        assert.strictEqual(report[id].dropped, 0, id);
        assert.strictEqual(report[id].awarded, SERVER_BONUS[id], id);
    });
    const index = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    assert.ok(index.includes('exports.onBadgeAwardCreated'));
    assert.ok(index.includes("onDocumentCreated('users/{uid}/badge_awards/{badgeId}'"));
    assert.ok(index.includes('maybeGrantForBadge(db, admin, uid, badgeId)'));
    const awardSrc = fs.readFileSync(path.join(root, 'functions/src/awardBadge.js'), 'utf8');
    assert.ok(awardSrc.includes('[collectionBonus] retry'));
}));

Promise.all(queue).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
