// © 2024-2026 603BTC LLC. All rights reserved.
// This code is proprietary. See LICENSE file. Do not copy or redistribute.
// =============================================
// Bitcoin Education Archive - Achievement Badges
// =============================================

const BADGE_DEFS = [
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
    { id: 'cert_scholar', name: 'Bitcoin Scholar', emoji: '🎓', desc: 'Passed the Bitcoin Scholar Certification', check: () => localStorage.getItem('btc_scholar_prop_passed') === 'true', pts: 50 },
    // --- Timechain TV watch-time badges ---
    { id: 'tctv_tuned_in', name: 'Tuned In', emoji: '📺', desc: 'Watched 10 min of Timechain TV', check: () => parseInt(localStorage.getItem('btc_tctv_watch_time') || '0') >= 10, pts: 10 },
    { id: 'tctv_couch_potato', name: 'Couch Potato', emoji: '🛋️', desc: 'Watched 60 min of Timechain TV', check: () => parseInt(localStorage.getItem('btc_tctv_watch_time') || '0') >= 60, pts: 25 },
    { id: 'tctv_binge_watcher', name: 'Binge Watcher', emoji: '🍿', desc: 'Watched 5 hours of Timechain TV', check: () => parseInt(localStorage.getItem('btc_tctv_watch_time') || '0') >= 300, pts: 50 },
    { id: 'tctv_couch_king', name: 'Couch King', emoji: '🛌', desc: 'Watched 24 hours of Timechain TV', check: () => parseInt(localStorage.getItem('btc_tctv_watch_time') || '0') >= 1440, pts: 100 },
    { id: 'tctv_satellite', name: 'Satellite', emoji: '🛰️', desc: 'Watched 100 hours of Timechain TV', check: () => parseInt(localStorage.getItem('btc_tctv_watch_time') || '0') >= 6000, pts: 750 },
    { id: 'cert_tech', name: 'Protocol Expert', emoji: '🛠️', desc: 'Passed the Technical Protocol Expert Certification', check: () => localStorage.getItem('btc_scholar_tech_passed') === 'true', pts: 100 },
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
    { id: 'predict_1', name: 'Oracle', emoji: '🎱', desc: 'Made your first price prediction', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.predictions ? currentUser.predictions.total || 0 : 0) >= 1, pts: 10 },
    { id: 'predict_correct_5', name: 'Crystal Ball', emoji: '🏐', desc: '5 correct predictions', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.predictions ? currentUser.predictions.correct || 0 : 0) >= 5, pts: 75 },

    // ---- Milestone Badges ----
    { id: 'first_purchase', name: 'Bitcoiner', emoji: '🛒', desc: 'Completed the First Bitcoin Purchase guide', check: () => localStorage.getItem('btc_fp_completed') === 'true', pts: 100 },
    { id: 'lightning_setup', name: 'Lightning Rod', emoji: '⚡', desc: 'Set up a Lightning wallet or added a Lightning address', check: () => localStorage.getItem('btc_lightning_setup') === 'true', pts: 100 },
    { id: 'global_citizen', name: 'Global Citizen', emoji: '🌍', desc: 'Added your country to your profile — representing Bitcoin worldwide', check: () => typeof currentUser !== 'undefined' && currentUser && !!(currentUser.country), pts: 100 },

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

    // ---- DM / Social Badges ----
    { id: 'dm_first', name: 'DM Starter', emoji: '✉️', desc: 'Sent your first direct message', check: () => parseInt(localStorage.getItem('btc_dms_sent') || '0') >= 1, pts: 15 },
    { id: 'react_50', name: 'Reaction King', emoji: '❤️', desc: 'Reacted to 50 messages in Global Chat', check: () => parseInt(localStorage.getItem('btc_chat_reactions') || '0') >= 50, pts: 50 },

    // ---- Prediction Streaks (expand existing) ----
    { id: 'predict_streak_3', name: 'Oracle Streak', emoji: '🎯', desc: '3 correct predictions in a row', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.predictions ? currentUser.predictions.bestStreak || 0 : 0) >= 3, pts: 50 },
    { id: 'predict_streak_10', name: 'Nostradamus', emoji: '🔮', desc: '10 correct predictions in a row', check: () => typeof currentUser !== 'undefined' && currentUser && (currentUser.predictions ? currentUser.predictions.bestStreak || 0 : 0) >= 10, pts: 250 },

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
    { id: 'sf_low_hash', name: 'Lucky Strike', emoji: '⭐', desc: 'Mined a hash under 1,000,000', check: () => parseInt(localStorage.getItem('btc_sf_best_hash') || '999999999') < 1000000, pts: 50 },
    { id: 'sf_ultra_low', name: 'Golden Nonce', emoji: '✨', desc: 'Mined a hash under 100,000', check: () => parseInt(localStorage.getItem('btc_sf_best_hash') || '999999999') < 100000, pts: 200 },
    { id: 'sf_block_solver', name: 'Block Solver', emoji: '🌞', desc: 'Solved a block! Hash under the difficulty target', check: () => localStorage.getItem('btc_sf_solved_block') === 'true', pts: 1000 },
    { id: 'sf_contributor', name: 'Community Miner', emoji: '🤝', desc: 'Contributed to activating Satoshi\'s Favor 3 times', check: () => parseInt(localStorage.getItem('btc_sf_activations') || '0') >= 3, pts: 50 },
    { id: 'sf_contributor_10', name: 'Favor Champion', emoji: '🏅', desc: 'Contributed to activating Satoshi\'s Favor 10 times', check: () => parseInt(localStorage.getItem('btc_sf_activations') || '0') >= 10, pts: 200 },

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
];

