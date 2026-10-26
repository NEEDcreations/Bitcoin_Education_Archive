// © 2024-2026 603BTC LLC. All rights reserved.
// This code is proprietary. See LICENSE file. Do not copy or redistribute.
// =============================================
// Bitcoin Education Archive - Achievement Badges
// =============================================

// Server stats win once prediction_stats has loaded. Until then, the frozen
// users.predictions aggregate still unlocks badges earned before the move.
function _predBadgeCounts() {
    var empty = { total: 0, correct: 0, bestStreak: 0 };
    if (typeof currentUser === 'undefined' || !currentUser) return empty;
    var server = currentUser._serverPred;
    if (server) {
        return {
            total: server.total || 0,
            correct: server.correct || 0,
            bestStreak: server.bestStreak || 0
        };
    }
    var legacy = currentUser.predictions;
    if (!legacy) return empty;
    return {
        total: legacy.total || 0,
        correct: legacy.correct || 0,
        bestStreak: legacy.bestStreak || 0
    };
}

const BADGE_DEFS = [
    // ---- Ghost Mode & Onboarding Badges ----
    { id: 'ghost_mode', name: 'Ghost Mode', emoji: '👻', desc: 'Exploring the Archive anonymously — your progress is at risk!', check: () => (typeof auth !== 'undefined' && auth && auth.currentUser && auth.currentUser.isAnonymous), pts: 0, hidden: false },
    { id: 'first_save', name: 'No Longer a Ghost', emoji: '✅', desc: 'Saved your progress by signing in. Smart move.', check: () => false, pts: 50, hidden: false },
    { id: 'nacho_quester', name: 'Nacho\'s Apprentice', emoji: '🦌', desc: 'Completed the Nacho onboarding quest', check: () => localStorage.getItem('btc_onboarding_quest_done') === '1', pts: 50, hidden: false },
    // ---- Proof of Walk Badges ----
    { id: "pow_first_step", name: "First Step", emoji: "👟", desc: "Synced your first walk via Proof of Walk", check: () => false, pts: 50, hidden: false },
    { id: "pow_marathoner", name: "Marathoner", emoji: "🏃‍♂️", desc: "Hit the 42km daily cap in Proof of Walk", check: () => false, pts: 200, hidden: false },
    // Streak badges
    { id: "pow_streak_3", name: "3-Day Streak", emoji: "🔥", desc: "Synced walks 3 days in a row via Proof of Walk", check: () => false, pts: 100, hidden: false },
    { id: "pow_streak_7", name: "7-Day Streak", emoji: "🔥", desc: "Synced walks 7 days in a row via Proof of Walk", check: () => false, pts: 300, hidden: false },
    { id: "pow_streak_30", name: "30-Day Streak", emoji: "💎", desc: "Synced walks 30 days in a row via Proof of Walk", check: () => false, pts: 1000, hidden: false },
    // All-time km milestones
    { id: "pow_km_10", name: "10 km Club", emoji: "🥾", desc: "Walked 10 km lifetime via Proof of Walk", check: () => false, pts: 50, hidden: false },
    { id: "pow_km_50", name: "50 km Club", emoji: "🚶", desc: "Walked 50 km lifetime via Proof of Walk", check: () => false, pts: 100, hidden: false },
    { id: "pow_km_100", name: "Century Walker", emoji: "🏅", desc: "Walked 100 km lifetime via Proof of Walk", check: () => false, pts: 200, hidden: false },
    { id: "pow_km_500", name: "500 km Legend", emoji: "🏔️", desc: "Walked 500 km lifetime via Proof of Walk", check: () => false, pts: 500, hidden: false },
    { id: "pow_km_1000", name: "1,000 km Titan", emoji: "🌍", desc: "Walked 1,000 km lifetime via Proof of Walk", check: () => false, pts: 1000, hidden: false },
    { id: "pow_km_5000", name: "To the Moon", emoji: "🌕", desc: "Walked 5,000 km lifetime via Proof of Walk", check: () => false, pts: 2500, hidden: false },
    { id: 'first_channel', name: 'First Steps', emoji: '👶', desc: 'Opened your first channel', check: v => v.length >= 1, pts: 10 },
    { id: 'explorer_10', name: 'Explorer', emoji: '🧭', desc: 'Visited 10 topics', check: v => v.length >= 10, pts: 15 },
    { id: 'explorer_25', name: 'Trailblazer', emoji: '🗺️', desc: 'Visited 25 topics', check: v => v.length >= 25, pts: 30 },
    { id: 'explorer_50', name: 'Pathfinder', emoji: '🏕️', desc: 'Visited 50 topics', check: v => v.length >= 50, pts: 50 },
    { id: 'explorer_100', name: 'Cartographer', emoji: '🌍', desc: 'Visited 100 topics', check: v => v.length >= 100, pts: 100 },
    { id: 'explorer_all', name: 'Completionist', emoji: '🗝️', desc: 'Visited every single topic', check: (v, total) => v.length >= total, pts: 500 },
    { id: 'foundation_builder', name: 'Foundation Builder', emoji: '🧱', desc: 'Read all Layer 1 Properties (Orange)', check: v => {
        const orange = ['whitepaper','decentralized','scarce','secure','money','peaceful','dominant','organic','supranational','programmable','use-cases'];
        return orange.every(p => v.includes(p));
    }, pts: 75},
    { id: 'experienced_pro', name: 'Deep Diver', emoji: '🤿', desc: 'Read all Experienced Topics (Purple)', check: v => {
        const purple = ['maximalism','problems-of-money','self-custody','privacy-nonkyc','nodes','mining','pow-vs-pos','energy','difficulty-adjustment','layer-2-lightning','fedi-ark','chaumian-mints','ctv-covenants','extension-blocks','op-codes','bitvm','layer-3-sidechains','stablecoins','smart-contracts','blockchain-timechain','regulation','cryptography','core-source-code','developers','investment-strategy','evidence-against-alts','consensus'];
        return purple.every(p => v.includes(p));
    }, pts: 150},
    { id: 'librarian', name: 'The Librarian', emoji: '📚', desc: 'Read all Resource topics (Blue)', check: v => {
        const blue = ['one-stop-shop','faq-glossary','nostr','misconceptions-fud','books','videos','podcasts','articles-threads','informational-sites','curriculum','research-theses','games','music','movies-tv','hardware','poems-stories','apps-tools','projects-diy','art-inspiration','graphics','charts','swag-merch','jobs-earn','social-media','fun-facts','news-adoption','history','international','satoshi-nakamoto','giga-chad','health','web5','memes-funny'];
        return blue.every(p => v.includes(p));
    }, pts: 150},
    { id: 'quest_1',   name: 'Quester',         emoji: '⚔️',  desc: 'Completed your first Quest',  check: (v, t, q) => q >= 1,   pts: 10 },
    { id: 'quest_3',   name: 'Quest Seeker',     emoji: '📜',  desc: 'Completed 3 Quests',         check: (v, t, q) => q >= 3,   pts: 25 },
    { id: 'quest_5',   name: 'Quest Champion',   emoji: '🏆',  desc: 'Completed 5 Quests',         check: (v, t, q) => q >= 5,   pts: 50 },
    { id: 'quest_10',  name: 'Quest Veteran',    emoji: '🗡️',  desc: 'Completed 10 Quests',        check: (v, t, q) => q >= 10,  pts: 100 },
    { id: 'quest_25',  name: 'Quest Crusader',   emoji: '⚜️',  desc: 'Completed 25 Quests',        check: (v, t, q) => q >= 25,  pts: 200 },
    { id: 'quest_50',  name: 'Quest Master',     emoji: '👑',  desc: 'Completed 50 Quests',        check: (v, t, q) => q >= 50,  pts: 400 },
    { id: 'quest_100', name: 'Quest Legend',     emoji: '🏰',  desc: 'Completed 100 Quests',       check: (v, t, q) => q >= 100, pts: 750 },
    { id: 'bookworm', name: 'Bookworm', emoji: '📖', desc: 'Saved 5 topics to favorites', check: () => {
        return (JSON.parse(localStorage.getItem('btc_favs') || '[]')).length >= 5;
    }, pts: 20},
    { id: 'night_owl', name: 'Night Owl', emoji: '🦉', desc: 'Browsing between midnight and 5am', check: () => {
        const h = new Date().getHours();
        return h >= 0 && h < 5;
    }, pts: 15},
    { id: 'early_bird', name: 'Early Bird', emoji: '🐦', desc: 'Browsing between 5am and 7am', check: () => {
        const h = new Date().getHours();
        return h >= 5 && h < 7;
    }, pts: 15},
    { id: 'cert_scholar', name: 'Bitcoin Scholar', emoji: '🎓', desc: 'Passed the Bitcoin Scholar Certification', check: () => localStorage.getItem('btc_scholar_prop_passed') === 'true', pts: 50, displayPts: 2100 },
    // --- Timechain TV watch-time badges ---
    { id: 'tctv_tuned_in', name: 'Tuned In', emoji: '📺', desc: 'Watched 10 min of Timechain TV', check: () => parseInt(localStorage.getItem('btc_tctv_watch_time') || '0') >= 10, pts: 10 },
    { id: 'tctv_couch_potato', name: 'Couch Potato', emoji: '🛋️', desc: 'Watched 60 min of Timechain TV', check: () => parseInt(localStorage.getItem('btc_tctv_watch_time') || '0') >= 60, pts: 25 },
    { id: 'tctv_binge_watcher', name: 'Binge Watcher', emoji: '🍿', desc: 'Watched 5 hours of Timechain TV', check: () => parseInt(localStorage.getItem('btc_tctv_watch_time') || '0') >= 300, pts: 50 },
    { id: 'tctv_couch_king', name: 'Couch King', emoji: '🛌', desc: 'Watched 24 hours of Timechain TV', check: () => parseInt(localStorage.getItem('btc_tctv_watch_time') || '0') >= 1440, pts: 100 },
    { id: 'tctv_satellite', name: 'Satellite', emoji: '🛰️', desc: 'Watched 100 hours of Timechain TV', check: () => parseInt(localStorage.getItem('btc_tctv_watch_time') || '0') >= 6000, pts: 750 },
    // --- Timechain TV channel-switching badges ---
    { id: 'tctv_channel_hopper',   name: 'Channel Hopper',   emoji: '📡', desc: 'Switched TCTV channel for the first time',    check: () => parseInt(localStorage.getItem('btc_tctv_channel_switches') || '0') >= 1,   pts: 5 },
    { id: 'tctv_remote_warrior',   name: 'Remote Warrior',   emoji: '🕹️', desc: 'Switched TCTV channels 5 times',             check: () => parseInt(localStorage.getItem('btc_tctv_channel_switches') || '0') >= 5,   pts: 10 },
    { id: 'tctv_dial_spinner',     name: 'Dial Spinner',     emoji: '🌀', desc: 'Switched TCTV channels 10 times',            check: () => parseInt(localStorage.getItem('btc_tctv_channel_switches') || '0') >= 10,  pts: 15 },
    { id: 'tctv_signal_seeker',    name: 'Signal Seeker',    emoji: '📶', desc: 'Switched TCTV channels 25 times',            check: () => parseInt(localStorage.getItem('btc_tctv_channel_switches') || '0') >= 25,  pts: 25 },
    { id: 'tctv_antenna_wizard',   name: 'Antenna Wizard',   emoji: '🧙', desc: 'Switched TCTV channels 50 times',            check: () => parseInt(localStorage.getItem('btc_tctv_channel_switches') || '0') >= 50,  pts: 50 },
    { id: 'tctv_timechain_surfer', name: 'Timechain Surfer', emoji: '🏄', desc: 'Switched TCTV channels 100 times — a true Timechain TV veteran', check: () => parseInt(localStorage.getItem('btc_tctv_channel_switches') || '0') >= 100, pts: 100 },
    { id: 'cert_tech', name: 'Protocol Expert', emoji: '🛠️', desc: 'Passed the Technical Protocol Expert Certification', check: () => localStorage.getItem('btc_scholar_tech_passed') === 'true', pts: 100, displayPts: 2100 },
    { id: 'nacho_chatterbox', name: 'Nacho Chatterbox', emoji: '🦌', desc: 'Interacted with Nacho 50+ times', check: () => parseInt(localStorage.getItem('btc_nacho_interactions') || '0') >= 50, pts: 30 },
    { id: 'nacho_bestie', name: 'Nacho\'s Bestie', emoji: '🧡', desc: 'Interacted with Nacho 250+ times', check: () => parseInt(localStorage.getItem('btc_nacho_interactions') || '0') >= 250, pts: 200 },

    // ---- Global Chat Badges ----
    { id: 'chat_first', name: 'First Words', emoji: '💦', desc: 'Sent your first message in Global Chat', check: () => parseInt(localStorage.getItem('btc_chat_msgs') || '0') >= 1, pts: 10 },
    { id: 'chat_10', name: 'Chatty', emoji: '🗣️', desc: 'Sent 10 messages in Global Chat', check: () => parseInt(localStorage.getItem('btc_chat_msgs') || '0') >= 10, pts: 15 },
    { id: 'chat_50', name: 'Conversationalist', emoji: '💬', desc: 'Sent 50 messages in Global Chat', check: () => parseInt(localStorage.getItem('btc_chat_msgs') || '0') >= 50, pts: 25 },
    { id: 'chat_100', name: 'Town Crier', emoji: '📢', desc: 'Sent 100 messages in Global Chat', check: () => parseInt(localStorage.getItem('btc_chat_msgs') || '0') >= 100, pts: 50 },
    { id: 'chat_500', name: 'Chat Legend', emoji: '📯', desc: 'Sent 500 messages in Global Chat', check: () => parseInt(localStorage.getItem('btc_chat_msgs') || '0') >= 500, pts: 250 },

    // ---- Removed duplicate TCTV badges (see lines 42-46 for canonical set) ----
    { id: 'chat_streak_3', name: 'Regular', emoji: '📅', desc: 'Chatted 3 days in a row', check: () => parseInt(localStorage.getItem('btc_chat_streak') || '0') >= 3, pts: 20 },
    { id: 'chat_streak_7', name: 'Devoted Chatter', emoji: '💪', desc: 'Chatted 7 days in a row', check: () => parseInt(localStorage.getItem('btc_chat_streak') || '0') >= 7, pts: 50 },
    { id: 'chat_streak_30', name: 'Chat Addict', emoji: '💠', desc: 'Chatted 30 days in a row', check: () => parseInt(localStorage.getItem('btc_chat_streak') || '0') >= 30, pts: 300 },

    // ---- DJ Badges ----
    { id: 'dj_first', name: 'First Set', emoji: '🎧', desc: 'DJed for the first time in Global Chat', check: () => parseInt(localStorage.getItem('btc_dj_sets') || '0') >= 1, pts: 25 },
    { id: 'dj_5', name: 'Resident DJ', emoji: '🎛️', desc: 'DJed 5 sets in Global Chat', check: () => parseInt(localStorage.getItem('btc_dj_sets') || '0') >= 5, pts: 50 },
    { id: 'dj_25', name: 'Club Legend', emoji: '🎶', desc: 'DJed 25 sets in Global Chat', check: () => parseInt(localStorage.getItem('btc_dj_sets') || '0') >= 25, pts: 300 },
    { id: 'dj_songs_10', name: 'Playlist Pro', emoji: '📻', desc: 'Broadcast 10 songs as DJ', check: () => parseInt(localStorage.getItem('btc_dj_songs') || '0') >= 10, pts: 30 },
    { id: 'dj_songs_50', name: 'Jukebox Hero', emoji: '🎵', desc: 'Broadcast 50 songs as DJ', check: () => parseInt(localStorage.getItem('btc_dj_songs') || '0') >= 50, pts: 75 },
    { id: 'dj_songs_100', name: 'Vinyl Master', emoji: '🎼', desc: 'Broadcast 100 songs as DJ', check: () => parseInt(localStorage.getItem('btc_dj_songs') || '0') >= 100, pts: 400 },
    { id: 'dj_listener', name: 'Good Listener', emoji: '🔊', desc: 'Tuned in to 10 DJ sets', check: () => parseInt(localStorage.getItem('btc_dj_listens') || '0') >= 10, pts: 20 },
    { id: 'dj_listener_50', name: 'Groupie', emoji: '🤘', desc: 'Tuned in to 50 DJ sets', check: () => parseInt(localStorage.getItem('btc_dj_listens') || '0') >= 50, pts: 150 },

    // ---- Music Badges ----
    { id: 'producer_1', name: 'Producer', emoji: '🎤', desc: 'Uploaded your first song to Bitcoin Beats', check: () => parseInt(localStorage.getItem('btc_beats_uploads') || '0') >= 1, pts: 50 },
    { id: 'producer_10', name: 'Discographer', emoji: '💿', desc: 'Uploaded 10 songs to Bitcoin Beats', check: () => parseInt(localStorage.getItem('btc_beats_uploads') || '0') >= 10, pts: 100 },

    // ---- PVP Badges ----
    { id: 'pvp_first', name: 'First Blood', emoji: '🩸', desc: 'Won your first PVP battle', check: () => parseInt(localStorage.getItem('btc_pvp_wins') || '0') >= 1, pts: 25 },
    { id: 'pvp_5', name: 'Contender', emoji: '🥊', desc: 'Won 5 PVP battles', check: () => parseInt(localStorage.getItem('btc_pvp_wins') || '0') >= 5, pts: 50 },
    { id: 'pvp_25', name: 'Gladiator', emoji: '🏟️', desc: 'Won 25 PVP battles', check: () => parseInt(localStorage.getItem('btc_pvp_wins') || '0') >= 25, pts: 100 },
    { id: 'pvp_50', name: 'Champion', emoji: '🏆', desc: 'Won 50 PVP battles', check: () => parseInt(localStorage.getItem('btc_pvp_wins') || '0') >= 50, pts: 200 },
    { id: 'pvp_100', name: 'PVP Legend', emoji: '🥇', desc: 'Won 100 PVP battles', check: () => parseInt(localStorage.getItem('btc_pvp_wins') || '0') >= 100, pts: 1000 },

    // ---- Forum Badges ----
    { id: 'forum_5', name: 'Voice of the People', emoji: '📣', desc: 'Made 5 forum posts', check: () => parseInt(localStorage.getItem('btc_forum_post_count') || '0') >= 5, pts: 25 },
    { id: 'forum_25', name: 'Thought Leader', emoji: '🧠', desc: 'Made 25 forum posts', check: () => parseInt(localStorage.getItem('btc_forum_post_count') || '0') >= 25, pts: 75 },
    { id: 'article_1', name: 'Author', emoji: '✍️', desc: 'Published your first article', check: () => parseInt(localStorage.getItem('btc_articles_published') || '0') >= 1, pts: 50 },

    // ---- Streak Badges ----
    { id: 'streak_7', name: 'Week Warrior', emoji: '🔥', desc: '7-day visit streak', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.bestStreak || 0) >= 7, pts: 50 },
    { id: 'streak_30', name: 'Monthly Maxi', emoji: '🦾', desc: '30-day visit streak', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.bestStreak || 0) >= 30, pts: 150 },
    { id: 'streak_100', name: 'Diamond Hands', emoji: '💎', desc: '100-day visit streak', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.bestStreak || 0) >= 100, pts: 1000 },
    { id: 'streak_365', name: 'HODLer Supreme', emoji: '🪩', desc: '365-day visit streak', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.bestStreak || 0) >= 365, pts: 5000 },

    // ---- IRL & Community Badges ----
    { id: 'irl_host', name: 'Event Host', emoji: '🎪', desc: 'Hosted your first IRL event', check: () => parseInt(localStorage.getItem('btc_irl_hosted') || '0') >= 1, pts: 50 },
    { id: 'irl_host_5', name: 'Community Builder', emoji: '🏗️', desc: 'Hosted 5 IRL events', check: () => parseInt(localStorage.getItem('btc_irl_hosted') || '0') >= 5, pts: 150 },

    // ---- Sats Badges ----
    { id: 'sats_first', name: 'First Sats', emoji: '🪙', desc: 'Claimed your first sats from the faucet', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.satsWithdrawn || 0) >= 1, pts: 25 },
    { id: 'sats_1k', name: 'Stacker', emoji: '📦', desc: 'Claimed 1,000 sats total', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.satsWithdrawn || 0) >= 1000, pts: 100 },
    { id: 'sats_5k', name: 'Sat Whale', emoji: '🧊', desc: 'Claimed 5,000 sats total', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.satsWithdrawn || 0) >= 5000, pts: 250 },

    // ---- Prediction Badges ----
    { id: 'predict_1', name: 'Oracle', emoji: '🎱', desc: 'Made your first price prediction', check: () => _predBadgeCounts().total >= 1, pts: 10 },
    { id: 'predict_correct_5', name: 'Crystal Ball', emoji: '🏐', desc: '5 correct predictions', check: () => _predBadgeCounts().correct >= 5, pts: 75 },

    // ---- Milestone Badges ----
    { id: 'first_purchase', name: 'First Purchase', emoji: '🛒', desc: "Made your first purchase in Nacho's Nook", check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.shopPurchases || 0) >= 1, pts: 10 },
    { id: 'lightning_setup', name: 'Lightning Rod', emoji: '⚡', desc: 'Set up a Lightning wallet or added a Lightning address', check: () => localStorage.getItem('btc_lightning_setup') === 'true', pts: 100 },
    { id: 'global_citizen', name: 'Global Citizen', emoji: '🌍', desc: 'Added your country to your profile — representing Bitcoin worldwide', check: () => typeof currentUser !== 'undefined' && currentUser && !!(currentUser.country), pts: 100 },
    { id: 'bio_author', name: 'Got Something to Say', emoji: '✍️', desc: 'Added a bio to your profile', check: () => typeof currentUser !== 'undefined' && currentUser && !!(currentUser.bio && currentUser.bio.trim().length > 0), pts: 50 },
    { id: 'lightning_address_set', name: 'Zap Me', emoji: '⚡', desc: 'Added a Lightning Address to your profile', check: () => typeof currentUser !== 'undefined' && currentUser && !!(currentUser.lightningAddress || currentUser.lightning), pts: 75 },

    // ---- Profile Explorer Badges (viewing other users' profiles) ----
    { id: 'profile_curious', name: 'People Person', emoji: '👋', desc: "Opened Nacho's profile — you found the legend", check: () => { try { return !!localStorage.getItem('btc_viewed_nacho_profile'); } catch(e) { return false; } }, pts: 25 },
    { id: 'profile_explorer_5', name: 'Profile Prowler', emoji: '🕵️', desc: 'Viewed 5 user profiles', check: () => { try { return parseInt(localStorage.getItem('btc_profiles_viewed') || '0') >= 5; } catch(e) { return false; } }, pts: 50 },
    { id: 'profile_explorer_10', name: 'Social Butterfly', emoji: '🦋', desc: 'Viewed 10 user profiles', check: () => { try { return parseInt(localStorage.getItem('btc_profiles_viewed') || '0') >= 10; } catch(e) { return false; } }, pts: 75 },
    { id: 'profile_explorer_25', name: 'Community Watcher', emoji: '🔭', desc: 'Viewed 25 user profiles', check: () => { try { return parseInt(localStorage.getItem('btc_profiles_viewed') || '0') >= 25; } catch(e) { return false; } }, pts: 100 },
    { id: 'profile_explorer_50', name: 'The Networker', emoji: '🤝', desc: 'Viewed 50 user profiles', check: () => { try { return parseInt(localStorage.getItem('btc_profiles_viewed') || '0') >= 50; } catch(e) { return false; } }, pts: 150 },
    { id: 'profile_explorer_100', name: 'Archive Archivist', emoji: '📚', desc: 'Viewed 100 user profiles', check: () => { try { return parseInt(localStorage.getItem('btc_profiles_viewed') || '0') >= 100; } catch(e) { return false; } }, pts: 300 },

    // ---- Trail Badges ----
    { id: 'trail_meadow', name: 'Meadow Walker', emoji: '🌿', desc: 'Completed The Meadow trail', check: () => { try { return JSON.parse(localStorage.getItem('btc_trail_passed') || '[]').includes('meadow'); } catch(e) { return false; } }, pts: 200 },
    { id: 'trail_mountain', name: 'Mountain Climber', emoji: '⛰️', desc: 'Completed The Mountain trail', check: () => { try { return JSON.parse(localStorage.getItem('btc_trail_passed') || '[]').includes('mountain'); } catch(e) { return false; } }, pts: 400 },
    { id: 'trail_summit', name: 'Summit Conqueror', emoji: '🏔️', desc: 'Completed The Summit trail', check: () => { try { return JSON.parse(localStorage.getItem('btc_trail_passed') || '[]').includes('summit'); } catch(e) { return false; } }, pts: 750 },
    { id: 'trail_all', name: 'Trail Master', emoji: '🏁', desc: 'Completed all three Nacho\'s Trails', check: () => { try { var p = JSON.parse(localStorage.getItem('btc_trail_passed') || '[]'); return p.includes('meadow') && p.includes('mountain') && p.includes('summit'); } catch(e) { return false; } }, pts: 500 },

    // ---- Lightning Tipping Badges ----
    { id: 'tip_first', name: 'First Tip', emoji: '💸', desc: 'Sent your first Lightning tip', check: () => parseInt(localStorage.getItem('btc_tips_sent') || '0') >= 1, pts: 25 },
    { id: 'tip_10', name: 'Generous Pleb', emoji: '💛', desc: 'Tipped 10 times', check: () => parseInt(localStorage.getItem('btc_tips_sent') || '0') >= 10, pts: 75 },
    { id: 'tip_whale', name: 'Whale Tipper', emoji: '🐳', desc: 'Tipped 1,000+ sats total', check: () => parseInt(localStorage.getItem('btc_tips_total_sats') || '0') >= 1000, pts: 150 },
    { id: 'tip_magnet', name: 'Tip Magnet', emoji: '🧲', desc: 'Received 10 tips from others', check: () => parseInt(localStorage.getItem('btc_tips_received') || '0') >= 10, pts: 100 },

    // ---- Referral Badges ----
    { id: 'referral_1',   name: 'First Referral',    emoji: '🔗', desc: 'Referred 1 friend who reached Maxi rank',   check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.referralCount || 0) >= 1,   pts: 50 },
    { id: 'referral_5',   name: 'Connector',          emoji: '🤝', desc: 'Referred 5 friends who reached Maxi rank',  check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.referralCount || 0) >= 5,   pts: 100 },
    { id: 'referral_10',  name: 'Network Effect',     emoji: '🌐', desc: 'Referred 10 friends to Bitcoin education', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.referralCount || 0) >= 10,  pts: 200 },
    { id: 'referral_25',  name: 'Orange Pill Machine', emoji: '💊', desc: 'Orange-pilled 25 people via your link',    check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.referralCount || 0) >= 25,  pts: 500 },
    { id: 'referral_50',  name: 'Super Spreader',     emoji: '📡', desc: 'Referred 50 people — legend status',       check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.referralCount || 0) >= 50,  pts: 1000 },
    { id: 'referral_100', name: 'Viral Plebian',       emoji: '👑', desc: 'Referred 100 people — you are the movement', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.referralCount || 0) >= 100, pts: 2500 },
    { id: 'referred',     name: 'Referred Friend',    emoji: '🫂', desc: 'Joined Bitcoin Education Archive via a referral link', check: () => typeof currentUser !== 'undefined' && currentUser && !!(currentUser.referredBy), pts: 25 },
    { id: 'first_peer',        name: 'First Peer',       emoji: '🧡', desc: 'Connected with your first peer on the Bitcoin Education Archive', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.peerCount || 0) >= 1,   pts: 50 },
    { id: 'peer_network_10',   name: 'Node Runner',       emoji: '🕸️', desc: 'Built a peer network of 10 people',                                 check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.peerCount || 0) >= 10,  pts: 200 },
    { id: 'peer_network_50',   name: 'Signal Booster',    emoji: '📡', desc: 'Connected with 50 peers — spreading the signal',                   check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.peerCount || 0) >= 50,  pts: 500 },
    { id: 'peer_network_100',  name: 'Hub Node',          emoji: '🌐', desc: 'Connected with 100 peers — you are a hub on the network',          check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.peerCount || 0) >= 100, pts: 1000 },
    { id: 'peer_network_250',  name: 'Network Sovereign', emoji: '👑', desc: 'Connected with 250 peers — sovereign node of the Archive',         check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.peerCount || 0) >= 250, pts: 2500 },

    // ---- DM / Social Badges ----
    { id: 'dm_first', name: 'DM Starter', emoji: '✉️', desc: 'Sent your first direct message', check: () => parseInt(localStorage.getItem('btc_dms_sent') || '0') >= 1, pts: 15 },
    { id: 'react_50', name: 'Reaction King', emoji: '❤️', desc: 'Reacted to 50 messages in Global Chat', check: () => parseInt(localStorage.getItem('btc_chat_reactions') || '0') >= 50, pts: 50 },

    // ---- Prediction Streaks (expand existing) ----
    { id: 'predict_streak_3', name: 'Oracle Streak', emoji: '🎯', desc: '3 correct predictions in a row', check: () => _predBadgeCounts().bestStreak >= 3, pts: 50 },
    { id: 'predict_streak_10', name: 'Nostradamus', emoji: '🔮', desc: '10 correct predictions in a row', check: () => _predBadgeCounts().bestStreak >= 10, pts: 250 },

    // ---- Spin Wheel Badges ----
    { id: 'spin_30', name: 'Lucky Spinner', emoji: '🎰', desc: 'Spun the wheel 30 days total', check: () => parseInt(localStorage.getItem('btc_spin_count') || '0') >= 30, pts: 75 },
    { id: 'spin_streak_7', name: 'Spin Streak', emoji: '🎡', desc: 'Spun 7 days in a row', check: () => parseInt(localStorage.getItem('btc_spin_streak') || '0') >= 7, pts: 50 },
    { id: 'spin_jackpot', name: 'Jackpot Winner', emoji: '🌟', desc: 'Hit the RARE drop on the spin wheel', check: () => localStorage.getItem('btc_spin_hit_rare') === 'true', pts: 100 },

    // ---- Double Scholar Badge ----
    { id: 'cert_double', name: 'Double Scholar', emoji: '🏛️', desc: 'Earned both Scholar AND Protocol Expert certifications', check: () => localStorage.getItem('btc_scholar_prop_passed') === 'true' && localStorage.getItem('btc_scholar_tech_passed') === 'true', pts: 250 },

    // ---- Satoshi's Favor Mining Badges ----
    { id: 'sf_first_hash', name: 'First Hash', emoji: '⛏️', desc: 'Generated your first hash during Satoshi\'s Favor', check: () => parseInt(localStorage.getItem('btc_sf_hashes') || '0') >= 1, pts: 10 },
    { id: 'sf_10_hashes', name: 'Pickaxe Swinger', emoji: '💥', desc: 'Generated 10 hashes during Satoshi\'s Favor', check: () => parseInt(localStorage.getItem('btc_sf_hashes') || '0') >= 10, pts: 25 },
    { id: 'sf_50_hashes', name: 'Mine Foreman', emoji: '🪨', desc: 'Generated 50 hashes during Satoshi\'s Favor', check: () => parseInt(localStorage.getItem('btc_sf_hashes') || '0') >= 50, pts: 75 },
    { id: 'sf_100_hashes', name: 'Hash Machine', emoji: '🔩', desc: 'Generated 100 hashes during Satoshi\'s Favor', check: () => parseInt(localStorage.getItem('btc_sf_hashes') || '0') >= 100, pts: 150 },
    { id: 'sf_500_hashes', name: 'ASIC Mode', emoji: '🖥️', desc: 'Generated 500 hashes during Satoshi\'s Favor', check: () => parseInt(localStorage.getItem('btc_sf_hashes') || '0') >= 500, pts: 500 },
    { id: 'sf_1000_hashes', name: 'Mining Rig', emoji: '🏭', desc: 'Generated 1,000 hashes during Satoshi\'s Favor', check: () => parseInt(localStorage.getItem('btc_sf_hashes') || '0') >= 1000, pts: 1000 },
    { id: 'sf_10000_hashes', name: 'Hash Lord', emoji: '☄️', desc: 'Generated 10,000 hashes during Satoshi\'s Favor', check: () => parseInt(localStorage.getItem('btc_sf_hashes') || '0') >= 10000, pts: 2100 },
    { id: 'sf_100000_hashes', name: 'Hash God', emoji: '⚡', desc: 'Generated 100,000 hashes during Satoshi\'s Favor', check: () => parseInt(localStorage.getItem('btc_sf_hashes') || '0') >= 100000, pts: 10000 },
    { id: 'sf_low_hash', name: 'Lucky Strike', emoji: '⭐', desc: 'Mined a hash under 1,000,000', check: () => parseInt(localStorage.getItem('btc_sf_best_hash') || '999999999') < 1000000, pts: 50 },
    { id: 'sf_ultra_low', name: 'Golden Nonce', emoji: '✨', desc: 'Mined a hash under 100,000', check: () => parseInt(localStorage.getItem('btc_sf_best_hash') || '999999999') < 100000, pts: 200 },
    { id: 'sf_block_solver', name: 'Block Solver', emoji: '🌞', desc: 'Solved a block! Hash under the difficulty target', check: () => localStorage.getItem('btc_sf_solved_block') === 'true', pts: 1000 },
    { id: 'sf_contributor', name: 'Community Miner', emoji: '🤝', desc: 'Contributed to activating Satoshi\'s Favor 3 times', check: () => parseInt(localStorage.getItem('btc_sf_activations') || '0') >= 3, pts: 50 },
    { id: 'sf_contributor_10', name: 'Favor Champion', emoji: '🏅', desc: 'Contributed to activating Satoshi\'s Favor 10 times', check: () => parseInt(localStorage.getItem('btc_sf_activations') || '0') >= 10, pts: 200 },

    // ---- Lucky Miner Badges (hash < 1,000,000) ----
    { id: 'sf_lucky_1',    name: 'Lucky Roll',      emoji: '🎰', desc: 'Mined a lucky hash (under 1,000,000) 1 time',      check: () => parseInt(localStorage.getItem('btc_sf_lucky_count') || '0') >= 1,    pts: 25 },
    { id: 'sf_lucky_5',    name: 'Hot Streak',      emoji: '🔥', desc: 'Mined a lucky hash (under 1,000,000) 5 times',     check: () => parseInt(localStorage.getItem('btc_sf_lucky_count') || '0') >= 5,    pts: 75 },
    { id: 'sf_lucky_10',   name: 'Clover Nonce',    emoji: '🍀', desc: 'Mined a lucky hash (under 1,000,000) 10 times',    check: () => parseInt(localStorage.getItem('btc_sf_lucky_count') || '0') >= 10,   pts: 150 },
    { id: 'sf_lucky_50',   name: 'Fortune Miner',   emoji: '🪄', desc: 'Mined a lucky hash (under 1,000,000) 50 times',    check: () => parseInt(localStorage.getItem('btc_sf_lucky_count') || '0') >= 50,   pts: 400 },
    { id: 'sf_lucky_100',  name: 'Blessed Nonce',   emoji: '✨',       desc: 'Mined a lucky hash (under 1,000,000) 100 times',   check: () => parseInt(localStorage.getItem('btc_sf_lucky_count') || '0') >= 100,  pts: 750 },
    { id: 'sf_lucky_1000', name: 'Satoshi\'s Chosen', emoji: '💎', desc: 'Mined a lucky hash (under 1,000,000) 1,000 times', check: () => parseInt(localStorage.getItem('btc_sf_lucky_count') || '0') >= 1000, pts: 2100 },

    // ---- Unlucky Miner Badges (hash > 99,000,000) ----
    { id: 'sf_unlucky_1',    name: 'Off the Mark',      emoji: '💨', desc: 'Mined an unlucky hash (over 99,000,000) 1 time',      check: () => parseInt(localStorage.getItem('btc_sf_unlucky_count') || '0') >= 1,    pts: 15 },
    { id: 'sf_unlucky_5',    name: 'Cold Streak',        emoji: '🧊', desc: 'Mined an unlucky hash (over 99,000,000) 5 times',     check: () => parseInt(localStorage.getItem('btc_sf_unlucky_count') || '0') >= 5,    pts: 40 },
    { id: 'sf_unlucky_10',   name: 'Wrong Side of Zero', emoji: '🚫', desc: 'Mined an unlucky hash (over 99,000,000) 10 times',    check: () => parseInt(localStorage.getItem('btc_sf_unlucky_count') || '0') >= 10,   pts: 75 },
    { id: 'sf_unlucky_50',   name: 'Perpetual Loser',    emoji: '💔', desc: 'Mined an unlucky hash (over 99,000,000) 50 times',    check: () => parseInt(localStorage.getItem('btc_sf_unlucky_count') || '0') >= 50,   pts: 200 },
    { id: 'sf_unlucky_100',  name: 'Cursed Miner',       emoji: '⚰️',  desc: 'Mined an unlucky hash (over 99,000,000) 100 times',   check: () => parseInt(localStorage.getItem('btc_sf_unlucky_count') || '0') >= 100,  pts: 400 },
    { id: 'sf_unlucky_1000', name: 'Proof of Pain',      emoji: '🕱️',  desc: 'Mined an unlucky hash (over 99,000,000) 1,000 times', check: () => parseInt(localStorage.getItem('btc_sf_unlucky_count') || '0') >= 1000, pts: 1000 },

    // ---- Raid Boss Badges ----
    { id: 'raid_first', name: 'Raid Recruit', emoji: '🛡️', desc: 'Dealt damage to your first Raid Boss', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.raidDamageAllTime || 0) >= 1, pts: 10 },
    { id: 'raid_5', name: 'Raid Warrior', emoji: '🗡️', desc: 'Dealt 5 total raid damage', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.raidDamageAllTime || 0) >= 5, pts: 50 },
    { id: 'raid_10', name: 'Raid Veteran', emoji: '⚙️', desc: 'Dealt 10 total raid damage', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.raidDamageAllTime || 0) >= 10, pts: 100 },
    { id: 'raid_25', name: 'Raid Commander', emoji: '⚜️', desc: 'Dealt 25 total raid damage', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.raidDamageAllTime || 0) >= 25, pts: 250 },
    { id: 'raid_50', name: 'Raid Legend', emoji: '👑', desc: 'Dealt 50 total raid damage', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.raidDamageAllTime || 0) >= 50, pts: 750 },
    { id: 'raid_100', name: 'Raid Warlord', emoji: '🔱', desc: 'Dealt 100 total raid damage', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.raidDamageAllTime || 0) >= 100, pts: 1500 },
    { id: 'raid_boss_slayer', name: 'Boss Slayer', emoji: '💀', desc: 'Participated in defeating a Raid Boss', check: () => parseInt(localStorage.getItem('btc_raid_bosses_defeated') || '0') >= 1, pts: 50 },
    { id: 'raid_boss_slayer_5', name: 'Boss Hunter', emoji: '🐉', desc: 'Participated in defeating 5 Raid Bosses', check: () => parseInt(localStorage.getItem('btc_raid_bosses_defeated') || '0') >= 5, pts: 150 },
    { id: 'raid_boss_slayer_10', name: 'Dragon Slayer', emoji: '🐲', desc: 'Participated in defeating 10 Raid Bosses', check: () => parseInt(localStorage.getItem('btc_raid_bosses_defeated') || '0') >= 10, pts: 500 },
    { id: 'raid_winner', name: 'Raid Champion', emoji: '🎖️', desc: 'Won the sats lottery after a Raid Boss defeat', check: () => localStorage.getItem('btc_raid_winner') === 'true', pts: 250 },

    // ---- Trivia ----
    { id: 'trivia_first', name: 'Quiz Curious', emoji: '🧠', desc: 'Answered your first daily trivia question', check: () => { try { var s = JSON.parse(localStorage.getItem('btc_trivia_state') || '{}'); return !!s.date; } catch(e) { return false; } }, pts: 10 },
    { id: 'trivia_correct_1', name: 'Trivia Warm-Up', emoji: '✅', desc: 'Got your first trivia question correct', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.triviaCorrect || 0) >= 1, pts: 15 },
    { id: 'trivia_correct_10', name: 'Fact Checker', emoji: '🔎', desc: 'Got 10 trivia questions correct', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.triviaCorrect || 0) >= 10, pts: 30 },
    { id: 'trivia_correct_30', name: 'Big Brain', emoji: '🦾', desc: 'Got 30 trivia questions correct', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.triviaCorrect || 0) >= 30, pts: 75 },
    { id: 'trivia_correct_100', name: 'Trivia Titan', emoji: '🏅', desc: 'Got 100 trivia questions correct — absolute Bitcoin scholar', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.triviaCorrect || 0) >= 100, pts: 500 },
    { id: 'trivia_streak_7', name: 'Daily Habit', emoji: '📆', desc: 'Answered trivia 7 days in a row', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.triviaStreak || 0) >= 7, pts: 50 },
    { id: 'trivia_streak_30', name: 'Trivia Devotee', emoji: '🔱', desc: 'Answered trivia 30 days in a row', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.triviaStreak || 0) >= 30, pts: 300 },

    // ---- Daily Poll ----
    { id: 'poll_first', name: 'Opinionated', emoji: '🗳️', desc: 'Cast your first vote in the daily poll', check: () => { try { var s = JSON.parse(localStorage.getItem('btc_poll_state') || '{}'); return !!s.date; } catch(e) { return false; } }, pts: 10 },
    { id: 'poll_10', name: 'Regular Voter', emoji: '🗓️', desc: 'Voted in 10 daily polls', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.pollsVoted || 0) >= 10, pts: 25 },
    { id: 'poll_50', name: 'Civic Plebian', emoji: '🏛️', desc: 'Voted in 50 daily polls', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.pollsVoted || 0) >= 50, pts: 100 },
    { id: 'poll_100', name: 'Democracy Maxi', emoji: '⚖️', desc: 'Voted in 100 daily polls — never missed an opinion', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.pollsVoted || 0) >= 100, pts: 400 },

    // ---- Daily All-Three ----
    { id: 'daily_triple_1', name: 'Triple Play', emoji: '🎯', desc: 'Completed quiz, trivia AND poll in one day', check: () => { try { var s = JSON.parse(localStorage.getItem('btc_daily_activities') || '{}'); return !!(s.sfAwarded); } catch(e) { return false; } }, pts: 25 },
    { id: 'daily_triple_7', name: 'Consistent Stacker', emoji: '📚', desc: 'Completed the Daily Trifecta 7 times', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.dailyTripleCount || 0) >= 7, pts: 100 },
    { id: 'daily_triple_30', name: 'Unstoppable', emoji: '🚂', desc: 'Completed the Daily Trifecta 30 times', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.dailyTripleCount || 0) >= 30, pts: 500 },
    { id: 'daily_triple_90', name: 'Trifecta Legend', emoji: '🏆', desc: 'Completed the Daily Trifecta 90 times', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.dailyTripleCount || 0) >= 90, pts: 1500 },
    { id: 'daily_triple_365', name: 'Satoshi\'s Disciple', emoji: '🟠', desc: 'Completed the Daily Trifecta 365 times', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.dailyTripleCount || 0) >= 365, pts: 5000 },

    // ---- Marketplace ----
    { id: 'market_browse', name: 'Window Shopper', emoji: '🛍️', desc: 'Visited the Lightning Marketplace', check: () => localStorage.getItem('btc_market_rules_accepted') === 'true', pts: 10 },
    { id: 'market_listed_1', name: 'Vendor', emoji: '🏪', desc: 'Listed your first item in the Marketplace', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.marketListings || 0) >= 1, pts: 30 },
    { id: 'market_listed_5', name: 'Merchant', emoji: '💼', desc: 'Listed 5 items in the Marketplace', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.marketListings || 0) >= 5, pts: 75 },
    { id: 'market_saved_5', name: 'Wishlist', emoji: '❤️‍🔥', desc: 'Saved 5 items in the Marketplace', check: () => { try { return (JSON.parse(localStorage.getItem('btc_market_saved') || '[]')).length >= 5; } catch(e) { return false; } }, pts: 15 },
    { id: 'market_message', name: 'Dealmaker', emoji: '🤜', desc: 'Sent your first Marketplace message to a seller', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.marketMessages || 0) >= 1, pts: 20 },

    // ---- Bookmarks & Favorites ----
    { id: 'bookmarks_1', name: 'Earmarked', emoji: '🔖', desc: 'Bookmarked your first article', check: () => { try { return (JSON.parse(localStorage.getItem('btc_bookmarks') || '[]')).length >= 1; } catch(e) { return false; } }, pts: 10 },
    { id: 'bookmarks_10', name: 'Archivist', emoji: '🗄️', desc: 'Bookmarked 10 articles', check: () => { try { return (JSON.parse(localStorage.getItem('btc_bookmarks') || '[]')).length >= 10; } catch(e) { return false; } }, pts: 30 },
    { id: 'favs_10', name: 'Curator', emoji: '🧹', desc: 'Saved 10 topics to favorites', check: () => { try { return (JSON.parse(localStorage.getItem('btc_favs') || '[]')).length >= 10; } catch(e) { return false; } }, pts: 25 },
    { id: 'favs_25', name: 'Collection', emoji: '🗂️', desc: 'Saved 25 topics to favorites', check: () => { try { return (JSON.parse(localStorage.getItem('btc_favs') || '[]')).length >= 25; } catch(e) { return false; } }, pts: 75 },

    // ---- DMs & Social ----
    { id: 'dm_10', name: 'Inbox Zero', emoji: '📥', desc: 'Sent 10 direct messages', check: () => parseInt(localStorage.getItem('btc_dms_sent') || '0') >= 10, pts: 25 },
    { id: 'dm_buddy', name: 'Buddy Up', emoji: '🫂', desc: 'Matched with a Bitcoin learning buddy', check: () => localStorage.getItem('btc_buddy_matched') === 'true', pts: 30 },
    { id: 'react_5', name: 'Reactor', emoji: '⚡', desc: 'Reacted to 5 messages in Global Chat', check: () => parseInt(localStorage.getItem('btc_chat_reactions') || '0') >= 5, pts: 10 },
    { id: 'react_200', name: 'Emoji Sensei', emoji: '🧘', desc: 'Reacted to 200 messages in Global Chat', check: () => parseInt(localStorage.getItem('btc_chat_reactions') || '0') >= 200, pts: 150 },
    { id: 'tip_sats_10k', name: 'Sat Slinger', emoji: '💰', desc: 'Tipped 10,000+ sats total', check: () => parseInt(localStorage.getItem('btc_tips_total_sats') || '0') >= 10000, pts: 300 },
    { id: 'tip_received_1', name: 'Tip Received', emoji: '🎁', desc: 'Received your first tip from another user', check: () => parseInt(localStorage.getItem('btc_tips_received') || '0') >= 1, pts: 20 },
    { id: 'tip_received_50', name: 'Community Darling', emoji: '🌟', desc: 'Received 50 tips from others', check: () => parseInt(localStorage.getItem('btc_tips_received') || '0') >= 50, pts: 500 },

    // ---- Price Predictions ----
    { id: 'predict_10', name: 'Market Watcher', emoji: '📊', desc: 'Made 10 price predictions', check: () => _predBadgeCounts().total >= 10, pts: 25 },
    { id: 'predict_50', name: 'Chartist', emoji: '📈', desc: 'Made 50 price predictions', check: () => _predBadgeCounts().total >= 50, pts: 75 },
    { id: 'predict_correct_25', name: 'Pattern Reader', emoji: '🌊', desc: '25 correct price predictions', check: () => _predBadgeCounts().correct >= 25, pts: 200 },
    { id: 'predict_correct_100', name: 'Time Traveler', emoji: '⏳', desc: '100 correct price predictions — you can see the future', check: () => _predBadgeCounts().correct >= 100, pts: 750 },

    // ---- IRL Attendance ----
    { id: 'irl_attend_1', name: 'Show Up', emoji: '📍', desc: 'RSVPed to your first IRL event', check: () => parseInt(localStorage.getItem('btc_irl_attended') || '0') >= 1, pts: 25 },
    { id: 'irl_attend_5', name: 'Scene Regular', emoji: '🗺️', desc: 'Attended 5 IRL Bitcoin events', check: () => parseInt(localStorage.getItem('btc_irl_attended') || '0') >= 5, pts: 100 },
    { id: 'irl_host_10', name: 'Regional Leader', emoji: '🌆', desc: 'Hosted 10 IRL Bitcoin events', check: () => parseInt(localStorage.getItem('btc_irl_hosted') || '0') >= 10, pts: 500 },

    // ---- Bitcoin Beats listening ----
    { id: 'beats_first_listen', name: 'First Listen', emoji: '🎵', desc: 'Listened to your first track on Bitcoin Beats', check: () => parseInt(localStorage.getItem('btc_beats_play_count') || '0') >= 1, pts: 10 },
    { id: 'beats_50_plays', name: 'Audiophile', emoji: '🎧', desc: 'Played 50 tracks on Bitcoin Beats', check: () => parseInt(localStorage.getItem('btc_beats_play_count') || '0') >= 50, pts: 30 },
    { id: 'beats_liked_10', name: 'Music Fan', emoji: '🩷', desc: 'Liked 10 tracks on Bitcoin Beats', check: () => { try { return (JSON.parse(localStorage.getItem('btc_beats_liked') || '[]')).length >= 10; } catch(e) { return false; } }, pts: 20 },
    { id: 'beats_liked_50', name: 'Taste Maker', emoji: '🎼', desc: 'Liked 50 tracks on Bitcoin Beats', check: () => { try { return (JSON.parse(localStorage.getItem('btc_beats_liked') || '[]')).length >= 50; } catch(e) { return false; } }, pts: 75 },

    // ---- Nacho ----
    { id: 'nacho_asked_10', name: 'Curious', emoji: '🤔', desc: 'Asked Nacho 10 questions', check: () => parseInt(localStorage.getItem('btc_nacho_sent') || '0') >= 10, pts: 15 },
    { id: 'nacho_asked_100', name: 'Nacho Scholar', emoji: '🦌', desc: 'Asked Nacho 100 questions', check: () => parseInt(localStorage.getItem('btc_nacho_sent') || '0') >= 100, pts: 75 },
    { id: 'nacho_whisper', name: 'Nacho\'s Confidant', emoji: '🤫', desc: 'Interacted with Nacho 500+ times', check: () => parseInt(localStorage.getItem('btc_nacho_interactions') || '0') >= 500, pts: 500 },
    { id: 'nacho_eli5', name: 'ELI5 Mode', emoji: '👶', desc: 'Used Explain it Like I\'m 5 mode with Nacho', check: () => parseInt(localStorage.getItem('btc_nacho_eli5') || '0') >= 1, pts: 10 },
    // Nacho's Story
    { id: 'story_begun', name: 'Story Begun', emoji: '📖', desc: 'Read Chapter 1 of Nacho\'s Story — the Genesis Block', check: () => { try { return safeJSON('btc_nacho_story_awarded', []).length >= 1; } catch(e) { return false; } }, pts: 15 },
    { id: 'story_halfway', name: 'Halfway There', emoji: '🎙️', desc: 'Read 4 chapters of Nacho\'s Story', check: () => { try { return safeJSON('btc_nacho_story_awarded', []).length >= 4; } catch(e) { return false; } }, pts: 50 },
    { id: 'story_complete', name: 'Story Master', emoji: '🦧📚', desc: 'Completed all 7 chapters of Nacho\'s Story', check: () => { try { return safeJSON('btc_nacho_story_awarded', []).length >= 7; } catch(e) { return false; } }, pts: 150 },

    // ---- Sats milestones ----
    { id: 'sats_10k', name: 'Sat Hoarder', emoji: '🏦', desc: 'Claimed 10,000 sats total from the faucet', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.satsWithdrawn || 0) >= 10000, pts: 500 },
    { id: 'sats_21k', name: '21 Million Dreams', emoji: '₿', desc: 'Claimed 21,000 sats — because 21 million is the magic number', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.satsWithdrawn || 0) >= 21000, pts: 2100, hidden: false },

    // ---- Streak milestones (fill the gap between 30 and 100) ----
    { id: 'streak_14', name: 'Two Weeks Strong', emoji: '📅', desc: '14-day visit streak', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.bestStreak || 0) >= 14, pts: 75 },
    { id: 'streak_60', name: 'Two Month Maxi', emoji: '🗓️', desc: '60-day visit streak', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.bestStreak || 0) >= 60, pts: 400 },
    { id: 'streak_200', name: 'Sovereign Individual', emoji: '🗽', desc: '200-day visit streak — this is dedication', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.bestStreak || 0) >= 200, pts: 2100 },

    // ---- Very Difficult ----
    { id: 'all_certs', name: 'Grand Scholar', emoji: '🎓', desc: 'Earned all three Bitcoin certifications (Scholar, Protocol Expert, and all Trails)', check: () => localStorage.getItem('btc_scholar_prop_passed') === 'true' && localStorage.getItem('btc_scholar_tech_passed') === 'true' && (function(){ try { var p = JSON.parse(localStorage.getItem('btc_trail_passed') || '[]'); return p.includes('meadow') && p.includes('mountain') && p.includes('summit'); } catch(e) { return false; } })(), pts: 1500 },
    { id: 'jack_of_all', name: 'Jack of All Trades', emoji: '🃏', desc: 'Earned at least one badge in every major category', check: () => {
        var b = JSON.parse(localStorage.getItem('btc_badges') || '[]');
        var has = function(ids) { return ids.some(function(id) { return b.indexOf(id) !== -1; }); };
        return has(['quest_1','quest_3','quest_5','quest_10','quest_25','quest_50','quest_100'])
            && has(['chat_first','chat_10','chat_50','chat_100','chat_500'])
            && has(['pvp_first','pvp_5','pvp_25','pvp_50','pvp_100'])
            && has(['tctv_tuned_in','tctv_couch_potato','tctv_binge_watcher','tctv_couch_king','tctv_satellite'])
            && has(['sf_first_hash','sf_10_hashes','sf_50_hashes','sf_100_hashes','sf_500_hashes','sf_1000_hashes','sf_10000_hashes','sf_100000_hashes'])
            && has(['raid_first','raid_5','raid_10','raid_25','raid_50','raid_100'])
            && has(['tip_first','tip_10','tip_whale'])
            && has(['streak_7','streak_30','streak_100']);
    }, pts: 3000 },
    // FLEX badges (total actions across all categories)
    { id: 'flex_rookie',    name: 'Healthy Start',     emoji: '🌱', desc: 'Completed 10 Flex actions total',    check: () => { try { var s=JSON.parse(localStorage.getItem('btc_flex_state')||'{}'); return Object.values(s).reduce(function(acc,v){return acc+(v.total||0);},0)>=10;  } catch(e){return false;} }, pts: 25 },
    { id: 'flex_committed', name: 'Committed',          emoji: '💪', desc: 'Completed 50 Flex actions total',    check: () => { try { var s=JSON.parse(localStorage.getItem('btc_flex_state')||'{}'); return Object.values(s).reduce(function(acc,v){return acc+(v.total||0);},0)>=50;  } catch(e){return false;} }, pts: 75 },
    { id: 'flex_athlete',   name: 'Bitcoin Athlete',   emoji: '🏅', desc: 'Completed 200 Flex actions total',   check: () => { try { var s=JSON.parse(localStorage.getItem('btc_flex_state')||'{}'); return Object.values(s).reduce(function(acc,v){return acc+(v.total||0);},0)>=200; } catch(e){return false;} }, pts: 200 },
    { id: 'flex_legend',    name: 'Flex Legend',       emoji: '🦁', desc: 'Completed 1,000 Flex actions total', check: () => { try { var s=JSON.parse(localStorage.getItem('btc_flex_state')||'{}'); return Object.values(s).reduce(function(acc,v){return acc+(v.total||0);},0)>=1000;} catch(e){return false;} }, pts: 1000 },
    { id: 'flex_all_once',  name: 'Full Stack Human',  emoji: '🧬', desc: 'Completed every Flex action at least once', check: () => { try { var s=JSON.parse(localStorage.getItem('btc_flex_state')||'{}'); var ids=['steak','sunlight','dca','custody','lift','meetup','lightning','read','sleep','nokyc','node','cold','fast','walk','journal','meditate','teach','water','gratitude','verify']; return ids.every(function(id){return s[id]&&s[id].total>=1;}); } catch(e){return false;} }, pts: 150 },
    { id: 'hall_of_fame', name: 'Chancellor on Brink', emoji: '📰', desc: 'Earned 50 distinct badges — Chancellor on brink of second bailout for banks', check: () => (JSON.parse(localStorage.getItem('btc_badges') || '[]')).length >= 50, pts: 5000, hidden: false },
    { id: 'the_archive', name: 'The Archivist', emoji: '🏛️', desc: 'Earned 100 distinct badges — you don\'t just use the Archive, you are it', check: () => (JSON.parse(localStorage.getItem('btc_badges') || '[]')).length >= 100, pts: 10000, hidden: false },
    { id: 'genesis_block', name: 'Hall of Fame', emoji: '🏆', desc: 'Earned 150 distinct badges — a true legend of the Archive', check: () => (JSON.parse(localStorage.getItem('btc_badges') || '[]')).length >= 150, pts: 15000, hidden: false },
    { id: 'satoshis_ghost', name: "Satoshi's Revenge", emoji: '⚔️', desc: 'Earned 200 distinct badges — the network never forgets', check: () => (JSON.parse(localStorage.getItem('btc_badges') || '[]')).length >= 200, pts: 21000, hidden: false },
    { id: 'block_250', name: "Satoshi's Vendetta", emoji: '🗡️', desc: 'Earned 250 distinct badges — deeper than most will ever go', check: () => (JSON.parse(localStorage.getItem('btc_badges') || '[]')).length >= 250, pts: 25000, hidden: false },
    { id: 'the_hodler', name: "Satoshi's Ghost", emoji: '👻', desc: 'Earned 300 distinct badges — so rare, nobody knows if it has ever been done', check: () => (JSON.parse(localStorage.getItem('btc_badges') || '[]')).length >= 300, pts: 30000, hidden: false },
    { id: 'satoshis_covenant', name: "Satoshi's Covenant", emoji: '📜', desc: 'Earned 350 distinct badges — bound to the protocol, forever', check: () => (JSON.parse(localStorage.getItem('btc_badges') || '[]')).length >= 350, pts: 42000, hidden: false },
    { id: 'satoshis_cipher', name: "Satoshi's Cipher", emoji: '🔐', desc: 'Earned 400 distinct badges — you have cracked something most never will', check: () => (JSON.parse(localStorage.getItem('btc_badges') || '[]')).length >= 400, pts: 100000, hidden: false },

    // ---- Fun: date/time-based ----
    { id: 'fun_weekend',          name: 'Weekend Warrior',    emoji: '🏖️',  desc: 'Visited on a Saturday or Sunday',                                    check: () => [0,6].includes(new Date().getDay()),                                                              pts: 10 },
    { id: 'fun_friday',           name: 'TGIF Pleb',          emoji: '🍕',  desc: 'Visited on a Friday',                                                 check: () => new Date().getDay() === 5,                                                                        pts: 10 },
    { id: 'fun_midnight',         name: 'Midnight Maxi',      emoji: '🌕',  desc: 'Visited right at midnight (12:00 AM)',                                 check: () => new Date().getHours() === 0 && new Date().getMinutes() < 30,                                      pts: 15 },
    { id: 'fun_bitcoin_birthday', name: 'Bitcoin Birthday',   emoji: '🎂',  desc: 'Visited on Jan 3 — Genesis Block Day',                                check: () => new Date().getMonth() === 0 && new Date().getDate() === 3,                                        pts: 100 },
    { id: 'fun_whitepaper_day',   name: 'Whitepaper Day',     emoji: '📜',  desc: 'Visited on Oct 31 — Bitcoin Whitepaper Anniversary',                  check: () => new Date().getMonth() === 9 && new Date().getDate() === 31,                                       pts: 75 },
    { id: 'fun_new_year',         name: 'New Year Stacker',   emoji: '🎆',  desc: 'Visited on January 1st',                                              check: () => new Date().getMonth() === 0 && new Date().getDate() === 1,                                        pts: 50 },
    { id: 'fun_halving_day',      name: 'Halving Day',        emoji: '✂️',  desc: 'Visited on April 20 — the spirit of the halving',                     check: () => new Date().getMonth() === 3 && new Date().getDate() === 20,                                       pts: 100 },
    { id: 'fun_pi_day',           name: 'Pi Day Pleb',        emoji: '🥧',  desc: 'Visited on March 14 (3.14) — Bitcoiners appreciate irrational numbers too', check: () => new Date().getMonth() === 2 && new Date().getDate() === 14,                                    pts: 21 },

    // ---- Forum: first post, tiers, replies, articles ----
    { id: 'forum_first',     name: 'First Post',      emoji: '📝', desc: 'Made your first forum post',           check: () => parseInt(localStorage.getItem('btc_forum_post_count') || '0') >= 1,   pts: 15 },
    { id: 'forum_10',        name: 'Active Voice',    emoji: '🗣️', desc: 'Made 10 forum posts',                  check: () => parseInt(localStorage.getItem('btc_forum_post_count') || '0') >= 10,  pts: 40 },
    { id: 'forum_50',        name: 'Prolific Poster', emoji: '✍️', desc: 'Made 50 forum posts',                  check: () => parseInt(localStorage.getItem('btc_forum_post_count') || '0') >= 50,  pts: 150 },
    { id: 'forum_100',       name: 'Forum Legend',    emoji: '🏛️', desc: 'Made 100 forum posts',                 check: () => parseInt(localStorage.getItem('btc_forum_post_count') || '0') >= 100, pts: 400 },
    { id: 'article_5',       name: 'Journalist',      emoji: '📰', desc: 'Published 5 articles',                 check: () => parseInt(localStorage.getItem('btc_articles_published') || '0') >= 5,  pts: 150 },
    { id: 'article_10',      name: 'Staff Writer',    emoji: '🗞️', desc: 'Published 10 articles',                check: () => parseInt(localStorage.getItem('btc_articles_published') || '0') >= 10, pts: 400 },
    { id: 'forum_reply_1',   name: 'Responder',       emoji: '💬', desc: 'Left your first forum reply',          check: () => parseInt(localStorage.getItem('btc_forum_reply_count') || '0') >= 1,  pts: 10 },
    { id: 'forum_reply_10',  name: 'Commentator',     emoji: '🗣️', desc: 'Left 10 forum replies',                check: () => parseInt(localStorage.getItem('btc_forum_reply_count') || '0') >= 10, pts: 40 },

    // ---- Spin Wheel: full tier set ----
    { id: 'spin_1',          name: 'First Spin',       emoji: '🎰', desc: 'Spun the wheel for the first time',    check: () => parseInt(localStorage.getItem('btc_spin_count') || '0') >= 1,   pts: 10 },
    { id: 'spin_7',          name: 'Spin Week',        emoji: '🌀', desc: 'Spun 7 days total',                    check: () => parseInt(localStorage.getItem('btc_spin_count') || '0') >= 7,   pts: 20 },
    { id: 'spin_streak_14',  name: 'Fortnight Spinner',emoji: '🔄', desc: 'Spun 14 days in a row',               check: () => parseInt(localStorage.getItem('btc_spin_streak') || '0') >= 14, pts: 75 },
    { id: 'spin_streak_30',  name: 'Wheel Addict',     emoji: '🎡', desc: 'Spun 30 days in a row',               check: () => parseInt(localStorage.getItem('btc_spin_streak') || '0') >= 30, pts: 200 },
    { id: 'spin_100',        name: 'Century Spinner',  emoji: '🏅', desc: 'Spun the wheel 100 days total',        check: () => parseInt(localStorage.getItem('btc_spin_count') || '0') >= 100, pts: 250 },
    { id: 'spin_closet_1',   name: 'Dressed to Impress',emoji: '👔', desc: 'Won your first closet item from the spin', check: () => { try { return (JSON.parse(localStorage.getItem('btc_spin_closet_items') || '[]')).length >= 1; } catch(e) { return false; } }, pts: 50 },
    { id: 'spin_closet_5',   name: 'Full Wardrobe',    emoji: '🌈', desc: 'Won 5 closet items from spins',        check: () => { try { return (JSON.parse(localStorage.getItem('btc_spin_closet_items') || '[]')).length >= 5; } catch(e) { return false; } }, pts: 150 },

    // ---- Trails: additional tier ----
    { id: 'trail_started',   name: 'On the Trail',    emoji: '🌱', desc: 'Attempted your first Nacho\'s Trail quiz', check: () => { try { return JSON.parse(localStorage.getItem('btc_trail_passed') || '[]').length >= 1 || !!localStorage.getItem('btc_trail_started'); } catch(e) { return false; } }, pts: 25 },
    { id: 'trail_meadow_fast',name: 'Speed Hiker',    emoji: '⚡', desc: 'Completed The Meadow trail',             check: () => { try { return JSON.parse(localStorage.getItem('btc_trail_passed') || '[]').includes('meadow'); } catch(e) { return false; } }, pts: 50 },
    { id: 'trail_double',    name: 'Double Summit',   emoji: '🏔️', desc: 'Completed two Nacho\'s Trails',         check: () => { try { var p=JSON.parse(localStorage.getItem('btc_trail_passed')||'[]'); return p.length>=2; } catch(e){return false;} }, pts: 100 },
    { id: 'trail_perfectionist', name: 'No Shortcuts',emoji: '🧠', desc: 'Completed The Summit trail',             check: () => { try { return JSON.parse(localStorage.getItem('btc_trail_passed') || '[]').includes('summit'); } catch(e) { return false; } }, pts: 75 },
    { id: 'trail_speed_3',   name: 'Speedrunner',     emoji: '🏁', desc: 'Completed all three trails',             check: () => { try { var p=JSON.parse(localStorage.getItem('btc_trail_passed')||'[]'); return p.includes('meadow')&&p.includes('mountain')&&p.includes('summit'); } catch(e){return false;} }, pts: 150 },
    { id: 'trail_revisit',   name: 'Back for More',   emoji: '🔁', desc: 'Retook a trail you already passed',      check: () => parseInt(localStorage.getItem('btc_trail_retakes') || '0') >= 1, pts: 30 },

    // ---- PVP: played count + win streak ----
    { id: 'pvp_played_1',     name: 'Challenger',     emoji: '🥋', desc: 'Played your first PVP battle',           check: () => (parseInt(localStorage.getItem('btc_pvp_wins') || '0') + parseInt(localStorage.getItem('btc_pvp_losses') || '0')) >= 1,  pts: 10 },
    { id: 'pvp_played_10',    name: 'Battle Tested',   emoji: '🪖', desc: 'Played 10 PVP battles',                  check: () => (parseInt(localStorage.getItem('btc_pvp_wins') || '0') + parseInt(localStorage.getItem('btc_pvp_losses') || '0')) >= 10, pts: 25 },
    { id: 'pvp_played_50',    name: 'Battle Hardened', emoji: '⚔️', desc: 'Played 50 PVP battles',                  check: () => (parseInt(localStorage.getItem('btc_pvp_wins') || '0') + parseInt(localStorage.getItem('btc_pvp_losses') || '0')) >= 50, pts: 75 },
    { id: 'pvp_win_streak_3', name: 'Hot Streak',      emoji: '🔥', desc: 'Won 3 PVP battles in a row',              check: () => parseInt(localStorage.getItem('btc_pvp_win_streak') || '0') >= 3, pts: 75 },
    { id: 'pvp_win_streak_5', name: 'Unstoppable',     emoji: '💥', desc: 'Won 5 PVP battles in a row',              check: () => parseInt(localStorage.getItem('btc_pvp_win_streak') || '0') >= 5, pts: 150 },

    // ---- Music: play tiers + comments ----
    { id: 'beats_100_plays',  name: 'Music Lover',    emoji: '🎵', desc: 'Played 100 tracks on Bitcoin Beats',      check: () => parseInt(localStorage.getItem('btc_beats_play_count') || '0') >= 100, pts: 50 },
    { id: 'beats_200_plays',  name: 'Music Junkie',   emoji: '🎶', desc: 'Played 200 tracks on Bitcoin Beats',      check: () => parseInt(localStorage.getItem('btc_beats_play_count') || '0') >= 200, pts: 75 },
    { id: 'beats_500_plays',  name: 'Audiophile',     emoji: '🎧', desc: 'Played 500 tracks on Bitcoin Beats',      check: () => parseInt(localStorage.getItem('btc_beats_play_count') || '0') >= 500, pts: 200 },
    { id: 'beats_comment_1',  name: 'Reviewer',       emoji: '⭐', desc: 'Left a comment on a Bitcoin Beats track', check: () => parseInt(localStorage.getItem('btc_beats_comments') || '0') >= 1,   pts: 15 },

    // ---- Social: DM tiers + reaction tiers ----
    { id: 'dm_25',           name: 'Power Networker', emoji: '📡', desc: 'Sent 25 direct messages',                 check: () => parseInt(localStorage.getItem('btc_dms_sent') || '0') >= 25,  pts: 50 },
    { id: 'dm_100',          name: 'Inbox King',      emoji: '👑', desc: 'Sent 100 direct messages',                check: () => parseInt(localStorage.getItem('btc_dms_sent') || '0') >= 100, pts: 200 },
    { id: 'react_10',        name: 'Reaction Habit',  emoji: '👍', desc: 'Reacted to 10 messages in Global Chat',  check: () => parseInt(localStorage.getItem('btc_chat_reactions') || '0') >= 10,  pts: 15 },
    { id: 'react_100',       name: 'Reactor',         emoji: '⚡', desc: 'Reacted to 100 messages in Global Chat', check: () => parseInt(localStorage.getItem('btc_chat_reactions') || '0') >= 100, pts: 75 },
    { id: 'react_500',       name: 'Reaction God',    emoji: '🔮', desc: 'Reacted to 500 messages in Global Chat', check: () => parseInt(localStorage.getItem('btc_chat_reactions') || '0') >= 500, pts: 300 },

    // ---- Streaks: 3-day and 21-day ----
    { id: 'streak_3',  name: "Three's Company", emoji: '📆', desc: '3-day visit streak',                     check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.bestStreak || 0) >= 3,  pts: 15 },
    { id: 'streak_21', name: '21 Days',          emoji: '₿',  desc: '21-day visit streak — the Bitcoin number', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.bestStreak || 0) >= 21, pts: 100 },

    // ---- Discovery: 5-topic tier ----
    { id: 'explorer_5', name: 'Curious Mind', emoji: '🔍', desc: 'Visited 5 topics', check: v => v.length >= 5, pts: 10 },

    // ---- Global Chat: full message-count tiers ----
    { id: 'chat_25',    name: 'Getting Chatty',   emoji: '🗨️', desc: 'Sent 25 messages in Global Chat',    check: () => parseInt(localStorage.getItem('btc_chat_msgs') || '0') >= 25,   pts: 20 },
    { id: 'chat_200',   name: 'Chat Veteran',     emoji: '🎖️', desc: 'Sent 200 messages in Global Chat',   check: () => parseInt(localStorage.getItem('btc_chat_msgs') || '0') >= 200,  pts: 100 },
    { id: 'chat_1000',  name: 'Chat Immortal',    emoji: '♾️', desc: 'Sent 1,000 messages in Global Chat', check: () => parseInt(localStorage.getItem('btc_chat_msgs') || '0') >= 1000, pts: 750 },

    // ---- DJ Mode: legend tiers ----
    { id: 'dj_50',           name: 'DJ Legend',     emoji: '🎤', desc: 'DJed 50 sets in Global Chat',            check: () => parseInt(localStorage.getItem('btc_dj_sets') || '0') >= 50,   pts: 750 },
    { id: 'dj_listener_100', name: 'Super Fan',     emoji: '🌟', desc: 'Tuned in to 100 DJ sets',               check: () => parseInt(localStorage.getItem('btc_dj_listens') || '0') >= 100, pts: 400 },

    // ---- Predictions: accuracy badge ----
    { id: 'predict_correct_50',    name: 'Half-Oracle',          emoji: '🌙', desc: '50 correct price predictions',                    check: () => _predBadgeCounts().correct >= 50,  pts: 400 },
    { id: 'predict_accuracy_70',   name: 'Precision Forecaster', emoji: '🎯', desc: 'Hit 70%+ accuracy across 20+ predictions',         check: () => { var p = _predBadgeCounts(); return p.total >= 20 && (p.correct / p.total) >= 0.7; }, pts: 200 },

    // ---- Nacho: dressed up ----
    { id: 'nacho_dressed', name: 'Fashion Forward', emoji: '👗', desc: "Equipped a closet item on Nacho", check: () => { try { return Object.keys(JSON.parse(localStorage.getItem('btc_nacho_equipped_multi') || '{}')).length >= 1; } catch(e) { return false; } }, pts: 15 },

    // ---- Marketplace: power seller ----
    { id: 'market_listed_10', name: 'Power Seller', emoji: '🏆', desc: 'Listed 10 items in the Marketplace', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.marketListings || 0) >= 10, pts: 150 },

    // ---- Daily Challenge Badges ----
    { id: 'daily_1',   name: 'First Mission',       emoji: '🎯', desc: 'Complete 1 daily challenge',           check: () => parseInt(localStorage.getItem('btc_daily_challenges_total') || '0') >= 1,   pts: 25 },
    { id: 'daily_5',   name: 'Challenge Accepted',  emoji: '🔥', desc: 'Complete 5 daily challenges total',   check: () => parseInt(localStorage.getItem('btc_daily_challenges_total') || '0') >= 5,   pts: 50 },
    { id: 'daily_10',  name: 'Daily Grinder',        emoji: '💪', desc: 'Complete 10 daily challenges total',  check: () => parseInt(localStorage.getItem('btc_daily_challenges_total') || '0') >= 10,  pts: 100 },
    { id: 'daily_25',  name: 'Consistent Warrior',  emoji: '🏅', desc: 'Complete 25 daily challenges total',  check: () => parseInt(localStorage.getItem('btc_daily_challenges_total') || '0') >= 25,  pts: 250 },
    { id: 'daily_50',  name: 'Discipline Protocol', emoji: '🔑', desc: 'Complete 50 daily challenges total',  check: () => parseInt(localStorage.getItem('btc_daily_challenges_total') || '0') >= 50,  pts: 500 },
    { id: 'daily_100', name: 'Centurion',            emoji: '👑', desc: 'Complete 100 daily challenges total', check: () => parseInt(localStorage.getItem('btc_daily_challenges_total') || '0') >= 100, pts: 1000 },

    // ---- Combo Badges ----
    { id: 'combo_trio',   name: 'Trio Combo',   emoji: '🔥', desc: 'Hit a 3-feature combo in one session',    check: () => localStorage.getItem('btc_badge_earned_combo_trio') === '1',   pts: 50 },
    { id: 'combo_mega',   name: 'Mega Combo',   emoji: '💥', desc: 'Hit a 5-feature combo in one session',    check: () => localStorage.getItem('btc_badge_earned_combo_mega') === '1',   pts: 100 },
    { id: 'combo_legend', name: 'Legend Mode',  emoji: '🏆', desc: 'Hit all 8 features in one session',        check: () => localStorage.getItem('btc_badge_earned_combo_legend') === '1', pts: 250 },

    // ---- Weekly Community Challenge ----
    { id: 'weekly_hero',  name: 'Community Hero', emoji: '⚡', desc: 'Participated in a weekly community challenge', check: () => localStorage.getItem('btc_badge_earned_weekly_hero') === '1', pts: 100 },

    // ---- Badge Set Completion Bonuses (hidden until earned) ----
    { id: 'set_miner_complete',    name: 'Master Miner',         emoji: '🏆', desc: 'Completed The Miner Set',      pts: 500,  hidden: true, check: () => localStorage.getItem('btc_badge_earned_set_miner_complete') === '1' },
    { id: 'set_scholar_complete',  name: 'Satoshi Scholar',      emoji: '🎓', desc: 'Completed The Scholar Set',    pts: 500,  hidden: true, check: () => localStorage.getItem('btc_badge_earned_set_scholar_complete') === '1' },
    { id: 'set_social_complete',   name: 'Community Pillar',     emoji: '🌐', desc: 'Completed The Social Set',     pts: 500,  hidden: true, check: () => localStorage.getItem('btc_badge_earned_set_social_complete') === '1' },
    { id: 'set_streak_complete',   name: 'Diamond Hands',        emoji: '💎', desc: 'Completed The Streak Set',     pts: 1000, hidden: true, check: () => localStorage.getItem('btc_badge_earned_set_streak_complete') === '1' },
    { id: 'set_pvp_complete',      name: 'Arena Champion',       emoji: '👑', desc: 'Completed The Fighter Set',    pts: 750,  hidden: true, check: () => localStorage.getItem('btc_badge_earned_set_pvp_complete') === '1' },
    { id: 'set_builder_complete',  name: 'Archive Builder',      emoji: '🔧', desc: 'Completed The Builder Set',    pts: 500,  hidden: true, check: () => localStorage.getItem('btc_badge_earned_set_builder_complete') === '1' },
    { id: 'set_explorer_complete', name: 'World Traveler',       emoji: '🗺️', desc: 'Completed The Explorer Set', pts: 500, hidden: true, check: () => localStorage.getItem('btc_badge_earned_set_explorer_complete') === '1' },
    { id: 'set_fun_complete',      name: 'Bitcoin Calendar Hero',emoji: '🎊', desc: 'Completed The Calendar Set',   pts: 300,  hidden: true, check: () => localStorage.getItem('btc_badge_earned_set_fun_complete') === '1' },
    { id: 'set_daily_complete',    name: 'Challenge Master',     emoji: '🏅', desc: 'Completed The Daily Set',      pts: 500,  hidden: true, check: () => localStorage.getItem('btc_badge_earned_set_daily_complete') === '1' },
    { id: 'set_tctv_complete',      name: 'Timechain Veteran',    emoji: '🛸', desc: 'Completed The Timechain TV Set', pts: 500,  hidden: true, check: () => localStorage.getItem('btc_badge_earned_set_tctv_complete') === '1' },
    { id: 'set_lightning_complete', name: 'Lightning Lord',       emoji: '⚡',       desc: 'Completed The Lightning Set',    pts: 750,  hidden: true, check: () => localStorage.getItem('btc_badge_earned_set_lightning_complete') === '1' },
    { id: 'set_trails_complete',    name: 'Trail Blazer',         emoji: '🏔️', desc: 'Completed The Trails Set',  pts: 500,  hidden: true, check: () => localStorage.getItem('btc_badge_earned_set_trails_complete') === '1' },
    { id: 'set_beats_complete',     name: 'Beats Maestro',        emoji: '🎤', desc: 'Completed The Beats Set',        pts: 500,  hidden: true, check: () => localStorage.getItem('btc_badge_earned_set_beats_complete') === '1' },
    { id: 'set_trifecta_complete',  name: 'Trifecta God',         emoji: '🌞', desc: 'Completed The Trifecta Set',     pts: 1000, hidden: true, check: () => localStorage.getItem('btc_badge_earned_set_trifecta_complete') === '1' },
    { id: 'set_irl_complete',       name: 'Community Anchor',     emoji: '🌍', desc: 'Completed The IRL Set',          pts: 500,  hidden: true, check: () => localStorage.getItem('btc_badge_earned_set_irl_complete') === '1' },
    { id: 'set_spin_complete',      name: 'Wheel Master',         emoji: '🎰', desc: 'Completed The Wheel Set',        pts: 300,  hidden: true, check: () => localStorage.getItem('btc_badge_earned_set_spin_complete') === '1' },
    { id: 'set_profile_complete',   name: 'Archive Legend',       emoji: '🦌', desc: 'Completed The Profile Set',      pts: 500,  hidden: true, check: () => localStorage.getItem('btc_badge_earned_set_profile_complete') === '1' },
    { id: 'set_pow_complete',       name: 'Distance Legend',      emoji: '🌍', desc: 'Completed The Proof of Walk Set',pts: 750,  hidden: true, check: () => localStorage.getItem('btc_badge_earned_set_pow_complete') === '1' },
    // Leaderboard Lurker — secret badge for repeat leaderboard openers
    { id: 'lb_lurker_5',    name: 'Leaderboard Lurker',    emoji: '👀', desc: 'Opened the leaderboard 5 times',    pts: 10,  hidden: true, check: () => parseInt(localStorage.getItem('btc_lb_opens') || '0') >= 5    },
    { id: 'lb_lurker_10',   name: 'Rank Watcher',           emoji: '📊', desc: 'Opened the leaderboard 10 times',   pts: 25,  hidden: true, check: () => parseInt(localStorage.getItem('btc_lb_opens') || '0') >= 10   },
    { id: 'lb_lurker_50',   name: 'Standing Obsession',     emoji: '🔭', desc: 'Opened the leaderboard 50 times',   pts: 50,  hidden: true, check: () => parseInt(localStorage.getItem('btc_lb_opens') || '0') >= 50   },
    { id: 'lb_lurker_100',  name: 'Rank Addict',            emoji: '🎯', desc: 'Opened the leaderboard 100 times',  pts: 100, hidden: true, check: () => parseInt(localStorage.getItem('btc_lb_opens') || '0') >= 100  },
    { id: 'lb_lurker_500',  name: 'Leaderboard Legend',     emoji: '🏆', desc: 'Opened the leaderboard 500 times',  pts: 500, hidden: true, check: () => parseInt(localStorage.getItem('btc_lb_opens') || '0') >= 500  },
    // Chat Lurker — secret badge for repeat chat openers
    { id: 'chat_lurker_5',   name: 'Chat Lurker',            emoji: '💬', desc: 'Opened the chat 5 times',    pts: 10,  hidden: true, check: () => parseInt(localStorage.getItem('btc_chat_opens') || '0') >= 5    },
    { id: 'chat_lurker_10',  name: 'Social Butterfly',       emoji: '🦋', desc: 'Opened the chat 10 times',   pts: 25,  hidden: true, check: () => parseInt(localStorage.getItem('btc_chat_opens') || '0') >= 10   },
    { id: 'chat_lurker_50',  name: 'Always Online',          emoji: '🟢', desc: 'Opened the chat 50 times',   pts: 50,  hidden: true, check: () => parseInt(localStorage.getItem('btc_chat_opens') || '0') >= 50   },
    { id: 'chat_lurker_100', name: 'Chat Addict',            emoji: '🗣️', desc: 'Opened the chat 100 times',  pts: 100, hidden: true, check: () => parseInt(localStorage.getItem('btc_chat_opens') || '0') >= 100  },
    { id: 'chat_lurker_500', name: 'Global Chat Legend',     emoji: '🌐', desc: 'Opened the chat 500 times',  pts: 500, hidden: true, check: () => parseInt(localStorage.getItem('btc_chat_opens') || '0') >= 500  },
    // --- Learning Quests ---
    { id: 'lq_what_is_bitcoin', name: '🟠 Bitcoin Basics',          emoji: '🟠', pts: 0, desc: 'Passed the What is Bitcoin? Learning Quest',              hint: 'Complete the Bitcoin Basics Learning Quest',          hidden: false, check: () => false },
    { id: 'lq_mining',          name: '⛏️ Hash Slinger',              emoji: '⛏️', pts: 0, desc: 'Passed the Mining & Proof of Work Learning Quest',       hint: 'Complete the Mining Learning Quest',                  hidden: false, check: () => false },
    { id: 'lq_nodes',           name: '🖥️ Node Runner',               emoji: '🖥️', pts: 0, desc: 'Passed the Nodes & Decentralization Learning Quest',     hint: 'Complete the Nodes Learning Quest',                   hidden: false, check: () => false },
    { id: 'lq_self_custody',    name: '🔑 Sovereign Stacker',         emoji: '🔑', pts: 0, desc: 'Passed the Self-Custody & Keys Learning Quest',          hint: 'Complete the Self-Custody Learning Quest',            hidden: false, check: () => false },
    { id: 'lq_lightning',       name: '⚡ Lightning Pleb',             emoji: '⚡', pts: 0, desc: 'Passed the Lightning Network Learning Quest',            hint: 'Complete the Lightning Learning Quest',               hidden: false, check: () => false },
    { id: 'lq_scarcity',        name: '💎 21M Believer',               emoji: '💎', pts: 0, desc: 'Passed the Fixed Supply Learning Quest',                hint: 'Complete the Scarcity Learning Quest',                hidden: false, check: () => false },
    { id: 'lq_bitcoin_only',    name: '🛡️ Bitcoin Maximalist',        emoji: '🛡️', pts: 0, desc: 'Passed the Why Bitcoin, Not Crypto Learning Quest',     hint: 'Complete the Bitcoin-Only Learning Quest',            hidden: false, check: () => false },
    { id: 'lq_privacy',         name: '🕵️ Cypherpunk',                emoji: '🕵️', pts: 0, desc: 'Passed the Privacy & Sovereignty Learning Quest',       hint: 'Complete the Privacy Learning Quest',                 hidden: false, check: () => false },
    { id: 'lq_graduate',        name: '📖 Learning Quest Graduate',   emoji: '📖', pts: 0, desc: 'Completed ALL 8 Learning Quests — true Bitcoin scholar', hint: 'Pass all 8 Learning Quests to earn this rare badge',  hidden: false, check: () => false },

    // Server-proven counters. The check only reads the profile the server wrote.
    { id: 'gift_open_1', name: 'Unwrapped', emoji: '🎁', desc: 'Opened your first gift', pts: 10, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.giftsOpened || 0) >= 1 },
    { id: 'gift_open_25', name: 'Ribbon Cutter', emoji: '🎀', desc: 'Opened 25 gifts', pts: 50, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.giftsOpened || 0) >= 25 },
    { id: 'gift_open_100', name: 'Present Pro', emoji: '🎁', desc: 'Opened 100 gifts', pts: 150, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.giftsOpened || 0) >= 100 },
    { id: 'gift_open_500', name: 'Gift Hoarder', emoji: '📦', desc: 'Opened 500 gifts', pts: 500, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.giftsOpened || 0) >= 500 },
    { id: 'gift_open_1500', name: 'Endless Wrapping', emoji: '♾️', desc: 'Opened 1,500 gifts', pts: 2000, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.giftsOpened || 0) >= 1500 },
    { id: 'gift_lucky_shoutout', name: "Nacho's Pick", emoji: '📣', desc: "A gift's Nacho shoutout was posted", pts: 50, check: () => typeof currentUser !== 'undefined' && currentUser && !!currentUser.giftShoutoutWon },
    { id: 'gift_sent_1', name: 'Gift Giver', emoji: '🎁', desc: 'A peer used a key you sent', pts: 10, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.giftsSent || 0) >= 1 },
    { id: 'gift_sent_10', name: 'Generous', emoji: '🎁', desc: 'Peers used 10 keys you sent', pts: 150, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.giftsSent || 0) >= 10 },
    { id: 'gift_sent_50', name: 'Santa Sats', emoji: '🎅', desc: 'Peers used 50 keys you sent', pts: 500, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.giftsSent || 0) >= 50 },
    { id: 'gift_sent_200', name: 'Key Philanthropist', emoji: '🗝️', desc: 'Peers used 200 keys you sent', pts: 2000, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.giftsSent || 0) >= 200 },
    { id: 'key_peers_5', name: 'Keymaster', emoji: '🔑', desc: '5 different peers used a key you sent', pts: 150, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.keyPeersDistinct || 0) >= 5 },
    { id: 'key_peers_21', name: 'Web of Trust', emoji: '🕸️', desc: '21 different peers used a key you sent', pts: 500, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.keyPeersDistinct || 0) >= 21 },
    { id: 'cipher_peer_key_1', name: 'Borrowed Key', emoji: '🔐', desc: "Opened a cipher with a peer's key", pts: 10, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.peerKeyCiphers || 0) >= 1 },
    { id: 'cipher_peer_key_25', name: 'Trusted Circle', emoji: '🔐', desc: "Opened 25 ciphers with peers' keys", pts: 150, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.peerKeyCiphers || 0) >= 25 },
    { id: 'cipher_peer_key_100', name: 'Shared Secrets', emoji: '🔐', desc: "Opened 100 ciphers with peers' keys", pts: 500, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.peerKeyCiphers || 0) >= 100 },
    { id: 'cipher_full_ring', name: 'Full Keyring', emoji: '💍', desc: 'Opened 21 ciphers in one day', pts: 150, check: () => typeof currentUser !== 'undefined' && currentUser && !!currentUser.cipherFullRing },
    { id: 'cipher_sats_1', name: 'Cracked the Vault', emoji: '⚡', desc: 'Received your first paid cipher sats win', pts: 150, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.cipherSatsPaid || 0) >= 1 },
    { id: 'cipher_sats_5', name: 'Vault Regular', emoji: '⚡', desc: 'Received 5 paid cipher sats wins', pts: 500, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.cipherSatsPaid || 0) >= 5 },
    { id: 'cipher_sats_10k', name: 'Whale Cipher', emoji: '🐳', desc: 'A paid cipher win of 10,000 sats or more', pts: 2000, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.cipherBiggestWin || 0) >= 10000 },
    { id: 'peer_level_2', name: 'Channel Opened', emoji: '🟨', desc: 'A peer pair reached Opening Channel', pts: 10, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.peerBestLevel || 0) >= 2 },
    { id: 'peer_level_3', name: 'Routing Nodes', emoji: '🟧', desc: 'A peer pair reached Routing Nodes', pts: 50, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.peerBestLevel || 0) >= 3 },
    { id: 'peer_level_4', name: 'Adjusted Fees', emoji: '🟦', desc: 'A peer pair reached Adjusted Fees', pts: 150, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.peerBestLevel || 0) >= 4 },
    { id: 'peer_level_5', name: 'Balanced Liquidity', emoji: '🟪', desc: 'A peer pair reached Balanced Liquidity', pts: 500, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.peerBestLevel || 0) >= 5 },
    { id: 'peer_level_6', name: 'Wumbo Channel', emoji: '⚡', desc: 'A peer pair reached Wumbo Channel', pts: 2000, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.peerBestLevel || 0) >= 6 },
    { id: 'peer_hub_5', name: 'Lightning Hub', emoji: '🌐', desc: '5 peers at Routing Nodes or higher', pts: 500, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.peersAtL3 || 0) >= 5 },
    { id: 'topic_comment_1', name: 'Chimed In', emoji: '💬', desc: 'A counted comment on a topic', pts: 10, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.topicComments || 0) >= 1 },
    { id: 'topic_comment_10', name: 'Discussion Regular', emoji: '💬', desc: '10 counted topic comments', pts: 50, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.topicComments || 0) >= 10 },
    { id: 'topic_comment_50', name: 'Thread Weaver', emoji: '🧵', desc: '50 counted topic comments', pts: 150, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.topicComments || 0) >= 50 },
    { id: 'topic_comment_250', name: 'Town Crier', emoji: '📢', desc: '250 counted topic comments', pts: 500, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.topicComments || 0) >= 250 },
    { id: 'topic_channels_10', name: 'Well-Rounded', emoji: '📚', desc: 'Counted comments in 10 different topics', pts: 150, check: () => typeof currentUser !== 'undefined' && currentUser && Array.isArray(currentUser.topicChannelsCommented) && currentUser.topicChannelsCommented.length >= 10 },
    { id: 'shop_10', name: 'Regular Customer', emoji: '🛒', desc: "Made 10 purchases in Nacho's Nook", pts: 50, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.shopPurchases || 0) >= 10 },
    { id: 'shop_50', name: 'Nook VIP', emoji: '🛒', desc: "Made 50 purchases in Nacho's Nook", pts: 150, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.shopPurchases || 0) >= 50 },
    { id: 'raffle_entered', name: 'Feeling Lucky', emoji: '🎟️', desc: 'Bought a raffle ticket with orange tickets', pts: 10, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.raffleTicketsBought || 0) >= 1 },
    { id: 'raffle_10', name: 'Ticket Stacker', emoji: '🎟️', desc: 'Bought 10 raffle tickets with orange tickets', pts: 50, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.raffleTicketsBought || 0) >= 10 },
    { id: 'raffle_50', name: 'Regular Drawer', emoji: '🎲', desc: 'Bought 50 raffle tickets with orange tickets', pts: 150, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.raffleTicketsBought || 0) >= 50 },
    { id: 'raffle_250', name: 'High Roller', emoji: '🎰', desc: 'Bought 250 raffle tickets with orange tickets', pts: 500, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.raffleTicketsBought || 0) >= 250 },
    { id: 'raffle_1000', name: 'House Favorite', emoji: '🏆', desc: 'Bought 1,000 raffle tickets with orange tickets', pts: 2000, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.raffleTicketsBought || 0) >= 1000 },
    { id: 'raffle_winner', name: 'Raffle Champion', emoji: '🏆', desc: 'Won the monthly orange-ticket raffle', pts: 500, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.raffleWins || 0) >= 1 },
    { id: 'predict_top_week', name: 'Weekly Oracle', emoji: '🔮', desc: 'Paid as a weekly Top Predictor', pts: 150, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.predTopWeeks || 0) >= 1 },
    { id: 'predict_top_week_5', name: 'Seasoned Oracle', emoji: '🔮', desc: 'Paid as a weekly Top Predictor 5 times', pts: 500, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.predTopWeeks || 0) >= 5 },
    { id: 'predict_top_month', name: 'Monthly Oracle', emoji: '🌕', desc: 'Paid as a monthly Top Predictor', pts: 500, check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.predTopMonths || 0) >= 1 },
    { id: 'totp_enabled', name: 'Fort Knox', emoji: '🔒', desc: 'Turned on an authenticator', pts: 50, check: () => typeof currentUser !== 'undefined' && currentUser && !!currentUser.totpEnabled },
    { id: 'faction_chosen', name: 'Pledged', emoji: '🏴', desc: 'Chose a faction', pts: 10, check: () => typeof currentUser !== 'undefined' && currentUser && typeof currentUser.faction === 'string' && currentUser.faction.trim().length > 0 },
    { id: 'onboarding_complete', name: 'Welcome Aboard', emoji: '🧭', desc: 'Finished onboarding', pts: 10, check: () => typeof currentUser !== 'undefined' && currentUser && !!currentUser.onboardingComplete },
    { id: 'push_enabled', name: 'Ring the Bell', emoji: '🔔', desc: 'Turned on push notifications', pts: 10, check: () => typeof currentUser !== 'undefined' && currentUser && !!currentUser.pushEnabled },
];

