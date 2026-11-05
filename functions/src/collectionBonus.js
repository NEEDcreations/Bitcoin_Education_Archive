'use strict';

// Eleven merged collections. Each old set keeps its badges and its bonus id.
// The server stops paying those old bonuses. A finished collection pays
// bonusPts minus the old bonuses the user already holds, and never below 0.
// Payment is server-side only, once per user per collection. The full
// remainder is credited outside the shared daily cap and is not written to
// that day's daily_points total. The ledger source is collection_bonus.
// Ten Satoshi's Favor points are added with the first record. That record
// also posts one Nacho message in Global Chat. A failed post stays pending
// and is retried. A client claim cannot choose the amount or the post.

const fs = require('fs');
const path = require('path');

const { rewardBlocked } = require('./cipherClaim');
const { planFavorPoints } = require('./favorPool');
const { heldIdsForCollection } = require('./badgeProfile');
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

// A badge has server proof when the server can award it (not cosmetic).
// Completion requires every one of those. The bonus is the sum of the
// server-paid old sets, so Entertainment's three provable badges pay 150,
// not the old displayed 1,500. A collection with no such badge (Fun and
// Fitness) still requires every member, pays 0 XP, and can record Favor
// and the congrats once those members are server-held.
function proofMemberIds(col) {
    const rules = require('./badgeRules');
    return (col && col.badgeIds || []).filter(function (id) {
        const rule = rules.ruleFor(id);
        return !!(rule && !rule.cosmetic);
    });
}

