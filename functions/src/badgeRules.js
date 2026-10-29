'use strict';

// One badge rule table. Display rows live in badges.catalog.json (generated).
// Whether a badge pays, and which server field proves it, is decided here.
// A badge with a server source is granted by awardBadge, including one Favor
// point. Cosmetic means there is no server proof: no badge_awards row, no Favor.

const catalog = require('./badges.catalog.json');
const badgeXp = require('./badgeXpTable');

const XP_CAP = 5000;
const SF_MIN_XP = 50;

// Amounts live in badge-xp.json (the proposed sheet). This object is unused.
const XP_OVERRIDE = {
    satoshis_cipher: 5000,
    satoshis_covenant: 4000,
    the_hodler: 3000,
    block_250: 2500,
    satoshis_ghost: 2100,
    genesis_block: 1500,
    the_archive: 1500,
    donor_100: 10,
    donor_500: 50,
    donor_1000: 100,
    donor_5000: 500,
    donor_10000: 1000,
    donor_25000: 2500,
    donor_50000: 5000,
    donor_100000: 5000,
    referral_1: 50,
    referral_5: 100,
    referral_10: 200,
    referral_25: 500,
    referral_50: 1000,
    referral_100: 2500,
    daily_triple_1: 25,
    daily_triple_7: 100,
    daily_triple_30: 500,
    daily_triple_90: 1500,
    daily_triple_365: 5000,
    market_listed_1: 30,
    market_listed_5: 75,
    market_listed_10: 150,
    market_message: 20,
    market_sold_1: 50,
    market_sold_5: 200,
    peer_1: 25,
    peer_3: 75,
    peer_10: 250,
    peer_25: 750,
    say_hi_1: 15,
    say_hi_7: 75,
    say_hi_30: 250,
    say_hi_100: 750,
    daily_five_1: 50,
    daily_five_7: 150,
    daily_five_30: 500,
    daily_five_100: 1500,
    daily_five_streak_7: 300,
    poll_days_7: 50,
    poll_days_30: 250,
    poll_days_100: 1000,
    quest_days_7: 50,
    quest_days_30: 250,
    quest_days_100: 1000,
    sf_trifecta_10: 100,
    sf_trifecta_50: 300,
    sf_trifecta_100: 750,
    cipher_1: 15,
    cipher_10: 100,
    cipher_50: 400,
    cipher_200: 1500,
    gift_sent_1: 25,
    gift_sent_10: 150,
    gift_sent_50: 600,
    tctv_daily_1: 25,
    tctv_daily_7: 100,
    tctv_daily_30: 300,
    tctv_daily_100: 1000,
    reply_bonus_1: 15,
    reply_bonus_25: 75,
    reply_bonus_100: 250,
    reply_bonus_500: 750,
    plebtalk_1: 15,
    plebtalk_10: 100,
    plebtalk_50: 400,
    onboarding_complete: 100,
    push_enabled: 25,
    profile_complete: 25,
    jack_of_all: 1000,
};

const NAME_OVERRIDE = {
    daily_triple_30: 'Trifecta Engine',
    first_post: 'PlebTalk Voice',
    market_seller: 'Shopkeeper',
    market_listed_5: 'Merchant',
};

