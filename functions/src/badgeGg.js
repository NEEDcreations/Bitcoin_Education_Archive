'use strict';

// Every server badge award is posted in GGs (announcements), grouped per player.
// BURST_WINDOW_MS is 60 seconds, measured from the first unposted badge. Badges
// that land in that window collapse into one announcement. A minutely cron
// flushes a quiet burst; a badge that arrives after the window flushes the
// open burst first, then starts the next one.
// Each award is claimed once (badge_gg_claims/{uid}__{badgeId}), and the
// announcement id is badgegg_{uid}_{startedAtMs}, so a trigger retry cannot
// post the same award twice. Backfill and admin-sourced awards are not queued.
// The text uses the display name only. mentionUid is a field, never the text.

const badgeRules = require('./badgeRules');

const BURST_WINDOW_MS = 60 * 1000;

// Matches badges.js MAJOR_BADGES. A lone major badge keeps that post's wording.
const MAJOR_BADGES = [
    'explorer_50', 'explorer_100', 'explorer_all', 'properties_all',
    'quest_5', 'quest_25', 'quest_100', 'cert_scholar', 'cert_tech',
    'cert_double', 'all_certs', 'gift_open_1500', 'gift_sent_200',
    'cipher_sats_10k', 'peer_level_6', 'raffle_1000',
];

