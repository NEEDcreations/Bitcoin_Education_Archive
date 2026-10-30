// Badge rule engine, trifecta proof, daily-five gate, listing cap, message dedup.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const badgeRules = require('../functions/src/badgeRules');
const { grantBadgeIfEarned, grantFamily } = require('../functions/src/grantBadge');
const { awardBadge } = require('../functions/src/awardBadge');
const { millisOf } = require('../functions/src/favorPool');
const favorLive = require('../functions/src/favorLiveAnnounce');
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
    assert.strictEqual(badgeRules.xpOf('satoshis_cipher'), 2000);
    assert.strictEqual(badgeRules.xpOf('donor_100000'), 2000);
    assert.strictEqual(badgeRules.xpOf('donor_100'), 10);
    assert.strictEqual(badgeRules.xpOf('flex_findq_1'), 10);
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
    assert.strictEqual(market.xp, 50);
    assert.strictEqual(market.source.field, 'marketListings');
    assert.strictEqual(badgeRules.meets(market, { marketListings: 5 }, {}), true);
    assert.strictEqual(badgeRules.meets(market, { marketListings: 4 }, {}), false);
    const hashes = badgeRules.ruleFor('sf_100000_hashes');
    assert.strictEqual(hashes.xp, 2000);
    assert.strictEqual(badgeRules.meets(hashes, { sfHashes: 100000 }, {}), true);
    assert.strictEqual(badgeRules.meets(hashes, { totalHashes: 100000 }, {}), false);
    assert.strictEqual(badgeRules.ruleFor('peer_1').xp, 50);
    assert.strictEqual(badgeRules.ruleFor('say_hi_1').xp, 10);
    const scholar = badgeRules.ruleFor('scholar');
    assert.strictEqual(scholar.source.type, 'scholarExam');
    assert.strictEqual(scholar.source.examType, 'properties');
    assert.strictEqual(badgeRules.meets(scholar, { certPassed_prop: true, scholar_exam_passed: true }, {}), false);
    assert.strictEqual(badgeRules.meets(scholar, {}, { scholarExamPassed: true }), true);
    assert.strictEqual(badgeRules.meets(scholar, {}, { scholarExamsPassed: { properties: true } }), true);
    assert.strictEqual(badgeRules.meets(scholar, {}, { scholarExamsPassed: { technical: true } }), false);
    assert.strictEqual(badgeRules.ruleFor('daily_five_1').xp, 10);
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
    ['points', 'visibleBadges', 'hiddenBadges', 'marketListings', 'dailyTripleCount', 'badgeCounters', 'sayHiArmedDay', 'replyBonusCount', 'lastTriviaDate', 'lastPollDate', 'lastQuestDate', 'triviaStreak', 'flexTotals', 'flexAllDays', 'triviaCorrect', 'triviaStreakDay', 'questsPassed', 'lqPassed', 'spinDays', 'spinStreak', 'spinHitRare', 'spinClosetAwards', 'tipsVerified', 'tipsSentSats', 'tipsReceived', 'raidDamageAllTime', 'raidBossesDefeated', 'raidWins', 'streakFreezesUsed', 'certPassed_prop', 'certPassed_tech', 'certPassedAt_prop', 'certPassedAt_tech', 'lastExamAttempt_prop', 'lastExamAttempt_tech', 'scholar_exam_passed', 'scholar_tech_passed', 'scholar_tech_score'].forEach(function (field) {
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
    const cumulativeAt = rules.indexOf('match /poll_cumulative/{pollId}');
    const cumulative = rules.slice(cumulativeAt, rules.indexOf('match /', cumulativeAt + 10));
    assert.ok(cumulative.includes('allow read: if true'));
    assert.ok(cumulative.includes('allow create, update, delete: if false'));
    assert.strictEqual(cumulative.includes('allow create: if request.auth'), false);
    assert.strictEqual(cumulative.includes('allow update: if request.auth'), false);
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
    assert.strictEqual(first.favorPoint, true);
    assert.strictEqual(db.docs['users/u/badge_awards/say_hi_1'].favorPoint, true);
    assert.strictEqual(first.xp, 10);
    assert.strictEqual(second.reason, 'already');
    assert.strictEqual(second.favor, false);
    assert.strictEqual(db.docs['satoshiFavor/current'].points, 1);
    assert.strictEqual(db.docs['satoshiFavor/current/contributors/u_badge_say_hi_1'].pointsAdded, 1);
    assert.strictEqual(db.docs['satoshiFavor/factionTotals'].cyber_hornets, 1);
    assert.strictEqual(db.docs['satoshiFavor/userSfPoints/users/u'].uid, 'u');
    assert.strictEqual(db.docs['satoshiFavor/userSfPoints/users/u'].points._increment, 1);
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
    assert.strictEqual(extended.favorPoint, false);
    assert.strictEqual(open.docs['users/u/badge_awards/say_hi_7'].favorPoint, false);
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
    assert.strictEqual(millisOf(stale.docs['satoshiFavor/current'].lastReset), now);
}));