const SETS = {
    set_daily_five: ['daily_five_1', 'daily_five_7', 'tctv_daily_1', 'say_hi_1', 'daily_triple_7'],
    set_voice: ['say_hi_7', 'reply_bonus_25', 'chat_100', 'forum_reply_10', 'topic_comment_1', 'topic_channels_10'],
    set_tv: ['tctv_daily_1', 'tctv_daily_7', 'tctv_daily_30', 'tctv_satellite'],
    set_trader: ['market_listed_1', 'market_listed_5', 'market_message', 'market_sold_1', 'first_purchase'],
    set_codebreaker: ['cipher_1', 'cipher_10', 'cipher_50', 'cipher_peer_key_1', 'cipher_full_ring', 'cipher_sats_1'],
    set_generous: ['gift_sent_1', 'gift_sent_10', 'tip_first', 'donor_1000', 'gift_open_1', 'gift_sent_200', 'key_peers_5'],
    set_network: ['peer_1', 'peer_3', 'peer_10', 'referral_1', 'referral_10', 'key_peers_5', 'key_peers_21', 'peer_level_2', 'peer_level_3', 'peer_level_5', 'peer_hub_5'],
    set_gladiator: ['pvp_first', 'pvp_25', 'pvp_win_streak_5', 'pvp_played_50'],
    set_scholar_daily: ['trivia_correct_30', 'quest_days_30', 'poll_days_30'],
    set_newcomer: ['onboarding_complete', 'push_enabled', 'profile_complete', 'first_channel'],
    set_favor: ['sf_trifecta_10', 'sf_contributor_10', 'sf_block_solver', 'faction_chosen'],
    set_oracle: ['predict_top_week', 'predict_top_week_5', 'predict_top_month'],
    set_sovereign: ['totp_enabled', 'lightning_address_set', 'faction_chosen'],
    set_raffle: ['raffle_entered', 'raffle_10', 'raffle_50', 'raffle_250', 'raffle_1000', 'raffle_winner'],
    set_explorer_complete: ['first_channel', 'explorer_5', 'explorer_10', 'explorer_25', 'explorer_50', 'explorer_100', 'explorer_all'],
    set_streak_complete: ['streak_3', 'streak_7', 'streak_14', 'streak_30', 'streak_60', 'streak_100', 'streak_200', 'streak_365'],
    set_trifecta_complete: ['daily_triple_1', 'daily_triple_7', 'daily_triple_30', 'daily_triple_90', 'daily_triple_365'],
    set_social_complete: ['chat_first', 'chat_10', 'chat_50', 'chat_100', 'chat_200', 'dm_first', 'dm_10', 'peer_1'],
    set_pvp_complete: ['pvp_first', 'pvp_5', 'pvp_25', 'pvp_50', 'pvp_100'],
    set_builder_complete: ['producer_1', 'producer_10', 'forum_first', 'forum_10', 'market_listed_1'],
};

const MILESTONES = {
    hall_of_fame: 50,
    the_archive: 100,
    genesis_block: 150,
    satoshis_ghost: 200,
    block_250: 250,
    the_hodler: 300,
    satoshis_covenant: 350,
    satoshis_cipher: 400,
};

const ORANGE_CHANNELS = ['whitepaper', 'decentralized', 'scarce', 'secure', 'money', 'peaceful', 'dominant', 'organic', 'supranational', 'programmable', 'use-cases'];
const PURPLE_CHANNELS = ['maximalism', 'problems-of-money', 'self-custody', 'privacy-nonkyc', 'nodes', 'mining', 'pow-vs-pos', 'energy', 'difficulty-adjustment', 'layer-2-lightning', 'fedi-ark', 'chaumian-mints', 'ctv-covenants', 'extension-blocks', 'op-codes', 'bitvm', 'layer-3-sidechains', 'stablecoins', 'smart-contracts', 'blockchain-timechain', 'regulation', 'cryptography', 'core-source-code', 'developers', 'investment-strategy', 'evidence-against-alts', 'consensus'];
const BLUE_CHANNELS = ['one-stop-shop', 'faq-glossary', 'nostr', 'misconceptions-fud', 'books', 'videos', 'podcasts', 'articles-threads', 'informational-sites', 'curriculum', 'research-theses', 'games', 'music', 'movies-tv', 'hardware', 'poems-stories', 'apps-tools', 'projects-diy', 'art-inspiration', 'graphics', 'charts', 'swag-merch', 'jobs-earn', 'social-media', 'fun-facts', 'news-adoption', 'history', 'international', 'satoshi-nakamoto', 'giga-chad', 'health', 'web5', 'memes-funny'];

const COSMETIC_PREFIXES = [
    'lb_lurker_', 'chat_lurker_', 'fun_', 'chat_streak_', 'pvp_win_streak_',
    'trail_', 'story_', 'nacho_', 'dj_', 'react_', 'irl_', 'pow_',
    'cert_', 'beats_', 'tctv_tuned', 'tctv_couch', 'tctv_binge', 'tctv_channel',
    'tctv_remote', 'tctv_dial', 'tctv_signal', 'tctv_antenna', 'tctv_timechain',
];