function safeId(raw) {
    return String(raw || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
}

function skipBadgeGg(data) {
    if (!data || typeof data !== 'object') return true;
    if (data.backfill === true || data.ggSkip === true) return true;
    const source = String(data.source || '');
    const xpSource = String(data.xpSource || '');
    const blob = (source + ' ' + xpSource).toLowerCase();
    if (blob.indexOf('backfill') !== -1) return true;
    if (blob.indexOf('admin') !== -1) return true;
    if (source === 'legacy' || xpSource === 'legacy') return true;
    return false;
}

function sanitizeDisplayName(raw) {
    let s = String(raw == null ? '' : raw);
    s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');
    s = s.replace(/https?:\/\/\S+/gi, ' ');
    s = s.replace(/\bwww\.\S+/gi, ' ');
    s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ' ');
    s = s.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, ' ');
    // Keep underscores so satoshi_fan stays intact. Chat and Telegram HTML
    // do not treat "_" as markup, so the character is shown as itself.
    s = s.replace(/[\[\]()#*~`@]/g, '');
    s = s.replace(/[\r\n<>]/g, ' ');
    s = s.replace(/\s+/g, ' ').trim().slice(0, 40);
    return s;
}

function cleanLabel(raw) {
    let s = String(raw == null ? '' : raw);
    s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');
    s = s.replace(/https?:\/\/\S+/gi, ' ');
    s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ' ');
    s = s.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, ' ');
    s = s.replace(/[\r\n<>@`]/g, ' ');
    s = s.replace(/\s+/g, ' ').trim().slice(0, 60);
    return s;
}

function titleCaseWord(word) {
    const s = String(word || '');
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function stripIdPrefixes(id) {
    let s = String(id || '');
    let prev = '';
    while (s && s !== prev) {
        prev = s;
        s = s.replace(/^(?:flex_|badge_|bc_)/, '');
    }
    return s;
}

// flex_pattern_25 → "Pattern ×25". The action id is title-cased and the
// trailing tier is the count. A catalog name that is the raw id is not used.
function flexDisplayName(id) {
    if (String(id || '').indexOf('flex_') !== 0) return '';
    const parts = id.slice(5).split('_').filter(Boolean);
    if (!parts.length) return '';
    const last = parts[parts.length - 1];
    if (/^\d+$/.test(last) && parts.length >= 2) {
        const action = parts.slice(0, -1).map(titleCaseWord).join(' ');
        return action ? (action + ' ×' + last) : '';
    }
    return parts.map(titleCaseWord).join(' ');
}

function fallbackDisplayName(id) {
    const parts = stripIdPrefixes(id).split('_').filter(Boolean).map(titleCaseWord);
    return parts.join(' ');
}

function badgeName(badgeId) {
    const id = String(badgeId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60);
    if (!id) return 'a badge';
    const rule = badgeRules.ruleFor(id);
    const catalog = rule && rule.name ? String(rule.name) : '';
    if (catalog && catalog !== id) {
        const cleaned = cleanLabel(catalog);
        if (cleaned && cleaned !== id) return cleaned;
    }
    const flex = flexDisplayName(id);
    const candidate = flex || fallbackDisplayName(id);
    const cleaned = cleanLabel(candidate);
    if (!cleaned || cleaned === id) return 'a badge';
    return cleaned;
}

const NAME_LIST_CAP = 5;

function joinNames(names) {
    const list = (names || []).filter(Boolean);
    if (list.length <= NAME_LIST_CAP) return list.join(', ');
    const extra = list.length - NAME_LIST_CAP;
    return list.slice(0, NAME_LIST_CAP).join(', ') + ' and ' + extra + ' more';
}

function badgeEmoji(badgeId) {
    const id = String(badgeId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60);
    const rule = id ? badgeRules.ruleFor(id) : null;
    return (rule && rule.emoji) || '🏅';
}

function sfSuffix(count) {
    const n = Number(count) || 0;
    if (n <= 0) return '';
    return ' (+' + n + ' SF point' + (n === 1 ? '' : 's') + ')';
}

function favorCount(items) {
    let n = 0;
    (items || []).forEach(function (item) { if (item && item.favorPoint === true) n += 1; });
    return n;
}

function isFlex(item) {
    return String(item && item.badgeId || '').indexOf('flex_') === 0;
}

function isMajor(item) {
    return MAJOR_BADGES.indexOf(String(item && item.badgeId || '')) !== -1;
}

// One GGs line. Major badges keep "just earned the {emoji} {name} badge!"
// and lead a mixed burst. "+N SF points" counts pool points only.
function formatBadgeGg(name, items) {
    const display = sanitizeDisplayName(name) || 'A player';
    const list = (items || []).filter(function (item) { return item && item.badgeId; });
    const suffix = sfSuffix(favorCount(list));
    if (!list.length) return '🏅 @' + display + ' earned a badge' + suffix;
    const majors = list.filter(isMajor);
    const rest = list.filter(function (item) { return !isMajor(item); });
    if (list.length === 1 && majors.length === 1) {
        const only = majors[0];
        return '🏅 @' + display + ' just earned the ' + badgeEmoji(only.badgeId) + ' ' + badgeName(only.badgeId) + ' badge! 🎉' + suffix;
    }
    if (majors.length >= 1) {
        const lead = majors[0];
        const also = majors.slice(1).concat(rest).map(function (item) { return badgeName(item.badgeId); });
        let text = '🏅 @' + display + ' just earned the ' + badgeEmoji(lead.badgeId) + ' ' + badgeName(lead.badgeId) + ' badge! 🎉';
        if (also.length) text += ' Also: ' + joinNames(also);
        return text + suffix;
    }
    const flexOnly = list.length > 1 && list.every(isFlex);
    if (flexOnly) {
        return '🏅 @' + display + ' earned ' + list.length + ' flex badges' + suffix;
    }
    if (list.length === 1) {
        return '🏅 @' + display + ' earned ' + badgeName(list[0].badgeId) + suffix;
    }
    const names = list.map(function (item) { return badgeName(item.badgeId); });
    return '🏅 @' + display + ' earned ' + list.length + ' badges: ' + joinNames(names) + suffix;
}

function newBurst(uid, item, nowMs) {
    return {
        uid: uid,
        startedAtMs: nowMs,
        flushAfterMs: nowMs + BURST_WINDOW_MS,
        posted: false,
        items: [item],
    };
}

function announcementId(uid, startedAtMs) {
    return 'badgegg_' + safeId(uid) + '_' + startedAtMs;
}

function displayNameFromUser(user) {
    const data = user || {};
    const name = sanitizeDisplayName(data.username || '');
    if (!name) return 'A player';
    return name;
}

function stageAnnouncement(t, db, adminSdk, burst, user, existingSnap) {
    const annId = announcementId(burst.uid, burst.startedAtMs);
    const annRef = db.collection('announcements').doc(annId);
    const name = displayNameFromUser(user, burst.uid);
    const text = formatBadgeGg(name, burst.items || []);
    const exists = !!(existingSnap && existingSnap.exists);
    if (!exists) {
        t.set(annRef, {
            uid: 'nacho-bot',
            name: '🦌 Nacho',
            text: text,
            isNachoAuto: true,
            mentionUid: burst.uid,
            ts: adminSdk.firestore.FieldValue.serverTimestamp(),
            postedByUid: 'badge-gg',
        });
    }
    return { annId: annId, text: text, created: !exists };
}

async function queueBadgeGg(db, adminSdk, uid, badgeId, data, nowMs) {
    if (skipBadgeGg(data)) return { queued: false, reason: 'skip' };
    const safeUid = safeId(uid);
    const safeBadge = safeId(badgeId || (data && data.badge));
    if (!safeUid || !safeBadge) return { queued: false, reason: 'id' };
    const at = Number(nowMs) || Date.now();
    const claimRef = db.collection('badge_gg_claims').doc(safeUid + '__' + safeBadge);
    const burstRef = db.collection('badge_gg_bursts').doc(safeUid);
    const userRef = db.collection('users').doc(uid);
    return db.runTransaction(async function (t) {
        const claimSnap = await t.get(claimRef);
        if (claimSnap && claimSnap.exists) return { queued: false, reason: 'claimed' };
        const burstSnap = await t.get(burstRef);
        const userSnap = await t.get(userRef);
        const user = userSnap && userSnap.exists ? (userSnap.data() || {}) : {};
        const item = { badgeId: safeBadge, favorPoint: !!(data && data.favorPoint === true) };
        let closing = null;
        let closingSnap = null;
        if (burstSnap && burstSnap.exists) {
            const burst = burstSnap.data() || {};
            const open = burst.posted !== true && burst.startedAtMs && at <= burst.startedAtMs + BURST_WINDOW_MS;
            if (open) {
                const items = Array.isArray(burst.items) ? burst.items.slice() : [];
                if (!items.some(function (row) { return row && row.badgeId === safeBadge; })) items.push(item);
                t.set(claimRef, { uid: uid, badgeId: safeBadge, at: at });
                t.set(burstRef, {
                    uid: burst.uid || uid,
                    startedAtMs: burst.startedAtMs,
                    flushAfterMs: burst.flushAfterMs || (burst.startedAtMs + BURST_WINDOW_MS),
                    posted: false,
                    items: items,
                });
                return { queued: true, joined: true };
            }
            if (burst.posted !== true && burst.items && burst.items.length) {
                closing = burst;
                closingSnap = await t.get(db.collection('announcements').doc(announcementId(burst.uid, burst.startedAtMs)));
            }
        }
        t.set(claimRef, { uid: uid, badgeId: safeBadge, at: at });
        if (closing) stageAnnouncement(t, db, adminSdk, closing, user, closingSnap);
        t.set(burstRef, newBurst(uid, item, at));
        return { queued: true, started: true };
    });
}

async function flushOneBurst(db, adminSdk, burstId, nowMs) {
    const burstRef = db.collection('badge_gg_bursts').doc(burstId);
    return db.runTransaction(async function (t) {
        const burstSnap = await t.get(burstRef);
        if (!burstSnap || !burstSnap.exists) return { posted: false, reason: 'missing' };
        const burst = burstSnap.data() || {};
        if (burst.posted === true) return { posted: false, reason: 'posted' };
        if ((Number(burst.flushAfterMs) || 0) > nowMs) return { posted: false, reason: 'wait' };
        const userRef = db.collection('users').doc(burst.uid);
        const userSnap = await t.get(userRef);
        const user = userSnap && userSnap.exists ? (userSnap.data() || {}) : {};
        const annSnap = await t.get(db.collection('announcements').doc(announcementId(burst.uid, burst.startedAtMs)));
        const written = stageAnnouncement(t, db, adminSdk, burst, user, annSnap);
        t.set(burstRef, {
            uid: burst.uid,
            startedAtMs: burst.startedAtMs,
            flushAfterMs: burst.flushAfterMs,
            posted: true,
            items: burst.items || [],
            announcementId: written.annId,
        });
        return { posted: written.created, text: written.text, announcementId: written.annId };
    });
}

async function flushDueBursts(db, adminSdk, nowMs) {
    const at = Number(nowMs) || Date.now();
    let query = db.collection('badge_gg_bursts');
    if (typeof query.where === 'function') query = query.where('posted', '==', false);
    const snap = await query.get();
    const ids = [];
    const visit = function (doc) {
        const data = doc.data ? (doc.data() || {}) : {};
        if (data.posted === true) return;
        if ((Number(data.flushAfterMs) || 0) > at) return;
        ids.push(doc.id);
    };
    if (snap && typeof snap.forEach === 'function') snap.forEach(visit);
    else if (snap && snap.docs) snap.docs.forEach(visit);
    const results = [];
    for (let i = 0; i < ids.length; i++) {
        results.push(await flushOneBurst(db, adminSdk, ids[i], at));
    }
    return results;
}

module.exports = {
    BURST_WINDOW_MS: BURST_WINDOW_MS,
    MAJOR_BADGES: MAJOR_BADGES,
    skipBadgeGg: skipBadgeGg,
    formatBadgeGg: formatBadgeGg,
    sanitizeDisplayName: sanitizeDisplayName,
    queueBadgeGg: queueBadgeGg,
    flushDueBursts: flushDueBursts,
    announcementId: announcementId,
};
