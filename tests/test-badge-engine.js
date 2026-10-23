// Badge rule engine, trifecta proof, daily-five gate, listing cap, message dedup.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const badgeRules = require('../functions/src/badgeRules');
const { grantBadgeIfEarned } = require('../functions/src/grantBadge');
const { awardBadge } = require('../functions/src/awardBadge');
const { favorSourceAllowed } = require('../functions/src/satoshiFavor');
const dailyFive = require('../functions/src/dailyFive');
const { countMarketplaceListing } = require('../functions/src/marketListingCount');
const { countMarketplaceMessage } = require('../functions/src/marketMessages');
const { heldThatFail } = require('../functions/src/badgeDistribution');
const progressBadges = require('../functions/src/progressBadges');

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
    },
};

function memoryDb(seed) {
    const docs = Object.assign({}, seed || {});
    function ref(docPath) {
        return {
            path: docPath,
            collection: function (name) {
                return { doc: function (id) { return ref(docPath + '/' + name + '/' + id); } };
            },
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
                set: function (r, data) { staged.push({ path: r.path, data: data }); },
                update: function (r, data) { staged.push({ path: r.path, data: data, update: true }); },
            };
            const result = await fn(t);
            staged.forEach(function (w) {
                if (w.update) {
                    const next = Object.assign({}, docs[w.path]);
                    Object.keys(w.data).forEach(function (key) {
                        const value = w.data[key];
                        if (value && value._increment) next[key] = (next[key] || 0) + value._increment;
                        else if (value && value._arrayUnion) {
                            const cur = Array.isArray(next[key]) ? next[key].slice() : [];
                            value._arrayUnion.forEach(function (item) {
                                if (cur.indexOf(item) === -1) cur.push(item);
                            });
                            next[key] = cur;
                        } else next[key] = value;
                    });
                    docs[w.path] = next;
                } else {
                    docs[w.path] = w.data;
                }
            });
            return result;
        },
    };
}

const queue = [];

queue.push(test('paying badges stay within the XP cap and cosmetic badges pay nothing', function () {
    assert.strictEqual(badgeRules.xpOf('satoshis_cipher'), 5000);
    assert.strictEqual(badgeRules.xpOf('donor_100000'), 5000);
    assert.strictEqual(badgeRules.xpOf('donor_100'), 10);
    assert.strictEqual(badgeRules.xpOf('flex_findq_1'), 2);
    assert.strictEqual(badgeRules.isCosmetic('quest_1'), false);
    assert.strictEqual(badgeRules.isCosmetic('night_owl'), true);
    assert.strictEqual(badgeRules.isCosmetic('lq_mining'), false);
    assert.strictEqual(badgeRules.isCosmetic('trail_meadow'), true);
    assert.strictEqual(badgeRules.isCosmetic('speed_runner'), true);
    assert.ok(badgeRules.xpOf('satoshis_cipher') <= 5000);
    const legend = badgeRules.ruleFor('chat_legend');
    assert.ok(!legend || legend.cosmetic || !legend.source || legend.source.type !== 'counter');
}));

queue.push(test('market, hash, and peer rules read server counters', function () {
    const market = badgeRules.ruleFor('market_listed_5');
    assert.strictEqual(market.xp, 75);
    assert.strictEqual(market.source.field, 'marketListings');
    assert.strictEqual(badgeRules.meets(market, { marketListings: 5 }, {}), true);
    assert.strictEqual(badgeRules.meets(market, { marketListings: 4 }, {}), false);
    const hashes = badgeRules.ruleFor('sf_100000_hashes');
    assert.strictEqual(hashes.xp, 5000);
    assert.strictEqual(badgeRules.meets(hashes, { sfHashes: 100000 }, {}), true);
    assert.strictEqual(badgeRules.meets(hashes, { totalHashes: 100000 }, {}), false);
    assert.strictEqual(badgeRules.ruleFor('peer_1').xp, 25);
    assert.strictEqual(badgeRules.ruleFor('say_hi_1').xp, 15);
    assert.strictEqual(badgeRules.ruleFor('daily_five_1').xp, 50);
    assert.strictEqual(badgeRules.ruleFor('set_daily_five').source.type, 'set');
}));

