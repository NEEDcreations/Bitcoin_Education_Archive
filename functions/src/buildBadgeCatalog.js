'use strict';

// Builds functions/src/badges.catalog.json and badges.catalog.js from the
// current server map plus the client badge definitions. Run:
//   node functions/src/buildBadgeCatalog.js

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');

function read(rel) {
    return fs.readFileSync(path.join(root, rel), 'utf8');
}

function sliceBetween(text, start, end) {
    const i = text.indexOf(start);
    const j = text.indexOf(end, i + start.length);
    if (i < 0 || j < 0) throw new Error('missing slice ' + start);
    return text.slice(i, j);
}

function grabFields(block) {
    function one(key) {
        const re = new RegExp(key + "\\s*:\\s*(?:'((?:\\\\'|[^'])*)'|\"((?:\\\\\"|[^\"])*)\")");
        const m = block.match(re);
        if (!m) return '';
        return (m[1] || m[2] || '').replace(/\\'/g, "'").replace(/\\"/g, '"');
    }
    const pts = block.match(/pts\s*:\s*(-?\d+)/);
    return {
        name: one('name'),
        emoji: one('emoji'),
        desc: one('desc') || one('hint'),
        pts: pts ? Number(pts[1]) : null,
        hidden: /hidden\s*:\s*true/.test(block),
    };
}