const COSMETIC_EXACT = new Set([
    'ghost_mode', 'night_owl', 'early_bird', 'insomniac', 'weekend_warrior', 'early_adopter',
    'market_browse', 'market_saved_5', 'bookworm', 'bookmark_collector', 'bookmarks_1', 'bookmarks_10',
    'favs_10', 'favs_25', 'collector', 'speed_runner', 'marathon', 'triple_threat',
    'pvp_streak', 'nacho_closet_full', 'whitepaper_pilgrim',
    'contrarian', 'block_42', 'rabbit_hole', 'the_plebeian', 'dust_collector',
    'search_sleuth',
    'sf_lucky_1', 'sf_lucky_5', 'sf_lucky_10', 'sf_lucky_50', 'sf_lucky_100', 'sf_lucky_1000',
    'sf_unlucky_1', 'sf_unlucky_5', 'sf_unlucky_10', 'sf_unlucky_50', 'sf_unlucky_100', 'sf_unlucky_1000',
    'sf_low_hash', 'sf_ultra_low', 'combo_trio', 'combo_mega', 'combo_legend', 'weekly_hero',
    'set_fun_complete', 'set_beats_complete', 'set_daily_complete', 'set_irl_complete',
    'set_lightning_complete', 'set_pow_complete', 'set_profile_complete', 'set_spin_complete',
    'set_tctv_complete', 'set_trails_complete', 'set_scholar_complete', 'set_miner_complete',
    'daily_1', 'daily_5', 'daily_10', 'daily_25', 'daily_50', 'daily_100',
    'tctv_satellite', 'tctv_couch_king',
]);

// These stay in the catalog with real XP, but nothing in this deploy writes the
// counter. Claims fail closed. Documented in BADGE_VERIFICATION.md.
// plebtalk has no session writer. reply_bonus waits on its own credit path.
const WAITING_COUNTERS = {
    reply_bonus_1: counter('replyBonusCount', 1),
    reply_bonus_25: counter('replyBonusCount', 25),
    reply_bonus_100: counter('replyBonusCount', 100),
    reply_bonus_500: counter('replyBonusCount', 500),
    plebtalk_1: counter('plebTalkSessions', 1),
    plebtalk_10: counter('plebTalkSessions', 10),
    plebtalk_50: counter('plebTalkSessions', 50),
};

// Registered before the generic peer_, cipher_, and predict_ prefixes.
const NEW_SOURCES = {
    gift_open_1: counter('giftsOpened', 1),
    gift_open_25: counter('giftsOpened', 25),
    gift_open_100: counter('giftsOpened', 100),
    gift_open_500: counter('giftsOpened', 500),
    gift_open_1500: counter('giftsOpened', 1500),
    gift_lucky_shoutout: { type: 'truthy', field: 'giftShoutoutWon' },
    gift_sent_1: counter('giftsSent', 1),
    gift_sent_10: counter('giftsSent', 10),
    gift_sent_50: counter('giftsSent', 50),
    gift_sent_200: counter('giftsSent', 200),
    key_peers_5: counter('keyPeersDistinct', 5),
    key_peers_21: counter('keyPeersDistinct', 21),
    cipher_peer_key_1: counter('peerKeyCiphers', 1),
    cipher_peer_key_25: counter('peerKeyCiphers', 25),
    cipher_peer_key_100: counter('peerKeyCiphers', 100),
    cipher_full_ring: { type: 'truthy', field: 'cipherFullRing' },
    cipher_sats_1: counter('cipherSatsPaid', 1),
    cipher_sats_5: counter('cipherSatsPaid', 5),
    cipher_sats_10k: counter('cipherBiggestWin', 10000),
    peer_level_2: counter('peerBestLevel', 2),
    peer_level_3: counter('peerBestLevel', 3),
    peer_level_4: counter('peerBestLevel', 4),
    peer_level_5: counter('peerBestLevel', 5),
    peer_level_6: counter('peerBestLevel', 6),
    peer_hub_5: counter('peersAtL3', 5),
    topic_comment_1: counter('topicComments', 1),
    topic_comment_10: counter('topicComments', 10),
    topic_comment_50: counter('topicComments', 50),
    topic_comment_250: counter('topicComments', 250),
    topic_channels_10: { type: 'arrayLength', field: 'topicChannelsCommented', gte: 10 },
    first_purchase: counter('shopPurchases', 1),
    shop_10: counter('shopPurchases', 10),
    shop_50: counter('shopPurchases', 50),
    raffle_entered: counter('raffleTicketsBought', 1),
    raffle_10: counter('raffleTicketsBought', 10),
    raffle_50: counter('raffleTicketsBought', 50),
    raffle_250: counter('raffleTicketsBought', 250),
    raffle_1000: counter('raffleTicketsBought', 1000),
    raffle_winner: counter('raffleWins', 1),
    predict_top_week: counter('predTopWeeks', 1),
    predict_top_week_5: counter('predTopWeeks', 5),
    predict_top_month: counter('predTopMonths', 1),
    totp_enabled: { type: 'truthy', field: 'totpEnabled' },
    faction_chosen: { type: 'text', field: 'faction', min: 1 },
    onboarding_complete: { type: 'truthy', field: 'onboardingComplete' },
    push_enabled: { type: 'truthy', field: 'pushEnabled' },
    quest_days_7: counter('questDays', 7),
    quest_days_30: counter('questDays', 30),
    quest_days_100: counter('questDays', 100),
    tctv_daily_1: counter('tctvWatchDays', 1),
    tctv_daily_7: counter('tctvWatchDays', 7),
    tctv_daily_30: counter('tctvWatchDays', 30),
    tctv_daily_100: counter('tctvWatchDays', 100),
};

