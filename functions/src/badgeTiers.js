'use strict';

// Five-tier badge standard (team plan: Rewards, Nov 1 2026, design approved
// by Phil; /workspace/rewards/badge-5-tier-map.md + badge-5-tier-xp.md).
//
// Phil (Nov 2): tiers apply ONLY to badges with incremental progress.
// Checklist / one-and-done badges get no tiers.
//
// A family is ACTIVE only when its counter is written by the server and the
// client cannot write it (firestore.rules userProfileServerOnlyKeys). Every
// other family in the plan is listed in PLANNED for follow-up PRs and is not
// awarded by this module.

// Bitcoin-themed names for bronze / silver / gold / platinum / diamond.
// The plan left names TBD; these are placeholders for Phil to approve.
const TIERS = [
    { n: 1, key: 'pleb', name: 'Pleb', metal: 'bronze', emoji: '🟫' },
    { n: 2, key: 'stacker', name: 'Stacker', metal: 'silver', emoji: '⬜' },
    { n: 3, key: 'hodler', name: 'HODLer', metal: 'gold', emoji: '🟨' },
    { n: 4, key: 'whale', name: 'Whale', metal: 'platinum', emoji: '🟪' },
    { n: 5, key: 'satoshi', name: 'Satoshi', metal: 'diamond', emoji: '💎' },
];

// Phil: Platinum and Diamond also pay Orange Tickets. The amount is not in
// the plan; these are config values pending Phil.
const TIER_TICKETS = { 1: 0, 2: 0, 3: 0, 4: 5, 5: 21 };

// TCTV watch time is credited server-side by tctvWatchHeartbeat, at most
// this many seconds per offset day (plan: "server heartbeat, 3h/day").
const TCTV_LIFE_DAY_CAP_SECONDS = 3 * 3600;

const ACTIVE = {
    tctv_watch: {
        label: 'Timechain TV Watcher',
        emoji: '📺',
        category: 'Prime Time',
        field: 'tctvLifetimeSeconds',
        unit: 60, // thresholds are minutes; the counter is seconds
        unitLabel: 'min watched',
        // threshold (minutes) / XP. Phil (Nov 2): XP rises by tier, max 5,000.
        tiers: [[10, 10], [300, 150], [6000, 1000], [30000, 2500], [126000, 5000]],
    },
};

// Remaining plan families (thresholds I..V). Not active: their counters are
// localStorage today or the mapping onto existing badges needs a migration.
const PLANNED = {
    tctv_switch: [1, 10, 50, 100, 500],
    explorer: [5, 25, 60, 80, 'all'], quest: [1, 5, 25, 50, 'all'],
    chat: [1, 25, 100, 200, 1000], chat_streak: [3, 14, 30, 60, 200],
    dj: [1, 10, 50, 100, 500], dj_songs: [10, 50, 250, 500, 2100], dj_listener: [10, 50, 250, 500, 2100],
    producer: [1, 5, 25, 50, 100], pvp: [1, 10, 50, 100, 500], pvp_played: [1, 25, 100, 250, 1000],
    pvp_win_streak: [3, 7, 15, 21, 50], forum: [1, 10, 50, 100, 500], forum_reply: [1, 25, 100, 250, 1000],
    article: [1, 5, 25, 50, 100], streak: [7, 21, 60, 100, 365], irl_host: [1, 3, 10, 15, 30],
    irl_attend: [1, 5, 21, 30, 100], sats: [1, 500, 2500, 5000, 15000], predict: [1, 25, 100, 250, 1000],
    predict_correct: [5, 25, 100, 250, 1000], predict_streak: [3, 7, 14, 21, 50], predict_top: [1, 5, 15, 26, 104],
    profile_explorer: [5, 25, 100, 250, 1000], tip: [1, 10, 50, 100, 500], tip_received: [1, 10, 50, 100, 500],
    referral: [1, 5, 25, 50, 100], peer_network: [5, 25, 75, 100, 250], key_peers: [1, 5, 21, 50, 210],
    dm: [1, 10, 50, 100, 500], react: [5, 50, 200, 500, 2100], spin: [1, 14, 60, 100, 365],
    spin_streak: [3, 14, 30, 60, 200], spin_closet: [1, 5, 15, 20, 'all'], sf: [1, 50, 500, 1000, 100000],
    sf_contributor: [3, 25, 100, 250, 1000], sf_lucky: [1, 10, 50, 100, 1000], sf_unlucky: [1, 10, 50, 100, 1000],
    raid: [1, 10, 50, 100, 500], raid_boss: [1, 5, 25, 50, 100], trivia_correct: [1, 30, 100, 250, 1000],
    trivia_streak: [3, 14, 30, 60, 200], poll: [1, 25, 100, 200, 500], daily_triple: [1, 14, 60, 90, 365],
    daily: [1, 10, 50, 100, 365], market_listed: [1, 5, 25, 50, 100], bookmarks: [1, 10, 50, 100, 500],
    favs: [5, 25, 75, 100, 'all'], nacho_asked: [10, 50, 250, 500, 2100], beats: [1, 100, 500, 1000, 5000],
    beats_liked: [10, 50, 250, 500, 2100], flex: [1, 25, 100, 200, 1000], lb_lurker: [5, 25, 100, 250, 1000],
    chat_lurker: [5, 25, 100, 250, 1000], gift_open: [1, 25, 250, 500, 1500], gift_sent: [1, 10, 50, 100, 500],
    cipher_peer_key: [1, 10, 50, 100, 500], cipher_sats: [1, 10, 50, 100, 500], topic_comment: [1, 25, 100, 250, 1000],
    raffle: [1, 25, 100, 250, 1000], shop: [1, 10, 50, 100, 500],
};

