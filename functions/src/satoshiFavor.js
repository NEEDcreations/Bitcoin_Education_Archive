/**
 * satoshiFavor – Satoshi's Favor Cloud Functions
 * Community-driven mining game for Bitcoin Education Archive.
 *
 * DO NOT call admin.initializeApp() here — it's called in index.js.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

const db = admin.firestore();

// One-way hash of uid for public dedup (prevents uid exposure in readable docs)
function uidHash(uid) {
  return crypto.createHash('sha256').update('sf_dedup_' + uid).digest('hex').substring(0, 16);
}

// Difficulty history (ordered oldest first):
// Each entry: { target, since: ISO-date string (UTC midnight) }
const DIFFICULTY_HISTORY = [
  { target: 1000,  since: '2026-06-02' },
  { target: 30000, since: '2026-06-21' },
  { target: 15000, since: '2026-06-30' },
  { target: 10000, since: '2026-07-02' },
  { target: 8000,  since: '2026-07-10' }, // +25% raise — tightening odds to 1:12,500
  { target: 7000,  since: '2026-07-29' }, // -12.5% drop — easing odds to 1:14,286
  { target: 10000, since: '2026-08-20' }, // -30% decrease — easing odds to 1:10,000
];
const DIFFICULTY_TARGET = DIFFICULTY_HISTORY[DIFFICULTY_HISTORY.length - 1].target;

// Return the difficulty target that was active at a given timestamp (ms)
function difficultyAtTime(tsMs) {
  const active = DIFFICULTY_HISTORY.filter(h => new Date(h.since).getTime() <= tsMs);
  return active.length ? active[active.length - 1].target : DIFFICULTY_HISTORY[0].target;
}
const HASHES_PER_MINUTE = 10;
const HASH_WINDOW_MS = 60000; // 60 seconds
const FAVOR_DURATION_MINUTES = 60;
const BONUS_MINUTES_PER_POINT = 3;
const POINTS_TO_ACTIVATE = 21;

// Point values by source
// Server-side badge catalog — must mirror badges.js BADGE_DEFS ids
const VALID_BADGE_IDS = new Set([
  'all_certs','archive_builder_t','arena_champion_t','article_1','article_10','article_5',
  'asic_mode_t','audiophile_t','beats_100_plays','beats_200_plays','beats_500_plays',
  'beats_50_plays','beats_comment_1','beats_first_listen','beats_liked_10','beats_liked_50',
  'beats_maestro_t','bio_author','bitcoin_cal_hero_t','block_250','block_solver',
  'bookmarks_1','bookmarks_10','bookworm','century_spinner_t','cert_double','cert_scholar',
  'cert_tech','challenge_master_t','chancellor','chat_10','chat_100','chat_1000','chat_200',
  'chat_25','chat_50','chat_500','chat_first','chat_immortal_t','chat_legend',
  'chat_lurker_10','chat_lurker_100','chat_lurker_5','chat_lurker_50','chat_lurker_500',
  'chat_streak_3','chat_streak_30','chat_streak_7','combo_legend','combo_mega','combo_trio',
  'community_darling','community_hero_t','community_pillar_t','daily_1','daily_10',
  'daily_100','daily_25','daily_5','daily_50','daily_triple_1','daily_triple_30',
  'daily_triple_365','daily_triple_7','daily_triple_90','democracy_maxi',
  'diamond_hands_100_t','diamond_hands_set_t','dj_25','dj_5','dj_50','dj_first',
  'dj_legend_t','dj_listener','dj_listener_100','dj_listener_50','dj_songs_10',
  'dj_songs_100','dj_songs_50','dm_10','dm_100','dm_25','dm_buddy','dm_first',
  'double_scholar','dragon_slayer','early_bird','experienced_pro','explorer_10',
  'explorer_100','explorer_25','explorer_5','explorer_50','explorer_all','favor_champion_t',
  'favs_10','favs_25','first_channel','first_purchase','first_save','flex_all_once',
  'flex_athlete','flex_committed','flex_legend','flex_legend_t','flex_rookie','forum_10',
  'forum_100','forum_25','forum_5','forum_50','forum_first','forum_legend_t','forum_reply_1',
  'forum_reply_10','foundation_builder','full_stack_human_t','fun_bitcoin_birthday',
  'fun_friday','fun_halving_day','fun_midnight','fun_new_year','fun_pi_day','fun_weekend',
  'fun_whitepaper_day','genesis_block','ghost_mode','global_citizen','golden_nonce_t',
  'grand_scholar','hall_of_fame','hall_of_fame_t','hash_god','hash_lord','hodler_supreme',
  'irl_attend_1','irl_attend_5','irl_host','irl_host_10','irl_host_5','irl_set_t',
  'jack_of_all','jack_of_all_t','lb_lurker_10','lb_lurker_100','lb_lurker_5','lb_lurker_50',
  'lb_lurker_500','legend_mode_t','librarian','lightning_address_set','lightning_lord_t',
  'lightning_setup','lq_bitcoin_only','lq_graduate','lq_lightning','lq_mining','lq_nodes',
  'lq_privacy','lq_scarcity','lq_self_custody','lq_what_is_bitcoin','market_browse',
  'market_listed_1','market_listed_10','market_listed_5','market_message','market_saved_5',
  'master_miner_t','nacho_asked_10','nacho_asked_100','nacho_bestie','nacho_chatterbox',
  'nacho_dressed','nacho_eli5','nacho_quester','nacho_whisper','nachos_bestie_t',
  'nachos_confidant','night_owl','nostradamus_t','poll_10','poll_100','poll_50','poll_first',
  'pow_first_step','pow_marathoner','pow_streak_3','pow_streak_7','pow_streak_30',
  'pow_km_10','pow_km_50','pow_km_100','pow_km_500','pow_km_1000','pow_km_5000',
  'pow_set_t','pow_titan_t','precision_forecaster_t','predict_1','predict_10','predict_50',
  'predict_accuracy_70','predict_correct_100','predict_correct_25','predict_correct_5',
  'predict_correct_50','predict_streak_10','predict_streak_3','producer_1','producer_10',
  'profile_curious','profile_explorer_10','profile_explorer_100','profile_explorer_25',
  'profile_explorer_5','profile_explorer_50','proof_of_pain','pvp_100','pvp_25','pvp_5',
  'pvp_50','pvp_first','pvp_legend','pvp_played_1','pvp_played_10','pvp_played_50',
  'pvp_win_streak_3','pvp_win_streak_5','quest_1','quest_10','quest_100','quest_25',
  'quest_3','quest_5','quest_50','quest_legend','raid_10','raid_100','raid_25','raid_5',
  'raid_50','raid_boss_slayer','raid_boss_slayer_10','raid_boss_slayer_5','raid_first',
  'raid_warlord','raid_winner','react_10','react_100','react_200','react_5','react_50',
  'react_500','reaction_god_t','referral_1','referral_10','referral_100','referral_25',
  'referral_5','referral_50','referred','regional_leader','sat_hoarder_t','sat_slinger',
  'satoshi_scholar_t','satoshis_chosen','satoshis_cipher','satoshis_cipher_t',
  'satoshis_covenant','satoshis_covenant_t','satoshis_disciple','satoshis_ghost',
  'satoshis_ghost_t','satoshis_revenge_t','satoshis_vendetta_t','sats_10k','sats_1k',
  'sats_21k','sats_5k','sats_first','scene_regular_t','set_beats_complete',
  'set_builder_complete','set_daily_complete','set_explorer_complete','set_fun_complete',
  'set_irl_complete','set_lightning_complete','set_miner_complete','set_pow_complete',
  'set_profile_complete','set_pvp_complete','set_scholar_complete','set_social_complete',
  'set_spin_complete','set_streak_complete','set_tctv_complete','set_trails_complete',
  'set_trifecta_complete','sf_100000_hashes','sf_10000_hashes','sf_1000_hashes',
  'sf_100_hashes','sf_10_hashes','sf_500_hashes','sf_50_hashes','sf_block_solver',
  'sf_contributor','sf_contributor_10','sf_first_hash','sf_low_hash','sf_lucky_1',
  'sf_lucky_10','sf_lucky_100','sf_lucky_1000','sf_lucky_5','sf_lucky_50','sf_ultra_low',
  'sf_unlucky_1','sf_unlucky_10','sf_unlucky_100','sf_unlucky_1000','sf_unlucky_5',
  'sf_unlucky_50','sovereign_individual',
  // Donation (charity) badges
  'donor_100','donor_500','donor_1000','donor_5000','donor_10000','donor_25000','donor_50000','donor_100000',
  // FLEX all-daily milestone badges
  'flex_all_1','flex_all_5','flex_all_50','flex_all_500',
  // FLEX per-action milestone badges
  'flex_steak_1','flex_steak_5','flex_steak_50','flex_steak_500',
  'flex_sunlight_1','flex_sunlight_5','flex_sunlight_50','flex_sunlight_500',
  'flex_dca_1','flex_dca_5','flex_dca_50','flex_dca_500',
  'flex_custody_1','flex_custody_5','flex_custody_50','flex_custody_500',
  'flex_lift_1','flex_lift_5','flex_lift_50','flex_lift_500',
  'flex_meetup_1','flex_meetup_5','flex_meetup_50','flex_meetup_500',
  'flex_lightning_1','flex_lightning_5','flex_lightning_50','flex_lightning_500',
  'flex_read_1','flex_read_5','flex_read_50','flex_read_500',
  'flex_sleep_1','flex_sleep_5','flex_sleep_50','flex_sleep_500',
  'flex_nokyc_1','flex_nokyc_5','flex_nokyc_50','flex_nokyc_500',
  'flex_node_1','flex_node_5','flex_node_50','flex_node_500',
  'flex_cold_1','flex_cold_5','flex_cold_50','flex_cold_500',
  'flex_fast_1','flex_fast_5','flex_fast_50','flex_fast_500',
  'flex_walk_1','flex_walk_5','flex_walk_50','flex_walk_500',
  'flex_journal_1','flex_journal_5','flex_journal_50','flex_journal_500',
  'flex_meditate_1','flex_meditate_5','flex_meditate_50','flex_meditate_500',
  'flex_teach_1','flex_teach_5','flex_teach_50','flex_teach_500',
  'flex_water_1','flex_water_5','flex_water_50','flex_water_500',
  'flex_gratitude_1','flex_gratitude_5','flex_gratitude_50','flex_gratitude_500',
  'flex_verify_1','flex_verify_5','flex_verify_50','flex_verify_500',
  'flex_focus_1','flex_focus_5','flex_focus_50','flex_focus_500',
  'flex_risk_1','flex_risk_5','flex_risk_50','flex_risk_500',
  'flex_pattern_1','flex_pattern_5','flex_pattern_50','flex_pattern_500',
  'flex_findq_1','flex_findq_5','flex_findq_50','flex_findq_500',
  'flex_noleverage_1','flex_noleverage_5','flex_noleverage_50','flex_noleverage_500',
  'flex_gunrange_1','flex_gunrange_5','flex_gunrange_50','flex_gunrange_500',
  'flex_sellchairs_1','flex_sellchairs_5','flex_sellchairs_50','flex_sellchairs_500',
  'flex_starebtc_1','flex_starebtc_5','flex_starebtc_50','flex_starebtc_500',
  'flex_itoldyou_1','flex_itoldyou_5','flex_itoldyou_50','flex_itoldyou_500',
  'flex_pumpndump_1','flex_pumpndump_5','flex_pumpndump_50','flex_pumpndump_500','spin_1','spin_100','spin_30','spin_7',
  'spin_closet_1','spin_closet_5','spin_jackpot','spin_set_t','spin_streak_14',
  'spin_streak_30','spin_streak_7','staff_writer_t','story_begun','story_complete',
  'story_halfway','story_master_t','streak_100','streak_14','streak_200','streak_21',
  'streak_3','streak_30','streak_365','streak_60','streak_7','summit_conqueror_t',
  'super_fan_t','super_spreader_t','tctv_antenna_wizard','tctv_binge_watcher',
  'tctv_channel_hopper','tctv_couch_king','tctv_couch_potato','tctv_dial_spinner',
  'tctv_remote_warrior','tctv_satellite','tctv_signal_seeker','tctv_timechain_surfer',
  'tctv_tuned_in','the_archive','the_archivist_t','the_completionist','the_devoted',
  'the_devotee','the_hodler','the_long_walker','the_satellite','the_viral_plebian',
  'time_traveler','timechain_surfer','timechain_veteran_t','tip_10','tip_first',
  'tip_magnet','tip_magnet_t','tip_received_1','tip_received_50','tip_sats_10k',
  'tip_whale','to_the_moon','trail_all','trail_blazer_t','trail_double','trail_master',
  'trail_meadow','trail_meadow_fast','trail_mountain','trail_perfectionist','trail_revisit',
  'trail_speed_3','trail_started','trail_summit','trifecta_god_t','trifecta_legend',
  'trivia_correct_1','trivia_correct_10','trivia_correct_100','trivia_correct_30',
  'trivia_first','trivia_streak_30','trivia_streak_7','trivia_titan','twenty_one_million',
  'unstoppable_pvp_t','vinyl_master','weekly_hero','wheel_addict_t','world_traveler_t',
]);

const POINT_VALUES = {
  'daily_all_three': 1,
  'level_up': 1,
  'level_up_5': 5,
  'level_up_10': 10,
  'badge_earned': 1,
};

/**
 * Helper: Get today's date string in YYYY-MM-DD format
 */