function requiredMembers(col) {
    const ids = (col && col.badgeIds || []).slice();
    const proof = proofMemberIds(col);
    return proof.length ? proof : ids;
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

function stageBadgeFavor(t, db, adminSdk, ctx) {
    const src = ctx || {};
    if (!src.contributorSnap || src.contributorSnap.exists) {
        src.favorPoint = false;
        return false;
    }
    const stateSnap = src.stateSnap;
    const stateData = stateSnap && stateSnap.exists ? (stateSnap.data() || {}) : {
        points: 0, favorActive: false, bonusMinutes: 0, eraHashes: 0,
    };
    const nowMs = Number(src.nowMs) || Date.now();
    const pointsToAdd = COLLECTION_FAVOR_POINTS;
    const plan = planFavorPoints(stateData, nowMs, pointsToAdd);
    const faction = (src.user && src.user.faction) || null;
    // Backfill records the player's 10 points, but it does not write the live
    // pool. That write is what opens the window and posts "SF is LIVE".
    const skipPool = src.skipPool === true;
    const contributorDoc = {
        uid: src.uid,
        source: 'badge_earned',
        detail: src.badgeId,
        badgeId: src.badgeId,
        day: src.day,
        timestamp: adminSdk.firestore.FieldValue.serverTimestamp(),
        faction: faction,
        pointsAdded: pointsToAdd,
    };
    if (skipPool) contributorDoc.backfill = true;
    t.set(src.contributorRef, contributorDoc);
    const field = factionField(faction);
    const totals = src.totalsSnap && src.totalsSnap.exists ? (src.totalsSnap.data() || {}) : {};
    const totalsWrite = { lastUpdated: adminSdk.firestore.FieldValue.serverTimestamp() };
    totalsWrite[field] = (Number(totals[field]) || 0) + pointsToAdd;
    t.set(src.totalsRef, Object.assign({}, totals, totalsWrite));
    t.set(db.collection('satoshiFavor').doc('userSfPoints').collection('users').doc(src.uid), {
        uid: src.uid,
        points: adminSdk.firestore.FieldValue.increment(pointsToAdd),
        updatedAt: adminSdk.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    if (skipPool) {
        src.favorPoint = false;
        return true;
    }
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
        // Same stamp checkAndResetFavor writes. A later live announce treats
        // hashes from before lastReset as the previous window.
        next.lastReset = adminSdk.firestore.Timestamp.now();
        t.set(db.collection('satoshiFavor').doc('lastWindow'), {
            cycleId: stateData.currentCycleId || null,
            endedAt: stamp(adminSdk, nowMs),
            archivedAt: stamp(adminSdk, nowMs),
        });
    }
    t.set(src.stateRef, next);
    // Pool points only. An open window adds bonus minutes and does not count.
    src.favorPoint = plan.extended !== true;
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

function collectionsTouching(badgeId) {
    if (!badgeId || isRetiredSetBonus(badgeId)) return [];
    return collections().filter(function (col) {
        return col.bonusId === badgeId || (col.badgeIds || []).indexOf(badgeId) !== -1;
    });
}

function awardRowsFromSnap(snap) {
    const rows = {};
    if (!snap || typeof snap.forEach !== 'function') return rows;
    snap.forEach(function (doc) {
        if (!doc || !doc.id) return;
        rows[doc.id] = typeof doc.data === 'function' ? (doc.data() || {}) : {};
    });
    return rows;
}

async function awardAlreadySettled(db, uid, badgeId, awardData) {
    const hits = collectionsTouching(badgeId);
    if (!hits.length) return true;
    if (awardData && awardData.congratsPending === true) {
        for (let i = 0; i < hits.length; i++) {
            if (hits[i].bonusId === badgeId) return false;
        }
    }
    try {
        const userRef = db.collection('users').doc(uid);
        const userSnap = await userRef.get();
        const awardsSnap = await userRef.collection('badge_awards').get();
        const user = userSnap && userSnap.exists ? (userSnap.data() || {}) : {};
        const rows = awardRowsFromSnap(awardsSnap);
        const held = heldIdsForCollection(user, rows);
        for (let i = 0; i < hits.length; i++) {
            const col = hits[i];
            const plan = planGrant(col, held);
            if (plan.eligible) return false;
            const row = rows[col.bonusId] || {};
            if (row.congratsPending === true) return false;
        }
        return true;
    } catch (err) {
        return false;
    }
}

async function congratsPendingFor(db, uid, bonusId) {
    try {
        const snap = await db.collection('users').doc(uid).collection('badge_awards').doc(bonusId).get();
        if (!snap || !snap.exists) return false;
        const data = typeof snap.data === 'function' ? (snap.data() || {}) : {};
        return data.congratsPending === true;
    } catch (err) {
        return true;
    }
}

async function clearCongratsPending(db, awardRef) {
    await db.runTransaction(async function (t) {
        const snap = await t.get(awardRef);
        if (!snap || !snap.exists) return;
        const data = typeof snap.data === 'function' ? (snap.data() || {}) : {};
        if (data.congratsPending !== true) return;
        t.set(awardRef, { congratsPending: false }, { merge: true });
    });
}

async function finishCongrats(db, adminSdk, uid, col, awardRef) {
    const posted = await module.exports.postCollectionCongrats(db, adminSdk, uid, col);
    const settled = !!(posted && (posted.wrote || posted.reason === 'already_posted'));
    if (settled) await clearCongratsPending(db, awardRef);
    return {
        chatPosted: !!(posted && posted.wrote),
        congratsPending: !settled,
    };
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
        const held = heldIdsForCollection(user, awardRowsFromSnap(awardsSnap));
        const award = awardSnap && awardSnap.exists ? (awardSnap.data() || {}) : {};
        if (xpSnap.exists || awardSnap.exists || held.has(col.bonusId)) {
            return {
                granted: false,
                success: true,
                reason: 'already',
                awarded: 0,
                xp: 0,
                badgeId: col.bonusId,
                congratsPending: award.congratsPending === true,
            };
        }
        const plan = planGrant(col, held);
        if (!plan.eligible) {
            return { granted: false, success: false, reason: plan.reason, awarded: 0, xp: 0, badgeId: col.bonusId };
        }

        const stateSnap = await t.get(stateRef);
        const contributorSnap = await t.get(contributorRef);
        const totalsSnap = await t.get(totalsRef);
        // Full remainder. This is the only XP credit that skips the daily cap.
        // It does not read or write users/{uid}/daily_points/{day}.
        const xp = plan.remainder > 0 ? plan.remainder : 0;
        const update = {
            visibleBadges: adminSdk.firestore.FieldValue.arrayUnion(col.bonusId),
        };
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
            dropped: 0,
            day: day,
            createdAtMs: nowMs,
            uid: uid,
            bonusId: col.bonusId,
            collectionId: col.id,
            legacyHeld: plan.legacyHeld,
        });
        const favorCtx = {
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
            skipPool: options.backfill === true || options.postChat === false,
        };
        const favor = stageBadgeFavor(t, db, adminSdk, favorCtx);
        const awardDoc = {
            awardedAt: adminSdk.firestore.FieldValue.serverTimestamp(),
            badge: col.bonusId,
            xp: xp,
            requestedXp: plan.remainder,
            dropped: 0,
            day: day,
            source: 'collection_bonus',
            congratsPending: options.postChat === false ? false : true,
            favorPoint: favorCtx.favorPoint === true,
            // This create re-enters onBadgeAwardCreated. ggSkip keeps the bonus
            // out of the GGs burst, so it neither joins an open burst nor flushes
            // one. Nacho posts the collection line in Global Chat when postChat is on.
            // Backfill and any postChat:false grant also stay quiet in GGs.
            ggSkip: true,
        };
        t.set(awardRef, awardDoc);
        t.update(userRef, update);
        return {
            granted: true,
            success: true,
            reason: 'ready',
            xp: xp,
            awarded: xp,
            requested: plan.remainder,
            dropped: 0,
            capped: false,
            favor: favor,
            badgeId: col.bonusId,
            collectionId: col.id,
            congratsPending: options.postChat !== false,
        };
    });
    const shouldPost = options.postChat !== false && result && (
        result.granted === true || (result.reason === 'already' && result.congratsPending === true)
    );
    if (shouldPost) {
        try {
            const posted = await finishCongrats(db, adminSdk, uid, col, awardRef);
            result.chatPosted = posted.chatPosted;
            result.congratsPending = posted.congratsPending;
        } catch (err) {
            console.error('[collectionBonus] chat', err && err.message ? err.message : err);
            result.chatPosted = false;
            result.congratsPending = true;
            if (err && typeof err === 'object') {
                err.collectionChat = true;
                err.grantResult = result;
            }
            throw err;
        }
    }
    return result;
}

