// New badge sources: server fields, raffle ladder, taper, and rules denylist.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const badgeRules = require('../functions/src/badgeRules');
const progress = require('../functions/src/badgeProgress');
const { planBadgeDailyXp } = require('../functions/src/applyDailyXp');
const { familyFor } = require('../functions/src/grantBadge');

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
    assert.strictEqual(other.xp, 5);
    const capped = progress.planTopicCredit({
        post: post,
        user: person('ada', { topicCountDay: '2026-10-22', topicCountToday: 5 }),
        nowMs: NOW,
        day: '2026-10-22',
    });
    assert.strictEqual(capped.credit, false);
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

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
