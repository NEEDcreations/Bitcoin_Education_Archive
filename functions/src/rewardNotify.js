'use strict';

// Display-only reward notifications for the bell feed (notifications/{id}).
// Callers grant the reward themselves. This module only builds and writes
// the notice, in the same transaction when the caller passes a writer,
// or immediately after when they call commit().

const BADGE_CATALOG = require('./badgeCatalog.json');

const LEVELS = [
    { name: 'Curious', emoji: '🔵', min: 10 },
    { name: 'Pleb', emoji: '🟠', min: 144 },
    { name: 'Pleb II', emoji: '🟠🟠', min: 170 },
    { name: 'Pleb III', emoji: '🟠🟠🟠', min: 256 },
    { name: 'Stacker', emoji: '📦', min: 500 },
    { name: 'Stacker II', emoji: '📦📦', min: 1913 },
    { name: 'Stacker III', emoji: '📦📦📦', min: 2016 },
    { name: 'Maxi', emoji: '🔥', min: 2140 },
    { name: 'Maxi II', emoji: '🔥🔥', min: 6102 },
    { name: 'Maxi III', emoji: '🔥🔥🔥', min: 8888 },
    { name: 'Papa John', emoji: '🍕', min: 10000 },
    { name: 'Full Node', emoji: '🖥️', min: 18333 },
    { name: 'Whale', emoji: '🐋', min: 50000 },
    { name: 'Sovereign', emoji: '🏴', min: 100000 },
    { name: 'Cypherpunk', emoji: '🔒', min: 133337 },
    { name: 'Satoshi', emoji: '👑', min: 210000 },
];

// High-frequency grants share one doc per user per UTC/offset day.
// One-shot grants (quests, spins, purchases, badges, rank-ups) stay individual.
const ACTION_GROUP = {
    channel_read: 'explore',
    channel_read_bonus: 'explore',
    read_time: 'explore',
    chat_message: 'chat',
    forum_reply: 'forum',
    article_read: 'articles',
    article_comment: 'articles',
    beats_listen: 'beats',
    beats_comment: 'beats',
    quiz_correct: 'quiz',
    tctv_watch_10m: 'tctv',
    tctv_watch_ticket: 'tctv',
    pvp_practice: 'pvp',
    pvp_draw: 'pvp',
    pvp_consolation: 'pvp',
    raid_damage_ticket: 'raid',
    flex_action: 'flex',
    sf_booster_hash: 'sf_booster',
};

const GROUP_LABELS = {
    explore: 'exploring topics',
    chat: 'global chat',
    forum: 'forum replies',
    articles: 'articles',
    beats: 'Bitcoin Beats',
    quiz: 'Nacho quizzes',
    tctv: 'Timechain TV',
    pvp: 'PvP',
    raid: 'raid tickets',
    flex: 'daily challenges',
    sf_booster: "Satoshi's Favor",
};

const ACTION_LABELS = {
    daily_visit: 'your daily visit',
    daily_visit_streak: 'your streak',
    explore_10: 'an exploration milestone',
    explore_25: 'an exploration milestone',
    explore_50: 'an exploration milestone',
    explore_75: 'an exploration milestone',
    explore_100: 'an exploration milestone',
    daily_spin: 'the daily spin',
    quest_complete: 'a quest',
    quest_retry: 'a quest retry',
    quest_partial: 'a quest',
    scholar_cert: 'a scholar exam',
    pvp_victory: 'a PvP win',
    forum_post: 'a forum post',
    article_publish: 'publishing an article',
    beats_upload: 'uploading a track',
    irl_host: 'hosting an event',
    prediction: 'a price prediction',
    prediction_correct: 'a correct price prediction',
    welcome_bonus: 'the welcome bonus',
    anon_merge: 'saving anonymous progress',
    story_chapter: 'a story chapter',
    story_final: 'the final story chapter',
    story_complete: 'finishing the story',
    trail_chapter: 'a trail chapter',
    trail_complete: 'finishing a trail',
    lq_lesson: 'a learning quest lesson',
    lq_quiz: 'a learning quest quiz',
    lq_graduate: 'graduating the learning quests',
    ticket_bonus: 'a ticket bonus',
    feedback: 'sending feedback',
    trivia_correct: 'daily trivia',
    trivia_attempt: 'daily trivia',
    poll_vote: 'the daily poll',
    combo_bonus: 'a combo bonus',
    weekly_challenge_contrib: 'the weekly challenge',
    daily_trifecta_ticket: 'the daily trifecta',
    nacho_chat_ticket: 'chatting with Nacho',
    daily_chat_ticket: 'global chat',
    dj_set_ticket: 'a DJ set',
    beats_upload_ticket: 'uploading a beat',
    flashcard_ticket: 'finishing a flashcard deck',
    pvp_win_ticket: 'a PvP win',
    forum_post_ticket: 'a forum post',
    marketplace_listing_ticket: 'a marketplace listing',
    irl_listing_ticket: 'an IRL listing',
    strava_connect_ticket: 'connecting Strava',
};