let earnedBadges = new Set();
let badgeCheckInterval = null;
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
        // Save to Firebase so this migration only happens once
        if (typeof db !== 'undefined' && typeof auth !== 'undefined' && auth.currentUser) {
            try {
                db.collection('users').doc(auth.currentUser.uid).update({
                    visibleBadges: [...earnedBadges]
                });
            } catch(e) {}
        }
    }

    window._visibleBadgesReady = true;
};

// Safety: allow badges after 20 seconds even if Firebase is slow
setTimeout(function() { if (!window._visibleBadgesReady) window._visibleBadgesReady = true; }, 20000);

function checkBadges() {
    // Wait until Firebase has restored earned badges
    if (!window._visibleBadgesReady) return;
    // Don't pop badges while Nacho is busy
    if (window._nachoBusy) return;

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

                // Satoshi's Favor contribution (1 point per badge)
                // contributeSatoshiFavor handles Nacho announcements for activation/extension.
                // We announce the badge + SF progress separately for the "not yet active" case.
                if (typeof window.contributeSatoshiFavor === 'function') {
                    var _badgeUsername = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : null;
                    // satoshi-favor.js handles the GC announcement for badge_earned
                    window.contributeSatoshiFavor('badge_earned', badge.emoji + ' ' + badge.name).catch(function() {});
                }

                // Queue badge popup if Nacho is busy or bubble is open
                var bubble = document.getElementById('nacho-bubble');
                if (window._nachoBusy || (bubble && bubble.classList.contains('show'))) {
                    if (!window._visibleBadgeQueue) window._visibleBadgeQueue = [];
                    window._visibleBadgeQueue.push(badge);
                } else {
                    showBadgeToast(badge);
                }

                // Award points (toasts are already queued by _nachoBusy)
                var badgePts = badge.pts || 20;
                if (typeof awardPoints === 'function') {
                    awardPoints(badgePts, 'Badge: ' + badge.name + ' ' + badge.emoji, null, null, null, badge.id);
                }
                // Save to Firebase so badges persist across devices/browsers
                if (typeof db !== 'undefined' && typeof auth !== 'undefined' && auth.currentUser) {
                    try {
                        db.collection('users').doc(auth.currentUser.uid).update({
                            visibleBadges: firebase.firestore.FieldValue.arrayUnion(badge.id)
                        });
                    } catch(e) {}
                }
            }
        } catch(e) {}
    }
}

// Major badges that deserve a share prompt
const MAJOR_BADGES = ['explorer_50', 'explorer_100', 'explorer_all', 'properties_all', 'quest_5', 'quest_25', 'quest_100'];

