// New badge sources: server fields, raffle ladder, taper, and rules denylist.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const badgeRules = require('../functions/src/badgeRules');
const progress = require('../functions/src/badgeProgress');
const { planBadgeDailyXp } = require('../functions/src/applyDailyXp');
const { familyFor } = require('../functions/src/grantBadge');
const counters = require('../functions/scripts/backfill_badge_counters');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e));
        failed++;
    }
}

function rule(id) {
    return badgeRules.ruleFor(id);
}

const NOW = Date.parse('2026-10-23T12:00:00Z');
const OLD = NOW - 8 * 24 * 60 * 60 * 1000;

function person(uid, extra) {
    return Object.assign({
        uid: uid,
        created: OLD,
        peers: [],
        username: uid,
    }, extra || {});
}

test('each new badge reads a server field and pays the tier', function () {
    const expect = {
        gift_open_1: ['giftsOpened', 1, 10],
        gift_open_1500: ['giftsOpened', 1500, 2000],
        gift_lucky_shoutout: ['giftShoutoutWon', null, 50],
        gift_sent_200: ['giftsSent', 200, 2000],
        key_peers_21: ['keyPeersDistinct', 21, 500],
        cipher_peer_key_1: ['peerKeyCiphers', 1, 10],
        cipher_full_ring: ['cipherFullRing', null, 150],
        cipher_sats_10k: ['cipherBiggestWin', 10000, 2000],
        peer_level_2: ['peerBestLevel', 2, 10],
        peer_level_6: ['peerBestLevel', 6, 2000],
        peer_hub_5: ['peersAtL3', 5, 500],
        topic_comment_250: ['topicComments', 250, 500],
        topic_channels_10: ['topicChannelsCommented', 10, 150],
        first_purchase: ['shopPurchases', 1, 10],
        shop_50: ['shopPurchases', 50, 150],
        raffle_entered: ['raffleTicketsBought', 1, 10],
        raffle_1000: ['raffleTicketsBought', 1000, 2000],
        raffle_winner: ['raffleWins', 1, 500],
        predict_top_week: ['predTopWeeks', 1, 150],
        predict_top_month: ['predTopMonths', 1, 500],
        totp_enabled: ['totpEnabled', null, 50],
        faction_chosen: ['faction', null, 10],
        onboarding_complete: ['onboardingComplete', null, 10],
        push_enabled: ['pushEnabled', null, 10],
        quest_days_30: ['questDays', 30, 150],
        tctv_daily_1: ['tctvWatchDays', 1, 10],
    };
    Object.keys(expect).forEach(function (id) {
        const row = rule(id);
        assert.ok(row && !row.cosmetic, id + ' pays');
        assert.strictEqual(row.source.field, expect[id][0], id);
        if (expect[id][1] != null) assert.strictEqual(row.source.gte, expect[id][1], id + ' threshold');
        assert.strictEqual(row.xp, expect[id][2], id + ' xp');
    });
    assert.strictEqual(rule('peer_level_3').source.field, 'peerBestLevel');
    assert.notStrictEqual(rule('peer_level_3').source.field, 'peerCount');
    assert.strictEqual(rule('cipher_peer_key_25').source.field, 'peerKeyCiphers');
    assert.strictEqual(rule('predict_top_week_5').source.field, 'predTopWeeks');
    assert.strictEqual(rule('push_enabled').source.field, 'pushEnabled');
});

test('raffle ladder is monotonic and the 1-ticket badge is the old first entry', function () {
    // A raffle ticket costs 10 orange tickets, and one purchase can buy 1 to 10.
    // 1 ticket is the starter. 10 is about 100 orange tickets. 50 is about 500.
    // 250 is about 2,500. 1,000 is about 10,000, a long stretch of play.
    // Those rungs stay in the suggested order. There is no second 1-ticket id.
    const ladder = ['raffle_entered', 'raffle_10', 'raffle_50', 'raffle_250', 'raffle_1000'];
    let prev = 0;
    let prevXp = 0;
    ladder.forEach(function (id) {
        const row = rule(id);
        assert.ok(row.source.gte > prev, id);
        assert.ok(row.xp >= prevXp, id + ' xp');
        prev = row.source.gte;
        prevXp = row.xp;
    });
    assert.strictEqual(rule('raffle_entered').xp, 10);
    assert.ok(!badgeRules.isKnown('raffle_1'));
    assert.deepStrictEqual(badgeRules.SETS.set_raffle, ladder.concat(['raffle_winner']));
    assert.ok(badgeRules.SETS.set_trader.indexOf('raffle_entered') === -1);
    assert.ok(badgeRules.SETS.set_trader.indexOf('first_purchase') !== -1);
});

