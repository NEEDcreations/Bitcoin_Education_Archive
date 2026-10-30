'use strict';

const badgeRules = require('./badgeRules');
const { profileHoldsBadge } = require('./badgeProfile');

function offsetDateKey(nowMs) {
    const shifted = new Date(Number(nowMs || Date.now()) - 5 * 3600 * 1000);
    return shifted.toISOString().slice(0, 10);
}

function idsFromSnap(snap) {
    const ids = [];
    if (!snap) return ids;
    if (typeof snap.forEach === 'function') {
        snap.forEach(function (doc) { if (doc && doc.id) ids.push(doc.id); });
        return ids;
    }
    (snap.docs || []).forEach(function (doc) { if (doc && doc.id) ids.push(doc.id); });
    return ids;
}

function denial(badgeId, reason, extra) {
    const success = reason === 'cosmetic' || reason === 'banned' || reason === 'legacy';
    return Object.assign({
        granted: false,
        success: success,
        reason: reason,
        awarded: 0,
        xp: 0,
        badgeId: badgeId,
    }, extra || {});
}

function needsFlexClaims(rule) {
    if (!rule || !rule.source) return false;
    const type = rule.source.type;
    return type === 'flex' || type === 'flexSum' || type === 'flexAll';
}

// Counter, flex, and set rules can be decided from the user doc plus the
// award ids and the flex tally. Scholar exams need their own query, so those
// still go through awardBadge.
function canPrecheck(rule) {
    if (!rule || !rule.source || !rule.source.type) return false;
    const type = rule.source.type;
    return type === 'counter' || type === 'arrayLength' || type === 'flex' || type === 'flexSum'
        || type === 'flexAll' || type === 'truthy' || type === 'either' || type === 'text'
        || type === 'includes' || type === 'awards' || type === 'set' || type === 'accuracy'
        || type === 'ghostReader' || type === 'silentDonor' || type === 'profile' || type === 'signed-in';
}

async function grantBadgeIfEarned(db, adminSdk, uid, badgeId, opts) {
    return require('./awardBadge').awardBadge(db, adminSdk, uid, badgeId, opts);
}

async function grantFamily(db, adminSdk, uid, ids, opts) {
    const list = ids || [];
    if (!list.length) return [];
    const { cleanId } = require('./awardBadge');
    // Caller-supplied flex tallies are ignored. The numbers come from this
    // server read of daily_action_counts, then awardBadge checks them again.
    const options = Object.assign({}, opts || {});
    delete options.flexClaims;

    const userRef = db.collection('users').doc(uid);
    const awardSnap = await userRef.collection('badge_awards').get();
    const earned = new Set(idsFromSnap(awardSnap));
    const out = new Array(list.length);
    const pending = [];
    for (let i = 0; i < list.length; i++) {
        const badgeId = cleanId(list[i]);
        if (!badgeId) {
            out[i] = denial('', 'unknown');
            continue;
        }
        if (earned.has(badgeId)) {
            out[i] = denial(badgeId, 'already', { favor: false });
            continue;
        }
        pending.push({ index: i, badgeId: badgeId });
    }
    if (!pending.length) return out;

    const userSnap = await userRef.get();
    const userExists = !!(userSnap && userSnap.exists);
    const user = userExists ? (userSnap.data() || {}) : {};

    let needFlex = false;
    for (let i = 0; i < pending.length; i++) {
        const rule = badgeRules.ruleFor(pending[i].badgeId);
        if (rule && !rule.cosmetic && needsFlexClaims(rule)) {
            needFlex = true;
            break;
        }
    }
    if (userExists && needFlex) {
        const countsSnap = await userRef.collection('daily_action_counts').get();
        options.flexClaims = badgeRules.tallyFlexClaims(idsFromSnap(countsSnap));
    }

    for (let i = 0; i < pending.length; i++) {
        const badgeId = pending[i].badgeId;
        const rule = badgeRules.ruleFor(badgeId);
        if (!rule) {
            out[pending[i].index] = denial(badgeId, 'unknown');
            continue;
        }
        if (rule.cosmetic && options.verified !== true) {
            out[pending[i].index] = denial(badgeId, 'cosmetic', { cosmetic: true });
            continue;
        }
        if (!userExists) {
            out[pending[i].index] = denial(badgeId, 'no_user');
            continue;
        }
        const held = profileHoldsBadge(user, badgeId);
        const ctx = {
            awardSet: earned,
            payingCount: badgeRules.countPaying(earned),
            signedIn: options.signedIn !== false,
            flexClaims: options.flexClaims || null,
        };
        const met = options.verified === true || (canPrecheck(rule) && badgeRules.meets(rule, user, ctx));
        if (canPrecheck(rule) && options.verified !== true && !met && !held) {
            out[pending[i].index] = denial(badgeId, 'criteria');
            continue;
        }
        const result = await grantBadgeIfEarned(db, adminSdk, uid, badgeId, options);
        out[pending[i].index] = result;
        if (result && (result.granted || result.reason === 'already' || result.reason === 'legacy')) {
            earned.add(badgeId);
        }
    }
    return out;
}