const SUM_FIELDS = ['xp', 'tickets', 'sats', 'freezes', 'boosterHashes'];

function utcDay(now) {
    const d = now ? new Date(now) : new Date();
    return d.toISOString().slice(0, 10);
}

function safeId(value) {
    return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
}

function rankSlug(name) {
    return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
}

function groupForAction(action) {
    return ACTION_GROUP[action] || null;
}

function badgeMeta(badgeId) {
    if (!badgeId) return null;
    if (BADGE_CATALOG[badgeId]) return BADGE_CATALOG[badgeId];
    const name = String(badgeId).replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    return { name: name, emoji: '🏅', desc: '' };
}

function badgeDocId(uid, badgeId) {
    return 'badge_' + safeId(uid) + '_' + safeId(badgeId);
}

function rankDocId(uid, rankName) {
    return 'rank_' + safeId(uid) + '_' + rankSlug(rankName);
}

function groupDocId(uid, group, day) {
    return 'rn_' + safeId(uid) + '_' + safeId(group) + '_' + safeId(day || utcDay());
}

function levelsCrossed(pointsBefore, pointsDelta) {
    const before = Number(pointsBefore) || 0;
    const after = before + (Number(pointsDelta) || 0);
    if (!(after > before)) return [];
    return LEVELS.filter(function(level) {
        return before < level.min && after >= level.min;
    });
}

function formatCount(n) {
    const v = Math.round(Number(n) || 0);
    const sign = v > 0 ? '+' : '';
    return sign + v.toLocaleString('en-US');
}

function formatRewardMessage(spec) {
    if (spec.message) return String(spec.message).replace(/\s+/g, ' ').trim().slice(0, 180);
    const gains = [];
    const losses = [];
    function push(n, unit) {
        const v = Math.round(Number(n) || 0);
        if (!v) return;
        (v < 0 ? losses : gains).push(formatCount(v) + ' ' + unit);
    }
    push(spec.xp, 'XP');
    push(spec.tickets, '🎟️');
    push(spec.sats, 'sats');
    const freezeN = Math.round(Number(spec.freezes) || 0);
    push(spec.freezes, Math.abs(freezeN) === 1 ? '🧊 streak freeze' : '🧊 streak freezes');
    push(spec.boosterHashes, 'hash-booster hashes');
    (spec.gains || []).forEach(function(item) { if (item) gains.push(item); });
    (spec.losses || []).forEach(function(item) { if (item) losses.push(item); });

    const label = spec.sourceLabel ? String(spec.sourceLabel) : '';
    if (spec.deduction && losses.length && gains.length === 0) {
        return (losses.join(', ') + (label ? ': ' + label : '')).slice(0, 180);
    }
    const parts = gains.concat(losses);
    if (!parts.length) return (label || 'Reward updated').slice(0, 180);
    let msg = parts.join(' and ');
    if (label) msg += ' from ' + label;
    const count = Math.round(Number(spec.count) || 0);
    if (count > 1) msg += ' (' + count + ')';
    return msg.slice(0, 180);
}

function badgeMessage(badgeId) {
    const meta = badgeMeta(badgeId);
    const desc = meta.desc ? ' ' + meta.desc : '';
    return (meta.emoji + ' New badge: ' + meta.name + '!' + desc).slice(0, 180);
}