async function maybeGrantForBadge(db, adminSdk, uid, badgeId, opts) {
    if (!uid || !badgeId) return [];
    const hits = collectionsTouching(badgeId);
    const out = [];
    if (!hits.length) return out;
    // Skip the grant transaction when a server read already shows the set is
    // incomplete or already recorded and the congrats post is not waiting.
    // The transaction checks the same facts again before it pays.
    let held = null;
    try {
        const userRef = db.collection('users').doc(uid);
        const userSnap = await userRef.get();
        const awardsSnap = await userRef.collection('badge_awards').get();
        const user = userSnap && userSnap.exists ? (userSnap.data() || {}) : {};
        held = heldIdsForCollection(user, awardRowsFromSnap(awardsSnap));
    } catch (err) {
        held = null;
    }
    let chatErr = null;
    for (let i = 0; i < hits.length; i++) {
        if (held) {
            const plan = planGrant(hits[i], held);
            if (!plan.eligible && plan.reason !== 'already') {
                out.push({
                    granted: false,
                    success: false,
                    reason: plan.reason,
                    awarded: 0,
                    xp: 0,
                    badgeId: hits[i].bonusId,
                    collectionId: hits[i].id,
                });
                continue;
            }
            if (plan.reason === 'already') {
                const pending = await congratsPendingFor(db, uid, hits[i].bonusId);
                if (!pending) {
                    out.push({
                        granted: false,
                        success: true,
                        reason: 'already',
                        awarded: 0,
                        xp: 0,
                        badgeId: hits[i].bonusId,
                        collectionId: hits[i].id,
                    });
                    continue;
                }
            }
        }
        try {
            out.push(await grantCollectionBonus(db, adminSdk, uid, hits[i].id, opts));
        } catch (err) {
            if (!err || !err.collectionChat) throw err;
            const prior = err.grantResult || {};
            const report = {
                granted: prior.reason === 'already' ? false : prior.granted === true,
                success: true,
                reason: 'chat',
                chatPosted: false,
                congratsPending: true,
                awarded: 0,
                xp: 0,
                badgeId: hits[i].bonusId,
                collectionId: hits[i].id,
            };
            console.error('[collectionBonus] pending', report.granted, report.congratsPending, report.reason);
            if (!chatErr) {
                err.chatReport = report;
                chatErr = err;
            }
            out.push(report);
        }
    }
    if (chatErr) throw chatErr;
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
    proofMemberIds: proofMemberIds,
    requiredMembers: requiredMembers,
    collectionsTouching: collectionsTouching,
    awardAlreadySettled: awardAlreadySettled,
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