// Tier XP for PLANNED families (I..V). Plan values (badge-5-tier-xp.md)
// scaled per family so tier V <= TIER_XP_MAX, ratios kept, min 10, rising.
const TIER_XP_MAX = 5000;
const PLANNED_XP = {
    explorer: [75,  400,  1000,  1500,  2500],
    quest: [10,  40,  200,  400,  1000],
    tctv_switch: [10,  15,  20,  30,  150],
    chat: [10,  20,  75,  150,  750],
    chat_streak: [10,  50,  100,  200,  600],
    dj: [10,  100,  500,  1000,  5000],
    dj_songs: [25,  125,  750,  1250,  5000],
    dj_listener: [15,  60,  300,  600,  2500],
    producer: [50,  250,  1250,  2500,  5000],
    pvp: [10,  100,  500,  1000,  5000],
    pvp_played: [10,  135,  500,  1335,  5000],
    pvp_win_streak: [75,  200,  400,  600,  1500],
    forum: [10,  100,  500,  1000,  5000],
    forum_reply: [10,  150,  500,  1500,  5000],
    article: [15,  75,  400,  750,  1500],
    streak: [40,  100,  300,  500,  5000],
    irl_host: [150,  500,  1500,  2500,  5000],
    irl_attend: [50,  250,  1000,  1500,  5000],
    sats: [10,  25,  150,  250,  2100],
    predict: [10,  40,  150,  400,  1500],
    predict_correct: [15,  75,  300,  750,  3000],
    predict_streak: [30,  75,  150,  250,  500],
    predict_top: [50,  250,  750,  1250,  5000],
    profile_explorer: [10,  20,  75,  200,  750],
    tip: [10,  15,  75,  150,  750],
    tip_received: [10,  30,  150,  300,  1500],
    referral: [50,  250,  1500,  2500,  5000],
    peer_network: [15,  75,  250,  400,  2500],
    key_peers: [10,  25,  100,  250,  1000],
    dm: [10,  15,  75,  150,  750],
    react: [10,  15,  30,  75,  400],
    spin: [10,  25,  100,  150,  600],
    spin_streak: [10,  25,  50,  100,  300],
    spin_closet: [10,  40,  150,  250,  400],
    sf: [10,  15,  25,  50,  5000],
    sf_contributor: [10,  40,  150,  400,  1500],
    sf_lucky: [10,  30,  150,  300,  3000],
    sf_unlucky: [10,  30,  150,  300,  3000],
    raid: [10,  100,  500,  1000,  5000],
    raid_boss: [50,  250,  1500,  2500,  5000],
    trivia_correct: [10,  50,  150,  400,  1500],
    trivia_streak: [10,  50,  100,  200,  600],
    poll: [10,  40,  150,  300,  750],
    daily_triple: [10,  210,  835,  1250,  5000],
    daily: [10,  75,  400,  750,  5000],
    market_listed: [10,  40,  200,  400,  750],
    bookmarks: [10,  15,  40,  75,  400],
    favs: [10,  20,  60,  100,  150],
    nacho_asked: [15,  75,  400,  750,  4000],
    beats: [10,  125,  500,  1250,  5000],
    beats_liked: [10,  40,  200,  400,  2000],
    flex: [10,  40,  150,  300,  1500],
    lb_lurker: [10,  20,  75,  200,  750],
    chat_lurker: [10,  20,  75,  200,  750],
    gift_open: [10,  40,  400,  750,  2500],
    gift_sent: [10,  30,  150,  300,  2000],
    cipher_peer_key: [10,  50,  250,  500,  2500],
    cipher_sats: [10,  100,  500,  1000,  5000],
    topic_comment: [10,  150,  500,  1500,  5000],
    raffle: [10,  40,  150,  400,  2000],
    shop: [10,  30,  150,  300,  1500],
};