queue.push(test('a badge grant skips every ban flag', async function () {
    async function grant(seed) {
        const db = memoryDb(seed);
        const result = await grantBadgeIfEarned(db, admin, 'u', 'say_hi_1', { day: '2026-10-22' });
        return { result: result, award: db.docs['users/u/badge_awards/say_hi_1'] };
    }
    const paid = await grant({ 'users/u': { sayHiDays: 1, points: 0 } });
    assert.strictEqual(paid.result.granted, true);
    assert.ok(paid.award);
    for (const seed of [
        { 'users/u': { sayHiDays: 1, ban_reason: 'ledger' } },
        { 'users/u': { sayHiDays: 1, banned: true } },
        { 'users/u': { sayHiDays: 1, satsDisabled: true } },
        { 'users/u': { sayHiDays: 1 }, 'faucet_ledger/u': { banned: true } },
    ]) {
        const blocked = await grant(seed);
        assert.strictEqual(blocked.result.granted, false, JSON.stringify(seed));
        assert.strictEqual(blocked.result.reason, 'banned');
        assert.strictEqual(blocked.award, undefined);
    }
}));

queue.push(test('the all-five badge pays from the TV claim and skips every ban', async function () {
    assert.strictEqual(dailyFive.TCTV_WATCH_DEPLOYED, true);
    assert.strictEqual(dailyFive.tctvClaimId('2026-10-22'), '2026-10-22_tctv_watch_ticket');
    const off = await dailyFive.maybeCompleteDailyFive({ tctvWatchDeployed: false });
    assert.strictEqual(off.reason, 'tctv_not_deployed');
    const proofs = { trivia: true, quest: true, poll: true, sayHi: true, tctv: true };
    const day = '2026-10-22';
    async function run(seed) {
        const db = memoryDb(seed);
        const result = await dailyFive.maybeCompleteDailyFive({
            db: db, admin: admin, uid: 'u', day: day, proofs: proofs,
        });
        return { result: result, db: db };
    }
    const paid = await run({ 'users/u': { points: 0, orangeTickets: 0 } });
    assert.strictEqual(paid.result.ok, true);
    assert.strictEqual(paid.result.result.awarded, 100);
    assert.strictEqual(paid.db.docs['users/u'].orangeTickets, 1);
    assert.strictEqual(paid.db.docs['users/u'].dailyFiveDays, 1);
    assert.ok(paid.db.docs['users/u/daily_action_counts/' + day + '_daily_five']);
    const claimDb = memoryDb({
        'users/u/daily_action_counts/2026-10-22_trivia': { count: 1 },
        'users/u/daily_action_counts/2026-10-22_quest': { count: 1 },
        'polls/2026-10-22/votes/u': { chosenIdx: 0 },
        'users/u/daily_action_counts/2026-10-22_say_hi': { count: 1 },
        'users/u/award_claims/2026-10-22_tctv_watch_ticket': { action: 'tctv_watch_ticket', day: day },
    });
    const seen = await dailyFive.proofsFor(claimDb, 'u', day);
    assert.strictEqual(seen.tctv, true);
    const missingTv = Object.assign({}, proofs, { tctv: false });
    const noTv = await dailyFive.maybeCompleteDailyFive({
        db: memoryDb({ 'users/u': {} }), admin: admin, uid: 'u', day: day, proofs: missingTv,
    });
    assert.strictEqual(noTv.reason, 'incomplete');
    for (const seed of [
        { 'users/u': { ban_reason: 'ledger' } },
        { 'users/u': { banned: true } },
        { 'users/u': { satsDisabled: true } },
        { 'users/u': {}, 'faucet_ledger/u': { banned: true } },
    ]) {
        const blocked = await run(seed);
        assert.strictEqual(blocked.result.ok, false, JSON.stringify(seed));
        assert.strictEqual(blocked.result.result.reason, 'banned');
        assert.strictEqual(blocked.db.docs['users/u/daily_action_counts/' + day + '_daily_five'], undefined);
    }
    let called = 0;
    const miss = await dailyFive.maybeCompleteTrifecta({
        uid: 'u', day: '2026-10-22',
        proofs: { trivia: true, quest: true, poll: false },
        creditDailyAllThree: async function () { called++; return { created: true }; },
    });
    assert.strictEqual(miss.reason, 'incomplete');
    assert.strictEqual(called, 0);
    const hit = await dailyFive.maybeCompleteTrifecta({
        uid: 'u', day: '2026-10-22',
        proofs: { trivia: true, quest: true, poll: true },
        creditDailyAllThree: async function () { called++; return { already: true }; },
    });
    assert.strictEqual(hit.ok, true);
    assert.strictEqual(called, 1);
}));

queue.push(test('a seller counts at most three listings per server day', async function () {
    const db = memoryDb({ 'users/seller1': { marketListings: 0 } });
    for (let i = 1; i <= 3; i++) {
        const result = await countMarketplaceListing({
            db: db, admin: admin, listingId: 'list' + i, data: { sellerUid: 'seller1', status: 'active' }, nowMs: Date.parse('2026-10-22T12:00:00Z'),
        });
        assert.strictEqual(result.counted, true, 'listing ' + i);
    }
    const fourth = await countMarketplaceListing({
        db: db, admin: admin, listingId: 'list4', data: { sellerUid: 'seller1', status: 'active' }, nowMs: Date.parse('2026-10-22T18:00:00Z'),
    });
    assert.strictEqual(fourth.counted, false);
    assert.strictEqual(fourth.reason, 'daily_cap');
    assert.strictEqual(db.docs['users/seller1'].marketListings, 3);
    assert.strictEqual(db.docs['market_listing_counts/list4'].counted, false);
}));

