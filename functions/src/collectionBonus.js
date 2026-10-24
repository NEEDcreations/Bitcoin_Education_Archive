'use strict';

// Eleven merged collections. Each old set keeps its badges and its bonus id.
// The server stops paying those old bonuses. A finished collection pays
// bonusPts minus the old bonuses the user already holds, and never below 0.
// Payment is server-side only: xp_ledger, the shared daily cap, and ten
// Satoshi's Favor points. The first record also posts one Nacho message in
// Global Chat. A client claim cannot choose the amount or the post.

const fs = require('fs');
const path = require('path');

const { applyDailyXp } = require('./applyDailyXp');
const { rewardBlocked } = require('./cipherClaim');
const { planFavorPoints } = require('./favorPool');
const { planDailyXp } = require('./dailyXp');
const { serverHeldBadgeIds } = require('./badgeProfile');
const { offsetDateKey } = require('./offsetDay');

const SETS_FILE = path.join(__dirname, 'collection-sets.json');
const COLLECTION_FAVOR_POINTS = 10;
const NEUTRAL_NAME = 'A Bitcoiner';

const GROUPS = [
    { id: 'col_learning', name: 'Learning', emoji: '📚', color: '#3b82f6', setIds: ['set_scholar', 'set_scholar_daily', 'set_explorer', 'set_trails'] },
    { id: 'col_daily_habits', name: 'Daily Habits', emoji: '🎯', color: '#f7931a', setIds: ['set_daily', 'set_daily_five', 'set_trifecta', 'set_streak', 'set_spin'] },
    { id: 'col_mining', name: 'Mining', emoji: '⛏️', color: '#f7931a', setIds: ['set_miner', 'set_favor'] },
    { id: 'col_foresight', name: 'Foresight and Luck', emoji: '🔮', color: '#a78bfa', setIds: ['set_oracle', 'set_raffle'] },
    { id: 'col_arena', name: 'Arena', emoji: '⚔️', color: '#ec4899', setIds: ['set_pvp', 'set_gladiator', 'set_codebreaker'] },
    { id: 'col_community', name: 'Community', emoji: '💬', color: '#8b5cf6', setIds: ['set_social', 'set_voice', 'set_network', 'set_irl'] },
    { id: 'col_lightning', name: 'Lightning and Giving', emoji: '⚡', color: '#eab308', setIds: ['set_lightning', 'set_generous'] },
    { id: 'col_builder', name: 'Builder and Market', emoji: '🏗️', color: '#22c55e', setIds: ['set_builder', 'set_trader'] },
    { id: 'col_entertainment', name: 'Entertainment', emoji: '🎵', color: '#f472b6', setIds: ['set_beats', 'set_tctv', 'set_tv'] },
    { id: 'col_profile', name: 'Profile and Setup', emoji: '👤', color: '#6366f1', setIds: ['set_profile', 'set_newcomer', 'set_sovereign'] },
    { id: 'col_fitness', name: 'Fun and Fitness', emoji: '🚶', color: '#84cc16', setIds: ['set_fun', 'set_pow'] },
];

let cachedSets = null;