test('collections use the named members, including the scholar replacement', function () {
    assert.deepStrictEqual(badgeRules.SETS.set_scholar_daily, ['trivia_correct_30', 'quest_days_30', 'poll_days_30']);
    assert.ok(badgeRules.SETS.set_oracle.indexOf('predict_top_month') !== -1);
    assert.ok(badgeRules.SETS.set_sovereign.indexOf('totp_enabled') !== -1);
    assert.ok(badgeRules.SETS.set_sovereign.indexOf('lightning_address_set') !== -1);
    assert.ok(badgeRules.SETS.set_favor.indexOf('faction_chosen') !== -1);
    assert.ok(badgeRules.SETS.set_generous.indexOf('gift_sent_200') !== -1);
    assert.strictEqual(rule('set_raffle').xp, 500);
    assert.strictEqual(rule('set_oracle').xp, 500);
    assert.strictEqual(rule('set_sovereign').xp, 150);
    assert.ok(familyFor('raffleTicketsBought').indexOf('raffle_entered') !== -1);
    assert.ok(familyFor('shopPurchases').indexOf('first_purchase') !== -1);
});

test('meets reads counters, arrays, and truthy server fields', function () {
    assert.strictEqual(badgeRules.meets(rule('raffle_10'), { raffleTicketsBought: 10 }, {}), true);
    assert.strictEqual(badgeRules.meets(rule('raffle_10'), { raffleTicketsBought: 9 }, {}), false);
    assert.strictEqual(badgeRules.meets(rule('topic_channels_10'), { topicChannelsCommented: ['a','b','c','d','e','f','g','h','i','j'] }, {}), true);
    assert.strictEqual(badgeRules.meets(rule('topic_channels_10'), { topicChannelsCommented: ['a'] }, {}), false);
    assert.strictEqual(badgeRules.meets(rule('totp_enabled'), { totpEnabled: true }, {}), true);
    assert.strictEqual(badgeRules.meets(rule('faction_chosen'), { faction: 'honey_badgers' }, {}), true);
    assert.strictEqual(badgeRules.meets(rule('first_purchase'), { shopPurchases: 1 }, {}), true);
});

test('peer key credit counts a used key and skips a young or linked opener', function () {
    const opener = person('opener', { peers: ['sender'] });
    const sender = person('sender', { peers: ['opener'] });
    const ok = progress.planPeerKeyCredit({
        opener: opener,
        sender: sender,
        peerKey: true,
        opensToday: 21,
        nowMs: NOW,
        day: '2026-10-23',
    });
    assert.strictEqual(ok.giftsSent, true);
    assert.strictEqual(ok.distinct, true);
    assert.strictEqual(ok.openerCipher, true);
    assert.strictEqual(ok.fullRing, true);
    assert.strictEqual(ok.senderXp, 10);
    const young = progress.planPeerKeyCredit({
        opener: person('opener', { peers: ['sender'], created: NOW }),
        sender: sender,
        peerKey: true,
        opensToday: 3,
        nowMs: NOW,
        day: '2026-10-23',
    });
    assert.strictEqual(young.giftsSent, false);
    assert.strictEqual(young.senderXp, 0);
    assert.strictEqual(young.reason, 'young');
    const missing = progress.planPeerKeyCredit({
        opener: person('opener', { peers: ['sender'], created: null }),
        sender: sender,
        peerKey: true,
        nowMs: NOW,
        day: '2026-10-23',
    });
    assert.strictEqual(missing.reason, 'young');
    const again = progress.planPeerKeyCredit({
        opener: opener,
        sender: sender,
        peerKey: true,
        pairCredited: true,
        distinctCredited: true,
        openerCountedSender: true,
        nowMs: NOW,
        day: '2026-10-23',
    });
    assert.strictEqual(again.giftsSent, false);
    assert.strictEqual(again.senderXp, 0);
});