function rankMessage(level) {
    return (level.emoji + ' Rank up: ' + level.name + '! You reached ' + level.min.toLocaleString('en-US') + ' XP.').slice(0, 180);
}

function sumSpec(base, delta) {
    const out = Object.assign({}, base || {});
    SUM_FIELDS.forEach(function(key) {
        out[key] = (Number(base && base[key]) || 0) + (Number(delta && delta[key]) || 0);
    });
    out.count = (Number(base && base.count) || 0) + (Number(delta && delta.count) || 1);
    return out;
}

function envelope(spec, message) {
    const meta = spec.badgeId ? badgeMeta(spec.badgeId) : null;
    return {
        recipientId: spec.uid,
        senderId: 'system',
        senderName: 'Bitcoin Quest',
        type: spec.type || 'reward',
        message: message,
        targetType: spec.targetType || null,
        targetId: spec.targetId || null,
        read: false,
        source: spec.source || spec.group || spec.action || 'reward',
        xp: Math.round(Number(spec.xp) || 0),
        tickets: Math.round(Number(spec.tickets) || 0),
        sats: Math.round(Number(spec.sats) || 0),
        freezes: Math.round(Number(spec.freezes) || 0),
        count: Math.round(Number(spec.count) || 1),
        icon: spec.icon || (meta && meta.emoji) || null,
        badgeId: (spec.type === 'badge' && spec.badgeId) ? spec.badgeId : null,
        badgeName: (spec.type === 'badge' && meta) ? meta.name : null,
    };
}

function sourceLabelFor(spec) {
    if (spec.sourceLabel) return spec.sourceLabel;
    if (spec.group && GROUP_LABELS[spec.group]) return GROUP_LABELS[spec.group];
    if (spec.action && ACTION_LABELS[spec.action]) return ACTION_LABELS[spec.action];
    if (spec.reason) return String(spec.reason).replace(/\s+/g, ' ').trim().slice(0, 80);
    return 'a reward';
}

// Returns an array of { id, data, grouped, delta }.
// Pass existing (previous grouped doc data) when planning inside a transaction
// that already read the doc. Omit it to let commit() merge under its own transaction.
function plan(spec) {
    const src = spec || {};
    if (!src.uid) return [];
    const plans = [];
    const day = src.day || utcDay();
    const group = src.group || (src.action ? groupForAction(src.action) : null);

    const xp = Math.round(Number(src.xp) || 0);
    const tickets = Math.round(Number(src.tickets) || 0);
    const sats = Math.round(Number(src.sats) || 0);
    const freezes = Math.round(Number(src.freezes) || 0);
    const boosterHashes = Math.round(Number(src.boosterHashes) || 0);
    const hasNumbers = xp || tickets || sats || freezes || boosterHashes;
    const hasText = (src.gains && src.gains.length) || (src.losses && src.losses.length) || src.message;

    if (group && (hasNumbers || hasText)) {
        const delta = {
            xp: xp, tickets: tickets, sats: sats, freezes: freezes,
            boosterHashes: boosterHashes, count: 1,
        };
        const merged = sumSpec(src.existing || null, delta);
        const label = sourceLabelFor(Object.assign({}, src, { group: group }));
        const message = formatRewardMessage(Object.assign({}, merged, {
            sourceLabel: label,
            message: null,
            deduction: false,
        }));
        plans.push({
            id: groupDocId(src.uid, group, day),
            grouped: true,
            delta: delta,
            groupLabel: label,
            data: envelope(Object.assign({}, src, merged, {
                type: 'reward',
                source: group,
                group: group,
                icon: src.icon || '✨',
            }), message),
        });
        // existingRead means the caller already folded `existing` in (even if null).
    } else if (!group && (hasNumbers || hasText)) {
        const label = sourceLabelFor(src);
        const message = formatRewardMessage(Object.assign({}, src, { sourceLabel: label, count: src.count }));
        plans.push({
            id: src.onceKey ? ('rn_' + safeId(src.uid) + '_' + safeId(src.onceKey)) : null,
            grouped: false,
            data: envelope(Object.assign({}, src, { icon: src.icon || (src.deduction ? '🎟️' : '✨') }), message),
        });
    }

    if (src.badgeId && src.notifyBadge !== false) {
        const meta = badgeMeta(src.badgeId);
        plans.push({
            id: badgeDocId(src.uid, src.badgeId),
            grouped: false,
            data: envelope({
                uid: src.uid,
                type: 'badge',
                source: 'badge',
                badgeId: src.badgeId,
                icon: meta.emoji,
                xp: 0, tickets: 0, sats: 0,
            }, badgeMessage(src.badgeId)),
        });
    }

    const ranks = src.ranks || levelsCrossed(src.pointsBefore, src.pointsDelta);
    ranks.forEach(function(level) {
        plans.push({
            id: rankDocId(src.uid, level.name),
            grouped: false,
            data: envelope({
                uid: src.uid,
                type: 'level_up',
                source: 'rank',
                icon: level.emoji,
                rankId: rankSlug(level.name),
            }, rankMessage(level)),
        });
    });

    return plans;
}