// =============================================
// User Titles — earned by reaching max-tier badges
// =============================================
const TITLE_DEFS = [
    { id: 'the_completionist',    title: 'The Completionist',   emoji: '🗺️', requiredBadge: 'explorer_all',          flavor: 'Mapped every corner of the Archive' },
    { id: 'quest_legend',        title: 'Quest Legend',         emoji: '⚔️', requiredBadge: 'quest_100',             flavor: 'A hundred quests. Countless battles won.' },
    { id: 'hash_lord',           title: 'Hash Lord',            emoji: '☄️', requiredBadge: 'sf_10000_hashes',       flavor: '10,000 nonces ground into dust' },
    { id: 'hash_god',            title: 'Hash God',             emoji: '⚡', requiredBadge: 'sf_100000_hashes',      flavor: '100,000 hashes. You ARE the network.' },
    { id: 'satoshis_chosen',     title: "Satoshi's Chosen",    emoji: '💎', requiredBadge: 'sf_lucky_1000',         flavor: 'Fortune favors the relentless' },
    { id: 'block_solver',        title: 'Block Solver',         emoji: '🌞', requiredBadge: 'sf_block_solver',        flavor: 'Cracked the code. Won the sats.' },
    { id: 'hodler_supreme',      title: 'HODLer Supreme',       emoji: '🪩', requiredBadge: 'streak_365',             flavor: '365 days. No days off.' },
    { id: 'sovereign_individual',title: 'Sovereign Individual', emoji: '🗽', requiredBadge: 'streak_200',             flavor: '200 days of orange-pilled devotion' },
    { id: 'the_satellite',       title: 'The Satellite',        emoji: '🛰️', requiredBadge: 'tctv_satellite',         flavor: '100 hours deep in the Timechain' },
    { id: 'timechain_surfer',    title: 'Timechain Surfer',     emoji: '🏄', requiredBadge: 'tctv_timechain_surfer',  flavor: 'Surfed 100 channels. Seen it all.' },
    { id: 'chat_legend',         title: 'Chat Legend',          emoji: '📯', requiredBadge: 'chat_500',               flavor: 'The voice of the Archive' },
    { id: 'the_devoted',         title: 'The Devoted',          emoji: '💠', requiredBadge: 'chat_streak_30',         flavor: '30 days of relentless conversation' },
    { id: 'pvp_legend',          title: 'PVP Legend',           emoji: '🥇', requiredBadge: 'pvp_100',               flavor: '100 wins. Undefeated in Bitcoin knowledge.' },
    { id: 'raid_warlord',        title: 'Raid Warlord',         emoji: '🔱', requiredBadge: 'raid_100',               flavor: '100 damage dealt. Bosses tremble.' },
    { id: 'dragon_slayer',       title: 'Dragon Slayer',        emoji: '🐲', requiredBadge: 'raid_boss_slayer_10',    flavor: 'Ten bosses defeated. A true slayer.' },
    { id: 'the_viral_plebian',   title: 'The Viral Plebian',    emoji: '👑', requiredBadge: 'referral_100',           flavor: 'Orange-pilled 100 souls' },
    { id: 'satoshis_disciple',   title: "Satoshi's Disciple",  emoji: '🟠', requiredBadge: 'daily_triple_365',       flavor: '365 Daily Trifectas. Absolute dedication.' },
    { id: 'trifecta_legend',     title: 'Trifecta Legend',      emoji: '🏆', requiredBadge: 'daily_triple_90',        flavor: '90 consecutive days of learning, trivia, and polling' },
    { id: 'double_scholar',      title: 'Double Scholar',       emoji: '🏛️', requiredBadge: 'cert_double',            flavor: 'Bitcoin Scholar AND Protocol Expert' },
    { id: 'trivia_titan',        title: 'Trivia Titan',         emoji: '🏅', requiredBadge: 'trivia_correct_100',     flavor: '100 correct answers. Living Bitcoin encyclopedia.' },
    { id: 'the_devotee',         title: 'The Devotee',          emoji: '🔱', requiredBadge: 'trivia_streak_30',       flavor: '30-day trivia streak. No excuses.' },
    { id: 'vinyl_master',        title: 'Vinyl Master',         emoji: '🎼', requiredBadge: 'dj_songs_100',           flavor: '100 songs broadcast to the Archive' },
    { id: 'nachos_confidant',    title: "Nacho's Confidant",   emoji: '🤫', requiredBadge: 'nacho_whisper',          flavor: '500 conversations with the deer himself' },
    { id: 'regional_leader',     title: 'Regional Leader',      emoji: '🌆', requiredBadge: 'irl_host_10',            flavor: '10 Bitcoin events hosted. The community builder.' },
    { id: 'twenty_one_million',  title: '21 Million Dreams',    emoji: '₿',  requiredBadge: 'sats_21k',              flavor: 'Claimed 21,000 sats. Lived the number.' },
    { id: 'proof_of_pain',       title: 'Proof of Pain',        emoji: '🕱️', requiredBadge: 'sf_unlucky_1000',        flavor: '1,000 terrible hashes. Respect.' },
    { id: 'trail_master',        title: 'Trail Master',         emoji: '🏁', requiredBadge: 'trail_all',              flavor: 'Completed every trail Nacho laid out' },
    { id: 'to_the_moon',         title: 'To the Moon',          emoji: '🌕', requiredBadge: 'pow_km_5000',            flavor: 'Walked 5,000km. Unreal.' },
    { id: 'democracy_maxi',      title: 'Democracy Maxi',       emoji: '⚖️', requiredBadge: 'poll_100',               flavor: '100 polls voted. The voice of reason.' },
    { id: 'sat_slinger',         title: 'Sat Slinger',          emoji: '💰', requiredBadge: 'tip_sats_10k',           flavor: '10,000 sats tipped. Pure generosity.' },
    { id: 'community_darling',   title: 'Community Darling',    emoji: '🌟', requiredBadge: 'tip_received_50',        flavor: '50 tips received from the Archive community' },
    { id: 'time_traveler',       title: 'Time Traveler',        emoji: '⏳', requiredBadge: 'predict_correct_100',    flavor: '100 correct predictions. Saw the future.' },
    { id: 'the_long_walker',     title: 'The Long Walker',      emoji: '💎', requiredBadge: 'pow_streak_30',          flavor: '30-day Proof of Walk streak. Committed.' },

    // ── Badge count milestones ──
    { id: 'chancellor',          title: 'Chancellor on Brink',    emoji: '📰', requiredBadge: 'hall_of_fame',          flavor: '50 badges. The banks are already nervous.' },
    { id: 'the_archivist_t',     title: 'The Archivist',          emoji: '🏛️', requiredBadge: 'the_archive',           flavor: '100 badges. You don\'t use the Archive — you are it.' },
    { id: 'hall_of_fame_t',      title: 'Hall of Fame',           emoji: '🏆', requiredBadge: 'genesis_block',         flavor: '150 badges. A true legend.' },
    { id: 'satoshis_revenge_t',  title: "Satoshi's Revenge",     emoji: '⚔️', requiredBadge: 'satoshis_ghost',        flavor: '200 badges. The network never forgets.' },
    { id: 'satoshis_vendetta_t', title: "Satoshi's Vendetta",    emoji: '🗡️', requiredBadge: 'block_250',              flavor: '250 badges. Deeper than most will ever go.' },
    { id: 'satoshis_ghost_t',    title: "Satoshi's Ghost",       emoji: '👻', requiredBadge: 'the_hodler',             flavor: '300 badges. So rare nobody knows if it\'s been done.' },
    { id: 'satoshis_covenant_t', title: "Satoshi's Covenant",    emoji: '📜', requiredBadge: 'satoshis_covenant',     flavor: '350 badges. Bound to the protocol, forever.' },
    { id: 'satoshis_cipher_t',   title: "Satoshi's Cipher",      emoji: '🔐', requiredBadge: 'satoshis_cipher',       flavor: '400 badges. You have cracked something most never will.' },

    // ── Grand Scholar / Jack of All ──
    { id: 'grand_scholar',       title: 'Grand Scholar',          emoji: '🎓', requiredBadge: 'all_certs',             flavor: 'All certifications and trails. The complete picture.' },
    { id: 'jack_of_all_t',       title: 'Jack of All Trades',     emoji: '🃏', requiredBadge: 'jack_of_all',           flavor: 'A badge in every category. Truly well-rounded.' },

    // ── Set completions ──
    { id: 'master_miner_t',      title: 'Master Miner',           emoji: '⛏️', requiredBadge: 'set_miner_complete',    flavor: 'Every mining badge earned. The forge never cools.' },
    { id: 'satoshi_scholar_t',   title: 'Satoshi Scholar',        emoji: '🎓', requiredBadge: 'set_scholar_complete',  flavor: 'The Scholar Set complete. Knowledge is sovereignty.' },
    { id: 'community_pillar_t',  title: 'Community Pillar',       emoji: '🌐', requiredBadge: 'set_social_complete',   flavor: 'The Social Set done. The Archive runs on people like you.' },
    { id: 'diamond_hands_set_t', title: 'Diamond Hands',          emoji: '💎', requiredBadge: 'set_streak_complete',   flavor: 'The Streak Set finished. Unbreakable.' },
    { id: 'arena_champion_t',    title: 'Arena Champion',         emoji: '👑', requiredBadge: 'set_pvp_complete',      flavor: 'The Fighter Set complete. Dominant.' },
    { id: 'archive_builder_t',   title: 'Archive Builder',        emoji: '🔧', requiredBadge: 'set_builder_complete',  flavor: 'The Builder Set done. You shaped this place.' },
    { id: 'world_traveler_t',    title: 'World Traveler',         emoji: '🗺️', requiredBadge: 'set_explorer_complete', flavor: 'The Explorer Set complete. Every path walked.' },
    { id: 'bitcoin_cal_hero_t',  title: 'Bitcoin Calendar Hero',  emoji: '🎊', requiredBadge: 'set_fun_complete',      flavor: 'All calendar badges. You never miss a Bitcoin holiday.' },
    { id: 'challenge_master_t',  title: 'Challenge Master',       emoji: '🏅', requiredBadge: 'set_daily_complete',    flavor: 'The Daily Set complete. Every day, every challenge.' },
    { id: 'timechain_veteran_t', title: 'Timechain Veteran',      emoji: '🛸', requiredBadge: 'set_tctv_complete',     flavor: 'The TCTV Set complete. You\'ve seen everything.' },
    { id: 'lightning_lord_t',    title: 'Lightning Lord',         emoji: '⚡', requiredBadge: 'set_lightning_complete', flavor: 'The Lightning Set complete. Pure Bitcoin velocity.' },
    { id: 'trail_blazer_t',      title: 'Trail Blazer',           emoji: '🏔️', requiredBadge: 'set_trails_complete',   flavor: 'The Trails Set blazed. Nacho is proud.' },
    { id: 'beats_maestro_t',     title: 'Beats Maestro',          emoji: '🎤', requiredBadge: 'set_beats_complete',    flavor: 'The Beats Set complete. Music and Bitcoin forever.' },
    { id: 'trifecta_god_t',      title: 'Trifecta God',           emoji: '🌞', requiredBadge: 'set_trifecta_complete', flavor: 'The Trifecta Set complete. Daily discipline personified.' },
    { id: 'irl_set_t',           title: 'IRL Champion',           emoji: '🏟️', requiredBadge: 'set_irl_complete',     flavor: 'The IRL Set complete. Bitcoin isn\'t just on a screen.' },
    { id: 'spin_set_t',          title: 'Wheel of Fortune',       emoji: '🎰', requiredBadge: 'set_spin_complete',     flavor: 'The Spin Set complete. Fortune favored you enough.' },
    { id: 'pow_set_t',           title: 'Proof of Walker',        emoji: '👟', requiredBadge: 'set_pow_complete',      flavor: 'The Proof of Walk Set complete. Every step counted.' },

    // ── Chat ──
    { id: 'chat_immortal_t',     title: 'Chat Immortal',          emoji: '♾️', requiredBadge: 'chat_1000',             flavor: '1,000 messages. You are the chat.' },
    { id: 'reaction_god_t',      title: 'Reaction God',           emoji: '🔮', requiredBadge: 'react_500',             flavor: '500 reactions. You feel everything.' },

    // ── DJ / Music ──
    { id: 'dj_legend_t',         title: 'DJ Legend',              emoji: '🎛️', requiredBadge: 'dj_50',                 flavor: '50 DJ sets. The decks are your home.' },
    { id: 'super_fan_t',         title: 'Super Fan',              emoji: '🌟', requiredBadge: 'dj_listener_100',       flavor: '100 DJ sets listened to. Front row every time.' },
    { id: 'audiophile_t',        title: 'The Audiophile',         emoji: '🎧', requiredBadge: 'beats_500_plays',       flavor: '500 tracks on Bitcoin Beats. Pure devotion.' },

    // ── Forum / Writing ──
    { id: 'forum_legend_t',      title: 'Forum Legend',           emoji: '🏛️', requiredBadge: 'forum_100',             flavor: '100 forum posts. Your words shaped the debate.' },
    { id: 'staff_writer_t',      title: 'Staff Writer',           emoji: '🗞️', requiredBadge: 'article_10',            flavor: '10 articles published. The pen is mightier.' },

    // ── PVP ──
    { id: 'unstoppable_pvp_t',   title: 'Unstoppable',            emoji: '💥', requiredBadge: 'pvp_win_streak_5',      flavor: '5 PVP wins in a row. Nobody can touch you.' },

    // ── Diamond Hands 100 ──
    { id: 'diamond_hands_100_t', title: 'Diamond Hands',          emoji: '💎', requiredBadge: 'streak_100',            flavor: '100-day streak. Most quit long ago.' },

    // ── Spin Wheel ──
    { id: 'wheel_addict_t',      title: 'Wheel Addict',           emoji: '🎡', requiredBadge: 'spin_streak_30',        flavor: '30-day spin streak. Fortune favors the consistent.' },
    { id: 'century_spinner_t',   title: 'Century Spinner',        emoji: '🏅', requiredBadge: 'spin_100',              flavor: '100 spins. No shame, only gains.' },

    // ── Predictions ──
    { id: 'precision_forecaster_t', title: 'Precision Forecaster', emoji: '🎯', requiredBadge: 'predict_accuracy_70', flavor: '70%+ accuracy across 20+ predictions. You see the chart.' },
    { id: 'nostradamus_t',        title: 'Nostradamus',           emoji: '🔮', requiredBadge: 'predict_streak_10',    flavor: '10 correct in a row. The oracle speaks.' },

    // ── Flex ──
    { id: 'flex_legend_t',        title: 'Flex Legend',           emoji: '🦁', requiredBadge: 'flex_legend',           flavor: '1,000 Flex actions. Physical and financial sovereignty.' },
    { id: 'full_stack_human_t',   title: 'Full Stack Human',      emoji: '🧬', requiredBadge: 'flex_all_once',         flavor: 'Every Flex action done. The complete sovereign.' },

    // ── Combo ──
    { id: 'legend_mode_t',        title: 'Legend Mode',           emoji: '🏆', requiredBadge: 'combo_legend',          flavor: 'All 8 features in one session. A true Archive legend.' },

    // ── Nacho ──
    { id: 'nachos_bestie_t',      title: "Nacho's Bestie",       emoji: '🧡', requiredBadge: 'nacho_bestie',          flavor: '250 Nacho interactions. He considers you a friend.' },

    // ── Referrals ──
    { id: 'super_spreader_t',     title: 'Super Spreader',        emoji: '📡', requiredBadge: 'referral_50',           flavor: 'Referred 50 people. Orange pill machine.' },

    // ── Sats ──
    { id: 'sat_hoarder_t',        title: 'Sat Hoarder',           emoji: '🏦', requiredBadge: 'sats_10k',              flavor: '10,000 sats claimed. The stack begins.' },

    // ── SF ──
    { id: 'favor_champion_t',     title: 'Favor Champion',        emoji: '🏅', requiredBadge: 'sf_contributor_10',     flavor: '10× Satoshi\'s Favor activated. The community owes you.' },
    { id: 'golden_nonce_t',       title: 'Golden Nonce',          emoji: '✨', requiredBadge: 'sf_ultra_low',          flavor: 'Hash under 100,000. Almost divine luck.' },
    { id: 'asic_mode_t',          title: 'ASIC Mode',             emoji: '🖥️', requiredBadge: 'sf_1000_hashes',        flavor: '1,000 SF hashes. Dedicated.' },

    // ── Trails ──
    { id: 'summit_conqueror_t',   title: 'Summit Conqueror',      emoji: '🏔️', requiredBadge: 'trail_summit',          flavor: 'The hardest Nacho trail. The summit was yours.' },

    // ── PoW ──
    { id: 'pow_titan_t',          title: 'The Titan',             emoji: '🌍', requiredBadge: 'pow_km_1000',           flavor: '1,000 km walked. A thousand kilometers of conviction.' },

    // ── Story ──
    { id: 'story_master_t',       title: 'Story Master',          emoji: '🦧', requiredBadge: 'story_complete',        flavor: 'All 7 chapters of Nacho\'s Story. You know the whole tale.' },

    // ── IRL ──
    { id: 'scene_regular_t',      title: 'Scene Regular',         emoji: '🗺️', requiredBadge: 'irl_attend_5',          flavor: '5 IRL events attended. You show up in person.' },

    // ── Tips ──
    { id: 'tip_magnet_t',         title: 'Tip Magnet',            emoji: '🧲', requiredBadge: 'tip_magnet',            flavor: '10 tips received. The community loves what you bring.' },

    // ── Weekly Hero ──
    { id: 'community_hero_t',     title: 'Community Hero',        emoji: '⚡', requiredBadge: 'weekly_hero',           flavor: 'Participated in a weekly community challenge. Showed up.' },
];