test('peer level, accept XP, shop, quest day, cipher pay, and raffle winner plans', function () {
    const level = progress.planPeerLevel({
        eligible: true,
        storedLevel: 2,
        newLevel: 3,
        senderBest: 2,
        recipBest: 1,
    });
    assert.strictEqual(level.credit, true);
    assert.strictEqual(level.crossedL3, true);
    assert.strictEqual(level.senderBest, 3);
    const blocked = progress.planPeerLevel({ eligible: false, storedLevel: 1, newLevel: 2, senderBest: 1, recipBest: 1 });
    assert.strictEqual(blocked.credit, false);
    const accept = progress.planPeerAcceptXp({
        eligible: true,
        left: person('a'),
        right: person('b'),
        day: '2026-10-23',
    });
    assert.strictEqual(accept.leftXp, 10);
    assert.strictEqual(accept.rightXp, 10);
    assert.strictEqual(accept.mark, true);
    const repeat = progress.planPeerAcceptXp({ marker: true, eligible: true, left: person('a'), right: person('b'), day: '2026-10-23' });
    assert.strictEqual(repeat.mark, false);
    assert.strictEqual(repeat.leftXp, 0);
    const shop = progress.planShopPurchase({ type: 'raffle', quantity: 4 });
    assert.strictEqual(shop.shopPurchases, 1);
    assert.strictEqual(shop.raffleTickets, 4);
    const other = progress.planShopPurchase({ type: 'consumable', quantity: 3 });
    assert.strictEqual(other.raffleTickets, 0);
    assert.strictEqual(progress.planQuestDay({ day: '2026-10-23', lastQuestDate: '' }).increment, true);
    assert.strictEqual(progress.planQuestDay({ day: '2026-10-23', lastQuestDate: '2026-10-23' }).increment, false);
    const paid = progress.planCipherPaid({ alreadyCredited: false, biggest: 100, amount: 10000 });
    assert.strictEqual(paid.credit, true);
    assert.strictEqual(paid.biggest, 10000);
    assert.strictEqual(progress.planCipherPaid({ alreadyCredited: true, amount: 100 }).credit, false);
    assert.strictEqual(progress.planRaffleWinner({ user: { banned: true } }).skip, true);
    assert.strictEqual(progress.planRaffleWinner({ user: { withdrawalsDisabled: true } }).skip, true);
    assert.strictEqual(progress.planRaffleWinner({ user: { username: 'ada' } }).skip, false);
});