queue.push(test('a buyer message counts once per listing', async function () {
    const db = memoryDb({ 'users/buyer1': { marketMessages: 0 }, 'marketplace/list1': { sellerUid: 'seller1' } });
    const data = { buyerUid: 'buyer1', senderUid: 'buyer1', listingId: 'list1' };
    const first = await countMarketplaceMessage({ db: db, admin: admin, data: data });
    const second = await countMarketplaceMessage({ db: db, admin: admin, data: data });
    assert.strictEqual(first.counted, true);
    assert.strictEqual(second.reason, 'already_counted');
    assert.strictEqual(db.docs['users/buyer1'].marketMessages, 1);
    const seller = await countMarketplaceMessage({
        db: db, admin: admin, data: { buyerUid: 'buyer1', senderUid: 'seller1', listingId: 'list1' },
    });
    assert.strictEqual(seller.counted, false);
}));

queue.push(test('merge ignores client badge ids and awardPoints does not keyword-match', function () {
    const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    const mergeAt = index.indexOf('exports.mergeAnonBadges');
    const merge = index.slice(mergeAt, mergeAt + 1800);
    assert.ok(merge.includes('Client badge ids are ignored'));
    assert.ok(merge.includes('grantBadgeIfEarned'));
    assert.ok(!merge.includes('data.anonBadges'));
    const awardAt = index.indexOf('exports.awardPoints');
    const awardEnd = index.indexOf('exports.getFaucetStats', awardAt);
    const award = index.slice(awardAt, awardEnd);
    assert.ok(award.includes('awardActions.resolveAction'));
    assert.ok(award.includes('const tickets = 0'));
    assert.ok(award.includes('awardBadge'));
    assert.ok(award.includes('cosmetic: true'));
    const awardBadgeSrc = fs.readFileSync(path.join(root, 'functions', 'src', 'awardBadge.js'), 'utf8');
    assert.ok(awardBadgeSrc.includes('badgeRules.meets'));
    assert.ok(awardBadgeSrc.includes('rewardBlocked'));
    assert.ok(awardBadgeSrc.includes("uid + '_badge_' + badgeId"));
    assert.ok(!award.includes('ACTION_KEYWORDS'));
    assert.ok(!award.includes('TICKET_CAPS'));
    assert.ok(index.includes('exports.dailyPollVote'));
    assert.ok(index.includes('BADGE_CONDITION_NOT_MET'));
    assert.ok(index.includes("actionKey === 'prediction_correct'"));
}));

queue.push(test('user updates deny server fields and poll votes are server-only', function () {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const fnAt = rules.indexOf('function userProfileServerOnlyKeys()');
    assert.ok(fnAt > 0);
    const fn = rules.slice(fnAt, rules.indexOf('match /users/{userId}'));
    ['points', 'visibleBadges', 'hiddenBadges', 'marketListings', 'dailyTripleCount', 'badgeCounters', 'sayHiArmedDay', 'replyBonusCount', 'lastTriviaDate', 'lastPollDate', 'lastQuestDate', 'triviaStreak', 'flexTotals', 'flexAllDays', 'triviaCorrect', 'triviaStreakDay', 'questsPassed', 'lqPassed', 'spinDays', 'spinStreak', 'spinHitRare', 'spinClosetAwards', 'tipsVerified', 'tipsSentSats', 'tipsReceived', 'raidDamageAllTime', 'raidBossesDefeated', 'raidWins', 'streakFreezesUsed'].forEach(function (field) {
        assert.ok(fn.includes("'" + field + "'"), field + ' must stay server-only');
    });
    ['lqProgress', 'trailProgress', 'earnedTitles', 'nachoStoryProgress', 'spinCount', 'completedQuests', 'notificationPrefs', 'beatsShowUncensored', 'bio'].forEach(function (field) {
        assert.ok(!fn.includes("'" + field + "'"), field + ' is a live client save');
    });
    assert.ok(!fn.includes("'referredBy'"), 'referredBy stays out of userProfileServerOnlyKeys');
    assert.ok(!fn.includes("'mergedAnon'"), 'mergedAnon stays out of userProfileServerOnlyKeys');
    assert.ok(rules.includes('userProfileServerOnlyKeys()'));
    const updateRule = rules.slice(rules.indexOf('allow update: if request.auth'), rules.indexOf('allow delete: if false'));
    assert.ok(updateRule.includes("'referredBy'"), 'referredBy client write is denied');
    assert.ok(updateRule.includes("'mergedAnon'"), 'mergedAnon client write is denied');
    assert.ok(updateRule.indexOf("'referredBy'") < updateRule.indexOf('userProfileServerOnlyKeys()'));
    assert.ok(updateRule.indexOf("'mergedAnon'") < updateRule.indexOf('userProfileServerOnlyKeys()'));
    const polls = rules.slice(rules.indexOf('match /poll_votes/{pollId}'), rules.indexOf('match /poll_cumulative/'));
    assert.ok(polls.includes('allow read: if true'));
    assert.ok(polls.includes('allow create, update, delete: if false'));
    assert.ok(rules.includes('match /market_listing_daily/{docId}'));
    assert.ok(rules.includes('match /market_message_counts/{docId}'));
    assert.ok(rules.includes('match /market_sale_counts/{docId}'));
    assert.ok(rules.includes('match /polls/{dayId}/votes/{voteUid}'));
}));