function getTodayString() {
  // 5-hour UTC offset — matches client getDailyKey() which resets at 5 AM UTC
  // Prevents users from double-completing daily challenges at the UTC midnight boundary
  const RESET_HOUR_UTC = 5;
  const shifted = new Date(Date.now() - RESET_HOUR_UTC * 3600 * 1000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Helper: Check if favor has expired and reset if needed.
 * Must be called inside a transaction with the current state doc ref.
 * Returns the (possibly reset) state data.
 */
function checkAndResetFavor(stateData, transaction, stateRef) {
  if (!stateData.favorActive) return stateData;

  const now = Date.now();
  const favorEndBase = stateData.favorEndBase ? stateData.favorEndBase.toMillis() : 0;
  const bonusMs = (stateData.bonusMinutes || 0) * 60 * 1000;
  const effectiveEnd = favorEndBase + bonusMs;

  if (now > effectiveEnd) {
    // Archive last window stats before resetting
    try {
      const lastWindowRef = db.collection('satoshiFavor').doc('lastWindow');
      transaction.set(lastWindowRef, {
        cycleId: stateData.currentCycleId || null,
        startedAt: stateData.favorStart || null,
        endedAt: admin.firestore.Timestamp.now(),
        durationMinutes: (function() {
          if (!stateData.favorStart || !effectiveEnd) return 0;
          const startMs = stateData.favorStart.toMillis();
          const durMs = effectiveEnd - startMs;
          return durMs > 0 ? Math.round(durMs / 60000) : 0;
        })(),
        totalHashes: stateData.totalHashes || 0,
        lowestHash: stateData.lowestHashThisWindow || null,
        difficultyTarget: DIFFICULTY_TARGET,
        winner: stateData.lowestHashThisWindowUid ? {
          uid: stateData.lowestHashThisWindowUid,
          username: stateData.lowestHashThisWindowUsername || null,
        } : null,
        winners: stateData.winnersThisWindow || [],
        archivedAt: admin.firestore.Timestamp.now(),
      }, { merge: false });
    } catch (e) {
      console.warn('[FAVOR] lastWindow archive failed:', e.message);
    }
    // Favor has expired — reset (preserve eraHashes — never wipe it)
    const resetData = {
      points: 0,
      favorActive: false,
      favorStart: null,
      favorEndBase: null,
      bonusMinutes: 0,
      totalHashes: 0,
      lowestHashThisWindow: null,
      winnersThisWindow: [],
      lastReset: admin.firestore.Timestamp.now(),
      currentCycleId: stateData.currentCycleId || null,
      eraHashes: stateData.eraHashes || 0,
    };
    transaction.set(stateRef, resetData);
    return resetData;
  }

  return stateData;
}

// Valid level names per source tier (server-side whitelist)
const LEVEL_TIERS = {
  'level_up': ['Normie','Curious','Pleb','Pleb II','Pleb III','Stacker','Stacker II','Stacker III'],
  'level_up_5': ['Maxi','Maxi II','Maxi III'],
  'level_up_10': ['Papa John','Full Node','Whale','Sovereign','Cypherpunk','Satoshi'],
};

// Minimum XP thresholds per level (must match client LEVELS array)
const LEVEL_MIN_POINTS = {
  'Normie': 0, 'Curious': 10,
  'Pleb': 144, 'Pleb II': 170, 'Pleb III': 256,
  'Stacker': 500, 'Stacker II': 1913, 'Stacker III': 2016,
  'Maxi': 2140, 'Maxi II': 6102, 'Maxi III': 8888,
  'Papa John': 10000, 'Full Node': 18333, 'Whale': 50000,
  'Sovereign': 100000, 'Cypherpunk': 133337, 'Satoshi': 210000,
};

// Max bonus minutes cap (prevent infinite favor window)
const MAX_BONUS_MINUTES = 180; // 3 hours max extension
const MAX_POINTS = 42; // 2x activation threshold — prevents unbounded accumulation

/**
 * contributeFavor (onCall)
 * Called when community earns a Satoshi's Favor point.
 */
exports.contributeFavor = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  // Block anonymous users
  if (context.auth.token.firebase && context.auth.token.firebase.sign_in_provider === 'anonymous') {
    throw new functions.https.HttpsError('permission-denied', 'Anonymous users cannot contribute to Satoshi\'s Favor.');
  }

  const uid = context.auth.uid;
  const { source, detail } = data;

  // Validate source
  if (!source || !POINT_VALUES[source]) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Invalid source. Must be one of: ${Object.keys(POINT_VALUES).join(', ')}`
    );
  }

  const pointsToAdd = POINT_VALUES[source];
  const stateRef = db.collection('satoshiFavor').doc('current');
  const today = getTodayString();

  // Fetch user doc for ALL source types (needed for validation)
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('failed-precondition', 'User profile not found.');
  }
  const userData = userDoc.data();

  // Server-side validation for daily_all_three
  // [AUDIT FIX C-1] Validate against CF-written daily_action_counts records,
  // NOT client-writable user doc fields (dailyAllThreeDate etc are now blocked in rules).
  if (source === 'daily_all_three') {
    const dailyPtsBase = db.collection('users').doc(uid).collection('daily_action_counts');
    let triviaDoc, pollDoc, questDoc;
    try {
      const results = await Promise.all([
        dailyPtsBase.doc(today + '_trivia').get(),
        dailyPtsBase.doc(today + '_poll_vote').get(),
        dailyPtsBase.doc(today + '_quest').get(),
      ]);
      triviaDoc = results[0];
      pollDoc   = results[1];
      questDoc  = results[2];
    } catch (readErr) {
      console.error('[SF] daily_all_three validation read failed:', readErr);
      throw new functions.https.HttpsError('internal', 'Could not verify completion — please try again.');
    }

    const triviaComplete = triviaDoc && triviaDoc.exists;
    const pollComplete   = pollDoc   && pollDoc.exists;
    const questComplete  = questDoc  && questDoc.exists && (questDoc.data().count || 0) >= 1;

    console.log(`[SF] daily_all_three check uid=${uid} today=${today} trivia=${triviaComplete} poll=${pollComplete} quest=${questComplete}`);

    if (!triviaComplete || !pollComplete || !questComplete) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Must complete all three today: quiz=${questComplete}, trivia=${triviaComplete}, poll=${pollComplete}.`
      );
    }
  }

  // Server-side validation for level-ups
  if (source === 'level_up' || source === 'level_up_5' || source === 'level_up_10') {
    const validLevels = LEVEL_TIERS[source];
    const levelName = detail || '';
    // Validate the level name is in the correct tier
    if (!validLevels || !validLevels.includes(levelName)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Invalid level name for ${source}: ${levelName}`
      );
    }
    // Validate the user actually has enough points for this level
    const requiredPoints = LEVEL_MIN_POINTS[levelName];
    const userPoints = userData.points || 0;
    if (userPoints < requiredPoints) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `User has ${userPoints} XP but needs ${requiredPoints} for ${levelName}.`
      );
    }
  }

  // Server-side validation for badge_earned
  // [SECURITY] sanitizedBadge hoisted so it's accessible after the block for proof-of-earning check
  let sanitizedBadge = null;
  if (source === 'badge_earned') {
    if (!detail || typeof detail !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid badge detail.');
    }
    sanitizedBadge = detail.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50);
    if (!VALID_BADGE_IDS.has(sanitizedBadge)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Unknown badge id: ${sanitizedBadge}`
      );
    }
  }

  // [SECURITY FIX] Proof-of-earning ref.
  // badge_awards is written atomically by awardPoints CF when a badge is legitimately earned.
  // We read this inside the transaction to block SF contributions for unearned badges.
  const badgeProofRef = sanitizedBadge
    ? db.collection('users').doc(uid).collection('badge_awards').doc(sanitizedBadge)
    : null;

  // Build contributor key for dedup — server-controlled, NOT from client detail
  // Level-up and badge keys use today's date so they reset daily (not permanently blocked)
  let contributorKey;
  if (source === 'daily_all_three') {
    contributorKey = `${uid}_${today}_allthree`;
  } else if (source === 'level_up' || source === 'level_up_5' || source === 'level_up_10') {
    // Dedup by uid + level name only — NO date, each rank is reached exactly once
    const validatedLevel = detail; // already validated above against whitelist
    contributorKey = `${uid}_level_${validatedLevel}`;
  } else if (source === 'badge_earned') {
    // [SECURITY FIX] Dedup by uid + badge id only — no date reset.
    // Each badge can contribute to SF at most once per user ever.
    // Combined with the badge_awards proof check below, this closes the activation exploit.
    contributorKey = `${uid}_badge_${sanitizedBadge}`;
  } else {
    contributorKey = `${uid}_${source}_${today}`;
  }

  const contributorRef = stateRef.collection('contributors').doc(contributorKey);

  // Run in a transaction for atomicity
  const result = await db.runTransaction(async (transaction) => {
    // Batch all reads before any writes (Firestore best practice for transactions)
    const [contributorDoc, stateDoc, badgeProofDoc] = await Promise.all([
      transaction.get(contributorRef),
      transaction.get(stateRef),
      badgeProofRef ? transaction.get(badgeProofRef) : Promise.resolve(null),
    ]);

    // Check dedup
    if (contributorDoc.exists) {
      throw new functions.https.HttpsError(
        'already-exists',
        'You have already contributed for this action.'
      );
    }

    // [SECURITY FIX] Verify badge ownership: badge_awards record must exist.
    // This was written atomically by awardPoints when the badge was legitimately earned.
    // Blocks activating SF mining windows with catalog badges the user never actually earned.
    if (badgeProofRef) {
      if (!badgeProofDoc || !badgeProofDoc.exists) {
        console.warn(`[SF] badge_earned rejected — no badge_awards proof uid=${uid} badge=${sanitizedBadge}`);
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Badge has not been earned. Complete the badge challenge first.'
        );
      }
    }

    let stateData = stateDoc.exists ? stateDoc.data() : {
      points: 0,
      favorActive: false,
      favorStart: null,
      favorEndBase: null,
      bonusMinutes: 0,
      lastReset: admin.firestore.Timestamp.now(),
      currentCycleId: null,
    };

    // Check if favor expired, reset if needed
    stateData = checkAndResetFavor(stateData, transaction, stateRef);

    // Record contributor — stamp faction at time of contribution
    const faction = userData.faction || null; // cyber_hornets | honey_badgers | null
    transaction.set(contributorRef, {
      uid,
      source,
      detail: detail || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      faction,
      pointsAdded: pointsToAdd,
    });

    // Update faction totals doc atomically
    const totalsRef = db.collection('satoshiFavor').doc('factionTotals');
    const factionField = faction === 'cyber_hornets' ? 'cyber_hornets'
                       : faction === 'honey_badgers' ? 'honey_badgers'
                       : 'unaffiliated';
    transaction.set(totalsRef, {
      [factionField]: admin.firestore.FieldValue.increment(pointsToAdd),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    if (stateData.favorActive) {
      // Favor is active and not expired — add bonus minutes (capped)
      const rawBonus = (stateData.bonusMinutes || 0) + (BONUS_MINUTES_PER_POINT * pointsToAdd);
      const newBonus = Math.min(rawBonus, MAX_BONUS_MINUTES);
      const updatedState = { ...stateData, bonusMinutes: newBonus };
      transaction.set(stateRef, updatedState);
      return updatedState;
    } else {
      // Favor not active — add points (capped)
      const rawPoints = (stateData.points || 0) + pointsToAdd;
      const newPoints = Math.min(rawPoints, MAX_POINTS);

      if (newPoints >= POINTS_TO_ACTIVATE) {
        // Activate favor! Extra points beyond 21 become bonus minutes
        const overflowPoints = newPoints - POINTS_TO_ACTIVATE;
        const overflowBonus = overflowPoints * BONUS_MINUTES_PER_POINT;
        const now = admin.firestore.Timestamp.now();
        const endBase = admin.firestore.Timestamp.fromMillis(
          now.toMillis() + FAVOR_DURATION_MINUTES * 60 * 1000
        );
        const newCycleId = `cycle_${Date.now()}`;
        const activatedState = {
          points: newPoints,
          favorActive: true,
          favorStart: now,
          favorEndBase: endBase,
          bonusMinutes: overflowBonus,
          totalHashes: 0,
          lastReset: stateData.lastReset || null,
          currentCycleId: newCycleId,
          eraHashes: stateData.eraHashes || 0,
        };
        transaction.set(stateRef, activatedState);
        return activatedState;
      } else {
        // Just add points
        const updatedState = { ...stateData, points: newPoints };
        transaction.set(stateRef, updatedState);
        return updatedState;
      }
    }
  });

  return {
    success: true,
    points: result.points,
    favorActive: result.favorActive,
    bonusMinutes: result.bonusMinutes || 0,
    currentCycleId: result.currentCycleId || null,
  };
});