test('topic comments wait a day, cap the badge count, and can be revoked', function () {
    const post = {
        uid: 'ada',
        text: 'this comment is long enough to count',
        createdAtMs: NOW - progress.COMMENT_MATURE_MS - 1000,
        channelId: 'mining',
        hidden: false,
        deleted: false,
    };
    const young = progress.planTopicCredit({
        post: Object.assign({}, post, { createdAtMs: NOW - 1000 }),
        user: person('ada', { topicCountDay: '2026-10-22', topicCountToday: 0, topicXpCount: 0 }),
        nowMs: NOW,
        day: '2026-10-22',
    });
    assert.strictEqual(young.close, false);
    const credit = progress.planTopicCredit({
        post: post,
        user: person('ada', { topicCountDay: '2026-10-22', topicCountToday: 1, topicXpDay: '2026-10-23', topicXpCount: 0 }),
        nowMs: NOW,
        day: '2026-10-22',
    });
    assert.strictEqual(credit.credit, true);
    assert.strictEqual(credit.xp, 0);
    const mirror = progress.planTopicCredit({
        post: Object.assign({}, post, { channelId: '', topicPost: 'p1', source: 'pleb-talk-mirror' }),
        user: person('ada', { topicCountDay: '2026-10-22', topicCountToday: 1, topicXpDay: '2026-10-23', topicXpCount: 0 }),
        nowMs: NOW,
        day: '2026-10-22',
    });
    assert.strictEqual(mirror.credit, false);
    assert.strictEqual(mirror.xp, 0);
    assert.strictEqual(mirror.reason, 'mirror');
    const forumCopy = progress.planTopicCredit({
        post: Object.assign({}, post, {
            channelId: '',
            origin: 'topic',
            noAward: true,
            mirrorOf: 'p1',
            topicChannel: 'mining',
        }),
        user: person('ada', { topicCountDay: '2026-10-22', topicCountToday: 1, topicXpDay: '2026-10-23', topicXpCount: 0 }),
        nowMs: NOW,
        day: '2026-10-22',
    });
    assert.strictEqual(forumCopy.credit, false);
    assert.strictEqual(forumCopy.xp, 0);
    const echoed = progress.planTopicCredit({
        post: Object.assign({}, post, { origin: 'forum', noAward: true, mirrorOf: 'reply1' }),
        user: person('ada', { topicCountDay: '2026-10-22', topicCountToday: 1 }),
        nowMs: NOW,
        day: '2026-10-22',
    });
    assert.strictEqual(echoed.credit, false);
    const discussion = progress.planTopicCredit({
        post: Object.assign({}, post, { collection: 'topic_discussions' }),
        user: person('ada', { topicCountDay: '2026-10-22', topicCountToday: 1, topicXpDay: '2026-10-23', topicXpCount: 0 }),
        nowMs: NOW,
        day: '2026-10-22',
    });
    assert.strictEqual(discussion.credit, true);
    assert.strictEqual(discussion.xp, 0);
    const other = progress.planTopicCredit({
        post: {
            uid: 'ada',
            text: 'this comment is long enough to count',
            createdAtMs: NOW - progress.COMMENT_MATURE_MS - 1000,
            hidden: false,
            deleted: false,
        },
        user: person('ada', { topicCountDay: '2026-10-22', topicCountToday: 1, topicXpDay: '2026-10-23', topicXpCount: 0 }),
        nowMs: NOW,
        day: '2026-10-22',
    });
    assert.strictEqual(other.credit, true);
    assert.strictEqual(other.xp, 0);
    const capped = progress.planTopicCredit({
        post: post,
        user: person('ada', { topicCountDay: '2026-10-22', topicCountToday: 5 }),
        nowMs: NOW,
        day: '2026-10-22',
    });
    assert.strictEqual(capped.credit, false);
    assert.strictEqual(capped.close, true);
    assert.strictEqual(capped.reason, 'badge-cap');
    const backlog = progress.planTopicCredit({
        post: Object.assign({}, post, { dayKey: '2026-10-01' }),
        user: person('ada', { topicCountDay: '2026-10-23', topicCountToday: 5 }),
        nowMs: NOW,
        day: '2026-10-23',
    });
    assert.strictEqual(backlog.credit, false);
    assert.strictEqual(backlog.close, true);
    const hidden = progress.planTopicCredit({
        post: Object.assign({}, post, { hidden: true }),
        user: person('ada'),
        nowMs: NOW,
        day: '2026-10-22',
    });
    assert.strictEqual(hidden.credit, false);
    assert.strictEqual(hidden.close, true);
    assert.strictEqual(progress.planTopicRevoke({ post: { badgeCounted: true, uid: 'ada', channelId: 'mining' } }).revoke, true);
    assert.strictEqual(progress.planTopicRevoke({ post: { badgeCounted: false } }).revoke, false);
});

test('the shared taper drops overflow instead of banking it', function () {
    const mid = planBadgeDailyXp(900, 150);
    assert.strictEqual(mid.awarded, 37);
    assert.strictEqual(mid.dailyXp, 937);
    assert.strictEqual(mid.overflowAdded, 0);
    assert.strictEqual(mid.dropped, 113);
    const full = planBadgeDailyXp(1000, 10);
    assert.strictEqual(full.awarded, 0);
    assert.strictEqual(full.overflowAdded, 0);
    assert.strictEqual(full.capped, true);
    const early = planBadgeDailyXp(590, 20);
    assert.strictEqual(early.awarded, 10);
    assert.strictEqual(early.dailyXp, 600);
});