queue.push(test('every badge grant adds one Favor point once', async function () {
    const now = 1700000000000;
    const db = memoryDb({ 'users/u': { sayHiDays: 1, points: 0, faction: 'cyber_hornets' } });
    const first = await awardBadge(db, admin, 'u', 'say_hi_1', { day: '2026-10-22', nowMs: now });
    const second = await awardBadge(db, admin, 'u', 'say_hi_1', { day: '2026-10-22', nowMs: now + 1000 });
    assert.strictEqual(first.granted, true);
    assert.strictEqual(first.favor, true);
    assert.strictEqual(first.xp, 15);
    assert.strictEqual(second.reason, 'already');
    assert.strictEqual(second.favor, false);
    assert.strictEqual(db.docs['satoshiFavor/current'].points, 1);
    assert.strictEqual(db.docs['satoshiFavor/current/contributors/u_badge_say_hi_1'].pointsAdded, 1);
    assert.strictEqual(db.docs['satoshiFavor/factionTotals'].cyber_hornets, 1);
    assert.ok(db.docs['users/u/badge_awards/say_hi_1']);
    const banned = memoryDb({ 'users/u': { sayHiDays: 1, banned: true } });
    const blocked = await awardBadge(banned, admin, 'u', 'say_hi_1', { day: '2026-10-22', nowMs: now });
    assert.strictEqual(blocked.reason, 'banned');
    assert.strictEqual(banned.docs['users/u/badge_awards/say_hi_1'], undefined);
    assert.strictEqual(banned.docs['satoshiFavor/current'], undefined);
}));

queue.push(test('an open Favor window extends and the caps hold', async function () {
    const now = 1700000000000;
    const hour = 60 * 60 * 1000;
    function endAt(ms) { return { toMillis: function () { return ms; } }; }
    const open = memoryDb({
        'users/u': { sayHiDays: 7, points: 0 },
        'satoshiFavor/current': { points: 25, favorActive: true, bonusMinutes: 0, favorEndBase: endAt(now + hour), favorStart: endAt(now) },
    });
    const extended = await awardBadge(open, admin, 'u', 'say_hi_7', { day: '2026-10-22', nowMs: now });
    assert.strictEqual(extended.favor, true);
    assert.strictEqual(open.docs['satoshiFavor/current'].bonusMinutes, 3);
    assert.strictEqual(open.docs['satoshiFavor/current'].points, 25);
    const cappedMin = memoryDb({
        'users/u': { sayHiDays: 30, points: 0 },
        'satoshiFavor/current': { points: 30, favorActive: true, bonusMinutes: 180, favorEndBase: endAt(now + hour), favorStart: endAt(now) },
    });
    await awardBadge(cappedMin, admin, 'u', 'say_hi_30', { day: '2026-10-22', nowMs: now });
    assert.strictEqual(cappedMin.docs['satoshiFavor/current'].bonusMinutes, 180);
    const cappedPts = memoryDb({
        'users/u': { sayHiDays: 1, points: 0 },
        'satoshiFavor/current': { points: 42, favorActive: false, bonusMinutes: 0 },
    });
    await awardBadge(cappedPts, admin, 'u', 'say_hi_1', { day: '2026-10-22', nowMs: now });
    assert.strictEqual(cappedPts.docs['satoshiFavor/current'].points, 42);
    assert.strictEqual(cappedPts.docs['satoshiFavor/current'].favorActive, true);
    const almost = memoryDb({
        'users/u': { sayHiDays: 100, points: 0 },
        'satoshiFavor/current': { points: 20, favorActive: false, bonusMinutes: 0 },
    });
    await awardBadge(almost, admin, 'u', 'say_hi_100', { day: '2026-10-22', nowMs: now });
    const opened = almost.docs['satoshiFavor/current'];
    assert.strictEqual(opened.points, 21);
    assert.strictEqual(opened.favorActive, true);
    assert.strictEqual(opened.favorEndBase.toMillis() - opened.favorStart.toMillis(), hour);
    const stale = memoryDb({
        'users/u': { peerCount: 1, points: 0 },
        'satoshiFavor/current': { points: 30, favorActive: true, bonusMinutes: 10, favorEndBase: endAt(now - hour), favorStart: endAt(now - 2 * hour) },
    });
    await awardBadge(stale, admin, 'u', 'peer_1', { day: '2026-10-22', nowMs: now });
    assert.strictEqual(stale.docs['satoshiFavor/current'].favorActive, false);
    assert.strictEqual(stale.docs['satoshiFavor/current'].points, 1);
}));

