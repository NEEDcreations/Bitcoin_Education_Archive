'use strict';

const BADGE_DAILY_CAP = 1000;

function offsetDateKey(nowMs) {
    const shifted = new Date(Number(nowMs || Date.now()) - 5 * 3600 * 1000);
    return shifted.toISOString().slice(0, 10);
}

async function grantBadgeIfEarned(db, adminSdk, uid, badgeId, opts) {
    return require('./awardBadge').awardBadge(db, adminSdk, uid, badgeId, opts);
}

async function grantFamily(db, adminSdk, uid, ids, opts) {
    const out = [];
    for (let i = 0; i < ids.length; i++) {
        out.push(await grantBadgeIfEarned(db, adminSdk, uid, ids[i], opts));
    }
    return out;
}

const FAMILY = {
    marketListings: ['market_listed_1', 'market_listed_5', 'market_listed_10'],
    marketMessages: ['market_message'],
    marketSold: ['market_sold_1', 'market_sold_5'],
    sayHiDays: ['say_hi_1', 'say_hi_7', 'say_hi_30', 'say_hi_100'],
    trifectaDays: ['daily_triple_1', 'daily_triple_7', 'daily_triple_30', 'daily_triple_90', 'daily_triple_365', 'sf_trifecta_10', 'sf_trifecta_50', 'sf_trifecta_100'],
    dailyFiveDays: ['daily_five_1', 'daily_five_7', 'daily_five_30', 'daily_five_100'],
    dailyFiveStreak: ['daily_five_streak_7'],
    pollDays: ['poll_first', 'poll_10', 'poll_50', 'poll_100', 'poll_days_7', 'poll_days_30', 'poll_days_100'],
    peerCount: ['peer_1', 'peer_3', 'peer_10', 'peer_25'],
    referralCount: ['referral_1', 'referral_5', 'referral_10', 'referral_25', 'referral_50', 'referral_100'],
    chatCount: ['chat_first', 'chat_10', 'chat_25', 'chat_50', 'chat_100', 'chat_200', 'chat_500', 'chat_1000'],
    dmCount: ['dm_first', 'dm_buddy', 'dm_10', 'dm_25', 'dm_100'],
    forumPosts: ['forum_first', 'forum_5', 'forum_10', 'forum_25', 'forum_50', 'forum_100'],
    forumReplies: ['forum_reply_1', 'forum_reply_10'],
    beatsUploads: ['producer_1', 'producer_10'],
    articlesPublished: ['article_1', 'article_5', 'article_10', 'article_25'],
    satsWithdrawn: ['sats_first', 'sats_1k', 'sats_5k', 'sats_10k', 'sats_21k', 'sats_maxed'],
    replyBonusCount: ['reply_bonus_1', 'reply_bonus_25', 'reply_bonus_100', 'reply_bonus_500'],
    pvpWins: ['pvp_first', 'pvp_5', 'pvp_25', 'pvp_50', 'pvp_100'],
    pvpPlayed: ['pvp_played_1', 'pvp_played_10', 'pvp_played_50'],
    ciphersSolved: ['cipher_1', 'cipher_10', 'cipher_50', 'cipher_200'],
    sfHashes: ['sf_first_hash', 'sf_10_hashes', 'sf_50_hashes', 'sf_100_hashes', 'sf_500_hashes', 'sf_1000_hashes', 'sf_10000_hashes', 'sf_100000_hashes'],
    pointsDonated: ['donor_100', 'donor_500', 'donor_1000', 'donor_5000', 'donor_10000', 'donor_25000', 'donor_50000', 'donor_100000', 'silent_donor'],
    channelsVisited: ['first_channel', 'explorer_5', 'explorer_10', 'explorer_25', 'explorer_50', 'explorer_100', 'explorer_all', 'foundation_builder', 'experienced_pro', 'librarian'],
    bestStreak: ['streak_3', 'streak_7', 'streak_14', 'streak_21', 'streak_30', 'streak_60', 'streak_100', 'streak_200', 'streak_365'],
};

function familyFor(field) {
    return FAMILY[field] || [];
}

module.exports = {
    grantBadgeIfEarned: grantBadgeIfEarned,
    grantFamily: grantFamily,
    familyFor: familyFor,
    offsetDateKey: offsetDateKey,
    BADGE_DAILY_CAP: BADGE_DAILY_CAP,
};