// Exempt in the plan (bounded / checklist): story, peer_level, every one-and-done.
const EXEMPT = ['story', 'peer_level'];

function badgeId(family, n) {
    return family + '_t' + n;
}

function parseId(id) {
    const m = /^([a-z_]+)_t([1-5])$/.exec(String(id || ''));
    if (!m || !ACTIVE[m[1]]) return null;
    return { family: m[1], n: Number(m[2]) };
}

function isTierId(id) {
    return !!parseId(id);
}

function tierInfo(id) {
    const p = parseId(id);
    if (!p) return null;
    const fam = ACTIVE[p.family];
    const row = fam.tiers[p.n - 1];
    const tier = TIERS[p.n - 1];
    return {
        id: id,
        family: p.family,
        n: p.n,
        tierName: tier.name,
        metal: tier.metal,
        threshold: row[0],
        gte: row[0] * (fam.unit || 1),
        field: fam.field,
        xp: row[1],
        tickets: TIER_TICKETS[p.n] || 0,
    };
}

function familyIds(family) {
    if (!ACTIVE[family]) return [];
    return TIERS.map(function (t) { return badgeId(family, t.n); });
}

function familyForField(field) {
    const out = [];
    Object.keys(ACTIVE).forEach(function (f) {
        if (ACTIVE[f].field === field) out.push.apply(out, familyIds(f));
    });
    return out;
}

function allIds() {
    let out = [];
    Object.keys(ACTIVE).forEach(function (f) { out = out.concat(familyIds(f)); });
    return out;
}

function fmt(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Catalog rows for buildBadgeCatalog (display name, desc, xp, category).
function catalogExtras(xpCap) {
    const out = {};
    Object.keys(ACTIVE).forEach(function (f) {
        const fam = ACTIVE[f];
        familyIds(f).forEach(function (id) {
            const info = tierInfo(id);
            const hours = fam.unit === 60 && info.threshold >= 60
                ? fmt(Math.round(info.threshold / 60)) + ' hours'
                : fmt(info.threshold) + ' minutes';
            const xp = xpCap ? Math.min(info.xp, xpCap) : info.xp;
            const otBit = info.tickets ? ' (+' + info.tickets + ' orange tickets)' : '';
            out[id] = {
                name: fam.label + ' · ' + info.tierName,
                emoji: TIERS[info.n - 1].emoji,
                desc: 'Watched ' + hours + ' of Timechain TV (server-verified, up to 3 hours a day)' + otBit,
                xp: xp,
                category: fam.category,
            };
        });
    });
    return out;
}

// Progress for a family from a user doc: current tier, next threshold, and
// the live running total shown after tier V (display only, no XP).
function progress(family, user) {
    const fam = ACTIVE[family];
    if (!fam) return null;
    const raw = Math.max(0, Math.floor(Number((user || {})[fam.field]) || 0));
    const value = Math.floor(raw / (fam.unit || 1));
    let tier = 0;
    fam.tiers.forEach(function (row, i) { if (value >= row[0]) tier = i + 1; });
    const next = tier < 5 ? fam.tiers[tier][0] : null;
    return { family: family, value: value, tier: tier, next: next, maxed: tier === 5 };
}

module.exports = {
    TIERS: TIERS,
    TIER_TICKETS: TIER_TICKETS,
    TCTV_LIFE_DAY_CAP_SECONDS: TCTV_LIFE_DAY_CAP_SECONDS,
    ACTIVE: ACTIVE,
    PLANNED: PLANNED,
    PLANNED_XP: PLANNED_XP,
    TIER_XP_MAX: TIER_XP_MAX,
    EXEMPT: EXEMPT,
    badgeId: badgeId,
    isTierId: isTierId,
    tierInfo: tierInfo,
    familyIds: familyIds,
    familyForField: familyForField,
    allIds: allIds,
    catalogExtras: catalogExtras,
    progress: progress,
};