queue.push(test('the daily XP cap still grants the badge and Favor', async function () {
    const db = memoryDb({
        'users/u': { sayHiDays: 1, points: 10 },
        'users/u/daily_points/2026-10-22': { total: 1000 },
    });
    const result = await awardBadge(db, admin, 'u', 'say_hi_1', { day: '2026-10-22', nowMs: 1700000000000 });
    assert.strictEqual(result.granted, true);
    assert.strictEqual(result.xp, 0);
    assert.strictEqual(result.capped, true);
    assert.strictEqual(result.favor, true);
    assert.strictEqual(db.docs['users/u'].points, 10);
    assert.ok(db.docs['users/u/badge_awards/say_hi_1']);
    assert.strictEqual(db.docs['satoshiFavor/current'].points, 1);
}));

queue.push(test('clients cannot mint badge Favor or write hiddenBadges', function () {
    assert.strictEqual(favorSourceAllowed('badge_earned'), false);
    assert.strictEqual(favorSourceAllowed('daily_all_three'), true);
    const favor = fs.readFileSync(path.join(root, 'functions', 'src', 'satoshiFavor.js'), 'utf8');
    assert.ok(favor.includes('rewardBlocked'));
    assert.ok(!favor.includes("'badge_earned': 1"));
    ['badges.js', 'features.js', 'quests.js', 'ranking.js', 'learning-quests.js', 'modules.js'].forEach(function (name) {
        const src = fs.readFileSync(path.join(root, name), 'utf8');
        assert.ok(!src.includes("contributeSatoshiFavor('badge_earned'"), name);
    });
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const fnAt = rules.indexOf('function userProfileServerOnlyKeys()');
    const fn = rules.slice(fnAt, rules.indexOf('match /users/{userId}'));
    assert.ok(fn.includes("'hiddenBadges'"));
}));