let earnedBadges = new Set();
let badgeCheckInterval = null;
// Session-scoped toast guard: prevents re-toasting badges whose CF award is rolled back.
// earnedBadges rolls back on CF rejection so the badge can retry next session,
// but the toast must NOT fire again every 30s while the local condition stays true.
let _toastedThisSession = new Set();
// Don't check badges until Firebase has restored the earned list
window._visibleBadgesReady = false;

function initBadges() {
    // Load earned badges from localStorage
    const saved = JSON.parse(localStorage.getItem('btc_badges') || '[]');
    saved.forEach(b => earnedBadges.add(b));

    // Check badges every 15 seconds — but only after Firebase restore
    badgeCheckInterval = setInterval(checkBadges, 30000);

    // Flush queued visible badge popups when Nacho is idle
    setInterval(function() {
        if (!window._visibleBadgeQueue || window._visibleBadgeQueue.length === 0) return;
        if (window._nachoBusy) return;
        var bubble = document.getElementById('nacho-bubble');
        if (bubble && bubble.classList.contains('show')) return;
        if (document.getElementById('badgeCelebration')) return; // another badge showing
        showBadgeToast(window._visibleBadgeQueue.shift());
    }, 5000);
}

// Called from ranking.js after Firebase restores user data
window.markVisibleBadgesReady = function() {
    // Merge any badges from Firebase that aren't in localStorage
    var saved = JSON.parse(localStorage.getItem('btc_badges') || '[]');
    saved.forEach(function(b) { earnedBadges.add(b); });

    // MIGRATION: Silently earn any badges whose conditions are ALREADY met
    // This prevents re-triggering popups for things done in previous sessions
    // Use Firestore data if available (localStorage may not be synced yet)
    var visited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]');
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.readChannels && currentUser.readChannels.length > visited.length) {
        visited = currentUser.readChannels;
    }
    var totalChannels = typeof CHANNELS !== 'undefined' ? Object.keys(CHANNELS).length : 146;
    var questsDone = typeof completedQuests !== 'undefined' ? completedQuests.size : 0;
    var migrated = false;

    // Only silently migrate badges that are confirmed in Firestore
    // Badges NOT in Firestore but whose conditions are met will be
    // handled by checkBadges() with full toast + points
    var firebaseBadges = [];
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.visibleBadges) {
        firebaseBadges = currentUser.visibleBadges;
    }
    for (var i = 0; i < firebaseBadges.length; i++) {
        if (!earnedBadges.has(firebaseBadges[i])) {
            earnedBadges.add(firebaseBadges[i]);
            migrated = true;
        }
    }

    if (migrated) {
        localStorage.setItem('btc_badges', JSON.stringify([...earnedBadges]));
        // visibleBadges is now CF-only (blocked from client writes). Migration is read-only here.
    }

    // Restore btc_badge_earned_* localStorage sentinel keys from earnedBadges set.
    // These are used as check() conditions for combo/set/weekly_hero badges.
    // If localStorage was cleared, these keys are gone and badges would re-fire.
    // Restoring them here prevents re-award toasts (server-side dedup catches XP anyway).
    // Restore ALL btc_badge_earned_* sentinel keys for every badge
    // whose check() reads that sentinel (combo/set/weekly_hero).
    // Extending to ALL badges that use the sentinel pattern prevents them
    // from re-firing on cache clear (the rollback in checkBadges will catch
    // truly unknown badges anyway, but this avoids the round-trip).
    var _sentinelPrefixes = [
        'combo_trio','combo_mega','combo_legend','weekly_hero',
        'set_miner_complete','set_scholar_complete','set_social_complete',
        'set_streak_complete','set_pvp_complete','set_builder_complete',
        'set_explorer_complete','set_fun_complete','set_beats_complete',
        'set_daily_complete','set_irl_complete','set_lightning_complete',
        'set_pow_complete','set_profile_complete','set_spin_complete',
        'set_tctv_complete','set_trails_complete','set_trifecta_complete'
    ];
    _sentinelPrefixes.forEach(function(id) {
        if (earnedBadges.has(id)) {
            try { localStorage.setItem('btc_badge_earned_' + id, '1'); } catch(e) {}
        }
    });

    // Restore btc_visited_channels from currentUser.readChannels if localStorage was cleared.
    // Prevents exploration badges from re-firing on cache clear.
    try {
        var _lsVisited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]');
        if (typeof currentUser !== 'undefined' && currentUser && Array.isArray(currentUser.readChannels)
            && currentUser.readChannels.length > _lsVisited.length) {
            localStorage.setItem('btc_visited_channels', JSON.stringify(currentUser.readChannels));
        }
    } catch(e) {}

    window._visibleBadgesReady = true;
};