function parseSets(text) {
    const start = text.indexOf('var BADGE_SETS = [');
    const end = text.indexOf('function _renderBadgeSets');
    if (start < 0 || end < start) throw new Error('BADGE_SETS block missing');
    const body = text.slice(start, end);
    const re = /id:'(set_[a-z0-9_]+)', name:'([^']*)'[\s\S]*?badgeIds:\[([^\]]*)\], bonusId:'([^']+)', bonusPts:(\d+)/g;
    const sets = [];
    let match;
    while ((match = re.exec(body))) {
        const badgeIds = match[3].split(',').map(function (part) {
            return part.replace(/['"\s]/g, '');
        }).filter(Boolean);
        sets.push({
            id: match[1],
            name: match[2],
            bonusId: match[4],
            bonusPts: Number(match[5]) || 0,
            badgeIds: badgeIds,
        });
    }
    if (sets.length !== 32) throw new Error('expected 32 badge sets, found ' + sets.length);
    return sets;
}

function parseHiddenPts(text) {
    const pts = {};
    text.split('\n').forEach(function (line) {
        const match = line.match(/id: '(set_[a-z0-9_]+)'.*pts:\s*(\d+)/);
        if (match) pts[match[1]] = Number(match[2]) || 0;
    });
    return pts;
}

function legacyBonusPts(set, hiddenPts) {
    const bonusId = set.bonusId;
    const hidden = hiddenPts && Object.prototype.hasOwnProperty.call(hiddenPts, bonusId)
        ? Number(hiddenPts[bonusId]) || 0
        : null;
    if (bonusId.slice(-9) === '_complete' && hidden != null) {
        return Math.max(Number(set.bonusPts) || 0, hidden);
    }
    return Number(set.bonusPts) || 0;
}

function readSets() {
    if (cachedSets) return cachedSets;
    cachedSets = JSON.parse(fs.readFileSync(SETS_FILE, 'utf8'));
    return cachedSets;
}

function writeSetsFile(badgesPath) {
    const file = badgesPath || path.join(__dirname, '..', '..', 'badges.js');
    const text = fs.readFileSync(file, 'utf8');
    const hidden = parseHiddenPts(text);
    const rows = parseSets(text).map(function (set) {
        return {
            id: set.id,
            name: set.name,
            bonusId: set.bonusId,
            bonusPts: set.bonusPts,
            badgeIds: set.badgeIds,
            legacyPts: legacyBonusPts(set, hidden),
        };
    });
    fs.writeFileSync(SETS_FILE, JSON.stringify(rows));
    cachedSets = rows;
    return rows;
}

function remainderXp(bonusPts, heldLegacy) {
    const total = Math.max(0, Math.floor(Number(bonusPts) || 0));
    let already = 0;
    (heldLegacy || []).forEach(function (row) {
        const pts = typeof row === 'number' ? row : Number(row && row.pts);
        if (pts > 0) already += pts;
    });
    return Math.max(0, total - already);
}

function buildCollections(sets) {
    const byId = {};
    (sets || []).forEach(function (set) { byId[set.id] = set; });
    return GROUPS.map(function (group) {
        const badgeIds = [];
        const seen = {};
        const legacyBonuses = [];
        let bonusPts = 0;
        group.setIds.forEach(function (setId) {
            const set = byId[setId];
            if (!set) throw new Error('missing set ' + setId);
            (set.badgeIds || []).forEach(function (badgeId) {
                if (seen[badgeId]) return;
                seen[badgeId] = true;
                badgeIds.push(badgeId);
            });
            const pts = serverPaidXp(set.bonusId);
            bonusPts += pts;
            legacyBonuses.push({ id: set.bonusId, pts: pts, setId: set.id });
        });
        return {
            id: group.id,
            name: group.name,
            emoji: group.emoji,
            color: group.color,
            setIds: group.setIds.slice(),
            badgeIds: badgeIds,
            bonusId: group.id + '_bonus',
            bonusPts: bonusPts,
            bonusEmoji: group.emoji,
            bonusName: group.name,
            bonusDesc: 'Completed the ' + group.name + ' collection',
            legacyBonuses: legacyBonuses,
        };
    });
}

function collections() {
    return buildCollections(readSets());
}

function collectionById(id) {
    const found = collections().filter(function (col) { return col.id === id || col.bonusId === id; });
    return found[0] || null;
}

function retiredBonusIds() {
    const ids = {};
    readSets().forEach(function (set) { if (set.bonusId) ids[set.bonusId] = true; });
    return ids;
}

function isRetiredSetBonus(badgeId) {
    return !!retiredBonusIds()[badgeId];
}

function serverPaidXp(bonusId) {
    const rules = require('./badgeRules');
    const rule = rules.ruleFor(bonusId);
    if (!rule || rule.cosmetic) return 0;
    return Math.max(0, Math.floor(Number(rule.xp) || 0));
}

// Every member, including cosmetic badges. A cosmetic badge counts only when
// a server list or badge_awards already has it. Entertainment does not
// complete on its three non-cosmetic badges.
function requiredMembers(col) {
    return (col.badgeIds || []).slice();
}

// From a fresh day. Dropped XP is not banked. applyDailyXp uses the same taper.
function dailyCapReport() {
    return collections().map(function (col) {
        const plan = planDailyXp(0, col.bonusPts);
        return {
            id: col.id,
            name: col.name,
            bonusPts: col.bonusPts,
            awarded: plan.awarded,
            dropped: plan.dropped,
            exceeds: plan.dropped > 0,
        };
    });
}

function planGrant(col, heldIds) {
    const held = heldIds instanceof Set ? heldIds : new Set(heldIds || []);
    if (!col) return { eligible: false, reason: 'unknown', remainder: 0, legacyHeld: [] };
    if (held.has(col.bonusId)) {
        return { eligible: false, reason: 'already', remainder: 0, legacyHeld: [] };
    }
    const required = requiredMembers(col);
    if (!required.length) return { eligible: false, reason: 'unproven', remainder: 0, legacyHeld: [] };
    if (!required.every(function (id) { return held.has(id); })) {
        return { eligible: false, reason: 'incomplete', remainder: 0, legacyHeld: [] };
    }
    const legacyHeld = (col.legacyBonuses || []).filter(function (row) { return held.has(row.id); });
    return {
        eligible: true,
        reason: 'ready',
        remainder: remainderXp(col.bonusPts, legacyHeld),
        legacyHeld: legacyHeld.map(function (row) { return row.id; }),
    };
}

function emptyCounts() {
    const counts = { scanned: 0, bannedSkipped: 0, collections: {} };
    collections().forEach(function (col) {
        counts.collections[col.id] = {
            name: col.name,
            bonusPts: col.bonusPts,
            complete: 0,
            already: 0,
            payUsers: 0,
            remainderXp: 0,
            zeroRemainder: 0,
        };
    });
    return counts;
}

function summarizeUser(user, ledger, heldIds) {
    if (rewardBlocked(user, ledger)) return { banned: true, rows: [] };
    const rows = collections().map(function (col) {
        return { id: col.id, plan: planGrant(col, heldIds) };
    });
    return { banned: false, rows: rows };
}

function addUser(counts, summary) {
    counts.scanned += 1;
    if (!summary || summary.banned) {
        counts.bannedSkipped += 1;
        return counts;
    }
    (summary.rows || []).forEach(function (row) {
        const bucket = counts.collections[row.id];
        if (!bucket) return;
        const plan = row.plan || {};
        if (plan.reason === 'already') {
            bucket.complete += 1;
            bucket.already += 1;
            return;
        }
        if (!plan.eligible) return;
        bucket.complete += 1;
        if (plan.remainder > 0) {
            bucket.payUsers += 1;
            bucket.remainderXp += plan.remainder;
        } else {
            bucket.zeroRemainder += 1;
        }
    });
    return counts;
}

function stamp(adminSdk, ms) {
    if (adminSdk && adminSdk.firestore && adminSdk.firestore.Timestamp && typeof adminSdk.firestore.Timestamp.fromMillis === 'function') {
        return adminSdk.firestore.Timestamp.fromMillis(ms);
    }
    return { toMillis: function () { return ms; }, _ms: ms };
}

function factionField(faction) {
    if (faction === 'cyber_hornets') return 'cyber_hornets';
    if (faction === 'honey_badgers') return 'honey_badgers';
    return 'unaffiliated';
}

function awardIdsFromSnap(snap) {
    const ids = [];
    if (!snap || typeof snap.forEach !== 'function') return ids;
    snap.forEach(function (doc) { if (doc && doc.id) ids.push(doc.id); });
    return ids;
}

function stageBadgeFavor(t, db, adminSdk, ctx) {
    const src = ctx || {};
    if (!src.contributorSnap || src.contributorSnap.exists) return false;
    const stateSnap = src.stateSnap;
    const stateData = stateSnap && stateSnap.exists ? (stateSnap.data() || {}) : {
        points: 0, favorActive: false, bonusMinutes: 0, eraHashes: 0,
    };
    const nowMs = Number(src.nowMs) || Date.now();
    const pointsToAdd = COLLECTION_FAVOR_POINTS;
    const plan = planFavorPoints(stateData, nowMs, pointsToAdd);
    const faction = (src.user && src.user.faction) || null;
    t.set(src.contributorRef, {
        uid: src.uid,
        source: 'badge_earned',
        detail: src.badgeId,
        badgeId: src.badgeId,
        day: src.day,
        timestamp: adminSdk.firestore.FieldValue.serverTimestamp(),
        faction: faction,
        pointsAdded: pointsToAdd,
    });
    const field = factionField(faction);
    const totals = src.totalsSnap && src.totalsSnap.exists ? (src.totalsSnap.data() || {}) : {};
    const totalsWrite = { lastUpdated: adminSdk.firestore.FieldValue.serverTimestamp() };
    totalsWrite[field] = (Number(totals[field]) || 0) + pointsToAdd;
    t.set(src.totalsRef, Object.assign({}, totals, totalsWrite));
    const next = Object.assign({}, stateData, {
        points: plan.points,
        favorActive: plan.favorActive,
        bonusMinutes: plan.bonusMinutes,
        eraHashes: plan.eraHashes != null ? plan.eraHashes : (stateData.eraHashes || 0),
        currentCycleId: plan.currentCycleId || stateData.currentCycleId || null,
    });
    if (plan.activated) {
        next.favorStart = stamp(adminSdk, plan.favorStartMs);
        next.favorEndBase = stamp(adminSdk, plan.favorEndBaseMs);
        next.totalHashes = 0;
        next.lowestHashThisWindow = null;
        next.winnersThisWindow = [];
    } else if (plan.expired) {
        next.favorStart = null;
        next.favorEndBase = null;
        next.totalHashes = 0;
        next.lowestHashThisWindow = null;
        next.winnersThisWindow = [];
    }
    if (plan.expired) {
        t.set(db.collection('satoshiFavor').doc('lastWindow'), {
            cycleId: stateData.currentCycleId || null,
            endedAt: stamp(adminSdk, nowMs),
            archivedAt: stamp(adminSdk, nowMs),
        });
    }
    t.set(src.stateRef, next);
    t.set(db.collection('satoshiFavor').doc('userSfPoints').collection('users').doc(src.uid), {
        uid: src.uid,
        points: adminSdk.firestore.FieldValue.increment(pointsToAdd),
        updatedAt: adminSdk.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return true;
}

function mentionUsername(profile) {
    const raw = profile && typeof profile.username === 'string' ? profile.username : '';
    const name = raw.replace(/[\r\n<>@]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!name || name.toLowerCase() === 'anonymous') return '';
    if (!/^[A-Za-z0-9 _.\-]{3,20}$/.test(name)) return '';
    return name;
}

function collectionChatDocId(bonusId, uid) {
    const clean = String(bonusId || '') + '_' + String(uid || '');
    const safe = clean.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120);
    return safe ? ('colbonus_' + safe) : '';
}

function collectionCongratsText(username, collectionName) {
    const collection = String(collectionName || 'collection').replace(/[\r\n<>@]/g, ' ').trim() || 'collection';
    const who = username ? ('@' + username) : NEUTRAL_NAME;
    return '🎉 ' + who + ' completed the ' + collection + ' collection! The whole set is yours. Congratulations!';
}

async function postCollectionCongrats(db, adminSdk, uid, col) {
    const docId = collectionChatDocId(col && col.bonusId, uid);
    if (!db || !adminSdk || !docId || !col) return { wrote: false, reason: 'bad_plan' };
    let username = '';
    try {
        const profileSnap = await db.collection('public_profiles').doc(uid).get();
        const profile = profileSnap && profileSnap.exists ? (profileSnap.data() || {}) : null;
        username = mentionUsername(profile);
    } catch (err) {
        username = '';
    }
    const text = collectionCongratsText(username, col.name).slice(0, 500);
    const chatRef = db.collection('global_chat').doc(docId);
    const notifRef = db.collection('notifications').doc(docId);
    const serverTimestamp = function () { return adminSdk.firestore.FieldValue.serverTimestamp(); };
    const outcome = await db.runTransaction(async function (t) {
        const chatSnap = await t.get(chatRef);
        if (chatSnap.exists) return { wrote: false, reason: 'already_posted' };
        const msg = {
            uid: 'nacho-bot',
            name: '🦌 Nacho',
            text: text,
            isNachoAuto: false,
            ts: serverTimestamp(),
        };
        if (username) msg.mentionUid = uid;
        t.set(chatRef, msg);
        if (username) {
            t.set(notifRef, {
                recipientId: uid,
                senderId: 'nacho-bot',
                senderName: 'Nacho 🦌',
                type: 'chat_mention',
                message: '💬 @Nacho mentioned you in Global Chat: "' + text.slice(0, 50) + '"',
                targetType: 'chat',
                targetId: docId,
                read: false,
                createdAt: serverTimestamp(),
            });
        }
        return { wrote: true, reason: 'ok', mentionUid: username ? uid : '' };
    });
    if (outcome && outcome.wrote && outcome.mentionUid) {
        try {
            const push = require('./push');
            await push.sendUserPush(outcome.mentionUid, 'mentions', {
                title: 'You were mentioned',
                body: '🦌 Nacho mentioned you in chat.',
                url: 'https://bitcoineducation.quest/#chat',
            });
        } catch (err) {
            console.warn('[collectionBonus] mention push failed', err && err.message ? err.message : err);
        }
    }
    return outcome || { wrote: false, reason: 'empty' };
}

async function grantCollectionBonus(db, adminSdk, uid, collectionId, opts) {
    const options = opts || {};
    const col = collectionById(collectionId);
    if (!col) return { granted: false, success: false, reason: 'unknown', awarded: 0, xp: 0 };
    const userRef = db.collection('users').doc(uid);
    const ledgerRef = db.collection('faucet_ledger').doc(uid);
    const xpRef = userRef.collection('xp_ledger').doc(col.bonusId);
    const awardRef = userRef.collection('badge_awards').doc(col.bonusId);
    const nowMs = Number(options.nowMs) || Date.now();
    const day = options.day || offsetDateKey(nowMs);
    const stateRef = db.collection('satoshiFavor').doc('current');
    const contributorRef = stateRef.collection('contributors').doc(uid + '_badge_' + col.bonusId);
    const totalsRef = db.collection('satoshiFavor').doc('factionTotals');

    const result = await db.runTransaction(async function (t) {
        const userSnap = await t.get(userRef);
        const ledgerSnap = await t.get(ledgerRef);
        const xpSnap = await t.get(xpRef);
        const awardSnap = await t.get(awardRef);
        const awardsSnap = await t.get(userRef.collection('badge_awards'));
        if (!userSnap.exists) return { granted: false, success: false, reason: 'no_user', awarded: 0, xp: 0, badgeId: col.bonusId };
        const user = userSnap.data() || {};
        const ledger = ledgerSnap && ledgerSnap.exists ? (ledgerSnap.data() || {}) : {};
        if (rewardBlocked(user, ledger)) {
            return { granted: false, success: true, reason: 'banned', awarded: 0, xp: 0, badgeId: col.bonusId };
        }
        const held = serverHeldBadgeIds(user, awardIdsFromSnap(awardsSnap));
        if (xpSnap.exists || awardSnap.exists || held.has(col.bonusId)) {
            return { granted: false, success: true, reason: 'already', awarded: 0, xp: 0, badgeId: col.bonusId };
        }
        const plan = planGrant(col, held);
        if (!plan.eligible) {
            return { granted: false, success: false, reason: plan.reason, awarded: 0, xp: 0, badgeId: col.bonusId };
        }

        const stateSnap = await t.get(stateRef);
        const contributorSnap = await t.get(contributorRef);
        const totalsSnap = await t.get(totalsRef);
        const xpGrant = await applyDailyXp(uid, plan.remainder, t, { day: day, userRef: userRef });
        const xp = xpGrant.awarded > 0 ? xpGrant.awarded : 0;
        const update = {
            visibleBadges: adminSdk.firestore.FieldValue.arrayUnion(col.bonusId),
        };
        if (col.bonusPts > 0) update.payingBadgeCount = adminSdk.firestore.FieldValue.increment(1);
        if (xp > 0) {
            update.points = adminSdk.firestore.FieldValue.increment(xp);
            update.weeklyXP = adminSdk.firestore.FieldValue.increment(xp);
            update.monthlyXP = adminSdk.firestore.FieldValue.increment(xp);
        }
        t.set(xpRef, {
            source: 'collection_bonus',
            amount: xp,
            requested: plan.remainder,
            awarded: xp,
            dropped: xpGrant.dropped,
            day: day,
            createdAtMs: nowMs,
            uid: uid,
            bonusId: col.bonusId,
            collectionId: col.id,
            legacyHeld: plan.legacyHeld,
        });
        t.set(awardRef, {
            awardedAt: adminSdk.firestore.FieldValue.serverTimestamp(),
            badge: col.bonusId,
            xp: xp,
            requestedXp: plan.remainder,
            dropped: xpGrant.dropped,
            day: day,
            source: 'collection_bonus',
        });
        t.update(userRef, update);
        if (xp > 0 && xpGrant.dailyRef) {
            t.set(xpGrant.dailyRef, {
                total: xpGrant.dailyXp,
                lastUpdated: adminSdk.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        const favor = stageBadgeFavor(t, db, adminSdk, {
            uid: uid,
            badgeId: col.bonusId,
            day: day,
            nowMs: nowMs,
            user: user,
            stateSnap: stateSnap,
            contributorSnap: contributorSnap,
            totalsSnap: totalsSnap,
            stateRef: stateRef,
            contributorRef: contributorRef,
            totalsRef: totalsRef,
        });
        return {
            granted: true,
            success: true,
            reason: 'ready',
            xp: xp,
            awarded: xp,
            requested: plan.remainder,
            dropped: xpGrant.dropped,
            capped: xpGrant.capped === true,
            favor: favor,
            badgeId: col.bonusId,
            collectionId: col.id,
        };
    });
    if (result && result.granted === true && options.postChat !== false) {
        try {
            const posted = await postCollectionCongrats(db, adminSdk, uid, col);
            result.chatPosted = !!(posted && posted.wrote);
        } catch (err) {
            console.error('[collectionBonus] chat', err && err.message ? err.message : err);
            result.chatPosted = false;
        }
    }
    return result;
}

async function maybeGrantForBadge(db, adminSdk, uid, badgeId, opts) {
    if (!uid || !badgeId || isRetiredSetBonus(badgeId)) return [];
    const hits = collections().filter(function (col) {
        return col.badgeIds.indexOf(badgeId) !== -1;
    });
    const out = [];
    for (let i = 0; i < hits.length; i++) {
        out.push(await grantCollectionBonus(db, adminSdk, uid, hits[i].id, opts));
    }
    return out;
}

module.exports = {
    GROUPS: GROUPS,
    parseSets: parseSets,
    parseHiddenPts: parseHiddenPts,
    legacyBonusPts: legacyBonusPts,
    writeSetsFile: writeSetsFile,
    remainderXp: remainderXp,
    buildCollections: buildCollections,
    collections: collections,
    collectionById: collectionById,
    isRetiredSetBonus: isRetiredSetBonus,
    requiredMembers: requiredMembers,
    dailyCapReport: dailyCapReport,
    planGrant: planGrant,
    emptyCounts: emptyCounts,
    summarizeUser: summarizeUser,
    addUser: addUser,
    COLLECTION_FAVOR_POINTS: COLLECTION_FAVOR_POINTS,
    mentionUsername: mentionUsername,
    collectionChatDocId: collectionChatDocId,
    collectionCongratsText: collectionCongratsText,
    postCollectionCongrats: postCollectionCongrats,
    stageBadgeFavor: stageBadgeFavor,
    grantCollectionBonus: grantCollectionBonus,
    maybeGrantForBadge: maybeGrantForBadge,
};