test('sendKeys rejects a banned sender and the new grants write xp_ledger', function () {
    const gifting = fs.readFileSync(path.join(root, 'functions/src/gifting.js'), 'utf8');
    const keys = gifting.slice(gifting.indexOf('const sendKeys'), gifting.indexOf('const decryptCipher'));
    assert.ok(keys.indexOf('faucet_ledger') !== -1);
    assert.ok(keys.indexOf('rewardBlocked') !== -1);
    assert.ok(keys.indexOf('permission-denied') !== -1);
    const credit = fs.readFileSync(path.join(root, 'functions/src/badgeCredit.js'), 'utf8');
    assert.ok(credit.indexOf("source: 'peer_key_use'") !== -1);
    assert.ok(credit.indexOf("source: 'peer_accept'") !== -1);
    assert.ok(credit.indexOf("xp_ledger") !== -1);
    assert.ok(credit.indexOf(".where('createdAtMs', '<=', matureBefore)") !== -1);
    assert.ok(credit.indexOf(".orderBy('createdAtMs', 'asc')") !== -1);
    assert.ok(credit.indexOf('tx.delete(pendingRef)') !== -1);
    const doc = fs.readFileSync(path.join(root, 'functions/src/BADGE_VERIFICATION.md'), 'utf8');
    assert.ok(doc.indexOf('no separate +5') !== -1);
    assert.ok(doc.indexOf('refreshBadgeDistributionHttp') !== -1);
    assert.ok(doc.indexOf('mergeAnonBadges') !== -1);
});