const FAMILY = {
    marketSold: ['market_sold_1', 'market_sold_5'],
    sayHiDays: ['say_hi_1', 'say_hi_7', 'say_hi_30', 'say_hi_100'],
    trifectaDays: ['daily_triple_1', 'daily_triple_7', 'daily_triple_30', 'daily_triple_90', 'daily_triple_365', 'sf_trifecta_10', 'sf_trifecta_50', 'sf_trifecta_100'],
    dailyFiveDays: ['daily_five_1', 'daily_five_7', 'daily_five_30', 'daily_five_100'],
    dailyFiveStreak: ['daily_five_streak_7'],
    pollDays: ['poll_first', 'poll_10', 'poll_50', 'poll_100', 'poll_days_7', 'poll_days_30', 'poll_days_100'],
    referralCount: require('../referral-tiers').badgeIds(),
    referralMaxiCount: require('../referral-tiers').badgeIds(),
    chatCount: ['chat_first', 'chat_10', 'chat_25', 'chat_50', 'chat_100', 'chat_200', 'chat_500', 'chat_1000'],
    dmCount: ['dm_first', 'dm_buddy', 'dm_10', 'dm_25', 'dm_100'],
    beatsUploads: ['producer_1', 'producer_10'],
    articlesPublished: ['article_1', 'article_5', 'article_10', 'article_25'],
    satsWithdrawn: ['sats_first', 'sats_1k', 'sats_5k', 'sats_10k', 'sats_21k', 'sats_maxed'],
    replyBonusCount: ['reply_bonus_1', 'reply_bonus_25', 'reply_bonus_100', 'reply_bonus_500'],
    pvpWins: ['pvp_first', 'pvp_5', 'pvp_25', 'pvp_50', 'pvp_100'],
    pvpPlayed: ['pvp_played_1', 'pvp_played_10', 'pvp_played_50'],
    ciphersSolved: ['cipher_1', 'cipher_10', 'cipher_50', 'cipher_200'],
    sfHashes: ['sf_first_hash', 'sf_10_hashes', 'sf_50_hashes', 'sf_100_hashes', 'sf_500_hashes', 'sf_1000_hashes', 'sf_10000_hashes', 'sf_100000_hashes', 'hash_obsessed'],
    pointsDonated: ['donor_100', 'donor_500', 'donor_1000', 'donor_5000', 'donor_10000', 'donor_25000', 'donor_50000', 'donor_100000', 'silent_donor'],
    channelsVisited: ['first_channel', 'explorer_5', 'explorer_10', 'explorer_25', 'explorer_50', 'explorer_100', 'explorer_all', 'foundation_builder', 'experienced_pro', 'librarian', 'genesis'],
    bestStreak: ['streak_3', 'streak_7', 'streak_14', 'streak_21', 'streak_30', 'streak_60', 'streak_100', 'streak_200', 'streak_365'],
    peerCount: ['peer_1', 'peer_3', 'peer_10', 'peer_25', 'first_peer', 'peer_network_10', 'peer_network_50', 'peer_network_100', 'peer_network_250'],
    questsPassed: ['quest_1', 'quest_3', 'quest_5', 'quest_10', 'quest_25', 'quest_50', 'quest_100', 'quest_legend'],
    triviaCorrect: ['trivia_first', 'trivia_correct_1', 'trivia_correct_10', 'trivia_correct_30', 'trivia_correct_100', 'trivia_titan'],
    triviaStreak: ['trivia_streak_7', 'trivia_streak_30'],
    lqPassed: ['lq_what_is_bitcoin', 'lq_mining', 'lq_nodes', 'lq_self_custody', 'lq_lightning', 'lq_scarcity', 'lq_bitcoin_only', 'lq_privacy', 'lq_graduate'],
    spinDays: ['spin_1', 'spin_7', 'spin_30', 'spin_100'],
    spinStreak: ['spin_streak_7', 'spin_streak_14', 'spin_streak_30'],
    spinHitRare: ['spin_jackpot'],
    spinClosetAwards: ['spin_closet_1', 'spin_closet_5'],
    raidDamageAllTime: ['raid_first', 'raid_5', 'raid_10', 'raid_25', 'raid_50', 'raid_100', 'raid_warlord'],
    raidBossesDefeated: ['raid_boss_slayer', 'raid_boss_slayer_5', 'raid_boss_slayer_10'],
    raidWins: ['raid_winner'],
    tipsVerified: ['tip_first', 'tip_10'],
    tipsSentSats: ['tip_whale', 'tip_sats_10k'],
    tipsReceived: ['tip_received_1', 'tip_received_50', 'tip_magnet'],
    orangeTickets: ['ticket_bronze', 'ticket_silver', 'ticket_gold'],
    streakFreezesUsed: ['streak_freeze'],
    forumPosts: ['forum_first', 'forum_5', 'forum_10', 'forum_25', 'forum_50', 'forum_100', 'first_post'],
    forumReplies: ['forum_reply_1', 'forum_reply_10', 'first_reply'],
    marketListings: ['market_listed_1', 'market_listed_5', 'market_listed_10', 'market_seller'],
    marketMessages: ['market_message', 'market_buyer'],
    giftsOpened: ['gift_open_1', 'gift_open_25', 'gift_open_100', 'gift_open_500', 'gift_open_1500'],
    giftShoutoutWon: ['gift_lucky_shoutout'],
    giftsSent: ['gift_sent_1', 'gift_sent_10', 'gift_sent_50', 'gift_sent_200'],
    keyPeersDistinct: ['key_peers_5', 'key_peers_21'],
    peerKeyCiphers: ['cipher_peer_key_1', 'cipher_peer_key_25', 'cipher_peer_key_100'],
    cipherFullRing: ['cipher_full_ring'],
    cipherSatsPaid: ['cipher_sats_1', 'cipher_sats_5'],
    cipherBiggestWin: ['cipher_sats_10k'],
    peerBestLevel: ['peer_level_2', 'peer_level_3', 'peer_level_4', 'peer_level_5', 'peer_level_6'],
    peersAtL3: ['peer_hub_5'],
    topicComments: ['topic_comment_1', 'topic_comment_10', 'topic_comment_50', 'topic_comment_250'],
    shopPurchases: ['first_purchase', 'shop_10', 'shop_50'],
    raffleTicketsBought: ['raffle_entered', 'raffle_10', 'raffle_50', 'raffle_250', 'raffle_1000'],
    raffleWins: ['raffle_winner'],
    predTopWeeks: ['predict_top_week', 'predict_top_week_5'],
    predTopMonths: ['predict_top_month'],
    questDays: ['quest_days_7', 'quest_days_30', 'quest_days_100'],
    tctvWatchDays: ['tctv_daily_1', 'tctv_daily_7', 'tctv_daily_30', 'tctv_daily_100'],
    onboardingComplete: ['onboarding_complete'],
    pushEnabled: ['push_enabled'],
    totpEnabled: ['totp_enabled'],
    faction: ['faction_chosen'],
};

function familyFor(field) {
    return FAMILY[field] || [];
}

module.exports = {
    grantBadgeIfEarned: grantBadgeIfEarned,
    grantFamily: grantFamily,
    familyFor: familyFor,
    offsetDateKey: offsetDateKey,
};