function counter(field, gte) {
    const n = Number(gte);
    if (!Number.isFinite(n) || n <= 0) return null;
    return { type: 'counter', field: field, gte: n };
}

function isCosmeticId(id) {
    if (COSMETIC_EXACT.has(id)) return true;
    for (let i = 0; i < COSMETIC_PREFIXES.length; i++) {
        if (id.indexOf(COSMETIC_PREFIXES[i]) === 0) return true;
    }
    // Old Timechain TV minute badges are device-local. The new tctv_daily_* family is not.
    if (id.indexOf('tctv_') === 0 && id.indexOf('tctv_daily_') !== 0) return true;
    return false;
}

function numFromId(id) {
    const m = String(id).match(/(\d+)_?$/);
    if (!m) return null;
    const n = Number(m[1]);
    if (id.indexOf('_1k') !== -1) return 1000;
    if (id.indexOf('_5k') !== -1) return 5000;
    if (id.indexOf('_10k') !== -1) return 10000;
    if (id.indexOf('_21k') !== -1) return 21000;
    return n;
}

const FLEX_SUM = { flex_rookie: 10, flex_committed: 50, flex_athlete: 200, flex_legend: 1000 };
const FLEX_ALL_IDS = [
    'steak', 'sunlight', 'dca', 'custody', 'lift', 'meetup', 'lightning', 'read',
    'sleep', 'nokyc', 'node', 'cold', 'fast', 'walk', 'journal', 'meditate', 'teach',
    'water', 'gratitude', 'verify', 'focus', 'risk', 'pattern', 'findq', 'noleverage',
    'gunrange', 'sellchairs', 'starebtc', 'itoldyou', 'pumpndump',
];
const LQ_IDS = [
    'lq_what_is_bitcoin', 'lq_mining', 'lq_nodes', 'lq_self_custody', 'lq_lightning',
    'lq_scarcity', 'lq_bitcoin_only', 'lq_privacy',
];

function flexSource(id) {
    if (FLEX_SUM[id]) return { type: 'flexSum', gte: FLEX_SUM[id] };
    if (id === 'flex_all_once') return { type: 'flexAll', ids: FLEX_ALL_IDS };
    const allDays = /^flex_all_(\d+)$/.exec(id);
    if (allDays) return counter('flexAllDays', Number(allDays[1]));
    const one = /^flex_([a-z0-9]+)_(\d+)$/.exec(id);
    if (!one || FLEX_ALL_IDS.indexOf(one[1]) === -1) return null;
    return { type: 'flex', action: one[1], gte: Number(one[2]) };
}

function spinSource(id) {
    if (id === 'spin_jackpot') return { type: 'truthy', field: 'spinHitRare' };
    const streak = /^spin_streak_(\d+)$/.exec(id);
    if (streak) return counter('spinStreak', Number(streak[1]));
    const closet = /^spin_closet_(\d+)$/.exec(id);
    if (closet) return counter('spinClosetAwards', Number(closet[1]));
    const days = /^spin_(\d+)$/.exec(id);
    if (days) return counter('spinDays', Number(days[1]));
    return null;
}