/**
 * hashForFavor (onCall)
 * The mining/hashing function. Auth required.
 */
exports.hashForFavor = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const uid = context.auth.uid;

  // Must not be anonymous
  if (context.auth.token.firebase && context.auth.token.firebase.sign_in_provider === 'anonymous') {
    throw new functions.https.HttpsError('permission-denied', 'Anonymous users cannot mine.');
  }

  const stateRef = db.collection('satoshiFavor').doc('current');

  // Check favor state
  const stateDoc = await stateRef.get();
  if (!stateDoc.exists) {
    throw new functions.https.HttpsError('failed-precondition', 'Satoshi\'s Favor has not been initialized.');
  }

  const stateData = stateDoc.data();

  if (!stateData.favorActive) {
    throw new functions.https.HttpsError('failed-precondition', 'Satoshi\'s Favor is not currently active.');
  }

  // Check if favor has expired
  const now = Date.now();
  const favorEndBase = stateData.favorEndBase ? stateData.favorEndBase.toMillis() : 0;
  const bonusMs = (stateData.bonusMinutes || 0) * 60 * 1000;
  const effectiveEnd = favorEndBase + bonusMs;

  if (now > effectiveEnd) {
    throw new functions.https.HttpsError('failed-precondition', 'Satoshi\'s Favor has expired.');
  }

  // Get username (outside transaction — read-only, not security-critical)
  let username = 'Anonymous';
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      username = userData.username || userData.displayName || 'Anonymous';
    }
  } catch (e) {
    console.warn(`Could not fetch username for ${uid}:`, e.message);
  }

  // Feature 5: Dual rig support — each rig has its own cooldown bucket so they don't share the limit
  const rigNum = (data && data.rig === 2) ? 2 : 1;
  const rigSuffix = rigNum === 2 ? '_rig2' : '_rig1';

  // Atomic rate-limit check + hash generation inside a transaction
  // Prevents TOCTOU: concurrent requests all reading the same cooldown state
  const hashesRef = stateRef.collection('hashes');
  const cooldownRef = stateRef.collection('cooldowns').doc(uid + rigSuffix);

  // Compute server-side effective rate (base + community heat bonus)
  // Mirrors _sfEffectiveRate() on the client. Community heat: +1/min per 1000 total hashes, capped at +10.
  const communityHeatBonus = Math.min(10, Math.floor((stateData.totalHashes || 0) / 1000));
  const effectiveRateLimit = HASHES_PER_MINUTE + communityHeatBonus;

  // [SECURITY FIX] Booster and rig2 charge check+consume moved INSIDE the transaction.
  // Previously: user doc read outside tx, booster/rig2 consumed outside tx, THEN cooldown tx ran.
  // TOCTOU: two concurrent requests both read hashBoosterHashes:1 outside the tx, both saw
  // usingBooster=true, both consumed (-1 each), both skipped rate limiting → 1 charge, N hashes.
  // Same for rig2: two requests both read secondRigCharges:1, both consumed, went to -1.
  // Fix: read user doc + consume booster/rig2 atomically inside the same tx as cooldown check.
  const userRef2 = db.collection('users').doc(uid);
  const currentCycleId = stateData.currentCycleId || 'unknown';

  const { value, isWinner } = await db.runTransaction(async (transaction) => {
    const cooldownDoc = await transaction.get(cooldownRef);
    const userDoc = await transaction.get(userRef2);

    const userData = userDoc.exists ? userDoc.data() : {};
    const boosterHashesAvail = userData.hashBoosterHashes || 0;
    const usingBooster = boosterHashesAvail > 0;

    // Rig 2: validate charge atomically (inside tx — no TOCTOU)
    let rig2AlreadyUnlocked = false;
    if (rigNum === 2) {
      const rigCharges = userData.secondRigCharges || 0;
      const lastRigCycleId = userData.lastSecondRigCycleId || null;
      rig2AlreadyUnlocked = lastRigCycleId === currentCycleId;
      if (!rig2AlreadyUnlocked && rigCharges <= 0) {
        throw new functions.https.HttpsError('permission-denied', 'No Second Rig charges remaining.');
      }
    }

    let timestamps = [];
    if (cooldownDoc.exists) {
      const cdData = cooldownDoc.data();
      timestamps = (cdData.timestamps || []).filter(t => {
        const ms = t.toMillis ? t.toMillis() : t;
        return now - ms < HASH_WINDOW_MS;
      });
    }

    // Only enforce rate limit when booster is NOT active
    if (!usingBooster && timestamps.length >= effectiveRateLimit) {
      const oldestMs = timestamps[0].toMillis ? timestamps[0].toMillis() : timestamps[0];
      const waitSec = Math.ceil((HASH_WINDOW_MS - (now - oldestMs)) / 1000);
      throw new functions.https.HttpsError(
        'resource-exhausted',
        `Rate limit: ${waitSec}s until next hash (${effectiveRateLimit}/min).`
      );
    }

    // Generate random value 0 to 100,000,000
    const val = crypto.randomInt(0, 100000001);
    const winner = val < DIFFICULTY_TARGET;

    // Consume booster / rig2 charge atomically — single update object to avoid double-write
    const userUpdate = {};
    if (usingBooster) {
      userUpdate.hashBoosterHashes = admin.firestore.FieldValue.increment(-1);
    }
    if (rigNum === 2 && !rig2AlreadyUnlocked) {
      userUpdate.secondRigCharges = admin.firestore.FieldValue.increment(-1);
      userUpdate.lastSecondRigCycleId = currentCycleId;
    }
    if (Object.keys(userUpdate).length > 0) {
      transaction.update(userRef2, userUpdate);
    }

    // Always append timestamp (so cooldown tracks correctly after booster runs out)
    timestamps.push(admin.firestore.Timestamp.now());
    // Cap stored timestamps to avoid unbounded growth
    if (timestamps.length > effectiveRateLimit + 10) timestamps = timestamps.slice(-effectiveRateLimit - 10);
    transaction.set(cooldownRef, { timestamps });

    return { value: val, isWinner: winner };
  });

  // Write hash doc outside transaction (not security-critical, just record-keeping)
  // NOTE: uid stored in hash doc for internal server use (cooldown, dedup) but stripped from public responses
  const hashDoc = await hashesRef.add({
    uid,
    username,
    value,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    isWinner,
    cycleId: stateData.currentCycleId || null,
    difficultyTarget: DIFFICULTY_TARGET,
  });

  // Feature 2A: Write session hash count for live leaderboard (per-cycle, resets on new window)
  try {
    const sessionHashRef = stateRef.collection('session_hashes').doc(uid);
    const currentCycleId = stateData.currentCycleId || null;
    const sessionDoc = await sessionHashRef.get();
    if (sessionDoc.exists && sessionDoc.data().cycleId === currentCycleId) {
      // Same window — increment existing count
      await sessionHashRef.update({
        count: admin.firestore.FieldValue.increment(1),
        lastHash: admin.firestore.FieldValue.serverTimestamp(),
        username, // keep username fresh
      });
    } else {
      // New window (or first hash ever) — reset count to 1
      await sessionHashRef.set({
        uid,
        username,
        cycleId: currentCycleId,
        count: 1,
        lastHash: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  } catch (e) {
    console.warn('[FAVOR] session_hashes write failed:', e.message);
  }

  // Feature 4A: Increment community totalHashes counter + track lowest hash this window
  try {
    const currentDoc = await stateRef.get();
    const currentLowest = currentDoc.exists ? (currentDoc.data().lowestHashThisWindow || Infinity) : Infinity;
    const updatePayload = { totalHashes: admin.firestore.FieldValue.increment(1), eraHashes: admin.firestore.FieldValue.increment(1) };
    if (value < currentLowest) {
      updatePayload.lowestHashThisWindow = value;
      updatePayload.lowestHashThisWindowUid = uid;
      updatePayload.lowestHashThisWindowUsername = username || null;
    }
    await stateRef.update(updatePayload);
  } catch (e) {
    console.warn('[FAVOR] totalHashes/lowestHash update failed:', e.message);
  }

  // Feature 4A-ext: Increment cumulative hashes per difficulty in a SEPARATE doc that is
  // never overwritten by transaction.set() — survives all window resets/activations safely
  try {
    const diffStatsRef = db.collection('satoshiFavor').doc('difficultyStats');
    await diffStatsRef.set(
      { ['target_' + DIFFICULTY_TARGET]: admin.firestore.FieldValue.increment(1) },
      { merge: true }
    );
  } catch (e) {
    console.warn('[FAVOR] difficultyStats increment failed:', e.message);
  }

  // Increment per-user lifetime hash counter + stamp firstHashAt on first ever hash + track wins
  try {
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const updatePayloadUser = { sfTotalHashes: admin.firestore.FieldValue.increment(1) };
    if (userSnap.exists && !userSnap.data().firstHashAt) {
      updatePayloadUser.firstHashAt = admin.firestore.FieldValue.serverTimestamp();
    }
    if (isWinner) {
      updatePayloadUser.sfBlocksFound = admin.firestore.FieldValue.increment(1);
    }
    await userRef.update(updatePayloadUser);
  } catch (e) {
    console.warn('[FAVOR] sfTotalHashes/firstHashAt/sfBlocksFound update failed:', e.message);
  }

  // Track all winners this window in an array on the state doc
  if (isWinner) {
    try {
      await stateRef.update({
        winnersThisWindow: admin.firestore.FieldValue.arrayUnion({
          uid,
          username: username || null,
          value,
        }),
      });
    } catch (e) {
      console.warn('[FAVOR] winnersThisWindow update failed:', e.message);
    }
  }

  // Pool epoch tracking — accumulate 5 blocks, then archive and reset
  let epochComplete = null; // set inside tx if this block completes an epoch
  if (isWinner) {
    try {
      const epochRef = db.collection('satoshiFavor').doc('poolEpoch');
      await db.runTransaction(async (tx) => {
        const epochDoc = await tx.get(epochRef);
        const epochData = epochDoc.exists ? epochDoc.data() : {};
        const blocks = epochData.blocks || [];
        const epochNum = epochData.epochNumber || 1;

        const newBlock = {
          uid,
          username: username || null,
          value,
          foundAt: admin.firestore.Timestamp.now(),
        };
        const updatedBlocks = [...blocks, newBlock];

        if (updatedBlocks.length >= 5) {
          // Epoch complete — archive it
          const histRef = db.collection('sfPoolHistory').doc();
          tx.set(histRef, {
            epochNumber: epochNum,
            blocks: updatedBlocks,
            completedAt: admin.firestore.Timestamp.now(),
            totalSats: 21000,
          });
          // Reset poolEpoch for next epoch
          tx.set(epochRef, {
            epochNumber: epochNum + 1,
            blocks: [],
            startedAt: admin.firestore.Timestamp.now(),
          });
          // Flag for post-transaction epoch completion announcement
          epochComplete = { epochNum, blocks: updatedBlocks };
        } else {
          // Still accumulating
          tx.set(epochRef, {
            epochNumber: epochNum,
            blocks: updatedBlocks,
            startedAt: epochData.startedAt || admin.firestore.Timestamp.now(),
          });
        }
      });
    } catch (e) {
      console.warn('[FAVOR] poolEpoch update failed:', e.message);
    }

    // Post epoch completion announcement AFTER transaction commits
    if (epochComplete) {
      try {
        const { epochNum, blocks } = epochComplete;
        const winnerList = blocks
          .map((b, i) => `${i + 1}. @${(b.username || 'Anonymous').replace(/[<>"'&]/g, '').substring(0, 30)} (${(b.value || 0).toLocaleString()})`)
          .join('\n');
        const epochMsg = `⛏️ EPOCH #${epochNum} COMPLETE! 🎉\n\n5 blocks have been mined — 21,000 sats will be split among the winners:\n\n${winnerList}\n\n💰 Each winner receives ~${Math.floor(21000 / 5).toLocaleString()} sats. Congrats to all 5 miners! Keep hashing for the next epoch! ⚡`;
        const nachoUid = 'nacho-bot';
        const epochTs = admin.firestore.FieldValue.serverTimestamp();
        await db.collection('global_chat').add({
          uid: nachoUid,
          name: '🦌 Nacho',
          text: epochMsg,
          isNachoAuto: false,
          ts: epochTs,
        }).catch(e => console.warn('[FAVOR] Epoch announce global_chat failed:', e.message));
        await db.collection('announcements').add({
          uid: nachoUid,
          name: '🦌 Nacho',
          text: epochMsg,
          isNachoAuto: true,
          ts: epochTs,
        }).catch(e => console.warn('[FAVOR] Epoch announce announcements failed:', e.message));
        console.log(`[FAVOR] Epoch #${epochNum} completion announced to chat.`);
      } catch (e) {
        console.warn('[FAVOR] Epoch completion announcement failed:', e.message);
      }
    }
  }

  // Update personal best — per-user doc (avoids single-doc bloat)
  const pbRef = db.collection('satoshiFavor').doc('personalBests').collection('users').doc(uid);
  try {
    const pbDoc = await pbRef.get();
    let prev = pbDoc.exists ? pbDoc.data() : null;
    // Migration: if no per-user doc, check legacy single-doc for old PB
    if (!prev) {
      const legacyDoc = await db.collection('satoshiFavor').doc('personalBests').get();
      if (legacyDoc.exists) {
        const legacyUsers = legacyDoc.data().users || {};
        if (legacyUsers[uid]) prev = legacyUsers[uid];
      }
    }
    if (!prev || value < prev.value) {
      await pbRef.set({ value, username, timestamp: admin.firestore.FieldValue.serverTimestamp() });
      // Also denormalize onto user doc so the hasher leaderboard can show it without extra fetches
      try {
        await db.collection('users').doc(uid).update({ sfBestHash: value });
      } catch (e2) {
        console.warn('[FAVOR] sfBestHash denorm failed:', e2.message);
      }
    }
  } catch (e) {
    console.warn('[FAVOR] Personal best update failed:', e.message);
  }

  // Update community top 25 lowest hashes (all-time leaderboard)
  // Uses _uid internally for dedup but does NOT expose it in the public doc
  const lbRef = db.collection('satoshiFavor').doc('topHashes');
  try {
    const lbDoc = await lbRef.get();
    const lbData = lbDoc.exists ? lbDoc.data() : {};
    let entries = lbData.entries || [];
    
    // Allow multiple entries per user — top 50 hashes all-time regardless of who mined them
    const qualifies = entries.length < 50 || value < entries[entries.length - 1].value;

    if (qualifies) {
      const nowTs = admin.firestore.Timestamp.now();
      entries.push({ username, value, timestamp: nowTs, difficultyTarget: DIFFICULTY_TARGET });
      entries.sort((a, b) => a.value - b.value);
      entries = entries.slice(0, 50);
      // Normalise entries: backfill difficultyTarget for legacy entries that lack it
      entries = entries.map(e => {
        const ts = (e.timestamp && typeof e.timestamp.toMillis === 'function') ? e.timestamp : admin.firestore.Timestamp.now();
        const target = e.difficultyTarget != null ? e.difficultyTarget : difficultyAtTime(ts.toMillis());
        return { username: e.username || 'Anon', value: e.value, timestamp: ts, difficultyTarget: target };
      });
      await lbRef.set({ entries });
    }
  } catch (e) {
    console.error('[FAVOR] Top hashes update failed:', e.message, e.stack);
  }

  // Feature 7B/C: Win announcement — post to Global Chat and GGs/Announcements
  if (isWinner) {
    const safeUsername = (username || 'Anonymous').replace(/[<>"'&]/g, '').substring(0, 50);
    const winMsg = `⛏️ BLOCK FOUND! ⚡\n\n@${safeUsername} solved a block with hash ${value.toLocaleString()} (target: < ${DIFFICULTY_TARGET.toLocaleString()}) 🎉\n\n👑 Congratulations! Will you be next? ⛏️`;
    const nachoUid = 'nacho-bot';
    const winTs = admin.firestore.FieldValue.serverTimestamp();

    // Post to Global Chat (visible in main chat feed)
    await db.collection('global_chat').add({
      uid: nachoUid,
      name: '🦌 Nacho',
      text: winMsg,
      isNachoAuto: false,
      ts: winTs,
    }).catch(e => console.warn('[FAVOR] Win global_chat post failed:', e.message));

    // Post to GGs/Announcements collection (the 🎉 GGs tab)
    await db.collection('announcements').add({
      uid: nachoUid,
      name: '🦌 Nacho',
      text: winMsg,
      isNachoAuto: true,
      ts: winTs,
    }).catch(e => console.warn('[FAVOR] Win announcements post failed:', e.message));

    console.log(`[FAVOR] WIN posted to chat for ${safeUsername}, hash=${value}`);
  }

  return {
    value,
    isWinner,
    hashId: hashDoc.id,
  };
});

/**
 * checkFavorState (onCall) — lightweight
 * Returns current state. No auth required. Auto-resets if expired.
 */
exports.checkFavorState = functions.https.onCall(async (data, context) => {
  const stateRef = db.collection('satoshiFavor').doc('current');
  const stateDoc = await stateRef.get();

  if (!stateDoc.exists) {
    return {
      points: 0,
      favorActive: false,
      favorStart: null,
      favorEndBase: null,
      bonusMinutes: 0,
      lastReset: null,
      currentCycleId: null,
    };
  }

  let stateData = stateDoc.data();

  // Check if expired and reset
  if (stateData.favorActive) {
    const now = Date.now();
    const favorEndBase = stateData.favorEndBase ? stateData.favorEndBase.toMillis() : 0;
    const bonusMs = (stateData.bonusMinutes || 0) * 60 * 1000;
    const effectiveEnd = favorEndBase + bonusMs;

    if (now > effectiveEnd) {
      // Archive last window stats before resetting
      try {
        const lastWindowRef = db.collection('satoshiFavor').doc('lastWindow');
        await lastWindowRef.set({
          cycleId: stateData.currentCycleId || null,
          startedAt: stateData.favorStart || null,
          endedAt: admin.firestore.Timestamp.now(),
          durationMinutes: (function() {
            if (!stateData.favorStart || !effectiveEnd) return 0;
            const startMs = stateData.favorStart.toMillis();
            const durMs = effectiveEnd - startMs;
            return durMs > 0 ? Math.round(durMs / 60000) : 0;
          })(),
          totalHashes: stateData.totalHashes || 0,
          lowestHash: stateData.lowestHashThisWindow || null,
          difficultyTarget: DIFFICULTY_TARGET,
          winner: stateData.lowestHashThisWindowUid ? {
            uid: stateData.lowestHashThisWindowUid,
            username: stateData.lowestHashThisWindowUsername || null,
          } : null,
          winners: stateData.winnersThisWindow || [],
          archivedAt: admin.firestore.Timestamp.now(),
        }, { merge: false });
      } catch (e) {
        console.warn('[FAVOR] checkFavorState lastWindow archive failed:', e.message);
      }
      // Reset (preserve eraHashes — never wipe it)
      const resetData = {
        points: 0,
        favorActive: false,
        favorStart: null,
        favorEndBase: null,
        bonusMinutes: 0,
        totalHashes: 0,
        lowestHashThisWindow: null,
        winnersThisWindow: [],
        lastReset: admin.firestore.Timestamp.now(),
        currentCycleId: stateData.currentCycleId || null,
        eraHashes: stateData.eraHashes || 0,
      };
      await stateRef.set(resetData);
      stateData = resetData;
    }
  }

  return {
    points: stateData.points || 0,
    favorActive: stateData.favorActive || false,
    favorStart: stateData.favorStart || null,
    favorEndBase: stateData.favorEndBase || null,
    bonusMinutes: stateData.bonusMinutes || 0,
    lastReset: stateData.lastReset || null,
    currentCycleId: stateData.currentCycleId || null,
  };
});

/**
 * getFavorHashes (onCall) — public
 * Returns recent hashes from subcollection, paginated.
 */
exports.getFavorHashes = functions.https.onCall(async (data, context) => {
  const limit = Math.min(Math.max((data && data.limit) || 50, 1), 100);
  const after = (data && data.after) || null;

  const stateRef = db.collection('satoshiFavor').doc('current');
  const hashesRef = stateRef.collection('hashes');

  let query = hashesRef.orderBy('timestamp', 'desc').limit(limit);

  if (after) {
    // Get the cursor document
    const cursorDoc = await hashesRef.doc(after).get();
    if (cursorDoc.exists) {
      query = hashesRef.orderBy('timestamp', 'desc').startAfter(cursorDoc).limit(limit);
    }
  }

  const snapshot = await query.get();
  const hashes = [];

  const callerUid = context.auth ? context.auth.uid : null;
  snapshot.forEach((doc) => {
    const d = doc.data();
    hashes.push({
      id: doc.id,
      username: d.username,
      value: d.value,
      timestamp: d.timestamp || null,
      isWinner: d.isWinner || false,
      cycleId: d.cycleId || null,
      isMe: callerUid ? d.uid === callerUid : false,
    });
  });

  return {
    hashes,
    count: hashes.length,
    hasMore: hashes.length === limit,
  };
});

/**
 * syncCycleToTop10 (onCall) — admin only
 * Syncs all hashes from a specific cycle to the all-time top 10.
 * Can be used to backfill missing hashes.
 */
exports.syncCycleToTop10 = functions.https.onCall(async (data, context) => {
  // Admin check - only specific UIDs can run this
  const ADMIN_UIDS = ['Rv2KwSy4flQmYMiHobV1V03KJDX2', 'ZVlpC6mfs1W7GlKsY9TQN3Jr8Hd4']; // Add admin UIDs here
  if (!context.auth || !ADMIN_UIDS.includes(context.auth.uid)) {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }

  const { cycleId } = data || {};
  if (!cycleId) {
    throw new functions.https.HttpsError('invalid-argument', 'cycleId required');
  }

  const stateRef = db.collection('satoshiFavor').doc('current');
  const hashesRef = stateRef.collection('hashes');
  const lbRef = db.collection('satoshiFavor').doc('topHashes');

  // Get all hashes for this cycle
  const snapshot = await hashesRef.where('cycleId', '==', cycleId).get();
  const hashes = [];
  snapshot.forEach(doc => {
    const d = doc.data();
    hashes.push({ uid: d.uid, username: d.username, value: d.value });
  });

  console.log(`[FAVOR-SYNC] Found ${hashes.length} hashes for cycle ${cycleId}`);

  // Get current top 10
  const lbDoc = await lbRef.get();
  const lbData = lbDoc.exists ? lbDoc.data() : {};
  let entries = lbData.entries || [];

  // Process each hash
  let added = 0;
  let skipped = 0;
  // Allow multiple entries per user — top 50 hashes all-time
  for (const hash of hashes) {
    const { username, value } = hash;

    // Check if qualifies for top 50
    if (entries.length >= 50 && value >= entries[entries.length - 1].value) {
      skipped++;
      continue;
    }

    entries.push({ username, value, timestamp: admin.firestore.Timestamp.now() });
    added++;
  }

  // Strip serverTimestamp sentinels from any legacy entries
  entries = entries.map(e => ({
    username: e.username || 'Anon',
    value: e.value,
    timestamp: (e.timestamp && typeof e.timestamp.toMillis === 'function') ? e.timestamp : admin.firestore.Timestamp.now()
  }));

  // Sort and trim
  entries.sort((a, b) => a.value - b.value);
  entries = entries.slice(0, 50);
  await lbRef.set({ entries });

  console.log(`[FAVOR-SYNC] Added ${added}, skipped ${skipped}. Total entries now: ${entries.length}`);

  return {
    success: true,
    cycleId,
    hashesProcessed: hashes.length,
    added,
    skipped,
    top10: entries.map(e => ({ username: e.username, value: e.value })),
  };
});

/**
 * backfillFactionTotals (onCall, admin only)
 * One-shot function that scans ALL contributor docs, joins against users collection
 * for current faction (Option A), stamps faction on each contributor doc that is
 * missing it, and rebuilds the factionTotals doc from scratch.
 * Safe to run multiple times — idempotent.
 */
exports.backfillFactionTotals = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');

  // Admin-only: check email
  const ADMIN_EMAILS = ['needcreations@gmail.com', 'info.603btc@gmail.com', 'najemchris8@gmail.com'];
  const userRecord = await admin.auth().getUser(context.auth.uid);
  if (!ADMIN_EMAILS.includes(userRecord.email)) {
    throw new functions.https.HttpsError('permission-denied', 'Admin only.');
  }

  const contributorsRef = db.collection('satoshiFavor').doc('current').collection('contributors');
  const totalsRef = db.collection('satoshiFavor').doc('factionTotals');

  // Fetch all contributor docs
  const snap = await contributorsRef.get();
  console.log(`[BACKFILL] Found ${snap.size} contributor docs`);

  // Collect unique UIDs
  const uidSet = new Set();
  snap.forEach(doc => { if (doc.data().uid) uidSet.add(doc.data().uid); });
  const uids = Array.from(uidSet);
  console.log(`[BACKFILL] Unique UIDs: ${uids.length}`);

  // Batch-fetch user docs (500 per batch max)
  const uidFactionMap = {};
  const batchSize = 500;
  for (let i = 0; i < uids.length; i += batchSize) {
    const batch = uids.slice(i, i + batchSize);
    const userDocs = await Promise.all(batch.map(uid => db.collection('users').doc(uid).get()));
    userDocs.forEach((ud, idx) => {
      uidFactionMap[batch[idx]] = (ud.exists && ud.data().faction) ? ud.data().faction : null;
    });
  }

  // Tally totals and stamp missing faction fields
  const totals = { cyber_hornets: 0, honey_badgers: 0, unaffiliated: 0 };
  const writeBatch = db.batch();
  let stamped = 0;

  snap.forEach(doc => {
    const d = doc.data();
    const uid = d.uid;
    const pts = d.pointsAdded || POINT_VALUES[d.source] || 1;
    const faction = uidFactionMap[uid] || null;
    const fKey = faction === 'cyber_hornets' ? 'cyber_hornets'
                : faction === 'honey_badgers' ? 'honey_badgers'
                : 'unaffiliated';
    totals[fKey] += pts;

    // Stamp faction if missing
    if (!d.faction && faction) {
      writeBatch.update(doc.ref, { faction, pointsAdded: pts });
      stamped++;
    } else if (!d.pointsAdded) {
      writeBatch.update(doc.ref, { pointsAdded: pts });
    }
  });

  // Commit contributor doc stamps in batches of 500
  await writeBatch.commit();

  // Overwrite factionTotals
  await totalsRef.set({
    cyber_hornets: totals.cyber_hornets,
    honey_badgers: totals.honey_badgers,
    unaffiliated: totals.unaffiliated,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    lastBackfill: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`[BACKFILL] Done. Totals:`, totals, `Stamped: ${stamped}`);
  return { success: true, totals, contributorDocs: snap.size, uniqueUsers: uids.length, stamped };
});

/**
 * syncUserFactionPoints (onCall)
 * Called when a user chooses (or first sets) their faction.
 * Sums all their existing contributor docs and adds those points to the new faction total.
 * Does NOT retroactively change old contributor docs (only future contributions get new faction).
 * Safe to call multiple times — uses a per-user sync record to prevent double-counting.
 */
exports.syncUserFactionPoints = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  if (context.auth.token.firebase && context.auth.token.firebase.sign_in_provider === 'anonymous') {
    throw new functions.https.HttpsError('permission-denied', 'Anonymous users cannot sync faction points.');
  }

  const uid = context.auth.uid;
  const { newFaction, previousFaction } = data;

  if (!['cyber_hornets', 'honey_badgers'].includes(newFaction)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid faction.');
  }

  const contributorsRef = db.collection('satoshiFavor').doc('current').collection('contributors');
  const totalsRef = db.collection('satoshiFavor').doc('factionTotals');
  const syncRef = db.collection('satoshiFavor').doc('factionSyncs').collection('users').doc(uid);

  // Fetch all contributor docs for this user
  const snap = await contributorsRef.where('uid', '==', uid).get();
  if (snap.empty) return { success: true, pointsSynced: 0 };

  // Sum points that are currently unaffiliated (no faction was stamped)
  // or were already on this user's old unaffiliated pool
  const syncDoc = await syncRef.get();
  const prevSyncedFaction = syncDoc.exists ? syncDoc.data().faction : null;
  const prevSyncedPoints = syncDoc.exists ? syncDoc.data().pointsSynced : 0;

  let unaffiliatedPoints = 0;
  const unstampedDocs = [];
  snap.forEach(doc => {
    const d = doc.data();
    // Count docs that have no faction stamp (unaffiliated pool)
    if (!d.faction) {
      unaffiliatedPoints += d.pointsAdded || POINT_VALUES[d.source] || 1;
      unstampedDocs.push(doc.ref);
    }
  });

  if (unaffiliatedPoints === 0) return { success: true, pointsSynced: 0 };

  // Atomically move points from unaffiliated → newFaction
  await db.runTransaction(async (transaction) => {
    const totalsDoc = await transaction.get(totalsRef);
    const current = totalsDoc.exists ? totalsDoc.data() : {};
    const unaffil = current.unaffiliated || 0;

    // Don't subtract more than what's in unaffiliated (safety)
    const toMove = Math.min(unaffiliatedPoints, unaffil);
    if (toMove <= 0) return;

    transaction.set(totalsRef, {
      unaffiliated: Math.max(0, unaffil - toMove),
      [newFaction]: admin.firestore.FieldValue.increment(toMove),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Stamp faction on all previously-unaffiliated contributor docs for this user
    for (const ref of unstampedDocs) {
      transaction.update(ref, { faction: newFaction });
    }

    // Record this sync so we don't double-count
    transaction.set(syncRef, {
      uid,
      faction: newFaction,
      pointsSynced: toMove,
      syncedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { success: true, pointsSynced: unaffiliatedPoints };
});

/**
 * getFactionTotals (onCall)
 * Public read of factionTotals doc. Real-time updates handled client-side via Firestore listener.
 */
exports.getFactionTotals = functions.https.onCall(async (data, context) => {
  const doc = await db.collection('satoshiFavor').doc('factionTotals').get();
  if (!doc.exists) return { cyber_hornets: 0, honey_badgers: 0, unaffiliated: 0 };
  const d = doc.data();
  return {
    cyber_hornets: d.cyber_hornets || 0,
    honey_badgers: d.honey_badgers || 0,
    unaffiliated: d.unaffiliated || 0,
  };
});