queue.push(test('an expired badge award drops the previous window from the LIVE post', async function () {
    const now = 1700000000000;
    const hour = 60 * 60 * 1000;
    const docs = {
        'users/u': { sayHiDays: 1, points: 0 },
        'satoshiFavor/current': {
            points: 21,
            favorActive: true,
            bonusMinutes: 0,
            eraHashes: 99,
            currentCycleId: 'cycle_old',
            lastReset: { toMillis: function () { return now - 2 * hour; } },
            favorEndBase: { toMillis: function () { return now - hour; } },
            favorStart: { toMillis: function () { return now - 2 * hour; } },
        },
    };
    function oldRow(id, data) {
        docs['satoshiFavor/current/contributors/' + id] = data;
    }
    const oldTs = { toMillis: function () { return now - hour; } };
    for (let i = 0; i < 12; i++) {
        oldRow('old_flex_' + i, {
            uid: 'old' + i, source: 'badge_earned', badgeId: 'flex_pattern_' + (i + 1),
            pointsAdded: 1, timestamp: oldTs,
        });
    }
    for (let i = 0; i < 5; i++) {
        oldRow('old_badge_' + i, {
            uid: 'oldb' + i, source: 'badge_earned', badgeId: 'quest_1',
            pointsAdded: 1, timestamp: oldTs,
        });
    }
    for (let i = 0; i < 4; i++) {
        oldRow('old_tri_' + i, {
            uid: 'oldt' + i, source: 'daily_all_three', pointsAdded: 1, timestamp: oldTs,
        });
    }
    const db = memoryDb(docs);
    const result = await awardBadge(db, admin, 'u', 'say_hi_1', { day: '2026-10-22', nowMs: now });
    assert.strictEqual(result.granted, true);
    const state = db.docs['satoshiFavor/current'];
    assert.strictEqual(state.points, 1);
    assert.strictEqual(state.favorActive, false);
    assert.strictEqual(state.eraHashes, 99);
    assert.strictEqual(millisOf(state.lastReset), now);
    const fresh = db.docs['satoshiFavor/current/contributors/u_badge_say_hi_1'];
    assert.ok(fresh);
    fresh.timestamp = { toMillis: function () { return now; } };
    for (let i = 0; i < 20; i++) {
        db.docs['satoshiFavor/current/contributors/new_' + i] = {
            uid: 'n' + i, source: 'badge_earned', badgeId: 'peer_1',
            pointsAdded: 1, timestamp: { toMillis: function () { return now; } },
        };
    }
    state.points = 21;
    state.favorActive = true;
    state.currentCycleId = 'cycle_new';
    const live = await favorLive.handleFavorLiveWrite(db, admin, { favorActive: false, points: 1 }, state);
    assert.strictEqual(live.posted, true);
    assert.strictEqual(live.text.indexOf('flex'), -1);
    assert.strictEqual(live.text.indexOf('trifecta'), -1);
    assert.ok(live.text.indexOf('21 badges') !== -1);
    assert.ok(live.text.indexOf('21 players') !== -1);
    assert.strictEqual(live.text, "⚡ Satoshi's Favor is LIVE! 21 points from 21 players: 21 badges. Window open for 60 min.");
}));