function raidSource(id) {
    if (id === 'raid_winner') return counter('raidWins', 1);
    if (id === 'raid_warlord') return counter('raidDamageAllTime', 100);
    const slayer = /^raid_boss_slayer(?:_(\d+))?$/.exec(id);
    if (slayer) return counter('raidBossesDefeated', slayer[1] ? Number(slayer[1]) : 1);
    if (id === 'raid_first') return counter('raidDamageAllTime', 1);
    const dmg = /^raid_(\d+)$/.exec(id);
    if (dmg) return counter('raidDamageAllTime', Number(dmg[1]));
    return null;
}

function tipSource(id) {
    if (id === 'tip_first') return counter('tipsVerified', 1);
    if (id === 'tip_10') return counter('tipsVerified', 10);
    if (id === 'tip_whale') return counter('tipsSentSats', 1000);
    if (id === 'tip_sats_10k') return counter('tipsSentSats', 10000);
    if (id === 'tip_received_1') return counter('tipsReceived', 1);
    if (id === 'tip_received_50') return counter('tipsReceived', 50);
    if (id === 'tip_magnet') return counter('tipsReceived', 10);
    return null;
}

function questSource(id) {
    if (id === 'quest_legend') return counter('questsPassed', 100);
    const m = /^quest_(\d+)$/.exec(id);
    if (!m) return null;
    return counter('questsPassed', Number(m[1]));
}

function triviaSource(id) {
    if (id === 'trivia_first') return counter('triviaCorrect', 1);
    if (id === 'trivia_titan') return counter('triviaCorrect', 1000);
    const streak = /^trivia_streak_(\d+)$/.exec(id);
    if (streak) return counter('triviaStreak', Number(streak[1]));
    const correct = /^trivia_correct_(\d+)$/.exec(id);
    if (correct) return counter('triviaCorrect', Number(correct[1]));
    return null;
}

function lqSource(id) {
    if (id === 'lq_graduate') return { type: 'includes', field: 'lqPassed', ids: LQ_IDS };
    if (LQ_IDS.indexOf(id) === -1) return null;
    return { type: 'includes', field: 'lqPassed', ids: [id] };
}