queue.push(test('each activity family grants one Favor point from its server record', async function () {
    const day = { day: '2026-10-22', nowMs: 1700000000000 };
    async function earn(seed, id) {
        const db = memoryDb({ 'users/u': Object.assign({ points: 0 }, seed) });
        const result = await awardBadge(db, admin, 'u', id, day);
        return { result: result, db: db };
    }
    const families = [
        ['flex', { flexTotals: { findq: 1 } }, 'flex_findq_1', 2],
        ['learning quest', { lqPassed: ['lq_mining'] }, 'lq_mining', 100],
        ['quest', { questsPassed: 1 }, 'quest_1', 10],
        ['trivia', { triviaCorrect: 1 }, 'trivia_first', 10],
        ['spin', { spinDays: 1 }, 'spin_1', 10],
        ['raid', { raidDamageAllTime: 1 }, 'raid_first', 10],
        ['tip', { tipsVerified: 1 }, 'tip_first', 25],
        ['legacy peer', { peerCount: 0, peers: ['a'] }, 'first_peer', 50],
        ['genesis', { visitedChannelsList: ['whitepaper'] }, 'genesis', 75],
        ['streak freeze', { streakFreezesUsed: 1 }, 'streak_freeze', 50],
        ['ghost reader', { streak: 7, points: 0 }, 'ghost_reader', 500],
    ];
    for (let i = 0; i < families.length; i++) {
        const row = families[i];
        const paid = await earn(row[1], row[2]);
        assert.strictEqual(paid.result.granted, true, row[0]);
        assert.strictEqual(paid.result.favor, true, row[0]);
        assert.strictEqual(paid.result.xp, row[3], row[0]);
        assert.strictEqual(paid.db.docs['satoshiFavor/current'].points, 1, row[0]);
        assert.ok(paid.db.docs['users/u/badge_awards/' + row[2]], row[0]);
    }
    const peers = [];
    for (let n = 0; n < 10; n++) peers.push('p' + n);
    const network = await earn({ peerCount: 0, peers: peers }, 'peer_network_10');
    assert.strictEqual(network.result.granted, true);
    assert.strictEqual(network.result.favor, true);
    const zeroXp = await earn({ flexTotals: { steak: 10 } }, 'flex_steak_10');
    assert.strictEqual(zeroXp.result.granted, true);
    assert.strictEqual(zeroXp.result.xp, 0);
    assert.strictEqual(zeroXp.result.favor, true);
    assert.strictEqual(zeroXp.db.docs['users/u'].payingBadgeCount, undefined);
    const clientSpin = await earn({ spinCount: 100 }, 'spin_100');
    assert.strictEqual(clientSpin.result.granted, false);
    assert.strictEqual(clientSpin.result.reason, 'criteria');
    assert.strictEqual(clientSpin.db.docs['satoshiFavor/current'], undefined);
    for (const id of ['trail_meadow', 'speed_runner', 'night_owl', 'marathon', 'nacho_friend']) {
        const cosmetic = await earn({}, id);
        assert.strictEqual(cosmetic.result.cosmetic, true, id);
        assert.strictEqual(cosmetic.result.awarded, 0, id);
        assert.strictEqual(cosmetic.db.docs['users/u/badge_awards/' + id], undefined, id);
        assert.strictEqual(cosmetic.db.docs['satoshiFavor/current'], undefined, id);
    }
    const continued = progressBadges.progressSpec({ triviaStreakDay: '2026-10-21' }, 'trivia_correct', {}, '2026-10-22');
    assert.strictEqual(continued.inc.triviaCorrect, 1);
    assert.strictEqual(continued.inc.triviaStreak, 1);
    const reset = progressBadges.progressSpec({ triviaStreakDay: '2026-10-01' }, 'trivia_correct', {}, '2026-10-22');
    assert.strictEqual(reset.set.triviaStreak, 1);
    const lesson = progressBadges.progressSpec({}, 'lq_lesson', { target: 'MiningProofofWork' }, '2026-10-22');
    assert.strictEqual(lesson.union.lqPassed, 'lq_mining');
    const flex = progressBadges.progressSpec({}, 'flex_action', { flexId: 'findq' }, '2026-10-22');
    assert.strictEqual(flex.inc['flexTotals.findq'], 1);
    const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    const quest = index.slice(index.indexOf('exports.gradeQuest'), index.indexOf('exports.issueCertificate'));
    assert.ok(quest.includes('questsPassed'));
    const spin = index.slice(index.indexOf('exports.dailySpin'), index.indexOf('exports.pvpStoreAnswerKey'));
    assert.ok(spin.includes('spinDays'));
    assert.ok(spin.includes('spinHitRare'));
    assert.ok(index.includes('streakFreezesUsed'));
    const tip = fs.readFileSync(path.join(root, 'functions', 'src', 'tipService.js'), 'utf8');
    assert.ok(tip.includes('tipsVerified'));
    assert.ok(tip.includes('tipsSentSats'));
    assert.ok(tip.includes('tipsReceived'));
    const raid = fs.readFileSync(path.join(root, 'functions', 'src', 'contributeRaid.js'), 'utf8');
    assert.ok(raid.includes('raidDamageAllTime'));
    assert.ok(raid.includes('raidBossesDefeated'));
    assert.ok(raid.includes("collection('raid_credits')"));
    assert.ok(raid.includes('raidWins'));
    ['trail_meadow', 'speed_runner', 'marathon', 'rabbit_hole', 'early_adopter', 'weekend_warrior', 'early_bird', 'night_owl', 'ghost_mode', 'insomniac', 'triple_threat', 'search_sleuth', 'block_42', 'whitepaper_pilgrim', 'contrarian', 'dust_collector', 'nacho_friend', 'bookmark_collector', 'collector', 'nacho_closet_full', 'pvp_streak', 'the_plebeian', 'spin_set_t', 'tip_magnet_t'].forEach(function (id) {
        assert.strictEqual(badgeRules.isCosmetic(id), true, id);
    });
    ['flex_findq_1', 'lq_mining', 'quest_1', 'trivia_first', 'spin_1', 'raid_first', 'tip_first', 'first_peer', 'peer_network_10', 'genesis', 'first_post', 'scholar', 'hash_obsessed', 'ticket_bronze', 'streak_freeze', 'ghost_reader'].forEach(function (id) {
        assert.strictEqual(badgeRules.isCosmetic(id), false, id);
    });
}));