// Safety: allow badges after 20 seconds if Firebase is slow.
// Only fires for anonymous/unauthenticated users — real-user Firestore load
// calls markVisibleBadgesReady() explicitly, so we don't want to race it.
// If a real user's Firestore load genuinely takes >20s (very slow network),
// wait an additional 10s to give it one more chance before unlocking.
setTimeout(function() {
    if (window._visibleBadgesReady) return;
    // Check if we're waiting on a real user's Firestore load
    var isRealUser = typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous;
    if (isRealUser) {
        // Real user — give Firestore another 10s before forcing unlock
        setTimeout(function() {
            if (!window._visibleBadgesReady) {
                if (typeof window.markVisibleBadgesReady === 'function') window.markVisibleBadgesReady();
                else window._visibleBadgesReady = true;
            }
        }, 10000);
    } else {
        // Anonymous or no user — safe to unlock immediately
        if (typeof window.markVisibleBadgesReady === 'function') window.markVisibleBadgesReady();
        else window._visibleBadgesReady = true;
    }
}, 20000);

function checkBadges() {
    // Wait until Firebase has restored earned badges
    if (!window._visibleBadgesReady) return;
    // Don't pop badges while Nacho is busy
    if (window._nachoBusy) return;

    // Extra guard: sync earnedBadges from Firestore visibleBadges in case of race condition
    // (e.g. cache cleared, currentUser loaded but markVisibleBadgesReady not yet called)
    var _fsVisibleBadges = (typeof currentUser !== 'undefined' && currentUser && Array.isArray(currentUser.visibleBadges))
        ? currentUser.visibleBadges : [];
    _fsVisibleBadges.forEach(function(bid) { earnedBadges.add(bid); });

    const visited = JSON.parse(localStorage.getItem('btc_visited_channels') || '[]');
    const totalChannels = typeof CHANNELS !== 'undefined' ? Object.keys(CHANNELS).length : 146;
    const questsDone = typeof completedQuests !== 'undefined' ? completedQuests.size : 0;

    for (const badge of BADGE_DEFS) {
        if (earnedBadges.has(badge.id)) continue;
        try {
            if (badge.check(visited, totalChannels, questsDone)) {
                earnedBadges.add(badge.id);
                localStorage.setItem('btc_badges', JSON.stringify([...earnedBadges]));

                // Raid Boss contribution
                if (typeof window._raidOnBadgeEarned === 'function') window._raidOnBadgeEarned();

                // Queue badge popup if Nacho is busy or bubble is open
                var bubble = document.getElementById('nacho-bubble');
                if (window._nachoBusy || (bubble && bubble.classList.contains('show'))) {
                    if (!window._visibleBadgeQueue) window._visibleBadgeQueue = [];
                    if (!_toastedThisSession.has(badge.id)) {
                            _toastedThisSession.add(badge.id);
                            window._visibleBadgeQueue.push(badge);
                        }
                } else {
                    if (!_toastedThisSession.has(badge.id)) {
                        _toastedThisSession.add(badge.id);
                        showBadgeToast(badge);
                    }
                }

                // Award points and gate Satoshi's Favor on server confirmation.
                // If awardPoints returns success:false (unknown badge, already awarded, etc.)
                // roll back earnedBadges so the badge can retry next session instead of
                // silently persisting forever without a badge_awards dedup entry.
                // This also prevents the SF daily re-award abuse: contributeSatoshiFavor
                // only fires once the CF confirms the badge was genuinely first-awarded.
                var badgePts = badge.pts || 20;
                var _badgeRef = badge; // closure capture
                if (typeof awardPoints === 'function') {
                    awardPoints(badgePts, 'Badge: ' + badge.name + ' ' + badge.emoji, null, null, null, badge.id)
                        .then(function(result) {
                            // awardPoints returns undefined for anon users (local path) — treat as success
                            // 'Badge already awarded' = server dedup fired (badge is legit, just re-check)
                            // 'Unknown badge' = badge not in CF catalog (stale deploy, etc.) — roll back
                            var data = result && result.data;
                            var _alreadyAwarded = data &&
                                (data.badgeDuplicate === true || data.error === 'Badge already awarded');
                            var serverRejected = data && data.success === false && !_alreadyAwarded;
                            if (serverRejected) {
                                earnedBadges.delete(_badgeRef.id);
                                localStorage.setItem('btc_badges', JSON.stringify([...earnedBadges]));
                            }
                        })
                        .catch(function() {
                            // Network/CF error — roll back so the badge can retry.
                            earnedBadges.delete(_badgeRef.id);
                            localStorage.setItem('btc_badges', JSON.stringify([...earnedBadges]));
                        });
                }
                // visibleBadges is now written server-side by the awardPoints CF
                // (blocked from client writes in firestore.rules — [AUDIT FIX H-2])
            }
        } catch(e) {}
    }

    // Check and award titles based on currently earned badges
    if (typeof TITLE_DEFS !== 'undefined' && window._checkAndAwardTitles) {
        window._checkAndAwardTitles([...earnedBadges]);
    }
}