test('counter backfill raises peersAtL3 and onboarding without paying XP', function () {
    assert.strictEqual(counters.relationshipLevel({ giftsExchanged: 21, level: 1 }), 3);
    assert.strictEqual(counters.levelForGifts(20), 2);
    const hub = counters.planUser({ username: 'ada' }, { peersAtL3: 5, peerBestLevel: 3 }, []);
    assert.strictEqual(hub.patch.peersAtL3, 5);
    assert.strictEqual(hub.patch.peerBestLevel, 3);
    assert.ok(hub.badges.indexOf('peer_hub_5') !== -1);
    assert.ok(hub.badges.indexOf('peer_level_3') !== -1);
    assert.strictEqual(hub.patch.points, undefined);
    assert.strictEqual(hub.xp, hub.badges.reduce(function (sum, id) { return sum + (badgeRules.xpOf(id) || 0); }, 0));
    assert.ok(hub.xp > 0);
    const held = counters.planUser({ peersAtL3: 5, peerBestLevel: 3 }, { peersAtL3: 4, peerBestLevel: 2 }, ['peer_hub_5', 'peer_level_2', 'peer_level_3']);
    assert.strictEqual(held.patch.peersAtL3, undefined);
    assert.ok(held.badges.indexOf('peer_hub_5') === -1);
    const aboard = counters.planUser({ nachoQuestDone: true }, {}, []);
    assert.strictEqual(aboard.patch.onboardingComplete, true);
    assert.ok(aboard.badges.indexOf('onboarding_complete') !== -1);
    const again = counters.planUser({ nachoQuestDone: true, onboardingComplete: true }, {}, ['onboarding_complete']);
    assert.strictEqual(again.patch.onboardingComplete, undefined);
    assert.ok(again.badges.indexOf('onboarding_complete') === -1);
    const script = fs.readFileSync(path.join(root, 'functions/scripts/backfill_badge_counters.js'), 'utf8');
    assert.ok(script.indexOf('rewardBlocked') !== -1);
    assert.ok(script.indexOf('--apply') !== -1);
    assert.ok(script.indexOf('args.apply && args.payXp') !== -1);
    assert.ok(script.indexOf("source: 'badge_backfill'") !== -1);
    assert.ok(script.indexOf('bypass: true') !== -1);
    const sendIds = {};
    ['k1', 'k2', 'k3'].forEach(function () {
        sendIds[counters.giftSendId({
            sentBy: 'ada',
            ownerId: 'bob',
            sendPairId: 'ada_bob_2026-10-23',
        })] = true;
    });
    assert.strictEqual(Object.keys(sendIds).length, 1);
    const dayA = counters.giftSendId({ sentBy: 'ada', ownerId: 'bob', sentAt: Date.parse('2026-10-23T12:00:00Z') });
    const dayB = counters.giftSendId({ sentBy: 'ada', ownerId: 'bob', sentAt: Date.parse('2026-10-24T12:00:00Z') });
    assert.notStrictEqual(dayA, dayB);
    const old = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const accounts = {
        ada: { user: { created: old, username: 'ada' }, ledger: {} },
        bob: { user: { created: old, username: 'bob' }, ledger: {} },
        kid: { user: { created: Date.now(), username: 'kid' }, ledger: {} },
        ban: { user: { created: old, banned: true }, ledger: {} },
    };
    assert.strictEqual(counters.keyPairCounts('ada', 'bob', accounts, Date.now()), true);
    assert.strictEqual(counters.keyPairCounts('ada', 'kid', accounts, Date.now()), false);
    assert.strictEqual(counters.keyPairCounts('kid', 'ada', accounts, Date.now()), true);
    assert.strictEqual(counters.keyPairCounts('ada', 'ban', accounts, Date.now()), false);
    assert.strictEqual(counters.peerPairCounts('ada', 'bob', accounts, Date.now()), true);
    assert.strictEqual(counters.peerPairCounts('ada', 'kid', accounts, Date.now()), false);
    assert.strictEqual(counters.peerPairCounts('kid', 'ada', accounts, Date.now()), false);
    const paidIds = counters.payBadgeIds(['gift_open_1'], ['onboarding_complete'], ['gift_open_1', 'shop_10']);
    assert.deepStrictEqual(paidIds, ['gift_open_1', 'onboarding_complete', 'shop_10']);
    const topicRow = { topicComments: 0, topicChannels: {}, topicChannelCounts: {}, topicMarks: {} };
    const mature = Date.now() - progress.COMMENT_MATURE_MS - 1000;
    counters.noteTopic(topicRow, {
        uid: 'ada', channelId: 'mining', postId: 'p1', text: 'this comment is long enough to count', createdAtMs: mature,
    }, Date.now(), accounts);
    counters.noteTopic(topicRow, {
        uid: 'ada', channelId: 'mining', postId: 'p2', text: 'this counted comment is long enough', createdAtMs: mature, badgeCounted: true,
    }, Date.now(), accounts);
    counters.noteTopic(topicRow, {
        uid: 'ada', channelId: 'mining', postId: 'p3', text: 'this young comment is long enough to count', createdAtMs: Date.now(),
    }, Date.now(), accounts);
    assert.strictEqual(topicRow.topicComments, 2);
    assert.ok(topicRow.topicMarks.mining_p1);
    assert.strictEqual(topicRow.topicMarks.mining_p2, undefined);
    const legacy = counters.legacyDecision(
        { giftsOpened: 1 },
        {},
        new Set(['gift_open_1', 'gift_open_25'])
    );
    assert.ok(legacy.write.indexOf('gift_open_1') !== -1);
    assert.ok(legacy.skipped.indexOf('gift_open_25') !== -1);
    const pay = counters.planBadgePay({ points: 0 }, ['onboarding_complete'], [], []);
    assert.strictEqual(pay.xp, badgeRules.xpOf('onboarding_complete'));
    assert.strictEqual(pay.badgeFavor, 1);
    const paidAlready = counters.planBadgePay({ points: 0 }, ['onboarding_complete'], ['onboarding_complete'], []);
    assert.strictEqual(paidAlready.xp, 0);
    const { planUserBadges } = require('../functions/src/badgeXpBackfill');
    const blocked = planUserBadges({
        user: { points: 0, giftsOpened: 1, visibleBadges: ['gift_open_1'] },
        awardIds: ['gift_open_1'],
        awardById: { gift_open_1: { xp: 0, xpSource: 'badge_backfill', source: 'counter_backfill' } },
        markerIds: [],
    });
    assert.ok(blocked.topUps.every(function (row) { return row.topUp === 0; }));
});