queue.push(test('the daily XP cap still grants the badge and Favor', async function () {
    const db = memoryDb({
        'users/u': { sayHiDays: 1, points: 10 },
        'users/u/daily_points/2026-10-22': { total: 1000 },
    });
    const result = await awardBadge(db, admin, 'u', 'say_hi_1', { day: '2026-10-22', nowMs: 1700000000000 });
    assert.strictEqual(result.granted, true);
    assert.strictEqual(result.xp, 0);
    assert.strictEqual(result.overflowAdded, 0);
    assert.strictEqual(result.dropped, 10);
    assert.strictEqual(result.capped, true);
    assert.strictEqual(result.capBypass, false);
    assert.strictEqual(result.favor, true);
    assert.strictEqual(db.docs['users/u'].points, 10);
    assert.strictEqual(db.docs['users/u'].pendingOverflow, undefined);
    assert.strictEqual(db.docs['users/u/daily_points/2026-10-22'].total, 1000);
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
    async function earn(seed, id, extra) {
        const docs = { 'users/u': Object.assign({ points: 0 }, seed) };
        Object.keys(extra || {}).forEach(function (key) { docs[key] = extra[key]; });
        const db = memoryDb(docs);
        const result = await awardBadge(db, admin, 'u', id, day);
        return { result: result, db: db };
    }
    const flexClaim = { 'users/u/daily_action_counts/2026-07-04_flex_findq': { actionId: 'findq' } };
    const families = [
        ['flex', {}, 'flex_findq_1', 10, flexClaim],
        ['learning quest', { lqPassed: ['lq_mining'] }, 'lq_mining', 50],
        ['quest', { questsPassed: 1 }, 'quest_1', 10],
        ['trivia', { triviaCorrect: 1 }, 'trivia_first', 10],
        ['spin', { spinDays: 1 }, 'spin_1', 10],
        ['raid', { raidDamageAllTime: 1 }, 'raid_first', 10],
        ['tip', { tipsVerified: 1 }, 'tip_first', 10],
        ['legacy peer', { peerCount: 0, peers: ['a'] }, 'first_peer', 10],
        ['genesis', { visitedChannelsList: ['whitepaper'] }, 'genesis', 10],
        ['streak freeze', { streakFreezesUsed: 1 }, 'streak_freeze', 50],
        ['ghost reader', { streak: 7, points: 0 }, 'ghost_reader', 150],
    ];
    for (let i = 0; i < families.length; i++) {
        const row = families[i];
        const paid = await earn(row[1], row[2], row[4]);
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
    const inflated = await earn({ flexTotals: { steak: 10 } }, 'flex_steak_1');
    assert.strictEqual(inflated.result.reason, 'criteria');
    assert.strictEqual(inflated.db.docs['users/u/badge_awards/flex_steak_1'], undefined);
    const claimed = await earn({}, 'flex_steak_1', {
        'users/u/daily_action_counts/2026-07-04_flex_steak': { actionId: 'steak' },
    });
    assert.strictEqual(claimed.result.granted, true);
    assert.strictEqual(claimed.result.xp, 10);
    assert.strictEqual(claimed.result.favor, true);
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
    const questSrc = fs.readFileSync(path.join(root, 'functions', 'src', 'questCallables.js'), 'utf8');
    assert.ok(questSrc.includes('questsPassed'));
    assert.ok(questSrc.includes("familyFor('questsPassed')"));
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
    assert.strictEqual(classified.excluded['hidden-only'], 0);
    const hidden = backfill.classifyHeld({
        user: {
            badges: ['say_hi_1'],
            visibleBadges: ['peer_1'],
            donationBadges: ['spin_1'],
            hiddenBadges: ['say_hi_1', 'peer_1', 'spin_1', 'first_channel', 'explorer_100', 'not_real_hidden'],
        },
        awardIds: ['explorer_100', 'fake_award_id'],
    });
    assert.ok(hidden.credit.indexOf('say_hi_1') !== -1);
    assert.ok(hidden.credit.indexOf('peer_1') !== -1);
    assert.ok(hidden.credit.indexOf('spin_1') !== -1);
    assert.ok(hidden.credit.indexOf('explorer_100') !== -1);
    assert.strictEqual(hidden.credit.indexOf('first_channel'), -1);
    assert.strictEqual(hidden.credit.indexOf('not_real_hidden'), -1);
    assert.strictEqual(hidden.credit.indexOf('fake_award_id'), -1);
    assert.strictEqual(hidden.excluded['hidden-only'], 2);
    assert.strictEqual(hidden.excluded['not-in-catalog'], 2);
    assert.strictEqual(hidden.excluded['client-writable-field'], 0);
    const dropped = backfill.planUser({ uid: 'w', user: {}, held: ['not_a_real_badge'], contributorIds: [] });
    assert.strictEqual(dropped.missing.length, 0);
    const src = fs.readFileSync(path.join(root, 'scripts', 'backfill-badge-favor.js'), 'utf8');
    assert.ok(src.includes("source: 'backfill'"));
    assert.ok(src.includes('pointsAdded: 1'));
    assert.ok(!src.includes('favorActive'));
    assert.ok(!src.includes("doc('current').set"));
    assert.ok(!src.includes("doc('current').update"));
    assert.ok(src.includes('factionTotals'));
    assert.ok(src.includes('excluded hidden-only'));
    assert.ok(src.includes("const SERVER_LIST_FIELDS = ['badges', 'visibleBadges', 'donationBadges']"));
    assert.ok(src.includes("const HIDDEN_LIST_FIELDS = ['hiddenBadges']"));
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
    const publicTrivia = new Function(fs.readFileSync(path.join(root, 'data', 'trivia-bank.js'), 'utf8') + '\nreturn TRIVIA_BANK;')();
    const privateTrivia = new Function(fs.readFileSync(path.join(root, 'functions', 'src', 'trivia-bank.js'), 'utf8') + '\nreturn TRIVIA_BANK;')();
    assert.strictEqual(publicTrivia.length, privateTrivia.length);
    publicTrivia.forEach(function (row, i) {
        assert.deepStrictEqual(Object.keys(row).sort(), ['options', 'q']);
        assert.strictEqual(row.q, privateTrivia[i].q);
        assert.deepStrictEqual(row.options, privateTrivia[i].options);
        assert.deepStrictEqual(Object.keys(privateTrivia[i]).sort(), ['options', 'q']);
    });
    const os = require('os');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trivia-fn-'));
    fs.mkdirSync(path.join(tmp, 'functions', 'src'), { recursive: true });
    fs.copyFileSync(path.join(root, 'functions', 'src', 'triviaBank.js'), path.join(tmp, 'functions', 'src', 'triviaBank.js'));
    fs.copyFileSync(path.join(root, 'functions', 'src', 'trivia-bank.js'), path.join(tmp, 'functions', 'src', 'trivia-bank.js'));
    assert.ok(!fs.existsSync(path.join(tmp, 'data', 'trivia-bank.js')));
    const isolated = require(path.join(tmp, 'functions', 'src', 'triviaBank.js'));
    const isolatedQuestion = isolated.questionForDay('2026-10-22');
    assert.ok(isolatedQuestion && isolatedQuestion.optionCount === 4);
    assert.strictEqual(isolatedQuestion.answer, undefined);
    assert.strictEqual(isolated.grade('2026-10-22', 0).correct, false);
    assert.strictEqual(isolated.grade('2026-10-22', 1).correct, false);
    assert.strictEqual(isolated.grade('2026-10-22', 2).correct, false);
    assert.strictEqual(isolated.grade('2026-10-22', 3).correct, false);
    const trivia = require('../functions/src/triviaBank');
    const day = '2026-10-22';
    const question = trivia.questionForDay(day);
    assert.strictEqual(question.answer, undefined);
    assert.strictEqual(trivia.grade(day, 0).correct, false);
    assert.strictEqual(trivia.grade(day, 1).correct, false);
    assert.strictEqual(trivia.grade(day, undefined).correct, false);
    const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    const awardAt = index.indexOf('exports.awardPoints');
    const award = index.slice(awardAt, index.indexOf('exports.getFaucetStats', awardAt));
    assert.ok(award.indexOf('triviaBank') !== -1);
    assert.ok(award.indexOf('triviaGrade') < award.indexOf('progressBadges.progressSpec'));
    assert.ok(!award.includes("source: 'combo_bonus'"));
    const quests = fs.readFileSync(path.join(root, 'quests.js'), 'utf8');
    assert.ok(quests.includes("httpsCallable('answerTrivia')"));
    assert.ok(quests.includes('chosen: chosenText'));
}));

queue.push(test('the scholar badge and the client read the exam record, not a profile flag', function () {
    const root = path.join(__dirname, '..');
    const scholarJs = fs.readFileSync(path.join(root, 'scholar.js'), 'utf8');
    const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
    const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    const grade = index.slice(index.indexOf('exports.gradeScholarExam'), index.indexOf('exports.startQuest'));
    const issue = index.slice(index.indexOf('exports.issueCertificate'), index.indexOf('exports.onChatMessageCreated'));
    assert.ok(scholarJs.includes('certPassed_prop === true'));
    assert.ok(scholarJs.includes('A local score is not a pass'));
    assert.ok(!scholarJs.includes("localStorage.setItem('btc_scholar_' + keyPrefix + '_passed'"));
    assert.ok(!scholarJs.includes('falling back'));
    assert.ok(!scholarJs.includes("collection('users')"));
    assert.ok(ranking.includes('currentUser.certPassed_prop === true'));
    assert.ok(ranking.includes('currentUser.certPassed_tech === true'));
    assert.ok(!ranking.includes('btc_scholar_prop_passed'));
    assert.ok(!ranking.includes('btc_scholar_tech_passed'));
    assert.ok(grade.includes(".where('uid', '==', uid)"));
    assert.ok(grade.includes('passedExam'));
    assert.ok(grade.includes('pointsAwarded: 0'));
    assert.ok(!grade.includes('scholar_exam_passed'));
    assert.ok(issue.includes('passedExam'));
    const helper = fs.readFileSync(path.join(root, 'functions', 'src', 'scholarExam.js'), 'utf8');
    assert.ok(helper.includes('row.passed === true'));
    assert.ok(helper.includes('exceptId'));
    const scholarExam = require('../functions/src/scholarExam');
    const onlyCurrent = {
        forEach: function (fn) {
            fn({ id: 'current', data: function () { return { type: 'properties', passed: true }; } });
        },
    };
    assert.strictEqual(scholarExam.passedExam(onlyCurrent, 'properties', 'current'), null);
    const prior = {
        forEach: function (fn) {
            fn({ id: 'current', data: function () { return { type: 'properties', passed: false }; } });
            fn({ id: 'old', data: function () { return { type: 'properties', passed: true, score: 22 }; } });
            fn({ id: 'tech', data: function () { return { type: 'technical', passed: true }; } });
        },
    };
    assert.strictEqual(scholarExam.passedExam(prior, 'properties', 'current').score, 22);
    assert.strictEqual(scholarExam.passedExam(prior, 'technical', 'current').passed, true);
    assert.ok(!issue.includes('scholar_exam_passed'));
    assert.ok(!issue.includes('scholar_tech_passed'));
    assert.ok(!issue.includes('scholar_tech_score'));
    const privacy = fs.readFileSync(path.join(root, 'privacy.html'), 'utf8');
    assert.ok(privacy.includes('scholar_exam_keys'));
    const terms = fs.readFileSync(path.join(root, 'terms.html'), 'utf8');
    assert.ok(terms.includes('A profile flag is not enough'));
    const held = heldThatFail({ certPassed_prop: true, scholar_exam_passed: true }, ['scholar']);
    assert.deepStrictEqual(held, ['scholar']);
    assert.deepStrictEqual(heldThatFail({}, ['scholar'], { scholarExamPassed: true }), []);
}));

queue.push(test('the dry-run helper counts failing badges without printing people', function () {
    const ids = ['market_listed_5', 'flex_findq_1', 'peer_1'];
    const failedIds = heldThatFail({ marketListings: 0, peerCount: 0 }, ids);
    assert.deepStrictEqual(failedIds, ['market_listed_5', 'flex_findq_1', 'peer_1']);
    const src = fs.readFileSync(path.join(root, 'functions', 'dry-run-badge-criteria.js'), 'utf8');
    assert.ok(src.includes('tally'));
    assert.ok(!src.includes('console.log(uid'));
}));

queue.push(test('badge ladders never pay a harder rung less, and the UI table matches', function () {
    const table = require('../functions/src/badge-xp.json');
    const catalog = badgeRules.catalog;
    const tableIds = Object.keys(table.badges).sort();
    const catalogIds = Object.keys(catalog.badges).sort();
    // The sheet has two non-badges (`anon`, `flex_`). The catalog parser
    // used to invent those, plus `Raid`, from `uid: 'anon'` and `raid: 'Raid'`.
    const sheetOnly = tableIds.filter(function (id) { return catalogIds.indexOf(id) === -1; });
    const catalogOnly = catalogIds.filter(function (id) { return tableIds.indexOf(id) === -1; });
    assert.deepStrictEqual(sheetOnly, ['anon', 'flex_']);
    assert.deepStrictEqual(catalogOnly, []);
    assert.strictEqual(table.badges.flex_.xp, 0);
    assert.strictEqual(table.badges.anon.xp, 0);
    tableIds.forEach(function (id) {
        if (!catalog.badges[id]) return;
        assert.strictEqual(catalog.badges[id].xp, table.badges[id].xp, id);
        const rule = badgeRules.ruleFor(id);
        if (rule.cosmetic) assert.strictEqual(rule.displayXp, table.badges[id].xp, id);
        else assert.strictEqual(rule.xp, table.badges[id].xp, id);
    });
    const twins = ['trivia_first', 'poll_100', 'lightning_setup', 'first_peer', 'peer_network_10', 'quest_legend', 'raid_warlord', 'first_post', 'first_reply', 'market_seller', 'market_buyer'];
    twins.forEach(function (id) { assert.strictEqual(badgeRules.xpOf(id), 10, id); });
    const groups = {};
    badgeRules.allIds().forEach(function (id) {
        const rule = badgeRules.ruleFor(id);
        if (!rule || !rule.source || rule.cosmetic) return;
        const src = rule.source;
        let key = null;
        let rank = null;
        if (src.type === 'counter') { key = 'c:' + src.field; rank = src.gte; }
        else if (src.type === 'flex') { key = 'flex:' + src.action; rank = src.gte; }
        else if (src.type === 'flexSum') { key = 'flexSum'; rank = src.gte; }
        else if (src.type === 'awards') { key = 'awards'; rank = src.gte; }
        else if (src.type === 'accuracy') { key = 'acc:' + src.field; rank = src.gte; }
        if (key == null) return;
        (groups[key] = groups[key] || []).push({ id: id, rank: rank, xp: rule.xp });
    });
    Object.keys(groups).forEach(function (key) {
        const byRank = {};
        groups[key].forEach(function (row) {
            (byRank[row.rank] = byRank[row.rank] || []).push(row);
        });
        let floor = 0;
        Object.keys(byRank).map(Number).sort(function (a, b) { return a - b; }).forEach(function (rank) {
            const best = byRank[rank].reduce(function (max, row) { return Math.max(max, row.xp); }, 0);
            assert.ok(best >= floor, key + ' at ' + rank + ' pays ' + best + ' under ' + floor);
            floor = best;
        });
    });
    const badgesSrc = fs.readFileSync(path.join(root, 'badges.js'), 'utf8');
    assert.ok(badgesSrc.includes('function badgeShownXp'));
    assert.ok(badgesSrc.includes('window.BADGE_CATALOG'));
    const clientSrc = fs.readFileSync(path.join(root, 'badges.catalog.js'), 'utf8');
    const clientStart = clientSrc.indexOf('window.BADGE_CATALOG=') + 'window.BADGE_CATALOG='.length;
    const clientEnd = clientSrc.indexOf(';\nwindow.BADGE_CATALOG_VERSION');
    const client = JSON.parse(clientSrc.slice(clientStart, clientEnd));
    assert.strictEqual(client.satoshis_cipher.xp, 2000);
    assert.strictEqual(client.donor_100.xp, 10);
    assert.strictEqual(client.hall_of_fame.xp, 500);
    assert.strictEqual(client.streak_365.xp, 2000);
}));

queue.push(test('badge XP tapers at 500, 900, and 1,000 and the backfill bypasses it', async function () {
    const { applyDailyXp, taperDailyXp } = require('../functions/src/applyDailyXp');
    const full = taperDailyXp(2000, 0);
    assert.strictEqual(full.awarded, 1000);
    assert.strictEqual(full.dailyXp, 1000);
    assert.strictEqual(full.dropped, 1000);
    const edge = taperDailyXp(150, 500);
    assert.strictEqual(edge.awarded, 75);
    assert.strictEqual(edge.dailyXp, 575);
    const quarter = taperDailyXp(150, 900);
    assert.strictEqual(quarter.awarded, 37);
    assert.strictEqual(quarter.dailyXp, 937);
    assert.strictEqual(taperDailyXp(10, 1000).awarded, 0);
    const partial = memoryDb({
        'users/u': { sayHiDays: 30, points: 0 },
        'users/u/daily_points/2026-10-22': { total: 900 },
    });
    const mid = await awardBadge(partial, admin, 'u', 'say_hi_30', { day: '2026-10-22', nowMs: 1700000000000 });
    assert.strictEqual(mid.xp, 37);
    assert.strictEqual(mid.overflowAdded, 0);
    assert.strictEqual(mid.dropped, 113);
    assert.strictEqual(partial.docs['users/u'].points, 37);
    assert.strictEqual(partial.docs['users/u'].pendingOverflow, undefined);
    assert.strictEqual(partial.docs['users/u/daily_points/2026-10-22'].total, 937);
    const fresh = memoryDb({ 'users/u': { bestStreak: 365, points: 0 } });
    const legend = await awardBadge(fresh, admin, 'u', 'streak_365', { day: '2026-10-22', nowMs: 1700000000000 });
    assert.strictEqual(legend.xp, 1000);
    assert.strictEqual(legend.dropped, 1000);
    assert.strictEqual(fresh.docs['users/u'].pendingOverflow, undefined);
    assert.strictEqual(fresh.docs['users/u/daily_points/2026-10-22'].total, 1000);
    const bypass = await applyDailyXp('u', 2000, null, { bypass: true });
    assert.strictEqual(bypass.bypass, true);
    assert.strictEqual(bypass.awarded, 2000);
    assert.strictEqual(bypass.overflowAdded, 0);
    const src = fs.readFileSync(path.join(root, 'functions', 'src', 'awardBadge.js'), 'utf8');
    assert.ok(src.includes('applyDailyXp('));
    assert.ok(!src.includes('pendingOverflow'));
    assert.ok(!src.includes('BADGE_DAILY_CAP'));
    const backfill = fs.readFileSync(path.join(root, 'functions', 'scripts', 'backfill_badge_xp.js'), 'utf8');
    assert.ok(backfill.includes('bypass: true'));
    assert.ok(backfill.includes("tag: 'badge_xp_backfill'"));
    assert.ok(!backfill.includes('weeklyXP'));
    assert.ok(!backfill.includes('monthlyXP'));
    assert.ok(!backfill.includes("doc('current').set"));
    assert.ok(!backfill.includes('favorActive'));
    assert.ok(!backfill.includes('level: plan.level'));
    assert.ok(backfill.includes('favor cyber_hornets:'));
    assert.ok(backfill.includes('capped-at-zero badges:'));
    assert.ok(backfill.includes('capped-at-zero xp:'));
}));

queue.push(test('badge XP backfill tops up fixtures without clawing back or paying fakes', function () {
    const { planUserBadges } = require('../functions/src/badgeXpBackfill');
    const banned = planUserBadges({
        user: { points: 0, badges: ['say_hi_1'], sayHiDays: 1, banned: true },
        awardIds: ['say_hi_1'],
        awardById: { say_hi_1: { xp: 0 } },
    });
    assert.strictEqual(banned.banned, true);
    assert.strictEqual(banned.xp, 0);
    const hidden = planUserBadges({
        user: { points: 0, hiddenBadges: ['spin_1'], spinDays: 1 },
        awardIds: [],
    });
    assert.strictEqual(hidden.xp, 0);
    assert.strictEqual(hidden.excluded['hidden-only'], 1);
    const inflated = planUserBadges({
        user: { points: 0, badges: ['flex_findq_1'], flexTotals: { findq: 100 } },
        awardIds: ['flex_findq_1'],
        awardById: { flex_findq_1: {} },
        flexClaimIds: [],
    });
    assert.strictEqual(inflated.xp, 0);
    const flex = planUserBadges({
        user: { points: 0, badges: ['flex_findq_1'], flexTotals: { findq: 0 } },
        awardIds: ['flex_findq_1'],
        awardById: { flex_findq_1: { xp: 2 } },
        flexClaimIds: ['2026-07-04_flex_findq'],
    });
    assert.strictEqual(flex.xp, 8);
    const again = planUserBadges({
        user: { points: 0, badges: ['flex_findq_1'] },
        awardIds: ['flex_findq_1'],
        awardById: { flex_findq_1: { xp: 2 } },
        flexClaimIds: ['2026-07-04_flex_findq'],
        markerIds: ['flex_findq_1'],
    });
    assert.strictEqual(again.xp, 0);
    assert.strictEqual(again.topUps[0].skip, 'marker');
    const claw = planUserBadges({
        user: { points: 5000, bestStreak: 365, badges: ['streak_365'] },
        awardIds: ['streak_365'],
        awardById: { streak_365: { xp: 5000 } },
    });
    assert.strictEqual(claw.xp, 0);
    assert.strictEqual(claw.topUps[0].skip, 'paid');
    const level = planUserBadges({
        user: { points: 130, bestStreak: 7, badges: ['streak_7'], faction: 'honey_badgers' },
        awardIds: ['streak_7'],
        awardById: { streak_7: { xp: 50 } },
    });
    assert.strictEqual(level.xp, 100);
    assert.strictEqual(level.pointsAfter, 230);
    assert.strictEqual(level.favorPoints, 2);
    assert.deepStrictEqual(level.levelUps.map(function (row) { return row.name; }), ['Pleb', 'Pleb II']);
    assert.strictEqual(level.levelUps[0].points, 1);
    const already = planUserBadges({
        user: { points: 130, bestStreak: 7, badges: ['streak_7'] },
        awardIds: ['streak_7'],
        awardById: { streak_7: { xp: 50 } },
        levelContributorIds: ['Pleb', 'Pleb II'],
    });
    assert.strictEqual(already.xp, 100);
    assert.strictEqual(already.favorPoints, 0);
    assert.strictEqual(already.levelUps.length, 0);
    const legacy = planUserBadges({
        user: { points: 0, bestStreak: 7, badges: ['streak_7'] },
        awardIds: ['streak_7'],
        awardById: { streak_7: { xp: 0, source: 'legacy', requestedXp: 0 } },
    });
    assert.strictEqual(legacy.topUps[0].alreadyPaid, 50);
    assert.strictEqual(legacy.xp, 100);
    assert.strictEqual(legacy.topUps[0].cappedZero, false);
    const capped = planUserBadges({
        user: { points: 0, bestStreak: 7, badges: ['streak_7'] },
        awardIds: ['streak_7'],
        awardById: { streak_7: { xp: 0, source: 'awardBadge', requestedXp: 150 } },
    });
    assert.strictEqual(capped.xp, 150);
    assert.strictEqual(capped.topUps[0].cappedZero, true);
}));

function watchBadgeReads(db) {
    const stats = { inside: 0, outside: 0, awardTx: 0 };
    const origRun = db.runTransaction.bind(db);
    db.runTransaction = function (fn) {
        return origRun(async function (t) {
            let sawAward = false;
            const origGet = t.get.bind(t);
            t.get = function (ref) {
                const docPath = ref && ref.path ? String(ref.path) : '';
                if (/\/daily_action_counts$/.test(docPath)) stats.inside += 1;
                if (docPath.indexOf('badge_awards/') !== -1 || docPath.indexOf('satoshiFavor') === 0) sawAward = true;
                return origGet(ref);
            };
            const result = await fn(t);
            if (sawAward) stats.awardTx += 1;
            return result;
        });
    };
    const origCollection = db.collection.bind(db);
    db.collection = function (name) {
        const col = origCollection(name);
        const origDoc = col.doc.bind(col);
        col.doc = function (id) {
            const ref = origDoc(id);
            const origSub = ref.collection.bind(ref);
            ref.collection = function (sub) {
                const subCol = origSub(sub);
                if (sub === 'daily_action_counts') {
                    const origGet = subCol.get.bind(subCol);
                    subCol.get = function () {
                        stats.outside += 1;
                        return origGet();
                    };
                }
                return subCol;
            };
            return ref;
        };
        return col;
    };
    return stats;
}

queue.push(test('awardBadge does not scan daily_action_counts when flexClaims is passed, and a second award pays nothing', async function () {
    const day = { day: '2026-10-22', nowMs: 1700000000000 };
    const docs = { 'users/u': { points: 0 } };
    for (let i = 0; i < 40; i++) {
        const stamp = '2026-06-' + String((i % 28) + 1).padStart(2, '0');
        docs['users/u/daily_action_counts/' + stamp + '_flex_findq'] = { actionId: 'findq' };
        docs['users/u/daily_action_counts/' + stamp + '_say_hi'] = { count: 1 };
    }
    docs['users/u/daily_action_counts/2026-07-04_flex_findq'] = { actionId: 'findq' };
    const db = memoryDb(docs);
    const stats = watchBadgeReads(db);
    const flexClaims = badgeRules.tallyFlexClaims(['2026-07-04_flex_findq']);
    const first = await awardBadge(db, admin, 'u', 'flex_findq_1', Object.assign({ flexClaims: flexClaims }, day));
    assert.strictEqual(first.granted, true);
    assert.strictEqual(first.xp, 10);
    assert.strictEqual(first.favor, true);
    assert.strictEqual(stats.inside, 0);
    assert.strictEqual(db.docs['users/u'].points, 10);
    assert.strictEqual(db.docs['satoshiFavor/current'].points, 1);
    const second = await awardBadge(db, admin, 'u', 'flex_findq_1', Object.assign({
        flexClaims: { byAction: { findq: 40 }, sum: 40 },
    }, day, { nowMs: day.nowMs + 1000 }));
    assert.strictEqual(second.granted, false);
    assert.strictEqual(second.reason, 'already');
    assert.strictEqual(second.favor, false);
    assert.strictEqual(db.docs['users/u'].points, 10);
    assert.strictEqual(db.docs['satoshiFavor/current'].points, 1);
    assert.strictEqual(stats.inside, 0);
    assert.strictEqual(db.docs['users/u/badge_awards/flex_findq_5'], undefined);

    const scanned = memoryDb({
        'users/u': { points: 0 },
        'users/u/daily_action_counts/2026-07-04_flex_findq': { actionId: 'findq' },
        'users/u/daily_action_counts/2026-07-05_say_hi': { count: 1 },
    });
    const scanStats = watchBadgeReads(scanned);
    const fromServer = await awardBadge(scanned, admin, 'u', 'flex_findq_1', day);
    assert.strictEqual(fromServer.granted, true);
    assert.strictEqual(scanStats.inside, 1);
    const repeat = await awardBadge(scanned, admin, 'u', 'flex_findq_1', Object.assign({}, day, { nowMs: day.nowMs + 1000 }));
    assert.strictEqual(repeat.reason, 'already');
    assert.strictEqual(scanned.docs['users/u'].points, 10);
    assert.strictEqual(scanned.docs['satoshiFavor/current'].points, 1);
    assert.strictEqual(scanStats.inside, 1);
}));

queue.push(test('grantFamily tallies flex claims once, skips earned ids, and does not trust a caller tally', async function () {
    const day = { day: '2026-10-22', nowMs: 1700000000000 };
    const ids = progressBadges.flexBadgeIds('findq');
    const claims = badgeRules.tallyFlexClaims(['2026-07-04_flex_findq']);
    const met = ids.filter(function (id) {
        const rule = badgeRules.ruleFor(id);
        return !!(rule && badgeRules.meets(rule, { points: 0 }, {
            flexClaims: claims, awardSet: new Set(), payingCount: 0, signedIn: true,
        }));
    });
    assert.deepStrictEqual(met, ['flex_findq_1']);

    const docs = {
        'users/u': { points: 0 },
        'users/u/badge_awards/flex_rookie': { xp: 10, source: 'awardBadge' },
        'users/u/daily_action_counts/2026-07-04_flex_findq': { actionId: 'findq' },
    };
    for (let i = 0; i < 30; i++) {
        docs['users/u/daily_action_counts/2026-05-' + String((i % 28) + 1).padStart(2, '0') + '_flex_steak'] = { actionId: 'steak' };
    }
    const db = memoryDb(docs);
    const stats = watchBadgeReads(db);
    const first = await progressBadges.grantProgress(db, admin, 'u', {
        kind: 'flex', flexId: 'findq', day: '2026-10-22',
    });
    assert.strictEqual(first, undefined);
    assert.strictEqual(stats.outside, 1);
    assert.strictEqual(stats.inside, 0);
    assert.strictEqual(stats.awardTx, 1);
    assert.strictEqual(db.docs['users/u'].points, 10);
    assert.strictEqual(db.docs['satoshiFavor/current'].points, 1);
    assert.ok(db.docs['users/u/badge_awards/flex_findq_1']);
    assert.strictEqual(db.docs['users/u/badge_awards/flex_findq_5'], undefined);
    assert.strictEqual(db.docs['users/u/badge_awards/flex_rookie'].xp, 10);

    await progressBadges.grantProgress(db, admin, 'u', {
        kind: 'flex', flexId: 'findq', day: '2026-10-22',
    });
    assert.strictEqual(stats.outside, 2);
    assert.strictEqual(stats.inside, 0);
    assert.strictEqual(stats.awardTx, 1);
    assert.strictEqual(db.docs['users/u'].points, 10);
    assert.strictEqual(db.docs['satoshiFavor/current'].points, 1);

    const hostile = memoryDb({ 'users/u': { points: 4 } });
    const lied = await grantFamily(hostile, admin, 'u', ['flex_findq_1', 'flex_findq_5'], Object.assign({
        flexClaims: { byAction: { findq: 100 }, sum: 100 },
    }, day));
    assert.strictEqual(lied[0].granted, false);
    assert.strictEqual(lied[0].reason, 'criteria');
    assert.strictEqual(lied[1].reason, 'criteria');
    assert.strictEqual(hostile.docs['users/u/badge_awards/flex_findq_1'], undefined);
    assert.strictEqual(hostile.docs['users/u'].points, 4);
    assert.strictEqual(hostile.docs['satoshiFavor/current'], undefined);

    const server = memoryDb({
        'users/u': { points: 0 },
        'users/u/daily_action_counts/2026-07-04_flex_findq': { actionId: 'findq' },
    });
    const paid = await grantFamily(server, admin, 'u', ['flex_findq_1'], Object.assign({
        flexClaims: { byAction: {}, sum: 0 },
    }, day));
    assert.strictEqual(paid[0].granted, true);
    assert.strictEqual(paid[0].xp, 10);
    const again = await grantFamily(server, admin, 'u', ['flex_findq_1'], Object.assign({
        flexClaims: { byAction: { findq: 100 }, sum: 100 },
    }, day, { nowMs: day.nowMs + 1000 }));
    assert.strictEqual(again[0].reason, 'already');
    assert.strictEqual(again[0].granted, false);
    assert.strictEqual(server.docs['users/u'].points, 10);
    assert.strictEqual(server.docs['satoshiFavor/current'].points, 1);

    const legacy = memoryDb({ 'users/u': { points: 3, visibleBadges: ['flex_findq_1'] } });
    const legacyStats = watchBadgeReads(legacy);
    const kept = await grantFamily(legacy, admin, 'u', ['flex_findq_1'], day);
    assert.strictEqual(kept[0].reason, 'legacy');
    assert.strictEqual(kept[0].xp, 0);
    assert.strictEqual(legacy.docs['users/u'].points, 3);
    assert.strictEqual(legacy.docs['satoshiFavor/current'], undefined);
    assert.strictEqual(legacy.docs['users/u/badge_awards/flex_findq_1'].source, 'legacy');
    assert.strictEqual(legacyStats.awardTx, 1);

    const banned = memoryDb({
        'users/u': { points: 0, banned: true },
        'users/u/daily_action_counts/2026-07-04_flex_findq': { actionId: 'findq' },
    });
    const blocked = await grantFamily(banned, admin, 'u', ['flex_findq_1'], day);
    assert.strictEqual(blocked[0].reason, 'banned');
    assert.strictEqual(blocked[0].granted, false);
    assert.strictEqual(banned.docs['users/u/badge_awards/flex_findq_1'], undefined);
    assert.strictEqual(banned.docs['satoshiFavor/current'], undefined);

    const hi = memoryDb({ 'users/u': { sayHiDays: 1, points: 0 } });
    const hiStats = watchBadgeReads(hi);
    const hiGrant = await grantFamily(hi, admin, 'u', ['say_hi_1', 'say_hi_7', 'say_hi_30', 'say_hi_100'], day);
    assert.strictEqual(hiGrant[0].granted, true);
    assert.strictEqual(hiGrant[1].reason, 'criteria');
    assert.strictEqual(hiGrant[2].reason, 'criteria');
    assert.strictEqual(hiGrant[3].reason, 'criteria');
    assert.strictEqual(hiStats.outside, 0);
    assert.strictEqual(hiStats.inside, 0);
    assert.strictEqual(hiStats.awardTx, 1);
    const hiAgain = await grantFamily(hi, admin, 'u', ['say_hi_1', 'say_hi_7'], day);
    assert.strictEqual(hiAgain[0].reason, 'already');
    assert.strictEqual(hiAgain[1].reason, 'criteria');
    assert.strictEqual(hi.docs['users/u'].points, 10);
    assert.strictEqual(hi.docs['satoshiFavor/current'].points, 1);
    assert.strictEqual(hiStats.awardTx, 1);
    assert.strictEqual(hiStats.outside, 0);
}));

Promise.all(queue).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