function sourceFor(id) {
    if (NEW_SOURCES[id]) return NEW_SOURCES[id];
    if (WAITING_COUNTERS[id]) return WAITING_COUNTERS[id];
    if (MILESTONES[id]) return { type: 'awards', gte: MILESTONES[id] };
    if (id === 'jack_of_all') return { type: 'awards', gte: 25 };
    if (SETS[id]) return { type: 'set', members: SETS[id] };
    if (id.indexOf('set_') === 0 && id.lastIndexOf('_complete') === id.length - 9) {
        return SETS[id] ? { type: 'set', members: SETS[id] } : null;
    }
    if (id === 'first_channel') return counter('channelsVisited', 1);
    if (id === 'explorer_all') return counter('channelsVisited', catalog.channelCount || 146);
    if (id.indexOf('explorer_') === 0) return counter('channelsVisited', numFromId(id));
    if (id === 'foundation_builder') return { type: 'includes', field: 'visitedChannelsList', ids: ORANGE_CHANNELS };
    if (id === 'experienced_pro') return { type: 'includes', field: 'visitedChannelsList', ids: PURPLE_CHANNELS };
    if (id === 'librarian') return { type: 'includes', field: 'visitedChannelsList', ids: BLUE_CHANNELS };
    if (id.indexOf('streak_') === 0 && id !== 'streak_freeze') return counter('bestStreak', numFromId(id));
    if (id === 'sats_first') return counter('satsWithdrawn', 1);
    if (id === 'sats_maxed') return counter('satsWithdrawn', 15000);
    if (id.indexOf('sats_') === 0) return counter('satsWithdrawn', numFromId(id));
    if (id.indexOf('donor_') === 0) return counter('pointsDonated', numFromId(id));
    if (id === 'silent_donor') return { type: 'silentDonor' };
    if (id.indexOf('market_listed_') === 0) return counter('marketListings', numFromId(id));
    if (id === 'market_message') return counter('marketMessages', 1);
    if (id.indexOf('market_sold_') === 0) return counter('marketSold', numFromId(id));
    if (id.indexOf('peer_') === 0) return counter('peerCount', numFromId(id));
    if (id.indexOf('referral_') === 0) {
        const referralTier = require('../referral-tiers').badgeById(id);
        if (!referralTier) return null;
        return counter('referralMaxiCount', referralTier.min);
    }
    if (id === 'referred') return { type: 'truthy', field: 'referredBy' };
    if (id.indexOf('daily_triple_') === 0) return counter('trifectaDays', numFromId(id));
    if (id.indexOf('sf_trifecta_') === 0) return counter('trifectaDays', numFromId(id));
    if (id === 'daily_five_streak_7') return counter('dailyFiveStreak', 7);
    if (id.indexOf('daily_five_') === 0) return counter('dailyFiveDays', numFromId(id));
    if (id.indexOf('say_hi_') === 0) return counter('sayHiDays', numFromId(id));
    if (id === 'poll_first') return counter('pollDays', 1);
    if (id.indexOf('poll_days_') === 0) return counter('pollDays', numFromId(id));
    if (id.indexOf('poll_') === 0) return counter('pollDays', numFromId(id));
    if (id === 'chat_first') return counter('chatCount', 1);
    if (id.indexOf('chat_') === 0) return counter('chatCount', numFromId(id));
    if (id === 'dm_first' || id === 'dm_buddy') return counter('dmCount', id === 'dm_buddy' ? 5 : 1);
    if (id.indexOf('dm_') === 0) return counter('dmCount', numFromId(id));
    if (id === 'forum_first') return counter('forumPosts', 1);
    if (id === 'forum_reply_1') return counter('forumReplies', 1);
    if (id.indexOf('forum_reply_') === 0) return counter('forumReplies', numFromId(id));
    if (id.indexOf('forum_') === 0) return counter('forumPosts', numFromId(id));
    if (id.indexOf('producer_') === 0) return counter('beatsUploads', numFromId(id));
    if (id === 'article_1') return counter('articlesPublished', 1);
    if (id.indexOf('article_') === 0) return counter('articlesPublished', numFromId(id));
    if (id === 'pvp_first') return counter('pvpWins', 1);
    if (id.indexOf('pvp_played_') === 0) return counter('pvpPlayed', numFromId(id));
    if (id.indexOf('pvp_') === 0) return counter('pvpWins', numFromId(id));
    if (id.indexOf('cipher_') === 0) return counter('ciphersSolved', numFromId(id));
    if (id === 'sf_first_hash') return counter('sfHashes', 1);
    if (id === 'sf_100000_hashes') return counter('sfHashes', 100000);
    if (id.indexOf('sf_') === 0 && id.indexOf('_hashes') !== -1) return counter('sfHashes', numFromId(id.replace('_hashes', '')));
    if (id === 'sf_contributor') return counter('sfContributions', 1);
    if (id === 'sf_contributor_10') return counter('sfContributions', 10);
    if (id === 'sf_block_solver') return { type: 'truthy', field: 'sfBlockSolver' };
    if (id === 'predict_1') return counter('predTotal', 1);
    if (id.indexOf('predict_correct_') === 0) return counter('predCorrect', numFromId(id));
    if (id.indexOf('predict_streak_') === 0) return counter('predBestStreak', numFromId(id));
    if (id === 'predict_accuracy_70') return { type: 'accuracy', field: 'predAccuracy', gte: 70, minTotal: 10 };
    if (id.indexOf('predict_') === 0) return counter('predTotal', numFromId(id));
    if (id === 'first_save') return { type: 'signed-in' };
    if (id === 'profile_complete') return { type: 'profile' };
    if (id === 'bio_author') return { type: 'text', field: 'bio', min: 1 };
    if (id === 'lightning_address_set' || id === 'lightning_setup') return { type: 'text', field: 'lightningAddress', min: 3 };
    if (id === 'global_citizen') return { type: 'text', field: 'country', min: 2 };
    if (id === 'first_peer') return counter('peerCount', 1);
    if (id === 'genesis') return { type: 'includes', field: 'visitedChannelsList', ids: ['whitepaper'] };
    if (id === 'first_post') return counter('forumPosts', 1);
    if (id === 'first_reply') return counter('forumReplies', 1);
    if (id === 'market_seller') return counter('marketListings', 1);
    if (id === 'market_buyer') return counter('marketMessages', 1);
    if (id === 'ticket_bronze') return counter('orangeTickets', 25);
    if (id === 'ticket_silver') return counter('orangeTickets', 50);
    if (id === 'ticket_gold') return counter('orangeTickets', 100);
    if (id === 'scholar') return { type: 'scholarExam', examType: 'properties' };
    if (id === 'hash_obsessed') return counter('sfHashes', 25000);
    if (id === 'streak_freeze') return counter('streakFreezesUsed', 1);
    if (id === 'ghost_reader') return { type: 'ghostReader' };
    const flex = flexSource(id);
    if (flex) return flex;
    const spin = spinSource(id);
    if (spin) return spin;
    const raid = raidSource(id);
    if (raid) return raid;
    const tip = tipSource(id);
    if (tip) return tip;
    const quest = questSource(id);
    if (quest) return quest;
    const trivia = triviaSource(id);
    if (trivia) return trivia;
    const lq = lqSource(id);
    if (lq) return lq;
    return null;
}