function collectObjects(text) {
    const out = {};
    // A word boundary keeps `raid: 'Raid'` from looking like `id: 'Raid'`.
    const re = /(?:^|[^A-Za-z0-9_])id\s*:\s*['"]([a-zA-Z0-9_]+)['"]/g;
    let m;
    while ((m = re.exec(text))) {
        const id = m[1];
        const block = text.slice(m.index, m.index + 700);
        if (!out[id]) out[id] = grabFields(block);
    }
    return out;
}

function collectValues(text) {
    const out = {};
    const re = /([a-z][a-z0-9_]*)\s*:\s*(-?\d+)/g;
    let m;
    while ((m = re.exec(text))) out[m[1]] = Number(m[2]);
    return out;
}

const index = read('functions/index.js');
const valuesBlock = sliceBetween(index, 'const BADGE_VALUES = {', 'const FLEX_ACTION_IDS');
const serverXp = collectValues(valuesBlock);
const channelMatch = index.match(/const VALID_CHANNEL_IDS = new Set\(\[([\s\S]*?)\]\)/);
const channelCount = channelMatch ? (channelMatch[1].match(/"/g) || []).length / 2 : 146;

const flexIds = ['steak','sunlight','dca','custody','lift','meetup','lightning','read','sleep','nokyc','node','cold','fast','walk','journal','meditate','teach','water','gratitude','verify','focus','risk','pattern','findq','noleverage','gunrange','sellchairs','starebtc','itoldyou','pumpndump'];
const flexMilestones = [1, 5, 10, 25, 50, 100, 500, 1000];
flexIds.forEach(function (aid) {
    flexMilestones.forEach(function (milestone) {
        const id = 'flex_' + aid + '_' + milestone;
        if (serverXp[id] == null) serverXp[id] = 0;
    });
});

const client = Object.assign(
    {},
    collectObjects(read('badges.js')),
    collectObjects(read('features.js')),
    collectObjects(read('quests.js'))
);

const extra = {
    daily_five_1: { name: 'High Five', emoji: '🖐️', desc: 'Finished all 5 daily challenges in one day', xp: 50, category: 'Daily Five' },
    daily_five_7: { name: 'Five Alive', emoji: '🖐️', desc: 'Finished the daily five on 7 days', xp: 150, category: 'Daily Five' },
    daily_five_30: { name: 'Fivefold', emoji: '🖐️', desc: 'Finished the daily five on 30 days', xp: 500, category: 'Daily Five' },
    daily_five_100: { name: 'Perfect Hundred', emoji: '💯', desc: 'Finished the daily five on 100 days', xp: 1500, category: 'Daily Five' },
    daily_five_streak_7: { name: 'Five-Day Fever', emoji: '🔥', desc: 'Finished the daily five 7 days in a row', xp: 300, category: 'Daily Five' },
    say_hi_1: { name: 'Hello World', emoji: '👋', desc: 'Said hi in Global Chat', xp: 15, category: 'Community Voice' },
    say_hi_7: { name: 'Friendly Face', emoji: '👋', desc: 'Said hi on 7 days', xp: 75, category: 'Community Voice' },
    say_hi_30: { name: 'Town Greeter', emoji: '👋', desc: 'Said hi on 30 days', xp: 250, category: 'Community Voice' },
    say_hi_100: { name: 'Mayor of Chat', emoji: '🎩', desc: 'Said hi on 100 days', xp: 750, category: 'Community Voice' },
    tctv_daily_1: { name: 'Tuned In Daily', emoji: '📺', desc: 'Watched 10 minutes of Timechain TV in one day', xp: 25, category: 'Prime Time' },
    tctv_daily_7: { name: 'Regular Viewer', emoji: '📺', desc: 'Watched Timechain TV on 7 days', xp: 100, category: 'Prime Time' },
    tctv_daily_30: { name: 'Prime Timer', emoji: '📺', desc: 'Watched Timechain TV on 30 days', xp: 300, category: 'Prime Time' },
    tctv_daily_100: { name: 'Network Exec', emoji: '📺', desc: 'Watched Timechain TV on 100 days', xp: 1000, category: 'Prime Time' },
    reply_bonus_1: { name: 'Conversation Starter', emoji: '💬', desc: 'Earned a reply bonus', xp: 15, category: 'Community Voice' },
    reply_bonus_25: { name: 'Good Listener', emoji: '💬', desc: 'Earned 25 reply bonuses', xp: 75, category: 'Community Voice' },
    reply_bonus_100: { name: 'Thread Weaver', emoji: '🧵', desc: 'Earned 100 reply bonuses', xp: 250, category: 'Community Voice' },
    reply_bonus_500: { name: 'Community Pillar', emoji: '🏛️', desc: 'Earned 500 reply bonuses', xp: 750, category: 'Community Voice' },
    poll_days_7: { name: 'Voice of the People', emoji: '🗳️', desc: 'Voted in the daily poll on 7 days', xp: 50, category: 'Daily Scholar' },
    poll_days_30: { name: 'Poll Regular', emoji: '🗳️', desc: 'Voted in the daily poll on 30 days', xp: 250, category: 'Daily Scholar' },
    poll_days_100: { name: 'Poll Warden', emoji: '🗳️', desc: 'Voted in the daily poll on 100 days', xp: 1000, category: 'Daily Scholar' },
    quest_days_7: { name: 'Quiz Regular', emoji: '📝', desc: 'Finished a daily quiz on 7 days', xp: 50, category: 'Daily Scholar' },
    quest_days_30: { name: 'Quiz Devotee', emoji: '📝', desc: 'Finished a daily quiz on 30 days', xp: 250, category: 'Daily Scholar' },
    quest_days_100: { name: 'Quiz Master', emoji: '📝', desc: 'Finished a daily quiz on 100 days', xp: 1000, category: 'Daily Scholar' },
    sf_trifecta_10: { name: 'Favor Feeder', emoji: '🔱', desc: 'Completed the daily trifecta 10 times', xp: 100, category: 'Favor' },
    sf_trifecta_50: { name: 'Favor Regular', emoji: '🔱', desc: 'Completed the daily trifecta 50 times', xp: 300, category: 'Favor' },
    sf_trifecta_100: { name: 'Favor Keeper', emoji: '🔱', desc: 'Completed the daily trifecta 100 times', xp: 750, category: 'Favor' },
    peer_1: { name: 'First Peer', emoji: '🤝', desc: 'Accepted your first peer', xp: 25, category: 'Peer Network' },
    peer_3: { name: 'Small Circle', emoji: '🤝', desc: 'Accepted 3 peers', xp: 75, category: 'Peer Network' },
    peer_10: { name: 'Node Operator', emoji: '🕸️', desc: 'Accepted 10 peers', xp: 250, category: 'Peer Network' },
    peer_25: { name: 'Hub', emoji: '🌐', desc: 'Accepted 25 peers', xp: 750, category: 'Peer Network' },
    market_sold_1: { name: 'First Sale', emoji: '🏷️', desc: 'Sold a listing that had a buyer message', xp: 50, category: 'Open for Business' },
    market_sold_5: { name: 'Trusted Seller', emoji: '🏷️', desc: 'Sold 5 listings that had a buyer message', xp: 200, category: 'Open for Business' },
    cipher_1: { name: 'Decoder', emoji: '🔐', desc: 'Opened your first cipher', xp: 15, category: 'Codebreaker' },
    cipher_10: { name: 'Cryptographer', emoji: '🔐', desc: 'Opened 10 ciphers', xp: 100, category: 'Codebreaker' },
    cipher_50: { name: 'Enigma', emoji: '🔐', desc: 'Opened 50 ciphers', xp: 400, category: 'Codebreaker' },
    cipher_200: { name: "Satoshi's Pen", emoji: '🖊️', desc: 'Opened 200 ciphers', xp: 1500, category: 'Codebreaker' },
    gift_sent_1: { name: 'Gift Giver', emoji: '🎁', desc: 'A peer used a key you sent', xp: 10, category: 'Open Hand' },
    gift_sent_10: { name: 'Generous', emoji: '🎁', desc: 'Peers used 10 keys you sent', xp: 150, category: 'Open Hand' },
    gift_sent_50: { name: 'Santa Sats', emoji: '🎅', desc: 'Peers used 50 keys you sent', xp: 500, category: 'Open Hand' },
    plebtalk_1: { name: 'First Words', emoji: '📣', desc: 'Joined a PlebTalk session', xp: 15, category: 'Community Voice' },
    plebtalk_10: { name: 'Regular Guest', emoji: '📣', desc: 'Joined 10 PlebTalk sessions', xp: 100, category: 'Community Voice' },
    plebtalk_50: { name: 'PlebTalk Host', emoji: '🎙️', desc: 'Joined 50 PlebTalk sessions', xp: 400, category: 'Community Voice' },
    onboarding_complete: { name: 'Welcome Aboard', emoji: '🧭', desc: 'Finished onboarding', xp: 100, category: 'Welcome Aboard' },
    push_enabled: { name: 'Ring the Bell', emoji: '🔔', desc: 'Turned on push notifications', xp: 25, category: 'Welcome Aboard' },
    profile_complete: { name: 'Filled In', emoji: '🪪', desc: 'Added a username, bio, and country', xp: 25, category: 'Welcome Aboard' },
    sf_100000_hashes: { name: 'Hundred Thousand Hashes', emoji: '⛏️', desc: 'Contributed 100,000 Satoshi\'s Favor hashes', xp: 5000, category: 'Favor' },
    set_daily_five: { name: 'Daily Five Set', emoji: '🖐️', desc: 'Completed the Daily Five collection', xp: 500, category: 'Collections' },
    set_voice: { name: 'Community Voice Set', emoji: '💬', desc: 'Completed the Community Voice collection', xp: 500, category: 'Collections' },
    set_tv: { name: 'Prime Time Set', emoji: '📺', desc: 'Completed the Prime Time collection', xp: 500, category: 'Collections' },
    set_trader: { name: 'Open for Business Set', emoji: '🏪', desc: 'Completed the Open for Business collection', xp: 500, category: 'Collections' },
    set_codebreaker: { name: 'Codebreaker Set', emoji: '🔐', desc: 'Completed the Codebreaker collection', xp: 750, category: 'Collections' },
    set_generous: { name: 'Open Hand Set', emoji: '🎁', desc: 'Completed the Open Hand collection', xp: 500, category: 'Collections' },
    set_network: { name: 'Peer Network Set', emoji: '🤝', desc: 'Completed the Peer Network collection', xp: 500, category: 'Collections' },
    set_gladiator: { name: 'Gladiator Set', emoji: '⚔️', desc: 'Completed the Gladiator collection', xp: 750, category: 'Collections' },
    set_scholar_daily: { name: 'Daily Scholar Set', emoji: '📚', desc: 'Completed the Daily Scholar collection', xp: 750, category: 'Collections' },
    set_newcomer: { name: 'Welcome Aboard Set', emoji: '🧭', desc: 'Completed the Welcome Aboard collection', xp: 250, category: 'Collections' },
    set_favor: { name: 'Favor of Satoshi Set', emoji: '🔱', desc: 'Completed the Favor of Satoshi collection', xp: 1000, category: 'Collections' },
    gift_open_1: { name: 'Unwrapped', emoji: '🎁', desc: 'Opened your first gift', xp: 10, category: 'Open Hand' },
    gift_open_25: { name: 'Ribbon Cutter', emoji: '🎀', desc: 'Opened 25 gifts', xp: 50, category: 'Open Hand' },
    gift_open_100: { name: 'Present Pro', emoji: '🎁', desc: 'Opened 100 gifts', xp: 150, category: 'Open Hand' },
    gift_open_500: { name: 'Gift Hoarder', emoji: '📦', desc: 'Opened 500 gifts', xp: 500, category: 'Open Hand' },
    gift_open_1500: { name: 'Endless Wrapping', emoji: '♾️', desc: 'Opened 1,500 gifts', xp: 2000, category: 'Open Hand' },
    gift_lucky_shoutout: { name: "Nacho's Pick", emoji: '📣', desc: "A gift's Nacho shoutout was posted", xp: 50, category: 'Open Hand' },
    gift_sent_200: { name: 'Key Philanthropist', emoji: '🗝️', desc: 'Peers used 200 keys you sent', xp: 2000, category: 'Open Hand' },
    key_peers_5: { name: 'Keymaster', emoji: '🔑', desc: '5 different peers used a key you sent', xp: 150, category: 'Peer Network' },
    key_peers_21: { name: 'Web of Trust', emoji: '🕸️', desc: '21 different peers used a key you sent', xp: 500, category: 'Peer Network' },
    cipher_peer_key_1: { name: 'Borrowed Key', emoji: '🔐', desc: "Opened a cipher with a peer's key", xp: 10, category: 'Codebreaker' },
    cipher_peer_key_25: { name: 'Trusted Circle', emoji: '🔐', desc: "Opened 25 ciphers with peers' keys", xp: 150, category: 'Codebreaker' },
    cipher_peer_key_100: { name: 'Shared Secrets', emoji: '🔐', desc: "Opened 100 ciphers with peers' keys", xp: 500, category: 'Codebreaker' },
    cipher_full_ring: { name: 'Full Keyring', emoji: '💍', desc: 'Opened 21 ciphers in one day', xp: 150, category: 'Codebreaker' },
    cipher_sats_1: { name: 'Cracked the Vault', emoji: '⚡', desc: 'Received your first paid cipher sats win', xp: 150, category: 'Codebreaker' },
    cipher_sats_5: { name: 'Vault Regular', emoji: '⚡', desc: 'Received 5 paid cipher sats wins', xp: 500, category: 'Codebreaker' },
    cipher_sats_10k: { name: 'Whale Cipher', emoji: '🐳', desc: 'A paid cipher win of 10,000 sats or more', xp: 2000, category: 'Codebreaker' },
    peer_level_2: { name: 'Channel Opened', emoji: '🟨', desc: 'A peer pair reached Opening Channel', xp: 10, category: 'Peer Network' },
    peer_level_3: { name: 'Routing Nodes', emoji: '🟧', desc: 'A peer pair reached Routing Nodes', xp: 50, category: 'Peer Network' },
    peer_level_4: { name: 'Adjusted Fees', emoji: '🟦', desc: 'A peer pair reached Adjusted Fees', xp: 150, category: 'Peer Network' },
    peer_level_5: { name: 'Balanced Liquidity', emoji: '🟪', desc: 'A peer pair reached Balanced Liquidity', xp: 500, category: 'Peer Network' },
    peer_level_6: { name: 'Wumbo Channel', emoji: '⚡', desc: 'A peer pair reached Wumbo Channel', xp: 2000, category: 'Peer Network' },
    peer_hub_5: { name: 'Lightning Hub', emoji: '🌐', desc: '5 peers at Routing Nodes or higher', xp: 500, category: 'Peer Network' },
    topic_comment_1: { name: 'Chimed In', emoji: '💬', desc: 'A counted comment on a topic', xp: 10, category: 'Community Voice' },
    topic_comment_10: { name: 'Discussion Regular', emoji: '💬', desc: '10 counted topic comments', xp: 50, category: 'Community Voice' },
    topic_comment_50: { name: 'Thread Weaver', emoji: '🧵', desc: '50 counted topic comments', xp: 150, category: 'Community Voice' },
    topic_comment_250: { name: 'Town Crier', emoji: '📢', desc: '250 counted topic comments', xp: 500, category: 'Community Voice' },
    topic_channels_10: { name: 'Well-Rounded', emoji: '📚', desc: 'Counted comments in 10 different topics', xp: 150, category: 'Community Voice' },
    shop_10: { name: 'Regular Customer', emoji: '🛒', desc: "Made 10 purchases in Nacho's Nook", xp: 50, category: 'Nook' },
    shop_50: { name: 'Nook VIP', emoji: '🛒', desc: "Made 50 purchases in Nacho's Nook", xp: 150, category: 'Nook' },
    raffle_entered: { name: 'Feeling Lucky', emoji: '🎟️', desc: 'Bought a raffle ticket with orange tickets', xp: 10, category: 'Raffle' },
    raffle_10: { name: 'Ticket Stacker', emoji: '🎟️', desc: 'Bought 10 raffle tickets with orange tickets', xp: 50, category: 'Raffle' },
    raffle_50: { name: 'Regular Drawer', emoji: '🎲', desc: 'Bought 50 raffle tickets with orange tickets', xp: 150, category: 'Raffle' },
    raffle_250: { name: 'High Roller', emoji: '🎰', desc: 'Bought 250 raffle tickets with orange tickets', xp: 500, category: 'Raffle' },
    raffle_1000: { name: 'House Favorite', emoji: '🏆', desc: 'Bought 1,000 raffle tickets with orange tickets', xp: 2000, category: 'Raffle' },
    raffle_winner: { name: 'Raffle Champion', emoji: '🏆', desc: 'Won the monthly orange-ticket raffle', xp: 500, category: 'Raffle' },
    predict_top_week: { name: 'Weekly Oracle', emoji: '🔮', desc: 'Paid as a weekly Top Predictor', xp: 150, category: 'Oracle' },
    predict_top_week_5: { name: 'Seasoned Oracle', emoji: '🔮', desc: 'Paid as a weekly Top Predictor 5 times', xp: 500, category: 'Oracle' },
    predict_top_month: { name: 'Monthly Oracle', emoji: '🌕', desc: 'Paid as a monthly Top Predictor', xp: 500, category: 'Oracle' },
    totp_enabled: { name: 'Fort Knox', emoji: '🔒', desc: 'Turned on an authenticator', xp: 50, category: 'Sovereign Setup' },
    faction_chosen: { name: 'Pledged', emoji: '🏴', desc: 'Chose a faction', xp: 10, category: 'Sovereign Setup' },
    set_oracle: { name: 'Oracle Set', emoji: '🔮', desc: 'Completed the Oracle collection', xp: 500, category: 'Collections' },
    set_sovereign: { name: 'Sovereign Setup Set', emoji: '🔒', desc: 'Completed the Sovereign Setup collection', xp: 150, category: 'Collections' },
    set_raffle: { name: 'Raffle Regular Set', emoji: '🎟️', desc: 'Completed the Raffle Regular collection', xp: 500, category: 'Collections' },
};

const collectionBonus = require('./collectionBonus');
collectionBonus.writeSetsFile();
collectionBonus.collections().forEach(function (col) {
    extra[col.bonusId] = {
        name: col.bonusName,
        emoji: col.bonusEmoji,
        desc: col.bonusDesc,
        xp: col.bonusPts,
        category: 'Collections',
        hidden: true,
    };
});

const badges = {};
Object.keys(serverXp).forEach(function (id) {
    const meta = client[id] || {};
    badges[id] = {
        name: meta.name || id,
        emoji: meta.emoji || '🏅',
        desc: meta.desc || '',
        xp: serverXp[id],
        hidden: meta.hidden === true,
        category: '',
    };
});
Object.keys(client).forEach(function (id) {
    if (badges[id]) {
        if (!badges[id].name || badges[id].name === id) badges[id].name = client[id].name || badges[id].name;
        if (client[id].emoji) badges[id].emoji = client[id].emoji;
        if (client[id].desc) badges[id].desc = client[id].desc;
        if (client[id].hidden) badges[id].hidden = true;
        return;
    }
    badges[id] = {
        name: client[id].name || id,
        emoji: client[id].emoji || '🏅',
        desc: client[id].desc || '',
        xp: client[id].pts || 0,
        hidden: client[id].hidden === true,
        category: '',
    };
});
Object.keys(extra).forEach(function (id) {
    badges[id] = {
        name: extra[id].name,
        emoji: extra[id].emoji,
        desc: extra[id].desc,
        xp: extra[id].xp,
        hidden: extra[id].hidden === true,
        category: extra[id].category,
    };
});

// The proposed sheet is the only XP amount. Display and the server both
// read it. A missing id keeps the definition it was parsed from.
const xpTable = require('./badge-xp.json');
Object.keys(badges).forEach(function (id) {
    if (xpTable.badges[id]) badges[id].xp = Number(xpTable.badges[id].xp) || 0;
});

const doc = {
    version: 1,
    channelCount: channelCount,
    badges: badges,
};

const jsonPath = path.join(__dirname, 'badges.catalog.json');
fs.writeFileSync(jsonPath, JSON.stringify(doc));

const catalogJsonPath = require.resolve('./badges.catalog.json');
const rulesPath = require.resolve('./badgeRules');
delete require.cache[catalogJsonPath];
delete require.cache[rulesPath];
const freshRules = require('./badgeRules');

const clientBadges = {};
Object.keys(badges).forEach(function (id) {
    const rule = freshRules.ruleFor(id);
    clientBadges[id] = {
        name: badges[id].name,
        emoji: badges[id].emoji,
        desc: badges[id].desc,
        xp: badges[id].xp,
        category: badges[id].category || '',
        hidden: badges[id].hidden === true,
        serverAward: !!(rule && !rule.cosmetic),
    };
});
const collectionPay = {};
collectionBonus.collections().forEach(function (col) {
    collectionPay[col.id] = {
        bonusPts: col.bonusPts,
        legacy: (col.legacyBonuses || []).map(function (row) {
            return { id: row.id, pts: row.pts };
        }),
    };
});
const clientJs = 'window.BADGE_CATALOG=' + JSON.stringify(clientBadges) + ';\nwindow.BADGE_CATALOG_VERSION=1;\nwindow.BADGE_COLLECTION_PAY=' + JSON.stringify(collectionPay) + ';\n';
fs.writeFileSync(path.join(root, 'badges.catalog.js'), clientJs);
console.log('badges', Object.keys(badges).length, 'channels', channelCount);