// Award titles when max-tier badges are earned
window._checkAndAwardTitles = function(earnedBadgeIds) {
    var u = typeof currentUser !== 'undefined' ? currentUser : null;
    if (!u) return;
    var currentTitles = u.earnedTitles || [];
    var newTitles = [];
    TITLE_DEFS.forEach(function(t) {
        if (earnedBadgeIds.indexOf(t.requiredBadge) !== -1 && currentTitles.indexOf(t.id) === -1) {
            newTitles.push(t.id);
        }
    });
    if (newTitles.length === 0) return;
    // Merge and save to Firestore
    var merged = currentTitles.concat(newTitles);
    if (typeof currentUser !== 'undefined' && currentUser) currentUser.earnedTitles = merged;
    if (typeof db !== 'undefined' && db && typeof auth !== 'undefined' && auth && auth.currentUser) {
        db.collection('users').doc(auth.currentUser.uid).update({ earnedTitles: merged });
    }
    // Toast/announce each new title
    newTitles.forEach(function(tid) {
        var tDef = TITLE_DEFS.find(function(x) { return x.id === tid; });
        if (tDef && typeof showToast === 'function') {
            showToast('🎖️ New Title Unlocked: ' + tDef.emoji + ' ' + tDef.title + '!');
        }
    });
};

// Major badges that deserve a share prompt
const MAJOR_BADGES = ['explorer_50', 'explorer_100', 'explorer_all', 'properties_all', 'quest_5', 'quest_25', 'quest_100', 'cert_scholar', 'cert_tech', 'cert_double', 'all_certs', 'gift_open_1500', 'gift_sent_200', 'cipher_sats_10k', 'peer_level_6', 'raffle_1000'];

// Displayed XP is the shared table (window.BADGE_CATALOG, generated from
// functions/src/badge-xp.json). The badge object's own pts is only a fallback.
function badgeShownXp(badge) {
    if (!badge) return 0;
    var cat = (typeof window !== 'undefined' && window.BADGE_CATALOG) ? window.BADGE_CATALOG[badge.id] : null;
    if (cat && typeof cat.xp === 'number') return cat.xp;
    if (typeof badge.xp === 'number') return badge.xp;
    if (typeof badge.displayPts === 'number') return badge.displayPts;
    if (typeof badge.pts === 'number') return badge.pts;
    return 0;
}

// Displayed XP is the shared table (window.BADGE_CATALOG, generated from
// functions/src/badge-xp.json). The badge object's own pts is only a fallback.
function badgeShownXp(badge) {
    if (!badge) return 0;
    var cat = (typeof window !== 'undefined' && window.BADGE_CATALOG) ? window.BADGE_CATALOG[badge.id] : null;
    if (cat && typeof cat.xp === 'number') return cat.xp;
    if (typeof badge.xp === 'number') return badge.xp;
    if (typeof badge.displayPts === 'number') return badge.displayPts;
    if (typeof badge.pts === 'number') return badge.pts;
    return 0;
}

function showBadgeToast(badge) {
    // Notify
    if (typeof notifySelfBadge === 'function') notifySelfBadge(badge.name, badge.emoji);
    // Check if any badge set is now complete
    setTimeout(function() { if (typeof window._checkBadgeSets === 'function') window._checkBadgeSets(); }, 500);

    const isMajor = MAJOR_BADGES.includes(badge.id);

    // Minor badges: small toast + Option D (Bitcoin ding — bright fifth, ~300ms)
    if (!isMajor) {
        if (typeof showToast === 'function') {
            showToast(badge.emoji + ' Badge: ' + badge.name + ' (+' + badgeShownXp(badge) + ' XP)');
        }
        try {
            if ((typeof canPlaySound !== 'function' || canPlaySound()) && (typeof audioEnabled === 'undefined' || audioEnabled)) {
                var _actx = new (window.AudioContext || window.webkitAudioContext)();
                var _vol = typeof audioVolume !== 'undefined' ? audioVolume : 0.5;
                [[1046.50, 0], [1568.00, 0]].forEach(function(pair) {
                    var o = _actx.createOscillator(), g = _actx.createGain();
                    o.connect(g); g.connect(_actx.destination);
                    o.frequency.value = pair[0]; o.type = 'sine';
                    g.gain.setValueAtTime(0.18 * _vol, _actx.currentTime + pair[1]);
                    g.gain.exponentialRampToValueAtTime(0.001, _actx.currentTime + 0.35);
                    o.start(_actx.currentTime); o.stop(_actx.currentTime + 0.35);
                });
            }
        } catch(e) {}
        return;
    }

    // Major badges: full celebration
    playBadgeSound();
    if (typeof nachoFly === 'function') nachoFly();

    // Launch confetti
    launchConfetti();

    // Show celebration modal
    const overlay = document.createElement('div');
    overlay.id = 'badgeCelebration';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:400;display:flex;justify-content:center;align-items:center;animation:fadeIn 0.3s ease-out;';

    const username = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Bitcoiner';
    const shareText = 'I just earned the ' + badge.emoji + ' ' + badge.name + ' badge on Bitcoin Education Archive! ' + badge.desc;
    const shareUrl = 'https://bitcoineducation.quest';
    const twitterUrl = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText) + '&url=' + encodeURIComponent(shareUrl);

    let shareHtml = '';
    if (isMajor) {
        shareHtml = '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">' +
            '<p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:10px;">Share your achievement!</p>' +
            '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
            '<a href="' + twitterUrl + '" target="_blank" style="padding:8px 16px;background:#000;color:#fff;border-radius:8px;text-decoration:none;font-size:0.85rem;font-weight:600;">𝕏 Share on Twitter</a>' +
            '<button onclick="shareNostr(\'' + shareText.replace(/[\\'"]/g, "") + '\',\'' + shareUrl + '\')" style="padding:8px 16px;background:#7B2DE4;color:#fff;border:none;border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer;">🟣 Share on Nostr</button>' +
            '<button onclick="copyBadgeLink(\'' + badge.emoji + '\',\'' + badge.name.replace(/[\\'"]/g, "") + '\')" style="padding:8px 16px;background:var(--card-bg);color:var(--text);border:1px solid var(--border);border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer;">🔗 Copy Link</button>' +
            '</div></div>';
    }

    overlay.innerHTML = '<div style="background:var(--bg-side);border:1px solid var(--border);border-radius:20px;padding:40px;max-width:380px;width:90%;text-align:center;animation:fadeSlideIn 0.4s ease-out;">' +
        '<div style="font-size:4rem;margin-bottom:12px;animation:badgeBounce 0.6s ease-out;">' + badge.emoji + '</div>' +
        '<div style="color:#f7931a;font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;font-weight:800;margin-bottom:8px;">🎉 Badge Earned!</div>' +
        '<div style="color:var(--heading);font-size:1.4rem;font-weight:900;margin-bottom:8px;">' + badge.name + '</div>' +
        '<div style="color:var(--text-muted);font-size:0.95rem;margin-bottom:4px;">' + badge.desc + '</div>' +
        '<div style="color:var(--accent);font-size:0.9rem;font-weight:700;">+' + badgeShownXp(badge) + ' XP</div>' +
        shareHtml +
        '<button onclick="document.getElementById(\'badgeCelebration\').remove()" style="margin-top:20px;padding:10px 30px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;">Awesome! ✨</button>' +
        '</div>';

    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    // GGs posts for badge earns are written by the server, grouped per player.
}

function copyBadgeLink(emoji, name) {
    const text = 'I earned the ' + emoji + ' ' + name + ' badge on Bitcoin Education Archive!\nhttps://bitcoineducation.quest';
    navigator.clipboard.writeText(text).then(() => {
        if (typeof showToast === 'function') showToast('📋 Copied to clipboard!');
    });
}

// Confetti explosion
function launchConfetti() {
    const canvas = document.createElement('canvas');
    canvas.id = 'confettiCanvas';
    canvas.style.cssText = 'position:fixed;inset:0;z-index:500;pointer-events:none;';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const particles = [];
    const colors = ['#f7931a', '#ea580c', '#fbbf24', '#f59e0b', '#ff6b00', '#ff9500', '#ffb800', '#fff'];

    for (let i = 0; i < 120; i++) {
        particles.push({
            x: canvas.width / 2 + (Math.random() - 0.5) * 100,
            y: canvas.height / 2,
            vx: (Math.random() - 0.5) * 16,
            vy: (Math.random() - 1) * 16 - 4,
            size: Math.random() * 8 + 3,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 12,
            gravity: 0.12 + Math.random() * 0.08,
            opacity: 1,
            shape: Math.random() > 0.5 ? 'rect' : 'circle'
        });
    }

    let frame = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;
        particles.forEach(p => {
            p.x += p.vx;
            p.vy += p.gravity;
            p.y += p.vy;
            p.rotation += p.rotSpeed;
            p.vx *= 0.99;
            if (frame > 40) p.opacity -= 0.015;

            if (p.opacity > 0 && p.y < canvas.height + 50) {
                alive = true;
                ctx.save();
                ctx.globalAlpha = Math.max(0, p.opacity);
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation * Math.PI / 180);
                ctx.fillStyle = p.color;
                if (p.shape === 'rect') {
                    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
                } else {
                    ctx.beginPath();
                    ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }
        });
        frame++;
        if (alive && frame < 180) {
            requestAnimationFrame(animate);
        } else {
            canvas.remove();
        }
    }
    requestAnimationFrame(animate);
}

// Celebration sound
function playBadgeSound() {
    if (typeof canPlaySound === 'function' && !canPlaySound()) return;
    if (typeof audioEnabled !== 'undefined' && !audioEnabled) return;
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const vol = typeof audioVolume !== 'undefined' ? audioVolume : 0.5;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.15 * vol, audioCtx.currentTime + i * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.12 + 0.5);
            osc.start(audioCtx.currentTime + i * 0.12);
            osc.stop(audioCtx.currentTime + i * 0.12 + 0.5);
        });
    } catch(e) {}
}