function fairXp(id, raw, cosmetic) {
    if (cosmetic) return 0;
    if (badgeXp.has(id)) return badgeXp.xpOf(id);
    const n = Number(raw) || 0;
    if (n > XP_CAP) return XP_CAP;
    return n;
}

function tallyFlexClaims(ids) {
    const byAction = {};
    let sum = 0;
    (ids || []).forEach(function (id) {
        const match = /^(\d{4}-\d{2}-\d{2})_flex_([a-z0-9]+)$/.exec(String(id || ''));
        if (!match || FLEX_ALL_IDS.indexOf(match[2]) === -1) return;
        byAction[match[2]] = (byAction[match[2]] || 0) + 1;
        sum += 1;
    });
    return { byAction: byAction, sum: sum };
}

function ruleFor(id) {
    if (!id || !catalog.badges[id]) return null;
    const row = catalog.badges[id];
    const cosmetic = isCosmeticId(id);
    const source = cosmetic ? { type: 'cosmetic' } : sourceFor(id);
    const pays = !cosmetic && !!source;
    const referralTier = require('../referral-tiers').badgeById(id);
    const xp = referralTier ? referralTier.xp : (pays ? fairXp(id, row.xp, false) : 0);
    return {
        id: id,
        name: referralTier ? referralTier.name : (NAME_OVERRIDE[id] || row.name || id),
        emoji: referralTier ? referralTier.emoji : (row.emoji || '🏅'),
        desc: row.desc || '',
        category: row.category || '',
        hidden: row.hidden === true,
        xp: xp,
        tickets: referralTier ? referralTier.tickets : 0,
        displayXp: badgeXp.has(id) ? badgeXp.xpOf(id) : (Number(row.displayXp != null ? row.displayXp : row.xp) || 0),
        cosmetic: !pays,
        source: source,
        sf: pays && xp >= SF_MIN_XP,
    };
}

function isKnown(id) {
    return !!(id && catalog.badges[id]);
}

function xpOf(id) {
    const rule = ruleFor(id);
    return rule ? rule.xp : null;
}

function isCosmetic(id) {
    const rule = ruleFor(id);
    return !rule || rule.cosmetic;
}

function sfEligible(id) {
    const rule = ruleFor(id);
    return !!(rule && rule.sf);
}

function countPaying(ids) {
    let n = 0;
    ids.forEach(function (id) {
        const rule = ruleFor(id);
        if (rule && !rule.cosmetic && rule.xp > 0) n += 1;
    });
    return n;
}