queue.push(test('a profile badge is recorded with 0 XP and does not touch the pool', async function () {
    const day = { day: '2026-10-22', nowMs: 1700000000000 };
    function watchPool(db) {
        let reads = 0;
        const orig = db.runTransaction;
        db.runTransaction = function (fn) {
            return orig.call(db, function (t) {
                const get = t.get;
                t.get = function (ref) {
                    if (ref && String(ref.path || '').indexOf('satoshiFavor') === 0) reads += 1;
                    return get.call(t, ref);
                };
                return fn(t);
            });
        };
        return function () { return reads; };
    }
    const arrayDb = memoryDb({ 'users/u': { sayHiDays: 1, points: 40, visibleBadges: ['say_hi_1'] } });
    const arrayReads = watchPool(arrayDb);
    const fromArray = await awardBadge(arrayDb, admin, 'u', 'say_hi_1', day);
    assert.strictEqual(fromArray.reason, 'legacy');
    assert.strictEqual(fromArray.xp, 0);
    assert.strictEqual(fromArray.favor, false);
    assert.strictEqual(arrayDb.docs['users/u/badge_awards/say_hi_1'].source, 'legacy');
    assert.strictEqual(arrayDb.docs['users/u/badge_awards/say_hi_1'].xp, 0);
    assert.strictEqual(arrayDb.docs['users/u'].points, 40);
    assert.strictEqual(arrayDb.docs['satoshiFavor/current'], undefined);
    assert.strictEqual(arrayReads(), 0);
    const mapDb = memoryDb({ 'users/u': { sayHiDays: 1, badges: { say_hi_1: true } } });
    const fromMap = await awardBadge(mapDb, admin, 'u', 'say_hi_1', day);
    assert.strictEqual(fromMap.reason, 'legacy');
    assert.strictEqual(mapDb.docs['satoshiFavor/current'], undefined);
    const fieldDb = memoryDb({ 'users/u': { peerCount: 1, displayBadge: 'peer_1' } });
    const fromField = await awardBadge(fieldDb, admin, 'u', 'peer_1', day);
    assert.strictEqual(fromField.reason, 'legacy');
    assert.strictEqual(fieldDb.docs['users/u/badge_awards/peer_1'].xp, 0);
    const owned = memoryDb({
        'users/u': { sayHiDays: 1, points: 15 },
        'users/u/badge_awards/say_hi_1': { xp: 15, source: 'awardBadge' },
    });
    const ownedReads = watchPool(owned);
    const again = await awardBadge(owned, admin, 'u', 'say_hi_1', day);
    assert.strictEqual(again.reason, 'already');
    assert.strictEqual(again.favor, false);
    assert.strictEqual(ownedReads(), 0);
    assert.strictEqual(owned.docs['satoshiFavor/current'], undefined);
}));

queue.push(test('backfill dedupes date and name keys and plans faction totals only', function () {
    const backfill = require('../scripts/backfill-badge-favor');
    const name = backfill.badgeName('say_hi_1');
    const nameToken = backfill.keyPart(name);
    assert.ok(nameToken);
    const dated = 'u_2026-01-02_badge_' + nameToken;
    const plan = backfill.planUser({
        uid: 'u',
        user: { faction: 'cyber_hornets' },
        held: ['say_hi_1', 'peer_1', 'spin_1'],
        contributorIds: [dated, 'u_badge_peer_1'],
    });
    assert.strictEqual(plan.missing.length, 1);
    assert.strictEqual(plan.missing[0].doc.badgeId, 'spin_1');
    assert.strictEqual(plan.missing[0].doc.pointsAdded, 1);
    assert.strictEqual(plan.missing[0].doc.source, 'backfill');
    assert.strictEqual(plan.missing[0].doc.faction, 'cyber_hornets');
    assert.strictEqual(plan.byFaction.cyber_hornets, 1);
    assert.strictEqual(plan.byFaction.unaffiliated, 0);
    const none = backfill.planUser({ uid: 'v', user: {}, held: ['spin_1'], contributorIds: [] });
    assert.strictEqual(none.missing[0].doc.faction, null);
    assert.strictEqual(none.byFaction.unaffiliated, 1);
    assert.strictEqual(backfill.creditsBadge('v_badge_' + nameToken, 'v', 'say_hi_1', name), true);
    const classified = backfill.classifyHeld({
        user: {
            badges: ['say_hi_1'],
            visibleBadges: ['peer_1'],
            earnedHidden: ['spin_1'],
            displayBadge: 'not_a_real_badge',
            equippedBadge: 'say_hi_1',
        },
        awardIds: ['peer_1', 'fake_award_id'],
    });
    assert.ok(classified.credit.indexOf('say_hi_1') !== -1);
    assert.ok(classified.credit.indexOf('peer_1') !== -1);
    assert.strictEqual(classified.credit.indexOf('spin_1'), -1);
    assert.strictEqual(classified.credit.indexOf('not_a_real_badge'), -1);
    assert.strictEqual(classified.credit.indexOf('fake_award_id'), -1);
    assert.strictEqual(classified.excluded['client-writable-field'], 2);
    assert.strictEqual(classified.excluded['not-in-catalog'], 2);
    const dropped = backfill.planUser({ uid: 'w', user: {}, held: ['not_a_real_badge'], contributorIds: [] });
    assert.strictEqual(dropped.missing.length, 0);
    const src = fs.readFileSync(path.join(root, 'scripts', 'backfill-badge-favor.js'), 'utf8');
    assert.ok(src.includes("source: 'backfill'"));
    assert.ok(src.includes('pointsAdded: 1'));
    assert.ok(!src.includes('favorActive'));
    assert.ok(!src.includes("doc('current').set"));
    assert.ok(!src.includes("doc('current').update"));
    assert.ok(src.includes('factionTotals'));
}));