test('rules deny the new counters and the cert fields', function () {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const fnAt = rules.indexOf('function userProfileServerOnlyKeys()');
    const fn = rules.slice(fnAt, rules.indexOf('match /users/{userId}', fnAt));
    [
        'giftsOpened', 'giftShoutoutWon', 'keyPeersDistinct', 'peerKeyCiphers',
        'cipherFullRing', 'cipherSatsPaid', 'cipherBiggestWin', 'peerBestLevel', 'peersAtL3',
        'topicComments', 'topicChannelsCommented', 'shopPurchases', 'raffleTicketsBought',
        'raffleWins', 'predTopWeeks', 'predTopMonths', 'pushEnabled',
        'certPassed_prop', 'certPassed_tech', 'scholar_exam_passed', 'scholar_tech_passed',
    ].forEach(function (key) {
        assert.ok(fn.indexOf("'" + key + "'") !== -1, key);
    });
    ['key_gift_credits', 'peer_key_days', 'key_use_credits', 'peer_xp_credits', 'topic_comment_pending'].forEach(function (name) {
        assert.ok(rules.indexOf('match /' + name + '/') !== -1, name);
    });
    const client = fs.readFileSync(path.join(root, 'badges.js'), 'utf8');
    assert.ok(client.indexOf("localStorage.getItem('btc_fp_completed')") === -1);
    assert.ok(client.indexOf('shopPurchases') !== -1);
    assert.ok(client.indexOf("name:'Raffle Regular'") !== -1 || client.indexOf("name: 'Raffle Regular'") !== -1 || client.indexOf("name:'Raffle Regular'") !== -1);
    assert.ok(client.indexOf('set_raffle') !== -1);
});

const { creditMatureTopicComments } = require('../functions/src/badgeCredit');
const { offsetDateKey } = require('../functions/src/offsetDay');

function topicQueueDb(seed) {
    const docs = Object.assign({}, seed || {});
    function snap(path) {
        const data = docs[path];
        return {
            id: path.slice(path.lastIndexOf('/') + 1),
            exists: data != null,
            ref: ref(path),
            data: function () { return data ? Object.assign({}, data) : undefined; },
        };
    }
    function applyWrite(path, data, update) {
        if (!update) {
            docs[path] = Object.assign({}, data);
            return;
        }
        const next = Object.assign({}, docs[path]);
        Object.keys(data).forEach(function (key) {
            const value = data[key];
            if (value && value._increment) next[key] = (Number(next[key]) || 0) + value._increment;
            else if (value && value._arrayUnion) {
                const cur = Array.isArray(next[key]) ? next[key].slice() : [];
                value._arrayUnion.forEach(function (item) {
                    if (cur.indexOf(item) === -1) cur.push(item);
                });
                next[key] = cur;
            } else next[key] = value;
        });
        docs[path] = next;
    }
    function ref(path) {
        return {
            path: path,
            id: path.slice(path.lastIndexOf('/') + 1),
            collection: function (name) { return collection(path + '/' + name); },
            get: function () { return Promise.resolve(snap(path)); },
        };
    }
    function collection(prefix) {
        return {
            doc: function (id) { return ref(prefix + '/' + id); },
            where: function () { return this; },
            orderBy: function () { return this; },
            limit: function (n) { this._limit = n; return this; },
            get: function () {
                const limit = this._limit || 400;
                const rows = [];
                Object.keys(docs).forEach(function (path) {
                    const head = prefix + '/';
                    if (path.indexOf(head) !== 0) return;
                    const rest = path.slice(head.length);
                    if (!rest || rest.indexOf('/') !== -1) return;
                    const data = docs[path];
                    if (!data || data.open !== true) return;
                    rows.push(snap(path));
                });
                rows.sort(function (a, b) { return a.data().createdAtMs - b.data().createdAtMs; });
                const page = rows.slice(0, limit);
                return Promise.resolve({
                    empty: page.length === 0,
                    size: page.length,
                    docs: page,
                    forEach: function (fn) { page.forEach(fn); },
                });
            },
        };
    }
    return {
        docs: docs,
        collection: function (name) { return collection(name); },
        runTransaction: function (fn) {
            const staged = [];
            const removed = [];
            const tx = {
                get: function (r) { return r.get(); },
                set: function (r, data, opts) {
                    staged.push({ path: r.path, data: data, update: !!(opts && opts.merge) });
                },
                update: function (r, data) { staged.push({ path: r.path, data: data, update: true }); },
                delete: function (r) { removed.push(r.path); },
            };
            return Promise.resolve(fn(tx)).then(function (result) {
                staged.forEach(function (w) { applyWrite(w.path, w.data, w.update); });
                removed.forEach(function (path) { delete docs[path]; });
                return result;
            });
        },
    };
}