function meets(rule, user, ctx) {
    if (!rule || rule.cosmetic || !rule.source) return false;
    const src = rule.source;
    const data = user || {};
    const bag = ctx || {};
    if (src.type === 'counter') {
        let value = Number(data[src.field] || 0);
        if (src.field === 'channelsVisited' && Array.isArray(data.visitedChannelsList)) {
            value = Math.max(value, data.visitedChannelsList.length);
        }
        if (src.field === 'predTotal') value = Math.max(value, Number(data.predTotal || 0));
        if (src.field === 'peerCount') {
            const listed = Array.isArray(data.peers) ? data.peers.length : 0;
            value = Math.max(value, listed);
        }
        return value >= src.gte;
    }
    if (src.type === 'arrayLength') {
        const list = Array.isArray(data[src.field]) ? data[src.field] : [];
        return list.length >= src.gte;
    }
    if (src.type === 'flex' || src.type === 'flexSum' || src.type === 'flexAll') {
        const claims = bag.flexClaims || { byAction: {}, sum: 0 };
        if (src.type === 'flex') return (Number(claims.byAction[src.action]) || 0) >= src.gte;
        if (src.type === 'flexSum') {
            const sum = claims.sum != null ? Number(claims.sum) : Object.keys(claims.byAction || {}).reduce(function (n, key) {
                return n + (Number(claims.byAction[key]) || 0);
            }, 0);
            return sum >= src.gte;
        }
        return src.ids.every(function (action) { return (Number(claims.byAction[action]) || 0) >= 1; });
    }
    if (src.type === 'truthy') return typeof data[src.field] === 'string' ? data[src.field].length > 0 : !!data[src.field];
    if (src.type === 'either') {
        return src.fields.some(function (field) {
            const value = data[field];
            return typeof value === 'string' ? value.length > 0 : !!value;
        });
    }
    if (src.type === 'scholarExam') {
        if (bag.scholarExamsPassed && typeof bag.scholarExamsPassed === 'object') {
            return bag.scholarExamsPassed[src.examType] === true;
        }
        return bag.scholarExamPassed === true;
    }
    if (src.type === 'text') return typeof data[src.field] === 'string' && data[src.field].trim().length >= src.min;
    if (src.type === 'includes') {
        const list = Array.isArray(data[src.field]) ? data[src.field] : [];
        return src.ids.every(function (channel) { return list.indexOf(channel) !== -1; });
    }
    if (src.type === 'awards') return (bag.payingCount || 0) >= src.gte;
    if (src.type === 'set') {
        const held = bag.awardSet;
        if (!held) return false;
        return src.members.every(function (member) {
            const memberRule = ruleFor(member);
            if (!memberRule || memberRule.cosmetic) return true;
            return held.has(member);
        }) && src.members.some(function (member) {
            const memberRule = ruleFor(member);
            return memberRule && !memberRule.cosmetic;
        });
    }
    if (src.type === 'accuracy') {
        return Number(data.predTotal || 0) >= src.minTotal && Number(data[src.field] || 0) >= src.gte;
    }
    if (src.type === 'ghostReader') {
        return Number(data.streak || 0) >= 7 && Number(data.points || 0) === 0;
    }
    if (src.type === 'silentDonor') {
        return Number(data.pointsDonated || 0) >= 500 && Number(data.referralCount || 0) === 0;
    }
    if (src.type === 'profile') {
        return typeof data.username === 'string' && data.username.length >= 3
            && typeof data.bio === 'string' && data.bio.trim().length > 0
            && typeof data.country === 'string' && data.country.length >= 2;
    }
    if (src.type === 'signed-in') return bag.signedIn === true;
    return false;
}

function xpMap() {
    const map = {};
    Object.keys(catalog.badges).forEach(function (id) {
        map[id] = xpOf(id);
    });
    return map;
}

function verifiedIds() {
    return Object.keys(catalog.badges).filter(function (id) {
        const rule = ruleFor(id);
        return rule && !rule.cosmetic;
    });
}

function allIds() {
    return Object.keys(catalog.badges);
}

module.exports = {
    XP_CAP: XP_CAP,
    SF_MIN_XP: SF_MIN_XP,
    SETS: SETS,
    catalog: catalog,
    ruleFor: ruleFor,
    isKnown: isKnown,
    xpOf: xpOf,
    isCosmetic: isCosmetic,
    sfEligible: sfEligible,
    countPaying: countPaying,
    meets: meets,
    tallyFlexClaims: tallyFlexClaims,
    xpMap: xpMap,
    verifiedIds: verifiedIds,
    allIds: allIds,
    isCosmeticId: isCosmeticId,
};