queue.push(test('combo tiers follow server zones and trivia is graded before the counter', function () {
    const combo = require('../functions/src/comboActivity');
    let state = { zones: {}, awarded: {} };
    let lastGrant = [];
    ['chat', 'forum', 'spin', 'pvp', 'tctv', 'prediction', 'sf', 'beats'].forEach(function (zone) {
        const plan = combo.planCombo(state, zone);
        state = plan.state;
        lastGrant = plan.grant;
    });
    assert.strictEqual(state.awarded.combo_trio, true);
    assert.strictEqual(state.awarded.combo_mega, true);
    assert.strictEqual(state.awarded.combo_legend, true);
    assert.deepStrictEqual(lastGrant, ['combo_legend']);
    assert.deepStrictEqual(combo.planCombo(state, 'chat').grant, []);
    assert.deepStrictEqual(combo.planCombo(state, 'combo_legend').grant, []);
    assert.strictEqual(
        fs.readFileSync(path.join(root, 'data', 'trivia-bank.js'), 'utf8'),
        fs.readFileSync(path.join(root, 'functions', 'src', 'trivia-bank.js'), 'utf8')
    );
    const os = require('os');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trivia-fn-'));
    fs.mkdirSync(path.join(tmp, 'functions', 'src'), { recursive: true });
    fs.copyFileSync(path.join(root, 'functions', 'src', 'triviaBank.js'), path.join(tmp, 'functions', 'src', 'triviaBank.js'));
    fs.copyFileSync(path.join(root, 'functions', 'src', 'trivia-bank.js'), path.join(tmp, 'functions', 'src', 'trivia-bank.js'));
    assert.ok(!fs.existsSync(path.join(tmp, 'data', 'trivia-bank.js')));
    const isolated = require(path.join(tmp, 'functions', 'src', 'triviaBank.js'));
    const isolatedQuestion = isolated.questionForDay('2026-10-22');
    assert.ok(isolatedQuestion && isolatedQuestion.optionCount > 0);
    assert.strictEqual(isolated.grade('2026-10-22', isolatedQuestion.answer).correct, true);
    const trivia = require('../functions/src/triviaBank');
    const day = '2026-10-22';
    const question = trivia.questionForDay(day);
    assert.strictEqual(trivia.grade(day, question.answer).correct, true);
    assert.strictEqual(trivia.grade(day, question.answer === 0 ? 1 : 0).correct, false);
    assert.strictEqual(trivia.grade(day, undefined).correct, false);
    const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    const awardAt = index.indexOf('exports.awardPoints');
    const award = index.slice(awardAt, index.indexOf('exports.getFaucetStats', awardAt));
    assert.ok(award.indexOf('triviaBank') !== -1);
    assert.ok(award.indexOf('triviaGrade') < award.indexOf('progressBadges.progressSpec'));
    assert.ok(!award.includes("source: 'combo_bonus'"));
    const quests = fs.readFileSync(path.join(root, 'quests.js'), 'utf8');
    assert.ok(quests.includes('triviaChoice: chosenIdx'));
}));

queue.push(test('the dry-run helper counts failing badges without printing people', function () {
    const ids = ['market_listed_5', 'flex_findq_1', 'peer_1'];
    const failedIds = heldThatFail({ marketListings: 0, peerCount: 0 }, ids);
    assert.deepStrictEqual(failedIds, ['market_listed_5', 'flex_findq_1', 'peer_1']);
    const src = fs.readFileSync(path.join(root, 'functions', 'dry-run-badge-criteria.js'), 'utf8');
    assert.ok(src.includes('tally'));
    assert.ok(!src.includes('console.log(uid'));
}));

Promise.all(queue).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