function showBadgeToast(badge) {
    // Notify
    if (typeof notifySelfBadge === 'function') notifySelfBadge(badge.name, badge.emoji);

    const isMajor = MAJOR_BADGES.includes(badge.id);

    // Minor badges: just a small toast, no fullscreen overlay
    if (!isMajor) {
        if (typeof showToast === 'function') {
            showToast(badge.emoji + ' Badge: ' + badge.name + ' (+' + (badge.pts || 20) + ' XP)');
        }
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
        '<div style="color:var(--accent);font-size:0.9rem;font-weight:700;">+20 XP</div>' +
        shareHtml +
        '<button onclick="document.getElementById(\'badgeCelebration\').remove()" style="margin-top:20px;padding:10px 30px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;">Awesome! ✨</button>' +
        '</div>';

    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
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
    function _cat(list, filter) { var r = list.filter(function(b) { return !_used[b.id] && filter(b); }); r.forEach(function(b) { _used[b.id] = true; }); return r; }
    const categories = {
        '🧭 Discovery': _cat(BADGE_DEFS, b => b.id.includes('explorer') || b.id === 'first_channel' || b.id === 'bookworm'),
        '🧠 Knowledge': _cat(BADGE_DEFS, b => b.id.includes('builder') || b.id.includes('diver') || b.id.includes('librarian') || b.id.includes('quest') || b.id.includes('cert_')),
        '🦌 Trails': _cat(BADGE_DEFS, b => b.id.startsWith('trail_')),
        '💬 Global Chat': _cat(BADGE_DEFS, b => b.id.startsWith('chat_')),
        '🦌 Nacho': _cat(BADGE_DEFS, b => b.id.startsWith('nacho_')),
        '📺 Timechain TV': _cat(BADGE_DEFS, b => b.id.startsWith('tctv_')),
        '🎧 DJ Mode': _cat(BADGE_DEFS, b => b.id.startsWith('dj_')),
        '🎵 Music': _cat(BADGE_DEFS, b => b.id.startsWith('producer')),
        '⚔️ PVP': _cat(BADGE_DEFS, b => b.id.startsWith('pvp_')),
        '📝 Forum': _cat(BADGE_DEFS, b => b.id.startsWith('forum_') || b.id.startsWith('article_')),
        '🔥 Streaks': _cat(BADGE_DEFS, b => b.id.startsWith('streak_')),
        '🤝 Community': _cat(BADGE_DEFS, b => b.id.startsWith('irl_') || b.id.startsWith('referral_') || b.id === 'global_citizen' || b.id === 'referred'),
        '⚡ Sats & Lightning': _cat(BADGE_DEFS, b => b.id.startsWith('sats_') || b.id === 'lightning_setup' || b.id.startsWith('tip_')),
        '🔮 Predictions': _cat(BADGE_DEFS, b => b.id.startsWith('predict_')),
        '💬 Social': _cat(BADGE_DEFS, b => b.id.startsWith('dm_') || b.id === 'react_50'),
        '🎡 Spin Wheel': _cat(BADGE_DEFS, b => b.id.startsWith('spin_')),
        '⛏️ Satoshi\'s Favor': _cat(BADGE_DEFS, b => b.id.startsWith('sf_')),
        '🐲 Raid Boss': _cat(BADGE_DEFS, b => b.id.startsWith('raid_')),
        '🌙 Fun': _cat(BADGE_DEFS, b => b.id === 'night_owl' || b.id === 'early_bird'),
        '🏆 Milestones': _cat(BADGE_DEFS, b => !_used[b.id])
    };

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

    // Badge search bar
    html += '<div style="margin-bottom:14px;position:relative;">' +
        '<input id="badgeSearchInput" type="text" placeholder="🔍 Search badges..." oninput="window._badgeSearch(this.value)" style="width:100%;padding:10px 36px 10px 14px;background:var(--input-bg,#111);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.88rem;font-family:inherit;outline:none;box-sizing:border-box;">' +
        '<button onclick="document.getElementById(\'badgeSearchInput\').value=\'\';window._badgeSearch(\'\')" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-faint);font-size:1rem;cursor:pointer;padding:0;line-height:1;">✕</button>' +
        '<div id="badgeSearchResults" style="display:none;margin-top:8px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;overflow:hidden;"></div>' +
        '</div>';

    var _bcIdx = 0;
    for (const [catName, badgeList] of Object.entries(categories)) {
        if (badgeList.length === 0) continue;
        _bcIdx++;
        var _bcId = 'bc_' + _bcIdx;
        const catEarned = badgeList.filter(b => earnedBadges.has(b.id)).length;
        const allEarned = catEarned === badgeList.length;
        
        html += '<div style="margin-bottom:6px;border:1px solid ' + (allEarned ? 'rgba(34,197,94,0.3)' : 'var(--border)') + ';border-radius:10px;overflow:visible;">';
        html += '<button onclick="var c=document.getElementById(\'' + _bcId + '\');c.style.display=c.style.display===\'none\'?\'grid\':\'none\';this.querySelector(\'.bca\').textContent=c.style.display===\'none\'?\'▶\':\'▼\'" style="width:100%;padding:10px 12px;background:' + (allEarned ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)') + ';border:none;cursor:pointer;display:flex;align-items:center;gap:8px;font-family:inherit;touch-action:manipulation;">';
        html += '<span class="bca" style="color:var(--text-faint);font-size:0.7rem;">▶</span>';
        html += '<span style="color:var(--text);font-size:0.8rem;font-weight:700;">' + catName + '</span>';
        html += '<span style="margin-left:auto;font-size:0.7rem;color:' + (allEarned ? '#22c55e' : 'var(--accent)') + ';font-weight:700;">' + catEarned + '/' + badgeList.length + (allEarned ? ' ✅' : '') + '</span>';
        html += '</button>';
        html += '<div id="' + _bcId + '" class="badges-grid" style="display:none;">';
        
        for (const badge of badgeList) {
            const earned = earnedBadges.has(badge.id);
            const pts = badge.pts || 20;
            const requirementsText = !earned ? '<div style="margin-top:5px;padding-top:5px;border-top:1px solid rgba(255,255,255,0.1);color:var(--accent);font-weight:700;">How to earn: ' + badge.desc + '</div>' : '';
            const tip = earned ? '✅ ' + badge.desc + ' (+' + pts + ' XP)' : '🔒 Locked — ' + badge.desc;
            
            html += '<div class="badge-item ' + (earned ? 'earned' : 'locked') + '" data-badge-id="' + badge.id + '" data-badge-cat="' + escapeHtml(catName) + '" title="' + escapeHtml(badge.desc) + '" onclick="window._showBadgeTip(event,this)" style="padding:10px 5px; background:var(--card-bg); border-radius:12px; border:1px solid var(--border); overflow:visible;">' +
                '<div class="badge-emoji" style="font-size:1.8rem; margin-bottom:4px;">' + (earned ? badge.emoji : (badge.lockedEmoji || '🔘')) + '</div>' +
                '<div class="badge-name" style="font-size:0.6rem; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + badge.name + '</div>' +
                '<div class="badge-tooltip" style="white-space:normal; min-width:150px; line-height:1.4; z-index:200;">' + tip + requirementsText + '</div>' +
            '</div>';
        }
        html += '</div></div>';
    }

    // Hidden badges section...

    // Goal badges (visible with progress) and Hidden badges (surprise)
    if (typeof HIDDEN_BADGES !== 'undefined') {
        const earnedHidden = JSON.parse(localStorage.getItem('btc_hidden_badges') || '[]');

        // Visible goal badges — shown with name, progress, and hints
        const visibleGoals = HIDDEN_BADGES.filter(function(b) { return !b.hidden; });
        if (visibleGoals.length > 0) {
            _bcIdx++;
            var _goalId = 'bc_' + _bcIdx;
            var goalEarned = visibleGoals.filter(function(b) { return earnedHidden.includes(b.id); }).length;
            var allGoalsEarned = goalEarned === visibleGoals.length;
            html += '<div style="margin-bottom:6px;border:1px solid ' + (allGoalsEarned ? 'rgba(34,197,94,0.3)' : 'var(--border)') + ';border-radius:10px;overflow:visible;">';
            html += '<button onclick="var c=document.getElementById(\'' + _goalId + '\');c.style.display=c.style.display===\'none\'?\'grid\':\'none\';this.querySelector(\'.bca\').textContent=c.style.display===\'none\'?\'▶\':\'▼\'" style="width:100%;padding:10px 12px;background:' + (allGoalsEarned ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)') + ';border:none;cursor:pointer;display:flex;align-items:center;gap:8px;font-family:inherit;touch-action:manipulation;">';
            html += '<span class="bca" style="color:var(--text-faint);font-size:0.7rem;">▶</span>';
            html += '<span style="color:var(--text);font-size:0.8rem;font-weight:700;">🎯 Goals</span>';
            html += '<span style="margin-left:auto;font-size:0.7rem;color:' + (allGoalsEarned ? '#22c55e' : 'var(--accent)') + ';font-weight:700;">' + goalEarned + '/' + visibleGoals.length + (allGoalsEarned ? ' ✅' : '') + '</span>';
            html += '</button>';
            html += '<div id="' + _goalId + '" class="badges-grid" style="display:none;">';
            for (const badge of visibleGoals) {
                const unlocked = earnedHidden.includes(badge.id);
                const progressText = (!unlocked && badge.progress) ? badge.progress() : '';
                const hintText = (!unlocked && badge.hint) ? badge.hint : '';
                html += '<div class="badge-item ' + (unlocked ? 'earned' : 'locked') + '" data-badge-id="' + badge.id + '" data-badge-cat="🎯 Goals" style="position:relative;padding:10px 5px;background:var(--card-bg);border-radius:12px;border:1px solid var(--border);overflow:visible;" onclick="window._showBadgeTip(event,this)">' +
                    '<div class="badge-emoji" style="font-size:1.8rem;margin-bottom:4px;">' + (unlocked ? badge.emoji : '🔒') + '</div>' +
                    '<div class="badge-name" style="font-size:0.6rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + badge.name + '</div>' +
                    (progressText ? '<div style="font-size:0.55rem;color:var(--accent);font-weight:700;margin-top:1px;">' + progressText + '</div>' : '') +
                    '<div class="badge-tooltip" style="white-space:normal;min-width:150px;line-height:1.4;z-index:200;">' + (unlocked ? '✅ ' + badge.desc + ' (+' + badge.pts + ' XP)' : '🔒 ' + badge.desc + (hintText ? ' — ' + hintText : '')) + '</div>' +
                '</div>';
            }
            html += '</div></div>';
        }

        // True hidden badges — only show after at least one is earned
        const hiddenBadges = HIDDEN_BADGES.filter(function(b) { return b.hidden; });
        const anyHiddenEarned = hiddenBadges.some(function(b) { return earnedHidden.includes(b.id); });
        const hiddenCount = hiddenBadges.length;
        const hiddenEarnedCount = hiddenBadges.filter(function(b) { return earnedHidden.includes(b.id); }).length;

        _bcIdx++;
        var _secretId = 'bc_' + _bcIdx;
        var allSecretsEarned = hiddenEarnedCount === hiddenCount;
        html += '<div style="margin-bottom:6px;border:1px solid ' + (allSecretsEarned ? 'rgba(34,197,94,0.3)' : 'var(--border)') + ';border-radius:10px;overflow:visible;">';
        html += '<button onclick="var c=document.getElementById(\'' + _secretId + '\');c.style.display=c.style.display===\'none\'?\'grid\':\'none\';this.querySelector(\'.bca\').textContent=c.style.display===\'none\'?\'▶\':\'▼\'" style="width:100%;padding:10px 12px;background:' + (allSecretsEarned ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)') + ';border:none;cursor:pointer;display:flex;align-items:center;gap:8px;font-family:inherit;touch-action:manipulation;">';
        html += '<span class="bca" style="color:var(--text-faint);font-size:0.7rem;">▶</span>';
        html += '<span style="color:var(--text);font-size:0.8rem;font-weight:700;">🔮 Secret Badges</span>';
        html += '<span style="margin-left:auto;font-size:0.7rem;color:' + (allSecretsEarned ? '#22c55e' : 'var(--accent)') + ';font-weight:700;">' + hiddenEarnedCount + '/' + hiddenCount + (allSecretsEarned ? ' ✅' : '') + '</span>';
        html += '</button>';
        html += '<div id="' + _secretId + '" class="badges-grid" style="display:none;">';
        if (anyHiddenEarned) {
            for (const badge of hiddenBadges) {
                const unlocked = earnedHidden.includes(badge.id);
                html += '<div class="badge-item ' + (unlocked ? 'earned' : 'locked') + '" data-badge-id="' + badge.id + '" data-badge-cat="🔮 Secret Badges" onclick="window._showBadgeTip(event,this)" style="padding:10px 5px;background:var(--card-bg);border-radius:12px;border:1px solid var(--border);overflow:visible;">' +
                    '<div class="badge-emoji" style="font-size:1.8rem;margin-bottom:4px;">' + (unlocked ? badge.emoji : '❓') + '</div>' +
                    '<div class="badge-name" style="font-size:0.6rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (unlocked ? badge.name : '???') + '</div>' +
                    '<div class="badge-tooltip" style="white-space:normal;min-width:150px;line-height:1.4;z-index:200;">' + (unlocked ? '✅ ' + badge.desc + ' (+' + badge.pts + ' XP)' : '🔒 Keep exploring!') + '</div>' +
                '</div>';
            }
        } else {
            html += '<div style="text-align:center;padding:10px;color:var(--text-faint);font-size:0.8rem;grid-column:1/-1;">' +
                hiddenCount + ' secret badges waiting to be discovered... 🔮</div>';
        }
        html += '</div></div>';
    }

    return html;
}

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
window._badgeSearch = function(query) {
    var q = (query || '').trim().toLowerCase();
    var resultsEl = document.getElementById('badgeSearchResults');
    if (!resultsEl) return;

    // Clear highlights
    document.querySelectorAll('.badge-item.badge-search-highlight').forEach(function(b) { b.classList.remove('badge-search-highlight'); });

    if (!q) {
        resultsEl.style.display = 'none';
        resultsEl.innerHTML = '';
        return;
    }

    // Search across BADGE_DEFS + HIDDEN_BADGES
    var allBadges = [];
    if (typeof BADGE_DEFS !== 'undefined') allBadges = allBadges.concat(BADGE_DEFS);
    if (typeof HIDDEN_BADGES !== 'undefined') HIDDEN_BADGES.forEach(function(b) { if (!b.hidden) allBadges.push(b); });

    var matches = allBadges.filter(function(b) {
        return b.name.toLowerCase().includes(q) || (b.desc || '').toLowerCase().includes(q);
    }).slice(0, 8);

    if (matches.length === 0) {
        resultsEl.innerHTML = '<div style="padding:12px 14px;color:var(--text-muted);font-size:0.82rem;">No badges found for "' + escapeHtml(query) + '"</div>';
        resultsEl.style.display = 'block';
        return;
    }

    var rhtml = '';
    matches.forEach(function(b) {
        var earned = earnedBadges.has(b.id) || JSON.parse(localStorage.getItem('btc_hidden_badges') || '[]').includes(b.id);
        var cat = (window._badgeCatMap && window._badgeCatMap[b.id]) || '';
        var pts = b.pts || 20;
        var safeId = b.id.replace(/[^a-zA-Z0-9_]/g, '_');
        rhtml += '<div id="bsr_' + safeId + '" style="border-bottom:1px solid var(--border);">';
        // Collapsed row (always visible)
        rhtml += '<div onclick="window._badgeSearchToggle(\'' + b.id + '\',\'' + safeId + '\')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background=\'rgba(247,147,26,0.07)\'" onmouseout="this.style.background=\'\'">' + '<span style="font-size:1.4rem;flex-shrink:0;' + (earned ? '' : 'filter:grayscale(1) opacity(0.4);') + '">' + (earned ? b.emoji : (b.lockedEmoji || '🔘')) + '</span>' + '<div style="flex:1;min-width:0;">' + '<div style="font-size:0.82rem;font-weight:700;color:var(--text);">' + escapeHtml(b.name) + '</div>' + '<div style="font-size:0.7rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (earned ? '✅ ' : '🔒 ') + escapeHtml(b.desc) + '</div>' + '</div>' + '<span style="font-size:0.75rem;color:var(--text-faint);flex-shrink:0;">▾</span>' + '</div>';
        // Expanded detail panel (hidden by default)
        rhtml += '<div id="bsr_detail_' + safeId + '" style="display:none;padding:10px 14px 12px;background:rgba(247,147,26,0.04);border-top:1px solid var(--border);">'
            + '<div style="font-size:0.82rem;color:var(--text);margin-bottom:6px;">' + (earned ? '✅' : '🔒') + ' <strong>' + escapeHtml(b.name) + '</strong></div>'
            + '<div style="font-size:0.78rem;color:var(--text-muted);line-height:1.5;margin-bottom:8px;">' + escapeHtml(b.desc) + '</div>'
            + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:10px;">'
                + (cat ? '<span style="font-size:0.7rem;padding:2px 8px;background:rgba(247,147,26,0.12);border:1px solid rgba(247,147,26,0.25);border-radius:12px;color:var(--accent);font-weight:700;">' + escapeHtml(cat) + '</span>' : '')
                + '<span style="font-size:0.7rem;padding:2px 8px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25);border-radius:12px;color:#22c55e;font-weight:700;">+' + pts + ' XP</span>'
                + (earned ? '<span style="font-size:0.7rem;padding:2px 8px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25);border-radius:12px;color:#22c55e;">Earned ✅</span>' : '')
            + '</div>'
            + '<button onclick="window._badgeSearchJump(\'' + b.id + '\')" style="font-size:0.75rem;padding:6px 14px;background:var(--accent);color:#000;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-weight:700;">View in collection →</button>'
        + '</div>';
        rhtml += '</div>';
    });
    resultsEl.innerHTML = rhtml;
    resultsEl.style.display = 'block';
};

window._badgeSearchToggle = function(badgeId, safeId) {
    var detail = document.getElementById('bsr_detail_' + safeId);
    if (!detail) return;
    var isOpen = detail.style.display !== 'none';
    // Collapse all other open detail panels first
    document.querySelectorAll('[id^="bsr_detail_"]').forEach(function(el) {
        if (el !== detail) {
            el.style.display = 'none';
            // Reset its arrow
            var row = el.previousElementSibling;
            if (row) { var arrow = row.querySelector('span:last-child'); if (arrow) arrow.textContent = '▾'; }
        }
    });
    detail.style.display = isOpen ? 'none' : 'block';
    // Flip arrow on trigger row
    var row = detail.previousElementSibling;
    if (row) { var arrow = row.querySelector('span:last-child'); if (arrow) arrow.textContent = isOpen ? '▾' : '▴'; }
};

window._badgeSearchJump = function(badgeId) {
    // Close search dropdown
    var resultsEl = document.getElementById('badgeSearchResults');
    var input = document.getElementById('badgeSearchInput');
    if (resultsEl) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; }
    if (input) input.value = '';

    // Clear previous highlights
    document.querySelectorAll('.badge-item.badge-search-highlight').forEach(function(b) { b.classList.remove('badge-search-highlight'); });

    // Find the badge item in the DOM
    var target = document.querySelector('.badge-item[data-badge-id="' + badgeId + '"]');
    if (!target) return;

    // Walk up to open any collapsed parent grid
    var parent = target.closest('.badges-grid');
    if (parent && parent.style.display === 'none') {
        parent.style.display = 'grid';
        // Update the section arrow
        var btn = parent.previousElementSibling;
        if (btn) {
            var arrow = btn.querySelector('.bca');
            if (arrow) arrow.textContent = '▼';
        }
    }

    // Highlight and scroll
    target.classList.add('badge-search-highlight');
    setTimeout(function() {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(function() { target.classList.remove('badge-search-highlight'); }, 2500);
    }, 100);
};

// Init
setTimeout(initBadges, 2000);