// Fix grouped flag: if the caller passed existingRead, data is final and
// commit must NOT add the delta twice. plan() above sets grouped when the
// caller did not supply a read. Callers inside a transaction pass
// existingRead: true (and existing: data|null).
function planFinal(spec) {
    const plans = plan(spec || {});
    // Caller already merged `existing` (including null for "no doc yet").
    if (spec && Object.prototype.hasOwnProperty.call(spec, 'existing')) {
        plans.forEach(function(p) { p.grouped = false; });
    }
    return plans;
}

function apply(writer, db, timestamp, plans) {
    (plans || []).forEach(function(item) {
        if (!item || !item.data) return;
        const ref = item.id
            ? db.collection('notifications').doc(item.id)
            : db.collection('notifications').doc();
        const data = Object.assign({}, item.data, {
            createdAt: timestamp,
            updatedAt: timestamp,
        });
        writer.set(ref, data, { merge: true });
    });
}

async function commit(db, timestamp, plans) {
    const list = plans || [];
    if (!list.length || !db) return;
    const plain = list.filter(function(p) { return !p.grouped; });
    const grouped = list.filter(function(p) { return p.grouped; });
    if (plain.length && typeof db.batch === 'function') {
        const batch = db.batch();
        apply(batch, db, timestamp, plain);
        await batch.commit();
    }
    for (let i = 0; i < grouped.length; i++) {
        const item = grouped[i];
        await db.runTransaction(async function(t) {
            const ref = db.collection('notifications').doc(item.id);
            const snap = await t.get(ref);
            const prev = snap && snap.exists ? snap.data() : null;
            const merged = sumSpec(prev, item.delta || {});
            const message = formatRewardMessage(Object.assign({}, merged, {
                sourceLabel: item.groupLabel || 'a reward',
            }));
            const data = Object.assign({}, item.data, envelope({
                uid: item.data.recipientId,
                type: 'reward',
                source: item.data.source,
                icon: item.data.icon,
                xp: merged.xp,
                tickets: merged.tickets,
                sats: merged.sats,
                freezes: merged.freezes,
                count: merged.count,
            }, message), {
                boosterHashes: merged.boosterHashes || 0,
                createdAt: timestamp,
                updatedAt: timestamp,
            });
            t.set(ref, data, { merge: true });
        });
    }
}

async function safeCommit(db, timestamp, plans) {
    try {
        await commit(db, timestamp, plans);
    } catch (e) {
        console.warn('[rewardNotify]', e && e.message ? e.message : e);
    }
}

module.exports = {
    LEVELS: LEVELS,
    ACTION_GROUP: ACTION_GROUP,
    utcDay: utcDay,
    safeId: safeId,
    groupForAction: groupForAction,
    badgeMeta: badgeMeta,
    badgeDocId: badgeDocId,
    rankDocId: rankDocId,
    groupDocId: groupDocId,
    levelsCrossed: levelsCrossed,
    formatRewardMessage: formatRewardMessage,
    badgeMessage: badgeMessage,
    rankMessage: rankMessage,
    sumSpec: sumSpec,
    plan: planFinal,
    apply: apply,
    commit: commit,
    safeCommit: safeCommit,
};