const queueAdmin = {
    firestore: {
        FieldValue: {
            serverTimestamp: function () { return { _serverTimestamp: true }; },
            increment: function (n) { return { _increment: n }; },
            arrayUnion: function () { return { _arrayUnion: Array.prototype.slice.call(arguments) }; },
        },
    },
};

function finish(err) {
    if (err) {
        console.log('❌ ' + (err && err.message ? err.message : err));
        failed += 1;
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
}

const queueNow = Date.parse('2026-10-23T12:00:00Z');
const queueDay = offsetDateKey(queueNow);
const queueSeed = {};
const cappedText = 'this capped comment is long enough to count';
for (let i = 0; i < 401; i++) {
    const postId = 'c' + i;
    const created = queueNow - 10 * 24 * 60 * 60 * 1000 + i;
    queueSeed['topic_comment_pending/mining_' + postId] = {
        open: true,
        uid: 'full',
        channelId: 'mining',
        postId: postId,
        createdAtMs: created,
    };
    queueSeed['topic_discussions/mining/posts/' + postId] = {
        uid: 'full',
        channelId: 'mining',
        text: cappedText,
        createdAtMs: created,
        hidden: false,
        deleted: false,
    };
}
const openCreated = queueNow - 9 * 24 * 60 * 60 * 1000;
queueSeed['topic_comment_pending/mining_open1'] = {
    open: true,
    uid: 'open',
    channelId: 'mining',
    postId: 'open1',
    createdAtMs: openCreated,
};
queueSeed['topic_discussions/mining/posts/open1'] = {
    uid: 'open',
    channelId: 'mining',
    text: 'this open comment is long enough to count',
    createdAtMs: openCreated,
    hidden: false,
    deleted: false,
};
queueSeed['users/full'] = {
    uid: 'full',
    created: queueNow - 30 * 24 * 60 * 60 * 1000,
    topicCountDay: queueDay,
    topicCountToday: 5,
    points: 0,
};
queueSeed['users/open'] = {
    uid: 'open',
    created: queueNow - 30 * 24 * 60 * 60 * 1000,
    topicCountDay: queueDay,
    topicCountToday: 0,
    points: 0,
};

const queueDb = topicQueueDb(queueSeed);
creditMatureTopicComments(queueDb, queueAdmin, queueNow, 400).then(function (first) {
    assert.strictEqual(first.scanned, 400);
    assert.strictEqual(first.credited, 0);
    assert.strictEqual(queueDb.docs['users/open'].topicComments, undefined);
    return creditMatureTopicComments(queueDb, queueAdmin, queueNow, 400);
}).then(function (second) {
    assert.strictEqual(second.credited, 1);
    assert.strictEqual(queueDb.docs['users/open'].topicComments, 1);
    assert.strictEqual(queueDb.docs['users/full'].topicComments, undefined);
    assert.strictEqual(queueDb.docs['topic_comment_pending/mining_open1'], undefined);
    assert.strictEqual(queueDb.docs['topic_comment_pending/mining_c400'], undefined);
    console.log('✅ capped topic posts are deleted and do not block the next post');
    passed += 1;
    finish();
}).catch(finish);