function getBadgeHTML() {
    // Categorize badges
    var _used = {};
    function _cat(list, filter) { var r = list.filter(function(b) { return !_used[b.id] && !b.collectionBonus && filter(b); }); r.forEach(function(b) { _used[b.id] = true; }); return r; }
    const categories = {
        '🧭 Discovery': _cat(BADGE_DEFS, b => b.id.includes('explorer') || b.id === 'first_channel' || b.id === 'bookworm'),
        '🧠 Knowledge': _cat(BADGE_DEFS, b => b.id.includes('builder') || b.id.includes('diver') || b.id.includes('librarian') || b.id.includes('quest') || b.id.includes('cert_') || b.id === 'experienced_pro'),
        '🦌 Trails': _cat(BADGE_DEFS, b => b.id.startsWith('trail_')),
        '📖 Learning Quests': _cat(BADGE_DEFS, b => b.id.startsWith('lq_')),
        '💬 Global Chat': _cat(BADGE_DEFS, b => b.id.startsWith('chat_')),
        '🦌 Nacho': _cat(BADGE_DEFS, b => b.id.startsWith('nacho_') || b.id.startsWith('story_')),
        '📺 Timechain TV': _cat(BADGE_DEFS, b => b.id.startsWith('tctv_')),
        '🎧 DJ Mode': _cat(BADGE_DEFS, b => b.id.startsWith('dj_')),
        '🎵 Music': _cat(BADGE_DEFS, b => b.id.startsWith('producer') || b.id.startsWith('beats_')),
        '⚔️ PVP': _cat(BADGE_DEFS, b => b.id.startsWith('pvp_')),
        '📝 Forum': _cat(BADGE_DEFS, b => b.id.startsWith('forum_') || b.id.startsWith('article_')),
        '🔥 Streaks': _cat(BADGE_DEFS, b => b.id.startsWith('streak_')),
        '🤝 Community': _cat(BADGE_DEFS, b => b.id.startsWith('irl_') || b.id.startsWith('referral_') || b.id === 'global_citizen' || b.id === 'referred'),
        '👤 Profile': _cat(BADGE_DEFS, b => b.id.startsWith('profile_') || b.id === 'bio_author' || b.id === 'lightning_address_set'),
        '⚡ Sats & Lightning': _cat(BADGE_DEFS, b => b.id.startsWith('sats_') || b.id === 'lightning_setup' || b.id.startsWith('tip_')),
        '🔮 Predictions': _cat(BADGE_DEFS, b => b.id.startsWith('predict_')),
        '💬 Social': _cat(BADGE_DEFS, b => b.id.startsWith('dm_') || b.id === 'react_50' || b.id === 'react_5' || b.id === 'react_200' || b.id === 'first_peer' || b.id.startsWith('peer_network_')),
        '🚶 Proof of Walk': _cat(BADGE_DEFS, b => b.id.startsWith('pow_')),
        '🎡 Spin Wheel': _cat(BADGE_DEFS, b => b.id.startsWith('spin_')),
        '⛏️ Satoshi\'s Favor': _cat(BADGE_DEFS, b => b.id.startsWith('sf_')),
        '🐲 Raid Boss': _cat(BADGE_DEFS, b => b.id.startsWith('raid_')),
        '🌙 Fun': _cat(BADGE_DEFS, b => b.id === 'night_owl' || b.id === 'early_bird'),
        '💪 Daily Quest Hub': _cat(BADGE_DEFS, b => b.id.startsWith('flex_') || b.id.startsWith('trivia_') || b.id.startsWith('poll_') || b.id.startsWith('daily_triple')),
        '🛒 Marketplace': _cat(BADGE_DEFS, b => b.id.startsWith('market_') || b.id === 'bookmarks_1' || b.id === 'bookmarks_10' || b.id === 'favs_10' || b.id === 'favs_25'),
        '🎁 Gifts': _cat(BADGE_DEFS, b => b.id.startsWith('gift_')),
        '🔐 Ciphers': _cat(BADGE_DEFS, b => b.id.startsWith('cipher_')),
        '🤝 Peers': _cat(BADGE_DEFS, b => b.id.startsWith('peer_level_') || b.id.startsWith('peer_hub_') || b.id.startsWith('key_peers_')),
        '💬 Topics': _cat(BADGE_DEFS, b => b.id.startsWith('topic_')),
        '🎟️ Raffle & Nook': _cat(BADGE_DEFS, b => b.id.startsWith('raffle_') || b.id.startsWith('shop_') || b.id === 'first_purchase'),
        '🔒 Setup': _cat(BADGE_DEFS, b => b.id === 'totp_enabled' || b.id === 'faction_chosen' || b.id === 'onboarding_complete' || b.id === 'push_enabled'),
        '🏆 Milestones': _cat(BADGE_DEFS, b => !_used[b.id])
    };

    // Sort ALL categories strictly alphabetically by label (strip emoji for sort key)
    var _sortedCatKeys = Object.keys(categories).sort(function(a, b) {
        var _strip = function(s) { return s.replace(/^[^a-zA-Z]+/, '').toLowerCase(); };
        return _strip(a).localeCompare(_strip(b));
    });
    var _sortedCategories = {};
    _sortedCatKeys.forEach(function(k) { _sortedCategories[k] = categories[k]; });

    // Build a reverse-lookup map: badgeId → category name (used by search tooltip + grid hover)
    window._badgeCatMap = {};
    Object.keys(categories).forEach(function(catName) {
        (categories[catName] || []).forEach(function(b) { window._badgeCatMap[b.id] = catName; });
    });
    // Also map hidden/goal badges to a catch-all
    if (typeof HIDDEN_BADGES !== 'undefined') HIDDEN_BADGES.forEach(function(b) {
        if (!window._badgeCatMap[b.id]) window._badgeCatMap[b.id] = '🏆 Milestones';
    });

    let html = '<style>' +
        '.badge-cat-title { color: var(--text-faint); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1.5px; margin: 20px 0 10px; font-weight: 800; display: flex; align-items:center; gap: 8px; }' +
        '.badge-cat-title::after { content: ""; flex: 1; height: 1px; background: var(--border); opacity: 0.5; }' +
        '.badges-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(75px, 1fr)); gap: 10px; padding: 4px; }' +
        '.locked .badge-emoji { filter: grayscale(1) opacity(0.2); transition: 0.3s; }' +
        '.badge-item.locked:hover .badge-emoji { filter: grayscale(1) opacity(0.5); }' +
        '.badge-item.badge-search-highlight { border-color: var(--accent) !important; box-shadow: 0 0 0 2px rgba(247,147,26,0.4); animation: badgeHighlightPop 0.4s ease; }' +
        '@keyframes badgeHighlightPop { 0% { transform:scale(1); } 50% { transform:scale(1.12); } 100% { transform:scale(1); } }' +
        '</style>';

    // Badge count summary
    var _totalEarnable = BADGE_DEFS.filter(function(b) { if (b.collectionBonus) return false; try { return b.check.toString().trim() !== '() => false'; } catch(e) { return true; } }).length;
    var _hiddenEarnable = typeof HIDDEN_BADGES !== 'undefined' ? HIDDEN_BADGES.filter(function(b) { return b.hidden; }).length : 0;
    var _hiddenEarned = (JSON.parse(localStorage.getItem('btc_hidden_badges') || '[]')).length;
    var _earnedCount = earnedBadges.size;
    // Add dynamic FLEX per-action badges (20 actions × 8 milestones = 160)
    var _flexDynamic = (typeof FLEX_ACTIONS !== 'undefined' && typeof FLEX_BADGE_MILESTONES !== 'undefined') ? FLEX_ACTIONS.length * FLEX_BADGE_MILESTONES.length : 160;
    var _grandTotal = _totalEarnable + _hiddenEarnable + _flexDynamic;
    var _grandEarned = _earnedCount + _hiddenEarned;
    var _pct = Math.round((_grandEarned / _grandTotal) * 100);
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding:10px 14px;background:var(--card-bg,#111);border:1px solid var(--border);border-radius:12px;">' +
        '<span style="font-size:0.85rem;color:var(--text-muted);">🏅 <strong style="color:var(--text);">' + _grandEarned + '</strong> / ' + _grandTotal + ' badges earned</span>' +
        '<span style="font-size:0.78rem;font-weight:700;color:' + (_pct >= 75 ? '#f7931a' : _pct >= 40 ? '#4caf50' : 'var(--text-faint)') + ';">' + _pct + '%</span>' +
        '</div>';

    // Badge search bar
    html += '<div style="margin-bottom:14px;">' +
        '<div style="position:relative;">' +
        '<input id="badgeSearchInput" type="text" placeholder="🔍 Search badges..." oninput="window._badgeSearch(this.value)" style="width:100%;padding:10px 36px 10px 14px;background:var(--input-bg,#111);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.88rem;font-family:inherit;outline:none;box-sizing:border-box;">' +
        '<button onclick="document.getElementById(\'badgeSearchInput\').value=\'\';window._badgeSearch(\'\')" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-faint);font-size:1rem;cursor:pointer;padding:0;line-height:1;">✕</button>' +
        '</div>' +
        '<div id="badgeSearchResults" style="display:none;margin-top:8px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;overflow:hidden;"></div>' +
        '</div>';

        // Build all category sections into a sortable map, then render in strict alpha order
    var _sections = {}; // sortKey -> html string
    var _bcIdx = 0;
    var _strip = function(s) { return s.replace(/^[^a-zA-Z]+/, '').toLowerCase(); };

    for (const [catName, badgeList] of Object.entries(_sortedCategories)) {
        if (badgeList.length === 0) continue;
        _bcIdx++;
        var _bcId = 'bc_' + _bcIdx;
        const catEarned = badgeList.filter(b => earnedBadges.has(b.id)).length;
        const allEarned = catEarned === badgeList.length;
        var _sec = '';
        _sec += '<div style="margin-bottom:6px;border:1px solid ' + (allEarned ? 'rgba(34,197,94,0.3)' : 'var(--border)') + ';border-radius:10px;overflow:visible;">';
        _sec += '<button onclick="var c=document.getElementById(\'' + _bcId + '\');c.style.display=c.style.display===\'none\'?\'grid\':\'none\';this.querySelector(\'.bca\').textContent=c.style.display===\'none\'?\'▶\':\'▼\'" style="width:100%;padding:10px 12px;background:' + (allEarned ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)') + ';border:none;cursor:pointer;display:flex;align-items:center;gap:8px;font-family:inherit;touch-action:manipulation;">';
        _sec += '<span class="bca" style="color:var(--text-faint);font-size:0.7rem;">▶</span>';
        _sec += '<span style="color:var(--text);font-size:0.8rem;font-weight:700;">' + catName + '</span>';
        _sec += '<span style="margin-left:auto;font-size:0.7rem;color:' + (allEarned ? '#22c55e' : 'var(--accent)') + ';font-weight:700;">' + catEarned + '/' + badgeList.length + (allEarned ? ' ✅' : '') + '</span>';
        _sec += '</button>';
        _sec += '<div id="' + _bcId + '" class="badges-grid" style="display:none;">';
        for (const badge of badgeList) {
            const earned = earnedBadges.has(badge.id);
            const shownPts = badgeShownXp(badge);
            const requirementsText = !earned ? '<div style="margin-top:5px;padding-top:5px;border-top:1px solid rgba(255,255,255,0.1);color:var(--accent);font-weight:700;">How to earn: ' + badge.desc + '</div>' : '';
            const tip = earned ? '✅ ' + badge.desc + ' (+' + shownPts + ' XP)' : '🔒 Locked — ' + badge.desc + ' <span style="color:var(--accent);font-weight:700;">(+' + shownPts + ' XP)</span>';
            _sec += '<div class="badge-item ' + (earned ? 'earned' : 'locked') + '" data-badge-id="' + badge.id + '" data-badge-cat="' + escapeHtml(catName) + '" title="' + escapeHtml(badge.desc) + '" onclick="window._showBadgeTip(event,this)" style="padding:10px 5px; background:var(--card-bg); border-radius:12px; border:1px solid var(--border); overflow:visible;">' +
                '<div class="badge-emoji" style="font-size:1.8rem; margin-bottom:4px;">' + (earned ? badge.emoji : (badge.lockedEmoji || '🔘')) + '</div>' +
                '<div class="badge-name" style="font-size:0.6rem; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + badge.name + '</div>' +
                '<div class="badge-xp" style="font-size:0.55rem;color:var(--accent);font-weight:700;margin-top:1px;">+' + shownPts + ' XP</div>' +
                '<div class="badge-tooltip" style="white-space:normal; min-width:150px; line-height:1.4; z-index:200;">' + tip + requirementsText + '</div>' +
            '</div>';
        }
        _sec += '</div></div>';
        _sections[_strip(catName)] = _sec;
    }

    // Dynamic FLEX Per-Action badges — 20 actions × 8 milestones = 160
    if (typeof FLEX_ACTIONS !== 'undefined' && typeof FLEX_BADGE_MILESTONES !== 'undefined') {
        _bcIdx++;
        var _flexCatId = 'bc_' + _bcIdx;
        var _flexCatName = '💪 Flex Per-Action';
        var _flexEarned = 0, _flexTotal = 0;
        var _flexSec = '';
        _flexSec += '<div style="margin-bottom:6px;border:1px solid var(--border);border-radius:10px;overflow:visible;">';
        _flexSec += '<button onclick="var c=document.getElementById(\''+_flexCatId+'\');c.style.display=c.style.display===\'none\'?\'grid\':\'none\';this.querySelector(\'.bca\').textContent=c.style.display===\'none\'?\'\u25b6\':\'\u25bc\'" style="width:100%;padding:10px 12px;background:rgba(255,255,255,0.03);border:none;cursor:pointer;display:flex;align-items:center;gap:8px;font-family:inherit;touch-action:manipulation;">';
        _flexSec += '<span class="bca" style="color:var(--text-faint);font-size:0.7rem;">▶</span>';
        _flexSec += '<span style="color:var(--text);font-size:0.8rem;font-weight:700;">' + _flexCatName + '</span>';
        // Count earned dynamically
        var _allFlexBadgeIds = [];
        FLEX_ACTIONS.forEach(function(a) {
            FLEX_BADGE_MILESTONES.forEach(function(m) { _allFlexBadgeIds.push('flex_' + a.id + '_' + m); });
        });
        _flexEarned = _allFlexBadgeIds.filter(function(bid) { return earnedBadges.has(bid); }).length;
        _flexTotal = _allFlexBadgeIds.length;
        _flexSec += '<span style="margin-left:auto;font-size:0.7rem;color:var(--accent);font-weight:700;">' + _flexEarned + '/' + _flexTotal + '</span>';
        _flexSec += '</button>';
        _flexSec += '<div id="' + _flexCatId + '" class="badges-grid" style="display:none;">';
        FLEX_ACTIONS.forEach(function(a) {
            FLEX_BADGE_MILESTONES.forEach(function(m) {
                var bid = 'flex_' + a.id + '_' + m;
                var earned = earnedBadges.has(bid);
                var bname = a.name + ' ×' + m;
                var bdesc = 'Did "' + a.name + '" ' + m + ' time' + (m === 1 ? '' : 's');
                var flexBadge = { id: bid, name: bname, desc: bdesc, emoji: a.emoji };
                _flexSec += '<div class="badge-item ' + (earned ? 'earned' : 'locked') + '" data-badge-id="' + bid + '" data-badge-cat="' + escapeHtml(_flexCatName) + '" title="' + escapeHtml(bdesc) + '" onclick="window._showBadgeTip(event,this)" style="padding:10px 5px;background:var(--card-bg);border-radius:12px;border:1px solid var(--border);overflow:visible;">' +
                    '<div class="badge-emoji" style="font-size:1.8rem;margin-bottom:4px;">' + (earned ? a.emoji : '🔘') + '</div>' +
                    '<div style="font-size:0.65rem;font-weight:700;color:' + (earned ? 'var(--heading)' : 'var(--text-faint)') + ';text-align:center;line-height:1.2;">' + escapeHtml(bname) + '</div>' +
                    '<div class="badge-xp" style="font-size:0.55rem;color:var(--accent);font-weight:700;margin-top:1px;">+' + badgeShownXp(flexBadge) + ' XP</div>' +
                    '</div>';
            });
        });
        _flexSec += '</div></div>';
        _sections['flex per-action'] = _flexSec; // 'z_' puts it near the end alphabetically
    }

    // Goals and Secret Badges — build and slot into the same sorted map
    if (typeof HIDDEN_BADGES !== 'undefined') {
        const earnedHidden = JSON.parse(localStorage.getItem('btc_hidden_badges') || '[]');

        // Goals section
        const visibleGoals = HIDDEN_BADGES.filter(function(b) { return !b.hidden; });
        if (visibleGoals.length > 0) {
            _bcIdx++;
            var _goalId = 'bc_' + _bcIdx;
            var goalEarned = visibleGoals.filter(function(b) { return earnedHidden.includes(b.id); }).length;
            var allGoalsEarned = goalEarned === visibleGoals.length;
            var _gsec = '';
            _gsec += '<div style="margin-bottom:6px;border:1px solid ' + (allGoalsEarned ? 'rgba(34,197,94,0.3)' : 'var(--border)') + ';border-radius:10px;overflow:visible;">';
            _gsec += '<button onclick="var c=document.getElementById(\'' + _goalId + '\');c.style.display=c.style.display===\'none\'?\'grid\':\'none\';this.querySelector(\'.bca\').textContent=c.style.display===\'none\'?\'▶\':\'▼\'" style="width:100%;padding:10px 12px;background:' + (allGoalsEarned ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)') + ';border:none;cursor:pointer;display:flex;align-items:center;gap:8px;font-family:inherit;touch-action:manipulation;">';
            _gsec += '<span class="bca" style="color:var(--text-faint);font-size:0.7rem;">▶</span>';
            _gsec += '<span style="color:var(--text);font-size:0.8rem;font-weight:700;">🎯 Goals</span>';
            _gsec += '<span style="margin-left:auto;font-size:0.7rem;color:' + (allGoalsEarned ? '#22c55e' : 'var(--accent)') + ';font-weight:700;">' + goalEarned + '/' + visibleGoals.length + (allGoalsEarned ? ' ✅' : '') + '</span>';
            _gsec += '</button>';
            _gsec += '<div id="' + _goalId + '" class="badges-grid" style="display:none;">';
            for (const badge of visibleGoals) {
                const unlocked = earnedHidden.includes(badge.id);
                const progressText = (!unlocked && badge.progress) ? badge.progress() : '';
                const hintText = (!unlocked && badge.hint) ? badge.hint : '';
                _gsec += '<div class="badge-item ' + (unlocked ? 'earned' : 'locked') + '" data-badge-id="' + badge.id + '" data-badge-cat="🎯 Goals" style="position:relative;padding:10px 5px;background:var(--card-bg);border-radius:12px;border:1px solid var(--border);overflow:visible;" onclick="window._showBadgeTip(event,this)">' +
                    '<div class="badge-emoji" style="font-size:1.8rem;margin-bottom:4px;">' + (unlocked ? badge.emoji : '🔒') + '</div>' +
                    '<div class="badge-name" style="font-size:0.6rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + badge.name + '</div>' +
                    '<div class="badge-xp" style="font-size:0.55rem;color:var(--accent);font-weight:700;margin-top:1px;">+' + badgeShownXp(badge) + ' XP</div>' +
                    (progressText ? '<div style="font-size:0.55rem;color:var(--accent);font-weight:700;margin-top:1px;">' + progressText + '</div>' : '') +
                    '<div class="badge-tooltip" style="white-space:normal;min-width:150px;line-height:1.4;z-index:200;">' + (unlocked ? '✅ ' + badge.desc + ' (+' + badgeShownXp(badge) + ' XP)' : '🔒 ' + badge.desc + (hintText ? ' — ' + hintText : '') + ' <span style="color:var(--accent);font-weight:700;">(+' + badgeShownXp(badge) + ' XP)</span>') + '</div>' +
                '</div>';
            }
            _gsec += '</div></div>';
            _sections['goals'] = _gsec; // 'goals' sorts under G
        }

        // Secret Badges section
        const hiddenBadges = HIDDEN_BADGES.filter(function(b) { return b.hidden; });
        const anyHiddenEarned = hiddenBadges.some(function(b) { return earnedHidden.includes(b.id); });
        const hiddenCount = hiddenBadges.length;
        const hiddenEarnedCount = hiddenBadges.filter(function(b) { return earnedHidden.includes(b.id); }).length;
        _bcIdx++;
        var _secretId = 'bc_' + _bcIdx;
        var allSecretsEarned = hiddenEarnedCount === hiddenCount;
        var _ssec = '';
        _ssec += '<div style="margin-bottom:6px;border:1px solid ' + (allSecretsEarned ? 'rgba(34,197,94,0.3)' : 'var(--border)') + ';border-radius:10px;overflow:visible;">';
        _ssec += '<button onclick="var c=document.getElementById(\'' + _secretId + '\');c.style.display=c.style.display===\'none\'?\'grid\':\'none\';this.querySelector(\'.bca\').textContent=c.style.display===\'none\'?\'▶\':\'▼\'" style="width:100%;padding:10px 12px;background:' + (allSecretsEarned ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)') + ';border:none;cursor:pointer;display:flex;align-items:center;gap:8px;font-family:inherit;touch-action:manipulation;">';
        _ssec += '<span class="bca" style="color:var(--text-faint);font-size:0.7rem;">▶</span>';
        _ssec += '<span style="color:var(--text);font-size:0.8rem;font-weight:700;">🔮 Secret Badges</span>';
        _ssec += '<span style="margin-left:auto;font-size:0.7rem;color:' + (allSecretsEarned ? '#22c55e' : 'var(--accent)') + ';font-weight:700;">' + hiddenEarnedCount + '/' + hiddenCount + (allSecretsEarned ? ' ✅' : '') + '</span>';
        _ssec += '</button>';
        _ssec += '<div id="' + _secretId + '" class="badges-grid" style="display:none;">';
        if (anyHiddenEarned) {
            for (const badge of hiddenBadges) {
                const unlocked = earnedHidden.includes(badge.id);
                _ssec += '<div class="badge-item ' + (unlocked ? 'earned' : 'locked') + '" data-badge-id="' + badge.id + '" data-badge-cat="🔮 Secret Badges" onclick="window._showBadgeTip(event,this)" style="padding:10px 5px;background:var(--card-bg);border-radius:12px;border:1px solid var(--border);overflow:visible;">' +
                    '<div class="badge-emoji" style="font-size:1.8rem;margin-bottom:4px;">' + (unlocked ? badge.emoji : '❓') + '</div>' +
                    '<div class="badge-name" style="font-size:0.6rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (unlocked ? badge.name : '???') + '</div>' +
                    (unlocked ? '<div class="badge-xp" style="font-size:0.55rem;color:var(--accent);font-weight:700;margin-top:1px;">+' + badgeShownXp(badge) + ' XP</div>' : '') +
                    '<div class="badge-tooltip" style="white-space:normal;min-width:150px;line-height:1.4;z-index:200;">' + (unlocked ? '✅ ' + badge.desc + ' (+' + badgeShownXp(badge) + ' XP)' : '🔒 Keep exploring!') + '</div>' +
                '</div>';
            }
        } else {
            _ssec += '<div style="text-align:center;padding:10px;color:var(--text-faint);font-size:0.8rem;grid-column:1/-1;">' +
                hiddenCount + ' secret badges waiting to be discovered... 🔮</div>';
        }
        _ssec += '</div></div>';
        _sections['secret badges'] = _ssec; // 'secret badges' sorts under S
    }

    // Render all sections in strict alphabetical order
    Object.keys(_sections).sort(function(a, b) { return a.localeCompare(b); }).forEach(function(k) {
        html += _sections[k];
    });

    // 🏅 BADGE COLLECTIONS / SETS SECTION
    html += _renderBadgeSets(earnedBadges);

    return html;
}

// ============================================================
// 🏅 BADGE SETS (Collections)
// ============================================================
var BADGE_SETS = [
    { id:'set_beats', name:'The Beats Set', emoji:'🎵', color:'#f472b6', badgeIds:['beats_first_listen','beats_50_plays','beats_100_plays','beats_200_plays','beats_500_plays','beats_liked_10','beats_liked_50','beats_comment_1','dj_first','dj_5','dj_25','dj_songs_10','dj_songs_50','dj_songs_100'], bonusId:'set_beats_complete', bonusPts:0, bonusEmoji:'🎤', bonusName:'Beats Maestro', bonusDesc:'Completed The Beats Set' },
    { id:'set_builder', name:'The Builder Set', emoji:'🏗️', color:'#22c55e', badgeIds:['producer_1','producer_10','forum_first','forum_10','market_listed_1'], bonusId:'set_builder_complete', bonusPts:500, bonusEmoji:'🔧', bonusName:'Archive Builder', bonusDesc:'Completed The Builder Set' },
    { id:'set_fun', name:'The Calendar Set', emoji:'📅', color:'#f59e0b', badgeIds:['fun_weekend','fun_friday','fun_midnight','fun_bitcoin_birthday','fun_whitepaper_day','fun_new_year','fun_halving_day','fun_pi_day'], bonusId:'set_fun_complete', bonusPts:0, bonusEmoji:'🎊', bonusName:'Bitcoin Calendar Hero', bonusDesc:'Completed The Calendar Set' },
    { id:'set_daily', name:'The Daily Set', emoji:'🎯', color:'#3b82f6', badgeIds:['daily_1','daily_5','daily_10','daily_25','daily_50','daily_100'], bonusId:'set_daily_complete', bonusPts:0, bonusEmoji:'🏅', bonusName:'Challenge Master', bonusDesc:'Completed The Daily Set' },
    { id:'set_explorer', name:'The Explorer Set', emoji:'🧭', color:'#06b6d4', badgeIds:['first_channel','explorer_5','explorer_10','explorer_25','explorer_50','explorer_100','explorer_all'], bonusId:'set_explorer_complete', bonusPts:500, bonusEmoji:'🗺️', bonusName:'World Traveler', bonusDesc:'Completed The Explorer Set' },
    { id:'set_pvp', name:'The Fighter Set', emoji:'⚔️', color:'#ec4899', badgeIds:['pvp_first','pvp_5','pvp_25','pvp_50','pvp_100'], bonusId:'set_pvp_complete', bonusPts:750, bonusEmoji:'👑', bonusName:'Arena Champion', bonusDesc:'Completed The Fighter Set' },
    { id:'set_irl', name:'The IRL Set', emoji:'🤝', color:'#10b981', badgeIds:['irl_host','irl_host_5','irl_host_10','irl_attend_1','irl_attend_5'], bonusId:'set_irl_complete', bonusPts:0, bonusEmoji:'🌍', bonusName:'Community Anchor', bonusDesc:'Completed The IRL Set' },
    { id:'set_lightning', name:'The Lightning Set', emoji:'⚡', color:'#eab308', badgeIds:['tip_first','tip_10','tip_whale','tip_sats_10k','tip_received_1','tip_magnet','tip_received_50','sats_first','sats_1k','sats_5k','sats_10k','sats_21k'], bonusId:'set_lightning_complete', bonusPts:0, bonusEmoji:'⚡', bonusName:'Lightning Lord', bonusDesc:'Completed The Lightning Set' },
    { id:'set_miner', name:'The Miner Set', emoji:'⛏️', color:'#f7931a', badgeIds:['sf_first_hash','sf_10_hashes','sf_100_hashes','sf_1000_hashes','sf_low_hash','sf_block_solver','sf_lucky_1','sf_lucky_5','sf_lucky_10','sf_lucky_50','sf_lucky_100','sf_lucky_1000','sf_unlucky_1','sf_unlucky_5','sf_unlucky_10','sf_unlucky_50','sf_unlucky_100','sf_unlucky_1000'], bonusId:'set_miner_complete', bonusPts:0, bonusEmoji:'🏆', bonusName:'Master Miner', bonusDesc:'Completed The Miner Set' },
    { id:'set_pow', name:'The Proof of Walk Set', emoji:'🚶', color:'#84cc16', badgeIds:['pow_first_step','pow_km_10','pow_km_50','pow_km_100','pow_km_500','pow_km_1000','pow_km_5000','pow_streak_3','pow_streak_7','pow_streak_30','pow_marathoner'], bonusId:'set_pow_complete', bonusPts:0, bonusEmoji:'🌍', bonusName:'Distance Legend', bonusDesc:'Completed The Proof of Walk Set' },
    { id:'set_scholar', name:'The Scholar Set', emoji:'📚', color:'#3b82f6', badgeIds:['trivia_correct_1','trivia_correct_10','trivia_correct_30','trivia_correct_100','trivia_streak_7','trivia_streak_30','cert_scholar','cert_tech','cert_double','daily_100'], bonusId:'set_scholar_complete', bonusPts:0, bonusEmoji:'🎓', bonusName:'Satoshi Scholar', bonusDesc:'Completed The Scholar Set' },
    { id:'set_social', name:'The Social Set', emoji:'💬', color:'#8b5cf6', badgeIds:['chat_first','chat_10','chat_50','chat_100','chat_200','dm_first','dm_10','peer_1'], bonusId:'set_social_complete', bonusPts:500, bonusEmoji:'🌐', bonusName:'Community Pillar', bonusDesc:'Completed The Social Set' },
    { id:'set_streak', name:'The Streak Set', emoji:'🔥', color:'#ef4444', badgeIds:['streak_3','streak_7','streak_14','streak_30','streak_60','streak_100','streak_200','streak_365'], bonusId:'set_streak_complete', bonusPts:1000, bonusEmoji:'💎', bonusName:'Diamond Hands', bonusDesc:'Completed The Streak Set' },
    { id:'set_tctv', name:'The Timechain TV Set', emoji:'📺', color:'#a855f7', badgeIds:['tctv_tuned_in','tctv_couch_potato','tctv_binge_watcher','tctv_couch_king','tctv_satellite','tctv_channel_hopper','tctv_remote_warrior','tctv_dial_spinner','tctv_signal_seeker','tctv_antenna_wizard','tctv_timechain_surfer'], bonusId:'set_tctv_complete', bonusPts:0, bonusEmoji:'🛸', bonusName:'Timechain Veteran', bonusDesc:'Completed The Timechain TV Set' },
    { id:'set_trails', name:'The Trails Set', emoji:'🥾', color:'#22c55e', badgeIds:['trail_started','trail_meadow','trail_mountain','trail_summit','trail_all','trail_double','trail_perfectionist','trail_speed_3','trail_meadow_fast','trail_revisit'], bonusId:'set_trails_complete', bonusPts:0, bonusEmoji:'🏔️', bonusName:'Trail Blazer', bonusDesc:'Completed The Trails Set' },
    { id:'set_trifecta', name:'The Trifecta Set', emoji:'🔱', color:'#f7931a', badgeIds:['daily_triple_1','daily_triple_7','daily_triple_30','daily_triple_90','daily_triple_365'], bonusId:'set_trifecta_complete', bonusPts:1000, bonusEmoji:'🌞', bonusName:'Trifecta God', bonusDesc:'Completed The Trifecta Set' },
    { id:'set_spin', name:'The Wheel Set', emoji:'🎡', color:'#f97316', badgeIds:['spin_1','spin_7','spin_30','spin_100','spin_streak_7','spin_streak_14','spin_streak_30','spin_jackpot','spin_closet_1','spin_closet_5'], bonusId:'set_spin_complete', bonusPts:0, bonusEmoji:'🎰', bonusName:'Wheel Master', bonusDesc:'Completed The Wheel Set' },
    { id:'set_profile', name:'The Profile Set', emoji:'👤', color:'#6366f1', badgeIds:['profile_explorer_100','profile_explorer_25','global_citizen','bio_author','profile_curious','profile_explorer_5','profile_explorer_10','profile_explorer_50','lightning_address_set'], bonusId:'set_profile_complete', bonusPts:0, bonusEmoji:'🦌', bonusName:'Archive Legend', bonusDesc:'Completed The Profile Set' },
    { id:'set_daily_five', name:'Daily Five', emoji:'🖐️', color:'#f7931a', badgeIds:['daily_five_1','daily_five_7','tctv_daily_1','say_hi_1','daily_triple_7'], bonusId:'set_daily_five', bonusPts:500, bonusEmoji:'🖐️', bonusName:'Daily Five Set', bonusDesc:'Completed the Daily Five collection' },
    { id:'set_voice', name:'Community Voice', emoji:'💬', color:'#8b5cf6', badgeIds:['say_hi_7','reply_bonus_25','chat_100','forum_reply_10','topic_comment_1','topic_channels_10'], bonusId:'set_voice', bonusPts:150, bonusEmoji:'💬', bonusName:'Community Voice Set', bonusDesc:'Completed the Community Voice collection' },
    { id:'set_tv', name:'Prime Time', emoji:'📺', color:'#a855f7', badgeIds:['tctv_daily_1','tctv_daily_7','tctv_daily_30','tctv_satellite'], bonusId:'set_tv', bonusPts:500, bonusEmoji:'📺', bonusName:'Prime Time Set', bonusDesc:'Completed the Prime Time collection' },
    { id:'set_trader', name:'Open for Business', emoji:'🏪', color:'#22c55e', badgeIds:['market_listed_1','market_listed_5','market_message','market_sold_1','first_purchase'], bonusId:'set_trader', bonusPts:150, bonusEmoji:'🏪', bonusName:'Open for Business Set', bonusDesc:'Completed the Open for Business collection' },
    { id:'set_codebreaker', name:'Codebreaker', emoji:'🔐', color:'#38bdf8', badgeIds:['cipher_1','cipher_10','cipher_50','cipher_peer_key_1','cipher_full_ring','cipher_sats_1'], bonusId:'set_codebreaker', bonusPts:500, bonusEmoji:'🔐', bonusName:'Codebreaker Set', bonusDesc:'Completed the Codebreaker collection' },
    { id:'set_generous', name:'Open Hand', emoji:'🎁', color:'#f472b6', badgeIds:['gift_sent_1','gift_sent_10','tip_first','donor_1000','gift_open_1','gift_sent_200','key_peers_5'], bonusId:'set_generous', bonusPts:150, bonusEmoji:'🎁', bonusName:'Open Hand Set', bonusDesc:'Completed the Open Hand collection' },
    { id:'set_network', name:'Peer Network', emoji:'🤝', color:'#06b6d4', badgeIds:['peer_1','peer_3','peer_10','referral_1','referral_5','key_peers_5','key_peers_21','peer_level_2','peer_level_3','peer_level_5','peer_hub_5'], bonusId:'set_network', bonusPts:500, bonusEmoji:'🤝', bonusName:'Peer Network Set', bonusDesc:'Completed the Peer Network collection' },
    { id:'set_gladiator', name:'Gladiator', emoji:'⚔️', color:'#ec4899', badgeIds:['pvp_first','pvp_25','pvp_win_streak_5','pvp_played_50'], bonusId:'set_gladiator', bonusPts:750, bonusEmoji:'⚔️', bonusName:'Gladiator Set', bonusDesc:'Completed the Gladiator collection' },
    { id:'set_scholar_daily', name:'Daily Scholar', emoji:'📚', color:'#3b82f6', badgeIds:['trivia_correct_30','quest_days_30','poll_days_30'], bonusId:'set_scholar_daily', bonusPts:150, bonusEmoji:'📚', bonusName:'Daily Scholar Set', bonusDesc:'Completed the Daily Scholar collection' },
    { id:'set_newcomer', name:'Welcome Aboard', emoji:'🧭', color:'#6366f1', badgeIds:['onboarding_complete','push_enabled','profile_complete','first_channel'], bonusId:'set_newcomer', bonusPts:250, bonusEmoji:'🧭', bonusName:'Welcome Aboard Set', bonusDesc:'Completed the Welcome Aboard collection' },
    { id:'set_favor', name:'Favor of Satoshi', emoji:'🔱', color:'#f7931a', badgeIds:['sf_trifecta_10','sf_contributor_10','sf_block_solver','faction_chosen'], bonusId:'set_favor', bonusPts:500, bonusEmoji:'🔱', bonusName:'Favor of Satoshi Set', bonusDesc:'Completed the Favor of Satoshi collection' },
    { id:'set_oracle', name:'Oracle', emoji:'🔮', color:'#a78bfa', badgeIds:['predict_top_week','predict_top_week_5','predict_top_month'], bonusId:'set_oracle', bonusPts:500, bonusEmoji:'🔮', bonusName:'Oracle Set', bonusDesc:'Completed the Oracle collection' },
    { id:'set_sovereign', name:'Sovereign Setup', emoji:'🔒', color:'#22c55e', badgeIds:['totp_enabled','lightning_address_set','faction_chosen'], bonusId:'set_sovereign', bonusPts:150, bonusEmoji:'🔒', bonusName:'Sovereign Setup Set', bonusDesc:'Completed the Sovereign Setup collection' },
    { id:'set_raffle', name:'Raffle Regular', emoji:'🎟️', color:'#f7931a', badgeIds:['raffle_entered','raffle_10','raffle_50','raffle_250','raffle_1000','raffle_winner'], bonusId:'set_raffle', bonusPts:500, bonusEmoji:'🎟️', bonusName:'Raffle Regular Set', bonusDesc:'Completed the Raffle Regular collection' }
];

// Eleven collections. collectionId is not parsed as a badge id.
// serverBonusPts is the sum of server-paid XP for the old sets, not the
// client display pts. Fun and Fitness paid 0, so its bonus stays 0.
var BADGE_COLLECTION_GROUPS = [
    { collectionId: 'col_learning', name: 'Learning', emoji: '📚', color: '#3b82f6', setIds: ['set_scholar', 'set_scholar_daily', 'set_explorer', 'set_trails'], serverBonusPts: 300 },
    { collectionId: 'col_daily_habits', name: 'Daily Habits', emoji: '🎯', color: '#f7931a', setIds: ['set_daily', 'set_daily_five', 'set_trifecta', 'set_streak', 'set_spin'], serverBonusPts: 4150 },
    { collectionId: 'col_mining', name: 'Mining', emoji: '⛏️', color: '#f7931a', setIds: ['set_miner', 'set_favor'], serverBonusPts: 500 },
    { collectionId: 'col_foresight', name: 'Foresight and Luck', emoji: '🔮', color: '#a78bfa', setIds: ['set_oracle', 'set_raffle'], serverBonusPts: 1000 },
    { collectionId: 'col_arena', name: 'Arena', emoji: '⚔️', color: '#ec4899', setIds: ['set_pvp', 'set_gladiator', 'set_codebreaker'], serverBonusPts: 1150 },
    { collectionId: 'col_community', name: 'Community', emoji: '💬', color: '#8b5cf6', setIds: ['set_social', 'set_voice', 'set_network', 'set_irl'], serverBonusPts: 800 },
    { collectionId: 'col_lightning', name: 'Lightning and Giving', emoji: '⚡', color: '#eab308', setIds: ['set_lightning', 'set_generous'], serverBonusPts: 150 },
    { collectionId: 'col_builder', name: 'Builder and Market', emoji: '🏗️', color: '#22c55e', setIds: ['set_builder', 'set_trader'], serverBonusPts: 650 },
    { collectionId: 'col_entertainment', name: 'Entertainment', emoji: '🎵', color: '#f472b6', setIds: ['set_beats', 'set_tctv', 'set_tv'], serverBonusPts: 150 },
    { collectionId: 'col_profile', name: 'Profile and Setup', emoji: '👤', color: '#6366f1', setIds: ['set_profile', 'set_newcomer', 'set_sovereign'], serverBonusPts: 300 },
    { collectionId: 'col_fitness', name: 'Fun and Fitness', emoji: '🚶', color: '#84cc16', setIds: ['set_fun', 'set_pow'], serverBonusPts: 0 }
];

function _shortCollectionSetName(name) {
    return String(name || '').replace(/^The /, '').replace(/ Set$/, '');
}

function _buildBadgeCollections() {
    var byId = {};
    (BADGE_SETS || []).forEach(function(set) { if (set && set.id) byId[set.id] = set; });
    return BADGE_COLLECTION_GROUPS.map(function(group) {
        var badgeIds = [];
        var seen = {};
        var bonusPts = Math.max(0, Math.floor(Number(group.serverBonusPts) || 0));
        var includes = [];
        (group.setIds || []).forEach(function(setId) {
            var set = byId[setId];
            if (!set) return;
            includes.push(_shortCollectionSetName(set.name));
            (set.badgeIds || []).forEach(function(badgeId) {
                if (seen[badgeId]) return;
                seen[badgeId] = true;
                badgeIds.push(badgeId);
            });
        });
        return {
            collectionId: group.collectionId,
            id: group.collectionId,
            name: group.name,
            emoji: group.emoji,
            color: group.color,
            setIds: (group.setIds || []).slice(),
            includes: includes,
            badgeIds: badgeIds,
            bonusId: group.collectionId + '_bonus',
            bonusPts: bonusPts,
            bonusEmoji: group.emoji,
            bonusName: group.name,
            bonusDesc: 'Completed the ' + group.name + ' collection'
        };
    });
}

var BADGE_COLLECTIONS = _buildBadgeCollections();
BADGE_COLLECTIONS.forEach(function(col) {
    BADGE_DEFS.push({
        id: col.bonusId,
        name: col.bonusName,
        emoji: col.bonusEmoji,
        desc: col.bonusDesc,
        pts: col.bonusPts,
        hidden: true,
        collectionBonus: true,
        check: function() { return false; }
    });
});

function _collectionBonusCopy(pts) {
    return '+' + pts + ' XP bonus (not limited by the daily cap)';
}

// Same subtraction as the server remainder: full bonus minus server-paid
// old set bonuses this account already holds, floored at 0. The pay table
// is generated from the server catalog. The server still decides the payment.
function _collectionRemainder(col, earned) {
    var table = (typeof window !== 'undefined' && window.BADGE_COLLECTION_PAY) ? window.BADGE_COLLECTION_PAY : null;
    var pay = table && col ? table[col.id] : null;
    if (!pay) return 0;
    var total = Math.max(0, Math.floor(Number(pay.bonusPts) || 0));
    var already = 0;
    (pay.legacy || []).forEach(function(row) {
        if (!row || !earned || typeof earned.has !== 'function' || !earned.has(row.id)) return;
        var pts = Number(row.pts);
        if (pts > 0) already += pts;
    });
    return Math.max(0, total - already);
}

// Required members are the ones the server can award. Cosmetic members are
// optional extras. A collection with no server-award member (Fun and Fitness)
// still requires every badge.
function _collectionMemberLists(col) {
    var ids = (col && col.badgeIds) ? col.badgeIds.slice() : [];
    var required = [];
    var optional = [];
    var catalog = (typeof window !== 'undefined' && window.BADGE_CATALOG) ? window.BADGE_CATALOG : {};
    var sawServerAward = false;
    ids.forEach(function(id) {
        if (catalog[id] && catalog[id].serverAward === true) {
            sawServerAward = true;
            required.push(id);
        } else optional.push(id);
    });
    if (!sawServerAward) return { required: ids, optional: [] };
    return { required: required, optional: optional };
}

window._badgeCollectionProgress = function(earned) {
    var held = earned;
    if (!held) {
        try { held = (typeof window.getEarnedBadges === 'function') ? window.getEarnedBadges() : null; } catch (e) { held = null; }
    }
    if (!held) {
        held = new Set();
        try { JSON.parse(localStorage.getItem('btc_badges') || '[]').forEach(function(id) { held.add(id); }); } catch (e2) {}
    }
    return (BADGE_COLLECTIONS || []).map(function(col) {
        var lists = _collectionMemberLists(col);
        var count = 0;
        lists.required.forEach(function(id) { if (held.has(id)) count += 1; });
        var total = lists.required.length;
        return {
            id: col.id,
            name: col.name,
            emoji: col.emoji,
            color: col.color,
            earned: count,
            total: total,
            pct: total ? Math.round((count / total) * 100) : 0,
            bonusPts: _collectionRemainder(col, held),
            bonusId: col.bonusId,
            bonusEarned: held.has(col.bonusId),
            complete: total > 0 && count >= total
        };
    });
};

function _renderBadgeSets(earnedBadges) {
    var cols = (BADGE_COLLECTIONS || []).filter(Boolean);
    if (!cols.length) return '';
    var completed = cols.filter(function(col) {
        var lists = _collectionMemberLists(col);
        return lists.required.length && lists.required.every(function(id) { return earnedBadges.has(id); });
    }).length;
    var colId = 'badgeSetsPanel_' + Math.random().toString(36).substr(2, 5);
    var html = '<style>' +
        '.bc-wrap{margin-top:24px;max-width:100%;}' +
        '.bc-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;background:none;border:none;padding:0 2px 10px;cursor:pointer;font-family:inherit;}' +
        '.bc-panel{display:none;}' +
        '.bc-card{box-sizing:border-box;max-width:100%;background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:12px;margin-bottom:10px;overflow:hidden;}' +
        '.bc-head{display:flex;align-items:flex-start;gap:8px;min-width:0;margin-bottom:8px;}' +
        '.bc-emoji{font-size:1.35rem;line-height:1;flex-shrink:0;}' +
        '.bc-copy{flex:1;min-width:0;}' +
        '.bc-title{font-size:0.86rem;font-weight:800;color:var(--heading);line-height:1.25;overflow-wrap:anywhere;}' +
        '.bc-sub{font-size:0.66rem;color:var(--text-muted);line-height:1.35;overflow-wrap:anywhere;}' +
        '.bc-badges{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;}' +
        '.bc-chip{box-sizing:border-box;display:flex;flex-direction:column;align-items:center;gap:2px;width:52px;max-width:100%;cursor:pointer;}' +
        '.bc-chip .bc-name{font-size:0.52rem;text-align:center;line-height:1.2;word-break:break-word;overflow-wrap:anywhere;max-width:100%;}' +
        '.bc-bar{background:var(--bg-side);border-radius:6px;height:6px;overflow:hidden;margin-bottom:6px;}' +
        '.bc-bar > div{height:100%;border-radius:6px;}' +
        '.bc-bonus{font-size:0.68rem;line-height:1.35;overflow-wrap:anywhere;}' +
        '.bc-flag{font-size:0.48rem;line-height:1;color:var(--text-faint);letter-spacing:0.2px;text-transform:uppercase;}' +
        '.bc-dist{margin-bottom:14px;}' +
        '.bc-dist-title{font-size:0.68rem;font-weight:800;color:var(--heading);letter-spacing:0.4px;text-transform:uppercase;margin-bottom:8px;}' +
        '.bc-dist-row{display:flex;align-items:center;gap:8px;margin-bottom:7px;min-width:0;}' +
        '.bc-dist-emoji{width:1.2rem;flex-shrink:0;text-align:center;}' +
        '.bc-dist-main{flex:1;min-width:0;}' +
        '.bc-dist-line{display:flex;align-items:baseline;justify-content:space-between;gap:8px;min-width:0;}' +
        '.bc-dist-name{font-size:0.72rem;font-weight:700;color:var(--heading);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}' +
        '.bc-dist-count{font-size:0.66rem;color:var(--text-muted);flex-shrink:0;}' +
        '@media (max-width:420px){.bc-card{padding:10px;}.bc-chip{width:46px;}.bc-title{font-size:0.8rem;}}' +
        '</style>';
    html += '<div class="bc-wrap">';
    html += '<button class="bc-toggle" onclick="var p=document.getElementById(\'' + colId + '\');var open=p.style.display!==\'none\';p.style.display=open?\'none\':\'block\';this.querySelector(\'.bc-arrow\').textContent=open?\'▼\':\'▲\'">';
    html += '<div style="font-size:0.8rem;font-weight:900;color:var(--heading);letter-spacing:1px;text-transform:uppercase;">🏅 Badge Collections</div>';
    html += '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;"><span style="font-size:0.68rem;color:var(--text-muted);">' + completed + '/' + cols.length + '</span><span class="bc-arrow" style="font-size:0.7rem;color:var(--text-faint);">▼</span></div>';
    html += '</button>';
    html += '<div id="' + colId + '" class="bc-panel">';
    cols.forEach(function(col) {
        var lists = _collectionMemberLists(col);
        var earnedReq = lists.required.filter(function(id) { return earnedBadges.has(id); });
        var optionalHeld = lists.optional.filter(function(id) { return earnedBadges.has(id); }).length;
        var total = lists.required.length;
        var pct = total ? Math.round((earnedReq.length / total) * 100) : 0;
        var complete = total > 0 && earnedReq.length >= total;
        var bonusEarned = earnedBadges.has(col.bonusId);
        var bonusCopy = _collectionBonusCopy(_collectionRemainder(col, earnedBadges));
        html += '<div class="bc-card" style="border-color:' + (complete ? col.color + '55' : 'var(--border)') + ';' + (complete ? 'box-shadow:0 0 12px ' + col.color + '22;' : '') + '">';
        html += '<div class="bc-head">';
        html += '<span class="bc-emoji">' + col.emoji + '</span>';
        html += '<div class="bc-copy"><div class="bc-title">' + escapeHtml(col.name) + '</div>';
        html += '<div class="bc-sub">' + earnedReq.length + '/' + total;
        if (lists.optional.length) html += ' · ' + optionalHeld + '/' + lists.optional.length + ' optional';
        html += ' · ' + escapeHtml((col.includes || []).join(' · ')) + '</div></div>';
        if (complete && bonusEarned) html += '<div style="font-size:1.1rem;filter:drop-shadow(0 0 6px gold);flex-shrink:0;">' + col.bonusEmoji + '</div>';
        html += '</div>';
        if (bonusEarned) {
            html += '<div class="bc-bonus" style="color:#22c55e;font-weight:700;">' + col.bonusEmoji + ' ' + escapeHtml(col.bonusName) + ' — bonus earned · ' + bonusCopy + '</div>';
        } else if (complete) {
            html += '<div class="bc-bonus" style="color:' + col.color + ';font-weight:700;">Complete. The server awards ' + bonusCopy + '.</div>';
        } else {
            html += '<div class="bc-bonus" style="color:var(--text-faint);">Complete to unlock ' + col.bonusEmoji + ' ' + escapeHtml(col.bonusName) + ' · ' + bonusCopy + '</div>';
        }
        html += '<div class="bc-bar"><div style="width:' + pct + '%;background:' + col.color + ';"></div></div>';
        html += '<div class="bc-badges">';
        col.badgeIds.forEach(function(bid) {
            var bEarned = earnedBadges.has(bid);
            var extra = lists.optional.indexOf(bid) !== -1;
            var bDef = BADGE_DEFS.find(function(b) { return b.id === bid; });
            if (!bDef && window.BADGE_CATALOG && window.BADGE_CATALOG[bid]) {
                bDef = { emoji: window.BADGE_CATALOG[bid].emoji || '🏅', name: window.BADGE_CATALOG[bid].name || bid, desc: window.BADGE_CATALOG[bid].desc || '' };
            }
            var emoji = bDef ? bDef.emoji : '🔘';
            var name = bDef ? bDef.name : bid;
            var desc = bDef ? bDef.desc : '';
            var tipHtml = (bEarned ? '<span style=\"color:#22c55e;font-weight:700;\">\u2705 Earned</span><br>' : '<span style=\"color:#aaa;\">\uD83D\uDD12 Locked</span><br>') +
                '<strong>' + escapeHtml(name) + '</strong>' +
                (extra ? '<br><span style=\"color:#aaa;font-size:0.63rem;\">Optional extra</span>' : '') +
                (desc ? ('<br><span style=\"color:#aaa;font-size:0.63rem;\">' + escapeHtml(desc) + '</span>') : '');
            html += '<div class="bc-chip badge-set-item' + (extra ? ' bc-extra' : '') + '" data-set-tip="' + tipHtml.replace(/\"/g, '&quot;') + '"';
            html += ' style="' + (bEarned ? '' : 'opacity:0.4;') + '"';
            html += ' onclick="window._showBadgeSetTip(event,this)"';
            html += ' onmouseenter="window._showBadgeSetTip(event,this)"';
            html += ' onmouseleave="window._hideBadgeSetTip()">';
            html += '<span style="font-size:1.25rem;' + (bEarned ? 'filter:drop-shadow(0 0 4px ' + col.color + '88);' : 'filter:grayscale(1);') + '">' + emoji + '</span>';
            html += '<span class="bc-name" style="color:' + (bEarned ? 'var(--text)' : 'var(--text-faint)') + ';">' + escapeHtml(name) + '</span>';
            if (extra) html += '<span class="bc-flag">extra</span>';
            html += '</div>';
        });
        html += '</div>';
        html += '</div>';
    });
    html += '</div>';
    html += '<div style="margin-top:12px;">';
    html += '<button class="bc-toggle" onclick="window._toggleBadgeDist(this)">';
    html += '<div style="font-size:0.8rem;font-weight:900;color:var(--heading);letter-spacing:1px;text-transform:uppercase;">📊 Community Badge Distribution</div>';
    html += '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;"><span style="font-size:0.68rem;color:var(--text-muted);">How rare is yours?</span><span class="bcd-arrow" style="font-size:0.7rem;color:var(--text-faint);">▼</span></div>';
    html += '</button>';
    html += '<div id="badgeDistPanel" style="display:none;">';
    html += '<div id="badgeDistContent"><div style="text-align:center;padding:20px;color:var(--text-faint);font-size:0.82rem;">Loading distribution...</div></div>';
    html += '</div></div>';
    html += '</div>';
    return html;
}

// Old set bonuses stay on accounts that already have them. The server
// awards a merged collection bonus. The client does not pay either.
window._claimSetBonus = function() {};

window._checkBadgeSets = function() {};

// ============================================================
// Community Badge Distribution
// ============================================================
window._badgeDistLoaded = false;

window._toggleBadgeDist = function(btn) {
    var panel = document.getElementById('badgeDistPanel');
    if (!panel) return;
    var isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    var arrow = btn.querySelector('.bcd-arrow');
    if (arrow) arrow.textContent = isOpen ? '▼' : '▲';
    if (!isOpen && !window._badgeDistLoaded) {
        window._badgeDistLoaded = true;
        window._loadBadgeDist();
    }
};

var _BADGE_DIST_TTL = 6 * 60 * 60 * 1000; // 6 hours
var _BADGE_DIST_LS_KEY = 'btc_badge_dist_cache';

window._loadBadgeDist = function() {
    var container = document.getElementById('badgeDistContent');
    if (!container) return;

    // Check localStorage cache first (TTL: 48h)
    try {
        var cached = JSON.parse(localStorage.getItem(_BADGE_DIST_LS_KEY) || 'null');
        if (cached && cached.ts && (Date.now() - cached.ts) < _BADGE_DIST_TTL) {
            var updatedAt = cached.updatedAt ? new Date(cached.updatedAt) : null;
            window._badgeDistActive = cached.activeUsers30d || 0;
            window._renderBadgeDist(cached.counts, cached.totalUsers, updatedAt, container);
            return; // served from cache, 0 Firestore reads
        }
    } catch(e) { /* bad cache, fall through */ }

    if (typeof db === 'undefined' || !db) {
        container.innerHTML = '<div style="color:var(--text-faint);font-size:0.8rem;text-align:center;padding:12px;">Sign in to view distribution data.</div>';
        return;
    }
    db.collection('stats').doc('badge_distribution').get().then(function(doc) {
        if (!doc.exists) {
            container.innerHTML = '<div style="color:var(--text-faint);font-size:0.8rem;text-align:center;padding:12px;">Distribution data not available yet.</div>';
            return;
        }
        var data = doc.data();
        var totalUsers = data.totalUsers || 1;
        var counts = data.counts || {};
        window._badgeDistActive = data.activeUsers30d || 0;
        var _uTs = data.updatedAt;
        var updatedAt = _uTs ? (_uTs._seconds ? new Date(_uTs._seconds * 1000) : (_uTs.toDate ? _uTs.toDate() : new Date(_uTs))) : null;
        // Save to localStorage cache
        try {
            localStorage.setItem(_BADGE_DIST_LS_KEY, JSON.stringify({
                ts: Date.now(),
                totalUsers: totalUsers,
                activeUsers30d: window._badgeDistActive || 0,
                counts: counts,
                updatedAt: updatedAt ? updatedAt.getTime() : null
            }));
        } catch(e) { /* storage full, skip cache */ }
        window._renderBadgeDist(counts, totalUsers, updatedAt, container);
    }).catch(function() {
        container.innerHTML = '<div style="color:var(--text-faint);font-size:0.8rem;text-align:center;padding:12px;">Could not load distribution.</div>';
    });
};

window._getBadgeRarity = function(pct) {
    if (pct < 1) return { label: 'Legendary', color: '#fbbf24', glow: 'rgba(251,191,36,0.3)', icon: '👑', border: '#f59e0b' };
    if (pct < 5) return { label: 'Epic', color: '#a78bfa', glow: 'rgba(167,139,250,0.25)', icon: '🔮', border: '#7c3aed' };
    if (pct <= 25) return { label: 'Rare', color: '#38bdf8', glow: 'rgba(56,189,248,0.2)', icon: '💧', border: '#0284c7' };
    return { label: 'Common', color: '#4ade80', glow: 'none', icon: '●', border: '#16a34a' };
};

window._renderBadgeDist = function(counts, totalUsers, updatedAt, container) {
    // Build a lookup from all badge/title/set sources
    var badgeMeta = {};
    if (typeof BADGE_DEFS !== 'undefined') {
        BADGE_DEFS.forEach(function(b) { badgeMeta[b.id] = { emoji: b.emoji, name: b.name, desc: b.desc || b.hint || '' }; });
    }
    // TITLE_DEFS: use flavor as desc, title as name
    if (typeof TITLE_DEFS !== 'undefined') {
        TITLE_DEFS.forEach(function(t) { badgeMeta[t.id] = { emoji: t.emoji || '🏅', name: t.title || t.name || t.id, desc: t.flavor || '' }; });
    }
    // BADGE_SETS bonus completion badges
    if (typeof BADGE_SETS !== 'undefined') {
        BADGE_SETS.forEach(function(s) {
            if (!s || !s.bonusId) return;
            badgeMeta[s.bonusId] = { emoji: s.bonusEmoji || '🏅', name: s.bonusName || s.name, desc: s.bonusDesc || ('Completed ' + s.name) };
        });
    }
    // Also add FLEX badge names by pattern
    // Pre-build a normalised lookup: strip trailing underscores, collapse spaces, lowercase
    var _normMeta = {};
    Object.keys(badgeMeta).forEach(function(k) {
        var n = k.replace(/_+$/,'').replace(/[_ ]+/g,' ').toLowerCase().trim();
        _normMeta[n] = badgeMeta[k];
    });
    // Also index by badge name (for old records stored as display name e.g. "Lightning_Rod__")
    Object.keys(badgeMeta).forEach(function(k) {
        var m = badgeMeta[k];
        if (m.name) {
            var n = m.name.replace(/[_ ]+/g,' ').toLowerCase().trim();
            if (!_normMeta[n]) _normMeta[n] = m;
        }
    });

    function getBadgeDisplay(id) {
        if (badgeMeta[id]) return badgeMeta[id];
        // Normalise: strip trailing underscores, collapse separators, lowercase
        var norm = id.replace(/_+$/,'').replace(/[_ ]+/g,' ').toLowerCase().trim();
        if (_normMeta[norm]) return _normMeta[norm];
        // Fallback: humanise the ID
        var name = id.replace(/_+$/,'').replace(/_/g,' ').replace(/\b\w/g, function(c){ return c.toUpperCase(); });
        return { emoji: '🏅', name: name, desc: '' };
    }

    var earnedNow = (typeof window.getEarnedBadges === 'function') ? window.getEarnedBadges() : null;
    if (window.BADGE_CATALOG) {
        Object.keys(window.BADGE_CATALOG).forEach(function(id) {
            var c = window.BADGE_CATALOG[id];
            if (!badgeMeta[id]) badgeMeta[id] = { emoji: c.emoji || '🏅', name: c.name || id, desc: c.desc || '', hidden: c.hidden === true };
            else if (c.hidden) badgeMeta[id].hidden = true;
            if (counts[id] == null) counts[id] = 0;
        });
    }
    if (typeof HIDDEN_BADGES !== 'undefined') {
        HIDDEN_BADGES.forEach(function(b) {
            if (!badgeMeta[b.id]) badgeMeta[b.id] = { emoji: b.emoji, name: b.name, desc: b.desc || '', hidden: b.hidden === true };
            if (b.hidden && badgeMeta[b.id]) badgeMeta[b.id].hidden = true;
            if (counts[b.id] == null) counts[b.id] = 0;
        });
    }
    // Sort all entries by count desc, build rarity groups
    var entries = Object.entries(counts)
        .map(function(e) {
            var pct = totalUsers ? (e[1] / totalUsers) * 100 : 0;
            var meta = getBadgeDisplay(e[0]);
            if (meta.hidden && !(earnedNow && earnedNow.has && earnedNow.has(e[0]))) {
                meta = { emoji: '🔒', name: 'Secret badge', desc: 'Hidden until you earn it' };
            }
            var rarity = e[1] === 0
                ? { label: 'Unclaimed', color: '#94a3b8', glow: 'none', icon: '○', border: '#475569' }
                : window._getBadgeRarity(pct);
            return { id: e[0], count: e[1], pct: pct, rarity: rarity, emoji: meta.emoji, name: meta.name, desc: meta.desc || '' };
        })
        .sort(function(a, b) { return a.pct - b.pct; }); // rarest first

    var rarityOrder = ['Unclaimed','Legendary','Epic','Rare','Common'];
    var groups = {};
    rarityOrder.forEach(function(r) { groups[r] = []; });
    entries.forEach(function(e) { groups[e.rarity.label].push(e); });

    var userEarned = new Set();
    try { userEarned = new Set(JSON.parse(localStorage.getItem('btc_badges') || '[]')); } catch(e) {}
    if (typeof window.getEarnedBadges === 'function') userEarned = window.getEarnedBadges();

    var html = '';
    if (typeof window._badgeCollectionProgress === 'function') {
        html += '<div class="bc-dist">';
        html += '<div class="bc-dist-title">Your collections</div>';
        window._badgeCollectionProgress(userEarned).forEach(function(row) {
            html += '<div class="bc-dist-row">';
            html += '<span class="bc-dist-emoji">' + row.emoji + '</span>';
            html += '<div class="bc-dist-main">';
            html += '<div class="bc-dist-line"><span class="bc-dist-name">' + (typeof escapeHtml === 'function' ? escapeHtml(row.name) : row.name) + '</span>';
            html += '<span class="bc-dist-count">' + row.earned + '/' + row.total + '</span></div>';
            html += '<div class="bc-bar"><div style="width:' + row.pct + '%;background:' + row.color + ';"></div></div>';
            html += '</div></div>';
        });
        html += '</div>';
    }
    // Summary strip
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">';
    var tierColors = { Unclaimed:'#94a3b8', Legendary:'#fbbf24', Epic:'#a78bfa', Rare:'#38bdf8', Common:'#4ade80' };
    var tierIcons = { Unclaimed:'○', Legendary:'👑', Epic:'🔮', Rare:'💧', Common:'●' };
    rarityOrder.forEach(function(r) {
        var cnt = groups[r].length;
        if (!cnt) return;
        html += '<div style="display:flex;align-items:center;gap:4px;padding:4px 10px;background:rgba(0,0,0,0.2);border:1px solid ' + tierColors[r] + '44;border-radius:20px;">';
        html += '<span style="font-size:0.75rem;">' + tierIcons[r] + '</span>';
        html += '<span style="font-size:0.7rem;font-weight:700;color:' + tierColors[r] + ';">' + r + '</span>';
        html += '<span style="font-size:0.65rem;color:var(--text-faint);">' + cnt + '</span>';
        html += '</div>';
    });
    html += '</div>';
    html += '<div style="font-size:0.65rem;color:var(--text-faint);margin-bottom:12px;">' + totalUsers.toLocaleString() + ' real accounts' + (window._badgeDistActive ? ' · ' + Number(window._badgeDistActive).toLocaleString() + ' active in 30 days' : '') + (updatedAt ? ' · Updated ' + updatedAt.toLocaleDateString() : '') + '</div>';

    // Filter buttons
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">';
    html += '<button onclick="window._filterBadgeDist(\'all\')" id="bdf-all" style="padding:4px 12px;border-radius:20px;border:1px solid var(--accent);background:var(--accent);color:#000;font-size:0.7rem;font-weight:700;cursor:pointer;font-family:inherit;">All</button>';
    html += '<button onclick="window._filterBadgeDist(\'mine\')" id="bdf-mine" style="padding:4px 12px;border-radius:20px;border:1px solid var(--border);background:none;color:var(--text-muted);font-size:0.7rem;font-weight:700;cursor:pointer;font-family:inherit;">Mine only</button>';
    rarityOrder.forEach(function(r) {
        if (!groups[r].length) return;
        html += '<button onclick="window._filterBadgeDist(\'' + r + '\')" id="bdf-' + r + '" style="padding:4px 10px;border-radius:20px;border:1px solid ' + tierColors[r] + '66;background:none;color:' + tierColors[r] + ';font-size:0.7rem;font-weight:700;cursor:pointer;font-family:inherit;">' + tierIcons[r] + ' ' + r + '</button>';
    });
    html += '</div>';

    // Badge rows by rarity group
    html += '<div id="bdgRows">';
    rarityOrder.forEach(function(r) {
        if (!groups[r].length) return;
        html += '<div class="bdr-group" data-rarity="' + r + '" style="margin-bottom:14px;">';
        html += '<div style="font-size:0.65rem;font-weight:900;color:' + tierColors[r] + ';text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;display:flex;align-items:center;gap:6px;">';
        html += tierIcons[r] + ' ' + r;
        var rarityDesc = { Unclaimed:'nobody yet', Legendary:'under 1%', Epic:'1 – 5%', Rare:'5 – 25%', Common:'over 25%' };
        html += '<span style="color:var(--text-faint);font-weight:400;normal;text-transform:none;letter-spacing:0;">' + rarityDesc[r] + '</span>';
        html += '</div>';
        groups[r].forEach(function(badge) {
            var isEarned = userEarned.has(badge.id);
            var barWidth = Math.min(100, (badge.pct / 50) * 100); // scale: 50% = full bar
            html += '<div class="bdr-row" data-earned="' + (isEarned?'1':'0') + '" style="display:flex;align-items:center;gap:8px;padding:7px 10px;margin-bottom:4px;border-radius:10px;background:' + (isEarned ? 'rgba('+_hexToRgb(badge.rarity.color)+',0.07)' : 'rgba(0,0,0,0.15)') + ';border:1px solid ' + (isEarned ? badge.rarity.border + '55' : 'var(--border)') + ';' + (isEarned && badge.rarity.glow !== 'none' ? 'box-shadow:0 0 8px ' + badge.rarity.glow + ';' : '') + '">';
            html += '<span style="font-size:1rem;width:24px;text-align:center;flex-shrink:0;' + (isEarned?'':'filter:grayscale(1);opacity:0.4;') + '">' + badge.emoji + '</span>';
            html += '<div style="flex:1;min-width:0;">';
            html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">';
            var safeDesc = badge.desc ? (typeof escapeHtml==='function'?escapeHtml(badge.desc):badge.desc.replace(/"/g,'&quot;')) : '';
            html += '<span class="bdr-badge-title" data-desc="' + safeDesc + '"' + (safeDesc ? ' onmouseenter="window._showBadgeDistTooltip(event,this)" onmouseleave="window._hideBadgeDistTooltip()" onclick="window._showBadgeDistTooltip(event,this)"' : '') + ' style="font-size:0.78rem;font-weight:' + (isEarned?'700':'500') + ';color:' + (isEarned?'var(--heading)':'var(--text-muted)') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;cursor:' + (safeDesc?'help':'default') + ';border-bottom:' + (safeDesc?'1px dashed var(--text-faint)':'none') + ';">' + (typeof escapeHtml==='function'?escapeHtml(badge.name):badge.name) + '</span>';
            html += '<span style="font-size:0.68rem;color:' + badge.rarity.color + ';font-weight:700;flex-shrink:0;">' + badge.pct.toFixed(1) + '%</span>';
            html += '</div>';
            html += '<div style="height:3px;background:var(--border);border-radius:2px;margin-top:4px;overflow:hidden;">';
            html += '<div style="height:100%;width:' + barWidth + '%;background:' + badge.rarity.color + ';border-radius:2px;transition:width 0.4s;"></div>';
            html += '</div>';
            html += '</div>';
            if (isEarned) html += '<span style="font-size:0.7rem;flex-shrink:0;" title="You earned this!">✅</span>';
            html += '</div>';
        });
        html += '</div>';
    });
    html += '</div>'; // bdgRows

    container.innerHTML = html;
};

// Helper: hex color to rgb components for rgba()
function _hexToRgb(hex) {
    var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return r + ',' + g + ',' + b;
}

window._filterBadgeDist = function(filter) {
    // Update active button
    ['all','mine','Unclaimed','Legendary','Epic','Rare','Common'].forEach(function(f) {
        var btn = document.getElementById('bdf-' + f);
        if (!btn) return;
        var isActive = f === filter;
        btn.style.background = isActive ? 'var(--accent)' : 'none';
        btn.style.color = isActive ? '#000' : (f === 'all' || f === 'mine' ? 'var(--text-muted)' : btn.style.color);
        btn.style.borderColor = isActive ? 'var(--accent)' : (f === 'all' || f === 'mine' ? 'var(--border)' : btn.style.borderColor);
    });
    var userEarned = new Set();
    try { userEarned = new Set(JSON.parse(localStorage.getItem('btc_badges') || '[]')); } catch(e) {}
    if (typeof window.getEarnedBadges === 'function') userEarned = window.getEarnedBadges();

    document.querySelectorAll('.bdr-group').forEach(function(g) {
        var rarity = g.getAttribute('data-rarity');
        if (filter === 'all') { g.style.display = ''; return; }
        if (filter === 'mine') { g.style.display = ''; } else {
            g.style.display = (filter === rarity) ? '' : 'none';
        }
    });
    document.querySelectorAll('.bdr-row').forEach(function(row) {
        if (filter === 'mine') {
            row.style.display = row.getAttribute('data-earned') === '1' ? '' : 'none';
        } else {
            row.style.display = '';
        }
    });
};

// Badge Distribution tooltip — inline onmouseenter/onmouseleave/onclick handlers
var _bdTip = null;
window._showBadgeDistTooltip = function(e, el) {
    if (e && e.stopPropagation) e.stopPropagation();
    var desc = el.getAttribute('data-desc');
    if (!desc) return;
    // Remove any existing tip
    if (_bdTip && _bdTip.parentNode) _bdTip.parentNode.removeChild(_bdTip);
    var tip = document.createElement('div');
    tip.textContent = desc;
    tip.style.cssText = 'position:fixed;z-index:999999;max-width:240px;padding:9px 13px;background:var(--card-bg,#1a1a2e);border:1px solid var(--accent,#f7931a);border-radius:10px;font-size:0.75rem;color:var(--text,#e0e0e0);line-height:1.5;box-shadow:0 4px 24px rgba(0,0,0,0.55);pointer-events:none;';
    document.body.appendChild(tip);
    _bdTip = tip;
    var rect = el.getBoundingClientRect();
    var tw = tip.offsetWidth || 240;
    var th = tip.offsetHeight || 50;
    var left = Math.min(rect.left, window.innerWidth - tw - 12);
    var top = rect.bottom + 8;
    if (top + th > window.innerHeight - 12) top = rect.top - th - 8;
    tip.style.left = Math.max(8, left) + 'px';
    tip.style.top = top + 'px';
};
window._hideBadgeDistTooltip = function() {
    if (_bdTip && _bdTip.parentNode) _bdTip.parentNode.removeChild(_bdTip);
    _bdTip = null;
};

// ---- Tooltip for badge SET grid items (The Trifecta Set etc.) ----
// Reuses #badgeFloatTip so it's always position:fixed, opaque, correct z-index
window._showBadgeSetTip = function(e, el) {
    e.stopPropagation && e.stopPropagation();
    var tip = document.getElementById('badgeFloatTip');
    if (!tip) return;
    var content = el.getAttribute('data-set-tip') || '';
    if (!content) return;
    // Decode &quot; back to " for innerHTML
    tip.innerHTML = content.replace(/&quot;/g, '"');
    tip.style.display = 'block';
    // Position above the element using getBoundingClientRect
    var r = el.getBoundingClientRect();
    var tw = tip.offsetWidth || 180;
    var th = tip.offsetHeight || 60;
    var left = Math.max(4, Math.min(r.left + r.width / 2 - tw / 2, window.innerWidth - tw - 4));
    var top  = r.top - th - 8;
    if (top < 4) top = r.bottom + 8; // flip below if no room above
    tip.style.left = left + 'px';
    tip.style.top  = top  + 'px';
};
window._hideBadgeSetTip = function() {
    var tip = document.getElementById('badgeFloatTip');
    if (tip) tip.style.display = 'none';
};

// ---- Single floating tooltip for badge taps ----
window._showBadgeTip = function(e, el) {
    e.stopPropagation();
    var tip = document.getElementById('badgeFloatTip');
    if (!tip) return;

    // Read tooltip content from the hidden .badge-tooltip child
    var inner = el.querySelector('.badge-tooltip');
    var content = inner ? inner.innerHTML : (el.getAttribute('title') || '');
    if (!content) return;

    // Append category chip if available
    var cat = el.getAttribute('data-badge-cat') || (window._badgeCatMap && window._badgeCatMap[el.getAttribute('data-badge-id')]);
    if (cat) {
        content += '<div style="margin-top:7px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;gap:5px;flex-wrap:wrap;">' +
            '<span style="font-size:0.65rem;color:var(--text-faint);">Category</span>' +
            '<span style="font-size:0.7rem;padding:2px 8px;background:rgba(247,147,26,0.12);border:1px solid rgba(247,147,26,0.25);border-radius:12px;color:var(--accent);font-weight:700;">' + escapeHtml(cat) + '</span>' +
        '</div>';
    }

    // If same badge tapped again — dismiss
    if (tip.style.display === 'block' && tip._srcEl === el) {
        tip.style.display = 'none';
        tip._srcEl = null;
        el.classList.remove('tapped');
        return;
    }

    // Clear previous tapped state
    document.querySelectorAll('.badge-item.tapped').forEach(function(b) { b.classList.remove('tapped'); });
    el.classList.add('tapped');
    tip._srcEl = el;
    tip.innerHTML = content;
    tip.style.display = 'block';

    // Position near tap point, keep within viewport
    var x = (e.touches ? e.touches[0].clientX : e.clientX) || 0;
    var y = (e.touches ? e.touches[0].clientY : e.clientY) || 0;
    tip.style.left = '0px'; tip.style.top = '0px'; // reset for measurement
    var tw = tip.offsetWidth || 220;
    var th = tip.offsetHeight || 80;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var left = Math.min(x - tw / 2, vw - tw - 10);
    left = Math.max(left, 10);
    var top = y - th - 12;
    if (top < 10) top = y + 24;
    if (top + th > vh - 10) top = vh - th - 10;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
};

// Dismiss tooltip on outside tap/click
document.addEventListener('click', function(e) {
    var tip = document.getElementById('badgeFloatTip');
    if (!tip || tip.style.display === 'none') return;
    if (!e.target.closest('.badge-item')) {
        tip.style.display = 'none';
        tip._srcEl = null;
        document.querySelectorAll('.badge-item.tapped').forEach(function(b) { b.classList.remove('tapped'); });
    }
}, true);

// ---- Badge search ----
window._badgeSearchRecords = function() {
    var list = [];
    var seen = {};
    var collections = {};
    window._badgeSearchCollections = collections;
    (BADGE_COLLECTIONS || []).forEach(function(col) {
        (col.badgeIds || []).forEach(function(id) {
            if (!collections[id]) collections[id] = [];
            if (collections[id].indexOf(col.name) === -1) collections[id].push(col.name);
        });
    });
    function add(b) {
        if (!b || !b.id || seen[b.id]) return;
        seen[b.id] = true;
        var cat = (window.BADGE_CATALOG && window.BADGE_CATALOG[b.id]) || {};
        var hidden = !!(b.hidden || cat.hidden);
        var earned = false;
        try { earned = (window.getEarnedBadges ? window.getEarnedBadges() : earnedBadges).has(b.id); } catch (e) {}
        if (hidden && !earned) return;
        var xp = typeof badgeShownXp === 'function' ? badgeShownXp(b) : (typeof cat.xp === 'number' ? cat.xp : (typeof b.pts === 'number' ? b.pts : 0));
        list.push({
            id: b.id,
            name: cat.name || b.name || b.id,
            desc: cat.desc || b.desc || '',
            emoji: cat.emoji || b.emoji || '',
            category: cat.category || b.category || '',
            collections: collections[b.id] || [],
            xp: xp,
            earned: earned,
            hidden: hidden
        });
    }
    if (window.BADGE_CATALOG) {
        Object.keys(window.BADGE_CATALOG).forEach(function(id) {
            var c = window.BADGE_CATALOG[id];
            add({ id: id, name: c.name, desc: c.desc, emoji: c.emoji, hidden: c.hidden, pts: c.xp, category: c.category });
        });
    }
    if (typeof BADGE_DEFS !== 'undefined') BADGE_DEFS.forEach(add);
    if (typeof HIDDEN_BADGES !== 'undefined') HIDDEN_BADGES.forEach(add);
    return list;
};

window._badgeSearchJump = function(badgeId) {
    var resultsEl = document.getElementById('badgeSearchResults');
    var input = document.getElementById('badgeSearchInput');
    if (resultsEl) { resultsEl.style.display = 'none'; resultsEl.textContent = ''; }
    if (input) input.value = '';
    document.querySelectorAll('.badge-item.badge-search-highlight').forEach(function(b) { b.classList.remove('badge-search-highlight'); });
    var escapeId = (window.CSS && CSS.escape) ? CSS.escape(badgeId) : String(badgeId).replace(/[^a-zA-Z0-9_-]/g, '');
    var target = document.querySelector('.badge-item[data-badge-id="' + escapeId + '"]');
    if (!target) {
        var where = (window._badgeSearchCollections && window._badgeSearchCollections[badgeId] && window._badgeSearchCollections[badgeId][0]) || '';
        if (typeof showToast === 'function') showToast(where ? ('This badge is in Collections → ' + where) : 'That badge is not on this page yet.');
        return;
    }
    var parent = target.closest('.badges-grid');
    if (parent && parent.style.display === 'none') {
        parent.style.display = 'grid';
        var btn = parent.previousElementSibling;
        if (btn) {
            var arrow = btn.querySelector('.bca');
            if (arrow) arrow.textContent = '▼';
        }
    }
    target.classList.add('badge-search-highlight');
    setTimeout(function() {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(function() { target.classList.remove('badge-search-highlight'); }, 2500);
    }, 100);
};

// Expose BADGE_DEFS globally so other modules (e.g. satoshi-favor.js) can look up badge display names
if (window.BADGE_CATALOG) {
    BADGE_DEFS.forEach(function(b) {
        var c = window.BADGE_CATALOG[b.id];
        if (!c) return;
        if (c.name) b.name = c.name;
        if (typeof c.xp === 'number') b.pts = c.xp;
    });
}
window.BADGE_DEFS = BADGE_DEFS;
window.getEarnedBadges = function() { return earnedBadges; };
try {
    Object.defineProperty(window, 'earnedBadges', { configurable: true, get: function() { return earnedBadges; } });
} catch (e) {}
if (window.BadgeSearch && window.BadgeSearch.install) window.BadgeSearch.install();

// Init
setTimeout(initBadges, 2000);

